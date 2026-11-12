// De nationella tjänstekontrakten i bilaga K10, Nationella tjänster v2 (runda 7, r5, Sussa 2.2.1). En post per
// tjänstekontrakt med vad K10 anger (producent eller konsument och vilka nationella tjänster som använder kontraktet)
// och hur Vårdkällan svarar mot det: vilken FHIR-resurs eller vilket API, och om det är simulerat.
//
// För fyra kontrakt där Vårdkällan redan har uppgifterna finns en simulerad producent med ett RIV-TA-liknande API:
// GetCareDocumentation, GetDiagnosis, GetAlertInformation och GetCareContacts. Det är JSON i stället för SOAP och utan
// tjänsteplattformen, men begäran och svaret har kontraktens struktur med huvud och kropp. Producenten läser genom
// FHIR-API:t (fhir.hantera), så behörighetsmotorn, spärrar, inre sekretess, skyddad identitet och loggningen är samma
// som i FHIR och i gränssnittet. Varje anrop loggas med kontraktets namn i loggens resurs.
import { randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import { hittaPaToken, gallandeId } from './identitet.js';
import * as fhir from './fhir.js';

// Kolumnerna för nationella tjänster i K10 (F till L).
export const TJANSTER = ['1177 Vårdguidens e-tjänster', 'NPÖ', 'Journalen', 'Intygstjänsten', 'Infektionsverktyget', 'Kvalitetsregister', 'Elektronisk remiss'];
// Symbolerna i K10: ● används i något Sussa-landsting i dag och i framtiden, ○ målbild vid införande, ① kan nyttjas av
// kärnsystemet för att uppfylla funktionella krav.
export const SYMBOLER = { '●': 'Används i dag och i framtiden', '○': 'Målbild vid införande', '①': 'Kan användas för att uppfylla funktionella krav' };

// Status för Vårdkällans motsvarighet.
export const STATUS = {
  simulerad_producent: 'Simulerad producent med RIV-TA-liknande API',
  fhir: 'Uppgifterna finns i FHIR-API:t, inte anslutet till tjänsteplattformen',
  lokal: 'Funktionen finns i Vårdkällan, inte ansluten till den nationella tjänsten',
  saknas: 'Uppgifterna finns inte i Vårdkällan än',
};

// [kontrakt, domän, informationsmängd, producent, konsument, nationella tjänster (index i TJANSTER), sussa, status, motsvarighet]
const R = [
  ['GetDiagnosis', 'clinicalprocess:healthcond:description', 'Diagnos', '●', '○', [1, 2], '2.2.1.8', 'simulerad_producent', 'FHIR Condition, och /api/riv/GetDiagnosis'],
  ['GetFunctionalStatus', 'clinicalprocess:healthcond:description', 'PADL och funktionsnedsättning', '●', '○', [1], '2.2.1.8', 'saknas', 'PADL och funktionsnedsättning registreras inte'],
  ['GetMedicationHistory', 'clinicalprocess:activityprescription:actoutcome', 'Läkemedelsordinationer, förskrivningar och rekvisitionsläkemedel', '●', '○', [1, 2, 4, 5], '2.2.1.8', 'fhir', 'FHIR MedicationRequest och MedicationAdministration'],
  ['GetMaternityMedicalHistory', 'clinicalprocess:healthcond:actoutcome', 'Mödravårdsjournal', '○', '○', [2], '2.2.1.7', 'saknas', 'Ingen mödravårdsjournal'],
  ['GetRequestStatus', 'clinicalprocess:activity:request', 'Remisstatus', '○', '○', [2, 6], '2.2.1.12', 'fhir', 'FHIR ServiceRequest med remisstatus'],
  ['GetImagingOutcome', 'clinicalprocess:healthcond:actoutcome', 'Undersökningsresultat, bilddiagnostik', '●', '○', [1, 2], '2.2.1.8', 'saknas', 'Ingen bilddiagnostik'],
  ['GetLaboratoryOrderOutcome', 'clinicalprocess:healthcond:actoutcome', 'Undersökningsresultat, klinisk kemi', '●', '○', [1, 2], '2.2.1.8', 'fhir', 'FHIR Observation för provsvar'],
  ['GetReferralOutcome', 'clinicalprocess:healthcond:actoutcome', 'Undersökningsresultat, konsultationsremissvar', '●', '○', [1, 2], '2.2.1.8', 'fhir', 'FHIR ServiceRequest med svaret'],
  ['GetAlertInformation', 'clinicalprocess:healthcond:description', 'Uppmärksamhetsinformation', '●', '○', [1, 2], '2.2.1.8', 'simulerad_producent', 'FHIR Flag och AllergyIntolerance, och /api/riv/GetAlertInformation'],
  ['GetVaccinationHistory', 'clinicalprocess:activityprescription:actoutcome', 'Vaccinationer', '●', '○', [1, 2], '2.2.1.11', 'saknas', 'Vaccinationer registreras inte'],
  ['GetCarePlans', 'clinicalprocess:logistics:logistics', 'Vård- och omsorgsplan', '●', '○', [1], '2.2.1.8', 'fhir', 'FHIR CarePlan'],
  ['GetCareContacts', 'clinicalprocess:logistics:logistics', 'Vård- och omsorgskontakt', '●', '○', [1, 2, 5], '2.2.1.8', 'simulerad_producent', 'FHIR Encounter, och /api/riv/GetCareContacts'],
  ['GetCareDocumentation', 'clinicalprocess:healthcond:description', 'Vård- och omsorgsdokument, ostrukturerade', '●', '○', [1, 2], '2.2.1.8', 'simulerad_producent', 'FHIR Composition, och /api/riv/GetCareDocumentation'],
  // Runda 11, r7: GetObservations och GetActivities har en simulerad producent (Sussa 4.1.1.7).
  ['GetObservations', 'clinicalprocess:healthcond:basic', 'Observationer', '●', null, [2, 4, 5], '2.2.1.7', 'simulerad_producent', 'FHIR Observation, och /api/riv/GetObservations'],
  ['GetActivities', 'clinicalprocess:activity:actions', 'Aktiviteter', '●', null, [4, 5], '2.2.1.13', 'simulerad_producent', 'FHIR Procedure med KVÅ, och /api/riv/GetActivities'],
  ['GetRequestOutcome', 'clinicalprocess:healthcond:actoutcome', 'Allmänremiss', '○', '○', [6], '2.2.1.12', 'lokal', 'Remisser med kvittens, bedömning och svar inom vårdgivaren'],
  ['ProcessRequestOutcome', 'clinicalprocess:activity:request', 'Remisshantering', '○', '○', [6], '2.2.1.12', 'lokal', 'Remisser med kvittens, bedömning och svar inom vårdgivaren'],
  ['ProcessRequest', 'clinicalprocess:activity:request', 'Remisshantering', '○', '○', [6], '2.2.1.12', 'lokal', 'Remisser med kvittens, bedömning och svar inom vårdgivaren'],
  ['ProcessRequestConfirmation', 'clinicalprocess:activity:request', 'Remisshantering', '○', '○', [6], '2.2.1.12', 'lokal', 'Mottagningskvittens av remiss'],
  ['GetEmployeeIncludingProtectedPerson', 'infrastructure:directory:employee', 'HSA', null, '○', [], '2.2.1.1', 'lokal', 'Personal ur masterdata (fil i demon), FHIR Practitioner'],
  ['GetEmployee', 'infrastructure:directory:employee', 'HSA', null, '○', [], '2.2.1.1', 'lokal', 'Personal ur masterdata (fil i demon), FHIR Practitioner'],
  ['LookupResidentsForProfile', 'masterdata:citizen:citizen', 'Personuppgifter, den vanliga PU-tjänsten', null, '①', [2], '2.2.1.2', 'lokal', 'Befolkning ur masterdata (fil i demon)'],
  ['GetFilesForOrderID', 'masterdata:citizen:citizen', 'Personuppgifter, aviseringsfiler för lokal PU-tjänst', null, '①', [], '2.2.1.2', 'lokal', 'Befolkning ur masterdata (fil i demon)'],
  ['SearchResidentsForProfile', 'masterdata:citizen:citizen', 'Personuppgifter, sökning i PU-registret', null, '①', [], '2.2.1.2', 'lokal', 'Sökning på personnummer och andra identiteter'],
  ['GetAllBlocksForPatient', 'ehr:blocking', 'Säkerhet, spärr', null, '①', [], '2.2.1.3', 'lokal', 'Spärr i behörighetsmotorn'],
  ['GetBlocksForPatient', 'ehr:blocking', 'Säkerhet, spärr', null, '①', [], '2.2.1.3', 'lokal', 'Spärr i behörighetsmotorn'],
  ['CancelTemporaryExtendedRevoke', 'ehr:blocking', 'Säkerhet, spärr', null, '①', [], '2.2.1.3', 'lokal', 'Samtycke till spärrade uppgifter i stunden, gäller sessionen'],
  ['RegisterTemporaryExtendedRevoke', 'ehr:blocking', 'Säkerhet, spärr', null, '①', [], '2.2.1.3', 'lokal', 'Samtycke till spärrade uppgifter i stunden, registreras och loggas'],
  ['CheckBlocks', 'ehr:blocking', 'Säkerhet, spärr', null, '①', [], '2.2.1.3', 'lokal', 'Spärr prövas i varje anrop i behörighetsmotorn'],
  ['CancelExtendedConsent', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['CheckConsent', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['DeleteExtendedConsent', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['GetConsentsForCareProvider', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['GetConsentsForPatient', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['GetExtendedConsentsForPatient', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['RegisterExtendedConsent', 'ehr:patientconsent', 'Säkerhet, samtycke', null, '①', [], '2.2.1.4', 'saknas', 'Sammanhållen journalföring mellan vårdgivare finns inte'],
  ['AssertCareEngagement', 'ehr:accesscontrol', 'Säkerhet, Tillgänglig patient (TGP)', '●', null, [], '2.2.1.10', 'lokal', 'Vårdrelationen prövas i behörighetsmotorn'],
  ['GetAccessLogsForPatient', 'ehr:log', 'Säkerhet, logg', '●', null, [2], '2.2.1.10', 'fhir', 'FHIR AuditEvent för logggranskaren, och Vem har läst min journal i Min journal'],
  ['Update', 'itintegration:engagementindex', 'Engagemangsindex', null, '●', [], '2.2.1.10', 'lokal', 'Prenumerationer i FHIR-API:t meddelar nya och ändrade poster'],
  ['ProcessNotification', 'itintegration:engagementindex', 'Engagemangsindex', null, '○', [], '2.2.1.10', 'saknas', 'Tar inte emot aviseringar från andra vårdgivare'],
  ...['GetCertificate', 'ListCertificatesForCare', 'RegisterCertificate', 'RevokeCertificate', 'SendCertificateToRecipient'].map(k => [k, 'clinicalprocess:healthcond:certificate', 'Intyg', null, '①', [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte']),
  ['SendMessageToCare', 'clinicalprocess:healthcond:certificate', 'Intyg', '①', null, [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ['SendMessageToRecipient', 'clinicalprocess:healthcond:certificate', 'Intyg', null, '①', [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ['SetCertificateStatus', 'clinicalprocess:healthcond:certificate', 'Intyg', null, '①', [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ['CertificateStatusUpdateForCare', 'clinicalprocess:healthcond:certificate', 'Intyg', '①', null, [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ['CreateDraftCertificate', 'clinicalprocess:healthcond:certificate', 'Intyg', null, '①', [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ['ListCertificatesForCareWithQA', 'clinicalprocess:healthcond:certificate', 'Intyg', null, '①', [], '2.2.1.9', 'saknas', 'Intyg utfärdas inte'],
  ...[['UpdateBooking', '●'], ['GetSubjectOfCareSchedule', '●'], ['GetAllTimeTypes', '●'], ['GetAllCareTypes', '○'], ['CancelBooking', '●'], ['GetAvailableDates', '●'], ['GetBookingDetails', '●'],
    ['GetAvailableTimeslots', '●'], ['MakeBooking', '●'], ['GetAllHealthcareFacilities', '○'], ['GetAllPerformers', '○']]
    .map(([k, s]) => [k, 'crm:scheduling', 'Tidbokning', s, null, [0], '2.2.1.6', 'fhir', 'FHIR Schedule, Slot och Appointment, och bokning i Min journal']),
  ...['CancelForm', 'CreateFormRequest', 'GetForm', 'GetFormTemplate', 'SaveFormTemplate'].map(k => [k, 'infrastructure:eservicesupply:forminteraction', 'Formulärhantering', null, '①', [], '2.2.1.5', 'saknas', 'Ingen formulärtjänst']),
  ['AddMessageToPatientPortalInbox', 'infrastructure:eservicesupply:patientportal', 'Patientportal', null, '●', [0], '2.2.1.6', 'lokal', 'Kallelser och meddelanden i Min journal, Vårdkällans egen e-tjänst'],
  ['IsActiveUser', 'infrastructure:eservicesupply:patientportal', 'Patientportal', null, '●', [0], '2.2.1.6', 'lokal', 'Kanalvalet för kallelser i tidboken'],
  ...['ProcessPrescriptionReason', 'DeletePrescription', 'DeleteActivity', 'ProcessCondition', 'DeleteCondition', 'ProcessCareEncounter', 'DeletePrescriptionReason', 'ProcessActivity', 'DeleteCareEncounter', 'ProcessLaboratoryReport', 'DeleteLaboratoryReport']
    .map(k => [k, 'processdevelopment:infections', 'Infektionsverktyget', null, '①', [4], '2.2.1.13', 'saknas', 'Ingen koppling till Infektionsverktyget']),
];

// Vårdkällans roll ur K10: producent när K10 har en symbol i kolumnen Producent, konsument i kolumnen Konsument.
export const KONTRAKT = R.map(([kontrakt, doman, information, producent, konsument, tjanster, sussa, status, motsvarighet]) => ({
  kontrakt, doman, information, k10: { producent, konsument }, tjanster: tjanster.map(i => TJANSTER[i]), sussa, status, statusText: STATUS[status], motsvarighet,
  roll: producent && konsument ? 'producent och konsument' : producent ? 'producent' : 'konsument',
  simulerat: status !== 'saknas', api: status === 'simulerad_producent' ? `/api/riv/${kontrakt}` : null,
}));
// K10 har GetAllCareTypes på två rader. Den räknas en gång här.
export const K10_RADER = 81;

// Den simulerade producenten.
const OID = { personnummer: '1.2.752.129.2.1.3.1', samordningsnummer: '1.2.752.129.2.1.3.3', icd10se: '1.2.752.116.1.1.1', kva: '1.2.752.116.1.3.2.1.4' };
export const PRODUCENTER = ['GetCareDocumentation', 'GetDiagnosis', 'GetAlertInformation', 'GetCareContacts', 'GetObservations', 'GetActivities'];
const RESURSER = { GetCareDocumentation: ['Composition'], GetDiagnosis: ['Condition'], GetAlertInformation: ['Flag', 'AllergyIntolerance'], GetCareContacts: ['Encounter'], GetObservations: ['Observation'], GetActivities: ['Procedure'] };
// Handlingen i behörighetsmotorn per resurs, som i FHIR-API:t.
const ROLL_HANDLING = {
  Composition: (p) => (kanRoll(p, 'las_journal') ? 'las_journal' : 'las_omvardnad'), Condition: () => 'las_diagnoser',
  Flag: () => 'las_oversikt', AllergyIntolerance: () => 'las_oversikt', Encounter: () => 'las_admin',
  // Runda 11, r7.
  Observation: () => 'las_matvarden', Procedure: () => 'las_journal',
};
const NEKAD = 'Du har inte behörighet till uppgifterna, eller så finns ingen sådan patient. Försöket är loggat.';
const TABELL = { Composition: 'anteckningar', Condition: 'diagnoser', Flag: 'uppmarksamhet', AllergyIntolerance: 'overkanslighet', Encounter: 'vardkontakter', Observation: 'matvarden', Procedure: 'atgarder' };

export const datumRiv = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(/[- :]/g, '').slice(0, 14) : null);

// Begäran: { patientId: { id, type }, careUnitHSAId: [], datePeriod: { start, end }, logicalAddress }.
// Svaret: kontraktets lista och result { resultCode, logId, message }.
export function anropa(ctx, kontrakt, body = {}) {
  if (!PRODUCENTER.includes(kontrakt)) throw new Fel(404, 'Vårdkällan är inte producent för det tjänstekontraktet. Se tabellen över tjänstekontrakt.', 'saknas');
  const { db, personal, url } = ctx;
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const vardgivare = db.query("SELECT hsa_id FROM enheter WHERE typ = 'vardgivare' LIMIT 1").get()?.hsa_id;
  if (body.logicalAddress && body.logicalAddress !== vardgivare) throw new Fel(400, `Den logiska adressen ${body.logicalAddress} är inte Vårdkällans vårdgivare (${vardgivare}).`, 'ogiltig', { falt: ['logicalAddress'] });
  const pidText = String(body.patientId?.id ?? '').trim();
  if (!pidText) throw new Fel(400, 'Ange patientens personnummer eller samordningsnummer i patientId.id.', 'ogiltig', { falt: ['patientId'] });
  const typ = body.patientId?.type ?? OID.personnummer;
  if (![OID.personnummer, OID.samordningsnummer].includes(typ)) throw new Fel(400, 'Typen i patientId ska vara OID:n för personnummer eller samordningsnummer.', 'ogiltig', { falt: ['patientId'] });
  // Rollen prövas före uppslaget, och en patient som inte finns ger samma svar som en patient utan behörighet, så att
  // producenten inte röjer vilka patienter som finns. Ett uppslag som inte ger någon patient loggas som nekat.
  const handlingar = RESURSER[kontrakt].map(t => ROLL_HANDLING[t](personal));
  const resurs = `riv/${kontrakt}`;
  if (handlingar.some(h => !kanRoll(personal, h))) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: handlingar[0], resurs, grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, NEKAD, 'nekad');
  }
  const funnen = hittaPaToken(db, pidText);
  if (!funnen) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: handlingar[0], resurs, grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, NEKAD, 'nekad');
  }
  const pid = gallandeId(db, funnen);
  const enheter = new Set((body.careUnitHSAId ?? []).map(String));
  const start = body.datePeriod?.start ? String(body.datePeriod.start) : null;
  const slut = body.datePeriod?.end ? String(body.datePeriod.end) : null;
  const base = `${url.protocol}//${url.host}`;
  const lista = fhirResurser({ db, personal, valFor: ctx.valFor, base }, kontrakt, pid)
    .map(r => rivPost(db, kontrakt, r, { id: pidText.replace(/\D/g, ''), type: typ }, vardgivare));
  const filtrerad = lista.filter(x => x
    && (!enheter.size || enheter.has(x.header.accountableHealthcareProfessional?.healthcareProfessionalCareUnitHSAId))
    && (!start || (x.header.documentTime ?? '').slice(0, 8) >= start) && (!slut || (x.header.documentTime ?? '').slice(0, 8) <= slut));
  const nyckel = { GetCareDocumentation: 'careDocumentation', GetDiagnosis: 'diagnosis', GetAlertInformation: 'alertInformation', GetCareContacts: 'careContact', GetObservations: 'observation', GetActivities: 'activityGroup' }[kontrakt];
  return {
    [nyckel]: filtrerad,
    result: { resultCode: 'OK', logId: randomBytes(8).toString('hex'), message: 'Simulerad producent i Vårdkällan, utan tjänsteplattformen. Svaret innehåller bara det som den inloggade får se.' },
  };
}

// Runda 14, r2: resurserna för ett kontrakt, lästa genom FHIR-API:t med samma prövning och loggning. Kontraktets namn
// står i loggens resurs, och för ett anrop med tjänstekontrakt i RIVTA också den anropande organisationen (extra).
// Kastar Fel 403 med samma text för en patient som inte finns och en patient utan behörighet.
export function fhirResurser({ db, personal, valFor = () => ({}), base = 'https://vardkallan.local' }, kontrakt, pid, { typer = RESURSER[kontrakt], extra = '' } = {}) {
  const ut = [];
  for (const typRes of typer) {
    const u = new URL(`${base}/fhir/${typRes}?patient=${encodeURIComponent(pid)}&_kontrakt=${kontrakt}${extra}`);
    let svar;
    try { svar = fhir.hantera({ db, personal, invanare: null, nekade: null, valFor, url: u, base }); } catch (e) {
      // Nekandet är redan loggat på patienten i behörighetsmotorn. Svaret är detsamma som för en patient som inte finns.
      if (e instanceof Fel && (e.status === 403 || e.status === 404)) throw new Fel(403, NEKAD, 'nekad');
      throw e;
    }
    for (const e of svar.body.entry ?? []) ut.push(e.resource);
  }
  return ut;
}

export function enhetAv(db, resurs) {
  const tabell = TABELL[resurs.resourceType];
  const m = /^vt-(\d+)$/.exec(resurs.id);
  // Runda 11, r7: åtgärderna har id a-n, och härledda observationer (NEWS2) har inget eget id i matvarden.
  const a = /^a-(\d+)$/.exec(resurs.id);
  const rad = m ? db.query('SELECT enhet_id FROM vardtillfallen WHERE id = ?').get(Number(m[1])) : a ? db.query('SELECT enhet_id FROM atgarder WHERE id = ?').get(Number(a[1]))
    : /^\d+$/.test(String(resurs.id)) ? db.query(`SELECT enhet_id FROM ${tabell} WHERE id = ?`).get(Number(resurs.id)) : null;
  const ve = rad ? vardenhetFor(db, rad.enhet_id) : null;
  return ve ? db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(ve) : null;
}

// Patientens id i svaret är det som frågades efter, så att svaret aldrig lämnar ut mer om identiteten än frågan.
function rivPost(db, kontrakt, r, patientId, vardgivare) {
  const e = enhetAv(db, r);
  const tid = r.date ?? r.recordedDate ?? r.period?.start ?? r.effectiveDateTime ?? r.performedDateTime ?? null;
  const forfattare = r.author?.find?.(a => a.reference?.startsWith('Practitioner/'));
  const header = {
    documentId: `${r.resourceType}/${r.id}`, sourceSystemHSAId: vardgivare, documentTime: datumRiv(tid),
    patientId,
    accountableHealthcareProfessional: {
      authorTime: datumRiv(tid), healthcareProfessionalHSAId: forfattare ? db.query('SELECT hsa_id FROM personal WHERE id = ?').get(forfattare.reference.slice(13))?.hsa_id ?? null : null,
      healthcareProfessionalName: forfattare?.display ?? null, healthcareProfessionalCareUnitHSAId: e?.hsa_id ?? null, healthcareProfessionalCareGiverHSAId: vardgivare,
    },
    approvedForPatient: false, careContactId: r.encounter?.reference?.split('/')[1] ?? null, nullified: false,
  };
  if (kontrakt === 'GetDiagnosis') {
    const c = r.code?.coding?.[0];
    return { header, body: { typeOfDiagnosis: r.category?.[0]?.text === 'Huvuddiagnos' ? 'Huvuddiagnos' : 'Bidiagnos', diagnosisTime: datumRiv(r.recordedDate), diagnosisCode: { code: c?.code, codeSystem: OID.icd10se, displayName: c?.display ?? r.code?.text } } };
  }
  // Runda 11, r7: observationer med kod och värde, och aktiviteter med KVÅ.
  if (kontrakt === 'GetObservations') {
    const c = r.code?.coding?.[0];
    return { header, body: { observationCode: { code: c?.code ?? null, codeSystem: c?.system ?? null, displayName: c?.display ?? r.code?.text ?? null }, observationTime: datumRiv(r.effectiveDateTime),
      value: r.valueQuantity ? { pq: { value: r.valueQuantity.value, unit: r.valueQuantity.unit ?? r.valueQuantity.code } } : r.valueString != null ? { st: r.valueString } : r.valueCodeableConcept ? { cv: { code: r.valueCodeableConcept.coding?.[0]?.code ?? null, displayName: r.valueCodeableConcept.text ?? null } } : null } };
  }
  if (kontrakt === 'GetActivities') {
    const c = r.code?.coding?.find(x => /kva|1\.2\.752\.116\.1\.3\.2\.1\.4/i.test(x.system ?? '')) ?? r.code?.coding?.[0];
    return { header, body: { activityCode: { code: c?.code ?? null, codeSystem: OID.kva, displayName: c?.display ?? r.code?.text ?? null }, activityTime: datumRiv(r.performedDateTime ?? r.performedPeriod?.start) } };
  }
  if (kontrakt === 'GetCareDocumentation') {
    const text = (r.section ?? []).map(s => `${s.title}: ${s.text.div.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')}`).join('\n');
    return { header: { ...header, documentTitle: r.title, nullified: false }, body: { clinicalDocumentNote: { clinicalDocumentNoteCode: 'utr', clinicalDocumentNoteTitle: r.title, clinicalDocumentNoteText: text } } };
  }
  if (kontrakt === 'GetCareContacts') {
    const klass = r.class?.code;
    const kod = klass === 'IMP' ? '3' : klass === 'VR' ? '2' : '1';
    return { header, body: { careContactCode: kod, careContactReason: r.reasonCode?.[0]?.text ?? null, careContactOrgUnit: { orgUnitHSAId: e?.hsa_id ?? null, orgUnitName: e?.namn ?? null },
      careContactTimePeriod: { start: datumRiv(r.period?.start), end: datumRiv(r.period?.end) }, careContactStatus: r.status === 'finished' ? 'Avslutad' : r.status === 'planned' ? 'Planerad' : 'Pågående' } };
  }
  // GetAlertInformation: överkänslighet ur AllergyIntolerance och övrig uppmärksamhetsinformation ur Flag.
  if (r.resourceType === 'AllergyIntolerance') {
    return { header, body: { typeOfAlertInformation: { code: 'overkanslighet', displayName: 'Överkänslighet' }, alertInformationComment: r.code?.text ?? null,
      validityTimePeriod: { start: datumRiv(r.recordedDate), end: r.clinicalStatus?.coding?.[0]?.code === 'inactive' ? datumRiv(r.note?.[0]?.time) : null }, hypersensitivity: { typeOfHypersensitivity: r.category?.[0] === 'medication' ? 'Läkemedel' : 'Annat', degreeOfSeverity: r.criticality === 'high' ? 'Allvarlig' : 'Mindre allvarlig', atcSubstance: r.code?.coding?.[0]?.code ?? null } } };
  }
  return { header, body: { typeOfAlertInformation: { code: r.category?.[0]?.coding?.[0]?.code ?? null, displayName: r.category?.[0]?.text ?? null }, alertInformationComment: r.code?.text ?? null,
    validityTimePeriod: { start: datumRiv(r.period?.start), end: datumRiv(r.period?.end) } } };
}
