// Röntgen, ultraljud, klinisk fysiologi och klinisk neurofysiologi i beställning och svar, rättade svar, underlag,
// koder i svar, patientnära analyser, status i Min journal och parametrarna (runda 11, r6, Sussa 4.4.1.5, 4.4.2.2,
// 4.4.2.5 till 4.4.2.8, 4.4.2.11, 4.4.2.13, 4.4.2.14 och 12.1.1.9). Logiken prövas på en sandlåda byggd vid en fast
// tidpunkt (söndag 2026-11-08 kl. 10 svensk tid), så att inget beror på dagens datum eller klockslag.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as labb from '../src/labb.js';
import * as labbFhir from '../src/labb-fhir.js';
import * as undersokningar from '../src/undersokningar.js';
import * as versioner from '../src/labb-svarsversioner.js';
import * as underlag from '../src/labb-underlag.js';
import * as patientnara from '../src/patientnara.js';
import * as konfiguration from '../src/konfiguration.js';
import * as signering from '../src/signering.js';
import * as ps from '../src/produktionssystem.js';
import * as kontroller from '../src/kontroller.js';
import { minBestallningar } from '../src/undersokningar.js';
import { ANALYS, LAB } from '../src/labb-katalog.js';
import { KVA, MATKOD } from '../src/kodverk.js';
import { testserver, klient, sandlada } from './hjalp.js';

