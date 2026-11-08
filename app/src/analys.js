// Runda 9, r7: analys och uppföljning i kärnsystemet (Sussa 6.2.1.1) och patientgruppering (Sussa 6.2.1.2).
//
// En patientgrupp är ett urval av villkor: diagnoser, genomförda åtgärder, läkemedel, mät- och labbvärden (också BMI som
// systemet räknar), mätvärden som saknas, levnadsvanor, besökshistorik och demografi, med en tidsperiod. Alla villkor
// ska vara uppfyllda, och inom ett villkor räcker det att ett av värdena stämmer. Systemet har färdiga grupper för
// vanliga bevakningar (MALLGRUPPER) med målvärden ur riktlinjerna, och skriver själv vad gruppen betyder på vanlig
// svenska, så att ingen behöver kunna koderna.
//
// Två nivåer, och samma regler som i resten av systemet:
//   enhet   läkare och sjuksköterskor grupperar de patienter som de har vårdrelation till på den egna vårdenheten och
//           får en lista med patienterna, maskerad för skyddad identitet. Villkoren prövas bara mot uppgifter från den
//           egna vårdenheten och mot läkemedelslistan, som är gemensam, aldrig mot uppgifter som kräver ett aktivt val
//           eller som patienten har spärrat. Varje patient i listan loggas.
//   region  uppföljningsrollen får samma grupper och statistiken som antal för hela vårdgivaren, utan personuppgifter.
//           Uppgifter från en spärrad vårdenhet och patienter med skyddade personuppgifter räknas inte, som i
//           datauttaget. Antal mellan 1 och 4 visas som färre än 5, och när bara en ruta i en fördelning skulle döljas
//           döljs också den näst minsta, så att den dolda inte kan räknas fram ur summan. Uttaget loggas utan patient.
// Statistiken för vårdenhetens nivå (behörigheten statistik) räknas bara på uppgifter från den egna vårdenheten.
//
// Urval och resultat kan sparas, återanvändas och delas: ett delat urval syns för de andra på samma vårdenhet, eller för
// de andra med uppföljningsrollen, och prövas alltid med den behörighet som den som använder det har. Ett sparat
// resultat innehåller bara antal, aldrig vilka patienter som ingick.
import { Fel, iso, idag, addDagar } from './db.js';
import { kanRoll, vardenhetFor, aktivaSparrar, harVardrelation, alder as alderAv, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { ICD10SE, KVA } from './kodverk.js';
import * as LV from '../public/js/levnadsvanor-regler.js';
import * as TB from '../public/js/tobak-regler.js';

export const SCHEMA = `
-- Sparade urval: en patientgrupp (slag grupp) eller en statistikfråga (slag statistik). villkor och fraga är JSON.
-- delad 1 betyder att urvalet syns för de andra på samma vårdenhet, eller för de andra med uppföljningsrollen.
CREATE TABLE IF NOT EXISTS analysurval (
  id INTEGER PRIMARY KEY, agare_id TEXT NOT NULL, enhet_id TEXT NOT NULL, niva TEXT NOT NULL, slag TEXT NOT NULL, namn TEXT NOT NULL,
  villkor TEXT NOT NULL, fraga TEXT, delad INTEGER NOT NULL DEFAULT 0, skapad TEXT NOT NULL, borttagen TEXT,
  CHECK (slag IN ('grupp', 'statistik')), CHECK (niva IN ('enhet', 'region'))
);
-- Sparade resultat: bara antal och de dolda rutorna, aldrig patienter. Ändras och raderas inte.
CREATE TABLE IF NOT EXISTS analysresultat (
  id INTEGER PRIMARY KEY, agare_id TEXT NOT NULL, enhet_id TEXT NOT NULL, niva TEXT NOT NULL, namn TEXT NOT NULL, resultat TEXT NOT NULL,
  delad INTEGER NOT NULL DEFAULT 0, tid TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS analysresultat_andras_ej BEFORE UPDATE ON analysresultat BEGIN SELECT RAISE(ABORT, 'Ett sparat resultat ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS analysresultat_raderas_ej BEFORE DELETE ON analysresultat BEGIN SELECT RAISE(ABORT, 'Ett sparat resultat raderas inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }

export const MINSTA_ANTAL = 5;
const MAX_URVAL = 50;
const MAX_RESULTAT = 100;
const MAX_KODER = 20;

// Mätvärden som går att välja i villkoren, med målvärden ur riktlinjerna som förslag.
export const MATT_I_VILLKOR = {
  hba1c: { namn: 'HbA1c', enhet: 'mmol/mol', forslag: { jamforelse: 'over', varde: 52 }, kalla: 'Socialstyrelsen, Nationella riktlinjer för diabetesvård: målnivå HbA1c under 52 mmol/mol' },
  systoliskt: { namn: 'Systoliskt blodtryck', enhet: 'mmHg', typ: 'blodtryck', forslag: { jamforelse: 'over', varde: 139 }, kalla: 'Socialstyrelsen, Nationella riktlinjer för hypertoni: målnivå under 140 mmHg' },
  bmi: { namn: 'BMI', enhet: 'kg/m²', forslag: { jamforelse: 'over', varde: 29.9 }, kalla: 'WHO: fetma vid BMI 30 eller högre' },
  egfr: { namn: 'eGFR', enhet: 'mL/min/1,73 m²', forslag: { jamforelse: 'under', varde: 60 }, kalla: 'KDIGO: nedsatt njurfunktion vid eGFR under 60' },
  ldl: null,
  kreatinin: { namn: 'Kreatinin', enhet: 'µmol/L', forslag: { jamforelse: 'over', varde: 100 } },
  crp: { namn: 'CRP', enhet: 'mg/L', forslag: { jamforelse: 'over', varde: 10 } },
  inr: { namn: 'PK (INR)', enhet: 'INR', forslag: { jamforelse: 'over', varde: 3 } },
  ntprobnp: { namn: 'NT-proBNP', enhet: 'ng/L', forslag: { jamforelse: 'over', varde: 400 } },
  vikt: { namn: 'Vikt', enhet: 'kg', forslag: { jamforelse: 'over', varde: 100 } },
};
delete MATT_I_VILLKOR.ldl;
export const LEVNADSVANOR_I_VILLKOR = { tobak: 'Daglig rökning eller snusning, eller annat bruk som systemet föreslår stöd för', alkohol: LV.OMRADEN.alkohol.risk, fysisk: LV.OMRADEN.fysisk.risk, mat: LV.OMRADEN.mat.risk };

// Färdiga grupper för vanliga bevakningar. Den som grupperar väljer en och kan ändra villkoren.
export const MALLGRUPPER = [
  { id: 'diabetes-hba1c', namn: 'Diabetes med HbA1c över målnivån', villkor: { diagnoser: { koder: ['E10', 'E11'] }, matvarden: [{ typ: 'hba1c', jamforelse: 'over', varde: 52 }] } },
  { id: 'hypertoni-ej-matt', namn: 'Hypertoni utan blodtryck det senaste året', villkor: { diagnoser: { koder: ['I10'] }, saknarMatvarde: ['systoliskt'] } },
  { id: 'hypertoni-over-mal', namn: 'Hypertoni med blodtryck över målnivån', villkor: { diagnoser: { koder: ['I10'] }, matvarden: [{ typ: 'systoliskt', jamforelse: 'over', varde: 139 }] } },
  { id: 'hjarta-tobak', namn: 'Hjärt-kärlsjukdom och tobak', villkor: { diagnoser: { koder: ['I20', 'I21', 'I25', 'I48', 'I50'] }, levnadsvanor: ['tobak'] } },
  { id: 'riskbruk-alkohol', namn: 'Riskbruk av alkohol', villkor: { levnadsvanor: ['alkohol'] } },
  { id: 'otillracklig-fysisk', namn: 'Otillräcklig fysisk aktivitet', villkor: { levnadsvanor: ['fysisk'] } },
  { id: 'aldre-antikoagulantia', namn: '75 år och äldre med blodförtunnande läkemedel', villkor: { lakemedel: { atc: ['B01AA', 'B01AF', 'B01AE'] }, demografi: { alderFran: 75 } } },
];

export const MATT = {
  vardkontakter: { namn: 'Antal vårdkontakter', enhet: 'kontakter', grupper: ['manad', 'vardenhet', 'vardform', 'kon', 'aldersgrupp'] },
  patienter: { namn: 'Antal patienter med vårdkontakt', enhet: 'patienter', grupper: ['manad', 'vardenhet', 'vardform', 'kon', 'aldersgrupp'] },
  vardtid: { namn: 'Medelvårdtid i slutenvård', enhet: 'dagar', medel: true, grupper: ['manad', 'vardenhet', 'kon', 'aldersgrupp'] },
  diagnoser: { namn: 'Antal diagnoser per diagnoskategori', enhet: 'diagnoser', grupper: ['kategori', 'manad', 'vardenhet', 'kon', 'aldersgrupp'] },
  ordinationer: { namn: 'Antal nya ordinationer per läkemedelsgrupp', enhet: 'ordinationer', grupper: ['kategori', 'manad', 'vardenhet', 'kon', 'aldersgrupp'] },
  remissledtid: { namn: 'Median dagar från remiss till svar', enhet: 'dagar', median: true, grupper: ['manad', 'vardenhet'] },
  labbsvarstid: { namn: 'Median timmar från provtagning till svar', enhet: 'timmar', median: true, grupper: ['manad', 'vardenhet'] },
};
export const GRUPPER = { manad: 'Månad', vardenhet: 'Vårdenhet', vardform: 'Vårdform', kon: 'Kön', aldersgrupp: 'Åldersgrupp', kategori: 'Kategori' };
const VARDFORM = { oppenvard: 'Öppenvård', akut: 'Akut', slutenvard: 'Slutenvård', hemsjukvard: 'Hemsjukvård', dagkirurgi: 'Dagkirurgi' };

const dagMs = 86400_000;
const datumAv = (t) => (t ? String(t).slice(0, 10) : null);
const aldersgrupp = (a) => (a >= 80 ? '80-' : a < 18 ? '0-17' : `${Math.floor(a / 10) * 10}-${Math.floor(a / 10) * 10 + 9}`.replace('10-19', '18-19'));

// Nivån för den inloggade, eller ett fel som loggas.
function niva(db, personal, slag) {
  if (kanRoll(personal, 'statistik_region')) return 'region';
  const kravs = slag === 'grupp' ? 'patientgrupp' : 'statistik';
  if (kanRoll(personal, kravs)) return 'enhet';
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: kravs, resurs: `analys:${slag}`, grund: 'nekad', resultat: 'nekad' });
  throw new Fel(403, slag === 'grupp' ? 'Yrkesrollen får inte gruppera patienter.' : 'Yrkesrollen får inte se statistik.', 'nekad');
}

// Kontrollerar villkoren och ger dem i den form som används. Okända koder förklaras.
export function provaVillkor(v = {}) {
  const fel = (text, falt) => { throw new Fel(400, text, 'ogiltig', { falt: [falt] }); };
  if (!v || typeof v !== 'object' || Array.isArray(v)) fel('Villkoren saknas.', 'villkor');
  const ut = {};
  const koder = (lista, monster, falt, text) => {
    if (!Array.isArray(lista) || !lista.length || lista.length > MAX_KODER) fel(`Ange mellan 1 och ${MAX_KODER} ${text}.`, falt);
    return [...new Set(lista.map(k => String(k).trim().toUpperCase()).filter(Boolean))].map(k => (monster.test(k) ? k : fel(`${k} är ingen giltig ${text.replace(/er$/, '')}. ${falt === 'diagnoser' ? 'Skriv en ICD-10-kod eller början av en, till exempel I10 eller E11.' : falt === 'lakemedel' ? 'Skriv en ATC-kod eller början av en, till exempel C09 eller A10.' : 'Skriv en KVÅ-kod, till exempel DV113.'}`, falt)));
  };
  if (v.diagnoser) ut.diagnoser = { koder: koder(v.diagnoser.koder, /^[A-Z]\d{2}(\.\d{1,2})?$|^[A-Z]\d$/, 'diagnoser', 'diagnoskoder'), iPerioden: Boolean(v.diagnoser.iPerioden) };
  if (v.atgarder) ut.atgarder = { koder: koder(v.atgarder.koder, /^[A-Z]{2}\d{3}$/, 'atgarder', 'åtgärdskoder') };
  if (v.lakemedel) ut.lakemedel = { atc: koder(v.lakemedel.atc, /^[A-Z](\d{2}([A-Z]([A-Z](\d{2})?)?)?)?$/, 'lakemedel', 'ATC-koder') };
  if (v.matvarden) {
    if (!Array.isArray(v.matvarden) || v.matvarden.length > 6) fel('Ange högst sex mätvärden.', 'matvarden');
    ut.matvarden = v.matvarden.map(m => {
      if (!MATT_I_VILLKOR[m?.typ]) fel('Okänt mätvärde i villkoren.', 'matvarden');
      if (!['over', 'under'].includes(m.jamforelse)) fel('Välj över eller under för mätvärdet.', 'matvarden');
      const n = Number(String(m.varde).replace(',', '.'));
      if (!Number.isFinite(n)) fel(`Skriv gränsen för ${MATT_I_VILLKOR[m.typ].namn} som ett tal.`, 'matvarden');
      return { typ: m.typ, jamforelse: m.jamforelse, varde: n };
    });
  }
  if (v.saknarMatvarde) {
    if (!Array.isArray(v.saknarMatvarde) || v.saknarMatvarde.some(t => !MATT_I_VILLKOR[t])) fel('Okänt mätvärde i villkoren.', 'saknarMatvarde');
    ut.saknarMatvarde = [...new Set(v.saknarMatvarde)];
  }
  if (v.levnadsvanor) {
    if (!Array.isArray(v.levnadsvanor) || !v.levnadsvanor.length || v.levnadsvanor.some(t => !LEVNADSVANOR_I_VILLKOR[t])) fel('Välj levnadsvanor bland tobak, alkohol, fysisk aktivitet och matvanor.', 'levnadsvanor');
    ut.levnadsvanor = [...new Set(v.levnadsvanor)];
  }
  if (v.besok) {
    const minst = Number(v.besok.minst ?? 1);
    if (!Number.isInteger(minst) || minst < 0 || minst > 100) fel('Antalet besök ska vara ett heltal mellan 0 och 100.', 'besok');
    const hogst = v.besok.hogst == null || v.besok.hogst === '' ? null : Number(v.besok.hogst);
    if (hogst != null && (!Number.isInteger(hogst) || hogst < minst)) fel('Högsta antalet besök kan inte vara mindre än det minsta.', 'besok');
    ut.besok = { minst, hogst, vardform: VARDFORM[v.besok.vardform] ? v.besok.vardform : null };
  }
  if (v.demografi) {
    const d = v.demografi;
    const tal = (x) => (x == null || x === '' ? null : Number(x));
    const fran = tal(d.alderFran);
    const till = tal(d.alderTill);
    if ((fran != null && (!Number.isInteger(fran) || fran < 0 || fran > 120)) || (till != null && (!Number.isInteger(till) || till < 0 || till > 120))) fel('Åldern ska vara ett heltal mellan 0 och 120.', 'demografi');
    if (fran != null && till != null && till < fran) fel('Den högsta åldern kan inte vara lägre än den lägsta.', 'demografi');
    if (d.kon != null && d.kon !== '' && !['kvinna', 'man'].includes(d.kon)) fel('Kön är kvinna eller man.', 'demografi');
    ut.demografi = { alderFran: fran, alderTill: till, kon: d.kon || null };
  }
  ut.period = provaPeriod(v.period);
  if (!Object.keys(ut).some(k => k !== 'period')) fel('Välj minst ett villkor, till exempel en diagnos, ett mätvärde eller en levnadsvana.', 'villkor');
  return ut;
}

// Perioden: ett år bakåt från i dag om inget annat anges.
export function provaPeriod(p = {}) {
  const fel = (text) => { throw new Fel(400, text, 'ogiltig', { falt: ['period'] }); };
  const giltig = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  const q = p ?? {};
  const till = q.till ? (giltig(q.till) ? q.till : fel('Skriv periodens slut som ÅÅÅÅ-MM-DD.')) : idag();
  const fran = q.fran ? (giltig(q.fran) ? q.fran : fel('Skriv periodens början som ÅÅÅÅ-MM-DD.')) : addDagar(till, -365);
  if (fran > till) fel('Perioden börjar efter att den slutar.');
  return { fran, till };
}

// Patienterna som uppfyller villkoren, utan loggning. Anroparen loggar det som lämnas ut.
export function traffar(db, personal, villkor, niv) {
  const u = underlag(db, personal, niv);
  const ut = [];
  for (const p of u.patienter) {
    if (niv === 'enhet' && !harVardrelation(db, p.id, u.min)) continue;
    const skal = matcha(u, p, villkor);
    if (skal) ut.push({ p, skal });
  }
  return { u, traffar: ut };
}

// Villkoren på vanlig svenska, som systemet skriver själv.
export function beskriv(v) {
  const delar = [];
  const lista = (k) => k.join(', ').replace(/, ([^,]*)$/, ' eller $1');
  if (v.diagnoser) delar.push(`diagnos ${lista(v.diagnoser.koder.map(k => (ICD10SE[k] ? `${k} ${ICD10SE[k].toLowerCase()}` : k)))}${v.diagnoser.iPerioden ? ' under perioden' : ''}`);
  if (v.atgarder) delar.push(`åtgärd ${lista(v.atgarder.koder.map(k => (KVA[k] ? `${k} ${KVA[k].toLowerCase()}` : k)))} under perioden`);
  if (v.lakemedel) delar.push(`pågående läkemedel med ATC ${lista(v.lakemedel.atc)}`);
  for (const m of v.matvarden ?? []) delar.push(`senaste ${MATT_I_VILLKOR[m.typ].namn} under perioden ${m.jamforelse === 'over' ? 'över' : 'under'} ${String(m.varde).replace('.', ',')} ${MATT_I_VILLKOR[m.typ].enhet}`);
  for (const t of v.saknarMatvarde ?? []) delar.push(`inget ${MATT_I_VILLKOR[t].namn} registrerat under perioden`);
  if (v.levnadsvanor) delar.push(lista(v.levnadsvanor.map(l => LEVNADSVANOR_I_VILLKOR[l].toLowerCase())) + ' i den senaste dokumentationen');
  if (v.besok) delar.push(`${v.besok.hogst != null ? `mellan ${v.besok.minst} och ${v.besok.hogst}` : `minst ${v.besok.minst}`} ${v.besok.vardform ? `${VARDFORM[v.besok.vardform].toLowerCase()}skontakter` : 'vårdkontakter'} under perioden`);
  if (v.demografi) {
    const d = v.demografi;
    if (d.alderFran != null || d.alderTill != null) delar.push(d.alderFran != null && d.alderTill != null ? `${d.alderFran} till ${d.alderTill} år` : d.alderFran != null ? `${d.alderFran} år eller äldre` : `${d.alderTill} år eller yngre`);
    if (d.kon) delar.push(d.kon === 'kvinna' ? 'kvinnor' : 'män');
  }
  return `Patienter med ${delar.join(', och ')}. Perioden är ${v.period.fran} till ${v.period.till}.`;
}

// Underlaget: vilka rader som får räknas för vilka patienter, efter nivå. Läses en gång per anrop.
export function underlag(db, personal, niv) {
  const min = vardenhetFor(db, personal.enhet_id);
  const sparrar = new Map();
  const sparrad = (pid, ve) => {
    if (!sparrar.has(pid)) sparrar.set(pid, aktivaSparrar(db, pid));
    return sparrar.get(pid).includes(ve);
  };
  const veCache = new Map();
  const ve = (e) => { if (!veCache.has(e)) veCache.set(e, vardenhetFor(db, e)); return veCache.get(e); };
  // En rad får räknas: på regionens nivå om den inte kommer från en spärrad vårdenhet, på vårdenhetens nivå bara om den
  // kommer från den egna vårdenheten, eller är gemensam (läkemedelslistan) och inte spärrad.
  const far = (pid, enhetId, { gemensam = false } = {}) => {
    const v = ve(enhetId);
    if (v !== min && sparrad(pid, v)) return false;
    if (niv === 'region') return true;
    return v === min || gemensam;
  };
  const patienter = db.query('SELECT * FROM patienter WHERE sammanslagen_till IS NULL').all().filter(p => niv !== 'region' || !p.skyddad);
  const per = (sql) => {
    const m = new Map();
    for (const r of db.query(sql).all()) { if (!m.has(r.patient_id)) m.set(r.patient_id, []); m.get(r.patient_id).push(r); }
    return m;
  };
  const harTabell = (t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
  const atc = new Map(db.query('SELECT id, atc FROM katalog').all().map(k => [k.id, k.atc]));
  return {
    min, far, ve, patienter, atc,
    diagnoser: per('SELECT * FROM diagnoser'),
    atgarder: harTabell('atgarder') ? per('SELECT * FROM atgarder') : new Map(),
    ordinationer: per('SELECT * FROM ordinationer'),
    matvarden: per('SELECT * FROM matvarden ORDER BY tid DESC, id DESC'),
    kontakter: per('SELECT * FROM vardkontakter'),
    // Levnadsvanorna: signerade anteckningar i den gällande versionen.
    tobak: harTabell('tobaksvanor') ? per(`SELECT a.patient_id, a.enhet_id, a.signerad_tid AS tid, t.svar, t.alder FROM tobaksvanor t JOIN anteckningar a ON a.id = t.anteckning_id
      WHERE a.status = 'signerad' AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id) ORDER BY a.signerad_tid DESC`) : new Map(),
    levnadsvanor: harTabell('levnadsvanor') ? per(`SELECT a.patient_id, a.enhet_id, a.signerad_tid AS tid, l.risk FROM levnadsvanor l JOIN anteckningar a ON a.id = l.anteckning_id
      WHERE a.status = 'signerad' AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id) ORDER BY a.signerad_tid DESC`) : new Map(),
  };
}

// Senaste värdet av ett mätvärde under perioden bland de rader som får räknas. BMI räknas ur vikt och längd.
function senasteMatt(u, pid, typ, period) {
  const rader = (u.matvarden.get(pid) ?? []).filter(m => u.far(pid, m.enhet_id) && datumAv(m.tid) >= period.fran && datumAv(m.tid) <= period.till);
  if (typ === 'bmi') {
    const vikt = rader.find(m => m.typ === 'vikt');
    const langd = (u.matvarden.get(pid) ?? []).find(m => m.typ === 'langd' && u.far(pid, m.enhet_id));
    if (!vikt || !langd?.varde_num) return null;
    return { varde: Math.round(vikt.varde_num / (langd.varde_num / 100) ** 2 * 10) / 10, tid: vikt.tid, text: 'BMI' };
  }
  const t = MATT_I_VILLKOR[typ].typ ?? typ;
  const m = rader.find(x => x.typ === t);
  if (!m) return null;
  const varde = typ === 'systoliskt' ? Number(String(m.varde).split('/')[0]) : m.varde_num ?? Number(m.varde);
  return { varde, tid: m.tid, text: m.varde };
}

// Risken i den senaste dokumentationen av levnadsvanan bland de rader som får räknas.
export function levnadsvana(u, pid, omr) {
  if (omr === 'tobak') {
    const t = (u.tobak.get(pid) ?? []).find(r => u.far(pid, r.enhet_id));
    if (!t) return null;
    const f = TB.forslag(JSON.parse(t.svar), { alder: t.alder });
    return { risk: Boolean(f.kod), tid: t.tid };
  }
  const l = (u.levnadsvanor.get(pid) ?? []).find(r => u.far(pid, r.enhet_id) && Object.hasOwn(JSON.parse(r.risk), omr));
  return l ? { risk: Boolean(JSON.parse(l.risk)[omr]), tid: l.tid } : null;
}

// Prövar villkoren för en patient. Ger null, eller skälen på vanlig svenska.
export function matcha(u, p, v) {
  const skal = [];
  const pid = p.id;
  const { fran, till } = v.period;
  const iPerioden = (d) => d && datumAv(d) >= fran && datumAv(d) <= till;
  if (v.demografi) {
    const a = alderAv(p.fodd, till);
    if (v.demografi.alderFran != null && a < v.demografi.alderFran) return null;
    if (v.demografi.alderTill != null && a > v.demografi.alderTill) return null;
    if (v.demografi.kon && p.kon !== v.demografi.kon) return null;
  }
  if (v.diagnoser) {
    const d = (u.diagnoser.get(pid) ?? []).filter(x => u.far(pid, x.enhet_id) && v.diagnoser.koder.some(k => x.kod.startsWith(k)) && (!v.diagnoser.iPerioden || iPerioden(x.datum)) && x.datum <= till);
    if (!d.length) return null;
    const s = d.sort((a, b) => b.datum.localeCompare(a.datum))[0];
    skal.push(`Diagnos ${s.kod} ${s.datum}`);
  }
  if (v.atgarder) {
    const a = (u.atgarder.get(pid) ?? []).filter(x => u.far(pid, x.enhet_id) && v.atgarder.koder.includes(x.kod) && iPerioden(x.tid));
    if (!a.length) return null;
    skal.push(`Åtgärd ${a[0].kod} ${datumAv(a[0].tid)}`);
  }
  if (v.lakemedel) {
    const o = (u.ordinationer.get(pid) ?? []).filter(x => u.far(pid, x.enhet_id, { gemensam: true }) && x.status === 'aktiv' && x.start <= till && (!x.slut || x.slut >= till)
      && v.lakemedel.atc.some(k => (u.atc.get(x.lakemedel_id) ?? '').startsWith(k)));
    if (!o.length) return null;
    skal.push(`Läkemedel med ATC ${u.atc.get(o[0].lakemedel_id)}`);
  }
  for (const m of v.matvarden ?? []) {
    const s = senasteMatt(u, pid, m.typ, v.period);
    if (!s || !(m.jamforelse === 'over' ? s.varde > m.varde : s.varde < m.varde)) return null;
    skal.push(`Senaste ${MATT_I_VILLKOR[m.typ].namn} ${String(s.text).replace('.', ',')} ${datumAv(s.tid)}`);
  }
  for (const t of v.saknarMatvarde ?? []) {
    if (senasteMatt(u, pid, t, v.period)) return null;
    skal.push(`Inget ${MATT_I_VILLKOR[t].namn} under perioden`);
  }
  if (v.levnadsvanor) {
    const traff = v.levnadsvanor.map(o => [o, levnadsvana(u, pid, o)]).filter(([, x]) => x?.risk);
    if (!traff.length) return null;
    for (const [o, x] of traff) skal.push(`${o === 'tobak' ? 'Tobak' : LV.OMRADEN[o].risk} ${datumAv(x.tid)}`);
  }
  if (v.besok) {
    const k = (u.kontakter.get(pid) ?? []).filter(x => u.far(pid, x.enhet_id) && iPerioden(x.start) && (!v.besok.vardform || x.typ === v.besok.vardform));
    if (k.length < v.besok.minst || (v.besok.hogst != null && k.length > v.besok.hogst)) return null;
    skal.push(`${k.length} ${k.length === 1 ? 'vårdkontakt' : 'vårdkontakter'} under perioden`);
  }
  return skal;
}

// Döljer antal mellan 1 och 4, och den näst minsta rutan när bara en ruta i en fördelning skulle döljas.
export function skydda(rader, falt = 'varde') {
  const ut = rader.map(r => (r[falt] > 0 && r[falt] < MINSTA_ANTAL ? { ...r, [falt]: null, dolt: true } : r));
  if (ut.filter(r => r.dolt).length === 1) {
    const kvar = ut.filter(r => !r.dolt && r[falt] > 0).sort((a, b) => a[falt] - b[falt])[0];
    if (kvar) Object.assign(kvar, { [falt]: null, dolt: true, doltForAttSkydda: true });
  }
  return ut;
}
const skyddaTal = (n) => (n > 0 && n < MINSTA_ANTAL ? null : n);

function villkorFran(db, personal, inp) {
  if (inp.urvalId != null) {
    const u = synligtUrval(db, personal, inp.urvalId);
    if (u.slag !== 'grupp') throw new Fel(400, 'Urvalet är ingen patientgrupp.', 'ogiltig');
    const v = JSON.parse(u.villkor);
    // En sparad grupp gäller alltid den senaste perioden av samma längd, om inget annat anges.
    if (!inp.period && v.period) { const dagar = Math.round((Date.parse(v.period.till) - Date.parse(v.period.fran)) / dagMs); v.period = { fran: addDagar(idag(), -dagar), till: idag() }; }
    if (inp.period) v.period = inp.period;
    return { villkor: provaVillkor(v), urval: u };
  }
  if (inp.mall) {
    const m = MALLGRUPPER.find(x => x.id === inp.mall);
    if (!m) throw new Fel(400, 'Den färdiga gruppen finns inte.', 'ogiltig', { falt: ['mall'] });
    return { villkor: provaVillkor({ ...m.villkor, period: inp.period }), mall: m };
  }
  return { villkor: provaVillkor(inp.villkor) };
}

// POST /api/analys/grupp { villkor | mall | urvalId, period? }.
export function grupp(db, personal, inp = {}) {
  const niv = niva(db, personal, 'grupp');
  const { villkor, urval, mall } = villkorFran(db, personal, inp);
  const { u, traffar: lista } = traffar(db, personal, villkor, niv);
  const bas = { niva: niv, villkor, text: beskriv(villkor), namn: urval?.namn ?? mall?.namn ?? null, urvalId: urval?.id ?? null };
  if (niv === 'enhet') {
    const t = iso();
    for (const { p } of lista) loggaRad(db, { tid: t, personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: p.id, handling: 'patientgrupp', resurs: `analys:grupp${urval ? `:${urval.id}` : ''}`, grund: 'vardrelation', resultat: 'tillaten' });
    return {
      ...bas, vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(u.min)?.namn, antal: lista.length,
      patienter: lista.sort((a, b) => a.p.efternamn.localeCompare(b.p.efternamn, 'sv')).map(({ p, skal }) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad), alder: alderAv(p.fodd, idag()), kon: p.kon, skal })),
      anmarkning: 'Gruppen omfattar patienter som du har vårdrelation till på din vårdenhet. Villkoren prövas bara mot uppgifter från din vårdenhet och mot läkemedelslistan, aldrig mot uppgifter som kräver ett aktivt val eller som patienten har spärrat. Varje patient i listan loggas.',
    };
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik_region', resurs: `analys:grupp${urval ? `:${urval.id}` : ''}`, grund: 'uppfoljning', resultat: 'tillaten' });
  const fordelning = (nyckel) => {
    const m = new Map();
    for (const { p } of lista) { const k = nyckel(p); m.set(k, (m.get(k) ?? 0) + 1); }
    return skydda([...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv')).map(([k, n]) => ({ nyckel: k, varde: n })));
  };
  return {
    ...bas, antal: skyddaTal(lista.length), antalDolt: lista.length > 0 && lista.length < MINSTA_ANTAL,
    perKon: fordelning(p => (p.kon === 'kvinna' ? 'Kvinnor' : 'Män')),
    perAldersgrupp: fordelning(p => aldersgrupp(alderAv(p.fodd, idag()))),
    perListning: fordelning(p => db.query('SELECT e.namn FROM listningar l JOIN enheter e ON e.id = l.enhet_id WHERE l.patient_id = ?').get(p.id)?.namn ?? 'Inte listad'),
    anmarkning: `Antal för hela vårdgivaren, utan personuppgifter. Uppgifter från en spärrad vårdenhet och patienter med skyddade personuppgifter räknas inte. Antal mellan 1 och ${MINSTA_ANTAL - 1} visas som färre än ${MINSTA_ANTAL}.`,
  };
}

const MANAD = (d) => d.slice(0, 7);
// POST /api/analys/statistik { matt, grupp, period, vardenhet?, villkor | mall | urvalId, spara? }.
export function statistik(db, personal, inp = {}) {
  const niv = niva(db, personal, 'statistik');
  const matt = MATT[inp.matt] ? inp.matt : null;
  if (!matt) throw new Fel(400, `Välj ett mått: ${Object.values(MATT).map(m => m.namn.toLowerCase()).join(', ')}.`, 'ogiltig', { falt: ['matt'] });
  const def = MATT[matt];
  const gr = def.grupper.includes(inp.grupp) ? inp.grupp : def.grupper[0];
  const u = underlag(db, personal, niv);
  let vardenhet = null;
  if (inp.vardenhet) {
    const e = db.query("SELECT id FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(String(inp.vardenhet));
    if (!e) throw new Fel(400, 'Vårdenheten finns inte.', 'ogiltig', { falt: ['vardenhet'] });
    if (niv === 'enhet' && e.id !== u.min) {
      loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik', resurs: `analys:statistik:${e.id}`, grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Du ser statistiken för din egen vårdenhet. Statistiken för andra vårdenheter finns hos uppföljningen.', 'nekad');
    }
    vardenhet = e.id;
  }
  // Patientgruppen som filter, prövad med samma regler som statistiken.
  let grupp = null;
  if (inp.villkor || inp.mall || inp.urvalId != null) {
    const { villkor } = villkorFran(db, personal, inp);
    grupp = { villkor, text: beskriv(villkor), patienter: new Set(u.patienter.filter(p => matcha(u, p, villkor)).map(p => p.id)) };
  }
  const per = provaPeriod(inp.period);
  const pmap = new Map(u.patienter.map(p => [p.id, p]));
  const ok = (pid, enhetId) => pmap.has(pid) && u.far(pid, enhetId) && (!vardenhet || u.ve(enhetId) === vardenhet) && (!grupp || grupp.patienter.has(pid));
  const iPer = (d) => d && datumAv(d) >= per.fran && datumAv(d) <= per.till;
  const namnPa = (id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
  // Händelserna som räknas: { pid, enhet, datum, varde, kategori, vardform }.
  const h = [];
  if (matt === 'vardkontakter' || matt === 'patienter') {
    for (const [pid, rader] of u.kontakter) for (const v of rader) if (ok(pid, v.enhet_id) && iPer(v.start)) h.push({ pid, enhet: u.ve(v.enhet_id), datum: datumAv(v.start), vardform: v.typ, varde: 1 });
  } else if (matt === 'vardtid') {
    for (const [pid, rader] of u.kontakter) for (const v of rader) if (v.typ === 'slutenvard' && v.slut && ok(pid, v.enhet_id) && iPer(v.slut)) h.push({ pid, enhet: u.ve(v.enhet_id), datum: datumAv(v.slut), varde: Math.max(1, Math.round((Date.parse(v.slut) - Date.parse(v.start)) / dagMs)) });
  } else if (matt === 'diagnoser') {
    for (const [pid, rader] of u.diagnoser) for (const d of rader) if (ok(pid, d.enhet_id) && iPer(d.datum)) h.push({ pid, enhet: u.ve(d.enhet_id), datum: d.datum, kategori: d.kod.slice(0, 3), varde: 1 });
  } else if (matt === 'ordinationer') {
    for (const [pid, rader] of u.ordinationer) for (const o of rader) if (ok(pid, o.enhet_id) && iPer(o.start)) h.push({ pid, enhet: u.ve(o.enhet_id), datum: o.start, kategori: (u.atc.get(o.lakemedel_id) ?? '').slice(0, 3), varde: 1 });
  } else if (matt === 'remissledtid') {
    for (const r of db.query('SELECT * FROM remisser WHERE besvarad_tid IS NOT NULL').all()) {
      if (!ok(r.patient_id, r.till_enhet_id) || !u.far(r.patient_id, r.fran_enhet_id, { gemensam: niv === 'enhet' }) || !iPer(r.besvarad_tid)) continue;
      h.push({ pid: r.patient_id, enhet: u.ve(r.till_enhet_id), datum: datumAv(r.besvarad_tid), varde: Math.max(0, Math.floor((Date.parse(r.besvarad_tid) - Date.parse(r.skickad_tid)) / dagMs)) });
    }
  } else if (matt === 'labbsvarstid') {
    let rader = [];
    try { rader = db.query('SELECT a.patient_id, a.enhet_id, a.besvarad_tid, p.provtagen_tid FROM labb_analyser a JOIN labb_prov p ON p.id = a.prov_id WHERE a.besvarad_tid IS NOT NULL AND p.provtagen_tid IS NOT NULL').all(); } catch { rader = []; }
    for (const r of rader) if (ok(r.patient_id, r.enhet_id) && iPer(r.besvarad_tid)) h.push({ pid: r.patient_id, enhet: u.ve(r.enhet_id), datum: datumAv(r.besvarad_tid), varde: Math.round((Date.parse(r.besvarad_tid) - Date.parse(r.provtagen_tid)) / 360_000) / 10 });
  }
  const nyckel = {
    manad: (x) => MANAD(x.datum), vardenhet: (x) => namnPa(x.enhet), vardform: (x) => VARDFORM[x.vardform] ?? x.vardform, kategori: (x) => x.kategori || 'Okänd',
    kon: (x) => (pmap.get(x.pid).kon === 'kvinna' ? 'Kvinnor' : 'Män'), aldersgrupp: (x) => aldersgrupp(alderAv(pmap.get(x.pid).fodd, x.datum)),
  }[gr];
  const grupper = new Map();
  for (const x of h) { const k = nyckel(x); if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(x); }
  const varde = (lista) => {
    if (matt === 'patienter') return new Set(lista.map(x => x.pid)).size;
    if (def.median) { if (lista.length < MINSTA_ANTAL) return null; const s = lista.map(x => x.varde).sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 10) / 10; }
    if (def.medel) { if (lista.length < MINSTA_ANTAL) return null; return Math.round(lista.reduce((s, x) => s + x.varde, 0) / lista.length * 10) / 10; }
    return lista.length;
  };
  let rader = [...grupper].map(([k, lista]) => ({ nyckel: k, varde: varde(lista), underlag: lista.length }))
    .sort((a, b) => (gr === 'kategori' ? (b.underlag - a.underlag) || a.nyckel.localeCompare(b.nyckel, 'sv') : String(a.nyckel).localeCompare(String(b.nyckel), 'sv')));
  if (gr === 'kategori') rader = rader.slice(0, 15);
  // Antal skyddas, och ett medel eller en median som bygger på färre än fem visas inte.
  if (def.median || def.medel) rader = rader.map(r => (r.varde == null ? { ...r, dolt: true } : r));
  else rader = skydda(rader);
  rader = rader.map(({ underlag: n, ...r }) => ({ ...r, ...(def.median || def.medel ? { underlag: n >= MINSTA_ANTAL ? n : null } : {}) }));
  const summa = def.median || def.medel ? varde(h) : matt === 'patienter' ? skyddaTal(new Set(h.map(x => x.pid)).size) : skyddaTal(h.length);
  const resurs = `analys:statistik:${matt}`;
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: niv === 'region' ? 'statistik_region' : 'statistik', resurs, grund: niv === 'region' ? 'uppfoljning' : 'administrativ', resultat: 'tillaten' });
  const ut = {
    niva: niv, matt, rubrik: def.namn, enhet: def.enhet, grupp: gr, gruppRubrik: GRUPPER[gr], period: per, summa,
    vardenhet: vardenhet ? namnPa(vardenhet) : niv === 'enhet' ? namnPa(u.min) : 'Hela vårdgivaren',
    patientgrupp: grupp ? grupp.text : null, rader, diagram: gr === 'manad' ? 'linje' : 'stapel',
    anmarkning: `${niv === 'enhet' ? 'Räknat på uppgifter från din vårdenhet.' : 'Räknat för hela vårdgivaren. Uppgifter från en spärrad vårdenhet och patienter med skyddade personuppgifter räknas inte.'} Antal mellan 1 och ${MINSTA_ANTAL - 1}, och medelvärden och medianer som bygger på färre än ${MINSTA_ANTAL}, visas inte. Inga personuppgifter.`,
  };
  if (inp.spara) ut.sparat = sparaResultat(db, personal, niv, inp.spara, ut);
  return ut;
}

// Sparade urval och resultat --------------------------------------------------------------------------------------

const textFalt = (s, max, namn) => {
  const t = typeof s === 'string' ? s.trim() : '';
  if (!t) throw new Fel(400, `Ge ${namn} ett namn.`, 'ogiltig', { falt: ['namn'] });
  if (t.length > max) throw new Fel(400, `Namnet får vara högst ${max} tecken.`, 'ogiltig', { falt: ['namn'] });
  return t;
};
// Ett urval eller resultat syns för ägaren, och när det är delat för de andra på samma nivå: samma vårdenhet, eller
// uppföljningsrollen för hela vårdgivaren.
function synlig(db, personal, r) {
  if (r.agare_id === personal.id) return true;
  if (!r.delad) return false;
  const niv = kanRoll(personal, 'statistik_region') ? 'region' : 'enhet';
  if (r.niva !== niv) return false;
  return niv === 'region' || vardenhetFor(db, r.enhet_id) === vardenhetFor(db, personal.enhet_id);
}
function synligtUrval(db, personal, id) {
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM analysurval WHERE id = ? AND borttagen IS NULL').get(Number(id)) : null;
  if (!r || !synlig(db, personal, r)) throw new Fel(404, 'Urvalet finns inte.', 'saknas');
  return r;
}
const urvalUt = (db, personal, r) => ({ id: r.id, namn: r.namn, slag: r.slag, niva: r.niva, delad: Boolean(r.delad), egen: r.agare_id === personal.id,
  agare: db.query('SELECT namn FROM personal WHERE id = ?').get(r.agare_id)?.namn ?? null, skapad: r.skapad, villkor: JSON.parse(r.villkor), fraga: r.fraga ? JSON.parse(r.fraga) : null,
  text: r.slag === 'grupp' ? beskriv(JSON.parse(r.villkor)) : null });

export function sparaUrval(db, personal, inp = {}) {
  const niv = niva(db, personal, inp.slag === 'statistik' ? 'statistik' : 'grupp');
  const namn = textFalt(inp.namn, 80, 'urvalet');
  const slag = inp.slag === 'statistik' ? 'statistik' : 'grupp';
  const villkor = slag === 'grupp' ? provaVillkor(inp.villkor) : (inp.villkor ? provaVillkor(inp.villkor) : {});
  let fraga = null;
  if (slag === 'statistik') {
    if (!MATT[inp.fraga?.matt]) throw new Fel(400, 'Välj ett mått för statistiken.', 'ogiltig', { falt: ['matt'] });
    fraga = { matt: inp.fraga.matt, grupp: MATT[inp.fraga.matt].grupper.includes(inp.fraga.grupp) ? inp.fraga.grupp : MATT[inp.fraga.matt].grupper[0], vardenhet: inp.fraga.vardenhet ?? null };
  }
  if (db.query('SELECT count(*) AS n FROM analysurval WHERE agare_id = ? AND borttagen IS NULL').get(personal.id).n >= MAX_URVAL) throw new Fel(400, `Du har redan ${MAX_URVAL} sparade urval. Ta bort ett innan du sparar ett nytt.`, 'ogiltig');
  const r = db.query('INSERT INTO analysurval (agare_id, enhet_id, niva, slag, namn, villkor, fraga, delad, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(personal.id, personal.enhet_id, niv, slag, namn, JSON.stringify(villkor), fraga ? JSON.stringify(fraga) : null, inp.delad ? 1 : 0, iso());
  return urvalUt(db, personal, db.query('SELECT * FROM analysurval WHERE id = ?').get(r.lastInsertRowid));
}

export function taBortUrval(db, personal, id) {
  const r = synligtUrval(db, personal, id);
  if (r.agare_id !== personal.id) throw new Fel(403, 'Bara den som sparade urvalet kan ta bort det.', 'nekad');
  db.query('UPDATE analysurval SET borttagen = ? WHERE id = ?').run(iso(), r.id);
  return { id: r.id, borttagen: true };
}

function sparaResultat(db, personal, niv, spara, ut) {
  const namn = textFalt(spara.namn, 80, 'resultatet');
  if (db.query('SELECT count(*) AS n FROM analysresultat WHERE agare_id = ?').get(personal.id).n >= MAX_RESULTAT) throw new Fel(400, `Du har redan sparat ${MAX_RESULTAT} resultat.`, 'ogiltig');
  const r = db.query('INSERT INTO analysresultat (agare_id, enhet_id, niva, namn, resultat, delad, tid) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(personal.id, personal.enhet_id, niv, namn, JSON.stringify({ ...ut, sparat: undefined }), spara.delad ? 1 : 0, iso());
  return { id: Number(r.lastInsertRowid), namn, delad: Boolean(spara.delad) };
}

export function resultat(db, personal, id) {
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM analysresultat WHERE id = ?').get(Number(id)) : null;
  if (!r || !synlig(db, personal, r)) throw new Fel(404, 'Resultatet finns inte.', 'saknas');
  return { id: r.id, namn: r.namn, tid: r.tid, delad: Boolean(r.delad), av: db.query('SELECT namn FROM personal WHERE id = ?').get(r.agare_id)?.namn ?? null, resultat: JSON.parse(r.resultat) };
}

// GET /api/analys: måtten, villkoren, de färdiga grupperna och de sparade urvalen och resultaten som syns.
export function oversikt(db, personal) {
  const kanGrupp = kanRoll(personal, 'patientgrupp') || kanRoll(personal, 'statistik_region');
  const kanStat = kanRoll(personal, 'statistik') || kanRoll(personal, 'statistik_region');
  if (!kanGrupp && !kanStat) niva(db, personal, 'statistik');
  const niv = kanRoll(personal, 'statistik_region') ? 'region' : 'enhet';
  const urval = db.query('SELECT * FROM analysurval WHERE borttagen IS NULL ORDER BY namn').all().filter(r => synlig(db, personal, r)).map(r => urvalUt(db, personal, r));
  const res = db.query('SELECT id, agare_id, enhet_id, niva, namn, delad, tid FROM analysresultat ORDER BY tid DESC').all().filter(r => synlig(db, personal, r))
    .map(r => ({ id: r.id, namn: r.namn, tid: r.tid, delad: Boolean(r.delad), egen: r.agare_id === personal.id }));
  return {
    niva: niv, kanGruppera: kanGrupp, kanStatistik: kanStat,
    vardenhet: niv === 'enhet' ? db.query('SELECT id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, personal.enhet_id)) : null,
    vardenheter: niv === 'region' ? db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all() : [],
    matt: Object.entries(MATT).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet, grupper: m.grupper.map(g => ({ id: g, namn: GRUPPER[g] })) })),
    mallgrupper: MALLGRUPPER.map(m => ({ id: m.id, namn: m.namn, villkor: m.villkor, text: beskriv(provaVillkor(m.villkor)) })),
    mattIVillkor: Object.entries(MATT_I_VILLKOR).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet, forslag: m.forslag, kalla: m.kalla ?? null })),
    levnadsvanor: Object.entries(LEVNADSVANOR_I_VILLKOR).map(([id, namn]) => ({ id, namn })),
    urval, resultat: res, minstaAntal: MINSTA_ANTAL,
  };
}
