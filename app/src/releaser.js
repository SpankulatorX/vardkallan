// Releaser med återgång (runda 12, r2, vårt D7 och M8). Små releaser som går att backa: varje ändring av databasens
// schema från version 1.2 är en versionerad migrering med en återställning, och återställningen sparas i databasen när
// migreringen tillämpas. Därför kan en äldre version av programmet backa databasen själv när den startar, utan att
// känna till den nyare versionens migreringar. Data i en tabell eller kolumn som backas sparas undan och kommer
// tillbaka när migreringen tillämpas igen, så att en återgång aldrig gör att något försvinner.
//
// En uppgradering används först när vårdgivarens systemförvaltare och en andra systemförvaltare har godkänt den, var och
// en i sin egen inloggning, och bara när alla tester i bygget av versionen är gröna. Systemet visar själv vad
// uppgraderingen ändrar: nyheterna, API:ts ändringslogg och migreringarna.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fel, iso, installning } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';
import { ANDRINGAR, VERSION } from './api-andringar.js';

export { VERSION };

// Migreringarna, i ordning. id är schemaversionen efter migreringen. upp och ned är SQL-satser. tabeller och kolumner
// är det som återställningen tar bort, och vars innehåll sparas undan först.
export const MIGRERINGAR = [
  {
    id: 1, version: '1.2.0', namn: 'Index för åtkomstloggen per patient och tid',
    beskrivning: 'Loggutdrag och logguppföljning för en patient sorteras på tid utan att hela loggen läses.',
    upp: ['CREATE INDEX IF NOT EXISTS ix_logg_patient_tid ON atkomstlogg (patient_id, tid)'],
    ned: ['DROP INDEX IF EXISTS ix_logg_patient_tid'],
  },
  {
    id: 2, version: '1.2.0', namn: 'Lagringsklasser för aktuella och äldre uppgifter',
    beskrivning: 'Varje lagringsklass har en kvalitet, ett pris per gigabyte och en gräns för när uppgifter flyttas dit (Sussa KD1.1.3.5).',
    upp: [`CREATE TABLE IF NOT EXISTS lagringsklasser (
      id TEXT PRIMARY KEY, namn TEXT NOT NULL, kvalitet TEXT NOT NULL, svarstid_ms INTEGER NOT NULL, kr_per_gb_manad REAL NOT NULL,
      flytt_efter_ar INTEGER, beskrivning TEXT NOT NULL)`,
    `INSERT OR IGNORE INTO lagringsklasser VALUES ('aktuell', 'Aktuell lagring', 'Snabb lagring med spegling och kopia på två platser', 5, 4.0, NULL,
      'Pågående och nyligen avslutade vårdkontakter, och allt som inte är flyttat.')`,
    `INSERT OR IGNORE INTO lagringsklasser VALUES ('aldre', 'Lagring för äldre uppgifter', 'Billigare lagring med kopia på två platser och längre svarstid', 40, 0.8, 3,
      'Avslutade vårdkontakter med sitt innehåll när de är äldre än gränsen. Uppgifterna läses i journalen som vanligt.')`],
    ned: ['DROP TABLE IF EXISTS lagringsklasser'],
    tabeller: ['lagringsklasser'],
  },
];