const BAS = new Date('2026-11-08T09:00:00Z');
const T = (min) => new Date(BAS.getTime() + min * 60_000);
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const atk = (db, roll, pid, val = {}, handling = 'bestalla_prov') => new Atkomst(db, pers(db, roll), pid, val, handling);
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const egfr = (db, pid, enhet, varde, tid) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES (?, ?, 'egfr', ?, ?, 'mL/min/1,73 m²', ?)").run(pid, enhet, String(varde), varde, tid.toISOString());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const bestall = (db, roll, pid, body, nu = BAS) => undersokningar.bestall(atk(db, roll, pid), { kvitteraDubbletter: true, ...body }, nu);
const rtg = (db) => pers(db, 'rtg-ssk');
const analysId = (b, id) => b.analyser.find(a => a.analys === id).id;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Undersökningar i beställning och svar', () => {
  test('en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id', () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['crp', 'rtg_lungor', 'ul_buk'], anamnes: 'Feber och buksmärta.' });
    const b = r.bestallning;
    expect(b.nummer).toMatch(/^VKB-2026-\d{6}$/);
    expect(b.labb.map(l => l.id).sort()).toEqual(['lab-kem-uso', 'lab-rad-uso', 'lab-ul-uso']);
    // Undersökningarna har ingen provtagning och går direkt till röntgen och ultraljud, med KVÅ och modalitet.
    expect(b.analyser.find(a => a.analys === 'ul_buk')).toMatchObject({ status: 'mottagen', lab: { kort: 'Ultraljud' }, undersokning: { modalitet: 'US', kva: { kod: 'AJ084' } } });
    expect(b.analyser.find(a => a.analys === 'rtg_lungor').undersokning.kva).toEqual({ kod: 'AF053', text: KVA.AF053 });
    expect(b.prov.filter(p => !p.provtagen).map(p => p.ror)).toEqual(['heparin']);
    // Systemet föreslår rutin utan akut vårdkontakt och sätter senaste dag.
    expect(b.prioritet).toMatchObject({ id: 'rutin', senast: new Date(BAS.getTime() + 42 * 86400_000).toISOString() });
    // I FHIR är undersökningen en ServiceRequest i kategorin bilddiagnostik med KVÅ, till röntgenklinikens HSA-id.
    const sr = labbFhir.serviceRequest(db, labb.bestallningRad(db, b.id), db.query('SELECT * FROM labb_analyser WHERE id = ?').get(analysId(b, 'ul_buk')));
    expect(sr.category[0].coding[0]).toEqual({ system: 'http://snomed.info/sct', code: '363679005', display: 'Imaging' });
    expect(sr.code.coding[0]).toMatchObject({ code: 'AJ084' });
    expect(sr.performer[0].identifier.value).toBe(LAB['lab-ul-uso'].hsa);
    expect(sr.specimen).toBeUndefined();
  });

  test('jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit', () => {
    const db = byggSeed(BAS);
    db.query("DELETE FROM matvarden WHERE patient_id = 'p01' AND typ IN ('egfr', 'kreatinin')").run();
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_buk'], anamnes: 'Buksmärta sedan en vecka.' });
    expect(r.kontroller.find(k => k.typ === 'njurfunktion')).toMatchObject({ niva: 'tillagd' });
    expect(r.bestallning.analyser.map(a => a.analys).sort()).toEqual(['dt_buk', 'kreatinin']);
    const id = analysId(r.bestallning, 'dt_buk');
    expect(r.bestallning.analyser.find(a => a.id === id).undersokning.vantar[0].text).toContain('Väntar på P-Kreatinin');
    expect(fel(() => undersokningar.boka(db, rtg(db), id, {}, T(10))).message).toContain('Väntar på P-Kreatinin');
    // Kreatininet tas och besvaras. Ett eGFR under 30 i svaret stoppar bokningen och nämner beställaren.
    const b = labb.bestallningRad(db, r.bestallning.id);
    for (const p of labb.bestallningUt(db, b).prov.filter(x => !x.provtagen)) labb.taProv(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), labb.provRad(db, p.id), T(5));
    labb.forfallnaSvar(db, T(40));
    expect(labb.bestallningUt(db, b).analyser.find(a => a.analys === 'kreatinin').status).toBe('besvarad');
    expect(undersokningar.boka(db, rtg(db), id, {}, T(45)).tid).toBe('2026-11-09T07:00:00.000Z');
  });

  test('jodkontrast: eGFR under 30 stoppar, 30 till 44 kräver kvittens, och ett värde på en spärrad vårdenhet varken räknas eller nämns', () => {
    const db = byggSeed(BAS);
    egfr(db, 'p04', 'uso-kard', 25, T(-60 * 24));
    const e = fel(() => bestall(db, 'lak-kard', 'p04', { analyser: ['dt_torax'], anamnes: 'Hosta.', graviditet: 'nej' }));
    expect(e.status).toBe(409);
    expect(e.kod).toBe('kontroll');
    expect(e.message).toContain('eGFR är 25');
    egfr(db, 'p04', 'uso-kard', 40, T(-60));
    const k = fel(() => bestall(db, 'lak-kard', 'p04', { analyser: ['dt_torax'], anamnes: 'Hosta.', graviditet: 'nej' }));
    expect(k.kod).toBe('kontroll_kvittens');
    expect(k.message).toContain('eGFR är 40');
    // Ett nyare, lägre värde på den spärrade psykiatrin ändrar ingenting i svaret.
    const svar = (val = {}) => JSON.stringify(undersokningar.kontrollera(atk(db, 'lak-kard', 'p04', val), pat(db, 'p04'), ['dt_torax'], { graviditet: 'nej' }, BAS));
    const fore = svar();
    egfr(db, 'p04', 'uso-psyk', 12, T(-30));
    expect(svar()).toBe(fore);
    // Ett nyare värde på en annan vårdenhet, som visas efter ett aktivt val: systemet beställer P-Kreatinin.
    egfr(db, 'p04', 'uso-ort', 50, T(-20));
    const annan = undersokningar.kontrollera(atk(db, 'lak-kard', 'p04'), pat(db, 'p04'), ['dt_torax'], { graviditet: 'nej' }, BAS);
    expect(annan.laggTill).toEqual(['kreatinin']);
    expect(annan.kontroller[0].text).toContain('annan vårdenhet');
    expect(JSON.stringify(annan)).not.toContain('50');
    expect(undersokningar.kontrollera(atk(db, 'lak-kard', 'p04', { andra_enheter: true }), pat(db, 'p04'), ['dt_torax'], { graviditet: 'nej' }, BAS).kontroller[0].text).toContain('eGFR är 50');
    // Med kvittens görs beställningen, och varningen följer med till röntgen.
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_torax'], anamnes: 'Hosta.', kvitteraKontroller: true });
    expect(r.bestallning.kontroller.some(x => x.typ === 'njurfunktion')).toBe(true);
  });

  test('graviditet: systemet frågar bara kvinnor 12 till 55 år före strålning, stoppar strålning mot buken och tar en registrerad graviditet som ja', () => {
    const db = byggSeed(BAS);
    // Elin Sandberg är 49 år. Lungröntgen ger strålning, och systemet frågar.
    const f = fel(() => bestall(db, 'lak-kard', 'p04', { analyser: ['rtg_lungor'], anamnes: 'Hosta.' }));
    expect(f.kod).toBe('fraga');
    expect(f.extra.fraga.id).toBe('graviditet');
    expect(bestall(db, 'lak-kard', 'p04', { analyser: ['rtg_lungor'], anamnes: 'Hosta.', graviditet: 'nej' }).bestallning.kontroller.find(x => x.typ === 'graviditet').niva).toBe('info');
    expect(fel(() => bestall(db, 'lak-kard', 'p04', { analyser: ['rtg_hoft'], anamnes: 'Fall.', graviditet: 'vet_inte' })).message).toContain('Graviditet behöver uteslutas');
    // Ultraljud och magnetkamera ger ingen strålning, och en man får ingen fråga.
    expect(undersokningar.fragorFor(db, pat(db, 'p04'), ['ul_buk'], BAS).graviditet).toBe(false);
    expect(undersokningar.fragorFor(db, pat(db, 'p01'), ['rtg_hoft'], BAS).graviditet).toBe(false);
    // En pågående graviditet som läkaren ser i journalen räknas som ja, utan fråga.
    db.query("INSERT INTO graviditeter (patient_id, enhet_id, registrerad_av, skapad, bpd, bpd_kalla, antal_foster, paritet, status) VALUES ('p04', 'uso-kard', 'lak-kard', ?, '2027-04-01', 'sista_mens', 1, 0, 'pagaende')").run(BAS.toISOString());
    const g = fel(() => bestall(db, 'lak-kard', 'p04', { analyser: ['dt_buk'], anamnes: 'Buksmärta.' }));
    expect(g.kod).toBe('kontroll');
    expect(g.message).toContain('pågående graviditet');
  });

  test('magnetkamera: implantat i uppmärksamhetsinformationen eller enligt beställaren kräver MR-säkerhetskontroll innan röntgen bokar', () => {
    const db = byggSeed(BAS);
    const f = fel(() => bestall(db, 'lak-kard', 'p01', { analyser: ['mr_hjarna'], anamnes: 'Yrsel.' }));
    expect(f.extra.fraga.id).toBe('implantat');
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['mr_hjarna'], anamnes: 'Yrsel.', implantat: 'vet_inte', kvitteraKontroller: true });
    const id = analysId(r.bestallning, 'mr_hjarna');
    expect(fel(() => undersokningar.boka(db, rtg(db), id, {}, BAS)).kod).toBe('mr_kontroll');
    expect(undersokningar.arbetslista(db, rtg(db), BAS).rader.find(x => x.id === id).mrKontroll).toBe(true);
    const b = undersokningar.boka(db, rtg(db), id, { mrKontrollerad: true }, BAS);
    expect(b.text).toContain('MR hjärna är bokad');
    expect(labb.bestallningUt(db, labb.bestallningRad(db, r.bestallning.id)).historik.find(h => h.handelse === 'Bokad').detalj).toContain('MR-säkerheten är kontrollerad');
    // Utan implantat enligt beställaren bokas undersökningen direkt.
    const n = bestall(db, 'lak-kard', 'p01', { analyser: ['mr_kna'], anamnes: 'Knäskada.', implantat: 'nej' });
    expect(undersokningar.boka(db, rtg(db), analysId(n.bestallning, 'mr_kna'), {}, BAS).tid).toBeTruthy();
  });

  test('röntgenklinikens arbetslista: prioritet och senaste dag, föreslagen tid, bokning, utförande med studie i arkivet och loggning med grunden utförande', () => {
    const db = byggSeed(BAS);
    const rutin = bestall(db, 'lak-kard', 'p01', { analyser: ['rtg_kna'], anamnes: 'Knäsmärta.' });
    const akut = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_hjarna'], anamnes: 'Huvudvärk och förvirring.', prioritet: 'akut' });
    const l = undersokningar.arbetslista(db, rtg(db), BAS);
    expect(l.vardenhet.namn).toBe('Röntgenkliniken USÖ');
    expect(l.rader[0]).toMatchObject({ undersokning: 'DT hjärna', prioritet: { id: 'akut' }, fragestallning: 'Huvudvärk och förvirring.', bestallare: { namn: 'Sara Lindqvist' } });
    expect(l.rader[0].senast).toBe(T(120).toISOString());
    // Akut får första lediga tid från nu, rutin från nästa vardag kl. 08.
    expect(l.rader[0].forslag).toBe(BAS.toISOString());
    expect(l.rader.find(x => x.undersokning === 'Röntgen knäled').forslag).toBe('2026-11-09T07:00:00.000Z');
    const id = analysId(akut.bestallning, 'dt_hjarna');
    undersokningar.boka(db, rtg(db), id, {}, BAS);
    // En annan undersökning i samma rum kan inte bokas på samma tid.
    const dt2 = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_buk'], anamnes: 'Buksmärta.', prioritet: 'akut', kvitteraKontroller: true });
    egfr(db, 'p01', 'uso-kard', 80, T(-60));
    expect(fel(() => undersokningar.boka(db, rtg(db), analysId(dt2.bestallning, 'dt_buk'), { tid: BAS.toISOString() }, BAS))?.message ?? '').toMatch(/redan bokad|Väntar/);
    // Runda 13, r3 (E2-45): patientens identitet bekräftas med armbandet eller uttryckligen.
    const utanId = fel(() => undersokningar.registreraUtford(db, rtg(db), id, T(15)));
    expect(utanId.message).toContain('Bekräfta patientens identitet');
    expect(fel(() => undersokningar.registreraUtford(db, rtg(db), id, T(15), { identitet: { armband: 'VKA-P02' } })).message).toContain('hör inte till patienten');
    expect(undersokningar.registreraUtford(db, rtg(db), id, T(15), { identitet: { armband: 'VKA-P01' } }).text).toContain('Radiologen skriver utlåtandet');
    const st = db.query('SELECT * FROM media_studier WHERE patient_id = ? ORDER BY id DESC').get('p01');
    expect(st).toMatchObject({ undersokning: 'dt_hjarna', status: 'besvarad', enhet_id: 'uso-kard' });
    expect(st.uid).toMatch(/^1\.3\.6\.1\.4\.1\.32473\.1\.9\.\d+$/);
    expect(labb.bestallningUt(db, labb.bestallningRad(db, akut.bestallning.id)).analyser[0].statusText).toBe('Gjord, väntar på utlåtande');
    const logg = db.query("SELECT * FROM atkomstlogg WHERE personal_id = 'rtg-ssk' AND patient_id = 'p01'").all();
    expect(logg.length).toBeGreaterThanOrEqual(3);
    expect(logg.every(x => x.grund === 'utforande' && x.handling === 'undersokning_utfora')).toBe(true);
    expect(rutin.bestallning.prioritet.id).toBe('rutin');
  });

  test('arbetslistan och åtgärderna är bara för personalen på den utförande enheten, och skyddad identitet visas utan namn', () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p03', { analyser: ['rtg_kna'], anamnes: 'Knäsmärta.', graviditet: 'nej' });
    const id = analysId(r.bestallning, 'rtg_kna');
    expect(fel(() => undersokningar.arbetslista(db, pers(db, 'ssk-kard'), BAS)).status).toBe(403);
    expect(fel(() => undersokningar.arbetslista(db, pers(db, 'usk-kard'), BAS)).status).toBe(403);
    expect(fel(() => undersokningar.boka(db, pers(db, 'ssk-kard'), id, {}, BAS)).status).toBe(404);
    expect(fel(() => undersokningar.boka(db, pers(db, 'usk-kard'), id, {}, BAS)).status).toBe(403);
    const rad = undersokningar.arbetslista(db, rtg(db), BAS).rader.find(x => x.id === id);
    expect(rad.patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    expect(JSON.stringify(rad)).not.toContain('Engberg');
    expect(JSON.stringify(rad)).not.toContain(pat(db, 'p03').personnummer);
    // Röntgensjuksköterskan läser inte journalen utan vårdrelation.
    expect(new Atkomst(db, rtg(db), 'p01', {}, 'las_journal').prova('las_journal').tillaten).toBe(false);
  });

  test('utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det', () => {
    const db = byggSeed(BAS);
    egfr(db, 'p01', 'uso-kard', 82, T(-60));
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_torax'], anamnes: 'Hemoptys.', svf: 'lungcancer' });
    expect(r.bestallning.prioritet.id).toBe('svf');
    expect(r.bestallning.svf).toMatchObject({ kod: 'VC010', text: KVA.VC010 });
    const id = analysId(r.bestallning, 'dt_torax');
    undersokningar.boka(db, rtg(db), id, {}, BAS);
    // Runda 13, r3 (E2-45): en undersökning som är bokad längre fram kan inte registreras som gjord i förväg.
    const bokad = db.query('SELECT bokad_tid FROM undersokning_bokningar WHERE analys_rad_id = ?').get(id).bokad_tid;
    const tidigt = fel(() => undersokningar.registreraUtford(db, rtg(db), id, new Date(Date.parse(bokad) - 3 * 3600_000), { identitet: { orsak: 'muntligt' } }));
    expect(tidigt?.status).toBe(409);
    expect(tidigt.message).toContain('boka om tiden');
    // Är patienten här tidigare flyttas tiden till nu, och flytten står i historiken.
    const tidigNu = new Date(Date.parse(bokad) - 3 * 3600_000);
    undersokningar.registreraUtford(db, rtg(db), id, new Date(Math.max(tidigNu.getTime(), T(60 * 24).getTime() - 3600_000)), { identitet: { orsak: 'muntligt' }, flyttaTillNu: true });
    expect(db.query('SELECT utford_tid FROM undersokning_bokningar WHERE analys_rad_id = ?').get(id).utford_tid).toBeTruthy();
    expect(undersokningar.simuleraUtlatande(db, rtg(db), id, T(60 * 24 + 5)).text).toContain('väntar på vidimering');
    const b = labb.bestallningUt(db, labb.bestallningRad(db, r.bestallning.id), pers(db, 'lak-kard'), T(60 * 25));
    const a = b.analyser.find(x => x.id === id);
    expect(a.text).toContain('Rundhärd 18 mm');
    expect(a.koder.map(k => [k.system, k.kod])).toEqual([['kva', 'AG009'], ['snomed', '309529002'], ['svf', 'VC010']]);
    expect(a.studie.uid).toMatch(/^1\.3\.6\.1\.4\.1\.32473\.1\.9\.\d+$/);
    expect(a.studie.lank).toBe(`/api/media/studie/${a.studie.id}/visa`);
    expect(b.svfForslag).toContain('välgrundad misstanke');
    expect(b.kan.vidimera).toBe(true);
    // Utlåtandet är signerat av den simulerade röntgenkliniken, och studien i arkivet får utlåtandet.
    expect(db.query('SELECT utlatande FROM media_studier WHERE id = ?').get(a.studie.id).utlatande).toContain('Rundhärd');
    const dr = labbFhir.diagnosticReport(db, labb.bestallningRad(db, r.bestallning.id), 'lab-rad-uso');
    expect(dr.code.coding[0]).toMatchObject({ system: 'urn:oid:1.2.752.116.1.3.2.1.4', code: 'AG009' });
    expect(dr.conclusionCode.map(c => c.coding[0].code)).toEqual(['309529002', 'VC010']);
    expect(dr.imagingStudy[0].identifier.value).toBe(`urn:oid:${a.studie.uid}`);
    labb.vidimera(atk(db, 'lak-kard', 'p01', {}, 'vidimera_provsvar'), labb.bestallningRad(db, r.bestallning.id), T(60 * 26));
    expect(labb.bestallningUt(db, labb.bestallningRad(db, r.bestallning.id)).status).toBe('vidimerad');
  });

  test('demoknappen Simulera svar bokar och gör aldrig röntgenklinikens undersökningar, så att kontrollerna före undersökningen inte kringgås', () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['mr_hjarna', 'ekg'], anamnes: 'Yrsel och hjärtklappning.', implantat: 'ja', kvitteraKontroller: true });
    const b = labb.bestallningRad(db, r.bestallning.id);
    labb.simuleraSvar(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), b, T(5));
    const u = labb.bestallningUt(db, labb.bestallningRad(db, b.id), pers(db, 'lak-kard'), T(6));
    expect(u.analyser.find(a => a.analys === 'ekg').status).toBe('besvarad');
    expect(u.analyser.find(a => a.analys === 'mr_hjarna')).toMatchObject({ status: 'mottagen', undersokning: { bokad: null, utford: null } });
    expect(u.kan.simuleraSvar).toBe(false);
    expect(fel(() => labb.simuleraSvar(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), labb.bestallningRad(db, b.id), T(7))).status).toBe(409);
  });

  test('klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret', () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['arbetsprov'], anamnes: 'Ansträngningsutlöst bröstsmärta.' });
    const a = r.bestallning.analyser[0];
    expect(a.undersokning.bokad.tid).toBe('2026-11-09T07:00:00.000Z');
    expect(a.statusText).toContain('Bokad 2026-11-09 kl. 08:00');
    // Före tiden svarar ingen. Efter tiden och svarstiden kommer utlåtandet med kurvan som PDF.
    expect(labb.forfallnaSvar(db, new Date('2026-11-09T06:00:00Z'))).toBe(0);
    labb.forfallnaSvar(db, new Date('2026-11-09T08:00:00Z'));
    const b = labb.bestallningUt(db, labb.bestallningRad(db, r.bestallning.id));
    expect(b.analyser[0]).toMatchObject({ status: 'besvarad', koder: [{ system: 'kva', kod: 'AF012' }, { system: 'snomed', kod: '281900007' }] });
    expect(b.analyser[0].underlag[0]).toMatchObject({ typ: 'application/pdf', riktning: 'svar' });
    expect(Buffer.from(underlag.rad(db, b.analyser[0].underlag[0].id).data).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt', () => {
    const db = byggSeed(BAS);
    const r = undersokningar.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['kreatinin'], planerad: '2026-11-09T06:00:00.000Z', upprepning: { antal: 4, intervallDagar: 7 }, kvitteraDubbletter: true }, BAS);
    expect(r.serie.map(x => x.planerad)).toEqual(['2026-11-09T06:00:00.000Z', '2026-11-16T06:00:00.000Z', '2026-11-23T06:00:00.000Z', '2026-11-30T06:00:00.000Z']);
    const sista = labb.bestallningUt(db, labb.bestallningRad(db, r.serie[3].id));
    expect(sista.serie).toEqual({ id: r.serie[0].id, nr: 4, antal: 4, intervallDagar: 7 });
    expect(sista.historik.find(h => h.handelse === 'Beställd').detalj).not.toContain('trots varning');
    expect(r.text).toContain('upprepas 4 gånger');
    expect(fel(() => undersokningar.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['kreatinin'], upprepning: { antal: 10, intervallDagar: 14 } }, BAS)).message).toContain('högst 60 dagar');
    expect(fel(() => undersokningar.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['kreatinin'], upprepning: { antal: '3', intervallDagar: 7 } }, BAS)).status).toBe(400);
  });

  test('planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se', async () => {
    const db = byggSeed(BAS);
    bestall(db, 'lak-kard', 'p01', { analyser: ['crp', 'rtg_kna'], anamnes: 'Knäsvullnad.' });
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, orsak) VALUES ('p01', 'uso-ort', 'besok', ?, 'Njursten')").run(T(-60).toISOString());
    bestall(db, 'lak-ort', 'p01', { analyser: ['ul_njurar'], anamnes: 'Njursten.' });
    const a = new Atkomst(db, pers(db, 'lak-kard'), 'p01', {}, 'las_prover');
    const f = labb.forPatient(a, BAS);
    const plan = undersokningar.planerat(f.bestallningar, kontroller.forPatient(new Atkomst(db, pers(db, 'lak-kard'), 'p01', {}, 'las_prover')).kontroller);
    expect(plan.map(x => x.typ)).toEqual(expect.arrayContaining(['prov', 'undersokning']));
    expect(plan.find(x => x.rubrik === 'Röntgen knäled')).toMatchObject({ status: 'Väntar på tid', vardenhet: 'Kardiologiska kliniken USÖ' });
    // Ortopedens beställning visas först efter ett aktivt val.
    expect(plan.some(x => x.rubrik === 'Ultraljud njurar')).toBe(false);
    const med = labb.forPatient(new Atkomst(db, pers(db, 'lak-kard'), 'p01', { andra_enheter: true }, 'las_prover'), BAS);
    expect(undersokningar.planerat(med.bestallningar, []).some(x => x.rubrik === 'Ultraljud njurar')).toBe(true);
  });

  test('standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet', () => {
    const db = byggSeed(BAS);
    db.query("UPDATE vardkontakter SET orsak = 'Hemoptys sedan tre veckor' WHERE patient_id = 'p01' AND slut IS NULL").run();
    const f = undersokningar.forslag(atk(db, 'lak-kard', 'p01'), pat(db, 'p01'), BAS);
    expect(f.svf).toBe('lungcancer');
    expect(f.prioritet).toBe('svf');
    expect(f.vardforlopp.find(x => x.id === 'lungcancer').text).toBe(KVA.VC010);
    egfr(db, 'p01', 'uso-kard', 80, T(-60));
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['dt_torax'], anamnes: 'Hemoptys.', svf: 'lungcancer' });
    const a = db.query('SELECT * FROM labb_analyser WHERE id = ?').get(analysId(r.bestallning, 'dt_torax'));
    const sr = labbFhir.serviceRequest(db, labb.bestallningRad(db, r.bestallning.id), a, { mottagare: true });
    expect(sr.priority).toBe('urgent');
    expect(sr.reasonCode[0].coding[0].code).toBe('VC010');
    expect(fel(() => bestall(db, 'lak-kard', 'p01', { analyser: ['dt_torax'], anamnes: 'x', svf: 'constructor' })).status).toBe(400);
  });
});

