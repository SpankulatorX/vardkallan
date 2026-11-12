// Runda 14, r3: tabellerna för del r3:s tjänstekontrakt. Inget läggs in i efterhand: tabellerna fylls när intyg skapas
// och meddelanden skickas eller tas emot.
import * as lakarintyg from './lakarintyg.js';
import * as intygsapplikation from './intygsapplikation-simulerad.js';

export function sakraR14r3(db) {
  lakarintyg.sakra(db);
  intygsapplikation.sakra(db);
}
