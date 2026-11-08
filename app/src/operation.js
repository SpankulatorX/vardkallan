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
import { vardenhetFor, enheterUnder, kanRoll, visningsnamn } from './atkomst.js';
import { registreraAtgard } from './atgarder.js';
import { KVA } from './kodverk.js';
import * as kontroller from './kontroller.js';
import * as labb from './labb.js';
import { ANALYS } from './labb-katalog.js';
import { tabell, finns, personNamn, enhetsnamn, enhetKort, textFalt, iso, tid as giltigTid, MIN, DAG, kravRoll, vardkontaktFor,
  provaRad, loggaPatient, matvarde, lasRad, andraRad } from './specialist-hjalp.js';
// Säkerhetsgranskningen: varje anmälan binds till patienten och prövas på den anmälande vårdenheten.
const ANDRA = 'Operationen hanteras av den anmälande vårdenheten.';
const andraOp = (atk, an, handling) => andraRad(atk, an, handling, 'las_operation', ANDRA);

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Salarna och teamet är påhittade.';

// Ingreppen (KVÅ, demourval). minuter är beräknad operationstid, sida att sidan måste anges, implantat att ett
// implantat ska registreras och blod att blodgruppering och bastest ska finnas före operationen.
export const INGREPP = tabell({
  JKA21: { kva: 'JKA21', namn: 'Laparoskopisk kolecystektomi', minuter: 75, anestesi: 'generell', sida: false, implantat: false, blod: false },
  JEA00: { kva: 'JEA00', namn: 'Laparoskopisk appendektomi', minuter: 45, anestesi: 'generell', sida: false, implantat: false, blod: false },
  NFB49: { kva: 'NFB49', namn: 'Primär total protes i höftled med cement', minuter: 100, anestesi: 'regional', sida: true, implantat: true, blod: true },
  NGB49: { kva: 'NGB49', namn: 'Primär total protes i knäled med cement', minuter: 90, anestesi: 'regional', sida: true, implantat: true, blod: false },
});
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
// WHO:s checklista för säker kirurgi, i Socialstyrelsens och SKR:s svenska form, förkortad i demon.
export const CHECKLISTA = tabell({
  fore_anestesi: { namn: 'Före anestesi', punkter: { identitet: 'Patientens identitet är kontrollerad', ingrepp: 'Ingrepp och sida är bekräftade och markerade',
    samtycke: 'Patienten har fått information och samtyckt', utrustning: 'Anestesiutrustningen är kontrollerad', allergi: 'Kända allergier är genomgångna',
    luftvag: 'Risken för svår luftväg är bedömd', blodning: 'Risken för blödning är bedömd och blod finns om det behövs' } },
  fore_snitt: { namn: 'Före snitt (time out)', punkter: { team: 'Teamet har presenterat sig med namn och roll', bekraftat: 'Patient, ingrepp och sida är bekräftade av teamet',
    antibiotika: 'Antibiotikaprofylax är given eller inte aktuell', kritiska: 'Förväntade kritiska moment är genomgångna', bilder: 'Nödvändiga bilder finns tillgängliga' } },
  fore_utflyttning: { namn: 'Innan patienten lämnar salen', punkter: { registrerat: 'Ingreppet är registrerat', rakning: 'Instrument, kompresser och nålar är räknade och stämmer',
    preparat: 'Preparat är märkta', utrustning: 'Problem med utrustning är rapporterade', uppvakning: 'Det viktigaste för uppvakningen är överlämnat' } },
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

// ---- Förberedelserna -------------------------------------------------------------------------------------------------

// Proverna som behövs före operationen och om de är beställda eller besvarade på vårdenheten efter anmälan. Bara det som
// den inloggade får se räknas (labb.synligaBestallningar).
function proverFor(atk, an) {
  const ing = INGREPP[an.kva];
  const behov = [...PREOP_ANALYSER, ...(ing.blod ? ['blodgruppering', 'bastest'] : [])];
  const synliga = labb.synligaBestallningar(atk).filter(b => !b.makulerad_tid && b.skapad >= an.anmald_tid);
  const rader = synliga.flatMap(b => atk.db.query("SELECT analys, status FROM labb_analyser WHERE bestallning_id = ? AND status <> 'borttagen'").all(b.id));
  return behov.map(id => {
    const r = rader.filter(x => x.analys === id);
    const status = r.some(x => x.status === 'besvarad') ? 'besvarad' : r.length ? 'bestalld' : 'saknas';
    return { analys: id, namn: ANALYS[id]?.namn ?? id, status };
  });
}

export function forberedelser(atk, an) {
  const ing = INGREPP[an.kva];
  const prover = proverFor(atk, an);
  const plan = planeringFor(atk.db, an.id);
  const punkter = [
    { id: 'prover', namn: 'Prover före operationen', klar: prover.every(p => p.status !== 'saknas'),
      text: prover.some(p => p.status === 'saknas') ? `Saknas: ${prover.filter(p => p.status === 'saknas').map(p => p.namn).join(', ')}. Systemet kan beställa dem med ett klick.` : 'Alla prover är beställda.' },
    { id: 'anestesi', namn: 'Anestesibedömning', klar: an.anestesi === 'lokal' || an.asa != null,
      text: an.anestesi === 'lokal' ? 'Behövs inte vid lokalbedövning.' : an.asa != null ? `ASA ${an.asa}.` : 'Patienten behöver bedömas av anestesiläkaren före operationen.' },
    { id: 'kallelse', namn: 'Kallelse med förberedelser', klar: Boolean(plan?.kallelse), text: plan?.kallelse ? 'Kallelsen är skickad (simulerad).' : 'Skrivs av systemet när operationen planeras.' },
  ];
  return { punkter, prover, klar: punkter.every(p => p.klar), blod: ing.blod };
}

// Beställer de prover som saknas, med beställningen till laboratoriet och blodcentralen som vanligt (labb.js).
export function bestallProver(atk, an, nu = new Date()) {
  lasRad(atk, an, 'las_operation');
  const saknas = proverFor(atk, an).filter(p => p.status === 'saknas').map(p => p.analys);
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
    planering: plan ? planeringUt(db, plan) : null, forlopp: f ? forloppUt(db, an, f) : null, forberedelser: forberedelser(atk, an),
    historik: db.query('SELECT * FROM op_historik WHERE anmalan_id = ? ORDER BY id').all(an.id).map(h => ({ tid: h.tid, av: personNamn(db, h.personal_id), handelse: h.handelse, detalj: h.detalj })),
  };
}
const planeringUt = (db, p) => ({ id: p.id, sal: { id: p.sal, namn: SAL[p.sal]?.namn ?? p.sal }, start: p.start, slut: p.slut,
  team: { operator: personNamn(db, p.operator), opssk: personNamn(db, p.opssk), anestesi: 'Anestesiteamet (simulerat)' }, kallelse: p.kallelse });

// Patientens operationer, för journalen. Inre sekretess och spärr prövas på den anmälande vårdenheten.
export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_operation');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM op_anmalningar WHERE patient_id = ? ORDER BY anmald_tid DESC, id DESC').all(atk.patientId), 'las_operation');
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

