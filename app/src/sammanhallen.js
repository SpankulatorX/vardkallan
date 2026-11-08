// Sammanhållen journalföring med en annan vårdgivare (runda 10, r5, Sussa 3.2.2.3), patientdatalagen (2008:355) 6 kap.
//
// Vårdkällan är konsument: uppgifter som har skapats hos en annan vårdgivare hämtas och visas i samma kronologi som
// patientens egna uppgifter, med vårdgivaren, vårdenheten, yrkesrollen, den som skapade uppgiften och tiden utskrivna.
// Den andra vårdgivaren och dess uppgifter är simulerade i demon och märkta som simulerade.
//
// Systemet är experten. Det vet själv om patienten har ett samtycke registrerat på vårdenheten, frågar efter samtycket
// bara när det saknas, kräver ett aktivt val med syfte innan något hämtas och lägger uppgifterna i tidslinjen, så att
// användaren inte behöver öppna ett annat system. Patientens spärrar hos den andra vårdgivaren följer med: den
// vårdgivaren lämnar aldrig ut spärrade uppgifter, och inget talar om att de finns.
//
// Behörighet (6 kap. 2 och 3 §§). Bara den som har en aktuell patientrelation och får läsa journalen tar del av
// uppgifterna, och bara om patienten samtycker. Utan samtycke får uppgifterna hämtas vid nödåtkomst, när patienten inte
// kan samtycka och uppgifterna behövs för vård som patienten oundgängligen behöver. Varje hämtning loggas på patienten
// med vårdgivaren och syftet. Samtycket gäller vårdenheten och kan återkallas, och då tas det aktiva valet bort.
import { Fel, iso } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sammanhallen_samtycken (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, registrerat TEXT NOT NULL, registrerat_av TEXT NOT NULL,
  aterkallat TEXT, aterkallat_av TEXT
);
CREATE TRIGGER IF NOT EXISTS sj_samtycke_raderas_ej BEFORE DELETE ON sammanhallen_samtycken BEGIN SELECT RAISE(ABORT, 'Ett samtycke raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS sj_samtycke_andras_ej BEFORE UPDATE OF patient_id, enhet_id, registrerat, registrerat_av ON sammanhallen_samtycken
  BEGIN SELECT RAISE(ABORT, 'Ett samtycke ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

// Den simulerade vårdgivaren. Id och namn är påhittade.
export const VARDGIVARE = { hsaId: 'DEMO-VG-0001', namn: 'Hälsohuset Vårdgivare AB (simulerad)', simulerad: true };
const ENHETER = {
  vc: { hsaId: 'DEMO-VG-0001-E01', namn: 'Hälsohuset vårdcentral (simulerad)' },
  ort: { hsaId: 'DEMO-VG-0001-E02', namn: 'Hälsohuset ortopedmottagning (simulerad)' },
};
const ROLL = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', fysioterapeut: 'Fysioterapeut' };

// Uppgifterna hos den simulerade vårdgivaren. sparrad: patienten har spärrat uppgiften där, och den lämnas aldrig ut.
const P = (id, typ, tid, enhet, roll, av, rubrik, text, extra = {}) => ({ id, typ, tid, enhet, roll, av, rubrik, text, ...extra });
export const POSTER = {
  p01: [
    P('hh-1', 'vardkontakt', '2025-09-12T08:30:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Besök på vårdcentralen', 'Kontroll av blodtryck och förmaksflimmer.'),
    P('hh-2', 'anteckning', '2025-09-12T09:05:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Mottagningsanteckning', 'Blodtryck 142/84. Ingen andfåddhet. Fortsatt behandling med warfarin, PK(INR) följs på vårdcentralen.'),
    P('hh-3', 'diagnos', '2025-09-12T09:05:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Essentiell hypertoni (I10.9)', 'Bidiagnos.'),
    P('hh-4', 'lakemedel', '2025-09-12T09:10:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Amlodipin 5 mg', '1 tablett på morgonen mot högt blodtryck.'),
    P('hh-5', 'vardkontakt', '2026-03-04T13:00:00.000Z', 'ort', 'fysioterapeut', 'Demofysioterapeut Hälsohuset', 'Besök hos fysioterapeut', 'Träning efter fall i hemmet.'),
    P('hh-6', 'anteckning', '2026-03-04T13:40:00.000Z', 'ort', 'fysioterapeut', 'Demofysioterapeut Hälsohuset', 'Fysioterapeutanteckning', 'Balansträning, går med rollator utomhus. Uppföljning om fyra veckor.'),
    // Spärrad hos den andra vårdgivaren på patientens begäran.
    P('hh-7', 'anteckning', '2024-05-20T10:00:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Samtal om alkoholvanor', 'Uppgiften är spärrad hos vårdgivaren.', { sparrad: true }),
  ],
  p13: [
    P('hh-20', 'vardkontakt', '2026-08-02T15:00:00.000Z', 'vc', 'sjukskoterska', 'Demosjuksköterska Hälsohuset', 'Telefonrådgivning', 'Ont i foten efter fotbollsträning.'),
    P('hh-21', 'lakemedel', '2026-08-02T15:20:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Ibuprofen 400 mg', 'Vid behov högst tre gånger per dygn, i högst fem dagar.'),
    P('hh-22', 'diagnos', '2023-01-10T09:00:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Astma (J45.9)', 'Huvuddiagnos.', { sparrad: true }),
  ],
};
const TYPTEXT = { vardkontakt: 'Vårdkontakt', anteckning: 'Anteckning', diagnos: 'Diagnos', lakemedel: 'Läkemedel' };
export const ETIKETT = `Hämtad från ${VARDGIVARE.namn} genom sammanhållen journalföring`;

// Den simulerade vårdgivarens svar: bara uppgifter som inte är spärrade. Spärrade uppgifter lämnas aldrig ut.
function tjanst(patientId) {
  return (POSTER[patientId] ?? []).filter(p => !p.sparrad).map(p => ({
    id: p.id, typ: p.typ, typText: TYPTEXT[p.typ], tid: p.tid, rubrik: p.rubrik, text: p.text,
    vardgivare: { hsaId: VARDGIVARE.hsaId, namn: VARDGIVARE.namn }, vardenhet: ENHETER[p.enhet], yrkesroll: ROLL[p.roll], skapadAv: p.av,
    kalla: `extern:${VARDGIVARE.hsaId}`, kallaEtikett: ETIKETT,
  }));
}

const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
function samtyckeFor(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM sammanhallen_samtycken WHERE patient_id = ? AND aterkallat IS NULL ORDER BY id DESC').all(patientId).find(s => vardenhetFor(db, s.enhet_id) === ve) ?? null;
}
const samtyckeUt = (db, s) => (s ? { id: s.id, registrerat: s.registrerat, registreratAv: personKort(db, s.registrerat_av) } : null);
const valFor = (sess, pid) => sess?.sammanhallen?.get(pid) ?? null;

function prova(atk) {
  const r = atk.krav('las_journal', { beskrivning: 'sammanhallen' });
  return r.grund === 'nodatkomst' ? 'nodatkomst' : 'samtycke';
}

// Uppgifterna efter sortering och urval. sortera: nyast (standard) eller aldst. typ: en av typerna, eller alla.
function urval(poster, { sortera = 'nyast', typ = null } = {}) {
  const ut = typ && Object.hasOwn(TYPTEXT, typ) ? poster.filter(p => p.typ === typ) : [...poster];
  return ut.sort((a, b) => (sortera === 'aldst' ? a.tid.localeCompare(b.tid) : b.tid.localeCompare(a.tid)));
}

// GET: läget för patienten. Uppgifterna finns bara med när de har hämtats efter ett aktivt val i sessionen.
export function lage(atk, sess, fraga = {}) {
  atk.krav('las_journal');
  const db = atk.db;
  const val = valFor(sess, atk.patientId);
  const samtycke = samtyckeFor(db, atk.personal, atk.patientId);
  // Ett aktivt val som bygger på samtycke upphör när samtycket återkallas.
  const giltigt = val && (val.grund === 'nodatkomst' ? atk.prova('las_journal').grund === 'nodatkomst' : Boolean(samtycke));
  const poster = giltigt ? urval(tjanst(atk.patientId), fraga) : [];
  if (giltigt) loggaHamtning(atk, val);
  return {
    vardgivare: [VARDGIVARE], hamtad: Boolean(giltigt), grund: giltigt ? val.grund : null, samtycke: samtyckeUt(db, samtycke), poster,
    typer: TYPTEXT, simulerad: 'Den andra vårdgivaren och dess uppgifter är simulerade i demon.',
    text: giltigt ? `${poster.length} uppgifter från ${VARDGIVARE.namn}.` : samtycke ? 'Patienten har samtyckt. Gör ett aktivt val för att hämta uppgifterna från den andra vårdgivaren.' : 'Patienten kan ha uppgifter hos en annan vårdgivare. Fråga om samtycke för att hämta dem.',
  };
}

function loggaHamtning(atk, val) {
  loggaRad(atk.db, { personal_id: atk.personal.id, enhet_id: atk.personal.enhet_id, patient_id: atk.patientId, handling: 'las_journal', resurs: `sammanhallen:${VARDGIVARE.hsaId}`,
    grund: val.grund, syfte: val.syfte, resultat: 'tillaten' });
}

// POST: det aktiva valet med syfte, och samtycket om det inte redan finns. body: { syfte, samtycke? }
export function hamta(atk, sess, body = {}) {
  const grund = prova(atk);
  const db = atk.db;
  const syfte = typeof body.syfte === 'string' ? body.syfte.trim().slice(0, 300) : '';
  if (syfte.length < 3) throw new Fel(400, 'Ange syftet med att hämta uppgifterna från den andra vårdgivaren.', 'ogiltig', { falt: ['syfte'] });
  if (grund !== 'nodatkomst' && !samtyckeFor(db, atk.personal, atk.patientId)) {
    if (body.samtycke !== true) throw new Fel(400, 'Uppgifter från en annan vårdgivare hämtas bara om patienten samtycker. Fråga patienten och registrera samtycket.', 'ogiltig', { falt: ['samtycke'] });
    db.query('INSERT INTO sammanhallen_samtycken (patient_id, enhet_id, registrerat, registrerat_av) VALUES (?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id);
  }
  sess.sammanhallen ??= new Map();
  sess.sammanhallen.set(atk.patientId, { grund, syfte, tid: iso() });
  atk.loggad = true;
  return lage(atk, sess, {});
}

// POST: återkallar samtycket på vårdenheten och tar bort det aktiva valet.
export function aterkalla(atk, sess) {
  atk.krav('las_journal');
  const db = atk.db;
  const s = samtyckeFor(db, atk.personal, atk.patientId);
  if (s) db.query('UPDATE sammanhallen_samtycken SET aterkallat = ?, aterkallat_av = ? WHERE id = ?').run(iso(), atk.personal.id, s.id);
  sess.sammanhallen?.delete(atk.patientId);
  atk.logga('las_journal', atk.grund(), 'sammanhallen:samtycke:aterkallat');
  return lage(atk, sess, {});
}

// För översiktens tidslinje: de hämtade uppgifterna i samma form som Vårdkällans egna, när det aktiva valet gäller.
export function tidslinje(atk, sess) {
  if (!valFor(sess, atk.patientId) || !atk.prova('las_journal').tillaten) return [];
  const val = valFor(sess, atk.patientId);
  const giltigt = val.grund === 'nodatkomst' ? atk.prova('las_journal').grund === 'nodatkomst' : Boolean(samtyckeFor(atk.db, atk.personal, atk.patientId));
  if (!giltigt) return [];
  loggaHamtning(atk, val);
  return tjanst(atk.patientId).map(p => ({
    tid: p.tid, typ: 'extern', rubrik: `${p.typText}: ${p.rubrik}`, text: `${p.text} ${p.yrkesroll}, ${p.skapadAv}.`, enhet: { id: p.vardenhet.hsaId, namn: p.vardenhet.namn },
    kalla: p.kalla, kallaEtikett: `${ETIKETT}. ${p.vardenhet.namn}, ${p.yrkesroll.toLowerCase()}.`, ref: { typ: 'extern', id: p.id },
  }));
}
