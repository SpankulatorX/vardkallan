// Beställning och svar (runda 8, r1, Sussa 4.4.1, 4.4.2, 4.4.3 och 12.1.1.9, Sussas testfall 3.1 till 3.3). Logiken
// prövas på en sandlåda byggd vid en fast tidpunkt och med fasta tider, så att inget beror på dagens datum. API:t prövas
// för behörighet, loggning och flöde.
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { byggSeed, datumAv } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as labb from '../src/labb.js';
import * as labbFhir from '../src/labb-fhir.js';
import * as kontroller from '../src/kontroller.js';
import * as undantag from '../src/undantag.js';
import * as fhir from '../src/fhir.js';
import * as konfiguration from '../src/konfiguration.js';
import * as streckkod from '../src/streckkod.js';
import { slaSamman } from '../src/identitet.js';
import { provsvarVisas } from '../src/patientvy.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { ANALYS, ANALYSER, PAKET, LAB, ROR } from '../src/labb-katalog.js';
import { MATKOD } from '../src/kodverk.js';
import { testserver, klient, sandlada } from './hjalp.js';

const BAS = new Date('2026-11-08T09:00:00Z');
const T = (min) => new Date(BAS.getTime() + min * 60_000);
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const atk = (db, roll, pid, val = {}, handling = 'las_prover') => new Atkomst(db, pers(db, roll), pid, val, handling);
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
// Runda 11, r1: Sussas testdata läggs vid BAS, och vårdrelationen prövas mot klockan, så klockan står på BAS.
afterEach(() => aterstallKlockan());
const sussa = () => { stallKlockan(BAS); const db = byggSeed(BAS); laddaTestdata(db, pers(db, 'lak-kard'), { nu: BAS }); return db; };

