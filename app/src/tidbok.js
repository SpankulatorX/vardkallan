// Tidbok, väntelista, kallelser, incheckning och betalning av patientavgift (Sussa 3.4.1 till 3.4.4).
//
// Systemet är experten. Vårdadministratören letar aldrig i en kalender och behöver inte kunna några regler:
//   - En accepterad remiss hamnar på väntelistan av sig själv, med tidstyp och yrkesroll ur remissen, prioritet ur
//     remissens prioritet och gränsen räknad som demoregel (vårdgarantin och remissens sista svarsdatum).
//   - När en patient ska få tid föreslår systemet de lämpligaste tiderna: rätt tidstyp och yrkesroll, före gränsen, hos
//     den vårdgivare patienten har träffat förut och inte samma dag som en annan bokning. Bokningen är ett klick.
//   - Bokningen är en planerad vårdkontakt (vardkontakt.js). Incheckningen registrerar ankomsten på den, och avgiften
//     räknas av systemet med samma demoregler som vårdkontakten.
//   - Kallelsen skrivs av systemet ur bokningen, på enkel svenska och bara med det en kallelse behöver. Systemet väljer
//     kanal, skickar påminnelsen själv och skickar en ny kallelse när bokningen ändras.
//
// Behörighet. Att boka, kalla, checka in och hantera väntelistan är egna handlingar i behörighetsmotorn (boka, kalla,
// checka_in, vantelista) och kräver vårdrelation eller remiss till vårdenheten, som all annan åtkomst till patienten.
// Varje åtgärd loggas på patienten. Kallelsen innehåller aldrig journaltext. En patient med skyddade personuppgifter
// får kallelser bara i Min journal, och namnet visas aldrig på incheckningsskärmen.
import { Fel, iso, idag, addDagar, datumAv, lokalTid, installning } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, harVardrelation, visningsnamn, visningsPnr, provaInvanare } from './atkomst.js';
import { avgiftFor, gerVardrelation } from './vardkontakt.js';
import * as identitet from './identitet.js';
import * as SEED from './seed/tidbok.js';
// Planerad vårdhändelse (vardhandelse.js): tiden i tidboken styr när en läkemedelsdos ska ges.
import { synka as synkaVardhandelser, styrDos, sakraSchema as sakraVardhandelser, STYR_LAKEMEDEL } from './vardhandelse.js';
export { STYR_LAKEMEDEL };
// Runda 6, r4: resurser (lokaler, utrustning och sjukresor), tider i följd och kallelsens språk (planering-bas.js).
import * as plan from './planering-bas.js';
// Runda 7, r4: parametrar som systemförvaltningen kan ändra.
import * as konfiguration from './konfiguration.js';

// Tidstyperna. kontaktsatt är vårdkontaktens kontaktsätt, och fysiska besök checkas in.
export const TIDSTYPER = {
  nybesok: { text: 'Nybesök', min: 60, kontaktsatt: 'besok', fysisk: true },
  aterbesok: { text: 'Återbesök', min: 30, kontaktsatt: 'besok', fysisk: true },
  telefon: { text: 'Telefontid', min: 15, kontaktsatt: 'telefon', fysisk: false },
  video: { text: 'Videobesök', min: 30, kontaktsatt: 'video', fysisk: false },
  grupp: { text: 'Gruppträff', min: 120, kontaktsatt: 'besok', fysisk: true },
  // Runda 6, r4: ett ingrepp kräver lokal och utrustning (planering-bas.js), och provtagningen bokas före läkarbesöket.
  ingrepp: { text: 'Ingrepp', min: 90, kontaktsatt: 'besok', fysisk: true },
  provtagning: { text: 'Provtagning', min: 15, kontaktsatt: 'besok', fysisk: true },
  // Runda 8, r3: ett teambesök med två eller fler vårdgivare (bokning-r8.js). Tiden skapas när besöket bokas.
  team: { text: 'Teambesök', min: 60, kontaktsatt: 'besok', fysisk: true },
};
export const YRKESROLL = { lakare: 'läkare', sjukskoterska: 'sjuksköterska' };
// Runda 8, r3: fysioterapeuten leder gruppträffar och ingår i teambesök (bokning-r8.js).
YRKESROLL.fysioterapeut = 'fysioterapeut';
// Tidstyper som patienten någonsin kan boka, boka om och avboka själv i Min journal (beslut 2026-11-03). Ett nybesök
// eller en gruppträff bokas alltid av mottagningen, också om en mottagning skulle öppna dem i sina regler.
export const EGENBOKNING_TIDSTYPER = ['aterbesok', 'telefon', 'video'];
export const PRIORITET = { hog: 'Hög', normal: 'Normal', lag: 'Låg' };
const PRIO_ORDNING = { hog: 0, normal: 1, lag: 2 };
// Runda 6, r4: avsändaren av en egen vårdbegäran från invånaren (vardbegaran.js).
export const EGEN_VARDBEGARAN = 'min-journal';
export const KANAL = { min_journal: 'Min journal', sms: 'Sms', brev: 'Brev' };
// Orsaker som systemet föreslår vid omprioritering. patientvald betyder att patienten själv har valt att vänta, och då
// räknas inte vårdgarantin.
export const OMPRIORITERING = {
  tillstand: 'Patientens tillstånd har ändrats',
  bedomning: 'Ny bedömning av läkaren',
  patientvald: 'Patienten vill vänta (patientvald väntan)',
  annan_tid: 'Patienten har fått vård på annat sätt',
};

// Demoregler, märkta så i gränssnittet. Beloppen och gränserna är påhittade och inte någon regions regler.
export const DEMOREGLER = {
  vardgarantiDagar: 90, riskDagar: 14, paminnelseTimmar: 48, egenGransTimmar: 24, incheckningForeMin: 60, incheckningEfterMin: 30,
  text: 'Demoregler: vårdgarantin räknas som 90 dagar från att remissen togs emot, och den som har högst 14 dagar kvar lyfts fram. Påminnelsen går ut 48 timmar före tiden. Patienten kan boka om och avboka i Min journal fram till 24 timmar före. Incheckningen är öppen från en timme före till en halvtimme efter tiden.',
};

const MIN = 60_000;
const TIMME = 60 * MIN;
const DAG = 24 * TIMME;
const TZ = 'Europe/Stockholm';

