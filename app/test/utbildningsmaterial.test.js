// Runda 14, r5: utbildningsmaterialet per roll (Sussa 10.1.1.1 till 10.1.1.3, 11.2.1.11 och 11.2.1.12) och
// innovationsrummet (Sussa 2.6.1.1). Materialet skrivs ur registren i src/utbildningsmaterial.js med
// scripts/dokument-md.js. I Docker-bygget finns bara app/, och då prövas texten som skrivs men inte filerna i docs/.
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FLODEN } from '../src/klickbudget.js';
import { FILMER } from '../src/instruktionsfilmer.js';
import { OVNINGAR_V1 } from '../src/seed/ovningar.js';
import { TESTROLLER } from '../src/testinbjudan.js';
import * as material from '../src/utbildningsmaterial.js';
import { PERSONAL } from '../src/seed/personal.js';
import { prova, INTERN } from './sprakkontroll.js';

const APP = join(import.meta.dir, '..');
const ROT = join(APP, '..');
const KATALOG = join(ROT, 'docs', 'utbildning');

// Det som inte är löptext tas bort innan språkkontrollen: kodblock, text inom backticks och adresserna i länkar.
// Demopersonernas påhittade namn är egennamn och prövas inte heller.
const NAMN = PERSONAL.map(p => p.namn).sort((a, b) => b.length - a.length);
const lopText = (md) => NAMN.reduce((t, n) => t.split(n).join(' '), md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/\]\([^)\s]*\)/g, ']'));
const sprakfel = (filer) => prova(filer.flatMap(([fil, md]) => lopText(md).split('\n').map((text, i) => ({ fil, rad: i + 1, text }))))
  .map(f => `${f.fil}:${f.rad} ${f.regel}: ${f.ord}`);
// Ett avsnitt i markdown: texten från rubriken till nästa rubrik på samma nivå.
const avsnitt = (md, rubrik) => { const d = md.split('\n## ').find(s => s.startsWith(`${rubrik}\n`)); return d ?? ''; };

describe('Utbildningsmaterial', () => {
  test('varje yrkesroll med övningar har ett material, och invånaren har ett eget', () => {
    const medOvningar = [...new Set(OVNINGAR_V1.flatMap(o => o.roller))];
    expect(medOvningar.length).toBeGreaterThan(10);
    for (const y of medOvningar) {
      expect(material.ROLLER[y], y).toBeDefined();
      expect(material.ROLLER[y].beskrivning.length, y).toBeGreaterThan(80);
      expect(material.ROLLER[y].kunna.length, y).toBeGreaterThan(1);
      expect(material.materialFor(y)).toContain(`# Utbildning i Vårdkällan: ${material.rollnamn(y)}`);
    }
    expect(material.materialFor(material.INVANARE)).toContain('Min journal');
    const namn = material.filer().map(([f]) => f);
    for (const y of [...medOvningar, material.INVANARE]) expect(namn).toContain(material.filnamn(y));
    expect(namn).toContain('README.md');
    expect(() => material.materialFor('okand')).toThrow();
  });

  test('varje övning och varje instruktionsfilm för rollen finns med i rollens material, med rätt svar och förklaring', () => {
    for (const y of material.ordning()) {
      const md = material.materialFor(y);
      const d = material.delar(y);
      for (const o of OVNINGAR_V1.filter(x => x.roller.includes(y))) {
        expect(md, `${y} ${o.id}`).toContain(o.fraga);
        expect(md, `${y} ${o.id}`).toContain(`Rätt svar: ${o.alternativ.find(a => a.id === o.ratt).text}`);
        expect(md, `${y} ${o.id}`).toContain(o.forklaring);
      }
      for (const f of d.filmer) {
        expect(md, `${y} ${f.id}`).toContain(`### ${f.rubrik}`);
        expect(md, `${y} ${f.id}`).toContain(`](../filmer/${f.id}.webm)`);
        expect(md, `${y} ${f.id}`).toContain(f.beskrivning);
      }
      // Testinbjudans uppdrag för rollen finns med, utan facit för frågorna.
      for (const r of d.testroller) {
        expect(md).toContain(`### ${r.knapp}`);
        for (const u of r.uppdrag) if (u.rattText) expect(md, `${y} ${u.id}`).not.toContain(`Rätt svar: ${u.rattText}`);
      }
    }
    // Varje film och varje testroll hamnar hos någon roll.
    const allaFilmer = material.ordning().flatMap(y => material.delar(y).filmer.map(f => f.id));
    expect(allaFilmer.sort()).toEqual(material.filmerMedFlode().map(f => f.id).sort());
    expect(allaFilmer.length).toBeGreaterThan(5);
    const allaTestroller = material.ordning().flatMap(y => material.delar(y).testroller.map(r => r.id));
    expect(allaTestroller.sort()).toEqual(TESTROLLER.map(r => r.id).sort());
    // Läkaren har övningen om överkänslighet med länken till demon, eftersom läkaren når läkemedelsfliken.
    expect(material.materialFor('lakare')).toContain(`](${material.DEMO}/#/patient/p01/lakemedel)`);
  });

  test('varje arbetsflöde i materialet finns i klickbudgeten och görs av en demoroll med rollens yrke', () => {
    const perNamn = new Map(FLODEN.map(f => [f.namn, f]));
    let antal = 0;
    for (const y of material.ordning()) {
      const md = material.materialFor(y);
      const del = avsnitt(md, 'Vanliga arbetsflöden');
      const namn = del.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4));
      expect(namn.length, y).toBe(material.delar(y).floden.length);
      for (const n of namn) {
        const f = perNamn.get(n);
        expect(f, `${y}: ${n}`).toBeDefined();
        expect(material.yrkeFor(f.roll), `${y}: ${n}`).toBe(y);
        expect(del).toContain(`Klickbudget: högst ${f.budget} steg.`);
        antal++;
      }
    }
    // Alla flöden i klickbudgeten hamnar hos någon roll.
    expect(antal).toBe(FLODEN.length);
  });

  test('varje länk till en film pekar på en film i registret vars flöde finns i klickbudgeten, och filmerna behöver inte finnas på disk', () => {
    const id = new Set(FILMER.map(f => f.id));
    let lankar = 0;
    for (const [, md] of material.filer()) {
      for (const m of md.matchAll(/\]\(([^)]*\.webm)\)/g)) {
        const t = m[1].match(/^\.\.\/filmer\/([a-z0-9-]+)\.webm$/);
        expect(t, m[1]).not.toBeNull();
        expect(id.has(t[1]), m[1]).toBe(true);
        expect(FLODEN.some(f => f.id === FILMER.find(x => x.id === t[1]).flode), m[1]).toBe(true);
        lankar++;
      }
    }
    expect(lankar).toBe(material.filmerMedFlode().length);
  });

  test('texterna är på svenska utan engelska ord, tankstreck, ellipser och interna anteckningar', () => {
    const filer = material.filer();
    expect(sprakfel(filer)).toEqual([]);
    for (const [fil, md] of filer) {
      expect(md, fil).not.toMatch(/[\u2013\u2014\u2026]|\.\.\.(?!\/)/);
      expect(md, fil).not.toMatch(/\bprova\b/i);
      expect(md, fil).not.toMatch(INTERN);
    }
  });

  test('utbildningskonceptet tar upp e-utbildning, praktiska prov, filmer, lärarledd utbildning, superanvändare, utvärdering och hur materialet hålls aktuellt', () => {
    const md = material.index();
    for (const ord of ['E-utbildning', 'Praktiska prov', 'Instruktionsfilmer', 'Lärarledd utbildning', 'Superanvändare', '## Utbildningsplan', '## Utvärdering av utbildningen', '## Så hålls materialet aktuellt', 'nivå C1']) expect(md, ord).toContain(ord);
    expect(md).toContain('365 dagar');
    for (const y of material.ordning()) expect(md, y).toContain(`(${material.filnamn(y)})`);
  });

  test('filerna i docs/utbildning är exakt det som skrivs ur registren', () => {
    if (!existsSync(KATALOG)) return;
    const filer = material.filer();
    expect(readdirSync(KATALOG).sort()).toEqual(filer.map(([f]) => f).sort());
    for (const [namn, md] of filer) expect(readFileSync(join(KATALOG, namn), 'utf8'), namn).toBe(md);
  });
});

