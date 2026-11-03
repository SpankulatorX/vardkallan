// Sussa 3.1.8 Sök: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A } = TEST;

export default [
  {
    id: '3.1.8.1', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}sök på namn hittar namn med å, ä och ö oavsett skiftläge`,
      `${A}sökningen loggas`,
    ],
    losning: 'Patientsök på namn eller personnummer i hela regionen, med maskering av skyddad identitet och loggning av varje sökning.',
    expert: 'Samma sökfält tar namn eller personnummer och systemet avgör självt vilket det är, och skyddade patienter maskeras utan att användaren behöver tänka på det.',
    anmarkning: 'Sökning i journalinnehållet saknas.',
  },
  {
    id: '3.1.8.2', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}sök på namn hittar namn med å, ä och ö oavsett skiftläge`,
    ],
    losning: 'Patientsök på namn eller personnummer.',
    expert: 'Sökningen tål skiftläge och å, ä och ö, så användaren behöver inte skriva namnet exakt.',
    anmarkning: 'Sökning i anteckningar, diagnoser och läkemedel saknas.',
  },
];
