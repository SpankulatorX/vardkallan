// Underlag till beställningar och svar (runda 11, r6, Sussa 4.4.2.6 och 4.4.2.13): en bild, ett tidigare utlåtande eller
// ett dokument som läkaren bifogar till beställningen, och kurvor och rapporter som laboratoriet eller den utförande
// enheten bifogar till svaret (till exempel EKG-kurvan). Underlagen hör till beställningen och visas med samma
// behörighet som beställningen. De ändras och raderas aldrig.
//
// Systemet är experten: filtypen avgörs ur filens innehåll (PNG, JPEG, PDF eller text), och underlaget knyts själv till
// beställningen och till den analys som svaret gäller.
import { createHash } from 'node:crypto';
import { Fel, iso } from './db.js';
import { typFor } from './remiss-r4.js';
import * as labb from './labb.js';

// Samma gräns som för remissernas bilagor, eftersom ett anrop till servern är högst 64 kB.
export const MAX_BYTE = 40 * 1024;
export const MAX_PER_BESTALLNING = 6;
export const MAX_PER_SANDLADA = 2 * 1024 * 1024;
export const TYPER = Object.freeze(Object.assign(Object.create(null), { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'text/plain': 'txt' }));

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS labb_underlag (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bestallning_id INTEGER NOT NULL, analys_rad_id INTEGER, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  riktning TEXT NOT NULL, namn TEXT NOT NULL, typ TEXT NOT NULL, storlek INTEGER NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL,
  registrerad TEXT NOT NULL, registrerad_av TEXT, kalla TEXT NOT NULL,
  CHECK (riktning IN ('bestallning', 'svar'))
);
CREATE INDEX IF NOT EXISTS ix_labb_underlag_best ON labb_underlag (bestallning_id);
CREATE TRIGGER IF NOT EXISTS labb_underlag_andras_ej BEFORE UPDATE OF bestallning_id, analys_rad_id, riktning, namn, typ, storlek, sha256, data, registrerad, registrerad_av, kalla ON labb_underlag
  BEGIN SELECT RAISE(ABORT, 'Ett underlag ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS labb_underlag_raderas_ej BEFORE DELETE ON labb_underlag
  BEGIN SELECT RAISE(ABORT, 'Ett underlag raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { labb.sakraLabb(db); db.exec(SCHEMA); har.add(db); } }
const finns = (db) => har.has(db) || Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'labb_underlag'").get() && (har.add(db), true));

// Läser en fil ur anropet: { namn, data } med data i base64.
export function tolka(inp) {
  const namn = typeof inp?.namn === 'string' ? inp.namn.replace(/[\\/\x00-\x1f]/g, '').trim().slice(0, 100) : '';
  if (!namn) throw new Fel(400, 'Underlaget behöver ett filnamn.', 'ogiltig', { falt: ['underlag'] });
  if (typeof inp?.data !== 'string' || inp.data.length > MAX_BYTE * 2 || !/^[A-Za-z0-9+/=\s]+$/.test(inp.data)) throw new Fel(400, 'Underlaget kunde inte läsas.', 'ogiltig', { falt: ['underlag'] });
  const buf = Buffer.from(inp.data, 'base64');
  if (!buf.length) throw new Fel(400, 'Underlaget är tomt.', 'ogiltig', { falt: ['underlag'] });
  if (buf.length > MAX_BYTE) throw new Fel(400, 'Underlaget är för stort. En fil får vara högst 40 kB i demon.', 'ogiltig', { falt: ['underlag'] });
  const typ = typFor(buf);
  if (!typ || !Object.hasOwn(TYPER, typ)) throw new Fel(400, 'Filtypen stöds inte. Bifoga en bild i PNG eller JPEG, en PDF eller en textfil. Systemet avgör typen ur filens innehåll.', 'ogiltig', { falt: ['underlag'] });
  return { namn, typ, buf };
}

// Prövar alla filer innan något sparas, så att en beställning aldrig får hälften av sina underlag.
export function provaAlla(db, lista, bestallningId = null) {
  if (lista == null) return [];
  if (!Array.isArray(lista)) throw new Fel(400, 'Skicka underlagen som en lista.', 'ogiltig', { falt: ['underlag'] });
  const filer = lista.map(tolka);
  const redan = bestallningId && finns(db) ? db.query('SELECT count(*) AS n FROM labb_underlag WHERE bestallning_id = ?').get(bestallningId).n : 0;
  if (redan + filer.length > MAX_PER_BESTALLNING) throw new Fel(409, `En beställning kan ha högst ${MAX_PER_BESTALLNING} underlag.`, 'tak');
  const totalt = finns(db) ? db.query('SELECT coalesce(sum(storlek), 0) AS s FROM labb_underlag').get().s : 0;
  if (totalt + filer.reduce((n, f) => n + f.buf.length, 0) > MAX_PER_SANDLADA) throw new Fel(409, 'Sandlådan har inte plats för fler underlag. Börja om med en ny sandlåda.', 'tak');
  return filer;
}

export function spara(db, b, filer, { riktning = 'bestallning', analysId = null, av = null, kalla = 'vardkallan', nu = new Date() } = {}) {
  sakra(db);
  const ins = db.query(`INSERT INTO labb_underlag (bestallning_id, analys_rad_id, patient_id, enhet_id, riktning, namn, typ, storlek, sha256, data, registrerad, registrerad_av, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const f of filer) ins.run(b.id, analysId, b.patient_id, b.enhet_id, riktning, f.namn, f.typ, f.buf.length, createHash('sha256').update(f.buf).digest('hex'), f.buf, iso(nu), av, kalla);
}

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
export const underlagUt = (db, u) => ({
  id: u.id, namn: u.namn, typ: u.typ, storlek: u.storlek, sha256: u.sha256, riktning: u.riktning, analysId: u.analys_rad_id, registrerad: u.registrerad,
  av: u.registrerad_av ? personNamn(db, u.registrerad_av) : null, kalla: u.kalla, url: `/api/labb/underlag/${u.id}`,
});
export function forBestallning(db, bestallningId) {
  if (!finns(db)) return [];
  return db.query('SELECT id, bestallning_id, analys_rad_id, riktning, namn, typ, storlek, sha256, registrerad, registrerad_av, kalla FROM labb_underlag WHERE bestallning_id = ? ORDER BY id').all(bestallningId).map(u => underlagUt(db, u));
}
export function rad(db, id) {
  const u = finns(db) && /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM labb_underlag WHERE id = ?').get(Number(id)) : null;
  if (!u) throw new Fel(404, 'Underlaget finns inte.', 'saknas');
  return u;
}
// Filen, med samma behörighet som beställningen. Anroparen har prövat och loggar.
export function fil(u) {
  return new Response(u.data, { headers: { 'Content-Type': u.typ === 'text/plain' ? 'text/plain; charset=utf-8' : u.typ, 'Content-Disposition': `inline; filename="underlag-${u.id}.${TYPER[u.typ]}"`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
}

// Underlagen i beställningen som den visas (labb.KROKAR.bestallningUt): bifogade av beställaren och i svaren.
export function utoka(db, b, ut) {
  const lista = forBestallning(db, b.id);
  ut.underlag = lista.filter(u => u.riktning === 'bestallning');
  for (const a of ut.analyser) a.underlag = lista.filter(u => u.riktning === 'svar' && u.analysId === a.id);
}
