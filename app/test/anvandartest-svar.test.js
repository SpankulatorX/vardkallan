// Svaren från riktiga användartester (runda 7, r1): SUS och expertgranskning sparas på servern i en egen tabell, utan
// patientuppgifter och utan testpersonens namn, knutna till ett testtillfälle. Testledaren (uppföljningsrollen) skapar
// tillfället och får en slumpad kod som visas en gång. Svar sparas bara med koden, och läsning, export och radering
// kräver både rollen och koden för just det tillfället.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient } from './hjalp.js';
import * as svar from '../src/anvandartest-svar.js';

let app;
beforeAll(() => { app = testserver({ anvandartestFil: ':memory:' }); });
afterAll(() => app.stopp());

const SUS = { typ: 'sus', roll: 'Läkare slutenvård', pseudonym: 'L03', testfall: '4.3', svar: [4, 2, 4, 2, 4, 2, 4, 2, 4, 2] };
const EXPERT = { typ: 'expert', roll: 'Användbarhetsexpert', pseudonym: 'E01', testfall: 'alla', svar: [10, 10, 10, 10, 10, 10, 5].map((p, i) => ({ nr: i + 1, poang: p, kommentar: i ? '' : 'Tydliga notiser.' })) };

async function tillfalle() {
  const t = klient(app);
  await t.logga('uppf');
  const r = await t.post('/api/anvandartest/tillfallen');
  expect(r.status).toBe(201);
  return { t, kod: r.data.kod, id: r.data.id };
}

