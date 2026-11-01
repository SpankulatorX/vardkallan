// Sammanställning av användartestet (D6). Läser resultatfilerna som testläget i gränssnittet laddar ner
// (public/js/anvandartest.js) och räknar per flöde ut median och spridning för stegen och tiden, andelen som
// slutförde uppgiften och SUS-poängen. Jämförs med budgeten i klickbudget.js och med skriptets mätning i
// klickbudget.json. Används av scripts/sammanstall-anvandartest.js.
import { FLODEN } from './klickbudget.js';

export const FORMAT = 'vardkallan-anvandartest';

// Gränserna för att D6 ska räknas som mätt med verkliga användare (docs/anvandartest.md).
export const KRITERIER = { minDeltagare: 5, minAndelUtanHjalp: 0.8 };

// Vilken yrkesroll ett flöde är till för, efter demorollen som flödet görs med.
export const malgrupp = (roll) => (roll.startsWith('lak-') ? 'lakare' : roll.startsWith('ssk-') ? 'sjukskoterska' : roll.startsWith('usk-') ? 'underskoterska' : roll.startsWith('adm-') ? 'vardadministrator' : 'annan');
export const YRKESROLL_TEXT = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', underskoterska: 'Undersköterska', vardadministrator: 'Vårdadministratör eller medicinsk sekreterare', annan: 'Annan yrkesroll' };

// En resultatfil är JSON. En kopierad text har JSON-filen sist, efter raden "Resultatfil (JSON):".
export function lasResultat(text) {
  const t = String(text ?? '');
  const i = t.indexOf('Resultatfil (JSON):');
  const json = i >= 0 ? t.slice(i + 'Resultatfil (JSON):'.length) : t;
  let r;
  try { r = JSON.parse(json); } catch { throw new Error('filen är inte ett resultat från användartestet (ingen JSON)'); }
  if (r?.format !== FORMAT) throw new Error('filen är inte ett resultat från användartestet (fel format)');
  if (!Array.isArray(r.uppgifter) || typeof r.deltagarkod !== 'string') throw new Error('resultatet saknar uppgifter eller deltagarkod');
  return r;
}

// Kvantil med linjär interpolation mellan de sorterade värdena.
export function kvantil(sorterade, p) {
  if (!sorterade.length) return null;
  const pos = (sorterade.length - 1) * p;
  const lag = Math.floor(pos);
  const hog = Math.ceil(pos);
  return sorterade[lag] + (sorterade[hog] - sorterade[lag]) * (pos - lag);
}
export function spridning(varden) {
  const s = varden.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return { n: 0, median: null, q1: null, q3: null, min: null, max: null };
  return { n: s.length, median: kvantil(s, 0.5), q1: kvantil(s, 0.25), q3: kvantil(s, 0.75), min: s[0], max: s[s.length - 1] };
}
const medel = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// Slutförd: deltagaren markerade uppgiften som klar och uppgiftens mål syntes på skärmen.
export const slutford = (u) => u.status === 'klar' && u.malUppnatt === true;

