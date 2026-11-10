// Barnhälsovård (Sussa 4.1, avtalets tillägg 2020 om patientflöde för barnhälsovård, runda 7, r6): tillväxtkurvor,
// larm vid avvikande tillväxt, barnhälsovårdens besöks- och vaccinationsprogram med bokning i tidboken, vaccinationer,
// föräldrarnas mätningar hemma och vad Min journal visar för vårdnadshavaren.
//
// Behörighet: allt prövas i behörighetsmotorn. Tillväxten läses med las_matvarden och registreras med
// registrera_matvarde, och raderna filtreras på vårdenhet (inre sekretess, aktivt val och spärr), så att kurvor, larm
// och förslag bara bygger på det användaren får se. Vaccinationer läses med las_oversikt och registreras med vaccinera.
// Besöken bokas med boka_bhv av läkare och sjuksköterskor på den vårdenhet där barnet är inskrivet i barnhälsovården.
// Runda 10, r5: rapporteringen till det simulerade vaccinationsregistret.
import { rapportera as rapporteraVaccination } from './vaccinationsregister.js';
import { Fel, iso, datumAv, addDagar, lokalTid } from './db.js';
import { Atkomst, ROLLER, HANDLINGAR, kanRoll, vardenhetFor, enheterUnder, harVardrelation, alder } from './atkomst.js';
import * as journal from './journal.js';
import * as T from './tillvaxt.js';
import * as P from './bhv-program.js';
import * as tidbok from './tidbok.js';
import { ATC, K11 } from './kodverk.js';

// Behörigheter (runda 7, r6). Läkare och sjuksköterskor vaccinerar enligt programmet och bokar barnets hälsobesök.
Object.assign(HANDLINGAR, { vaccinera: 'registrera vaccinationer', boka_bhv: 'boka hälsobesök i barnhälsovården', rapportera_bhvq: 'rapportera till Svenska barnhälsovårdsregistret' });
for (const r of ['lakare', 'sjukskoterska']) ROLLER[r].push('vaccinera', 'boka_bhv', 'rapportera_bhvq');

const DAG = 86400_000;
export const BVC = 'vc-tybble-bvc';
export const BVC_SSK = 'ssk-bvc';
export const BVC_SCHEMA = 'sch-bvc-maja';
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };

// ---------------------------------------------------------------------------------------------------------------
// Schema

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bhv_inskrivning (
  patient_id TEXT PRIMARY KEY, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, bhvq_motsatt INTEGER NOT NULL DEFAULT 0, bhvq_motsatt_tid TEXT
);
CREATE TABLE IF NOT EXISTS tillvaxt_uppgifter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, varde REAL NOT NULL, tid TEXT NOT NULL,
  registrerad_av TEXT, registrerad TEXT NOT NULL,
  CHECK (typ IN ('graviditetslangd', 'fodelsevikt', 'fodelselangd', 'fodelse_huvudomfang', 'langd_mor', 'langd_far', 'tb_risk'))
);
CREATE TRIGGER IF NOT EXISTS tillvaxt_uppgift_andras_ej BEFORE UPDATE OF typ, varde, tid, registrerad_av ON tillvaxt_uppgifter
  BEGIN SELECT RAISE(ABORT, 'En tillväxtuppgift ändras inte. Registrera en ny.'); END;
