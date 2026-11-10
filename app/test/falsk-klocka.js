// Runda 11, r1: falsk klocka för servertesterna. Läses in före testerna med
//   bun test --preload ./test/falsk-klocka.js
// och miljövariabeln FALSK_NU (en tid som Date kan tolka, helst ISO i UTC, till exempel 2026-11-12T22:30:00Z).
// Klockan står då still på den tiden under hela körningen. Utan FALSK_NU gör filen ingenting.
// scripts/klocktest.js kör hela sviten vid en lista med tider. Se avsnittet om tid i docs/design.md.
import { setSystemTime } from 'bun:test';

const varde = process.env.FALSK_NU;
export const FALSK_NU = varde ? new Date(varde) : null;
// En tid som inte går att tolka stoppar körningen, så att ingen tror att sviten är grön vid en tid den aldrig kördes vid.
if (FALSK_NU && Number.isNaN(FALSK_NU.getTime())) throw new Error(`FALSK_NU går inte att tolka som en tid: ${varde}`);
if (FALSK_NU) setSystemTime(FALSK_NU);

// Tester som själva styr klockan återställer den med denna i stället för setSystemTime(), så att nästa test och nästa
// fil fortsätter vid den falska tiden och inte vid den verkliga.
export function aterstallKlockan() {
  if (FALSK_NU) setSystemTime(FALSK_NU);
  else setSystemTime();
}
