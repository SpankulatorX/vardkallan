// Anestesi och intensivvård (runda 9, r2, Sussa 4.6.1.1 till 4.6.1.7). Bygger på mätvärdena, utrustningen
// (medicinteknik.js), läkemedlen och vätskebalansen som redan finns.
//
//   Översikt och övervakning (4.6.1.2): en översikt över alla patienter på intensivvårdsavdelningen och en
//     övervakningsvy per patient med täta värden från den kopplade monitorn, infusionerna och vätskebalansen.
//   Analys och beslut (4.6.1.3): fördefinierade parametrar med gränser och trender (IVA_REGLER och parametrarna i
//     konfiguration.js) som systemet själv prövar mot de senaste värdena och omsätter i larm och förslag.
//   Anestesibedömning (4.6.1.4): ASA-klass, luftväg, tidigare anestesier, fasta, läkemedel och överkänslighet, där
//     systemet hämtar det som redan står i journalen och föreslår ASA-klass och fastetider.
//   Läkemedel (4.6.1.5): kontinuerlig infusion i sprutpump med dos per kilo och timme, där systemet räknar hastigheten
//     i ml/h ur vikten och koncentrationen, föreslår titrering efter mätvärden och visar infusioner, bolusar och vätskor
//     i en gemensam vy.
//   Vätskebalans (4.6.1.6): timvis och kumulativ balans, urin och dränage per timme och urin i ml per kilo och timme.
//   Uppföljning (4.6.1.7): vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning, utan
//     personuppgifter.
//
// Systemet är experten: allt som går att räkna ut ur journalen räknas av systemet, och bara kvalitetssäkrade värden
// (mt-klass.js) används i larm, förslag och doser. Reglerna är demoregler och inte kliniskt beslutsstöd.
import { Fel, iso, addDagar, idag } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn, visningsPnr, alder } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as vardkontakt from './vardkontakt.js';
import * as vitalparametrar from './vitalparametrar.js';
import { kravVardande, synligaAdministreringar } from './administrering.js';
import * as stod from './lakemedelsstod.js';
import * as konfiguration from './konfiguration.js';
import * as mt from './medicinteknik.js';
import { kvalitetssakrad } from './mt-klass.js';
// Runda 11, r2: samma prövning som när operationen ändras.
import { andraRad } from './specialist-hjalp.js';

export const DEMOREGEL = 'Reglerna för intensivvården är demoregler för att visa flödet. De är inte kliniskt beslutsstöd och inte CE-märkta.';
// Intensivvårdsavdelningarna i demon och antalet vårdplatser. Hjärtintensiven på Kardiologiska kliniken är demons
// intensivvårdsavdelning.
export const IVA_ENHETER = { 'uso-kard-hia': { platser: 8 } };
// Standardvärdena för parametrarna i konfiguration.js (samma värden, testat).
export const STANDARD = { mapLag: 65, saturationLag: 90, trendMinuter: 60, oliguriTimmar: 2 };
export const FASTA = { fastFodaTimmar: 6, klaraDryckerTimmar: 2, kalla: 'Svensk förening för anestesi och intensivvård, riktlinje för preoperativ fasta (demo)' };
// Infusionsprotokoll som läkaren väljer ur. Systemet fyller i koncentration, intervall, bolus och titrering.
export const PROTOKOLL = [
  {
    id: 'morfin', namn: 'Morfin, kontinuerlig infusion', lakemedelId: 'VK-NPL-0031', koncentration: 1, koncEnhet: 'mg/ml', dosEnhet: 'mg/kg/h',
    dosMin: 0.01, dosMax: 0.04, startdos: 0.02, bolusDos: 2, maxDygn: 100,
    spadning: 'Morfin Abcur 10 mg/ml späds till 1 mg/ml i natriumklorid 9 mg/ml, 50 ml spruta.',
    titrering: { parameter: 'smarta', lag: 0, hog: 3, steg: 0.005, okarVidHogt: true, sakerhet: { parameter: 'andningsfrekvens', under: 10 } },
  },
];
export const IVA_REGLER = [
  { id: 'map_lag', text: 'Medelartärtrycket (MAP) under gränsen i två värden i rad ger larm, i ett värde varning.' },
  { id: 'map_trend', text: 'MAP som har sjunkit med minst 20 procent under trendfönstret ger varning.' },
  { id: 'saturation_lag', text: 'Syremättnad under gränsen ger larm.' },
  { id: 'puls', text: 'Puls över 130 eller under 40 ger larm, över 110 varning.' },
  { id: 'andningsfrekvens', text: 'Andningsfrekvens över 30 eller under 8 ger larm.' },
  { id: 'feber', text: 'Temperatur 38,5 °C eller mer ger varning.' },
  { id: 'oliguri', text: 'Urin under 0,5 ml per kilo och timme under oligurifönstret ger varning (KDIGO).' },
  { id: 'balans', text: 'En kumulativ vätskebalans över 2 000 ml det senaste dygnet ger en observation.' },
  { id: 'titrering', text: 'Ett mätvärde utanför infusionens titreringsmål ger ett förslag på ny dos inom det ordinerade intervallet.' },
  { id: 'ej_godkant', text: 'Värden från monitorn som skulle ge larm men inte är godkända ger en observation om att granska dem.' },
];
const MIN = 60_000;
const TIMME = 3600_000;
const DAG = 86400_000;
const talSv = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));

