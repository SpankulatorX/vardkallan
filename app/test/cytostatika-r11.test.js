// Cytostatika i version 1.1 (runda 11, r4, Sussa 4.8.1.1 till 4.8.1.7): regimbiblioteket med versioner och godkännande
// av en regimansvarig läkare, premedicineringen, den kumulativa dosen, beredningsenheten med arbetslista, lager, batcher,
// spårbarhet och kapacitet, infusionens start, takt, avbrott, reaktioner, extravasering och slut, patientens
// uppföljning i Min journal och uppföljningen i datauttaget. Kardiologiska kliniken på USÖ, vars kurer bereds av
// Cytostatikaberedningen USÖ.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { datumAv, addDagar } from '../src/db.js';
import * as cyto from '../src/cytostatika.js';
import * as bered from '../src/cytostatika-beredning.js';
import * as datauttag from '../src/datauttag.js';
import { InvanareAtkomst } from '../src/patientvy.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';
import { testserver, klient, sandlada as serverSandlada } from './hjalp.js';

const IMORGON = addDagar(datumAv(BAS), 1);
const ENHET = 'uso-kard-72';
const lak = (db, pid = 'k1', h = 'ordinera_cytostatika', val = {}) => atk(db, 'lak-kard', pid, h, val);
const lakGe = (db, pid = 'k1') => atk(db, 'lak-kard', pid, 'ge_cytostatika');
const ssk = (db, pid = 'k1', h = 'ge_cytostatika') => atk(db, 'ssk-kard', pid, h);
const far = (db) => pers(db, 'far-bered');
const pnr = (db, pid = 'k1') => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;
const mv = (db, pid, typ, varde, min = -60) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES (?, ?, ?, ?, ?, ?)').run(pid, ENHET, typ, String(varde), varde, efter(min).toISOString());
function ny(db, id = 'k1', extra = {}) {
  nyPatient(db, { id, enhet: ENHET, ar: 1966, kon: 'K', fornamn: 'Karin', efternamn: 'Kursberg', ...extra });
  mv(db, id, 'langd', 165, -2 * 24 * 60); mv(db, id, 'vikt', 62, -24 * 60);
  mv(db, id, 'lpk', 5.2); mv(db, id, 'tpk', 210); mv(db, id, 'kreatinin', 70);
}
const kur = (b, n = 0) => b.kurer[n];
// En godkänd EC-kur, beredd på beredningsenheten och mottagen på avdelningen, med premedicineringen given.
function berett(db, pid = 'k1', regim = 'ec') {
  const b = cyto.ordinera(lak(db, pid), { regim, start: IMORGON }, BAS);
  cyto.godkann(lak(db, pid), cyto.cykelRad(db, kur(b).id), BAS);
  const ids = kur(b).doser.map(d => d.id);
  const lista = bered.arbetslista(db, far(db), efter(30)).attBereda.flatMap(x => x.doser).filter(x => ids.includes(x.dosId));
  for (const r of lista) bered.bered(db, far(db), r.dosId, r.peroral ? {} : { batch: r.forslag[0].batch, uppmattMl: r.volymLakemedel }, efter(40));
  for (const r of lista.filter(x => !x.peroral)) cyto.taEmot(ssk(db, pid), cyto.dosRad(db, r.dosId), { streckkod: r.etikett }, efter(60));
  return { b, doser: lista };
}
const gePremed = (db, b, pid = 'k1', min = 70) => { for (const p of db.query("SELECT id FROM cyto_premed WHERE patient_id = ? AND status = 'ordinerad'").all(pid)) cyto.gePremed(ssk(db, pid), cyto.premedRad(db, p.id), { armband: pnr(db, pid) }, efter(min)); };
function kontrollerad(db, d, min, pid = 'k1') {
  const las = { armband: pnr(db, pid), streckkod: d.etikett };
  cyto.iordningstall(ssk(db, pid), cyto.dosRad(db, d.dosId ?? d.id), las, efter(min));
  cyto.kontrollera(lakGe(db, pid), cyto.dosRad(db, d.dosId ?? d.id), las, efter(min + 1));
}
const fel = (f) => { try { f(); } catch (e) { return e; } throw new Error('inget fel'); };