CREATE TRIGGER IF NOT EXISTS tillvaxt_uppgift_raderas_ej BEFORE DELETE ON tillvaxt_uppgifter BEGIN SELECT RAISE(ABORT, 'En tillväxtuppgift raderas inte'); END;
CREATE TABLE IF NOT EXISTS tillvaxt_handelser (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, text TEXT NOT NULL, registrerad_av TEXT, registrerad TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS tillvaxt_handelse_andras_ej BEFORE UPDATE OF tid, text, registrerad_av ON tillvaxt_handelser
  BEGIN SELECT RAISE(ABORT, 'En händelse på tillväxtkurvan ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS tillvaxt_handelse_raderas_ej BEFORE DELETE ON tillvaxt_handelser BEGIN SELECT RAISE(ABORT, 'En händelse på tillväxtkurvan raderas inte'); END;
CREATE TABLE IF NOT EXISTS hemmatningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, invanare_id TEXT NOT NULL, typ TEXT NOT NULL, varde REAL NOT NULL,
  tid TEXT NOT NULL, skapad TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vantar', hanterad_av TEXT, hanterad_tid TEXT, matvarde_id INTEGER, orsak TEXT,
  CHECK (status IN ('vantar', 'bekraftad', 'avvisad')), CHECK (typ IN ('vikt', 'langd', 'huvudomfang'))
);
CREATE TRIGGER IF NOT EXISTS hemmatning_raderas_ej BEFORE DELETE ON hemmatningar BEGIN SELECT RAISE(ABORT, 'En hemmätning raderas inte'); END;
CREATE TABLE IF NOT EXISTS bhv_besok (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, besok_id TEXT NOT NULL, status TEXT NOT NULL,
  bokning_id INTEGER, vardkontakt_id INTEGER, tid TEXT NOT NULL, registrerad_av TEXT, CHECK (status IN ('bokat', 'genomfort'))
);
CREATE TABLE IF NOT EXISTS vaccinationer (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, vaccin_id TEXT NOT NULL, atc TEXT NOT NULL,
  dos INTEGER NOT NULL, tid TEXT NOT NULL, givet_av TEXT, batch TEXT, registrerad TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TRIGGER IF NOT EXISTS vaccination_andras_ej BEFORE UPDATE OF vaccin_id, atc, dos, tid, givet_av, batch ON vaccinationer
  BEGIN SELECT RAISE(ABORT, 'En registrerad vaccination ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vaccination_raderas_ej BEFORE DELETE ON vaccinationer BEGIN SELECT RAISE(ABORT, 'En registrerad vaccination raderas inte'); END;
CREATE TABLE IF NOT EXISTS bhv_uppdrag (
  personal_id TEXT PRIMARY KEY, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, till TEXT, text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bhvq_utskick (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, enhet_id TEXT NOT NULL, av TEXT NOT NULL, antal_barn INTEGER NOT NULL, antal_observationer INTEGER NOT NULL,
  undantagna INTEGER NOT NULL, kvittens TEXT NOT NULL, innehall TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS bhvq_utskick_andras_ej BEFORE UPDATE ON bhvq_utskick BEGIN SELECT RAISE(ABORT, 'Ett utskick ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS bhvq_utskick_raderas_ej BEFORE DELETE ON bhvq_utskick BEGIN SELECT RAISE(ABORT, 'Ett utskick raderas inte'); END;
`;
export function sakraSchema(db) { db.exec(SCHEMA); }

// ---------------------------------------------------------------------------------------------------------------
// Seed: Barnavårdscentralen Tybble, BHV-sjuksköterskan och ett barn med hela programmet fram till i dag. Allt påhittat.

export const BARN = {
  id: 'p61', pnr: '202505062386', fornamn: 'Ida', efternamn: 'Holmqvist', kon: 'kvinna', fodd: '2025-05-06',
  adress: 'Tybblegatan 9', postnr: '702 31', ort: 'Örebro', telefon: '070-174 06 61', kontaktperson: 'Vårdnadshavare Linnea och Anton Holmqvist, 070-174 06 61',
};
export const FORALDRAR = [
  { id: 'inv-vh02', pnr: '199204082383', fornamn: 'Linnea', efternamn: 'Holmqvist' },
  { id: 'inv-vh03', pnr: '199204082391', fornamn: 'Anton', efternamn: 'Holmqvist' },
];
// z-värdet barnets mätningar ligger på per besök i seeden. Vikten faller vid 12 månader, så att larmet om korsade kurvor
// syns i demon.
const SEED_Z = { vikt: { def: 0.3, '12m': -0.85, '18m': -0.9, '30m': -0.8, '4a': -0.7, '5a': -0.7 }, langd: { def: 0.5 }, huvudomfang: { def: 0.2 } };
const FODSEL = { graviditetslangd: 39, fodelsevikt: 3.42, fodelselangd: 50.0, fodelse_huvudomfang: 34.5, langd_mor: 166, langd_far: 181 };

// Anteckningarna från besöken i seeden. Påhittade.
const ANTECKNINGAR = {
  '1v': { typ: 'Omvårdnadsanteckning', sokord: { 'Psykosocialt': 'Hembesök efter hemgången från förlossningen. Båda föräldrarna är hemma.', 'Nutrition': 'Helammad, äter var tredje timme.', 'Planering': 'Besök på BVC om en vecka. Föräldragrupp erbjuds.' } },
  '4v': { typ: 'Mottagningsanteckning', sokord: { 'Kontaktorsak': 'Teambesök vid fyra veckor.', 'Status': 'Pigg och välmående. Hjärta och lungor utan anmärkning. Höfter stabila. Röda reflexer bilateralt.', 'Bedömning': 'Frisk flicka som växer fint.' } },
  '8m': { typ: 'Omvårdnadsanteckning', sokord: { 'Psykosocialt': 'Hembesök vid åtta månader.', 'Aktivitet': 'Kryper och drar sig upp. Jollrar.', 'Planering': 'Nästa besök vid tio månader.' } },
  '12m': { typ: 'Mottagningsanteckning', sokord: { 'Kontaktorsak': 'Teambesök vid tolv månader.', 'Status': 'Opåverkad. Går med stöd. Vikten har sjunkit sedan förra besöket efter en veckas magsjuka.', 'Bedömning': 'Frisk. Vikten följs upp vid nästa besök.' } },
};
const avrunda = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
export function seedVarde(matt, besokId, manader) {
  const z = SEED_Z[matt][besokId] ?? SEED_Z[matt].def;
  return avrunda(T.vardeVidZ(T.lms(matt, BARN.kon, manader), z), matt === 'vikt' ? 3 : 1);
}

export function seeda(db, { bas = new Date() } = {}) {
  sakraSchema(db);
  if (db.query('SELECT 1 FROM patienter WHERE id = ?').get(BARN.id)) return;
  db.query('INSERT OR IGNORE INTO enheter (id, hsa_id, namn, kortnamn, typ, forald_id) VALUES (?, ?, ?, ?, ?, ?)').run(BVC, 'SE2321000164-VK0411', 'Barnavårdscentralen Tybble', 'BVC Tybble', 'arbetsplats', 'vc-tybble');
  db.query('INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, 0, 1)')
    .run(BVC_SSK, 'Maja Lindholm', 'sjukskoterska', 'Sjuksköterska (BHV-sjuksköterska)', BVC, 'SE2321000164-VKP410');
  seedaSchema(db, bas);
  seedaUppdrag(db, bas);
  const b = BARN;
  db.query(`INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, adress, postnr, ort, telefon, kontaktperson, skyddad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(b.id, b.pnr, b.fornamn, b.efternamn, b.kon, b.fodd, b.adress, b.postnr, b.ort, b.telefon, b.kontaktperson);
  db.query('INSERT INTO listningar VALUES (?, ?, ?)').run(b.id, 'vc-tybble', addDagar(b.fodd, 5));
  if (db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'identiteter'").get()) {
    db.query("INSERT INTO identiteter (patient_id, typ, varde, status, fran, ursprung) VALUES (?, 'personnummer', ?, 'gallande', ?, ?)").run(b.id, b.pnr, lokalTid(b.fodd, '04:20'), b.id);
  }
  db.query('INSERT INTO bhv_inskrivning (patient_id, enhet_id, fran) VALUES (?, ?, ?)').run(b.id, 'vc-tybble', addDagar(b.fodd, 5));
  seedaInvanare(db);
  const fodselTid = lokalTid(b.fodd, '04:20');
  const insU = db.query('INSERT INTO tillvaxt_uppgifter (patient_id, enhet_id, typ, varde, tid, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const forsta = lokalTid(addDagar(b.fodd, 7), '10:00');
  for (const [typ, v] of Object.entries(FODSEL)) insU.run(b.id, 'vc-tybble', typ, v, ['langd_mor', 'langd_far'].includes(typ) ? forsta : fodselTid, BVC_SSK, forsta);
  insU.run(b.id, 'vc-tybble', 'tb_risk', 0, forsta, BVC_SSK, forsta);
  const alderNu = P.alderDagar(b.fodd, bas.getTime());
  const insVk = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, skapad, skapad_av, automatisk, ger_vardrelation)
    VALUES (?, ?, 'oppenvard', ?, ?, ?, ?, ?, 'vardkallan', 0, ?, ?, 0, 1)`);
  const insMv = db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, vardkontakt_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insB = db.query('INSERT INTO bhv_besok (patient_id, enhet_id, besok_id, status, vardkontakt_id, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insV = db.query('INSERT INTO vaccinationer (patient_id, enhet_id, vardkontakt_id, vaccin_id, atc, dos, tid, givet_av, batch, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  let batch = 4100;
  for (const besok of P.BESOK) {
    // Besöken som har passerat är gjorda. Det besök som pågår nu, i dess tidsfönster, är kvar att boka.
    if (!(besok.fonster[1] < alderNu || besok.alder < alderNu - 30)) continue;
    const datum = addDagar(b.fodd, besok.alder);
    const start = lokalTid(datum, '09:30');
    const av = besok.team ? 'lak-vc' : BVC_SSK;
    const enhet = besok.team ? 'vc-tybble' : BVC;
    const vk = Number(insVk.run(b.id, enhet, besok.hem ? 'hembesok' : 'besok', start, new Date(Date.parse(start) + 30 * 60_000).toISOString(), besok.hem ? 'Hemma hos familjen' : 'Barnavårdscentralen', besok.text, start, av).lastInsertRowid);
    const manader = T.alderManader(b.fodd, start);
    for (const matt of besok.matt) {
      const mt = new Date(Date.parse(start) + 5 * 60_000).toISOString();
      const v = seedVarde(matt, besok.id, manader);
      insMv.run(b.id, enhet, matt === 'huvudomfang' ? 'huvudomfang' : matt, String(v), v, matt === 'vikt' ? 'kg' : 'cm', mt, av, vk);
    }
    insB.run(b.id, 'vc-tybble', besok.id, 'genomfort', vk, start, av);
    const ant = ANTECKNINGAR[besok.id];
    if (ant) {
      const t = new Date(Date.parse(start) + 25 * 60_000).toISOString();
      const sok = JSON.stringify(Object.entries(ant.sokord).map(([sokord, text]) => ({ sokord, text })));
      db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'signerad', ?, ?, 1, 'vardkallan')`).run(b.id, enhet, vk, ant.typ, ant.typ === 'Omvårdnadsanteckning' ? 'omvardnad' : 'lakare', sok, av, t, new Date(Date.parse(t) + 300_000).toISOString(), av);
    }
    if (besok.team) db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, 'Z00.1', ?, 'huvud', ?, 'vardkallan')")
      .run(b.id, enhet, vk, 'Rutinmässig hälsoundersökning av barn utan besvär eller utan att diagnos registrerats', datum);
    for (const vid of besok.vacciner) {
      const v = P.vaccinRad(vid);
      const t = new Date(Date.parse(start) + 20 * 60_000).toISOString();
      insV.run(b.id, enhet, vk, vid, v.atc, v.dos, t, BVC_SSK, `DEMO-${++batch}`, t);
    }
  }
  // En mätning som mamman har gjort hemma och som väntar på att BHV-sjuksköterskan bekräftar den.
  const hemma = new Date(bas.getTime() - 3 * DAG);
  db.query('INSERT INTO hemmatningar (patient_id, enhet_id, invanare_id, typ, varde, tid, skapad) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(b.id, 'vc-tybble', FORALDRAR[0].id, 'vikt', seedVarde('vikt', '18m', T.alderManader(b.fodd, hemma.toISOString())), hemma.toISOString(), hemma.toISOString());
  db.query('INSERT INTO tillvaxt_handelser (patient_id, enhet_id, tid, text, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?)')
    .run(b.id, 'vc-tybble', lokalTid(addDagar(b.fodd, 340), '12:00'), 'Magsjuk en vecka, åt dåligt', BVC_SSK, lokalTid(addDagar(b.fodd, 365), '10:00'));
}

// Uppdragen på barnavårdscentralen: BHV-sjuksköterskan och distriktssköterskan på vårdcentralen, som arbetar på
// barnavårdscentralen en del av veckan. En sjuksköterska utan uppdrag gör inte hälsobesöken och vaccinationerna.
export const UPPDRAG = [
  { personal: BVC_SSK, text: 'BHV-sjuksköterska' },
  { personal: 'ssk-vc', text: 'Distriktssköterska med uppdrag i barnhälsovården' },
];
function seedaUppdrag(db, bas = new Date()) {
  for (const u of UPPDRAG) {
    if (!db.query('SELECT 1 FROM personal WHERE id = ?').get(u.personal)) continue;
    db.query('INSERT OR IGNORE INTO bhv_uppdrag (personal_id, enhet_id, fran, till, text) VALUES (?, ?, ?, NULL, ?)').run(u.personal, BVC, addDagar(datumAv(bas), -365), u.text);
  }
}

// Barnet och vårdnadshavarna i Min journal. Barnet kan inte logga in självt.
function seedaInvanare(db) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'invanare'").get()) return;
  const b = BARN;
  const insI = db.query('INSERT OR IGNORE INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES (?, ?, ?, ?, ?, ?)');
  insI.run(`inv-${b.id}`, b.pnr, b.fornamn, b.efternamn, b.fodd, b.id);
  for (const f of FORALDRAR) {
    insI.run(f.id, f.pnr, f.fornamn, f.efternamn, `${f.pnr.slice(0, 4)}-${f.pnr.slice(4, 6)}-${f.pnr.slice(6, 8)}`, null);
    db.query('INSERT OR IGNORE INTO vardnadshavare VALUES (?, ?)').run(f.id, b.id);
  }
}

// BHV-sjuksköterskans schema i tidboken: återbesök på Barnavårdscentralen, samma antal dagar framåt som tidboken.
const BVC_DAG = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '13:00', '13:30', '14:00', '14:30'];
function seedaSchema(db, bas) {
  if (db.query('SELECT 1 FROM scheman WHERE id = ?').get(BVC_SCHEMA)) return;
  db.query('INSERT INTO scheman VALUES (?, ?, ?, ?)').run(BVC_SCHEMA, BVC, BVC_SSK, 'sjukskoterska');
  const ins = db.query('INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, ?, 1, NULL, 0)');
  const basDatum = datumAv(bas);
  for (let d = 1; d <= 75; d++) {
    const datum = addDagar(basDatum, d);
    const vd = new Date(`${datum}T12:00:00Z`).getUTCDay();
    if (vd === 0 || vd === 6) continue;
    for (const k of BVC_DAG) {
      const start = lokalTid(datum, k);
      ins.run(BVC_SCHEMA, start, new Date(Date.parse(start) + 30 * 60_000).toISOString(), 'aterbesok');
    }
  }
}

