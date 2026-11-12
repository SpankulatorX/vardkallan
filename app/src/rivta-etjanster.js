// Runda 14, r3: formulärtjänsten (Sussa 2.2.1.5), 1177 Vårdguidens e-tjänster (2.2.1.6) och NKRR (2.2.1.14) med
// tjänstekontrakten i bilaga K10, på den gemensamma grunden för RIVTA. Vårdkällan är konsument i alla tre:
//   riv.infrastructure.eservicesupply.forminteraction 2.1.1  CreateFormRequest, GetForm och CancelForm: vårdenheten ber
//                                                             patienten fylla i ett formulär inför besöket, hämtar svaren
//                                                             och avbryter en förfrågan som inte behövs.
//   riv-application.infrastructure.eservicesupply.patientportal 2.0  IsActiveUser och AddMessage: ett meddelande till
//                                                             patientens inkorg i 1177, bara när patienten har ett konto.
//   riv.followup.qualityregistry.nkrr 1.2.2                   ProcessRegistrationNotification: vårdenheten meddelar
//                                                             ett kvalitetsregister att en registrering kan göras, och
//                                                             registret hämtar uppgifterna genom NKRR.
// Systemet är experten: vårdenheten, vårdgivaren, patientens identitet, giltighetstiden och mallen fylls i av systemet,
// och ett meddelande till 1177 skickas bara när patienten kan läsa det. Motparterna är simulerade
// (rivta-etjanster-simulerade.js) och märkta som simulerade.
import { randomUUID } from 'node:crypto';
import { Fel, iso, datumAv, addDagar } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import * as r3 from './rivta-r3.js';
import { vardgivare } from './rivta/konsumenter.js';

