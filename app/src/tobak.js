// Runda 8, r5: tobaks- och nikotinvanor som strukturerad information i en anteckning (Sussa testfall 4.1).
//
// Anteckningstypen Tobaksvanor har inga sökord med fritext. Den som dokumenterar svarar på de nationella frågorna med
// fasta svarsalternativ (public/js/tobak-regler.js), och systemet skriver själv anteckningens text ur svaren, så att den
// syns som vanlig text överallt där anteckningar visas. Svaren sparas strukturerat bredvid anteckningen, en rad per
// version, i tabellen tobaksvanor. Systemet räknar patientens ålder ur personnumret och föreslår åtgärd och KVÅ-kod
// enligt Socialstyrelsens riktlinjer. När samtalet hölls vid besöket registreras åtgärden med koden när anteckningen
// signeras, så att ingen behöver välja en kod.
//
// Behörigheten är anteckningens: Tobaksvanor har kategorin omvårdnad, så att alla yrkesgrupper som skriver och läser
// omvårdnadsanteckningar också kan dokumentera och läsa levnadsvanorna. Svaren lämnas bara ut tillsammans med en
// anteckning som anroparen får läsa.
import { Fel, idag } from './db.js';
import { alder as alderAv } from './atkomst.js';
import { registreraAtgard } from './atgarder.js';
import * as R from '../public/js/tobak-regler.js';
import { SCHEMA_TOBAK } from './schema-runda8-r5.js';

export const TYP = 'Tobaksvanor';
export const MALL = { typ: TYP, kategori: 'omvardnad', sokord: ['Tobak och nikotin', 'Stöd', 'Kommentar'], strukturerad: true };


const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tobaksvanor'").get());
export function sakra(db) { db.exec(SCHEMA_TOBAK); }

// Patientens ålder i dag, ur födelsedatumet som systemet har.
export function alderFor(db, patientId) {
  const p = db.query('SELECT fodd FROM patienter WHERE id = ?').get(patientId);
  return p?.fodd ? alderAv(p.fodd, idag()) : null;
}

// Kontrollerar svaren och ger det som sparas: svaren, sökorden som systemet skriver och förslaget.
export function forbered(atk, tobak) {
  const alder = alderFor(atk.db, atk.patientId);
  const p = R.prova(tobak, { idag: idag(), alder });
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: [p.falt] });
  const forslag = R.forslag(p.varde, { alder });
  return { varde: p.varde, alder, forslag, sokord: R.sokord(p.varde, { alder }) };
}

export function spara(db, anteckningId, f) {
  sakra(db);
  const finns = db.query('SELECT 1 FROM tobaksvanor WHERE anteckning_id = ?').get(anteckningId);
  const rad = [JSON.stringify(f.varde), f.forslag.kod ?? null, f.alder, new Date().toISOString(), anteckningId];
  if (finns) db.query('UPDATE tobaksvanor SET svar = ?, forslag = ?, alder = ?, sparad = ? WHERE anteckning_id = ?').run(...rad);
  else db.query('INSERT INTO tobaksvanor (svar, forslag, alder, sparad, anteckning_id) VALUES (?, ?, ?, ?, ?)').run(...rad);
}

// Svaren för en anteckning, med förslaget, som de lämnas ut tillsammans med anteckningen.
export function ut(db, anteckningId) {
  if (!harTabell(db)) return null;
  const r = db.query('SELECT * FROM tobaksvanor WHERE anteckning_id = ?').get(anteckningId);
  if (!r) return null;
  const svar = JSON.parse(r.svar);
  const f = R.forslag(svar, { alder: r.alder });
  return { svar, forslag: f.kod ? { kod: f.kod, text: f.atgard, motivering: f.motivering } : { kod: null, motivering: f.motivering }, kalla: R.KALLA };
}

// När en anteckning signeras: hölls samtalet vid besöket registreras åtgärden med KVÅ-koden på anteckningens
// vårdkontakt. Systemet sätter koden, och åtgärden visas och lämnas ut som de andra åtgärderna.
export function vidSignering(atk, a, tid) {
  if (a.typ !== TYP || !harTabell(atk.db)) return null;
  const r = atk.db.query('SELECT * FROM tobaksvanor WHERE anteckning_id = ?').get(a.id);
  if (!r?.forslag) return null;
  const svar = JSON.parse(r.svar);
  if (!svar.givet) return null;
  return registreraAtgard(atk, { kod: r.forslag, tid, vardkontaktId: a.vardkontakt_id, underlag: { anteckning: a.id } });
}

// Översikten: den senaste signerade anteckningen om tobaksvanor bland dem som anroparen får se. ant är listan från
// listaAnteckningar, som redan är prövad mot behörighet, spärr, inre sekretess och undantag.
export function oversiktDel(db, ant) {
  if (!ant) return null;
  const a = ant.find(x => x.typ === TYP && x.status === 'signerad');
  if (!a) return { senaste: null };
  const s = ut(db, a.id);
  return { senaste: { anteckningId: a.id, tid: a.signerad?.tid ?? a.skapad, enhet: a.enhet, text: s ? R.sammanfattning(s.svar) : a.sammanfattning } };
}
