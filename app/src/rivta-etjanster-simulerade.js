// Runda 14, r3: simulerade motparter för formulärtjänsten, 1177:s inkorg och NKRR. De tar emot Vårdkällans anrop genom
// samma kontrakt, kuvert och validering som en riktig tjänst (src/rivta/), men är påhittade och märkta som simulerade.
// En patient i demon har ett konto i 1177 när hen är invånare i Min journal (demoregel).
import { randomUUID } from 'node:crypto';
import { iso } from './db.js';
import * as r3 from './rivta-r3.js';
import * as et from './rivta-etjanster.js';

const { DEF, ADRESS, MALLAR } = et;
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_etjanst_formular (form_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, mall TEXT NOT NULL, status TEXT NOT NULL, tid TEXT NOT NULL);
`;
export const sakra = (db) => db.exec(SCHEMA);

const patientPa = (db, nr) => db.query('SELECT id FROM patienter WHERE personnummer = ?').get(nr);
const enhetPa = (db, hsa) => db.query("SELECT id, namn FROM enheter WHERE hsa_id = ? AND typ = 'vardenhet'").get(hsa);

export const formular = r3.simuleradTjanst('Formulärtjänst (simulerad)', [ADRESS.formular]);
formular.registrera(DEF.skapaFormular(), (ctx, { begaran }) => {
  const ut = [];
  for (const f of begaran.formRequests) {
    const p = f.subjectOfCare ? patientPa(ctx.db, f.subjectOfCare) : null;
    const e = enhetPa(ctx.db, f.healthcare_facility_CareUnit);
    if (!p || !e || !MALLAR.some(m => m.id === f.templateId)) return { comment: 'Patienten, vårdenheten eller mallen är okänd.', resultCode: 'ERROR' };
    const formId = randomUUID();
    ctx.db.query("INSERT INTO sim_etjanst_formular (form_id, patient_id, enhet_id, mall, status, tid) VALUES (?, ?, ?, ?, 'ONGOING', ?)").run(formId, p.id, e.id, f.templateId, iso());
    ut.push({ formId, healthcare_facility_CareUnit: f.healthcare_facility_CareUnit });
  }
  return { formRequestResponses: ut, resultCode: 'OK' };
});
formular.registrera(DEF.hamtaFormular(), (ctx, { begaran }) => {
  const r = ctx.db.query('SELECT * FROM sim_etjanst_formular WHERE form_id = ?').get(begaran.formId);
  if (!r) return {};
  const mall = MALLAR.find(m => m.id === r.mall);
  const e = ctx.db.query('SELECT hsa_id, namn FROM enheter WHERE id = ?').get(r.enhet_id);
  return { form: {
    createdDateTime: r.tid, formId: r.form_id, formStatus: r.status,
    formTemplate: { anonymousForm: false, category: 'Inför besök', formName: mall.namn, language: 'sv', maxNumberOfQuestions: 10, minNumberOfQuestions: 1, maxNumberOfPages: 1, minNumberOfPages: 1, mandatory: false, publishStatus: 'PUBLISHED', templateVersion: 1, templateId: mall.id, term: 'Demo' },
    healthcare_facility_CareUnit: e.hsa_id, healthcare_facility_CareUnitName: e.namn,
  } };
});
formular.registrera(DEF.avbrytFormular(), (ctx, { begaran }) => {
  const n = ctx.db.query("UPDATE sim_etjanst_formular SET status = 'CANCELLED' WHERE form_id = ? AND status != 'COMPLETED'").run(begaran.formId).changes;
  return n ? { resultCode: 'OK' } : { comment: 'Formuläret finns inte eller är redan ifyllt.', resultCode: 'ERROR' };
});
// Demo: patienten fyller i formuläret i e-tjänsten.
export const fyllI = (db, formId) => db.query("UPDATE sim_etjanst_formular SET status = 'COMPLETED' WHERE form_id = ?").run(formId).changes > 0;

export const portal = r3.simuleradTjanst('1177 Vårdguidens e-tjänster (simulerad)', [ADRESS.portal]);
const harKonto = (db, nr) => {
  const p = patientPa(db, nr);
  if (!p) return false;
  return Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'invanare'").get() && db.query('SELECT 1 FROM invanare WHERE patient_id = ?').get(p.id));
};
portal.registrera(DEF.arAktiv(), (ctx, { begaran }) => ({ isActive: harKonto(ctx.db, begaran.subjectOfCareId), activeNotificationMethods: harKonto(ctx.db, begaran.subjectOfCareId) ? ['Email'] : null, resultCode: 'OK' }));
portal.registrera(DEF.meddelande(), (ctx, { begaran }) => (harKonto(ctx.db, begaran.subjectOfCareId) ? { threadId: randomUUID(), resultCode: 'OK' } : { resultCode: 'ERROR', resultText: 'Personen har inget konto.' }));

export const nkrr = r3.simuleradTjanst('NKRR och kvalitetsregister (simulerade)', [ADRESS.nkrr]);
nkrr.registrera(DEF.registrering(), (ctx, { begaran }) => ({ referenceId: `SIM-NKRR-${randomUUID().slice(0, 8)}`, result: { resultCode: begaran.patientId?.length ? 'OK' : 'ERROR' } }));

et.sattTransport(ADRESS.formular, (db) => r3.tillMotpart(db, formular));
et.sattTransport(ADRESS.portal, (db) => r3.tillMotpart(db, portal));
et.sattTransport(ADRESS.nkrr, (db) => r3.tillMotpart(db, nkrr));
