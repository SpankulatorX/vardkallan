// Runda 10, r1: uppställningen av de mobila tillämpningarna per funktionellt krav i kapitel 3 och 4 (Sussa 2.3.1.3).
import { describe, test, expect } from 'bun:test';
import { MAPPNING, SPEC, sussaRegister } from '../src/sussa/index.js';
import { klickbudgetTest } from '../src/krav.js';
import { perKrav, LAGE, mobilaFloden } from '../src/mobil.js';

describe('Mobila tillämpningar', () => {
  test('varje funktionellt krav i kapitel 3 och 4 finns i uppställningen, med mobila flöden, skrivbordets flöden, vyer i 360 px eller som inte byggt', () => {
    const krav = perKrav(SPEC.poster, MAPPNING, klickbudgetTest);
    const kapitel = SPEC.poster.filter(p => ['3', '4'].includes(p.kapitel));
    expect(krav.map(k => k.id)).toEqual(kapitel.map(p => p.id));
    const mapp = new Map(MAPPNING.map(m => [m.id, m]));
    const mobila = new Set(mobilaFloden().filter(f => f.mobil).map(f => f.namn));
    for (const k of krav) {
      expect(Object.keys(LAGE)).toContain(k.lage);
      const m = mapp.get(k.id);
      const floden = (m?.tester ?? []).filter(t => t.startsWith('Gränssnitt > Klickbudget > '));
      if (k.lage === 'mobil') { expect(k.mobila.length).toBeGreaterThan(0); for (const n of k.mobila) expect(mobila.has(n)).toBe(true); }
      if (k.lage === 'skrivbord') expect([k.id, floden.length > 0, k.mobila.length]).toEqual([k.id, true, 0]);
      if (k.lage === 'vyer') expect([k.id, floden.length, (m?.tester ?? []).length > 0]).toEqual([k.id, 0, true]);
      if (k.lage === 'planerat') expect([k.id, !m?.tester?.length || m.avsedd === 'planerat']).toEqual([k.id, true]);
      if (k.lage !== 'mobil') expect(k.varfor).toBe(LAGE[k.lage]);
    }
    for (const l of Object.keys(LAGE)) expect([l, krav.some(k => k.lage === l)]).toEqual([l, true]);
    expect(sussaRegister(null).poster.find(p => p.id === '2.3.1.3').mobil.krav.length).toBe(kapitel.length);
  });
});
