// Runda 14, r3: en simulerad vårdgivare utanför Vårdkällan med e-remiss (Sussa 2.2.1.12 och 3.3.1.2). Den tar emot
// Vårdkällans remisser med ProcessRequest, bekräftar dem med ProcessRequestConfirmation och svarar med
// ProcessRequestOutcome, och den kan skicka en remiss till en vårdenhet i Vårdkällan. Allt går som XML genom samma
// kontrakt som till en riktig mottagare. Den är påhittad, märkt som simulerad, och inget lämnar demon.
import { randomUUID } from 'node:crypto';
import { Fel, iso, datumAv } from './db.js';
import { vardenhetFor, prova } from './atkomst.js';
import { e, xml, tolka, text, hitta } from './rivta-r3-xml.js';
import * as transport from './rivta-r3-transport.js';
import * as eremiss from './eremiss.js';

const { NS, KONTRAKT, tidRiv, personId } = eremiss;
export const NAMN = 'Extern vårdgivare (simulerad)';
const arSim = (hsa) => eremiss.mottagareRader().some(m => m.hsaId === hsa);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_eremiss (
  request_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, riktning TEXT NOT NULL, sim_hsa TEXT NOT NULL,
  vk_hsa TEXT NOT NULL, personnummer TEXT NOT NULL, status TEXT NOT NULL, tid TEXT NOT NULL
);
`;
export const sakra = (db) => db.exec(SCHEMA);
const resultat = (rot, ns, namn, kod, t = null) => xml(e(`${rot}:${namn}`, [e(`${rot}:result`, [e('core:resultCode', kod), e('core:message', t)])]), { [rot]: ns, core: NS.core });

// Vårdkällans remiss kommer in till den simulerade mottagaren.
function taEmotRemiss(db, kroppXml, { logiskAdress }) {
  const svar = (kod, t) => resultat('pr', NS.pr, 'ProcessRequestResponse', kod, t);
  let m;
  try { m = tolka(kroppXml); } catch { return svar('ERROR', 'Meddelandet gick inte att tolka.'); }
  const q = hitta(m, 'request');
  const requestId = hitta(q, 'requestId')?.a.extension;
  const fran = hitta(q, 'requestOrganisation/careUnitId')?.a.extension;
  const pnr = hitta(q, 'patient/personId')?.a.extension;
  if (!requestId || hitta(q, 'recipient/organisation/careUnitId')?.a.extension !== logiskAdress || !/^\d{12}$/.test(pnr ?? '')) return svar('ERROR', 'Remissen saknar uppgifter.');
  const rad = db.query("SELECT patient_id, enhet_id FROM eremisser WHERE request_id = ?").get(requestId);
  if (!rad) return svar('ERROR', 'Remissen är okänd.');
  db.query("INSERT OR IGNORE INTO sim_eremiss (request_id, patient_id, enhet_id, riktning, sim_hsa, vk_hsa, personnummer, status, tid) VALUES (?, ?, ?, 'till_sim', ?, ?, ?, 'mottagen', ?)")
    .run(requestId, rad.patient_id, rad.enhet_id, logiskAdress, fran, pnr, iso());
  // Mottagningsbekräftelsen skickas efter svaret, som från en riktig mottagare.
  transport.ko(db, () => besked(db, requestId, 'BEK'));
  return svar('OK');
}

function organisation(db, hsa) { return eremiss.mottagareRader().find(m => m.hsaId === hsa); }
function patientEl(r) { return e('core:patient', [e('core:personId', null, { extension: r.personnummer, root: personId({ personnummer: r.personnummer }).root })]); }

export function besked(db, requestId, kod = 'BEK', textB = null) {
  const r = db.query('SELECT * FROM sim_eremiss WHERE request_id = ?').get(requestId);
  if (!r) return null;
  const org = organisation(db, r.sim_hsa);
  const kropp = e('bek:ProcessRequestConfirmation', [e('core:requestConfirmation', [
    e('core:requestId', null, { extension: requestId }), e('core:requestConfirmationId', null, { extension: `${r.sim_hsa}#${randomUUID()}` }),
    e('core:typeOfRequestConfirmation', null, { code: kod }), e('core:requestVersionNumber', '1'), e('core:requestConfirmationTime', null, { value: tidRiv() }),
    patientEl(r),
    e('core:confirmingOrganisation', [e('core:careUnitId', null, { extension: r.sim_hsa }), e('core:careUnitName', org?.namn ?? r.sim_hsa)]),
    e('core:author', [e('core:healthcareProfessional', [e('core:name', 'Mottagande läkare (demo)')]), e('core:healthcareProfessionalOrganisation', [e('core:careUnitId', null, { extension: r.sim_hsa })])]),
    e('core:recipient', [e('core:organisation', [e('core:careUnitId', null, { extension: r.vk_hsa })])]),
    e('core:outcome', [e('core:outcomeText', textB ?? (kod === 'BEK' ? `Remissen är mottagen av ${org?.namn ?? 'mottagaren'} (simulerat).` : 'Besked från mottagaren (simulerat).'))]),
  ])]);
  return transport.anropa(db, { kontrakt: KONTRAKT.besked, logiskAdress: r.vk_hsa, kropp, ns: { bek: NS.bek, core: NS.core }, patientId: r.patient_id, enhetId: r.enhet_id });
}

