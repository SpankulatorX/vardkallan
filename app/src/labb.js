// Beställning och svar för laboratoriet (runda 8, r1, Sussa 4.4.1, 4.4.2, 4.4.3 och 12.1.1.9, Sussas testfall 3.1 till
// 3.3). Läkaren beställer analyser och paket, sjuksköterskan eller undersköterskan beställer på uppdrag av en läkare som
// signerar i inkorgen, den som tar proverna bockar av rör för rör, proverna skickas till det simulerade laboratoriet och
// svaren kommer tillbaka som mätvärden med NPU-kod och referensintervall, i den ansvariga läkarens inkorg för vidimering.
//
// Systemet är experten:
//   - Det föreslår paket ur vårdkontaktens orsak, patientens diagnoser och läkemedel och tidigare beställningar, och tar
//     själv bort analyser som nyss är tagna eller redan beställda, med en förklaring. Allt räknas bara på det som den
//     inloggade får se, så att inget dolt röjs genom ett förslag eller en varning.
//   - Det väljer laboratorium (klinisk kemi har tre utförande laboratorier, och det som hör till sjukhuset väljs), rör,
//     provtagningsordning och etiketter, fyller i anamnesen ur vårdkontakten och knyter beställningen till vårdkontakten.
//   - Varje beställning får ett unikt beställnings-id som aldrig återanvänds (SQLite AUTOINCREMENT) och som följer med
//     genom hela flödet, på etiketterna och till laboratoriet.
//   - Proverna skickas själva när alla rör för en provtagningstid är tagna, och svaren larmar när de är kritiska.
//
// Laboratorierna är simulerade (labb-katalog.js). Svaren räknas fram ur ett normalvärde med en liten variation per
// beställning, och vid feber och frossa med värden som vid en infektion. Ingen riktig kommunikation med ett
// producentsystem görs.
import { Fel, iso, addDagar, datumAv, lokalTid } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, harVardrelation, visningsnamn, visningsPnr, alder } from './atkomst.js';
import { MATTYPER_ENHET } from './db.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as vardkontakt from './vardkontakt.js';
import { varde as konfig } from './konfiguration.js';
import { referens, utanforReferens, ckdEpi2021 } from './skalor.js';
// Mätvärden som systemförvaltningen har undantagit från visning visas inte heller som svar (Sussa 12.1.1.10).
import { provare as undantagProvare } from './undantag.js';
import { LAB, LABORATORIER, ROR, ANALYSER, ANALYS, PAKET, PAKETEN, SVARSVARDEN, FYND, DISCIPLINER, DEMOREGEL, finns as iKatalog } from './labb-katalog.js';
// Runda 9, r3: blodcentralens svar.
import { blodgruppFor, blodgruppText } from './labb-katalog.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS labb_bestallningar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nummer TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER,
  ansvarig_id TEXT NOT NULL, registrerad_av TEXT NOT NULL, pa_uppdrag INTEGER NOT NULL DEFAULT 0, signerad_tid TEXT,
  skapad TEXT NOT NULL, planerad TEXT NOT NULL, paket_id TEXT, anamnes TEXT, kommentar TEXT, demo TEXT,
  makulerad_tid TEXT, makulerad_av TEXT, makulerad_orsak TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE INDEX IF NOT EXISTS ix_labb_best_patient ON labb_bestallningar (patient_id);