// En sandlåda från före barnhälsovården får tabellerna och seeden, relativt till i dag.
export function sakra(db) {
  sakraSchema(db);
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(BARN.id)) seeda(db, { bas: new Date() });
  else seedaInvanare(db);
  seedaUppdrag(db);
}

// ---------------------------------------------------------------------------------------------------------------
// Inskrivning och vårdenhet

export const inskrivning = (db, pid) => db.query('SELECT * FROM bhv_inskrivning WHERE patient_id = ?').get(pid) ?? null;
// Har personalens vårdenhet barnhälsovård? Används för menyn och för listorna.
export const harBhv = (db, personal) => Boolean(personal && db.query('SELECT 1 FROM bhv_inskrivning WHERE enhet_id = ? LIMIT 1').get(vardenhetFor(db, personal.enhet_id)));
// Sjuksköterskans gällande uppdrag på en barnavårdscentral, eller null.
export function uppdrag(db, personal, dag = datumAv(new Date())) {
  const u = personal && db.query('SELECT * FROM bhv_uppdrag WHERE personal_id = ?').get(personal.id);
  if (!u || u.fran > dag || (u.till && u.till < dag)) return null;
  return { enhet: u.enhet_id, text: u.text, fran: u.fran, till: u.till };
}
// Läkarna på vårdcentralen är BVC-läkare. En sjuksköterska arbetar i barnhälsovården med ett uppdrag på
// barnavårdscentralen.
export const arbetarIBhv = (db, personal) => personal?.yrke === 'lakare' || Boolean(uppdrag(db, personal));
export function session(db, personal) {
  if (!personal || !['lakare', 'sjukskoterska'].includes(personal.yrke) || !harBhv(db, personal) || !arbetarIBhv(db, personal)) return null;
  return { enhet: vardenhetFor(db, personal.enhet_id), uppdrag: personal.yrke === 'sjukskoterska' };
}

// Barnet ska vara inskrivet i barnhälsovården på användarens vårdenhet för att besök ska kunna bokas och vacciner ges
// enligt programmet. Annars förklarar systemet varför.
function kravUppdrag(atk, handling) {
  if (arbetarIBhv(atk.db, atk.personal)) return;
  atk.logga(handling, 'nekad', `bhv:${handling}`, 'nekad');
  throw new Fel(403, 'Du har inget uppdrag på barnavårdscentralen. Hälsobesöken och vaccinationerna enligt programmet görs av sjuksköterskor med uppdrag där.', 'nekad');
}
function kravInskriven(atk, handling) {
  kravUppdrag(atk, handling);
  const ins = inskrivning(atk.db, atk.patientId);
  if (!ins || ins.enhet_id !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga(handling, 'nekad', `bhv:${handling}`, 'nekad');
    throw new Fel(403, ins ? 'Barnet är inskrivet i barnhälsovården på en annan vårdenhet. Den vårdenheten bokar besöken och ger vaccinationerna.' : 'Barnet är inte inskrivet i barnhälsovården. Hälsobesöken och vaccinationerna enligt programmet görs av den barnavårdscentral där barnet är inskrivet.', 'nekad');
  }
  return ins;
}

// ---------------------------------------------------------------------------------------------------------------
// Tillväxten: kurvor, analys och larm, byggt av de rader användaren får se

const UPPGIFTER = { graviditetslangd: 'Graviditetslängd', fodelsevikt: 'Födelsevikt', fodelselangd: 'Födelselängd', fodelse_huvudomfang: 'Huvudomfång vid födelsen', langd_mor: 'Längd, biologisk mor', langd_far: 'Längd, biologisk far', tb_risk: 'Ökad risk för tuberkulos' };
export const UPPGIFT_GRANSER = { graviditetslangd: [22, 44], fodelsevikt: [0.3, 6.5], fodelselangd: [25, 62], fodelse_huvudomfang: [18, 42], langd_mor: [120, 220], langd_far: [120, 220], tb_risk: [0, 1] };

// Den senaste uppgiften per typ bland de rader användaren får se.
function uppgifter(rader) {
  const ut = {};
  for (const r of [...rader].sort((a, b) => a.registrerad.localeCompare(b.registrerad) || a.id - b.id)) ut[r.typ] = r;
  return ut;
}

