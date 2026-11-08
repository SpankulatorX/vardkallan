// Runda 9, r7: tabellerna och seeden för skanningen, analysen, folkhälsan, spårbarheten, forskningsuttagen, in- och
// utfarterna, restjournalerna och signeringen. Varje modul har sitt eget schema med IF NOT EXISTS, så att en äldre
// sandlåda får tabellerna när den läses in. Seeden läggs bara in när tabellen är ny.
import * as skanning from './skanning.js';
import * as levnadsvanor from './levnadsvanor.js';
import * as analys from './analys.js';
import * as folkhalsa from './folkhalsa.js';

export function sakraR9r7(db, bas = new Date()) {
  skanning.sakra(db);
  levnadsvanor.sakra(db);
  analys.sakra(db);
  folkhalsa.sakra(db);
  folkhalsa.seeda(db, bas);
  return db;
}
