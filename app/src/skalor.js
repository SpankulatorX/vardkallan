// Skalor och poängmodeller (Sussa 3.1.3.5 och 3.1.3.9): NEWS2, Glasgow Coma Scale, smärtskattning med NRS och
// medvetandegrad med ACVPU, referensintervall för kurvorna och eGFR ur kreatinin. Systemet räknar poängen och skriver
// texten, så att ingen behöver kunna tabellerna. Allt här är demoregler och inte kliniskt beslutsstöd (D10): reglerna
// ligger i en egen modul, skild från journalkärnan, och ingen MDR-bedömning är gjord.
//
// Källor:
//   NEWS2: Royal College of Physicians. National Early Warning Score (NEWS) 2: Standardising the assessment of
//   acute-illness severity in the NHS. London: RCP, 2017. Chart 1 (poängen), Chart 2 (trösklarna) och Chart 4 (vad som
//   ska göras), hämtade från rcp.ac.uk 2026-11-03. Texterna om vad som ska göras är översatta till svenska här.
//   Glasgow Coma Scale: Teasdale G, Jennett B. Assessment of coma and impaired consciousness. Lancet 1974;2:81-84,
//   i den vanliga versionen med 15 poäng.
//   eGFR: Inker LA m.fl. New creatinine- and cystatin C-based equations to estimate GFR without race. N Engl J Med
//   2021;385:1737-49 (CKD-EPI 2021, kreatinin).
// Inga licensierade skalor (till exempel RETTS eller MNA) finns här.

export const DEMOREGEL = 'Demoregel, inte kliniskt beslutsstöd. Ingen MDR-bedömning är gjord.';
export const NEWS2_KALLA = 'Royal College of Physicians, National Early Warning Score (NEWS) 2, 2017';

// Medvetandegrad enligt ACVPU (NEWS2). C är nytillkommen förvirring.
export const ACVPU = {
  A: { text: 'Vaken', poang: 0 },
  C: { text: 'Nytillkommen förvirring', poang: 3 },
  V: { text: 'Reagerar på tilltal', poang: 3 },
  P: { text: 'Reagerar på smärta', poang: 3 },
  U: { text: 'Reagerar inte', poang: 3 },
};

// Glasgow Coma Scale: ögonöppning (E), verbalt svar (V) och motoriskt svar (M).
export const GCS = {
  E: { namn: 'Ögonöppning', steg: { 4: 'Spontant', 3: 'På tilltal', 2: 'På smärta', 1: 'Ingen' } },
  V: { namn: 'Verbalt svar', steg: { 5: 'Orienterad', 4: 'Förvirrad', 3: 'Osammanhängande ord', 2: 'Obegripliga ljud', 1: 'Inget' } },
  M: { namn: 'Motoriskt svar', steg: { 6: 'Lyder uppmaning', 5: 'Lokaliserar smärta', 4: 'Drar undan vid smärta', 3: 'Böjer onormalt vid smärta', 2: 'Sträcker vid smärta', 1: 'Inget' } },
};

// GCS som text, till exempel E3V4M6. Ger { e, v, m, summa, text } eller null om texten inte går att tolka.
export function tolkaGcs(varde) {
  const s = typeof varde === 'string' ? varde.toUpperCase().replace(/\s+/g, '') : '';
  const m = s.match(/^E([1-4])V([1-5])M([1-6])$/);
  if (!m) return null;
  const [e, v, mo] = m.slice(1).map(Number);
  return { e, v, m: mo, summa: e + v + mo, text: `GCS ${e + v + mo} (E${e} V${v} M${mo})` };
}

export function gcsText(g) {
  if (!g) return '';
  const grad = g.summa <= 8 ? 'Medvetslös, 8 poäng eller lägre.' : g.summa <= 12 ? 'Måttligt sänkt medvetande.' : g.summa <= 14 ? 'Lätt sänkt medvetande.' : 'Fullt medveten.';
  return `${g.text}. ${GCS.E.namn}: ${GCS.E.steg[g.e].toLowerCase()}, ${GCS.V.namn.toLowerCase()}: ${GCS.V.steg[g.v].toLowerCase()}, ${GCS.M.namn.toLowerCase()}: ${GCS.M.steg[g.m].toLowerCase()}. ${grad}`;
}

// Smärta enligt NRS 0 till 10.
export function nrsText(n) {
  if (n == null) return '';
  const grad = n === 0 ? 'ingen smärta' : n <= 3 ? 'lätt smärta' : n <= 6 ? 'måttlig smärta' : 'svår smärta';
  return `Smärta ${n} av 10 (NRS), ${grad}.`;
}

