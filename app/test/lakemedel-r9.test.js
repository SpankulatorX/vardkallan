// Runda 9, r1: beredning med kontroll och etikett, doser i flytande form och gasform och patientnära skanning
// (Sussa 3.5.1.4, 3.5.2.17 och 3.5.2.18). Klockan styrs med setSystemTime och sandlådan byggs vid den tiden.
import { describe, test, expect, afterEach, afterAll, setSystemTime } from 'bun:test';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as administrering from '../src/administrering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as stod from '../src/lakemedelsstod.js';
import * as mallar from '../src/ordinationsmallar.js';
import * as beredning from '../src/beredning.js';
import * as vyer from '../src/lakemedelsvyer.js';
import * as egen from '../src/egenadministrering.js';
import * as bestallning from '../src/lakemedelsbestallning.js';
import * as strukturerad from '../src/strukturerad.js';
import * as vidimering from '../src/vidimering.js';
import * as statistik from '../src/lakemedelsstatistik.js';
import * as provning from '../src/kliniskprovning.js';
import * as uppmarksamhet from '../src/uppmarksamhet.js';
import * as vagar from '../src/ordinationsvagar.js';
import { verifiera } from '../src/logg.js';
import { slaSamman } from '../src/identitet.js';
import { personal } from './hjalp.js';
import { atk, testserver, klient } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => setSystemTime());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const ssk = (db, pid, handling = 'ge_lakemedel', id = 'ssk-kard', val = {}) => atk(db, id, pid, val, handling);
function ordinera(db, pid, inp, personalId = 'lak-kard') {
  const a = atk(db, personalId, pid, {}, 'ordinera');
  const { kropp, extra } = stod.forbered(db, inp);
  const t = mallar.valideraTillagg(db, kropp);
  const ut = lakemedel.spara(a, { start: idag(), uppfoljningsdatum: addDagar(idag(), 7), ordinationsorsak: 'Test', ...kropp });
  mallar.sparaTillagg(db, ut.ordination.id, t);
  stod.sparaTillagg(db, ut.ordination.id, extra);
  return lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id));
}
const kalium = (db, pid = 'p01') => ordinera(db, pid, { lakemedelId: 'VK-EGEN-0002', dosering: '1000 ml natriumklorid med 20 mmol kaliumklorid under 8 timmar', dos: 1000, dosEnhet: 'ml', tider: ['14'],
  typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { volymMl: 1000, tidMin: 480, tillsatser: [{ lakemedelId: 'VK-EGEN-0001', mangd: 20 }] } });
const penicillin = (db, pid = 'p01') => ordinera(db, pid, { lakemedelId: 'VK-NPL-0032', dosering: '3 g intravenöst 3 gånger per dygn', dos: 3, dosEnhet: 'g', tider: ['14', '22'],
  typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { losning: 'natriumklorid 9 mg/ml', volymMl: 100, tidMin: 30 } });
let app;
afterAll(() => app?.stop?.(true));

