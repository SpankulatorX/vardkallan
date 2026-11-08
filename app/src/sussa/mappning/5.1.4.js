// Sussa 5.1.4 Integrationer: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { M } = TEST;
// Runda 10, r6: testerna i app/test/produktionssystem.test.js.
const PS = 'Integration med produktionssystem > ';

export default [
  {
    id: '5.1.4.1', kategori: 'nationell', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`,
      `${M}NLL: felsvar syns och avstämning skickar igen`,
    ],
    losning: 'Ordinationer förs över till en simulerad Nationell läkemedelslista med kvittens och avstämning.',
    expert: 'Systemet döljer aldrig en registrerad förskrivning när NLL inte svarar i tid, utan stämmer av själv och visar avvikelsen i inkorgen.',
    anmarkning: 'Simulerat. Ingen anslutning till E-hälsomyndigheten, och makulering av e-recept saknas.',
  },
  { id: '5.1.4.2', kategori: 'nationell', egna: ['D10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Sil är inte ansluten. Läkemedelsvarningarna är egna demoregler.' },
  { id: '5.1.4.3', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Dosförskrivning via Pascal är inte ansluten.' },
  { id: '5.1.4.4', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Födelseanmälan till Skatteverket är inte byggd.' },
  // Runda 10, r6: integration med producentsystemen för beställning och svar (produktionssystem.js).
  {
    id: '5.1.4.5', kategori: 'system', egna: ['D9', 'M4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${PS}disciplinerna: klinisk kemi, klinisk fysiologi, klinisk neurofysiologi, mikrobiologi, immunologi, patologi, genetik, radiologi och transfusionsmedicin har laboratorier och analyser`,
      `${PS}anslutning: systemförvaltaren ansluter laboratoriet, nyckeln visas en gång och sparas som HMAC, och andra roller får inte`,
      `${PS}beställning ut: proverna går till utkorgen som Patient, ServiceRequest och Specimen, hämtningen loggas på patienten och det simulerade laboratoriet svarar inte`,
      `${PS}status och svar in: mottagen och svar med NPU-kod blir mätvärden som väntar på vidimering, och ett kritiskt värde larmar efter Vårdkällans egna gränser`,
      `${PS}svar in: ett meddelande som inte går att ta emot får en förklaring på svenska och ändrar ingenting`,
      `${PS}svar in för mikrobiologi, immunologi och genetik: fynd i Snomed CT och utlåtanden i text`,
      `${PS}transfusionsmedicin: blodgruppering, bastest och blodkomponenter går mellan Vårdkällan och blodcentralens producentsystem`,
      'Transfusionskontroll > producentsystemet: giltig blodgruppering och färskt negativt bastest ger reserverade enheter',
      'Transfusionskontroll > producentsystemet: bastest saknas',
      'Transfusionskontroll > producentsystemet: bastestet är äldre än giltighetstiden',
      'Transfusionskontroll > producentsystemet: ett positivt bastest stoppar när beställningen inte utreds',
      'Transfusionskontroll > producentsystemet: en makulerad beställning med blodgruppering räknas inte',
      'Transfusionskontroll > producentsystemet: en borttagen blodgruppering räknas inte',
      'Transfusionskontroll > producentsystemet: fel blodgrupp',
      'Transfusionskontroll > avvikelsen kvitteras av den som beställde, och en annan läkare ser den inte',
      `${PS}undersökningar: klinisk fysiologi, neurofysiologi och radiologi skickas direkt utan provtagning och besvaras med ett utlåtande`,
      `${PS}katalog in: laboratoriets katalog kopplas till Vårdkällans analyser, och en analys som inte erbjuds kan inte beställas`,
      `${PS}det simulerade producentsystemet hämtar, kvitterar och svarar genom samma gränssnitt, för systemförvaltningen`,
    ],
    losning: 'Varje laboratorium och utförande enhet kan anslutas med sitt producentsystem genom det öppna gränssnittet /ps, där beställaren är integrationsansvarig. Alla discipliner använder samma fyra flöden i HL7 FHIR R4: beställning ut som Patient, ServiceRequest och Specimen i en utkorg som producentsystemet hämtar och kvitterar, status in som Task, svar in som DiagnosticReport med Observation eller ett utlåtande, och laboratoriets katalog in som ActivityDefinition. Klinisk kemi, klinisk fysiologi, klinisk neurofysiologi, klinisk mikrobiologi, klinisk immunologi, klinisk patologi, klinisk genetik, radiologi och transfusionsmedicin har var sitt laboratorium eller utförande enhet. Till blodcentralen går också beställningen av blodkomponenter, och blodcentralens producentsystem svarar med de reserverade enheterna. Svaret går igenom samma transfusionskontroll som den inbyggda blodcentralen, och ett svar som inte klarar den reserverar inget och blir en avvikelse i inkorgen hos den som beställde.',
    expert: 'Systemförvaltaren väljer bara laboratoriet, och systemet ger standarden, adresserna och nyckeln och skickar beställningarna dit av sig själv. Varje meddelande kontrolleras helt innan något sparas och får svar på vanlig svenska, och Vårdkällan räknar själv om ett värde är kritiskt och vilka analyser som går att beställa enligt laboratoriets katalog.',
    anmarkning: 'Producentsystemen är simulerade och går genom samma gränssnitt och kontroller som ett riktigt. Gränssnittet är Vårdkällans eget FHIR R4-gränssnitt och inte någon nationell tjänstekontraktsprofil. En analys i laboratoriets katalog som inte finns i Vårdkällans katalog visas för systemförvaltningen men kan inte beställas. Bilder från radiologin visas inte, svaret är utlåtandet.',
  },
  { id: '5.1.4.6', kategori: 'nationell', egna: ['L9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Listningen ligger i seeden och ger vårdrelation, men hämtas inte från en extern källa.' },
];
