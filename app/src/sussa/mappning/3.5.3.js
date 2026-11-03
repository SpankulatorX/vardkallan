// Sussa 3.5.3 Vätskebalans: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

// Vätskebalansen (app/test/administrering.test.js).
const VB = 'Vätskebalans > ';

export default [
  {
    id: '3.5.3.1', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${VB}vätskebalansen räknar in administrerad volym av sig själv`],
    losning: 'Vätskebalans per patient och dygn: intag (dryck, mat och sondnäring, infusion och läkemedel) och förluster (urin, dränage, kräkning och avföring) med summa in, summa ut och balans. Administrerade läkemedel räknas in av systemet.',
    expert: 'Systemet för in volymen från läkemedelsadministreringen själv och räknar summorna, så den som registrerar bara anger det som har mätts.',
    anmarkning: 'Läsningen följer inre sekretess som mätvärdena. Kalorier, vikt och förväntad vätskebalans saknas.',
  },
  {
    id: '3.5.3.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${VB}vätskebalansen räknar in administrerad volym av sig själv`],
    losning: 'Vätskebalansen visas per dygn med varje post, summa in, summa ut och balans. Dygnsbrytningen kan väljas i API:t (brytning).',
    expert: 'Systemet sorterar posterna i tidsordning och märker de poster som kommer från administreringen.',
    anmarkning: 'Gränssnittet visar bara i dag med dygnsbrytning vid midnatt. Filtrering och kalorier saknas.',
  },
  { id: '3.5.3.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Förväntad vätskebalans framåt i tiden är inte byggd.' },
];
