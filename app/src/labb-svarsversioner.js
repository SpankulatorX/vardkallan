// Rättade svar, koder i svaren och vem som har läst ett svar (runda 11, r6, Sussa 4.4.2.11 och 4.4.2.13).
//
// Ett laboratorium eller en röntgenklinik kan skicka ett rättat svar på en analys som redan är besvarad. Den tidigare
// versionen sparas oförändrad med sina värden, sin text och sin vidimering, och det rättade svaret ersätter den i
// journalen: mätvärdet får det rättade värdet, så att kurvor, beslutsstöd och Min journal aldrig visar ett svar som
// laboratoriet har dragit tillbaka. Det rättade svaret ska vidimeras på nytt.
//
// Systemet är experten:
//   - Det minns vem som har läst varje version av ett svar. Den som läste den tidigare versionen får det rättade svaret i
//     inkorgen med vad som ändrades, så att ingen fortsätter att arbeta efter ett svar som inte gäller.
//   - Koderna i svaret (åtgärden i KVÅ, fyndet i Snomed CT och det standardiserade vårdförloppet) visas som text, så att
//     ingen behöver kunna kodverken.
// Varje version har sitt eget signerade bevis (signering.js), med källan labb_analyser:<id>:v<n>.
import { Fel, iso } from './db.js';
import { kanRoll, Atkomst } from './atkomst.js';
import * as labb from './labb.js';
import * as journal from './journal.js';
import * as signering from './signering.js';
import { ANALYS, LAB, FYND } from './labb-katalog.js';
import { KVA, SYSTEM } from './kodverk.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS labb_svarsinfo (
  analys_rad_id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, koder TEXT NOT NULL DEFAULT '[]', instrument TEXT, studie_id INTEGER, studie_uid TEXT
);
CREATE TABLE IF NOT EXISTS labb_svarsversioner (
  id INTEGER PRIMARY KEY, analys_rad_id INTEGER NOT NULL, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  version INTEGER NOT NULL, mottagen TEXT, innehall TEXT NOT NULL, koder TEXT NOT NULL DEFAULT '[]', vidimerad_tid TEXT, vidimerad_av TEXT,
  ersatt_tid TEXT NOT NULL, orsak TEXT, kalla TEXT NOT NULL,
  UNIQUE (analys_rad_id, version)
);
CREATE TRIGGER IF NOT EXISTS labb_svarsversioner_andras_ej BEFORE UPDATE OF analys_rad_id, version, mottagen, innehall, koder, vidimerad_tid, vidimerad_av, ersatt_tid, orsak ON labb_svarsversioner
  BEGIN SELECT RAISE(ABORT, 'En tidigare version av ett svar ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS labb_svarsversioner_raderas_ej BEFORE DELETE ON labb_svarsversioner
  BEGIN SELECT RAISE(ABORT, 'En tidigare version av ett svar raderas inte.'); END;
CREATE TABLE IF NOT EXISTS labb_lasningar (
  analys_rad_id INTEGER NOT NULL, personal_id TEXT NOT NULL, version INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  kvitterad_tid TEXT, PRIMARY KEY (analys_rad_id, personal_id, version)
);
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { labb.sakraLabb(db); db.exec(SCHEMA); har.add(db); } }
const finns = (db) => har.has(db) || Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'labb_svarsinfo'").get() && (har.add(db), true));

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
export const SNOMED = 'http://snomed.info/sct';
// Fynden i undersökningarnas utlåtanden i Snomed CT, kontrollerade mot tx.fhir.org 2026-11-10 (docs/kodkontroll.md).
export const UTLATANDE_FYND = Object.freeze(Object.assign(Object.create(null), {
  281900007: { display: 'No abnormality detected', text: 'Inga avvikande fynd' },
  309529002: { display: 'Lung mass', text: 'Förändring i lungan' },
}));
export const KODSYSTEM = { kva: 'KVÅ', snomed: 'Snomed CT', svf: 'Standardiserat vårdförlopp (KVÅ)' };

