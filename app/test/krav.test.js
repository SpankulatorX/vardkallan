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
    // Det som inte byggs i första versionen är planerat. Klickbudgeten (D6) är byggd men delvis uppfylld, eftersom den
    // är mätt med skript och inte med användare. Läsläget vid avbrott med reservinloggning (D4) är uppfyllt i demon,
    // med SITHS-kortet simulerat och noten om det. Patientens e-tjänst (L4, L5) finns, men flerfaktorsautentiseringen
    // är simulerad och stickprov saknas.
    for (const id of ['D12', 'L8', 'L10', 'L11']) expect(KRAV.find(k => k.id === id).status).toBe('planerat');
    for (const id of ['D6', 'L4']) expect(KRAV.find(k => k.id === id).status).toBe('delvis');
    // Runda 12, r3: flerfaktorsinloggningen finns med passkeys och engångskoder, så L5 är uppfyllt i demon. Den första
    // faktorn är fortfarande simulerad, och det står i anmärkningen.
    expect(KRAV.find(k => k.id === 'L5').status).toBe('uppfyllt_demo');
    expect(KRAV.find(k => k.id === 'L5').anmarkning).toContain('simulerad');
    // K1 omfattar nu hela Sussas kravspecifikation med originalnummer, med Sussa-registrets tester.
    // Runda 7, r7: K2 kopplar varje post till Cambios svar men saknar leverantörens FVIS-kravlista, K3 och K5 är byggda.
    const [k1, k2, k3, k5] = ['K1', 'K2', 'K3', 'K5'].map(id => KRAV.find(k => k.id === id));
    // Runda 12: alla kapitel och driftspecifikationen finns, så K1 är uppfyllt.
    expect(k1.status).toBe('uppfyllt_demo');
    expect(k1.anmarkning).toContain('originalnummer finns nu för kapitel 1 till 12');
    expect(k1.anmarkning).toContain('originaldokument');
    expect(k1.tester.filter(t => t.startsWith('Sussa-registret > ')).length).toBeGreaterThanOrEqual(3);
    expect(k2.status).toBe('delvis');
    expect(k2.tester.filter(t => t.startsWith('Sussa-avtalet > ')).length).toBeGreaterThanOrEqual(3);
    expect(k2.anmarkning).toContain('bilaga A1');
    expect(k2.anmarkning).toContain('FVIS');
    expect(k3.status).toBe('uppfyllt_demo');
    expect(k3.anmarkning).toContain('Tilläggsavtal 3');
    expect(k5.status).toBe('uppfyllt_demo');
    expect(k5.tester.length).toBeGreaterThan(0);
    const d4 = KRAV.find(k => k.id === 'D4');
    expect(d4.status).toBe('uppfyllt_demo');
    expect(d4.anmarkning).toContain('Simulerat: SITHS-kortet och dess PIN-räknare');
    expect(d4.anmarkning).toContain('reservväg för inloggningen vid avbrott hos Inera är inte byggd');
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

  test('tester av gränssnittet räknas med, och inaktuella räknas inte som gröna', () => {
    const reg = [{ id: 'X4', rubrik: 'Test', kalla: 'test', status: 'uppfyllt_demo', var: null, tester: ['A > a', 'Gränssnitt > b'], bilaga: 'klickbudget' }];
    const bun = resultat([{ namn: 'A > a', status: 'grön' }]);
    const kb = { tid: '2026-10-31T10:00:00Z', floden: [], aktuell: true };
    const gron = kravregister(bun, reg, { tester: [{ namn: 'Gränssnitt > b', status: 'grön' }], klickbudget: kb }).krav[0];
    expect(gron.status).toBe('uppfyllt_demo');
    expect(gron.klickbudget).toEqual(kb);
    expect(kravregister(bun, reg, { tester: [{ namn: 'Gränssnitt > b', status: 'inaktuell' }] }).krav[0].status).toBe('delvis');
    expect(kravregister(bun, reg, null).krav[0]).toMatchObject({ status: 'delvis', klickbudget: null });
  });

  test('planerade krav förblir planerade', () => {
    const reg = [{ id: 'X3', rubrik: 'Test', kalla: 'test', status: 'planerat', var: null, tester: ['A > a'] }];
    expect(kravregister(resultat([{ namn: 'A > a', status: 'grön' }]), reg).krav[0].status).toBe('planerat');
    const s = kravregister(null).summa;
    expect(s.uppfyllt_demo).toBe(0);
    expect(s.delvis + s.planerat).toBe(KRAV.length);
  });
});

test('Kravregistret > tester av gränssnittet blir inaktuella när public/ har ändrats', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { gransnittHash, lasKlientresultat } = await import('../src/klientresultat.js');
  const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-klient-'));
  try {
    const pub = join(dir, 'public');
    mkdirSync(join(pub, 'js'), { recursive: true });
    writeFileSync(join(pub, 'index.html'), '<p>1</p>');
    writeFileSync(join(pub, 'js', 'a.js'), 'a');
    const hash = gransnittHash(pub);
    const kt = join(dir, 'kt.json');
    const kb = join(dir, 'kb.json');
    writeFileSync(kt, JSON.stringify({ tid: '2026-10-31T10:00:00Z', gransnittHash: hash, tester: [{ namn: 'Gränssnitt > x', status: 'grön' }] }));
    writeFileSync(kb, JSON.stringify({ tid: '2026-10-31T10:00:00Z', gransnittHash: hash, regler: 'r', floden: [], tester: [{ namn: 'Gränssnitt > Klickbudget > y', status: 'grön' }] }));
    const aktuell = lasKlientresultat({ klickbudget: kb, klienttester: kt, publicDir: pub });
    expect(aktuell.tester).toEqual([{ namn: 'Gränssnitt > x', status: 'grön' }, { namn: 'Gränssnitt > Klickbudget > y', status: 'grön' }]);
    expect(aktuell.klickbudget.aktuell).toBe(true);
    writeFileSync(join(pub, 'js', 'a.js'), 'b');
    const andrad = join(dir, 'public2');
    rmSync(andrad, { recursive: true, force: true });
    // En annan katalog räknas om; hashen för en katalog räknas en gång per process.
    mkdirSync(join(andrad, 'js'), { recursive: true });
    writeFileSync(join(andrad, 'index.html'), '<p>1</p>');
    writeFileSync(join(andrad, 'js', 'a.js'), 'b');
    const inaktuell = lasKlientresultat({ klickbudget: kb, klienttester: kt, publicDir: andrad });
    expect(inaktuell.tester.map(t => t.status)).toEqual(['inaktuell', 'inaktuell']);
    expect(inaktuell.klickbudget.aktuell).toBe(false);
    expect(lasKlientresultat({ klickbudget: join(dir, 'saknas.json'), klienttester: join(dir, 'saknas2.json'), publicDir: pub })).toMatchObject({ tester: [], klickbudget: null, klienttester: null });
  } finally { rmSync(dir, { recursive: true }); }
});
