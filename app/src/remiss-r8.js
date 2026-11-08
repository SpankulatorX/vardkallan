// Remiss, del 3 (runda 8, r2, Sussa 3.3.1.2 till 3.3.1.5 och Sussas testfall 2.2 till 2.5): remiss på uppdrag,
// fördelning till en namngiven läkare, remisskonferens med beslut på uppdrag och extern pappersremiss.
//
// Systemet är experten:
//   - På uppdrag: vårdadministratören skriver remissen, systemet föreslår uppdragsgivaren ur patientens tider och
//     vårdkontakter på vårdenheten och fyller i prioritet och sista svarsdatum. Remissen skickas först när läkaren har
//     signerat den i inkorgen, med läkaren som avsändare. Vid signeringen föreslår systemet att lägga till läkarens
//     egen anteckning om patienten, som den som skrev remissen aldrig ser.
//   - Fördelning: systemet föreslår bakjouren (överläkaren i demon) först och visar hur många remisser varje läkare
//     redan har att bedöma. Mottagningen kvitteras av systemet. Den namngivna läkaren får remissen i inkorgen.
//   - Remisskonferens: systemet väljer nästa konferens (demoregel: tisdagar och torsdagar klockan 8) och kvitterar
//     mottagningen. Läkarna bedömer remisserna i följd med ett klick per beslut och med den tidsram som systemet
//     föreslår ur prioriteten. Vårdadministratören kan registrera de beslut som läkarna har fattat, med läkaren som
//     ansvarig, men ser ingen journaltext.
//   - Pappersremiss: den inskannade remissen finns redan i listan över inskannade dokument. Patienten hittas på namn
//     eller nummer, avsändaren kan väljas ur den simulerade HSA-katalogen eller skrivas som fritext och remissdatumet är
//     förvalt till i dag. Remissen går in i samma flöde som andra inkommande, men ger ingen vårdrelation förrän den tas
//     emot (beslut 2026-11-08). Svaret skickas med post, och systemet kvitterar det.
import { createHash } from 'node:crypto';
import { Fel, iso, idag, addDagar, giltigtDatum, lokalTid, datumAv } from './db.js';
import { Atkomst, vardenhetFor, kanRoll, enheterUnder } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as remiss from './remiss.js';
import { sparaBilaga } from './remiss-r4.js';
import { arStangd } from './omorganisation.js';
import { pdf } from './filformat.js';
import { EXTERN_ENHET } from './seed/planering.js';

// Avsändaren av en remiss från en vårdgivare utanför Vårdkällan, som en enhet utan vårdenhet (som Min journal).
export const EXTERN = EXTERN_ENHET.id;
export const EXTERN_NAMN = EXTERN_ENHET.namn;
export const SVAR_POST = 'Svaret skrivs ut och skickas med post till remittenten. Utskicket är simulerat i demon.';
// Demoregel: bakjouren är överläkaren på vårdenheten.
export const BAKJOUR_TITEL = 'Överläkare';
export const KONFERENSDAGAR = [2, 4];
export const KONFERENSTID = '08:00';
export const KONFERENS_TEXT = 'Remisskonferens tisdagar och torsdagar klockan 8.00 (demoregel).';
// Tidsramarna för besöket när en remiss accepteras. Förvalet räknas ur prioriteten, med vårdgarantin som ram för normal.
export const TIDSRAMAR = [
  { dagar: 14, text: 'inom två veckor' }, { dagar: 30, text: 'inom en månad' }, { dagar: 60, text: 'inom två månader' },
  { dagar: 90, text: 'inom tre månader' }, { dagar: 180, text: 'inom sex månader' },
];
export const forvaldTidsram = (prioritet) => ({ akut: 14, skyndsam: 30 }[prioritet] ?? 90);

// Den simulerade HSA-katalogen: påhittade enheter utanför Vårdkällan. Behandlingshemmet Löparen kommer från Sussas
// testdata (Bilaga F1:4, testfall 2.5), där det också är påhittat.
export const HSA_KATALOG = [
  { hsaId: 'SE-DEMO-HSA-0001', namn: 'Behandlingshemmet Löparen', vardgivare: 'Påhittat behandlingshem i Sussas testdata' },
  { hsaId: 'SE-DEMO-HSA-0002', namn: 'Läkarhuset Ekbacken', vardgivare: 'Påhittad privat vårdgivare i demon' },
  { hsaId: 'SE-DEMO-HSA-0003', namn: 'Företagshälsovården Norra', vardgivare: 'Påhittad företagshälsovård i demon' },
  { hsaId: 'SE-DEMO-HSA-0004', namn: 'Hjärtmottagningen i grannregionen', vardgivare: 'Påhittad region i demon' },
];

export const SCHEMA_REMISS_R8 = `
CREATE TABLE IF NOT EXISTS remiss_pa_uppdrag (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, skriven_av TEXT NOT NULL, uppdragsgivare_id TEXT NOT NULL,
  till_enhet_id TEXT NOT NULL, fragestallning TEXT NOT NULL, anamnes TEXT, prioritet TEXT NOT NULL, svar_senast TEXT NOT NULL,
  skapad TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vantar_signering', signerad_tid TEXT, remiss_id INTEGER, avslutad_av TEXT, avslutad_tid TEXT,
  CHECK (status IN ('vantar_signering', 'signerad', 'aterkallad'))
);
CREATE TABLE IF NOT EXISTS remiss_fordelningar (id INTEGER PRIMARY KEY, remiss_id INTEGER NOT NULL, lakare_id TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS remisskonferenser (id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, skapad TEXT NOT NULL, UNIQUE (enhet_id, tid));
CREATE TABLE IF NOT EXISTS remisskonferens_remisser (remiss_id INTEGER PRIMARY KEY, konferens_id INTEGER NOT NULL, lagd_av TEXT NOT NULL, lagd_tid TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS remiss_beslut_pa_uppdrag (remiss_id INTEGER PRIMARY KEY, registrerad_av TEXT NOT NULL, ansvarig_id TEXT NOT NULL, tid TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS remiss_extern (
  remiss_id INTEGER PRIMARY KEY, enhet TEXT NOT NULL, vardgivare TEXT, hsa_id TEXT, remittent TEXT, remissdatum TEXT NOT NULL,
  registrerad_av TEXT NOT NULL, registrerad_tid TEXT NOT NULL, skanning_id INTEGER
);
CREATE TABLE IF NOT EXISTS skannade_remisser (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, namn TEXT NOT NULL, typ TEXT NOT NULL, storlek INTEGER NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL,
  inskannad TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ny', remiss_id INTEGER, registrerad_av TEXT, CHECK (status IN ('ny', 'registrerad'))
);
CREATE TRIGGER IF NOT EXISTS skannad_remiss_andras_ej BEFORE UPDATE OF data, namn, typ, sha256 ON skannade_remisser BEGIN SELECT RAISE(ABORT, 'En inskannad remiss ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS skannad_remiss_raderas_ej BEFORE DELETE ON skannade_remisser BEGIN SELECT RAISE(ABORT, 'En inskannad remiss raderas inte'); END;
`;

