// Runda 10, r3: valet att låta webbläsarens leverantör känna igen talet (Sussa 3.1.3.2 och 3.1.3.7). Patientens röst ska
// inte gå till en molntjänst. Igenkänningen görs därför på enheten när webbläsaren kan det, och i drift av en lokal motor
// på regionens egna servrar (docs/design.md). När webbläsaren bara har sin leverantörs tjänst visar Diktera första gången
// en förklaring, och användaren måste välja att fortsätta. Valet sparas här per användare, så att det följer personen och
// inte webbläsaren. Inga patientuppgifter.
import { Fel, iso } from './db.js';

const sakra = (db) => require('./formularmotor.js').sakra(db);

export function val(db, personal) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakra(db);
  const r = db.query('SELECT valt FROM rost_val WHERE personal_id = ?').get(personal.id);
  return { molntjanst: Boolean(r), valt: r?.valt ?? null };
}

export function godkann(db, personal) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakra(db);
  db.query('INSERT OR IGNORE INTO rost_val (personal_id, valt) VALUES (?, ?)').run(personal.id, iso());
  return val(db, personal);
}
