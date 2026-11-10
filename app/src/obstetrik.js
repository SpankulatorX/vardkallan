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
import { vardenhetFor, enheterUnder, alder, Atkomst, kanRoll, visningsnamn } from './atkomst.js';
import * as identitet from './identitet.js';
import * as labb from './labb.js';
import { ANALYS } from './labb-katalog.js';
import { tolkaBlodgrupp } from './blod.js';
import { tabell, finns, personNamn, enhetKort, iso, DAG, TIMME, kravRoll, vardkontaktFor, matvarde, lasRad, andraRad, textFalt, loggaPatient } from './specialist-hjalp.js';
// Runda 11, r3: inskrivningssamtalets levnadsvanor blir en vanlig anteckning av typen Levnadsvanor (journal.js).
const journal = () => require('./journal.js');
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
// Runda 11, r3: ultraljudsjournalen, inskrivningssamtalet med de känsliga svaren, efterkontrollen, CTG, smärtlindringen,
// födelseanmälan, BB-journalen för mor och barn och rapporteringen till Graviditetsregistret (forlossning.js och
// graviditetsregistret.js). Svaren på frågorna om våld sparas bara i kolumnen kansligt i graviditet_samtal och lämnas
// aldrig ut i graviditetsjournalen, uppföljningen, datauttaget eller registret.
export const SCHEMA_R11 = `
CREATE TABLE IF NOT EXISTS graviditet_ultraljud (
  id INTEGER PRIMARY KEY, graviditet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, datum TEXT NOT NULL,
  typ TEXT NOT NULL, dagar INTEGER NOT NULL, antal_foster INTEGER NOT NULL, foster TEXT NOT NULL DEFAULT '[]', placenta TEXT, fostervatten TEXT,
  fynd TEXT, varningar TEXT NOT NULL DEFAULT '[]', datering INTEGER NOT NULL DEFAULT 0, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graviditet_samtal (
  id INTEGER PRIMARY KEY, graviditet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  anteckning_id INTEGER, anamnes TEXT NOT NULL DEFAULT '{}', tobak TEXT, vald_stalld INTEGER NOT NULL, vald_orsak TEXT, kansligt TEXT, onskemal TEXT
);
CREATE TABLE IF NOT EXISTS graviditet_efterkontroll (
  id INTEGER PRIMARY KEY, graviditet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  epds INTEGER NOT NULL, epds_fraga10 INTEGER NOT NULL, amning TEXT NOT NULL, blodning TEXT NOT NULL, bristning_lakt INTEGER, preventivmedel TEXT,
  varningar TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS ctg_koppling (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, start TEXT NOT NULL, slut TEXT,
  utrustning TEXT NOT NULL, forlopp TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ctg_bedomning (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, klass TEXT NOT NULL,
  forslag TEXT NOT NULL, analys TEXT NOT NULL, atgard TEXT, motivering TEXT, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS smartlindring (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, metod TEXT NOT NULL,
  varningar TEXT NOT NULL DEFAULT '[]', av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fodelseanmalan (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, barn_patient_id TEXT NOT NULL UNIQUE, enhet_id TEXT NOT NULL,
  tid TEXT NOT NULL, status TEXT NOT NULL, kvittens TEXT, personnummer TEXT, text TEXT, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bb_kontroller (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, forlossning_id INTEGER NOT NULL, vem TEXT NOT NULL, tid TEXT NOT NULL,
  varden TEXT NOT NULL, varningar TEXT NOT NULL DEFAULT '[]', av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bb_screening (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, forlossning_id INTEGER NOT NULL, typ TEXT NOT NULL, tid TEXT NOT NULL,
  resultat TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bb_utskrivning (
  id INTEGER PRIMARY KEY, forlossning_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  kriterier TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graviditetsregister_utskick (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, enhet_id TEXT NOT NULL, av TEXT NOT NULL, antal INTEGER NOT NULL, undantagna INTEGER NOT NULL,
  kvittens TEXT NOT NULL, innehall TEXT NOT NULL
);
`;
// Kolumner som har tillkommit i graviditeter efter runda 9: IVF-graviditetens embryoöverföring och om patienten har
// motsatt sig rapporteringen till Graviditetsregistret.
const NYA_KOLUMNER = [['ivf_overforing', 'TEXT'], ['ivf_embryo_dagar', 'INTEGER'], ['register_motsatt', 'INTEGER NOT NULL DEFAULT 0']];
const har = new WeakSet();
export function sakra(db) {
  if (har.has(db)) return;
  db.exec(SCHEMA);
  const kol = new Set(db.query('PRAGMA table_info(graviditeter)').all().map(c => c.name));
  for (const [k, typ] of NYA_KOLUMNER) if (!kol.has(k)) db.exec(`ALTER TABLE graviditeter ADD COLUMN ${k} ${typ}`);
  db.exec(SCHEMA_R11);
  har.add(db);
}

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
// Runda 11, r3: vid en IVF-graviditet räknas den från embryoöverföringen, 266 dagar minus embryots ålder i dagar, och
// ultraljudet ändrar den inte.
export function bpdFor({ sistaMens = null, ulDatum = null, ulDagar = null, ivfDatum = null, ivfDagar = null }) {
  if (ivfDatum) return { bpd: addDagar(ivfDatum, GRAVIDITETSDAGAR - 14 - ivfDagar), kalla: 'ivf', text: `Beräknad från embryoöverföringen vid IVF (embryo dag ${ivfDagar}). Ultraljudet ändrar inte en IVF-graviditets beräknade partus.` };
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
  // Runda 11, r3: IVF och anamnesen från inskrivningssamtalet.
  const an = anamnesFor(db, g);
  if (g.ivf_overforing) faktorer.push({ id: 'ivf', text: 'IVF-graviditet.', vikt: 1 });
  if (an.tidigarePreeklampsi) faktorer.push({ id: 'tidigare_preeklampsi', text: 'Havandeskapsförgiftning i en tidigare graviditet.', vikt: 2 });
  if (an.tidigareGdm) faktorer.push({ id: 'tidigare_gdm', text: 'Graviditetsdiabetes i en tidigare graviditet.', vikt: 1 });
  const summa = faktorer.reduce((s, f) => s + f.vikt, 0);
  const niva = faktorer.some(f => f.vikt >= 2) ? 'hog' : summa ? 'forhojd' : 'normal';
  const bmi = vikt && langd ? Number(vikt.varde_num ?? vikt.varde) / (Number(langd.varde_num ?? langd.varde) / 100) ** 2 : null;
  const id = new Set(faktorer.map(f => f.id));
  return { niva, namn: RISKNIVA[niva], faktorer, blodgrupp: grupp ?? null, ...beslutsstod({ id, bmi, ar, an, g }) };
}

