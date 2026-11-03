// FHIR R4-API. Samma behörighetsmotor och samma loggning som /api (D9).
import { Fel, idag } from './db.js';
import { Atkomst, kanRoll, visningsnamn, vardenhetFor } from './atkomst.js';
import { MATTYPER, lasHandling } from './journal.js';
import { synligaVistelser } from './vardkontakt.js';
import * as logg from './logg.js';
import { SYSTEM as KODSYSTEM, ICD10SE, ATC, MATKOD } from './kodverk.js';
import { EXT, CS, DEFINITIONER } from './fhir-definitioner.js';
import { InvanareAtkomst, journaler, synligKedja, provsvarVisas, MAX_NEKADE } from './patientvy.js';
import { aktivaSparrar } from './atkomst.js';
import { tillaggUt } from './ordinationsmallar.js';
import { FHIR_SYSTEM as ID_SYSTEM, identiteterFor, delaOid, maskera, gallandeId, allaPatientIdn, hittaPaToken } from './identitet.js';
// Tidboken: Schedule, Slot och Appointment (tidbok-fhir.js).
import * as tidbokFhir from './tidbok-fhir.js';
// Plan vid utsättning och delegering av läkemedelshantering (runda 5).
import { utsattningsplan } from './lakemedel.js';
import { delegeringKort } from './delegering.js';

export const SYSTEM = {
  personnummer: 'http://electronichealth.se/identifier/personnummer',
  ...KODSYSTEM,
  hsa: 'urn:oid:1.2.752.29.4.19',
  v2_0203: 'http://terminology.hl7.org/CodeSystem/v2-0203',
  kalla: `${CS}/kalla`,
  felkod: `${CS}/felkod`,
  atkomstgrund: `${CS}/atkomstgrund`,
  confidentiality: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
  sesakerhet: 'http://hl7.se/fhir/ig/base/CodeSystem/SecurityLabel',
  actcode: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  uppmarksamhet: `${CS}/uppmarksamhet`,
};
export const TYPER = ['Patient', 'Encounter', 'EpisodeOfCare', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition', 'Organization', 'Practitioner', 'AuditEvent', 'MedicationAdministration', 'List'];
// Profiler som resurserna påstår att de följer i meta.profile. Bara de som validerats utan fel (docs/fhir-validering.md):
// HL7 Swedens basprofiler (hl7se.fhir.base 1.1.0) och FHIR R4:s vitalparameterprofiler.
export const SEBAS = 'http://hl7.se/fhir/ig/base/StructureDefinition';
export const PROFIL = { Patient: `${SEBAS}/SEBasePatient`, Organization: `${SEBAS}/SEBaseOrganization`, Practitioner: `${SEBAS}/SEBasePractitioner` };
const VITALPROFIL = 'http://hl7.org/fhir/StructureDefinition';
// Konformitetsresurser som kan läsas utan inloggning.
export const DEFINITIONSTYPER = Object.keys(DEFINITIONER);
export const oppenSokvag = (sokvag) => sokvag === '/fhir/metadata' || DEFINITIONSTYPER.some(t => sokvag === `/fhir/${t}` || sokvag.startsWith(`/fhir/${t}/`));
const hsaIdentifier = (value) => ({ type: { coding: [{ system: SYSTEM.v2_0203, code: 'PRN', display: 'Provider number' }] }, system: SYSTEM.hsa, value });

// Handling i behörighetsmotorn per resurstyp.
const HANDLING = {
  Encounter: 'las_admin', EpisodeOfCare: 'las_admin', Condition: 'las_diagnoser', Observation: 'las_matvarden', MedicationRequest: 'las_lakemedel',
  AllergyIntolerance: 'las_oversikt', ServiceRequest: 'las_remiss', Composition: 'las_journal', Flag: 'las_oversikt',
  MedicationAdministration: 'las_lakemedel', List: 'las_lakemedel',
};
const TABELL = {
  Encounter: 'vardkontakter', EpisodeOfCare: 'halsoarenden', Condition: 'diagnoser', Observation: 'matvarden', MedicationRequest: 'ordinationer',
  AllergyIntolerance: 'overkanslighet', ServiceRequest: 'remisser', Composition: 'anteckningar', Flag: 'uppmarksamhet',
  MedicationAdministration: 'administreringar', List: 'vidimeringar',
};
// Ett vårdtillfälle är ett eget Encounter med id vt-<nummer>, som vårdkontakterna på avdelningarna är en del av (partOf).
const VT_ID = /^vt-(\d{1,9})$/;
const vtRad = (db, id) => { const m = VT_ID.exec(id); return m ? db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(Number(m[1])) : null; };
// En resurs med id och patientens resurser av en typ. Encounter är både vårdkontakter och vårdtillfällen.
// Invånaren får inte vårdtillfällen och hälsoärenden, eftersom Min journal inte visar dem.
function radMedId(db, typ, id, { invanare = false } = {}) {
  if (typ === 'Encounter' && VT_ID.test(id)) return invanare ? null : vtRad(db, id);
  return /^\d{1,9}$/.test(String(id)) ? db.query(`SELECT * FROM ${TABELL[typ]} WHERE id = ?`).get(Number(id)) : null;
}
function patientRader(db, typ, pid, { invanare = false } = {}) {
  const rader = db.query(`SELECT * FROM ${TABELL[typ]} WHERE patient_id = ? ORDER BY id`).all(pid);
  return typ === 'Encounter' && !invanare ? [...db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? ORDER BY id').all(pid), ...rader] : rader;
}
const GEMENSAM = new Set(['MedicationRequest', 'AllergyIntolerance', 'Flag', 'MedicationAdministration', 'List']);
// En administrering prövas också mot ordinationens vårdenhet, så att en dos av en spärrad enhets ordination inte syns.
const ORDINATIONSENHET = { MedicationAdministration: (db, r) => (r.ordination_id ? db.query('SELECT enhet_id FROM ordinationer WHERE id = ?').get(r.ordination_id)?.enhet_id : null) };
// Rader som inte är resurser: ett avfärdat förslag är ingen uppmärksamhetsinformation, och en överkänslighet lämnas ut
// som AllergyIntolerance (raden i uppmarksamhet bär bara dess bekräftade grad).
const RADFILTER = { Flag: (r) => r.status !== 'avfard' && r.kategori !== 'overkanslighet', MedicationAdministration: (r) => r.status !== 'iordningstalld' };
const finnsSomResurs = (typ, r) => !RADFILTER[typ] || RADFILTER[typ](r);

export function utfall(status, kod, text) {
  const code = { 401: 'login', 403: 'forbidden', 404: 'not-found' }[status] ?? 'invalid';
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics: text, details: { coding: [{ system: SYSTEM.felkod, code: kod }], text } }],
  };
}

