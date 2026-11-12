// Runda 14, r3: API för intyg genom intygsapplikationen och e-remiss till och från vårdgivare utanför Vårdkällan.
// Behörigheten prövas i modulerna och av behörighetsmotorn, och varje anrop som rör en patient loggas på patienten som
// de andra anropen (medPatient).
import { Fel } from './db.js';
import * as lakarintyg from './lakarintyg.js';
import * as intygsapp from './intygsapplikation-simulerad.js';
import * as eremiss from './eremiss.js';
import * as eremissSim from './eremiss-simulerad.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  // Sussa 2.2.1.9: patientens intyg, att skapa ett utkast och avstämningen med intygsapplikationen.
  rutt('GET', '/api/patient/:id/intyg', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_intyg', (atk, p) => lakarintyg.forPatient(atk, p)); });
  rutt('POST', '/api/patient/:id/intyg', async (c, id) => { kravInloggad(c); return [201, await medPatient(c, id, 'skriv_intyg', (atk, p) => lakarintyg.skapa(atk, p, c.body))]; });
  rutt('POST', '/api/patient/:id/intyg/avstam', async (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_intyg', (atk, p) => lakarintyg.avstam(atk, p)); });
  rutt('GET', '/api/patient/:id/intyg/:iid/oppna', (c, id, iid) => { kravInloggad(c); return medPatient(c, id, 'las_intyg', (atk) => lakarintyg.oppna(atk, iid)); });
  // Den simulerade intygsapplikationen, som läkaren öppnar från journalen. Inloggningen följer med som i integrerat läge.
  const val = (c, iid) => {
    const r = typeof iid === 'string' && /^[0-9a-f-]{36}$/.test(iid) ? c.db.query('SELECT patient_id FROM sim_intygsapplikation WHERE intygs_id = ?').get(iid) : null;
    return r ? valFor(c.s, r.patient_id) : {};
  };
  rutt('GET', '/api/intygsapplikation/:iid', (c, iid) => intygsapp.visa(c.db, kravInloggad(c), iid, val(c, iid)));
  rutt('POST', '/api/intygsapplikation/:iid', async (c, iid) => intygsapp.spara(c.db, kravInloggad(c), iid, c.body, val(c, iid)));
  rutt('POST', '/api/intygsapplikation/:iid/:atgard', async (c, iid, atgard) => intygsapp.atgard(c.db, kravInloggad(c), iid, atgard, val(c, iid)));

  // Sussa 2.2.1.12 och 3.3.1.2: e-remiss till en vårdgivare utanför Vårdkällan.
  rutt('GET', '/api/eremiss/mottagare', (c) => { kravInloggad(c); return { mottagare: eremiss.mottagare(), simulerat: 'Mottagarna är påhittade och simulerade i demon. Inget lämnar demon.' }; });
  rutt('POST', '/api/patient/:id/eremiss', async (c, id) => { kravInloggad(c); return [201, await medPatient(c, id, 'remittera', (atk, p) => eremiss.skicka(atk, p, c.body))]; });
  // Demo: den externa vårdgivaren svarar, och en extern vårdgivare skickar en e-remiss till den egna vårdenheten.
  rutt('POST', '/api/eremiss/:rid/svara-simulerat', async (c, rid) => eremissSim.svaraSimulerat(c.db, kravInloggad(c), rid));
  rutt('POST', '/api/patient/:id/eremiss/inkommande-simulerad', async (c, id) => {
    const pers = kravInloggad(c);
    if (typeof id !== 'string' || !id) throw new Fel(400, 'Välj en patient.', 'ogiltig');
    return [201, await eremissSim.skickaInkommande(c.db, pers, id)];
  });
}
