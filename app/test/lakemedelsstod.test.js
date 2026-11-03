// Läkemedelsprocessen, del 2 (runda 6, r2): mallar med flera ordinationer, upp- och nedtrappning, muntlig ordination,
// generella direktiv, spädning och tillsatser, makulering och registrering i efterhand, vätskebalans framåt med
// kalorier och vikt, fler läkemedelstyper med licens, uppföljning, fördjupad läkemedelsgenomgång, vyer över flera
// dygn och förpackningar med NPL-pack-id. Klockan styrs med setSystemTime och sandlådan byggs vid den tiden.
import { describe, test, expect, afterEach, afterAll, setSystemTime } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as administrering from '../src/administrering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as stod from '../src/lakemedelsstod.js';
import * as mallar from '../src/ordinationsmallar.js';
import * as vagar from '../src/ordinationsvagar.js';
import * as uppf from '../src/lakemedelsuppfoljning.js';
import * as vyer from '../src/lakemedelsvyer.js';
import * as fhir from '../src/fhir.js';
import { FORPACKNINGAR } from '../src/seed/forpackningar.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => setSystemTime());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const ordFor = (db, pid, namn) => db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND k.namn LIKE ? AND o.status = 'aktiv' ORDER BY o.id DESC").get(pid, `${namn}%`);
const lak = (db, pid, val = {}) => atk(db, 'lak-kard', pid, val, 'ordinera');
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

describe('Mallar med flera ordinationer', () => {
  test('läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har', () => {
    const db = sandladaKl('13:30');
    const a = lak(db, 'p01');
    expect(vagar.paketLista(a).paket.map(p => p.id)).toEqual(['elkonvertering']);
    const f = vagar.paketForslag(a, 'elkonvertering');
    expect(f.paket).toMatchObject({ namn: 'Inför elkonvertering', faststalltAv: 'Göran Malm', vardenhet: { id: 'uso-kard' } });
    const lage = Object.fromEntries(f.poster.map(x => [x.lakemedel.namn, x.lage]));
    expect(lage).toEqual({ 'Zopiklon Pilum': 'tas_med', Alvedon: 'utesluten', 'Morfin Abcur': 'tas_med' });
    expect(f.poster.find(x => x.lakemedel.namn === 'Alvedon').varfor).toContain('Patienten har redan en aktiv ordination av paracetamol');
    // Gunnar är 81 år: zopiklon och morfin får systemets lägre startdos, och morfinet späds till 1 mg/ml.
    const morfin = f.poster.find(x => x.lakemedel.namn === 'Morfin Abcur');
    expect(morfin.ordination).toMatchObject({ dos: 1, dosEnhet: 'mg', typ: 'vid_behov', ordinationsorsak: 'Smärta efter elkonvertering' });
    expect(morfin.spadning.text).toContain('Dra upp 0,1 ml Morfin Abcur 10 mg/ml');
    const ut = vagar.ordineraPaket(a, 'elkonvertering', {});
    expect(ut.ordinationer.map(o => o.lakemedel.namn)).toEqual(['Zopiklon Pilum', 'Morfin Abcur']);
    expect(ut.utelamnade.map(x => x.lakemedel.namn)).toEqual(['Alvedon']);
    expect(new Set(ut.ordinationer.map(o => o.paket.grupp)).size).toBe(1);
    expect(ut.ordinationer.every(o => o.paket.namn === 'Inför elkonvertering' && o.nll_status === 'kvitterad' && o.forpackning?.nplpackid)).toBe(true);
    expect(ut.ordinationer[0].historik.map(h => h.handelse)).toContain('Ordinerad ur mallen');
  });

  test('ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering', () => {
    const db = sandladaKl('13:30');
    // Patient 4 har inget paracetamol, så Alvedon före elkonverteringen tas med och hänger på vårdhändelsen.
    const a = lak(db, 'p04');
    const f = vagar.paketForslag(a, 'elkonvertering');
    expect(f.poster.find(x => x.lakemedel.namn === 'Alvedon')).toMatchObject({ lage: 'tas_med', vidHandelse: 1 });
    expect(f.vardhandelse.typ).toBe('ny');
    const ut = vagar.ordineraPaket(a, 'elkonvertering', {});
    const alvedon = ut.ordinationer.find(o => o.lakemedel.namn === 'Alvedon');
    expect(alvedon.vardhandelse).toMatchObject({ text: 'Elkonvertering', forskjutningMin: -60, administreras: null });
    expect(alvedon.tider).toEqual([]);
    // Med Waran ger mallen för ortopedin en allvarlig varning för Klexane: den tas bara med med motivering.
    const ort = atk(db, 'lak-ort', 'p01', { nodatkomst: true }, 'ordinera');
    const fo = fel(() => vagar.paketForslag(ort, 'postoperativ-ortopedi'));
    expect(fo).toBeNull();
    const k = vagar.paketForslag(ort, 'postoperativ-ortopedi').poster.find(x => x.lakemedel.namn === 'Klexane');
    expect(k).toMatchObject({ lage: 'kraver_motivering' });
    expect(k.varningar.map(v => v.regel)).toContain('dubbel_antikoagulantia');
  });

  test('säkerhet: mallen gäller bara sin vårdenhet, sjuksköterskan ordinerar inte ur mallar och bara läkare fastställer en mall', () => {
    const db = sandladaKl('13:30');
    const e = fel(() => vagar.paketForslag(lak(db, 'p01'), 'pneumoni'));
    expect(e.status).toBe(403);
    expect(e.message).toContain('fastställd för Infektionskliniken');
    expect(fel(() => vagar.paketLista(atk(db, 'ssk-kard', 'p01', {}, 'ordinera'))).status).toBe(403);
    expect(fel(() => vagar.faststallPaket(db, personal(db, 'ssk-kard'), { namn: 'Egen mall', poster: [{ lakemedelId: 'VK-NPL-0026', orsak: 'Smärta' }] })).status).toBe(403);
    const ny = vagar.faststallPaket(db, personal(db, 'lak-kard'), { namn: 'Hjärtsvikt, inläggning', poster: [{ lakemedelId: 'VK-NPL-0010', orsak: 'Hjärtsvikt' }, { lakemedelId: 'VK-NPL-0025', orsak: 'Magskydd' }] });
    expect(ny).toMatchObject({ namn: 'Hjärtsvikt, inläggning', faststalltAv: 'Sara Lindqvist', vardenhet: { id: 'uso-kard' } });
    expect(vagar.paketLista(lak(db, 'p01')).paket.map(p => p.namn)).toContain('Hjärtsvikt, inläggning');
    // En fastställd mall ändras aldrig och raderas aldrig.
    expect(() => db.query("UPDATE ordinationspaket SET innehall = '[]' WHERE id = 'elkonvertering'").run()).toThrow();
    expect(() => db.query("DELETE FROM ordinationspaket WHERE id = 'elkonvertering'").run()).toThrow();
    const nekade = db.query("SELECT * FROM atkomstlogg WHERE handling = 'faststalla_mall' AND resultat = 'nekad'").all();
    expect(nekade.length).toBe(1);
  });
});