describe('Underlag i beställning och svar', () => {
  test('underlag bifogas till beställningen, typen avgörs ur innehållet, med tak per fil och beställning, och visas med beställningens behörighet', async () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['rtg_kna'], anamnes: 'Knäsmärta.', underlag: [{ namn: 'tidigare-bild.png', data: PNG.toString('base64') }] });
    expect(r.bestallning.underlag).toEqual([expect.objectContaining({ namn: 'tidigare-bild.png', typ: 'image/png', riktning: 'bestallning', url: expect.stringMatching(/^\/api\/labb\/underlag\/\d+$/) })]);
    expect(r.bestallning.historik.find(h => h.handelse === 'Underlag bifogat').detalj).toBe('tidigare-bild.png');
    expect(fel(() => bestall(db, 'lak-kard', 'p01', { analyser: ['crp'], underlag: [{ namn: 'x.exe', data: Buffer.from([0, 1, 2, 3]).toString('base64') }] })).message).toContain('Filtypen stöds inte');
    expect(fel(() => bestall(db, 'lak-kard', 'p01', { analyser: ['crp'], underlag: [{ namn: 'stor.txt', data: Buffer.alloc(41 * 1024, 65).toString('base64') }] })).message).toContain('för stort');
    expect(fel(() => bestall(db, 'lak-kard', 'p01', { analyser: ['crp'], underlag: Array.from({ length: 7 }, (_, i) => ({ namn: `${i}.txt`, data: Buffer.from('anteckning').toString('base64') })) })).kod).toBe('tak');
    // Underlaget ändras och raderas aldrig.
    expect(() => db.query('DELETE FROM labb_underlag').run()).toThrow();
    // Röntgenkliniken ser underlaget genom sin arbetslista.
    expect(undersokningar.arbetslista(db, rtg(db), BAS).rader[0].underlag[0].namn).toBe('tidigare-bild.png');
    // API: läkaren på vårdenheten läser filen, och en läkare utan vårdrelation och utan aktivt val får inte.
    const app = testserver();
    try {
      const lak = klient(app); await lak.logga('lak-kard');
      const b = await lak.post('/api/patient/p01/prover', { analyser: ['rtg_kna'], anamnes: 'Knä.', kvitteraDubbletter: true, underlag: [{ namn: 'remiss.txt', data: Buffer.from('Tidigare utlåtande').toString('base64') }] });
      expect(b.status).toBe(201);
      const url = b.data.bestallning.underlag[0].url;
      const f = await lak.raw('GET', url);
      expect(f.status).toBe(200);
      expect(f.data).toBe('Tidigare utlåtande');
      expect(f.headers.get('content-security-policy')).toContain("default-src 'none'");
      const vc = klient(app); await vc.logga('lak-psyk');
      sandlada(app, vc).db = sandlada(app, lak).db;
      expect((await vc.raw('GET', url)).status).toBe(403);
    } finally { app.stopp(); }
  });

  test('underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR', async () => {
    const app = testserver();
    try {
      const sysf = klient(app); await sysf.logga('sysf');
      const lak = klient(app); await lak.logga('lak-kard');
      sandlada(app, sysf).db = sandlada(app, lak).db;
      const nyckel = (await sysf.post('/api/produktionssystem/lab-fys-uso/anslut', {})).data.nyckel;
      const b = (await lak.post('/api/patient/p01/prover', { analyser: ['ekg'], anamnes: 'Hjärtklappning.', kvitteraDubbletter: true })).data.bestallning;
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n');
      const res = await fetch(`${app.url}/ps/DiagnosticReport`, { method: 'POST', headers: { Authorization: `Bearer ${nyckel}`, 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify({ resourceType: 'DiagnosticReport', status: 'final', basedOn: [{ reference: `ServiceRequest/labb-${b.analyser[0].id}` }], conclusion: 'Sinusrytm.',
          code: { coding: [{ system: 'urn:oid:1.2.752.116.1.3.2.1.4', code: 'AF022' }] }, presentedForm: [{ contentType: 'application/pdf', title: 'ekg-kurva.pdf', data: pdf.toString('base64') }] }) });
      expect(res.status).toBe(201);
      const x = (await lak.get('/api/patient/p01/prover')).data.bestallningar.find(y => y.id === b.id);
      expect(x.analyser[0].underlag[0]).toMatchObject({ namn: 'ekg-kurva.pdf', typ: 'application/pdf', kalla: 'Klinisk fysiologi' });
      expect(x.analyser[0].koder[0]).toMatchObject({ system: 'kva', kod: 'AF022', text: KVA.AF022 });
      const dr = (await lak.get(`/fhir/DiagnosticReport/labb-${b.id}-lab-fys-uso`)).data;
      expect(dr.presentedForm[0]).toMatchObject({ contentType: 'application/pdf', title: 'ekg-kurva.pdf' });
    } finally { app.stopp(); }
  });
});