export function laggTillSkanning(db, enhetId, namn, rader, nu = new Date()) {
  const data = pdf(rader.map((text, i) => ({ text, fet: i === 0, storlek: i === 0 ? 14 : 11 })), { titel: namn });
  return Number(db.query('INSERT INTO skannade_remisser (enhet_id, namn, typ, storlek, sha256, data, inskannad) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(enhetId, namn, 'application/pdf', data.length, createHash('sha256').update(data).digest('hex'), data, nu.toISOString()).lastInsertRowid);
}

export function sakraRemissR8(db) {
  db.exec(SCHEMA_REMISS_R8);
  db.query('INSERT OR IGNORE INTO enheter (id, hsa_id, namn, kortnamn, typ, forald_id) VALUES (?, ?, ?, ?, ?, NULL)').run(EXTERN_ENHET.id, EXTERN_ENHET.hsa, EXTERN_ENHET.namn, EXTERN_ENHET.kortnamn, EXTERN_ENHET.typ);
  // En inskannad pappersremiss väntar på kardiologen, en gång per sandlåda.
  if (!db.query('SELECT 1 FROM skannade_remisser LIMIT 1').get() && db.query("SELECT 1 FROM enheter WHERE id = 'uso-kard'").get()) {
    laggTillSkanning(db, 'uso-kard', 'Inskannad pappersremiss.pdf', ['Remiss (pappersremiss, inskannad)', 'Påhittad remiss i demon. Inga riktiga personuppgifter.', 'Till: Kardiologiska kliniken USÖ']);
  }
}
const harTabeller = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'remiss_extern'").get());

const person = (db, id) => (id ? { id, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id } : null);
const enhet = (db, id) => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id });
const minVe = (atk) => vardenhetFor(atk.db, atk.personal.enhet_id);
const klinisk = (personal) => kanRoll(personal, 'las_remiss');
const ogiltig = (text, falt) => new Fel(400, text, 'ogiltig', falt ? { falt: [falt] } : undefined);

// Aktiva läkare på en vårdenhet, som kan vara uppdragsgivare, få en remiss fördelad eller vara ansvarig för ett beslut.
export function lakareVid(db, ve) {
  return db.query("SELECT id, namn, titel, enhet_id FROM personal WHERE yrke = 'lakare' AND aktiv = 1 ORDER BY namn").all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve);
}

// Det som remissUt (remiss.js) visar utöver statuskedjan och del 2.
export function remissTillagg(db, r, kliniskt) {
  if (!harTabeller(db)) return {};
  const u = db.query('SELECT skriven_av, skapad FROM remiss_pa_uppdrag WHERE remiss_id = ?').get(r.id);
  const f = db.query('SELECT * FROM remiss_fordelningar WHERE remiss_id = ? ORDER BY id DESC LIMIT 1').get(r.id);
  const k = ['skickad', 'mottagen'].includes(r.status) ? db.query('SELECT k.id, k.tid FROM remisskonferens_remisser x JOIN remisskonferenser k ON k.id = x.konferens_id WHERE x.remiss_id = ?').get(r.id) : null;
  const b = db.query('SELECT * FROM remiss_beslut_pa_uppdrag WHERE remiss_id = ?').get(r.id);
  const e = db.query('SELECT * FROM remiss_extern WHERE remiss_id = ?').get(r.id);
  const ut = {
    paUppdrag: u ? { skrivenAv: person(db, u.skriven_av), skriven: u.skapad } : null,
    fordelad: f ? { lakare: person(db, f.lakare_id), av: person(db, f.av), tid: f.tid } : null,
    konferens: k ? { id: k.id, tid: k.tid } : null,
    beslutPaUppdrag: b ? { registreradAv: person(db, b.registrerad_av), ansvarig: person(db, b.ansvarig_id), tid: b.tid } : null,
    extern: e ? {
      enhet: e.enhet, vardgivare: e.vardgivare, hsaId: e.hsa_id, remittent: e.remittent, remissdatum: e.remissdatum, registreradAv: person(db, e.registrerad_av), registrerad: e.registrerad_tid,
      svarText: ['besvarad', 'svar_kvitterat'].includes(r.status) && r.svar ? SVAR_POST : null,
    } : null,
  };
  if (e) Object.assign(ut, { fran: { id: EXTERN, namn: e.enhet }, avsandare: { id: null, namn: e.remittent || 'Remittent anges inte' } });
  return ut;
}

// FHIR (fhir.js): en extern remiss har remittenten och enheten som avsändare, och en fördelad remiss läkaren som utförare.
export function fhirTillagg(db, r) {
  if (!harTabeller(db)) return {};
  const ut = {};
  const e = db.query('SELECT * FROM remiss_extern WHERE remiss_id = ?').get(r.id);
  if (e) ut.requester = { display: [e.remittent, e.enhet].filter(Boolean).join(', '), ...(e.hsa_id ? { identifier: { system: 'urn:oid:1.2.752.29.4.19', value: e.hsa_id } } : {}) };
  const f = db.query('SELECT lakare_id FROM remiss_fordelningar WHERE remiss_id = ? ORDER BY id DESC LIMIT 1').get(r.id);
  if (f) ut.performerLakare = { reference: `Practitioner/${f.lakare_id}`, display: person(db, f.lakare_id).namn };
  return ut;
}

