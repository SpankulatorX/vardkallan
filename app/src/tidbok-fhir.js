// Tidboken i FHIR R4: Schedule (ett schema per vårdgivare och mottagning), Slot (en tid) och Appointment (en bokning,
// med status för incheckning). Samma behörighet och loggning som /api: scheman och tider innehåller inga
// patientuppgifter och kräver bara inloggning, medan en bokning prövas i behörighetsmotorn som vårdkontakten, med
// inre sekretess per vårdenhet, och loggas på patienten. Invånaren når bara sina egna bokningar.
import { Fel } from './db.js';
import { Atkomst, vardenhetFor } from './atkomst.js';
import { InvanareAtkomst, journaler } from './patientvy.js';
import * as tidbok from './tidbok.js';
// Runda 6, r4: incheckning genom FHIR svarar med vårdkontakten som Encounter, som i fhir.js.
import * as fhir from './fhir.js';

export const TIDBOK_TYPER = ['Schedule', 'Slot', 'Appointment'];
const ref = (typ, id, display) => ({ reference: `${typ}/${id}`, ...(display ? { display } : {}) });
const MAX_SLOT = 500;

export function schedule(db, s) {
  const p = db.query('SELECT namn FROM personal WHERE id = ?').get(s.personal_id);
  const e = db.query('SELECT namn FROM enheter WHERE id = ?').get(s.enhet_id);
  return {
    resourceType: 'Schedule', id: s.id, active: true, actor: [ref('Practitioner', s.personal_id, p?.namn)],
    serviceType: [{ text: tidbok.YRKESROLL[s.yrkesroll] }], comment: e?.namn,
  };
}

export function slot(db, t) {
  return {
    resourceType: 'Slot', id: String(t.id), schedule: ref('Schedule', t.schema_id), status: tidbok.arLedig(db, t) ? 'free' : 'busy',
    start: t.start, end: t.slut, appointmentType: { text: tidbok.TIDSTYPER[t.tidstyp]?.text }, ...(t.rubrik ? { comment: t.rubrik } : {}),
  };
}