describe('Användartestens svar', () => {
  test('testledaren skapar ett testtillfälle och får en slumpad kod med minst 128 bitar som visas en gång', async () => {
    const { t, kod, id } = await tillfalle();
    expect(kod).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(Buffer.from(kod, 'base64url').length * 8).toBeGreaterThanOrEqual(128);
    // Koden sparas bara som en hash och lämnas aldrig ut igen.
    const lista = await t.post('/api/anvandartest/svar/lista', { kod });
    expect(lista.status).toBe(200);
    expect(JSON.stringify(lista.data)).not.toContain(kod);
    expect(lista.data.tillfalle.id).toBe(id);
    expect(lista.data.tillfalle.raderas).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(svar.GALLRING_DAGAR).toBe(90);
    // Andra roller får inte skapa tillfällen.
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/anvandartest/tillfallen')).status).toBe(403);
  });

  test('sparas på servern med roll, pseudonym, datum, testfall och svar, och poängen räknas av servern', async () => {
    const { kod } = await tillfalle();
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.post('/api/anvandartest/svar', { ...SUS, kod, poang: 100 });
    expect(r.status).toBe(201);
    expect(r.data).toEqual(expect.objectContaining({ typ: 'sus', roll: 'Läkare slutenvård', pseudonym: 'L03', testfall: '4.3', poang: 75, utvarderingspoang: 2 }));
    expect(r.data.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const e = await k.post('/api/anvandartest/svar', { ...EXPERT, kod });
    expect(e.status).toBe(201);
    expect(e.data).toEqual(expect.objectContaining({ typ: 'expert', poang: 65, utvarderingspoang: 10 }));
    // Det som sparas är bara dessa fält.
    expect(Object.keys(r.data).sort()).toEqual(['datum', 'id', 'poang', 'pseudonym', 'roll', 'svar', 'testfall', 'typ', 'utvarderingspoang']);
    expect(svar.SPARAS.length).toBeGreaterThan(3);
  });

  test('inga patientuppgifter eller namn: pseudonym med siffror som ett personnummer, kommentar med personnummer och okända fält avvisas', async () => {
    const { kod } = await tillfalle();
    const k = klient(app);
    await k.logga('ssk-kard');
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod, pseudonym: '19450207' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod, pseudonym: 'Gerda Ström' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod, roll: 'Gerda Ström' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod, testfall: '9.9' })).status).toBe(400);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod, svar: [4, 2, 4] })).status).toBe(400);
    const pnr = { ...EXPERT, kod, svar: EXPERT.svar.map((p, i) => (i ? p : { ...p, kommentar: 'Patienten 19450207-3416 syntes' })) };
    const r = await k.post('/api/anvandartest/svar', pnr);
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('patientuppgifter');
    const ok = await k.post('/api/anvandartest/svar', { ...SUS, kod, namn: 'Anna Andersson', personnummer: '194502073416' });
    expect(ok.status).toBe(201);
    expect(JSON.stringify(ok.data)).not.toContain('Anna');
    expect(JSON.stringify(ok.data)).not.toContain('194502073416');
  });

  test('ett svar kräver inloggning och en giltig kod för ett tillfälle', async () => {
    const { kod } = await tillfalle();
    expect((await klient(app).post('/api/anvandartest/svar', { ...SUS, kod })).status).toBe(401);
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/anvandartest/svar', SUS)).status).toBe(403);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod: 'x'.repeat(43) })).status).toBe(403);
  });

  test('läsning och export kräver både testledarens roll och koden för just det tillfället, så att ingen ser andras tillfällen', async () => {
    const a = await tillfalle();
    const b = await tillfalle();
    const k = klient(app);
    await k.logga('usk-kard');
    await k.post('/api/anvandartest/svar', { ...SUS, kod: a.kod, pseudonym: 'A01' });
    await k.post('/api/anvandartest/svar', { ...SUS, kod: b.kod, pseudonym: 'B01' });
    // Utan rollen nekas läsningen också med koden.
    expect((await k.post('/api/anvandartest/svar/lista', { kod: a.kod })).status).toBe(403);
    expect((await k.post('/api/anvandartest/svar/export', { kod: a.kod, format: 'csv' })).status).toBe(403);
    // Med rollen men utan kod, eller med fel kod, nekas också.
    expect((await a.t.post('/api/anvandartest/svar/lista', {})).status).toBe(403);
    expect((await a.t.post('/api/anvandartest/svar/lista', { kod: 'x'.repeat(43) })).status).toBe(403);
    // Varje kod ger bara sitt tillfälle, också för en annan testledare.
    const la = await b.t.post('/api/anvandartest/svar/lista', { kod: a.kod });
    expect(la.status).toBe(200);
    expect(la.data.svar.map(s => s.pseudonym)).toEqual(['A01']);
    expect(la.data.sammanstallning.sus).toEqual(expect.objectContaining({ antal: 1, medel: 75, utvarderingspoang: 2 }));
    expect(la.data.sparas).toEqual(svar.SPARAS);
    const csv = await a.t.post('/api/anvandartest/svar/export', { kod: a.kod, format: 'csv' });
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-disposition')).toContain('attachment');
    expect(csv.data.split('\n')[0]).toBe('id;typ;roll;pseudonym;datum;testfall;poäng;utvärderingspoäng;svar');
    expect(csv.data).toContain('A01');
    expect(csv.data).not.toContain('B01');
    const js = await a.t.post('/api/anvandartest/svar/export', { kod: a.kod, format: 'json' });
    expect(js.status).toBe(200);
    const d = typeof js.data === 'string' ? JSON.parse(js.data) : js.data;
    expect(d.svar.map(s => s.pseudonym)).toEqual(['A01']);
    expect(JSON.stringify(d)).not.toContain(a.kod);
    // Den gamla läsningen med GET och utan kod finns inte.
    expect((await a.t.get('/api/anvandartest/svar')).status).toBe(405);
  });

  test('testledaren raderar ett tillfälle med dess svar, och koden gäller inte längre', async () => {
    const { t, kod } = await tillfalle();
    const k = klient(app);
    await k.logga('lak-kard');
    await k.post('/api/anvandartest/svar', { ...SUS, kod });
    expect((await k.post('/api/anvandartest/tillfalle/radera', { kod })).status).toBe(403);
    const r = await t.post('/api/anvandartest/tillfalle/radera', { kod });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ ok: true, raderadeSvar: 1 });
    expect((await t.post('/api/anvandartest/svar/lista', { kod })).status).toBe(403);
    expect((await k.post('/api/anvandartest/svar', { ...SUS, kod })).status).toBe(403);
  });

  test('skrivningen är begränsad per tillfälle och per session och minut, och ett fullt tillfälle stoppar bara sig självt', () => {
    const db = svar.oppna(':memory:');
    const nu = new Date('2026-11-08T10:00:00Z');
    const a = svar.skapaTillfalle(db, { nu });
    const b = svar.skapaTillfalle(db, { nu });
    const sessionA = {};
    for (let i = 0; i < svar.MAX_PER_TILLFALLE; i++) {
      // Varje svar från en ny session, så att bara gränsen per tillfälle prövas.
      svar.spara(db, { ...SUS, kod: a.kod, pseudonym: `A${i}` }, { nu: new Date(nu.getTime() + i * 1000), session: {} });
    }
    expect(() => svar.spara(db, { ...SUS, kod: a.kod }, { nu, session: {} })).toThrow(/fullt/);
    // Ett annat tillfälle tar fortfarande emot svar.
    expect(svar.spara(db, { ...SUS, kod: b.kod }, { nu, session: sessionA }).poang).toBe(75);
    // Per session och minut.
    for (let i = 1; i < svar.MAX_PER_MINUT; i++) svar.spara(db, { ...SUS, kod: b.kod }, { nu: new Date(nu.getTime() + i), session: sessionA });
    expect(() => svar.spara(db, { ...SUS, kod: b.kod }, { nu: new Date(nu.getTime() + 2000), session: sessionA })).toThrow(/minut/);
    expect(svar.spara(db, { ...SUS, kod: b.kod }, { nu: new Date(nu.getTime() + 61_000), session: sessionA }).poang).toBe(75);
  });

  test('tillfällen utan aktivitet på 90 dagar raderas med sina svar', () => {
    const db = svar.oppna(':memory:');
    const t0 = new Date('2026-01-01T10:00:00Z');
    const gammal = svar.skapaTillfalle(db, { nu: t0 });
    svar.spara(db, { ...SUS, kod: gammal.kod }, { nu: t0, session: {} });
    const aktiv = svar.skapaTillfalle(db, { nu: t0 });
    svar.spara(db, { ...SUS, kod: aktiv.kod }, { nu: new Date('2026-03-15T10:00:00Z'), session: {} });
    const r = svar.stada(db, { nu: new Date('2026-04-02T10:00:00Z') });
    expect(r).toEqual({ tillfallen: 1, svar: 1 });
    expect(() => svar.lista(db, gammal.kod)).toThrow();
    expect(svar.lista(db, aktiv.kod).svar).toHaveLength(1);
  });
});
