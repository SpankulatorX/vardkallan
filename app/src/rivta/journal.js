// Runda 14, r2: Vårdkällan som producent av journaluppgifter för NPÖ, Journalen och sammanhållen journalföring
// (Sussa 2.2.1.7, 2.2.1.8 och 2.2.1.10), mot de pinnade tjänstekontrakten i RIVTA. Varje producent läser genom
// FHIR-API:t med den anropande organisationens systemkonto (konsumenter.js), så att behörighetsmotorn prövar varje
// uppgift: bara de vårdenheter och informationsmängder som organisationen är ansluten för, aldrig patienter med
// skyddade personuppgifter, aldrig spärrade uppgifter och aldrig det som systemförvaltningen har undantagit från
// nationella tjänster. Varje läsning loggas på patienten med kontraktet och organisationen i loggens resurs.
//
// En patient som inte finns och en patient som organisationen inte får se ger samma svar: inga poster och resultatet OK.
import { randomBytes } from 'node:crypto';
import { kontrakt } from './kontrakt.js';
import { vardkallan } from './tjanst.js';
import { vardgivare } from './konsumenter.js';
import { fhirResurser, enhetAv, datumRiv } from '../tjanstekontrakt.js';
import { tolka as tolkaIdentitet, hittaPaIdentitet } from '../identitet.js';
import { loggaRad } from '../logg.js';
import { Fel } from '../db.js';
import { harVardrelation, vardenhetFor, prova, aktivaSparrar } from '../atkomst.js';

export const OID = { personnummer: '1.2.752.129.2.1.3.1', samordningsnummer: '1.2.752.129.2.1.3.3', icd10se: '1.2.752.116.1.1.1', kva: '1.2.752.116.1.3.2.1.4', atc: '1.2.752.129.2.2.3.1.1' };

const logId = () => randomBytes(8).toString('hex');
const datum = (ts) => (ts ? ts.slice(0, 8) : null);

// Patienten i begäran. Ger { pid, patientId } eller { fel } med ett resultat enligt kontraktet.
function patientI(db, begaran) {
  const id = String(begaran.patientId?.id ?? '');
  const typ = begaran.patientId?.type;
  if (!/^\d{12}$/.test(id) || ![OID.personnummer, OID.samordningsnummer].includes(typ)) {
    return { fel: 'Patientens identitet ska vara ett personnummer eller samordningsnummer med tolv siffror och ha OID:n för sin typ.' };
  }
  return { pid: patientFranPersonId(db, id, typ), patientId: { id, type: typ } };
}

// Säkerhetsgranskningen av runda 14: samma uppslag av patienten i alla kontrakt. Bara exakt tolv siffror, och bara som
// personnummer eller samordningsnummer (med rätt typ när den anges). Allt annat ger ingen patient.
export function patientFranPersonId(db, id, typOid = null) {
  const s = String(id ?? '');
  if (!/^\d{12}$/.test(s)) return null;
  const t = tolkaIdentitet(s);
  if (!t?.ok || !['personnummer', 'samordningsnummer'].includes(t.typ)) return null;
  if (typOid && typOid !== (t.typ === 'personnummer' ? OID.personnummer : OID.samordningsnummer)) return null;
  return hittaPaIdentitet(db, t)?.patientId ?? null;
}

// Läser resurserna för kontraktet med organisationens systemkonto. Ger [] för en patient som inte finns eller som
// organisationen inte får se, och loggar uppslaget som nekat.
function resurser(db, k, konsument, pid, typer) {
  const personal = konsument.personal;
  const extra = `&_konsument=${encodeURIComponent(konsument.hsaId)}`;
  if (!pid) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'las_oversikt', resurs: `rivta/${k.namn}/${k.version}?_konsument=${konsument.hsaId}`, grund: 'nekad', resultat: 'nekad' });
    return [];
  }
  try { return fhirResurser({ db, personal }, k.namn, pid, { typer, extra }); } catch (e) {
    if (e instanceof Fel && e.status === 403) return [];
    throw e;
  }
}

