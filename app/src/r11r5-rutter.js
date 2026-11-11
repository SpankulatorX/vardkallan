// API för bilder och media, version 1.1 (runda 11, r5, Sussa 4.2.1.1 till 4.2.1.4): uppladdning i delar, miniatyrer och
// visningsbilder, annoteringar, import från apparat och annan vårdgivare och DICOMweb mot det simulerade arkivet
// (bildmedia.js). En rad som anges med id hämtas först, och anropet prövas sedan på radens patient, så att loggen hamnar
// på rätt patient. Galleriet, uppladdningen i ett anrop och granskningen finns i r9r3-rutter.js och använder bildmedia.js.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as bilder from './bilder.js';
import * as bm from './bildmedia.js';

const q = (c, namn) => c.url.searchParams.get(namn) || null;
const skriv = (c) => (kanRoll(c.personal, 'skriv_journal') ? 'skriv_journal' : 'skriv_omvardnad');
const las = (c) => (kanRoll(c.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  const medRad = (c, rad, handling, fn) => medPatient(c, rad.patient_id, handling, (atk) => fn(atk, rad));

  // Uppladdning i delar.
  rutt('POST', '/api/patient/:id/media/uppladdning', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, skriv(c), (atk) => bm.starta(atk, c.body))]; });
  rutt('POST', '/api/media/uppladdning/:uid/del', (c, uid) => { kravInloggad(c); return medRad(c, bm.uppladdningRad(c.db, uid), skriv(c), (atk, u) => bm.del(atk, u, c.body)); });
  rutt('POST', '/api/media/uppladdning/:uid/avbryt', (c, uid) => { kravInloggad(c); return medRad(c, bm.uppladdningRad(c.db, uid), skriv(c), (atk, u) => bm.avbryt(atk, u)); });
  rutt('POST', '/api/media/uppladdning/:uid/klar', async (c, uid) => { kravInloggad(c); return [201, await medRad(c, bm.uppladdningRad(c.db, uid), skriv(c), (atk, u) => bm.avsluta(atk, u))]; });

  // Miniatyr och visningsbild, som servern gör.
  rutt('GET', '/api/media/:mid/miniatyr', (c, mid) => { kravInloggad(c); return medRad(c, bilder.mediaRad(c.db, mid), las(c), (atk, m) => bm.visningsfil(atk, m, 'miniatyr')); });
  rutt('GET', '/api/media/:mid/visning', (c, mid) => { kravInloggad(c); return medRad(c, bilder.mediaRad(c.db, mid), las(c), (atk, m) => bm.visningsfil(atk, m, 'visning')); });

  // Annoteringar.
  rutt('POST', '/api/media/:mid/annoteringar', (c, mid) => { kravInloggad(c); return [201, medRad(c, bilder.mediaRad(c.db, mid), skriv(c), (atk, m) => bm.annotera(atk, m, c.body))]; });
  rutt('POST', '/api/media/annotering/:aid/ta-bort', (c, aid) => { kravInloggad(c); return medRad(c, bm.annoteringRad(c.db, aid), skriv(c), (atk, a) => bm.taBortAnnotering(atk, a)); });

  // Import från en simulerad apparat och från en simulerad annan vårdgivare.
  rutt('POST', '/api/patient/:id/media/apparat/:aid', (c, id, aid) => { kravInloggad(c); return [201, medPatient(c, id, skriv(c), (atk) => bm.franApparat(atk, aid, c.body))]; });
  rutt('GET', '/api/patient/:id/media/extern', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => bm.externLage(atk, c.s)); });
  rutt('POST', '/api/patient/:id/media/extern', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'las_journal', (atk) => bm.hamtaExtern(atk, c.s, c.body))]; });

  // DICOMweb mot det simulerade arkivet: QIDO-RS och WADO-RS.
  rutt('GET', '/api/dicomweb/studies', (c) => {
    kravInloggad(c);
    const uid = q(c, 'StudyInstanceUID') ?? q(c, '0020000D');
    const pid = q(c, 'PatientID') ?? q(c, '00100020');
    let patient = pid ? bm.patientForPid(c.db, pid) : null;
    if (!pid && uid) { try { patient = bm.studieForUid(c.db, uid).patient_id; } catch { patient = null; } }
    if (!pid && !uid) throw new Fel(400, 'Ange PatientID eller StudyInstanceUID.', 'ogiltig');
    if (!patient) return new Response('[]', { headers: { 'Content-Type': 'application/dicom+json; charset=utf-8', 'Cache-Control': 'no-store' } });
    return medPatient(c, patient, 'las_journal', (atk) => bm.qidoStudier(atk, { StudyInstanceUID: uid, ModalitiesInStudy: q(c, 'ModalitiesInStudy') ?? q(c, '00080061'), StudyDate: q(c, 'StudyDate') ?? q(c, '00080020') }));
  });
  const studie = (c, uid, fn) => { kravInloggad(c); return medRad(c, bm.studieForUid(c.db, uid), 'las_journal', fn); };
  rutt('GET', '/api/dicomweb/studies/:uid/series', (c, uid) => studie(c, uid, (atk, s) => bm.serier(atk, s)));
  rutt('GET', '/api/dicomweb/studies/:uid/metadata', (c, uid) => studie(c, uid, (atk, s) => bm.metadata(atk, s)));
  rutt('GET', '/api/dicomweb/studies/:uid/series/:suid/instances', (c, uid, suid) => studie(c, uid, (atk, s) => bm.instanser(atk, s, suid)));
  rutt('GET', '/api/dicomweb/studies/:uid/series/:suid/instances/:iuid', (c, uid, suid, iuid) => studie(c, uid, (atk, s) => bm.hamtaInstans(atk, s, suid, iuid)));
  rutt('GET', '/api/dicomweb/studies/:uid/series/:suid/instances/:iuid/rendered', (c, uid, suid, iuid) => studie(c, uid, (atk, s) => bm.renderad(atk, s, suid, iuid, { fonster: q(c, 'window') })));
  rutt('GET', '/api/dicomweb/studies/:uid/series/:suid/instances/:iuid/thumbnail', (c, uid, suid, iuid) => studie(c, uid, (atk, s) => bm.renderad(atk, s, suid, iuid, { miniatyr: true })));
}