export const SCHEMA = `
-- Kontinuerliga infusioner (4.6.1.5). Raden hör till ordinationen och ändras aldrig. vikt_kg är vikten som dosen räknades
-- på, titrering är JSON med parametern, målet och steget.
CREATE TABLE IF NOT EXISTS iva_infusioner (
  ordination_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, protokoll TEXT, koncentration REAL NOT NULL, konc_enhet TEXT NOT NULL,
  dos_enhet TEXT NOT NULL, dos_min REAL NOT NULL, dos_max REAL NOT NULL, startdos REAL NOT NULL, bolus_dos REAL, max_dygn REAL, titrering TEXT, vikt_kg REAL NOT NULL,
  skapad TEXT NOT NULL, av TEXT NOT NULL, CHECK (koncentration > 0), CHECK (dos_min > 0 AND dos_max >= dos_min AND startdos >= dos_min AND startdos <= dos_max)
);
CREATE TRIGGER IF NOT EXISTS iva_infusioner_andras_ej BEFORE UPDATE OF ordination_id, enhet_id, koncentration, konc_enhet, dos_enhet, dos_min, dos_max, startdos, bolus_dos, max_dygn, titrering, vikt_kg ON iva_infusioner
  BEGIN SELECT RAISE(ABORT, 'En infusion ändras genom en ny ordination'); END;
-- Titreringen: varje ändring av dosen inom det ordinerade intervallet, med vem och varför.
CREATE TABLE IF NOT EXISTS iva_titreringar (
  id INTEGER PRIMARY KEY, ordination_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, dos REAL NOT NULL, av TEXT NOT NULL, grund TEXT
);
CREATE INDEX IF NOT EXISTS ix_iva_titr_ord ON iva_titreringar (ordination_id);
CREATE TRIGGER IF NOT EXISTS iva_titreringar_andras_ej BEFORE UPDATE OF ordination_id, enhet_id, tid, dos, av, grund ON iva_titreringar
  BEGIN SELECT RAISE(ABORT, 'En titrering ändras inte'); END;
-- Anestesibedömningen (4.6.1.4). underlag är JSON med det som systemet hämtade ur journalen när bedömningen gjordes.
CREATE TABLE IF NOT EXISTS anestesibedomningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, ingrepp TEXT NOT NULL, planerad TEXT, asa INTEGER NOT NULL,
  akut INTEGER NOT NULL DEFAULT 0, anestesiform TEXT NOT NULL, luftvag TEXT NOT NULL, fasta TEXT, underlag TEXT NOT NULL, kommentar TEXT, tid TEXT NOT NULL, av TEXT NOT NULL,
  CHECK (asa BETWEEN 1 AND 5)
);
CREATE TRIGGER IF NOT EXISTS anestesibedomningar_andras_ej BEFORE UPDATE OF enhet_id, ingrepp, planerad, asa, akut, anestesiform, luftvag, fasta, underlag, kommentar, tid, av ON anestesibedomningar
  BEGIN SELECT RAISE(ABORT, 'En anestesibedömning ändras inte. Gör en ny bedömning.'); END;
CREATE TRIGGER IF NOT EXISTS anestesibedomningar_raderas_ej BEFORE DELETE ON anestesibedomningar
  BEGIN SELECT RAISE(ABORT, 'En anestesibedömning raderas inte'); END;
-- Runda 11, r2: bedömningens koppling till operationsanmälan, samtycket, giltighetstiden, riskskalorna och informationen
-- till patienten. Ändras inte, som bedömningen.
CREATE TABLE IF NOT EXISTS anestesi_tillagg (
  bedomning_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, anmalan_id INTEGER, samtycke TEXT, giltig_till TEXT NOT NULL,
  skalor TEXT NOT NULL, patientinformation TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_anestesi_tillagg_anm ON anestesi_tillagg (anmalan_id);
CREATE TRIGGER IF NOT EXISTS anestesi_tillagg_andras_ej BEFORE UPDATE ON anestesi_tillagg BEGIN SELECT RAISE(ABORT, 'En anestesibedömning ändras inte. Gör en ny bedömning.'); END;
CREATE TRIGGER IF NOT EXISTS anestesi_tillagg_raderas_ej BEFORE DELETE ON anestesi_tillagg BEGIN SELECT RAISE(ABORT, 'En anestesibedömning raderas inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }
const finns = (db) => harTabell(db, 'iva_infusioner');

// Parametrarna för analysen ur konfigurationen (systemförvaltaren kan ändra dem).
export function parametrar(db, nu = new Date()) {
  return {
    mapLag: konfiguration.varde(db, 'iva.map_lag', nu), saturationLag: konfiguration.varde(db, 'iva.saturation_lag', nu),
    trendMinuter: konfiguration.varde(db, 'iva.trend_minuter', nu), oliguriTimmar: konfiguration.varde(db, 'iva.oliguri_timmar', nu),
  };
}

// Intensivvårdsavdelningarna under användarens vårdenhet.
export function ivaEnheter(db, personal) {
  if (!personal) return [];
  const under = new Set(enheterUnder(db, vardenhetFor(db, personal.enhet_id)));
  return Object.keys(IVA_ENHETER).filter(id => under.has(id) && db.query('SELECT 1 FROM enheter WHERE id = ?').get(id)).map(id => ({ id, namn: enhetsnamn(db, id), platser: IVA_ENHETER[id].platser }));
}
// Intensivvårdens sida i menyn är för läkare, sjuksköterskor och undersköterskor på en vårdenhet med intensivvårdsavdelning.
export const session = (db, personal) => (['lakare', 'sjukskoterska', 'underskoterska'].includes(personal?.yrke) && kanRoll(personal, 'las_matvarden') && ivaEnheter(db, personal).length ? { enheter: ivaEnheter(db, personal) } : null);

// Medelartärtrycket ur ett blodtryck.
export const map = (bt) => { const [s, d] = String(bt).split('/').map(Number); return Number.isFinite(s) && Number.isFinite(d) ? Math.round((s + 2 * d) / 3) : null; };
const tal = (m) => (m.typ === 'blodtryck' ? map(m.varde) : m.varde_num ?? Number(m.varde));

// --- Analys och beslut (4.6.1.3) -----------------------------------------------------------------------------------
// Prövar reglerna mot värdena. rader är de mätvärden som användaren får se (nyast först eller i valfri ordning),
// vatska resultatet av vatskaTimvis och infusioner resultatet av infusionerFor. Ger en lista med niva (larm, varning,
// forslag, observation), regel, text och vad som ska göras.
export function analysera({ rader, vatska = null, infusioner = [], params = STANDARD, nu = new Date() }) {
  const ut = [];
  const lagg = (niva, regel, text, gora = null) => ut.push({ niva, regel, text, ...(gora ? { gora } : {}) });
  const ordnade = [...rader].sort((a, b) => b.tid.localeCompare(a.tid) || b.id - a.id);
  const godkanda = ordnade.filter(kvalitetssakrad).filter(m => Date.parse(m.tid) <= nu.getTime() && Date.parse(m.tid) > nu.getTime() - 6 * TIMME);
  const av = (typ) => godkanda.filter(m => m.typ === typ);
  const bt = av('blodtryck');
  const maps = bt.map(m => ({ m, v: map(m.varde) })).filter(x => x.v != null);
  if (maps.length) {
    const [a, b] = maps;
    if (a.v < params.mapLag && b && b.v < params.mapLag && Date.parse(a.m.tid) - Date.parse(b.m.tid) <= TIMME) {
      lagg('larm', 'map_lag', `MAP ${a.v} mmHg kl. ${klocka(a.m.tid)} och ${b.v} mmHg kl. ${klocka(b.m.tid)}, under ${params.mapLag} mmHg.`, 'Bedöm cirkulationen nu och kontakta ansvarig läkare. Följ ordinationen för vätska eller cirkulatoriskt stöd.');
    } else if (a.v < params.mapLag) {
      lagg('varning', 'map_lag', `MAP ${a.v} mmHg kl. ${klocka(a.m.tid)}, under ${params.mapLag} mmHg.`, 'Kontrollera blodtrycket igen inom 15 minuter.');
    }
    const fore = maps.find(x => Date.parse(a.m.tid) - Date.parse(x.m.tid) >= params.trendMinuter * MIN && Date.parse(a.m.tid) - Date.parse(x.m.tid) <= params.trendMinuter * MIN * 2);
    if (fore && a.v <= fore.v * 0.8) {
      lagg('varning', 'map_trend', `MAP har sjunkit från ${fore.v} till ${a.v} mmHg (${Math.round((1 - a.v / fore.v) * 100)} procent) sedan kl. ${klocka(fore.m.tid)}.`, 'Bedöm orsaken till blodtrycksfallet.');
    }
  }
  const sist = (typ) => av(typ)[0] ?? null;
  const sat = sist('saturation');
  if (sat && sat.varde_num < params.saturationLag) lagg('larm', 'saturation_lag', `Syremättnad ${sat.varde_num} % kl. ${klocka(sat.tid)}, under ${params.saturationLag} %.`, 'Kontrollera luftväg och syrgas och kontakta ansvarig läkare.');
  const puls = sist('puls');
  if (puls && (puls.varde_num > 130 || puls.varde_num < 40)) lagg('larm', 'puls', `Puls ${puls.varde_num} slag/min kl. ${klocka(puls.tid)}.`, 'Ta EKG och kontakta ansvarig läkare.');
  else if (puls && puls.varde_num > 110) lagg('varning', 'puls', `Puls ${puls.varde_num} slag/min kl. ${klocka(puls.tid)}.`);
  const af = sist('andningsfrekvens');
  if (af && (af.varde_num > 30 || af.varde_num < 8)) lagg('larm', 'andningsfrekvens', `Andningsfrekvens ${af.varde_num} andetag/min kl. ${klocka(af.tid)}.`, 'Bedöm andningen och kontakta ansvarig läkare.');
  const temp = sist('temp');
  if (temp && temp.varde_num >= 38.5) lagg('varning', 'feber', `Temperatur ${talSv(temp.varde_num)} °C kl. ${klocka(temp.tid)}.`, 'Överväg odlingar enligt ordination.');
  if (vatska?.oliguri) lagg('varning', 'oliguri', vatska.oliguri.text, 'Kontrollera katetern och kontakta ansvarig läkare.');
  if (vatska && vatska.balans > 2000) lagg('observation', 'balans', `Vätskebalansen är +${talSv(vatska.balans, 0)} ml det senaste dygnet.`, 'Bedöm vätskestatus vid nästa rond.');
  for (const i of infusioner) if (i.titrering?.forslag) lagg(i.titrering.niva ?? 'forslag', 'titrering', i.titrering.text, i.titrering.gora);
  // Värden från monitorn som inte är godkända räknas inte, men systemet säger till om de skulle ha gett larm.
  const ejGodkanda = ordnade.filter(m => !kvalitetssakrad(m) && m.kalla === 'utrustning' && Date.parse(m.tid) > nu.getTime() - TIMME);
  const larmande = ejGodkanda.filter(m => (m.typ === 'blodtryck' && map(m.varde) < params.mapLag) || (m.typ === 'saturation' && m.varde_num < params.saturationLag)
    || (m.typ === 'puls' && (m.varde_num > 130 || m.varde_num < 40)) || (m.typ === 'andningsfrekvens' && (m.varde_num > 30 || m.varde_num < 8)));
  if (larmande.length) {
    const m = larmande[0];
    lagg('observation', 'ej_godkant', `Monitorn visar ${journal.MATTYPER[m.typ].namn.toLowerCase()} ${m.typ === 'blodtryck' ? `${m.varde} (MAP ${map(m.varde)})` : m.varde_num} kl. ${klocka(m.tid)}. Värdet är inte godkänt, så systemet räknar inte med det.`, 'Granska värdena från monitorn och godkänn dem om de stämmer.');
  }
  const ordning = { larm: 0, varning: 1, forslag: 2, observation: 3 };
  return ut.sort((x, y) => ordning[x.niva] - ordning[y.niva]);
}

// --- Vätskebalans (4.6.1.6) -----------------------------------------------------------------------------------------
// Timvis och kumulativ balans de senaste timmarna, med urin och dränage per timme och urin per kilo och timme. Samma
// synlighet som vätskebalansen i övrigt: volym från en dos syns bara för den som får se dosen, och makulerade poster
// räknas inte.
export function vatskaTimvis(atk, { timmar = 24 } = {}, nu = new Date()) {
  atk.krav('las_matvarden');
  const db = atk.db;
  const till = Math.ceil(nu.getTime() / TIMME) * TIMME;
  const fran = till - timmar * TIMME;
  const synligaDoser = new Set(synligaAdministreringar(atk).map(a => a.id));
  const makDos = stod.makulerade(db, 'administrering', atk.patientId);
  const rader = atk.filtrera(db.query('SELECT * FROM vatskebalans WHERE patient_id = ? ORDER BY tid, id').all(atk.patientId), 'las_matvarden')
    .filter(r => r.administrering_id == null || (synligaDoser.has(r.administrering_id) && !makDos.has(r.administrering_id)))
    .filter(r => !stod.makuleringFor(db, 'vatskebalans', r.id))
    .filter(r => Date.parse(r.tid) >= fran && Date.parse(r.tid) < till);
  const vikt = senasteVikt(atk);
  let kum = 0;
  const per = [];
  for (let t = fran; t < till; t += TIMME) {
    const i = rader.filter(r => Date.parse(r.tid) >= t && Date.parse(r.tid) < t + TIMME);
    const sum = (f) => Math.round(i.filter(f).reduce((s, r) => s + r.volym_ml, 0) * 10) / 10;
    const inn = sum(r => r.riktning === 'in');
    const ut = sum(r => r.riktning === 'ut');
    const urin = sum(r => r.riktning === 'ut' && r.typ === 'urin');
    kum = Math.round((kum + inn - ut) * 10) / 10;
    per.push({ fran: new Date(t).toISOString(), in: inn, ut, urin, dran: sum(r => r.riktning === 'ut' && r.typ === 'dran'), balans: Math.round((inn - ut) * 10) / 10, kumulativ: kum,
      urinMlKgH: vikt ? Math.round(urin / vikt.kg * 100) / 100 : null });
  }
  const summaIn = Math.round(per.reduce((s, x) => s + x.in, 0) * 10) / 10;
  const summaUt = Math.round(per.reduce((s, x) => s + x.ut, 0) * 10) / 10;
  // Oliguri: urin under 0,5 ml/kg/h i varje timme av fönstret, när urinen registreras timvis (minst en urinpost senaste
  // dygnet).
  const fonster = konfiguration.varde(db, 'iva.oliguri_timmar', nu);
  const harUrin = rader.some(r => r.typ === 'urin');
  const sista = per.slice(-fonster - 1, -1).length === fonster ? per.slice(-fonster - 1, -1) : per.slice(-fonster);
  const oliguri = vikt && harUrin && sista.length === fonster && sista.every(x => x.urinMlKgH != null && x.urinMlKgH < 0.5)
    ? { timmar: fonster, text: `Urinen har varit under 0,5 ml/kg/h i ${fonster} timmar (${sista.map(x => talSv(x.urinMlKgH, 2)).join(', ')} ml/kg/h vid vikten ${talSv(vikt.kg)} kg).` } : null;
  return { timmar: per, summaIn, summaUt, balans: Math.round((summaIn - summaUt) * 10) / 10, vikt, oliguri, fran: new Date(fran).toISOString(), till: new Date(till).toISOString() };
}
// Den senaste kvalitetssäkrade vikten som användaren får se.
export function senasteVikt(atk) {
  if (!kanRoll(atk.personal, 'las_matvarden')) return null;
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  const v = journal.synligaMatvarden(a).filter(kvalitetssakrad).find(m => m.typ === 'vikt');
  return v ? { kg: v.varde_num, tid: v.tid } : null;
}

// --- Läkemedel i intensivvården (4.6.1.5) --------------------------------------------------------------------------
const aktuellDos = (db, i) => db.query('SELECT dos, tid, av FROM iva_titreringar WHERE ordination_id = ? ORDER BY tid DESC, id DESC LIMIT 1').get(i.ordination_id) ?? null;
export const hastighetFor = (i, dos) => Math.round(dos * i.vikt_kg / i.koncentration * 10) / 10;
// Förslaget på titrering ur det senaste kvalitetssäkrade värdet för parametern, inom det ordinerade intervallet.
export function titrering(i, rader, dos, nu = new Date()) {
  const t = i.titrering ? JSON.parse(i.titrering) : null;
  if (!t) return null;
  const godk = [...rader].filter(kvalitetssakrad).filter(m => Date.parse(m.tid) > nu.getTime() - 4 * TIMME).sort((a, b) => b.tid.localeCompare(a.tid));
  const namn = (p) => journal.MATTYPER[p]?.namn ?? p;
  if (t.sakerhet) {
    const s = godk.find(m => m.typ === t.sakerhet.parameter);
    if (s && tal(s) < t.sakerhet.under) {
      const ny = i.dos_min;
      return { parameter: t.sakerhet.parameter, varde: tal(s), tid: s.tid, forslag: ny < dos ? ny : null, niva: 'larm', mlH: hastighetFor(i, ny),
        text: `${namn(t.sakerhet.parameter)} ${tal(s)} kl. ${klocka(s.tid)}, under ${t.sakerhet.under}. Minska till lägsta ordinerade dos ${talSv(ny, 3)} ${i.dos_enhet} (${talSv(hastighetFor(i, ny))} ml/h).`,
        gora: 'Minska dosen och kontakta ansvarig läkare.' };
    }
  }
  const m = godk.find(x => x.typ === t.parameter);
  if (!m) return { parameter: t.parameter, varde: null, forslag: null, text: `Inget godkänt värde för ${namn(t.parameter).toLowerCase()} de senaste fyra timmarna. Registrera ett värde så föreslår systemet dosen.` };
  const v = tal(m);
  const hog = t.okarVidHogt ? v > t.hog : v < t.lag;
  const lag = t.okarVidHogt ? v < t.lag : v > t.hog;
  let ny = dos;
  if (hog) ny = Math.min(i.dos_max, Math.round((dos + t.steg) * 1e6) / 1e6);
  else if (lag) ny = Math.max(i.dos_min, Math.round((dos - t.steg) * 1e6) / 1e6);
  const mal = `${t.lag} till ${t.hog}`;
  if (ny === dos) {
    const vidGrans = (hog && dos >= i.dos_max) || (lag && dos <= i.dos_min);
    return { parameter: t.parameter, varde: v, tid: m.tid, forslag: null, niva: vidGrans ? 'varning' : null,
      text: vidGrans ? `${namn(t.parameter)} ${talSv(v)} kl. ${klocka(m.tid)} är utanför målet ${mal}, men dosen är redan ${hog ? 'högsta' : 'lägsta'} ordinerade. Kontakta ansvarig läkare.`
        : `${namn(t.parameter)} ${talSv(v)} kl. ${klocka(m.tid)} är inom målet ${mal}. Behåll dosen.` };
  }
  return { parameter: t.parameter, varde: v, tid: m.tid, forslag: ny, mlH: hastighetFor(i, ny), niva: 'forslag',
    text: `${namn(t.parameter)} ${talSv(v)} kl. ${klocka(m.tid)} är ${v > t.hog ? 'över' : 'under'} målet ${mal}. Systemet föreslår ${talSv(ny, 3)} ${i.dos_enhet}, ${talSv(hastighetFor(i, ny))} ml/h.`,
    gora: `Ändra dosen till ${talSv(ny, 3)} ${i.dos_enhet} och ställ pumpen på ${talSv(hastighetFor(i, ny))} ml/h.` };
}
// De kontinuerliga infusionerna som användaren får se, med aktuell dos, hastighet och förslag på titrering.
export function infusionerFor(atk, rader = null, nu = new Date()) {
  const db = atk.db;
  if (!finns(db) || !kanRoll(atk.personal, 'las_lakemedel')) return [];
  const la = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_lakemedel');
  const ord = lakemedel.synligaOrdinationer(la).filter(o => lakemedel.aktuell(o));
  const mv = rader ?? (kanRoll(atk.personal, 'las_matvarden') ? journal.synligaMatvarden(new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_matvarden')) : []);
  const ut = [];
  for (const o of ord) {
    const i = db.query('SELECT * FROM iva_infusioner WHERE ordination_id = ?').get(o.id);
    if (!i) continue;
    const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(o.lakemedel_id);
    const senast = aktuellDos(db, i);
    const dos = senast?.dos ?? i.startdos;
    // Pumpen och bolusarna visas bara när användaren får se doser från pumpens vårdenhet (läkemedel är gemensamma, men
    // en spärr gäller).
    const synligPa = (enhetId) => la.prova('las_lakemedel', { enhet_id: enhetId, gemensam: true }).tillaten;
    const koppling = mt.finns(db) ? db.query("SELECT k.* FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE k.ordination_id = ? AND k.slut IS NULL AND u.typ = 'pump'").get(o.id) : null;
    const pump = koppling && synligPa(koppling.enhet_id) ? mt.pumpstatus(db, koppling, nu) : null;
    const bolusar = mt.finns(db) ? db.query("SELECT * FROM mt_pumphandelser WHERE ordination_id = ? AND typ = 'bolus' ORDER BY till DESC LIMIT 10").all(o.id)
      .filter(b => synligPa(b.enhet_id)).map(b => ({ tid: b.till, volymMl: b.volym_ml, dos: b.dos, enhet: b.dos_enhet })) : [];
    ut.push({
      ordinationId: o.id, lakemedel: `${lm.namn} ${lm.styrka}`.trim(), dosering: o.dosering, koncentration: i.koncentration, koncEnhet: i.konc_enhet, dosEnhet: i.dos_enhet,
      intervall: { min: i.dos_min, max: i.dos_max }, viktKg: i.vikt_kg, dos, mlH: hastighetFor(i, dos), perTimme: Math.round(dos * i.vikt_kg * 1000) / 1000, perTimmeEnhet: i.konc_enhet.split('/')[0] + '/h',
      bolusDos: i.bolus_dos, maxDygn: i.max_dygn, senastAndrad: senast ? { tid: senast.tid, av: personNamn(db, senast.av) } : null,
      titrering: titrering(i, mv, dos, nu), pump, bolusar,
    });
  }
  return ut;
}

// GET /api/patient/:id/iva/infusion/forslag: protokollen med det som systemet räknar ut för patienten.
export function infusionsforslag(atk, p) {
  atk.krav('ordinera');
  const vikt = senasteVikt(atk);
  return {
    vikt, protokoll: PROTOKOLL.map(x => {
      const lm = atk.db.query('SELECT * FROM katalog WHERE id = ?').get(x.lakemedelId);
      return { ...x, lakemedel: lm ? `${lm.namn} ${lm.styrka}`.trim() : null, startMlH: vikt ? Math.round(x.startdos * vikt.kg / x.koncentration * 10) / 10 : null };
    }).filter(x => x.lakemedel),
    uppfoljningsdatum: addDagar(idag(), 1), demoregel: DEMOREGEL,
    text: vikt ? `Dosen räknas på vikten ${talSv(vikt.kg)} kg från ${new Date(vikt.tid).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })}.` : 'Patientens vikt saknas. Registrera vikten först, så räknar systemet dosen per kilo.',
  };
}
// POST /api/patient/:id/iva/infusion { protokoll, ordinationsorsak, uppfoljningsdatum?, startdos? }. Läkaren väljer
// protokollet och skriver orsaken. Systemet skriver doseringen, räknar dosen på den godkända vikten och sparar
// ordinationen med samma kontroller som andra ordinationer.
export function ordineraInfusion(atk, p, body = {}, nu = new Date()) {
  atk.krav('ordinera');
  const db = atk.db;
  const x = PROTOKOLL.find(q => q.id === body.protokoll);
  if (!x) throw new Fel(400, 'Välj ett infusionsprotokoll.', 'ogiltig', { falt: ['protokoll'] });
  const vikt = senasteVikt(atk);
  if (!vikt) throw new Fel(400, 'Patientens vikt saknas, eller är bara en egen mätning som inte är godkänd. Registrera vikten först, så räknar systemet dosen per kilo.', 'ogiltig', { falt: ['vikt'] });
  const startdos = body.startdos == null || body.startdos === '' ? x.startdos : Number(String(body.startdos).replace(',', '.'));
  if (!Number.isFinite(startdos) || startdos < x.dosMin || startdos > x.dosMax) throw new Fel(400, `Startdosen ska vara inom protokollets intervall ${talSv(x.dosMin, 3)} till ${talSv(x.dosMax, 3)} ${x.dosEnhet}.`, 'ogiltig', { falt: ['startdos'] });
  const mlH = (d) => talSv(d * vikt.kg / x.koncentration);
  const t = x.titrering;
  const dosering = `Kontinuerlig infusion i sprutpump, ${talSv(x.koncentration)} ${x.koncEnhet}. ${talSv(x.dosMin, 3)} till ${talSv(x.dosMax, 3)} ${x.dosEnhet} (${mlH(x.dosMin)} till ${mlH(x.dosMax)} ml/h vid ${talSv(vikt.kg)} kg), start ${talSv(startdos, 3)} ${x.dosEnhet}.`
    + ` Titreras efter ${journal.MATTYPER[t.parameter].namn.toLowerCase()} med målet ${t.lag} till ${t.hog}.${x.bolusDos ? ` Bolus ${talSv(x.bolusDos)} ${x.koncEnhet.split('/')[0]} vid behov.` : ''} Högst ${talSv(x.maxDygn, 0)} ${x.koncEnhet.split('/')[0]} per dygn.`;
  const ut = db.transaction(() => {
    const r = lakemedel.spara(atk, {
      lakemedelId: x.lakemedelId, dosering, dos: Math.round(startdos * vikt.kg * 1000) / 1000, dosEnhet: `${x.koncEnhet.split('/')[0]}/h`, typ: 'staende', tider: [],
      ordinationsorsak: body.ordinationsorsak, uppfoljningsdatum: body.uppfoljningsdatum || addDagar(idag(), 1), kvitteradeVarningar: body.kvitteradeVarningar,
    });
    db.query(`INSERT INTO iva_infusioner (ordination_id, patient_id, enhet_id, protokoll, koncentration, konc_enhet, dos_enhet, dos_min, dos_max, startdos, bolus_dos, max_dygn, titrering, vikt_kg, skapad, av)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.ordination.id, atk.patientId, atk.personal.enhet_id, x.id, x.koncentration, x.koncEnhet, x.dosEnhet, x.dosMin, x.dosMax, startdos,
      x.bolusDos ?? null, x.maxDygn ?? null, JSON.stringify(t), vikt.kg, nu.toISOString(), atk.personal.id);
    return r;
  })();
  vardkontakt.knyt(atk, 'ordinationer', ut, body);
  return { ...ut, infusion: infusionerFor(atk, null, nu).find(i => i.ordinationId === ut.ordination.id) ?? null,
    text: `Infusionen är ordinerad. Starta pumpen på ${mlH(startdos)} ml/h och koppla den till patienten genom att skanna pumpens streckkod.` };
}
// POST /api/patient/:id/iva/infusion/:oid/dos { dos?, grund? }: sjuksköterskan titrerar inom det ordinerade intervallet.
// Utan dos används systemets förslag.
export function andraDos(atk, oid, body = {}, nu = new Date()) {
  const db = atk.db;
  const i = finns(db) ? db.query('SELECT * FROM iva_infusioner WHERE ordination_id = ? AND patient_id = ?').get(Number(oid), atk.patientId) : null;
  if (!i) throw new Fel(404, 'Infusionen finns inte.', 'saknas');
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(i.ordination_id);
  // Att titrera en infusion efter mätvärden är en bedömning som sjuksköterskan eller läkaren gör, aldrig en delegerad uppgift.
  if (!['lakare', 'sjukskoterska'].includes(atk.personal.yrke)) {
    atk.logga('ge_lakemedel', 'nekad', `iva:infusion:${o.id}:dos`, 'nekad');
    throw new Fel(403, 'Dosen i en infusion titreras av sjuksköterska eller läkare.', 'nekad');
  }
  kravVardande(atk, 'ge_lakemedel', { enhet_id: o.enhet_id, gemensam: true }, `iva:infusion:${o.id}`);
  if (!lakemedel.aktuell(o)) throw new Fel(400, 'Ordinationen är inte aktiv.', 'ogiltig');
  const inf = infusionerFor(atk, null, nu).find(x => x.ordinationId === o.id);
  if (!inf) throw new Fel(404, 'Infusionen finns inte.', 'saknas');
  const dos = body.dos == null || body.dos === '' ? inf.titrering?.forslag : Number(String(body.dos).replace(',', '.'));
  if (dos == null) throw new Fel(400, 'Systemet har inget förslag på ny dos just nu. Ange dosen.', 'ogiltig', { falt: ['dos'] });
  if (!Number.isFinite(dos) || dos < i.dos_min - 1e-9 || dos > i.dos_max + 1e-9) {
    throw new Fel(400, `Dosen ${talSv(dos, 3)} ${i.dos_enhet} ligger utanför det ordinerade intervallet ${talSv(i.dos_min, 3)} till ${talSv(i.dos_max, 3)} ${i.dos_enhet}. Kontakta läkaren för en ny ordination.`, 'ogiltig', { falt: ['dos'] });
  }
  const grund = typeof body.grund === 'string' && body.grund.trim() ? body.grund.trim().slice(0, 300) : (inf.titrering?.forslag === dos ? inf.titrering.text : null);
  db.query('INSERT INTO iva_titreringar (ordination_id, patient_id, enhet_id, tid, dos, av, grund) VALUES (?, ?, ?, ?, ?, ?, ?)').run(o.id, atk.patientId, atk.personal.enhet_id, nu.toISOString(), dos, atk.personal.id, grund);
  atk.logga('ge_lakemedel', atk.grund(), `iva:infusion:${o.id}:dos`);
  return { dos, mlH: hastighetFor(i, dos), text: `Dosen är ${talSv(dos, 3)} ${i.dos_enhet}. Ställ pumpen på ${talSv(hastighetFor(i, dos))} ml/h.` };
}