describe('Beredning med kontroll och etikett', () => {
  test('en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges', () => {
    const db = sandladaKl('13:30');
    const o = kalium(db);
    // Listan säger att dosen ska beredas och att en annan person kontrollerar, och varför.
    const dos = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos.beredning).toMatchObject({ kravs: true, dubbelkontroll: true, hallbarTimmar: 24 });
    expect(dos.beredning.varfor).toContain('Kaliumklorid');
    // Utan iordningsställande, och utan batch, stoppas dosen med en förklaring.
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00') })).message).toContain('ska beredas innan den ges');
    const utanBatch = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall' }));
    expect(utanBatch.status).toBe(400);
    expect(utanBatch.extra.falt).toEqual(['batch']);
    // Beredningen sparas med det systemet räknade fram ur ordinationen.
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall', beredning: { batch: 'kcl2611' } });
    const b = ior.administrering.beredning;
    expect(b).toMatchObject({ batch: 'KCL2611', totalVolymMl: 1020, bereddAv: { id: 'ssk-kard' }, kontroll: { kravs: true, av: null } });
    expect(b.tillsatser[0]).toMatchObject({ namn: 'kaliumklorid', mangd: 20, enhet: 'mmol' });
    const kod = ior.administrering.iordningstalld.kontrollkod;
    // Utan kontroll ges dosen inte.
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: kod })).message).toContain('väntar på kontroll');
    // Den som beredde kontrollerar inte, undersköterskan inte heller, och ett annat batchnummer stoppas.
    expect(fel(() => beredning.kontrollera(ssk(db, 'p01'), b.id)).message).toContain('Du beredde dosen själv');
    expect(fel(() => beredning.kontrollera(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), b.id)).status).toBe(403);
    expect(fel(() => beredning.kontrollera(ssk(db, 'p01', 'ge_lakemedel', 'ssk-hia'), b.id, { batch: 'ANNAN' })).message).toContain('stämmer inte');
    // En sjuksköterska på samma vårdenhet kontrollerar, och då ges dosen.
    const k = beredning.kontrollera(ssk(db, 'p01', 'ge_lakemedel', 'ssk-hia'), b.id, { batch: 'KCL2611' });
    expect(k.beredning.kontroll.av).toMatchObject({ id: 'ssk-hia', namn: 'Petra Nyberg' });
    expect(fel(() => beredning.kontrollera(ssk(db, 'p01', 'ge_lakemedel', 'lak-kard'), b.id)).message).toContain('redan kontrollerad');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: kod });
    expect(ut.administrering).toMatchObject({ status: 'given', beredning: { batch: 'KCL2611', kontroll: { av: { id: 'ssk-hia' } } } });
    // Etiketten har patienten, läkemedlet, beredningen och kontrollkoden. Streckkoden innehåller bara koden.
    const e = beredning.etikett(ssk(db, 'p01', 'las_lakemedel'), ior.id);
    expect(e).toMatchObject({ kontrollkod: kod, lakemedel: { namn: 'Natriumklorid infusion, egendefinierad' }, beredning: { batch: 'KCL2611' } });
    const rader = beredning.etikettRader(e).map(r => r.text).join(' | ');
    expect(rader).toContain('Tillsats 20 mmol kaliumklorid');
    expect(rader).toContain('Batch KCL2611');
    expect(rader).toContain('Kontrollerad av Petra Nyberg');
    // Beredningen ändras och raderas aldrig.
    expect(() => db.query("UPDATE beredningar SET batch = 'X' WHERE id = ?").run(b.id)).toThrow();
    expect(() => db.query('DELETE FROM beredningar WHERE id = ?').run(b.id)).toThrow();
    expect(verifiera(db).hel).toBe(true);
  });

  test('beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum', () => {
    const db = sandladaKl('13:30');
    // Patient 4, som inte är överkänslig mot penicillin.
    const o = penicillin(db, 'p04');
    const dos = administrering.lista(ssk(db, 'p04', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id && d.planerad === kl('14:00'));
    expect(dos.beredning).toMatchObject({ kravs: true, dubbelkontroll: false, hallbarTimmar: 4 });
    const ior = (beredningInp) => administrering.spara(ssk(db, 'p04'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall', beredning: beredningInp });
    expect(fel(() => ior({ batch: 'PC123', losning: 'glukos 50 mg/ml' })).message).toContain('späds i natriumklorid 9 mg/ml');
    expect(fel(() => ior({ batch: 'PC123', volymMl: 50 })).message).toContain('100 ml färdig lösning');
    expect(fel(() => ior({ batch: 'PC123', utgang: addDagar(idag(), -1) })).message).toContain('gick ut');
    expect(fel(() => ior({ forpackningskod: 'inte en kod' })).message).toContain('gick inte att läsa');
    // Förpackningens kod (GS1) med parenteser och utan.
    expect(beredning.lasForpackningskod('(01)07046260000123(17)271231(10)PC4711')).toEqual({ gtin: '07046260000123', utgang: '2027-12-31', batch: 'PC4711' });
    expect(beredning.lasForpackningskod('010704626000012317271231\u001d10PC4711')).toMatchObject({ utgang: '2027-12-31', batch: 'PC4711' });
    const r = ior({ forpackningskod: '(01)07046260000123(17)271231(10)PC4711' });
    expect(r.administrering.beredning).toMatchObject({ batch: 'PC4711', utgang: '2027-12-31', kontroll: { kravs: false } });
    // Utan krav på kontroll ges dosen direkt, men inte när beredningen har slutat hålla efter fyra timmar.
    setSystemTime(new Date(kl('18:00')));
    expect(fel(() => administrering.spara(ssk(db, 'p04'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: r.administrering.iordningstalld.kontrollkod, tid: kl('17:55') })).message).toContain('bered en ny dos');
    setSystemTime(new Date(kl('14:05')));
    expect(administrering.spara(ssk(db, 'p04'), { ordinationId: o.id, planerad: kl('14:00'), kontrollkod: r.administrering.iordningstalld.kontrollkod }).administrering.status).toBe('given');
    // En basvätska utan tillsats bereds inte.
    expect(beredning.kravsBeredning(db.query("SELECT * FROM katalog WHERE id = 'VK-EGEN-0002'").get(), { tillsatser: [] })).toBe(false);
  });
});

describe('Doser i flytande form och gasform', () => {
  test('flytande dos: systemet räknar volymen i ml ur styrkan och visar den vid iordningsställandet, och en uppmätt volym som avviker varnar', () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-EXT-0001', dosering: '5 mg morfin oral lösning kl. 14', dos: 5, dosEnhet: 'mg', tider: ['14'], typ: 'tillfallig' });
    const dos = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos.flytande).toMatchObject({ volymMl: 5, mg: 5, spruta: 'oral spruta 5 ml' });
    expect(dos.flytande.text).toContain('Mät upp 5 ml (5 mg) med en oral spruta på 5 ml');
    expect(dos.flytande.text).toContain('aldrig upp i en spruta för injektion');
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall' });
    expect(beredning.etikett(ssk(db, 'p01', 'las_lakemedel'), ior.id).flytande.volymMl).toBe(5);
    const k = administrering.kontroll(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), volymMl: 50 });
    expect(k.varningar.find(v => v.regel === 'avvikande_volym')).toMatchObject({ kraverKvittens: true });
    expect(administrering.kontroll(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), volymMl: 5 }).varningar.some(v => v.regel === 'avvikande_volym')).toBe(false);
    // En för liten volym att mäta upp säkert.
    expect(beredning.flytande({ form: 'oral lösning', styrka: '10 mg/ml' }, 0.5, 'mg')).toMatchObject({ volymMl: 0.05, forLiten: true });
  });

  test('syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger', () => {
    const db = sandladaKl('13:30');
    const gas = 'VK-EGEN-0003';
    expect(db.query('SELECT * FROM katalog WHERE id = ?').get(gas)).toMatchObject({ namn: 'Medicinsk syrgas, egendefinierad', atc: 'V03AN01' });
    expect(mallar.administrationssatt('medicinsk gas för inhalation')).toBe('inhalation');
    // Förslaget i formuläret: liter per minut, grimma och standardmålet.
    const f = mallar.forslag(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), db.query('SELECT * FROM katalog WHERE id = ?').get(gas));
    expect(f).toMatchObject({ dos: 2, dosEnhet: 'l/min', typ: 'staende', gas: { utrustning: 'grimma', malMin: 92, malMax: 96 } });
    // En ändring av flödet skriver om systemets dosering, och utrustningen väljs ur flödet.
    expect(stod.forbered(db, { lakemedelId: gas, dos: 6, dosering: f.dosering }).kropp.dosering).toBe('Syrgas 6 liter per minut via syrgasmask. Mål för saturationen 92 till 96 procent.');
    // Systemet väljer utrustningen ur flödet, sätter enheten och skriver doseringen.
    const o = ordinera(db, 'p01', { lakemedelId: gas, dosering: '', dos: 2, tider: [], typ: 'staende' });
    expect(o).toMatchObject({ dosEnhet: 'l/min', gas: { utrustning: 'grimma', malMin: 92, malMax: 96 } });
    expect(o.dosering).toBe('Syrgas 2 liter per minut via grimma. Mål för saturationen 92 till 96 procent.');
    expect(fel(() => stod.forbered(db, { lakemedelId: gas, dos: 8, gas: { utrustning: 'grimma' } })).message).toContain('Grimma ger 0,5 till 4 liter per minut');
    expect(fel(() => stod.forbered(db, { lakemedelId: gas, dos: 20 })).message).toContain('från 0,5 till 15 liter per minut');
    expect(fel(() => stod.forbered(db, { lakemedelId: gas, dos: 2, gas: { malMin: 96, malMax: 92 } })).message).toContain('målet för saturationen');
    expect(fel(() => stod.forbered(db, { lakemedelId: 'VK-NPL-0026', dos: 500, gas: { utrustning: 'mask' } })).message).toContain('ingen gas');
    // I listan visas flödet och utrustningen, och ett flöde som grimman inte ger stoppas när dosen ges.
    const u = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).utanTider.find(d => d.ordinationId === o.id);
    expect(u.gas).toMatchObject({ flode: 2, utrustningText: 'grimma' });
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, dos: 6 })).message).toContain('Fråga läkaren innan flödet ändras');
    // Saturationen över målet ger en observation, bara ur mätvärden som sjuksköterskan får se.
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES ('p01', 'uso-kard-72', 'saturation', '99', 99, '%', ?, 'ssk-kard')").run(kl('13:20'));
    expect(administrering.kontroll(ssk(db, 'p01'), { ordinationId: o.id }).varningar.find(v => v.regel === 'saturation_over_mal').text).toContain('99 procent, över målet 92 till 96');
    expect(administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, dos: 2 }).administrering).toMatchObject({ status: 'given', dos: 2 });
  });
});

