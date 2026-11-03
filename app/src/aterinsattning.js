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
//
// Behörighet. Inkorgen visar bara patienter som läkaren får se, prövat i behörighetsmotorn utan aktiva val, och aldrig en
// ordination från en vårdenhet som patienten har spärrat. En ny ordination räknas bara om läkaren får se den, så att en
// återinsättning på en spärrad vårdenhet inte röjs genom att raden försvinner.
import { idag, addDagar } from './db.js';
import { prova, kanRoll, vardenhetFor } from './atkomst.js';
import { planText } from './lakemedelsregler.js';

const DAG = 86400_000;
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
  const dag = idag();
  const ut = [];
  const planer = db.query(`SELECT p.*, o.id AS oid FROM utsattningsplaner p JOIN ordinationer o ON o.id = p.ordination_id
    WHERE p.typ = 'uppehall' AND o.status = 'utsatt' AND p.aterinsattning <= ? ORDER BY p.aterinsattning, o.id`).all(addDagar(dag, 1));
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
      href: `#/patient/${encodeURIComponent(o.patient_id)}/lakemedel/aterinsatt-${o.id}`,
    });
  }
  return ut;
}
