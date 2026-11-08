// Barnhälsovårdens program (runda 7, r6): hälsobesöken och vaccinationerna efter ålder. Rena funktioner utan databas.
//
// Besöken följer Barnhälsovårdens nationella program som Region Örebro län beskriver det i bilaga 1 till
// kravspecifikationen för barnhälsovård i Hälsoval 2026 (Dnr 25RS8809, "Barnhälsovårdens nationella program, översikt"
// och "för alla"), som bygger på Rikshandboken i barnhälsovård. Vaccinationerna följer Folkhälsomyndighetens
// barnvaccinationsprogram (folkhalsomyndigheten.se, Barnvaccinationsprogram, uppdaterad 2026-04-16). Källorna står i
// docs/kodkontroll.md. Tidsfönstren runt varje besök och intervallen mellan doserna är demoregler.
//
// Rotavirus ges här med ett vaccin i två doser (6 veckor och 3 månader). Folkhälsomyndigheten anger en tredje dos vid 5
// månader för vaccin som ges i tre doser. Vaccination mot vattkoppor ingår för barn födda 1 juli 2025 eller senare från
// 1 januari 2027 (regeringen, smittskyddsförordningen i kraft 1 november 2026). Åldern för dosen är inte fastställd på
// Folkhälsomyndighetens sida, så den finns inte med i demon.

import { vaccinRad as ovrigtVaccin } from './vaccinationsprogram-regler.js';

const DAG = 86400_000;
export const KALLOR = {
  besok: 'Region Örebro län, Kravspecifikation barnhälsovård Hälsoval 2026, bilaga 1 och 2 (Dnr 25RS8809), som bygger på Rikshandboken i barnhälsovård',
  vaccin: 'Folkhälsomyndigheten, Barnvaccinationsprogram (uppdaterad 2026-04-16)',
};
export const DEMOREGEL = 'Demoregler: tidsfönstren runt besöken och intervallen mellan doserna är förenklade för demon.';

// Hälsobesöken. alder är dagar efter födseln, fonster dagarna då besöket räknas som gjort i tid. team: läkare och
// sjuksköterska tillsammans. hem: hembesök. matt: vad som mäts. vacciner: id i VACCINER som ges vid besöket.
const B = (id, text, alder, fonster, { yrkesroll = 'sjukskoterska', team = false, hem = false, matt = ['vikt', 'langd', 'huvudomfang'], innehall = [], vacciner = [] } = {}) =>
  ({ id, text, alder, fonster, yrkesroll, team, hem, matt, innehall, vacciner });
export const BESOK = [
  B('1v', 'Hembesök vid 1 vecka', 7, [3, 14], { hem: true, innehall: ['Hälsa, tillväxt och undersökning', 'Amning och uppfödning, D-vitamin, sömn och barnsäkerhet', 'Bedömning av behov av BCG-vaccination'] }),
  B('2v', 'Besök vid 2 veckor', 14, [10, 21], { innehall: ['Hälsa, tillväxt och amning', 'Utveckling'] }),
  B('4v', 'Teambesök vid 4 veckor', 28, [24, 38], { yrkesroll: 'lakare', team: true, innehall: ['Läkarundersökning', 'Föräldra-barnkontakt'] }),
  B('6v', 'Besök vid 6 veckor', 42, [39, 55], { innehall: ['Hälsa, tillväxt och utveckling', 'EPDS-samtal med föräldern'], vacciner: ['rota1'] }),
  B('2m', 'Besök vid 2 månader', 61, [56, 75], { innehall: ['Hälsa, tillväxt och utveckling', 'Stimulans och barnsäkerhet'] }),
  B('3m', 'Besök vid 3 månader', 91, [84, 110], { innehall: ['Hälsa, tillväxt och utveckling'], vacciner: ['hexa1', 'pcv1', 'rota2'] }),
  B('4m', 'Besök vid 4 månader', 122, [112, 137], { innehall: ['Hälsa, tillväxt och utveckling', 'Enskilt samtal med den icke födande föräldern (3 till 5 månader)'] }),
  B('5m', 'Besök vid 5 månader', 152, [140, 168], { innehall: ['Hälsa, tillväxt och somatisk undersökning'], vacciner: ['hexa2', 'pcv2'] }),
  B('6m', 'Teambesök vid 6 månader', 183, [170, 210], { yrkesroll: 'lakare', team: true, innehall: ['Läkarundersökning', 'Utveckling'] }),
  B('8m', 'Hembesök vid 8 månader', 243, [228, 270], { hem: true, innehall: ['Hälsa, tillväxt och utveckling', 'Hörselanamnes', 'Barnsäkerhet i hemmet'] }),
  B('10m', 'Besök vid 10 månader', 304, [290, 335], { innehall: ['Hälsa, tillväxt och utveckling', 'Tänder och matvanor'] }),
  B('12m', 'Teambesök vid 12 månader', 365, [350, 420], { yrkesroll: 'lakare', team: true, innehall: ['Läkarundersökning', 'Utveckling'], vacciner: ['hexa3', 'pcv3'] }),
  B('18m', 'Besök vid 18 månader', 548, [530, 610], { innehall: ['Hälsa, tillväxt och utveckling', 'Språk, tänder och matvanor'], vacciner: ['mpr1'] }),
  B('30m', 'Besök vid 2,5 till 3 år', 913, [900, 1095], { matt: ['vikt', 'langd'], innehall: ['Hälsa, tillväxt och BMI', 'Språkbedömning'] }),
  B('4a', 'Besök vid 4 år', 1461, [1430, 1580], { matt: ['vikt', 'langd'], innehall: ['Hälsa, tillväxt och BMI', 'Synprövning, hörselmätning och språkbedömning'] }),
  B('5a', 'Besök vid 5 år', 1826, [1795, 1960], { matt: ['vikt', 'langd'], innehall: ['Hälsa, tillväxt och BMI', 'Epikris inför skolhälsovården'], vacciner: ['dtp4'] }),
];
export const besokRad = (id) => BESOK.find(b => b.id === id) ?? null;

