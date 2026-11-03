import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { SPEC, AVSNITTSFILER, MAPPNING, KATEGORIER, AVSEDD, sussaRegister, sussaTester } from '../src/sussa/index.js';
import { testserver, klient } from './hjalp.js';

const resultat = (tester) => ({ tid: '2026-11-03T10:00:00Z', bun: '1.3.14', antal: tester.length, godkanda: 0, misslyckade: 0, tester });
const MAPPKATALOG = join(import.meta.dir, '..', 'src', 'sussa', 'mappning');

describe('Sussa-registret', () => {
  test('alla 305 id finns exakt en gång, och varje post har en mappning', () => {
    const id = SPEC.poster.map(p => p.id);
    expect(id.length).toBe(305);
    expect(new Set(id).size).toBe(305);
    const mappade = MAPPNING.map(m => m.id);
    expect(mappade.length).toBe(305);
    expect(new Set(mappade)).toEqual(new Set(id));
    // En fil per avsnitt med poster, och varje fil har just sitt avsnitts poster i dokumentets ordning.
    const avsnittMedPoster = [...new Set(SPEC.poster.map(p => p.avsnitt))];
    expect(Object.keys(AVSNITTSFILER).sort()).toEqual([...avsnittMedPoster].sort());
    expect(readdirSync(MAPPKATALOG).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort()).toEqual([...avsnittMedPoster].sort());
    for (const [avsnitt, poster] of Object.entries(AVSNITTSFILER)) {
      expect(poster.map(m => m.id)).toEqual(SPEC.poster.filter(p => p.avsnitt === avsnitt).map(p => p.id));
    }
    for (const p of SPEC.poster) {
      expect(['krav_vid_anbud', 'krav_vid_leverans', 'utvarderingskriterium']).toContain(p.typ);
      expect(p.kapitel).toBe(p.avsnitt.split('.')[0]);
      expect(p.id.startsWith(`${p.avsnitt}.`)).toBe(true);
      expect(SPEC.avsnitt.some(a => a.id === p.avsnitt)).toBe(true);
      expect(p.text.length).toBeGreaterThan(10);
      expect(Array.isArray(p.mervarden) && Array.isArray(p.kompletterar)).toBe(true);
    }
    // Kriterierna och kraven räknas som i utdraget: 50 krav vid anbud, 90 krav vid leverans och 165 utvärderingskriterier.
    const typ = (t) => SPEC.poster.filter(p => p.typ === t).length;
    expect([typ('krav_vid_anbud'), typ('krav_vid_leverans'), typ('utvarderingskriterium')]).toEqual([50, 90, 165]);
  });

  test('varje post har en giltig kategori', () => {
    expect(KATEGORIER).toEqual(['system', 'nationell', 'leverantor']);
    for (const m of MAPPNING) {
      expect({ id: m.id, kategori: KATEGORIER.includes(m.kategori) }).toEqual({ id: m.id, kategori: true });
      expect({ id: m.id, avsedd: AVSEDD.includes(m.avsedd) }).toEqual({ id: m.id, avsedd: true });
      expect(Array.isArray(m.egna) && Array.isArray(m.tester)).toBe(true);
      for (const e of m.egna) expect(e).toMatch(/^[KDLM]\d{1,2}$/);
      expect(typeof m.anmarkning === 'string' && m.anmarkning.length > 10).toBe(true);
      // En post som inte är planerad pekar på tester och beskriver Vårdkällans lösning.
      if (m.avsedd !== 'planerat') {
        expect({ id: m.id, tester: m.tester.length > 0 }).toEqual({ id: m.id, tester: true });
        expect({ id: m.id, losning: typeof m.losning === 'string' && m.losning.length > 10 }).toEqual({ id: m.id, losning: true });
      }
    }
    // Tjänstekontrakten i 2.2 kräver nationella tjänster, och kapitel 11 gäller leverantörens projekt.
    for (const m of AVSNITTSFILER['2.2']) expect(m.kategori).toBe('nationell');
    for (const a of ['11.1', '11.2', '11.3']) for (const m of AVSNITTSFILER[a]) expect(m.kategori).toBe('leverantor');
  });

  test('uppfyllt_demo kräver gröna tester', () => {
    const reg = [{ id: '9.9.9.1', kategori: 'system', egna: [], tester: ['A > a', 'A > b'], avsedd: 'uppfyllt_demo', expert: 'x', anmarkning: 'y' }];
    const poster = [{ id: '9.9.9.1', typ: 'krav_vid_leverans', rubrik: 'Test', avsnitt: '9.9', kapitel: '9', sida: 1, text: 'Text', mervarden: [], kompletterar: [] }];
    const gron = resultat([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'grön' }]);
    expect(sussaRegister(gron, null, { mappning: reg, poster }).poster[0].status).toBe('uppfyllt_demo');
    expect(sussaRegister(resultat([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'röd' }]), null, { mappning: reg, poster }).poster[0].status).toBe('delvis');
    const saknas = sussaRegister(resultat([{ namn: 'A > a', status: 'grön' }]), null, { mappning: reg, poster }).poster[0];
    expect(saknas.status).toBe('delvis');
    expect(saknas.tester).toEqual([{ namn: 'A > a', status: 'grön' }, { namn: 'A > b', status: 'saknas' }]);
    expect(sussaRegister(null, null, { mappning: reg, poster }).poster[0].status).toBe('delvis');
    // Ett inaktuellt test av gränssnittet räknas inte som grönt.
    const medKlient = [{ ...reg[0], tester: ['A > a', 'Gränssnitt > b'] }];
    expect(sussaRegister(resultat([{ namn: 'A > a', status: 'grön' }]), { tester: [{ namn: 'Gränssnitt > b', status: 'grön' }] }, { mappning: medKlient, poster }).poster[0].status).toBe('uppfyllt_demo');
    expect(sussaRegister(resultat([{ namn: 'A > a', status: 'grön' }]), { tester: [{ namn: 'Gränssnitt > b', status: 'inaktuell' }] }, { mappning: medKlient, poster }).poster[0].status).toBe('delvis');
    // En post utan tester är planerad, och en planerad post förblir planerad.
    expect(sussaRegister(gron, null, { mappning: [{ ...reg[0], tester: [] }], poster }).poster[0].status).toBe('planerat');
    expect(sussaRegister(gron, null, { mappning: [{ ...reg[0], avsedd: 'planerat' }], poster }).poster[0].status).toBe('planerat');
    // Utan testresultat kan inget i det riktiga registret vara uppfyllt.
    const r = sussaRegister(null);
    expect(r.summa.status.uppfyllt_demo).toBe(0);
    expect(r.summa.status.delvis + r.summa.status.planerat).toBe(305);
    expect(r.summa.kategori.system + r.summa.kategori.nationell + r.summa.kategori.leverantor).toBe(305);
    // Alla tester som registret pekar på finns, och de som avses vara uppfyllda blir det med gröna tester.
    const allaGrona = resultat(sussaTester().map(namn => ({ namn, status: 'grön' })));
    const fullt = sussaRegister(allaGrona);
    for (const p of fullt.poster) {
      const m = MAPPNING.find(x => x.id === p.id);
      expect({ id: p.id, status: p.status }).toEqual({ id: p.id, status: m.tester.length ? m.avsedd : 'planerat' });
    }
  });

  test('varje system-post med delvis eller uppfyllt_demo har en expert-text', () => {
    for (const m of MAPPNING) {
      if (m.kategori !== 'system' || m.avsedd === 'planerat') continue;
      expect({ id: m.id, expert: typeof m.expert === 'string' && m.expert.length > 20 }).toEqual({ id: m.id, expert: true });
      // En till två meningar.
      expect({ id: m.id, meningar: m.expert.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length <= 2 }).toEqual({ id: m.id, meningar: true });
    }
  });

  test('källan och de saknade kapitlen anges', () => {
    expect(SPEC.kalla).toBe('Kravspecifikation lösning, Framtidens vårdinformationsstöd, Sussa samverkan, dnr 16RS2022, utdrag i Konkurrensverkets dnr 883/2023 aktbilaga 3, utlämnad 2026-11-03');
    expect(SPEC.saknadeKapitel).toEqual(['7', '8', '9', '10', '12']);
    expect(SPEC.kapitel.map(k => k.nr)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    for (const k of SPEC.kapitel) expect(k.ingar).toBe(!SPEC.saknadeKapitel.includes(k.nr));
    expect(SPEC.utdrag).toContain('Kapitel 7 till 10 och 12 ingår inte i utdraget');
    expect(new Set(SPEC.poster.map(p => p.kapitel))).toEqual(new Set(['2', '3', '4', '5', '6', '11']));
    for (const a of SPEC.avsnitt) expect(typeof a.rubrik === 'string' && typeof a.sammanfattning === 'string' && a.sammanfattning.length > 20).toBe(true);
    const r = sussaRegister(null);
    expect(r.kalla).toBe(SPEC.kalla);
    expect(r.saknadeKapitel).toEqual(['7', '8', '9', '10', '12']);
    // Inga tankstreck eller ellipser i texterna som visas.
    const forbjudna = /[\u2014\u2013\u2026]/;
    expect(forbjudna.test(readFileSync(join(import.meta.dir, '..', 'src', 'sussa', 'kravspec.json'), 'utf8'))).toBe(false);
    for (const f of [...readdirSync(MAPPKATALOG).map(f => join(MAPPKATALOG, f)), join(import.meta.dir, '..', 'src', 'sussa', 'index.js')]) {
      expect({ fil: f, traff: forbjudna.test(readFileSync(f, 'utf8')) }).toEqual({ fil: f, traff: false });
    }
  });

  test('API: krav/sussa ger registret utan inloggning, med egna krav och testernas status', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-sussa-'));
    const fil = join(dir, 'test-resultat.json');
    writeFileSync(fil, JSON.stringify(resultat(sussaTester().map(namn => ({ namn, status: 'grön' })))));
    // Testerna av gränssnittet räknas här från samma fil, inte från Playwright-resultaten i app/.
    const app = testserver({ testresultat: fil, klientresultat: { klickbudget: join(dir, 'saknas.json'), klienttester: join(dir, 'saknas2.json') } });
    try {
      const r = await klient(app).get('/api/krav/sussa');
      expect(r.status).toBe(200);
      const d = r.data;
      expect(d.kalla).toBe(SPEC.kalla);
      expect(d.poster.length).toBe(305);
      expect(d.kapitel.find(k => k.nr === '7')).toMatchObject({ ingar: false });
      const p = d.poster.find(x => x.id === '3.5.2.6');
      expect(p).toMatchObject({ kapitel: '3', avsnitt: '3.5.2', kategori: 'system' });
      expect(p.text).toContain('ordinationsorsak');
      expect(p.egna.find(e => e.id === 'L7')).toMatchObject({ rubrik: expect.any(String), status: expect.any(String) });
      expect(p.tester.every(t => t.status === 'grön')).toBe(true);
      expect(d.summa.status.uppfyllt_demo + d.summa.status.delvis + d.summa.status.planerat).toBe(305);
      expect(d.summa.korstabell.nationell.planerat).toBeGreaterThan(0);
      expect(d.avsnitt.find(a => a.id === '3.5.2').rubrik).toBe('Process för läkemedelshantering');
    } finally { app.stopp(); rmSync(dir, { recursive: true }); }
  });
});
