// Demons cytostatika (runda 11, r4). Läggs in i mallen för demon (db.js mallen), inte i byggSeed, så att testerna som
// bygger sin egen sandlåda inte påverkas. Inga nya patienter: behandlingarna ges till två av seedens patienter på
// Kardiologiska kliniken, där demorollerna Sara Lindqvist och Johan Ek arbetar. Allt görs med modulernas egna
// funktioner och med tider räknade från när mallen byggs, så att kurerna och provsvaren alltid är aktuella.
//   - Annika Holmgren (p17), inlagd på avdelning 72, har EC. Cykel 1 är given för tre veckor sedan, och cykel 2 är
//     planerad i dag med provsvar som tillåter kuren, så att läkaren kan godkänna den och beredningsenheten bereda den.
//   - Anna Viklund (p11) har kapecitabin, som överlämnades för tre dagar sedan. Hon kan logga in i Min journal och
//     rapportera hur hon tar tabletterna och mår.
// Göran Malm har föreslagit en ny version av karboplatinregimen, som väntar på en regimansvarig läkare.
// Blodbeställningar läggs inte in i mallen, eftersom en sådan också blir en ordination i läkemedelslistan. Blod beställs
// i demon från fliken Blod.
import { datumAv, addDagar } from './db.js';
import { Atkomst } from './atkomst.js';
import * as cyto from './cytostatika.js';
import * as bered from './cytostatika-beredning.js';
import * as blod from './blod.js';

const MIN = 60_000, TIMME = 60 * MIN, DAG = 24 * TIMME;

// Den pågående eller senaste vårdkontakten på kardiologen, som mätvärdena knyts till.
const kontakt = (db, pid, nu) => db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id LIKE 'uso-kard%' AND coalesce(planerad, 0) = 0 AND start <= ? ORDER BY start DESC").get(pid, nu.toISOString());
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const atk = (db, roll, pid, h) => new Atkomst(db, pers(db, roll), pid, {}, h);
const d = (ms) => new Date(ms);

// En hel kur från godkännande till given: beredning på beredningsenheten, mottagning, premedicinering,
// dubbelkontroll och infusion eller överlämnande.
function geKur(db, pid, pnr, cykelId, t0) {
  cyto.godkann(atk(db, 'lak-kard', pid, 'ordinera_cytostatika'), cyto.cykelRad(db, cykelId), d(t0));
  const order = cyto.beredningsorder(atk(db, 'lak-kard', pid, 'las_cytostatika'), cyto.cykelRad(db, cykelId));
  let t = t0 + 60 * MIN;
  for (const o of order.doser) {
    const rad = bered.arbetslista(db, pers(db, 'far-bered'), d(t)).attBereda.flatMap(x => x.doser).find(x => x.dosId === o.id);
    bered.bered(db, pers(db, 'far-bered'), o.id, o.peroral ? {} : { batch: rad.forslag[0].batch, uppmattMl: o.volymLakemedel }, d(t += 5 * MIN));
  }
  t += 60 * MIN;
  const ssk = () => atk(db, 'ssk-kard', pid, 'ge_cytostatika');
  for (const o of order.doser) if (!o.peroral) cyto.taEmot(ssk(), cyto.dosRad(db, o.id), { streckkod: o.etikett }, d(t += MIN));
  for (const p of db.query('SELECT id FROM cyto_premed WHERE cykel_id = ?').all(cykelId)) cyto.gePremed(ssk(), cyto.premedRad(db, p.id), { armband: pnr }, d(t += MIN));
  t += 30 * MIN;
  for (const o of order.doser) {
    const las = { armband: pnr, streckkod: o.etikett };
    cyto.iordningstall(ssk(), cyto.dosRad(db, o.id), las, d(t += MIN));
    cyto.kontrollera(atk(db, 'lak-kard', pid, 'ge_cytostatika'), cyto.dosRad(db, o.id), las, d(t += MIN));
    if (o.peroral) cyto.ge(ssk(), cyto.dosRad(db, o.id), d(t += MIN));
    else {
      cyto.startaInfusion(ssk(), cyto.dosRad(db, o.id), d(t += MIN));
      cyto.avslutaInfusion(ssk(), cyto.dosRad(db, o.id), d(t += (o.infusionMinuter + 2) * MIN));
    }
  }
}