// NEWS2, Chart 1. Varje parameter ger 0 till 3 poäng. Gränserna är de i tabellen, och ett värde med decimaler mellan
// två rader räknas till den lägre raden (till exempel 36,05 grader till 35,1 till 36,0).
const steg = (v, gransOchPoang, sista) => {
  for (const [grans, p] of gransOchPoang) if (v <= grans) return p;
  return sista;
};
export const NEWS2_PARAMETRAR = [
  { id: 'andningsfrekvens', namn: 'Andningsfrekvens', enhet: 'andetag/min', poang: (v) => steg(v, [[8, 3], [11, 1], [20, 0], [24, 2]], 3) },
  { id: 'saturation', namn: 'Syremättnad', enhet: '%', poang: (v) => steg(v, [[91, 3], [93, 2], [95, 1]], 0) },
  { id: 'syrgas', namn: 'Luft eller syrgas', enhet: 'L/min', poang: (v) => (v > 0 ? 2 : 0) },
  { id: 'systoliskt', namn: 'Systoliskt blodtryck', enhet: 'mmHg', poang: (v) => steg(v, [[90, 3], [100, 2], [110, 1], [219, 0]], 3) },
  { id: 'puls', namn: 'Puls', enhet: 'slag/min', poang: (v) => steg(v, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2]], 3) },
  { id: 'medvetande', namn: 'Medvetandegrad', enhet: '', poang: (v) => ACVPU[v]?.poang ?? null },
  { id: 'temp', namn: 'Temperatur', enhet: '°C', poang: (v) => steg(v, [[35.0, 3], [36.0, 1], [38.0, 0], [39.0, 1]], 2) },
];

// Runda 10, r4: SpO2 skala 2 i Chart 1, för patienter med andningssvikt med hyperkapné där målet för syremättnaden är
// 88 till 92 procent. Läkaren beslutar om skalan. På luft ger 88 procent och högre 0 poäng. Med syrgas ger 93 procent
// och högre poäng, eftersom syremättnaden då är över målet: 93 till 94 ger 1, 95 till 96 ger 2 och 97 eller mer 3.
export const SKALA2_MAL = 'Målet för syremättnaden är 88 till 92 procent (SpO2 skala 2 i NEWS2).';
export function saturationSkala2(v, syrgas) {
  if (v <= 83) return 3;
  if (v <= 85) return 2;
  if (v <= 87) return 1;
  if (v <= 92 || !(syrgas > 0)) return 0;
  if (v <= 94) return 1;
  if (v <= 96) return 2;
  return 3;
}

// Chart 2 och Chart 4: risknivå, hur ofta kontrollerna ska göras och vad som ska göras.
export const NEWS2_ATGARD = {
  0: { risk: 'lag', riskText: 'Låg risk', frekvens: 'Kontroller minst var 12:e timme', timmar: 12,
    atgard: ['Fortsätt med NEWS2-kontrollerna som vanligt.'] },
  lag: { risk: 'lag', riskText: 'Låg risk', frekvens: 'Kontroller minst var 4:e till 6:e timme', timmar: 4,
    atgard: ['Informera sjuksköterskan, som ska bedöma patienten.', 'Sjuksköterskan avgör om kontrollerna ska bli tätare eller om vården ska trappas upp.'] },
  rod: { risk: 'lag_medel', riskText: 'Låg till medelhög risk, 3 poäng i en parameter', frekvens: 'Kontroller minst varje timme', timmar: 1,
    atgard: ['Sjuksköterskan informerar det läkarteam som ansvarar för patienten.', 'Läkarteamet bedömer patienten och avgör om vården ska trappas upp.'] },
  medel: { risk: 'medel', riskText: 'Medelhög risk', frekvens: 'Kontroller minst varje timme', timmar: 1,
    atgard: ['Sjuksköterskan informerar omedelbart det läkarteam som ansvarar för patienten.', 'Sjuksköterskan begär akut bedömning av en läkare eller ett team med kompetens i vård av akut sjuka patienter.', 'Vården ges där patienten kan övervakas.'] },
  hog: { risk: 'hog', riskText: 'Hög risk', frekvens: 'Kontinuerlig övervakning av vitalparametrarna', timmar: 0,
    atgard: ['Sjuksköterskan informerar omedelbart det läkarteam som ansvarar för patienten, minst en erfaren läkare (specialist registrar i förlagan).', 'Akut bedömning av ett team med kompetens i intensivvård, med personal som kan hantera luftvägen avancerat.', 'Överväg att flytta patienten till intermediärvård eller intensivvård.', 'Vården ges där patienten kan övervakas.'] },
};