CREATE INDEX IF NOT EXISTS ix_labb_best_ansvarig ON labb_bestallningar (ansvarig_id);
CREATE TABLE IF NOT EXISTS labb_prov (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lab_id TEXT NOT NULL,
  ror TEXT NOT NULL, planerad TEXT NOT NULL, etikett TEXT NOT NULL UNIQUE, provtagen_tid TEXT, provtagen_av TEXT, skickad_tid TEXT, borttagen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_labb_prov_best ON labb_prov (bestallning_id);
CREATE TABLE IF NOT EXISTS labb_analyser (
  id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, analys TEXT NOT NULL, lab_id TEXT NOT NULL,
  prov_id INTEGER NOT NULL, status TEXT NOT NULL, mottagen_tid TEXT, besvarad_tid TEXT, svar_text TEXT, fynd TEXT, avvikande TEXT,
  kritisk INTEGER NOT NULL DEFAULT 0, vidimerad_tid TEXT, vidimerad_av TEXT, borttagen_tid TEXT, borttagen_av TEXT
);
CREATE INDEX IF NOT EXISTS ix_labb_an_best ON labb_analyser (bestallning_id);
CREATE INDEX IF NOT EXISTS ix_labb_an_status ON labb_analyser (status);
CREATE TABLE IF NOT EXISTS labb_svar (
  id INTEGER PRIMARY KEY, analys_rad_id INTEGER NOT NULL, matvarde_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS labb_historik (
  id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  personal_id TEXT, handelse TEXT NOT NULL, detalj TEXT
);
CREATE INDEX IF NOT EXISTS ix_labb_hist_best ON labb_historik (bestallning_id);
CREATE TRIGGER IF NOT EXISTS labb_historik_andras_ej BEFORE UPDATE OF bestallning_id, tid, personal_id, handelse, detalj ON labb_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken för en beställning ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS labb_historik_raderas_ej BEFORE DELETE ON labb_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken för en beställning raderas inte.'); END;
`;

const harTabell = new WeakSet();
export function sakraLabb(db) {
  if (harTabell.has(db)) return;
  db.exec(SCHEMA);
  harTabell.add(db);
}
const finns = (db) => {
  if (harTabell.has(db)) return true;
  if (db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'labb_bestallningar'").get()) { harTabell.add(db); return true; }
  return false;
};

const MIN = 60_000;
const TIMME = 60 * MIN;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const labKort = (id) => { const l = LAB[id]; return l ? { id: l.id, namn: l.namn, kort: l.kort, hsa: l.hsa, disciplin: l.disciplin, simulerat: true } : null; };
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const dagText = (t, nu) => {
  const d = datumAv(new Date(t));
  const i = datumAv(nu);
  if (d === i) return `i dag kl. ${klocka(t)}`;
  if (d === addDagar(i, 1)) return `i morgon kl. ${klocka(t)}`;
  if (d === addDagar(i, -1)) return `i går kl. ${klocka(t)}`;
  return `${d} kl. ${klocka(t)}`;
};
const sedan = (ms) => {
  const h = Math.round(ms / TIMME);
  if (h < 1) return 'för mindre än en timme sedan';
  if (h < 48) return `för ${h} ${h === 1 ? 'timme' : 'timmar'} sedan`;
  return `för ${Math.round(h / 24)} dagar sedan`;
};
const tal = (v, dec) => String(dec ? v.toFixed(dec) : Math.round(v)).replace('.', ',');
const textFalt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Beställnings-id och etikett-id. Id:t kommer från AUTOINCREMENT och återanvänds därför aldrig, inte heller efter en
// makulering eller en sammanslagning av journaler.
export const nummerFor = (id, tid) => `VKB-${String(tid).slice(0, 4)}-${String(id).padStart(6, '0')}`;
export const etikettFor = (id) => `VKP${String(id).padStart(8, '0')}`;

// Sjukhuset som en enhet hör till, för valet av laboratorium.
function sjukhusFor(db, enhetId) {
  let id = enhetId;
  for (let i = 0; i < 8 && id; i++) {
    const e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!e) return null;
    if (e.typ === 'sjukhus') return e.id;
    id = e.forald_id;
  }
  return null;
}
// Laboratoriet för en disciplin från en enhet: det som hör till enhetens sjukhus, annars det första i disciplinen.
export function labFor(db, enhetId, disciplin) {
  const sjukhus = sjukhusFor(db, enhetId);
  const alla = LABORATORIER.filter(l => l.disciplin === disciplin);
  return alla.find(l => l.sjukhus.includes(sjukhus)) ?? alla[0];
}

// Paketens innehåll gäller som systemförvaltningen har bestämt det (konfiguration.js, Sussa 12.1.1.9). Parametern är en
// lista med analysernas namn.
export function paketAnalyser(db, paketId, nu = new Date()) {
  if (!iKatalog(PAKETEN, paketId)) return [];
  const p = PAKETEN[paketId];
  let namn;
  try { namn = konfig(db, `labb.paket.${paketId}`, nu); } catch { return [...p.analyser]; }
  const perNamn = new Map(ANALYSER.map(a => [a.namn.toLocaleLowerCase('sv'), a.id]));
  return namn.map(n => perNamn.get(String(n).toLocaleLowerCase('sv'))).filter(Boolean);
}
// Standardvärdena, samma som parametrarnas i konfiguration.js (testat).
export const SVAR_MINUTER = 20;
export const LARM_TIMMAR = 4;
const svarMinuter = (db, nu) => { try { return konfig(db, 'labb.svar_minuter', nu); } catch { return SVAR_MINUTER; } };
const larmTimmar = (db, nu) => { try { return konfig(db, 'labb.provtagning_larm_timmar', nu); } catch { return LARM_TIMMAR; } };

// Raderna för en beställning.
const analyserFor = (db, id) => db.query('SELECT * FROM labb_analyser WHERE bestallning_id = ? ORDER BY id').all(id);
const provFor = (db, id) => db.query('SELECT * FROM labb_prov WHERE bestallning_id = ? AND borttagen = 0 ORDER BY id').all(id);
export function bestallningRad(db, id) {
  if (!finns(db)) throw new Fel(404, 'Beställningen finns inte.', 'saknas');
  const b = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM labb_bestallningar WHERE id = ?').get(Number(id)) : null;
  if (!b) throw new Fel(404, 'Beställningen finns inte.', 'saknas');
  return b;
}
export function provRad(db, id) {
  if (!finns(db)) throw new Fel(404, 'Provet finns inte.', 'saknas');
  const p = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM labb_prov WHERE id = ?').get(Number(id)) : null;
  if (!p) throw new Fel(404, 'Provet finns inte.', 'saknas');
  return p;
}
function historik(db, b, personalId, handelse, detalj = null, tid = iso()) {
  db.query('INSERT INTO labb_historik (bestallning_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(b.id, b.patient_id, b.enhet_id, tid, personalId, handelse, detalj);
}

// Status för en beställning, räknad ur analyserna och rören.
export const STATUS = {
  bestalld: 'Beställd, väntar på provtagning', delvis_provtagen: 'Delvis provtagen', skickad: 'Skickad till laboratoriet',
  delvis_besvarad: 'Delvis besvarad', besvarad: 'Besvarad, väntar på vidimering', vidimerad: 'Besvarad och vidimerad', makulerad: 'Makulerad',
};
export function statusFor(b, analyser, prov) {
  if (b.makulerad_tid) return 'makulerad';
  const aktiva = analyser.filter(a => a.status !== 'borttagen');
  if (aktiva.length && aktiva.every(a => a.status === 'besvarad')) return aktiva.every(a => a.vidimerad_tid) ? 'vidimerad' : 'besvarad';
  if (aktiva.some(a => a.status === 'besvarad')) return 'delvis_besvarad';
  if (prov.length && prov.every(p => p.provtagen_tid)) return 'skickad';
  if (prov.some(p => p.provtagen_tid)) return 'delvis_provtagen';
  return 'bestalld';
}

// Beställningarna som den inloggade får se: inre sekretess och spärr prövas på den beställande vårdenheten.
export function synligaBestallningar(atk) {
  if (!finns(atk.db) || !kanRoll(atk.personal, 'las_prover')) return [];
  const rader = atk.db.query('SELECT * FROM labb_bestallningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_prover');
}

// Svaren för en analys: mätvärdena med referensintervall och avvikelse, eller ett textsvar.
function svarFor(db, a, kon) {
  const undantagen = undantagProvare(db, 'visning');
  const mv = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? ORDER BY m.id').all(a.id).filter(m => !undantagen(m, 'matvarde'));
  return mv.map(m => {
    const r = referens(m.typ, { kon });
    const v = m.varde_num ?? Number(m.varde);
    const sv = SVARSVARDEN[m.typ];
    const kritisk = Boolean(sv && Number.isFinite(v) && ((sv.kritiskLag != null && v < sv.kritiskLag) || (sv.kritiskHog != null && v > sv.kritiskHog)));
    const utanfor = utanforReferens(v, r);
    return {
      matvardeId: m.id, typ: m.typ, namn: journal.MATTYPER[m.typ]?.namn ?? m.typ, varde: v, enhet: m.matt_enhet, tid: m.tid, referens: r,
      avvikande: kritisk ? (r?.hog != null && v > r.hog ? 'kritiskt_hogt' : 'kritiskt_lagt') : utanfor ? (r?.hog != null && v > r.hog ? 'hogt' : 'lagt') : null,
      vidimerad: m.vidimerad ?? null,
    };
  });
}
export const AVVIKANDE = { hogt: 'Högt', lagt: 'Lågt', kritiskt_hogt: 'Kritiskt högt', kritiskt_lagt: 'Kritiskt lågt', fynd: 'Fynd' };

// En beställning som den visas för personalen. Inget om patienten utöver id:t, som anroparen redan har.
export function bestallningUt(db, b, personal = null, nu = new Date()) {
  const analyser = analyserFor(db, b.id);
  const prov = provFor(db, b.id);
  const status = statusFor(b, analyser, prov);
  const kon = db.query('SELECT kon FROM patienter WHERE id = ?').get(b.patient_id)?.kon;
  const provPer = new Map(prov.map(p => [p.id, p]));
  const aktiva = analyser.filter(a => a.status !== 'borttagen');
  const analysUt = (a) => {
    const def = ANALYS[a.analys];
    const svar = a.status === 'besvarad' ? svarFor(db, a, kon) : [];
    const fynd = a.fynd ? FYND[a.fynd] : null;
    return {
      id: a.id, analys: a.analys, namn: def?.namn ?? a.analys, disciplin: def?.disciplin, lab: labKort(a.lab_id), status: a.status,
      provId: a.prov_id, etikett: provPer.get(a.prov_id)?.etikett ?? null,
      mottagen: a.mottagen_tid, besvarad: a.besvarad_tid, svar, text: a.svar_text, fynd: fynd ? { kod: fynd.snomed, text: fynd.text } : null,
      avvikande: a.status === 'besvarad' ? (a.kritisk ? 'kritiskt' : a.avvikande ?? (svar.some(s => s.avvikande) ? 'avvikande' : null)) : null,
      kritisk: Boolean(a.kritisk), vidimerad: a.vidimerad_tid ? { tid: a.vidimerad_tid, av: personKort(db, a.vidimerad_av) } : null,
      borttagen: a.status === 'borttagen' ? { tid: a.borttagen_tid, av: personKort(db, a.borttagen_av) } : null,
    };
  };
  const provUt = prov.map(p => ({
    id: p.id, etikett: p.etikett, ror: p.ror, rorNamn: ROR[p.ror]?.namn, farg: ROR[p.ror]?.farg, beskrivning: ROR[p.ror]?.beskrivning, ordning: ROR[p.ror]?.ordning ?? 9,
    lab: labKort(p.lab_id), planerad: p.planerad, provtagen: p.provtagen_tid ? { tid: p.provtagen_tid, av: personKort(db, p.provtagen_av) } : null,
    skickad: p.skickad_tid, analyser: aktiva.filter(a => a.prov_id === p.id).map(a => ANALYS[a.analys]?.namn ?? a.analys),
    forsenad: !p.provtagen_tid && !b.makulerad_tid && Date.parse(p.planerad) + larmTimmar(db, nu) * TIMME < nu.getTime(),
  })).filter(p => p.analyser.length).sort((x, y) => x.planerad.localeCompare(y.planerad) || x.ordning - y.ordning);
  const hist = db.query('SELECT * FROM labb_historik WHERE bestallning_id = ? ORDER BY tid, id').all(b.id)
    .map(h => ({ tid: h.tid, handelse: h.handelse, detalj: h.detalj, av: personKort(db, h.personal_id) }));
  const besvarade = aktiva.filter(a => a.status === 'besvarad');
  const tid = (lista, f, max = false) => { const t = lista.map(f).filter(Boolean).sort(); return t.length ? (max ? t.at(-1) : t[0]) : null; };
  // Kedjan från upprättande till avslut (Sussa 4.4.2.1 och 4.4.2.5), med vem och när för varje steg.
  const steg = [
    { steg: 'bestalld', text: b.pa_uppdrag ? `Beställd av ${personNamn(db, b.registrerad_av)} på uppdrag av ${personNamn(db, b.ansvarig_id)}` : `Beställd av ${personNamn(db, b.ansvarig_id)}`, tid: b.skapad, klar: true },
    ...(b.pa_uppdrag ? [{ steg: 'signerad', text: b.signerad_tid ? `Signerad av ${personNamn(db, b.ansvarig_id)}` : `Väntar på signering av ${personNamn(db, b.ansvarig_id)}`, tid: b.signerad_tid, klar: Boolean(b.signerad_tid) }] : []),
    { steg: 'provtagen', text: provUt.every(p => p.provtagen) ? 'Provtagen' : `${provUt.filter(p => p.provtagen).length} av ${provUt.length} rör tagna`, tid: provUt.every(p => p.provtagen) ? tid(provUt, p => p.provtagen?.tid, true) : null, klar: provUt.length > 0 && provUt.every(p => p.provtagen) },
    { steg: 'mottagen', text: 'Mottagen av laboratoriet', tid: tid(aktiva, a => a.mottagen_tid), klar: aktiva.length > 0 && aktiva.every(a => a.mottagen_tid) },
    { steg: 'besvarad', text: besvarade.length === aktiva.length ? 'Besvarad' : `${besvarade.length} av ${aktiva.length} analyser besvarade`, tid: besvarade.length === aktiva.length ? tid(aktiva, a => a.besvarad_tid, true) : null, klar: aktiva.length > 0 && besvarade.length === aktiva.length },
    { steg: 'vidimerad', text: aktiva.every(a => a.vidimerad_tid) && aktiva.length ? `Vidimerad av ${personNamn(db, aktiva[0].vidimerad_av)}` : `Vidimeras av ${personNamn(db, b.ansvarig_id)}`, tid: aktiva.length && aktiva.every(a => a.vidimerad_tid) ? tid(aktiva, a => a.vidimerad_tid, true) : null, klar: aktiva.length > 0 && aktiva.every(a => a.vidimerad_tid) },
  ];
  const minVe = personal ? vardenhetFor(db, personal.enhet_id) : null;
  const egenVe = minVe === vardenhetFor(db, b.enhet_id);
  const oppen = !['makulerad'].includes(status) && !besvarade.length;
  return {
    id: b.id, nummer: b.nummer, status, statusText: STATUS[status], skapad: b.skapad, planerad: b.planerad,
    vardenhet: { id: b.enhet_id, namn: enhetsnamn(db, b.enhet_id) }, ansvarig: personKort(db, b.ansvarig_id), registreradAv: personKort(db, b.registrerad_av),
    paUppdrag: Boolean(b.pa_uppdrag), signerad: b.signerad_tid ?? null, paket: b.paket_id ? { id: b.paket_id, namn: PAKETEN[b.paket_id]?.namn ?? b.paket_id } : null,
    anamnes: b.anamnes, kommentar: b.kommentar, vardkontaktId: b.vardkontakt_id ?? null,
    makulerad: b.makulerad_tid ? { tid: b.makulerad_tid, av: personKort(db, b.makulerad_av), orsak: b.makulerad_orsak } : null,
    analyser: analyser.map(analysUt), prov: provUt, steg, historik: hist,
    labb: [...new Set(aktiva.map(a => a.lab_id))].map(labKort),
    avvikande: besvarade.some(a => a.kritisk || a.avvikande) || besvarade.some(a => svarFor(db, a, kon).some(s => s.avvikande)),
    kritisk: besvarade.some(a => a.kritisk),
    kan: personal ? {
      taProv: kanRoll(personal, 'ta_prov') && oppen && provUt.some(p => !p.provtagen),
      makulera: oppen && egenVe && (kanRoll(personal, 'bestalla_prov') || personal.id === b.registrerad_av),
      andra: oppen && egenVe && (kanRoll(personal, 'bestalla_prov') || personal.id === b.registrerad_av) && provUt.some(p => !p.provtagen),
      overlata: status !== 'makulerad' && status !== 'vidimerad' && kanRoll(personal, 'bestalla_prov') && (personal.id === b.ansvarig_id || egenVe),
      vidimera: personal.id === b.ansvarig_id && besvarade.some(a => !a.vidimerad_tid),
      signera: personal.id === b.ansvarig_id && Boolean(b.pa_uppdrag) && !b.signerad_tid && status !== 'makulerad',
      simuleraSvar: status !== 'makulerad' && aktiva.some(a => a.status === 'mottagen'),
      skicka: oppen && provUt.some(p => p.provtagen && !p.skickad),
    } : null,
    simulerat: 'Laboratoriet är simulerat. Svaren räknas fram av demon.',
  };
}

// Beställningarna för patienten, för fliken Prover. Laboratoriet svarar på det som har hunnit bli klart.
export function forPatient(atk, nu = new Date()) {
  atk.krav('las_prover');
  forfallnaSvar(atk.db, nu);
  const rader = synligaBestallningar(atk);
  // Läkarna som ansvaret kan överlåtas till, med vårdenhet. Inga patientuppgifter. Systemet prövar vårdrelationen när
  // ansvaret överlåts.
  const lakare = kanRoll(atk.personal, 'bestalla_prov')
    ? atk.db.query("SELECT id, namn, enhet_id FROM personal WHERE yrke = 'lakare' AND coalesce(aktiv, 1) = 1 AND demo = 1 ORDER BY namn").all()
      .map(l => ({ id: l.id, namn: l.namn, vardenhet: enhetsnamn(atk.db, vardenhetFor(atk.db, l.enhet_id)) }))
    : [];
  return {
    bestallningar: rader.map(b => bestallningUt(atk.db, b, atk.personal, nu)),
    lakare,
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
    simulerat: 'Laboratorierna är simulerade. Svaren räknas fram av demon och är inte riktiga provsvar.',
    demoregel: DEMOREGEL,
  };
}

// Prov som nyss är tagna eller redan beställda, bland det som den inloggade får se. Returnerar en karta från analysens
// id till en förklaring. En analys utan tid för dubblettvarning (vävnadsprov) varnar aldrig.
export function dubbletter(atk, analysIds, nu = new Date()) {
  const db = atk.db;
  const ut = new Map();
  const matAtk = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  const matvarden = kanRoll(atk.personal, 'las_matvarden') ? journal.synligaMatvarden(matAtk) : [];
  const bestAtk = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_prover');
  const bestallningar = synligaBestallningar(bestAtk).filter(b => !b.makulerad_tid);
  for (const id of analysIds) {
    const def = ANALYS[id];
    if (!def || !def.dubblettTimmar) continue;
    const grans = nu.getTime() - def.dubblettTimmar * TIMME;
    const typ = def.matvarden?.[0];
    // Ett beställt men inte besvarat prov av samma analys.
    for (const b of bestallningar) {
      const a = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND analys = ? AND status NOT IN ('borttagen', 'makulerad', 'besvarad') LIMIT 1").get(b.id, id);
      if (a) { ut.set(id, { analys: id, namn: def.namn, typ: 'bestalld', skal: `${def.namn} är redan beställd (${b.nummer}), provtagning ${dagText(b.planerad, nu)}.` }); break; }
    }
    if (ut.has(id)) continue;
    const senast = typ ? matvarden.find(m => m.typ === typ && Date.parse(m.tid) >= grans && Date.parse(m.tid) <= nu.getTime() + 5 * MIN) : null;
    if (senast) {
      const v = senast.varde_num ?? senast.varde;
      ut.set(id, { analys: id, namn: def.namn, typ: 'tagen', skal: `${def.namn} togs ${sedan(nu.getTime() - Date.parse(senast.tid))} (${journal.MATTYPER[typ]?.namn ?? typ} ${String(v).replace('.', ',')} ${senast.matt_enhet ?? ''}).`.replace(' )', ')') });
      continue;
    }
    // Odlingar och andra prov utan mätvärde: en tidigare beställning av samma analys som har tagits nyligen.
    for (const b of bestallningar) {
      const a = db.query("SELECT a.* FROM labb_analyser a JOIN labb_prov p ON p.id = a.prov_id WHERE a.bestallning_id = ? AND a.analys = ? AND a.status = 'besvarad' AND p.provtagen_tid >= ? LIMIT 1")
        .get(b.id, id, new Date(grans).toISOString());
      if (a) { ut.set(id, { analys: id, namn: def.namn, typ: 'tagen', skal: `${def.namn} togs ${sedan(nu.getTime() - Date.parse(a.besvarad_tid))} (${b.nummer}).` }); break; }
    }
  }
  return ut;
}

// Anamnesen som systemet föreslår ur den pågående vårdkontakten, för odlingar och vävnadsprov.
function anamnesForslag(db, personal, patientId, nu) {
  const v = vardkontakt.pagandeFor(db, personal, patientId, nu.getTime());
  if (!v?.orsak) return null;
  const orsak = v.orsak.charAt(0).toLocaleLowerCase('sv') + v.orsak.slice(1);
  return `Inkommen med ${orsak.replace(/\.$/, '')}.`;
}

// Läkarna som en beställning på uppdrag kan göras för: läkare på samma vårdenhet. Den som senast dokumenterade eller
// ordinerade för patienten på vårdenheten står först och är förvald.
export function lakareForUppdrag(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const lakare = db.query(`SELECT id, namn, titel FROM personal WHERE yrke = 'lakare' AND coalesce(aktiv, 1) = 1 AND enhet_id IN (${ph}) ORDER BY namn`).all(...enheter);
  const senaste = db.query(`SELECT forfattare_id AS id, max(skapad) AS t FROM anteckningar WHERE patient_id = ? AND enhet_id IN (${ph}) GROUP BY forfattare_id
    UNION ALL SELECT ordinerad_av AS id, max(skapad) AS t FROM ordinationer WHERE patient_id = ? AND enhet_id IN (${ph}) GROUP BY ordinerad_av`).all(patientId, ...enheter, patientId, ...enheter);
  const tid = new Map();
  for (const r of senaste) if (r.id && (!tid.has(r.id) || r.t > tid.get(r.id))) tid.set(r.id, r.t);
  return lakare.sort((a, b) => (tid.get(b.id) ?? '').localeCompare(tid.get(a.id) ?? '') || a.namn.localeCompare(b.namn, 'sv'))
    .map((l, i) => ({ id: l.id, namn: l.namn, titel: l.titel, forvald: i === 0 }));
}

// Förslag till beställningen: paket med skäl, utan analyser som nyss är tagna eller redan beställda, laboratoriet för
// varje disciplin, anamnesen och provtagningstiden. Allt räknas på det som den inloggade får se.
export function forslag(atk, p, nu = new Date()) {
  const db = atk.db;
  const pers = atk.personal;
  const uppdrag = !kanRoll(pers, 'bestalla_prov');
  atk.krav(uppdrag ? 'bestalla_prov_uppdrag' : 'bestalla_prov');
  const v = vardkontakt.pagandeFor(db, pers, p.id, nu.getTime());
  const orsak = (v?.orsak ?? '').toLocaleLowerCase('sv');
  const diaAtk = new Atkomst(db, pers, p.id, atk.val, 'las_diagnoser');
  const diagnoser = kanRoll(pers, 'las_diagnoser') ? journal.synligaDiagnoser(diaAtk) : [];
  const lmAtk = new Atkomst(db, pers, p.id, atk.val, 'las_lakemedel');
  const atc = kanRoll(pers, 'las_lakemedel') ? lakemedel.synligaOrdinationer(lmAtk).filter(lakemedel.aktuell).map(o => db.query('SELECT atc FROM katalog WHERE id = ?').get(o.lakemedel_id)?.atc).filter(Boolean) : [];
  const bestAtk = new Atkomst(db, pers, p.id, atk.val, 'las_prover');
  const tidigare = synligaBestallningar(bestAtk).filter(b => !b.makulerad_tid && b.paket_id);
  const ve = vardenhetFor(db, pers.enhet_id);
  const inlagd = db.query('SELECT v.inskriven FROM vardtillfallen v WHERE v.patient_id = ? AND v.utskriven IS NULL AND v.enhet_id = ?').get(p.id, ve);
  const kandidater = [];
  for (const pk of PAKET) {
    const skal = [];
    let poang = 0;
    const ord = pk.ord.find(o => orsak.includes(o));
    if (ord) { poang += 3; skal.push(`Vårdkontaktens orsak är ${v.orsak.toLocaleLowerCase('sv')}.`); }
    const d = diagnoser.find(x => pk.diagnoser.some(pre => x.kod.startsWith(pre)));
    if (d) { poang += 2; skal.push(`Patienten har diagnosen ${d.text} (${d.kod}).`); }
    if (pk.atc?.some(x => atc.includes(x))) { poang += 2; skal.push('Patienten står på warfarin enligt läkemedelslistan.'); }
    const forra = tidigare.find(b => b.paket_id === pk.id && vardenhetFor(db, b.enhet_id) === ve);
    if (forra) { poang += 1; skal.push(`Beställdes senast ${dagText(forra.skapad, nu)} på vårdenheten.`); }
    if (pk.inskrivning && inlagd && !tidigare.some(b => b.skapad >= inlagd.inskriven) && !synligaBestallningar(bestAtk).some(b => b.skapad >= inlagd.inskriven)) {
      poang += 1; skal.push('Patienten är inskriven och har inga prover beställda sedan inskrivningen.');
    }
    if (poang) kandidater.push({ pk, poang, skal });
  }
  kandidater.sort((a, b) => b.poang - a.poang);
  const paketUt = (pk, skal = [], poang = 0) => {
    const ids = paketAnalyser(db, pk.id, nu);
    const dubb = dubbletter(atk, ids, nu);
    return {
      id: pk.id, namn: pk.namn, poang, skal,
      analyser: ids.filter(id => !dubb.has(id)).map(id => ({ id, namn: ANALYS[id].namn, lab: labKort(labFor(db, pers.enhet_id, ANALYS[id].disciplin).id) })),
      utelamnade: ids.filter(id => dubb.has(id)).map(id => ({ id, namn: ANALYS[id].namn, skal: dubb.get(id).skal })),
    };
  };
  const forslagen = kandidater.slice(0, 3).map(k => paketUt(k.pk, k.skal, k.poang)).filter(x => x.analyser.length || x.utelamnade.length);
  const planerad = new Date(Math.ceil(nu.getTime() / (5 * MIN)) * 5 * MIN).toISOString();
  const imorgon = lokalTid(addDagar(datumAv(nu), 1), '07:00');
  const allaDubbletter = dubbletter(atk, ANALYSER.map(x => x.id), nu);
  return {
    paket: forslagen,
    allaPaket: PAKET.map(pk => paketUt(pk)),
    dubbletter: Object.fromEntries([...allaDubbletter].map(([id, d]) => [id, d.skal])),
    analyser: ANALYSER.map(a => ({ id: a.id, namn: a.namn, disciplin: a.disciplin, disciplinNamn: DISCIPLINER[a.disciplin].namn, ord: a.ord, anamnes: Boolean(a.anamnes),
      ror: ROR[a.ror]?.namn, lab: labKort(labFor(db, pers.enhet_id, a.disciplin).id) })),
    laboratorier: Object.fromEntries(Object.keys(DISCIPLINER).map(d => [d, LABORATORIER.filter(l => l.disciplin === d).map(l => labKort(l.id))])),
    anamnes: anamnesForslag(db, pers, p.id, nu),
    planerad, tider: [{ id: 'nu', text: 'Nu', tid: planerad }, { id: 'imorgon', text: 'I morgon kl. 07.00, morgonprovtagningen', tid: imorgon }],
    paUppdrag: uppdrag, lakare: uppdrag ? lakareForUppdrag(db, pers, p.id) : [],
    simulerat: 'Laboratorierna är simulerade.', demoregel: DEMOREGEL,
  };
}

function valideraTid(v, nu, falt = 'planerad') {
  if (v == null || v === '' || v === 'nu') return new Date(Math.ceil(nu.getTime() / MIN) * MIN).toISOString();
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(ms)) throw new Fel(400, 'Provtagningstiden är inte en giltig tidpunkt.', 'ogiltig', { falt: [falt] });
  if (ms < nu.getTime() - 24 * TIMME) throw new Fel(400, 'Provtagningstiden kan ligga högst ett dygn bakåt. Ett prov som togs tidigare registreras med en ny beställning med rätt tid i dag.', 'ogiltig', { falt: [falt] });
  if (ms > nu.getTime() + 60 * 24 * TIMME) throw new Fel(400, 'Provtagningstiden kan ligga högst 60 dagar framåt.', 'ogiltig', { falt: [falt] });
  return new Date(ms).toISOString();
}

// Lägger in analyserna och rören för en beställning. Analyser till samma laboratorium, i samma rör och med samma
// provtagningstid tas i samma rör. Returnerar antalet rör.
function laggIn(db, b, rader) {
  const insProv = db.query('INSERT INTO labb_prov (bestallning_id, patient_id, enhet_id, lab_id, ror, planerad, etikett) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insAn = db.query("INSERT INTO labb_analyser (bestallning_id, patient_id, enhet_id, analys, lab_id, prov_id, status) VALUES (?, ?, ?, ?, ?, ?, 'bestalld')");
  for (const r of rader) {
    const def = ANALYS[r.analys];
    let prov = db.query('SELECT * FROM labb_prov WHERE bestallning_id = ? AND lab_id = ? AND ror = ? AND planerad = ? AND provtagen_tid IS NULL AND borttagen = 0').get(b.id, r.lab, def.ror, r.planerad);
    if (!prov) {
      const id = Number(insProv.run(b.id, b.patient_id, b.enhet_id, r.lab, def.ror, r.planerad, `tmp-${b.id}-${Math.random()}`).lastInsertRowid);
      db.query('UPDATE labb_prov SET etikett = ? WHERE id = ?').run(etikettFor(id), id);
      prov = { id };
    }
    insAn.run(b.id, b.patient_id, b.enhet_id, r.analys, r.lab, prov.id);
  }
}

// Beställer. body: { paket, analyser: [id | { analys, planerad }], planerad, anamnes, kommentar, lakareId (på uppdrag),
// laboratorier: { disciplin: labId }, kvitteraDubbletter }.
export function bestall(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  const pers = atk.personal;
  sakraLabb(db);
  const uppdrag = !kanRoll(pers, 'bestalla_prov');
  const handling = uppdrag ? 'bestalla_prov_uppdrag' : 'bestalla_prov';
  atk.krav(handling);
  let ansvarig = pers.id;
  if (uppdrag) {
    const lakare = lakareForUppdrag(db, pers, atk.patientId);
    const valt = body.lakareId ?? lakare.find(l => l.forvald)?.id;
    if (!valt) throw new Fel(400, 'Det finns ingen läkare på vårdenheten som beställningen kan göras på uppdrag av.', 'ogiltig', { falt: ['lakareId'] });
    if (!lakare.some(l => l.id === valt)) throw new Fel(400, 'En beställning på uppdrag görs för en läkare på din vårdenhet. Välj läkaren som gav uppdraget.', 'ogiltig', { falt: ['lakareId'] });
    ansvarig = valt;
  }
  const paket = body.paket != null && iKatalog(PAKETEN, body.paket) ? PAKETEN[body.paket] : null;
  if (body.paket != null && !paket) throw new Fel(400, 'Paketet finns inte.', 'ogiltig', { falt: ['paket'] });
  const planerad = valideraTid(body.planerad, nu);
  let lista = Array.isArray(body.analyser) ? body.analyser : paket ? paketAnalyser(db, paket.id, nu) : [];
  lista = lista.map(x => (typeof x === 'string' ? { analys: x } : x)).filter(x => x && typeof x.analys === 'string');
  if (!lista.length) throw new Fel(400, 'Välj minst en analys eller ett paket.', 'ogiltig', { falt: ['analyser'] });
  if (lista.length > 30) throw new Fel(400, 'En beställning kan ha högst 30 analyser.', 'ogiltig', { falt: ['analyser'] });
  const okand = lista.find(x => !iKatalog(ANALYS, x.analys));
  if (okand) throw new Fel(400, 'Analysen finns inte i katalogen.', 'ogiltig', { falt: ['analyser'] });
  const sedda = new Set();
  lista = lista.filter(x => (sedda.has(x.analys) ? false : (sedda.add(x.analys), true)));
  const rader = lista.map(x => {
    const def = ANALYS[x.analys];
    const valtLab = body.laboratorier?.[def.disciplin];
    if (valtLab != null && (!iKatalog(LAB, valtLab) || LAB[valtLab].disciplin !== def.disciplin)) throw new Fel(400, `Laboratoriet tar inte emot prov för ${DISCIPLINER[def.disciplin].namn.toLocaleLowerCase('sv')}.`, 'ogiltig', { falt: ['laboratorier'] });
    return { analys: x.analys, lab: valtLab ?? labFor(db, pers.enhet_id, def.disciplin).id, planerad: x.planerad != null ? valideraTid(x.planerad, nu) : planerad };
  });
  let anamnes = textFalt(body.anamnes, 500);
  if (!anamnes && rader.some(r => ANALYS[r.analys].anamnes)) {
    anamnes = anamnesForslag(db, pers, atk.patientId, nu) ?? '';
    if (!anamnes) {
      const namn = rader.filter(r => ANALYS[r.analys].anamnes).map(r => ANALYS[r.analys].namn).join(' och ');
      throw new Fel(400, `Skriv en kort anamnes. Laboratoriet behöver den för ${namn}, och det finns ingen pågående vårdkontakt att hämta den ur.`, 'ogiltig', { falt: ['anamnes'] });
    }
  }
  const dubb = dubbletter(atk, rader.map(r => r.analys), nu);
  if (dubb.size && body.kvitteraDubbletter !== true) {
    throw new Fel(409, dubb.size === 1 ? [...dubb.values()][0].skal : `${dubb.size} av analyserna är nyss tagna eller redan beställda.`, 'dubblett', { dubbletter: [...dubb.values()] });
  }
  const tid = iso(nu);
  let b;
  db.transaction(() => {
    const r = db.query(`INSERT INTO labb_bestallningar (nummer, patient_id, enhet_id, ansvarig_id, registrerad_av, pa_uppdrag, skapad, planerad, paket_id, anamnes, kommentar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`tmp-${Math.random()}`, atk.patientId, pers.enhet_id, ansvarig, pers.id, uppdrag ? 1 : 0, tid, planerad, paket?.id ?? null, anamnes || null, textFalt(body.kommentar, 500) || null);
    const id = Number(r.lastInsertRowid);
    db.query('UPDATE labb_bestallningar SET nummer = ? WHERE id = ?').run(nummerFor(id, tid), id);
    b = bestallningRad(db, id);
    laggIn(db, b, rader);
    const labb = [...new Set(rader.map(x => LAB[x.lab].kort))].join(' och ');
    historik(db, b, pers.id, uppdrag ? `Beställd på uppdrag av ${personNamn(db, ansvarig)}` : 'Beställd',
      // Bara att beställningen gjordes trots varning och för vilka analyser. Varningens skäl (värde, tid och vårdenhet)
      // byggde på det beställaren fick se och sparas aldrig, eftersom historiken visas för alla som ser beställningen.
      `${rader.map(x => ANALYS[x.analys].namn).join(', ')} till ${labb}. Provtagning ${dagText(planerad, nu)}.${dubb.size ? ` Beställd trots varning för ${[...dubb.values()].map(d => d.namn).join(', ')}.` : ''}`, tid);
  })();
  vardkontakt.knyt(atk, 'labb_bestallningar', { id: b.id }, body);
  b = bestallningRad(db, b.id);
  const ut = bestallningUt(db, b, pers, nu);
  const prov = ut.prov.length;
  return {
    bestallning: ut,
    text: `${ut.analyser.map(a => a.namn).join(', ')} är beställt (${b.nummer}). ${prov} ${prov === 1 ? 'rör' : 'rör'} till ${ut.labb.map(l => l.kort).join(' och ')}, provtagning ${dagText(planerad, nu)}.${uppdrag ? ` ${personNamn(db, ansvarig)} signerar i inkorgen.` : ''}`,
  };
}