const ref = (typ, id, display) => ({ reference: `${typ}/${id}`, ...(display ? { display } : {}) });
const kallaMeta = (kalla) => ({ tag: [{ system: SYSTEM.kalla, code: kalla }] });
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn;
const personNamn = (db, id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn;

// Patientens identiteter (Sussa 3.1.1) som Patient.identifier: personnummer och samordningsnummer med HL7 Swedens
// system, reservnummer och andra identiteter med sin OID. Den gällande har use official, tidigare identiteter old.
// Basprofilen tillåter högst ett personnummer och ett samordningsnummer, så en tidigare identitet med samma system som
// en annan visas inte här. Den går ändå att söka på.
function identifierare(db, p, dolj) {
  const rader = p.sammanslagen_till
    ? [{ typ: p.id_typ ?? 'personnummer', varde: p.personnummer, status: 'tidigare' }]
    : identiteterFor(db, p.id);
  if (!rader.length) rader.push({ typ: p.id_typ ?? 'personnummer', varde: p.personnummer, status: 'gallande' });
  const sett = new Set();
  const ut = [];
  for (const r of rader) {
    const system = r.typ === 'oid' ? `urn:oid:${delaOid(r.varde).rot}` : ID_SYSTEM[r.typ];
    if (sett.has(system)) continue;
    sett.add(system);
    const varde = r.typ === 'oid' ? delaOid(r.varde).nummer : r.varde;
    const value = !dolj ? varde : r.typ === 'oid' ? maskera('oid', r.varde) : `${varde.slice(0, r.typ === 'reservnummer' ? 10 : 8)}****`;
    ut.push({ use: r.status === 'gallande' ? 'official' : r.status === 'tidigare' ? 'old' : 'secondary', system, value });
  }
  return ut;
}

export function patient(db, p, visad = false) {
  const dolj = p.skyddad && !visad;
  const r = {
    resourceType: 'Patient', id: p.id, meta: { profile: [PROFIL.Patient] },
    identifier: identifierare(db, p, dolj),
    name: dolj ? [{ text: visningsnamn(p) }] : [{ text: `${p.fornamn} ${p.efternamn}`, family: p.efternamn, given: [p.fornamn] }],
    gender: p.kon === 'man' ? 'male' : 'female', birthDate: p.fodd,
  };
  // Sekretessmarkering enligt HL7 Swedens SecurityLabel, och R (restricted) för mottagare som bara känner HL7:s kodverk.
  if (p.skyddad) r.meta.security = [{ system: SYSTEM.sesakerhet, code: 'sekretessmarkering', display: 'Sekretessmarkering' }, { system: SYSTEM.confidentiality, code: 'R', display: 'restricted' }];
  if (!p.skyddad && p.adress) r.address = [{ line: [p.adress], postalCode: p.postnr, city: p.ort, country: 'SE' }];
  if (!p.skyddad && p.telefon) r.telecom = [{ system: 'phone', value: p.telefon }];
  const l = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(p.id);
  if (l) r.generalPractitioner = [ref('Organization', l.enhet_id, enhetsnamn(db, l.enhet_id))];
  // Sammanslagna journaler: den gamla är inaktiv och ersatt av den gällande, som ersätter den gamla.
  if (p.sammanslagen_till) {
    r.active = false;
    r.link = [{ other: ref('Patient', p.sammanslagen_till), type: 'replaced-by' }];
  } else {
    const gamla = allaPatientIdn(db, p.id).slice(1);
    if (gamla.length) r.link = gamla.map(id => ({ other: ref('Patient', id), type: 'replaces' }));
  }
  return r;
}

const KONTAKTSATT = { besok: 'Besök', telefon: 'Telefon', video: 'Video', hembesok: 'Hembesök' };
export function encounter(db, v, synliga) {
  if ('inskriven' in v) return vardtillfalleEncounter(db, v, synliga);
  const klass = v.kontaktsatt === 'telefon' || v.kontaktsatt === 'video' ? ['VR', 'virtual'] : v.kontaktsatt === 'hembesok' ? ['HH', 'home health']
    : { akut: ['EMER', 'emergency'], slutenvard: ['IMP', 'inpatient encounter'], oppenvard: ['AMB', 'ambulatory'] }[v.typ] ?? ['AMB', 'ambulatory'];
  const planerad = !v.slut && !v.ankomst && Date.parse(v.start) > Date.now();
  return {
    resourceType: 'Encounter', id: String(v.id), meta: kallaMeta(v.kalla), status: v.slut ? 'finished' : planerad ? 'planned' : 'in-progress',
    class: { system: SYSTEM.actcode, code: klass[0], display: klass[1] },
    ...(v.kontaktsatt ? { type: [{ text: KONTAKTSATT[v.kontaktsatt] ?? v.kontaktsatt }] } : {}),
    subject: ref('Patient', v.patient_id),
    ...(v.halsoarende_id ? { episodeOfCare: [ref('EpisodeOfCare', v.halsoarende_id)] } : {}),
    period: { start: v.ankomst ?? v.start, ...(v.slut ? { end: v.slut } : {}) }, reasonCode: v.orsak ? [{ text: v.orsak }] : undefined,
    serviceProvider: ref('Organization', v.enhet_id, enhetsnamn(db, v.enhet_id)),
    location: v.plats ? [{ location: { display: v.plats } }] : undefined,
    ...(v.vardtillfalle_id ? { partOf: ref('Encounter', `vt-${v.vardtillfalle_id}`) } : {}),
  };
}

// Vårdtillfället i slutenvård: från inskrivning till utskrivning, med varje plats patienten har legat på (avdelning,
// sal och säng) som location med period, och vårdenheten med det medicinska ansvaret som serviceProvider. synliga är
// de vistelser som användaren får se (vardkontakt.synligaVistelser): bara platser på deras vårdenheter tas med.
export function vardtillfalleEncounter(db, vt, synliga = null) {
  const h = db.query("SELECT * FROM vardtillfalle_handelser WHERE vardtillfalle_id = ? AND typ IN ('inskrivning', 'sangbyte', 'flytt') ORDER BY tid, id").all(vt.id);
  const vardenheter = synliga ? new Set(synliga.map(v => vardenhetFor(db, v.enhet_id))) : null;
  const location = h.map((x, i) => {
    const slut = h[i + 1]?.tid ?? vt.utskriven;
    return { enhet: x.enhet_id, location: { location: { display: x.plats ?? enhetsnamn(db, x.enhet_id) }, status: slut ? 'completed' : 'active', period: { start: x.tid, ...(slut ? { end: slut } : {}) } } };
  }).filter(x => !vardenheter || vardenheter.has(vardenhetFor(db, x.enhet))).map(x => x.location);
  return {
    resourceType: 'Encounter', id: `vt-${vt.id}`, meta: kallaMeta(vt.kalla), status: vt.utskriven ? 'finished' : 'in-progress',
    class: { system: SYSTEM.actcode, code: 'IMP', display: 'inpatient encounter' }, type: [{ text: 'Vårdtillfälle' }],
    subject: ref('Patient', vt.patient_id), period: { start: vt.inskriven, ...(vt.utskriven ? { end: vt.utskriven } : {}) },
    reasonCode: vt.orsak ? [{ text: vt.orsak }] : undefined,
    serviceProvider: ref('Organization', vt.enhet_id, enhetsnamn(db, vt.enhet_id)),
    ...(location.length ? { location } : {}),
  };
}

// Hälsoärendet: vårdkontakter som hör ihop över tid. Vårdkontakterna pekar på det med Encounter.episodeOfCare.
// forsta är starten på den första vårdkontakt i ärendet som användaren får se.
export function episodeOfCare(db, h, forsta = db.query('SELECT min(start) AS s FROM vardkontakter WHERE halsoarende_id = ?').get(h.id)?.s) {
  return {
    resourceType: 'EpisodeOfCare', id: String(h.id), meta: kallaMeta(h.kalla ?? 'vardkallan'), status: h.status === 'avslutat' ? 'finished' : 'active',
    type: [{ text: `Hälsoärende: ${h.rubrik}` }], patient: ref('Patient', h.patient_id),
    managingOrganization: ref('Organization', h.enhet_id, enhetsnamn(db, h.enhet_id)), period: { start: forsta && forsta < h.skapad ? forsta : h.skapad },
  };
}

export function condition(db, d) {
  return {
    resourceType: 'Condition', id: String(d.id), meta: kallaMeta(d.kalla),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }], text: d.typ === 'huvud' ? 'Huvuddiagnos' : 'Bidiagnos' }],
    code: { coding: [{ system: SYSTEM.icd10se, code: d.kod, display: ICD10SE[d.kod] ?? d.text }], text: d.text },
    subject: ref('Patient', d.patient_id), encounter: d.vardkontakt_id ? ref('Encounter', d.vardkontakt_id) : undefined,
    recordedDate: d.datum,
  };
}