describe('Upp- och nedtrappning', () => {
  test('systemet föreslår ett nedtrappningsschema för kortison och räknar dosen för varje dag i Läkemedel att ge', () => {
    const db = sandladaKl('07:00');
    const lm = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0049'").get();
    const f = stod.trappforslag(lm);
    expect(f.steg.map(s => s.dos)).toEqual([40, 35, 30, 25, 20, 15, 10, 5]);
    expect(f.steg[1]).toMatchObject({ fran: addDagar(idag(), 3), dosering: '35 mg (7 tabletter) på morgonen' });
    expect(f.slut).toBe(addDagar(idag(), 23));
    expect(f.varfor).toContain('binjurarna');
    const o = ordinera(db, 'p01', { lakemedelId: lm.id, ordinationsorsak: 'Giktartrit', trappning: { riktning: 'ned', startdos: 40, steg: 5, dagar: 3, slutdos: 5 } });
    expect(o).toMatchObject({ dos: 40, typ: 'tillfallig', slut: addDagar(idag(), 23), tider: ['08'] });
    expect(o.trappning.steg.length).toBe(8);
    const dos = (dag) => administrering.lista(ssk(db, 'p01', 'las_lakemedel'), { dag }).doser.find(d => d.ordinationId === o.id);
    expect(dos(idag())).toMatchObject({ dos: 40, dosering: 'Steg 1 av 8: 40 mg (8 tabletter) på morgonen' });
    expect(dos(addDagar(idag(), 4))).toMatchObject({ dos: 35, trappning: { steg: 2 } });
    expect(dos(addDagar(idag(), 22)).dos).toBe(5);
    expect(dos(addDagar(idag(), 24))).toBeUndefined();
    // Dosen som ges är dagens dos, utan varning för avvikande dos.
    setSystemTime(new Date(kl('08:00')));
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('08:00') });
    expect(ut.administrering.dos).toBe(40);
    expect(ut.varningar.map(v => v.regel)).not.toContain('avvikande_dos');
    // FHIR: en dosering per steg med period och dos.
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(r.dosageInstruction.length).toBe(8);
    expect(r.dosageInstruction[1]).toMatchObject({ sequence: 2, timing: { repeat: { boundsPeriod: { start: addDagar(idag(), 3), end: addDagar(idag(), 5) } } }, doseAndRate: [{ doseQuantity: { value: 35 } }] });
  });

  test('upptrappning fortsätter med slutdosen, och en dos som inte går att ge med produkten förklaras', () => {
    const db = sandladaKl('07:00');
    const sert = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0041'").get();
    const f = stod.trappforslag(sert);
    expect(f).toMatchObject({ riktning: 'upp', slut: null });
    expect(f.steg.map(s => [s.dos, s.dosering])).toEqual([[25, '25 mg (en halv tablett) på morgonen'], [50, '50 mg (1 tablett) på morgonen']]);
    // En depottablett delas inte: metoprolol i halva depottabletter förklaras.
    const meto = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0008'").get();
    expect(fel(() => stod.beraknaTrappning(meto, { riktning: 'ned', startdos: 50, steg: 25, dagar: 3, slutdos: 25 })).message).toContain('Tabletten eller kapseln delas inte, så varje dos ska vara hela 50 mg.');
    const pred = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0049'").get();
    const e = fel(() => stod.beraknaTrappning(pred, { riktning: 'ned', startdos: 40, steg: 3.75, dagar: 3, slutdos: 5 }));
    expect(e.message).toContain('Dosen 36,25 mg går inte att ge med Prednisolon Pfizer 5 mg tablett. Varje dos ska vara hela eller halva 5 mg.');
    expect(fel(() => stod.beraknaTrappning(pred, { riktning: 'ned', startdos: 5, steg: 5, dagar: 3, slutdos: 40 })).message).toContain('slutdosen vara lägre');
  });
});

describe('Muntlig ordination', () => {
  test('sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination');
    // Läkaren som har ordinerat patientens läkemedel på vårdenheten står först, och underläkaren sist.
    expect(vagar.muntligaLakare(a).map(l => l.id)).toEqual(['lak-kard', 'ol-kard', 'lak-kard2', 'ul-kard']);
    const ut = vagar.registreraMuntlig(a, { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel nu', dos: 20, dosEnhet: 'mg', tider: [], typ: 'tillfallig', ordinationsorsak: 'Kraftig halsbränna och bröstsmärta som inte är hjärtrelaterad', lakareId: 'lak-kard', satt: 'telefon', omedelbar: 'Svåra besvär som behöver behandlas nu' });
    const o = ut.ordination;
    expect(o).toMatchObject({ ordineradAv: { id: 'lak-kard' }, nll_status: 'vantar_signering', uppfoljningsdatum: addDagar(idag(), 1) });
    expect(o.muntlig).toMatchObject({ lakare: { namn: 'Sara Lindqvist' }, mottagenAv: { namn: 'Johan Ek' }, satt: 'telefon', signerad: null });
    expect(o.historik[0].handelse).toBe('Ordinerad per telefon av Sara Lindqvist, dokumenterad av Johan Ek');
    // Inom de första två timmarna får dosen ges, eftersom patienten behöver omedelbar behandling.
    expect(administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'ge' }).administrering.status).toBe('given');
    // Efter två timmar utan signering stoppas nästa dos med en förklaring.
    setSystemTime(new Date(kl('16:00')));
    const e = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'ge', dos: 20 }));
    expect(e.message).toContain('inte signerad av Sara Lindqvist');
    // Raden finns i läkarens inkorg, och bara den läkare som ordinerade signerar.
    const prova = () => true;
    expect(vagar.muntligaAttSignera(db, personal(db, 'lak-kard'), prova).map(r => r.ordinationId)).toEqual([o.id]);
    expect(vagar.muntligaAttSignera(db, personal(db, 'ol-kard'), prova)).toEqual([]);
    const annan = fel(() => vagar.signeraMuntlig(atk(db, 'ol-kard', 'p01', {}, 'ordinera'), lakemedel.hamtaRad(db, o.id)));
    expect(annan.status).toBe(403);
    const s = vagar.signeraMuntlig(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id));
    expect(s.nll.status).toBe('kvitterad');
    expect(s.ordination.muntlig.signerad).toBeTruthy();
    expect(vagar.muntligaAttSignera(db, personal(db, 'lak-kard'), prova)).toEqual([]);
    expect(fel(() => vagar.signeraMuntlig(lak(db, 'p01'), lakemedel.hamtaRad(db, o.id))).message).toContain('redan signerad');
    expect(() => db.query('UPDATE muntliga_ordinationer SET lakare_id = ? WHERE ordination_id = ?').run('ol-kard', o.id)).toThrow();
    // FHIR: läkaren är requester och sjuksköterskan recorder.
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(r.requester.reference).toBe('Practitioner/lak-kard');
    expect(r.recorder.reference).toBe('Practitioner/ssk-kard');
  });

  test('säkerhet: läkaren ska vara på samma vårdenhet, orsaken till omedelbar behandling krävs och undersköterskan och läkaren dokumenterar inte muntligt', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination');
    const bas = { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', ordinationsorsak: 'Magskydd', satt: 'muntligt', omedelbar: 'Kraftig halsbränna' };
    expect(fel(() => vagar.registreraMuntlig(a, { ...bas, lakareId: 'lak-akut' })).data?.falt ?? fel(() => vagar.registreraMuntlig(a, { ...bas, lakareId: 'lak-akut' })).extra.falt).toEqual(['lakareId']);
    expect(fel(() => vagar.registreraMuntlig(a, { ...bas, lakareId: 'lak-kard', omedelbar: '' })).message).toContain('omedelbar behandling');
    expect(fel(() => vagar.registreraMuntlig(atk(db, 'usk-kard', 'p01', {}, 'registrera_muntlig_ordination'), { ...bas, lakareId: 'lak-kard' })).status).toBe(403);
    expect(fel(() => vagar.registreraMuntlig(lak(db, 'p01'), { ...bas, lakareId: 'lak-kard' })).status).toBe(403);
    // Med nödåtkomst ges ingen skrivrätt.
    expect(fel(() => vagar.registreraMuntlig(atk(db, 'ssk-kard', 'p12', { nodatkomst: true }, 'registrera_muntlig_ordination'), { ...bas, lakareId: 'lak-kard' })).status).toBe(403);
    expect(db.query("SELECT count(*) AS n FROM ordinationer WHERE orsak = 'Magskydd' AND patient_id = 'p01' AND skapad >= ?").get(kl('13:00')).n).toBe(0);
  });
});

