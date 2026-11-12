// Sussa 11.3 Implementation av specialområden: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

// Runda 14, r5: leverantörens åtaganden, servicenivåerna, utbildningsmaterialet och innovationsrummet (sussa/runda14-r5.js).
import { medR14r5 } from '../runda14-r5.js';

const R14_FORE = [
  { id: '11.3.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.4', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  // Runda 7, r6: planen för införande av tillväxt och barnhälsovård (bhv-plan.js).
  {
    id: '11.3.1.5', kategori: 'leverantor', egna: [], avsedd: 'delvis',
    tester: ['Plan för införande av tillväxt > planen har alla delar som Sussa 11.3.1.1 kräver och visas på barnavårdscentralens sida'],
    losning: 'En plan för införandet av tillväxt och barnhälsovård med de elva delar som 11.3.1.1 kräver: organisation, leveransobjekt, tidplan, milstolpar, roller, test, utbildning, risker, ändringshantering och beställarens del. Planen visas på sidan Barnhälsovård.',
    anmarkning: 'Planen är ett förslag från projektet och är inte överenskommen eller godkänd av någon beställare. Planerna för de andra specialområdena finns inte.',
  },
  { id: '11.3.1.6', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.7', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.8', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.9', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
  { id: '11.3.1.10', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens planer för implementation av specialområden.' },
];
export default medR14r5(R14_FORE);
