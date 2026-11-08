// Runda 9, r7: beställningar av datauttag till forskare (Sussa 6.3.3.1). Testnamnen står i src/sussa/mappning/6.3.3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const BESTALLNING = { titel: 'Förmaksflimmer och blodförtunnande hos äldre', forskare: 'Demo Forskare', organisation: 'Demouniversitetet (påhittat)', etikprovning: '2026-01234-01',
  urval: { Diagnos: ['kod', 'datum', 'aldersgrupp'], Ordination: ['atc', 'startdatum'] }, aterkommande: true };

describe('Forskningsuttag', () => {
  test('beställningen får diarienummer, etikprövningen kontrolleras och urvalet hämtas ur datauttaget', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const r = await k.post('/api/forskning', BESTALLNING);
    expect(r.status).toBe(201);
    expect(r.data.diarienummer).toMatch(/^FU-\d{4}-0001$/);
    expect(r.data).toMatchObject({ status: 'registrerad', etikprovning: '2026-01234-01', vantarPa: ['Sekretessprövning', 'Godkännande för verksamheten'] });
    // Systemet tar själv med radnyckeln och patientens pseudonym.
    expect(r.data.urval.Diagnos).toEqual(['rad', 'patient', 'kod', 'datum', 'aldersgrupp']);
    expect((await k.post('/api/forskning', { ...BESTALLNING, etikprovning: 'saknas' })).data.fel).toContain('etikprövning');
    expect((await k.post('/api/forskning', { ...BESTALLNING, urval: { Diagnos: ['personnummer'] } })).status).toBe(400);
    expect((await k.post('/api/forskning', { ...BESTALLNING, urval: { Journal: ['text'] } })).status).toBe(400);
    // Innehållet ändras inte efter registreringen.
    const db = sandlada(app, k).db;
    expect(() => db.query("UPDATE forskningsbestallningar SET urval = '{}' WHERE id = ?").run(r.data.id)).toThrow();
  });

  test('två andra personer godkänner, den som registrerade kan inte, och utlämnandet loggas och kan inte ändras', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const id = (await k.post('/api/forskning', BESTALLNING)).data.id;
    expect((await k.post(`/api/forskning/${id}/beslut`, { beslut: 'godkand' })).status).toBe(403);
    expect((await k.post(`/api/forskning/${id}/utlamna`)).status).toBe(409);
    await k.logga('ark');
    const ett = await k.post(`/api/forskning/${id}/beslut`, { beslut: 'godkand' });
    expect(ett.data).toMatchObject({ status: 'registrerad', vantarPa: ['Godkännande för verksamheten'] });
    expect((await k.post(`/api/forskning/${id}/beslut`, { beslut: 'godkand' })).status).toBe(409);
    await k.logga('vch-kard');
    expect((await k.post(`/api/forskning/${id}/beslut`, { beslut: 'godkand' })).data.status).toBe('godkand');
    await k.logga('uppf');
    const u = await k.post(`/api/forskning/${id}/utlamna`);
    expect(u.status).toBe(200);
    expect(u.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(u.data.antal.Diagnos).toBeGreaterThan(0);
    const db = sandlada(app, k).db;
    const rader = u.data.filer['Diagnos.ndjson'].trim().split('\n').map(x => JSON.parse(x));
    expect(Object.keys(rader[0]).sort()).toEqual(['aldersgrupp', 'datum', 'kod', 'patient', 'rad']);
    // Inga personuppgifter, inga spärrade uppgifter, och egna pseudonymer för studien.
    const text = JSON.stringify(u.data);
    for (const p of db.query('SELECT * FROM patienter').all()) { expect(text).not.toContain(p.personnummer); expect(text).not.toContain(p.efternamn); }
    expect(text).not.toContain('F33.1');
    const uppfoljning = new Set((await (await fetch(app.url + '/api/datauttag/Diagnos', { headers: { Cookie: k.kaka() } })).text()).trim().split('\n').map(x => JSON.parse(x).patient));
    expect(rader.some(r => uppfoljning.has(r.patient))).toBe(false);
    // En återkommande beställning ger samma pseudonymer igen.
    const igen = await k.post(`/api/forskning/${id}/utlamna`);
    expect(igen.data.filer['Diagnos.ndjson']).toBe(u.data.filer['Diagnos.ndjson']);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ?").get(`forskning:${id}:utlamnad`).n).toBe(2);
    expect(() => db.query('DELETE FROM forskningsutlamnanden').run()).toThrow();
    expect(() => db.query("UPDATE forskningsbeslut SET beslut = 'avslagen'").run()).toThrow();
  });

  test('en avslagen beställning kan inte lämnas ut, och roller utan behörighet nekas', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const id = (await k.post('/api/forskning', { ...BESTALLNING, aterkommande: false })).data.id;
    await k.logga('ark');
    expect((await k.post(`/api/forskning/${id}/beslut`, { beslut: 'avslagen' })).status).toBe(400);
    expect((await k.post(`/api/forskning/${id}/beslut`, { beslut: 'avslagen', motivering: 'Uppgifterna omfattas inte av etikprövningen.' })).data.status).toBe('avslagen');
    await k.logga('uppf');
    expect((await k.post(`/api/forskning/${id}/utlamna`)).status).toBe(409);
    await k.logga('lak-kard');
    expect((await k.get('/api/forskning')).status).toBe(403);
    expect((await k.post('/api/forskning', BESTALLNING)).status).toBe(403);
  });
});
