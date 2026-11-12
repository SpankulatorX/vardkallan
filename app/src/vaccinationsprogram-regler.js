// Reglerna för de nationella vaccinationsprogrammen utöver barnhälsovårdens doser (runda 10, r5, Sussa 3.5.1.7). Rena
// funktioner utan databas, så att barnhälsovårdens program (bhv-program.js), FHIR och API:t använder samma regler.
//
// Nationella vaccinationsprogram regleras i smittskyddslagen (2004:168) och omfattar ett allmänt program för barn och
// särskilda program för riskgrupper. Folkhälsomyndigheten meddelar föreskrifter om programmen. Här finns:
//   - barnvaccinationsprogrammets doser efter fem års ålder, som oftast ges av elevhälsan: MPR dos 2 i årskurs 1 till 2,
//     HPV i två doser i årskurs 5 och difteri, stelkramp och kikhosta dos 5 i årskurs 8 till 9,
//   - vaccination mot vattkoppor, som ingår för barn födda 1 juli 2025 eller senare från 1 januari 2027. Åldern för
//     dosen är inte fastställd, så systemet visar dosen men kan inte planera den,
//   - programmet för riskgrupper: influensa varje säsong och pneumokocker, för den som är 65 år eller äldre eller har en
//     diagnos som ger ökad risk.
// Åldrarna, intervallen, säsongen och riskgrupperna är förenklade demoregler, inte Folkhälsomyndighetens föreskrifter
// ordagrant. Åldern för vattkoppor, åldersgränsen för riskgrupperna och diagnoserna som ger ökad risk är parametrar som
// systemförvaltaren sätter (konfiguration.js), och skickas in som regler. Utan regler gäller förvalen.
const DAG = 86400_000;
const AR = 365;

export const KALLOR = {
  program: 'Folkhälsomyndigheten, Barnvaccinationsprogram och Vaccination av riskgrupper, och smittskyddslagen (2004:168) 2 kap.',
  register: 'Lag (2012:453) om register över nationella vaccinationsprogram',
};
export const DEMOREGEL = 'Demoregler: åldrarna, intervallen, influensasäsongen och riskgrupperna är förenklade för demon.';
export const PROGRAM = { barn: 'Barnvaccinationsprogrammet', riskgrupper: 'Särskilt vaccinationsprogram för riskgrupper' };

// id, text, program, serie, dos, tidigaste ålder i dagar, minsta intervall efter föregående dos i serien, ATC (WHO),
// sjukdomar, när dosen ges enligt programmet och vem som brukar ge den.
const V = (id, text, program, serie, dos, alder, { intervall = 0, foregaende = null, atc, sjukdomar, nar = null, ges = null, ...extra }) =>
  ({ id, text, program, serie, dos, alder, intervall, foregaende, atc, sjukdomar, nar, ges, ...extra });
export const VACCINER = [
  V('mpr2', 'Mässling, påssjuka och röda hund (MPR), dos 2', 'barn', 'mpr', 2, 6 * AR, { foregaende: 'mpr1', intervall: 28, atc: 'J07BD52', sjukdomar: 'Mässling, påssjuka och röda hund', nar: 'Årskurs 1 till 2', ges: 'Elevhälsan' }),
  V('hpv1', 'HPV, dos 1', 'barn', 'hpv', 1, 10 * AR, { atc: 'J07BM03', sjukdomar: 'Humant papillomvirus', nar: 'Årskurs 5', ges: 'Elevhälsan' }),
  V('hpv2', 'HPV, dos 2', 'barn', 'hpv', 2, 10 * AR, { foregaende: 'hpv1', intervall: 180, atc: 'J07BM03', sjukdomar: 'Humant papillomvirus', nar: 'Årskurs 5, minst sex månader efter dos 1', ges: 'Elevhälsan' }),
  V('dtp5', 'Difteri, stelkramp och kikhosta, dos 5', 'barn', 'dtp', 5, 14 * AR, { foregaende: 'dtp4', intervall: 5 * AR, atc: 'J07AJ52', sjukdomar: 'Difteri, stelkramp och kikhosta', nar: 'Årskurs 8 till 9', ges: 'Elevhälsan' }),
  // Vattkoppor: för barn födda 1 juli 2025 eller senare, från 1 januari 2027. Åldern är inte fastställd.
  V('vzv1', 'Vattkoppor', 'barn', 'vzv', 1, null, { atc: 'J07BK01', sjukdomar: 'Vattkoppor', nar: 'Åldern är inte fastställd', ges: 'Barnhälsovården', foddFran: '2025-07-01', fran: '2027-01-01' }),
  V('influensa', 'Influensa', 'riskgrupper', 'influensa', 1, 65 * AR, { atc: 'J07BB02', sjukdomar: 'Säsongsinfluensa', nar: 'En dos varje säsong', ges: 'Vårdcentralen', sasong: true, riskgrupp: true }),
  V('pneumokocker', 'Pneumokocker', 'riskgrupper', 'pneumokocker', 1, 65 * AR, { atc: 'J07AL02', sjukdomar: 'Pneumokocker', nar: 'En dos', ges: 'Vårdcentralen', riskgrupp: true }),
];
export const vaccinRad = (id) => VACCINER.find(v => v.id === id) ?? null;