describe('Generella direktiv', () => {
  test('sjuksköterskan ser vårdenhetens direktiv prövade mot patienten, och systemet förklarar varför ett direktiv inte ryms', () => {
    const db = sandladaKl('13:30');
    const d = vagar.direktivForPatient(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel'));
    const per = Object.fromEntries(d.direktiv.map(x => [x.lakemedel.namn, x]));
    // Avdelning 72 har ett eget direktiv (nitroglycerin) utöver vårdenhetens, och akutens direktiv syns inte.
    expect(Object.keys(per).sort()).toEqual(['Alvedon', 'Nitrolingual', 'Zopiklon Pilum']);
    expect(per.Alvedon.ryms).toBe(false);
    expect(per.Alvedon.varfor[0]).toContain('Patienten har redan en aktiv ordination av paracetamol');
    expect(per['Zopiklon Pilum'].varfor).toEqual(['Patienten är 81 år. Direktivet gäller inte från 75 år.']);
    expect(per.Alvedon).toMatchObject({ maxdosText: 'Högst 3 gram per dygn', maxTillfallen: 3, faststalltAv: 'Göran Malm', indikation: 'Feber eller lätt till måttlig smärta' });
    // Nitroglycerin kräver ett blodtryck det senaste dygnet över 90 mmHg.
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p01', 'uso-kard-72', 'blodtryck', '86/52', null, 'mmHg', ?)").run(kl('13:20'));
    const n1 = vagar.direktivForPatient(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel')).direktiv.find(x => x.lakemedel.namn === 'Nitrolingual');
    expect(n1.varfor).toEqual(['Systoliskt blodtryck är 86 mmHg. Direktivet gäller inte under 90 mmHg.']);
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p01', 'uso-kard-72', 'blodtryck', '128/76', null, 'mmHg', ?)").run(kl('13:25'));
    const n2 = vagar.direktivForPatient(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel')).direktiv.find(x => x.lakemedel.namn === 'Nitrolingual');
    expect(n2).toMatchObject({ ryms: true, bekrafta: ['Potensläkemedel det senaste dygnet'] });
  });

  test('sjuksköterskan ordinerar inom direktivet med bedömning, och antalet tillfällen utan läkarkontakt räknas', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p04', {}, 'ordinera_direktiv');
    const zop = vagar.direktivForPatient(atk(db, 'ssk-kard', 'p04', {}, 'las_lakemedel')).direktiv.find(x => x.lakemedel.namn === 'Zopiklon Pilum');
    expect(zop.ryms).toBe(true);
    expect(fel(() => vagar.ordineraEnligtDirektiv(a, zop.id, { bedomning: 'Kan inte sova' })).message).toContain('sömnapné eller svår andningssvikt');
    expect(fel(() => vagar.ordineraEnligtDirektiv(a, zop.id, { bekraftade: zop.bekrafta })).message).toContain('Skriv din bedömning');
    const ut = vagar.ordineraEnligtDirektiv(a, zop.id, { bedomning: zop.bedomningForslag, bekraftade: zop.bekrafta });
    expect(ut.ordination).toMatchObject({ ordineradAv: { id: 'ssk-kard' }, typ: 'vid_behov', slut: addDagar(idag(), 1), ordinationsorsak: 'Enligt generellt direktiv: Tillfälliga sömnsvårigheter under vårdtiden' });
    expect(ut.ordination.direktiv).toMatchObject({ indikation: 'Tillfälliga sömnsvårigheter under vårdtiden', maxTillfallen: 1, faststalltAv: 'Göran Malm' });
    administrering.spara(ssk(db, 'p04'), { ordinationId: ut.ordination.id, atgard: 'ge' });
    setSystemTime(new Date(kl('23:30')));
    const e = fel(() => administrering.spara(ssk(db, 'p04'), { ordinationId: ut.ordination.id, atgard: 'ge', kvitteradeVarningar: [{ regel: 'dubbel_dos', motivering: 'Test' }, { regel: 'max_per_dygn', motivering: 'Test' }] }));
    expect(e.message).toContain('tillåter 1 tillfälle utan att läkare kontaktas');
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, ut.ordination.id));
    expect(r.note.map(n => n.text).join(' ')).toContain('Ordinerad enligt generellt direktiv');
  });

  test('bara läkaren fastställer och upphäver ett direktiv för sin vårdenhet, med det som 6 kap. 6 § kräver', () => {
    const db = sandladaKl('13:30');
    const bas = { lakemedelId: 'VK-NPL-0025', indikation: 'Halsbränna', dosering: '1 kapsel vid behov', dos: 20, dosEnhet: 'mg', maxPerDygn: 1, minstaIntervallTimmar: 20, maxTillfallen: 1, maxdosText: 'Högst 20 mg per dygn', kontraindikationer: [{ typ: 'bekrafta', text: 'Svart avföring eller blodkräkning' }] };
    expect(fel(() => vagar.faststallDirektiv(db, personal(db, 'ssk-kard'), bas)).status).toBe(403);
    expect(fel(() => vagar.faststallDirektiv(db, personal(db, 'lak-kard'), { ...bas, enhetId: 'uso-akut' })).extra.falt).toEqual(['enhetId']);
    expect(fel(() => vagar.faststallDirektiv(db, personal(db, 'lak-kard'), { ...bas, kontraindikationer: [] })).extra.falt).toEqual(['kontraindikationer']);
    expect(fel(() => vagar.faststallDirektiv(db, personal(db, 'lak-kard'), { ...bas, giltigtTill: addDagar(idag(), 400) })).extra.falt).toEqual(['giltigtTill']);
    const d = vagar.faststallDirektiv(db, personal(db, 'lak-kard'), { ...bas, enhetId: 'uso-kard-72' });
    expect(d).toMatchObject({ faststalltAv: 'Sara Lindqvist', vardenhet: { id: 'uso-kard-72' }, administrationssatt: 'peroralt', dosering: '1 kapsel vid behov, högst 1 gånger per dygn' });
    expect(vagar.direktivForPatient(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel')).direktiv.map(x => x.id)).toContain(d.id);
    expect(fel(() => vagar.upphavDirektiv(db, personal(db, 'ssk-kard'), d.id, { orsak: 'Test' })).status).toBe(403);
    expect(vagar.upphavDirektiv(db, personal(db, 'lak-kard'), d.id, { orsak: 'Ersätts av ordination' }).upphavt).toMatchObject({ av: 'Sara Lindqvist', orsak: 'Ersätts av ordination' });
    expect(vagar.direktivForPatient(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel')).direktiv.map(x => x.id)).not.toContain(d.id);
    expect(() => db.query("UPDATE generella_direktiv SET innehall = '{}' WHERE id = ?").run(d.id)).toThrow();
    // Läkaren ordinerar själv och använder inte direktiven, och en sjuksköterska på en annan vårdenhet når dem inte.
    expect(fel(() => vagar.ordineraEnligtDirektiv(lak(db, 'p01'), 1, { bedomning: 'Test' })).status).toBe(403);
    expect(fel(() => vagar.ordineraEnligtDirektiv(atk(db, 'ssk-akut', 'p02', {}, 'ordinera_direktiv'), 1, { bedomning: 'Test' })).status).toBe(403);
  });
});

describe('Spädning och tillsatser', () => {
  test('systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet', () => {
    const db = sandladaKl('13:30');
    const lm = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0032'").get();
    expect(stod.spadningsforslag(lm, 3, 'g')).toMatchObject({ losning: 'natriumklorid 9 mg/ml', volymMl: 100, tidMin: 30 });
    const o = ordinera(db, 'p04', { lakemedelId: lm.id, dosering: '3 g intravenöst 3 gånger per dygn', dos: 3, dosEnhet: 'g', tider: ['14', '22'], typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { losning: 'glukos 50 mg/ml', volymMl: 100, tidMin: 30 } });
    expect(o.spadning).toMatchObject({ totalVolymMl: 100, koncentrationMgMl: 30, hastighetMlH: 200 });
    expect(o.spadning.text).toBe('Lös 3 g Bensylpenicillin Noridem i 100 ml glukos 50 mg/ml. Koncentration 30 mg/ml. Ges under 30 minuter, 200 ml per timme.');
    const dos = administrering.lista(ssk(db, 'p04', 'las_lakemedel')).doser.find(d => d.ordinationId === o.id);
    expect(dos.spadning.text).toContain('200 ml per timme');
    // För koncentrerat: systemet säger hur stor volymen minst ska vara.
    const e = fel(() => stod.valideraSpadning(db, lm, 3, 'g', { losning: 'natriumklorid 9 mg/ml', volymMl: 40, tidMin: 30 }));
    expect(e.message).toContain('Koncentrationen blir 75 mg/ml');
    expect(e.message).toContain('Öka volymen till minst 50 ml');
    expect(fel(() => stod.valideraSpadning(db, lm, 3, 'g', { losning: 'vatten', volymMl: 100 })).message).toContain('späds i natriumklorid 9 mg/ml eller glukos 50 mg/ml');
    // FHIR: spädningen i doseringen och hastigheten.
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(r.dosageInstruction[0].doseAndRate[0].rateQuantity).toMatchObject({ value: 200, code: 'mL/h' });
  });

  test('en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen', () => {
    const db = sandladaKl('13:30');
    const nacl = db.query("SELECT * FROM katalog WHERE id = 'VK-EGEN-0002'").get();
    const o = ordinera(db, 'p01', { lakemedelId: nacl.id, dosering: '1000 ml under 8 timmar', dos: 1000, dosEnhet: 'ml', tider: ['14'], typ: 'tillfallig', administrationssatt: 'intravenost', spadning: { volymMl: 1000, tidMin: 480, tillsatser: [{ lakemedelId: 'VK-EGEN-0001', mangd: 20 }] } });
    expect(o.spadning).toMatchObject({ totalVolymMl: 1020, hastighetMlH: 127.5 });
    expect(o.spadning.tillsatser[0]).toMatchObject({ namn: 'kaliumklorid', perLiter: 19.6, perTimme: 2.5 });
    expect(o.volymMl).toBe(1020);
    expect(o.nll_status).toBe('ej_aktuell');
    expect(fel(() => stod.valideraSpadning(db, nacl, 1000, 'ml', { volymMl: 1000, tidMin: 480, tillsatser: [{ lakemedelId: 'VK-EGEN-0001', mangd: 60 }] })).message).toContain('Högst 40 mmol/l');
    expect(fel(() => stod.valideraSpadning(db, nacl, 1000, 'ml', { volymMl: 1000, tidMin: 60, tillsatser: [{ lakemedelId: 'VK-EGEN-0001', mangd: 20 }] })).message).toContain('förläng infusionstiden');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00') });
    expect(administrering.vatskebalans(ssk(db, 'p01', 'las_matvarden')).poster.find(p => p.administreringId === ut.id).volymMl).toBe(1020);
  });
});

describe('Registrering i efterhand och makulering', () => {
  test('en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00') });
    const synliga = (a) => () => new Set(administrering.synligaAdministreringar(a).map(x => x.id));
    const a = ssk(db, 'p01');
    expect(fel(() => stod.makulera(a, 'administrering', ut.id, { orsak: '' }, { kravVardande: administrering.kravVardande, synligaDoser: synliga(a) })).message).toContain('varför registreringen makuleras');
    const m = stod.makulera(a, 'administrering', ut.id, { orsak: 'Registrerad på fel patient' }, { kravVardande: administrering.kravVardande, synligaDoser: synliga(a) });
    expect(m.makulerad).toMatchObject({ av: 'Johan Ek', orsak: 'Registrerad på fel patient' });
    const l = administrering.lista(ssk(db, 'p01', 'las_lakemedel'));
    expect(l.doser.find(d => d.ordinationId === furo.id && d.planerad === kl('14:00'))).toMatchObject({ status: 'att_ge', forslag: 'ge' });
    expect(l.senaste.find(x => x.id === ut.id).makulerad.orsak).toBe('Registrerad på fel patient');
    // Dosen kan ges igen utan varning för dubbel dos.
    expect(administrering.kontroll(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00') }).varningar).toEqual([]);
    expect(fel(() => stod.makulera(a, 'administrering', ut.id, { orsak: 'Igen' }, { kravVardande: administrering.kravVardande, synligaDoser: synliga(a) })).message).toContain('redan makulerad');
    expect(() => db.query('DELETE FROM administreringar WHERE id = ?').run(ut.id)).toThrow();
    expect(() => db.query('DELETE FROM makuleringar').run()).toThrow();
    expect(fhir.medicationAdministration(db, db.query('SELECT * FROM administreringar WHERE id = ?').get(ut.id))).toMatchObject({ status: 'entered-in-error' });
  });

  test('ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const ior = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00'), atgard: 'iordningstall', tid: kl('12:45') });
    expect(ior.administrering).toMatchObject({ status: 'iordningstalld', efterhand: true, iordningstalld: { tid: kl('12:45') } });
    expect(ior.administrering.registrerad).toBe(kl('13:30'));
    const v = administrering.registreraVatska(atk(db, 'ssk-kard', 'p01', {}, 'registrera_matvarde'), { riktning: 'in', typ: 'dryck', volymMl: 250, tid: kl('12:00') });
    const a = atk(db, 'ssk-kard', 'p01', {}, 'registrera_matvarde');
    stod.makulera(a, 'vatskebalans', v.id, { orsak: 'Dubbelregistrerad' }, { kravVardande: administrering.kravVardande, synligaDoser: () => new Set() });
    const vb = administrering.vatskebalans(atk(db, 'ssk-kard', 'p01', {}, 'las_matvarden'));
    expect(vb.poster.find(p => p.id === v.id).makulerad.orsak).toBe('Dubbelregistrerad');
    expect(vb.summaIn).toBe(vb.poster.filter(p => p.riktning === 'in' && !p.makulerad).reduce((s, p) => s + p.volymMl, 0));
  });

  test('säkerhet: en annan vårdenhet, nödåtkomst och en spärrad dos kan inte makuleras, och nekade försök loggas', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: furo.id, planerad: kl('14:00') });
    const hj = (a) => ({ kravVardande: administrering.kravVardande, synligaDoser: () => new Set(administrering.synligaAdministreringar(a).map(x => x.id)) });
    const akut = atk(db, 'ssk-akut', 'p01', { nodatkomst: true }, 'ge_lakemedel');
    expect(fel(() => stod.makulera(akut, 'administrering', ut.id, { orsak: 'Försök' }, hj(akut))).status).toBe(403);
    // Patient 4: en dos av den spärrade psykiatrins ordination finns inte utan samtycke.
    const sert = ordFor(db, 'p04', 'Sertralin');
    const med = ssk(db, 'p04', 'ge_lakemedel', { samtycke_sparr: true });
    const d = administrering.spara(med, { ordinationId: sert.id, tid: kl('12:00'), kvitteradeVarningar: [{ regel: 'utan_ordination', motivering: 'Test' }] });
    const utan = ssk(db, 'p04');
    expect(fel(() => stod.makulera(utan, 'administrering', d.id, { orsak: 'Försök' }, hj(utan))).status).toBe(404);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs LIKE 'makulering:%' AND resultat = 'nekad'").get().n).toBeGreaterThan(0);
    expect(verifiera(db).hel).toBe(true);
  });
});