// Vaccinationerna. alder är tidigaste ålder i dagar, intervall minsta antal dagar efter föregående dos i serien,
// senastStart att serien inte får påbörjas efter den åldern. atc och atcText enligt WHO:s ATC-index (kodverk.js).
const V = (id, text, serie, dos, alder, { intervall = 0, senastStart = null, senast = null, atc, sjukdomar }) => ({ id, text, serie, dos, alder, intervall, senastStart, senast, atc, sjukdomar });
export const VACCINER = [
  V('rota1', 'Rotavirus, dos 1', 'rota', 1, 42, { senastStart: 84, atc: 'J07BH01', sjukdomar: 'Rotavirus' }),
  V('rota2', 'Rotavirus, dos 2', 'rota', 2, 70, { intervall: 28, senast: 168, atc: 'J07BH01', sjukdomar: 'Rotavirus' }),
  V('hexa1', 'Sexvalent vaccin, dos 1', 'hexa', 1, 84, { atc: 'J07CA09', sjukdomar: 'Difteri, stelkramp, kikhosta, polio, Hib och hepatit B' }),
  V('hexa2', 'Sexvalent vaccin, dos 2', 'hexa', 2, 140, { intervall: 56, atc: 'J07CA09', sjukdomar: 'Difteri, stelkramp, kikhosta, polio, Hib och hepatit B' }),
  V('hexa3', 'Sexvalent vaccin, dos 3', 'hexa', 3, 335, { intervall: 180, atc: 'J07CA09', sjukdomar: 'Difteri, stelkramp, kikhosta, polio, Hib och hepatit B' }),
  V('pcv1', 'Pneumokocker, dos 1', 'pcv', 1, 84, { atc: 'J07AL02', sjukdomar: 'Pneumokocker' }),
  V('pcv2', 'Pneumokocker, dos 2', 'pcv', 2, 140, { intervall: 56, atc: 'J07AL02', sjukdomar: 'Pneumokocker' }),
  V('pcv3', 'Pneumokocker, dos 3', 'pcv', 3, 335, { intervall: 180, atc: 'J07AL02', sjukdomar: 'Pneumokocker' }),
  V('mpr1', 'Mässling, påssjuka och röda hund (MPR), dos 1', 'mpr', 1, 365, { atc: 'J07BD52', sjukdomar: 'Mässling, påssjuka och röda hund' }),
  V('dtp4', 'Difteri, stelkramp, kikhosta och polio, dos 4', 'hexa', 4, 1795, { intervall: 365, atc: 'J07CA02', sjukdomar: 'Difteri, stelkramp, kikhosta och polio' }),
  // BCG ges bara vid ökad risk för tuberkulos, efter bedömningen vid första hembesöket.
  V('bcg', 'Tuberkulos (BCG)', 'bcg', 1, 0, { atc: 'J07AN01', sjukdomar: 'Tuberkulos' }),
];
// Runda 10, r5: vaccinerna i programmen efter fem års ålder och för riskgrupper (vaccinationsprogram-regler.js) slås upp
// här också, så att text och sjukdomar följer med i listor, FHIR och Min journal.
export const vaccinRad = (id) => VACCINER.find(v => v.id === id) ?? ovrigtVaccin(id) ?? null;
// Vaccinationerna som ges senare av elevhälsan, för information.
export const ELEVHALSAN = [
  { text: 'MPR, dos 2', nar: 'Årskurs 1 till 2' },
  { text: 'HPV, två doser', nar: 'Årskurs 5' },
  { text: 'Difteri, stelkramp och kikhosta, dos 5', nar: 'Årskurs 8 till 9' },
];

export const alderDagar = (fodd, nu) => Math.floor((nu - Date.parse(`${fodd}T00:00:00Z`)) / DAG);
const datumEfter = (fodd, dagar) => new Date(Date.parse(`${fodd}T12:00:00Z`) + dagar * DAG).toISOString().slice(0, 10);

