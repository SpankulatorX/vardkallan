// Operationsplanering (runda 9, r3, Sussa 4.5): från operationsanmälan via väntelista och planering av sal, team och tid
// till förloppet på salen, uppvakningen, överrapporteringen till vårdavdelningen och uppföljningen per vårdenhet.
//
// Systemet är experten:
//   - Läkaren väljer ingreppet och, när det behövs, sidan. Systemet sätter KVÅ-koden, den beräknade operationstiden,
//     anestesiformen, målet för väntetiden ur prioriteten och listan över förberedelser, och föreslår de prover som saknas.
//   - Systemet föreslår första lediga tid i en sal på sjukhuset, med operatören och en operationssjuksköterska på
//     vårdenheten, och prövar att varken salen eller teamet är upptaget. Kallelsen med förberedelserna skrivs av systemet.
//   - Under operationen sätter systemet tiden för varje händelse och håller ordningen, och WHO:s checklista för säker
//     kirurgi måste vara klar före anestesin, före snittet och innan patienten lämnar salen. Allergier och blodbeställning
//     fyller systemet i ur journalen. Ingreppet registreras som åtgärd med KVÅ när operationen är slut.
//   - På uppvakningen prövar systemet kriterierna för utskrivning mot de registrerade kontrollerna och förklarar vad som
//     saknas, skriver överrapporteringen och föreslår de postoperativa kontrollerna till avdelningen.
//   - En vy på enhetsnivå visar bara det som den inloggade får se. För en annan vårdenhets operation i samma sal visas
//     bara att salen är upptagen.
//
// Ingreppen, salarna, operationstiderna och kriterierna är demoregler och inget kliniskt beslutsstöd.
import { Fel, datumAv, addDagar, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder, kanRoll, visningsnamn, ANESTESIENHETER, OPERERANDE_VARDENHETER, harVardrelation, anmalanGerAnestesiRelation } from './atkomst.js';
import { registreraAtgard } from './atgarder.js';
import { KVA } from './kodverk.js';
import * as kontroller from './kontroller.js';
import * as labb from './labb.js';
import { ANALYS } from './labb-katalog.js';
// Runda 11, r2: läkemedel, diagnoser och mätvärden som kan påverka ett planerat ingrepp.
import { Atkomst } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import { tabell, finns, personNamn, enhetsnamn, enhetKort, textFalt, iso, tid as giltigTid, MIN, DAG, kravRoll, vardkontaktFor,
  provaRad, loggaPatient, matvarde, lasRad, andraRad, bunden } from './specialist-hjalp.js';
// Säkerhetsgranskningen: varje anmälan binds till patienten och prövas på den anmälande vårdenheten.
const ANDRA = 'Operationen hanteras av den anmälande vårdenheten.';
const andraOp = (atk, an, handling) => andraRad(atk, an, handling, 'las_operation', ANDRA);

// Runda 11, r2 (beslut 2026-11-10): anestesienheten på den opererande vårdenhetens sjukhus. Anmälan är en beställning till
// den, och den läser operationen med vårdrelationen från anmälan tills operationen och uppvakningen är avslutade. Den
// opererande enhetens journal i övrigt kräver ett aktivt val (inre sekretess). Anestesienheten ändrar det som hör till
// anestesin: bedömningen, ASA-klassen och anestesijournalen.
export function anestesienhetFor(db, an) {
  const sjukhus = sjukhusFor(db, an.enhet_id);
  return Object.keys(ANESTESIENHETER).find(id => ANESTESIENHETER[id] === sjukhus) ?? null;
}
const arAnestesienhet = (atk, an) => !['klar', 'avbokad'].includes(an.status) && vardenhetFor(atk.db, atk.personal.enhet_id) === anestesienhetFor(atk.db, an);
// Säkerhetsgranskningen: anmälans enhet prövas alltid i behörighetsmotorn. Det enda som anestesirelationen får ersätta är
// det aktiva valet för själva anmälan (kraver_val), som när en mottagare läser en remiss. En spärr kräver patientens
// samtycke som vanligt, och allt annat nekas som en uppgift som inte finns.
const anestesiOk = (r, patientniva) => r.tillaten || (r.krav === 'kraver_val' && patientniva.tillaten);
function anestesiKrav(atk, an, handling) {
  const r = atk.prova(handling, { enhet_id: an.enhet_id });
  if (r.tillaten) { atk.grunder.add(r.grund); return; }
  if (r.krav === 'kraver_val') { atk.krav(handling); return; }
  if (r.krav === 'kraver_samtycke') atk.doldaSparr = true;
  atk.logga(handling, 'nekad', `operation:${an.id}`, 'nekad');
  throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
}
export function opLas(atk, an, handling = 'las_operation') {
  if (arAnestesienhet(atk, bunden(atk, an))) { anestesiKrav(atk, an, handling); return an; }
  return lasRad(atk, an, handling);
}
export function opAndra(atk, an, handling, { anestesi = false } = {}) {
  if (arAnestesienhet(atk, bunden(atk, an))) {
    anestesiKrav(atk, an, 'las_operation');
    if (!anestesi) throw new Fel(403, ANDRA, 'nekad');
    atk.krav(handling);
    return an;
  }
  return andraOp(atk, an, handling);
}
// Om en rad i en lista på enhetsnivå får visas för anestesienheten, med samma regel.
const anestesiRadOk = (db, personal, valFor, an) => anestesiOk(provaRad(db, personal, valFor, an, 'las_operation'),
  new Atkomst(db, personal, an.patient_id, valFor(an.patient_id), 'las_operation').prova('las_operation'));
export const AKTIVT_VAL_SYFTE = 'Anestesibedömning inför operation';
// Syftet som systemet förväljer i dialogen för aktivt val, när den inloggade arbetar på anestesienheten som patienten är
// anmäld till. Valet görs och loggas som vanligt.
export function aktivtValSyfte(db, personal, patientId) {
  sakra(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!Object.hasOwn(ANESTESIENHETER, ve)) return null;
  const rader = db.query("SELECT * FROM op_anmalningar WHERE patient_id = ? AND status NOT IN ('klar', 'avbokad')").all(patientId);
  return rader.some(an => anestesienhetFor(db, an) === ve && harVardrelation(db, patientId, ve) && anestesiRadOk(db, personal, () => ({}), an)) ? AKTIVT_VAL_SYFTE : null;
}

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Salarna och teamet är påhittade.';

// Ingreppen (KVÅ 2026, ett urval för demon). minuter är beräknad operationstid, sida att sidan måste anges, implantat att ett
// implantat ska registreras och blod att blodgruppering och bastest ska finnas före operationen.
// Runda 11, r2: utrustning är utrustningen och instrumentgallren som ingreppet behöver (RESURSER), och profylax den
// antibiotikaprofylax som systemet föreslår (PROFYLAX).
export const INGREPP = tabell({
  JKA21: { kva: 'JKA21', namn: 'Laparoskopisk kolecystektomi', minuter: 75, anestesi: 'generell', sida: false, implantat: false, blod: false, utrustning: ['lap-torn', 'lap-galler'], profylax: 'buk' },
  JEA01: { kva: 'JEA01', namn: 'Laparoskopisk appendektomi', minuter: 45, anestesi: 'generell', sida: false, implantat: false, blod: false, utrustning: ['lap-torn', 'lap-galler'], profylax: 'buk' },
  NFB49: { kva: 'NFB49', namn: 'Primär total höftledsplastik med cement', minuter: 100, anestesi: 'regional', sida: true, implantat: true, blod: true, utrustning: ['hoft-galler'], profylax: 'ortopedi' },
  NGB49: { kva: 'NGB49', namn: 'Primär totalprotes i knäled med cement', minuter: 90, anestesi: 'regional', sida: true, implantat: true, blod: false, utrustning: ['kna-galler'], profylax: 'ortopedi' },
});

// ---- Runda 11, r2: salsblock, resurser och profylax (demoregler) ------------------------------------------------------
// Salstiden fördelas i block per sal och veckodag (1 måndag till 5 fredag) mellan de opererande vårdenheterna, också på
// andra sjukhus i regionen. null är en öppen sal som alla vårdenheter på sjukhuset får planera i. Ett block som
// vårdenheten inte har fyllt släpps för de andra vårdenheterna på sjukhuset FRISLAPP_DAGAR före.
export const BLOCKSCHEMA = {
  'uso-sal-1': { 1: 'uso-ort', 2: 'uso-ort', 3: 'uso-ort', 4: 'uso-ort', 5: 'uso-ort' },
  'uso-sal-2': { 1: 'uso-ort', 2: null, 3: 'uso-ort', 4: null, 5: 'uso-ort' },
  'kkoga-sal-1': { 1: 'kkoga-ort', 2: 'kkoga-ort', 3: 'kkoga-ort', 4: 'kkoga-ort', 5: 'kkoga-ort' },
  'kkoga-sal-2': { 1: 'kkoga-ort', 2: 'kkoga-ort', 3: 'kkoga-ort', 4: 'kkoga-ort', 5: 'uso-ort' },
  'lind-sal-1': { 1: 'kkoga-ort', 2: 'uso-ort', 3: 'kkoga-ort', 4: 'uso-ort', 5: null },
};
export const FRISLAPP_DAGAR = 2;
// Utrustningen och instrumentgallren (sterilgods) som planeras som resurser, och antalet per sjukhus.
export const RESURSER = tabell({
  'lap-torn': { namn: 'Laparoskopitorn', typ: 'utrustning' },
  'lap-galler': { namn: 'Instrumentgaller för laparoskopi', typ: 'sterilgods', instrument: 36 },
  'hoft-galler': { namn: 'Instrumentgaller för höftprotes', typ: 'sterilgods', instrument: 64 },
  'kna-galler': { namn: 'Instrumentgaller för knäprotes', typ: 'sterilgods', instrument: 58 },
});
export const RESURSANTAL = {
  uso: { 'lap-torn': 2, 'lap-galler': 3, 'hoft-galler': 2, 'kna-galler': 2 },
  kkoga: { 'lap-torn': 1, 'lap-galler': 1, 'hoft-galler': 2, 'kna-galler': 1 },
  lind: { 'lap-torn': 1, 'lap-galler': 1, 'hoft-galler': 1, 'kna-galler': 1 },
};
// Antibiotikaprofylaxen per slag av ingrepp, och alternativet vid överkänslighet mot penicillin (ATC J01C).
export const PROFYLAX = tabell({
  ortopedi: { lakemedel: 'kloxacillin', namn: 'Kloxacillin', dos: 2, enhet: 'g' },
  buk: { lakemedel: 'cefuroxim', namn: 'Cefuroxim', dos: 1.5, enhet: 'g' },
  alternativ: { lakemedel: 'klindamycin', namn: 'Klindamycin', dos: 600, enhet: 'mg' },
});
// Teamets roller ur personalens titel. Operationskoordinatorn planerar och ingår inte i teamet.
const arAnestesilakare = (t) => /^Anestesiläkare/.test(t ?? '');
const arAnestesissk = (t) => /^Anestesisjuksköterska/.test(t ?? '');
const utanforOpteam = (t) => /^(Anestesi|Operationskoordinator)/.test(t ?? '');
export const ANESTESI = tabell({ generell: 'Generell anestesi', regional: 'Regional anestesi (spinal)', lokal: 'Lokalbedövning' });
export const SIDA = tabell({ hoger: 'höger', vanster: 'vänster' });
// Prioriteten och målet för väntetiden i dagar från anmälan. Inom tre månader är vårdgarantins 90 dagar.
export const PRIORITET = tabell({
  akut: { namn: 'Akut, inom ett dygn', dagar: 1 }, inom_2_veckor: { namn: 'Inom två veckor', dagar: 14 }, inom_3_manader: { namn: 'Inom tre månader', dagar: 90 },
});
// Operationssalarna per sjukhus och salstiden. Mellan två operationer går 30 minuter till förberedelse och städning.
export const SALAR = [
  { id: 'uso-sal-1', namn: 'Operationssal 1, USÖ', sjukhus: 'uso' }, { id: 'uso-sal-2', namn: 'Operationssal 2, USÖ', sjukhus: 'uso' },
  { id: 'kkoga-sal-1', namn: 'Operationssal 1, Karlskoga', sjukhus: 'kkoga' }, { id: 'kkoga-sal-2', namn: 'Operationssal 2, Karlskoga', sjukhus: 'kkoga' },
  { id: 'lind-sal-1', namn: 'Operationssal 1, Lindesberg', sjukhus: 'lind' },
];
export const SAL = tabell(Object.fromEntries(SALAR.map(s => [s.id, s])));
export const SALSTID = { fran: '07:30', till: '16:00', minuter: 510 };
export const BYTE_MINUTER = 30;
export const STRYKORSAKER = tabell({
  patient_sjuk: 'Patienten är sjuk', patient_avstar: 'Patienten avstår', akut_gick_fore: 'En akut operation gick före',
  tidsbrist: 'Tiden räckte inte', forberedelse_saknas: 'Förberedelserna var inte klara', personal_saknas: 'Personal saknades',
});
// WHO:s checklista för säker kirurgi i Socialstyrelsens och SKR:s svenska form, med alla punkter (runda 11, r2). En punkt
// som inte gäller ingreppet bockar systemet av med en förklaring (checklistaUnderlag).
export const CHECKLISTA = tabell({
  fore_anestesi: { namn: 'Före anestesi', punkter: {
    identitet: 'Patientens identitet är kontrollerad med id-bandet', ingrepp: 'Ingrepp och operationsställe är bekräftade med patienten',
    markering: 'Operationsområdet är markerat', samtycke: 'Patienten har fått information och samtyckt till ingreppet och anestesin',
    utrustning: 'Anestesiutrustning och läkemedel är kontrollerade', pulsoximeter: 'Pulsoximetern sitter på patienten och fungerar',
    allergi: 'Kända allergier är genomgångna', luftvag: 'Risken för svår luftväg och aspiration är bedömd',
    blodning: 'Risken för blödning är bedömd och blod finns om det behövs', fasta: 'Fastan är kontrollerad',
    trombos: 'Trombosprofylax är given eller inte aktuell' } },
  fore_snitt: { namn: 'Före snitt', punkter: {
    team: 'Teamet har presenterat sig med namn och roll', bekraftat: 'Operatör, anestesi och operationssjuksköterska bekräftar patient, ingrepp och sida',
    antibiotika: 'Antibiotikaprofylax är given inom 60 minuter före snittet eller inte aktuell', kritiska: 'Operatören går igenom kritiska moment, beräknad tid och förväntad blödning',
    anestesirisk: 'Anestesin går igenom patientens särskilda risker', sterilitet: 'Operationssjuksköterskan bekräftar steriliteten och att instrumenten är klara',
    bilder: 'Nödvändiga bilder visas', varme: 'Patientens temperatur och värme är planerade', lage: 'Patientens läge och skydd mot tryckskador är kontrollerade' } },
  fore_utflyttning: { namn: 'Innan patienten lämnar salen', punkter: {
    registrerat: 'Ingreppet är registrerat', rakning: 'Instrument, kompresser och nålar är räknade och stämmer',
    preparat: 'Preparat är märkta med patientens namn och personnummer', implantat: 'Implantat är registrerade med lot- eller serienummer',
    utrustning: 'Problem med utrustning är rapporterade', uppvakning: 'Det viktigaste för uppvakningen och vården efteråt är överlämnat' } },
});
// Händelserna under operationen i den ordning de sker, och checklistan som måste vara klar före varje händelse.
export const HANDELSER = [
  { id: 'in_sal', namn: 'In på sal' }, { id: 'anestesistart', namn: 'Anestesistart', checklista: 'fore_anestesi' },
  { id: 'knivtid', namn: 'Knivtid (snitt)', checklista: 'fore_snitt' }, { id: 'op_slut', namn: 'Operationen slut' },
  { id: 'ut_sal', namn: 'Ut från sal', checklista: 'fore_utflyttning' },
];
const HANDELSE = tabell(Object.fromEntries(HANDELSER.map(h => [h.id, h])));
// Kriterierna för utskrivning från uppvakningen (demoregel, efter modell av Aldrete och PADSS). Värdet är det senaste
// som registrerats efter att patienten lämnade salen.
export const UPPVAK_MINUTER = 30;
export const KRITERIER = [
  { typ: 'medvetande', namn: 'Vaken', ok: (v) => v.varde === 'A', krav: 'medvetandegrad A (vaken)' },
  { typ: 'saturation', namn: 'Syremättnad', ok: (v) => v.num >= 94, krav: 'minst 94 procent' },
  { typ: 'andningsfrekvens', namn: 'Andningsfrekvens', ok: (v) => v.num >= 10 && v.num <= 20, krav: '10 till 20 andetag per minut' },
  { typ: 'puls', namn: 'Puls', ok: (v) => v.num >= 50 && v.num <= 110, krav: '50 till 110 slag per minut' },
  { typ: 'blodtryck', namn: 'Systoliskt blodtryck', ok: (v) => v.num >= 90 && v.num <= 180, krav: '90 till 180 mmHg' },
  { typ: 'smarta', namn: 'Smärta', ok: (v) => v.num <= 3, krav: 'högst 3 av 10' },
];
// De postoperativa kontrollerna som systemet föreslår till avdelningen: var fjärde timme under ett dygn.
export const POSTOP_KONTROLLER = ['puls', 'blodtryck', 'saturation', 'andningsfrekvens', 'temp'];
// Proverna före operationen. Ett ingrepp med risk för blödning behöver också blodgruppering och bastest.
export const PREOP_ANALYSER = ['blodstatus', 'kreatinin', 'natrium', 'kalium'];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS op_anmalningar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, anmald_av TEXT NOT NULL,
  anmald_tid TEXT NOT NULL, kva TEXT NOT NULL, sida TEXT, prioritet TEXT NOT NULL, mal_datum TEXT NOT NULL, anestesi TEXT NOT NULL,
  asa INTEGER, minuter INTEGER NOT NULL, kommentar TEXT, status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_op_anm_patient ON op_anmalningar (patient_id);
