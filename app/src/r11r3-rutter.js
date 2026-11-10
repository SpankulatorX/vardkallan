// API för runda 11, r3: graviditet, förlossning och BB (obstetrik.js, forlossning.js och graviditetsregistret.js).
// Åtgärderna på en graviditet eller förlossning med id finns i r9r3-rutter.js. Här finns det som gränssnittet behöver
// för patientens förlossning och BB, svaren på frågorna om våld, mödrahälsovårdens och förlossningens sidor och
// rapporteringen till Graviditetsregistret.
import { Atkomst } from './atkomst.js';
import * as obs from './obstetrik.js';
import * as forl from './forlossning.js';
import * as gr from './graviditetsregistret.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  const val = (c) => (pid) => valFor(c.s, pid);
  rutt('GET', '/api/patient/:id/forlossning', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_graviditet', (atk) => forl.forlossningFor(atk)); });
  rutt('GET', '/api/patient/:id/bb', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_graviditet', (atk) => forl.bbFor(atk)); });
  rutt('POST', '/api/patient/:id/bb', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'graviditet', (atk) => forl.bbKontroll(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/bb/screening', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'graviditet', (atk) => forl.bbScreening(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/bb/utskrivning', (c, id) => { kravInloggad(c); return medPatient(c, id, 'graviditet', (atk) => forl.utskrivning(atk, c.body)); });
  // Svaren på frågorna om våld hämtas för sig, och läsningen loggas med en egen resurs.
  rutt('GET', '/api/graviditet/:gid/valdsvar', (c, gid) => {
    kravInloggad(c);
    const g = obs.graviditetRad(c.db, gid);
    return medPatient(c, g.patient_id, 'graviditet', (atk) => obs.valdsvar(atk, g));
  });
  rutt('GET', '/api/modrahalsovard', (c) => { kravInloggad(c); return obs.mhvOversikt(c.db, c.personal, val(c)); });
  rutt('GET', '/api/forlossning', (c) => { kravInloggad(c); return forl.oversikt(c.db, c.personal, val(c)); });
  // Graviditetsregistret: förhandsgranskningen visar namnet bara på poster med fel, och de loggas.
  rutt('GET', '/api/graviditetsregistret', (c) => {
    kravInloggad(c);
    const s = gr.sammanstall(c.db, c.personal, val(c));
    for (const p of s.poster) if (p.fel.length) new Atkomst(c.db, c.personal, p.patient.id, valFor(c.s, p.patient.id), 'rapportera_graviditetsregistret').logga('rapportera_graviditetsregistret', 'vardrelation', 'graviditetsregistret:kontroll');
    return { ...s, poster: s.poster.map(p => ({ typ: p.typ, patient: p.fel.length ? p.patient : null, fel: p.fel })), utskick: gr.utskick(c.db, c.personal) };
  });
  rutt('POST', '/api/graviditetsregistret/skicka', (c) => { kravInloggad(c); return gr.skicka(c.db, c.personal, val(c)); });
}

export const session = (db, personal) => obs.session(db, personal);