// Den ansvariga läkaren signerar en beställning som gjordes på uppdrag.
export function signera(atk, b, nu = new Date()) {
  const db = atk.db;
  // Behörigheten prövas först, så att den som inte får se beställningen inte får veta något om den.
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (atk.personal.id !== b.ansvarig_id) throw new Fel(403, `Beställningen signeras av ${personNamn(db, b.ansvarig_id)}, som den gjordes på uppdrag av.`, 'nekad');
  if (!b.pa_uppdrag) throw new Fel(409, 'Beställningen gjordes inte på uppdrag och behöver ingen signering.', 'ogiltig');
  if (b.signerad_tid) throw new Fel(409, 'Beställningen är redan signerad.', 'ogiltig');
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  db.query('UPDATE labb_bestallningar SET signerad_tid = ? WHERE id = ?').run(iso(nu), b.id);
  historik(db, b, atk.personal.id, 'Signerad', null, iso(nu));
  return { bestallning: bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu), text: `Beställningen ${b.nummer} är signerad.` };
}

const kanHandlaPa = (atk, b) => vardenhetFor(atk.db, atk.personal.enhet_id) === vardenhetFor(atk.db, b.enhet_id) && (kanRoll(atk.personal, 'bestalla_prov') || atk.personal.id === b.registrerad_av);

