// Sussa 3.3.2 Egen vårdbegäran: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 6, r4.
import { medR4 } from '../planering-r4.js';

const AVSNITT = [
  { id: '3.3.2.1', kategori: 'system', egna: ['L5'], tester: [], avsedd: 'planerat',
    anmarkning: 'Egen vårdbegäran från invånaren är inte byggd. Den kan byggas i Min journal.' },
];

// Runda 6, r4: posten byggdes i rundan och ersätts ur sussa/planering-r4.js.
export default medR4(AVSNITT);
