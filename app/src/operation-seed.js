// Seeden för operationsplaneringen och anestesin (runda 11, r2). Allt görs med modulernas egna funktioner, på fasta
// klockslag räknade från seedens dag, så att samma seed ger samma operationer oavsett när sandlådan skapas.
//
//   Margareta Forsberg (p07), inlagd på Ortopediska kliniken Karlskoga lasarett med höftfraktur, opererades akut dagen
//   efter: anmälan, anestesibedömning, hela förloppet med anestesijournal, checklista, sterilgods, förbrukning med
//   implantat, uppvakning och överrapportering.
//   Fem påhittade patienter på samma vårdenhet (p71 till p75): två planerade i dag i sal 1 i Karlskoga, en planerad i morgon och två
//   på väntelistan, varav en efter målet för väntetiden.
import { addDagar, datumAv, lokalTid } from './db.js';
import { Atkomst } from './atkomst.js';
import * as op from './operation.js';
import * as aj from './anestesijournal.js';
import * as sg from './sterilgods.js';

// Patienterna finns i patientseeden (seed/patienter.js, operationspatienter).
export const PATIENTER = [
  { id: 'p71', kva: 'NFB49', sida: 'hoger', anmald: -50, plan: [0, '07:30'] },
  { id: 'p72', kva: 'NGB49', sida: 'vanster', anmald: -45, plan: [0, '10:00'] },
  { id: 'p73', kva: 'NGB49', sida: 'hoger', anmald: -30, plan: [1, '07:30'] },
  { id: 'p74', kva: 'NFB49', sida: 'vanster', anmald: -40 },
  { id: 'p75', kva: 'NGB49', sida: 'hoger', anmald: -100 },
];

export function seeda(db, bas) {
  op.sakra(db);
  if (db.query('SELECT 1 FROM op_anmalningar LIMIT 1').get()) return;
  const dag = datumAv(bas);
  const t = (d, k) => new Date(lokalTid(addDagar(dag, d), k));
  const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
  const A = (roll, pid, h) => new Atkomst(db, pers(roll), pid, {}, h);
  const iva = require('./iva.js');

  // Margareta Forsberg: akut höftplastik dagen efter inläggningen (vårdkontakten började dag -6 klockan 18.20).
  if (db.query("SELECT 1 FROM patienter WHERE id = 'p07'").get() && db.query("SELECT 1 FROM vardkontakter WHERE patient_id = 'p07' AND enhet_id = 'kkoga-ort'").get()) {
    const a = op.anmal(A('lak-kkoga', 'p07', 'operation_anmala'), { kva: 'NFB49', sida: 'vanster', prioritet: 'akut', kommentar: 'Kollumfraktur vänster.' }, t(-6, '19:30'));
    const rad = () => op.anmalanRad(db, a.id);
    const p = db.query("SELECT * FROM patienter WHERE id = 'p07'").get();
    iva.sparaAnestesi(A('lak-ane-kkoga', 'p07', 'anestesibedomning'), p, { anmalanId: a.id, asa: 3, akut: true, anestesiform: 'regional', samtycke: 'ja', ponvTidigare: false, luftvag: { mallampati: 2 } }, t(-6, '20:15'));
    op.planera(A('opk-kkoga', 'p07', 'operation_planera'), rad(), { sal: 'kkoga-sal-1', start: lokalTid(addDagar(dag, -5), '08:00') }, t(-6, '20:30'));
    const s = A('ssk-kkoga', 'p07', 'operation_registrera');
    const v = (m) => new Date(t(-5, '08:00').getTime() + m * 60_000);
    op.registrera(s, rad(), { handelse: 'in_sal', armband: p.personnummer }, v(-5));
    const galler = sg.sterilgods(A('ssk-kkoga', 'p07', 'las_operation'), rad(), v(-4)).galler;
    for (const g of galler) sg.oppna(s, rad(), { galler: g.galler }, v(-3));
    const alla = (del) => Object.keys(op.CHECKLISTA[del].punkter);
    op.checklista(s, rad(), { del: 'fore_anestesi', bekraftade: alla('fore_anestesi') }, v(0));
    aj.registreraLakemedel(s, rad(), { lakemedel: 'bupivakain', dos: 10 }, v(4));
    aj.registreraHandelse(s, rad(), { handelse: 'spinal' }, v(5));
    // Operatören bekräftar ASA-klassen, så att seeden inte beror på klockan (anestesienhetens vårdrelation följer dagen).
    op.bekraftaAsa(A('lak-kkoga', 'p07', 'anestesibedomning'), rad(), {}, v(-2));
    op.registrera(s, rad(), { handelse: 'anestesistart' }, v(5));
    aj.registreraLakemedel(s, rad(), { lakemedel: 'kloxacillin' }, v(10));
    aj.registreraLakemedel(s, rad(), { lakemedel: 'tranexamsyra' }, v(12));
    aj.registreraVatska(s, rad(), { slag: 'ringer', volym: 1000 }, v(15));
    op.checklista(s, rad(), { del: 'fore_snitt', bekraftade: alla('fore_snitt') }, v(20));
    op.registrera(s, rad(), { handelse: 'knivtid' }, v(25));
    sg.forbruka(s, rad(), { lotter: { 'OP-0101': 'LOT-DEMO-2611-07', 'OP-0102': 'LOT-DEMO-2611-08' } }, v(70));
    aj.registreraLakemedel(s, rad(), { lakemedel: 'efedrin' }, v(80));
    aj.registreraVatska(s, rad(), { slag: 'blodning', volym: 450 }, v(118));
    aj.registreraVatska(s, rad(), { slag: 'urin', volym: 250 }, v(119));
    op.registrera(s, rad(), { handelse: 'op_slut' }, v(120));
    for (const g of galler) sg.rakna(s, rad(), { galler: g.galler, instrument: op.RESURSER[g.resurs].instrument, kompresserOchNalar: true }, v(122));
    op.checklista(s, rad(), { del: 'fore_utflyttning', bekraftade: alla('fore_utflyttning') }, v(125));
    op.registrera(s, rad(), { handelse: 'ut_sal' }, v(130));
    op.kontroll(s, rad(), { varden: { medvetande: 'A', saturation: 95, andningsfrekvens: 16, puls: 84, blodtryck: '124/72', smarta: 3, temp: 36.6 } }, v(175));
    op.skrivUt(s, rad(), {}, v(180));
  }

  // Patienterna på väntelistan: anmälan, anestesibedömning och planering för de som ska opereras i dag och i morgon.
  for (const x of PATIENTER) {
    if (!db.query("SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id = 'kkoga-ort'").get(x.id)) continue;
    const a = op.anmal(A('lak-kkoga', x.id, 'operation_anmala'), { kva: x.kva, sida: x.sida }, t(x.anmald, '09:30'));
    if (!x.plan) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(x.id);
    iva.sparaAnestesi(A('lak-ane-kkoga', x.id, 'anestesibedomning'), p, { anmalanId: a.id, asa: 2, anestesiform: 'regional', samtycke: 'ja', luftvag: { mallampati: 1 } }, t(x.anmald + 7, '11:00'));
    op.planera(A('opk-kkoga', x.id, 'operation_planera'), op.anmalanRad(db, a.id), { sal: 'kkoga-sal-1', start: lokalTid(addDagar(dag, x.plan[0]), x.plan[1]) }, t(-3, '14:00'));
    // ASA-klassen är bekräftad tidigt på operationsdagen för dagens operationer.
    if (x.plan[0] === 0) op.bekraftaAsa(A('lak-kkoga', x.id, 'anestesibedomning'), op.anmalanRad(db, a.id), {}, t(0, '06:30'));
    // Runda 13, r4: dagens operationer har kommit så långt som klockan har hunnit när sandlådan skapas. På kvällen är
    // de genomförda och patienterna tillbaka på avdelningen, mitt på dagen pågår de, och på natten väntar de.
    if (x.plan[0] === 0) genomforTill(db, A, x.id, a.id, new Date(lokalTid(addDagar(dag, 0), x.plan[1])), bas);
  }
}

