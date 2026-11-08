// Sussa 10.1 Kontinuerlig kompetensutveckling: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r2: posterna för tillgänglighet, skärmanpassning, nyheter och intyg ersätts ur sussa/runda7-r2.js.
import { medR7r2 } from '../runda7-r2.js';

const AVSNITT = [
  { id: '10.1.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: '10.1.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: '10.1.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: '10.1.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Förändrat gränssnitt är inte byggt ännu (runda 7)." },
  { id: '10.1.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Certifierade användare är inte byggt ännu (runda 7)." },
];
export default medR7r2(AVSNITT);
