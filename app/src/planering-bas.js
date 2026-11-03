// Planering och tidbok, del 2 (runda 6, r4): den del som tidbok.js använder när den föreslår och bokar tider.
//
// Systemet är experten. Den som bokar behöver inte veta vilket rum eller vilken utrustning ett ingrepp kräver, att
// patienten behöver sjukresa eller att provtagningen ska vara klar en stund före läkarbesöket:
//   - En tidstyp anger vad den kräver. Ett ingrepp (tidstypen ingrepp) kräver det som ingreppet behöver, till exempel
//     behandlingsrum och defibrillator för en elkonvertering. Systemet föreslår bara tider där personal, lokal och
//     utrustning är lediga hela tiden, och bokar allt samtidigt.
//   - En patient som behöver sjukresa får den bokad till varje fysiskt besök (simulerad).
//   - En bokningsmall ger tider i följd: systemet föreslår huvudbesöket och tiden före det med rätt mellanrum, och
//     bokar båda med ett klick.
//   - Kallelsen skrivs på patientens språk.
//
// Modulen läser tidbokens tabeller med SQL och använder inte tidbok.js, så att tidbok.js kan använda den.
import { Fel, iso, addDagar, datumAv, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder } from './atkomst.js';
import * as SEED from './seed/planering.js';

export { KATEGORIER, RESURSTYP, INGREPP, MALLAR } from './seed/planering.js';
const { KATEGORIER, INGREPP, MALLAR } = SEED;
const MIN = 60_000;

export const SCHEMA_PLANERING = `
CREATE TABLE IF NOT EXISTS resurser (
  id TEXT PRIMARY KEY, enhet_id TEXT NOT NULL, kategori TEXT NOT NULL, namn TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0, aktiv INTEGER NOT NULL DEFAULT 1
);
-- En resurs är upptagen under en bokning som gäller, eller utan bokning (bokning_id NULL), till exempel vid service.
CREATE TABLE IF NOT EXISTS resursbokningar (
  id INTEGER PRIMARY KEY, resurs_id TEXT NOT NULL, bokning_id INTEGER, start TEXT NOT NULL, slut TEXT NOT NULL, text TEXT
);
CREATE INDEX IF NOT EXISTS ix_resursbokningar ON resursbokningar (resurs_id, start);
CREATE INDEX IF NOT EXISTS ix_resursbokningar_bokning ON resursbokningar (bokning_id);
CREATE TABLE IF NOT EXISTS transportbehov (patient_id TEXT PRIMARY KEY, text TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT);
-- Det en post på väntelistan behöver utöver tidstyp och yrkesroll: ett ingrepp eller en bokningsmall.
CREATE TABLE IF NOT EXISTS vantelista_behov (vantelista_id INTEGER PRIMARY KEY, ingrepp TEXT, mall TEXT);
-- Tider i följd: bokningen före (till exempel provtagningen) pekar på huvudbokningen.
CREATE TABLE IF NOT EXISTS bokningskedjor (bokning_id INTEGER PRIMARY KEY, huvud_id INTEGER NOT NULL, mall TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_bokningskedjor_huvud ON bokningskedjor (huvud_id);
CREATE TABLE IF NOT EXISTS sprakval (patient_id TEXT PRIMARY KEY, sprak TEXT NOT NULL, andrad TEXT, andrad_av_invanare TEXT);
CREATE TABLE IF NOT EXISTS kallelse_sprak (kallelse_id INTEGER PRIMARY KEY, sprak TEXT NOT NULL);
-- Kallelse utan förbokad tid: patienten väljer själv en tid i Min journal inom ramen.
CREATE TABLE IF NOT EXISTS kallelser_ram (
  id INTEGER PRIMARY KEY, vantelista_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL,
  kanal TEXT, mottagare TEXT, text TEXT NOT NULL, sprak TEXT NOT NULL DEFAULT 'sv', status TEXT NOT NULL, skapad TEXT NOT NULL, skapad_av TEXT,
  bokning_id INTEGER, forklaring TEXT,
  CHECK (status IN ('skickad', 'bokad', 'aterkallad'))
);
CREATE TRIGGER IF NOT EXISTS kallelse_ram_raderas_ej BEFORE DELETE ON kallelser_ram BEGIN SELECT RAISE(ABORT, 'En kallelse raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS kallelse_ram_andras_ej BEFORE UPDATE OF text, kanal, mottagare, fran, till ON kallelser_ram
  BEGIN SELECT RAISE(ABORT, 'En skickad kallelse ändras inte'); END;
-- Bevakningar som personalen lägger upp själv, för en patient eller för hela vårdenheten. ansvarig_id NULL betyder
-- vårdenheten.
CREATE TABLE IF NOT EXISTS egna_bevakningar (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, patient_id TEXT, text TEXT NOT NULL, datum TEXT NOT NULL, ansvarig_id TEXT,
  skapad TEXT NOT NULL, skapad_av TEXT NOT NULL, klar TEXT, klar_av TEXT
);
CREATE TRIGGER IF NOT EXISTS egen_bevakning_raderas_ej BEFORE DELETE ON egna_bevakningar BEGIN SELECT RAISE(ABORT, 'En bevakning raderas inte'); END;
-- Vad användaren har valt att tidboken och Dagens arbete ska visa.
CREATE TABLE IF NOT EXISTS vyinstallningar (personal_id TEXT NOT NULL, vy TEXT NOT NULL, data TEXT NOT NULL, andrad TEXT NOT NULL, PRIMARY KEY (personal_id, vy));
`;

