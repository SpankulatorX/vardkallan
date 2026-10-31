import { describe, test, expect } from 'bun:test';
import { KRAV, kravregister } from '../src/krav.js';

const resultat = (tester) => ({ tid: '2026-10-31T10:00:00Z', bun: '1.3.14', antal: tester.length, godkanda: 0, misslyckade: 0, tester });

describe('Kravregistret', () => {
  test('alla krav K1 till K5, D1 till D12, L1 till L13 och M1 till M13 finns', () => {
    const id = KRAV.map(k => k.id);
    const vantade = [...[1, 2, 3, 4, 5].map(n => `K${n}`), ...Array.from({ length: 12 }, (_, i) => `D${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `L${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `M${i + 1}`)];
    expect(id).toEqual(vantade);
    for (const k of KRAV) {
      expect(['uppfyllt_demo', 'delvis', 'planerat']).toContain(k.status);
      expect(k.rubrik.length).toBeGreaterThan(5);
      if (k.status === 'uppfyllt_demo') expect(k.tester.length).toBeGreaterThan(0);
    }
    // Det som inte byggs i första versionen är planerat.
    for (const id of ['D4', 'D6', 'D12', 'L5', 'L8', 'L10', 'L11']) expect(KRAV.find(k => k.id === id).status).toBe('planerat');
  });

  test('status uppfyllt_demo bara när alla tester är gröna', () => {
    const reg = [{ id: 'X1', rubrik: 'Test', kalla: 'test', status: 'uppfyllt_demo', var: null, tester: ['A > a', 'A > b'] }];
    expect(kravregister(resultat([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'grön' }]), reg).krav[0].status).toBe('uppfyllt_demo');
    expect(kravregister(resultat([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'röd' }]), reg).krav[0].status).toBe('delvis');
  });

  test('saknade eller röda tester ger delvis', () => {
    const reg = [{ id: 'X1', rubrik: 'Test', kalla: 'test', status: 'uppfyllt_demo', var: null, tester: ['A > a', 'A > b'] }];
    const r = kravregister(resultat([{ namn: 'A > a', status: 'grön' }]), reg).krav[0];
    expect(r.status).toBe('delvis');
    expect(r.tester).toEqual([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'saknas' }]);
    expect(kravregister(null, reg).krav[0].status).toBe('delvis');
    expect(kravregister(null, reg).testresultat).toBeNull();
    const utanTester = [{ id: 'X2', rubrik: 'Test', kalla: 'test', status: 'uppfyllt_demo', var: null, tester: [] }];
    expect(kravregister(resultat([]), utanTester).krav[0].status).toBe('delvis');
  });

  test('planerade krav förblir planerade', () => {
    const reg = [{ id: 'X3', rubrik: 'Test', kalla: 'test', status: 'planerat', var: null, tester: ['A > a'] }];
    expect(kravregister(resultat([{ namn: 'A > a', status: 'grön' }]), reg).krav[0].status).toBe('planerat');
    const s = kravregister(null).summa;
    expect(s.uppfyllt_demo).toBe(0);
    expect(s.delvis + s.planerat).toBe(KRAV.length);
  });
});