const FORM = 'riv.infrastructure.eservicesupply.forminteraction';
const PORTAL = 'riv-application.infrastructure.eservicesupply.patientportal';
const NKRR = 'riv.followup.qualityregistry.nkrr';
export const DEF = {
  skapaFormular: () => r3.def(FORM, 'CreateFormRequest', '2.0'),
  hamtaFormular: () => r3.def(FORM, 'GetForm', '2.1'),
  avbrytFormular: () => r3.def(FORM, 'CancelForm', '2.0'),
  arAktiv: () => r3.def(PORTAL, 'IsActiveUser', '2.0'),
  meddelande: () => r3.def(PORTAL, 'AddMessage', '2.0'),
  registrering: () => r3.def(NKRR, 'ProcessRegistrationNotification', '1.0'),
};
// De simulerade tjänsternas logiska adresser. Påhittade och märkta som demo.
export const ADRESS = { formular: 'SE0000000000-SIMFORMULAR', portal: 'SE0000000000-SIM1177', nkrr: 'SE0000000000-SIMNKRR' };
export const MALLAR = [
  { id: 'halsodeklaration', namn: 'Hälsodeklaration inför besöket', dagar: 14 },
  { id: 'symtomskattning', namn: 'Skattning av symtom inför återbesöket', dagar: 7 },
];
// Registret är samma som i rapporteringen till kvalitetsregistret (myndighetsrapport.js), så att patientens invändning
// gäller båda vägarna.
export const REGISTER = [{ id: 'hjartsvikt', namn: 'Demoregister för hjärtsvikt (simulerat)' }];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS etjanst_formular (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, mall TEXT NOT NULL, form_id TEXT, status TEXT NOT NULL,
  skickad_av TEXT NOT NULL, skickad TEXT NOT NULL, giltig_till TEXT NOT NULL, andrad TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS etjanst_meddelanden (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, rubrik TEXT NOT NULL, kanal TEXT NOT NULL, trad_id TEXT,
  skickad_av TEXT NOT NULL, tid TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS etjanst_registreringar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, register TEXT NOT NULL, referens TEXT, resultat TEXT NOT NULL,
  skickad_av TEXT NOT NULL, tid TEXT NOT NULL
);
`;
export const sakra = (db) => db.exec(SCHEMA);

const ve = (db, enhetId) => db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, enhetId));
const pnr = (p) => {
  const nr = String(p.personnummer ?? '').replace(/\D/g, '');
  return /^\d{12}$/.test(nr) && !/^vk/i.test(String(p.personnummer)) ? nr : null;
};
const kravPnr = (p, vad) => {
  const nr = pnr(p);
  if (!nr) throw new Fel(400, `Patienten har inget personnummer eller samordningsnummer, så ${vad} kan inte användas. Registrera patientens identitet först.`, 'ogiltig');
  return nr;
};
async function anropa(db, d, logiskAdress, begaran) {
  try { return { svar: await r3.anropa(db, d, { logiskAdress, begaran, transport: transporter[logiskAdress]?.(db) ?? (() => { throw new Error('Ingen motpart är ansluten.'); }) }) }; } catch (x) {
    if (x instanceof r3.RivtaFel) return { fel: x.message };
    throw x;
  }
}
// Transporterna till motparterna. I demon sätts de av rivta-etjanster-simulerade.js.
const transporter = {};
export const sattTransport = (adress, fn) => { transporter[adress] = fn; };

// ---------------------------------------------------------------------------------------------------------------
// Formulär inför besöket.
// ---------------------------------------------------------------------------------------------------------------
export function formularFor(atk, p) {
  atk.krav('las_admin');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM etjanst_formular WHERE patient_id = ? ORDER BY skickad DESC').all(p.id), 'las_admin');
  return { formular: rader.map(r => ({ id: r.id, mall: MALLAR.find(m => m.id === r.mall)?.namn ?? r.mall, status: r.status, skickad: r.skickad, giltigTill: r.giltig_till })), mallar: MALLAR.map(m => ({ id: m.id, namn: m.namn })) };
}

export async function skickaFormular(atk, p, body = {}, nu = new Date()) {
  atk.krav('las_admin');
  const mall = MALLAR.find(m => m.id === body.mall);
  if (!mall) throw new Fel(400, 'Välj ett av formulären.', 'ogiltig', { falt: ['mall'] });
  const nr = kravPnr(p, 'formulärtjänsten');
  const db = atk.db;
  const enhet = ve(db, atk.personal.enhet_id);
  const giltig = addDagar(datumAv(nu), mall.dagar);
  const id = Number(db.query("INSERT INTO etjanst_formular (patient_id, enhet_id, mall, status, skickad_av, skickad, giltig_till, andrad) VALUES (?, ?, ?, 'skickas', ?, ?, ?, ?)")
    .run(p.id, enhet.id, mall.id, atk.personal.id, iso(nu), giltig, iso(nu)).lastInsertRowid);
  const r = await anropa(db, DEF.skapaFormular(), ADRESS.formular, { formRequests: [{
    expireDate: giltig, healthcare_CareGiver: vardgivare(db), healthcare_facility_CareUnit: enhet.hsa_id, keepUntil: addDagar(giltig, 30), subjectOfCare: nr, templateId: mall.id,
  }] });
  const formId = r.svar?.formRequestResponses?.[0]?.formId ?? null;
  atk.logga('las_admin', atk.grund(), `formular:${id}`);
  if (!formId || r.svar.resultCode !== 'OK') {
    db.query("UPDATE etjanst_formular SET status = 'fel', andrad = ? WHERE id = ?").run(iso(), id);
    throw new Fel(502, `Formulärtjänsten tog inte emot förfrågan. ${r.fel ?? r.svar?.comment ?? ''}`.trim(), 'motpart');
  }
  db.query("UPDATE etjanst_formular SET status = 'skickat', form_id = ?, andrad = ? WHERE id = ?").run(formId, iso(), id);
  return { id, formId, text: `${mall.namn} är skickad till patienten och gäller till ${giltig}.` };
}

const STATUS = { COMPLETED: 'ifyllt', PENDING_COMPLETION: 'paborjat', ONGOING: 'skickat' };
export async function hamtaFormular(atk, id) {
  const rad = atk.db.query('SELECT * FROM etjanst_formular WHERE id = ? AND patient_id = ?').get(Number(id), atk.patientId);
  if (!rad || !atk.filtrera([rad], 'las_admin').length || !rad.form_id) throw new Fel(404, 'Formuläret finns inte.', 'saknas');
  const r = await anropa(atk.db, DEF.hamtaFormular(), ADRESS.formular, { formId: rad.form_id });
  if (r.fel) return { status: rad.status, text: 'Formulärtjänsten svarade inte. Statusen är den senast kända.' };
  const status = STATUS[r.svar.form?.formStatus] ?? rad.status;
  atk.db.query('UPDATE etjanst_formular SET status = ?, andrad = ? WHERE id = ?').run(status, iso(), rad.id);
  atk.logga('las_admin', atk.grund(), `formular:${rad.id}`);
  return { status, text: status === 'ifyllt' ? 'Patienten har fyllt i formuläret.' : 'Patienten har inte fyllt i formuläret än.' };
}

export async function avbrytFormular(atk, id) {
  const rad = atk.db.query('SELECT * FROM etjanst_formular WHERE id = ? AND patient_id = ?').get(Number(id), atk.patientId);
  if (!rad || !atk.filtrera([rad], 'las_admin').length || !rad.form_id) throw new Fel(404, 'Formuläret finns inte.', 'saknas');
  if (rad.status === 'ifyllt' || rad.status === 'avbrutet') throw new Fel(409, 'Ett ifyllt eller avbrutet formulär kan inte avbrytas.', 'konflikt');
  const r = await anropa(atk.db, DEF.avbrytFormular(), ADRESS.formular, { formId: rad.form_id, subjectOfCare: pnr(atk.db.query('SELECT * FROM patienter WHERE id = ?').get(rad.patient_id)) });
  if (r.fel || r.svar.resultCode !== 'OK') throw new Fel(502, `Formulärtjänsten tog inte emot avbrottet. ${r.fel ?? r.svar.comment ?? ''}`.trim(), 'motpart');
  atk.db.query("UPDATE etjanst_formular SET status = 'avbrutet', andrad = ? WHERE id = ?").run(iso(), rad.id);
  atk.logga('las_admin', atk.grund(), `formular:${rad.id}`);
  return { status: 'avbrutet', text: 'Förfrågan är avbruten. Patienten ser den inte längre.' };
}

// ---------------------------------------------------------------------------------------------------------------
// Meddelande till patientens inkorg i 1177. Systemet frågar först om patienten har ett konto, och utan konto skickas
// inget, så att vårdenheten väljer brev i stället. Texten i inkorgen innehåller ingen journaltext.
// ---------------------------------------------------------------------------------------------------------------
export async function meddela1177(atk, p, body = {}) {
  atk.krav('las_admin');
  const rubrik = typeof body.rubrik === 'string' ? body.rubrik.trim().slice(0, 100) : '';
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (rubrik.length < 3 || text.length < 3) throw new Fel(400, 'Skriv en rubrik och ett meddelande.', 'ogiltig', { falt: ['rubrik', 'text'] });
  const nr = kravPnr(p, '1177');
  const db = atk.db;
  const enhet = ve(db, atk.personal.enhet_id);
  const aktiv = await anropa(db, DEF.arAktiv(), ADRESS.portal, { subjectOfCareId: nr });
  atk.logga('las_admin', atk.grund(), 'etjanst:1177');
  if (aktiv.fel) throw new Fel(502, `1177 svarade inte. ${aktiv.fel}`, 'motpart');
  if (!aktiv.svar.isActive) return { skickat: false, kanal: 'brev', text: 'Patienten har inget konto i 1177. Skicka meddelandet som brev i stället.' };
  const r = await anropa(db, DEF.meddelande(), ADRESS.portal, {
    subjectOfCareId: nr, threadTitle: rubrik,
    message: { title: rubrik, text, organisationUnit: { unitId: { root: '1.2.752.129.2.1.4.1', extension: enhet.hsa_id }, unitName: enhet.namn } },
    notify: true, approve: false, accountableOrganisation: { root: '1.2.752.129.2.1.4.1', extension: vardgivare(db) },
  });
  if (r.fel || r.svar.resultCode !== 'OK') throw new Fel(502, `1177 tog inte emot meddelandet. ${r.fel ?? r.svar.resultText ?? ''}`.trim(), 'motpart');
  db.query("INSERT INTO etjanst_meddelanden (patient_id, enhet_id, rubrik, kanal, trad_id, skickad_av, tid) VALUES (?, ?, ?, '1177', ?, ?, ?)").run(p.id, enhet.id, rubrik, r.svar.threadId ?? null, atk.personal.id, iso());
  return { skickat: true, kanal: '1177', text: 'Meddelandet ligger i patientens inkorg i 1177, och patienten får en avisering.' };
}

// ---------------------------------------------------------------------------------------------------------------
// NKRR: vårdenheten meddelar kvalitetsregistret att uppgifterna för en registrering finns.
// ---------------------------------------------------------------------------------------------------------------
export async function anmalRegistrering(atk, p, body = {}) {
  atk.krav('kvalitetsregister');
  const reg = REGISTER.find(r => r.id === body.register);
  if (!reg) throw new Fel(400, 'Välj ett register.', 'ogiltig', { falt: ['register'] });
  // Samma prövning som alla utgående registreringar: invändning mot registrering och skyddade personuppgifter.
  const pr = r3.provaUtlamning(atk.db, p, { slag: 'kvalitetsregister', register: reg.id });
  if (!pr.tillaten) { atk.logga('kvalitetsregister', atk.grund(), `nkrr:${reg.id}:ej_skickad`); throw new Fel(400, pr.skal, 'ogiltig'); }
  const nr = kravPnr(p, 'kvalitetsregistret');
  const db = atk.db;
  const enhet = ve(db, atk.personal.enhet_id);
  const ref = randomUUID();
  const r = await anropa(db, DEF.registrering(), ADRESS.nkrr, {
    type: reg.id, patientId: [{ root: nr }], healthcareProviderId: { root: vardgivare(db) }, registerUnitId: enhet.hsa_id,
    reference: [{ key: 'vardkallan', value: ref }],
  });
  const resultat = r.svar?.result?.resultCode ?? 'ERROR';
  db.query('INSERT INTO etjanst_registreringar (patient_id, enhet_id, register, referens, resultat, skickad_av, tid) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, enhet.id, reg.id, r.svar?.referenceId ?? null, resultat, atk.personal.id, iso());
  atk.logga('kvalitetsregister', atk.grund(), `nkrr:${reg.id}`);
  if (resultat !== 'OK') throw new Fel(502, `Kvalitetsregistret tog inte emot meddelandet. ${r.fel ?? ''}`.trim(), 'motpart');
  return { referens: r.svar.referenceId ?? null, text: `${reg.namn} har fått meddelandet och hämtar uppgifterna genom NKRR.` };
}

export const harRoll = (personal) => kanRoll(personal, 'las_admin');
