// Ändringsloggen för det öppna API:t (runda 9, r6, Sussa 2.5.1.1 och 2.5.1.3). Ett öppet gränssnitt som hålls aktuellt
// behöver tala om vad som ändrats i varje version. Varje resurstyp och varje skrivning som CapabilityStatement anger har
// en rad här med den version där den kom, och testet i app/test/runda9-r6.test.js stoppar bygget om
// CapabilityStatement anger något som loggen saknar, eller tvärtom. Versionen i CapabilityStatement är programmets version
// i package.json, och den senaste raden här gäller samma version.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const VERSION = (() => { try { return JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')).version; } catch { return null; } })();

// resurser är resurstyperna som kom i versionen, skrivning är resurstyp och interaktion (Condition:create) och
// annat är ändringar som inte är en resurstyp, till exempel SMART on FHIR.
export const ANDRINGAR = [
  // Runda 14: version 1.4. Varje del lägger sina rader i annat i ett eget block.
  {
    version: '1.4.0', datum: '2026-11-13',
    text: 'Inga nya resurstyper eller skrivningar i FHIR.',
    resurser: [], skrivning: [], annat: [
      // Runda 14, r2: tjänstekontrakten i RIVTA (docs/rivta.md och docs/api-avvikelser.md).
      'Tjänstekontrakten i RIVTA: producent för GetCareDocumentation 2.1, GetDiagnosis 2.0, GetAlertInformation 2.0, GetCareContacts 2.0 och AssertCareEngagement 1.0 med SOAP och ömsesidig TLS, och konsument för HSA, PU-tjänsten, spärrtjänsten, samtyckestjänsten, den aggregerande tjänsten och engagemangsindex (simulerade i demon)',
      'Tabellen över tjänstekontrakt har för varje kontrakt i RIVTA versionen, rollen och att det är byggt, testat lokalt och inte anslutet (rivta och rivtaStatus)',
      'Nya rutter i det interna API:t: tillfällig hävning av spärr hos en annan vårdgivare, jämförelse av spärrar med spärrtjänsten, folkbokföringen ur PU-tjänsten, personalens uppgifter ur HSA och engagemangsindex (docs/api-avvikelser.md)',
      // Runda 14, r3: intyg, e-remiss och vaccinationer med tjänstekontrakt i RIVTA.
      'Intyg genom intygsapplikationen (/api/patient/:id/intyg och /api/intygsapplikation/:id) och e-remiss (/api/patient/:id/eremiss) i det interna API:t (docs/api-avvikelser.md)',
      'Tjänstekontrakten CreateDraftCertificate, CertificateStatusUpdateForCare, ListCertificatesForCareWithQA, ProcessRequest, ProcessRequestConfirmation, ProcessRequestOutcome och GetVaccinationHistory i RIVTA, byggda och validerade mot sina scheman (docs/rivta.md)',
      'Formulärtjänsten, 1177:s inkorg, NKRR, dosdispenseringen och Infektionsverktyget som konsument mot simulerade tjänster, och RIVTA Basic Profile 2.0 med wsa:To och xsi:type i grunden (docs/rivta.md)',
      // Runda 14, r4: mellanarkivet, reservdatorn för läkemedel och testprotokollet (docs/api-avvikelser.md).
      'Journalhandlingar i mellanarkivet per patient och en i taget, och beslut om överföring till mellanarkiv med underlag och överföring, i det interna API:t',
      'Listan för vårdenhetens reservdator för läkemedel med inskrivna patienters ordinationer och dagens doser i det interna API:t',
      'Nytt: GET /api/krav/testprotokoll, testprotokollet med spårbarhet från krav till testfall, öppet utan inloggning',
    ],
  },
  // Runda 13: version 1.3.1, rättelserna för kvällar och nätter.
  {
    version: '1.3.1', datum: '2026-11-12',
    text: 'Inga nya resurstyper eller skrivningar i FHIR.',
    resurser: [], skrivning: [], annat: [
      'Kassans demoläge i användartestet svarar 201 med en ny ankomst i stället för 400 när ingen tid har öppnat för incheckning',
    ],
  },
  // Runda 13: version 1.3. Varje del lägger sina rader i annat i ett eget block.
  {
    version: '1.3.0', datum: '2026-11-12',
    text: 'Inga nya resurstyper eller skrivningar i FHIR.',
    resurser: [], skrivning: [], annat: [
      // Runda 13, r1: testinbjudan, guidade uppdrag och synpunkter.
      'Synpunkter från testare, guidade uppdrag med jämförelse och testledarens läsning med läskod i det interna API:t (docs/api-avvikelser.md)',
      // Runda 13, r4: väntelistan, vätskebalansen, vaccinationerna och systemförvaltningen (docs/api-avvikelser.md).
      'Väntan som inte räknas i vårdgarantin och avslut från väntelistan med orsak, och vårdgarantin för sig i väntelistans poster, i det interna API:t (docs/api-avvikelser.md)',
      'Tid och period för en registrering i vätskebalansen i det interna API:t',
      'Kontrollen före en vaccination och dosens utgångsdatum och injektionsställe i det interna API:t',
      'Allt som väntar på godkännande i systemförvaltningen i det interna API:t',
      // Runda 13, r2: kapacitet, tak och fynden från säkerhetsgranskningen av runda 12.
      'Svaret 503 med koden demo_full och tiden tills det är lönt att försöka igen när demon är full, och kapaciteten i /api/drift',
      'Taken 429 för tunga anrop per sandlåda och adress, och 507 när sandlådans databas är full',
      'Återställning av en säkerhetskopia med fyra ögon: ett förslag och ett godkännande av en andra systemförvaltare',
      'Att lägga till eller ta bort en faktor för flerfaktor kräver en färsk bekräftelse med en befintlig faktor',
    ],
  },
  // Runda 12: version 1.2. Varje del lägger sina rader i annat i ett eget block.
  {
    version: '1.2.0', datum: '2026-11-11',
    text: 'Inga nya resurstyper eller skrivningar i FHIR.',
    resurser: [], skrivning: [], annat: [
      // Runda 12, r1: journalens struktur och läkemedelsmallarna utan programmerare.
      'Mallar, sökord och mätvärdestyper som systemförvaltningen skapar i /api/journalstruktur, med anteckningstypens och sökordens koder i Composition och mätvärdestypens kod och UCUM i Observation',
      'Läkemedelsmallar som läkaren bygger och ändrar i det interna API:t, som beskrivs i docs/api-avvikelser.md',
      // Runda 12, r2: uppgraderingar med återgång, säkerhetskopior och schemaversionen i /api/health.
      'Uppgraderingar med återgång och godkännande av två systemförvaltare i det interna API:t (docs/api-avvikelser.md)',
      'Säkerhetskopior och återställning till en tidpunkt i det interna API:t (docs/api-avvikelser.md)',
      'Programmets schemaversion i hälsokontrollen',
      'Återföringen av all data i exportpaketet tar med vårdgivarens tabeller som NDJSON och databasens schema, och paketet har XML-schemana för METS',
    ],
  },
  // Runda 11: version 1.1. Inga nya resurstyper eller skrivningar i FHIR.
  {
    version: '1.1.0', datum: '2026-11-11',
    text: 'Modulregistret i GET /api/moduler: varje modul med status, var den nås och hur många av dess krav som är uppfyllda, räknat ur koden och kravregistret. Inga nya resurstyper eller skrivningar i FHIR. Operationsplaneringen och anestesin har nya rutter i det interna API:t, som beskrivs i docs/api-avvikelser.md. Graviditet, förlossning och BB i REST-API:t: ultraljudsjournalen, inskrivningssamtalet, CTG, smärtlindringen, födelseanmälan, BB-journalen, efterkontrollen och rapporteringen till Graviditetsregistret (simulerat). Inga nya FHIR-resurser. Regimbiblioteket med versioner och godkännande, beredningsenhetens arbetslista, lager, spårbarhet och kapacitet, infusionens händelser, premedicineringen, patientens rapporter om cytostatika i Min journal, transfusionsreaktioner och blodcentralens vy. Bilder, filmer och ljud i journalen som Media, studierna i det simulerade multimediaarkivet som ImagingStudy, och DICOMweb (QIDO-RS och WADO-RS) mot arkivet. Undersökningar i radiologi, klinisk fysiologi och klinisk neurofysiologi med åtgärden i KVÅ, prioritet och vårdförlopp i ServiceRequest. Producentsystemen skickar rättade svar, koder och underlag, och patientnära instrument skickar sina svar med provets etikett. Den simulerade producenten för tjänstekontrakt svarar också på GetObservations och GetActivities, med samma behörighet och loggning som FHIR.',
    resurser: ['Media', 'ImagingStudy'], skrivning: [], annat: ['Modulregistret i GET /api/moduler', 'Graviditet, förlossning och BB i REST-API:t (docs/api-avvikelser.md)', 'Tabeller för graviditeter och förlossningar i datauttaget för uppföljning', 'Regimbiblioteket och vårdenhetens vy för cytostatika', 'Beredningsenheten för cytostatika', 'Infusionens start, paus, reaktion, extravasering och slut', 'Transfusionsreaktioner och blodcentralens vy', 'DICOMweb mot det simulerade multimediaarkivet med QIDO-RS och WADO-RS', 'DiagnosticReport med status corrected eller amended för ett rättat svar', 'DiagnosticReport.presentedForm för underlag i svaret', 'Koder i KVÅ och Snomed CT i DiagnosticReport.code och conclusionCode', 'DiagnosticReport.specimen med provets etikett från ett patientnära instrument', 'DiagnosticReport.imagingStudy med studiens DICOM-uid', 'GetObservations och GetActivities i den simulerade producenten för tjänstekontrakt'],
  },
  // Runda 10, r1: systemkonton, prenumerationer på en population, överkänslighet och patienter via API:t och
  // Patient/$everything för personalen (Sussa 2.5.1.1 och 2.5.1.2).
  {
    version: '1.0.0', datum: '2026-11-08',
    text: 'Systemkonton för tillämpningar utan inloggad person med SMART Backend Services och pseudonymer som förval, prenumerationer på alla poster av en typ på kontots vårdenheter, registrering av överkänslighet och nya patienter, makulering av doser och provbeställningar via API:t och Patient/$everything för personalen.',
    // Runda 10, r3: formulären och svaren i dem.
    resurser: ['Questionnaire', 'QuestionnaireResponse'], skrivning: ['AllergyIntolerance:create', 'Patient:create', 'MedicationAdministration:delete', 'ServiceRequest:delete'],
    annat: ['SMART Backend Services med client_credentials och private_key_jwt för systemkonton', 'Prenumerationer på en population för systemkonton', 'Patient/[id]/$everything för personalen',
      'Makulering med DELETE eller $makulera och en orsak', 'Pseudonymer för systemkonton utan omfånget för identitet'],
  },
  {
    version: '0.9.0', datum: '2026-11-08',
    text: 'Diagnoser, bokning av en remiss och inskrivning kan göras via API:t, och CapabilityStatement anger programmets version. Ändringsloggen finns på sidan Öppet API och i API:t.',
    resurser: [], skrivning: ['Condition:create', 'Appointment:create', 'Encounter:create'],
    annat: ['Versionen i CapabilityStatement följer programmets version', 'Ändringsloggen i API:t'],
  },
  {
    version: '0.8.0', datum: '2026-11-08',
    text: 'Provtagningens rör och laboratoriernas svar.',
    resurser: ['DiagnosticReport', 'Specimen'], skrivning: [], annat: [],
  },
  {
    version: '0.7.0', datum: '2026-11-08',
    text: 'Vaccinationer i barnhälsovården och posterna i faktureringsunderlaget.',
    resurser: ['Immunization', 'ChargeItem'], skrivning: [], annat: [],
  },
  {
    version: '0.6.0', datum: '2026-11-03',
    text: 'Skrivning via FHIR, prenumerationer, SMART on FHIR, tidboken, läkemedelsprocessen, vårdplaner och åtgärder med KVÅ.',
    resurser: ['EpisodeOfCare', 'MedicationAdministration', 'List', 'CarePlan', 'Procedure', 'Schedule', 'Slot', 'Appointment', 'Subscription'],
    skrivning: ['Observation:create', 'Composition:create', 'Composition:update', 'MedicationRequest:create', 'MedicationRequest:update', 'ServiceRequest:create', 'Appointment:patch', 'Encounter:patch', 'Subscription:create', 'Subscription:delete'],
    annat: ['SMART on FHIR med EHR launch och standalone launch', 'Prenumerationer med rest-hook och bara id i meddelandet'],
  },
  {
    version: '0.1.0', datum: '2026-10-31',
    text: 'Första versionen av det öppna API:t: läsning av journalen i FHIR R4 med samma behörighet och loggning som gränssnittet, och definitionerna av tilläggen och kodsystemen.',
    resurser: ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition', 'Organization', 'Practitioner', 'AuditEvent', 'StructureDefinition', 'CodeSystem', 'ValueSet'],
    skrivning: [], annat: ['Patient/[id]/$everything', 'Min journal når sina egna resurser med patientens session'],
  },
];