CREATE TABLE IF NOT EXISTS op_planeringar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, sal TEXT NOT NULL,
  start TEXT NOT NULL, slut TEXT NOT NULL, operator TEXT NOT NULL, opssk TEXT, planerad_av TEXT NOT NULL, planerad_tid TEXT NOT NULL,
  kallelse TEXT, struken_tid TEXT, struken_av TEXT, struken_orsak TEXT
);
CREATE INDEX IF NOT EXISTS ix_op_plan_sal ON op_planeringar (sal, start);
CREATE TABLE IF NOT EXISTS op_forlopp (
  anmalan_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, planering_id INTEGER NOT NULL,
  in_sal TEXT, anestesistart TEXT, knivtid TEXT, op_slut TEXT, ut_sal TEXT, checklista TEXT NOT NULL DEFAULT '{}', implantat TEXT NOT NULL DEFAULT '[]',
  atgarder TEXT NOT NULL DEFAULT '[]', uppvak_start TEXT, utskriven_tid TEXT, utskriven_av TEXT, overrapport TEXT
);
CREATE TABLE IF NOT EXISTS op_historik (
  id INTEGER PRIMARY KEY, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, personal_id TEXT,
  handelse TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS op_historik_andras_ej BEFORE UPDATE OF anmalan_id, tid, personal_id, handelse, detalj ON op_historik BEGIN SELECT RAISE(ABORT, 'Historiken för en operation ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS op_historik_raderas_ej BEFORE DELETE ON op_historik BEGIN SELECT RAISE(ABORT, 'Historiken för en operation raderas inte.'); END;
-- Runda 11, r2: ändrade salsblock (vardenhet_id null är ett släppt block), teamet utöver operatör och
-- operationssjuksköterska och de bokade resurserna per planering. enhet_id är den vårdenhet som gjorde ändringen.
CREATE TABLE IF NOT EXISTS op_block_andringar (
  id INTEGER PRIMARY KEY, sal TEXT NOT NULL, datum TEXT NOT NULL, vardenhet_id TEXT, enhet_id TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_op_block ON op_block_andringar (sal, datum);
CREATE TABLE IF NOT EXISTS op_team (
  id INTEGER PRIMARY KEY, planering_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, roll TEXT NOT NULL, personal_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_op_team ON op_team (planering_id);
CREATE TABLE IF NOT EXISTS op_resursbokningar (
  id INTEGER PRIMARY KEY, planering_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, resurs TEXT NOT NULL, sjukhus TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_op_resurs ON op_resursbokningar (planering_id);
-- Anestesijournalen: läkemedel, vätskor och händelser under operationen (anestesijournal.js), och täta värden från den
-- simulerade anestesimonitorn. Raderna ändras och raderas inte.
CREATE TABLE IF NOT EXISTS op_anestesi (
  id INTEGER PRIMARY KEY, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, slag TEXT NOT NULL,
  kod TEXT NOT NULL, dos REAL, dos_enhet TEXT, volym_ml REAL, text TEXT, av TEXT NOT NULL, registrerad TEXT NOT NULL,
  CHECK (slag IN ('lakemedel', 'vatska', 'handelse'))
);
CREATE INDEX IF NOT EXISTS ix_op_anestesi ON op_anestesi (anmalan_id);
CREATE TRIGGER IF NOT EXISTS op_anestesi_andras_ej BEFORE UPDATE ON op_anestesi BEGIN SELECT RAISE(ABORT, 'Anestesijournalen ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS op_anestesi_raderas_ej BEFORE DELETE ON op_anestesi BEGIN SELECT RAISE(ABORT, 'Anestesijournalen raderas inte.'); END;
CREATE TABLE IF NOT EXISTS op_anestesi_varden (
  id INTEGER PRIMARY KEY, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  puls INTEGER, sys INTEGER, dia INTEGER, saturation INTEGER, etco2 REAL, andningsfrekvens INTEGER, temp REAL, kalla TEXT NOT NULL,
  UNIQUE (anmalan_id, tid)
);
CREATE TRIGGER IF NOT EXISTS op_anestesi_varden_andras_ej BEFORE UPDATE ON op_anestesi_varden BEGIN SELECT RAISE(ABORT, 'Monitorns värden ändras inte.'); END;
-- Sterilgods och material (sterilgods.js): instrumentgallren som öppnades, räknades och skickades tillbaka, förbrukningen,
-- förrådets saldo per sjukhus och beställningarna till det simulerade förrådet. enhet_id i förrådet är sjukhuset.
CREATE TABLE IF NOT EXISTS op_sterilgods (
  id INTEGER PRIMARY KEY, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, galler TEXT NOT NULL, resurs TEXT NOT NULL,
  charge TEXT NOT NULL, steriliserad TEXT NOT NULL, utgang TEXT NOT NULL, oppnad_tid TEXT NOT NULL, oppnad_av TEXT NOT NULL,
  raknad_tid TEXT, raknad_av TEXT, instrument INTEGER, retur_tid TEXT
);
CREATE TABLE IF NOT EXISTS op_forbrukning (
  id INTEGER PRIMARY KEY, anmalan_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, artikel TEXT NOT NULL, antal INTEGER NOT NULL,
  lot TEXT, sjukhus TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS op_forbrukning_andras_ej BEFORE UPDATE ON op_forbrukning BEGIN SELECT RAISE(ABORT, 'Förbrukningen ändras inte.'); END;
CREATE TABLE IF NOT EXISTS op_forrad (
  enhet_id TEXT NOT NULL, artikel TEXT NOT NULL, saldo INTEGER NOT NULL, PRIMARY KEY (enhet_id, artikel)
);
CREATE TABLE IF NOT EXISTS op_materialbestallningar (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, artikel TEXT NOT NULL, antal INTEGER NOT NULL, bestalld_tid TEXT NOT NULL, levereras TEXT NOT NULL,
  levererad_tid TEXT, orsak TEXT NOT NULL
);
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

const historik = (db, an, personalId, handelse, detalj, t) => db.query('INSERT INTO op_historik (anmalan_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(an.id, an.patient_id, an.enhet_id, t, personalId, handelse, detalj);
export function anmalanRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM op_anmalningar WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Operationsanmälan finns inte.', 'saknas');
  return r;
}
const planeringFor = (db, anId) => db.query('SELECT * FROM op_planeringar WHERE anmalan_id = ? AND struken_tid IS NULL ORDER BY id DESC').get(anId) ?? null;
const forloppFor = (db, anId) => db.query('SELECT * FROM op_forlopp WHERE anmalan_id = ?').get(anId) ?? null;

// Sjukhuset som en enhet hör till.
export function sjukhusFor(db, enhetId) {
  let e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(enhetId);
  for (let i = 0; e && i < 10; i++) {
    if (e.typ === 'sjukhus') return e.id;
    e = e.forald_id ? db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(e.forald_id) : null;
  }
  return null;
}
const salarFor = (db, enhetId) => SALAR.filter(s => s.sjukhus === sjukhusFor(db, enhetId));
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const datumText = (t) => new Date(t).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });

// ---- Runda 11, r2: salsblocken över vårdenheter och sjukhus --------------------------------------------------------------

const veckodag = (datum) => new Date(lokalTid(datum, '12:00')).getUTCDay();
const dagarTill = (fran, till) => Math.round((Date.parse(lokalTid(till, '12:00')) - Date.parse(lokalTid(fran, '12:00'))) / DAG);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Vårdenheter som har block i någon sal opererar i demon.
// Säkerhetsgranskningen: listan över opererande vårdenheter finns i behörighetsmotorn (atkomst.js), som räknar
// anestesirelationen ur den. Blocken ska bara gälla de vårdenheterna (testat).
export const opererar = (vardenhet) => OPERERANDE_VARDENHETER.includes(vardenhet);

// Blocket i en sal en dag: vårdenheten som har salen (null för en öppen eller släppt sal), om blocket är ändrat från
// schemat och om det är släppt för andra vårdenheter på sjukhuset eftersom dagen är nära (nu anges).
export function blockFor(db, sal, datum, nu = null) {
  sakra(db);
  const a = db.query('SELECT vardenhet_id FROM op_block_andringar WHERE sal = ? AND datum = ? ORDER BY id DESC LIMIT 1').get(sal, datum);
  const ve = a ? a.vardenhet_id : (BLOCKSCHEMA[sal]?.[veckodag(datum)] ?? null);
  return { vardenhet: ve, andrad: Boolean(a), frislappt: Boolean(ve && nu && dagarTill(datumAv(nu), datum) <= FRISLAPP_DAGAR) };
}

// Om vårdenheten får planera i salen den dagen, och annars varför inte.
function salTillganglig(db, ve, sal, datum, nu) {
  const b = blockFor(db, sal, datum, nu);
  if (b.vardenhet === ve) return { ok: true, egen: true };
  const tilldelad = b.vardenhet ? `${SAL[sal].namn} är tilldelad ${enhetsnamn(db, b.vardenhet)} den dagen.` : null;
  if (SAL[sal].sjukhus !== sjukhusFor(db, ve)) return { ok: false, text: `Salen finns inte på sjukhuset, och ${tilldelad ? tilldelad.charAt(0).toLocaleLowerCase('sv') + tilldelad.slice(1) : 'vårdenheten har inget block i den den dagen.'}` };
  if (!b.vardenhet || b.frislappt) return { ok: true, egen: false };
  return { ok: false, text: `${tilldelad} Blocket släpps för andra vårdenheter ${FRISLAPP_DAGAR} dagar före, eller när vårdenheten släpper det.` };
}

// Sessionen: om den inloggades vårdenhet opererar, så att menyn visar operationsavdelningen.
export function session(db, personal) {
  if (!personal || !kanRoll(personal, 'las_operation')) return null;
  const ve = vardenhetFor(db, personal.enhet_id);
  // Runda 11, r2: anestesienheten har operationsavdelningens vy med sina beställda bedömningar.
  if (Object.hasOwn(ANESTESIENHETER, ve)) return { vardenhet: enhetKort(db, ve), sjukhus: ANESTESIENHETER[ve], anestesi: true };
  return opererar(ve) ? { vardenhet: enhetKort(db, ve), sjukhus: sjukhusFor(db, ve) } : null;
}

// Runda 13, r4: anestesienheterna, för arbetslistan.
export const ANESTESIENHETER_FOR_LISTA = ANESTESIENHETER;
// Runda 13, r4 (säkerhetsgranskningen): den gemensamma prövningen av om en anmälan får visas för den inloggade på
// anestesienheten, i programmet, arbetslistan och listan över beställda anestesibedömningar. Rollen ska få läsa
// operationer, anmälan ska vara beställd till den inloggades anestesienhet och ge relation (inte avslutad, inte ett
// datum som har passerat), och raden och patienten prövas som för alla andra rader. Ger provningens svar eller
// { tillaten: false }.
export function anestesiSynlig(db, personal, valFor, an, nu = new Date()) {
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!kanRoll(personal, 'las_operation') || !Object.hasOwn(ANESTESIENHETER, ve) || anestesienhetFor(db, an) !== ve) return { tillaten: false };
  if (!anmalanGerAnestesiRelation(db, an, ve, nu) || !anestesiRadOk(db, personal, valFor, an)) return { tillaten: false };
  const r = new Atkomst(db, personal, an.patient_id, valFor(an.patient_id), 'las_operation').prova('las_operation');
  return r.tillaten ? r : { tillaten: false };
}
const anestesiProgram = (db, personal, valFor, an, _ve, nu) => anestesiSynlig(db, personal, valFor, an, nu);

// Runda 11, r2: anmälningarna som är beställda till den inloggades anestesienhet och inte avslutade, med om bedömningen
// gäller och om ASA-klassen är bekräftad i dag. Varje patient som visas loggas.
export function anestesilista(db, personal, valFor, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!Object.hasOwn(ANESTESIENHETER, ve)) return { vardenhet: enhetKort(db, ve), anmalningar: [], demoregel: DEMOREGEL };
  const ut = [];
  for (const an of db.query("SELECT * FROM op_anmalningar WHERE status NOT IN ('klar', 'avbokad') ORDER BY mal_datum, id").all()) {
    // Runda 13, r4: samma prövning som programmet och arbetslistan (anestesiSynlig).
    const r = anestesiSynlig(db, personal, valFor, an, nu);
    if (!r.tillaten) continue;
    const atk = new Atkomst(db, personal, an.patient_id, valFor(an.patient_id), 'las_operation');
    loggaPatient(db, personal, an.patient_id, 'las_operation', r.grund, '/api/operation/anestesi');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(an.patient_id);
    const plan = planeringFor(db, an.id);
    const bed = anestesiFor(atk, an, nu);
    ut.push({ anmalanId: an.id, patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) }, ingrepp: INGREPP[an.kva].namn, status: an.status,
      vardenhet: enhetKort(db, an.enhet_id), planerad: plan?.start ?? null, malDatum: an.mal_datum,
      bedomning: bed ? { asa: bed.asa, giltigTill: bed.giltigTill, giltig: bed.giltig } : null, asaBekraftad: Boolean(asaBekraftadDag(db, an, plan ? datumAv(new Date(plan.start)) : datumAv(nu))) });
  }
  return { vardenhet: enhetKort(db, ve), anmalningar: ut, text: 'Operationsanmälningarna är beställningar till anestesienheten. Den opererande vårdenhetens journal visas efter ett aktivt val med syftet anestesibedömning inför operation.', demoregel: DEMOREGEL };
}

// ASA-klassen bekräftas av en läkare på operationsdagen före induktionen (beslut 2026-11-10).
const asaBekraftadDag = (db, an, dag) => db.query("SELECT * FROM op_historik WHERE anmalan_id = ? AND handelse = 'asa_bekraftad' ORDER BY id DESC").all(an.id)
  .find(h => datumAv(new Date(h.tid)) === dag) ?? null;
export function bekraftaAsa(atk, an, body = {}, nu = new Date()) {
  opAndra(atk, an, 'anestesibedomning', { anestesi: true });
  const db = atk.db;
  if (!['planerad', 'pagar'].includes(an.status)) throw new Fel(409, 'ASA-klassen bekräftas för en planerad operation.', 'ogiltig');
  const bed = anestesiFor(atk, an, nu);
  const asa = body.asa == null ? (bed?.giltig ? bed.asa : an.asa) : Number(body.asa);
  if (asa == null) throw new Fel(409, 'Det finns ingen giltig anestesibedömning att bekräfta. Gör anestesibedömningen först.', 'ogiltig');
  if (!Number.isInteger(asa) || asa < 1 || asa > 5) throw new Fel(400, 'ASA-klassen är 1 till 5.', 'ogiltig', { falt: ['asa'] });
  db.transaction(() => {
    if (asa !== an.asa) db.query('UPDATE op_anmalningar SET asa = ? WHERE id = ?').run(asa, an.id);
    historik(db, an, atk.personal.id, 'asa_bekraftad', `ASA ${asa}`, iso(nu));
  })();
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

const planeradeMinuter = (db, sal, datum) => db.query('SELECT start, slut FROM op_planeringar WHERE sal = ? AND struken_tid IS NULL AND start >= ? AND start < ?')
  .all(sal, lokalTid(datum, '00:00'), lokalTid(addDagar(datum, 1), '00:00')).reduce((x, p) => x + (Date.parse(p.slut) - Date.parse(p.start)) / MIN, 0);

// Blocken i alla salar i regionen fem vardagar framåt. Beläggningen är bara upptagen tid, utan patienter eller ingrepp.
export function veckoblock(db, personal, { fran = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const start = fran ?? datumAv(nu);
  if (!DATUM.test(start)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const dagar = [];
  for (let d = start; dagar.length < 5; d = addDagar(d, 1)) if (![0, 6].includes(veckodag(d))) dagar.push(d);
  return {
    dagar, vardenhet: enhetKort(db, ve), opererar: opererar(ve), frislappDagar: FRISLAPP_DAGAR,
    salar: SALAR.map(s => ({ id: s.id, namn: s.namn, sjukhus: s.sjukhus, dagar: dagar.map(datum => {
      const b = blockFor(db, s.id, datum, nu);
      return { datum, vardenhet: enhetKort(db, b.vardenhet), egen: b.vardenhet === ve, frislappt: b.frislappt, andrad: b.andrad,
        belaggning: Math.round((planeradeMinuter(db, s.id, datum) / SALSTID.minuter) * 100) };
    }) })),
    text: `Salstiden är fördelad i block mellan de opererande vårdenheterna. Ett block som inte är fyllt släpps för de andra vårdenheterna på sjukhuset ${FRISLAPP_DAGAR} dagar före.`,
    demoregel: DEMOREGEL,
  };
}

function blockAndring(db, personal, body, nu) {
  sakra(db);
  kravRoll(personal, 'operation_planera', 'Din yrkesroll kan inte planera operationer.');
  const { sal, datum } = body ?? {};
  if (!finns(SAL, sal)) throw new Fel(400, 'Salen finns inte.', 'ogiltig', { falt: ['sal'] });
  if (typeof datum !== 'string' || !DATUM.test(datum) || datum < datumAv(nu)) throw new Fel(400, 'Ange en dag från i dag och framåt som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  if ([0, 6].includes(veckodag(datum))) throw new Fel(400, 'Salarna har block på vardagar.', 'ogiltig', { falt: ['datum'] });
  return { sal, datum, ve: vardenhetFor(db, personal.enhet_id), b: blockFor(db, sal, datum) };
}
const blockUt = (db, personal, sal, datum, nu) => veckoblock(db, personal, { fran: datum }, nu).salar.find(s => s.id === sal).dagar[0];

// Vårdenheten släpper ett eget block som den inte behöver, så att andra vårdenheter kan planera där.
export function slappBlock(db, personal, body = {}, nu = new Date()) {
  const { sal, datum, ve, b } = blockAndring(db, personal, body, nu);
  if (b.vardenhet !== ve) throw new Fel(409, 'Bara den egna vårdenhetens block kan släppas.', 'ogiltig');
  const egna = db.query(`SELECT count(*) AS n FROM op_planeringar WHERE sal = ? AND struken_tid IS NULL AND start >= ? AND start < ?`).get(sal, lokalTid(datum, '00:00'), lokalTid(addDagar(datum, 1), '00:00')).n;
  if (egna) throw new Fel(409, `Det finns planerade operationer i blocket. Flytta eller stryk dem först.`, 'ogiltig');
  db.query('INSERT INTO op_block_andringar (sal, datum, vardenhet_id, enhet_id, av, tid) VALUES (?, ?, NULL, ?, ?, ?)').run(sal, datum, ve, personal.id, iso(nu));
  return { ...blockUt(db, personal, sal, datum, nu), text: `Blocket i ${SAL[sal].namn} ${datum} är släppt. Andra vårdenheter kan nu planera där.` };
}

// En opererande vårdenhet tar ett öppet eller släppt block, också på ett annat sjukhus.
export function taBlock(db, personal, body = {}, nu = new Date()) {
  const { sal, datum, ve, b } = blockAndring(db, personal, body, nu);
  if (!opererar(ve)) throw new Fel(403, 'Din vårdenhet har ingen operationsverksamhet i demon.', 'nekad');
  if (b.vardenhet === ve) throw new Fel(409, 'Blocket är redan vårdenhetens.', 'ogiltig');
  if (b.vardenhet) throw new Fel(409, `Blocket är tilldelat ${enhetsnamn(db, b.vardenhet)}. Vårdenheten kan släppa det.`, 'ogiltig');
  db.query('INSERT INTO op_block_andringar (sal, datum, vardenhet_id, enhet_id, av, tid) VALUES (?, ?, ?, ?, ?, ?)').run(sal, datum, ve, ve, personal.id, iso(nu));
  return { ...blockUt(db, personal, sal, datum, nu), text: `Blocket i ${SAL[sal].namn} ${datum} är vårdenhetens.` };
}

// ---- Förberedelserna -------------------------------------------------------------------------------------------------

// Proverna som behövs före operationen och om de är beställda eller besvarade på vårdenheten efter anmälan. Bara det som
// den inloggade får se räknas (labb.synligaBestallningar).
// Runda 11, r2: provsvar som är äldre än GILTIGA_PROVER_MANADER vid operationen (eller nu, om den inte är planerad) gäller
// inte längre och räknas som saknade (demoregel efter Region Skånes rutin för preoperativ utredning, docs/design.md).
export const GILTIGA_PROVER_MANADER = 3;
const minusManader = (iso, n) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString(); };
function proverFor(atk, an, nu = new Date()) {
  const ing = INGREPP[an.kva];
  const behov = [...PREOP_ANALYSER, ...(ing.blod ? ['blodgruppering', 'bastest'] : [])];
  const synliga = labb.synligaBestallningar(atk).filter(b => !b.makulerad_tid && b.skapad >= an.anmald_tid);
  const rader = synliga.flatMap(b => atk.db.query("SELECT analys, status, besvarad_tid FROM labb_analyser WHERE bestallning_id = ? AND status <> 'borttagen'").all(b.id));
  const plan = planeringFor(atk.db, an.id);
  const grans = minusManader([iso(nu), plan?.start ?? ''].sort().at(-1), GILTIGA_PROVER_MANADER);
  return behov.map(id => {
    const r = rader.filter(x => x.analys === id);
    const besvarade = r.filter(x => x.status === 'besvarad');
    const status = besvarade.some(x => !x.besvarad_tid || x.besvarad_tid >= grans) ? 'besvarad' : besvarade.length ? 'for_gammal' : r.length ? 'bestalld' : 'saknas';
    return { analys: id, namn: ANALYS[id]?.namn ?? id, status };
  });
}

export function forberedelser(atk, an, nu = new Date()) {
  const ing = INGREPP[an.kva];
  const prover = proverFor(atk, an, nu);
  const plan = planeringFor(atk.db, an.id);
  // Runda 11, r2: den kopplade anestesibedömningen och dess giltighetstid.
  const bed = an.anestesi === 'lokal' ? null : anestesiFor(atk, an, nu);
  const anestesi = an.anestesi === 'lokal' ? { klar: true, text: 'Behövs inte vid lokalbedövning.' }
    : bed?.giltig ? { klar: true, text: `${bed.asaText}, bedömd ${bed.tid.slice(0, 10)} av ${bed.av}, giltig till ${bed.giltigTill}.${bed.samtycke === 'ja' ? ' Patienten har samtyckt.' : ''}${bed.forandringar?.length ? ' Patientens tillstånd kan ha ändrats sedan bedömningen. Anestesiläkaren bedömer om den gäller när ASA-klassen bekräftas på operationsdagen.' : ''}`,
      patientinformation: bed.patientinformation, skalor: bed.skalor, varningar: bed.forandringar ?? [] }
      : bed ? { klar: false, text: `Anestesibedömningen gällde till ${bed.giltigTill}. Patienten behöver bedömas igen före operationen.` }
        : an.asa != null ? { klar: true, text: `ASA ${an.asa}.` } : { klar: false, text: 'Patienten behöver bedömas av anestesiläkaren före operationen.' };
  const punkter = [
    { id: 'prover', namn: 'Prover före operationen', klar: prover.every(p => !['saknas', 'for_gammal'].includes(p.status)),
      text: [prover.some(p => p.status === 'saknas') ? `Saknas: ${prover.filter(p => p.status === 'saknas').map(p => p.namn).join(', ')}.` : '',
        prover.some(p => p.status === 'for_gammal') ? `Svaren är äldre än ${GILTIGA_PROVER_MANADER === 3 ? 'tre' : GILTIGA_PROVER_MANADER} månader vid operationen: ${prover.filter(p => p.status === 'for_gammal').map(p => p.namn).join(', ')}.` : '']
        .filter(Boolean).join(' ').concat(prover.some(p => ['saknas', 'for_gammal'].includes(p.status)) ? ' Systemet kan beställa dem med ett klick.' : 'Alla prover är beställda.') },
    { id: 'anestesi', namn: 'Anestesibedömning', ...anestesi },
    { id: 'kallelse', namn: 'Kallelse med förberedelser', klar: Boolean(plan?.kallelse), text: plan?.kallelse ? 'Kallelsen är skickad (simulerad).' : 'Skrivs av systemet när operationen planeras.' },
  ];
  return { punkter, prover, klar: punkter.every(p => p.klar), blod: ing.blod };
}

// Runda 11, r2: vårdhändelser som kan påverka ett planerat ingrepp, ur det som den inloggade får se: antikoagulantia och
// insulin i läkemedelslistan, feber de senaste två dygnen och diagnoser som har tillkommit sedan anmälan.
// Säkerhetsgranskningen: varje sidoläsning loggas på patienten med sin egen handling och grund, när något lästes.
export function paverkar(atk, an, nu = new Date()) {
  const db = atk.db;
  const lasta = [];
  const a = (h) => { const x = new Atkomst(db, atk.personal, an.patient_id, atk.val, h); lasta.push([h, x]); return x; };
  const ut = [];
  try { paverkarRader(db, atk, an, a, ut, nu); } finally {
    for (const [h, x] of lasta) if (x.grunder.size) x.logga(h, x.grund(), `operation:${an.id}:paverkar`);
  }
  return ut;
}
function paverkarRader(db, atk, an, a, ut, nu) {
  if (kanRoll(atk.personal, 'las_lakemedel')) {
    const kat = new Map(db.query('SELECT id, namn, styrka, atc FROM katalog').all().map(k => [k.id, k]));
    for (const o of lakemedel.synligaOrdinationer(a('las_lakemedel')).filter(o => lakemedel.aktuell(o))) {
      const k = kat.get(o.lakemedel_id);
      if (!k?.atc) continue;
      if (/^B01A[AEF]/.test(k.atc)) ut.push({ typ: 'antikoagulantia', niva: 'varning', text: `${k.namn} ${k.styrka} (${k.atc}) är insatt. Planera uppehåll inför operationen och bedöm behovet av bryggbehandling.` });
      else if (k.atc.startsWith('A10A')) ut.push({ typ: 'diabetes', niva: 'info', text: `${k.namn} (${k.atc}) är insatt. Planera glukoskontroll under fastan och operationen.` });
    }
  }
  if (kanRoll(atk.personal, 'las_matvarden')) {
    const grans = iso(nu.getTime() - 2 * DAG);
    const feber = journal.synligaMatvarden(a('las_matvarden')).find(m => m.typ === 'temp' && m.tid >= grans && Number(m.varde_num) >= 38);
    if (feber) ut.push({ typ: 'feber', niva: 'varning', text: `Feber ${String(feber.varde_num).replace('.', ',')} grader ${datumText(feber.tid)} klockan ${klocka(feber.tid)}. Bedöm om operationen kan genomföras som planerat.` });
  }
  if (kanRoll(atk.personal, 'las_diagnoser')) {
    for (const d of journal.synligaDiagnoser(a('las_diagnoser')).filter(d => d.datum > datumAv(new Date(an.anmald_tid)))) {
      ut.push({ typ: 'diagnos', niva: 'info', text: `Ny diagnos sedan anmälan: ${d.kod} ${d.text}.` });
    }
  }
}

// Kontrollen av id-bandet: siffrorna ur armbandet mot patientens personnummer och andra identiteter.
function armbandetHorTill(db, patientId, armband) {
  const siffror = (v) => String(v ?? '').replace(/\D/g, '');
  const a = siffror(armband);
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(patientId);
  let andra = [];
  try { andra = db.query('SELECT varde FROM identiteter WHERE patient_id = ?').all(patientId).map(r => r.varde); } catch { /* äldre sandlåda */ }
  return Boolean(a) && [p?.personnummer, ...andra].map(siffror).filter(Boolean).some(x => x === a || x.slice(2) === a || a.slice(2) === x);
}

// Beställer de prover som saknas, med beställningen till laboratoriet och blodcentralen som vanligt (labb.js).
export function bestallProver(atk, an, nu = new Date()) {
  opLas(atk, an);
  const saknas = proverFor(atk, an, nu).filter(p => ['saknas', 'for_gammal'].includes(p.status)).map(p => p.analys);
  if (!saknas.length) throw new Fel(409, 'Alla prover före operationen är redan beställda.', 'ogiltig');
  return labb.bestall(atk, { analyser: saknas, kvitteraDubbletter: true, kommentar: `Inför operation: ${INGREPP[an.kva].namn}` }, nu);
}

// ---- Anmälan och väntelistan -----------------------------------------------------------------------------------------

export function anmalForslag(atk, nu = new Date()) {
  atk.krav('operation_anmala');
  return {
    ingrepp: Object.values(INGREPP).map(i => ({ kva: i.kva, namn: i.namn, minuter: i.minuter, anestesi: i.anestesi, sida: i.sida })),
    prioriteter: Object.entries(PRIORITET).map(([id, p]) => ({ id, namn: p.namn, dagar: p.dagar })),
    prioritet: 'inom_3_manader', vardkontaktId: vardkontaktFor(atk, nu), vardenhet: enhetKort(atk.db, vardenhetFor(atk.db, atk.personal.enhet_id)), demoregel: DEMOREGEL,
  };
}

export function anmal(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('operation_anmala');
  // Säkerhetsgranskningen: bara en vårdenhet som opererar anmäler, eftersom anmälan beställer anestesin och ger
  // anestesienheten vårdrelation. En anestesienhet kan inte ge sig själv vårdrelation genom en anmälan.
  if (!opererar(vardenhetFor(db, atk.personal.enhet_id))) throw new Fel(403, 'Din vårdenhet opererar inte i demon. Remittera patienten till en opererande vårdenhet, som anmäler till operation.', 'nekad');
  if (!finns(INGREPP, body.kva)) throw new Fel(400, 'Välj ingreppet.', 'ogiltig', { falt: ['kva'] });
  const ing = INGREPP[body.kva];
  const sida = ing.sida ? body.sida : null;
  if (ing.sida && !finns(SIDA, sida)) throw new Fel(400, `Ange sidan. Ingreppet ${ing.namn.toLocaleLowerCase('sv')} görs på höger eller vänster sida.`, 'ogiltig', { falt: ['sida'] });
  const prioritet = body.prioritet ?? 'inom_3_manader';
  if (!finns(PRIORITET, prioritet)) throw new Fel(400, 'Välj prioritet.', 'ogiltig', { falt: ['prioritet'] });
  const anestesi = body.anestesi ?? ing.anestesi;
  if (!finns(ANESTESI, anestesi)) throw new Fel(400, 'Anestesiformen finns inte.', 'ogiltig', { falt: ['anestesi'] });
  const asa = body.asa == null ? null : Number(body.asa);
  if (asa != null && (!Number.isInteger(asa) || asa < 1 || asa > 5)) throw new Fel(400, 'ASA-klassen är 1 till 5.', 'ogiltig', { falt: ['asa'] });
  const mal = addDagar(datumAv(nu), PRIORITET[prioritet].dagar);
  const r = db.query(`INSERT INTO op_anmalningar (patient_id, enhet_id, vardkontakt_id, anmald_av, anmald_tid, kva, sida, prioritet, mal_datum, anestesi, asa, minuter, kommentar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vantar')`).run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), atk.personal.id, iso(nu), ing.kva, sida, prioritet, mal,
    anestesi, asa, ing.minuter, textFalt(body.kommentar, 300) || null);
  const an = anmalanRad(db, r.lastInsertRowid);
  historik(db, an, atk.personal.id, 'anmald', `${ing.kva} ${ing.namn}${sida ? `, ${SIDA[sida]}` : ''}`, iso(nu));
  return anmalanUt(atk, an, nu);
}

export function anmalanUt(atk, an, nu = new Date()) {
  const db = atk.db;
  const ing = INGREPP[an.kva];
  const plan = planeringFor(db, an.id);
  const f = forloppFor(db, an.id);
  const vantedagar = Math.floor((Date.parse(f?.in_sal ?? iso(nu)) - Date.parse(an.anmald_tid)) / DAG);
  return {
    id: an.id, kva: an.kva, ingrepp: ing.namn, sida: an.sida ? SIDA[an.sida] : null, prioritet: { id: an.prioritet, namn: PRIORITET[an.prioritet].namn },
    malDatum: an.mal_datum, overMal: !f?.in_sal && datumAv(nu) > an.mal_datum, vantedagar, anestesi: ANESTESI[an.anestesi], asa: an.asa, minuter: an.minuter,
    status: an.status, anmald: { tid: an.anmald_tid, av: personNamn(db, an.anmald_av) }, vardenhet: enhetKort(db, an.enhet_id), kommentar: an.kommentar,
    planering: plan ? planeringUt(db, plan) : null, forlopp: f ? forloppUt(db, an, f) : null, forberedelser: forberedelser(atk, an, nu),
    // Runda 11, r2.
    paverkar: ['vantar', 'planerad', 'pagar'].includes(an.status) ? paverkar(atk, an, nu) : [],
    // Runda 11, r2: ASA-klassen som en läkare har bekräftat i dag, före induktionen.
    asaBekraftad: (() => { const h = asaBekraftadDag(db, an, datumAv(nu)); return h ? { tid: h.tid, av: personNamn(db, h.personal_id), text: h.detalj } : null; })(),
    anestesienhet: enhetKort(db, anestesienhetFor(db, an)),
    historik: db.query('SELECT * FROM op_historik WHERE anmalan_id = ? ORDER BY id').all(an.id).map(h => ({ tid: h.tid, av: personNamn(db, h.personal_id), handelse: h.handelse, detalj: h.detalj })),
  };
}
// Runda 11, r2: teamet med anestesiläkare och anestesisjuksköterska, och den bokade utrustningen.
function planeringUt(db, p) {
  sakra(db);
  const t = Object.fromEntries(db.query('SELECT roll, personal_id FROM op_team WHERE planering_id = ?').all(p.id).map(r => [r.roll, r.personal_id]));
  return { id: p.id, sal: { id: p.sal, namn: SAL[p.sal]?.namn ?? p.sal }, start: p.start, slut: p.slut,
    team: { operator: personNamn(db, p.operator), opssk: personNamn(db, p.opssk), anestesilakare: personNamn(db, t.anestesilakare), anestesissk: personNamn(db, t.anestesissk) },
    utrustning: db.query('SELECT resurs FROM op_resursbokningar WHERE planering_id = ? ORDER BY id').all(p.id).map(r => resursKort(r.resurs)), kallelse: p.kallelse };
}

// Patientens operationer, för journalen. Inre sekretess och spärr prövas på den anmälande vårdenheten.
export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_operation');
  // Runda 11, r2: anestesienheten ser de anmälningar som är beställda till den, med vårdrelationen från anmälan.
  const alla = atk.db.query('SELECT * FROM op_anmalningar WHERE patient_id = ? ORDER BY anmald_tid DESC, id DESC').all(atk.patientId);
  const patientniva = atk.prova('las_operation');
  const anestesiRader = alla.filter(an => arAnestesienhet(atk, an)).filter(an => {
    const r = atk.prova('las_operation', { enhet_id: an.enhet_id });
    if (anestesiOk(r, patientniva)) { atk.grunder.add(r.tillaten ? r.grund : patientniva.grund); return true; }
    if (r.krav === 'kraver_samtycke') atk.doldaSparr = true;
    return false;
  });
  const synliga = new Set([...anestesiRader, ...atk.filtrera(alla.filter(an => !arAnestesienhet(atk, an)), 'las_operation')]);
  const rader = alla.filter(an => synliga.has(an));
  return { operationer: rader.map(an => anmalanUt(atk, an, nu)), demoregel: DEMOREGEL };
}

// Väntelistan för operation på den inloggades vårdenhet, i ordning efter målet för väntetiden. En patient som den
// inloggade inte får se finns inte med alls, och varje patient som visas loggas.
export function vantelista(db, personal, valFor, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const rader = db.query(`SELECT * FROM op_anmalningar WHERE status = 'vantar' AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY mal_datum, anmald_tid, id`).all(...enheter);
  const ut = [];
  for (const an of rader) {
    const r = provaRad(db, personal, valFor, an, 'las_operation');
    if (!r.tillaten) continue;
    loggaPatient(db, personal, an.patient_id, 'las_operation', r.grund, '/api/operation/vantelista');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(an.patient_id);
    ut.push({ id: an.id, patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) }, ingrepp: INGREPP[an.kva].namn, kva: an.kva,
      prioritet: PRIORITET[an.prioritet].namn, malDatum: an.mal_datum, overMal: datumAv(nu) > an.mal_datum, dagarKvar: Math.round((Date.parse(lokalTid(an.mal_datum, '12:00')) - nu.getTime()) / DAG) });
  }
  return { vardenhet: enhetKort(db, ve), vantande: ut, demoregel: DEMOREGEL };
}

