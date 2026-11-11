// Runda 10, r5: processtöd med kunskapsstöd och kunskapsgenererande stöd, kollegakontroll av högriskläkemedel,
// överföring av läkemedelsberättelsen, vaccinationsprogrammen, sammanhållen journalföring och flödet på
// akutmottagningen (Sussa 3.2.1, 3.2.2.3, 3.2.3.5 och 3.5.1). Testnamnen finns i src/sussa/runda10-r5-tester.js.
// Klockan styrs med setSystemTime där testet beror på tiden, och testet räknar bara de rader det själv skapar.
import { describe, test, expect, afterEach, afterAll, beforeAll } from 'bun:test';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { byggSeed, idag, addDagar, lokalTid, iso } from '../src/db.js';
import { T } from '../src/sussa/runda10-r5-tester.js';
import * as kunskapsstod from '../src/kunskapsstod.js';
import * as utfallsstod from '../src/utfallsstod.js';
import * as hogrisk from '../src/hogriskkontroll.js';
import * as administrering from '../src/administrering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as stod from '../src/lakemedelsstod.js';
import * as mallar from '../src/ordinationsmallar.js';
import * as vardplan from '../src/vardplan.js';
import * as konfiguration from '../src/konfiguration.js';
import * as vaccinationsprogram from '../src/vaccinationsprogram.js';
import { UTSATTNINGSREGLER } from '../src/lakemedelsregler.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  stallKlockan(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => aterstallKlockan());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const DASH = /[–—…]/;

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

// En ordination med tillägg (spädning och administrationssätt), som i lakemedel-r9.test.js.
function ordinera(db, pid, inp, personalId = 'lak-kard') {
  const a = atk(db, personalId, pid, {}, 'ordinera');
  const { kropp, extra } = stod.forbered(db, inp);
  const t = mallar.valideraTillagg(db, kropp);
  const ut = lakemedel.spara(a, { start: idag(), uppfoljningsdatum: addDagar(idag(), 7), ordinationsorsak: 'Test', ...kropp });
  mallar.sparaTillagg(db, ut.ordination.id, t);
  stod.sparaTillagg(db, ut.ordination.id, extra);
  return lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id));
}
const ssk = (db, pid, id = 'ssk-kard', handling = 'ge_lakemedel', val = {}) => atk(db, id, pid, val, handling);
const egfr = (db, pid, enhet, varde, tid = iso()) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES (?, ?, 'egfr', ?, ?, 'mL/min/1,73 m²', ?, 'lak-kard')").run(pid, enhet, String(varde), varde, tid);