export function observation(db, m) {
  const def = MATTYPER[m.typ] ?? { namn: m.typ };
  const kod = MATKOD[m.typ];
  const r = {
    resourceType: 'Observation', id: String(m.id), meta: { ...kallaMeta(m.kalla), ...(kod?.profil ? { profile: [`${VITALPROFIL}/${kod.profil}`] } : {}) }, status: 'final',
    ...(kod ? { category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: kod.kategori }] }] } : {}),
    code: { ...(kod?.coding.length ? { coding: kod.coding.map(c => ({ ...c })) } : {}), text: def.namn },
    subject: ref('Patient', m.patient_id), ...(m.vardkontakt_id ? { encounter: ref('Encounter', m.vardkontakt_id) } : {}),
    effectiveDateTime: m.tid, performer: [ref('Organization', m.enhet_id, enhetsnamn(db, m.enhet_id))],
  };
  const mangd = (value) => ({ value, unit: m.matt_enhet, ...(kod ? { system: SYSTEM.ucum, code: kod.ucum } : {}) });
  if (m.typ === 'blodtryck') {
    const [sys, dia] = m.varde.split('/').map(Number);
    r.component = kod.komponenter.map((k, i) => ({ code: { coding: [{ system: SYSTEM.loinc, ...k }], text: i ? 'Diastoliskt blodtryck' : 'Systoliskt blodtryck' }, valueQuantity: mangd(i ? dia : sys) }));
  } else r.valueQuantity = mangd(m.varde_num ?? Number(m.varde));
  return r;
}

export function medicationRequest(db, o) {
  const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(o.lakemedel_id);
  const status = o.status === 'utsatt' ? 'stopped' : o.slut && o.slut < idag() ? 'completed' : 'active';
  const plan = o.status === 'utsatt' ? utsattningsplan(db, o.id) : null;
  return {
    resourceType: 'MedicationRequest', id: String(o.id), meta: kallaMeta(o.kalla), status, intent: 'order',
    medicationCodeableConcept: { coding: [{ system: SYSTEM.atc, code: lm.atc, ...(ATC[lm.atc] ? { display: ATC[lm.atc] } : {}) }, ...(lm.npl ? [{ system: SYSTEM.nplid, code: lm.npl }] : [])], text: `${lm.namn} ${lm.styrka} ${lm.form}` },
    subject: ref('Patient', o.patient_id), ...(o.vardkontakt_id ? { encounter: ref('Encounter', o.vardkontakt_id) } : {}),
    authoredOn: o.skapad, requester: ref('Practitioner', o.ordinerad_av, personNamn(db, o.ordinerad_av)),
    reasonCode: [{ text: o.orsak }],
    dosageInstruction: [{ text: o.dosering, asNeededBoolean: Boolean(o.vid_behov), ...(tillaggUt(db, o.id).administrationssattText ? { route: { text: tillaggUt(db, o.id).administrationssattText } } : {}) }],
    dispenseRequest: { validityPeriod: { start: o.start, ...(o.slut ? { end: o.slut } : {}) } },
    extension: [
      { url: `${EXT}/uppfoljningsdatum`, valueDate: o.uppfoljning },
      { url: `${EXT}/nll-status`, valueCode: o.nll_status },
      ...(o.status === 'utsatt' ? [{ url: `${EXT}/utsattningsorsak`, valueString: o.utsatt_orsak }] : []),
      // Planen vid utsättning av antikoagulantia (runda 5).
      ...(plan ? [{ url: `${EXT}/utsattningsplan`, valueCode: plan.typ }] : []),
      ...(plan?.aterinsattning ? [{ url: `${EXT}/aterinsattningsdatum`, valueDate: plan.aterinsattning }] : []),
    ],
    ...(plan ? { note: [{ text: `Plan vid utsättning: ${plan.text}.` }] } : {}),
  };
}