// Tabellerna som håller reda på schemat och uppgraderingarna finns i alla versioner och är inte migreringar.
export function sakraReleaseschema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migreringar (
    id INTEGER PRIMARY KEY, version TEXT NOT NULL, namn TEXT NOT NULL, upp TEXT NOT NULL, ned TEXT NOT NULL,
    tabeller TEXT NOT NULL DEFAULT '[]', kolumner TEXT NOT NULL DEFAULT '[]', tid TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS parkerade_data (
    id INTEGER PRIMARY KEY, migrering_id INTEGER NOT NULL, tabell TEXT NOT NULL, kolumn TEXT, rader TEXT NOT NULL, tid TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS uppgraderingar (
    id INTEGER PRIMARY KEY, typ TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL, status TEXT NOT NULL,
    skapad TEXT NOT NULL, skapad_av TEXT, godkand1_av TEXT, godkand1 TEXT, godkand2_av TEXT, godkand2 TEXT,
    genomford TEXT, tester TEXT, resultat TEXT)`);
}

// Jämför två versionsnummer (1.10.0 är större än 1.9.2).
export function jamforVersion(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

const tillampade = (db) => db.query('SELECT * FROM schema_migreringar ORDER BY id').all();
const finnsTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const kolumnerI = (db, t) => db.query(`PRAGMA table_info("${t}")`).all().map(k => k.name);

// Den version som är i drift i databasen. En databas utan uppgift är på programmets version.
export const driftversion = (db, program = VERSION) => installning(db, 'driftversion') ?? program;

// Schemaversionen: den högsta tillämpade migreringen, och hur den stämmer med programmet och versionen i drift.
export function schemastatus(db, mig = MIGRERINGAR, program = VERSION) {
  sakraReleaseschema(db);
  const gjorda = tillampade(db);
  const kanda = new Set(mig.map(m => m.id));
  const drift = driftversion(db, program);
  const mal = mig.filter(m => jamforVersion(m.version, drift) <= 0).map(m => m.id);
  const gjordaId = new Set(gjorda.map(m => m.id));
  const saknas = mal.filter(id => !gjordaId.has(id));
  const okanda = gjorda.filter(m => !kanda.has(m.id)).map(m => m.id);
  const overfor = gjorda.filter(m => kanda.has(m.id) && !mal.includes(m.id)).map(m => m.id);
  return {
    schemaversion: gjorda.length ? Math.max(...gjorda.map(m => m.id)) : 0,
    programmets: mig.length ? Math.max(...mig.map(m => m.id)) : 0,
    driftversion: drift, program,
    saknas, okanda, overfor,
    stammer: !saknas.length && !okanda.length && !overfor.length,
  };
}

// Sparar undan innehållet i det som en återställning tar bort.
function parkera(db, m, nu) {
  const ins = db.query('INSERT INTO parkerade_data (migrering_id, tabell, kolumn, rader, tid) VALUES (?, ?, ?, ?, ?)');
  for (const t of JSON.parse(m.tabeller ?? '[]')) {
    if (!finnsTabell(db, t)) continue;
    const rader = db.query(`SELECT * FROM "${t}"`).all();
    if (rader.length) ins.run(m.id, t, null, JSON.stringify(rader), iso(nu));
  }
  for (const { tabell, kolumn } of JSON.parse(m.kolumner ?? '[]')) {
    if (!finnsTabell(db, tabell) || !kolumnerI(db, tabell).includes(kolumn)) continue;
    const rader = db.query(`SELECT rowid AS r, "${kolumn}" AS v FROM "${tabell}" WHERE "${kolumn}" IS NOT NULL`).all();
    if (rader.length) ins.run(m.id, tabell, kolumn, JSON.stringify(rader), iso(nu));
  }
}

// Lägger tillbaka det som sparades undan när migreringen backades.
function aterlagg(db, id) {
  for (const p of db.query('SELECT * FROM parkerade_data WHERE migrering_id = ? ORDER BY id').all(id)) {
    const rader = JSON.parse(p.rader);
    if (p.kolumn) {
      const upd = db.query(`UPDATE "${p.tabell}" SET "${p.kolumn}" = ? WHERE rowid = ?`);
      for (const r of rader) upd.run(r.v, r.r);
    } else {
      const kol = kolumnerI(db, p.tabell);
      for (const r of rader) {
        const k = kol.filter(c => Object.hasOwn(r, c));
        db.query(`INSERT OR REPLACE INTO "${p.tabell}" (${k.map(c => `"${c}"`).join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map(c => r[c]));
      }
    }
  }
  db.query('DELETE FROM parkerade_data WHERE migrering_id = ?').run(id);
}