describe('Innovationsrum', () => {
  const INNOVATIONSRUM = join(ROT, 'docs', 'innovationsrum.md');
  const BIDRA = join(ROT, 'CONTRIBUTING.md');

  test('innovationsrummet tar upp dokumentation, utvecklarforum, utbildning, processer, rutiner och support', () => {
    if (!existsSync(INNOVATIONSRUM)) return;
    const md = readFileSync(INNOVATIONSRUM, 'utf8');
    for (const del of ['Dokumentation', 'Utvecklarforum', 'Utbildning', 'Processer', 'Rutiner', 'Support']) expect(md, del).toMatch(new RegExp(`^## .*${del}`, 'mi'));
    expect(md).toContain('2.6.1.1');
    // Det som dokumentet pekar på i repot finns.
    for (const f of ['app/src/api-andringar.js', 'app/src/api-forvaltning.js', 'app/src/tjanstekontrakt.js', 'docs/api-avvikelser.md', 'docs/design.md', 'docs/utbildning/', 'CONTRIBUTING.md']) {
      expect(md, f).toContain(f);
      if (!f.endsWith('/')) expect(existsSync(join(ROT, f)), f).toBe(true);
    }
  });

  test('CONTRIBUTING.md beskriver hur man bygger, kör, testar och bidrar under EUPL 1.2', () => {
    if (!existsSync(BIDRA)) return;
    const md = readFileSync(BIDRA, 'utf8');
    for (const t of ['docker build', 'scripts/kor-tester.js', '0 röda', 'test/klickbudget.cjs', 'test/mobil.cjs', 'EUPL 1.2', 'Skatteverket', 'säkerhetsbrist']) expect(md, t).toContain(t);
    for (const rubrik of ['Bygga', 'Testa', 'Bidra']) expect(md, rubrik).toMatch(new RegExp(`^## .*${rubrik}`, 'mi'));
  });

  test('innovationsrummet och CONTRIBUTING.md följer språkreglerna', () => {
    const filer = [INNOVATIONSRUM, BIDRA].filter(existsSync).map(f => [f, readFileSync(f, 'utf8')]);
    if (!filer.length) return;
    expect(sprakfel(filer)).toEqual([]);
    for (const [fil, md] of filer) {
      expect(md, fil).not.toMatch(/[\u2013\u2014\u2026]/);
      expect(md, fil).not.toMatch(/\bprova\b/i);
      expect(md, fil).not.toMatch(INTERN);
    }
  });
});
