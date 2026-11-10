// Runda 10, r4: dokumentation vid donation och transplantation (Sussa 3.1.12.1). Ett dödsfall på intensivvården ger de
// donationsansvariga ett förslag i inkorgen, checklistan bockas av där systemet kan, donationsanteckningen skrivs av
// systemet, och en transplantation ger bidiagnos och uppmärksamhetsinformation. Testnamnen står i
// src/sussa/mappning/3.1.12.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, somPerson, personal } from './hjalp.js';
import * as tidbok from '../src/tidbok.js';
import * as ansvar from '../src/lakemedelsansvar.js';
import * as donation from '../src/donation.js';
import { ICD10SE, KVA } from '../src/kodverk.js';
import { MALLAR } from '../src/journal.js';
import { SOKORD } from '../src/fackssprak.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const P = donation.DEMO_PATIENT;
// Läkaren på kardiologen med patient 10 på hjärtintensiven.
const pagIva = async (roll = 'lak-kard') => {
  const k = await inloggad(roll);
  expect((await k.post('/api/demo/donation')).status).toBe(200);
  return k;
};
const dod = (k) => k.post(`/api/patient/${P}/dodsfall`, { kriterier: 'direkta', tid: new Date(Date.now() - 3600_000).toISOString() });

describe('Donation och transplantation', () => {
  test('ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen att pröva donation', async () => {
    const k = await pagIva();
    // På intensivvården föreslår systemet en utredning redan innan dödsfallet.
    const fore = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(fore).toMatchObject({ dodsfall: null, kanRegistreraDodsfall: true });
    expect(fore.forslag.text).toContain('intensivvårdsavdelningen');
    const r = await dod(k);
    expect(r.status).toBe(201);
    expect(r.data.text).toContain('donationsansvariga');
    expect((await dod(k)).status).toBe(409);
    const ik = (await k.get('/api/inkorg')).data.donationsforslag;
    expect(ik).toEqual([expect.objectContaining({ patientId: P, rubrik: 'Möjlig donator', href: `#/patient/${P}/donation` })]);
    expect(ik[0].patient.namn).toBe('Karl-Erik Brandt');
    // Sjuksköterskan som är donationsansvarig får samma förslag, men inte en annan sjuksköterska eller läkare.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag.length).toBe(1);
    somPerson(sandlada(app, k), 'ul-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([]);
    somPerson(sandlada(app, k), 'lak-akut');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([]);
    // Ett dödsfall registreras bara av läkaren och bara på intensivvården.
    const s = await inloggad('ssk-kard');
    await s.post('/api/demo/donation');
    expect((await s.post(`/api/patient/${P}/dodsfall`, { kriterier: 'direkta' })).status).toBe(403);
    const l = await inloggad('lak-kard');
    const ej = await l.post('/api/patient/p01/dodsfall', { kriterier: 'direkta' });
    expect(ej.status).toBe(409);
    expect(ej.data.fel).toContain('intensivvårdsavdelning');
  });

  test('checklistan bockas av där systemet kan, och den medicinska bedömningen får sitt underlag ur journalen', async () => {
    const k = await pagIva();
    await dod(k);
    const d = await k.post(`/api/patient/${P}/donation`);
    expect(d.status).toBe(201);
    const p = Object.fromEntries(d.data.checklista.map(x => [x.id, x]));
    expect(p.identifierad.status).toBe('klar');
    expect(p.dodsdiagnos).toMatchObject({ status: 'klar', av: 'system' });
    expect(p.dodsdiagnos.detalj).toContain('total hjärninfarkt');
    expect(p.registret.status).toBe('klar');
    expect(p.registret.detalj).toContain('Donationsregistret (simulerat)');
    expect(['klar', 'kvar']).toContain(p.installning.status);
    expect(p.narstaende.status).toBe('kvar');
    expect(p.kvalitetsregister.status).toBe('kvar');
    // Referensmaterialet står vid varje punkt.
    expect(p.dodsdiagnos.referens).toBe('Lag (1987:269) om kriterier för bestämmande av människans död');
    expect(p.narstaende.referens).toBe('Lag (1995:831) om transplantation m.m.');
    // Underlaget för bedömningen: åldern, och här ingen smitta eller tumörsjukdom.
    expect(d.data.underlag.map(x => x.typ)).toEqual(['alder']);
    // Slagningen i Donationsregistret loggas på patienten.
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = ? AND resurs = ?").get(P, `donationsregistret:${P}`).n).toBe(1);
    // Samma svar från det simulerade registret varje gång.
    expect(donation.donationsregistret({ id: P })).toEqual(donation.donationsregistret({ id: P }));
    expect((await k.post(`/api/patient/${P}/donation`)).status).toBe(409);
    // Punkter som systemet bockar av själv kan inte bockas för hand, och inte aktuell kräver en orsak.
    expect((await k.post(`/api/donation/${d.data.id}/punkt`, { punkt: 'registret', status: 'klar' })).status).toBe(400);
    expect((await k.post(`/api/donation/${d.data.id}/punkt`, { punkt: 'koordinator', status: 'ej_aktuell' })).status).toBe(400);
  });

  test('närståendes uppgift om inställningen, checklistan klar, KVÅ för bedömningen och underlag till kvalitetsregistret', async () => {
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    expect((await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja_utom' })).status).toBe(400);
    const v = await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja_utom', undantag: 'hornhinnor', kalla: 'narstaende' });
    expect(v.status).toBe(201);
    expect((await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja', kalla: 'donationsregistret' })).status).toBe(400);
    for (const punkt of ['narstaende', 'lamplighet', 'koordinator']) {
      const r = await k.post(`/api/donation/${d.id}/punkt`, { punkt, status: 'klar', kommentar: punkt === 'lamplighet' ? 'Inga hinder.' : undefined });
      expect(r.status).toBe(200);
    }
    const u = (await k.get(`/api/patient/${P}/donation`)).data.donationer[0];
    const p = Object.fromEntries(u.checklista.map(x => [x.id, x]));
    expect(p.installning.detalj).toContain('utom hornhinnor');
    expect(p.lamplighet).toMatchObject({ status: 'klar', detalj: 'Inga hinder.', av: 'Sara Lindqvist', text: 'Medicinsk bedömning av lämpligheten' });
    expect(u.klar).toBe(true);
    expect(p.kvalitetsregister.status).toBe('klar');
    expect(u.kvalitetsregister).toMatchObject({ klar: true, falt: { donation: d.id, kon: 'man', utfall: 'Utredning pågår' } });
    expect(JSON.stringify(u.kvalitetsregister)).not.toMatch(/Karl-Erik|Brandt|194601136098|601136098/);
    expect(db(k).query("SELECT kod FROM atgarder WHERE patient_id = ? AND kod = 'AV124'").all(P).length).toBe(1);
    expect(KVA.AV124).toBe('Undersökning av potentiell donator');
    // Genomförd donation med organen, och utredningen ändras sedan inte.
    expect((await k.post(`/api/donation/${d.id}/avsluta`, { status: 'genomford' })).status).toBe(400);
    const a = await k.post(`/api/donation/${d.id}/avsluta`, { status: 'genomford', organ: ['njure', 'lever'] });
    expect(a.status).toBe(200);
    expect(a.data.kvalitetsregister.falt).toMatchObject({ utfall: 'Donation genomförd', organ: ['Njure', 'Lever'] });
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(409);
    expect(() => db(k).query('DELETE FROM donation_punkter').run()).toThrow();
    expect(() => db(k).query("UPDATE donationer SET status = 'pagar'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM dodsfall').run()).toThrow();
  });

  test('donationsanteckningen skrivs av systemet ur checklistan, och läkaren signerar den', async () => {
    expect(MALLAR.find(m => m.typ === 'Donationsanteckning').sokord).toEqual(donation.MALL.sokord);
    for (const s of donation.MALL.sokord) expect(Object.hasOwn(SOKORD, s)).toBe(true);
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    const a = await k.post(`/api/donation/${d.id}/anteckning`);
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ typ: 'Donationsanteckning', status: 'utkast', kategori: 'lakare' });
    const s = Object.fromEntries(a.data.sokord.map(x => [x.sokord, x.text]));
    expect(s.Aktuellt).toContain('total hjärninfarkt');
    expect(s.Bedömning).toContain('Den medicinska bedömningen är inte gjord.');
    expect(s.Åtgärd).toBe('Kvar i checklistan: närstående informerade om dödsfallet och om donationen, medicinsk bedömning av lämpligheten, transplantationskoordinatorn kontaktad.');
    expect((await k.post(`/api/anteckning/${a.data.id}/signera`)).status).toBe(200);
    // Sjuksköterskan dokumenterar checklistan men skriver inte läkarens anteckning.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(200);
    expect((await k.post(`/api/donation/${d.id}/anteckning`)).status).toBe(403);
  });

  test('en transplantation ger bidiagnos ur ICD-10-SE och uppmärksamhetsinformationen föreslår transplantat', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'njure', datum: '2099-01-01' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'constructor', datum: '2019-04-02' })).status).toBe(400);
    const t = await k.post('/api/patient/p01/transplantationer', { organ: 'njure', datum: '2019-04-02', centrum: 'Transplantationscentrum (demo)' });
    expect(t.status).toBe(201);
    expect(t.data.diagnos).toEqual({ kod: 'Z94.0', text: 'Njurtransplanterad' });
    expect(ICD10SE['Z94.0']).toBe('Njurtransplanterad');
    for (const o of Object.values(donation.ORGAN)) expect(ICD10SE[o.icd]).toBeTruthy();
    const h = (await k.get('/api/patient/p01')).data;
    expect(h.uppmarksamhet.forslag.some(f => f.undergrupp === 'transplantat')).toBe(true);
    const ov = (await k.get('/api/patient/p01/donation')).data;
    expect(ov.transplantationer[0]).toMatchObject({ organ: 'Njure', datum: '2019-04-02', diagnos: { kod: 'Z94.0' }, registreradAv: 'Sara Lindqvist' });
    // Sjuksköterskan registrerar ingen transplantation.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'lever', datum: '2019-04-02' })).status).toBe(403);
  });

  test('nyheterna om in- och utfarter, restjournaler, donation, mätvärden och uppmärksamhetsinformation gäller rätt roller', async () => {
    const nyheter = await import('../src/nyheter.js');
    const { nyDb, personal } = await import('./hjalp.js');
    const d = nyDb();
    const ids = (id) => { const p = personal(d, id); return nyheter.nyheter(d, { personal: p, invanare: null }).alla.flatMap(v => v.nyheter.map(n => n.id)); };
    expect(ids('lak-kard')).toEqual(expect.arrayContaining(['r10r4-infarter', 'r10r4-restjournaler', 'r10r4-donation', 'r10r4-matvarden', 'r10r4-uppmarksamhet']));
    expect(ids('ssk-kard')).toEqual(expect.arrayContaining(['r10r4-infarter', 'r10r4-restjournaler', 'r10r4-donation']));
    expect(ids('ssk-kard')).not.toContain('r10r4-uppmarksamhet');
    expect(ids('usk-kard')).not.toContain('r10r4-donation');
    expect(ids('adm-kard')).toEqual(expect.arrayContaining(['r10r4-restjournaler']));
    expect(ids('adm-kard')).not.toContain('r10r4-infarter');
    const versioner = nyheter.NYHETER.filter(v => v.nyheter.some(n => n.id.startsWith('r10r4-')));
    // Runda 11, r7: nyheterna står i en och samma version, oberoende av vilken version som är aktuell nu.
    expect(versioner).toHaveLength(1);
  });

  test('behörighet: fel roll, fel vårdenhet och spärr, och tidslinjen visar bara det som får ses', async () => {
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    const ov = (await k.get(`/api/patient/${P}/oversikt`)).data;
    const tl = ov.tidslinje.filter(t => ['dodsfall', 'donation'].includes(t.typ)).map(t => t.rubrik);
    expect(tl.length).toBe(2);
    expect(tl).toEqual(expect.arrayContaining(['Dödsfall', 'Donationsutredning startad']));
    // Vårdadministratören läser inte donationen.
    somPerson(sandlada(app, k), 'adm-kard');
    expect((await k.get(`/api/patient/${P}/donation`)).status).toBe(403);
    // Utan vårdrelation är svaret detsamma som för en utredning som inte finns.
    somPerson(sandlada(app, k), 'lak-psyk');
    const nej = await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' });
    expect(nej.status).toBe(404);
    expect(nej.data).toEqual((await k.post('/api/donation/99999/punkt', { punkt: 'narstaende', status: 'klar' })).data);
    // Läkaren på vårdcentralen har vårdrelation men ser inte hjärtintensivens donation utan aktivt val, och ändrar den aldrig.
    somPerson(sandlada(app, k), 'lak-vc');
    const vc = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(vc.donationer).toEqual([]);
    expect(vc.dodsfall).toBeNull();
    expect(vc.dolda.kraverVal).toBeGreaterThan(0);
    expect(vc.forslag).toBeNull();
    expect(JSON.stringify((await k.get(`/api/patient/${P}/oversikt`)).data.tidslinje)).not.toContain('Dödsfall');
    await k.post(`/api/patient/${P}/val`, { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    expect((await k.get(`/api/patient/${P}/donation`)).data.donationer.length).toBe(1);
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(403);
    // Med en spärr för kardiologen syns varken dödsfallet eller utredningen, inte heller efter aktivt val.
    db(k).query(`INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('${P}', 'uso-kard', ?, 1)`).run(new Date().toISOString());
    const sp = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(sp.donationer).toEqual([]);
    expect(sp.dodsfall).toBeNull();
    expect(sp).toMatchObject({ forslag: null, kanRegistreraDodsfall: false, vilja: [] });
    // Svaret är detsamma som för en patient som aldrig har vårdats på intensivvården.
    const { dolda: _d1, ...utan } = sp;
    const { dolda: _d2, ...annan } = (await k.get('/api/patient/p01/donation')).data;
    expect(JSON.stringify(utan)).toBe(JSON.stringify(annan));
    expect(JSON.stringify((await k.get(`/api/patient/${P}/oversikt`)).data.tidslinje)).not.toMatch(/Dödsfall|Donationsutredning/);
  });
});

// Runda 10, r4: de donationsansvariga är uppdrag, och en avliden patient märks och stoppas i tidboken (beslut 2026-11-08).
describe('Donationsansvariga och avliden patient', () => {
  test('förslaget går till de donationsansvariga som verksamhetschefen har utsett, och ett byte av uppdraget ändrar mottagaren', async () => {
    const k = await pagIva();
    const s = sandlada(app, k);
    // Seeden: Sara Lindqvist och Johan Ek är utsedda på Kardiologiska kliniken.
    expect(donation.arDonationsansvarig(s.db, personal(s.db, 'lak-kard'))).toBe(true);
    expect(donation.arDonationsansvarig(s.db, personal(s.db, 'ssk-kard'))).toBe(true);
    await dod(k);
    expect((await k.get('/api/inkorg')).data.donationsforslag.length).toBe(1);
    // Verksamhetschefen ser uppdragen och utser Göran Malm till donationsansvarig läkare i stället.
    somPerson(s, 'vch-kard');
    const o = (await k.get('/api/lakemedelsansvar')).data;
    const per = Object.fromEntries(o.uppdrag.map(u => [u.typ, u]));
    expect(per.donationsansvarig_lakare.gallande.map(u => u.personal.namn)).toEqual(['Sara Lindqvist']);
    expect(per.donationsansvarig_ssk.gallande.map(u => u.personal.namn)).toEqual(['Johan Ek']);
    const nytt = await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'donationsansvarig_lakare', personalId: 'ol-kard' });
    expect(nytt.status).toBe(201);
    expect(nytt.data.ersatta.length).toBe(1);
    somPerson(s, 'ol-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([expect.objectContaining({ patientId: P, rubrik: 'Möjlig donator' })]);
    somPerson(s, 'lak-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([]);
    // En sjuksköterska kan inte bli donationsansvarig läkare, och en vårdenhet utan intensivvård har inte uppdragen.
    somPerson(s, 'vch-kard');
    expect((await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'donationsansvarig_lakare', personalId: 'ssk-kard' })).status).toBe(400);
    expect(ansvar.UPPDRAG.donationsansvarig_lakare.bara(s.db, 'vc-tybble')).toBe(false);
  });

  test('dödsfallet märker patienten som avliden med datum i huvudet och i sökningen, och den simulerade folkbokföringen meddelas', async () => {
    const k = await pagIva();
    const r = await dod(k);
    const datum = new Date(Date.now() - 3600_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    expect(r.data.avliden).toMatchObject({ datum, text: `Avliden ${datum}` });
    expect(r.data.avliden.folkbokforing).toMatchObject({ mottagare: 'Skatteverkets folkbokföring (simulerad)', simulerat: true });
    expect(r.data.text).toContain('folkbokföring (simulerad)');
    expect((await k.get(`/api/patient/${P}`)).data.avliden).toMatchObject({ datum });
    const sok = (await k.get('/api/sok?q=Brandt')).data.find(x => x.id === P);
    expect(sok.avliden).toMatchObject({ datum });
    // Märkningen är en uppgift om patienten, som i folkbokföringen, och syns också på en annan vårdenhet.
    somPerson(sandlada(app, k), 'lak-vc');
    expect((await k.get(`/api/patient/${P}`)).data.avliden).toMatchObject({ datum });
    // En annan patient är inte märkt, och märkningen ändras och raderas inte.
    expect((await k.get('/api/patient/p01')).data.avliden).toBeNull();
    expect(() => db(k).query("UPDATE avlidna SET datum = '2000-01-01'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM avlidna').run()).toThrow();
  });

  test('kommande tider avbokas med orsak och utan besked till patienten, och posterna på väntelistan avslutas', async () => {
    const k = await pagIva();
    const d = db(k);
    d.query("INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, fran, skapad) VALUES (?, 'uso-kard', 'aterbesok', 'lakare', 'normal', 'Återbesök efter hjärtsvikt', ?, ?)")
      .run(P, new Date().toISOString().slice(0, 10), new Date().toISOString());
    const fore = d.query("SELECT b.id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = ? AND b.status = 'bokad' AND t.start > ?").all(P, new Date().toISOString()).map(b => b.id);
    expect(fore.length).toBeGreaterThan(0);
    const kallelserFore = d.query('SELECT count(*) AS n FROM kallelser WHERE patient_id = ?').get(P).n;
    const r = await dod(k);
    expect(r.data.avliden.avbokade).toBe(fore.length);
    for (const id of fore) expect(d.query('SELECT status, orsak FROM bokningar WHERE id = ?').get(id)).toEqual({ status: 'avbokad', orsak: 'Patienten har avlidit' });
    // Inget avbokningsbesked, ingen påminnelse och inget sms skickades.
    expect(d.query('SELECT count(*) AS n FROM kallelser WHERE patient_id = ?').get(P).n).toBe(kallelserFore);
    expect(d.query("SELECT count(*) AS n FROM vantelista WHERE patient_id = ? AND status = 'vantar'").get(P).n).toBe(0);
    const h = d.query("SELECT h.detalj FROM vantelista_handelser h JOIN vantelista v ON v.id = h.vantelista_id WHERE v.patient_id = ? AND h.typ = 'avslutad'").all(P);
    expect(h.some(x => x.detalj.startsWith('Patienten har avlidit'))).toBe(true);
  });

  test('nya bokningar, kallelser, påminnelser och sms till en avliden patient stoppas', async () => {
    const k = await pagIva();
    await dod(k);
    const d = db(k);
    const tid = d.query("SELECT * FROM tider t WHERE t.start > ? AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id AND b.status IN ('bokad', 'incheckad')) ORDER BY t.start LIMIT 1").get(new Date().toISOString());
    expect(() => tidbok.skapaBokning(d, { patientId: P, tid, orsak: 'Återbesök' })).toThrow(/avlidit/);
    // Också en bokning ur Min journal eller en gruppkallelse går genom samma kontroll, och en kallelse skickas aldrig.
    const gammal = d.query('SELECT * FROM bokningar WHERE patient_id = ? ORDER BY id DESC LIMIT 1').get(P);
    for (const typ of ['kallelse', 'paminnelse', 'ombokning']) {
      const kall = tidbok.skickaKallelse(d, gammal, typ);
      expect(kall).toMatchObject({ status: 'kan_inte', kanal: null, mottagare: null });
      expect(kall.forklaring).toContain('Ingen kallelse, påminnelse eller sms skickas');
    }
    expect(d.query("SELECT count(*) AS n FROM kallelser WHERE patient_id = ? AND kanal = 'sms' AND skapad > ?").get(P, new Date(Date.now() - 60_000).toISOString()).n).toBe(0);
    // En annan patient bokas som vanligt.
    expect(tidbok.skapaBokning(d, { patientId: 'p02', tid, orsak: 'Återbesök' }).status).toBe('bokad');
  });

  test('journalen för en avliden patient går fortfarande att läsa och dokumentera i', async () => {
    const k = await pagIva();
    await dod(k);
    expect((await k.get(`/api/patient/${P}/anteckningar`)).status).toBe(200);
    expect((await k.get(`/api/patient/${P}/oversikt`)).status).toBe(200);
    const a = await k.post(`/api/patient/${P}/anteckningar`, { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Avled på hjärtintensiven.' }] });
    expect(a.status).toBe(201);
    expect((await k.post(`/api/anteckning/${a.data.id}/signera`)).status).toBe(200);
    expect((await k.post(`/api/patient/${P}/matvarden`, { typ: 'temp', varde: '35,0' })).status).toBe(201);
  });
});