// Runda 13, r4: en planerad operations förlopp med samma steg som Margareta Forsbergs, fram till klockan bas. Varje steg
// görs med modulens egna funktioner och den tid steget skulle ha gjorts på en vanlig dag.
function genomforTill(db, A, pid, anmalanId, start, bas) {
  const rad = () => op.anmalanRad(db, anmalanId);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
  const s = A('ssk-kkoga', pid, 'operation_registrera');
  const v = (m) => new Date(start.getTime() + m * 60_000);
  const alla = (del) => Object.keys(op.CHECKLISTA[del].punkter);
  let galler = [];
  const steg = [
    [-5, (t) => op.registrera(s, rad(), { handelse: 'in_sal', armband: p.personnummer }, t)],
    [-4, (t) => { galler = sg.sterilgods(A('ssk-kkoga', pid, 'las_operation'), rad(), t).galler; for (const g of galler) sg.oppna(s, rad(), { galler: g.galler }, t); }],
    [0, (t) => op.checklista(s, rad(), { del: 'fore_anestesi', bekraftade: alla('fore_anestesi') }, t)],
    [4, (t) => aj.registreraLakemedel(s, rad(), { lakemedel: 'bupivakain', dos: 10 }, t)],
    [5, (t) => { aj.registreraHandelse(s, rad(), { handelse: 'spinal' }, t); op.registrera(s, rad(), { handelse: 'anestesistart' }, t); }],
    [10, (t) => aj.registreraLakemedel(s, rad(), { lakemedel: 'kloxacillin' }, t)],
    [15, (t) => aj.registreraVatska(s, rad(), { slag: 'ringer', volym: 1000 }, t)],
    [20, (t) => op.checklista(s, rad(), { del: 'fore_snitt', bekraftade: alla('fore_snitt') }, t)],
    [25, (t) => op.registrera(s, rad(), { handelse: 'knivtid' }, t)],
    [70, (t) => {
      const lotter = rad().kva === 'NGB49' ? { 'OP-0111': `LOT-DEMO-${pid}-1`, 'OP-0112': `LOT-DEMO-${pid}-2` } : { 'OP-0101': `LOT-DEMO-${pid}-1`, 'OP-0102': `LOT-DEMO-${pid}-2` };
      sg.forbruka(s, rad(), { lotter }, t);
    }],
    [95, (t) => aj.registreraVatska(s, rad(), { slag: 'blodning', volym: 300 }, t)],
    [100, (t) => op.registrera(s, rad(), { handelse: 'op_slut' }, t)],
    [102, (t) => { for (const g of galler) sg.rakna(s, rad(), { galler: g.galler, instrument: op.RESURSER[g.resurs].instrument, kompresserOchNalar: true }, t); }],
    [105, (t) => op.checklista(s, rad(), { del: 'fore_utflyttning', bekraftade: alla('fore_utflyttning') }, t)],
    [110, (t) => op.registrera(s, rad(), { handelse: 'ut_sal' }, t)],
    [150, (t) => op.kontroll(s, rad(), { varden: { medvetande: 'A', saturation: 96, andningsfrekvens: 14, puls: 78, blodtryck: '132/76', smarta: 2, temp: 36.7 } }, t)],
    [155, (t) => op.skrivUt(s, rad(), {}, t)],
  ];
  for (const [m, gor] of steg) {
    if (v(m).getTime() > bas.getTime() - 60_000) break;
    gor(v(m));
  }
}