describe('Beställning och svar', () => {
  test('ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes', () => {
    const db = sussa();
    const a = atk(db, 'lak-kard', 'sus19', {}, 'bestalla_prov');
    const f = labb.forslag(a, pat(db, 'sus19'), BAS);
    expect(f.paket[0]).toMatchObject({ id: 'feber', namn: 'Feber och frossa' });
    expect(f.paket[0].skal.join(' ')).toContain('feber och frossa');
    expect(f.paket[0].analyser.map(x => x.namn)).toEqual(['P-CRP', 'B-Blodstatus', 'P-Kreatinin', 'Blododling']);
    expect(f.anamnes).toBe('Inkommen med feber och frossa.');
    const r = labb.bestall(a, { paket: 'feber', analyser: f.paket[0].analyser.map(x => x.id) }, BAS);
    const b = r.bestallning;
    expect(b.nummer).toMatch(/^VKB-2026-\d{6}$/);
    expect(b.anamnes).toBe('Inkommen med feber och frossa.');
    expect(b.labb.map(l => l.kort).sort()).toEqual(['Klinisk kemi USÖ', 'Klinisk mikrobiologi']);
    // Tre rör: blododlingen först, sedan heparin och EDTA. CRP och kreatinin tas i samma rör.
    expect(b.prov.map(p => p.ror)).toEqual(['blododling', 'heparin', 'edta']);
    expect(b.prov.find(p => p.ror === 'heparin').analyser).toEqual(['P-CRP', 'P-Kreatinin']);
    expect(b.vardkontaktId).toBeTruthy();
    expect(r.text).toContain(b.nummer);
  });

  test('klinisk kemi har flera utförande laboratorier, och systemet väljer det som hör till sjukhuset', () => {
    const db = byggSeed(BAS);
    expect(labb.labFor(db, 'uso-kard-72', 'klinisk_kemi').id).toBe('lab-kem-uso');
    expect(labb.labFor(db, 'lind-med', 'klinisk_kemi').id).toBe('lab-kem-lind');
    expect(labb.labFor(db, 'kkoga-ort', 'klinisk_kemi').id).toBe('lab-kem-kkoga');
    expect(labb.labFor(db, 'vc-tybble', 'klinisk_kemi').id).toBe('lab-kem-uso');
    expect(labb.labFor(db, 'lind-med', 'mikrobiologi').id).toBe('lab-mikro-uso');
    // Ett annat laboratorium i samma disciplin kan väljas, men inte ett i en annan.
    const a = atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov');
    expect(labb.bestall(a, { analyser: ['tsh'], laboratorier: { klinisk_kemi: 'lab-kem-lind' }, kvitteraDubbletter: true }, BAS).bestallning.labb[0].id).toBe('lab-kem-lind');
    expect(() => labb.bestall(a, { analyser: ['tsh'], laboratorier: { klinisk_kemi: 'lab-mikro-uso' } }, BAS)).toThrow(/tar inte emot/);
  });

  test('beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering', () => {
    const db = byggSeed(BAS);
    const a = atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov');
    const x = labb.bestall(a, { analyser: ['tsh'], kvitteraDubbletter: true }, BAS).bestallning;
    labb.makulera(atk(db, 'lak-kard', 'p04'), labb.bestallningRad(db, x.id), { orsak: 'Fel patient vald' }, BAS);
    const y = labb.bestall(a, { analyser: ['b12'], kvitteraDubbletter: true }, BAS).bestallning;
    expect(y.nummer).not.toBe(x.nummer);
    // Även om den senaste raden raderas (som vid gallring) får nästa beställning ett nytt id.
    db.exec('DROP TRIGGER IF EXISTS labb_historik_raderas_ej');
    for (const t of ['labb_historik', 'labb_analyser', 'labb_prov']) db.query(`DELETE FROM ${t} WHERE bestallning_id = ?`).run(y.id);
    db.query('DELETE FROM labb_bestallningar WHERE id = ?').run(y.id);
    const z = labb.bestall(a, { analyser: ['folat'], kvitteraDubbletter: true }, BAS).bestallning;
    expect([x.nummer, y.nummer]).not.toContain(z.nummer);
    expect(z.id).toBeGreaterThan(y.id);
    // Etiketterna har också id som aldrig återanvänds.
    const etiketter = db.query('SELECT etikett FROM labb_prov').all().map(r => r.etikett);
    expect(new Set(etiketter).size).toBe(etiketter.length);
  });

  test('dubblettvarningen räknas bara på det läkaren får se: en dold rad på en spärrad enhet ändrar inget i svaret', () => {
    const db = byggSeed(BAS);
    const p = pat(db, 'p04');
    const svar = (val = {}) => JSON.stringify(labb.forslag(atk(db, 'lak-kard', 'p04', val, 'bestalla_prov'), p, BAS));
    const fore = svar();
    // Ett CRP som togs i går på den spärrade psykiatrin och ett på ortopeden (annan vårdenhet, kräver aktivt val).
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p04', 'uso-psyk', 'troponin', '30', 30, 'ng/L', ?)").run(T(-60).toISOString());
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p04', 'uso-ort', 'tsh', '1.5', 1.5, 'mIE/L', ?)").run(T(-60).toISOString());
    expect(svar()).toBe(fore);
    expect(svar({ andra_enheter: true })).not.toBe(fore);
    expect(labb.forslag(atk(db, 'lak-kard', 'p04', { andra_enheter: true }, 'bestalla_prov'), p, BAS).dubbletter.tsh).toContain('P-TSH togs');
    expect(JSON.stringify(labb.forslag(atk(db, 'lak-kard', 'p04', { andra_enheter: true }, 'bestalla_prov'), p, BAS))).not.toContain('30 ng/L');
    // Samtycke till spärren gör psykiatrins värde synligt, och då varnar systemet för det också.
    expect(labb.forslag(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'bestalla_prov'), p, BAS).dubbletter.troponin).toContain('Troponin');
  });

  test('ett prov som nyss är taget eller redan är beställt tas bort ur paketet med en förklaring, och en ny beställning kräver kvittens', () => {
    const db = byggSeed(BAS);
    const a = atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov');
    labb.bestall(a, { analyser: ['ntprobnp'], kvitteraDubbletter: true }, BAS);
    const f = labb.forslag(a, pat(db, 'p04'), BAS);
    const hs = f.allaPaket.find(x => x.id === 'hjartsvikt');
    expect(hs.utelamnade.find(x => x.id === 'ntprobnp').skal).toContain('är redan beställd');
    expect(hs.analyser.map(x => x.id)).not.toContain('ntprobnp');
    let fel;
    try { labb.bestall(a, { analyser: ['ntprobnp'] }, BAS); } catch (e) { fel = e; }
    expect(fel.status).toBe(409);
    expect(fel.extra.dubbletter[0]).toMatchObject({ analys: 'ntprobnp', typ: 'bestalld' });
    expect(labb.bestall(a, { analyser: ['ntprobnp'], kvitteraDubbletter: true }, BAS).bestallning.historik[0].detalj).toContain('Beställd trots varning');
  });

  test('en beställning trots dubblettvarning sparar bara analysnamnen, så att historiken inte röjer ett svar som en kollega inte får se', () => {
    const db = byggSeed(BAS);
    const tid = T(-90).toISOString();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p04', 'uso-psyk', 'tsh', '7.77', 7.77, 'mIE/L', ?)").run(tid);
    // Läkaren ser psykiatrins svar efter patientens samtycke och beställer ändå.
    const lak = atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'bestalla_prov');
    expect(labb.forslag(lak, pat(db, 'p04'), BAS).dubbletter.tsh).toContain('7,77');
    const b = labb.bestall(lak, { analyser: ['tsh'], kvitteraDubbletter: true }, BAS).bestallning;
    expect(b.historik[0].detalj).toContain('Beställd trots varning för P-TSH');
    // En kollega utan samtycke läser beställningen.
    const svar = JSON.stringify(labb.forPatient(atk(db, 'ssk-kard', 'p04'), BAS).bestallningar.find(x => x.id === b.id));
    for (const v of ['7,77', '7.77', 'Allmänpsykiatriska', 'uso-psyk', 'timmar sedan', 'sedan']) expect(svar).not.toContain(v);
    expect(JSON.stringify(db.query('SELECT detalj FROM labb_historik WHERE bestallning_id = ?').all(b.id))).not.toContain('7,77');
  });

  test('nycklar som constructor, __proto__ och toString är aldrig analyser, paket, laboratorier, kontroller eller frekvenser', () => {
    const db = byggSeed(BAS);
    const a = atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov');
    const k = atk(db, 'lak-kard', 'p04', {}, 'ordinera_kontroll');
    for (const x of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(() => labb.bestall(a, { analyser: [x], kvitteraDubbletter: true }, BAS)).toThrow(/finns inte/);
      expect(() => labb.bestall(a, { paket: x }, BAS)).toThrow(/finns inte/);
      expect(() => labb.bestall(a, { analyser: ['tsh'], laboratorier: { klinisk_kemi: x }, kvitteraDubbletter: true }, BAS)).toThrow(/tar inte emot/);
      expect(() => kontroller.ordinera(k, { kontroller: [x] }, BAS)).toThrow(/finns inte/);
      expect(() => kontroller.ordinera(k, { kontroller: ['puls'], frekvens: x }, BAS)).toThrow(/hur ofta/);
      expect(kontroller.tiderFor({ frekvens: x, kontroll: 'puls', start: BAS.toISOString(), slut: null, avslutad_tid: null }, T(-60).toISOString(), T(24 * 60).toISOString())).toEqual([]);
      expect(labb.paketAnalyser(db, x, BAS)).toEqual([]);
    }
    // En trasig rad i databasen stoppar inte listningen för andra.
    db.query("INSERT INTO kontrollordinationer (patient_id, enhet_id, kontroll, frekvens, start, ordinerad_av, skapad) VALUES ('p04', 'uso-kard-72', 'constructor', 'toString', ?, 'lak-kard', ?)").run(BAS.toISOString(), BAS.toISOString());
    expect(() => kontroller.forPatient(atk(db, 'ssk-kard', 'p04'), BAS)).not.toThrow();
    expect(() => kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), {}, BAS)).not.toThrow();
  });

  test('ett mätvärde som är undantaget från visning visas inte som svar i beställningen eller i inkorgen', () => {
    const db = byggSeed(BAS);
    const nu = new Date();
    const fore = JSON.stringify(labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), nu).provsvarAttVidimera);
    expect(fore).toContain('Kalium 6,4');
    const { andring } = undantag.foresla(db, pers(db, 'sysf'), { omfang: 'matvarde', varde: 'kalium', kanaler: ['visning'], giltigFran: datumAv(nu), motivering: 'Prov av undantag för kalium.' }, nu);
    undantag.godkann(db, pers(db, 'sysf-2'), andring.id, {}, nu);
    expect(JSON.stringify(labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), nu).provsvarAttVidimera)).not.toContain('6,4');
    const b = labb.forPatient(atk(db, 'lak-kard', 'p04'), nu).bestallningar.find(x => x.analyser.some(a => a.analys === 'kalium' && a.status === 'besvarad'));
    expect(b.analyser.find(a => a.analys === 'kalium').svar).toEqual([]);
  });

  test('signeringen prövar behörigheten först och nämner inte den ansvariga läkaren för den som inte får se beställningen', () => {
    const db = byggSeed(BAS);
    const b = db.query("SELECT * FROM labb_bestallningar WHERE patient_id = 'p04' AND pa_uppdrag = 1").get();
    let fel;
    try { labb.signera(atk(db, 'lak-ort', 'p04'), b, BAS); } catch (e) { fel = e; }
    expect(fel.status).toBe(403);
    expect(fel.message).not.toContain('Sara Lindqvist');
    expect(db.query("SELECT 1 FROM atkomstlogg WHERE personal_id = 'lak-ort' AND patient_id = 'p04' AND resultat = 'nekad'").get()).toBeTruthy();
  });

  test('sjuksköterskan och undersköterskan beställer på uppdrag av en läkare på vårdenheten, som signerar i inkorgen', () => {
    const db = sussa();
    const ssk = atk(db, 'ssk-kard', 'sus18', {}, 'bestalla_prov_uppdrag');
    const f = labb.forslag(ssk, pat(db, 'sus18'), BAS);
    expect(f.paUppdrag).toBe(true);
    expect(f.lakare.find(l => l.forvald)).toBeTruthy();
    expect(f.lakare.every(l => db.query('SELECT enhet_id FROM personal WHERE id = ?').get(l.id).enhet_id.startsWith('uso-kard'))).toBe(true);
    expect(() => labb.bestall(ssk, { analyser: ['crp'], lakareId: 'lak-vc' }, BAS)).toThrow(/läkare på din vårdenhet/);
    const b = labb.bestall(ssk, { paket: 'feber', lakareId: 'lak-kard' }, BAS).bestallning;
    expect(b).toMatchObject({ paUppdrag: true, signerad: null, ansvarig: { id: 'lak-kard' }, registreradAv: { id: 'ssk-kard' } });
    const usk = labb.bestall(atk(db, 'usk-kard', 'sus18', {}, 'bestalla_prov_uppdrag'), { analyser: ['tsh'], lakareId: 'lak-kard' }, BAS).bestallning;
    expect(usk.registreradAv.id).toBe('usk-kard');
    const ink = labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), BAS);
    expect(ink.labbAttSignera.map(x => x.nummer)).toEqual(expect.arrayContaining([b.nummer, usk.nummer]));
    // En läkare utan åtkomst får inget veta, och en läkare på vårdenheten får veta vem som ska signera.
    // Runda 8: remisserna i Sussas testdata kan ge läkaren på vårdcentralen en vårdrelation, och då krävs aktivt val i stället.
    expect(() => labb.signera(atk(db, 'lak-vc', 'sus18'), labb.bestallningRad(db, b.id), BAS)).toThrow(/vårdrelation|aktivt val/);
    expect(() => labb.signera(atk(db, 'ol-kard', 'sus18'), labb.bestallningRad(db, b.id), BAS)).toThrow(/signeras av Sara Lindqvist/);
    labb.signera(atk(db, 'lak-kard', 'sus18'), labb.bestallningRad(db, b.id), BAS);
    expect(labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), BAS).labbAttSignera.map(x => x.nummer)).not.toContain(b.nummer);
    // Fysioterapeuten beställer inga prover.
    expect(() => labb.bestall(atk(db, 'fys-kard', 'sus18', {}, 'bestalla_prov'), { analyser: ['crp'] }, BAS)).toThrow();
  });

  test('provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna', () => {
    const db = sussa();
    const lista = labb.provtagningslista(db, pers(db, 'ssk-kard'), () => ({}), {}, BAS);
    const trevis = lista.patienter.find(p => p.patient.id === 'sus04');
    const b = trevis.bestallningar[0];
    expect(b.analyser.map(a => a.namn)).toEqual(['B-Blodstatus', 'P-Kobalamin (B12)', 'P-Folat', 'U-Odling']);
    expect(b.prov.map(p => p.ror)).toEqual(['serum', 'edta', 'urin']);
    expect(b.ansvarig.id).toBe('lak-kard');
    const ssk = atk(db, 'usk-kard', 'sus04', {}, 'ta_prov');
    const r1 = labb.taProv(ssk, labb.provRad(db, b.prov[0].id), T(1));
    expect(r1.text).toContain('2 rör kvar');
    expect(r1.bestallning.prov[0].provtagen).toMatchObject({ tid: T(1).toISOString(), av: { id: 'usk-kard' } });
    labb.taProv(ssk, labb.provRad(db, b.prov[1].id), T(2));
    const r3 = labb.taProv(ssk, labb.provRad(db, b.prov[2].id), T(3));
    expect(r3.skickad).toBe(true);
    expect(r3.text).toContain('skickade till Klinisk kemi USÖ och Klinisk mikrobiologi');
    expect(r3.bestallning.status).toBe('skickad');
    expect(r3.bestallning.analyser.every(a => a.status === 'mottagen' && a.mottagen === T(3).toISOString())).toBe(true);
    expect(() => labb.taProv(ssk, labb.provRad(db, b.prov[0].id), T(4))).toThrow(/redan taget/);
    expect(() => labb.taProv(atk(db, 'fys-kard', 'sus04', {}, 'ta_prov'), labb.provRad(db, b.prov[0].id), T(4))).toThrow();
  });

  test('laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren', () => {
    const db = sussa();
    const a = atk(db, 'lak-kard', 'sus19', {}, 'bestalla_prov');
    const b = labb.bestall(a, { paket: 'feber' }, BAS).bestallning;
    for (const p of b.prov) labb.taProv(atk(db, 'ssk-kard', 'sus19', {}, 'ta_prov'), labb.provRad(db, p.id), T(5));
    expect(labb.forfallnaSvar(db, T(5 + labb.SVAR_MINUTER - 1))).toBe(0);
    expect(labb.forfallnaSvar(db, T(5 + labb.SVAR_MINUTER))).toBe(4);
    const u = labb.bestallningUt(db, labb.bestallningRad(db, b.id), pers(db, 'lak-kard'), T(30));
    expect(u.status).toBe('besvarad');
    const crp = u.analyser.find(x => x.analys === 'crp').svar[0];
    expect(crp).toMatchObject({ typ: 'crp', avvikande: 'hogt', referens: { hog: 5 } });
    expect(crp.varde).toBeGreaterThan(50);
    const blod = u.analyser.find(x => x.analys === 'blodstatus').svar.map(s => s.typ);
    expect(blod).toEqual(['hb', 'lpk', 'tpk']);
    expect(u.analyser.find(x => x.analys === 'kreatinin').svar.map(s => s.typ)).toEqual(['kreatinin', 'egfr']);
    expect(u.analyser.find(x => x.analys === 'blododling')).toMatchObject({ fynd: { kod: '3092008' }, kritisk: true });
    const mv = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE m.patient_id = ?').all('sus19');
    expect(mv.every(m => m.enhet_id === pers(db, 'lak-kard').enhet_id && m.vidimerad == null && m.tid === T(5).toISOString())).toBe(true);
    for (const m of mv) expect(MATKOD[m.typ].coding[0].system).toMatch(/npu-terminology|loinc/);
    const ink = labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), T(30));
    const rad = ink.provsvarAttVidimera.find(x => x.nummer === b.nummer);
    expect(rad).toMatchObject({ avvikande: true, kritisk: true });
    expect(rad.analyser.find(x => x.namn === 'P-CRP').text).toContain('(högt)');
    expect(labb.inkorg(db, pers(db, 'lak-vc'), () => ({}), T(30)).provsvarAttVidimera).toEqual([]);
  });

  test('ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan', () => {
    const db = byggSeed(BAS);
    const kritiska = (roll) => labb.inkorg(db, pers(db, roll), () => ({}), BAS).provsvarKritiska;
    expect(kritiska('lak-kard').map(x => x.analys)).toContain('P-Kalium');
    expect(kritiska('lak-kard')[0].text).toContain('kritiskt högt');
    expect(kritiska('ssk-kard')[0].atgard).toContain('Kontakta ansvarig läkare, Sara Lindqvist');
    expect(kritiska('usk-kard')).toEqual([]);
    expect(kritiska('lak-vc')).toEqual([]);
    expect(kritiska('ssk-vc')).toEqual([]);
    // När läkaren har vidimerat svaret larmar det inte längre.
    const b = db.query("SELECT * FROM labb_bestallningar WHERE patient_id = 'p04' AND id IN (SELECT bestallning_id FROM labb_analyser WHERE kritisk = 1)").get();
    labb.vidimera(atk(db, 'lak-kard', 'p04', {}, 'vidimera_provsvar'), b, BAS);
    expect(kritiska('ssk-kard')).toEqual([]);
  });

  test('vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter', () => {
    const db = byggSeed(BAS);
    const b = db.query("SELECT * FROM labb_bestallningar WHERE patient_id = 'p04' AND id IN (SELECT bestallning_id FROM labb_analyser WHERE status = 'besvarad')").get();
    const mv = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id JOIN labb_analyser a ON a.id = s.analys_rad_id WHERE a.bestallning_id = ?').all(b.id);
    expect(mv.some(m => provsvarVisas(m, BAS))).toBe(false);
    expect(() => labb.vidimera(atk(db, 'lak-akut', 'p04', {}, 'vidimera_provsvar'), b, BAS)).toThrow();
    const r = labb.vidimera(atk(db, 'lak-kard', 'p04', {}, 'vidimera_provsvar'), b, BAS);
    expect(r.bestallning.status).toBe('vidimerad');
    expect(r.bestallning.steg.at(-1)).toMatchObject({ steg: 'vidimerad', klar: true, text: 'Vidimerad av Sara Lindqvist' });
    const efter = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id JOIN labb_analyser a ON a.id = s.analys_rad_id WHERE a.bestallning_id = ?').all(b.id);
    expect(efter.every(m => provsvarVisas(m, BAS))).toBe(true);
    expect(() => labb.vidimera(atk(db, 'lak-kard', 'p04', {}, 'vidimera_provsvar'), labb.bestallningRad(db, b.id), BAS)).toThrow(/inga svar att vidimera/);
  });

  test('beställningen kan följas från upprättande till avslut med vem och när för varje steg', () => {
    const db = byggSeed(BAS);
    const lista = labb.forPatient(atk(db, 'lak-kard', 'p01'), BAS).bestallningar;
    const odling = lista.find(b => b.analyser.some(a => a.analys === 'urinodling'));
    expect(odling.steg.map(s => s.steg)).toEqual(['bestalld', 'provtagen', 'mottagen', 'besvarad', 'vidimerad']);
    expect(odling.steg.every(s => s.klar && s.tid)).toBe(true);
    expect(odling.historik.map(h => h.handelse)).toEqual(['Beställd', 'Provtagen', 'Skickad', 'Svar från laboratoriet', 'Vidimerad']);
    expect(odling.historik.find(h => h.handelse === 'Provtagen').av.id).toBe('ssk-kard');
    expect(odling.analyser[0]).toMatchObject({ fynd: { kod: '264868006', text: 'Ingen växt' }, text: 'Ingen växt. Slutsvar.' });
    const mak = lista.find(b => b.status === 'makulerad');
    expect(mak.makulerad).toMatchObject({ orsak: 'Dubbelbeställd, provet togs redan på akutmottagningen.', av: { id: 'lak-kard' } });
    // Historiken går inte att ändra.
    expect(() => db.query("UPDATE labb_historik SET detalj = 'x' WHERE bestallning_id = ?").run(odling.id)).toThrow(/ändras inte/);
  });

  test('makulering kräver orsak och går inte efter svar, och en analys tas bort eller läggs till innan röret är taget', () => {
    const db = byggSeed(BAS);
    const a = atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov');
    const b = labb.bestall(a, { analyser: ['tsh', 'b12', 'natrium'], kvitteraDubbletter: true }, BAS).bestallning;
    const rad = (n) => b.analyser.find(x => x.analys === n).id;
    expect(b.prov.map(p => p.ror)).toEqual(['serum', 'heparin']);
    const andrad = labb.andra(atk(db, 'lak-kard', 'p04'), labb.bestallningRad(db, b.id), { taBort: [rad('natrium')], laggTill: ['folat'] }, BAS).bestallning;
    expect(andrad.analyser.find(x => x.analys === 'natrium').status).toBe('borttagen');
    expect(andrad.prov.map(p => p.ror)).toEqual(['serum']);
    expect(andrad.prov[0].analyser).toEqual(['P-TSH', 'P-Kobalamin (B12)', 'P-Folat']);
    labb.taProv(atk(db, 'ssk-kard', 'p04', {}, 'ta_prov'), labb.provRad(db, andrad.prov[0].id), T(1));
    expect(() => labb.andra(atk(db, 'lak-kard', 'p04'), labb.bestallningRad(db, b.id), { taBort: [rad('tsh')] }, T(2))).toThrow(/redan taget/);
    expect(() => labb.makulera(atk(db, 'lak-kard', 'p04'), labb.bestallningRad(db, b.id), { orsak: '' }, T(2))).toThrow(/Skriv varför/);
    expect(() => labb.makulera(atk(db, 'lak-vc', 'p04'), labb.bestallningRad(db, b.id), { orsak: 'Fel' }, T(2))).toThrow();
    labb.forfallnaSvar(db, T(60));
    expect(() => labb.makulera(atk(db, 'lak-kard', 'p04'), labb.bestallningRad(db, b.id), { orsak: 'Behövs inte' }, T(61))).toThrow(/redan svarat/);
  });

  test('ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten', () => {
    const db = byggSeed(BAS);
    const b = db.query("SELECT * FROM labb_bestallningar WHERE patient_id = 'p04' AND id IN (SELECT bestallning_id FROM labb_analyser WHERE kritisk = 1)").get();
    expect(() => labb.overlat(atk(db, 'lak-kard', 'p04'), b, { lakareId: 'lak-vc' }, BAS)).toThrow(/ingen vårdrelation/);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p04', 'uso-akut', 'akut', ?, 'Akutrum 1', 'Bröstsmärta')").run(T(-30).toISOString());
    const r = labb.overlat(atk(db, 'lak-kard', 'p04'), b, { lakareId: 'lak-akut', orsak: 'Patienten vårdas på akuten' }, BAS);
    expect(r.bestallning.ansvarig.id).toBe('lak-akut');
    expect(r.bestallning.historik.at(-1)).toMatchObject({ handelse: 'Ansvaret överlåtet från Sara Lindqvist till Erik Nyström', detalj: 'Patienten vårdas på akuten', av: { id: 'lak-kard' } });
    // Beställningen hör till kardiologen: utan aktivt val ser akutläkaren att svaren väntar, men inte svaren.
    const utan = labb.inkorg(db, pers(db, 'lak-akut'), () => ({}), BAS).provsvarAttVidimera.find(x => x.nummer === b.nummer);
    expect(utan).toMatchObject({ kraverVal: true, analyser: [] });
    expect(JSON.stringify(utan)).not.toContain('6,4');
    const med = labb.inkorg(db, pers(db, 'lak-akut'), () => ({ andra_enheter: true }), BAS).provsvarAttVidimera.find(x => x.nummer === b.nummer);
    expect(med.analyser.map(x => x.namn)).toContain('P-Kalium');
    labb.vidimera(atk(db, 'lak-akut', 'p04', { andra_enheter: true }, 'vidimera_provsvar'), labb.bestallningRad(db, b.id), BAS);
    expect(labb.inkorg(db, pers(db, 'lak-kard'), () => ({}), BAS).provsvarAttVidimera.map(x => x.nummer)).not.toContain(b.nummer);
  });

  test('etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val', () => {
    const db = byggSeed(BAS);
    const b = labb.bestall(atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov'), { analyser: ['crp', 'blodstatus', 'urinodling'], anamnes: 'Sveda.', kvitteraDubbletter: true }, BAS).bestallning;
    const e = labb.etiketter(atk(db, 'ssk-kard', 'p04'), labb.bestallningRad(db, b.id), BAS);
    expect(e.etiketter.map(x => x.ror)).toEqual(['Litiumheparinrör med gel', 'EDTA-rör', 'Urinodlingsrör med borsyra']);
    expect(e.etiketter[0]).toMatchObject({ analyser: ['P-CRP'], lab: 'Klinisk kemi USÖ' });
    expect(e.patient.namn).toBe('Elin Sandberg');
    expect(streckkod.streck(e.etiketter[0].etikett).streck.length).toBeGreaterThan(10);
    // Patient 3 har skyddade personuppgifter.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p03', 'uso-kard-mott', 'oppenvard', ?, 'Mottagning', 'Hjärtklappning')").run(T(-10).toISOString());
    const s = labb.bestall(atk(db, 'lak-kard', 'p03', {}, 'bestalla_prov'), { analyser: ['tsh'], kvitteraDubbletter: true }, BAS).bestallning;
    const dold = labb.etiketter(atk(db, 'ssk-kard', 'p03'), labb.bestallningRad(db, s.id), BAS);
    expect(dold).toMatchObject({ skyddad: true, patient: { namn: 'Skyddad identitet' } });
    expect(dold.patient.personnummer).toContain('****');
    expect(JSON.stringify(dold)).not.toContain(pat(db, 'p03').efternamn);
    if (pat(db, 'p03').adress) expect(JSON.stringify(dold)).not.toContain(pat(db, 'p03').adress);
    const visad = labb.etiketter(atk(db, 'ssk-kard', 'p03', { visa_identitet: true }), labb.bestallningRad(db, s.id), BAS);
    expect(visad.patient.namn).toBe(`${pat(db, 'p03').fornamn} ${pat(db, 'p03').efternamn}`);
  });

  test('provtagningsanvisningen har rören i provtagningsordning och förberedelserna för patienten', () => {
    const db = byggSeed(BAS);
    const b = labb.bestall(atk(db, 'lak-kard', 'p04', {}, 'bestalla_prov'), { analyser: ['glukos', 'pk', 'blododling', 'blodstatus'], anamnes: 'Feber.', kvitteraDubbletter: true }, BAS).bestallning;
    const a = labb.anvisning(atk(db, 'ssk-kard', 'p04'), labb.bestallningRad(db, b.id), BAS);
    expect(a.steg.map(s => s.ror)).toEqual(['Blododlingsflaskor', 'Citratrör', 'Litiumheparinrör med gel', 'EDTA-rör']);
    expect(a.forbered.join(' ')).toContain('fastande');
    expect(a.forbered.join(' ')).toContain('före antibiotika');
  });

  test('beställningarna följer med när två journaler slås samman, så att allt för patienten visas samlat', () => {
    const db = byggSeed(BAS);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p17', 'uso-kard-mott', 'oppenvard', ?, 'Mottagning', 'Bröstsmärta')").run(T(-10).toISOString());
    const b = labb.bestall(atk(db, 'lak-kard', 'p17', {}, 'bestalla_prov'), { analyser: ['troponin'] }, BAS).bestallning;
    labb.taProv(atk(db, 'ssk-kard', 'p17', {}, 'ta_prov'), labb.provRad(db, b.prov[0].id), T(1));
    labb.forfallnaSvar(db, T(60));
    slaSamman(db, { fran: 'p17', till: 'p16', personal: pers(db, 'adm-kard'), grund: 'samma_namn_fodd' });
    for (const t of ['labb_bestallningar', 'labb_prov', 'labb_analyser', 'labb_svar', 'labb_historik']) expect(db.query(`SELECT count(*) AS n FROM ${t} WHERE patient_id = 'p17'`).get().n).toBe(0);
    const u = labb.forPatient(atk(db, 'lak-kard', 'p16'), T(61)).bestallningar.find(x => x.nummer === b.nummer);
    expect(u.analyser[0].svar[0].typ).toBe('troponin');
  });

  test('paketens innehåll och laboratoriets svarstid ändras på ett ställe och slår igenom i förslagen och svaren', () => {
    const db = byggSeed(BAS);
    const p = konfiguration.parametrar();
    expect(p['labb.svar_minuter'].standard).toBe(labb.SVAR_MINUTER);
    expect(p['labb.provtagning_larm_timmar'].standard).toBe(labb.LARM_TIMMAR);
    for (const pk of PAKET) expect(labb.paketAnalyser(db, pk.id, BAS)).toEqual(pk.analyser);
    expect(konfiguration.prova('labb.paket.feber', 'P-CRP, P-Okänd').varfor).toContain('finns inte i analyskatalogen');
    expect(konfiguration.prova('labb.paket.feber', 'P-CRP, p-crp').varfor).toContain('två gånger');
    const ny = konfiguration.foresla(db, pers(db, 'sysf'), { nyckel: 'labb.paket.feber', varde: 'p-crp, B-Blodstatus, Blododling, U-Odling', motivering: 'Urinodling vid feber enligt nytt vårdprogram.' }, BAS);
    konfiguration.godkann(db, pers(db, 'sysf-2'), ny.andring.id, {}, BAS);
    const imorgon = T(24 * 60 + 60);
    expect(labb.paketAnalyser(db, 'feber', imorgon)).toEqual(['crp', 'blodstatus', 'blododling', 'urinodling']);
    expect(labb.paketAnalyser(db, 'feber', BAS)).toEqual(PAKET.find(x => x.id === 'feber').analyser);
    expect(konfiguration.oversikt(db, pers(db, 'sysf'), BAS).grupper.find(g => g.id === 'bestallning').parametrar.map(x => x.nyckel)).toEqual(expect.arrayContaining(['labb.svar_minuter', 'labb.paket.feber']));
  });

  test('uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter', () => {
    const db = byggSeed(BAS);
    const u = labb.uppfoljning(db, pers(db, 'lak-kard'), { dagar: 30 }, BAS);
    expect(u.antal).toBeGreaterThanOrEqual(5);
    expect(u.makulerade).toBe(1);
    expect(u.paUppdrag).toBe(1);
    expect(u.kritiska).toBe(1);
    expect(u.ledtider.tillSvarMin).toBe(30);
    const text = JSON.stringify(u);
    for (const p of [pat(db, 'p04'), pat(db, 'p01')]) for (const v of [p.id, p.efternamn, p.personnummer]) expect(text).not.toContain(v);
    expect(() => labb.uppfoljning(db, pers(db, 'usk-kard'), {}, BAS)).toThrow();
  });

  test('katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser', () => {
    const db = byggSeed(BAS);
    for (const a of ANALYSER) {
      expect(ROR[a.ror]).toBeTruthy();
      expect(LAB[labb.labFor(db, 'uso-kard', a.disciplin).id].disciplin).toBe(a.disciplin);
      for (const typ of a.matvarden ?? []) expect(MATKOD[typ]).toBeTruthy();
    }
    for (const pk of PAKET) for (const id of pk.analyser) expect(ANALYS[id]).toBeTruthy();
    expect(MATKOD.lpk.coding[0].code).toBe('NPU02593');
    expect(MATKOD.sr.coding[0].code).toBe('NPU03404');
  });
});

