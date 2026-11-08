// Svaren från riktiga användartester (runda 7, r1): SUS och expertgranskning sparas på servern i en egen tabell, utan
// patientuppgifter och utan testpersonens namn. Bara testledaren (uppföljningsrollen) läser och exporterar dem.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient } from './hjalp.js';
import * as svar from '../src/anvandartest-svar.js';

let app;
beforeAll(() => { app = testserver({ anvandartestFil: ':memory:' }); });
afterAll(() => app.stopp());

const SUS = { typ: 'sus', roll: 'Läkare slutenvård', pseudonym: 'L03', testfall: '4.3', svar: [4, 2, 4, 2, 4, 2, 4, 2, 4, 2] };
const EXPERT = { typ: 'expert', roll: 'Användbarhetsexpert', pseudonym: 'E01', testfall: 'alla', svar: [10, 10, 10, 10, 10, 10, 5].map((p, i) => ({ nr: i + 1, poang: p, kommentar: i ? '' : 'Tydliga notiser.' })) };

describe('Användartestens svar', () => {
  test('sparas på servern med roll, pseudonym, datum, testfall och svar, och poängen räknas av servern', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.post('/api/anvandartest/svar', { ...SUS, poang: 100 });
    expect(r.status).toBe(201);
    expect(r.data).toEqual(expect.objectContaining({ typ: 'sus', roll: 'Läkare slutenvård', pseudonym: 'L03', testfall: '4.3', poang: 75, utvarderingspoang: 2 }));
    expect(r.data.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const e = await k.post('/api/anvandartest/svar', EXPERT);
    expect(e.status).toBe(201);
    expect(e.data).toEqual(expect.objectContaining({ typ: 'expert', poang: 65, utvarderingspoang: 10 }));
    // Det som sparas är bara dessa fält.
    expect(Object.keys(r.data).sort()).toEqual(['datum', 'id', 'poang', 'pseudonym', 'roll', 'svar', 'testfall', 'typ', 'utvarderingspoang']);
    expect(svar.SPARAS.length).toBeGreaterThan(3);
  });

  test('inga patientuppgifter eller namn: pseudonym med siffror som ett personnummer, kommentar med personnummer och okända fält avvisas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    expect((await k.post('/api/anvandartest/svar', { ...SUS, pseudonym: '19450207' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, pseudonym: 'Gerda Ström' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, roll: 'Gerda Ström' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, testfall: '9.9' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, svar: [4, 2, 4] })).status).toBe(400);
    const pnr = { ...EXPERT, svar: EXPERT.svar.map((p, i) => (i ? p : { ...p, kommentar: 'Patienten 19450207-3416 syntes' })) };
    const r = await k.post('/api/anvandartest/svar', pnr);
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('patientuppgifter');
    // Ett fält som inte hör till svaret, till exempel ett namn, sparas inte.
    const ok = await k.post('/api/anvandartest/svar', { ...SUS, namn: 'Anna Andersson', personnummer: '194502073416' });
    expect(ok.status).toBe(201);
    expect(JSON.stringify(ok.data)).not.toContain('Anna');
    expect(JSON.stringify(ok.data)).not.toContain('194502073416');
  });

  test('kräver inloggning för att spara', async () => {
    const k = klient(app);
    expect((await k.post('/api/anvandartest/svar', SUS)).status).toBe(401);
  });

  test('bara testledaren (uppföljningsrollen) läser och exporterar svaren, som JSON och CSV', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.get('/api/anvandartest/svar')).status).toBe(403);
    expect((await k.get('/api/anvandartest/svar/export?format=csv')).status).toBe(403);
    const t = klient(app);
    await t.logga('uppf');
    const l = await t.get('/api/anvandartest/svar');
    expect(l.status).toBe(200);
    expect(l.data.svar.length).toBeGreaterThanOrEqual(3);
    expect(l.data.sammanstallning.sus).toEqual(expect.objectContaining({ antal: expect.any(Number), medel: 75, utvarderingspoang: 2 }));
    expect(l.data.sparas).toEqual(svar.SPARAS);
    const csv = await t.get('/api/anvandartest/svar/export?format=csv');
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-disposition')).toContain('attachment');
    expect(csv.data.split('\n')[0]).toBe('id;typ;roll;pseudonym;datum;testfall;poäng;utvärderingspoäng;svar');
    const js = await t.get('/api/anvandartest/svar/export?format=json');
    expect(js.status).toBe(200);
    expect(JSON.parse(typeof js.data === 'string' ? js.data : JSON.stringify(js.data)).svar.length).toBe(l.data.svar.length);
  });

  test('svaren delas av alla sandlådor och finns kvar när sandlådan återställs', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    await k.post('/api/anvandartest/svar', { ...SUS, pseudonym: 'U07' });
    await k.post('/api/reset');
    const t = klient(app);
    await t.logga('uppf');
    expect((await t.get('/api/anvandartest/svar')).data.svar.some(s => s.pseudonym === 'U07')).toBe(true);
  });
});
