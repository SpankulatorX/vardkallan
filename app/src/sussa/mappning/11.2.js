// Sussa 11.2 Grundimplementation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, KR, LK, GA, SR } = TEST;

export default [
  { id: '11.2.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller hur leverantören driver grundimplementationen.' },
  { id: '11.2.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens organisation.' },
  { id: '11.2.1.3', kategori: 'leverantor', egna: ['M10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller samverkan mellan leverantör och beställare.' },
  { id: '11.2.1.4', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Det finns inget utbildningsmaterial i form av e-learning eller instruktionsfilmer.' },
  {
    id: '11.2.1.5', kategori: 'leverantor', egna: ['D7', 'K4'], avsedd: 'delvis',
    tester: [
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
      `${KR}saknade eller röda tester ger delvis`,
    ],
    losning: 'Testerna skrivs före koden, körs i varje bygge och i GitHub Actions, och bygget stoppas om ett test är rött.',
    anmarkning: 'Testmetoden är dokumenterad i projektet men är inte en standardiserad metod för leveranstest.',
  },
  { id: '11.2.1.6', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens ansvar för tester fram till beställarens acceptanstest.' },
  {
    id: '11.2.1.7', kategori: 'leverantor', egna: ['K1', 'K4'], avsedd: 'delvis',
    tester: [
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
      `${SR}alla 305 id finns exakt en gång, och varje post har en mappning`,
      `${SR}uppfyllt_demo kräver gröna tester`,
      `${A}krav visar kravregistret`,
    ],
    losning: 'Kravregistret visar för varje eget krav och varje Sussa-post vilka tester som visar det, och status från det senaste bygget.',
    anmarkning: 'Inget acceptanstest med en beställare är gjort, och testprotokollet är kravregistret i demon.',
  },
  {
    id: '11.2.1.8', kategori: 'leverantor', egna: ['D4'], avsedd: 'delvis',
    tester: [
      `${LK}innehåller bara det servern redan lämnar ut till den inloggade`,
      `${LK}yrkesrollen styr vad läskopian innehåller`,
      `${GA}appen startar utan nät från service workern och visar läsläget`,
      `${GA}fel reservkod ger väntetid och rätt reservkod öppnar läsläget`,
    ],
    losning: 'Läskopian vid avbrott innehåller arbetslistan och kopierade patienter med läkemedelslistan, och går att läsa när servern inte svarar.',
    anmarkning: 'Läskopian görs vid inloggning och förnyas under samma inloggning. Att informationen aldrig är äldre än 10 minuter är inte mätt, och administrerade läkemedel registreras inte i demon.',
  },
  { id: '11.2.1.9', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens projektplan.' },
  { id: '11.2.1.10', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens projektplan.' },
  { id: '11.2.1.11', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens utbildningsplan. Testprotokollet för användartest (docs/anvandartest.md) är inte en utbildningsplan.' },
  { id: '11.2.1.12', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens utbildningsinsatser.' },
];
