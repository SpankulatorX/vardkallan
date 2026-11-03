// Sussa 2.5 Öppna gränssnitt: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, F, FS, MJ } = TEST;

export default [
  {
    id: '2.5.1.1', kategori: 'system', egna: ['D9', 'M12'], avsedd: 'delvis',
    tester: [
      `${F}metadata är ett CapabilityStatement`,
      `${F}sökning ger Bundle searchset`,
      `${A}FHIR via HTTP har application/fhir+json och kräver inloggning`,
      'FHIR-skrivning > Observation: blodtryck registreras med samma funktion som gränssnittet och loggas',
      'FHIR-skrivning > MedicationRequest: samma varningar som läkemedelslistan, och en allvarlig varning kvitteras med motivering',
      'SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas',
      'Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet',
    ],
    losning: 'Öppet FHIR R4-API under /fhir för läsning, skrivning (mätvärden, anteckningar, ordinationer och remisser), prenumerationer och externa tillämpningar med SMART on FHIR, med samma behörighet och loggning som gränssnittet. Koden är öppen under EUPL 1.2.',
    expert: 'Skrivningen går genom samma funktioner som gränssnittet, så API:t kontrollerar själv reglerna, varnar på samma sätt och fyller i vårdkontakt, enhet och förslag. Den som bygger en integration behöver inte känna reglerna.',
    anmarkning: 'Att gränssnittet hålls aktuellt under en avtalstid är ett åtagande som inte finns. Diagnoser, överkänslighet och patienter går inte att skriva via API:t, eftersom gränssnittet inte heller kan det än.',
  },
  {
    id: '2.5.1.2', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${F}sökning ger Bundle searchset`,
      `${F}FHIR följer samma behörighet: nekad utan vårdrelation`,
      `${F}FHIR följer inre sekretess och spärr`,
      `${F}FHIR-anrop loggas`,
      'FHIR-skrivning > Composition: final skapar och signerar, preliminary sparar ett utkast med samma mall som gränssnittet',
      'FHIR-skrivning > MedicationRequest: utsättning med status stopped, och antikoagulantia sätts bara ut med en plan',
      'FHIR-skrivning > nekad: fel roll, ingen vårdrelation och Min journal nekas och nekandet loggas',
      'FHIR-skrivning > inget går att göra via API:t som gränssnittet inte tillåter: diagnoser, överkänslighet, borttagning och ändrade mätvärden',
      'Prenumerationer > Subscription skapas med samma behörighet som läsningen och bara till adresser som administratören har godkänt',
      'Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet',
      'Prenumerationer > inget meddelande om det som prenumeranten inte får läsa: spärrad vårdenhet, annan vårdenhet och osignerade utkast',
      'Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas',
    ],
    losning: 'Läsa, skapa och uppdatera via FHIR R4 med samma regler som gränssnittet, och prenumerationer (Subscription med rest-hook) som meddelar nya, ändrade och borttagna poster med bara id. Integrationsmönstren är förfrågan och svar (REST) och händelser (prenumeration).',
    expert: 'Systemet prövar varje skrivning och varje meddelande mot behörighetsmotorn, förklarar på svenska varför något inte går och skickar aldrig patientuppgifter i ett meddelande, så att ingen integration behöver bygga in patientdatalagens regler.',
    anmarkning: 'Borttagning nekas med en förklaring, eftersom journaluppgifter rättas eller makuleras och aldrig tas bort. Prenumerationerna gäller en patient i taget; en prenumeration på en hel population (till exempel för ett vårddatalager) och systemkonton finns inte. Meddelandena simuleras i demon och skickas bara med WEBHOOK_SKICKA=1. Mottagaradresserna godkänns i konfigurationen, inte i ett gränssnitt för administratören.',
  },
  {
    id: '2.5.1.3', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${F}Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form`,
      `${F}MedicationRequest använder ATC och har uppföljningsdatum`,
      `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`,
      `${MJ}FHIR med patientens session: egna resurser och $everything, inget annat`,
      'API-täckning > varje flöde i klickbudgeten är bedömt för API:t, och bedömningen gäller flöden som finns',
      'API-täckning > varje flöde som står som ja görs via det öppna API:t',
      'API-täckning > API: täckningen kan läsas utan inloggning',
    ],
    losning: 'All journalinformation i gränssnittet finns som FHIR R4-resurser. Ett test går igenom klickbudgetens vanliga flöden och gör vart och ett som går via API:t på riktigt, och sidan Öppet API listar för varje flöde om det går och annars vad som saknas.',
    expert: 'Samma data och samma regler gäller i gränssnittet och i API:t, och listan över vad API:t räcker till räknas fram ur klickbudgeten, så den kan inte påstå mer än testet visar.',
    anmarkning: 'Tio av klickbudgetens flöden går via API:t och två delvis. Resten finns bara i gränssnittet, bland annat administrering, inskrivning, bokning, kontrasignering och nödåtkomst (som aldrig ska gå via API:t). Mappning mot nationella tjänstekontrakt saknas.',
  },
];