// Schemat. IF NOT EXISTS, så att samma schema kan läggas till i en äldre sandlåda.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tidboksregler (enhet_id TEXT NOT NULL, tidstyp TEXT NOT NULL, egenbokning INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (enhet_id, tidstyp));
CREATE TABLE IF NOT EXISTS scheman (id TEXT PRIMARY KEY, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, yrkesroll TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tider (
  id INTEGER PRIMARY KEY, schema_id TEXT NOT NULL, start TEXT NOT NULL, slut TEXT NOT NULL, tidstyp TEXT NOT NULL,
  platser INTEGER NOT NULL DEFAULT 1, rubrik TEXT, relativ INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tider_schema ON tider (schema_id, start);
CREATE TABLE IF NOT EXISTS bokningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, tid_id INTEGER NOT NULL, vardkontakt_id INTEGER, vantelista_id INTEGER, remiss_id INTEGER,
  status TEXT NOT NULL DEFAULT 'bokad', bokad TEXT NOT NULL, bokad_av TEXT, bokad_av_invanare TEXT, ersatter_id INTEGER,
  andrad TEXT, andrad_av TEXT, andrad_av_invanare TEXT, orsak TEXT, incheckad TEXT, incheckad_via TEXT, konummer TEXT, bekraftad TEXT,
  CHECK (status IN ('bokad', 'incheckad', 'ombokad', 'avbokad'))
);
CREATE INDEX IF NOT EXISTS ix_bokningar_patient ON bokningar (patient_id);
CREATE INDEX IF NOT EXISTS ix_bokningar_tid ON bokningar (tid_id);
CREATE TABLE IF NOT EXISTS betalningar (
  id INTEGER PRIMARY KEY, bokning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, belopp INTEGER NOT NULL, satt TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT, av_invanare TEXT, kvitto TEXT NOT NULL, text TEXT,
  CHECK (satt IN ('kort', 'faktura', 'frikort', 'avgiftsfri'))
);
CREATE TRIGGER IF NOT EXISTS betalning_andras_ej BEFORE UPDATE ON betalningar BEGIN SELECT RAISE(ABORT, 'En betalning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS betalning_raderas_ej BEFORE DELETE ON betalningar BEGIN SELECT RAISE(ABORT, 'En betalning raderas inte'); END;
CREATE TABLE IF NOT EXISTS vantelista (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, remiss_id INTEGER, tidstyp TEXT NOT NULL, yrkesroll TEXT NOT NULL,
  prioritet TEXT NOT NULL, orsak TEXT NOT NULL, onskad_personal_id TEXT, fran TEXT NOT NULL, mal TEXT, patientvald INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'vantar', skapad TEXT NOT NULL, skapad_av TEXT, bokning_id INTEGER,
  CHECK (status IN ('vantar', 'bokad', 'avslutad')), CHECK (prioritet IN ('hog', 'normal', 'lag'))
);
CREATE TABLE IF NOT EXISTS vantelista_handelser (
  id INTEGER PRIMARY KEY, vantelista_id INTEGER NOT NULL, tid TEXT NOT NULL, av TEXT, av_invanare TEXT, typ TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS vl_handelse_andras_ej BEFORE UPDATE ON vantelista_handelser BEGIN SELECT RAISE(ABORT, 'Väntelistans händelser ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vl_handelse_raderas_ej BEFORE DELETE ON vantelista_handelser BEGIN SELECT RAISE(ABORT, 'Väntelistans händelser raderas inte'); END;
CREATE TABLE IF NOT EXISTS kallelser (
  id INTEGER PRIMARY KEY, bokning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, typ TEXT NOT NULL, kanal TEXT, mottagare TEXT,
  text TEXT NOT NULL, status TEXT NOT NULL, skapad TEXT NOT NULL, skickad TEXT, skapad_av TEXT, forklaring TEXT, lasd TEXT,
  CHECK (typ IN ('kallelse', 'paminnelse', 'ombokning', 'avbokning')), CHECK (status IN ('skickad', 'vantar', 'kan_inte', 'klar'))
);
CREATE INDEX IF NOT EXISTS ix_kallelser_bokning ON kallelser (bokning_id);
CREATE TRIGGER IF NOT EXISTS kallelse_raderas_ej BEFORE DELETE ON kallelser BEGIN SELECT RAISE(ABORT, 'En kallelse raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS kallelse_skickad_andras_ej BEFORE UPDATE OF text, kanal, mottagare ON kallelser WHEN OLD.status = 'skickad'
  BEGIN SELECT RAISE(ABORT, 'En skickad kallelse ändras inte'); END;
CREATE TABLE IF NOT EXISTS kanalval (patient_id TEXT PRIMARY KEY, kanal TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bevakningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, text TEXT NOT NULL, forfaller TEXT NOT NULL, vantelista_id INTEGER,
  skapad TEXT NOT NULL, skapad_av TEXT, klar TEXT, klar_av TEXT
);
-- Runda 8, r3 (bokning-r8.js): vårdgivarna i ett teambesök, och väntelistan till en gruppträff.
CREATE TABLE IF NOT EXISTS teambesok_deltagare (
  id INTEGER PRIMARY KEY, bokning_id INTEGER NOT NULL, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, start TEXT NOT NULL, slut TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_teambesok_personal ON teambesok_deltagare (personal_id, start);
CREATE TABLE IF NOT EXISTS gruppvantelista (
  id INTEGER PRIMARY KEY, tid_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vantar',
  skapad TEXT NOT NULL, skapad_av TEXT, bokning_id INTEGER, CHECK (status IN ('vantar', 'bokad', 'struken'))
);
`;

// ---------------------------------------------------------------------------------------------------------------
// Schema, seed och anpassning till nu

export function utokaTidbok(db) {
  const fanns = Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tider'").get());
  db.exec(SCHEMA);
  sakraVardhandelser(db);
  plan.sakraPlanering(db);
  return !fanns;
}

const round5 = (ms) => Math.round(ms / (5 * MIN)) * 5 * MIN;
const veckodag = (datum) => new Date(`${datum}T12:00:00Z`).getUTCDay();
// En dag framåt som hamnar på en helg flyttas till måndagen efter.
function vardag(datum) {
  let d = datum;
  while ([0, 6].includes(veckodag(d))) d = addDagar(d, 1);
  return d;
}
const plusMin = (isoTid, min) => new Date(Date.parse(isoTid) + min * MIN).toISOString();

// Seeden (seed/tidbok.js), relativt till bas. Mallens tider läggs ut från i morgon och DAGAR_FRAMAT dagar framåt.
// Dagens tider är relativa till nu och flyttas när sandlådan skapas (anpassaTillNu).
export function seedaTidbok(db, { bas = new Date() } = {}) {
  utokaTidbok(db);
  const basDatum = datumAv(bas);
  const insP = db.query('INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, 0, 1)');
  for (const p of SEED.TIDBOK_PERSONAL) insP.run(p.id, p.namn, p.yrke, p.titel, p.enhet, p.hsa);
  for (const s of SEED.SCHEMAN) db.query('INSERT OR IGNORE INTO scheman VALUES (?, ?, ?, ?)').run(s.id, s.enhet, s.personal, s.yrkesroll);
  for (const r of SEED.EGENBOKNING) for (const t of Object.keys(TIDSTYPER)) {
    db.query('INSERT OR IGNORE INTO tidboksregler VALUES (?, ?, ?)').run(r.enhet, t, r.tidstyper.includes(t) && EGENBOKNING_TIDSTYPER.includes(t) ? 1 : 0);
  }
  for (const k of SEED.KANALVAL) db.query('INSERT OR IGNORE INTO kanalval VALUES (?, ?)').run(k.patient, k.kanal);
  const insT = db.query('INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const tidFor = (t) => (t.min != null ? new Date(round5(bas.getTime() + t.min * MIN)).toISOString() : lokalTid(vardag(addDagar(basDatum, t.dag)), t.klocka));
  // Gruppträffarna först, så att mallens tider som krockar med dem inte läggs ut.
  const grupper = SEED.GRUPPER.map(g => ({ ...g, start: tidFor(g.tid) }));
  for (let d = 1; d <= SEED.DAGAR_FRAMAT; d++) {
    const datum = addDagar(basDatum, d);
    for (const s of SEED.SCHEMAN) {
      if (!s.dagar.includes(veckodag(datum))) continue;
      for (const [klocka, tidstyp] of s.mall) {
        const start = lokalTid(datum, klocka);
        const slut = plusMin(start, TIDSTYPER[tidstyp].min);
        const krock = grupper.some(g => g.schema === s.id && start < plusMin(g.start, g.minuter) && slut > g.start);
        if (!krock) insT.run(s.id, start, slut, tidstyp, 1, null, 0);
      }
    }
  }
  for (const g of grupper) insT.run(g.schema, g.start, plusMin(g.start, g.minuter), 'grupp', g.platser, g.rubrik, 0);
  for (const l of SEED.DAGENS_LEDIGA) {
    const start = tidFor({ min: l.min });
    insT.run(l.schema, start, plusMin(start, TIDSTYPER[l.tidstyp].min), l.tidstyp, 1, null, 1);
  }
  // Bokningarna. En bokning är en planerad vårdkontakt.
  for (const b of SEED.BOKNINGAR) {
    const start = tidFor(b.tid);
    const relativ = b.tid.min != null ? 1 : 0;
    let tid = db.query('SELECT * FROM tider WHERE schema_id = ? AND start = ? AND tidstyp = ?').get(b.schema, start, b.tidstyp);
    if (!tid) {
      const id = insT.run(b.schema, start, plusMin(start, TIDSTYPER[b.tidstyp].min), b.tidstyp, 1, b.grupp ?? null, relativ).lastInsertRowid;
      tid = db.query('SELECT * FROM tider WHERE id = ?').get(Number(id));
    }
    const bokad = new Date(Date.parse(lokalTid(addDagar(basDatum, b.bokad), '09:00'))).toISOString();
    const bok = skapaBokning(db, { patientId: b.patient, tid, orsak: b.orsak ?? null, av: b.bokadAv, bokad });
    if (b.incheckad) {
      const t = new Date(round5(bas.getTime() + b.incheckad.min * MIN)).toISOString();
      db.query("UPDATE bokningar SET status = 'incheckad', incheckad = ?, incheckad_via = ?, konummer = ? WHERE id = ?").run(t, b.incheckad.via, konummerFor(db, tid, t), bok.id);
      db.query('UPDATE vardkontakter SET ankomst = ? WHERE id = ?').run(t, bok.vardkontakt_id);
    }
    // Kallelserna till dagens patienter skrivs när sandlådan skapas, efter att tiderna har flyttats (anpassaTillNu).
    if (!relativ) seedKallelser(db, bok.id, b, basDatum);
  }
  for (const v of SEED.VANTELISTA) {
    const fran = addDagar(basDatum, v.fran);
    const id = db.query(`INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, onskad_personal_id, fran, mal, skapad, skapad_av)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(v.patient, v.enhet, v.tidstyp, v.yrkesroll, v.prioritet, v.orsak, v.onskad, fran, addDagar(basDatum, v.mal),
      lokalTid(fran, '11:00'), v.skapadAv).lastInsertRowid;
    vlHandelse(db, Number(id), 'skapad', { av: v.skapadAv, tid: lokalTid(fran, '11:00'), detalj: v.orsak });
  }
  sakraVantelista(db);
  for (const b of SEED.BEVAKNINGAR) {
    db.query('INSERT INTO bevakningar (patient_id, enhet_id, text, forfaller, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?)')
      .run(b.patient, b.enhet, b.text, addDagar(basDatum, b.forfaller), lokalTid(addDagar(basDatum, b.forfaller - 3), '10:00'), b.skapadAv);
  }
  // Runda 6, r4: resurser, ingreppstider, provtagningen, poster som behöver resurser eller tider i följd och språkval.
  plan.seedaPlanering(db, { bas, dagar: SEED.DAGAR_FRAMAT });
  installning(db, 'tidbok_bas', bas.toISOString());
}

function seedKallelser(db, bokningId, b, basDatum) {
  const bok = bokningRad(db, bokningId);
  const start = tidRad(db, bok.tid_id).start;
  if (b.kallelse) {
    const skickad = new Date(Date.parse(lokalTid(addDagar(basDatum, b.kallelse.dagar), '09:05'))).toISOString();
    skickaKallelse(db, bok, 'kallelse', { tid: skickad, kanal: b.kallelse.kanal });
  } else if (b.grupp) forberedKallelse(db, bok);
  if (b.paminnelse) skickaKallelse(db, bok, 'paminnelse', { tid: new Date(Date.parse(start) - 2 * DAG).toISOString() });
}

// En sandlåda från före tidboken får den när den läses in, relativt till nu.
export function sakraTidbok(db) {
  const nyPlanering = !plan.harTabeller(db);
  if (utokaTidbok(db)) seedaTidbok(db, { bas: new Date() });
  else {
    sakraVantelista(db);
    // Runda 6, r4: en sandlåda med tidbok men utan resurserna får dem, relativt till i dag.
    if (nyPlanering) plan.seedaPlanering(db, { bas: new Date(), dagar: SEED.DAGAR_FRAMAT });
  }
}

// Dagens bokningar i seeden ligger relativt till när mallen byggdes. När en sandlåda skapas flyttas de till tider
// kring nu, så att det alltid finns patienter som väntas och patienter som har kommit. Görs en gång per sandlåda.
export function anpassaTillNu(db, nu = Date.now()) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tider'").get()) return 0;
  const bas = installning(db, 'tidbok_bas');
  if (!bas || installning(db, 'tidbok_anpassad')) return 0;
  installning(db, 'tidbok_anpassad', new Date(nu).toISOString());
  const skift = round5(nu - Date.parse(bas));
  const flytta = (t) => (t && skift ? new Date(Date.parse(t) + skift).toISOString() : t);
  const tider = db.query('SELECT * FROM tider WHERE relativ = 1').all();
  for (const t of tider) {
    db.query('UPDATE tider SET start = ?, slut = ? WHERE id = ?').run(flytta(t.start), flytta(t.slut), t.id);
    for (const b of db.query('SELECT * FROM bokningar WHERE tid_id = ?').all(t.id)) {
      db.query('UPDATE bokningar SET incheckad = ? WHERE id = ?').run(flytta(b.incheckad), b.id);
      if (b.vardkontakt_id) {
        const v = db.query('SELECT start, ankomst FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
        if (v) db.query('UPDATE vardkontakter SET start = ?, ankomst = ? WHERE id = ?').run(flytta(v.start), flytta(v.ankomst), b.vardkontakt_id);
      }
    }
  }
  const basDatum = datumAv(new Date(nu));
  for (const s of SEED.BOKNINGAR.filter(x => x.tid.min != null)) {
    const b = db.query('SELECT b.id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = ? AND t.relativ = 1 AND t.schema_id = ? ORDER BY b.id').get(s.patient, s.schema);
    if (!b || db.query('SELECT 1 FROM kallelser WHERE bokning_id = ?').get(b.id)) continue;
    seedKallelser(db, b.id, s, basDatum);
    // Den som redan har checkat in och inte betalar något har fått det registrerat av systemet.
    const rad = bokningRad(db, b.id);
    const a = rad.status === 'incheckad' ? avgiftForBokning(db, rad) : null;
    if (a && a.belopp === 0 && !db.query('SELECT 1 FROM betalningar WHERE bokning_id = ?').get(rad.id)) registreraBetalning(db, rad, a, a.satt, { av: rad.bokad_av });
  }
  return tider.length;
}

// ---------------------------------------------------------------------------------------------------------------
// Rader och hjälpfunktioner

const enhetRad = (db, id) => db.query('SELECT * FROM enheter WHERE id = ?').get(id);
const enhetKort = (db, id) => { const e = id && enhetRad(db, id); return e ? { id: e.id, namn: e.namn } : null; };
const personRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
const personKort = (db, id) => { const p = personRad(db, id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
export const schemaRad = (db, id) => db.query('SELECT * FROM scheman WHERE id = ?').get(id);
export function tidRad(db, id) {
  const t = db.query('SELECT * FROM tider WHERE id = ?').get(Number(id));
  if (!t) throw new Fel(404, 'Tiden finns inte.', 'saknas');
  return t;
}
export function bokningRad(db, id) {
  const b = db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(id));
  if (!b) throw new Fel(404, 'Bokningen finns inte.', 'saknas');
  return b;
}
export function vantelistaRad(db, id) {
  const v = db.query('SELECT * FROM vantelista WHERE id = ?').get(Number(id));
  if (!v) throw new Fel(404, 'Posten på väntelistan finns inte.', 'saknas');
  return v;
}
export function bevakningRad(db, id) {
  const v = db.query('SELECT * FROM bevakningar WHERE id = ?').get(Number(id));
  if (!v) throw new Fel(404, 'Bevakningen finns inte.', 'saknas');
  return v;
}
// Vårdenheten som en tid hör till (inre sekretess och vårdrelation räknas per vårdenhet).
export const tidensVardenhet = (db, tid) => vardenhetFor(db, schemaRad(db, tid.schema_id).enhet_id);
export const bokningensEnhet = (db, b) => schemaRad(db, tidRad(db, b.tid_id).schema_id).enhet_id;

const datumText = (t) => new Date(t).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const klockText = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');
export const tidText = (t) => `${datumText(t)} klockan ${klockText(t)}`;
const dagarMellan = (fran, till) => Math.round((Date.parse(`${till}T12:00:00Z`) - Date.parse(`${fran}T12:00:00Z`)) / DAG);
const patientKort = (p) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) });

export function vlHandelse(db, id, typ, { av = null, avInvanare = null, tid = iso(), detalj = null } = {}) {
  db.query('INSERT INTO vantelista_handelser (vantelista_id, tid, av, av_invanare, typ, detalj) VALUES (?, ?, ?, ?, ?, ?)').run(id, tid, av, avInvanare, typ, detalj);
}

// Platsen för vårdkontakten: mottagningen för ett besök, annars kontaktsättet.
function plats(db, schema, tidstyp) {
  const k = TIDSTYPER[tidstyp].kontaktsatt;
  if (k === 'telefon') return 'Telefonkontakt';
  if (k === 'video') return 'Videobesök';
  const e = enhetRad(db, schema.enhet_id);
  return e?.typ === 'arbetsplats' ? e.namn : 'Mottagning';
}

// Bokningar som tar en plats på tiden.
const aktiva = (db, tidId) => db.query("SELECT count(*) AS n FROM bokningar WHERE tid_id = ? AND status IN ('bokad', 'incheckad')").get(tidId).n;
export const arLedig = (db, tid) => aktiva(db, tid.id) < tid.platser && !teamKrock(db, tid);
// Runda 8, r3: en tid är inte ledig när vårdgivaren är bokad på ett teambesök som överlappar den (bokning-r8.js).
export function teamKrock(db, tid) {
  return Boolean(db.query(`SELECT 1 FROM teambesok_deltagare d JOIN bokningar b ON b.id = d.bokning_id
    WHERE d.personal_id = (SELECT personal_id FROM scheman WHERE id = ?) AND b.status IN ('bokad', 'incheckad') AND d.start < ? AND d.slut > ? AND b.tid_id <> ? LIMIT 1`)
    .get(tid.schema_id, tid.slut, tid.start, tid.id));
}

// Konummer vid incheckning: K och löpnummer per vårdenhet och dag. Väntrummet ropar upp med numret, aldrig med namn.
function konummerFor(db, tid, nar) {
  const ve = tidensVardenhet(db, tid);
  const dag = datumAv(new Date(nar));
  const n = db.query("SELECT b.incheckad, t.schema_id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.konummer IS NOT NULL").all()
    .filter(r => datumAv(new Date(r.incheckad)) === dag && vardenhetFor(db, schemaRad(db, r.schema_id).enhet_id) === ve).length;
  return `K${String(n + 1).padStart(2, '0')}`;
}

// En bokning skapar en planerad vårdkontakt på mottagningen. Den ger vårdrelation bara om den som bokar redan hade
// vårdrelation till patienten (som en kontakt som vårdkontakt.js skapar). Patienten själv bokar bara där patienten
// redan har vårdrelation.
export function skapaBokning(db, { patientId, tid, orsak, av = null, avInvanare = null, vantelistaId = null, remissId = null, bokad = iso(), relation = 1, ersatter = null }) {
  const schema = schemaRad(db, tid.schema_id);
  const tt = TIDSTYPER[tid.tidstyp];
  const text = orsak || tid.rubrik || tt.text;
  const vk = Number(db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, remiss_id, skapad, skapad_av, automatisk, ger_vardrelation)
    VALUES (?, ?, 'oppenvard', ?, ?, NULL, ?, ?, 'vardkallan', 1, ?, ?, ?, 0, ?)`).run(patientId, schema.enhet_id, tt.kontaktsatt, tid.start, plats(db, schema, tid.tidstyp), text, remissId, bokad, av, relation).lastInsertRowid);
  const id = Number(db.query(`INSERT INTO bokningar (patient_id, tid_id, vardkontakt_id, vantelista_id, remiss_id, status, bokad, bokad_av, bokad_av_invanare, ersatter_id, orsak)
    VALUES (?, ?, ?, ?, ?, 'bokad', ?, ?, ?, ?, ?)`).run(patientId, tid.id, vk, vantelistaId, remissId, bokad, av, avInvanare, ersatter, text).lastInsertRowid);
  return bokningRad(db, id);
}

// ---------------------------------------------------------------------------------------------------------------
// Väntelistan

// En accepterad remiss till en vårdenhet med tidbok hamnar på väntelistan. Systemet tar tidstyp och yrkesroll ur
// remissen (nybesök hos läkare, om läkaren inte angav något annat), prioriteten ur remissens prioritet och gränsen ur
// vårdgarantin och remissens sista svarsdatum. Orsaken är avsändaren, aldrig frågeställningen.
export function vantelistaFranRemiss(db, r, { av = null, tidstyp = 'nybesok', yrkesroll = 'lakare' } = {}) {
  // Runda 10, r6: en avslutad post hindrar inte en ny, eftersom en remiss som läkaren öppnar igen efter ett beslut på
  // uppdrag (remiss-r10.js) kan accepteras på nytt.
  if (db.query("SELECT 1 FROM vantelista WHERE remiss_id = ? AND status <> 'avslutad'").get(r.id)) return null;
  if (!db.query('SELECT 1 FROM scheman s WHERE s.enhet_id IN (SELECT id FROM enheter WHERE id = ?1 OR forald_id = ?1)').get(r.till_enhet_id)) return null;
  const fran = datumAv(new Date(r.mottagen_tid ?? r.skickad_tid));
  const prioritet = ['akut', 'skyndsam'].includes(r.prioritet) ? 'hog' : 'normal';
  // Runda 6, r4: en egen vårdbegäran från invånaren kommer från Min journal, inte från en vårdenhet.
  const orsak = r.fran_enhet_id === EGEN_VARDBEGARAN ? `${TIDSTYPER[tidstyp]?.text ?? 'Besök'} enligt egen vårdbegäran`
    : `${TIDSTYPER[tidstyp]?.text ?? 'Besök'} enligt remiss från ${enhetRad(db, r.fran_enhet_id)?.namn ?? 'annan vårdenhet'}`;
  const tid = r.bedomd_tid ?? iso();
  const id = Number(db.query(`INSERT INTO vantelista (patient_id, enhet_id, remiss_id, tidstyp, yrkesroll, prioritet, orsak, fran, mal, skapad, skapad_av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.patient_id, r.till_enhet_id, r.id, tidstyp, yrkesroll, prioritet, orsak, fran, r.svar_senast, tid, av ?? r.bedomd_av ?? null).lastInsertRowid);
  vlHandelse(db, id, 'skapad', { av: av ?? r.bedomd_av ?? null, tid, detalj: 'Remissen accepterades och patienten sattes upp på väntelistan av systemet.' });
  return vantelistaRad(db, id);
}

// Efter läkarens bedömning. Läkaren kan ange tidstyp och yrkesroll, annars blir det nybesök hos läkare.
export function efterBedomning(db, r, body = {}) {
  // Runda 6, r4: läkaren kan ange ett ingrepp. Då tar systemet tidstyp och yrkesroll ur ingreppet.
  const ingrepp = Object.hasOwn(plan.INGREPP, body.ingrepp ?? '') && plan.kravSaknas(db, r.till_enhet_id, body.ingrepp) === null ? body.ingrepp : null;
  const tidstyp = ingrepp ? 'ingrepp' : ['nybesok', 'aterbesok', 'telefon', 'video'].includes(body.tidstyp) ? body.tidstyp : 'nybesok';
  const yrkesroll = ingrepp ? plan.INGREPP[ingrepp].yrkesroll : Object.hasOwn(YRKESROLL, body.yrkesroll ?? '') ? body.yrkesroll : 'lakare';
  const v = vantelistaFranRemiss(db, r, { tidstyp, yrkesroll });
  if (v && ingrepp) db.query('INSERT OR REPLACE INTO vantelista_behov (vantelista_id, ingrepp, mall) VALUES (?, ?, NULL)').run(v.id, ingrepp);
  return v ? { id: v.id, text: 'Patienten står nu på väntelistan och vårdadministratören får förslag på tider.' } : null;
}