const mattAvTyp = (typ) => (typ === 'huvudomfang' ? 'huvudomfang' : typ);
// Kurvorna för barnet ur mätvärdesraderna, födelseuppgifterna och hemmätningarna som väntar.
export function bygg(db, p, { matvarden = [], upp = {}, hemma = [], handelser = [], nu = Date.now(), fran = null, till = null, referens = 'auto' }) {
  const gv = upp.graviditetslangd?.varde ?? null;
  const fodelseTid = upp.fodelsevikt?.tid ?? upp.fodelselangd?.tid ?? null;
  const punkter = { vikt: [], langd: [], huvudomfang: [], sitthojd: [] };
  const fodsel = { vikt: upp.fodelsevikt, langd: upp.fodelselangd, huvudomfang: upp.fodelse_huvudomfang };
  for (const [m, r] of Object.entries(fodsel)) if (r) punkter[m].push({ id: `fodsel-${m}`, tid: r.tid, varde: r.varde, kalla: 'fodsel', vardenhet: enhetsnamn(db, r.enhet_id) });
  for (const r of matvarden) {
    if (!['vikt', 'langd', 'huvudomfang', 'sitthojd'].includes(r.typ)) continue;
    const v = r.varde_num ?? Number(r.varde);
    if (!Number.isFinite(v)) continue;
    punkter[mattAvTyp(r.typ)].push({ id: r.id, tid: r.tid, varde: v, kalla: r.kalla === 'hemmatning' ? 'hemma' : 'vard', vardenhet: enhetsnamn(db, r.enhet_id), registreradAv: personKort(db, r.registrerad_av)?.namn ?? null });
  }
  for (const h of hemma) punkter[h.typ].push({ id: `hemma-${h.id}`, tid: h.tid, varde: h.varde, kalla: 'hemma', vantar: true });
  punkter.bmi = T.bmiPunkter(punkter.vikt.filter(x => !x.vantar), punkter.langd.filter(x => !x.vantar));
  const kurvor = {};
  // Runda 11, r7: referensen väljs av systemet efter åldern (auto) eller av användaren.
  const ref = T.referensFor(referens);
  for (const m of Object.keys(T.MATT)) kurvor[m] = T.berika(m, p.kon, p.fodd, gv, punkter[m] ?? [], ref.id);
  const alderNu = T.alderManader(p.fodd, nu);
  // Referensen som gäller vid barnets ålder när systemet väljer själv.
  const effektiv = ref.id === 'auto' ? (alderNu <= T.MAX_MANADER ? T.REFERENSER.who2006 : T.REFERENSER.who2007) : ref;
  // Sitthöjd mäts hos större barn: kurvan visas från två års ålder eller när det finns värden.
  const visas = (m) => m !== 'sitthojd' || alderNu >= 24 || kurvor.sitthojd.length > 0;
  const refTill = Math.min(ref.till, T.MAX_REFERENS);
  const korrigerad = T.korrigeradAlder(alderNu, gv);
  const mal = T.malangd(upp.langd_mor?.varde, upp.langd_far?.varde, p.kon);
  return {
    barn: { alderManader: Math.round(alderNu * 100) / 100, alderText: T.alderText(alderNu), korrigerad: korrigerad !== alderNu ? { alderManader: Math.round(korrigerad * 100) / 100, text: `Korrigerad ålder ${T.alderText(korrigerad)}, eftersom barnet föddes i vecka ${gv}. Kurvorna räknas med den till två års ålder.` } : null,
      kon: p.kon, inomReferens: alderNu >= ref.fran - 1 && alderNu <= refTill },
    referens: { ...T.REFERENS, id: effektiv.id, vald: ref.id, namn: effektiv.namn, text: effektiv.id === 'who2006' && ref.id !== 'auto' ? T.REFERENS.text : `${ref.text} ${T.REFERENS.text.split('. ').slice(1).join('. ')}`, kalla: ref.kalla, licens: ref.licens },
    referenser: Object.values(T.REFERENSER).map(r => ({ id: r.id, namn: r.namn, fran: r.fran, till: r.till, text: r.text })), ejTillgangliga: T.EJ_TILLGANGLIGA,
    kurvor: Object.entries(T.MATT).filter(([m]) => visas(m)).map(([m, d]) => ({
      matt: m, namn: d.namn, enhet: d.enhet, harledd: Boolean(d.harledd), punkter: kurvor[m],
      linjer: d.utanReferens || !ref.matt.includes(m) ? T.SD_LINJER.map(sd => ({ sd, punkter: [] })) : T.referenslinjer(m, p.kon, ref.id === 'who2007' ? 61 : 0, Math.min(refTill, Math.max(12, Math.ceil(alderNu + 3))), ref.id), utanReferens: Boolean(d.utanReferens) || !ref.matt.includes(m),
      senaste: kurvor[m].filter(x => !x.vantar).at(-1) ?? null,
    })),
    fodsel: { graviditetslangd: gv, tid: fodelseTid, vikt: upp.fodelsevikt?.varde ?? null, langd: upp.fodelselangd?.varde ?? null, huvudomfang: upp.fodelse_huvudomfang?.varde ?? null },
    foraldrar: { mor: upp.langd_mor?.varde ?? null, far: upp.langd_far?.varde ?? null, malangd: mal },
    analys: T.analys(kurvor, { fran, till }), period: { fran, till },
    larm: alderNu <= refTill ? T.larm(kurvor, { fodelsevikt: upp.fodelsevikt?.varde ?? null }) : [],
    handelser: handelser.map(h => ({ id: h.id, tid: h.tid, text: h.text, alder: Math.round(T.alderManader(p.fodd, h.tid) * 100) / 100 })),
    demoregel: T.DEMOREGEL,
  };
}

const synliga = (atk, tabell, handling = 'las_matvarden') => atk.filtrera(atk.db.query(`SELECT * FROM ${tabell} WHERE patient_id = ? ORDER BY id`).all(atk.patientId), handling);
const datumParam = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// GET /api/patient/:id/tillvaxt. fran och till väljer perioden för analysen.
export function vy(atk, p, { fran = null, till = null, nu = Date.now(), referens = 'auto' } = {}) {
  atk.krav('las_matvarden');
  const db = atk.db;
  const rader = journal.synligaMatvarden(atk);
  const upp = uppgifter(synliga(atk, 'tillvaxt_uppgifter'));
  const hemma = db.query("SELECT * FROM hemmatningar WHERE patient_id = ? AND status = 'vantar' ORDER BY tid").all(p.id).filter(h => atk.prova('las_matvarden', { enhet_id: h.enhet_id }).tillaten);
  const handelser = synliga(atk, 'tillvaxt_handelser');
  const ut = bygg(db, p, { matvarden: rader, upp, hemma, handelser, nu, fran: datumParam(fran), till: datumParam(till), referens });
  ut.hemmatningar = hemma.map(h => hemmatningUt(db, h));
  const iBhv = arbetarIBhv(db, atk.personal);
  ut.kan = { registrera: kanRoll(atk.personal, 'registrera_matvarde'), vaccinera: kanRoll(atk.personal, 'vaccinera') && iBhv, boka: kanRoll(atk.personal, 'boka_bhv') && iBhv };
  ut.bhv = bhvDel(atk, p, nu);
  ut.uppgiftstyper = UPPGIFTER;
  ut.dolda = { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr };
  atk.logga('las_matvarden', atk.grund(), `tillvaxt:${p.id}`);
  return ut;
}

const hemmatningUt = (db, h) => ({ id: h.id, typ: h.typ, namn: T.MATT[h.typ].namn, varde: h.varde, enhet: T.MATT[h.typ].enhet, tid: h.tid, skapad: h.skapad, status: h.status,
  av: (() => { const i = db.query('SELECT fornamn, efternamn FROM invanare WHERE id = ?').get(h.invanare_id); return i ? `${i.fornamn} ${i.efternamn}, vårdnadshavare` : 'Vårdnadshavare'; })(), orsak: h.orsak ?? null });

// Programmet för barnet, för den som får se vaccinationerna och besöken. Bara den egna inskrivningens vårdenhet visar
// förslagen att boka och ge.
function bhvDel(atk, p, nu) {
  const db = atk.db;
  const ins = inskrivning(db, p.id);
  if (!ins || !kanRoll(atk.personal, 'las_oversikt')) return { inskriven: Boolean(ins) && kanRoll(atk.personal, 'las_oversikt'), program: null };
  const egen = ins.enhet_id === vardenhetFor(db, atk.personal.enhet_id);
  const a = new Atkomst(db, atk.personal, p.id, atk.val, 'las_oversikt');
  const allaVacc = db.query('SELECT * FROM vaccinationer WHERE patient_id = ? ORDER BY tid').all(p.id);
  const vacc = a.filtrera(allaVacc, 'las_oversikt');
  const kraverVal = doldaKraverVal(a, allaVacc);
  const besok = a.filtrera(db.query('SELECT * FROM bhv_besok WHERE patient_id = ? ORDER BY tid').all(p.id), 'las_oversikt');
  const upp = uppgifter(synliga(a, 'tillvaxt_uppgifter', 'las_oversikt'));
  const prog = P.program({ fodd: p.fodd, nu, besok: besok.map(b => ({ besokId: b.besok_id, status: b.status, tid: b.tid })), givna: vacc.map(v => ({ vaccinId: v.vaccin_id, tid: v.tid })), tbRisk: upp.tb_risk?.varde === 1 });
  return {
    inskriven: true, egenEnhet: egen, enhet: { id: ins.enhet_id, namn: enhetsnamn(db, ins.enhet_id) }, fran: ins.fran, bhvqMotsatt: Boolean(ins.bhvq_motsatt),
    program: prog, vaccinationer: vacc.map(v => vaccinationUt(db, v)), doldaVaccinationer: { kraverVal, text: kraverVal ? VARNING_DOLDA : null },
    forslag: egen && prog.nasta && kanRoll(atk.personal, 'boka_bhv') ? forslagFor(db, p, prog.nasta, nu, (enhetId) => atk.prova('las_admin', { enhet_id: enhetId }).tillaten) : [],
  };
}

export const vaccinationUt = (db, v) => {
  const d = P.vaccinRadVisning(v.vaccin_id);
  return { id: v.id, vaccinId: v.vaccin_id, text: d?.text ?? v.vaccin_id, sjukdomar: d?.sjukdomar ?? null, atc: v.atc, atcText: ATC[v.atc] ?? null, dos: v.dos, tid: v.tid, batch: v.batch,
    vardenhet: { id: v.enhet_id, namn: enhetsnamn(db, v.enhet_id) }, givetAv: personKort(db, v.givet_av)?.namn ?? null };
};

