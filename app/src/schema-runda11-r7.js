// Runda 11, r7: tabellerna för intensivvården (patientens egna regler, andningsstöd, behandlingsmål och NEMS) och
// tillväxten (sitthöjd och pubertet, import och indikatorer). Varje modul har sitt schema med IF NOT EXISTS, så att en
// äldre sandlåda får tabellerna när den läses in.
import * as regler from './iva-patientregler.js';
import * as vatska from './iva-vatskemal.js';
import * as nems from './iva-nems.js';

export function sakraR11r7(db) {
  regler.sakra(db);
  vatska.sakra(db);
  nems.sakra(db);
  // Tillväxtens tabeller läggs till av tillvaxt-r11.js när den finns.
  for (const f of TILLAGG) f(db);
  return db;
}
// Andra delar av rundans schema som registrerar sig här (tillväxten).
export const TILLAGG = [];
