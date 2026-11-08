// Dokumentation vid donation och transplantation (runda 10, r4, Sussa 3.1.12.1).
//
// Donation. När läkaren registrerar att en patient har avlidit på en intensivvårdsavdelning får vårdenhetens
// donationsansvariga läkare och sjuksköterska ett förslag i inkorgen att pröva donation. Utredningen följer en checklista,
// och systemet bockar själv av det som går att räkna ut: att den möjliga donatorn är identifierad, att döden är fastställd
// med direkta kriterier, svaret från Donationsregistret och den avlidnes inställning, och underlaget till
// kvalitetsregistret. För den medicinska bedömningen samlar systemet det som talar emot donation ur journalen (smitta i
// uppmärksamhetsinformationen, diagnoser om tumörsjukdom och åldern), så att ingen behöver leta. Läkaren får en
// donationsanteckning som systemet skriver ur checklistan och som läkaren läser, kompletterar och signerar.
//
// Transplantation. Läkaren registrerar ett transplanterat organ med organ och datum. Systemet sätter diagnoskoden ur
// ICD-10-SE (Z94) som bidiagnos, och uppmärksamhetsinformationen föreslår då själv Förekomst av transplantat.
//
// Behörighet. Donationen läses och dokumenteras av läkare och sjuksköterskor med vårdrelation (handlingen donation) och
// läses som journalen, med inre sekretess, spärr och loggning. Dödsfallet, transplantationen och anteckningen kräver
// läkarens behörighet att skriva i journalen. Donationsregistret, transplantationskoordinatorn och kvalitetsregistret är
// simulerade. Checklistan och reglerna för underlaget är demoregler, inte kliniskt beslutsstöd.
import { createHash } from 'node:crypto';
import { Fel } from './db.js';
import { kanRoll, enheterUnder } from './atkomst.js';
import { ICD10SE } from './kodverk.js';
import * as atgarder from './atgarder.js';
import * as journal from './journal.js';
import * as uppmarksamhet from './uppmarksamhet.js';
import { IVA_ENHETER } from './iva.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, tid as giltigTid, vardkontaktFor, bunden, andraRad, DAG, vardenhetFor, provaRad } from './specialist-hjalp.js';

export const LAS = 'las_journal';
export const SKRIV = 'donation';
export const DEMOREGEL = 'Checklistan och underlaget är demoregler i Vårdkällan, inte kliniskt beslutsstöd. Donationsregistret, transplantationskoordinatorn och kvalitetsregistret är simulerade.';
export const MALL_TYP = 'Donationsanteckning';
export const MALL = { typ: MALL_TYP, kategori: 'lakare', sokord: ['Aktuellt', 'Bedömning', 'Närstående', 'Åtgärd'] };

