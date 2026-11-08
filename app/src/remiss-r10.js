// Remiss, del 4 (runda 10, r6, Sussa 3.3.1.3 till 3.3.1.5): konsultation skild från remiss, urval i remissöversikten
// och läkarens kvittens av ett beslut som vårdadministratören har registrerat på uppdrag.
//
// Systemet är experten:
//   - Typen: den som remitterar svarar på en fråga på vanlig svenska, om vårdansvaret ska lämnas över eller om hon bara
//     vill ha råd. Förvalet är remiss. Typen följer med utkast, återanvändning, remiss på uppdrag och vidarebefordran.
//   - Konsultationssvar: en konsultation besvaras direkt. Systemet registrerar mottagningen och bedömningen när läkaren
//     svarar, och patienten sätts inte upp på väntelistan, eftersom vårdansvaret stannar hos remittenten.
//   - Urval: översikten filtreras på typ, status, prioritet och tid, och systemet räknar hur många remisser varje val
//     ger, bara bland de remisser som den inloggade ser för sin vårdenhet.
//   - Beslut på uppdrag: beslutet gäller direkt, så att patienten inte väntar, men hamnar i den ansvariga läkarens
//     inkorg. Läkaren kvitterar det i sin egen inloggning, eller öppnar remissen igen och bedömer den själv.
import { Fel, iso, datumAv, addDagar, giltigtDatum } from './db.js';
import { Atkomst, vardenhetFor, kanRoll } from './atkomst.js';
import { vlHandelse } from './tidbok.js';

// Uppslagstabellen har ingen prototyp, så att en typ som constructor aldrig blir en remisstyp.
const tabell = (o) => Object.freeze(Object.assign(Object.create(null), o));
export const REMISSTYPER = tabell({
  remiss: {
    text: 'Remiss', fraga: 'Lämna över vårdansvaret', forklaring: 'Mottagaren tar över ansvaret för det remissen gäller, bedömer och kallar patienten.',
    vardansvar: 'Vårdansvaret för det remissen gäller går över till mottagaren när remissen accepteras.', svarTyp: 'Remissvar',
  },
  konsultation: {
    text: 'Konsultation', fraga: 'Fråga om råd, vårdansvaret stannar hos oss', forklaring: 'Mottagaren svarar med råd. Patienten sätts inte upp på mottagarens väntelista.',
    vardansvar: 'Vårdansvaret stannar hos remittenten. Mottagaren svarar med råd.', svarTyp: 'Konsultationssvar',
  },
});
export const arTyp = (v) => typeof v === 'string' && Object.hasOwn(REMISSTYPER, v);
export const arKonsultation = (r) => r?.typ === 'konsultation';

// Typen ur ett anrop: utan typ blir det en remiss, och en okänd typ avvisas.
export function tolkaTyp(v, forval = 'remiss') {
  if (v === undefined || v === null || v === '') return forval;
  if (!arTyp(v)) throw new Fel(400, 'Välj om vårdansvaret ska lämnas över (remiss) eller om du vill ha råd (konsultation).', 'ogiltig', { falt: ['typ'] });
  return v;
}

const harKolumn = (db, tabellNamn, kol) => db.query(`PRAGMA table_info(${tabellNamn})`).all().some(k => k.name === kol);
const harTabell = (db, namn) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(namn));

export const SCHEMA_REMISS_R10 = `
CREATE TABLE IF NOT EXISTS remiss_beslut_kvittens (
  remiss_id INTEGER NOT NULL, beslut_tid TEXT NOT NULL, ansvarig_id TEXT NOT NULL, utfall TEXT NOT NULL, kommentar TEXT, tid TEXT NOT NULL,
  PRIMARY KEY (remiss_id, beslut_tid), CHECK (utfall IN ('kvitterat', 'underkant'))
);
CREATE TRIGGER IF NOT EXISTS remiss_beslut_kvittens_andras_ej BEFORE UPDATE ON remiss_beslut_kvittens BEGIN SELECT RAISE(ABORT, 'En kvittens ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS remiss_beslut_kvittens_raderas_ej BEFORE DELETE ON remiss_beslut_kvittens BEGIN SELECT RAISE(ABORT, 'En kvittens raderas inte'); END;
`;

