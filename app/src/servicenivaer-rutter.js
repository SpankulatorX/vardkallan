// Runda 14, r5: API för incidentregistret, servicenivårapporten och incidentrapporten till beställaren
// (servicenivaer.js, Sussa KD1.2.1.1 till KD1.2.1.4, KD1.3.2.2, KD1.3.2.3 och 5.3.1.14). Behörigheten prövas i
// modulen, och inget här rör en enskild patient. Servern lämnar svarstiderna och säkerhetskopiornas lager hit.
import * as servicenivaer from './servicenivaer.js';
import * as sakerhetskopior from './sakerhetskopior.js';
import { kanRoll } from './atkomst.js';

export function registreraRutter({ rutt, kravInloggad, kopior = null, matning = () => [], malP95 = 200 }) {
  rutt('GET', '/api/servicenivaer/incidenter', (c) => servicenivaer.lista(c.db, kravInloggad(c)));
  rutt('POST', '/api/servicenivaer/incidenter', (c) => [201, servicenivaer.registrera(c.db, kravInloggad(c), c.body ?? {})]);
  rutt('POST', '/api/servicenivaer/incidenter/:id/avsluta', (c, id) => servicenivaer.avsluta(c.db, kravInloggad(c), id, c.body ?? {}));
  rutt('POST', '/api/servicenivaer/incidenter/:id/uppfoljning', (c, id) => servicenivaer.uppfoljning(c.db, kravInloggad(c), id, c.body ?? {}));
  rutt('GET', '/api/servicenivaer/rapport', (c) => {
    const p = kravInloggad(c);
    // Säkerhetskopiornas översikt kräver behörigheten för lagring. Utan den visas rapporten utan kopiorna.
    let k = null;
    if (kopior && kanRoll(p, 'lagring')) { try { k = sakerhetskopior.oversikt(kopior, c.s.kopieId, c.db, p); } catch { k = null; } }
    return servicenivaer.rapport(c.db, p, { manad: c.url.searchParams.get('manad') || null, matning: matning(), malP95, kopior: k });
  });
  rutt('POST', '/api/servicenivaer/export', (c) => servicenivaer.exportera(c.db, kravInloggad(c), c.body ?? {}));
}