// ---- Planering av sal, team och tid -----------------------------------------------------------------------------------

const upptagen = (db, kolumn, varde, start, slut, utom = null) => Boolean(db.query(`SELECT 1 FROM op_planeringar WHERE ${kolumn} = ? AND struken_tid IS NULL
  AND start < ? AND slut > ? AND anmalan_id IS NOT ? LIMIT 1`).get(varde, slut, start, utom));
// Runda 11, r2: anestesiteamet och resurserna prövas mot de planeringar som inte är strukna.
const upptagenITeam = (db, personalId, start, slut, utom = null) => Boolean(db.query(`SELECT 1 FROM op_team t JOIN op_planeringar p ON p.id = t.planering_id
  WHERE t.personal_id = ? AND p.struken_tid IS NULL AND p.start < ? AND p.slut > ? AND p.anmalan_id IS NOT ? LIMIT 1`).get(personalId, slut, start, utom));
function resursLedig(db, resurs, sjukhus, start, slut, utom = null) {
  const n = db.query(`SELECT count(*) AS n FROM op_resursbokningar r JOIN op_planeringar p ON p.id = r.planering_id WHERE r.resurs = ? AND r.sjukhus = ?
    AND p.struken_tid IS NULL AND p.start < ? AND p.slut > ? AND p.anmalan_id IS NOT ?`).get(resurs, sjukhus, slut, start, utom).n;
  return n < (RESURSANTAL[sjukhus]?.[resurs] ?? 0);
}
const forstaUpptagenResurs = (db, an, sal, start, slut) => (INGREPP[an.kva].utrustning ?? []).find(r => !resursLedig(db, r, SAL[sal].sjukhus, start, slut, an.id)) ?? null;

