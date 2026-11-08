// Sussa 5.1.1 Generella behov kring arkitektur: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
import { medR10r3 } from '../runda10-r3.js';
// Runda 9, r4: inläsningen av migreringsfiler.
import { T } from '../runda9-r4.js';
// Runda 10, r7: kapacitet, ombud, kassan, meddelanden och kontorsstödet (sussa/runda10-r7.js).
import { medR10r7 } from '../runda10-r7.js';

const { A, S } = TEST;

const POSTERNA = [
  { id: '5.1.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ingen koppling till kontorsinformationsstöd är byggd.' },
  {
    id: '5.1.1.2', kategori: 'system', egna: ['D3', 'M5'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}migreringsavstämningen visar avvikelsen`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
      T.mgImport, T.mgAvvikelse, T.mgBehorighet, T.mgFyraOgon, T.mgForfattare,
    ],
    losning: 'Ett uttag ur ett annat journalsystem läses in som en FHIR R4 Bundle (migreringsimport.js, sidan Migreringsavstämning): vårdkontakter, diagnoser, mätvärden och journalanteckningar, med patienten som personnummer, vårdenheten och författaren som HSA-id och källsystemets antal per typ. Filen förhandsvisas och valideras, och när en annan systemförvaltare har godkänt den läses den in i en transaktion med källan märkt på varje post, och avstämningen visar antalet i källan, antalet som fördes över och antalet som går att läsa tillbaka. En migrerad anteckning har källsystemet som författare, och författaren och signeringen i källsystemet visas som uppgifter om källan, aldrig som en nuvarande personal. Migrerad historik syns i patientens tidslinje likvärdigt med ny.',
    expert: 'Systemet stämmer av migreringen självt och visar varje avvikelse med orsaken på vanlig svenska, till exempel en patient som inte finns eller poster som källsystemet räknade men som saknas i filen. Samma fil läses inte in två gånger, och en migrerad vårdkontakt ger ingen vårdrelation, så ingen behöver jämföra systemen för hand eller städa efter en körning.',
    anmarkning: 'Ingen riktig migrering från VAS eller Cosmic görs, och filerna i demon är simulerade uttag. En fil kan ha högst 500 poster och 64 kB, och läkemedelsordinationer, remisser och överkänslighet läses inte in från fil ännu.',
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
// Runda 10, r3: förifyllnaden och formulärmotorn (sussa/runda10-r3.js).
// Runda 10, r7: kontorsstödet (sussa/runda10-r7.js).
export default medR10r7(medR10r3(POSTERNA));