export function svaraPaRemiss(db, requestId, svarText = 'Patienten är bedömd på mottagningen. Ingen ytterligare åtgärd behövs hos oss. Fortsatt uppföljning hos remittenten. (Simulerat svar i demon.)') {
  const r = db.query('SELECT * FROM sim_eremiss WHERE request_id = ?').get(requestId);
  if (!r) return null;
  const org = organisation(db, r.sim_hsa);
  const kropp = e('svar:ProcessRequestOutcome', [e('core:requestOutcome', [
    e('core:requestId', null, { extension: requestId }), e('core:requestOutcomeId', null, { extension: `${r.sim_hsa}#${randomUUID()}` }),
    e('core:typeOfRequestOutcome', null, { code: 'SSV' }), e('core:requestVersionNumber', '1'), e('core:requestOutcomeTime', null, { value: tidRiv() }),
    patientEl(r),
    e('core:respondingOrganisation', [e('core:careUnitId', null, { extension: r.sim_hsa }), e('core:careUnitName', org?.namn ?? r.sim_hsa)]),
    e('core:author', [e('core:healthcareProfessional', [e('core:name', 'Mottagande läkare (demo)')]), e('core:healthcareProfessionalOrganisation', [e('core:careUnitId', null, { extension: r.sim_hsa })])]),
    e('core:recipient', [e('core:organisation', [e('core:careUnitId', null, { extension: r.vk_hsa })])]),
    e('core:outcome', [e('core:outcomeText', svarText)]),
  ])]);
  db.query("UPDATE sim_eremiss SET status = 'besvarad' WHERE request_id = ?").run(requestId);
  return transport.anropa(db, { kontrakt: KONTRAKT.svar, logiskAdress: r.vk_hsa, kropp, ns: { svar: NS.svar, core: NS.core }, patientId: r.patient_id, enhetId: r.enhet_id });
}

// Demo: den externa mottagaren svarar på en remiss som läkaren har skickat. Bara den remitterande vårdenheten kan be om
// det, och svaret går genom samma kontrakt och kontroller som ett riktigt svar.
export function svaraSimulerat(db, personal, remissId) {
  const rad = /^\d{1,9}$/.test(String(remissId)) ? db.query("SELECT * FROM eremisser WHERE remiss_id = ? AND riktning = 'ut'").get(Number(remissId)) : null;
  if (!rad || vardenhetFor(db, personal.enhet_id) !== rad.enhet_id) throw new Fel(404, 'E-remissen finns inte.', 'saknas');
  const r = svaraPaRemiss(db, rad.request_id);
  if (!r?.svar || text(r.svar, 'result/resultCode') !== 'OK') throw new Fel(409, r?.svar ? text(r.svar, 'result/message') ?? 'Svaret togs inte emot.' : 'Svaret togs inte emot.', 'konflikt');
  return { text: `${rad.motpart_namn} har svarat (simulerat).` };
}