// Skapar tabellerna. Returnerar true om de inte fanns förut.
export function sakraPlanering(db) {
  const fanns = Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'resurser'").get());
  db.exec(SCHEMA_PLANERING);
  return !fanns;
}

const veckodag = (datum) => new Date(`${datum}T12:00:00Z`).getUTCDay();
function vardag(datum) {
  let d = datum;
  while ([0, 6].includes(veckodag(d))) d = addDagar(d, 1);
  return d;
}

// Seeden (seed/planering.js), relativt till bas. Körs efter tidbokens seed, så att scheman och bokningar finns. Den går
// att köra igen: det som redan finns läggs inte in två gånger.
export function seedaPlanering(db, { bas = new Date(), dagar = 75 } = {}) {
  sakraPlanering(db);
  const basDatum = datumAv(bas);
  for (const r of SEED.RESURSER) db.query('INSERT OR IGNORE INTO resurser (id, enhet_id, kategori, namn, demo) VALUES (?, ?, ?, ?, ?)').run(r.id, r.enhet, r.kategori, r.namn, r.demo ? 1 : 0);
  const p = SEED.PROVTAGNING_PERSONAL;
  db.query('INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, 0, 1)').run(p.id, p.namn, p.yrke, p.titel, p.enhet, p.hsa);
  const s = SEED.PROVTAGNING_SCHEMA;
  db.query('INSERT OR IGNORE INTO scheman VALUES (?, ?, ?, ?)').run(s.id, s.enhet, s.personal, s.yrkesroll);
  const insT = db.query('INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, ?, 1, NULL, 0)');
  const finns = (schema, start) => db.query('SELECT 1 FROM tider WHERE schema_id = ? AND start = ?').get(schema, start);
  const schemaDagar = { 'sch-kard-sara': [1, 2, 3, 4, 5], 'sch-kard-magnus': [1, 3, 5] };
  for (let d = 1; d <= dagar; d++) {
    const datum = addDagar(basDatum, d);
    if (s.dagar.includes(veckodag(datum))) {
      for (const k of s.klockor) { const start = lokalTid(datum, k); if (!finns(s.id, start)) insT.run(s.id, start, new Date(Date.parse(start) + 15 * MIN).toISOString(), 'provtagning'); }
    }
    for (const it of SEED.INGREPPSTIDER) {
      if (!db.query('SELECT 1 FROM scheman WHERE id = ?').get(it.schema) || !(schemaDagar[it.schema] ?? []).includes(veckodag(datum))) continue;
      const start = lokalTid(datum, it.klocka);
      if (!finns(it.schema, start)) insT.run(it.schema, start, new Date(Date.parse(start) + 90 * MIN).toISOString(), 'ingrepp');
    }
  }
  for (const u of SEED.RESURS_UPPTAGEN) {
    const datum = vardag(addDagar(basDatum, u.dag));
    const start = lokalTid(datum, u.fran);
    if (!db.query('SELECT 1 FROM resursbokningar WHERE resurs_id = ? AND bokning_id IS NULL AND start = ?').get(u.resurs, start)) {
      db.query('INSERT INTO resursbokningar (resurs_id, bokning_id, start, slut, text) VALUES (?, NULL, ?, ?, ?)').run(u.resurs, start, lokalTid(datum, u.till), u.text);
    }
  }
  for (const v of SEED.VANTELISTA) {
    if (db.query('SELECT 1 FROM vantelista WHERE patient_id = ? AND orsak = ?').get(v.patient, v.orsak)) continue;
    const fran = addDagar(basDatum, v.fran);
    const skapad = lokalTid(fran, '11:00');
    const id = Number(db.query(`INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, onskad_personal_id, fran, mal, skapad, skapad_av)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(v.patient, v.enhet, v.tidstyp, v.yrkesroll, v.prioritet, v.orsak, v.onskad ?? null, fran, addDagar(basDatum, v.mal), skapad, v.skapadAv).lastInsertRowid);
    db.query('INSERT INTO vantelista_handelser (vantelista_id, tid, av, typ, detalj) VALUES (?, ?, ?, ?, ?)').run(id, skapad, v.skapadAv, 'skapad', v.orsak);
    db.query('INSERT OR REPLACE INTO vantelista_behov (vantelista_id, ingrepp, mall) VALUES (?, ?, ?)').run(id, v.ingrepp ?? null, v.mall ?? null);
  }
  for (const t of SEED.TRANSPORTBEHOV) db.query('INSERT OR IGNORE INTO transportbehov VALUES (?, ?, ?, NULL)').run(t.patient, t.text, bas.toISOString());
  for (const sv of SEED.SPRAKVAL) db.query('INSERT OR IGNORE INTO sprakval (patient_id, sprak) VALUES (?, ?)').run(sv.patient, sv.sprak);
  if (!db.query('SELECT 1 FROM egna_bevakningar LIMIT 1').get()) {
    for (const b of SEED.EGNA_BEVAKNINGAR) {
      db.query('INSERT INTO egna_bevakningar (enhet_id, patient_id, text, datum, ansvarig_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(b.enhet, b.patient, b.text, addDagar(basDatum, b.datum), b.ansvarig, lokalTid(addDagar(basDatum, -1), '15:00'), b.skapadAv);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Vad en bokning kräver

export const harTabeller = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'resurser'").get());
export const behovForPost = (db, postId) => (harTabeller(db) && postId ? db.query('SELECT * FROM vantelista_behov WHERE vantelista_id = ?').get(postId) ?? null : null);
export const transportFor = (db, patientId) => (harTabeller(db) && patientId ? db.query('SELECT * FROM transportbehov WHERE patient_id = ?').get(patientId) ?? null : null);

// Finns det resurser av kategorin på vårdenheten?
const harKategori = (db, ve, kategori) => {
  const enheter = enheterUnder(db, ve);
  return Boolean(db.query(`SELECT 1 FROM resurser WHERE enhet_id IN (${enheter.map(() => '?').join(', ')}) AND kategori = ? AND aktiv = 1`).get(...enheter, kategori));
};

// Saknar vårdenheten något som ingreppet kräver? Ger en förklaring, eller null när allt finns.
export function kravSaknas(db, ve, ingrepp) {
  const i = INGREPP[ingrepp];
  if (!i) return 'Ingreppet finns inte.';
  if (!harTabeller(db)) return 'Vårdenheten har inga resurser för ingrepp.';
  const v = vardenhetFor(db, ve);
  const saknas = i.krav.filter(k => !harKategori(db, v, k)).map(k => KATEGORIER[k].text.toLowerCase());
  if (!saknas.length) return null;
  const namn = db.query('SELECT namn FROM enheter WHERE id = ?').get(v)?.namn ?? 'Vårdenheten';
  return `${namn} har inte ${saknas.length > 1 ? `${saknas.slice(0, -1).join(', ')} och ${saknas.at(-1)}` : saknas[0]} för ${i.text.toLowerCase()}. Remittera till en vårdenhet som gör ingreppet.`;
}

// Resurskategorierna som en tid kräver: ingreppets resurser, och sjukresa till ett fysiskt besök när patienten behöver
// det och vårdenheten har sjukresor. fysisk säger om tidstypen är ett fysiskt besök.
export function kravFor(db, { ve, ingrepp = null, patientId = null, fysisk = true }) {
  if (!harTabeller(db)) return [];
  const krav = [...(INGREPP[ingrepp]?.krav ?? [])];
  if (fysisk && transportFor(db, patientId) && harKategori(db, ve, 'transport')) krav.push('transport');
  return krav;
}

// Det som en bokning som redan finns har reserverat, som kategorier, för ombokningen.
export function kravForBokning(db, bokningId) {
  if (!harTabeller(db)) return [];
  return db.query('SELECT r.kategori FROM resursbokningar rb JOIN resurser r ON r.id = rb.resurs_id WHERE rb.bokning_id = ? ORDER BY rb.id').all(bokningId).map(r => r.kategori);
}

// Tiden som resursen behövs: tiden för besöket, och för en sjukresa en marginal före och efter.
const intervall = (kategori, start, slut) => {
  const m = (KATEGORIER[kategori]?.marginal ?? 0) * MIN;
  return { start: new Date(Date.parse(start) - m).toISOString(), slut: new Date(Date.parse(slut) + m).toISOString() };
};

// En ledig resurs av kategorin på vårdenheten under hela intervallet. uteslut är resurser som redan är valda för samma
// bokning och uteslutBokning den bokning som flyttas.
export function ledigResurs(db, ve, kategori, start, slut, { uteslut = [], uteslutBokning = 0 } = {}) {
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const i = intervall(kategori, start, slut);
  return db.query(`SELECT r.* FROM resurser r WHERE r.enhet_id IN (${ph}) AND r.kategori = ? AND r.aktiv = 1 AND NOT EXISTS (
      SELECT 1 FROM resursbokningar rb LEFT JOIN bokningar b ON b.id = rb.bokning_id
      WHERE rb.resurs_id = r.id AND rb.start < ? AND rb.slut > ?
        AND (rb.bokning_id IS NULL OR (b.status IN ('bokad', 'incheckad') AND b.id <> ?))
    ) ORDER BY r.id`).all(...enheter, kategori, i.slut, i.start, uteslutBokning).find(r => !uteslut.includes(r.id)) ?? null;
}

// Väljer en resurs per kategori för tiden, eller null när någon saknas.
export function valjResurser(db, ve, krav, start, slut, opts = {}) {
  const valda = [];
  for (const k of krav) {
    const r = ledigResurs(db, ve, k, start, slut, { ...opts, uteslut: valda.map(v => v.id) });
    if (!r) return null;
    valda.push(r);
  }
  return valda;
}

export function reservera(db, bokningId, resurser, start, slut) {
  for (const r of resurser) {
    const i = intervall(r.kategori, start, slut);
    db.query('INSERT INTO resursbokningar (resurs_id, bokning_id, start, slut) VALUES (?, ?, ?, ?)').run(r.id, bokningId, i.start, i.slut);
  }
}

export const resursKort = (r) => ({ id: r.id, namn: r.namn, kategori: r.kategori, kategoriText: KATEGORIER[r.kategori]?.text ?? r.kategori, typ: KATEGORIER[r.kategori]?.typ ?? null, demo: Boolean(r.demo) });
export function resurserForBokning(db, bokningId) {
  if (!harTabeller(db)) return [];
  return db.query('SELECT r.* FROM resursbokningar rb JOIN resurser r ON r.id = rb.resurs_id WHERE rb.bokning_id = ? ORDER BY rb.id').all(bokningId).map(resursKort);
}

// Text om resurserna, till exempel "Behandlingsrum och defibrillator är lediga hela tiden."
export function kravText(krav) {
  const t = krav.filter(k => k !== 'transport').map((k, i) => (i === 0 ? KATEGORIER[k].text : KATEGORIER[k].text.toLowerCase()));
  const delar = [];
  if (t.length) delar.push(`${t.length > 1 ? `${t.slice(0, -1).join(', ')} och ${t.at(-1)}` : t[0]} ${t.length > 1 ? 'är lediga' : 'är ledigt'} hela tiden.`);
  if (krav.includes('transport')) delar.push('Sjukresa finns, simulerad.');
  return delar.join(' ');
}

// ---------------------------------------------------------------------------------------------------------------
// Tider i följd

export const mallFor = (id) => (id && Object.hasOwn(MALLAR, id) ? { id, ...MALLAR[id] } : null);

// Tiden före huvudtiden som mallen kräver: samma vårdenhet, rätt tidstyp och yrkesroll, samma dag, ledig och slutar
// mellan minMin och högst maxMin minuter före. Systemet väljer den senaste, så att patienten väntar så lite som möjligt.
export function tidFore(db, mall, huvudtid, { uteslutBokning = 0 } = {}) {
  const ve = vardenhetFor(db, db.query('SELECT enhet_id FROM scheman WHERE id = ?').get(huvudtid.schema_id)?.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const h = Date.parse(huvudtid.start);
  const tidigast = new Date(h - mall.fore.maxMin * MIN).toISOString();
  const senast = new Date(h - mall.fore.minMin * MIN).toISOString();
  const dag = datumAv(new Date(h));
  return db.query(`SELECT t.*, s.personal_id FROM tider t JOIN scheman s ON s.id = t.schema_id
    WHERE s.enhet_id IN (${ph}) AND t.tidstyp = ? AND s.yrkesroll = ? AND t.start >= ? AND t.slut <= ? AND t.start > ? ORDER BY t.start DESC`)
    .all(...enheter, mall.fore.tidstyp, mall.fore.yrkesroll, tidigast, senast, new Date().toISOString())
    .find(t => datumAv(new Date(t.start)) === dag
      && db.query("SELECT count(*) AS n FROM bokningar WHERE tid_id = ? AND status IN ('bokad', 'incheckad') AND id <> ?").get(t.id, uteslutBokning).n < t.platser) ?? null;
}

// Bokningen före en huvudbokning, och huvudbokningen för en bokning före.
export function kedjaFor(db, bokningId) {
  if (!harTabeller(db)) return null;
  const fore = db.query("SELECT k.*, b.status FROM bokningskedjor k JOIN bokningar b ON b.id = k.bokning_id WHERE k.huvud_id = ? AND b.status IN ('bokad', 'incheckad') ORDER BY k.bokning_id DESC").get(bokningId);
  if (fore) return { roll: 'huvud', mall: mallFor(fore.mall), foreId: fore.bokning_id, huvudId: bokningId };
  const huvud = db.query('SELECT * FROM bokningskedjor WHERE bokning_id = ?').get(bokningId);
  if (huvud) return { roll: 'fore', mall: mallFor(huvud.mall), foreId: bokningId, huvudId: huvud.huvud_id };
  return null;
}
export const knytKedja = (db, foreId, huvudId, mall) => db.query('INSERT OR REPLACE INTO bokningskedjor (bokning_id, huvud_id, mall) VALUES (?, ?, ?)').run(foreId, huvudId, mall);

// ---------------------------------------------------------------------------------------------------------------
// Språk i kallelserna

export const SPRAK = { sv: 'Svenska', en: 'Engelska' };
export const sprakFor = (db, patientId) => (harTabeller(db) && patientId ? db.query('SELECT sprak FROM sprakval WHERE patient_id = ?').get(patientId)?.sprak ?? 'sv' : 'sv');
export const kallelsensSprak = (db, kallelseId) => (harTabeller(db) ? db.query('SELECT sprak FROM kallelse_sprak WHERE kallelse_id = ?').get(kallelseId)?.sprak ?? 'sv' : 'sv');
export function sparaKallelsesprak(db, kallelseId, sprak) {
  if (harTabeller(db) && sprak && sprak !== 'sv') db.query('INSERT OR REPLACE INTO kallelse_sprak VALUES (?, ?)').run(kallelseId, sprak);
}

// Kallelsen på engelska finns i kallelse-engelska.js, som språkkontrollen inte läser eftersom den är på engelska med flit.
export { kallelseEngelska } from './kallelse-engelska.js';

// ---------------------------------------------------------------------------------------------------------------
// Egna bevakningar och kallelser utan förbokad tid, som Dagens arbete och Min journal visar.

// Egna bevakningar på vårdenheten som är den inloggades eller hela vårdenhetens, till och med ett datum.
export function egnaBevakningar(db, personal, till, { allaEnheten = true } = {}) {
  if (!harTabeller(db)) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query(`SELECT * FROM egna_bevakningar WHERE enhet_id = ? AND klar IS NULL AND datum <= ? AND (ansvarig_id = ? ${allaEnheten ? 'OR ansvarig_id IS NULL' : ''})
    ORDER BY datum, id`).all(ve, till, personal.id);
}

export const ramForPost = (db, postId) => (harTabeller(db) ? db.query("SELECT * FROM kallelser_ram WHERE vantelista_id = ? AND status = 'skickad' ORDER BY id DESC").get(postId) ?? null : null);
export const ramerForPatient = (db, patientId) => (harTabeller(db) ? db.query("SELECT * FROM kallelser_ram WHERE patient_id = ? AND status = 'skickad' ORDER BY id").all(patientId) : []);

// Felet när en resurs har hunnit bokas av någon annan.
export const resursFel = () => new Fel(400, 'Rummet eller utrustningen har just bokats för den tiden. Välj ett av de andra förslagen.', 'ogiltig', { falt: ['tidId'] });
export const nuIso = () => iso();