// Runda 11, r3: beslutsstödet för graviditetsdiabetes och havandeskapsförgiftning (demoregler med svenska
// riktlinjer som förebild, inte ett kliniskt beslutsstöd). Systemet räknar ur det som finns och säger vad som ska göras.
function beslutsstod({ id, bmi, ar, an, g }) {
  const gdmSkal = [];
  if (!id.has('diabetes')) {
    if (bmi != null && bmi >= 30) gdmSkal.push('BMI 30 eller mer');
    if (an.tidigareGdm) gdmSkal.push('graviditetsdiabetes tidigare');
    if (an.arftlighetDiabetes) gdmSkal.push('diabetes hos förälder eller syskon');
  }
  const gdm = gdmSkal.length
    ? { forhojd: true, text: `Förhöjd risk för graviditetsdiabetes (${gdmSkal.join(', ')}). Systemet lägger till en tidig glukosbelastning i vecka 13 utöver den i vecka 28.` }
    : { forhojd: false, text: id.has('diabetes') ? 'Patienten har diabetes sedan tidigare och följs av diabetesteamet.' : 'Ingen förhöjd risk för graviditetsdiabetes i det som finns i journalen.' };
  const hog = [], mattlig = [];
  if (an.tidigarePreeklampsi) hog.push('havandeskapsförgiftning tidigare');
  if (id.has('hypertoni')) hog.push('högt blodtryck före graviditeten');
  if (id.has('diabetes')) hog.push('diabetes');
  if (g.paritet === 0) mattlig.push('första förlossningen');
  if (ar >= 40) mattlig.push('40 år eller äldre');
  if (bmi != null && bmi >= 35) mattlig.push('BMI 35 eller mer');
  if (g.antal_foster > 1) mattlig.push('flerbörd');
  if (g.ivf_overforing) mattlig.push('IVF');
  const pe = hog.length || mattlig.length >= 2;
  const preeklampsi = pe
    ? { hog: true, skal: [...hog, ...mattlig], text: `Hög risk för havandeskapsförgiftning (${[...hog, ...mattlig].join(', ')}). Läkaren bedömer om lågdos acetylsalicylsyra ska ges från vecka 12 till vecka 36, och blodtrycket och urinen kontrolleras vid varje besök.` }
    : { hog: false, skal: mattlig, text: 'Ingen hög risk för havandeskapsförgiftning i det som finns i journalen. Blodtrycket och urinen kontrolleras som i basprogrammet.' };
  return { gdm, preeklampsi, bmi: bmi == null ? null : Number(bmi.toFixed(1)) };
}

// Anamnesen från det senaste inskrivningssamtalet. Den hör till graviditetsjournalen och prövas med den.
const lasJsonTidigt = (s, standard) => { try { return JSON.parse(s) ?? standard; } catch { return standard; } };
function anamnesFor(db, g) {
  const s = db.query('SELECT anamnes FROM graviditet_samtal WHERE graviditet_id = ? ORDER BY id DESC').get(g.id);
  return s ? lasJsonTidigt(s.anamnes, {}) : {};
}

