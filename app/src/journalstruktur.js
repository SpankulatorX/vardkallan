// Runda 12, r1: journalens struktur utan programmerare (Sussa 12.1.1.7 och vårt D11). Systemförvaltaren skapar och
// ändrar mallar för journalanteckningar (nya anteckningstyper med sökord), nya sökord med kod i Snomed CT, nya
// mätvärdestyper med NPU eller LOINC och enhet i UCUM, vårdgivarens ramar för en mall (sökord som måste finnas och
// sökord som får läggas till lokalt) och en vårdenhets lokala anpassning av en mall inom ramen. Varje ändring är en ny
// version som gäller först när en annan systemförvaltare har godkänt den i sin egen inloggning (fyra ögon, också som en
// kontroll i databasen). En godkänd version ändras och raderas aldrig.
//
// Systemet är experten: det sätter själv koden för ett sökord som redan finns i delmängden, kontrollerar kontrollsiffran i
// Snomed CT och LOINC, formen på NPU och enheten mot UCUM, stoppar en kod som redan används och föreslår den mätvärdestyp
// eller det sökord som redan har koden, räknar fram mätvärdestypens id och kategori, och visar innan något skickas för
// godkännande vad som påverkas: var mallen blir valbar, hur många anteckningar som redan är skrivna och står kvar som de
// skrevs, och vilka vårdenheters anpassningar som inte längre ryms i en ny ram.
//
// Konfigurationen är data i sandlådans databas, så det som skapas i en sandlåda stannar i den sandlådan.
import { Fel, iso } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';
import { SYSTEM, MATKOD, UCUM_ATOMER, UCUM_PREFIX, UCUM_VISNING } from './kodverk.js';
import { SOKORD, provaBegrepp } from './fackssprak.js';