// Administrering, överlämnande och dos som inte gavs (administrering.js). En iordningsställd dos är ännu ingen resurs.
export function medicationAdministration(db, a) {
  const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(a.lakemedel_id);
  // Delegeringen som en undersköterska gav dosen med (runda 5).
  const deleg = delegeringKort(db, a.delegering_id);
  const note = [
    a.status === 'overlamnad' && { text: `Överlämnad till patienten${a.permission ? ' för permission' : ''}.` },
    a.efterhand && { text: `Registrerad i efterhand ${a.registrerad} av ${personNamn(db, a.registrerad_av)}.` },
    !a.efterhand && a.registrerad_av && a.utford_av && a.registrerad_av !== a.utford_av && { text: `Registrerad av ${personNamn(db, a.registrerad_av)}.` },
    ...(a.kvitterade_varningar ? JSON.parse(a.kvitterade_varningar).map(k => ({ text: `Varning kvitterad (${k.regel}): ${k.motivering}` })) : []),
    deleg && { text: `Given med delegering enligt ${deleg.foreskrift}, utfärdad av ${deleg.utfardadAv}, giltig ${deleg.fran} till ${deleg.till}. Omfattar: ${deleg.omfattningText}.` },
  ].filter(Boolean);
  return {
    resourceType: 'MedicationAdministration', id: String(a.id), meta: kallaMeta(a.kalla), status: a.status === 'ej_given' ? 'not-done' : 'completed',
    ...(a.status === 'ej_given' ? { statusReason: [{ text: a.orsak }] } : {}),
    medicationCodeableConcept: { coding: [{ system: SYSTEM.atc, code: lm.atc, ...(ATC[lm.atc] ? { display: ATC[lm.atc] } : {}) }, ...(lm.npl ? [{ system: SYSTEM.nplid, code: lm.npl }] : [])], text: `${lm.namn} ${lm.styrka} ${lm.form}` },
    subject: ref('Patient', a.patient_id), ...(a.vardkontakt_id ? { context: ref('Encounter', a.vardkontakt_id) } : {}),
    effectiveDateTime: a.tid, performer: [
      { ...(deleg ? { function: { text: `Gav dosen med delegering från ${deleg.utfardadAv}` } } : {}), actor: ref('Practitioner', a.utford_av, personNamn(db, a.utford_av)) },
      // Den som registrerade dosen, när det är någon annan än den som gav den.
      ...(a.registrerad_av && a.utford_av && a.registrerad_av !== a.utford_av ? [{ function: { text: 'Registrerade dosen' }, actor: ref('Practitioner', a.registrerad_av, personNamn(db, a.registrerad_av)) }] : []),
    ],
    ...(a.ordination_id ? { request: ref('MedicationRequest', a.ordination_id) } : {}),
    ...(note.length ? { note } : {}),
    ...(a.dos != null && a.status !== 'ej_given' ? { dosage: { dose: { value: a.dos, ...(a.dos_enhet ? { unit: a.dos_enhet } : {}) } } } : {}),
  };
}

// Vidimeringen av de samlade pågående ordinationerna (vidimering.js) som en ögonblicksbild av läkemedelslistan. Den
// senaste är current, tidigare är retired. Ordinationer från enheter som patienten har spärrat tas aldrig med.
export function list(db, v) {
  const senaste = db.query('SELECT id FROM vidimeringar WHERE patient_id = ? ORDER BY tid DESC, id DESC').get(v.patient_id)?.id;
  const sparrade = aktivaSparrar(db, v.patient_id);
  const ids = JSON.parse(v.ordinationer).map(x => x.id)
    .filter(id => { const o = db.query('SELECT enhet_id FROM ordinationer WHERE id = ?').get(id); return o && !sparrade.includes(vardenhetFor(db, o.enhet_id)); });
  return {
    resourceType: 'List', id: String(v.id), meta: kallaMeta(v.kalla), status: v.id === senaste ? 'current' : 'retired', mode: 'snapshot',
    title: 'Vidimerade pågående ordinationer',
    code: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-example-use-codes', code: 'medications', display: 'Medication List' }], text: 'Vidimering av pågående ordinationer' },
    subject: ref('Patient', v.patient_id), date: v.tid, source: ref('Practitioner', v.av, personNamn(db, v.av)),
    ...(ids.length ? { entry: ids.map(id => ({ item: ref('MedicationRequest', id) })) } : { emptyReason: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'nilknown', display: 'Nil Known' }] } }),
  };
}

export function allergyIntolerance(db, o) {
  return {
    resourceType: 'AllergyIntolerance', id: String(o.id), meta: kallaMeta(o.kalla),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
    type: 'allergy', category: [o.atc ? 'medication' : 'food'], criticality: o.allvarlighet === 'allvarlig' ? 'high' : 'low',
    code: { ...(o.atc ? { coding: [{ system: SYSTEM.atc, code: o.atc, ...(ATC[o.atc] ? { display: ATC[o.atc] } : {}) }] } : {}), text: o.amne },
    patient: ref('Patient', o.patient_id), recordedDate: o.datum,
    reaction: o.reaktion ? [{ manifestation: [{ text: o.reaktion }] }] : undefined,
  };
}

// Uppmärksamhetsinformation (Sussa 3.1.5) utom överkänslighet: huvudgrupp och undergrupp enligt Socialstyrelsens tabell
// i Vårdkällans kodsystem, koden ur ICD-10-SE eller ATC när uppgiften kommer från en diagnos eller ett läkemedel.
const FLAGGKATEGORI = { medicinskt: 'Medicinska tillstånd och behandlingar', smitta: 'Smitta', vardrutin: 'Särskild vårdrutin' };
export function flag(db, r) {
  const ve = vardenhetFor(db, r.enhet_id);
  const display = (r.kodsystem === 'icd10se' ? ICD10SE : ATC)[r.kod];
  const kod = r.kod && r.kodsystem ? { system: SYSTEM[r.kodsystem], code: r.kod, ...(display ? { display } : {}) } : null;
  return {
    resourceType: 'Flag', id: String(r.id), meta: kallaMeta(r.kalla), status: r.status === 'aktiv' ? 'active' : 'inactive',
    category: [
      { coding: [{ system: SYSTEM.uppmarksamhet, code: r.kategori, display: FLAGGKATEGORI[r.kategori] }], text: FLAGGKATEGORI[r.kategori] },
      { coding: [{ system: SYSTEM.uppmarksamhet, code: `${r.kategori}.${r.undergrupp}` }] },
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/flag-category', code: 'clinical', display: 'Clinical' }] },
    ],
    code: { ...(kod ? { coding: [kod] } : {}), text: r.term },
    subject: ref('Patient', r.patient_id), period: { start: r.registrerad, ...(r.avslutad ? { end: r.avslutad } : {}) },
    author: ref('Organization', ve, enhetsnamn(db, ve)),
  };
}

