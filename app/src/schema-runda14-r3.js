// Runda 14, r3: tabellerna för del r3:s tjänstekontrakt. Inget läggs in i efterhand: tabellerna fylls när intyg skapas
// och meddelanden skickas eller tas emot. De simulerade motparterna importeras här, så att de är anslutna i varje
// sandlåda.
import * as lakarintyg from './lakarintyg.js';
import * as intygsapplikation from './intygsapplikation-simulerad.js';
import * as eremiss from './eremiss.js';
import * as eremissSim from './eremiss-simulerad.js';

export function sakraR14r3(db) {
  for (const m of [lakarintyg, intygsapplikation, eremiss, eremissSim]) m.sakra(db);
}