describe('Kunskapsstöd', () => {
  test(T.vardforlopp.split(' > ')[1], () => {
    const db = byggSeed();
    const lak = atk(db, 'lak-kard', 'p01', {}, 'vardplan');
    const [, plan] = vardplan.skapa(lak, { mall: 'hjartsvikt' });
    expect(plan.vardforlopp).toMatchObject({ rubrik: 'Vårdförlopp vid hjärtsvikt', kalla: kunskapsstod.KALLOR.hjartsvikt, demomarkning: kunskapsstod.DEMOMARKNING });
    // Vikten finns redan i mätvärdena, så systemet ser att första steget har börjat. Resten är kvar.
    expect(plan.vardforlopp.steg.map(s => s.status)).toEqual(['pagar', 'kvar', 'kvar', 'kvar']);
    expect(plan.vardforlopp.nasta.text).toContain('Nästa steg: bedöm vätskebalansen');
    // Varje steg har riktlinjens text, och åtgärderna i steget pekar på planens egna åtgärder.
    for (const s of plan.vardforlopp.steg) { expect(s.text.length).toBeGreaterThan(20); expect(s.atgarder.length).toBeGreaterThan(0); }
    // När vikten och vätskelistan är registrerade är första steget klart, och nästa steg är läkemedlen.
    const usk = atk(db, 'usk-kard', 'p01', {}, 'vardplan_atgard');
    const sskA = atk(db, 'ssk-kard', 'p01', {}, 'vardplan_atgard');
    const rad = vardplan.hamtaPlan(db, plan.id);
    vardplan.andra(usk, rad, 'utfort', { atgard: plan.atgarder.find(x => x.text.startsWith('Daglig vikt')).id });
    const efter = vardplan.andra(sskA, rad, 'utfort', { atgard: plan.atgarder.find(x => x.text.startsWith('Vätskelista')).id });
    expect(efter.vardforlopp.steg[0].status).toBe('klar');
    expect(efter.vardforlopp.nasta.rubrik).toBe('Optimera läkemedelsbehandlingen');
    expect(efter.vardforlopp.nasta.text).toContain('SGLT2-hämmare');
    // En individuell plan utan mall har inget vårdförlopp.
    const [, egen] = vardplan.skapa(lak, { rubrik: 'Egen plan', mal: ['Mål'], atgarder: [{ text: 'Åtgärd', ansvarig: 'sjukskoterska' }] });
    expect(egen.vardforlopp).toBeNull();
    // Inga tankstreck eller ellipser i kunskapstexterna.
    expect(JSON.stringify(kunskapsstod.VARDFORLOPP)).not.toMatch(DASH);
  });

  test(T.forslagKunskap.split(' > ')[1], () => {
    const db = byggSeed();
    const f = vardplan.forPatient(atk(db, 'lak-kard', 'p01', {}, 'las_vardplan')).forslag.find(x => x.mall === 'hjartsvikt');
    expect(f.vardforlopp).toMatchObject({ rubrik: 'Vårdförlopp vid hjärtsvikt', kalla: kunskapsstod.KALLOR.hjartsvikt });
    expect(f.vardforlopp.steg).toHaveLength(4);
    expect(f.vardforlopp.sammanfattning).toContain('optimeras');
    // Alla mallar har ett vårdförlopp med källa.
    for (const m of vardplan.MALLAR) expect(kunskapsstod.VARDFORLOPP[m.id]?.kalla).toBeTruthy();
  });

  test(T.varningKunskap.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    // Ordination: warfarin och NSAID.
    const k = lakemedel.kontroll(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), { lakemedelId: 'VK-NPL-0027' }).varningar;
    const w = k.find(v => v.regel === 'warfarin_nsaid');
    expect(w.kunskap).toMatchObject({ kalla: kunskapsstod.KALLOR.smpc, demomarkning: kunskapsstod.DEMOMARKNING });
    expect(w.kunskap.varfor).toContain('blödning');
    expect(w.kunskap.vadGora).toContain('paracetamol');
    // Överkänslighet mot penicilliner.
    const pen = lakemedel.kontroll(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), { lakemedelId: 'VK-NPL-0033' }).varningar.find(v => v.regel === 'overkanslighet');
    expect(pen.kunskap.vadGora).toContain('annan grupp');
    // Administrering: en dos utan ordination.
    const adm = administrering.kontroll(ssk(db, 'p01'), { lakemedelId: 'VK-NPL-0026' }).varningar.find(v => v.regel === 'utan_ordination');
    expect(adm.kunskap.vadGora).toContain('ordinera');
    expect(adm.kunskap.kalla).toBe(kunskapsstod.KALLOR.hsl);
    // Utsättning: förslaget i regeln blir vad användaren kan göra.
    const betab = lakemedel.utsattningskontroll(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.atc LIKE 'C07%' AND o.status = 'aktiv'").get()).varningar[0];
    expect(betab.kunskap.vadGora).toBe(UTSATTNINGSREGLER.find(r => r.regel === 'betablockerare').forslag);
    // Alla regler i läkemedelshanteringen har en kunskapstext utan tankstreck.
    for (const r of ['overkanslighet', 'dubbel_substans', 'dubbel_grupp', 'dubbel_antikoagulantia', 'warfarin_nsaid', 'metformin_egfr', 'dubbel_dos', 'for_tidig', 'max_per_dygn', 'utan_ordination', 'avvikande_dos']) {
      expect(kunskapsstod.VARNINGAR[r].varfor.length).toBeGreaterThan(20);
      expect(kunskapsstod.VARNINGAR[r].vadGora.length).toBeGreaterThan(10);
    }
    expect(JSON.stringify(kunskapsstod.VARNINGAR)).not.toMatch(DASH);
  });

  test(T.lmInfo.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    egfr(s.db, 'p01', 'uso-kard-72', 38);
    const r = await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0020');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ lakemedel: { namn: 'Metformin Sandoz', atc: 'A10BA02' }, finns: true, kalla: kunskapsstod.KALLOR.smpc, simulerad: kunskapsstod.SIMULERAD_KATALOG, demomarkning: kunskapsstod.DEMOMARKNING });
    expect(r.data.egenskaper).toContain('glukosbildningen');
    expect(r.data.njurfunktion).toMatchObject({ egfr: 38, niva: 'observera' });
    expect(r.data.njurfunktion.patient).toBe('Patientens senaste eGFR är 38. Vid eGFR 30 till 44 är högsta dygnsdos 1 000 mg. Börja inte behandlingen vid eGFR i det intervallet.');
    // Patienten är över 75: NSAID är olämpligt för äldre, och systemet säger det med patientens ålder.
    const ibu = await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0027');
    expect(ibu.data.aldre.olamplig).toBe(true);
    expect(ibu.data.aldre.patient).toMatch(/^Patienten är \d+ år\. NSAID ökar risken/);
    expect(ibu.data.njurfunktion.niva).toBe('observera');
    // Zopiklon har ingen egen äldretext i katalogen och får regeln från läkemedelsgenomgången.
    const zop = await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0044');
    expect(zop.data.aldre.olamplig).toBe(true);
    // Ett läkemedel som saknas i den simulerade katalogen säger det.
    const lev = await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0024');
    expect(lev.data.finns).toBe(false);
    expect(lev.data.egenskaper).toContain('Läs produktresumén');
    expect((await k.get('/api/patient/p01/lakemedelsinfo/FINNS-INTE')).status).toBe(404);
    // Uppslaget loggas på patienten.
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = 'lakemedelsinfo:VK-NPL-0020'").get().n).toBe(1);
    expect(JSON.stringify(kunskapsstod.SUBSTANSER)).not.toMatch(DASH);
  });

  test(T.lmInfoBehorighet.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    // Elin Sandberg (p04) har en spärr på psykiatrin. Ett eGFR därifrån räknas inte utan samtycke.
    egfr(s.db, 'p04', 'uso-psyk', 22);
    const r = await k.get('/api/patient/p04/lakemedelsinfo/VK-NPL-0020');
    expect(r.data.njurfunktion.egfr).toBeNull();
    expect(JSON.stringify(r.data)).not.toContain('22');
    egfr(s.db, 'p04', 'uso-kard-72', 52);
    expect((await k.get('/api/patient/p04/lakemedelsinfo/VK-NPL-0020')).data.njurfunktion.egfr).toBe(52);
    // Vårdadministratören läser inte läkemedel.
    const adm = klient(app);
    await adm.logga('adm-kard');
    expect((await adm.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0020')).status).toBe(403);
  });

  test(T.news2.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await k.get('/api/patient/p01/matvarden');
    expect(r.data.news2.kunskap).toMatchObject({ rubrik: 'Vad NEWS2 betyder', kalla: kunskapsstod.KALLOR.news2 });
    expect(r.data.news2.kunskap.text).toContain('7 poäng eller mer');
  });
});

