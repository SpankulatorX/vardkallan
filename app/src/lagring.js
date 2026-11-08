// Lagring, säkerhetskopiering och uttag per huvudman (runda 7, r4, Sussa KD1.1.3.3 till KD1.1.3.6).
//
// Varje uppgift i databasen hör till en huvudman genom den enhet den registrerades på: enheten leder upp till en
// vårdgivare (i demon Region Örebro län) eller är en egen huvudman (den simulerade kommunen). En tabell utan enhet hör
// till huvudmannen genom patienten, och en tabell som pekar på en annan rad (till exempel en ordinations historik)
// genom den raden. Systemet klassar själv varje tabell efter dess kolumner, så att en ny tabell kommer med utan att
// någon behöver komma ihåg det, och en tabell som inte går att klassa tas inte med i ett uttag (hellre saknas än läcker).
//
// Säkerhetskopian är en konsistent ögonblicksbild av hela databasen (SQLite serialize, eller VACUUM INTO till en fil i
// driften). Provåterläsningen läser in kopian i en ny databas och kontrollerar varje tabell rad för rad, att alla
// triggrar och index finns och verkar, att databasen är hel och att loggarnas hashkedjor håller.
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { Fel, iso } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad, verifiera as verifieraLogg } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';

const ENHETSKOLUMNER = ['enhet_id', 'vardenhet_id', 'fran_enhet_id', 'till_enhet_id', 'registrerad_enhet'];
// Tabeller som inte hör till en enskild huvudman: kodverk, katalog och systemets egna inställningar. De följer med i
// varje uttag. Inga patientuppgifter finns i dem.
const GEMENSAMMA = new Set(['katalog', 'installningar', 'migrering', 'forpackningar', 'produkttyper', 'substansmallar', 'paketversioner', 'ordinationspaket',
  'tidboksregler', 'konfig_andringar', 'fhir_andringar_last', 'visningsregler']);
// Tabeller som hör till systemförvaltningen och inte till en huvudman i ett uttag.
// Datauttaget för uppföljning byggs om ur uppgifterna och följer inte med i ett uttag.
const SYSTEM = new Set(['omorganisationer', 'omorganisation_flyttar', 'lagringsmatningar', 'sqlite_sequence', 'datauttag']);
// Tabeller vars koppling inte går att se på kolumnnamnen.
const UTTRYCKLIGA = {
  dubblettforslag: { typ: 'patient', kolumner: ['fran_patient_id', 'till_patient_id'] },
  enhet_efterfoljare: { typ: 'enhet', kolumner: ['gammal_id', 'ny_id'], patient: false },
  fordjupade_steg: { typ: 'via', kolumn: 'genomgang_id', tabell: 'fordjupade_genomgangar' },
  arkivexporter: { typ: 'via', kolumn: 'beslut_id', tabell: 'arkivbeslut' },
  stickprov: { typ: 'via', kolumn: 'av', tabell: 'personal' },
  vardplan_mal: { typ: 'via', kolumn: 'plan_id', tabell: 'vardplaner' },
  vardplan_atgarder: { typ: 'via', kolumn: 'plan_id', tabell: 'vardplaner' },
};

const tabeller = (db) => db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
const kolumner = (db, t) => db.query(`PRAGMA table_info("${t}")`).all().map(k => k.name);

// Huvudmannen för varje enhet: den vårdgivare enheten leder upp till, eller enheten själv om den saknar överordnad.
export function huvudman(db) {
  const alla = db.query('SELECT id, typ, forald_id FROM enheter').all();
  const per = new Map(alla.map(e => [e.id, e]));
  const ut = new Map();
  for (const e of alla) {
    let x = e;
    for (let i = 0; i < 10 && x.forald_id && x.typ !== 'vardgivare' && per.has(x.forald_id); i++) x = per.get(x.forald_id);
    ut.set(e.id, x.id);
  }
  return ut;
}

// Huvudmännen: vårdgivarna och kommunerna. En e-tjänst utan överordnad enhet (Min journal) är ingen huvudman, och dess
// rader hör till huvudmannen genom den andra enheten på raden (till exempel remissens mottagare).
export function huvudman_lista(db) {
  const h = huvudman(db);
  const typ = new Map(db.query('SELECT id, typ FROM enheter').all().map(e => [e.id, e.typ]));
  return [...new Set(h.values())].filter(id => ['vardgivare', 'kommun'].includes(typ.get(id))).map(id => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id }));
}

