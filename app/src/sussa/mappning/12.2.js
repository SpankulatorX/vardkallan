// Sussa 12.2 Test: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

// Runda 14, r5: leverantörens åtaganden, servicenivåerna, utbildningsmaterialet och innovationsrummet (sussa/runda14-r5.js).
import { medR14r5 } from '../runda14-r5.js';

const R14_FORE = [
  { id: '12.2.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: '12.2.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: '12.2.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
];
export default medR14r5(R14_FORE);
