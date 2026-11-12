// Runda 14, r4 (Sussa 11.2.1.7): testprotokollet med spårbarhet från varje krav till dess testfall, med resultat, datum
// och vilken byggd version det gäller. Protokollet räknas ur kravregistret, Sussa-registret och testresultaten.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { KRAV } from '../src/krav.js';
import { MAPPNING } from '../src/sussa/index.js';
import * as tp from '../src/testprotokoll.js';
import { testserver, klient } from './hjalp.js';

const APP = join(import.meta.dir, '..');
const TID = '2026-11-12T09:00:00.000Z';
// Ett resultat där alla tester som registren pekar på är gröna, utom de som testet ändrar.
const allaTester = [...new Set([...KRAV.flatMap(k => k.tester), ...MAPPNING.flatMap(m => m.tester)])];
const resultat = (andra = {}) => ({ tid: TID, bun: '1.3.14', antal: allaTester.length, godkanda: 0, misslyckade: 0,
  tester: allaTester.filter(n => !n.startsWith('Gränssnitt > ') && andra[n] !== 'saknas').map(namn => ({ namn, status: andra[namn] ?? 'grön' })) });
const klientUt = (status = 'grön') => ({ tester: allaTester.filter(n => n.startsWith('Gränssnitt > ')).map(namn => ({ namn, status })) });

