// Rapportering till Graviditetsregistret (runda 11, r3, Sussa 4.7.1.2 och 4.7.1.4). Mottagaren är simulerad: inget
// skickas på riktigt. På samma sätt som rapporteringen till Svenska barnhälsovårdsregistret (bhvq.js) sammanställer
// systemet själv det som är nytt sedan förra utskicket från vårdenheten: inskrivningen och efterkontrollen från
// mödrahälsovården och förlossningen från förlossningsavdelningen. Varje post kontrolleras före utskicket, och varje fel
// förklaras på vanlig svenska med en länk till det som behöver rättas. En post med fel hålls kvar tills felet är rättat.
//
// Undantag som systemet räknar själv och redovisar som antal:
//   motsatt    patienten har motsatt sig registreringen (patientdatalagen 7 kap. 2 §)
//   skyddad    patienten har skyddade personuppgifter (demoregel: rapporteras inte, vårdgivaren beslutar)
// Svaren på frågorna om våld lämnas aldrig ut, bara om frågorna är ställda. Utskicket sparar bara vilka poster som
// skickades, inga personuppgifter, och varje patient som rapporteras loggas som ett utlämnande.
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn } from './atkomst.js';
import * as obs from './obstetrik.js';
import { andraRad } from './specialist-hjalp.js';

export const MOTTAGARE = 'Graviditetsregistret (simulerad mottagare)';
export const DEMOREGEL = 'Demoregel: patienter med skyddade personuppgifter rapporteras inte till registret. Det är vårdgivarens beslut, inte en regel i patientdatalagen.';
const lasJson = (s, standard) => { try { return JSON.parse(s) ?? standard; } catch { return standard; } };

