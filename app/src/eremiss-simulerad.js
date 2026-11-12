// Runda 14, r3: simulerade vårdgivare utanför Vårdkällan med e-remiss (Sussa 2.2.1.12 och 3.3.1.2). De tar emot
// Vårdkällans remisser med ProcessRequest, bekräftar dem med ProcessRequestConfirmation och svarar med
// ProcessRequestOutcome, och de kan skicka en remiss till en vårdenhet i Vårdkällan. Allt går genom samma kontrakt,
// kuvert och validering som till en riktig mottagare (src/rivta/). De är påhittade, märkta som simulerade, och inget
// lämnar demon.
import { randomUUID } from 'node:crypto';
import { Fel, iso, datumAv } from './db.js';
import { vardenhetFor, prova } from './atkomst.js';
import * as r3 from './rivta-r3.js';
import * as eremiss from './eremiss.js';

const { DEF, tidRiv, personId } = eremiss;
export const NAMN = 'Extern vårdgivare med e-remiss (simulerad)';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_eremiss (
  request_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, riktning TEXT NOT NULL, sim_hsa TEXT NOT NULL,
  vk_hsa TEXT NOT NULL, personnummer TEXT NOT NULL, status TEXT NOT NULL, tid TEXT NOT NULL
);
`;
export const sakra = (db) => db.exec(SCHEMA);
const ok = (t = null) => ({ result: { resultCode: 'OK', message: t } });
const fel = (t) => ({ result: { resultCode: 'ERROR', errorCode: 'APPLICATION_ERROR', message: t } });
const organisation = (hsa) => eremiss.mottagareRader().find(m => m.hsaId === hsa);
const hsaAttr = (x) => ({ '@extension': x });

// De simulerade vårdgivarnas tjänst: de logiska adresserna är deras HSA-id.
export const tjanst = r3.simuleradTjanst(NAMN, () => eremiss.mottagareRader().map(m => m.hsaId));

// Vårdkällans remiss kommer in till den simulerade mottagaren, som bekräftar den efter svaret.
tjanst.registrera(DEF.remiss(), (ctx, { begaran: m, logiskAdress }) => {
  const { db } = ctx;
  const q = m.request;
  const requestId = q.requestId['@extension'];
  const rad = db.query('SELECT patient_id, enhet_id FROM eremisser WHERE request_id = ?').get(requestId);
  if (!rad || q.recipient.organisation.careUnitId['@extension'] !== logiskAdress) return fel('Remissen är okänd.');
  db.query("INSERT OR IGNORE INTO sim_eremiss (request_id, patient_id, enhet_id, riktning, sim_hsa, vk_hsa, personnummer, status, tid) VALUES (?, ?, ?, 'till_sim', ?, ?, ?, 'mottagen', ?)")
    .run(requestId, rad.patient_id, rad.enhet_id, logiskAdress, q.requestOrganisation.careUnitId['@extension'], q.patient.personId['@extension'], iso());
  r3.ko(db, () => besked(db, requestId, 'BEK'));
  return ok();
});
// Vårdkällans besked och svar på en remiss som den simulerade vårdgivaren har skickat.
const fran = (db, requestId) => db.query("SELECT * FROM sim_eremiss WHERE request_id = ? AND riktning = 'fran_sim'").get(requestId);
tjanst.registrera(DEF.besked(), (ctx, { begaran: m }) => {
  const r = fran(ctx.db, m.requestConfirmation.requestId['@extension']);
  if (!r) return fel('Remissen är okänd.');
  ctx.db.query('UPDATE sim_eremiss SET status = ? WHERE request_id = ?').run(m.requestConfirmation.typeOfRequestConfirmation['@code'] === 'BEK' ? 'mottagen' : 'avvisad', r.request_id);
  return ok();
});
tjanst.registrera(DEF.svar(), (ctx, { begaran: m }) => {
  const r = fran(ctx.db, m.requestOutcome.requestId['@extension']);
  if (!r) return fel('Remissen är okänd.');
  ctx.db.query("UPDATE sim_eremiss SET status = 'besvarad' WHERE request_id = ?").run(r.request_id);
  return ok();
});

const gemensamt = (r, org) => ({
  patient: { personId: { '@extension': r.personnummer, '@root': personId({ personnummer: r.personnummer }).root } },
  author: { healthcareProfessional: { name: 'Mottagande läkare (demo)' }, healthcareProfessionalOrganisation: { careUnitId: hsaAttr(r.sim_hsa) } },
  recipient: { organisation: { careUnitId: hsaAttr(r.vk_hsa) } },
  org: { careUnitId: hsaAttr(r.sim_hsa), careUnitName: org?.namn ?? r.sim_hsa },
});
async function skickaTillVk(db, r, d, begaran) {
  try { return await r3.anropa(db, d, { logiskAdress: r.vk_hsa, begaran, transport: r3.tillVardkallan(db, r.sim_hsa) }); } catch (x) {
    if (x instanceof r3.RivtaFel) return { fel: x.message };
    throw x;
  }
}

export async function besked(db, requestId, kod = 'BEK', textB = null) {
  const r = db.query('SELECT * FROM sim_eremiss WHERE request_id = ?').get(requestId);
  if (!r) return null;
  const org = organisation(r.sim_hsa);
  const g = gemensamt(r, org);
  return skickaTillVk(db, r, DEF.besked(), { requestConfirmation: {
    requestId: { '@extension': requestId }, requestConfirmationId: { '@extension': `${r.sim_hsa}#${randomUUID()}` }, typeOfRequestConfirmation: { '@code': kod },
    requestVersionNumber: '1', requestConfirmationTime: { '@value': tidRiv() }, patient: g.patient, confirmingOrganisation: g.org, author: g.author, recipient: g.recipient,
    outcome: { outcomeText: textB ?? (kod === 'BEK' ? `Remissen är mottagen av ${org?.namn ?? 'mottagaren'} (simulerat).` : 'Besked från mottagaren (simulerat).') },
  } });
}