describe('Testprotokoll', () => {
  test('varje krav och varje Sussa-post med tester finns med sina testfall, resultat, datum och version', () => {
    const kallor = new Map(klientUt().tester.map(t => [t.namn, { kalla: 'Gränssnittstest i webbläsaren', tid: TID }]));
    const p = tp.protokoll({ resultat: resultat(), klient: klientUt(), kallor, version: '1.4.0', kodhash: 'a'.repeat(64) });
    expect(p.version).toMatchObject({ app: '1.4.0', kodhash: 'a'.repeat(64), kort: 'aaaaaaaaaaaa', testkorning: TID });
    const egna = KRAV.filter(k => k.tester.length);
    const sussa = MAPPNING.filter(m => m.tester.length);
    expect(p.egna.map(k => k.id)).toEqual(egna.map(k => k.id));
    expect(p.sussa.map(k => k.id).sort()).toEqual(sussa.map(m => m.id).sort());
    // Varje testfall i registret finns i protokollet, med resultat och när det kördes.
    for (const k of [...p.egna, ...p.sussa]) {
      expect(k.rubrik.length).toBeGreaterThan(3);
      expect(k.testfall.length).toBeGreaterThan(0);
      for (const t of k.testfall) {
        expect(t.status).toBe('grön');
        expect(t.tid).toBe(TID);
        expect(['Servertest', 'Gränssnittstest i webbläsaren']).toContain(t.kalla);
      }
    }
    const sussa1127 = p.sussa.find(k => k.id === '11.2.1.7');
    expect(sussa1127.testfall.map(t => t.namn)).toEqual(MAPPNING.find(m => m.id === '11.2.1.7').tester);
    // Krav utan testfall räknas upp för sig, så att spårbarheten är hel.
    expect(p.utanTestfall.egna.map(k => k.id)).toEqual(KRAV.filter(k => !k.tester.length).map(k => k.id));
    expect(p.utanTestfall.sussa.length + p.sussa.length).toBe(389);
  });

  test('ett test som saknas, är rött eller inaktuellt syns som det, och summan räknas ur testfallen', () => {
    const [ett, tva] = MAPPNING.find(m => m.id === '11.2.1.7').tester;
    const p = tp.protokoll({ resultat: resultat({ [ett]: 'röd', [tva]: 'saknas' }), klient: klientUt('inaktuell'), version: '1.4.0', kodhash: 'b'.repeat(64) });
    const post = p.sussa.find(k => k.id === '11.2.1.7');
    expect(post.testfall.find(t => t.namn === ett).status).toBe('röd');
    const saknat = post.testfall.find(t => t.namn === tva);
    expect(saknat).toMatchObject({ status: 'saknas', tid: null, kalla: null });
    expect(post.resultat).toBe('ej_godkant');
    const gr = p.sussa.flatMap(k => k.testfall).find(t => t.namn.startsWith('Gränssnitt > '));
    expect(gr.status).toBe('inaktuell');
    const alla = [...p.egna, ...p.sussa].flatMap(k => k.testfall);
    expect(p.summa.testfall).toBe(alla.length);
    for (const s of ['grön', 'röd', 'saknas', 'inaktuell']) expect(p.summa.status[s]).toBe(alla.filter(t => t.status === s).length);
    expect(p.summa.krav).toBe(p.egna.length + p.sussa.length);
    expect(p.summa.godkanda).toBe([...p.egna, ...p.sussa].filter(k => k.resultat === 'godkant').length);
    // Utan testresultat säger protokollet det och räknar varje testfall som saknat.
    const tomt = tp.protokoll({ resultat: null, klient: null, version: '1.4.0', kodhash: null });
    expect(tomt.version.testkorning).toBeNull();
    expect(tomt.summa.status['grön']).toBe(0);
    expect(tomt.summa.status.saknas).toBe(tomt.summa.testfall);
  });

  test('protokollet säger att inget acceptanstest med en beställare är gjort, också i markdown', () => {
    const p = tp.protokoll({ resultat: resultat(), klient: klientUt(), version: '1.4.0', kodhash: 'c'.repeat(64) });
    expect(p.acceptanstest.gjort).toBe(false);
    expect(p.acceptanstest.text).toContain('Inget acceptanstest');
    const md = tp.markdown(p);
    expect(md).toStartWith('# Testprotokoll');
    expect(md).toContain(p.acceptanstest.text);
    expect(md).toContain('Version 1.4.0');
    expect(md).toContain('cccccccccccc');
    for (const k of [...p.egna, ...p.sussa]) expect(md).toContain(`### ${k.id} `);
    for (const t of p.sussa.find(k => k.id === '11.2.1.7').testfall) expect(md).toContain(t.namn);
    expect(md).not.toMatch(/[–—…]/);
  });

  test('källan och datumet för varje testfall kommer från filen som testet kördes i', () => {
    const rot = join(APP, '.testtmp-r4-protokoll');
    rmSync(rot, { recursive: true, force: true });
    mkdirSync(rot, { recursive: true });
    const klickTest = 'Gränssnitt > Klickbudget > Exempel inom budget';
    const avbrottTest = 'Gränssnitt > Avbrott > exempel';
    writeFileSync(join(rot, 'klickbudget.json'), JSON.stringify({ tid: '2026-11-11T10:00:00Z', tester: [{ namn: klickTest, status: 'grön' }] }));
    writeFileSync(join(rot, 'klienttest-resultat.json'), JSON.stringify({ tid: '2026-11-11T11:00:00Z', tester: [{ namn: avbrottTest, status: 'grön' }] }));
    try {
      const kallor = tp.testkallor({ klickbudget: join(rot, 'klickbudget.json'), klienttester: join(rot, 'klienttest-resultat.json'), sussatestfall: join(rot, 'saknas.json') });
      expect(kallor.get(klickTest)).toEqual({ kalla: 'Klickbudget i webbläsaren', tid: '2026-11-11T10:00:00Z' });
      expect(kallor.get(avbrottTest)).toEqual({ kalla: 'Gränssnittstest i webbläsaren', tid: '2026-11-11T11:00:00Z' });
    } finally { rmSync(rot, { recursive: true, force: true }); }
  });

  test('docs/testprotokoll.md är skrivet av skriptet med version, kodhash och acceptanstestet', () => {
    const fil = join(APP, '..', 'docs', 'testprotokoll.md');
    if (!existsSync(join(APP, '..', 'docs'))) return;
    const md = readFileSync(fil, 'utf8');
    expect(md).toStartWith('# Testprotokoll');
    expect(md).toContain(tp.ACCEPTANSTEST);
    expect(md).toMatch(/Version \d+\.\d+\.\d+, kod [0-9a-f]{12}/);
    expect(md).toContain('### 11.2.1.7 ');
  });
});

describe('Testprotokoll i API:t', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());
  test('GET /api/krav/testprotokoll är öppen utan inloggning och skapar ingen sandlåda', async () => {
    const fore = app.sessioner.size;
    const r = await klient(app).get('/api/krav/testprotokoll');
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(app.sessioner.size).toBe(fore);
    expect(r.data.acceptanstest.gjort).toBe(false);
    expect(r.data.version.app).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.data.version.kodhash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.data.sussa.some(k => k.id === '11.2.1.7')).toBe(true);
    expect(r.data.egna.some(k => k.id === 'K1')).toBe(true);
  }, 30_000);
});
