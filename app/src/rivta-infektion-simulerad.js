// Runda 14, r3: ett simulerat Infektionsverktyg. Det tar emot Vårdkällans meddelanden genom samma kuvert och validering
// som en riktig tjänst (src/rivta/) och kvitterar dem. Det är påhittat och märkt som simulerat.
import * as r3 from './rivta-r3.js';
import * as inf from './rivta-infektion.js';

export const tjanst = r3.simuleradTjanst('Infektionsverktyget (simulerat)', [inf.LOGISK_ADRESS]);
for (const d of Object.values(inf.DEF)) tjanst.registrera(d(), () => ({ ResultCode: 'OK', comment: 'Mottaget av det simulerade Infektionsverktyget.' }));
inf.sattTransport((db) => r3.tillMotpart(db, tjanst));
export const sakra = () => {};
