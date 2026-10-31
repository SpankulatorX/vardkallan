// FHIR R4-API. Samma behörighetsmotor och samma loggning som /api (D9).
import { Fel, idag } from './db.js';
import { Atkomst, kanRoll, visningsnamn, vardenhetFor } from './atkomst.js';
import { MATTYPER, lasHandling } from './journal.js';
import * as logg from './logg.js';

export const SYSTEM = {
  personnummer: 'http://electronichealth.se/identifier/personnummer',
  icd10se: 'http://hl7.org/fhir/sid/icd-10-se',
  atc: 'http://www.whocc.no/atc',
  loinc: 'http://loinc.org',
  hsa: 'urn:oid:1.2.752.29.4.19',
  npl: 'https://vardkallan.404haven.se/fhir/NamingSystem/npl-demo',
  kalla: 'https://vardkallan.404haven.se/fhir/CodeSystem/kalla',
  felkod: 'https://vardkallan.404haven.se/fhir/CodeSystem/felkod',
  confidentiality: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
  actcode: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
};
const EXT = 'https://vardkallan.404haven.se/fhir/StructureDefinition';
export const TYPER = ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'ServiceRequest', 'Composition', 'Organization', 'Practitioner', 'AuditEvent'];

// Handling i behörighetsmotorn per resurstyp.
const HANDLING = {
  Encounter: 'las_admin', Condition: 'las_diagnoser', Observation: 'las_matvarden', MedicationRequest: 'las_lakemedel',
  AllergyIntolerance: 'las_oversikt', ServiceRequest: 'las_remiss', Composition: 'las_journal',
};
const TABELL = {
  Encounter: 'vardkontakter', Condition: 'diagnoser', Observation: 'matvarden', MedicationRequest: 'ordinationer',
  AllergyIntolerance: 'overkanslighet', ServiceRequest: 'remisser', Composition: 'anteckningar',
};
const GEMENSAM = new Set(['MedicationRequest', 'AllergyIntolerance']);

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

export function patient(db, p, visad = false) {
  const dolj = p.skyddad && !visad;
  const r = {
    resourceType: 'Patient', id: p.id,
    identifier: [{ system: SYSTEM.personnummer, value: dolj ? `${p.personnummer.slice(0, 8)}****` : p.personnummer }],
    name: dolj ? [{ text: visningsnamn(p) }] : [{ text: `${p.fornamn} ${p.efternamn}`, family: p.efternamn, given: [p.fornamn] }],
    gender: p.kon === 'man' ? 'male' : 'female', birthDate: p.fodd,
  };
  if (p.skyddad) r.meta = { security: [{ system: SYSTEM.confidentiality, code: 'R', display: 'restricted' }] };
  if (!p.skyddad && p.adress) r.address = [{ line: [p.adress], postalCode: p.postnr, city: p.ort, country: 'SE' }];
  if (!p.skyddad && p.telefon) r.telecom = [{ system: 'phone', value: p.telefon }];
  const l = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(p.id);
  if (l) r.generalPractitioner = [ref('Organization', l.enhet_id, enhetsnamn(db, l.enhet_id))];
  return r;
}

export function encounter(db, v) {
  const klass = { akut: ['EMER', 'emergency'], slutenvard: ['IMP', 'inpatient encounter'], oppenvard: ['AMB', 'ambulatory'] }[v.typ] ?? ['AMB', 'ambulatory'];
  return {
    resourceType: 'Encounter', id: String(v.id), meta: kallaMeta(v.kalla), status: v.slut ? 'finished' : 'in-progress',
    class: { system: SYSTEM.actcode, code: klass[0], display: klass[1] }, subject: ref('Patient', v.patient_id),
    period: { start: v.start, ...(v.slut ? { end: v.slut } : {}) }, reasonCode: v.orsak ? [{ text: v.orsak }] : undefined,
    serviceProvider: ref('Organization', v.enhet_id, enhetsnamn(db, v.enhet_id)),
    location: v.plats ? [{ location: { display: v.plats } }] : undefined,
  };
}

export function condition(db, d) {
  return {
    resourceType: 'Condition', id: String(d.id), meta: kallaMeta(d.kalla),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }], text: d.typ === 'huvud' ? 'Huvuddiagnos' : 'Bidiagnos' }],
    code: { coding: [{ system: SYSTEM.icd10se, code: d.kod, display: d.text }], text: d.text },
    subject: ref('Patient', d.patient_id), encounter: d.vardkontakt_id ? ref('Encounter', d.vardkontakt_id) : undefined,
    recordedDate: d.datum,
  };
}