// Teamet som systemet föreslår: operatören är den anmälande läkaren om den finns på vårdenheten, annars en annan läkare,
// och operationssjuksköterskan den första sjuksköterskan på vårdenheten. Runda 11, r2: anestesiläkaren och
// anestesisjuksköterskan väljs ur titeln, och de och operationskoordinatorn föreslås inte som operatör eller opssk.
function personalPaEnhet(db, vardenhet, yrke) {
  if (!vardenhet) return [];
  const enheter = enheterUnder(db, vardenhet);
  return db.query(`SELECT id, titel FROM personal WHERE yrke = ? AND aktiv = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY id`).all(yrke, ...enheter);
}
const personalPa = (db, an, yrke) => personalPaEnhet(db, vardenhetFor(db, an.enhet_id), yrke);
// Runda 11, r2: anestesiläkaren och anestesisjuksköterskan kommer från anestesienheten på sjukhuset.
function teamForslag(db, an) {
  const lak = personalPa(db, an, 'lakare'), ssk = personalPa(db, an, 'sjukskoterska');
  const ane = anestesienhetFor(db, an);
  const lakare = lak.filter(p => !utanforOpteam(p.titel)).map(r => r.id);
  return { operator: lakare.includes(an.anmald_av) ? an.anmald_av : lakare[0] ?? an.anmald_av, opssk: ssk.find(p => !utanforOpteam(p.titel))?.id ?? null,
    anestesilakare: personalPaEnhet(db, ane, 'lakare').find(p => arAnestesilakare(p.titel))?.id ?? null,
    anestesissk: personalPaEnhet(db, ane, 'sjukskoterska').find(p => arAnestesissk(p.titel))?.id ?? null };
}
const kort = (db, id) => (id ? { id, namn: personNamn(db, id) } : null);
const resursKort = (id) => ({ id, namn: RESURSER[id].namn, typ: RESURSER[id].typ });

