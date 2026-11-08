// Runda 9, r7: enhetlig hantering av vårdkontakter oavsett vårdform (Sussa 6.1.1.6, figur 4 i kravspecifikationen).
//
// Öppenvård, akutbesök och slutenvård är redan samma slags vårdkontakt (vardkontakt.js). Här kommer hemsjukvård och
// dagkirurgi till som vårdformer, och övergångarna mellan dem:
//   slutenvård till hemsjukvård eller öppenvård  utskrivningen och den nya kontakten görs i ett steg. Den nya kontakten
//                                                 får den gamla som föregående och hör till samma hälsoärende. Finns
//                                                 inget hälsoärende skapar systemet ett, så att förloppet går att följa.
//   dagkirurgi till slutenvård                   när patienten blir kvar över natten skrivs den in från den
//                                                 dagkirurgiska kontakten, som avslutas och blir föregående kontakt.
// Den faktiska besökstiden registreras för öppenvård, akutbesök, hemsjukvård och dagkirurgi: ankomsten (som förut) och
// när besöket faktiskt slutade, utan att kontakten avslutas, eftersom provsvar och dokumentation kan komma efteråt.
// Systemet räknar besökstiden ur dem, på samma sätt som vårdtiden i slutenvården räknas mellan in- och utskrivning.
//
// Systemet är experten: den som skriver ut väljer bara vårdformen som följer. Typ, enhet, plats, orsak, föregående
// kontakt och hälsoärende fyller systemet i, och första hembesöket föreslås till nästa vardag.
import { Fel, iso } from './db.js';
import { vardenhetFor, enheterUnder } from './atkomst.js';
import * as vardkontakt from './vardkontakt.js';

export const VARDFORMER = { oppenvard: 'Öppenvård', akut: 'Akut', slutenvard: 'Slutenvård', hemsjukvard: 'Hemsjukvård', dagkirurgi: 'Dagkirurgi' };
const MED_BESOKSTID = ['oppenvard', 'akut', 'hemsjukvard', 'dagkirurgi'];

export function sakra(db) {
  const k = db.query('PRAGMA table_info(vardkontakter)').all().map(x => x.name);
  if (!k.includes('besok_slut')) db.exec('ALTER TABLE vardkontakter ADD COLUMN besok_slut TEXT');
  if (!k.includes('besok_slut_av')) db.exec('ALTER TABLE vardkontakter ADD COLUMN besok_slut_av TEXT');
}

// Den faktiska besökstiden i minuter, eller null när besöket inte har slutat.
export function besokstid(v) {
  if (!v.besok_slut) return null;
  return Math.max(0, Math.round((Date.parse(v.besok_slut) - Date.parse(v.ankomst ?? v.start)) / 60_000));
}
export const besokUt = (v) => ({ besokSlut: v.besok_slut ?? null, faktiskBesokstidMinuter: besokstid(v) });