describe('Rättade svar', () => {
  const besvarat = (db) => {
    const r = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['kalium'], kvitteraDubbletter: true }, BAS);
    const b = labb.bestallningRad(db, r.bestallning.id);
    labb.taProv(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), labb.provRad(db, r.bestallning.prov[0].id), T(2));
    labb.forfallnaSvar(db, T(30));
    return { b, a: db.query('SELECT * FROM labb_analyser WHERE bestallning_id = ?').get(b.id) };
  };

  test('ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt', () => {
    const db = byggSeed(BAS);
    const { b, a } = besvarat(db);
    labb.vidimera(atk(db, 'lak-kard', 'p01', {}, 'vidimera_provsvar'), b, T(35));
    const fore = db.query('SELECT m.* FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ?').get(a.id);
    const r = versioner.simuleraRattelse(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), T(60));
    expect(r.version).toBe(2);
    const efter = db.query('SELECT * FROM matvarden WHERE id = ?').get(fore.id);
    expect(efter.varde_num).not.toBe(fore.varde_num);
    expect(efter.vidimerad).toBeNull();
    const u = labb.bestallningUt(db, labb.bestallningRad(db, b.id), pers(db, 'lak-kard'), T(61));
    expect(u.analyser[0]).toMatchObject({ version: 2, vidimerad: null });
    expect(u.analyser[0].tidigare[0]).toMatchObject({ version: 1, orsak: expect.stringContaining('kalibrering'), vidimerad: { av: 'Sara Lindqvist' } });
    expect(u.analyser[0].tidigare[0].text).toContain(String(fore.varde_num).replace('.', ','));
    expect(u.historik.find(h => h.handelse === 'Rättat svar').detalj).toContain('Version 2 ersätter version 1');
    expect(u.kan.vidimera).toBe(true);
    expect(() => db.query('UPDATE labb_svarsversioner SET innehall = ?').run('{}')).toThrow();
    // FHIR: DiagnosticReport har status corrected.
    expect(labbFhir.diagnosticReport(db, labb.bestallningRad(db, b.id), a.lab_id).status).toBe('corrected');
    expect(fel(() => versioner.ratta(db, b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), { varden: [] }, { orsak: '' }, T(70))).status).toBe(400);
  });

  test('demoknappen för ett rättat svar kräver beställningsrätt på den beställande vårdenheten och gäller inte anslutna producentsystem eller instrument', () => {
    const db = byggSeed(BAS);
    const { b, a } = besvarat(db);
    const rad = () => db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id);
    expect(fel(() => versioner.simuleraRattelse(atk(db, 'ssk-kard', 'p01', {}, 'las_prover'), b, rad(), T(60))).status).toBe(403);
    expect(fel(() => versioner.simuleraRattelse(atk(db, 'lak-akut', 'p01', { andra_enheter: true }, 'las_prover'), b, rad(), T(60))).status).toBe(403);
    db.query("INSERT INTO ps_anslutningar (lab_id, standard, skapad, skapad_av, aktiv) VALUES (?, 'HL7 FHIR R4', ?, 'sysf', 1)").run(a.lab_id, BAS.toISOString());
    expect(fel(() => versioner.simuleraRattelse(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), b, rad(), T(60))).status).toBe(409);
    expect(db.query('SELECT count(*) AS n FROM signerade_meddelanden WHERE kalla LIKE ?').get(`labb_analyser:${a.id}:%`).n).toBe(0);
    // Ett patientnära instrument rättar själv sina svar.
    const pn = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['hb_pn'], kvitteraDubbletter: true }, BAS);
    const prov = labb.provRad(db, pn.bestallning.prov[0].id);
    labb.taProv(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), prov, T(1));
    patientnara.mat(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), labb.provRad(db, prov.id), T(2));
    const pa = db.query('SELECT * FROM labb_analyser WHERE bestallning_id = ?').get(pn.bestallning.id);
    expect(fel(() => versioner.simuleraRattelse(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), labb.bestallningRad(db, pn.bestallning.id), pa, T(60))).status).toBe(409);
  });

  test('den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan', () => {
    const db = byggSeed(BAS);
    const { b, a } = besvarat(db);
    versioner.markeraLast(db, pers(db, 'ssk-kard'), b, T(40));
    versioner.simuleraRattelse(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), T(60));
    const rader = versioner.rattadeForPersonal(db, pers(db, 'ssk-kard'), () => ({}));
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({ analys: 'P-Kalium', lastVersion: 1, version: 2 });
    expect(rader[0].text).toContain('Tidigare: Kalium');
    expect(versioner.rattadeForPersonal(db, pers(db, 'usk-kard'), () => ({}))).toEqual([]);
    expect(versioner.rattadeForPersonal(db, pers(db, 'lak-psyk'), () => ({}))).toEqual([]);
    // Markeringen i beställningen för den som läste den äldre versionen.
    expect(labb.bestallningUt(db, labb.bestallningRad(db, b.id), pers(db, 'ssk-kard')).analyser[0].lastAldre.version).toBe(1);
    versioner.kvitteraLast(atk(db, 'ssk-kard', 'p01', {}, 'las_prover'), db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), T(70));
    expect(versioner.rattadeForPersonal(db, pers(db, 'ssk-kard'), () => ({}))).toEqual([]);
  });

  test('producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer', async () => {
    const db = byggSeed(BAS);
    const { b, a } = besvarat(db);
    versioner.simuleraRattelse(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), T(60));
    const bevis = db.query("SELECT id, kalla FROM signerade_meddelanden WHERE kalla LIKE ? ORDER BY tid").all(`labb_analyser:${a.id}%`);
    expect(bevis.map(x => x.kalla)).toEqual([`labb_analyser:${a.id}`, `labb_analyser:${a.id}:v2`]);
    for (const x of bevis) {
      const [, id, v] = x.kalla.split(':');
      expect(signering.kontrolleraBevis(db, x.id, labb.mottagetSvar(db, Number(id), v ?? null)).hel).toBe(true);
    }
    // Ett anslutet producentsystem rättar svaret genom det öppna gränssnittet.
    const app = testserver();
    try {
      const sysf = klient(app); await sysf.logga('sysf');
      const lak = klient(app); await lak.logga('lak-kard');
      sandlada(app, sysf).db = sandlada(app, lak).db;
      const nyckel = (await sysf.post('/api/produktionssystem/lab-kem-uso/anslut', {})).data.nyckel;
      const best = (await lak.post('/api/patient/p01/prover', { analyser: ['natrium'], kvitteraDubbletter: true })).data.bestallning;
      await lak.post(`/api/labb/prov/${best.prov[0].id}/tagen`, {});
      const post = (dr) => fetch(`${app.url}/ps/DiagnosticReport`, { method: 'POST', headers: { Authorization: `Bearer ${nyckel}`, 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(dr) });
      const obs = (v) => ({ resourceType: 'Observation', id: 'n', status: 'final', code: { coding: MATKOD.natrium.coding }, valueQuantity: { value: v } });
      const basedOn = [{ reference: `ServiceRequest/labb-${best.analyser[0].id}` }];
      expect((await post({ resourceType: 'DiagnosticReport', status: 'final', basedOn, contained: [obs(131)], result: [{ reference: '#n' }] })).status).toBe(201);
      expect((await post({ resourceType: 'DiagnosticReport', status: 'final', basedOn, contained: [obs(132)], result: [{ reference: '#n' }] })).status).toBe(400);
      expect((await post({ resourceType: 'DiagnosticReport', status: 'corrected', basedOn, contained: [obs(141)], result: [{ reference: '#n' }] })).status).toBe(400);
      expect((await post({ resourceType: 'DiagnosticReport', status: 'corrected', basedOn, contained: [obs(141)], result: [{ reference: '#n' }], note: [{ text: 'Provet var förväxlat.' }] })).status).toBe(201);
      const x = (await lak.get('/api/patient/p01/prover')).data.bestallningar.find(y => y.id === best.id).analyser[0];
      expect(x.svar[0].varde).toBe(141);
      expect(x.tidigare[0]).toMatchObject({ version: 1, orsak: 'Provet var förväxlat.' });
    } finally { app.stopp(); }
  });
});

