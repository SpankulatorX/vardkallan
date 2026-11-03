// Sussa 5.1.1 Generella behov kring arkitektur: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, S } = TEST;

export default [
  { id: '5.1.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ingen koppling till kontorsinformationsstöd är byggd.' },
  {
    id: '5.1.1.2', kategori: 'system', egna: ['D3', 'M5'], avsedd: 'delvis',
    tester: [
      `${A}migreringsavstämningen visar avvikelsen`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
    ],
    losning: 'Migrerad historik från VAS och Cosmic läses in med källa och avstäms, och avvikelser visas i en avstämningsrapport.',
    expert: 'Systemet stämmer av migreringen självt och visar varje avvikelse, så ingen behöver jämföra det gamla och det nya systemet för hand.',
    anmarkning: 'Ingen riktig migrering görs. Avstämningen räknas på seedens migrerade poster.',
  },
  { id: '5.1.1.3', kategori: 'system', egna: ['D11'], tester: [], avsedd: 'planerat',
    anmarkning: 'Formulär kan inte skapas eller ändras av verksamheten. Mallarna är fasta i koden.' },
  { id: '5.1.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Start och synkronisering av externa tillämpningar är inte byggd.' },
];