function egenKontakt(atk, v, vad) {
  if (vardenhetFor(atk.db, v.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga('registrera_vardkontakt', 'nekad', `vardkontakt:${v.id}`, 'nekad');
    throw new Fel(403, `Bara den vårdenhet som har kontakten kan ${vad}.`, 'nekad');
  }
}

// POST /api/vardkontakt/:id/besok-slut: besöket är slut, men kontakten fortsätter.
export function avslutaBesok(atk, v, nu = new Date()) {
  atk.krav('registrera_vardkontakt');
  egenKontakt(atk, v, 'registrera när besöket slutade');
  if (!MED_BESOKSTID.includes(v.typ)) throw new Fel(400, 'Ett vårdtillfälle har ingen besökstid. Vårdtiden räknas mellan in- och utskrivning.', 'ogiltig');
  if (v.slut) throw new Fel(400, 'Kontakten är redan avslutad.', 'ogiltig');
  if (v.besok_slut) throw new Fel(400, 'Besökets sluttid är redan registrerad.', 'ogiltig');
  const borjade = Date.parse(v.ankomst ?? v.start);
  if (v.planerad && !v.ankomst) throw new Fel(400, 'Patienten har inte kommit. Registrera ankomsten först.', 'ogiltig');
  if (borjade > nu.getTime()) throw new Fel(400, 'Besöket har inte börjat än.', 'ogiltig');
  atk.db.query('UPDATE vardkontakter SET besok_slut = ?, besok_slut_av = ?, andrad = ?, andrad_av = ? WHERE id = ?').run(iso(nu), atk.personal.id, iso(nu), atk.personal.id, v.id);
  const ny = vardkontakt.hamtaKontakt(atk.db, v.id);
  return { ...vardkontakt.kontaktUt(atk.db, ny, atk.personal), ...besokUt(ny), text: `Besöket tog ${besokstid(ny)} minuter. Kontakten är fortfarande öppen för provsvar och dokumentation.` };
}

// Starttiden för en ny kontakt, med samma gränser som vid registrering av en vårdkontakt (vardkontakt.registrera): inte
// tidigare än fem minuter före nu och högst ett år fram, så att en kontakt aldrig kan bakdateras och ge vårdrelation i
// efterhand. Utan tid gäller standard (nu, eller nästa vardag för en uppföljning).
function provaStart(start, standard) {
  if (start == null || start === '') return standard;
  const ms = typeof start === 'string' ? Date.parse(start) : NaN;
  const nu = Date.now();
  if (!Number.isFinite(ms) || ms < nu - 5 * 60_000 || ms > nu + 400 * 86400_000) throw new Fel(400, 'Tiden för kontakten ska ligga från nu och högst ett år framåt.', 'ogiltig', { falt: ['start'] });
  return new Date(ms).toISOString();
}

// POST /api/patient/:id/dagkirurgi { orsak, start? }: en dagkirurgisk kontakt på den egna vårdenheten.
export function registreraDagkirurgi(atk, body = {}) {
  atk.krav('registrera_vardkontakt');
  const db = atk.db;
  const orsak = typeof body.orsak === 'string' ? body.orsak.trim().slice(0, 200) : '';
  if (orsak.length < 2) throw new Fel(400, 'Ange vilket ingrepp patienten kommer för.', 'ogiltig', { falt: ['orsak'] });
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const t = provaStart(body.start, iso());
  const r = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla, planerad, skapad, skapad_av, ger_vardrelation)
    VALUES (?, ?, 'dagkirurgi', 'besok', ?, 'Dagkirurgi', ?, 'vardkallan', ?, ?, ?, ?)`).run(atk.patientId, ve, t, orsak, Date.parse(t) > Date.now() + 60_000 ? 1 : 0, iso(), atk.personal.id, vardkontakt.gerVardrelation(db, atk.personal, atk.patientId));
  const v = vardkontakt.hamtaKontakt(db, r.lastInsertRowid);
  return [201, { ...vardkontakt.kontaktUt(db, v, atk.personal), ...besokUt(v) }];
}

// Hälsoärendet för kontakten, eller ett nytt som systemet skapar för förloppet.
function halsoarende(db, personal, v) {
  if (v.halsoarende_id) return v.halsoarende_id;
  const id = Number(db.query("INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, grund, skapad, skapad_av, status) VALUES (?, ?, ?, 'vardform', ?, ?, 'aktivt')")
    .run(v.patient_id, vardenhetFor(db, v.enhet_id), v.orsak ?? 'Vårdförlopp', iso(), personal.id).lastInsertRowid);
  db.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE id = ?').run(id, v.id);
  return id;
}
// Nästa vardag klockan 10 svensk tid, för första hembesöket.
function nastaVardag(nu = new Date()) {
  const d = new Date(nu.getTime() + 86400_000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(`${d.toISOString().slice(0, 10)}T09:00:00Z`).toISOString();
}

// POST /api/vardtillfalle/:id/overgang { till: hemsjukvard | oppenvard, start? }: utskrivning och ny kontakt i ett steg.
export function franSlutenvard(atk, vt, body = {}) {
  const db = atk.db;
  const till = body.till;
  if (!['hemsjukvard', 'oppenvard'].includes(till)) throw new Fel(400, 'Välj hemsjukvård eller öppenvård som fortsättning efter utskrivningen.', 'ogiltig', { falt: ['till'] });
  const start = provaStart(body.start, nastaVardag());
  const vistelse = db.query("SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? AND typ = 'slutenvard' ORDER BY start DESC, id DESC").get(vt.id);
  const ut = db.transaction(() => {
    const utskriven = vardkontakt.skrivUt(atk, vt);
    const sista = vardkontakt.hamtaKontakt(db, vistelse.id);
    const ha = halsoarende(db, atk.personal, sista);
    const ve = vardenhetFor(db, sista.enhet_id);
    const mott = db.query("SELECT id FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats' AND namn LIKE '%mottagning%' ORDER BY id").get(ve)?.id ?? ve;
    const r = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla, planerad, foregaende_id, halsoarende_id, skapad, skapad_av, ger_vardrelation)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'vardkallan', 1, ?, ?, ?, ?, ?)`).run(vt.patient_id, till === 'hemsjukvard' ? ve : mott, till, till === 'hemsjukvard' ? 'hembesok' : 'besok', start,
      till === 'hemsjukvard' ? 'Hemsjukvård, patientens hem' : 'Mottagning', `Uppföljning efter slutenvård: ${vt.orsak ?? sista.orsak ?? ''}`.trim(), sista.id, ha, iso(), atk.personal.id, vardkontakt.gerVardrelation(db, atk.personal, vt.patient_id));
    const ny = vardkontakt.hamtaKontakt(db, r.lastInsertRowid);
    return { vardtillfalle: utskriven, ny: { ...vardkontakt.kontaktUt(db, ny, atk.personal), ...besokUt(ny) }, halsoarendeId: ha,
      text: `Patienten är utskriven, och ${VARDFORMER[till].toLowerCase()} är planerad ${till === 'hemsjukvard' ? 'med första hembesöket' : ''} ${new Date(start).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' })}, i samma hälsoärende.`.replace(/\s+/g, ' ') };
  })();
  return ut;
}