// När läkaren avvisar en remiss finns inte längre grunden för de tider som bokades på den. Systemet avbokar tider som hör
// till remissen, och tider på vårdenheten när patienten inte har någon annan vårdrelation där, och patienten får besked.
// Posten på väntelistan avslutas. Så blir en bokning aldrig en vårdrelation som remissen inte längre ger.
export function efterAvvisning(db, r, personal) {
  const ve = vardenhetFor(db, r.till_enhet_id);
  const ingenAnnan = !harVardrelation(db, r.patient_id, ve, new Date(), { utanPlanerade: true });
  let n = 0;
  for (const rad of db.query("SELECT * FROM bokningar WHERE patient_id = ? AND status = 'bokad' ORDER BY id").all(r.patient_id)) {
    // En tidigare avbokning i slingan kan ha avbokat tiden före i samma kedja (runda 6, r4).
    const b = bokningRad(db, rad.id);
    if (b.status !== 'bokad') continue;
    if (vardenhetFor(db, bokningensEnhet(db, b)) !== ve) continue;
    if (b.remiss_id !== r.id && !ingenAnnan) continue;
    avbokaRad(db, b, { av: personal.id, orsak: 'Remissen avvisades', synk: false });
    if (b.vantelista_id) {
      db.query("UPDATE vantelista SET status = 'avslutad' WHERE id = ?").run(b.vantelista_id);
      vlHandelse(db, b.vantelista_id, 'avslutad', { av: personal.id, detalj: 'Remissen avvisades. Systemet avbokade tiden och avslutade posten.' });
    }
    n++;
  }
  for (const v of db.query("SELECT * FROM vantelista WHERE patient_id = ? AND enhet_id = ? AND status = 'vantar'").all(r.patient_id, ve)) {
    if (v.remiss_id !== r.id && !ingenAnnan) continue;
    db.query("UPDATE vantelista SET status = 'avslutad' WHERE id = ?").run(v.id);
    vlHandelse(db, v.id, 'avslutad', { av: personal.id, detalj: 'Remissen avvisades. Systemet avslutade posten.' });
  }
  // En vårdhändelse som hängde på tiden sätts inte upp igen, utan den ordinerande läkaren beslutar (runda 5, r4).
  synkaVardhandelser(db, r.patient_id, { av: personal.id, remissAvvisad: true });
  return n;
}

// Accepterade remisser som saknar en post, till exempel i en sandlåda från en äldre version, får en.
export function sakraVantelista(db) {
  for (const r of db.query("SELECT * FROM remisser WHERE status = 'bedomd' AND beslut = 'accepterad' AND kalla = 'vardkallan'").all()) vantelistaFranRemiss(db, r);
}

// Gränsen för en post: vårdgarantin för ett nybesök efter remiss (demoregel) och det medicinska måldatumet. Det som
// kommer först gäller. Vid patientvald väntan räknas inte vårdgarantin.
export function gransFor(post, dag = idag()) {
  const kandidater = [];
  if (post.remiss_id && post.tidstyp === 'nybesok' && !post.patientvald) kandidater.push({ datum: addDagar(post.fran, DEMOREGLER.vardgarantiDagar), typ: 'vardgaranti', text: 'vårdgarantin (demoregel)' });
  if (post.mal) kandidater.push({ datum: post.mal, typ: 'mal', text: post.remiss_id ? 'remissens sista svarsdatum' : 'måldatum från läkaren' });
  if (!kandidater.length) return null;
  const g = kandidater.sort((a, b) => a.datum.localeCompare(b.datum))[0];
  const kvar = dagarMellan(dag, g.datum);
  return { ...g, dagarKvar: kvar, risk: kvar < 0 ? 'passerad' : kvar <= DEMOREGLER.riskDagar ? 'risk' : null };
}

export function vantelistaUt(db, post, dag = idag()) {
  const p = patientRad(db, post.patient_id);
  const g = gransFor(post, dag);
  const r = post.remiss_id ? db.query('SELECT fran_enhet_id, prioritet FROM remisser WHERE id = ?').get(post.remiss_id) : null;
  return {
    id: post.id, patient: patientKort(p), vardenhet: enhetKort(db, post.enhet_id), tidstyp: post.tidstyp, tidstypText: TIDSTYPER[post.tidstyp]?.text,
    yrkesroll: post.yrkesroll, yrkesrollText: YRKESROLL[post.yrkesroll], prioritet: post.prioritet, prioritetText: PRIORITET[post.prioritet],
    orsak: post.orsak, fran: post.fran, vantatDagar: dagarMellan(post.fran, dag), mal: post.mal, grans: g, patientvald: Boolean(post.patientvald),
    remiss: r ? { id: post.remiss_id, fran: enhetKort(db, r.fran_enhet_id) } : null, onskad: personKort(db, post.onskad_personal_id),
    status: post.status, bokningId: post.bokning_id ?? null, skapad: post.skapad, skapadAv: personKort(db, post.skapad_av),
    // Planerad vårdhändelse: att tiden styr en läkemedelsdos, aldrig vilket läkemedel (vardhandelse.js).
    styrLakemedel: styrDos(db, { postRad: post }) ? STYR_LAKEMEDEL : null,
    // Runda 6, r4: ett ingrepp eller en bokningsmall, och en kallelse där patienten väljer tid själv.
    ...behovUt(db, post),
    handelser: db.query('SELECT * FROM vantelista_handelser WHERE vantelista_id = ? ORDER BY tid, id').all(post.id)
      .map(h => ({ typ: h.typ, tid: h.tid, av: personKort(db, h.av), avPatienten: Boolean(h.av_invanare), detalj: h.detalj })),
  };
}

// Runda 6, r4: det posten behöver utöver tidstyp och yrkesroll.
function behovUt(db, post) {
  const b = plan.behovForPost(db, post.id);
  const i = b?.ingrepp && plan.INGREPP[b.ingrepp];
  const m = plan.mallFor(b?.mall);
  const ram = post.status === 'vantar' ? plan.ramForPost(db, post.id) : null;
  return {
    ingrepp: i ? { id: b.ingrepp, text: i.text, krav: i.krav.map(k => plan.KATEGORIER[k].text) } : null,
    mall: m ? { id: m.id, namn: m.namn, forklaring: m.forklaring } : null,
    kalladUtanTid: ram ? { id: ram.id, fran: ram.fran, till: ram.till, skapad: ram.skapad, kanal: ram.kanal, kanalText: ram.kanal ? KANAL[ram.kanal] : null } : null,
  };
}

// Ordningen på väntelistan: den som har passerat gränsen eller riskerar att passera den först, sedan prioritet och
// dagar kvar.
export function sorteraVantelista(a, b) {
  const risk = (x) => (x.grans?.risk === 'passerad' ? 0 : x.grans?.risk === 'risk' ? 1 : 2);
  return risk(a) - risk(b) || PRIO_ORDNING[a.prioritet] - PRIO_ORDNING[b.prioritet] || (a.grans?.dagarKvar ?? 999) - (b.grans?.dagarKvar ?? 999) || a.fran.localeCompare(b.fran);
}

// Väntelistan för den inloggades vårdenhet, bara patienter med vårdrelation eller remiss dit.
export function vantelista(db, personal, { alla = false } = {}) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const rader = db.query(`SELECT * FROM vantelista WHERE enhet_id = ? ${alla ? '' : "AND status = 'vantar'"}`).all(ve).filter(v => harVardrelation(db, v.patient_id, ve));
  return rader.map(v => vantelistaUt(db, v)).sort(sorteraVantelista);
}

export function prioritera(atk, post, body = {}) {
  atk.krav('vantelista');
  const db = atk.db;
  kravEgenVardenhet(atk, post.enhet_id, `vantelista:${post.id}`);
  if (post.status !== 'vantar') throw new Fel(400, 'Patienten har redan fått en tid. Boka om tiden i stället.', 'ogiltig');
  const ny = body.prioritet;
  if (!Object.hasOwn(PRIORITET, ny)) throw new Fel(400, 'Välj hög, normal eller låg prioritet.', 'ogiltig', { falt: ['prioritet'] });
  if (!Object.hasOwn(OMPRIORITERING, body.orsak)) throw new Fel(400, 'Välj orsaken till ändringen.', 'ogiltig', { falt: ['orsak'] });
  if (ny === post.prioritet && body.orsak !== 'patientvald') throw new Fel(400, `Prioriteten är redan ${PRIORITET[ny].toLowerCase()}.`, 'ogiltig', { falt: ['prioritet'] });
  const patientvald = body.orsak === 'patientvald' ? 1 : post.patientvald;
  db.query('UPDATE vantelista SET prioritet = ?, patientvald = ? WHERE id = ?').run(ny, patientvald, post.id);
  vlHandelse(db, post.id, 'omprioriterad', { av: atk.personal.id, detalj: `${PRIORITET[post.prioritet]} till ${PRIORITET[ny].toLowerCase()}. ${OMPRIORITERING[body.orsak]}.` });
  atk.logga('vantelista', atk.grund(), `vantelista:${post.id}:prioritet`);
  return vantelistaUt(db, vantelistaRad(db, post.id));
}

// En ny post på väntelistan, till exempel ett återbesök. Systemet sätter vårdenhet, tidigare vårdgivare och, om inget
// anges, prioritet normal och måldatum om 30 dagar.
export function nyPost(atk, body = {}) {
  atk.krav('vantelista');
  const db = atk.db;
  const ve0 = vardenhetFor(db, atk.personal.enhet_id);
  // Runda 6, r4: ett ingrepp anger själv tidstyp och yrkesroll, och vårdenheten måste ha det som ingreppet kräver.
  // En bokningsmall gäller vissa tidstyper på den vårdenhet som har mallen.
  const ingrepp = body.ingrepp ?? null;
  if (ingrepp !== null) {
    if (!Object.hasOwn(plan.INGREPP, ingrepp)) throw new Fel(400, 'Ingreppet finns inte.', 'ogiltig', { falt: ['ingrepp'] });
    const saknas = plan.kravSaknas(db, ve0, ingrepp);
    if (saknas) throw new Fel(400, saknas, 'ogiltig', { falt: ['ingrepp'] });
    body = { ...body, tidstyp: plan.INGREPP[ingrepp].tidstyp, yrkesroll: plan.INGREPP[ingrepp].yrkesroll, orsak: body.orsak ?? plan.INGREPP[ingrepp].text };
  }
  const mall = body.mall ? plan.mallFor(body.mall) : null;
  if (body.mall && (!mall || mall.enhet !== ve0)) throw new Fel(400, 'Bokningsmallen finns inte på din vårdenhet.', 'ogiltig', { falt: ['mall'] });
  const tidstyp = body.tidstyp ?? 'aterbesok';
  if (!Object.hasOwn(TIDSTYPER, tidstyp) || tidstyp === 'grupp') throw new Fel(400, 'Välj nybesök, återbesök, telefontid eller videobesök.', 'ogiltig', { falt: ['tidstyp'] });
  if (mall && !mall.tidstyper.includes(tidstyp)) throw new Fel(400, `Mallen ${mall.namn} gäller ${mall.tidstyper.map(t => TIDSTYPER[t].text.toLowerCase()).join(' och ')}.`, 'ogiltig', { falt: ['mall'] });
  const yrkesroll = body.yrkesroll ?? 'lakare';
  if (!Object.hasOwn(YRKESROLL, yrkesroll)) throw new Fel(400, 'Välj läkare eller sjuksköterska.', 'ogiltig', { falt: ['yrkesroll'] });
  const inom = Number(body.inomDagar ?? 30);
  if (!Number.isInteger(inom) || inom < 1 || inom > 365) throw new Fel(400, 'Ange inom hur många dagar patienten ska få tid, högst ett år.', 'ogiltig', { falt: ['inomDagar'] });
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const orsak = (typeof body.orsak === 'string' && body.orsak.trim().slice(0, 120)) || `${TIDSTYPER[tidstyp].text} hos ${YRKESROLL[yrkesroll]}`;
  const post = laggPaVantelista(db, { patientId: atk.patientId, ve, tidstyp, yrkesroll, orsak, mal: addDagar(idag(), inom), av: atk.personal.id });
  if (ingrepp || mall) db.query('INSERT INTO vantelista_behov (vantelista_id, ingrepp, mall) VALUES (?, ?, ?)').run(post.id, ingrepp, mall?.id ?? null);
  atk.logga('vantelista', atk.grund(), `vantelista:${post.id}:ny`);
  return [201, vantelistaUt(db, post)];
}

// En ny post på väntelistan, gemensam för vårdadministratörens nya post, läkarens återbesök (aterbesok.js) och en
// planerad vårdhändelse (vardhandelse.js). Behörigheten prövas av den som anropar. Systemet sätter den vårdgivare
// patienten har träffat förut som önskad, om inget annat anges, och prioriteten normal.
export function laggPaVantelista(db, { patientId, ve, tidstyp, yrkesroll, orsak, mal, av, onskad, detalj = null }) {
  const vg = onskad === undefined ? tidigareVardgivare(db, patientId, ve, yrkesroll)[0] ?? null : onskad;
  const id = Number(db.query(`INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, onskad_personal_id, fran, mal, skapad, skapad_av)
    VALUES (?, ?, ?, ?, 'normal', ?, ?, ?, ?, ?, ?)`).run(patientId, ve, tidstyp, yrkesroll, orsak, vg, idag(), mal, iso(), av).lastInsertRowid);
  vlHandelse(db, id, 'skapad', { av, detalj: detalj ?? orsak });
  return vantelistaRad(db, id);
}

// ---------------------------------------------------------------------------------------------------------------
// Förslag på tider

// Vårdgivare som patienten har träffat på vårdenheten, senaste först: tidigare bokningar, och den som har skrivit
// patientens anteckningar där. Används bara för att föreslå samma vårdgivare igen, och ingen journaltext lämnas ut.
export function tidigareVardgivare(db, patientId, ve, yrkesroll = null) {
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const ur = [
    ...db.query(`SELECT s.personal_id AS id, t.start AS tid FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
      WHERE b.patient_id = ? AND s.enhet_id IN (${ph}) AND b.status IN ('bokad', 'incheckad') AND t.tidstyp <> 'grupp'`).all(patientId, ...enheter),
    ...db.query(`SELECT forfattare_id AS id, skapad AS tid FROM anteckningar WHERE patient_id = ? AND enhet_id IN (${ph})`).all(patientId, ...enheter),
  ].filter(r => r.tid <= iso()).sort((a, b) => b.tid.localeCompare(a.tid));
  const ut = [];
  for (const r of ur) {
    const p = personRad(db, r.id);
    if (!p || !p.aktiv || ut.includes(p.id)) continue;
    if (yrkesroll && p.yrke !== yrkesroll) continue;
    if (!db.query('SELECT 1 FROM scheman WHERE personal_id = ?').get(p.id)) continue;
    ut.push(p.id);
  }
  return ut;
}

