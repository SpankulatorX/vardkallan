// Gemensamma hjälpare för specialistområdena i runda 9, r3: operation (operation.js), graviditet och förlossning
// (obstetrik.js), cytostatika (cytostatika.js), bilder och media (bilder.js) och blodprodukter (blod.js).
import { Fel } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { MATTYPER } from './journal.js';
import { pagandeFor } from './vardkontakt.js';

export const MIN = 60_000;
export const TIMME = 60 * MIN;
export const DAG = 24 * TIMME;

// Uppslagstabeller utan prototyp, så att en nyckel som constructor eller __proto__ från en klient aldrig blir ett ingrepp,
// en regim, en produkt eller en källa.
export const tabell = (o) => Object.freeze(Object.assign(Object.create(null), o));
export const finns = (t, nyckel) => typeof nyckel === 'string' && Object.hasOwn(t, nyckel);

export const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
export const enhetsnamn = (db, id) => (id ? db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id : null);
export const enhetKort = (db, id) => (id ? { id, namn: enhetsnamn(db, id) } : null);
export const textFalt = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const tal = (v, dec = 0) => String(dec ? Number(v).toFixed(dec) : Math.round(v)).replace('.', ',');
export const iso = (d) => new Date(d).toISOString();

export function tid(v, falt, nu, { bakat = 30 * DAG, framat = 5 * MIN } = {}) {
  if (v == null || v === '') return iso(nu);
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || ms > nu.getTime() + framat || ms < nu.getTime() - bakat) {
    throw new Fel(400, 'Tiden är inte en giltig tidpunkt.', 'ogiltig', { falt: [falt] });
  }
  return iso(ms);
}

export const kravRoll = (personal, handling, text = 'Din yrkesroll kan inte göra det.') => {
  if (!kanRoll(personal, handling)) throw new Fel(403, text, 'nekad');
};

// Den pågående vårdkontakten på den inloggades vårdenhet, som det som registreras knyts till.
export const vardkontaktFor = (atk, nu) => pagandeFor(atk.db, atk.personal, atk.patientId, nu.getTime())?.id ?? null;

// En rad som prövas för en patient, utan att något loggas. Används i listor på enhetsnivå.
export const provaRad = (db, personal, valFor, rad, handling) =>
  new Atkomst(db, personal, rad.patient_id, valFor(rad.patient_id), handling).prova(handling, { enhet_id: rad.enhet_id });

// Loggar en patient som visas i en lista på enhetsnivå.
export const loggaPatient = (db, personal, patientId, handling, grund, resurs) =>
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: patientId, handling, resurs, grund, resultat: 'tillaten' });

// Registrerar ett mätvärde med samma gränser som mätvärdesfliken (journal.js MATTYPER), med en tid som anroparen har
// prövat. Används för kontrollerna på uppvakningen och under förlossningen.
export function matvarde(atk, typ, varde, tidpunkt) {
  const def = MATTYPER[typ];
  if (!def) throw new Fel(400, 'Okänd typ av mätvärde.', 'ogiltig', { falt: [typ] });
  let text = null, num = null;
  if (def.format === 'acvpu') {
    text = typeof varde === 'string' ? varde.trim().toUpperCase() : '';
    if (!['A', 'C', 'V', 'P', 'U'].includes(text)) throw new Fel(400, 'Medvetandegraden anges med A, C, V, P eller U.', 'ogiltig', { falt: [typ] });
  } else if (def.format === 'blodtryck') {
    const m = typeof varde === 'string' && varde.trim().match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!m || Number(m[1]) <= Number(m[2])) throw new Fel(400, 'Blodtryck anges som systoliskt/diastoliskt, till exempel 120/80.', 'ogiltig', { falt: [typ] });
    text = `${Number(m[1])}/${Number(m[2])}`;
    num = Number(m[1]);
  } else {
    num = typeof varde === 'string' ? Number(varde.replace(',', '.')) : varde;
    if (typeof num !== 'number' || !Number.isFinite(num) || num < def.min || num > def.max) {
      throw new Fel(400, `${def.namn} måste vara ett tal mellan ${def.min} och ${def.max}.`, 'ogiltig', { falt: [typ] });
    }
    text = String(num);
  }
  const enhet = { puls: 'slag/min', temp: '°C', saturation: '%', andningsfrekvens: 'andetag/min', smarta: 'av 10', blodtryck: 'mmHg', medvetande: '' }[typ] ?? null;
  const r = atk.db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, typ, text, num, enhet, tidpunkt, atk.personal.id);
  return Number(r.lastInsertRowid);
}

export { vardenhetFor };
