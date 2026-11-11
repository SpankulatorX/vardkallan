// Runda 11, r7: vårdtyngd enligt NEMS (Nine Equivalents of nursing Manpower use Score) i intensivvården och uppföljning
// av vårdtyngden per avdelning (Sussa 4.6.1.7).
//
// NEMS har nio poster med fasta poäng (Reis Miranda D, Moreno R, Iapichino G. Nine equivalents of nursing manpower use
// score (NEMS). Intensive Care Med 1997;23:760-5). Svenska Intensivvårdsregistret använder NEMS som mått på vårdtyngd.
// Systemet föreslår själv de poster som går att läsa ur journalen (kopplad monitor och timvisa värden, intravenösa
// läkemedel, andningsstöd, syrgas och vasoaktiva infusioner), skriver varför för varje post, och räknar poängen.
// Sjuksköterskan bekräftar och kryssar i det som bara den som vårdar vet (dialys och särskilda åtgärder). Poängen räknas
// alltid av servern. Registreringen ändras aldrig; en ny registrering samma dygn ersätter den förra i uppföljningen.
// Förslagen är demoregler.
import { Fel, iso, datumAv } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { kravVardande } from './administrering.js';
import * as iva from './iva.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as mt from './medicinteknik.js';
import { kvalitetssakrad } from './mt-klass.js';

export const KALLA = 'Reis Miranda D, Moreno R, Iapichino G. Nine equivalents of nursing manpower use score (NEMS). Intensive Care Med 1997;23:760-5.';
export const DEMOREGEL = 'Förslagen på NEMS-poster är demoregler. Poängen per post följer NEMS.';
export const POSTER = [
  { id: 'basal', text: 'Basal övervakning: vitalparametrar varje timme och regelbunden vätskebalans', poang: 9 },
  { id: 'iv_lakemedel', text: 'Intravenösa läkemedel: bolus eller kontinuerlig infusion, inte vasoaktiva', poang: 6 },
  { id: 'ventilation', text: 'Mekanisk ventilation: invasiv eller icke-invasiv, med eller utan PEEP', poang: 12 },
  { id: 'andningsvard', text: 'Kompletterande andningsvård: spontanandning med syrgas eller i tub, utan mekanisk ventilation', poang: 3 },
  { id: 'vasoaktiv_en', text: 'Ett vasoaktivt läkemedel', poang: 7 },
  { id: 'vasoaktiv_flera', text: 'Flera vasoaktiva läkemedel', poang: 12 },
  { id: 'dialys', text: 'Dialys eller annan njurersättande behandling', poang: 6 },
  { id: 'atgard_iva', text: 'Särskild åtgärd på intensivvårdsavdelningen, till exempel intubation, pacemaker, elkonvertering eller endoskopi', poang: 5 },
  { id: 'atgard_utanfor', text: 'Särskild åtgärd utanför intensivvårdsavdelningen, till exempel operation eller diagnostisk undersökning', poang: 6 },
];
const PER_ID = new Map(POSTER.map(p => [p.id, p]));
// Poster som utesluter varandra: ventilation och kompletterande andningsvård, ett och flera vasoaktiva.
const UTESLUTER = [['ventilation', 'andningsvard'], ['vasoaktiv_en', 'vasoaktiv_flera']];
const DAG = 86400_000;
const TIMME = 3600_000;

