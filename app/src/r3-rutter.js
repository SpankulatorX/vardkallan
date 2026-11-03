// API för runda 6, r3: vårdplaner (vardplan.js), psykiatrisk tvångsvård (tvangsvard.js), samordnad planering
// (samordnad.js) och ändringar i hälsoärenden (halsoarende.js). Servern lämnar sina hjälpare hit, så att routningen för
// de här delarna ligger samlad. All behörighet prövas i behörighetsmotorn och varje åtkomst loggas, som i resten av API:t.
import { Fel } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, harVardrelation } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as vardplan from './vardplan.js';
import * as tvangsvard from './tvangsvard.js';
import * as samordnad from './samordnad.js';
import * as halsoarende from './halsoarende.js';

// Hjälp mellan modulerna: finns en vårdplan för tvångsvården (16 § LPT) och en samordnad vårdplan (7 a § LPT)?
const hjalpFor = (db, patientId) => ({
  harVardplan: (period) => vardplan.pagarPa(db, patientId, period.enhet_id),
  harSamordnadVardplan: () => Boolean(db.query("SELECT 1 FROM samordningar s WHERE s.patient_id = ? AND s.typ IN ('lpt7a', 'sip') AND EXISTS (SELECT 1 FROM samordning_handelser h WHERE h.samordning_id = s.id AND h.typ = 'plan')").get(patientId)),
});
const tvangsvardPagar = (atk) => tvangsvard.synligaPerioder(atk).some(p => vardenhetFor(atk.db, p.enhet_id) === vardenhetFor(atk.db, atk.personal.enhet_id) && tvangsvard.periodLage(atk.db, p).l.status !== 'upphord');

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  // Vårdplaner (Sussa 3.2.2.1 och 3.2.2.2).
  rutt('GET', '/api/patient/:id/vardplaner', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_vardplan', (atk) => vardplan.forPatient(atk, { tvangsvard: tvangsvardPagar(atk) })); });
  rutt('POST', '/api/patient/:id/vardplaner', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vardplan', (atk) => vardplan.skapa(atk, c.body, { tvangsvard: tvangsvardPagar(atk) })); });
  rutt('POST', '/api/vardplan/:id/:atgard', (c, id, atgard) => {
    kravInloggad(c);
    const p = vardplan.hamtaPlan(c.db, id);
    return medPatient(c, p.patient_id, atgard === 'utfort' ? 'vardplan_atgard' : 'vardplan', (atk) => vardplan.andra(atk, p, atgard, c.body));
  });

  // Psykiatrisk tvångsvård (Sussa 3.2.3.1 till 3.2.3.4).
  rutt('GET', '/api/patient/:id/tvangsvard', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_tvangsvard', (atk, p) => tvangsvard.forPatient(atk, hjalpFor(c.db, p.id))); });
  rutt('POST', '/api/patient/:id/tvangsvard', (c, id) => { kravInloggad(c); return medPatient(c, id, 'tvangsvard', (atk, p) => tvangsvard.registrera(atk, c.body, hjalpFor(c.db, p.id))); });
  // Bevakningen på den psykiatriska vårdenheten. Listan loggas en gång per session och patient, som raderna i inkorgen.
  rutt('GET', '/api/tvangsvard/bevakning', (c) => {
    const p = kravInloggad(c);
    try {
      const ut = tvangsvard.bevakning(c.db, p, { valFor: (pid) => valFor(c.s, pid), harVardplan: (period) => vardplan.pagarPa(c.db, period.patient_id, period.enhet_id) });
      const loggade = (c.s.tvangsvardLoggad ??= new Set());
      for (const r of ut.rader) {
        if (loggade.has(r.patientId)) continue;
        loggade.add(r.patientId);
        new Atkomst(c.db, p, r.patientId, valFor(c.s, r.patientId), 'las_tvangsvard').logga('las_tvangsvard', 'vardrelation', 'tvangsvard:bevakning');
      }
      return ut;
    } catch (e) {
      if (e instanceof Fel && e.status === 403) loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'las_tvangsvard', resurs: 'tvangsvard:bevakning', grund: 'nekad', resultat: 'nekad' });
      throw e;
    }
  });
  // Uppföljningen utan personuppgifter: uppföljningsrollen ser alla vårdenheter, personalen på en psykiatrisk vårdenhet sin.
  rutt('GET', '/api/uppfoljning/planer', (c) => {
    const p = kravInloggad(c);
    const ve = vardenhetFor(c.db, p.enhet_id);
    const alla = kanRoll(p, 'datauttag');
    if (!alla && !kanRoll(p, 'las_tvangsvard') && !kanRoll(p, 'samordna')) {
      loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'datauttag', resurs: 'uppfoljning:planer', grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Din yrkesroll har inte behörighet till uppföljningen.', 'nekad');
    }
    const vardenheter = c.db.query("SELECT id FROM enheter WHERE typ = 'vardenhet' ORDER BY id").all().map(r => r.id);
    loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: alla ? 'datauttag' : 'las_admin', resurs: 'uppfoljning:planer', grund: alla ? 'uppfoljning' : 'administrativ', resultat: 'tillaten' });
    return {
      tvangsvard: tvangsvard.statistik(c.db, alla ? tvangsvard.PSYKIATRI : tvangsvard.PSYKIATRI.filter(e => e === ve)),
      samordning: samordnad.statistik(c.db, alla ? vardenheter : [ve]),
      anmarkning: 'Uppföljningen innehåller inga namn, personnummer eller id. Grupper med färre än tre visas inte som tal.',
    };
  });

  // Samordnad individuell plan och samordnad planering vid utskrivning (Sussa 4.3.1.1 till 4.3.1.3).
  rutt('GET', '/api/patient/:id/samordning', (c, id) => { kravInloggad(c); return medPatient(c, id, kanRoll(c.personal, 'samordna') ? 'samordna' : 'las_vardplan', (atk) => samordnad.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/samordning', (c, id) => { kravInloggad(c); return medPatient(c, id, 'samordna', (atk) => samordnad.skapa(atk, c.body)); });
  rutt('POST', '/api/samordning/:id/:atgard', (c, id, atgard) => {
    kravInloggad(c);
    const s = samordnad.hamta(c.db, id);
    return medPatient(c, s.patient_id, 'samordna', (atk) => samordnad.andra(atk, s, atgard, c.body));
  });
  // Kommunens part (simulerad).
  rutt('GET', '/api/samverkan', (c) => {
    const p = kravInloggad(c);
    const ut = samordnad.kommunLista(c.db, p);
    const loggade = (c.s.samverkanLoggad ??= new Set());
    for (const r of ut) {
      if (!loggade.has(r.id)) { loggade.add(r.id); loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, patient_id: r.patientId, handling: 'samverkan', resurs: `samverkan:lista:${r.id}`, grund: 'samverkan', resultat: 'tillaten' }); }
    }
    return ut.map(({ patientId: _p, ...r }) => r);
  });
  rutt('GET', '/api/samverkan/:id', (c, id) => samordnad.kommunDetalj(c.db, kravInloggad(c), id));
  rutt('POST', '/api/samverkan/:id/:atgard', (c, id, atgard) => samordnad.kommunAndra(c.db, kravInloggad(c), id, atgard, c.body));

  // Hälsoärenden som ändras (Sussa 6.1.1.2).
  rutt('GET', '/api/halsoarende/:id', (c, id) => {
    kravInloggad(c);
    const h = c.db.query('SELECT patient_id FROM halsoarenden WHERE id = ?').get(Number(id));
    if (!h) throw new Fel(404, 'Hälsoärendet finns inte.', 'saknas');
    return medPatient(c, h.patient_id, 'las_admin', (atk) => halsoarende.detalj(atk, id));
  });
  rutt('POST', '/api/halsoarende/:id/:atgard', (c, id, atgard) => {
    kravInloggad(c);
    const h = c.db.query('SELECT patient_id FROM halsoarenden WHERE id = ?').get(Number(id));
    if (!h) throw new Fel(404, 'Hälsoärendet finns inte.', 'saknas');
    return medPatient(c, h.patient_id, 'halsoarende', (atk) => halsoarende.andra(atk, id, atgard, c.body));
  });
}