// Teamet som systemet föreslår: operatören är den anmälande läkaren om den finns på vårdenheten, annars en annan läkare,
// och operationssjuksköterskan den första sjuksköterskan på vårdenheten.
function teamForslag(db, an) {
  const enheter = enheterUnder(db, vardenhetFor(db, an.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const lakare = db.query(`SELECT id FROM personal WHERE yrke = 'lakare' AND aktiv = 1 AND enhet_id IN (${ph}) ORDER BY id`).all(...enheter).map(r => r.id);
  const ssk = db.query(`SELECT id FROM personal WHERE yrke = 'sjukskoterska' AND aktiv = 1 AND enhet_id IN (${ph}) ORDER BY id`).all(...enheter).map(r => r.id);
  return { operator: lakare.includes(an.anmald_av) ? an.anmald_av : lakare[0] ?? an.anmald_av, opssk: ssk[0] ?? null };
}

// Första lediga tiden i en sal på sjukhuset från i morgon (akut: i dag), vardagar inom salstiden.
export function planeringsforslag(atk, an, nu = new Date()) {
  andraOp(atk, an, 'operation_planera');
  const db = atk.db;
  if (an.status !== 'vantar') throw new Fel(409, 'Operationen är redan planerad eller genomförd.', 'ogiltig');
  const salar = salarFor(db, an.enhet_id);
  if (!salar.length) throw new Fel(409, 'Vårdenheten har ingen operationssal i demon.', 'ogiltig');
  const team = teamForslag(db, an);
  const langd = (an.minuter + BYTE_MINUTER) * MIN;
  const forsta = an.prioritet === 'akut' ? 0 : 1;
  for (let d = forsta; d < 180; d++) {
    const dag = addDagar(datumAv(nu), d);
    const vd = new Date(lokalTid(dag, '12:00')).getUTCDay();
    if (an.prioritet !== 'akut' && (vd === 0 || vd === 6)) continue;
    for (const s of salar) {
      const slutDag = Date.parse(lokalTid(dag, SALSTID.till));
      for (let t = Date.parse(lokalTid(dag, SALSTID.fran)); t + langd <= slutDag; t += 15 * MIN) {
        if (t < nu.getTime()) continue;
        const start = iso(t), slut = iso(t + langd);
        if (upptagen(db, 'sal', s.id, start, slut) || upptagen(db, 'operator', team.operator, start, slut) || (team.opssk && upptagen(db, 'opssk', team.opssk, start, slut))) continue;
        return { sal: { id: s.id, namn: s.namn }, start, slut, operator: { id: team.operator, namn: personNamn(db, team.operator) },
          opssk: team.opssk ? { id: team.opssk, namn: personNamn(db, team.opssk) } : null, inomMal: dag <= an.mal_datum,
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
  if (!finns(SAL, sal) || !salarFor(db, an.enhet_id).some(s => s.id === sal)) throw new Fel(400, 'Salen finns inte på sjukhuset.', 'ogiltig', { falt: ['sal'] });
  const startMs = body.start ? Date.parse(body.start) : Date.parse(f.start);
  if (!Number.isFinite(startMs) || startMs < nu.getTime()) throw new Fel(400, 'Starttiden är inte en giltig tid framåt.', 'ogiltig', { falt: ['start'] });
  const start = iso(startMs), slut = iso(startMs + (an.minuter + BYTE_MINUTER) * MIN);
  const dag = datumAv(new Date(startMs));
  if (start < lokalTid(dag, SALSTID.fran) || slut > lokalTid(dag, SALSTID.till)) throw new Fel(400, `Operationen ryms inte i salstiden ${SALSTID.fran} till ${SALSTID.till}.`, 'ogiltig', { falt: ['start'] });
  const operator = body.operator ?? f.operator.id;
  const opssk = body.opssk === undefined ? f.opssk?.id ?? null : body.opssk;
  const enheter = enheterUnder(db, vardenhetFor(db, an.enhet_id));
  const pa = (id, yrke) => db.query(`SELECT 1 FROM personal WHERE id = ? AND yrke = ? AND aktiv = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')})`).get(id, yrke, ...enheter);
  if (typeof operator !== 'string' || !pa(operator, 'lakare')) throw new Fel(400, 'Operatören ska vara en läkare på vårdenheten.', 'ogiltig', { falt: ['operator'] });
  if (opssk != null && (typeof opssk !== 'string' || !pa(opssk, 'sjukskoterska'))) throw new Fel(400, 'Operationssjuksköterskan ska vara en sjuksköterska på vårdenheten.', 'ogiltig', { falt: ['opssk'] });
  if (upptagen(db, 'sal', sal, start, slut)) throw new Fel(409, `${SAL[sal].namn} är upptagen då. Systemets förslag är ${f.text}`, 'krock');
  if (upptagen(db, 'operator', operator, start, slut)) throw new Fel(409, `${personNamn(db, operator)} opererar redan då.`, 'krock');
  if (opssk && upptagen(db, 'opssk', opssk, start, slut)) throw new Fel(409, `${personNamn(db, opssk)} är redan planerad i en annan operation då.`, 'krock');
  const kallelse = kallelseText(an, { start });
  db.transaction(() => {
    db.query('INSERT INTO op_planeringar (anmalan_id, patient_id, enhet_id, sal, start, slut, operator, opssk, planerad_av, planerad_tid, kallelse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(an.id, an.patient_id, an.enhet_id, sal, start, slut, operator, opssk, atk.personal.id, iso(nu), kallelse);
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

// Anestesiläkarens bedömning före operationen.
export function anestesibedomning(atk, an, body = {}, nu = new Date()) {
  andraOp(atk, an, 'operation_anmala');
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
  };
}

// Det som systemet fyller i på checklistan ur journalen: allergierna som den inloggade får se och blodbeställningen.
export function checklistaUnderlag(atk, an) {
  lasRad(atk, an, 'las_operation');
  const allergier = atk.filtrera(atk.db.query('SELECT * FROM overkanslighet WHERE patient_id = ?').all(an.patient_id), 'las_oversikt', { gemensam: true }).map(o => o.amne);
  const prover = proverFor(atk, an);
  const blod = INGREPP[an.kva].blod ? prover.filter(p => ['blodgruppering', 'bastest'].includes(p.analys)) : [];
  return {
    allergier: allergier.length ? `Kända allergier: ${allergier.join(', ')}.` : 'Ingen registrerad överkänslighet.',
    blod: !INGREPP[an.kva].blod ? 'Blod behöver inte beställas för ingreppet.' : blod.every(p => p.status === 'besvarad') ? 'Blodgruppering och bastest är klara.' : 'Blodgruppering och bastest är inte klara. Beställ dem innan anestesin.',
  };
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
  const saknas = Object.entries(def.punkter).filter(([id]) => !bekraftade.has(id)).map(([, t]) => t);
  if (saknas.length) throw new Fel(400, `${def.namn}: bekräfta ${saknas.map(t => t.toLocaleLowerCase('sv')).join(', ')}.`, 'ogiltig', { falt: ['bekraftade'] });
  if (body.del === 'fore_utflyttning') {
    if (!f.op_slut) throw new Fel(409, 'Registrera att operationen är slut innan den sista delen av checklistan.', 'ogiltig');
    if (INGREPP[an.kva].implantat && !lasJson(f.implantat, []).length) throw new Fel(409, 'Ingreppet har ett implantat. Registrera implantatet innan patienten lämnar salen.', 'ogiltig');
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
  db.transaction(() => { for (const typ of typer) matvarde(atk, typ, varden[typ], t); })();
  return uppvakning(atk, an, nu);
}

// Kriterierna för utskrivning från uppvakningen, prövade mot de senaste värdena efter att patienten lämnade salen. Bara
// värden som den inloggade får se räknas.
export function uppvakning(atk, an, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, an, 'las_operation');
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
  return [
    `Situation: ${ing.namn}${an.sida ? ` ${SIDA[an.sida]} sida` : ''} i ${ANESTESI[an.anestesi].toLocaleLowerCase('sv')}, klar klockan ${klocka(f.op_slut)}.`,
    `Bakgrund: ${an.asa != null ? `ASA ${an.asa}. ` : ''}${und.allergier}${imp.length ? ` Implantat: ${imp.map(i => `${i.artikel} (lot ${i.lot})`).join(', ')}.` : ''}`,
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

// Dagens operationer i salarna på den inloggades sjukhus. En operation från en annan vårdenhet, eller med en patient som
// den inloggade inte får se, visas bara som upptagen tid utan ingrepp, patient, team eller vårdenhet.
export function oversikt(db, personal, valFor, { datum = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'las_operation');
  const dag = datum ?? datumAv(nu);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const fran = lokalTid(dag, '00:00'), till = lokalTid(addDagar(dag, 1), '00:00');
  const salar = salarFor(db, personal.enhet_id).map(s => {
    const rader = db.query('SELECT * FROM op_planeringar WHERE sal = ? AND struken_tid IS NULL AND start >= ? AND start < ? ORDER BY start').all(s.id, fran, till);
    const operationer = rader.map(p => {
      const an = anmalanRad(db, p.anmalan_id);
      const r = vardenhetFor(db, an.enhet_id) === ve ? provaRad(db, personal, valFor, an, 'las_operation') : { tillaten: false };
      if (!r.tillaten) return { start: p.start, slut: p.slut, upptagen: true };
      loggaPatient(db, personal, an.patient_id, 'las_operation', r.grund, '/api/operation/oversikt');
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(an.patient_id);
      const f = forloppFor(db, an.id);
      return { start: p.start, slut: p.slut, anmalanId: an.id, patient: { id: pat.id, namn: visningsnamn(pat, valFor(pat.id).visa_identitet) }, ingrepp: INGREPP[an.kva].namn,
        status: an.status, team: planeringUt(db, p).team, senaste: f ? [...HANDELSER].reverse().find(h => f[h.id])?.namn ?? null : null };
    });
    const planerat = rader.reduce((s, p) => s + (Date.parse(p.slut) - Date.parse(p.start)) / MIN, 0);
    return { id: s.id, namn: s.namn, operationer, belaggning: Math.round((planerat / SALSTID.minuter) * 100) };
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
  const strukna = db.query(`SELECT struken_orsak AS orsak, count(*) AS n FROM op_planeringar WHERE enhet_id IN (${ph}) AND struken_tid >= ? AND struken_tid < ? GROUP BY struken_orsak`).all(...enheter, start, slut);
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
    text: 'Uppföljningen räknas av systemet ur anmälningarna, planeringen och förloppet. Den innehåller inga personuppgifter.',
  };
}