// --- Översikt och övervakning (4.6.1.2) ----------------------------------------------------------------------------
const senasteVarden = (rader) => {
  const ut = {};
  for (const typ of [...mt.MONITORTYPER, 'glukos', 'smarta']) {
    const m = rader.filter(x => x.typ === typ).sort((a, b) => b.tid.localeCompare(a.tid))[0];
    if (m) ut[typ] = { varde: m.varde_num ?? m.varde, tid: m.tid, godkand: kvalitetssakrad(m), kalla: m.kalla, ...(typ === 'blodtryck' ? { map: map(m.varde) } : {}) };
  }
  return ut;
};
// Översikten: patienterna med en pågående vårdkontakt på intensivvårdsavdelningen, med de senaste värdena, NEWS2,
// larm och förslag, utrustningen, infusionerna och vätskebalansen. Bara det som användaren får se räknas.
export function oversikt(db, personal, valFor, { enhetId = null } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'las_matvarden')) throw new Fel(403, 'Din yrkesroll läser inte mätvärden.', 'nekad');
  const enheter = ivaEnheter(db, personal);
  if (!enheter.length) return { enheter: [], enhet: null, patienter: [], patientIdn: [], text: 'Din vårdenhet har ingen intensivvårdsavdelning i demon.', demoregel: DEMOREGEL };
  const enhet = enheter.find(e => e.id === enhetId) ?? enheter[0];
  const t = nu.toISOString();
  const kontakter = db.query(`SELECT * FROM vardkontakter WHERE enhet_id = ? AND slut IS NULL AND start <= ? AND NOT (coalesce(planerad, 0) = 1 AND ankomst IS NULL)
    ORDER BY plats, start`).all(enhet.id, t);
  const params = parametrar(db, nu);
  const patienter = [];
  for (const k of kontakter) {
    if (patienter.some(x => x.patientId === k.patient_id)) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ? AND sammanslagen_till IS NULL').get(k.patient_id);
    if (!p) continue;
    const val = valFor(p.id);
    const atk = new Atkomst(db, personal, p.id, val, 'las_matvarden');
    if (!atk.prova('las_matvarden').tillaten) continue;
    const rader = journal.synligaMatvarden(atk).filter(m => m.kalla !== 'patient');
    const vatska = vatskaTimvis(atk, { timmar: 24 }, nu);
    const infusioner = infusionerFor(atk, rader, nu);
    const analys = analysera({ rader, vatska, infusioner, params, nu });
    const n2 = vitalparametrar.news2For(atk, p, rader).aktuell;
    patienter.push({
      patientId: p.id, namn: visningsnamn(p, val.visa_identitet), personnummer: visningsPnr(p, val.visa_identitet), alder: alder(p.fodd, idag()), plats: k.plats, sedan: k.start,
      orsak: k.orsak, varden: senasteVarden(rader), news2: n2 ? { poang: n2.poang, risk: n2.risk, komplett: n2.komplett, tid: n2.tid } : null,
      analys, larm: analys.filter(a => a.niva === 'larm').length, utrustning: mt.kopplingarFor(atk, { aktiva: true }).map(x => ({ id: x.id, typ: x.utrustning?.typ, text: `${x.utrustning?.typText} ${x.utrustning?.serienummer}` })),
      vantar: mt.attBedoma(atk, rader).length, infusioner: infusioner.map(i => ({ lakemedel: i.lakemedel, dos: i.dos, dosEnhet: i.dosEnhet, mlH: i.mlH })),
      vatska: { balans: vatska.balans, summaIn: vatska.summaIn, summaUt: vatska.summaUt },
    });
  }
  const ordning = (x) => (x.larm ? 0 : x.analys.some(a => a.niva === 'varning') ? 1 : 2);
  patienter.sort((a, b) => ordning(a) - ordning(b) || String(a.plats ?? '').localeCompare(String(b.plats ?? ''), 'sv'));
  return {
    enheter, enhet: { ...enhet, belagda: patienter.length }, patienter, patientIdn: patienter.map(x => x.patientId), demoregel: DEMOREGEL, demo: mt.DEMO,
    text: patienter.length ? `${patienter.length} av ${enhet.platser} platser är belagda.` : 'Inga patienter på avdelningen just nu.',
  };
}