describe('Streckkod och etikett', () => {
  test('Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar', () => {
    expect(streckkod.MONSTERTABELL.length).toBe(107);
    for (const m of streckkod.MONSTERTABELL.slice(0, 106)) expect([...m].reduce((s, x) => s + Number(x), 0)).toBe(11);
    expect([...streckkod.MONSTERTABELL[106]].reduce((s, x) => s + Number(x), 0)).toBe(13);
    expect(new Set(streckkod.MONSTERTABELL).size).toBe(107);
    // PJJ123C: (104 + 48 + 2*42 + 3*42 + 4*17 + 5*18 + 6*19 + 7*35) mod 103 = 55.
    expect(streckkod.kontrollsiffra(streckkod.varden('PJJ123C'))).toBe(55);
    const s = streckkod.streck('VKP00000001');
    expect(s.bredd).toBe(10 + 11 * (1 + 11 + 1) + 13 + 10);
    expect(streckkod.svg('VKP00000001')).toContain('aria-label="Streckkod VKP00000001"');
    expect(() => streckkod.varden('å')).toThrow();
  });

  test('etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare', async () => {
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('ssk-kard');
      const b = sandlada(app, k).db.query("SELECT id, nummer FROM labb_bestallningar WHERE patient_id = 'p04' AND id IN (SELECT bestallning_id FROM labb_prov WHERE provtagen_tid IS NULL)").get();
      const res = await fetch(`${app.url}/api/labb/${b.id}/etiketter.pdf`, { headers: { Cookie: k.kaka() } });
      expect(res.headers.get('content-type')).toBe('application/pdf');
      const text = Buffer.from(await res.arrayBuffer()).toString('latin1');
      expect(text.startsWith('%PDF-1.4')).toBe(true);
      expect(text).toContain('/Count 2');
      expect(text).toContain(' re f');
      expect(text).toContain(b.nummer);
      const a4 = Buffer.from(await (await fetch(`${app.url}/api/labb/${b.id}/etiketter.pdf?format=a4`, { headers: { Cookie: k.kaka() } })).arrayBuffer()).toString('latin1');
      expect(a4).toContain('/Count 1');
      expect(a4).toContain('/MediaBox [0 0 595.00 842.00]');
      const logg = sandlada(app, k).db.query("SELECT * FROM atkomstlogg WHERE resurs = ?").get(`labb:etiketter:${b.nummer}`);
      expect(logg).toMatchObject({ patient_id: 'p04', personal_id: 'ssk-kard', handling: 'las_prover' });
    } finally { app.stopp(); }
  });
});