// Makulering (Sussa 4.4.2.9). Bara innan något svar har kommit, med orsak. Laboratoriet får veta det om proverna redan
// är skickade. Inget raderas.
export function makulera(atk, b, { orsak } = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (!kanHandlaPa(atk, b)) throw new Fel(403, 'En beställning makuleras av en läkare på den beställande vårdenheten eller av den som registrerade den.', 'nekad');
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är redan makulerad.', 'ogiltig');
  const analyser = analyserFor(db, b.id);
  if (analyser.some(a => a.status === 'besvarad')) throw new Fel(409, 'Laboratoriet har redan svarat på beställningen, så den kan inte makuleras. Ett svar som inte stämmer tas upp med laboratoriet.', 'ogiltig');
  const o = textFalt(orsak, 300);
  if (o.length < 3) throw new Fel(400, 'Skriv varför beställningen makuleras. Orsaken sparas i beställningens historik.', 'ogiltig', { falt: ['orsak'] });
  const skickade = provFor(db, b.id).filter(p => p.skickad_tid);
  db.transaction(() => {
    db.query('UPDATE labb_bestallningar SET makulerad_tid = ?, makulerad_av = ?, makulerad_orsak = ? WHERE id = ?').run(iso(nu), atk.personal.id, o, b.id);
    db.query("UPDATE labb_analyser SET status = 'makulerad' WHERE bestallning_id = ? AND status <> 'borttagen'").run(b.id);
    historik(db, b, atk.personal.id, 'Makulerad', `${o}${skickade.length ? ' Laboratoriet har fått makuleringen.' : ''}`, iso(nu));
  })();
  return { bestallning: bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu), text: `Beställningen ${b.nummer} är makulerad.${skickade.length ? ' Laboratoriet har fått makuleringen.' : ''}` };
}