describe('Vätskebalans framåt', () => {
  test('beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna', () => {
    const db = sandladaKl('13:30');
    const bensyl = ordinera(db, 'p04', { lakemedelId: 'VK-NPL-0032', dosering: '3 g intravenöst', dos: 3, dosEnhet: 'g', tider: ['14', '22'], typ: 'tillfallig', administrationssatt: 'intravenost', volymMl: 100 });
    const dryck = ordinera(db, 'p04', { lakemedelId: 'VK-NUT-0001', dosering: '1 flaska 200 ml', dos: 200, dosEnhet: 'ml', tider: ['15'], typ: 'staende', administrationssatt: 'peroralt' });
    expect(dryck).toMatchObject({ volymMl: 200, nll_status: 'ej_aktuell', produkttyp: { typ: 'nutrition', kcalPerMl: 1.5 } });
    administrering.spara(ssk(db, 'p04'), { ordinationId: bensyl.id, planerad: kl('14:00'), atgard: 'iordningstall' });
    administrering.registreraVatska(atk(db, 'ssk-kard', 'p04', {}, 'registrera_matvarde'), { riktning: 'in', typ: 'mat', volymMl: 300, kcal: 450, tid: kl('12:00') });
    administrering.registreraVatska(atk(db, 'ssk-kard', 'p04', {}, 'registrera_matvarde'), { riktning: 'ut', typ: 'urin', volymMl: 600, tid: kl('11:00') });
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p04', 'uso-kard-72', 'vikt', '81,5', 81.5, 'kg', ?)").run(kl('07:00'));
    const vb = vyer.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'));
    expect(vb.kcalIn).toBe(450);
    expect(vb.beredd).toMatchObject({ summaMl: 100, poster: [{ lakemedel: 'Bensylpenicillin Noridem', volymMl: 100 }] });
    expect(vb.prognos.poster.map(p => [p.lakemedel, p.volymMl, p.kcal])).toEqual([['Bensylpenicillin Noridem', 100, 0], ['Näringsdryck 1,5 kcal/ml', 200, 300], ['Bensylpenicillin Noridem', 100, 0]]);
    expect(vb.prognos.poster[0].iordningstalld).toBe(true);
    expect(vb.prognos).toMatchObject({ summaIn: 400, kcal: 300, summaUt: 600 });
    expect(vb.ackumulerad.at(-1).balans).toBe(vb.balans);
    expect(vb.vikt.kg).toBe(81.5);
    expect(vyer.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'), { riktning: 'ut' }).poster.every(p => p.riktning === 'ut')).toBe(true);
    const sort = vyer.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'), { sortering: 'volym' }).poster.map(p => p.volymMl);
    expect(sort).toEqual([...sort].sort((x, y) => y - x));
    // Dygnsbrytningen vid 07: urinen kl 11 och maten kl 12 är i samma dygn, dryck kl 06 skulle inte vara det.
    expect(vyer.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'), { brytning: '07' }).fran).toBe(kl('07:00'));
  });

  test('inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen', () => {
    const db = sandladaKl('13:30');
    administrering.registreraVatska(atk(db, 'ssk-kard', 'p01', {}, 'registrera_matvarde'), { riktning: 'in', typ: 'mat', volymMl: 300, kcal: 450, tid: kl('12:00') });
    const vc = atk(db, 'lak-vc', 'p01', {}, 'las_matvarden');
    const r = fel(() => vyer.vatskebalans(vc));
    if (!r) expect(vyer.vatskebalans(vc).kcalIn).toBe(0);
    // Patient 4: en infusion på den spärrade psykiatrin syns inte i prognosen för kardiologen.
    const psyk = atk(db, 'lak-psyk', 'p04', {}, 'ordinera');
    const { kropp, extra } = stod.forbered(db, { lakemedelId: 'VK-NPL-0032', dosering: '3 g', dos: 3, dosEnhet: 'g', tider: ['22'], typ: 'tillfallig', administrationssatt: 'intravenost', volymMl: 100, ordinationsorsak: 'Test', uppfoljningsdatum: addDagar(idag(), 3) });
    stod.sparaTillagg(db, lakemedel.spara(psyk, kropp).ordination.id, extra);
    const kard = vyer.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'));
    expect(JSON.stringify(kard.prognos)).not.toContain('Bensylpenicillin');
  });
});

describe('Läkemedelstyper', () => {
  test('extempore, licens, egendefinierade läkemedel, blodprodukter och nutrition finns i katalogen, märkta som demo och utan NPL-id', () => {
    const db = sandladaKl('13:30');
    const typer = db.query('SELECT p.typ, k.npl FROM produkttyper p JOIN katalog k ON k.id = p.lakemedel_id').all();
    expect(new Set(typer.map(t => t.typ))).toEqual(new Set(['extempore', 'licens', 'egendefinierad', 'blodprodukt', 'nutrition']));
    expect(typer.every(t => t.npl == null)).toBe(true);
    expect(lakemedel.sokKatalog(db, 'licens').map(l => l.namn)).toEqual(['Tiamin injektionsvätska, licens']);
    expect(stod.produkttyp(db, 'VK-BLOD-0001')).toMatchObject({ typ: 'blodprodukt', typText: 'Blodprodukt', demo: true });
    expect(stod.produkttyp(db, 'VK-NPL-0001')).toMatchObject({ typ: 'godkand', demo: false });
  });

  test('systemet bevakar licensen: varning vid ordination, stopp vid dos efter att den gått ut och en rad i läkarens inkorg', () => {
    const db = sandladaKl('13:30');
    const k = lakemedel.kontroll(lak(db, 'p01'), { lakemedelId: 'VK-LIC-0001' });
    expect(k.varningar.find(v => v.regel === 'licens')).toMatchObject({ niva: 'observera' });
    expect(k.varningar.find(v => v.regel === 'licens').text).toContain(`går ut ${addDagar(idag(), 20)}`);
    // Akuten har ingen licens för tiaminet.
    const akut = lakemedel.kontroll(atk(db, 'lak-akut', 'p02', { nodatkomst: true }, 'ordinera'), { lakemedelId: 'VK-LIC-0001' });
    expect(akut.varningar.find(v => v.regel === 'licens')).toMatchObject({ niva: 'allvarlig' });
    expect(akut.varningar.find(v => v.regel === 'licens').text).toContain('ingen beviljad licens');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-LIC-0001', dosering: '100 mg intravenöst', dos: 100, dosEnhet: 'mg', tider: ['14'], typ: 'staende', administrationssatt: 'intravenost' });
    expect(o.nll_status).toBe('kvitterad');
    setSystemTime(new Date(Date.parse(kl('14:00')) + 25 * 86400_000));
    const varn = administrering.kontroll(ssk(db, 'p01'), { ordinationId: o.id }).varningar;
    expect(varn.find(v => v.regel === 'licens')).toMatchObject({ niva: 'allvarlig' });
  });

  test('en blodprodukt ges bara med kontrollen vid sängen, och skickas inte till NLL', () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-BLOD-0001', dosering: '1 enhet under 2 timmar', dos: 1, dosEnhet: 'enhet', tider: ['14'], typ: 'tillfallig', administrationssatt: 'intravenost' });
    expect(o).toMatchObject({ nll_status: 'ej_aktuell', administrationssatt: 'intravenost' });
    const e = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00') }));
    expect(e.extra.kraverKvittens).toEqual(['blodkontroll']);
    const ut = administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), kvitteradeVarningar: [{ regel: 'blodkontroll', motivering: 'Kontrollerad av Johan Ek och Amira Haddad' }] });
    expect(ut.administrering.kvitteradeVarningar[0].motivering).toContain('Amira Haddad');
    const r = fhir.medicationRequest(db, lakemedel.hamtaRad(db, o.id));
    expect(r.medicationCodeableConcept.coding.map(c => c.system)).toEqual(['http://www.whocc.no/atc']);
    expect(r.note[0].text).toContain('Blodprodukt.');
  });
});