export const SCHEMA_JOURNALSTRUKTUR = `
-- Versionerna av journalens struktur: mallar (slag mall), mätvärdestyper (mattyp), ramar för en mall (ram) och en
-- vårdenhets lokala anpassning av en mall (lokal). definition och forra är JSON. Fyra ögon: den som föreslår kan inte
-- godkänna. En version raderas aldrig och ändras inte när den är beslutad.
CREATE TABLE IF NOT EXISTS struktur_versioner (
  id INTEGER PRIMARY KEY, slag TEXT NOT NULL, nyckel TEXT NOT NULL, version INTEGER NOT NULL, definition TEXT NOT NULL,
  forra TEXT, motivering TEXT NOT NULL, foreslagen_av TEXT NOT NULL, foreslagen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vantar', beslutad_av TEXT, beslutad TEXT, beslut_kommentar TEXT,
  CHECK (slag IN ('mall', 'mattyp', 'ram', 'lokal')), CHECK (status IN ('vantar', 'godkand', 'avslagen', 'aterkallad')),
  CHECK (status <> 'godkand' OR (beslutad_av IS NOT NULL AND beslutad_av <> foreslagen_av)),
  CHECK (length(trim(motivering)) > 0), UNIQUE (slag, nyckel, version)
);
CREATE TRIGGER IF NOT EXISTS struktur_versioner_raderas_ej BEFORE DELETE ON struktur_versioner
  BEGIN SELECT RAISE(ABORT, 'En version av journalens struktur raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS struktur_versioner_andras_ej BEFORE UPDATE ON struktur_versioner
  WHEN OLD.status <> 'vantar' OR NEW.id IS NOT OLD.id OR NEW.slag IS NOT OLD.slag OR NEW.nyckel IS NOT OLD.nyckel
    OR NEW.version IS NOT OLD.version OR NEW.definition IS NOT OLD.definition OR NEW.forra IS NOT OLD.forra
    OR NEW.motivering IS NOT OLD.motivering OR NEW.foreslagen_av IS NOT OLD.foreslagen_av OR NEW.foreslagen IS NOT OLD.foreslagen
  BEGIN SELECT RAISE(ABORT, 'En beslutad version av journalens struktur ändras inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA_JOURNALSTRUKTUR); }
// Runda 13, r4: namnen på delarna av de inbyggda mätningarna, för felmeddelandet när en kod redan används.
const DELNAMN = { '8480-6': 'det systoliska trycket', '8462-4': 'det diastoliska trycket' };
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'struktur_versioner'").get());

const journalModul = () => require('./journal.js');
const SLAG = { mall: 'Mall', mattyp: 'Mätvärdestyp', ram: 'Ram för en mall', lokal: 'Lokal anpassning' };
const STATUS = { vantar: 'Väntar på godkännande', godkand: 'Godkänd', avslagen: 'Avslagen', aterkallad: 'Återkallad' };
const KATEGORI = { lakare: 'läkarnas dokumentation', omvardnad: 'omvårdnadsdokumentationen' };
const sv = (s) => String(s ?? '').trim().toLocaleLowerCase('sv');
const st = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max + 1) : '');

function kravRoll(personal) {
  if (!personal || !kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen ändrar journalens mallar, sökord och mätvärdestyper.', 'nekad');
}
const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs, grund: 'administrativ' });

// Den gällande (senast godkända) versionen för varje nyckel av ett slag.
function gallande(db, slag) {
  if (!harTabell(db)) return new Map();
  const rader = db.query("SELECT * FROM struktur_versioner WHERE slag = ? AND status = 'godkand' ORDER BY version").all(slag);
  return new Map(rader.map(r => [r.nyckel, { ...r, def: JSON.parse(r.definition) }]));
}

// --- Kodkontroller ---------------------------------------------------------------------------------------------

// LOINC:s kontrollsiffra är modulus 10: varannan siffra från höger, med början i den sista, dubblas.
export function loincGiltig(kod) {
  const m = /^(\d{1,7})-(\d)$/.exec(String(kod ?? ''));
  if (!m) return false;
  let summa = 0;
  m[1].split('').reverse().forEach((c, i) => { let d = Number(c); if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } summa += d; });
  return (10 - (summa % 10)) % 10 === Number(m[2]);
}

// UCUM: de enheter som vården använder, med prefix, potenser, produkter, kvoter och annotationer. Kontrollen är en
// demoregel och omfattar inte hela UCUM.
function ucumTerm(t) {
  if (/^\{[^{}]{1,30}\}$/.test(t)) return true;
  const u = t.replace(/\{[^{}]{1,30}\}$/, '');
  if (/^\d+(\*[+-]?\d+)?$/.test(u)) return true;
  const bas = u.replace(/[+-]?\d+$/, '');
  if (!bas) return false;
  if (UCUM_ATOMER.includes(bas)) return true;
  return UCUM_PREFIX.some(p => bas.startsWith(p) && UCUM_ATOMER.includes(bas.slice(p.length)) && bas.length > p.length);
}
export function ucumGiltig(kod) {
  const k = String(kod ?? '').trim();
  if (!k || k.length > 30 || /\s/.test(k)) return false;
  // Annotationer som {1.73_m2} kan innehålla punkter, så de byts ut innan uttrycket delas.
  const delar = k.replace(/\{[^{}]{1,30}\}/g, '{a}').replace(/^\//, '1/').split(/[./]/);
  return delar.every(d => d && ucumTerm(d));
}
// Så visas enheten i Vårdkällan. Systemet skriver den ur UCUM-koden, så att ingen behöver skriva den två gånger.
export const enhetAv = (ucum) => UCUM_VISNING[ucum] ?? String(ucum).replace(/\bu(?=[a-zA-Z])/g, 'µ').replace(/\[IU\]/g, 'IE');

// --- Sökord ------------------------------------------------------------------------------------------------------

// Sökord som systemförvaltningen har lagt till i godkända mallar: { namn: { code, display } eller { ingen } }.
export function egnaSokord(db, { utom = null } = {}) {
  const ut = {};
  for (const [nyckel, v] of gallande(db, 'mall')) if (nyckel !== utom) Object.assign(ut, v.def.nyaSokord ?? {});
  return ut;
}
const sokordDef = (db, namn, nya = {}, utom = null) => {
  const hitta = (o) => Object.keys(o).find(k => sv(k) === sv(namn));
  const a = hitta(SOKORD);
  if (a) return { namn: a, ...SOKORD[a], inbyggt: true };
  const e = egnaSokord(db, { utom });
  const b = hitta(e);
  if (b) return { namn: b, ...e[b], inbyggt: false };
  const c = hitta(nya);
  return c ? { namn: c, ...nya[c], nytt: true } : null;
};
// Koden för ett sökord i FHIR, ur delmängden eller ur en godkänd mall, eller null.
export function sokordKod(db, namn) {
  const d = sokordDef(db, namn);
  return d?.code ? { system: SYSTEM.snomed, code: d.code, display: d.display } : null;
}

// Prövar en lista med sökord och de nya sökordens koder. Returnerar fel som en lista och listan i normaliserad form.
function provaSokordslista(db, lista, nya, fel, utom = null) {
  const ut = [];
  const sedda = new Set();
  if (!Array.isArray(lista) || !lista.length) { fel.push('Mallen behöver minst ett sökord, annars har den som skriver inget att utgå från.'); return ut; }
  if (lista.length > 30) fel.push('En mall kan ha högst 30 sökord. Fler går inte att överblicka, och en anteckning kan alltid få fler sökord när den skrivs.');
  for (const s0 of lista.slice(0, 30)) {
    const s = text(s0, 80);
    if (!s) continue;
    if (s.length > 80) { fel.push(`Sökordet "${s.slice(0, 30)}" är längre än 80 tecken. Ett sökord är en rubrik, inte en text.`); continue; }
    if (sedda.has(sv(s))) { fel.push(`Sökordet ${s} finns två gånger. Samma sökord två gånger gör att texten hamnar på två ställen.`); continue; }
    sedda.add(sv(s));
    const d = sokordDef(db, s, nya, utom);
    if (!d) fel.push(`Sökordet ${s} finns inte i Vårdkällans delmängd av Snomed CT. Ange koden i Snomed CT, eller förklara varför sökordet inte har någon kod.`);
    ut.push(d ? d.namn : s);
  }
  return ut;
}

// Prövar de nya sökordens koder: rätt kontrollsiffra och partition, en engelsk term, och en kod som inte redan har ett
// annat namn. Ett sökord utan kod behöver en förklaring.
function provaNyaSokord(db, nya0, fel, utom = null) {
  const ut = {};
  if (nya0 == null) return ut;
  if (typeof nya0 !== 'object' || Array.isArray(nya0)) { fel.push('De nya sökorden anges med namn och kod.'); return ut; }
  const finns = { ...Object.fromEntries(Object.entries(SOKORD)), ...egnaSokord(db, { utom }) };
  for (const [namn0, k] of Object.entries(nya0).slice(0, 30)) {
    const namn = text(namn0, 80);
    if (!namn || namn.length > 80) { fel.push('Ett nytt sökord behöver ett namn på högst 80 tecken.'); continue; }
    if (Object.keys(finns).some(x => sv(x) === sv(namn))) continue;
    if (!k || typeof k !== 'object') { fel.push(`Ange en kod i Snomed CT för ${namn}, eller förklara varför sökordet inte har någon kod.`); continue; }
    const kod = text(String(k.code ?? ''), 18);
    if (kod) {
      const p = provaBegrepp(kod);
      if (!p.ok) { fel.push(`${namn}: ${p.varfor}`); continue; }
      const display = text(k.display, 120);
      if (display.length < 3) { fel.push(`${namn}: skriv begreppets engelska term i Snomed CT, så att koden går att kontrollera.`); continue; }
      const samma = Object.entries(finns).find(([, x]) => x.code === kod);
      if (samma) { fel.push(`Koden ${kod} används redan för sökordet ${samma[0]}. Använd det sökordet i stället, så att samma sak inte får två namn.`); continue; }
      ut[namn] = { code: kod, display };
      finns[namn] = ut[namn];
    } else {
      const ingen = text(k.ingen, 300);
      if (ingen.length < 20) { fel.push(`${namn}: ange en kod i Snomed CT, eller förklara med minst 20 tecken varför sökordet inte har någon kod.`); continue; }
      ut[namn] = { ingen };
      finns[namn] = ut[namn];
    }
  }
  return ut;
}

// --- Prövning av en definition per slag --------------------------------------------------------------------------

// Mallarnas namn: de inbyggda, formulären och de godkända.
function mallnamn(db) {
  const j = journalModul();
  const formular = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'formular'").get()
    ? db.query('SELECT DISTINCT namn FROM formular').all().map(r => r.namn) : [];
  return { inbyggda: j.MALLAR.map(m => m.typ), formular, egna: [...gallande(db, 'mall').keys()] };
}
// Grunden för en mall: sökorden som gäller i dag för en inbyggd mall, eller den godkända versionen.
function mallGrund(db, typ) {
  const j = journalModul();
  const inb = j.MALLAR.find(m => m.typ === typ);
  if (inb) return inb.strukturerad ? null : { typ, kategori: inb.kategori, sokord: require('./konfiguration.js').varde(db, `journal.sokord.${typ}`), inbyggd: true };
  const e = gallande(db, 'mall').get(typ);
  return e ? { ...e.def, inbyggd: false } : null;
}

const PROVA = {
  mall(db, d, fel, { nyckel, forra }) {
    const typ = text(d.typ ?? nyckel, 60);
    const n = mallnamn(db);
    if (typ.length < 3 || typ.length > 60) fel.push('Ge mallen ett namn på 3 till 60 tecken. Namnet är anteckningstypen som den som skriver väljer.');
    if (n.inbyggda.some(x => sv(x) === sv(typ))) fel.push(`${typ} är en av journalens inbyggda mallar. Ändra dess sökord under Regler och parametrar, eller ge den nya mallen ett annat namn.`);
    if (n.formular.some(x => sv(x) === sv(typ))) fel.push(`Det finns redan ett formulär som heter ${typ}. Ge mallen ett annat namn.`);
    if (!nyckel && n.egna.some(x => sv(x) === sv(typ))) fel.push(`Mallen ${typ} finns redan. Välj Ny version för att ändra den.`);
    if (!Object.hasOwn(KATEGORI, d.kategori)) fel.push('Välj om mallen hör till läkarnas dokumentation eller till omvårdnadsdokumentationen. Det avgör vem som får skriva och läsa anteckningarna.');
    // En ny version behåller koderna för de sökord som mallen själv har lagt till, utan att någon skriver dem igen.
    const nya = { ...(forra?.nyaSokord ?? {}), ...provaNyaSokord(db, d.nyaSokord, fel, nyckel) };
    const sokord = provaSokordslista(db, d.sokord, nya, fel, nyckel);
    // Bara de nya sökord som mallen använder sparas.
    const anvanda = Object.fromEntries(Object.entries(nya).filter(([k]) => sokord.some(s => sv(s) === sv(k))));
    let typkod = null;
    if (d.typkod?.code) {
      const p = provaBegrepp(text(String(d.typkod.code), 18));
      if (!p.ok) fel.push(`Anteckningstypens kod: ${p.varfor}`);
      else if (text(d.typkod.display, 120).length < 3) fel.push('Skriv anteckningstypens engelska term i Snomed CT, så att koden går att kontrollera.');
      else typkod = { code: text(String(d.typkod.code), 18), display: text(d.typkod.display, 120) };
    }
    return { typ, kategori: d.kategori, sokord, nyaSokord: anvanda, ...(typkod ? { typkod } : {}) };
  },
  mattyp(db, d, fel, { nyckel, forra }) {
    const namn = text(d.namn, 60);
    const j = journalModul();
    if (namn.length < 2 || namn.length > 60) fel.push('Ge mätvärdestypen ett namn på 2 till 60 tecken, som det visas i journalen.');
    const andra = [...Object.entries(j.MATTYPER).map(([id, m]) => [id, m.namn]), ...[...gallande(db, 'mattyp')].filter(([k]) => k !== nyckel).map(([k, v]) => [k, v.def.namn])];
    const sammaNamn = andra.find(([, n]) => sv(n) === sv(namn));
    if (sammaNamn) fel.push(`Mätvärdestypen ${sammaNamn[1]} finns redan. Använd den, eller ge den nya ett annat namn.`);
    const kodverk = d.kodverk;
    const kod = text(String(d.kod ?? ''), 20).toUpperCase();
    if (kodverk === 'npu') { if (!/^NPU\d{5}$/.test(kod)) fel.push('En kod i NPU har formen NPU och fem siffror, till exempel NPU19748.'); }
    else if (kodverk === 'loinc') { if (!/^\d{1,7}-\d$/.test(kod)) fel.push('En kod i LOINC har siffror, ett bindestreck och en kontrollsiffra, till exempel 8867-4.'); else if (!loincGiltig(kod)) fel.push(`Kontrollsiffran i ${kod} stämmer inte. Koden är troligen felskriven.`); }
    else fel.push('Välj NPU för laboratoriets analyser eller LOINC för vitalparametrar och andra mätningar.');
    const system = kodverk === 'npu' ? SYSTEM.npu : SYSTEM.loinc;
    // Runda 13, r4: också koderna för delarna av en inbyggd mätning, som systoliskt och diastoliskt blodtryck.
    const upptagen = [...Object.entries(MATKOD).filter(([, k]) => k.coding.some(c => c.code === kod) || (k.komponenter ?? []).some(c => c.code === kod))
      .map(([id, k]) => { const del = (k.komponenter ?? []).find(c => c.code === kod); return `${j.MATTYPER[id]?.namn ?? id}${del ? ` (${DELNAMN[del.code] ?? 'en del av mätningen'})` : ''}`; }),
      ...[...gallande(db, 'mattyp')].filter(([k, v]) => k !== nyckel && v.def.kod === kod).map(([, v]) => v.def.namn)];
    if (kod && upptagen.length) fel.push(`Koden ${kod} används redan för ${upptagen[0]}. Använd den mätvärdestypen, så att samma mätning inte får två namn.`);
    const ucum = text(String(d.ucum ?? ''), 30);
    if (!ucumGiltig(ucum)) fel.push(`${ucum || 'Enheten'} är inte en enhet i UCUM som Vårdkällan känner igen. Skriv till exempel mmol/L, umol/L, g/L, 10*9/L, mm[Hg] eller /min.`);
    const min = Number(String(d.min ?? '').replace(',', '.'));
    const max = Number(String(d.max ?? '').replace(',', '.'));
    if (!Number.isFinite(min) || !Number.isFinite(max) || String(d.min ?? '').trim() === '' || String(d.max ?? '').trim() === '') fel.push('Ange det lägsta och det högsta rimliga värdet. Systemet stoppar ett värde utanför, så att ett felskrivet värde inte hamnar i journalen.');
    else if (min >= max) fel.push('Det lägsta rimliga värdet måste vara lägre än det högsta.');
    else if (min < -1000 || max > 1_000_000) fel.push('De rimliga värdena får ligga mellan -1000 och 1 000 000.');
    const heltal = d.heltal === true || d.heltal === 'ja' || d.heltal === 'on';
    // En ny version får inte byta kod eller enhet när värden redan finns, eftersom de skulle få en annan betydelse.
    if (forra && (forra.kod !== kod || forra.ucum !== ucum)) {
      const n = db.query('SELECT count(*) AS n FROM matvarden WHERE typ = ?').get(nyckel).n;
      if (n) fel.push(`Det finns redan ${st(n, 'registrerat värde', 'registrerade värden')} av ${forra.namn} med koden ${forra.kod} och enheten ${forra.ucum}. Koden och enheten kan inte ändras, eftersom värdena då skulle få en annan betydelse. Skapa en ny mätvärdestyp i stället.`);
    }
    return { namn, kodverk, system, kod, ucum, enhet: enhetAv(ucum), min, max, heltal, kategori: kodverk === 'npu' ? 'laboratory' : 'exam' };
  },
  ram(db, d, fel, { nyckel }) {
    const typ = text(d.typ ?? nyckel, 60);
    const grund = mallGrund(db, typ);
    if (!grund) { fel.push(`Det finns ingen mall som heter ${typ} med sökord att sätta en ram för.`); return { typ, obligatoriska: [], lokalt: [] }; }
    const obl = (Array.isArray(d.obligatoriska) ? d.obligatoriska : []).map(s => text(s, 80)).filter(Boolean);
    for (const s of obl) if (!grund.sokord.some(x => sv(x) === sv(s))) fel.push(`${s} finns inte i mallen ${typ}. Ett sökord som måste finnas behöver redan vara med i mallen.`);
    const lokalt = provaSokordslista(db, Array.isArray(d.lokalt) && d.lokalt.length ? d.lokalt : ['__tom'], {}, []).filter(s => s !== '__tom');
    for (const s of (Array.isArray(d.lokalt) ? d.lokalt : [])) {
      const t = text(s, 80);
      if (!t) continue;
      if (!sokordDef(db, t)) fel.push(`Sökordet ${t} finns inte i delmängden. Ett sökord som får läggas till lokalt behöver en kod eller en förklaring, och läggs först in i en mall.`);
      else if (grund.sokord.some(x => sv(x) === sv(t))) fel.push(`${t} finns redan i mallen ${typ} och behöver inte läggas till lokalt.`);
    }
    return { typ, obligatoriska: grund.sokord.filter(x => obl.some(s => sv(s) === sv(x))), lokalt };
  },
  lokal(db, d, fel, { nyckel }) {
    const [typ0, enhet0] = String(nyckel ?? '').split('|');
    const typ = text(d.typ ?? typ0, 60);
    const enhet = vardenhetFor(db, text(d.enhet ?? enhet0, 60));
    const e = db.query("SELECT id, namn, typ FROM enheter WHERE id = ?").get(enhet);
    if (!e || e.typ !== 'vardenhet') fel.push('Välj vårdenheten som mallen anpassas för.');
    const grund = mallGrund(db, typ);
    if (!grund) { fel.push(`Det finns ingen mall som heter ${typ} med sökord att anpassa.`); return { typ, enhet, sokord: [] }; }
    const ram = gallande(db, 'ram').get(typ)?.def ?? null;
    const sokord = provaSokordslista(db, d.sokord, {}, fel);
    fel.push(...ramFel(db, grund, ram, sokord));
    return { typ, enhet, sokord };
  },
};

// Vad som bryter mot ramen i en lokal anpassning. Utan ram får bara mallens egna sökord ordnas om eller tas bort.
function ramFel(db, grund, ram, sokord) {
  const fel = [];
  for (const s of ram?.obligatoriska ?? []) if (!sokord.some(x => sv(x) === sv(s))) fel.push(`${s} måste finnas i mallen ${grund.typ} enligt vårdgivarens ram och kan inte tas bort lokalt.`);
  const tillatna = [...grund.sokord, ...(ram?.lokalt ?? [])];
  for (const s of sokord) if (!tillatna.some(x => sv(x) === sv(s))) fel.push(`${s} får inte läggas till i mallen ${grund.typ} lokalt. Vårdgivarens ram ${ram?.lokalt?.length ? `tillåter ${ram.lokalt.join(', ')}` : 'tillåter inga egna sökord för mallen'}.`);
  return fel;
}

// --- Vad som påverkas --------------------------------------------------------------------------------------------

function paverkas(db, slag, nyckel, def, forra) {
  const ut = [];
  if (slag === 'mall') {
    const n = db.query("SELECT count(*) AS n FROM anteckningar WHERE typ = ? AND status = 'signerad'").get(def.typ).n;
    ut.push(`Mallen ${def.typ} blir valbar i anteckningsformuläret för ${def.kategori === 'omvardnad' ? 'omvårdnadspersonalen' : 'läkarna'} på alla vårdenheter direkt efter godkännandet, och anteckningarna hör till ${KATEGORI[def.kategori]}.`);
    if (forra) {
      const nyaS = def.sokord.filter(s => !forra.sokord.includes(s));
      const borta = forra.sokord.filter(s => !def.sokord.includes(s));
      if (nyaS.length) ut.push(`Nya sökord i mallen: ${nyaS.join(', ')}.`);
      if (borta.length) ut.push(`Tas bort ur mallen: ${borta.join(', ')}.`);
      if (forra.kategori !== def.kategori) ut.push(`Nya anteckningar hör till ${KATEGORI[def.kategori]}. De som redan är skrivna stannar där de skrevs.`);
    }
    ut.push(`${st(n, 'signerad anteckning', 'signerade anteckningar')} av typen ändras inte. De visar sina sökord som när de skrevs.`);
    for (const [s, k] of Object.entries(def.nyaSokord)) ut.push(k.code ? `Sökordet ${s} läggs till i delmängden med Snomed CT ${k.code} (${k.display}) och följer med i FHIR.` : `Sökordet ${s} får ingen kod: ${k.ingen}`);
    if (def.typkod) ut.push(`Anteckningstypen får Snomed CT ${def.typkod.code} (${def.typkod.display}) i FHIR.`);
    const lokala = [...gallande(db, 'lokal').values()].filter(v => v.def.typ === def.typ);
    for (const l of lokala) {
      const f = ramFel(db, def, gallande(db, 'ram').get(def.typ)?.def ?? null, l.def.sokord);
      if (f.length) ut.push(`${enhetsnamn(db, l.def.enhet)} har en lokal anpassning som inte längre ryms i mallen och slutar gälla: ${f[0]}`);
    }
  } else if (slag === 'mattyp') {
    ut.push(`${def.namn} (${def.enhet}) blir valbar när ett mätvärde registreras direkt efter godkännandet. Systemet stoppar ett värde under ${def.min} eller över ${def.max}${def.heltal ? ' och ett värde som inte är ett heltal' : ''}.`);
    ut.push(`I FHIR lämnas värdena ut som Observation med ${def.kodverk === 'npu' ? 'NPU' : 'LOINC'} ${def.kod} och enheten ${def.ucum} i UCUM.`);
    if (forra) {
      const n = db.query('SELECT count(*) AS n FROM matvarden WHERE typ = ?').get(nyckel).n;
      ut.push(`${st(n, 'registrerat värde', 'registrerade värden')} står kvar som de registrerades.`);
    }
  } else if (slag === 'ram') {
    ut.push(def.obligatoriska.length ? `Sökord som alltid måste finnas i ${def.typ}: ${def.obligatoriska.join(', ')}.` : `Inga sökord i ${def.typ} är obligatoriska, så en vårdenhet får ta bort vilka som helst.`);
    ut.push(def.lokalt.length ? `Sökord som en vårdenhet får lägga till: ${def.lokalt.join(', ')}.` : 'Inga egna sökord får läggas till lokalt.');
    const grund = mallGrund(db, def.typ);
    for (const l of [...gallande(db, 'lokal').values()].filter(v => v.def.typ === def.typ)) {
      const f = grund ? ramFel(db, grund, def, l.def.sokord) : [];
      ut.push(f.length ? `${enhetsnamn(db, l.def.enhet)}: den lokala anpassningen ryms inte i den nya ramen och slutar gälla. ${f[0]}` : `${enhetsnamn(db, l.def.enhet)}: den lokala anpassningen ryms i ramen och gäller som förut.`);
    }
  } else if (slag === 'lokal') {
    const grund = mallGrund(db, def.typ);
    const nyaS = def.sokord.filter(s => !grund.sokord.includes(s));
    const borta = grund.sokord.filter(s => !def.sokord.includes(s));
    ut.push(`Personalen på ${enhetsnamn(db, def.enhet)} får mallen ${def.typ} med sökorden ${def.sokord.join(', ')} direkt efter godkännandet. Andra vårdenheter får vårdgivarens mall.`);
    if (nyaS.length) ut.push(`Läggs till lokalt: ${nyaS.join(', ')}.`);
    if (borta.length) ut.push(`Tas bort lokalt: ${borta.join(', ')}.`);
  }
  return ut;
}

// --- Förslag, godkännande och avslut -----------------------------------------------------------------------------

function nyckelFor(slag, def) {
  if (slag === 'mattyp') {
    const id = sv(def.namn).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    return `egen_${id || 'matvarde'}`;
  }
  if (slag === 'lokal') return `${def.typ}|${def.enhet}`;
  return def.typ;
}

// Prövar en definition. Returnerar { ok, fel, slag, nyckel, definition, forra, paverkas }. Inga patientuppgifter.
export function forhandsvisa(db, personal, { slag, nyckel = null, definition } = {}) {
  kravRoll(personal);
  if (!Object.hasOwn(SLAG, slag)) throw new Fel(400, 'Välj mall, mätvärdestyp, ram eller lokal anpassning.', 'ogiltig', { falt: ['slag'] });
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Fel(400, 'Definitionen saknas.', 'ogiltig', { falt: ['definition'] });
  const n0 = typeof nyckel === 'string' && nyckel ? nyckel.slice(0, 140) : null;
  const forraRad = n0 ? gallande(db, slag).get(n0) ?? null : null;
  if (n0 && slag === 'mattyp' && !forraRad) throw new Fel(404, 'Mätvärdestypen finns inte.', 'saknas');
  if (n0 && slag === 'mall' && !forraRad) throw new Fel(404, 'Mallen finns inte. Skapa den som en ny mall.', 'saknas');
  const fel = [];
  const def = PROVA[slag](db, definition, fel, { nyckel: n0, forra: forraRad?.def ?? null });
  const nyck = n0 ?? nyckelFor(slag, def);
  // En ram eller lokal anpassning för en nyckel som redan har en godkänd version blir en ny version av den.
  const forra = forraRad?.def ?? gallande(db, slag).get(nyck)?.def ?? null;
  if (!n0 && slag === 'mattyp' && gallande(db, 'mattyp').has(nyck)) fel.push(`Det finns redan en mätvärdestyp med id ${nyck}. Ge den nya ett annat namn.`);
  if (!fel.length && forra && JSON.stringify(forra) === JSON.stringify(def)) fel.push('Det är samma som den version som gäller. Ändra något först.');
  return { ok: !fel.length, fel, slag, slagText: SLAG[slag], nyckel: nyck, definition: def, forra, paverkas: fel.length ? [] : paverkas(db, slag, nyck, def, forra) };
}

export function foresla(db, personal, body = {}, nu = new Date()) {
  const f = forhandsvisa(db, personal, body);
  if (!f.ok) throw new Fel(400, f.fel[0], 'ogiltig', { fel: f.fel });
  const m = text(body.motivering, 1000);
  if (!m) throw new Fel(400, 'Skriv varför ändringen behövs. Motiveringen följer med versionen i historiken.', 'ogiltig', { falt: ['motivering'] });
  if (m.length > 1000) throw new Fel(400, 'Motiveringen får vara högst 1000 tecken.', 'ogiltig', { falt: ['motivering'] });
  if (db.query("SELECT 1 FROM struktur_versioner WHERE slag = ? AND nyckel = ? AND status = 'vantar'").get(f.slag, f.nyckel)) {
    throw new Fel(409, 'Det finns redan en version som väntar på godkännande. Godkänn, avslå eller återkalla den först, så att två versioner inte konkurrerar.', 'ogiltig');
  }
  const version = (db.query('SELECT max(version) AS v FROM struktur_versioner WHERE slag = ? AND nyckel = ?').get(f.slag, f.nyckel).v ?? 0) + 1;
  const r = db.query(`INSERT INTO struktur_versioner (slag, nyckel, version, definition, forra, motivering, foreslagen_av, foreslagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(f.slag, f.nyckel, version, JSON.stringify(f.definition), f.forra ? JSON.stringify(f.forra) : null, m, personal.id, iso(nu));
  loggaAtgard(db, personal, `journalstruktur:${r.lastInsertRowid}`);
  return { version: versionUt(db, hamta(db, r.lastInsertRowid), personal), paverkas: f.paverkas };
}