export async function svaraPaRemiss(db, requestId, svarText = 'Patienten är bedömd på mottagningen. Ingen ytterligare åtgärd behövs hos oss. Fortsatt uppföljning hos remittenten. (Simulerat svar i demon.)') {
  const r = db.query('SELECT * FROM sim_eremiss WHERE request_id = ?').get(requestId);
  if (!r) return null;
  const g = gemensamt(r, organisation(r.sim_hsa));
  db.query("UPDATE sim_eremiss SET status = 'besvarad' WHERE request_id = ?").run(requestId);
  return skickaTillVk(db, r, DEF.svar(), { requestOutcome: {
    requestId: { '@extension': requestId }, requestOutcomeId: { '@extension': `${r.sim_hsa}#${randomUUID()}` }, typeOfRequestOutcome: { '@code': 'SSV' },
    requestVersionNumber: '1', requestOutcomeTime: { '@value': tidRiv() }, patient: g.patient, respondingOrganisation: g.org, author: g.author, recipient: g.recipient,
    outcome: { outcomeText: svarText },
  } });
}

// Demo: den externa mottagaren svarar på en remiss som läkaren har skickat. Bara den remitterande vårdenheten kan be om
// det, och svaret går genom samma kontrakt och kontroller som ett riktigt svar.
export async function svaraSimulerat(db, personal, remissId) {
  const rad = /^\d{1,9}$/.test(String(remissId)) ? db.query("SELECT * FROM eremisser WHERE remiss_id = ? AND riktning = 'ut'").get(Number(remissId)) : null;
  if (!rad || vardenhetFor(db, personal.enhet_id) !== rad.enhet_id) throw new Fel(404, 'E-remissen finns inte.', 'saknas');
  const r = await svaraPaRemiss(db, rad.request_id);
  if (!r || r.fel || r.result?.resultCode !== 'OK') throw new Fel(409, r?.fel ?? r?.result?.message ?? 'Svaret togs inte emot.', 'konflikt');
  return { text: `${rad.motpart_namn} har svarat (simulerat).` };
}

// Demo: den externa vårdgivaren skickar en remiss till den inloggades vårdenhet för en patient som vårdenheten redan har
// vårdrelation till, så att demon aldrig kan användas för att ge sig själv åtkomst till en ny patient.
export async function skickaInkommande(db, personal, patientId, fragestallning = 'Bedömning och ställningstagande till fortsatt utredning. (Påhittad remiss i demon.)') {
  const p = typeof patientId === 'string' ? db.query('SELECT * FROM patienter WHERE id = ?').get(patientId) : null;
  const pr = p ? prova(db, { personal, patient: p.id, handling: 'las_remiss' }) : null;
  if (!p || !pr.tillaten || pr.grund === 'nodatkomst') throw new Fel(403, 'Demon skickar bara en extern remiss för en patient som din vårdenhet redan har vårdrelation till.', 'nekad');
  const pid = personId(p);
  if (!pid) throw new Fel(400, 'Patienten har inget personnummer eller samordningsnummer.', 'ogiltig');
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, personal.enhet_id));
  const avs = eremiss.mottagareRader()[0];
  const requestId = `${avs.hsaId}#${randomUUID()}`;
  db.query("INSERT INTO sim_eremiss (request_id, patient_id, enhet_id, riktning, sim_hsa, vk_hsa, personnummer, status, tid) VALUES (?, ?, ?, 'fran_sim', ?, ?, ?, 'skickad', ?)")
    .run(requestId, p.id, enhet.id, avs.hsaId, enhet.hsa_id, pid.extension, iso());
  const begaran = eremiss.remissBegaran({ requestId, patient: p, pid, avsandare: { hsa_id: `${avs.hsaId}-L1`, namn: 'Remitterande läkare (demo)' }, enhet: { hsa_id: avs.hsaId, namn: avs.namn },
    mottagareHsa: enhet.hsa_id, fragestallning, anamnes: 'Påhittad anamnes från den externa vårdgivaren.', datum: datumAv().replace(/-/g, ''), tid: tidRiv() });
  const r = await skickaTillVk(db, { vk_hsa: enhet.hsa_id, sim_hsa: avs.hsaId }, DEF.remiss(), begaran);
  if (r.fel || r.result?.resultCode !== 'OK') throw new Fel(409, r.fel ?? r.result?.message ?? 'Remissen togs inte emot.', 'konflikt');
  const id = db.query('SELECT remiss_id FROM eremisser WHERE request_id = ?').get(requestId).remiss_id;
  return { remissId: id, text: `${avs.namn} har skickat en e-remiss till ${enhet.namn} (simulerat). Den väntar på att någon tar emot den.` };
}

// Kopplingen: Vårdkällan når de simulerade vårdgivarna i samma process, och de är anslutna till Vårdkällans producenter.
eremiss.sattTransport((db) => r3.tillMotpart(db, tjanst));
for (const m of eremiss.mottagareRader()) eremiss.anslut(m.hsaId, `${m.namn} (simulerad)`);
