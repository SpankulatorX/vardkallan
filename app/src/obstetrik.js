// Mödrahälsovård, graviditet och förlossning (runda 9, r3, Sussa 4.7): graviditetsjournalen med beräknad partus,
// besöksprogram per graviditetsvecka, provschema, riskbedömning och flerbörd, förlossningsjournalen med partogram,
// registreringen av barnet med egen identitet kopplad till modern och födelseuppgifterna till barnhälsovården, och
// planeringen och uppföljningen per vårdenhet.
//
// Systemet är experten:
//   - Barnmorskan anger sista mens och, när det finns, ultraljudets graviditetslängd. Systemet räknar beräknad partus (BPD)
//     och väljer ultraljudet när det skiljer mer än sju dagar, och räknar graviditetsveckan vid varje besök.
//   - Besöksprogrammet och provschemat räknas fram ur graviditetsveckan, risken och antalet foster. Systemet visar nästa
//     besök och vilka prover som ska tas, och beställer dem med beställningen till laboratoriet (labb.js).
//   - Riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, bland det som
//     den inloggade får se, och förklaras på vanlig svenska.
//   - Vid besöket varnar systemet för förhöjt blodtryck, protein i urinen och ett symfys-fundusmått som avviker.
//   - I partogrammet räknar systemet varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt eller när
//     fosterljuden avviker.
//   - Vid födelsen skapar systemet barnets journal med ett reservnummer, kopplar barnet till modern och för vidare
//     graviditetslängd, födelsevikt, längd och huvudomfång till barnhälsovården.
//
// Programmet, riskfaktorerna och gränserna är demoregler och inget kliniskt beslutsstöd.
import { Fel, datumAv, addDagar, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder, alder } from './atkomst.js';
import * as identitet from './identitet.js';
import * as labb from './labb.js';
import { ANALYS } from './labb-katalog.js';
import { tolkaBlodgrupp } from './blod.js';
import { tabell, finns, personNamn, enhetKort, iso, DAG, TIMME, kravRoll, vardkontaktFor, matvarde, lasRad, andraRad } from './specialist-hjalp.js';
// Säkerhetsgranskningen: varje graviditet och förlossning binds till patienten och prövas på sin vårdenhet.
const andraGrav = (atk, g) => andraRad(atk, g, 'graviditet', 'las_graviditet', 'Graviditetsjournalen förs av den vårdenhet som skrev in graviditeten.');
const andraForl = (atk, f) => andraRad(atk, f, 'graviditet', 'las_graviditet', 'Förlossningsjournalen förs av förlossningens vårdenhet.');

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Programmet och gränserna är förenklade.';
export const GRAVIDITETSDAGAR = 280;

// Besöksprogrammet i graviditetsveckor (basprogram, förenklat). Flerbörd och hög risk lägger till besök.
export const PROGRAM = [
  { vecka: 8, typ: 'Inskrivning hos barnmorska', prover: ['blodstatus', 'blodgruppering', 'bastest', 'urinodling'] },
  { vecka: 12, typ: 'Besök hos barnmorska' },
  { vecka: 18, typ: 'Rutinultraljud' },
  { vecka: 25, typ: 'Besök hos barnmorska', prover: ['blodstatus'] },
  { vecka: 28, typ: 'Besök hos barnmorska', prover: ['glukos', 'bastest'] },
  { vecka: 31, typ: 'Besök hos barnmorska' }, { vecka: 33, typ: 'Besök hos barnmorska' },
  { vecka: 35, typ: 'Besök hos barnmorska', prover: ['blodstatus'] },
  { vecka: 37, typ: 'Besök hos barnmorska' }, { vecka: 39, typ: 'Besök hos barnmorska' }, { vecka: 40, typ: 'Besök hos barnmorska' },
  { vecka: 41, typ: 'Läkarbesök vid passerad beräknad partus' },
];
export const FLERBORD_PROGRAM = [24, 28, 32, 36].map(vecka => ({ vecka, typ: 'Tillväxtultraljud och läkarbesök (flerbörd)' }));
export const RISK_PROGRAM = [{ vecka: 12, typ: 'Läkarbesök (förhöjd risk)' }, { vecka: 32, typ: 'Läkarbesök (förhöjd risk)' }];
export const RISKNIVA = tabell({ normal: 'Normal risk', forhojd: 'Förhöjd risk', hog: 'Hög risk, specialistmödrahälsovård' });
export const FORLOSSNINGSSATT = tabell({ vaginal: 'Vaginal förlossning', instrumentell: 'Instrumentell vaginal förlossning (sugklocka)', kejsarsnitt: 'Kejsarsnitt' });

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS graviditeter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, registrerad_av TEXT NOT NULL, skapad TEXT NOT NULL,
  sista_mens TEXT, ul_datum TEXT, ul_dagar INTEGER, bpd TEXT NOT NULL, bpd_kalla TEXT NOT NULL, antal_foster INTEGER NOT NULL, paritet INTEGER NOT NULL,
  tidigare_kejsarsnitt INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_grav_patient ON graviditeter (patient_id);
