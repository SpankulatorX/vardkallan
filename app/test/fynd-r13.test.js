// Runda 13, r3: rättelser från det utforskande testet som inte har en egen testfil. Fyndets nummer står i testnamnet
// (E1, E2 och E3 är testarnas rapporter). Testnamnen används i kravregistret.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { byggSeed } from '../src/db.js';
import * as journal from '../src/journal.js';
import * as tidbok from '../src/tidbok.js';
import * as vardkontakt from '../src/vardkontakt.js';
import * as mt from '../src/medicinteknik.js';
import { atk, testserver, klient, sandlada, somPerson } from './hjalp.js';
import * as sj from '../src/sammanhallen.js';
import * as logguppfoljning from '../src/logguppfoljning.js';

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Fynd från det utforskande testet', () => {
  test('E1-23: bara den som skrev en signerad anteckning kan rätta den, och andra får veta att de skriver en ny anteckning', () => {
    const db = byggSeed();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Mår bra.' }] });
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id));
    const rattelse = { orsak: 'Fel dag', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre.' }] };
    // Överläkaren på samma klinik kan inte rätta kollegans anteckning.
    const e = fel(() => journal.ratta(atk(db, 'ol-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Bara Sara Lindqvist kan rätta anteckningen');
    expect(e.message).toContain('ny anteckning');
    // Den som skrev den kan.
    expect(journal.ratta(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse).version).toBe(2);
  });

  test('E1-26: hjälptexten i Sök patient visar inte personnumret för någon patient i demon', () => {
    const db = byggSeed();
    const text = readFileSync(new URL('../public/js/vyer/sok.js', import.meta.url), 'utf8');
    for (const p of db.query('SELECT personnummer FROM patienter').all()) {
      const pnr = p.personnummer;
      expect(text).not.toContain(pnr);
      expect(text).not.toContain(`${pnr.slice(0, 8)}-${pnr.slice(8)}`);
    }
  });

  test('E3-16: kallelsen har mottagningens telefonnummer och ingen intern rad om hur avgiften räknas', () => {
    const db = byggSeed();
    const t = db.query('SELECT id FROM tider ORDER BY start LIMIT 1').get();
    const mall = tidbok.kallelseText(db, { tid_id: t.id, patient_id: null, vantelista_id: null, vardkontakt_id: null }, 'kallelse');
    expect(mall).not.toContain('systemet räknar');
    expect(mall).toMatch(/ring mottagningen på 070-174 06 \d\d \(påhittat nummer i demon\)/);
    const b = db.query("SELECT * FROM bokningar WHERE status = 'bokad' AND patient_id IS NOT NULL LIMIT 1").get();
    expect(tidbok.kallelseText(db, b, 'kallelse')).toMatch(/070-174 06 \d\d/);
    expect(tidbok.kallelseText(db, b, 'paminnelse')).toMatch(/070-174 06 \d\d/);
  });

  test('E1-16: dokumentation utan besök blir en administrativ kontakt utan avgift, och den som dokumenterar ett besök väljer det', () => {
    const db = byggSeed();
    const a = atk(db, 'lak-vc', 'p11', {}, 'las_admin');
    // Anna Viklund har ingen pågående kontakt på vårdcentralen i dag.
    db.query("UPDATE vardkontakter SET slut = coalesce(slut, start) WHERE patient_id = 'p11'").run();
    const f = vardkontakt.aktuell(a);
    expect(f.vardkontakt).toBeNull();
    expect(f.ny).toMatchObject({ kontaktsatt: 'administrativ', plats: 'Administrativ kontakt' });
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const v = { id: 0, typ: 'oppenvard', kontaktsatt: 'administrativ', start: new Date().toISOString(), kalla: 'vardkallan' };
    expect(vardkontakt.avgiftFor(db, p, v).belopp).toBe(0);
    expect(vardkontakt.avgiftFor(db, p, { ...v, kontaktsatt: 'besok' }).belopp).toBeGreaterThan(0);
  });

  test('E3-38: ett blodtryck som inte är möjligt tas inte emot, och ett farligt värde ger råd om 1177 och 112', () => {
    expect(mt.radFor('blodtryck', '190/100', null)).toMatchObject({ niva: 'radgivning' });
    expect(mt.radFor('blodtryck', '190/100', null).text).toContain('1177');
    expect(mt.radFor('blodtryck', '190/100', null).text).toContain('112');
    expect(mt.radFor('saturation', '85', 85).niva).toBe('akut');
    expect(mt.radFor('blodtryck', '130/80', null)).toBeNull();
  });
});

