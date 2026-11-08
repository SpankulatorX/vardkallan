// En avliden patient (runda 10, r4, beslut av projektägaren 2026-11-08). När läkaren registrerar ett dödsfall
// (donation.js) märks patienten som avliden med datum. Märkningen är en uppgift om patienten, som i folkbokföringen, och
// visas därför i patientens huvud och i sökningen oavsett vårdenhet. Dödsfallets uppgifter (tid och kriterier) följer
// journalens behörighet som förut.
//
// Systemet är experten: det stoppar nya bokningar, kallelser, påminnelser och sms till patienten, avbokar kommande tider
// med orsak utan att något skickas, avslutar posterna på väntelistan och meddelar den simulerade folkbokföringen. Ingen
// behöver komma ihåg att avboka eller stryka något. Journalen går fortfarande att läsa och dokumentera i.
//
// Modulen importerar bara databasen, så att tidboken kan läsa den.
import { Fel } from './db.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS avlidna (
  patient_id TEXT PRIMARY KEY, datum TEXT NOT NULL, dodsfall_id INTEGER, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL,
  folkbokforing TEXT, avbokade INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS avlidna_andras_ej BEFORE UPDATE OF datum, dodsfall_id, registrerad, registrerad_av ON avlidna BEGIN SELECT RAISE(ABORT, 'Ett registrerat dödsfall ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS avlidna_raderas_ej BEFORE DELETE ON avlidna BEGIN SELECT RAISE(ABORT, 'Ett registrerat dödsfall raderas inte.'); END;
`;
export const FOLKBOKFORING = 'Skatteverkets folkbokföring (simulerad)';
export const ORSAK = 'Patienten har avlidit';

const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'avlidna'").get());
export function sakra(db) { db.exec(SCHEMA); }

// { datum, folkbokforing } eller null.
export function avlidenFor(db, patientId) {
  if (!patientId || !finns(db)) return null;
  const r = db.query('SELECT * FROM avlidna WHERE patient_id = ?').get(patientId);
  return r ? { datum: r.datum, text: `Avliden ${r.datum}`, folkbokforing: r.folkbokforing ? JSON.parse(r.folkbokforing) : null } : null;
}

// Stoppar en ny bokning för en avliden patient.
export function kravInteAvliden(db, patientId) {
  const a = avlidenFor(db, patientId);
  if (a) throw new Fel(409, `${ORSAK} ${a.datum}. Ingen ny tid bokas.`, 'avliden');
}

// Märker patienten som avliden. avboka är tidbokens funktion som avbokar kommande tider utan att något skickas.
export function markera(db, { patientId, datum, dodsfallId = null, av, nu = new Date() }, avboka) {
  sakra(db);
  if (db.query('SELECT 1 FROM avlidna WHERE patient_id = ?').get(patientId)) return avlidenFor(db, patientId);
  const meddelande = { mottagare: FOLKBOKFORING, tid: nu.toISOString(), text: `Dödsfallet ${datum} är meddelat till ${FOLKBOKFORING}. Inget skickas i demon.`, simulerat: true };
  db.query('INSERT INTO avlidna (patient_id, datum, dodsfall_id, registrerad, registrerad_av, folkbokforing) VALUES (?, ?, ?, ?, ?, ?)')
    .run(patientId, datum, dodsfallId, nu.toISOString(), av, JSON.stringify(meddelande));
  const n = avboka ? avboka(db, patientId, { av, nu }) : 0;
  db.query('UPDATE avlidna SET avbokade = ? WHERE patient_id = ?').run(n, patientId);
  return { ...avlidenFor(db, patientId), avbokade: n };
}