function hamta(db, id) {
  const r = harTabell(db) && db.query('SELECT * FROM struktur_versioner WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Versionen finns inte.', 'saknas');
  return r;
}

export function godkann(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const v = hamta(db, id);
  if (v.status !== 'vantar') throw new Fel(409, 'Versionen är redan beslutad.', 'ogiltig');
  if (v.foreslagen_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som föreslog versionen måste godkänna den.', 'nekad');
  // Prövas igen, eftersom kodverken, mallarna och ramarna kan ha ändrats sedan versionen föreslogs.
  const fel = [];
  const def = PROVA[v.slag](db, JSON.parse(v.definition), fel, { nyckel: v.nyckel, forra: gallande(db, v.slag).get(v.nyckel)?.def ?? null });
  if (fel.length) throw new Fel(400, `Versionen kan inte godkännas: ${fel[0]}`, 'ogiltig');
  if (JSON.stringify(def) !== v.definition) throw new Fel(400, 'Versionen kan inte godkännas, eftersom något den bygger på har ändrats sedan den föreslogs. Be den som föreslog den att föreslå den igen.', 'ogiltig');
  const k = text(kommentar, 500);
  db.query("UPDATE struktur_versioner SET status = 'godkand', beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?").run(personal.id, iso(nu), k || null, v.id);
  loggaAtgard(db, personal, `journalstruktur:${v.id}`);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id,
    beskrivning: `${SLAG[v.slag]} ${v.nyckel} version ${v.version} godkänd, föreslagen av ${personnamn(db, v.foreslagen_av)} och godkänd av ${personal.namn}.` });
  return { version: versionUt(db, hamta(db, v.id), personal) };
}