// Besöksprogrammet med vad som är gjort och vad som är nästa besök.
export const GDM_PROGRAM = [{ vecka: 13, typ: 'Tidig glukosbelastning (förhöjd risk för graviditetsdiabetes)', prover: ['glukos'] }];
export function program(atk, g, risk, nu = new Date()) {
  const besok = atk.db.query('SELECT dagar FROM graviditet_besok WHERE graviditet_id = ?').all(g.id).map(b => Math.floor(b.dagar / 7));
  // Runda 11, r3: ett ultraljud i ultraljudsjournalen räknas som besöket i programmet, och inskrivningen är gjord när
  // inskrivningssamtalet är registrerat.
  const ul = atk.db.query('SELECT dagar FROM graviditet_ultraljud WHERE graviditet_id = ?').all(g.id).map(b => Math.floor(b.dagar / 7));
  const samtal = Boolean(atk.db.query('SELECT 1 FROM graviditet_samtal WHERE graviditet_id = ?').get(g.id));
  const idag = dagarFor(g, datumAv(nu));
  const gjortFor = (x) => (/ultraljud/i.test(x.typ) ? ul.some(v => Math.abs(v - x.vecka) <= 2) || besok.some(v => Math.abs(v - x.vecka) <= 1)
    : x.vecka === 8 && samtal) || besok.some(v => Math.abs(v - x.vecka) <= 1);
  const lista = [...PROGRAM, ...(g.antal_foster > 1 ? FLERBORD_PROGRAM : []), ...(risk.niva !== 'normal' ? RISK_PROGRAM : []), ...(risk.gdm?.forhojd ? GDM_PROGRAM : [])].sort((a, b) => a.vecka - b.vecka)
    .map(x => ({ ...x, datum: addDagar(g.bpd, x.vecka * 7 - GRAVIDITETSDAGAR), prover: (x.prover ?? []).map(id => ({ analys: id, namn: ANALYS[id].namn })),
      gjort: gjortFor(x) }));
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
    // Runda 11, r3: förlossningen visas bara när den inloggade får se förlossningens vårdenhet.
    forlossning: f && atk.prova('las_graviditet', { enhet_id: f.enhet_id }).tillaten ? forlossningUt(atk, f) : null, demoregel: DEMOREGEL,
    // Runda 11, r3.
    ivf: g.ivf_overforing ? { overforing: g.ivf_overforing, embryoDagar: g.ivf_embryo_dagar } : null, registerMotsatt: Boolean(g.register_motsatt),
    ultraljud: db.query('SELECT * FROM graviditet_ultraljud WHERE graviditet_id = ? ORDER BY datum, id').all(g.id).map(u => ultraljudUt(db, u)),
    inskrivningssamtal: samtalUt(db, db.query('SELECT * FROM graviditet_samtal WHERE graviditet_id = ? ORDER BY id DESC').get(g.id), atk),
    efterkontroll: db.query('SELECT * FROM graviditet_efterkontroll WHERE graviditet_id = ? ORDER BY id DESC').all(g.id).map(e => efterkontrollUt(db, e)),
    sfKurva: sfKurva(db, g), attGora: attGora(db, g, dagar, risk),
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
  // Runda 11, r3: IVF-graviditeten med embryoöverföringens datum och embryots ålder i dagar.
  let ivfDatum = null, ivfDagar = null;
  if (body.ivf) {
    ivfDatum = body.ivf.overforing;
    ivfDagar = Number(body.ivf.embryoDagar);
    if (!giltigtDatum(ivfDatum) || ivfDatum > idag || dagarMellan(ivfDatum, idag) > 290) throw new Fel(400, 'Ange datumet för embryoöverföringen som ÅÅÅÅ-MM-DD, inom de senaste 290 dagarna.', 'ogiltig', { falt: ['ivf.overforing'] });
    if (![2, 3, 5, 6].includes(ivfDagar)) throw new Fel(400, 'Embryots ålder vid överföringen är 2, 3, 5 eller 6 dagar.', 'ogiltig', { falt: ['ivf.embryoDagar'] });
  }
  const b = bpdFor({ sistaMens, ulDatum, ulDagar, ivfDatum, ivfDagar });
  const antal = body.antalFoster == null ? 1 : Number(body.antalFoster);
  if (![1, 2, 3].includes(antal)) throw new Fel(400, 'Antalet foster är 1, 2 eller 3 i demon.', 'ogiltig', { falt: ['antalFoster'] });
  const paritet = Number(body.paritet ?? 0), ks = Number(body.tidigareKejsarsnitt ?? 0);
  if (!Number.isInteger(paritet) || paritet < 0 || paritet > 15) throw new Fel(400, 'Antalet tidigare förlossningar är ett heltal.', 'ogiltig', { falt: ['paritet'] });
  if (!Number.isInteger(ks) || ks < 0 || ks > paritet) throw new Fel(400, 'Tidigare kejsarsnitt kan inte vara fler än tidigare förlossningar.', 'ogiltig', { falt: ['tidigareKejsarsnitt'] });
  const r = db.query(`INSERT INTO graviditeter (patient_id, enhet_id, vardkontakt_id, registrerad_av, skapad, sista_mens, ul_datum, ul_dagar, bpd, bpd_kalla, antal_foster, paritet, tidigare_kejsarsnitt, status, ivf_overforing, ivf_embryo_dagar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pagaende', ?, ?)`).run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), atk.personal.id, iso(nu), sistaMens, ulDatum, ulDagar, b.bpd, b.kalla, antal, paritet, ks, ivfDatum, ivfDagar);
  const g = graviditetRad(db, r.lastInsertRowid);
  return { ...graviditetUt(atk, g, nu), bpdText: b.text };
}

// Ultraljudsjournalen (runda 11, r3). Ett ultraljud till och med vecka 22 daterar graviditeten: beräknad partus räknas
// om när ultraljudet skiljer mer än sju dagar från sista mens. Ett senare ultraljud och ett tillväxtultraljud ändrar
// aldrig beräknad partus. Vid tillväxtultraljudet räknar systemet graviditetslängden ur beräknad partus och jämför den
// skattade vikten med den förväntade för veckan. En IVF-graviditet dateras bara från embryoöverföringen.
export const ULTRALJUDSTYPER = tabell({ kub: 'Tidigt ultraljud (KUB)', rutin: 'Rutinultraljud', tillvaxt: 'Tillväxtultraljud', ovrigt: 'Annat ultraljud' });
export const PLACENTA = tabell({ framvagg: 'Framväggen', bakvagg: 'Bakväggen', fundus: 'Fundus', lagt: 'Lågt sittande', foreliggande: 'Föreliggande' });
export const FOSTERVATTEN = tabell({ normalt: 'Normal mängd', lite: 'Lite fostervatten', mycket: 'Mycket fostervatten' });
export const DATERING_MAX_DAGAR = 22 * 7;
// Förväntad fostervikt i gram per graviditetsvecka (förenklad kurva, demoregel). En avvikelse på 22 procent eller mer
// räknas som liten eller stor för tiden, ungefär två standardavvikelser.
const VIKTKURVA = [[20, 330], [22, 480], [24, 670], [26, 900], [28, 1180], [30, 1500], [32, 1860], [34, 2280], [36, 2730], [38, 3170], [40, 3550], [42, 3800]];
export function forvantadVikt(dagar) {
  const v = dagar / 7;
  if (v <= VIKTKURVA[0][0]) return VIKTKURVA[0][1];
  for (let i = 1; i < VIKTKURVA.length; i++) {
    const [v1, g1] = VIKTKURVA[i], [v0, g0] = VIKTKURVA[i - 1];
    if (v <= v1) return Math.round(g0 + (g1 - g0) * (v - v0) / (v1 - v0));
  }
  return VIKTKURVA.at(-1)[1];
}
export const VIKTAVVIKELSE = 22;