describe('Uppföljning av läkemedel', () => {
  test('en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning', () => {
    const db = sandladaKl('13:30');
    // En ordination som skulle ha följts upp i förrgår.
    const ny = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', start: addDagar(idag(), -10), uppfoljningsdatum: addDagar(idag(), -2) });
    const furo = lakemedel.hamtaRad(db, ny.id);
    const rad = uppf.passeradeUppfoljningar(db, personal(db, 'lak-kard')).find(r => r.ordinationId === furo.id);
    expect(rad).toMatchObject({ patientId: 'p01', lakemedel: 'Omeprazol Sandoz', uppfoljningsdatum: addDagar(idag(), -2), dagarSedan: 2 });
    expect(uppf.passeradeUppfoljningar(db, personal(db, 'ol-kard')).some(r => r.ordinationId === furo.id)).toBe(false);
    expect(uppf.passeradeUppfoljningar(db, personal(db, 'ssk-kard'))).toEqual([]);
    const u = uppf.utvarderingsunderlag(lak(db, 'p01'), furo);
    expect(u.forslag).toMatchObject({ effekt: 'god', biverkan: 'ingen', beslut: 'fortsatt', nyttUppfoljningsdatum: addDagar(idag(), 8) });
    expect(fel(() => uppf.utvardera(lak(db, 'p01'), furo, { effekt: 'god', biverkan: 'misstankt', beslut: 'fortsatt' })).extra.falt).toEqual(['biverkanText']);
    const ut = uppf.utvardera(atk(db, 'lak-kard', 'p01', {}, 'utvardera_lakemedel'), furo, { effekt: 'delvis', biverkan: 'misstankt', biverkanText: 'Yrsel när han reser sig', beslut: 'fortsatt' });
    expect(ut.uppfoljningsdatum).toBe(addDagar(idag(), 8));
    expect(ut.biverkningsrapport).toContain('Läkemedelsverket');
    expect(uppf.passeradeUppfoljningar(db, personal(db, 'lak-kard')).some(r => r.ordinationId === furo.id)).toBe(false);
    expect(lakemedel.lista(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel')).ordinationer.find(o => o.id === furo.id)).toMatchObject({ aktuelltUppfoljningsdatum: addDagar(idag(), 8), uppfoljningPasserad: false });
    // Sjuksköterskan registrerar en observation, och läkaren beslutar.
    const o2 = uppf.utvardera(atk(db, 'ssk-kard', 'p01', {}, 'utvardera_lakemedel'), furo, { effekt: 'god', biverkan: 'ingen', beslut: 'satt_ut' });
    expect(o2.utvarderingar[0]).toMatchObject({ beslut: 'observation', av: 'Johan Ek' });
    expect(() => db.query('DELETE FROM lakemedelsutvarderingar').run()).toThrow();
  });

  test('uppföljningen på vårdenhetens nivå visar antal per läkemedel utan patientuppgifter, och bara för läkaren', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    uppf.utvardera(atk(db, 'lak-kard', 'p01', {}, 'utvardera_lakemedel'), furo, { effekt: 'god', biverkan: 'ingen', beslut: 'fortsatt' });
    const g = uppf.patientgrupp(db, personal(db, 'lak-kard'));
    const f = g.rader.find(r => r.substans === 'furosemid');
    expect(f).toMatchObject({ utvarderade: 1, andelGodEffekt: 100 });
    const text = JSON.stringify(g);
    for (const x of ['p01', 'Gunnar', 'Åkesson', '194502024732', 'p04', 'Sandberg']) expect(text).not.toContain(x);
    expect(fel(() => uppf.patientgrupp(db, personal(db, 'ssk-kard'))).status).toBe(403);
  });
});

describe('Fördjupad läkemedelsgenomgång', () => {
  test('läkaren startar, farmaceuten föreslår åtgärder, patientens medverkan registreras och läkaren beslutar med det som 11 kap. kräver', () => {
    const db = sandladaKl('13:30');
    const l = atk(db, 'lak-kard', 'p01', {}, 'lakemedelsgenomgang');
    const s = uppf.startaFordjupad(l);
    expect(s.pagar.status).toBe('vantar_farmaceut');
    expect(s.underlag.every(u => u.kontroller.map(k => k.punkt).join() === 'Indikation,Effekt,Dos mot njurfunktion och ålder,Biverkningar,Interaktioner och dubbelmedicinering')).toBe(true);
    // Systemet skriver motiveringen till varje förslag som inte är att fortsätta.
    expect(s.underlag.filter(u => u.forslag !== 'fortsatt').every(u => u.forslagMotivering.length >= 3)).toBe(true);
    expect(fel(() => uppf.startaFordjupad(l)).message).toContain('pågår');
    // Farmaceuten ser genomgången i inkorgen och föreslår åtgärder. Farmaceuten läser inte journalanteckningar.
    const far = personal(db, 'far-kard');
    expect(uppf.genomgangarIInkorg(db, far).map(r => r.patientId)).toEqual(['p01']);
    const fa = atk(db, 'far-kard', 'p01', {}, 'lakemedelsgenomgang');
    expect(fa.prova('las_journal').tillaten).toBe(false);
    expect(fel(() => uppf.sparaSteg(fa, s.pagar.id, { typ: 'lakare', beslut: [] })).status).toBe(403);
    const metoprolol = s.underlag.find(u => u.lakemedel.namn.startsWith('Metoprolol'));
    uppf.sparaSteg(fa, s.pagar.id, { typ: 'farmaceut', forslag: [{ ordinationId: metoprolol.ordinationId, atgard: 'minska_dos', motivering: 'Låg puls och yrsel' }], bedomning: 'Se över betablockaden.' });
    uppf.sparaSteg(fa, s.pagar.id, { typ: 'patient', deltog: true, besvar: ['yrsel', 'fall'], synpunkter: 'Vill ha färre tabletter.' });
    expect(uppf.genomgangarIInkorg(db, far)).toEqual([]);
    expect(uppf.genomgangarIInkorg(db, personal(db, 'lak-kard'))[0]).toMatchObject({ status: 'vantar_lakare' });
    expect(fel(() => uppf.sparaSteg(l, s.pagar.id, { typ: 'lakare', beslut: [{ ordinationId: metoprolol.ordinationId, atgard: 'minska_dos', motivering: 'Puls 52' }] })).extra.falt).toEqual(['mal', 'uppfoljningsdatum', 'patientInformerad']);
    const slut = uppf.sparaSteg(l, s.pagar.id, { typ: 'lakare', beslut: [{ ordinationId: metoprolol.ordinationId, atgard: 'minska_dos', motivering: 'Puls 52' }], mal: 'Puls 60 till 80 utan yrsel', uppfoljningsdatum: addDagar(idag(), 14), patientInformerad: true });
    expect(slut.pagar).toBeNull();
    const g = slut.tidigare[0];
    expect(g.steg.lakare.deltagare).toEqual(['Elsa Nordin (farmaceut)', 'Sara Lindqvist (läkare)', 'patienten']);
    expect(g.steg.lakare.sammanfattning).toContain('Uppföljning senast');
    expect(slut.nasta).toEqual([{ ordinationId: metoprolol.ordinationId, lakemedel: metoprolol.lakemedel.namn, atgard: 'minska_dos', text: `Minska dosen: ${metoprolol.lakemedel.namn}` }]);
    expect(() => db.query('UPDATE fordjupade_steg SET innehall = ?').run('{}')).toThrow();
  });

  test('säkerhet: sjuksköterskan startar inte, nödåtkomst ger ingen genomgång och patientens frånvaro ska motiveras', () => {
    const db = sandladaKl('13:30');
    expect(fel(() => uppf.startaFordjupad(atk(db, 'ssk-kard', 'p01', {}, 'lakemedelsgenomgang'))).status).toBe(403);
    expect(fel(() => uppf.startaFordjupad(atk(db, 'lak-kard', 'p12', { nodatkomst: true }, 'lakemedelsgenomgang'))).status).toBe(403);
    const s = uppf.startaFordjupad(atk(db, 'lak-kard', 'p01', {}, 'lakemedelsgenomgang'));
    expect(fel(() => uppf.sparaSteg(atk(db, 'lak-kard', 'p01', {}, 'lakemedelsgenomgang'), s.pagar.id, { typ: 'patient', deltog: false })).message).toContain('i samråd med patienten');
    // Spärrade enheters ordinationer ingår aldrig i underlaget, inte ens med samtycke.
    const p4 = uppf.startaFordjupad(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'lakemedelsgenomgang'));
    expect(p4.underlag.some(u => u.lakemedel.namn.startsWith('Sertralin'))).toBe(false);
  });
});