// Ändring (Sussa 4.4.2.9): analyser tas bort eller läggs till så länge deras rör inte är taget.
export function andra(atk, b, { taBort = [], laggTill = [], kvitteraDubbletter = false } = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (!kanHandlaPa(atk, b)) throw new Fel(403, 'En beställning ändras av en läkare på den beställande vårdenheten eller av den som registrerade den.', 'nekad');
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  if (!Array.isArray(taBort) || !Array.isArray(laggTill) || (!taBort.length && !laggTill.length)) throw new Fel(400, 'Välj en analys att ta bort eller lägga till.', 'ogiltig');
  const analyser = analyserFor(db, b.id);
  const prov = new Map(provFor(db, b.id).map(p => [p.id, p]));
  const bort = taBort.map(id => analyser.find(a => String(a.id) === String(id)));
  if (bort.some(a => !a || a.status === 'borttagen')) throw new Fel(400, 'Analysen finns inte i beställningen.', 'ogiltig', { falt: ['taBort'] });
  const tagen = bort.find(a => prov.get(a.prov_id)?.provtagen_tid);
  if (tagen) throw new Fel(409, `Röret för ${ANALYS[tagen.analys].namn} är redan taget. Analysen kan inte tas bort, men beställningen kan makuleras innan laboratoriet har svarat.`, 'ogiltig');
  if (bort.length === analyser.filter(a => a.status !== 'borttagen').length && !laggTill.length) throw new Fel(400, 'Alla analyser kan inte tas bort. Makulera beställningen i stället.', 'ogiltig');
  const nya = laggTill.filter(id => iKatalog(ANALYS, id) && !analyser.some(a => a.analys === id && a.status !== 'borttagen'));
  if (laggTill.some(id => !iKatalog(ANALYS, id))) throw new Fel(400, 'Analysen finns inte i katalogen.', 'ogiltig', { falt: ['laggTill'] });
  const dubb = dubbletter(atk, nya, nu);
  if (dubb.size && !kvitteraDubbletter) throw new Fel(409, [...dubb.values()][0].skal, 'dubblett', { dubbletter: [...dubb.values()] });
  db.transaction(() => {
    for (const a of bort) db.query("UPDATE labb_analyser SET status = 'borttagen', borttagen_tid = ?, borttagen_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, a.id);
    for (const p of prov.values()) {
      if (!db.query("SELECT 1 FROM labb_analyser WHERE prov_id = ? AND status <> 'borttagen'").get(p.id)) db.query('UPDATE labb_prov SET borttagen = 1 WHERE id = ?').run(p.id);
    }
    laggIn(db, b, nya.map(id => ({ analys: id, lab: labFor(db, b.enhet_id, ANALYS[id].disciplin).id, planerad: b.planerad })));
    historik(db, b, atk.personal.id, 'Ändrad', [bort.length ? `Borttagen: ${bort.map(a => ANALYS[a.analys].namn).join(', ')}.` : '', nya.length ? `Tillagd: ${nya.map(id => ANALYS[id].namn).join(', ')}.` : '',
      dubb.size ? `Tillagd trots varning för ${[...dubb.values()].map(d => d.namn).join(', ')}.` : ''].filter(Boolean).join(' '), iso(nu));
  })();
  return { bestallning: bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu), text: `Beställningen ${b.nummer} är ändrad.` };
}

// Överlåtelse till en annan remittent (Sussa 4.4.2.3 och 4.4.2.10): en annan läkare blir ansvarig och får svaren att
// vidimera. Den nya läkaren behöver ha en vårdrelation till patienten, och systemet förklarar varför när det saknas.
export function overlat(atk, b, { lakareId, orsak } = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (!kanRoll(atk.personal, 'bestalla_prov')) throw new Fel(403, 'Ansvaret för en beställning överlåts av en läkare.', 'nekad');
  if (atk.personal.id !== b.ansvarig_id && vardenhetFor(db, atk.personal.enhet_id) !== vardenhetFor(db, b.enhet_id)) throw new Fel(403, 'Ansvaret överlåts av den ansvariga läkaren eller av en läkare på den beställande vårdenheten.', 'nekad');
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  const ny = db.query("SELECT * FROM personal WHERE id = ? AND yrke = 'lakare' AND coalesce(aktiv, 1) = 1").get(String(lakareId ?? ''));
  if (!ny) throw new Fel(400, 'Välj en läkare som ska ta över ansvaret.', 'ogiltig', { falt: ['lakareId'] });
  if (ny.id === b.ansvarig_id) throw new Fel(400, `${ny.namn} är redan ansvarig för beställningen.`, 'ogiltig', { falt: ['lakareId'] });
  if (!harVardrelation(db, b.patient_id, vardenhetFor(db, ny.enhet_id), nu)) {
    throw new Fel(400, `${ny.namn} på ${enhetsnamn(db, vardenhetFor(db, ny.enhet_id))} har ingen vårdrelation till patienten och kan därför inte ta emot svaren. Välj en läkare på en vårdenhet som vårdar patienten, eller skicka en remiss först.`, 'ogiltig', { falt: ['lakareId'] });
  }
  const o = textFalt(orsak, 300);
  const forra = personNamn(db, b.ansvarig_id);
  db.query('UPDATE labb_bestallningar SET ansvarig_id = ? WHERE id = ?').run(ny.id, b.id);
  historik(db, b, atk.personal.id, `Ansvaret överlåtet från ${forra} till ${ny.namn}`, o || null, iso(nu));
  return { bestallning: bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu), text: `${ny.namn} är nu ansvarig för ${b.nummer} och får svaren att vidimera.` };
}