// En extern pappersremiss ger ingen vårdrelation förrän någon annan än den som registrerade den har tagit emot den
// (atkomst.js). Den som registrerade remissen får därför aldrig ta emot den, fördela den, sätta den på konferens eller
// registrera ett beslut om den. Den som tar emot den gör det på grund av remissen, som är ställd till vårdenheten (det
// prövar remiss.js och kravMottagare här), med de handlingar rollen har. Prövningen av patienten i övrigt gäller som
// vanligt: inget av svaren visar något mer än remissens status.
const ejMottagenExtern = (r) => r.fran_enhet_id === EXTERN && r.status === 'skickad';
const registrerare = (db, r) => (r.fran_enhet_id === EXTERN ? db.query('SELECT registrerad_av FROM remiss_extern WHERE remiss_id = ?').get(r.id)?.registrerad_av ?? null : null);
function nekad(atk, r, handling, text) {
  atk.logga(handling, 'nekad', `remiss:${r.id}`, 'nekad');
  return new Fel(403, text, 'nekad');
}
export function kravPaRemiss(atk, r, handling) {
  if (r.fran_enhet_id === EXTERN && registrerare(atk.db, r) === atk.personal.id) {
    throw nekad(atk, r, handling, 'Du registrerade pappersremissen. Någon annan på vårdenheten tar emot och handlägger den, så att ingen ger sig själv åtkomst till en patient genom en remiss.');
  }
  if (!ejMottagenExtern(r)) return atk.krav(handling);
  // Mottagningen: rollen ska ha både handlingen och mottagningen, eftersom fördelning och konferens kvitterar remissen.
  for (const h of new Set([handling, 'mottag_remiss'])) if (!kanRoll(atk.personal, h)) throw nekad(atk, r, handling, 'Din yrkesroll får inte göra det med remissen.');
  atk.grunder.add('administrativ');
  return { tillaten: true, grund: 'administrativ' };
}
export const kravMottag = (atk, r) => kravPaRemiss(atk, r, 'mottag_remiss');

// Registreringen av en pappersremiss: en handling med patient, som loggas på patienten och kräver rollen, men ingen
// vårdrelation. Den ger ingen läsrätt, och svaret visar bara den nya remissens status, med skyddad identitet maskerad.
function kravRegistrering(atk) {
  if (!kanRoll(atk.personal, 'registrera_extern_remiss')) {
    atk.logga('registrera_extern_remiss', 'nekad', 'extern_remiss', 'nekad');
    throw new Fel(403, 'Din yrkesroll registrerar inte pappersremisser.', 'nekad');
  }
  atk.grunder.add('administrativ');
}

function kravMottagare(atk, r, handling) {
  if (minVe(atk) !== r.till_enhet_id) {
    atk.logga(handling, 'nekad', `remiss:${r.id}`, 'nekad');
    throw new Fel(403, 'Remissen är inte ställd till din vårdenhet.', 'nekad');
  }
}
// Systemet kvitterar mottagningen när en remiss fördelas, sätts på konferens eller får ett beslut på uppdrag.
function kvittera(db, r, av, nu = iso()) {
  if (r.status === 'skickad') db.query("UPDATE remisser SET status = 'mottagen', mottagen_tid = ?, mottagen_av = ? WHERE id = ?").run(nu, av, r.id);
}
const utFor = (atk, id) => remiss.remissUt(atk.db, remiss.hamtaRad(atk.db, id), { klinisk: klinisk(atk.personal) });

// ---------------------------------------------------------------------------------------------------------------
// Tidsram när en remiss accepteras

export function sattTidsram(db, vantelista, body = {}) {
  const t = TIDSRAMAR.find(x => x.dagar === Number(body?.besokInomDagar));
  if (!t || !vantelista?.id) return vantelista;
  db.query('UPDATE vantelista SET mal = ? WHERE id = ?').run(addDagar(idag(), t.dagar), vantelista.id);
  return { ...vantelista, besokInomDagar: t.dagar, text: `${vantelista.text} Besöket ska ske ${t.text}.` };
}

// ---------------------------------------------------------------------------------------------------------------
// Remiss på uppdrag

// Förslaget på uppdragsgivare: den läkare patienten har en tid hos på vårdenheten, annars den läkare som registrerade
// den senaste vårdkontakten, som bedömde eller fick en remiss fördelad, och sist den läkare den inloggade skrev för
// senast. Inget av det är journaltext.
function forvaldUppdragsgivare(db, pid, ve, skrivenAv, lakare, nu = new Date()) {
  const ids = new Set(lakare.map(l => l.id));
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const t = nu.getTime();
  const tider = db.query(`SELECT s.personal_id AS id, t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE b.patient_id = ? AND b.status IN ('bokad', 'incheckad') AND s.enhet_id IN (${ph})`).all(pid, ...enheter).filter(x => ids.has(x.id))
    .sort((a, b) => Math.abs(Date.parse(a.start) - t) - Math.abs(Date.parse(b.start) - t));
  if (tider.length) return { id: tider[0].id, skal: 'Patienten har en tid hos läkaren på vårdenheten.' };
  const vk = db.query(`SELECT skapad_av AS id FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND skapad_av IS NOT NULL ORDER BY start DESC`).all(pid, ...enheter).find(x => ids.has(x.id));
  if (vk) return { id: vk.id, skal: 'Läkaren registrerade patientens senaste vårdkontakt på vårdenheten.' };
  const rem = db.query('SELECT bedomd_av AS id FROM remisser WHERE patient_id = ? AND till_enhet_id = ? AND bedomd_av IS NOT NULL ORDER BY bedomd_tid DESC').all(pid, ve).find(x => ids.has(x.id))
    ?? db.query('SELECT f.lakare_id AS id FROM remiss_fordelningar f JOIN remisser r ON r.id = f.remiss_id WHERE r.patient_id = ? AND r.till_enhet_id = ? ORDER BY f.id DESC').all(pid, ve).find(x => ids.has(x.id));
  if (rem) return { id: rem.id, skal: 'Läkaren har bedömt en remiss om patienten på vårdenheten.' };
  const egen = db.query('SELECT uppdragsgivare_id AS id FROM remiss_pa_uppdrag WHERE skriven_av = ? ORDER BY id DESC').all(skrivenAv).find(x => ids.has(x.id));
  if (egen) return { id: egen.id, skal: 'Du skrev senast en remiss på uppdrag av läkaren.' };
  return null;
}