CREATE TABLE IF NOT EXISTS graviditet_besok (
  id INTEGER PRIMARY KEY, graviditet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, dagar INTEGER NOT NULL,
  blodtryck TEXT, vikt REAL, sf_matt REAL, fosterljud INTEGER, urin_protein INTEGER, varningar TEXT NOT NULL DEFAULT '[]', av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS forlossningar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, graviditet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, start TEXT NOT NULL,
  startad_av TEXT NOT NULL, status TEXT NOT NULL, avslutad TEXT
);
CREATE TABLE IF NOT EXISTS partogram (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, oppning INTEGER NOT NULL,
  fosterljud INTEGER, varkor INTEGER, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS forlossning_barn (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, barn_patient_id TEXT NOT NULL UNIQUE, ordning INTEGER NOT NULL,
  fodd_tid TEXT NOT NULL, satt TEXT NOT NULL, vikt INTEGER NOT NULL, langd REAL NOT NULL, huvudomfang REAL NOT NULL, apgar TEXT NOT NULL, dagar INTEGER NOT NULL, av TEXT NOT NULL
);
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

export function graviditetRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM graviditeter WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Graviditeten finns inte.', 'saknas');
  return r;
}
export function forlossningRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM forlossningar WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Förlossningen finns inte.', 'saknas');
  return r;
}

const giltigtDatum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && datumAv(new Date(lokalTid(s, '12:00'))) === s;
const dagarMellan = (fran, till) => Math.round((Date.parse(lokalTid(till, '12:00')) - Date.parse(lokalTid(fran, '12:00'))) / DAG);
// Graviditetslängden i dagar ett visst datum, och som text: v 12+3.
export const dagarFor = (g, datum) => GRAVIDITETSDAGAR - dagarMellan(datum, g.bpd);
export const veckaText = (dagar) => `v ${Math.floor(dagar / 7)}+${dagar % 7}`;

// Beräknad partus: sista mens plus 280 dagar (Naegeles regel), eller ultraljudet när det skiljer mer än sju dagar.
export function bpdFor({ sistaMens = null, ulDatum = null, ulDagar = null }) {
  const sm = sistaMens ? addDagar(sistaMens, GRAVIDITETSDAGAR) : null;
  const ul = ulDatum != null && ulDagar != null ? addDagar(ulDatum, GRAVIDITETSDAGAR - ulDagar) : null;
  if (ul && (!sm || Math.abs(dagarMellan(sm, ul)) > 7)) {
    return { bpd: ul, kalla: 'ultraljud', text: sm ? `Ultraljudet skiljer ${Math.abs(dagarMellan(sm, ul))} dagar från sista mens, så systemet räknar från ultraljudet.` : 'Beräknad från ultraljudet.' };
  }
  if (sm) return { bpd: sm, kalla: 'sista_mens', text: ul ? 'Ultraljudet stämmer med sista mens inom sju dagar.' : 'Beräknad från sista mens.' };
  throw new Fel(400, 'Ange första dagen i sista mens eller ultraljudets graviditetslängd.', 'ogiltig', { falt: ['sistaMens'] });
}

