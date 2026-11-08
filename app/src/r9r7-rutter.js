// Runda 9, r7: API för skanning, analys och patientgruppering, folkhälsa, spårbarhet, forskningsuttag, in- och
// utfarter, restjournaler och signering. Behörigheten prövas i modulerna och av behörighetsmotorn, och varje anrop som
// rör en patient loggas på patienten som de andra anropen (medPatient).
import * as skanning from './skanning.js';
import * as analys from './analys.js';
import * as folkhalsa from './folkhalsa.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  // Sussa 3.1.3.6: streckkodsläsaren och patientens armband.
  rutt('POST', '/api/skanna', (c) => { kravInloggad(c); return skanning.skanna(c, c.body, { medPatient, valFor }); });
  rutt('POST', '/api/patient/:id/armband', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk, p) => skanning.armband(atk, p)); });

  // Sussa 6.2.1.1 och 6.2.1.2: statistik och patientgruppering.
  rutt('GET', '/api/analys', (c) => analys.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/analys/grupp', (c) => analys.grupp(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/statistik', (c) => analys.statistik(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/urval', (c) => analys.sparaUrval(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/urval/:id/ta-bort', (c, id) => analys.taBortUrval(c.db, kravInloggad(c), id));
  rutt('GET', '/api/analys/resultat/:id', (c, id) => analys.resultat(c.db, kravInloggad(c), id));

  // Sussa 6.2.2.1: folkhälsoinsatser för riskgrupper.
  rutt('GET', '/api/folkhalsa', (c) => folkhalsa.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/folkhalsa/insatser', (c) => [201, folkhalsa.starta(c.db, kravInloggad(c), c.body)]);
  rutt('GET', '/api/folkhalsa/insatser/:id', (c, id) => folkhalsa.insats(c.db, kravInloggad(c), id));
  rutt('POST', '/api/folkhalsa/insatser/:id/avsluta', (c, id) => folkhalsa.avsluta(c.db, kravInloggad(c), id));
}
