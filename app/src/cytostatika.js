// Cytostatika (runda 9, r3, Sussa 4.8): ordination ur en behandlingsregim med cykler och dagar, dos efter kroppsyta
// eller njurfunktion som systemet räknar, kontroll av provsvar före varje kur, dosjustering och uppskjuten cykel,
// beredningsorder till en simulerad beredningsenhet med volym, spädning och etikett med streckkod, mottagning och
// administrering med dubbelkontroll i rätt ordning, överlämnande av peroral behandling och uppföljningen per vårdenhet.
//
// Systemet är experten:
//   - Läkaren väljer regim och startdag. Systemet hämtar längd och vikt ur journalen, räknar kroppsytan (Mosteller),
//     njurfunktionen (Cockcroft-Gault) och varje dos (per kvadratmeter eller med Calverts formel för karboplatin),
//     avrundar efter regimens steg och lägger ut cyklerna med dagarna.
//   - Före varje kur prövar systemet leukocyter, trombocyter och vid behov kreatinin mot regimens gränser och förklarar
//     varför en kur inte kan ges. Proverna som saknas beställs med ett klick.
//   - Beredningsordern räknar volymen ur stamlösningens styrka och väljer bärarlösning och volym. Etiketten får en
//     streckkod som kontrolleras när beredningen tas emot och vid sängen.
//   - Vid administreringen kontrollerar systemet id-bandet, etiketten, att en andra person har kontrollerat och att
//     läkemedlen ges i regimens ordning. För peroral behandling räknar systemet tabletterna och skriver instruktionen.
//
// Regimerna, gränserna och stamlösningarna är demoregler och inget kliniskt beslutsstöd.
import { Fel, datumAv, addDagar, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder, kanRoll, alder } from './atkomst.js';
import * as labb from './labb.js';
import { svg as streckkodSvg } from './streckkod.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, DAG, TIMME, kravRoll, vardkontaktFor, lasRad, andraRad, provaRad, loggaPatient } from './specialist-hjalp.js';
import { Atkomst, visningsnamn } from './atkomst.js';

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Regimerna och beredningsenheten är simulerade.';
export const BEREDNINGSENHET = 'Cytostatikaberedningen (simulerad)';
// Regimerna. dosPerM2 i mg per kvadratmeter kroppsyta, auc för karboplatin (Calverts formel), dagar i cykeln, stam i mg
// per ml, avrunda i mg. po betyder peroral behandling som överlämnas till patienten, med tablettstyrkor och dostillfällen
// per dag.
export const REGIMER = tabell({
  ec: { namn: 'EC (epirubicin och cyklofosfamid)', intervall: 21, cykler: 4, prover: ['lpk', 'tpk'], lakemedel: [
    { id: 'epirubicin', namn: 'Epirubicin', dosPerM2: 90, dagar: [1], stam: 2, barare: 'Natriumklorid 9 mg/ml', bararVolym: 100, minuter: 15, avrunda: 1 },
    { id: 'cyklofosfamid', namn: 'Cyklofosfamid', dosPerM2: 600, dagar: [1], stam: 20, barare: 'Natriumklorid 9 mg/ml', bararVolym: 250, minuter: 30, avrunda: 10 },
  ] },
  karboplatin: { namn: 'Karboplatin (AUC 5)', intervall: 21, cykler: 6, prover: ['lpk', 'tpk', 'kreatinin'], lakemedel: [
    { id: 'karboplatin', namn: 'Karboplatin', auc: 5, dagar: [1], stam: 10, barare: 'Glukos 50 mg/ml', bararVolym: 250, minuter: 30, avrunda: 10 },
  ] },
  kapecitabin: { namn: 'Kapecitabin (peroral)', intervall: 21, cykler: 8, prover: ['lpk', 'tpk'], lakemedel: [
    { id: 'kapecitabin', namn: 'Kapecitabin', dosPerM2: 1000, dagar: Array.from({ length: 14 }, (_, i) => i + 1), po: true, tabletter: [500, 150], perDag: 2, avrunda: 150 },
  ] },
});
// Gränserna före en kur (demoregel): prover tagna de senaste tre dygnen.
export const GRANSER = tabell({
  lpk: { namn: 'Leukocyter', min: 3.0, enhet: '×10⁹/L' }, tpk: { namn: 'Trombocyter', min: 100, enhet: '×10⁹/L' }, kreatinin: { namn: 'Kreatinin', enhet: 'µmol/L' },
});
export const PROV_TIMMAR = 72;
export const HALLBAR_TIMMAR = 24;
export const GFR_TAK = 125;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS cyto_behandlingar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, regim TEXT NOT NULL, cykler INTEGER NOT NULL,
  start TEXT NOT NULL, ordinerad_av TEXT NOT NULL, skapad TEXT NOT NULL, status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cyto_beh_patient ON cyto_behandlingar (patient_id);