// Riskbedömningen ur det som den inloggade får se.
export function riskbedomning(atk, g, nu = new Date()) {
  const db = atk.db;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(g.patient_id);
  const ar = alder(p.fodd, datumAv(nu));
  const faktorer = [];
  if (ar >= 40) faktorer.push({ id: 'alder', text: `Modern är ${ar} år.`, vikt: 1 });
  if (ar < 18) faktorer.push({ id: 'ung', text: `Modern är ${ar} år.`, vikt: 1 });
  if (g.antal_foster > 1) faktorer.push({ id: 'flerbord', text: g.antal_foster === 2 ? 'Tvillinggraviditet.' : `Flerbörd med ${g.antal_foster} foster.`, vikt: 2 });
  if (g.tidigare_kejsarsnitt) faktorer.push({ id: 'kejsarsnitt', text: `${g.tidigare_kejsarsnitt === 1 ? 'Ett tidigare kejsarsnitt' : `${g.tidigare_kejsarsnitt} tidigare kejsarsnitt`}.`, vikt: g.tidigare_kejsarsnitt > 1 ? 2 : 1 });
  const mv = atk.filtrera(db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ IN ('vikt', 'langd') ORDER BY tid DESC").all(g.patient_id), 'las_matvarden');
  const vikt = mv.find(m => m.typ === 'vikt'), langd = mv.find(m => m.typ === 'langd');
  if (vikt && langd) {
    const bmi = Number(vikt.varde_num ?? vikt.varde) / (Number(langd.varde_num ?? langd.varde) / 100) ** 2;
    if (bmi >= 30) faktorer.push({ id: 'bmi', text: `BMI ${bmi.toFixed(1).replace('.', ',')}.`, vikt: bmi >= 35 ? 2 : 1 });
  }
  const dia = atk.filtrera(db.query('SELECT * FROM diagnoser WHERE patient_id = ?').all(g.patient_id), 'las_diagnoser');
  if (dia.some(d => /^E1[01]/.test(d.kod))) faktorer.push({ id: 'diabetes', text: 'Diabetes.', vikt: 2 });
  if (dia.some(d => /^I1[0-5]/.test(d.kod))) faktorer.push({ id: 'hypertoni', text: 'Högt blodtryck före graviditeten.', vikt: 1 });
  const grupp = labb.synligaBestallningar(atk).flatMap(b => db.query("SELECT svar_text FROM labb_analyser WHERE bestallning_id = ? AND analys = 'blodgruppering' AND status = 'besvarad'").all(b.id))
    .map(r => tolkaBlodgrupp(r.svar_text)).find(Boolean);
  if (grupp?.endsWith('-')) faktorer.push({ id: 'rhd', text: 'RhD-negativ. Systemet lägger till bastest i vecka 28 och anti-D-profylax efter förlossningen.', vikt: 0 });
  const summa = faktorer.reduce((s, f) => s + f.vikt, 0);
  const niva = faktorer.some(f => f.vikt >= 2) ? 'hog' : summa ? 'forhojd' : 'normal';
  return { niva, namn: RISKNIVA[niva], faktorer, blodgrupp: grupp ?? null };
}

// Besöksprogrammet med vad som är gjort och vad som är nästa besök.
export function program(atk, g, risk, nu = new Date()) {
  const besok = atk.db.query('SELECT dagar FROM graviditet_besok WHERE graviditet_id = ?').all(g.id).map(b => Math.floor(b.dagar / 7));
  const idag = dagarFor(g, datumAv(nu));
  const lista = [...PROGRAM, ...(g.antal_foster > 1 ? FLERBORD_PROGRAM : []), ...(risk.niva !== 'normal' ? RISK_PROGRAM : [])].sort((a, b) => a.vecka - b.vecka)
    .map(x => ({ ...x, datum: addDagar(g.bpd, x.vecka * 7 - GRAVIDITETSDAGAR), prover: (x.prover ?? []).map(id => ({ analys: id, namn: ANALYS[id].namn })),
      gjort: besok.some(v => Math.abs(v - x.vecka) <= 1) }));
  const nasta = lista.find(x => !x.gjort && x.vecka * 7 >= idag - 7) ?? null;
  return { besok: lista, nasta };
}

const lasJson = (s, standard) => { try { return JSON.parse(s); } catch { return standard; } };
export function graviditetUt(atk, g, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, g, 'las_graviditet');
  const risk = riskbedomning(atk, g, nu);
  const dagar = dagarFor(g, datumAv(nu));
  const f = db.query('SELECT * FROM forlossningar WHERE graviditet_id = ? ORDER BY id DESC').get(g.id);
  return {
    id: g.id, status: g.status, bpd: g.bpd, bpdKalla: g.bpd_kalla, sistaMens: g.sista_mens, graviditetslangd: { dagar, text: veckaText(Math.max(0, dagar)) },
    antalFoster: g.antal_foster, paritet: g.paritet, tidigareKejsarsnitt: g.tidigare_kejsarsnitt, risk, program: program(atk, g, risk, nu),
    besok: db.query('SELECT * FROM graviditet_besok WHERE graviditet_id = ? ORDER BY tid').all(g.id).map(b => ({ id: b.id, tid: b.tid, vecka: veckaText(b.dagar), blodtryck: b.blodtryck,
      vikt: b.vikt, sfMatt: b.sf_matt, fosterljud: b.fosterljud, urinProtein: b.urin_protein, varningar: lasJson(b.varningar, []), av: personNamn(db, b.av) })),
    vardenhet: enhetKort(db, g.enhet_id), registrerad: { tid: g.skapad, av: personNamn(db, g.registrerad_av) },
    forlossning: f ? forlossningUt(atk, f) : null, demoregel: DEMOREGEL,
  };
}

// ---- Graviditetsjournalen --------------------------------------------------------------------------------------------

