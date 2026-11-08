// Runda 8, r4: bristerna i läkemedelsprocessen som Sussas testfall 1.1 till 1.4 visade. Administrationssätt för öga,
// öra och näsa ur beredningsformen, doseringsmallar per produkt och beredningsform, en infusion med tillsats som en
// ordination, dosändring i en pågående ordination med ny dosering från ett datum, och läkaren och skälet från den
// förra muntliga ordinationen. Klockan styrs med setSystemTime och sandlådan byggs vid den tiden.
import { describe, test, expect, afterEach, afterAll, setSystemTime } from 'bun:test';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as administrering from '../src/administrering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as stod from '../src/lakemedelsstod.js';
import * as mallar from '../src/ordinationsmallar.js';
import * as vagar from '../src/ordinationsvagar.js';
import * as dosandring from '../src/dosandring.js';
import * as vidimering from '../src/vidimering.js';
import * as fhir from '../src/fhir.js';
import { verifiera } from '../src/logg.js';
import * as nyheter from '../src/nyheter.js';
import { atk, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => setSystemTime());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const lak = (db, pid, val = {}, id = 'lak-kard') => atk(db, id, pid, val, 'ordinera');
const ssk = (db, pid, handling = 'ge_lakemedel', val = {}) => atk(db, 'ssk-kard', pid, val, handling);
// Ordinerar som läkaren via samma väg som API:t (forbered, spara och tilläggen).
function ordinera(db, pid, inp, personalId = 'lak-kard') {
  const a = atk(db, personalId, pid, {}, 'ordinera');
  const { kropp, extra } = stod.forbered(db, inp);
  const t = mallar.valideraTillagg(db, kropp);
  const ut = lakemedel.spara(a, { start: idag(), uppfoljningsdatum: addDagar(idag(), 7), ordinationsorsak: 'Test', ...kropp });
  mallar.sparaTillagg(db, ut.ordination.id, t);
  stod.sparaTillagg(db, ut.ordination.id, extra);
  return lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id));
}
let app;
afterAll(() => app?.stop?.(true));

describe('Administrationssätt ur beredningsformen', () => {
  test('ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt', () => {
    const db = sandladaKl('13:30');
    // Varje produkt i katalogen får ett administrationssätt som passar formen, och det föreslagna sättet är tillåtet.
    const forvantat = { 'ögondroppar, lösning': 'okulart', ögonsalva: 'okulart', 'nässpray, lösning': 'nasalt', 'lösning för nebulisator': 'inhalation', 'inhalationsspray, lösning': 'inhalation',
      sublingualspray: 'sublingualt', 'filmdragerad tablett': 'peroralt', 'infusionsvätska, lösning': 'intravenost', 'injektionsvätska, lösning i förfylld spruta': 'subkutant' };
    for (const [form, satt] of Object.entries(forvantat)) expect(mallar.administrationssatt(form)).toBe(satt);
    for (const lm of db.query('SELECT * FROM katalog').all()) expect(mallar.tillatnaSatt(lm.form)).toContain(mallar.administrationssatt(lm.form));
    expect(mallar.tillatnaSatt('ögondroppar, lösning')).toEqual(['okulart']);
    expect(mallar.administrationssatt('örondroppar, lösning')).toBe('aurikulart');
    expect(mallar.administrationssatt('kräm')).toBe('kutant');
    expect(mallar.administrationssatt('injektionsvätska, lösning')).toBe('intravenost');
    expect(mallar.ADMINISTRATIONSSATT.okulart).toBe('I ögat');
    // Förslaget för Kloramfenikol ögondroppar har i ögat och en droppe som dos.
    const f = mallar.forslag(lak(db, 'p01'), katalog(db, 'VK-NPL-0058'));
    expect(f).toMatchObject({ administrationssatt: 'okulart', administrationssattText: 'I ögat', tillatnaAdministrationssatt: ['okulart'], dos: 1, dosEnhet: 'droppe' });
    // Ordinationen utan angivet sätt får i ögat, och peroralt nekas med en förklaring.
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0058', dosering: '1 droppe 6 gånger dagligen i höger öga i 1 vecka', dos: 1, dosEnhet: 'droppe', typ: 'tillfallig', slut: addDagar(idag(), 7) });
    expect(o).toMatchObject({ administrationssatt: 'okulart', administrationssattText: 'I ögat' });
    const e = fel(() => mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0058', administrationssatt: 'peroralt' }));
    expect(e.status).toBe(400);
    expect(e.message).toContain('ögondroppar, lösning');
    expect(e.message).toContain('i ögat');
    // Läkemedel att ge och FHIR visar sättet.
    expect(fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id)).dosageInstruction[0].route).toEqual({ text: 'I ögat' });
  });
});

