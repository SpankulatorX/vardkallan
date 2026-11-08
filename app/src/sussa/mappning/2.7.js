// Sussa 2.7 Språk och författning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, L, J, M } = TEST;
const SPRAK = 'Språk > ';

export default [
  { id: '2.7.1.1', kategori: 'leverantor', egna: ['L11', 'M13'], tester: [], avsedd: 'planerat',
    anmarkning: 'Vårdkällan är inte CE-märkt. Läkemedelsvarningarna är märkta som demoregler.' },
  {
    id: '2.7.1.2', kategori: 'system', egna: ['L1', 'L2', 'L3', 'L4', 'L6', 'L7', 'L13'], avsedd: 'delvis',
    tester: [
      `${J}signerad anteckning kan inte ändras i databasen (trigger)`,
      `${B}spärr: aktivt val häver inte spärren`,
      `${B}nödåtkomst: häver aldrig en spärr`,
      `${L}UPDATE på loggen avbryts av trigger`,
      `${B}skyddad identitet: namn och personnummer maskeras`,
      `${M}ordinationsorsak är obligatorisk`,
    ],
    losning: 'Delar av patientdatalagen och HSLF-FS 2016:40 är byggda och testade: journalen kan inte ändras i efterhand, spärr och nödåtkomst följer lagen, varje åtkomst loggas och skyddad identitet maskeras.',
    expert: 'Lagkraven ligger i serverns regler, så användaren behöver inte kunna patientdatalagen: systemet frågar efter aktivt val, samtycke eller syfte just när lagen kräver det.',
    anmarkning: 'Lag 2022:913, MDR, NIS2, arkivlagen och tillgänglighetslagen är inte uppfyllda, och ingen juridisk granskning är gjord. Se de egna kraven L1 till L13.',
  },
  // Runda 5 (r3): språkkontrollen i app/test/sprak.test.js.
  {
    id: '2.7.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${SPRAK}gränssnittets texter är svenska, utan engelska ord, tankstreck, ellipser och interna anteckningar`,
      `${SPRAK}serverns felmeddelanden och varningar är svenska`,
      `${SPRAK}inga tankstreck, ellipser eller interna anteckningar någonstans i public/ och src/, inte heller i kommentarer`,
      `${SPRAK}kontrollen hittar engelska ord, okända förkortningar, tankstreck, ellipser och interna anteckningar`,
      `${SPRAK}kontrollen hittar å, ä och ö som saknas`,
    ],
    losning: 'Hela gränssnittet, Min journal och serverns felmeddelanden och varningar är på svenska. Vid varje bygge går ett test igenom alla texter som visas och stoppar bygget vid ett engelskt ord, ett tankstreck, en ellips, ett ord där å, ä eller ö saknas eller en intern anteckning. De sista lånorden är utbytta mot svenska ord (inget svar i tid, uppkopplad, syremättnad och tomt), och kontrollen stoppar de engelska orden om de kommer tillbaka.',
    expert: 'Systemet förklarar på vanlig svenska varför något inte går, och språkkontrollen ser till att ingen text på engelska eller med kodverkets namn når användaren.',
    anmarkning: 'Kontrollen bygger på en lista över vanliga engelska ord och en lista över tillåtna lånord, förkortningar och egennamn (FHIR, SITHS, NPÖ, ATC och andra). Ett engelskt ord som inte står i listan och inte har w upptäcks inte. Patientuppgifterna i demon (anteckningar och namn) kontrolleras inte, och ingen språkgranskning av en människa är gjord. FHIR-svarens kodverk (LOINC, ATC) har kodverkens engelska benämningar, som inte visas i gränssnittet. Sussas användbarhetstester (runda 7) spelas i det svenska gränssnittet, och formulären för SUS och expertgranskning är på svenska, med Sussas egen formulering av SUS.',
  },
];
