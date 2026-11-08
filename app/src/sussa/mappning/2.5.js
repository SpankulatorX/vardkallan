// Sussa 2.5 Öppna gränssnitt: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, F, FS, MJ } = TEST;
// Runda 9, r6: testerna i app/test/runda9-r6.test.js och runda9-r6-forvaltning.test.js.
const OA = 'Öppet API hålls aktuellt > ';
const FL = 'Fler flöden via API:t > ';
const AR = 'Ärenden om API:t > ';
const TM = 'Tillämpningar och mottagare > ';
const TK = 'Tjänstekontrakt > ';
export const R6 = {
  conditionSkapa: `${OA}Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas`,
  conditionNekad: `${OA}Condition: fel roll, en vårdkontakt på en annan patient, en annan vårdenhet, en okänd kod och ett annat kodverk nekas med en förklaring`,
  capability: `${OA}CapabilityStatement har versionen och listar varje resurstyp och operation som servern har, och inget annat`,
  andringslogg: `${OA}ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad`,
  bokning: `${FL}Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet`,
  bokningNekad: `${FL}Appointment: fel roll, en annan patient och en tid som inte passar remissen nekas med en förklaring`,
  inskrivning: `${FL}Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in`,
  arendeKedja: `${AR}en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen`,
  arendeExpert: `${AR}systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas`,
  tillampning: `${TM}systemförvaltaren registrerar en tillämpning, systemet föreslår behörighet och text ur omfånget, och den startas från journalen`,
  aterkallad: `${TM}en återkallad tillämpning kan inte startas, och dess åtkomstbiljetter återkallas direkt`,
  provas: `${TM}bara systemförvaltaren registrerar, och adresser, omfång och namn prövas`,
  mottagare: `${TM}systemförvaltaren godkänner en mottagare, en prenumeration till den kan skapas, och när mottagaren återkallas avslutas prenumerationen`,
  tk: [`${TK}tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status`, `${TK}GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR`,
    `${TK}GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR`, `${TK}producenten nekar fel roll och visar inte spärrade uppgifter`,
    `${TK}okänt kontrakt, patient eller logisk adress ger ett fel på svenska`],
};

// Runda 10, r1: systemkonton, populationsprenumerationer och fler skrivningar (app/test/runda10-r1-api.test.js och
// runda10-r1-skrivning.test.js) och gränssnittet för dem (test/mobil.cjs).
const SY = 'Systemkonton > ';
const FS10 = 'Fler skrivningar via API:t > ';
export const R10 = {
  registrera: `${SY}systemförvaltaren registrerar ett systemkonto, systemet räknar fram omfånget ur informationsmängderna och en privat nyckel sparas aldrig`,
  backend: `${SY}SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas`,
  lasning: `${SY}systemkontot läser bara sina vårdenheters poster ur sina informationsmängder, aldrig skyddad identitet eller spärrade uppgifter, och varje läsning loggas`,
  population: `${SY}prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa`,
  aterkallat: `${SY}ett återkallat systemkonto får ingen biljett, dess biljetter slutar gälla och dess prenumerationer avslutas`,
  uiKonto: 'Gränssnitt > Öppet API > systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det',
  overkanslighet: `${FS10}Överkänslighet: läkarens registrering blir uppmärksamhetsinformation med bekräftad grad och ATC-kod och varnar för läkemedel i listan som omfattas, bara bland ordinationer som läkaren får se`,
  allergy: `${FS10}AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas`,
  systemSkriv: 'Skrivning för systemkonton > ett systemkonto kan inte registrera överkänslighet eller annat som kontot inte får skriva, och inget sparas',
  patient: `${FS10}Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet`,
  everything: `${FS10}Patient/$everything för personalen: varje resurstyp prövas och loggas för sig, och bara det personen får se kommer med`,
  uiOverk: 'Gränssnitt > Uppmärksamhet > läkaren registrerar en överkänslighet med ämnet och reaktionen, och den syns i patienthuvudet med graden',
  // Makulering via API:t och identiteten för systemkonton (app/test/runda10-r1-makulering.test.js).
  makulering: [
    'Makulering via API:t > DELETE och $makulera makulerar en dos med samma regler som gränssnittet: orsak krävs, historiken står kvar och makuleringen loggas',
    'Makulering via API:t > makuleringen prövas som i gränssnittet: fel roll och en annan vårdenhet nekas, och en dos som inte finns ger 404',
    'Makulering via API:t > en provbeställning makuleras via API:t, och en resurs som inte går att makulera ger 405 med vad man gör i stället',
    'Makulering via API:t > ett systemkonto får bara makulera det som kontot självt har skrivit',
  ],
  identitet: [
    'Identitet för systemkonton > förvalet är pseudonym: kontot ser aldrig patientens namn eller personnummer i resurser, sökningar eller prenumerationer',
    'Identitet för systemkonton > namn och personnummer kräver att systemförvaltaren väljer det med en motivering, och då får kontot dem',
  ],
};

