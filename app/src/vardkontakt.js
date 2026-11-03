// Vårdkontakt, vårdtillfälle och hälsoärende som bärande struktur (Sussa 6.1.1, 3.4.4 och 3.1.7).
//
// Systemet är experten. Den som dokumenterar, ordinerar, mäter eller remitterar väljer aldrig en vårdkontakt:
//   1. Pågår ett vårdtillfälle på den egna vårdenheten, eller ett där vårdenheten har det medicinska ansvaret, hamnar
//      uppgiften på avdelningens pågående kontakt.
//   2. Annars ett pågående akutbesök, eller en kontakt i dag på den egna vårdenheten.
//   3. Finns ingen skapar systemet en kontakt med typ och enhet ur sammanhanget: akutbesök på akutmottagningen, annars
//      ett besök på enhetens mottagning. En remiss till vårdenheten blir kontaktorsak och kopplas till kontakten.
// Kontakten visas innan något sparas och kan ändras. Ett vårdtillfälle följer med när patienten flyttas: det som redan
// är dokumenterat ligger kvar på sin kontakt, och nästa uppgift hamnar på den nya avdelningens kontakt i samma
// vårdtillfälle. Hälsoärenden föreslås av systemet ur samma diagnos, en remisskedja eller en övergång mellan vårdformer,
// och bekräftas med ett klick. Schemat och knytningen av befintlig historik finns i vardstruktur.js.
import { Fel, iso, idag, addDagar, datumAv, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, alder } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';

export const KONTAKTSATT = { besok: 'Besök', telefon: 'Telefon', video: 'Video', hembesok: 'Hembesök' };
const PLATS = { telefon: 'Telefonkontakt', video: 'Videobesök', hembesok: 'Hembesök' };
const STANDARDORSAK = { besok: 'Besök', telefon: 'Telefonkontakt', video: 'Videobesök', hembesok: 'Hembesök' };
export const HANDELSE = {
  inskrivning: 'Inskriven', sangbyte: 'Sängbyte', flytt: 'Flyttad', ansvar: 'Medicinskt ansvar ändrat',
  permission: 'Permission', ater: 'Åter från permission', utskrivning: 'Utskriven',
};

// Patientavgifter enligt demoregler. Beloppen är påhittade och inte någon regions avgifter.
export const AVGIFT_DEMO = { besok: 200, video: 200, hembesok: 200, telefon: 0, akut: 400, slutenvardDygn: 100, hogkostnadsskydd: 1450, friUnder: 20, friFran: 85 };

const TIMME = 3600_000;
const enhetRad = (db, id) => db.query('SELECT * FROM enheter WHERE id = ?').get(id);
const enhetKort = (db, id) => { const e = id && enhetRad(db, id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, titel: p.titel } : null;
};
const kort = (s, n = 120) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}.` : s);
const textFalt = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function status(v, nu = Date.now()) {
  if (v.slut) return 'avslutad';
  if (Date.parse(v.start) > nu && !v.ankomst) return 'planerad';
  return 'pagaende';
}

export function hamtaKontakt(db, id) {
  const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(Number(id));
  if (!v) throw new Fel(404, 'Vårdkontakten finns inte.', 'saknas');
  return v;
}
export function hamtaVardtillfalle(db, id) {
  const v = db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(Number(id));
  if (!v) throw new Fel(404, 'Vårdtillfället finns inte.', 'saknas');
  return v;
}

// Vårdkontakten för personalen: med vem, var och när den registrerades, och avgiften för den som registrerar kontakter.
export function kontaktUt(db, v, personal = null) {
  const ut = {
    id: v.id, typ: v.typ, kontaktsatt: v.kontaktsatt ?? null, start: v.start, slut: v.slut, ankomst: v.ankomst ?? null,
    planerad: Boolean(v.planerad), status: status(v), pagaende: v.slut == null, plats: v.plats, orsak: v.orsak,
    vardenhet: enhetKort(db, v.enhet_id), kalla: v.kalla, kallaEtikett: journal.kallaEtikett(v.kalla, v.start),
    vardtillfalleId: v.vardtillfalle_id ?? null, halsoarendeId: v.halsoarende_id ?? null, foregaendeId: v.foregaende_id ?? null,
    automatisk: Boolean(v.automatisk), skapad: v.skapad ?? v.start, skapadAv: personKort(db, v.skapad_av),
    andrad: v.andrad ?? null, andradAv: personKort(db, v.andrad_av),
  };
  if (personal && kanRoll(personal, 'registrera_vardkontakt') && v.typ !== 'slutenvard') {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(v.patient_id);
    ut.avgift = avgiftFor(db, p, v);
    ut.kanAndras = vardenhetFor(db, v.enhet_id) === vardenhetFor(db, personal.enhet_id) && v.kalla === 'vardkallan';
  }
  return ut;
}

// Enheten som en ny kontakt hamnar på: den egna arbetsplatsen om det är en mottagning, annars vårdenhetens
// mottagning, annars den egna enheten. Så hamnar en vårdadministratör på kliniken på klinikens mottagning.
function mottagning(db, personal) {
  const egen = enhetRad(db, personal.enhet_id);
  if (egen?.typ === 'arbetsplats' && /mottagning/i.test(egen.namn)) return egen.id;
  const ve = vardenhetFor(db, personal.enhet_id);
  const m = db.query("SELECT id FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats' AND namn LIKE '%mottagning%' ORDER BY id").get(ve);
  return m?.id ?? personal.enhet_id;
}

// Öppen remiss till vårdenheten: skickad, mottagen eller bedömd och accepterad, men inte besvarad.
function oppenRemiss(db, patientId, ve) {
  return db.query("SELECT * FROM remisser WHERE patient_id = ? AND till_enhet_id = ? AND status IN ('skickad', 'mottagen', 'bedomd') AND coalesce(beslut, '') <> 'avvisad' ORDER BY skickad_tid DESC")
    .get(patientId, ve);
}

// Den pågående vårdkontakten som ny dokumentation hamnar på, eller null. Se reglerna överst i filen.
export function pagandeFor(db, personal, patientId, nu = Date.now()) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const rader = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) ORDER BY start DESC, id DESC`).all(patientId, ...enheter);
  const sluten = rader.find(v => v.typ === 'slutenvard' && v.slut == null);
  if (sluten) return sluten;
  const ansvar = db.query('SELECT id FROM vardtillfallen WHERE patient_id = ? AND enhet_id = ? AND utskriven IS NULL').get(patientId, ve);
  if (ansvar) {
    const v = db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? AND slut IS NULL ORDER BY start DESC').get(ansvar.id);
    if (v) return v;
  }
  const startad = (v) => v.ankomst || Date.parse(v.start) <= nu + TIMME;
  const akut = rader.find(v => v.typ === 'akut' && v.slut == null && startad(v));
  if (akut) return akut;
  const dag = datumAv(new Date(nu));
  return rader.filter(v => v.typ !== 'slutenvard' && datumAv(new Date(v.start)) === dag && startad(v))
    .sort((a, b) => (a.slut == null ? 0 : 1) - (b.slut == null ? 0 : 1))[0] ?? null;
}

