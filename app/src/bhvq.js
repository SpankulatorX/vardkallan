// Rapportering till Svenska barnhälsovårdsregistret (BHVQ), runda 7, r6. Mottagaren är simulerad: inget skickas på
// riktigt. Systemet sammanställer själv det som har registrerats sedan förra utskicket (tillväxt, besök och
// vaccinationsuppgifter enligt bilaga K11), kontrollerar varje barn mot reglerna före utskicket och förklarar varje fel
// på vanlig svenska med en länk till det som behöver rättas. Barn med fel hålls kvar tills felet är rättat.
//
// Undantag som systemet räknar själv och redovisar som antal:
//   motsatt    barnet eller vårdnadshavaren har motsatt sig registreringen (patientdatalagen 7 kap. 2 §)
//   skyddad    barnet har skyddade personuppgifter (demoregel: rapporteras inte, vårdgivaren beslutar)
// Uppgifterna lämnas bara från den egna vårdenheten, som är lokalt personuppgiftsansvarig för utlämnandet (K11,
// Informationsklassning).
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import { K11 } from './kodverk.js';
import * as T from './tillvaxt.js';
import * as P from './bhv-program.js';
import { arbetarIBhv } from './bhv.js';

export const MOTTAGARE = 'Svenska barnhälsovårdsregistret (simulerad mottagare)';
export const DEMOREGEL = 'Demoregel: barn med skyddade personuppgifter rapporteras inte till registret. Det är vårdgivarens beslut, inte en regel i patientdatalagen.';
// Försiktig demoregel: barn med skyddade personuppgifter rapporteras inte. Den ska bli en parameter på
// konfigurationssidan för demoregler när en sådan finns; tills dess är den en konstant här.
export const UNDANTA_SKYDDAD = true;
const TABELLER = ['matvarden', 'tillvaxt_uppgifter', 'bhv_besok', 'vaccinationer'];

const ttmmdd = (tid) => tid.slice(0, 10).replaceAll('-', '');
const format = (v, d) => Number(v).toFixed(d).replace('.', ',');
const kodat = (kod, text, oid = K11.oid.snomed) => ({ code: kod, codeSystem: oid, displayName: text });
const namn = (p) => (p.skyddad ? 'Skyddad identitet' : `${p.fornamn} ${p.efternamn}`);

// Det som redan har skickats: den högsta raden per tabell i det senaste utskicket från vårdenheten.
function senast(db, ve) {
  const u = db.query('SELECT * FROM bhvq_utskick WHERE enhet_id = ? ORDER BY id DESC LIMIT 1').get(ve);
  return u ? { ...Object.fromEntries(TABELLER.map(t => [t, 0])), ...JSON.parse(u.innehall).sista, tid: u.tid, kvittens: u.kvittens } : { ...Object.fromEntries(TABELLER.map(t => [t, 0])), tid: null, kvittens: null };
}

