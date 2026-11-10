// Runda 11, r1: falsk klocka för servertesterna. Läses in före testerna med
//   bun test --preload ./test/falsk-klocka.js
// och miljövariabeln FALSK_NU (en tid som Date kan tolka, helst ISO i UTC, till exempel 2026-11-12T22:30:00Z).
// Klockan visar då FALSK_NU när körningen börjar och går sedan som vanligt, som i verkligheten, så att två saker som görs
// efter varandra får olika tider. Utan FALSK_NU gör filen ingenting. scripts/klocktest.js kör hela sviten vid en lista
// med tider. Se avsnittet om tid i docs/design.md.
//
// Tester som själva styr klockan gör det med stallKlockan(tid) och återställer den med aterstallKlockan(), i stället för
// setSystemTime från bun:test. Med falsk klocka fortsätter då nästa test och nästa fil vid den falska tiden.
import { setSystemTime } from 'bun:test';
import { forskjutenDate } from '../src/testklocka.js';

const RiktigDate = globalThis.Date;
const varde = process.env.FALSK_NU;
export const FALSK_NU = varde ? new RiktigDate(varde) : null;
// En tid som inte går att tolka stoppar körningen, så att ingen tror att sviten är grön vid en tid den aldrig kördes vid.
if (FALSK_NU && Number.isNaN(FALSK_NU.getTime())) throw new Error(`FALSK_NU går inte att tolka som en tid: ${varde}`);

// Hur mycket den falska klockan ligger före eller efter den riktiga. 0 när ett test har satt en fast tid.
let forskjutning = 0;
const start = performance.now();
const loper = () => { forskjutning = FALSK_NU.getTime() + (performance.now() - start) - RiktigDate.now(); };
if (FALSK_NU && !globalThis.__falskKlocka) {
  globalThis.__falskKlocka = true;
  loper();
  globalThis.Date = forskjutenDate(RiktigDate, () => forskjutning);
}

// Ställer klockan på en fast tid som står still, som setSystemTime.
export function stallKlockan(tid) {
  forskjutning = 0;
  setSystemTime(tid);
}

// Återställer klockan: till den falska tiden (som fortsätter att gå från körningens början) eller till den riktiga.
export function aterstallKlockan() {
  setSystemTime();
  if (FALSK_NU) loper();
}
