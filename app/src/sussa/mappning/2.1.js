// Sussa 2.1 Systemuppbyggnad Kärnsystem: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, KR } = TEST;
const SU = 'Systemuppbyggnad > ';

export default [
  // Runda 9, r6: förteckningen över moduler med tillverkare, de fem perspektiven, lastmätningen och totalkostnaden
  // (arkitektur.js och app/test/runda9-r6-arkitektur.test.js).
  {
    id: '2.1.1.1', kategori: 'system', egna: ['D5', 'D7', 'M12'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}hälsa och Server-Timing på alla svar`,
      `${A}drift visar p50 och p95 per adress i API:t`,
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
      `${SU}förteckningen har varje modul i src och public med skikt, tillverkare, beskrivning och kraven den stödjer`,
      `${SU}de fem perspektiven i kravtexten finns och pekar på moduler som finns`,
      `${SU}lastmätning: 20 samtidiga användare med var sin sandlåda läser journalen med p95 under 500 ms`,
      `${SU}totalkostnaden räknas ur mätningen och antagandena, och antagandena står i svaret`,
    ],
    losning: 'Ett system med en kodbas: gränssnitt, server, behörighetsmotor, åtkomstlogg, journal, läkemedel, remiss, Min journal och FHIR-API delar samma regler. Systemuppbyggnaden beskrivs i de fem perspektiv som kravet räknar upp (kontextuell, konceptuell, logisk, fysisk och moduler) i arkitektur.js, under Systemuppbyggnad på sidan Drift och i GET /api/arkitektur, och i docs/design.md. Förteckningen enligt svarsbilaga K9 räknas fram ur källkoden vid varje start: varje modul med skikt, tillverkare, beskrivning och de krav som den stödjer, och komponenterna från andra tillverkare för sig. Kvalitet och förvaltningsbarhet: bygget stoppas av röda tester, svarstiden mäts på varje anrop, och en lastmätning med 20 samtidiga användare ska ge p95 under 500 ms. Totalkostnaden per användare och månad räknas ur serverns uppmätta minne per sandlåda och uttalade antaganden om pris och drift, utan licenskostnad.',
    expert: 'Hela systemet har ett gränssnitt och samma regler för behörighet och loggning överallt, så användaren behöver inte veta vilken modul en uppgift ligger i. Förteckningen och kostnaden räknas fram av systemet självt, så de kan inte bli inaktuella.',
    anmarkning: 'Lastmätningen görs mot demons server i testmiljön, inte mot ett produktionssystem med verklig last. Totalkostnaden är en modell: priset för en server, andelen samtidigt inloggade och driftens timmar är antaganden som står i svaret. Beskrivningen är kortare än de 50 sidor kravet tillåter.',
  },
];
