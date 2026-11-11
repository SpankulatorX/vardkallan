// Runda 12, r2: uppgraderingar med återgång (vårt D7 och M8) och säkerhetskopior (Sussa KD1.1.3.6). Inget här rör en
// enskild patient. Behörigheten prövas i modulerna, och varje ändring loggas med vem som gjorde den. Kopiorna hör till
// sandlådans stabila id (kopieId), inte till sessionskakan, som byts vid varje inloggning.
import * as releaser from './releaser.js';
import * as sakerhetskopior from './sakerhetskopior.js';
import { lasTestresultat } from './krav.js';
import { kanRoll } from './atkomst.js';

export function registreraRutter({ rutt, kravInloggad, testresultat, kopior, migrera }) {
  const tester = () => lasTestresultat(testresultat);
  rutt('GET', '/api/uppgraderingar', (c) => releaser.oversikt(c.db, kravInloggad(c), { testresultat: tester() }));
  rutt('POST', '/api/uppgraderingar/atergang', (c) => {
    const p = kravInloggad(c);
    // Läget före återgången sparas först, så att inget går förlorat om något går fel.
    if (kanRoll(p, 'lagring')) kopior.ta(c.s.kopieId, c.db, { orsak: 'fore_atergang', av: p.id });
    return releaser.aterga(c.db, p);
  });
  rutt('POST', '/api/uppgraderingar/:id/godkann', (c, id) => releaser.godkann(c.db, kravInloggad(c), id, { testresultat: tester() }));

  rutt('GET', '/api/sakerhetskopior', (c) => sakerhetskopior.oversikt(kopior, c.s.kopieId, c.db, kravInloggad(c)));
  rutt('POST', '/api/sakerhetskopior', (c) => [201, sakerhetskopior.taNu(kopior, c.s.kopieId, c.db, kravInloggad(c))]);
  rutt('POST', '/api/sakerhetskopior/aterstall', (c) => {
    const r = sakerhetskopior.aterstall(kopior, c.s.kopieId, c.db, kravInloggad(c), c.body, { migrera });
    const gammal = c.s.db;
    c.s.db = r.db;
    c.db = r.db;
    gammal.close();
    return { aterstalldTill: r.aterstalldTill, plats: r.plats, forsok: r.forsok, fore: r.fore, text: r.text };
  });
}