describe('Patientnära skanning', () => {
  test('etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten', () => {
    const db = sandladaKl('13:30');
    const furo = lakemedel.synligaOrdinationer(ssk(db, 'p01', 'las_lakemedel')).find(o => db.query('SELECT namn FROM katalog WHERE id = ?').get(o.lakemedel_id).namn.startsWith('Furosemid'));
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00'), atgard: 'iordningstall' });
    const kod = ior.administrering.iordningstalld.kontrollkod;
    expect(beredning.armband(ssk(db, 'p01', 'las_lakemedel')).kod).toBe('VKA-P01');
    const ok = beredning.skanna(ssk(db, 'p01', 'las_lakemedel'), { etikett: kod, armband: 'vka-p01' });
    expect(ok).toMatchObject({ ok: true, administreringId: ior.id, ordinationId: furo.id, planerad: kl('14:00') });
    // Ett armband för en annan patient: inget om den andra patienten i svaret.
    const p02 = db.query("SELECT * FROM patienter WHERE id = 'p02'").get();
    const e = fel(() => beredning.skanna(ssk(db, 'p01', 'las_lakemedel'), { etikett: kod, armband: 'VKA-P02' }));
    expect(e.message).toContain('Armbandet hör inte till den här patienten');
    for (const x of [p02.id, p02.fornamn, p02.efternamn, p02.personnummer, 'P02']) expect(JSON.stringify({ m: e.message, x: e.extra })).not.toContain(x);
    expect(fel(() => beredning.skanna(ssk(db, 'p01', 'las_lakemedel'), { etikett: 'VK-ADM-999999-P02', armband: 'VKA-P01' })).message).toContain('Etiketten hör inte till en iordningsställd dos');
    expect(fel(() => beredning.skanna(ssk(db, 'p01', 'las_lakemedel'), { etikett: kod })).extra.falt).toEqual(['armband']);
    // Dosen ges med skanningen, och servern prövar armbandet på nytt.
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00'), kontrollkod: kod, armband: 'VKA-P02' })).message).toContain('Armbandet hör inte');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00'), kontrollkod: kod, armband: 'VKA-P01' });
    expect(ut.administrering.skannad).toMatchObject({ armband: true, etikett: kod, av: 'Johan Ek' });
    // En given dos har ingen iordningsställd etikett att skanna.
    expect(fel(() => beredning.skanna(ssk(db, 'p01', 'las_lakemedel'), { etikett: kod, armband: 'VKA-P01' })).message).toContain('Etiketten hör inte');
  });

  test('en etikett för en dos av en spärrad vårdenhets ordination behandlas som en okänd etikett', () => {
    const db = sandladaKl('13:30');
    // Patient 4 har spärrat psykiatrin. Med samtycke iordningsställer sjuksköterskan på kardiologen psykiatrins dos.
    const sert = db.query("SELECT o.* FROM ordinationer o WHERE o.patient_id = 'p04' AND o.enhet_id = 'uso-psyk'").get();
    const med = atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'ge_lakemedel');
    const dos = administrering.lista(med).doser.find(d => d.ordinationId === sert.id && !d.administrering);
    const ior = administrering.spara(med, { ordinationId: sert.id, planerad: dos.planerad, atgard: 'iordningstall', tid: new Date().toISOString() });
    const kod = ior.administrering.iordningstalld.kontrollkod;
    // Utan samtycke är etiketten okänd: samma svar som för en etikett som inte finns.
    const utan = (inp) => fel(() => beredning.skanna(atk(db, 'ssk-kard', 'p04', {}, 'las_lakemedel'), inp));
    const okand = utan({ etikett: 'VK-ADM-999999-P04', armband: 'VKA-P04' });
    const sparrad = utan({ etikett: kod, armband: 'VKA-P04' });
    expect(sparrad.status).toBe(400);
    expect(sparrad.message).toBe(okand.message);
    expect(JSON.stringify(sparrad.extra)).toBe(JSON.stringify(okand.extra));
    expect(fel(() => beredning.etikett(atk(db, 'ssk-kard', 'p04', {}, 'las_lakemedel'), ior.id)).status).toBe(404);
    expect(beredning.skanna(atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'las_lakemedel'), { etikett: kod, armband: 'VKA-P04' }).ok).toBe(true);
  });
});