export function registrera(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('graviditet');
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  if (p.kon !== 'kvinna') throw new Fel(400, 'En graviditetsjournal förs för en kvinna.', 'ogiltig');
  if (db.query("SELECT 1 FROM graviditeter WHERE patient_id = ? AND status = 'pagaende'").get(atk.patientId)) throw new Fel(409, 'Patienten har redan en pågående graviditet.', 'ogiltig');
  const idag = datumAv(nu);
  const sistaMens = body.sistaMens ?? null;
  if (sistaMens != null && (!giltigtDatum(sistaMens) || sistaMens > idag || dagarMellan(sistaMens, idag) > 300)) throw new Fel(400, 'Sista mens ska vara ett datum de senaste 300 dagarna, ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['sistaMens'] });
  let ulDatum = null, ulDagar = null;
  if (body.ultraljud) {
    ulDatum = body.ultraljud.datum ?? idag;
    ulDagar = Number(body.ultraljud.veckor) * 7 + Number(body.ultraljud.dagar ?? 0);
    if (!giltigtDatum(ulDatum) || ulDatum > idag || !Number.isInteger(ulDagar) || ulDagar < 42 || ulDagar > 300) throw new Fel(400, 'Ange ultraljudets datum och graviditetslängd i veckor och dagar, mellan vecka 6 och 42.', 'ogiltig', { falt: ['ultraljud'] });
  }
  const b = bpdFor({ sistaMens, ulDatum, ulDagar });
  const antal = body.antalFoster == null ? 1 : Number(body.antalFoster);
  if (![1, 2, 3].includes(antal)) throw new Fel(400, 'Antalet foster är 1, 2 eller 3 i demon.', 'ogiltig', { falt: ['antalFoster'] });
  const paritet = Number(body.paritet ?? 0), ks = Number(body.tidigareKejsarsnitt ?? 0);
  if (!Number.isInteger(paritet) || paritet < 0 || paritet > 15) throw new Fel(400, 'Antalet tidigare förlossningar är ett heltal.', 'ogiltig', { falt: ['paritet'] });
  if (!Number.isInteger(ks) || ks < 0 || ks > paritet) throw new Fel(400, 'Tidigare kejsarsnitt kan inte vara fler än tidigare förlossningar.', 'ogiltig', { falt: ['tidigareKejsarsnitt'] });
  const r = db.query(`INSERT INTO graviditeter (patient_id, enhet_id, vardkontakt_id, registrerad_av, skapad, sista_mens, ul_datum, ul_dagar, bpd, bpd_kalla, antal_foster, paritet, tidigare_kejsarsnitt, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pagaende')`).run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), atk.personal.id, iso(nu), sistaMens, ulDatum, ulDagar, b.bpd, b.kalla, antal, paritet, ks);
  const g = graviditetRad(db, r.lastInsertRowid);
  return { ...graviditetUt(atk, g, nu), bpdText: b.text };
}

// Ultraljud senare i graviditeten: BPD räknas om när ultraljudet skiljer mer än sju dagar från den nuvarande.
export function ultraljud(atk, g, body = {}, nu = new Date()) {
  andraGrav(atk, g);
  const datum = body.datum ?? datumAv(nu);
  const dagar = Number(body.veckor) * 7 + Number(body.dagar ?? 0);
  if (!giltigtDatum(datum) || !Number.isInteger(dagar) || dagar < 42 || dagar > 300) throw new Fel(400, 'Ange graviditetslängden vid ultraljudet i veckor och dagar.', 'ogiltig', { falt: ['veckor'] });
  const b = bpdFor({ sistaMens: g.sista_mens, ulDatum: datum, ulDagar: dagar });
  atk.db.query('UPDATE graviditeter SET ul_datum = ?, ul_dagar = ?, bpd = ?, bpd_kalla = ?, antal_foster = ? WHERE id = ?')
    .run(datum, dagar, b.bpd, b.kalla, [1, 2, 3].includes(Number(body.antalFoster)) ? Number(body.antalFoster) : g.antal_foster, g.id);
  return { ...graviditetUt(atk, graviditetRad(atk.db, g.id), nu), bpdText: b.text };
}