// Första lediga tiden från i morgon (akut: i dag), vardagar inom salstiden. Runda 11, r2: i första hand i vårdenhetens
// egna block på det egna sjukhuset, sedan i egna block på andra sjukhus och sist i öppna eller släppta salar på det egna
// sjukhuset. Utrustningen och teamet med anestesi ska vara lediga.
export function planeringsforslag(atk, an, nu = new Date()) {
  andraOp(atk, an, 'operation_planera');
  const db = atk.db;
  if (an.status !== 'vantar') throw new Fel(409, 'Operationen är redan planerad eller genomförd.', 'ogiltig');
  const ve = vardenhetFor(db, an.enhet_id);
  const egetSjukhus = sjukhusFor(db, ve);
  if (!SALAR.some(s => s.sjukhus === egetSjukhus) && !opererar(ve)) throw new Fel(409, 'Vårdenheten har ingen operationssal i demon.', 'ogiltig');
  const team = teamForslag(db, an);
  const langd = (an.minuter + BYTE_MINUTER) * MIN;
  const forsta = an.prioritet === 'akut' ? 0 : 1;
  const ordning = (x) => (x.egen ? (x.s.sjukhus === egetSjukhus ? 0 : 1) : 2);
  for (let d = forsta; d < 180; d++) {
    const dag = addDagar(datumAv(nu), d);
    const vd = veckodag(dag);
    if (an.prioritet !== 'akut' && (vd === 0 || vd === 6)) continue;
    const salar = SALAR.map(s => ({ s, ...salTillganglig(db, ve, s.id, dag, nu) })).filter(x => x.ok).sort((a, b) => ordning(a) - ordning(b));
    for (const { s } of salar) {
      const slutDag = Date.parse(lokalTid(dag, SALSTID.till));
      for (let t = Date.parse(lokalTid(dag, SALSTID.fran)); t + langd <= slutDag; t += 15 * MIN) {
        if (t < nu.getTime()) continue;
        const start = iso(t), slut = iso(t + langd);
        if (upptagen(db, 'sal', s.id, start, slut) || forstaUpptagenResurs(db, an, s.id, start, slut) || upptagen(db, 'operator', team.operator, start, slut)
          || (team.opssk && upptagen(db, 'opssk', team.opssk, start, slut)) || [team.anestesilakare, team.anestesissk].some(p => p && upptagenITeam(db, p, start, slut))) continue;
        return { sal: { id: s.id, namn: s.namn }, start, slut, operator: kort(db, team.operator), opssk: kort(db, team.opssk),
          anestesilakare: kort(db, team.anestesilakare), anestesissk: kort(db, team.anestesissk), utrustning: (INGREPP[an.kva].utrustning ?? []).map(resursKort),
          inomMal: dag <= an.mal_datum,
          text: `${datumText(start)} klockan ${klocka(start)} i ${s.namn}${dag <= an.mal_datum ? ', inom målet för väntetiden' : `. Det är efter målet ${an.mal_datum}`}.` };
      }
    }
  }
  throw new Fel(409, 'Det finns ingen ledig tid i salarna det närmaste halvåret.', 'ogiltig');
}

export function kallelseText(an, plan) {
  const ing = INGREPP[an.kva];
  const ankomst = iso(Date.parse(plan.start) - 90 * MIN);
  return [`Du är planerad för ${ing.namn.toLocaleLowerCase('sv')}${an.sida ? ` på ${SIDA[an.sida]} sida` : ''} ${datumText(plan.start)}.`,
    `Kom klockan ${klocka(ankomst)}, en och en halv timme före operationen.`,
    an.anestesi === 'lokal' ? 'Du får äta och dricka som vanligt.' : 'Ät inte efter midnatt. Du får dricka klara drycker fram till två timmar före ankomsten.',
    'Duscha kvällen före och på morgonen. Ta med en lista över dina läkemedel.', 'Kallelsen är skickad av en simulerad tjänst i demon.'].join(' ');
}

