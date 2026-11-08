// Sussa 3.6.1 Kommunikation och integrationer med medicinteknisk utrustning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r2: medicinteknisk utrustning (medicinteknik.js, app/test/medicinteknik.test.js).
import { T } from '../medicinteknik-r9.js';

const SIMULERAT = 'Utrustningen är simulerad i demon: åtta påhittade monitorer och pumpar på Kardiologiska kliniken och akuten, som skickar värden genom samma mottagning som en riktig utrustning. Ingen riktig medicinteknisk utrustning är ansluten och ingen gateway för medicinteknik finns.';

export default [
  {
    id: '3.6.1.1', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [T.fhir, T.hl7, T.nyckel, T.utanKoppling, T.annanPatient, T.simulerad, T.felFormat],
    losning: 'Patientmonitorer och infusionspumpar skickar till en egen mottagning i två standardiserade format: FHIR R4 (Bundle med Device, Observation och MedicationAdministration) och HL7 v2.6 ORU^R01 enligt IHE PCD-01, med koder ur LOINC och IEEE 11073 (MDC). Varje utrustning har en egen nyckel som sparas som HMAC och ett tak för antalet meddelanden. Värdena blir mätvärden med källan utrustning, bara för den patient som utrustningen är kopplad till, och allt eller inget i ett meddelande sparas.',
    expert: 'Systemet tar själv reda på vilken patient värdena gäller ur kopplingen, knyter dem till den pågående vårdkontakten och sparar ett värde som skickas två gånger bara en gång, så ingen behöver föra över värden för hand.',
    anmarkning: SIMULERAT,
  },
  {
    id: '3.6.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.referens, T.overvakning, T.fhir, T.kbKoppla, T.kbGodkanna],
    losning: 'Värdena från utrustningen visas i fliken Mätvärden och i intensivvårdens övervakning, i kurvorna och i tabellen, märkta med utrustningen och med om de är godkända. Värden som inte är godkända är ihåliga punkter i kurvan. I FHIR pekar mätvärdet på utrustningen och har status preliminary tills det är godkänt.',
    expert: 'Systemet visar själv varifrån varje värde kommer och om det går att använda för diagnos, så att användaren aldrig behöver gissa om ett värde är kontrollerat.',
    anmarkning: `${SIMULERAT} Kurvorna i övervakningen visar de senaste timmarna. Vågformer och realtidsvisning som på monitorn själv finns inte.`,
  },
  { id: '3.6.1.3', kategori: 'leverantor', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gränssnitt mot medicinteknisk utrustning finns inte. FHIR-API:t och dess profiler är dokumenterade i docs/fhir-validering.md.' },
  {
    id: '3.6.1.4', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [T.profiler, T.felFormat, T.fhir, T.hl7],
    losning: 'Formaten och profilerna står i FHIR-serverns CapabilityStatement, på sidan Öppet API och som JSON på /mt/format: FHIR R4 enligt vitalparameterprofilen med koderna i HL7 Point-of-Care Device Implementation Guide och HL7 v2.6 ORU^R01 enligt IHE PCD-01, med svar som OperationOutcome eller ACK. Ett meddelande i fel format, med okänd kod, fel enhet, orimligt värde eller fel tid nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken.',
    expert: 'Systemet förklarar för den som kopplar in en utrustning exakt vad som är fel i meddelandet, till exempel vilken enhet som ska användas, så ingen behöver läsa standarden för att hitta felet.',
    anmarkning: `${SIMULERAT} Andra format, till exempel IHE PCD-03 för pumpprogrammering och ISO/IEEE 11073 SDC, tas inte emot.`,
  },
  {
    id: '3.6.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.koppla, T.utanKoppling, T.flytta, T.annanPatient, T.behorighet, T.nyckel, T.kbKoppla],
    losning: 'Utrustningen kopplas till patienten med start och slut genom att utrustningens streckkod skannas när patientens journal är öppen, och armbandet kan skannas och kontrolleras mot patientens identitet. Värden utan gällande koppling, värden från före kopplingen eller efter att den avslutades och värden som anger en annan patient avvisas. Varje koppling och varje avslut loggas i åtkomstloggen, och kopplingarna går inte att ändra eller radera.',
    expert: 'Systemet hittar utrustningen ur streckkoden och avslutar själv den förra kopplingen när utrustningen flyttas till en ny patient, utan att röja vem den förra patienten var.',
    anmarkning: `${SIMULERAT} Streckkoderna är påhittade, och skanningen görs i demon genom att skriva in koden eller välja utrustningen i listan.`,
  },
  {
    id: '3.6.1.6', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.referens, T.godkannare, T.sparr, T.analys, T.kbGodkanna],
    losning: 'Värden från utrustningen tas emot som referens och klassas som godkända för diagnostiskt bruk först när en läkare eller sjuksköterska på vårdenheten har godkänt dem. Bara godkända värden räknas i NEWS2, larmen i inkorgen, basfakta och intensivvårdens beslutsstöd. Klassen visas vid varje värde, i kurvorna och i FHIR, och en bedömning går inte att ändra.',
    expert: 'Systemet godkänner alla värden som väntar med ett klick och säger själv till när ett värde som inte är godkänt skulle ha gett larm, så att inget missas utan att ett okontrollerat värde styr beslut.',
    anmarkning: SIMULERAT,
  },
  {
    id: '3.6.1.7', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.egenRegistrera, T.egenSkild, T.egenTak, T.godkannare, T.kbEgen],
    losning: 'Patienten registrerar egna mätningar i Min journal (blodtryck, puls, vikt, glukos, syremättnad, temperatur och PEF) med källan patient. De märks som inte kvalitetssäkrade och visas för vården i en egen tabell, skilda från vårdens värden och utanför kurvorna. De räknas inte i NEWS2, larm, vikt eller doser förrän en läkare eller sjuksköterska har bedömt dem, och patienten ser om mätningen är bedömd.',
    expert: 'Systemet skickar själv mätningen till den vårdenhet som vårdar patienten, så patienten behöver inte veta vart den ska, och förklarar vad som är fel i ett värde.',
    anmarkning: 'Mätningar som hämtas direkt från patientens egna apparater eller från nationella tjänster för egenmätning tas inte emot. Patienten skriver in värdet.',
  },
];