// Provtagning (Sussas testfall 3.3): ett klick per rör. Systemet sätter tid och provtagare och skickar proverna när alla
// rör för provtagningstiden är tagna.
export function taProv(atk, prov, nu = new Date()) {
  const db = atk.db;
  const b = bestallningRad(db, prov.bestallning_id);
  atk.krav('ta_prov', { resurs: { enhet_id: b.enhet_id } });
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad. Ta inte provet.', 'ogiltig');
  if (prov.borttagen) throw new Fel(409, 'Röret behövs inte längre, eftersom analyserna är borttagna ur beställningen.', 'ogiltig');
  if (prov.provtagen_tid) throw new Fel(409, `Röret är redan taget ${dagText(prov.provtagen_tid, nu)} av ${personNamn(db, prov.provtagen_av)}.`, 'ogiltig');
  const tid = iso(nu);
  db.query('UPDATE labb_prov SET provtagen_tid = ?, provtagen_av = ? WHERE id = ?').run(tid, atk.personal.id, prov.id);
  db.query("UPDATE labb_analyser SET status = 'provtagen' WHERE prov_id = ? AND status = 'bestalld'").run(prov.id);
  historik(db, b, atk.personal.id, 'Provtagen', `${ROR[prov.ror]?.namn ?? prov.ror}, etikett ${prov.etikett}.`, tid);
  const kvar = provFor(db, b.id).filter(p => !p.provtagen_tid && p.planerad === prov.planerad);
  let skickadeTill = [];
  if (!kvar.length) skickadeTill = skicka(db, b, atk.personal.id, nu, { planerad: prov.planerad });
  const ut = bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu);
  const rorNamn = ROR[prov.ror]?.namn ?? 'Röret';
  return {
    bestallning: ut,
    text: `${rorNamn} är taget.${skickadeTill.length ? ` Alla rör är tagna, och proverna är skickade till ${skickadeTill.join(' och ')}.` : ` ${kvar.length} ${kvar.length === 1 ? 'rör' : 'rör'} kvar.`}`,
    skickad: skickadeTill.length > 0,
  };
}

// Skickar de tagna rören som inte är skickade. Laboratoriet kvitterar mottagandet direkt (simulerat). Returnerar
// laboratoriernas namn.
function skicka(db, b, personalId, nu, { planerad = null } = {}) {
  const tid = iso(nu);
  const rader = provFor(db, b.id).filter(p => p.provtagen_tid && !p.skickad_tid && (!planerad || p.planerad === planerad));
  if (!rader.length) return [];
  const labb = new Set();
  for (const p of rader) {
    db.query('UPDATE labb_prov SET skickad_tid = ? WHERE id = ?').run(tid, p.id);
    db.query("UPDATE labb_analyser SET status = 'mottagen', mottagen_tid = ? WHERE prov_id = ? AND status = 'provtagen'").run(tid, p.id);
    labb.add(LAB[p.lab_id]?.kort ?? p.lab_id);
  }
  historik(db, b, personalId, 'Skickad', `${rader.length} rör till ${[...labb].join(' och ')}. Laboratoriet har kvitterat att proverna har kommit.`, tid);
  return [...labb];
}
// Skickar det som är taget nu, när resten tas senare.
export function skickaTagna(atk, b, nu = new Date()) {
  atk.krav('ta_prov', { resurs: { enhet_id: b.enhet_id } });
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  const till = skicka(atk.db, b, atk.personal.id, nu);
  if (!till.length) throw new Fel(409, 'Det finns inga tagna rör som inte redan är skickade.', 'ogiltig');
  return { bestallning: bestallningUt(atk.db, bestallningRad(atk.db, b.id), atk.personal, nu), text: `De tagna rören är skickade till ${till.join(' och ')}. Övriga rör skickas när de är tagna.` };
}

// ---- Det simulerade laboratoriet ----------------------------------------------------------------------------------

// En liten variation per beställning och analys, så att värdena inte är exakt lika varje gång.
function variation(nyckel) {
  let h = 2166136261;
  for (const c of nyckel) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.12;
}
function profil(db, b) {
  const v = b.vardkontakt_id ? db.query('SELECT orsak FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id) : null;
  // Det som förnekas (ingen feber, utan frossa) räknas inte.
  const text = `${b.anamnes ?? ''} ${v?.orsak ?? ''}`.toLocaleLowerCase('sv').replace(/\b(ingen|inte|utan|ej)\s+\p{L}+/gu, '');
  return /feber|frossa|sepsis|infektion/.test(text) ? 'infektion' : 'normal';
}

// Svarar på en analys. Mätvärdena hamnar bland patientens mätvärden på den beställande vårdenheten, med provtagningens
// tid, vårdkontakten och ingen vidimering än.
function besvara(db, b, a, nu) {
  const def = ANALYS[a.analys];
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(b.patient_id);
  const prov = db.query('SELECT * FROM labb_prov WHERE id = ?').get(a.prov_id);
  const tid = prov?.provtagen_tid ?? b.planerad;
  const demo = b.demo ? JSON.parse(b.demo) : {};
  const pr = profil(db, b);
  const insMv = db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vidimerad, vardkontakt_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)');
  const insSv = db.query('INSERT INTO labb_svar (analys_rad_id, matvarde_id, patient_id, enhet_id) VALUES (?, ?, ?, ?)');
  let avvikande = null, kritisk = 0, text = null, fynd = null;
  if (def.matvarden) {
    let kreatinin = null;
    for (const typ of def.matvarden) {
      let v;
      if (typ === 'egfr') {
        if (kreatinin == null) continue;
        v = ckdEpi2021(kreatinin, alder(p.fodd, datumAv(new Date(tid))), p.kon);
      } else {
        const sv = SVARSVARDEN[typ];
        const bas = demo[typ] ?? (pr === 'infektion' && sv.infektion != null ? sv.infektion : sv.normal);
        v = demo[typ] != null ? bas : bas * (1 + variation(`${b.nummer}:${typ}`));
        v = Number(v.toFixed(sv.decimaler));
        if (typ === 'kreatinin') kreatinin = v;
      }
      const r = Number(insMv.run(b.patient_id, b.enhet_id, typ, String(v), v, MATTYPER_ENHET[typ] ?? null, tid, b.kalla ?? 'vardkallan', b.vardkontakt_id ?? null).lastInsertRowid);
      insSv.run(a.id, r, b.patient_id, b.enhet_id);
      const sv = SVARSVARDEN[typ];
      if (sv && ((sv.kritiskLag != null && v < sv.kritiskLag) || (sv.kritiskHog != null && v > sv.kritiskHog))) kritisk = 1;
    }
  } else if (def.odling) {
    fynd = demo[a.analys] ?? (pr === 'infektion' ? (a.analys === 'urinodling' ? 'e_coli' : 's_aureus') : 'ingen_vaxt');
    text = `${FYND[fynd].text}.${fynd === 'ingen_vaxt' ? ' Slutsvar.' : ' Resistensbestämning följer.'}`;
    if (fynd !== 'ingen_vaxt') { avvikande = 'fynd'; if (a.analys === 'blododling') kritisk = 1; }
  } else if (def.patologi) {
    text = demo.pad ?? 'Hudbiopsi med benign förändring utan atypi. Radikalt exciderad.';
  } else if (def.transfusion) {
    // Runda 9, r3: blodcentralens svar (blod.js). Ett positivt bastest är avvikande och kräver utredning före transfusion.
    if (a.analys === 'blodgruppering') text = `${blodgruppText(demo.blodgrupp ?? blodgruppFor(b.patient_id))}.`;
    else if (demo.bastest === 'positiv') { text = 'Antikroppsscreening positiv. Blodcentralen utreder antikroppen innan blod kan lämnas ut.'; avvikande = 'fynd'; }
    else text = 'Antikroppsscreening negativ.';
  }
  db.query("UPDATE labb_analyser SET status = 'besvarad', besvarad_tid = ?, svar_text = ?, fynd = ?, avvikande = ?, kritisk = ? WHERE id = ?")
    .run(iso(nu), text, fynd, avvikande, kritisk, a.id);
}

// Svarar på det som har legat på laboratoriet längre än svarstiden (parametern labb.svar_minuter). Körs vid varje anrop
// med en sandlåda och när beställningarna läses. Ett fel stoppar aldrig anropet.
const fel = new WeakMap();
export function forfallnaSvar(db, nu = new Date(), { bestallningId = null, alla = false } = {}) {
  if (!finns(db) || fel.get(db) === datumAv(nu)) return 0;
  try {
    const grans = new Date(nu.getTime() - svarMinuter(db, nu) * MIN).toISOString();
    const rader = db.query(`SELECT * FROM labb_analyser WHERE status = 'mottagen' ${alla ? '' : 'AND mottagen_tid <= ?'} ${bestallningId ? 'AND bestallning_id = ?' : ''} ORDER BY id`)
      .all(...[...(alla ? [] : [grans]), ...(bestallningId ? [bestallningId] : [])]);
    if (!rader.length) return 0;
    const perBest = new Map();
    db.transaction(() => {
      for (const a of rader) {
        const b = db.query('SELECT * FROM labb_bestallningar WHERE id = ?').get(a.bestallning_id);
        if (!b || b.makulerad_tid) continue;
        besvara(db, b, a, nu);
        if (!perBest.has(b.id)) perBest.set(b.id, { b, labb: new Set() });
        perBest.get(b.id).labb.add(LAB[a.lab_id]?.kort ?? a.lab_id);
      }
      for (const { b, labb } of perBest.values()) historik(db, b, null, 'Svar från laboratoriet', `${[...labb].join(' och ')}. Svaret väntar på vidimering av ${personNamn(db, b.ansvarig_id)}.`, iso(nu));
    })();
    return rader.length;
  } catch (e) {
    fel.set(db, datumAv(nu));
    console.error('Det simulerade laboratoriet kunde inte svara:', e.message);
    return 0;
  }
}