describe('Doseringsmallar per produkt', () => {
  test('Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg', () => {
    const db = sandladaKl('13:30');
    // Patienten p04 är under 75 år och p01 över.
    const a = lak(db, 'p04');
    // Alvedon 500 mg följer mallen som förut.
    expect(mallar.forslag(a, katalog(db, 'VK-NPL-0026'))).toMatchObject({ dos: 500, dosering: '1 till 2 tabletter vid behov, högst 8 tabletter per dygn', typ: 'vid_behov' });
    // Alvedon forte 1 g: en tablett, 1000 mg och högst 4 tabletter per dygn.
    const forte = mallar.forslag(a, katalog(db, 'VK-NPL-0052'));
    expect(forte).toMatchObject({ mallnamn: 'Paracetamol 1 g vid behov', dos: 1000, dosEnhet: 'mg', dosering: '1 tablett vid behov, högst 4 tabletter per dygn', typ: 'vid_behov', administrationssatt: 'peroralt' });
    // Paracetamol som infusion: 1 g på 15 minuter som engångsdos, intravenöst och med volymen i vätskebalansen.
    const inf = mallar.forslag(a, katalog(db, 'VK-NPL-0062'));
    expect(inf).toMatchObject({ mallnamn: 'Paracetamol intravenöst', dos: 1000, dosEnhet: 'mg', typ: 'tillfallig', engangs: true, volymMl: 100, vatskebalans: true, administrationssatt: 'intravenost' });
    expect(inf.dosering).toContain('intravenös infusion under 15 minuter');
    // Varianten har en egen anpassning för den som är över 75 år.
    expect(mallar.forslag(lak(db, 'p01'), katalog(db, 'VK-NPL-0052')).dosering).toBe('1 tablett vid behov, högst 3 tabletter per dygn');
    // Mallens varianter godkänns med mallen och visas för den mallansvariga läkaren.
    expect(mallar.produktmall({ namn: 'X', dosering: '1 tablett', dos: 500, dosEnhet: 'mg', skalas: false }, katalog(db, 'VK-NPL-0052')).mall).toBeNull();
  });

  test('en annan styrka i samma form får samma antal tabletter och dosen ur styrkan, och en annan form får inte substansens mall', () => {
    const db = sandladaKl('13:30');
    const a = lak(db, 'p01');
    // Metformin 850 mg: mallen för 500 mg ger en tablett morgon och kväll, med dosen 850 mg.
    const met = mallar.forslag(a, katalog(db, 'VK-NPL-0060'));
    expect(met).toMatchObject({ dosering: '1 tablett morgon och kväll', dos: 850, dosEnhet: 'mg', tider: ['08', '20'] });
    expect(met.varfor.join(' ')).toContain('dosen är räknad för 850 mg');
    // Zopiklon 7,5 mg för en patient över 75 år: en halv tablett, 3,75 mg.
    expect(mallar.forslag(lak(db, 'p01'), katalog(db, 'VK-NPL-0066'))).toMatchObject({ dosering: 'En halv tablett till natten vid behov', dos: 3.75 });
    // Morfin som tablett får inte mallen för morfin intravenöst, bara dosen ur styrkan och en förklaring.
    const tab = mallar.forslag(a, katalog(db, 'VK-NPL-0061'));
    expect(tab).toMatchObject({ mall: null, dosering: '', dos: 10, dosEnhet: 'mg', administrationssatt: 'peroralt' });
    expect(tab.varfor[0]).toContain('gäller injektioner');
    // Morfin Abcur som injektion har mallen.
    expect(mallar.forslag(a, katalog(db, 'VK-NPL-0031')).mallnamn).toBe('Morfin intravenöst vid behov');
    expect(mallar.formgrupp('injektionsvätska, lösning')).toBe('injektion');
    expect(mallar.formgrupp('ögonsalva')).toBe('ogon');
  });
});