// Bokningens status i FHIR: booked, arrived när patienten har checkat in, fulfilled när vårdkontakten är avslutad, och
// cancelled för en avbokad eller ombokad tid.
export function appointmentStatus(db, b) {
  const v = b.vardkontakt_id ? db.query('SELECT ankomst, slut FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id) : null;
  if (b.status === 'avbokad' || b.status === 'ombokad') return 'cancelled';
  if (v?.slut && (b.status === 'incheckad' || v.ankomst)) return 'fulfilled';
  if (b.status === 'incheckad' || v?.ankomst) return 'arrived';
  return 'booked';
}

export function appointment(db, b, { invanare = false } = {}) {
  const t = tidbok.tidRad(db, b.tid_id);
  const s = tidbok.schemaRad(db, t.schema_id);
  const p = db.query('SELECT namn FROM personal WHERE id = ?').get(s.personal_id);
  const status = appointmentStatus(db, b);
  return {
    resourceType: 'Appointment', id: String(b.id), status,
    // Invånaren får samma uppgifter som Min journal visar: ingen fri text från personalen, varken orsak eller avbokningsorsak.
    ...(status === 'cancelled' ? { cancelationReason: { text: b.status === 'ombokad' ? 'Ombokad till en annan tid' : invanare ? 'Avbokad' : b.orsak ?? 'Avbokad' } } : {}),
    appointmentType: { text: tidbok.TIDSTYPER[t.tidstyp]?.text }, ...(invanare ? (t.rubrik ? { description: t.rubrik } : {}) : { description: b.orsak ?? undefined }),
    start: t.start, end: t.slut, created: b.bokad, slot: [ref('Slot', t.id)],
    ...(b.remiss_id && !invanare ? { basedOn: [ref('ServiceRequest', b.remiss_id)] } : {}),
    participant: [
      { actor: ref('Patient', b.patient_id), status: 'accepted' },
      { actor: invanare ? { display: p?.namn ?? 'Vårdpersonal' } : ref('Practitioner', s.personal_id, p?.namn), status: 'accepted' },
    ],
  };
}

const enhetFor = (db, b) => tidbok.bokningensEnhet(db, b);

// ctx som i fhir.js. bundle bygger en Bundle av typen searchset.
export function hantera(ctx, delar, bundle) {
  const { db, personal, invanare, url } = ctx;
  const [typ, id] = delar;
  if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  if (!personal && invanare) return hanteraInvanare(ctx, typ, id, bundle);
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');

  if (typ === 'Schedule') {
    if (id) {
      const s = tidbok.schemaRad(db, id);
      if (!s) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      return { status: 200, body: schedule(db, s) };
    }
    const _id = url.searchParams.get('_id');
    const rader = _id ? db.query('SELECT * FROM scheman WHERE id = ?').all(_id) : db.query('SELECT * FROM scheman ORDER BY id').all();
    return { status: 200, body: bundle(rader.map(s => schedule(db, s))) };
  }
  if (typ === 'Slot') {
    if (id) {
      const t = /^\d{1,9}$/.test(id) ? db.query('SELECT * FROM tider WHERE id = ?').get(Number(id)) : null;
      if (!t) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      return { status: 200, body: slot(db, t) };
    }
    const sch = (url.searchParams.get('schedule') ?? '').replace(/^Schedule\//, '');
    if (!sch) throw new Fel(400, 'Sökparametern schedule krävs.', 'ogiltig');
    const fran = url.searchParams.get('start')?.replace(/^ge/, '') ?? new Date().toISOString();
    const rader = db.query('SELECT * FROM tider WHERE schema_id = ? AND start >= ? ORDER BY start LIMIT ?').all(sch, fran, MAX_SLOT);
    return { status: 200, body: bundle(rader.map(t => slot(db, t))) };
  }
  // Appointment: patientuppgifter, prövas och loggas.
  if (id) {
    const b = /^\d{1,9}$/.test(id) ? db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(id)) : null;
    if (!b) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const atk = new Atkomst(db, personal, b.patient_id, ctx.valFor(b.patient_id), 'las_admin');
    atk.krav('las_admin', { resurs: { enhet_id: enhetFor(db, b) }, beskrivning: `fhir/Appointment/${id}` });
    atk.logga('las_admin', atk.grund(), `fhir/Appointment/${id}`);
    return { status: 200, body: appointment(db, b) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('actor') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), 'las_admin');
  atk.krav('las_admin', { beskrivning: `fhir/Appointment${url.search}` });
  const rader = atk.filtrera(db.query('SELECT * FROM bokningar WHERE patient_id = ? ORDER BY id').all(pid).map(b => ({ ...b, enhet_id: enhetFor(db, b) })), 'las_admin');
  atk.logga('las_admin', atk.grund(), `fhir/Appointment${url.search}`);
  return { status: 200, body: bundle(rader.map(b => appointment(db, b))) };
}

// Invånaren: bara Appointment, och bara i journaler som invånaren får läsa. Allt annat svarar som en resurs som inte finns.
function hanteraInvanare(ctx, typ, id, bundle) {
  const { db, invanare, url } = ctx;
  if (typ !== 'Appointment') throw new Fel(403, 'Tidbokens scheman och tider nås inte med en session från Min journal. Dina tider finns i Min journal.', 'nekad');
  const oppna = (pid, resurs) => { const atk = new InvanareAtkomst(db, invanare, pid, ctx.nekade ?? null); atk.krav(resurs); return atk; };
  if (id) {
    const b = /^\d{1,9}$/.test(id) ? db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(id)) : null;
    const egna = journaler(db, invanare).filter(j => j.atkomst).map(j => j.patientId);
    if (!b || !egna.includes(b.patient_id)) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const atk = oppna(b.patient_id, `fhir/Appointment/${b.id}`);
    atk.logga(`fhir/Appointment/${b.id}`);
    return { status: 200, body: appointment(db, b, { invanare: true }) };
  }
  const pid = (url.searchParams.get('patient') ?? '').replace(/^Patient\//, '');
  if (!/^p\d{1,4}$/.test(pid)) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  const atk = oppna(pid, `fhir/Appointment?patient=${pid}`);
  atk.logga(`fhir/Appointment?patient=${pid}`);
  return { status: 200, body: bundle(db.query('SELECT * FROM bokningar WHERE patient_id = ? ORDER BY id').all(pid).map(b => appointment(db, b, { invanare: true }))) };
}

export const capabilityResurser = () => TIDBOK_TYPER.map(t => ({
  // Runda 6, r4: Appointment kan också skrivas med PATCH, för incheckning.
  type: t, interaction: [{ code: 'read' }, { code: 'search-type' }, ...(t === 'Appointment' ? [{ code: 'patch' }] : [])],
  searchParam: t === 'Schedule' ? [{ name: '_id', type: 'token' }] : t === 'Slot' ? [{ name: 'schedule', type: 'reference' }, { name: 'start', type: 'date' }] : [{ name: 'patient', type: 'reference' }],
}));
export const vardenhetForBokning = (db, b) => vardenhetFor(db, enhetFor(db, b));

// ---------------------------------------------------------------------------------------------------------------
// Runda 6, r4: incheckning genom FHIR (Sussa 3.4.4.5). En mobil lösning eller en incheckningsskärm kan checka in med
// PATCH på Appointment/[id] eller på Encounter/[id] för den planerade vårdkontakten, med JSON Patch och bara
// [{ "op": "replace", "path": "/status", "value": "arrived" }]. Samma behörighet och loggning som i gränssnittet:
// personalen behöver checka_in och den egna vårdenhetens tid, och invånaren checkar in sin egen tid när incheckningen
// är öppen. Allt annat än incheckning avvisas, så att FHIR-API:t inte blir en väg runt systemets regler.
export const SKRIVBARA = ['Appointment', 'Encounter'];
export const medSkrivning = (cap) => {
  for (const r of cap.rest?.[0]?.resource ?? []) if (r.type === 'Encounter' && !r.interaction.some(i => i.code === 'patch')) r.interaction.push({ code: 'patch' });
  return cap;
};

function tolkaPatch(typ, kropp) {
  if (!/^application\/json-patch\+json\b/.test(typ ?? '')) throw new Fel(415, 'Skicka JSON Patch med Content-Type application/json-patch+json.', 'ogiltig');
  let ops;
  try { ops = JSON.parse(kropp); } catch { throw new Fel(400, 'Ogiltig JSON.', 'ogiltig'); }
  if (!Array.isArray(ops) || !ops.length) throw new Fel(400, 'JSON Patch ska vara en lista med operationer.', 'ogiltig');
  const andra = ops.filter(o => o?.op !== 'test');
  if (andra.length !== 1 || !['replace', 'add'].includes(andra[0].op) || andra[0].path !== '/status' || andra[0].value !== 'arrived') {
    throw new Fel(422, 'Bara incheckning stöds. Ombokning, avbokning och andra ändringar görs i Vårdkällan, så att systemets regler gäller.', 'ogiltig');
  }
}

// ctx som i fhir.js. kropp är texten i förfrågan och typ dess Content-Type.
export function skriv(ctx, delar, { kropp, typ }) {
  const { db, personal, invanare } = ctx;
  const [resurs, id] = delar;
  if (delar.length !== 2 || !SKRIVBARA.includes(resurs) || !/^\d{1,9}$/.test(id ?? '')) throw new Fel(405, 'Bara Appointment och Encounter kan skrivas, och bara för incheckning.', 'ogiltig');
  if (!personal && !invanare) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  tolkaPatch(typ, kropp);
  let b;
  if (resurs === 'Appointment') b = db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(id));
  else {
    const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(Number(id));
    if (!v) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    b = db.query("SELECT * FROM bokningar WHERE vardkontakt_id = ? AND status IN ('bokad', 'incheckad') ORDER BY id DESC").get(v.id);
    if (!b) {
      if (invanare) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      // Personalen får veta varför, men bara om patienten är någon som de får se.
      const atk = new Atkomst(db, personal, v.patient_id, ctx.valFor(v.patient_id), 'checka_in');
      atk.krav('checka_in', { beskrivning: `fhir/Encounter/${id}:ankomst` });
      throw new Fel(400, 'Vårdkontakten är ingen bokad tid. Ankomsten registreras i vårdkontakten.', 'ogiltig');
    }
  }
  if (!b) throw new Fel(404, 'Resursen finns inte.', 'saknas');
  const loggresurs = `fhir/${resurs}/${id}:ankomst`;
  if (personal) {
    const atk = new Atkomst(db, personal, b.patient_id, ctx.valFor(b.patient_id), 'checka_in');
    atk.krav('checka_in', { beskrivning: loggresurs });
    tidbok.kravEgenVardenhet(atk, enhetFor(db, b), loggresurs);
    tidbok.checkaInRad(db, b, 'fhir', { av: personal.id });
    atk.logga('checka_in', atk.grund(), loggresurs);
  } else {
    // Invånaren: bara egna tider, och samma regler som i Min journal.
    const egna = journaler(db, invanare).filter(j => j.atkomst).map(j => j.patientId);
    if (!egna.includes(b.patient_id)) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const atk = new InvanareAtkomst(db, invanare, b.patient_id, ctx.nekade ?? null);
    atk.krav(loggresurs);
    const u = tidbok.minBokningUt(db, b);
    if (!u.kan.checkaIn) throw new Fel(400, u.status === 'incheckad' ? 'Du är redan incheckad.' : 'Incheckningen är öppen från en timme före till en halvtimme efter tiden, för besök på mottagningen.', 'ogiltig');
    tidbok.checkaInRad(db, b, 'fhir', { avInvanare: invanare.id });
    atk.logga(loggresurs, { handling: 'checka_in' });
  }
  const ny = tidbok.bokningRad(db, b.id);
  if (resurs === 'Appointment') return { status: 200, body: appointment(db, ny, { invanare: !personal }) };
  return { status: 200, body: fhir.encounter(db, db.query('SELECT * FROM vardkontakter WHERE id = ?').get(ny.vardkontakt_id)) };
}