export function ultraljud(atk, g, body = {}, nu = new Date()) {
  const db = atk.db;
  andraGrav(atk, g);
  const datum = body.datum ?? datumAv(nu);
  if (!giltigtDatum(datum) || datum > datumAv(nu)) throw new Fel(400, 'Ultraljudets datum ska vara ett datum som har varit, ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const typ = body.typ ?? 'rutin';
  if (!finns(ULTRALJUDSTYPER, typ)) throw new Fel(400, 'Typen av ultraljud finns inte.', 'ogiltig', { falt: ['typ'] });
  // Tillväxtultraljudet mäter inte graviditetslängden: systemet räknar den ur beräknad partus.
  const dagar = typ === 'tillvaxt' ? dagarFor(g, datum) : Number(body.veckor) * 7 + Number(body.dagar ?? 0);
  if (!Number.isInteger(dagar) || dagar < 42 || dagar > 300) throw new Fel(400, 'Ange graviditetslängden vid ultraljudet i veckor och dagar.', 'ogiltig', { falt: ['veckor'] });
  const antal = [1, 2, 3].includes(Number(body.antalFoster)) ? Number(body.antalFoster) : g.antal_foster;
  if (body.placenta != null && body.placenta !== '' && !finns(PLACENTA, body.placenta)) throw new Fel(400, 'Moderkakans läge finns inte i listan.', 'ogiltig', { falt: ['placenta'] });
  if (body.fostervatten != null && body.fostervatten !== '' && !finns(FOSTERVATTEN, body.fostervatten)) throw new Fel(400, 'Fostervattenmängden finns inte i listan.', 'ogiltig', { falt: ['fostervatten'] });
  const inFoster = Array.isArray(body.foster) ? body.foster.slice(0, 3) : [];
  const varningar = [];
  const foster = [];
  for (let i = 0; i < antal; i++) {
    const f = inFoster[i] && typeof inFoster[i] === 'object' ? inFoster[i] : {};
    const hjarta = f.hjartaktivitet === undefined ? true : f.hjartaktivitet === true;
    let vikt = null, avvikelse = null;
    if (f.skattadVikt != null && f.skattadVikt !== '') {
      vikt = Number(f.skattadVikt);
      if (!Number.isInteger(vikt) || vikt < 100 || vikt > 6000) throw new Fel(400, 'Den skattade vikten anges i hela gram, 100 till 6 000.', 'ogiltig', { falt: ['foster'] });
      avvikelse = Math.round(((vikt - forvantadVikt(dagar)) / forvantadVikt(dagar)) * 100);
    }
    if (typ === 'tillvaxt' && vikt == null) throw new Fel(400, `Ange den skattade vikten${antal > 1 ? ` för foster ${i + 1}` : ''}. Det är den som tillväxtultraljudet följer.`, 'ogiltig', { falt: ['foster'] });
    const namn = antal > 1 ? `Foster ${i + 1}` : 'Fostret';
    if (!hjarta) varningar.push(`${namn}: ingen hjärtaktivitet. Kontakta läkare nu.`);
    if (avvikelse != null && avvikelse <= -VIKTAVVIKELSE) varningar.push(`${namn}: skattad vikt ${vikt} g är ${-avvikelse} procent under den förväntade i vecka ${Math.floor(dagar / 7)} (liten för tiden). Läkaren planerar tätare tillväxtkontroller och flödesmätning.`);
    if (avvikelse != null && avvikelse >= VIKTAVVIKELSE) varningar.push(`${namn}: skattad vikt ${vikt} g är ${avvikelse} procent över den förväntade i vecka ${Math.floor(dagar / 7)} (stor för tiden). Kontrollera glukosbelastningen och planera förlossningen med läkare.`);
    foster.push({ ordning: i + 1, hjartaktivitet: hjarta, skattadVikt: vikt, forvantadVikt: vikt != null ? forvantadVikt(dagar) : null, avvikelse });
  }
  const vikter = foster.map(f => f.skattadVikt).filter(v => v != null);
  if (vikter.length > 1 && (Math.max(...vikter) - Math.min(...vikter)) / Math.max(...vikter) > 0.2) varningar.push('Viktskillnaden mellan fostren är mer än 20 procent. Läkaren bedömer om det kan vara tvillingtransfusion eller tillväxthämning hos ett foster.');
  if (body.placenta === 'foreliggande' && dagar >= 18 * 7) varningar.push('Föreliggande moderkaka: ingen vaginal undersökning. Systemet föreslår ett nytt ultraljud i vecka 32 och planering av förlossningen med läkare.');
  if (body.fostervatten === 'lite') varningar.push('Lite fostervatten. Läkaren bedömer fostrets tillväxt och flöden samma vecka.');
  if (body.fostervatten === 'mycket') varningar.push('Mycket fostervatten. Kontrollera glukosbelastningen och bedöm med läkare.');
  if (antal !== g.antal_foster) varningar.push(`Ultraljudet visar ${antal} foster. Besöksprogrammet räknas om.`);
  const daterar = typ !== 'tillvaxt' && dagar <= DATERING_MAX_DAGAR && !g.ivf_overforing;
  const b = daterar ? bpdFor({ sistaMens: g.sista_mens, ulDatum: datum, ulDagar: dagar })
    : { bpd: g.bpd, kalla: g.bpd_kalla, text: g.ivf_overforing ? 'IVF-graviditeten dateras från embryoöverföringen, så ultraljudet ändrar inte beräknad partus.' : 'Ett ultraljud efter vecka 22 eller ett tillväxtultraljud ändrar inte beräknad partus.' };
  db.transaction(() => {
    db.query(`INSERT INTO graviditet_ultraljud (graviditet_id, patient_id, enhet_id, tid, datum, typ, dagar, antal_foster, foster, placenta, fostervatten, fynd, varningar, datering, av)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(g.id, g.patient_id, atk.personal.enhet_id, iso(nu), datum, typ, dagar, antal, JSON.stringify(foster),
      body.placenta || null, body.fostervatten || null, textFalt(body.fynd, 500) || null, JSON.stringify(varningar), daterar ? 1 : 0, atk.personal.id);
    if (daterar) db.query('UPDATE graviditeter SET ul_datum = ?, ul_dagar = ?, bpd = ?, bpd_kalla = ? WHERE id = ?').run(datum, dagar, b.bpd, b.kalla, g.id);
    if (antal !== g.antal_foster) db.query('UPDATE graviditeter SET antal_foster = ? WHERE id = ?').run(antal, g.id);
  })();
  return { ...graviditetUt(atk, graviditetRad(db, g.id), nu), bpdText: b.text, varningar };
}
function ultraljudUt(db, u) {
  return {
    id: u.id, datum: u.datum, typ: u.typ, typText: ULTRALJUDSTYPER[u.typ] ?? u.typ, vecka: veckaText(u.dagar), antalFoster: u.antal_foster, foster: lasJson(u.foster, []),
    placenta: u.placenta ? PLACENTA[u.placenta] ?? null : null, fostervatten: u.fostervatten ? FOSTERVATTEN[u.fostervatten] ?? null : null, fynd: u.fynd,
    varningar: lasJson(u.varningar, []), datering: Boolean(u.datering), av: personNamn(db, u.av),
  };
}

// Symfys-fundusmåttet per vecka med det förväntade intervallet (veckan plus minus tre centimeter, demoregel).
function sfKurva(db, g) {
  return db.query('SELECT tid, dagar, sf_matt FROM graviditet_besok WHERE graviditet_id = ? AND sf_matt IS NOT NULL ORDER BY tid').all(g.id)
    .map(b => ({ vecka: Number((b.dagar / 7).toFixed(1)), sfMatt: b.sf_matt, undre: Math.floor(b.dagar / 7) - 3, ovre: Math.floor(b.dagar / 7) + 3, avviker: g.antal_foster === 1 && Math.abs(b.sf_matt - Math.floor(b.dagar / 7)) > 3 }));
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

// ---- Inskrivningssamtalet, efterkontrollen och vad som ska göras (runda 11, r3) ------------------------------------------
//
// Frågorna om våld ställs som i mödrahälsovården: till alla, när kvinnan är ensam och utan närstående som tolk. Går
// det inte registreras varför, och systemet påminner vid nästa besök. Svaren sparas bara i graviditet_samtal.kansligt.
// De syns aldrig i graviditetsjournalen, översikten, uppföljningen, datauttaget eller registret, bara för personal med
// handlingen graviditet på den vårdenhet som ställde frågorna, efter ett eget val som loggas. Det som följer med är att
// frågorna är ställda.
export const VALDFRAGOR = [
  { id: 'tidigare', text: 'Har du någon gång blivit utsatt för våld, hot eller kränkningar av någon som står dig nära?' },
  { id: 'nu', text: 'Är du utsatt för våld, hot eller kränkningar nu?' },
  { id: 'radd', text: 'Känner du dig rädd för någon i din närhet?' },
];
export const VALDSVAR = tabell({ nej: 'Nej', ja: 'Ja', vill_ej: 'Vill inte svara' });
export const VALD_EJ_ORSAK = tabell({ inte_ensam: 'Kvinnan var inte ensam vid besöket', tolk_narstaende: 'Tolken var en närstående', annat: 'Annat skäl' });
export const TOBAKSBRUK = tabell({ aldrig: 'Har aldrig använt', slutat_fore: 'Slutade före graviditeten', slutat_under: 'Slutade när graviditeten blev känd', ja: 'Använder nu' });
export const ANAMNES = tabell({ tidigareGdm: 'Graviditetsdiabetes i en tidigare graviditet', tidigarePreeklampsi: 'Havandeskapsförgiftning i en tidigare graviditet',
  arftlighetDiabetes: 'Diabetes hos förälder eller syskon', forlossningsradsla: 'Rädsla inför förlossningen' });
// Smärtlindringen under förlossningen (forlossning.js), här så att önskemålen i förlossningsbrevet använder samma lista.
export const SMARTLINDRING = tabell({ lustgas: 'Lustgas', eda: 'Epiduralbedövning (EDA)', spinal: 'Spinalbedövning', pudendus: 'Pudendusblockad', tens: 'TENS',
  sterilvatten: 'Sterilvattenkvaddlar', akupunktur: 'Akupunktur', bad: 'Varmt bad', ingen: 'Ingen smärtlindring' });
export const AMNING = tabell({ helt: 'Helamning', delvis: 'Delvis amning', ingen: 'Ingen amning' });
export const BLODNING = tabell({ ingen: 'Ingen blödning', lite: 'Lite blödning', mycket: 'Riklig blödning' });
export const EPDS_GRANS = 12;

export function samtal(atk, g, body = {}, nu = new Date()) {
  const db = atk.db;
  andraGrav(atk, g);
  if (g.status !== 'pagaende') throw new Fel(409, 'Graviditeten är avslutad.', 'ogiltig');
  const anamnes = {};
  for (const k of Object.keys(ANAMNES)) anamnes[k] = body.anamnes?.[k] === true;
  const tobak = {};
  for (const k of ['rokning', 'snus']) {
    if (!finns(TOBAKSBRUK, body.tobak?.[k])) throw new Fel(400, `Svara på frågan om ${k === 'rokning' ? 'rökning' : 'snus'}. Graviditetsregistret följer tobaksbruket vid inskrivningen.`, 'ogiltig', { falt: [`tobak.${k}`] });
    tobak[k] = body.tobak[k];
  }
  const ensam = body.vald?.ensam === true;
  let kansligt = null, orsak = null;
  if (ensam) {
    const svar = {};
    for (const q of VALDFRAGOR) {
      const s = body.vald?.svar?.[q.id];
      if (!finns(VALDSVAR, s)) throw new Fel(400, `Svara på frågan: ${q.text} Hon kan också välja att inte svara.`, 'ogiltig', { falt: [`vald.${q.id}`] });
      svar[q.id] = s;
    }
    kansligt = JSON.stringify(svar);
  } else {
    orsak = body.vald?.orsak;
    if (!finns(VALD_EJ_ORSAK, orsak)) throw new Fel(400, 'Frågorna om våld ställs bara när kvinnan är ensam. Ange varför de inte kunde ställas, så påminner systemet vid nästa besök.', 'ogiltig', { falt: ['vald.orsak'] });
  }
  const smart = Array.isArray(body.onskemal?.smartlindring) ? [...new Set(body.onskemal.smartlindring.filter(m => finns(SMARTLINDRING, m)))] : [];
  const onskemal = { text: textFalt(body.onskemal?.text, 1000), smartlindring: smart };
  const varningar = [];
  if (tobak.rokning === 'ja') varningar.push('Hon röker. Erbjud stöd att sluta. Rökning under graviditeten ökar risken för tillväxthämning, för tidig förlossning och plötslig spädbarnsdöd.');
  if (tobak.snus === 'ja') varningar.push('Hon snusar. Erbjud stöd att sluta. Nikotin under graviditeten påverkar fostret.');
  const alk = body.levnadsvanor?.alkohol;
  if (alk && (Number(alk.glasPerVecka) > 0 || (alk.berusning && alk.berusning !== 'aldrig'))) varningar.push('Hon dricker alkohol. Under graviditeten är rådet att inte dricka alls. Systemet föreslår ett rådgivande samtal om alkohol.');
  if (anamnes.forlossningsradsla) varningar.push('Rädsla inför förlossningen. Systemet föreslår samtal med en barnmorska eller kurator som arbetar med förlossningsrädsla, och att önskemålen skrivs i förlossningsbrevet.');
  if (kansligt) {
    const s = JSON.parse(kansligt);
    if (s.nu === 'ja' || s.radd === 'ja') varningar.push('Hon är utsatt eller rädd nu. Erbjud samtal med kurator och hjälp med en säkerhetsplan, och informera om stödlinjer för den som utsätts för våld. Svaren syns bara här på mödrahälsovården och visas inte för andra.');
    else if (s.tidigare === 'ja') varningar.push('Hon har varit utsatt tidigare. Erbjud samtal med kurator. Svaren syns bara här på mödrahälsovården.');
  }
  let anteckningId = null;
  db.transaction(() => {
    // Levnadsvanorna blir en anteckning av typen Levnadsvanor, så att de registreras en gång och syns i journalen.
    if (body.levnadsvanor) {
      const j = journal();
      const a = j.skapaAnteckning(atk, { typ: 'Levnadsvanor', vardkontaktId: vardkontaktFor(atk, nu), levnadsvanor: body.levnadsvanor });
      j.signera(atk, j.hamtaAnteckningRad(db, a.id));
      anteckningId = a.id;
    }
    db.query(`INSERT INTO graviditet_samtal (graviditet_id, patient_id, enhet_id, tid, av, anteckning_id, anamnes, tobak, vald_stalld, vald_orsak, kansligt, onskemal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(g.id, g.patient_id, atk.personal.enhet_id, iso(nu), atk.personal.id, anteckningId, JSON.stringify(anamnes), JSON.stringify(tobak),
      ensam ? 1 : 0, orsak, kansligt, JSON.stringify(onskemal));
  })();
  return { ...graviditetUt(atk, graviditetRad(db, g.id), nu), varningar,
    text: ensam ? 'Inskrivningssamtalet är registrerat. Svaren om våld är sparade som känsliga uppgifter.' : 'Inskrivningssamtalet är registrerat. Systemet påminner om frågorna om våld vid nästa besök.' };
}

function samtalUt(db, s, atk = null) {
  if (!s) return null;
  const tobak = lasJson(s.tobak, {}) ?? {};
  const an = lasJson(s.anamnes, {}) ?? {};
  const on = lasJson(s.onskemal, {}) ?? {};
  return {
    id: s.id, tid: s.tid, av: personNamn(db, s.av), anteckningId: s.anteckning_id,
    anamnes: Object.keys(ANAMNES).filter(k => an[k]).map(k => ({ id: k, text: ANAMNES[k] })),
    tobak: { rokning: tobak.rokning ?? null, rokningText: TOBAKSBRUK[tobak.rokning] ?? null, snus: tobak.snus ?? null, snusText: TOBAKSBRUK[tobak.snus] ?? null },
    valdfragan: { stalld: Boolean(s.vald_stalld), orsak: s.vald_orsak ? VALD_EJ_ORSAK[s.vald_orsak] ?? null : null, kanLasaSvar: Boolean(s.vald_stalld && atk && kanRoll(atk.personal, 'graviditet') && vardenhetFor(db, atk.personal.enhet_id) === vardenhetFor(db, s.enhet_id)) },
    onskemal: { text: on.text ?? '', smartlindring: (on.smartlindring ?? []).map(m => ({ id: m, text: SMARTLINDRING[m] })) },
  };
}

// Svaren på frågorna om våld. Bara på den vårdenhet som ställde frågorna och med handlingen graviditet. Läsningen loggas
// med en egen resurs, så att logguppföljningen ser vem som har läst svaren.
export function valdsvar(atk, g) {
  const db = atk.db;
  lasRad(atk, g, 'las_graviditet');
  const s = db.query('SELECT * FROM graviditet_samtal WHERE graviditet_id = ? AND vald_stalld = 1 ORDER BY id DESC').get(g.id);
  if (!s) throw new Fel(404, 'Frågorna om våld är inte ställda i den här graviditeten.', 'saknas');
  andraRad(atk, s, 'graviditet', 'las_graviditet', 'Svaren på frågorna om våld syns bara för mödrahälsovården på den vårdenhet som ställde dem.');
  const svar = lasJson(s.kansligt, {}) ?? {};
  atk.logga('graviditet', atk.grund(), `graviditet:${g.id}:valdfragor`);
  return { tid: s.tid, av: personNamn(db, s.av), svar: VALDFRAGOR.map(q => ({ fraga: q.text, svar: VALDSVAR[svar[q.id]] ?? null })),
    text: 'Svaren är känsliga uppgifter. De visas bara här och läsningen loggas.' };
}

export function efterkontroll(atk, g, body = {}, nu = new Date()) {
  const db = atk.db;
  andraGrav(atk, g);
  if (g.status !== 'forlost') throw new Fel(409, 'Efterkontrollen registreras efter förlossningen.', 'ogiltig');
  const epds = Number(body.epds), f10 = Number(body.epdsFraga10 ?? 0);
  if (!Number.isInteger(epds) || epds < 0 || epds > 30) throw new Fel(400, 'EPDS-poängen är ett heltal mellan 0 och 30.', 'ogiltig', { falt: ['epds'] });
  if (!Number.isInteger(f10) || f10 < 0 || f10 > 3 || f10 > epds) throw new Fel(400, 'Poängen på fråga 10 i EPDS (tankar på att skada sig själv) är 0 till 3.', 'ogiltig', { falt: ['epdsFraga10'] });
  if (!finns(AMNING, body.amning)) throw new Fel(400, 'Ange hur amningen går.', 'ogiltig', { falt: ['amning'] });
  if (!finns(BLODNING, body.blodning ?? 'ingen')) throw new Fel(400, 'Blödningen finns inte i listan.', 'ogiltig', { falt: ['blodning'] });
  const varningar = [];
  if (f10 > 0) varningar.push('Hon har haft tankar på att skada sig själv. Kontakta läkare i dag och stanna kvar tills hon har fått hjälp.');
  else if (epds >= EPDS_GRANS) varningar.push(`EPDS ${epds} poäng tyder på nedstämdhet efter förlossningen (${EPDS_GRANS} poäng eller mer). Erbjud stödsamtal och kontakta läkare.`);
  if (body.blodning === 'mycket') varningar.push('Riklig blödning efter förlossningen. Kontakta läkare samma dag.');
  if (body.bristningLakt === false) varningar.push('Bristningen har inte läkt. Remittera till kvinnokliniken.');
  db.query(`INSERT INTO graviditet_efterkontroll (graviditet_id, patient_id, enhet_id, tid, av, epds, epds_fraga10, amning, blodning, bristning_lakt, preventivmedel, varningar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(g.id, g.patient_id, atk.personal.enhet_id, iso(nu), atk.personal.id, epds, f10, body.amning, body.blodning ?? 'ingen',
    body.bristningLakt == null ? null : body.bristningLakt ? 1 : 0, textFalt(body.preventivmedel, 200) || null, JSON.stringify(varningar));
  return { ...graviditetUt(atk, graviditetRad(db, g.id), nu), varningar };
}
function efterkontrollUt(db, e) {
  return { id: e.id, tid: e.tid, av: personNamn(db, e.av), epds: e.epds, epdsFraga10: e.epds_fraga10, amning: AMNING[e.amning] ?? e.amning, blodning: BLODNING[e.blodning] ?? e.blodning,
    bristningLakt: e.bristning_lakt == null ? null : Boolean(e.bristning_lakt), preventivmedel: e.preventivmedel, varningar: lasJson(e.varningar, []) };
}

// Det som systemet föreslår att barnmorskan gör, räknat ur graviditetsjournalen.
function attGora(db, g, dagar, risk) {
  const ut = [];
  if (g.status === 'pagaende') {
    const s = db.query('SELECT vald_stalld FROM graviditet_samtal WHERE graviditet_id = ? ORDER BY id DESC').get(g.id);
    if (!s) ut.push('Registrera inskrivningssamtalet med anamnes, levnadsvanor, tobak och frågorna om våld.');
    else if (!s.vald_stalld) ut.push('Ställ frågorna om våld vid nästa besök, när hon är ensam.');
    if (dagar >= 20 * 7 && !db.query("SELECT 1 FROM graviditet_ultraljud WHERE graviditet_id = ? AND typ IN ('rutin', 'kub')").get(g.id)) ut.push('Rutinultraljudet är inte registrerat i ultraljudsjournalen.');
    if (risk.preeklampsi?.hog) ut.push('Hög risk för havandeskapsförgiftning: läkaren bedömer lågdos acetylsalicylsyra.');
    if (dagar > GRAVIDITETSDAGAR) ut.push('Beräknad partus har passerats. Boka läkarbesök och planera för igångsättning.');
  } else if (g.status === 'forlost' && !db.query('SELECT 1 FROM graviditet_efterkontroll WHERE graviditet_id = ?').get(g.id)) {
    ut.push('Boka efterkontrollen 6 till 12 veckor efter förlossningen.');
  }
  return ut;
}

// Mödrahälsovården och förlossningen i demon. En vårdenhet med barnmorskemottagning och en kvinnoklinik med förlossning
// och BB (demoregel: i en riktig installation är det en egenskap hos vårdenheten i HSA).
export const MHV_VARDENHETER = ['vc-tybble'];
export const FORLOSSNING_VARDENHETER = ['uso-kk'];
export function session(db, personal) {
  if (!personal || !['lakare', 'sjukskoterska'].includes(personal.yrke) || !kanRoll(personal, 'las_graviditet')) return null;
  const ve = vardenhetFor(db, personal.enhet_id);
  const mhv = MHV_VARDENHETER.includes(ve), forlossning = FORLOSSNING_VARDENHETER.includes(ve);
  return mhv || forlossning ? { mhv, forlossning } : null;
}
const kravEnhet = (db, personal, lista, text) => {
  if (!personal || !lista.includes(vardenhetFor(db, personal.enhet_id)) || !kanRoll(personal, 'las_graviditet')) throw new Fel(403, text, 'nekad');
};
export const kravMhv = (db, personal) => kravEnhet(db, personal, MHV_VARDENHETER, 'Mödrahälsovårdens sida är för personalen på en vårdenhet med barnmorskemottagning.');
export const kravForlossning = (db, personal) => kravEnhet(db, personal, FORLOSSNING_VARDENHETER, 'Förlossningens sida är för personalen på kvinnokliniken.');

// Mödrahälsovårdens översikt: graviditeterna på vårdenheten med vecka, risk, nästa besök, varningar och det som ska
// göras. Bara det som den inloggade får se, och varje patient som visas loggas.
export function mhvOversikt(db, personal, valFor = () => ({}), nu = new Date()) {
  sakra(db);
  kravMhv(db, personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const rader = db.query(`SELECT * FROM graviditeter WHERE enhet_id IN (${ph}) AND (status = 'pagaende' OR (status = 'forlost' AND id NOT IN (SELECT graviditet_id FROM graviditet_efterkontroll))) ORDER BY bpd`).all(...enheter);
  const ut = [];
  for (const g of rader) {
    const atk = new Atkomst(db, personal, g.patient_id, valFor(g.patient_id), 'las_graviditet');
    if (!atk.prova('las_graviditet', { enhet_id: g.enhet_id }).tillaten) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(g.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const risk = riskbedomning(atk, g, nu);
    const dagar = dagarFor(g, datumAv(nu));
    const senaste = db.query('SELECT varningar FROM graviditet_besok WHERE graviditet_id = ? ORDER BY tid DESC, id DESC').get(g.id);
    const ul = db.query('SELECT varningar FROM graviditet_ultraljud WHERE graviditet_id = ? ORDER BY datum DESC, id DESC').get(g.id);
    loggaPatient(db, personal, g.patient_id, 'las_graviditet', atk.grund(), 'modrahalsovard:oversikt');
    ut.push({ patientId: p.id, namn: visningsnamn(p), graviditetId: g.id, status: g.status, vecka: g.status === 'pagaende' ? veckaText(Math.max(0, dagar)) : null, bpd: g.bpd,
      antalFoster: g.antal_foster, risk: { niva: risk.niva, namn: risk.namn }, nasta: g.status === 'pagaende' ? program(atk, g, risk, nu).nasta : null,
      varningar: [...lasJson(senaste?.varningar, []) ?? [], ...lasJson(ul?.varningar, []) ?? []], attGora: attGora(db, g, dagar, risk) });
  }
  return { vardenhet: enhetKort(db, ve), graviditeter: ut, antal: { pagaende: ut.filter(x => x.status === 'pagaende').length, efterkontroll: ut.filter(x => x.status === 'forlost').length },
    text: 'Graviditeterna på vårdenheten i ordning efter beräknad partus. Systemet räknar veckan, risken och nästa besök och säger vad som ska göras.', demoregel: DEMOREGEL };
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

// Runda 11, r3, säkerhetsgranskningen: den gemensamma prövningen av ett barn som föddes i en förlossning. Barnet är en
// egen patient: det finns, är inte sammanslaget med en annan journal och den som frågar får se barnets journal på
// förlossningens vårdenhet i behörighetsmotorn. Alla vägar i obstetrik.js, forlossning.js och graviditetsregistret.js
// prövar barnen med den här funktionen. Valet att visa andra enheters uppgifter gäller bara barnets egen journal.
export function barnSynligt(db, personal, b, val = {}) {
  const p = db.query('SELECT id, sammanslagen_till FROM patienter WHERE id = ?').get(b.barn_patient_id);
  if (!p || p.sammanslagen_till) return false;
  return new Atkomst(db, personal, p.id, val, 'las_graviditet').prova('las_graviditet', { enhet_id: b.enhet_id }).tillaten;
}
export const synligaBarn = (atk, f) => atk.db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f.id)
  .filter(b => barnSynligt(atk.db, atk.personal, b, atk.patientId === b.barn_patient_id ? atk.val : {}));
export const allaBarnSynliga = (atk, f) => synligaBarn(atk, f).length === atk.db.query('SELECT count(*) AS n FROM forlossning_barn WHERE forlossning_id = ?').get(f.id).n;

export function forlossningUt(atk, f) {
  const db = atk.db;
  const punkter = partogramUt(db.query('SELECT * FROM partogram WHERE forlossning_id = ? ORDER BY tid, id').all(f.id));
  const sista = punkter.at(-1);
  // Runda 11, r3: barnet är en egen patient och visas bara när den inloggade får se barnets journal (synligaBarn).
  const barn = synligaBarn(atk, f);
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

