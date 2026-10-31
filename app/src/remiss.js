// Remissflödet: skickad, mottagen (kvittens), bedömd (accepterad eller avvisad), besvarad, svar kvitterat.
// Larm när mottagningskvittens, svar eller kvittens av svaret uteblir (D1).
import { Fel, iso, idag, giltigtDatum } from './db.js';
import { vardenhetFor, kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import { kallaEtikett } from './journal.js';

export const PRIORITETER = ['akut', 'skyndsam', 'normal'];
export const LARMGRANS = { mottagningskvittensTimmar: 2, svarKvittensDagar: 3 };

const enhet = (db, id) => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id });
const person = (db, id) => (id ? { id, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id } : null);

// Larm för en remiss vid en viss tidpunkt.
export function larmFor(r, nu = new Date()) {
  const larm = [];
  const t = nu.getTime();
  const dag = nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  if (r.status === 'skickad' && t - Date.parse(r.skickad_tid) > LARMGRANS.mottagningskvittensTimmar * 3600_000) {
    larm.push({ typ: 'saknar_mottagningskvittens', text: 'Mottagningskvittens saknas mer än 2 timmar efter att remissen skickades.', sedan: r.skickad_tid });
  }
  const vantarSvar = ['skickad', 'mottagen'].includes(r.status) || (r.status === 'bedomd' && r.beslut === 'accepterad');
  if (vantarSvar && dag > r.svar_senast) {
    larm.push({ typ: 'svar_forsenat', text: `Svar saknas efter sista svarsdatum ${r.svar_senast}.`, sedan: r.svar_senast });
  }
  if (r.status === 'besvarad' && t - Date.parse(r.besvarad_tid) > LARMGRANS.svarKvittensDagar * 86400_000) {
    larm.push({ typ: 'svar_ej_kvitterat', text: 'Remissvaret har inte kvitterats av avsändaren efter 3 dagar.', sedan: r.besvarad_tid });
  }
  return larm;
}

export function remissUt(db, r, { klinisk = true, patient = null } = {}) {
  const ut = {
    id: r.id, patientId: r.patient_id, fran: enhet(db, r.fran_enhet_id), till: enhet(db, r.till_enhet_id), avsandare: person(db, r.avsandare_id),
    prioritet: r.prioritet, svarSenast: r.svar_senast, status: r.status, beslut: r.beslut,
    tider: { skickad: r.skickad_tid, mottagen: r.mottagen_tid, bedomd: r.bedomd_tid, besvarad: r.besvarad_tid, svarKvitterat: r.svar_kvitterat_tid },
    av: { mottagen: person(db, r.mottagen_av), bedomd: person(db, r.bedomd_av), besvarad: person(db, r.besvarad_av), svarKvitterat: person(db, r.svar_kvitterat_av) },
    larm: larmFor(r), kalla: r.kalla, kallaEtikett: kallaEtikett(r.kalla, r.skickad_tid),
    fragestallning: null, anamnes: null, motivering: null, svar: null,
  };
  if (klinisk) Object.assign(ut, { fragestallning: r.fragestallning, anamnes: r.anamnes, motivering: r.motivering, svar: r.svar });
  if (patient) ut.patient = { id: patient.id, namn: visningsnamn(patient), personnummer: visningsPnr(patient), skyddad: Boolean(patient.skyddad) };
  return ut;
}

export function hamtaRad(db, id) {
  const r = db.query('SELECT * FROM remisser WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Remissen finns inte.', 'saknas');
  return r;
}

// Remisser för en patient. Remisser till eller från min vårdenhet syns alltid, andra enligt inre sekretess.
export function forPatient(atk) {
  const klinisk = kanRoll(atk.personal, 'las_remiss');
  atk.krav(klinisk ? 'las_remiss' : 'las_remiss_status');
  const db = atk.db;
  const min = vardenhetFor(db, atk.personal.enhet_id);
  const rader = db.query('SELECT * FROM remisser WHERE patient_id = ? ORDER BY skickad_tid DESC').all(atk.patientId);
  const egna = rader.filter(r => r.fran_enhet_id === min || r.till_enhet_id === min);
  const andra = atk.filtrera(rader.filter(r => !egna.includes(r)).map(r => ({ ...r, enhet_id: r.fran_enhet_id })), klinisk ? 'las_remiss' : 'las_remiss_status');
  return { remisser: [...egna, ...andra].sort((a, b) => b.skickad_tid.localeCompare(a.skickad_tid)).map(r => remissUt(db, r, { klinisk })), dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr } };
}