// Huvudet för en post (PatientSummaryHeaderType och CPatientSummaryHeaderType har samma fält utom källsystemets namn).
function huvud(db, r, patientId, { kallsystemNamn = 'sourceSystemHSAId', titel = null } = {}) {
  const e = enhetAv(db, r);
  const tid = datumRiv(r.date ?? r.recordedDate ?? r.period?.start ?? r.effectiveDateTime ?? r.performedDateTime ?? r.authoredOn ?? null);
  const forfattare = r.author?.find?.(a => a.reference?.startsWith('Practitioner/')) ?? (r.recorder?.reference?.startsWith('Practitioner/') ? r.recorder : null);
  const hsa = forfattare ? db.query('SELECT hsa_id FROM personal WHERE id = ?').get(forfattare.reference.slice(13))?.hsa_id ?? null : null;
  const vg = vardgivare(db);
  return {
    documentId: `${r.resourceType}/${r.id}`, [kallsystemNamn]: vg, documentTitle: titel, documentTime: tid, patientId,
    accountableHealthcareProfessional: {
      authorTime: tid, healthcareProfessionalHSAId: hsa, healthcareProfessionalName: forfattare?.display ?? null,
      healthcareProfessionalOrgUnit: e ? { orgUnitHSAId: e.hsa_id, orgUnitName: e.namn } : null,
      healthcareProfessionalCareUnitHSAId: e?.hsa_id ?? null, healthcareProfessionalCareGiverHSAId: vg,
    },
    approvedForPatient: false, careContactId: r.encounter?.reference?.split('/')[1] ?? null, nullified: false,
  };
}

// Filtren i begäran: vårdenheter, period, källsystem och vårdkontakter.
function filtrera(poster, begaran, huvudNamn, db) {
  const enheter = new Set(begaran.careUnitHSAId ?? begaran.careUnitHSAid ?? []);
  const kontakter = new Set(begaran.careContactId ?? []);
  const kalla = begaran.sourceSystemHSAId ?? begaran.sourceSystemHSAid ?? null;
  const start = begaran.timePeriod?.start ?? null;
  const slut = begaran.timePeriod?.end ?? null;
  if (kalla && kalla !== vardgivare(db)) return [];
  return poster.filter(p => {
    const h = p[huvudNamn];
    if (!h.documentTime) return false;
    if (enheter.size && !enheter.has(h.accountableHealthcareProfessional.healthcareProfessionalCareUnitHSAId)) return false;
    if (kontakter.size && !kontakter.has(h.careContactId)) return false;
    if (start && datum(h.documentTime) < start) return false;
    if (slut && datum(h.documentTime) > slut) return false;
    return true;
  });
}

const ogiltig = (text) => ({ resultCode: 'ERROR', errorCode: 'INVALID_REQUEST', logId: logId(), message: text });
const ok = () => ({ resultCode: 'OK', logId: logId() });

// ---------------------------------------------------------------------------------------------------------------
// GetDiagnosis 2.0 (riv.clinicalprocess.healthcond.description): diagnoser ur FHIR Condition med ICD-10-SE.
export const GET_DIAGNOSIS = kontrakt('riv.clinicalprocess.healthcond.description', 'GetDiagnosis', '2.0');
vardkallan.registrera(GET_DIAGNOSIS, (ctx, { begaran, konsument, def }) => {
  const { db } = ctx;
  const p = patientI(db, begaran);
  if (p.fel) return { result: ogiltig(p.fel) };
  const poster = resurser(db, def, konsument, p.pid, ['Condition']).map(r => {
    const c = r.code?.coding?.[0];
    return {
      diagnosisHeader: huvud(db, r, p.patientId),
      diagnosisBody: {
        typeOfDiagnosis: r.category?.[0]?.text === 'Huvuddiagnos' ? 'Huvuddiagnos' : 'Bidiagnos',
        diagnosisTime: datumRiv(r.recordedDate),
        diagnosisCode: { code: c?.code ?? null, codeSystem: OID.icd10se, displayName: c?.display ?? r.code?.text ?? null },
      },
    };
  });
  return { diagnosis: filtrera(poster, begaran, 'diagnosisHeader', db), result: ok() };
});