export function serviceRequest(db, r, klinisk = true) {
  const status = r.status === 'svar_kvitterat' ? 'completed' : r.beslut === 'avvisad' ? 'revoked' : 'active';
  const ut = {
    resourceType: 'ServiceRequest', id: String(r.id), meta: kallaMeta(r.kalla), status, intent: 'order',
    priority: { akut: 'stat', skyndsam: 'urgent', normal: 'routine' }[r.prioritet] ?? 'routine',
    subject: ref('Patient', r.patient_id), ...(r.vardkontakt_id ? { encounter: ref('Encounter', r.vardkontakt_id) } : {}), authoredOn: r.skickad_tid,
    requester: ref('Practitioner', r.avsandare_id, personNamn(db, r.avsandare_id)),
    performer: [ref('Organization', r.till_enhet_id, enhetsnamn(db, r.till_enhet_id))],
    extension: [{ url: `${EXT}/remisstatus`, valueCode: r.status }, { url: `${EXT}/svar-senast`, valueDate: r.svar_senast }],
  };
  if (klinisk) {
    ut.reasonCode = [{ text: r.fragestallning }];
    const note = [r.anamnes && { text: r.anamnes }, r.motivering && { text: `Motivering: ${r.motivering}` }, r.svar && { text: `Svar: ${r.svar}` }].filter(Boolean);
    if (note.length) ut.note = note;
  }
  return ut;
}

// Kontrasignering (Sussa 3.1.11.3, kontrasignering.js): den som kontrasignerade är attester med mode professional.
function kontrasignerad(db, a) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE name = 'kontrasigneringar'").get()) return {};
  const ks = db.query("SELECT mottagare_id, kontrasignerad FROM kontrasigneringar WHERE typ = 'anteckning' AND post_id = ? AND status = 'kontrasignerad' ORDER BY id").all(a.id);
  return ks.length ? { attester: ks.map(k => ({ mode: 'professional', time: k.kontrasignerad, party: ref('Practitioner', k.mottagare_id, personNamn(db, k.mottagare_id)) })) } : {};
}

