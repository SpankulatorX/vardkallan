// Sterilgods och material för operationerna (runda 11, r2, Sussa 4.5.1.3 och 4.5.1.4): instrumentgallren från den
// simulerade sterilcentralen, plocklistan, förbrukningen med implantat och förrådet med beställningar.
//
// Systemet är experten:
//   - När operationen planeras bokar systemet instrumentgallren som ingreppet behöver (operation.js RESURSER) och
//     reserverar ett bestämt galler med charge och utgångsdatum från sterilcentralen. På salen öppnas gallret, och
//     systemet stoppar ett galler som har passerat utgångsdatum. Räkningen efter operationen ska stämma med gallrets
//     innehåll innan patienten får lämna salen, och gallret går tillbaka till sterilcentralen när patienten lämnar salen.
//   - Plocklistan räknas ur ingreppet. Förbrukningen registreras med ett klick, implantaten med lot, och implantaten
//     registreras samtidigt i operationen för spårbarheten.
//   - Förrådet på sjukhuset minskar av sig självt, och när en artikel når beställningspunkten beställer systemet från
//     det simulerade förrådet. Leveransen kommer efter ett dygn.
// Sterilcentralen, förrådet, artiklarna och varunumren är simulerade och påhittade demoposter.
import { Fel, addDagar } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { tabell, finns, personNamn, iso, DAG, lasRad, andraRad, kravRoll, enhetKort } from './specialist-hjalp.js';
import * as op from './operation.js';

export const DEMO = 'Sterilcentralen och förrådet är simulerade, och artiklarna är påhittade demoposter.';
export const UTGANG_DAGAR = 30;
const ANDRA = 'Operationen hanteras av den anmälande vårdenheten.';
const andra = (atk, an) => andraRad(atk, an, 'operation_registrera', 'las_operation', ANDRA);

// Artiklarna i operationsförrådet. punkt är beställningspunkten och mangd hur mycket som beställs.
const A = (namn, start, punkt, mangd, extra = {}) => ({ namn, start, punkt, mangd, ...extra });
export const ARTIKLAR = tabell({
  'OP-0001': A('Operationsrock, steril', 60, 15, 60), 'OP-0002': A('Operationshandskar, sterila (par)', 120, 30, 120),
  'OP-0003': A('Kompresser 10 x 10 cm, förpackning med 10', 60, 15, 60), 'OP-0004': A('Sutur, resorberbar', 60, 15, 60),
  'OP-0005': A('Bencement 40 g', 3, 2, 10), 'OP-0006': A('Operationsduk, steril', 40, 10, 40),
  'OP-0007': A('Trokar 10 mm', 30, 10, 30), 'OP-0008': A('Klips för laparoskopi', 20, 5, 20),
  'OP-0101': A('Höftprotes, cementerat skaft (demo)', 4, 1, 4, { implantat: true, tillverkare: 'Demotillverkaren' }),
  'OP-0102': A('Höftprotes, cementerad cup (demo)', 4, 1, 4, { implantat: true, tillverkare: 'Demotillverkaren' }),
  'OP-0111': A('Knäprotes, femurkomponent (demo)', 4, 1, 4, { implantat: true, tillverkare: 'Demotillverkaren' }),
  'OP-0112': A('Knäprotes, tibiakomponent (demo)', 4, 1, 4, { implantat: true, tillverkare: 'Demotillverkaren' }),
});
const GRUND = { 'OP-0001': 4, 'OP-0002': 8, 'OP-0003': 4, 'OP-0004': 3, 'OP-0006': 1 };
const LAP = { 'OP-0001': 3, 'OP-0002': 6, 'OP-0003': 2, 'OP-0004': 2, 'OP-0006': 1, 'OP-0007': 3 };
export const PLOCKLISTOR = tabell({
  NFB49: { ...GRUND, 'OP-0005': 2, 'OP-0101': 1, 'OP-0102': 1 },
  NGB49: { ...GRUND, 'OP-0005': 2, 'OP-0111': 1, 'OP-0112': 1 },
  JKA21: { ...LAP, 'OP-0008': 1 },
  JEA01: { ...LAP },
});
const KORT = { 'hoft-galler': 'HOFT', 'kna-galler': 'KNA', 'lap-galler': 'LAP' };
const datumI = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