// Kan dosen ges nu? Returnerar { ok, skal }. givna: [{ vaccinId, tid }]. tbRisk: om barnet har ökad risk för tuberkulos.
export function provaVaccin(v, { fodd, nu = Date.now(), givna = [], tbRisk = false }) {
  const dagar = alderDagar(fodd, nu);
  if (givna.some(g => g.vaccinId === v.id)) return { ok: false, skal: `${v.text} är redan given.` };
  if (v.id === 'bcg' && !tbRisk) return { ok: false, skal: 'BCG ges bara till barn med ökad risk för tuberkulos. Registrera risken först om bedömningen visar det.' };
  if (dagar < v.alder) return { ok: false, skal: `${v.text} ges tidigast vid ${dagar < 0 ? 0 : Math.round(v.alder / 7) < 13 ? `${Math.round(v.alder / 7)} veckors` : `${Math.round(v.alder / 30.4)} månaders`} ålder, ${datumEfter(fodd, v.alder)}.` };
  if (v.senast != null && dagar > v.senast) return { ok: false, skal: `${v.text} ska vara given före ${Math.round(v.senast / 7)} veckors ålder och ges inte längre.` };
  if (v.dos === 1 && v.senastStart != null && dagar > v.senastStart) return { ok: false, skal: `Vaccination mot ${v.sjukdomar.toLowerCase()} påbörjas inte efter ${Math.round(v.senastStart / 7)} veckors ålder (Folkhälsomyndigheten).` };
  if (v.dos > 1) {
    const forra = VACCINER.find(x => x.serie === v.serie && x.dos === v.dos - 1);
    const given = forra && givna.find(g => g.vaccinId === forra.id);
    if (!given) return { ok: false, skal: `${forra?.text ?? 'Föregående dos'} är inte given än.` };
    const sedan = Math.floor((nu - Date.parse(given.tid)) / DAG);
    if (sedan < v.intervall) return { ok: false, skal: `Det ska gå minst ${v.intervall} dagar efter ${forra.text.toLowerCase()}. Dosen kan ges från ${new Date(Date.parse(given.tid) + v.intervall * DAG).toISOString().slice(0, 10)}.` };
  }
  return { ok: true, skal: '' };
}

// Programmet för ett barn: varje besök med datum, status och vacciner, och vilka vacciner som kan ges nu.
// besok: [{ besokId, status ('bokat' | 'genomfort'), tid }]. givna: [{ vaccinId, tid }].
export function program({ fodd, nu = Date.now(), besok = [], givna = [], tbRisk = false }) {
  const dagar = alderDagar(fodd, nu);
  const rader = BESOK.map(b => {
    const r = besok.filter(x => x.besokId === b.id).sort((x, y) => (x.status === 'genomfort' ? -1 : 1) - (y.status === 'genomfort' ? -1 : 1))[0];
    let status;
    if (r?.status === 'genomfort') status = 'genomfort';
    else if (r?.status === 'bokat') status = 'bokat';
    else if (dagar > b.fonster[1]) status = 'missat';
    else if (dagar >= b.fonster[0]) status = 'nu';
    else status = 'kommande';
    return {
      id: b.id, text: b.text, datum: datumEfter(fodd, b.alder), fran: datumEfter(fodd, b.fonster[0]), till: datumEfter(fodd, b.fonster[1]),
      yrkesroll: b.yrkesroll, team: b.team, hem: b.hem, matt: b.matt, innehall: b.innehall, status, tid: r?.tid ?? null,
      vacciner: b.vacciner.map(id => { const v = vaccinRad(id); const g = givna.find(x => x.vaccinId === id); return { id, text: v.text, sjukdomar: v.sjukdomar, given: g?.tid ?? null }; }),
    };
  });
  const attGe = VACCINER.map(v => ({ v, p: provaVaccin(v, { fodd, nu, givna, tbRisk }) })).filter(x => x.p.ok)
    .map(({ v }) => ({ id: v.id, text: v.text, sjukdomar: v.sjukdomar, atc: v.atc }));
  // Nästa besök att boka: det första som inte är gjort eller bokat och vars fönster inte har passerat.
  const nasta = rader.find(r => r.status === 'nu' || r.status === 'kommande') ?? null;
  const missade = rader.filter(r => r.status === 'missat');
  let text;
  if (!nasta) text = 'Alla besök i barnhälsovårdens program är gjorda eller passerade.';
  else if (nasta.status === 'nu') text = `${nasta.text} ska göras nu, senast ${nasta.till}.`;
  else text = `Nästa besök är ${nasta.text.toLowerCase()} omkring ${nasta.datum} (${nasta.fran} till ${nasta.till}).`;
  return { besok: rader, nasta, missade, attGe, text, demoregel: DEMOREGEL, kallor: KALLOR, elevhalsan: ELEVHALSAN };
}
