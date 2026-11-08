// SpO2 skala 2 i NEWS2 (runda 10, r4, Sussa 3.1.3.9). För en patient med andningssvikt med hyperkapné är målet för
// syremättnaden 88 till 92 procent, och då räknas syremättnaden med skala 2. Det är läkarens beslut.
//
// Systemet är experten: när en diagnos om andningssvikt med hyperkapné finns bland det läkaren får se föreslår systemet
// skala 2, och läkaren beslutar med ett klick. Från beslutet räknar systemet NEWS2 med skala 2 i mätvärdena, larmen och
// FHIR, och skriver målet vid NEWS2. Beslutet gäller där det syns: en annan vårdenhets beslut räknas efter aktivt val,
// och en spärrad vårdenhets beslut räknas aldrig, så att poängen inte röjer det.
import { Fel } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { personNamn, enhetKort, iso } from './specialist-hjalp.js';
import { SKALA2_MAL } from './skalor.js';

export const LAS = 'las_matvarden';
// Diagnoserna om andningssvikt med hyperkapné i ICD-10-SE (kodverk.js).
export const HYPERKAPNI = ['J96.01', 'J96.11', 'J96.91'];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS news2_skalor (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, skala INTEGER NOT NULL, beslutad TEXT NOT NULL, beslutad_av TEXT NOT NULL,
  avslutad TEXT, avslutad_av TEXT, CHECK (skala = 2)
);
CREATE TRIGGER IF NOT EXISTS news2_skalor_andras_ej BEFORE UPDATE OF enhet_id, skala, beslutad, beslutad_av ON news2_skalor BEGIN SELECT RAISE(ABORT, 'Ett beslut om skala ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS news2_skalor_raderas_ej BEFORE DELETE ON news2_skalor BEGIN SELECT RAISE(ABORT, 'Ett beslut om skala raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'news2_skalor'").get());

// Det gällande beslutet som anroparen får se, eller null.
export function beslutFor(atk) {
  if (!finns(atk.db)) return null;
  const rader = atk.db.query('SELECT * FROM news2_skalor WHERE patient_id = ? AND avslutad IS NULL ORDER BY beslutad DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, LAS)[0] ?? null;
}
export const skalaFor = (atk) => (beslutFor(atk) ? 2 : 1);

// Skalan för mätvärdesfliken: vilken skala som gäller, vem som beslutade, och systemets förslag till läkaren.
export function skalaUt(atk, diagnoskoder = []) {
  const b = beslutFor(atk);
  const kanBesluta = kanRoll(atk.personal, 'skriv_journal') && atk.prova('skriv_journal').tillaten;
  const hyperkapni = diagnoskoder.find(k => HYPERKAPNI.includes(k));
  return {
    skala: b ? 2 : 1, text: b ? SKALA2_MAL : 'Syremättnaden räknas med skala 1.',
    beslut: b ? { tid: b.beslutad, av: personNamn(atk.db, b.beslutad_av), vardenhet: enhetKort(atk.db, b.enhet_id) } : null,
    forslag: !b && kanBesluta && hyperkapni ? { kod: hyperkapni, text: `Patienten har en diagnos om andningssvikt med hyperkapné (${hyperkapni}). Överväg skala 2 för syremättnaden, med målet 88 till 92 procent.` } : null,
    kanBesluta,
  };
}

// POST /api/patient/:id/news2-skala { skala: 2 | 1 }: läkaren beslutar om skala 2, eller att skala 1 ska gälla igen.
export function besluta(atk, body = {}, nu = new Date()) {
  sakra(atk.db);
  if (!kanRoll(atk.personal, 'skriv_journal')) throw new Fel(403, 'Det är läkaren som beslutar om skalan för syremättnaden.', 'nekad');
  atk.krav('skriv_journal');
  atk.krav(LAS);
  const db = atk.db;
  if (![1, 2].includes(body.skala)) throw new Fel(400, 'Välj skala 1 eller skala 2.', 'ogiltig', { falt: ['skala'] });
  const b = beslutFor(atk);
  if (body.skala === 2) {
    if (b) throw new Fel(409, 'Skala 2 gäller redan.', 'finns_redan');
    db.query('INSERT INTO news2_skalor (patient_id, enhet_id, skala, beslutad, beslutad_av) VALUES (?, ?, 2, ?, ?)').run(atk.patientId, atk.personal.enhet_id, iso(nu), atk.personal.id);
  } else {
    if (!b) throw new Fel(409, 'Skala 1 gäller redan.', 'ogiltig');
    // Ett beslut avslutas på den vårdenhet där det fattades.
    if (vardenhetFor(db, b.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) throw new Fel(403, 'Beslutet om skala 2 avslutas på den vårdenhet där det fattades.', 'nekad');
    db.query('UPDATE news2_skalor SET avslutad = ?, avslutad_av = ? WHERE id = ?').run(iso(nu), atk.personal.id, b.id);
  }
  return skalaUt(atk);
}
