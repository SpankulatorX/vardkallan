// Runda 10, r2: standardiserade och anpassningsbara vyer, uppföljningsvyn och vyer utan personuppgifter (Sussa 3.1.2.1
// till 3.1.2.4).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const oversikt = async (k, pid, situation = null) => (await k.get(`/api/patient/${pid}/oversikt${situation ? `?situation=${situation}` : ''}`)).data;

describe('Anpassningsbara vyer', () => {
  test('systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök', async () => {
    const k = await inloggad('lak-kard');
    const d = await oversikt(k, 'p01');
    expect(d.vy).toMatchObject({ situation: 'rond', systemetsSituation: 'rond', kalla: 'system' });
    expect(d.vy.varfor).toContain('inskriven på din vårdenhet');
    expect(d.vy.alternativ.situationer.map(s => s.id)).toEqual(['mottagning', 'akut', 'rond']);
    const vc = await inloggad('lak-vc');
    expect((await oversikt(vc, 'p09')).vy.situation).toBe('mottagning');
    // En pågående akut vårdkontakt på akutmottagningen.
    const akut = await inloggad('lak-akut');
    db(akut).query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla) VALUES ('p02', 'uso-akut', 'akut', ?, 'Akutrum 1', 'Bröstsmärta', 'vardkallan')").run(new Date(Date.now() - 3600_000).toISOString());
    const a = await oversikt(akut, 'p02');
    expect(a.vy).toMatchObject({ situation: 'akut' });
    expect(a.vy.installning.delar.slice(0, 2)).toEqual(['r3', 'lakemedel']);
    // Användaren kan byta situation, och systemet säger vad det själv hade valt.
    const m = await oversikt(k, 'p01', 'mottagning');
    expect(m.vy).toMatchObject({ situation: 'mottagning', systemetsSituation: 'rond' });
    expect(m.vy.installning.delar.slice(0, 2)).toEqual(['r3', 'uppfoljning']);
  });

  test('användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.put('/api/oversiktsvy/rond', { installning: { delar: ['matvarden', 'lakemedel', 'tidslinje'], tidslinjeDagar: 30 } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ kalla: 'egen', installning: { delar: ['matvarden', 'lakemedel', 'tidslinje'], tidslinjeDagar: 30 } });
    const d = await oversikt(k, 'p01');
    expect(d.vy).toMatchObject({ situation: 'rond', kalla: 'egen' });
    // Delar som inte är valda lämnas inte ut, och tidsurvalet gäller tidslinjen på servern.
    expect(d.diagnoser).toBeNull();
    expect(d.anteckningar).toBeNull();
    expect(d.lakemedel.length).toBeGreaterThan(0);
    const grans = new Date(Date.now() - 30 * 86400_000).toISOString();
    expect(d.tidslinje.every(t => String(t.tid) >= grans)).toBe(true);
    expect(d.vy.tidslinjeUtanfor).toBeGreaterThan(0);
    // Valet gäller bara situationen och bara användaren.
    expect((await oversikt(k, 'p01', 'mottagning')).vy.kalla).toBe('system');
    expect(db(k).query("SELECT personal_id, vy FROM vyinstallningar WHERE vy LIKE 'oversikt.%'").all()).toEqual([{ personal_id: 'lak-kard', vy: 'oversikt.rond' }]);
    // Ogiltiga val förklaras, och förvalet går att återställa.
    expect((await k.put('/api/oversiktsvy/rond', { installning: { delar: ['matvarden', 'matvarden'] } })).status).toBe(400);
    expect((await k.put('/api/oversiktsvy/rond', { installning: { delar: ['matvarden'], tidslinjeDagar: 12 } })).status).toBe(400);
    expect((await k.put('/api/oversiktsvy/fest', { installning: { delar: ['matvarden'] } })).status).toBe(400);
    expect((await k.post('/api/oversiktsvy/rond/aterstall', {})).data.kalla).toBe('system');
  });

  test('vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen', async () => {
    const sf = await inloggad('sysf');
    const r = await sf.put('/api/vyforval', { vardenhetId: 'uso-kard', vy: 'oversikt.rond', installning: { delar: ['lakemedel', 'matvarden', 'anteckningar', 'tidslinje'], tidslinjeDagar: 7 } });
    expect(r.status).toBe(200);
    expect(r.data.forval.find(f => f.vy === 'oversikt.rond')).toMatchObject({ vardenhet: { id: 'uso-kard' }, andradAv: { id: 'sysf' } });
    expect(db(sf).query("SELECT * FROM atkomstlogg WHERE personal_id = 'sysf' AND handling = 'vyforval'").all().length).toBe(1);
    // Samma sandlåda: personen byter inloggning.
    const k = sf;
    await k.logga('lak-kard');
    const d = await oversikt(k, 'p01');
    expect(d.vy).toMatchObject({ kalla: 'vardenhet', installning: { delar: ['lakemedel', 'matvarden', 'anteckningar', 'tidslinje'], tidslinjeDagar: 7 } });
    expect(d.vy.kallaText).toContain('Kardiologiska kliniken');
    await k.put('/api/oversiktsvy/rond', { installning: { delar: ['lakemedel', 'tidslinje'], tidslinjeDagar: null } });
    expect((await oversikt(k, 'p01')).vy.kalla).toBe('egen');
    // En annan vårdenhet påverkas inte.
    await k.logga('lak-vc');
    expect((await oversikt(k, 'p09', 'rond')).vy.kalla).toBe('system');
    await k.logga('lak-kard');
    expect((await k.put('/api/vyforval', { vardenhetId: 'uso-kard', vy: 'idag', installning: { sektioner: ['dagens'] } })).status).toBe(403);
    // Verksamhetschefen sätter förval för sin egen vårdenhet, inte för någon annans. Läkaren nekas.
    const vch = k;
    await vch.logga('vch-kard');
    expect((await vch.put('/api/vyforval', { vardenhetId: 'uso-kard', vy: 'idag', installning: { sektioner: ['dagens', 'bevakningar'] } })).status).toBe(200);
    expect((await vch.put('/api/vyforval', { vardenhetId: 'vc-tybble', vy: 'idag', installning: { sektioner: ['dagens'] } })).status).toBe(403);
    // Dagens arbete får vårdenhetens förval för den som inte har valt själv.
    const adm = k;
    await adm.logga('adm-kard');
    expect((await adm.get('/api/vy/idag')).data).toMatchObject({ sparad: false, forvalFran: 'vardenhet', installning: { sektioner: ['dagens', 'bevakningar'] } });
  });

  test('anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut', async () => {
    const sf = await inloggad('sysf');
    await sf.put('/api/vyforval', { vardenhetId: 'uso-kard', vy: 'oversikt.rond', installning: { delar: ['diagnoser', 'lakemedel', 'anteckningar', 'tidslinje'] } });
    const usk = sf;
    await usk.logga('usk-kard');
    const d = await oversikt(usk, 'p01');
    expect(d.vy.installning.delar).not.toContain('diagnoser');
    expect(d.diagnoser).toBeNull();
    expect(d.vy.alternativ.delar.map(x => x.id)).not.toContain('diagnoser');
    const r = await usk.put('/api/oversiktsvy/rond', { installning: { delar: ['diagnoser', 'lakemedel'] } });
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('Diagnoser');
    // Vårdadministratören ser bara de administrativa delarna, också om förvalet har fler.
    const adm = await inloggad('adm-kard');
    const a = await oversikt(adm, 'p01');
    expect(a.lakemedel).toBeNull();
    expect(a.anteckningar).toBeNull();
    expect(a.vy.alternativ.delar.map(x => x.id)).toEqual(['remisser', 'tider', 'vardkontakt', 'ekonomi', 'kontakt', 'tidslinje']);
  });
});