// Kolumnen typ i remisser, utkast och remisser på uppdrag, och tabellen för kvittenserna. Körs efter del 2 och del 3,
// som skapar tabellerna för utkast och remisser på uppdrag.
export function sakraRemissR10(db) {
  if (!harKolumn(db, 'remisser', 'typ')) db.exec("ALTER TABLE remisser ADD COLUMN typ TEXT NOT NULL DEFAULT 'remiss'");
  for (const t of ['remiss_utkast', 'remiss_pa_uppdrag']) if (harTabell(db, t) && !harKolumn(db, t, 'typ')) db.exec(`ALTER TABLE ${t} ADD COLUMN typ TEXT NOT NULL DEFAULT 'remiss'`);
  db.exec(SCHEMA_REMISS_R10);
}

// Seeden: kardiologens svar till vårdcentralen om hjärtklappning (patient 11) var en konsultation. Svaret är råd, och
// vårdansvaret stannade på vårdcentralen.
export function seedaKonsultation(db) {
  db.query("UPDATE remisser SET typ = 'konsultation' WHERE patient_id = 'p11' AND fran_enhet_id = 'vc-tybble' AND till_enhet_id = 'uso-kard' AND status = 'besvarad'").run();
}

export function kopieraTyp(db, franId, tillId) {
  const t = db.query('SELECT typ FROM remisser WHERE id = ?').get(franId)?.typ;
  if (t) db.query('UPDATE remisser SET typ = ? WHERE id = ?').run(t, tillId);
}

const person = (db, id) => (id ? { id, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id } : null);

// Kvittensen av det senaste beslutet på uppdrag, eller null när beslutet inte är registrerat på uppdrag.
function kvittensFor(db, r) {
  if (!harTabell(db, 'remiss_beslut_pa_uppdrag') || !harTabell(db, 'remiss_beslut_kvittens')) return null;
  const b = db.query('SELECT * FROM remiss_beslut_pa_uppdrag WHERE remiss_id = ?').get(r.id);
  if (!b) return null;
  const k = db.query('SELECT * FROM remiss_beslut_kvittens WHERE remiss_id = ? AND beslut_tid = ?').get(r.id, b.tid);
  return { beslut: b, kvittens: k ? { status: k.utfall, tid: k.tid, av: person(db, k.ansvarig_id), kommentar: k.kommentar } : { status: 'vantar', tid: null, av: null, kommentar: null } };
}

// Det som remissUt (remiss.js) visar utöver del 1 till 3: typen och vårdansvaret, och kvittensen av ett beslut på
// uppdrag i beslutPaUppdrag (del 3). Kvittensens kommentar är läkarens egen text om beslutet och visas bara för den som
// läser kliniska uppgifter.
export function utoka(db, r, klinisk, ut) {
  const typ = arTyp(r.typ) ? r.typ : 'remiss';
  const t = REMISSTYPER[typ];
  Object.assign(ut, { typ, typText: t.text, konsultation: typ === 'konsultation', vardansvar: t.vardansvar, svarTyp: t.svarTyp });
  const k = kvittensFor(db, r);
  if (k && ut.beslutPaUppdrag) ut.beslutPaUppdrag.kvittens = { ...k.kvittens, kommentar: klinisk ? k.kvittens.kommentar : null };
  return ut;
}

// FHIR: typen som kategori i ServiceRequest, med Vårdkällans kodsystem för remisstyp.
export function fhirKategori(cs, r) {
  const typ = arTyp(r.typ) ? r.typ : 'remiss';
  return [{ coding: [{ system: `${cs}/remisstyp`, code: typ, display: REMISSTYPER[typ].text }], text: REMISSTYPER[typ].text }];
}
export const fhirTyp = (cs, sr) => (sr?.category ?? []).flatMap(c => c?.coding ?? []).find(c => c?.system === `${cs}/remisstyp`)?.code;

// ---------------------------------------------------------------------------------------------------------------
// Konsultationssvar