export function seeda(db, nu = new Date()) {
  cyto.sakra(db); bered.sakra(db); blod.sakra(db);
  if (db.query('SELECT 1 FROM cyto_behandlingar LIMIT 1').get()) return;
  const n = nu.getTime();
  const idag = datumAv(nu);
  const pnr = (pid) => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;
  const mv = (pid, typ, varde, t) => {
    const v = kontakt(db, pid, nu);
    db.query("INSERT INTO matvarden (patient_id, enhet_id, vardkontakt_id, typ, varde, varde_num, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, 'ssk-kard')")
      .run(pid, v.enhet_id, v.id, typ, String(varde), varde, new Date(t).toISOString());
  };
  // Lagret byggs från för fyra veckor sedan, så att en batch har gått ut i dag.
  bered.lager(db, pers(db, 'far-bered'), d(n - 28 * DAG));

  // Annika Holmgren, EC.
  mv('p17', 'langd', 166, n - 23 * DAG);
  mv('p17', 'vikt', 65, n - 22 * DAG - 2 * TIMME);
  mv('p17', 'lpk', 6.1, n - 22 * DAG); mv('p17', 'tpk', 254, n - 22 * DAG);
  const b1 = cyto.ordinera(atk(db, 'lak-kard', 'p17', 'ordinera_cytostatika'), { regim: 'ec', start: addDagar(idag, -21) }, d(n - 22 * DAG + TIMME));
  geKur(db, 'p17', pnr('p17'), b1.kurer[0].id, n - 21 * DAG - 12 * TIMME);
  mv('p17', 'vikt', 63, n - 2 * DAG);
  cyto.nastaCykel(atk(db, 'lak-kard', 'p17', 'ordinera_cytostatika'), cyto.behandlingRad(db, b1.id), d(n - 2 * DAG + TIMME));
  mv('p17', 'lpk', 4.4, n - 3 * TIMME); mv('p17', 'tpk', 182, n - 3 * TIMME);

  // Anna Viklund, kapecitabin, överlämnat för tre dagar sedan, med hennes egna rapporter.
  mv('p11', 'langd', 168, n - 5 * DAG); mv('p11', 'vikt', 61, n - 5 * DAG);
  mv('p11', 'lpk', 7.2, n - 4 * DAG - 2 * TIMME); mv('p11', 'tpk', 301, n - 4 * DAG - 2 * TIMME);
  const b2 = cyto.ordinera(atk(db, 'lak-kard', 'p11', 'ordinera_cytostatika'), { regim: 'kapecitabin', start: addDagar(idag, -3) }, d(n - 4 * DAG - TIMME));
  geKur(db, 'p11', pnr('p11'), b2.kurer[0].id, n - 3 * DAG - 6 * TIMME);
  const dos = db.query("SELECT id, enhet_id FROM cyto_doser WHERE patient_id = 'p11'").get();
  for (const [dag, diarre] of [[-3, 0], [-2, 1], [-1, 2]]) {
    db.query("INSERT INTO cyto_patientrapporter (dos_id, patient_id, enhet_id, datum, tid, invanare_id, morgon, kvall, feber, diarre, illamaende, handfot, bedomning) VALUES (?, 'p11', ?, ?, ?, 'inv-p11', 1, 1, NULL, ?, 0, 0, 'ok')")
      .run(dos.id, dos.enhet_id, addDagar(idag, dag), new Date(n + dag * DAG + 10 * TIMME).toISOString(), diarre);
  }

  // Göran Malm föreslår en längre infusionstid och betametason för karboplatin.
  cyto.foreslaVersion(db, pers(db, 'ol-kard'), 'karboplatin', { minuter: { karboplatin: 60 }, premedicinering: ['ondansetron', 'betametason'], motivering: 'Färre överkänslighetsreaktioner med längre infusionstid och kortison.' }, d(n - 2 * DAG));
}

// POST /api/demo/cytostatika-kur: i den egna sandlådan godkänner Sara Lindqvist Annika Holmgrens planerade kur, så att
// beredningsenheten har en kur att bereda i användartestet och klickbudgeten. Mallens behandlingar läggs in om de saknas.
export function godkannDemoKur(db, nu = new Date()) {
  seeda(db, nu);
  const c = db.query("SELECT * FROM cyto_cykler WHERE patient_id = 'p17' AND status = 'planerad' ORDER BY id DESC").get();
  if (c) cyto.godkann(atk(db, 'lak-kard', 'p17', 'ordinera_cytostatika'), cyto.cykelRad(db, c.id), nu);
  return { ok: true, text: 'Annika Holmgrens kur är godkänd och väntar på beredning.' };
}