// Influensasäsongen i demon: 1 oktober till 31 mars. Säsongen heter efter året den börjar.
export const SASONG = { fran: '10-01', till: '03-31' };
// Runda 11, r1: datumet är det svenska, också mellan 00 och 01 när UTC har gårdagens datum.
const datumI = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
export function sasongFor(nu) {
  const d = datumI(nu);
  const ar = Number(d.slice(0, 4));
  const md = d.slice(5);
  if (md >= SASONG.fran) return { pagar: true, fran: `${ar}-${SASONG.fran}`, till: `${ar + 1}-${SASONG.till}` };
  if (md <= SASONG.till) return { pagar: true, fran: `${ar - 1}-${SASONG.fran}`, till: `${ar}-${SASONG.till}` };
  return { pagar: false, fran: `${ar}-${SASONG.fran}`, till: `${ar + 1}-${SASONG.till}` };
}

export const STANDARD = { vattkopporManader: null, riskAlder: 65 };
// Diagnoser som ger ökad risk (ICD-10-prefix), demoregler. Grupperna ger texten, och parametern avgör vilka koder som räknas.
export const RISKGRUPPER = [
  { id: 'hjarta', text: 'Kronisk hjärtsjukdom', prefix: ['I50', 'I25', 'I42'] },
  { id: 'lunga', text: 'Kronisk lungsjukdom', prefix: ['J44', 'J45', 'J84'] },
  { id: 'diabetes', text: 'Diabetes', prefix: ['E10', 'E11'] },
  { id: 'njure', text: 'Kronisk njursjukdom', prefix: ['N18'] },
  { id: 'lever', text: 'Kronisk leversjukdom', prefix: ['K70', 'K74'] },
  { id: 'immun', text: 'Nedsatt immunförsvar', prefix: ['D80', 'D81', 'D82', 'D83', 'D84', 'B20'] },
];
export const STANDARD_PREFIX = RISKGRUPPER.flatMap(g => g.prefix);
// Riskgrupperna ur diagnoskoderna, med den första koden för varje grupp. prefix är de koder som parametern räknar.
export function riskgrupperFor(diagnoser = [], prefix = STANDARD_PREFIX) {
  const ut = [];
  const tillatna = new Set(prefix);
  for (const g of RISKGRUPPER) {
    const d = diagnoser.find(x => g.prefix.some(p => tillatna.has(p) && x.kod?.startsWith(p)));
    if (d) ut.push({ id: g.id, text: `${g.text} (${d.kod})` });
  }
  // Koder i parametern som inte hör till någon av grupperna.
  const ovriga = [...tillatna].filter(p => !STANDARD_PREFIX.includes(p));
  const d = diagnoser.find(x => ovriga.some(p => x.kod?.startsWith(p)));
  if (d) ut.push({ id: 'ovrig', text: `Diagnos som ger ökad risk (${d.kod})` });
  return ut;
}

const alderAr = (fodd, nu) => {
  const [y, m, d] = fodd.split('-').map(Number);
  const [ty, tm, td] = datumI(nu).split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};
// Åldern i hela dagar från födelsedagen till det svenska datumet i dag.
const alderDagar = (fodd, nu) => Math.round((Date.parse(`${datumI(nu)}T12:00:00Z`) - Date.parse(`${fodd}T12:00:00Z`)) / DAG);
// Runda 13, r4 (E2-38): en ålder i hela år räknas från födelsedagen, så att dosen vid sex års ålder ges tidigast på
// sexårsdagen och inte ett par dagar före på grund av skottår. En ålder i dagar räknas som förut.
const datumEfter = (fodd, dagar) => {
  if (dagar && dagar % AR === 0) {
    const [y, m, d] = fodd.split('-').map(Number);
    // Den som är född 29 februari fyller år 1 mars de år som inte är skottår (Date.UTC räknar över till 1 mars).
    return new Date(Date.UTC(y + dagar / AR, m - 1, d, 12)).toISOString().slice(0, 10);
  }
  return new Date(Date.parse(`${fodd}T12:00:00Z`) + dagar * DAG).toISOString().slice(0, 10);
};
const fyllt = (fodd, nu, dagar) => (dagar && dagar % AR === 0 ? datumI(nu) >= datumEfter(fodd, dagar) : alderDagar(fodd, nu) >= dagar);