describe('Koder i svar', () => {
  test('koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas', () => {
    expect(versioner.provaKoder([{ system: 'kva', kod: 'AG009' }, { system: 'svf', kod: 'VC010' }, { system: 'snomed', kod: '309529002' }]).map(k => k.text))
      .toEqual([KVA.AG009, KVA.VC010, 'Förändring i lungan']);
    // En kod som inte finns i Vårdkällans utdrag tas emot med avsändarens text och märks som okänd.
    expect(versioner.provaKoder([{ system: 'kva', kod: 'AF021', text: 'Doppler ekokardiografi, transtorakal, omfattande' }])[0]).toMatchObject({ kand: false, text: 'Doppler ekokardiografi, transtorakal, omfattande' });
    expect(() => versioner.provaKoder([{ system: 'kva', kod: 'AF021' }])).toThrow(/beskrivning/);
    expect(() => versioner.provaKoder([{ system: 'kva', kod: 'A1' }])).toThrow(/formen/);
    expect(() => versioner.provaKoder([{ system: 'icd', kod: 'I10' }])).toThrow(/okänt kodverk/);
    // Operationskoder med tre bokstäver och två siffror har också KVÅ:s form.
    expect(versioner.provaKoder([{ system: 'kva', kod: 'NFB49' }])[0].kand).toBe(true);
  });
});