// De lämpligaste tiderna. behov: { patientId, ve, tidstyp, yrkesroll, onskad, prioritet, grans, uteslut, fran }.
// Systemet tar bara tider med rätt tidstyp och yrkesroll på vårdenheten, hoppar över dagar då patienten redan har en
// tid och väljer i den här ordningen: den tidigaste tiden hos den vårdgivare patienten har träffat förut, om den ligger
// före gränsen, annars den tidigaste tiden över huvud taget, och sedan tider andra dagar. Varje förslag säger varför.
export function foreslaTider(db, behov, antal = 3) {
  const enheter = enheterUnder(db, behov.ve);
  const ph = enheter.map(() => '?').join(', ');
  const fran = behov.fran ?? new Date(Date.now() + 2 * TIMME).toISOString();
  // Runda 6, r4: en kallelse utan förbokad tid har en ram som tiderna ska ligga inom.
  const till = behov.till ?? new Date(Date.now() + (SEED.DAGAR_FRAMAT + 5) * DAG).toISOString();
  const rader = db.query(`SELECT t.*, s.personal_id, s.yrkesroll, s.enhet_id FROM tider t JOIN scheman s ON s.id = t.schema_id
    WHERE s.enhet_id IN (${ph}) AND t.tidstyp = ? AND s.yrkesroll = ? AND t.start >= ? AND t.start <= ? ORDER BY t.start, t.id`)
    .all(...enheter, behov.tidstyp, behov.yrkesroll, fran, till)
    .filter(t => t.id !== behov.uteslut && arLedig(db, t));
  // Dagar då patienten redan har en tid, men bara tider som användaren själv får se. En tid på en annan vårdenhet, som
  // kräver aktivt val eller är spärrad, påverkar inte förslagen, så att förslagen inte röjer den.
  const synlig = behov.synlig ?? (() => true);
  const upptagna = new Set(db.query("SELECT t.start, s.enhet_id FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE b.patient_id = ? AND b.status IN ('bokad', 'incheckad') AND b.id <> ?")
    .all(behov.patientId, behov.uteslutBokning ?? 0).filter(r => synlig(r.enhet_id)).map(r => datumAv(new Date(r.start))));
  // Runda 6, r4: lokal, utrustning och sjukresa ska vara lediga hela tiden, och en bokningsmall kräver en ledig tid före
  // med rätt mellanrum. Tider där något saknas föreslås inte.
  const planer = new Map();
  const lediga = rader.filter(t => !upptagna.has(datumAv(new Date(t.start)))).filter(t => {
    const p = planForTid(db, behov, t);
    if (p) planer.set(t.id, p);
    return Boolean(p);
  });
  const onskade = behov.onskad ? [behov.onskad] : [];
  const fore = (t) => !behov.grans || datumAv(new Date(t.start)) <= behov.grans.datum;
  const valda = [];
  const lagg = (t) => { if (t && !valda.some(v => v.id === t.id) && valda.length < antal) valda.push(t); };
  const tidigast = lediga[0];
  const hosOnskad = lediga.find(t => onskade.includes(t.personal_id));
  if (behov.prioritet === 'hog') { lagg(tidigast); lagg(hosOnskad && fore(hosOnskad) ? hosOnskad : null); } else { lagg(hosOnskad && fore(hosOnskad) ? hosOnskad : null); lagg(tidigast); }
  for (const t of lediga) {
    if (valda.length >= antal) break;
    if (valda.some(v => datumAv(new Date(v.start)) === datumAv(new Date(t.start)))) continue;
    lagg(t);
  }
  return valda.map(t => {
    const skal = [];
    if (onskade.includes(t.personal_id)) skal.push(`${personRad(db, t.personal_id)?.namn}, som patienten har träffat förut.`);
    if (t.id === tidigast?.id) skal.push('Den tidigaste lediga tiden.');
    if (behov.grans) {
      const kvar = dagarMellan(datumAv(new Date(t.start)), behov.grans.datum);
      skal.push(kvar >= 0 ? `${kvar} ${kvar === 1 ? 'dag' : 'dagar'} före gränsen för ${behov.grans.text}.` : `Efter gränsen för ${behov.grans.text}. Det finns ingen tidigare tid.`);
    }
    if (upptagna.size) skal.push('Inte samma dag som patientens andra tider.');
    const p = planer.get(t.id);
    if (behov.krav?.length) skal.push(plan.kravText(behov.krav));
    if (p.fore) skal.push(`${TIDSTYPER[p.fore.tidstyp].text} klockan ${klockText(p.fore.start)}, ${langd(Date.parse(t.start) - Date.parse(p.fore.slut))} före besöket, så att svaren hinner komma.`);
    return {
      tidId: t.id, start: t.start, slut: t.slut, tidstyp: t.tidstyp, tidstypText: TIDSTYPER[t.tidstyp].text,
      vardgivare: personKort(db, t.personal_id), mottagning: enhetKort(db, t.enhet_id), skal,
      // Runda 6, r4: det systemet bokar samtidigt.
      resurser: p.resurser.map(plan.resursKort),
      fore: p.fore ? { tidId: p.fore.id, start: p.fore.start, slut: p.fore.slut, tidstyp: p.fore.tidstyp, tidstypText: TIDSTYPER[p.fore.tidstyp].text, vardgivare: personKort(db, p.fore.personal_id) } : null,
    };
  });
}

// Runda 6, r4: vad tiden kräver utöver tidstyp och yrkesroll: resurser (krav) och en tid före (mall).
function planBehov(db, { postId = null, ve, patientId, tidstyp }) {
  const b = plan.behovForPost(db, postId);
  const mall = plan.mallFor(b?.mall);
  return { krav: plan.kravFor(db, { ve, ingrepp: b?.ingrepp ?? null, patientId, fysisk: TIDSTYPER[tidstyp]?.fysisk }), mall: mall && mall.tidstyper.includes(tidstyp) ? mall : null };
}
export const behovForPost = (db, post) => ({
  patientId: post.patient_id, ve: post.enhet_id, tidstyp: post.tidstyp, yrkesroll: post.yrkesroll, prioritet: post.prioritet, grans: gransFor(post),
  onskad: post.onskad_personal_id ?? tidigareVardgivare(db, post.patient_id, post.enhet_id, post.yrkesroll)[0] ?? null,
  ...planBehov(db, { postId: post.id, ve: post.enhet_id, patientId: post.patient_id, tidstyp: post.tidstyp }),
});
function behovForBokning(db, b, { fran } = {}) {
  const tid = tidRad(db, b.tid_id);
  const schema = schemaRad(db, tid.schema_id);
  const post = b.vantelista_id ? vantelistaRad(db, b.vantelista_id) : null;
  const ve = vardenhetFor(db, schema.enhet_id);
  // Runda 6, r4: samma resurser som bokningen har, och tiden före följer med när den är en del av en kedja.
  const kedja = plan.kedjaFor(db, b.id);
  const krav = post ? planBehov(db, { postId: post.id, ve, patientId: b.patient_id, tidstyp: tid.tidstyp }).krav : plan.kravForBokning(db, b.id);
  return {
    patientId: b.patient_id, ve, tidstyp: tid.tidstyp, yrkesroll: schema.yrkesroll, prioritet: post?.prioritet ?? 'normal',
    grans: post ? gransFor(post) : null, onskad: schema.personal_id, uteslut: tid.id, uteslutBokning: b.id, fran,
    krav, mall: kedja?.roll === 'huvud' ? kedja.mall : null, uteslutForeBokning: kedja?.roll === 'huvud' ? kedja.foreId : 0,
  };
}

// Runda 6, r4: resurserna och tiden före för en tid, eller null när något saknas.
function planForTid(db, behov, t) {
  const krav = behov.krav ?? [];
  const resurser = krav.length ? plan.valjResurser(db, behov.ve, krav, t.start, t.slut, { uteslutBokning: behov.uteslutBokning ?? 0 }) : [];
  if (!resurser) return null;
  let fore = null;
  if (behov.mall) {
    fore = plan.tidFore(db, behov.mall, t, { uteslutBokning: behov.uteslutForeBokning ?? 0 });
    if (!fore) return null;
  }
  return { resurser, fore };
}
// Felet när den valda tiden inte har allt den kräver.
function planFel(db, behov, t) {
  if (behov.krav?.length && !plan.valjResurser(db, behov.ve, behov.krav, t.start, t.slut, { uteslutBokning: behov.uteslutBokning ?? 0 })) return plan.resursFel();
  return new Fel(400, `Det finns ingen ledig ${TIDSTYPER[behov.mall.fore.tidstyp].text.toLowerCase()} före den tiden. Välj ett av förslagen.`, 'ogiltig', { falt: ['tidId'] });
}
// En tid före ett besök, till exempel provtagningen, bokas om och av tillsammans med besöket.
function kravInteFore(db, b) {
  if (plan.kedjaFor(db, b.id)?.roll === 'fore') throw new Fel(400, 'Tiden hör till ett besök senare samma dag och flyttas med det. Boka om eller avboka besöket i stället.', 'ogiltig');
}
// Hur lång tid, till exempel "1 timme och 15 minuter".
function langd(ms) {
  const m = Math.round(ms / MIN);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const t = h ? `${h} ${h === 1 ? 'timme' : 'timmar'}` : '';
  return [t, r ? `${r} minuter` : ''].filter(Boolean).join(' och ');
}

// Får användaren se uppgifter från vårdenheten (inre sekretess, aktivt val och spärr)?
const synligFor = (atk) => (enhetId) => atk.prova('las_admin', { enhet_id: enhetId }).tillaten;

export function forslagForPost(atk, post) {
  atk.krav('boka');
  kravEgenVardenhet(atk, post.enhet_id, `vantelista:${post.id}`);
  const db = atk.db;
  atk.logga('boka', atk.grund(), `vantelista:${post.id}:forslag`);
  return { post: vantelistaUt(db, post), forslag: foreslaTider(db, { ...behovForPost(db, post), synlig: synligFor(atk) }), demoregler: DEMOREGLER.text };
}

export function forslagForBokning(atk, b) {
  atk.krav('boka');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, b), `bokning:${b.id}`);
  kravInteFore(db, b);
  atk.logga('boka', atk.grund(), `bokning:${b.id}:forslag`);
  return { bokning: bokningUt(db, b, { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), forslag: foreslaTider(db, { ...behovForBokning(db, b), synlig: synligFor(atk) }), demoregler: DEMOREGLER.text };
}

// ---------------------------------------------------------------------------------------------------------------
// Bokning, ombokning och avbokning

// Bara den egna vårdenhetens tidbok. Ett försök mot en annan vårdenhet nekas och loggas.
export function kravEgenVardenhet(atk, enhetId, resurs) {
  if (vardenhetFor(atk.db, enhetId) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga(atk.handling, 'nekad', resurs, 'nekad');
    throw new Fel(403, 'Det är en annan vårdenhets tidbok. Kontakta den vårdenheten.', 'nekad');
  }
}

function kravLedigTid(db, tid, ve) {
  if (tidensVardenhet(db, tid) !== ve) throw new Fel(400, 'Tiden hör till en annan vårdenhet.', 'ogiltig', { falt: ['tidId'] });
  if (Date.parse(tid.start) < Date.now()) throw new Fel(400, 'Tiden har redan varit.', 'ogiltig', { falt: ['tidId'] });
  if (!arLedig(db, tid)) throw new Fel(400, 'Tiden har just bokats av någon annan. Välj ett av de andra förslagen.', 'ogiltig', { falt: ['tidId'] });
}

export function boka(atk, post, body = {}) {
  atk.krav('boka');
  const db = atk.db;
  kravEgenVardenhet(atk, post.enhet_id, `vantelista:${post.id}`);
  if (post.status !== 'vantar') throw new Fel(400, 'Patienten har redan fått en tid för det här.', 'ogiltig');
  const tid = tidRad(db, body.tidId);
  kravLedigTid(db, tid, post.enhet_id);
  // Samma krav som förslagen: tidstypen och yrkesrollen ur posten, aldrig en gruppträff.
  if (tid.tidstyp === 'grupp' || tid.tidstyp !== post.tidstyp || schemaRad(db, tid.schema_id).yrkesroll !== post.yrkesroll) {
    throw new Fel(400, `Välj en tid för ${TIDSTYPER[post.tidstyp]?.text.toLowerCase() ?? 'besöket'} hos ${YRKESROLL[post.yrkesroll]}. Systemet föreslår bara sådana.`, 'ogiltig', { falt: ['tidId'] });
  }
  const relation = gerVardrelation(db, atk.personal, post.patient_id);
  const { b, kallelse } = bokaPostRad(db, post, tid, { av: atk.personal.id, relation });
  atk.logga('boka', atk.grund(), `bokning:${b.id}`);
  return [201, { ...bokningUt(db, bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), kallelse: kallelseUt(kallelse, skydd(db, b.patient_id, atk.val?.visa_identitet)) }];
}

// Bokar en post på väntelistan: bokningen, resurserna, tiden före när posten har en bokningsmall och kallelsen. Gemensam
// för vårdadministratörens bokning och patientens bokning efter en kallelse utan förbokad tid (planering.js). Den som
// anropar har prövat behörigheten och att tiden är ledig och har rätt tidstyp.
export function bokaPostRad(db, post, tid, { av = null, avInvanare = null, relation = 1 } = {}) {
  // Runda 6, r4: lokal, utrustning, sjukresa och tiden före väljer systemet. Saknas något går tiden inte att boka.
  const behov = behovForPost(db, post);
  const p = planForTid(db, behov, tid);
  if (!p) throw planFel(db, behov, tid);
  const b = skapaBokning(db, { patientId: post.patient_id, tid, orsak: post.orsak, av, avInvanare, vantelistaId: post.id, remissId: post.remiss_id, relation });
  plan.reservera(db, b.id, p.resurser, tid.start, tid.slut);
  if (p.fore) {
    const f = skapaBokning(db, { patientId: post.patient_id, tid: p.fore, orsak: `${TIDSTYPER[p.fore.tidstyp].text} före besöket`, av, avInvanare, remissId: post.remiss_id, relation });
    plan.knytKedja(db, f.id, b.id, behov.mall.id);
  }
  db.query("UPDATE vantelista SET status = 'bokad', bokning_id = ? WHERE id = ?").run(b.id, post.id);
  vlHandelse(db, post.id, 'bokad', { av, avInvanare, detalj: `${TIDSTYPER[tid.tidstyp].text} ${tidText(tid.start)}${p.fore ? `, ${TIDSTYPER[p.fore.tidstyp].text.toLowerCase()} klockan ${klockText(p.fore.start)}` : ''}` });
  // En vårdhändelse som en läkemedelsdos väntar på får sin tid, och dosen räknas fram av systemet.
  synkaVardhandelser(db, post.patient_id, { av });
  const kallelse = skickaKallelse(db, b, 'kallelse', { av });
  return { b, kallelse };
}

// Ombokning: en ny bokning ersätter den gamla, och den planerade vårdkontakten flyttas med. Systemet skickar en ny
// kallelse utan att någon ber om det. Resurserna och tiden före flyttas med (runda 6, r4). kallelse: false för tiden
// före, som bara huvudbokningens kallelse berättar om.
function ombokaRad(db, b, tid, { av = null, avInvanare = null, kallelse = true, planera = true }) {
  b = bokningRad(db, b.id);
  if (!['bokad'].includes(b.status)) throw new Fel(400, b.status === 'incheckad' ? 'Patienten har redan checkat in.' : 'Bokningen gäller inte längre.', 'ogiltig');
  const behov = planera ? behovForBokning(db, b) : null;
  const p = planera ? planForTid(db, behov, tid) : { resurser: [], fore: null };
  if (!p) throw planFel(db, behov, tid);
  const kedja = planera ? plan.kedjaFor(db, b.id) : null;
  const ny = Number(db.query(`INSERT INTO bokningar (patient_id, tid_id, vardkontakt_id, vantelista_id, remiss_id, status, bokad, bokad_av, bokad_av_invanare, ersatter_id, orsak)
    VALUES (?, ?, ?, ?, ?, 'bokad', ?, ?, ?, ?, ?)`).run(b.patient_id, tid.id, b.vardkontakt_id, b.vantelista_id, b.remiss_id, iso(), av, avInvanare, b.id, b.orsak).lastInsertRowid);
  db.query("UPDATE bokningar SET status = 'ombokad', andrad = ?, andrad_av = ?, andrad_av_invanare = ? WHERE id = ?").run(iso(), av, avInvanare, b.id);
  const schema = schemaRad(db, tid.schema_id);
  if (b.vardkontakt_id) {
    db.query('UPDATE vardkontakter SET start = ?, kontaktsatt = ?, plats = ?, andrad = ?, andrad_av = ? WHERE id = ?')
      .run(tid.start, TIDSTYPER[tid.tidstyp].kontaktsatt, plats(db, schema, tid.tidstyp), iso(), av, b.vardkontakt_id);
  }
  if (b.vantelista_id) {
    db.query('UPDATE vantelista SET bokning_id = ? WHERE id = ?').run(ny, b.vantelista_id);
    vlHandelse(db, b.vantelista_id, 'ombokad', { av, avInvanare, detalj: `Ny tid ${tidText(tid.start)}` });
  }
  const nyRad = bokningRad(db, ny);
  plan.reservera(db, ny, p.resurser, tid.start, tid.slut);
  if (p.fore && kedja?.roll === 'huvud') {
    const f = ombokaRad(db, bokningRad(db, kedja.foreId), p.fore, { av, avInvanare, kallelse: false, planera: false });
    plan.knytKedja(db, f.ny.id, ny, kedja.mall.id);
  }
  // Styr tiden en läkemedelsdos räknar systemet om den (vardhandelse.js).
  synkaVardhandelser(db, b.patient_id, { av });
  return { ny: nyRad, kallelse: kallelse ? skickaKallelse(db, nyRad, 'ombokning', { av }) : null };
}

