// Runda 10, r4: API för in- och utfarter (infarter.js, Sussa 3.1.3.3 och 3.1.3.8), skannade restjournaler
// (restjournal.js, Sussa 3.1.10.1 och 3.1.10.2) och dokumentation vid donation och transplantation (donation.js, Sussa
// 3.1.12.1). Behörigheten prövas i modulerna av behörighetsmotorn, och varje anrop som rör en patient loggas på
// patienten som de andra anropen (medPatient).
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as infarter from './infarter.js';
import * as restjournal from './restjournal.js';
import * as donation from './donation.js';
import * as skala2 from './syremattnad-skala.js';

// Tabellerna, och seeden när en tabell är ny.
export function sakra(db, bas = new Date()) {
  infarter.seeda(db, bas);
  restjournal.sakra(db);
  donation.sakra(db);
  skala2.sakra(db);
  return db;
}

// Händelserna i översiktens tidslinje, ur det som anroparen får se.
export const tidslinje = (atk) => [...infarter.tidslinje(atk), ...restjournal.tidslinje(atk), ...donation.tidslinje(atk)];

// En rad som hämtas på id: utan vårdrelation, och när raden ligger på en spärrad vårdenhet, är svaret detsamma som för
// en rad som inte finns. Det nekade försöket loggas av behörighetsmotorn.
export function medRad(c, medPatient, rad, handling, saknas, fn) {
  return medPatient(c, rad.patient_id, handling, (atk, p) => {
    try { return fn(atk, p); } catch (e) {
      if (e instanceof Fel && e.status === 403 && (e.kod === 'kraver_samtycke' || !atk.prova('las_oversikt').tillaten)) throw new Fel(404, saknas, 'saknas');
      throw e;
    }
  });
}

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  // In- och utfarter.
  rutt('GET', '/api/patient/:id/infarter', (c, id) => { kravInloggad(c); return medPatient(c, id, infarter.LAS, (atk) => infarter.lista(atk)); });
  rutt('POST', '/api/patient/:id/infarter', (c, id) => { kravInloggad(c); return medPatient(c, id, infarter.SKRIV, (atk) => [201, infarter.registrera(atk, c.body)]); });
  const infartRutt = (namn, fn) => rutt('POST', `/api/infart/:id/${namn}`, (c, id) => {
    kravInloggad(c);
    const r = infarter.infartRad(c.db, id);
    return medRad(c, medPatient, r, infarter.SKRIV, 'In- eller utfarten finns inte.', (atk) => fn(atk, infarter.infartRad(c.db, r.id), c.body));
  });
  infartRutt('skotsel', infarter.skota);
  infartRutt('avveckla', infarter.avveckla);
  infartRutt('byt', infarter.byt);

  // Skannade restjournaler. Listan läses som journalen, eller som kvitto av den som bara skannar.
  const lasEllerSkanna = (c) => (kanRoll(c.personal, restjournal.LAS) ? restjournal.LAS : restjournal.SKRIV);
  rutt('GET', '/api/patient/:id/restjournaler', (c, id) => { kravInloggad(c); return medPatient(c, id, lasEllerSkanna(c), (atk) => restjournal.lista(atk)); });
  rutt('POST', '/api/patient/:id/restjournaler/tolka', (c, id) => { kravInloggad(c); return medPatient(c, id, restjournal.SKRIV, (atk, p) => restjournal.tolka(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/restjournaler', (c, id) => { kravInloggad(c); return medPatient(c, id, restjournal.SKRIV, (atk, p) => [201, restjournal.skanna(atk, p, c.body)]); });
  rutt('GET', '/api/restjournal/:id/fil', (c, id) => {
    kravInloggad(c);
    const r = restjournal.restjournalRad(c.db, id);
    return medRad(c, medPatient, r, restjournal.LAS, 'Restjournalen finns inte.', (atk) => restjournal.fil(atk, r));
  });
  rutt('POST', '/api/restjournal/:id/makulera', (c, id) => {
    kravInloggad(c);
    const r = restjournal.restjournalRad(c.db, id);
    return medRad(c, medPatient, r, restjournal.SKRIV, 'Restjournalen finns inte.', (atk) => restjournal.makulera(atk, restjournal.restjournalRad(c.db, r.id), c.body));
  });

  // Donation och transplantation.
  rutt('GET', '/api/patient/:id/donation', (c, id) => { kravInloggad(c); return medPatient(c, id, donation.LAS, (atk, p) => donation.oversikt(atk, p)); });
  rutt('POST', '/api/patient/:id/dodsfall', (c, id) => { kravInloggad(c); return medPatient(c, id, donation.SKRIV, (atk) => [201, donation.registreraDodsfall(atk, c.body)]); });
  rutt('POST', '/api/patient/:id/donation', (c, id) => { kravInloggad(c); return medPatient(c, id, donation.SKRIV, (atk, p) => [201, donation.starta(atk, p, c.body)]); });
  rutt('POST', '/api/patient/:id/donationsvilja', (c, id) => { kravInloggad(c); return medPatient(c, id, donation.SKRIV, (atk) => [201, donation.registreraVilja(atk, c.body)]); });
  rutt('POST', '/api/patient/:id/transplantationer', (c, id) => { kravInloggad(c); return medPatient(c, id, 'skriv_journal', (atk) => [201, donation.registreraTransplantation(atk, c.body)]); });
  const donationRutt = (namn, fn) => rutt('POST', `/api/donation/:id/${namn}`, (c, id) => {
    kravInloggad(c);
    const d = donation.donationRad(c.db, id);
    return medRad(c, medPatient, d, donation.SKRIV, 'Donationsutredningen finns inte.', (atk, p) => fn(atk, donation.donationRad(c.db, d.id), p ?? patientRad(c.db, d.patient_id), c.body));
  });
  const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
  donationRutt('punkt', donation.bocka);
  donationRutt('anteckning', (atk, d, p) => [201, donation.anteckning(atk, d, p)]);
  donationRutt('avsluta', donation.avsluta);
  // SpO2 skala 2 i NEWS2 (Sussa 3.1.3.9).
  rutt('POST', '/api/patient/:id/news2-skala', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk) => skala2.besluta(atk, c.body)); });
  // Demoläget i den egna sandlådan: patient 10 på hjärtintensiven.
  rutt('POST', '/api/demo/donation', (c) => { kravInloggad(c); return donation.demo(c.db); });
}

// Förslagen i inkorgen till vårdenhetens donationsansvariga (donation.js), med patientens kort som de andra raderna.
export function inkorg(c, patientKort, patientRad, valFor) {
  return { donationsforslag: donation.inkorg(c.db, c.personal, (pid) => valFor(c.s, pid)).map(x => ({ ...x, patient: patientKort(patientRad(c.db, x.patientId)) })) };
}