describe('Patientnära analyser', () => {
  test('en patientnära analys beställs, provet tas och instrumentet skickar svaret genom det öppna gränssnittet med etiketten', () => {
    const db = byggSeed(BAS);
    const r = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['crp_pn'], kvitteraDubbletter: true }, BAS);
    expect(r.bestallning.labb[0].id).toBe('lab-pn-uso');
    expect(r.bestallning.prov[0].ror).toBe('kapillart');
    const prov = labb.provRad(db, r.bestallning.prov[0].id);
    expect(fel(() => patientnara.mat(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), prov, T(1))).message).toContain('Ta provet först');
    labb.taProv(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), prov, T(1));
    // Det simulerade laboratoriet svarar inte i instrumentets ställe.
    expect(labb.forfallnaSvar(db, T(120))).toBe(0);
    const m = patientnara.mat(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), labb.provRad(db, prov.id), T(3));
    expect(m.text).toContain('Instrumentet har mätt provet');
    const a = m.bestallning.analyser[0];
    expect(a).toMatchObject({ status: 'besvarad', instrument: patientnara.INSTRUMENT.id });
    expect(a.svar[0].typ).toBe('crp');
    expect(db.query("SELECT count(*) AS n FROM ps_meddelanden WHERE lab_id = 'lab-pn-uso' AND typ = 'svar' AND resultat = 'mottaget'").get().n).toBe(1);
    expect(fel(() => patientnara.mat(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), labb.provRad(db, prov.id), T(4))).message).toContain('redan mätt');
  });

  test('instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde', () => {
    const db = byggSeed(BAS);
    const r = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['glukos_pn'], kvitteraDubbletter: true }, BAS);
    const prov = labb.provRad(db, r.bestallning.prov[0].id);
    labb.taProv(atk(db, 'ssk-kard', 'p01', {}, 'ta_prov'), prov, T(1));
    const [dr] = patientnara.svarFor(db, labb.provRad(db, prov.id), T(2));
    expect(fel(() => ps.taEmotSvar(db, 'lab-pn-uso', { ...dr, specimen: [{ identifier: { value: 'VKP99999999' } }] }, T(2))).message).toContain('Etiketten');
    expect(fel(() => ps.taEmotSvar(db, 'lab-kem-uso', dr, T(2))).status).toBe(404);
    // En kontroll av blodsocker på avdelningen bockas av av instrumentets svar.
    kontroller.ordinera(new Atkomst(db, pers(db, 'lak-kard'), 'p01', {}, 'ordinera_kontroll'), { kontroller: ['glukos'], frekvens: 'en_gang', start: T(0).toISOString() }, BAS);
    ps.taEmotSvar(db, 'lab-pn-uso', dr, T(2));
    const k = kontroller.forPatient(new Atkomst(db, pers(db, 'ssk-kard'), 'p01', {}, 'las_prover'), T(5)).kontroller.find(x => x.namn === 'Blodsocker');
    // Ingen uppgift återstår: instrumentets värde har bockat av kontrollen.
    expect(k.nasta).toBeNull();
  });
});