// Demoknappen: laboratoriet svarar direkt på det som har kommit fram.
export function simuleraSvar(atk, b, nu = new Date()) {
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  const n = forfallnaSvar(atk.db, nu, { bestallningId: b.id, alla: true });
  if (!n) throw new Fel(409, 'Laboratoriet har inget att svara på. Proverna besvaras när de är tagna och skickade.', 'ogiltig');
  return { bestallning: bestallningUt(atk.db, bestallningRad(atk.db, b.id), atk.personal, nu), text: `Laboratoriet har svarat på ${n} ${n === 1 ? 'analys' : 'analyser'} (simulerat).` };
}

// Vidimering (Sussa 4.4.2.13): den ansvariga läkaren vidimerar svaren med ett klick. Mätvärdena blir vidimerade, och
// Min journal visar dem för patienten från och med nu.
export function vidimera(atk, b, nu = new Date()) {
  const db = atk.db;
  atk.krav('vidimera_provsvar', { resurs: { enhet_id: b.enhet_id } });
  if (atk.personal.id !== b.ansvarig_id) throw new Fel(403, `Svaren vidimeras av den ansvariga läkaren, ${personNamn(db, b.ansvarig_id)}. Överlåt ansvaret om någon annan ska vidimera.`, 'nekad');
  const rader = analyserFor(db, b.id).filter(a => a.status === 'besvarad' && !a.vidimerad_tid);
  if (!rader.length) throw new Fel(409, 'Det finns inga svar att vidimera.', 'ogiltig');
  const tid = iso(nu);
  db.transaction(() => {
    for (const a of rader) {
      db.query('UPDATE labb_analyser SET vidimerad_tid = ?, vidimerad_av = ? WHERE id = ?').run(tid, atk.personal.id, a.id);
      db.query('UPDATE matvarden SET vidimerad = ? WHERE id IN (SELECT matvarde_id FROM labb_svar WHERE analys_rad_id = ?)').run(tid, a.id);
    }
    historik(db, b, atk.personal.id, 'Vidimerad', rader.map(a => ANALYS[a.analys]?.namn ?? a.analys).join(', '), tid);
  })();
  return { bestallning: bestallningUt(db, bestallningRad(db, b.id), atk.personal, nu), text: `Svaren på ${b.nummer} är vidimerade.` };
}

// ---- Inkorgen och provtagningslistan ----------------------------------------------------------------------------

// Raderna i inkorgen: svar att vidimera och beställningar att signera för den ansvariga läkaren, och kritiska svar för
// den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten. En rad visas bara när den inloggade får
// läsa beställningen; annars syns ingenting om den.
export function inkorg(db, personal, valFor, nu = new Date()) {
  const ut = { provsvarAttVidimera: [], labbAttSignera: [], provsvarKritiska: [] };
  if (!finns(db) || !kanRoll(personal, 'las_prover')) return ut;
  forfallnaSvar(db, nu);
  const provning = (b) => new Atkomst(db, personal, b.patient_id, valFor(b.patient_id), 'las_prover').prova('las_prover', { enhet_id: b.enhet_id });
  const far = (b) => provning(b).tillaten;
  // En beställning från en annan vårdenhet, som den ansvariga läkaren har fått överlåten, visas utan svaren tills läkaren
  // har gjort ett aktivt val. En spärr visas aldrig.
  const kraverVal = (b) => provning(b).krav === 'kraver_val';
  const kort = (b, rader) => rader.map(a => {
    const svar = svarFor(db, a, db.query('SELECT kon FROM patienter WHERE id = ?').get(b.patient_id)?.kon);
    return {
      namn: ANALYS[a.analys]?.namn ?? a.analys, kritisk: Boolean(a.kritisk),
      text: svar.length ? svar.map(s => `${s.namn} ${tal(s.varde, String(s.varde).includes('.') ? 1 : 0)} ${s.enhet ?? ''}${s.avvikande ? ` (${AVVIKANDE[s.avvikande].toLocaleLowerCase('sv')})` : ''}`.replace(/\s+\(/, ' (').trim()).join(', ') : a.svar_text,
      avvikande: Boolean(a.kritisk || a.avvikande || svar.some(s => s.avvikande)),
    };
  });
  if (kanRoll(personal, 'vidimera_provsvar')) {
    for (const b of db.query('SELECT * FROM labb_bestallningar WHERE ansvarig_id = ? AND makulerad_tid IS NULL ORDER BY skapad').all(personal.id)) {
      const att = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status = 'besvarad' AND vidimerad_tid IS NULL ORDER BY id").all(b.id);
      if (!att.length) continue;
      if (!far(b)) {
        if (kraverVal(b)) {
          ut.provsvarAttVidimera.push({ bestallningId: b.id, nummer: b.nummer, patientId: b.patient_id, besvarad: att.map(a => a.besvarad_tid).sort().at(-1), analyser: [],
            avvikande: false, kritisk: false, kraverVal: true, vardenhet: enhetsnamn(db, b.enhet_id),
            text: `Svaren kommer från ${enhetsnamn(db, b.enhet_id)}. Öppna patienten och gör ett aktivt val för att läsa och vidimera dem.` });
        }
        continue;
      }
      const analyser = kort(b, att);
      ut.provsvarAttVidimera.push({ bestallningId: b.id, nummer: b.nummer, patientId: b.patient_id, besvarad: att.map(a => a.besvarad_tid).sort().at(-1), analyser,
        avvikande: analyser.some(x => x.avvikande), kritisk: analyser.some(x => x.kritisk), vardenhet: enhetsnamn(db, b.enhet_id) });
    }
    for (const b of db.query('SELECT * FROM labb_bestallningar WHERE ansvarig_id = ? AND pa_uppdrag = 1 AND signerad_tid IS NULL AND makulerad_tid IS NULL ORDER BY skapad').all(personal.id)) {
      if (!far(b)) continue;
      ut.labbAttSignera.push({ bestallningId: b.id, nummer: b.nummer, patientId: b.patient_id, skapad: b.skapad, registreradAv: personNamn(db, b.registrerad_av),
        analyser: analyserFor(db, b.id).filter(a => a.status !== 'borttagen').map(a => ANALYS[a.analys]?.namn ?? a.analys) });
    }
    ut.provsvarAttVidimera.sort((x, y) => Number(y.kritisk) - Number(x.kritisk) || Number(y.avvikande) - Number(x.avvikande) || x.besvarad.localeCompare(y.besvarad));
  }
  const minVe = vardenhetFor(db, personal.enhet_id);
  const sjukskoterska = personal.yrke === 'sjukskoterska';
  for (const a of db.query("SELECT a.*, b.ansvarig_id, b.enhet_id AS b_enhet FROM labb_analyser a JOIN labb_bestallningar b ON b.id = a.bestallning_id WHERE a.kritisk = 1 AND a.vidimerad_tid IS NULL AND a.status = 'besvarad' AND b.makulerad_tid IS NULL ORDER BY a.besvarad_tid").all()) {
    const b = bestallningRad(db, a.bestallning_id);
    const mottagare = personal.id === b.ansvarig_id || (sjukskoterska && vardenhetFor(db, b.enhet_id) === minVe);
    if (!mottagare || !far(b)) continue;
    const [x] = kort(b, [a]);
    ut.provsvarKritiska.push({ bestallningId: b.id, nummer: b.nummer, patientId: b.patient_id, besvarad: a.besvarad_tid, analys: x.namn, text: x.text,
      atgard: personal.id === b.ansvarig_id ? 'Bedöm svaret nu och vidimera det.' : `Kontakta ansvarig läkare, ${personNamn(db, b.ansvarig_id)}, om läkaren inte redan har sett svaret.` });
  }
  return ut;
}

// Provtagningslistan för den inloggades vårdenhet en dag: beställningar med rör att ta i dag eller som är försenade, och
// rör som togs i dag. Bara patienter som den inloggade får ta prov på. Rören står i provtagningsordning.
export function provtagningslista(db, personal, valFor, { datum = null } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'ta_prov')) throw new Fel(403, 'Yrkesrollen tar inte prover.', 'nekad');
  const dag = datum ?? datumAv(nu);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const ut = { datum: dag, vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, patienter: [], simulerat: 'Laboratorierna är simulerade.' };
  if (!finns(db)) return ut;
  forfallnaSvar(db, nu);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const slut = lokalTid(addDagar(dag, 1), '00:00');
  const start = lokalTid(dag, '00:00');
  const rader = db.query(`SELECT DISTINCT b.* FROM labb_bestallningar b JOIN labb_prov p ON p.bestallning_id = b.id
      WHERE b.enhet_id IN (${ph}) AND b.makulerad_tid IS NULL AND p.borttagen = 0
      AND ((p.provtagen_tid IS NULL AND p.planerad < ?) OR (p.provtagen_tid >= ? AND p.provtagen_tid < ?)) ORDER BY b.planerad, b.id`).all(...enheter, slut, start, slut);
  const per = new Map();
  for (const b of rader) {
    const atk = new Atkomst(db, personal, b.patient_id, valFor(b.patient_id), 'ta_prov');
    if (!atk.prova('ta_prov', { enhet_id: b.enhet_id }).tillaten) continue;
    if (!per.has(b.patient_id)) per.set(b.patient_id, []);
    per.get(b.patient_id).push(bestallningUt(db, b, personal, nu));
  }
  for (const [pid, lista] of per) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
    const plats = db.query(`SELECT plats FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL ORDER BY start DESC`).get(pid, ...enheter)?.plats ?? null;
    const val = valFor(pid);
    ut.patienter.push({ patient: { id: p.id, namn: visningsnamn(p, val.visa_identitet), personnummer: visningsPnr(p, val.visa_identitet), skyddad: Boolean(p.skyddad) }, plats, bestallningar: lista,
      kvar: lista.reduce((n, b) => n + b.prov.filter(x => !x.provtagen).length, 0) });
  }
  ut.patienter.sort((a, b) => (b.kvar ? 1 : 0) - (a.kvar ? 1 : 0) || String(a.bestallningar[0].planerad).localeCompare(String(b.bestallningar[0].planerad)));
  return ut;
}