export function info(db, analysId) {
  if (!finns(db)) return null;
  return db.query('SELECT * FROM labb_svarsinfo WHERE analys_rad_id = ?').get(analysId) ?? null;
}
const koderFor = (db, a) => JSON.parse(info(db, a.id)?.koder ?? '[]');

// Kontrollerar koderna i ett svar från ett specialistsystem. En KVÅ-kod har två eller tre bokstäver och tre eller två
// siffror. Texten är avsändarens, och systemet använder sin egen text när koden finns i Vårdkällans utdrag ur KVÅ.
export function provaKoder(lista) {
  if (lista == null) return [];
  if (!Array.isArray(lista) || lista.length > 10) throw new Fel(400, 'Skicka högst tio koder i svaret.', 'ogiltig');
  return lista.map((k) => {
    const system = String(k?.system ?? '');
    const kod = String(k?.kod ?? '').trim();
    if (!['kva', 'snomed', 'svf'].includes(system)) throw new Fel(400, 'En kod i svaret har ett okänt kodverk. Använd KVÅ, Snomed CT eller standardiserat vårdförlopp.', 'ogiltig');
    if (system === 'snomed' ? !/^\d{6,18}$/.test(kod) : !/^([A-Z]{2}\d{3}|[A-Z]{3}\d{2})$/.test(kod)) throw new Fel(400, `Koden ${kod.slice(0, 20)} har inte formen för ${KODSYSTEM[system]}.`, 'ogiltig');
    const text = (system === 'snomed' ? UTLATANDE_FYND[kod]?.text : KVA[kod]) ?? (typeof k.text === 'string' ? k.text.trim().slice(0, 200) : '');
    if (!text) throw new Fel(400, `Koden ${kod} behöver en beskrivning, eftersom den inte finns i Vårdkällans kodverk.`, 'ogiltig');
    return { system, kod, text, kand: system === 'snomed' ? Boolean(UTLATANDE_FYND[kod]) : Object.hasOwn(KVA, kod) };
  });
}

// Sparar koderna och studien för ett svar. Körs efter registreraSvar (labb.KROKAR.efterSvar).
export function sparaInfo(db, b, a, { koder = null, instrument = null, studieId = null, studieUid = null } = {}) {
  sakra(db);
  const forra = info(db, a.id);
  db.query(`INSERT INTO labb_svarsinfo (analys_rad_id, bestallning_id, patient_id, enhet_id, koder, instrument, studie_id, studie_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (analys_rad_id) DO UPDATE SET koder = coalesce(excluded.koder, koder), instrument = coalesce(excluded.instrument, instrument),
      studie_id = coalesce(excluded.studie_id, studie_id), studie_uid = coalesce(excluded.studie_uid, studie_uid)`)
    .run(a.id, b.id, b.patient_id, b.enhet_id, koder ? JSON.stringify(koder) : forra?.koder ?? '[]', instrument, studieId, studieUid);
}

// ---- Läsmarkering --------------------------------------------------------------------------------------------------

