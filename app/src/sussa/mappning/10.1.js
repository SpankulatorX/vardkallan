// Sussa 10.1 Kontinuerlig kompetensutveckling: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r2: posterna för tillgänglighet, skärmanpassning, nyheter och intyg ersätts ur sussa/runda7-r2.js.
import { medR7r2 } from '../runda7-r2.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';

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
// Runda 12, r3: praktiska prov i journalen och utbildaren som behörighet för en befintlig roll (praktiska-prov.js).
const PP = 'Praktiska prov > ';
const R12R3 = {
  '10.1.1.5': {
    avsedd: 'uppfyllt_demo',
    tester: [
      `${PP}utbildaren och verksamhetschefen skapar praktiska prov för vårdenheten, och den som inte är utbildare får inte`,
      `${PP}läkaren gör provet i en övningsjournal som systemet väljer, och systemet kontrollerar ordinationen i journalen`,
      `${PP}en anteckning som inte är signerad godkänns inte, och en signerad anteckning godkänns`,
      `${PP}utbildaren följer upp vem som har klarat provet utan att se vilken patient provet gjordes på`,
      `${PP}systemet väljer en övningsjournal som personen har vårdrelation till, aldrig en skyddad patient, och ett godkänt prov gäller i ett år`,
      'Gränssnitt > Utbildning > utbildaren skapar ett praktiskt prov, läkaren gör det i övningsjournalen och systemet kontrollerar resultatet',
    ],
    losning: 'Under Utbildning gör varje användare övningarna för sin yrkesroll och får ett intyg som gäller i ett år när alla svar är rätt. Därtill finns praktiska prov: uppgifter som görs på riktigt i en övningsjournal med en påhittad patient, till exempel att ordinera paracetamol vid behov, skriva och signera en anteckning eller registrera ett blodtryck, där systemet kontrollerar i journalen att det blev rätt. Ett godkänt prov gäller i ett år. Utbildaren är en behörighet för en befintlig roll: den som har ett giltigt utbildarintyg från verksamhetschefen, och verksamhetschefen själv, skapar vårdenhetens prov och följer upp vem som har klarat vilket prov. Verksamhetschefen ser vårdenhetens intyg och utfärdar utbildarintyg, och övningarna är data med versioner som utbildarna ändrar.',
    expert: 'Utbildaren väljer bara vilket prov, och systemet vet vilka yrkesroller det gäller, väljer övningsjournalen med personens egen behörighet och skriver instruktionen med en länk till rätt flik. Systemet kontrollerar resultatet i journalen, säger på vanlig svenska vad som saknas och räknar giltighetstiden, och utbildaren ser aldrig vilken patient provet gjordes på.',
    anmarkning: 'Övningsjournalen är en av demons påhittade patienter som personen har vårdrelation till, eftersom demon själv är utbildningsmiljön. Systemet kan kontrollera tre slag av praktiska prov. Intygen och proven gäller bara i demon.',
  },
};
export default medR8r5(medR7r2(AVSNITT)).map(x => (R12R3[x.id] ? { ...x, ...R12R3[x.id], tester: [...new Set([...(x.tester ?? []), ...R12R3[x.id].tester])] } : x));
