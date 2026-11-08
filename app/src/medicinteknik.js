// Medicinteknisk utrustning (runda 9, r2, Sussa 3.6.1.1, 3.6.1.2, 3.6.1.4 till 3.6.1.7 och 3.5.2.19).
//
// Patientmonitorer och infusionspumpar skickar mätvärden och pågående doser till journalen genom ett standardiserat
// gränssnitt: FHIR R4 (en Bundle med Device, Observation och MedicationAdministration) eller HL7 v2.6 ORU^R01 enligt
// IHE PCD-01, med koder ur LOINC eller IEEE 11073-10101 (MDC) och enheter i UCUM eller MDC. Varje utrustning har en egen
// nyckel (Authorization: Bearer), som sparas som HMAC med en hemlig nyckel och aldrig i klartext.
//
// Systemet är experten:
//   - Utrustningen kopplas till patienten genom att utrustningens streckkod skannas när patientens journal är öppen.
//     Armbandet kan skannas också, och systemet kontrollerar att det hör till patienten. Systemet avslutar själv en
//     tidigare koppling när utrustningen flyttas till en ny patient på samma vårdenhet, och varje koppling loggas.
//   - Ett värde som kommer när utrustningen inte är kopplad, eller som anger en annan patient än kopplingen, avvisas med
//     en förklaring. Formatfel förklaras på vanlig svenska i svaret till utrustningen.
//   - Värden från utrustning och patientens egna mätningar är referensvärden tills en behörig person har godkänt dem för
//     diagnostiskt bruk. Bara godkända värden räknas i NEWS2, larm och beslutsstöd (kvalitetssakrad).
//   - Patienten registrerar egna mätningar i Min journal. Systemet skickar dem själv till den vårdenhet som vårdar
//     patienten och märker dem som inte kvalitetssäkrade tills vården har bedömt dem.
//   - En infusionspump rapporterar hastighet och given volym. Systemet registrerar givna doser med källan utrustning,
//     räknar dosen ur koncentrationen och kontrollerar den mot ordinationen och dygnsdosen.
//
// Utrustningen är simulerad i demon (UTRUSTNING). En simulerad monitor skickar värden var femte minut och en simulerad
// pump rapporterar var femtonde minut, genom samma mottagning som en riktig utrustning (efterTid).
import { createHmac, randomBytes } from 'node:crypto';
import { Fel, iso, MATTYPER_ENHET } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsPnr } from './atkomst.js';
import { kravVardande, synligaAdministreringar } from './administrering.js';
import { loggaRad } from './logg.js';

export const DEMO = 'Utrustningen är simulerad i demon. Ingen riktig medicinteknisk utrustning är ansluten, och värdena räknas fram av systemet.';
export const TYPER = { monitor: 'Patientmonitor', pump: 'Infusionspump' };
// Demons utrustning per arbetsplats. Streckkoden sitter på utrustningen och innehåller bara utrustningens nummer.
export const UTRUSTNING = [
  { id: 'mt-mon-hia-1', typ: 'monitor', modell: 'Patientmonitor, sal 1 (simulerad)', serienummer: 'DEMO-MON-0001', streckkod: 'MT-MON-0001', enhet: 'uso-kard-hia' },
  { id: 'mt-mon-hia-2', typ: 'monitor', modell: 'Patientmonitor, sal 2 (simulerad)', serienummer: 'DEMO-MON-0002', streckkod: 'MT-MON-0002', enhet: 'uso-kard-hia' },
  { id: 'mt-mon-hia-3', typ: 'monitor', modell: 'Patientmonitor, sal 3 (simulerad)', serienummer: 'DEMO-MON-0005', streckkod: 'MT-MON-0005', enhet: 'uso-kard-hia' },
  { id: 'mt-mon-72-1', typ: 'monitor', modell: 'Transportabel monitor (simulerad)', serienummer: 'DEMO-MON-0003', streckkod: 'MT-MON-0003', enhet: 'uso-kard-72' },
  { id: 'mt-mon-akut-1', typ: 'monitor', modell: 'Patientmonitor, akutrum 1 (simulerad)', serienummer: 'DEMO-MON-0004', streckkod: 'MT-MON-0004', enhet: 'uso-akut' },
  { id: 'mt-pump-hia-1', typ: 'pump', modell: 'Sprutpump 1 (simulerad)', serienummer: 'DEMO-PMP-0001', streckkod: 'MT-PMP-0001', enhet: 'uso-kard-hia' },
  { id: 'mt-pump-hia-2', typ: 'pump', modell: 'Sprutpump 2 (simulerad)', serienummer: 'DEMO-PMP-0002', streckkod: 'MT-PMP-0002', enhet: 'uso-kard-hia' },
  { id: 'mt-pump-72-1', typ: 'pump', modell: 'Volymetrisk infusionspump (simulerad)', serienummer: 'DEMO-PMP-0003', streckkod: 'MT-PMP-0003', enhet: 'uso-kard-72' },
];
// Det en monitor mäter, med LOINC (samma som kodverk.js) och IEEE 11073-10101 (MDC), och enheterna i UCUM och MDC.
export const KODER = {
  puls: { loinc: ['8867-4'], mdc: ['147842', '149530'], ucum: ['/min'], mdcEnhet: ['264864'] },
  saturation: { loinc: ['2708-6', '59408-5'], mdc: ['150456'], ucum: ['%'], mdcEnhet: ['262688'] },
  andningsfrekvens: { loinc: ['9279-1'], mdc: ['151562'], ucum: ['/min'], mdcEnhet: ['264928'] },
  temp: { loinc: ['8310-5'], mdc: ['150364'], ucum: ['Cel'], mdcEnhet: ['268192'] },
  blodtryck: { loinc: ['85354-9'], mdc: ['150020'], ucum: ['mm[Hg]'], mdcEnhet: ['266016'], sys: { loinc: '8480-6', mdc: '150021' }, dia: { loinc: '8462-4', mdc: '150022' } },
};
export const MONITORTYPER = Object.keys(KODER);
const SYS_LOINC = 'http://loinc.org';
const SYS_MDC = 'urn:iso:std:iso:11073:10101';
const SYS_UCUM = 'http://unitsofmeasure.org';
export const SYS_UTRUSTNING = 'https://vardkallan.404haven.se/fhir/sid/utrustning';
// Formaten och profilerna som mottagningen tar emot (Sussa 3.6.1.4). Samma text står i CapabilityStatement och på sidan
// Öppet API.
export const FORMAT = {
  fhir: {
    namn: 'FHIR R4', adress: '/mt/fhir', innehall: 'application/fhir+json',
    text: 'En Bundle av typen collection eller transaction med en Device (identifier med utrustningens nummer) och Observation för mätvärden eller MedicationAdministration för pumpens rapporter. Observation har status final eller preliminary, code med LOINC eller MDC, valueQuantity med UCUM-enhet (blodtryck som component med systoliskt och diastoliskt), effectiveDateTime och device som pekar på Device. subject får anges och måste då vara den kopplade patienten. MedicationAdministration har status in-progress, completed eller stopped, request till ordinationen, effectivePeriod och dosage.rateQuantity i mL/h och dosage.dose i mL. En bolus har kategorin bolus.',
    profil: 'Mätvärdena följer FHIR:s vitalparameterprofil (http://hl7.org/fhir/StructureDefinition/vitalsigns) med koderna i HL7 Point-of-Care Device Implementation Guide.',
  },
  hl7v2: {
    namn: 'HL7 v2.6 ORU^R01 (IHE PCD-01)', adress: '/mt/hl7v2', innehall: 'application/hl7-v2 eller text/plain',
    text: 'Segmenten MSH, PID (valfritt), OBR och OBX med värdetypen NM, kod med MDC eller LOINC i OBX-3, enhet med MDC eller UCUM i OBX-6, status F eller R i OBX-11, tid i OBX-14 och utrustningens nummer i OBX-18. Blodtryck skickas som två OBX med systoliskt och diastoliskt. Svaret är ett ACK med MSA AA, AE eller AR och förklaringen i MSA-3.',
    profil: 'IHE PCD Technical Framework, transaktionen PCD-01 Communicate PCD Data.',
  },
};
export const TAK = { perMinut: 60, varden: 100, dygnEgna: 30 };
const MIN = 60_000;
const TIMME = 3600_000;
const DAG = 86400_000;
export const MONITOR_MIN = 5;
export const PUMP_MIN = 15;
// Så långt bakåt den simulerade utrustningen fyller på när ingen har öppnat sandlådan på ett tag.
const SIMULERA_BAKAT_MS = 3 * TIMME;