// En konsultation besvaras utan ett eget steg för bedömning. Systemet kvitterar mottagningen och registrerar bedömningen
// som accepterad med den som svarar som bedömande, med samma behörighet som stegen kräver var för sig. remiss.svara gör
// sedan svaret som vanligt. Returnerar den uppdaterade raden.
export function forberedKonsultationssvar(atk, r, { kravMottag }) {
  if (!arKonsultation(r) || !['skickad', 'mottagen'].includes(r.status)) return r;
  const db = atk.db;
  const nu = iso();
  if (r.status === 'skickad') {
    kravMottag(atk, r);
    db.query("UPDATE remisser SET status = 'mottagen', mottagen_tid = ?, mottagen_av = ? WHERE id = ?").run(nu, atk.personal.id, r.id);
  }
  atk.krav('bedom_remiss');
  db.query("UPDATE remisser SET status = 'bedomd', bedomd_tid = ?, bedomd_av = ?, beslut = 'accepterad' WHERE id = ?").run(nu, atk.personal.id, r.id);
  atk.logga('svara_remiss', atk.grund(), `remiss:${r.id}:konsultationssvar`);
  return db.query('SELECT * FROM remisser WHERE id = ?').get(r.id);
}

// ---------------------------------------------------------------------------------------------------------------
// Urval i remissöversikten

export const STATUSVAL = [
  { id: 'pagaende', text: 'Pågående', passar: (r) => !avslutad(r) },
  { id: 'vantar_mottagning', text: 'Väntar på mottagningskvittens', passar: (r) => r.status === 'skickad' },
  { id: 'vantar_bedomning', text: 'Väntar på bedömning', passar: (r) => r.status === 'mottagen' },
  { id: 'vantar_svar', text: 'Accepterad, väntar på svar', passar: (r) => r.status === 'bedomd' && r.beslut === 'accepterad' },
  { id: 'besvarad', text: 'Besvarad, väntar på kvittens', passar: (r) => r.status === 'besvarad' },
  { id: 'avslutad', text: 'Avslutad', passar: (r) => avslutad(r) },
  { id: 'larm', text: 'Med larm', passar: (r) => (r.larm ?? []).length > 0 },
];
function avslutad(r) { return r.status === 'svar_kvitterat' || ['avvisad', 'vidarebefordrad'].includes(r.beslut); }
export const PRIORITETSVAL = [{ id: 'akut', text: 'Akut' }, { id: 'skyndsam', text: 'Skyndsam' }, { id: 'normal', text: 'Normal' }];
export const PERIODER = [
  { id: 'vecka', text: 'Senaste veckan', dagar: 7 }, { id: 'manad', text: 'Senaste månaden', dagar: 30 },
  { id: 'kvartal', text: 'Senaste tre månaderna', dagar: 91 }, { id: 'ar', text: 'Senaste året', dagar: 365 },
];
const hitta = (lista, id) => (typeof id === 'string' ? lista.find(x => x.id === id) ?? null : null);
const dag = (t) => datumAv(new Date(t));

// Filtret ur adressens parametrar. Okända värden ignoreras, så att filtret bara innehåller det som faktiskt används.
export function tolkaFilter(q, nu = new Date()) {
  const f = {};
  const typ = q.get('typ');
  if (arTyp(typ)) f.typ = typ;
  if (hitta(STATUSVAL, q.get('status'))) f.status = q.get('status');
  if (hitta(PRIORITETSVAL, q.get('prioritet'))) f.prioritet = q.get('prioritet');
  const p = hitta(PERIODER, q.get('period'));
  if (p) { f.period = p.id; f.fran = addDagar(datumAv(nu), -p.dagar); }
  if (!p && giltigtDatum(q.get('fran'))) f.fran = q.get('fran');
  if (giltigtDatum(q.get('till'))) f.till = q.get('till');
  return f;
}

function passar(r, f, utan = null) {
  if (utan !== 'typ' && f.typ && (r.typ ?? 'remiss') !== f.typ) return false;
  if (utan !== 'status' && f.status && !hitta(STATUSVAL, f.status).passar(r)) return false;
  if (utan !== 'prioritet' && f.prioritet && r.prioritet !== f.prioritet) return false;
  const d = dag(r.tider.skickad);
  if (f.fran && d < f.fran) return false;
  if (f.till && d > f.till) return false;
  return true;
}