describe('Uppföljningsvyn', () => {
  test('uppföljningsvyn samlar vårdplanernas mål och avvikelser, passerade uppföljningsdatum och remisser med när, var och vem', async () => {
    const k = await inloggad('ssk-kard');
    const u = (await k.get('/api/patient/p04/uppfoljning')).data;
    expect(u.rader.some(r => r.typ === 'mal' && r.enhet?.id === 'uso-kard-72')).toBe(true);
    const avv = u.rader.filter(r => r.typ === 'avvikelse');
    expect(avv.length).toBeGreaterThan(0);
    expect(avv[0]).toMatchObject({ avvikelse: true, av: { id: 'ssk-kard' } });
    expect(avv.some(r => r.text.includes('Uppföljningen skulle ha gjorts'))).toBe(true);
    // Avvikelserna står först.
    const forsta = u.rader.findIndex(r => !r.avvikelse);
    expect(u.rader.slice(forsta).every(r => !r.avvikelse)).toBe(true);
    // Ett passerat uppföljningsdatum för ett läkemedel.
    const lak = await inloggad('lak-kard');
    const o = db(lak).query("SELECT id FROM ordinationer WHERE patient_id = 'p01' AND status = 'aktiv' AND enhet_id LIKE 'uso-kard%' LIMIT 1").get();
    db(lak).query("UPDATE ordinationer SET uppfoljning = '2025-01-10' WHERE id = ?").run(o.id);
    const l = (await lak.get('/api/patient/p01/uppfoljning?typ=lakemedel')).data;
    expect(l.rader.every(r => r.typ === 'lakemedel')).toBe(true);
    expect(l.rader.some(r => r.avvikelse && r.text.includes('2025-01-10') && r.av?.namn)).toBe(true);
    expect((await lak.get('/api/patient/p01/uppfoljning?typ=okand')).status).toBe(400);
  });

  test('uppföljningsvyn visar var i vårdprocessen patienten är och den samordnade planeringen med kommunen, och översikten sammanfattar den', async () => {
    const k = await inloggad('lak-kard');
    const u = (await k.get('/api/patient/p01/uppfoljning')).data;
    expect(u.lage).toMatchObject({ steg: 'inskriven' });
    expect(u.lage.text).toContain('Inskriven på');
    const sam = u.rader.find(r => r.typ === 'samordning');
    expect(sam.rubrik).toBe('Samordnad planering vid utskrivning');
    expect(sam.text).toContain('simulerad');
    expect(u.filter.map(f => f.id)).toEqual(expect.arrayContaining(['lage', 'samordning']));
    const d = await oversikt(k, 'p01');
    expect(d.uppfoljning).toMatchObject({ antal: u.antal, lage: { steg: 'inskriven' } });
  });

  test('uppföljningsvyn följer behörigheten: spärrad vårdenhet, annan vårdenhet utan aktivt val och fel roll', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    d.query("INSERT INTO vardplaner (patient_id, enhet_id, mall, rubrik, grund, uppfoljning, skapad, skapad_av) VALUES ('p04', 'uso-psyk', NULL, 'Hemlig plan på psykiatrin', 'Test', '2025-01-01', ?, 'lak-psyk')").run(new Date().toISOString());
    const u = (await k.get('/api/patient/p04/uppfoljning')).data;
    expect(JSON.stringify(u)).not.toContain('Hemlig plan');
    expect(JSON.stringify(u)).not.toContain('psyk');
    const lg = await inloggad('logg');
    expect((await lg.get('/api/patient/p01/uppfoljning')).status).toBe(403);
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/patient/p01/uppfoljning')).status).toBe(403);
    expect(d.query("SELECT 1 FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = 'p04' AND resurs LIKE '%uppfoljning%'").get()).toBeTruthy();
  });
});

