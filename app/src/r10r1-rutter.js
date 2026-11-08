// API för runda 10, r1: registrering av överkänslighet (uppmarksamhet.js, Sussa 2.5.1.1 och 3.1.5) och skrivkön för
// arbete utan uppkoppling (skrivko.js, Sussa 2.3.1.4). Servern lämnar sina hjälpare hit. All behörighet prövas i
// behörighetsmotorn, och varje åtkomst till patientuppgifter loggas.
import * as uppmarksamhet from './uppmarksamhet.js';
import * as skrivko from './skrivko.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  // Listorna med ämnen och reaktioner och graden som systemet föreslår för varje reaktion. Inga patientuppgifter.
  rutt('GET', '/api/overkanslighet/val', (c) => { kravInloggad(c); return uppmarksamhet.valOverkanslighet(); });
  rutt('POST', '/api/patient/:id/overkanslighet', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'skriv_journal', (atk) => uppmarksamhet.registreraOverkanslighet(atk, c.body))];
  });
  // Skrivkön: doser och mätvärden som registrerades medan servern inte svarade (skrivko.js).
  rutt('POST', '/api/skrivko', (c) => { kravInloggad(c); return skrivko.taEmot(c, medPatient, c.body); });
}