const tal = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Räknar NEWS2 ur värdena { andningsfrekvens, saturation, syrgas, systoliskt, puls, medvetande, temp }. syrgas är
// liter per minut, 0 för luft. Saknas ett värde är poängen inte komplett: den räknas inte ihop, men en parameter med 3
// poäng ger ändå larm, eftersom en enskild parameter med 3 poäng kräver åtgärd i sig (Chart 2).
// skala 2 räknar syremättnaden med SpO2 skala 2. Då behövs också uppgiften om luft eller syrgas för att poängen ska räknas.
export function news2(varden, { skala = 1 } = {}) {
  const delar = [];
  const saknas = [];
  for (const p of NEWS2_PARAMETRAR) {
    const v = p.id === 'medvetande' ? (typeof varden[p.id] === 'string' && ACVPU[varden[p.id]] ? varden[p.id] : null) : tal(varden[p.id]);
    if (v == null) { saknas.push(p.namn); continue; }
    const skala2 = skala === 2 && p.id === 'saturation';
    if (skala2 && tal(varden.syrgas) == null) { saknas.push(p.namn); continue; }
    const poang = skala2 ? saturationSkala2(v, tal(varden.syrgas)) : p.poang(v);
    const visning = p.id === 'medvetande' ? `${v}, ${ACVPU[v].text.toLowerCase()}` : p.id === 'syrgas' ? (v > 0 ? `Syrgas ${String(v).replace('.', ',')} L/min` : 'Luft') : `${String(v).replace('.', ',')} ${p.enhet}`;
    delar.push({ parameter: p.id, namn: skala2 ? `${p.namn}, skala 2` : p.namn, varde: v, visning, poang });
  }
  const komplett = saknas.length === 0;
  const summa = delar.reduce((s, d) => s + d.poang, 0);
  const rod = delar.filter(d => d.poang === 3).map(d => d.namn);
  const niva = komplett ? (summa >= 7 ? 'hog' : summa >= 5 ? 'medel' : rod.length ? 'rod' : summa >= 1 ? 'lag' : 0) : rod.length ? 'rod' : null;
  const a = niva == null ? null : NEWS2_ATGARD[niva];
  return {
    komplett, poang: komplett ? summa : null, delar, saknas, rod,
    risk: a?.risk ?? null, riskText: a?.riskText ?? null, frekvens: a?.frekvens ?? null, kontrollInomTimmar: a?.timmar ?? null,
    atgard: a?.atgard ?? [], larm: niva === 'hog' || niva === 'medel' || niva === 'rod',
    text: news2Text({ komplett, summa, rod, saknas, a }),
    kalla: NEWS2_KALLA, demoregel: DEMOREGEL, skala,
  };
}

function news2Text({ komplett, summa, rod, saknas, a }) {
  const roda = rod.length ? ` ${rod.join(' och ')} ger 3 poäng.` : '';
  if (komplett) return `NEWS2 ${summa}, ${a.riskText.toLowerCase()}.${roda} ${a.frekvens}.`;
  const mat = `NEWS2 kan inte räknas förrän alla sju värden finns. Mät också ${saknas.map(s => s.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')}.`;
  return rod.length ? `${roda.trim()} Det kräver åtgärd även utan de andra värdena. ${mat}` : mat;
}

// NEWS2 används inte för barn under 16 år och inte under graviditet (RCP 2017, rekommendation 1 och 2).
export const NEWS2_FRAN_ALDER = 16;
const GRAVIDITET = /^(O\d|Z3[3-6])/;
export function news2Galler({ alder, diagnosKoder = [] }) {
  if (alder != null && alder < NEWS2_FRAN_ALDER) return { galler: false, text: `NEWS2 används inte för barn under ${NEWS2_FRAN_ALDER} år. Systemet räknar därför ingen poäng.` };
  if (diagnosKoder.some(k => GRAVIDITET.test(k))) return { galler: false, text: 'NEWS2 används inte under graviditet. Systemet räknar därför ingen poäng.' };
  return { galler: true, text: null };
}