// Tillägg i delade svar. oversikt läggs i översiktens svar, inkorg i inkorgens och session i sessionen.
export const tillagg = {
  sakra(db) { vardplan.sakra(db); tvangsvard.sakra(db); samordnad.sakra(db); halsoarende.sakraSchema(db); },
  seeda(db, bas) { vardplan.seeda(db, bas); tvangsvard.seeda(db, bas); halsoarende.sakraSchema(db); samordnad.seeda(db); },
  anpassaTillNu(db) { tvangsvard.anpassaTillNu(db); },
  session(db, personal) { return { tvangsvardsenhet: tvangsvard.arPsykiatri(db, personal) && kanRoll(personal, 'las_tvangsvard') }; },
  oversikt(atk) {
    const hjalp = hjalpFor(atk.db, atk.patientId);
    return {
      vardplaner: vardplan.oversikt(atk, { tvangsvard: tvangsvardPagar(atk) }),
      tvangsvard: tvangsvard.oversikt(atk, hjalp),
      samordning: samordnad.oversikt(atk),
      halsoarendeForslag: halsoarende.forslag(atk),
    };
  },
  inkorg(c, { patientKort, patientRad }) {
    const db = c.db;
    const p = c.personal;
    const loggade = (c.s.r3InkorgLoggad ??= new Set());
    const logga = (pid, handling, resurs) => {
      if (loggade.has(resurs)) return;
      loggade.add(resurs);
      const a = new Atkomst(db, p, pid, {}, handling);
      const r = a.prova(handling);
      a.logga(handling, r.tillaten ? r.grund : 'administrativ', resurs);
    };
    const med = (handling, resurs) => (x) => { logga(x.patientId, handling, resurs(x)); return { ...x, patient: patientKort(patientRad(db, x.patientId)) }; };
    return {
      vardplanerUppfoljning: vardplan.inkorg(db, p, { harVardrelation }).map(med('las_vardplan', x => `inkorg:vardplan:${x.planId}`)),
      tvangsvard: tvangsvard.inkorg(db, p, { harVardplan: (period) => vardplan.pagarPa(db, period.patient_id, period.enhet_id) }).map(med('las_tvangsvard', x => `inkorg:tvangsvard:${x.periodId}`)),
      samordning: samordnad.inkorg(db, p).map(med('samordna', x => `inkorg:samordning:${x.samordningId}`)),
    };
  },
};