export function omboka(atk, b, body = {}) {
  atk.krav('boka');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, b), `bokning:${b.id}`);
  kravInteFore(db, b);
  const tid = tidRad(db, body.tidId);
  kravLedigTid(db, tid, vardenhetFor(db, bokningensEnhet(db, b)));
  const gammal = tidRad(db, b.tid_id);
  if (tid.tidstyp !== gammal.tidstyp || schemaRad(db, tid.schema_id).yrkesroll !== schemaRad(db, gammal.schema_id).yrkesroll) throw new Fel(400, 'Välj en tid av samma typ hos samma yrkesroll. Systemet föreslår bara sådana.', 'ogiltig', { falt: ['tidId'] });
  const r = ombokaRad(db, b, tid, { av: atk.personal.id });
  atk.logga('boka', atk.grund(), `bokning:${b.id}:ombokad:${r.ny.id}`);
  return { ...bokningUt(db, r.ny, { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), kallelse: kallelseUt(r.kallelse, skydd(db, b.patient_id, atk.val?.visa_identitet)) };
}

// Avbokning. Den planerade vårdkontakten tas bort, eftersom besöket aldrig blev av, om inget har dokumenterats på den.
// Bokningen finns kvar som avbokad. En post på väntelistan öppnas igen, och när patienten själv avbokar skapar systemet
// en bevakning så att patienten får en ny tid.
// synk: false när den som anropar räknar om vårdhändelserna själv efteråt (efterAvvisning, runda 5 r4).
function avbokaRad(db, b, { av = null, avInvanare = null, orsak = null, synk = true, kallelse = true }) {
  b = bokningRad(db, b.id);
  // Runda 6, r4: tiden före i samma kedja avbokas med, och bara huvudbokningens besked berättar om den.
  const kedja = plan.kedjaFor(db, b.id);
  if (b.status !== 'bokad') throw new Fel(400, b.status === 'incheckad' ? 'Patienten har redan checkat in.' : 'Bokningen gäller inte längre.', 'ogiltig');
  db.query("UPDATE bokningar SET status = 'avbokad', andrad = ?, andrad_av = ?, andrad_av_invanare = ?, orsak = coalesce(?, orsak) WHERE id = ?").run(iso(), av, avInvanare, orsak, b.id);
  if (b.vardkontakt_id) {
    const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
    const dokumenterat = ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'remisser'].some(t => db.query(`SELECT 1 FROM ${t} WHERE vardkontakt_id = ?`).get(b.vardkontakt_id));
    if (v && !v.ankomst && !dokumenterat) db.query('DELETE FROM vardkontakter WHERE id = ?').run(b.vardkontakt_id);
  }
  const enhet = bokningensEnhet(db, b);
  if (b.vantelista_id) {
    db.query("UPDATE vantelista SET status = 'vantar', bokning_id = NULL WHERE id = ?").run(b.vantelista_id);
    vlHandelse(db, b.vantelista_id, 'avbokad', { av, avInvanare, detalj: avInvanare ? 'Patienten avbokade i Min journal. Patienten väntar på en ny tid.' : 'Tiden avbokades. Patienten väntar på en ny tid.' });
  }
  if (avInvanare) {
    db.query('INSERT INTO bevakningar (patient_id, enhet_id, text, forfaller, vantelista_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, NULL)')
      .run(b.patient_id, vardenhetFor(db, enhet), 'Patienten avbokade sin tid i Min journal. Erbjud en ny tid.', idag(), b.vantelista_id ?? null, iso());
  }
  // En läkemedelsdos som väntade på tiden går tillbaka till att vänta på vårdhändelsen (vardhandelse.js).
  const fore = kedja?.roll === 'huvud' ? bokningRad(db, kedja.foreId) : null;
  if (fore?.status === 'bokad') avbokaRad(db, fore, { av, avInvanare, orsak, synk: false, kallelse: false });
  if (synk) synkaVardhandelser(db, b.patient_id, { av });
  return kallelse ? skickaKallelse(db, bokningRad(db, b.id), 'avbokning', { av, tillagg: { foreAvbokad: Boolean(fore) } }) : null;
}

export function avboka(atk, b, body = {}) {
  atk.krav('boka');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, b), `bokning:${b.id}`);
  kravInteFore(db, b);
  const orsak = typeof body.orsak === 'string' ? body.orsak.trim().slice(0, 120) : '';
  if (orsak.length < 2) throw new Fel(400, 'Ange orsaken till avbokningen.', 'ogiltig', { falt: ['orsak'] });
  const k = avbokaRad(db, b, { av: atk.personal.id, orsak });
  atk.logga('boka', atk.grund(), `bokning:${b.id}:avbokad`);
  return { ...bokningUt(db, bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), kallelse: kallelseUt(k, skydd(db, b.patient_id, atk.val?.visa_identitet)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Incheckning och betalning

// Incheckningen registrerar ankomsten på den planerade vårdkontakten, ger ett konummer och räknar avgiften. Är avgiften
// noll (avgiftsfritt eller frikort) registrerar systemet det själv.
export function checkaInRad(db, b, via, { av = null, avInvanare = null } = {}) {
  if (b.status === 'incheckad') throw new Fel(400, 'Patienten är redan incheckad.', 'ogiltig');
  if (b.status !== 'bokad') throw new Fel(400, 'Bokningen gäller inte längre.', 'ogiltig');
  const tid = tidRad(db, b.tid_id);
  if (!TIDSTYPER[tid.tidstyp].fysisk) throw new Fel(400, `En ${TIDSTYPER[tid.tidstyp].text.toLowerCase()} checkas inte in. Vårdgivaren tar kontakt med patienten.`, 'ogiltig');
  if (datumAv(new Date(tid.start)) !== idag()) throw new Fel(400, `Tiden är ${tidText(tid.start)}. Incheckningen öppnar samma dag.`, 'ogiltig');
  const t = iso();
  db.query("UPDATE bokningar SET status = 'incheckad', incheckad = ?, incheckad_via = ?, konummer = ? WHERE id = ?").run(t, via, konummerFor(db, tid, t), b.id);
  if (b.vardkontakt_id) db.query('UPDATE vardkontakter SET ankomst = ?, andrad = ?, andrad_av = ? WHERE id = ? AND ankomst IS NULL').run(t, t, av, b.vardkontakt_id);
  const ut = bokningRad(db, b.id);
  const a = avgiftForBokning(db, ut);
  if (a && a.belopp === 0) registreraBetalning(db, ut, a, a.satt, { av, avInvanare });
  return ut;
}

// Avgiften för bokningen, med samma demoregler som vårdkontakten. satt är frikort när högkostnadsskyddet är nått och
// avgiftsfri när patienten inte betalar av andra skäl.
export function avgiftForBokning(db, b) {
  if (!b.vardkontakt_id) return null;
  const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
  if (!v) return null;
  const a = avgiftFor(db, patientRad(db, b.patient_id), v);
  if (!a) return null;
  // Runda 7, r3: avgiften säger bara att frikort gäller, som e-frikortet.
  const frikort = Boolean(a.frikort);
  return { ...a, satt: a.belopp === 0 ? (frikort ? 'frikort' : 'avgiftsfri') : null, frikort };
}

const BETALSATT = { kort: 'Kort', faktura: 'Faktura', frikort: 'Frikort', avgiftsfri: 'Avgiftsfritt' };
function registreraBetalning(db, b, a, satt, { av = null, avInvanare = null } = {}) {
  const nr = db.query('SELECT count(*) AS n FROM betalningar').get().n + 1;
  const kvitto = `VK-DEMO-${String(nr).padStart(5, '0')}`;
  const text = satt === 'frikort' ? (a.frikortTill ? `Frikort gäller till och med ${a.frikortTill}.` : 'Frikort.') : satt === 'avgiftsfri' ? 'Avgiftsfritt.' : satt === 'kort' ? 'Kortbetalning, simulerad. Inga pengar dras.' : 'Faktura, simulerad. Ingen faktura skickas.';
  db.query('INSERT INTO betalningar (bokning_id, patient_id, belopp, satt, tid, av, av_invanare, kvitto, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.id, b.patient_id, a.belopp, satt, iso(), av, avInvanare, kvitto, text);
}

export function checkaIn(atk, b) {
  atk.krav('checka_in');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, b), `bokning:${b.id}`);
  const ut = checkaInRad(db, b, 'personal', { av: atk.personal.id });
  atk.logga('checka_in', atk.grund(), `bokning:${b.id}:incheckad`);
  return bokningUt(db, ut, { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet });
}

function betalaRad(db, b, satt, ctx) {
  if (b.status !== 'incheckad') throw new Fel(400, 'Avgiften betalas när patienten har checkat in.', 'ogiltig');
  if (db.query('SELECT 1 FROM betalningar WHERE bokning_id = ?').get(b.id)) throw new Fel(400, 'Avgiften är redan betald.', 'ogiltig');
  const a = avgiftForBokning(db, b);
  if (!a || a.belopp === 0) throw new Fel(400, 'Det finns ingen avgift att betala.', 'ogiltig');
  if (!['kort', 'faktura'].includes(satt)) throw new Fel(400, 'Välj kort eller faktura.', 'ogiltig', { falt: ['satt'] });
  registreraBetalning(db, b, a, satt, ctx);
}

export function betala(atk, b, body = {}) {
  atk.krav('checka_in');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, b), `bokning:${b.id}`);
  betalaRad(db, b, body.satt, { av: atk.personal.id });
  atk.logga('checka_in', atk.grund(), `bokning:${b.id}:betald:${body.satt}`);
  return bokningUt(db, bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet });
}