// Gallren som är reserverade för operationen. Gallrets nummer är dess plats bland de samtidiga bokningarna av samma slags
// galler på sjukhuset, så att två operationer samtidigt aldrig får samma galler.
function reserverade(db, an) {
  const plan = db.query('SELECT * FROM op_planeringar WHERE anmalan_id = ? AND struken_tid IS NULL ORDER BY id DESC').get(an.id);
  if (!plan) return [];
  return db.query('SELECT * FROM op_resursbokningar WHERE planering_id = ? ORDER BY id').all(plan.id).filter(r => op.RESURSER[r.resurs]?.typ === 'sterilgods').map(r => {
    const samtidiga = db.query(`SELECT r.planering_id FROM op_resursbokningar r JOIN op_planeringar p ON p.id = r.planering_id WHERE r.resurs = ? AND r.sjukhus = ?
      AND p.struken_tid IS NULL AND p.start < ? AND p.slut > ? ORDER BY r.planering_id`).all(r.resurs, r.sjukhus, plan.slut, plan.start).map(x => x.planering_id);
    const n = samtidiga.indexOf(plan.id) + 1;
    const steriliserad = addDagar(datumI(plan.start), -1);
    return { resurs: r.resurs, namn: op.RESURSER[r.resurs].namn, galler: `${r.sjukhus.toUpperCase()}-${KORT[r.resurs] ?? 'GALLER'}-${n}`, instrument: op.RESURSER[r.resurs].instrument,
      charge: `CH-${steriliserad.replaceAll('-', '')}-${n}`, steriliserad, utgang: addDagar(steriliserad, UTGANG_DAGAR), sjukhus: r.sjukhus };
  });
}

export function sterilgods(atk, an, nu = new Date()) {
  lasRad(atk, an, 'las_operation');
  const db = atk.db;
  const rader = db.query('SELECT * FROM op_sterilgods WHERE anmalan_id = ?').all(an.id);
  return {
    galler: reserverade(db, an).map(g => {
      const r = rader.find(x => x.galler === g.galler);
      return { ...g, status: r?.retur_tid ? 'retur' : r?.raknad_tid ? 'raknad' : r ? 'oppnad' : 'reserverad', oppnad: r ? { tid: r.oppnad_tid, av: personNamn(db, r.oppnad_av) } : null,
        raknad: r?.raknad_tid ? { tid: r.raknad_tid, av: personNamn(db, r.raknad_av), instrument: r.instrument } : null, retur: r?.retur_tid ?? null,
        utgangen: g.utgang < datumI(nu) };
    }),
    text: 'Sterilcentralen har reserverat gallren med charge och utgångsdatum. Gallren går tillbaka till sterilcentralen när patienten lämnar salen.', demo: DEMO,
  };
}

const forlopp = (db, an) => db.query('SELECT * FROM op_forlopp WHERE anmalan_id = ?').get(an.id);
function kravPaSal(db, an, text) {
  const f = forlopp(db, an);
  if (!f?.in_sal || f.ut_sal) throw new Fel(409, text, 'ogiltig');
  return f;
}