// Etiketterna för en beställning (Sussa 4.4.3): ett rör per etikett, med etikett-id som streckkod, beställnings-id,
// analyserna, laboratoriet och patientens identitet. För en patient med skyddade personuppgifter står namn och
// personnummer bara när den inloggade har valt att visa identiteten, och adressen står aldrig på en etikett.
export function etiketter(atk, b, nu = new Date()) {
  const db = atk.db;
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(b.patient_id);
  const visad = Boolean(atk.val?.visa_identitet);
  const u = bestallningUt(db, b, atk.personal, nu);
  return {
    nummer: b.nummer, skyddad: Boolean(p.skyddad && !visad),
    patient: { namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad) },
    etiketter: u.prov.map(x => ({ etikett: x.etikett, ror: x.rorNamn, farg: x.farg, analyser: x.analyser, lab: x.lab?.kort, planerad: x.planerad, provtagen: x.provtagen?.tid ?? null })),
  };
}

// Provtagningsanvisningen: rören i provtagningsordning med vad som ska göras, och förberedelser för patienten.
export function anvisning(atk, b, nu = new Date()) {
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  const u = bestallningUt(atk.db, b, atk.personal, nu);
  const analyser = u.analyser.filter(a => a.status !== 'borttagen' && a.status !== 'makulerad').map(a => a.analys);
  const forbered = [];
  if (analyser.includes('glukos')) forbered.push('P-Glukos tas helst fastande, minst åtta timmar utan mat.');
  if (analyser.includes('urinodling')) forbered.push('U-Odling tas som mittstråleurin, helst morgonurin som har stått i blåsan minst fyra timmar.');
  if (analyser.includes('blododling')) forbered.push('Blododlingen tas före antibiotika, med två flaskor från samma stick.');
  return {
    nummer: b.nummer, planerad: u.planerad,
    steg: u.prov.map((x, i) => ({ nr: i + 1, ror: x.rorNamn, farg: x.farg, beskrivning: x.beskrivning, analyser: x.analyser, lab: x.lab?.kort, etikett: x.etikett })),
    forbered, demoregel: `Provtagningsordningen följer ordningen blododling, citrat, serum, heparin och EDTA. ${DEMOREGEL}`,
  };
}

// Uppföljning av kvalitet och produktion (Sussa 4.4.2.15) för vårdenheten, utan personuppgifter: antal, ledtider och
// andel avvikande och kritiska svar under en period.
export function uppfoljning(db, personal, { dagar = 30 } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'statistik')) throw new Fel(403, 'Yrkesrollen ser inte vårdenhetens statistik.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const ut = { vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, dagar, antal: 0, makulerade: 0, paUppdrag: 0, analyser: 0, avvikande: 0, kritiska: 0, ledtider: {}, perLab: [] };
  if (!finns(db)) return ut;
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const fran = new Date(nu.getTime() - dagar * 24 * TIMME).toISOString();
  const best = db.query(`SELECT * FROM labb_bestallningar WHERE enhet_id IN (${ph}) AND skapad >= ?`).all(...enheter, fran);
  ut.antal = best.length;
  ut.makulerade = best.filter(b => b.makulerad_tid).length;
  ut.paUppdrag = best.filter(b => b.pa_uppdrag).length;
  const median = (v) => { const s = v.filter(x => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const min = (a, b) => (a && b ? (Date.parse(b) - Date.parse(a)) / MIN : NaN);
  const tillProv = [], tillSvar = [], tillVid = [];
  const perLab = new Map();
  for (const b of best) {
    const an = analyserFor(db, b.id).filter(a => a.status !== 'borttagen');
    const prov = provFor(db, b.id);
    ut.analyser += an.length;
    ut.avvikande += an.filter(a => a.status === 'besvarad' && (a.avvikande || db.query('SELECT 1 FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? LIMIT 1').get(a.id) && svarFor(db, a, null).some(s => s.avvikande))).length;
    ut.kritiska += an.filter(a => a.kritisk).length;
    for (const p of prov) if (p.provtagen_tid) tillProv.push(min(p.planerad < b.skapad ? b.skapad : p.planerad, p.provtagen_tid));
    for (const a of an) {
      const p = prov.find(x => x.id === a.prov_id);
      if (a.besvarad_tid && p?.provtagen_tid) tillSvar.push(min(p.provtagen_tid, a.besvarad_tid));
      if (a.vidimerad_tid) tillVid.push(min(a.besvarad_tid, a.vidimerad_tid));
      const l = perLab.get(a.lab_id) ?? { lab: labKort(a.lab_id), analyser: 0, besvarade: 0 };
      l.analyser++;
      if (a.status === 'besvarad') l.besvarade++;
      perLab.set(a.lab_id, l);
    }
  }
  ut.ledtider = { tillProvtagningMin: median(tillProv), tillSvarMin: median(tillSvar), tillVidimeringMin: median(tillVid) };
  ut.perLab = [...perLab.values()];
  ut.text = 'Ledtiderna är medianer i minuter. Uppgifterna är räknade utan personuppgifter.';
  return ut;
}

// Knyter ett provsvar som redan finns bland mätvärdena till en beställning, som när svaret kom från laboratoriet. Används
// av demoläget för Sussas testfall 3.4, där provsvaren är tagna innan beställningen fanns i demon.
export function kopplaBefintligtSvar(db, { matvardeId, analys, ansvarig, bestalld, provtagenAv = null }) {
  sakraLabb(db);
  const m = db.query('SELECT * FROM matvarden WHERE id = ?').get(matvardeId);
  const def = ANALYS[analys];
  const lab = labFor(db, m.enhet_id, def.disciplin).id;
  const r = db.query(`INSERT INTO labb_bestallningar (nummer, patient_id, enhet_id, vardkontakt_id, ansvarig_id, registrerad_av, skapad, planerad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`tmp-${Math.random()}`, m.patient_id, m.enhet_id, m.vardkontakt_id ?? null, ansvarig, ansvarig, bestalld, m.tid);
  const id = Number(r.lastInsertRowid);
  db.query('UPDATE labb_bestallningar SET nummer = ? WHERE id = ?').run(nummerFor(id, bestalld), id);
  const b = bestallningRad(db, id);
  const prov = Number(db.query('INSERT INTO labb_prov (bestallning_id, patient_id, enhet_id, lab_id, ror, planerad, etikett, provtagen_tid, provtagen_av, skickad_tid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, b.patient_id, b.enhet_id, lab, def.ror, m.tid, `tmp-${id}`, m.tid, provtagenAv, m.tid).lastInsertRowid);
  db.query('UPDATE labb_prov SET etikett = ? WHERE id = ?').run(etikettFor(prov), prov);
  const besvarad = new Date(Date.parse(m.tid) + 60 * MIN).toISOString();
  const a = Number(db.query(`INSERT INTO labb_analyser (bestallning_id, patient_id, enhet_id, analys, lab_id, prov_id, status, mottagen_tid, besvarad_tid, vidimerad_tid, vidimerad_av)
    VALUES (?, ?, ?, ?, ?, ?, 'besvarad', ?, ?, ?, ?)`).run(id, b.patient_id, b.enhet_id, analys, lab, prov, m.tid, besvarad, m.vidimerad ?? null, m.vidimerad ? ansvarig : null).lastInsertRowid);
  db.query('INSERT INTO labb_svar (analys_rad_id, matvarde_id, patient_id, enhet_id) VALUES (?, ?, ?, ?)').run(a, m.id, b.patient_id, b.enhet_id);
  historik(db, b, ansvarig, 'Beställd', def.namn, bestalld);
  historik(db, b, null, 'Svar från laboratoriet', LAB[lab].kort, besvarad);
  if (m.vidimerad) historik(db, b, ansvarig, 'Vidimerad', def.namn, m.vidimerad);
  return b;
}

// Observationens koppling till beställningen, för FHIR (basedOn och tolkning) och mätvärdestabellen (beställd av).
export function svarKoppling(db, matvardeId) {
  if (!finns(db)) return null;
  const r = db.query(`SELECT a.id AS analys_id, a.analys, b.id AS bestallning_id, b.nummer, b.ansvarig_id FROM labb_svar s
    JOIN labb_analyser a ON a.id = s.analys_rad_id JOIN labb_bestallningar b ON b.id = a.bestallning_id WHERE s.matvarde_id = ?`).get(matvardeId);
  return r ? { analysId: r.analys_id, analys: r.analys, bestallningId: r.bestallning_id, nummer: r.nummer, bestalldAv: personNamn(db, r.ansvarig_id) } : null;
}
