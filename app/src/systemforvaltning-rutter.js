// API för systemförvaltningen (runda 7, r4, Sussa 12.1 och KD1.1.3). Inget här rör en enskild patient, och inga svar
// innehåller patientuppgifter: förhandsvisningarna och rapporterna har bara antal. Behörigheten prövas i modulerna, och
// varje ändring loggas med vem som gjorde den.
import * as konfiguration from './konfiguration.js';
import * as undantag from './undantag.js';
import * as omorganisation from './omorganisation.js';
import * as lagring from './lagring.js';
import { Fel } from './db.js';

// En förhandsvisning svarar alltid 200: ett fel i det som skrivits är en del av svaret, med förklaringen i varfor, så att
// förhandsvisningen kan visas medan man skriver.
const forhand = (fn) => {
  try { return fn(); } catch (e) {
    if (e instanceof Fel && [400, 409].includes(e.status)) return { ok: false, varfor: e.message };
    throw e;
  }
};

export function registreraRutter({ rutt, kravInloggad }) {
  rutt('GET', '/api/konfiguration', (c) => konfiguration.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/konfiguration/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => konfiguration.forhandsvisa(c.db, p, c.body)); });
  rutt('POST', '/api/konfiguration', (c) => [201, konfiguration.foresla(c.db, kravInloggad(c), c.body)]);
  // Konfigurationens rutter når bara parametrar. Ett undantag godkänns och avslutas genom undantagens rutter.
  rutt('POST', '/api/konfiguration/:id/godkann', (c, id) => konfiguration.godkann(c.db, kravInloggad(c), id, c.body, new Date(), { slag: 'parameter' }));
  rutt('POST', '/api/konfiguration/:id/avsluta', (c, id) => konfiguration.avsluta(c.db, kravInloggad(c), id, c.body, new Date(), { slag: 'parameter' }));

  rutt('GET', '/api/undantag', (c) => undantag.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/undantag/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => undantag.forhandsvisa(c.db, p, c.body)); });
  rutt('POST', '/api/undantag', (c) => [201, undantag.foresla(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/undantag/:id/godkann', (c, id) => undantag.godkann(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/undantag/:id/avsluta', (c, id) => undantag.avsluta(c.db, kravInloggad(c), id, c.body));
  // Runda 13, r3: systemförvaltaren avslår en begäran från vården om att undanta en anteckning.
  rutt('POST', '/api/undantag/begaran/:id/avsla', (c, id) => undantag.avslaBegaran(c.db, kravInloggad(c), id, c.body));

  rutt('GET', '/api/omorganisation', (c) => omorganisation.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/omorganisation/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => ({ ok: true, ...omorganisation.forhandsvisa(c.db, p, c.body) })); });
  rutt('POST', '/api/omorganisation', (c) => [201, omorganisation.forbered(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/omorganisation/:id/avbryt', (c, id) => omorganisation.avbryt(c.db, kravInloggad(c), id));
  rutt('POST', '/api/omorganisation/:id/godkann', (c, id) => omorganisation.godkann(c.db, kravInloggad(c), id));

  rutt('GET', '/api/lagring', (c) => lagring.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/lagring/prov', (c) => lagring.provaAterlasning(c.db, kravInloggad(c)));
  rutt('POST', '/api/lagring/uttag', (c) => [201, lagring.beslutaUttag(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/lagring/uttag/:id/godkann', (c, id) => lagring.godkannUttag(c.db, kravInloggad(c), id));
  rutt('GET', '/api/lagring/uttag/:id/fil', (c, id) => {
    const f = lagring.uttagsfil(c.db, kravInloggad(c), id);
    return new Response(f.data, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${f.filnamn}"`, 'X-Kontrollsumma': f.sha256, 'Cache-Control': 'no-store' } });
  });
  // Patientens eget beslut att en spärr också ska gälla den nya vårdenheten efter en omorganisation.
  rutt('POST', '/api/patient/:id/sparr', (c, id) => omorganisation.registreraSparr(c.db, kravInloggad(c), id, c.body));
}

// Inkorgen för den som registrerar spärrar: patienter som kan tillfrågas efter en omorganisation.
export function inkorg(c) {
  return { sparrFragor: omorganisation.sparrFragor(c.db, c.personal) };
}

// Körs vid varje anrop med en sandlåda: genomför förberedda omorganisationer som gäller i dag. Ett fel stoppar aldrig
// anropet. Förändringen görs i en transaktion, så inget blir halvgjort, och den står kvar som förberedd.
const misslyckade = new WeakMap();
export function efterDatum(db) {
  if (misslyckade.get(db) === new Date().toDateString()) return;
  try { omorganisation.genomforForfallna(db); } catch (e) {
    misslyckade.set(db, new Date().toDateString());
    console.error('Omorganisationen kunde inte genomföras:', e.message);
  }
}