// Övervakningsvyn för en patient: täta värden de senaste timmarna med kurvor, analysen, infusionerna, bolusarna,
// vätskorna och den timvisa vätskebalansen, och utrustningen.
export function overvakning(atk, p, { timmar = 6 } = {}, nu = new Date()) {
  atk.krav('las_matvarden');
  const db = atk.db;
  const h = Math.min(24, Math.max(1, Number(timmar) || 6));
  const alla = journal.synligaMatvarden(atk).filter(m => m.kalla !== 'patient');
  const fonster = alla.filter(m => Date.parse(m.tid) > nu.getTime() - h * TIMME && Date.parse(m.tid) <= nu.getTime() + 5 * MIN);
  const vatska = vatskaTimvis(atk, { timmar: 24 }, nu);
  const infusioner = infusionerFor(atk, alla, nu);
  const analys = analysera({ rader: alla, vatska, infusioner, params: parametrar(db, nu), nu });
  const kurvor = vitalparametrar.kurvor(atk, p, fonster.filter(m => [...mt.MONITORTYPER, 'glukos', 'smarta'].includes(m.typ)));
  const mapSerie = fonster.filter(m => m.typ === 'blodtryck').sort((a, b) => a.tid.localeCompare(b.tid)).map(m => ({ tid: m.tid, map: map(m.varde), godkand: kvalitetssakrad(m) }));
  // Vätskor och läkemedel i en gemensam lista: infusionerna som pågår, bolusar och intag och förluster det senaste dygnet.
  const handelser = [
    ...infusioner.flatMap(i => i.bolusar.map(b => ({ tid: b.tid, typ: 'bolus', text: `Bolus ${i.lakemedel}${b.dos != null ? `, ${talSv(b.dos, 2)} ${b.enhet}` : ''} (${talSv(b.volymMl)} ml)` }))),
    ...db.query('SELECT * FROM vatskebalans WHERE patient_id = ? AND tid > ? ORDER BY tid DESC').all(atk.patientId, new Date(nu.getTime() - DAG).toISOString())
      .filter(r => atk.prova('las_matvarden', { enhet_id: r.enhet_id }).tillaten && r.administrering_id == null)
      .map(r => ({ tid: r.tid, typ: r.riktning === 'in' ? 'intag' : 'forlust', text: `${r.riktning === 'in' ? 'Intag' : 'Förlust'}: ${(r.riktning === 'in' ? { dryck: 'dryck', mat: 'mat och sondnäring', infusion: 'infusion' } : { urin: 'urin', dran: 'dränage', krakning: 'kräkning', avforing: 'avföring' })[r.typ] ?? r.typ} ${talSv(r.volym_ml, 0)} ml` })),
  ].sort((a, b) => b.tid.localeCompare(a.tid)).slice(0, 40);
  // Platsen på intensivvårdsavdelningen, bara när användaren får se uppgifter från den vårdenheten.
  const vk = db.query(`SELECT plats, enhet_id FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND enhet_id IN (${Object.keys(IVA_ENHETER).map(() => '?').join(', ')}) ORDER BY start DESC`).get(atk.patientId, ...Object.keys(IVA_ENHETER));
  const plats = vk && atk.prova('las_matvarden', { enhet_id: vk.enhet_id }).tillaten ? vk.plats : null;
  return {
    patient: { id: p.id, namn: visningsnamn(p, atk.val?.visa_identitet), personnummer: visningsPnr(p, atk.val?.visa_identitet), plats },
    timmar: h, varden: senasteVarden(alla), kurvor, map: mapSerie, analys, infusioner, handelser, vatska,
    utrustning: mt.patientvy(atk, alla, nu), regler: IVA_REGLER, parametrar: parametrar(db, nu), demoregel: DEMOREGEL,
    anestesi: kanRoll(atk.personal, 'las_journal') ? anestesiLista(atk).slice(0, 3) : [],
  };
}

