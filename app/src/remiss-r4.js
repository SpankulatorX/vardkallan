// Remiss, del 2 (runda 6, r4, Sussa 3.3.1.3 till 3.3.1.6): bilagor, utkast, vidarebefordran och ledtider.
//
// Systemet är experten:
//   - Filtypen avgörs ur filens innehåll, inte ur namnet, och bara PDF, PNG, JPEG och text tas emot. Storleken
//     kontrolleras, filen lagras på servern och varje hämtning loggas.
//   - Ett utkast har prioritet och sista svarsdatum ifyllt och kan återanvända en tidigare remiss. Systemet säger vad
//     som saknas när det skickas.
//   - Vid vidarebefordran kvitterar systemet mottagningen, och remissen går vidare med samma avsändare, så att svaret
//     hamnar rätt. Den vårdenhet som skickade vidare har inte längre vårdrelation genom remissen.
//   - Ledtiderna räknas av systemet mellan mätpunkterna i statuskedjan, utan personuppgifter.
import { createHash } from 'node:crypto';
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import * as remiss from './remiss.js';

// Avsändaren av en egen vårdbegäran från invånaren (vardbegaran.js), som en enhet utan vårdenhet.
export const EGEN = 'min-journal';
export const EGEN_NAMN = 'Egen vårdbegäran via Min journal';
export const MAX_BILAGA = 40 * 1024;
export const MAX_BILAGOR = 5;

export const SCHEMA_REMISS_R4 = `
CREATE TABLE IF NOT EXISTS remiss_bilagor (
  id INTEGER PRIMARY KEY, remiss_id INTEGER, utkast_id INTEGER, patient_id TEXT NOT NULL, namn TEXT NOT NULL, typ TEXT NOT NULL, storlek INTEGER NOT NULL,
  sha256 TEXT NOT NULL, data BLOB NOT NULL, skapad TEXT NOT NULL, skapad_av TEXT, skapad_av_invanare TEXT
);
CREATE INDEX IF NOT EXISTS ix_remiss_bilagor ON remiss_bilagor (remiss_id);
CREATE TRIGGER IF NOT EXISTS remiss_bilaga_raderas_ej BEFORE DELETE ON remiss_bilagor BEGIN SELECT RAISE(ABORT, 'En bilaga raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS remiss_bilaga_andras_ej BEFORE UPDATE OF data, namn, typ, sha256 ON remiss_bilagor BEGIN SELECT RAISE(ABORT, 'En bilaga ändras inte'); END;
CREATE TABLE IF NOT EXISTS remiss_utkast (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, skapad_av TEXT NOT NULL, till_enhet_id TEXT, fragestallning TEXT, anamnes TEXT,
  prioritet TEXT NOT NULL DEFAULT 'normal', svar_senast TEXT NOT NULL, skapad TEXT NOT NULL, andrad TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'utkast', remiss_id INTEGER,
  CHECK (status IN ('utkast', 'skickad', 'borttagen'))
);
CREATE TABLE IF NOT EXISTS remiss_vidarebefordran (
  fran_remiss_id INTEGER PRIMARY KEY, till_remiss_id INTEGER NOT NULL, fran_enhet_id TEXT NOT NULL, till_enhet_id TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL, motivering TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS egen_vardbegaran (remiss_id INTEGER PRIMARY KEY, invanare_id TEXT NOT NULL, patient_id TEXT NOT NULL, skal TEXT, skapad TEXT NOT NULL);
`;

export function sakraRemissR4(db) {
  db.exec(SCHEMA_REMISS_R4);
  db.query("INSERT OR IGNORE INTO enheter (id, hsa_id, namn, kortnamn, typ, forald_id) VALUES (?, 'DEMO-MINJOURNAL', ?, 'Min journal', 'etjanst', NULL)").run(EGEN, EGEN_NAMN);
}
const harTabeller = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'remiss_bilagor'").get());

// ---------------------------------------------------------------------------------------------------------------
// Bilagor

