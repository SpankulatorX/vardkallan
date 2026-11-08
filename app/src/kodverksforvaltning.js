// Förvaltning av kodverk över tid (runda 9, r4, Sussa 5.1.3.5 och 5.1.2.1). Varje kodverk som Vårdkällan använder har
// en version, ett giltighetsdatum och en källa. En ny utgåva läses in från källan (masterdata.js) eller klistras in av
// systemförvaltningen, jämförs med den som gäller och gäller först när en systemförvaltare har godkänt den. Lokala
// kodverk från verksamheten skapas på samma sätt. Diagnoser och åtgärder kontrolleras mot den utgåva som gäller den dag
// de registreras.
//
// Systemet är experten: det kontrollerar koderna i en ny utgåva (form, dubbletter, Snomed CT:s kontrollsiffra), räknar
// fram vad som är nytt, ändrat och borttaget, säger hur många uppgifter i journalen som har en kod som tas bort och
// förklarar att de står kvar som de dokumenterades. Godkänns en utgåva efter det föreslagna datumet gäller den från
// godkännandet, så att ingen utgåva gäller bakåt i tiden. En kod som inte gäller längre går inte att välja, och
// förklaringen säger vilken utgåva som tog bort den.
import { Fel, iso, datumAv, addDagar, giltigtDatum } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';
import { SYSTEM, ICD10SE, ATC, KVA, MATKOD } from './kodverk.js';
import { KODSYSTEM } from './fhir-definitioner.js';
import * as nf from './fackssprak.js';

// Texten för ett mätvärde (NPU och LOINC) läses från journal.js när den behövs, eftersom journal.js importerar mycket.
let journalModul = null;
const matNamn = (typ) => {
  journalModul ??= require('./journal.js');
  return journalModul.MATTYPER[typ]?.namn ?? typ;
};
const matKoder = (kategori, system) => () => Object.fromEntries(Object.entries(MATKOD).filter(([, k]) => k.kategori === kategori)
  .flatMap(([typ, k]) => k.coding.filter(c => c.system === system).map(c => [c.code, c.display ?? matNamn(typ)])));

// Kodverken med sin inbyggda utgåva. giltigFran är utgivarens giltighetsdatum, eller dagen då Vårdkällan kontrollerade
// koderna när utgivaren inte anger ett (LOINC, se docs/kodkontroll.md). koder ger { kod: text }. form kontrollerar en kod och formText förklarar formen.
export const KODVERK = {
  icd10se: { namn: 'ICD-10-SE', slag: 'nationellt', nf: true, system: SYSTEM.icd10se, utgivare: 'Socialstyrelsen', version: '2026', giltigFran: '2026-01-01',
    anvands: 'Diagnoser', koder: () => ICD10SE, form: (k) => /^[A-Z]\d\d(\.\d{1,2})?$/.test(k), formText: 'en bokstav, två siffror och en decimaldel, till exempel I10.9' },
  kva: { namn: 'KVÅ', slag: 'nationellt', nf: true, system: SYSTEM.kva, utgivare: 'Socialstyrelsen', version: '2026', giltigFran: '2026-01-01',
    anvands: 'Åtgärder', koder: () => KVA, form: (k) => /^([A-Z]{2}\d{3}|[A-Z]{3}\d{2})$/.test(k), formText: 'två bokstäver och tre siffror som QD008, eller tre bokstäver och två siffror som JKA21 för en operation' },
  snomed: { namn: 'Snomed CT, Vårdkällans delmängd', slag: 'internationellt', nf: true, system: SYSTEM.snomed, utgivare: 'E-hälsomyndigheten, som är Sveriges medlem i Snomed International', version: '20250201', giltigFran: '2025-02-01',
    anvands: 'Sökord, åtgärder, provtyper och fynd', koder: () => Object.fromEntries(nf.delmangd().map(d => [d.code, d.display])), form: (k) => nf.provaBegrepp(k).ok, formText: 'en identitet i Snomed CT med rätt kontrollsiffra' },
  atc: { namn: 'ATC', slag: 'internationellt', nf: false, system: SYSTEM.atc, utgivare: 'WHO:s samarbetscentrum för läkemedelsstatistik', version: '2026', giltigFran: '2026-01-20',
    anvands: 'Läkemedlens substanser och varningsreglerna', koder: () => ATC, form: (k) => /^[A-Z](\d\d([A-Z]([A-Z](\d\d)?)?)?)?$/.test(k), formText: 'som A10BA02, där nivåerna är bokstav, två siffror, bokstav, bokstav och två siffror' },
  npu: { namn: 'NPU', slag: 'internationellt', nf: false, system: SYSTEM.npu, utgivare: 'IFCC', version: '2026-09-22', giltigFran: '2026-09-22',
    anvands: 'Labbvärden', koder: matKoder('laboratory', SYSTEM.npu), form: (k) => /^NPU\d{5}$/.test(k), formText: 'NPU och fem siffror, till exempel NPU19748' },
  loinc: { namn: 'LOINC', slag: 'internationellt', nf: false, system: SYSTEM.loinc, utgivare: 'Regenstrief Institute', version: '2.83', giltigFran: '2026-11-03',
    anvands: 'Vitalparametrar och eGFR', koder: () => ({ ...matKoder('vital-signs', SYSTEM.loinc)(), ...matKoder('laboratory', SYSTEM.loinc)() }), form: (k) => /^\d{1,7}-\d$/.test(k), formText: 'siffror, bindestreck och en kontrollsiffra, till exempel 8867-4' },
};

