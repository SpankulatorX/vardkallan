// Runda 13, r3 (beslut från Jonas): prisbasbeloppen och lagens tak för patientavgifterna. Taken räknas ur
// prisbasbeloppet för det år en ändring gäller, så att en parameter aldrig kan sättas över lagens tak. Kontrollerat mot
// Riksdagens text för hälso- och sjukvårdslagen (2017:30) i lydelse till och med SFS 2026:1312, 2026-11-11.
//
//   17 kap. 2 §  avgiften för sluten vård får vara högst 0,0023 prisbasbelopp per vårddag.
//   17 kap. 3 §  patienter som har fyllt 85 år betalar inte vårdavgifter eller avgifter för förbrukningsartiklar i
//                öppen vård. Regionen får sänka gränsen men inte höja den.
//   17 kap. 6 §  högkostnadsskyddet för öppen vård är högst 0,025 prisbasbelopp, avrundat nedåt till närmaste
//                femtiotal kronor, eller det lägre belopp som regionen bestämmer.
//
// Avgiftsfriheten för barn och unga står inte i lagen. Den är regionens beslut.

// Prisbasbeloppet enligt 2 kap. 6 och 7 §§ socialförsäkringsbalken, som regeringen fastställer för varje år.
export const PRISBASBELOPP = Object.freeze({ 2025: 58800, 2026: 59200, 2027: 59600 });
export const LAGRUM = Object.freeze({
  sluten: '17 kap. 2 § hälso- och sjukvårdslagen (2017:30)',
  avgiftsfri85: '17 kap. 3 § hälso- och sjukvårdslagen (2017:30)',
  hogkostnad: '17 kap. 6 § hälso- och sjukvårdslagen (2017:30)',
});
export const AVGIFTSFRI_ALDER_LAG = 85;

const KANDA = Object.keys(PRISBASBELOPP).map(Number).sort((a, b) => a - b);
// Året för ett datum (ÅÅÅÅ-MM-DD, en Date eller ett år).
export const arFor = (d) => (typeof d === 'number' ? d : d instanceof Date ? d.getFullYear() : Number(String(d ?? '').slice(0, 4)) || new Date().getFullYear());

// Prisbasbeloppet för ett år. För ett år som inte finns i tabellen används det närmaste kända året, och svaret säger det.
export function prisbasbelopp(datum) {
  const ar = arFor(datum);
  if (Object.hasOwn(PRISBASBELOPP, ar)) return { ar, belopp: PRISBASBELOPP[ar], kant: true };
  const narmast = ar > KANDA.at(-1) ? KANDA.at(-1) : KANDA[0];
  return { ar, belopp: PRISBASBELOPP[narmast], kant: false, narmast };
}

const kronor = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kronor`;
const pbbText = (p) => (p.kant ? `Prisbasbeloppet för ${p.ar} är ${kronor(p.belopp)}` : `Prisbasbeloppet för ${p.ar} är inte fastställt i Vårdkällan, så systemet räknar med ${p.narmast} års, ${kronor(p.belopp)}`);

// Högsta högkostnadsskydd: 0,025 prisbasbelopp avrundat nedåt till närmaste femtiotal kronor.
export function hogkostnadstak(datum) {
  const p = prisbasbelopp(datum);
  const tak = Math.floor(Math.round(p.belopp * 25) / 1000 / 50) * 50;
  return { tak, text: `Högkostnadsskyddet får vara högst 0,025 prisbasbelopp, avrundat nedåt till närmaste femtiotal kronor (${LAGRUM.hogkostnad}). ${pbbText(p)}, så taket är ${kronor(tak)}.` };
}

// Högsta avgift per vårddag i sluten vård: 0,0023 prisbasbelopp, i hela kronor nedåt.
export function slutenvardstak(datum) {
  const p = prisbasbelopp(datum);
  const tak = Math.floor(Math.round(p.belopp * 23) / 10000);
  return { tak, text: `Avgiften i sluten vård får vara högst 0,0023 prisbasbelopp per vårddag (${LAGRUM.sluten}). ${pbbText(p)}, så taket är ${kronor(tak)} per vårddag.` };
}
