// Runda 12, r1: regler och parametrar för läkemedel och administration (konfiguration.js, Sussa 12.1.1.8 och
// 12.1.1.6). Ändringarna föreslås av den ena systemförvaltaren och godkänns av den andra, och testerna räknar bara
// det de själva har skapat. Tiden skickas in som ett fast värde där en funktion räknar med den.
import { describe, test, expect } from 'bun:test';
import { byggSeed, datumAv, idag, addDagar } from '../src/db.js';
import * as konfiguration from '../src/konfiguration.js';
import * as lakemedel from '../src/lakemedel.js';
import { INTERAKTIONER_STANDARD } from '../src/kodverk.js';
import { atk, personal } from './hjalp.js';

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const sysf = (db) => personal(db, 'sysf');
const sysf2 = (db) => personal(db, 'sysf-2');
const andra = (db, nyckel, varde, nu = new Date()) => {
  const { andring } = konfiguration.foresla(db, sysf(db), { nyckel, varde, giltigFran: datumAv(nu), motivering: 'Prov.' }, nu);
  return konfiguration.godkann(db, sysf2(db), andring.id, {}, nu).andring;
};
const lm = (db, atc, styrka = null) => db.query(`SELECT id FROM katalog WHERE atc = ?${styrka ? ' AND styrka = ?' : ''} ORDER BY id`).get(...[atc, styrka].filter(Boolean)).id;
const regler = (v) => v.map(x => `${x.niva}:${x.regel}`);
const ord = (lakemedelId, extra = {}) => ({ lakemedelId, dosering: '1 tablett dagligen', typ: 'staende', ordinationsorsak: 'Prov', uppfoljningsdatum: addDagar(idag(), 30), ...extra });

