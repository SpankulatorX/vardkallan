// Runda 14, r3: Vårdkällan som producent av vaccinationer för NPÖ, Journalen och sammanhållen journalföring
// (Sussa 2.2.1.11), med GetVaccinationHistory 2.0 i riv.clinicalprocess.activityprescription.actoutcome 2.2.2 (bilaga
// K10, där kärnsystemet är producent). Vaccinationerna läses genom FHIR-API:t som Immunization med den anropande
// organisationens systemkonto, som journalens producenter i rivta/journal.js, så att behörighetsmotorn prövar varje
// uppgift: bara kontots vårdenheter, aldrig skyddade personuppgifter, aldrig spärrade uppgifter och aldrig det som
// systemförvaltningen har undantagit. Varje läsning loggas på patienten med kontraktet och organisationen.
//
// Systemet är experten: vaccinationerna lämnas ut av sig själva när en nationell tjänst frågar, med vaccin, dos, datum,
// batch, program och vårdenhet ur registreringen. Ingen behöver göra något för att de ska synas i NPÖ eller Journalen.
import { randomBytes } from 'node:crypto';
import { vardkallan } from './rivta/tjanst.js';
import { vardgivare } from './rivta/konsumenter.js';
import { fhirResurser } from './tjanstekontrakt.js';
import { hittaPaToken, gallandeId } from './identitet.js';
import { loggaRad } from './logg.js';
import { Fel } from './db.js';
import { vardenhetFor } from './atkomst.js';
import * as r3 from './rivta-r3.js';

export const DOMAN = 'riv.clinicalprocess.activityprescription.actoutcome';
export const DEF = () => r3.def(DOMAN, 'GetVaccinationHistory', '2.0');
const OID = { personnummer: '1.2.752.129.2.1.3.1', samordningsnummer: '1.2.752.129.2.1.3.3', atc: '1.2.752.129.2.2.3.1.1' };
const logId = () => randomBytes(8).toString('hex');
const datumRiv = (iso) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(/-/g, '') : null);
const tidRiv = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(/[- :]/g, '').slice(0, 14) : null);

function enhetFor(db, id) {
  const r = /^\d+$/.test(String(id)) ? db.query('SELECT enhet_id FROM vaccinationer WHERE id = ?').get(Number(id)) : null;
  const ve = r ? vardenhetFor(db, r.enhet_id) : null;
  return ve ? db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(ve) : null;
}

// En Immunization som en post i kontraktet.
export function post(db, r, patientId) {
  const e = enhetFor(db, r.id);
  const vg = vardgivare(db);
  const tid = tidRiv(r.occurrenceDateTime);
  const atc = r.vaccineCode?.coding?.find(c => c.system?.includes('atc')) ?? r.vaccineCode?.coding?.[0];
  return {
    vaccinationMedicalRecordHeader: {
      documentId: `Immunization/${r.id}`, sourceSystemHSAId: vg, documentTime: tid, patientId,
      accountableHealthcareProfessional: { authorTime: tidRiv(r.recorded ?? r.occurrenceDateTime), healthcareProfessionalName: r.performer?.[0]?.actor?.display ?? null,
        healthcareProfessionalOrgUnit: e ? { orgUnitHSAId: e.hsa_id, orgUnitName: e.namn } : null, healthcareProfessionalCareUnitHSAId: e?.hsa_id ?? null, healthcareProfessionalCareGiverHSAId: vg },
      approvedForPatient: false, careContactId: r.encounter?.reference?.split('/')[1] ?? null, nullified: false,
    },
    vaccinationMedicalRecordBody: {
      registrationRecord: {
        careGiverOrg: e ? { orgUnitHSAId: e.hsa_id, orgUnitName: e.namn } : {},
        sourceSystemName: 'Vårdkällan', sourceSystemContact: {}, date: datumRiv(r.occurrenceDateTime),
      },
      administrationRecord: [{
        vaccinationProgramName: r.protocolApplied?.[0]?.series ? { originalText: r.protocolApplied[0].series } : null,
        performerOrg: e ? { orgUnitHSAId: e.hsa_id, orgUnitName: e.namn } : null,
        doseOrdinalNumber: r.protocolApplied?.[0]?.doseNumberPositiveInt ?? null,
        sourceDescription: r.primarySource === false ? (r.reportOrigin?.text ?? 'Given någon annanstans') : null,
        // Vaccinet: ATC-koden och namnet ur registreringen. NPL-id finns inte i demons katalog.
        vaccineName: { code: atc?.code ?? null, codeSystem: atc ? OID.atc : null, codeSystemName: atc ? 'ATC' : null, displayName: atc?.display ?? r.vaccineCode?.text ?? null, originalText: r.vaccineCode?.text ?? null },
        vaccineBatchId: r.lotNumber ?? null,
      }],
    },
  };
}

// Producenten. En patient som inte finns och en patient som organisationen inte får se ger samma svar: inga poster.
export function hantera(ctx, { begaran, konsument, def }) {
  const { db } = ctx;
  const id = String(begaran.patientId?.id ?? '').replace(/\D/g, '');
  const typ = begaran.patientId?.type;
  if (!/^\d{12}$/.test(id) || ![OID.personnummer, OID.samordningsnummer].includes(typ)) {
    return { result: { resultCode: 'ERROR', errorCode: 'INVALID_REQUEST', logId: logId(), message: 'patientId ska vara ett personnummer eller samordningsnummer med tolv siffror och rätt OID.' } };
  }
  const kalla = begaran.sourceSystemHSAid ?? null;
  if (kalla && kalla !== vardgivare(db)) return { result: { resultCode: 'OK', logId: logId() } };
  const funnen = hittaPaToken(db, id);
  const pid = funnen ? gallandeId(db, funnen) : null;
  const personal = konsument.personal;
  const extra = `&_konsument=${encodeURIComponent(konsument.hsaId)}`;
  let resurser = [];
  if (!pid) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'las_oversikt', resurs: `rivta/${def.namn}/${def.version}?_konsument=${konsument.hsaId}`, grund: 'nekad', resultat: 'nekad' });
  } else {
    try { resurser = fhirResurser({ db, personal }, def.namn, pid, { typer: ['Immunization'], extra }); } catch (e) { if (!(e instanceof Fel && e.status === 403)) throw e; }
  }
  const enheter = new Set(begaran.careUnitHSAid ?? []);
  const kontakter = new Set(begaran.careContactId ?? []);
  const start = begaran.timePeriod?.start ?? null;
  const slut = begaran.timePeriod?.end ?? null;
  const poster = resurser.map(r => post(db, r, { id, type: typ })).filter(p => {
    const h = p.vaccinationMedicalRecordHeader;
    const d = p.vaccinationMedicalRecordBody.registrationRecord.date;
    if (enheter.size && !enheter.has(h.accountableHealthcareProfessional.healthcareProfessionalCareUnitHSAId)) return false;
    if (kontakter.size && !kontakter.has(h.careContactId)) return false;
    if (start && d < start) return false;
    if (slut && d > slut) return false;
    return true;
  });
  return { vaccinationMedicalRecord: poster.length ? poster : null, result: { resultCode: 'OK', logId: logId() } };
}
vardkallan.registrera(DEF(), hantera);