// Vårdenhetens donationsansvariga läkare (DAL) och sjuksköterska (DAS), som får förslaget i inkorgen. Demoregel: i
// driften utses de av verksamhetschefen.
export const DONATIONSANSVARIGA = tabell({ 'uso-kard': ['lak-kard', 'ssk-kard'] });
export const KRITERIER = tabell({ direkta: 'Direkta kriterier (total hjärninfarkt)', indirekta: 'Indirekta kriterier (hjärtstillestånd)' });
export const VILJA = tabell({ ja: 'Ja till donation', ja_utom: 'Ja, med undantag', nej: 'Nej till donation', okand: 'Inställningen är inte känd' });
export const VILJA_KALLOR = tabell({ donationsregistret: 'Donationsregistret (simulerat)', narstaende: 'Närståendes uppgift om den avlidnes inställning', patienten: 'Patienten själv' });
export const ORGAN = tabell({
  njure: { text: 'Njure', icd: 'Z94.0' }, hjarta: { text: 'Hjärta', icd: 'Z94.1' }, lunga: { text: 'Lunga', icd: 'Z94.2' }, hjarta_lunga: { text: 'Hjärta och lunga', icd: 'Z94.3' },
  lever: { text: 'Lever', icd: 'Z94.4' }, hornhinna: { text: 'Hornhinna', icd: 'Z94.7' }, bukspottkortel: { text: 'Bukspottkörtel', icd: 'Z94.8' },
});
// Referensmaterial för varje del av checklistan.
const LAGAR = {
  transplantation: 'Lag (1995:831) om transplantation m.m.',
  dod: 'Lag (1987:269) om kriterier för bestämmande av människans död',
};
// Checklistan i den ordning den görs. auto: systemet bockar av punkten själv.
export const PUNKTER = [
  { id: 'identifierad', text: 'Möjlig donator identifierad på intensivvårdsavdelningen', auto: true, referens: LAGAR.transplantation },
  { id: 'dodsdiagnos', text: 'Döden fastställd', auto: true, referens: LAGAR.dod },
  { id: 'registret', text: 'Donationsregistret kontrollerat', auto: true, referens: LAGAR.transplantation },
  { id: 'installning', text: 'Den avlidnes inställning till donation utredd', auto: true, referens: LAGAR.transplantation },
  { id: 'narstaende', text: 'Närstående informerade om dödsfallet och om donationen', auto: false, referens: LAGAR.transplantation },
  { id: 'lamplighet', text: 'Medicinsk bedömning av lämpligheten', auto: false, referens: 'Vårdgivarens rutin för donation (demo)' },
  { id: 'koordinator', text: 'Transplantationskoordinatorn kontaktad', auto: false, referens: 'Vårdgivarens rutin för donation (demo)' },
  { id: 'kvalitetsregister', text: 'Underlag till kvalitetsregistret klart', auto: true, referens: 'Kvalitetsregister för donation (simulerat)' },
];
const PUNKT = Object.fromEntries(PUNKTER.map(p => [p.id, p]));

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS dodsfall (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, tid TEXT NOT NULL, kriterier TEXT NOT NULL,
  registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS dodsfall_andras_ej BEFORE UPDATE OF enhet_id, tid, kriterier, registrerad, registrerad_av ON dodsfall BEGIN SELECT RAISE(ABORT, 'Ett registrerat dödsfall ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS dodsfall_raderas_ej BEFORE DELETE ON dodsfall BEGIN SELECT RAISE(ABORT, 'Ett registrerat dödsfall raderas inte.'); END;
CREATE TABLE IF NOT EXISTS donationer (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, dodsfall_id INTEGER, startad TEXT NOT NULL, startad_av TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pagar', avslutad TEXT, avslutad_av TEXT, organ TEXT, avslut_text TEXT, CHECK (status IN ('pagar', 'genomford', 'avbruten'))
);
CREATE TRIGGER IF NOT EXISTS donationer_andras_ej BEFORE UPDATE OF enhet_id, dodsfall_id, startad, startad_av ON donationer BEGIN SELECT RAISE(ABORT, 'En donationsutredning ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS donationer_avslutas_en_gang BEFORE UPDATE OF status ON donationer WHEN OLD.status <> 'pagar' BEGIN SELECT RAISE(ABORT, 'Donationsutredningen är redan avslutad.'); END;
CREATE TRIGGER IF NOT EXISTS donationer_raderas_ej BEFORE DELETE ON donationer BEGIN SELECT RAISE(ABORT, 'En donationsutredning raderas inte.'); END;
CREATE TABLE IF NOT EXISTS donation_punkter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, donation_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, punkt TEXT NOT NULL, status TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT, kommentar TEXT, CHECK (status IN ('klar', 'ej_aktuell', 'kvar'))
);
CREATE TRIGGER IF NOT EXISTS donation_punkter_andras_ej BEFORE UPDATE ON donation_punkter BEGIN SELECT RAISE(ABORT, 'En bockad punkt ändras inte. Bocka den igen.'); END;
CREATE TRIGGER IF NOT EXISTS donation_punkter_raderas_ej BEFORE DELETE ON donation_punkter BEGIN SELECT RAISE(ABORT, 'En bockad punkt raderas inte.'); END;
CREATE TABLE IF NOT EXISTS donationsvilja (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kalla TEXT NOT NULL, vilja TEXT NOT NULL, undantag TEXT, tid TEXT NOT NULL, av TEXT
);
CREATE TRIGGER IF NOT EXISTS donationsvilja_andras_ej BEFORE UPDATE OF enhet_id, kalla, vilja, undantag, tid, av ON donationsvilja BEGIN SELECT RAISE(ABORT, 'En registrerad inställning ändras inte. Registrera en ny.'); END;
CREATE TRIGGER IF NOT EXISTS donationsvilja_raderas_ej BEFORE DELETE ON donationsvilja BEGIN SELECT RAISE(ABORT, 'En registrerad inställning raderas inte.'); END;
CREATE TABLE IF NOT EXISTS transplantationer (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, organ TEXT NOT NULL, datum TEXT NOT NULL, centrum TEXT, diagnos_id INTEGER,
  registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS transplantationer_andras_ej BEFORE UPDATE OF enhet_id, organ, datum, centrum, registrerad, registrerad_av ON transplantationer BEGIN SELECT RAISE(ABORT, 'En registrerad transplantation ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS transplantationer_raderas_ej BEFORE DELETE ON transplantationer BEGIN SELECT RAISE(ABORT, 'En registrerad transplantation raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }
export const finnsTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'donationer'").get());

export function donationRad(db, id) {
  sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM donationer WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Donationsutredningen finns inte.', 'saknas');
  return r;
}

// Den simulerade slagningen i Donationsregistret. Svaret är påhittat och detsamma varje gång för samma patient.
export function donationsregistret(p) {
  const n = createHash('sha256').update(`donationsregistret:${p.id}`).digest()[0] % 4;
  const vilja = ['ja', 'ja', 'okand', 'nej'][n];
  return { vilja, text: VILJA[vilja], simulerat: true, kalla: VILJA_KALLOR.donationsregistret };
}

// Om patienten vårdas på en intensivvårdsavdelning just nu, eller vårdades där när dödsfallet registrerades.
const pagaendeIva = (db, patientId) => db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND typ = 'slutenvard' AND slut IS NULL AND enhet_id IN (${Object.keys(IVA_ENHETER).map(() => '?').join(', ')}) ORDER BY start DESC`)
  .get(patientId, ...Object.keys(IVA_ENHETER));

const dodsfallFor = (atk) => atk.filtrera(atk.db.query('SELECT * FROM dodsfall WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId), LAS)[0] ?? null;
const viljaFor = (atk) => atk.filtrera(atk.db.query('SELECT * FROM donationsvilja WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId), LAS);
const punkterFor = (db, d) => db.query('SELECT * FROM donation_punkter WHERE donation_id = ? ORDER BY id').all(d.id);

// Det i journalen som talar emot donation eller behöver bedömas, bland det som anroparen får se.
export function underlag(atk, p) {
  const db = atk.db;
  const ut = [];
  const diagnoser = atk.filtrera(db.query('SELECT * FROM diagnoser WHERE patient_id = ?').all(atk.patientId), 'las_diagnoser');
  for (const d of diagnoser) if (/^(C\d\d|D0\d)/.test(d.kod)) ut.push({ typ: 'tumor', text: `Diagnos om tumörsjukdom: ${d.kod} ${d.text}. Bedöm om den utesluter donation.` });
  for (const x of uppmarksamhet.forHuvud(atk)?.poster ?? []) if (x.kategori === 'smitta') ut.push({ typ: 'smitta', text: `Smitta i uppmärksamhetsinformationen: ${x.term}. Bedöm risken för överföring.` });
  const ar = Number(iso(new Date()).slice(0, 4)) - Number(String(p.fodd).slice(0, 4));
  ut.push({ typ: 'alder', text: `Patienten var ${ar} år. Ålder utesluter i sig inte donation.` });
  return ut;
}

// Punkternas status: den senaste bockningen per punkt, eller vad systemet räknar ut.
function checklista(atk, d, p) {
  const db = atk.db;
  const bockade = new Map(punkterFor(db, d).map(r => [r.punkt, r]));
  const df = d.dodsfall_id ? db.query('SELECT * FROM dodsfall WHERE id = ?').get(d.dodsfall_id) : null;
  const vilja = viljaFor(atk);
  const registret = vilja.find(v => v.kalla === 'donationsregistret');
  const kand = vilja.find(v => v.vilja !== 'okand');
  const auto = {
    identifierad: { status: 'klar', text: `Startad ${d.startad.slice(0, 10)} av ${personNamn(db, d.startad_av)}.`, av: 'system' },
    dodsdiagnos: df ? { status: 'klar', text: `${KRITERIER[df.kriterier]}, ${df.tid.slice(0, 16).replace('T', ' ')}.`, av: 'system' } : { status: 'kvar', text: 'Inget dödsfall är registrerat.' },
    registret: registret ? { status: 'klar', text: `${VILJA[registret.vilja]} (${VILJA_KALLOR.donationsregistret}).`, av: 'system' } : { status: 'kvar', text: 'Inte kontrollerat.' },
    installning: kand ? { status: 'klar', text: `${VILJA[kand.vilja]}${kand.undantag ? `, utom ${kand.undantag}` : ''}. Källa: ${VILJA_KALLOR[kand.kalla]}.`, av: 'system' }
      : { status: 'kvar', text: 'Inställningen är inte känd. Fråga de närstående om den avlidnes inställning.' },
  };
  const lista = PUNKTER.filter(x => x.id !== 'kvalitetsregister').map(x => {
    const b = bockade.get(x.id);
    const a = auto[x.id];
    const s = b ? { status: b.status, detalj: b.kommentar ?? (b.status === 'ej_aktuell' ? 'Inte aktuell.' : 'Klar.'), av: personNamn(db, b.av), tid: b.tid }
      : a ? { status: a.status, detalj: a.text, av: a.av ?? null } : { status: 'kvar', detalj: '' };
    return { id: x.id, text: x.text, auto: x.auto, referens: x.referens, ...s };
  });
  const klar = lista.every(x => x.status !== 'kvar');
  lista.push({ id: 'kvalitetsregister', text: PUNKT.kvalitetsregister.text, auto: true, referens: PUNKT.kvalitetsregister.referens, status: klar ? 'klar' : 'kvar', detalj: klar ? 'Systemet har sammanställt underlaget.' : 'Klart när checklistan är klar.', av: klar ? 'system' : null });
  return { lista, klar, df, kand };
}

// Underlaget till kvalitetsregistret. Utan namn och personnummer: donationens nummer, ålder, kön och utfallet.
function kvalitetsregister(d, p, c) {
  const ar = Number((d.avslutad ?? d.startad).slice(0, 4)) - Number(String(p.fodd).slice(0, 4));
  return {
    register: 'Kvalitetsregister för donation (simulerat)', klar: c.klar,
    falt: { donation: d.id, alder: ar, kon: p.kon, kriterier: c.df ? KRITERIER[c.df.kriterier] : null, installning: c.kand ? VILJA[c.kand.vilja] : null,
      utfall: { pagar: 'Utredning pågår', genomford: 'Donation genomförd', avbruten: 'Donation inte genomförd' }[d.status], organ: d.organ ? JSON.parse(d.organ).map(o => ORGAN[o]?.text ?? o) : [] },
  };
}

export function donationUt(atk, d, p) {
  const db = atk.db;
  const c = checklista(atk, d, p);
  return {
    id: d.id, status: d.status, statusText: { pagar: 'Utredning pågår', genomford: 'Donation genomförd', avbruten: 'Avbruten' }[d.status],
    startad: { tid: d.startad, av: personNamn(db, d.startad_av) }, vardenhet: enhetKort(db, d.enhet_id), checklista: c.lista, klar: c.klar,
    underlag: underlag(atk, p), kvalitetsregister: kvalitetsregister(d, p, c),
    avslutad: d.avslutad ? { tid: d.avslutad, av: personNamn(db, d.avslutad_av), text: d.avslut_text, organ: d.organ ? JSON.parse(d.organ).map(o => ORGAN[o]?.text ?? o) : [] } : null,
    demoregel: DEMOREGEL,
  };
}

// GET /api/patient/:id/donation
export function oversikt(atk, p) {
  const db = atk.db;
  sakra(db);
  atk.krav(LAS);
  const df = dodsfallFor(atk);
  const donationer = atk.filtrera(db.query('SELECT * FROM donationer WHERE patient_id = ? ORDER BY startad DESC, id DESC').all(atk.patientId), LAS);
  const transpl = atk.filtrera(db.query('SELECT * FROM transplantationer WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(atk.patientId), LAS);
  // Intensivvården räknas bara när den hör till den egna vårdenheten, så att svaret inte röjer var patienten vårdas.
  const ivaAlla = pagaendeIva(db, atk.patientId);
  const iva = ivaAlla && vardenhetFor(db, ivaAlla.enhet_id) === vardenhetFor(db, atk.personal.enhet_id) ? ivaAlla : null;
  const pagar = donationer.find(d => d.status === 'pagar');
  return {
    dodsfall: df ? { id: df.id, tid: df.tid, kriterier: df.kriterier, kriterierText: KRITERIER[df.kriterier], registreradAv: personNamn(db, df.registrerad_av), vardenhet: enhetKort(db, df.enhet_id) } : null,
    donationer: donationer.map(d => donationUt(atk, d, p)),
    vilja: viljaFor(atk).map(v => ({ id: v.id, vilja: v.vilja, text: VILJA[v.vilja], kalla: VILJA_KALLOR[v.kalla], undantag: v.undantag, tid: v.tid, av: personNamn(db, v.av) })),
    transplantationer: transpl.map(t => ({ id: t.id, organ: ORGAN[t.organ]?.text ?? t.organ, datum: t.datum, centrum: t.centrum, diagnos: ORGAN[t.organ] ? { kod: ORGAN[t.organ].icd, text: ICD10SE[ORGAN[t.organ].icd] } : null,
      registreradAv: personNamn(db, t.registrerad_av) })),
    // Systemets förslag: på intensivvården, eller efter ett dödsfall där, kan en utredning startas med ett klick.
    forslag: !pagar && kanRoll(atk.personal, SKRIV) && (df || iva) && vardenhetFor(db, (df ?? iva).enhet_id) === vardenhetFor(db, atk.personal.enhet_id)
      ? { text: df ? 'Patienten har avlidit på intensivvårdsavdelningen. Pröva om patienten kan bli donator.' : 'Patienten vårdas på intensivvårdsavdelningen. Starta en donationsutredning om patienten kan bli en möjlig donator.' } : null,
    kanDokumentera: kanRoll(atk.personal, SKRIV), kanRegistreraDodsfall: kanRoll(atk.personal, SKRIV) && kanRoll(atk.personal, 'skriv_journal') && !df && Boolean(iva),
    kanRegistreraTransplantation: kanRoll(atk.personal, 'skriv_journal'),
    kriterier: Object.entries(KRITERIER).map(([id, text]) => ({ id, text })), viljor: Object.entries(VILJA).map(([id, text]) => ({ id, text })),
    organ: Object.entries(ORGAN).map(([id, o]) => ({ id, text: o.text, icd: o.icd })), punkter: PUNKTER.filter(x => !x.auto).map(x => ({ id: x.id, text: x.text })),
    demoregel: DEMOREGEL, dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}

const kravLakare = (atk) => { if (!kanRoll(atk.personal, 'skriv_journal')) throw new Fel(403, 'Det är läkaren som registrerar det.', 'nekad'); atk.krav('skriv_journal'); };

// POST /api/patient/:id/dodsfall { tid?, kriterier }: läkaren på intensivvårdsavdelningen registrerar dödsfallet.
export function registreraDodsfall(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav(SKRIV);
  kravLakare(atk);
  const iva = pagaendeIva(db, atk.patientId);
  if (!iva || vardenhetFor(db, iva.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) throw new Fel(409, 'Patienten vårdas inte på en intensivvårdsavdelning på din vårdenhet.', 'ogiltig');
  if (db.query('SELECT enhet_id FROM dodsfall WHERE patient_id = ?').all(atk.patientId).some(r => vardenhetFor(db, r.enhet_id) === vardenhetFor(db, atk.personal.enhet_id))) throw new Fel(409, 'Dödsfallet är redan registrerat.', 'finns_redan');
  if (!finns(KRITERIER, body.kriterier)) throw new Fel(400, 'Välj hur döden fastställdes.', 'ogiltig', { falt: ['kriterier'] });
  const tid = giltigTid(body.tid, 'tid', nu, { bakat: 2 * DAG });
  const r = db.query('INSERT INTO dodsfall (patient_id, enhet_id, vardkontakt_id, tid, kriterier, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, iva.enhet_id, iva.id, tid, body.kriterier, iso(nu), atk.personal.id);
  return { id: Number(r.lastInsertRowid), tid, kriterier: body.kriterier, kriterierText: KRITERIER[body.kriterier], text: 'Dödsfallet är registrerat. Vårdenhetens donationsansvariga har fått ett förslag att pröva donation.' };
}

// POST /api/patient/:id/donation: startar utredningen. Systemet slår upp Donationsregistret (simulerat) direkt.
export function starta(atk, p, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav(SKRIV);
  const df = db.query('SELECT * FROM dodsfall WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId).find(r => vardenhetFor(db, r.enhet_id) === vardenhetFor(db, atk.personal.enhet_id)) ?? null;
  const iva = pagaendeIva(db, atk.patientId);
  const enhet = (df ?? iva)?.enhet_id;
  if (!enhet || vardenhetFor(db, enhet) !== vardenhetFor(db, atk.personal.enhet_id)) throw new Fel(409, 'En donationsutredning startas på intensivvårdsavdelningen där patienten vårdas.', 'ogiltig');
  if (db.query("SELECT enhet_id FROM donationer WHERE patient_id = ? AND status = 'pagar'").all(atk.patientId).some(r => vardenhetFor(db, r.enhet_id) === vardenhetFor(db, enhet))) throw new Fel(409, 'En donationsutredning pågår redan.', 'finns_redan');
  const r = db.query('INSERT INTO donationer (patient_id, enhet_id, dodsfall_id, startad, startad_av) VALUES (?, ?, ?, ?, ?)').run(atk.patientId, enhet, df?.id ?? null, iso(nu), atk.personal.id);
  const reg = donationsregistret(p);
  db.query("INSERT INTO donationsvilja (patient_id, enhet_id, kalla, vilja, tid, av) VALUES (?, ?, 'donationsregistret', ?, ?, ?)").run(atk.patientId, enhet, reg.vilja, iso(nu), atk.personal.id);
  atk.logga(SKRIV, atk.grund(), `donationsregistret:${atk.patientId}`, 'tillaten', 'Slagning i Donationsregistret (simulerat) inför donation.');
  return donationUt(atk, donationRad(db, r.lastInsertRowid), p);
}

const andra = (atk, d) => andraRad(atk, bunden(atk, d), SKRIV, LAS, 'Donationsutredningen dokumenteras på den vårdenhet där den startades.');

// POST /api/donation/:id/punkt { punkt, status, kommentar? }
export function bocka(atk, d, p, body = {}, nu = new Date()) {
  andra(atk, d);
  if (d.status !== 'pagar') throw new Fel(409, 'Donationsutredningen är avslutad.', 'avslutad');
  const x = PUNKTER.find(q => q.id === body.punkt);
  if (!x || x.auto) throw new Fel(400, 'Den punkten bockar systemet av själv.', 'ogiltig', { falt: ['punkt'] });
  if (!['klar', 'ej_aktuell'].includes(body.status)) throw new Fel(400, 'Ange om punkten är klar eller inte aktuell.', 'ogiltig', { falt: ['status'] });
  if (body.status === 'ej_aktuell' && !textFalt(body.kommentar, 300)) throw new Fel(400, 'Skriv varför punkten inte är aktuell.', 'ogiltig', { falt: ['kommentar'] });
  atk.db.query('INSERT INTO donation_punkter (donation_id, patient_id, enhet_id, punkt, status, tid, av, kommentar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(d.id, d.patient_id, atk.personal.enhet_id, x.id, body.status, iso(nu), atk.personal.id, textFalt(body.kommentar, 300) || null);
  // Den medicinska bedömningen är undersökningen av en möjlig donator, som får sin KVÅ-kod av systemet.
  if (x.id === 'lamplighet' && body.status === 'klar') atgarder.registreraAtgard(atk, { kod: 'AV124', tid: iso(nu), vardkontaktId: vardkontaktFor(atk, nu), underlag: { donation: d.id } });
  return donationUt(atk, donationRad(atk.db, d.id), p);
}

// POST /api/patient/:id/donationsvilja { vilja, kalla, undantag? }: oftast de närståendes uppgift om den avlidnes inställning.
export function registreraVilja(atk, body = {}, nu = new Date()) {
  sakra(atk.db);
  atk.krav(SKRIV);
  if (!finns(VILJA, body.vilja)) throw new Fel(400, 'Välj inställningen till donation.', 'ogiltig', { falt: ['vilja'] });
  const kalla = body.kalla ?? 'narstaende';
  if (!finns(VILJA_KALLOR, kalla) || kalla === 'donationsregistret') throw new Fel(400, 'Välj var uppgiften kommer ifrån.', 'ogiltig', { falt: ['kalla'] });
  const undantag = textFalt(body.undantag, 200) || null;
  if (body.vilja === 'ja_utom' && !undantag) throw new Fel(400, 'Skriv vilka organ eller vävnader som inte får tas.', 'ogiltig', { falt: ['undantag'] });
  atk.db.query('INSERT INTO donationsvilja (patient_id, enhet_id, kalla, vilja, undantag, tid, av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, kalla, body.vilja, undantag, iso(nu), atk.personal.id);
  return { vilja: body.vilja, text: VILJA[body.vilja], kalla: VILJA_KALLOR[kalla], undantag };
}

// POST /api/donation/:id/anteckning: systemet skriver donationsanteckningen ur checklistan som ett utkast åt läkaren.
export function anteckning(atk, d, p, nu = new Date()) {
  andra(atk, d);
  kravLakare(atk);
  const u = donationUt(atk, d, p);
  const rad = (id) => u.checklista.find(x => x.id === id);
  const kvar = u.checklista.filter(x => x.status === 'kvar' && x.id !== 'kvalitetsregister').map(x => x.text.toLocaleLowerCase('sv'));
  const sokord = [
    { sokord: 'Aktuellt', text: `Döden fastställd: ${rad('dodsdiagnos').detalj} Donationsutredningen: ${rad('identifierad').detalj}` },
    { sokord: 'Bedömning', text: `${u.underlag.map(x => x.text).join(' ')} ${rad('lamplighet').status === 'klar' ? `Medicinsk bedömning: ${rad('lamplighet').detalj}` : 'Den medicinska bedömningen är inte gjord.'}` },
    { sokord: 'Närstående', text: `${rad('narstaende').status === 'klar' ? `Närstående informerade. ${rad('narstaende').detalj}` : 'Närstående är inte informerade än.'} ${rad('installning').detalj}` },
    { sokord: 'Åtgärd', text: kvar.length ? `Kvar i checklistan: ${kvar.join(', ')}.` : 'Alla punkter i checklistan är klara.' },
  ];
  const vk = d.dodsfall_id ? atk.db.query('SELECT vardkontakt_id FROM dodsfall WHERE id = ?').get(d.dodsfall_id)?.vardkontakt_id : vardkontaktFor(atk, nu);
  return journal.skapaAnteckning(atk, { typ: MALL_TYP, vardkontaktId: vk ?? null, sokord });
}

// POST /api/donation/:id/avsluta { status: genomford | avbruten, organ?, text? }
export function avsluta(atk, d, p, body = {}, nu = new Date()) {
  andra(atk, d);
  if (d.status !== 'pagar') throw new Fel(409, 'Donationsutredningen är redan avslutad.', 'avslutad');
  if (!['genomford', 'avbruten'].includes(body.status)) throw new Fel(400, 'Ange om donationen genomfördes.', 'ogiltig', { falt: ['status'] });
  const organ = Array.isArray(body.organ) ? [...new Set(body.organ)] : [];
  if (organ.some(o => !finns(ORGAN, o))) throw new Fel(400, 'Okänt organ.', 'ogiltig', { falt: ['organ'] });
  if (body.status === 'genomford') {
    if (!organ.length) throw new Fel(400, 'Välj vilka organ som donerades.', 'ogiltig', { falt: ['organ'] });
    if (!checklista(atk, d, p).klar) throw new Fel(409, 'Checklistan är inte klar. Bocka av det som är kvar innan donationen registreras som genomförd.', 'ogiltig');
  }
  const text = textFalt(body.text, 300) || null;
  if (body.status === 'avbruten' && !text) throw new Fel(400, 'Skriv varför donationen inte genomfördes.', 'ogiltig', { falt: ['text'] });
  atk.db.query('UPDATE donationer SET status = ?, avslutad = ?, avslutad_av = ?, organ = ?, avslut_text = ? WHERE id = ?').run(body.status, iso(nu), atk.personal.id, JSON.stringify(organ), text, d.id);
  return donationUt(atk, donationRad(atk.db, d.id), p);
}

// POST /api/patient/:id/transplantationer { organ, datum, centrum? }: läkaren registrerar ett transplanterat organ.
// Systemet sätter bidiagnosen ur ICD-10-SE.
export function registreraTransplantation(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  kravLakare(atk);
  if (!finns(ORGAN, body.organ)) throw new Fel(400, 'Välj vilket organ som transplanterades.', 'ogiltig', { falt: ['organ'] });
  const idag = iso(nu).slice(0, 10);
  if (typeof body.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.datum) || Number.isNaN(Date.parse(body.datum)) || body.datum > idag) {
    throw new Fel(400, 'Datumet för transplantationen ska skrivas ÅÅÅÅ-MM-DD och kan inte ligga i framtiden.', 'ogiltig', { falt: ['datum'] });
  }
  const o = ORGAN[body.organ];
  const vk = vardkontaktFor(atk, nu);
  const diag = db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, 'bi', ?, 'vardkallan') RETURNING id")
    .get(atk.patientId, atk.personal.enhet_id, vk, o.icd, ICD10SE[o.icd], idag).id;
  const r = db.query('INSERT INTO transplantationer (patient_id, enhet_id, organ, datum, centrum, diagnos_id, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, body.organ, body.datum, textFalt(body.centrum, 100) || null, diag, iso(nu), atk.personal.id);
  return { id: Number(r.lastInsertRowid), organ: o.text, datum: body.datum, diagnos: { kod: o.icd, text: ICD10SE[o.icd] }, text: `Bidiagnosen ${o.icd} ${ICD10SE[o.icd]} är registrerad. Uppmärksamhetsinformationen föreslår Förekomst av transplantat.` };
}

// Förslagen i inkorgen för vårdenhetens donationsansvariga: dödsfall på intensivvården utan utredning, och utredningar
// som pågår med det som är kvar. Bara patienter som den donationsansvariga får se på den egna vårdenheten.
export function inkorg(db, personal, valFor = () => ({})) {
  if (!finnsTabell(db) || !personal) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!Object.hasOwn(DONATIONSANSVARIGA, ve) || !DONATIONSANSVARIGA[ve].includes(personal.id)) return [];
  const under = enheterUnder(db, ve);
  const ph = under.map(() => '?').join(', ');
  const ut = [];
  for (const df of db.query(`SELECT * FROM dodsfall WHERE enhet_id IN (${ph}) ORDER BY tid DESC`).all(...under)) {
    if (!provaRad(db, personal, valFor, df, LAS).tillaten) continue;
    const pagar = db.query("SELECT * FROM donationer WHERE patient_id = ? AND status = 'pagar'").get(df.patient_id);
    const klar = db.query("SELECT 1 FROM donationer WHERE patient_id = ? AND status <> 'pagar'").get(df.patient_id);
    if (klar) continue;
    ut.push({ patientId: df.patient_id, donationId: pagar?.id ?? null, tid: df.tid,
      rubrik: pagar ? 'Donationsutredning pågår' : 'Möjlig donator', text: pagar ? 'Fortsätt checklistan för donation.' : 'Patienten har avlidit på intensivvårdsavdelningen. Pröva om patienten kan bli donator.',
      href: `#/patient/${encodeURIComponent(df.patient_id)}/donation` });
  }
  return ut;
}

// POST /api/demo/donation: i den egna sandlådan läggs patient 10 in på hjärtintensiven efter ett hjärtstopp, så att
// flödet vid donation kan visas. Görs bara en gång per sandlåda.
export const DEMO_PATIENT = 'p10';
export function demo(db, nu = new Date()) {
  sakra(db);
  const fanns = pagaendeIva(db, DEMO_PATIENT);
  if (fanns) return { patientId: DEMO_PATIENT, vardkontaktId: fanns.id, ny: false };
  const start = iso(nu.getTime() - DAG);
  const r = db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla) VALUES (?, 'uso-kard-hia', 'slutenvard', ?, 'Hjärtintensiven, sal 2', 'Hjärtstopp utanför sjukhus, efter återupplivning', 'vardkallan')")
    .run(DEMO_PATIENT, start);
  return { patientId: DEMO_PATIENT, vardkontaktId: Number(r.lastInsertRowid), ny: true };
}

// Tidslinjen: dödsfallet och donationsutredningen, med samma behörighet som fliken.
export function tidslinje(atk) {
  if (!finnsTabell(atk.db) || !kanRoll(atk.personal, LAS)) return [];
  const db = atk.db;
  const ut = [];
  const df = dodsfallFor(atk);
  if (df) ut.push({ tid: df.tid, typ: 'dodsfall', rubrik: 'Dödsfall', text: KRITERIER[df.kriterier], enhet: enhetKort(db, df.enhet_id), kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'donation', id: df.id } });
  for (const d of atk.filtrera(db.query('SELECT * FROM donationer WHERE patient_id = ?').all(atk.patientId), LAS)) {
    ut.push({ tid: d.startad, typ: 'donation', rubrik: 'Donationsutredning startad', text: '', enhet: enhetKort(db, d.enhet_id), kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'donation', id: d.id } });
  }
  return ut;
}
