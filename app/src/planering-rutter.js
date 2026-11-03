// API för runda 6, r4: planering och tidbok, del 2 (resurser, tider i följd, bevakningar, vyer, väntetider och
// kallelser), remiss, del 2 (bilagor, utkast, vidarebefordran och ledtider) och egen vårdbegäran i Min journal. Servern
// lämnar sina hjälpare hit, så att routningen för de här delarna ligger samlad. All behörighet prövas i
// behörighetsmotorn och varje åtkomst till patientuppgifter loggas, som i resten av API:t.
import { Fel, idag, addDagar, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import * as tidbok from './tidbok.js';
import * as plan from './planering-bas.js';
import * as planering from './planering.js';
import * as remiss from './remiss.js';
import * as r4 from './remiss-r4.js';
import * as vardbegaran from './vardbegaran.js';
import * as vardkontakt from './vardkontakt.js';

export const MAX_PERIOD_DAGAR = 31;

// Perioden för Dagens arbete: i dag om inget anges, annars fran till och med till, högst 31 dagar.
export function period(q) {
  const fran = q.get('fran') ?? idag();
  const till = q.get('till') ?? fran;
  if (!giltigtDatum(fran) || !giltigtDatum(till)) throw new Fel(400, 'Ange perioden med datum.', 'ogiltig', { falt: ['fran', 'till'] });
  if (till < fran) throw new Fel(400, 'Perioden slutar före den börjar.', 'ogiltig', { falt: ['till'] });
  if (till > addDagar(fran, MAX_PERIOD_DAGAR - 1)) throw new Fel(400, `Välj en period på högst ${MAX_PERIOD_DAGAR} dagar.`, 'ogiltig', { falt: ['till'] });
  return { fran, till };
}

export function registreraRutter({ rutt, kravInloggad, kravRoll, medPatient, medMinJournal }) {
  const medPost = (c, id, handling, fn) => { kravInloggad(c); const v = tidbok.vantelistaRad(c.db, id); return medPatient(c, v.patient_id, handling, (atk) => fn(atk, v)); };
  const medRemiss = (c, id, handling, fn) => { kravInloggad(c); const r = remiss.hamtaRad(c.db, id); return medPatient(c, r.patient_id, handling, (atk) => fn(atk, r)); };

  // Bokningsmallar och resurser för vårdenheten (Sussa 3.4.1.2, 3.4.1.5 och 3.4.2.2).
  rutt('GET', '/api/bokningsmallar', (c) => {
    kravRoll(c, 'las_tidbok');
    const m = tidbok.mallarFor(c.db, c.personal.enhet_id);
    const enheter = enheterUnder(c.db, vardenhetFor(c.db, c.personal.enhet_id));
    return {
      ingrepp: m.filter(x => x.typ === 'ingrepp'), mallar: m.filter(x => x.typ === 'kedja'),
      resurser: c.db.query('SELECT * FROM resurser WHERE aktiv = 1 ORDER BY kategori, id').all().filter(r => enheter.includes(r.enhet_id)).map(plan.resursKort),
    };
  });

  // Egna bevakningar (Sussa 3.4.1.3).
  rutt('GET', '/api/bevakningar/forslag', (c) => {
    const p = kravInloggad(c);
    const pid = c.url.searchParams.get('patientId');
    if (pid) return medPatient(c, pid, 'bevaka', (atk) => { atk.krav('bevaka'); return planering.bevakningForslag(c.db, p); });
    kravRoll(c, 'bevaka_enhet');
    return planering.bevakningForslag(c.db, p);
  });
  rutt('POST', '/api/bevakningar', (c) => {
    const p = kravInloggad(c);
    if (c.body.patientId) return medPatient(c, String(c.body.patientId), 'bevaka', (atk) => planering.skapaBevakning(c.db, p, c.body, atk));
    kravRoll(c, 'bevaka_enhet');
    return planering.skapaBevakning(c.db, p, c.body);
  });
  rutt('POST', '/api/egen-bevakning/:id/klar', (c, id) => {
    const p = kravInloggad(c);
    const b = planering.egenBevakningRad(c.db, id);
    if (b.patient_id) return medPatient(c, b.patient_id, 'bevaka', (atk) => planering.bevakningKlar(c.db, p, b, atk));
    kravRoll(c, 'bevaka_enhet');
    return planering.bevakningKlar(c.db, p, b);
  });

  // Anpassningsbara vyer (Sussa 3.4.1.6).
  rutt('GET', '/api/vy/:vy', (c, vy) => planering.hamtaVy(c.db, kravInloggad(c), vy));
  rutt('PUT', '/api/vy/:vy', (c, vy) => planering.sparaVy(c.db, kravInloggad(c), vy, c.body));
  rutt('POST', '/api/vy/:vy/aterstall', (c, vy) => planering.aterstallVy(c.db, kravInloggad(c), vy));

  // Väntetidsstatistik (Sussa 3.4.1.7).
  rutt('GET', '/api/vantelista/statistik', (c) => planering.vantetider(c.db, kravInloggad(c), c.url.searchParams.get('niva') === 'region' ? 'region' : 'enhet'));

  // Kallelser (Sussa 3.4.3.3): utan förbokad tid, som PDF och iCalendar, och patientens språk.
  rutt('POST', '/api/vantelista/:id/kalla-utan-tid', (c, id) => medPost(c, id, 'kalla', (atk, v) => planering.kallaUtanTid(atk, v)));
  rutt('GET', '/api/kallelse/:id/:format', (c, id, format) => {
    kravInloggad(c);
    if (!planering.FORMAT.includes(format)) throw new Fel(404, 'Okänd adress.', 'saknas');
    const k = c.db.query('SELECT * FROM kallelser WHERE id = ?').get(Number(id));
    if (!k) throw new Fel(404, 'Kallelsen finns inte.', 'saknas');
    return medPatient(c, k.patient_id, 'kalla', (atk) => planering.kallelseFil(atk, k, format));
  });
  rutt('POST', '/api/min/journal/:id/sprak', (c, id) => medMinJournal(c, id, 'min:sprak', (atk) => planering.minSattSprak(atk, c.body)));
  rutt('GET', '/api/min/journal/:id/kallelse/:kid/:format', (c, id, kid, format) => {
    if (!planering.FORMAT.includes(format)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return medMinJournal(c, id, `min:kallelse:${Number(kid) || 0}:${format}`, (atk) => planering.minKallelseFil(atk, kid, format));
  });
  rutt('GET', '/api/min/journal/:id/kallelse-ram/:rid/forslag', (c, id, rid) => medMinJournal(c, id, `min:kallelse-ram:${Number(rid) || 0}:forslag`, (atk) => planering.minRamForslag(atk, rid)));
  rutt('POST', '/api/min/journal/:id/kallelse-ram/:rid/boka', (c, id, rid) => medMinJournal(c, id, `min:kallelse-ram:${Number(rid) || 0}`, (atk) => planering.minRamBoka(atk, rid, c.body)));

  // Remiss, del 2 (Sussa 3.3.1.3 till 3.3.1.6).
  const medUtkast = (c, id, fn) => {
    kravInloggad(c);
    const u = c.db.query('SELECT patient_id FROM remiss_utkast WHERE id = ?').get(Number(id));
    if (!u) throw new Fel(404, 'Utkastet finns inte.', 'saknas');
    return medPatient(c, u.patient_id, 'remittera', (atk) => fn(atk, r4.utkastRad(atk, id)));
  };
  rutt('GET', '/api/patient/:id/remissutkast', (c, id) => { kravInloggad(c); return medPatient(c, id, 'remittera', (atk) => r4.utkastFor(atk)); });
  rutt('POST', '/api/patient/:id/remissutkast', (c, id) => { kravInloggad(c); return medPatient(c, id, 'remittera', (atk) => r4.skapaUtkast(atk, c.body)); });
  rutt('PUT', '/api/remissutkast/:id', (c, id) => medUtkast(c, id, (atk, u) => r4.andraUtkast(atk, u, c.body)));
  rutt('POST', '/api/remissutkast/:id/skicka', (c, id) => medUtkast(c, id, (atk, u) => r4.skickaUtkast(atk, u, { knyt: (ut) => vardkontakt.knyt(atk, 'remisser', ut, c.body) })));
  rutt('POST', '/api/remissutkast/:id/ta-bort', (c, id) => medUtkast(c, id, (atk, u) => r4.taBortUtkast(atk, u)));
  rutt('POST', '/api/remissutkast/:id/bilagor', (c, id) => medUtkast(c, id, (atk, u) => r4.bilagaTillUtkast(atk, u, c.body)));
  rutt('POST', '/api/remiss/:id/bilagor', (c, id) => medRemiss(c, id, 'remittera', (atk, r) => r4.kompletteraMedBilaga(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/vidarebefordra', (c, id) => medRemiss(c, id, 'bedom_remiss', (atk, r) => r4.vidarebefordra(atk, r, c.body)));
  rutt('GET', '/api/bilaga/:id', (c, id) => {
    kravInloggad(c);
    const b = r4.bilagaRad(c.db, id);
    return medPatient(c, b.patient_id, 'las_remiss', (atk) => r4.bilagaFil(atk, b));
  });
  rutt('GET', '/api/remisser/statistik', (c) => r4.statistik(c.db, kravInloggad(c), c.url.searchParams.get('niva') === 'region' ? 'region' : 'enhet'));

  // Egen vårdbegäran från invånaren (Sussa 3.3.2.1).
  rutt('POST', '/api/min/journal/:id/vardbegaran/forslag', (c, id) => medMinJournal(c, id, 'min:vardbegaran:forslag', (atk) => vardbegaran.minForslag(atk, c.body)));
  rutt('POST', '/api/min/journal/:id/vardbegaran', (c, id) => medMinJournal(c, id, 'min:vardbegaran', (atk) => vardbegaran.skapa(atk, c.body)));
}

// Inkorgens rader för runda 6, r4: egna bevakningar som har löpt ut. En rad med en patient loggas en gång per session.
export function inkorg(c) {
  const loggade = (c.s.egnaBevakningarLoggade ??= new Set());
  return { egnaBevakningar: kanRoll(c.personal, 'bevaka_enhet') ? planering.bevakningarIInkorg(c.db, c.personal, loggade) : [] };
}