// Vårdkällans egna kodverk, som också publiceras som CodeSystem i FHIR-API:t (fhir-definitioner.js).
const LOKAL_FORM = (k) => /^[A-Za-z0-9._:-]{1,40}$/.test(k);
const lokalaInbyggda = () => Object.fromEntries(KODSYSTEM.filter(cs => Array.isArray(cs.concept)).map(cs => [`vk:${cs.id}`, {
  namn: cs.title, slag: 'lokalt', nf: false, system: cs.url, utgivare: 'Vårdkällan', version: cs.version, giltigFran: cs.date, anvands: cs.description,
  koder: () => Object.fromEntries(cs.concept.map(c => [c.code, c.display])), form: LOKAL_FORM, formText: 'högst 40 bokstäver, siffror, punkter, kolon eller bindestreck', inbyggd: true,
}]));

const MAX_KODER = 2000;
const MAX_TEXT = 300;
const STATUS = { vantar: 'Väntar på godkännande', godkand: 'Godkänd', avslagen: 'Avslagen', aterkallad: 'Återkallad' };

export function sakerstall(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS kodverk_utgavor (
    id INTEGER PRIMARY KEY, kodverk TEXT NOT NULL, namn TEXT, version TEXT NOT NULL, giltig_fran TEXT NOT NULL, koder TEXT NOT NULL,
    jamforelse TEXT NOT NULL, kalla TEXT NOT NULL, motivering TEXT, status TEXT NOT NULL, foreslagen_av TEXT, foreslagen TEXT NOT NULL,
    beslutad_av TEXT, beslutad TEXT, kommentar TEXT, galler_fran TEXT)`);
}
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'kodverk_utgavor'").get());

// Lokala kodverk som verksamheten har skapat: de som har minst en utgåva i databasen och inte är inbyggda.
function skapadeLokala(db) {
  if (!harTabell(db)) return {};
  const rader = db.query("SELECT kodverk, namn FROM kodverk_utgavor WHERE kodverk LIKE 'lokal:%' ORDER BY id").all();
  const ut = {};
  for (const r of rader) ut[r.kodverk] ??= { namn: r.namn, slag: 'lokalt', nf: false, system: `urn:vardkallan:kodverk:${r.kodverk.slice(6)}`, utgivare: 'Verksamheten', version: null, giltigFran: null,
    anvands: 'Lokalt kodverk från verksamheten', koder: () => ({}), form: LOKAL_FORM, formText: 'högst 40 bokstäver, siffror, punkter, kolon eller bindestreck', skapat: true };
  return ut;
}

export function alla(db) { return { ...KODVERK, ...lokalaInbyggda(), ...skapadeLokala(db) }; }
const definition = (db, id) => {
  const a = alla(db);
  return Object.hasOwn(a, id) ? a[id] : null;
};

// Utgåvan som gäller en viss dag: den senaste godkända med galler_fran senast den dagen, annars den inbyggda.
export function gallande(db, id, nu = new Date()) {
  const def = definition(db, id);
  if (!def) throw new Fel(404, 'Kodverket finns inte.', 'saknas');
  const rad = harTabell(db) ? db.query("SELECT * FROM kodverk_utgavor WHERE kodverk = ? AND status = 'godkand' AND galler_fran <= ? ORDER BY galler_fran DESC, id DESC LIMIT 1").get(id, datumAv(nu)) : null;
  if (rad) return { id, version: rad.version, giltigFran: rad.galler_fran, kalla: rad.kalla, utgava: rad.id, koder: JSON.parse(rad.koder) };
  return { id, version: def.version, giltigFran: def.giltigFran, kalla: def.skapat ? null : 'Inbyggd i Vårdkällan', utgava: null, koder: { ...def.koder() } };
}

export const text = (db, id, kod, nu = new Date()) => {
  const k = gallande(db, id, nu).koder;
  return Object.hasOwn(k, kod) ? k[kod] : null;
};

// Varför en kod inte går att välja, på vanlig svenska. Säger vilken utgåva som tog bort den om den har funnits.
export function varforOgiltig(db, id, kod, nu = new Date()) {
  const def = definition(db, id);
  const g = gallande(db, id, nu);
  const tidigare = harTabell(db)
    ? db.query("SELECT version, koder FROM kodverk_utgavor WHERE kodverk = ? AND status = 'godkand' AND galler_fran <= ? ORDER BY galler_fran DESC, id DESC").all(id, datumAv(nu)).slice(1)
    : [];
  const fanns = Object.hasOwn(def.koder(), kod) || tidigare.some(t => Object.hasOwn(JSON.parse(t.koder), kod));
  if (fanns) return `Koden ${kod} finns inte bland de koder i ${def.namn} ${g.version} som gäller sedan ${g.giltigFran}. Diagnoser som redan har koden står kvar som de dokumenterades. Välj en kod som gäller i dag.`;
  return `Koden ${kod || 'saknas'} finns inte bland de koder i ${def.namn} ${g.version} som gäller i dag. Välj en kod i listan.`;
}

// Läser en utgåva i textform: en kod per rad, med semikolon eller tabb mellan koden och texten.
export function tolka(inmatat) {
  if (Array.isArray(inmatat)) return inmatat.map(r => ({ kod: String(r?.kod ?? '').trim(), text: String(r?.text ?? '').trim() }));
  return String(inmatat ?? '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => {
    const i = r.search(/[;\t]/);
    return i < 0 ? { kod: r, text: '' } : { kod: r.slice(0, i).trim(), text: r.slice(i + 1).trim() };
  });
}

// Kontrollerar koderna. Ger { ok, koder, fel } där fel är meningar på svenska, högst tio.
export function prova(def, rader) {
  const fel = [];
  if (!rader.length) return { ok: false, koder: {}, fel: ['Utgåvan har inga koder. Skriv en kod och dess text per rad, med semikolon emellan.'] };
  if (rader.length > MAX_KODER) return { ok: false, koder: {}, fel: [`En utgåva kan ha högst ${MAX_KODER} koder i demon.`] };
  const koder = Object.create(null);
  rader.forEach((r, i) => {
    const rad = `Rad ${i + 1}`;
    if (!def.form(r.kod)) fel.push(`${rad}: ${r.kod || 'koden saknas'} har inte formen för ${def.namn}, som är ${def.formText}.`);
    else if (Object.hasOwn(koder, r.kod)) fel.push(`${rad}: ${r.kod} finns två gånger. En kod får bara ha en text.`);
    else if (!r.text) fel.push(`${rad}: ${r.kod} saknar text. Texten är det användaren ser, så den behövs.`);
    else if (r.text.length > MAX_TEXT) fel.push(`${rad}: texten till ${r.kod} är längre än ${MAX_TEXT} tecken.`);
    else koder[r.kod] = r.text;
  });
  return { ok: fel.length === 0, koder: { ...koder }, fel: fel.slice(0, 10) };
}

export function jamfor(fore, efter) {
  const nya = [];
  const andrade = [];
  const borttagna = [];
  let oforandrade = 0;
  for (const [kod, t] of Object.entries(efter)) {
    if (!Object.hasOwn(fore, kod)) nya.push({ kod, text: t });
    else if (fore[kod] !== t) andrade.push({ kod, fore: fore[kod], efter: t });
    else oforandrade++;
  }
  for (const [kod, t] of Object.entries(fore)) if (!Object.hasOwn(efter, kod)) borttagna.push({ kod, text: t });
  return { nya, andrade, borttagna, oforandrade };
}

// Hur många uppgifter i journalen som har koder som tas bort eller får ny text. Bara antal, inga patientuppgifter.
// Uppgifter i journalen räknas bara inom systemförvaltarens egen vårdgivare (huvudmannen för dess enhet), och en kod
// med färre än 5 uppgifter visas som färre än 5 och räknas inte in i summan, så att antalet inte pekar ut enskilda patienter. Katalogen är inga patientuppgifter.
const ANVANDNING = {
  icd10se: { tabell: 'diagnoser', kolumn: 'kod', vad: 'diagnoser', journal: true },
  kva: { tabell: 'atgarder', kolumn: 'kod', vad: 'åtgärder', journal: true },
  atc: { tabell: 'katalog', kolumn: 'atc', vad: 'läkemedel i katalogen', journal: false },
};
export function anvandning(db, id, koder, personal = null) {
  const a = Object.hasOwn(ANVANDNING, id) ? ANVANDNING[id] : null;
  if (!a || !koder.length) return { antal: 0, vad: a?.vad ?? 'uppgifter', text: null };
  const ph = koder.map(() => '?').join(', ');
  if (!a.journal) {
    const antal = db.query(`SELECT count(*) AS n FROM ${a.tabell} WHERE ${a.kolumn} IN (${ph})`).get(...koder).n;
    return { antal, vad: a.vad, text: antal ? `${antal} ${a.vad} har en sådan kod.` : null };
  }
  const huvudman = require('./lagring.js').huvudman(db);
  const egen = personal ? huvudman.get(personal.enhet_id) : null;
  const enheter = [...huvudman].filter(([, h]) => h === egen).map(([e]) => e);
  // Spärren gäller varje kod för sig. En kod med 1 till 4 uppgifter räknas aldrig in i summan, eftersom två
  // förhandsvisningar med och utan koden annars skulle ge dess antal som skillnaden.
  const rader = enheter.length
    ? db.query(`SELECT ${a.kolumn} AS kod, count(*) AS n FROM ${a.tabell} WHERE ${a.kolumn} IN (${ph}) AND enhet_id IN (${enheter.map(() => '?').join(', ')}) GROUP BY ${a.kolumn}`).all(...koder, ...enheter) : [];
  const stora = rader.filter(r => r.n >= 5).reduce((sum, r) => sum + r.n, 0);
  const sma = rader.filter(r => r.n < 5).length;
  const dar = `${a.vad} hos den egna vårdgivaren har en sådan kod.`;
  const text = stora && sma ? `Minst ${stora} ${dar} Koder med färre än 5 räknas inte med, så att antalet inte pekar ut enskilda patienter.`
    : stora ? `${stora} ${dar}`
      : sma === 1 ? `Färre än 5 ${dar}`
        : sma ? `Färre än 5 ${a.vad} per kod hos den egna vårdgivaren har en sådan kod.` : null;
  return { antal: stora || null, minst: Boolean(stora && sma), vad: a.vad, text };
}

function effekt(db, id, j, def, personal) {
  const ut = [];
  if (j.nya.length) ut.push(`${j.nya.length} nya ${j.nya.length === 1 ? 'kod' : 'koder'} går att välja.`);
  if (j.andrade.length) ut.push(`${j.andrade.length} ${j.andrade.length === 1 ? 'kod får' : 'koder får'} ny text. Uppgifter som redan är dokumenterade visar texten som den var.`);
  if (j.borttagna.length) {
    const a = anvandning(db, id, j.borttagna.map(b => b.kod), personal);
    ut.push(`${j.borttagna.length} ${j.borttagna.length === 1 ? 'kod tas' : 'koder tas'} bort och går inte att välja för nya uppgifter.`
      + (a.text ? ` ${a.text} De står kvar som de dokumenterades.` : ''));
  }
  if (!j.nya.length && !j.andrade.length && !j.borttagna.length) ut.push(`Utgåvan har samma koder och texter som ${def.namn} som gäller i dag.`);
  return ut;
}

function kravRoll(personal) {
  if (!kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen förvaltar kodverken.', 'nekad');
}
const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs, grund: 'administrativ' });

// Namnet på ett nytt lokalt kodverk blir dess id.
const slug = (namn) => namn.toLocaleLowerCase('sv').replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Gemensam prövning för förhandsvisningen och förslaget. Ger kodverkets id och definition, koderna och jämförelsen.
function provaForslag(db, { kodverk, namn, version, giltigFran, koder } = {}, nu) {
  let id = typeof kodverk === 'string' ? kodverk : '';
  let def;
  if (id === 'nytt') {
    const n = typeof namn === 'string' ? namn.trim() : '';
    if (n.length < 3 || n.length > 80) throw new Fel(400, 'Ge det lokala kodverket ett namn på 3 till 80 tecken, till exempel Besöksorsaker på akuten.', 'ogiltig', { falt: ['namn'] });
    const s = slug(n);
    if (!s) throw new Fel(400, 'Namnet behöver minst en bokstav eller siffra.', 'ogiltig', { falt: ['namn'] });
    id = `lokal:${s}`;
    if (definition(db, id)) throw new Fel(409, `Det finns redan ett lokalt kodverk som heter ${n}. Lägg in en ny utgåva av det i stället.`, 'ogiltig', { falt: ['namn'] });
    def = { namn: n, form: LOKAL_FORM, formText: 'högst 40 bokstäver, siffror, punkter, kolon eller bindestreck', koder: () => ({}) };
  } else {
    def = definition(db, id);
    if (!def) throw new Fel(404, 'Kodverket finns inte.', 'saknas');
    if (def.inbyggd) throw new Fel(400, `${def.namn} är en del av Vårdkällans egen kod och ändras med en ny version av systemet, inte här.`, 'ogiltig');
  }
  const v = typeof version === 'string' ? version.trim() : '';
  if (!v || v.length > 40) throw new Fel(400, 'Skriv utgåvans version, till exempel 2027 eller 2027-01-01, som källan anger den.', 'ogiltig', { falt: ['version'] });
  const dag = datumAv(nu);
  const datum = giltigFran ?? addDagar(dag, 1);
  if (!giltigtDatum(datum)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['giltigFran'] });
  if (datum < dag) throw new Fel(400, 'En utgåva kan inte gälla bakåt i tiden. Det som redan är dokumenterat bedöms efter den utgåva som gällde då.', 'ogiltig', { falt: ['giltigFran'] });
  const p = prova(def, tolka(koder));
  const fore = id.startsWith('lokal:') && !definition(db, id) ? {} : gallande(db, id, nu).koder;
  return { id, def, namn: def.namn, version: v, giltigFran: datum, prov: p, jamforelse: p.ok ? jamfor(fore, p.koder) : null };
}

export function forhandsvisa(db, personal, body = {}, nu = new Date()) {
  kravRoll(personal);
  const f = provaForslag(db, body, nu);
  return {
    kodverk: f.id, namn: f.namn, version: f.version, giltigFran: f.giltigFran, ok: f.prov.ok, fel: f.prov.fel, antal: Object.keys(f.prov.koder).length,
    jamforelse: f.jamforelse, effekt: f.jamforelse ? [...effekt(db, f.id, f.jamforelse, f.def, personal), `Gäller från ${f.giltigFran}, när en annan systemförvaltare har godkänt utgåvan.`] : [],
  };
}

function spara(db, { id, namn, version, giltigFran, koder, jamforelse, kalla, motivering, foreslagenAv }, nu) {
  sakerstall(db);
  if (db.query("SELECT 1 FROM kodverk_utgavor WHERE kodverk = ? AND status = 'vantar'").get(id)) {
    throw new Fel(409, 'Det finns redan en utgåva av kodverket som väntar på godkännande. Godkänn, avslå eller återkalla den först.', 'ogiltig');
  }
  if (db.query("SELECT 1 FROM kodverk_utgavor WHERE kodverk = ? AND version = ? AND status IN ('vantar', 'godkand')").get(id, version)) {
    throw new Fel(409, `Utgåvan ${version} finns redan.`, 'ogiltig', { falt: ['version'] });
  }
  const r = db.query(`INSERT INTO kodverk_utgavor (kodverk, namn, version, giltig_fran, koder, jamforelse, kalla, motivering, status, foreslagen_av, foreslagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vantar', ?, ?)`).run(id, namn, version, giltigFran, JSON.stringify(koder), JSON.stringify(jamforelse), kalla, motivering, foreslagenAv, iso(nu));
  return Number(r.lastInsertRowid);
}

// Föreslår en utgåva som systemförvaltaren har klistrat in. Den gäller när en annan systemförvaltare har godkänt den.
export function foresla(db, personal, body = {}, nu = new Date()) {
  kravRoll(personal);
  const f = provaForslag(db, body, nu);
  if (!f.prov.ok) throw new Fel(400, f.prov.fel.join(' '), 'ogiltig', { falt: ['koder'] });
  const m = typeof body.motivering === 'string' ? body.motivering.trim() : '';
  if (!m) throw new Fel(400, 'Skriv varför utgåvan behövs, till exempel att källan har gett ut en ny version. Motiveringen följer med i historiken.', 'ogiltig', { falt: ['motivering'] });
  if (m.length > 1000) throw new Fel(400, 'Motiveringen får vara högst 1000 tecken.', 'ogiltig', { falt: ['motivering'] });
  const id = spara(db, { ...f, koder: f.prov.koder, kalla: 'Inklistrad av systemförvaltningen', motivering: m, foreslagenAv: personal.id }, nu);
  loggaAtgard(db, personal, `kodverk:${id}`);
  return { utgava: utgavaUt(db, hamta(db, id), personal) };
}

// En ny utgåva från en masterdatakälla. Den läggs som förslag från källan, och en systemförvaltare godkänner den.
export function franKalla(db, { kodverk, version, giltigFran, koder }, kallaNamn, nu = new Date()) {
  const def = definition(db, kodverk);
  if (!def || def.inbyggd) return { status: 'okand', text: `Källan har ett kodverk som Vårdkällan inte förvaltar: ${kodverk}.` };
  sakerstall(db);
  if (db.query('SELECT 1 FROM kodverk_utgavor WHERE kodverk = ? AND version = ?').get(kodverk, version) || def.version === version) return { status: 'finns', text: `${def.namn} ${version} är redan inläst.` };
  const p = prova(def, tolka(koder));
  if (!p.ok) return { status: 'fel', text: `${def.namn} ${version} från ${kallaNamn} har fel: ${p.fel.join(' ')}` };
  const datum = giltigtDatum(giltigFran) && giltigFran >= datumAv(nu) ? giltigFran : addDagar(datumAv(nu), 1);
  if (db.query("SELECT 1 FROM kodverk_utgavor WHERE kodverk = ? AND status = 'vantar'").get(kodverk)) return { status: 'vantar', text: `En annan utgåva av ${def.namn} väntar redan på godkännande.` };
  const id = spara(db, { id: kodverk, namn: def.namn, version, giltigFran: datum, koder: p.koder, jamforelse: jamfor(gallande(db, kodverk, nu).koder, p.koder), kalla: kallaNamn,
    motivering: `Ny utgåva från ${kallaNamn}.`, foreslagenAv: null }, nu);
  return { status: 'inlast', id, text: `${def.namn} ${version} är inläst och väntar på godkännande.` };
}

function hamta(db, id) {
  const a = harTabell(db) ? db.query('SELECT * FROM kodverk_utgavor WHERE id = ?').get(Number(id)) : null;
  if (!a) throw new Fel(404, 'Utgåvan finns inte.', 'saknas');
  return a;
}
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

export function utgavaUt(db, a, personal = null) {
  const j = JSON.parse(a.jamforelse);
  return {
    id: a.id, kodverk: a.kodverk, namn: a.namn, version: a.version, giltigFran: a.giltig_fran, gallerFran: a.galler_fran, kalla: a.kalla, motivering: a.motivering,
    antal: Object.keys(JSON.parse(a.koder)).length, jamforelse: { nya: j.nya.length, andrade: j.andrade.length, borttagna: j.borttagna.length, oforandrade: j.oforandrade },
    andringar: { nya: j.nya.slice(0, 50), andrade: j.andrade.slice(0, 50), borttagna: j.borttagna.slice(0, 50) },
    status: a.status, statusText: STATUS[a.status], foreslagenAv: a.foreslagen_av ? personnamn(db, a.foreslagen_av) : a.kalla, foreslagen: a.foreslagen,
    beslutadAv: personnamn(db, a.beslutad_av), beslutad: a.beslutad, kommentar: a.kommentar,
    egen: Boolean(personal && a.foreslagen_av === personal.id),
    kanGodkanna: Boolean(personal && a.status === 'vantar' && a.foreslagen_av !== personal.id),
  };
}

// Godkänner en utgåva. Fyra ögon: den som föreslog den kan inte godkänna den. En utgåva från en källa godkänns av en
// systemförvaltare. Koderna prövas igen, och godkänns den efter det föreslagna datumet gäller den från godkännandet.
export function godkann(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const a = hamta(db, id);
  if (a.status !== 'vantar') throw new Fel(409, 'Utgåvan är redan beslutad.', 'ogiltig');
  if (a.foreslagen_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som lade in utgåvan måste godkänna den.', 'nekad');
  const def = definition(db, a.kodverk) ?? { namn: a.namn, form: LOKAL_FORM, formText: '' };
  const p = prova(def, tolka(Object.entries(JSON.parse(a.koder)).map(([kod, t]) => ({ kod, text: t }))));
  if (!p.ok) throw new Fel(400, `Utgåvan kan inte godkännas: ${p.fel.join(' ')}`, 'ogiltig');
  const dag = datumAv(nu);
  const galler = a.giltig_fran < dag ? dag : a.giltig_fran;
  db.query("UPDATE kodverk_utgavor SET status = 'godkand', beslutad_av = ?, beslutad = ?, kommentar = ?, galler_fran = ? WHERE id = ?")
    .run(personal.id, iso(nu), typeof kommentar === 'string' && kommentar.trim() ? kommentar.trim().slice(0, 500) : null, galler, a.id);
  loggaAtgard(db, personal, `kodverk:${a.id}`);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id,
    beskrivning: `Kodverket ${a.namn} ${a.version} gäller från ${galler}, inlagt av ${a.foreslagen_av ? personnamn(db, a.foreslagen_av) : a.kalla} och godkänt av ${personal.namn}.` });
  return { utgava: utgavaUt(db, hamta(db, a.id), personal) };
}

