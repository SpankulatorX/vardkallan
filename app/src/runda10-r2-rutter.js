// Runda 10, r2: vyer, presentation, sökning, utskrifter och loggning (Sussa 3.1.2, 3.1.6.2, 3.1.8.2, 3.1.9.4 och
// 3.1.9.5). Servern lämnar sina hjälpare hit. All behörighet prövas i behörighetsmotorn och varje åtkomst loggas, som i
// resten av API:t.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as logg from './logg.js';
import * as utskrift from './utskrift.js';
import * as overkanslighet from './overkanslighet.js';
import * as journalsok from './journalsok.js';
import * as vyer from './presentationsvyer.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, patientKort }) {
  // Logggranskarens anrop. En annan roll nekas, och försöket loggas som nekat.
  const kravLogg = (c) => {
    const p = kravInloggad(c);
    if (!kanRoll(p, 'las_logg')) {
      logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_logg', resurs: c.url.pathname, grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Bara logggranskaren når loggarna.', 'nekad');
    }
    return p;
  };
  const datum = (v, slut) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}${slut ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : null);
  const kortFor = (c) => {
    const cache = new Map();
    return (id) => {
      if (!cache.has(id)) { const pat = c.db.query('SELECT * FROM patienter WHERE id = ?').get(id); cache.set(id, pat ? patientKort(pat) : null); }
      return cache.get(id);
    };
  };

  // Basfakta, överkänslighet (Sussa 3.1.6.2). Förslaget till formuläret läser inga patientuppgifter och loggas inte.
  rutt('GET', '/api/overkanslighet/amnen', (c) => { kravInloggad(c); return overkanslighet.amnen(c.db); });
  rutt('POST', '/api/overkanslighet/forslag', (c) => overkanslighet.forslag(c.db, kravInloggad(c), c.body));
  rutt('GET', '/api/patient/:id/overkanslighet', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk) => overkanslighet.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/overkanslighet', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, overkanslighet.HANDLING, (atk) => overkanslighet.registrera(atk, c.body))]; });
  // En rad som inte finns och en rad som den inloggade inte får se ger samma svar.
  const medOverkanslighet = (c, id, fn) => {
    kravInloggad(c);
    const pid = overkanslighet.patientFor(c.db, id);
    if (!pid) throw new Fel(404, 'Överkänsligheten finns inte bland det du kan se.', 'saknas');
    return medPatient(c, pid, overkanslighet.HANDLING, (atk) => fn(atk));
  };
  rutt('POST', '/api/overkanslighet/:id/andra', (c, id) => medOverkanslighet(c, id, (atk) => overkanslighet.andra(atk, id, c.body)));
  rutt('POST', '/api/overkanslighet/:id/avsluta', (c, id) => medOverkanslighet(c, id, (atk) => overkanslighet.avsluta(atk, id, c.body)));

  // Anpassningsbara och standardiserade vyer (Sussa 3.1.2.1 till 3.1.2.4).
  rutt('GET', '/api/oversiktsvy/:situation', (c, s) => vyer.oversiktsvy(c.db, kravInloggad(c), s));
  rutt('PUT', '/api/oversiktsvy/:situation', (c, s) => vyer.sparaOversiktsvy(c.db, kravInloggad(c), s, c.body));
  rutt('POST', '/api/oversiktsvy/:situation/aterstall', (c, s) => vyer.aterstallOversiktsvy(c.db, kravInloggad(c), s));
  rutt('GET', '/api/vyforval', (c) => vyer.forvalsLista(c.db, kravInloggad(c)));
  rutt('PUT', '/api/vyforval', (c) => vyer.sattForval(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/vyforval/ta-bort', (c) => vyer.taBortForval(c.db, kravInloggad(c), c.body));
  rutt('GET', '/api/patient/:id/uppfoljning', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk) => vyer.uppfoljningsvy(atk, { typ: c.url.searchParams.get('typ') || null })); });
  rutt('GET', '/api/belaggning', (c) => vyer.belaggning(c.db, kravInloggad(c)));
  rutt('GET', '/api/patient/:id/utbildningsvy', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk, p) => vyer.utbildningsvy(atk, p)); });

  // Sökning över flera patienter med samma sökfält som i journalen (Sussa 3.1.8.2).
  rutt('GET', '/api/sok/journaler', (c) => journalsok.sokJournaler(c.db, kravInloggad(c), c.url.searchParams.get('q') ?? ''));

  // Utlämnade journalhandlingar per mottagare över alla patienter (Sussa 3.1.9.5).
  rutt('GET', '/api/logg/utlamnanden', (c) => {
    const p = kravLogg(c);
    const q = c.url.searchParams;
    const ut = utskrift.sokUtlamnanden(c.db, { mottagare: q.get('mottagare'), fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) });
    logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_logg', resurs: 'utlamnanden:mottagare', grund: 'logggranskning', resultat: 'tillaten' });
    const kort = kortFor(c);
    return { ...ut, rader: ut.rader.map(r => ({ ...r, patient: kort(r.patientId) })) };
  });
}
