// API för runda 10, r3: formulärmotorn (formularmotor.js) och rättstavningen (stavning.js). Systemförvaltningens anrop rör
// ingen patient och har inga patientuppgifter. Förifyllnaden prövas och loggas på patienten som andra uppslag i journalen.
// Rättstavningen tar emot text från ett fält som håller på att skrivas, sparar den aldrig och loggar den aldrig.
import * as formular from './formularmotor.js';
import * as stavning from './stavning.js';
import * as rost from './rostinmatning.js';
import { Fel } from './db.js';

// En förhandsvisning svarar alltid 200: ett fel i definitionen är en del av svaret, med förklaringen i varfor.
const forhand = (fn) => {
  try { return fn(); } catch (e) {
    if (e instanceof Fel && [400, 409].includes(e.status)) return { ok: false, varfor: e.message };
    throw e;
  }
};

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  rutt('GET', '/api/formular', (c) => formular.oversikt(c.db, kravInloggad(c)));
  rutt('GET', '/api/formular/byggstenar', (c) => formular.byggstenar(c.db, kravInloggad(c)));
  rutt('POST', '/api/formular/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => formular.forhandsvisa(c.db, p, c.body)); });
  rutt('POST', '/api/formular', (c) => [201, formular.foresla(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/formular/:id/godkann', (c, id) => formular.godkann(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/formular/:id/avsla', (c, id) => formular.avsla(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/formular/:id/avveckla', (c, id) => formular.avveckla(c.db, kravInloggad(c), id, c.body));
  rutt('GET', '/api/patient/:id/formular/:kod/forifyllnad', (c, id, kod) => {
    kravInloggad(c);
    return medPatient(c, id, 'skriv_omvardnad', (atk) => formular.forifyllnad(atk, kod));
  });

  rutt('POST', '/api/stavning', (c) => stavning.kontrollera(c.db, kravInloggad(c), c.body));
  rutt('GET', '/api/stavning/ordlista', (c) => stavning.ordlista(c.db, kravInloggad(c)));
  rutt('POST', '/api/stavning/ordlista', (c) => [201, stavning.laggTill(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/stavning/ordlista/ta-bort', (c) => stavning.taBort(c.db, kravInloggad(c), c.body));

  // Valet att låta webbläsarens leverantör känna igen talet, per användare.
  rutt('GET', '/api/rost/val', (c) => rost.val(c.db, kravInloggad(c)));
  rutt('POST', '/api/rost/val', (c) => rost.godkann(c.db, kravInloggad(c)));
}