export function composition(db, a) {
  const ersatt = db.query('SELECT id FROM anteckningar WHERE ersatter_id = ?').get(a.id);
  const sokord = JSON.parse(a.sokord);
  const relatesTo = [
    ...(a.ersatter_id ? [{ code: 'replaces', targetReference: ref('Composition', a.ersatter_id) }] : []),
    ...(ersatt ? [{ code: 'transforms', targetReference: ref('Composition', ersatt.id) }] : []),
  ];
  return {
    resourceType: 'Composition', id: String(a.id), meta: kallaMeta(a.kalla),
    status: a.status === 'utkast' ? 'preliminary' : a.ersatter_id ? 'amended' : 'final',
    type: { text: a.typ }, subject: ref('Patient', a.patient_id), encounter: a.vardkontakt_id ? ref('Encounter', a.vardkontakt_id) : undefined,
    date: a.signerad_tid ?? a.skapad, author: [ref('Practitioner', a.forfattare_id, personNamn(db, a.forfattare_id))], title: a.typ,
    custodian: ref('Organization', a.enhet_id, enhetsnamn(db, a.enhet_id)),
    ...(relatesTo.length ? { relatesTo } : {}),
    ...kontrasignerad(db, a),
    ...(sokord.length ? { section: sokord.map(s => ({ title: s.sokord, text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${escape(s.text)}</div>` } })) } : {}),
  };
}

export function organization(db, e) {
  return {
    resourceType: 'Organization', id: e.id, meta: { profile: [PROFIL.Organization] }, identifier: [hsaIdentifier(e.hsa_id)], active: true, name: e.namn,
    ...(e.kortnamn ? { alias: [e.kortnamn] } : {}), ...(e.forald_id ? { partOf: ref('Organization', e.forald_id) } : {}),
  };
}

export function practitioner(db, p) {
  return {
    resourceType: 'Practitioner', id: p.id, meta: { profile: [PROFIL.Practitioner] }, identifier: [hsaIdentifier(p.hsa_id)], active: Boolean(p.aktiv),
    name: [{ text: p.namn, family: p.namn.split(' ').slice(-1)[0], given: p.namn.split(' ').slice(0, -1) }],
    qualification: [{ code: { text: p.titel } }],
  };
}

// En rad från Min journal har invånaren som agent: patienten själv, eller en vårdnadshavare utan namn.
const auditAgent = (r) => {
  if (r.personal) return ref('Practitioner', r.personal.id, r.personal.namn);
  if (r.invanare?.relation === 'egen') return ref('Patient', r.patientId);
  if (r.invanare) return { display: r.invanare.relation === 'vardnadshavare' ? 'Vårdnadshavare i Min journal' : 'Invånare i Min journal' };
  return undefined;
};

export function auditEvent(r) {
  return {
    resourceType: 'AuditEvent', id: String(r.id),
    type: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: '110110', display: 'Patient Record' },
    action: r.handling.startsWith('skriv') || r.handling === 'ordinera' ? 'C' : 'R', recorded: r.tid,
    outcome: r.resultat === 'nekad' ? '4' : '0',
    purposeOfEvent: [{ coding: [{ system: SYSTEM.atkomstgrund, code: r.grund }], text: r.syfte ?? undefined }],
    agent: [{ who: auditAgent(r), requestor: true }],
    source: { observer: { display: 'Vårdkällan' } },
    entity: r.patientId ? [{ what: ref('Patient', r.patientId), description: r.resurs ?? undefined }] : undefined,
    extension: [{ url: `${EXT}/hash`, valueString: r.hash }],
  };
}

export function capability(base) {
  return {
    resourceType: 'CapabilityStatement', status: 'active', date: idag(), kind: 'instance', fhirVersion: '4.0.1', format: ['application/fhir+json'],
    software: { name: 'Vårdkällan', version: '0.1.0' }, implementation: { description: 'Vårdkällan, öppen demo med påhittade patienter', url: `${base}/fhir` },
    rest: [{
      mode: 'server',
      security: { description: 'Sessionskaka vk_sid. Samma behörighetskontroll och åtkomstloggning som gränssnittet. Med en session från Min journal når invånaren bara sina egna resurser, eller ett barns under 13 år, och Patient/[id]/$everything.' },
      resource: [...TYPER.map(t => ({
        type: t, ...(PROFIL[t] ? { supportedProfile: [PROFIL[t]] } : {}), interaction: [{ code: 'read' }, { code: 'search-type' }],
        ...(t === 'Patient' ? { operation: [{ name: 'everything', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything' }] } : {}),
        searchParam: t === 'Patient' ? [{ name: '_id', type: 'token' }, { name: 'identifier', type: 'token' }]
          : ['Organization', 'Practitioner'].includes(t) ? [{ name: '_id', type: 'token' }] : [{ name: 'patient', type: 'reference' }],
      })), ...tidbokFhir.capabilityResurser(), ...DEFINITIONSTYPER.map(t => ({
        type: t, interaction: [{ code: 'read' }, { code: 'search-type' }], searchParam: [{ name: 'url', type: 'uri' }, { name: '_id', type: 'token' }],
      }))],
    }],
  };
}

function bundle(base, url, resurser) {
  return {
    resourceType: 'Bundle', type: 'searchset', total: resurser.length,
    link: [{ relation: 'self', url: `${base}${url.pathname}${url.search}` }],
    // En tom sökning har ingen entry, eftersom FHIR inte tillåter tomma listor.
    ...(resurser.length ? { entry: resurser.map(r => ({ fullUrl: `${base}/fhir/${r.resourceType}/${r.id}`, resource: r, search: { mode: 'match' } })) } : {}),
  };
}

const MAPPA = { Encounter: encounter, EpisodeOfCare: episodeOfCare, Condition: condition, Observation: observation, MedicationRequest: medicationRequest, AllergyIntolerance: allergyIntolerance, Flag: flag, ServiceRequest: serviceRequest, Composition: composition, MedicationAdministration: medicationAdministration, List: list };

function handlingFor(typ, rad, personal) {
  if (typ === 'Composition') return lasHandling(rad?.kategori ?? 'lakare');
  if (typ === 'ServiceRequest' && !kanRoll(personal, 'las_remiss')) return 'las_remiss_status';
  return HANDLING[typ];
}

// Huvudingång. ctx: { db, personal, valFor(patientId), url, base }. Returnerar { status, body }.
export function hantera(ctx) {
  const { db, personal, url, base } = ctx;
  const delar = url.pathname.replace(/\/+$/, '').split('/').slice(2).map(decodeURIComponent);
  const [typ, id] = delar;
  if (typ === 'metadata' && delar.length === 1) return { status: 200, body: capability(base) };
  if (DEFINITIONSTYPER.includes(typ) && delar.length <= 2) {
    const alla = DEFINITIONER[typ];
    if (id) {
      const d = alla.find(x => x.id === id);
      if (!d) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      return { status: 200, body: d };
    }
    const sokt = url.searchParams.get('url') ?? url.searchParams.get('_id');
    return { status: 200, body: bundle(base, url, alla.filter(d => !sokt || d.url === sokt || d.id === sokt)) };
  }
  if (tidbokFhir.TIDBOK_TYPER.includes(typ)) return tidbokFhir.hantera(ctx, delar, (resurser) => bundle(base, url, resurser));
  if (!personal && ctx.invanare) return hanteraInvanare(ctx, delar);
  if (!TYPER.includes(typ) || delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');

  if (typ === 'Organization' || typ === 'Practitioner') {
    const tabell = typ === 'Organization' ? 'enheter' : 'personal';
    const mappa = typ === 'Organization' ? organization : practitioner;
    if (id) {
      const rad = db.query(`SELECT * FROM ${tabell} WHERE id = ?`).get(id);
      if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      return { status: 200, body: mappa(db, rad) };
    }
    const _id = url.searchParams.get('_id');
    const rader = _id ? db.query(`SELECT * FROM ${tabell} WHERE id = ?`).all(_id) : db.query(`SELECT * FROM ${tabell} ORDER BY id`).all();
    return { status: 200, body: bundle(base, url, rader.map(r => mappa(db, r))) };
  }

  if (typ === 'AuditEvent') {
    const atk = new Atkomst(db, personal, url.searchParams.get('patient') || null, {}, 'las_logg');
    atk.krav('las_logg');
    if (id) {
      const r = logg.lista(db, { max: 100000 }).find(x => String(x.id) === id);
      if (!r) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      atk.patientId = r.patientId;
      atk.logga('las_logg', 'logggranskning', `fhir/AuditEvent/${id}`);
      return { status: 200, body: auditEvent(r) };
    }
    const rader = logg.lista(db, { patientId: atk.patientId, max: 1000 });
    atk.logga('las_logg', 'logggranskning', `fhir/AuditEvent${url.search}`);
    return { status: 200, body: bundle(base, url, rader.map(auditEvent)) };
  }

  if (typ === 'Patient') {
    let kandidater;
    if (id) {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(id);
      if (!p) throw new Fel(404, 'Patienten finns inte.', 'saknas');
      kandidater = [p];
    } else {
      const _id = url.searchParams.get('_id') ?? url.searchParams.get('patient');
      const ident = url.searchParams.get('identifier');
      if (_id) kandidater = db.query('SELECT * FROM patienter WHERE id = ?').all(_id);
      else if (ident) {
        // Alla identiteter, också tidigare: sökningen ger den gällande journalen (Sussa 3.1.1).
        const pid = hittaPaToken(db, ident);
        kandidater = pid ? db.query('SELECT * FROM patienter WHERE id = ?').all(pid) : [];
      } else throw new Fel(400, 'Ange _id eller identifier.', 'ogiltig');
    }
    const ut = [];
    for (const p of kandidater) {
      const handling = kanRoll(personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
      // En sammanslagen journal prövas och loggas på den gällande journalen, där uppgifterna finns.
      const pid = gallandeId(db, p.id);
      const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), handling);
      if (id) atk.krav(handling, { beskrivning: `fhir/Patient/${id}` });
      else if (!atk.prova(handling).tillaten) continue;
      else atk.krav(handling);
      atk.logga(handling, atk.grund(), `fhir/Patient${id ? '/' + id : url.search}`);
      ut.push(patient(db, p, Boolean(ctx.valFor(pid).visa_identitet)));
    }
    return { status: 200, body: id ? ut[0] : bundle(base, url, ut) };
  }

  // Patientens resurser.
  const mappa = MAPPA[typ];
  if (id) {
    const rad = radMedId(db, typ, id);
    if (!rad || !finnsSomResurs(typ, rad)) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    if (typ === 'Composition' && rad.status !== 'signerad' && rad.forfattare_id !== personal.id) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const handling = handlingFor(typ, rad, personal);
    const atk = new Atkomst(db, personal, rad.patient_id, ctx.valFor(rad.patient_id), handling);
    if (vardtillfalle(typ, rad)) {
      // Vårdtillfället prövas på de vistelser användaren får se, som i /api/vardtillfalle.
      const synliga = synligaVistelser(atk, rad);
      const prov = synliga[0] ?? db.query('SELECT enhet_id FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start DESC').get(rad.id) ?? rad;
      atk.krav(handling, { resurs: { enhet_id: prov.enhet_id }, beskrivning: `fhir/${typ}/${id}` });
      atk.logga(handling, atk.grund(), `fhir/${typ}/${id}`);
      return { status: 200, body: vardtillfalleEncounter(db, rad, synliga) };
    }
    const enhetId = typ === 'ServiceRequest' ? rad.fran_enhet_id : rad.enhet_id;
    const egenRemiss = typ === 'ServiceRequest' && [rad.fran_enhet_id, rad.till_enhet_id].includes(vardenhet(db, personal));
    atk.krav(handling, { resurs: egenRemiss ? null : { enhet_id: enhetId, gemensam: GEMENSAM.has(typ) }, beskrivning: `fhir/${typ}/${id}` });
    const ordEnhet = ORDINATIONSENHET[typ]?.(db, rad);
    if (ordEnhet) atk.krav(handling, { resurs: { enhet_id: ordEnhet, gemensam: true }, beskrivning: `fhir/${typ}/${id}` });
    atk.logga(handling, atk.grund(), `fhir/${typ}/${id}`);
    return { status: 200, body: typ === 'ServiceRequest' ? serviceRequest(db, rad, kanRoll(personal, 'las_remiss')) : typ === 'EpisodeOfCare' ? episodeOfCare(db, rad, forstaSynliga(atk, rad)) : mappa(db, rad) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const handling = handlingFor(typ, null, personal);
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), handling);
  if (typ === 'Composition') {
    atk.krav(kanRoll(personal, 'las_journal') ? 'las_journal' : 'las_omvardnad', { beskrivning: `fhir/${typ}${url.search}` });
  } else atk.krav(handling, { beskrivning: `fhir/${typ}${url.search}` });
  let rader = patientRader(db, typ, pid).filter(r => finnsSomResurs(typ, r));
  if (typ === 'Composition') {
    rader = rader.filter(a => a.status === 'signerad' || a.forfattare_id === personal.id);
    rader = atk.filtrera(rader, a => lasHandling(a.kategori));
  } else if (typ === 'ServiceRequest') {
    const min = vardenhet(db, personal);
    const egna = rader.filter(r => r.fran_enhet_id === min || r.till_enhet_id === min);
    const andra = atk.filtrera(rader.filter(r => !egna.includes(r)).map(r => ({ ...r, enhet_id: r.fran_enhet_id })), handling);
    rader = [...egna, ...andra];
  } else if (typ === 'Encounter') {
    // Vårdtillfällena tas med när användaren får se någon av vistelserna, med bara de platserna.
    const vt = new Map(rader.filter(r => vardtillfalle(typ, r)).map(r => [r.id, synligaVistelser(atk, r)]));
    rader = [...rader.filter(r => vardtillfalle(typ, r) && vt.get(r.id).length), ...atk.filtrera(rader.filter(r => !vardtillfalle(typ, r)), handling)];
    for (const [, synliga] of vt) for (const v of synliga.slice(0, 1)) atk.krav(handling, { resurs: { enhet_id: v.enhet_id } });
    atk.logga(handling, atk.grund(), `fhir/${typ}${url.search}`);
    return { status: 200, body: bundle(base, url, rader.map(r => (vardtillfalle(typ, r) ? vardtillfalleEncounter(db, r, vt.get(r.id)) : encounter(db, r)))) };
  } else rader = atk.filtrera(rader, handling, { gemensam: GEMENSAM.has(typ) });
  if (ORDINATIONSENHET[typ]) rader = rader.filter(r => { const e = ORDINATIONSENHET[typ](db, r); return !e || atk.filtrera([{ enhet_id: e }], handling, { gemensam: true }).length; });
  atk.logga(handling, atk.grund(), `fhir/${typ}${url.search}`);
  const resurser = rader.map(r => (typ === 'ServiceRequest' ? serviceRequest(db, r, kanRoll(personal, 'las_remiss')) : typ === 'EpisodeOfCare' ? episodeOfCare(db, r, forstaSynliga(atk, r)) : mappa(db, r)));
  return { status: 200, body: bundle(base, url, resurser) };
}

const vardenhet = (db, personal) => vardenhetFor(db, personal.enhet_id);
const vardtillfalle = (typ, rad) => typ === 'Encounter' && 'inskriven' in rad;
// Starten på den första vårdkontakten i hälsoärendet som användaren får se, för EpisodeOfCare.period.
function forstaSynliga(atk, h) {
  const rader = atk.db.query('SELECT enhet_id, start FROM vardkontakter WHERE halsoarende_id = ? ORDER BY start').all(h.id);
  return rader.find(v => atk.prova('las_admin', { enhet_id: v.enhet_id }).tillaten)?.start ?? null;
}

// Invånarens FHIR-API (Min journal). Samma prövning, samma visningsregler och samma loggning som Min journal i /api:
// bara journaler som invånaren får läsa, bara anteckningar vars hela versionskedja är signerad och vars senaste version
// visas, och bara provsvar som får visas. En resurs i en annan journal svarar som en som inte finns. Practitioner och
// AuditEvent är personalens.
const INV_RAD = {
  Composition: (db, a) => synligKedja(db, a).synlig,
  Observation: (db, m) => provsvarVisas(m),
  Flag: (db, r) => r.status === 'aktiv' && r.kategori !== 'overkanslighet',
};
const synligFor = (db, typ, rad) => (Object.hasOwn(INV_RAD, typ) ? INV_RAD[typ](db, rad) : true);

// Invånarens resurser lämnar inte ut mer än Min journal: utan personalens id (en referens till Practitioner får bara
// namnet, som är en del av journalen), utan kontaktuppgifter och listning, utan remissens anamnes och remitterande
// läkare, och utan NLL-status och katalogens id för läkemedlet.
const utanPersonalId = (r) => (r?.reference?.startsWith('Practitioner/') ? { display: r.display ?? 'Vårdpersonal' } : r);
export function patientForInvanare(db, p) {
  const r = patient(db, p, true);
  delete r.address;
  delete r.telecom;
  delete r.generalPractitioner;
  return r;
}
export const MAPPA_INVANARE = {
  Encounter: (db, v) => {
    const r = encounter(db, v);
    delete r.partOf;
    delete r.episodeOfCare;
    return r;
  },
  Condition: condition,
  Observation: observation,
  AllergyIntolerance: allergyIntolerance,
  Flag: flag,
  MedicationRequest: (db, o) => {
    const r = medicationRequest(db, o);
    r.medicationCodeableConcept.coding = r.medicationCodeableConcept.coding.filter(c => c.system !== SYSTEM.npl);
    r.extension = r.extension.filter(e => e.url !== `${EXT}/nll-status`);
    r.requester = utanPersonalId(r.requester);
    return r;
  },
  ServiceRequest: (db, rr) => {
    const r = serviceRequest(db, rr, true);
    delete r.requester;
    const note = [rr.motivering && { text: `Motivering: ${rr.motivering}` }, rr.svar && { text: `Svar: ${rr.svar}` }].filter(Boolean);
    if (note.length) r.note = note; else delete r.note;
    return r;
  },
  Composition: (db, a) => {
    const r = composition(db, a);
    r.author = r.author.map(utanPersonalId);
    if (r.attester) r.attester = r.attester.map(x => ({ ...x, party: utanPersonalId(x.party) }));
    return r;
  },
};
const mappaInvanare = (db, typ, rad) => MAPPA_INVANARE[typ](db, rad);

// Resursen i loggen för invånarens anrop: sökvägen och bara de sökparametrar som används, korta. Annan text i adressen
// hamnar aldrig i loggen, varken i invånarens egen eller i en annan patients.
// Loggen får bara sökvägen och id:n i de format som Vårdkällans id har: resurstyp, löpnummer, patient-id och
// $everything. Fritext ur adressen, till exempel ett personnummer, kommer aldrig in i loggen: en parameter med annat
// innehåll loggas bara med sitt namn, och en del av sökvägen med annat innehåll som ogiltig.
const LOGGADE_PARAMETRAR = ['patient', 'subject', '_id', 'identifier'];
const PATIENT_ID = /^p\d{1,4}$/;
const LOPNUMMER = /^\d{1,9}$/;
const loggbarDel = (d, i) => (i === 0 ? TYPER.includes(d) : PATIENT_ID.test(d) || LOPNUMMER.test(d) || VT_ID.test(d) || d === '$everything');
function loggResurs(delar, url) {
  const q = LOGGADE_PARAMETRAR.filter(n => url.searchParams.has(n)).map((n) => {
    const v = String(url.searchParams.get(n)).replace(/^Patient\//, '');
    const ok = n === '_id' ? PATIENT_ID.test(v) || LOPNUMMER.test(v) : n !== 'identifier' && PATIENT_ID.test(v);
    return ok ? `${n}=${v}` : n;
  }).join('&');
  return `fhir/${delar.map((d, i) => (loggbarDel(d, i) ? d : 'ogiltig')).join('/')}${q ? `?${q}` : ''}`;
}

function hanteraInvanare(ctx, delar) {
  const { db, invanare, url, base } = ctx;
  const [typ, id, operation] = delar;
  // Bara kända resurstyper. Ett namn som hasOwnProperty eller constructor får aldrig bli en tabell eller en funktion.
  if (!TYPER.includes(typ)) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  const sokvag = loggResurs(delar, url);
  if (typ === 'Practitioner' || typ === 'AuditEvent') {
    throw new Fel(403, 'Personalens uppgifter och åtkomstloggen nås inte med en session från Min journal. Logglistan finns i Min journal.', 'nekad');
  }
  if (typ === 'Organization' && delar.length <= 2) {
    if (id) {
      const rad = db.query('SELECT * FROM enheter WHERE id = ?').get(id);
      if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      return { status: 200, body: organization(db, rad) };
    }
    const _id = url.searchParams.get('_id');
    const rader = _id ? db.query('SELECT * FROM enheter WHERE id = ?').all(_id) : db.query('SELECT * FROM enheter ORDER BY id').all();
    return { status: 200, body: bundle(base, url, rader.map(r => organization(db, r))) };
  }
  const egnaJournaler = () => journaler(db, invanare).filter(j => j.atkomst).map(j => j.patientId);
  const oppna = (pid) => { const atk = new InvanareAtkomst(db, invanare, pid, ctx.nekade ?? null); atk.krav(sokvag); return atk; };

  if (typ === 'Patient') {
    if (id && operation === '$everything' && delar.length === 3) {
      const atk = oppna(id);
      const resurser = [patientForInvanare(db, atk.patient)];
      for (const t of Object.keys(MAPPA_INVANARE)) {
        for (const r of patientRader(db, t, id, { invanare: true })) if (synligFor(db, t, r)) resurser.push(mappaInvanare(db, t, r));
      }
      atk.logga(sokvag);
      return { status: 200, body: bundle(base, url, resurser) };
    }
    if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
    if (id) {
      const atk = oppna(id);
      atk.logga(sokvag);
      return { status: 200, body: patientForInvanare(db, atk.patient) };
    }
    const _id = url.searchParams.get('_id') ?? url.searchParams.get('patient');
    const ident = url.searchParams.get('identifier');
    let kandidater;
    if (_id) kandidater = [_id];
    else if (ident) {
      const pid = hittaPaToken(db, ident);
      kandidater = pid ? [pid] : [];
    } else kandidater = egnaJournaler();
    // Precis som för personalen tas journaler som inte får läsas bort ur sökresultatet, utan att något lämnas ut.
    const tillatna = new Set(egnaJournaler());
    const ut = [];
    for (const pid of kandidater.filter(k => tillatna.has(k))) {
      const atk = oppna(pid);
      atk.logga(sokvag);
      ut.push(patientForInvanare(db, atk.patient));
    }
    return { status: 200, body: bundle(base, url, ut) };
  }

  if (!Object.hasOwn(MAPPA_INVANARE, typ) || delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  if (id) {
    const rad = radMedId(db, typ, id, { invanare: true });
    // En resurs som inte visas i Min journal finns inte för invånaren. En resurs i en journal som invånaren inte får
    // läsa prövas som journalen, så att försöket loggas där och svaret blir detsamma som för en journal som inte finns.
    const finnsInte = () => new Fel(404, 'Resursen finns inte.', 'saknas');
    if (!rad) {
      // Räknas som ett nekat försök, så att gränsen för försök inte avslöjar vilka id som finns.
      if (ctx.nekade) {
        if (ctx.nekade.antal >= MAX_NEKADE) throw new Fel(403, 'Du har gjort många försök att öppna journaler som du inte har tillgång till. Fler försök stoppas.', 'nekad');
        ctx.nekade.antal++;
      }
      throw finnsInte();
    }
    // Varje nekande blir samma 404 som för ett id som inte finns, så att svaret inte avslöjar vems resursen är.
    // Bara gränsen för nekade försök ger 403.
    const fore = ctx.nekade?.antal ?? 0;
    let atk;
    try { atk = oppna(rad.patient_id); } catch (e) {
      if (e.status === 403 && ctx.nekade && fore >= MAX_NEKADE) throw e;
      throw e.status === 403 || e.status === 404 ? finnsInte() : e;
    }
    if (!synligFor(db, typ, rad)) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    atk.logga(sokvag);
    return { status: 200, body: mappaInvanare(db, typ, rad) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  const atk = oppna(pid);
  const rader = patientRader(db, typ, pid, { invanare: true }).filter(r => synligFor(db, typ, r));
  atk.logga(sokvag);
  return { status: 200, body: bundle(base, url, rader.map(r => mappaInvanare(db, typ, r))) };
}