export function observation(db, m) {
  const def = MATTYPER[m.typ] ?? { namn: m.typ };
  const vital = ['blodtryck', 'puls', 'temp', 'saturation', 'andningsfrekvens', 'vikt', 'langd'].includes(m.typ);
  const r = {
    resourceType: 'Observation', id: String(m.id), meta: kallaMeta(m.kalla), status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: vital ? 'vital-signs' : 'laboratory' }] }],
    code: { coding: def.loinc ? [{ system: SYSTEM.loinc, code: def.loinc, display: def.namn }] : [], text: def.namn },
    subject: ref('Patient', m.patient_id), effectiveDateTime: m.tid, performer: [ref('Organization', m.enhet_id, enhetsnamn(db, m.enhet_id))],
  };
  if (m.typ === 'blodtryck') {
    const [sys, dia] = m.varde.split('/').map(Number);
    r.component = [
      { code: { coding: [{ system: SYSTEM.loinc, code: '8480-6', display: 'Systoliskt blodtryck' }] }, valueQuantity: { value: sys, unit: 'mmHg' } },
      { code: { coding: [{ system: SYSTEM.loinc, code: '8462-4', display: 'Diastoliskt blodtryck' }] }, valueQuantity: { value: dia, unit: 'mmHg' } },
    ];
  } else r.valueQuantity = { value: m.varde_num ?? Number(m.varde), unit: m.matt_enhet };
  return r;
}

export function medicationRequest(db, o) {
  const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(o.lakemedel_id);
  const status = o.status === 'utsatt' ? 'stopped' : o.slut && o.slut < idag() ? 'completed' : 'active';
  return {
    resourceType: 'MedicationRequest', id: String(o.id), meta: kallaMeta(o.kalla), status, intent: 'order',
    medicationCodeableConcept: { coding: [{ system: SYSTEM.atc, code: lm.atc, display: lm.substans }, { system: SYSTEM.npl, code: lm.id, display: lm.namn }], text: `${lm.namn} ${lm.styrka} ${lm.form}` },
    subject: ref('Patient', o.patient_id), authoredOn: o.skapad, requester: ref('Practitioner', o.ordinerad_av, personNamn(db, o.ordinerad_av)),
    reasonCode: [{ text: o.orsak }],
    dosageInstruction: [{ text: o.dosering, asNeededBoolean: Boolean(o.vid_behov) }],
    dispenseRequest: { validityPeriod: { start: o.start, ...(o.slut ? { end: o.slut } : {}) } },
    extension: [
      { url: `${EXT}/uppfoljningsdatum`, valueDate: o.uppfoljning },
      { url: `${EXT}/nll-status`, valueCode: o.nll_status },
      ...(o.status === 'utsatt' ? [{ url: `${EXT}/utsattningsorsak`, valueString: o.utsatt_orsak }] : []),
    ],
  };
}

export function allergyIntolerance(db, o) {
  return {
    resourceType: 'AllergyIntolerance', id: String(o.id), meta: kallaMeta(o.kalla),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
    type: 'allergy', category: [o.atc ? 'medication' : 'food'], criticality: o.allvarlighet === 'allvarlig' ? 'high' : 'low',
    code: { coding: o.atc ? [{ system: SYSTEM.atc, code: o.atc, display: o.amne }] : [], text: o.amne },
    patient: ref('Patient', o.patient_id), recordedDate: o.datum,
    reaction: o.reaktion ? [{ manifestation: [{ text: o.reaktion }] }] : undefined,
  };
}

export function serviceRequest(db, r, klinisk = true) {
  const status = r.status === 'svar_kvitterat' ? 'completed' : r.beslut === 'avvisad' ? 'revoked' : 'active';
  const ut = {
    resourceType: 'ServiceRequest', id: String(r.id), meta: kallaMeta(r.kalla), status, intent: 'order',
    priority: { akut: 'stat', skyndsam: 'urgent', normal: 'routine' }[r.prioritet] ?? 'routine',
    subject: ref('Patient', r.patient_id), authoredOn: r.skickad_tid,
    requester: ref('Practitioner', r.avsandare_id, personNamn(db, r.avsandare_id)),
    performer: [ref('Organization', r.till_enhet_id, enhetsnamn(db, r.till_enhet_id))],
    extension: [{ url: `${EXT}/remisstatus`, valueCode: r.status }, { url: `${EXT}/svar-senast`, valueDate: r.svar_senast }],
  };
  if (klinisk) {
    ut.reasonCode = [{ text: r.fragestallning }];
    ut.note = [r.anamnes && { text: r.anamnes }, r.motivering && { text: `Motivering: ${r.motivering}` }, r.svar && { text: `Svar: ${r.svar}` }].filter(Boolean);
  }
  return ut;
}

