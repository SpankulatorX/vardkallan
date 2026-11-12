// Runda 12, r2: uppgraderingar med återgång (vårt D7 och M8) och säkerhetskopior (Sussa KD1.1.3.6). Inget här rör en
// enskild patient. Behörigheten prövas i modulerna, och varje ändring loggas med vem som gjorde den. Kopiorna hör till
// sandlådans stabila id (kopieId), inte till sessionskakan, som byts vid varje inloggning.
import * as releaser from './releaser.js';
import * as sakerhetskopior from './sakerhetskopior.js';
import { lasTestresultat } from './krav.js';
import { kanRoll } from './atkomst.js';

export function registreraRutter({ rutt, kravInloggad, testresultat, kopior, migrera, loggaUtAlla = () => {} }) {
  const tester = () => lasTestresultat(testresultat);
  rutt('GET', '/api/uppgraderingar', (c) => releaser.oversikt(c.db, kravInloggad(c), { testresultat: tester() }));
  rutt('POST', '/api/uppgraderingar/atergang', (c) => {
    const p = kravInloggad(c);
    // Läget före återgången sparas först, så att inget går förlorat om något går fel.
    if (kanRoll(p, 'lagring')) kopior.ta(c.s.kopieId, c.db, { orsak: 'fore_atergang', av: p.id });
    return releaser.aterga(c.db, p);
  });
  rutt('POST', '/api/uppgraderingar/:id/godkann', (c, id) => releaser.godkann(c.db, kravInloggad(c), id, { testresultat: tester() }));

  rutt('GET', '/api/sakerhetskopior', (c) => sakerhetskopior.oversikt(kopior, c.s.kopieId, c.db, kravInloggad(c), c.s.aterstallning));
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 1): taket för manuella kopior hör till sandlådan.
  rutt('POST', '/api/sakerhetskopior', (c) => [201, sakerhetskopior.taNu(kopior, c.s.kopieId, c.db, kravInloggad(c), new Date(), (c.s.kopieTak ??= []))]);
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 3 och 4): inläsningen av en kopia föreslås av en
  // systemförvaltare och godkänns av en andra i sin egen inloggning. Förslaget hör till sandlådan (sessionen). Efter
  // inläsningen loggas alla ut, så att varje inloggning prövas mot den inlästa sandlådan med sin andra faktor.
  rutt('POST', '/api/sakerhetskopior/aterstall', (c) => {
    const r = sakerhetskopior.foresla(kopior, c.s.kopieId, c.db, kravInloggad(c), c.body);
    c.s.aterstallning = { ...r.forslag, forlust: r.forlust };
    return [202, { vantar: true, forlust: r.forlust, vantande: sakerhetskopior.vantandeUt(c.db, c.s.aterstallning),
      text: 'Förslaget väntar på en andra systemförvaltare, som godkänner det i sin egen inloggning.' }];
  });
  rutt('POST', '/api/sakerhetskopior/aterstall/avbryt', (c) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, 'lagring')) return [403, { fel: 'Bara systemförvaltningen sköter säkerhetskopiorna.', kod: 'nekad' }];
    c.s.aterstallning = null;
    return { ok: true };
  });
  rutt('POST', '/api/sakerhetskopior/aterstall/godkann', (c) => {
    const r = sakerhetskopior.godkann(kopior, c.s.kopieId, c.db, kravInloggad(c), c.s.aterstallning, { migrera });
    const gammal = c.s.db;
    c.s.db = r.db;
    c.db = r.db;
    gammal.close();
    c.s.aterstallning = null;
    loggaUtAlla(c.s);
    return { aterstalldTill: r.aterstalldTill, plats: r.plats, forsok: r.forsok, fore: r.fore, text: r.text, utloggad: true };
  });
}