// Prover som ska tas enligt provschemat vid nästa besök och som inte redan är beställda efter inskrivningen.
export function proverAttTa(atk, g, nu = new Date()) {
  lasRad(atk, g, 'las_graviditet');
  const p = program(atk, g, riskbedomning(atk, g, nu), nu);
  if (!p.nasta) return [];
  const bestallda = new Set(labb.synligaBestallningar(atk).filter(b => !b.makulerad_tid && b.skapad >= iso(Date.parse(lokalTid(p.nasta.datum, '00:00')) - 14 * DAG))
    .flatMap(b => atk.db.query("SELECT analys FROM labb_analyser WHERE bestallning_id = ? AND status <> 'borttagen'").all(b.id).map(a => a.analys)));
  return p.nasta.prover.map(x => x.analys).filter(a => !bestallda.has(a));
}
export function bestallProver(atk, g, nu = new Date()) {
  const saknas = proverAttTa(atk, g, nu);
  if (!saknas.length) throw new Fel(409, 'Inga prover ska tas vid nästa besök, eller så är de redan beställda.', 'ogiltig');
  const text = `Graviditet ${veckaText(Math.max(0, dagarFor(g, datumAv(nu))))}. Prover enligt provschemat i mödrahälsovården.`;
  return labb.bestall(atk, { analyser: saknas, kvitteraDubbletter: true, anamnes: text, kommentar: text }, nu);
}

// Besöket hos barnmorskan. Blodtryck och vikt blir också mätvärden i journalen.
export function besok(atk, g, body = {}, nu = new Date()) {
  const db = atk.db;
  andraGrav(atk, g);
  if (g.status !== 'pagaende') throw new Fel(409, 'Graviditeten är avslutad.', 'ogiltig');
  const dagar = dagarFor(g, datumAv(nu));
  const varningar = [];
  let bt = null;
  if (body.blodtryck) {
    const m = String(body.blodtryck).match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!m) throw new Fel(400, 'Blodtryck anges som systoliskt/diastoliskt, till exempel 120/80.', 'ogiltig', { falt: ['blodtryck'] });
    bt = [Number(m[1]), Number(m[2])];
  }
  const tal = (v, falt, min, max) => {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) throw new Fel(400, `Värdet ska vara mellan ${min} och ${max}.`, 'ogiltig', { falt: [falt] });
    return n;
  };
  const vikt = tal(body.vikt, 'vikt', 30, 250), sf = tal(body.sfMatt, 'sfMatt', 10, 50), fl = tal(body.fosterljud, 'fosterljud', 50, 250), prot = tal(body.urinProtein, 'urinProtein', 0, 4);
  if (bt && (bt[0] >= 140 || bt[1] >= 90)) {
    varningar.push(prot >= 1 ? 'Förhöjt blodtryck och protein i urinen kan vara havandeskapsförgiftning (preeklampsi). Kontakta läkare och förlossningen nu.'
      : 'Blodtrycket är förhöjt. Kontrollera urinen för protein och kontakta läkare samma dag.');
  }
  const v = Math.floor(dagar / 7);
  if (sf != null && g.antal_foster === 1 && v >= 24 && v <= 40 && Math.abs(sf - v) > 3) varningar.push(`Symfys-fundusmåttet ${sf} cm avviker från det förväntade i vecka ${v}. Boka ett tillväxtultraljud.`);
  if (fl != null && (fl < 110 || fl > 160)) varningar.push(`Fosterljuden ${fl} slag per minut ligger utanför 110 till 160. Kontakta förlossningen.`);
  const t = iso(nu);
  db.transaction(() => {
    db.query('INSERT INTO graviditet_besok (graviditet_id, patient_id, enhet_id, tid, dagar, blodtryck, vikt, sf_matt, fosterljud, urin_protein, varningar, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(g.id, g.patient_id, atk.personal.enhet_id, t, dagar, bt ? bt.join('/') : null, vikt, sf, fl, prot, JSON.stringify(varningar), atk.personal.id);
    if (bt) matvarde(atk, 'blodtryck', bt.join('/'), t);
    if (vikt != null) matvarde(atk, 'vikt', vikt, t);
  })();
  return { ...graviditetUt(atk, graviditetRad(db, g.id), nu), varningar };
}

// Patientens graviditeter. Inre sekretess och spärr prövas på den vårdenhet som förde graviditetsjournalen.
export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_graviditet');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM graviditeter WHERE patient_id = ? ORDER BY skapad DESC').all(atk.patientId), 'las_graviditet');
  const barn = atk.db.query('SELECT * FROM forlossning_barn WHERE barn_patient_id = ?').get(atk.patientId);
  return { graviditeter: rader.map(g => graviditetUt(atk, g, nu)), moder: barn ? { forlossningId: barn.forlossning_id, ordning: barn.ordning } : null, demoregel: DEMOREGEL };
}

// ---- Förlossningen ---------------------------------------------------------------------------------------------------