describe('FHIR för beställning och svar', () => {
  const fraga = (db, roll, vag, val = {}) => fhir.hantera({ db, personal: pers(db, roll), valFor: (p) => val[p] ?? {}, url: new URL(`http://x${vag}`), base: 'http://x' });
  test('varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena', () => {
    const db = byggSeed(BAS);
    const sr = fraga(db, 'lak-kard', '/fhir/ServiceRequest?patient=p04').body.entry.map(e => e.resource).filter(r => r.id.startsWith('labb-'));
    expect(sr.length).toBeGreaterThanOrEqual(5);
    expect(sr[0]).toMatchObject({ intent: 'order', requisition: { system: labbFhir.BESTALLNING_SYSTEM }, category: [{ coding: [{ code: '108252007' }] }] });
    const kalium = sr.find(r => r.code.text === 'P-Kalium');
    expect(kalium.code.coding[0]).toEqual({ system: 'http://npu-terminology.org', code: 'NPU03230' });
    expect(kalium.status).toBe('completed');
    const sp = fraga(db, 'lak-kard', '/fhir/Specimen?patient=p04').body.entry.map(e => e.resource);
    expect(sp.some(s => s.collection?.collectedDateTime && s.identifier[0].value.startsWith('VKP'))).toBe(true);
    const dr = fraga(db, 'lak-kard', '/fhir/DiagnosticReport?patient=p04').body.entry.map(e => e.resource);
    const svar = dr.find(r => r.status === 'final');
    expect(svar).toMatchObject({ category: [{ coding: [{ code: 'LAB' }] }], code: { coding: [{ code: '11502-2' }] } });
    expect(svar.result.length).toBe(2);
    const obs = fraga(db, 'lak-kard', `/${svar.result[0].reference.replace(/^/, 'fhir/')}`).body;
    expect(obs.basedOn[0].reference).toMatch(/^ServiceRequest\/labb-\d+$/);
    expect(obs.interpretation[0].coding[0].code).toMatch(/^(HH|H|N|L|LL)$/);
    expect(fraga(db, 'lak-kard', `/fhir/${obs.basedOn[0].reference}`).body.id).toBe(obs.basedOn[0].reference.split('/')[1]);
    const odling = fraga(db, 'lak-kard', '/fhir/DiagnosticReport?patient=p01').body.entry.map(e => e.resource).find(r => r.conclusionCode);
    expect(odling).toMatchObject({ category: [{ coding: [{ code: 'MB' }] }], conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '264868006' }] }] });
    // Undersköterskan når labbeställningarna genom kategorin, utan att läsa remisserna.
    expect(fraga(db, 'usk-kard', '/fhir/ServiceRequest?patient=p04&category=108252007').body.entry.length).toBe(sr.length);
  });

  test('samma behörighet som i gränssnittet: en annan vårdenhets beställning kräver aktivt val och en spärrad syns inte alls', () => {
    const db = byggSeed(BAS);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p04', 'vc-tybble', 'oppenvard', ?, 'Mottagning', 'Kontroll')").run(T(-30).toISOString());
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p04', 'uso-psyk', 'oppenvard', ?, 'Mottagning', 'Samtal')").run(T(-30).toISOString());
    const vc = labb.bestall(atk(db, 'lak-vc', 'p04', {}, 'bestalla_prov'), { analyser: ['tsh'] }, BAS).bestallning;
    const psyk = labb.bestall(atk(db, 'lak-psyk', 'p04', {}, 'bestalla_prov'), { analyser: ['b12'] }, BAS).bestallning;
    const nummer = (val) => fraga(db, 'lak-kard', '/fhir/ServiceRequest?patient=p04&category=laboratory', { p04: val }).body.entry.map(e => e.resource.requisition.value);
    expect(nummer({})).not.toContain(vc.nummer);
    expect(nummer({ andra_enheter: true })).toContain(vc.nummer);
    expect(nummer({ andra_enheter: true })).not.toContain(psyk.nummer);
    const id = `labb-${psyk.analyser[0].id}`;
    expect(() => fraga(db, 'lak-kard', `/fhir/ServiceRequest/${id}`, { p04: { andra_enheter: true, nodatkomst: true } })).toThrow();
    const ui = (val) => JSON.stringify(labb.forPatient(atk(db, 'lak-kard', 'p04', val), BAS));
    expect(ui({ andra_enheter: true })).not.toContain(psyk.nummer);
    expect(ui({ andra_enheter: true, samtycke_sparr: true })).toContain(psyk.nummer);
  });
});

