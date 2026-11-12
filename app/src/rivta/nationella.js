// Runda 14, r2: de nationella tjänsterna som Vårdkällan är konsument av, simulerade i demon (Sussa 2.2.1.1 till 2.2.1.4
// och 2.2.1.10). Varje simulerad tjänst är en producent med samma kuvert, validering och fel som en riktig producent
// (tjanst.js), och Vårdkällan anropar den som konsument genom klient.js, så att varje begäran och varje svar valideras mot
// det pinnade schemat. Tjänsterna är inte Ineras: deras logiska adress och HSA-id är påhittade och märkta som simulerade,
// och deras uppgifter är demons påhittade uppgifter.
//
//   Aggregerande tjänst   GetCareDocumentation, GetDiagnosis, GetCareContacts och GetMedicationHistory med uppgifterna hos
//                         den simulerade andra vårdgivaren (sammanhallen.js), också de som patienten har spärrat där.
//   Spärrtjänsten         CheckBlocks, GetAllBlocksForPatient, GetBlocksForPatient, RegisterTemporaryExtendedRevoke och
//                         CancelTemporaryExtendedRevoke. Spärrarna hos den andra vårdgivaren, och Vårdkällans egna spärrar
//                         som de var när tjänsten simulerades första gången i sandlådan.
//   Samtyckestjänsten     CheckConsent, RegisterExtendedConsent och CancelExtendedConsent.
//
// Anropen i demon går i samma process och svarar direkt (iProcessenSynk). Mot en riktig tjänsteplattform går samma
// begäran över https med ömsesidig TLS (klient.js https).
import { randomUUID } from 'node:crypto';
import { kontrakt } from './kontrakt.js';
import { skapaTjanst } from './tjanst.js';
import { anropaSynk, iProcessenSynk } from './klient.js';
import { vardgivare } from './konsumenter.js';
import { datumRiv } from '../tjanstekontrakt.js';
import { hittaPaToken, gallandeId } from '../identitet.js';
import { vardenhetFor } from '../atkomst.js';

export const NATIONELL = 'SE0000000000-SIMNATIONELL';
export const NAMN = 'Simulerad nationell tjänst i demon';
const PNR_OID = '1.2.752.129.2.1.3.1';

const D = 'riv.clinicalprocess.healthcond.description';
export const K = {
  GetCareDocumentation: kontrakt(D, 'GetCareDocumentation', '2.1'),
  GetDiagnosis: kontrakt(D, 'GetDiagnosis', '2.0'),
  GetCareContacts: kontrakt('riv.clinicalprocess.logistics.logistics', 'GetCareContacts', '2.0'),
  GetMedicationHistory: kontrakt('riv.clinicalprocess.activityprescription.actoutcome', 'GetMedicationHistory', '2.2'),
  CheckBlocks: kontrakt('riv.ehr.blocking', 'CheckBlocks', '3.0'),
  GetAllBlocksForPatient: kontrakt('riv.ehr.blocking', 'GetAllBlocksForPatient', '2.0'),
  GetBlocksForPatient: kontrakt('riv.ehr.blocking', 'GetBlocksForPatient', '2.0'),
  RegisterTemporaryExtendedRevoke: kontrakt('riv.ehr.blocking', 'RegisterTemporaryExtendedRevoke', '2.0'),
  CancelTemporaryExtendedRevoke: kontrakt('riv.ehr.blocking', 'CancelTemporaryExtendedRevoke', '2.0'),
  CheckConsent: kontrakt('riv.ehr.patientconsent', 'CheckConsent', '1.0'),
  RegisterExtendedConsent: kontrakt('riv.ehr.patientconsent', 'RegisterExtendedConsent', '1.0'),
  CancelExtendedConsent: kontrakt('riv.ehr.patientconsent', 'CancelExtendedConsent', '1.0'),
};

// Bara Vårdkällans vårdgivare anropar de simulerade tjänsterna.
const provaVardkallan = (db, avsandare) => (avsandare?.hsaId && avsandare.hsaId === vardgivare(db)
  ? { tillaten: true, konsument: { hsaId: avsandare.hsaId } }
  : { tillaten: false, skal: `Organisationen ${avsandare?.hsaId ?? '(okänd)'} är inte ansluten till ${NAMN}.` });
export const tjanst = skapaTjanst({ namn: NAMN, adresser: () => [NATIONELL], prova: provaVardkallan, logga: false });

