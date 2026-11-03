// Sussa 5.1.1 Generella behov kring arkitektur: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, S } = TEST;

export default [
  { id: '5.1.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ingen koppling till kontorsinformationsstöd är byggd.' },
  {
    id: '5.1.1.2', kategori: 'system', egna: ['D3', 'M5'], avsedd: 'delvis',
    tester: [
      `${A}migreringsavstämningen visar avvikelsen`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
    ],
    losning: 'Migrerad historik från VAS och Cosmic läses in med källa och avstäms, och avvikelser visas i en avstämningsrapport.',
    expert: 'Systemet stämmer av migreringen självt och visar varje avvikelse, så ingen behöver jämföra det gamla och det nya systemet för hand.',
    anmarkning: 'Ingen riktig migrering görs. Avstämningen räknas på seedens migrerade poster.',
  },
  { id: '5.1.1.3', kategori: 'system', egna: ['D11'], tester: [], avsedd: 'planerat',
    anmarkning: 'Formulär kan inte skapas eller ändras av verksamheten. Mallarna är fasta i koden.' },
  {
    id: '5.1.1.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      'SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas',
      'SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med',
      'SMART on FHIR > PKCE krävs, koden går att använda en gång och fel adress eller okänd tillämpning avvisas utan omdirigering',
      'SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas',
      'Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget',
    ],
    losning: 'Externa tillämpningar startas från patientens journal med SMART on FHIR (EHR launch) och visas i en ram i journalen. Patienten och den inloggade följer med i starten, åtkomsten begränsas till tillämpningens omfång och Stäng återkallar den. Demotillämpningen Blodtryck över tid ritar patientens blodtryck.',
    expert: 'Systemet ger tillämpningen patient och användare ur sammanhanget och sköter inloggningen, så användaren startar med två klick utan att välja patient eller logga in igen. Åtkomstbiljetten finns bara i minnet, går ut efter 30 minuter och återkallas vid utloggning, så inget går att återskapa efter sessionen.',
    anmarkning: 'En registrerad demotillämpning. Byter användaren patient stängs tillämpningen med fliken; en tillämpning kan inte själv byta patient i journalen.',
  },
];
