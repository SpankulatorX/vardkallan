// API för runda 8, r3: fri bokning, teambesök och gruppträffar (bokning-r8.js) och avdelningens planerade händelser och
// en resurs planering (avdelningsplan.js). Servern lämnar sina hjälpare hit. All behörighet prövas i behörighetsmotorn
// och varje åtkomst loggas, som i resten av API:t.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as tidbok from './tidbok.js';
import * as r8 from './bokning-r8.js';
import * as plan from './avdelningsplan.js';
import * as sussaDemo from './sussa-demo.js';

const kravRoll = (c, handling) => {
  if (!kanRoll(c.personal, handling)) throw new Fel(403, 'Din yrkesroll kan inte göra det.', 'nekad');
};
const lista = (v) => (v ? String(v).split(',').filter(Boolean).slice(0, 10) : []);

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  // Fri bokning (testfall 5.1): systemets förslag och bokningen.
  rutt('GET', '/api/patient/:id/boka-fri/forslag', (c, id) => {
    kravInloggad(c);
    const q = c.url.searchParams;
    return medPatient(c, id, 'boka', (atk) => r8.friForslag(atk, { tidstyp: q.get('tidstyp') || undefined, yrkesroll: q.get('yrkesroll') || undefined, personalId: q.get('personalId') || undefined }));
  });
  rutt('POST', '/api/patient/:id/boka-fri', (c, id) => { kravInloggad(c); return medPatient(c, id, 'boka', (atk) => r8.bokaFri(atk, c.body)); });
  // Teambesök (testfall 5.2).
  rutt('GET', '/api/patient/:id/teambesok/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'boka', (atk) => r8.teamForslag(atk, { personal: lista(c.url.searchParams.get('personal')) })); });
  rutt('POST', '/api/patient/:id/teambesok', (c, id) => { kravInloggad(c); return medPatient(c, id, 'boka', (atk) => r8.bokaTeam(atk, c.body)); });
  // Gruppträffar (testfall 5.3): platser kvar, deltagare och väntelista, lägga till och ge en ledig plats.
  rutt('GET', '/api/grupptraffar', (c) => { kravInloggad(c); kravRoll(c, 'boka'); return { grupper: r8.grupper(c.db, c.personal) }; });
  rutt('POST', '/api/tid/:id/grupp', (c, id) => {
    kravInloggad(c);
    const t = tidbok.tidRad(c.db, id);
    if (typeof c.body.patientId !== 'string') throw new Fel(400, 'Välj en patient.', 'ogiltig', { falt: ['patientId'] });
    return medPatient(c, c.body.patientId, 'boka', (atk) => r8.laggTillGrupp(atk, t));
  });
  rutt('POST', '/api/gruppvantelista/:id/plats', (c, id) => {
    kravInloggad(c);
    const rad = r8.gruppvantelistaRad(c.db, id);
    return medPatient(c, rad.patient_id, 'boka', (atk) => r8.gePlats(atk, rad));
  });

  // Avdelningens planerade händelser (testfall 7.1 och 7.2), en patients planering (7.3) och en resurs planering (7.4).
  rutt('GET', '/api/avdelning/planering', (c) => {
    kravInloggad(c);
    const q = c.url.searchParams;
    return plan.avdelningensDag(c.db, c.personal, (pid) => valFor(c.s, pid), { enhetId: q.get('enhet') || null, datum: q.get('datum') || undefined });
  });
  rutt('GET', '/api/patient/:id/planering', (c, id) => {
    kravInloggad(c);
    const q = c.url.searchParams;
    return medPatient(c, id, 'las_planering', (atk) => plan.patientensPlanering(atk, { fran: q.get('fran'), till: q.get('till') }));
  });
  rutt('GET', '/api/resurs/:id/planering', (c, id) => {
    kravInloggad(c);
    const q = c.url.searchParams;
    return plan.resursensPlanering(c.db, c.personal, (pid) => valFor(c.s, pid), { personalId: id, fran: q.get('fran'), till: q.get('till') });
  });
  rutt('GET', '/api/planering/forslag', (c) => { kravInloggad(c); kravRoll(c, 'planera'); return plan.forslag(c.url.searchParams.get('text') ?? ''); });
  rutt('POST', '/api/patient/:id/planering', (c, id) => { kravInloggad(c); return medPatient(c, id, 'planera', (atk) => plan.planera(atk, c.body)); });
  rutt('POST', '/api/planerad-uppgift/:id/:atgard', (c, id, atgard) => {
    kravInloggad(c);
    if (!['utford', 'stryk'].includes(atgard)) throw new Fel(404, 'Åtgärden finns inte.', 'saknas');
    const u = plan.uppgiftRad(c.db, id);
    return medPatient(c, u.patient_id, atgard === 'utford' ? 'utfora_uppgift' : 'planera', (atk) => (atgard === 'utford' ? plan.utfor(atk, u) : plan.stryk(atk, u, c.body)));
  });

  // Demoläget för Sussas testfall i tema 7: patienterna på avdelningen och deras planerade händelser.
  rutt('POST', '/api/demo/sussa-avdelning', (c) => sussaDemo.laddaAvdelning(c.db, kravInloggad(c)));
}
