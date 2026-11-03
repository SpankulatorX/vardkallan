import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { nyRakning, registrera, uppmatt } from '../public/js/anvandartest-rakning.js';
import { susPoang, SUS_PASTAENDEN } from '../public/js/sus.js';
import { UPPGIFTER, STARTPUNKT, FORMAT as KLIENTFORMAT } from '../public/js/anvandartest-uppgifter.js';
import { FLODEN } from '../src/klickbudget.js';
import { FORMAT, lasResultat, sammanstall, somText, spridning, kvantil, malgrupp } from '../src/anvandartest.js';

// Händelser som testläget skickar till räkningen. Elementen identifieras med ett nummer.
const L = { id: 1, klickbar: true, text: 'Registrera mätvärde' };
const KNAPP = { id: 2, klickbar: true, text: 'Registrera' };
const FALT = { id: 3, textfalt: true, text: 'Värde' };
const TEXTRUTA = { id: 4, textfalt: true, text: 'Bedömning' };
const ETIKETT_FALT = { id: 5, klickbar: true, etikettFor: 3, etikettTillTextfalt: true, text: 'Värde' };
const LISTA = { id: 6, lista: true, text: 'Mottagare' };
const KRYSS = { id: 7, klickbar: true, text: 'Intyg' };
const ETIKETT_KRYSS = { id: 8, klickbar: true, etikettFor: 7, text: 'Patienten kan inte samtycka' };
const TEXT = { id: 9, text: 'Senaste anteckningar' };

function kor(handelser) {
  const r = nyRakning();
  let tid = 1000;
  for (const h of handelser) { tid += h.efter ?? 300; registrera(r, { tid, detail: 1, ...h }); }
  return r;
}
const musklick = (mal) => [{ typ: 'pointerdown', mal }, { typ: 'click', mal }];
const skriv = (mal, text) => [...text].map(t => ({ typ: 'keydown', mal, tangent: t, iTextfalt: true, efter: 20 }));
const summa = (r) => ({ klick: r.klick, faltbyten: r.faltbyten, tangenter: r.tangenter, uppmatt: uppmatt(r) });