// Varningslinjen startar vid första undersökningen i aktiv fas (minst 4 cm) och går 1 cm i timmen. Åtgärdslinjen ligger
// fyra timmar till höger (WHO:s partogram).
export function partogramUt(rader) {
  const forsta = rader.find(r => r.oppning >= 4);
  return rader.map(r => {
    if (!forsta || r.tid < forsta.tid) return { tid: r.tid, oppning: r.oppning, fosterljud: r.fosterljud, varkor: r.varkor, varningslinje: null, atgardslinje: null, lage: 'latent' };
    const timmar = (Date.parse(r.tid) - Date.parse(forsta.tid)) / TIMME;
    const varn = Math.min(10, forsta.oppning + timmar), atg = Math.min(10, Math.max(forsta.oppning, forsta.oppning + timmar - 4));
    const lage = r.oppning >= 10 ? 'fullt_vidgad' : r.oppning < atg ? 'over_atgardslinje' : r.oppning < varn ? 'over_varningslinje' : 'normal';
    return { tid: r.tid, oppning: r.oppning, fosterljud: r.fosterljud, varkor: r.varkor, varningslinje: Number(varn.toFixed(1)), atgardslinje: Number(atg.toFixed(1)), lage };
  });
}
const LAGE_TEXT = { latent: 'Latent fas.', normal: 'Förloppet följer varningslinjen.', over_varningslinje: 'Förloppet är långsammare än varningslinjen. Bedöm värkarna och överväg att ta hål på hinnorna eller ge värkstimulering.',
  over_atgardslinje: 'Förloppet har passerat åtgärdslinjen. Tillkalla förlossningsläkaren nu.', fullt_vidgad: 'Modermunnen är fullt vidgad.' };

export function forlossningUt(atk, f) {
  const db = atk.db;
  const punkter = partogramUt(db.query('SELECT * FROM partogram WHERE forlossning_id = ? ORDER BY tid, id').all(f.id));
  const sista = punkter.at(-1);
  const barn = db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f.id);
  return {
    id: f.id, status: f.status, start: f.start, vardenhet: enhetKort(db, f.enhet_id), partogram: punkter,
    lage: sista ? { id: sista.lage, text: LAGE_TEXT[sista.lage] } : null,
    fosterljudVarning: sista?.fosterljud != null && (sista.fosterljud < 110 || sista.fosterljud > 160) ? `Fosterljuden ${sista.fosterljud} ligger utanför 110 till 160 slag per minut. Bedöm med CTG och tillkalla läkare.` : null,
    barn: barn.map(b => ({ ordning: b.ordning, patientId: b.barn_patient_id, fodd: b.fodd_tid, satt: FORLOSSNINGSSATT[b.satt], vikt: b.vikt, langd: b.langd, huvudomfang: b.huvudomfang,
      apgar: lasJson(b.apgar, []), graviditetslangd: veckaText(b.dagar), av: personNamn(db, b.av) })),
  };
}

export function startaForlossning(atk, g, body = {}, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, g, 'las_graviditet');
  atk.krav('graviditet');
  if (g.status !== 'pagaende') throw new Fel(409, 'Graviditeten är redan avslutad.', 'ogiltig');
  if (db.query("SELECT 1 FROM forlossningar WHERE graviditet_id = ? AND status = 'pagaende'").get(g.id)) throw new Fel(409, 'Förlossningen är redan startad.', 'ogiltig');
  const dagar = dagarFor(g, datumAv(nu));
  if (dagar < 22 * 7) throw new Fel(409, `Graviditeten är ${veckaText(dagar)}. En förlossningsjournal startas från vecka 22.`, 'ogiltig');
  const r = db.query("INSERT INTO forlossningar (graviditet_id, patient_id, enhet_id, start, startad_av, status) VALUES (?, ?, ?, ?, ?, 'pagaende')").run(g.id, g.patient_id, atk.personal.enhet_id, iso(nu), atk.personal.id);
  const f = forlossningRad(db, r.lastInsertRowid);
  if (body.oppning != null) partogram(atk, f, body, nu);
  return forlossningUt(atk, forlossningRad(db, f.id));
}

