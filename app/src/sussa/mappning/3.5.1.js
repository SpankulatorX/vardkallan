// Sussa 3.5.1 Stöd för läkemedelshantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, A, M } = TEST;

export default [
  {
    id: '3.5.1.1', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${A}helflöde: ordination med varning, kvittens och NLL-timeout med avstämning`,
    ],
    losning: 'En gemensam läkemedelslista för patienten med ordination, utsättning, varningar och överföring till NLL.',
    expert: 'Läkemedelslistan visar alla enheters ordinationer utan aktivt val men aldrig spärrade uppgifter, så användaren ser helheten utan att behöva välja.',
    anmarkning: 'Iordningsställande, administrering och överföringar mellan vårdprocesser saknas, och NLL är simulerad.',
  },
  {
    id: '3.5.1.2', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}spärrade enheters ordinationer visas inte i läkemedelslistan`,
    ],
    losning: 'Läkemedelslistan visar aktuella och utsatta ordinationer med orsak, dos, uppföljningsdatum och NLL-status.',
    expert: 'Systemet visar aktuella ordinationer först och de utsatta med orsak, så användaren behöver inte filtrera själv.',
    anmarkning: 'Vyer för administrering och dosering över tid saknas.',
  },
  { id: '3.5.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Fördefinierade ordinationer är inte byggda. Ordinationsformuläret föreslår uppföljningsdatum.' },
  { id: '3.5.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Stöd för spädning och tillsatser är inte byggt.' },
  {
    id: '3.5.1.5', kategori: 'system', egna: ['D10', 'L11'], avsedd: 'delvis',
    tester: [
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      `${M}varning: dubbelordination av samma substans`,
      `${M}varning: samma ATC-grupp ger observera`,
      `${M}varning: warfarin och NSAID`,
      `${M}varning: två antikoagulantia`,
      `${M}varning: metformin vid lågt eGFR`,
      `${M}allvarlig varning måste kvitteras med motivering`,
      `${M}varningarna är märkta som demoregler`,
    ],
    losning: 'Varningar vid ordination: överkänslighet, dubbelordination, samma ATC-grupp, warfarin med NSAID, två antikoagulantia och metformin vid lågt eGFR. En allvarlig varning måste kvitteras med motivering.',
    expert: 'Systemet kontrollerar varje ordination mot journalen innan den sparas och förklarar varningen på vanlig svenska, så förskrivaren inte behöver kunna interaktionerna själv.',
    anmarkning: 'Varningarna är demoregler och inte kliniskt beslutsstöd. Ingen anslutning till Sil eller Janusmed, och ingen MDR-bedömning är gjord.',
  },
  { id: '3.5.1.6', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Läkemedelsgenomgång är inte byggd.' },
  { id: '3.5.1.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Stöd för nationella vaccinationsprogram är inte byggt.' },
  {
    id: '3.5.1.8', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}spärrade enheters ordinationer visas inte i läkemedelslistan`,
      `${M}NLL: normal överföring kvitteras`,
    ],
    losning: 'Ordinationer och förskrivningar visas i läkemedelslistan med NLL-status för varje överföring.',
    expert: 'Systemet visar själv om överföringen till NLL är kvitterad, så användaren behöver inte kontrollera det i en annan tjänst.',
    anmarkning: 'Administrering visas inte, eftersom den inte registreras i demon.',
  },
  {
    id: '3.5.1.9', kategori: 'nationell', egna: ['L7', 'D1'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`,
      `${M}NLL: felsvar syns och avstämning skickar igen`,
    ],
    losning: 'Överföring av ordinationer till Nationella läkemedelslistan med kvittens, och avstämning efter timeout eller felsvar. NLL är simulerad i demon.',
    expert: 'Systemet döljer aldrig en registrerad ordination vid timeout, utan stämmer av mot NLL själv och visar resultatet.',
    anmarkning: 'NLL är simulerad. Sil, Infektionsverktyget, Pascal och makulering av e-recept är inte anslutna.',
  },
  { id: '3.5.1.10', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Rapportering av biverkningar till Läkemedelsverket och av vaccinationer till Folkhälsomyndigheten är inte byggd.' },
  { id: '3.5.1.11', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Läkemedelsgenomgång och läkemedelsberättelse är inte byggda.' },
];