export const SCHEMA = `
-- Vårdtyngd enligt NEMS per patient och vårddygn (runda 11, r7, Sussa 4.6.1.7). poster är JSON med de valda posterna,
-- forslag de som systemet föreslog. Raden ändras aldrig. Den senaste för samma patient och dygn gäller.
CREATE TABLE IF NOT EXISTS iva_nems (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, dygn TEXT NOT NULL, poang INTEGER NOT NULL, poster TEXT NOT NULL, forslag TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT NOT NULL, CHECK (poang BETWEEN 0 AND 66)
);
CREATE INDEX IF NOT EXISTS ix_iva_nems_enhet ON iva_nems (enhet_id, dygn);
CREATE TRIGGER IF NOT EXISTS iva_nems_andras_ej BEFORE UPDATE OF enhet_id, dygn, poang, poster, forslag, tid, av ON iva_nems
  BEGIN SELECT RAISE(ABORT, 'En registrering av NEMS ändras inte. Registrera på nytt.'); END;
CREATE TRIGGER IF NOT EXISTS iva_nems_raderas_ej BEFORE DELETE ON iva_nems BEGIN SELECT RAISE(ABORT, 'En registrering av NEMS raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'iva_nems'").get());

// Vårddygnet i svensk tid för en tidpunkt.
export const dygnFor = (nu) => new Date(nu).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
// Poängen för de valda posterna. Okända poster och poster som utesluter varandra ger ett fel på vanlig svenska.
export function poang(poster) {
  if (!Array.isArray(poster) || poster.length > POSTER.length || poster.some(p => typeof p !== 'string' || !PER_ID.has(p))) throw new Fel(400, 'Välj posterna ur listan.', 'ogiltig', { falt: ['poster'] });
  const valda = [...new Set(poster)];
  for (const [a, b] of UTESLUTER) {
    if (valda.includes(a) && valda.includes(b)) throw new Fel(400, `${PER_ID.get(a).text.split(':')[0]} och ${PER_ID.get(b).text.split(':')[0].toLowerCase()} kan inte båda väljas. Välj den som gäller.`, 'ogiltig', { falt: ['poster'] });
  }
  return { valda, poang: valda.reduce((s, p) => s + PER_ID.get(p).poang, 0) };
}

// Systemets förslag ur det användaren får se det senaste dygnet. aktivaStod: andningsstödet som pågår eller pågick under
// dygnet (iva-vatskemal.js). vasoaktiva: antal pågående vasoaktiva infusioner.
export function forslag({ monitor = false, timvisaVarden = 0, ivLakemedel = [], vasoaktiva = [], andningsstod = [], syrgas = false }) {
  const ut = [];
  if (monitor || timvisaVarden >= 6) ut.push({ id: 'basal', varfor: monitor ? 'En patientmonitor är kopplad.' : `${timvisaVarden} vitalparametrar det senaste dygnet.` });
  if (ivLakemedel.length) ut.push({ id: 'iv_lakemedel', varfor: `Intravenöst: ${ivLakemedel.slice(0, 3).join(', ')}.` });
  const vent = andningsstod.find(a => a.typ === 'invasiv' || a.typ === 'niv');
  if (vent) ut.push({ id: 'ventilation', varfor: `${vent.typText} sedan ${new Date(vent.start).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` });
  else if (syrgas || andningsstod.some(a => a.typ === 'hogflode' || a.typ === 'syrgas')) ut.push({ id: 'andningsvard', varfor: andningsstod.find(a => a.typ === 'hogflode') ? 'Högflödesbehandling med syrgas.' : 'Patienten har fått syrgas det senaste dygnet.' });
  if (vasoaktiva.length > 1) ut.push({ id: 'vasoaktiv_flera', varfor: `Vasoaktiva infusioner: ${vasoaktiva.join(', ')}.` });
  else if (vasoaktiva.length === 1) ut.push({ id: 'vasoaktiv_en', varfor: `Vasoaktiv infusion: ${vasoaktiva[0]}.` });
  return ut;
}

const VASOAKTIVA = /^C01C(A|E)/;
// Underlaget för förslaget för en patient, bara ur det användaren får se.
export function underlag(atk, nu = new Date(), andningsstod = []) {
  const db = atk.db;
  const fran = nu.getTime() - DAG;
  const mv = kanRoll(atk.personal, 'las_matvarden') ? journal.synligaMatvarden(new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_matvarden')) : [];
  const dygnets = mv.filter(m => Date.parse(m.tid) > fran && Date.parse(m.tid) <= nu.getTime());
  const monitor = mt.finns(db) && db.query(`SELECT k.enhet_id FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE k.patient_id = ? AND u.typ = 'monitor' AND k.start <= ? AND (k.slut IS NULL OR k.slut > ?)`)
    .all(atk.patientId, nu.toISOString(), new Date(fran).toISOString()).some(k => atk.prova('las_matvarden', { enhet_id: k.enhet_id }).tillaten);
  const ord = kanRoll(atk.personal, 'las_lakemedel') ? lakemedel.synligaOrdinationer(new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_lakemedel')).filter(o => lakemedel.aktuell(o)) : [];
  const katalog = (id) => db.query('SELECT namn, atc FROM katalog WHERE id = ?').get(id) ?? { namn: id, atc: '' };
  const iv = ord.filter(o => /intraven|infusion|\biv\b|i\.v\./i.test(`${o.vag ?? ''} ${o.dosering ?? ''}`) || db.query('SELECT 1 FROM iva_infusioner WHERE ordination_id = ?').get(o.id));
  const vaso = iv.filter(o => VASOAKTIVA.test(katalog(o.lakemedel_id).atc)).map(o => katalog(o.lakemedel_id).namn);
  return {
    monitor, timvisaVarden: dygnets.filter(m => ['puls', 'blodtryck', 'saturation', 'andningsfrekvens'].includes(m.typ) && kvalitetssakrad(m)).length,
    ivLakemedel: iv.filter(o => !VASOAKTIVA.test(katalog(o.lakemedel_id).atc)).map(o => katalog(o.lakemedel_id).namn), vasoaktiva: [...new Set(vaso)],
    andningsstod: andningsstod.filter(a => !a.slut || Date.parse(a.slut) > fran), syrgas: dygnets.some(m => m.typ === 'syrgas' && Number(m.varde_num) > 0),
  };
}

const nemsUt = (db, r) => ({ id: r.id, dygn: r.dygn, poang: r.poang, poster: JSON.parse(r.poster), tid: r.tid, av: db.query('SELECT namn FROM personal WHERE id = ?').get(r.av)?.namn ?? null });
// Registreringarna som användaren får se, nyast först.
export function registreringar(atk) {
  if (!finns(atk.db) || !kanRoll(atk.personal, 'las_matvarden')) return [];
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  return a.filtrera(atk.db.query('SELECT * FROM iva_nems WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId), 'las_matvarden').map(r => nemsUt(atk.db, r));
}

// Intensivvårdsavdelningen där patienten vårdas nu, under användarens vårdenhet, eller null. Registreringen sparas på
// avdelningen, så att uppföljningen per avdelning räknar den.
export function ivaEnhetFor(atk, nu = new Date()) {
  const egna = new Set(iva.ivaEnheter(atk.db, atk.personal).map(e => e.id));
  if (!egna.size) return null;
  const k = atk.db.query(`SELECT enhet_id FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND start <= ? AND enhet_id IN (${[...egna].map(() => '?').join(', ')}) ORDER BY start DESC`)
    .get(atk.patientId, nu.toISOString(), ...egna);
  return k?.enhet_id ?? null;
}

// NEMS för patienten: dagens förslag med poäng, posterna och de senaste registreringarna.
export function vy(atk, nu = new Date(), andningsstod = []) {
  const f = forslag(underlag(atk, nu, andningsstod));
  const regs = registreringar(atk);
  const dygn = dygnFor(nu);
  const idag = regs.find(r => r.dygn === dygn) ?? null;
  return {
    dygn, poster: POSTER, forslag: f, forslagPoang: f.reduce((s, x) => s + PER_ID.get(x.id).poang, 0), idag, senaste: regs[0] ?? null, registreringar: regs.slice(0, 7),
    kan: ['lakare', 'sjukskoterska'].includes(atk.personal.yrke) && kanRoll(atk.personal, 'registrera_matvarde') && Boolean(ivaEnhetFor(atk, nu)), kalla: KALLA, demoregel: DEMOREGEL,
  };
}

// POST /api/patient/:id/iva/nems { poster? }. Utan poster gäller systemets förslag. Sjuksköterskan eller läkaren
// registrerar för vårddygnet, på den egna vårdenheten och med vårdrelation.
export function registrera(atk, body = {}, nu = new Date(), andningsstod = []) {
  if (!['lakare', 'sjukskoterska'].includes(atk.personal?.yrke)) {
    atk.logga('registrera_matvarde', 'nekad', 'iva:nems', 'nekad');
    throw new Fel(403, 'Vårdtyngden registreras av sjuksköterska eller läkare.', 'nekad');
  }
  kravVardande(atk, 'registrera_matvarde', null, 'iva:nems');
  const enhet = ivaEnhetFor(atk, nu);
  if (!enhet) throw new Fel(400, 'Patienten vårdas inte på en intensivvårdsavdelning på din vårdenhet just nu. Vårdtyngden enligt NEMS registreras för patienter på avdelningen.', 'ogiltig');
  const f = forslag(underlag(atk, nu, andningsstod));
  const { valda, poang: p } = poang(body.poster == null ? f.map(x => x.id) : body.poster);
  const dygn = dygnFor(nu);
  const id = Number(atk.db.query('INSERT INTO iva_nems (patient_id, enhet_id, dygn, poang, poster, forslag, tid, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, enhet, dygn, p, JSON.stringify(valda), JSON.stringify(f.map(x => x.id)), nu.toISOString(), atk.personal.id).lastInsertRowid);
  atk.logga('registrera_matvarde', atk.grund(), `iva:nems:${id}`);
  const avvikande = [...valda.filter(x => !f.some(y => y.id === x)), ...f.filter(y => !valda.includes(y.id)).map(y => y.id)];
  return { registrering: nemsUt(atk.db, atk.db.query('SELECT * FROM iva_nems WHERE id = ?').get(id)),
    text: `NEMS ${p} poäng är registrerat för ${dygn}.${avvikande.length ? ' Registreringen skiljer sig från systemets förslag, och det syns i uppföljningen.' : ''}` };
}

// Uppföljningen per avdelning: andel vårddygn med NEMS, medelvärde och summa och fördelningen per post. Bara antal,
// inga personuppgifter. dagar är periodens längd bakåt från nu.
export function uppfoljning(db, enhetId, { fran, till }) {
  if (!finns(db)) return null;
  const f = dygnFor(fran), t = dygnFor(till);
  const rader = db.query('SELECT * FROM iva_nems WHERE enhet_id = ? AND dygn >= ? AND dygn <= ? ORDER BY tid, id').all(enhetId, f, t);
  // Den senaste registreringen per patient och dygn gäller.
  const per = new Map();
  for (const r of rader) per.set(`${r.patient_id}|${r.dygn}`, r);
  const giltiga = [...per.values()];
  const summa = giltiga.reduce((s, r) => s + r.poang, 0);
  const posterAntal = POSTER.map(p => ({ id: p.id, text: p.text, antal: giltiga.filter(r => JSON.parse(r.poster).includes(p.id)).length }));
  const avvikande = giltiga.filter(r => JSON.stringify([...JSON.parse(r.poster)].sort()) !== JSON.stringify([...JSON.parse(r.forslag)].sort())).length;
  return {
    vardygnMedNems: giltiga.length, medel: giltiga.length ? Math.round(summa / giltiga.length * 10) / 10 : null, summa, poster: posterAntal, avvikerFranForslag: avvikande,
    text: 'Vårdtyngd enligt NEMS: medelpoäng per registrerat vårddygn. Högst 66 poäng.',
  };
}
// Lägger NEMS till uppföljningen från iva.uppfoljning, med andelen vårddygn med registrerad NEMS.
export function medNems(db, u) {
  for (const e of u.enheter ?? []) {
    const n = uppfoljning(db, e.enhet.id, { fran: Date.parse(u.fran), till: Date.parse(u.till) });
    if (!n) continue;
    const dygn = Math.ceil(e.vardygn);
    // Kvalitetsindikatorn: andelen vårddygn med registrerad vårdtyngd.
    e.vardtyngd.nems = { ...n, andelRegistreradeProcent: dygn ? Math.round(Math.min(n.vardygnMedNems, dygn) / dygn * 1000) / 10 : null, vardygn: dygn };
  }
  return u;
}

export { iso, datumAv, vardenhetFor, TIMME, iva };
