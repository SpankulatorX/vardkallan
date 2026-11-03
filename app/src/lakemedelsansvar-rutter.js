// API för ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar (runda 6, r6). Inget här rör en enskild
// patient: uppdragen gäller vårdenheten och mallarna innehåller inga patientuppgifter. Behörigheten prövas i
// lakemedelsansvar.js och mallgodkannande.js, och varje anrop loggas, också de nekade.
import * as ansvar from './lakemedelsansvar.js';
import * as godkannande from './mallgodkannande.js';

export function registreraRutter({ rutt, kravInloggad }) {
  rutt('GET', '/api/lakemedelsansvar', (c) => ansvar.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/lakemedelsansvar/uppdrag', (c) => [201, ansvar.utse(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/lakemedelsansvar/uppdrag/:id/avsluta', (c, id) => ansvar.avsluta(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/lakemedelsansvar/oversyn', (c) => [201, ansvar.oversyn(c.db, kravInloggad(c), c.body)]);

  rutt('GET', '/api/lakemedelsmallar', (c) => godkannande.mallLista(c.db, kravInloggad(c)));
  rutt('POST', '/api/lakemedelsmallar/godkann', (c) => godkannande.godkann(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/substansmallar/:atc', (c, atc) => [201, godkannande.andraSubstansmall(c.db, kravInloggad(c), atc, c.body)]);
}

// Inkorgens rad för den mallansvariga läkaren: mallar som väntar på godkännande. Inga patientuppgifter.
export function inkorg(c) {
  return { mallarAttGodkanna: godkannande.attGodkanna(c.db, c.personal) };
}