describe('Vyer utan personuppgifter', () => {
  test('beläggningsöversikten visar platser, belagda och lediga per avdelning utan namn, personnummer eller sal', async () => {
    const k = await inloggad('ssk-kard');
    const b = (await k.get('/api/belaggning')).data;
    const avd = b.avdelningar.find(a => a.avdelning.id === 'uso-kard-72');
    expect(avd).toMatchObject({ platser: 24, vardenhet: { id: 'uso-kard' } });
    expect(avd.belagda).toBe(db(k).query("SELECT count(*) AS n FROM vardkontakter WHERE enhet_id = 'uso-kard-72' AND typ = 'slutenvard' AND slut IS NULL AND coalesce(planerad, 0) = 0 AND start <= ?").get(new Date().toISOString()).n);
    expect(avd.lediga).toBe(avd.platser - avd.belagda);
    expect(b.avdelningar.every(a => a.vardenhet.id === 'uso-kard')).toBe(true);
    const text = JSON.stringify(b);
    for (const p of db(k).query('SELECT * FROM patienter').all()) { expect(text).not.toContain(p.efternamn); expect(text).not.toContain(p.personnummer.slice(0, 8)); }
    expect(text).not.toContain('sal 4');
    expect(b.visasAldrig).toEqual(expect.arrayContaining(['Namn']));
    // Uppföljningen ser alla avdelningar, och logggranskaren nekas.
    const u = (await (await inloggad('uppf')).get('/api/belaggning')).data;
    expect(new Set(u.avdelningar.map(a => a.vardenhet.id)).size).toBeGreaterThan(1);
    expect((await (await inloggad('logg')).get('/api/belaggning')).status).toBe(403);
  });

  test('utbildningsläget visar journalen pseudonymiserad och säger vilka uppgifter som aldrig visas', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get('/api/patient/p01/utbildningsvy');
    expect(r.status).toBe(200);
    const u = r.data;
    expect(u.patient).toMatchObject({ pseudonym: 'Patient A', kon: 'man' });
    expect(u.patient.aldersgrupp).toMatch(/^\d+ till \d+ år$/);
    const text = JSON.stringify(u);
    const p = db(k).query("SELECT * FROM patienter WHERE id = 'p01'").get();
    for (const x of [p.fornamn, p.efternamn, p.personnummer.slice(0, 8), p.adress, p.telefon]) expect(text).not.toContain(x);
    for (const n of db(k).query('SELECT namn FROM personal').all().map(x => x.namn)) expect(text).not.toContain(n);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(u.anteckningar.length).toBeGreaterThan(0);
    expect(u.anteckningar.every(a => Number.isInteger(a.dag) && a.dag <= 0)).toBe(true);
    expect(u.visasAldrig.join(' ')).toContain('personnummer');
    expect(u.begransningar).toContain('Fritext');
    expect(db(k).query("SELECT syfte FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = 'p01' AND resurs = 'utbildningsvy'").get().syfte).toContain('Utbildningsläge');
  });

  test('utbildningsläget följer behörigheten och visar aldrig en patient med skyddade personuppgifter eller spärrade uppgifter', async () => {
    const vc = await inloggad('lak-vc');
    const s = await vc.get('/api/patient/p03/utbildningsvy');
    expect(s.status).toBe(403);
    expect(JSON.stringify(s.data)).not.toContain('Engberg');
    const k = await inloggad('lak-kard');
    const u = JSON.stringify((await k.get('/api/patient/p04/utbildningsvy')).data);
    expect(u).not.toContain('sertralin');
    expect((await (await inloggad('lak-psyk')).get('/api/patient/p01/utbildningsvy')).status).toBe(403);
  });
});

describe('Vyer, sökning och utskrift, nyheter', () => {
  test('nyheterna om översikten, uppföljningen, överkänsligheten, utskriften, sökningen och förvalen gäller rätt roller', async () => {
    const nyheter = await import('../src/nyheter.js');
    const { nyDb, personal } = await import('./hjalp.js');
    const d = nyDb();
    const ids = (id) => nyheter.nyheter(d, { personal: personal(d, id), invanare: null }).alla.flatMap(v => v.nyheter.map(n => n.id));
    expect(ids('lak-kard')).toEqual(expect.arrayContaining(['oversikt-situation', 'uppfoljningsvy', 'overkanslighet-flode', 'utskrift-urval', 'sok-journaler', 'menprovning-strukturerad']));
    expect(ids('usk-kard')).toEqual(expect.arrayContaining(['oversikt-situation', 'uppfoljningsvy']));
    expect(ids('usk-kard')).not.toContain('overkanslighet-flode');
    expect(ids('logg')).toContain('menprovning-strukturerad');
    expect(ids('logg')).not.toContain('oversikt-situation');
    expect(ids('sysf')).toContain('vyforval-vardenhet');
    expect(ids('adm-kard')).not.toContain('vyforval-vardenhet');
  });
});
