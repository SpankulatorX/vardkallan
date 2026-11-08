// Seeden för beställning och svar och för kontrollerna (runda 8, r1). Beställningarna görs med modulernas egna
// funktioner, med tider relativt till när sandlådan skapades, så att de ser ut som när personalen beställer.
//   Elin Sandberg (p04), inlagd på avdelning 72: ett svar med kritiskt kalium som väntar på vidimering (utan kreatinin, så
//   att inget nytt eGFR påverkar läkemedelsförslagen), prover att ta nu (B-Blodstatus och P-CRP, två rör) och en
//   beställning på uppdrag som läkaren ska signera. Blodtryck och puls var fjärde timme.
//   Gunnar Åkesson (p01), inlagd på avdelning 72: en vidimerad urinodling utan växt och en makulerad beställning.
// Allt är påhittat och laboratoriet är simulerat.
import { Atkomst } from './atkomst.js';
import * as labb from './labb.js';
import * as kontroller from './kontroller.js';
import { lokalTid, datumAv } from './db.js';

const MIN = 60_000;

export function sakra(db) {
  labb.sakraLabb(db);
  kontroller.sakraKontroller(db);
}

export function seeda(db, { bas = new Date() } = {}) {
  sakra(db);
  const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
  const atk = (roll, pid, handling) => new Atkomst(db, pers(roll), pid, {}, handling);
  const t = (min) => new Date(bas.getTime() + min * MIN);
  if (!db.query("SELECT 1 FROM patienter WHERE id = 'p04'").get() || !pers('lak-kard')) return;

  // Ett svar med kritiskt kalium som väntar på läkarens vidimering.
  const a = labb.bestall(atk('lak-kard', 'p04', 'bestalla_prov'), { analyser: ['kalium', 'natrium'], planerad: t(-175).toISOString(), kvitteraDubbletter: true }, t(-180)).bestallning;
  db.query('UPDATE labb_bestallningar SET demo = ? WHERE id = ?').run(JSON.stringify({ kalium: 6.4, natrium: 138 }), a.id);
  labb.taProv(atk('ssk-kard', 'p04', 'ta_prov'), labb.provRad(db, a.prov[0].id), t(-170));
  labb.forfallnaSvar(db, t(-140));

  // Prover att ta nu: två rör.
  labb.bestall(atk('lak-kard', 'p04', 'bestalla_prov'), { analyser: ['blodstatus', 'crp'], planerad: t(-30).toISOString(), kvitteraDubbletter: true }, t(-40));

  // En beställning på uppdrag som läkaren signerar i inkorgen.
  labb.bestall(atk('ssk-kard', 'p04', 'bestalla_prov_uppdrag'), { analyser: ['glukos'], lakareId: 'lak-kard', planerad: lokalTid(datumAv(new Date(bas.getTime() + 24 * 60 * MIN)), '07:00'), kvitteraDubbletter: true }, t(-20));

  // Blodtryck var fjärde timme från klockan 6 i dag, ordinerat i går kväll.
  const igar = t(-12 * 60);
  const start = lokalTid(datumAv(bas), '06:00');
  kontroller.ordinera(atk('lak-kard', 'p04', 'ordinera_kontroll'), { kontroller: ['blodtryck', 'puls'], frekvens: 'var_4', start: Date.parse(start) < igar.getTime() ? igar.toISOString() : start, dygn: 2 }, igar);

  if (db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get()) {
    // En urinodling utan växt, vidimerad.
    const d = labb.bestall(atk('lak-kard', 'p01', 'bestalla_prov'), { analyser: ['urinodling'], anamnes: 'Sveda vid miktion, ingen feber.', planerad: t(-2 * 24 * 60 - 50).toISOString(), kvitteraDubbletter: true }, t(-2 * 24 * 60 - 60)).bestallning;
    labb.taProv(atk('ssk-kard', 'p01', 'ta_prov'), labb.provRad(db, d.prov[0].id), t(-2 * 24 * 60 - 45));
    labb.forfallnaSvar(db, t(-2 * 24 * 60));
    labb.vidimera(atk('lak-kard', 'p01', 'vidimera_provsvar'), labb.bestallningRad(db, d.id), t(-2 * 24 * 60 + 30));
    // En makulerad beställning.
    const e = labb.bestall(atk('lak-kard', 'p01', 'bestalla_prov'), { analyser: ['crp'], planerad: t(-24 * 60 - 20).toISOString(), kvitteraDubbletter: true }, t(-24 * 60 - 30)).bestallning;
    labb.makulera(atk('lak-kard', 'p01', 'las_prover'), labb.bestallningRad(db, e.id), { orsak: 'Dubbelbeställd, provet togs redan på akutmottagningen.' }, t(-24 * 60 - 25));
  }
}