describe('Läskopian i loggen (E3-28, E3-30, E3-36)', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('E3-28, E3-30, E3-36: läskopians automatiska rader skiljs från människors åtkomster, dras inte i stickprov och visas för patienten i klartext', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    // Läskopian lämnas ut när webbläsaren hämtar den efter inloggningen.
    expect((await k.get('/api/lasekopia')).status).toBe(200);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs IN ('lasekopia', 'lasekopia:slut')").get().n).toBeGreaterThan(0);
    await k.logga('logg');
    const l = (await k.get('/api/logg')).data;
    expect(l.automatiska).toBeGreaterThan(0);
    const alla = (await k.get('/api/logg?automatiska=visa')).data;
    const kopior = alla.rader.filter(r => r.kopiaForAvbrott);
    // Säkerhetsgranskningen: bara rutinrader fälls ihop. En kopia med flagga eller mycket högt skyddsbehov visas som förut,
    // och ingen rad förlorar sin flagga.
    expect(l.rader.filter(r => r.kopiaForAvbrott).every(r => r.flaggad || r.skyddsniva >= 3)).toBe(true);
    for (const r of kopior.filter(x => x.flaggad || x.skyddsniva >= 3)) expect(l.rader.some(x => x.id === r.id)).toBe(true);
    expect(kopior.length - l.rader.filter(r => r.kopiaForAvbrott).length).toBe(l.automatiska);
    const skyddad = kopior.find(r => r.skyddsniva >= 3);
    expect(skyddad).toBeDefined();
    // Stickprovet: rutinkopiorna dras i en egen kategori med högst två rader, och kopior med mycket högt skyddsbehov kan
    // alltid dras.
    const sp = logguppfoljning.dra(db, db.query("SELECT * FROM personal WHERE id = 'logg'").get(), { antal: 100 });
    const rutinIStickprov = sp.rader.filter(r => r.kategori === 'Kopia för avbrott' && (r.skyddsniva ?? 0) < 3 && !['nodatkomst', 'samtycke_sparr'].includes(r.grund));
    expect(rutinIStickprov.length).toBeLessThanOrEqual(logguppfoljning.KOPIOR_I_STICKPROV);
    expect(rutinIStickprov.length).toBeGreaterThan(0);
    expect(sp.rader.some(r => r.loggId === skyddad.id)).toBe(true);
    // Patienten ser klartext, aldrig en intern kod, och läskopian som det den är, sammanfattad per dag och vårdenhet.
    const m = klient(app);
    await m.post('/api/login/invanare', { invanareId: 'inv-p01' });
    sandlada(app, m).db = db;
    const rader = (await m.get('/api/min/journal/p01/logglista')).data.rader;
    for (const r of rader) expect(r.handlingText).not.toMatch(/^[a-z_]+$/);
    const kp = rader.filter(r => r.via === 'laskopia');
    expect(kp.length).toBeGreaterThan(0);
    for (const r of kp) {
      expect(r.handlingText).toMatch(/^Uppgifter ur journalen kopierades till en dator på .+ för läsning vid avbrott$/);
      expect(r.handlingText).not.toContain('Ingen');
      expect(r.yrkesroll).toBeTruthy();
    }
  }, 30_000);

  test('E1-36: läkaren sätter en diagnos med ICD-10-SE på den pågående kontakten, och systemet avgör huvud- eller bidiagnos', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const db = sandlada(app, k).db;
    const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla) VALUES ('p11', 'vc-tybble', 'oppenvard', 'telefon', ?, 'Telefonkontakt', 'Uppföljning', 'vardkallan')").run(new Date().toISOString()).lastInsertRowid);
    const akt = (await k.get('/api/patient/p11/vardkontakt/aktuell')).data;
    expect(akt.vardkontakt?.id).toBe(vk);
    const val = (await k.get('/api/rapportering/rattning/val')).data;
    expect(val.diagnoser.some(d => d.kod === 'E11.9')).toBe(true);
    const r = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'E11.9' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ kod: 'E11.9', typ: 'huvud' });
    expect((await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'XYZ' })).status).toBe(400);
  });

  test('E2-5: en dos ges utan skanning bara med en uppgift om hur identiteten kontrollerades, och uppgiften sparas med dosen', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const alvedon = (await k.get('/api/administreringar')).data.patienter.find(x => x.patient.id === 'p01').vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    const utan = await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: null });
    expect(utan.status).toBe(400);
    expect(utan.data.kod).toBe('identitet');
    expect((await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: { satt: 'annan' } })).status).toBe(400);
    expect((await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: { satt: 'gissat' } })).status).toBe(400);
    const r = await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: { satt: 'annan', text: 'Läste namnbandet på sängen och frågade patienten' } });
    expect(r.status).toBe(201);
    expect(r.data.administrering.identitet).toMatchObject({ satt: 'annan', sattText: 'Annat sätt', text: 'Läste namnbandet på sängen och frågade patienten' });
  });
});