export function planera(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_planera');
  const f = planeringsforslag(atk, an, nu);
  const sal = body.sal ?? f.sal.id;
  if (!finns(SAL, sal)) throw new Fel(400, 'Salen finns inte på sjukhuset.', 'ogiltig', { falt: ['sal'] });
  const startMs = body.start ? Date.parse(body.start) : Date.parse(f.start);
  if (!Number.isFinite(startMs) || startMs < nu.getTime()) throw new Fel(400, 'Starttiden är inte en giltig tid framåt.', 'ogiltig', { falt: ['start'] });
  const start = iso(startMs), slut = iso(startMs + (an.minuter + BYTE_MINUTER) * MIN);
  const dag = datumAv(new Date(startMs));
  // Runda 11, r2: salen ska vara vårdenhetens block den dagen, eller öppen eller släppt på det egna sjukhuset.
  const tg = salTillganglig(db, vardenhetFor(db, an.enhet_id), sal, dag, nu);
  if (!tg.ok) throw new Fel(SAL[sal].sjukhus === sjukhusFor(db, an.enhet_id) ? 409 : 400, tg.text, 'ogiltig', { falt: ['sal'] });
  if (start < lokalTid(dag, SALSTID.fran) || slut > lokalTid(dag, SALSTID.till)) throw new Fel(400, `Operationen ryms inte i salstiden ${SALSTID.fran} till ${SALSTID.till}.`, 'ogiltig', { falt: ['start'] });
  const operator = body.operator ?? f.operator.id;
  const opssk = body.opssk === undefined ? f.opssk?.id ?? null : body.opssk;
  const anestesilakare = body.anestesilakare === undefined ? f.anestesilakare?.id ?? null : body.anestesilakare;
  const anestesissk = body.anestesissk === undefined ? f.anestesissk?.id ?? null : body.anestesissk;
  const enheter = enheterUnder(db, vardenhetFor(db, an.enhet_id));
  const pa = (id, yrke) => db.query(`SELECT titel FROM personal WHERE id = ? AND yrke = ? AND aktiv = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')})`).get(id, yrke, ...enheter);
  if (typeof operator !== 'string' || !pa(operator, 'lakare')) throw new Fel(400, 'Operatören ska vara en läkare på vårdenheten.', 'ogiltig', { falt: ['operator'] });
  if (opssk != null && (typeof opssk !== 'string' || !pa(opssk, 'sjukskoterska'))) throw new Fel(400, 'Operationssjuksköterskan ska vara en sjuksköterska på vårdenheten.', 'ogiltig', { falt: ['opssk'] });
  const paAne = (id, yrke) => (typeof id === 'string' ? personalPaEnhet(db, anestesienhetFor(db, an), yrke).find(p => p.id === id) : null);
  if (anestesilakare != null && !arAnestesilakare(paAne(anestesilakare, 'lakare')?.titel)) throw new Fel(400, 'Välj en anestesiläkare på anestesienheten.', 'ogiltig', { falt: ['anestesilakare'] });
  if (anestesissk != null && !arAnestesissk(paAne(anestesissk, 'sjukskoterska')?.titel)) throw new Fel(400, 'Välj en anestesisjuksköterska på anestesienheten.', 'ogiltig', { falt: ['anestesissk'] });
  if (upptagen(db, 'sal', sal, start, slut)) throw new Fel(409, `${SAL[sal].namn} är upptagen då. Systemets förslag är ${f.text}`, 'krock');
  const resurs = forstaUpptagenResurs(db, an, sal, start, slut);
  if (resurs) throw new Fel(409, `${RESURSER[resurs].namn} är upptaget då på sjukhuset${RESURSANTAL[SAL[sal].sjukhus]?.[resurs] ? '' : ', som inte har det'}. Systemets förslag är ${f.text}`, 'krock');
  if (upptagen(db, 'operator', operator, start, slut)) throw new Fel(409, `${personNamn(db, operator)} opererar redan då.`, 'krock');
  if (opssk && upptagen(db, 'opssk', opssk, start, slut)) throw new Fel(409, `${personNamn(db, opssk)} är redan planerad i en annan operation då.`, 'krock');
  for (const p of [anestesilakare, anestesissk]) if (p && upptagenITeam(db, p, start, slut, an.id)) throw new Fel(409, `${personNamn(db, p)} är redan planerad i en annan operation då.`, 'krock');
  const kallelse = kallelseText(an, { start });
  db.transaction(() => {
    const pid = Number(db.query('INSERT INTO op_planeringar (anmalan_id, patient_id, enhet_id, sal, start, slut, operator, opssk, planerad_av, planerad_tid, kallelse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(an.id, an.patient_id, an.enhet_id, sal, start, slut, operator, opssk, atk.personal.id, iso(nu), kallelse).lastInsertRowid);
    for (const [roll, p] of [['anestesilakare', anestesilakare], ['anestesissk', anestesissk]]) if (p) db.query('INSERT INTO op_team (planering_id, patient_id, enhet_id, roll, personal_id) VALUES (?, ?, ?, ?, ?)').run(pid, an.patient_id, an.enhet_id, roll, p);
    for (const r of INGREPP[an.kva].utrustning ?? []) db.query('INSERT INTO op_resursbokningar (planering_id, patient_id, enhet_id, resurs, sjukhus) VALUES (?, ?, ?, ?, ?)').run(pid, an.patient_id, an.enhet_id, r, SAL[sal].sjukhus);
    db.query("UPDATE op_anmalningar SET status = 'planerad' WHERE id = ?").run(an.id);
    historik(db, an, atk.personal.id, 'planerad', `${SAL[sal].namn} ${datumAv(new Date(start))} ${klocka(start)}`, iso(nu));
  })();
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

// Stryker en planerad operation med orsak. Patienten står kvar på väntelistan med samma prioritet och mål.
export function stryk(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_planera');
  const plan = planeringFor(db, an.id);
  if (!plan || an.status !== 'planerad') throw new Fel(409, 'Bara en planerad operation som inte har börjat kan strykas.', 'ogiltig');
  if (!finns(STRYKORSAKER, body.orsak)) throw new Fel(400, 'Välj orsaken till att operationen stryks.', 'ogiltig', { falt: ['orsak'] });
  db.transaction(() => {
    db.query('UPDATE op_planeringar SET struken_tid = ?, struken_av = ?, struken_orsak = ? WHERE id = ?').run(iso(nu), atk.personal.id, body.orsak, plan.id);
    db.query("UPDATE op_anmalningar SET status = 'vantar' WHERE id = ?").run(an.id);
    historik(db, an, atk.personal.id, 'struken', STRYKORSAKER[body.orsak], iso(nu));
  })();
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

// Runda 11, r2: läkaren avbokar en anmälan som inte längre är aktuell. Patienten lämnar väntelistan, en planering stryks
// och anestesienheten har inte längre vårdrelation genom anmälan.
export const AVBOKNINGSORSAKER = tabell({ ej_aktuell: 'Operationen är inte längre aktuell', patient_avstar: 'Patienten avstår från operationen', annan_vardgivare: 'Patienten opereras hos en annan vårdgivare' });
export function avboka(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_anmala');
  if (!['vantar', 'planerad'].includes(an.status)) throw new Fel(409, 'Bara en väntande eller planerad operation som inte har börjat kan avbokas.', 'ogiltig');
  if (!finns(AVBOKNINGSORSAKER, body.orsak)) throw new Fel(400, 'Välj orsaken till att operationen avbokas.', 'ogiltig', { falt: ['orsak'] });
  db.transaction(() => {
    const plan = planeringFor(db, an.id);
    if (plan) db.query("UPDATE op_planeringar SET struken_tid = ?, struken_av = ?, struken_orsak = 'avbokad' WHERE id = ?").run(iso(nu), atk.personal.id, plan.id);
    db.query("UPDATE op_anmalningar SET status = 'avbokad' WHERE id = ?").run(an.id);
    historik(db, an, atk.personal.id, 'avbokad', AVBOKNINGSORSAKER[body.orsak], iso(nu));
  })();
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

// Anestesiläkarens bedömning före operationen.
export function anestesibedomning(atk, an, body = {}, nu = new Date()) {
  opAndra(atk, an, 'operation_anmala', { anestesi: true });
  const asa = Number(body.asa);
  if (!Number.isInteger(asa) || asa < 1 || asa > 5) throw new Fel(400, 'ASA-klassen är 1 till 5.', 'ogiltig', { falt: ['asa'] });
  atk.db.query('UPDATE op_anmalningar SET asa = ? WHERE id = ?').run(asa, an.id);
  historik(atk.db, an, atk.personal.id, 'anestesibedomning', `ASA ${asa}`, iso(nu));
  return anmalanUt(atk, anmalanRad(atk.db, an.id), nu);
}

// ---- Under operationen -----------------------------------------------------------------------------------------------

const lasJson = (s, standard) => { try { return JSON.parse(s); } catch { return standard; } };
function forloppUt(db, an, f) {
  const lista = lasJson(f.checklista, {});
  return {
    tider: HANDELSER.map(h => ({ id: h.id, namn: h.namn, tid: f[h.id] ?? null })),
    checklista: Object.entries(CHECKLISTA).map(([id, d]) => ({ id, namn: d.namn, klar: Boolean(lista[id]), tid: lista[id]?.tid ?? null, av: personNamn(db, lista[id]?.av) })),
    implantat: lasJson(f.implantat, []), atgarder: lasJson(f.atgarder, []).map(k => ({ kod: k, text: KVA[k] ?? k, system: 'KVÅ' })),
    uppvakning: f.ut_sal ? { start: f.ut_sal, utskriven: f.utskriven_tid, av: personNamn(db, f.utskriven_av), overrapport: f.overrapport } : null,
    operationsminuter: f.knivtid && f.op_slut ? Math.round((Date.parse(f.op_slut) - Date.parse(f.knivtid)) / MIN) : null,
    // Runda 11, r2: avvikelsen från planeringen, start och längd i minuter.
    avvikelse: avvikelseFor(db, f),
  };
}
function avvikelseFor(db, f) {
  const p = db.query('SELECT * FROM op_planeringar WHERE id = ?').get(f.planering_id);
  if (!p || !f.in_sal) return null;
  const startMinuter = Math.round((Date.parse(f.in_sal) - Date.parse(p.start)) / MIN);
  // Tiden på salen jämförs med den planerade tiden utan bytet mellan operationerna.
  const langdMinuter = f.ut_sal ? Math.round((Date.parse(f.ut_sal) - Date.parse(f.in_sal) - (Date.parse(p.slut) - Date.parse(p.start) - BYTE_MINUTER * MIN)) / MIN) : null;
  const del = (n, ord) => (n > 0 ? `${n} minuter ${ord[0]}` : n < 0 ? `${-n} minuter ${ord[1]}` : null);
  const text = [del(startMinuter, ['senare än planerat', 'tidigare än planerat']) ? `Började ${del(startMinuter, ['senare än planerat', 'tidigare än planerat'])}.` : 'Började som planerat.',
    langdMinuter == null ? null : del(langdMinuter, ['längre än planerat', 'kortare än planerat']) ? `Tog ${del(langdMinuter, ['längre än planerat', 'kortare än planerat'])}.` : 'Tog den planerade tiden.'].filter(Boolean).join(' ');
  return { startMinuter, langdMinuter, text };
}

// Överkänsligheten som den inloggade får se.
const synligaAllergier = (atk, an) => atk.filtrera(atk.db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv'").all(an.patient_id), 'las_oversikt', { gemensam: true });

// Runda 11, r2: antibiotikaprofylaxen som systemet föreslår ur ingreppet, och alternativet vid överkänslighet mot penicillin.
export function profylaxFor(atk, an) {
  const pc = synligaAllergier(atk, an).some(o => (o.atc ?? '').startsWith('J01C') || /penicillin/i.test(o.amne));
  const p = PROFYLAX[pc ? 'alternativ' : INGREPP[an.kva].profylax];
  return { ...p, text: `${p.namn} ${String(p.dos).replace('.', ',')} ${p.enhet} intravenöst inom 60 minuter före snittet${pc ? ', eftersom patienten är överkänslig mot penicillin' : ''}.` };
}
const anestesiRader = (db, an, slag) => db.query('SELECT * FROM op_anestesi WHERE anmalan_id = ? AND slag = ? ORDER BY tid, id').all(an.id, slag);

// Det som systemet fyller i på checklistan ur journalen och operationen: id-bandet, allergierna som den inloggade får
// se, blodet, samtycket i anestesibedömningen, monitorns värden, teamet, profylaxen, sterilgodset och registreringarna.
// En punkt som inte gäller ingreppet är ejAktuell. forifylld betyder att systemet har kontrollerat punkten.
export function checklistaUnderlag(atk, an, nu = new Date()) {
  opLas(atk, an);
  const db = atk.db;
  const ing = INGREPP[an.kva];
  const allergier = synligaAllergier(atk, an).map(o => o.amne);
  const prover = proverFor(atk, an, nu);
  const blodProver = ing.blod ? prover.filter(p => ['blodgruppering', 'bastest'].includes(p.analys)) : [];
  const allergiText = allergier.length ? `Kända allergier: ${allergier.join(', ')}.` : 'Ingen registrerad överkänslighet.';
  const blodText = !ing.blod ? 'Blod behöver inte beställas för ingreppet.' : blodProver.every(p => p.status === 'besvarad') ? 'Blodgruppering och bastest är klara.' : 'Blodgruppering och bastest är inte klara. Beställ dem innan anestesin.';
  const f = forloppFor(db, an.id);
  const plan = planeringFor(db, an.id);
  const id = db.query("SELECT tid FROM op_historik WHERE anmalan_id = ? AND handelse = 'identitet' ORDER BY id DESC LIMIT 1").get(an.id);
  require('./anestesijournal.js').fyllVarden(db, an, nu);
  const bedAlla = anestesiFor(atk, an, nu);
  const bed = bedAlla?.giltig ? bedAlla : null;
  const varden = db.query('SELECT count(*) AS n FROM op_anestesi_varden WHERE anmalan_id = ?').get(an.id).n;
  const prof = profylaxFor(atk, an);
  const antibiotika = anestesiRader(db, an, 'lakemedel').filter(r => ['kloxacillin', 'cefuroxim', 'klindamycin'].includes(r.kod)).at(-1);
  const galler = db.query('SELECT * FROM op_sterilgods WHERE anmalan_id = ?').all(an.id);
  const team = plan ? planeringUt(db, plan).team : null;
  const imp = f ? lasJson(f.implantat, []) : [];
  const P = (klar, text, extra = {}) => ({ forifylld: Boolean(klar), text, ...extra });
  const system = {
    fore_anestesi: {
      identitet: P(id, id ? `Armbandet är skannat klockan ${klocka(id.tid)} och hör till patienten.` : 'Skanna armbandet när patienten kommer in på salen.'),
      ingrepp: P(false, `${ing.namn}${an.sida ? `, ${SIDA[an.sida]} sida` : ''}.`),
      markering: ing.sida ? P(false, `Markera ${SIDA[an.sida]} sida.`) : P(true, 'Ingreppet görs inte på en sida, så ingen markering behövs.', { ejAktuell: true }),
      samtycke: P(bed?.samtycke === 'ja', bed?.samtycke === 'ja' ? 'Samtycket är registrerat i anestesibedömningen.' : 'Samtycket till anestesin finns inte i en giltig anestesibedömning.'),
      utrustning: P(false, 'Kontrollera anestesiapparaten, sugen och akutläkemedlen.'),
      pulsoximeter: P(varden > 0, varden > 0 ? 'Anestesimonitorn skickar värden (simulerad).' : 'Monitorn har inte skickat några värden ännu.'),
      allergi: P(true, allergiText),
      luftvag: P(Boolean(bed), bed ? (bed.luftvag?.risker?.length ? `Risk: ${bed.luftvag.risker.join(' ')}` : `Bedömd i anestesibedömningen${bed.luftvag?.mallampati ? `, Mallampati ${bed.luftvag.mallampati}` : ''}.`) : 'Ingen anestesibedömning.'),
      blodning: P(!ing.blod || blodProver.every(p => p.status === 'besvarad'), blodText),
      fasta: P(false, bed?.fasta?.text ?? 'Fråga patienten när patienten åt och drack senast.'),
      trombos: P(false, 'Kontrollera trombosprofylaxen i läkemedelslistan.'),
    },
    fore_snitt: {
      team: P(Boolean(team), team ? `Planerat team: ${[team.operator, team.opssk, team.anestesilakare, team.anestesissk].filter(Boolean).join(', ')}.` : 'Teamet är inte planerat.'),
      bekraftat: P(false, `${ing.namn}${an.sida ? `, ${SIDA[an.sida]} sida` : ''}.`),
      antibiotika: P(antibiotika && Date.parse(antibiotika.tid) >= nu.getTime() - 60 * MIN, antibiotika ? `${antibiotika.kod.charAt(0).toUpperCase()}${antibiotika.kod.slice(1)} gavs klockan ${klocka(antibiotika.tid)}.` : `Förslag: ${prof.text}`),
      kritiska: P(false, `Beräknad operationstid ${an.minuter} minuter.${ing.blod ? ' Risk för blödning, blod är beställt.' : ''}`),
      anestesirisk: P(Boolean(bed), bed ? `ASA ${bed.asa}${bed.akut ? 'E' : ''}, ${bed.anestesiformText.toLocaleLowerCase('sv')}.` : 'Ingen anestesibedömning.'),
      sterilitet: P(galler.length > 0, galler.length ? `Öppnat: ${galler.map(g => `${g.galler} (charge ${g.charge})`).join(', ')}.` : 'Registrera instrumentgallren när de öppnas.'),
      bilder: P(false, 'Visa de bilder som behövs för ingreppet.'),
      varme: P(false, 'Planera värmetäcke och temperaturmätning.'),
      lage: P(false, 'Kontrollera läget och att trycket avlastas.'),
    },
    fore_utflyttning: {
      registrerat: P(f?.op_slut, f?.op_slut ? `${ing.kva} ${ing.namn} är registrerat.` : 'Registreras när operationen är slut.'),
      rakning: P(galler.length > 0 && galler.every(g => g.raknad_tid), galler.length ? (galler.every(g => g.raknad_tid) ? 'Instrumenten är räknade och stämmer.' : 'Räkna instrumenten i gallren.') : 'Räkna instrument, kompresser och nålar.'),
      preparat: P(false, 'Märk preparaten.'),
      implantat: ing.implantat ? P(imp.length > 0, imp.length ? `Registrerat: ${imp.map(i => `${i.artikel}, lot ${i.lot}`).join('; ')}.` : 'Registrera implantatet med lot- eller serienummer.') : P(true, 'Ingreppet har inget implantat.', { ejAktuell: true }),
      utrustning: P(false, 'Rapportera fel på utrustning.'),
      uppvakning: P(false, 'Systemet skriver överrapporteringen till uppvakningen.'),
    },
  };
  const lista = f ? lasJson(f.checklista, {}) : {};
  return {
    allergier: allergiText, blod: blodText,
    delar: Object.entries(CHECKLISTA).map(([del, d]) => ({ id: del, namn: d.namn, klar: Boolean(lista[del]),
      punkter: Object.entries(d.punkter).map(([pid, namn]) => ({ id: pid, namn, ejAktuell: false, ...system[del][pid] })) })),
  };
}

// Runda 11, r2: den giltiga anestesibedömningen för operationen (iva.js), eller null.
function anestesiFor(atk, an, nu) {
  try { return require('./iva.js').anestesiForAnmalan(atk, an, nu); } catch (e) { if (e?.status) throw e; return null; }
}

function sakraForlopp(db, an, nu) {
  const f = forloppFor(db, an.id);
  if (f) return f;
  const plan = planeringFor(db, an.id);
  if (!plan) throw new Fel(409, 'Operationen är inte planerad.', 'ogiltig');
  db.query('INSERT INTO op_forlopp (anmalan_id, patient_id, enhet_id, planering_id) VALUES (?, ?, ?, ?)').run(an.id, an.patient_id, an.enhet_id, plan.id);
  return forloppFor(db, an.id);
}

// En del av checklistan. Alla punkter måste vara bekräftade. Innan patienten lämnar salen måste ingreppet vara
// registrerat och, när ingreppet har ett implantat, implantatet.
export function checklista(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_registrera');
  if (!finns(CHECKLISTA, body.del)) throw new Fel(400, 'Delen av checklistan finns inte.', 'ogiltig', { falt: ['del'] });
  const f = sakraForlopp(db, an, nu);
  const def = CHECKLISTA[body.del];
  const bekraftade = new Set(Array.isArray(body.bekraftade) ? body.bekraftade : []);
  // Runda 11, r2: punkter som inte gäller ingreppet behöver inte bekräftas.
  const ejAktuella = new Set([...(INGREPP[an.kva].sida ? [] : ['markering']), ...(INGREPP[an.kva].implantat ? [] : ['implantat'])]);
  const saknas = Object.entries(def.punkter).filter(([id]) => !bekraftade.has(id) && !ejAktuella.has(id)).map(([, t]) => t);
  if (saknas.length) throw new Fel(400, `${def.namn}: teamet har inte bekräftat ${saknas.length === 1 ? 'punkten' : `${saknas.length} punkter`}. ${saknas.join('. ')}.`, 'ogiltig', { falt: ['bekraftade'] });
  if (body.del === 'fore_utflyttning') {
    if (!f.op_slut) throw new Fel(409, 'Registrera att operationen är slut innan den sista delen av checklistan.', 'ogiltig');
    if (INGREPP[an.kva].implantat && !lasJson(f.implantat, []).length) throw new Fel(409, 'Ingreppet har ett implantat. Registrera implantatet innan patienten lämnar salen.', 'ogiltig');
    // Runda 11, r2: ett öppnat instrumentgaller ska vara räknat och stämma.
    const oraknade = db.query('SELECT galler FROM op_sterilgods WHERE anmalan_id = ? AND raknad_tid IS NULL').all(an.id).map(r => r.galler);
    if (oraknade.length) throw new Fel(409, `Räkna instrumenten i ${oraknade.join(', ')} innan patienten lämnar salen.`, 'ogiltig');
  }
  const lista = lasJson(f.checklista, {});
  lista[body.del] = { tid: iso(nu), av: atk.personal.id };
  db.query('UPDATE op_forlopp SET checklista = ? WHERE anmalan_id = ?').run(JSON.stringify(lista), an.id);
  historik(db, an, atk.personal.id, 'checklista', def.namn, iso(nu));
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

// En händelse under operationen. Systemet sätter tiden och håller ordningen. När operationen är slut registreras
// ingreppet som åtgärd med KVÅ på vårdkontakten.
export function registrera(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_registrera');
  if (!finns(HANDELSE, body.handelse)) throw new Fel(400, 'Händelsen finns inte.', 'ogiltig', { falt: ['handelse'] });
  if (!['planerad', 'pagar'].includes(an.status)) throw new Fel(409, an.status === 'vantar' ? 'Operationen är inte planerad.' : 'Operationen är redan avslutad.', 'ogiltig');
  const f = sakraForlopp(db, an, nu);
  const i = HANDELSER.findIndex(h => h.id === body.handelse);
  const h = HANDELSER[i];
  if (f[h.id]) throw new Fel(409, `${h.namn} är redan registrerad.`, 'ogiltig');
  const fore = HANDELSER.slice(0, i).find(x => !f[x.id]);
  if (fore) throw new Fel(409, `Registrera ${fore.namn.toLocaleLowerCase('sv')} först.`, 'ogiltig');
  if (h.checklista && !lasJson(f.checklista, {})[h.checklista]) throw new Fel(409, `Checklistan ${CHECKLISTA[h.checklista].namn.toLocaleLowerCase('sv')} är inte klar.`, 'ogiltig');
  const t = giltigTid(body.tid, 'tid', nu, { bakat: 12 * 60 * MIN });
  // Runda 11, r2: ingen induktion utan att en läkare har bekräftat ASA-klassen samma dag.
  if (h.id === 'anestesistart' && an.anestesi !== 'lokal' && !asaBekraftadDag(db, an, datumAv(new Date(t)))) {
    throw new Fel(409, 'Bekräfta ASA-klassen i dag innan anestesin startar. Anestesiläkaren bekräftar den på operationsdagen.', 'ogiltig');
  }
  // Runda 11, r2: id-bandet kan skannas när patienten kommer in på salen, och systemet kontrollerar att det hör till patienten.
  const armband = h.id === 'in_sal' && body.armband != null && body.armband !== '';
  if (armband && !armbandetHorTill(db, an.patient_id, body.armband)) {
    atk.logga('operation_registrera', 'nekad', `operation:${an.id}:armband`, 'nekad');
    throw new Fel(400, 'Armbandet hör inte till den här patienten. Kontrollera att rätt patient är på väg in på salen.', 'ogiltig', { falt: ['armband'] });
  }
  const forra = i > 0 ? f[HANDELSER[i - 1].id] : null;
  if (forra && t < forra) throw new Fel(400, `${h.namn} kan inte vara före ${HANDELSER[i - 1].namn.toLocaleLowerCase('sv')}.`, 'ogiltig', { falt: ['tid'] });
  db.transaction(() => {
    db.query(`UPDATE op_forlopp SET ${h.id} = ? WHERE anmalan_id = ?`).run(t, an.id);
    if (h.id === 'in_sal') db.query("UPDATE op_anmalningar SET status = 'pagar' WHERE id = ?").run(an.id);
    if (h.id === 'op_slut') {
      const koder = [an.kva, ...(Array.isArray(body.extraKva) ? body.extraKva.filter(k => finns(INGREPP, k) && k !== an.kva) : [])];
      for (const kod of koder) registreraAtgard(atk, { kod, tid: t, vardkontaktId: an.vardkontakt_id, underlag: { operation: an.id } });
      db.query('UPDATE op_forlopp SET atgarder = ? WHERE anmalan_id = ?').run(JSON.stringify(koder), an.id);
    }
    if (h.id === 'ut_sal') {
      db.query("UPDATE op_anmalningar SET status = 'uppvak' WHERE id = ?").run(an.id);
      db.query('UPDATE op_forlopp SET uppvak_start = ? WHERE anmalan_id = ?').run(t, an.id);
    }
    historik(db, an, atk.personal.id, h.id, h.namn, t);
    if (armband) historik(db, an, atk.personal.id, 'identitet', 'Armbandet är skannat och hör till patienten', t);
    // Runda 11, r2: när patienten lämnar salen skickas de öppnade instrumentgallren tillbaka till sterilcentralen.
    if (h.id === 'ut_sal') db.query('UPDATE op_sterilgods SET retur_tid = ? WHERE anmalan_id = ? AND retur_tid IS NULL').run(t, an.id);
  })();
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

export function implantat(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_registrera');
  if (an.status !== 'pagar') throw new Fel(409, 'Implantat registreras under operationen.', 'ogiltig');
  const artikel = textFalt(body.artikel, 100), tillverkare = textFalt(body.tillverkare, 100), lot = textFalt(body.lot, 40);
  if (!artikel || !tillverkare) throw new Fel(400, 'Ange implantatets artikel och tillverkare.', 'ogiltig', { falt: [!artikel ? 'artikel' : 'tillverkare'] });
  if (!/^[A-Za-z0-9-]{3,40}$/.test(lot)) throw new Fel(400, 'Ange implantatets lot- eller serienummer, 3 till 40 bokstäver, siffror eller bindestreck.', 'ogiltig', { falt: ['lot'] });
  const f = sakraForlopp(db, an, nu);
  const lista = [...lasJson(f.implantat, []), { artikel, tillverkare, lot, tid: iso(nu), av: personNamn(db, atk.personal.id) }];
  db.query('UPDATE op_forlopp SET implantat = ? WHERE anmalan_id = ?').run(JSON.stringify(lista), an.id);
  historik(db, an, atk.personal.id, 'implantat', `${artikel}, lot ${lot}`, iso(nu));
  return anmalanUt(atk, anmalanRad(db, an.id), nu);
}

// ---- Uppvakningen ----------------------------------------------------------------------------------------------------

export function kontroll(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_registrera');
  if (an.status !== 'uppvak') throw new Fel(409, 'Patienten är inte på uppvakningen.', 'ogiltig');
  atk.krav('registrera_matvarde');
  const varden = body.varden && typeof body.varden === 'object' ? body.varden : {};
  const typer = KRITERIER.map(k => k.typ).concat('temp').filter(t => varden[t] != null && varden[t] !== '');
  if (!typer.length) throw new Fel(400, 'Registrera minst ett värde.', 'ogiltig', { falt: ['varden'] });
  const t = giltigTid(body.tid, 'tid', nu, { bakat: 6 * 60 * MIN });
  // Runda 11, r2: kontrollerna knyts till vårdkontakten, som all vårdinformation.
  const vk = vardkontaktFor(atk, nu) ?? an.vardkontakt_id;
  db.transaction(() => { for (const typ of typer) { const id = matvarde(atk, typ, varden[typ], t); if (vk) db.query("UPDATE matvarden SET vardkontakt_id = ? WHERE id = ?").run(vk, id); } })();
  return uppvakning(atk, an, nu);
}

// Kriterierna för utskrivning från uppvakningen, prövade mot de senaste värdena efter att patienten lämnade salen. Bara
// värden som den inloggade får se räknas.
export function uppvakning(atk, an, nu = new Date()) {
  const db = atk.db;
  opLas(atk, an);
  const f = forloppFor(db, an.id);
  if (!f?.ut_sal) throw new Fel(409, 'Patienten har inte kommit till uppvakningen.', 'ogiltig');
  const mv = atk.filtrera(db.query('SELECT * FROM matvarden WHERE patient_id = ? AND tid >= ? ORDER BY tid DESC, id DESC').all(an.patient_id, f.ut_sal), 'las_matvarden');
  const kriterier = KRITERIER.map(k => {
    const m = mv.find(x => x.typ === k.typ);
    if (!m) return { typ: k.typ, namn: k.namn, uppfyllt: false, varde: null, text: `${k.namn} är inte registrerad. Krav: ${k.krav}.` };
    const v = { varde: m.varde, num: m.typ === 'blodtryck' ? Number(String(m.varde).split('/')[0]) : Number(m.varde_num ?? m.varde) };
    const ok = k.ok(v);
    return { typ: k.typ, namn: k.namn, uppfyllt: ok, varde: m.varde, tid: m.tid, text: ok ? `${k.namn} ${m.varde}.` : `${k.namn} ${m.varde}. Krav: ${k.krav}.` };
  });
  const minuter = Math.floor((nu.getTime() - Date.parse(f.ut_sal)) / MIN);
  const tidOk = minuter >= UPPVAK_MINUTER;
  return { start: f.ut_sal, minuter, kriterier, tidOk, klar: Boolean(f.utskriven_tid), kanSkrivasUt: !f.utskriven_tid && tidOk && kriterier.every(k => k.uppfyllt),
    text: f.utskriven_tid ? 'Patienten är utskriven från uppvakningen.' : !tidOk ? `Patienten ska vara minst ${UPPVAK_MINUTER} minuter på uppvakningen.` : kriterier.every(k => k.uppfyllt) ? 'Alla kriterier är uppfyllda. Patienten kan skrivas ut från uppvakningen.' : `Inte klar: ${kriterier.filter(k => !k.uppfyllt).map(k => k.namn.toLocaleLowerCase('sv')).join(', ')}.`,
    demoregel: DEMOREGEL };
}

// Överrapporteringen till vårdavdelningen, skriven av systemet ur operationen och uppvakningen.
export function overrapportText(atk, an, u) {
  const db = atk.db;
  const f = forloppFor(db, an.id);
  const ing = INGREPP[an.kva];
  const imp = lasJson(f.implantat, []);
  const und = checklistaUnderlag(atk, an);
  // Runda 11, r2: läkemedel, vätskor och händelser ur anestesijournalen.
  const under = require('./anestesijournal.js').sammanfattning(db, an);
  return [
    `Situation: ${ing.namn}${an.sida ? ` ${SIDA[an.sida]} sida` : ''} i ${ANESTESI[an.anestesi].toLocaleLowerCase('sv')}, klar klockan ${klocka(f.op_slut)}.`,
    `Bakgrund: ${an.asa != null ? `ASA ${an.asa}. ` : ''}${und.allergier}${imp.length ? ` Implantat: ${imp.map(i => `${i.artikel} (lot ${i.lot})`).join(', ')}.` : ''}${under ? ` ${under}` : ''}`,
    `Aktuellt: ${u.kriterier.map(k => `${k.namn.toLocaleLowerCase('sv')} ${k.varde}`).join(', ')}.`,
    `Rekommendation: kontroll av ${POSTOP_KONTROLLER.length} vitalparametrar var fjärde timme under ett dygn, smärtskattning vid varje kontroll.`,
  ].join(' ');
}

// Utskrivning från uppvakningen: kräver att kriterierna är uppfyllda. Systemet skriver överrapporteringen och ordinerar
// de postoperativa kontrollerna till avdelningen när den inloggade får ordinera kontroller.
export function skrivUt(atk, an, body = {}, nu = new Date()) {
  const db = atk.db;
  andraOp(atk, an, 'operation_registrera');
  if (an.status !== 'uppvak') throw new Fel(409, 'Patienten är inte på uppvakningen.', 'ogiltig');
  const u = uppvakning(atk, an, nu);
  if (!u.kanSkrivasUt) throw new Fel(409, u.text, 'ogiltig');
  const text = overrapportText(atk, an, u);
  let kontrollerna = null;
  db.transaction(() => {
    db.query('UPDATE op_forlopp SET utskriven_tid = ?, utskriven_av = ?, overrapport = ? WHERE anmalan_id = ?').run(iso(nu), atk.personal.id, text, an.id);
    db.query("UPDATE op_anmalningar SET status = 'klar' WHERE id = ?").run(an.id);
    historik(db, an, atk.personal.id, 'utskriven_uppvak', 'Överrapporterad till vårdavdelningen', iso(nu));
    if (body.ordineraKontroller !== false && kanRoll(atk.personal, 'ordinera_kontroll')) {
      kontrollerna = kontroller.ordinera(atk, { kontroller: POSTOP_KONTROLLER, frekvens: 'var_4', start: iso(nu), dygn: 1, kommentar: 'Postoperativa kontroller' }, nu);
    }
  })();
  return { ...anmalanUt(atk, anmalanRad(db, an.id), nu), overrapport: text, kontroller: kontrollerna?.kontroller ?? null,
    postopForslag: kontrollerna ? null : { kontroller: POSTOP_KONTROLLER, frekvens: 'var_4', text: 'Läkaren ordinerar de postoperativa kontrollerna till avdelningen.' } };
}

// ---- Enhetsnivå: dagens operationer och uppföljningen ------------------------------------------------------------------

function uppfoljningR11(db, { anm, genomforda, enheter, ph, start, slut, median }) {
  const inom = (t) => t && t >= start && t < slut;
  const nya = anm.filter(a => inom(a.anmald_tid));
  const planer = db.query(`SELECT * FROM op_planeringar WHERE enhet_id IN (${ph}) AND struken_tid IS NULL AND start >= ? AND start < ? ORDER BY start`).all(...enheter, start, slut);
  const bokade = new Map();
  for (const p of planer) for (const r of db.query('SELECT resurs FROM op_resursbokningar WHERE planering_id = ?').all(p.id)) {
    const x = bokade.get(r.resurs) ?? { bokningar: 0, minuter: 0 };
    x.bokningar++; x.minuter += Math.round((Date.parse(p.slut) - Date.parse(p.start)) / MIN);
    bokade.set(r.resurs, x);
  }
  // Dagens första operation per sal och dag: i tid när patienten kom in på salen högst tio minuter efter planerat.
  const forsta = new Map();
  for (const p of db.query('SELECT * FROM op_planeringar WHERE struken_tid IS NULL AND start >= ? AND start < ? ORDER BY start').all(start, slut)) {
    const k = `${p.sal} ${datumAv(new Date(p.start))}`;
    if (!forsta.has(k)) forsta.set(k, p);
  }
  const egnaForsta = [...forsta.values()].filter(p => enheter.includes(p.enhet_id)).map(p => ({ p, f: forloppFor(db, p.anmalan_id) })).filter(x => x.f?.in_sal);
  const uppvak = genomforda.filter(x => x.f.ut_sal && x.f.utskriven_tid).map(x => Math.round((Date.parse(x.f.utskriven_tid) - Date.parse(x.f.ut_sal)) / MIN)).sort((a, b) => a - b);
  return {
    inflode: { anmalda: nya.length, perPrioritet: Object.entries(PRIORITET).map(([id, p]) => ({ id, namn: p.namn, antal: nya.filter(a => a.prioritet === id).length })) },
    utrustning: Object.keys(RESURSER).map(id => ({ id, namn: RESURSER[id].namn, typ: RESURSER[id].typ, bokningar: bokade.get(id)?.bokningar ?? 0, minuter: bokade.get(id)?.minuter ?? 0 })),
    punktlighet: { forstaOperationer: egnaForsta.length, iTid: egnaForsta.filter(x => Date.parse(x.f.in_sal) <= Date.parse(x.p.start) + 10 * MIN).length, text: 'Dagens första operation i salen i tid, högst tio minuter efter planerat.' },
    uppvakning: { antal: uppvak.length, medianMinuter: median(uppvak) },
  };
}

// Runda 11, r2: patienterna på uppvakningen från den inloggades vårdenhet, med tiden och kriterierna. En patient som den
// inloggade inte får se finns inte med, och varje patient som visas loggas.
export function uppvakningslista(db, personal, valFor, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const rader = db.query(`SELECT * FROM op_anmalningar WHERE status = 'uppvak' AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY id`).all(...enheter);
  const ut = [];
  for (const an of rader) {
    const r = provaRad(db, personal, valFor, an, 'las_operation');
    if (!r.tillaten) continue;
    const atk = new Atkomst(db, personal, an.patient_id, valFor(an.patient_id), 'las_operation');
    const u = uppvakning(atk, an, nu);
    loggaPatient(db, personal, an.patient_id, 'las_operation', atk.grund(), '/api/operation/uppvakning');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(an.patient_id);
    ut.push({ anmalanId: an.id, patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) }, ingrepp: INGREPP[an.kva].namn, start: u.start, minuter: u.minuter,
      kanSkrivasUt: u.kanSkrivasUt, text: u.text, ejUppfyllda: u.kriterier.filter(k => !k.uppfyllt).map(k => k.namn) });
  }
  return { vardenhet: enhetKort(db, ve), patienter: ut, demoregel: DEMOREGEL };
}

// Dagens operationer i salarna på den inloggades sjukhus. En operation från en annan vårdenhet, eller med en patient som
// den inloggade inte får se, visas bara som upptagen tid utan ingrepp, patient, team eller vårdenhet.
export function oversikt(db, personal, valFor, { datum = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const dag = datum ?? datumAv(nu);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const fran = lokalTid(dag, '00:00'), till = lokalTid(addDagar(dag, 1), '00:00');
  // Runda 11, r2: salarna på det egna sjukhuset och salarna på andra sjukhus där vårdenheten har block den dagen.
  const egetSjukhus = sjukhusFor(db, ve);
  const salarna = SALAR.filter(s => s.sjukhus === egetSjukhus || blockFor(db, s.id, dag).vardenhet === ve);
  const salar = salarna.map(s => {
    const rader = db.query('SELECT * FROM op_planeringar WHERE sal = ? AND struken_tid IS NULL AND start >= ? AND start < ? ORDER BY start').all(s.id, fran, till);
    // Prognosen: när salen blir ledig efter varje operation, ur förloppet och den planerade längden.
    let ledig = 0;
    const operationer = rader.map(p => {
      const an = anmalanRad(db, p.anmalan_id);
      const f = forloppFor(db, an.id);
      const langd = Date.parse(p.slut) - Date.parse(p.start);
      let beraknadStart, beraknatSlut;
      if (f?.in_sal) {
        beraknadStart = Date.parse(f.in_sal);
        beraknatSlut = f.ut_sal ? Date.parse(f.ut_sal) + BYTE_MINUTER * MIN : Math.max(nu.getTime(), beraknadStart + langd);
      } else {
        beraknadStart = Math.max(Date.parse(p.start), ledig, ['planerad'].includes(an.status) && nu.getTime() > Date.parse(p.start) && dag === datumAv(nu) ? nu.getTime() : 0);
        beraknatSlut = beraknadStart + langd;
      }
      ledig = beraknatSlut;
      // Runda 13, r4: anestesienheten ser operationerna som är beställda till den i programmet, med samma prövning som
      // listan över beställda anestesibedömningar (anestesilista).
      const r = vardenhetFor(db, an.enhet_id) === ve ? provaRad(db, personal, valFor, an, 'las_operation') : anestesiProgram(db, personal, valFor, an, ve, nu);
      if (!r.tillaten) return { start: p.start, slut: p.slut, upptagen: true };
      loggaPatient(db, personal, an.patient_id, 'las_operation', r.grund, '/api/operation/oversikt');
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(an.patient_id);
      const sen = Math.round((beraknadStart - Date.parse(p.start)) / MIN);
      const forsenad = an.status === 'pagar' ? beraknatSlut > Date.parse(p.slut) : sen > 5 && an.status === 'planerad';
      return { start: p.start, slut: p.slut, anmalanId: an.id, patient: { id: pat.id, namn: visningsnamn(pat, valFor(pat.id).visa_identitet) }, ingrepp: INGREPP[an.kva].namn,
        status: an.status, team: planeringUt(db, p).team, senaste: f ? [...HANDELSER].reverse().find(h => f[h.id])?.namn ?? null : null,
        beraknadStart: iso(beraknadStart), beraknatSlut: iso(beraknatSlut), forsenad,
        avvikelse: forsenad ? (an.status === 'pagar' ? `Pågår längre än planerat. Beräknas klar klockan ${klocka(beraknatSlut)}.` : `Beräknad start klockan ${klocka(beraknadStart)}, försenad ${sen} minuter.`) : null };
    });
    const planerat = rader.reduce((x, p) => x + (Date.parse(p.slut) - Date.parse(p.start)) / MIN, 0);
    const b = blockFor(db, s.id, dag, nu);
    // Vems blocket är visas i veckans block, inte bredvid operationerna, så att en upptagen tid inte får en vårdenhet.
    return { id: s.id, namn: s.namn, block: { egen: b.vardenhet === ve, oppen: !b.vardenhet || b.frislappt }, operationer, belaggning: Math.round((planerat / SALSTID.minuter) * 100) };
  });
  return { datum: dag, vardenhet: enhetKort(db, ve), salstid: SALSTID, salar, demoregel: DEMOREGEL };
}

// Uppföljningen av kvalitet och produktion för vårdenheten, utan personuppgifter: väntande och väntetider mot målet,
// strukna operationer per orsak, salsutnyttjande och genomförda operationer per ingrepp med operationstider.
export function uppfoljning(db, personal, { fran = null, till = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'statistik', 'Din yrkesroll har inte uppföljningen.');
  const t = till ?? datumAv(nu), f = fran ?? addDagar(t, -90);
  if (![f, t].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) || f > t) throw new Fel(400, 'Ange perioden som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const start = lokalTid(f, '00:00'), slut = lokalTid(addDagar(t, 1), '00:00');
  const anm = db.query(`SELECT * FROM op_anmalningar WHERE enhet_id IN (${ph})`).all(...enheter);
  const idag = datumAv(nu);
  const vantande = anm.filter(a => ['vantar', 'planerad'].includes(a.status));
  const genomforda = anm.map(a => ({ a, f: forloppFor(db, a.id) })).filter(x => x.f?.op_slut && x.f.op_slut >= start && x.f.op_slut < slut);
  const vantetider = genomforda.map(x => Math.floor((Date.parse(x.f.in_sal) - Date.parse(x.a.anmald_tid)) / DAG)).sort((a, b) => a - b);
  const median = (v) => (v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null);
  const strukna = db.query(`SELECT struken_orsak AS orsak, count(*) AS n FROM op_planeringar WHERE enhet_id IN (${ph}) AND struken_tid >= ? AND struken_tid < ? AND struken_orsak <> 'avbokad' GROUP BY struken_orsak`).all(...enheter, start, slut);
  const planerade = db.query(`SELECT count(*) AS n FROM op_planeringar WHERE enhet_id IN (${ph}) AND start >= ? AND start < ?`).get(...enheter, start, slut).n;
  let vardagar = 0;
  for (let d = f; d <= t; d = addDagar(d, 1)) { const w = new Date(lokalTid(d, '12:00')).getUTCDay(); if (w !== 0 && w !== 6) vardagar++; }
  const salar = salarFor(db, personal.enhet_id).map(s => {
    const min = db.query('SELECT start, slut FROM op_planeringar WHERE sal = ? AND struken_tid IS NULL AND start >= ? AND start < ?').all(s.id, start, slut)
      .reduce((x, p) => x + (Date.parse(p.slut) - Date.parse(p.start)) / MIN, 0);
    return { id: s.id, namn: s.namn, planeradeMinuter: Math.round(min), tillgangligaMinuter: vardagar * SALSTID.minuter, utnyttjande: vardagar ? Math.round((min / (vardagar * SALSTID.minuter)) * 100) : 0 };
  });
  const perIngrepp = Object.values(INGREPP).map(i => {
    const g = genomforda.filter(x => x.a.kva === i.kva);
    const tider = g.map(x => (Date.parse(x.f.op_slut) - Date.parse(x.f.knivtid)) / MIN);
    return { kva: i.kva, namn: i.namn, antal: g.length, medelMinuter: tider.length ? Math.round(tider.reduce((a, b) => a + b, 0) / tider.length) : null, beraknadeMinuter: i.minuter };
  }).filter(x => x.antal > 0);
  return {
    vardenhet: enhetKort(db, ve), fran: f, till: t,
    vantande: { antal: vantande.length, overMal: vantande.filter(a => idag > a.mal_datum).length,
      perPrioritet: Object.entries(PRIORITET).map(([id, p]) => ({ id, namn: p.namn, antal: vantande.filter(a => a.prioritet === id).length })) },
    vantetid: { genomforda: genomforda.length, medianDagar: median(vantetider), inomMal: genomforda.filter(x => datumAv(new Date(x.f.in_sal)) <= x.a.mal_datum).length },
    strukna: { antal: strukna.reduce((s, r) => s + r.n, 0), andel: planerade ? Math.round((strukna.reduce((s, r) => s + r.n, 0) / planerade) * 100) : 0,
      perOrsak: strukna.map(r => ({ orsak: STRYKORSAKER[r.orsak] ?? r.orsak, antal: r.n })) },
    salar, perIngrepp,
    // Runda 11, r2: inflödet, utrustningen, punktligheten för dagens första operation per sal och tiden på uppvakningen.
    ...uppfoljningR11(db, { anm, genomforda, enheter, ph, start, slut, median }),
    text: 'Uppföljningen räknas av systemet ur anmälningarna, planeringen och förloppet. Den innehåller inga personuppgifter.',
  };
}
