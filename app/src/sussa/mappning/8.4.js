// Sussa 8.4 Fokus på verksamhets- och patientnytta samt att stödja användarnas behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r2: posterna för tillgänglighet, skärmanpassning, nyheter och intyg ersätts ur sussa/runda7-r2.js.
import { medR7r2 } from '../runda7-r2.js';

const AVSNITT = [
  { id: '8.4.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Fokus på verksamhets- och patientnytta samt att stödja användarnas behov är inte byggt ännu (runda 7)." },
  { id: '8.4.1.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Användarcentrerad design är inte byggt ännu (runda 7)." },
  { id: '8.4.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Användbarhet och tillgänglighet är inte byggt ännu (runda 7)." },
];
export default medR7r2(AVSNITT);
