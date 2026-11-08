// Räcker API:t? (runda 6, r5, Sussa 2.5.1.3). För varje vanligt flöde i klickbudgeten står här om det går att göra via
// det öppna API:t, med vilka anrop, och annars vad som saknas och varför. Testet i app/test/api-tackning.test.js gör
// varje flöde som står som ja via FHIR-API:t på riktigt. Ett flöde som läggs till i klickbudgeten utan att bedömas här
// står som inte bedömt, så att listan aldrig påstår mer än den vet.
import { FLODEN } from './klickbudget.js';

// Ett anrop: metoden, adressen och vad som skickas med.
const a = (metod, vag, med = null) => `${metod} ${vag}${med ? ` ${med}` : ''}`;
const ja = (anrop, text) => ({ status: 'ja', anrop, text });
const delvis = (anrop, text) => ({ status: 'delvis', anrop, text });
const nej = (text, anrop = []) => ({ status: 'nej', anrop, text });

export const TACKNING = {
  'oppna-patient': ja([a('GET', '/fhir/Patient/{id}'), a('GET', '/fhir/Observation?patient={id}'), a('GET', '/fhir/MedicationRequest?patient={id}'), a('GET', '/fhir/Condition?patient={id}'), a('GET', '/fhir/Composition?patient={id}')], 'Översiktens delar läses var för sig med samma behörighet.'),
  'las-anteckning': ja([a('GET', '/fhir/Composition?patient={id}'), a('GET', '/fhir/Composition/{id}')], 'Anteckningen med sökorden som avsnitt.'),
  daganteckning: ja([a('POST', '/fhir/Composition', 'med status final')], 'Samma mall och sökord som i gränssnittet, och anteckningen signeras i samma anrop.'),
  ordinera: ja([a('POST', '/fhir/MedicationRequest')], 'Samma kontroller och varningar. Dosering och uppföljningsdatum fyller systemet i ur sitt förslag när de saknas.'),
  utsattning: ja([a('PUT', '/fhir/MedicationRequest/{id}', 'med status stopped och statusReason')], 'Samma utsättning som i läkemedelslistan.'),
  uppmarksamhet: nej('Uppmärksamhetsinformationen läses som Flag och AllergyIntolerance, men systemets förslag och bekräftelsen finns bara i gränssnittet.', [a('GET', '/fhir/Flag?patient={id}')]),
  blodtryck: ja([a('POST', '/fhir/Observation', 'med LOINC 85354-9')], 'Samma kontroll av värdet som i fliken Mätvärden, och systemet väljer vårdkontakten.'),
  remiss: ja([a('POST', '/fhir/ServiceRequest')], 'Samma förval för prioritet och sista svarsdatum som i formuläret.'),
  'kvittera-svar': nej('Svaret läses i ServiceRequest, men kvittensen görs bara i gränssnittet.', [a('GET', '/fhir/ServiceRequest?patient={id}')]),
  nodatkomst: nej('Nödåtkomst är ett aktivt val i stunden med syfte och intyg, och görs med avsikt bara i gränssnittet. API:t och tillämpningarna får aldrig nödåtkomst, aktiva val eller samtycke.'),
  reservnummer: nej('Patienter registreras bara i gränssnittet, som tolkar numret och letar dubbletter.'),
  'sla-samman': nej('Sammanslagning bekräftas bara i gränssnittet. Resultatet syns i Patient.link.', [a('GET', '/fhir/Patient/{id}')]),
  halsoarende: nej('Hälsoärenden läses som EpisodeOfCare, men systemets förslag bekräftas bara i gränssnittet.', [a('GET', '/fhir/EpisodeOfCare?patient={id}')]),
  inskrivning: nej('Vårdtillfällen läses som Encounter, men inskrivning, flytt och utskrivning görs bara i gränssnittet.', [a('GET', '/fhir/Encounter?patient={id}')]),
  flytta: nej('Som inskrivningen: Encounter läses men flytten görs bara i gränssnittet.', [a('GET', '/fhir/Encounter?patient={id}')]),
  utskrivning: nej('Utskrivningen och systemets kontroll av vad som återstår finns bara i gränssnittet.', [a('GET', '/fhir/Encounter?patient={id}')]),
  'registrera-besok': nej('Vårdkontakter läses som Encounter men registreras bara i gränssnittet.', [a('GET', '/fhir/Encounter?patient={id}')]),
  'planera-video': nej('Som registreringen av besök.', [a('GET', '/fhir/Encounter?patient={id}')]),
  'ge-dos': nej('Givna doser läses som MedicationAdministration, men administreringen med delegering och kontroller görs bara i gränssnittet.', [a('GET', '/fhir/MedicationAdministration?patient={id}')]),
  vidimera: nej('Vidimeringen läses som List men görs bara i gränssnittet.', [a('GET', '/fhir/List?patient={id}')]),
  'utsattning-varning': ja([a('PUT', '/fhir/MedicationRequest/{id}', 'med status stopped och tillägget kvitterad-varning')], 'Varningen kommer som en OperationOutcome och kvitteras i samma anrop igen.'),
  'utsattning-plan': ja([a('PUT', '/fhir/MedicationRequest/{id}', 'med status stopped och tillägget utsattningsplan')], 'Systemet föreslår planerna i en OperationOutcome och fyller i orsaken ur planen.'),
  utskrift: nej('Utskrifter och utlämnanden görs bara i gränssnittet.'),
  'begar-kontrasignering': nej('Kontrasigneringen läses som Composition.attester men begärs bara i gränssnittet.'),
  kontrasignera: nej('Kontrasigneringen görs bara i gränssnittet, efter att anteckningen har lästs.'),
  'ge-dos-delegering': nej('Som att ge en dos.'),
  'registrera-delegering': nej('Delegeringar registreras bara i gränssnittet.'),
  'boka-remiss': nej('Scheman, tider och bokningar läses som Schedule, Slot och Appointment, men bokningen görs bara i gränssnittet.', [a('GET', '/fhir/Slot?schedule={id}'), a('GET', '/fhir/Appointment?patient={id}')]),
  'checka-in': nej('Incheckningen görs bara i gränssnittet. Resultatet syns i Appointment.status.', [a('GET', '/fhir/Appointment?patient={id}')]),
  gruppkallelse: nej('Kallelser skickas bara från gränssnittet.'),
  omboka: nej('Ombokningen görs bara i gränssnittet.', [a('GET', '/fhir/Appointment?patient={id}')]),
  'egen-ombokning': nej('Invånarens FHIR-API kan bara läsa.'),
  aterbesok: nej('Återbesöket sätts upp bara i gränssnittet.'),
  aterinsattning: delvis([a('POST', '/fhir/MedicationRequest')], 'Ordinationen kan göras via API:t, och raden i inkorgen försvinner då. Raden i inkorgen och förifyllningen ur den tidigare ordinationen finns bara i gränssnittet.'),
  'avsluta-aterinsattning': nej('Avslutet görs bara i gränssnittet. Det syns som en kommentar i MedicationRequest.'),
  'avvisa-remiss-satt-ut': nej('Bedömningen av remissen görs bara i gränssnittet.'),
  vardplan: nej('Vårdplaner läses som CarePlan men sätts upp bara i gränssnittet.', [a('GET', '/fhir/CarePlan?patient={id}')]),
  intagningsbeslut: nej('Beslut enligt LPT registreras bara i gränssnittet, där systemet prövar intyg och frister.'),
  'sok-journal': nej('FHIR-API:t söker per patient och resurstyp men inte i fritext.'),
  news2: delvis([a('POST', '/fhir/Observation,', 'ett anrop per mätvärde'), a('GET', '/fhir/Observation?patient={id}')], 'Varje mätvärde kan registreras via API:t, och NEWS2 räknas av systemet och kan läsas. Kontrollen registreras inte som en helhet, så åtgärden med KVÅ QD008 sparas bara från gränssnittet.'),
  'ordinera-mall': nej('Mallar med flera ordinationer används bara i gränssnittet. Varje ordination kan göras för sig med MedicationRequest.'),
  'dos-efterhand': nej('Som att ge en dos.'),
  // Runda 7, r3: underlaget är personalens API, inte det öppna FHIR-API:t.
  'exportera-underlag': nej('Faktureringsunderlaget hämtas med personalens API som CSV eller JSON. Det finns ingen FHIR-resurs för det i Vårdkällan.', [a('GET', '/api/ekonomi/underlag?vardenhet={id}&period={månad}&format=csv')]),
  'lamna-ut-hjalpmedel': nej('Utlämnade hjälpmedel registreras med personalens API och läses som ChargeItem i FHIR, men registreras inte via FHIR.', [a('POST', '/api/patient/{id}/hjalpmedel'), a('GET', '/fhir/ChargeItem?patient={id}')]),
  'extern-tillampning': ja([a('GET', '/fhir/.well-known/smart-configuration'), a('GET', '/oauth/authorize'), a('POST', '/oauth/token'), a('GET', '/fhir/Observation?patient={id}')], 'Det här flödet är API:t: tillämpningen startas med SMART on FHIR och läser med sin åtkomstbiljett.'),
  // Runda 7, r2: nyhetsrutan hör till gränssnittet.
  'forlang-inloggning': nej('Inloggningen och varningen före utloggningen hör till gränssnittet. API:t för tillämpningar har egna åtkomstbiljetter.'),
  nyheter: nej('Nyheterna hör till gränssnittet och har ingen FHIR-resurs. De står i en fil i källkoden med version och roller och läses av gränssnittet.'),
};

// Täckningen för alla flöden i klickbudgeten, i samma ordning.
export function tackning() {
  return FLODEN.map(f => ({ id: f.id, namn: f.namn, ...(TACKNING[f.id] ?? { status: 'inte_bedomt', anrop: [], text: 'Flödet har inte bedömts för API:t än.' }) }));
}