// ---------------------------------------------------------------------------------------------------------------
// GetCareDocumentation 2.1: journalanteckningar ur FHIR Composition som ostrukturerad text. Typen av anteckning sätts
// bara när den går att se säkert ur rubriken (inskrivning, slutanteckning eller telefon); annars utelämnas den,
// eftersom den är frivillig i kontraktet.
export const GET_CARE_DOCUMENTATION = kontrakt('riv.clinicalprocess.healthcond.description', 'GetCareDocumentation', '2.1');
const avHtml = (div) => String(div ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function anteckningsKod(titel) {
  const t = String(titel ?? '').toLowerCase();
  if (/inskrivning/.test(t)) return 'ins';
  if (/epikris|slutanteckning/.test(t)) return 'slu';
  if (/telefon/.test(t)) return 'auf';
  return null;
}
vardkallan.registrera(GET_CARE_DOCUMENTATION, (ctx, { begaran, konsument, def }) => {
  const { db } = ctx;
  const p = patientI(db, begaran);
  if (p.fel) return { result: ogiltig(p.fel) };
  const poster = resurser(db, def, konsument, p.pid, ['Composition']).map(r => {
    const h = huvud(db, r, p.patientId, { kallsystemNamn: 'sourceSystemHSAid', titel: r.title ?? null });
    return {
      careDocumentationHeader: h,
      careDocumentationBody: {
        clinicalDocumentNote: {
          clinicalDocumentNoteCode: anteckningsKod(r.title), clinicalDocumentNoteTitle: r.title ?? null,
          clinicalDocumentNoteText: (r.section ?? []).map(s => `${s.title}: ${avHtml(s.text?.div)}`).join('\n'),
        },
      },
    };
  });
  return { careDocumentation: filtrera(poster, begaran, 'careDocumentationHeader', db), result: ok() };
});

// ---------------------------------------------------------------------------------------------------------------
// GetAlertInformation 2.0: överkänslighet ur FHIR AllergyIntolerance och övrig uppmärksamhetsinformation ur Flag.
// Kodsystemet för typen av uppmärksamhetsinformation sätts inte, eftersom Vårdkällan inte har kontrollerat OID:n.
export const GET_ALERT_INFORMATION = kontrakt('riv.clinicalprocess.healthcond.description', 'GetAlertInformation', '2.0');
vardkallan.registrera(GET_ALERT_INFORMATION, (ctx, { begaran, konsument, def }) => {
  const { db } = ctx;
  const p = patientI(db, begaran);
  if (p.fel) return { result: ogiltig(p.fel) };
  const poster = resurser(db, def, konsument, p.pid, ['Flag', 'AllergyIntolerance']).map(r => {
    const h = huvud(db, r, p.patientId);
    if (r.resourceType === 'AllergyIntolerance') {
      const atc = r.code?.coding?.find(c => /atc/i.test(c.system ?? ''));
      const lakemedel = r.category?.[0] === 'medication';
      return {
        alertInformationHeader: h,
        alertInformationBody: {
          typeOfAlertInformation: { code: 'overkanslighet', displayName: 'Överkänslighet' },
          validityTimePeriod: { start: datumRiv(r.recordedDate), end: r.clinicalStatus?.coding?.[0]?.code === 'inactive' ? datumRiv(r.note?.[0]?.time) : null },
          alertInformationComment: r.code?.text ?? null,
          hypersensitivity: {
            typeOfHypersensitivity: { displayName: lakemedel ? 'Läkemedel' : 'Annat' },
            degreeOfSeverity: { displayName: r.criticality === 'high' ? 'Allvarlig' : 'Mindre allvarlig' },
            pharmaceuticalHypersensitivity: lakemedel ? (atc ? { atcSubstance: { code: atc.code, codeSystem: OID.atc, displayName: atc.display ?? null } } : { nonATCSubstance: r.code?.text ?? null }) : null,
            otherHypersensitivity: lakemedel ? null : { hypersensitivityAgent: r.code?.text ?? null },
          },
        },
      };
    }
    return {
      alertInformationHeader: h,
      alertInformationBody: {
        typeOfAlertInformation: { code: r.category?.[0]?.coding?.[0]?.code ?? null, displayName: r.category?.[0]?.text ?? null },
        validityTimePeriod: { start: datumRiv(r.period?.start), end: datumRiv(r.period?.end) },
        alertInformationComment: r.code?.text ?? null,
      },
    };
  });
  return { alertInformation: filtrera(poster, begaran, 'alertInformationHeader', db), result: ok() };
});

// ---------------------------------------------------------------------------------------------------------------
// GetCareContacts 2.0 (riv.clinicalprocess.logistics.logistics): vårdkontakter ur FHIR Encounter. Kontraktets huvud har
// varken dokumenttid eller vårdkontaktens id, och svaret har inget resultat. Kodverken i kontraktet: typ 1 besök,
// 2 telefon, 3 vårdtillfälle, 4 dagsjukvård och 5 annan; status 1 ej påbörjad, 2 inställd, 3 pågående, 4 avbruten och
// 5 avslutad.
export const GET_CARE_CONTACTS = kontrakt('riv.clinicalprocess.logistics.logistics', 'GetCareContacts', '2.0');
const KONTAKTTYP = { IMP: 3, VR: 2, AMB: 1 };
const KONTAKTSTATUS = { planned: 1, cancelled: 2, 'in-progress': 3, arrived: 3, finished: 5 };
vardkallan.registrera(GET_CARE_CONTACTS, (ctx, { begaran, konsument, def }) => {
  const { db } = ctx;
  const p = patientI(db, begaran);
  if (p.fel) return {};
  const vg = vardgivare(db);
  const kalla = begaran.sourceSystemHSAId ?? null;
  if (kalla && kalla !== vg) return {};
  const enheter = new Set(begaran.careUnitHSAId ?? []);
  const kontakter = new Set(begaran.careContactId ?? []);
  const start = begaran.timePeriod?.start ?? null;
  const slut = begaran.timePeriod?.end ?? null;
  const poster = [];
  for (const r of resurser(db, def, konsument, p.pid, ['Encounter'])) {
    const e = enhetAv(db, r);
    const tid = datumRiv(r.period?.start);
    if (!e || !tid) continue;
    if ((enheter.size && !enheter.has(e.hsa_id)) || (kontakter.size && !kontakter.has(r.id)) || (start && datum(tid) < start) || (slut && datum(tid) > slut)) continue;
    poster.push({
      careContactHeader: { documentId: `Encounter/${r.id}`, sourceSystemHSAId: vg, patientId: p.patientId, approvedForPatient: false, nullified: false },
      careContactBody: {
        careContactCode: KONTAKTTYP[r.class?.code] ?? 5, careContactReason: r.reasonCode?.[0]?.text ?? null,
        careContactOrgUnit: { orgUnitHSAId: e.hsa_id, orgUnitName: e.namn },
        careContactTimePeriod: { start: tid, end: datumRiv(r.period?.end) },
        careContactStatus: KONTAKTSTATUS[r.status] ?? null,
      },
    });
  }
  return { careContact: poster };
});

// ---------------------------------------------------------------------------------------------------------------
// AssertCareEngagement 1.0 (riv.ehr.accesscontrol, Tillgänglig patient): har en viss person på en viss vårdenhet en
// vårdrelation till patienten? Säkerhetsgranskningen av runda 14: frågan prövas först i behörighetsmotorn med den
// anropande organisationens systemkonto och vårdenheten som resurs, som för de andra kontrakten. Svaret är nej när
// åtkomsten nekas: en vårdenhet som kontot inte omfattar, en vårdenhet som patienten har spärrat (ett systemkonto kan
// inte fråga patienten om samtycke, så ett samtycke ändrar inte svaret), skyddade personuppgifter, fel vårdgivare eller en
// identitet som inte är ett personnummer eller samordningsnummer med tolv siffror. Bara när åtkomsten är tillåten räknas
// vårdrelationen med samma regel som för all åtkomst i Vårdkällan (harVardrelation). Frågan loggas på patienten med det
// verkliga utfallet, tillåten eller nekad.
export const ASSERT_CARE_ENGAGEMENT = kontrakt('riv.ehr.accesscontrol', 'AssertCareEngagement', '1.0');
vardkallan.registrera(ASSERT_CARE_ENGAGEMENT, (ctx, { begaran, konsument }) => {
  const { db } = ctx;
  const pid = patientFranPersonId(db, begaran.subjectOfCareId);
  if (!pid) return { HasCareEngagement: false };
  const enhet = db.query("SELECT id FROM enheter WHERE hsa_id = ? AND typ = 'vardenhet'").get(begaran.careUnitHsaIdentity);
  const person = db.query("SELECT id, enhet_id FROM personal WHERE hsa_id = ? AND aktiv = 1 AND yrke <> 'systemkonto'").get(begaran.performer);
  const konto = require('../systemkonton.js').kontoFor(db, konsument.personal.id);
  const atkomst = enhet && begaran.careGiverHsaIdentity === vardgivare(db) && konto?.vardenheter.includes(enhet.id)
    ? prova(db, { personal: konsument.personal, patient: pid, handling: 'las_admin', resurs: { enhet_id: enhet.id } }) : { tillaten: false };
  const tillaten = atkomst.tillaten && !aktivaSparrar(db, pid).includes(enhet.id);
  const svar = Boolean(tillaten && person && vardenhetFor(db, person.enhet_id) === enhet.id && harVardrelation(db, pid, enhet.id, ctx.nu ?? new Date()));
  loggaRad(db, { personal_id: konsument.personal.id, enhet_id: konsument.personal.enhet_id, patient_id: pid, handling: 'las_admin',
    resurs: `rivta/AssertCareEngagement/1.0?_konsument=${konsument.hsaId}`, grund: tillaten ? 'systemkonto' : 'nekad', resultat: tillaten ? 'tillaten' : 'nekad' });
  return { HasCareEngagement: svar };
});
