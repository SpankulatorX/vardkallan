import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import * as aterbesok from '../src/aterbesok.js';
import * as tidbok from '../src/tidbok.js';

// Läkaren sätter upp ett återbesök (Sussa 3.4.1.1 och 3.4.1.4). Systemet föreslår tidstyp, yrkesroll och tidsram ur
// sammanhanget: anteckningens planering, diagnosen och den senaste kontakten. Läkaren bekräftar med ett klick, och
// posten hamnar på väntelistan och i vårdadministratörens Dagens arbete. Egenbokningen i Min journal gäller bara
// återbesök, telefon och video (beslut 2026-11-03).

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
async function signerad(k, pid, sokord, typ = 'Daganteckning') {
  const ny = await k.post(`/api/patient/${pid}/anteckningar`, { typ, sokord });
  expect(ny.status).toBe(201);
  expect((await k.post(`/api/anteckning/${ny.data.id}/signera`)).status).toBe(200);
  return ny.data.id;
}

describe('Återbesök', () => {
  test('planeringen i texten tolkas: tidstyp, yrkesroll och tidsram', () => {
    expect(aterbesok.tolkaPlanering('Telefonkontakt med sjuksköterska om två veckor.')).toMatchObject({ tidstyp: 'telefon', yrkesroll: 'sjukskoterska', inomDagar: 14 });
    expect(aterbesok.tolkaPlanering('INR-kontroll på vårdcentralen om en vecka. Återbesök på kardiologiska mottagningen om tre månader.')).toMatchObject({ tidstyp: 'aterbesok', inomDagar: 90 });
    expect(aterbesok.tolkaPlanering('Fortsatt behandling. Planerar elkonvertering polikliniskt efter tre veckor med terapeutiskt INR.')).toMatchObject({ tidstyp: 'aterbesok', inomDagar: 21 });
    expect(aterbesok.tolkaPlanering('Videobesök om 6 månader.')).toMatchObject({ tidstyp: 'video', inomDagar: 180 });
    expect(aterbesok.tolkaPlanering('Nytt besök om ett år.')).toMatchObject({ tidstyp: 'aterbesok', inomDagar: 365 });
    expect(aterbesok.tolkaPlanering('Höjer Metoprolol depot till 100 mg. Daglig vikt.')).toBeNull();
  });

  test('systemet föreslår återbesöket ur anteckningens planering, och läkaren sätter upp det med ett klick', async () => {
    const k = await inloggad('lak-kard');
    const id = await signerad(k, 'p01', [{ sokord: 'Aktuellt', text: 'Mår bättre.' }, { sokord: 'Åtgärd', text: 'Telefonkontakt med sjuksköterska om två veckor.' }]);
    const f = await k.get(`/api/patient/p01/aterbesok/forslag?anteckningId=${id}`);
    expect(f.status).toBe(200);
    expect(f.data.forslag).toMatchObject({ tidstyp: 'telefon', yrkesroll: 'sjukskoterska', inomDagar: 14, mal: addDagar(idag(), 14) });
    expect(f.data.varfor.join(' ')).toContain('anteckningen');
    expect(f.data.alternativ.tidstyper.map(t => t.id)).toEqual(['aterbesok', 'telefon', 'video']);
    // Systemet säger om patienten redan väntar på en tid på vårdenheten.
    expect(f.data.redan.map(r => r.orsak)).toContain('Återbesök efter vårdtillfället');
    const r = await k.post('/api/patient/p01/aterbesok', { anteckningId: id });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ tidstyp: 'telefon', yrkesroll: 'sjukskoterska', mal: addDagar(idag(), 14), vardenhet: { id: 'uso-kard' }, skapadAv: { id: 'lak-kard' }, status: 'vantar' });
    // Orsaken innehåller aldrig journaltext.
    expect(r.data.orsak).not.toContain('Telefonkontakt');
    expect(r.data.orsak).toContain('Sara Lindqvist');
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'skriv_journal', resurs: `vantelista:${r.data.id}:aterbesok`, resultat: 'tillaten' });
    // Vårdadministratören ser posten i Dagens arbete och bokar den som vanligt.
    await k.logga('adm-kard');
    const s = (await k.get('/api/idag')).data;
    expect(s.vantelista.find(p => p.id === r.data.id)).toMatchObject({ tidstypText: 'Telefontid', yrkesrollText: 'sjuksköterska', atgard: { typ: 'boka' } });
    const fo = (await k.get(`/api/vantelista/${r.data.id}/forslag`)).data.forslag;
    expect(fo.length).toBeGreaterThan(0);
    expect(fo.every(x => x.tidstyp === 'telefon')).toBe(true);
  });

  test('utan planering i texten föreslår systemet ur diagnosen och den senaste kontakten, och läkaren kan ändra förslaget', async () => {
    const k = await inloggad('lak-kard');
    // Från översikten: den senaste signerade läkaranteckningen på vårdenheten planerar en elkonvertering om tre veckor.
    let f = (await k.get('/api/patient/p01/aterbesok/forslag')).data;
    expect(f.forslag).toMatchObject({ tidstyp: 'aterbesok', yrkesroll: 'lakare', inomDagar: 21 });
    // En patient utan planering: diagnosen hjärtinfarkt ger ett återbesök hos läkare inom sex veckor (demoregel).
    f = (await k.get('/api/patient/p04/aterbesok/forslag')).data;
    expect(f.forslag).toMatchObject({ tidstyp: 'aterbesok', yrkesroll: 'lakare', inomDagar: 42 });
    expect(f.varfor.join(' ')).toContain('hjärtinfarkt');
    expect(f.demoregler).toBe(true);
    // Läkaren ändrar till video inom en månad. Servern kontrollerar värdena.
    expect((await k.post('/api/patient/p04/aterbesok', { tidstyp: 'nybesok' })).status).toBe(400);
    expect((await k.post('/api/patient/p04/aterbesok', { inomDagar: 900 })).status).toBe(400);
    const r = await k.post('/api/patient/p04/aterbesok', { tidstyp: 'video', inomDagar: 30 });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ tidstyp: 'video', yrkesroll: 'lakare', mal: addDagar(idag(), 30) });
  });

  test('säkerhet: skriv_journal och vårdrelation på egen vårdenhet krävs, och anteckningar som inte får läsas används inte', async () => {
    const k = await inloggad('ssk-kard');
    expect((await k.get('/api/patient/p01/aterbesok/forslag')).status).toBe(403);
    expect((await k.post('/api/patient/p01/aterbesok', {})).status).toBe(403);
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p01/aterbesok', {})).status).toBe(403);
    // Nödåtkomst ger ingen rätt att sätta upp återbesök.
    await k.logga('lak-kard');
    await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös patient, behöver journalen' });
    const fore = db(k).query('SELECT count(*) AS n FROM vantelista').get().n;
    expect((await k.post('/api/patient/p02/aterbesok', {})).status).toBe(403);
    expect(db(k).query('SELECT count(*) AS n FROM vantelista').get().n).toBe(fore);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p02', resultat: 'nekad' });
    // En spärrad vårdenhets anteckning används inte, inte ens om id:t gissas.
    const psyk = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id LIKE 'uso-psyk%' AND status = 'signerad'").get();
    expect(psyk).toBeTruthy();
    expect((await k.get(`/api/patient/p04/aterbesok/forslag?anteckningId=${psyk.id}`)).status).toBe(404);
    // Säkerhetsgranskning: en nyare version i rättelsekedjan som inte är signerad eller inte får läsas används inte.
    const egen = await signerad(k, 'p01', [{ sokord: 'Åtgärd', text: 'Återbesök om tre månader.' }]);
    const d = db(k);
    const rad = d.query('SELECT * FROM anteckningar WHERE id = ?').get(egen);
    d.query("INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, ersatter_id, version) VALUES ('p01', ?, 'Daganteckning', 'lakare', ?, 'lak-akut', ?, 'utkast', ?, 2)")
      .run(rad.enhet_id, JSON.stringify([{ sokord: 'Åtgärd', text: 'Telefonkontakt med sjuksköterska om två veckor.' }]), new Date().toISOString(), egen);
    expect((await k.get(`/api/patient/p01/aterbesok/forslag?anteckningId=${egen}`)).status).toBe(404);
    const egen2 = await signerad(k, 'p01', [{ sokord: 'Åtgärd', text: 'Återbesök om tre månader.' }]);
    d.query("INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, ersatter_id, version) VALUES ('p01', 'uso-psyk', 'Daganteckning', 'lakare', ?, 'lak-psyk', ?, 'signerad', ?, 'lak-psyk', ?, 2)")
      .run(JSON.stringify([{ sokord: 'Åtgärd', text: 'Videobesök om ett år.' }]), new Date().toISOString(), new Date().toISOString(), egen2);
    expect((await k.get(`/api/patient/p01/aterbesok/forslag?anteckningId=${egen2}`)).status).toBe(404);
    // En annan patients anteckning används inte heller.
    const annan = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND status = 'signerad'").get();
    expect((await k.get(`/api/patient/p04/aterbesok/forslag?anteckningId=${annan.id}`)).status).toBe(404);
    // Akutmottagningen har ingen tidbok i demon, och systemet säger det.
    await k.logga('lak-akut');
    const a = await k.get('/api/patient/p01/aterbesok/forslag');
    expect(a.status).toBe(200);
    expect(a.data.kan).toBe(false);
    expect((await k.post('/api/patient/p01/aterbesok', {})).status).toBe(400);
    // Skyddad identitet maskeras på väntelistan.
    const vc = await inloggad('lak-vc');
    const r = await vc.post('/api/patient/p03/aterbesok', {});
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.data)).not.toMatch(/Malin|Engberg/);
    expect(r.data.patient.namn).toBe('Skyddad identitet');
  });
});