export function uppdragForslag(atk, nu = new Date()) {
  atk.krav('remittera_pa_uppdrag');
  const db = atk.db;
  const ve = minVe(atk);
  const lakare = lakareVid(db, ve);
  const f = forvaldUppdragsgivare(db, atk.patientId, ve, atk.personal.id, lakare, nu);
  return {
    uppdragsgivare: lakare.map(l => ({ id: l.id, namn: l.namn, titel: l.titel, forvald: l.id === f?.id, skal: l.id === f?.id ? f.skal : null }))
      .sort((a, b) => Number(b.forvald) - Number(a.forvald)),
    prioritet: 'normal', svarSenast: addDagar(idag(), 14),
    text: 'Remissen skickas när läkaren har signerat den i sin inkorg. Läkaren står som remittent.',
  };
}

function uppdragUt(db, u, { visaText = false, forslag = null } = {}) {
  return {
    id: u.id, status: u.status, patientId: u.patient_id, uppdragsgivare: person(db, u.uppdragsgivare_id), skrivenAv: person(db, u.skriven_av),
    fran: enhet(db, u.enhet_id), till: enhet(db, u.till_enhet_id), prioritet: u.prioritet, svarSenast: u.svar_senast, skapad: u.skapad,
    signerad: u.signerad_tid, remissId: u.remiss_id ?? null, avslutad: u.avslutad_tid ? { tid: u.avslutad_tid, av: person(db, u.avslutad_av) } : null,
    fragestallning: visaText ? u.fragestallning : null, anamnes: visaText ? (u.anamnes ?? '') : null, forslag: visaText ? forslag : null,
  };
}