describe('Beställning av extempore, licens och blodprodukter', () => {
  test('extempore beställs från det simulerade apoteket och blodprodukter från den simulerade blodcentralen, med mängd ur ordinationen och status till leveransen', () => {
    const db = sandladaKl('13:30');
    const ext = ordinera(db, 'p01', { lakemedelId: 'VK-EXT-0001', dosering: '5 mg morfin oral lösning kl. 8 och 20', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende' });
    const blod = ordinera(db, 'p01', { lakemedelId: 'VK-BLOD-0001', dosering: '2 enheter erytrocytkoncentrat', dos: 2, dosEnhet: 'enhet', tider: [], typ: 'tillfallig' });
    const f = bestallning.lista(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel')).forslag;
    expect(f.find(x => x.ordinationId === ext.id)).toMatchObject({ typ: 'extempore', mottagare: 'Apoteket (simulerat)', mangd: '70 ml för 7 dagar' });
    expect(f.find(x => x.ordinationId === blod.id)).toMatchObject({ typ: 'blod', mottagare: 'Blodcentralen (simulerad)', mangd: '2 enheter' });
    const lak = () => atk(db, 'lak-kard', 'p01', {}, 'bestalla_lakemedel');
    const b = bestallning.bestall(lak(), { ordinationId: ext.id }).bestallning;
    expect(b).toMatchObject({ typ: 'extempore', status: 'skickad', simulerad: true, mangd: '70 ml för 7 dagar' });
    expect(fel(() => bestallning.bestall(lak(), { ordinationId: ext.id })).message).toContain('redan beställd');
    expect(bestallning.simuleraSvar(lak(), b.id).bestallning.status).toBe('bekraftad');
    const lev = bestallning.simuleraSvar(lak(), b.id).bestallning;
    expect(lev.handelser.map(h => h.status)).toEqual(['skickad', 'bekraftad', 'levererad']);
    expect(fel(() => bestallning.simuleraSvar(lak(), b.id)).message).toContain('redan levererad');
    // Sjuksköterskan beställer blodet, och blodcentralen levererar med enhetsnummer.
    const sb = bestallning.bestall(atk(db, 'ssk-kard', 'p01', {}, 'bestalla_lakemedel'), { ordinationId: blod.id }).bestallning;
    bestallning.simuleraSvar(lak(), sb.id);
    expect(bestallning.simuleraSvar(lak(), sb.id).bestallning.svar).toContain('påhittade enhetsnumret');
    // Ett godkänt läkemedel beställs inte särskilt, och undersköterskan beställer inte.
    const godkand = lakemedel.synligaOrdinationer(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel')).find(o => stod.produkttyp(db, o.lakemedel_id).typ === 'godkand');
    expect(fel(() => bestallning.bestall(lak(), { ordinationId: godkand.id })).message).toContain('förråd');
    expect(fel(() => bestallning.bestall(atk(db, 'usk-kard', 'p01', {}, 'bestalla_lakemedel'), { ordinationId: blod.id })).status).toBe(403);
  });

  test('en licensansökan till det simulerade Läkemedelsverket kräver motivering, och en beviljad licens bevakas av systemet', () => {
    const db = sandladaKl('13:30');
    const lak = () => atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    // Den generella licensen för tiamin går ut om 20 dagar, så en förlängning kan sökas.
    expect(fel(() => bestallning.bestall(lak(), { lakemedelId: 'VK-LIC-0001', motivering: 'Kort' })).extra.falt).toEqual(['motivering']);
    expect(fel(() => bestallning.bestall(lak(), { lakemedelId: 'VK-NPL-0026', motivering: 'Ingen licens behövs här' })).message).toContain('licensläkemedel');
    expect(fel(() => bestallning.bestall(atk(db, 'ssk-kard', 'p01', {}, 'ordinera'), { lakemedelId: 'VK-LIC-0001', motivering: 'Patienten behöver tiamin intravenöst' })).status).toBe(403);
    const a = bestallning.bestall(lak(), { lakemedelId: 'VK-LIC-0001', motivering: 'Wernickes encefalopati, inget godkänt alternativ i lager', generell: true });
    expect(a).toMatchObject({ forlangning: true, bestallning: { typ: 'licens', status: 'skickad', mottagare: 'Läkemedelsverket (simulerat)' } });
    const svar = bestallning.simuleraSvar(lak(), a.bestallning.id).bestallning;
    expect(svar).toMatchObject({ status: 'beviljad' });
    expect(svar.svar).toContain(`beviljad till ${addDagar(idag(), 365)}`);
    expect(stod.licensFor(db, 'VK-LIC-0001', 'p01', 'uso-kard').licens.giltigTill).toBe(addDagar(idag(), 365));
    expect(fel(() => bestallning.bestall(lak(), { lakemedelId: 'VK-LIC-0001', motivering: 'Wernickes encefalopati, igen' })).message).toContain('Ingen ny ansökan behövs');
  });
});

describe('Läkemedelsberättelsen i epikrisen', () => {
  test('epikrisens förslag har läkemedelsberättelsen under Läkemedelsförändringar, och den som läkaren har sparat vid läkemedelsgenomgången går först', () => {
    const db = sandladaKl('13:30');
    // Läkaren sätter in ett läkemedel under vårdtillfället.
    ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0021', dosering: '1 tablett på morgonen', dos: 10, dosEnhet: 'mg', tider: ['08'], typ: 'staende', ordinationsorsak: 'Hjärtsvikt' });
    const f = strukturerad.epikrisForslag(atk(db, 'lak-kard', 'p01', {}, 'skriv_journal'));
    const lm = f.sokord['Läkemedelsförändringar'];
    expect(lm).toContain('Läkemedelsberättelse för vårdtillfället');
    expect(lm).toContain('Insatt: Jardiance');
    expect(lm).toContain('Oförändrade:');
    // Läkaren gör en läkemedelsgenomgång och skriver om berättelsen. Den går först i epikrisen.
    vidimering.sparaGenomgang(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), { berattelse: 'Jardiance insatt för hjärtsvikt. Furosemid oförändrad. Följs upp på vårdcentralen.' });
    const g = strukturerad.epikrisForslag(atk(db, 'lak-kard', 'p01', {}, 'skriv_journal')).sokord['Läkemedelsförändringar'];
    expect(g).toContain('Ur läkemedelsgenomgången');
    expect(g).toContain('av Sara Lindqvist');
    expect(g).toContain('Jardiance insatt för hjärtsvikt. Furosemid oförändrad.');
  });
});

describe('Uppföljning av läkemedel på vårdgivarens nivå', () => {
  test('förskrivning, administrering och utvärdering per läkemedel över alla vårdenheter, utan personuppgifter och bara för uppföljningen', () => {
    const db = sandladaKl('13:30');
    const d = statistik.vardgivarniva(db, personal(db, 'uppf'), { dagar: 365 });
    expect(d).toMatchObject({ niva: 'vardgivare', dagar: 365, minstaAntal: 3 });
    // Flera vårdenheter förskriver, och ett läkemedel med få patienter visas bara med antal vårdenheter.
    expect(d.rader.some(r => r.vardenheter > 1)).toBe(true);
    const fa = d.rader.find(r => r.faPatienter);
    expect(fa).toMatchObject({ patienter: null, forskrivna: null, doser: null });
    // En ny dos räknas in, en makulerad inte.
    const furo = lakemedel.synligaOrdinationer(ssk(db, 'p01', 'las_lakemedel')).find(o => o.lakemedel_id === 'VK-NPL-0010');
    const substans = 'furosemid';
    const fore = statistik.vardgivarniva(db, personal(db, 'uppf'), { dagar: 30 }).rader.find(r => r.substans === substans);
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00') });
    const efter = statistik.vardgivarniva(db, personal(db, 'uppf'), { dagar: 30 }).rader.find(r => r.substans === substans);
    expect(fore.doser).not.toBeNull();
    expect(efter.doser).toBe(fore.doser + 1);
    const a = ssk(db, 'p01');
    stod.makulera(a, 'administrering', ut.id, { orsak: 'Fel patient' }, { kravVardande: administrering.kravVardande, synligaDoser: () => new Set(administrering.synligaAdministreringar(a).map(x => x.id)) });
    expect(statistik.vardgivarniva(db, personal(db, 'uppf'), { dagar: 30 }).rader.find(r => r.substans === substans).doser).toBe(fore.doser);
    // Inga patientuppgifter i svaret.
    const json = JSON.stringify(d);
    for (const p of db.query('SELECT * FROM patienter').all()) for (const x of [p.personnummer, `${p.fornamn} ${p.efternamn}`]) expect(json).not.toContain(x);
    expect(json).not.toMatch(/"p\d\d"/);
    // Läkaren och sjuksköterskan ser inte vårdgivarens nivå, och det loggas.
    expect(fel(() => statistik.vardgivarniva(db, personal(db, 'lak-kard'))).status).toBe(403);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = 'lakemedelsuppfoljning:vardgivare' AND resultat = 'nekad'").get().n).toBe(1);
    expect(statistik.vardgivarniva(db, personal(db, 'uppf'), { dagar: 7 }).dagar).toBe(90);
  });
});

describe('Klinisk läkemedelsprövning', () => {
  test('prövaren inkluderar en patient, systemet registrerar uppmärksamhetsinformationen och varnar vid ordination utanför studien och vid ett läkemedel som protokollet inte tillåter', () => {
    const db = sandladaKl('13:30');
    const lak = (pid = 'p01', id = 'lak-kard') => atk(db, id, pid, {}, 'ordinera');
    const p = provning.forPatient(atk(db, 'lak-kard', 'p01', {}, 'las_oversikt'));
    expect(p.deltaganden).toEqual([]);
    const studie = p.kanInkludera.find(x => x.studienummer === 'DEMO-HF-01');
    expect(studie).toMatchObject({ ansvarig: { namn: 'Göran Malm' }, lakemedel: { id: 'VK-EGEN-0004' } });
    // Prövningsläkemedlet till en patient utan deltagande ger en allvarlig varning.
    const prov = { lakemedelId: 'VK-EGEN-0004', dosering: '1 tablett på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende' };
    const e = fel(() => ordinera(db, 'p01', prov));
    expect(e.extra.kraverKvittens).toContain('utanfor_studie');
    // Inkludering: bara prövare, och systemet lägger in uppmärksamhetsinformationen.
    expect(fel(() => provning.inkludera(lak('p01', 'lak-akut'), { provningId: studie.id })).status).toBe(403);
    const d = provning.inkludera(lak(), { provningId: studie.id, randomiseringskod: 'R-017' }).deltagande;
    expect(d).toMatchObject({ aktiv: true, randomiseringskod: 'R-017', inkluderadAv: 'Sara Lindqvist', provning: { studienummer: 'DEMO-HF-01' } });
    expect(fel(() => provning.inkludera(lak(), { provningId: studie.id })).message).toContain('deltar redan');
    const h = uppmarksamhet.forHuvud(atk(db, 'lak-akut', 'p01', {}, 'las_oversikt'));
    expect(h.symbol.medicinskt).toBe(true);
    expect(h.poster.find(x => x.term === 'Deltar i klinisk prövning DEMO-HF-01')).toBeDefined();
    // Nu ordineras prövningsläkemedlet utan varning om studien, och ges med samma kontroller som andra läkemedel.
    const o = ordinera(db, 'p01', prov);
    expect(administrering.lista(ssk(db, 'p01', 'las_lakemedel')).doser.some(x => x.ordinationId === o.id)).toBe(false);
    // Ett läkemedel som protokollet inte tillåter samtidigt ger en allvarlig varning med prövaren.
    const v = lakemedel.kontroll(lak(), { lakemedelId: 'VK-NPL-0011', dosering: '1 tablett', dos: 25, dosEnhet: 'mg', tider: ['08'], typ: 'staende', ordinationsorsak: 'Hjärtsvikt', start: idag(), uppfoljningsdatum: addDagar(idag(), 30) }).varningar;
    expect(v.find(x => x.regel === 'studie_interaktion').text).toContain('Kontakta ansvarig prövare Göran Malm');
    // Prövarens lista har deltagaren med ordinationen.
    const lista = provning.forProvare(db, personal(db, 'lak-kard'));
    expect(lista.provningar[0].deltagare).toEqual([expect.objectContaining({ patient: expect.objectContaining({ id: 'p01' }), randomiseringskod: 'R-017', ordinationer: 1 })]);
    // Avslutning med orsak avslutar också uppmärksamhetsinformationen.
    expect(fel(() => provning.avsluta(lak(), provning.hamtaDeltagande(db, d.id), {})).extra.falt).toEqual(['orsak']);
    provning.avsluta(lak(), provning.hamtaDeltagande(db, d.id), { orsak: 'Studien avslutad för patienten' });
    expect(uppmarksamhet.forHuvud(atk(db, 'lak-kard', 'p01', {}, 'las_oversikt')).poster.some(x => x.term === 'Deltar i klinisk prövning DEMO-HF-01')).toBe(false);
    expect(() => db.query('DELETE FROM studiedeltagande').run()).toThrow();
  });

  test('prövarens lista räknar bara ordinationer och doser som prövaren får se, utan makulerade doser', () => {
    const db = sandladaKl('13:30');
    const studie = db.query("SELECT * FROM kliniska_provningar WHERE studienummer = 'DEMO-HF-01'").get();
    // Patient 4 har spärrat psykiatrin. Läkaren på kardiologen inkluderar patienten och ordinerar prövningsläkemedlet.
    provning.inkludera(atk(db, 'lak-kard', 'p04', {}, 'ordinera'), { provningId: studie.id });
    const o = ordinera(db, 'p04', { lakemedelId: 'VK-EGEN-0004', dosering: '1 tablett kl. 14', dos: 20, dosEnhet: 'mg', tider: ['14'], typ: 'staende' });
    const ut = administrering.spara(ssk(db, 'p04'), { ordinationId: o.id, planerad: kl('14:00') });
    const rad = () => provning.forProvare(db, personal(db, 'lak-kard')).provningar[0].deltagare.find(x => x.patient.id === 'p04');
    expect(rad()).toMatchObject({ ordinationer: 1, givnaDoser: 1 });
    const fore = JSON.stringify(provning.forProvare(db, personal(db, 'lak-kard')));
    // En ordination och en dos på den spärrade psykiatrin ändrar inte svaret alls.
    const t = new Date().toISOString();
    const psyk = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      VALUES ('p04', 'uso-psyk', 'VK-EGEN-0004', '1 tablett', 20, 'mg', '[]', 0, 'staende', 'Studie', ?, ?, 'lak-psyk', ?) RETURNING id`).get(addDagar(idag(), 30), idag(), t).id;
    db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, status, dos, dos_enhet, antal, tid, utford_av, registrerad, registrerad_av)
      VALUES ('p04', 'uso-psyk', ?, 'VK-EGEN-0004', 'given', 20, 'mg', 1, ?, 'ssk-psyk', ?, 'ssk-psyk')`).run(psyk, t, t);
    expect(JSON.stringify(provning.forProvare(db, personal(db, 'lak-kard')))).toBe(fore);
    // En makulerad dos räknas inte.
    const a = ssk(db, 'p04');
    stod.makulera(a, 'administrering', ut.id, { orsak: 'Fel patient' }, { kravVardande: administrering.kravVardande, synligaDoser: () => new Set(administrering.synligaAdministreringar(a).map(x => x.id)) });
    expect(rad()).toMatchObject({ ordinationer: 1, givnaDoser: 0, senasteDos: null });
  });

  test('ett deltagande på en spärrad vårdenhet syns inte och ger ingen varning som röjer det', () => {
    const db = sandladaKl('13:30');
    // Patient 4 har spärrat psykiatrin. Ett deltagande registrerat där syns inte för kardiologen.
    const studie = db.query("SELECT * FROM kliniska_provningar WHERE studienummer = 'DEMO-HF-01'").get();
    const t = new Date().toISOString();
    db.query("INSERT INTO studiedeltagande (provning_id, patient_id, enhet_id, inkluderad, inkluderad_av) VALUES (?, 'p04', 'uso-psyk', ?, 'lak-psyk')").run(studie.id, t);
    const kard = atk(db, 'lak-kard', 'p04', {}, 'las_oversikt');
    expect(provning.forPatient(kard).deltaganden).toEqual([]);
    const v = lakemedel.kontroll(atk(db, 'lak-kard', 'p04', {}, 'ordinera'), { lakemedelId: 'VK-NPL-0011', dosering: '1 tablett', dos: 25, dosEnhet: 'mg', tider: ['08'], typ: 'staende', ordinationsorsak: 'Hjärtsvikt', start: idag(), uppfoljningsdatum: addDagar(idag(), 30) }).varningar;
    expect(v.some(x => x.regel === 'studie_interaktion')).toBe(false);
    expect(JSON.stringify(v)).not.toContain('DEMO-HF-01');
  });
});

describe('Generella direktiv på vårdgivarens nivå', () => {
  test('den läkare som vårdgivaren har utsett fastställer ett direktiv som gäller alla vårdenheter, och andra får en förklaring', () => {
    const db = sandladaKl('13:30');
    const bas = { niva: 'vardgivare', lakemedelId: 'VK-NPL-0026', indikation: 'Feber eller lätt smärta', dosering: '1 tablett vid behov', dos: 500, dosEnhet: 'mg', maxPerDygn: 4, minstaIntervallTimmar: 6, maxTillfallen: 2,
      maxdosText: 'Högst 2 g per dygn', kontraindikationer: [{ typ: 'bekrafta', text: 'Leversjukdom' }] };
    // Verksamhetschefen fastställer för sin vårdenhet men inte för hela vårdgivaren, och systemet säger vem som gör det.
    const e = fel(() => vagar.faststallDirektiv(db, personal(db, 'vch-kard'), bas));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Det är Sara Lindqvist');
    expect(vagar.direktivLista(db, personal(db, 'lak-kard'))).toMatchObject({ kanFaststalla: false, kanFaststallaVardgivare: true });
    const d = vagar.faststallDirektiv(db, personal(db, 'lak-kard'), bas);
    expect(d).toMatchObject({ vardenhet: { id: 'rol', namn: 'Region Örebro län' }, faststalltAv: 'Sara Lindqvist' });
    // Direktivet gäller på kardiologen, på akuten och på vårdcentralen, men inte i kommunen.
    for (const [ssk, pid] of [['ssk-kard', 'p01'], ['ssk-akut', 'p01'], ['ssk-vc', 'p06']]) {
      const lista = vagar.direktivForPatient(atk(db, ssk, pid, {}, 'las_lakemedel'));
      expect(lista.direktiv.some(x => x.id === d.id)).toBe(true);
      expect(vagar.direktivLista(db, personal(db, ssk)).direktiv.find(x => x.id === d.id)).toMatchObject({ galler: true, vardgivarniva: true });
    }
    expect(vagar.direktivLista(db, personal(db, 'ssk-kard')).direktiv.find(x => x.id === d.id)).toBeDefined();
    // Upphävs bara av den utsedda läkaren.
    expect(fel(() => vagar.upphavDirektiv(db, personal(db, 'vch-kard'), d.id, { orsak: 'Prov' })).status).toBe(403);
    expect(vagar.upphavDirektiv(db, personal(db, 'lak-kard'), d.id, { orsak: 'Ersätts av ett nytt' }).upphavt.av).toBe('Sara Lindqvist');
  });
});

describe('Egenadministrering i slutenvården', () => {
  test('en ordination som patienten sköter själv kommer inte med bland doserna att ge, och sjuksköterskan kvitterar intaget per dostid', () => {
    const db = sandladaKl('13:30');
    // Läkaren ordinerar en tablett som patienten tar själv kl. 14 och kl. 20.
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0021', dosering: '1 tablett kl. 14 och 20', dos: 10, dosEnhet: 'mg', tider: ['14', '20'], typ: 'tillfallig', egenadministrering: true });
    expect(o.egenadministrering).toMatchObject({ av: 'Sara Lindqvist' });
    const l = administrering.lista(ssk(db, 'p01', 'las_lakemedel'));
    expect(l.doser.some(d => d.ordinationId === o.id)).toBe(false);
    const e = l.egenadministrering.find(x => x.ordinationId === o.id);
    expect(e.doser.map(d => [d.planerad, d.status])).toEqual([[kl('14:00'), 'att_kvittera'], [kl('20:00'), 'kommande']]);
    // Sjuksköterskan kvitterar intaget kl. 14, och att patienten inte tog dosen kl. 20 kräver en orsak.
    const deps = { kravVardande: administrering.kravVardande, synligaOrdinationer: lakemedel.synligaOrdinationer, dostider: administrering.dostider, tillaggUt: mallar.tillaggUt };
    const k = egen.kvittera(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00') }, deps);
    expect(k.intag).toMatchObject({ tagen: true, kvitteradAv: 'Johan Ek' });
    expect(fel(() => egen.kvittera(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00') }, deps)).message).toContain('redan kvitterat');
    expect(fel(() => egen.kvittera(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('20:00'), tagen: false }, deps)).extra.falt).toEqual(['orsak']);
    expect(fel(() => egen.kvittera(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('15:00') }, deps)).extra.falt).toEqual(['planerad']);
    setSystemTime(new Date(kl('23:30')));
    const sen = administrering.lista(ssk(db, 'p01', 'las_lakemedel')).egenadministrering.find(x => x.ordinationId === o.id);
    expect(sen.doser.map(d => d.status)).toEqual(['tagen', 'ej_kvitterad']);
    egen.kvittera(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('20:00'), tagen: false, orsak: 'Patienten sov' }, deps);
    expect(administrering.lista(ssk(db, 'p01', 'las_lakemedel')).egenadministrering.find(x => x.ordinationId === o.id).doser[1]).toMatchObject({ status: 'inte_tagen', kvittens: { orsak: 'Patienten sov' } });
    // Nödåtkomst ger inte rätt att kvittera, och ett kvitterat intag ändras inte.
    expect(fel(() => egen.kvittera(atk(db, 'lak-psyk', 'p01', { nodatkomst: { syfte: 'Akut' } }, 'ge_lakemedel'), { ordinationId: o.id, planerad: kl('14:00') }, deps)).status).toBe(403);
    expect(() => db.query('UPDATE egenintag SET tagen = 0').run()).toThrow();
  });

  test('systemet förklarar varför en blodprodukt, en infusion och narkotika inte kan skötas av patienten själv', () => {
    const db = sandladaKl('13:30');
    expect(fel(() => stod.forbered(db, { lakemedelId: 'VK-BLOD-0001', dos: 1, egenadministrering: true })).message).toContain('blodprodukt');
    expect(fel(() => stod.forbered(db, { lakemedelId: 'VK-NPL-0062', dos: 1000, egenadministrering: true })).message).toContain('intravenöst');
    expect(fel(() => stod.forbered(db, { lakemedelId: 'VK-NPL-0031', dos: 5, egenadministrering: true })).message).toContain('narkotika');
    expect(stod.forbered(db, { lakemedelId: 'VK-NPL-0026', dos: 500, egenadministrering: true }).extra.egen).toBe(true);
  });
});

describe('Sammanslagning av journaler med beredning och skanning', () => {
  test('en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt', () => {
    const db = sandladaKl('13:30');
    const t = new Date().toISOString();
    const a = db.query(`INSERT INTO administreringar (patient_id, enhet_id, lakemedel_id, status, registrerad, registrerad_av, iordningstalld_tid, iordningstalld_av, kontrollkod)
      VALUES ('p17', 'uso-kard-72', 'VK-NPL-0032', 'iordningstalld', ?, 'ssk-kard', ?, 'ssk-kard', 'VK-ADM-TEST-P17') RETURNING id`).get(t, t).id;
    const b = db.query(`INSERT INTO beredningar (administrering_id, patient_id, enhet_id, ordination_id, underlag, batch, hallbar_till, beredd_av, beredd_tid, kontroll_kravs)
      VALUES (?, 'p17', 'uso-kard-72', 0, '{}', 'PC1', ?, 'ssk-kard', ?, 0) RETURNING id`).get(a, t, t).id;
    db.query("INSERT INTO administrering_skanning (administrering_id, patient_id, enhet_id, etikett, armband, tid, av) VALUES (?, 'p17', 'uso-kard-72', 'VK-ADM-TEST-P17', 'VKA-P17', ?, 'ssk-kard')").run(a, t);
    slaSamman(db, { fran: 'p17', till: 'p16', personal: personal(db, 'adm-kard'), grund: 'samma_namn_fodd' });
    expect(db.query('SELECT patient_id FROM beredningar WHERE id = ?').get(b).patient_id).toBe('p16');
    expect(db.query('SELECT patient_id FROM administrering_skanning WHERE administrering_id = ?').get(a).patient_id).toBe('p16');
    expect(() => db.query("UPDATE beredningar SET patient_id = 'p01' WHERE id = ?").run(b)).toThrow(/ändras inte/);
  });
});

describe('Vätskebalans framåt i flera dygn', () => {
  test('den förväntade vätskebalansen visas 24, 48 eller 72 timmar framåt, med ackumulerad mängd in och förlusterna för hela perioden', () => {
    const db = sandladaKl('13:30');
    // En stående infusion kl. 14 varje dag, med volym i vätskebalansen.
    ordinera(db, 'p01', { lakemedelId: 'VK-EGEN-0002', dosering: '1000 ml natriumklorid under 8 timmar kl. 14', dos: 1000, dosEnhet: 'ml', tider: ['14'], typ: 'staende', administrationssatt: 'intravenost', volymMl: 1000, vatskebalans: true });
    const a = atk(db, 'ssk-kard', 'p01', {}, 'las_matvarden');
    const p = (timmar) => vyer.vatskebalans(a, { prognosTimmar: timmar }).prognos;
    const egna = (x) => x.poster.filter(q => q.lakemedel === 'Natriumklorid infusion, egendefinierad');
    expect(p(24)).toMatchObject({ timmar: 24, val: [24, 48, 72] });
    expect(egna(p(24)).length).toBe(1);
    expect(egna(p(48)).length).toBe(2);
    expect(egna(p(72)).length).toBe(3);
    // Den ackumulerade mängden in växer post för post, och sista posten är summan in.
    const t72 = p(72);
    expect(t72.poster.at(-1).ackumuleratIn).toBe(t72.summaIn);
    expect(t72.poster.every((q, i) => i === 0 || q.ackumuleratIn >= t72.poster[i - 1].ackumuleratIn)).toBe(true);
    // Förlusterna räknas i samma takt som det senaste dygnet för hela perioden.
    expect(t72.summaUt).toBeCloseTo(p(24).summaUt * 3, 0);
    expect(t72.text).toContain('72 timmarna');
    // En period som inte finns blir 24 timmar.
    expect(p(100).timmar).toBe(24);
  });
});

describe('Beredning och skanning via API', () => {
  test('API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning', async () => {
    app = app ?? testserver();
    const k = klient(app);
    await k.logga('lak-kard');
    const o = await k.post('/api/patient/p01/lakemedel', { lakemedelId: 'VK-EGEN-0002', dosering: '1000 ml natriumklorid med 20 mmol kaliumklorid under 8 timmar', dos: 1000, dosEnhet: 'ml', tider: ['23'],
      typ: 'tillfallig', ordinationsorsak: 'Hypokalemi', uppfoljningsdatum: addDagar(idag(), 3), administrationssatt: 'intravenost', spadning: { volymMl: 1000, tidMin: 480, tillsatser: [{ lakemedelId: 'VK-EGEN-0001', mangd: 20 }] } });
    expect(o.status).toBe(201);
    const id = o.data.ordination.id;
    await k.logga('ssk-kard');
    const lista = await k.get('/api/patient/p01/administreringar');
    const dos = lista.data.doser.find(d => d.ordinationId === id);
    expect(dos.beredning.dubbelkontroll).toBe(true);
    const ior = await k.post('/api/patient/p01/administreringar', { ordinationId: id, planerad: dos.planerad, atgard: 'iordningstall', beredning: { batch: 'K1234' } });
    expect(ior.status).toBe(201);
    const b = ior.data.administrering.beredning;
    const et = await k.get(`/api/patient/p01/administreringar/${ior.data.id}/etikett`);
    expect(et.status).toBe(200);
    expect(et.data.svg).toContain('<svg');
    expect(et.data.svg).toContain(ior.data.administrering.iordningstalld.kontrollkod);
    const pdf = await k.raw('GET', `/api/patient/p01/administreringar/${ior.data.id}/etikett.pdf`);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect((await k.post(`/api/patient/p01/beredningar/${b.id}/kontroll`, {})).status).toBe(400);
    const arm = await k.get('/api/patient/p01/armband');
    expect(arm.data.kod).toBe('VKA-P01');
    expect(arm.data.svg).toContain('<svg');
    // Läkaren på samma vårdenhet kontrollerar beredningen.
    await k.logga('lak-kard');
    const kontroll = await k.post(`/api/patient/p01/beredningar/${b.id}/kontroll`, { batch: 'K1234' });
    expect(kontroll.status).toBe(200);
    await k.logga('ssk-kard');
    const sk = await k.post('/api/patient/p01/administreringar/skanna', { etikett: ior.data.administrering.iordningstalld.kontrollkod, armband: 'VKA-P01' });
    expect(sk.status).toBe(200);
    expect(sk.data.text).toContain('Etiketten och armbandet stämmer');
    // Dostiden ligger i framtiden, så varningen för en för tidig dos kvitteras.
    const geInp = { ordinationId: id, planerad: sk.data.planerad, kontrollkod: sk.data.kontrollkod, armband: sk.data.armband };
    let ge = await k.post('/api/patient/p01/administreringar', geInp);
    if (ge.status === 400 && ge.data.kraverKvittens) ge = await k.post('/api/patient/p01/administreringar', { ...geInp, kvitteradeVarningar: ge.data.kraverKvittens.map(regel => ({ regel, motivering: 'Ges enligt läkarens besked' })) });
    expect(ge.status).toBe(201);
    expect(ge.data.administrering.skannad.armband).toBe(true);
    // Loggen har kontrollen, etiketten och skanningen på patienten.
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    const resurser = db.query("SELECT resurs FROM atkomstlogg WHERE patient_id = 'p01'").all().map(r => r.resurs);
    expect(resurser).toEqual(expect.arrayContaining([`beredning:${b.id}:kontroll`, `etikett:administrering:${ior.data.id}`, `skanning:administrering:${ior.data.id}`, 'armband']));
  });
});