describe('Tillsatser i infusion', () => {
  test('glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans', () => {
    const db = sandladaKl('13:30');
    const a = lak(db, 'p01');
    const glukos = katalog(db, 'VK-NPL-0057');
    // Förslaget: basvätskan med de tillsatser som går att välja, och Addex-Magnesium för sig förklarar hur det ordineras.
    const f = mallar.forslag(a, glukos);
    expect(f).toMatchObject({ typ: 'tillfallig', dos: 1000, dosEnhet: 'ml', administrationssatt: 'intravenost' });
    expect(f.spadning).toMatchObject({ basvatska: true, volymMl: 1000, namn: 'Glucos Baxter 25 mg/ml buffrad' });
    expect(f.spadning.tillsatsVal.map(t => t.lakemedelId)).toContain('VK-NPL-0051');
    expect(mallar.forslag(a, katalog(db, 'VK-NPL-0051')).tillsats.text).toContain('Ordinera infusionen');
    const o = ordinera(db, 'p01', { lakemedelId: glukos.id, dosering: '1000 ml Glucos Baxter 25 mg/ml buffrad med 20 mmol Addex-Magnesium, intravenöst under 2 timmar', dos: 1000, dosEnhet: 'ml',
      tider: ['14'], typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { volymMl: 1000, tidMin: 120, tillsatser: [{ lakemedelId: 'VK-NPL-0051', mangd: 20 }] } });
    expect(o.spadning).toMatchObject({ totalVolymMl: 1020, hastighetMlH: 510 });
    expect(o.spadning.tillsatser[0]).toMatchObject({ lakemedelId: 'VK-NPL-0051', namn: 'Addex-Magnesium', mangd: 20, enhet: 'mmol', perLiter: 19.6, perTimme: 10 });
    expect(o.spadning.text).toContain('tillsätt 20 mmol Addex-Magnesium (20 ml)');
    expect(o.volymMl).toBe(1020);
    // För mycket magnesium per timme stoppas med en förklaring.
    expect(fel(() => stod.valideraSpadning(db, glukos, 1000, 'ml', { volymMl: 1000, tidMin: 60, tillsatser: [{ lakemedelId: 'VK-NPL-0051', mangd: 20 }] })).message).toContain('förläng infusionstiden');
    // Iordningsställandet och dosen gäller hela blandningen, och volymen med tillsatsen räknas in i vätskebalansen.
    const dos = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos.spadning.text).toContain('Addex-Magnesium');
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall' });
    expect(ior.administrering.status).toBe('iordningstalld');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: ior.administrering.iordningstalld.kontrollkod });
    expect(ut.administrering.status).toBe('given');
    expect(administrering.vatskebalans(ssk(db, 'p01', 'las_matvarden')).poster.find(p => p.administreringId === ut.id).volymMl).toBe(1020);
    // Vidimeringen visar blandningen som en ny ordination.
    const v = vidimering.underlag(atk(db, 'lak-kard', 'p01', {}, 'ordinera'));
    expect(v.andringar.nya.some(x => x.id === o.id)).toBe(true);
    // FHIR: tillsatsen och hastigheten i doseringen.
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(r.dosageInstruction[0].text).toContain('tillsätt 20 mmol Addex-Magnesium');
    expect(r.dosageInstruction[0].doseAndRate[0].rateQuantity).toMatchObject({ value: 510, code: 'mL/h' });
  });
});