CREATE TABLE IF NOT EXISTS cyto_cykler (
  id INTEGER PRIMARY KEY AUTOINCREMENT, behandling_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, nummer INTEGER NOT NULL, dag1 TEXT NOT NULL,
  langd REAL NOT NULL, vikt REAL NOT NULL, bsa REAL NOT NULL, gfr REAL, dosandel INTEGER NOT NULL DEFAULT 100, dosandel_orsak TEXT, status TEXT NOT NULL,
  godkand_tid TEXT, godkand_av TEXT, uppskjuten INTEGER NOT NULL DEFAULT 0, uppskjuten_orsak TEXT
);
CREATE TABLE IF NOT EXISTS cyto_doser (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cykel_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lakemedel TEXT NOT NULL, ordning INTEGER NOT NULL,
  dos_mg REAL NOT NULL, berakning TEXT NOT NULL, etikett TEXT NOT NULL UNIQUE, status TEXT NOT NULL, beredd_tid TEXT, volym_ml REAL, mottagen_tid TEXT, mottagen_av TEXT,
  iordningstalld_tid TEXT, iordningstalld_av TEXT, kontrollerad_tid TEXT, kontrollerad_av TEXT, given_tid TEXT, given_av TEXT
);
CREATE TABLE IF NOT EXISTS cyto_historik (
  id INTEGER PRIMARY KEY, behandling_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, personal_id TEXT, handelse TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS cyto_historik_andras_ej BEFORE UPDATE OF behandling_id, tid, personal_id, handelse, detalj ON cyto_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken för en cytostatikabehandling ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS cyto_historik_raderas_ej BEFORE DELETE ON cyto_historik BEGIN SELECT RAISE(ABORT, 'Historiken för en cytostatikabehandling raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

const historik = (db, b, personalId, handelse, detalj, t) => db.query('INSERT INTO cyto_historik (behandling_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(b.id, b.patient_id, b.enhet_id, t, personalId, handelse, detalj);
const rad = (db, tabell, id, text) => { sakra(db); const r = db.query(`SELECT * FROM ${tabell} WHERE id = ?`).get(Number(id)); if (!r) throw new Fel(404, text, 'saknas'); return r; };
export const behandlingRad = (db, id) => rad(db, 'cyto_behandlingar', id, 'Behandlingen finns inte.');
export const cykelRad = (db, id) => rad(db, 'cyto_cykler', id, 'Cykeln finns inte.');
export const dosRad = (db, id) => rad(db, 'cyto_doser', id, 'Dosen finns inte.');
const ANDRA = 'Kuren hanteras av den ordinerande vårdenheten.';
const andraKur = (atk, rad, handling) => andraRad(atk, rad, handling, 'las_cytostatika', ANDRA);
const lakemedelFor = (regim, id) => REGIMER[regim].lakemedel.find(l => l.id === id);
export const etikettFor = (id) => `VKC${String(id).padStart(8, '0')}`;

// ---- Beräkningarna ---------------------------------------------------------------------------------------------------

export const mosteller = (langd, vikt) => Math.sqrt((langd * vikt) / 3600);
// Cockcroft-Gault i SI-enheter: (140 - ålder) × vikt × 1,23 för män och 1,04 för kvinnor, delat med kreatinin i µmol/L.
export const cockcroftGault = ({ alder: ar, vikt, kreatinin, kon }) => ((140 - ar) * vikt * (kon === 'kvinna' ? 1.04 : 1.23)) / kreatinin;
export const avrunda = (v, steg) => Math.round(v / steg) * steg;
// Tabletterna för en dos med så få tabletter som möjligt: 1 800 mg är 3 × 500 mg och 2 × 150 mg, och 600 mg 4 × 150 mg.
export function tabletter(dos, [stor, liten]) {
  for (let n = Math.floor(dos / stor); n >= 0; n--) {
    const kvar = dos - n * stor;
    if (kvar % liten === 0) return [{ styrka: stor, antal: n }, { styrka: liten, antal: kvar / liten }].filter(x => x.antal);
  }
  return null;
}

function dosFor(l, { bsa, gfr }, dosandel) {
  if (l.auc) {
    const g = Math.min(gfr, GFR_TAK);
    const full = l.auc * (g + 25);
    return { mg: avrunda((full * dosandel) / 100, l.avrunda), text: `AUC ${l.auc} × (GFR ${Math.round(g)}${gfr > GFR_TAK ? ', taket' : ''} + 25) = ${Math.round(full)} mg${dosandel < 100 ? `, ${dosandel} procent` : ''}` };
  }
  const full = l.dosPerM2 * bsa;
  return { mg: avrunda((full * dosandel) / 100, l.avrunda), text: `${l.dosPerM2} mg/m² × ${bsa.toFixed(2).replace('.', ',')} m² = ${Math.round(full)} mg${dosandel < 100 ? `, ${dosandel} procent` : ''}${l.po ? ' per tillfälle' : ''}` };
}

// Längd, vikt och kreatinin ur journalen, bland det som den inloggade får se.
function underlag(atk, regim, nu) {
  const db = atk.db;
  const mv = atk.filtrera(db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ IN ('langd', 'vikt', 'kreatinin') ORDER BY tid DESC, id DESC").all(atk.patientId), 'las_matvarden');
  const senast = (typ, dagar) => mv.find(m => m.typ === typ && Date.parse(m.tid) >= nu.getTime() - dagar * DAG);
  const v = senast('vikt', 30), l = mv.find(m => m.typ === 'langd');
  if (!v || !l) throw new Fel(409, `${!l ? 'Längd' : 'Vikt'} saknas${!v && l ? ' från den senaste månaden' : ''}. Registrera ${!l ? 'längden' : 'vikten'} som mätvärde, så räknar systemet kroppsytan.`, 'underlag');
  const vikt = Number(v.varde_num ?? v.varde), langd = Number(l.varde_num ?? l.varde);
  const bsa = Number(mosteller(langd, vikt).toFixed(2));
  let gfr = null;
  if (REGIMER[regim].lakemedel.some(x => x.auc)) {
    const k = senast('kreatinin', PROV_TIMMAR / 24);
    if (!k) throw new Fel(409, 'Kreatinin från de senaste tre dygnen saknas. Systemet behöver det för att räkna karboplatindosen.', 'underlag');
    const p = db.query('SELECT fodd, kon FROM patienter WHERE id = ?').get(atk.patientId);
    gfr = Number(cockcroftGault({ alder: alder(p.fodd, datumAv(nu)), vikt, kreatinin: Number(k.varde_num ?? k.varde), kon: p.kon }).toFixed(0));
  }
  return { langd, vikt, bsa, gfr };
}

function laggUtDoser(db, b, c) {
  const ins = db.query("INSERT INTO cyto_doser (cykel_id, patient_id, enhet_id, lakemedel, ordning, dos_mg, berakning, etikett, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ordinerad')");
  REGIMER[b.regim].lakemedel.forEach((l, i) => {
    const d = dosFor(l, { bsa: c.bsa, gfr: c.gfr }, c.dosandel);
    const id = Number(ins.run(c.id, b.patient_id, b.enhet_id, l.id, i + 1, d.mg, d.text, `tmp-${Math.random()}`).lastInsertRowid);
    db.query('UPDATE cyto_doser SET etikett = ? WHERE id = ?').run(etikettFor(id), id);
  });
}

function nyCykel(atk, b, nummer, dag1, nu) {
  const db = atk.db;
  const u = underlag(atk, b.regim, nu);
  const r = db.query("INSERT INTO cyto_cykler (behandling_id, patient_id, enhet_id, nummer, dag1, langd, vikt, bsa, gfr, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planerad')")
    .run(b.id, b.patient_id, b.enhet_id, nummer, dag1, u.langd, u.vikt, u.bsa, u.gfr);
  const c = cykelRad(db, r.lastInsertRowid);
  laggUtDoser(db, b, c);
  return c;
}

// ---- Ordinationen ----------------------------------------------------------------------------------------------------

export const regimer = () => Object.entries(REGIMER).map(([id, r]) => ({ id, namn: r.namn, intervall: r.intervall, cykler: r.cykler, peroral: r.lakemedel.some(l => l.po),
  lakemedel: r.lakemedel.map(l => ({ namn: l.namn, dos: l.auc ? `AUC ${l.auc}` : `${l.dosPerM2} mg/m²`, dagar: l.dagar })) }));

export function ordinera(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('ordinera_cytostatika');
  if (!finns(REGIMER, body.regim)) throw new Fel(400, 'Välj behandlingsregim.', 'ogiltig', { falt: ['regim'] });
  const r = REGIMER[body.regim];
  const start = body.start ?? addDagar(datumAv(nu), 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < datumAv(nu)) throw new Fel(400, 'Startdagen ska vara i dag eller senare, ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['start'] });
  const cykler = body.cykler == null ? r.cykler : Number(body.cykler);
  if (!Number.isInteger(cykler) || cykler < 1 || cykler > r.cykler) throw new Fel(400, `Regimen har högst ${r.cykler} cykler.`, 'ogiltig', { falt: ['cykler'] });
  if (db.query("SELECT 1 FROM cyto_behandlingar WHERE patient_id = ? AND status = 'pagaende'").get(atk.patientId)) throw new Fel(409, 'Patienten har redan en pågående cytostatikabehandling.', 'ogiltig');
  underlag(atk, body.regim, nu);
  let b;
  db.transaction(() => {
    const x = db.query("INSERT INTO cyto_behandlingar (patient_id, enhet_id, vardkontakt_id, regim, cykler, start, ordinerad_av, skapad, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pagaende')")
      .run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), body.regim, cykler, start, atk.personal.id, iso(nu));
    b = behandlingRad(db, x.lastInsertRowid);
    nyCykel(atk, b, 1, start, nu);
    historik(db, b, atk.personal.id, 'ordinerad', `${r.namn}, ${cykler} cykler var ${r.intervall}:e dag från ${start}.`, iso(nu));
  })();
  return behandlingUt(atk, behandlingRad(db, b.id), nu);
}

// Provsvaren före kuren, prövade mot regimens gränser. Bara svar som den inloggade får se och som är tagna de senaste
// tre dygnen räknas.
export function provkontroll(atk, c, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, c, 'las_cytostatika');
  const b = behandlingRad(db, c.behandling_id);
  labb.forfallnaSvar(db, nu);
  const mv = atk.filtrera(db.query('SELECT * FROM matvarden WHERE patient_id = ? AND tid >= ? ORDER BY tid DESC, id DESC').all(c.patient_id, iso(nu.getTime() - PROV_TIMMAR * TIMME)), 'las_matvarden');
  const kriterier = REGIMER[b.regim].prover.map(typ => {
    const g = GRANSER[typ];
    const m = mv.find(x => x.typ === typ);
    if (!m) return { typ, namn: g.namn, ok: false, saknas: true, text: `${g.namn} från de senaste tre dygnen saknas.` };
    const v = Number(m.varde_num ?? m.varde);
    const ok = g.min == null || v >= g.min;
    return { typ, namn: g.namn, ok, varde: v, tid: m.tid, text: ok ? `${g.namn} ${String(v).replace('.', ',')} ${g.enhet}.` : `${g.namn} ${String(v).replace('.', ',')} ${g.enhet} är under gränsen ${String(g.min).replace('.', ',')}. Skjut upp kuren.` };
  });
  const saknas = kriterier.filter(k => k.saknas);
  return { ok: kriterier.every(k => k.ok), kriterier, saknasAnalyser: saknas.length ? [...new Set(saknas.map(k => (k.typ === 'kreatinin' ? 'kreatinin' : 'blodstatus')))] : [],
    text: kriterier.every(k => k.ok) ? 'Provsvaren tillåter kuren.' : kriterier.filter(k => !k.ok).map(k => k.text).join(' ') };
}

// Beställer proverna som saknas före kuren.
export function bestallProver(atk, c, nu = new Date()) {
  const p = provkontroll(atk, c, nu);
  if (!p.saknasAnalyser.length) throw new Fel(409, 'Proverna före kuren finns redan.', 'ogiltig');
  return labb.bestall(atk, { analyser: p.saknasAnalyser, kvitteraDubbletter: true, kommentar: `Före cytostatikakur, cykel ${c.nummer}` }, nu);
}

// Läkaren godkänner kuren. Det går bara när provsvaren tillåter den. Beredningsordern går då till beredningsenheten.
export function godkann(atk, c, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Kuren är redan godkänd eller avslutad.', 'ogiltig');
  const p = provkontroll(atk, c, nu);
  if (!p.ok) throw new Fel(409, p.text, 'prov');
  const b = behandlingRad(db, c.behandling_id);
  db.transaction(() => {
    db.query("UPDATE cyto_cykler SET status = 'godkand', godkand_tid = ?, godkand_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, c.id);
    db.query("UPDATE cyto_doser SET status = 'att_bereda' WHERE cykel_id = ?").run(c.id);
    historik(db, b, atk.personal.id, 'godkand', `Cykel ${c.nummer} godkänd. ${p.text} Beredningsorder till ${BEREDNINGSENHET}.`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

// Dosjustering för en kur som inte är godkänd: andelen av full dos och orsaken. Doserna räknas om.
export function dosjustera(atk, c, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Doserna kan bara ändras innan kuren är godkänd.', 'ogiltig');
  const andel = Number(body.dosandel);
  if (![50, 60, 75, 80, 90, 100].includes(andel)) throw new Fel(400, 'Välj andel av full dos: 50, 60, 75, 80, 90 eller 100 procent.', 'ogiltig', { falt: ['dosandel'] });
  const orsak = textFalt(body.orsak, 200);
  if (andel < 100 && !orsak) throw new Fel(400, 'Skriv orsaken till dosjusteringen.', 'ogiltig', { falt: ['orsak'] });
  const b = behandlingRad(db, c.behandling_id);
  db.transaction(() => {
    db.query('DELETE FROM cyto_doser WHERE cykel_id = ?').run(c.id);
    db.query('UPDATE cyto_cykler SET dosandel = ?, dosandel_orsak = ? WHERE id = ?').run(andel, orsak || null, c.id);
    laggUtDoser(db, b, cykelRad(db, c.id));
    historik(db, b, atk.personal.id, 'dosjusterad', `Cykel ${c.nummer}: ${andel} procent av full dos.${orsak ? ` ${orsak}.` : ''}`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

export function skjutUpp(atk, c, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ordinera_cytostatika');
  if (c.status !== 'planerad') throw new Fel(409, 'Bara en kur som inte är godkänd kan skjutas upp.', 'ogiltig');
  const dagar = body.dagar == null ? 7 : Number(body.dagar);
  if (!Number.isInteger(dagar) || dagar < 1 || dagar > 28) throw new Fel(400, 'Skjut upp kuren 1 till 28 dagar.', 'ogiltig', { falt: ['dagar'] });
  const orsak = textFalt(body.orsak, 200) || provkontroll(atk, c, nu).text;
  const b = behandlingRad(db, c.behandling_id);
  db.query('UPDATE cyto_cykler SET dag1 = ?, uppskjuten = uppskjuten + 1, uppskjuten_orsak = ? WHERE id = ?').run(addDagar(c.dag1, dagar), orsak, c.id);
  historik(db, b, atk.personal.id, 'uppskjuten', `Cykel ${c.nummer} uppskjuten ${dagar} dagar till ${addDagar(c.dag1, dagar)}. ${orsak}`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// ---- Beredningen -----------------------------------------------------------------------------------------------------

// Beredningsordern för en godkänd kur: dos, volym ur stamlösningen, bärarlösning, total volym, infusionstid och etikett.
export function beredningsorder(atk, c) {
  const db = atk.db;
  lasRad(atk, c, 'las_cytostatika');
  const b = behandlingRad(db, c.behandling_id);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(c.patient_id);
  const doser = db.query('SELECT * FROM cyto_doser WHERE cykel_id = ? ORDER BY ordning').all(c.id);
  return {
    beredningsenhet: BEREDNINGSENHET, regim: REGIMER[b.regim].namn, cykel: c.nummer, dag1: c.dag1, kroppsyta: c.bsa, gfr: c.gfr, dosandel: c.dosandel,
    doser: doser.map(d => {
      const l = lakemedelFor(b.regim, d.lakemedel);
      if (l.po) {
        const t = tabletter(d.dos_mg, l.tabletter);
        return { id: d.id, lakemedel: l.namn, dos: d.dos_mg, peroral: true, tabletterPerTillfalle: t, tabletterTotalt: t?.map(x => ({ styrka: x.styrka, antal: x.antal * l.perDag * l.dagar.length })), etikett: d.etikett, status: d.status };
      }
      const volym = Number((d.dos_mg / l.stam).toFixed(1));
      return { id: d.id, ordning: d.ordning, lakemedel: l.namn, dos: d.dos_mg, berakning: d.berakning, stam: `${l.stam} mg/ml`, volymLakemedel: volym, barare: l.barare,
        bararVolym: l.bararVolym, totalVolym: Number((volym + l.bararVolym).toFixed(1)), infusionMinuter: l.minuter, etikett: d.etikett, status: d.status,
        etikettText: `${p.fornamn} ${p.efternamn}, ${p.personnummer.slice(0, 8)}-${p.personnummer.slice(8)}. ${l.namn} ${d.dos_mg} mg i ${l.barare} ${l.bararVolym} ml, totalt ${Number((volym + l.bararVolym).toFixed(1))} ml. Infunderas på ${l.minuter} minuter. Hållbar ${HALLBAR_TIMMAR} timmar.`,
        streckkod: streckkodSvg(d.etikett) };
    }),
  };
}

// Den simulerade beredningsenheten bereder en godkänd kur: dubbelkontroll av beräkning och volym, och etiketterna.
export function bered(atk, c, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, c, 'ge_cytostatika');
  if (c.status !== 'godkand') throw new Fel(409, 'Kuren är inte godkänd av läkaren, så beredningsenheten bereder den inte.', 'ogiltig');
  const b = behandlingRad(db, c.behandling_id);
  const order = beredningsorder(atk, c);
  db.transaction(() => {
    for (const d of order.doser.filter(x => x.status === 'att_bereda')) db.query("UPDATE cyto_doser SET status = 'beredd', beredd_tid = ?, volym_ml = ? WHERE id = ?").run(iso(nu), d.totalVolym ?? null, d.id);
    historik(db, b, null, 'beredd', `${BEREDNINGSENHET}: cykel ${c.nummer} beredd och dubbelkontrollerad mot beredningsordern.`, iso(nu));
  })();
  return beredningsorder(atk, cykelRad(db, c.id));
}

// Mottagningen på avdelningen: etiketten läses och måste vara den beredda dosens.
export function taEmot(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  if (d.status !== 'beredd') throw new Fel(409, d.status === 'att_bereda' ? 'Dosen är inte beredd än.' : 'Dosen är redan mottagen.', 'ogiltig');
  if (body.streckkod !== d.etikett) throw new Fel(409, 'Streckkoden stämmer inte med den beredda dosen. Ta inte emot påsen och kontakta beredningsenheten.', 'fel_etikett');
  db.query("UPDATE cyto_doser SET status = 'mottagen', mottagen_tid = ?, mottagen_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  return { mottagen: true, etikett: d.etikett };
}

// Id-bandet och etiketten läses av den som iordningställer och, var för sig, av den som kontrollerar.
function lasVidSangen(db, d, body) {
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(d.patient_id);
  if (String(body.armband ?? '').replace(/\D/g, '') !== p.personnummer) throw new Fel(409, 'Id-bandet hör inte till patienten som kuren är ordinerad för. Ge inte kuren.', 'fel_patient');
  if (body.streckkod !== d.etikett) throw new Fel(409, 'Etiketten stämmer inte med dosen. Ge inte kuren.', 'fel_etikett');
}
const hallbarKvar = (d, l, nu) => {
  if (!l.po && nu.getTime() > Date.parse(d.beredd_tid) + HALLBAR_TIMMAR * TIMME) throw new Fel(409, `Beredningen är äldre än ${HALLBAR_TIMMAR} timmar. Ge den inte och kontakta beredningsenheten.`, 'for_sent');
};

// De som får göra dubbelkontrollen: sjuksköterskor och läkare på vårdenheten som får läsa behandlingen i
// behörighetsmotorn, aldrig den som iordningställde dosen. Förslaget ger ingen åtkomst som personen inte redan har.
export function kontrollKandidater(db, d) {
  const ve = vardenhetFor(db, d.enhet_id);
  return db.query("SELECT * FROM personal WHERE aktiv = 1 AND yrke IN ('sjukskoterska', 'lakare') ORDER BY namn").all()
    .filter(p => p.id !== d.iordningstalld_av && vardenhetFor(db, p.enhet_id) === ve && kanRoll(p, 'ge_cytostatika')
      && new Atkomst(db, p, d.patient_id, {}, 'las_cytostatika').prova('las_cytostatika', { enhet_id: d.enhet_id }).tillaten)
    .map(p => ({ id: p.id, namn: p.namn }));
}

// Iordningställandet vid sängen: den som ska ge kuren läser id-band och etikett. Dosen väntar sedan på att en andra
// person kontrollerar den i sin egen inloggning. Ordningen i regimen och hållbarheten prövas här.
export function iordningstall(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  const c = cykelRad(db, d.cykel_id);
  const b = behandlingRad(db, c.behandling_id);
  const l = lakemedelFor(b.regim, d.lakemedel);
  if (c.status !== 'godkand') throw new Fel(409, 'Kuren är inte godkänd av läkaren.', 'ogiltig');
  if (d.status !== (l.po ? 'beredd' : 'mottagen')) throw new Fel(409, l.po ? 'Tabletterna är inte iordningställda av beredningsenheten.' : d.status === 'beredd' ? 'Ta emot dosen och läs etiketten först.' : 'Dosen är redan iordningställd eller given.', 'ogiltig');
  hallbarKvar(d, l, nu);
  lasVidSangen(db, d, body);
  const fore = db.query("SELECT * FROM cyto_doser WHERE cykel_id = ? AND ordning < ? AND status NOT IN ('given', 'overlamnad') ORDER BY ordning").get(c.id, d.ordning);
  if (fore) throw new Fel(409, `Ge ${lakemedelFor(b.regim, fore.lakemedel).namn.toLocaleLowerCase('sv')} först. Regimen har en bestämd ordning.`, 'ordning');
  db.query("UPDATE cyto_doser SET status = 'vantar_kontroll', iordningstalld_tid = ?, iordningstalld_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  historik(db, b, atk.personal.id, 'iordningstalld', `${l.namn} ${d.dos_mg} mg iordningställd vid sängen. Väntar på dubbelkontroll.`, iso(nu));
  return { ...behandlingUt(atk, b, nu), kontroll: { status: 'vantar_kontroll', iordningstalldAv: personNamn(db, atk.personal.id), kandidater: kontrollKandidater(db, dosRad(db, d.id)) } };
}

// Doser som väntar på dubbelkontroll på den inloggades vårdenhet. Den som iordningställde ser inte sin egen dos här, och
// en patient som den inloggade inte får se finns inte med alls. Varje patient som visas loggas.
export function vantandeKontroller(db, personal, valFor) {
  sakra(db);
  if (!kanRoll(personal, 'ge_cytostatika')) return { kontroller: [] };
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const ut = [];
  for (const d of db.query(`SELECT * FROM cyto_doser WHERE status = 'vantar_kontroll' AND iordningstalld_av <> ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY iordningstalld_tid`).all(personal.id, ...enheter)) {
    const r = provaRad(db, personal, valFor, d, 'las_cytostatika');
    if (!r.tillaten) continue;
    loggaPatient(db, personal, d.patient_id, 'las_cytostatika', r.grund, '/api/cytostatika/kontroller');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id);
    const b = behandlingRad(db, cykelRad(db, d.cykel_id).behandling_id);
    ut.push({ dosId: d.id, etikett: d.etikett, lakemedel: lakemedelFor(b.regim, d.lakemedel).namn, dos: d.dos_mg, iordningstalld: { tid: d.iordningstalld_tid, av: personNamn(db, d.iordningstalld_av) },
      patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) } });
  }
  return { kontroller: ut };
}

// Dubbelkontrollen görs av den andra personen i sin egen inloggning, som själv läser id-bandet och etiketten.
export function kontrollera(atk, d, body = {}, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  if (d.status !== 'vantar_kontroll') throw new Fel(409, 'Dosen väntar inte på dubbelkontroll.', 'ogiltig');
  if (d.iordningstalld_av === atk.personal.id) throw new Fel(409, 'Den som iordningställde dosen kan inte kontrollera den själv. En annan sjuksköterska eller läkare kontrollerar i sin egen inloggning.', 'samma_person');
  if (!kontrollKandidater(db, d).some(k => k.id === atk.personal.id)) throw new Fel(403, 'Du kan inte dubbelkontrollera dosen.', 'nekad');
  lasVidSangen(db, d, body);
  const b = behandlingRad(db, cykelRad(db, d.cykel_id).behandling_id);
  db.query("UPDATE cyto_doser SET status = 'kontrollerad', kontrollerad_tid = ?, kontrollerad_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, d.id);
  historik(db, b, atk.personal.id, 'kontrollerad', `${lakemedelFor(b.regim, d.lakemedel).namn} ${d.dos_mg} mg dubbelkontrollerad.`, iso(nu));
  return behandlingUt(atk, b, nu);
}

// Administreringen, eller överlämnandet av peroral behandling, efter dubbelkontrollen. Bara den som iordningställde
// eller kontrollerade dosen ger den.
export function ge(atk, d, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, d, 'ge_cytostatika');
  const c = cykelRad(db, d.cykel_id);
  const b = behandlingRad(db, c.behandling_id);
  const l = lakemedelFor(b.regim, d.lakemedel);
  if (['given', 'overlamnad'].includes(d.status)) throw new Fel(409, 'Dosen är redan given.', 'ogiltig');
  if (d.status !== 'kontrollerad' || !d.kontrollerad_av) throw new Fel(409, 'Dosen är inte dubbelkontrollerad. Den andra personen bekräftar kontrollen i sin egen inloggning.', 'kontroll');
  if (![d.iordningstalld_av, d.kontrollerad_av].includes(atk.personal.id)) throw new Fel(403, 'Dosen ges av någon av de två som har kontrollerat den.', 'nekad');
  hallbarKvar(d, l, nu);
  let instruktion = null;
  const annan = personNamn(db, d.kontrollerad_av === atk.personal.id ? d.iordningstalld_av : d.kontrollerad_av);
  db.transaction(() => {
    db.query('UPDATE cyto_doser SET status = ?, given_tid = ?, given_av = ? WHERE id = ?').run(l.po ? 'overlamnad' : 'given', iso(nu), atk.personal.id, d.id);
    if (l.po) {
      const t = tabletter(d.dos_mg, l.tabletter);
      instruktion = `Ta ${t.map(x => `${x.antal} ${x.antal === 1 ? 'tablett' : 'tabletter'} à ${x.styrka} mg`).join(' och ')} morgon och kväll, inom en halvtimme efter måltid, dag ${l.dagar[0]} till ${l.dagar.at(-1)} från ${c.dag1}. Kontakta mottagningen vid feber över 38 grader, diarré eller ömhet i händer och fötter.`;
    }
    historik(db, b, atk.personal.id, l.po ? 'overlamnad' : 'given', `${l.namn} ${d.dos_mg} mg${l.po ? ' per tillfälle överlämnat till patienten' : ' given'}, dubbelkontrollerad med ${annan}.`, iso(nu));
    if (!db.query("SELECT 1 FROM cyto_doser WHERE cykel_id = ? AND status NOT IN ('given', 'overlamnad')").get(c.id)) {
      db.query("UPDATE cyto_cykler SET status = 'klar' WHERE id = ?").run(c.id);
      if (c.nummer >= b.cykler) {
        db.query("UPDATE cyto_behandlingar SET status = 'avslutad' WHERE id = ?").run(b.id);
        historik(db, b, null, 'avslutad', `Alla ${b.cykler} cykler är givna.`, iso(nu));
      }
    }
  })();
  return { ...behandlingUt(atk, behandlingRad(db, b.id), nu), instruktion };
}

// Nästa cykel planeras av systemet när kuren är klar, med längd och vikt från journalen så att doserna följer patienten.
export function nastaCykel(atk, b, nu = new Date()) {
  const db = atk.db;
  andraKur(atk, b, 'ordinera_cytostatika');
  const sista = db.query('SELECT * FROM cyto_cykler WHERE behandling_id = ? ORDER BY nummer DESC').get(b.id);
  if (b.status !== 'pagaende' || sista.status !== 'klar') throw new Fel(409, b.status !== 'pagaende' ? 'Behandlingen är avslutad.' : 'Den pågående cykeln är inte klar.', 'ogiltig');
  const dag1 = addDagar(sista.dag1, REGIMER[b.regim].intervall);
  db.transaction(() => {
    const c = nyCykel(atk, b, sista.nummer + 1, dag1, nu);
    const andring = Math.abs(c.vikt - sista.vikt) / sista.vikt;
    historik(db, b, atk.personal.id, 'ny_cykel', `Cykel ${c.nummer} planerad till ${dag1}.${andring >= 0.05 ? ` Vikten har ändrats från ${sista.vikt} till ${c.vikt} kg, så doserna är omräknade.` : ''}`, iso(nu));
  })();
  return behandlingUt(atk, b, nu);
}

// ---- Utdata ----------------------------------------------------------------------------------------------------------

export function behandlingUt(atk, b, nu = new Date()) {
  const db = atk.db;
  const r = REGIMER[b.regim];
  const cykler = db.query('SELECT * FROM cyto_cykler WHERE behandling_id = ? ORDER BY nummer').all(b.id);
  return {
    id: b.id, regim: { id: b.regim, namn: r.namn, intervall: r.intervall }, cykler: b.cykler, start: b.start, status: b.status, vardenhet: enhetKort(db, b.enhet_id),
    ordinerad: { tid: b.skapad, av: personNamn(db, b.ordinerad_av) },
    kurer: cykler.map(c => ({ id: c.id, nummer: c.nummer, dag1: c.dag1, kroppsyta: c.bsa, langd: c.langd, vikt: c.vikt, gfr: c.gfr, dosandel: c.dosandel, dosandelOrsak: c.dosandel_orsak,
      status: c.status, godkand: c.godkand_tid ? { tid: c.godkand_tid, av: personNamn(db, c.godkand_av) } : null, uppskjuten: c.uppskjuten, uppskjutenOrsak: c.uppskjuten_orsak,
      dagar: [...new Set(r.lakemedel.flatMap(l => l.dagar))].sort((x, y) => x - y).map(d => addDagar(c.dag1, d - 1)).slice(0, 3),
      doser: db.query('SELECT * FROM cyto_doser WHERE cykel_id = ? ORDER BY ordning').all(c.id).map(d => ({ id: d.id, ordning: d.ordning, lakemedel: lakemedelFor(b.regim, d.lakemedel).namn,
        dos: d.dos_mg, berakning: d.berakning, peroral: Boolean(lakemedelFor(b.regim, d.lakemedel).po), status: d.status, etikett: d.etikett,
        given: d.given_tid ? { tid: d.given_tid, av: personNamn(db, d.given_av), kontrolleradAv: personNamn(db, d.kontrollerad_av) } : null })) })),
    historik: db.query('SELECT * FROM cyto_historik WHERE behandling_id = ? ORDER BY id').all(b.id).map(h => ({ tid: h.tid, av: h.personal_id ? personNamn(db, h.personal_id) : BEREDNINGSENHET, handelse: h.handelse, detalj: h.detalj })),
    demoregel: DEMOREGEL,
  };
}

export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_cytostatika');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM cyto_behandlingar WHERE patient_id = ? ORDER BY skapad DESC').all(atk.patientId), 'las_cytostatika');
  return { behandlingar: rader.map(b => behandlingUt(atk, b, nu)), regimer: regimer(), demoregel: DEMOREGEL };
}

// Planering och uppföljning per vårdenhet, utan personuppgifter: pågående behandlingar per regim, planerade kurer de
// kommande fyra veckorna, givna kurer och beredningar, dosjusteringar och uppskjutna cykler under perioden.
export function uppfoljning(db, personal, { fran = null, till = null } = {}, nu = new Date()) {
  sakra(db);
  kravRoll(personal, 'statistik', 'Din yrkesroll har inte uppföljningen.');
  const t = till ?? datumAv(nu), f = fran ?? addDagar(t, -90);
  if (![f, t].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) || f > t) throw new Fel(400, 'Ange perioden som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const start = lokalTid(f, '00:00'), slut = lokalTid(addDagar(t, 1), '00:00');
  const beh = db.query(`SELECT * FROM cyto_behandlingar WHERE enhet_id IN (${ph})`).all(...enheter);
  const cykler = db.query(`SELECT c.*, b.regim FROM cyto_cykler c JOIN cyto_behandlingar b ON b.id = c.behandling_id WHERE c.enhet_id IN (${ph})`).all(...enheter);
  const doser = db.query(`SELECT * FROM cyto_doser WHERE enhet_id IN (${ph})`).all(...enheter);
  const idag = datumAv(nu), om4 = addDagar(idag, 28);
  const iPerioden = (x) => x && x >= start && x < slut;
  return {
    vardenhet: enhetKort(db, vardenhetFor(db, personal.enhet_id)), fran: f, till: t,
    pagaende: Object.entries(REGIMER).map(([id, r]) => ({ id, namn: r.namn, antal: beh.filter(b => b.regim === id && b.status === 'pagaende').length })).filter(x => x.antal),
    planeradeKurer: cykler.filter(c => c.status !== 'klar' && c.dag1 >= idag && c.dag1 < om4).length,
    givnaKurer: cykler.filter(c => c.status === 'klar' && doser.filter(d => d.cykel_id === c.id).some(d => iPerioden(d.given_tid))).length,
    beredningar: doser.filter(d => iPerioden(d.beredd_tid) && d.volym_ml != null).length,
    dosjusteringar: cykler.filter(c => c.dosandel < 100 && c.dag1 >= f && c.dag1 <= t).length,
    uppskjutna: cykler.filter(c => c.dag1 >= f && c.dag1 <= t).reduce((x, c) => x + c.uppskjuten, 0),
    text: 'Uppföljningen räknas av systemet ur ordinationerna, beredningarna och administreringen. Den innehåller inga personuppgifter.',
  };
}