describe('API för beställning och svar', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen', async () => {
    const lak = klient(app);
    await lak.logga('lak-kard');
    const f = await lak.get('/api/patient/p04/prover/forslag');
    expect(f.status).toBe(200);
    const b = await lak.post('/api/patient/p04/prover', { analyser: ['tsh', 'b12'], kvitteraDubbletter: true });
    expect(b.status).toBe(201);
    const id = b.data.bestallning.id;
    const db = sandlada(app, lak).db;
    expect(db.query("SELECT 1 FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = 'p04' AND handling = 'bestalla_prov' AND resultat = 'tillaten'").get()).toBeTruthy();
    const prov = b.data.bestallning.prov[0].id;
    const tagen = await lak.post(`/api/labb/prov/${prov}/tagen`, {});
    expect(tagen.data.skickad).toBe(true);
    const svar = await lak.post(`/api/labb/${id}/simulera-svar`, {});
    expect(svar.data.text).toContain('simulerat');
    const ink = await lak.get('/api/inkorg');
    const rad = ink.data.provsvarAttVidimera.find(x => x.bestallningId === id);
    expect(rad.patient.id).toBe('p04');
    const v = await lak.post(`/api/labb/${id}/vidimera`, {});
    expect(v.data.bestallning.status).toBe('vidimerad');
    const tab = await lak.get('/api/patient/p04/prover');
    expect(tab.data.bestallningar.find(x => x.id === id).status).toBe('vidimerad');
    expect(tab.data.kontroller.kontroller.length).toBeGreaterThan(0);
  });

  test('provtagningslistan visar vårdenhetens prover att ta, med skyddad identitet maskerad, och loggar varje patient', async () => {
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    const db = sandlada(app, ssk).db;
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p03', 'uso-kard-mott', 'oppenvard', ?, 'Mottagning', 'Hjärtklappning')").run(new Date(Date.now() - 600_000).toISOString());
    labb.bestall(atk(db, 'lak-kard', 'p03', {}, 'bestalla_prov'), { analyser: ['tsh'], kvitteraDubbletter: true });
    const r = await ssk.get('/api/provtagning');
    expect(r.status).toBe(200);
    const p03 = r.data.patienter.find(p => p.patient.id === 'p03');
    expect(p03.patient.namn).toBe('Skyddad identitet');
    expect(JSON.stringify(p03)).not.toContain(pat(db, 'p03').efternamn);
    expect(r.data.patienter.find(p => p.patient.id === 'p04').kvar).toBeGreaterThan(0);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'ssk-kard' AND handling = 'ta_prov' AND resurs LIKE 'provtagning:%'").get().n).toBeGreaterThanOrEqual(2);
    const fys = klient(app);
    await fys.logga('fys-kard');
    expect((await fys.get('/api/provtagning')).status).toBe(403);
  });

  test('en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen', async () => {
    const lak = klient(app);
    await lak.logga('lak-kard');
    const db = sandlada(app, lak).db;
    const fore = JSON.stringify(Object.fromEntries(Object.entries((await lak.get('/api/inkorg')).data).filter(([k]) => /provsvar|labb/.test(k))));
    // Psykiatrin, som patienten har spärrat mot andra vårdenheter, beställer och får svar och överlåter ansvaret.
    const psyk = atk(db, 'lak-psyk', 'p04', {}, 'bestalla_prov');
    const b = labb.bestall(psyk, { analyser: ['b12'], kvitteraDubbletter: true }).bestallning;
    labb.taProv(atk(db, 'lak-psyk', 'p04', {}, 'ta_prov'), labb.provRad(db, b.prov[0].id));
    labb.simuleraSvar(atk(db, 'lak-psyk', 'p04'), labb.bestallningRad(db, b.id));
    labb.overlat(atk(db, 'lak-psyk', 'p04'), labb.bestallningRad(db, b.id), { lakareId: 'lak-kard' });
    const efter = JSON.stringify(Object.fromEntries(Object.entries((await lak.get('/api/inkorg')).data).filter(([k]) => /provsvar|labb/.test(k))));
    expect(efter).toBe(fore);
    expect(efter).not.toContain(b.nummer);
  });
});
