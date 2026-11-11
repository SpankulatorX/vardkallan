// Runda 13, r3: rättelser från det utforskande testet som inte har en egen testfil. Fyndets nummer står i testnamnet
// (E1, E2 och E3 är testarnas rapporter). Testnamnen används i kravregistret.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { byggSeed } from '../src/db.js';
import * as journal from '../src/journal.js';
import * as tidbok from '../src/tidbok.js';
import * as vardkontakt from '../src/vardkontakt.js';
import * as mt from '../src/medicinteknik.js';
import { atk, testserver, klient, sandlada } from './hjalp.js';
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
});

