// Runda 9, r7: API för skanning, analys och patientgruppering, folkhälsa, spårbarhet, forskningsuttag, in- och
// utfarter, restjournaler och signering. Behörigheten prövas i modulerna och av behörighetsmotorn, och varje anrop som
// rör en patient loggas på patienten som de andra anropen (medPatient).
import * as skanning from './skanning.js';
import * as analys from './analys.js';
import * as folkhalsa from './folkhalsa.js';
import * as sparbarhet from './sparbarhet.js';
import * as vardformer from './vardformer.js';
import * as forskning from './forskning.js';
import * as signering from './signering.js';
import * as journal from './journal.js';
import { Fel } from './db.js';
import * as vardkontakt from './vardkontakt.js';
import { kanRoll } from './atkomst.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  // Sussa 3.1.3.6: streckkodsläsaren och patientens armband.
  rutt('POST', '/api/skanna', (c) => { kravInloggad(c); return skanning.skanna(c, c.body, { medPatient, valFor }); });
  rutt('POST', '/api/patient/:id/armband', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk, p) => skanning.armband(atk, p)); });

  // Sussa 6.2.1.1 och 6.2.1.2: statistik och patientgruppering.
  rutt('GET', '/api/analys', (c) => analys.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/analys/grupp', (c) => analys.grupp(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/statistik', (c) => analys.statistik(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/urval', (c) => analys.sparaUrval(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/analys/urval/:id/ta-bort', (c, id) => analys.taBortUrval(c.db, kravInloggad(c), id));
  rutt('GET', '/api/analys/resultat/:id', (c, id) => analys.resultat(c.db, kravInloggad(c), id));

  // Sussa 6.2.2.1: folkhälsoinsatser för riskgrupper.
  rutt('GET', '/api/folkhalsa', (c) => folkhalsa.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/folkhalsa/insatser', (c) => [201, folkhalsa.starta(c.db, kravInloggad(c), c.body)]);
  rutt('GET', '/api/folkhalsa/insatser/:id', (c, id) => folkhalsa.insats(c.db, kravInloggad(c), id));
  rutt('POST', '/api/folkhalsa/insatser/:id/avsluta', (c, id) => folkhalsa.avsluta(c.db, kravInloggad(c), id));

  // Sussa 6.1.1.3, 6.1.1.4 och 6.1.1.6: händelsekedjan per vårdkontakt, subprocesserna och vårdformerna.
  const medKontakt = (c, id, handling, fn) => {
    kravInloggad(c);
    const v = vardkontakt.hamtaKontakt(c.db, id);
    return medPatient(c, v.patient_id, handling, (atk) => fn(atk, vardkontakt.hamtaKontakt(c.db, v.id)));
  };
  const lasning = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  rutt('GET', '/api/vardkontakt/:id/handelser', (c, id) => medKontakt(c, id, lasning(c), (atk, v) => sparbarhet.handelsekedja(atk, v)));
  rutt('GET', '/api/sparbarhet/subprocesser', (c) => sparbarhet.subprocesser(c.db, kravInloggad(c), { dagar: Math.min(365, Math.max(7, Number(c.url.searchParams.get('dagar')) || 90)) }));
  rutt('POST', '/api/vardkontakt/:id/besok-slut', (c, id) => medKontakt(c, id, 'registrera_vardkontakt', (atk, v) => vardformer.avslutaBesok(atk, v)));
  rutt('POST', '/api/vardkontakt/:id/overgang', (c, id) => medKontakt(c, id, 'vardtillfalle', (atk, v) => vardformer.franDagkirurgi(atk, v, c.body)));
  rutt('POST', '/api/patient/:id/dagkirurgi', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_vardkontakt', (atk) => vardformer.registreraDagkirurgi(atk, c.body)); });
  // Sussa 3.1.11.2: signaturen och vårdenhetens signeringslista.
  rutt('GET', '/api/anteckning/:id/signatur', (c, id) => {
    kravInloggad(c);
    const a = journal.hamtaAnteckningRad(c.db, id);
    return medPatient(c, a.patient_id, journal.lasHandling(a.kategori), (atk) => {
      if (a.status !== 'signerad' && a.forfattare_id !== c.personal.id) throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
      atk.krav(journal.lasHandling(a.kategori), { resurs: { enhet_id: a.enhet_id }, beskrivning: `signatur:${a.id}` });
      return signering.kontrollera(atk, a);
    });
  });
  rutt('GET', '/api/signeringslista', (c) => signering.lista(c.db, kravInloggad(c)));

  // Sussa 6.3.3.1: beställningar av forskningsuttag.
  rutt('GET', '/api/forskning', (c) => forskning.lista(c.db, kravInloggad(c)));
  rutt('POST', '/api/forskning', (c) => [201, forskning.registrera(c.db, kravInloggad(c), c.body)]);
  rutt('GET', '/api/forskning/:id', (c, id) => forskning.hamta(c.db, kravInloggad(c), id));
  rutt('POST', '/api/forskning/:id/beslut', (c, id) => forskning.besluta(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/forskning/:id/utlamna', (c, id) => forskning.utlamna(c.db, kravInloggad(c), id));
  rutt('POST', '/api/vardtillfalle/:id/overgang', (c, id) => {
    kravInloggad(c);
    const vt = vardkontakt.hamtaVardtillfalle(c.db, id);
    return medPatient(c, vt.patient_id, 'vardtillfalle', (atk) => vardformer.franSlutenvard(atk, vt, c.body));
  });
}
