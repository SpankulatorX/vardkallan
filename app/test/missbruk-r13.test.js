// Missbruk från många anonyma besökare (runda 13, r2): allt som en besökare kan göra i stor mängd och som kostar minne,
// disk eller processor har ett tak per sandlåda och per adress, och taken gäller också när sandlådan har vilat på disk.
import { describe, test, expect } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';

// En anteckning med sex sökord och nästan 8 000 tecken under varje, under taket för en förfrågan.
const lang = { typ: 'Mottagningsanteckning', sokord: ['Kontaktorsak', 'Anamnes', 'Aktuellt', 'Status', 'Bedömning', 'Åtgärd'].map(sokord => ({ sokord, text: 'Lång text för prov av taket. '.repeat(270) })) };

describe('Missbruk från många besökare', () => {
  test('en sandlåda kan inte växa över taket för databasen, och anropet som skulle göra det får ett begripligt fel', async () => {
    const app = testserver({ maxSandladaMb: 4 });
    try {
      const k = klient(app);
      await k.logga('lak-kard');
      let r;
      for (let i = 0; i < 40; i++) {
        r = await k.post('/api/patient/p01/anteckningar', lang);
        if (r.status !== 201) break;
      }
      expect(r.status).toBe(507);
      expect(r.data.kod).toBe('sandlada_full');
      expect(r.data.fel).toContain('Sandlådan är full');
      const db = sandlada(app, k).db;
      expect(db.query('PRAGMA page_count').get().page_count * db.query('PRAGMA page_size').get().page_size).toBeLessThanOrEqual(4 * 1048576);
      // Taket gäller också efter att sandlådan har vilat.
      app.vila(sandlada(app, k));
      expect((await k.post('/api/patient/p01/anteckningar', lang)).status).toBe(507);
      // Läsningar fungerar som vanligt.
      expect((await k.get('/api/patient/p01/oversikt')).status).toBe(200);
    } finally { app.stopp(); }
  }, 30_000);

  test('anrop har en tidsbudget per sandlåda, som gäller också efter att sandlådan har vilat', async () => {
    // Budgeten är så stor att den andra besökarens inloggning och första anrop ryms också på en långsam maskin.
    const app = testserver({ tidsbudgetSandladaMs: 400, tidsbudgetAdressMs: 1e9 });
    try {
      const k = klient(app);
      await k.logga('lak-kard');
      let r;
      for (let i = 0; i < 2000; i++) { r = await k.get('/api/arbetslista'); if (r.status === 429) break; }
      expect(r.status).toBe(429);
      expect(r.data.kod).toBe('for_manga');
      expect(r.data.fel).toContain('den senaste minuten');
      app.vila(sandlada(app, k));
      expect((await k.get('/api/arbetslista')).status).toBe(429);
      // En annan besökare från samma adress påverkas inte av en sandlådas budget.
      const b = klient(app);
      await b.logga('lak-kard');
      expect((await b.get('/api/arbetslista')).status).toBe(200);
    } finally { app.stopp(); }
  }, 30_000);

  test('anrop har en tidsbudget per adress, som gäller för alla sandlådor från adressen', async () => {
    const app = testserver({ tidsbudgetSandladaMs: 1e9, tidsbudgetAdressMs: 60 });
    try {
      const a = klient(app);
      await a.logga('lak-kard');
      let r;
      for (let i = 0; i < 200; i++) { r = await a.get('/api/arbetslista'); if (r.status === 429) break; }
      expect(r.status).toBe(429);
      const b = klient(app);
      const rb = await b.post('/api/login', { personalId: 'lak-kard' });
      expect(rb.status).toBe(429);
      expect(rb.data.fel).toContain('din adress');
      // Hälsokontrollen svarar alltid.
      expect((await fetch(`${app.url}/api/health`)).status).toBe(200);
    } finally { app.stopp(); }
  }, 30_000);

  test('en adress kan inte hålla fler än taket av levande sandlådor', async () => {
    const app = testserver({ maxPerAdress: 3 });
    try {
      for (let i = 0; i < 3; i++) expect((await klient(app).get('/api/session')).status).toBe(200);
      const r = await klient(app).get('/api/session');
      expect(r.status).toBe(429);
      expect(r.data.fel).toContain('sandlådor från din adress');
      // Adressen sparas bara som HMAC i sessionen.
      for (const s of app.sessioner.values()) expect(s.adress).toMatch(/^[0-9a-f]{32}$/);
      // När en sandlåda försvinner blir platsen ledig.
      app.stadning(Date.now() + 2 * 3600_000);
      expect((await klient(app).get('/api/session')).status).toBe(200);
    } finally { app.stopp(); }
  });

  test('en uppblåst sandlåda tar fler platser i minnet, så att minnet håller sig inom budgeten', async () => {
    const app = testserver({ maxIMinnet: 4, maxSandladaMb: 64 });
    try {
      const a = klient(app);
      await a.logga('lak-kard');
      const s = sandlada(app, a);
      s.db.exec('CREATE TABLE prov_stor (x BLOB)');
      for (let i = 0; i < 20; i++) s.db.query('INSERT INTO prov_stor VALUES (randomblob(1048576))').run();
      // Anropet räknar sandlådans storlek.
      await a.get('/api/session');
      for (let i = 0; i < 3; i++) {
        await (klient(app)).logga('ssk-kard');
        expect(app.kapacitet().minneMb).toBeLessThanOrEqual(app.kapacitet().minnesbudgetMb);
      }
      // Den uppblåsta sandlådan fick vila för att ge plats, och när den kommer tillbaka får de andra vila.
      expect(s.vilar).toBe(true);
      expect((await a.get('/api/session')).data.inloggad).toBe(true);
      expect([...app.sessioner.values()].filter(x => !x.vilar).length).toBeLessThanOrEqual(2);
      expect(app.kapacitet().minneMb).toBeLessThanOrEqual(app.kapacitet().minnesbudgetMb);
    } finally { app.stopp(); }
  }, 30_000);
});
