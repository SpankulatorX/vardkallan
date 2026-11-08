// API för barnhälsovården (runda 7, r6): tillväxt, programmet med bokning och vaccinationer, mätningar hemma,
// rapporteringen till Svenska barnhälsovårdsregistret och uppföljningen. Servern lämnar sina hjälpare hit. All
// behörighet prövas i behörighetsmotorn och varje åtkomst till patientuppgifter loggas.
import { Fel } from './db.js';
import { Atkomst } from './atkomst.js';
import * as bhv from './bhv.js';
import * as bhvq from './bhvq.js';
import * as vardkontakt from './vardkontakt.js';
import { PLAN } from './bhv-plan.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, medMinJournal, valFor }) {
  const q = (c, k) => c.url.searchParams.get(k);
  rutt('GET', '/api/patient/:id/tillvaxt', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk, p) => bhv.vy(atk, p, { fran: q(c, 'fran'), till: q(c, 'till') })); });
  rutt('POST', '/api/patient/:id/tillvaxt', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_matvarde', (atk, p) => bhv.registrera(atk, p, c.body, vardkontakt.knyt)); });
  rutt('POST', '/api/patient/:id/tillvaxt/uppgift', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_matvarde', (atk, p) => bhv.registreraUppgift(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/tillvaxt/handelse', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_matvarde', (atk, p) => bhv.registreraHandelse(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/vaccination', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vaccinera', (atk, p) => bhv.vaccinera(atk, p, c.body, vardkontakt.knyt)); });
  rutt('POST', '/api/patient/:id/bhv/boka', (c, id) => { kravInloggad(c); return medPatient(c, id, 'boka_bhv', (atk, p) => bhv.boka(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/bhv/lakarbesok', (c, id) => { kravInloggad(c); return medPatient(c, id, 'boka_bhv', (atk, p) => bhv.lakarbesok(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/bhv/bhvq', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_matvarde', (atk, p) => bhv.bhvqMotsatt(atk, p, c.body)); });
  const medHemmatning = (c, id, avvisa) => {
    kravInloggad(c);
    const h = bhv.hemmatningRad(c.db, id);
    return medPatient(c, h.patient_id, 'registrera_matvarde', (atk) => bhv.bekrafta(atk, h, { avvisa, orsak: c.body?.orsak }));
  };
  rutt('POST', '/api/hemmatning/:id/bekrafta', (c, id) => medHemmatning(c, id, false));
  rutt('POST', '/api/hemmatning/:id/avvisa', (c, id) => medHemmatning(c, id, true));

  // Barnavårdscentralens sida: rapporteringen och uppföljningen, för läkare och sjuksköterskor på vårdenheten.
  // Förhandsgranskningen lämnar bara ut namnet på de barn som har fel, och de loggas. Övriga barn räknas.
  rutt('GET', '/api/bhv/bhvq', (c) => {
    kravInloggad(c);
    const s = bhvq.sammanstall(c.db, c.personal, (pid) => valFor(c.s, pid));
    for (const b of s.barn) if (b.fel.length) new Atkomst(c.db, c.personal, b.patient.id, valFor(c.s, b.patient.id), 'rapportera_bhvq').logga('rapportera_bhvq', 'vardrelation', 'bhvq:kontroll');
    return { ...s, barn: s.barn.map(b => ({ patient: b.fel.length ? b.patient : null, antal: b.antal, fel: b.fel })), utskick: bhvq.utskick(c.db, c.personal) };
  });
  rutt('POST', '/api/bhv/bhvq/skicka', (c) => { kravInloggad(c); return bhvq.skicka(c.db, c.personal, (pid) => valFor(c.s, pid)); });
  rutt('GET', '/api/bhv/uppfoljning', (c) => { kravInloggad(c); return { ...bhv.uppfoljning(c.db, c.personal), plan: PLAN }; });

  // Min journal för vårdnadshavaren. Läsningen är en del i Min journal (MIN_DELAR.tillvaxt i server.js).
  rutt('POST', '/api/min/journal/:id/tillvaxt', (c, id) => medMinJournal(c, id, 'min:tillvaxt:registrera', (atk) => bhv.minRegistrera(atk, c.body)));
}

// Raderna i inkorgen. Varje rad loggas på barnet en gång per session och rad, som raderna om NEWS2.
export function inkorg(c, patientKort, patientRad, valFor) {
  const ut = bhv.inkorg(c.db, c.personal, (pid) => valFor(c.s, pid));
  const loggade = (c.s.bhvLoggad ??= new Set());
  for (const [lista, nyckel] of [['tillvaxtLarm', (r) => `${r.regel}:${r.matt}:${r.tid}`], ['hemmatningarAttBekrafta', (r) => `hemma:${r.id}`], ['bhvAttBoka', (r) => `boka:${r.besokId}`]]) {
    for (const r of ut[lista]) {
      const resurs = `inkorg:bhv:${r.patientId}:${nyckel(r)}`;
      if (!loggade.has(resurs)) {
        loggade.add(resurs);
        const a = new Atkomst(c.db, c.personal, r.patientId, valFor(c.s, r.patientId), 'las_matvarden');
        a.logga('las_matvarden', a.prova('las_matvarden').grund, resurs);
      }
      r.patient = patientKort(patientRad(c.db, r.patientId));
    }
  }
  return ut;
}

export const session = (db, personal) => bhv.session(db, personal);
export { Fel };
