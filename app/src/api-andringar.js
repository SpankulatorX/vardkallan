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
  // Runda 10, r1: systemkonton, prenumerationer på en population, överkänslighet och patienter via API:t och
  // Patient/$everything för personalen (Sussa 2.5.1.1 och 2.5.1.2).
  {
    version: '0.10.0', datum: '2026-11-08',
    text: 'Systemkonton för tillämpningar utan inloggad person med SMART Backend Services och pseudonymer som förval, prenumerationer på alla poster av en typ på kontots vårdenheter, registrering av överkänslighet och nya patienter, makulering av doser och provbeställningar via API:t och Patient/$everything för personalen.',
    resurser: [], skrivning: ['AllergyIntolerance:create', 'Patient:create', 'MedicationAdministration:delete', 'ServiceRequest:delete'],
    annat: ['SMART Backend Services med client_credentials och private_key_jwt för systemkonton', 'Prenumerationer på en population för systemkonton', 'Patient/[id]/$everything för personalen',
      'Makulering med DELETE eller $makulera och en orsak', 'Pseudonymer för systemkonton utan omfånget för identitet'],
  },
  {
    version: '0.9.0', datum: '2026-11-08',
    text: 'Diagnoser, bokning av en remiss och inskrivning kan göras via API:t, och CapabilityStatement anger programmets version. Ändringsloggen finns på sidan Öppet API och i API:t.',
    // Runda 10, r3: formulären och svaren i dem kom efter 0.9.0 och följer med i nästa version.
    resurser: ['Questionnaire', 'QuestionnaireResponse'], skrivning: ['Condition:create', 'Appointment:create', 'Encounter:create'],
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