// Den kontakt som systemet skulle skapa. kontext: { kontaktsatt, orsak } från användaren eller ur det som dokumenteras.
function nyKontaktForslag(db, personal, patientId, kontext = {}) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const akut = ve === 'uso-akut';
  const enhetId = akut ? personal.enhet_id : mottagning(db, personal);
  const kontaktsatt = kontext.kontaktsatt ?? 'besok';
  const r = oppenRemiss(db, patientId, ve);
  const e = enhetRad(db, enhetId);
  const plats = PLATS[kontaktsatt] ?? (akut ? 'Akutmottagningen' : e?.typ === 'arbetsplats' ? e.namn : 'Mottagning');
  const orsak = kontext.orsak || (r && kanRoll(personal, 'las_remiss') ? `Remiss: ${kort(r.fragestallning)}` : null) || kontext.dokumentOrsak
    || (akut ? 'Akutbesök' : STANDARDORSAK[kontaktsatt]);
  return { typ: akut ? 'akut' : 'oppenvard', kontaktsatt, plats, orsak, enhetId, remissId: r?.id ?? null };
}

function valideraNyKontakt(nyKontakt) {
  if (nyKontakt == null) return null;
  if (typeof nyKontakt !== 'object') throw new Fel(400, 'Ogiltig vårdkontakt.', 'ogiltig', { falt: ['nyKontakt'] });
  const k = nyKontakt.kontaktsatt ?? 'besok';
  if (!Object.hasOwn(KONTAKTSATT, k)) throw new Fel(400, 'Välj besök, telefon, video eller hembesök.', 'ogiltig', { falt: ['kontaktsatt'] });
  return { kontaktsatt: k, orsak: textFalt(nyKontakt.orsak) || null };
}

const forslagUt = (db, f) => ({ typ: f.typ, kontaktsatt: f.kontaktsatt, plats: f.plats, orsak: f.orsak, enhet: enhetKort(db, f.enhetId), vardenhet: enhetKort(db, vardenhetFor(db, f.enhetId)) });

// Vilken kontakt ny dokumentation hamnar på just nu, utan att något skapas. Gränssnittet visar det i formulären.
export function aktuell(atk) {
  atk.krav('las_admin');
  const v = pagandeFor(atk.db, atk.personal, atk.patientId);
  if (v) return { vardkontakt: kontaktUt(atk.db, v, atk.personal), ny: null };
  return { vardkontakt: null, ny: forslagUt(atk.db, nyKontaktForslag(atk.db, atk.personal, atk.patientId)) };
}

function skapaKontakt(db, personal, patientId, f, { automatisk, start = iso(), planerad = false } = {}) {
  const t = iso();
  const r = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, remiss_id, skapad, skapad_av, automatisk)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'vardkallan', ?, ?, ?, ?, ?)`)
    .run(patientId, f.enhetId, f.typ, f.kontaktsatt, start, f.plats, f.orsak, planerad ? 1 : 0, f.remissId ?? null, t, personal.id, automatisk ? 1 : 0);
  return hamtaKontakt(db, r.lastInsertRowid);
}

const kontaktSvar = (db, v, ny) => ({ id: v.id, ny, typ: v.typ, kontaktsatt: v.kontaktsatt, plats: v.plats, orsak: v.orsak, vardenhet: enhetKort(db, v.enhet_id), vardtillfalleId: v.vardtillfalle_id ?? null });

// Knyter en nyss sparad uppgift till en vårdkontakt, om den inte redan har en. Anropas efter att uppgiften har sparats,
// så att en nekad eller ogiltig åtgärd aldrig skapar en kontakt. body.nyKontakt är användarens ändring av förslaget.
export function knyt(atk, tabell, ut, body = {}) {
  const db = atk.db;
  const id = ut?.ordination?.id ?? ut?.id;
  const rad = db.query(`SELECT vardkontakt_id FROM ${tabell} WHERE id = ?`).get(id);
  if (!rad) return ut;
  if (rad.vardkontakt_id) { ut.vardkontakt = kontaktSvar(db, hamtaKontakt(db, rad.vardkontakt_id), false); return ut; }
  const andring = valideraNyKontakt(body?.nyKontakt);
  let v = andring ? null : pagandeFor(db, atk.personal, atk.patientId);
  let ny = false;
  if (!v) {
    const dokumentOrsak = tabell === 'anteckningar' ? textFalt((Array.isArray(body.sokord) ? body.sokord : []).find(s => s?.sokord === 'Kontaktorsak')?.text, 120).replace(/\.$/, '') || null
      : tabell === 'remisser' ? 'Remittering' : null;
    v = skapaKontakt(db, atk.personal, atk.patientId, nyKontaktForslag(db, atk.personal, atk.patientId, { ...andring, dokumentOrsak }), { automatisk: true });
    ny = true;
  }
  db.query(`UPDATE ${tabell} SET vardkontakt_id = ? WHERE id = ?`).run(v.id, id);
  ut.vardkontakt = kontaktSvar(db, v, ny);
  return ut;
}

// Registrering av vårdkontakt (3.4.4.1 och 3.4.4.3), planerad eller oplanerad, fysisk eller på distans. Förvalen:
// besök, nu, vårdenhetens mottagning och, när det finns en remiss till vårdenheten, "Enligt remiss från" avsändaren.
// En planerad kontakt i dag får ankomsten registrerad i stället för en ny kontakt, och samma kontakt registreras inte
// två gånger.
export function registrera(atk, body = {}) {
  atk.krav('registrera_vardkontakt');
  const db = atk.db;
  const pers = atk.personal;
  const ve = vardenhetFor(db, pers.enhet_id);
  const kontaktsatt = body.kontaktsatt ?? 'besok';
  if (!Object.hasOwn(KONTAKTSATT, kontaktsatt)) throw new Fel(400, 'Välj besök, telefon, video eller hembesök.', 'ogiltig', { falt: ['kontaktsatt'] });
  const planerad = Boolean(body.planerad);
  const nu = Date.now();
  let start = iso();
  if (planerad) {
    const ms = typeof body.start === 'string' ? Date.parse(body.start) : NaN;
    if (!Number.isFinite(ms) || ms < nu - 5 * 60_000 || ms > nu + 400 * 86400_000) throw new Fel(400, 'En planerad kontakt behöver en tid från nu och högst ett år framåt.', 'ogiltig', { falt: ['start'] });
    start = new Date(ms).toISOString();
  }
  let enhetId = body.enhetId ?? null;
  if (enhetId != null && !enheterUnder(db, ve).includes(enhetId)) throw new Fel(400, 'Kontakten registreras på din egen vårdenhet.', 'ogiltig', { falt: ['enhetId'] });
  const ph = enheterUnder(db, ve).map(() => '?').join(', ');
  const samma = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND typ <> 'slutenvard' ORDER BY start`).all(atk.patientId, ...enheterUnder(db, ve));
  const dag = datumAv(new Date(Date.parse(start)));
  if (!planerad) {
    // Patienten har kommit till en planerad kontakt: den faktiska tiden registreras på den.
    const vantad = samma.find(v => v.planerad && !v.ankomst && !v.slut && datumAv(new Date(v.start)) === dag && Math.abs(Date.parse(v.start) - nu) <= 4 * TIMME);
    if (vantad) {
      db.query('UPDATE vardkontakter SET ankomst = ?, andrad = ?, andrad_av = ? WHERE id = ?').run(iso(), iso(), pers.id, vantad.id);
      return [200, { ...kontaktUt(db, hamtaKontakt(db, vantad.id), pers), ankomstRegistrerad: true }];
    }
  }
  const dubblett = samma.find(v => v.kontaktsatt === kontaktsatt && datumAv(new Date(v.start)) === dag && (planerad ? v.planerad : !v.planerad || v.ankomst));
  if (dubblett) {
    throw new Fel(400, `${KONTAKTSATT[kontaktsatt]} är redan registrerat för patienten ${planerad ? 'den dagen' : 'i dag'}. Ändra den kontakten i stället för att registrera en till.`, 'ogiltig',
      { finns: kontaktUt(db, dubblett, pers) });
  }
  const f = registreringForslag(db, pers, atk.patientId, kontaktsatt);
  if (enhetId) f.enhetId = enhetId;
  const orsak = textFalt(body.orsak) || f.orsak;
  if (!orsak) throw new Fel(400, 'Ange kontaktorsak. Systemet hittar ingen remiss eller planerad kontakt som säger varför patienten kommer.', 'ogiltig', { falt: ['orsak'] });
  const v = skapaKontakt(db, pers, atk.patientId, { ...f, orsak }, { automatisk: false, start, planerad });
  return [201, kontaktUt(db, v, pers)];
}