// Incheckningsskärmen i väntrummet (simulerad). Patienten skriver sitt personnummer. Skärmen visar aldrig namn, bara
// tid, mottagning, konummer och avgift, och samma text när numret inte finns som när patienten inte har någon tid, så
// att skärmen inte avslöjar vem som är patient. Incheckningen loggas på patienten.
export function skarmIncheckning(db, personal, text, { far = () => true } = {}) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const ingen = { ok: false, text: 'Vi hittar ingen tid att checka in på just nu. Gå till receptionen, så hjälper vi dig.' };
  const t = identitet.tolka(String(text ?? '').slice(0, 40));
  if (!t.ok) return { ok: false, text: t.arIdentitet ? t.fel : 'Skriv ditt personnummer med tolv siffror.' };
  const h = identitet.hittaPaIdentitet(db, t);
  if (!h || !far(h.patientId)) return ingen;
  const nu = Date.now();
  const b = db.query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = ? AND b.status IN ('bokad', 'incheckad') ORDER BY t.start").all(h.patientId)
    .find(x => {
      const tid = tidRad(db, x.tid_id);
      const s = Date.parse(tid.start);
      return tidensVardenhet(db, tid) === ve && TIDSTYPER[tid.tidstyp].fysisk && s - DEMOREGLER.incheckningForeMin * MIN <= nu && nu <= s + DEMOREGLER.incheckningEfterMin * MIN;
    });
  if (!b) return ingen;
  const tid = tidRad(db, b.tid_id);
  const ut = b.status === 'incheckad' ? b : checkaInRad(db, b, 'skarm', { av: personal.id });
  // Skärmen säger samma sak om avgiften till alla, så att ingen som skriver ett personnummer kan utläsa frikort eller
  // avgiftsfrihet. Avgiften visas för patienten i Min journal och för vårdadministratören.
  return {
    ok: true, redan: b.status === 'incheckad', konummer: ut.konummer, tid: tid.start, mottagning: enhetKort(db, schemaRad(db, tid.schema_id).enhet_id)?.namn,
    text: `Du är incheckad till klockan ${klockText(tid.start)}. Sätt dig i väntrummet. Vi ropar upp dig med nummer ${ut.konummer}. Har du en avgift betalar du den i Min journal eller i receptionen.`,
    patientId: h.patientId, bokningId: b.id,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Kallelser och påminnelser

export function minJournalFor(db, p) {
  const egen = db.query('SELECT * FROM invanare WHERE patient_id = ?').get(p.id);
  if (egen && provaInvanare(db, { invanare: egen, patient: p }).tillaten) return { mottagare: 'Min journal', vardnadshavare: false };
  const vh = db.query('SELECT i.* FROM vardnadshavare v JOIN invanare i ON i.id = v.invanare_id WHERE v.barn_id = ?').all(p.id)
    .find(i => provaInvanare(db, { invanare: i, patient: p }).tillaten);
  return vh ? { mottagare: 'Min journal, vårdnadshavare', vardnadshavare: true } : null;
}

// Kanalen väljs av systemet. Skyddade personuppgifter: bara Min journal, aldrig brev eller sms, och systemet säger
// varför. Annars patientens eget val om det går, sedan Min journal, sms och brev i den ordningen.
export function kanalFor(db, p, { typ = 'kallelse' } = {}) {
  const mj = minJournalFor(db, p);
  if (p.skyddad) {
    if (mj) return { kanal: 'min_journal', mottagare: mj.mottagare, forklaring: 'Patienten har skyddade personuppgifter. Kallelsen skickas därför bara till Min journal, aldrig med brev eller sms, så att ingen adress eller något telefonnummer används.' };
    return { kanal: null, forklaring: 'Patienten har skyddade personuppgifter och kan inte nås i Min journal. Kallelsen kan inte skickas med brev eller sms. Ge patienten tiden muntligt.' };
  }
  const val = db.query('SELECT kanal FROM kanalval WHERE patient_id = ?').get(p.id)?.kanal;
  const sms = p.telefon ? { kanal: 'sms', mottagare: p.telefon } : null;
  const brev = p.adress ? { kanal: 'brev', mottagare: `${p.adress}, ${p.postnr ?? ''} ${p.ort ?? ''}`.trim() } : null;
  const minj = mj ? { kanal: 'min_journal', mottagare: mj.mottagare } : null;
  // Ett brev hinner inte fram som påminnelse, så påminnelsen går med sms eller till Min journal.
  const ordning = typ === 'paminnelse' ? [val === 'sms' ? sms : null, minj, sms] : [{ sms, brev, min_journal: minj }[val] ?? null, minj, sms, brev];
  const k = ordning.find(Boolean);
  if (k) return { ...k, forklaring: val && k.kanal === val ? `Patienten vill få ${typ === 'paminnelse' ? 'påminnelser' : 'kallelser'} med ${KANAL[val].toLowerCase()}.` : null };
  return { kanal: null, forklaring: 'Det finns varken Min journal, telefonnummer eller adress för patienten. Ge patienten tiden muntligt eller per telefon.' };
}

const FORBEREDELSER = {
  nybesok: 'Ta med en lista över de läkemedel du tar. Kom gärna tio minuter före tiden.',
  aterbesok: 'Ta med en lista över de läkemedel du tar. Kom gärna tio minuter före tiden.',
  telefon: 'Vi ringer dig på tiden. Se till att du kan prata ostört.',
  video: 'Logga in i Min journal fem minuter före tiden. Där finns länken till videobesöket.',
  grupp: 'Träffen är i grupp och tar ungefär två timmar. Ta gärna med en anhörig.',
  // Runda 6, r4.
  ingrepp: 'Kom en halvtimme före tiden.',
  provtagning: 'Kom fem minuter före tiden.',
  // Runda 8, r3.
  team: 'Du träffar flera vårdgivare vid samma besök. Kom gärna tio minuter före tiden.',
};
// Runda 8, r3: vårdgivarna i ett teambesök, till exempel "läkare Sara Lindqvist och sjuksköterska Lina Persson".
export function teamVem(db, bokningId) {
  const rader = db.query('SELECT d.personal_id, s.yrkesroll, p.namn, p.yrke FROM teambesok_deltagare d JOIN personal p ON p.id = d.personal_id LEFT JOIN scheman s ON s.personal_id = d.personal_id WHERE d.bokning_id = ? GROUP BY d.id ORDER BY d.id').all(bokningId);
  const delar = rader.map(r => `${YRKESROLL[r.yrkesroll ?? r.yrke] ?? ''} ${r.namn}`.trim());
  return delar.length > 1 ? `${delar.slice(0, -1).join(', ')} och ${delar.at(-1)}` : delar[0] ?? '';
}

// Kallelsen skrivs av systemet ur bokningen: tid, plats, vårdgivarens yrke, förberedelser och avgift. Den innehåller
// aldrig journaltext, diagnos eller remissens frågeställning, bara det en kallelse behöver.
export function kallelseText(db, b, typ = 'kallelse', tillagg = {}) {
  const tid = tidRad(db, b.tid_id);
  const schema = schemaRad(db, tid.schema_id);
  const tt = TIDSTYPER[tid.tidstyp];
  // Utan patient blir texten en mall, med en platshållare för namnet och avgiften.
  const p = b.patient_id ? patientRad(db, b.patient_id) : { fornamn: '(patientens förnamn)' };
  const mottagning = enhetRad(db, schema.enhet_id);
  const ve = enhetRad(db, vardenhetFor(db, schema.enhet_id));
  const ort = mottagning?.typ === 'arbetsplats' ? `${mottagning.namn}, ${ve?.namn ?? ''}` : mottagning?.namn ?? '';
  const vg = personRad(db, schema.personal_id);
  const a = avgiftForBokning(db, b);
  // Runda 6, r4: ingreppet, lokalen, sjukresan och tiden före i samma kedja, och patientens språk (planering-bas.js).
  const r4 = kallelseTillagg(db, b, tillagg);
  if (b.patient_id && plan.sprakFor(db, b.patient_id) === 'en') {
    return plan.kallelseEngelska(typ, {
      fornamn: p.fornamn, tidstyp: tid.tidstyp, yrkesroll: schema.yrkesroll, vardgivare: vg?.namn, rubrik: tid.rubrik, start: tid.start, ort, fysisk: tt.fysisk,
      avgift: a, vantelista: Boolean(b.vantelista_id), ingrepp: r4.ingrepp, lokal: r4.lokal, transport: r4.transport, fore: r4.fore ?? (r4.foreAvbokad ? {} : null),
    });
  }
  const avgift = !b.patient_id ? 'Avgift: systemet räknar avgiften för varje patient.' : !a ? '' : a.belopp === 0 ? 'Avgift: ingen avgift.' : `Avgift: ${a.belopp} kronor. Har du frikort betalar du inget. Avgifterna i demon är påhittade.`;
  const ttText = r4.ingrepp ? plan.INGREPP[r4.ingrepp].text : tt.text;
  const vem = tid.tidstyp === 'grupp' ? `${tid.rubrik ?? 'Gruppträff'}, ledd av ${YRKESROLL[schema.yrkesroll]} ${vg?.namn ?? ''}`
    // Runda 8, r3: ett teambesök med alla vårdgivarna.
    : tid.tidstyp === 'team' && b.id ? `Teambesök med ${teamVem(db, b.id)}`
      : `${ttText} hos ${YRKESROLL[schema.yrkesroll]} ${vg?.namn ?? ''}`;
  const andra = 'Kan du inte komma? Boka om eller avboka i Min journal senast 24 timmar före, eller ring mottagningen.';
  const incheck = tt.fysisk ? 'Checka in i Min journal eller på skärmen i väntrummet när du kommer.' : null;
  const plats = `${r4.lokal ? `${r4.lokal}, ` : ''}${tt.fysisk ? ort : `${tt.text}, ${ort}`}`;
  const forb = r4.ingrepp ? plan.INGREPP[r4.ingrepp].forberedelse : FORBEREDELSER[tid.tidstyp];
  const fore = r4.fore ? `Före besöket: ${TIDSTYPER[r4.fore.tidstyp].text.toLowerCase()} klockan ${klockText(r4.fore.start)}, ${r4.fore.ort}. Kom i tid, så att svaren hinner komma.` : null;
  const resa = r4.transport ? 'En sjukresa är bokad åt dig. Den är simulerad i demon.' : null;
  const rader = {
    kallelse: [`Hej ${p.fornamn},`, `Du har fått en tid. ${vem}.`, `Tid: ${tidText(tid.start)}.`, fore, `Plats: ${plats}.`, forb, resa, incheck, avgift, andra],
    ombokning: [`Hej ${p.fornamn},`, 'Din tid är ändrad. Den gamla tiden gäller inte längre.', `Ny tid: ${tidText(tid.start)}. ${vem}.`, fore, `Plats: ${plats}.`, forb, resa, incheck, avgift, andra],
    paminnelse: [`Påminnelse: du har en tid ${tidText(tid.start)}. ${vem}, ${ort}.`, fore, tt.fysisk ? incheck : forb, 'Kan du inte komma? Avboka i Min journal eller ring mottagningen.'],
    avbokning: [`Hej ${p.fornamn},`, `Din tid ${tidText(tid.start)} på ${ort} är avbokad.`, r4.foreAvbokad ? 'Provtagningen före besöket är också avbokad.' : null,
      b.vantelista_id ? 'Du står kvar i kön och får en ny tid.' : 'Vill du ha en ny tid? Boka i Min journal eller ring mottagningen.'],
  }[typ];
  return rader.filter(Boolean).join('\n');
}

// Runda 6, r4: det kallelsen ska säga om ingreppet, lokalen, sjukresan och tiden före. Exemplet utan bokning får inget.
function kallelseTillagg(db, b, tillagg = {}) {
  if (!b.id) return {};
  const ingrepp = plan.behovForPost(db, b.vantelista_id)?.ingrepp ?? null;
  const resurser = plan.resurserForBokning(db, b.id);
  const kedja = plan.kedjaFor(db, b.id);
  let fore = null;
  if (kedja?.roll === 'huvud') {
    const f = tidRad(db, bokningRad(db, kedja.foreId).tid_id);
    const m = enhetRad(db, schemaRad(db, f.schema_id).enhet_id);
    fore = { tidstyp: f.tidstyp, start: f.start, ort: m?.namn ?? '' };
  }
  return { ingrepp, lokal: resurser.find(r => r.typ === 'lokal')?.namn ?? null, transport: resurser.some(r => r.typ === 'transport'), fore, foreAvbokad: Boolean(tillagg.foreAvbokad) };
}

// Skickar en kallelse, en påminnelse eller ett besked om ändring. Sms och brev är simulerade, och det står i raden.
export function skickaKallelse(db, b, typ, { av = null, tid = iso(), kanal = null, tillagg = {} } = {}) {
  const p = patientRad(db, b.patient_id);
  const k = kanalFor(db, p, { typ });
  const valtKanal = kanal && !p.skyddad ? kanal : k.kanal;
  const mottagare = valtKanal === k.kanal ? k.mottagare : valtKanal === 'sms' ? p.telefon : valtKanal === 'brev' ? `${p.adress}, ${p.postnr} ${p.ort}` : 'Min journal';
  const text = kallelseText(db, b, typ, tillagg);
  const status = valtKanal ? 'skickad' : 'kan_inte';
  const forklaring = [k.forklaring, valtKanal && valtKanal !== 'min_journal' ? `${KANAL[valtKanal]} är simulerat i demon. Inget skickas.` : null].filter(Boolean).join(' ') || null;
  const id = Number(db.query(`INSERT INTO kallelser (bokning_id, patient_id, typ, kanal, mottagare, text, status, skapad, skickad, skapad_av, forklaring)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.id, b.patient_id, typ, valtKanal, valtKanal ? mottagare : null, text, status, tid, valtKanal ? tid : null, av, forklaring).lastInsertRowid);
  // Runda 6, r4: kallelsens språk sparas, så att personalen ser att den är skriven på patientens språk.
  const sprak = plan.sprakFor(db, b.patient_id);
  plan.sparaKallelsesprak(db, id, sprak);
  return { ...db.query('SELECT * FROM kallelser WHERE id = ?').get(id), sprak };
}

// En gruppträffs kallelser skrivs när platsen bokas men skickas när vårdadministratören bekräftar att träffen blir av.
export function forberedKallelse(db, b) {
  db.query("INSERT INTO kallelser (bokning_id, patient_id, typ, text, status, skapad) VALUES (?, ?, 'kallelse', ?, 'vantar', ?)").run(b.id, b.patient_id, kallelseText(db, b), iso());
}

// Skyddade personuppgifter i personalens svar: kallelsens text (med patientens förnamn) visas bara efter Visa identitet,
// och en adress eller ett telefonnummer i mottagaren visas aldrig, inte heller för en kallelse från innan patienten fick
// skyddad identitet.
export const skydd = (db, pid, visaIdentitet = false) => {
  const skyddad = Boolean(patientRad(db, pid)?.skyddad);
  return { skyddad, dold: skyddad && !visaIdentitet };
};
export const kallelseUt = (k, { skyddad = false, dold = false } = {}) => (k ? {
  id: k.id, typ: k.typ, kanal: k.kanal, kanalText: k.kanal ? KANAL[k.kanal] : null, simulerad: Boolean(k.kanal && k.kanal !== 'min_journal'),
  mottagare: skyddad && k.kanal !== 'min_journal' ? null : k.mottagare,
  text: dold ? null : k.text, textDold: dold ? 'Kallelsens text visas inte, eftersom patienten har skyddade personuppgifter.' : null,
  status: k.status, skapad: k.skapad, skickad: k.skickad, forklaring: k.forklaring, lasd: k.lasd ?? null,
  // Runda 6, r4: språket som kallelsen är skriven på.
  sprak: k.sprak ?? 'sv', sprakText: plan.SPRAK[k.sprak ?? 'sv'],
} : null);
// Kallelserna för en bokning, med språket.
const kallelserFor = (db, bokningId) => db.query('SELECT k.*, coalesce(s.sprak, \'sv\') AS sprak FROM kallelser k LEFT JOIN kallelse_sprak s ON s.kallelse_id = k.id WHERE k.bokning_id = ? ORDER BY k.skapad, k.id').all(bokningId);

// Påminnelserna går ut av sig själva 48 timmar före tiden. Demon har ingen schemalagd körning, så servern skickar dem
// när tidboken eller Min journal används.
export function skickaPaminnelser(db, nu = Date.now()) {
  // Runda 7, r4: timmarna kan ändras av systemförvaltningen (konfiguration.js). DEMOREGLER har standardvärdet.
  const grans = new Date(nu + konfiguration.varde(db, 'tidbok.paminnelse_timmar', new Date(nu)) * TIMME).toISOString();
  const rader = db.query(`SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.status = 'bokad' AND t.start > ? AND t.start <= ?
    AND NOT EXISTS (SELECT 1 FROM kallelser k WHERE k.bokning_id = b.id AND k.typ = 'paminnelse')
    AND EXISTS (SELECT 1 FROM kallelser k WHERE k.bokning_id = b.id AND k.status = 'skickad' AND k.skapad < ?)`).all(new Date(nu).toISOString(), grans, new Date(nu - TIMME).toISOString());
  for (const b of rader) skickaKallelse(db, b, 'paminnelse');
  return rader.length;
}

// Gruppkallelse: kallelser till alla deltagare på en gruppträff, eller till alla som har en tid hos en vårdgivare en
// dag. Varje patient prövas i behörighetsmotorn och loggas för sig. Den som redan har fått kallelsen hoppas över.
export function kallaGrupp(db, personal, tid, { valFor = () => ({}), Atkomst }) {
  const ve = vardenhetFor(db, personal.enhet_id);
  if (tidensVardenhet(db, tid) !== ve) throw new Fel(403, 'Det är en annan vårdenhets tidbok.', 'nekad');
  const bokningar = db.query("SELECT * FROM bokningar WHERE tid_id = ? AND status = 'bokad' ORDER BY id").all(tid.id);
  const ut = { skickade: [], hoppade: [] };
  for (const b of bokningar) {
    const atk = new Atkomst(db, personal, b.patient_id, valFor(b.patient_id), 'kalla');
    if (!atk.prova('kalla').tillaten) { atk.logga('kalla', 'nekad', `bokning:${b.id}:kallelse`, 'nekad'); ut.hoppade.push({ bokningId: b.id, skal: 'Ingen vårdrelation.' }); continue; }
    atk.krav('kalla');
    const vantar = db.query("SELECT * FROM kallelser WHERE bokning_id = ? AND typ = 'kallelse' AND status = 'vantar'").get(b.id);
    if (!vantar && db.query("SELECT 1 FROM kallelser WHERE bokning_id = ? AND typ = 'kallelse' AND status = 'skickad'").get(b.id)) { ut.hoppade.push({ bokningId: b.id, skal: 'Kallelsen är redan skickad.' }); continue; }
    if (vantar) db.query("UPDATE kallelser SET status = 'klar' WHERE id = ?").run(vantar.id);
    const k = skickaKallelse(db, b, 'kallelse', { av: personal.id });
    atk.logga('kalla', atk.grund(), `bokning:${b.id}:kallelse:${k.id}`);
    ut.skickade.push({ bokningId: b.id, patient: patientKort(patientRad(db, b.patient_id)), kallelse: kallelseUt(k, skydd(db, b.patient_id, valFor(b.patient_id).visa_identitet)) });
  }
  return { tid: tidUt(db, tid), ...ut };
}

// En kallelse som inte kunde skickas, till exempel till en patient med skyddade personuppgifter utan Min journal,
// markeras som lämnad när patienten har fått tiden på annat sätt.
export function kallelseKlar(atk, k) {
  atk.krav('kalla');
  const db = atk.db;
  kravEgenVardenhet(atk, bokningensEnhet(db, bokningRad(db, k.bokning_id)), `kallelse:${k.id}`);
  if (k.status !== 'kan_inte') throw new Fel(400, 'Kallelsen behöver ingen åtgärd.', 'ogiltig');
  db.query("UPDATE kallelser SET status = 'klar', skapad_av = coalesce(skapad_av, ?) WHERE id = ?").run(atk.personal.id, k.id);
  atk.logga('kalla', atk.grund(), `kallelse:${k.id}:lamnad`);
  return { ok: true };
}

export function bevakningKlar(atk, bev) {
  atk.krav('vantelista');
  const db = atk.db;
  kravEgenVardenhet(atk, bev.enhet_id, `bevakning:${bev.id}`);
  if (bev.klar) throw new Fel(400, 'Bevakningen är redan klar.', 'ogiltig');
  db.query('UPDATE bevakningar SET klar = ?, klar_av = ? WHERE id = ?').run(iso(), atk.personal.id, bev.id);
  atk.logga('vantelista', atk.grund(), `bevakning:${bev.id}:klar`);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Utdata

export function tidUt(db, tid) {
  const s = schemaRad(db, tid.schema_id);
  return {
    id: tid.id, start: tid.start, slut: tid.slut, tidstyp: tid.tidstyp, tidstypText: TIDSTYPER[tid.tidstyp]?.text, rubrik: tid.rubrik, platser: tid.platser,
    bokade: aktiva(db, tid.id), vardgivare: personKort(db, s.personal_id), yrkesroll: s.yrkesroll, mottagning: enhetKort(db, s.enhet_id), schemaId: s.id,
  };
}

const STATUSTEXT = { bokad: 'Bokad', incheckad: 'Incheckad', ombokad: 'Ombokad', avbokad: 'Avbokad' };
// Bokningen för personalen. Statusen följer vårdkontakten: har ankomsten registrerats där räknas patienten som incheckad.
export function bokningUt(db, b, { personal = null, visaIdentitet = false } = {}) {
  const tid = tidRad(db, b.tid_id);
  const p = patientRad(db, b.patient_id);
  const v = b.vardkontakt_id ? db.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id) : null;
  const incheckad = b.status === 'incheckad' || (b.status === 'bokad' && v?.ankomst);
  const status = incheckad ? 'incheckad' : b.status;
  const betalning = db.query('SELECT * FROM betalningar WHERE bokning_id = ?').get(b.id);
  const kallelser = kallelserFor(db, b.id);
  const ut = {
    id: b.id, status, statusText: STATUSTEXT[status], tid: tidUt(db, tid), patient: patientKort(p),
    orsak: b.orsak, vardkontaktId: b.vardkontakt_id, vantelistaId: b.vantelista_id, remissId: b.remiss_id, ersatterId: b.ersatter_id,
    bokad: b.bokad, bokadAv: personKort(db, b.bokad_av), bokadAvPatienten: Boolean(b.bokad_av_invanare),
    andrad: b.andrad, andradAv: personKort(db, b.andrad_av), andradAvPatienten: Boolean(b.andrad_av_invanare),
    incheckad: b.incheckad ?? (incheckad ? v.ankomst : null), incheckadVia: b.incheckad_via ?? (incheckad ? 'registrerad' : null), konummer: b.konummer, bekraftad: b.bekraftad,
    betalning: betalning ? { belopp: betalning.belopp, satt: betalning.satt, sattText: BETALSATT[betalning.satt], tid: betalning.tid, kvitto: betalning.kvitto, text: betalning.text } : null,
    kallelser: kallelser.map(k => kallelseUt(k, skydd(db, b.patient_id, visaIdentitet))),
    // Planerad vårdhändelse: att tiden styr en läkemedelsdos, aldrig vilket läkemedel (vardhandelse.js).
    styrLakemedel: styrDos(db, { bokningRad: b }) ? STYR_LAKEMEDEL : null,
    // Runda 6, r4: resurserna och tiderna i följd.
    resurser: plan.resurserForBokning(db, b.id), ingrepp: ingreppFor(db, b), kedja: kedjaUt(db, b),
  };
  if (personal && kanRoll(personal, 'checka_in')) {
    const a = avgiftForBokning(db, b);
    if (a) ut.avgift = { belopp: a.belopp, text: a.text, demoregler: true };
  }
  return ut;
}

// Runda 6, r4: ingreppet för en bokning, och tiderna i följd: tiden före för huvudbokningen och huvudbokningen för tiden
// före. Bara tid och tidstyp, inget om patienten.
function ingreppFor(db, b) {
  const i = plan.behovForPost(db, b.vantelista_id)?.ingrepp;
  return i ? { id: i, text: plan.INGREPP[i].text } : null;
}
function kedjaUt(db, b) {
  const k = plan.kedjaFor(db, b.id);
  if (!k) return null;
  const annan = bokningRad(db, k.roll === 'huvud' ? k.foreId : k.huvudId);
  return { roll: k.roll, mall: k.mall ? { id: k.mall.id, namn: k.mall.namn } : null, [k.roll === 'huvud' ? 'fore' : 'huvud']: { id: annan.id, status: annan.status, tid: tidUt(db, tidRad(db, annan.tid_id)) } };
}

// Bokningarna för en patient i journalen. Andra vårdenheters bokningar kräver aktivt val, som vårdkontakterna.
export function patientensBokningar(atk) {
  const db = atk.db;
  atk.krav('las_admin');
  const rader = db.query('SELECT * FROM bokningar WHERE patient_id = ? ORDER BY id').all(atk.patientId)
    .map(b => ({ ...b, enhet_id: bokningensEnhet(db, b) }));
  const synliga = atk.filtrera(rader, 'las_admin');
  const nu = Date.now();
  const ut = synliga.map(b => bokningUt(db, b, { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }));
  const kommande = ut.filter(b => ['bokad', 'incheckad'].includes(b.status) && (Date.parse(b.tid.slut) >= nu - 12 * TIMME)).sort((a, b) => a.tid.start.localeCompare(b.tid.start));
  const tidigare = ut.filter(b => !kommande.includes(b)).sort((a, b) => b.tid.start.localeCompare(a.tid.start)).slice(0, 10);
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const poster = kanRoll(atk.personal, 'boka') ? db.query("SELECT * FROM vantelista WHERE patient_id = ? AND enhet_id = ? AND status = 'vantar'").all(atk.patientId, ve).map(v => vantelistaUt(db, v)) : [];
  return {
    kommande: kommande.map(b => ({ ...b, kanOmbokas: kanRoll(atk.personal, 'boka') && b.status === 'bokad' && !['grupp', 'team'].includes(b.tid.tidstyp) && b.kedja?.roll !== 'fore' && vardenhetFor(db, b.tid.mottagning.id) === ve })),
    tidigare, vantelista: poster, dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}

// Startsidan för vårdadministratören: dagens arbete i ordning. Varje rad har en enda nästa åtgärd. Patientlistorna är
// begränsade till patienter med vårdrelation på den egna vårdenheten, och skyddad identitet maskeras som i arbetslistan.
// Runda 6, r4: perioden är fritt vald (fran och till, högst 31 dagar), och patienterna en annan dag än i dag visas utan
// åtgärd. Egna bevakningar som är den inloggades eller vårdenhetens visas med de andra bevakningarna.
export function startsida(db, personal, { fran = idag(), till = fran } = {}) {
  skickaPaminnelser(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const nu = Date.now();
  const dag = idag();
  const dagStart = lokalTid(fran, '00:00');
  const dagSlut = new Date(Math.max(Date.parse(lokalTid(addDagar(till, 1), '00:00')), till === dag ? nu + 3 * TIMME : 0)).toISOString();
  const relation = (pid) => harVardrelation(db, pid, ve);
  const dagens = db.query(`SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE s.enhet_id IN (${ph}) AND b.status IN ('bokad', 'incheckad') AND t.start >= ? AND t.start < ? ORDER BY t.start, b.id`).all(...enheter, dagStart, dagSlut)
    .filter(b => relation(b.patient_id)).map(b => {
      const u = bokningUt(db, b, { personal });
      const s = Date.parse(u.tid.start);
      const fysisk = TIDSTYPER[u.tid.tidstyp].fysisk;
      const datum = datumAv(new Date(u.tid.start));
      let status;
      let atgard = null;
      if (datum !== dag) {
        status = datum < dag ? u.statusText : fysisk ? 'Bokad' : `${u.tid.tidstypText}, ${YRKESROLL[u.tid.yrkesroll]} tar kontakt`;
        return { ...u, datum, rad: { status, atgard: null, sen: false } };
      }
      if (u.status === 'incheckad') {
        const att = u.avgift?.belopp && !u.betalning;
        status = `Incheckad ${klockText(u.incheckad)}${u.konummer ? `, nummer ${u.konummer}` : ''}${u.betalning ? `. ${u.betalning.sattText}${u.betalning.belopp ? ` ${u.betalning.belopp} kr` : ''}` : att ? `. Att betala ${u.avgift.belopp} kr` : ''}`;
        if (att) atgard = { typ: 'betala', text: 'Ta betalt' };
      } else if (!fysisk) {
        status = `${u.tid.tidstypText}, ${YRKESROLL[u.tid.yrkesroll]} tar kontakt`;
      } else {
        const sen = Math.round((nu - s) / MIN);
        status = sen > 5 ? `Har inte kommit, ${sen} minuter sen` : 'Väntas';
        atgard = { typ: 'checka_in', text: 'Checka in' };
      }
      return { ...u, datum, rad: { status, atgard, sen: u.status !== 'incheckad' && fysisk && nu - s > 5 * MIN } };
    });
  const poster = vantelista(db, personal);
  const remisser = poster.filter(p => p.remiss).map(p => ({ ...p, atgard: { typ: 'boka', text: 'Boka tid' } }));
  const ovriga = poster.filter(p => !p.remiss).map(p => ({ ...p, atgard: { typ: 'boka', text: 'Boka tid' } }));
  // Kallelser som behöver gå ut: gruppträffar som väntar på bekräftelse och kallelser som systemet inte kunde skicka.
  const grupper = db.query(`SELECT DISTINCT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id JOIN bokningar b ON b.tid_id = t.id JOIN kallelser k ON k.bokning_id = b.id
    WHERE s.enhet_id IN (${ph}) AND k.status = 'vantar' AND b.status = 'bokad' AND t.start > ? ORDER BY t.start`).all(...enheter, new Date(nu).toISOString()).map(t => {
    const deltagare = db.query("SELECT b.patient_id FROM bokningar b JOIN kallelser k ON k.bokning_id = b.id WHERE b.tid_id = ? AND b.status = 'bokad' AND k.status = 'vantar'").all(t.id);
    // Exemplet skrivs ur mallen för tiden, utan patient, och aldrig ur en sparad kallelse.
    const exempel = kallelseText(db, { tid_id: t.id, patient_id: null, vantelista_id: null, vardkontakt_id: null }, 'kallelse');
    return { typ: 'grupp', tid: tidUt(db, t), exempel, antal: deltagare.filter(d => relation(d.patient_id)).length, text: `${t.rubrik ?? 'Gruppträff'} ${tidText(t.start)}. Systemet har skrivit kallelserna. Skicka dem när det är bestämt att träffen blir av.`, atgard: { typ: 'kalla_grupp', text: 'Skicka kallelser' } };
  }).filter(g => g.antal > 0);
  const kanInte = db.query(`SELECT k.* FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE s.enhet_id IN (${ph}) AND k.status = 'kan_inte' AND b.status = 'bokad' ORDER BY t.start`).all(...enheter).filter(k => relation(k.patient_id)).map(k => {
    const b = bokningRad(db, k.bokning_id);
    return { typ: 'kan_inte', kallelseId: k.id, bokningId: b.id, patient: patientKort(patientRad(db, k.patient_id)), tid: tidUt(db, tidRad(db, b.tid_id)), text: k.forklaring, atgard: { typ: 'kallelse_klar', text: 'Patienten har fått tiden' } };
  });
  const bevakningar = db.query('SELECT * FROM bevakningar WHERE enhet_id = ? AND klar IS NULL AND forfaller <= ? ORDER BY forfaller, id').all(ve, till)
    .filter(b => relation(b.patient_id)).map(b => {
      const post = b.vantelista_id ? db.query("SELECT * FROM vantelista WHERE id = ? AND status = 'vantar'").get(b.vantelista_id) : null;
      return {
        id: b.id, patient: patientKort(patientRad(db, b.patient_id)), text: b.text, forfaller: b.forfaller, skapad: b.skapad, skapadAv: personKort(db, b.skapad_av), avSystemet: !b.skapad_av,
        vantelistaId: post?.id ?? null, atgard: post ? { typ: 'boka', text: 'Boka tid', vantelistaId: post.id } : { typ: 'bevakning_klar', text: 'Klar' },
      };
    });
  // Runda 6, r4: egna bevakningar, den inloggades och vårdenhetens. En bevakning om en patient visas bara när vårdenheten
  // har vårdrelation till patienten.
  const egna = plan.egnaBevakningar(db, personal, till).filter(b => !b.patient_id || relation(b.patient_id)).map(b => egenBevakningUt(db, b));
  // Kallelser utan förbokad tid där patienten inte har valt tid och ramen snart går ut.
  const ramer = db.query("SELECT r.* FROM kallelser_ram r WHERE r.enhet_id = ? AND r.status = 'skickad' AND r.till <= ? ORDER BY r.till").all(ve, addDagar(dag, 3))
    .filter(r => relation(r.patient_id)).map(r => ({ typ: 'ram', vantelistaId: r.vantelista_id, patient: patientKort(patientRad(db, r.patient_id)),
      text: `Patienten har inte valt någon tid. Ramen går ut ${r.till}.`, atgard: { typ: 'boka', text: 'Boka tid' } }));
  return {
    vardenhet: enhetKort(db, ve), datum: dag, demoregler: DEMOREGLER.text, period: { fran, till },
    dagens, remisser, vantelista: ovriga, kallelser: [...grupper, ...kanInte, ...ramer], bevakningar: [...bevakningar, ...egna],
    antal: { dagens: dagens.length, kvarAttCheckaIn: dagens.filter(d => d.rad.atgard?.typ === 'checka_in').length, remisser: remisser.length, vantelista: ovriga.length, kallelser: grupper.length + kanInte.length + ramer.length, bevakningar: bevakningar.length + egna.length },
  };
}

// Runda 6, r4: en egen bevakning för Dagens arbete och inkorgen. Patienten maskeras som i listorna.
export function egenBevakningUt(db, b) {
  return {
    id: b.id, egen: true, patient: b.patient_id ? patientKort(patientRad(db, b.patient_id)) : null, text: b.text, datum: b.datum, forfaller: b.datum,
    enhetsniva: !b.ansvarig_id, ansvarig: personKort(db, b.ansvarig_id), skapad: b.skapad, skapadAv: personKort(db, b.skapad_av), avSystemet: false,
    atgard: { typ: 'egen_bevakning_klar', text: 'Klar' },
  };
}

// Tidboken per mottagning och vårdgivare en dag. Med avidentifierad visas inga patientuppgifter, till exempel på en
// skärm som andra kan se.
// Runda 6, r4: vy är användarens val av vårdgivare ('alla', 'mina' eller en lista med scheman) och om resursernas
// arbetslista visas (planering.js sparar valet). Läkare och sjuksköterskor läser tidboken men bokar inte.
export function tidbok(db, personal, { datum = idag(), avidentifierad = false, vy = { vardgivare: 'alla', resurser: true } } = {}) {
  skickaPaminnelser(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const fran = lokalTid(datum, '00:00');
  const till = lokalTid(addDagar(datum, 1), '00:00');
  const allaScheman = db.query(`SELECT * FROM scheman WHERE enhet_id IN (${ph}) ORDER BY yrkesroll, id`).all(...enheter);
  const scheman = allaScheman.filter(s => vy.vardgivare === 'alla' || (vy.vardgivare === 'mina' ? s.personal_id === personal.id : vy.vardgivare.includes(s.id)));
  return {
    vardenhet: enhetKort(db, ve), datum, avidentifierad, vy,
    resurser: vy.resurser ? resursLista(db, ve, fran, till, { avidentifierad, personal }) : [],
    mallar: mallarFor(db, ve),
    regler: db.query('SELECT tidstyp, egenbokning FROM tidboksregler WHERE enhet_id = ?').all(ve).map(r => ({ tidstyp: r.tidstyp, text: TIDSTYPER[r.tidstyp]?.text, egenbokning: Boolean(r.egenbokning) })),
    scheman: scheman.map(s => {
      const tider = db.query('SELECT * FROM tider WHERE schema_id = ? AND start >= ? AND start < ? ORDER BY start').all(s.id, fran, till).map(t => ({
        ...tidUt(db, t),
        // Avidentifierat visas bara att tiden är upptagen (antalet bokade i tidUt), inget om patienten eller kontakten.
        // Annars bara bokningar för patienter med vårdrelation på vårdenheten.
        bokningar: avidentifierad ? [] : db.query("SELECT * FROM bokningar WHERE tid_id = ? AND status IN ('bokad', 'incheckad') ORDER BY id").all(t.id)
          .filter(b => harVardrelation(db, b.patient_id, ve)).map(b => bokningUt(db, b, { personal })),
      }));
      return { id: s.id, vardgivare: personKort(db, s.personal_id), yrkesroll: s.yrkesroll, yrkesrollText: YRKESROLL[s.yrkesroll], mottagning: enhetKort(db, s.enhet_id),
        tider, belaggning: { tider: tider.length, bokade: tider.filter(t => t.bokade >= t.platser).length } };
    }),
  };
}

// Runda 6, r4: resursernas arbetslista för en dag, till exempel för defibrillatorn. Avidentifierat visas bara att
// resursen är upptagen, och annars bara patienter med vårdrelation på vårdenheten.
function resursLista(db, ve, fran, till, { avidentifierad, personal }) {
  const enheter = enheterUnder(db, ve);
  return db.query(`SELECT * FROM resurser WHERE enhet_id IN (${enheter.map(() => '?').join(', ')}) AND aktiv = 1 ORDER BY kategori, id`).all(...enheter).map(r => {
    const rader = db.query(`SELECT rb.*, b.patient_id, b.tid_id, b.vantelista_id, b.status FROM resursbokningar rb LEFT JOIN bokningar b ON b.id = rb.bokning_id
      WHERE rb.resurs_id = ? AND rb.start < ? AND rb.slut > ? AND (rb.bokning_id IS NULL OR b.status IN ('bokad', 'incheckad')) ORDER BY rb.start`).all(r.id, till, fran);
    return {
      ...plan.resursKort(r), typText: plan.RESURSTYP[plan.KATEGORIER[r.kategori]?.typ] ?? null,
      bokningar: rader.map(x => {
        if (!x.bokning_id) return { start: x.start, slut: x.slut, text: x.text ?? 'Upptagen', patient: null };
        if (avidentifierad) return { start: x.start, slut: x.slut, text: 'Upptagen', patient: null };
        const t = tidRad(db, x.tid_id);
        const i = plan.behovForPost(db, x.vantelista_id)?.ingrepp;
        const p = harVardrelation(db, x.patient_id, ve) ? patientKort(patientRad(db, x.patient_id)) : null;
        return { start: x.start, slut: x.slut, text: i ? plan.INGREPP[i].text : TIDSTYPER[t.tidstyp].text, patient: p, bokningId: p ? x.bokning_id : null };
      }),
    };
  });
}

// Runda 6, r4: vårdenhetens bokningsmallar: ingreppen med det de kräver, och mallarna med tider i följd.
export function mallarFor(db, ve) {
  const v = vardenhetFor(db, ve);
  const ingrepp = Object.entries(plan.INGREPP).filter(([id]) => plan.kravSaknas(db, v, id) === null).map(([id, i]) => ({
    id, typ: 'ingrepp', namn: i.text, text: i.text, tidstyp: i.tidstyp, tidstypText: TIDSTYPER[i.tidstyp].text, yrkesroll: i.yrkesroll, yrkesrollText: YRKESROLL[i.yrkesroll],
    krav: i.krav.map(k => plan.KATEGORIER[k].text), forklaring: `Systemet bokar läkaren, ${i.krav.map(k => plan.KATEGORIER[k].text.toLowerCase()).join(' och ')} samtidigt och föreslår bara tider då allt är ledigt.`,
  }));
  const mallar = Object.entries(plan.MALLAR).filter(([, m]) => m.enhet === v).map(([id, m]) => ({
    id, typ: 'kedja', namn: m.namn, tidstyper: m.tidstyper.map(t => TIDSTYPER[t].text), fore: { tidstypText: TIDSTYPER[m.fore.tidstyp].text, yrkesrollText: YRKESROLL[m.fore.yrkesroll], minMin: m.fore.minMin, maxMin: m.fore.maxMin },
    forklaring: m.forklaring,
  }));
  return [...ingrepp, ...mallar];
}

// ---------------------------------------------------------------------------------------------------------------
// Min journal: patientens egna tider

// Tidstyper som mottagningen öppnar för egenbokning (demoregler i seeden).
// Bara återbesök, telefon och video (EGENBOKNING_TIDSTYPER), aldrig nybesök eller gruppträff.
const egenbokningOppen = (db, ve, tidstyp) => EGENBOKNING_TIDSTYPER.includes(tidstyp) && Boolean(db.query('SELECT egenbokning FROM tidboksregler WHERE enhet_id = ? AND tidstyp = ?').get(ve, tidstyp)?.egenbokning);

export function minBokningUt(db, b, nu = Date.now()) {
  const tid = tidRad(db, b.tid_id);
  const s = schemaRad(db, tid.schema_id);
  const ve = vardenhetFor(db, s.enhet_id);
  const v = b.vardkontakt_id ? db.query('SELECT ankomst FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id) : null;
  const incheckad = b.status === 'incheckad' || (b.status === 'bokad' && v?.ankomst);
  const start = Date.parse(tid.start);
  const oppen = egenbokningOppen(db, ve, tid.tidstyp);
  const fore = start - nu >= DEMOREGLER.egenGransTimmar * TIMME;
  const fysisk = TIDSTYPER[tid.tidstyp].fysisk;
  const kanCheckaIn = b.status === 'bokad' && !incheckad && fysisk && start - DEMOREGLER.incheckningForeMin * MIN <= nu && nu <= start + DEMOREGLER.incheckningEfterMin * MIN;
  const a = avgiftForBokning(db, b);
  const betalning = db.query('SELECT * FROM betalningar WHERE bokning_id = ?').get(b.id);
  // En tid som styr när en läkemedelsdos ska ges bokar mottagningen om, så att dosen följer med (vardhandelse.js).
  const styr = b.status === 'bokad' && styrDos(db, { bokningRad: b });
  // Runda 6, r4: en tid före ett besök, till exempel provtagningen, flyttas med besöket.
  const kedja = kedjaUt(db, b);
  const arFore = kedja?.roll === 'fore';
  const andras = b.status !== 'bokad' || incheckad ? null : arFore ? 'Tiden hör till ditt besök senare samma dag och flyttas med det.' : !oppen ? 'Mottagningen bokar om den här typen av tid själv. Ring mottagningen om du behöver ändra tiden.'
    : styr ? 'Tiden hänger ihop med din behandling. Ring mottagningen om du behöver ändra den.'
      : !fore ? 'Det är mindre än 24 timmar kvar. Ring mottagningen om du behöver ändra tiden.' : null;
  return {
    id: b.id, status: incheckad ? 'incheckad' : b.status, tidstyp: tid.tidstyp, tidstypText: TIDSTYPER[tid.tidstyp].text, rubrik: tid.rubrik, start: tid.start, slut: tid.slut,
    mottagning: enhetKort(db, s.enhet_id)?.namn, vardenhet: enhetKort(db, ve)?.namn, yrkesroll: YRKESROLL[s.yrkesroll], vardgivare: personRad(db, s.personal_id)?.namn ?? null,
    konummer: b.konummer, incheckad: b.incheckad ?? (incheckad ? v.ankomst : null), bekraftad: b.bekraftad,
    kan: { checkaIn: kanCheckaIn, omboka: b.status === 'bokad' && !incheckad && oppen && fore && !styr && !arFore, avboka: b.status === 'bokad' && !incheckad && oppen && fore && !styr && !arFore, bekrafta: b.status === 'bokad' && !incheckad && !b.bekraftad && start > nu,
      betala: incheckad && a?.belopp > 0 && !betalning },
    varforInte: andras, avgift: a ? { belopp: a.belopp, text: a.text } : null,
    betalning: betalning ? { belopp: betalning.belopp, sattText: BETALSATT[betalning.satt], kvitto: betalning.kvitto, text: betalning.text } : null,
    // Bara kallelser som har skickats till Min journal eller som patienten har fått på annat sätt visas.
    kallelser: db.query("SELECT * FROM kallelser WHERE bokning_id = ? AND status = 'skickad' ORDER BY skapad, id").all(b.id).map(k => ({ id: k.id, typ: k.typ, kanal: KANAL[k.kanal], text: k.text, skickad: k.skickad, forklaring: k.kanal === 'min_journal' ? null : k.forklaring })),
    // Runda 6, r4: tiderna i följd och lokalen, utan personalens fria text.
    kedja: kedja ? { roll: kedja.roll, text: kedja.roll === 'huvud' ? `${kedja.fore.tid.tidstypText} klockan ${klockText(kedja.fore.tid.start)} före besöket` : `Före ${kedja.huvud.tid.tidstypText.toLowerCase()} klockan ${klockText(kedja.huvud.tid.start)}` } : null,
    lokal: plan.resurserForBokning(db, b.id).find(r => r.typ === 'lokal')?.namn ?? null, ingrepp: ingreppFor(db, b)?.text ?? null,
  };
}

// Det patienten kan boka själv: tidstyper som en vårdenhet där patienten har vårdrelation öppnar för egenbokning.
function egnaBokningsval(db, pid) {
  const ut = [];
  for (const r of db.query('SELECT * FROM tidboksregler WHERE egenbokning = 1 ORDER BY enhet_id, tidstyp').all()) {
    if (!EGENBOKNING_TIDSTYPER.includes(r.tidstyp) || !harVardrelation(db, pid, r.enhet_id)) continue;
    const yrkesroller = [...new Set(db.query(`SELECT yrkesroll FROM scheman WHERE enhet_id IN (${enheterUnder(db, r.enhet_id).map(() => '?').join(', ')})`).all(...enheterUnder(db, r.enhet_id)).map(x => x.yrkesroll))];
    for (const y of yrkesroller) ut.push({ nyckel: `${r.enhet_id}:${r.tidstyp}:${y}`, vardenhet: enhetKort(db, r.enhet_id), tidstyp: r.tidstyp, tidstypText: TIDSTYPER[r.tidstyp].text, yrkesroll: y, yrkesrollText: YRKESROLL[y] });
  }
  return ut;
}

export function minaTider(atk) {
  const db = atk.db;
  skickaPaminnelser(db);
  const p = atk.patient;
  const nu = Date.now();
  const rader = db.query('SELECT * FROM bokningar WHERE patient_id = ? ORDER BY id').all(p.id);
  const kommande = rader.filter(b => b.status === 'bokad' || (b.status === 'incheckad' && Date.parse(tidRad(db, b.tid_id).slut) > nu - 6 * TIMME))
    .map(b => minBokningUt(db, b, nu)).sort((a, b) => a.start.localeCompare(b.start));
  // Den som läser markeras som läst på kallelserna i Min journal.
  db.query("UPDATE kallelser SET lasd = ? WHERE patient_id = ? AND kanal = 'min_journal' AND status = 'skickad' AND lasd IS NULL").run(iso(), p.id);
  const tidigare = rader.filter(b => !['bokad'].includes(b.status) && !kommande.some(k => k.id === b.id)).slice(-10).reverse()
    .map(b => { const t = tidRad(db, b.tid_id); return { id: b.id, status: b.status, start: t.start, tidstypText: TIDSTYPER[t.tidstyp].text, mottagning: enhetKort(db, schemaRad(db, t.schema_id).enhet_id)?.namn }; });
  const k = kanalFor(db, p);
  return {
    kommande, tidigare, boka: egnaBokningsval(db, p.id), demoregler: DEMOREGLER.text,
    // Runda 6, r4: kallelser utan förbokad tid, där patienten väljer en tid själv, och språket för kallelserna.
    kallelserUtanTid: plan.ramerForPatient(db, p.id).map(r => ramUt(db, r)), sprak: { sprak: plan.sprakFor(db, p.id), text: plan.SPRAK[plan.sprakFor(db, p.id)] },
    kanal: { kanal: k.kanal, text: k.kanal ? KANAL[k.kanal] : null, forklaring: p.skyddad ? 'Du har skyddade personuppgifter. Därför får du kallelser bara här i Min journal, aldrig med brev eller sms.' : null },
  };
}

// Runda 6, r4: en kallelse utan förbokad tid för patienten, med ramen och vad det gäller. Ingen fri text från personalen.
export function ramUt(db, r) {
  const v = vantelistaRad(db, r.vantelista_id);
  return {
    id: r.id, text: r.text, fran: r.fran, till: r.till, skapad: r.skapad, status: r.status, sprak: r.sprak, vardenhet: enhetKort(db, r.enhet_id)?.namn,
    tidstyp: v.tidstyp, tidstypText: TIDSTYPER[v.tidstyp]?.text, yrkesrollText: YRKESROLL[v.yrkesroll],
  };
}

const minBokning = (atk, bid) => {
  const b = bokningRad(atk.db, bid);
  if (b.patient_id !== atk.patient.id) throw new Fel(404, 'Bokningen finns inte.', 'saknas');
  return b;
};
const ominvanare = (atk) => ({ avInvanare: atk.invanare.id });

export function minForslag(atk, bid) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  const u = minBokningUt(db, b);
  if (!u.kan.omboka) throw new Fel(400, u.varforInte ?? 'Tiden kan inte bokas om här.', 'ogiltig');
  return { bokning: u, forslag: foreslaTider(db, behovForBokning(db, b, { fran: new Date(Date.now() + DEMOREGLER.egenGransTimmar * TIMME).toISOString() })) };
}

export function minOmboka(atk, bid, body = {}) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  const u = minBokningUt(db, b);
  if (!u.kan.omboka) throw new Fel(400, u.varforInte ?? 'Tiden kan inte bokas om här.', 'ogiltig');
  const tid = tidRad(db, body.tidId);
  // Bara en av de tider som systemet föreslår för bokningen: samma tidstyp, yrkesroll och vårdenhet.
  const forslag = foreslaTider(db, behovForBokning(db, b, { fran: new Date(Date.now() + DEMOREGLER.egenGransTimmar * TIMME).toISOString() }));
  if (!forslag.some(f => f.tidId === tid.id)) throw new Fel(400, 'Välj en av de föreslagna tiderna.', 'ogiltig', { falt: ['tidId'] });
  if (Date.parse(tid.start) - Date.now() < DEMOREGLER.egenGransTimmar * TIMME) throw new Fel(400, 'Den nya tiden måste ligga minst 24 timmar fram.', 'ogiltig', { falt: ['tidId'] });
  if (!arLedig(db, tid)) throw new Fel(400, 'Tiden har just bokats av någon annan. Välj en annan.', 'ogiltig', { falt: ['tidId'] });
  const r = ombokaRad(db, b, tid, ominvanare(atk));
  atk.logga(`min:bokning:${b.id}:ombokad:${r.ny.id}`, { handling: 'boka' });
  return minBokningUt(db, r.ny);
}

export function minAvboka(atk, bid) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  const u = minBokningUt(db, b);
  if (!u.kan.avboka) throw new Fel(400, u.varforInte ?? 'Tiden kan inte avbokas här.', 'ogiltig');
  avbokaRad(db, b, { ...ominvanare(atk), orsak: 'Avbokad av patienten i Min journal' });
  atk.logga(`min:bokning:${b.id}:avbokad`, { handling: 'boka' });
  return { ok: true, id: b.id };
}

export function minCheckaIn(atk, bid) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  const u = minBokningUt(db, b);
  if (!u.kan.checkaIn) throw new Fel(400, u.status === 'incheckad' ? 'Du är redan incheckad.' : 'Incheckningen är öppen från en timme före till en halvtimme efter tiden, för besök på mottagningen.', 'ogiltig');
  const ut = checkaInRad(db, b, 'min_journal', ominvanare(atk));
  atk.logga(`min:bokning:${b.id}:incheckad`, { handling: 'checka_in' });
  return minBokningUt(db, ut);
}

export function minBekrafta(atk, bid) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  if (!minBokningUt(db, b).kan.bekrafta) throw new Fel(400, 'Tiden behöver inte bekräftas.', 'ogiltig');
  db.query('UPDATE bokningar SET bekraftad = ? WHERE id = ?').run(iso(), b.id);
  atk.logga(`min:bokning:${b.id}:bekraftad`, { handling: 'boka' });
  return minBokningUt(db, bokningRad(db, b.id));
}

export function minBetala(atk, bid, body = {}) {
  const db = atk.db;
  const b = minBokning(atk, bid);
  betalaRad(db, b.status === 'bokad' && minBokningUt(db, b).status === 'incheckad' ? { ...b, status: 'incheckad' } : b, body.satt, ominvanare(atk));
  atk.logga(`min:bokning:${b.id}:betald:${body.satt}`, { handling: 'checka_in' });
  return minBokningUt(db, bokningRad(db, b.id));
}

const valFran = (db, pid, nyckel) => {
  const v = egnaBokningsval(db, pid).find(x => x.nyckel === nyckel);
  if (!v) throw new Fel(400, 'Den här typen av tid kan du inte boka själv. Ring mottagningen.', 'ogiltig', { falt: ['nyckel'] });
  return v;
};

export function minNyaForslag(atk, nyckel) {
  const db = atk.db;
  const v = valFran(db, atk.patient.id, nyckel);
  const onskad = tidigareVardgivare(db, atk.patient.id, v.vardenhet.id, v.yrkesroll)[0] ?? null;
  return { val: v, forslag: foreslaTider(db, { patientId: atk.patient.id, ve: v.vardenhet.id, tidstyp: v.tidstyp, yrkesroll: v.yrkesroll, onskad, prioritet: 'normal', grans: null, fran: new Date(Date.now() + DEMOREGLER.egenGransTimmar * TIMME).toISOString() }) };
}

export function minBoka(atk, body = {}) {
  const db = atk.db;
  const v = valFran(db, atk.patient.id, body.nyckel);
  const tid = tidRad(db, body.tidId);
  const s = schemaRad(db, tid.schema_id);
  if (tid.tidstyp !== v.tidstyp || s.yrkesroll !== v.yrkesroll || vardenhetFor(db, s.enhet_id) !== v.vardenhet.id) throw new Fel(400, 'Välj en av de föreslagna tiderna.', 'ogiltig', { falt: ['tidId'] });
  if (Date.parse(tid.start) - Date.now() < DEMOREGLER.egenGransTimmar * TIMME) throw new Fel(400, 'Tiden måste ligga minst 24 timmar fram.', 'ogiltig', { falt: ['tidId'] });
  if (!arLedig(db, tid)) throw new Fel(400, 'Tiden har just bokats av någon annan. Välj en annan.', 'ogiltig', { falt: ['tidId'] });
  const b = skapaBokning(db, { patientId: atk.patient.id, tid, orsak: `${TIDSTYPER[tid.tidstyp].text}, bokad av patienten`, avInvanare: atk.invanare.id, relation: 1 });
  skickaKallelse(db, b, 'kallelse');
  atk.logga(`min:bokning:${b.id}:bokad`, { handling: 'boka' });
  return [201, minBokningUt(db, bokningRad(db, b.id))];
}
