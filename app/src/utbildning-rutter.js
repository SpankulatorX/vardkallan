// API för nyhetsrutan (Sussa 10.1.1.4) och övningarna med intyg (Sussa 10.1.1.5), runda 7, r2. Inget här rör en
// patient: nyheterna och övningarna innehåller inga patientuppgifter utom demopatienternas namn, och intygen gäller
// personalen. Behörigheten prövas i utbildning.js.
import { Fel } from './db.js';
import * as nyheter from './nyheter.js';
import * as utbildning from './utbildning.js';
import * as prov from './praktiska-prov.js';

export function registreraRutter({ rutt, kravInloggad }) {
  const inloggad = (c) => {
    if (!c.personal && !c.invanare) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    return { personal: c.personal ?? null, invanare: c.personal ? null : c.invanare ?? null };
  };
  rutt('GET', '/api/nyheter', (c) => nyheter.nyheter(c.db, inloggad(c)));
  rutt('POST', '/api/nyheter/stang', (c) => nyheter.stang(c.db, inloggad(c), c.body.version));

  rutt('GET', '/api/utbildning', (c) => utbildning.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/utbildning/ratta', (c) => utbildning.ratta(c.db, kravInloggad(c), c.body.svar));
  rutt('GET', '/api/utbildning/enhet', (c) => utbildning.enhet(c.db, kravInloggad(c)));
  // Övningarna som data med versioner, och utbildarintygen.
  // Runda 8, r5: ?omfang=enhet ger vårdenhetens egna övningar, och omfang i kroppen sparar dem.
  rutt('GET', '/api/utbildning/ovningar', (c) => utbildning.redigera(c.db, kravInloggad(c), { omfang: c.url.searchParams.get('omfang') ?? 'vardgivare' }));
  rutt('POST', '/api/utbildning/ovningar', (c) => [201, utbildning.sparaVersion(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/utbildning/utbildare', (c) => [201, utbildning.utfardaUtbildare(c.db, kravInloggad(c), c.body.personalId)]);
  // Runda 12, r3: praktiska prov i journalen (praktiska-prov.js). Utbildaren skapar och följer upp, och personalen gör
  // proven i en övningsjournal som systemet kontrollerar.
  rutt('GET', '/api/utbildning/prov', (c) => prov.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/utbildning/prov', (c) => [201, prov.skapa(c.db, kravInloggad(c), c.body.typ)]);
  rutt('POST', '/api/utbildning/prov/:id/starta', (c, id) => prov.starta(c.db, kravInloggad(c), id));
  rutt('POST', '/api/utbildning/prov/:id/kontrollera', (c, id) => prov.kontrollera(c.db, kravInloggad(c), id));
  rutt('POST', '/api/utbildning/prov/:id/avsluta', (c, id) => prov.avsluta(c.db, kravInloggad(c), id));
}