export default [
  {
    id: '2.5.1.1', kategori: 'system', egna: ['D9', 'M12'], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}metadata är ett CapabilityStatement`,
      `${F}sökning ger Bundle searchset`,
      `${A}FHIR via HTTP har application/fhir+json och kräver inloggning`,
      'FHIR-skrivning > Observation: blodtryck registreras med samma funktion som gränssnittet och loggas',
      'FHIR-skrivning > MedicationRequest: samma varningar som läkemedelslistan, och en allvarlig varning kvitteras med motivering',
      'SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas',
      'Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet',
      // Runda 9, r6: diagnoser via API:t, versionen i CapabilityStatement och ändringsloggen.
      R6.conditionSkapa, R6.conditionNekad, R6.capability, R6.andringslogg,
      'Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd',
      // Runda 10, r1: överkänslighet och patienter via API:t, Patient/$everything för personalen och systemkonton.
      R10.overkanslighet, R10.allergy, R10.patient, R10.everything, R10.uiOverk, R10.backend, R10.population, R10.systemSkriv,
    ],
    losning: 'Öppet FHIR R4-API under /fhir för läsning, skrivning (mätvärden, anteckningar, diagnoser, överkänslighet, ordinationer, remisser, nya patienter, bokning av en remiss och inskrivning), Patient/$everything för personalen och invånaren, prenumerationer och externa tillämpningar med SMART on FHIR, också systemkonton utan inloggad person med SMART Backend Services, med samma behörighet och loggning som gränssnittet. Koden är öppen under EUPL 1.2. Att gränssnittet hålls aktuellt syns i tre saker: CapabilityStatement anger programmets version, ändringsloggen (api-andringar.js) har en rad för varje resurstyp och skrivning med den version där den kom och visas på sidan Öppet API och i GET /api/oppet-api/andringar, och ett test prövar alla 145 resurstyper i FHIR R4 mot servern och stoppar bygget om CapabilityStatement anger något som servern inte har, eller tvärtom.',
    expert: 'Skrivningen går genom samma funktioner som gränssnittet, så API:t kontrollerar själv reglerna, varnar på samma sätt och fyller i vårdkontakt, enhet, huvud- eller bidiagnos och förslag. Den som bygger en integration behöver inte känna reglerna, och bygget ser till att beskrivningen av API:t alltid stämmer med det som finns.',
    anmarkning: 'Själva åtagandet att hålla gränssnittet aktuellt under en avtalstid är ett avtalsåtagande, och i koden syns det som versionen, ändringsloggen och testet som stoppar bygget. Patient/$everything stöds inte med en åtkomstbiljett, eftersom omfånget prövas per resurstyp: en tillämpning läser varje resurstyp för sig.',
  },
  {
    id: '2.5.1.2', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}sökning ger Bundle searchset`,
      `${F}FHIR följer samma behörighet: nekad utan vårdrelation`,
      `${F}FHIR följer inre sekretess och spärr`,
      `${F}FHIR-anrop loggas`,
      'FHIR-skrivning > Composition: final skapar och signerar, preliminary sparar ett utkast med samma mall som gränssnittet',
      'FHIR-skrivning > MedicationRequest: utsättning med status stopped, och antikoagulantia sätts bara ut med en plan',
      'FHIR-skrivning > nekad: fel roll, ingen vårdrelation och Min journal nekas och nekandet loggas',
      'FHIR-skrivning > inget går att göra via API:t som gränssnittet inte tillåter: ändrad överkänslighet, borttagning och ändrade mätvärden',
      'Prenumerationer > Subscription skapas med samma behörighet som läsningen och bara till adresser som administratören har godkänt',
      'Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet',
      'Prenumerationer > inget meddelande om det som prenumeranten inte får läsa: spärrad vårdenhet, annan vårdenhet och osignerade utkast',
      'Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas',
      // Runda 9, r6: diagnoser, bokning och inskrivning via API:t, och mottagarna som systemförvaltaren godkänner.
      R6.conditionSkapa, R6.bokning, R6.inskrivning, R6.mottagare, R6.provas,
      // Runda 10, r1: systemkonton med SMART Backend Services och prenumerationer på en population.
      R10.registrera, R10.backend, R10.lasning, R10.population, R10.aterkallat, R10.uiKonto, R10.allergy, R10.patient,
      ...R10.makulering, ...R10.identitet,
    ],
    losning: 'Integrationsmönster: förfrågan och svar (REST med FHIR R4) och händelser (Subscription med rest-hook), för tillämpningar som startas av en person (SMART on FHIR) och för systemkonton utan inloggad person (SMART Backend Services, med ett klientintyg som tillämpningen signerar med sin privata nyckel). Kategoriserade informationsmängder: ett systemkonto, till exempel regionens vårddatalager eller engagemangsindex, prenumererar på alla poster av en typ (diagnoser, mätvärden, läkemedel, överkänsligheter eller vårdkontakter) på sina vårdenheter och får meddelanden om nya, ändrade och borttagna poster med bara id. Därefter hämtar det posten med sin egen biljett. Branschstandarder: FHIR R4, SMART App Launch och Backend Services, OAuth 2.0 och Subscriptions Backport. Responsivitet: versionen i CapabilityStatement, ändringsloggen och ärenden för ny information. Kontrollerat läsa, skapa, uppdatera och ta bort: skrivningen går genom samma funktioner och regler som gränssnittet. Att ta bort är att makulera: DELETE eller $makulera på en dos eller en provbeställning gör samma makulering som gränssnittet, med samma behörighet, orsak som krav, historiken kvar och loggning, och en resurs som inte går att makulera besvaras med 405 och vad man gör i stället, till exempel att en anteckning rättas med en ny version. Ett systemkonto får patientens namn och personnummer bara när systemförvaltaren har valt det med en motivering, och annars en pseudonym per konto och patient.',
    expert: 'Systemet prövar varje skrivning, varje läsning och varje meddelande mot behörighetsmotorn, förklarar på svenska varför något inte går och skickar aldrig patientuppgifter i ett meddelande, så att ingen integration behöver bygga in patientdatalagens regler. Systemförvaltaren väljer bara vad ett systemkonto ska få: systemet räknar fram omfånget och spärrar själv skyddad identitet, spärrade uppgifter och andra vårdenheter.',
    anmarkning: 'Ingenting raderas: en makulerad uppgift står kvar med orsaken (patientdatalagen). Makulering kräver varken kontrasignering eller fyra ögon i gränssnittet, och därför inte heller via API:t. Meddelandena simuleras i demon och skickas bara med WEBHOOK_SKICKA=1. Systemkontona gäller den sandlåda där de registrerades, och nyckeln för pseudonymerna slumpas när servern startar om SYSTEMKONTO_PSEUDONYMNYCKEL inte är satt.',
  },
  {
    id: '2.5.1.3', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form`,
      `${F}MedicationRequest använder ATC och har uppföljningsdatum`,
      `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`,
      `${MJ}FHIR med patientens session: egna resurser och $everything, inget annat`,
      'API-täckning > varje flöde i klickbudgeten är bedömt för API:t, och bedömningen gäller flöden som finns',
      'API-täckning > varje flöde som står som ja görs via det öppna API:t',
      'API-täckning > API: täckningen kan läsas utan inloggning',
      // Runda 9, r6: tjänstekontrakten, bokning och inskrivning via API:t, ändringsloggen och ärendena för nya gränssnitt.
      ...R6.tk, R6.bokning, R6.bokningNekad, R6.inskrivning, R6.andringslogg, R6.arendeKedja, R6.arendeExpert,
    ],
    losning: 'Nuläge: all journalinformation i gränssnittet finns som FHIR R4-resurser, och sidan Öppet API listar för varje vanligt flöde i klickbudgeten om det går via API:t, med anropen, och annars vad som saknas. Ett test gör varje flöde som står som ja på riktigt, nu också bokning av en remiss (Appointment) och inskrivning (Encounter). Mappningen mot de nationella tjänstekontrakten i bilaga K10 finns i tjanstekontrakt.js, med fyra simulerade producenter. Utökning: ändringsloggen visar vilka informationsmängder som kom i vilken version. Process: på sidan Öppet API lämnar personal och samarbetspartner ett ärende om en saknad informationsmängd, ett attribut eller en mappning mot ett tjänstekontrakt. Systemförvaltaren bedömer, planerar till en version och markerar det som levererat, och levererat går bara när versionen finns i ändringsloggen.',
    expert: 'Samma data och samma regler gäller i gränssnittet och i API:t, och listan över vad API:t räcker till räknas fram ur klickbudgeten, så den kan inte påstå mer än testet visar. När någon begär en resurstyp som redan finns svarar systemet direkt med hur den läses och skrivs.',
    anmarkning: 'Tolv av klickbudgetens flöden går via API:t och två delvis. Resten finns bara i gränssnittet, bland annat administrering, kontrasignering (där anteckningen ska läsas först) och nödåtkomst, som med avsikt aldrig går via API:t. Tjänstekontrakten är simulerade utan tjänsteplattformen.',
  },
];