describe('Tidbok, egenbokning', () => {
  test('patientens egenbokning gäller bara återbesök, telefon och video, aldrig nybesök', async () => {
    expect(tidbok.EGENBOKNING_TIDSTYPER).toEqual(['aterbesok', 'telefon', 'video']);
    const d = nyDb();
    expect(d.query("SELECT count(*) AS n FROM tidboksregler WHERE egenbokning = 1 AND tidstyp NOT IN ('aterbesok', 'telefon', 'video')").get().n).toBe(0);
    // Också om en mottagning skulle öppna nybesök och gruppträffar i sina regler stänger systemet dem.
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-p08' })).status).toBe(200);
    db(k).query("UPDATE tidboksregler SET egenbokning = 1 WHERE enhet_id = 'uso-kard'").run();
    // Nybesöket flyttas fem dagar fram, så att 24-timmarsgränsen inte är det som stänger det.
    const b = db(k).query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.tidstyp = 'nybesok'").get();
    db(k).query('UPDATE tider SET start = ?, slut = ? WHERE id = ?').run(new Date(Date.now() + 5 * 86400_000).toISOString(), new Date(Date.now() + 5 * 86400_000 + 3600_000).toISOString(), b.tid_id);
    const t = (await k.get('/api/min/journal/p08/tider')).data;
    expect(t.boka.length).toBeGreaterThan(0);
    expect(t.boka.every(v => ['aterbesok', 'telefon', 'video'].includes(v.tidstyp))).toBe(true);
    const nyb = t.kommande.find(x => x.tidstyp === 'nybesok');
    expect(nyb.kan).toMatchObject({ omboka: false, avboka: false });
    expect((await k.get('/api/min/journal/p08/boka/forslag?nyckel=uso-kard:nybesok:lakare')).status).toBe(400);
    const tid = db(k).query("SELECT t.id FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = 'uso-kard-mott' AND t.tidstyp = 'nybesok' AND t.start > ? ORDER BY t.start").get(new Date(Date.now() + 3 * 86400_000).toISOString());
    expect((await k.post('/api/min/journal/p08/boka', { nyckel: 'uso-kard:nybesok:lakare', tidId: tid.id })).status).toBe(400);
    expect((await k.post(`/api/min/journal/p08/bokning/${nyb.id}/avboka`)).status).toBe(400);
  });
});