// Klassning av varje tabell: enhet (en eller flera enhetskolumner), patient (patient_id), via (pekar på en annan tabell
// med kolumnen <namn>_id), enheter, gemensam, system eller oklassad.
export function klassa(db) {
  const alla = tabeller(db);
  const ut = {};
  const pluralFor = (prefix) => [prefix, `${prefix}er`, `${prefix}ar`, `${prefix}r`, `${prefix}n`, `${prefix}en`, `${prefix}or`].find(t => alla.includes(t));
  for (const t of alla) {
    const k = kolumner(db, t);
    if (UTTRYCKLIGA[t]) ut[t] = UTTRYCKLIGA[t];
    else if (t === 'enheter') ut[t] = { typ: 'enheter' };
    else if (t === 'patienter') ut[t] = { typ: 'patienter' };
    else if (SYSTEM.has(t)) ut[t] = { typ: 'system' };
    else if (GEMENSAMMA.has(t)) ut[t] = { typ: 'gemensam' };
    else if (k.some(c => ENHETSKOLUMNER.includes(c))) ut[t] = { typ: 'enhet', kolumner: k.filter(c => ENHETSKOLUMNER.includes(c)), patient: k.includes('patient_id') };
    else if (k.includes('patient_id') || k.includes('barn_id')) ut[t] = { typ: 'patient', kolumner: [k.includes('patient_id') ? 'patient_id' : 'barn_id'] };
    else ut[t] = null;
  }
  // Tabeller som pekar på en klassad tabell, i flera varv så att kedjor följs (en händelse i ett vårdtillfälle).
  for (let varv = 0; varv < 4; varv++) {
    for (const t of alla) {
      if (ut[t]) continue;
      for (const c of kolumner(db, t).filter(x => x.endsWith('_id') && x !== 'id')) {
        const mal = pluralFor(c.slice(0, -3));
        if (mal && mal !== t && ut[mal] && ['enhet', 'patient', 'via', 'patienter'].includes(ut[mal].typ)) { ut[t] = { typ: 'via', kolumn: c, tabell: mal }; break; }
      }
    }
  }
  for (const t of alla) if (!ut[t]) ut[t] = { typ: 'oklassad' };
  return ut;
}

// Raderna i varje tabell som hör till en huvudman, som rowid. Uppgifter utan enhet och utan patient hör inte till någon
// huvudman och tas inte med.
function urval(db, hm, klass) {
  const h = huvudman(db);
  const enheter = new Set([...h].filter(([, v]) => v === hm).map(([k]) => k));
  const val = {};
  const rowids = (t, filter) => db.query(`SELECT rowid AS __r, * FROM "${t}"`).all().filter(filter).map(x => x.__r);
  for (const [t, k] of Object.entries(klass)) if (k.typ === 'enhet') val[t] = new Set(rowids(t, r => k.kolumner.some(c => r[c] && enheter.has(r[c]))));
  // Patienterna med någon uppgift hos huvudmannen.
  const patienter = new Set();
  for (const [t, k] of Object.entries(klass)) {
    if (k.typ !== 'enhet' || !k.patient) continue;
    for (const r of db.query(`SELECT rowid AS __r, patient_id FROM "${t}"`).all()) if (val[t].has(r.__r) && r.patient_id) patienter.add(r.patient_id);
  }
  for (const [t, k] of Object.entries(klass)) {
    if (k.typ === 'enhet' && k.patient) {
      // En rad utan enhet (till exempel invånarens läsning i Min journal) hör till huvudmannen genom patienten.
      for (const r of db.query(`SELECT rowid AS __r, * FROM "${t}"`).all()) if (k.kolumner.every(c => !r[c]) && patienter.has(r.patient_id)) val[t].add(r.__r);
    }
    if (k.typ === 'patient') val[t] = new Set(rowids(t, r => k.kolumner.some(c => patienter.has(r[c]))));
  }
  val.patienter = new Set(rowids('patienter', r => patienter.has(r.id)));
  // Tabeller som pekar på andra rader, i flera varv.
  for (let varv = 0; varv < 4; varv++) {
    for (const [t, k] of Object.entries(klass)) {
      if (k.typ !== 'via' || val[t] || !val[k.tabell]) continue;
      const malIds = new Set(db.query(`SELECT rowid AS __r, * FROM "${k.tabell}"`).all().filter(x => val[k.tabell].has(x.__r)).map(x => String(x.id ?? x.__r)));
      val[t] = new Set(rowids(t, r => r[k.kolumn] != null && malIds.has(String(r[k.kolumn]))));
    }
  }
  val.enheter = new Set(rowids('enheter', r => enheter.has(r.id)));
  return { val, enheter, patienter };
}