describe('Kunskapsgenererande stöd', () => {
  // Sätter upp och avslutar en plan ur mallen med alla mål uppnådda eller inte.
  function avslutad(db, pid, mall, nadde, personalId = 'lak-kard') {
    const a = atk(db, personalId, pid, {}, 'vardplan');
    const [, p] = vardplan.skapa(a, { mall });
    const rad = vardplan.hamtaPlan(db, p.id);
    vardplan.andra(a, rad, 'uppfoljning', { mal: Object.fromEntries(p.mal.map(m => [m.id, nadde ? 'uppnatt' : 'ej_uppnatt'])) });
    vardplan.andra(a, vardplan.hamtaPlan(db, p.id), 'avsluta', {});
    return p.id;
  }

  test(T.utfallPlan.split(' > ')[1], () => {
    const db = byggSeed();
    const lak = personal(db, 'lak-kard');
    const fore = utfallsstod.vardplan(db, lak, 'diabetes');
    expect(fore.visas).toBe(false);
    for (let i = 0; i < 5; i++) avslutad(db, 'p01', 'diabetes', true);
    for (let i = 0; i < 5; i++) avslutad(db, 'p01', 'diabetes', false);
    const u = utfallsstod.vardplan(db, lak, 'diabetes');
    expect(u).toMatchObject({ visas: true, x: 5, n: 10, procent: 50, medianDagar: 0, demomarkning: utfallsstod.DEMOMARKNING });
    expect(u.text).toBe('På Kardiologiska kliniken USÖ nådde 5 av 10 avslutade planer ur standardplanen alla mål vid den sista uppföljningen (50 procent). Planerna pågick i median 0 dagar.');
    // Planen och förslaget visar utfallet.
    const a = atk(db, 'lak-kard', 'p01', {}, 'vardplan');
    const [, ny] = vardplan.skapa(a, { mall: 'diabetes' });
    expect(ny.utfall).toMatchObject({ visas: true, n: 10 });
  });

  test(T.utfallSkydd.split(' > ')[1], () => {
    const db = byggSeed();
    const lak = personal(db, 'lak-kard');
    // Sex som nådde målen och en som inte gjorde det: ettan kan inte räknas fram, så inget tal visas.
    for (let i = 0; i < 6; i++) avslutad(db, 'p01', 'trycksar', true);
    avslutad(db, 'p01', 'trycksar', false);
    const u = utfallsstod.vardplan(db, lak, 'trycksar');
    expect(u.visas).toBe(false);
    expect(u.x).toBeUndefined();
    expect(u.text).toContain('för litet');
    expect(JSON.stringify(u)).not.toMatch(/\b6\b|\b1\b/);
    // Planer på en annan vårdenhet räknas inte för kardiologen.
    for (let i = 0; i < 5; i++) avslutad(db, 'p01', 'fall', true, 'lak-akut');
    expect(utfallsstod.vardplan(db, lak, 'fall').visas).toBe(false);
    expect(utfallsstod.vardplan(db, personal(db, 'lak-akut'), 'fall')).toMatchObject({ visas: true, x: 5, n: 5 });
    // Andelen visas bara när båda grupperna är 0 eller minst 5.
    expect(utfallsstod.andel(3, 10).visas).toBe(false);
    expect(utfallsstod.andel(0, 5)).toMatchObject({ visas: true, procent: 0 });
    expect(utfallsstod.andel(4, 4).visas).toBe(false);
  });

  test(T.utfallVarning.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    const r = await k.post('/api/patient/p01/lakemedel/kontroll', { lakemedelId: 'VK-NPL-0027' });
    const w = r.data.varningar.find(v => v.regel === 'warfarin_nsaid');
    expect(w.utfall).toMatchObject({ typ: 'varning', regel: 'warfarin_nsaid', visas: true, kvitterade: 0 });
    // Fem ordinationer med kvitterad varning på vårdenheten det senaste året.
    for (let i = 0; i < 5; i++) s.db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad, kvitterade_varningar) VALUES ('p01', 'uso-kard-72', 'VK-NPL-0027', '1 tablett', 'staende', 'Smärta', ?, ?, 'lak-kard', ?, ?)")
      .run(addDagar(idag(), 7), idag(), iso(), JSON.stringify([{ regel: 'warfarin_nsaid', motivering: 'Kort behandling' }]));
    const r2 = await k.post('/api/patient/p01/lakemedel/kontroll', { lakemedelId: 'VK-NPL-0027' });
    const u = r2.data.varningar.find(v => v.regel === 'warfarin_nsaid').utfall;
    expect(u).toMatchObject({ visas: true, kvitterade: 5 });
    expect(u.text).toContain('ses över av systemförvaltningen');
    // En sjätte på en annan vårdenhet räknas inte, och färre än fem visas inte som tal.
    expect(utfallsstod.varning(s.db, personal(s.db, 'lak-akut'), 'warfarin_nsaid')).toMatchObject({ visas: true, kvitterade: 0 });
    s.db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad, kvitterade_varningar) VALUES ('p01', 'uso-akut', 'VK-NPL-0027', '1 tablett', 'staende', 'Smärta', ?, ?, 'lak-akut', ?, ?)")
      .run(addDagar(idag(), 7), idag(), iso(), JSON.stringify([{ regel: 'warfarin_nsaid', motivering: 'Kort' }]));
    expect(utfallsstod.varning(s.db, personal(s.db, 'lak-akut'), 'warfarin_nsaid')).toMatchObject({ visas: false, kvitterade: null });
  });

  test(T.utfallSubstans.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    // Empagliflozin är inte ordinerat på kardiologen i seeden: underlaget är för litet.
    const fore = (await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0021')).data.utfall;
    expect(fore).toMatchObject({ typ: 'substans', visas: false });
    // Fem ordinationer på vårdenheten, ingen utsatt.
    for (let i = 0; i < 5; i++) s.db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES ('p01', 'uso-kard', 'VK-NPL-0021', '1 tablett', 'staende', 'Hjärtsvikt', ?, ?, 'lak-kard', ?)").run(addDagar(idag(), 30), idag(), iso());
    const efter = (await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0021')).data.utfall;
    expect(efter).toMatchObject({ visas: true, x: 0, n: 5, procent: 0 });
    expect(efter.text).toBe('Av 5 ordinationer av substansen på vårdenheten de senaste två åren sattes 0 ut inom 30 dagar (0 procent).');
    // En av dem sätts ut efter tio dagar: ettan kan räknas fram, så inget tal visas.
    s.db.query("UPDATE ordinationer SET utsatt_tid = ? WHERE id = (SELECT max(id) FROM ordinationer WHERE lakemedel_id = 'VK-NPL-0021')").run(new Date(Date.now() + 10 * 86400_000).toISOString());
    const en = (await k.get('/api/patient/p01/lakemedelsinfo/VK-NPL-0021')).data.utfall;
    expect(en.visas).toBe(false);
    expect(en.x).toBeUndefined();
  });
});