// Lediga tider för besöket i tidboken: BHV-sjuksköterskan för sjuksköterskebesöken och BVC-läkaren för teambesöken,
// inom besökets tidsfönster.
// synlig: får användaren se uppgifter från vårdenheten? En tid bakom inre sekretess eller spärr påverkar inte förslagen.
function forslagFor(db, p, besok, nu, synlig) {
  const ve = inskrivning(db, p.id).enhet_id;
  const fran = new Date(Math.max(nu + 2 * 3600_000, Date.parse(`${besok.fran}T00:00:00Z`))).toISOString();
  const till = new Date(Math.max(Date.parse(`${besok.till}T23:59:00Z`), nu + 14 * DAG)).toISOString();
  const onskad = besok.yrkesroll === 'sjukskoterska' ? BVC_SSK : 'lak-vc';
  // Sjuksköterskebesöken söks bara i barnavårdscentralens tidbok, teambesöken hos vårdcentralens läkare.
  return tidbok.foreslaTider(db, { patientId: p.id, ve: besok.yrkesroll === 'sjukskoterska' ? BVC : ve, tidstyp: 'aterbesok', yrkesroll: besok.yrkesroll, onskad, prioritet: 'normal', fran, till, synlig,
    grans: { datum: besok.till, text: besok.text.toLowerCase() } }, 6).filter(f => arBhvTid(db, f.tidId, besok.yrkesroll)).slice(0, 3);
}

// Hälsobesöken bokas hos barnavårdscentralens sjuksköterska eller hos BVC-läkaren, inte hos vårdcentralens andra
// sjuksköterskor.
function arBhvTid(db, tidId, yrkesroll) {
  const s = tidbok.schemaRad(db, tidbok.tidRad(db, tidId).schema_id);
  return s.yrkesroll === yrkesroll && (yrkesroll === 'sjukskoterska' ? s.enhet_id === BVC : s.personal_id === 'lak-vc');
}

// ---------------------------------------------------------------------------------------------------------------
// Registrering vid besöket

// POST /api/patient/:id/tillvaxt { vikt?, langd?, huvudomfang?, tid? }: värdena vid ett besök i en transaktion, med samma
// tid och samma vårdkontakt. Systemet sätter typ, enhet och kod. Besöket i programmet räknas som gjort när barnet är
// inskrivet på vårdenheten och mätningen görs inom besökets tidsfönster.
export function registrera(atk, p, body = {}, knyt) {
  atk.krav('registrera_matvarde');
  const db = atk.db;
  const falt = ['vikt', 'langd', 'huvudomfang', 'sitthojd'].filter(m => body[m] !== undefined && body[m] !== null && body[m] !== '');
  if (!falt.length) throw new Fel(400, 'Skriv vikt, längd, huvudomfång eller sitthöjd.', 'ogiltig', { falt: ['vikt'] });
  const ut = [];
  db.transaction(() => {
    let vk = null;
    for (const m of falt) {
      const r = journal.registreraMatvarde(atk, { typ: m, varde: body[m], tid: body.tid ?? null });
      if (vk) { db.query('UPDATE matvarden SET vardkontakt_id = ? WHERE id = ?').run(vk, r.id); r.vardkontakt = { id: vk }; } else { knyt(atk, 'matvarden', r, body); vk = r.vardkontakt?.id ?? null; }
      ut.push(r);
    }
    if (vk) markeraBesok(atk, p, vk, ut[0].tid);
  })();
  const vyn = vy(atk, p);
  return [201, { matvarden: ut, larm: vyn.larm, kurvor: vyn.kurvor, text: `${ut.map(r => `${r.namn} ${String(r.varde).replace('.', ',')} ${r.enhet}`).join(', ')} är registrerat.` }];
}

// Besöket i programmet som mätningen hör till, om barnet är inskrivet på användarens vårdenhet.
function markeraBesok(atk, p, vk, tid) {
  const db = atk.db;
  const ins = inskrivning(db, p.id);
  if (!ins || ins.enhet_id !== vardenhetFor(db, atk.personal.enhet_id)) return null;
  const dagar = P.alderDagar(p.fodd, Date.parse(tid));
  const b = P.BESOK.find(x => dagar >= x.fonster[0] && dagar <= x.fonster[1]);
  if (!b) return null;
  const bokat = db.query("SELECT * FROM bhv_besok WHERE patient_id = ? AND besok_id = ? AND status = 'bokat'").get(p.id, b.id);
  if (db.query("SELECT 1 FROM bhv_besok WHERE patient_id = ? AND besok_id = ? AND status = 'genomfort'").get(p.id, b.id)) return b.id;
  if (bokat) db.query("UPDATE bhv_besok SET status = 'genomfort', vardkontakt_id = ?, tid = ?, registrerad_av = ? WHERE id = ?").run(vk, tid, atk.personal.id, bokat.id);
  else db.query("INSERT INTO bhv_besok (patient_id, enhet_id, besok_id, status, vardkontakt_id, tid, registrerad_av) VALUES (?, ?, ?, 'genomfort', ?, ?, ?)").run(p.id, ins.enhet_id, b.id, vk, tid, atk.personal.id);
  return b.id;
}

