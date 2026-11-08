// Runda 9, r7: levnadsvanorna alkohol, fysisk aktivitet och matvanor som strukturerad information i en anteckning
// (Sussa 6.2.2.1), på samma sätt som tobaksvanorna (tobak.js).
//
// Anteckningstypen Levnadsvanor har inga sökord med fritext. Den som dokumenterar svarar på frågorna med fasta
// svarsalternativ (public/js/levnadsvanor-regler.js), och systemet skriver anteckningens text ur svaren, räknar risken per
// område, föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer och registrerar åtgärden med koden när
// anteckningen signeras och samtalet hölls vid besöket. Svaren sparas strukturerat bredvid anteckningen, en rad per
// version, med risken per område, så att patientgrupperingen (analys.js) och folkhälsoinsatserna (folkhalsa.js) kan
// räkna på dem.
//
// Behörigheten är anteckningens: kategorin är omvårdnad, som för tobaksvanorna.
import { Fel } from './db.js';
import { registreraAtgard } from './atgarder.js';
import * as R from '../public/js/levnadsvanor-regler.js';
import { alderFor } from './tobak.js';

export const TYP = 'Levnadsvanor';
export const MALL = { typ: TYP, kategori: 'omvardnad', sokord: ['Alkohol', 'Fysisk aktivitet', 'Matvanor', 'Stöd', 'Kommentar'], strukturerad: true };

export const SCHEMA = `
-- Svaren i en anteckning av typen Levnadsvanor, en rad per version av anteckningen. svar är JSON (levnadsvanor-regler.js),
-- risk är JSON med risken per område och forslag KVÅ-koderna som systemet föreslog. En rad ändras bara medan anteckningen
-- är ett utkast och raderas aldrig.
CREATE TABLE IF NOT EXISTS levnadsvanor (
  anteckning_id INTEGER PRIMARY KEY, svar TEXT NOT NULL, risk TEXT NOT NULL, forslag TEXT, alder INTEGER, sparad TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS levnadsvanor_raderas_ej BEFORE DELETE ON levnadsvanor
  BEGIN SELECT RAISE(ABORT, 'Svaren om levnadsvanor raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS levnadsvanor_andras_ej BEFORE UPDATE ON levnadsvanor
  WHEN (SELECT status FROM anteckningar WHERE id = OLD.anteckning_id) = 'signerad'
  BEGIN SELECT RAISE(ABORT, 'Svaren i en signerad anteckning ändras inte'); END;
`;
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'levnadsvanor'").get());
export function sakra(db) { db.exec(SCHEMA); }

export function forbered(atk, svar) {
  const alder = alderFor(atk.db, atk.patientId);
  const p = R.prova(svar, { alder });
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: [p.falt] });
  return { varde: p.varde, alder, risk: R.risk(p.varde, { alder }), forslag: R.forslag(p.varde, { alder }), sokord: R.sokord(p.varde, { alder }) };
}

export function spara(db, anteckningId, f) {
  sakra(db);
  const koder = Object.fromEntries(Object.entries(f.forslag).filter(([, x]) => x.kod).map(([o, x]) => [o, x.kod]));
  const rad = [JSON.stringify(f.varde), JSON.stringify(Object.fromEntries(Object.entries(f.risk).map(([o, x]) => [o, x.risk]))), JSON.stringify(koder), f.alder, new Date().toISOString(), anteckningId];
  if (db.query('SELECT 1 FROM levnadsvanor WHERE anteckning_id = ?').get(anteckningId)) db.query('UPDATE levnadsvanor SET svar = ?, risk = ?, forslag = ?, alder = ?, sparad = ? WHERE anteckning_id = ?').run(...rad);
  else db.query('INSERT INTO levnadsvanor (svar, risk, forslag, alder, sparad, anteckning_id) VALUES (?, ?, ?, ?, ?, ?)').run(...rad);
}

export function ut(db, anteckningId) {
  if (!harTabell(db)) return null;
  const r = db.query('SELECT * FROM levnadsvanor WHERE anteckning_id = ?').get(anteckningId);
  if (!r) return null;
  const svar = JSON.parse(r.svar);
  return { svar, risk: R.risk(svar, { alder: r.alder }), forslag: R.forslag(svar, { alder: r.alder }), kalla: R.KALLA };
}

// När anteckningen signeras: för varje område där samtalet hölls registreras åtgärden med KVÅ-koden.
export function vidSignering(atk, a, tid) {
  if (a.typ !== TYP || !harTabell(atk.db)) return [];
  const r = atk.db.query('SELECT * FROM levnadsvanor WHERE anteckning_id = ?').get(a.id);
  if (!r) return [];
  const svar = JSON.parse(r.svar);
  const koder = JSON.parse(r.forslag ?? '{}');
  return Object.entries(koder).filter(([omr]) => svar.givet?.[omr])
    .map(([, kod]) => registreraAtgard(atk, { kod, tid, vardkontaktId: a.vardkontakt_id, underlag: { anteckning: a.id } }));
}

// Översikten: den senaste signerade anteckningen om levnadsvanor bland dem som anroparen får se (listan är redan prövad).
export function oversiktDel(db, ant) {
  if (!ant) return null;
  const a = ant.find(x => x.typ === TYP && x.status === 'signerad');
  if (!a) return { senaste: null };
  const s = ut(db, a.id);
  return { senaste: { anteckningId: a.id, tid: a.signerad?.tid ?? a.skapad, enhet: a.enhet, text: s ? R.sammanfattning(s.svar) : a.sammanfattning, risk: s ? Object.fromEntries(Object.entries(s.risk).map(([o, x]) => [o, x.risk])) : null } };
}