// Rapporten för ett barn: K11:s klasser Person, Organisation, Tillväxt, Besök och Vaccination, och felen.
function forBarn(db, p, ve, sista) {
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const nya = (t, extra = '') => db.query(`SELECT * FROM ${t} WHERE patient_id = ? AND enhet_id IN (${ph}) AND id > ? ${extra} ORDER BY id`).all(p.id, ...enheter, sista[t]);
  const fel = [];
  const href = (flik) => `#/patient/${encodeURIComponent(p.id)}/${flik}`;
  if ((p.id_typ ?? 'personnummer') !== 'personnummer') {
    fel.push({ text: `Barnet har ${p.id_typ === 'samordningsnummer' ? 'samordningsnummer' : 'inget personnummer'}. Registret tar bara emot personnummer. Rapportera när personnumret är registrerat.`, href: href('identitet') });
  }
  const hsa = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(ve)?.hsa_id;
  const tillvaxt = [];
  const obs = (nyckel, varde, tid, radId) => {
    const k = K11.tillvaxt[nyckel];
    if (!(varde > 0) || varde > k.max) fel.push({ text: `${k.text[0].toUpperCase()}${k.text.slice(1)} ${format(varde, k.decimaler)} ${k.enhet} går inte att rapportera i registrets format ${k.format}.`, href: href('tillvaxt') });
    if (tid.slice(0, 10) < p.fodd || Date.parse(tid) > Date.now() + 5 * 60_000) fel.push({ text: `Datumet för ${k.text} ${tid.slice(0, 10)} ligger ${tid.slice(0, 10) < p.fodd ? 'före födelsen' : 'i framtiden'}.`, href: href('tillvaxt') });
    tillvaxt.push({ typ: kodat(k.kod, k.text), tid: ttmmdd(tid), varde: { value: format(varde, k.decimaler), unit: k.enhet }, rad: radId });
  };
  for (const u of nya('tillvaxt_uppgifter')) if (K11.tillvaxt[u.typ]) obs(u.typ, u.varde, u.tid, `tillvaxt_uppgifter:${u.id}`);
  for (const m of nya('matvarden', "AND typ IN ('vikt', 'langd', 'huvudomfang')")) {
    const v = m.varde_num ?? Number(m.varde);
    obs(m.typ, v, m.tid, `matvarden:${m.id}`);
    // Ett värde som är orimligt för barnets ålder är oftast skrivet i fel enhet.
    const z = T.zVarde(m.typ, p.kon, T.alderManader(p.fodd, m.tid), v);
    if (z != null && Math.abs(z) > 5) fel.push({ text: `${T.MATT[m.typ].namn} ${T.tal(v, m.typ === 'vikt' ? 3 : 1)} ${T.MATT[m.typ].enhet} den ${m.tid.slice(0, 10)} är orimligt för barnets ålder. Kontrollera att det är rätt enhet.`, href: href('tillvaxt') });
  }
  // Födelsevikten och graviditetslängden behövs för registrets beräkningar (demoregel).
  const alla = db.query('SELECT typ FROM tillvaxt_uppgifter WHERE patient_id = ?').all(p.id).map(r => r.typ);
  if (!alla.includes('fodelsevikt')) fel.push({ text: 'Födelsevikten saknas.', href: href('tillvaxt') });
  if (!alla.includes('graviditetslangd')) fel.push({ text: 'Graviditetslängden saknas.', href: href('tillvaxt') });
  const besok = nya('bhv_besok', "AND status = 'genomfort'").map(b => {
    const d = P.besokRad(b.besok_id);
    const pers = db.query('SELECT yrke FROM personal WHERE id = ?').get(b.registrerad_av);
    const bef = pers?.yrke === 'lakare' ? K11.befattning.allmanlakare : K11.befattning.sjukskoterska;
    const typ = d?.hem ? K11.besok.hem : K11.besok.mottagning;
    return { typ: kodat(typ.kod, typ.text, K11.oid.kontakttyp), tid: ttmmdd(b.tid), ...(d?.hem ? {} : { personal: { befattning: kodat(bef.kod, bef.text, K11.oid.befattning) } }), rad: `bhv_besok:${b.id}` };
  });
  const vaccination = [];
  const risk = db.query("SELECT * FROM tillvaxt_uppgifter WHERE patient_id = ? AND typ = 'tb_risk' AND id > ? ORDER BY registrerad DESC, id DESC").get(p.id, sista.tillvaxt_uppgifter);
  if (risk?.varde === 1) vaccination.push({ typ: kodat(K11.vaccination.risk.typ.kod, K11.vaccination.risk.typ.text), varde: kodat(K11.vaccination.risk.varde.kod, K11.vaccination.risk.varde.text), tid: ttmmdd(risk.tid), rad: `tillvaxt_uppgifter:${risk.id}` });
  for (const v of nya('vaccinationer', "AND vaccin_id = 'bcg'")) {
    vaccination.push({ typ: kodat(K11.vaccination.bcg.typ.kod, K11.vaccination.bcg.typ.text), varde: kodat(K11.vaccination.bcg.varde.kod, K11.vaccination.bcg.varde.text), tid: ttmmdd(v.tid), rad: `vaccinationer:${v.id}` });
  }
  const antal = tillvaxt.length + besok.length + vaccination.length;
  return {
    patient: { id: p.id, namn: namn(p) }, antal, fel,
    post: { person: { id: { root: K11.oid.personnummer, extension: p.personnummer } }, organisation: { id: { root: 'HSA-id', extension: hsa } }, tillvaxt, besok, vaccination },
  };
}

