// Demodata för graviditet, förlossning och BB (runda 11, r3), som läggs in i den egna sandlådan med
// POST /api/demo/obstetrik, på samma sätt som Sussas testdata. Fyra påhittade kvinnor med Skatteverkets testpersonnummer,
// listade på Vårdcentralen Tybble, där mödrahälsovården finns i demon: en graviditet i vecka 30 med inskrivningssamtal,
// ultraljud och besök, en ny graviditet utan inskrivningssamtal, en pågående förlossning med partogram, CTG och
// smärtlindring på förlossningen, USÖ, och en tvillingmor med barnen på BB. Allt räknas från seedens tid, så att seeden
// ser likadan ut oavsett när den byggs. Uppgifterna registreras med modulernas egna funktioner, som personalen hade gjort.
import { Atkomst } from './atkomst.js';
import { addDagar, datumAv } from './db.js';
import * as obs from './obstetrik.js';
import * as forl from './forlossning.js';
import testpnr from './seed/testpersonnummer.json' with { type: 'json' };

export const SEED_PATIENTER = [
  { id: 'obs1', fornamn: 'Linnea', efternamn: 'Åkerlund', ar: 1994 },
  { id: 'obs2', fornamn: 'Johanna', efternamn: 'Rask', ar: 1998 },
  { id: 'obs3', fornamn: 'Amanda', efternamn: 'Lindholm', ar: 1990 },
  { id: 'obs4', fornamn: 'Nora', efternamn: 'Sjölin', ar: 1989 },
];
const MIN = 60_000, TIMME = 60 * MIN;

function ledigtPnr(db, ar) {
  const anvanda = new Set([...db.query('SELECT personnummer FROM patienter').all().map(r => r.personnummer), ...db.query('SELECT varde FROM identiteter').all().map(r => r.varde)]);
  const pnr = testpnr.filter(p => !anvanda.has(p) && Number(p[10]) % 2 === 0)
    .sort((a, b) => Math.abs(Number(a.slice(0, 4)) - ar) - Math.abs(Number(b.slice(0, 4)) - ar) || a.localeCompare(b))[0];
  if (!pnr) throw new Error('Inget ledigt testpersonnummer för seeden');
  return pnr;
}