export const SCHEMA = `
-- Utrustningen. enhet_id är arbetsplatsen som utrustningen hör till. nyckel_hmac är HMAC av utrustningens nyckel.
CREATE TABLE IF NOT EXISTS mt_utrustning (
  id TEXT PRIMARY KEY, typ TEXT NOT NULL, modell TEXT NOT NULL, serienummer TEXT NOT NULL, streckkod TEXT NOT NULL UNIQUE, enhet_id TEXT NOT NULL,
  simulerad INTEGER NOT NULL DEFAULT 1, aktiv INTEGER NOT NULL DEFAULT 1, nyckel_hmac TEXT, nyckel_tid TEXT, nyckel_av TEXT,
  CHECK (typ IN ('monitor', 'pump'))
);
-- Kopplingen mellan utrustning och patient med start och slut. En koppling raderas aldrig, och bara slutet sätts i
-- efterhand, en gång.
CREATE TABLE IF NOT EXISTS mt_kopplingar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, utrustning_id TEXT NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, ordination_id INTEGER,
  start TEXT NOT NULL, slut TEXT, kopplad_av TEXT NOT NULL, avslutad_av TEXT, avslutad_orsak TEXT, armband INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_mt_koppl_utr ON mt_kopplingar (utrustning_id);
CREATE INDEX IF NOT EXISTS ix_mt_koppl_pat ON mt_kopplingar (patient_id);
CREATE TRIGGER IF NOT EXISTS mt_kopplingar_raderas_ej BEFORE DELETE ON mt_kopplingar
  BEGIN SELECT RAISE(ABORT, 'En koppling till utrustning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS mt_kopplingar_andras_ej BEFORE UPDATE OF utrustning_id, enhet_id, ordination_id, start, kopplad_av, armband ON mt_kopplingar
  BEGIN SELECT RAISE(ABORT, 'En koppling till utrustning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS mt_kopplingar_slut_en_gang BEFORE UPDATE OF slut, avslutad_av, avslutad_orsak ON mt_kopplingar WHEN OLD.slut IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'En avslutad koppling ändras inte'); END;
-- Varje meddelande från utrustningen, mottaget eller avvisat, med orsaken.
CREATE TABLE IF NOT EXISTS mt_meddelanden (
  id INTEGER PRIMARY KEY, utrustning_id TEXT NOT NULL, enhet_id TEXT NOT NULL, koppling_id INTEGER, patient_id TEXT, tid TEXT NOT NULL,
  format TEXT NOT NULL, status TEXT NOT NULL, orsak TEXT, antal INTEGER NOT NULL DEFAULT 0, simulerat INTEGER NOT NULL DEFAULT 0,
  CHECK (status IN ('mottaget', 'avvisat'))
);
CREATE INDEX IF NOT EXISTS ix_mt_medd_koppl ON mt_meddelanden (koppling_id);
CREATE TRIGGER IF NOT EXISTS mt_meddelanden_andras_ej BEFORE UPDATE OF utrustning_id, enhet_id, koppling_id, tid, format, status, orsak, antal ON mt_meddelanden
  BEGIN SELECT RAISE(ABORT, 'Ett meddelande från utrustning ändras inte'); END;
-- Mätvärdena från utrustning, med kopplingen och meddelandet som de kom i.
CREATE TABLE IF NOT EXISTS mt_varden (
  matvarde_id INTEGER PRIMARY KEY, utrustning_id TEXT NOT NULL, koppling_id INTEGER NOT NULL, meddelande_id INTEGER NOT NULL,
  patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mt_varden_koppl ON mt_varden (koppling_id);
CREATE TRIGGER IF NOT EXISTS mt_varden_andras_ej BEFORE UPDATE OF matvarde_id, utrustning_id, koppling_id, meddelande_id, enhet_id ON mt_varden
  BEGIN SELECT RAISE(ABORT, 'Kopplingen mellan mätvärde och utrustning ändras inte'); END;
-- Bedömningen av ett värde från utrustning eller patientens egen mätning: godkänt för diagnostiskt bruk eller referens.
CREATE TABLE IF NOT EXISTS matvarde_bedomningar (
  matvarde_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, beslut TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  CHECK (beslut IN ('godkand', 'referens'))
);
CREATE TRIGGER IF NOT EXISTS matvarde_bedomningar_raderas_ej BEFORE DELETE ON matvarde_bedomningar
  BEGIN SELECT RAISE(ABORT, 'En bedömning av ett mätvärde raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS matvarde_bedomningar_andras_ej BEFORE UPDATE OF matvarde_id, enhet_id, beslut, tid, av ON matvarde_bedomningar
  BEGIN SELECT RAISE(ABORT, 'En bedömning av ett mätvärde ändras inte'); END;
-- Patientens egna mätningar från Min journal. enhet_id är den vårdenhet som systemet skickade mätningen till.
CREATE TABLE IF NOT EXISTS egenmatningar (
  matvarde_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, invanare_id TEXT NOT NULL, registrerad TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS egenmatningar_andras_ej BEFORE UPDATE OF matvarde_id, enhet_id, invanare_id, registrerad ON egenmatningar
  BEGIN SELECT RAISE(ABORT, 'En egen mätning ändras inte'); END;
-- Pumpens rapporter: hastighet, volym och dos under perioden, och den given dos som systemet registrerade.
CREATE TABLE IF NOT EXISTS mt_pumphandelser (
  id INTEGER PRIMARY KEY, utrustning_id TEXT NOT NULL, koppling_id INTEGER NOT NULL, meddelande_id INTEGER NOT NULL, patient_id TEXT NOT NULL,
  enhet_id TEXT NOT NULL, ordination_id INTEGER NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL, typ TEXT NOT NULL, hastighet_ml_h REAL,
  volym_ml REAL NOT NULL, dos REAL, dos_enhet TEXT, administrering_id INTEGER, varningar TEXT, kvitterad_tid TEXT, kvitterad_av TEXT,
  CHECK (typ IN ('pagar', 'bolus', 'stopp')), CHECK (volym_ml >= 0)
);
CREATE INDEX IF NOT EXISTS ix_mt_pump_koppl ON mt_pumphandelser (koppling_id);
CREATE TRIGGER IF NOT EXISTS mt_pumphandelser_andras_ej BEFORE UPDATE OF utrustning_id, koppling_id, ordination_id, fran, till, typ, hastighet_ml_h, volym_ml, dos, administrering_id ON mt_pumphandelser
  BEGIN SELECT RAISE(ABORT, 'En rapport från pumpen ändras inte'); END;
`;

