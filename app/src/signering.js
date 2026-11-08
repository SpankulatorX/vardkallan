// Runda 9, r7: signering med simulerat SITHS-kort och vårdenhetens signeringslista (Sussa 3.1.11.2).
//
// När en anteckning signeras, eller en rättelse signeras, räknar systemet en kontrollsumma över anteckningens innehåll
// (patient, typ, sökord, vårdenhet, författare och tid) och signerar den med nyckeln på den inloggades simulerade
// SITHS-kort. Signaturen sparas och kan inte ändras eller raderas, och den kan kontrolleras när som helst: ett innehåll
// som inte stämmer med signaturen visas som ogiltigt. Signeringen av flera utkast samtidigt finns i inkorgen (Granska och
// signera alla), och varje utkast signeras för sig.
//
// Signeringslistan visar verksamhetschefen och läkarna vårdenhetens osignerade poster per författare, med antal, typ och
// det äldsta utkastets ålder, utan patientuppgifter.
//
// Det som är simulerat: kortet och nyckeln. I verkligheten signeras med kortets privata nyckel och ett certifikat från
// SITHS, och kontrollen görs med certifikatets publika nyckel.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import { loggaRad } from './logg.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS signaturer (
  anteckning_id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, hsa_id TEXT NOT NULL, tid TEXT NOT NULL, sha256 TEXT NOT NULL, signatur TEXT NOT NULL, certifikat TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS signaturer_andras_ej BEFORE UPDATE ON signaturer BEGIN SELECT RAISE(ABORT, 'En signatur ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS signaturer_raderas_ej BEFORE DELETE ON signaturer BEGIN SELECT RAISE(ABORT, 'En signatur raderas inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'signaturer'").get());

// Nyckeln på den inloggades simulerade kort. Den finns bara i sandlådan.
function kortnyckel(db, personalId) {
  const n = `signeringsnyckel:${personalId}`;
  let k = db.query('SELECT varde FROM installningar WHERE nyckel = ?').get(n)?.varde;
  if (!k) { k = randomBytes(32).toString('base64url'); db.query('INSERT INTO installningar VALUES (?, ?)').run(n, k); }
  return k;
}
const innehall = (a) => createHash('sha256').update(JSON.stringify({ id: a.id, patient: a.patient_id, typ: a.typ, kategori: a.kategori, sokord: JSON.parse(a.sokord), enhet: a.enhet_id, forfattare: a.forfattare_id, tid: a.signerad_tid, version: a.version })).digest('hex');

// Anropas när anteckningen har fått sin signeringstid, i samma transaktion som signeringen.
export function vidSignering(db, anteckningId) {
  sakra(db);
  const a = db.query('SELECT * FROM anteckningar WHERE id = ?').get(anteckningId);
  if (!a || a.status !== 'signerad' || db.query('SELECT 1 FROM signaturer WHERE anteckning_id = ?').get(a.id)) return null;
  const p = db.query('SELECT * FROM personal WHERE id = ?').get(a.signerad_av);
  const sha = innehall(a);
  const signatur = createHmac('sha256', kortnyckel(db, p.id)).update(`${sha}|${p.hsa_id}|${a.signerad_tid}`).digest('base64url');
  db.query('INSERT INTO signaturer (anteckning_id, personal_id, hsa_id, tid, sha256, signatur, certifikat) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(a.id, p.id, p.hsa_id, a.signerad_tid, sha, signatur, `Simulerat SITHS-kort för ${p.hsa_id}`);
  return sha;
}

// GET /api/anteckning/:id/signatur. atk är prövad för anteckningen.
export function kontrollera(atk, a) {
  const db = atk.db;
  if (!harTabell(db)) throw new Fel(404, 'Anteckningen har ingen signatur.', 'saknas');
  const s = db.query('SELECT * FROM signaturer WHERE anteckning_id = ?').get(a.id);
  if (!s) throw new Fel(404, a.status === 'signerad' ? 'Anteckningen signerades innan signaturer med kort infördes, eller migrerades från ett annat system.' : 'Anteckningen är inte signerad.', 'saknas');
  const sha = innehall(a);
  const forvantad = createHmac('sha256', kortnyckel(db, s.personal_id)).update(`${s.sha256}|${s.hsa_id}|${s.tid}`).digest('base64url');
  const giltig = sha === s.sha256 && forvantad === s.signatur;
  return { anteckningId: a.id, giltig, sha256: s.sha256, tid: s.tid, av: db.query('SELECT namn FROM personal WHERE id = ?').get(s.personal_id)?.namn ?? null, hsaId: s.hsa_id, certifikat: s.certifikat,
    text: giltig ? 'Signaturen stämmer med innehållet.' : 'Innehållet stämmer inte med signaturen.', simulerat: true };
}

// GET /api/signeringslista: vårdenhetens osignerade poster per författare, utan patientuppgifter.
export function lista(db, personal) {
  if (!kanRoll(personal, 'signeringslista')) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'signeringslista', resurs: 'signeringslista', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Signeringslistan är för verksamhetschefen och läkarna på vårdenheten.', 'nekad');
  }
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const rader = db.query(`SELECT forfattare_id, typ, skapad FROM anteckningar WHERE status = 'utkast' AND enhet_id IN (${enheter.map(() => '?').join(', ')})`).all(...enheter);
  const per = new Map();
  for (const r of rader) {
    const x = per.get(r.forfattare_id) ?? { antal: 0, typer: {}, aldsta: r.skapad };
    x.antal++; x.typer[r.typ] = (x.typer[r.typ] ?? 0) + 1; if (r.skapad < x.aldsta) x.aldsta = r.skapad;
    per.set(r.forfattare_id, x);
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'signeringslista', resurs: 'signeringslista', grund: 'administrativ', resultat: 'tillaten' });
  const nu = Date.now();
  return {
    vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn,
    forfattare: [...per].map(([id, x]) => {
      const p = db.query('SELECT namn, titel FROM personal WHERE id = ?').get(id);
      return { namn: p?.namn ?? null, titel: p?.titel ?? null, antal: x.antal, typer: x.typer, aldstaDagar: Math.floor((nu - Date.parse(x.aldsta)) / 86400_000) };
    }).sort((a, b) => b.aldstaDagar - a.aldstaDagar || b.antal - a.antal),
    anmarkning: 'Utkasten syns bara för författaren. Listan visar hur många som väntar, utan patientuppgifter.',
  };
}