// Urvalet: remisserna som passar filtret, antalet visade av alla, och antalet per val när de andra valen står kvar.
// Raderna är de som remiss.lista redan har gett den inloggade för sin vårdenhet, så antalen räknar inget annat.
export function urval(rader, q, nu = new Date()) {
  const f = tolkaFilter(q, nu);
  const antal = (falt, passarVal) => rader.filter(r => passar(r, f, falt) && passarVal(r)).length;
  return {
    remisser: rader.filter(r => passar(r, f)),
    filter: Object.fromEntries(Object.entries(f).filter(([k]) => !(k === 'fran' && f.period))),
    antal: { visade: rader.filter(r => passar(r, f)).length, totalt: rader.length },
    val: {
      typ: Object.entries(REMISSTYPER).map(([id, t]) => ({ id, text: t.text, antal: antal('typ', (r) => (r.typ ?? 'remiss') === id) })),
      status: STATUSVAL.map(s => ({ id: s.id, text: s.text, antal: antal('status', s.passar) })),
      prioritet: PRIORITETSVAL.map(p => ({ ...p, antal: antal('prioritet', (r) => r.prioritet === p.id) })),
      period: PERIODER.map(p => ({ id: p.id, text: p.text })),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Kvittens av beslut på uppdrag

const ogiltig = (text, falt) => new Fel(400, text, 'ogiltig', falt ? { falt: [falt] } : undefined);

// Läkaren kvitterar beslutet i sin egen inloggning. Stämmer det inte, öppnas remissen igen och fördelas till läkaren, som
// bedömer den själv. Posten på väntelistan avslutas, men en remiss där patienten redan har fått en tid öppnas inte igen.
export function kvitteraBeslut(atk, r, body = {}) {
  const db = atk.db;
  if (vardenhetFor(db, atk.personal.enhet_id) !== r.till_enhet_id) {
    atk.logga('bedom_remiss', 'nekad', `remiss:${r.id}:beslut_pa_uppdrag`, 'nekad');
    throw new Fel(403, 'Remissen är inte ställd till din vårdenhet.', 'nekad');
  }
  const k = kvittensFor(db, r);
  if (k && k.beslut.ansvarig_id !== atk.personal.id) {
    atk.logga('bedom_remiss', 'nekad', `remiss:${r.id}:beslut_pa_uppdrag`, 'nekad');
    throw new Fel(403, 'Bara den läkare som står som ansvarig för beslutet kvitterar det, i sin egen inloggning.', 'nekad');
  }
  atk.krav('bedom_remiss');
  if (!k) throw ogiltig('Remissens beslut är inte registrerat på uppdrag, så det finns inget att kvittera.');
  if (k.kvittens.status !== 'vantar') throw ogiltig('Beslutet är redan kvitterat.');
  if (!['stammer', 'stammer_inte'].includes(body?.utfall)) throw ogiltig('Välj om beslutet stämmer eller inte.', 'utfall');
  const nu = iso();
  if (body.utfall === 'stammer') {
    db.query("INSERT INTO remiss_beslut_kvittens (remiss_id, beslut_tid, ansvarig_id, utfall, kommentar, tid) VALUES (?, ?, ?, 'kvitterat', NULL, ?)").run(r.id, k.beslut.tid, atk.personal.id, nu);
    atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:beslut_pa_uppdrag:kvitterat`);
    return;
  }
  const kommentar = typeof body.kommentar === 'string' ? body.kommentar.trim().slice(0, 1000) : '';
  if (kommentar.length < 3) throw ogiltig('Skriv varför beslutet inte stämmer. Kommentaren sparas med remissen.', 'kommentar');
  if (r.status !== 'bedomd' || !['accepterad', 'avvisad'].includes(r.beslut)) throw ogiltig('Remissen är redan besvarad eller skickad vidare. Kontakta remittenten om beslutet behöver ändras.');
  if (db.query("SELECT 1 FROM bokningar WHERE remiss_id = ? AND status IN ('bokad', 'incheckad')").get(r.id)) {
    throw ogiltig('Patienten har redan fått en tid på remissen. Avboka tiden först, så öppnar systemet remissen för din bedömning.');
  }
  for (const v of db.query("SELECT id FROM vantelista WHERE remiss_id = ? AND status = 'vantar'").all(r.id)) {
    db.query("UPDATE vantelista SET status = 'avslutad' WHERE id = ?").run(v.id);
    vlHandelse(db, v.id, 'avslutad', { av: atk.personal.id, detalj: 'Läkaren kvitterade inte beslutet som registrerades på uppdrag. Remissen bedöms på nytt.' });
  }
  db.query("UPDATE remisser SET status = 'mottagen', bedomd_tid = NULL, bedomd_av = NULL, beslut = NULL, motivering = NULL WHERE id = ?").run(r.id);
  db.query('INSERT INTO remiss_fordelningar (remiss_id, lakare_id, av, tid) VALUES (?, ?, ?, ?)').run(r.id, atk.personal.id, atk.personal.id, nu);
  db.query("INSERT INTO remiss_beslut_kvittens (remiss_id, beslut_tid, ansvarig_id, utfall, kommentar, tid) VALUES (?, ?, ?, 'underkant', ?, ?)").run(r.id, k.beslut.tid, atk.personal.id, kommentar, nu);
  atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:beslut_pa_uppdrag:underkant`);
}

// Inkorgen: beslut som har registrerats på läkarens uppdrag och väntar på läkarens kvittens. Varje rad visar en patient
// och loggas på patienten en gång per session och beslut.
export function inkorg(c, patientKort, patientRad) {
  const p = c.personal;
  const db = c.db;
  if (p?.yrke !== 'lakare' || !harTabell(db, 'remiss_beslut_kvittens') || !harTabell(db, 'remiss_beslut_pa_uppdrag')) return { beslutAttKvittera: [] };
  const loggade = (c.s.remissR10Loggad ??= new Set());
  const rader = db.query(`SELECT r.*, b.registrerad_av AS b_av, b.tid AS b_tid FROM remiss_beslut_pa_uppdrag b JOIN remisser r ON r.id = b.remiss_id
    WHERE b.ansvarig_id = ? AND NOT EXISTS (SELECT 1 FROM remiss_beslut_kvittens k WHERE k.remiss_id = b.remiss_id AND k.beslut_tid = b.tid) ORDER BY b.tid`).all(p.id);
  const ut = [];
  for (const r of rader) {
    if (vardenhetFor(db, p.enhet_id) !== r.till_enhet_id) continue;
    const a = new Atkomst(db, p, r.patient_id, {}, 'las_remiss');
    const g = a.prova('las_remiss');
    if (!g.tillaten) continue;
    const resurs = `inkorg:beslut_pa_uppdrag:${r.id}:${r.b_tid}`;
    if (!loggade.has(resurs)) { loggade.add(resurs); a.logga('las_remiss', g.grund, resurs); }
    ut.push({
      id: r.id, patientId: r.patient_id, patient: patientKort(patientRad(db, r.patient_id)), beslut: r.beslut, motivering: r.motivering, typ: r.typ ?? 'remiss',
      fragestallning: r.fragestallning, prioritet: r.prioritet, registreradAv: person(db, r.b_av), tid: r.b_tid,
      fran: { id: r.fran_enhet_id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(r.fran_enhet_id)?.namn ?? r.fran_enhet_id },
    });
  }
  return { beslutAttKvittera: ut };
}

// ---------------------------------------------------------------------------------------------------------------
// API

export function registreraRutter({ rutt, kravInloggad, medPatient, remissUt, hamtaRad }) {
  rutt('POST', '/api/remiss/:id/beslut-pa-uppdrag/kvittera', (c, id) => {
    kravInloggad(c);
    const r = hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, 'bedom_remiss', (atk) => {
      kvitteraBeslut(atk, r, c.body);
      return remissUt(c.db, hamtaRad(c.db, r.id), { klinisk: kanRoll(atk.personal, 'las_remiss') });
    });
  });
}