const TYPER = { 'application/pdf': { text: 'PDF', ext: 'pdf' }, 'image/png': { text: 'Bild (PNG)', ext: 'png' }, 'image/jpeg': { text: 'Bild (JPEG)', ext: 'jpg' }, 'text/plain': { text: 'Text', ext: 'txt' } };

// Filtypen ur innehållet. Text tas emot när den är giltig UTF-8 utan styrtecken.
export function typFor(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    if (!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(t)) return 'text/plain';
  } catch { /* inte text */ }
  return null;
}

// Läser och kontrollerar en bilaga ur anropet: { namn, data } med data i base64.
export function tolkaBilaga(inp) {
  const namn = typeof inp?.namn === 'string' ? inp.namn.replace(/[\\/\x00-\x1f]/g, '').trim().slice(0, 100) : '';
  if (!namn) throw new Fel(400, 'Bilagan behöver ett namn.', 'ogiltig', { falt: ['namn'] });
  if (typeof inp?.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(inp.data)) throw new Fel(400, 'Filen kunde inte läsas.', 'ogiltig', { falt: ['data'] });
  const buf = Buffer.from(inp.data, 'base64');
  if (!buf.length) throw new Fel(400, 'Filen är tom.', 'ogiltig', { falt: ['data'] });
  if (buf.length > MAX_BILAGA) throw new Fel(400, `Filen är för stor. En bilaga får vara högst 40 kB i demon.`, 'ogiltig', { falt: ['data'] });
  const typ = typFor(buf);
  if (!typ) throw new Fel(400, 'Filtypen stöds inte. Bifoga PDF, PNG, JPEG eller text. Systemet avgör typen ur filens innehåll.', 'ogiltig', { falt: ['data'] });
  return { namn, typ, buf };
}