describe('Status i Min journal', () => {
  test('patienten ser beställningarnas status, bokad tid och förberedelse, och svaret först när det är vidimerat', () => {
    const db = byggSeed(BAS);
    const r = bestall(db, 'lak-kard', 'p01', { analyser: ['crp', 'ul_buk'], anamnes: 'Buksmärta.' });
    const id = analysId(r.bestallning, 'ul_buk');
    undersokningar.boka(db, rtg(db), id, {}, BAS);
    const pa = { db, patientId: 'p01' };
    const min = (nu) => minBestallningar(pa, nu).bestallningar.find(x => x.analyser.some(a => a.namn === 'Ultraljud buk'));
    let m = min(BAS);
    expect(m.status).toBe('Beställd');
    const ul = m.analyser.find(a => a.namn === 'Ultraljud buk');
    expect(ul).toMatchObject({ status: 'Tid bokad', tid: '2026-11-09T07:00:00.000Z', plats: 'Ultraljud, Röntgenkliniken USÖ' });
    expect(ul.forberedelse).toContain('Ät och drick inte');
    expect(m.analyser.find(a => a.namn === 'P-CRP').status).toBe('Provet är inte taget än');
    // Inga namn på personalen och inga id.
    expect(JSON.stringify(m)).not.toContain('Sara Lindqvist');
    expect(JSON.stringify(m)).not.toContain(r.bestallning.nummer);
    undersokningar.registreraUtford(db, rtg(db), id, new Date('2026-11-09T07:30:00Z'), { identitet: { orsak: 'muntligt' } });
    undersokningar.simuleraUtlatande(db, rtg(db), id, new Date('2026-11-09T07:35:00Z'));
    m = min(new Date('2026-11-09T08:00:00Z'));
    expect(m.analyser.find(a => a.namn === 'Ultraljud buk')).toMatchObject({ status: 'Läkaren går igenom svaret', utlatande: null });
    labb.vidimera(atk(db, 'lak-kard', 'p01', {}, 'vidimera_provsvar'), labb.bestallningRad(db, r.bestallning.id), new Date('2026-11-09T09:00:00Z'));
    m = min(new Date('2026-11-09T09:05:00Z'));
    expect(m.analyser.find(a => a.namn === 'Ultraljud buk')).toMatchObject({ status: 'Svaret finns', utlatande: expect.stringContaining('Gallblåsa') });
  });

  test('en vårdenhet vars anteckningar inte visas i Min journal visar inte heller sina beställningar', () => {
    const db = byggSeed(BAS);
    const antal = (nu) => minBestallningar({ db, patientId: 'p01' }, nu).bestallningar.filter(x => x.vardenhet === 'Kardiologiska kliniken USÖ').length;
    const fore = antal(BAS);
    bestall(db, 'lak-kard', 'p01', { analyser: ['crp'] });
    expect(antal(BAS)).toBe(fore + 1);
    db.query("INSERT INTO visningsregler (enhet_id, anteckningstyp, visning, dagar, motivering) VALUES ('uso-kard', NULL, 'visas_inte', NULL, 'Test.')").run();
    expect(antal(BAS)).toBe(0);
    db.query("UPDATE visningsregler SET visning = 'fordrojd', dagar = 3 WHERE enhet_id = 'uso-kard' AND anteckningstyp IS NULL").run();
    expect(antal(BAS)).toBe(0);
    expect(antal(T(4 * 24 * 60))).toBeGreaterThanOrEqual(1);
  });
});

