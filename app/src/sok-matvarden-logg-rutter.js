// API för runda 6, r1: sökning i journalen (journalsok.js), NEWS2 och basfakta (vitalparametrar.js), säkerhetsloggen
// (sakerhetslogg.js), export av loggen och stickprov (logguppfoljning.js). Servern lämnar sina hjälpare hit. All
// behörighet prövas i behörighetsmotorn och varje åtkomst loggas, som i resten av API:t.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as logg from './logg.js';
import * as journalsok from './journalsok.js';
import * as vitalparametrar from './vitalparametrar.js';
import * as sakerhet from './sakerhetslogg.js';
import * as uppfoljning from './logguppfoljning.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  const lasning = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
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

  // Sökning i journalen (Sussa 3.1.8.1 och 3.1.8.2).
  rutt('GET', '/api/patient/:id/sok', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk) => journalsok.sok(atk, c.url.searchParams.get('q') ?? '',
    // Runda 10, r2: filter på typ, tid och vårdenhet.
    Object.fromEntries(['typ', 'fran', 'till', 'vardenhet'].map(k => [k, c.url.searchParams.get(k)])))); });

  // NEWS2 (Sussa 3.1.3.5 och 3.1.3.9): en hel omgång registreras på en gång, och förhandsvisningen räknar utan att spara
  // och utan att läsa några patientuppgifter.
  rutt('POST', '/api/patient/:id/news2', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk, p) => vitalparametrar.registreraNews2(atk, p, c.body))]; });
  rutt('POST', '/api/news2/berakna', (c) => {
    const p = kravInloggad(c);
    if (!kanRoll(p, 'registrera_matvarde')) throw new Fel(403, 'Din yrkesroll registrerar inte mätvärden.', 'nekad');
    return vitalparametrar.berakna(c.body);
  });

  // Basfakta (Sussa 3.1.6.1 och 3.1.6.2), samma objekt som i patienthuvudet.
  rutt('GET', '/api/patient/:id/basfakta', (c, id) => { kravInloggad(c); return medPatient(c, id, lasning(c), (atk, p) => { atk.krav(lasning(c)); return vitalparametrar.basfakta(atk, p); }); });

  // Säkerhetsloggen (Sussa 5.3.1.12).
  rutt('GET', '/api/logg/sakerhet', (c) => {
    const p = kravLogg(c);
    const q = c.url.searchParams;
    const typ = Object.hasOwn(sakerhet.TYPER, q.get('typ') ?? '') ? q.get('typ') : null;
    const rader = sakerhet.lista(c.db, { typ, fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) });
    logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_logg', resurs: `sakerhetslogg:${typ ?? 'alla'}`, grund: 'logggranskning', resultat: 'tillaten' });
    return { typ, typer: sakerhet.TYPER, rader, verifiering: sakerhet.verifiera(c.db) };
  });

  // Export av loggposter till fil (Sussa 5.2.1.3): NDJSON eller CSV, och exporten loggas.
  rutt('GET', '/api/logg/export', (c) => {
    const p = kravLogg(c);
    const q = c.url.searchParams;
    const flagga = ['nodatkomst', 'nekad', 'samtycke', 'vard', 'arkiv', 'alla'].includes(q.get('flagga')) ? q.get('flagga') : 'alla';
    const ut = uppfoljning.exportera(c.db, p, { typ: q.get('typ') ?? 'atkomst', format: q.get('format') ?? 'ndjson', flagga, fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) });
    return new Response(ut.text, { status: 200, headers: {
      'Content-Type': ut.contentType, 'Content-Disposition': `attachment; filename="${ut.namn}"`, 'Cache-Control': 'no-store',
      'X-Antal-Rader': String(ut.antal), 'X-Kedjan-Hel': ut.kedjaHel ? 'ja' : 'nej', 'X-Content-Type-Options': 'nosniff',
    } });
  });

  // Stickprovskontroll (HSLF-FS 2016:40 4 kap. 9 b §, eget krav L4).
  rutt('GET', '/api/stickprov', (c) => {
    const p = kravLogg(c);
    logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_logg', resurs: 'stickprov', grund: 'logggranskning', resultat: 'tillaten' });
    return uppfoljning.oversikt(c.db);
  });
  rutt('POST', '/api/stickprov', (c) => [201, uppfoljning.dra(c.db, kravLogg(c))]);
  rutt('GET', '/api/stickprov/:id', (c, id) => {
    const p = kravLogg(c);
    const s = uppfoljning.stickprov(c.db, id);
    logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_logg', resurs: `stickprov:${s.id}`, grund: 'logggranskning', resultat: 'tillaten' });
    return s;
  });
  rutt('POST', '/api/stickprov/:id/rad/:logg', (c, id, loggId) => uppfoljning.granska(c.db, kravLogg(c), id, loggId, c.body));
}