// Demo: den externa vårdgivaren skickar en remiss till den inloggades vårdenhet för en patient som vårdenheten redan har
// vårdrelation till, så att demon aldrig kan användas för att ge sig själv åtkomst till en ny patient.
export function skickaInkommande(db, personal, patientId, fragestallning = 'Bedömning och ställningstagande till fortsatt utredning. (Påhittad remiss i demon.)') {
  const p = typeof patientId === 'string' ? db.query('SELECT * FROM patienter WHERE id = ?').get(patientId) : null;
  const pr = p ? prova(db, { personal, patient: p.id, handling: 'las_remiss' }) : null;
  if (!p || !pr.tillaten || pr.grund === 'nodatkomst') throw new Fel(403, 'Demon skickar bara en extern remiss för en patient som din vårdenhet redan har vårdrelation till.', 'nekad');
  const pid = personId(p);
  if (!pid) throw new Fel(400, 'Patienten har inget personnummer eller samordningsnummer.', 'ogiltig');
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, personal.enhet_id));
  const fran = eremiss.mottagareRader()[0];
  const requestId = `${fran.hsaId}#${randomUUID()}`;
  db.query("INSERT INTO sim_eremiss (request_id, patient_id, enhet_id, riktning, sim_hsa, vk_hsa, personnummer, status, tid) VALUES (?, ?, ?, 'fran_sim', ?, ?, ?, 'skickad', ?)")
    .run(requestId, p.id, enhet.id, fran.hsaId, enhet.hsa_id, pid.extension, iso());
  const kropp = eremiss.remissKropp({ requestId, patient: p, pid, avsandare: { hsa_id: `${fran.hsaId}-L1`, namn: 'Remitterande läkare (demo)' }, enhet: { hsa_id: fran.hsaId, namn: fran.namn },
    mottagareHsa: enhet.hsa_id, fragestallning, anamnes: 'Påhittad anamnes från den externa vårdgivaren.', datum: datumAv().replace(/-/g, ''), tid: tidRiv() });
  const r = transport.anropa(db, { kontrakt: KONTRAKT.remiss, logiskAdress: enhet.hsa_id, kropp, ns: { pr: NS.pr, core: NS.core }, patientId: p.id, enhetId: enhet.id });
  if (!r.svar || text(r.svar, 'result/resultCode') !== 'OK') throw new Fel(409, r.svar ? text(r.svar, 'result/message') ?? 'Remissen togs inte emot.' : r.fel, 'konflikt');
  const id = db.query('SELECT remiss_id FROM eremisser WHERE request_id = ?').get(requestId).remiss_id;
  return { remissId: id, text: `${fran.namn} har skickat en e-remiss till ${enhet.namn} (simulerat). Den väntar på att någon tar emot den.` };
}

// Vårdkällans besked och svar på en remiss från den simulerade vårdgivaren tas emot och kvitteras.
function taEmotFranVk(rot, ns, namn, nyStatus) {
  return (db, kroppXml) => {
    let m;
    try { m = tolka(kroppXml); } catch { return resultat(rot, ns, namn, 'ERROR', 'Meddelandet gick inte att tolka.'); }
    const requestId = hitta(m.b[0], 'requestId')?.a.extension;
    const r = requestId ? db.query("SELECT * FROM sim_eremiss WHERE request_id = ? AND riktning = 'fran_sim'").get(requestId) : null;
    if (!r) return resultat(rot, ns, namn, 'ERROR', 'Remissen är okänd.');
    db.query('UPDATE sim_eremiss SET status = ? WHERE request_id = ?').run(typeof nyStatus === 'function' ? nyStatus(m) : nyStatus, requestId);
    return resultat(rot, ns, namn, 'OK');
  };
}
const beskedTillSim = taEmotFranVk('bek', NS.bek, 'ProcessRequestConfirmationResponse', (m) => (hitta(m.b[0], 'typeOfRequestConfirmation')?.a.code === 'BEK' ? 'mottagen' : 'avvisad'));
const svarTillSim = taEmotFranVk('svar', NS.svar, 'ProcessRequestOutcomeResponse', 'besvarad');

// Kontrakten går till den simulerade vårdgivaren när den logiska adressen är dess HSA-id, och annars till Vårdkällan.
transport.registrera(KONTRAKT.remiss, 'E-remiss', (db, x, o) => (arSim(o.logiskAdress) ? taEmotRemiss(db, x, o) : eremiss.taEmotRemiss(db, x, o)));
transport.registrera(KONTRAKT.besked, 'E-remiss', (db, x, o) => (arSim(o.logiskAdress) ? beskedTillSim(db, x, o) : eremiss.taEmotBesked(db, x, o)));
transport.registrera(KONTRAKT.svar, 'E-remiss', (db, x, o) => (arSim(o.logiskAdress) ? svarTillSim(db, x, o) : eremiss.taEmotSvar(db, x, o)));
