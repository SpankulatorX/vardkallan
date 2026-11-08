// Nyheter vid en ny version (Sussa 10.1.1.4). Nyheterna står i nyheter.json med version, datum och roller. Efter en ny
// version ser varje användare en kort ruta med det som är nytt för just den rollen, stänger den med ett klick och kan
// läsa nyheterna igen. Systemet vet själv vilken roll användaren har, vilken version som körs och vad användaren redan
// har stängt, så ingen behöver leta i versionsanteckningar eller veta vad som gäller för andra roller.
//
// Inga patientuppgifter finns här. Vad användaren har stängt sparas i sandlådan (nyheter_stangda).
import FIL from './nyheter.json' with { type: 'json' };
import { YRKEN } from './seed/personal.js';
import { Fel, iso } from './db.js';

export const NYHETER = FIL.versioner;
export const AKTUELL = NYHETER[0]?.version ?? null;
// Rollerna en nyhet kan gälla: varje yrke, invånaren i Min journal, all personal och alla.
export const ROLLER = [...Object.keys(YRKEN), 'invanare'];
export const GRUPPER = ['personal', 'alla'];
export const OMFATTNING = ['stor', 'liten'];

// Rollen för den inloggade: personalens yrke, eller invånaren.
export const rollFor = ({ personal, invanare }) => (personal ? personal.yrke : invanare ? 'invanare' : null);
const anvandareFor = ({ personal, invanare }) => (personal ? `personal:${personal.id}` : invanare ? `invanare:${invanare.id}` : null);

export function galler(roller, roll) {
  if (!roll) return false;
  return roller.includes('alla') || roller.includes(roll) || (roll !== 'invanare' && roller.includes('personal'));
}

// Nyheterna för en roll, per version med den senaste först. Stora förändringar står före små.
export function forRoll(roll, versioner = NYHETER) {
  return versioner.map(v => ({
    version: v.version, datum: v.datum,
    nyheter: v.nyheter.filter(n => galler(n.roller, roll))
      .sort((a, b) => OMFATTNING.indexOf(a.omfattning) - OMFATTNING.indexOf(b.omfattning))
      .map(({ id, rubrik, text, omfattning, var: v_ }) => ({ id, rubrik, text, omfattning, var: v_ ?? null })),
  })).filter(v => v.nyheter.length);
}

const stangd = (db, anvandare, version) => Boolean(db.query('SELECT 1 FROM nyheter_stangda WHERE anvandare = ? AND version = ?').get(anvandare, version));

// Rutan visar bara den aktuella versionens nyheter, och bara tills användaren har stängt dem. Den som aldrig har
// loggat in förut får inte hela historiken i rutan, bara det som är nytt nu. alla är historiken att läsa igen.
export function nyheter(db, inloggad, { versioner = NYHETER } = {}) {
  const roll = rollFor(inloggad);
  const anvandare = anvandareFor(inloggad);
  const alla = forRoll(roll, versioner);
  const version = versioner[0]?.version ?? null;
  const aktuell = alla.find(v => v.version === version) ?? null;
  const visa = Boolean(aktuell && anvandare && !stangd(db, anvandare, version));
  return { version, roll, ruta: visa ? aktuell : null, alla };
}

// Stänger rutan för versionen. Att stänga igen ändrar inget.
export function stang(db, inloggad, version, { versioner = NYHETER, nu = new Date() } = {}) {
  const anvandare = anvandareFor(inloggad);
  if (!anvandare) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  if (typeof version !== 'string' || !versioner.some(v => v.version === version)) throw new Fel(400, 'Det finns ingen sådan version.', 'ogiltig', { falt: ['version'] });
  db.query('INSERT OR IGNORE INTO nyheter_stangda (anvandare, version, tid) VALUES (?, ?, ?)').run(anvandare, version, iso(nu));
  return nyheter(db, inloggad, { versioner });
}
