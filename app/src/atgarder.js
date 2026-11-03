// Åtgärder med KVÅ (runda 6, r1, egna kravet D9 och Sussa 5.1.3.5). Systemet sätter koden själv när åtgärden görs:
// en hel NEWS2-omgång är övervakning av vitala tecken (QD008), en GCS-bedömning bedömning av medvetandefunktioner
// (PA001) och en läkemedelsgenomgång en enkel läkemedelsgenomgång (XV015). Ingen behöver välja en kod i en lista.
// Åtgärderna lämnas ut i FHIR som Procedure med samma behörighet och loggning som de uppgifter de bygger på:
// övervakningen och bedömningen som mätvärden (las_matvarden, med inre sekretess) och läkemedelsgenomgången som
// läkemedelslistan (las_lakemedel, gemensam men med spärr).
import { Fel } from './db.js';
import { Atkomst } from './atkomst.js';
import { KVA, SYSTEM } from './kodverk.js';
import { CS } from './fhir-definitioner.js';

export const HANDLING_FOR = { QD008: 'las_matvarden', PA001: 'las_matvarden', XV015: 'las_lakemedel' };

export function registreraAtgard(atk, { kod, tid, vardkontaktId = null, underlag = null }) {
  if (!KVA[kod]) throw new Fel(400, 'Okänd åtgärdskod.', 'ogiltig');
  const r = atk.db.query('INSERT INTO atgarder (patient_id, enhet_id, vardkontakt_id, kod, tid, av, underlag) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, vardkontaktId, kod, tid, atk.personal.id, underlag ? JSON.stringify(underlag) : null);
  return atgardUt(atk.db.query('SELECT * FROM atgarder WHERE id = ?').get(r.lastInsertRowid));
}

export const atgardUt = (a) => ({ id: a.id, kod: a.kod, text: KVA[a.kod], system: 'KVÅ', tid: a.tid, vardkontaktId: a.vardkontakt_id });

// Raderna som Procedure byggs av: åtgärderna och läkemedelsgenomgångarna. Id:t har ett prefix per källa.
const genomgangar = (db, pid) => (db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'lakemedelsgenomgangar'").get()
  ? db.query('SELECT * FROM lakemedelsgenomgangar WHERE patient_id = ? ORDER BY tid').all(pid) : []);
function kallor(db, pid) {
  return [
    ...db.query('SELECT * FROM atgarder WHERE patient_id = ? ORDER BY tid, id').all(pid).map(a => ({ fhirId: `a-${a.id}`, kod: a.kod, rad: a, tid: a.tid, enhet_id: a.enhet_id, av: a.av, vk: a.vardkontakt_id, kalla: a.kalla, underlag: a.underlag })),
    ...genomgangar(db, pid).map(g => ({ fhirId: `lg-${g.id}`, kod: 'XV015', rad: g, tid: g.tid, enhet_id: g.enhet_id, av: g.av, vk: null, kalla: g.kalla, underlag: null })),
  ];
}

export function procedure(db, k) {
  const av = k.av ? db.query('SELECT namn FROM personal WHERE id = ?').get(k.av)?.namn : null;
  return {
    resourceType: 'Procedure', id: k.fhirId, meta: { tag: [{ system: `${CS}/kalla`, code: k.kalla }] }, status: 'completed',
    code: { coding: [{ system: SYSTEM.kva, code: k.kod, display: KVA[k.kod] }], text: KVA[k.kod] },
    subject: { reference: `Patient/${k.rad.patient_id}` }, ...(k.vk ? { encounter: { reference: `Encounter/${k.vk}` } } : {}),
    performedDateTime: k.tid,
    performer: [...(k.av ? [{ actor: { reference: `Practitioner/${k.av}`, ...(av ? { display: av } : {}) } }] : []), { actor: { reference: `Organization/${k.enhet_id}` } }],
  };
}

// FHIR: GET /fhir/Procedure?patient=<id> och GET /fhir/Procedure/<id>. ctx som i fhir.hantera.
export function hantera(ctx, delar, bundle) {
  const { db, personal, url } = ctx;
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const [, id] = delar;
  if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  if (id) {
    const m = id.match(/^(a|lg)-(\d{1,9})$/);
    const tabell = m?.[1] === 'a' ? 'atgarder' : 'lakemedelsgenomgangar';
    const rad = m && db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tabell) && db.query(`SELECT patient_id FROM ${tabell} WHERE id = ?`).get(Number(m[2]));
    if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const k = kallor(db, rad.patient_id).find(x => x.fhirId === id);
    const handling = HANDLING_FOR[k.kod];
    const atk = new Atkomst(db, personal, k.rad.patient_id, ctx.valFor(k.rad.patient_id), handling);
    atk.krav(handling, { resurs: { enhet_id: k.enhet_id, gemensam: handling === 'las_lakemedel' }, beskrivning: `fhir/Procedure/${id}` });
    atk.logga(handling, atk.grund(), `fhir/Procedure/${id}`);
    return { status: 200, body: procedure(db, k) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), 'las_oversikt');
  atk.krav('las_oversikt', { beskrivning: `fhir/Procedure${url.search}` });
  const synliga = kallor(db, pid).filter(k => atk.filtrera([k], HANDLING_FOR[k.kod], { gemensam: HANDLING_FOR[k.kod] === 'las_lakemedel' }).length);
  atk.logga('las_oversikt', atk.grund(), `fhir/Procedure${url.search}`);
  return { status: 200, body: bundle(synliga.map(k => procedure(db, k))) };
}