describe('Användartest', () => {
  test('räkningen: klick på knappar och länkar, inte i fält som gränssnittet har satt fokus i', () => {
    // Som Registrera blodtryck i klickbudgeten: ett klick, värdet i ett fält som redan har fokus, ett klick.
    const r = kor([...musklick(L), { typ: 'focusin', mal: FALT, efter: 50 }, ...skriv(FALT, '128/82'), ...musklick(KNAPP)]);
    expect(summa(r)).toEqual({ klick: 2, faltbyten: 0, tangenter: 0, uppmatt: 2 });
    expect(r.steg).toEqual(['klick: Registrera mätvärde', 'har redan fokus: Värde', 'klick: Registrera']);
  });

  test('räkningen: fältbyte med musen i fältet, på etiketten eller med Tab', () => {
    expect(summa(kor([...musklick(FALT), { typ: 'focusin', mal: FALT, efter: 5 }]))).toMatchObject({ klick: 0, faltbyten: 1 });
    expect(summa(kor([...musklick(ETIKETT_FALT), { typ: 'focusin', mal: FALT, efter: 5 }]))).toMatchObject({ klick: 0, faltbyten: 1 });
    const tab = kor([{ typ: 'keydown', mal: KNAPP, tangent: 'Tab' }, { typ: 'focusin', mal: FALT, efter: 5 }]);
    expect(summa(tab)).toEqual({ klick: 0, faltbyten: 1, tangenter: 0, uppmatt: 1 });
    expect(tab.steg).toEqual(['fältbyte med Tab: Värde']);
    // Tab till en knapp är en tangent.
    expect(summa(kor([{ typ: 'keydown', mal: FALT, tangent: 'Tab', iTextfalt: true }, { typ: 'focusin', mal: KNAPP, efter: 5 }]))).toMatchObject({ faltbyten: 0, tangenter: 1 });
    // Ett klick i ett fält som redan har fokus är inget nytt fältbyte.
    expect(summa(kor([...musklick(FALT), { typ: 'focusin', mal: FALT, efter: 5 }, ...musklick(FALT)]))).toMatchObject({ faltbyten: 1, uppmatt: 1 });
    // Fokus långt efter ett klick i fältet räknas inte som fältbyte.
    expect(summa(kor([...musklick(FALT), { typ: 'focusin', mal: FALT, efter: 5000 }]))).toMatchObject({ faltbyten: 0 });
  });

  test('räkningen: Enter räknas, men inte texten och tangenterna som används för att skriva', () => {
    // Som sökningen i Nödåtkomst: Enter i sökfältet skickar formuläret, och webbläsaren klickar på skicka-knappen.
    const r = kor([{ typ: 'focusin', mal: FALT }, ...skriv(FALT, 'Lindberg'), { typ: 'keydown', mal: FALT, tangent: 'Enter', iTextfalt: true }, { typ: 'click', mal: KNAPP, detail: 0, efter: 1 }]);
    expect(summa(r)).toEqual({ klick: 0, faltbyten: 0, tangenter: 1, uppmatt: 1 });
    const skrivande = kor([{ typ: 'focusin', mal: TEXTRUTA }, ...skriv(TEXTRUTA, 'Pigg'),
      ...['Backspace', 'ArrowLeft', 'Home', 'Shift', 'Enter'].map(t => ({ typ: 'keydown', mal: TEXTRUTA, tangent: t, iTextfalt: true, iTextruta: true }))]);
    expect(summa(skrivande)).toEqual({ klick: 0, faltbyten: 0, tangenter: 0, uppmatt: 0 });
    // Utanför textfält räknas mellanslag och Escape, men inte Shift.
    expect(summa(kor([{ typ: 'keydown', mal: KNAPP, tangent: ' ' }, { typ: 'click', mal: KNAPP, detail: 0, efter: 1 }, { typ: 'keydown', mal: KNAPP, tangent: 'Escape' }, { typ: 'keydown', mal: KNAPP, tangent: 'Shift' }]))).toMatchObject({ klick: 0, tangenter: 2 });
  });

  test('räkningen: en rullgardinslista som ändras är två klick, och med tangentbordet räknas tangenterna', () => {
    expect(summa(kor([...musklick(LISTA), { typ: 'change', mal: LISTA }]))).toEqual({ klick: 2, faltbyten: 0, tangenter: 0, uppmatt: 2 });
    // Värdet ändras utan musklick, som med Playwrights selectOption i klickbudgetskriptet.
    expect(summa(kor([{ typ: 'change', mal: LISTA }]))).toMatchObject({ klick: 2, uppmatt: 2 });
    // Öppnad men inte ändrad: ett klick.
    expect(summa(kor([...musklick(LISTA)]))).toMatchObject({ klick: 1 });
    // Tab till listan, pil nedåt och ändring.
    expect(summa(kor([{ typ: 'keydown', mal: KNAPP, tangent: 'Tab' }, { typ: 'focusin', mal: LISTA, efter: 5 }, { typ: 'keydown', mal: LISTA, tangent: 'ArrowDown', iLista: true }, { typ: 'change', mal: LISTA, efter: 1 }])))
      .toEqual({ klick: 0, faltbyten: 0, tangenter: 2, uppmatt: 2 });
  });

  test('räkningen: kryssruta via etiketten räknas en gång, klick utanför kontroller räknas för sig', () => {
    const r = kor([...musklick(ETIKETT_KRYSS), { typ: 'click', mal: KRYSS, efter: 1 }]);
    expect(summa(r)).toMatchObject({ klick: 1, uppmatt: 1 });
    expect(summa(kor(musklick(KRYSS)))).toMatchObject({ klick: 1 });
    const utanfor = kor(musklick(TEXT));
    expect(summa(utanfor)).toMatchObject({ klick: 0, uppmatt: 0 });
    expect(utanfor.ovrigaKlick).toBe(1);
  });

  test('SUS-poängen räknas med standardformeln', () => {
    expect(SUS_PASTAENDEN.length).toBe(10);
    expect(susPoang(Array(10).fill(3))).toBe(50);
    expect(susPoang([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susPoang([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susPoang([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
    // Udda: 3 + 4 + 3 + 4 + 3 = 17. Jämna: 4 + 3 + 4 + 4 + 3 = 18. (17 + 18) * 2,5 = 87,5.
    expect(susPoang([4, 1, 5, 2, 4, 1, 5, 1, 4, 2])).toBe(87.5);
    expect(susPoang([5, 1, 4, 2, 3, 3, 2, 4, 1, 5])).toBe(50);
    expect(susPoang([4, 1, 5, 2, 4, 1, 5, 1, 4])).toBeNull();
    expect(susPoang([4, 1, 5, 2, 4, 1, 5, 1, 4, null])).toBeNull();
    expect(susPoang([4, 1, 5, 2, 4, 1, 5, 1, 4, 6])).toBeNull();
    expect(susPoang(null)).toBeNull();
  });

  test('uppgifterna följer flödena i klickbudgeten', () => {
    // Användartestet är för personal i vården. Patientens egna flöden i Min journal (roll inv-) mäts bara i klickbudgeten.
    expect(UPPGIFTER.map(u => ({ id: u.id, namn: u.namn, roll: u.roll, start: u.start }))).toEqual(FLODEN.filter(f => !f.roll.startsWith('inv-')).map(f => ({ id: f.id, namn: f.namn, roll: f.roll, start: f.start })));
    for (const u of UPPGIFTER) {
      expect(STARTPUNKT[u.start]).toBeDefined();
      expect(Boolean(u.kontroll.notis || u.kontroll.sel)).toBe(true);
      expect(u.text.length).toBeGreaterThan(20);
    }
    expect(KLIENTFORMAT).toBe(FORMAT);
  });

  test('sammanställningen ger median, spridning, andel slutförda och SUS per flöde', () => {
    expect(kvantil([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(spridning([4, 2, 3, 2, 2])).toEqual({ n: 5, median: 2, q1: 2, q3: 3, min: 2, max: 4 });
    expect(spridning([])).toMatchObject({ n: 0, median: null });
    expect(malgrupp('ssk-kard')).toBe('sjukskoterska');
    expect(malgrupp('lak-akut')).toBe('lakare');
    const deltagare = (kod, yrkesroll, uppgifter, sus) => ({ format: FORMAT, deltagarkod: kod, version: { gransnitt: 'a'.repeat(64) }, deltagare: { yrkesroll }, uppgifter, sus: { poang: sus } });
    const bt = (uppmattSteg, ovr = {}) => ({ id: 'blodtryck', status: 'klar', malUppnatt: true, hjalp: 0, tidMs: 20000, klick: uppmattSteg, faltbyten: 0, tangenter: 0, uppmatt: uppmattSteg, ...ovr });
    const res = [
      deltagare('S1', 'sjukskoterska', [bt(2)], 80), deltagare('S2', 'sjukskoterska', [bt(2)], 70), deltagare('S3', 'sjukskoterska', [bt(3)], 90),
      deltagare('S4', 'sjukskoterska', [bt(4, { hjalp: 1 })], 60), deltagare('S5', 'sjukskoterska', [bt(2, { tidMs: 40000 })], 75),
      deltagare('L1', 'lakare', [bt(9), { ...bt(5), id: 'remiss', status: 'hoppade_over', malUppnatt: false }], null),
    ];
    const s = sammanstall(res, { skript: { gransnittHash: 'a'.repeat(64), floden: [{ id: 'blodtryck', uppmatt: 2 }] } });
    const f = s.floden.find(x => x.id === 'blodtryck');
    expect(f).toMatchObject({ budget: 3, skriptUppmatt: 2, antal: 6, slutforda: 6, medHjalp: 1, malgrupp: 'sjukskoterska' });
    expect(f.malgruppen).toMatchObject({ antal: 5, slutforda: 5, utanHjalp: 4, andelUtanHjalp: 0.8 });
    expect(f.malgruppen.steg).toEqual({ n: 5, median: 2, q1: 2, q3: 3, min: 2, max: 4 });
    expect(f.malgruppen.tidS.median).toBe(20);
    expect(f.alla.steg.max).toBe(9);
    expect(f.inomKriterierna).toBe(true);
    const remiss = s.floden.find(x => x.id === 'remiss');
    expect(remiss).toMatchObject({ antal: 1, slutforda: 0, hoppade: 1, inomKriterierna: false });
    expect(s.sus).toMatchObject({ n: 5, medel: 75, median: 75, min: 60, max: 90 });
    expect(s.perYrkesroll).toEqual({ sjukskoterska: 5, lakare: 1 });
    expect(s.d6.uppfyllt).toBe(false);
    expect(s.varningar).toEqual([]);
    expect(somText(s)).toContain('| Registrera blodtryck | Sjuksköterska | 3 | 2 | 5 | 4 (80 %) | 2 (2 till 3, 2 till 4) |');
    // Medianen över budgeten och för få deltagare syns som brister.
    const over = sammanstall(res.slice(0, 3).map(r => ({ ...r, uppgifter: [bt(5)] })));
    expect(over.floden.find(x => x.id === 'blodtryck').brister).toEqual(['3 av minst 5 deltagare i målgruppen', 'medianen 5 steg är över budgeten 3']);
    expect(sammanstall([res[0], res[0]]).varningar).toEqual(['Samma deltagarkod finns i flera filer: S1.']);
  });

  test('resultatfiler läses som JSON och som kopierad text, och skriptet sammanställer en katalog', () => {
    const r = { format: FORMAT, deltagarkod: 'T01', version: { gransnitt: 'b'.repeat(64) }, deltagare: { yrkesroll: 'sjukskoterska' },
      uppgifter: [{ id: 'blodtryck', status: 'klar', malUppnatt: true, hjalp: 0, tidMs: 15000, klick: 2, faltbyten: 0, tangenter: 0, uppmatt: 2 }], sus: { poang: 72.5 } };
    expect(lasResultat(JSON.stringify(r)).deltagarkod).toBe('T01');
    expect(lasResultat(`Användartest i Vårdkällan\nDeltagarkod: T01\n\nResultatfil (JSON):\n${JSON.stringify(r, null, 2)}\n`).deltagarkod).toBe('T01');
    expect(() => lasResultat('{"format":"annat"}')).toThrow('fel format');
    expect(() => lasResultat('inte json')).toThrow('ingen JSON');
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-anvandartest-'));
    try {
      writeFileSync(join(dir, 't01.json'), JSON.stringify(r));
      writeFileSync(join(dir, 't02.txt'), `Resultatfil (JSON):\n${JSON.stringify({ ...r, deltagarkod: 'T02', sus: { poang: 77.5 } })}`);
      writeFileSync(join(dir, 'annat.json'), '{"x":1}');
      const p = Bun.spawnSync(['bun', join(import.meta.dir, '..', 'scripts', 'sammanstall-anvandartest.js'), dir, '--json', '--klickbudget', join(dir, 'saknas.json')]);
      expect(p.exitCode).toBe(0);
      const s = JSON.parse(p.stdout.toString());
      expect(s.deltagare).toBe(2);
      expect(s.sus.medel).toBe(75);
      expect(s.floden.find(f => f.id === 'blodtryck').malgruppen.antal).toBe(2);
      expect(p.stderr.toString()).toContain('annat.json');
      const text = Bun.spawnSync(['bun', join(import.meta.dir, '..', 'scripts', 'sammanstall-anvandartest.js'), dir]);
      expect(text.stdout.toString()).toContain('# Sammanställning av användartestet');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