// Runda 13, r3: flerfaktor som krav, begäran om undantag av en anteckning och vårdgarantierna (docs/api-avvikelser.md).
ANDRINGAR.find(a => a.version === '1.3.0').annat.push(
  'När vårdgivaren kräver flerfaktor slutför POST /api/flerfaktor/totp och /api/flerfaktor/passkey inloggningen och ger sessionen',
  'Begäran om undantag av en anteckning från anteckningens meny, och systemförvaltarens avslag av en begäran',
  'Behandlingsgarantin i anmälan till operation och på operationsväntelistan',
  'Uppgift om hur identiteten kontrollerades när en dos ges utan skannat armband',
  'Verksamhetschefens godkännande av gallring och radering för sin vårdenhet',
  'Uppgift om att det finns spärrade uppgifter hos en annan vårdgivare vid sammanhållen journalföring',
);

// Runda 12, r3: flerfaktorsinloggning i det interna API:t (docs/api-avvikelser.md).
ANDRINGAR.find(a => a.version === '1.2.0').annat.push('Flerfaktorsinloggning med passkeys (WebAuthn) och engångskoder (RFC 6238) i det interna API:t');

// Det CapabilityStatement anger: alla resurstyper och alla skrivande interaktioner.
const SKRIVANDE = new Set(['create', 'update', 'patch', 'delete']);
export function franCapability(cs) {
  const resurser = cs.rest[0].resource;
  return {
    resurser: resurser.map(r => r.type),
    skrivning: resurser.flatMap(r => r.interaction.filter(i => SKRIVANDE.has(i.code)).map(i => `${r.type}:${i.code}`)),
  };
}

export function andringslogg() {
  return { version: VERSION, andringar: ANDRINGAR };
}
