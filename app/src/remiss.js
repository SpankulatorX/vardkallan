// Remissflödet: skickad, mottagen (kvittens), bedömd (accepterad eller avvisad), besvarad, svar kvitterat.
// Larm när mottagningskvittens, svar eller kvittens av svaret uteblir (D1).
import { Fel, iso, idag, giltigtDatum } from './db.js';
import { vardenhetFor, kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import { kallaEtikett } from './journal.js';
// Runda 6, r4: bilagor, vidarebefordran och egen vårdbegäran (remiss-r4.js).
import { remissTillagg, EGEN } from './remiss-r4.js';
import * as konfiguration from './konfiguration.js';
import { arStangd } from './omorganisation.js';
// Runda 8, r2: remiss på uppdrag, fördelning, remisskonferens och extern pappersremiss (remiss-r8.js).
import * as r8 from './remiss-r8.js';
// Runda 10, r6: konsultation, urval och kvittens av beslut på uppdrag (remiss-r10.js).
import * as r10 from './remiss-r10.js';

export const PRIORITETER = ['akut', 'skyndsam', 'normal'];
export const LARMGRANS = { mottagningskvittensTimmar: 2, svarKvittensDagar: 3 };
// Runda 7, r4: gränserna kan ändras av systemförvaltningen (konfiguration.js). LARMGRANS är standardvärdena.
export const larmgranser = (db, nu = new Date()) => ({
  mottagningskvittensTimmar: konfiguration.varde(db, 'remiss.mottagningskvittens_timmar', nu),
  svarKvittensDagar: konfiguration.varde(db, 'remiss.svarskvittens_dagar', nu),
});

const enhet = (db, id) => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id });
const person = (db, id) => (id ? { id, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id } : null);

// Larm för en remiss vid en viss tidpunkt.
export function larmFor(r, nu = new Date(), granser = LARMGRANS) {
  const larm = [];
  const t = nu.getTime();
  const dag = nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  if (r.status === 'skickad' && t - Date.parse(r.skickad_tid) > granser.mottagningskvittensTimmar * 3600_000) {
    larm.push({ typ: 'saknar_mottagningskvittens', text: `Mottagningskvittens saknas mer än ${granser.mottagningskvittensTimmar} ${granser.mottagningskvittensTimmar === 1 ? 'timme' : 'timmar'} efter att remissen skickades.`, sedan: r.skickad_tid });
  }
  const vantarSvar = ['skickad', 'mottagen'].includes(r.status) || (r.status === 'bedomd' && r.beslut === 'accepterad');
  if (vantarSvar && dag > r.svar_senast) {
    larm.push({ typ: 'svar_forsenat', text: `Svar saknas efter sista svarsdatum ${r.svar_senast}.`, sedan: r.svar_senast });
  }
  if (r.status === 'besvarad' && t - Date.parse(r.besvarad_tid) > granser.svarKvittensDagar * 86400_000) {
    larm.push({ typ: 'svar_ej_kvitterat', text: `Remissvaret har inte kvitterats av avsändaren efter ${granser.svarKvittensDagar} ${granser.svarKvittensDagar === 1 ? 'dag' : 'dagar'}.`, sedan: r.besvarad_tid });
  }
  return larm;
}