// Transporten från Vårdkällan till de simulerade tjänsterna i samma sandlåda. Ett test kan byta transport (till exempel
// en tjänst som inte svarar) med satt(...).
let ersattning = null;
export const satt = (t) => { ersattning = t; };
export const transport = (db) => ersattning ?? iProcessenSynk(tjanst, { ctx: { db }, avsandare: { hsaId: vardgivare(db), via: 'direkt' } });
// Ett anrop som konsument till en simulerad nationell tjänst, med begäran och svar validerade mot schemat.
export const anropa = (db, namn, begaran) => anropaSynk(K[namn], { logiskAdress: NATIONELL, begaran, transport: transport(db), db });

// ---------------------------------------------------------------------------------------------------------------
// Tillstånd för de simulerade tjänsterna i sandlådan. Raderna har patientens id i Vårdkällan, så att de följer patienten.
function sakra(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS rivta_sim_sparrar (block_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, typ TEXT NOT NULL,
      vardgivare_hsa TEXT NOT NULL, vardenhet_hsa TEXT, start TEXT, slut TEXT, skapad TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rivta_sim_havningar (havning_id TEXT PRIMARY KEY, block_id TEXT NOT NULL, patient_id TEXT NOT NULL, vardenhet_hsa TEXT NOT NULL,
      personal_hsa TEXT, slut TEXT NOT NULL, avslutad TEXT);
    CREATE TABLE IF NOT EXISTS rivta_sim_samtycken (intyg_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, typ TEXT NOT NULL, vardgivare_hsa TEXT NOT NULL,
      vardenhet_hsa TEXT NOT NULL, personal_hsa TEXT, start TEXT, slut TEXT, registrerat TEXT NOT NULL, aterkallat TEXT);
    CREATE TABLE IF NOT EXISTS rivta_sim_status (nyckel TEXT PRIMARY KEY, varde TEXT);`);
  if (db.query("SELECT 1 FROM rivta_sim_status WHERE nyckel = 'sparrar'").get()) return;
  // Spärrarna hos den andra vårdgivaren: en spärr per spärrad uppgift, för just den dagen och vårdenheten.
  const sj = require('../sammanhallen.js');
  const nu = new Date().toISOString();
  const ins = db.query('INSERT OR IGNORE INTO rivta_sim_sparrar (block_id, patient_id, typ, vardgivare_hsa, vardenhet_hsa, start, slut, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const [pid, poster] of Object.entries(sj.POSTER)) {
    for (const p of poster.filter(x => x.sparrad)) {
      const dag = p.tid.slice(0, 10);
      ins.run(`sim-${p.id}`, pid, 'Outer', sj.VARDGIVARE.hsaId, sj.ENHETER[p.enhet].hsaId, `${dag}T00:00:00Z`, `${dag}T23:59:59Z`, nu);
    }
  }
  // Vårdkällans egna spärrar, som om de hade registrerats i tjänsten när den simulerades första gången.
  const vg = vardgivare(db);
  for (const s of db.query('SELECT id, patient_id, enhet_id FROM sparrar WHERE aktiv = 1').all()) {
    const hsa = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(vardenhetFor(db, s.enhet_id))?.hsa_id;
    if (hsa) ins.run(`vk-${s.id}`, s.patient_id, 'Inner', vg, hsa, null, null, nu);
  }
  db.query("INSERT INTO rivta_sim_status (nyckel, varde) VALUES ('sparrar', ?)").run(nu);
}

const patientAv = (db, pnr) => { const f = hittaPaToken(db, String(pnr ?? '')); return f ? gallandeId(db, f) : null; };
const pnrAv = (db, pid) => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid)?.personnummer ?? null;
const resultat = (kod = 'OK', text = 'Simulerad tjänst i demon.') => ({ ResultCode: kod, ResultText: text });
const slutet = '9999-12-31T23:59:59';
const tid = (iso) => (iso ? iso.replace(/\.\d+Z$/, '').replace(/Z$/, '') : null);

// ---------------------------------------------------------------------------------------------------------------
// Aggregerande tjänst: uppgifterna hos den simulerade andra vårdgivaren, i varje kontrakts form.
function poster(db, begaran) {
  const sj = require('../sammanhallen.js');
  const pid = patientAv(db, begaran.patientId?.id);
  return { sj, lista: pid ? (sj.POSTER[pid] ?? []) : [], patientId: { id: String(begaran.patientId?.id ?? ''), type: begaran.patientId?.type ?? PNR_OID } };
}
const ROLL = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', fysioterapeut: 'Fysioterapeut' };
function huvudFor(sj, p, patientId, kalla = 'sourceSystemHSAId') {
  const e = sj.ENHETER[p.enhet];
  return {
    documentId: p.id, [kalla]: sj.VARDGIVARE.hsaId, documentTitle: p.rubrik, documentTime: datumRiv(p.tid), patientId,
    accountableHealthcareProfessional: {
      authorTime: datumRiv(p.tid), healthcareProfessionalName: p.av, healthcareProfessionalRoleCode: { displayName: ROLL[p.roll] },
      healthcareProfessionalOrgUnit: { orgUnitHSAId: e.hsaId, orgUnitName: e.namn }, healthcareProfessionalCareUnitHSAId: e.hsaId, healthcareProfessionalCareGiverHSAId: sj.VARDGIVARE.hsaId,
    },
    approvedForPatient: false, nullified: false,
  };
}
const okResultat = () => ({ resultCode: 'OK', logId: randomUUID() });

tjanst.registrera(K.GetCareDocumentation, ({ db }, { begaran }) => {
  const { sj, lista, patientId } = poster(db, begaran);
  return {
    careDocumentation: lista.filter(p => p.typ === 'anteckning').map(p => ({
      careDocumentationHeader: huvudFor(sj, p, patientId, 'sourceSystemHSAid'),
      careDocumentationBody: { clinicalDocumentNote: { clinicalDocumentNoteTitle: p.rubrik, clinicalDocumentNoteText: p.text } },
    })),
    result: okResultat(),
  };
});
tjanst.registrera(K.GetDiagnosis, ({ db }, { begaran }) => {
  const { sj, lista, patientId } = poster(db, begaran);
  return {
    diagnosis: lista.filter(p => p.typ === 'diagnos').map(p => {
      const kod = /\(([A-Z]\d{2}(?:\.\d+)?)\)/.exec(p.rubrik)?.[1] ?? null;
      return {
        diagnosisHeader: huvudFor(sj, p, patientId),
        diagnosisBody: { typeOfDiagnosis: /huvuddiagnos/i.test(p.text) ? 'Huvuddiagnos' : 'Bidiagnos', diagnosisTime: datumRiv(p.tid),
          diagnosisCode: { code: kod, codeSystem: '1.2.752.116.1.1.1', displayName: p.rubrik.replace(/\s*\([^)]*\)\s*$/, '') } },
      };
    }),
    result: okResultat(),
  };
});
tjanst.registrera(K.GetCareContacts, ({ db }, { begaran }) => {
  const { sj, lista, patientId } = poster(db, begaran);
  return {
    careContact: lista.filter(p => p.typ === 'vardkontakt').map(p => {
      const e = sj.ENHETER[p.enhet];
      return {
        careContactHeader: { documentId: p.id, sourceSystemHSAId: sj.VARDGIVARE.hsaId, patientId,
          accountableHealthcareProfessional: { authorTime: datumRiv(p.tid), healthcareProfessionalHSAId: `${e.hsaId}-P`, healthcareProfessionalName: p.av,
            healthcareProfessionalRoleCode: { displayName: ROLL[p.roll] }, healthcareProfessionalOrgUnit: { orgUnitHSAId: e.hsaId, orgUnitName: e.namn },
            healthcareProfessionalCareUnitHSAId: e.hsaId, healthcareProfessionalCareGiverHSAId: sj.VARDGIVARE.hsaId },
          approvedForPatient: false },
        careContactBody: { careContactCode: /telefon/i.test(p.rubrik) ? 2 : 1, careContactReason: p.text, careContactOrgUnit: { orgUnitHSAId: e.hsaId, orgUnitName: e.namn },
          careContactTimePeriod: { start: datumRiv(p.tid) }, careContactStatus: 5 },
      };
    }),
  };
});
tjanst.registrera(K.GetMedicationHistory, ({ db }, { begaran }) => {
  const { sj, lista, patientId } = poster(db, begaran);
  return {
    medicationMedicalRecord: lista.filter(p => p.typ === 'lakemedel').map(p => {
      const h = huvudFor(sj, p, patientId);
      return {
        medicationMedicalRecordHeader: h,
        medicationMedicalRecordBody: { medicationPrescription: {
          prescriptionId: { root: sj.VARDGIVARE.hsaId, extension: p.id }, typeOfPrescription: 'I', prescriptionStatus: 'Active', prescriptionNote: p.text,
          prescriber: h.accountableHealthcareProfessional, startOfTreatment: datumRiv(p.tid), selfMedication: false,
          drug: { unstructuredDrugInformation: { unstructuredInformation: p.rubrik } },
        } },
      };
    }),
    result: okResultat(),
  };
});

// ---------------------------------------------------------------------------------------------------------------
// Spärrtjänsten.
const blockUt = (db, b) => ({
  BlockId: b.block_id, BlockType: b.typ, PatientId: pnrAv(db, b.patient_id), InformationStartDate: tid(b.start), InformationEndDate: tid(b.slut),
  InformationCareUnitId: b.vardenhet_hsa, InformationCareProviderId: b.vardgivare_hsa,
  TemporaryRevokes: db.query('SELECT * FROM rivta_sim_havningar WHERE block_id = ? AND avslutad IS NULL').all(b.block_id)
    .map(h => ({ TemporaryRevokeId: h.havning_id, EndDate: tid(h.slut), RevokedForCareUnitId: h.vardenhet_hsa, RevokedForEmployeeId: h.personal_hsa })),
});
const blockHuvud = (db, rader) => ({ Result: resultat(), Blocks: rader.map(b => blockUt(db, b)), NextCreatedOnOrAfter: tid(new Date().toISOString()), LatestCancellation: tid(new Date().toISOString()) });

tjanst.registrera(K.GetAllBlocksForPatient, ({ db }, { begaran }) => {
  sakra(db);
  const pid = patientAv(db, begaran.PatientId);
  const vg = begaran.CareProviderIds ?? [];
  const rader = pid ? db.query('SELECT * FROM rivta_sim_sparrar WHERE patient_id = ? ORDER BY block_id').all(pid).filter(b => !vg.length || vg.includes(b.vardgivare_hsa)) : [];
  return { BlockHeaderType: blockHuvud(db, rader) };
});
tjanst.registrera(K.GetBlocksForPatient, ({ db }, { begaran }) => {
  sakra(db);
  const pid = patientAv(db, begaran.PatientId);
  const rader = pid ? db.query('SELECT * FROM rivta_sim_sparrar WHERE patient_id = ? AND vardgivare_hsa = ? ORDER BY block_id').all(pid, begaran.CareProviderId) : [];
  return { BlockHeaderType: blockHuvud(db, rader) };
});
// En uppgift är spärrad för den som läser när en spärr täcker uppgiftens vårdgivare, vårdenhet och tid, och ingen
// tillfällig hävning gäller för den läsandes vårdenhet. En inre spärr gäller inom vårdgivaren, en yttre mot andra.
tjanst.registrera(K.CheckBlocks, ({ db }, { begaran }) => {
  sakra(db);
  const pid = patientAv(db, begaran.PatientId);
  const sparrar = pid ? db.query('SELECT * FROM rivta_sim_sparrar WHERE patient_id = ?').all(pid) : [];
  const nu = new Date().toISOString();
  const aktor = begaran.AccessingActor;
  const tacker = (b, e) => (b.typ === 'Outer' ? e.InformationCareProviderId === b.vardgivare_hsa && aktor.CareProviderId !== b.vardgivare_hsa
    : e.InformationCareProviderId === b.vardgivare_hsa && aktor.CareProviderId === b.vardgivare_hsa && aktor.CareUnitId !== b.vardenhet_hsa)
    && (!b.vardenhet_hsa || b.vardenhet_hsa === e.InformationCareUnitId)
    && (!b.start || e.InformationEndDate >= tid(b.start)) && (!b.slut || e.InformationStartDate <= tid(b.slut));
  const havd = (b) => db.query('SELECT 1 FROM rivta_sim_havningar WHERE block_id = ? AND vardenhet_hsa = ? AND avslutad IS NULL AND slut > ? AND (personal_hsa IS NULL OR personal_hsa = ?)')
    .get(b.block_id, aktor.CareUnitId, nu, aktor.EmployeeId);
  return { CheckBlocksResultType: { Result: resultat(), CheckResults: (begaran.InformationEntities ?? []).map(e => ({
    Status: sparrar.some(b => tacker(b, e) && !havd(b)) ? 'BLOCKED' : 'OK', RowNumber: e.RowNumber })) } };
});
tjanst.registrera(K.RegisterTemporaryExtendedRevoke, ({ db }, { begaran }) => {
  sakra(db);
  const b = db.query('SELECT * FROM rivta_sim_sparrar WHERE block_id = ?').get(begaran.BlockId);
  if (!b) return { ResultType: resultat('NOTFOUND', 'Spärren finns inte.') };
  db.query('INSERT INTO rivta_sim_havningar (havning_id, block_id, patient_id, vardenhet_hsa, personal_hsa, slut) VALUES (?, ?, ?, ?, ?, ?)')
    .run(begaran.TemporaryRevokeId, b.block_id, b.patient_id, begaran.RevokedForCareUnitId, begaran.RevokedForEmployeeId ?? null, `${begaran.EndDate}${begaran.EndDate.endsWith('Z') ? '' : 'Z'}`);
  return { ResultType: resultat() };
});
tjanst.registrera(K.CancelTemporaryExtendedRevoke, ({ db }, { begaran }) => {
  sakra(db);
  const n = db.query('UPDATE rivta_sim_havningar SET avslutad = ? WHERE havning_id = ? AND avslutad IS NULL').run(new Date().toISOString(), begaran.TemporaryRevokeId).changes;
  return { ResultType: n ? resultat() : resultat('NOTFOUND', 'Den tillfälliga hävningen finns inte.') };
});

// ---------------------------------------------------------------------------------------------------------------
// Samtyckestjänsten.
tjanst.registrera(K.CheckConsent, ({ db }, { begaran }) => {
  sakra(db);
  const pid = patientAv(db, begaran.PatientId);
  const a = begaran.AccessingActor;
  const nu = tid(new Date().toISOString());
  const s = pid ? db.query('SELECT * FROM rivta_sim_samtycken WHERE patient_id = ? AND vardgivare_hsa = ? AND vardenhet_hsa = ? AND aterkallat IS NULL ORDER BY registrerat DESC').all(pid, a.CareProviderId, a.CareUnitId)
    .find(x => (!x.start || x.start <= nu) && (!x.slut || x.slut >= nu) && (!x.personal_hsa || x.personal_hsa === a.EmployeeId)) : null;
  return { CheckResultType: { Result: resultat(), HasConsent: Boolean(s), AssertionType: s?.typ ?? null } };
});
tjanst.registrera(K.RegisterExtendedConsent, ({ db }, { begaran }) => {
  sakra(db);
  const pid = patientAv(db, begaran.PatientId);
  if (!pid) return { ResultType: resultat('NOTFOUND', 'Patienten finns inte i den simulerade tjänsten.') };
  if (db.query('SELECT 1 FROM rivta_sim_samtycken WHERE intyg_id = ?').get(begaran.AssertionId)) return { ResultType: resultat('ALREADYEXISTS', 'Samtycket finns redan.') };
  db.query('INSERT INTO rivta_sim_samtycken (intyg_id, patient_id, typ, vardgivare_hsa, vardenhet_hsa, personal_hsa, start, slut, registrerat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(begaran.AssertionId, pid, begaran.AssertionType, begaran.CareProviderId, begaran.CareUnitId, begaran.EmployeeId ?? null, begaran.StartDate ?? null, begaran.EndDate ?? null, new Date().toISOString());
  return { ResultType: resultat() };
});
tjanst.registrera(K.CancelExtendedConsent, ({ db }, { begaran }) => {
  sakra(db);
  const n = db.query('UPDATE rivta_sim_samtycken SET aterkallat = ? WHERE intyg_id = ? AND aterkallat IS NULL').run(new Date().toISOString(), begaran.AssertionId).changes;
  return { ResultType: n ? resultat() : resultat('NOTFOUND', 'Samtycket finns inte.') };
});
// ---------------------------------------------------------------------------------------------------------------
// Hjälpare för konsumenterna i Vårdkällan.
export const sakraSimulering = sakra;
export const slutPaDagen = (nu = new Date()) => `${nu.toISOString().slice(0, 10)}T23:59:59`;
export const nyttId = () => randomUUID();
export { slutet };
