// Runda 11, r7: tabellerna för intensivvården (patientens egna regler, andningsstöd, behandlingsmål och NEMS) och
// tillväxten (sitthöjd och pubertet, import och indikatorer). Varje modul har sitt schema med IF NOT EXISTS, så att en
// äldre sandlåda får tabellerna när den läses in.
import * as regler from './iva-patientregler.js';
import * as vatska from './iva-vatskemal.js';
import * as nems from './iva-nems.js';
import * as tillvaxt from './tillvaxt-r11.js';

export function sakraR11r7(db) {
  regler.sakra(db);
  vatska.sakra(db);
  nems.sakra(db);
  tillvaxt.sakra(db);
  return db;
}