export function composition(db, a) {
  const ersatt = db.query('SELECT id FROM anteckningar WHERE ersatter_id = ?').get(a.id);
  const sokord = JSON.parse(a.sokord);
  return {
    resourceType: 'Composition', id: String(a.id), meta: kallaMeta(a.kalla),
    status: a.status === 'utkast' ? 'preliminary' : a.ersatter_id ? 'amended' : 'final',
    type: { text: a.typ }, subject: ref('Patient', a.patient_id), encounter: a.vardkontakt_id ? ref('Encounter', a.vardkontakt_id) : undefined,
    date: a.signerad_tid ?? a.skapad, author: [ref('Practitioner', a.forfattare_id, personNamn(db, a.forfattare_id))], title: a.typ,
    custodian: ref('Organization', a.enhet_id, enhetsnamn(db, a.enhet_id)),
    relatesTo: [
      ...(a.ersatter_id ? [{ code: 'replaces', targetReference: ref('Composition', a.ersatter_id) }] : []),
      ...(ersatt ? [{ code: 'transforms', targetReference: ref('Composition', ersatt.id) }] : []),
    ],
    section: sokord.map(s => ({ title: s.sokord, text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${escape(s.text)}</div>` } })),
  };
}

export function organization(db, e) {
  return {
    resourceType: 'Organization', id: e.id, identifier: [{ system: SYSTEM.hsa, value: e.hsa_id }], active: true, name: e.namn,
    ...(e.kortnamn ? { alias: [e.kortnamn] } : {}), ...(e.forald_id ? { partOf: ref('Organization', e.forald_id) } : {}),
  };
}

export function practitioner(db, p) {
  return {
    resourceType: 'Practitioner', id: p.id, identifier: [{ system: SYSTEM.hsa, value: p.hsa_id }], active: Boolean(p.aktiv),
    name: [{ text: p.namn, family: p.namn.split(' ').slice(-1)[0], given: p.namn.split(' ').slice(0, -1) }],
    qualification: [{ code: { text: p.titel } }],
  };
}

export function auditEvent(r) {
  return {
    resourceType: 'AuditEvent', id: String(r.id),
    type: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: '110110', display: 'Patient Record' },
    action: r.handling.startsWith('skriv') || r.handling === 'ordinera' ? 'C' : 'R', recorded: r.tid,
    outcome: r.resultat === 'nekad' ? '4' : '0',
    purposeOfEvent: [{ coding: [{ system: `${EXT}/atkomstgrund`, code: r.grund }], text: r.syfte ?? undefined }],
    agent: [{ who: r.personal ? ref('Practitioner', r.personal.id, r.personal.namn) : undefined, requestor: true }],
    source: { observer: { display: 'Vårdkällan' } },
    entity: r.patientId ? [{ what: ref('Patient', r.patientId), description: r.resurs ?? undefined }] : [],
    extension: [{ url: `${EXT}/hash`, valueString: r.hash }],
  };
}

export function capability(base) {
  return {
    resourceType: 'CapabilityStatement', status: 'active', date: idag(), kind: 'instance', fhirVersion: '4.0.1', format: ['application/fhir+json'],
    software: { name: 'Vårdkällan', version: '0.1.0' }, implementation: { description: 'Vårdkällan, öppen demo med påhittade patienter', url: `${base}/fhir` },
    rest: [{
      mode: 'server',
      security: { description: 'Sessionskaka vk_sid. Samma behörighetskontroll och åtkomstloggning som gränssnittet.' },
      resource: TYPER.map(t => ({
        type: t, interaction: [{ code: 'read' }, { code: 'search-type' }],
        searchParam: t === 'Patient' ? [{ name: '_id', type: 'token' }, { name: 'identifier', type: 'token' }]
          : ['Organization', 'Practitioner'].includes(t) ? [{ name: '_id', type: 'token' }] : [{ name: 'patient', type: 'reference' }],
      })),
    }],
  };
}

function bundle(base, url, resurser) {
  return {
    resourceType: 'Bundle', type: 'searchset', total: resurser.length,
    link: [{ relation: 'self', url: `${base}${url.pathname}${url.search}` }],
    entry: resurser.map(r => ({ fullUrl: `${base}/fhir/${r.resourceType}/${r.id}`, resource: r, search: { mode: 'match' } })),
  };
}

const MAPPA = { Encounter: encounter, Condition: condition, Observation: observation, MedicationRequest: medicationRequest, AllergyIntolerance: allergyIntolerance, ServiceRequest: serviceRequest, Composition: composition };

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
        const varde = ident.includes('|') ? ident.split('|')[1] : ident;
        if (ident.includes('|') && ident.split('|')[0] !== SYSTEM.personnummer) kandidater = [];
        else kandidater = db.query('SELECT * FROM patienter WHERE personnummer = ?').all(varde.replace('-', ''));
      } else throw new Fel(400, 'Ange _id eller identifier.', 'ogiltig');
    }
    const ut = [];
    for (const p of kandidater) {
      const handling = kanRoll(personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
      const atk = new Atkomst(db, personal, p.id, ctx.valFor(p.id), handling);
      if (id) atk.krav(handling, { beskrivning: `fhir/Patient/${id}` });
      else if (!atk.prova(handling).tillaten) continue;
      else atk.krav(handling);
      atk.logga(handling, atk.grund(), `fhir/Patient${id ? '/' + id : url.search}`);
      ut.push(patient(db, p, Boolean(ctx.valFor(p.id).visa_identitet)));
    }
    return { status: 200, body: id ? ut[0] : bundle(base, url, ut) };
  }

  // Patientens resurser.
  const mappa = MAPPA[typ];
  if (id) {
    const rad = db.query(`SELECT * FROM ${TABELL[typ]} WHERE id = ?`).get(Number(id));
    if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    if (typ === 'Composition' && rad.status !== 'signerad' && rad.forfattare_id !== personal.id) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const handling = handlingFor(typ, rad, personal);
    const atk = new Atkomst(db, personal, rad.patient_id, ctx.valFor(rad.patient_id), handling);
    const enhetId = typ === 'ServiceRequest' ? rad.fran_enhet_id : rad.enhet_id;
    const egenRemiss = typ === 'ServiceRequest' && [rad.fran_enhet_id, rad.till_enhet_id].includes(vardenhet(db, personal));
    atk.krav(handling, { resurs: egenRemiss ? null : { enhet_id: enhetId, gemensam: GEMENSAM.has(typ) }, beskrivning: `fhir/${typ}/${id}` });
    atk.logga(handling, atk.grund(), `fhir/${typ}/${id}`);
    return { status: 200, body: typ === 'ServiceRequest' ? serviceRequest(db, rad, kanRoll(personal, 'las_remiss')) : mappa(db, rad) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const handling = handlingFor(typ, null, personal);
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), handling);
  if (typ === 'Composition') {
    atk.krav(kanRoll(personal, 'las_journal') ? 'las_journal' : 'las_omvardnad', { beskrivning: `fhir/${typ}${url.search}` });
  } else atk.krav(handling, { beskrivning: `fhir/${typ}${url.search}` });
  let rader = db.query(`SELECT * FROM ${TABELL[typ]} WHERE patient_id = ? ORDER BY id`).all(pid);
  if (typ === 'Composition') {
    rader = rader.filter(a => a.status === 'signerad' || a.forfattare_id === personal.id);
    rader = atk.filtrera(rader, a => lasHandling(a.kategori));
  } else if (typ === 'ServiceRequest') {
    const min = vardenhet(db, personal);
    const egna = rader.filter(r => r.fran_enhet_id === min || r.till_enhet_id === min);
    const andra = atk.filtrera(rader.filter(r => !egna.includes(r)).map(r => ({ ...r, enhet_id: r.fran_enhet_id })), handling);
    rader = [...egna, ...andra];
  } else rader = atk.filtrera(rader, handling, { gemensam: GEMENSAM.has(typ) });
  atk.logga(handling, atk.grund(), `fhir/${typ}${url.search}`);
  const resurser = rader.map(r => (typ === 'ServiceRequest' ? serviceRequest(db, r, kanRoll(personal, 'las_remiss')) : mappa(db, r)));
  return { status: 200, body: bundle(base, url, resurser) };
}

const vardenhet = (db, personal) => vardenhetFor(db, personal.enhet_id);
