// Runda 10, r3: rättstavning och grammatik för svenska och medicinska termer (Sussa 3.1.3.10). Testnamnen står i
// src/sussa/runda10-r3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed } from '../src/db.js';
import * as st from '../src/stavning.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

const NU = new Date('2026-11-08T10:00:00Z');
let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const ord = (r, typ = 'stavning') => r.fel.filter(f => f.typ === typ).map(f => f.text);

describe('Rättstavning', () => {
  test('en felstavad medicinsk term får förslag ur den medicinska ordlistan, och vanliga ord och rätt stavade termer markeras inte', () => {
    const db = byggSeed(NU);
    const p = personal(db, 'lak-kard');
    const r = st.kontrollera(db, p, { text: 'Misstänkt pnemoni. Patienten har takykardi och ödem i underbenen, och förmaksflimer sedan i går. Ordineras metoprolool.' });
    expect(ord(r)).toEqual(['pnemoni', 'förmaksflimer', 'metoprolool']);
    const pn = r.fel.find(f => f.text === 'pnemoni');
    expect(pn.forslag[0]).toBe('pneumoni');
    expect(pn.forklaring).toContain('medicinsk term');
    expect(r.fel.find(f => f.text === 'förmaksflimer').forslag[0]).toBe('förmaksflimmer');
    expect(r.fel.find(f => f.text === 'metoprolool').forslag[0]).toBe('metoprolol');
    // Positionerna pekar på ordet i texten, så att gränssnittet kan byta ut just det.
    const text = 'Misstänkt pnemoni.';
    const r2 = st.kontrollera(db, p, { text });
    expect(text.slice(r2.fel[0].start, r2.fel[0].slut)).toBe('pnemoni');
    // Sammansatta ord och böjningar av termer känns igen.
    expect(st.kontrollera(db, p, { text: 'Blodtrycksmätningen visade hypertoni. Pneumonin har gått tillbaka. Ödemen minskar.' }).fel).toEqual([]);
    // Stor bokstav följer med i förslaget.
    expect(st.kontrollera(db, p, { text: 'Pnemoni i höger lunga.' }).fel[0].forslag[0]).toBe('Pneumoni');
  });

  test('grammatik: upprepade ord, stor bokstav efter punkt, mellanslag och särskrivning av medicinska termer', () => {
    const db = byggSeed(NU);
    const p = personal(db, 'lak-kard');
    const r = st.kontrollera(db, p, { text: 'Patienten har har feber. hon mår bättre ,men har ont. Högt blod tryck sedan t.ex. igår.  Ses igen.' });
    const g = r.fel.filter(f => f.typ === 'grammatik');
    expect(g.map(f => f.forklaring)).toEqual([
      expect.stringContaining('två gånger i rad'),
      expect.stringContaining('stor bokstav'),
      expect.stringContaining('mellanslag före'),
      expect.stringContaining('mellanslag efter'),
      expect.stringContaining('skrivs ihop'),
      expect.stringContaining('två mellanslag'),
    ]);
    expect(g.find(f => f.forklaring.includes('skrivs ihop')).forslag[0]).toBe('blodtryck');
    expect(g.find(f => f.forklaring.includes('två gånger')).forslag[0]).toBe('har');
    // En förkortning som t.ex. följs inte av stor bokstav, och decimaltal är inte fel.
    expect(st.kontrollera(db, p, { text: 'Ges t.ex. kl. 8. Kreatinin 2,5 och CRP 12.' }).fel).toEqual([]);
  });

  test('den personliga ordlistan: ett ord som personen lägger till markeras inte längre för personen, men för andra', () => {
    const db = byggSeed(NU);
    const lak = personal(db, 'lak-kard');
    const ssk = personal(db, 'ssk-kard');
    const text = 'Remitteras till hjärtrehab för ergometri med pnemonia.';
    expect(ord(st.kontrollera(db, lak, { text }))).toContain('pnemonia');
    st.laggTill(db, lak, { ord: 'pnemonia' });
    expect(ord(st.kontrollera(db, lak, { text }))).not.toContain('pnemonia');
    expect(ord(st.kontrollera(db, ssk, { text }))).toContain('pnemonia');
    expect(st.ordlista(db, lak).ord).toEqual(['pnemonia']);
    expect(fel(() => st.laggTill(db, lak, { ord: 'två ord' }))).toMatchObject({ status: 400 });
    st.taBort(db, lak, { ord: 'pnemonia' });
    expect(st.ordlista(db, lak).ord).toEqual([]);
  });

  test('engelska: medicinska termer på engelska kontrolleras när texten är på engelska', () => {
    const db = byggSeed(NU);
    const p = personal(db, 'lak-kard');
    const r = st.kontrollera(db, p, { text: 'Suspected pnemonia with tachycardia and atrial fibrilation.', sprak: 'en' });
    expect(ord(r)).toEqual(['pnemonia', 'fibrilation']);
    expect(r.fel[0].forslag[0]).toBe('pneumonia');
    expect(r.sprak).toBe('en');
    expect(fel(() => st.kontrollera(db, p, { text: 'x', sprak: 'de' }))).toMatchObject({ status: 400 });
  });

  test('ordlistan har källor och utgåvor: kodverken, läkemedelskatalogen och den medicinska ordlistan', () => {
    const db = byggSeed(NU);
    const o = st.ordlista(db, personal(db, 'lak-kard'));
    const namn = o.kallor.map(k => k.kalla);
    expect(namn).toEqual(expect.arrayContaining(['ICD-10-SE', 'KVÅ', 'Läkemedelskatalogen', 'Vårdkällans medicinska ordlista']));
    for (const k of o.kallor) expect(k.antal).toBeGreaterThan(0);
    expect(o.kallor.find(k => k.kalla === 'ICD-10-SE').utgava).toContain('2026');
  });

  test('API: kontrollen tar emot text utan att spara eller logga den, och kräver inloggning', async () => {
    const k = klient(app);
    expect((await k.post('/api/stavning', { text: 'pnemoni' })).status).toBe(401);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const fore = db.query('SELECT COUNT(*) n FROM atkomstlogg').get().n;
    const r = await k.post('/api/stavning', { text: 'Misstänkt pnemoni hos Tolvan Tolvansson.' });
    expect(r.status).toBe(200);
    expect(r.data.fel.map(f => f.text)).toContain('pnemoni');
    expect(db.query('SELECT COUNT(*) n FROM atkomstlogg').get().n).toBe(fore);
    expect(JSON.stringify(db.query("SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 5").all())).not.toContain('Tolvan');
    expect((await k.post('/api/stavning', { text: 'a'.repeat(8001) })).status).toBe(400);
    expect((await k.post('/api/stavning/ordlista', { ord: 'ergometri' })).status).toBe(201);
    expect((await k.get('/api/stavning/ordlista')).data.ord).toEqual(['ergometri']);
  });
});
