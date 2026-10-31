import { test, expect } from 'bun:test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { FLODEN } from '../src/klickbudget.js';
import { KRAV, klickbudgetTest } from '../src/krav.js';

// klickbudget.json skrivs av test/klickbudget.cjs, som mäter flödena i Playwright. Här kontrolleras att filen har
// alla flöden, att budgetarna är de som står i koden (src/klickbudget.js) och att inget flöde ligger över budget.
test('Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden', () => {
  const kb = JSON.parse(readFileSync(join(import.meta.dir, '..', 'klickbudget.json'), 'utf8'));
  expect(kb.floden.map(f => f.id)).toEqual(FLODEN.map(f => f.id));
  for (const f of FLODEN) {
    const m = kb.floden.find(x => x.id === f.id);
    expect({ id: f.id, budget: m.budget, namn: m.namn }).toEqual({ id: f.id, budget: f.budget, namn: f.namn });
    expect(m.uppmatt).toBe(m.klick + m.faltbyten + m.tangenter);
    expect(m.uppmatt).toBeGreaterThan(0);
    expect({ id: f.id, inomBudget: m.uppmatt <= m.budget }).toEqual({ id: f.id, inomBudget: true });
    expect(kb.tester.find(t => t.namn === klickbudgetTest(f))?.status).toBe('grön');
  }
  expect(kb.gransnittHash).toMatch(/^[0-9a-f]{64}$/);
  // D6 pekar på ett test per flöde.
  expect(KRAV.find(k => k.id === 'D6').tester).toEqual(expect.arrayContaining(FLODEN.map(klickbudgetTest)));
});