describe('Kollegakontroll av högriskläkemedel', () => {
  // Morfin intramuskulärt vid behov: en opioid som ges parenteralt och inte bereds (beslut 2026-11-08).
  const oxi = (db) => ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0031', dosering: '5 mg intramuskulärt vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, administrationssatt: 'intramuskulart' });

  test(T.kkGrupper.split(' > ')[1], () => {
    const db = byggSeed();
    const lm = (id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
    const k = (id, o = null, patientId = 'p01') => hogrisk.kategorierFor(db, { lm: lm(id), o, patientId }).map(x => x.id);
    // Opioider: parenteralt till vuxna och alla administrationssätt till barn under 18 år (beslut 2026-11-08).
    expect(k('VK-NPL-0030', { administrationssatt: 'peroralt' })).toEqual([]);
    expect(k('VK-NPL-0030')).toEqual([]);
    expect(k('VK-NPL-0031', { administrationssatt: 'intramuskulart' })).toEqual(['opioider']);
    expect(k('VK-NPL-0031', { administrationssatt: 'intravenost' })).toEqual(['opioider']);
    expect(k('VK-NPL-0031')).toEqual(['opioider']);
    expect(k('VK-NPL-0030', { administrationssatt: 'peroralt' }, 'p61')).toEqual(['opioider']);
    expect(k('VK-NPL-0030', null, 'p09')).toEqual(['opioider']);
    expect(k('VK-EGEN-0001')).toEqual(['elektrolyter']);
    expect(k('VK-NPL-0051')).toEqual(['elektrolyter']);
    // Glukos med Addex-Magnesium som tillsats.
    expect(k('VK-NPL-0057', { spadning: { tillsatser: [{ lakemedelId: 'VK-NPL-0051' }] } })).toEqual(['elektrolyter']);
    // Isoton natriumklorid och glukos utan tillsats är inte koncentrerade elektrolyter.
    expect(k('VK-NPL-0057', { spadning: { tillsatser: [] } })).toEqual([]);
    // Insulin bara som infusion, inte som injektion med penna.
    expect(k('VK-NPL-0022')).toEqual([]);
    expect(k('VK-NPL-0022', { administrationssatt: 'intravenost' })).toEqual(['insulininfusion']);
    expect(k('VK-NPL-0005')).toEqual([]);
    expect(k('VK-NPL-0005', { spadning: { tillsatser: [] } })).toEqual(['heparininfusion']);
    expect(k('VK-NPL-0026')).toEqual([]);
    // Cytostatika i katalogen (L01).
    const cyto = db.query("SELECT id FROM katalog WHERE atc LIKE 'L01%' LIMIT 1").get();
    if (cyto) expect(k(cyto.id)).toEqual(['cytostatika']);
    // Parametrarna finns för varje grupp och är påslagna från början.
    expect(konfiguration.parametrar()[hogrisk.KATEGORIER.opioider.parameter]).toMatchObject({ typ: 'lista', omrade: 'lakemedel', standard: ['intravenöst', 'subkutant', 'intramuskulärt', 'epiduralt', 'intratekalt', 'barn under 18 år'] });
    for (const [id, x] of Object.entries(hogrisk.KATEGORIER)) {
      if (id !== 'opioider') expect(konfiguration.parametrar()[x.parameter]).toMatchObject({ typ: 'janej', standard: true, omrade: 'lakemedel' });
      expect(konfiguration.parametrar()[x.parameter].beskrivning).toContain(x.varfor);
      expect(hogrisk.aktiv(db, id)).toBe(true);
    }
  });

  test(T.kkFlode.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    const o = oxi(db);
    // Listan säger att en kollega kontrollerar dosen och varför.
    const vb = administrering.lista(ssk(db, 'p01', 'ssk-kard', 'las_lakemedel')).vidBehov.find(d => d.ordinationId === o.id);
    expect(vb.kollegakontroll).toMatchObject({ kravs: true, kategorier: [{ id: 'opioider', rubrik: 'Opioider' }] });
    expect(vb.kollegakontroll.varfor).toContain('andningsdepression');
    // Utan iordningsställande stoppas dosen med en förklaring.
    const utan = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id }));
    expect(utan.status).toBe(400);
    expect(utan.extra).toMatchObject({ kollegakontroll: true, iordningstall: true });
    expect(utan.message).toContain('Välj Iordningsställ');
    // En opioid i tablettform till en vuxen kräver ingen kollega.
    const tablett = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0030', dosering: '1 kapsel vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true });
    expect(administrering.lista(ssk(db, 'p01', 'ssk-kard', 'las_lakemedel')).vidBehov.find(d => d.ordinationId === tablett.id).kollegakontroll).toBeUndefined();
    // Iordningsställd: dosen väntar på kontroll.
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'iordningstall' });
    expect(ior.administrering.kollegakontroll).toMatchObject({ av: null, iordningstalldAv: { id: 'ssk-kard' } });
    const kod = ior.administrering.iordningstalld.kontrollkod;
    const vantar = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, kontrollkod: kod }));
    expect(vantar.message).toContain('väntar på kollegakontroll');
    // Kollegan på hjärtintensiven (samma vårdenhet) kontrollerar i sin egen inloggning.
    const kollega = ssk(db, 'p01', 'ssk-hia');
    const fel1 = fel(() => hogrisk.kontrollera(kollega, ior.administrering.kollegakontroll.id, { synligaAdministreringar: administrering.synligaAdministreringar, kravVardande: administrering.kravVardande }, { kontrollkod: 'FEL' }));
    expect(fel1.message).toContain('Etiketten stämmer inte');
    const kk = hogrisk.kontrollera(kollega, ior.administrering.kollegakontroll.id, { synligaAdministreringar: administrering.synligaAdministreringar, kravVardande: administrering.kravVardande }, { kontrollkod: kod });
    expect(kk.kontroll.av).toMatchObject({ id: 'ssk-hia' });
    expect(() => db.query('UPDATE kollegakontroller SET kontrollerad_av = ? WHERE id = ?').run('ssk-kard', kk.kontroll.id)).toThrow(/ändras inte/);
    expect(() => db.query('DELETE FROM kollegakontroller').run()).toThrow(/raderas inte/);
    // Nu kan dosen ges.
    const given = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, kontrollkod: kod });
    expect(given.administrering.status).toBe('given');
    expect(given.administrering.kollegakontroll.av.namn).toBe(personal(db, 'ssk-hia').namn);
    // En dos som registreras i efterhand stoppas inte av kollegakontrollen. Andra varningar kvitteras som vanligt.
    const efterhand = { ordinationId: o.id, tid: new Date(Date.now() - 3 * 3600_000).toISOString() };
    const v = fel(() => administrering.spara(ssk(db, 'p01'), efterhand));
    const kvitt = (v?.extra?.kraverKvittens ?? []).map(regel => ({ regel, motivering: 'Registreras i efterhand' }));
    expect(v?.extra?.kollegakontroll).toBeUndefined();
    expect(administrering.spara(ssk(db, 'p01'), { ...efterhand, kvitteradeVarningar: kvitt }).administrering.status).toBe('given');
    expect(verifiera(db).hel).toBe(true);
  });

  test(T.kkSjalv.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    const o = oxi(db);
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'iordningstall' });
    const id = ior.administrering.kollegakontroll.id;
    const dep = { synligaAdministreringar: administrering.synligaAdministreringar, kravVardande: administrering.kravVardande };
    expect(fel(() => hogrisk.kontrollera(ssk(db, 'p01'), id, dep)).message).toContain('iordningsställde dosen själv');
    const usk = fel(() => hogrisk.kontrollera(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), id, dep));
    expect(usk.status).toBe(403);
    // En läkare på akuten ser inte dosen utan aktivt val, och med aktivt val är det inte hennes vårdenhet.
    expect(fel(() => hogrisk.kontrollera(atk(db, 'lak-akut', 'p01', {}, 'ge_lakemedel'), id, dep)).status).toBe(403);
    expect(fel(() => hogrisk.kontrollera(atk(db, 'lak-akut', 'p01', { andra_enheter: true }, 'ge_lakemedel'), id, dep)).status).toBe(403);
    // Nekade försök loggas.
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ? AND resultat = 'nekad'").get(`kollegakontroll:${id}`).n).toBeGreaterThanOrEqual(2);
    // Läkaren på kardiologen kan kontrollera.
    expect(hogrisk.kontrollera(atk(db, 'lak-kard', 'p01', {}, 'ge_lakemedel'), id, dep).kontroll.av.id).toBe('lak-kard');
  });

  test(T.kkBeredning.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0057', dosering: '1000 ml glukos med 20 mmol Addex-Magnesium under 2 timmar', dos: 1000, dosEnhet: 'ml', tider: ['14'],
      typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { volymMl: 1000, tidMin: 120, tillsatser: [{ lakemedelId: 'VK-NPL-0051', mangd: 20 }] } });
    const dos = administrering.lista(ssk(db, 'p01', 'ssk-kard', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos.beredning).toMatchObject({ kravs: true, dubbelkontroll: true });
    expect(dos.beredning.varfor).toContain('Koncentrerade elektrolyter');
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall', beredning: { batch: 'MG2611' } });
    expect(ior.administrering.beredning.kontroll).toMatchObject({ kravs: true, av: null });
    expect(ior.administrering.kollegakontroll).toBeNull();
    const ge = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: ior.administrering.iordningstalld.kontrollkod }));
    expect(ge.message).toContain('väntar på kontroll');
  });

  test(T.kkParameter.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    const sf = personal(db, 'sysf');
    const sf2 = personal(db, 'sysf-2');
    const nyckel = hogrisk.KATEGORIER.opioider.parameter;
    // Ett administrationssätt som inte finns förklaras.
    expect(konfiguration.prova(nyckel, ['intravenöst', 'i örat']).ok).toBe(false);
    // Systemförvaltaren tar bort intramuskulärt ur listan.
    const ny = ['intravenöst', 'subkutant', 'epiduralt', 'intratekalt', 'barn under 18 år'];
    const f = konfiguration.forhandsvisa(db, sf, { nyckel, varde: ny, giltigFran: idag() });
    expect(f.ok).toBe(true);
    expect(f.effekt[0]).toContain('intravenöst');
    const { andring } = konfiguration.foresla(db, sf, { nyckel, varde: ny, giltigFran: idag(), motivering: 'Prövning av en ny rutin' });
    // Ändringen gäller först när en annan systemförvaltare har godkänt den.
    expect(hogrisk.aktiv(db, 'opioider')).toBe(true);
    expect(fel(() => konfiguration.godkann(db, sf, andring.id, {})).status).toBe(403);
    konfiguration.godkann(db, sf2, andring.id, {});
    expect(hogrisk.aktiv(db, 'opioider')).toBe(true);
    // En intramuskulär opioid ges nu utan kollegakontroll, och andra grupper kontrolleras som förut.
    const o = oxi(db);
    expect(administrering.spara(ssk(db, 'p01'), { ordinationId: o.id }).administrering.status).toBe('given');
    expect(hogrisk.aktiv(db, 'elektrolyter')).toBe(true);
    // En sjuksköterska kan inte ändra parametern.
    expect(fel(() => konfiguration.foresla(db, personal(db, 'ssk-kard'), { nyckel, varde: ['intravenöst'], motivering: 'x' })).status).toBe(403);
  });

  test(T.kkSparad.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    const o = oxi(db);
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'iordningstall' });
    const kod = ior.administrering.iordningstalld.kontrollkod;
    // Ett annat läkemedel i anropet: dosen med kontrollkoden är oxikodon, och anropet avvisas.
    const annatLm = fel(() => administrering.spara(ssk(db, 'p01'), { lakemedelId: 'VK-NPL-0026', kontrollkod: kod }));
    expect(annatLm?.status).toBe(400);
    // En annan ordination i anropet, med samma kontrollkod.
    const alvedon = db.query("SELECT o.id FROM ordinationer o WHERE o.patient_id = 'p01' AND o.lakemedel_id = 'VK-NPL-0026' AND o.status = 'aktiv'").get();
    const annanOrd = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: alvedon.id, kontrollkod: kod }));
    expect(annanOrd?.status).toBe(400);
    // Direkt mot regeln: ett annat läkemedel än den iordningsställda dosens avvisas, och den sparade raden avgör.
    const iorRad = db.query('SELECT * FROM administreringar WHERE id = ?').get(ior.id);
    const paracetamol = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0026'").get();
    expect(fel(() => hogrisk.provaAdministrering(db, { atgard: 'ge', lm: paracetamol, o: null, ior: iorRad }))?.message).toContain('hör inte till');
    // Parametern stängs av mellan iordningsställandet och givandet: dosen är redan iordningsställd med kontroll.
    const sf = personal(db, 'sysf');
    const { andring } = konfiguration.foresla(db, sf, { nyckel: hogrisk.KATEGORIER.opioider.parameter, varde: [], giltigFran: idag(), motivering: 'Ny rutin' });
    konfiguration.godkann(db, personal(db, 'sysf-2'), andring.id, {});
    expect(hogrisk.aktiv(db, 'opioider')).toBe(false);
    const avstangd = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, kontrollkod: kod }));
    expect(avstangd?.message).toContain('väntar på kollegakontroll');
    // Samma person kan inte vara sin egen kollega, inte heller genom ett id i anropet.
    const dep = { synligaAdministreringar: administrering.synligaAdministreringar, kravVardande: administrering.kravVardande };
    expect(fel(() => hogrisk.kontrollera(ssk(db, 'p01'), ior.administrering.kollegakontroll.id, dep, { av: 'ssk-hia', personalId: 'ssk-hia' }))?.message).toContain('iordningsställde dosen själv');
    // När kollegan har kontrollerat i sin egen inloggning kan dosen ges, fast parametern nu är avstängd.
    hogrisk.kontrollera(ssk(db, 'p01', 'ssk-hia'), ior.administrering.kollegakontroll.id, dep);
    expect(administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, kontrollkod: kod }).administrering.status).toBe('given');
    // En ny dos efter ändringen iordningsställs utan kollegakontroll.
    const ny = { ordinationId: o.id, atgard: 'iordningstall' };
    const v = fel(() => administrering.spara(ssk(db, 'p01'), ny));
    const kvitt = (v?.extra?.kraverKvittens ?? []).map(regel => ({ regel, motivering: 'Ny dos efter ändringen' }));
    expect(administrering.spara(ssk(db, 'p01'), { ...ny, kvitteradeVarningar: kvitt }).administrering.kollegakontroll).toBeNull();
  });

  test(T.kkGammal.split(' > ')[1], () => {
    const db = sandladaKl('13:30');
    // En godkänd ändring från när opioidparametern var ja eller nej, och skräp i en annan grupps parameter.
    const rad = (nyckel, varde) => db.query(`INSERT INTO konfig_andringar (slag, nyckel, varde, forra, giltig_fran, motivering, foreslagen_av, foreslagen, status, beslutad_av, beslutad, galler_fran)
      VALUES ('parameter', ?, ?, NULL, ?, 'Äldre värde', 'sysf', ?, 'godkand', 'sysf-2', ?, ?)`).run(nyckel, JSON.stringify(varde), addDagar(idag(), -1), iso(), iso(), addDagar(idag(), -1));
    rad(hogrisk.KATEGORIER.opioider.parameter, true);
    rad(hogrisk.KATEGORIER.elektrolyter.parameter, 'kanske');
    const lm = (id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
    const k = (id, o, pid = 'p01') => hogrisk.kategorierFor(db, { lm: lm(id), o, patientId: pid }).map(x => x.id);
    // true blir förvalet: injektionen kontrolleras, tabletten till en vuxen inte.
    expect(k('VK-NPL-0031', { administrationssatt: 'intramuskulart' })).toEqual(['opioider']);
    expect(k('VK-NPL-0030', { administrationssatt: 'peroralt' })).toEqual([]);
    expect(k('VK-EGEN-0001', null)).toEqual(['elektrolyter']);
    expect(hogrisk.aktiv(db, 'opioider')).toBe(true);
    expect(hogrisk.aktiv(db, 'elektrolyter')).toBe(true);
    // Inga doser kastar fel: en dos som inte är en opioid ges som vanligt, och en injektion kräver kollegan.
    const furo = db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn LIKE 'Alvedon%' AND o.status = 'aktiv'").get();
    expect(administrering.kontroll(ssk(db, 'p01'), { ordinationId: furo.id }).varningar).toBeDefined();
    expect(administrering.lista(ssk(db, 'p01', 'ssk-kard', 'las_lakemedel')).vidBehov.length).toBeGreaterThan(0);
    const o = oxi(db);
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id }))?.extra?.kollegakontroll).toBe(true);
    // false blir en tom lista: opioider kontrolleras inte.
    rad(hogrisk.KATEGORIER.opioider.parameter, false);
    expect(k('VK-NPL-0031', { administrationssatt: 'intramuskulart' })).toEqual([]);
    expect(hogrisk.aktiv(db, 'opioider')).toBe(false);
    // Vaccinationsparametrarna med fel typ ger förvalen.
    rad('vaccination.vattkoppor_alder_manader', 'arton');
    rad('vaccination.riskgrupp_alder_ar', null);
    rad('vaccination.riskgrupper', 'J44');
    expect(vaccinationsprogram.regler(db)).toMatchObject({ vattkopporManader: null, riskAlder: 65 });
    expect(vaccinationsprogram.regler(db).riskPrefix).toContain('I50');
  });

  test(T.kkInkorg.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const s = sandlada(app, k);
    const o = oxi(s.db);
    administrering.spara(ssk(s.db, 'p01'), { ordinationId: o.id, atgard: 'iordningstall' });
    // Den som iordningsställde ser inte sin egen dos som en uppgift.
    expect((await k.get('/api/inkorg')).data.kollegakontrollerAttGora).toEqual([]);
    await k.logga('lak-kard');
    const r = await k.get('/api/inkorg');
    expect(r.data.kollegakontrollerAttGora).toEqual([{ antal: 1, text: '1 dos av ett högriskläkemedel väntar på kollegakontroll av en annan sjuksköterska eller läkare.', lank: '#/administrering' }]);
    expect(JSON.stringify(r.data.kollegakontrollerAttGora)).not.toMatch(/p01|Gunnar|Åkesson|Oxikodon/);
    // Kontrollen görs i den inloggades session: id i anropet byter aldrig person.
    const lista = (await k.get('/api/patient/p01/administreringar')).data;
    const kid = lista.senaste.find(a => a.kollegakontroll)?.kollegakontroll.id;
    const kk = await k.post(`/api/patient/p01/kollegakontroll/${kid}`, { personalId: 'ssk-kard', av: 'ssk-kard' });
    expect(kk.status).toBe(200);
    expect(kk.data.kontroll.av.id).toBe('lak-kard');
    expect((await k.get('/api/inkorg')).data.kollegakontrollerAttGora).toEqual([]);
  });
});
