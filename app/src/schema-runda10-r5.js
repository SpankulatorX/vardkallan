// Runda 10, r5: tabellerna och seeden för kollegakontrollen av högriskläkemedel, överföringen av läkemedelsberättelsen,
// vaccinationsprogrammen och rapporteringen till vaccinationsregistret, den sammanhållna journalföringen och flödet på
// akutmottagningen. Varje modul har sitt eget schema med IF NOT EXISTS, så att en äldre sandlåda får tabellerna när den
// läses in.
import * as hogrisk from './hogriskkontroll.js';
import * as overforing from './lakemedelsoverforing.js';
import * as vaccinationsprogram from './vaccinationsprogram.js';
import * as sammanhallen from './sammanhallen.js';
import * as akut from './akutflode.js';

export function sakraR10r5(db) {
  hogrisk.sakra(db);
  overforing.sakra(db);
  vaccinationsprogram.sakra(db);
  sammanhallen.sakra(db);
  akut.sakra(db);
  return db;
}