describe('Vyer för läkemedel', () => {
  test('dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag', () => {
    const db = sandladaKl('13:30');
    const pred = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0049', ordinationsorsak: 'Giktartrit', trappning: { riktning: 'ned', startdos: 10, steg: 5, dagar: 1, slutdos: 5 } });
    const v = vyer.doseringsoversikt(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel'), { fran: addDagar(idag(), -1), dagar: 3 });
    expect(v.dagar).toEqual([addDagar(idag(), -1), idag(), addDagar(idag(), 1)]);
    const furo = v.rader.find(r => r.lakemedel.namn === 'Furosemid Teva' && r.status === 'aktiv');
    expect(furo.dagar[addDagar(idag(), -1)].map(d => d.status)).toEqual(['given', 'given']);
    expect(furo.dagar[idag()].map(d => d.status)).toEqual(['given', 'att_ge']);
    expect(furo.dagar[addDagar(idag(), 1)].map(d => d.status)).toEqual(['kommande', 'kommande']);
    // Trappschemat: 10 mg i dag och 5 mg i morgon, sedan slut. Dagens dos kl 08 kom före ordinationen och ges inte.
    const p = v.rader.find(r => r.ordinationId === pred.id);
    expect(p.dagar[idag()]).toEqual([]);
    expect(p.dagar[addDagar(idag(), 1)].map(d => d.dos)).toEqual([5]);
    expect(v.rader.find(r => r.lakemedel.namn === 'Alvedon').dagar[addDagar(idag(), -1)][0]).toMatchObject({ vidBehov: true });
  });

  test('läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning', () => {
    const db = sandladaKl('13:30');
    const l = lakemedel.lista(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel')).ordinationer;
    expect(l.find(o => o.lakemedel.namn === 'Waran' && o.status === 'aktiv').sarskildObservation).toContain('blodpropp');
    expect(l.find(o => o.lakemedel.namn === 'Alvedon')).toMatchObject({ sarskildObservation: null, uppfoljningPasserad: false });
    // Seedens melatonin för patient 4 skulle ha följts upp tidigare, och raden finns i den ordinerande läkarens inkorg.
    const p4 = lakemedel.lista(atk(db, 'lak-kard', 'p04', {}, 'las_lakemedel')).ordinationer;
    const mel = p4.find(o => o.lakemedel.namn === 'Melatonin Bluefish');
    expect(mel.uppfoljningPasserad).toBe(true);
    expect(mel.aktuelltUppfoljningsdatum < idag()).toBe(true);
    expect(uppf.passeradeUppfoljningar(db, personal(db, 'lak-kard')).map(r => [r.patientId, r.lakemedel])).toContainEqual(['p04', 'Melatonin Bluefish']);
  });
});

describe('Förpackning med NPL-pack-id', () => {
  test('katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade', () => {
    const facit = JSON.parse(readFileSync(join(import.meta.dir, 'data', 'npl-forpackningar.json'), 'utf8')).produkter;
    const npl = Object.fromEntries(KATALOG.map(l => [l.id, l.npl]));
    expect(new Set(FORPACKNINGAR.map(f => f.lakemedelId)).size).toBe(KATALOG.length);
    expect(new Set(FORPACKNINGAR.map(f => f.nplpackid)).size).toBe(FORPACKNINGAR.length);
    for (const f of FORPACKNINGAR) {
      expect(f.nplpackid).toMatch(/^\d{14}$/);
      expect(facit[npl[f.lakemedelId]][f.nplpackid]).toBe(f.text);
    }
    for (const l of KATALOG) expect(FORPACKNINGAR.filter(f => f.lakemedelId === l.id && f.forval).length).toBe(1);
  });

  test('systemet väljer förpackningen när förskrivaren inte väljer, och överföringen till NLL har NPL-pack-id', () => {
    const db = sandladaKl('13:30');
    const forslag = stod.forslagTillagg(db, db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0025'").get(), {});
    expect(forslag.forpackningar[0].forval).toBe(true);
    const utan = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende' });
    expect(utan.forpackning).toMatchObject({ nplpackid: forslag.forpackningar[0].nplpackid, vald: true });
    const vald = forslag.forpackningar[2].nplpackid;
    const med = ordinera(db, 'p04', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', forpackning: vald });
    expect(med.forpackning.nplpackid).toBe(vald);
    expect(fhir.medicationRequest(db, lakemedel.hamtaRad(db, med.id)).medicationCodeableConcept.coding[2]).toEqual({ system: 'http://electronichealth.se/fhir/NamingSystem/nplpackid', code: vald, display: forslag.forpackningar[2].text });
    expect(fel(() => stod.forbered(db, { lakemedelId: 'VK-NPL-0025', forpackning: FORPACKNINGAR.find(f => f.lakemedelId === 'VK-NPL-0001').nplpackid })).message).toContain('hör inte till Omeprazol Sandoz');
    // En äldre ordination utan vald förpackning visar förvalet.
    const waran = ordFor(db, 'p01', 'Waran');
    expect(lakemedel.ordinationUt(db, waran).forpackning).toMatchObject({ nplpackid: '10010101105761', vald: false });
  });
});

describe('Säkerhetsgranskning av läkemedelsprocessen del 2', () => {
  test('en muntlig ordination prövas mot när registreringen görs: en bakdaterad dos efter fönstret stoppas', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'registrera_muntlig_ordination');
    const o = vagar.registreraMuntlig(a, { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel nu', dos: 20, dosEnhet: 'mg', tider: [], typ: 'tillfallig', ordinationsorsak: 'Kraftig halsbränna', lakareId: 'lak-kard', satt: 'telefon', omedelbar: 'Svåra besvär' }).ordination;
    // Klockan är 16, fönstret gick ut 15.30. En dos som påstås ha getts 14.00 registreras nu: stoppas.
    setSystemTime(new Date(kl('16:00')));
    const e = fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'ge', tid: kl('14:00') }));
    expect(e?.message).toContain('inte signerad av Sara Lindqvist');
    // En tid före ordinationen godtas aldrig för en muntlig ordination.
    setSystemTime(new Date(kl('14:00')));
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, atgard: 'ge', tid: kl('13:00') }))?.message).toContain('före ordinationen');
  });

  test('ett iordningsställande i efterhand får inte ligga före ordinationen eller i framtiden', () => {
    const db = sandladaKl('13:30');
    const o = ordinera(db, 'p01', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel', dos: 20, dosEnhet: 'mg', tider: ['14'], typ: 'staende' });
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall', tid: kl('13:00') }))?.message).toContain('före ordinationen');
    expect(fel(() => administrering.spara(ssk(db, 'p01'), { ordinationId: o.id, planerad: kl('14:00'), atgard: 'iordningstall', tid: kl('14:00') }))?.extra.falt).toEqual(['tid']);
  });

  test('en fördjupad genomgång och en utvärdering sparar aldrig en spärrad vårdenhets läkemedel, inte ens med samtycke', () => {
    const db = sandladaKl('13:30');
    const sert = ordFor(db, 'p04', 'Sertralin');
    const med = atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'lakemedelsgenomgang');
    const g = uppf.startaFordjupad(med);
    const e = fel(() => uppf.sparaSteg(med, g.pagar.id, { typ: 'lakare', beslut: [{ ordinationId: sert.id, atgard: 'satt_ut', motivering: 'Test' }], mal: 'Mål', uppfoljningsdatum: addDagar(idag(), 14), patientInformerad: true }));
    expect(e?.status).toBe(400);
    expect(JSON.stringify(db.query('SELECT innehall FROM fordjupade_steg').all())).not.toContain('Sertralin');
    const u = fel(() => uppf.utvardera(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'utvardera_lakemedel'), sert, { effekt: 'god', biverkan: 'ingen', beslut: 'fortsatt' }));
    expect(u?.status).toBe(403);
    expect(db.query('SELECT count(*) AS n FROM lakemedelsutvarderingar').get().n).toBe(0);
  });
});

