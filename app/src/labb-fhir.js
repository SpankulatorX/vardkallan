// Beställning och svar i FHIR R4 (runda 8, r1, Sussa 4.4.1.4): varje analys i en beställning är en ServiceRequest med
// beställnings-id:t som requisition, varje rör är en Specimen med etikett-id:t, och svaret från ett laboratorium är en
// DiagnosticReport med mätvärdena som Observation (samma som mätvärdena i journalen) och odlingens fynd i Snomed CT.
// Samma behörighet och loggning som i gränssnittet: beställningarna prövas på den beställande vårdenheten med
// handlingen las_prover, så att inre sekretess och spärr gäller.
import { Fel } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import * as labb from './labb.js';
import { SYSTEM, MATKOD } from './kodverk.js';
import { CS } from './fhir-definitioner.js';
import { ANALYS, LAB, ROR, FYND, DISCIPLINER } from './labb-katalog.js';

export const TYPER = ['DiagnosticReport', 'Specimen'];
const HSA = 'urn:oid:1.2.752.29.4.19';
const SNOMED = 'http://snomed.info/sct';
// Beställnings-id och etikett-id är identifierare, inte koder, och har Vårdkällans egna system för identifierare.
export const BESTALLNING_SYSTEM = `${CS.replace(/CodeSystem$/, 'NamingSystem')}/bestallnings-id`;
export const ETIKETT_SYSTEM = `${CS.replace(/CodeSystem$/, 'NamingSystem')}/etikett-id`;
const ref = (typ, id, display) => ({ reference: `${typ}/${id}`, ...(display ? { display } : {}) });
const personNamn = (db, id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn;
const labRef = (labId) => { const l = LAB[labId]; return { identifier: { system: HSA, value: l.hsa }, display: l.namn }; };
const kalla = (b) => ({ tag: [{ system: `${CS}/kalla`, code: b.kalla ?? 'vardkallan' }] });
const LABBET = { coding: [{ system: SNOMED, code: '108252007', display: 'Laboratory procedure' }] };
const V2_0074 = 'http://terminology.hl7.org/CodeSystem/v2-0074';
const V2_0487 = 'http://terminology.hl7.org/CodeSystem/v2-0487';
const V3_TOLKNING = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
const TOLKNING = { hogt: ['H', 'High'], lagt: ['L', 'Low'], kritiskt_hogt: ['HH', 'Critical high'], kritiskt_lagt: ['LL', 'Critical low'] };

const SR_STATUS = { bestalld: 'active', delvis_provtagen: 'active', skickad: 'active', delvis_besvarad: 'active', besvarad: 'completed', vidimerad: 'completed', makulerad: 'revoked' };

export function serviceRequest(db, b, a) {
  const def = ANALYS[a.analys];
  // En analys med ett mätvärde (kreatinin ger också eGFR) har mätvärdets NPU-kod. Blodstatus och odlingar har bara text.
  const kod = def?.matvarden && (def.matvarden.length === 1 || def.id === 'kreatinin') ? MATKOD[def.matvarden[0]] : null;
  const status = a.status === 'borttagen' ? 'revoked' : a.status === 'makulerad' || b.makulerad_tid ? 'revoked' : a.status === 'besvarad' ? 'completed' : SR_STATUS.bestalld;
  return {
    resourceType: 'ServiceRequest', id: `labb-${a.id}`, meta: kalla(b),
    identifier: [{ system: `${BESTALLNING_SYSTEM}/analys`, value: `${b.nummer}-${a.id}` }],
    requisition: { system: BESTALLNING_SYSTEM, value: b.nummer },
    status, intent: 'order', category: [LABBET],
    code: { ...(kod ? { coding: kod.coding.map(c => ({ ...c })) } : {}), text: def?.namn ?? a.analys },
    subject: ref('Patient', b.patient_id), ...(b.vardkontakt_id ? { encounter: ref('Encounter', b.vardkontakt_id) } : {}),
    occurrenceDateTime: db.query('SELECT planerad FROM labb_prov WHERE id = ?').get(a.prov_id)?.planerad ?? b.planerad,
    authoredOn: b.skapad, requester: ref('Practitioner', b.ansvarig_id, personNamn(db, b.ansvarig_id)),
    // Runda 10, r6: en undersökning har inget prov och därför ingen Specimen.
    performer: [labRef(a.lab_id)], ...(ROR[db.query('SELECT ror FROM labb_prov WHERE id = ?').get(a.prov_id)?.ror]?.utanProv ? {} : { specimen: [ref('Specimen', `labb-${a.prov_id}`)] }),
    ...(b.anamnes || b.makulerad_orsak ? { note: [b.anamnes && { text: `Anamnes: ${b.anamnes}` }, b.makulerad_orsak && { text: `Makulerad: ${b.makulerad_orsak}` }].filter(Boolean) } : {}),
  };
}

export function specimen(db, b, p) {
  const r = ROR[p.ror];
  const analyser = db.query("SELECT id FROM labb_analyser WHERE prov_id = ? AND status <> 'borttagen' ORDER BY id").all(p.id);
  return {
    resourceType: 'Specimen', id: `labb-${p.id}`, meta: kalla(b), identifier: [{ system: ETIKETT_SYSTEM, value: p.etikett }],
    status: b.makulerad_tid || p.borttagen ? 'unavailable' : 'available',
    type: { coding: [{ system: V2_0487, code: r.fhir }, { system: SNOMED, code: r.snomed, display: r.snomedText }], text: `${r.material}, ${r.namn.toLocaleLowerCase('sv')}` },
    subject: ref('Patient', b.patient_id), request: analyser.map(a => ref('ServiceRequest', `labb-${a.id}`)),
    ...(p.provtagen_tid ? { collection: { collectedDateTime: p.provtagen_tid, collector: ref('Practitioner', p.provtagen_av, personNamn(db, p.provtagen_av)) } } : {}),
    ...(p.skickad_tid ? { receivedTime: p.skickad_tid } : {}),
    container: [{ description: `${r.namn}, ${r.farg}` }],
  };
}

// Ett svar per beställning och laboratorium. id: labb-<beställning>-<laboratorium>.
export function diagnosticReport(db, b, labId) {
  const an = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND lab_id = ? AND status <> 'borttagen' ORDER BY id").all(b.id, labId);
  const besvarade = an.filter(a => a.status === 'besvarad');
  const l = LAB[labId];
  const disciplin = DISCIPLINER[l.disciplin];
  const obs = besvarade.flatMap(a => db.query('SELECT matvarde_id FROM labb_svar WHERE analys_rad_id = ? ORDER BY id').all(a.id).map(x => ref('Observation', x.matvarde_id)));
  const prov = [...new Set(an.map(a => a.prov_id))];
  const tagna = prov.map(id => db.query('SELECT provtagen_tid FROM labb_prov WHERE id = ?').get(id)?.provtagen_tid).filter(Boolean).sort();
  const fynd = besvarade.filter(a => a.fynd).map(a => FYND[a.fynd]);
  const text = besvarade.filter(a => a.svar_text).map(a => `${ANALYS[a.analys]?.namn}: ${a.svar_text}`).join(' ');
  const vidimerad = besvarade.length && besvarade.every(a => a.vidimerad_tid);
  return {
    resourceType: 'DiagnosticReport', id: `labb-${b.id}-${labId}`, meta: kalla(b),
    identifier: [{ system: BESTALLNING_SYSTEM, value: `${b.nummer}-${labId}` }],
    basedOn: an.map(a => ref('ServiceRequest', `labb-${a.id}`)),
    status: b.makulerad_tid ? 'cancelled' : !besvarade.length ? 'registered' : besvarade.length === an.length ? 'final' : 'partial',
    category: [{ coding: [{ system: V2_0074, code: disciplin.fhir }], text: disciplin.namn }],
    code: { coding: [{ system: SYSTEM.loinc, code: '11502-2', display: 'Laboratory report' }], text: `Svar från ${l.kort}` },
    subject: ref('Patient', b.patient_id), ...(b.vardkontakt_id ? { encounter: ref('Encounter', b.vardkontakt_id) } : {}),
    ...(tagna.length ? { effectiveDateTime: tagna[0] } : {}),
    ...(besvarade.length ? { issued: besvarade.map(a => a.besvarad_tid).sort().at(-1) } : {}),
    performer: [labRef(labId)],
    ...(vidimerad ? { resultsInterpreter: [ref('Practitioner', besvarade[0].vidimerad_av, personNamn(db, besvarade[0].vidimerad_av))] } : {}),
    specimen: prov.map(id => ref('Specimen', `labb-${id}`)),
    ...(obs.length ? { result: obs } : {}),
    ...(text ? { conclusion: text } : {}),
    ...(fynd.length ? { conclusionCode: fynd.map(f => ({ coding: [{ system: SNOMED, code: f.snomed, display: f.display }], text: f.text })) } : {}),
  };
}

// Kopplingen från ett mätvärde till beställningen och tolkningen mot referensintervallet, för Observation i fhir.js.
export function utokaObservation(db, m, r) {
  const k = labb.svarKoppling(db, m.id);
  if (!k) return r;
  r.basedOn = [ref('ServiceRequest', `labb-${k.analysId}`)];
  const b = db.query('SELECT * FROM labb_bestallningar WHERE id = ?').get(k.bestallningId);
  const a = db.query('SELECT * FROM labb_analyser WHERE id = ?').get(k.analysId);
  const s = labb.bestallningUt(db, b).analyser.find(x => x.id === a.id)?.svar.find(x => x.matvardeId === m.id);
  if (s?.referens && (s.referens.lag != null || s.referens.hog != null)) {
    const q = (v) => ({ value: v, unit: m.matt_enhet, system: SYSTEM.ucum, code: MATKOD[m.typ]?.ucum });
    r.referenceRange = [{ ...(s.referens.lag != null ? { low: q(s.referens.lag) } : {}), ...(s.referens.hog != null ? { high: q(s.referens.hog) } : {}), text: s.referens.text }];
  }
  const t = TOLKNING[s?.avvikande];
  r.interpretation = [{ coding: [{ system: V3_TOLKNING, code: t ? t[0] : 'N', display: t ? t[1] : 'Normal' }] }];
  r.specimen = ref('Specimen', `labb-${a.prov_id}`);
  return r;
}

const synliga = (atk) => labb.synligaBestallningar(atk);
const analyserFor = (db, b) => db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status <> 'borttagen' ORDER BY id").all(b.id);

// ServiceRequest för labbeställningar i en sökning på patienten (fhir.js lägger dem till remisserna).
export function serviceRequestsFor(db, personal, pid, val) {
  if (!kanRoll(personal, 'las_prover')) return [];
  const atk = new Atkomst(db, personal, pid, val, 'las_prover');
  const ut = synliga(atk).flatMap(b => analyserFor(db, b).map(a => serviceRequest(db, b, a)));
  if (ut.length) atk.logga('las_prover', atk.grund(), `fhir/ServiceRequest?patient=${pid}&category=laboratory`);
  return ut;
}
export const arLabbId = (id) => /^labb-\d{1,9}$/.test(String(id ?? ''));
export const arLabbSokning = (url) => /108252007|laboratory/.test(url.searchParams.get('category') ?? '');

// ServiceRequest/labb-<id>, ServiceRequest?patient=<id>&category=108252007, DiagnosticReport och Specimen.
export function hantera(ctx, delar, bundle) {
  const { db, personal, url } = ctx;
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const [typ, id] = delar;
  if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  labb.sakraLabb(db);
  const resursFor = (b) => {
    if (typ === 'ServiceRequest') return analyserFor(db, b).map(a => serviceRequest(db, b, a));
    if (typ === 'Specimen') return db.query('SELECT * FROM labb_prov WHERE bestallning_id = ? AND borttagen = 0 ORDER BY id').all(b.id).filter(p => !ROR[p.ror]?.utanProv).map(p => specimen(db, b, p));
    return [...new Set(analyserFor(db, b).map(a => a.lab_id))].map(l => diagnosticReport(db, b, l));
  };
  if (id) {
    let b = null;
    let m;
    if (typ === 'ServiceRequest' && (m = /^labb-(\d{1,9})$/.exec(id))) b = db.query('SELECT b.* FROM labb_analyser a JOIN labb_bestallningar b ON b.id = a.bestallning_id WHERE a.id = ?').get(Number(m[1]));
    else if (typ === 'Specimen' && (m = /^labb-(\d{1,9})$/.exec(id))) b = db.query('SELECT b.* FROM labb_prov p JOIN labb_bestallningar b ON b.id = p.bestallning_id WHERE p.id = ? AND p.borttagen = 0').get(Number(m[1]));
    else if (typ === 'DiagnosticReport' && (m = /^labb-(\d{1,9})-([a-z-]{1,30})$/.exec(id)) && LAB[m[2]]) b = db.query('SELECT b.* FROM labb_bestallningar b WHERE b.id = ? AND EXISTS (SELECT 1 FROM labb_analyser a WHERE a.bestallning_id = b.id AND a.lab_id = ?)').get(Number(m[1]), m[2]);
    if (!b) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const atk = new Atkomst(db, personal, b.patient_id, ctx.valFor(b.patient_id), 'las_prover');
    atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id }, beskrivning: `fhir/${typ}/${id}` });
    const r = resursFor(b).find(x => x.id === id);
    if (!r) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    atk.logga('las_prover', atk.grund(), `fhir/${typ}/${id}`);
    return { status: 200, body: r };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), 'las_prover');
  atk.krav('las_prover', { beskrivning: `fhir/${typ}${url.search}` });
  const rader = synliga(atk).flatMap(resursFor);
  atk.logga('las_prover', atk.grund(), `fhir/${typ}${url.search}`);
  return { status: 200, body: bundle(rader) };
}