function tillampa(db, m, nu) {
  for (const sql of m.upp) db.exec(sql);
  db.query('INSERT INTO schema_migreringar (id, version, namn, upp, ned, tabeller, kolumner, tid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(m.id, m.version, m.namn, JSON.stringify(m.upp), JSON.stringify(m.ned), JSON.stringify(m.tabeller ?? []), JSON.stringify(m.kolumner ?? []), iso(nu));
  aterlagg(db, m.id);
}

// Backar en tillämpad migrering med den återställning som sparades i databasen.
function backa(db, rad, nu) {
  parkera(db, rad, nu);
  for (const sql of JSON.parse(rad.ned)) db.exec(sql);
  db.query('DELETE FROM schema_migreringar WHERE id = ?').run(rad.id);
}

// Ställer schemat på en version: migreringar för en senare version backas med de sparade återställningarna, i omvänd
// ordning, och migreringar som saknas tillämpas i ordning. Allt i en transaktion, så att inget blir halvgjort.
export function tillVersion(db, version, mig = MIGRERINGAR, nu = new Date()) {
  sakraReleaseschema(db);
  const ut = { tillampade: [], backade: [] };
  db.transaction(() => {
    const kanda = new Map(mig.map(m => [m.id, m]));
    const behalla = new Set(mig.filter(m => jamforVersion(m.version, version) <= 0).map(m => m.id));
    for (const rad of tillampade(db).reverse()) {
      if (behalla.has(rad.id)) continue;
      backa(db, rad, nu);
      ut.backade.push({ id: rad.id, namn: rad.namn, version: rad.version, kand: kanda.has(rad.id) });
    }
    const gjorda = new Set(tillampade(db).map(r => r.id));
    for (const m of mig) {
      if (!behalla.has(m.id) || gjorda.has(m.id)) continue;
      tillampa(db, m, nu);
      ut.tillampade.push({ id: m.id, namn: m.namn, version: m.version });
    }
  })();
  return ut;
}

// Kontrollen när servern startar eller läser in en sandlåda. Databasens schema ställs på den version som är i drift.
// En databas från en nyare version av programmet backas med sina sparade återställningar till programmets version, så
// att en återgång av programmet också backar databasen.
export function kontrolleraVidStart(db, mig = MIGRERINGAR, program = VERSION, nu = new Date()) {
  sakraReleaseschema(db);
  let drift = driftversion(db, program);
  if (jamforVersion(drift, program) > 0) { installning(db, 'driftversion', program); drift = program; }
  const programmetsVersioner = new Set(mig.map(m => m.version));
  // Versionen i drift kan vara äldre än programmet (efter en återgång). Den kan inte vara en version som programmet
  // inte känner till och som ligger mellan två kända, men då gäller den närmast lägre.
  const ut = tillVersion(db, drift, mig, nu);
  const status = schemastatus(db, mig, program);
  return { ...ut, ...status, versioner: [...programmetsVersioner] };
}

// ---------------------------------------------------------------------------------------------------------------
// Versionerna och vad varje version ändrar.

const NYHETER = (() => { try { return JSON.parse(readFileSync(join(import.meta.dir, 'nyheter.json'), 'utf8')).versioner; } catch { return []; } })();

// Versionerna i ordning, den nyaste först, med nyheterna, API:ts ändringslogg och migreringarna.
export function versioner(mig = MIGRERINGAR) {
  const alla = [...new Set([...NYHETER.map(v => v.version), ...ANDRINGAR.map(a => a.version)])].sort((a, b) => jamforVersion(b, a));
  return alla.map(v => {
    const ny = NYHETER.find(x => x.version === v);
    const an = ANDRINGAR.find(x => x.version === v);
    return {
      version: v, datum: ny?.datum ?? an?.datum ?? null,
      nyheter: (ny?.nyheter ?? []).map(n => ({ id: n.id, rubrik: n.rubrik, text: n.text, roller: n.roller })),
      api: an ? { text: an.text, resurser: an.resurser, skrivning: an.skrivning, annat: an.annat } : null,
      migreringar: mig.filter(m => m.version === v).map(m => ({ id: m.id, namn: m.namn, beskrivning: m.beskrivning, aterstallning: m.ned.length > 0 })),
    };
  });
}

// Versionen före en version, eller null.
export function forraVersion(version, mig = MIGRERINGAR) {
  const lista = versioner(mig).map(v => v.version);
  return lista.find(v => jamforVersion(v, version) < 0) ?? null;
}

// Testerna i bygget av programmet. Gröna bara om det finns ett resultat med tester och inget är rött.
export function testlage(resultat) {
  if (!resultat || !Number.isFinite(resultat.antal)) return { gron: false, antal: 0, godkanda: 0, misslyckade: 0, tid: null, text: 'Det finns inget testresultat från bygget av versionen. Uppgraderingen är stoppad tills testerna har körts och är gröna.' };
  const gron = resultat.antal > 0 && resultat.misslyckade === 0;
  return {
    gron, antal: resultat.antal, godkanda: resultat.godkanda, misslyckade: resultat.misslyckade, tid: resultat.tid,
    text: gron ? `Alla ${resultat.antal} tester i bygget är gröna.` : `Uppgraderingen är stoppad: ${resultat.misslyckade} av ${resultat.antal} tester i bygget är röda. Den kan godkännas först när alla tester är gröna.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Uppgraderingen och återgången i en sandlåda. I demon är sandlådan vårdgivarens produktionsmiljö.

const kravRoll = (personal) => { if (!kanRoll(personal, 'lagring')) throw new Fel(403, 'Bara systemförvaltningen gör uppgraderingar och återgångar.', 'nekad'); };
const namn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);

function uppgraderingUt(db, u, personal) {
  return {
    id: u.id, typ: u.typ, fran: u.fran, till: u.till, status: u.status, skapad: u.skapad, skapadAv: namn(db, u.skapad_av),
    godkand1Av: namn(db, u.godkand1_av), godkand1: u.godkand1, godkand2Av: namn(db, u.godkand2_av), godkand2: u.godkand2,
    genomford: u.genomford, resultat: u.resultat ? JSON.parse(u.resultat) : null,
    // Den som redan har godkänt kan inte godkänna en gång till (fyra ögon).
    kanGodkanna: Boolean(personal && u.status === 'vantar' && u.godkand1_av !== personal.id),
  };
}

const loggaHandelse = (db, personal, resurs, beskrivning, nu) => {
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'lagring', resurs, grund: 'administrativ', tid: iso(nu) });
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id, beskrivning, tid: iso(nu) });
};

// Översikten för systemförvaltaren: versionen i drift, schemat, vad som väntar, vad nästa version ändrar och testerna.
export function oversikt(db, personal, { testresultat = null, mig = MIGRERINGAR, program = VERSION } = {}) {
  kravRoll(personal);
  const status = schemastatus(db, mig, program);
  const alla = versioner(mig);
  const drift = status.driftversion;
  const vantar = db.query("SELECT * FROM uppgraderingar WHERE typ = 'uppgradering' AND status = 'vantar' ORDER BY id DESC LIMIT 1").get();
  const forra = forraVersion(drift, mig);
  const gjorda = new Map(tillampade(db).map(r => [r.id, r]));
  return {
    program, driftversion: drift, schema: status,
    migreringar: mig.map(m => ({ id: m.id, version: m.version, namn: m.namn, beskrivning: m.beskrivning, tillampad: gjorda.get(m.id)?.tid ?? null, aterstallning: m.ned.length > 0 })),
    tester: testlage(testresultat),
    // Det som en uppgradering till programmets version ändrar, när en äldre version är i drift.
    nasta: jamforVersion(drift, program) < 0 ? alla.filter(v => jamforVersion(v.version, drift) > 0 && jamforVersion(v.version, program) <= 0) : [],
    i_drift: alla.find(v => v.version === drift) ?? null,
    forra: forra && jamforVersion(drift, program) === 0 ? alla.find(v => v.version === forra) : null,
    vantar: vantar ? uppgraderingUt(db, vantar, personal) : null,
    historik: db.query('SELECT * FROM uppgraderingar ORDER BY id DESC LIMIT 20').all().map(u => uppgraderingUt(db, u, personal)),
    parkerade: db.query('SELECT tabell, kolumn, migrering_id AS migrering, length(rader) AS byte FROM parkerade_data ORDER BY id').all(),
  };
}

// Återgång till förra versionen. Görs av en systemförvaltare, eftersom den ska gå fort när en uppgradering har gett
// fel i vården. Databasen backas med de sparade återställningarna, och uppgraderingen igen väntar på godkännande.
export function aterga(db, personal, { mig = MIGRERINGAR, program = VERSION } = {}, nu = new Date()) {
  kravRoll(personal);
  const drift = driftversion(db, program);
  const forra = forraVersion(drift, mig);
  if (!forra) throw new Fel(409, 'Det finns ingen tidigare version att gå tillbaka till.', 'ogiltig');
  if (db.query("SELECT 1 FROM uppgraderingar WHERE typ = 'uppgradering' AND status = 'vantar'").get()) throw new Fel(409, 'En uppgradering väntar redan på godkännande. Den förra versionen är i drift.', 'ogiltig');
  const ut = tillVersion(db, forra, mig, nu);
  installning(db, 'driftversion', forra);
  const status = schemastatus(db, mig, program);
  db.query('INSERT INTO uppgraderingar (typ, fran, till, status, skapad, skapad_av, genomford, resultat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('atergang', drift, forra, 'genomford', iso(nu), personal.id, iso(nu), JSON.stringify({ backade: ut.backade.length, stammer: status.stammer }));
  const r = db.query('INSERT INTO uppgraderingar (typ, fran, till, status, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?)').run('uppgradering', forra, drift, 'vantar', iso(nu), personal.id);
  loggaHandelse(db, personal, `uppgradering:${r.lastInsertRowid}`, `Återgång från version ${drift} till ${forra}. ${ut.backade.length} migreringar backades.`, nu);
  return { driftversion: forra, backade: ut.backade, schema: status, vantar: uppgraderingUt(db, db.query('SELECT * FROM uppgraderingar WHERE id = ?').get(r.lastInsertRowid), personal) };
}

// Godkännande av en uppgradering. Den första systemförvaltaren godkänner, och när en andra systemförvaltare har godkänt
// i sin egen inloggning används uppgraderingen direkt. Ett rött test i bygget stoppar uppgraderingen. Går kontrollen av
// schemat efter uppgraderingen inte igenom backas den, och den förra versionen är kvar i drift.
export function godkann(db, personal, id, { testresultat = null, mig = MIGRERINGAR, program = VERSION } = {}, nu = new Date()) {
  kravRoll(personal);
  const u = db.query("SELECT * FROM uppgraderingar WHERE id = ? AND typ = 'uppgradering'").get(Number(id));
  if (!u) throw new Fel(404, 'Uppgraderingen finns inte.', 'saknas');
  if (u.status !== 'vantar') throw new Fel(409, 'Uppgraderingen är redan avgjord.', 'ogiltig');
  const t = testlage(testresultat);
  if (!t.gron) throw new Fel(409, t.text, 'ogiltig', { tester: t });
  if (jamforVersion(u.till, program) > 0) throw new Fel(409, `Programmet är version ${program} och kan inte uppgradera databasen till ${u.till}.`, 'ogiltig');
  if (u.godkand1_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än du måste också godkänna uppgraderingen, i sin egen inloggning.', 'nekad');
  const tester = JSON.stringify({ antal: t.antal, misslyckade: t.misslyckade, tid: t.tid });
  if (!u.godkand1_av) {
    db.query('UPDATE uppgraderingar SET godkand1_av = ?, godkand1 = ?, tester = ? WHERE id = ?').run(personal.id, iso(nu), tester, u.id);
    loggaHandelse(db, personal, `uppgradering:${u.id}`, `Uppgraderingen till version ${u.till} godkändes av den första systemförvaltaren.`, nu);
    return { uppgradering: uppgraderingUt(db, db.query('SELECT * FROM uppgraderingar WHERE id = ?').get(u.id), personal), genomford: false };
  }
  // Den andra systemförvaltaren: uppgraderingen används nu.
  let resultat;
  db.transaction(() => {
    const ut = tillVersion(db, u.till, mig, nu);
    installning(db, 'driftversion', u.till);
    const status = schemastatus(db, mig, program);
    if (!status.stammer) throw new Fel(500, 'Schemat stämmer inte efter uppgraderingen.', 'fel');
    resultat = { tillampade: ut.tillampade.length, stammer: status.stammer, schemaversion: status.schemaversion };
  })();
  db.query("UPDATE uppgraderingar SET godkand2_av = ?, godkand2 = ?, status = 'genomford', genomford = ?, tester = ?, resultat = ? WHERE id = ?")
    .run(personal.id, iso(nu), iso(nu), tester, JSON.stringify(resultat), u.id);
  loggaHandelse(db, personal, `uppgradering:${u.id}`, `Uppgraderingen till version ${u.till} godkändes av en andra systemförvaltare och används nu. ${resultat.tillampade} migreringar tillämpades.`, nu);
  return { uppgradering: uppgraderingUt(db, db.query('SELECT * FROM uppgraderingar WHERE id = ?').get(u.id), personal), genomford: true, schema: schemastatus(db, mig, program) };
}
