// Hjälpare för testerna av specialistområdena i runda 9, r3 (operation, graviditet och förlossning, cytostatika, bilder
// och blodprodukter). Varje test lägger in sina egna patienter med Skatteverkets testpersonnummer och en pågående
// inläggning eller listning, så att vårdrelationen inte beror på dagens datum.
import { byggSeed } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import testpnr from '../src/seed/testpersonnummer.json' with { type: 'json' };

export const BAS = new Date('2026-11-09T07:00:00Z');
export const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
export const atk = (db, roll, pid, handling = 'las_oversikt', val = {}) => new Atkomst(db, pers(db, roll), pid, val, handling);
export const sandlada = (bas = BAS) => byggSeed(bas);

// Ett testpersonnummer som inte redan används, för en kvinna (kon 'K') eller man ('M') född ett visst år.
export function ledigtPnr(db, { kon, ar }) {
  const anvanda = new Set(db.query('SELECT personnummer FROM patienter').all().map(r => r.personnummer));
  // Alla år finns inte bland testpersonnumren, så det närmaste året med ett ledigt nummer används.
  const pnr = testpnr.filter(p => !anvanda.has(p) && (Number(p[10]) % 2 === 0) === (kon === 'K'))
    .sort((a, b) => Math.abs(Number(a.slice(0, 4)) - ar) - Math.abs(Number(b.slice(0, 4)) - ar) || a.localeCompare(b))[0];
  if (pnr) return pnr;
  throw new Error(`Inget ledigt testpersonnummer för ${kon} ${ar}`);
}

// En patient med en pågående inläggning (slutenvård utan slut) eller listning på enheten.
export function nyPatient(db, { id, kon = 'K', ar = 1990, enhet, fornamn = 'Testa', efternamn = 'Testsson', skyddad = 0, listning = false, start = BAS }) {
  const pnr = ledigtPnr(db, { kon, ar });
  const fodd = `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}`;
  db.query('INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, skyddad) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, pnr, fornamn, efternamn, kon === 'K' ? 'kvinna' : 'man', fodd, skyddad);
  if (listning) db.query('INSERT INTO listningar (patient_id, enhet_id, fran) VALUES (?, ?, ?)').run(id, enhet, '2020-01-01');
  else db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES (?, ?, 'slutenvard', ?, 'Avdelning', 'Planerad vård')").run(id, enhet, new Date(start.getTime() - 86400_000).toISOString());
  return db.query('SELECT * FROM patienter WHERE id = ?').get(id);
}
export const sparr = (db, pid, enhet) => db.query('INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, ?, ?)').run(pid, enhet, BAS.toISOString());
export const efter = (min, bas = BAS) => new Date(bas.getTime() + min * 60_000);