function kravRapportor(db, personal) {
  if (!kanRoll(personal, 'rapportera_graviditetsregistret')) throw new Fel(403, 'Din yrkesroll rapporterar inte till Graviditetsregistret.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  if (![...obs.MHV_VARDENHETER, ...obs.FORLOSSNING_VARDENHETER].includes(ve)) throw new Fel(403, 'Rapporteringen görs av mödrahälsovården och förlossningen.', 'nekad');
  return ve;
}
const skickadeFor = (db, ve) => new Set(db.query('SELECT innehall FROM graviditetsregister_utskick WHERE enhet_id = ?').all(ve).flatMap(u => lasJson(u.innehall, {}).skickade ?? []));

// Posterna som är nya sedan förra utskicket, med kontrollen före utskicket.
function poster(db, personal, valFor, nu) {
  const ve = kravRapportor(db, personal);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const skickade = skickadeFor(db, ve);
  const hsa = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(ve)?.hsa_id ?? null;
  const kandidater = [
    ...db.query(`SELECT s.id, s.graviditet_id, s.patient_id, s.enhet_id, s.tid FROM graviditet_samtal s WHERE s.enhet_id IN (${ph}) AND s.id = (SELECT max(id) FROM graviditet_samtal x WHERE x.graviditet_id = s.graviditet_id)`).all(...enheter)
      .map(r => ({ typ: 'inskrivning', nyckel: `inskrivning:${r.graviditet_id}`, rad: r, g: obs.graviditetRad(db, r.graviditet_id) })),
    ...db.query(`SELECT * FROM forlossningar WHERE enhet_id IN (${ph}) AND status = 'avslutad'`).all(...enheter)
      .map(r => ({ typ: 'forlossning', nyckel: `forlossning:${r.id}`, rad: r, g: obs.graviditetRad(db, r.graviditet_id) })),
    ...db.query(`SELECT * FROM graviditet_efterkontroll WHERE enhet_id IN (${ph})`).all(...enheter)
      .map(r => ({ typ: 'efterkontroll', nyckel: `efterkontroll:${r.id}`, rad: r, g: obs.graviditetRad(db, r.graviditet_id) })),
  ].filter(k => !skickade.has(k.nyckel));
  const undantagna = { motsatt: 0, skyddad: 0 };
  const ut = [];
  for (const k of kandidater) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(k.rad.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_graviditet');
    if (!atk.prova('las_graviditet', { enhet_id: k.rad.enhet_id }).tillaten) continue;
    if (k.g.register_motsatt) { undantagna.motsatt++; continue; }
    if (p.skyddad) { undantagna.skyddad++; continue; }
    const fel = [];
    const lank = (flik = 'graviditet') => `#/patient/${encodeURIComponent(p.id)}/${flik}`;
    if ((p.id_typ ?? 'personnummer') !== 'personnummer') fel.push({ text: 'Patienten har inget personnummer. Registret tar bara emot personnummer.', href: lank('identitet') });
    const post = { typ: k.typ, person: p.personnummer, vardenhet: hsa };
    if (k.typ === 'inskrivning') {
      const s = db.query('SELECT * FROM graviditet_samtal WHERE id = ?').get(k.rad.id);
      const risk = obs.riskbedomning(atk, k.g, nu);
      if (risk.bmi == null) fel.push({ text: 'Längd och vikt vid inskrivningen saknas. Registret behöver BMI.', href: lank('matvarden') });
      const tob = lasJson(s.tobak, {});
      Object.assign(post, { inskrivningsvecka: Math.floor(obs.dagarFor(k.g, s.tid.slice(0, 10)) / 7), paritet: k.g.paritet, antalFoster: k.g.antal_foster, ivf: Boolean(k.g.ivf_overforing),
        bmi: risk.bmi, rokning: tob.rokning ?? null, snus: tob.snus ?? null, valdfraganStalld: Boolean(s.vald_stalld) });
    } else if (k.typ === 'forlossning') {
      const barn = db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(k.rad.id);
      const smart = db.query('SELECT DISTINCT metod FROM smartlindring WHERE forlossning_id = ?').all(k.rad.id).map(r => r.metod);
      if (!smart.length) fel.push({ text: 'Smärtlindringen är inte registrerad. Registrera vad som gavs, eller Ingen smärtlindring.', href: `#/forlossning/${encodeURIComponent(p.id)}` });
      const bp = barn.map(b => db.query('SELECT personnummer, id_typ FROM patienter WHERE id = ?').get(b.barn_patient_id));
      if (bp.some(x => x.id_typ !== 'personnummer')) fel.push({ text: 'Barnets personnummer har inte kommit från Skatteverket. Skicka födelseanmälan.', href: `#/forlossning/${encodeURIComponent(p.id)}` });
      Object.assign(post, { graviditetsvecka: barn[0] ? Math.floor(barn[0].dagar / 7) : null, smartlindring: smart,
        ctgPatologiskt: Boolean(db.query("SELECT 1 FROM ctg_bedomning WHERE forlossning_id = ? AND klass = 'patologiskt'").get(k.rad.id)),
        barn: barn.map((b, i) => ({ ordning: b.ordning, person: bp[i]?.personnummer ?? null, satt: b.satt, vikt: b.vikt, apgar: lasJson(b.apgar, []) })) });
    } else {
      Object.assign(post, { epds: k.rad.epds, epdsFraga10: k.rad.epds_fraga10, amning: k.rad.amning });
    }
    ut.push({ nyckel: k.nyckel, typ: k.typ, patient: { id: p.id, namn: visningsnamn(p) }, fel, post });
  }
  return { ve, ut, undantagna };
}

const TYPTEXT = { inskrivning: 'inskrivningar', forlossning: 'förlossningar', efterkontroll: 'efterkontroller' };
export function sammanstall(db, personal, valFor = () => ({}), nu = new Date()) {
  obs.sakra(db);
  const { ve, ut, undantagna } = poster(db, personal, valFor, nu);
  const klara = ut.filter(x => !x.fel.length);
  const senast = db.query('SELECT * FROM graviditetsregister_utskick WHERE enhet_id = ? ORDER BY id DESC').get(ve);
  const perTyp = Object.keys(TYPTEXT).map(t => ({ typ: t, text: TYPTEXT[t], antal: klara.filter(x => x.typ === t).length }));
  return {
    mottagare: MOTTAGARE, enhet: { id: ve, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn }, sedan: senast?.tid ?? null, forraKvittens: senast?.kvittens ?? null,
    poster: ut, perTyp, undantagna, antal: { klara: klara.length, medFel: ut.length - klara.length },
    text: ut.length ? `${klara.length} ${klara.length === 1 ? 'post' : 'poster'} kan skickas.${ut.length > klara.length ? ' Poster med fel hålls kvar tills felet är rättat.' : ''}` : 'Det finns inget nytt att rapportera sedan förra utskicket.',
    demoregel: DEMOREGEL,
  };
}

export function skicka(db, personal, valFor = () => ({}), nu = new Date()) {
  obs.sakra(db);
  const { ve, ut } = poster(db, personal, valFor, nu);
  const klara = ut.filter(x => !x.fel.length);
  if (!klara.length) throw new Fel(400, ut.length ? 'Alla nya poster har fel som behöver rättas först.' : 'Det finns inget nytt att rapportera.', 'ogiltig');
  const n = db.query('SELECT count(*) AS n FROM graviditetsregister_utskick').get().n + 1;
  const kvittens = `GR-SIM-${String(n).padStart(6, '0')}`;
  const r = db.query('INSERT INTO graviditetsregister_utskick (tid, enhet_id, av, antal, undantagna, kvittens, innehall) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(iso(nu), ve, personal.id, klara.length, 0, kvittens, JSON.stringify({ skickade: klara.map(x => x.nyckel) }));
  for (const x of klara) new Atkomst(db, personal, x.patient.id, valFor(x.patient.id), 'rapportera_graviditetsregistret').logga('rapportera_graviditetsregistret', 'vardrelation', `graviditetsregistret:utskick:${r.lastInsertRowid}`);
  return [201, { id: Number(r.lastInsertRowid), kvittens, mottagare: MOTTAGARE, antal: klara.length, kvarMedFel: ut.length - klara.length,
    text: `Skickat till ${MOTTAGARE}. Kvittens ${kvittens}: ${klara.length} ${klara.length === 1 ? 'post' : 'poster'}.${ut.length > klara.length ? ` ${ut.length - klara.length} med fel är kvar.` : ''}` }];
}

export function utskick(db, personal) {
  obs.sakra(db);
  const ve = kravRapportor(db, personal);
  return db.query('SELECT * FROM graviditetsregister_utskick WHERE enhet_id = ? ORDER BY id DESC').all(ve).map(u => ({ id: u.id, tid: u.tid, kvittens: u.kvittens, antal: u.antal,
    av: db.query('SELECT namn FROM personal WHERE id = ?').get(u.av)?.namn ?? null }));
}

// Patienten motsätter sig registreringen. Det registreras av den vårdenhet som för graviditetsjournalen.
export function motsatt(atk, g, body = {}) {
  andraRad(atk, g, 'graviditet', 'las_graviditet', 'Det registreras av den vårdenhet som för graviditetsjournalen.');
  const m = body.motsatt === true;
  atk.db.query('UPDATE graviditeter SET register_motsatt = ? WHERE id = ?').run(m ? 1 : 0, g.id);
  return { registerMotsatt: m, text: m ? 'Patienten har motsatt sig registreringen. Graviditeten rapporteras inte till Graviditetsregistret.' : 'Graviditeten rapporteras till Graviditetsregistret.' };
}
