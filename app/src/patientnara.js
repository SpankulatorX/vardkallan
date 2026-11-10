// Patientnära analyser (runda 11, r6, Sussa 4.4.2.14). Läkaren beställer en patientnära analys som andra prover, och
// den som tar provet bockar av kapillärprovet. Instrumentet på avdelningen mäter provet och skickar svaret genom det
// öppna gränssnittet för producentsystem (produktionssystem.js) som en DiagnosticReport med etikettens id, så att svaret
// hamnar på rätt patient och beställning utan att någon skriver in värdet. Svaret blir ett mätvärde med samma kod som
// laboratoriets, och en kontroll av samma mätvärde på avdelningen bockas av.
//
// Systemet är experten: instrumentet identifierar provet med etiketten, som knyter det till patienten och beställningen,
// och Vårdkällan prövar att etiketten hör till en beställning från instrumentets laboratorium och att provet är taget.
// Ett värde som skrivs in för hand behövs inte.
//
// Instrumentet är simulerat. Demoknappen går genom samma funktion som det öppna gränssnittet (taEmotSvar).
import { Fel } from './db.js';
import * as labb from './labb.js';
import * as ps from './produktionssystem.js';
import { ANALYS, LAB, SVARSVARDEN } from './labb-katalog.js';
import { MATKOD } from './kodverk.js';

export const INSTRUMENT = Object.freeze({ id: 'SIM-POC-01', namn: 'Patientnära instrument på avdelningen (simulerat)', lab: 'lab-pn-uso' });
export const SIMULERAT = 'Instrumentet är simulerat. Svaret går genom samma gränssnitt och kontroller som från ett riktigt instrument.';

// Instrumentets svar för ett prov: värdena som det simulerade instrumentet mäter, som en DiagnosticReport med etiketten
// som specimen och instrumentet som performer.
export function svarFor(db, prov, nu = new Date()) {
  const analyser = db.query("SELECT * FROM labb_analyser WHERE prov_id = ? AND status = 'skickad' ORDER BY id").all(prov.id);
  return analyser.map(a => {
    const def = ANALYS[a.analys];
    const b = labb.bestallningRad(db, a.bestallning_id);
    const s = labb.simuleratSvar(db, b, a);
    const obs = s.varden.map((v, i) => ({ resourceType: 'Observation', id: `v${i + 1}`, status: 'final', code: { coding: MATKOD[v.typ].coding.map(c => ({ ...c })) }, valueQuantity: { value: v.varde, unit: v.enhet ?? undefined }, effectiveDateTime: nu.toISOString() }));
    return { resourceType: 'DiagnosticReport', status: 'final', basedOn: [{ reference: `ServiceRequest/labb-${a.id}` }], code: { text: def.namn },
      specimen: [{ identifier: { value: prov.etikett } }], performer: [{ identifier: { value: INSTRUMENT.id }, display: INSTRUMENT.namn }], contained: obs, result: obs.map(o => ({ reference: `#${o.id}` })) };
  });
}

// Demoknappen: instrumentet mäter provet och skickar svaret. Den som tar provet får mäta på sin vårdenhet.
export function mat(atk, prov, nu = new Date()) {
  const db = atk.db;
  const b = labb.bestallningRad(db, prov.bestallning_id);
  atk.krav('ta_prov', { resurs: { enhet_id: b.enhet_id } });
  if (!LAB[prov.lab_id]?.instrument) throw new Fel(400, 'Provet analyseras på laboratoriet, inte i instrumentet på avdelningen.', 'ogiltig');
  if (!prov.provtagen_tid) throw new Fel(409, 'Ta provet först. Instrumentet läser etiketten på provet.', 'ogiltig');
  const svar = svarFor(db, prov, nu);
  if (!svar.length) throw new Fel(409, 'Instrumentet har redan mätt provet.', 'ogiltig');
  const texter = svar.map(dr => ps.taEmotSvar(db, prov.lab_id, dr, nu).text);
  return { bestallning: labb.bestallningUt(db, labb.bestallningRad(db, b.id), atk.personal, nu), text: `Instrumentet har mätt provet. ${texter.join(' ')}`, simulerat: SIMULERAT };
}
export { SVARSVARDEN };
