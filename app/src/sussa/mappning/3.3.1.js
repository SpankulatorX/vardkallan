// Sussa 3.3.1 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 6, r4.
import { medR4 } from '../planering-r4.js';

const { A, R, GK } = TEST;

const AVSNITT = [
  {
    id: '3.3.1.1', kategori: 'system', egna: ['D1', 'M4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${R}statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat`,
      `${R}steg kan inte hoppas över`,
      `${R}ny remiss valideras`,
      `${A}helflöde: remiss genom hela statuskedjan`,
      `${GK}Skicka remiss inom budget`,
    ],
    losning: 'Remiss med statuskedjan skickad, mottagen, bedömd, besvarad och svar kvitterat, inom vårdgivaren.',
    expert: 'Systemet fyller i avsändare och patient, visar var remissen är i kedjan och tillåter bara nästa steg, så ingen behöver kunna remissflödets regler.',
    anmarkning: 'Gäller remisser inom vårdgivaren. Bilagor och vårdbegäran till externa vårdgivare saknas (3.3.1.2).',
  },
  { id: '3.3.1.2', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Vårdbegäran till och från externa vårdgivare kräver e-remiss eller annan extern anslutning, som inte är byggd.' },
  {
    id: '3.3.1.3', kategori: 'system', egna: ['D1'], avsedd: 'delvis',
    tester: [
      `${R}seeden har remisser i varje läge och larm`,
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      `${R}vårdadministratör ser status men inte klinisk text`,
    ],
    losning: 'Remisser visas per patient och i en översikt över inkommande och utgående, och det som väntar på åtgärd visas i inkorgen.',
    expert: 'Inkorgen visar självt vad som väntar på åtgärd, och vårdadministratören ser status utan klinisk text.',
    anmarkning: 'Presentation av bilagor och av vårdbegäran från externa vårdgivare saknas.',
  },
  {
    id: '3.3.1.4', kategori: 'system', egna: ['D1'], avsedd: 'delvis',
    tester: [
      `${R}ny remiss valideras`,
      `${GK}Skicka remiss inom budget`,
      `${A}helflöde: remiss genom hela statuskedjan`,
    ],
    losning: 'En remiss skapas från patientens journal och valideras innan den skickas.',
    expert: 'Systemet fyller i patient, avsändare och enhet och säger på vanlig svenska vad som saknas, så användaren skriver bara frågeställningen.',
    anmarkning: 'Bilagor saknas, och utkast till remiss kan inte sparas.',
  },
  {
    id: '3.3.1.5', kategori: 'system', egna: ['D1'], avsedd: 'delvis',
    tester: [
      `${R}bara mottagande enhet kan kvittera, bedöma och svara`,
      `${R}avvisning kräver motivering och avslutar kedjan`,
      `${R}bara avsändaren kan kvittera svaret`,
      `${GK}Kvittera remissvar inom budget`,
    ],
    losning: 'Mottagande enhet kvitterar, bedömer, svarar eller avvisar med motivering, och avsändaren kvitterar svaret.',
    expert: 'Systemet visar bara de steg som enheten får ta just då, så ingen behöver veta vem som ska kvittera vad.',
    anmarkning: 'Vidarebefordran till en annan enhet saknas.',
  },
  {
    id: '3.3.1.6', kategori: 'system', egna: ['D1', 'M4'], avsedd: 'delvis',
    tester: [
      `${R}larm: mottagningskvittens saknas efter 2 timmar`,
      `${R}larm: svar saknas efter sista svarsdatum`,
      `${R}larm: svar inte kvitterat efter 3 dagar`,
    ],
    losning: 'Larm när mottagningskvittens saknas efter 2 timmar, när svaret inte kommit före sista svarsdatum och när svaret inte kvitterats efter 3 dagar.',
    expert: 'Systemet bevakar tiderna självt och larmar i inkorgen, så ingen behöver komma ihåg att följa upp en remiss.',
    anmarkning: 'Ledtider på enhets- och regionnivå och statistik över avvikelser saknas.',
  },
];

// Runda 6, r4: posterna som byggdes i planering och tidbok, del 2, och remiss, del 2, ersätts ur sussa/planering-r4.js.
export default medR4(AVSNITT);
