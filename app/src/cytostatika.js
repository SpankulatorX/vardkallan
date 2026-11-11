// Cytostatika (runda 9, r3, Sussa 4.8): ordination ur en behandlingsregim med cykler och dagar, dos efter kroppsyta
// eller njurfunktion som systemet räknar, kontroll av provsvar före varje kur, dosjustering och uppskjuten cykel,
// beredningsorder till en simulerad beredningsenhet med volym, spädning och etikett med streckkod, mottagning och
// administrering med dubbelkontroll i rätt ordning, överlämnande av peroral behandling och uppföljningen per vårdenhet.
//
// Runda 11, r4 (version 1.1): regimbiblioteket med versioner som en regimansvarig läkare godkänner i sin egen
// inloggning, premedicinering som ges före kuren, den kumulativa dosen över alla behandlingar med stopp vid gränsen,
// beredningsenhetens kapacitet per dag, infusionens start, takt, avbrott, extravasering, reaktioner och slut, och
// patientens egen uppföljning i Min journal efter att en peroral behandling har överlämnats. Beredningen på
// beredningsenheten finns i cytostatika-beredning.js.
//
// Systemet är experten:
//   - Läkaren väljer regim och startdag. Systemet hämtar längd och vikt ur journalen, räknar kroppsytan (Mosteller),
//     njurfunktionen (Cockcroft-Gault) och varje dos (per kvadratmeter eller med Calverts formel för karboplatin),
//     avrundar efter regimens steg och lägger ut cyklerna med dagarna och premedicineringen. Regimen är den senast
//     godkända versionen i regimbiblioteket, och en pågående behandling behåller den version den ordinerades med.
//   - Före varje kur prövar systemet leukocyter, trombocyter och vid behov kreatinin mot regimens gränser och förklarar
//     varför en kur inte kan ges. Proverna som saknas beställs med ett klick. Systemet räknar den kumulativa dosen för
//     läkemedel med en gräns för hela livet (antracykliner) och stoppar kuren som skulle passera gränsen, och säger när
//     beredningsenheten inte har plats den dagen och vilken dag som är ledig.
//   - Beredningsordern räknar volymen ur stamlösningens styrka och väljer bärarlösning och volym. Etiketten får en
//     streckkod som kontrolleras när beredningen tas emot och vid sängen.
//   - Vid administreringen kontrollerar systemet id-bandet, etiketten, premedicineringen, att en andra person har
//     kontrollerat och att läkemedlen ges i regimens ordning. Systemet räknar infusionens takt och säger vad som ska
//     göras vid en reaktion eller en extravasering. För peroral behandling räknar systemet tabletterna och skriver
//     instruktionen, och patientens rapporter i Min journal bedöms av systemet.
//
// Regimerna, gränserna, premedicineringen, kapaciteten och stamlösningarna är demoregler och inget kliniskt beslutsstöd.
import { Fel, datumAv, addDagar, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder, kanRoll, alder } from './atkomst.js';
import * as labb from './labb.js';
import { svg as streckkodSvg } from './streckkod.js';
import { tabell, finns, personNamn, enhetKort, enhetsnamn, textFalt, iso, DAG, TIMME, MIN, kravRoll, vardkontaktFor, lasRad, andraRad, provaRad, loggaPatient } from './specialist-hjalp.js';
import { Atkomst, visningsnamn } from './atkomst.js';
import { loggaRad } from './logg.js';

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Regimerna, premedicineringen, gränserna och beredningsenheten är demoregler.';
// Den simulerade externa beredningen, för vårdenheter utanför USÖ. Svaret att beredningen är klar kommer elektroniskt.
export const BEREDNINGSENHET = 'Cytostatikaberedningen (simulerad)';
// Runda 11, r4: beredningsenheten i Vårdkällan, som bereder för vårdenheterna på USÖ (cytostatika-beredning.js).
export const BEREDNINGSENHET_ID = 'uso-bered';
export const BEREDNING_SJUKHUS = 'uso';
// Runda 11, r4: de onkologiska vårdenheterna, där regimansvarig är ett eget uppdrag och menyn Cytostatika visas.
export const ONKOLOGISKA = new Set(['uso-onk']);
// Premedicineringen som en regim kan ha (demoregel). minuterFore är hur lång tid före kuren den ges.
export const PREMED = tabell({
  ondansetron: { namn: 'Ondansetron', dos: '8 mg', vag: 'peroralt', minuterFore: 30 },
  betametason: { namn: 'Betametason', dos: '8 mg', vag: 'peroralt', minuterFore: 30 },
  klemastin: { namn: 'Klemastin', dos: '2 mg', vag: 'intravenöst', minuterFore: 15 },
});
// Regimerna, grundversionen i regimbiblioteket. dosPerM2 i mg per kvadratmeter kroppsyta, auc för karboplatin (Calverts
// formel), dagar i cykeln, stam i mg per ml, avrunda i mg. po betyder peroral behandling som överlämnas till patienten,
// med tablettstyrkor och dostillfällen per dag. kumulativ är gränsen för hela livet i mg per kvadratmeter.
export const REGIMER = tabell({
  ec: { namn: 'EC (epirubicin och cyklofosfamid)', intervall: 21, cykler: 4, prover: ['lpk', 'tpk'], premedicinering: ['ondansetron', 'betametason'], lakemedel: [
    { id: 'epirubicin', namn: 'Epirubicin', dosPerM2: 90, dagar: [1], stam: 2, barare: 'Natriumklorid 9 mg/ml', bararVolym: 100, minuter: 15, avrunda: 1, kumulativ: 900 },
    { id: 'cyklofosfamid', namn: 'Cyklofosfamid', dosPerM2: 600, dagar: [1], stam: 20, barare: 'Natriumklorid 9 mg/ml', bararVolym: 250, minuter: 30, avrunda: 10 },
  ] },
  karboplatin: { namn: 'Karboplatin (AUC 5)', intervall: 21, cykler: 6, prover: ['lpk', 'tpk', 'kreatinin'], premedicinering: ['ondansetron'], lakemedel: [
    { id: 'karboplatin', namn: 'Karboplatin', auc: 5, dagar: [1], stam: 10, barare: 'Glukos 50 mg/ml', bararVolym: 250, minuter: 30, avrunda: 10 },
  ] },
  kapecitabin: { namn: 'Kapecitabin (peroral)', intervall: 21, cykler: 8, prover: ['lpk', 'tpk'], premedicinering: [], lakemedel: [
    { id: 'kapecitabin', namn: 'Kapecitabin', dosPerM2: 1000, dagar: Array.from({ length: 14 }, (_, i) => i + 1), po: true, tabletter: [500, 150], perDag: 2, avrunda: 150 },
  ] },
});
// Gränserna före en kur (demoregel): prover tagna de senaste tre dygnen.
export const GRANSER = tabell({
  lpk: { namn: 'Leukocyter', min: 3.0, enhet: '×10⁹/L' }, tpk: { namn: 'Trombocyter', min: 100, enhet: '×10⁹/L' }, kreatinin: { namn: 'Kreatinin', enhet: 'µmol/L' },
});
export const PROV_TIMMAR = 72;
export const HALLBAR_TIMMAR = 24;
export const GFR_TAK = 125;
// Runda 11, r4: hur många kurer beredningsenheten tar emot per dag när inget annat är satt (demoregel).
export const KAPACITET_STANDARD = 6;
const GRUNDVERSION_TID = '2026-01-02T08:00:00.000Z';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS cyto_behandlingar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, regim TEXT NOT NULL, cykler INTEGER NOT NULL,
  start TEXT NOT NULL, ordinerad_av TEXT NOT NULL, skapad TEXT NOT NULL, status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cyto_beh_patient ON cyto_behandlingar (patient_id);