describe('Dosändring', () => {
  test('dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning', () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0020', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', ordinationsorsak: 'Mot diabetes' });
    const vid = vidimering.vidimera(atk(db, 'lak-kard', 'p01', {}, 'ordinera'));
    expect(vid.id).toBeTruthy();
    const u = dosandring.underlag(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id));
    // Produkterna med samma substans och form, med den nuvarande först och förslaget ur styrkan.
    expect(u.alternativ.map(x => x.styrka)).toEqual(['500 mg', '850 mg', '1000 mg']);
    const teva = u.alternativ.find(x => x.styrka === '850 mg');
    expect(teva.forslag).toMatchObject({ dosering: '1 tablett morgon och kväll', dos: 850, dosEnhet: 'mg', tider: ['08', '20'] });
    const r = dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { lakemedelId: teva.id, ...teva.forslag });
    // Samma ordination, med den nya produkten, samma orsak och uppföljning, och ingen ny ordination.
    expect(r.ordination).toMatchObject({ id: o.id, lakemedel: { namn: 'Metformin Teva', styrka: '850 mg' }, dosering: '1 tablett morgon och kväll', dos: 850, ordinationsorsak: 'Mot diabetes', status: 'aktiv', uppfoljningsdatum: o.uppfoljningsdatum });
    expect(r.dosandring).toMatchObject({ galler: true, fran: idag() });
    expect(r.dosandring.text).toBe('Metformin Sandoz 500 mg byts mot Metformin Teva 850 mg, dosen ändras från 500 mg till 850 mg.');
    expect(db.query("SELECT count(*) AS n FROM ordinationer WHERE patient_id = 'p01' AND lakemedel_id IN ('VK-NPL-0020', 'VK-NPL-0060')").get().n).toBe(1);
    expect(r.ordination.historik.map(h => h.handelse)).toContain('Dosen ändrad');
    // NLL får en ny förskrivning, och förpackningen är den nya produktens.
    expect(r.nll.status).toBe('kvitterad');
    expect(db.query('SELECT typ FROM nll_meddelanden WHERE ordination_id = ? ORDER BY id DESC').get(o.id).typ).toBe('ny_forskrivning');
    expect(r.ordination.forpackning.nplpackid).toBe(stod.forpackningarFor(db, 'VK-NPL-0060')[0].nplpackid);
    // Vidimeringen ser ändringen.
    expect(vidimering.underlag(atk(db, 'lak-kard', 'p01', {}, 'ordinera')).andringar.nya.find(x => x.id === o.id)?.andring).toBe('andrad');
    // Läkemedelsberättelsen säger vad som ändrades.
    expect(vidimering.berattelse(atk(db, 'lak-kard', 'p01', {}, 'ordinera')).text).toContain('Ändrad dos: Metformin Teva. Metformin Sandoz 500 mg byts mot Metformin Teva 850 mg');
    // En ändring av bara doseringen skickas som en ändring, och en dosändring raderas eller ändras aldrig.
    const r2 = dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { dosering: '1 tablett till frukost och kvällsmat', dos: 850, dosEnhet: 'mg', tider: ['08', '18'] });
    expect(r2.dosandring.text).toContain('tiderna ändras från kl. 08, 20 till kl. 08, 18');
    expect(db.query('SELECT typ FROM nll_meddelanden WHERE ordination_id = ? ORDER BY id DESC').get(o.id).typ).toBe('andring');
    expect(() => db.query('UPDATE dosandringar SET efter = ? WHERE ordination_id = ?').run('{}', o.id)).toThrow();
    expect(() => db.query('DELETE FROM dosandringar WHERE ordination_id = ?').run(o.id)).toThrow();
    // Oförändrad dosering, annan substans och en annan form förklaras.
    expect(fel(() => dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { dosering: '1 tablett till frukost och kvällsmat', dos: 850, dosEnhet: 'mg', tider: ['08', '18'] })).message).toContain('oförändrad');
    expect(fel(() => dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { lakemedelId: 'VK-NPL-0021', dosering: '1 tablett' })).message).toContain('behåller substansen och formen');
    expect(fel(() => dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { dosering: 'x', fran: addDagar(idag(), -1) })).message).toContain('i dag eller senare');
  });

  test('en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge', () => {
    const db = sandladaKl('13:30');
    const start = idag();
    const om3 = addDagar(start, 3);
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0020', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', ordinationsorsak: 'Mot diabetes' });
    const r = dosandring.andra(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id), { dosering: '2 tabletter morgon och kväll', dos: 1000, dosEnhet: 'mg', tider: ['08', '20'], fran: om3, orsak: 'Högre dos efter provsvar' });
    // Ordinationen har kvar den gamla doseringen och visar den nya med datum.
    expect(r.dosandring).toMatchObject({ galler: false, fran: om3, orsak: 'Högre dos efter provsvar' });
    expect(r.ordination.dosering).toBe('1 tablett morgon och kväll');
    expect(r.ordination.planeradeDosandringar[0]).toMatchObject({ fran: om3, dosering: '2 tabletter morgon och kväll', dos: 1000 });
    expect(r.ordination.historik.map(h => h.handelse)).toContain(`Dosändring från ${om3}`);
    // FHIR: två doseringar med var sin period.
    const f = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(f.dosageInstruction.map(d => d.timing.repeat.boundsPeriod)).toEqual([{ start, end: addDagar(om3, -1) }, { start: om3 }]);
    // När dagen kommer gäller den nya doseringen, också i dagens doser.
    setSystemTime(new Date(kl('09:00', om3)));
    const lista = lakemedel.lista(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel'));
    const nu = lista.ordinationer.find(x => x.id === o.id);
    expect(nu).toMatchObject({ dosering: '2 tabletter morgon och kväll', dos: 1000 });
    expect(nu.planeradeDosandringar).toBeUndefined();
    expect(nu.historik.map(h => h.handelse)).toContain(`Den nya doseringen gäller från ${om3}`);
    const dos = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos).toMatchObject({ dos: 1000, dosering: '2 tabletter morgon och kväll' });
  });

  test('säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte', () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p04', { lakemedelId: 'VK-NPL-0042', dosering: '1 tablett på morgonen', dos: 10, dosEnhet: 'mg', tider: ['08'], typ: 'staende', ordinationsorsak: 'Nedstämdhet' });
    // Sjuksköterskan ordinerar inte och ändrar inte dosen.
    expect(fel(() => dosandring.andra(atk(db, 'ssk-kard', 'p04', {}, 'ordinera'), lakemedel.hamtaRad(db, o.id), { dosering: '2 tabletter på morgonen', dos: 20 })).status).toBe(403);
    // Läkaren på ortopeden har ingen vårdrelation till patienten.
    expect(fel(() => dosandring.andra(lak(db, 'p04', {}, 'lak-ort'), lakemedel.hamtaRad(db, o.id), { dosering: '2 tabletter på morgonen', dos: 20 })).status).toBe(403);
    // Sertralinet på den spärrade psykiatrin finns i samma läkemedelsgrupp, men varken underlaget eller svaret nämner det.
    const u = dosandring.underlag(lak(db, 'p04'), lakemedel.hamtaRad(db, o.id));
    const r = dosandring.andra(lak(db, 'p04'), lakemedel.hamtaRad(db, o.id), { dosering: '2 tabletter på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'] });
    expect(JSON.stringify([u, r]).toLowerCase()).not.toContain('sertralin');
    // Den spärrade enhetens ordination går inte att ändra, och svaret säger inget om den.
    const sparrad = db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p04' AND k.substans = 'sertralin'").get();
    const e = fel(() => dosandring.underlag(lak(db, 'p04'), sparrad));
    expect(e.status).toBe(403);
    expect(e.message.toLowerCase()).not.toContain('sertralin');
    // Ett trappschema ändras inte med en dosändring.
    const tr = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0049', dosering: 'x', ordinationsorsak: 'Kortison', trappning: { riktning: 'ned', startdos: 40, steg: 5, dagar: 3, slutdos: 5 } });
    expect(fel(() => dosandring.underlag(lak(db, 'p01'), lakemedel.hamtaRad(db, tr.id))).message).toContain('trappschema');
  });

  test('API: dosändring med loggning och FHIR', async () => {
    app ??= testserver();
    const k = klient(app);
    await k.logga('lak-kard');
    const ny = await k.post('/api/patient/p01/lakemedel', { lakemedelId: 'VK-NPL-0020', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', ordinationsorsak: 'Mot diabetes', uppfoljningsdatum: addDagar(idag(), 30) });
    expect(ny.status).toBe(201);
    const id = ny.data.ordination.id;
    const u = await k.get(`/api/ordination/${id}/dosandring`);
    expect(u.status).toBe(200);
    const teva = u.data.alternativ.find(x => x.styrka === '850 mg');
    const r = await k.post(`/api/ordination/${id}/dosandring`, { lakemedelId: teva.id, ...teva.forslag });
    expect(r.status).toBe(200);
    expect(r.data.ordination.lakemedel.namn).toBe('Metformin Teva');
    const db = sandlada(app, k).db;
    const rader = db.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p01' AND resurs LIKE ? ORDER BY id").all(`/api/ordination/${id}/dosandring%`);
    expect(rader.map(x => x.handling)).toEqual(['ordinera', 'ordinera']);
    expect(verifiera(db).hel).toBe(true);
    const f = await k.get(`/fhir/MedicationRequest/${id}`);
    expect(f.data.medicationCodeableConcept.text).toContain('Metformin Teva 850 mg');
    await k.logga('ssk-kard');
    expect((await k.post(`/api/ordination/${id}/dosandring`, { dosering: '2 tabletter', dos: 1700 })).status).toBe(403);
  });
});