export function oppna(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  const db = atk.db;
  kravPaSal(db, an, 'Gallret öppnas när patienten har kommit in på salen.');
  const g = reserverade(db, an).find(x => x.galler === body.galler);
  if (!g) throw new Fel(409, 'Gallret är inte reserverat för operationen. Skanna gallret som sterilcentralen har skickat.', 'ogiltig', { falt: ['galler'] });
  if (g.utgang < datumI(nu)) throw new Fel(409, `Gallret ${g.galler} gick ut ${g.utgang}. Använd det inte, och beställ ett nytt från sterilcentralen.`, 'ogiltig');
  if (db.query('SELECT 1 FROM op_sterilgods WHERE anmalan_id = ? AND galler = ?').get(an.id, g.galler)) throw new Fel(409, 'Gallret är redan öppnat.', 'ogiltig');
  db.query(`INSERT INTO op_sterilgods (anmalan_id, patient_id, enhet_id, galler, resurs, charge, steriliserad, utgang, oppnad_tid, oppnad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(an.id, an.patient_id, an.enhet_id, g.galler, g.resurs, g.charge, g.steriliserad, g.utgang, iso(nu), atk.personal.id);
  return { ...sterilgods(atk, an, nu), text: `${g.namn} ${g.galler} med charge ${g.charge} är öppnat.` };
}

// Räkningen efter operationen: antalet instrument ska stämma med gallret, och kompresser och nålar ska vara räknade.
export function rakna(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  const db = atk.db;
  kravPaSal(db, an, 'Instrumenten räknas innan patienten lämnar salen.');
  const r = db.query('SELECT * FROM op_sterilgods WHERE anmalan_id = ? AND galler = ?').get(an.id, typeof body.galler === 'string' ? body.galler : '');
  if (!r) throw new Fel(409, 'Gallret är inte öppnat för operationen.', 'ogiltig', { falt: ['galler'] });
  const ratt = op.RESURSER[r.resurs].instrument;
  const n = Number(body.instrument);
  if (!Number.isInteger(n) || n !== ratt) throw new Fel(400, `Räkningen stämmer inte: ${Number.isFinite(n) ? n : 'inget'} av ${ratt} instrument. Räkna om, och leta efter det som saknas innan patienten lämnar salen.`, 'ogiltig', { falt: ['instrument'] });
  if (body.kompresserOchNalar !== true) throw new Fel(400, 'Bekräfta att kompresser och nålar är räknade och stämmer.', 'ogiltig', { falt: ['kompresserOchNalar'] });
  db.query('UPDATE op_sterilgods SET raknad_tid = ?, raknad_av = ?, instrument = ? WHERE id = ?').run(iso(nu), atk.personal.id, n, r.id);
  return { ...sterilgods(atk, an, nu), text: `Räkningen av ${r.galler} stämmer, ${n} instrument.` };
}

// ---- Material och förråd ------------------------------------------------------------------------------------------------

const sjukhusForAnmalan = (db, an) => {
  const plan = db.query('SELECT sal FROM op_planeringar WHERE anmalan_id = ? AND struken_tid IS NULL ORDER BY id DESC').get(an.id);
  return plan ? op.SAL[plan.sal]?.sjukhus : op.sjukhusFor(db, an.enhet_id);
};
function sakraForrad(db, sjukhus) {
  const ins = db.query('INSERT OR IGNORE INTO op_forrad (enhet_id, artikel, saldo) VALUES (?, ?, ?)');
  for (const [id, a] of Object.entries(ARTIKLAR)) ins.run(sjukhus, id, a.start);
}
const saldo = (db, sjukhus, artikel) => db.query('SELECT saldo FROM op_forrad WHERE enhet_id = ? AND artikel = ?').get(sjukhus, artikel)?.saldo ?? 0;

export function plocklista(atk, an, nu = new Date()) {
  lasRad(atk, an, 'las_operation');
  const db = atk.db;
  const sjukhus = sjukhusForAnmalan(db, an);
  sakraForrad(db, sjukhus);
  const registrerad = db.query('SELECT * FROM op_forbrukning WHERE anmalan_id = ? ORDER BY id').all(an.id);
  return {
    rader: Object.entries(PLOCKLISTOR[an.kva] ?? {}).map(([artikel, antal]) => ({ artikel, namn: ARTIKLAR[artikel].namn, antal, implantat: Boolean(ARTIKLAR[artikel].implantat),
      tillverkare: ARTIKLAR[artikel].tillverkare ?? null, saldo: saldo(db, sjukhus, artikel), racker: saldo(db, sjukhus, artikel) >= antal })),
    forbrukning: registrerad.map(r => ({ artikel: r.artikel, namn: ARTIKLAR[r.artikel]?.namn ?? r.artikel, antal: r.antal, lot: r.lot, tid: r.tid, av: personNamn(db, r.av) })),
    registrerad: registrerad.length > 0, sjukhus, text: 'Plocklistan räknas av systemet ur ingreppet. Förrådet beställer själv det som går under beställningspunkten.', demo: DEMO,
  };
}

// Förbrukningen enligt plocklistan, med lot för varje implantat. Implantaten registreras samtidigt i operationen.
export function forbruka(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  const db = atk.db;
  const f = kravPaSal(db, an, 'Förbrukningen registreras under operationen.');
  if (db.query('SELECT 1 FROM op_forbrukning WHERE anmalan_id = ?').get(an.id)) throw new Fel(409, 'Förbrukningen är redan registrerad för operationen.', 'ogiltig');
  const lotter = body.lotter && typeof body.lotter === 'object' ? body.lotter : {};
  const rader = Object.entries(PLOCKLISTOR[an.kva] ?? {});
  for (const [artikel] of rader) {
    if (!ARTIKLAR[artikel].implantat) continue;
    const lot = Object.hasOwn(lotter, artikel) ? lotter[artikel] : null;
    if (typeof lot !== 'string' || !/^[A-Za-z0-9-]{3,40}$/.test(lot)) throw new Fel(400, `Ange lot- eller serienummer för ${ARTIKLAR[artikel].namn.toLocaleLowerCase('sv')}, 3 till 40 bokstäver, siffror eller bindestreck.`, 'ogiltig', { falt: [`lot:${artikel}`] });
  }
  const sjukhus = sjukhusForAnmalan(db, an);
  sakraForrad(db, sjukhus);
  db.transaction(() => {
    const imp = JSON.parse(f.implantat || '[]');
    for (const [artikel, antal] of rader) {
      const a = ARTIKLAR[artikel];
      const lot = a.implantat ? lotter[artikel] : null;
      db.query('INSERT INTO op_forbrukning (anmalan_id, patient_id, enhet_id, artikel, antal, lot, sjukhus, tid, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(an.id, an.patient_id, an.enhet_id, artikel, antal, lot, sjukhus, iso(nu), atk.personal.id);
      db.query('UPDATE op_forrad SET saldo = max(0, saldo - ?) WHERE enhet_id = ? AND artikel = ?').run(antal, sjukhus, artikel);
      if (a.implantat) imp.push({ artikel: a.namn, tillverkare: a.tillverkare, lot, tid: iso(nu), av: personNamn(db, atk.personal.id) });
      if (saldo(db, sjukhus, artikel) <= a.punkt && !db.query('SELECT 1 FROM op_materialbestallningar WHERE enhet_id = ? AND artikel = ? AND levererad_tid IS NULL').get(sjukhus, artikel)) {
        db.query('INSERT INTO op_materialbestallningar (enhet_id, artikel, antal, bestalld_tid, levereras, orsak) VALUES (?, ?, ?, ?, ?, ?)')
          .run(sjukhus, artikel, a.mangd, iso(nu), iso(nu.getTime() + DAG), `Saldot nådde beställningspunkten ${a.punkt}`);
      }
    }
    db.query('UPDATE op_forlopp SET implantat = ? WHERE anmalan_id = ?').run(JSON.stringify(imp), an.id);
    db.query('INSERT INTO op_historik (anmalan_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(an.id, an.patient_id, an.enhet_id, iso(nu), atk.personal.id, 'forbrukning', `${rader.length} artiklar enligt plocklistan`);
  })();
  return { ...plocklista(atk, an, nu), text: 'Förbrukningen är registrerad, och implantaten finns med lot i operationen.' };
}

// Förrådet på den inloggades sjukhus: saldo och beställningar, utan patienter. Leveranser som har kommit läggs in.
export function forrad(db, personal, nu = new Date()) {
  op.sakra(db);
  kravRoll(personal, 'las_operation', 'Din yrkesroll ser inte operationsförrådet.');
  const sjukhus = op.sjukhusFor(db, vardenhetFor(db, personal.enhet_id));
  if (!sjukhus) throw new Fel(409, 'Din vårdenhet hör inte till ett sjukhus med operationsavdelning.', 'ogiltig');
  sakraForrad(db, sjukhus);
  db.transaction(() => {
    for (const b of db.query('SELECT * FROM op_materialbestallningar WHERE enhet_id = ? AND levererad_tid IS NULL AND levereras <= ?').all(sjukhus, iso(nu))) {
      db.query('UPDATE op_materialbestallningar SET levererad_tid = ? WHERE id = ?').run(b.levereras, b.id);
      db.query('UPDATE op_forrad SET saldo = saldo + ? WHERE enhet_id = ? AND artikel = ?').run(b.antal, sjukhus, b.artikel);
    }
  })();
  return {
    sjukhus: enhetKort(db, sjukhus),
    artiklar: Object.entries(ARTIKLAR).map(([artikel, a]) => { const s = saldo(db, sjukhus, artikel); return { artikel, namn: a.namn, saldo: s, bestallningspunkt: a.punkt, lagt: s <= a.punkt, implantat: Boolean(a.implantat) }; }),
    bestallningar: db.query('SELECT * FROM op_materialbestallningar WHERE enhet_id = ? ORDER BY id DESC LIMIT 30').all(sjukhus)
      .map(b => ({ id: b.id, artikel: b.artikel, namn: ARTIKLAR[b.artikel]?.namn ?? b.artikel, antal: b.antal, bestalld: b.bestalld_tid, levereras: b.levereras, levererad: b.levererad_tid, orsak: b.orsak })),
    text: 'Systemet beställer från förrådet när en artikel når beställningspunkten. Leveransen kommer efter ett dygn.', demo: DEMO,
  };
}

export { finns };