// --- Anestesibedömning (4.6.1.4) -----------------------------------------------------------------------------------
const SYSTEMSJUKDOM = /^(E1[0-4]|I1[0-5]|I2[0-5]|I4[4-9]|I50|J4[4-6]|N18|K70|K74|G40|E66)/;
const SVAR_SYSTEMSJUKDOM = /^(I50|N18\.[45]|I21|J96|K72)/;
// ASA-klass som systemet föreslår ur diagnoserna som användaren får se. Läkaren bestämmer. Demoregel.
export function asaForslag(diagnoser) {
  const kroniska = [...new Set(diagnoser.filter(d => SYSTEMSJUKDOM.test(d.kod) || SVAR_SYSTEMSJUKDOM.test(d.kod)).map(d => d.kod))];
  const svara = kroniska.filter(k => SVAR_SYSTEMSJUKDOM.test(k));
  const asa = svara.length || kroniska.length >= 3 ? 3 : kroniska.length ? 2 : 1;
  return { asa, grund: kroniska.length ? `Systemsjukdom i diagnoserna: ${kroniska.join(', ')}.` : 'Inga diagnoser med systemsjukdom som du kan se.', text: `Förslag ASA ${asa}. Läkaren bestämmer klassen.` };
}
// Fastetiderna ur den planerade tiden för ingreppet.
export function fasta(planerad) {
  const t = Date.parse(planerad);
  if (!Number.isFinite(t)) return null;
  const fast = new Date(t - FASTA.fastFodaTimmar * TIMME).toISOString();
  const klar = new Date(t - FASTA.klaraDryckerTimmar * TIMME).toISOString();
  return { fastFodaTill: fast, klaraDryckerTill: klar, text: `Fast föda till kl. ${klocka(fast)} och klara drycker till kl. ${klocka(klar)} (${FASTA.fastFodaTimmar} och ${FASTA.klaraDryckerTimmar} timmar före).`, kalla: FASTA.kalla };
}
// ---- Runda 11, r2: bedömningen inför en operation (Sussa 4.6.1.4) -----------------------------------------------------
// En bedömning gäller i GILTIG_DAGAR, och systemet säger när den måste göras om. Riskskalorna räknas ur journalen där det
// går. Skalorna och giltighetstiden är demoregler, inte kliniskt beslutsstöd.
export const GILTIG_DAGAR = 180;
export const SAMTYCKE = { ja: 'Patienten har fått information och samtycker till anestesin', nej: 'Patienten samtycker inte till anestesin', kan_inte: 'Patienten kan inte samtycka (akut, nödsituation)' };
const APFEL_RISK = [10, 20, 40, 60, 80];
const RCRI_RISK = [3.9, 6.0, 10.1, 15];
// Anmälan till operation som bedömningen gäller. Raden binds till patienten och prövas på den anmälande vårdenheten.
// Säkerhetsgranskningen: den som sparar en bedömning mot anmälan ändrar ASA-klassen och historiken, och prövas därför som
// i operation.anestesibedomning: handlingen operation_anmala och arbete på den anmälande vårdenheten (andraRad).
function anmalanFor(atk, anmalanId, { andra = false } = {}) {
  if (anmalanId == null || anmalanId === '') return null;
  const op = require('./operation.js');
  if (!/^\d{1,9}$/.test(String(anmalanId))) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  let an;
  try { an = op.anmalanRad(atk.db, anmalanId); } catch { throw new Fel(404, 'Uppgiften finns inte.', 'saknas'); }
  if (an.patient_id !== atk.patientId) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  if (andra) andraRad(atk, an, 'operation_anmala', 'las_operation', 'Operationen hanteras av den anmälande vårdenheten.');
  else atk.krav('las_operation', { resurs: { enhet_id: an.enhet_id } });
  const plan = atk.db.query('SELECT start FROM op_planeringar WHERE anmalan_id = ? AND struken_tid IS NULL ORDER BY id DESC').get(an.id);
  return { an, ingrepp: op.INGREPP[an.kva], planerad: plan?.start ?? null };
}
// Revised Cardiac Risk Index (Lee) och Apfels skala för illamående efter operation, ur det användaren får se.
export function riskskalor(atk, p, { ingrepp = null, diagnoser = [], lakemedelAtc = [], kreatinin = null, ponvTidigare = false, rokare = false, opioider = true } = {}) {
  const kod = (re) => diagnoser.find(d => re.test(d.kod));
  const rcri = [
    ingrepp && /^J/.test(ingrepp.kva) ? 'Högriskkirurgi i buken' : null,
    kod(/^I2[0-5]/) ? `Ischemisk hjärtsjukdom (${kod(/^I2[0-5]/).kod})` : null,
    kod(/^I50/) ? `Hjärtsvikt (${kod(/^I50/).text})` : null,
    kod(/^(I6\d|G45)/) ? `Cerebrovaskulär sjukdom (${kod(/^(I6\d|G45)/).kod})` : null,
    lakemedelAtc.some(a => a.startsWith('A10A')) ? 'Diabetes som behandlas med insulin' : null,
    kreatinin != null && kreatinin > 177 ? `Kreatinin ${kreatinin} µmol/l, över 177` : null,
  ].filter(Boolean);
  const apfel = [p.kon === 'kvinna' ? 'Kvinna' : null, rokare ? null : 'Icke-rökare', ponvTidigare ? 'Illamående efter tidigare operation eller åksjuka' : null, opioider ? 'Opioider efter operationen' : null].filter(Boolean);
  return {
    rcri: { namn: 'Revised Cardiac Risk Index (Lee)', poang: rcri.length, risk: RCRI_RISK[Math.min(3, rcri.length)], grund: rcri.length ? rcri.join(', ') : 'Inga riskfaktorer i det du kan se.', text: `${rcri.length} poäng, risk för allvarlig hjärthändelse omkring ${talSv(RCRI_RISK[Math.min(3, rcri.length)])} procent.` },
    apfel: { namn: 'Apfels skala för illamående efter operation', poang: apfel.length, risk: APFEL_RISK[apfel.length], grund: apfel.join(', ') || 'Inga riskfaktorer.', text: `${apfel.length} poäng, risk för illamående omkring ${APFEL_RISK[apfel.length]} procent.${apfel.length >= 2 ? ' Systemet föreslår profylax mot illamående.' : ''}` },
  };
}
function patientinformationText({ ingrepp, planerad, form, fastaText, lakemedel: lm }) {
  const nar = planerad ? new Date(planerad).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' }) : null;
  return [`Inför din operation: ${ingrepp.toLocaleLowerCase('sv')}${nar ? ` ${nar}` : ''}.`, `Du får ${ANESTESIFORMER[form].toLocaleLowerCase('sv')}.`,
    fastaText ? fastaText.replace('Fast föda till kl.', 'Ät inte efter klockan').replace(' och klara drycker till kl.', '. Du får dricka klara drycker till klockan').replace(/ \(\d+ och \d+ timmar före\)\./, '.') : 'Personalen säger när du ska sluta äta och dricka.',
    ...lm.filter(l => l.observation).map(l => `${l.text}: ${l.observation.split(':')[1]?.trim() ?? l.observation}`),
    'Efter operationen vaknar du på uppvakningsavdelningen, och personalen följer dig tills du kan gå tillbaka till avdelningen.',
    'Du kan visa den här informationen för en närstående. Ring avdelningen om du blir sjuk före operationen.'].join(' ');
}
// Den senaste bedömningen för en operation, som den inloggade får se, med om den gäller vid operationen.
export function anestesiForAnmalan(atk, an, nu = new Date()) {
  if (!kanRoll(atk.personal, 'las_journal') || !harTabell(atk.db, 'anestesi_tillagg')) return null;
  const ids = atk.db.query('SELECT bedomning_id FROM anestesi_tillagg WHERE anmalan_id = ? AND patient_id = ?').all(an.id, an.patient_id).map(r => r.bedomning_id);
  const b = anestesiLista(new Atkomst(atk.db, atk.personal, an.patient_id, atk.val, 'las_journal')).find(x => ids.includes(x.id));
  if (!b) return null;
  const plan = atk.db.query('SELECT start FROM op_planeringar WHERE anmalan_id = ? AND struken_tid IS NULL ORDER BY id DESC').get(an.id);
  const dag = [nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }), plan ? new Date(plan.start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) : ''].sort().at(-1);
  return { ...b, giltig: b.giltigTill >= dag };
}