export function skapa(atk, inp) {
  atk.krav('remittera');
  const db = atk.db;
  const falt = [];
  const till = typeof inp?.tillEnhetId === 'string' ? db.query("SELECT * FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(inp.tillEnhetId) : null;
  const min = vardenhetFor(db, atk.personal.enhet_id);
  if (!till || till.id === min) falt.push('tillEnhetId');
  const fragestallning = typeof inp?.fragestallning === 'string' ? inp.fragestallning.trim() : '';
  if (fragestallning.length < 3 || fragestallning.length > 2000) falt.push('fragestallning');
  const anamnes = typeof inp?.anamnes === 'string' ? inp.anamnes.trim().slice(0, 8000) : '';
  const prioritet = inp?.prioritet ?? 'normal';
  if (!PRIORITETER.includes(prioritet)) falt.push('prioritet');
  if (!giltigtDatum(inp?.svarSenast) || inp.svarSenast < idag()) falt.push('svarSenast');
  if (falt.length) throw new Fel(400, 'Kontrollera mottagare, frågeställning, prioritet och sista svarsdatum.', 'ogiltig', { falt });
  const r = db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?)`).run(atk.patientId, min, till.id, atk.personal.id, fragestallning, anamnes, prioritet, inp.svarSenast, iso());
  return remissUt(db, hamtaRad(db, r.lastInsertRowid));
}

function kravMottagare(atk, r) {
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== r.till_enhet_id) throw new Fel(403, 'Remissen är inte ställd till din vårdenhet.', 'nekad');
}
function kravAvsandare(atk, r) {
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== r.fran_enhet_id) throw new Fel(403, 'Bara den remitterande vårdenheten kan kvittera svaret.', 'nekad');
}
const fel = (text) => new Fel(400, text, 'ogiltig');

export function mottag(atk, r) {
  kravMottagare(atk, r);
  atk.krav('mottag_remiss');
  if (r.status !== 'skickad') throw fel('Remissen är redan mottagen.');
  atk.db.query("UPDATE remisser SET status = 'mottagen', mottagen_tid = ?, mottagen_av = ? WHERE id = ?").run(iso(), atk.personal.id, r.id);
  return remissUt(atk.db, hamtaRad(atk.db, r.id), { klinisk: kanRoll(atk.personal, 'las_remiss') });
}

export function bedom(atk, r, { beslut, motivering }) {
  kravMottagare(atk, r);
  atk.krav('bedom_remiss');
  if (r.status !== 'mottagen') throw fel(r.status === 'skickad' ? 'Remissen måste kvitteras som mottagen innan den bedöms.' : 'Remissen är redan bedömd.');
  if (!['accepterad', 'avvisad'].includes(beslut)) throw new Fel(400, 'Beslutet måste vara accepterad eller avvisad.', 'ogiltig', { falt: ['beslut'] });
  const m = typeof motivering === 'string' ? motivering.trim() : '';
  if (beslut === 'avvisad' && m.length < 3) throw new Fel(400, 'En avvisad remiss måste ha en motivering.', 'ogiltig', { falt: ['motivering'] });
  atk.db.query("UPDATE remisser SET status = 'bedomd', bedomd_tid = ?, bedomd_av = ?, beslut = ?, motivering = ? WHERE id = ?").run(iso(), atk.personal.id, beslut, m || null, r.id);
  return remissUt(atk.db, hamtaRad(atk.db, r.id));
}

export function svara(atk, r, { svar }) {
  kravMottagare(atk, r);
  atk.krav('svara_remiss');
  if (r.status !== 'bedomd' || r.beslut !== 'accepterad') throw fel('Bara en accepterad remiss kan besvaras.');
  const s = typeof svar === 'string' ? svar.trim() : '';
  if (s.length < 3 || s.length > 8000) throw new Fel(400, 'Skriv ett svar.', 'ogiltig', { falt: ['svar'] });
  atk.db.query("UPDATE remisser SET status = 'besvarad', besvarad_tid = ?, besvarad_av = ?, svar = ? WHERE id = ?").run(iso(), atk.personal.id, s, r.id);
  return remissUt(atk.db, hamtaRad(atk.db, r.id));
}

export function kvitteraSvar(atk, r) {
  kravAvsandare(atk, r);
  atk.krav('kvittera_svar');
  if (r.status !== 'besvarad') throw fel('Det finns inget obesvarat remissvar att kvittera.');
  atk.db.query("UPDATE remisser SET status = 'svar_kvitterat', svar_kvitterat_tid = ?, svar_kvitterat_av = ? WHERE id = ?").run(iso(), atk.personal.id, r.id);
  return remissUt(atk.db, hamtaRad(atk.db, r.id));
}

// Remisslistor för min vårdenhet. Vårdadministratören ser status men inte klinisk text.
export function lista(db, personal, riktning = 'inkommande') {
  const min = vardenhetFor(db, personal.enhet_id);
  const kol = riktning === 'utgaende' ? 'fran_enhet_id' : 'till_enhet_id';
  const klinisk = kanRoll(personal, 'las_remiss');
  return db.query(`SELECT * FROM remisser WHERE ${kol} = ? ORDER BY skickad_tid DESC`).all(min).map(r => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    return remissUt(db, r, { klinisk, patient: p });
  });
}

// Larm för min vårdenhet. Avsändaren ser alla tre larmen, mottagaren saknad kvittens och försenat svar.
export function larmForEnhet(db, personal, nu = new Date()) {
  const min = vardenhetFor(db, personal.enhet_id);
  const ut = [];
  for (const r of db.query('SELECT * FROM remisser WHERE (fran_enhet_id = ? OR till_enhet_id = ?) AND status <> ?').all(min, min, 'svar_kvitterat')) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    for (const l of larmFor(r, nu)) {
      if (l.typ === 'svar_ej_kvitterat' && r.fran_enhet_id !== min) continue;
      ut.push({ ...l, remissId: r.id, patientId: r.patient_id, patient: visningsnamn(p), riktning: r.fran_enhet_id === min ? 'utgaende' : 'inkommande' });
    }
  }
  return ut;
}

export function okvitteradeSvar(db, personal) {
  const min = vardenhetFor(db, personal.enhet_id);
  return db.query("SELECT * FROM remisser WHERE fran_enhet_id = ? AND status = 'besvarad' ORDER BY besvarad_tid").all(min).map(r => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    return remissUt(db, r, { klinisk: kanRoll(personal, 'las_remiss'), patient: p });
  });
}
