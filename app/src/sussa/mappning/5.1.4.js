// Sussa 5.1.4 Integrationer: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { M } = TEST;

export default [
  {
    id: '5.1.4.1', kategori: 'nationell', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`,
      `${M}NLL: felsvar syns och avstämning skickar igen`,
    ],
    losning: 'Ordinationer förs över till en simulerad Nationell läkemedelslista med kvittens och avstämning.',
    expert: 'Systemet döljer aldrig en registrerad förskrivning vid timeout, utan stämmer av själv och visar avvikelsen i inkorgen.',
    anmarkning: 'Simulerat. Ingen anslutning till E-hälsomyndigheten, och makulering av e-recept saknas.',
  },
  { id: '5.1.4.2', kategori: 'nationell', egna: ['D10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Sil är inte ansluten. Läkemedelsvarningarna är egna demoregler.' },
  { id: '5.1.4.3', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Dosförskrivning via Pascal är inte ansluten.' },
  { id: '5.1.4.4', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Födelseanmälan till Skatteverket är inte byggd.' },
  { id: '5.1.4.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Integration med produktionssystem för beställning och svar är inte byggd.' },
  { id: '5.1.4.6', kategori: 'nationell', egna: ['L9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Listningen ligger i seeden och ger vårdrelation, men hämtas inte från en extern källa.' },
];
