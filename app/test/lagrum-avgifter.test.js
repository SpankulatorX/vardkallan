// Runda 13, r3 (beslut från Jonas): lagrummen för patientavgifterna och vårdgarantin, kontrollerade mot Riksdagens text
// 2026-11-11. Taken räknas ur prisbasbeloppet för det år ändringen gäller, och texterna anger paragrafen. Vårdgarantin
// räknas från att remissen utfärdades. Säkerhetsfynd 9 från granskningen av runda 12: rabatten följer vårdgivarens
// godkända avgifter. Testnamnen används i kravregistret och i docs/lagrum.md.
import { describe, test, expect } from 'bun:test';
import { byggSeed, datumAv, addDagar } from '../src/db.js';
import * as konfiguration from '../src/konfiguration.js';
import * as pbb from '../src/prisbasbelopp.js';
import { rabattFor, avgifter } from '../src/vardkontakt.js';
import * as ekonomi from '../src/ekonomi.js';
import * as tidbok from '../src/tidbok.js';
import * as vardbegaran from '../src/vardbegaran.js';
import { atk, personal } from './hjalp.js';

const andra = (db, nyckel, varde, nu = new Date()) => {
  const { andring } = konfiguration.foresla(db, personal(db, 'sysf'), { nyckel, varde, giltigFran: datumAv(nu), motivering: 'Prov.' }, nu);
  return konfiguration.godkann(db, personal(db, 'sysf-2'), andring.id, {}, nu).andring;
};
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Lagrum för avgifter och vårdgaranti', () => {
  test('taken för högkostnadsskyddet och slutenvården räknas ur prisbasbeloppet för året', () => {
    expect(pbb.PRISBASBELOPP[2026]).toBe(59200);
    expect(pbb.PRISBASBELOPP[2027]).toBe(59600);
    expect(pbb.hogkostnadstak('2026-11-11').tak).toBe(1450);
    expect(pbb.hogkostnadstak('2027-01-01').tak).toBe(1450);
    expect(pbb.slutenvardstak('2026-11-11').tak).toBe(136);
    expect(pbb.slutenvardstak('2027-01-01').tak).toBe(137);
    expect(pbb.hogkostnadstak(2026).text).toContain('17 kap. 6 §');
    expect(pbb.slutenvardstak(2026).text).toContain('17 kap. 2 §');
    // Ett år som inte finns i tabellen räknas med det närmaste kända året, och texten säger det.
    expect(pbb.slutenvardstak(2030)).toMatchObject({ tak: 137 });
    expect(pbb.slutenvardstak(2030).text).toContain('inte fastställt');
  });

  test('avgiften per vårddag kan inte sättas över lagens tak för det år ändringen gäller', () => {
    const db = byggSeed();
    const nu = new Date('2026-11-11T10:00:00Z');
    const p = konfiguration.prova('avgift.slutenvard_dygn_kr', 140, { datum: '2026-12-01' });
    expect(p.ok).toBe(false);
    expect(p.varfor).toContain('17 kap. 2 §');
    expect(p.varfor).toContain('136 kronor');
    expect(konfiguration.prova('avgift.slutenvard_dygn_kr', 136, { datum: '2026-12-01' }).ok).toBe(true);
    expect(konfiguration.prova('avgift.slutenvard_dygn_kr', 137, { datum: '2026-12-31' }).ok).toBe(false);
    expect(konfiguration.prova('avgift.slutenvard_dygn_kr', 137, { datum: '2027-01-01' }).ok).toBe(true);
    // Förslaget prövas med året då ändringen gäller.
    expect(fel(() => konfiguration.foresla(db, personal(db, 'sysf'), { nyckel: 'avgift.slutenvard_dygn_kr', varde: 150, giltigFran: '2026-12-01', motivering: 'Prov.' }, nu)).message).toContain('17 kap. 2 §');
    expect(konfiguration.forhandsvisa(db, personal(db, 'sysf'), { nyckel: 'avgift.slutenvard_dygn_kr', varde: 137, giltigFran: '2027-01-01' }, nu).ok).toBe(true);
    expect(konfiguration.forhandsvisa(db, personal(db, 'sysf'), { nyckel: 'avgift.slutenvard_dygn_kr', varde: 137, giltigFran: '2026-12-01' }, nu).ok).toBe(false);
    // Demons avgift är under taket.
    expect(konfiguration.parametrar()['avgift.slutenvard_dygn_kr'].standard).toBeLessThanOrEqual(136);
  });

  test('högkostnadsskyddet och åldersgränserna har paragrafen i texten, och avgiftsfriheten för barn är regionens beslut', () => {
    const p = konfiguration.prova('avgift.hogkostnadsskydd_kr', 1460, { datum: '2027-03-01' });
    expect(p.ok).toBe(false);
    expect(p.varfor).toContain('17 kap. 6 §');
    expect(p.varfor).toContain('1 450 kronor');
    expect(konfiguration.prova('avgift.hogkostnadsskydd_kr', 1450, { datum: '2027-03-01' }).ok).toBe(true);
    const fran = konfiguration.prova('avgift.fri_fran_ar', 86);
    expect(fran.ok).toBe(false);
    expect(fran.varfor).toContain('17 kap. 3 §');
    expect(konfiguration.parametrar()['avgift.fri_fran_ar'].beskrivning).toContain('förbrukningsartiklar');
    expect(konfiguration.parametrar()['avgift.fri_under_ar'].beskrivning).toContain('regionens beslut');
    expect(konfiguration.parametrar()['avgift.fri_under_ar'].beskrivning).toContain('inte i lagen');
  });

  test('rabatten följer vårdgivarens godkända avgifter och åldersgränser, inte standardvärdena', () => {
    const db = byggSeed();
    andra(db, 'avgift.besok_kr', 300);
    andra(db, 'avgift.fri_fran_ar', 80);
    const satser = avgifter(db);
    const v = { typ: 'oppenvard', kontaktsatt: 'besok', start: '2026-11-12T10:00:00Z' };
    // Ett barn: den ordinarie avgiften är vårdgivarens 300 kronor.
    expect(rabattFor({ fodd: '2015-01-01' }, v, { belopp: 0 }, satser)).toMatchObject({ ordinarie: 300, rabatt: 300 });
    // p01 är 81 år vid besöket och avgiftsfri med gränsen 80 år.
    expect(rabattFor({ fodd: '1945-02-02' }, v, { belopp: 0 }, satser).skal).toContain('från 80 år');
    // Hela vägen genom kostnadsrutan för ett barn.
    const nu = Date.now();
    const id = db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, kontaktsatt, planerad, ankomst) VALUES ('p09', 'uso-kard', 'oppenvard', ?, 'besok', 0, ?) RETURNING id")
      .get(new Date(nu - 3600_000).toISOString(), new Date(nu - 3600_000).toISOString()).id;
    const ut = ekonomi.kostnader(atk(db, 'lak-kard', 'p09', {}, 'las_kostnader'), { vardkontakt: id }, nu);
    expect(ut.aktuell.patientavgifter[0].rabatt).toMatchObject({ ordinarie: 300, rabatt: 300 });
  });

  test('vårdgarantin räknas från att remissen utfärdades, med lagrummet i hälso- och sjukvårdsförordningen', () => {
    const db = byggSeed();
    expect(konfiguration.prova('tidbok.vardgaranti_dagar', 120).varfor).toContain('6 kap. 1 § hälso- och sjukvårdsförordningen');
    expect(konfiguration.parametrar()['tidbok.vardgaranti_dagar'].beskrivning).toContain('utfärdades');
    expect(tidbok.demoregelText(db)).toContain('från att remissen utfärdades');
    // En remiss som skickades 1 januari och togs emot 5 januari: gränsen räknas från 1 januari.
    const rid = db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, prioritet, svar_senast, status, skickad_tid, mottagen_tid, kalla)
      VALUES ('p01', 'vc-tybble', 'uso-kard', 'lak-vc', 'Prov.', 'normal', '2026-06-01', 'bedomd', '2026-01-01T09:00:00Z', '2026-01-05T09:00:00Z', 'vardkallan') RETURNING *`).get();
    db.query("DELETE FROM vantelista WHERE remiss_id = ?").run(rid.id);
    const post = tidbok.vantelistaFranRemiss(db, rid);
    expect(post.fran).toBe('2026-01-01');
    expect(tidbok.gransFor({ ...post, mal: null }, '2026-01-10', db)).toMatchObject({ typ: 'vardgaranti', datum: addDagar('2026-01-01', 90) });
  });

  test('i primärvården gäller bedömningsgarantin i tre dagar för en egen vårdbegäran, och inte de 90 dagarna för specialiserad vård', () => {
    const db = byggSeed();
    expect(tidbok.gransFor({ remiss_id: 1, enhet_id: 'vc-tybble', tidstyp: 'nybesok', patientvald: 0, fran: '2026-01-01', mal: null }, '2026-01-02', db)).toBeNull();
    expect(tidbok.gransFor({ remiss_id: 1, enhet_id: 'uso-kard', tidstyp: 'nybesok', patientvald: 0, fran: '2026-01-01', mal: null }, '2026-01-02', db)).toMatchObject({ typ: 'vardgaranti' });
    expect(tidbok.BEDOMNINGSGARANTI_DAGAR).toBe(3);
    // En egen vårdbegäran till en vårdcentral ska vara bedömd inom tre dagar, och till specialiserad vård inom 14 dagar.
    expect(vardbegaran.svarSenastFor(db, 'vc-tybble', '2026-01-01')).toBe('2026-01-04');
    expect(vardbegaran.svarSenastFor(db, 'uso-kard', '2026-01-01')).toBe('2026-01-15');
  });
});