export function seeda(db, bas = new Date()) {
  obs.sakra(db);
  if (db.query("SELECT 1 FROM patienter WHERE id = 'obs1'").get()) return { laddad: false };
  const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
  const vid = (ms) => new Date(bas.getTime() + ms);
  const idag = datumAv(bas);
  for (const p of SEED_PATIENTER) {
    const pnr = ledigtPnr(db, p.ar);
    const fodd = `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}`;
    db.query("INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, skyddad, id_typ) VALUES (?, ?, ?, ?, 'kvinna', ?, 0, 'personnummer')").run(p.id, pnr, p.fornamn, p.efternamn, fodd);
    db.query("INSERT INTO identiteter (patient_id, typ, varde, status, fran, av, ursprung) VALUES (?, 'personnummer', ?, 'gallande', ?, NULL, ?)").run(p.id, pnr, '2020-01-01T00:00:00.000Z', p.id);
    db.query('INSERT INTO listningar (patient_id, enhet_id, fran) VALUES (?, ?, ?)').run(p.id, 'vc-tybble', '2020-01-01');
  }
  const mvc = (pid, h = 'graviditet') => new Atkomst(db, pers('ssk-vc'), pid, {}, h);
  const bm = (pid, h = 'graviditet') => new Atkomst(db, pers('bm-uso'), pid, { andra_enheter: true }, h);
  const rad = (id) => obs.graviditetRad(db, id);
  const SAMTAL = { tobak: { rokning: 'slutat_under', snus: 'aldrig' }, vald: { ensam: true, svar: { tidigare: 'nej', nu: 'nej', radd: 'nej' } } };
  const mv = (pid, typ, varde, tid) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(pid, 'vc-tybble', typ, String(varde), varde, tid.toISOString(), 'ssk-vc');

  // 1. Linnea Åkerlund i vecka 30: inskrivning i vecka 8, rutinultraljud i vecka 18 och besök i vecka 25 och 28.
  const veckor = 30 * 7 + 2;
  const sm = addDagar(idag, -veckor);
  const v = (vecka) => vid((vecka * 7 - veckor) * 24 * TIMME);
  mv('obs1', 'langd', 167, v(8)); mv('obs1', 'vikt', 64, v(8));
  const g1 = obs.registrera(mvc('obs1'), { sistaMens: sm, paritet: 1 }, v(8));
  obs.samtal(mvc('obs1'), rad(g1.id), { ...SAMTAL, onskemal: { text: 'Vill gärna ha sin sambo med hela tiden och pröva bad först.', smartlindring: ['bad', 'lustgas'] } }, v(8));
  obs.ultraljud(mvc('obs1'), rad(g1.id), { typ: 'rutin', datum: datumAv(v(18)), veckor: 18, dagar: 2, placenta: 'framvagg', fostervatten: 'normalt' }, v(18));
  obs.besok(mvc('obs1'), rad(g1.id), { blodtryck: '112/70', vikt: 70, sfMatt: 24, fosterljud: 145 }, v(25));
  obs.besok(mvc('obs1'), rad(g1.id), { blodtryck: '118/74', vikt: 72, sfMatt: 28, fosterljud: 140 }, v(28));

  // 2. Johanna Rask i vecka 9, inskriven men utan inskrivningssamtal: systemet påminner.
  obs.registrera(mvc('obs2'), { sistaMens: addDagar(idag, -63) }, vid(-2 * 24 * TIMME));

  // 3. Amanda Lindholm i vecka 40 i aktiv förlossning sedan fyra timmar, med CTG och lustgas.
  const g3 = obs.registrera(mvc('obs3'), { sistaMens: addDagar(idag, -(40 * 7 + 1)), paritet: 0 }, vid(-35 * 7 * 24 * TIMME));
  obs.samtal(mvc('obs3'), rad(g3.id), { ...SAMTAL, onskemal: { text: 'Önskar EDA om det blir långdraget.', smartlindring: ['lustgas', 'eda'] } }, vid(-35 * 7 * 24 * TIMME));
  const start = vid(-4 * TIMME);
  db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('obs3', 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen, rum 4', 'Förlossning')").run(start.toISOString());
  db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('obs3', 'uso-kk-forl', 'tpk', '231', 231, ?, 'bm-uso')").run(vid(-3.8 * TIMME).toISOString());
  const f3 = obs.startaForlossning(bm('obs3'), rad(g3.id), { oppning: 4, fosterljud: 138, varkor: 3 }, start);
  forl.ctgKoppla(bm('obs3'), obs.forlossningRad(db, f3.id), { forlopp: 'normal' }, start);
  for (const [h, o] of [[3, 5], [2, 6], [1, 7]]) obs.partogram(bm('obs3'), obs.forlossningRad(db, f3.id), { oppning: o, fosterljud: 140, varkor: 4, tid: vid(-h * TIMME).toISOString() }, vid(-h * TIMME));
  for (const m of [200, 170, 140, 110, 80, 50, 20]) forl.ctgBedomning(bm('obs3'), obs.forlossningRad(db, f3.id), {}, vid(-m * MIN));
  forl.smartlindring(bm('obs3'), obs.forlossningRad(db, f3.id), { metod: 'lustgas' }, vid(-2.5 * TIMME));

  // 4. Nora Sjölin fick tvillingar för 20 timmar sedan och är på BB med barnen. Det första barnet har personnummer.
  const g4 = obs.registrera(mvc('obs4'), { sistaMens: addDagar(idag, -(37 * 7 + 3)), antalFoster: 2, paritet: 1 }, vid(-30 * 7 * 24 * TIMME));
  obs.samtal(mvc('obs4'), rad(g4.id), SAMTAL, vid(-30 * 7 * 24 * TIMME));
  const s4 = vid(-27 * TIMME);
  db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('obs4', 'uso-kk-forl', 'slutenvard', ?, 'BB, rum 12', 'Förlossning')").run(s4.toISOString());
  const f4 = obs.startaForlossning(bm('obs4'), rad(g4.id), { oppning: 4, fosterljud: 142, varkor: 3 }, s4);
  obs.partogram(bm('obs4'), obs.forlossningRad(db, f4.id), { oppning: 8, tid: vid(-23 * TIMME).toISOString() }, vid(-23 * TIMME));
  db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('obs4', 'uso-kk-forl', 'tpk', '198', 198, ?, 'bm-uso')").run(vid(-26 * TIMME).toISOString());
  forl.smartlindring(bm('obs4'), obs.forlossningRad(db, f4.id), { metod: 'eda' }, vid(-24 * TIMME));
  obs.fodelse(bm('obs4'), obs.forlossningRad(db, f4.id), { kon: 'kvinna', vikt: 2780, langd: 47, huvudomfang: 33, apgar: [8, 9, 10] }, vid(-20 * TIMME));
  const b2 = obs.fodelse(bm('obs4'), obs.forlossningRad(db, f4.id), { kon: 'man', vikt: 2610, langd: 46, huvudomfang: 32.5, apgar: [7, 9, 10] }, vid(-20 * TIMME + 14 * MIN));
  forl.fodelseanmalan(bm('obs4'), obs.forlossningRad(db, f4.id), { ordning: 1 }, vid(-19 * TIMME));
  const barn = db.query('SELECT barn_patient_id FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f4.id).map(r => r.barn_patient_id);
  forl.bbKontroll(bm('obs4'), { temp: 37.1, puls: 82, blodtryck: '121/76', blodning: 'normal', livmoder: 'fast', urinerat: true, amning: 'stod' }, vid(-14 * TIMME));
  forl.bbKontroll(bm(barn[0]), { vikt: 2690, temp: 36.8, andning: 'ua', hudfarg: 'normal', maltider: 7 }, vid(-6 * TIMME));
  forl.bbKontroll(bm(barn[1]), { vikt: 2470, temp: 36.7, andning: 'ua', hudfarg: 'gulaktig', maltider: 9 }, vid(-6 * TIMME));
  for (const pid of barn) forl.bbScreening(bm(pid), { typ: 'kvitamin' }, vid(-19.5 * TIMME));
  forl.bbScreening(bm(barn[0]), { typ: 'pulsoximetri' }, vid(-12 * TIMME));
  return { laddad: true, barn, andraBarnet: b2.barnId };
}
