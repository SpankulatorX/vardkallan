import { describe, test, expect } from 'bun:test';
import * as fhir from '../src/fhir.js';
import { nyDb, personal } from './hjalp.js';

const fraga = (db, personalId, vag, val = {}) => {
  const url = new URL(`http://test.local${vag}`);
  return fhir.hantera({ db, personal: personalId ? personal(db, personalId) : null, valFor: (pid) => val[pid] ?? {}, url, base: 'http://test.local' }).body;
};
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('FHIR', () => {
  test('metadata är ett CapabilityStatement', () => {
    const db = nyDb();
    const c = fraga(db, null, '/fhir/metadata');
    expect(c.resourceType).toBe('CapabilityStatement');
    expect(c.fhirVersion).toBe('4.0.1');
    expect(c.rest[0].resource.map(r => r.type)).toEqual(expect.arrayContaining(['Patient', 'MedicationRequest', 'AuditEvent', 'Composition']));
  });

  test('sökning ger Bundle searchset', () => {
    const db = nyDb();
    const b = fraga(db, 'lak-kard', '/fhir/Observation?patient=p01');
    expect(b.resourceType).toBe('Bundle');
    expect(b.type).toBe('searchset');
    expect(b.total).toBe(b.entry.length);
    expect(b.entry.length).toBeGreaterThan(0);
    for (const e of b.entry) {
      expect(e.fullUrl).toBe(`http://test.local/fhir/Observation/${e.resource.id}`);
      expect(e.search.mode).toBe('match');
    }
  });

  test('Patient har personnummer med rätt identifier-system', () => {
    const db = nyDb();
    const p = fraga(db, 'lak-kard', '/fhir/Patient/p01');
    expect(p.resourceType).toBe('Patient');
    expect(p.identifier[0]).toEqual({ system: 'http://electronichealth.se/identifier/personnummer', value: '194502024732' });
    expect(p).toMatchObject({ gender: 'male', birthDate: '1945-02-02' });
    expect(p.name[0].family).toBe('Åkesson');
    const sok = fraga(db, 'lak-kard', '/fhir/Patient?identifier=http://electronichealth.se/identifier/personnummer|194502024732');
    expect(sok.entry.map(e => e.resource.id)).toEqual(['p01']);
  });

  test('Condition använder ICD-10-SE', () => {
    const db = nyDb();
    const b = fraga(db, 'lak-kard', '/fhir/Condition?patient=p01');
    const koder = b.entry.map(e => e.resource.code.coding[0]);
    // Socialstyrelsens OID för ICD-10-SE. HL7 har ingen registrerad URI för ICD-10-SE.
    expect(koder.every(c => c.system === 'urn:oid:1.2.752.116.1.1.1')).toBe(true);
    expect(koder.map(c => c.code)).toContain('I48.1');
  });

  test('MedicationRequest använder ATC och har uppföljningsdatum', () => {
    const db = nyDb();
    const b = fraga(db, 'lak-kard', '/fhir/MedicationRequest?patient=p01');
    expect(b.entry.length).toBeGreaterThan(0);
    for (const { resource: m } of b.entry) {
      expect(m.medicationCodeableConcept.coding[0].system).toBe('http://www.whocc.no/atc');
      expect(m.reasonCode[0].text.length).toBeGreaterThan(0);
      expect(m.extension.find(x => x.url.endsWith('/uppfoljningsdatum')).valueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const waran = b.entry.find(e => e.resource.medicationCodeableConcept.coding[0].code === 'B01AA03').resource;
    expect(waran.status).toBe('active');
    expect(waran.medicationCodeableConcept.coding[1]).toEqual({ system: 'http://electronichealth.se/fhir/NamingSystem/nplid', code: '19640101000028' });
    expect(waran.medicationCodeableConcept.text).toBe('Waran 2,5 mg tablett');
    expect(b.entry.some(e => e.resource.status === 'stopped')).toBe(true);
  });

  test('Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form', () => {
    const db = nyDb();
    const obs = fraga(db, 'lak-kard', '/fhir/Observation?patient=p01').entry.map(e => e.resource);
    const bt = obs.find(o => o.code.coding[0]?.code === '85354-9');
    expect(bt.component.map(c => c.code.coding[0].code)).toEqual(['8480-6', '8462-4']);
    expect(obs.find(o => o.code.coding[0]?.code === '8867-4').valueQuantity.unit).toBe('slag/min');
    const al = fraga(db, 'lak-kard', '/fhir/AllergyIntolerance?patient=p01').entry[0].resource;
    expect(al).toMatchObject({ resourceType: 'AllergyIntolerance', criticality: 'high', patient: { reference: 'Patient/p01' } });
    expect(al.code.coding[0]).toMatchObject({ system: 'http://www.whocc.no/atc', code: 'J01C' });
    const enc = fraga(db, 'lak-kard', '/fhir/Encounter?patient=p01').entry.map(e => e.resource);
    expect(enc.find(e => e.status === 'in-progress').class.code).toBe('IMP');
    const sr = fraga(db, 'lak-kard', '/fhir/ServiceRequest?patient=p11').entry[0].resource;
    expect(sr).toMatchObject({ resourceType: 'ServiceRequest', status: 'active', intent: 'order' });
    expect(sr.extension.find(x => x.url.endsWith('/remisstatus')).valueCode).toBe('besvarad');
    const comp = fraga(db, 'lak-kard', '/fhir/Composition?patient=p01').entry.map(e => e.resource);
    expect(comp.every(c => ['final', 'amended', 'preliminary'].includes(c.status))).toBe(true);
    const amended = comp.find(c => c.status === 'amended');
    expect(amended.relatesTo[0].code).toBe('replaces');
    expect(comp[0].section[0].text.div).toStartWith('<div xmlns="http://www.w3.org/1999/xhtml">');
    const org = fraga(db, 'lak-kard', '/fhir/Organization/uso-kard');
    expect(org).toMatchObject({ resourceType: 'Organization', name: 'Kardiologiska kliniken USÖ', partOf: { reference: 'Organization/uso' } });
    expect(org.identifier[0].value).toBe('SE2321000164-VK0120');
    const pr = fraga(db, 'lak-kard', '/fhir/Practitioner?_id=lak-kard').entry[0].resource;
    expect(pr.name[0].text).toBe('Sara Lindqvist');
  });

  test('skyddad patient maskeras i FHIR', () => {
    const db = nyDb();
    const p = fraga(db, 'lak-vc', '/fhir/Patient/p03');
    expect(p.name[0].text).toBe('Skyddad identitet');
    expect(p.identifier[0].value).toBe('19840416****');
    expect(p.address).toBeUndefined();
    expect(p.telecom).toBeUndefined();
    expect(p.meta.security.map(c => `${c.system}|${c.code}`)).toEqual(['http://hl7.se/fhir/ig/base/CodeSystem/SecurityLabel|sekretessmarkering', 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality|R']);
    const visad = fraga(db, 'lak-vc', '/fhir/Patient/p03', { p03: { visa_identitet: true } });
    expect(visad.name[0].family).toBe('Engberg');
    expect(visad.address).toBeUndefined();
  });

  test('FHIR följer samma behörighet: nekad utan vårdrelation', () => {
    const db = nyDb();
    const e = fel(() => fraga(db, 'lak-kard', '/fhir/Composition?patient=p12'));
    expect(e.status).toBe(403);
    expect(e.kod).toBe('kraver_val');
    expect(fel(() => fraga(db, 'adm-kard', '/fhir/MedicationRequest?patient=p01')).status).toBe(403);
    expect(fel(() => fraga(db, 'usk-kard', '/fhir/Condition?patient=p01')).status).toBe(403);
    const id = db.query("SELECT id FROM anteckningar WHERE patient_id = 'p12' LIMIT 1").get().id;
    expect(fel(() => fraga(db, 'lak-kard', `/fhir/Composition/${id}`)).kod).toBe('kraver_val');
    // Patientsökning visar inte patienter utan behörighet.
    expect(fraga(db, 'lak-kard', '/fhir/Patient?identifier=199812212398').total).toBe(0);
    // Med nödåtkomst går det.
    expect(fraga(db, 'lak-kard', '/fhir/Composition?patient=p12', { p12: { nodatkomst: true } }).total).toBeGreaterThan(0);
    // Undersköterskan ser bara omvårdnadsanteckningar.
    const usk = fraga(db, 'usk-kard', '/fhir/Composition?patient=p01').entry.map(e => e.resource.type.text);
    expect(new Set(usk)).toEqual(new Set(['Omvårdnadsanteckning']));
  });

  test('FHIR följer inre sekretess och spärr', () => {
    const db = nyDb();
    const egna = fraga(db, 'lak-kard', '/fhir/Composition?patient=p01').entry.map(e => e.resource.custodian.reference);
    expect(egna.every(r => r.startsWith('Organization/uso-kard'))).toBe(true);
    const alla = fraga(db, 'lak-kard', '/fhir/Composition?patient=p01', { p01: { andra_enheter: true } }).entry.map(e => e.resource.custodian.reference);
    expect(alla).toContain('Organization/uso-akut');
    const sparrad = fraga(db, 'lak-kard', '/fhir/Condition?patient=p04', { p04: { andra_enheter: true } }).entry.map(e => e.resource.code.coding[0].code);
    expect(sparrad.some(k => k.startsWith('F'))).toBe(false);
    const samtycke = fraga(db, 'lak-kard', '/fhir/Condition?patient=p04', { p04: { samtycke_sparr: true } }).entry.map(e => e.resource.code.coding[0].code);
    expect(samtycke).toContain('F33.1');
    const psykDia = db.query("SELECT id FROM diagnoser WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk'").get().id;
    expect(fel(() => fraga(db, 'lak-kard', `/fhir/Condition/${psykDia}`, { p04: { andra_enheter: true, nodatkomst: true } })).kod).toBe('kraver_samtycke');
  });

  test('FHIR-anrop loggas', () => {
    const db = nyDb();
    const fore = db.query('SELECT max(id) AS m FROM atkomstlogg').get().m;
    fraga(db, 'lak-kard', '/fhir/Observation?patient=p01');
    fel(() => fraga(db, 'lak-kard', '/fhir/Observation?patient=p12'));
    const rader = db.query('SELECT * FROM atkomstlogg WHERE id > ? ORDER BY id').all(fore);
    expect(rader.map(r => [r.patient_id, r.handling, r.resultat])).toEqual([['p01', 'las_matvarden', 'tillaten'], ['p12', 'las_matvarden', 'nekad']]);
    expect(rader[0].resurs).toStartWith('fhir/Observation');
    expect(rader[0].grund).toBe('egen_enhet');
  });

  test('AuditEvent bara för logggranskare', () => {
    const db = nyDb();
    expect(fel(() => fraga(db, 'lak-kard', '/fhir/AuditEvent?patient=p01')).status).toBe(403);
    const b = fraga(db, 'logg', '/fhir/AuditEvent?patient=p04');
    expect(b.type).toBe('searchset');
    const sam = b.entry.map(e => e.resource).find(a => a.purposeOfEvent[0].coding[0].code === 'samtycke_sparr');
    expect(sam.entity[0].what.reference).toBe('Patient/p04');
    expect(sam.agent[0].who.reference).toBe('Practitioner/lak-kard');
  });

  test('ej inloggad får 401 OperationOutcome', () => {
    const db = nyDb();
    const e = fel(() => fraga(db, null, '/fhir/Patient/p01'));
    expect(e.status).toBe(401);
    const oo = fhir.utfall(e.status, e.kod, e.message);
    expect(oo).toMatchObject({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login' }] });
    expect(fel(() => fraga(db, 'lak-kard', '/fhir/Okand')).status).toBe(404);
    expect(fel(() => fraga(db, 'lak-kard', '/fhir/Observation')).status).toBe(400);
  });
});
