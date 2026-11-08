// API för runda 10, r1: skrivkön för arbete utan uppkoppling (skrivko.js, Sussa 2.3.1.4). Servern lämnar sina hjälpare
// hit. All behörighet prövas i behörighetsmotorn, och varje åtkomst till patientuppgifter loggas. Registreringen av
// överkänslighet görs i runda 10, r2:s flöde (overkanslighet.js och runda10-r2-rutter.js).
import * as skrivko from './skrivko.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  // Skrivkön: doser och mätvärden som registrerades medan servern inte svarade (skrivko.js).
  rutt('POST', '/api/skrivko', (c) => { kravInloggad(c); return skrivko.taEmot(c, medPatient, c.body); });
}