const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
// Lägger till tabellerna och demons utrustning. Utrustning som saknas läggs till, så att en äldre sandlåda får den.
export function sakra(db) {
  db.exec(SCHEMA);
  const finns = (id) => db.query('SELECT 1 FROM enheter WHERE id = ?').get(id);
  const ins = db.query('INSERT OR IGNORE INTO mt_utrustning (id, typ, modell, serienummer, streckkod, enhet_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (const u of UTRUSTNING) if (finns(u.enhet)) ins.run(u.id, u.typ, u.modell, u.serienummer, u.streckkod, u.enhet);
}
const sakrad = new WeakSet();
export function finns(db) {
  if (sakrad.has(db)) return true;
  if (!harTabell(db, 'mt_utrustning')) return false;
  sakrad.add(db);
  return true;
}

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const tidText = (t) => `${new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })} kl. ${klocka(t)}`;
const talSv = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');

export const utrustningRad = (db, id) => (typeof id === 'string' ? db.query('SELECT * FROM mt_utrustning WHERE id = ?').get(id) ?? null : null);
const utrustningKort = (u) => (u ? { id: u.id, typ: u.typ, typText: TYPER[u.typ], modell: u.modell, serienummer: u.serienummer, streckkod: u.streckkod, simulerad: Boolean(u.simulerad) } : null);
export const aktivKoppling = (db, utrustningId, tid) => db.query(`SELECT * FROM mt_kopplingar WHERE utrustning_id = ? AND start <= ? AND (slut IS NULL OR slut >= ?)
  ORDER BY start DESC, id DESC LIMIT 1`).get(utrustningId, tid, tid) ?? null;

// Klassningen av ett mätvärde (referens eller godkänt) står i mt-klass.js, som journal.js och vitalparametrar.js läser.
export { OBEDOMDA_KALLOR, kvalitetssakrad, KLASSTEXT, klassFor } from './mt-klass.js';
import { OBEDOMDA_KALLOR } from './mt-klass.js';

// --- Nycklarna -----------------------------------------------------------------------------------------------------
// Varje utrustning har en nyckel som visas en gång när den skapas. I minnet finns bara HMAC av nyckeln, kopplad till
// sandlådan, och i sandlådan bara HMAC. Hemligheten kommer från MT_NYCKEL, annars slumpas den när servern startar, och
// nycklarna behöver då skapas på nytt. Varje nyckel har ett tak för hur många meddelanden den får skicka per minut.
export function skapaNyckellager({ hemlighet = process.env.MT_NYCKEL || randomBytes(32).toString('hex'), nu = () => Date.now() } = {}) {
  const nycklar = new Map();
  const hmac = (t) => createHmac('sha256', hemlighet).update(`mt:${t}`).digest('hex');
  function utfarda(s, personal, utrustningId) {
    const db = s.db;
    const u = utrustningRad(db, utrustningId);
    if (!u) throw new Fel(404, 'Utrustningen finns inte.', 'saknas');
    kravUtrustning(db, personal, u);
    for (const [h, k] of nycklar) if (k.s === s && k.utrustningId === u.id) nycklar.delete(h);
    const nyckel = `vkmt_${randomBytes(24).toString('base64url')}`;
    const h = hmac(nyckel);
    nycklar.set(h, { s, utrustningId: u.id, anrop: [] });
    db.query('UPDATE mt_utrustning SET nyckel_hmac = ?, nyckel_tid = ?, nyckel_av = ? WHERE id = ?').run(h, iso(), personal.id, u.id);
    return { nyckel, utrustning: utrustningKort(u), text: 'Nyckeln visas bara nu. Lägg in den i utrustningen. En tidigare nyckel för utrustningen gäller inte längre.' };
  }
  // Utrustningen bakom en Bearer-rubrik, eller null. Nyckeln gäller bara så länge sandlådan finns och nyckeln är den
  // senaste för utrustningen.
  function hitta(nyckel, finnsSandlada) {
    if (typeof nyckel !== 'string' || !nyckel.startsWith('vkmt_') || nyckel.length > 100) return null;
    const h = hmac(nyckel);
    const k = nycklar.get(h);
    if (!k) return null;
    if (!finnsSandlada(k.s)) { nycklar.delete(h); return null; }
    const u = utrustningRad(k.s.db, k.utrustningId);
    if (!u || u.nyckel_hmac !== h || !u.aktiv) { nycklar.delete(h); return null; }
    return { ...k, utrustning: u };
  }
  function taktak(k) {
    const t = nu();
    k.anrop = k.anrop.filter(x => x > t - MIN);
    if (k.anrop.length >= TAK.perMinut) return false;
    k.anrop.push(t);
    return true;
  }
  const aterkalla = (s) => { for (const [h, k] of nycklar) if (k.s === s) nycklar.delete(h); };
  return { utfarda, hitta, taktak, aterkalla, nycklar };
}

// Den som kopplar, godkänner eller skapar en nyckel arbetar på samma vårdenhet som utrustningen hör till.
function kravUtrustning(db, personal, u) {
  if (!kanRoll(personal, 'koppla_utrustning')) throw new Fel(403, 'Din yrkesroll kopplar inte medicinteknisk utrustning.', 'nekad');
  if (vardenhetFor(db, u.enhet_id) !== vardenhetFor(db, personal.enhet_id)) throw new Fel(403, 'Utrustningen hör till en annan vårdenhet.', 'nekad');
}

// --- Koppling till patienten (Sussa 3.6.1.5) --------------------------------------------------------------------------
const siffror = (s) => String(s ?? '').replace(/\D/g, '');
// Utrustningen som går att koppla på användarens vårdenhet, med om den är kopplad. Patienten som en upptagen utrustning är
// kopplad till visas aldrig här.
export function utrustningFor(db, personal) {
  if (!finns(db) || !kanRoll(personal, 'koppla_utrustning')) return [];
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const nu = iso();
  return db.query(`SELECT * FROM mt_utrustning WHERE aktiv = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY typ, id`).all(...enheter)
    .map(u => ({ ...utrustningKort(u), arbetsplats: enhetsnamn(db, u.enhet_id), upptagen: Boolean(aktivKoppling(db, u.id, nu)) }));
}

export function kopplingUt(db, k) {
  const u = utrustningRad(db, k.utrustning_id);
  const o = k.ordination_id ? db.query('SELECT o.*, k.namn, k.styrka FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.id = ?').get(k.ordination_id) : null;
  return {
    id: k.id, utrustning: utrustningKort(u), start: k.start, slut: k.slut, aktiv: !k.slut, kopplad: { av: personNamn(db, k.kopplad_av), tid: k.start },
    avslutad: k.slut ? { av: personNamn(db, k.avslutad_av), tid: k.slut, orsak: k.avslutad_orsak } : null, armbandKontrollerat: Boolean(k.armband),
    arbetsplats: enhetsnamn(db, k.enhet_id), ordination: o ? { id: o.id, text: `${o.namn} ${o.styrka}`.trim(), dosering: o.dosering } : null,
  };
}

// Kopplingarna för patienten som användaren får se: på vårdenheter som användaren får se uppgifter från.
export function kopplingarFor(atk, { aktiva = false } = {}) {
  if (!finns(atk.db)) return [];
  const rader = atk.filtrera(atk.db.query('SELECT * FROM mt_kopplingar WHERE patient_id = ? ORDER BY start DESC, id DESC').all(atk.patientId), 'las_matvarden');
  return rader.filter(k => !aktiva || !k.slut).map(k => kopplingUt(atk.db, k));
}

// POST /api/patient/:id/mt/koppla { streckkod, armband?, ordinationId? }. Systemet hittar utrustningen ur streckkoden,
// kontrollerar armbandet mot patientens identitet, väljer själv pumpens ordination när det bara finns en infusion och
// avslutar en tidigare koppling när utrustningen flyttas.
export function koppla(atk, p, body = {}, nu = new Date()) {
  const db = atk.db;
  const kod = typeof body.streckkod === 'string' ? body.streckkod.trim().toUpperCase() : '';
  if (!kod) throw new Fel(400, 'Skanna streckkoden på utrustningen.', 'ogiltig', { falt: ['streckkod'] });
  const u = db.query('SELECT * FROM mt_utrustning WHERE streckkod = ? AND aktiv = 1').get(kod);
  if (!u) throw new Fel(400, 'Streckkoden hör inte till någon utrustning i Vårdkällan. Kontrollera att det är utrustningens streckkod.', 'ogiltig', { falt: ['streckkod'] });
  kravVardande(atk, 'koppla_utrustning', null, `mt:koppla:${u.id}`);
  kravUtrustning(db, atk.personal, u);
  let armband = 0;
  if (body.armband != null && body.armband !== '') {
    const a = siffror(body.armband);
    const ident = [p.personnummer, ...db.query('SELECT varde FROM identiteter WHERE patient_id = ?').all(p.id).map(r => r.varde)].map(siffror).filter(Boolean);
    if (!a || !ident.some(x => x === a || x.slice(2) === a || a.slice(2) === x)) {
      atk.logga('koppla_utrustning', 'nekad', `mt:koppla:${u.id}:armband`, 'nekad');
      throw new Fel(400, 'Armbandet hör inte till den här patienten. Kontrollera att du står vid rätt patient innan utrustningen kopplas.', 'ogiltig', { falt: ['armband'] });
    }
    armband = 1;
  }
  let ordinationId = null;
  if (u.typ === 'pump') {
    const infusioner = pumpOrdinationer(atk);
    if (body.ordinationId != null) {
      ordinationId = infusioner.find(o => o.id === Number(body.ordinationId))?.id ?? null;
      if (!ordinationId) throw new Fel(400, 'Ordinationen går inte att koppla till pumpen. Välj en aktiv infusion för patienten.', 'ogiltig', { falt: ['ordinationId'] });
    } else if (infusioner.length === 1) ordinationId = infusioner[0].id;
    else if (!infusioner.length) throw new Fel(400, 'Patienten har ingen aktiv infusion att koppla pumpen till. Läkaren ordinerar infusionen först.', 'ogiltig', { falt: ['ordinationId'] });
    else throw new Fel(400, 'Patienten har flera infusioner. Välj vilken som pumpen ger.', 'ogiltig', { falt: ['ordinationId'], ordinationer: infusioner });
  }
  const t = nu.toISOString();
  const tidigare = aktivKoppling(db, u.id, t);
  const ut = db.transaction(() => {
    if (tidigare) {
      if (tidigare.patient_id === p.id && (tidigare.ordination_id ?? null) === ordinationId) return { koppling: tidigare, redan: true };
      db.query('UPDATE mt_kopplingar SET slut = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ?').run(t, atk.personal.id, 'Utrustningen flyttades till en annan patient', tidigare.id);
      // Den tidigare kopplingen loggas på den patienten, utan att något om den patienten lämnas ut här.
      loggaRad(db, { personal_id: atk.personal.id, enhet_id: atk.personal.enhet_id, patient_id: tidigare.patient_id, handling: 'koppla_utrustning', resurs: `mt:koppling:${tidigare.id}:avslutad`, grund: 'egen_enhet', resultat: 'tillaten' });
    }
    const id = Number(db.query('INSERT INTO mt_kopplingar (utrustning_id, patient_id, enhet_id, ordination_id, start, kopplad_av, armband) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, p.id, u.enhet_id, ordinationId, t, atk.personal.id, armband).lastInsertRowid);
    return { koppling: db.query('SELECT * FROM mt_kopplingar WHERE id = ?').get(id), redan: false };
  })();
  atk.logga('koppla_utrustning', atk.grund(), `mt:koppling:${ut.koppling.id}`);
  const flyttad = tidigare && !ut.redan && tidigare.patient_id !== p.id;
  return {
    koppling: kopplingUt(db, ut.koppling), redan: ut.redan,
    text: ut.redan ? `${TYPER[u.typ]} ${u.serienummer} är redan kopplad till patienten.`
      : `${TYPER[u.typ]} ${u.serienummer} är kopplad till patienten från ${klocka(t)}.${flyttad ? ' Kopplingen till den förra patienten avslutades samtidigt.' : ''}${u.typ === 'monitor' ? ' Värdena kommer som referens tills de godkänns.' : ''}`,
  };
}

// POST /api/mt/koppling/:id/avsluta. Bara på patientens journal och av någon på samma vårdenhet som utrustningen.
export function avsluta(atk, k, body = {}, nu = new Date()) {
  const db = atk.db;
  const u = utrustningRad(db, k.utrustning_id);
  kravVardande(atk, 'koppla_utrustning', null, `mt:koppling:${k.id}`);
  kravUtrustning(db, atk.personal, u);
  if (k.slut) throw new Fel(400, 'Kopplingen är redan avslutad.', 'ogiltig');
  const t = nu.toISOString();
  db.query('UPDATE mt_kopplingar SET slut = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ?').run(t, atk.personal.id, typeof body.orsak === 'string' && body.orsak.trim() ? body.orsak.trim().slice(0, 200) : 'Utrustningen kopplades från', k.id);
  atk.logga('koppla_utrustning', atk.grund(), `mt:koppling:${k.id}:avslutad`);
  return { koppling: kopplingUt(db, db.query('SELECT * FROM mt_kopplingar WHERE id = ?').get(k.id)), text: `${TYPER[u.typ]} ${u.serienummer} är frånkopplad. Värden som kommer efter ${klocka(t)} avvisas.` };
}
export const kopplingRad = (db, id) => {
  const k = finns(db) && /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM mt_kopplingar WHERE id = ?').get(Number(id)) : null;
  if (!k) throw new Fel(404, 'Kopplingen finns inte.', 'saknas');
  return k;
};

// Aktiva infusioner för en pump: ordinationer som användaren får se, som är aktiva och ges som infusion (kontinuerlig
// infusion i iva.js eller spädning med volym och tid).
export function pumpOrdinationer(atk) {
  const db = atk.db;
  const dag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const rader = db.query(`SELECT o.*, k.namn, k.styrka FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND o.status = 'aktiv' AND (o.slut IS NULL OR o.slut >= ?)
    ORDER BY o.id`).all(atk.patientId, dag);
  const synliga = atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
  return synliga.filter(o => infusionFor(db, o.id)).map(o => ({ id: o.id, text: `${o.namn} ${o.styrka}`.trim(), dosering: o.dosering }));
}

// Koncentrationen och dosen per ml för en infusion: ur IVA-infusionen (iva_infusioner) eller ur spädningen
// (ordination_spadning, tillsatsens mängd delad med volymen).
export function infusionFor(db, ordinationId) {
  if (harTabell(db, 'iva_infusioner')) {
    const i = db.query('SELECT * FROM iva_infusioner WHERE ordination_id = ?').get(ordinationId);
    if (i) return { koncentration: i.koncentration, enhet: i.konc_enhet.split('/')[0], iva: i };
  }
  if (harTabell(db, 'ordination_spadning')) {
    const s = db.query('SELECT * FROM ordination_spadning WHERE ordination_id = ?').get(ordinationId);
    if (s) {
      const t = JSON.parse(s.tillsatser || '[]')[0];
      return { koncentration: t ? t.mangd / s.volym_ml : null, enhet: t?.enhet ?? null, volymMl: s.volym_ml, tidMin: s.tid_min, spadning: s };
    }
  }
  return null;
}

// --- Mottagningen (Sussa 3.6.1.1 och 3.6.1.4) -------------------------------------------------------------------------
const fel = (text, falt = null) => new Fel(400, text, 'ogiltig', falt ? { falt } : {});
const harKod = (cc, system, koder) => (cc?.coding ?? []).some(c => c?.system === system && koder.includes(String(c.code)));
function typForKod(cc) {
  for (const [typ, k] of Object.entries(KODER)) if (harKod(cc, SYS_LOINC, k.loinc) || harKod(cc, SYS_MDC, k.mdc)) return typ;
  return null;
}
const kodText = (cc) => (cc?.coding ?? []).map(c => `${c?.system === SYS_MDC ? 'MDC' : c?.system === SYS_LOINC ? 'LOINC' : c?.system ?? 'okänt system'} ${c?.code ?? ''}`.trim()).join(', ') || 'ingen kod';

// Ett tal i rätt intervall för mätvärdet, annars en förklaring.
export function provaVarde(typ, v, matttyper) {
  const def = matttyper[typ];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw fel(`${def.namn} saknar ett värde som tal.`);
  if (v < def.min || v > def.max) throw fel(`${def.namn} ${talSv(v)} ligger utanför det som går att mäta (${def.min} till ${def.max} ${MATTYPER_ENHET[typ]}). Värdet sparades inte.`);
  return v;
}
function provaTid(t, nu) {
  const ms = typeof t === 'string' ? Date.parse(t) : NaN;
  if (!Number.isFinite(ms)) throw fel('Mätvärdet saknar en giltig tid (effectiveDateTime eller OBX-14).');
  if (ms > nu.getTime() + 5 * MIN) throw fel(`Tiden ${t} ligger i framtiden. Kontrollera klockan i utrustningen.`);
  if (ms < nu.getTime() - DAG) throw fel(`Tiden ${t} är mer än ett dygn gammal. Äldre värden tas inte emot från utrustning.`);
  return new Date(ms).toISOString();
}

// FHIR: Bundle med Device, Observation och MedicationAdministration. Ger { utrustning, patient, varden, pump }.
export function lasFhir(b, matttyper) {
  if (!b || typeof b !== 'object' || b.resourceType !== 'Bundle') throw fel('Meddelandet ska vara en FHIR Bundle (resourceType Bundle).');
  if (!['collection', 'transaction', 'batch'].includes(b.type)) throw fel('Bundle ska ha typen collection, transaction eller batch.');
  const resurser = (Array.isArray(b.entry) ? b.entry : []).map(e => e?.resource).filter(r => r && typeof r === 'object');
  const okanda = [...new Set(resurser.map(r => r.resourceType).filter(t => !['Device', 'Observation', 'MedicationAdministration'].includes(t)))];
  if (okanda.length) throw fel(`Bundle får bara innehålla Device, Observation och MedicationAdministration, inte ${okanda.join(', ')}.`);
  const enheter = resurser.filter(r => r.resourceType === 'Device');
  if (enheter.length !== 1) throw fel('Bundle ska innehålla exakt en Device med utrustningens nummer.');
  const dev = enheter[0];
  const ident = (dev.identifier ?? []).map(i => i?.value).filter(x => typeof x === 'string');
  const obs = resurser.filter(r => r.resourceType === 'Observation');
  const adm = resurser.filter(r => r.resourceType === 'MedicationAdministration');
  if (!obs.length && !adm.length) throw fel('Bundle innehåller inga mätvärden (Observation) eller rapporter från pumpen (MedicationAdministration).');
  if (obs.length + adm.length > TAK.varden) throw fel(`Ett meddelande får innehålla högst ${TAK.varden} värden.`);
  const patienter = new Set();
  const subj = (r) => {
    const ref = r.subject?.reference ?? null;
    const idv = r.subject?.identifier?.value ?? null;
    if (ref || idv) patienter.add(JSON.stringify({ ref: ref ? String(ref).replace(/^.*Patient\//, '') : null, ident: idv ? siffror(idv) : null }));
  };
  const varden = obs.map((o, i) => {
    const nr = `Observation ${i + 1}`;
    if (!['final', 'preliminary', 'amended'].includes(o.status)) throw fel(`${nr} har status ${o.status ?? 'saknas'}. Bara final, preliminary och amended tas emot.`);
    const typ = typForKod(o.code);
    if (!typ) throw fel(`${nr} har koden ${kodText(o.code)}, som Vårdkällan inte tar emot från utrustning. Använd LOINC eller MDC för puls, syremättnad, andningsfrekvens, temperatur eller blodtryck.`);
    const k = KODER[typ];
    subj(o);
    if (o.device?.reference && dev.id && !String(o.device.reference).endsWith(`Device/${dev.id}`) && o.device.reference !== `#${dev.id}` && o.device.reference !== dev.fullUrl) {
      throw fel(`${nr} pekar på en annan utrustning än den i meddelandet.`);
    }
    const tid = o.effectiveDateTime;
    if (typ === 'blodtryck') {
      const komp = (del) => (o.component ?? []).find(c => harKod(c.code, SYS_LOINC, [k[del].loinc]) || harKod(c.code, SYS_MDC, [k[del].mdc]));
      const s = komp('sys');
      const d = komp('dia');
      if (!s || !d) throw fel(`${nr} är ett blodtryck och ska ha både systoliskt och diastoliskt som component.`);
      for (const c of [s, d]) if (c.valueQuantity?.system !== SYS_UCUM || c.valueQuantity?.code !== 'mm[Hg]') throw fel(`${nr}: blodtrycket ska anges i mm[Hg] (UCUM).`);
      return { typ, sys: s.valueQuantity.value, dia: d.valueQuantity.value, tid };
    }
    const q = o.valueQuantity;
    if (!q || q.system !== SYS_UCUM || !k.ucum.includes(q.code)) throw fel(`${nr}: ${matttyper[typ].namn.toLowerCase()} ska anges som valueQuantity i UCUM med enheten ${k.ucum.join(' eller ')}, inte ${q?.code ?? q?.unit ?? 'ingen enhet'}.`);
    return { typ, varde: q.value, tid };
  });
  const pump = adm.map((a, i) => {
    const nr = `MedicationAdministration ${i + 1}`;
    subj(a);
    if (!['in-progress', 'completed', 'stopped'].includes(a.status)) throw fel(`${nr} har status ${a.status ?? 'saknas'}. Pumpen rapporterar in-progress, completed eller stopped.`);
    const ord = String(a.request?.reference ?? '').match(/MedicationRequest\/(\d{1,9})$/);
    const fran = a.effectivePeriod?.start;
    const till = a.effectivePeriod?.end ?? a.effectiveDateTime;
    const rate = a.dosage?.rateQuantity;
    const dos = a.dosage?.dose;
    const bolus = (a.category?.coding ?? []).some(c => c?.code === 'bolus') || a.category?.text === 'bolus';
    if (rate && (rate.system !== SYS_UCUM || rate.code !== 'mL/h')) throw fel(`${nr}: hastigheten ska anges i mL/h (UCUM).`);
    if (dos && (dos.system !== SYS_UCUM || dos.code !== 'mL')) throw fel(`${nr}: den givna volymen ska anges i mL (UCUM).`);
    if (!dos && !rate) throw fel(`${nr} saknar både hastighet och given volym.`);
    return { ordinationId: ord ? Number(ord[1]) : null, fran: fran ?? till, till, hastighet: rate?.value ?? null, volym: dos?.value ?? null, bolus, status: a.status };
  });
  if (patienter.size > 1) throw fel('Meddelandet anger flera patienter. Varje meddelande gäller den patient som utrustningen är kopplad till.');
  return { utrustning: ident, patient: patienter.size ? JSON.parse([...patienter][0]) : null, varden, pump };
}

// HL7 v2: ORU^R01 enligt IHE PCD-01. Ger samma form som lasFhir och kontrollnumret för svaret.
export function lasHl7(text) {
  if (typeof text !== 'string' || !text.startsWith('MSH')) throw fel('Meddelandet ska börja med segmentet MSH.');
  const sep = text[3];
  const segment = text.split(/\r\n|\r|\n/).filter(Boolean).map(s => s.split(sep));
  const msh = segment[0];
  const komp = msh[1]?.[0] ?? '^';
  const del = (f, i = 0) => String(f ?? '').split(komp)[i] ?? '';
  // MSH-9 är fält 8 när fältavgränsaren räknas som MSH-1.
  if (del(msh[8], 0) !== 'ORU' || del(msh[8], 1) !== 'R01') throw fel(`Meddelandet är ${msh[8] || 'utan typ'}. Bara ORU^R01 tas emot.`);
  const kontroll = msh[9] ?? '';
  const version = msh[11] ?? '';
  if (!/^2\.[5-9]/.test(version)) throw fel(`HL7-versionen ${version || 'saknas'}. Version 2.5 eller senare tas emot.`);
  const pid = segment.find(s => s[0] === 'PID');
  const patient = pid ? { ref: null, ident: siffror(del(pid[3], 0)) || null } : null;
  const obx = segment.filter(s => s[0] === 'OBX');
  if (!obx.length) throw fel('Meddelandet innehåller inga OBX-segment med mätvärden.');
  if (obx.length > TAK.varden) throw fel(`Ett meddelande får innehålla högst ${TAK.varden} värden.`);
  const utr = new Set();
  const delvis = new Map();
  const varden = [];
  for (const [i, o] of obx.entries()) {
    const nr = `OBX ${i + 1}`;
    if (o[2] !== 'NM') throw fel(`${nr} har värdetypen ${o[2] || 'saknas'}. Bara NM (tal) tas emot.`);
    const kod = del(o[3], 0);
    const system = del(o[3], 2);
    const enhet = del(o[6], 0);
    const enhetSystem = del(o[6], 2);
    if (!['F', 'R', 'C'].includes(o[11])) throw fel(`${nr} har status ${o[11] || 'saknas'}. Bara F, R och C tas emot.`);
    const tidHl7 = o[14] || '';
    const m = tidHl7.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?([+-]\d{4})?$/);
    if (!m) throw fel(`${nr} saknar en giltig tid i OBX-14 (ÅÅÅÅMMDDTTMMSS).`);
    const zon = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : 'Z';
    const tid = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}${zon}`;
    if (o[18]) utr.add(del(o[18], 0));
    const v = Number(o[5]);
    const sysOk = (x) => (system === 'MDC' ? x.mdc : system === 'LN' ? x.loinc : null);
    let typ = null;
    for (const [t, k] of Object.entries(KODER)) {
      if (t === 'blodtryck') {
        for (const d of ['sys', 'dia']) if (sysOk(k[d]) && String(sysOk(k[d])) === kod) { typ = t; delvis.set(tid, { ...delvis.get(tid), [d]: v, enhet, enhetSystem }); }
      } else if ((system === 'MDC' ? k.mdc : system === 'LN' ? k.loinc : []).includes(kod)) typ = t;
      if (typ) break;
    }
    if (!typ) throw fel(`${nr} har koden ${kod || 'saknas'}^${system || 'saknas'}, som Vårdkällan inte tar emot från utrustning. Använd MDC eller LN (LOINC) för puls, syremättnad, andningsfrekvens, temperatur eller blodtryck.`);
    const k = KODER[typ];
    const okEnhet = enhetSystem === 'MDC' ? k.mdcEnhet.includes(enhet) : ['UCUM', ''].includes(enhetSystem) && k.ucum.includes(enhet);
    if (!okEnhet) throw fel(`${nr}: enheten ${enhet || 'saknas'}^${enhetSystem || 'saknas'} passar inte ${typ === 'blodtryck' ? 'blodtryck' : typ}. Använd ${k.ucum.join(' eller ')} i UCUM eller ${k.mdcEnhet.join(' eller ')} i MDC.`);
    if (typ !== 'blodtryck') varden.push({ typ, varde: v, tid });
  }
  for (const [tid, d] of delvis) {
    if (d.sys == null || d.dia == null) throw fel('Ett blodtryck ska skickas som två OBX med systoliskt och diastoliskt med samma tid.');
    varden.push({ typ: 'blodtryck', sys: d.sys, dia: d.dia, tid });
  }
  if (utr.size > 1) throw fel('Meddelandet anger flera utrustningar i OBX-18.');
  return { utrustning: [...utr], patient, varden, pump: [], kontroll };
}

// Tar emot ett meddelande från en utrustning: format, utrustningens identitet, kopplingen till patienten, tiden och
// värdena prövas, och allt eller inget sparas. Ett avvisat meddelande sparas med orsaken. Ger { status, text, antal }.
export function taEmot(db, u, { format, kropp }, { nu = new Date(), simulerat = false, matttyper } = {}) {
  const ut = (status, orsak, extra = {}) => ({ status, text: orsak, ...extra });
  const avvisa = (orsak, koppling = null) => {
    db.query('INSERT INTO mt_meddelanden (utrustning_id, enhet_id, koppling_id, patient_id, tid, format, status, orsak, antal, simulerat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
      .run(u.id, u.enhet_id, koppling?.id ?? null, koppling?.patient_id ?? null, nu.toISOString(), format, 'avvisat', orsak, simulerat ? 1 : 0);
    return ut('avvisat', orsak);
  };
  let m;
  try {
    m = format === 'hl7v2' ? lasHl7(kropp) : lasFhir(kropp, matttyper);
    if (m.utrustning.length && !m.utrustning.some(x => [u.id, u.serienummer].includes(x))) throw fel('Utrustningen i meddelandet är inte den som nyckeln hör till.');
    if (!m.utrustning.length) throw fel(format === 'hl7v2' ? 'Utrustningens nummer saknas i OBX-18.' : 'Device saknar identifier med utrustningens nummer.');
    if (u.typ === 'monitor' && m.pump.length) throw fel('En patientmonitor rapporterar inte doser.');
    if (u.typ === 'pump' && m.varden.length) throw fel('En infusionspump skickar inte mätvärden. Mätvärden kommer från en patientmonitor.');
  } catch (e) {
    if (e instanceof Fel) return avvisa(e.message);
    throw e;
  }
  let tider;
  try { tider = [...m.varden.map(v => provaTid(v.tid, nu)), ...m.pump.map(p => provaTid(p.till, nu))]; } catch (e) { if (e instanceof Fel) return avvisa(e.message); throw e; }
  const kopplingar = [...new Set(tider.map(t => aktivKoppling(db, u.id, t)?.id ?? null))];
  if (kopplingar.includes(null)) {
    const forsta = tider[kopplingar.length === 1 ? 0 : tider.findIndex(t => !aktivKoppling(db, u.id, t))];
    return avvisa(`Utrustningen var inte kopplad till någon patient ${tidText(forsta)}. Värdena sparades inte. Koppla utrustningen till patienten i Vårdkällan genom att skanna dess streckkod.`);
  }
  if (kopplingar.length > 1) return avvisa('Meddelandet innehåller värden från två olika kopplingar. Skicka värdena före och efter bytet av patient i var sitt meddelande.');
  const k = db.query('SELECT * FROM mt_kopplingar WHERE id = ?').get(kopplingar[0]);
  if (m.patient) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(k.patient_id);
    const idn = [p.personnummer, ...db.query('SELECT varde FROM identiteter WHERE patient_id = ?').all(p.id).map(r => r.varde)].map(siffror);
    const ratt = (m.patient.ref ? m.patient.ref === p.id : true) && (m.patient.ident ? idn.some(x => x === m.patient.ident || x.slice(2) === m.patient.ident) : true);
    if (!ratt) return avvisa('Patienten i meddelandet är inte den som utrustningen är kopplad till. Värdena sparades inte. Kontrollera kopplingen vid patienten.', k);
  }
  // Värdena prövas och normaliseras innan något sparas.
  let rader;
  try {
    rader = m.varden.map((v, i) => {
      const tid = tider[i];
      if (v.typ === 'blodtryck') {
        const s = provaVarde('blodtryck', v.sys, { blodtryck: { namn: 'Systoliskt blodtryck', min: 30, max: 300 } });
        const d = provaVarde('blodtryck', v.dia, { blodtryck: { namn: 'Diastoliskt blodtryck', min: 10, max: 250 } });
        if (s <= d) throw fel('Det systoliska blodtrycket ska vara högre än det diastoliska.');
        return { typ: 'blodtryck', text: `${Math.round(s)}/${Math.round(d)}`, num: null, tid };
      }
      const num = provaVarde(v.typ, v.varde, matttyper);
      return { typ: v.typ, text: String(num), num, tid };
    });
  } catch (e) { if (e instanceof Fel) return avvisa(e.message, k); throw e; }
  const ve = vardenhetFor(db, k.enhet_id);
  const vk = db.query(`SELECT id FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND enhet_id IN (${enheterUnder(db, ve).map(() => '?').join(', ')}) ORDER BY (typ = 'slutenvard') DESC, start DESC LIMIT 1`)
    .get(k.patient_id, ...enheterUnder(db, ve))?.id ?? null;
  let resultat;
  try {
  resultat = db.transaction(() => {
    const mid = Number(db.query('INSERT INTO mt_meddelanden (utrustning_id, enhet_id, koppling_id, patient_id, tid, format, status, antal, simulerat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, u.enhet_id, k.id, k.patient_id, nu.toISOString(), format, 'mottaget', rader.length + m.pump.length, simulerat ? 1 : 0).lastInsertRowid);
    let sparade = 0;
    for (const r of rader) {
      // Samma värde från samma utrustning och tid sparas en gång, så att ett meddelande som skickas igen inte dubblerar.
      const dubbel = db.query('SELECT 1 FROM mt_varden v JOIN matvarden m ON m.id = v.matvarde_id WHERE v.utrustning_id = ? AND m.typ = ? AND m.tid = ?').get(u.id, r.typ, r.tid);
      if (dubbel) continue;
      const id = Number(db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vidimerad, vardkontakt_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'utrustning', NULL, ?)")
        .run(k.patient_id, k.enhet_id, r.typ, r.text, r.num, MATTYPER_ENHET[r.typ], r.tid, vk).lastInsertRowid);
      db.query('INSERT INTO mt_varden (matvarde_id, utrustning_id, koppling_id, meddelande_id, patient_id, enhet_id) VALUES (?, ?, ?, ?, ?, ?)').run(id, u.id, k.id, mid, k.patient_id, k.enhet_id);
      sparade++;
    }
    const doser = m.pump.map(p => pumprapport(db, u, k, mid, p, { vk }));
    return { mid, sparade, doser };
  })();
  } catch (e) {
    // En rapport från pumpen som inte stämmer med ordinationen avvisas, och inget av meddelandet sparas.
    if (e instanceof Fel) return avvisa(e.message, k);
    throw e;
  }
  return ut('mottaget', `${resultat.sparade + resultat.doser.length} värden togs emot för den kopplade patienten.`, { antal: resultat.sparade + resultat.doser.length, meddelande: resultat.mid, doser: resultat.doser });
}

// --- Pumpen (Sussa 3.5.2.19) ---------------------------------------------------------------------------------------
// En rapport från pumpen: given volym under perioden blir en given dos med källan utrustning och ett intag i
// vätskebalansen. Dosen räknas ur koncentrationen och kontrolleras mot ordinationen och dygnsdosen.
function pumprapport(db, u, k, mid, p, { vk }) {
  if (!k.ordination_id) throw fel('Pumpen är inte kopplad till någon ordination.');
  if (p.ordinationId != null && p.ordinationId !== k.ordination_id) throw fel('Pumpen rapporterar en annan ordination än den som den är kopplad till. Kontrollera pumpen.');
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(k.ordination_id);
  if (!o || o.status !== 'aktiv') throw fel('Ordinationen som pumpen är kopplad till är inte aktiv. Stoppa pumpen och kontakta läkaren.');
  const fran = Date.parse(p.fran);
  const till = Date.parse(p.till);
  if (!Number.isFinite(fran) || !Number.isFinite(till) || till < fran || till - fran > 2 * TIMME) throw fel('Pumpens period ska ha en start och ett slut och vara högst två timmar.');
  const volym = p.volym ?? (p.hastighet != null ? Math.round(p.hastighet * (till - fran) / TIMME * 100) / 100 : 0);
  if (volym < 0 || volym > 500) throw fel('Den givna volymen ska vara mellan 0 och 500 ml.');
  const inf = infusionFor(db, o.id);
  const dos = inf?.koncentration != null ? Math.round(volym * inf.koncentration * 1000) / 1000 : null;
  const typ = p.bolus ? 'bolus' : p.status === 'stopped' ? 'stopp' : 'pagar';
  const varningar = pumpvarningar(db, o, inf, { typ, hastighet: p.hastighet, dos, fran, till, patientId: k.patient_id });
  let admId = null;
  if (volym > 0) {
    const t = new Date(till).toISOString();
    admId = Number(db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av, registrerad, registrerad_av,
      efterhand, volym_ml, vardkontakt_id, kalla) VALUES (?, ?, ?, ?, NULL, 'given', ?, ?, 1, ?, ?, ?, ?, 0, ?, ?, 'utrustning')`)
      .run(k.patient_id, k.enhet_id, o.id, o.lakemedel_id, dos, inf?.enhet ?? null, t, k.kopplad_av, iso(), k.kopplad_av, volym, vk).lastInsertRowid);
    db.query("INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av, administrering_id, vardkontakt_id, kalla) VALUES (?, ?, 'in', 'lakemedel', ?, ?, ?, ?, ?, ?, 'utrustning')")
      .run(k.patient_id, k.enhet_id, volym, t, iso(), k.kopplad_av, admId, vk);
  }
  const id = Number(db.query(`INSERT INTO mt_pumphandelser (utrustning_id, koppling_id, meddelande_id, patient_id, enhet_id, ordination_id, fran, till, typ, hastighet_ml_h, volym_ml, dos, dos_enhet, administrering_id, varningar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(u.id, k.id, mid, k.patient_id, k.enhet_id, o.id, new Date(fran).toISOString(), new Date(till).toISOString(), typ,
    p.hastighet ?? null, volym, dos, inf?.enhet ?? null, admId, varningar.length ? JSON.stringify(varningar) : null).lastInsertRowid);
  return { id, administreringId: admId, volymMl: volym, dos, varningar };
}

// Kontrollen av en rapport mot ordinationen: dos per kilo och timme inom det ordinerade intervallet, bolus inom den
// ordinerade bolusdosen och dygnsdosen. Demoregler.
export function pumpvarningar(db, o, inf, { typ, hastighet, dos, fran, till, patientId }) {
  const ut = [];
  const iva = inf?.iva;
  if (!inf || inf.koncentration == null) {
    ut.push({ niva: 'varning', regel: 'koncentration_saknas', text: 'Koncentrationen saknas i ordinationen, så dosen kan inte räknas. Kontrollera pumpens inställning mot ordinationen.' });
    return ut;
  }
  if (iva && typ === 'pagar' && hastighet != null) {
    const vikt = iva.vikt_kg;
    const perH = hastighet * inf.koncentration;
    const perKgH = vikt ? perH / vikt : null;
    const enhet = iva.dos_enhet;
    if (perKgH != null && (perKgH > iva.dos_max * 1.0001 || perKgH < iva.dos_min * 0.9999) && hastighet > 0) {
      ut.push({ niva: 'allvarlig', regel: 'utanfor_intervall', text: `Pumpen ger ${talSv(perKgH, 3)} ${enhet}, utanför det ordinerade intervallet ${talSv(iva.dos_min, 3)} till ${talSv(iva.dos_max, 3)} ${enhet}. Kontrollera pumpen och ordinationen.` });
    }
  }
  if (iva && typ === 'bolus') {
    if (iva.bolus_dos == null) ut.push({ niva: 'allvarlig', regel: 'bolus_ej_ordinerad', text: 'En bolus gavs, men ordinationen har ingen bolusdos. Kontakta ansvarig läkare.' });
    else if (dos > iva.bolus_dos * 1.0001) ut.push({ niva: 'allvarlig', regel: 'bolus_for_stor', text: `Bolusen var ${talSv(dos, 2)} ${inf.enhet}, mer än den ordinerade bolusdosen ${talSv(iva.bolus_dos, 2)} ${inf.enhet}.` });
  }
  const max = iva?.max_dygn ?? null;
  if (max != null && dos != null) {
    const t0 = new Date(till - DAG).toISOString();
    const tidigare = db.query("SELECT coalesce(sum(dos), 0) AS s FROM administreringar WHERE ordination_id = ? AND status = 'given' AND tid > ? AND tid <= ?").get(o.id, t0, new Date(till).toISOString()).s;
    if (tidigare + dos > max * 1.0001) ut.push({ niva: 'allvarlig', regel: 'dygnsdos', text: `Det senaste dygnet har patienten fått ${talSv(tidigare + dos, 1)} ${inf.enhet}, mer än den högsta dygnsdosen ${talSv(max, 1)} ${inf.enhet}.` });
  }
  return ut;
}

// Pumparna på användarens vårdenhet, för Läkemedel att ge: den senaste rapporten och varningar som inte är kvitterade.
// Bara patienter som användaren får se doser för, och bara doser på den egna vårdenheten.
export function pumpar(db, personal, valFor, nu = new Date()) {
  if (!finns(db) || !kanRoll(personal, 'las_lakemedel')) return { pumpar: [], patientIdn: [] };
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const t = nu.toISOString();
  const ut = [];
  for (const k of db.query(`SELECT k.* FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE u.typ = 'pump' AND k.enhet_id IN (${ph}) AND k.start <= ? AND (k.slut IS NULL OR k.slut >= ?) ORDER BY k.start`).all(...enheter, t, t)) {
    const p = db.query('SELECT * FROM patienter WHERE id = ? AND sammanslagen_till IS NULL').get(k.patient_id);
    if (!p) continue;
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_lakemedel');
    const r = atk.prova('las_lakemedel', { enhet_id: k.enhet_id, gemensam: true });
    if (!r.tillaten || r.grund === 'nodatkomst') continue;
    ut.push({ ...pumpstatus(db, k, nu), patient: { id: p.id, namn: p.skyddad ? 'Skyddad identitet' : `${p.fornamn} ${p.efternamn}`, personnummer: visningsPnr(p) } });
  }
  return { pumpar: ut, patientIdn: ut.map(x => x.patient.id) };
}
export function pumpstatus(db, k, nu = new Date()) {
  const h = db.query('SELECT * FROM mt_pumphandelser WHERE koppling_id = ? ORDER BY till DESC, id DESC').all(k.id);
  const senaste = h[0] ?? null;
  const dygn = h.filter(x => Date.parse(x.till) > nu.getTime() - DAG);
  const okvitterade = h.filter(x => x.varningar && !x.kvitterad_tid).map(x => ({ id: x.id, tid: x.till, varningar: JSON.parse(x.varningar) }));
  const inf = k.ordination_id ? infusionFor(db, k.ordination_id) : null;
  return {
    koppling: kopplingUt(db, k),
    senaste: senaste ? { tid: senaste.till, typ: senaste.typ, hastighetMlH: senaste.hastighet_ml_h, volymMl: senaste.volym_ml, dos: senaste.dos, dosEnhet: senaste.dos_enhet,
      text: senaste.typ === 'stopp' ? `Stoppad ${klocka(senaste.till)}` : senaste.typ === 'bolus' ? `Bolus ${talSv(senaste.volym_ml, 1)} ml ${klocka(senaste.till)}` : `${talSv(senaste.hastighet_ml_h ?? 0, 1)} ml/h, rapporterat ${klocka(senaste.till)}` } : null,
    dygn: { volymMl: Math.round(dygn.reduce((s, x) => s + x.volym_ml, 0) * 10) / 10, dos: inf?.koncentration != null ? Math.round(dygn.reduce((s, x) => s + (x.dos ?? 0), 0) * 100) / 100 : null, dosEnhet: inf?.enhet ?? null },
    okvitterade,
  };
}
// POST /api/mt/pumphandelse/:id/kvittera { motivering }: sjuksköterskan kvitterar en varning från pumpen.
export function kvittera(atk, h, body = {}, nu = new Date()) {
  if (!['lakare', 'sjukskoterska'].includes(atk.personal.yrke)) throw new Fel(403, 'En varning från pumpen kvitteras av sjuksköterska eller läkare.', 'nekad');
  kravVardande(atk, 'ge_lakemedel', { enhet_id: h.enhet_id, gemensam: true }, `mt:pump:${h.id}`);
  if (!h.varningar) throw new Fel(400, 'Rapporten har ingen varning att kvittera.', 'ogiltig');
  if (h.kvitterad_tid) throw new Fel(400, 'Varningen är redan kvitterad.', 'ogiltig');
  const mot = typeof body.motivering === 'string' ? body.motivering.trim() : '';
  if (mot.length < 3) throw new Fel(400, 'Skriv vad som gjordes, till exempel att pumpen ställdes om efter ordinationen.', 'ogiltig', { falt: ['motivering'] });
  atk.db.query('UPDATE mt_pumphandelser SET kvitterad_tid = ?, kvitterad_av = ? WHERE id = ?').run(nu.toISOString(), atk.personal.id, h.id);
  atk.logga('ge_lakemedel', atk.grund(), `mt:pump:${h.id}:kvitterad`);
  return { text: 'Varningen är kvitterad.' };
}

// --- Godkännande för diagnostiskt bruk (Sussa 3.6.1.6 och 3.6.1.7) --------------------------------------------------
// Värdena som användaren kan godkänna: från utrustning eller patientens egna mätningar, inte bedömda, som användaren får
// se och som hör till den egna vårdenheten.
export function attBedoma(atk, synliga) {
  const db = atk.db;
  if (!finns(db)) return [];
  const min = vardenhetFor(db, atk.personal.enhet_id);
  return synliga.filter(m => OBEDOMDA_KALLOR.has(m.kalla) && vardenhetFor(db, m.enhet_id) === min && !db.query('SELECT 1 FROM matvarde_bedomningar WHERE matvarde_id = ?').get(m.id));
}
// POST /api/patient/:id/mt/godkann { ids?, kalla?, beslut? }. Utan ids godkänns alla värden som väntar, från utrustning
// eller patienten enligt kalla. beslut referens betyder att värdet är bedömt men inte ska användas för diagnos.
export function godkann(atk, synliga, body = {}, nu = new Date()) {
  kravVardande(atk, 'godkanna_matvarde', null, 'mt:godkann');
  const db = atk.db;
  const beslut = body.beslut === 'referens' ? 'referens' : 'godkand';
  let kandidater = attBedoma(atk, synliga);
  if (body.kalla != null) kandidater = kandidater.filter(m => m.kalla === body.kalla);
  if (Array.isArray(body.ids)) {
    const ids = body.ids.map(Number);
    const finnsBland = new Set(kandidater.map(m => m.id));
    if (!ids.length || ids.some(i => !finnsBland.has(i))) throw new Fel(400, 'Något av värdena går inte att bedöma. Det kan redan vara bedömt, eller höra till en annan vårdenhet.', 'ogiltig', { falt: ['ids'] });
    kandidater = kandidater.filter(m => ids.includes(m.id));
  }
  if (!kandidater.length) throw new Fel(400, 'Det finns inga värden som väntar på bedömning.', 'ogiltig');
  const t = nu.toISOString();
  db.transaction(() => {
    for (const m of kandidater) {
      db.query('INSERT INTO matvarde_bedomningar (matvarde_id, patient_id, enhet_id, beslut, tid, av) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.patient_id, m.enhet_id, beslut, t, atk.personal.id);
      if (beslut === 'godkand') db.query('UPDATE matvarden SET vidimerad = ? WHERE id = ?').run(t, m.id);
    }
  })();
  atk.logga('godkanna_matvarde', atk.grund(), `mt:${beslut}:${kandidater.length}`);
  const n = kandidater.length;
  return { antal: n, beslut, text: beslut === 'godkand' ? `${n} ${n === 1 ? 'värde är godkänt' : 'värden är godkända'} för diagnostiskt bruk och räknas nu i NEWS2 och beslutsstödet.` : `${n} ${n === 1 ? 'värde är bedömt' : 'värden är bedömda'} som referens och räknas inte i NEWS2.` };
}

// Utrustningsdelen av fliken Mätvärden: kopplingarna, utrustningen att koppla, pumparnas status och värdena som väntar på
// bedömning. synliga är mätvärdena som användaren får se.
export function patientvy(atk, synliga, nu = new Date()) {
  const db = atk.db;
  if (!finns(db)) return null;
  const kopplingar = kopplingarFor(atk);
  const vantar = attBedoma(atk, synliga);
  const kanKoppla = kanRoll(atk.personal, 'koppla_utrustning') && atk.prova('koppla_utrustning').tillaten && atk.prova('koppla_utrustning').grund !== 'nodatkomst';
  const kanGodkanna = kanRoll(atk.personal, 'godkanna_matvarde') && atk.prova('godkanna_matvarde').tillaten && atk.prova('godkanna_matvarde').grund !== 'nodatkomst';
  const pumpar = kopplingar.filter(k => k.aktiv && k.utrustning?.typ === 'pump').map(k => pumpstatus(db, db.query('SELECT * FROM mt_kopplingar WHERE id = ?').get(k.id), nu));
  return {
    kopplingar, aktiva: kopplingar.filter(k => k.aktiv), tidigare: kopplingar.filter(k => !k.aktiv).slice(0, 10),
    utrustning: kanKoppla ? utrustningFor(db, atk.personal).filter(u => !kopplingar.some(k => k.aktiv && k.utrustning?.id === u.id)) : [],
    vantar: { utrustning: vantar.filter(m => m.kalla === 'utrustning').length, patient: vantar.filter(m => m.kalla === 'patient').length },
    kanKoppla, kanGodkanna, pumpar, infusioner: kanKoppla ? pumpOrdinationer(atk) : [], demo: DEMO, format: Object.values(FORMAT).map(f => f.namn),
  };
}

// --- Egenmätning i Min journal (Sussa 3.6.1.7) ------------------------------------------------------------------------
export const EGNA_TYPER = ['blodtryck', 'puls', 'vikt', 'glukos', 'saturation', 'temp', 'pef'];
// Vårdenheten som tar emot patientens mätningar: den som vårdar patienten nu, annars vårdcentralen där patienten är listad,
// annars den senaste vårdkontakten. Patienten behöver inte veta vart mätningen ska.
export function mottagareFor(db, patientId) {
  const pag = db.query("SELECT enhet_id FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND (coalesce(planerad, 0) = 0 OR ankomst IS NOT NULL) ORDER BY (typ = 'slutenvard') DESC, start DESC LIMIT 1").get(patientId);
  if (pag) return pag.enhet_id;
  const l = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(patientId);
  if (l) return l.enhet_id;
  return db.query('SELECT enhet_id FROM vardkontakter WHERE patient_id = ? ORDER BY start DESC LIMIT 1').get(patientId)?.enhet_id ?? null;
}
// POST /api/min/journal/:id/egenmatning { typ, varde, tid? }. atk är invånarens åtkomst (patientvy.js).
export function registreraEgen(atk, body = {}, { nu = new Date(), matttyper } = {}) {
  const db = atk.db;
  if (!finns(db)) throw new Fel(400, 'Egna mätningar tas inte emot i den här sandlådan.', 'ogiltig');
  const typ = typeof body.typ === 'string' && EGNA_TYPER.includes(body.typ) ? body.typ : null;
  if (!typ) throw new Fel(400, `Välj vad du har mätt: ${EGNA_TYPER.map(t => matttyper[t].namn.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' eller $1')}.`, 'ogiltig', { falt: ['typ'] });
  const def = matttyper[typ];
  let text, num = null;
  if (typ === 'blodtryck') {
    const m = typeof body.varde === 'string' && body.varde.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!m || Number(m[1]) <= Number(m[2]) || Number(m[1]) > 300) throw new Fel(400, 'Skriv blodtrycket som övertryck/undertryck, till exempel 135/85.', 'ogiltig', { falt: ['varde'] });
    text = `${Number(m[1])}/${Number(m[2])}`;
  } else {
    num = typeof body.varde === 'string' ? Number(body.varde.replace(',', '.')) : body.varde;
    if (typeof num !== 'number' || !Number.isFinite(num) || num < def.min || num > def.max) throw new Fel(400, `${def.namn} ska vara ett tal mellan ${def.min} och ${def.max} ${MATTYPER_ENHET[typ]}.`, 'ogiltig', { falt: ['varde'] });
    text = String(num);
  }
  let tid = nu.getTime();
  if (body.tid != null && body.tid !== '') {
    tid = Date.parse(body.tid);
    if (!Number.isFinite(tid) || tid > nu.getTime() + 5 * MIN || tid < nu.getTime() - 7 * DAG) throw new Fel(400, 'Tiden ska vara när du mätte, högst sju dagar bakåt.', 'ogiltig', { falt: ['tid'] });
  }
  const enhet = mottagareFor(db, atk.patientId);
  if (!enhet) throw new Fel(400, 'Det finns ingen vårdenhet som tar emot dina mätningar ännu. Fråga din vårdenhet hur du ska lämna dem.', 'ogiltig');
  const dygn = db.query('SELECT count(*) AS n FROM egenmatningar WHERE patient_id = ? AND registrerad > ?').get(atk.patientId, new Date(nu.getTime() - DAG).toISOString()).n;
  if (dygn >= TAK.dygnEgna) throw new Fel(429, `Du kan lämna högst ${TAK.dygnEgna} mätningar per dygn här. Kontakta din vårdenhet om du behöver lämna fler.`, 'ogiltig');
  const t = new Date(tid).toISOString();
  const id = db.transaction(() => {
    const mid = Number(db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vidimerad) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'patient', NULL)")
      .run(atk.patientId, enhet, typ, text, num, MATTYPER_ENHET[typ], t).lastInsertRowid);
    db.query('INSERT INTO egenmatningar (matvarde_id, patient_id, enhet_id, invanare_id, registrerad) VALUES (?, ?, ?, ?, ?)').run(mid, atk.patientId, enhet, atk.invanare.id, nu.toISOString());
    return mid;
  })();
  atk.logga(`min:egenmatning:${id}`, { handling: 'invanare_registrera' });
  return { matvarde: egenUt(db, db.query('SELECT * FROM matvarden WHERE id = ?').get(id), matttyper), text: `Mätningen är skickad till ${enhetsnamn(db, vardenhetFor(db, enhet))}. Vården bedömer den, och tills dess räknas den inte som ett kvalitetssäkrat värde.` };
}
function egenUt(db, m, matttyper) {
  const b = db.query('SELECT beslut, tid FROM matvarde_bedomningar WHERE matvarde_id = ?').get(m.id);
  return {
    typ: m.typ, namn: matttyper[m.typ]?.namn ?? m.typ, varde: m.varde_num ?? m.varde, enhet: m.matt_enhet, tid: m.tid,
    mottagare: enhetsnamn(db, vardenhetFor(db, m.enhet_id)),
    status: !b ? 'Inte bedömd ännu' : b.beslut === 'godkand' ? 'Bedömd och godkänd av vården' : 'Bedömd av vården, används som referens',
    bedomd: Boolean(b),
  };
}
// GET /api/min/journal/:id/egenmatning: patientens egna mätningar med status, och vad som går att mäta.
export function minaMatningar(atk, matttyper) {
  const db = atk.db;
  if (!finns(db)) return { matningar: [], typer: [] };
  const rader = db.query("SELECT * FROM matvarden WHERE patient_id = ? AND kalla = 'patient' ORDER BY tid DESC, id DESC LIMIT 100").all(atk.patientId);
  const mottagare = mottagareFor(db, atk.patientId);
  return {
    matningar: rader.map(m => egenUt(db, m, matttyper)), typer: EGNA_TYPER.map(t => ({ typ: t, namn: matttyper[t].namn, enhet: MATTYPER_ENHET[t] })),
    mottagare: mottagare ? enhetsnamn(db, vardenhetFor(db, mottagare)) : null, egen: atk.relation === 'egen',
    text: 'Dina egna mätningar skickas till vårdenheten som vårdar dig. De visas för vården skilda från vårdens egna mätningar och räknas inte i bedömningar förrän vården har bedömt dem.',
  };
}

// --- Den simulerade utrustningen ------------------------------------------------------------------------------------
// Ett lugnt deterministiskt brus kring ett grundvärde, så att samma koppling och tid alltid ger samma värde.
const brus = (k, i, skala) => Math.round((Math.sin(k * 7.13 + i * 0.37) + Math.sin(k * 3.1 + i * 1.71) * 0.5) * skala * 10) / 10;
function grundvarden(db, patientId) {
  const sist = (typ) => db.query("SELECT varde, varde_num FROM matvarden WHERE patient_id = ? AND typ = ? AND kalla <> 'utrustning' ORDER BY tid DESC LIMIT 1").get(patientId, typ);
  const bt = String(sist('blodtryck')?.varde ?? '125/75').split('/').map(Number);
  return { puls: sist('puls')?.varde_num ?? 78, saturation: Math.min(99, sist('saturation')?.varde_num ?? 96), andningsfrekvens: sist('andningsfrekvens')?.varde_num ?? 16, temp: sist('temp')?.varde_num ?? 37.0, sys: bt[0] || 125, dia: bt[1] || 75 };
}
// En FHIR Bundle från den simulerade monitorn vid tiden t, i samma format som en riktig utrustning skickar.
export function simuleradMonitor(db, u, k, t) {
  const g = grundvarden(db, k.patient_id);
  const i = Math.floor(Date.parse(t) / (MONITOR_MIN * MIN));
  const q = (value, code) => ({ value, unit: code, system: SYS_UCUM, code });
  const obs = (kod, v) => ({ resourceType: 'Observation', status: 'final', code: { coding: [{ system: SYS_MDC, code: kod }] }, effectiveDateTime: t, device: { reference: `Device/${u.id}` }, ...v });
  const sys = Math.round(g.sys + brus(k.id, i, 6));
  const dia = Math.round(g.dia + brus(k.id + 1, i, 4));
  return {
    resourceType: 'Bundle', type: 'collection', entry: [
      { resource: { resourceType: 'Device', id: u.id, identifier: [{ system: SYS_UTRUSTNING, value: u.id }], serialNumber: u.serienummer } },
      { resource: obs('147842', { valueQuantity: q(Math.round(g.puls + brus(k.id, i, 5)), '/min') }) },
      { resource: obs('150456', { valueQuantity: q(Math.min(100, Math.round(g.saturation + brus(k.id + 2, i, 1.2))), '%') }) },
      { resource: obs('151562', { valueQuantity: q(Math.max(6, Math.round(g.andningsfrekvens + brus(k.id + 3, i, 2))), '/min') }) },
      { resource: obs('150364', { valueQuantity: q(Math.round((g.temp + brus(k.id + 4, i, 0.2)) * 10) / 10, 'Cel') }) },
      { resource: obs('150020', { component: [
        { code: { coding: [{ system: SYS_MDC, code: '150021' }] }, valueQuantity: q(Math.max(sys, dia + 10), 'mm[Hg]') },
        { code: { coding: [{ system: SYS_MDC, code: '150022' }] }, valueQuantity: q(dia, 'mm[Hg]') }] }) },
    ],
  };
}
// Pumpens hastighet för en ordination: ur den aktuella dosen för en IVA-infusion, annars ur spädningens volym och tid.
export function pumpHastighet(db, o, inf) {
  if (inf?.iva) {
    const d = db.query('SELECT dos FROM iva_titreringar WHERE ordination_id = ? ORDER BY tid DESC, id DESC LIMIT 1').get(o.id)?.dos ?? inf.iva.startdos;
    return inf.iva.vikt_kg && inf.koncentration ? Math.round(d * inf.iva.vikt_kg / inf.koncentration * 10) / 10 : null;
  }
  if (inf?.volymMl && inf.tidMin) return Math.round(inf.volymMl / inf.tidMin * 60 * 10) / 10;
  return null;
}
export function simuleradPump(db, u, k, fran, till) {
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(k.ordination_id);
  if (!o || o.status !== 'aktiv') return null;
  const h = pumpHastighet(db, o, infusionFor(db, o.id));
  if (h == null) return null;
  return {
    resourceType: 'Bundle', type: 'collection', entry: [
      { resource: { resourceType: 'Device', id: u.id, identifier: [{ system: SYS_UTRUSTNING, value: u.id }] } },
      { resource: { resourceType: 'MedicationAdministration', status: 'in-progress', request: { reference: `MedicationRequest/${o.id}` }, subject: { reference: `Patient/${k.patient_id}` },
        effectivePeriod: { start: fran, end: till }, dosage: { rateQuantity: { value: h, unit: 'mL/h', system: SYS_UCUM, code: 'mL/h' } } } },
    ],
  };
}
// Den simulerade utrustningen skickar det som har hunnit mätas sedan förra gången, högst tre timmar bakåt. Anropas vid
// varje anrop till sandlådan, som det simulerade laboratoriet.
export function efterTid(db, matttyper, nu = new Date()) {
  if (!finns(db)) return 0;
  const t = nu.toISOString();
  let n = 0;
  for (const k of db.query('SELECT k.* FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE u.simulerad = 1 AND u.aktiv = 1 AND k.slut IS NULL AND k.start <= ?').all(t)) {
    const u = utrustningRad(db, k.utrustning_id);
    const steg = (u.typ === 'monitor' ? MONITOR_MIN : PUMP_MIN) * MIN;
    const sista = db.query("SELECT max(tid) AS t FROM mt_meddelanden WHERE koppling_id = ? AND simulerat = 1 AND status = 'mottaget'").get(k.id)?.t;
    let fran = Math.max(Date.parse(sista ?? k.start), nu.getTime() - SIMULERA_BAKAT_MS);
    // Det första värdet kommer direkt när utrustningen kopplas, sedan ett per intervall.
    let nasta = sista ? Math.floor(fran / steg) * steg + steg : Date.parse(k.start);
    while (nasta <= nu.getTime()) {
      const tid = new Date(nasta).toISOString();
      const kropp = u.typ === 'monitor' ? simuleradMonitor(db, u, k, tid) : simuleradPump(db, u, k, new Date(Math.max(Date.parse(k.start), nasta - steg)).toISOString(), tid);
      if (!kropp) break;
      taEmot(db, u, { format: 'fhir', kropp }, { nu: new Date(nasta), simulerat: true, matttyper });
      n++;
      fran = nasta;
      nasta += steg;
    }
  }
  return n;
}