export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const a = hamta(db, id);
  if (a.status !== 'vantar') throw new Fel(409, 'Utgåvan är redan beslutad.', 'ogiltig');
  const egen = a.foreslagen_av === personal.id;
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (!egen && !k) throw new Fel(400, 'Skriv varför utgåvan avslås, så att den som lade in den vet vad som behöver göras.', 'ogiltig', { falt: ['kommentar'] });
  db.query('UPDATE kodverk_utgavor SET status = ?, beslutad_av = ?, beslutad = ?, kommentar = ? WHERE id = ?').run(egen ? 'aterkallad' : 'avslagen', personal.id, iso(nu), k || null, a.id);
  loggaAtgard(db, personal, `kodverk:${a.id}`);
  return { utgava: utgavaUt(db, hamta(db, a.id), personal) };
}

// Kodverken med utgåvan som gäller, kommande utgåvor, utgåvor som väntar och historiken. Inga patientuppgifter.
export function oversikt(db, personal, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const rader = harTabell(db) ? db.query('SELECT * FROM kodverk_utgavor ORDER BY id DESC').all() : [];
  const kodverk = Object.entries(alla(db)).map(([id, def]) => {
    const g = gallande(db, id, nu);
    const kommande = rader.filter(r => r.kodverk === id && r.status === 'godkand' && r.galler_fran > dag).sort((a, b) => a.galler_fran.localeCompare(b.galler_fran))[0];
    return {
      id, namn: def.namn, slag: def.slag, nf: def.nf, system: def.system, utgivare: def.utgivare, anvands: def.anvands, inbyggd: Boolean(def.inbyggd),
      version: g.version, giltigFran: g.giltigFran, kalla: g.kalla, antal: Object.keys(g.koder).length,
      kommande: kommande ? { version: kommande.version, gallerFran: kommande.galler_fran } : null,
    };
  });
  const vantande = rader.filter(r => r.status === 'vantar').map(r => utgavaUt(db, r, personal));
  return {
    kodverk, attGodkanna: vantande.filter(u => u.kanGodkanna), mina: vantande.filter(u => u.egen),
    historik: rader.filter(r => r.status !== 'vantar').slice(0, 30).map(r => utgavaUt(db, r, personal)), forvalDatum: addDagar(dag, 1),
  };
}

// Koderna i den utgåva som gäller, för formulär, integrationer och API:t.
export function koderUt(db, id, nu = new Date()) {
  const def = definition(db, id);
  const g = gallande(db, id, nu);
  return { id, namn: def?.namn ?? id, system: def?.system ?? null, version: g.version, giltigFran: g.giltigFran, koder: Object.entries(g.koder).map(([kod, t]) => ({ kod, text: t })) };
}