// POST /api/vardkontakt/:id/overgang { till: slutenvard, enhetId?, plats? }: från dagkirurgi till inskrivning.
export function franDagkirurgi(atk, v, body = {}) {
  const db = atk.db;
  egenKontakt(atk, v, 'skriva in patienten från kontakten');
  if (v.typ !== 'dagkirurgi') throw new Fel(400, 'Övergången till slutenvård görs från en dagkirurgisk kontakt eller från ett akutbesök vid inskrivningen.', 'ogiltig');
  if (v.slut) throw new Fel(400, 'Kontakten är redan avslutad.', 'ogiltig');
  return db.transaction(() => {
    const ha = halsoarende(db, atk.personal, v);
    const [status, vt] = vardkontakt.skrivIn(atk, { ...body, orsak: body.orsak ?? `Kvar efter dagkirurgi: ${v.orsak}` });
    const t = iso();
    db.query('UPDATE vardkontakter SET slut = ?, besok_slut = coalesce(besok_slut, ?), andrad = ?, andrad_av = ? WHERE id = ?').run(t, t, t, atk.personal.id, v.id);
    const ny = db.query("SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? AND typ = 'slutenvard' ORDER BY id DESC").get(vt.id);
    db.query('UPDATE vardkontakter SET foregaende_id = ?, halsoarende_id = ? WHERE id = ?').run(v.id, ha, ny.id);
    return [status, { vardtillfalle: vardkontakt.vardtillfalleUt(atk, vardkontakt.hamtaVardtillfalle(db, vt.id)), halsoarendeId: ha, text: 'Patienten är inskriven från den dagkirurgiska kontakten, i samma hälsoärende.' }];
  })();
}

// Kedjan av vårdformer som kontakten ingår i: föregående och följande kontakter, med tider och besökstid. Bara de
// kontakter som anroparen får se (synliga) tas med, och en dold kontakt bryter inte kedjan men visas utan uppgifter.
export function kedja(db, v, synlig) {
  const fore = [];
  let x = v;
  for (let i = 0; i < 20 && x?.foregaende_id; i++) { x = vardkontakt.hamtaKontakt(db, x.foregaende_id); fore.unshift(x); }
  const efter = [];
  let senaste = v;
  for (let i = 0; i < 20; i++) {
    const n = db.query('SELECT * FROM vardkontakter WHERE foregaende_id = ? ORDER BY start, id LIMIT 1').get(senaste.id);
    if (!n) break;
    efter.push(n); senaste = n;
  }
  return [...fore, v, ...efter].map(k => (synlig(k) ? {
    id: k.id, vardform: k.typ, vardformText: VARDFORMER[k.typ] ?? k.typ, start: k.start, ankomst: k.ankomst ?? null, slut: k.slut, ...besokUt(k), vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(k.enhet_id)?.namn ?? null, aktuell: k.id === v.id,
  } : { id: null, dold: true, vardformText: 'Kontakt på en annan vårdenhet' }));
}

export const egnaEnheter = (db, personal) => enheterUnder(db, vardenhetFor(db, personal.enhet_id));