// Förvalen för vårdadministratörens registrering. Orsaken från en remiss är avsändaren, aldrig frågeställningen, eftersom
// vårdadministratören inte läser journaltext.
function registreringForslag(db, personal, patientId, kontaktsatt = 'besok') {
  const ve = vardenhetFor(db, personal.enhet_id);
  const akut = ve === 'uso-akut';
  const enhetId = akut ? personal.enhet_id : mottagning(db, personal);
  const e = enhetRad(db, enhetId);
  const r = oppenRemiss(db, patientId, ve);
  return {
    typ: akut ? 'akut' : 'oppenvard', kontaktsatt, enhetId, remissId: r?.id ?? null,
    plats: PLATS[kontaktsatt] ?? (akut ? 'Akutmottagningen' : e?.typ === 'arbetsplats' ? e.namn : 'Mottagning'),
    orsak: r ? `Enligt remiss från ${enhetRad(db, r.fran_enhet_id)?.namn ?? 'annan vårdenhet'}` : null,
  };
}

// Ändring av en kontakt (3.4.4.3, möjlighet till redigering). Bara den egna vårdenhetens kontakter, och vem som ändrade
// och när sparas på kontakten.
export function andra(atk, v, body = {}) {
  atk.krav('registrera_vardkontakt');
  const db = atk.db;
  if (vardenhetFor(db, v.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) {
    atk.logga('registrera_vardkontakt', 'nekad', `vardkontakt:${v.id}`, 'nekad');
    throw new Fel(403, 'Bara den vårdenhet som har kontakten kan ändra den.', 'nekad');
  }
  if (v.kalla !== 'vardkallan') throw new Fel(400, 'Migrerade kontakter ändras inte.', 'ogiltig');
  const falt = {};
  if (body.kontaktsatt !== undefined) {
    if (v.typ === 'slutenvard') throw new Fel(400, 'Ett vårdtillfälle har inget kontaktsätt. Flytta eller skriv ut patienten i stället.', 'ogiltig', { falt: ['kontaktsatt'] });
    if (!Object.hasOwn(KONTAKTSATT, body.kontaktsatt)) throw new Fel(400, 'Välj besök, telefon, video eller hembesök.', 'ogiltig', { falt: ['kontaktsatt'] });
    falt.kontaktsatt = body.kontaktsatt;
    const e = enhetRad(db, v.enhet_id);
    falt.plats = PLATS[body.kontaktsatt] ?? (v.typ === 'akut' ? 'Akutmottagningen' : e?.typ === 'arbetsplats' ? e.namn : 'Mottagning');
  }
  if (body.orsak !== undefined) {
    const o = textFalt(body.orsak);
    if (o.length < 2) throw new Fel(400, 'Ange kontaktorsak.', 'ogiltig', { falt: ['orsak'] });
    falt.orsak = o;
  }
  if (!Object.keys(falt).length) throw new Fel(400, 'Inget att ändra.', 'ogiltig');
  const satt = Object.keys(falt).map(k => `${k} = ?`).join(', ');
  db.query(`UPDATE vardkontakter SET ${satt}, andrad = ?, andrad_av = ? WHERE id = ?`).run(...Object.values(falt), iso(), atk.personal.id, v.id);
  return kontaktUt(db, hamtaKontakt(db, v.id), atk.personal);
}

export function avsluta(atk, v) {
  atk.krav('registrera_vardkontakt');
  const db = atk.db;
  if (vardenhetFor(db, v.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) {
    atk.logga('registrera_vardkontakt', 'nekad', `vardkontakt:${v.id}`, 'nekad');
    throw new Fel(403, 'Bara den vårdenhet som har kontakten kan avsluta den.', 'nekad');
  }
  if (v.typ === 'slutenvard') throw new Fel(400, 'Ett vårdtillfälle avslutas med utskrivning.', 'ogiltig');
  if (v.slut) throw new Fel(400, 'Kontakten är redan avslutad.', 'ogiltig');
  db.query('UPDATE vardkontakter SET slut = ?, andrad = ?, andrad_av = ? WHERE id = ?').run(iso(), iso(), atk.personal.id, v.id);
  return kontaktUt(db, hamtaKontakt(db, v.id), atk.personal);
}

// Patientavgift enligt demoreglerna (3.4.4.4). Systemet räknar ut avgiften ur kontakttyp, kontaktsätt, ålder och
// högkostnadsskyddet, så att ingen behöver kunna reglerna. Betalning, kvitto, återbetalning och LMA-kort är inte byggda.
function grundavgift(v, patient) {
  const ar = alder(patient.fodd, datumAv(new Date(Date.parse(v.start))));
  if (ar < AVGIFT_DEMO.friUnder || ar >= AVGIFT_DEMO.friFran) return { belopp: 0, text: `Avgiftsfritt för patienter under ${AVGIFT_DEMO.friUnder} år och från ${AVGIFT_DEMO.friFran} år.` };
  if (v.typ === 'slutenvard') {
    const dygn = Math.max(1, Math.ceil(((v.slut ? Date.parse(v.slut) : Date.now()) - Date.parse(v.start)) / 86400_000));
    return { belopp: dygn * AVGIFT_DEMO.slutenvardDygn, text: `${AVGIFT_DEMO.slutenvardDygn} kr per påbörjat vårddygn, ${dygn} ${dygn === 1 ? 'dygn' : 'dygn'}.`, slutenvard: true };
  }
  if (v.typ === 'akut') return { belopp: AVGIFT_DEMO.akut, text: 'Besök på akutmottagningen.' };
  const k = v.kontaktsatt ?? 'besok';
  const b = AVGIFT_DEMO[k] ?? AVGIFT_DEMO.besok;
  return { belopp: b, text: b === 0 ? `${KONTAKTSATT[k]} är avgiftsfritt.` : `${KONTAKTSATT[k] ?? 'Besök'} i öppenvård.` };
}

export function avgiftFor(db, patient, v) {
  if (!patient || (v.kalla && v.kalla !== 'vardkallan')) return null;
  const g = grundavgift(v, patient);
  const ut = (belopp, text) => ({ belopp, text: `${text} Demoregel, inte en regions avgifter.`, demoregler: true });
  if (g.slutenvard || g.belopp === 0) return ut(g.belopp, g.text);
  // Högkostnadsskyddet: avgifterna för öppenvård under de senaste tolv månaderna, i tidsordning.
  const fran = new Date(Date.parse(v.start) - 365 * 86400_000).toISOString();
  const tidigare = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND typ <> 'slutenvard' AND kalla = 'vardkallan' AND id <> ? AND start >= ? AND start < ?
    AND (planerad = 0 OR ankomst IS NOT NULL) ORDER BY start, id`).all(patient.id, v.id ?? 0, fran, v.start);
  let betalt = 0;
  for (const t of tidigare) betalt += Math.min(grundavgift(t, patient).belopp, Math.max(0, AVGIFT_DEMO.hogkostnadsskydd - betalt));
  const kvar = Math.max(0, AVGIFT_DEMO.hogkostnadsskydd - betalt);
  if (kvar === 0) return ut(0, `Högkostnadsskyddet på ${AVGIFT_DEMO.hogkostnadsskydd} kr är nått, så besöket är avgiftsfritt.`);
  if (kvar < g.belopp) return ut(kvar, `${g.text} Högkostnadsskyddet nås med det här besöket.`);
  return ut(g.belopp, g.text);
}

// Vårdtillfällen (6.1.1.5). Avdelningar som kan ta emot inneliggande patienter: arbetsplatser som inte är mottagningar,
// och vårdenheter på sjukhusen utan egna arbetsplatser. Inte akutmottagningen och inte primärvården.
function kanVardaInneliggande(db, e) {
  if (!e) return false;
  if (e.typ === 'arbetsplats') return !/mottagning/i.test(e.namn);
  if (e.typ !== 'vardenhet' || e.forald_id === 'primarvard' || e.id === 'uso-akut') return false;
  return !db.query("SELECT 1 FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats'").get(e.id);
}
export function avdelningar(db) {
  const sjukhus = (e) => { let x = e; for (let i = 0; i < 6 && x && x.typ !== 'sjukhus'; i++) x = enhetRad(db, x.forald_id); return x; };
  return db.query('SELECT * FROM enheter ORDER BY id').all().filter(e => kanVardaInneliggande(db, e))
    .map(e => ({ id: e.id, namn: e.namn, vardenhet: enhetKort(db, vardenhetFor(db, e.id)), sjukhus: sjukhus(e)?.kortnamn ?? sjukhus(e)?.namn ?? null }));
}

const vtKontakter = (db, vtId) => db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start, id').all(vtId);
const aktuellVistelse = (db, vtId) => db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY (slut IS NULL) DESC, start DESC, id DESC').get(vtId);

export function utskrivningskontroll(db, vt) {
  const ids = vtKontakter(db, vt.id).map(v => v.id);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(', ');
  const ut = [];
  const osign = db.query(`SELECT count(*) AS n FROM anteckningar WHERE vardkontakt_id IN (${ph}) AND status = 'utkast'`).get(...ids).n;
  if (osign) ut.push({ regel: 'osignerade', niva: 'observera', text: `${osign} ${osign === 1 ? 'osignerad anteckning hör' : 'osignerade anteckningar hör'} till vårdtillfället. De kan signeras efter utskrivningen.` });
  if (!db.query(`SELECT 1 FROM anteckningar WHERE vardkontakt_id IN (${ph}) AND typ = 'Epikris'`).get(...ids)) {
    ut.push({ regel: 'epikris', niva: 'observera', text: 'Det finns ingen epikris för vårdtillfället. Läkaren kan skriva den efter utskrivningen.' });
  }
  return ut;
}

export function vardtillfalleUt(db, vt, { innehall = false } = {}) {
  const kontakter = vtKontakter(db, vt.id);
  const nu = aktuellVistelse(db, vt.id);
  const handelser = db.query('SELECT * FROM vardtillfalle_handelser WHERE vardtillfalle_id = ? ORDER BY tid, id').all(vt.id).map(h => ({
    id: h.id, typ: h.typ, text: HANDELSE[h.typ], tid: h.tid, enhet: enhetKort(db, h.enhet_id), plats: h.plats, av: personKort(db, h.av), detalj: h.detalj,
  }));
  const ut = {
    id: vt.id, status: vt.utskriven ? 'utskriven' : vt.permission_till ? 'permission' : 'inskriven', inskriven: vt.inskriven, utskriven: vt.utskriven,
    orsak: vt.orsak, permissionTill: vt.permission_till ?? null, ansvarig: enhetKort(db, vt.enhet_id),
    produktion: nu ? enhetKort(db, vardenhetFor(db, nu.enhet_id)) : null, avdelning: nu ? enhetKort(db, nu.enhet_id) : null, plats: nu?.plats ?? null,
    kontakter: kontakter.map(v => ({ id: v.id, enhet: enhetKort(db, v.enhet_id), plats: v.plats, start: v.start, slut: v.slut })),
    handelser, kalla: vt.kalla, kallaEtikett: journal.kallaEtikett(vt.kalla, vt.inskriven),
    inskrivenAv: personKort(db, vt.inskriven_av), utskrivenAv: personKort(db, vt.utskriven_av),
  };
  if (!vt.utskriven) ut.utskrivningskontroll = utskrivningskontroll(db, vt);
  if (innehall && kontakter.length) {
    const ids = kontakter.map(v => v.id);
    const ph = ids.map(() => '?').join(', ');
    ut.innehall = Object.fromEntries(['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'remisser']
      .map(t => [t, db.query(`SELECT count(*) AS n FROM ${t} WHERE vardkontakt_id IN (${ph})`).get(...ids).n]));
  }
  return ut;
}

function handelse(db, vtId, typ, { enhetId = null, plats = null, av = null, detalj = null, tid = iso() } = {}) {
  db.query('INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)').run(vtId, typ, tid, enhetId, plats, av, detalj);
}

// Inskrivning. Avdelningen är den egna om man arbetar på en, annars vårdenhetens första avdelning. Orsaken tas från ett
// pågående akutbesök eller en öppen remiss till vårdenheten. Ett pågående akutbesök avslutas och blir den föregående
// kontakten, så att övergången mellan vårdformer går att följa (6.1.1.6).
export function inskrivningForslag(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const egen = enhetRad(db, personal.enhet_id);
  const enhet = kanVardaInneliggande(db, egen) ? egen
    : db.query("SELECT * FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats' ORDER BY id").all(ve).find(e => kanVardaInneliggande(db, e))
      ?? (kanVardaInneliggande(db, enhetRad(db, ve)) ? enhetRad(db, ve) : null);
  const akut = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND typ = 'akut' AND slut IS NULL ORDER BY start DESC").get(patientId);
  const r = oppenRemiss(db, patientId, ve);
  const orsak = akut?.orsak ?? (r && kanRoll(personal, 'las_remiss') ? kort(r.fragestallning) : null);
  return { enhet: enhet ? enhetKort(db, enhet.id) : null, orsak, fran: akut ? { id: akut.id, vardenhet: enhetKort(db, akut.enhet_id) } : null };
}

export function skrivIn(atk, body = {}) {
  atk.krav('vardtillfalle');
  const db = atk.db;
  const pers = atk.personal;
  const pagaende = db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(atk.patientId);
  if (pagaende) {
    const v = aktuellVistelse(db, pagaende.id);
    throw new Fel(400, `Patienten är redan inskriven på ${enhetRad(db, v?.enhet_id)?.namn ?? 'en avdelning'}. Flytta patienten i stället.`, 'ogiltig');
  }
  const f = inskrivningForslag(db, pers, atk.patientId);
  const enhet = enhetRad(db, body.enhetId ?? f.enhet?.id);
  if (!kanVardaInneliggande(db, enhet)) throw new Fel(400, 'Välj en avdelning som tar emot inneliggande patienter.', 'ogiltig', { falt: ['enhetId'] });
  const orsak = textFalt(body.orsak) || f.orsak;
  if (!orsak) throw new Fel(400, 'Ange orsaken till inskrivningen. Systemet hittar inget akutbesök eller någon remiss att ta den från.', 'ogiltig', { falt: ['orsak'] });
  const plats = textFalt(body.plats, 80) || enhet.namn;
  const t = iso();
  const ve = vardenhetFor(db, enhet.id);
  const vt = Number(db.query('INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, orsak, inskriven_av) VALUES (?, ?, ?, ?, ?)').run(atk.patientId, ve, t, orsak, pers.id).lastInsertRowid);
  const akut = f.fran ? hamtaKontakt(db, f.fran.id) : null;
  if (akut) db.query('UPDATE vardkontakter SET slut = ? WHERE id = ?').run(t, akut.id);
  db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, vardtillfalle_id, foregaende_id, halsoarende_id, skapad, skapad_av)
    VALUES (?, ?, 'slutenvard', ?, ?, ?, 'vardkallan', ?, ?, ?, ?, ?)`).run(atk.patientId, enhet.id, t, plats, orsak, vt, akut?.id ?? null, akut?.halsoarende_id ?? null, t, pers.id);
  handelse(db, vt, 'inskrivning', { enhetId: enhet.id, plats, av: pers.id, tid: t, detalj: akut ? `Från ${enhetRad(db, akut.enhet_id)?.namn}` : null });
  return [201, vardtillfalleUt(db, hamtaVardtillfalle(db, vt))];
}

// Den som får flytta, ge permission och skriva ut: avdelningens vårdenhet eller vårdenheten med det medicinska ansvaret.
function kravVardar(atk, vt) {
  atk.krav('vardtillfalle');
  const db = atk.db;
  const v = aktuellVistelse(db, vt.id);
  const min = vardenhetFor(db, atk.personal.enhet_id);
  if (!v || (vardenhetFor(db, v.enhet_id) !== min && vt.enhet_id !== min)) {
    atk.logga('vardtillfalle', 'nekad', `vardtillfalle:${vt.id}`, 'nekad');
    throw new Fel(403, 'Bara avdelningen där patienten vårdas, eller kliniken med det medicinska ansvaret, kan flytta, ge permission och skriva ut.', 'nekad');
  }
  if (vt.utskriven) throw new Fel(400, 'Patienten är redan utskriven.', 'ogiltig');
  return v;
}

// Flytt (sektions-, avdelnings- och klinikbyte) och sängbyte. Vid flytt avslutas kontakten på den gamla avdelningen och
// en ny börjar i samma vårdtillfälle. Det medicinska ansvaret följer med till en annan vårdenhet, utom när den gamla
// behåller det (till exempel en patient som ligger som satellit på en annan klinik).
export function flytta(atk, vt, body = {}) {
  const db = atk.db;
  const v = kravVardar(atk, vt);
  if (vt.permission_till) throw new Fel(400, 'Patienten är på permission. Registrera att patienten är åter innan flytten.', 'ogiltig');
  const dit = enhetRad(db, body.enhetId ?? v.enhet_id);
  if (!kanVardaInneliggande(db, dit)) throw new Fel(400, `Patienten kan inte flyttas till ${dit?.namn ?? 'den enheten'}, eftersom den inte tar emot inneliggande patienter.`, 'ogiltig', { falt: ['enhetId'] });
  const plats = textFalt(body.plats, 80) || dit.namn;
  const t = iso();
  const pers = atk.personal;
  if (dit.id === v.enhet_id) {
    if (plats === v.plats) throw new Fel(400, `Patienten ligger redan på ${plats}.`, 'ogiltig', { falt: ['plats'] });
    db.query('UPDATE vardkontakter SET plats = ? WHERE id = ?').run(plats, v.id);
    handelse(db, vt.id, 'sangbyte', { enhetId: dit.id, plats, av: pers.id, tid: t, detalj: `Från ${v.plats} till ${plats}` });
    return vardtillfalleUt(db, hamtaVardtillfalle(db, vt.id));
  }
  db.query('UPDATE vardkontakter SET slut = ? WHERE id = ?').run(t, v.id);
  db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, vardtillfalle_id, foregaende_id, halsoarende_id, skapad, skapad_av)
    VALUES (?, ?, 'slutenvard', ?, ?, ?, 'vardkallan', ?, ?, ?, ?, ?)`).run(vt.patient_id, dit.id, t, plats, vt.orsak, vt.id, v.id, v.halsoarende_id ?? null, t, pers.id);
  handelse(db, vt.id, 'flytt', { enhetId: dit.id, plats, av: pers.id, tid: t, detalj: `Från ${enhetRad(db, v.enhet_id)?.namn} till ${dit.namn}` });
  const nyVe = vardenhetFor(db, dit.id);
  if (nyVe !== vt.enhet_id) {
    if (body.behallAnsvar) {
      handelse(db, vt.id, 'ansvar', { enhetId: dit.id, av: pers.id, tid: t, detalj: `${enhetRad(db, vt.enhet_id)?.namn} behåller det medicinska ansvaret. Patienten vårdas på ${dit.namn}.` });
    } else {
      db.query('UPDATE vardtillfallen SET enhet_id = ? WHERE id = ?').run(nyVe, vt.id);
      handelse(db, vt.id, 'ansvar', { enhetId: dit.id, av: pers.id, tid: t, detalj: `Det medicinska ansvaret går över till ${enhetRad(db, nyVe)?.namn}.` });
    }
  }
  return vardtillfalleUt(db, hamtaVardtillfalle(db, vt.id));
}

export function permission(atk, vt, body = {}) {
  const db = atk.db;
  const v = kravVardar(atk, vt);
  if (vt.permission_till) throw new Fel(400, 'Patienten är redan på permission.', 'ogiltig');
  const till = body.till ?? addDagar(idag(), 1);
  if (!giltigtDatum(till) || till < idag() || till > addDagar(idag(), 14)) throw new Fel(400, 'Ange när patienten kommer tillbaka, högst 14 dagar fram.', 'ogiltig', { falt: ['till'] });
  db.query('UPDATE vardtillfallen SET permission_till = ? WHERE id = ?').run(till, vt.id);
  handelse(db, vt.id, 'permission', { enhetId: v.enhet_id, plats: v.plats, av: atk.personal.id, detalj: `Åter senast ${till}` });
  return vardtillfalleUt(db, hamtaVardtillfalle(db, vt.id));
}

export function aterFranPermission(atk, vt) {
  const db = atk.db;
  const v = kravVardar(atk, vt);
  if (!vt.permission_till) throw new Fel(400, 'Patienten är inte på permission.', 'ogiltig');
  db.query('UPDATE vardtillfallen SET permission_till = NULL WHERE id = ?').run(vt.id);
  handelse(db, vt.id, 'ater', { enhetId: v.enhet_id, plats: v.plats, av: atk.personal.id });
  return vardtillfalleUt(db, hamtaVardtillfalle(db, vt.id));
}

export function skrivUt(atk, vt) {
  const db = atk.db;
  const v = kravVardar(atk, vt);
  const t = iso();
  db.query('UPDATE vardkontakter SET slut = ? WHERE id = ?').run(t, v.id);
  db.query('UPDATE vardtillfallen SET utskriven = ?, utskriven_av = ?, permission_till = NULL WHERE id = ?').run(t, atk.personal.id, vt.id);
  handelse(db, vt.id, 'utskrivning', { enhetId: v.enhet_id, plats: v.plats, av: atk.personal.id, tid: t });
  return vardtillfalleUt(db, hamtaVardtillfalle(db, vt.id));
}

// Hälsoärenden (6.1.1.2). Systemet föreslår vilka vårdkontakter som hör ihop, bara bland dem användaren får se:
//   diagnos   samma diagnoskategori (de tre första tecknen i ICD-10-SE-koden) vid flera kontakter,
//   remiss    kontakten som skickade remissen och kontakten hos mottagaren som var svaret på den,
//   vardform  ett akutbesök som gick över i inskrivning, och flyttar inom ett vårdtillfälle.
// Ett förslag som bekräftas blir ett hälsoärende. Ett förslag som avvisas visas inte igen.
const halsoarendeUt = (db, h) => ({
  id: h.id, rubrik: h.rubrik, kod: h.kod, grund: h.grund, status: h.status, skapad: h.skapad, skapadAv: personKort(db, h.skapad_av), enhet: enhetKort(db, h.enhet_id),
  kontakter: db.query('SELECT id FROM vardkontakter WHERE halsoarende_id = ? ORDER BY id').all(h.id).map(r => r.id), kalla: h.kalla,
});

export function synligaHalsoarenden(atk) {
  return atk.filtrera(atk.db.query('SELECT * FROM halsoarenden WHERE patient_id = ? ORDER BY skapad DESC').all(atk.patientId), 'las_admin');
}

export function forslag(atk, kontakter, diagnoser) {
  const db = atk.db;
  if (!kanRoll(atk.personal, 'halsoarende')) return [];
  const ids = new Set(kontakter.map(v => v.id));
  const forald = new Map([...ids].map(i => [i, i]));
  const rot = (i) => { while (forald.get(i) !== i) i = forald.get(i); return i; };
  const grunder = [];
  const forena = (a, b, g) => { if (!ids.has(a) || !ids.has(b) || a === b) return; forald.set(rot(a), rot(b)); grunder.push({ ...g, a, b }); };
  const perKod = new Map();
  for (const d of diagnoser ?? []) {
    if (!ids.has(d.vardkontakt_id)) continue;
    const k = d.kod.slice(0, 3);
    if (!perKod.has(k)) perKod.set(k, []);
    perKod.get(k).push(d);
  }
  for (const [k, lista] of perKod) {
    const vk = [...new Set(lista.map(d => d.vardkontakt_id))];
    const senast = [...lista].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0];
    for (let i = 1; i < vk.length; i++) forena(vk[0], vk[i], { typ: 'diagnos', kod: k, rubrik: senast.text, vikt: vk.length, text: `Samma diagnos, ${senast.text} (${k}), vid ${vk.length} vårdkontakter.` });
  }
  const kanRemiss = kanRoll(atk.personal, 'las_remiss');
  for (const v of kontakter) {
    if (v.remiss_id) {
      const r = db.query('SELECT * FROM remisser WHERE id = ?').get(v.remiss_id);
      if (r?.vardkontakt_id) {
        forena(r.vardkontakt_id, v.id, { typ: 'remiss', rubrik: kanRemiss ? kort(r.fragestallning, 80) : v.orsak, text: `Remiss från ${enhetRad(db, r.fran_enhet_id)?.namn} till ${enhetRad(db, r.till_enhet_id)?.namn}.` });
      }
    }
    if (v.foregaende_id) {
      const f = kontakter.find(x => x.id === v.foregaende_id);
      const text = f?.typ === 'akut' && v.typ === 'slutenvard' ? 'Akutbesöket gick över i inskrivning.' : 'Flytt inom samma vårdtillfälle.';
      forena(v.foregaende_id, v.id, { typ: 'vardform', rubrik: v.orsak, text });
    }
  }
  for (const v of kontakter) {
    if (!v.vardtillfalle_id) continue;
    const forsta = kontakter.find(x => x.vardtillfalle_id === v.vardtillfalle_id);
    if (forsta && forsta.id !== v.id) forena(forsta.id, v.id, { typ: 'vardform', rubrik: v.orsak, text: 'Flytt inom samma vårdtillfälle.' });
  }
  const grupper = new Map();
  for (const i of ids) { const r = rot(i); if (!grupper.has(r)) grupper.set(r, []); grupper.get(r).push(i); }
  const avvisade = new Set(db.query('SELECT nyckel FROM halsoarende_avvisningar WHERE patient_id = ?').all(atk.patientId).map(r => r.nyckel));
  const synligaArenden = new Set(synligaHalsoarenden(atk).map(h => h.id));
  const ut = [];
  for (const medlemmar of grupper.values()) {
    if (medlemmar.length < 2) continue;
    medlemmar.sort((a, b) => a - b);
    const rader = medlemmar.map(i => kontakter.find(v => v.id === i));
    const arenden = [...new Set(rader.map(v => v.halsoarende_id).filter(Boolean))];
    const utan = rader.filter(v => !v.halsoarende_id).map(v => v.id);
    if (!utan.length || arenden.length > 1 || (arenden.length === 1 && !synligaArenden.has(arenden[0]))) continue;
    const mina = grunder.filter(g => medlemmar.includes(g.a));
    const unika = [...new Map(mina.map(g => [g.text, { typ: g.typ, text: g.text }])).values()];
    const basta = [...mina].sort((a, b) => ({ diagnos: 0, remiss: 1, vardform: 2 }[a.typ] - { diagnos: 0, remiss: 1, vardform: 2 }[b.typ]) || (b.vikt ?? 0) - (a.vikt ?? 0))[0];
    const f = arenden.length
      ? { typ: 'lagg_till', nyckel: `lagg_till:${arenden[0]}:${utan.join('-')}`, halsoarendeId: arenden[0], rubrik: db.query('SELECT rubrik FROM halsoarenden WHERE id = ?').get(arenden[0]).rubrik, kontakter: utan }
      : { typ: 'nytt', nyckel: `nytt:${medlemmar.join('-')}`, rubrik: basta.rubrik ?? rader[0].orsak, kod: basta.kod ?? null, kontakter: medlemmar };
    if (avvisade.has(f.nyckel)) continue;
    ut.push({ ...f, grunder: unika, grund: basta.typ });
  }
  return ut;
}

export function bekrafta(atk, body, kontakter, diagnoser) {
  atk.krav('halsoarende');
  const db = atk.db;
  const f = forslag(atk, kontakter, diagnoser).find(x => x.nyckel === body?.nyckel);
  if (!f) throw new Fel(400, 'Förslaget gäller inte längre. Öppna översikten igen för att se systemets förslag.', 'ogiltig', { falt: ['nyckel'] });
  let id = f.halsoarendeId;
  if (!id) {
    id = Number(db.query('INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, kod, grund, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(atk.patientId, atk.personal.enhet_id, f.rubrik, f.kod ?? null, f.grund, iso(), atk.personal.id).lastInsertRowid);
  }
  const ph = f.kontakter.map(() => '?').join(', ');
  db.query(`UPDATE vardkontakter SET halsoarende_id = ? WHERE patient_id = ? AND id IN (${ph})`).run(id, atk.patientId, ...f.kontakter);
  return [201, halsoarendeUt(db, db.query('SELECT * FROM halsoarenden WHERE id = ?').get(id))];
}

export function avvisa(atk, body, kontakter, diagnoser) {
  atk.krav('halsoarende');
  const f = forslag(atk, kontakter, diagnoser).find(x => x.nyckel === body?.nyckel);
  if (!f) throw new Fel(400, 'Förslaget gäller inte längre.', 'ogiltig', { falt: ['nyckel'] });
  atk.db.query('INSERT OR IGNORE INTO halsoarende_avvisningar (patient_id, nyckel, personal_id, tid) VALUES (?, ?, ?, ?)').run(atk.patientId, f.nyckel, atk.personal.id, iso());
  return { ok: true, nyckel: f.nyckel };
}

// Det översikten behöver för vårdkontakter, vårdtillfällen och hälsoärenden, byggt av det som redan är filtrerat för
// användaren: vk (vårdkontakter), ant (anteckningar), dia, mv och ord (rader) och rem (remisser). Det som rollen inte
// får läsa är null och räknas inte.
export function oversiktDel(atk, { vk, ant, dia, mv, ord, rem }) {
  const db = atk.db;
  const pers = atk.personal;
  const raknade = (lista, nyckel) => {
    if (!lista) return null;
    const m = new Map();
    for (const x of lista) { const k = x[nyckel]; if (k != null) m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  };
  const remRader = rem ? rem.map(r => db.query('SELECT id, vardkontakt_id FROM remisser WHERE id = ?').get(r.id)).filter(Boolean) : null;
  const svarPa = new Map(vk.filter(v => v.remiss_id).map(v => [v.remiss_id, v.id]));
  const per = { a: raknade(ant, 'vardkontaktId'), m: raknade(mv, 'vardkontakt_id'), o: raknade(ord, 'vardkontakt_id'), r: raknade(remRader, 'vardkontakt_id') };
  const perKontakt = {};
  for (const v of vk) {
    perKontakt[v.id] = {
      anteckningar: per.a ? per.a.get(v.id) ?? 0 : null,
      diagnoser: dia ? dia.filter(d => d.vardkontakt_id === v.id).map(d => d.kod) : null,
      matvarden: per.m ? per.m.get(v.id) ?? 0 : null,
      ordinationer: per.o ? per.o.get(v.id) ?? 0 : null,
      remisser: per.r ? (per.r.get(v.id) ?? 0) + (remRader.filter(r => svarPa.get(r.id) === v.id).length) : null,
    };
  }
  const vtIds = [...new Set(vk.map(v => v.vardtillfalle_id).filter(Boolean))];
  const vardtillfallen = vtIds.map(id => hamtaVardtillfalle(db, id)).sort((a, b) => b.inskriven.localeCompare(a.inskriven)).map(vt => {
    const ut = vardtillfalleUt(db, vt);
    // Bara de vistelser användaren får se.
    const synliga = new Set(vk.map(v => v.id));
    ut.kontakter = ut.kontakter.filter(k => synliga.has(k.id));
    if (!kanRoll(pers, 'vardtillfalle')) delete ut.utskrivningskontroll;
    return ut;
  });
  const forval = {};
  if (kanRoll(pers, 'registrera_vardkontakt')) {
    const f = registreringForslag(db, pers, atk.patientId);
    const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
    const prov = (kontaktsatt) => avgiftFor(db, pat, { id: 0, typ: f.typ, kontaktsatt, start: iso(), kalla: 'vardkallan', patient_id: pat.id });
    forval.registrering = { ...forslagUt(db, f), avgifter: Object.fromEntries(Object.keys(KONTAKTSATT).map(k => [k, prov(k)])) };
  }
  if (kanRoll(pers, 'vardtillfalle')) {
    if (!db.query('SELECT 1 FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(atk.patientId)) forval.inskrivning = inskrivningForslag(db, pers, atk.patientId);
  }
  if (['skriv_journal', 'skriv_omvardnad', 'ordinera', 'registrera_matvarde', 'remittera'].some(h => kanRoll(pers, h))) {
    const v = pagandeFor(db, pers, atk.patientId);
    forval.dokumentation = v ? { vardkontakt: kontaktUt(db, v, pers), ny: null } : { vardkontakt: null, ny: forslagUt(db, nyKontaktForslag(db, pers, atk.patientId)) };
  }
  return {
    vardtillfallen, halsoarenden: synligaHalsoarenden(atk).map(h => halsoarendeUt(db, h)), forslag: forslag(atk, vk, dia), perKontakt, forval,
    kontaktsatt: KONTAKTSATT,
  };
}

// Tidslinjen per vårdkontakt, vårdtillfälle och hälsoärende: varje post får sin vårdkontakt, och händelserna i
// vårdtillfällena (inskrivning, flytt, permission och utskrivning) läggs till.
export function berikaTidslinje(db, tidslinje, struktur, vk) {
  const kontakt = new Map(vk.map(v => [v.id, v]));
  const vkFor = (ref, tid) => {
    if (!ref) return null;
    if (ref.typ === 'vardkontakt') return ref.id;
    // En utsättning hör till kontakten där den gjordes, inte till kontakten där läkemedlet ordinerades.
    if (ref.typ === 'ordination') {
      const o = db.query('SELECT patient_id, utsatt_tid, utsatt_av, vardkontakt_id FROM ordinationer WHERE id = ?').get(ref.id);
      if (o?.utsatt_tid && o.utsatt_tid === tid && o.utsatt_av) {
        const pers = db.query('SELECT enhet_id FROM personal WHERE id = ?').get(o.utsatt_av);
        const enheter = pers ? enheterUnder(db, vardenhetFor(db, pers.enhet_id)) : [];
        const ms = Date.parse(tid);
        const traff = vk.filter(v => enheter.includes(v.enhet_id) && Date.parse(v.start) - TIMME <= ms && ms <= (v.slut ? Date.parse(v.slut) : Date.now()) + TIMME)
          .sort((a, b) => (b.typ === 'slutenvard') - (a.typ === 'slutenvard') || b.start.localeCompare(a.start))[0];
        return traff?.id ?? null;
      }
      return o?.vardkontakt_id ?? null;
    }
    const tabell = { anteckning: 'anteckningar', ordination: 'ordinationer', remiss: 'remisser' }[ref.typ];
    return tabell ? db.query(`SELECT vardkontakt_id FROM ${tabell} WHERE id = ?`).get(ref.id)?.vardkontakt_id ?? null : null;
  };
  const ut = tidslinje.map(t => {
    const id = vkFor(t.ref, t.tid);
    const v = kontakt.get(id) ?? (id ? db.query('SELECT vardtillfalle_id, halsoarende_id FROM vardkontakter WHERE id = ?').get(id) : null);
    return { ...t, vardkontaktId: id, vardtillfalleId: v?.vardtillfalle_id ?? null, halsoarendeId: v?.halsoarende_id ?? null };
  });
  for (const vt of struktur.vardtillfallen) {
    for (const h of vt.handelser) {
      if (h.typ === 'inskrivning') continue;
      const rubrik = h.typ === 'flytt' ? `Flyttad till ${h.enhet?.namn ?? ''}` : h.typ === 'sangbyte' ? `Sängbyte till ${h.plats}` : HANDELSE[h.typ];
      ut.push({ tid: h.tid, typ: 'vardtillfalle', rubrik, text: h.detalj, enhet: h.enhet, kalla: vt.kalla, kallaEtikett: null, ref: { typ: 'vardtillfalle', id: vt.id },
        vardkontaktId: null, vardtillfalleId: vt.id, halsoarendeId: null });
    }
  }
  return ut.sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
}

// En vårdkontakt med allt som hör till den (6.1.1.1), med samma behörighet som journalen: det som rollen inte får läsa
// är null, och uppgifter från andra vårdenheter kräver aktivt val som i resten av journalen.
export function kontaktMedInnehall(atk, v) {
  const db = atk.db;
  const pers = atk.personal;
  atk.krav('las_admin', { resurs: { enhet_id: v.enhet_id }, beskrivning: `vardkontakt:${v.id}` });
  const kan = (...h) => h.some(x => kanRoll(pers, x));
  const anteckningar = kan('las_journal', 'las_omvardnad') ? journal.listaAnteckningar(atk).anteckningar.filter(a => a.vardkontaktId === v.id) : null;
  const diagnoser = kan('las_diagnoser') ? journal.synligaDiagnoser(atk).filter(d => d.vardkontakt_id === v.id).map(d => journal.diagnosUt(db, d)) : null;
  const matvarden = kan('las_matvarden') ? journal.synligaMatvarden(atk).filter(m => m.vardkontakt_id === v.id).map(m => journal.matvardeUt(db, m)) : null;
  const ordinationer = kan('las_lakemedel') ? lakemedel.synligaOrdinationer(atk).filter(o => o.vardkontakt_id === v.id).map(o => lakemedel.ordinationUt(db, o, { historik: false })) : null;
  let remisser = null;
  if (kan('las_remiss', 'las_remiss_status')) {
    const egna = new Set(db.query('SELECT id FROM remisser WHERE vardkontakt_id = ? OR id = ?').all(v.id, v.remiss_id ?? 0).map(r => r.id));
    remisser = remiss.forPatient(atk).remisser.filter(r => egna.has(r.id));
  }
  const vt = v.vardtillfalle_id ? vardtillfalleUt(db, hamtaVardtillfalle(db, v.vardtillfalle_id)) : null;
  const h = v.halsoarende_id ? db.query('SELECT * FROM halsoarenden WHERE id = ?').get(v.halsoarende_id) : null;
  return {
    vardkontakt: kontaktUt(db, v, pers), vardtillfalle: vt, halsoarende: h ? halsoarendeUt(db, h) : null,
    anteckningar, diagnoser, matvarden, ordinationer, remisser, dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}