// Avslår (någon annan, med kommentar) eller återkallar (den som föreslog).
export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const v = hamta(db, id);
  if (v.status !== 'vantar') throw new Fel(409, 'Versionen är redan beslutad.', 'ogiltig');
  const egen = v.foreslagen_av === personal.id;
  const k = text(kommentar, 500);
  if (!egen && !k) throw new Fel(400, 'Skriv varför versionen avslås, så att den som föreslog den vet vad som behöver göras.', 'ogiltig', { falt: ['kommentar'] });
  db.query('UPDATE struktur_versioner SET status = ?, beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?').run(egen ? 'aterkallad' : 'avslagen', personal.id, iso(nu), k || null, v.id);
  loggaAtgard(db, personal, `journalstruktur:${v.id}`);
  return { version: versionUt(db, hamta(db, v.id), personal) };
}

export function versionUt(db, v, personal = null) {
  const def = JSON.parse(v.definition);
  const rubrik = v.slag === 'mattyp' ? def.namn : v.slag === 'lokal' ? `${def.typ} på ${enhetsnamn(db, def.enhet)}` : def.typ;
  return {
    id: v.id, slag: v.slag, slagText: SLAG[v.slag], nyckel: v.nyckel, version: v.version, rubrik, definition: def,
    forra: v.forra ? JSON.parse(v.forra) : null, motivering: v.motivering,
    foreslagenAv: personnamn(db, v.foreslagen_av), foreslagen: v.foreslagen, status: v.status, statusText: STATUS[v.status],
    beslutadAv: personnamn(db, v.beslutad_av), beslutad: v.beslutad, kommentar: v.beslut_kommentar,
    egen: personal ? v.foreslagen_av === personal.id : false,
    kanGodkanna: Boolean(personal && v.status === 'vantar' && v.foreslagen_av !== personal.id),
  };
}