describe('Läkemedelsregler som konfiguration', () => {
  test('interaktioner: vårdgivarens lista är en demoregel med fyra ögon, och en ny interaktion ger en varning vid ordination', () => {
    const db = byggSeed();
    const p = konfiguration.parametrar();
    // Runda 13, r3: förvalet har fler par (E1-11, E1-21, E1-25).
    expect(p['lakemedel.interaktioner']).toMatchObject({ omrade: 'lakemedel', typ: 'lista', standard: INTERAKTIONER_STANDARD });
    expect(INTERAKTIONER_STANDARD).toEqual(expect.arrayContaining(['B01AA03 + M01A', 'B01AF + M01A', 'B01AA + B01AC']));
    expect(konfiguration.prova('lakemedel.interaktioner', 'B01AA03 + XYZ').varfor).toContain('XYZ är ingen ATC-kod');
    expect(konfiguration.prova('lakemedel.interaktioner', 'B01AA03 + Z99').varfor).toContain('Z99 finns inte i ATC');
    expect(konfiguration.prova('lakemedel.interaktioner', 'B01AA03').varfor).toContain('två ATC-koder med ett plustecken');
    expect(konfiguration.prova('lakemedel.interaktioner', 'b01aa03 + n02be01; B01AA03 + M01A').varde).toEqual(['B01AA03 + N02BE01', 'B01AA03 + M01A']);
    const paracetamol = lm(db, 'N02BE01', '500 mg');
    // p01 har warfarin. Innan ändringen ger paracetamol ingen interaktionsvarning.
    const fore = regler(lakemedel.kontroll(atk(db, 'lak-kard', 'p01'), { lakemedelId: paracetamol }).varningar);
    expect(fore.some(r => r.includes('interaktion'))).toBe(false);
    const f = konfiguration.forhandsvisa(db, sysf(db), { nyckel: 'lakemedel.interaktioner', varde: 'B01AA03 + M01A; B01AA03 + N02BE01' });
    expect(f.effekt.join(' ')).toContain('Ny interaktion: B01AA03 + N02BE01');
    andra(db, 'lakemedel.interaktioner', 'B01AA03 + M01A; B01AA03 + N02BE01');
    const v = lakemedel.kontroll(atk(db, 'lak-kard', 'p01'), { lakemedelId: paracetamol }).varningar;
    expect(regler(v)).toContain('allvarlig:interaktion_B01AA03_N02BE01');
    expect(v.find(x => x.regel === 'interaktion_B01AA03_N02BE01').text).toContain('vårdgivarens regel');
    // Warfarin och NSAID ger som förut sin egen varning.
    expect(regler(lakemedel.kontroll(atk(db, 'lak-kard', 'p01'), { lakemedelId: 'VK-NPL-0027' }).varningar)).toContain('allvarlig:warfarin_nsaid');
    andra(db, 'lakemedel.interaktioner', 'B01AA03 + N02BE01');
    expect(regler(lakemedel.kontroll(atk(db, 'lak-kard', 'p01'), { lakemedelId: 'VK-NPL-0027' }).varningar)).not.toContain('allvarlig:warfarin_nsaid');
  });

  test('maxdoser och njurfunktion: högsta dygnsdosen och gränserna för metformin är parametrar som läses vid varje ordination', () => {
    const db = byggSeed();
    expect(konfiguration.prova('lakemedel.maxdoser', 'N02BE01 4000').varfor).toContain('ATC-kod, högsta dygnsdos och enhet');
    expect(konfiguration.prova('lakemedel.maxdoser', 'N02BE01 0 mg').varfor).toContain('större än 0');
    const paracetamol = lm(db, 'N02BE01', '500 mg');
    const a = atk(db, 'lak-kard', 'p01');
    const kontroll = (extra) => regler(lakemedel.kontroll(a, { lakemedelId: paracetamol, dosEnhet: 'mg', ...extra }).varningar);
    expect(kontroll({ dos: 1000, tider: ['08', '14', '20'] })).not.toContain('allvarlig:maxdos');
    expect(kontroll({ dos: 1000, tider: ['06', '12', '18', '22', '02'] })).toContain('allvarlig:maxdos');
    expect(kontroll({ dos: 500, typ: 'vid_behov', vidBehov: true, dosering: '1 tablett vid behov, högst 10 tabletter per dygn' })).toContain('allvarlig:maxdos');
    andra(db, 'lakemedel.maxdoser', 'N02BE01 6000 mg');
    expect(kontroll({ dos: 1000, tider: ['06', '12', '18', '22', '02'] })).not.toContain('allvarlig:maxdos');
    // Metformin: p06 har eGFR 27. Med gränsen 25 för att stoppa blir det en varning att begränsa dosen.
    const metformin = lakemedel.kontroll(atk(db, 'lak-vc', 'p06'), { lakemedelId: 'VK-NPL-0020' }).varningar;
    expect(regler(metformin)).toContain('allvarlig:metformin_egfr');
    andra(db, 'lakemedel.metformin_egfr_stopp', 25);
    const efter = lakemedel.kontroll(atk(db, 'lak-vc', 'p06'), { lakemedelId: 'VK-NPL-0020' }).varningar;
    expect(regler(efter)).toContain('observera:metformin_egfr');
    expect(efter.find(x => x.regel === 'metformin_egfr').text).toContain('25 till 44');
    expect(konfiguration.prova('lakemedel.metformin_egfr_stopp', 10).varfor).toContain('Lägsta värde är 15');
  });

  test('ordinationsorsak och uppföljningsdatum: frivilliga där NLL inte berörs om vårdgivaren väljer det, och alltid krav vid förskrivning', () => {
    const db = byggSeed();
    const nutrition = db.query("SELECT id FROM katalog WHERE atc = 'V06DB' ORDER BY id").get().id;
    const a = atk(db, 'lak-kard', 'p01');
    const utan = { ordinationsorsak: '', uppfoljningsdatum: '' };
    expect(fel(() => lakemedel.spara(a, ord(nutrition, { ...utan, dosering: '1 flaska per dag' }))).extra.falt).toContain('ordinationsorsak');
    const def = konfiguration.parametrar()['lakemedel.orsak_frivillig_utan_nll'];
    expect(def).toMatchObject({ typ: 'janej', standard: false });
    expect(def.beskrivning).toContain('Nationella läkemedelslistan');
    andra(db, 'lakemedel.orsak_frivillig_utan_nll', true);
    const ok = lakemedel.spara(a, ord(nutrition, { ...utan, dosering: '1 flaska per dag' }));
    expect(ok.ordination.ordinationsorsak).toBe('Inte angiven. Ordinationen förs inte över till Nationella läkemedelslistan.');
    expect(ok.ordination.uppfoljningsdatum).toBe(addDagar(idag(), 30));
    // Ett läkemedel som förs över till NLL kräver alltid båda, och felet säger varför.
    const e = fel(() => lakemedel.spara(a, ord(lm(db, 'N02BE01', '500 mg'), utan)));
    expect(e.extra.falt).toEqual(expect.arrayContaining(['ordinationsorsak', 'uppfoljningsdatum']));
    expect(e.message).toContain('Nationella läkemedelslistan');
    expect(konfiguration.LASTA.find(l => l.rubrik.startsWith('Ordinationsorsak')).varfor).toContain('frivilliga');
  });
});