// Förhandsgranskningen: vad som skulle skickas, vilka barn som har fel och vilka som är undantagna.
export function sammanstall(db, personal, valFor = () => ({})) {
  if (!kanRoll(personal, 'rapportera_bhvq')) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
  if (!arbetarIBhv(db, personal)) throw new Fel(403, 'Du har inget uppdrag på barnavårdscentralen. Rapporteringen görs av läkare och sjuksköterskor med uppdrag där.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const sista = senast(db, ve);
  const undantagna = { motsatt: 0, skyddad: 0 };
  const barn = [];
  for (const p of db.query('SELECT p.*, i.bhvq_motsatt FROM bhv_inskrivning i JOIN patienter p ON p.id = i.patient_id WHERE i.enhet_id = ? AND p.sammanslagen_till IS NULL ORDER BY p.id').all(ve)) {
    if (p.bhvq_motsatt) { undantagna.motsatt++; continue; }
    if (p.skyddad && UNDANTA_SKYDDAD) { undantagna.skyddad++; continue; }
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_matvarden');
    if (!atk.prova('las_matvarden').tillaten) continue;
    const r = forBarn(db, p, ve, sista);
    if (r.antal || r.fel.length) barn.push(r);
  }
  const klara = barn.filter(b => !b.fel.length && b.antal);
  return {
    mottagare: MOTTAGARE, enhet: { id: ve, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn },
    sedan: sista.tid, forraKvittens: sista.kvittens, barn, undantagna,
    antal: { barn: klara.length, observationer: klara.reduce((s, b) => s + b.antal, 0), medFel: barn.filter(b => b.fel.length).length },
    text: barn.length ? `${klara.length} ${klara.length === 1 ? 'barn' : 'barn'} med ${klara.reduce((s, b) => s + b.antal, 0)} nya uppgifter kan skickas.${barn.some(b => b.fel.length) ? ' Barn med fel hålls kvar tills felet är rättat.' : ''}` : 'Det finns inget nytt att rapportera sedan förra utskicket.',
    demoregel: DEMOREGEL,
  };
}

// Utskicket till den simulerade mottagaren. Varje barn som rapporteras loggas på barnet, som ett utlämnande.
export function skicka(db, personal, valFor = () => ({})) {
  const s = sammanstall(db, personal, valFor);
  const klara = s.barn.filter(b => !b.fel.length && b.antal);
  if (!klara.length) throw new Fel(400, s.barn.length ? 'Alla barn med nya uppgifter har fel som behöver rättas först.' : 'Det finns inget nytt att rapportera.', 'ogiltig');
  const ve = s.enhet.id;
  const sista = senast(db, ve);
  for (const t of TABELLER) {
    for (const b of klara) {
      const ids = [...b.post.tillvaxt, ...b.post.besok, ...b.post.vaccination].map(x => x.rad).filter(r => r.startsWith(`${t}:`)).map(r => Number(r.split(':')[1]));
      if (ids.length) sista[t] = Math.max(sista[t], ...ids);
    }
  }
  const kvittens = `BHVQ-SIM-${String(db.query('SELECT count(*) AS n FROM bhvq_utskick').get().n + 1).padStart(6, '0')}`;
  const poster = klara.map(b => ({ ...b.post, tillvaxt: b.post.tillvaxt.map(({ rad, ...x }) => x), besok: b.post.besok.map(({ rad, ...x }) => x), vaccination: b.post.vaccination.map(({ rad, ...x }) => x) }));
  const tid = iso();
  const r = db.query('INSERT INTO bhvq_utskick (tid, enhet_id, av, antal_barn, antal_observationer, undantagna, kvittens, innehall) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(tid, ve, personal.id, klara.length, s.antal.observationer, s.undantagna.motsatt + s.undantagna.skyddad, kvittens, JSON.stringify({ sista: Object.fromEntries(TABELLER.map(t => [t, sista[t]])), poster }));
  for (const b of klara) new Atkomst(db, personal, b.patient.id, valFor(b.patient.id), 'rapportera_bhvq').logga('rapportera_bhvq', 'vardrelation', `bhvq:utskick:${r.lastInsertRowid}`);
  return [201, { id: Number(r.lastInsertRowid), tid, kvittens, mottagare: MOTTAGARE, antalBarn: klara.length, antalObservationer: s.antal.observationer, kvarMedFel: s.antal.medFel,
    text: `Skickat till ${MOTTAGARE}. Kvittens ${kvittens}: ${klara.length} barn och ${s.antal.observationer} uppgifter.${s.antal.medFel ? ` ${s.antal.medFel} barn med fel är kvar.` : ''}` }];
}

// Utskicken från vårdenheten, utan patientuppgifter.
export function utskick(db, personal) {
  if (!kanRoll(personal, 'rapportera_bhvq')) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM bhvq_utskick WHERE enhet_id = ? ORDER BY id DESC').all(ve).map(u => ({ id: u.id, tid: u.tid, kvittens: u.kvittens, antalBarn: u.antal_barn, antalObservationer: u.antal_observationer, undantagna: u.undantagna,
    av: db.query('SELECT namn FROM personal WHERE id = ?').get(u.av)?.namn ?? null }));
}