// Runda 13, r3: fynd från säkerhetsgranskningen och lagrumsgranskningen efter de första rättelserna.
describe('Säkerhets- och lagrumsgranskningen', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());
  // En verksamhetschef för en vårdenhet som saknar en i demon.
  const nyChef = (db, ve) => {
    db.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES (?, 'Test Verksamhetschef', 'verksamhetschef', 'Verksamhetschef', ?, ?, 0)").run(`vch-t-${ve}`, ve, `vch-t-${ve}`);
    db.query('INSERT INTO verksamhetschefer (enhet_id, personal_id) VALUES (?, ?)').run(ve, `vch-t-${ve}`);
    return `vch-t-${ve}`;
  };
  // En inloggning som verksamhetschef i arkivariens sandlåda.
  const chef = async (k, id) => {
    const v = klient(app);
    await v.logga('vch-kard');
    const s = sandlada(app, v);
    s.db = sandlada(app, k).db;
    if (id !== 'vch-kard') somPerson(s, id);
    return v;
  };

  test('E2-5: servern minns bekräftelsen för den som gav den och patienten i sessionen, och en bekräftelse av Johan Ek gäller inte när Amira Haddad loggar in på samma dator', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const vb = async () => (await k.get('/api/administreringar')).data.patienter.find(x => x.patient.id === 'p01').vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    const alvedon = await vb();
    const kv = [{ regel: 'dubbel_dos', motivering: 'Prövat i testet.' }, { regel: 'for_tidig', motivering: 'Prövat i testet.' }, { regel: 'max_per_dygn', motivering: 'Prövat i testet.' }];
    // Johan Ek bekräftar identiteten för Gunnar Åkesson, och nästa dos inom en kvart behöver ingen ny bekräftelse.
    expect((await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: { satt: 'kand' } })).status).toBe(201);
    const igen = await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: undefined, kvitteradeVarningar: kv });
    expect(igen.status).toBe(201);
    expect(igen.data.administrering.identitet.satt).toBe('kand');
    // Amira Haddad loggar in på samma dator. Johans bekräftelse gäller inte för henne.
    await k.logga('usk-kard');
    const amira = await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: undefined, kvitteradeVarningar: kv });
    expect(amira.status).toBe(400);
    expect(amira.data.kod).toBe('identitet');
    // Och när Johan loggar in igen gäller inte heller hans gamla bekräftelse.
    await k.logga('ssk-kard');
    expect((await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId, identitet: undefined, kvitteradeVarningar: kv })).data.kod).toBe('identitet');
  });

  test('E3-35: en radering godkänns av verksamhetschefen för varje vårdenhet där uppgifterna finns, och en verksamhetschef på fel vårdenhet nekas och ser inte beslutet', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    // Gunnar Åkessons journal (p05) har uppgifter på kardiologen och vårdcentralen i Kumla.
    const b = (await k.post('/api/arkiv/beslut', { typ: 'radering', patientId: 'p05', omfattning: 'hela', diarienummer: 'IVO 3.5.1-12345/2026', beslutsdatum: new Date().toISOString().slice(0, 10) })).data;
    expect(b.godkannande.klart).toBe(false);
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(409);
    expect((await k.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).status).toBe(403);
    // Verksamhetschefen för onkologen har inga av uppgifterna: beslutet syns inte och kan inte godkännas.
    const onk = await chef(k, 'vch-onk');
    expect((await onk.get('/api/arkiv/godkanna')).data.beslut).toEqual([]);
    expect((await onk.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).status).toBe(404);
    // Kardiologens verksamhetschef ser beslutet utan patient och godkänner för sin vårdenhet.
    const kard = await chef(k, 'vch-kard');
    const lista = (await kard.get('/api/arkiv/godkanna')).data.beslut;
    expect(lista.map(x => x.id)).toEqual([b.id]);
    expect(JSON.stringify(lista)).not.toMatch(/p05|Kumla/);
    expect((await kard.get('/api/arkiv/beslut')).status).toBe(403);
    expect((await kard.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).data).toMatchObject({ godkant: true, klart: false });
    expect((await kard.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).status).toBe(409);
    expect(db.query('SELECT enhet_id FROM arkivbeslut_godkannanden WHERE beslut_id = ?').all(b.id)).toEqual([{ enhet_id: 'uso-kard' }]);
    expect(() => db.query('DELETE FROM arkivbeslut_godkannanden').run()).toThrow();
    // Vårdcentralen har inte godkänt: inget raderas.
    const fore = await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {});
    expect(fore.status).toBe(409);
    expect(fore.data.fel).toContain('Godkännande saknas');
    expect(db.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p05'").get().n).toBeGreaterThan(0);
    const vc = await chef(k, nyChef(db, 'vc-kumla'));
    expect((await vc.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).data).toMatchObject({ klart: true });
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(200);
    expect(db.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p05'").get().n).toBe(0);
  });

  test('E3-35: en gallring över två vårdenheter verkställs först när verksamhetscheferna för båda har godkänt, och var och en ser bara antalet på sin egen', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    // Journalen p20 på medicinkliniken är gammal nog att gallras. Ett gammalt mätvärde på kardiologen gör att
    // gallringen gäller två vårdenheter.
    const gammal = new Date(Date.now() - 15 * 365 * 86400000).toISOString();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES ('p20', 'uso-kard', 'vikt', '71', 71, 'kg', ?, 'vardkallan')").run(gammal);
    const b = (await k.post('/api/arkiv/beslut', { typ: 'gallring', diarienummer: 'DEMO-2026-0043', beslutsdatum: new Date().toISOString().slice(0, 10) })).data;
    const kard = await chef(k, 'vch-kard');
    const lista = (await kard.get('/api/arkiv/godkanna')).data.beslut;
    expect(lista.find(x => x.id === b.id).omfattning).toBe('1 journal med uppgifter på din vårdenhet');
    expect((await kard.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).data.klart).toBe(false);
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(409);
    const med = await chef(k, nyChef(db, 'uso-med'));
    expect((await med.get('/api/arkiv/godkanna')).data.beslut.map(x => x.id)).toContain(b.id);
    expect((await med.post(`/api/arkiv/beslut/${b.id}/godkann`, {})).data.klart).toBe(true);
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(200);
    expect(db.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p20'").get().n).toBe(0);
  });

  test('Lag, LPT 6 och 6 a §§: en patient som hålls kvar får ges nödvändig behandling vid överhängande fara och kroppsvisiteras efter chefsöverläkarens beslut', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    const s = sandlada(app, k);
    const id = s.db.query("SELECT id FROM tvangsvard_perioder WHERE patient_id = 'p21'").get().id;
    s.db.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES ('lak-psyk3', 'Test Läkare', 'lakare', 'Underläkare', 'uso-psyk', 'X', 0)").run();
    somPerson(s, 'lak-psyk3');
    const post = (b) => k.post('/api/patient/p21/tvangsvard', { typ: 'atgard', period: id, ...b });
    // Legitimerad läkare: behandling bara vid överhängande fara för liv eller hälsa (6 a § andra stycket).
    const utan = await post({ atgard: 'behandling' });
    expect(utan.status).toBe(400);
    expect(utan.data.fel).toContain('överhängande fara');
    const med = await post({ atgard: 'behandling', fara: true });
    expect(med.status).toBe(201);
    const b = med.data.atgarder.find(a => a.typ === 'behandling');
    expect(b).toMatchObject({ kvarhallen: true, paragraf: '6 a §' });
    expect(b.krav).toContain('överhängande fara');
    // Kroppsvisitation och ytlig kroppsbesiktning (6 § andra stycket) beslutas av chefsöverläkaren (23 §).
    expect((await post({ atgard: 'kroppsvisitation' })).status).toBe(403);
    // Det lagen inte medger före intagningen nekas.
    expect((await post({ atgard: 'elektronisk' })).status).toBe(400);
    somPerson(s, 'lak-psyk');
    const kv = await post({ atgard: 'kroppsvisitation' });
    expect(kv.status).toBe(201);
    expect(kv.data.atgarder.find(a => a.typ === 'kroppsvisitation')).toMatchObject({ kvarhallen: true, paragraf: '6 § andra stycket och 23 §' });
    // Steget finns för läkaren under kvarhållningen.
    const steg = kv.data.nasta;
    expect(JSON.stringify(steg)).toContain('kroppsvisitation');
  });

  test('Lag, HSLF-FS 2017:37 6 kap. 6 §: bara läkare utfärdar generella direktiv, och en verksamhetschef som inte är läkare får inte', async () => {
    const k = klient(app);
    await k.logga('vch-kard');
    expect((await k.get('/api/session')).data.behorigheter).not.toContain('faststalla_direktiv');
    const bas = { lakemedelId: 'VK-NPL-0025', indikation: 'Halsbränna', dosering: '1 kapsel vid behov', dos: 20, dosEnhet: 'mg', maxPerDygn: 1, minstaIntervallTimmar: 20, maxTillfallen: 1, maxdosText: 'Högst 20 mg per dygn', kontraindikationer: [{ typ: 'bekrafta', text: 'Svart avföring eller blodkräkning' }] };
    const r = await k.post('/api/direktiv', bas);
    expect(r.status).toBe(403);
    expect(r.data.fel).toContain('Endast läkare');
    // Verksamhetschefen utser en läkare till medicinskt ansvarig, och läkaren utfärdar direktivet.
    expect((await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'medicinskt_ansvarig', personalId: 'lak-kard' })).status).toBe(201);
    const l = klient(app);
    await l.logga('lak-kard');
    sandlada(app, l).db = sandlada(app, k).db;
    expect((await l.post('/api/direktiv', bas)).status).toBe(201);
  });

  test('Lag, HSLF-FS 2016:40 4 kap. 7 §: systemet för sammanhållen journalföring visar att det finns spärrade uppgifter hos en annan vårdgivare, och inget mer', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const TEXT = 'Det finns spärrade uppgifter om patienten hos en annan vårdgivare.';
    // Före hämtningen och efter den: bara att spärrade uppgifter finns, utan vårdgivare, slag eller antal.
    const fore = (await k.get('/api/patient/p01/sammanhallen')).data;
    expect(fore.sparradeHosAnnan).toBe(true);
    expect(fore.sparrText).toBe(TEXT);
    const efter = (await k.post('/api/patient/p01/sammanhallen', { syfte: 'Bedömning inför vården i dag', samtycke: true })).data;
    expect(efter.sparrText).toBe(TEXT);
    const txt = JSON.stringify(efter);
    expect(txt.match(/spärr/gi)).toHaveLength(1);
    for (const p of sj.POSTER.p01.filter(x => x.sparrad)) { expect(txt).not.toContain(p.rubrik); expect(txt).not.toContain(p.id); }
    // En patient utan spärrade uppgifter hos den andra vårdgivaren.
    const utan = (await k.get('/api/patient/p03/sammanhallen')).data;
    expect(utan.sparradeHosAnnan).toBe(false);
    expect(utan.sparrText).toBeNull();
  });
});