export function sparaBilaga(db, { remissId = null, utkastId = null, patientId, bilaga, av = null, avInvanare = null }) {
  const antal = db.query('SELECT count(*) AS n FROM remiss_bilagor WHERE (remiss_id = ? AND ? IS NOT NULL) OR (utkast_id = ? AND ? IS NOT NULL)').get(remissId, remissId, utkastId, utkastId).n;
  if (antal >= MAX_BILAGOR) throw new Fel(400, `En remiss kan ha högst ${MAX_BILAGOR} bilagor i demon.`, 'ogiltig');
  const id = Number(db.query(`INSERT INTO remiss_bilagor (remiss_id, utkast_id, patient_id, namn, typ, storlek, sha256, data, skapad, skapad_av, skapad_av_invanare)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(remissId, utkastId, patientId, bilaga.namn, bilaga.typ, bilaga.buf.length,
    createHash('sha256').update(bilaga.buf).digest('hex'), bilaga.buf, iso(), av, avInvanare).lastInsertRowid);
  return bilagaUt(db.query('SELECT id, namn, typ, storlek, skapad, skapad_av, skapad_av_invanare FROM remiss_bilagor WHERE id = ?').get(id));
}

const bilagaUt = (b) => ({ id: b.id, namn: b.namn, typ: b.typ, typText: TYPER[b.typ]?.text ?? b.typ, storlek: b.storlek, skapad: b.skapad, avPatienten: Boolean(b.skapad_av_invanare) });
const bilagorFor = (db, sql, id) => db.query(`SELECT id, namn, typ, storlek, skapad, skapad_av, skapad_av_invanare FROM remiss_bilagor WHERE ${sql} = ? ORDER BY id`).all(id).map(bilagaUt);

// Det som remissUt (remiss.js) visar utöver statuskedjan: bilagorna för den som får läsa kliniska uppgifter (annars
// bara antalet), vidarebefordran och om remissen är en egen vårdbegäran från invånaren.
export function remissTillagg(db, r, klinisk) {
  if (!harTabeller(db)) return {};
  const bilagor = bilagorFor(db, 'remiss_id', r.id);
  const vb = db.query('SELECT * FROM remiss_vidarebefordran WHERE fran_remiss_id = ?').get(r.id);
  const fran = db.query('SELECT * FROM remiss_vidarebefordran WHERE till_remiss_id = ?').get(r.id);
  const enhet = (id) => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id });
  const person = (id) => (id ? { id, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id } : null);
  const egen = r.fran_enhet_id === EGEN;
  return {
    bilagor: klinisk ? bilagor : null, antalBilagor: bilagor.length, egen,
    ...(egen ? { avsandare: { id: null, namn: 'Patienten själv' } } : {}),
    vidarebefordrad: vb ? { till: enhet(vb.till_enhet_id), tid: vb.tid, av: person(vb.av), motivering: klinisk ? vb.motivering : null, remissId: vb.till_remiss_id } : null,
    vidarebefordradFran: fran ? { fran: enhet(fran.fran_enhet_id), tid: fran.tid, motivering: klinisk ? fran.motivering : null } : null,
  };
}

// Bilagan som fil. Den som hämtar ska få läsa remissen: läsa remisser, och remissen till eller från den egna vårdenheten
// eller enligt inre sekretess. Hämtningen loggas.
export function bilagaFil(atk, bilaga) {
  const db = atk.db;
  atk.krav('las_remiss', { beskrivning: `bilaga:${bilaga.id}` });
  const min = vardenhetFor(db, atk.personal.enhet_id);
  if (bilaga.remiss_id) {
    const r = remiss.hamtaRad(db, bilaga.remiss_id);
    if (r.fran_enhet_id !== min && r.till_enhet_id !== min) atk.krav('las_remiss', { resurs: { enhet_id: r.fran_enhet_id }, beskrivning: `bilaga:${bilaga.id}` });
  } else {
    const u = db.query('SELECT * FROM remiss_utkast WHERE id = ?').get(bilaga.utkast_id);
    if (!u || u.skapad_av !== atk.personal.id) throw new Fel(404, 'Bilagan finns inte.', 'saknas');
  }
  atk.logga('las_remiss', atk.grund(), `bilaga:${bilaga.id}`);
  const typ = TYPER[bilaga.typ] ?? { ext: 'bin' };
  return new Response(bilaga.data, { headers: {
    'Content-Type': bilaga.typ, 'Content-Disposition': `attachment; filename="bilaga-${bilaga.id}.${typ.ext}"; filename*=UTF-8''${encodeURIComponent(bilaga.namn)}`,
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'no-store',
  } });
}
export function bilagaRad(db, id) {
  const b = db.query('SELECT * FROM remiss_bilagor WHERE id = ?').get(Number(id));
  if (!b) throw new Fel(404, 'Bilagan finns inte.', 'saknas');
  return b;
}

// Avsändaren kompletterar en skickad remiss med en bilaga, fram till svaret.
export function kompletteraMedBilaga(atk, r, body) {
  atk.krav('remittera');
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== r.fran_enhet_id) {
    atk.logga('remittera', 'nekad', `remiss:${r.id}:bilaga`, 'nekad');
    throw new Fel(403, 'Bara den remitterande vårdenheten kan komplettera remissen.', 'nekad');
  }
  if (!['skickad', 'mottagen'].includes(r.status) && !(r.status === 'bedomd' && r.beslut === 'accepterad')) throw new Fel(400, 'Remissen är redan besvarad eller avslutad och kan inte kompletteras.', 'ogiltig');
  const b = sparaBilaga(atk.db, { remissId: r.id, patientId: r.patient_id, bilaga: tolkaBilaga(body), av: atk.personal.id });
  atk.logga('remittera', atk.grund(), `remiss:${r.id}:bilaga:${b.id}`);
  return [201, b];
}

// ---------------------------------------------------------------------------------------------------------------
// Utkast

const SVAR_DAGAR = 14;
function utkastUt(db, u) {
  const enhet = (id) => (id ? { id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id } : null);
  return {
    id: u.id, status: u.status, patientId: u.patient_id, fran: enhet(u.enhet_id), till: enhet(u.till_enhet_id), fragestallning: u.fragestallning ?? '', anamnes: u.anamnes ?? '',
    prioritet: u.prioritet, svarSenast: u.svar_senast, skapad: u.skapad, andrad: u.andrad, remissId: u.remiss_id ?? null, bilagor: bilagorFor(db, 'utkast_id', u.id),
  };
}
// Bara den som skrev utkastet ser och ändrar det. Andra får samma svar som när det inte finns.
export function utkastRad(atk, id) {
  const u = atk.db.query("SELECT * FROM remiss_utkast WHERE id = ? AND status <> 'borttagen'").get(Number(id));
  if (!u || u.skapad_av !== atk.personal.id) throw new Fel(404, 'Utkastet finns inte.', 'saknas');
  return u;
}

function faltUr(db, atk, body, u = {}) {
  const ut = {};
  const min = vardenhetFor(db, atk.personal.enhet_id);
  if (body.tillEnhetId !== undefined) {
    const t = body.tillEnhetId ? db.query("SELECT id FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(body.tillEnhetId) : null;
    if (body.tillEnhetId && (!t || t.id === min)) throw new Fel(400, 'Välj en annan vårdenhet som mottagare.', 'ogiltig', { falt: ['tillEnhetId'] });
    ut.till_enhet_id = t?.id ?? null;
  }
  if (body.fragestallning !== undefined) ut.fragestallning = String(body.fragestallning ?? '').slice(0, 2000);
  if (body.anamnes !== undefined) ut.anamnes = String(body.anamnes ?? '').slice(0, 8000);
  if (body.prioritet !== undefined) {
    if (!remiss.PRIORITETER.includes(body.prioritet)) throw new Fel(400, 'Välj akut, skyndsam eller normal prioritet.', 'ogiltig', { falt: ['prioritet'] });
    ut.prioritet = body.prioritet;
  }
  if (body.svarSenast !== undefined) {
    if (!giltigtDatum(body.svarSenast) || body.svarSenast < idag()) throw new Fel(400, 'Välj ett sista svarsdatum från i dag.', 'ogiltig', { falt: ['svarSenast'] });
    ut.svar_senast = body.svarSenast;
  }
  return { ...u, ...ut };
}

export function skapaUtkast(atk, body = {}) {
  atk.krav('remittera');
  const db = atk.db;
  let grund = {};
  if (body.franRemissId !== undefined) {
    // Återanvändning: bara en remiss om samma patient som användaren får läsa.
    const synliga = remiss.forPatient(atk).remisser;
    const r = synliga.find(x => x.id === Number(body.franRemissId));
    if (!r || r.fragestallning == null) throw new Fel(400, 'Den remissen kan inte återanvändas här.', 'ogiltig', { falt: ['franRemissId'] });
    const min = vardenhetFor(db, atk.personal.enhet_id);
    grund = { till_enhet_id: r.till.id !== min ? r.till.id : null, fragestallning: r.fragestallning, anamnes: r.anamnes ?? '', prioritet: r.prioritet };
  }
  const f = faltUr(db, atk, body, grund);
  const nu = iso();
  const id = Number(db.query(`INSERT INTO remiss_utkast (patient_id, enhet_id, skapad_av, till_enhet_id, fragestallning, anamnes, prioritet, svar_senast, skapad, andrad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, vardenhetFor(db, atk.personal.enhet_id), atk.personal.id, f.till_enhet_id ?? null, f.fragestallning ?? null,
    f.anamnes ?? null, f.prioritet ?? 'normal', f.svar_senast ?? addDagar(idag(), SVAR_DAGAR), nu, nu).lastInsertRowid);
  atk.logga('remittera', atk.grund(), `remissutkast:${id}`);
  return [201, utkastUt(db, db.query('SELECT * FROM remiss_utkast WHERE id = ?').get(id))];
}

export function andraUtkast(atk, u, body = {}) {
  atk.krav('remittera');
  if (u.status !== 'utkast') throw new Fel(400, 'Utkastet är redan skickat.', 'ogiltig');
  const f = faltUr(atk.db, atk, body);
  const kol = Object.keys(f);
  if (kol.length) atk.db.query(`UPDATE remiss_utkast SET ${kol.map(k => `${k} = ?`).join(', ')}, andrad = ? WHERE id = ?`).run(...kol.map(k => f[k]), iso(), u.id);
  atk.logga('remittera', atk.grund(), `remissutkast:${u.id}:andrat`);
  return utkastUt(atk.db, atk.db.query('SELECT * FROM remiss_utkast WHERE id = ?').get(u.id));
}

export function utkastFor(atk) {
  atk.krav('remittera');
  return { utkast: atk.db.query("SELECT * FROM remiss_utkast WHERE patient_id = ? AND skapad_av = ? AND status = 'utkast' ORDER BY andrad DESC").all(atk.patientId, atk.personal.id).map(u => utkastUt(atk.db, u)) };
}

// Skickar utkastet som en remiss med samma kontroller som en ny remiss. knyt knyter remissen till en vårdkontakt.
export function skickaUtkast(atk, u, { knyt = (x) => x } = {}) {
  atk.krav('remittera');
  const db = atk.db;
  if (u.status !== 'utkast') throw new Fel(400, 'Utkastet är redan skickat.', 'ogiltig');
  const ut = knyt(remiss.skapa(atk, { tillEnhetId: u.till_enhet_id, fragestallning: u.fragestallning ?? '', anamnes: u.anamnes ?? '', prioritet: u.prioritet, svarSenast: u.svar_senast }));
  db.query('UPDATE remiss_bilagor SET remiss_id = ? WHERE utkast_id = ?').run(ut.id, u.id);
  db.query("UPDATE remiss_utkast SET status = 'skickad', remiss_id = ?, andrad = ? WHERE id = ?").run(ut.id, iso(), u.id);
  atk.logga('remittera', atk.grund(), `remissutkast:${u.id}:skickad:${ut.id}`);
  return [201, remiss.remissUt(db, remiss.hamtaRad(db, ut.id))];
}

export function taBortUtkast(atk, u) {
  atk.krav('remittera');
  if (u.status !== 'utkast') throw new Fel(400, 'Utkastet är redan skickat.', 'ogiltig');
  atk.db.query("UPDATE remiss_utkast SET status = 'borttagen', andrad = ? WHERE id = ?").run(iso(), u.id);
  atk.logga('remittera', atk.grund(), `remissutkast:${u.id}:borttaget`);
  return { ok: true };
}

export function bilagaTillUtkast(atk, u, body) {
  atk.krav('remittera');
  if (u.status !== 'utkast') throw new Fel(400, 'Utkastet är redan skickat. Komplettera remissen i stället.', 'ogiltig');
  const b = sparaBilaga(atk.db, { utkastId: u.id, patientId: u.patient_id, bilaga: tolkaBilaga(body), av: atk.personal.id });
  atk.logga('remittera', atk.grund(), `remissutkast:${u.id}:bilaga:${b.id}`);
  return [201, b];
}

// ---------------------------------------------------------------------------------------------------------------
// Vidarebefordran

export function vidarebefordra(atk, r, body = {}) {
  const db = atk.db;
  const min = vardenhetFor(db, atk.personal.enhet_id);
  if (r.till_enhet_id !== min) throw new Fel(403, 'Remissen är inte ställd till din vårdenhet.', 'nekad');
  atk.krav('bedom_remiss');
  if (!['skickad', 'mottagen'].includes(r.status)) throw new Fel(400, 'Remissen är redan bedömd och kan inte skickas vidare.', 'ogiltig');
  const till = typeof body.tillEnhetId === 'string' ? db.query("SELECT * FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(body.tillEnhetId) : null;
  if (!till || till.id === min) throw new Fel(400, 'Välj en annan vårdenhet att skicka remissen till.', 'ogiltig', { falt: ['tillEnhetId'] });
  if (till.id === r.fran_enhet_id) throw new Fel(400, 'Remissen kommer därifrån. Avvisa den med en motivering i stället, så får avsändaren besked.', 'ogiltig', { falt: ['tillEnhetId'] });
  const motivering = typeof body.motivering === 'string' ? body.motivering.trim().slice(0, 1000) : '';
  if (motivering.length < 3) throw new Fel(400, 'Skriv varför remissen skickas vidare. Avsändaren och mottagaren ser motiveringen.', 'ogiltig', { falt: ['motivering'] });
  const nu = iso();
  // Systemet kvitterar mottagningen om ingen har gjort det.
  db.query("UPDATE remisser SET mottagen_tid = coalesce(mottagen_tid, ?), mottagen_av = coalesce(mottagen_av, ?), status = 'bedomd', bedomd_tid = ?, bedomd_av = ?, beslut = 'vidarebefordrad', motivering = ? WHERE id = ?")
    .run(nu, atk.personal.id, nu, atk.personal.id, `Vidarebefordrad till ${till.namn}: ${motivering}`, r.id);
  const ny = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?)`).run(r.patient_id, r.fran_enhet_id, till.id, r.avsandare_id, r.fragestallning, r.anamnes, r.prioritet, r.svar_senast, nu).lastInsertRowid);
  db.query('INSERT INTO remiss_vidarebefordran VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, ny, min, till.id, atk.personal.id, nu, motivering);
  for (const b of db.query('SELECT * FROM remiss_bilagor WHERE remiss_id = ?').all(r.id)) {
    db.query(`INSERT INTO remiss_bilagor (remiss_id, patient_id, namn, typ, storlek, sha256, data, skapad, skapad_av, skapad_av_invanare) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ny, b.patient_id, b.namn, b.typ, b.storlek, b.sha256, b.data, b.skapad, b.skapad_av, b.skapad_av_invanare);
  }
  const egen = db.query('SELECT * FROM egen_vardbegaran WHERE remiss_id = ?').get(r.id);
  if (egen) db.query('INSERT INTO egen_vardbegaran VALUES (?, ?, ?, ?, ?)').run(ny, egen.invanare_id, egen.patient_id, egen.skal, egen.skapad);
  atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:vidarebefordrad:${ny}`);
  return { gammal: remiss.remissUt(db, remiss.hamtaRad(db, r.id)), ny: remiss.remissUt(db, remiss.hamtaRad(db, ny)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Ledtider och avvikelser utan personuppgifter

const MINSTA_ANTAL = 3;
const TIMME = 3600_000;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avrunda = (x) => (x == null ? null : Math.round(x * 10) / 10);
const talText = (x, enhet) => `${String(avrunda(x)).replace('.', ',')} ${x === 1 && enhet === 'timmar' ? 'timme' : x === 1 && enhet === 'dagar' ? 'dag' : enhet}`;

// Mätpunkterna i statuskedjan, med den förväntade handläggningstiden där systemet har en (larmgränserna i remiss.js).
// En funktion, eftersom remiss.js och den här modulen läser varandra.
const matpunkterDef = () => [
  { id: 'mottagen', text: 'Från skickad till mottagen', enhet: 'timmar', fran: 'skickad_tid', till: 'mottagen_tid', forvantat: remiss.LARMGRANS.mottagningskvittensTimmar },
  { id: 'bedomd', text: 'Från mottagen till bedömd', enhet: 'dagar', fran: 'mottagen_tid', till: 'bedomd_tid', forvantat: null },
  { id: 'besvarad', text: 'Från bedömd till besvarad', enhet: 'dagar', fran: 'bedomd_tid', till: 'besvarad_tid', forvantat: null },
  { id: 'kvitterat', text: 'Från besvarad till kvitterat svar', enhet: 'dagar', fran: 'besvarad_tid', till: 'svar_kvitterat_tid', forvantat: remiss.LARMGRANS.svarKvittensDagar },
];
const LARMTEXT = { saknar_mottagningskvittens: 'Mottagningskvittens saknas efter 2 timmar', svar_forsenat: 'Svar saknas efter sista svarsdatum', svar_ej_kvitterat: 'Svaret är inte kvitterat efter 3 dagar' };

function riktning(rader, { skydda, utgaende }) {
  const nu = new Date();
  const matpunkter = matpunkterDef().map(m => {
    const v = rader.filter(r => r[m.fran] && r[m.till] && r.beslut !== 'vidarebefordrad').map(r => (Date.parse(r[m.till]) - Date.parse(r[m.fran])) / (m.enhet === 'timmar' ? TIMME : 24 * TIMME));
    const dold = skydda && v.length < MINSTA_ANTAL;
    const med = dold ? null : avrunda(median(v));
    const inom = m.forvantat != null && v.length ? Math.round((100 * v.filter(x => x <= m.forvantat).length) / v.length) : null;
    return { id: m.id, text: m.text, enhet: m.enhet, forvantat: m.forvantat, antal: v.length, median: med, medianText: dold ? 'För få för att visa' : med == null ? 'Inga ännu' : talText(med, m.enhet), inomForvantat: dold ? null : inom };
  });
  // Besvarade inom sista svarsdatum.
  const besvarade = rader.filter(r => r.besvarad_tid);
  const inomSvar = besvarade.filter(r => new Date(r.besvarad_tid).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) <= r.svar_senast).length;
  const avvikelser = Object.entries(LARMTEXT).filter(([typ]) => utgaende || typ !== 'svar_ej_kvitterat').map(([typ, text]) => ({ typ, text, antal: rader.filter(r => remiss.larmFor(r, nu).some(l => l.typ === typ)).length }));
  return {
    antal: rader.length, pagaende: rader.filter(r => !['svar_kvitterat'].includes(r.status) && !['avvisad', 'vidarebefordrad'].includes(r.beslut)).length,
    avvisade: rader.filter(r => r.beslut === 'avvisad').length, vidarebefordrade: rader.filter(r => r.beslut === 'vidarebefordrad').length,
    matpunkter, besvaradeInomSvarsdatum: besvarade.length ? (skydda && besvarade.length < MINSTA_ANTAL ? null : Math.round((100 * inomSvar) / besvarade.length)) : null, avvikelser,
  };
}

function forEnhet(db, ve, skydda) {
  const enh = db.query('SELECT id, namn FROM enheter WHERE id = ?').get(ve);
  // Migrerade remisser räknas inte, eftersom deras tider kommer från ett annat system.
  return {
    vardenhet: enh ? { id: enh.id, namn: enh.namn } : { id: ve, namn: ve },
    inkommande: riktning(db.query("SELECT * FROM remisser WHERE till_enhet_id = ? AND kalla = 'vardkallan'").all(ve), { skydda, utgaende: false }),
    utgaende: riktning(db.query("SELECT * FROM remisser WHERE fran_enhet_id = ? AND kalla = 'vardkallan'").all(ve), { skydda, utgaende: true }),
  };
}

export function statistik(db, personal, niva = 'enhet') {
  const text = 'Ledtiderna räknas av systemet ur statuskedjan, med larmgränserna som förväntad handläggningstid. Statistiken innehåller inga personuppgifter. Migrerade remisser räknas inte.';
  if (niva === 'region') {
    if (!kanRoll(personal, 'statistik_region')) throw new Fel(403, 'Statistiken för regionen är för uppföljningen.', 'nekad');
    const enheter = [...new Set(db.query("SELECT till_enhet_id AS e FROM remisser WHERE kalla = 'vardkallan' UNION SELECT fran_enhet_id FROM remisser WHERE kalla = 'vardkallan'").all().map(r => r.e))]
      .filter(e => db.query("SELECT 1 FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(e)).sort();
    return { niva, datum: idag(), minstaAntal: MINSTA_ANTAL, vardenheter: enheter.map(e => forEnhet(db, e, true)), text };
  }
  if (!kanRoll(personal, 'statistik')) throw new Fel(403, 'Din yrkesroll har inte remisstatistiken.', 'nekad');
  return { niva: 'enhet', datum: idag(), ...forEnhet(db, vardenhetFor(db, personal.enhet_id), false), text };
}
