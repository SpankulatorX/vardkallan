import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { idag, addDagar, datumAv } from '../src/db.js';
import { harVardrelation } from '../src/atkomst.js';

// Tidboken efter den fristående säkerhetsgranskningen: vårdrelation från bokningar, skyddad identitet i kallelser,
// inre sekretess i förslagen, kontroller vid bokning, FHIR för invånaren och incheckningsskärmen.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const post = (k, pid) => db(k).query("SELECT * FROM vantelista WHERE patient_id = ? AND status = 'vantar'").get(pid);
const kontakt = (k, id) => db(k).query('SELECT * FROM vardkontakter WHERE id = ?').get(id);
const kallelser = (k, bid) => db(k).query('SELECT * FROM kallelser WHERE bokning_id = ? ORDER BY id').all(bid);

describe('Tidbok, säkerhetsgranskning', () => {
  test('en bokning ger inte bestående vårdrelation när remissen avvisas: tiden avbokas och patienten får besked', async () => {
    const k = await inloggad('lak-vc');
    const r = await k.post('/api/patient/p06/remisser', { tillEnhetId: 'uso-kard', fragestallning: 'Bedömning av blåsljud.', anamnes: 'Blåsljud.', prioritet: 'normal', svarSenast: addDagar(idag(), 30) });
    expect(r.status).toBe(201);
    await k.logga('adm-kard');
    expect((await k.post(`/api/remiss/${r.data.id}/mottag`)).status).toBe(200);
    // Vårdadministratören sätter upp patienten på väntelistan med remissen som grund och bokar.
    const ny = await k.post('/api/patient/p06/vantelista', { tidstyp: 'aterbesok', yrkesroll: 'lakare' });
    expect(ny.status).toBe(201);
    const f = (await k.get(`/api/vantelista/${ny.data.id}/forslag`)).data.forslag[0];
    expect((await k.post(`/api/vantelista/${ny.data.id}/boka`, { tidId: f.tidId })).status).toBe(201);
    const b = db(k).query("SELECT * FROM bokningar WHERE patient_id = 'p06' AND status = 'bokad'").get();
    await k.logga('lak-kard');
    const bed = await k.post(`/api/remiss/${r.data.id}/bedom`, { beslut: 'avvisad', motivering: 'Handläggs i primärvården.' });
    expect(bed.status).toBe(200);
    expect(bed.data.avbokade).toBe(1);
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(b.id).status).toBe('avbokad');
    expect(kontakt(k, b.vardkontakt_id)).toBeNull();
    expect(kallelser(k, b.id).at(-1)).toMatchObject({ typ: 'avbokning', status: 'skickad' });
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(ny.data.id).status).toBe('avslutad');
    expect(harVardrelation(db(k), 'p06', 'uso-kard')).toBe(false);
    expect((await k.get('/api/patient/p06/oversikt')).status).toBe(403);
  });

  test('en planerad kontakt ger vårdrelation bara till 90 dagar efter tiden', () => {
    const d = nyDb();
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p08' AND status = 'bokad'").get();
    expect(harVardrelation(d, 'p08', 'uso-kard')).toBe(true);
    const gammal = new Date(Date.now() - 670 * 86400_000).toISOString();
    d.query('UPDATE vardkontakter SET start = ? WHERE id = ?').run(gammal, b.vardkontakt_id);
    expect(harVardrelation(d, 'p08', 'uso-kard')).toBe(false);
    // Också efter en registrerad ankomst, om kontakten aldrig avslutas.
    d.query('UPDATE vardkontakter SET ankomst = ? WHERE id = ?').run(gammal, b.vardkontakt_id);
    expect(harVardrelation(d, 'p08', 'uso-kard')).toBe(false);
    d.query('UPDATE vardkontakter SET start = ?, ankomst = NULL WHERE id = ?').run(new Date(Date.now() - 80 * 86400_000).toISOString(), b.vardkontakt_id);
    expect(harVardrelation(d, 'p08', 'uso-kard')).toBe(true);
  });

  test('kallelsetexten och adressen för en patient med skyddade personuppgifter visas inte för personalen', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    const r = d.query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    await k.post(`/api/remiss/${r.id}/mottag`);
    await k.logga('lak-kard');
    await k.post(`/api/remiss/${r.id}/bedom`, { beslut: 'accepterad' });
    await k.logga('adm-kard');
    const p = post(k, 'p03');
    const f = (await k.get(`/api/vantelista/${p.id}/forslag`)).data.forslag[0];
    const bok = await k.post(`/api/vantelista/${p.id}/boka`, { tidId: f.tidId });
    expect(bok.status).toBe(201);
    expect(bok.data.kallelse.text).toBeNull();
    // En kallelse med brev från innan patienten fick skyddad identitet.
    d.query("INSERT INTO kallelser (bokning_id, patient_id, typ, kanal, mottagare, text, status, skapad) VALUES (?, 'p03', 'kallelse', 'brev', 'Gamla gatan 1, 702 10 Örebro', 'Hej Malin, gammal', 'skickad', ?)").run(bok.data.id, new Date().toISOString());
    const svar = [bok.data, (await k.get('/api/patient/p03/bokningar')).data, (await k.get('/api/idag')).data, (await k.get(`/api/tidbok?datum=${datumAv(new Date(f.start))}`)).data];
    for (const s of svar) {
      const json = JSON.stringify(s);
      for (const x of ['Malin', 'Engberg', 'Gamla gatan']) expect(json).not.toContain(x);
    }
    // Gruppkallelsen till en skyddad patient lämnar inte heller ut namnet.
    const grupp = d.query("SELECT * FROM tider WHERE tidstyp = 'grupp'").get();
    const ny = Number(d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad) VALUES ('p03', ?, 'bokad', ?)").run(grupp.id, new Date().toISOString()).lastInsertRowid);
    d.query("INSERT INTO kallelser (bokning_id, patient_id, typ, text, status, skapad) VALUES (?, 'p03', 'kallelse', 'x', 'vantar', ?)").run(ny, new Date().toISOString());
    expect(JSON.stringify((await k.post(`/api/tid/${grupp.id}/kalla`)).data)).not.toContain('Malin');
  });

  test('förslagen tar bara hänsyn till bokningar som användaren får se', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    const p = post(k, 'p01');
    const fore = (await k.get(`/api/vantelista/${p.id}/forslag`)).data.forslag;
    const dag = datumAv(new Date(fore[0].start));
    // En bokning på Vårdcentralen Tybble samma dag, som kardiologen inte får se utan aktivt val.
    const start = new Date(Date.parse(fore[0].start) + 3600_000).toISOString();
    const tid = Number(d.query("INSERT INTO tider (schema_id, start, slut, tidstyp) VALUES ('sch-vc-hanna', ?, ?, 'telefon')").run(start, start).lastInsertRowid);
    d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad) VALUES ('p01', ?, 'bokad', ?)").run(tid, new Date().toISOString());
    const efter = (await k.get(`/api/vantelista/${p.id}/forslag`)).data.forslag;
    expect(efter.some(f => datumAv(new Date(f.start)) === dag)).toBe(true);
  });

  test('patienten kan bara boka om till en av de tider systemet föreslår', async () => {
    const k = await invanare('inv-p14');
    const d = db(k);
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p14' AND status = 'bokad'").get();
    // En telefontid hos läkare, inte hos sjuksköterskan som patienten har tid hos.
    const lak = d.query("SELECT id FROM tider WHERE schema_id = 'sch-kard-sara' AND tidstyp = 'telefon' AND start > ? ORDER BY start").get(new Date(Date.now() + 3 * 86400_000).toISOString());
    expect((await k.post(`/api/min/journal/p14/bokning/${b.id}/omboka`, { tidId: lak.id })).status).toBe(400);
  });

  test('personalens bokning kräver tidstyp och yrkesroll ur posten och tar aldrig en gruppträff', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    const p = post(k, 'p10');
    const fel = d.query("SELECT id FROM tider WHERE schema_id = 'sch-kard-lina' AND tidstyp = 'aterbesok' AND start > ? ORDER BY start").get(new Date(Date.now() + 86400_000).toISOString());
    expect((await k.post(`/api/vantelista/${p.id}/boka`, { tidId: fel.id })).status).toBe(400);
    const grupp = d.query("SELECT id FROM tider WHERE tidstyp = 'grupp'").get();
    expect((await k.post(`/api/vantelista/${p.id}/boka`, { tidId: grupp.id })).status).toBe(400);
  });

  test('FHIR för invånaren lämnar inte ut personalens fria text', async () => {
    const adm = await inloggad('adm-kard');
    const b = db(adm).query("SELECT * FROM bokningar WHERE patient_id = 'p14' AND status = 'bokad'").get();
    expect((await adm.post(`/api/bokning/${b.id}/avboka`, { orsak: 'HEMLIG INTERN ORSAK' })).status).toBe(200);
    expect((await adm.post('/api/login/invanare', { invanareId: 'inv-p14' })).status).toBe(200);
    const r = await adm.get(`/fhir/Appointment/${b.id}`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.data)).not.toContain('HEMLIG');
    expect(r.data.description).toBeUndefined();
  });

  test('incheckningsskärmen visar inte avgiften och stoppar många försök', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/incheckning/skarm', { personnummer: '199011172476' });
    expect(r.data.ok).toBe(true);
    expect(r.data.avgift).toBeUndefined();
    for (const x of ['kronor', 'frikort', 'avgiftsfri']) expect(r.data.text.toLowerCase()).not.toContain(x);
    let sista;
    for (let i = 0; i < 12; i++) sista = await k.post('/api/incheckning/skarm', { personnummer: '191212121212' });
    expect(sista.status).toBe(403);
    expect(sista.data.fel).toContain('För många försök');
  });
});
