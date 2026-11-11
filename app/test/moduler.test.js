// Runda 11, r8: modulregistret (src/moduler.js) och GET /api/moduler. Testerna gör att registret inte kan bli fel:
// varje rutt, flik och vy hör till en modul, varje sak som registret pekar på finns, statusen räknas ur koden, och en
// text om en modul som finns säger aldrig att den inte är byggd.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testserver, klient } from './hjalp.js';
import { MODULER, UTAN_MODUL, OMRADEN, FORBJUDNA, lasGransnitt, modulregister, ruttFinns, exempel, traffar } from '../src/moduler.js';
import { SPEC, MAPPNING, sussaRegister } from '../src/sussa/index.js';
import { PRINCIP, villkor10 } from '../src/version.js';

const APP = join(import.meta.dir, '..');
const g = lasGransnitt();
const register = sussaRegister(null, null);
const allaRutter = (mod) => [...mod.rutter, ...mod.journal.map(f => `#/patient/:id/${f}`), ...mod.min.map(f => `#/min/:id/${f}`)];

let app;
let svar;
beforeAll(async () => {
  app = testserver();
  svar = await klient(app).get('/api/moduler');
});
afterAll(() => app.stopp());

describe('Modulregistret', () => {
  test('varje modul har id, namn, område, beskrivning och giltiga Sussa-avsnitt', () => {
    const ids = MODULER.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kanda = new Set([...SPEC.avsnitt.map(a => a.id), ...SPEC.poster.map(p => p.id)]);
    for (const m of MODULER) {
      expect(m.namn.length).toBeGreaterThan(3);
      expect(m.beskrivning.length).toBeGreaterThan(40);
      expect(OMRADEN.map(o => o[0])).toContain(m.omrade);
      for (const a of m.avsnitt) expect(kanda.has(a)).toBe(true);
    }
  });

  test('varje rutt i app.js hör till en modul eller står i listan med motivering', () => {
    expect(g.rutter.length).toBeGreaterThan(40);
    const utan = Object.keys(UTAN_MODUL.rutter);
    for (const r of g.rutter) {
      const hor = MODULER.some(m => m.rutter.some(v => r.re.test(exempel(v)))) || utan.some(v => r.re.test(exempel(v)));
      if (!hor) throw new Error(`Rutten ${r.monster} i app.js hör inte till någon modul i src/moduler.js`);
    }
  });

  test('varje flik i journalen och i Min journal hör till en modul', () => {
    expect(g.journal.size).toBeGreaterThan(10);
    expect(g.min.size).toBeGreaterThan(5);
    // Flikar som bara nås från något annat visas inte som flikar på modulsidan.
    expect([...g.dolda].sort()).toEqual(['sok', 'utbildningslage']);
    for (const f of g.journal.keys()) if (!MODULER.some(m => m.journal.includes(f))) throw new Error(`Fliken ${f} i journalen hör inte till någon modul`);
    for (const f of g.min.keys()) if (!MODULER.some(m => m.min.includes(f))) throw new Error(`Fliken ${f} i Min journal hör inte till någon modul`);
  });

  test('varje rutt och flik i registret finns i gränssnittet', () => {
    for (const m of MODULER) {
      for (const v of m.rutter) if (!ruttFinns(g, v)) throw new Error(`${m.id}: rutten ${v} finns inte i app.js`);
      for (const f of m.journal) if (!g.journal.has(f)) throw new Error(`${m.id}: fliken ${f} finns inte i journalen`);
      for (const f of m.min) if (!g.min.has(f)) throw new Error(`${m.id}: fliken ${f} finns inte i Min journal`);
      for (const v of allaRutter(m)) expect(v).toMatch(/^#\/[a-z]/);
    }
    for (const v of Object.keys(UTAN_MODUL.rutter)) expect(ruttFinns(g, v)).toBe(true);
  });

  test('varje vy i public/js/vyer hör till en modul, och varje vy och fil i registret finns', () => {
    expect(g.vyer.length).toBeGreaterThan(50);
    for (const f of g.vyer) if (!MODULER.some(m => m.vyer.includes(f)) && !UTAN_MODUL.vyer[f]) throw new Error(`Vyn ${f} hör inte till någon modul`);
    for (const m of MODULER) {
      for (const f of m.vyer) if (!g.vyer.includes(f)) throw new Error(`${m.id}: vyn ${f} finns inte`);
      for (const f of m.kod) if (!svar.data.moduler.find(x => x.id === m.id).kod.find(k => k.fil === f).finns) throw new Error(`${m.id}: filen ${f} finns inte`);
    }
    for (const [f, motivering] of Object.entries(UTAN_MODUL.vyer)) { expect(g.vyer).toContain(f); expect(motivering.length).toBeGreaterThan(20); }
  });

  test('varje rutt i API:t som registret nämner finns i servern', () => {
    expect(svar.status).toBe(200);
    const saknas = svar.data.moduler.flatMap(m => m.api.filter(a => !a.finns).map(a => `${m.id}: ${a.vag}`));
    expect(saknas.join("; ")).toBe("");
  });

  test('varje post i kategorin system hör till minst en modul', () => {
    const kategori = new Map(MAPPNING.map(x => [x.id, x.kategori]));
    for (const p of SPEC.poster) {
      if ((kategori.get(p.id) ?? 'system') !== 'system') continue;
      if (!MODULER.some(m => m.avsnitt.some(a => traffar(a, p.id)))) throw new Error(`Posten ${p.id} ${p.rubrik} hör inte till någon modul`);
    }
  });

  test('en modul med kod eller rutter visas aldrig som planerad, och en planerad modul har inga uppfyllda poster', () => {
    const r = modulregister({ register, apiFinns: () => true });
    for (const m of r.moduler) {
      const harNagot = MODULER.find(x => x.id === m.id);
      if (harNagot.rutter.length || harNagot.journal.length || harNagot.min.length || harNagot.kod.length || harNagot.api.length) expect(m.status).not.toBe('planerat');
      if (m.status === 'planerat') { expect(m.poster.uppfyllt_demo + m.poster.delvis).toBe(0); expect(m.statusText).toBe('Planerat'); }
      else expect(m.statusText).not.toMatch(/planerat/i);
    }
    for (const m of svar.data.moduler) if (m.status === 'planerat') expect([...m.rutter, ...m.journal, ...m.min, ...m.kod, ...m.api].some(x => x.finns)).toBe(false);
  });

  test('statusen räknas ur koden: en rutt som tas bort ger Finns i API:t, utan kod blir modulen planerad', () => {
    const mod = { ...MODULER.find(x => x.id === 'iva') };
    const tom = { ...g, rutter: g.rutter.filter(x => !x.re.test('#/iva') && !x.re.test('#/iva/1')) };
    const med = modulregister({ register, gransnitt: g, moduler: [mod], apiFinns: () => true }).moduler[0];
    expect(med.status).toBe('demo');
    expect(med.rutter.find(x => x.vag === '#/iva')).toMatchObject({ finns: true, meny: 'Intensivvård' });
    expect(modulregister({ register, gransnitt: tom, moduler: [mod], apiFinns: () => true }).moduler[0].status).toBe('api');
    const utan = modulregister({ register, gransnitt: tom, moduler: [mod], apiFinns: () => false, finnsFil: () => false }).moduler[0];
    expect(utan.status).toBe('planerat');
    // Antalet poster räknas ur registret och följer avsnittet.
    const iva = SPEC.poster.filter(p => p.avsnitt === '4.6').length;
    expect(med.poster.totalt).toBe(iva);
    expect(med.poster.uppfyllt_demo + med.poster.delvis + med.poster.planerat).toBe(iva);
    expect(med.kravLank).toBe('#/krav?poster=4.6');
  });

  test('rutter och flikar som en annan del lägger till med splice eller push känns igen', () => {
    const app = `${readFileSync(join(APP, 'public/js/app.js'), 'utf8')}
RUTTER.splice(3, 0, [/^#\\/operation$/, operation, () => far('las_operation')]);
RUTTER.push([/^#\\/forlossning\\/([\\w-]+)$/, forlossning.patient, () => true]);
MENY.splice(5, 0, ['#/operation', 'Operation', 'lista', () => far('las_operation')]);`;
    const patient = `${readFileSync(join(APP, 'public/js/vyer/patient.js'), 'utf8')}
FLIKAR.splice(2, 0, ['bilder', 'Bilder', () => far('las_journal'), bilder]);`;
    const min = `${readFileSync(join(APP, 'public/js/vyer/min.js'), 'utf8')}
FLIKAR.splice(4, 0, ['graviditet', 'Graviditet', graviditet.visa]);`;
    const t = lasGransnitt({ text: { 'public/js/app.js': app, 'public/js/vyer/patient.js': patient, 'public/js/vyer/min.js': min } });
    expect(ruttFinns(t, '#/operation')).toBe(true);
    expect(ruttFinns(t, '#/forlossning/:id')).toBe(true);
    expect(t.meny.get('#/operation')).toBe('Operation');
    expect(t.journal.get('bilder')).toBe('Bilder');
    expect(t.min.get('graviditet')).toBe('Graviditet');
    // Utan en modul för de nya rutterna och flikarna skulle testerna ovan stoppa bygget.
    expect(MODULER.some(m => m.rutter.some(v => t.rutter.find(r => r.monster.includes('operation')).re.test(exempel(v))))).toBe(false);
  });

  test('texterna om en modul som finns säger aldrig inte byggt, finns inte eller planerat', () => {
    for (const m of svar.data.moduler) {
      if (m.status === 'planerat') continue;
      for (const t of [m.namn, m.beskrivning, m.simulerat, m.nas, m.statusText]) if (t && FORBJUDNA.test(t)) throw new Error(`${m.id}: ${t}`);
    }
    // Vyn har inga egna listor eller texter om moduler: allt kommer från registret.
    const vy = readFileSync(join(APP, 'public/js/vyer/moduler.js'), 'utf8');
    expect(vy).not.toMatch(/inte byggt|inte byggd|finns inte|ännu inte|Planerat/);
    expect(vy).not.toMatch(/Operationsplanering|Intensivvård|const FINNS|const PLANERAT/);
    expect(FORBJUDNA.test('Gränssnittet är inte byggt än.')).toBe(true);
    expect(FORBJUDNA.test('Allt som ska göras och det som är planerade händelser.')).toBe(false);
    // Inga tankstreck eller ellipser i texterna.
    for (const m of MODULER) for (const t of [m.namn, m.beskrivning, m.simulerat, m.nas]) if (t) expect(t).not.toMatch(/[–—…]/);
  });

  test('versionsprincipen säger vad 1.x betyder, och villkoren för 1.0 är kvar', () => {
    expect(PRINCIP).toContain('Version 1.0 betyder att demon är funktionellt komplett mot kravspecifikationen');
    expect(PRINCIP).toContain('Efter 1.0 höjer varje runda det andra talet igen: 1.1 är runda 11.');
    expect(PRINCIP).toContain('ändrar inte villkoren för 1.0');
    expect(PRINCIP).not.toMatch(/[–—…]/);
    const v = villkor10({ poster: [] }, null, { version: '1.1.0', fynd: { oppna: [] }, testfall: [] });
    expect(v.villkor.map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('API: GET /api/moduler utan inloggning, utan patientuppgifter, med samma antal poster som kravsidan', async () => {
    const k = klient(app);
    const r = await k.get('/api/moduler');
    expect(r.status).toBe(200);
    expect(r.data.moduler.length).toBe(MODULER.length);
    expect(r.data.summa.demo + r.data.summa.api + r.data.summa.planerat).toBe(MODULER.length);
    expect(r.data.moduler.find(m => m.id === 'iva').status).toBe('demo');
    expect(r.data.moduler.find(m => m.id === 'nationella-anslutning').status).toBe('planerat');
    const text = JSON.stringify(r.data);
    expect(text).not.toMatch(/\b(19|20)\d{6}-?\d{4}\b/);
    for (const namn of ['Gunnar Åkesson', 'Elin Sandberg', 'Thomas Lindberg']) expect(text).not.toContain(namn);
    const krav = (await k.get('/api/krav/sussa')).data;
    const status = new Map(krav.poster.map(p => [p.id, p.status]));
    for (const m of r.data.moduler) {
      const s = { uppfyllt_demo: 0, delvis: 0, planerat: 0 };
      for (const id of m.poster.ids) s[status.get(id)]++;
      expect([m.poster.uppfyllt_demo, m.poster.delvis, m.poster.planerat]).toEqual([s.uppfyllt_demo, s.delvis, s.planerat]);
    }
  });
});