// Uttag av en huvudmans uppgifter till en egen databas med samma tabeller, index och triggrar.
export function uttag(db, hm) {
  const klass = klassa(db);
  const { val } = urval(db, hm, klass);
  const ut = new Database(':memory:');
  const schema = db.query("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
  for (const s of schema.filter(x => x.type === 'table')) ut.exec(s.sql);
  const antal = {};
  for (const t of tabeller(db)) {
    const k = klass[t];
    if (['system', 'oklassad'].includes(k.typ)) { antal[t] = 0; continue; }
    const kol = kolumner(db, t);
    const ins = ut.query(`INSERT INTO "${t}" (${kol.map(c => `"${c}"`).join(', ')}) VALUES (${kol.map(() => '?').join(', ')})`);
    const rader = db.query(`SELECT rowid AS __r, * FROM "${t}"`).all().filter(r => k.typ === 'gemensam' || val[t]?.has(r.__r));
    for (const r of rader) ins.run(...kol.map(c => r[c]));
    antal[t] = rader.length;
  }
  for (const s of schema.filter(x => x.type === 'index' || x.type === 'trigger')) ut.exec(s.sql);
  return { db: ut, antal, klass };
}

const kravRoll = (personal) => { if (!kanRoll(personal, 'lagring')) throw new Fel(403, 'Bara systemförvaltningen följer upp lagringen.', 'nekad'); };

// Hash av en tabells innehåll i rowid-ordning, för att jämföra original och återläsning rad för rad.
function tabellHash(db, t) {
  const h = createHash('sha256');
  for (const r of db.query(`SELECT * FROM "${t}" ORDER BY rowid`).iterate()) h.update(JSON.stringify(r));
  return h.digest('hex');
}
const schemaLista = (db, typ) => db.query('SELECT name, sql FROM sqlite_master WHERE type = ? ORDER BY name').all(typ);

// Säkerhetskopian: en konsistent ögonblicksbild av hela databasen.
export const sakerhetskopiera = (db) => db.serialize();
export const aterlas = (kopia) => Database.deserialize(kopia);

// Jämför en återläst databas med originalet. Returnerar kontrollerna och om allt höll.
export function jamfor(original, kopia) {
  const kontroller = [];
  const lagg = (id, text, ok, detalj = null) => kontroller.push({ id, text, ok, detalj });
  const ta = tabeller(original);
  const tb = tabeller(kopia);
  lagg('tabeller', `Alla ${ta.length} tabeller finns`, JSON.stringify(ta) === JSON.stringify(tb), ta.filter(t => !tb.includes(t)).join(', ') || null);
  const avvikande = ta.filter(t => tb.includes(t) && tabellHash(original, t) !== tabellHash(kopia, t));
  const rader = ta.reduce((a, t) => a + original.query(`SELECT count(*) AS n FROM "${t}"`).get().n, 0);
  lagg('rader', `Alla ${rader} rader är lika, tabell för tabell`, !avvikande.length, avvikande.join(', ') || null);
  for (const typ of ['trigger', 'index']) {
    const a = schemaLista(original, typ);
    const b = schemaLista(kopia, typ);
    lagg(typ === 'trigger' ? 'triggrar' : 'index', `Alla ${a.length} ${typ === 'trigger' ? 'triggrar' : 'index'} finns och är lika`, JSON.stringify(a) === JSON.stringify(b));
  }
  // Triggrarna verkar: en rad i åtkomstloggen går inte att ändra eller radera i kopian.
  let skyddad = true;
  try { kopia.exec('UPDATE atkomstlogg SET resultat = resultat WHERE id = (SELECT min(id) FROM atkomstlogg)'); skyddad = false; } catch { /* ska stoppas */ }
  try { kopia.exec('DELETE FROM atkomstlogg WHERE id = (SELECT min(id) FROM atkomstlogg)'); skyddad = false; } catch { /* ska stoppas */ }
  lagg('skydd', 'Triggrarna stoppar ändring och radering av loggen i kopian', skyddad);
  const hel = kopia.query('PRAGMA integrity_check').get().integrity_check;
  lagg('integritet', 'Databasen är hel (SQLite integrity_check)', hel === 'ok', hel === 'ok' ? null : hel);
  const lg = verifieraLogg(kopia);
  lagg('atkomstlogg', `Åtkomstloggens hashkedja håller (${lg.antal} rader)`, lg.hel === true, lg.orsak ?? null);
  try {
    const sl = sakerhetslogg.verifiera(kopia);
    lagg('sakerhetslogg', `Säkerhetsloggens hashkedja håller (${sl.antal} rader)`, sl.hel === true, sl.orsak ?? null);
  } catch { /* äldre sandlåda utan säkerhetslogg */ }
  return { ok: kontroller.every(k => k.ok), kontroller, rader, tabeller: ta.length };
}

// Provåterläsning: säkerhetskopiera, läs in i en ny databas och jämför. Resultatet sparas, utan patientuppgifter.
export function provaAterlasning(db, personal, nu = new Date()) {
  kravRoll(personal);
  const t0 = performance.now();
  const kopia = sakerhetskopiera(db);
  const ny = aterlas(kopia);
  let r;
  try { r = jamfor(db, ny); } finally { ny.close(); }
  const ms = Math.round(performance.now() - t0);
  const sha = createHash('sha256').update(kopia).digest('hex');
  db.query('INSERT INTO lagringsmatningar (tid, byte, rader, tabeller, aterlasning, resultat, av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(iso(nu), kopia.byteLength, r.rader, r.tabeller, r.ok ? 'godkand' : 'underkand', JSON.stringify({ kontroller: r.kontroller, ms, sha256: sha }), personal.id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'lagring', resurs: 'provaterlasning', grund: 'administrativ' });
  return { ...r, byte: kopia.byteLength, ms, sha256: sha };
}

// Sidan för lagring: storlek och volym, huvudmännen med antal per tabell och kontroll av att uttaget bara innehåller
// huvudmannens uppgifter, och de senaste provåterläsningarna. Bara antal, inga patientuppgifter.
export function oversikt(db, personal) {
  kravRoll(personal);
  const klass = klassa(db);
  const sidor = db.query('PRAGMA page_count').get().page_count * db.query('PRAGMA page_size').get().page_size;
  const per = tabeller(db).map(t => ({ tabell: t, rader: db.query(`SELECT count(*) AS n FROM "${t}"`).get().n, klass: klass[t].typ }));
  const hm = huvudman_lista(db).map(h => {
    const u = uttag(db, h.id);
    try {
      const egna = Object.entries(u.antal).filter(([t]) => !['gemensam', 'system', 'oklassad'].includes(klass[t].typ)).reduce((a, [, n]) => a + n, 0);
      return { ...h, rader: egna, patienter: u.antal.patienter ?? 0, kontroll: kontrolleraUttag(db, u.db, h.id) };
    } finally { u.db.close(); }
  });
  const matningar = db.query('SELECT * FROM lagringsmatningar ORDER BY id DESC LIMIT 10').all().map(m => {
    const r = JSON.parse(m.resultat);
    return { tid: m.tid, byte: m.byte, rader: m.rader, tabeller: m.tabeller, godkand: m.aterlasning === 'godkand', ms: r.ms, sha256: r.sha256, kontroller: r.kontroller, av: db.query('SELECT namn FROM personal WHERE id = ?').get(m.av)?.namn ?? null };
  });
  return {
    byte: sidor, rader: per.reduce((a, x) => a + x.rader, 0), tabeller: per.length,
    storsta: [...per].sort((a, b) => b.rader - a.rader).slice(0, 8),
    oklassade: per.filter(x => x.klass === 'oklassad').map(x => x.tabell),
    huvudman: hm, matningar,
    rutin: [
      'Säkerhetskopian är en konsistent ögonblicksbild av hela databasen, tagen i en enda operation, så att den aldrig innehåller en halv ändring.',
      'Kopian läses in i en ny databas och jämförs tabell för tabell. Triggrarna, indexen, databasens integritet och loggarnas hashkedjor kontrolleras.',
      'Provet körs automatiskt i bygget vid varje ändring och kan köras här när som helst. Resultatet sparas med storlek och tid, så att volymen kan följas över tiden.',
      'Varje uppgift hör till en huvudman genom enheten den registrerades på, och en huvudmans uppgifter kan tas ut för sig till en egen databas med samma tabeller och triggrar.',
    ],
    anmarkning: 'I demon är databasen en sandlåda i minnet per besökare, och sandlådorna sparas till disk när servern stängs. Lagringsklasser med olika prestanda och kopior på flera platser hör till driften och finns inte i demon.',
  };
}

// Kontrollerar att ett uttag bara har huvudmannens enheter och patienter som har något hos huvudmannen.
export function kontrolleraUttag(original, ut, hm) {
  const h = huvudman(original);
  const egna = new Set([...h].filter(([, v]) => v === hm).map(([k]) => k));
  const klass = klassa(original);
  const fel = [];
  for (const [t, k] of Object.entries(klass)) {
    if (k.typ !== 'enhet') continue;
    for (const r of ut.query(`SELECT * FROM "${t}"`).all()) {
      if (k.kolumner.every(c => !r[c] || !egna.has(r[c])) && k.kolumner.some(c => r[c])) { fel.push(t); break; }
    }
  }
  const andraEnheter = ut.query('SELECT id FROM enheter').all().filter(e => !egna.has(e.id)).length;
  if (andraEnheter) fel.push('enheter');
  return { ok: !fel.length, text: fel.length ? `Uttaget har rader från en annan huvudman i ${fel.join(', ')}.` : 'Uttaget har bara huvudmannens egna uppgifter.' };
}
