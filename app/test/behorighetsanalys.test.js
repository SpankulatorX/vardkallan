// Runda 12, r3: dokumenten som är kopplade till kraven (vårt L2 och D10, Sussa 11.2.1.5). Varje dokument skrivs ur ett
// register i src/ med scripts/dokument-md.js. I Docker-bygget finns bara app/, och då prövas texten som skrivs.
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROLLER, HANDLINGAR } from '../src/atkomst.js';
import * as behorighet from '../src/behorighetsanalys.js';
import * as mdr from '../src/mdr-bedomning.js';
import * as testmetod from '../src/testmetod.js';

const APP = join(import.meta.dir, '..');
const dokument = (namn) => join(APP, '..', 'docs', namn);
const somSkrivet = (namn, md) => { if (existsSync(dokument(namn))) expect(readFileSync(dokument(namn), 'utf8')).toBe(md); };

describe('Behörighetsanalys', () => {
  test('varje roll i behörighetsmotorn har en behovs- och riskanalys, och analysen säger samma sak som koden', () => {
    const roller = Object.keys(ROLLER);
    expect(roller.length).toBeGreaterThan(10);
    expect(Object.keys(behorighet.ANALYS).sort()).toEqual([...roller].sort());
    const md = behorighet.markdown();
    for (const roll of roller) {
      const a = behorighet.ANALYS[roll];
      for (const f of ['behov', 'risker', 'atgarder']) expect(a[f].length, `${roll} ${f}`).toBeGreaterThan(30);
      expect(a.inte.length, `${roll} får inte`).toBeGreaterThan(0);
      // En handling som analysen säger att rollen inte ska ha finns inte i koden, och är en handling som finns.
      for (const h of a.inte) { expect(Object.hasOwn(HANDLINGAR, h), h).toBe(true); expect(ROLLER[roll], `${roll} har ${h}`).not.toContain(h); }
      // Listan med handlingar i dokumentet är exakt rollens handlingar i koden.
      const rad = md.split('\n## ').find(s => s.startsWith(`${a.namn} (${roll})`)).split('\n').find(l => l.startsWith('Handlingar i koden'));
      expect([...rad.matchAll(/`(\w+)`/g)].map(x => x[1]).sort()).toEqual([...ROLLER[roll]].sort());
    }
    somSkrivet('behorighetsanalys.md', md);
  });
});

describe('MDR-bedömning', () => {
  test('varje beslutsstödsmodul har en bedömning enligt MDCG 2019-11 med alla steg, och slutsatsen och klassen följer av stegen', () => {
    for (const x of mdr.MODULER) {
      for (const f of x.filer) expect(mdr.finnsFil(f), f).toBe(true);
      for (const [k] of mdr.STEG) expect(typeof x.svar[k], `${x.id} ${k}`).toBe('boolean');
      if (mdr.arMdsw(x.svar)) expect(['I', 'IIa', 'IIb', 'III']).toContain(x.klass);
      else expect(x.klass).toBeNull();
      expect(x.motivering.length).toBeGreaterThan(40);
    }
    // Journalkärnan är inte en medicinteknisk produkt, och beslutsstödet för läkemedel, skalor och cytostatika är det.
    const id = (k) => mdr.MODULER.find(x => x.id === k);
    expect(mdr.arMdsw(id('journalkarna').svar)).toBe(false);
    for (const k of ['lakemedelsvarningar', 'lakemedelsregler', 'skalor', 'cytostatika', 'iva-larm']) expect(mdr.arMdsw(id(k).svar), k).toBe(true);
    expect(id('cytostatika').klass).toBe('IIb');
    const md = mdr.markdown();
    expect(md).toContain('Vårdkällans egen bedömning');
    expect(md).toContain('MDCG 2019-11');
    somSkrivet('mdr-bedomning.md', md);
  });

  test('modulerna som varningsreglerna och skalorna ligger i är bedömda', () => {
    const bedomda = new Set(mdr.MODULER.flatMap(x => x.filer));
    for (const f of ['src/lakemedel.js', 'src/lakemedelsregler.js', 'src/ordinationsmallar.js', 'src/skalor.js', 'src/kunskapsstod.js']) expect(bedomda.has(f), f).toBe(true);
  });
});

describe('Testmetod', () => {
  test('testmetoden beskrivs efter ISO/IEC/IEEE 29119-3 med testplan, testdesign, testfall, testprocedurer och testrapporter, och allt den pekar på finns', () => {
    const id = testmetod.DOKUMENT.map(x => x.id);
    for (const k of ['testplan', 'testdesign', 'testfall', 'testprocedur', 'testrapport']) expect(id).toContain(k);
    for (const x of testmetod.DOKUMENT) {
      expect(x.standard).toContain('29119-3');
      for (const f of x.filer) if (testmetod.provbar(f)) expect(testmetod.finns(f), f).toBe(true);
    }
    // Testfallen finns: servertesterna i app/test.
    expect(readdirSync(join(APP, 'test')).filter(f => f.endsWith('.test.js')).length).toBeGreaterThan(100);
    const md = testmetod.markdown();
    expect(md).toContain('ISO/IEC/IEEE 29119-3');
    somSkrivet('testmetod.md', md);
  });
});