describe('Administration som konfiguration', () => {
  test('tidboken och vårdgarantin: reglerna är parametrar med samma standardvärden, och väntelistan räknar gränsen ur det godkända värdet', async () => {
    const tidbok = await import('../src/tidbok.js');
    const db = byggSeed();
    const p = konfiguration.parametrar();
    for (const [k, n] of [['tidbok.vardgaranti_dagar', 'vardgarantiDagar'], ['tidbok.risk_dagar', 'riskDagar'], ['tidbok.egen_grans_timmar', 'egenGransTimmar'], ['tidbok.incheckning_fore_min', 'incheckningForeMin'], ['tidbok.incheckning_efter_min', 'incheckningEfterMin']]) {
      expect(p[k].standard).toBe(tidbok.DEMOREGLER[n]);
      expect(tidbok.regel(db, n)).toBe(tidbok.DEMOREGLER[n]);
    }
    expect(konfiguration.prova('tidbok.vardgaranti_dagar', 120).varfor).toContain('6 kap. 1 § hälso- och sjukvårdsförordningen');
    const post = { remiss_id: 1, tidstyp: 'nybesok', patientvald: 0, fran: '2026-01-01', mal: null };
    expect(tidbok.gransFor(post, '2026-01-02', db).datum).toBe(addDagar('2026-01-01', 90));
    andra(db, 'tidbok.vardgaranti_dagar', 60);
    andra(db, 'tidbok.egen_grans_timmar', 48);
    expect(tidbok.gransFor(post, '2026-01-02', db).datum).toBe(addDagar('2026-01-01', 60));
    expect(tidbok.gransFor({ ...post, patientvald: 1 }, '2026-01-02', db)).toBeNull();
    expect(tidbok.demoregelText(db)).toContain('räknas som 60 dagar');
    expect(tidbok.demoregelText(db)).toContain('fram till 48 timmar före');
    // Utan databas gäller standardvärdena som förut.
    expect(tidbok.gransFor(post, '2026-01-02').datum).toBe(addDagar('2026-01-01', 90));
  });

  test('avgifterna och högkostnadsskyddet: parametrar med fyra ögon som avgiften räknas ur, och sidan säger vad som inte går att ändra', async () => {
    const vardkontakt = await import('../src/vardkontakt.js');
    const db = byggSeed();
    const p = konfiguration.parametrar();
    const A = vardkontakt.AVGIFT_DEMO;
    for (const [k, v] of [['avgift.besok_kr', A.besok], ['avgift.akut_kr', A.akut], ['avgift.slutenvard_dygn_kr', A.slutenvardDygn], ['avgift.hogkostnadsskydd_kr', A.hogkostnadsskydd], ['avgift.fri_under_ar', A.friUnder], ['avgift.fri_fran_ar', A.friFran]]) expect(p[k].standard).toBe(v);
    expect(konfiguration.prova('avgift.fri_fran_ar', 90).varfor).toContain('85 år');
    expect(konfiguration.prova('avgift.besok_kr', -5).varfor).toContain('Lägsta värde är 0');
    expect(fel(() => konfiguration.foresla(db, personal(db, 'lak-kard'), { nyckel: 'avgift.besok_kr', varde: 250, motivering: 'x' }))?.status).toBe(403);
    const f = konfiguration.forhandsvisa(db, sysf(db), { nyckel: 'avgift.besok_kr', varde: 250 });
    expect(f.effekt[0]).toContain('kostar 250 kr i stället för 200 kr');
    andra(db, 'avgift.besok_kr', 250);
    andra(db, 'avgift.hogkostnadsskydd_kr', 1200);
    expect(vardkontakt.avgifter(db)).toMatchObject({ besok: 250, video: 250, hembesok: 250, hogkostnadsskydd: 1200 });
    const patient = db.query('SELECT * FROM patienter ORDER BY id').get();
    expect(vardkontakt.hogkostnadsskyddet(db, patient).grans).toBe(1200);
    const lasta = konfiguration.LASTA.map(l => l.rubrik).join(' ').toLowerCase();
    for (const ord of ['vårdrelation', 'loggen', 'förskrivning', 'min journal']) expect(lasta).toContain(ord);
  });
});