describe('Cytostatika i version 1.1', () => {
  test('regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen', () => {
    const db = sandlada();
    ny(db);
    const bib = cyto.regimbibliotek(db, pers(db, 'ol-kard'));
    expect(bib.regimer.map(r => [r.id, r.gallande.version, r.gallande.status])).toEqual([['ec', 1, 'godkand'], ['karboplatin', 1, 'godkand'], ['kapecitabin', 1, 'godkand']]);
    expect(bib.regimansvarig).toBe(false);
    expect(fel(() => cyto.foreslaVersion(db, pers(db, 'ssk-kard'), 'ec', { cykler: 6, motivering: 'Prov' })).status).toBe(403);
    expect(fel(() => cyto.foreslaVersion(db, pers(db, 'ol-kard'), 'ec', { cykler: 6 })).message).toBe('Skriv varför regimen ändras.');
    expect(fel(() => cyto.foreslaVersion(db, pers(db, 'ol-kard'), 'ec', { motivering: 'Ingen ändring' })).message).toContain('likadan');
    // Göran Malm föreslår sex cykler och klemastin som premedicinering. Systemet skriver själv vad som ändras.
    const f = cyto.foreslaVersion(db, pers(db, 'ol-kard'), 'ec', { cykler: 6, premedicinering: ['ondansetron', 'betametason', 'klemastin'], motivering: 'Enligt ny vårdrutin' }, BAS);
    expect(f.version).toMatchObject({ version: 2, status: 'vantar', andring: '4 till 6 cykler, premedicinering med klemastin tillagd.', skapad: { av: 'Göran Malm' } });
    expect(fel(() => cyto.foreslaVersion(db, pers(db, 'lak-kard'), 'ec', { cykler: 5, motivering: 'Annan' })).message).toContain('väntar redan');
    // Den gällande versionen används tills den nya är godkänd.
    expect(cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS)).toMatchObject({ cykler: 4, regim: { version: 1 } });
    // Göran Malm är inte regimansvarig och skrev versionen. Sara Lindqvist är ansvarig för läkemedelsmallar på kliniken.
    expect(fel(() => cyto.godkannVersion(db, pers(db, 'ol-kard'), f.version.id, BAS)).kod).toBe('samma_person');
    expect(cyto.regimbibliotek(db, pers(db, 'lak-kard')).regimer[0].vantande[0].kanGodkanna).toBe(true);
    const g = cyto.godkannVersion(db, pers(db, 'lak-kard'), f.version.id, efter(10));
    expect(g.version).toMatchObject({ status: 'godkand', beslut: { av: 'Sara Lindqvist' } });
    const bib2 = cyto.regimbibliotek(db, pers(db, 'lak-kard')).regimer[0];
    expect([bib2.gallande.version, bib2.tidigare.map(v => [v.version, v.status])]).toEqual([2, [[1, 'ersatt']]]);
    // Den pågående behandlingen behåller version 1, och en ny patient får version 2 med premedicineringen.
    expect(cyto.forPatient(lak(db, 'k1', 'las_cytostatika'), efter(11)).behandlingar[0]).toMatchObject({ cykler: 4, regim: { version: 1 } });
    ny(db, 'k2');
    const b2 = cyto.ordinera(lak(db, 'k2'), { regim: 'ec', start: IMORGON }, efter(12));
    expect(b2).toMatchObject({ cykler: 6, regim: { version: 2 } });
    expect(kur(b2).premedicinering.map(p => p.namn)).toEqual(['Ondansetron', 'Betametason', 'Klemastin']);
    // Ett avslag kräver orsak, och versionen kan inte ändras i databasen.
    const f2 = cyto.foreslaVersion(db, pers(db, 'lak-kard'), 'kapecitabin', { doser: { kapecitabin: 1250 }, motivering: 'Högre dos' }, efter(13));
    expect(fel(() => cyto.avslaVersion(db, pers(db, 'lak-kard'), f2.version.id, { orsak: 'Nej' }, efter(14))).kod).toBe('samma_person');
    expect(fel(() => cyto.avslaVersion(db, pers(db, 'lak-lind'), f2.version.id, {}, efter(14))).message).toContain('avslås');
    expect(cyto.avslaVersion(db, pers(db, 'lak-lind'), f2.version.id, { orsak: 'Dosen är för hög' }, efter(14)).version.status).toBe('avslagen');
    expect(() => db.query("UPDATE cyto_regimversioner SET innehall = '{}' WHERE id = ?").run(f2.version.id)).toThrow('ändras inte');
    // En okänd regim med ett nyckelord från prototypen finns inte.
    expect(fel(() => cyto.foreslaVersion(db, pers(db, 'lak-kard'), 'constructor', { cykler: 2, motivering: 'x y z' })).status).toBe(404);
  });

  test('premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen', () => {
    const db = sandlada();
    ny(db);
    const { b, doser } = berett(db);
    const k = kur(cyto.forPatient(lak(db, 'k1', 'las_cytostatika'), efter(61)).behandlingar[0]);
    expect(k.premedicinering.map(p => [p.namn, p.dos, p.vag, p.status])).toEqual([['Ondansetron', '8 mg', 'peroralt', 'ordinerad'], ['Betametason', '8 mg', 'peroralt', 'ordinerad']]);
    const las = { armband: pnr(db), streckkod: doser[0].etikett };
    expect(fel(() => cyto.iordningstall(ssk(db), cyto.dosRad(db, doser[0].dosId), las, efter(65))).message)
      .toBe('Ge premedicineringen först: ondansetron 8 mg peroralt och betametason 8 mg peroralt, 30 minuter före kuren.');
    expect(fel(() => cyto.gePremed(ssk(db), cyto.premedRad(db, k.premedicinering[0].id), { armband: '191212121212' }, efter(66))).kod).toBe('fel_patient');
    gePremed(db, b);
    expect(fel(() => cyto.gePremed(ssk(db), cyto.premedRad(db, k.premedicinering[0].id), { armband: pnr(db) }, efter(71))).message).toContain('redan given');
    expect(cyto.iordningstall(ssk(db), cyto.dosRad(db, doser[0].dosId), las, efter(100)).kontroll.status).toBe('vantar_kontroll');
    // Ett id-band med reservnummer läses med bokstäverna, och ett tomt id-band godtas aldrig.
    ny(db, 'k6');
    db.query("UPDATE patienter SET personnummer = 'VK196605090077' WHERE id = 'k6'").run();
    const b6 = berett(db, 'k6');
    const p6 = db.query("SELECT id FROM cyto_premed WHERE patient_id = 'k6' ORDER BY id").all();
    expect(fel(() => cyto.gePremed(ssk(db, 'k6'), cyto.premedRad(db, p6[0].id), { armband: '196605090077' }, efter(70))).kod).toBe('fel_patient');
    expect(fel(() => cyto.gePremed(ssk(db, 'k6'), cyto.premedRad(db, p6[0].id), { armband: '' }, efter(70))).kod).toBe('fel_patient');
    expect(cyto.gePremed(ssk(db, 'k6'), cyto.premedRad(db, p6[0].id), { armband: 'vk19660509-0077' }, efter(70)).kurer[0].premedicinering[0].status).toBe('given');
    expect(b6.doser.length).toBe(2);
  });

  test('kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen', () => {
    const db = sandlada();
    ny(db);
    // En tidigare EC-behandling där 830 mg/m² epirubicin är givet.
    const x = db.query("INSERT INTO cyto_behandlingar (patient_id, enhet_id, regim, cykler, start, ordinerad_av, skapad, status) VALUES ('k1', 'uso-kard', 'ec', 4, '2025-01-01', 'lak-kard', '2025-01-01T08:00:00Z', 'avslutad')").run().lastInsertRowid;
    const c = db.query("INSERT INTO cyto_cykler (behandling_id, patient_id, enhet_id, nummer, dag1, langd, vikt, bsa, status) VALUES (?, 'k1', 'uso-kard', 1, '2025-01-01', 165, 62, 1.0, 'klar')").run(x).lastInsertRowid;
    db.query("INSERT INTO cyto_doser (cykel_id, patient_id, enhet_id, lakemedel, ordning, dos_mg, berakning, etikett, status, given_tid) VALUES (?, 'k1', 'uso-kard', 'epirubicin', 1, 830, 'x', 'VKCX0001', 'given', '2025-01-01T09:00:00Z')").run(c);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    expect(b.kumulativ[0]).toMatchObject({ lakemedel: 'Epirubicin', givet: 830, grans: 900, overskrids: true });
    expect(b.kumulativ[0].text).toContain('Gränsen räcker till 0 kurer till.');
    expect(fel(() => cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS))).toMatchObject({ kod: 'kumulativ' });
    expect(fel(() => cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS)).message).toBe('Den kumulativa dosen epirubicin blir 920 mg/m² med den här kuren, över gränsen 900 mg/m² för hela livet. Kuren kan inte godkännas. Minska dosen eller avsluta behandlingen och välj en annan regim.');
    // Med halv dos ryms kuren.
    cyto.dosjustera(lak(db), cyto.cykelRad(db, kur(b).id), { dosandel: 50, orsak: 'Kumulativ dos nära gränsen' }, BAS);
    expect(cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS).kurer[0].status).toBe('godkand');
    // En ny regim med antracyklin ordineras inte när den första kuren skulle passera gränsen.
    db.query("UPDATE cyto_doser SET dos_mg = 900 WHERE etikett = 'VKCX0001'").run();
    db.query("UPDATE cyto_behandlingar SET status = 'avslutad' WHERE patient_id = 'k1'").run();
    expect(fel(() => cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS)).kod).toBe('kumulativ');
    expect(cyto.kumulativGiven(lak(db, 'k1', 'las_cytostatika'), 'epirubicin')).toBe(900);
  });

  test('kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag', () => {
    const db = sandlada();
    ny(db); ny(db, 'k2');
    expect(fel(() => bered.sattKapacitet(db, pers(db, 'far-kard'), { datum: IMORGON, platser: 1 }, BAS)).status).toBe(403);
    expect(bered.sattKapacitet(db, far(db), { datum: IMORGON, platser: 1 }, BAS).kapacitet).toMatchObject({ datum: IMORGON, platser: 1, bokade: 0, lediga: 1 });
    const b1 = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    expect(kur(b1).kapacitet).toMatchObject({ lediga: 1 });
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b1).id), BAS);
    const b2 = cyto.ordinera(lak(db, 'k2'), { regim: 'ec', start: IMORGON }, BAS);
    const e = fel(() => cyto.godkann(lak(db, 'k2'), cyto.cykelRad(db, kur(b2).id), BAS));
    expect(e).toMatchObject({ kod: 'kapacitet', extra: { forslag: addDagar(IMORGON, 1), dagar: 1 } });
    expect(e.message).toBe(`Cytostatikaberedningen USÖ har inga lediga platser ${IMORGON}. Första dag med plats är ${addDagar(IMORGON, 1)}. Skjut upp kuren dit eller kontakta beredningsenheten.`);
    expect(fel(() => bered.sattKapacitet(db, far(db), { datum: IMORGON, platser: 0 }, BAS)).message).toContain('redan godkända');
    cyto.skjutUpp(lak(db, 'k2'), cyto.cykelRad(db, kur(b2).id), { dagar: 1, orsak: 'Beredningsenheten är full' }, BAS);
    expect(cyto.godkann(lak(db, 'k2'), cyto.cykelRad(db, kur(b2).id), BAS).kurer[0].status).toBe('godkand');
    // En vårdenhet utanför USÖ skickar ordern till den simulerade externa beredningen och berörs inte av kapaciteten.
    expect(cyto.beredsInternt(db, 'lind-med')).toBe(false);
    expect(cyto.beredsInternt(db, ENHET)).toBe(true);
  });

  test('beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym', () => {
    const db = sandlada();
    ny(db);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    expect(bered.arbetslista(db, far(db), BAS).attBereda).toEqual([]);
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    // Avdelningen kan inte låta den simulerade externa beredningen bereda en kur från USÖ.
    expect(fel(() => cyto.bered(ssk(db), cyto.cykelRad(db, kur(b).id), BAS)).kod).toBe('intern');
    const a = bered.arbetslista(db, far(db), efter(10));
    expect(a.attBereda.map(x => [x.datum, x.kapacitet.bokade])).toEqual([[IMORGON, 1]]);
    const [epi, cyk] = a.attBereda[0].doser;
    expect(epi).toMatchObject({ lakemedel: 'Epirubicin', dos: 152, volymLakemedel: 76, barare: 'Natriumklorid 9 mg/ml', totalVolym: 176, infusionMinuter: 15, hallbarTimmar: 24,
      patient: { namn: 'Karin Kursberg' }, vardenhet: 'Kardiologiska kliniken USÖ' });
    expect(epi.forslag[0]).toMatchObject({ vara: 'epirubicin', mangd: 76, enhet: 'ml', batch: 'EPIR0001' });
    // Fel batch, utgången batch och en kontrollmätning utanför gränsen stoppar beredningen.
    expect(fel(() => bered.bered(db, far(db), epi.dosId, { uppmattMl: 76 }, efter(20))).message).toContain('Skanna förpackningen');
    expect(fel(() => bered.bered(db, far(db), epi.dosId, { batch: 'CYKL0005', uppmattMl: 76 }, efter(20))).kod).toBe('fel_batch');
    expect(fel(() => bered.bered(db, far(db), epi.dosId, { batch: 'epir0099', uppmattMl: 76 }, efter(20))).kod).toBe('utgangen');
    expect(fel(() => bered.bered(db, far(db), epi.dosId, { batch: 'EPIR0001', uppmattMl: 81 }, efter(20))).message).toBe('Den uppmätta volymen 81 ml avviker 6,6 procent från beräkningen 76 ml. Gränsen är 5 procent. Dra upp på nytt.');
    const r = bered.bered(db, far(db), epi.dosId, { batch: 'EPIR0001', uppmattMl: 75.5 }, efter(21));
    expect(r.dos).toMatchObject({ status: 'beredd', beredning: { av: 'Mona Fredin', uppmattMl: 75.5, avvikelseProcent: 0.7, batcher: [{ batch: 'EPIR0001', mangd: 76, enhet: 'ml' }] } });
    expect(fel(() => bered.bered(db, far(db), epi.dosId, { batch: 'EPIR0001', uppmattMl: 76 }, efter(22))).message).toContain('redan beredd');
    // Avdelningen ser vem som beredde och batchen, och historiken säger det.
    const k = cyto.forPatient(lak(db, 'k1', 'las_cytostatika'), efter(23)).behandlingar[0];
    expect(kur(k).doser[0]).toMatchObject({ status: 'beredd', statusText: 'Beredd', beredning: { av: 'Mona Fredin', batcher: ['EPIR0001'] } });
    expect(k.historik.at(-1)).toMatchObject({ av: 'Mona Fredin', detalj: 'Epirubicin 152 mg beredd och signerad på Cytostatikaberedningen USÖ, batch EPIR0001, kontrollmätt 75,5 ml.' });
    expect(() => db.query('UPDATE cyto_beredningar SET uppmatt_ml = 1').run()).toThrow('ändras inte');
    expect(cyk.forslag[0].batch).toBe('CYKL0003');
  });

  test('lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna', () => {
    const db = sandlada();
    ny(db);
    const l0 = bered.lager(db, far(db), BAS);
    const epi = l0.varor.find(v => v.id === 'epirubicin');
    expect(epi.batcher.map(x => [x.batch, x.status])).toEqual([['EPIR0099', 'utgangen'], ['EPIR0001', 'gar_ut'], ['EPIR0002', 'ok']]);
    expect(epi).toMatchObject({ kvar: 1200, racker: true });
    expect(fel(() => bered.taEmotBatch(db, far(db), { vara: 'epirubicin', batch: 'x', utgang: addDagar(datumAv(BAS), 90) }, BAS)).message).toContain('Batchnumret');
    expect(fel(() => bered.taEmotBatch(db, far(db), { vara: 'epirubicin', batch: 'EPIR0002', utgang: addDagar(datumAv(BAS), 90) }, BAS)).message).toContain('finns redan');
    expect(fel(() => bered.taEmotBatch(db, far(db), { vara: 'epirubicin', batch: 'EPIN2611', utgang: datumAv(BAS) }, BAS)).message).toContain('efter i dag');
    expect(fel(() => bered.taEmotBatch(db, far(db), { vara: '__proto__', batch: 'EPIN2611', utgang: addDagar(datumAv(BAS), 90) }, BAS)).message).toBe('Välj vara.');
    const t = bered.taEmotBatch(db, far(db), { vara: 'epirubicin', batch: 'epin2611', utgang: addDagar(datumAv(BAS), 90), antal: 2 }, BAS);
    expect(t.text).toBe('2 förpackningar Epirubicin 2 mg/ml, batch EPIN2611, är mottagna.');
    const utg = epi.batcher.find(x => x.batch === 'EPIR0099');
    expect(bered.kassera(db, far(db), utg.id, {}, BAS).text).toBe('Batchen EPIR0099 är kasserad, 60 ml.');
    expect(fel(() => bered.kassera(db, far(db), utg.id, {}, BAS)).message).toContain('redan kasserad');
    // Behovet: planerade kurer de kommande två veckorna som inte är beredda.
    cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    expect(bered.lager(db, far(db), BAS).varor.find(v => v.id === 'epirubicin')).toMatchObject({ behov14: 76, racker: true });
    db.query("UPDATE cyto_lager SET kvar = 10 WHERE vara = 'epirubicin'").run();
    expect(bered.lager(db, far(db), BAS).varor.find(v => v.id === 'epirubicin').text).toBe('Räcker inte: kurerna de kommande två veckorna behöver 76 ml. Beställ 1 förpackning.');
    const u = bered.uppfoljning(db, far(db), {}, BAS);
    expect(u).toMatchObject({ kassationer: 1, kasseradMangd: [{ namn: 'Epirubicin 2 mg/ml', mangd: 60, enhet: 'ml' }] });
  });

  test('spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen', () => {
    const db = sandlada();
    ny(db); ny(db, 'k3', { fornamn: 'Skyddad', efternamn: 'Person', skyddad: 1 });
    const a = berett(db);
    const b3 = berett(db, 'k3');
    expect(b3.doser[0].patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    expect(b3.doser[0].etikettText).toContain('Skyddad identitet. Kontrollkod');
    expect(b3.doser[0].etikettText).not.toContain('Person');
    const s = bered.sparbarhet(db, far(db), 'epir0001', efter(90));
    expect(s.batch).toMatchObject({ batch: 'EPIR0001', vara: 'Epirubicin 2 mg/ml' });
    expect(s.doser.map(x => [x.patient.namn, x.vardenhet, x.mangd, x.status])).toEqual([['Karin Kursberg', 'Kardiologiska kliniken USÖ', 76, 'mottagen'], ['Skyddad identitet', 'Kardiologiska kliniken USÖ', 76, 'mottagen']]);
    expect(JSON.stringify(s)).not.toContain('Person');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'far-bered' AND resurs = 'cyto_batch:EPIR0001' AND grund = 'bestallning'").get().n).toBe(2);
    expect(fel(() => bered.sparbarhet(db, far(db), 'FINNS0EJ', efter(90))).status).toBe(404);
    expect(a.doser[0]).toMatchObject({ etikett: expect.stringMatching(/^VKC/) });
  });

  test('säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas', async () => {
    const db = sandlada();
    ny(db);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    for (const f of [() => bered.arbetslista(db, pers(db, 'far-kard'), BAS), () => bered.lager(db, pers(db, 'lak-kard'), BAS), () => bered.sparbarhet(db, pers(db, 'ssk-kard'), 'EPIR0001', BAS),
      () => bered.bered(db, pers(db, 'far-kard'), kur(b).doser[0].id, { batch: 'EPIR0001', uppmattMl: 76 }, BAS)]) expect(fel(f).status).toBe(403);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'far-kard' AND handling = 'bereda_cytostatika' AND resultat = 'nekad'").get().n).toBe(2);
    bered.arbetslista(db, far(db), BAS);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'far-bered' AND patient_id = 'k1' AND grund = 'bestallning'").get().n).toBe(1);
    // Farmaceuten på beredningsenheten har ingen vårdrelation och når inte journalen eller behandlingen.
    expect(fel(() => cyto.forPatient(atk(db, 'far-bered', 'k1', 'las_cytostatika'))).status).toBe(403);
    expect(atk(db, 'far-bered', 'k1', 'las_oversikt').prova('las_oversikt').tillaten).toBe(false);
    // En dos från en vårdenhet utanför USÖ finns inte för beredningsenheten.
    nyPatient(db, { id: 'k4', enhet: 'lind-med', ar: 1970 });
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('k4', 'lind-med', 'langd', '170', 170, ?), ('k4', 'lind-med', 'vikt', '70', 70, ?), ('k4', 'lind-med', 'lpk', '5', 5, ?), ('k4', 'lind-med', 'tpk', '200', 200, ?)")
      .run(efter(-60).toISOString(), efter(-60).toISOString(), efter(-60).toISOString(), efter(-60).toISOString());
    const b4 = cyto.ordinera(atk(db, 'lak-lind', 'k4', 'ordinera_cytostatika'), { regim: 'ec', start: IMORGON }, BAS);
    cyto.godkann(atk(db, 'lak-lind', 'k4', 'ordinera_cytostatika'), cyto.cykelRad(db, kur(b4).id), BAS);
    expect(fel(() => bered.bered(db, far(db), kur(b4).doser[0].id, { batch: 'EPIR0001', uppmattMl: 76 }, BAS)).status).toBe(404);
    expect(JSON.stringify(bered.arbetslista(db, far(db), BAS))).not.toContain(kur(b4).doser[0].etikett);
  });

  test('infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när', () => {
    const db = sandlada();
    ny(db);
    const { b, doser } = berett(db);
    gePremed(db, b);
    const [epi, cyk] = doser;
    kontrollerad(db, epi, 100);
    // Ett anrop som ger en infusion i ett steg finns inte längre: start och slut registreras var för sig.
    expect(fel(() => cyto.ge(ssk(db), cyto.dosRad(db, epi.dosId), efter(102))).kod).toBe('infusion');
    expect(fel(() => cyto.avslutaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), efter(102))).message).toBe('Infusionen har inte startat.');
    const s = cyto.startaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), efter(102));
    expect(kur(s).doser[0]).toMatchObject({ status: 'pagar', takt: 704, volym: 176 });
    expect(fel(() => cyto.pausaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), {}, efter(105))).message).toContain('pausas');
    cyto.pausaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { orsak: 'Patienten behöver gå på toaletten' }, efter(105));
    expect(fel(() => cyto.aterupptaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { procent: 60 }, efter(108))).message).toContain('50, 75 eller 100');
    expect(kur(cyto.aterupptaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { procent: 75 }, efter(108))).doser[0].takt).toBe(528);
    // 704 ml/h i tre minuter och 528 ml/h i fem minuter är 79 ml.
    expect(Math.round(cyto.givnaMl(db, cyto.dosRad(db, epi.dosId), efter(113)))).toBe(79);
    const a = cyto.avslutaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), efter(122));
    const d = kur(a).doser[0];
    expect(d).toMatchObject({ status: 'given', start: efter(102).toISOString(), slut: efter(122).toISOString() });
    expect(d.infusion.map(h => h.typ)).toEqual(['start', 'paus', 'aterupptagen', 'slut']);
    expect(a.historik.at(-1).detalj).toBe('Epirubicin 152 mg given på 20 minuter.');
    // Cyklofosfamiden ges efter epirubicinet, och kuren blir klar när den är avslutad.
    kontrollerad(db, cyk, 125);
    cyto.startaInfusion(lakGe(db), cyto.dosRad(db, cyk.dosId), efter(127));
    expect(kur(cyto.avslutaInfusion(lakGe(db), cyto.dosRad(db, cyk.dosId), efter(160))).status).toBe('klar');
    expect(() => db.query('UPDATE cyto_infusion SET detalj = 1').run()).toThrow('ändras inte');
  });

  test('extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras', () => {
    const db = sandlada();
    ny(db);
    const { b, doser } = berett(db);
    gePremed(db, b);
    const [epi, cyk] = doser;
    kontrollerad(db, epi, 100);
    cyto.startaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), efter(102));
    expect(fel(() => cyto.reaktionInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { typ: 'toString', grad: 1 }, efter(103))).message).toContain('Välj vilken reaktion');
    const r1 = cyto.reaktionInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { typ: 'illamaende', grad: 1 }, efter(103));
    expect(r1.rad).toMatchObject({ atgard: 'fortsatt' });
    expect(kur(r1).doser[0].status).toBe('pagar');
    const r2 = cyto.reaktionInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { typ: 'allergisk', grad: 2 }, efter(104));
    expect([r2.rad.atgard, kur(r2).doser[0].status]).toEqual(['pausa', 'pausad']);
    cyto.aterupptaInfusion(ssk(db), cyto.dosRad(db, epi.dosId), { procent: 50 }, efter(110));
    const x = cyto.extravasering(ssk(db), cyto.dosRad(db, epi.dosId), efter(112));
    expect(x.rad.text).toContain('dexrazoxan ska ges inom sex timmar');
    expect(kur(x).doser[0].status).toBe('avbruten');
    expect(x.historik.at(-1).detalj).toBe('Epirubicin: extravasering efter 35 av 176 ml. Infusionen avbruten.');
    // En avbruten dos räknas i den kumulativa dosen med den del som har gått in.
    expect(Math.round(cyto.kumulativGiven(lak(db, 'k1', 'las_cytostatika'), 'epirubicin'))).toBe(18);
    // Cyklofosfamiden kan ges efter den avbrutna dosen, och en reaktion av grad 3 stoppar infusionen.
    kontrollerad(db, cyk, 120);
    cyto.startaInfusion(ssk(db), cyto.dosRad(db, cyk.dosId), efter(122));
    const r3 = cyto.reaktionInfusion(ssk(db), cyto.dosRad(db, cyk.dosId), { typ: 'andning', grad: 3 }, efter(125));
    expect([r3.rad.atgard, kur(r3).doser[1].status, kur(r3).status]).toEqual(['stoppa', 'avbruten', 'klar']);
    expect(cyto.uppfoljning(db, pers(db, 'lak-kard'), { fran: datumAv(BAS), till: datumAv(BAS) }, efter(130))).toMatchObject({ avbrutna: 2, reaktioner: 3, extravaseringar: 1 });
  });

  test('Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa', () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES ('inv-k1', ?, 'Karin', 'Kursberg', '1966-01-01', 'k1')").run(pnr(db));
    const start = datumAv(BAS);
    const b = cyto.ordinera(lak(db), { regim: 'kapecitabin', start }, BAS);
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    const r = bered.arbetslista(db, far(db), efter(10)).attBereda[0].doser[0];
    expect(r.forslag.map(x => [x.vara, x.mangd])).toEqual([['kapecitabin-500', 84], ['kapecitabin-150', 28]]);
    expect(bered.bered(db, far(db), r.dosId, {}, efter(20)).dos.beredning.batcher.map(x => x.vara)).toEqual(['kapecitabin-500', 'kapecitabin-150']);
    const inv = () => { const a = new InvanareAtkomst(db, db.query("SELECT * FROM invanare WHERE id = 'inv-k1'").get(), 'k1'); a.krav('min:cytostatika'); return a; };
    expect(cyto.minHuvud(inv())).toEqual({ cytostatika: false });
    kontrollerad(db, { dosId: r.dosId, etikett: r.etikett }, 30);
    cyto.ge(ssk(db), cyto.dosRad(db, r.dosId), efter(32));
    expect(cyto.minHuvud(inv())).toEqual({ cytostatika: true });
    const m = cyto.minBehandling(inv(), efter(60));
    expect(m.behandlingar[0]).toMatchObject({ regim: 'Kapecitabin (peroral)', lakemedel: 'Kapecitabin', fran: start, till: addDagar(start, 13), idag: start, tabletter: [{ styrka: 500, antal: 3 }, { styrka: 150, antal: 1 }] });
    expect(m.behandlingar[0].instruktion).toContain('Ta 3 tabletter à 500 mg och 1 tablett à 150 mg morgon och kväll');
    const ok = cyto.minRapport(inv(), { dosId: r.dosId, morgon: true, kvall: false, diarre: 1 }, efter(61));
    expect(ok).toMatchObject({ bedomning: 'ok' });
    expect(cyto.minRapport(inv(), { dosId: r.dosId, morgon: true, kvall: true, feber: '38,4' }, efter(62)).text).toContain('Ring mottagningen nu');
    expect(cyto.minRapport(inv(), { dosId: r.dosId, morgon: true, handfot: 2 }, efter(63)).bedomning).toBe('ring_idag');
    expect(fel(() => cyto.minRapport(inv(), { dosId: r.dosId, morgon: true }, efter(64))).status).toBe(429);
    expect(fel(() => cyto.minRapport(inv(), { dosId: r.dosId, datum: addDagar(start, 1) }, efter(64))).message).toContain('som har varit');
    expect(fel(() => cyto.minRapport(inv(), { dosId: r.dosId, feber: 50, datum: start }, efter(64))).status).toBe(400);
    expect(fel(() => cyto.minRapport(inv(), { dosId: 999999 }, efter(64))).status).toBe(404);
    // Avdelningen ser rapporterna i behandlingen.
    const k = cyto.forPatient(lak(db, 'k1', 'las_cytostatika'), efter(70)).behandlingar[0];
    expect(kur(k).doser[0].patientrapporter.map(x => x.bedomning)).toEqual(['ring_idag', 'ring_nu', 'ok']);
  });

  test('uppföljningen finns i datauttaget med regim, cykel, beredning och batch, och i beredningsenhetens uppföljning, utan personuppgifter', () => {
    const db = sandlada();
    ny(db);
    berett(db);
    const rader = datauttag.bygg(db).data.Cytostatikados.filter(r => r.lakemedel === 'epirubicin');
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({ regim: 'ec', regimversion: 1, cykel: 1, dosandel: 100, dosPerM2: 90, status: 'mottagen', batch: 'EPIR0001', reaktioner: 0, extravasering: false });
    expect(datauttag.kvalitet(datauttag.bygg(db).data).Cytostatikados.godkanda).toBeGreaterThan(0);
    const u = bered.uppfoljning(db, far(db), {}, efter(60));
    expect(u).toMatchObject({ beredningar: 2, kontrollmatningar: 2, overGransen: 0, perVara: [{ id: 'epirubicin', antal: 1 }, { id: 'cyklofosfamid', antal: 1 }] });
    const text = JSON.stringify([rader, u]);
    for (const x of ['k1', 'Karin', 'Kursberg', pnr(db)]) expect(text).not.toContain(x);
    // En spärrad vårdenhets doser kommer inte med i datauttaget.
    sparr(db, 'k1', 'uso-kard');
    expect(datauttag.bygg(db).data.Cytostatikados.filter(r => r.lakemedel === 'epirubicin')).toHaveLength(0);
  });

  test('vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se', () => {
    const db = sandlada();
    ny(db); ny(db, 'k5');
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON }, BAS);
    cyto.ordinera(lak(db, 'k5'), { regim: 'ec', start: IMORGON }, BAS);
    db.query("UPDATE matvarden SET tid = ? WHERE patient_id = 'k5' AND typ IN ('lpk', 'tpk')").run(efter(-5 * 24 * 60).toISOString());
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    const v = cyto.enhetsvy(db, pers(db, 'lak-kard'), () => ({}), BAS);
    expect(v.kurer.map(k => [k.patient.namn, k.nasta])).toEqual([['Karin Kursberg', 'Väntar på beredningen.'], ['Karin Kursberg', 'Proverna före kuren saknas.']]);
    expect(v.beredning).toMatchObject({ enhet: 'Cytostatikaberedningen USÖ', intern: true });
    expect(v.beredning.kapacitet[1]).toMatchObject({ datum: IMORGON, bokade: 1 });
    // En läkare på en annan vårdenhet ser inga av kurerna, och varje patient som visas loggas.
    expect(cyto.enhetsvy(db, pers(db, 'lak-lind'), () => ({}), BAS).kurer).toEqual([]);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'lak-kard' AND resurs = '/api/cytostatika/enhet'").get().n).toBe(2);
  });
});