// Kan dosen ges nu? Ger { ok, status, skal, varfor }. status: nu, kommande, given, ej_aktuell, ej_faststalld.
export function prova(v, { fodd, nu = Date.now(), givna = [], riskgrupper = [], regler = {} }) {
  const r = { ...STANDARD, ...regler };
  const dagar = alderDagar(fodd, nu);
  const ar = alderAr(fodd, nu);
  if (v.foddFran) {
    if (fodd < v.foddFran) return { ok: false, status: 'ej_aktuell', skal: `${v.text} ingår för barn födda ${v.foddFran} eller senare.` };
    if (!r.vattkopporManader) return { ok: false, status: 'ej_faststalld', skal: 'Vaccination mot vattkoppor ingår i barnvaccinationsprogrammet från 1 januari 2027 för barn födda 1 juli 2025 eller senare. Åldern för dosen är inte satt, eftersom Folkhälsomyndigheten inte har fastställt den. Systemförvaltaren sätter den när föreskriften finns, och då planerar systemet dosen.' };
    if (givna.some(x => x.vaccinId === v.id)) return { ok: false, status: 'given', skal: `${v.text} är redan given.` };
    if (datumI(nu) < v.fran) return { ok: false, status: 'kommande', skal: `Vaccination mot vattkoppor ingår i programmet från 1 januari 2027. Dosen ges vid ${r.vattkopporManader} månaders ålder.` };
    // Åldern räknas i hela kalendermånader från födelsedagen.
    const f = new Date(`${fodd}T12:00:00Z`);
    f.setUTCMonth(f.getUTCMonth() + r.vattkopporManader);
    const franDatum = f.toISOString().slice(0, 10);
    if (datumI(nu) < franDatum) return { ok: false, status: 'kommande', skal: `${v.text} ges vid ${r.vattkopporManader} månaders ålder, från ${franDatum}.` };
    return { ok: true, status: 'nu', skal: '' };
  }
  if (v.program === 'riskgrupper') {
    const risk = riskgrupper[0] ?? null;
    if (ar < r.riskAlder && !risk) return { ok: false, status: 'ej_aktuell', skal: `${v.text} erbjuds den som är ${r.riskAlder} år eller äldre eller tillhör en riskgrupp.` };
    const varfor = ar >= r.riskAlder ? `Patienten är ${ar} år.` : `Patienten har ${risk.text.charAt(0).toLowerCase()}${risk.text.slice(1)}.`;
    if (v.sasong) {
      const s = sasongFor(nu);
      if (!s.pagar) return { ok: false, status: 'kommande', varfor, skal: `Vaccination mot influensa ges under säsongen, som börjar ${s.fran}.` };
      const g = givna.find(x => x.vaccinId === v.id && datumI(Date.parse(x.tid)) >= s.fran);
      if (g) return { ok: false, status: 'given', varfor, skal: `Influensa är redan given den här säsongen, ${datumI(Date.parse(g.tid))}.` };
      return { ok: true, status: 'nu', varfor, skal: '' };
    }
    if (givna.some(x => x.vaccinId === v.id)) return { ok: false, status: 'given', varfor, skal: `${v.text} är redan given.` };
    return { ok: true, status: 'nu', varfor, skal: '' };
  }
  if (givna.some(x => x.vaccinId === v.id)) return { ok: false, status: 'given', skal: `${v.text} är redan given.` };
  if (!fyllt(fodd, nu, v.alder)) return { ok: false, status: 'kommande', skal: `${v.text} ges tidigast vid ${Math.round(v.alder / AR)} års ålder, ${datumEfter(fodd, v.alder)} (${v.nar.toLowerCase()}).` };
  if (v.foregaende) {
    const g = givna.find(x => x.vaccinId === v.foregaende);
    if (!g) return { ok: false, status: 'kommande', skal: `Föregående dos i serien är inte registrerad. Kontrollera barnets vaccinationer innan ${v.text.toLowerCase()} ges.` };
    const sedan = Math.floor((nu - Date.parse(g.tid)) / DAG);
    if (sedan < v.intervall) return { ok: false, status: 'kommande', skal: `Det ska gå minst ${v.intervall} dagar efter föregående dos. Dosen kan ges från ${datumI(Date.parse(g.tid) + v.intervall * DAG)}.` };
  }
  return { ok: true, status: 'nu', skal: '' };
}

// Programmet för en person: varje dos med status, och vilka doser som kan ges nu. Barnens doser visas till 18 år, och
// programmet för riskgrupper från 18 år.
export function program({ fodd, nu = Date.now(), givna = [], riskgrupper = [], regler = {} }) {
  const r = { ...STANDARD, ...regler };
  const ar = alderAr(fodd, nu);
  const rader = VACCINER.filter(v => (v.program === 'barn' ? ar < 18 : ar >= 18))
    .map(v => ({ v, p: prova(v, { fodd, nu, givna, riskgrupper, regler: r }) }))
    .filter(({ p }) => p.status !== 'ej_aktuell' || p.varfor)
    .map(({ v, p }) => ({
      id: v.id, text: v.text, program: v.program, programText: PROGRAM[v.program], sjukdomar: v.sjukdomar, nar: v.foddFran && r.vattkopporManader ? `Vid ${r.vattkopporManader} månaders ålder` : v.nar, ges: v.ges, atc: v.atc,
      status: p.status, skal: p.skal || null, varfor: p.varfor ?? null,
      given: givna.filter(g => g.vaccinId === v.id).map(g => g.tid).sort().at(-1) ?? null,
    }));
  return { rader, attGe: rader.filter(r => r.status === 'nu').map(r => ({ id: r.id, text: r.text, atc: r.atc, varfor: r.varfor })), sasong: sasongFor(nu), demoregel: DEMOREGEL, kallor: KALLOR };
}