export function remissUt(db, r, { klinisk = true, patient = null } = {}) {
  const ut = {
    id: r.id, patientId: r.patient_id, fran: enhet(db, r.fran_enhet_id), till: enhet(db, r.till_enhet_id), avsandare: person(db, r.avsandare_id),
    prioritet: r.prioritet, svarSenast: r.svar_senast, status: r.status, beslut: r.beslut,
    tider: { skickad: r.skickad_tid, mottagen: r.mottagen_tid, bedomd: r.bedomd_tid, besvarad: r.besvarad_tid, svarKvitterat: r.svar_kvitterat_tid },
    av: { mottagen: person(db, r.mottagen_av), bedomd: person(db, r.bedomd_av), besvarad: person(db, r.besvarad_av), svarKvitterat: person(db, r.svar_kvitterat_av) },
    larm: larmFor(r, new Date(), larmgranser(db)), kalla: r.kalla, kallaEtikett: kallaEtikett(r.kalla, r.skickad_tid),
    fragestallning: null, anamnes: null, motivering: null, svar: null,
  };
  if (klinisk) Object.assign(ut, { fragestallning: r.fragestallning, anamnes: r.anamnes, motivering: r.motivering, svar: r.svar });
  if (patient) ut.patient = { id: patient.id, namn: visningsnamn(patient), personnummer: visningsPnr(patient), skyddad: Boolean(patient.skyddad) };
  // Runda 6, r4: bilagorna (för den som läser kliniska uppgifter, annars bara antalet), vidarebefordran och egen vårdbegäran.
  Object.assign(ut, remissTillagg(db, r, klinisk));
  // Runda 8, r2: på uppdrag, fördelning, remisskonferens, beslut på uppdrag och extern avsändare.
  Object.assign(ut, r8.remissTillagg(db, r, klinisk));
  // Runda 10, r6: remiss eller konsultation, vårdansvaret och läkarens kvittens av ett beslut på uppdrag.
  r10.utoka(db, r, klinisk, ut);
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
  // Runda 7, r4: en vårdenhet som har stängts vid en omorganisation tar inte emot remisser. Systemet säger vem som tar över.
  if (till && arStangd(db, till.id)) {
    const eft = db.query('SELECT e.namn FROM enhet_efterfoljare f JOIN enheter e ON e.id = f.ny_id WHERE f.gammal_id = ?').all(till.id).map(e => e.namn);
    throw new Fel(400, `${till.namn} är stängd sedan en omorganisation.${eft.length ? ` Verksamheten finns nu på ${eft.join(' och ')}.` : ''}`, 'ogiltig', { falt: ['tillEnhetId'] });
  }
  const fragestallning = typeof inp?.fragestallning === 'string' ? inp.fragestallning.trim() : '';
  if (fragestallning.length < 3 || fragestallning.length > 2000) falt.push('fragestallning');
  const anamnes = typeof inp?.anamnes === 'string' ? inp.anamnes.trim().slice(0, 8000) : '';
  const prioritet = inp?.prioritet ?? 'normal';
  if (!PRIORITETER.includes(prioritet)) falt.push('prioritet');
  if (!giltigtDatum(inp?.svarSenast) || inp.svarSenast < idag()) falt.push('svarSenast');
  if (falt.length) throw new Fel(400, 'Kontrollera mottagare, frågeställning, prioritet och sista svarsdatum.', 'ogiltig', { falt });
  // Runda 10, r6: remiss, där vårdansvaret går över, eller konsultation, där det stannar hos remittenten. Förvalet är remiss.
  const typ = r10.tolkaTyp(inp?.typ);
  const r = db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid, typ)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?, ?)`).run(atk.patientId, min, till.id, atk.personal.id, fragestallning, anamnes, prioritet, inp.svarSenast, iso(), typ);
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
  // Runda 8, r2: en extern pappersremiss ger ingen vårdrelation förrän den tas emot, så rollen räcker för att ta emot den.
  r8.kravMottag(atk, r);
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
  // Runda 10, r6: en konsultation besvaras direkt. Systemet kvitterar mottagningen och registrerar bedömningen först.
  const s0 = typeof svar === 'string' ? svar.trim() : '';
  if (r10.arKonsultation(r) && s0.length >= 3 && s0.length <= 8000) r = r10.forberedKonsultationssvar(atk, r, { kravMottag: r8.kravMottag });
  if (r.status !== 'bedomd' || r.beslut !== 'accepterad') throw fel('Bara en accepterad remiss kan besvaras.');
  const s = typeof svar === 'string' ? svar.trim() : '';
  if (s.length < 3 || s.length > 8000) throw new Fel(400, 'Skriv ett svar.', 'ogiltig', { falt: ['svar'] });
  atk.db.query("UPDATE remisser SET status = 'besvarad', besvarad_tid = ?, besvarad_av = ?, svar = ? WHERE id = ?").run(iso(), atk.personal.id, s, r.id);
  // Runda 6, r4: en egen vårdbegäran har ingen remitterande vårdenhet som kvitterar svaret. Svaret går till patienten i
  // Min journal, och systemet kvitterar det, så att vårdrelationen genom begäran upphör som för en kvitterad remiss.
  // Runda 8, r2: svaret på en extern pappersremiss skickas med post, och systemet kvitterar det på samma sätt.
  if (r.fran_enhet_id === EGEN || r.fran_enhet_id === r8.EXTERN) atk.db.query("UPDATE remisser SET status = 'svar_kvitterat', svar_kvitterat_tid = besvarad_tid WHERE id = ?").run(r.id);
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
  const granser = larmgranser(db, nu);
  for (const r of db.query('SELECT * FROM remisser WHERE (fran_enhet_id = ? OR till_enhet_id = ?) AND status <> ?').all(min, min, 'svar_kvitterat')) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    for (const l of larmFor(r, nu, granser)) {
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