// Systemförvaltarens sida: allt som väntar, mallarna med ram och lokala anpassningar, mätvärdestyperna och historiken.
export function oversikt(db, personal) {
  kravRoll(personal);
  const alla = harTabell(db) ? db.query('SELECT * FROM struktur_versioner ORDER BY id DESC').all() : [];
  // Den som godkänner ser samma förhandsvisning av vad som påverkas som den som föreslog.
  const vantande = alla.filter(v => v.status === 'vantar').map(v => {
    const ut = versionUt(db, v, personal);
    try { ut.paverkas = paverkas(db, v.slag, v.nyckel, ut.definition, gallande(db, v.slag).get(v.nyckel)?.def ?? null); } catch { ut.paverkas = []; }
    return ut;
  });
  const ramar = gallande(db, 'ram');
  const lokala = [...gallande(db, 'lokal').values()];
  const j = journalModul();
  const egnaMallar = gallande(db, 'mall');
  const mallar = [
    ...j.MALLAR.filter(m => !m.strukturerad).map(m => ({ typ: m.typ, inbyggd: true, kategori: m.kategori, sokord: mallGrund(db, m.typ).sokord, version: null })),
    ...[...egnaMallar.values()].map(v => ({ typ: v.nyckel, inbyggd: false, kategori: v.def.kategori, sokord: v.def.sokord, nyaSokord: v.def.nyaSokord, typkod: v.def.typkod ?? null, version: v.version })),
  ].map(m => ({ ...m, kategoriText: KATEGORI[m.kategori], ram: ramar.get(m.typ)?.def ?? null,
    lokala: lokala.filter(l => l.def.typ === m.typ).map(l => ({ enhet: l.def.enhet, enhetNamn: enhetsnamn(db, l.def.enhet), sokord: l.def.sokord, version: l.version, galler: !ramFel(db, m, ramar.get(m.typ)?.def ?? null, l.def.sokord).length })) }));
  const mattyper = [...gallande(db, 'mattyp').values()].map(v => ({ id: v.nyckel, version: v.version, ...v.def }));
  return {
    attGodkanna: vantande.filter(v => v.kanGodkanna), mina: vantande.filter(v => v.egen),
    mallar, mattyper,
    inbyggdaMattyper: Object.entries(j.MATTYPER).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet ?? '', kod: MATKOD[id]?.coding?.[0]?.code ?? null })),
    vardenheter: db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all(),
    sokord: [...Object.keys(SOKORD), ...Object.keys(egnaSokord(db))].sort((a, b) => a.localeCompare(b, 'sv')),
    historik: alla.filter(v => v.status !== 'vantar').slice(0, 50).map(v => versionUt(db, v, personal)),
    lasta: [
      { rubrik: 'Skrivna anteckningar och registrerade värden', varfor: 'En ny version av en mall eller mätvärdestyp gäller det som skrivs efter godkännandet. Det som redan är skrivet ändras aldrig (HSLF-FS 2016:40 6 kap.).' },
      { rubrik: 'Koden och enheten för en mätvärdestyp med värden', varfor: 'Värdena skulle få en annan betydelse. En ny kod eller enhet blir en ny mätvärdestyp.' },
      { rubrik: 'Journalens inbyggda mallar', varfor: 'Namnet och kategorin styr behörigheten och ändras inte. Sökorden ändras under Regler och parametrar, och en ram och lokala anpassningar sätts här.' },
      { rubrik: 'De strukturerade mallarna för tobak, levnadsvanor och donation', varfor: 'Systemet skriver deras sökord ur svaren, så sökorden går inte att ändra.' },
    ],
    anmarkning: 'En ny version gäller först när en annan systemförvaltare har godkänt den, och direkt efter godkännandet. Kontrollen av UCUM är en demoregel som omfattar de vanliga enheterna i vården.',
  };
}