describe('Läkemedelsprocessen del 2 via API', () => {
  // Rollerna byts i samma session, så att de arbetar i samma sandlåda.
  test('API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg', async () => {
    app ??= testserver();
    const k = klient(app);
    await k.logga('lak-kard');
    const lista = await k.get('/api/patient/p04/ordinationspaket');
    expect(lista.data.paket.map(p => p.id)).toEqual(['elkonvertering']);
    expect((await k.get('/api/patient/p04/ordinationspaket/elkonvertering')).status).toBe(200);
    // Zopiklonet väljs bort, så att sjuksköterskan sedan kan ge det enligt direktivet.
    const o = await k.post('/api/patient/p04/ordinationspaket/elkonvertering', { uteslut: [0] });
    expect(o.status).toBe(201);
    expect(o.data.ordinationer.length).toBe(2);
    expect(o.data.utelamnade).toEqual([{ post: 0, lakemedel: expect.objectContaining({ namn: 'Zopiklon Pilum' }), varfor: 'Valdes bort.' }]);
    expect(o.data.ordinationer.every(x => x.vardkontakt?.id)).toBe(true);
    let ink = (await k.get('/api/inkorg')).data;
    expect(ink.licenserSomGarUt[0]).toMatchObject({ lakemedel: 'Tiamin injektionsvätska, licens' });
    expect(JSON.stringify(ink.licenserSomGarUt)).not.toMatch(/p0\d/);
    expect(ink.lakemedelsuppfoljningar.find(r => r.patient?.id === 'p04')).toMatchObject({ lakemedel: 'Melatonin Bluefish' });
    expect((await k.get('/api/lakemedel/uppfoljning')).status).toBe(200);
    const dos = await k.get(`/api/patient/p01/doseringsoversikt?fran=${addDagar(idag(), -1)}&dagar=3`);
    expect(dos.data.dagar.length).toBe(3);
    expect((await k.post('/api/patient/p01/fordjupad-genomgang', {})).status).toBe(201);
    const tr = await k.get('/api/patient/p01/lakemedel/trappning?lakemedelId=VK-NPL-0049');
    expect(tr.data.steg.length).toBe(8);
    const forslag = await k.get('/api/patient/p04/lakemedel/forslag?lakemedelId=VK-NPL-0032');
    expect(forslag.data.spadning).toMatchObject({ volymMl: 100, tidMin: 30 });
    expect(forslag.data.forpackningar.length).toBeGreaterThan(0);
    const sp = await k.post('/api/patient/p04/lakemedel', { lakemedelId: 'VK-NPL-0032', dosering: '3 g intravenöst 3 gånger per dygn', dos: 3, dosEnhet: 'g', tider: ['06', '14', '22'], typ: 'tillfallig', ordinationsorsak: 'Erysipelas', uppfoljningsdatum: addDagar(idag(), 3), administrationssatt: 'intravenost', spadning: forslag.data.spadning });
    expect(sp.status).toBe(201);
    expect(sp.data.ordination.spadning.koncentrationMgMl).toBe(30);
    expect(sp.data.ordination.volymMl).toBe(100);

    await k.logga('ssk-kard');
    expect((await k.get('/api/patient/p01/ordinationspaket')).status).toBe(403);
    const ml = await k.get('/api/patient/p01/muntlig-ordination');
    expect(ml.data.lakare.map(l => l.id)).toContain('lak-kard');
    const m = await k.post('/api/patient/p01/muntlig-ordination', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel nu', dos: 20, dosEnhet: 'mg', tider: [], typ: 'tillfallig', ordinationsorsak: 'Kraftig halsbränna', lakareId: 'lak-kard', satt: 'telefon', omedelbar: 'Kraftig halsbränna' });
    expect(m.status).toBe(201);
    expect(m.data.ordination.nll_status).toBe('vantar_signering');
    const d = await k.get('/api/patient/p04/direktiv');
    const zop = d.data.direktiv.find(x => x.lakemedel.namn === 'Zopiklon Pilum');
    const dz = await k.post(`/api/patient/p04/direktiv/${zop.id}`, { bedomning: zop.bedomningForslag, bekraftade: zop.bekrafta });
    expect(dz.status).toBe(201);
    const ge = await k.post('/api/patient/p04/administreringar', { ordinationId: dz.data.ordination.id, atgard: 'ge' });
    expect(ge.status).toBe(201);
    const mak = await k.post('/api/patient/p04/makulera', { typ: 'administrering', id: ge.data.id, orsak: 'Fel läkemedel' });
    expect(mak.status).toBe(200);
    expect(mak.data.makulerad.orsak).toBe('Fel läkemedel');
    expect((await k.get('/api/direktiv')).data.direktiv.length).toBeGreaterThan(1);
    expect((await k.post('/api/direktiv', {})).status).toBe(403);
    expect((await k.post('/api/patient/p01/fordjupad-genomgang', {})).status).toBe(403);
    const vb = await k.get('/api/patient/p04/vatskebalans?brytning=07&riktning=in&sortering=volym');
    expect(vb.data).toMatchObject({ brytning: '07:00', filter: { riktning: 'in', sortering: 'volym' } });
    expect(vb.data.prognos.poster.some(p => p.lakemedel === 'Bensylpenicillin Noridem')).toBe(true);

    await k.logga('lak-kard');
    ink = (await k.get('/api/inkorg')).data;
    expect(ink.muntligaAttSignera.map(r => r.ordinationId)).toEqual([m.data.ordination.id]);
    expect((await k.post(`/api/ordination/${m.data.ordination.id}/muntlig/signera`, {})).data.nll.status).toBe('kvitterad');
    const furo = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(x => x.lakemedel.namn === 'Furosemid Teva' && x.status === 'aktiv');
    expect((await k.get(`/api/ordination/${furo.id}/utvardering`)).data.forslag.beslut).toBe('fortsatt');
    expect((await k.post(`/api/ordination/${furo.id}/utvardering`, { effekt: 'god', biverkan: 'ingen', beslut: 'fortsatt' })).status).toBe(201);

    await k.logga('far-kard');
    const fi = (await k.get('/api/inkorg')).data;
    expect(fi.fordjupadeGenomgangar.map(r => r.patient.id)).toEqual(['p01']);
    expect((await k.get('/api/patient/p01/anteckningar')).status).toBe(403);
    expect((await k.get('/api/patient/p01/fordjupad-genomgang')).data.kan.farmaceut).toBe(true);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs LIKE 'inkorg:uppfoljning:%'").get().n).toBeGreaterThan(0);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs LIKE 'makulering:administrering:%' AND resultat = 'tillaten'").get().n).toBe(1);
    expect(verifiera(db).hel).toBe(true);
  });
});