// POST /api/patient/:id/tillvaxt/uppgift { typ, varde, tid? }: födelseuppgifter, föräldrarnas längd och risk för
// tuberkulos. En ny uppgift ersätter den förra, som finns kvar.
export function registreraUppgift(atk, p, body = {}) {
  atk.krav('registrera_matvarde');
  const typ = body.typ;
  if (!Object.hasOwn(UPPGIFTER, typ)) throw new Fel(400, 'Okänd uppgift.', 'ogiltig', { falt: ['typ'] });
  const v = typeof body.varde === 'string' ? Number(body.varde.replace(',', '.')) : typeof body.varde === 'boolean' ? Number(body.varde) : body.varde;
  const [lag, hog] = UPPGIFT_GRANSER[typ];
  if (!Number.isFinite(v) || v < lag || v > hog || (['graviditetslangd', 'langd_mor', 'langd_far', 'tb_risk'].includes(typ) && !Number.isInteger(v))) {
    throw new Fel(400, typ === 'tb_risk' ? 'Ange ja eller nej.' : `${UPPGIFTER[typ]} ska vara ${['graviditetslangd', 'langd_mor', 'langd_far'].includes(typ) ? 'ett heltal' : 'ett tal'} mellan ${lag} och ${hog}.`, 'ogiltig', { falt: ['varde'] });
  }
  const fodd = typ.startsWith('fodelse') || typ === 'graviditetslangd';
  const tid = fodd ? lokalTid(p.fodd, '12:00') : iso();
  atk.db.query('INSERT INTO tillvaxt_uppgifter (patient_id, enhet_id, typ, varde, tid, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.personal.enhet_id, typ, v, tid, atk.personal.id, iso());
  atk.logga('registrera_matvarde', atk.grund(), `tillvaxt:uppgift:${typ}`);
  return [201, { typ, namn: UPPGIFTER[typ], varde: v }];
}

// POST /api/patient/:id/tillvaxt/handelse { text, datum }: en särskild händelse som visas på kurvan.
export function registreraHandelse(atk, p, body = {}) {
  atk.krav('registrera_matvarde');
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 120) : '';
  if (text.length < 3) throw new Fel(400, 'Skriv vad som hände.', 'ogiltig', { falt: ['text'] });
  const datum = datumParam(body.datum) ?? datumAv(new Date());
  if (datum < p.fodd || datum > datumAv(new Date())) throw new Fel(400, 'Datumet ska ligga mellan födelsen och i dag.', 'ogiltig', { falt: ['datum'] });
  const r = atk.db.query('INSERT INTO tillvaxt_handelser (patient_id, enhet_id, tid, text, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.personal.enhet_id, lokalTid(datum, '12:00'), text, atk.personal.id, iso());
  atk.logga('registrera_matvarde', atk.grund(), `tillvaxt:handelse:${r.lastInsertRowid}`);
  return [201, { id: Number(r.lastInsertRowid), text, datum }];
}

// ---------------------------------------------------------------------------------------------------------------
// Vaccinationer och bokning enligt programmet

// POST /api/patient/:id/vaccination { vaccinId, batch? }: systemet sätter dos, ATC, tid och vårdkontakt och prövar mot
// programmet att dosen får ges nu. Det säger på vanlig svenska varför när den inte får det.
// Före varje dos frågar systemet alltid, för alla barn, om vaccinationer som barnet har fått någon annanstans. Frågan
// är densamma oavsett vad som finns i journalen, så att den aldrig röjer något.
export const FRAGA_ANDRA = 'Har barnet fått vaccinationer någon annanstans, till exempel på en annan vårdenhet eller utomlands? Fråga vårdnadshavaren innan du ger dosen.';
export const SVAR_JA = 'Registrera inte dosen förrän du vet vilka vaccinationer barnet har fått. Fråga vårdnadshavaren eller titta i barnets vaccinationskort.';
// En vaccination som bara är dold för att den kräver ett aktivt val varnar systemet för, utan vårdenhet, vaccin eller
// datum. En vaccination bakom en spärr ger ingen varning, eftersom en spärr aldrig röjs.
export const VARNING_DOLDA = 'Barnet har vaccinationer registrerade på en annan vårdenhet. Gör ett aktivt val för att se dem innan du ger dosen.';
function doldaKraverVal(a, rader) {
  return rader.some(r => { const x = a.prova('las_oversikt', { enhet_id: r.enhet_id }); return !x.tillaten && x.krav === 'kraver_val'; });
}

export function vaccinera(atk, p, body = {}, knyt, nu = Date.now()) {
  atk.krav('vaccinera');
  kravInskriven(atk, 'vaccinera');
  const db = atk.db;
  const v = P.vaccinRad(body.vaccinId);
  // Runda 10, r5: ett vaccin i de andra vaccinationsprogrammen registreras i deras flöde, som prövar det.
  if (!v && P.iAndraProgram(body.vaccinId)) throw new Fel(400, 'Vaccinet ingår inte i barnhälsovårdens program. Registrera dosen under Vaccinationer i journalen, där systemet prövar den mot vaccinationsprogrammen för äldre barn och riskgrupper.', 'ogiltig', { falt: ['vaccinId'] });
  if (!v) throw new Fel(400, 'Okänt vaccin i programmet.', 'ogiltig', { falt: ['vaccinId'] });
  if (body.andraVaccinationer === 'ja') throw new Fel(400, SVAR_JA, 'ogiltig', { falt: ['andraVaccinationer'] });
  if (body.andraVaccinationer !== 'nej') throw new Fel(400, FRAGA_ANDRA, 'kraver_fraga', { falt: ['andraVaccinationer'] });
  // Bara det användaren får se prövas, så att ett skäl aldrig röjer en vaccination bakom inre sekretess eller spärr.
  const a = new Atkomst(db, atk.personal, p.id, atk.val, 'las_oversikt');
  const allaVacc = db.query('SELECT * FROM vaccinationer WHERE patient_id = ?').all(p.id);
  const dolda = doldaKraverVal(a, allaVacc);
  if (dolda && body.bekraftaDolda !== true) throw new Fel(409, VARNING_DOLDA, 'kraver_bekraftelse');
  const givna = a.filtrera(allaVacc, 'las_oversikt').map(v => ({ vaccinId: v.vaccin_id, tid: v.tid }));
  const tb = uppgifter(a.filtrera(db.query("SELECT * FROM tillvaxt_uppgifter WHERE patient_id = ? AND typ = 'tb_risk'").all(p.id), 'las_oversikt')).tb_risk?.varde === 1;
  const prov = P.provaVaccin(v, { fodd: p.fodd, nu, givna, tbRisk: tb });
  if (!prov.ok) throw new Fel(400, prov.skal, 'ogiltig', { falt: ['vaccinId'] });
  const batch = typeof body.batch === 'string' && body.batch.trim() ? body.batch.trim().slice(0, 40) : null;
  const t = new Date(nu).toISOString();
  const r = db.query('INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, givet_av, batch, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.personal.enhet_id, v.id, v.atc, v.dos, t, atk.personal.id, batch, iso());
  // Runda 10, r5: dosen rapporteras av systemet till det simulerade vaccinationsregistret (vaccinationsregister.js).
  rapporteraVaccination(db, Number(r.lastInsertRowid));
  const ut = vaccinationUt(db, db.query('SELECT * FROM vaccinationer WHERE id = ?').get(r.lastInsertRowid));
  knyt(atk, 'vaccinationer', ut, body);
  atk.logga('vaccinera', atk.grund(), `vaccination:${ut.id}`, 'tillaten', dolda ? 'Dosen gavs utan aktivt val, efter bekräftelse att barnet har vaccinationer registrerade på en annan vårdenhet.' : null);
  return [201, { ...ut, text: `${v.text} är registrerad.` }];
}

// POST /api/patient/:id/bhv/boka { besokId, tidId }: systemet lägger besöket på väntelistan och bokar tiden i samma
// steg, med kallelse till vårdnadshavaren som all annan bokning. Utan tidId hamnar besöket bara på väntelistan, så att
// vårdadministratören bokar det.
export function boka(atk, p, body = {}, nu = Date.now()) {
  atk.krav('boka_bhv');
  const ins = kravInskriven(atk, 'boka_bhv');
  const db = atk.db;
  const b = P.besokRad(body.besokId);
  if (!b) throw new Fel(400, 'Okänt besök i programmet.', 'ogiltig', { falt: ['besokId'] });
  const prog = P.program({ fodd: p.fodd, nu, besok: db.query('SELECT besok_id AS besokId, status, tid FROM bhv_besok WHERE patient_id = ?').all(p.id) });
  const rad = prog.besok.find(x => x.id === b.id);
  if (['genomfort', 'bokat'].includes(rad.status)) throw new Fel(400, rad.status === 'bokat' ? `${b.text} är redan bokat.` : `${b.text} är redan gjort.`, 'ogiltig', { falt: ['besokId'] });
  const orsak = `Barnhälsovård: ${b.text.toLowerCase()}`;
  const post = tidbok.laggPaVantelista(db, { patientId: p.id, ve: ins.enhet_id, tidstyp: 'aterbesok', yrkesroll: b.yrkesroll, orsak, mal: rad.till < datumAv(new Date(nu)) ? addDagar(datumAv(new Date(nu)), 14) : rad.till, av: atk.personal.id, onskad: b.yrkesroll === 'sjukskoterska' ? BVC_SSK : 'lak-vc' });
  if (body.tidId == null) {
    atk.logga('boka_bhv', atk.grund(), `vantelista:${post.id}:bhv:${b.id}`);
    return [201, { vantelistaId: post.id, text: `${b.text} står på väntelistan med måldatum ${post.mal}. Vårdadministratören bokar tiden.` }];
  }
  const tid = tidbok.tidRad(db, body.tidId);
  if (vardenhetFor(db, tidbok.schemaRad(db, tid.schema_id).enhet_id) !== ins.enhet_id || tid.tidstyp !== 'aterbesok' || !arBhvTid(db, tid.id, b.yrkesroll)) {
    throw new Fel(400, `Välj en av tiderna som systemet föreslår för ${b.text.toLowerCase()}.`, 'ogiltig', { falt: ['tidId'] });
  }
  if (Date.parse(tid.start) < nu || !tidbok.arLedig(db, tid)) throw new Fel(400, 'Tiden är inte längre ledig. Välj ett av de andra förslagen.', 'ogiltig', { falt: ['tidId'] });
  const { b: bokning, kallelse } = tidbok.bokaPostRad(db, post, tid, { av: atk.personal.id });
  db.query("INSERT INTO bhv_besok (patient_id, enhet_id, besok_id, status, bokning_id, vardkontakt_id, tid, registrerad_av) VALUES (?, ?, ?, 'bokat', ?, ?, ?, ?)")
    .run(p.id, ins.enhet_id, b.id, bokning.id, bokning.vardkontakt_id, tid.start, atk.personal.id);
  atk.logga('boka_bhv', atk.grund(), `bokning:${bokning.id}:bhv:${b.id}`);
  const vacc = rad.vacciner.filter(v => !v.given).map(v => v.text);
  return [201, { bokningId: bokning.id, start: tid.start, kallelse: kallelse ? { kanal: kallelse.kanal, status: kallelse.status } : null,
    text: `${b.text} är bokat ${tidbok.tidText(tid.start)}.${vacc.length ? ` Vid besöket ges ${vacc.join(' och ')}.` : ''}` }];
}

// POST /api/patient/:id/bhv/lakarbesok: när systemet larmar om tillväxten föreslår det ett besök hos BVC-läkaren. Det
// läggs på väntelistan med måldatum om två veckor, eller en vecka när larmet gäller huvudomfånget.
export function lakarbesok(atk, p, body = {}) {
  atk.krav('boka_bhv');
  const ins = kravInskriven(atk, 'boka_bhv');
  const dagar = body.snart ? 7 : 14;
  const orsak = `Barnhälsovård: bedömning av tillväxten${typeof body.orsak === 'string' && body.orsak.trim() ? `, ${body.orsak.trim().slice(0, 80).toLowerCase()}` : ''}`;
  const post = tidbok.laggPaVantelista(atk.db, { patientId: p.id, ve: ins.enhet_id, tidstyp: 'aterbesok', yrkesroll: 'lakare', orsak, mal: addDagar(datumAv(new Date()), dagar), av: atk.personal.id, onskad: 'lak-vc' });
  atk.logga('boka_bhv', atk.grund(), `vantelista:${post.id}:bhv:lakare`);
  return [201, { vantelistaId: post.id, text: `Ett besök hos BVC-läkaren står på väntelistan med måldatum ${post.mal}.` }];
}

// Registrering till Svenska barnhälsovårdsregistret: barnet eller vårdnadshavaren kan motsätta sig (patientdatalagen
// 7 kap. 2 §). Då rapporteras inget om barnet.
export function bhvqMotsatt(atk, p, body = {}) {
  atk.krav('registrera_matvarde');
  kravInskriven(atk, 'rapportera_bhvq');
  const motsatt = body.motsatt !== false;
  atk.db.query('UPDATE bhv_inskrivning SET bhvq_motsatt = ?, bhvq_motsatt_tid = ? WHERE patient_id = ?').run(motsatt ? 1 : 0, iso(), p.id);
  atk.logga('rapportera_bhvq', atk.grund(), `bhvq:motsatt:${motsatt ? 1 : 0}`);
  return { motsatt, text: motsatt ? 'Inget om barnet rapporteras till Svenska barnhälsovårdsregistret.' : 'Barnets uppgifter rapporteras till Svenska barnhälsovårdsregistret igen.' };
}

// ---------------------------------------------------------------------------------------------------------------
// Föräldrarnas mätningar hemma

export const MAX_VANTANDE = 10;
// POST /api/min/journal/:id/tillvaxt { vikt?, langd?, huvudomfang?, datum? }: vårdnadshavaren registrerar en mätning
// hemma. Den syns på kurvan som en hemmätning som väntar, och räknas först när BHV-sjuksköterskan har bekräftat den.
export function minRegistrera(atk, body = {}, nu = Date.now()) {
  if (atk.relation !== 'vardnadshavare') throw new Fel(403, 'Mätningar hemma registreras av vårdnadshavaren för ett barn.', 'nekad');
  const db = atk.db;
  const ins = inskrivning(db, atk.patient.id);
  if (!ins) throw new Fel(403, 'Barnet är inte inskrivet i barnhälsovården i Vårdkällan. Ta med mätningen till nästa besök.', 'nekad');
  const falt = ['vikt', 'langd', 'huvudomfang', 'sitthojd'].filter(m => body[m] !== undefined && body[m] !== null && body[m] !== '');
  if (!falt.length) throw new Fel(400, 'Skriv vikt, längd, huvudomfång eller sitthöjd.', 'ogiltig', { falt: ['vikt'] });
  const datum = body.datum == null || body.datum === '' ? datumAv(new Date(nu)) : datumParam(body.datum);
  if (!datum || datum > datumAv(new Date(nu)) || datum < addDagar(datumAv(new Date(nu)), -30)) throw new Fel(400, 'Datumet ska vara i dag eller under de senaste 30 dagarna.', 'ogiltig', { falt: ['datum'] });
  const vantar = db.query("SELECT count(*) AS n FROM hemmatningar WHERE patient_id = ? AND status = 'vantar'").get(atk.patient.id).n;
  if (vantar + falt.length > MAX_VANTANDE) throw new Fel(400, `Det finns redan ${vantar} mätningar som väntar på att barnavårdscentralen bekräftar dem. Vänta tills de är bekräftade.`, 'ogiltig');
  const varden = falt.map(m => {
    const def = journal.MATTYPER[m];
    const v = typeof body[m] === 'string' ? Number(body[m].replace(',', '.')) : body[m];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < def.min || v > def.max) throw new Fel(400, `${def.namn} ska vara ett tal mellan ${def.min} och ${def.max} ${def.enhet}.`, 'ogiltig', { falt: [m] });
    return [m, v];
  });
  const tid = datum === datumAv(new Date(nu)) ? new Date(nu).toISOString() : lokalTid(datum, '12:00');
  const ins2 = db.query('INSERT INTO hemmatningar (patient_id, enhet_id, invanare_id, typ, varde, tid, skapad) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const ids = varden.map(([m, v]) => Number(ins2.run(atk.patient.id, ins.enhet_id, atk.invanare.id, m, v, tid, new Date(nu).toISOString()).lastInsertRowid));
  atk.logga(`min:tillvaxt:registrera:${ids.join(',')}`, { handling: 'invanare_registrera' });
  return [201, { antal: ids.length, text: `Tack. ${varden.map(([m, v]) => `${T.MATT[m].namn} ${T.tal(v, m === 'vikt' ? 2 : 1)} ${T.MATT[m].enhet}`).join(', ')} är skickat till ${enhetsnamn(db, ins.enhet_id)}. Barnavårdscentralen bekräftar mätningen innan den räknas på kurvan.` }];
}

export const hemmatningRad = (db, id) => {
  const h = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM hemmatningar WHERE id = ?').get(Number(id)) : null;
  if (!h) throw new Fel(404, 'Mätningen finns inte.', 'saknas');
  return h;
};

// POST /api/hemmatning/:id/bekrafta och /avvisa { orsak }: BHV-sjuksköterskan eller läkaren på barnets vårdenhet.
// En bekräftad mätning blir ett mätvärde med källan hemmätning och tiden då den gjordes.
export function bekrafta(atk, h, { avvisa = false, orsak = null } = {}) {
  atk.krav('registrera_matvarde');
  const db = atk.db;
  if (h.enhet_id !== vardenhetFor(db, atk.personal.enhet_id)) {
    atk.logga('registrera_matvarde', 'nekad', `hemmatning:${h.id}`, 'nekad');
    throw new Fel(403, 'Mätningen är skickad till en annan barnavårdscentral.', 'nekad');
  }
  if (h.status !== 'vantar') throw new Fel(400, h.status === 'bekraftad' ? 'Mätningen är redan bekräftad.' : 'Mätningen är redan avvisad.', 'ogiltig');
  if (avvisa) {
    const o = typeof orsak === 'string' ? orsak.trim().slice(0, 120) : '';
    if (o.length < 3) throw new Fel(400, 'Skriv varför mätningen inte används, så att vårdnadshavaren får veta det.', 'ogiltig', { falt: ['orsak'] });
    db.query("UPDATE hemmatningar SET status = 'avvisad', hanterad_av = ?, hanterad_tid = ?, orsak = ? WHERE id = ?").run(atk.personal.id, iso(), o, h.id);
    atk.logga('registrera_matvarde', atk.grund(), `hemmatning:${h.id}:avvisad`);
    return { status: 'avvisad', text: 'Mätningen används inte. Vårdnadshavaren ser varför i Min journal.' };
  }
  const def = journal.MATTYPER[h.typ];
  const r = db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'hemmatning')")
    .run(h.patient_id, atk.personal.enhet_id, h.typ, String(h.varde), h.varde, def.enhet, h.tid, atk.personal.id);
  db.query("UPDATE hemmatningar SET status = 'bekraftad', hanterad_av = ?, hanterad_tid = ?, matvarde_id = ? WHERE id = ?").run(atk.personal.id, iso(), Number(r.lastInsertRowid), h.id);
  atk.logga('registrera_matvarde', atk.grund(), `hemmatning:${h.id}:bekraftad`);
  return { status: 'bekraftad', matvardeId: Number(r.lastInsertRowid), text: `${def.namn} ${T.tal(h.varde, h.typ === 'vikt' ? 2 : 1)} ${def.enhet} från hemmet räknas nu på kurvan.` };
}

// ---------------------------------------------------------------------------------------------------------------
// Min journal för vårdnadshavaren: kurvorna, vaccinationerna och mätningarna hemma. Larmen visas inte för familjen;
// barnavårdscentralen tar upp dem vid besöket.
export function minTillvaxt(atk, nu = Date.now()) {
  const db = atk.db;
  const p = atk.patient;
  const rader = db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ IN ('vikt', 'langd', 'huvudomfang') ORDER BY tid").all(p.id);
  const upp = uppgifter(db.query('SELECT * FROM tillvaxt_uppgifter WHERE patient_id = ?').all(p.id));
  const hemma = db.query("SELECT * FROM hemmatningar WHERE patient_id = ? AND status = 'vantar' ORDER BY tid").all(p.id);
  const ut = bygg(db, p, { matvarden: rader, upp, hemma, handelser: [], nu });
  delete ut.larm;
  for (const k of ut.kurvor) for (const pt of k.punkter) { delete pt.registreradAv; delete pt.id; }
  const ins = inskrivning(db, p.id);
  const vacc = db.query('SELECT * FROM vaccinationer WHERE patient_id = ? ORDER BY tid').all(p.id).map(v => { const x = vaccinationUt(db, v); delete x.id; delete x.givetAv; return x; });
  const hanterade = db.query("SELECT * FROM hemmatningar WHERE patient_id = ? AND status <> 'vantar' ORDER BY hanterad_tid DESC LIMIT 10").all(p.id)
    .map(h => ({ namn: T.MATT[h.typ].namn, varde: h.varde, enhet: T.MATT[h.typ].enhet, tid: h.tid, status: h.status, orsak: h.orsak ?? null }));
  return {
    ...ut, vaccinationer: vacc, hemmatningar: hemma.map(h => ({ namn: T.MATT[h.typ].namn, varde: h.varde, enhet: T.MATT[h.typ].enhet, tid: h.tid, status: 'vantar' })), hanterade,
    bhv: ins ? { enhet: enhetsnamn(db, ins.enhet_id), program: P.program({ fodd: p.fodd, nu, besok: db.query('SELECT besok_id AS besokId, status, tid FROM bhv_besok WHERE patient_id = ?').all(p.id), givna: vacc.map(v => ({ vaccinId: v.vaccinId, tid: v.tid })) }).besok.map(b => ({ text: b.text, datum: b.datum, status: b.status, vacciner: b.vacciner.map(v => v.text) })) } : null,
    kanRegistrera: atk.relation === 'vardnadshavare' && Boolean(ins),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Inkorgen och listan för barnavårdscentralen

// Barnen som är inskrivna på personalens vårdenhet och som personalen får läsa mätvärdena för.
function barnenFor(db, personal, valFor) {
  if (!['lakare', 'sjukskoterska'].includes(personal?.yrke)) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT p.* FROM bhv_inskrivning i JOIN patienter p ON p.id = i.patient_id WHERE i.enhet_id = ? AND p.sammanslagen_till IS NULL ORDER BY p.fodd DESC').all(ve)
    .filter(p => harVardrelation(db, p.id, ve))
    .map(p => ({ p, atk: new Atkomst(db, personal, p.id, valFor(p.id), 'las_matvarden') }))
    .filter(x => x.atk.prova('las_matvarden').tillaten);
}

// Larmen räknas bara ur värden från den egna vårdenheten, så att inkorgen aldrig bygger på uppgifter som kräver aktivt
// val eller är spärrade.
export function inkorg(db, personal, valFor = () => ({}), nu = Date.now()) {
  const ut = { tillvaxtLarm: [], hemmatningarAttBekrafta: [], bhvAttBoka: [] };
  for (const { p, atk } of barnenFor(db, personal, valFor)) {
    const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
    const egna = (t) => db.query(`SELECT * FROM ${t} WHERE patient_id = ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY id`).all(p.id, ...enheter);
    const v = bygg(db, p, { matvarden: atk.filtrera(egna('matvarden'), 'las_matvarden'), upp: uppgifter(atk.filtrera(egna('tillvaxt_uppgifter'), 'las_matvarden')), nu });
    for (const l of v.larm) ut.tillvaxtLarm.push({ patientId: p.id, regel: l.regel, matt: l.matt, allvar: l.allvar, rubrik: l.rubrik, text: l.text, nastaSteg: l.nastaSteg, tid: l.tid, href: `#/patient/${encodeURIComponent(p.id)}/tillvaxt`, demoregel: l.demoregel });
    for (const h of db.query("SELECT * FROM hemmatningar WHERE patient_id = ? AND status = 'vantar' AND enhet_id = ? ORDER BY tid").all(p.id, vardenhetFor(db, personal.enhet_id))) {
      ut.hemmatningarAttBekrafta.push({ patientId: p.id, id: h.id, namn: T.MATT[h.typ].namn, varde: h.varde, enhet: T.MATT[h.typ].enhet, tid: h.tid, href: `#/patient/${encodeURIComponent(p.id)}/tillvaxt` });
    }
    if (kanRoll(personal, 'boka_bhv') && arbetarIBhv(db, personal)) {
      const prog = P.program({ fodd: p.fodd, nu, besok: db.query('SELECT besok_id AS besokId, status, tid FROM bhv_besok WHERE patient_id = ?').all(p.id) });
      const n = prog.nasta;
      if (n && n.status === 'nu') ut.bhvAttBoka.push({ patientId: p.id, besokId: n.id, text: n.text, till: n.till, vacciner: n.vacciner.filter(x => !x.given).map(x => x.text), href: `#/patient/${encodeURIComponent(p.id)}/tillvaxt` });
    }
  }
  return ut;
}

// ---------------------------------------------------------------------------------------------------------------
// Uppföljning av kvalitet och produktion (Sussa 4.1.1.8), utan personuppgifter: antal barn, besök i tid, mätningar per
// besök, vaccinationstäckning och larm för vårdenheten.
export function uppfoljning(db, personal, nu = Date.now()) {
  if (!kanRoll(personal, 'rapportera_bhvq')) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const barn = db.query('SELECT p.* FROM bhv_inskrivning i JOIN patienter p ON p.id = i.patient_id WHERE i.enhet_id = ? AND p.sammanslagen_till IS NULL').all(ve);
  const besok = P.BESOK.map(b => {
    let skulle = 0, iTid = 0, medMatt = 0;
    for (const p of barn) {
      if (P.alderDagar(p.fodd, nu) <= b.fonster[1]) continue;
      skulle++;
      const r = db.query("SELECT * FROM bhv_besok WHERE patient_id = ? AND besok_id = ? AND status = 'genomfort'").get(p.id, b.id);
      if (!r) continue;
      const d = P.alderDagar(p.fodd, Date.parse(r.tid));
      if (d >= b.fonster[0] && d <= b.fonster[1]) iTid++;
      const n = db.query(`SELECT count(DISTINCT typ) AS n FROM matvarden WHERE vardkontakt_id = ? AND typ IN (${b.matt.map(() => '?').join(', ')})`).get(r.vardkontakt_id, ...b.matt).n;
      if (n === b.matt.length) medMatt++;
    }
    return { id: b.id, text: b.text, barn: skulle, iTid, medAllaMatt: medMatt };
  }).filter(b => b.barn > 0);
  const vacc = P.VACCINER.filter(v => v.id !== 'bcg').map(v => {
    // Barn som har passerat tidsfönstret för det besök där dosen ges, eller dosens ålder plus 60 dagar.
    const b = P.BESOK.find(x => x.vacciner.includes(v.id));
    const grans = b ? b.fonster[1] : v.alder + 60;
    const aldre = barn.filter(p => P.alderDagar(p.fodd, nu) > grans);
    const enh = enheterUnder(db, ve);
    const givna = aldre.filter(p => db.query(`SELECT 1 FROM vaccinationer WHERE patient_id = ? AND vaccin_id = ? AND enhet_id IN (${enh.map(() => '?').join(', ')})`).get(p.id, v.id, ...enh)).length;
    return { id: v.id, text: v.text, barn: aldre.length, givna };
  }).filter(v => v.barn > 0);
  return { enhet: enhetsnamn(db, ve), antalBarn: barn.length, besok, vaccinationer: vacc, hemmatningarSomVantar: db.query("SELECT count(*) AS n FROM hemmatningar WHERE enhet_id = ? AND status = 'vantar'").get(ve).n,
    text: 'Uppföljningen visar antal, aldrig vilka barn det gäller.', demoregel: P.DEMOREGEL };
}

export { K11 };
