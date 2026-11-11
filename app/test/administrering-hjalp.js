// Runda 13, r3 (E2-5): en dos som ges utan skannat armband kräver en uppgift om hur identiteten kontrollerades. Testerna
// som inte prövar just det ger dosen med uppgiften här, på ett ställe, i stället för i varje test. Allt annat i
// administrering.js är detsamma.
import * as administrering from '../src/administrering.js';

export * from '../src/administrering.js';
export const TEST_IDENTITET = { satt: 'id_band_hand' };
export const medIdentitet = (inp = {}) => ((inp.atgard ?? 'ge') === 'ge' && !inp.armband && !inp.identitet ? { ...inp, identitet: TEST_IDENTITET } : inp);
export const spara = (atk, inp = {}) => administrering.spara(atk, medIdentitet(inp));
