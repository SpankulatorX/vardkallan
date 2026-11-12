// Sussa 11.1 Införande och förändringsarbete: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

// Runda 14, r5: leverantörens åtaganden, servicenivåerna, utbildningsmaterialet och innovationsrummet (sussa/runda14-r5.js).
import { medR14r5 } from '../runda14-r5.js';

const R14_FORE = [
  { id: '11.1.1.1', kategori: 'leverantor', egna: ['M10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens förslag på förändringsarbete.' },
  { id: '11.1.1.2', kategori: 'leverantor', egna: ['M10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens förändringsarbete.' },
];
export default medR14r5(R14_FORE);
