// Runda 14, r4 (Sussa 5.4.2.2): API för journalhandlingar i mellanarkivet (mellanarkiv.js). Behörigheten prövas av
// behörighetsmotorn i modulen, och varje anrop som rör en patient loggas på patienten som de andra anropen (medPatient).
// En handling som hämtas på id ger samma svar som en som inte finns när den som frågar saknar vårdrelation eller när den
// ligger på en spärrad vårdenhet (medRad).
import * as mellanarkiv from './mellanarkiv.js';
import { medRad } from './runda10-r4-rutter.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  rutt('GET', '/api/patient/:id/mellanarkiv', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, mellanarkiv.listHandling(c.personal), (atk) => mellanarkiv.lista(atk));
  });
  rutt('GET', '/api/mellanarkiv/:id', (c, id) => {
    kravInloggad(c);
    const r = mellanarkiv.handlingRad(c.db, id);
    return medRad(c, medPatient, r, mellanarkiv.listHandling(c.personal), 'Uppgiften finns inte.', (atk) => mellanarkiv.las(atk, r));
  });
}