// --- Det som resten av systemet läser ----------------------------------------------------------------------------

// Mallen för en anteckningstyp som systemförvaltningen har skapat, eller null.
export function mallFor(db, typ) {
  if (typeof typ !== 'string') return null;
  const v = gallande(db, 'mall').get(typ);
  return v ? { typ: v.nyckel, kategori: v.def.kategori, sokord: [...v.def.sokord], version: v.version, egen: true } : null;
}

// Mallarna som gäller för en person: de egna mallarna, och för en mall med en lokal anpassning som ryms i ramen
// vårdenhetens sökord i stället för vårdgivarens.
export function mallarFor(db, personal, mallar) {
  const egna = [...gallande(db, 'mall').values()].map(v => ({ typ: v.nyckel, kategori: v.def.kategori, sokord: [...v.def.sokord], egen: true, version: v.version }));
  const enhet = personal?.enhet_id ? vardenhetFor(db, personal.enhet_id) : null;
  const ramar = gallande(db, 'ram');
  const lokala = [...gallande(db, 'lokal').values()].filter(l => l.def.enhet === enhet);
  return [...mallar, ...egna].map(m => {
    const l = lokala.find(x => x.def.typ === m.typ);
    if (!l || m.strukturerad || m.formular) return m;
    if (ramFel(db, m, ramar.get(m.typ)?.def ?? null, l.def.sokord).length) return m;
    return { ...m, sokord: [...l.def.sokord], lokal: { enhet: enhetsnamn(db, enhet), version: l.version } };
  });
}

// Koden för en anteckningstyp som systemförvaltningen har gett en kod, i den form FHIR använder.
export function typkod(db, typ) {
  const k = gallande(db, 'mall').get(typ)?.def?.typkod;
  return k ? { system: SYSTEM.snomed, code: k.code, display: k.display } : null;
}

// Mätvärdestyperna som systemförvaltningen har skapat, i samma form som journal.MATTYPER, med kodningen för FHIR.
export function mattyper(db) {
  return Object.fromEntries([...gallande(db, 'mattyp').values()].map(v => [v.nyckel, {
    namn: v.def.namn, enhet: v.def.enhet, min: v.def.min, max: v.def.max, heltal: v.def.heltal, egen: true, version: v.version,
    kod: { kategori: v.def.kategori, coding: [{ system: v.def.system, code: v.def.kod }], ucum: v.def.ucum },
  }]));
}
export const mattyp = (db, typ) => (typeof typ === 'string' && typ.startsWith('egen_') ? mattyper(db)[typ] ?? null : null);
