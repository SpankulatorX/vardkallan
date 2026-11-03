// Återinsättning efter ett uppehåll med antikoagulantia (runda 5, beslut 2026-11-03, Sussa 3.5.2.8). När läkaren sätter
// ut antikoagulantia med planen Uppehåll inför ingrepp sparas datumet för återinsättning (lakemedel.js). Systemet
// bevakar datumet, så att ingen behöver komma ihåg det:
//   - Från dagen före får läkaren en rad i inkorgen med läkemedlet, planen, den tidigare doseringen och en knapp till
//     läkemedelslistan, där ordinationen är ifylld ur den tidigare. Raden står kvar efter dagen tills den är åtgärdad,
//     eftersom inkorgen aldrig släpper något som inte är gjort.
//   - Mottagare är den läkare som ordinerade läkemedlet, den läkare som beslutade om uppehållet och läkarna på de
//     vårdenheterna.
//   - Raden försvinner när läkemedlet är insatt igen eller ordinationen ändras: en ny ordination med samma ATC-kod efter
//     uppehållet. En bryggbehandling med ett annat medel, till exempel Fragmin, räknas inte.
//   - Avslutas behandlingen för gott avfärdar läkaren raden med Avslutad behandling och en orsak som systemet föreslår
//     (beslut 2026-11-03). Avslutet sparas med vem, när och orsak, syns i ordinationens historik och i FHIR, ändras
//     aldrig, och raden försvinner för alla mottagare.
//
// Behörighet. Inkorgen visar bara patienter som läkaren får se, prövat i behörighetsmotorn utan aktiva val, och aldrig en
// ordination från en vårdenhet som patienten har spärrat. En ny ordination räknas bara om läkaren får se den, så att en
// återinsättning på en spärrad vårdenhet inte röjs genom att raden försvinner.
import { Fel, iso, idag, addDagar } from './db.js';
import { prova, kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { planText } from './lakemedelsregler.js';

const DAG = 86400_000;

// Avslutet av en återinsättning. Ändras och raderas aldrig, utom vid gallring av hela journalen (patient_id).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS aterinsattning_avslut (
  ordination_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, orsak TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS aterinsattning_avslut_andras_ej BEFORE UPDATE ON aterinsattning_avslut
  BEGIN SELECT RAISE(ABORT, 'Ett avslut av en återinsättning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS aterinsattning_avslut_raderas_ej BEFORE DELETE ON aterinsattning_avslut
  BEGIN SELECT RAISE(ABORT, 'Ett avslut av en återinsättning raderas inte'); END;
`;
const klara = new WeakSet();
export function sakraSchema(db) { if (!klara.has(db)) { db.exec(SCHEMA); klara.add(db); } }

// Orsakerna som systemet föreslår när behandlingen avslutas. Den första är förvald.
export const AVSLUT_ORSAKER = ['Behandlingen behövs inte längre', 'Byte till annat läkemedel', 'Patienten avböjer'];

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
// Avslutet för en ordination, eller null.
export function avslutFor(db, ordinationId) {
  sakraSchema(db);
  const a = db.query('SELECT * FROM aterinsattning_avslut WHERE ordination_id = ?').get(ordinationId);
  return a ? { orsak: a.orsak, av: personNamn(db, a.av), tid: a.tid } : null;
}
const personRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const dagarTill = (datum, dag = idag()) => Math.round((Date.parse(datum) - Date.parse(dag)) / DAG);
const narText = (n, datum) => (n === 0 ? `i dag, ${datum}` : n === 1 ? `i morgon, ${datum}` : null);

// Får användaren se ordinationen? Läkemedelslistan är gemensam, men spärrade vårdenheter visas inte utan samtycke, och
// inkorgen har inga aktiva val.
const far = (db, personal, o) => prova(db, { personal, patient: o.patient_id, handling: 'las_lakemedel', resurs: { enhet_id: o.enhet_id, gemensam: true } }).tillaten;

// Är läkaren mottagare av raden? Den ordinerande läkaren, den som beslutade om uppehållet och läkarna på de vårdenheterna.
function mottagare(db, personal, o, plan) {
  if (personal.id === o.ordinerad_av || personal.id === plan.av) return true;
  const ve = vardenhetFor(db, personal.enhet_id);
  const beslut = personRad(db, plan.av);
  return vardenhetFor(db, o.enhet_id) === ve || (beslut && vardenhetFor(db, beslut.enhet_id) === ve);
}

// Är läkemedlet insatt igen, eller har ordinationen ändrats? En ordination med samma ATC-kod efter utsättningen, som
// läkaren får se.
function atgardad(db, personal, o, lm) {
  const senare = db.query(`SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id
    WHERE o.patient_id = ? AND o.id <> ? AND k.atc = ? AND o.skapad >= ?`).all(o.patient_id, o.id, lm.atc, o.utsatt_tid);
  return senare.some(x => far(db, personal, x));
}

// Raderna i läkarens inkorg. Patienten läggs till och loggas av servern.
export function inkorg(db, personal) {
  if (!kanRoll(personal, 'ordinera')) return [];
  sakraSchema(db);
  const dag = idag();
  const ut = [];
  const planer = db.query(`SELECT p.*, o.id AS oid FROM utsattningsplaner p JOIN ordinationer o ON o.id = p.ordination_id
    WHERE p.typ = 'uppehall' AND o.status = 'utsatt' AND p.aterinsattning <= ?
      AND NOT EXISTS (SELECT 1 FROM aterinsattning_avslut a WHERE a.ordination_id = o.id) ORDER BY p.aterinsattning, o.id`).all(addDagar(dag, 1));
  for (const plan of planer) {
    const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(plan.oid);
    if (!mottagare(db, personal, o, plan) || !far(db, personal, o)) continue;
    const lm = katalog(db, o.lakemedel_id);
    if (!lm || atgardad(db, personal, o, lm)) continue;
    const n = dagarTill(plan.aterinsattning, dag);
    const namn = `${lm.namn} ${lm.styrka}`;
    const nar = narText(n, plan.aterinsattning);
    ut.push({
      ordinationId: o.id, patientId: o.patient_id, lakemedel: namn, aterinsattning: plan.aterinsattning, dagarKvar: n,
      plan: planText({ typ: plan.typ, aterinsattning: plan.aterinsattning }),
      text: `${nar ? `${lm.namn} ska sättas in igen ${nar}` : `${lm.namn} skulle sättas in igen ${plan.aterinsattning}, för ${-n} ${-n === 1 ? 'dag' : 'dagar'} sedan, och är inte insatt`}. Tidigare dosering: ${o.dosering}. Systemet fyller i ordinationen ur den tidigare.`,
      href: `#/patient/${encodeURIComponent(o.patient_id)}/lakemedel/aterinsatt-${o.id}`, orsaker: AVSLUT_ORSAKER,
    });
  }
  return ut;
}