// Referensintervall för kurvorna. För vitalparametrarna är det området där parametern ger 0 poäng i NEWS2, och det
// står så. För labbvärdena är det demovärden för vuxna, inte ett laboratoriums egna referensintervall. INR får
// målintervallet 2,0 till 3,0 när patienten behandlas med warfarin.
const NEWS2_OMRADE = 'Området där värdet ger 0 poäng i NEWS2';
const DEMO = 'Demovärden för vuxna, inte ett laboratoriums referensintervall';
const REFERENS = {
  andningsfrekvens: { lag: 12, hog: 20, text: NEWS2_OMRADE },
  saturation: { lag: 96, hog: 100, text: NEWS2_OMRADE },
  blodtryck: { lag: 111, hog: 219, text: `${NEWS2_OMRADE}, för det systoliska trycket` },
  puls: { lag: 51, hog: 90, text: NEWS2_OMRADE },
  temp: { lag: 36.1, hog: 38.0, text: NEWS2_OMRADE },
  crp: { hog: 5, text: DEMO },
  egfr: { lag: 60, text: `${DEMO}. Under 60 i mer än tre månader talar för kronisk njursjukdom` },
  kreatinin: { kvinna: [45, 90], man: [60, 105], text: DEMO },
  hb: { kvinna: [117, 153], man: [134, 170], text: DEMO },
  kalium: { lag: 3.5, hog: 4.4, text: DEMO },
  glukos: { lag: 4.0, hog: 6.0, text: `${DEMO}, fastande` },
  hba1c: { hog: 42, text: DEMO },
  inr: { hog: 1.2, text: DEMO },
  troponin: { hog: 14, text: DEMO },
  tsh: { lag: 0.4, hog: 4.0, text: DEMO },
  smarta: { hog: 3, text: 'NRS 0 till 3, ingen eller lätt smärta' },
  gcs: { lag: 15, hog: 15, text: 'Fullt medveten' },
  // Runda 8, r1: svaren från det simulerade laboratoriet och SR (labb.js).
  lpk: { lag: 3.5, hog: 8.8, text: DEMO },
  tpk: { kvinna: [165, 387], man: [145, 348], text: DEMO },
  natrium: { lag: 137, hog: 145, text: DEMO },
  kobalamin: { lag: 140, hog: 650, text: DEMO },
  folat: { lag: 7, hog: 45, text: DEMO },
  sr: { kvinna: [0, 30], man: [0, 20], text: `${DEMO}, under 50 år` },
};
export function referens(typ, { kon = null, warfarin = false } = {}) {
  if (typ === 'inr' && warfarin) return { lag: 2.0, hog: 3.0, text: 'Målintervall vid behandling med warfarin. Systemet ser warfarin i läkemedelslistan' };
  const r = REFERENS[typ];
  if (!r) return null;
  if (r.kvinna) { const [lag, hog] = kon === 'kvinna' ? r.kvinna : r.man; return { lag, hog, text: `${r.text}, ${kon === 'kvinna' ? 'kvinnor' : 'män'}` }; }
  return { lag: r.lag ?? null, hog: r.hog ?? null, text: r.text };
}
export const utanforReferens = (v, r) => Boolean(r && Number.isFinite(v) && ((r.lag != null && v < r.lag) || (r.hog != null && v > r.hog)));

// eGFR ur P-kreatinin (µmol/L), ålder i år och kön, med CKD-EPI 2021 utan etnicitet. Avrundat till heltal.
export function ckdEpi2021(kreatinin, alder, kon) {
  const scr = kreatinin / 88.4;
  const kvinna = kon === 'kvinna';
  const k = kvinna ? 0.7 : 0.9;
  const a = kvinna ? -0.241 : -0.302;
  const v = 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** alder * (kvinna ? 1.012 : 1);
  return Math.round(v);
}

// Mätomgångar för NEWS2 ur mätvärdesrader { id, typ, varde, varde_num, tid }. För varje tidpunkt då någon av
// parametrarna mättes tas det senaste värdet av varje parameter under timmen dittills med (demoregel: värden inom en
// timme hör till samma omgång). Varje omgång har resultatet från news2() och id:n för raderna som räknades.
export const OMGANG_MS = 60 * 60_000;
const NEWS2_TYPER = { andningsfrekvens: 'andningsfrekvens', saturation: 'saturation', syrgas: 'syrgas', blodtryck: 'systoliskt', puls: 'puls', medvetande: 'medvetande', temp: 'temp' };
export const arNews2Typ = (typ) => Object.hasOwn(NEWS2_TYPER, typ);
function news2Varde(r) {
  if (r.typ === 'medvetande') return r.varde;
  if (r.typ === 'blodtryck') { const s = Number(String(r.varde).split('/')[0]); return Number.isFinite(s) ? s : null; }
  const v = r.varde_num ?? Number(r.varde);
  return Number.isFinite(v) ? v : null;
}
export function news2Omgangar(rader, { skala = 1 } = {}) {
  const relevanta = rader.filter(r => arNews2Typ(r.typ)).map(r => ({ ...r, ms: Date.parse(r.tid) })).filter(r => Number.isFinite(r.ms))
    .sort((a, b) => a.ms - b.ms || a.id - b.id);
  const tider = [...new Set(relevanta.map(r => r.ms))];
  return tider.map(t => {
    const senaste = {};
    for (const r of relevanta) if (r.ms <= t && r.ms > t - OMGANG_MS) senaste[NEWS2_TYPER[r.typ]] = r;
    const varden = Object.fromEntries(Object.entries(senaste).map(([k, r]) => [k, news2Varde(r)]));
    const vid = relevanta.filter(r => r.ms === t);
    return { tid: new Date(t).toISOString(), ankareId: Math.max(...vid.map(r => r.id)), anvanda: Object.values(senaste).map(r => r.id), resultat: news2(varden, { skala }) };
  });
}