// GET /api/patient/:id/anestesi/forslag?planerad=: det som systemet hämtar ur journalen och föreslår.
// Runda 11, r2: med anmalanId fyller systemet i ingreppet och den planerade tiden ur operationen och räknar skalorna.
export function anestesiForslag(atk, p, { planerad = null, anmalanId = null } = {}, nu = new Date()) {
  atk.krav('anestesibedomning');
  const db = atk.db;
  const kopplad = anmalanFor(atk, anmalanId);
  if (kopplad && !planerad) planerad = kopplad.planerad;
  const a = (h) => new Atkomst(db, atk.personal, atk.patientId, atk.val, h);
  const diagnoser = kanRoll(atk.personal, 'las_diagnoser') ? journal.synligaDiagnoser(a('las_diagnoser')) : [];
  const lm = kanRoll(atk.personal, 'las_lakemedel') ? lakemedel.synligaOrdinationer(a('las_lakemedel')).filter(o => lakemedel.aktuell(o)) : [];
  const atc = new Map(db.query('SELECT id, atc, namn, styrka FROM katalog').all().map(k => [k.id, k]));
  const lakemedelUt = lm.map(o => {
    const k = atc.get(o.lakemedel_id);
    const obs = k.atc.startsWith('B01A') ? 'Antikoagulantia: planera uppehåll inför ingreppet.' : k.atc.startsWith('A10') ? 'Diabetesläkemedel: planera glukoskontroll under fastan.'
      : k.atc.startsWith('C07') ? 'Betablockerare: ges som vanligt på operationsdagen.' : null;
    return { text: `${k.namn} ${k.styrka}`.trim(), dosering: o.dosering, ...(obs ? { observation: obs } : {}) };
  });
  const overk = journal.synligOverkanslighet(a('las_oversikt')) ?? [];
  const vikt = senasteVikt(atk);
  const lmv = kanRoll(atk.personal, 'las_matvarden') ? journal.synligaMatvarden(a('las_matvarden')).filter(kvalitetssakrad) : [];
  const langd = lmv.find(m => m.typ === 'langd');
  const bmi = vikt && langd ? Math.round(vikt.kg / (langd.varde_num / 100) ** 2 * 10) / 10 : null;
  const tidigare = anestesiLista(atk);
  const luftvagRisk = [...(bmi && bmi >= 35 ? [`BMI ${talSv(bmi)}, ökad risk för svår luftväg.`] : []), ...tidigare.filter(x => x.luftvag?.tidigareSvarIntubation).map(x => `Svår intubation ${x.tid.slice(0, 10)}.`)];
  return {
    alder: alder(p.fodd, idag()), vikt, bmi, asa: asaForslag(diagnoser), diagnoser: diagnoser.map(d => ({ kod: d.kod, text: d.text })), lakemedel: lakemedelUt,
    overkanslighet: overk.map(o => ({ amne: o.amne, reaktion: o.reaktion, allvarlighet: o.allvarlighet })), tidigare: tidigare.map(x => ({ tid: x.tid, ingrepp: x.ingrepp, asa: x.asa, anestesiform: x.anestesiform })),
    luftvag: { risker: luftvagRisk }, fasta: planerad ? fasta(planerad) : null, demoregel: DEMOREGEL,
    text: 'Systemet har hämtat läkemedel, överkänslighet, diagnoser, vikt och tidigare anestesier ur journalen. Fyll i det som bara du kan bedöma.',
    // Runda 11, r2.
    ...(kopplad ? { anmalanId: kopplad.an.id, ingrepp: kopplad.ingrepp.namn, planerad, anestesiform: kopplad.an.anestesi === 'lokal' ? 'sedering' : kopplad.an.anestesi } : {}),
    skalor: riskskalor(atk, p, { ingrepp: kopplad?.ingrepp ?? null, diagnoser, lakemedelAtc: lm.map(o => atc.get(o.lakemedel_id)?.atc ?? ''), kreatinin: lmv.find(m => m.typ === 'kreatinin')?.varde_num ?? null }),
    giltigDagar: GILTIG_DAGAR, samtycken: SAMTYCKE,
  };
}
export const ANESTESIFORMER = { generell: 'Generell anestesi', regional: 'Regional anestesi', sedering: 'Lokalbedövning med sedering' };
export function sparaAnestesi(atk, p, body = {}, nu = new Date()) {
  kravVardande(atk, 'anestesibedomning', null, 'anestesi');
  const db = atk.db;
  const falt = [];
  // Runda 11, r2: en bedömning inför en operation får ingreppet och tiden ur anmälan och kräver samtycket.
  const kopplad = anmalanFor(atk, body.anmalanId, { andra: true });
  if (kopplad) {
    body = { ...body, ingrepp: body.ingrepp || kopplad.ingrepp.namn, planerad: body.planerad || kopplad.planerad };
    if (!Object.hasOwn(SAMTYCKE, body.samtycke)) throw new Fel(400, 'Ange patientens samtycke till anestesin.', 'ogiltig', { falt: ['samtycke'] });
    if (body.samtycke === 'kan_inte' && !body.akut) throw new Fel(400, 'Att patienten inte kan samtycka gäller bara ett akut ingrepp. Markera ingreppet som akut eller ange samtycket.', 'ogiltig', { falt: ['samtycke'] });
  }
  const ingrepp = typeof body.ingrepp === 'string' ? body.ingrepp.trim().slice(0, 200) : '';
  if (ingrepp.length < 3) falt.push('ingrepp');
  const asa = Number(body.asa);
  if (!Number.isInteger(asa) || asa < 1 || asa > 5) falt.push('asa');
  const form = Object.hasOwn(ANESTESIFORMER, body.anestesiform) ? body.anestesiform : null;
  if (!form) falt.push('anestesiform');
  const lv = body.luftvag ?? {};
  const mallampati = lv.mallampati == null || lv.mallampati === '' ? null : Number(lv.mallampati);
  if (mallampati != null && (!Number.isInteger(mallampati) || mallampati < 1 || mallampati > 4)) falt.push('mallampati');
  let planerad = null;
  if (body.planerad) { const t = Date.parse(body.planerad); if (!Number.isFinite(t)) falt.push('planerad'); else planerad = new Date(t).toISOString(); }
  if (falt.length) {
    const namn = { ingrepp: 'ingreppet', asa: 'ASA-klass 1 till 5', anestesiform: 'anestesiformen', mallampati: 'Mallampati 1 till 4', planerad: 'den planerade tiden' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.`, 'ogiltig', { falt });
  }
  const forslag = anestesiForslag(atk, p, { planerad, anmalanId: kopplad?.an.id ?? null }, nu);
  const luftvag = { mallampati, munoppningOk: lv.munoppningOk !== false, nackrorlighetOk: lv.nackrorlighetOk !== false, tidigareSvarIntubation: Boolean(lv.tidigareSvarIntubation), risker: forslag.luftvag.risker };
  const underlag = { lakemedel: forslag.lakemedel, overkanslighet: forslag.overkanslighet, diagnoser: forslag.diagnoser, vikt: forslag.vikt, bmi: forslag.bmi, asaForslag: forslag.asa.asa };
  const vk = vardkontakt.pagandeFor(db, atk.personal, atk.patientId)?.id ?? null;
  const id = Number(db.query(`INSERT INTO anestesibedomningar (patient_id, enhet_id, vardkontakt_id, ingrepp, planerad, asa, akut, anestesiform, luftvag, fasta, underlag, kommentar, tid, av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, vk, ingrepp, planerad, asa, body.akut ? 1 : 0, form, JSON.stringify(luftvag),
    forslag.fasta ? JSON.stringify(forslag.fasta) : null, JSON.stringify(underlag), typeof body.kommentar === 'string' ? body.kommentar.trim().slice(0, 1000) || null : null, nu.toISOString(), atk.personal.id).lastInsertRowid);
  // Runda 11, r2: skalorna, giltighetstiden och informationen till patienten sparas med bedömningen.
  const skalor = { rcri: forslag.skalor.rcri, apfel: riskskalor(atk, p, { ponvTidigare: Boolean(body.ponvTidigare), rokare: Boolean(body.rokare), opioider: body.opioider !== false }).apfel };
  const giltigTill = addDagar(nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }), GILTIG_DAGAR);
  db.query('INSERT INTO anestesi_tillagg (bedomning_id, patient_id, enhet_id, anmalan_id, samtycke, giltig_till, skalor, patientinformation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, atk.patientId, atk.personal.enhet_id, kopplad?.an.id ?? null, Object.hasOwn(SAMTYCKE, body.samtycke) ? body.samtycke : null, giltigTill, JSON.stringify(skalor),
      patientinformationText({ ingrepp, planerad, form, fastaText: forslag.fasta?.text, lakemedel: forslag.lakemedel }));
  if (kopplad) {
    db.query('UPDATE op_anmalningar SET asa = ? WHERE id = ?').run(asa, kopplad.an.id);
    db.query('INSERT INTO op_historik (anmalan_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(kopplad.an.id, kopplad.an.patient_id, kopplad.an.enhet_id, nu.toISOString(), atk.personal.id, 'anestesibedomning', `ASA ${asa}${body.akut ? 'E' : ''}, giltig till ${giltigTill}`);
  }
  atk.logga('anestesibedomning', atk.grund(), `anestesi:${id}`);
  return { bedomning: anestesiUt(db, db.query('SELECT * FROM anestesibedomningar WHERE id = ?').get(id)), text: `Anestesibedömningen är sparad, ASA ${asa}${body.akut ? 'E' : ''}. Den gäller till ${giltigTill}.` };
}
function anestesiUt(db, r) {
  const t = harTabell(db, 'anestesi_tillagg') ? db.query('SELECT * FROM anestesi_tillagg WHERE bedomning_id = ?').get(r.id) : null;
  return {
    ...(t ? { anmalanId: t.anmalan_id, samtycke: t.samtycke, samtyckeText: t.samtycke ? SAMTYCKE[t.samtycke] : null, giltigTill: t.giltig_till, skalor: JSON.parse(t.skalor), patientinformation: t.patientinformation } : {}),
    id: r.id, tid: r.tid, av: personNamn(db, r.av), vardenhet: enhetsnamn(db, vardenhetFor(db, r.enhet_id)), ingrepp: r.ingrepp, planerad: r.planerad, asa: r.asa, akut: Boolean(r.akut),
    asaText: `ASA ${r.asa}${r.akut ? 'E' : ''}`, anestesiform: r.anestesiform, anestesiformText: ANESTESIFORMER[r.anestesiform], luftvag: JSON.parse(r.luftvag), fasta: r.fasta ? JSON.parse(r.fasta) : null,
    underlag: JSON.parse(r.underlag), kommentar: r.kommentar,
  };
}
// Anestesibedömningarna som användaren får se (journalinformation, samma regler som anteckningar).
export function anestesiLista(atk) {
  if (!finns(atk.db) || !kanRoll(atk.personal, 'las_journal')) return [];
  const rader = atk.db.query('SELECT * FROM anestesibedomningar WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId);
  return new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_journal').filtrera(rader, 'las_journal').map(r => anestesiUt(atk.db, r));
}

// --- Uppföljning av kvalitet och produktion (4.6.1.7) --------------------------------------------------------------
// Per intensivvårdsavdelning under perioden: vårddygn, vårdtillfällen, beläggning, medelvårdtid, vårdtyngd (andel
// vårddygn med kopplad monitor och med kontinuerlig infusion) och kvalitetsindikatorer. Bara antal, inga personuppgifter.
// Vårdenhetens personal ser sin vårdenhets avdelningar och uppföljningsrollen alla.
export function uppfoljning(db, personal, { enhetId = null, dagar = 30 } = {}, nu = new Date()) {
  const region = kanRoll(personal, 'statistik_region');
  if (!region && !kanRoll(personal, 'statistik')) throw new Fel(403, 'Din yrkesroll ser inte uppföljningen.', 'nekad');
  const d = Math.min(365, Math.max(1, Number(dagar) || 30));
  const till = nu.getTime();
  const fran = till - d * DAG;
  const enheter = region ? Object.keys(IVA_ENHETER).filter(id => db.query('SELECT 1 FROM enheter WHERE id = ?').get(id)).map(id => ({ id, namn: enhetsnamn(db, id), platser: IVA_ENHETER[id].platser })) : ivaEnheter(db, personal);
  const valda = enhetId ? enheter.filter(e => e.id === enhetId) : enheter;
  const ut = valda.map(e => {
    const kontakter = db.query('SELECT * FROM vardkontakter WHERE enhet_id = ? AND start < ? AND (slut IS NULL OR slut > ?) AND coalesce(planerad, 0) = 0').all(e.id, new Date(till).toISOString(), new Date(fran).toISOString());
    const overlapp = (s, t) => Math.max(0, Math.min(till, t) - Math.max(fran, s));
    const vardMs = kontakter.reduce((s, k) => s + overlapp(Date.parse(k.start), k.slut ? Date.parse(k.slut) : till), 0);
    const vardygn = Math.round(vardMs / DAG * 10) / 10;
    const avslutade = kontakter.filter(k => k.slut && Date.parse(k.slut) <= till && Date.parse(k.slut) > fran);
    const medel = avslutade.length ? Math.round(avslutade.reduce((s, k) => s + (Date.parse(k.slut) - Date.parse(k.start)), 0) / avslutade.length / DAG * 10) / 10 : null;
    // Återinskrivning inom 48 timmar efter en avslutad vårdkontakt på samma avdelning.
    const ater = avslutade.filter(k => db.query('SELECT 1 FROM vardkontakter WHERE enhet_id = ? AND patient_id = ? AND start > ? AND start <= ?').get(e.id, k.patient_id, k.slut, new Date(Date.parse(k.slut) + 2 * DAG).toISOString())).length;
    const mtMs = mt.finns(db) ? db.query("SELECT k.start, k.slut FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE k.enhet_id = ? AND u.typ = 'monitor' AND k.start < ? AND (k.slut IS NULL OR k.slut > ?)")
      .all(e.id, new Date(till).toISOString(), new Date(fran).toISOString()).reduce((s, k) => s + overlapp(Date.parse(k.start), k.slut ? Date.parse(k.slut) : till), 0) : 0;
    const infMs = finns(db) ? db.query('SELECT i.skapad, o.utsatt_tid, o.status FROM iva_infusioner i JOIN ordinationer o ON o.id = i.ordination_id WHERE i.enhet_id = ?').all(e.id)
      .reduce((s, x) => s + overlapp(Date.parse(x.skapad), x.utsatt_tid ? Date.parse(x.utsatt_tid) : till), 0) : 0;
    // Kvalitetsindikator: andel av monitorns värden som godkändes inom en timme.
    const mtVarden = mt.finns(db) ? db.query("SELECT m.tid, m.vidimerad FROM mt_varden v JOIN matvarden m ON m.id = v.matvarde_id WHERE v.enhet_id = ? AND m.tid > ? AND m.tid <= ?").all(e.id, new Date(fran).toISOString(), new Date(till).toISOString()) : [];
    const inomTimme = mtVarden.filter(m => m.vidimerad && Date.parse(m.vidimerad) - Date.parse(m.tid) <= TIMME).length;
    const vbDagar = db.query('SELECT count(DISTINCT patient_id || substr(tid, 1, 10)) AS n FROM vatskebalans WHERE enhet_id = ? AND tid > ? AND tid <= ?').get(e.id, new Date(fran).toISOString(), new Date(till).toISOString()).n;
    const procent = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
    return {
      enhet: { id: e.id, namn: e.namn, platser: e.platser }, vardygn, vardtillfallen: kontakter.length, avslutade: avslutade.length, belaggningProcent: procent(vardygn, e.platser * d), medelvardtidDygn: medel,
      vardtyngd: { overvakningProcent: procent(mtMs / DAG, vardygn), infusionProcent: procent(infMs / DAG, vardygn), text: 'Andel vårddygn med kopplad monitor och med kontinuerlig infusion i sprutpump. Förenklad demoregel för vårdtyngd.' },
      kvalitet: [
        { id: 'godkanda_inom_timme', text: 'Monitorns värden som godkändes inom en timme', varde: procent(inomTimme, mtVarden.length), antal: mtVarden.length, enhet: 'procent' },
        { id: 'vatskebalans', text: 'Vårddygn med registrerad vätskebalans', varde: procent(Math.min(vbDagar, Math.ceil(vardygn)), Math.ceil(vardygn)), antal: Math.ceil(vardygn), enhet: 'procent' },
        { id: 'aterinskrivning_48h', text: 'Återinskrivningar inom 48 timmar', varde: ater, antal: avslutade.length, enhet: 'antal' },
      ],
    };
  });
  return { dagar: d, fran: new Date(fran).toISOString(), till: new Date(till).toISOString(), enheter: ut, demoregel: DEMOREGEL, text: 'Uppföljningen räknas ur vårdkontakterna, utrustningen, infusionerna och vätskebalansen. Inga personuppgifter.' };
}