// POST /api/ordination/:id/aterinsattning/avsluta { orsak }. Läkaren avslutar behandlingen för gott, med samma
// behörighet som raden: en läkare som är mottagare och får se patienten, aldrig från en spärrad vårdenhet. Nekade
// försök loggas, och inget sparas.
export function avsluta(db, personal, ordinationId, inp = {}) {
  sakraSchema(db);
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(ordinationId));
  if (!o) throw new Fel(404, 'Ordinationen finns inte.', 'saknas');
  const resurs = `ordination:${o.id}:aterinsattning_avslutad`;
  const logga = (grund, resultat) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: o.patient_id, handling: 'ordinera', resurs, grund, resultat });
  const neka = () => {
    logga('nekad', 'nekad');
    return new Fel(403, 'Du kan inte avsluta behandlingen. Det kan den läkare som ordinerade läkemedlet eller beslutade om uppehållet och läkarna på de vårdenheterna, när de får se patienten.', 'nekad');
  };
  if (!kanRoll(personal, 'ordinera') || !far(db, personal, o)) throw neka();
  const plan = db.query('SELECT * FROM utsattningsplaner WHERE ordination_id = ?').get(o.id);
  if (o.status !== 'utsatt' || plan?.typ !== 'uppehall') throw new Fel(400, 'Läkemedlet gör inget uppehåll som ska sättas in igen.', 'ogiltig');
  if (!mottagare(db, personal, o, plan)) throw neka();
  const lm = katalog(db, o.lakemedel_id);
  if (db.query('SELECT 1 FROM aterinsattning_avslut WHERE ordination_id = ?').get(o.id)) throw new Fel(400, 'Behandlingen är redan avslutad.', 'ogiltig');
  if (lm && atgardad(db, personal, o, lm)) throw new Fel(400, 'Läkemedlet är redan insatt igen.', 'ogiltig');
  const orsak = typeof inp.orsak === 'string' ? inp.orsak.trim().slice(0, 300) : '';
  if (orsak.length < 3) throw new Fel(400, 'Välj eller skriv orsaken till att behandlingen avslutas.', 'ogiltig', { falt: ['orsak'], orsaker: AVSLUT_ORSAKER });
  const tid = iso();
  db.query('INSERT INTO aterinsattning_avslut (ordination_id, patient_id, orsak, av, tid) VALUES (?, ?, ?, ?, ?)').run(o.id, o.patient_id, orsak, personal.id, tid);
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(o.id, tid, personal.id, 'Återinsättningen avslutades', orsak);
  logga(prova(db, { personal, patient: o.patient_id, handling: 'ordinera', resurs: { enhet_id: o.enhet_id, gemensam: true } }).grund, 'tillaten');
  return { ordinationId: o.id, avslutad: avslutFor(db, o.id) };
}
