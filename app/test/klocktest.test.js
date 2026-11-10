// Runda 11, r1: verktygen för att köra tester med falsk klocka. scripts/klocktest.js och test/falsk-klocka.js för
// servertesterna, src/testklocka.js för testcontainern som gränssnittstesterna körs mot.
import { describe, test, expect, setSystemTime, afterEach } from 'bun:test';
import { join } from 'node:path';
import { FALSK_NU, aterstallKlockan } from './falsk-klocka.js';
import { TIDER, URVAL } from '../scripts/klocktest.js';
import { testserver, klient } from './hjalp.js';

const rot = join(import.meta.dir, '..');
afterEach(() => aterstallKlockan());

describe('Klocktest (runda 11, r1)', () => {
  test('tiderna i klocktestet är de svenska klockslag de säger sig vara', () => {
    const tid = (namn) => TIDER.find(t => t.namn === namn).nu;
    // Vintertid: svensk tid är UTC plus en timme, så 00.30 svensk tid är föregående dag i UTC.
    expect(tid('vardag-0030')).toBe('2026-11-11T23:30:00.000Z');
    expect(tid('vardag-2330')).toBe('2026-11-12T22:30:00.000Z');
    expect(tid('nyarsdagen-0030')).toBe('2026-12-31T23:30:00.000Z');
    expect(tid('skottdag-0030')).toBe('2028-02-28T23:30:00.000Z');
    // Sommartid börjar 28 mars 2027 klockan 02.00 (01.00 UTC): 01.30 är vintertid, 03.30 är sommartid.
    expect(tid('sommartid-fore')).toBe('2027-03-28T00:30:00.000Z');
    expect(tid('sommartid-efter')).toBe('2027-03-28T01:30:00.000Z');
    // Vintertid börjar 25 oktober 2026 klockan 03.00 sommartid (01.00 UTC).
    expect(tid('vintertid-fore')).toBe('2026-10-24T23:30:00.000Z');
    expect(tid('vintertid-efter')).toBe('2026-10-25T02:30:00.000Z');
    for (const t of TIDER) expect(new Date(t.nu).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Alla klockslag som briefen kräver finns en vardag och en söndag, och urvalet finns bland tiderna.
    for (const d of ['vardag', 'sondag']) for (const k of ['2330', '0030', '0115', '0230', '0500', '1200', '2159']) expect(TIDER.some(t => t.namn === `${d}-${k}`)).toBe(true);
    for (const n of URVAL) expect(TIDER.some(t => t.namn === n)).toBe(true);
    expect(new Set(TIDER.map(t => t.namn)).size).toBe(TIDER.length);
  });

  test('aterstallKlockan återställer till den falska tiden när en sådan är satt, annars till den verkliga', () => {
    setSystemTime(new Date('2030-01-01T12:00:00Z'));
    aterstallKlockan();
    if (FALSK_NU) expect(Date.now()).toBe(FALSK_NU.getTime());
    else expect(new Date().getUTCFullYear()).toBeLessThan(2030);
  });
});

// Kör en liten Bun-process med de givna miljövariablerna och läser vad den ser för klocka.
function kor(env) {
  const kod = "const { TESTKLOCKA } = await import('./src/testklocka.js'); const d = new Date();"
    + " console.log(JSON.stringify({ klocka: TESTKLOCKA, nu: d.toISOString(), now: Date.now(), noll: new Date(0).toISOString(),"
    + " text: typeof Date(), ar: d instanceof Date, utc: Date.UTC(2026, 0, 1), tolkad: Date.parse('2026-01-01T00:00:00Z') }));";
  const ren = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VARDKALLAN_') && k !== 'SESSION_FIL' && k !== 'LITA_PA_PROXY'));
  const p = Bun.spawnSync(['bun', '-e', kod], { cwd: rot, env: { ...ren, ...env }, stdout: 'pipe', stderr: 'pipe' });
  return { kod: p.exitCode, ut: p.stdout.toString(), fel: p.stderr.toString() };
}

describe('Testcontainerns falska klocka (runda 11, r1)', () => {
  test('utan testflaggan läses VARDKALLAN_FALSK_NU inte, och klockan är den verkliga', () => {
    const r = kor({ VARDKALLAN_FALSK_NU: '2026-11-12T22:30:00Z' });
    expect(r.kod).toBe(0);
    const v = JSON.parse(r.ut.trim().split('\n').pop());
    expect(v.klocka).toBeNull();
    expect(v.nu.startsWith('2026-11-12T22:3')).toBe(false);
  });

  test('med testflaggan visar klockan den falska tiden och går sedan vidare, och Date fungerar som vanligt', () => {
    const r = kor({ VARDKALLAN_TESTKLOCKA: '1', VARDKALLAN_FALSK_NU: '2026-11-12T22:30:00Z' });
    expect(r.kod).toBe(0);
    const v = JSON.parse(r.ut.trim().split('\n').pop());
    expect(v.klocka.start).toBe('2026-11-12T22:30:00Z');
    const nu = Date.parse(v.nu);
    expect(nu).toBeGreaterThanOrEqual(Date.parse('2026-11-12T22:30:00Z'));
    expect(nu).toBeLessThan(Date.parse('2026-11-12T22:31:00Z'));
    expect(Math.abs(v.now - nu)).toBeLessThan(1000);
    expect(v.noll).toBe('1970-01-01T00:00:00.000Z');
    expect(v.text).toBe('string');
    expect(v.ar).toBe(true);
    expect(v.utc).toBe(Date.UTC(2026, 0, 1));
    expect(v.tolkad).toBe(Date.UTC(2026, 0, 1));
  });

  test('den falska klockan stoppar servern i stället för att gälla i driften (SESSION_FIL eller LITA_PA_PROXY)', () => {
    for (const drift of [{ SESSION_FIL: '/data/sessioner.json' }, { LITA_PA_PROXY: '1' }]) {
      const r = kor({ VARDKALLAN_TESTKLOCKA: '1', VARDKALLAN_FALSK_NU: '2026-11-12T22:30:00Z', ...drift });
      expect(r.kod).not.toBe(0);
      expect(r.fel).toContain('bara användas i en testcontainer');
    }
  });

  test('en falsk tid som inte går att tolka stoppar servern', () => {
    const r = kor({ VARDKALLAN_TESTKLOCKA: '1', VARDKALLAN_FALSK_NU: 'i morgon' });
    expect(r.kod).not.toBe(0);
    expect(r.fel).toContain('går inte att tolka');
  });

  test('/api/health visar ingen testklocka när flaggan inte är satt', async () => {
    const app = testserver();
    try {
      const h = await klient(app).get('/api/health');
      expect(h.status).toBe(200);
      expect(h.data).not.toHaveProperty('testklocka');
    } finally { app.stopp(); }
  });
});