describe('Muntlig ordination i följd', () => {
  test('läkaren och skälet föreslås från sjuksköterskans förra muntliga ordination, bara för samma patient och inom två timmar', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination');
    expect(vagar.senasteMuntlig(a)).toBeNull();
    vagar.registreraMuntlig(a, { lakemedelId: 'VK-NPL-0031', dosering: '10 mg intramuskulärt som engångsdos', dos: 10, dosEnhet: 'mg', tider: [], typ: 'tillfallig', slut: idag(), ordinationsorsak: 'Smärta', administrationssatt: 'intramuskulart', lakareId: 'ol-kard', satt: 'telefon', omedelbar: 'Svår smärta' });
    expect(vagar.senasteMuntlig(atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination'))).toEqual({ lakareId: 'ol-kard', satt: 'telefon', omedelbar: 'Svår smärta' });
    // En annan patient och en annan sjuksköterska får inget förslag.
    expect(vagar.senasteMuntlig(atk(db, 'ssk-kard', 'p04', {}, 'registrera_muntlig_ordination'))).toBeNull();
    expect(vagar.senasteMuntlig(atk(db, 'ssk-hia', 'p01', {}, 'registrera_muntlig_ordination'))).toBeNull();
    // Efter två timmar har läkaren inte längre ordinerat i samma samtal.
    expect(vagar.senasteMuntlig(atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination'), Date.parse(kl('15:40')))).toBeNull();
  });
});

describe('Nyheter för läkemedelsprocessen', () => {
  test('läkaren och sjuksköterskan får nyheterna om rundans läkemedelsfunktioner, och andra roller får dem inte', () => {
    const db = byggSeed();
    // Runda 9, r4: nyheterna kom i version 0.8.0, som nu läses i historiken.
    const ids = (id) => (nyheter.nyheter(db, { personal: db.query('SELECT * FROM personal WHERE id = ?').get(id) }).alla.find(v => v.version === '0.8.0')?.nyheter ?? []).map(n => n.id);
    expect(ids('lak-kard')).toEqual(expect.arrayContaining(['andra-dos', 'dosering-ur-produkten', 'tillsats-infusion']));
    expect(ids('lak-kard')).not.toContain('muntlig-i-foljd');
    expect(ids('ssk-kard')).toEqual(expect.arrayContaining(['dosering-ur-produkten', 'tillsats-infusion', 'muntlig-i-foljd']));
    expect(ids('ssk-kard')).not.toContain('andra-dos');
    // Runda 8, r5: nyheten om version 1.0 gäller alla roller, men läkemedelsnyheterna får inte andra roller.
    for (const id of ['andra-dos', 'dosering-ur-produkten', 'tillsats-infusion', 'muntlig-i-foljd']) expect(ids('adm-kard')).not.toContain(id);
  });
});
