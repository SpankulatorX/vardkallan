// Sussa 2.1 Systemuppbyggnad Kärnsystem: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, KR } = TEST;

export default [
  {
    id: '2.1.1.1', kategori: 'system', egna: ['D5', 'D7', 'M12'], avsedd: 'delvis',
    tester: [
      `${A}hälsa och Server-Timing på alla svar`,
      `${A}drift visar p50 och p95 per endpoint`,
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
    ],
    losning: 'Ett system med en kodbas: server, behörighetsmotor, åtkomstlogg, journal, läkemedel, remiss, Min journal och FHIR-API delar samma regler. Svarstiden mäts på varje anrop och bygget stoppas av röda tester.',
    expert: 'Hela systemet har ett gränssnitt och samma regler för behörighet och loggning överallt, så användaren behöver inte veta vilken modul en uppgift ligger i.',
    anmarkning: 'Arkitekturen beskrivs i docs/design.md. Prestanda är inte mätt med verklig last, totalkostnaden är inte beräknad och det finns ingen förteckning enligt svarsbilaga K9.',
  },
];