function validera(db, atk, body) {
  const falt = [];
  const ve = minVe(atk);
  const lakare = lakareVid(db, ve);
  if (!lakare.some(l => l.id === body?.uppdragsgivareId)) throw ogiltig('Välj den läkare på vårdenheten som remissen skrivs på uppdrag av.', 'uppdragsgivareId');
  const till = typeof body?.tillEnhetId === 'string' ? db.query("SELECT * FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(body.tillEnhetId) : null;
  if (!till || till.id === ve) falt.push('tillEnhetId');
  if (till && arStangd(db, till.id)) throw ogiltig(`${till.namn} är stängd sedan en omorganisation.`, 'tillEnhetId');
  const fragestallning = typeof body?.fragestallning === 'string' ? body.fragestallning.trim() : '';
  if (fragestallning.length < 3 || fragestallning.length > 2000) falt.push('fragestallning');
  const prioritet = body?.prioritet ?? 'normal';
  if (!remiss.PRIORITETER.includes(prioritet)) falt.push('prioritet');
  const svarSenast = body?.svarSenast ?? addDagar(idag(), 14);
  if (!giltigtDatum(svarSenast) || svarSenast < idag()) falt.push('svarSenast');
  if (falt.length) throw new Fel(400, 'Kontrollera mottagare, frågeställning, prioritet och sista svarsdatum.', 'ogiltig', { falt });
  return { till: till.id, fragestallning, anamnes: typeof body?.anamnes === 'string' ? body.anamnes.trim().slice(0, 8000) : '', prioritet, svarSenast, uppdragsgivare: body.uppdragsgivareId };
}

export function skapaUppdrag(atk, body = {}) {
  atk.krav('remittera_pa_uppdrag');
  const db = atk.db;
  const v = validera(db, atk, body);
  const id = Number(db.query(`INSERT INTO remiss_pa_uppdrag (patient_id, enhet_id, skriven_av, uppdragsgivare_id, till_enhet_id, fragestallning, anamnes, prioritet, svar_senast, skapad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, minVe(atk), atk.personal.id, v.uppdragsgivare, v.till, v.fragestallning, v.anamnes, v.prioritet, v.svarSenast, iso()).lastInsertRowid);
  atk.logga('remittera_pa_uppdrag', atk.grund(), `remiss_pa_uppdrag:${id}`);
  return [201, uppdragUt(db, db.query('SELECT * FROM remiss_pa_uppdrag WHERE id = ?').get(id))];
}

// Raden för den som skrev remissen eller den läkare den är skriven för. Andra får samma svar som när den inte finns.
export function uppdragRad(db, personal, id) {
  const u = db.query('SELECT * FROM remiss_pa_uppdrag WHERE id = ?').get(Number(id));
  if (!u || (u.skriven_av !== personal?.id && u.uppdragsgivare_id !== personal?.id)) throw new Fel(404, 'Remissen finns inte.', 'saknas');
  return u;
}
export const uppdragHandling = (personal, u) => (u.uppdragsgivare_id === personal.id ? 'remittera' : 'remittera_pa_uppdrag');

// Läkarens egen senaste signerade anteckning om patienten på vårdenheten, som förslag till anamnesen.
function forslagUrAnteckning(atk, u) {
  const db = atk.db;
  const enheter = enheterUnder(db, u.enhet_id);
  const ph = enheter.map(() => '?').join(', ');
  const a = db.query(`SELECT * FROM anteckningar WHERE patient_id = ? AND forfattare_id = ? AND status = 'signerad' AND kategori = 'lakare' AND enhet_id IN (${ph}) ORDER BY skapad DESC LIMIT 1`)
    .get(u.patient_id, u.uppdragsgivare_id, ...enheter);
  if (!a || !atk.prova('las_journal', { enhet_id: a.enhet_id }).tillaten) return null;
  let sokord = [];
  try { sokord = JSON.parse(a.sokord); } catch { /* ingen text */ }
  const text = sokord.filter(s => s?.text && s.sokord !== 'Kontaktorsak').map(s => `${s.sokord}: ${String(s.text).trim()}`).join(' ').slice(0, 2000);
  return text ? { anteckningId: a.id, text, kalla: `${a.typ} ${datumAv(new Date(a.skapad))}` } : null;
}

export function visaUppdrag(atk, u) {
  const lakaren = u.uppdragsgivare_id === atk.personal.id;
  atk.krav(lakaren ? 'las_remiss' : 'remittera_pa_uppdrag');
  atk.logga(lakaren ? 'las_remiss' : 'remittera_pa_uppdrag', atk.grund(), `remiss_pa_uppdrag:${u.id}`);
  return uppdragUt(atk.db, u, { visaText: lakaren, forslag: lakaren && u.status === 'vantar_signering' ? forslagUrAnteckning(atk, u) : null });
}

export function uppdragForPatient(atk) {
  const db = atk.db;
  const lakaren = !kanRoll(atk.personal, 'remittera_pa_uppdrag');
  atk.krav(lakaren ? 'las_remiss' : 'remittera_pa_uppdrag');
  const kol = lakaren ? 'uppdragsgivare_id' : 'skriven_av';
  return { uppdrag: db.query(`SELECT * FROM remiss_pa_uppdrag WHERE patient_id = ? AND ${kol} = ? AND status = 'vantar_signering' ORDER BY id DESC`).all(atk.patientId, atk.personal.id).map(u => uppdragUt(db, u, { visaText: lakaren })) };
}

export function signera(atk, u, body = {}, { knyt = (x) => x } = {}) {
  if (u.uppdragsgivare_id !== atk.personal.id) throw new Fel(404, 'Remissen finns inte.', 'saknas');
  atk.krav('remittera');
  const db = atk.db;
  if (u.status !== 'vantar_signering') throw ogiltig(u.status === 'signerad' ? 'Remissen är redan signerad och skickad.' : 'Remissen är tillbakatagen.');
  const f = body?.medAnteckning ? forslagUrAnteckning(atk, u) : null;
  const anamnes = [u.anamnes, f ? `Ur ${f.kalla}: ${f.text}` : null].filter(Boolean).join('\n\n');
  const ut = knyt(remiss.skapa(atk, { tillEnhetId: u.till_enhet_id, fragestallning: u.fragestallning, anamnes, prioritet: u.prioritet, svarSenast: u.svar_senast }));
  db.query("UPDATE remiss_pa_uppdrag SET status = 'signerad', signerad_tid = ?, remiss_id = ? WHERE id = ?").run(iso(), ut.id, u.id);
  atk.logga('remittera', atk.grund(), `remiss_pa_uppdrag:${u.id}:signerad:${ut.id}`);
  return [201, { ...remiss.remissUt(db, remiss.hamtaRad(db, ut.id)), ...(ut.vardkontakt ? { vardkontakt: ut.vardkontakt } : {}) }];
}

export function taTillbaka(atk, u) {
  atk.krav(uppdragHandling(atk.personal, u) === 'remittera' ? 'remittera' : 'remittera_pa_uppdrag');
  if (u.status !== 'vantar_signering') throw ogiltig('Remissen är redan signerad eller tillbakatagen.');
  atk.db.query("UPDATE remiss_pa_uppdrag SET status = 'aterkallad', avslutad_av = ?, avslutad_tid = ? WHERE id = ?").run(atk.personal.id, iso(), u.id);
  atk.logga(uppdragHandling(atk.personal, u), atk.grund(), `remiss_pa_uppdrag:${u.id}:aterkallad`);
  return uppdragUt(atk.db, atk.db.query('SELECT * FROM remiss_pa_uppdrag WHERE id = ?').get(u.id));
}

// ---------------------------------------------------------------------------------------------------------------
// Fördelning till en namngiven läkare

const attBedoma = (db, lakareId) => db.query(`SELECT count(*) AS n FROM remisser r WHERE r.status IN ('skickad', 'mottagen')
  AND (SELECT lakare_id FROM remiss_fordelningar f WHERE f.remiss_id = r.id ORDER BY f.id DESC LIMIT 1) = ?`).get(lakareId).n;

function kravOppen(r, text) {
  if (!['skickad', 'mottagen'].includes(r.status)) throw ogiltig(text ?? 'Remissen är redan bedömd.');
}

export function fordelningsForslag(atk, r) {
  kravMottagare(atk, r, 'fordela_remiss');
  kravPaRemiss(atk, r, 'fordela_remiss');
  kravOppen(r);
  const db = atk.db;
  const lakare = lakareVid(db, minVe(atk)).map(l => {
    const n = attBedoma(db, l.id);
    const bakjour = l.titel === BAKJOUR_TITEL;
    return { id: l.id, namn: l.namn, titel: l.titel, attBedoma: n, bakjour, skal: `${bakjour ? 'Bakjour, bedömer inkommande remisser (demoregel: överläkaren). ' : ''}${n === 1 ? '1 remiss' : `${n} remisser`} att bedöma.` };
  }).sort((a, b) => Number(b.bakjour) - Number(a.bakjour) || a.attBedoma - b.attBedoma || a.namn.localeCompare(b.namn, 'sv'));
  if (lakare.length) lakare[0].forvald = true;
  atk.logga('fordela_remiss', atk.grund(), `remiss:${r.id}:fordelning`);
  return { lakare };
}

export function fordela(atk, r, body = {}) {
  kravMottagare(atk, r, 'fordela_remiss');
  kravPaRemiss(atk, r, 'fordela_remiss');
  kravOppen(r, 'Remissen är redan bedömd och kan inte fördelas.');
  const db = atk.db;
  const lak = lakareVid(db, minVe(atk)).find(l => l.id === body?.lakareId);
  if (!lak) throw ogiltig('Välj en läkare på vårdenheten.', 'lakareId');
  const nu = iso();
  kvittera(db, r, atk.personal.id, nu);
  db.query('INSERT INTO remiss_fordelningar (remiss_id, lakare_id, av, tid) VALUES (?, ?, ?, ?)').run(r.id, lak.id, atk.personal.id, nu);
  atk.logga('fordela_remiss', atk.grund(), `remiss:${r.id}:fordelad:${lak.id}`);
  return utFor(atk, r.id);
}

// ---------------------------------------------------------------------------------------------------------------
// Remisskonferens

// Nästa konferens efter nu (demoregel: tisdagar och torsdagar klockan 8 svensk tid), som ISO-tid.
export function nastaKonferens(nu = new Date()) {
  const dag = datumAv(nu);
  for (let i = 0; i < 9; i++) {
    const d = addDagar(dag, i);
    if (!KONFERENSDAGAR.includes(new Date(`${d}T12:00:00Z`).getUTCDay())) continue;
    const t = lokalTid(d, KONFERENSTID);
    if (Date.parse(t) > nu.getTime()) return t;
  }
  return lokalTid(addDagar(dag, 7), KONFERENSTID);
}

export function tillKonferens(atk, r, nu = new Date()) {
  kravMottagare(atk, r, 'remisskonferens');
  kravPaRemiss(atk, r, 'remisskonferens');
  kravOppen(r, 'Remissen är redan bedömd.');
  const db = atk.db;
  const pa = db.query('SELECT k.tid FROM remisskonferens_remisser x JOIN remisskonferenser k ON k.id = x.konferens_id WHERE x.remiss_id = ?').get(r.id);
  if (pa) throw ogiltig('Remissen står redan på remisskonferensen.');
  const ve = minVe(atk);
  const tid = nastaKonferens(nu);
  db.query('INSERT OR IGNORE INTO remisskonferenser (enhet_id, tid, skapad) VALUES (?, ?, ?)').run(ve, tid, iso());
  const k = db.query('SELECT id FROM remisskonferenser WHERE enhet_id = ? AND tid = ?').get(ve, tid);
  kvittera(db, r, atk.personal.id);
  db.query('INSERT INTO remisskonferens_remisser (remiss_id, konferens_id, lagd_av, lagd_tid) VALUES (?, ?, ?, ?)').run(r.id, k.id, atk.personal.id, iso());
  atk.logga('remisskonferens', atk.grund(), `remiss:${r.id}:remisskonferens:${k.id}`);
  return utFor(atk, r.id);
}

export function taBortFranKonferens(atk, r) {
  kravMottagare(atk, r, 'remisskonferens');
  kravPaRemiss(atk, r, 'remisskonferens');
  const db = atk.db;
  if (!db.query('SELECT 1 FROM remisskonferens_remisser WHERE remiss_id = ?').get(r.id)) throw ogiltig('Remissen står inte på någon remisskonferens.');
  db.query('DELETE FROM remisskonferens_remisser WHERE remiss_id = ?').run(r.id);
  atk.logga('remisskonferens', atk.grund(), `remiss:${r.id}:remisskonferens:borttagen`);
  return utFor(atk, r.id);
}

// Remisserna på vårdenhetens konferenser som inte är bedömda, i ordning efter konferens, prioritet och ankomst. Varje rad
// visar en patient och loggas på patienten en gång per session och remiss.
export function konferensLista(db, personal, { nu = new Date(), loggade = new Set() } = {}) {
  if (!kanRoll(personal, 'remisskonferens') && !kanRoll(personal, 'bedom_remiss')) throw new Fel(403, 'Din yrkesroll deltar inte i remisskonferenser.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const prio = { akut: 0, skyndsam: 1, normal: 2 };
  const rader = db.query(`SELECT r.*, k.id AS konferens_id, k.tid AS konferens_tid FROM remisskonferens_remisser x JOIN remisskonferenser k ON k.id = x.konferens_id
    JOIN remisser r ON r.id = x.remiss_id WHERE k.enhet_id = ? AND r.status IN ('skickad', 'mottagen')`).all(ve)
    .sort((a, b) => a.konferens_tid.localeCompare(b.konferens_tid) || (prio[a.prioritet] ?? 3) - (prio[b.prioritet] ?? 3) || a.skickad_tid.localeCompare(b.skickad_tid));
  const kl = klinisk(personal);
  const remisser = rader.map(r => {
    const resurs = `remisskonferens:${r.konferens_id}:remiss:${r.id}`;
    const handling = kl ? 'las_remiss' : 'las_remiss_status';
    if (!loggade.has(resurs)) {
      loggade.add(resurs);
      const a = new Atkomst(db, personal, r.patient_id, {}, handling);
      const g = a.prova(handling);
      a.logga(handling, g.tillaten ? g.grund : 'administrativ', resurs);
    }
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    return { ...remiss.remissUt(db, r, { klinisk: kl, patient: p }), forvaldTidsram: forvaldTidsram(r.prioritet) };
  });
  const nasta = nastaKonferens(nu);
  return {
    konferens: { tid: nasta, text: KONFERENS_TEXT }, remisser, tidsramar: TIDSRAMAR,
    lakare: kanRoll(personal, 'registrera_beslut_pa_uppdrag') ? lakareVid(db, ve).map(l => ({ id: l.id, namn: l.namn, titel: l.titel })) : [],
    kanRegistreraPaUppdrag: kanRoll(personal, 'registrera_beslut_pa_uppdrag'),
  };
}

// Beslut som en läkare har fattat, registrerat av vårdadministratören med läkaren som ansvarig. Accepteras remissen
// hamnar patienten på väntelistan som när läkaren själv accepterar. En avvisning görs inte på uppdrag när patienten har
// en bokad tid på vårdenheten, eftersom avvisningen då kan avboka tider och vårdhändelser som läkaren behöver ta
// ställning till själv (remissavvisning.js).
export function beslutPaUppdrag(atk, r, body = {}, { efterBedomning, efterAvvisning }) {
  kravMottagare(atk, r, 'registrera_beslut_pa_uppdrag');
  kravPaRemiss(atk, r, 'registrera_beslut_pa_uppdrag');
  kravOppen(r);
  const db = atk.db;
  const ve = minVe(atk);
  const ansvarig = lakareVid(db, ve).find(l => l.id === body?.ansvarigId);
  if (!ansvarig) throw ogiltig('Välj den läkare som har fattat beslutet. Läkaren står som ansvarig.', 'ansvarigId');
  if (!['accepterad', 'avvisad'].includes(body?.beslut)) throw ogiltig('Beslutet måste vara accepterad eller avvisad.', 'beslut');
  const motivering = typeof body.motivering === 'string' ? body.motivering.trim().slice(0, 2000) : '';
  if (body.beslut === 'avvisad' && motivering.length < 3) throw ogiltig('Skriv läkarens motivering till avvisningen. Remittenten ser den.', 'motivering');
  if (body.beslut === 'avvisad') {
    const enheter = enheterUnder(db, ve);
    const bokad = db.query(`SELECT 1 FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE b.patient_id = ? AND b.status = 'bokad' AND s.enhet_id IN (${enheter.map(() => '?').join(', ')})`).get(r.patient_id, ...enheter);
    if (bokad) throw ogiltig('Patienten har en bokad tid på vårdenheten. Läkaren avvisar remissen själv, så att systemet kan visa vad som avbokas.', 'beslut');
  }
  const nu = iso();
  kvittera(db, r, atk.personal.id, nu);
  db.query("UPDATE remisser SET status = 'bedomd', bedomd_tid = ?, bedomd_av = ?, beslut = ?, motivering = ? WHERE id = ?").run(nu, ansvarig.id, body.beslut, motivering || null, r.id);
  db.query('INSERT OR REPLACE INTO remiss_beslut_pa_uppdrag (remiss_id, registrerad_av, ansvarig_id, tid) VALUES (?, ?, ?, ?)').run(r.id, atk.personal.id, ansvarig.id, nu);
  const rad = remiss.hamtaRad(db, r.id);
  const ut = utFor(atk, r.id);
  if (body.beslut === 'accepterad') ut.vantelista = sattTidsram(db, efterBedomning(db, rad, body), { besokInomDagar: body.besokInomDagar ?? forvaldTidsram(r.prioritet) });
  else ut.avbokade = efterAvvisning(db, rad, atk.personal);
  atk.logga('registrera_beslut_pa_uppdrag', atk.grund(), `remiss:${r.id}:${body.beslut}:pa_uppdrag:${ansvarig.id}`);
  return ut;
}

// ---------------------------------------------------------------------------------------------------------------
// Extern pappersremiss

export function hsaSok(q) {
  const s = String(q ?? '').trim().toLocaleLowerCase('sv-SE').slice(0, 60);
  return { simulerad: true, text: 'HSA-katalogen är simulerad i demon. Enheterna är påhittade.', enheter: HSA_KATALOG.filter(e => !s || `${e.namn} ${e.vardgivare}`.toLocaleLowerCase('sv-SE').includes(s)) };
}

const kravRegistrera = (personal) => {
  if (!kanRoll(personal, 'registrera_extern_remiss')) throw new Fel(403, 'Din yrkesroll registrerar inte pappersremisser.', 'nekad');
};

export function skannadeLista(db, personal) {
  kravRegistrera(personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  return { dokument: db.query("SELECT id, namn, typ, storlek, inskannad FROM skannade_remisser WHERE enhet_id = ? AND status = 'ny' ORDER BY inskannad, id").all(ve) };
}

function skannadRad(db, personal, id) {
  const s = db.query('SELECT * FROM skannade_remisser WHERE id = ?').get(Number(id));
  if (!s || s.enhet_id !== vardenhetFor(db, personal.enhet_id)) throw new Fel(404, 'Den inskannade remissen finns inte.', 'saknas');
  return s;
}

// Den inskannade remissen som fil, för den som registrerar. Den är inte knuten till någon patient än. Hämtningen loggas.
export function skannadFil(db, personal, id) {
  kravRegistrera(personal);
  const s = skannadRad(db, personal, id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: null, handling: 'registrera_extern_remiss', resurs: `skannad_remiss:${s.id}`, grund: 'administrativ' });
  return new Response(s.data, { headers: {
    'Content-Type': s.typ, 'Content-Disposition': `inline; filename="skannad-remiss-${s.id}.pdf"`,
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'no-store',
  } });
}

export function registreraExtern(atk, body = {}, nu = new Date()) {
  kravRegistrering(atk);
  const db = atk.db;
  const ve = minVe(atk);
  // Den inskannade remissen krävs. Den är underlaget för registreringen och blir remissens bilaga.
  if (body.skanningId == null || body.skanningId === '') throw ogiltig('Välj den inskannade remissen som registreringen gäller.', 'skanningId');
  const skann = skannadRad(db, atk.personal, body.skanningId);
  if (skann.status !== 'ny') throw ogiltig('Den inskannade remissen är redan registrerad.', 'skanningId');
  const falt = [];
  const namn = typeof body.enhet === 'string' ? body.enhet.trim().slice(0, 120) : '';
  if (namn.length < 2) falt.push('enhet');
  const remissdatum = body.remissdatum ?? datumAv(nu);
  if (!giltigtDatum(remissdatum) || remissdatum > datumAv(nu) || remissdatum < '2000-01-01') falt.push('remissdatum');
  const fragestallning = typeof body.fragestallning === 'string' ? body.fragestallning.trim() : '';
  if (fragestallning.length < 3 || fragestallning.length > 2000) falt.push('fragestallning');
  const prioritet = body.prioritet ?? 'normal';
  if (!remiss.PRIORITETER.includes(prioritet)) falt.push('prioritet');
  if (falt.length) throw new Fel(400, 'Kontrollera avsändande enhet, remissdatum, frågeställning och den inskannade remissen. Remissdatumet kan inte ligga i framtiden.', 'ogiltig', { falt });
  const hsa = HSA_KATALOG.find(e => e.namn.toLocaleLowerCase('sv-SE') === namn.toLocaleLowerCase('sv-SE')) ?? null;
  const anamnes = typeof body.anamnes === 'string' ? body.anamnes.trim().slice(0, 8000) : '';
  const remittent = typeof body.remittent === 'string' ? body.remittent.trim().slice(0, 120) : '';
  const t = iso(nu);
  const id = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?)`).run(atk.patientId, EXTERN, ve, EXTERN, fragestallning, anamnes, prioritet, addDagar(datumAv(nu), 14), t).lastInsertRowid);
  db.query('INSERT INTO remiss_extern (remiss_id, enhet, vardgivare, hsa_id, remittent, remissdatum, registrerad_av, registrerad_tid, skanning_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, hsa?.namn ?? namn, hsa?.vardgivare ?? null, hsa?.hsaId ?? null, remittent || null, remissdatum, atk.personal.id, t, skann.id);
  sparaBilaga(db, { remissId: id, patientId: atk.patientId, bilaga: { namn: skann.namn, typ: skann.typ, buf: Buffer.from(skann.data) }, av: atk.personal.id });
  db.query("UPDATE skannade_remisser SET status = 'registrerad', remiss_id = ?, registrerad_av = ? WHERE id = ?").run(id, atk.personal.id, skann.id);
  atk.logga('registrera_extern_remiss', atk.grund(), `remiss:${id}:extern`);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  return [201, remiss.remissUt(db, remiss.hamtaRad(db, id), { klinisk: klinisk(atk.personal), patient: p })];
}

// En vidarebefordrad extern remiss behåller avsändaren (remiss-r4.js).
export function kopieraExtern(db, franId, tillId) {
  if (!harTabeller(db)) return;
  const e = db.query('SELECT * FROM remiss_extern WHERE remiss_id = ?').get(franId);
  if (e) db.query('INSERT INTO remiss_extern (remiss_id, enhet, vardgivare, hsa_id, remittent, remissdatum, registrerad_av, registrerad_tid, skanning_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(tillId, e.enhet, e.vardgivare, e.hsa_id, e.remittent, e.remissdatum, e.registrerad_av, e.registrerad_tid, e.skanning_id);
}

// ---------------------------------------------------------------------------------------------------------------
// Inkorgen: remisser att signera (på uppdrag) och remisser att bedöma (fördelade till läkaren). Varje rad visar en
// patient och loggas på patienten en gång per session och rad.

export function inkorg(c, patientKort, patientRad) {
  const p = c.personal;
  const db = c.db;
  if (!harTabeller(db) || p?.yrke !== 'lakare') return { remisserAttSignera: [], remisserAttBedoma: [] };
  const loggade = (c.s.remissR8Loggad ??= new Set());
  const far = (pid) => new Atkomst(db, p, pid, {}, 'las_remiss').prova('las_remiss');
  const med = (pid, resurs, rad) => {
    const r = far(pid);
    if (!r.tillaten) return null;
    if (!loggade.has(resurs)) { loggade.add(resurs); new Atkomst(db, p, pid, {}, 'las_remiss').logga('las_remiss', r.grund, resurs); }
    return { ...rad, patientId: pid, patient: patientKort(patientRad(db, pid)) };
  };
  const signera = db.query("SELECT * FROM remiss_pa_uppdrag WHERE uppdragsgivare_id = ? AND status = 'vantar_signering' ORDER BY skapad").all(p.id)
    .map(u => med(u.patient_id, `inkorg:remiss_pa_uppdrag:${u.id}`, { id: u.id, till: enhet(db, u.till_enhet_id), fragestallning: u.fragestallning, skrivenAv: person(db, u.skriven_av), skapad: u.skapad, prioritet: u.prioritet }))
    .filter(Boolean);
  const bedoma = db.query(`SELECT r.*, f.av AS f_av, f.tid AS f_tid FROM remisser r JOIN remiss_fordelningar f ON f.remiss_id = r.id
    WHERE f.id = (SELECT max(id) FROM remiss_fordelningar WHERE remiss_id = r.id) AND f.lakare_id = ? AND r.status IN ('skickad', 'mottagen') ORDER BY f.tid`).all(p.id)
    .map(r => med(r.patient_id, `inkorg:fordelad_remiss:${r.id}`, { id: r.id, fran: remissTillagg(db, r, true).fran ?? enhet(db, r.fran_enhet_id), prioritet: r.prioritet, svarSenast: r.svar_senast, fragestallning: r.fragestallning, fordelad: { av: person(db, r.f_av), tid: r.f_tid } }))
    .filter(Boolean);
  return { remisserAttSignera: signera, remisserAttBedoma: bedoma };
}

// ---------------------------------------------------------------------------------------------------------------
// API

export function registreraRutter({ rutt, kravInloggad, medPatient, efterBedomning, efterAvvisning, knyt }) {
  const medRemiss = (c, id, handling, fn) => { kravInloggad(c); const r = remiss.hamtaRad(c.db, id); return medPatient(c, r.patient_id, handling, (atk) => fn(atk, r)); };
  const medUppdrag = (c, id, fn) => {
    const p = kravInloggad(c);
    const u = uppdragRad(c.db, p, id);
    return medPatient(c, u.patient_id, uppdragHandling(p, u), (atk) => fn(atk, u));
  };
  // Remiss på uppdrag.
  rutt('GET', '/api/patient/:id/remiss-pa-uppdrag/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'remittera_pa_uppdrag', (atk) => uppdragForslag(atk)); });
  rutt('GET', '/api/patient/:id/remiss-pa-uppdrag', (c, id) => {
    const p = kravInloggad(c);
    return medPatient(c, id, kanRoll(p, 'remittera_pa_uppdrag') ? 'remittera_pa_uppdrag' : 'las_remiss', (atk) => uppdragForPatient(atk));
  });
  rutt('POST', '/api/patient/:id/remiss-pa-uppdrag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'remittera_pa_uppdrag', (atk) => skapaUppdrag(atk, c.body)); });
  rutt('GET', '/api/remiss-pa-uppdrag/:id', (c, id) => medUppdrag(c, id, (atk, u) => visaUppdrag(atk, u)));
  rutt('POST', '/api/remiss-pa-uppdrag/:id/signera', (c, id) => medUppdrag(c, id, (atk, u) => signera(atk, u, c.body, { knyt: (ut) => knyt(atk, ut, c.body) })));
  rutt('POST', '/api/remiss-pa-uppdrag/:id/ta-tillbaka', (c, id) => medUppdrag(c, id, (atk, u) => taTillbaka(atk, u)));
  // Fördelning och remisskonferens.
  rutt('GET', '/api/remiss/:id/fordelning', (c, id) => medRemiss(c, id, 'fordela_remiss', (atk, r) => fordelningsForslag(atk, r)));
  rutt('POST', '/api/remiss/:id/fordela', (c, id) => medRemiss(c, id, 'fordela_remiss', (atk, r) => fordela(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/remisskonferens', (c, id) => medRemiss(c, id, 'remisskonferens', (atk, r) => tillKonferens(atk, r)));
  rutt('POST', '/api/remiss/:id/remisskonferens/ta-bort', (c, id) => medRemiss(c, id, 'remisskonferens', (atk, r) => taBortFranKonferens(atk, r)));
  rutt('GET', '/api/remisskonferens', (c) => konferensLista(c.db, kravInloggad(c), { loggade: (c.s.remissKonferensLoggad ??= new Set()) }));
  rutt('POST', '/api/remiss/:id/beslut-pa-uppdrag', (c, id) => medRemiss(c, id, 'registrera_beslut_pa_uppdrag', (atk, r) => beslutPaUppdrag(atk, r, c.body, { efterBedomning, efterAvvisning })));
  // Extern pappersremiss.
  rutt('GET', '/api/hsa-katalog', (c) => { kravInloggad(c); return hsaSok(c.url.searchParams.get('q')); });
  rutt('GET', '/api/skannade-remisser', (c) => skannadeLista(c.db, kravInloggad(c)));
  rutt('GET', '/api/skannad-remiss/:id', (c, id) => skannadFil(c.db, kravInloggad(c), id));
  rutt('POST', '/api/extern-remiss', (c) => {
    const p = kravInloggad(c);
    kravRegistrera(p);
    if (typeof c.body.patientId !== 'string' || !c.body.patientId) throw ogiltig('Välj patienten.', 'patientId');
    return medPatient(c, c.body.patientId, 'registrera_extern_remiss', (atk) => registreraExtern(atk, c.body));
  });
}