const versionFor = (db, a) => info(db, a.id)?.version ?? 1;
// Den inloggade har läst svaren i beställningen som den visas. Körs när personalen öppnar fliken Prover, efter
// behörighetsmotorn, och bara för besvarade analyser.
export function markeraLast(db, personal, b, nu = new Date()) {
  sakra(db);
  const ins = db.query('INSERT OR IGNORE INTO labb_lasningar (analys_rad_id, personal_id, version, patient_id, enhet_id, tid) VALUES (?, ?, ?, ?, ?, ?)');
  for (const a of db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status = 'besvarad'").all(b.id)) ins.run(a.id, personal.id, versionFor(db, a), b.patient_id, b.enhet_id, iso(nu));
}

// Rättade svar för den inloggade: den har läst en tidigare version men inte den rättade. Raden visas bara när den
// inloggade får läsa beställningen nu.
export function rattadeForPersonal(db, personal, valFor) {
  if (!finns(db) || !kanRoll(personal, 'las_prover')) return [];
  const rader = db.query(`SELECT l.analys_rad_id, max(l.version) AS last, i.version FROM labb_lasningar l JOIN labb_svarsinfo i ON i.analys_rad_id = l.analys_rad_id
    WHERE l.personal_id = ? GROUP BY l.analys_rad_id HAVING max(l.version) < i.version`).all(personal.id);
  const ut = [];
  for (const r of rader) {
    const a = db.query('SELECT * FROM labb_analyser WHERE id = ?').get(r.analys_rad_id);
    const b = a && db.query('SELECT * FROM labb_bestallningar WHERE id = ?').get(a.bestallning_id);
    if (!b) continue;
    if (db.query('SELECT 1 FROM labb_lasningar WHERE analys_rad_id = ? AND personal_id = ? AND kvitterad_tid IS NOT NULL AND version = ?').get(a.id, personal.id, r.last)) continue;
    if (!new Atkomst(db, personal, b.patient_id, valFor(b.patient_id), 'las_prover').prova('las_prover', { enhet_id: b.enhet_id }).tillaten) continue;
    const v = db.query('SELECT * FROM labb_svarsversioner WHERE analys_rad_id = ? AND version = ?').get(a.id, r.last);
    ut.push({ bestallningId: b.id, analysId: a.id, nummer: b.nummer, patientId: b.patient_id, analys: ANALYS[a.analys]?.namn ?? a.analys, lastVersion: r.last, version: r.version,
      rattad: a.besvarad_tid, orsak: v?.orsak ?? null, text: `Du läste version ${r.last}. ${skillnad(db, a, v)}` });
  }
  return ut;
}
// Den inloggade har sett det rättade svaret och kvitterar raden i inkorgen.
export function kvitteraLast(atk, a, nu = new Date()) {
  sakra(atk.db);
  const b = labb.bestallningRad(atk.db, a.bestallning_id);
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  atk.db.query('UPDATE labb_lasningar SET kvitterad_tid = ? WHERE analys_rad_id = ? AND personal_id = ? AND kvitterad_tid IS NULL').run(iso(nu), a.id, atk.personal.id);
  markeraLast(atk.db, atk.personal, b, nu);
  return { text: 'Du har läst det rättade svaret.' };
}

// ---- Versioner ----------------------------------------------------------------------------------------------------

function nuvarandeInnehall(db, a, b) {
  const prov = db.query('SELECT provtagen_tid FROM labb_prov WHERE id = ?').get(a.prov_id);
  const varden = db.query('SELECT m.typ, m.varde_num, m.matt_enhet FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? ORDER BY s.id').all(a.id)
    .map(m => ({ typ: m.typ, varde: m.varde_num, enhet: m.matt_enhet }));
  return { bestallning: b.nummer, analysRad: a.id, analys: a.analys, lab: a.lab_id, provtagen: prov?.provtagen_tid ?? b.planerad, varden, text: a.svar_text, fynd: a.fynd, avvikande: a.avvikande, kritisk: a.kritisk };
}
const text = (x) => {
  const v = (x.varden ?? []).map(m => `${journal.MATTYPER[m.typ]?.namn ?? m.typ} ${String(m.varde).replace('.', ',')} ${m.enhet ?? ''}`.trim());
  return [...v, x.text].filter(Boolean).join(', ');
};
function skillnad(db, a, v) {
  if (!v) return 'Svaret är rättat.';
  const forra = JSON.parse(v.innehall);
  return `Tidigare: ${text(forra) || 'inget svar'}. Nu: ${text(nuvarandeInnehall(db, a, labb.bestallningRad(db, a.bestallning_id))) || 'inget svar'}.`;
}

// Svaret för signaturens bevis: en tidigare version ur versionstabellen, den nuvarande ur journalen. null när det inte
// gäller den här modulen (svaret har bara en version och ingen version efterfrågas).
export function innehallFor(db, analysId, version) {
  if (!finns(db)) return null;
  const i = info(db, analysId);
  const n = version ? Number(String(version).replace(/^v/, '')) : 1;
  if (!i || i.version === 1) return version && n !== 1 ? undefined : null;
  if (n === i.version) {
    const a = db.query("SELECT * FROM labb_analyser WHERE id = ? AND status = 'besvarad'").get(analysId);
    return a ? nuvarandeInnehall(db, a, labb.bestallningRad(db, a.bestallning_id)) : undefined;
  }
  const v = db.query('SELECT innehall FROM labb_svarsversioner WHERE analys_rad_id = ? AND version = ?').get(analysId, n);
  return v ? JSON.parse(v.innehall) : undefined;
}

// Ett rättat svar. svar har varden, text, fynd, avvikande och kritisk som från laboratoriet, och koder. Värdena ska
// gälla samma mätvärden som förut. Den tidigare versionen sparas, mätvärdena får de rättade värdena och vidimeringen
// tas bort, så att den ansvariga läkaren vidimerar på nytt. kalla är vägen svaret kom (det simulerade laboratoriet
// eller producentsystemet).
export function ratta(db, b, a, svar, { orsak = '', kalla = 'simulerat', signerat = false } = {}, nu = new Date()) {
  sakra(db);
  if (a.status !== 'besvarad') throw new Fel(409, 'Analysen är inte besvarad än. Skicka svaret som ett vanligt svar.', 'ogiltig');
  if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  const o = typeof orsak === 'string' ? orsak.trim().slice(0, 300) : '';
  if (o.length < 3) throw new Fel(400, 'Ange varför svaret rättas. Orsaken visas för den som läste det tidigare svaret.', 'ogiltig');
  const mv = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? ORDER BY s.id').all(a.id);
  for (const v of svar.varden ?? []) if (!mv.some(m => m.typ === v.typ)) throw new Fel(400, `Det rättade svaret har ett värde för ${v.typ}, som det tidigare svaret inte hade.`, 'ogiltig');
  if (mv.length && mv.some(m => !(svar.varden ?? []).some(v => v.typ === m.typ))) throw new Fel(400, 'Det rättade svaret ska ha alla värden som det tidigare svaret hade.', 'ogiltig');
  const forra = nuvarandeInnehall(db, a, b);
  const i = info(db, a.id);
  const version = (i?.version ?? 1);
  db.transaction(() => {
    db.query(`INSERT INTO labb_svarsversioner (analys_rad_id, bestallning_id, patient_id, enhet_id, version, mottagen, innehall, koder, vidimerad_tid, vidimerad_av, ersatt_tid, orsak, kalla)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(a.id, b.id, b.patient_id, b.enhet_id, version, a.besvarad_tid, JSON.stringify(forra), i?.koder ?? '[]', a.vidimerad_tid, a.vidimerad_av, iso(nu), o, kalla);
    for (const v of svar.varden ?? []) {
      const m = mv.find(x => x.typ === v.typ);
      db.query('UPDATE matvarden SET varde = ?, varde_num = ?, vidimerad = NULL WHERE id = ?').run(String(v.varde), v.varde, m.id);
    }
    db.query('UPDATE labb_analyser SET besvarad_tid = ?, svar_text = ?, fynd = ?, avvikande = ?, kritisk = ?, vidimerad_tid = NULL, vidimerad_av = NULL WHERE id = ?')
      .run(iso(nu), svar.text ?? null, svar.fynd ?? null, svar.avvikande ?? null, svar.kritisk ? 1 : 0, a.id);
    sparaInfo(db, b, a, { koder: svar.koder ?? null });
    db.query('UPDATE labb_svarsinfo SET version = ? WHERE analys_rad_id = ?').run(version + 1, a.id);
    labb.historikRad(db, b, null, 'Rättat svar', `${LAB[a.lab_id]?.kort ?? a.lab_id}: ${ANALYS[a.analys]?.namn ?? a.analys}. ${o} Version ${version + 1} ersätter version ${version}. Svaret väntar på ny vidimering av ${personNamn(db, b.ansvarig_id)}.`, iso(nu));
  })();
  // Det simulerade laboratoriet signerar den rättade versionen, som det första svaret.
  if (signerat) {
    const innehall = nuvarandeInnehall(db, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), b);
    const meddelande = signering.signera('labb', { typ: 'labbsvar', mottagare: 'vardkallan', innehall, nu });
    signering.taEmot(db, { typ: 'labbsvar', kalla: `labb_analyser:${a.id}:v${version + 1}`, enhetId: b.enhet_id, meddelande, innehall, nu });
  }
  return { version: version + 1, text: `Svaret på ${ANALYS[a.analys]?.namn ?? a.analys} är rättat. Den tidigare versionen finns kvar, och den som har läst den får det rättade svaret i inkorgen.` };
}

// Det simulerade laboratoriets rättelse (demoknapp): ett nytt värde för det första mätvärdet, eller en rättad text.
export function simuleraRattelse(atk, b, a, nu = new Date()) {
  const db = atk.db;
  atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
  if (a.bestallning_id !== b.id) throw new Fel(404, 'Analysen finns inte i beställningen.', 'saknas');
  const mv = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? ORDER BY s.id').all(a.id);
  const varden = mv.map((m, i) => ({ typ: m.typ, varde: i === 0 ? Number((m.varde_num * 1.1).toFixed(String(m.varde_num).includes('.') ? 1 : 0)) || m.varde_num + 1 : m.varde_num, enhet: m.matt_enhet }));
  const t = a.svar_text ? `${a.svar_text} Tillägg efter eftergranskning: fyndet är oförändrat jämfört med tidigare undersökning.` : null;
  return ratta(db, b, a, { varden, text: t, fynd: a.fynd, avvikande: a.avvikande, kritisk: a.kritisk }, { orsak: mv.length ? 'Fel kalibrering av analysinstrumentet. Analysen är gjord om.' : 'Utlåtandet är eftergranskat och kompletterat.', kalla: 'simulerat', signerat: true }, nu);
}

// För beställningen som den visas: versionen, de tidigare versionerna, koderna och om den inloggade läste en äldre
// version. Körs i labb.KROKAR.bestallningUt.
export function utoka(db, b, ut, personal) {
  if (!finns(db)) return;
  for (const x of ut.analyser) {
    const i = info(db, x.id);
    if (!i) continue;
    x.version = i.version;
    x.koder = JSON.parse(i.koder).map(k => ({ ...k, systemText: KODSYSTEM[k.system] }));
    if (i.instrument) x.instrument = i.instrument;
    if (i.studie_uid) x.studie = { id: i.studie_id, uid: i.studie_uid, lank: i.studie_id ? `/api/media/studie/${i.studie_id}/visa` : null };
    if (i.version > 1) {
      x.tidigare = db.query('SELECT * FROM labb_svarsversioner WHERE analys_rad_id = ? ORDER BY version DESC').all(x.id).map(v => {
        const inn = JSON.parse(v.innehall);
        return { version: v.version, mottagen: v.mottagen, ersatt: v.ersatt_tid, orsak: v.orsak, text: text(inn), vidimerad: v.vidimerad_tid ? { tid: v.vidimerad_tid, av: personNamn(db, v.vidimerad_av) } : null };
      });
      if (personal) {
        const last = db.query('SELECT max(version) AS v FROM labb_lasningar WHERE analys_rad_id = ? AND personal_id = ?').get(x.id, personal.id)?.v;
        if (last && last < i.version) x.lastAldre = { version: last, text: `Du läste version ${last} av svaret. Det är rättat, se vad som ändrades nedan.` };
      }
    }
  }
}
export const KODSYSTEM_FHIR = { kva: SYSTEM.kva, svf: SYSTEM.kva, snomed: SNOMED };
export { FYND };