export function sammanstall(resultat, { floden = FLODEN, skript = null } = {}) {
  const versioner = [...new Set(resultat.map(r => r.version?.gransnitt ?? 'okänd'))];
  const koder = resultat.map(r => r.deltagarkod);
  const dubbletter = [...new Set(koder.filter((k, i) => koder.indexOf(k) !== i))];
  const perRoll = {};
  for (const r of resultat) { const y = r.deltagare?.yrkesroll ?? 'okänd'; perRoll[y] = (perRoll[y] ?? 0) + 1; }

  const fl = floden.map(f => {
    const grupp = malgrupp(f.roll);
    const rader = resultat.flatMap(r => r.uppgifter.filter(u => u.id === f.id).map(u => ({ ...u, yrkesroll: r.deltagare?.yrkesroll ?? null })));
    const iGrupp = rader.filter(u => u.yrkesroll === grupp);
    const klara = rader.filter(slutford);
    const klaraGrupp = iGrupp.filter(slutford);
    const utanHjalpGrupp = klaraGrupp.filter(u => !u.hjalp);
    const steg = spridning(klaraGrupp.map(u => u.uppmatt));
    const s = skript?.floden?.find(x => x.id === f.id);
    const ut = {
      id: f.id, namn: f.namn, roll: f.roll, malgrupp: grupp, budget: f.budget, skriptUppmatt: s?.uppmatt ?? null,
      antal: rader.length, slutforda: klara.length, hoppade: rader.filter(u => u.status === 'hoppade_over').length, medHjalp: rader.filter(u => u.hjalp > 0).length,
      malgruppen: {
        antal: iGrupp.length, slutforda: klaraGrupp.length, utanHjalp: utanHjalpGrupp.length,
        andelUtanHjalp: iGrupp.length ? utanHjalpGrupp.length / iGrupp.length : null,
        steg, klick: spridning(klaraGrupp.map(u => u.klick)), faltbyten: spridning(klaraGrupp.map(u => u.faltbyten)), tangenter: spridning(klaraGrupp.map(u => u.tangenter)),
        tidS: spridning(klaraGrupp.map(u => u.tidMs / 1000)),
      },
      alla: { steg: spridning(klara.map(u => u.uppmatt)), tidS: spridning(klara.map(u => u.tidMs / 1000)) },
    };
    const brister = [];
    if (iGrupp.length < KRITERIER.minDeltagare) brister.push(`${iGrupp.length} av minst ${KRITERIER.minDeltagare} deltagare i målgruppen`);
    if (ut.malgruppen.andelUtanHjalp != null && ut.malgruppen.andelUtanHjalp < KRITERIER.minAndelUtanHjalp) brister.push(`${Math.round(ut.malgruppen.andelUtanHjalp * 100)} procent slutförde utan hjälp, minst ${KRITERIER.minAndelUtanHjalp * 100} krävs`);
    if (steg.median != null && steg.median > f.budget) brister.push(`medianen ${steg.median} steg är över budgeten ${f.budget}`);
    if (steg.median == null && iGrupp.length) brister.push('ingen i målgruppen slutförde uppgiften');
    ut.inomKriterierna = brister.length === 0;
    ut.brister = brister;
    return ut;
  });

  const susVarden = resultat.map(r => r.sus?.poang).filter(v => typeof v === 'number');
  const sd = susVarden.length > 1 ? Math.sqrt(susVarden.reduce((a, v) => a + (v - medel(susVarden)) ** 2, 0) / (susVarden.length - 1)) : null;
  const varningar = [];
  if (versioner.length > 1) varningar.push(`Resultaten kommer från ${versioner.length} olika versioner av gränssnittet.`);
  if (dubbletter.length) varningar.push(`Samma deltagarkod finns i flera filer: ${dubbletter.join(', ')}.`);
  if (skript?.gransnittHash && versioner.some(v => v !== skript.gransnittHash)) varningar.push('Skriptets mätning i klickbudget.json gjordes på en annan version av gränssnittet än användartestet.');
  return {
    deltagare: resultat.length, perYrkesroll: perRoll, versioner,
    floden: fl,
    sus: { n: susVarden.length, medel: medel(susVarden), sd, ...spridning(susVarden) },
    d6: { uppfyllt: resultat.length > 0 && fl.every(f => f.inomKriterierna), kriterier: KRITERIER },
    varningar,
  };
}

const tal = (v, dec = 1) => (v == null ? '' : Number(v).toLocaleString('sv-SE', { maximumFractionDigits: dec }));
const sprid = (s, dec = 1) => (s.n ? `${tal(s.median, dec)} (${tal(s.q1, dec)} till ${tal(s.q3, dec)}, ${tal(s.min, dec)} till ${tal(s.max, dec)})` : '');
const procent = (v) => (v == null ? '' : `${Math.round(v * 100)} %`);

export function somText(s) {
  const r = [];
  r.push('# Sammanställning av användartestet', '');
  r.push(`Deltagare: ${s.deltagare}. ${Object.entries(s.perYrkesroll).map(([k, n]) => `${YRKESROLL_TEXT[k] ?? k}: ${n}`).join(', ')}.`);
  r.push(`Gränssnittets version: ${s.versioner.map(v => (v.length > 12 ? v.slice(0, 12) : v)).join(', ')}.`, '');
  for (const v of s.varningar) r.push(`Obs: ${v}`);
  if (s.varningar.length) r.push('');
  r.push('Steg är klick, fältbyten och tangenter tillsammans, räknade som i klickbudgeten. Median och spridning gäller deltagarna i flödets målgrupp som slutförde uppgiften: median (kvartiler, min till max).', '');
  r.push('| Flöde | Målgrupp | Budget | Skriptet | Deltagare i målgruppen | Slutförda utan hjälp | Steg | Tid i sekunder | Alla deltagare, steg | Inom kriterierna |');
  r.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const f of s.floden) {
    const m = f.malgruppen;
    r.push(`| ${f.namn} | ${YRKESROLL_TEXT[f.malgrupp]} | ${f.budget} | ${f.skriptUppmatt ?? ''} | ${m.antal} | ${m.utanHjalp} (${procent(m.andelUtanHjalp)}) | ${sprid(m.steg)} | ${sprid(m.tidS, 0)} | ${sprid(f.alla.steg)} | ${f.inomKriterierna ? 'ja' : `nej: ${f.brister.join('; ')}`} |`);
  }
  r.push('');
  r.push(s.sus.n ? `SUS: medel ${tal(s.sus.medel)}, standardavvikelse ${tal(s.sus.sd)}, median ${tal(s.sus.median)}, ${tal(s.sus.min)} till ${tal(s.sus.max)}, ${s.sus.n} svar.` : 'SUS: inga svar.');
  r.push('');
  r.push(s.d6.uppfyllt
    ? `D6: alla flöden är inom kriterierna (minst ${s.d6.kriterier.minDeltagare} deltagare i målgruppen, minst ${s.d6.kriterier.minAndelUtanHjalp * 100} procent slutförda utan hjälp, medianen inom budget).`
    : 'D6: inte alla flöden är inom kriterierna än.');
  return `${r.join('\n')}\n`;
}
