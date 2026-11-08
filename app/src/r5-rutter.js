// Runda 8, r5: API för epikrisens förslag och för flera mätvärden på en gång (strukturerad.js). Behörigheten prövas i
// modulen och av behörighetsmotorn, och varje anrop loggas på patienten som de andra anropen (medPatient).
import * as strukturerad from './strukturerad.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  rutt('GET', '/api/patient/:id/epikris/forslag', (c, id) => {
    kravInloggad(c);
    const vt = c.url.searchParams.get('vardtillfalle');
    return medPatient(c, id, 'skriv_journal', (atk) => strukturerad.epikrisForslag(atk, { vardtillfalleId: vt && /^\d{1,9}$/.test(vt) ? Number(vt) : null }));
  });
  rutt('POST', '/api/patient/:id/matvarden/flera', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => strukturerad.registreraFlera(atk, c.body))]; });
}