describe('Cytostatika i version 1.1 via API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    const db = serverSandlada(app, k).db;
    const f = await k.post('/api/cytostatika/regimer/ec/version', { intervall: 28, motivering: 'Längre återhämtning' });
    expect(f.status).toBe(201);
    expect((await k.post(`/api/cytostatika/regimversion/${f.data.version.id}/godkann`, {})).status).toBe(409);
    await k.logga('lak-kard');
    expect((await k.get('/api/inkorg')).data.cytoRegimversioner.map(x => x.id)).toContain(f.data.version.id);
    expect((await k.post(`/api/cytostatika/regimversion/${f.data.version.id}/godkann`, {})).data.version.status).toBe('godkand');
    expect((await k.post(`/api/cytostatika/regimversion/${f.data.version.id}/okand`, {})).status).toBe(404);
    nyPatient(db, { id: 'ka1', enhet: ENHET, ar: 1960, kon: 'K', start: new Date() });
    for (const [t, v] of [['langd', 168], ['vikt', 70], ['lpk', 6], ['tpk', 250]]) db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('ka1', ?, ?, ?, ?, ?)").run(ENHET, t, String(v), v, new Date(Date.now() - 3600_000).toISOString());
    const b = await k.post('/api/patient/ka1/cytostatika', { regim: 'ec', start: datumAv(new Date()) });
    expect(b.data.regim.version).toBe(2);
    expect((await k.get('/api/patient/ka1')).data.specialistR11r4).toEqual({ cytostatika: true, blod: false });
    const cid = b.data.kurer[0].id;
    expect((await k.post(`/api/cytostatika/cykel/${cid}/godkann`, {})).status).toBe(200);
    expect((await k.get('/api/session')).data.r11r4).toEqual({ beredning: false, cytostatika: true });
    expect((await k.get('/api/beredning/arbetslista')).status).toBe(403);
    await k.logga('far-bered');
    expect((await k.get('/api/session')).data.r11r4.beredning).toBe(true);
    expect((await k.get('/api/patient/ka1')).status).toBe(403);
    const a = await k.get('/api/beredning/arbetslista');
    const doser = a.data.attBereda.flatMap(x => x.doser).filter(x => b.data.kurer[0].doser.some(d => d.id === x.dosId));
    for (const x of doser) expect((await k.post(`/api/beredning/dos/${x.dosId}/bered`, { batch: x.forslag[0].batch, uppmattMl: x.volymLakemedel })).status).toBe(200);
    expect((await k.get(`/api/beredning/sparbarhet?batch=${doser[0].forslag[0].batch}`)).data.doser.some(x => x.etikett === doser[0].etikett)).toBe(true);
    await k.logga('ssk-kard');
    const pn = db.query("SELECT personnummer FROM patienter WHERE id = 'ka1'").get().personnummer;
    const kurNu = (await k.get('/api/patient/ka1/cytostatika')).data.behandlingar[0].kurer[0];
    for (const p of kurNu.premedicinering) expect((await k.post(`/api/cytostatika/premed/${p.id}/ge`, { armband: pn })).status).toBe(200);
    const d = doser[0];
    await k.post(`/api/cytostatika/dos/${d.dosId}/ta-emot`, { streckkod: d.etikett });
    const las = { armband: pn, streckkod: d.etikett };
    expect((await k.post(`/api/cytostatika/dos/${d.dosId}/iordningstall`, las)).status).toBe(200);
    await k.logga('lak-kard');
    expect((await k.post(`/api/cytostatika/dos/${d.dosId}/kontrollera`, las)).status).toBe(200);
    expect((await k.post(`/api/cytostatika/dos/${d.dosId}/starta`, {})).data.kurer[0].doser[0].status).toBe('pagar');
    expect((await k.post(`/api/cytostatika/dos/${d.dosId}/avsluta`, {})).data.kurer[0].doser[0].status).toBe('given');
    expect((await k.get('/api/cytostatika/enhet')).data.kurer.some(x => x.patient.id === 'ka1')).toBe(true);
  });
});