describe('Parametrar för beställning och svar', () => {
  test('vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom', () => {
    const db = byggSeed(BAS);
    const godkann = (nyckel, varde) => {
      const f = konfiguration.foresla(db, pers(db, 'sysf'), { nyckel, varde, giltigFran: '2026-11-08', motivering: 'Ändring i testet.' }, BAS);
      expect(() => konfiguration.godkann(db, pers(db, 'sysf'), f.andring.id, {}, BAS)).toThrow();
      konfiguration.godkann(db, pers(db, 'sysf-2'), f.andring.id, {}, BAS);
    };
    const r = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['crp'], kommentar: 'Ring vid avvikande.', kvitteraDubbletter: true }, BAS);
    const a = db.query('SELECT * FROM labb_analyser WHERE bestallning_id = ?').get(r.bestallning.id);
    const b = labb.bestallningRad(db, r.bestallning.id);
    expect(JSON.stringify(labbFhir.serviceRequest(db, b, a, { mottagare: true }))).toContain('Ring vid avvikande');
    godkann('labb.overfor.kommentar', 'nej');
    expect(JSON.stringify(labbFhir.serviceRequest(db, b, a, { mottagare: true }))).not.toContain('Ring vid avvikande');
    // FHIR för personalen visar fortfarande kommentaren.
    expect(JSON.stringify(labbFhir.serviceRequest(db, b, a))).toContain('Ring vid avvikande');
    // Etikettskrivare: Kardiologiska mottagningen skriver på A4-ark tills den läggs till.
    expect(konfiguration.prova('labb.etikettskrivare', 'Avdelningen som inte finns').varfor).toContain('finns inte');
    godkann('labb.etikettskrivare', 'Avdelning 72, kardiologi; Kardiologiska mottagningen');
    expect(konfiguration.varde(db, 'labb.etikettskrivare', BAS)).toEqual(['Avdelning 72, kardiologi', 'Kardiologiska mottagningen']);
    // Anvisningen för glukos slår igenom i provtagningsanvisningen.
    godkann('labb.anvisning.glukos', 'Fasta från midnatt. Vatten går bra.');
    const g = labb.bestall(atk(db, 'lak-kard', 'p01'), { analyser: ['glukos'], kvitteraDubbletter: true }, BAS);
    expect(labb.anvisning(atk(db, 'lak-kard', 'p01', {}, 'las_prover'), labb.bestallningRad(db, g.bestallning.id), BAS).forbered).toEqual(['Fasta från midnatt. Vatten går bra.']);
    expect(konfiguration.prova('labb.anvisning.glukos', 'kort').ok).toBe(false);
  });

  test('etikettformatet följer parametern för arbetsplatsen där den som skriver ut arbetar', async () => {
    const { etikettformatFor } = await import('../src/labb-rutter.js');
    const db = byggSeed(BAS);
    expect(etikettformatFor(db, 'uso-kard-72')).toBe('etikett');
    expect(etikettformatFor(db, 'uso-kard-mott')).toBe('a4');
  });
});

describe('API för undersökningar', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());
  test('läkaren beställer röntgen med frågan om graviditet, röntgensjuksköterskan bokar och registrerar, och Min journal visar statusen', async () => {
    const lak = klient(app); await lak.logga('lak-kard');
    const f = (await lak.get('/api/patient/p04/prover/forslag')).data;
    expect(f.undersokning.prioritet).toBeTruthy();
    expect(f.analyser.find(a => a.id === 'dt_buk')).toMatchObject({ undersokning: true, kontrast: true, stralning: true });
    const fraga = await lak.post('/api/patient/p04/prover', { analyser: ['rtg_kna'], anamnes: 'Knäsmärta.', kvitteraDubbletter: true });
    expect(fraga.status).toBe(409);
    expect(fraga.data.kod ?? fraga.data.fel?.kod).toBeDefined();
    const b = await lak.post('/api/patient/p04/prover', { analyser: ['rtg_kna'], anamnes: 'Knäsmärta.', kvitteraDubbletter: true, graviditet: 'nej' });
    expect(b.status).toBe(201);
    const id = b.data.bestallning.analyser[0].id;
    const rtgK = klient(app); await rtgK.logga('rtg-ssk');
    sandlada(app, rtgK).db = sandlada(app, lak).db;
    const l = (await rtgK.get('/api/undersokningar')).data;
    expect(l.rader.find(r => r.id === id)).toMatchObject({ undersokning: 'Röntgen knäled', fragestallning: 'Knäsmärta.' });
    expect((await lak.get('/api/undersokningar')).status).toBe(403);
    // Runda 13, r3 (E2-45): den bokade tiden är nu, när patienten är på plats, och identiteten bekräftas med armbandet.
    expect((await rtgK.post(`/api/undersokningar/${id}/boka`, {})).status).toBe(200);
    expect((await rtgK.post(`/api/undersokningar/${id}/utford`, { identitet: { armband: 'VKA-P04' } })).status).toBe(409);
    sandlada(app, lak).db.query('UPDATE undersokning_bokningar SET bokad_tid = ? WHERE analys_rad_id = ?').run(new Date().toISOString(), id);
    expect((await rtgK.post(`/api/undersokningar/${id}/utford`, {})).status).toBe(400);
    expect((await rtgK.post(`/api/undersokningar/${id}/utford`, { identitet: { armband: 'VKA-P04' } })).status).toBe(200);
    expect((await rtgK.post(`/api/undersokningar/${id}/simulera-utlatande`, {})).status).toBe(200);
    expect((await rtgK.get('/api/patient/p04/prover')).status).toBe(403);
    const ik = (await lak.get('/api/inkorg')).data;
    expect(ik.provsvarAttVidimera.some(x => x.bestallningId === b.data.bestallning.id)).toBe(true);
    expect(Array.isArray(ik.provsvarRattade)).toBe(true);
    const tab = (await lak.get('/api/patient/p04/prover')).data;
    expect(Array.isArray(tab.planerat)).toBe(true);
  });
});