export function partogram(atk, f, body = {}, nu = new Date()) {
  const db = atk.db;
  andraForl(atk, f);
  if (f.status !== 'pagaende') throw new Fel(409, 'Förlossningen är avslutad.', 'ogiltig');
  const oppning = Number(body.oppning);
  if (!Number.isInteger(oppning) || oppning < 0 || oppning > 10) throw new Fel(400, 'Modermunnens öppning anges i hela centimeter, 0 till 10.', 'ogiltig', { falt: ['oppning'] });
  const fl = body.fosterljud == null ? null : Number(body.fosterljud), vk = body.varkor == null ? null : Number(body.varkor);
  if (fl != null && (!Number.isInteger(fl) || fl < 50 || fl > 250)) throw new Fel(400, 'Fosterljuden anges i slag per minut.', 'ogiltig', { falt: ['fosterljud'] });
  if (vk != null && (!Number.isInteger(vk) || vk < 0 || vk > 10)) throw new Fel(400, 'Värkarna anges som antal per tio minuter.', 'ogiltig', { falt: ['varkor'] });
  const t = body.tid ? iso(Date.parse(body.tid)) : iso(nu);
  if (!Number.isFinite(Date.parse(t)) || Date.parse(t) > nu.getTime() + 5 * 60_000 || t < f.start) throw new Fel(400, 'Tiden ska vara under förlossningen.', 'ogiltig', { falt: ['tid'] });
  const forra = db.query('SELECT max(oppning) AS o FROM partogram WHERE forlossning_id = ?').get(f.id).o;
  if (forra != null && oppning < forra) throw new Fel(400, `Öppningen var ${forra} cm vid förra undersökningen. Kontrollera värdet.`, 'ogiltig', { falt: ['oppning'] });
  db.query('INSERT INTO partogram (forlossning_id, patient_id, enhet_id, tid, oppning, fosterljud, varkor, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(f.id, f.patient_id, f.enhet_id, t, oppning, fl, vk, atk.personal.id);
  return forlossningUt(atk, f);
}

// Barnet föds. Systemet skapar barnets journal med reservnummer (personnumret kommer senare från Skatteverket, som är
// simulerat i demon), kopplar barnet till modern och för födelseuppgifterna vidare till barnhälsovården. Barnet får
// en vårdkontakt på förlossningen och BB där det vårdas.
export function fodelse(atk, f, body = {}, nu = new Date()) {
  const db = atk.db;
  andraForl(atk, f);
  atk.krav('registrera_patient');
  if (f.status !== 'pagaende') throw new Fel(409, 'Förlossningen är avslutad.', 'ogiltig');
  const g = graviditetRad(db, f.graviditet_id);
  const fodda = db.query('SELECT count(*) AS n FROM forlossning_barn WHERE forlossning_id = ?').get(f.id).n;
  if (fodda >= g.antal_foster) throw new Fel(409, 'Alla barn är redan registrerade. Ändra antalet foster om det var fler.', 'ogiltig');
  const kon = body.kon;
  if (!['kvinna', 'man'].includes(kon)) throw new Fel(400, 'Ange barnets kön, flicka eller pojke.', 'ogiltig', { falt: ['kon'] });
  if (!finns(FORLOSSNINGSSATT, body.satt ?? 'vaginal')) throw new Fel(400, 'Förlossningssättet finns inte.', 'ogiltig', { falt: ['satt'] });
  const vikt = Number(body.vikt), langd = Number(body.langd), hu = Number(body.huvudomfang);
  if (!Number.isInteger(vikt) || vikt < 300 || vikt > 6500) throw new Fel(400, 'Födelsevikten anges i gram, 300 till 6 500.', 'ogiltig', { falt: ['vikt'] });
  if (!(langd >= 25 && langd <= 62)) throw new Fel(400, 'Längden anges i centimeter, 25 till 62.', 'ogiltig', { falt: ['langd'] });
  if (!(hu >= 18 && hu <= 42)) throw new Fel(400, 'Huvudomfånget anges i centimeter, 18 till 42.', 'ogiltig', { falt: ['huvudomfang'] });
  const apgar = Array.isArray(body.apgar) ? body.apgar.map(Number) : [];
  if (apgar.length !== 3 || apgar.some(a => !Number.isInteger(a) || a < 0 || a > 10)) throw new Fel(400, 'Ange Apgarpoäng vid 1, 5 och 10 minuter, 0 till 10.', 'ogiltig', { falt: ['apgar'] });
  const t = iso(nu);
  const dagar = dagarFor(g, datumAv(nu));
  const mor = db.query('SELECT * FROM patienter WHERE id = ?').get(f.patient_id);
  const ordning = fodda + 1;
  let barnId;
  db.transaction(() => {
    const r = identitet.registrera(db, { kon, fodd: datumAv(nu), fornamn: g.antal_foster > 1 ? `${kon === 'kvinna' ? 'Flicka' : 'Pojke'} ${ordning}` : kon === 'kvinna' ? 'Flicka' : 'Pojke', efternamn: mor.efternamn },
      { idag: datumAv(nu), tid: t, av: atk.personal.id });
    barnId = r.id;
    if (mor.skyddad) db.query('UPDATE patienter SET skyddad = 1 WHERE id = ?').run(barnId);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES (?, ?, 'slutenvard', ?, 'Förlossningen och BB', 'Nyfödd')").run(barnId, atk.personal.enhet_id, t);
    db.query('INSERT INTO forlossning_barn (forlossning_id, patient_id, enhet_id, barn_patient_id, ordning, fodd_tid, satt, vikt, langd, huvudomfang, apgar, dagar, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.id, f.patient_id, atk.personal.enhet_id, barnId, ordning, t, body.satt ?? 'vaginal', vikt, langd, hu, JSON.stringify(apgar), dagar, atk.personal.id);
    // Födelseuppgifterna till barnhälsovården (bhv.js), på barnets journal och förlossningens vårdenhet.
    const ins = db.query('INSERT INTO tillvaxt_uppgifter (patient_id, enhet_id, typ, varde, tid, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [typ, varde] of [['graviditetslangd', Math.floor(dagar / 7)], ['fodelsevikt', vikt / 1000], ['fodelselangd', langd], ['fodelse_huvudomfang', hu]]) ins.run(barnId, atk.personal.enhet_id, typ, varde, t, atk.personal.id, t);
    if (ordning === g.antal_foster) {
      db.query("UPDATE forlossningar SET status = 'avslutad', avslutad = ? WHERE id = ?").run(t, f.id);
      db.query("UPDATE graviditeter SET status = 'forlost' WHERE id = ?").run(g.id);
    }
  })();
  atk.logga('graviditet', atk.grund(), `forlossning:${f.id}:barn:${ordning}`);
  return { ...forlossningUt(atk, forlossningRad(db, f.id)), barnId, kvar: g.antal_foster - ordning };
}

// ---- Planering och uppföljning per vårdenhet -------------------------------------------------------------------------

// Utan personuppgifter: pågående graviditeter efter risk, väntade förlossningar per vecka de kommande tolv veckorna och
// förlossningarna under perioden med sätt, flerbörd, Apgar, födelsevikt och förlopp över åtgärdslinjen.
export function uppfoljning(db, personal, { fran = null, till = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'statistik', 'Din yrkesroll har inte uppföljningen.');
  const t = till ?? datumAv(nu), f = fran ?? addDagar(t, -365);
  if (![f, t].every(giltigtDatum) || f > t) throw new Fel(400, 'Ange perioden som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const pagaende = db.query(`SELECT * FROM graviditeter WHERE status = 'pagaende' AND enhet_id IN (${ph})`).all(...enheter);
  const idag = datumAv(nu);
  const veckor = Array.from({ length: 12 }, (_, i) => {
    const fran = addDagar(idag, i * 7), till = addDagar(idag, i * 7 + 7);
    return { fran, antal: pagaende.filter(g => g.bpd >= fran && g.bpd < till).length };
  });
  const start = lokalTid(f, '00:00'), slut = lokalTid(addDagar(t, 1), '00:00');
  const forl = db.query(`SELECT * FROM forlossningar WHERE enhet_id IN (${ph}) AND avslutad >= ? AND avslutad < ?`).all(...enheter, start, slut);
  const barn = forl.flatMap(x => db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ?').all(x.id));
  const atgard = forl.filter(x => partogramUt(db.query('SELECT * FROM partogram WHERE forlossning_id = ? ORDER BY tid, id').all(x.id)).some(p => p.lage === 'over_atgardslinje')).length;
  const andel = (n, av) => (av ? Math.round((n / av) * 100) : 0);
  const per = (niva) => pagaende.filter(g => g.antal_foster > 1 ? niva === 'hog' : g.tidigare_kejsarsnitt > 1 ? niva === 'hog' : g.tidigare_kejsarsnitt ? niva === 'forhojd' : niva === 'normal').length;
  return {
    vardenhet: enhetKort(db, ve), fran: f, till: t,
    graviditeter: { pagaende: pagaende.length, flerbord: pagaende.filter(g => g.antal_foster > 1).length, overBpd: pagaende.filter(g => g.bpd < idag).length,
      riskEfterRegistrering: Object.keys(RISKNIVA).map(id => ({ id, namn: RISKNIVA[id], antal: per(id) })) },
    vantadeForlossningar: veckor,
    forlossningar: { antal: forl.length, barn: barn.length, flerbord: forl.filter(x => barn.filter(b => b.forlossning_id === x.id).length > 1).length,
      kejsarsnitt: andel(barn.filter(b => b.satt === 'kejsarsnitt').length, barn.length), apgarUnder7: andel(barn.filter(b => (lasJson(b.apgar, [])[1] ?? 10) < 7).length, barn.length),
      medelvikt: barn.length ? Math.round(barn.reduce((s, b) => s + b.vikt, 0) / barn.length) : null, overAtgardslinjen: andel(atgard, forl.length) },
    text: 'Uppföljningen räknas av systemet ur graviditets- och förlossningsjournalerna. Risken räknas här bara ur det som registrerades vid inskrivningen (flerbörd och tidigare kejsarsnitt), eftersom den fullständiga bedömningen bygger på journaluppgifter. Inga personuppgifter.',
  };
}