CREATE TABLE IF NOT EXISTS cyto_cykler (
  id INTEGER PRIMARY KEY AUTOINCREMENT, behandling_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, nummer INTEGER NOT NULL, dag1 TEXT NOT NULL,
  langd REAL NOT NULL, vikt REAL NOT NULL, bsa REAL NOT NULL, gfr REAL, dosandel INTEGER NOT NULL DEFAULT 100, dosandel_orsak TEXT, status TEXT NOT NULL,
  godkand_tid TEXT, godkand_av TEXT, uppskjuten INTEGER NOT NULL DEFAULT 0, uppskjuten_orsak TEXT
);
CREATE TABLE IF NOT EXISTS cyto_doser (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cykel_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lakemedel TEXT NOT NULL, ordning INTEGER NOT NULL,
  dos_mg REAL NOT NULL, berakning TEXT NOT NULL, etikett TEXT NOT NULL UNIQUE, status TEXT NOT NULL, beredd_tid TEXT, volym_ml REAL, mottagen_tid TEXT, mottagen_av TEXT,
  iordningstalld_tid TEXT, iordningstalld_av TEXT, kontrollerad_tid TEXT, kontrollerad_av TEXT, given_tid TEXT, given_av TEXT
);
CREATE TABLE IF NOT EXISTS cyto_historik (
  id INTEGER PRIMARY KEY, behandling_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, personal_id TEXT, handelse TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS cyto_historik_andras_ej BEFORE UPDATE OF behandling_id, tid, personal_id, handelse, detalj ON cyto_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken för en cytostatikabehandling ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS cyto_historik_raderas_ej BEFORE DELETE ON cyto_historik BEGIN SELECT RAISE(ABORT, 'Historiken för en cytostatikabehandling raderas inte.'); END;
`;
// Runda 11, r4: regimbiblioteket, premedicineringen, kapaciteten, infusionens händelser och patientens rapporter.
export const SCHEMA_R11 = `
CREATE TABLE IF NOT EXISTS cyto_regimversioner (
  id INTEGER PRIMARY KEY AUTOINCREMENT, regim TEXT NOT NULL, version INTEGER NOT NULL, innehall TEXT NOT NULL, andring TEXT, motivering TEXT,
  skapad TEXT NOT NULL, skapad_av TEXT, status TEXT NOT NULL, beslut_tid TEXT, beslut_av TEXT, beslut_orsak TEXT, UNIQUE (regim, version)
);
CREATE TRIGGER IF NOT EXISTS cyto_regimversion_andras_ej BEFORE UPDATE OF regim, version, innehall, andring, motivering, skapad, skapad_av ON cyto_regimversioner
  BEGIN SELECT RAISE(ABORT, 'En regimversion ändras inte. Gör en ny version.'); END;
CREATE TRIGGER IF NOT EXISTS cyto_regimversion_raderas_ej BEFORE DELETE ON cyto_regimversioner BEGIN SELECT RAISE(ABORT, 'En regimversion raderas inte.'); END;
CREATE TABLE IF NOT EXISTS cyto_premed (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cykel_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lakemedel TEXT NOT NULL, ordning INTEGER NOT NULL,
  status TEXT NOT NULL, given_tid TEXT, given_av TEXT
);
CREATE TABLE IF NOT EXISTS cyto_kapacitet (datum TEXT PRIMARY KEY, platser INTEGER NOT NULL, andrad TEXT NOT NULL, andrad_av TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cyto_infusion (
  id INTEGER PRIMARY KEY, dos_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, personal_id TEXT NOT NULL,
  typ TEXT NOT NULL, takt REAL, grad INTEGER, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS cyto_infusion_andras_ej BEFORE UPDATE ON cyto_infusion BEGIN SELECT RAISE(ABORT, 'En infusionshändelse ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS cyto_infusion_raderas_ej BEFORE DELETE ON cyto_infusion BEGIN SELECT RAISE(ABORT, 'En infusionshändelse raderas inte.'); END;
CREATE TABLE IF NOT EXISTS cyto_patientrapporter (
  id INTEGER PRIMARY KEY, dos_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, datum TEXT NOT NULL, tid TEXT NOT NULL, invanare_id TEXT NOT NULL,
  morgon INTEGER NOT NULL, kvall INTEGER NOT NULL, feber REAL, diarre INTEGER NOT NULL, illamaende INTEGER NOT NULL, handfot INTEGER NOT NULL, bedomning TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS cyto_patientrapport_andras_ej BEFORE UPDATE ON cyto_patientrapporter BEGIN SELECT RAISE(ABORT, 'En rapport ändras inte.'); END;
CREATE TABLE IF NOT EXISTS cyto_tidigare (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, svar TEXT NOT NULL, mg_per_m2 REAL, varifran TEXT, tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS cyto_tidigare_andras_ej BEFORE UPDATE OF svar, mg_per_m2, varifran, tid, av ON cyto_tidigare BEGIN SELECT RAISE(ABORT, 'Svaret om tidigare behandling ändras inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) {
  if (har.has(db)) return;
  db.exec(SCHEMA);
  db.exec(SCHEMA_R11);
  const kol = (t) => db.query(`PRAGMA table_info(${t})`).all().map(k => k.name);
  if (!kol('cyto_behandlingar').includes('regim_version')) db.exec('ALTER TABLE cyto_behandlingar ADD COLUMN regim_version INTEGER');
  const d = kol('cyto_doser');
  for (const [k, typ] of [['start_tid', 'TEXT'], ['slut_tid', 'TEXT'], ['takt_ml_h', 'REAL']]) if (!d.includes(k)) db.exec(`ALTER TABLE cyto_doser ADD COLUMN ${k} ${typ}`);
  // Grundversionen av varje regim, godkänd när demon byggdes.
  const ins = db.query("INSERT OR IGNORE INTO cyto_regimversioner (regim, version, innehall, andring, skapad, skapad_av, status, beslut_tid) VALUES (?, 1, ?, 'Grundversionen i demon.', ?, NULL, 'godkand', ?)");
  for (const [id, r] of Object.entries(REGIMER)) ins.run(id, JSON.stringify(r), GRUNDVERSION_TID, GRUNDVERSION_TID);
  har.add(db);
}

const historik = (db, b, personalId, handelse, detalj, t) => db.query('INSERT INTO cyto_historik (behandling_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(b.id, b.patient_id, b.enhet_id, t, personalId, handelse, detalj);
const rad = (db, tabell, id, text) => { sakra(db); const r = db.query(`SELECT * FROM ${tabell} WHERE id = ?`).get(Number(id)); if (!r) throw new Fel(404, text, 'saknas'); return r; };
export const behandlingRad = (db, id) => rad(db, 'cyto_behandlingar', id, 'Behandlingen finns inte.');
export const cykelRad = (db, id) => rad(db, 'cyto_cykler', id, 'Cykeln finns inte.');
export const dosRad = (db, id) => rad(db, 'cyto_doser', id, 'Dosen finns inte.');
export const premedRad = (db, id) => rad(db, 'cyto_premed', id, 'Premedicineringen finns inte.');
const ANDRA = 'Kuren hanteras av den ordinerande vårdenheten.';
const andraKur = (atk, rad, handling) => andraRad(atk, rad, handling, 'las_cytostatika', ANDRA);
export const lakemedelFor = (r, id) => r.lakemedel.find(l => l.id === id);
export const etikettFor = (id) => `VKC${String(id).padStart(8, '0')}`;
const tal = (v, d = 0) => String(d ? Number(v.toFixed(d)) : Math.round(v)).replace('.', ',');

// ---- Regimbiblioteket (runda 11, r4) -----------------------------------------------------------------------------------

export const versionRad = (db, id) => rad(db, 'cyto_regimversioner', id, 'Regimversionen finns inte.');
export const gallandeVersion = (db, regim) => { sakra(db); return db.query("SELECT * FROM cyto_regimversioner WHERE regim = ? AND status = 'godkand' ORDER BY version DESC LIMIT 1").get(regim); };
// Regimen som en behandling ordinerades med. En behandling från före runda 11 har grundversionen.
export function regimFor(db, b) {
  sakra(db);
  const v = b.regim_version ? db.query('SELECT innehall FROM cyto_regimversioner WHERE id = ?').get(b.regim_version) : null;
  return v ? JSON.parse(v.innehall) : REGIMER[b.regim];
}
const versionNummer = (db, b) => (b.regim_version ? db.query('SELECT version FROM cyto_regimversioner WHERE id = ?').get(b.regim_version)?.version ?? 1 : 1);

// Regimansvarig är ett eget uppdrag som verksamhetschefen på den onkologiska enheten ger (lakemedelsansvar.js), och det
// slås upp i databasen vid varje godkännande. Regimerna är gemensamma för regionen.
export function arRegimansvarig(db, personal) {
  if (!kanRoll(personal, 'ordinera_cytostatika')) return false;
  const { uppdragFor } = require('./lakemedelsansvar.js');
  return Boolean(uppdragFor(db, personal, 'regimansvarig'));
}
const loggaRegim = (db, personal, resurs, resultat = 'tillaten') => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'ordinera_cytostatika', resurs, grund: resultat === 'nekad' ? 'nekad' : 'administrativ', resultat });

// Vad som skiljer en version från den förra, på vanlig svenska. Systemet skriver det, inte den som ändrar.
export function skillnad(gammal, ny) {
  const ut = [];
  if (gammal.cykler !== ny.cykler) ut.push(`${gammal.cykler} till ${ny.cykler} cykler`);
  if (gammal.intervall !== ny.intervall) ut.push(`intervallet ${gammal.intervall} till ${ny.intervall} dagar`);
  for (const l of ny.lakemedel) {
    const g = lakemedelFor(gammal, l.id);
    if (!g) continue;
    if (l.auc && g.auc !== l.auc) ut.push(`${l.namn} AUC ${g.auc} till ${l.auc}`);
    if (l.dosPerM2 && g.dosPerM2 !== l.dosPerM2) ut.push(`${l.namn} ${g.dosPerM2} till ${l.dosPerM2} mg/m²`);
    if (l.minuter && g.minuter !== l.minuter) ut.push(`${l.namn} infunderas på ${l.minuter} i stället för ${g.minuter} minuter`);
  }
  const pg = new Set(gammal.premedicinering ?? []), pn = new Set(ny.premedicinering ?? []);
  for (const p of pn) if (!pg.has(p)) ut.push(`premedicinering med ${PREMED[p].namn.toLowerCase()} tillagd`);
  for (const p of pg) if (!pn.has(p)) ut.push(`premedicinering med ${PREMED[p].namn.toLowerCase()} borttagen`);
  return ut.length ? `${ut.join(', ').replace(/^./, c => c.toUpperCase())}.` : 'Inga ändringar i innehållet.';
}

const versionUt = (db, v, personal = null) => {
  const r = JSON.parse(v.innehall);
  return {
    id: v.id, regim: v.regim, version: v.version, status: v.status, namn: r.namn, intervall: r.intervall, cykler: r.cykler,
    lakemedel: r.lakemedel.map(l => ({ id: l.id, namn: l.namn, dos: l.auc ? `AUC ${l.auc}` : `${l.dosPerM2} mg/m²`, dosPerM2: l.dosPerM2 ?? null, auc: l.auc ?? null, minuter: l.minuter ?? null,
      peroral: Boolean(l.po), kumulativ: l.kumulativ ?? null, dagar: l.dagar })),
    premedicinering: (r.premedicinering ?? []).map(p => ({ id: p, ...PREMED[p] })), prover: r.prover.map(p => GRANSER[p].namn),
    andring: v.andring, motivering: v.motivering, skapad: { tid: v.skapad, av: v.skapad_av ? personNamn(db, v.skapad_av) : null },
    beslut: v.beslut_tid ? { tid: v.beslut_tid, av: v.beslut_av ? personNamn(db, v.beslut_av) : null, orsak: v.beslut_orsak } : null,
    ...(personal ? { kanGodkanna: v.status === 'vantar' && v.skapad_av !== personal.id && arRegimansvarig(db, personal) } : {}),
  };
};

// GET /api/cytostatika/regimer. Regimbiblioteket för läkare och sjuksköterskor: varje regim med gällande version,
// versionen som väntar på godkännande och de tidigare versionerna. Inga patientuppgifter.
export function regimbibliotek(db, personal) {
  sakra(db);
  kravRoll(personal, 'las_cytostatika', 'Din yrkesroll läser inte regimbiblioteket.');
  const regimansvarig = arRegimansvarig(db, personal);
  return {
    regimansvarig, kanForesla: kanRoll(personal, 'ordinera_cytostatika'), premedicinering: Object.entries(PREMED).map(([id, p]) => ({ id, ...p })),
    regimer: Object.keys(REGIMER).map(id => {
      const alla = db.query('SELECT * FROM cyto_regimversioner WHERE regim = ? ORDER BY version DESC').all(id);
      const g = alla.find(v => v.status === 'godkand');
      return { id, gallande: g ? versionUt(db, g, personal) : null, vantande: alla.filter(v => v.status === 'vantar').map(v => versionUt(db, v, personal)),
        tidigare: alla.filter(v => v.status !== 'vantar' && v.id !== g?.id).map(v => versionUt(db, v)) };
    }),
    text: 'Regimerna är gemensamma för regionen. En ny version används först när en regimansvarig läkare har godkänt den i sin egen inloggning, och den som skrev versionen kan aldrig godkänna den. En pågående behandling fortsätter med den version den ordinerades med.',
    demoregel: DEMOREGEL,
  };
}

const heltal = (v, min, max) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : null);

// POST /api/cytostatika/regimer/:regim/version. Läkaren föreslår en ny version ur den gällande. Fälten som kan ändras är
// antal cykler, intervall, dos och infusionstid per läkemedel och premedicineringen. Motiveringen krävs.
export function foreslaVersion(db, personal, regim, body = {}, nu = new Date()) {
  sakra(db);
  if (!kanRoll(personal, 'ordinera_cytostatika')) { loggaRegim(db, personal, `cyto_regim:${regim}`, 'nekad'); throw new Fel(403, 'Din yrkesroll föreslår inte regimer.', 'nekad'); }
  if (!finns(REGIMER, regim)) throw new Fel(404, 'Regimen finns inte.', 'saknas');
  if (db.query("SELECT 1 FROM cyto_regimversioner WHERE regim = ? AND status = 'vantar'").get(regim)) throw new Fel(409, 'En ny version av regimen väntar redan på godkännande. Den regimansvariga läkaren godkänner eller avslår den först.', 'ogiltig');
  const g = gallandeVersion(db, regim);
  const gammal = JSON.parse(g.innehall);
  const ny = JSON.parse(g.innehall);
  const falt = [];
  if (body.cykler != null) { const v = heltal(body.cykler, 1, 12); if (v == null) falt.push('cykler'); else ny.cykler = v; }
  if (body.intervall != null) { const v = heltal(body.intervall, 7, 42); if (v == null) falt.push('intervall'); else ny.intervall = v; }
  const doser = body.doser && typeof body.doser === 'object' ? body.doser : {};
  const minuter = body.minuter && typeof body.minuter === 'object' ? body.minuter : {};
  for (const l of ny.lakemedel) {
    if (Object.hasOwn(doser, l.id) && doser[l.id] !== '' && doser[l.id] != null) {
      const v = Number(doser[l.id]);
      if (l.auc) { if (!Number.isFinite(v) || v < 1 || v > 8) falt.push(`dos_${l.id}`); else l.auc = v; }
      else if (!Number.isFinite(v) || v <= 0 || v > 5000) falt.push(`dos_${l.id}`); else l.dosPerM2 = v;
    }
    if (!l.po && Object.hasOwn(minuter, l.id) && minuter[l.id] !== '' && minuter[l.id] != null) { const v = heltal(minuter[l.id], 5, 240); if (v == null) falt.push(`minuter_${l.id}`); else l.minuter = v; }
  }
  if (body.premedicinering != null) {
    if (!Array.isArray(body.premedicinering) || body.premedicinering.some(p => !finns(PREMED, p))) falt.push('premedicinering');
    else ny.premedicinering = Object.keys(PREMED).filter(p => body.premedicinering.includes(p));
  }
  const motivering = textFalt(body.motivering, 300);
  if (motivering.length < 3) falt.push('motivering');
  if (falt.length) throw new Fel(400, falt.includes('motivering') && falt.length === 1 ? 'Skriv varför regimen ändras.' : 'Kontrollera värdena: cykler 1 till 12, intervall 7 till 42 dagar, infusionstid 5 till 240 minuter, och skriv varför regimen ändras.', 'ogiltig', { falt });
  const andring = skillnad(gammal, ny);
  if (andring === 'Inga ändringar i innehållet.') throw new Fel(400, 'Versionen är likadan som den gällande. Ändra något i regimen.', 'ogiltig');
  const version = db.query('SELECT max(version) AS v FROM cyto_regimversioner WHERE regim = ?').get(regim).v + 1;
  const r = db.query("INSERT INTO cyto_regimversioner (regim, version, innehall, andring, motivering, skapad, skapad_av, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'vantar')")
    .run(regim, version, JSON.stringify(ny), andring, motivering, iso(nu), personal.id);
  loggaRegim(db, personal, `cyto_regimversion:${r.lastInsertRowid}`);
  return { version: versionUt(db, versionRad(db, r.lastInsertRowid), personal), text: `Version ${version} av ${ny.namn} väntar på godkännande av en regimansvarig läkare. Den gällande versionen används tills dess.` };
}

// En regimansvarig läkare godkänner eller avslår i sin egen inloggning, aldrig den som skrev versionen.
function provaBeslut(db, personal, v) {
  if (v.status !== 'vantar') throw new Fel(409, 'Versionen väntar inte på godkännande.', 'ogiltig');
  if (v.skapad_av === personal.id) { loggaRegim(db, personal, `cyto_regimversion:${v.id}`, 'nekad'); throw new Fel(409, 'Den som skrev versionen kan inte godkänna den själv. En annan regimansvarig läkare godkänner i sin egen inloggning.', 'samma_person'); }
  if (!arRegimansvarig(db, personal)) { loggaRegim(db, personal, `cyto_regimversion:${v.id}`, 'nekad'); throw new Fel(403, 'Bara en regimansvarig läkare godkänner regimer. Uppdraget ges av verksamhetschefen på den onkologiska kliniken.', 'nekad'); }
}
export function godkannVersion(db, personal, id, nu = new Date()) {
  const v = versionRad(db, id);
  provaBeslut(db, personal, v);
  db.transaction(() => {
    db.query("UPDATE cyto_regimversioner SET status = 'ersatt' WHERE regim = ? AND status = 'godkand'").run(v.regim);
    db.query("UPDATE cyto_regimversioner SET status = 'godkand', beslut_tid = ?, beslut_av = ? WHERE id = ?").run(iso(nu), personal.id, v.id);
  })();
  loggaRegim(db, personal, `cyto_regimversion:${v.id}:godkand`);
  return { version: versionUt(db, versionRad(db, v.id), personal), text: `Version ${v.version} gäller nu för nya ordinationer. Pågående behandlingar fortsätter med den version de ordinerades med.` };
}
export function avslaVersion(db, personal, id, body = {}, nu = new Date()) {
  const v = versionRad(db, id);
  provaBeslut(db, personal, v);
  const orsak = textFalt(body.orsak, 300);
  if (orsak.length < 3) throw new Fel(400, 'Skriv varför versionen avslås.', 'ogiltig', { falt: ['orsak'] });
  db.query("UPDATE cyto_regimversioner SET status = 'avslagen', beslut_tid = ?, beslut_av = ?, beslut_orsak = ? WHERE id = ?").run(iso(nu), personal.id, orsak, v.id);
  loggaRegim(db, personal, `cyto_regimversion:${v.id}:avslagen`);
  return { version: versionUt(db, versionRad(db, v.id), personal), text: 'Versionen är avslagen. Den gällande versionen används som förut.' };
}

// ---- Beredningsenheten och kapaciteten (runda 11, r4) --------------------------------------------------------------

// Vårdenheterna på USÖ skickar beredningsordern till beredningsenheten i Vårdkällan. Andra vårdenheter skickar den till
// en simulerad extern beredning, som svarar elektroniskt när beredningen är klar.
export function beredsInternt(db, enhetId) {
  const ve = vardenhetFor(db, enhetId);
  return ve !== BEREDNINGSENHET_ID && db.query('SELECT forald_id FROM enheter WHERE id = ?').get(ve)?.forald_id === BEREDNING_SJUKHUS;
}
const harInfusion = (r) => r.lakemedel.some(l => !l.po);
export function kapacitetFor(db, datum) {
  sakra(db);
  const k = db.query('SELECT platser FROM cyto_kapacitet WHERE datum = ?').get(datum);
  const platser = k ? k.platser : KAPACITET_STANDARD;
  const bokade = db.query("SELECT c.*, b.regim, b.regim_version FROM cyto_cykler c JOIN cyto_behandlingar b ON b.id = c.behandling_id WHERE c.dag1 = ? AND c.status IN ('godkand', 'klar')").all(datum)
    .filter(c => beredsInternt(db, c.enhet_id) && harInfusion(regimFor(db, c))).length;
  return { datum, platser, bokade, lediga: Math.max(0, platser - bokade) };
}
export const forstaLediga = (db, fran) => { for (let i = 1; i <= 28; i++) { const d = addDagar(fran, i); if (kapacitetFor(db, d).lediga > 0) return d; } return null; };

// ---- Beräkningarna ---------------------------------------------------------------------------------------------------

export const mosteller = (langd, vikt) => Math.sqrt((langd * vikt) / 3600);
// Cockcroft-Gault i SI-enheter: (140 - ålder) × vikt × 1,23 för män och 1,04 för kvinnor, delat med kreatinin i µmol/L.
export const cockcroftGault = ({ alder: ar, vikt, kreatinin, kon }) => ((140 - ar) * vikt * (kon === 'kvinna' ? 1.04 : 1.23)) / kreatinin;
export const avrunda = (v, steg) => Math.round(v / steg) * steg;
// Tabletterna för en dos med så få tabletter som möjligt: 1 800 mg är 3 × 500 mg och 2 × 150 mg, och 600 mg 4 × 150 mg.
export function tabletter(dos, [stor, liten]) {
  for (let n = Math.floor(dos / stor); n >= 0; n--) {
    const kvar = dos - n * stor;
    if (kvar % liten === 0) return [{ styrka: stor, antal: n }, { styrka: liten, antal: kvar / liten }].filter(x => x.antal);
  }
  return null;
}

function dosFor(l, { bsa, gfr }, dosandel) {
  if (l.auc) {
    const g = Math.min(gfr, GFR_TAK);
    const full = l.auc * (g + 25);
    return { mg: avrunda((full * dosandel) / 100, l.avrunda), text: `AUC ${l.auc} × (GFR ${Math.round(g)}${gfr > GFR_TAK ? ', taket' : ''} + 25) = ${Math.round(full)} mg${dosandel < 100 ? `, ${dosandel} procent` : ''}` };
  }
  const full = l.dosPerM2 * bsa;
  return { mg: avrunda((full * dosandel) / 100, l.avrunda), text: `${l.dosPerM2} mg/m² × ${bsa.toFixed(2).replace('.', ',')} m² = ${Math.round(full)} mg${dosandel < 100 ? `, ${dosandel} procent` : ''}${l.po ? ' per tillfälle' : ''}` };
}

// Längd, vikt och kreatinin ur journalen, bland det som den inloggade får se.
function underlag(atk, r, nu) {
  const db = atk.db;
  const mv = atk.filtrera(db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ IN ('langd', 'vikt', 'kreatinin') ORDER BY tid DESC, id DESC").all(atk.patientId), 'las_matvarden');
  const senast = (typ, dagar) => mv.find(m => m.typ === typ && Date.parse(m.tid) >= nu.getTime() - dagar * DAG);
  const v = senast('vikt', 30), l = mv.find(m => m.typ === 'langd');
  if (!v || !l) throw new Fel(409, `${!l ? 'Längd' : 'Vikt'} saknas${!v && l ? ' från den senaste månaden' : ''}. Registrera ${!l ? 'längden' : 'vikten'} som mätvärde, så räknar systemet kroppsytan.`, 'underlag');
  const vikt = Number(v.varde_num ?? v.varde), langd = Number(l.varde_num ?? l.varde);
  const bsa = Number(mosteller(langd, vikt).toFixed(2));
  let gfr = null;
  if (r.lakemedel.some(x => x.auc)) {
    const k = senast('kreatinin', PROV_TIMMAR / 24);
    if (!k) throw new Fel(409, 'Kreatinin från de senaste tre dygnen saknas. Systemet behöver det för att räkna karboplatindosen.', 'underlag');
    const p = db.query('SELECT fodd, kon FROM patienter WHERE id = ?').get(atk.patientId);
    gfr = Number(cockcroftGault({ alder: alder(p.fodd, datumAv(nu)), vikt, kreatinin: Number(k.varde_num ?? k.varde), kon: p.kon }).toFixed(0));
  }
  return { langd, vikt, bsa, gfr };
}

function laggUtDoser(db, b, c) {
  const r = regimFor(db, b);
  const ins = db.query("INSERT INTO cyto_doser (cykel_id, patient_id, enhet_id, lakemedel, ordning, dos_mg, berakning, etikett, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ordinerad')");
  r.lakemedel.forEach((l, i) => {
    const d = dosFor(l, { bsa: c.bsa, gfr: c.gfr }, c.dosandel);
    const id = Number(ins.run(c.id, b.patient_id, b.enhet_id, l.id, i + 1, d.mg, d.text, `tmp-${Math.random()}`).lastInsertRowid);
    db.query('UPDATE cyto_doser SET etikett = ? WHERE id = ?').run(etikettFor(id), id);
  });
  // Runda 11, r4: premedicineringen läggs ut med kuren och ges före den första cytostatikadosen.
  const insP = db.query("INSERT INTO cyto_premed (cykel_id, patient_id, enhet_id, lakemedel, ordning, status) VALUES (?, ?, ?, ?, ?, 'ordinerad')");
  (r.premedicinering ?? []).forEach((p, i) => insP.run(c.id, b.patient_id, b.enhet_id, p, i + 1));
}

function nyCykel(atk, b, nummer, dag1, nu) {
  const db = atk.db;
  const u = underlag(atk, regimFor(db, b), nu);
  const r = db.query("INSERT INTO cyto_cykler (behandling_id, patient_id, enhet_id, nummer, dag1, langd, vikt, bsa, gfr, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planerad')")
    .run(b.id, b.patient_id, b.enhet_id, nummer, dag1, u.langd, u.vikt, u.bsa, u.gfr);
  const c = cykelRad(db, r.lastInsertRowid);
  laggUtDoser(db, b, c);
  return c;
}

// Runda 11, r4: den kumulativa dosen per kvadratmeter för läkemedel med en gräns för hela livet. Givna cytostatikadoser
// är läkemedel och följer läkemedelslistans synlighet: de är gemensamma för vårdgivaren och räknas från alla vårdenheter
// utan aktivt val, men inte från en spärrad vårdenhet utan patientens samtycke (säkerhetsgranskningen av runda 11: att
// räkna bara på journalens läsfilter släppte igenom en kur på en annan vårdenhet). En avbruten infusion räknas med den del
// som har gått in. Ordinatörens svar om tidigare behandling hos andra vårdgivare räknas också, eftersom den aldrig syns i
// systemet.
export const tidigareFor = (atk) => {
  sakra(atk.db);
  return atk.filtrera(atk.db.query('SELECT * FROM cyto_tidigare WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId), 'las_lakemedel', { gemensam: true })[0] ?? null;
};
const tidigareUt = (db, t) => (t ? { svar: t.svar, mgPerM2: t.mg_per_m2, varifran: t.varifran, tid: t.tid, av: personNamn(db, t.av), vardenhet: enhetsnamn(db, vardenhetFor(db, t.enhet_id)) } : null);
const TIDIGARE_TEXT = 'Tidigare behandling hos annan vårdgivare';
export function kumulativDetalj(atk, lakemedel) {
  const db = atk.db;
  const doser = atk.filtrera(db.query(`SELECT d.*, c.bsa, c.dag1 FROM cyto_doser d JOIN cyto_cykler c ON c.id = d.cykel_id WHERE d.patient_id = ? AND d.lakemedel = ? AND d.status IN ('given', 'avbruten') ORDER BY c.dag1, d.id`).all(atk.patientId, lakemedel), 'las_lakemedel', { gemensam: true });
  const per = new Map();
  for (const d of doser) {
    const andel = d.status === 'avbruten' && d.volym_ml ? Math.min(1, givnaMl(db, d) / d.volym_ml) : 1;
    const ve = vardenhetFor(db, d.enhet_id);
    const x = per.get(ve) ?? { vardenhet: enhetsnamn(db, ve), mg: 0, fran: d.dag1, till: d.dag1 };
    x.mg += (d.dos_mg * andel) / d.bsa;
    if (d.dag1 > x.till) x.till = d.dag1;
    per.set(ve, x);
  }
  const givna = [...per.values()].map(x => ({ vardenhet: x.vardenhet, mgPerM2: Math.round(x.mg), fran: x.fran, till: x.till }));
  const t = tidigareFor(atk);
  if (t?.svar === 'ja' && t.mg_per_m2) givna.unshift({ vardenhet: `${TIDIGARE_TEXT}${t.varifran ? `: ${t.varifran}` : ''}`, mgPerM2: Math.round(t.mg_per_m2), fran: null, till: null });
  const summa = [...per.values()].reduce((a, x) => a + x.mg, 0) + (t?.svar === 'ja' ? t.mg_per_m2 ?? 0 : 0);
  // Som i läkemedelslistan sägs bara att det finns spärrade uppgifter, aldrig om de innehåller cytostatika.
  return { summa, givna, sparrade: Boolean(atk.prova('las_lakemedel', {}).spärrade) };
}
export const kumulativGiven = (atk, lakemedel) => kumulativDetalj(atk, lakemedel).summa;
function kumulativUt(atk, b, r, cykler) {
  return r.lakemedel.filter(l => l.kumulativ).map(l => {
    const detalj = kumulativDetalj(atk, l.id);
    const givet = detalj.summa;
    const kvarande = cykler.filter(c => c.status !== 'klar').map(c => {
      const d = atk.db.query("SELECT dos_mg FROM cyto_doser WHERE cykel_id = ? AND lakemedel = ? AND status NOT IN ('given', 'avbruten')").get(c.id, l.id);
      return d ? d.dos_mg / c.bsa : 0;
    });
    const perCykel = kvarande[0] ?? (l.dosPerM2 ?? 0);
    const efter = givet + kvarande.reduce((x, y) => x + y, 0) + perCykel * Math.max(0, b.cykler - cykler.length);
    const ryms = perCykel > 0 ? Math.max(0, Math.floor((l.kumulativ - givet + 1e-9) / perCykel)) : null;
    return { lakemedel: l.namn, givet: Math.round(givet), grans: l.kumulativ, efterBehandlingen: Math.round(efter), overskrids: efter > l.kumulativ + 1e-9, givna: detalj.givna, sparrade: detalj.sparrade,
      text: `${l.namn}: ${Math.round(givet)} mg/m² är givet av gränsen ${l.kumulativ} mg/m² för hela livet. Efter hela behandlingen blir det ${Math.round(efter)} mg/m².${efter > l.kumulativ + 1e-9 ? ` Gränsen räcker till ${ryms === 1 ? 'en kur' : `${ryms} kurer`} till.` : ''}${detalj.sparrade ? ' Doser från en spärrad vårdenhet räknas inte. Fråga patienten om samtycke att visa dem om det kan ha betydelse.' : ''}` };
  });
}

// ---- Ordinationen ----------------------------------------------------------------------------------------------------

// Regimerna som kan ordineras: den gällande versionen i regimbiblioteket, eller grundversionen utan databas.
export const regimer = (db = null) => Object.keys(REGIMER).map(id => {
  const v = db ? gallandeVersion(db, id) : null;
  const r = v ? JSON.parse(v.innehall) : REGIMER[id];
  return { id, namn: r.namn, intervall: r.intervall, cykler: r.cykler, peroral: r.lakemedel.some(l => l.po), version: v?.version ?? 1,
    lakemedel: r.lakemedel.map(l => ({ namn: l.namn, dos: l.auc ? `AUC ${l.auc}` : `${l.dosPerM2} mg/m²`, dagar: l.dagar })),
    premedicinering: (r.premedicinering ?? []).map(p => `${PREMED[p].namn} ${PREMED[p].dos} ${PREMED[p].vag}`),
    kumulativ: r.lakemedel.filter(l => l.kumulativ).map(l => ({ lakemedel: l.namn, grans: l.kumulativ })) };
});

export function ordinera(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('ordinera_cytostatika');
  if (!finns(REGIMER, body.regim)) throw new Fel(400, 'Välj behandlingsregim.', 'ogiltig', { falt: ['regim'] });
  const v = gallandeVersion(db, body.regim);
  const r = JSON.parse(v.innehall);
  const start = body.start ?? addDagar(datumAv(nu), 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < datumAv(nu)) throw new Fel(400, 'Startdagen ska vara i dag eller senare, ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['start'] });
  const cykler = body.cykler == null ? r.cykler : Number(body.cykler);
  if (!Number.isInteger(cykler) || cykler < 1 || cykler > r.cykler) throw new Fel(400, `Regimen har högst ${r.cykler} cykler.`, 'ogiltig', { falt: ['cykler'] });
  if (db.query("SELECT 1 FROM cyto_behandlingar WHERE patient_id = ? AND status = 'pagaende'").get(atk.patientId)) throw new Fel(409, 'Patienten har redan en pågående cytostatikabehandling.', 'ogiltig');
  const u = underlag(atk, r, nu);
  // Runda 11, r4: före den första kuren i en regim med en gräns för den kumulativa dosen svarar ordinatören om patienten
  // har fått sådan behandling hos en annan vårdgivare, eftersom den aldrig syns i systemet. Utan svar stoppar systemet.
  const medGrans = r.lakemedel.filter(x => x.kumulativ);
  let nyttSvar = null;
  if (medGrans.length && !tidigareFor(atk)) {
    const t = body.tidigareBehandling;
    if (!t || !['ja', 'nej'].includes(t.svar)) {
      throw new Fel(400, `Svara om patienten har fått antracykliner eller annan behandling med en gräns för hela livet hos en annan vårdgivare. Systemet ser bara behandlingar i Vårdkällan och behöver svaret för att räkna den kumulativa dosen av ${medGrans.map(x => x.namn.toLowerCase()).join(' och ')}.`, 'tidigare', { falt: ['tidigareBehandling'] });
    }
    const mg = t.svar === 'ja' ? Number(String(t.mgPerM2 ?? '').replace(',', '.')) : null;
    if (t.svar === 'ja' && (!Number.isFinite(mg) || mg <= 0 || mg > 2000)) throw new Fel(400, 'Skriv mängden som patienten har fått, i mg/m² räknat som epirubicin.', 'tidigare', { falt: ['tidigareBehandling'] });
    nyttSvar = { svar: t.svar, mg, varifran: textFalt(t.varifran, 120) || null };
  }
  // En regim med ett läkemedel vars gräns redan är nådd ordineras inte. En kur som skulle passera gränsen stoppas när den
  // ska godkännas, så att läkaren kan minska dosen.
  for (const l of medGrans) {
    const givet = kumulativGiven(atk, l.id) + (nyttSvar?.mg ?? 0);
    if (givet >= l.kumulativ - 0.5) throw new Fel(409, `${l.namn}: ${Math.round(givet)} mg/m² är redan givet, och gränsen ${l.kumulativ} mg/m² för hela livet är nådd. Välj en regim utan ${l.namn.toLowerCase()}.`, 'kumulativ');
  }
  let b;
  db.transaction(() => {
    const x = db.query("INSERT INTO cyto_behandlingar (patient_id, enhet_id, vardkontakt_id, regim, cykler, start, ordinerad_av, skapad, status, regim_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pagaende', ?)")
      .run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), body.regim, cykler, start, atk.personal.id, iso(nu), v.id);
    b = behandlingRad(db, x.lastInsertRowid);
    if (nyttSvar) db.query('INSERT INTO cyto_tidigare (patient_id, enhet_id, svar, mg_per_m2, varifran, tid, av) VALUES (?, ?, ?, ?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, nyttSvar.svar, nyttSvar.mg, nyttSvar.varifran, iso(nu), atk.personal.id);
    nyCykel(atk, b, 1, start, nu);
    historik(db, b, atk.personal.id, 'ordinerad', `${r.namn}, ${cykler} cykler var ${r.intervall}:e dag från ${start}.`, iso(nu));
  })();
  return behandlingUt(atk, behandlingRad(db, b.id), nu);
}

// Provsvaren före kuren, prövade mot regimens gränser. Bara svar som den inloggade får se och som är tagna de senaste
// tre dygnen räknas.
export function provkontroll(atk, c, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, c, 'las_cytostatika');
  const b = behandlingRad(db, c.behandling_id);
  labb.forfallnaSvar(db, nu);
  const mv = atk.filtrera(db.query('SELECT * FROM matvarden WHERE patient_id = ? AND tid >= ? ORDER BY tid DESC, id DESC').all(c.patient_id, iso(nu.getTime() - PROV_TIMMAR * TIMME)), 'las_matvarden');
  const kriterier = regimFor(db, b).prover.map(typ => {
    const g = GRANSER[typ];
    const m = mv.find(x => x.typ === typ);
    if (!m) return { typ, namn: g.namn, ok: false, saknas: true, text: `${g.namn} från de senaste tre dygnen saknas.` };
    const v = Number(m.varde_num ?? m.varde);
    const ok = g.min == null || v >= g.min;
    return { typ, namn: g.namn, ok, varde: v, tid: m.tid, text: ok ? `${g.namn} ${String(v).replace('.', ',')} ${g.enhet}.` : `${g.namn} ${String(v).replace('.', ',')} ${g.enhet} är under gränsen ${String(g.min).replace('.', ',')}. Skjut upp kuren.` };
  });
  const saknas = kriterier.filter(k => k.saknas);
  return { ok: kriterier.every(k => k.ok), kriterier, saknasAnalyser: saknas.length ? [...new Set(saknas.map(k => (k.typ === 'kreatinin' ? 'kreatinin' : 'blodstatus')))] : [],
    text: kriterier.every(k => k.ok) ? 'Provsvaren tillåter kuren.' : kriterier.filter(k => !k.ok).map(k => k.text).join(' ') };
}

// Beställer proverna som saknas före kuren.
export function bestallProver(atk, c, nu = new Date()) {
  const p = provkontroll(atk, c, nu);
  if (!p.saknasAnalyser.length) throw new Fel(409, 'Proverna före kuren finns redan.', 'ogiltig');
  return labb.bestall(atk, { analyser: p.saknasAnalyser, kvitteraDubbletter: true, kommentar: `Före cytostatikakur, cykel ${c.nummer}` }, nu);
}

// Läkaren godkänner kuren. Det går bara när provsvaren tillåter den, den kumulativa dosen inte passerar gränsen och
// beredningsenheten har plats den dagen. Beredningsordern går då till beredningsenheten.
export function godkann(atk, c, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Kuren är redan godkänd eller avslutad.', 'ogiltig');
  const p = provkontroll(atk, c, nu);
  if (!p.ok) throw new Fel(409, p.text, 'prov');
  const b = behandlingRad(db, c.behandling_id);
  const r = regimFor(db, b);
  // Runda 11, r4: den kumulativa dosen och beredningsenhetens kapacitet.
  for (const l of r.lakemedel.filter(x => x.kumulativ)) {
    const d = db.query('SELECT dos_mg FROM cyto_doser WHERE cykel_id = ? AND lakemedel = ?').get(c.id, l.id);
    const givet = kumulativGiven(atk, l.id);
    const efter = givet + (d ? d.dos_mg / c.bsa : 0);
    if (efter > l.kumulativ + 1e-9) throw new Fel(409, `Den kumulativa dosen ${l.namn.toLowerCase()} blir ${Math.round(efter)} mg/m² med den här kuren, över gränsen ${l.kumulativ} mg/m² för hela livet. Kuren kan inte godkännas. Minska dosen eller avsluta behandlingen och välj en annan regim.`, 'kumulativ');
  }
  const intern = beredsInternt(db, c.enhet_id) && harInfusion(r);
  if (intern && kapacitetFor(db, c.dag1).lediga <= 0) {
    const ledig = forstaLediga(db, c.dag1);
    throw new Fel(409, `${enhetsnamn(db, BEREDNINGSENHET_ID)} har inga lediga platser ${c.dag1}.${ledig ? ` Första dag med plats är ${ledig}. Skjut upp kuren dit eller kontakta beredningsenheten.` : ' Kontakta beredningsenheten.'}`, 'kapacitet', { forslag: ledig, dagar: ledig ? Math.round((Date.parse(ledig) - Date.parse(c.dag1)) / DAG) : null });
  }
  const mottagare = intern ? enhetsnamn(db, BEREDNINGSENHET_ID) : BEREDNINGSENHET;
  db.transaction(() => {
    db.query("UPDATE cyto_cykler SET status = 'godkand', godkand_tid = ?, godkand_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, c.id);
    db.query("UPDATE cyto_doser SET status = 'att_bereda' WHERE cykel_id = ?").run(c.id);
    historik(db, b, atk.personal.id, 'godkand', `Cykel ${c.nummer} godkänd. ${p.text} Beredningsorder till ${mottagare}.`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

// Dosjustering för en kur som inte är godkänd: andelen av full dos och orsaken. Doserna räknas om.
export function dosjustera(atk, c, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Doserna kan bara ändras innan kuren är godkänd.', 'ogiltig');
  const andel = Number(body.dosandel);
  if (![50, 60, 75, 80, 90, 100].includes(andel)) throw new Fel(400, 'Välj andel av full dos: 50, 60, 75, 80, 90 eller 100 procent.', 'ogiltig', { falt: ['dosandel'] });
  const orsak = textFalt(body.orsak, 200);
  if (andel < 100 && !orsak) throw new Fel(400, 'Skriv orsaken till dosjusteringen.', 'ogiltig', { falt: ['orsak'] });
  const b = behandlingRad(db, c.behandling_id);
  db.transaction(() => {
    db.query('DELETE FROM cyto_doser WHERE cykel_id = ?').run(c.id);
    db.query('DELETE FROM cyto_premed WHERE cykel_id = ?').run(c.id);
    db.query('UPDATE cyto_cykler SET dosandel = ?, dosandel_orsak = ? WHERE id = ?').run(andel, orsak || null, c.id);
    laggUtDoser(db, b, cykelRad(db, c.id));
    historik(db, b, atk.personal.id, 'dosjusterad', `Cykel ${c.nummer}: ${andel} procent av full dos.${orsak ? ` ${orsak}.` : ''}`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

export function skjutUpp(atk, c, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Bara en kur som inte är godkänd kan skjutas upp.', 'ogiltig');
  const dagar = body.dagar == null ? 7 : Number(body.dagar);
  if (!Number.isInteger(dagar) || dagar < 1 || dagar > 28) throw new Fel(400, 'Skjut upp kuren 1 till 28 dagar.', 'ogiltig', { falt: ['dagar'] });
  const orsak = textFalt(body.orsak, 200) || provkontroll(atk, c, nu).text;
  const b = behandlingRad(db, c.behandling_id);
  db.query('UPDATE cyto_cykler SET dag1 = ?, uppskjuten = uppskjuten + 1, uppskjuten_orsak = ? WHERE id = ?').run(addDagar(c.dag1, dagar), orsak, c.id);
  historik(db, b, atk.personal.id, 'uppskjuten', `Cykel ${c.nummer} uppskjuten ${dagar} dagar till ${addDagar(c.dag1, dagar)}. ${orsak}`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// ---- Beredningen -----------------------------------------------------------------------------------------------------

// Beräkningen för en dos, för beredningsordern och för beredningsenhetens arbetslista.
export function dosOrder(db, d, b, p) {
  const r = regimFor(db, b);
  const l = lakemedelFor(r, d.lakemedel);
  if (l.po) {
    const t = tabletter(d.dos_mg, l.tabletter);
    return { id: d.id, lakemedel: l.namn, lakemedelId: l.id, dos: d.dos_mg, peroral: true, tabletterPerTillfalle: t, tabletterTotalt: t?.map(x => ({ styrka: x.styrka, antal: x.antal * l.perDag * l.dagar.length })), etikett: d.etikett, status: d.status };
  }
  const volym = Number((d.dos_mg / l.stam).toFixed(1));
  const total = Number((volym + l.bararVolym).toFixed(1));
  return { id: d.id, ordning: d.ordning, lakemedel: l.namn, lakemedelId: l.id, dos: d.dos_mg, berakning: d.berakning, stam: `${l.stam} mg/ml`, volymLakemedel: volym, barare: l.barare,
    bararVolym: l.bararVolym, totalVolym: total, infusionMinuter: l.minuter, taktMlH: Math.round((total / l.minuter) * 60), etikett: d.etikett, status: d.status,
    etikettText: `${p.fornamn} ${p.efternamn}, ${p.personnummer.slice(0, 8)}-${p.personnummer.slice(8)}. ${l.namn} ${d.dos_mg} mg i ${l.barare} ${l.bararVolym} ml, totalt ${total} ml. Infunderas på ${l.minuter} minuter. Hållbar ${HALLBAR_TIMMAR} timmar.`,
    streckkod: streckkodSvg(d.etikett) };
}

// Beredningsordern för en godkänd kur: dos, volym ur stamlösningen, bärarlösning, total volym, infusionstid och etikett.
export function beredningsorder(atk, c) {
  const db = atk.db;
  lasRad(atk, c, 'las_cytostatika');
  const b = behandlingRad(db, c.behandling_id);
  const r = regimFor(db, b);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(c.patient_id);
  const doser = db.query('SELECT * FROM cyto_doser WHERE cykel_id = ? ORDER BY ordning').all(c.id);
  const intern = beredsInternt(db, c.enhet_id);
  return {
    beredningsenhet: intern ? enhetsnamn(db, BEREDNINGSENHET_ID) : BEREDNINGSENHET, intern, regim: r.namn, cykel: c.nummer, dag1: c.dag1, kroppsyta: c.bsa, gfr: c.gfr, dosandel: c.dosandel,
    premedicinering: (r.premedicinering ?? []).map(x => `${PREMED[x].namn} ${PREMED[x].dos} ${PREMED[x].vag}, ${PREMED[x].minuterFore} minuter före`),
    doser: doser.map(d => dosOrder(db, d, b, p)),
  };
}

// Den simulerade externa beredningen svarar elektroniskt att en godkänd kur är beredd och dubbelkontrollerad. För
// vårdenheterna på USÖ bereder beredningsenheten i Vårdkällan i stället (cytostatika-beredning.js).
export function bered(atk, c, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ge_cytostatika');
  if (c.status !== 'godkand') throw new Fel(409, 'Kuren är inte godkänd av läkaren, så beredningsenheten bereder den inte.', 'ogiltig');
  if (beredsInternt(db, c.enhet_id)) throw new Fel(409, `Kuren bereds av ${enhetsnamn(db, BEREDNINGSENHET_ID)} i Vårdkällan, som signerar beredningen med batch och kontrollmätning. Avdelningen ser när den är klar.`, 'intern');
  const b = behandlingRad(db, c.behandling_id);
  const order = beredningsorder(atk, c);
  db.transaction(() => {
    for (const d of order.doser.filter(x => x.status === 'att_bereda')) db.query("UPDATE cyto_doser SET status = 'beredd', beredd_tid = ?, volym_ml = ? WHERE id = ?").run(iso(nu), d.totalVolym ?? null, d.id);
    historik(db, b, null, 'beredd', `${BEREDNINGSENHET}: cykel ${c.nummer} beredd och dubbelkontrollerad mot beredningsordern.`, iso(nu));
  })();
  return beredningsorder(atk, cykelRad(db, c.id));
}

// Mottagningen på avdelningen: etiketten läses och måste vara den beredda dosens.
export function taEmot(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  if (d.status !== 'beredd') throw new Fel(409, d.status === 'att_bereda' ? 'Dosen är inte beredd än.' : 'Dosen är redan mottagen.', 'ogiltig');
  if (body.streckkod !== d.etikett) throw new Fel(409, 'Streckkoden stämmer inte med den beredda dosen. Ta inte emot påsen och kontakta beredningsenheten.', 'fel_etikett');
  db.query("UPDATE cyto_doser SET status = 'mottagen', mottagen_tid = ?, mottagen_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  return { mottagen: true, etikett: d.etikett };
}

// Id-bandet och etiketten läses av den som iordningställer och, var för sig, av den som kontrollerar.
// Runda 11, r4: id-bandet jämförs med bara siffror och versaler på båda sidor, så att ett reservnummer med bokstäver
// (VK och siffror) läses lika säkert som ett personnummer med bindestreck.
export const idNyckel = (v) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const armbandOk = (db, pid, armband) => { const k = idNyckel(armband); return k.length > 0 && k === idNyckel(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer); };
function lasVidSangen(db, d, body) {
  if (!armbandOk(db, d.patient_id, body.armband)) throw new Fel(409, 'Id-bandet hör inte till patienten som kuren är ordinerad för. Ge inte kuren.', 'fel_patient');
  if (body.streckkod !== d.etikett) throw new Fel(409, 'Etiketten stämmer inte med dosen. Ge inte kuren.', 'fel_etikett');
}
const hallbarKvar = (d, l, nu) => {
  if (!l.po && nu.getTime() > Date.parse(d.beredd_tid) + HALLBAR_TIMMAR * TIMME) throw new Fel(409, `Beredningen är äldre än ${HALLBAR_TIMMAR} timmar. Ge den inte och kontakta beredningsenheten.`, 'for_sent');
};

// De som får göra dubbelkontrollen: sjuksköterskor och läkare på vårdenheten som får läsa behandlingen i
// behörighetsmotorn, aldrig den som iordningställde dosen. Förslaget ger ingen åtkomst som personen inte redan har.
export function kontrollKandidater(db, d) {
  const ve = vardenhetFor(db, d.enhet_id);
  return db.query("SELECT * FROM personal WHERE aktiv = 1 AND yrke IN ('sjukskoterska', 'lakare') ORDER BY namn").all()
    .filter(p => p.id !== d.iordningstalld_av && vardenhetFor(db, p.enhet_id) === ve && kanRoll(p, 'ge_cytostatika')
      && new Atkomst(db, p, d.patient_id, {}, 'las_cytostatika').prova('las_cytostatika', { enhet_id: d.enhet_id }).tillaten)
    .map(p => ({ id: p.id, namn: p.namn }));
}

// Runda 11, r4: premedicineringen ges vid sängen med en läsning av id-bandet, före den första cytostatikadosen.
export function gePremed(atk, pm, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, pm, 'ge_cytostatika');
  const c = cykelRad(db, pm.cykel_id);
  if (c.status !== 'godkand') throw new Fel(409, 'Kuren är inte godkänd av läkaren.', 'ogiltig');
  if (pm.status !== 'ordinerad') throw new Fel(409, 'Premedicineringen är redan given.', 'ogiltig');
  if (!armbandOk(db, pm.patient_id, body.armband)) throw new Fel(409, 'Id-bandet hör inte till patienten som kuren är ordinerad för. Ge inte premedicineringen.', 'fel_patient');
  const b = behandlingRad(db, c.behandling_id);
  const p = PREMED[pm.lakemedel];
  db.query("UPDATE cyto_premed SET status = 'given', given_tid = ?, given_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, pm.id);
  historik(db, b, atk.personal.id, 'premedicinering', `${p.namn} ${p.dos} ${p.vag} given före cykel ${c.nummer}.`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// Iordningställandet vid sängen: den som ska ge kuren läser id-band och etikett. Dosen väntar sedan på att en andra
// person kontrollerar den i sin egen inloggning. Ordningen i regimen, premedicineringen och hållbarheten prövas här.
export function iordningstall(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  const c = cykelRad(db, d.cykel_id);
  const b = behandlingRad(db, c.behandling_id);
  const l = lakemedelFor(regimFor(db, b), d.lakemedel);
  if (c.status !== 'godkand') throw new Fel(409, 'Kuren är inte godkänd av läkaren.', 'ogiltig');
  if (d.status !== (l.po ? 'beredd' : 'mottagen')) throw new Fel(409, l.po ? 'Tabletterna är inte iordningställda av beredningsenheten.' : d.status === 'beredd' ? 'Ta emot dosen och läs etiketten först.' : 'Dosen är redan iordningställd eller given.', 'ogiltig');
  hallbarKvar(d, l, nu);
  lasVidSangen(db, d, body);
  const fore = db.query("SELECT * FROM cyto_doser WHERE cykel_id = ? AND ordning < ? AND status NOT IN ('given', 'overlamnad', 'avbruten') ORDER BY ordning").get(c.id, d.ordning);
  if (fore) throw new Fel(409, `Ge ${lakemedelFor(regimFor(db, b), fore.lakemedel).namn.toLocaleLowerCase('sv')} först. Regimen har en bestämd ordning.`, 'ordning');
  const premed = db.query("SELECT * FROM cyto_premed WHERE cykel_id = ? AND status <> 'given' ORDER BY ordning").all(c.id);
  if (premed.length) throw new Fel(409, `Ge premedicineringen först: ${premed.map(x => `${PREMED[x.lakemedel].namn.toLowerCase()} ${PREMED[x.lakemedel].dos} ${PREMED[x.lakemedel].vag}`).join(' och ')}, ${Math.max(...premed.map(x => PREMED[x.lakemedel].minuterFore))} minuter före kuren.`, 'premed');
  db.query("UPDATE cyto_doser SET status = 'vantar_kontroll', iordningstalld_tid = ?, iordningstalld_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  historik(db, b, atk.personal.id, 'iordningstalld', `${l.namn} ${d.dos_mg} mg iordningställd vid sängen. Väntar på dubbelkontroll.`, iso(nu));
  return { ...behandlingUt(atk, b, nu), kontroll: { status: 'vantar_kontroll', iordningstalldAv: personNamn(db, atk.personal.id), kandidater: kontrollKandidater(db, dosRad(db, d.id)) } };
}

// Doser som väntar på dubbelkontroll på den inloggades vårdenhet. Den som iordningställde ser inte sin egen dos här, och
// en patient som den inloggade inte får se finns inte med alls. Varje patient som visas loggas.
export function vantandeKontroller(db, personal, valFor) {
  sakra(db);
  if (!kanRoll(personal, 'ge_cytostatika')) return { kontroller: [] };
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const ut = [];
  for (const d of db.query(`SELECT * FROM cyto_doser WHERE status = 'vantar_kontroll' AND iordningstalld_av <> ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY iordningstalld_tid`).all(personal.id, ...enheter)) {
    const r = provaRad(db, personal, valFor, d, 'las_cytostatika');
    if (!r.tillaten) continue;
    loggaPatient(db, personal, d.patient_id, 'las_cytostatika', r.grund, '/api/cytostatika/kontroller');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id);
    const b = behandlingRad(db, cykelRad(db, d.cykel_id).behandling_id);
    ut.push({ dosId: d.id, etikett: d.etikett, lakemedel: lakemedelFor(regimFor(db, b), d.lakemedel).namn, dos: d.dos_mg, iordningstalld: { tid: d.iordningstalld_tid, av: personNamn(db, d.iordningstalld_av) },
      patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) } });
  }
  return { kontroller: ut };
}

// Dubbelkontrollen görs av den andra personen i sin egen inloggning, som själv läser id-bandet och etiketten.
export function kontrollera(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  if (d.status !== 'vantar_kontroll') throw new Fel(409, 'Dosen väntar inte på dubbelkontroll.', 'ogiltig');
  if (d.iordningstalld_av === atk.personal.id) throw new Fel(409, 'Den som iordningställde dosen kan inte kontrollera den själv. En annan sjuksköterska eller läkare kontrollerar i sin egen inloggning.', 'samma_person');
  if (!kontrollKandidater(db, d).some(k => k.id === atk.personal.id)) throw new Fel(403, 'Du kan inte dubbelkontrollera dosen.', 'nekad');
  lasVidSangen(db, d, body);
  const b = behandlingRad(db, cykelRad(db, d.cykel_id).behandling_id);
  db.query("UPDATE cyto_doser SET status = 'kontrollerad', kontrollerad_tid = ?, kontrollerad_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  historik(db, b, atk.personal.id, 'kontrollerad', `${lakemedelFor(regimFor(db, b), d.lakemedel).namn} ${d.dos_mg} mg dubbelkontrollerad.`, iso(nu));
  return behandlingUt(atk, b, nu);
}

const instruktionFor = (c, l, d) => {
  const t = tabletter(d.dos_mg, l.tabletter);
  return `Ta ${t.map(x => `${x.antal} ${x.antal === 1 ? 'tablett' : 'tabletter'} à ${x.styrka} mg`).join(' och ')} morgon och kväll, inom en halvtimme efter måltid, dag ${l.dagar[0]} till ${l.dagar.at(-1)} från ${c.dag1}. Kontakta mottagningen vid feber över 38 grader, diarré eller ömhet i händer och fötter.`;
};

// När den sista dosen i kuren är given, överlämnad eller avbruten är kuren klar, och efter den sista cykeln är
// behandlingen avslutad.
function efterDos(db, b, c, nu) {
  if (db.query("SELECT 1 FROM cyto_doser WHERE cykel_id = ? AND status NOT IN ('given', 'overlamnad', 'avbruten')").get(c.id)) return;
  db.query("UPDATE cyto_cykler SET status = 'klar' WHERE id = ?").run(c.id);
  if (c.nummer >= b.cykler) {
    db.query("UPDATE cyto_behandlingar SET status = 'avslutad' WHERE id = ?").run(b.id);
    historik(db, b, null, 'avslutad', `Alla ${b.cykler} cykler är givna.`, iso(nu));
  }
}

// Överlämnandet av peroral behandling efter dubbelkontrollen. Bara den som iordningställde eller kontrollerade dosen
// lämnar över den. En infusion startas och avslutas i stället (runda 11, r4), så att start, slut och takt registreras.
export function ge(atk, d, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  const c = cykelRad(db, d.cykel_id);
  const b = behandlingRad(db, c.behandling_id);
  const l = lakemedelFor(regimFor(db, b), d.lakemedel);
  if (['given', 'overlamnad'].includes(d.status)) throw new Fel(409, 'Dosen är redan given.', 'ogiltig');
  if (d.status !== 'kontrollerad' || !d.kontrollerad_av) throw new Fel(409, 'Dosen är inte dubbelkontrollerad. Den andra personen bekräftar kontrollen i sin egen inloggning.', 'kontroll');
  if (![d.iordningstalld_av, d.kontrollerad_av].includes(atk.personal.id)) throw new Fel(403, 'Dosen ges av någon av de två som har kontrollerat den.', 'nekad');
  if (!l.po) throw new Fel(409, 'En infusion startas med Starta och avslutas med Avsluta, så att start, slut och takt registreras.', 'infusion');
  let instruktion = null;
  const annan = personNamn(db, d.kontrollerad_av === atk.personal.id ? d.iordningstalld_av : d.kontrollerad_av);
  db.transaction(() => {
    db.query("UPDATE cyto_doser SET status = 'overlamnad', given_tid = ?, given_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
    instruktion = instruktionFor(c, l, d);
    historik(db, b, atk.personal.id, 'overlamnad', `${l.namn} ${d.dos_mg} mg per tillfälle överlämnat till patienten, dubbelkontrollerad med ${annan}.`, iso(nu));
    efterDos(db, b, c, nu);
  })();
  return { ...behandlingUt(atk, behandlingRad(db, b.id), nu), instruktion };
}

// ---- Infusionen (runda 11, r4) -----------------------------------------------------------------------------------------

export const REAKTIONER = tabell({ illamaende: 'Illamående eller kräkning', allergisk: 'Allergisk reaktion (utslag, klåda, svullnad)', andning: 'Andningsbesvär', feber: 'Feber eller frossa', smarta: 'Smärta vid infarten', annat: 'Annat' });
const handelse = (atk, d, typ, nu, { takt = null, grad = null, detalj = null } = {}) => atk.db.query('INSERT INTO cyto_infusion (dos_id, patient_id, enhet_id, tid, personal_id, typ, takt, grad, detalj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(d.id, d.patient_id, d.enhet_id, iso(nu), atk.personal.id, typ, takt, grad, detalj);
// Den volym som har gått in, räknad ur händelserna: takten gånger tiden som infusionen har pågått.
export function givnaMl(db, d, slut = null) {
  let ml = 0, pagar = null;
  for (const h of db.query('SELECT * FROM cyto_infusion WHERE dos_id = ? ORDER BY id').all(d.id)) {
    const t = Date.parse(h.tid);
    if (pagar) ml += (pagar.takt * (t - pagar.t)) / TIMME;
    if (['start', 'aterupptagen', 'takt'].includes(h.typ)) pagar = { takt: h.takt, t };
    else if (['paus', 'slut', 'avbruten'].includes(h.typ)) pagar = null;
    else if (pagar) pagar.t = t;
  }
  if (pagar && slut) ml += (pagar.takt * (slut.getTime() - pagar.t)) / TIMME;
  return d.volym_ml ? Math.min(d.volym_ml, ml) : ml;
}
function infusion(atk, d, statusar) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  const c = cykelRad(db, d.cykel_id);
  const b = behandlingRad(db, c.behandling_id);
  const l = lakemedelFor(regimFor(db, b), d.lakemedel);
  if (l.po) throw new Fel(409, 'Tabletterna överlämnas till patienten. De har ingen infusion.', 'ogiltig');
  if (!statusar.includes(d.status)) throw new Fel(409, { kontrollerad: 'Infusionen har inte startat.', pagar: 'Infusionen pågår redan.', pausad: 'Infusionen är pausad.', given: 'Infusionen är avslutad.', avbruten: 'Infusionen är avbruten.' }[d.status] ?? 'Dosen är inte dubbelkontrollerad. Den andra personen bekräftar kontrollen i sin egen inloggning.', 'ogiltig');
  return { db, c, b, l };
}

// Starten, av någon av de två som har kontrollerat dosen. Systemet räknar takten ur volymen och infusionstiden.
export function startaInfusion(atk, d, nu = new Date()) {
  const { db, b, l } = infusion(atk, d, ['kontrollerad']);
  if (![d.iordningstalld_av, d.kontrollerad_av].includes(atk.personal.id)) throw new Fel(403, 'Infusionen startas av någon av de två som har kontrollerat dosen.', 'nekad');
  hallbarKvar(d, l, nu);
  const takt = Math.round((d.volym_ml / l.minuter) * 60);
  const annan = personNamn(db, d.kontrollerad_av === atk.personal.id ? d.iordningstalld_av : d.kontrollerad_av);
  db.transaction(() => {
    db.query("UPDATE cyto_doser SET status = 'pagar', start_tid = ?, takt_ml_h = ?, given_av = ? WHERE id = ?").run(iso(nu), takt, atk.personal.id, d.id);
    handelse(atk, d, 'start', nu, { takt, detalj: `Startad med ${takt} ml/h, ${tal(d.volym_ml, 1)} ml på ${l.minuter} minuter.` });
    historik(db, b, atk.personal.id, 'start', `${l.namn} ${d.dos_mg} mg startad med ${takt} ml/h, dubbelkontrollerad med ${annan}.`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

export function pausaInfusion(atk, d, body = {}, nu = new Date()) {
  const { db, b, l } = infusion(atk, d, ['pagar']);
  const orsak = textFalt(body.orsak, 200);
  if (orsak.length < 3) throw new Fel(400, 'Skriv varför infusionen pausas.', 'ogiltig', { falt: ['orsak'] });
  db.query("UPDATE cyto_doser SET status = 'pausad' WHERE id = ?").run(d.id);
  handelse(atk, d, 'paus', nu, { detalj: orsak });
  historik(db, b, atk.personal.id, 'paus', `${l.namn}: infusionen pausad. ${orsak}`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// Infusionen återupptas med full takt, eller med 50 eller 75 procent av den efter en reaktion.
export function aterupptaInfusion(atk, d, body = {}, nu = new Date()) {
  const { db, b, l } = infusion(atk, d, ['pausad']);
  const procent = body.procent == null ? 100 : Number(body.procent);
  if (![50, 75, 100].includes(procent)) throw new Fel(400, 'Välj 50, 75 eller 100 procent av takten.', 'ogiltig', { falt: ['procent'] });
  const takt = Math.round((((d.volym_ml / l.minuter) * 60) * procent) / 100);
  db.query("UPDATE cyto_doser SET status = 'pagar', takt_ml_h = ? WHERE id = ?").run(takt, d.id);
  handelse(atk, d, 'aterupptagen', nu, { takt, detalj: `Återupptagen med ${takt} ml/h${procent < 100 ? `, ${procent} procent av takten` : ''}.` });
  historik(db, b, atk.personal.id, 'aterupptagen', `${l.namn}: infusionen återupptagen med ${takt} ml/h.`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// En reaktion under infusionen, med svårighetsgrad 1 till 4. Systemet avgör vad som ska göras: grad 1 fortsätter med
// tätare kontroller, grad 2 pausar och grad 3 och 4, eller andningsbesvär och allergi från grad 3, stoppar infusionen.
export function reaktionInfusion(atk, d, body = {}, nu = new Date()) {
  const { db, b, c, l } = infusion(atk, d, ['pagar', 'pausad']);
  if (!finns(REAKTIONER, body.typ)) throw new Fel(400, 'Välj vilken reaktion patienten har.', 'ogiltig', { falt: ['typ'] });
  const grad = Number(body.grad);
  if (![1, 2, 3, 4].includes(grad)) throw new Fel(400, 'Välj svårighetsgrad 1 till 4.', 'ogiltig', { falt: ['grad'] });
  const atgard = grad >= 3 ? 'stoppa' : grad === 2 ? 'pausa' : 'fortsatt';
  const rad = {
    stoppa: 'Stoppa infusionen och låt infarten sitta. Larma läkaren, kontrollera puls, blodtryck, andning och syremättnad, och ha akutläkemedlen framme. Infusionen är avbruten och kuren tas upp med läkaren.',
    pausa: 'Pausa infusionen och kontakta läkaren. När symtomen har gått över kan infusionen återupptas med halverad takt.',
    fortsatt: 'Fortsätt infusionen och kontrollera puls, blodtryck och andning var 15:e minut.',
  }[atgard];
  db.transaction(() => {
    handelse(atk, d, 'reaktion', nu, { grad, detalj: `${REAKTIONER[body.typ]}, grad ${grad}.` });
    if (atgard === 'stoppa') {
      const ml = givnaMl(db, d, nu);
      handelse(atk, d, 'avbruten', nu, { detalj: `Avbruten efter ${tal(ml, 0)} ml.` });
      db.query("UPDATE cyto_doser SET status = 'avbruten', slut_tid = ?, given_tid = ? WHERE id = ?").run(iso(nu), iso(nu), d.id);
    } else if (atgard === 'pausa' && d.status === 'pagar') {
      handelse(atk, d, 'paus', nu, { detalj: 'Pausad efter reaktion.' });
      db.query("UPDATE cyto_doser SET status = 'pausad' WHERE id = ?").run(d.id);
    }
    historik(db, b, atk.personal.id, 'reaktion', `${l.namn}: ${REAKTIONER[body.typ].toLowerCase()}, grad ${grad}. ${atgard === 'stoppa' ? 'Infusionen avbruten.' : atgard === 'pausa' ? 'Infusionen pausad.' : 'Infusionen fortsätter.'}`, iso(nu));
    if (atgard === 'stoppa') efterDos(db, b, c, nu);
  })();
  return { ...behandlingUt(atk, behandlingRad(db, b.id), nu), rad: { atgard, text: rad } };
}

// Extravasering: läkemedlet har läckt ut utanför blodkärlet. Infusionen stoppas alltid, och systemet säger vad som ska
// göras för just det läkemedlet (demoregler).
export function extravasering(atk, d, nu = new Date()) {
  const { db, b, c, l } = infusion(atk, d, ['pagar', 'pausad']);
  const ml = givnaMl(db, d, nu);
  const antracyklin = l.kumulativ != null;
  const rad = antracyklin
    ? `Stoppa infusionen och låt kanylen sitta. Aspirera så mycket som går, ta sedan bort kanylen, kyl området och kontakta läkaren nu. ${l.namn} är vävnadsskadande, och dexrazoxan ska ges inom sex timmar enligt vårdgivarens rutin. Markera området och fotografera det.`
    : `Stoppa infusionen och låt kanylen sitta. Aspirera så mycket som går, ta sedan bort kanylen, lägg kyla på området och kontakta läkaren. Markera området och följ upp huden.`;
  db.transaction(() => {
    handelse(atk, d, 'extravasering', nu, { detalj: `Extravasering efter ${tal(ml, 0)} ml.` });
    handelse(atk, d, 'avbruten', nu, { detalj: `Avbruten efter ${tal(ml, 0)} ml.` });
    db.query("UPDATE cyto_doser SET status = 'avbruten', slut_tid = ?, given_tid = ? WHERE id = ?").run(iso(nu), iso(nu), d.id);
    historik(db, b, atk.personal.id, 'extravasering', `${l.namn}: extravasering efter ${tal(ml, 0)} av ${tal(d.volym_ml, 0)} ml. Infusionen avbruten.`, iso(nu));
    efterDos(db, b, c, nu);
  })();
  return { ...behandlingUt(atk, behandlingRad(db, b.id), nu), rad: { atgard: 'stoppa', text: rad } };
}

export function avslutaInfusion(atk, d, nu = new Date()) {
  const { db, b, c, l } = infusion(atk, d, ['pagar']);
  db.transaction(() => {
    handelse(atk, d, 'slut', nu, { detalj: `Avslutad. ${tal(d.volym_ml, 1)} ml har gått in.` });
    db.query("UPDATE cyto_doser SET status = 'given', slut_tid = ?, given_tid = ? WHERE id = ?").run(iso(nu), iso(nu), d.id);
    const min = Math.round((nu.getTime() - Date.parse(d.start_tid)) / MIN);
    historik(db, b, atk.personal.id, 'given', `${l.namn} ${d.dos_mg} mg given på ${min} minuter.`, iso(nu));
    efterDos(db, b, c, nu);
  })();
  return behandlingUt(atk, behandlingRad(db, b.id), nu);
}

// Nästa cykel planeras av systemet när kuren är klar, med längd och vikt från journalen så att doserna följer patienten.
export function nastaCykel(atk, b, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, b, 'ordinera_cytostatika');
  const sista = db.query('SELECT * FROM cyto_cykler WHERE behandling_id = ? ORDER BY nummer DESC').get(b.id);
  if (b.status !== 'pagaende' || sista.status !== 'klar') throw new Fel(409, b.status !== 'pagaende' ? 'Behandlingen är avslutad.' : 'Den pågående cykeln är inte klar.', 'ogiltig');
  const dag1 = addDagar(sista.dag1, regimFor(db, b).intervall);
  db.transaction(() => {
    const c = nyCykel(atk, b, sista.nummer + 1, dag1, nu);
    const andring = Math.abs(c.vikt - sista.vikt) / sista.vikt;
    historik(db, b, atk.personal.id, 'ny_cykel', `Cykel ${c.nummer} planerad till ${dag1}.${andring >= 0.05 ? ` Vikten har ändrats från ${sista.vikt} till ${c.vikt} kg, så doserna är omräknade.` : ''}`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

// ---- Patientens uppföljning i Min journal (runda 11, r4) ---------------------------------------------------------------

// Systemets bedömning av patientens rapport (demoregel): feber från 38 grader är bråttom, fyra eller fler lösa avföringar
// per dygn, kraftigt illamående eller ömhet i händer och fötter av grad 2 är skäl att höra av sig samma dag.
export const RAPPORTRAD = tabell({
  ring_nu: 'Ring mottagningen nu. Feber under cytostatikabehandling kan betyda en infektion när de vita blodkropparna är få. Ta inga fler tabletter förrän du har pratat med mottagningen.',
  ring_idag: 'Gör ett uppehåll med tabletterna och ring mottagningen i dag, så bedömer de om dosen behöver ändras.',
  ok: 'Fortsätt som vanligt. Hör av dig till mottagningen om du får feber eller om besvären ökar.',
});
export function bedomRapport({ feber, diarre, illamaende, handfot }) {
  if (feber != null && feber >= 38) return 'ring_nu';
  if (diarre >= 4 || illamaende >= 3 || handfot >= 2) return 'ring_idag';
  return 'ok';
}
const RAPPORT_TAK_PER_DAG = 3;
const rapportUt = (r) => ({ id: r.id, datum: r.datum, tid: r.tid, morgon: Boolean(r.morgon), kvall: Boolean(r.kvall), feber: r.feber, diarre: r.diarre, illamaende: r.illamaende, handfot: r.handfot,
  bedomning: r.bedomning, rad: RAPPORTRAD[r.bedomning] });
const minDoser = (atk) => { sakra(atk.db); return atk.db.query("SELECT * FROM cyto_doser WHERE patient_id = ? AND status = 'overlamnad' ORDER BY given_tid DESC, id DESC").all(atk.patientId); };

export const minHuvud = (atk) => ({ cytostatika: atk.relation !== 'ombud' && minDoser(atk).length > 0 });

// GET /api/min/journal/:id/cytostatika. Den överlämnade perorala behandlingen: instruktionen, dagarna och patientens
// egna rapporter med systemets råd.
export function minBehandling(atk, nu = new Date()) {
  const db = atk.db;
  const idag = datumAv(nu);
  return {
    behandlingar: minDoser(atk).map(d => {
      const c = cykelRad(db, d.cykel_id);
      const b = behandlingRad(db, c.behandling_id);
      const r = regimFor(db, b);
      const l = lakemedelFor(r, d.lakemedel);
      const rapporter = db.query('SELECT * FROM cyto_patientrapporter WHERE dos_id = ? ORDER BY id DESC').all(d.id).map(rapportUt);
      const dagar = l.dagar.map(n => addDagar(c.dag1, n - 1));
      return { dosId: d.id, regim: r.namn, cykel: c.nummer, lakemedel: l.namn, vardenhet: enhetsnamn(db, b.enhet_id), fran: dagar[0], till: dagar.at(-1), instruktion: instruktionFor(c, l, d),
        tabletter: tabletter(d.dos_mg, l.tabletter), idag: dagar.includes(idag) ? idag : null,
        dagar: dagar.filter(x => x <= idag).map(x => { const s = rapporter.find(y => y.datum === x); return { datum: x, morgon: s?.morgon ?? false, kvall: s?.kvall ?? false, bedomning: s?.bedomning ?? null }; }),
        rapporter };
    }),
    text: 'Skriv varje dag om du har tagit tabletterna och hur du mår. Mottagningen ser det du skriver, och systemet säger direkt om du ska ringa.',
  };
}

const grad = (v, max, falt) => { const n = v == null || v === '' ? 0 : Number(v); if (!Number.isInteger(n) || n < 0 || n > max) throw new Fel(400, 'Kontrollera värdena i rapporten.', 'ogiltig', { falt: [falt] }); return n; };
// POST /api/min/journal/:id/cytostatika/rapport. Patienten rapporterar intag och mående för en dag i cykeln.
export function minRapport(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  if (atk.relation === 'ombud') throw new Fel(403, 'Som ombud ser du bara det som fullmakten gäller, aldrig journalen.', 'nekad');
  const d = minDoser(atk).find(x => x.id === Number(body.dosId));
  if (!d) throw new Fel(404, 'Behandlingen finns inte.', 'saknas');
  const c = cykelRad(db, d.cykel_id);
  const l = lakemedelFor(regimFor(db, behandlingRad(db, c.behandling_id)), d.lakemedel);
  const dagar = l.dagar.map(n => addDagar(c.dag1, n - 1));
  const datum = body.datum ?? datumAv(nu);
  if (!dagar.includes(datum) || datum > datumAv(nu)) throw new Fel(400, 'Välj en dag i behandlingen som har varit.', 'ogiltig', { falt: ['datum'] });
  const feber = body.feber == null || body.feber === '' ? null : Number(String(body.feber).replace(',', '.'));
  if (feber != null && (!Number.isFinite(feber) || feber < 34 || feber > 43)) throw new Fel(400, 'Temperaturen ska vara mellan 34 och 43 grader.', 'ogiltig', { falt: ['feber'] });
  const v = { morgon: body.morgon ? 1 : 0, kvall: body.kvall ? 1 : 0, feber, diarre: grad(body.diarre, 20, 'diarre'), illamaende: grad(body.illamaende, 3, 'illamaende'), handfot: grad(body.handfot, 3, 'handfot') };
  if (db.query('SELECT count(*) AS n FROM cyto_patientrapporter WHERE dos_id = ? AND datum = ?').get(d.id, datum).n >= RAPPORT_TAK_PER_DAG) throw new Fel(429, `Du kan skicka högst ${RAPPORT_TAK_PER_DAG} rapporter för samma dag. Ring mottagningen om något har ändrats.`, 'tak');
  const bedomning = bedomRapport(v);
  db.query('INSERT INTO cyto_patientrapporter (dos_id, patient_id, enhet_id, datum, tid, invanare_id, morgon, kvall, feber, diarre, illamaende, handfot, bedomning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(d.id, d.patient_id, d.enhet_id, datum, iso(nu), atk.invanare.id, v.morgon, v.kvall, v.feber, v.diarre, v.illamaende, v.handfot, bedomning);
  return { bedomning, text: RAPPORTRAD[bedomning], behandling: minBehandling(atk, nu).behandlingar.find(x => x.dosId === d.id) };
}

// ---- Utdata ----------------------------------------------------------------------------------------------------------

const STATUSTEXT = tabell({ planerad: 'Planerad', godkand: 'Godkänd', klar: 'Klar' });
const DOSTEXT = tabell({ ordinerad: 'Ordinerad', att_bereda: 'Hos beredningsenheten', beredd: 'Beredd', mottagen: 'Mottagen på avdelningen', vantar_kontroll: 'Väntar på dubbelkontroll',
  kontrollerad: 'Dubbelkontrollerad', pagar: 'Infusionen pågår', pausad: 'Infusionen är pausad', given: 'Given', overlamnad: 'Överlämnad till patienten', avbruten: 'Avbruten' });

// Avvikelser från föregående kur, så att den som ordinerar och den som ger ser vad som har ändrats.
function avvikelserFran(fore, c, doser, foreDoser) {
  if (!fore) return [];
  const ut = [];
  if (c.dosandel !== fore.dosandel) ut.push(`Dosen är ${c.dosandel} procent av full dos, förra kuren ${fore.dosandel} procent.`);
  if (Math.abs(c.vikt - fore.vikt) / fore.vikt >= 0.05) ut.push(`Vikten har ändrats från ${tal(fore.vikt, 1)} till ${tal(c.vikt, 1)} kg.`);
  for (const d of doser) {
    const f = foreDoser.find(x => x.lakemedel === d.lakemedel);
    if (f && f.dos_mg !== d.dos_mg) ut.push(`${d.namn} ${tal(d.dos_mg, 0)} mg, förra kuren ${tal(f.dos_mg, 0)} mg.`);
  }
  if (c.uppskjuten) ut.push(`Kuren är uppskjuten ${c.uppskjuten === 1 ? 'en gång' : `${c.uppskjuten} gånger`}: ${c.uppskjuten_orsak}`);
  return ut;
}

export function behandlingUt(atk, b, nu = new Date()) {
  const db = atk.db;
  const r = regimFor(db, b);
  const cykler = db.query('SELECT * FROM cyto_cykler WHERE behandling_id = ? ORDER BY nummer').all(b.id);
  const intern = beredsInternt(db, b.enhet_id);
  const beredning = (id) => db.query("SELECT * FROM sqlite_master WHERE type = 'table' AND name = 'cyto_beredningar'").get() ? db.query('SELECT * FROM cyto_beredningar WHERE dos_id = ?').get(id) : null;
  return {
    id: b.id, regim: { id: b.regim, namn: r.namn, intervall: r.intervall, version: versionNummer(db, b) }, cykler: b.cykler, start: b.start, status: b.status, vardenhet: enhetKort(db, b.enhet_id),
    ordinerad: { tid: b.skapad, av: personNamn(db, b.ordinerad_av) },
    beredningsenhet: intern ? enhetsnamn(db, BEREDNINGSENHET_ID) : BEREDNINGSENHET, beredsInternt: intern,
    kumulativ: kumulativUt(atk, b, r, cykler),
    kurer: cykler.map((c, i) => {
      const doser = db.query('SELECT * FROM cyto_doser WHERE cykel_id = ? ORDER BY ordning').all(c.id);
      const fore = i > 0 ? cykler[i - 1] : null;
      return { id: c.id, nummer: c.nummer, dag1: c.dag1, kroppsyta: c.bsa, langd: c.langd, vikt: c.vikt, gfr: c.gfr, dosandel: c.dosandel, dosandelOrsak: c.dosandel_orsak,
        status: c.status, statusText: STATUSTEXT[c.status], godkand: c.godkand_tid ? { tid: c.godkand_tid, av: personNamn(db, c.godkand_av) } : null, uppskjuten: c.uppskjuten, uppskjutenOrsak: c.uppskjuten_orsak,
        dagar: [...new Set(r.lakemedel.flatMap(l => l.dagar))].sort((x, y) => x - y).map(d => addDagar(c.dag1, d - 1)).slice(0, 3),
        avvikelser: avvikelserFran(fore, c, doser.map(d => ({ ...d, namn: lakemedelFor(r, d.lakemedel).namn })), fore ? db.query('SELECT * FROM cyto_doser WHERE cykel_id = ?').all(fore.id) : []),
        kapacitet: c.status === 'planerad' && intern && harInfusion(r) ? kapacitetFor(db, c.dag1) : null,
        premedicinering: db.query('SELECT * FROM cyto_premed WHERE cykel_id = ? ORDER BY ordning').all(c.id).map(p => ({ id: p.id, namn: PREMED[p.lakemedel].namn, dos: PREMED[p.lakemedel].dos, vag: PREMED[p.lakemedel].vag,
          minuterFore: PREMED[p.lakemedel].minuterFore, status: p.status, given: p.given_tid ? { tid: p.given_tid, av: personNamn(db, p.given_av) } : null })),
        doser: doser.map(d => {
          const l = lakemedelFor(r, d.lakemedel);
          const ber = beredning(d.id);
          return { id: d.id, ordning: d.ordning, lakemedel: l.namn, dos: d.dos_mg, berakning: d.berakning, peroral: Boolean(l.po), status: d.status, statusText: DOSTEXT[d.status], etikett: d.etikett,
            volym: d.volym_ml, takt: d.takt_ml_h, start: d.start_tid, slut: d.slut_tid, infusionMinuter: l.minuter ?? null, iordningstalldAv: d.iordningstalld_av ? personNamn(db, d.iordningstalld_av) : null,
            kontrolleradAv: d.kontrollerad_av ? personNamn(db, d.kontrollerad_av) : null,
            beredning: ber ? { tid: ber.tid, av: personNamn(db, ber.beredd_av), batcher: JSON.parse(ber.batcher).map(x => x.batch) } : null,
            infusion: db.query('SELECT * FROM cyto_infusion WHERE dos_id = ? ORDER BY id').all(d.id).map(h => ({ tid: h.tid, typ: h.typ, av: personNamn(db, h.personal_id), takt: h.takt, grad: h.grad, text: h.detalj })),
            given: d.given_tid ? { tid: d.given_tid, av: personNamn(db, d.given_av), kontrolleradAv: personNamn(db, d.kontrollerad_av) } : null,
            patientrapporter: l.po ? db.query('SELECT * FROM cyto_patientrapporter WHERE dos_id = ? ORDER BY id DESC').all(d.id).map(rapportUt) : [] };
        }) };
    }),
    historik: db.query('SELECT * FROM cyto_historik WHERE behandling_id = ? ORDER BY id').all(b.id).map(h => ({ tid: h.tid, av: h.personal_id ? personNamn(db, h.personal_id) : BEREDNINGSENHET, handelse: h.handelse, detalj: h.detalj })),
    demoregel: DEMOREGEL,
  };
}

export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_cytostatika');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM cyto_behandlingar WHERE patient_id = ? ORDER BY skapad DESC').all(atk.patientId), 'las_cytostatika');
  return { behandlingar: rader.map(b => behandlingUt(atk, b, nu)), regimer: regimer(atk.db), reaktioner: Object.entries(REAKTIONER).map(([id, namn]) => ({ id, namn })),
    // Runda 11, r4: svaret om tidigare behandling hos andra vårdgivare, som läkemedelslistan visar det.
    tidigareBehandling: tidigareUt(atk.db, tidigareFor(atk)), demoregel: DEMOREGEL };
}

// Runda 11, r4: om patienten har en cytostatikabehandling som den inloggade får se, för journalens flikar.
export function iHuvud(atk) {
  sakra(atk.db);
  if (!kanRoll(atk.personal, 'las_cytostatika')) return false;
  return atk.filtrera(atk.db.query('SELECT * FROM cyto_behandlingar WHERE patient_id = ?').all(atk.patientId), 'las_cytostatika').length > 0;
}

// Planering och uppföljning per vårdenhet, utan personuppgifter: pågående behandlingar per regim, planerade kurer de
// kommande fyra veckorna, givna kurer och beredningar, dosjusteringar och uppskjutna cykler under perioden.
export function uppfoljning(db, personal, { fran = null, till = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'statistik', 'Din yrkesroll har inte uppföljningen.');
  const t = till ?? datumAv(nu), f = fran ?? addDagar(t, -90);
  if (![f, t].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) || f > t) throw new Fel(400, 'Ange perioden som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const start = lokalTid(f, '00:00'), slut = lokalTid(addDagar(t, 1), '00:00');
  const beh = db.query(`SELECT * FROM cyto_behandlingar WHERE enhet_id IN (${ph})`).all(...enheter);
  const cykler = db.query(`SELECT c.*, b.regim FROM cyto_cykler c JOIN cyto_behandlingar b ON b.id = c.behandling_id WHERE c.enhet_id IN (${ph})`).all(...enheter);
  const doser = db.query(`SELECT * FROM cyto_doser WHERE enhet_id IN (${ph})`).all(...enheter);
  const idag = datumAv(nu), om4 = addDagar(idag, 28);
  const iPerioden = (x) => x && x >= start && x < slut;
  const handelser = db.query(`SELECT * FROM cyto_infusion WHERE enhet_id IN (${ph})`).all(...enheter).filter(h => iPerioden(h.tid));
  return {
    vardenhet: enhetKort(db, vardenhetFor(db, personal.enhet_id)), fran: f, till: t,
    pagaende: Object.entries(REGIMER).map(([id, r]) => ({ id, namn: r.namn, antal: beh.filter(b => b.regim === id && b.status === 'pagaende').length })).filter(x => x.antal),
    planeradeKurer: cykler.filter(c => c.status !== 'klar' && c.dag1 >= idag && c.dag1 < om4).length,
    givnaKurer: cykler.filter(c => c.status === 'klar' && doser.filter(d => d.cykel_id === c.id).some(d => iPerioden(d.given_tid))).length,
    beredningar: doser.filter(d => iPerioden(d.beredd_tid) && d.volym_ml != null).length,
    dosjusteringar: cykler.filter(c => c.dosandel < 100 && c.dag1 >= f && c.dag1 <= t).length,
    uppskjutna: cykler.filter(c => c.dag1 >= f && c.dag1 <= t).reduce((x, c) => x + c.uppskjuten, 0),
    // Runda 11, r4: avbrutna infusioner, reaktioner och extravaseringar under perioden.
    avbrutna: handelser.filter(h => h.typ === 'avbruten').length, reaktioner: handelser.filter(h => h.typ === 'reaktion').length, extravaseringar: handelser.filter(h => h.typ === 'extravasering').length,
    text: 'Uppföljningen räknas av systemet ur ordinationerna, beredningarna och administreringen. Den innehåller inga personuppgifter.',
  };
}

// Runda 11, r4: vårdenhetens vy för cytostatika. Kurerna från en vecka bakåt till två veckor framåt med vad som ska
// göras härnäst, de doser som väntar på dubbelkontroll och beredningsenhetens lediga platser. En patient som den
// inloggade inte får se finns inte med, och varje patient som visas loggas.
const NASTA = (c, doser, prov) => {
  if (c.status === 'planerad') return prov.ok ? 'Godkänn kuren.' : prov.saknasAnalyser.length ? 'Proverna före kuren saknas.' : 'Provsvaren tillåter inte kuren.';
  if (c.status === 'klar') return 'Kuren är klar. Planera nästa cykel.';
  const s = new Set(doser.map(d => d.status));
  if (s.has('att_bereda')) return 'Väntar på beredningen.';
  if (s.has('beredd')) return 'Beredd. Ta emot och läs etiketten.';
  if (s.has('pagar') || s.has('pausad')) return 'Infusionen pågår.';
  if (s.has('vantar_kontroll')) return 'Väntar på dubbelkontroll.';
  return 'Ge kuren.';
};
export function enhetsvy(db, personal, valFor, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_cytostatika', 'Din yrkesroll läser inte cytostatikabehandlingar.');
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const idag = datumAv(nu);
  const kurer = [];
  for (const c of db.query(`SELECT * FROM cyto_cykler WHERE enhet_id IN (${enheter.map(() => '?').join(', ')}) AND dag1 >= ? AND dag1 <= ? ORDER BY dag1, id`).all(...enheter, addDagar(idag, -7), addDagar(idag, 14))) {
    const b = behandlingRad(db, c.behandling_id);
    if (b.status !== 'pagaende' && c.status === 'klar') continue;
    const g = provaRad(db, personal, valFor, c, 'las_cytostatika');
    if (!g.tillaten) continue;
    loggaPatient(db, personal, c.patient_id, 'las_cytostatika', g.grund, '/api/cytostatika/enhet');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(c.patient_id);
    const atk = new Atkomst(db, personal, c.patient_id, valFor(c.patient_id), 'las_cytostatika');
    const prov = c.status === 'planerad' ? provkontroll(atk, c, nu) : { ok: true, saknasAnalyser: [] };
    const doser = db.query('SELECT status FROM cyto_doser WHERE cykel_id = ?').all(c.id);
    kurer.push({ cykelId: c.id, patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) }, regim: regimFor(db, b).namn, cykel: c.nummer, cykler: b.cykler, dag1: c.dag1,
      status: c.status, statusText: STATUSTEXT[c.status], nasta: NASTA(c, doser, prov) });
  }
  const intern = beredsInternt(db, ve);
  return {
    vardenhet: enhetKort(db, ve), kurer, kontroller: vantandeKontroller(db, personal, valFor).kontroller,
    beredning: { enhet: intern ? enhetsnamn(db, BEREDNINGSENHET_ID) : BEREDNINGSENHET, intern, kapacitet: intern ? Array.from({ length: 7 }, (_, i) => kapacitetFor(db, addDagar(idag, i))) : [] },
    uppfoljning: kanRoll(personal, 'statistik') ? uppfoljning(db, personal, {}, nu) : null,
    text: 'Kurerna från en vecka bakåt till två veckor framåt, med vad som ska göras härnäst. Systemet räknar allt ur ordinationerna, beredningen och administreringen.',
    demoregel: DEMOREGEL,
  };
}
