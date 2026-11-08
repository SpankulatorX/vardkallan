// Runda 9, r6: systemuppbyggnaden (Sussa 2.1.1.1). Förteckningen över moduler med tillverkare kopplad till kraven, de
// fem perspektiven, en lastmätning med många samtidiga användare och totalkostnaden ur mätningen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { testserver, klient } from './hjalp.js';
import { moduler, PERSPEKTIV, KOMPONENTER, totalkostnad, ANTAGANDEN } from '../src/arkitektur.js';
import { SPEC, MAPPNING } from '../src/sussa/index.js';

const APP = join(import.meta.dir, '..');
let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const allaJs = (under) => readdirSync(join(APP, under)).sort().flatMap((n) => {
  const v = `${under}/${n}`;
  return statSync(join(APP, v)).isDirectory() ? allaJs(v) : n.endsWith('.js') ? [v] : [];
});

// Lasten: så många samtidiga användare, och den gräns som p95 för de vanliga läsningarna ska hålla sig under.
const LAST = { samtidiga: 20, anrop: 10, p95GransMs: 500 };

describe('Systemuppbyggnad', () => {
  test('förteckningen har varje modul i src och public med skikt, tillverkare, beskrivning och kraven den stödjer', () => {
    const m = moduler();
    expect(m.map(x => x.modul).sort()).toEqual([...allaJs('src'), ...allaJs('public')].sort());
    for (const x of m) {
      expect([x.modul, x.beskrivning.length > 15]).toEqual([x.modul, true]);
      expect(x.tillverkare).toContain('Vårdkällan');
      expect(x.skikt.length).toBeGreaterThan(3);
    }
    const kanda = new Set(SPEC.poster.map(p => p.id));
    expect(m.flatMap(x => x.krav).every(id => kanda.has(id))).toBe(true);
    // Modulerna är kopplade till kraven: varje post i registret som inte är planerad och vars lösning nämner en fil
    // finns hos den modulen.
    const per = new Map(m.map(x => [x.modul.split('/').pop(), x]));
    for (const p of MAPPNING.filter(x => x.avsedd !== 'planerat')) {
      for (const f of (p.losning ?? '').match(/[\w-]+\.js/g) ?? []) if (per.has(f)) expect([f, per.get(f).krav.includes(p.id)]).toEqual([f, true]);
    }
    expect(m.filter(x => x.krav.length).length).toBeGreaterThan(20);
    // Komponenterna från andra tillverkare har namn, tillverkare och användning.
    for (const k of KOMPONENTER) expect(Object.values(k).every(v => typeof v === 'string' && v.length > 2)).toBe(true);
  });

  test('de fem perspektiven i kravtexten finns och pekar på moduler som finns', () => {
    expect(PERSPEKTIV.map(p => p.id)).toEqual(['kontextuell', 'konceptuell', 'logisk', 'fysisk', 'moduler']);
    const finns = new Set(moduler().map(x => x.modul));
    for (const p of PERSPEKTIV) {
      expect(p.text.length).toBeGreaterThan(80);
      for (const mod of p.moduler) expect([p.id, mod, finns.has(mod) || existsSync(join(APP, mod))]).toEqual([p.id, mod, true]);
    }
  });

  test(`lastmätning: ${LAST.samtidiga} samtidiga användare med var sin sandlåda läser journalen med p95 under ${LAST.p95GransMs} ms`, async () => {
    const roller = ['lak-kard', 'ssk-kard', 'usk-kard', 'adm-kard', 'lak-vc'];
    const anvandare = await Promise.all(Array.from({ length: LAST.samtidiga }, async (_, i) => { const k = klient(app); await k.logga(roller[i % roller.length]); return k; }));
    const vagar = ['/api/arbetslista', '/api/patient/p01/oversikt', '/api/patient/p01/lakemedel', '/api/patient/p01/anteckningar', '/fhir/Observation?patient=p01'];
    const tider = [];
    await Promise.all(anvandare.map(async (k, i) => {
      for (let n = 0; n < LAST.anrop; n++) {
        const v = vagar[(i + n) % vagar.length];
        const t0 = performance.now();
        const r = await k.get(v);
        tider.push(performance.now() - t0);
        expect([v, r.status < 500]).toEqual([v, true]);
      }
    }));
    tider.sort((a, b) => a - b);
    const p95 = tider[Math.ceil(0.95 * tider.length) - 1];
    expect(tider.length).toBe(LAST.samtidiga * LAST.anrop);
    expect(p95).toBeLessThan(LAST.p95GransMs);
    // Servern räknar själv totalkostnaden ur sitt minne och sina sandlådor.
    const a = (await klient(app).get('/api/arkitektur')).data;
    expect(a.totalkostnad.matning.sandladar).toBeGreaterThanOrEqual(LAST.samtidiga);
    expect(a.totalkostnad.matning.mbPerSandlada).toBeGreaterThan(0);
    expect(a.totalkostnad.krPerAnvandareOchManad).toBeGreaterThan(0);
  }, 60000);

  test('totalkostnaden räknas ur mätningen och antagandena, och antagandena står i svaret', async () => {
    const t = totalkostnad({ mbPerSandlada: 8, p95Ms: 40 });
    // 8 GB med hälften i reserv räcker till 512 samtidiga, och 30 procent samtidiga ger 1 706 anställda per server.
    expect(t).toMatchObject({ samtidigaPerServer: 512, anstalldaPerServer: 1706, krPerServerOchManad: 1500 + 8 * 900, licens: 0 });
    expect(t.krPerAnvandareOchManad).toBe(Math.round((8700 / 1706) * 100) / 100);
    expect(totalkostnad(null)).toBeNull();
    expect(ANTAGANDEN.text).toContain('Licenskostnad finns inte');
    const r = await klient(app).get('/api/arkitektur');
    expect(r.status).toBe(200);
    expect(r.data.perspektiv.length).toBe(5);
    expect(r.data.antaganden.serverKrPerManad).toBe(ANTAGANDEN.serverKrPerManad);
    expect(r.data.moduler.length).toBe(moduler().length);
    expect(JSON.stringify(r.data)).not.toMatch(/\b\d{8}-?\d{4}\b/);
  });
});
