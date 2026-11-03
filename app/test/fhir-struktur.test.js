import { describe, test, expect } from 'bun:test';
import * as fhir from '../src/fhir.js';
import { DEFINITIONER, EXT } from '../src/fhir-definitioner.js';
import { nyDb, personal } from './hjalp.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';

// Strukturkrav som HL7:s validator kontrollerar (docs/fhir-validering.md). Testerna kräver inte Java,
// så att bygget fångar de viktigaste felen även utan validatorn.
const db = nyDb();
const fraga = (personalId, vag, val = {}) => fhir.hantera({ db, personal: personalId ? personal(db, personalId) : null, valFor: (pid) => val[pid] ?? {}, url: new URL(`http://test.local${vag}`), base: 'http://test.local' }).body;
const TYPER = ['Encounter', 'EpisodeOfCare', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition'];
const ALLA = { andra_enheter: true, nodatkomst: true, samtycke_sparr: true };

// Alla resurser som demorollerna kan nå, med alla val gjorda.
function allaResurser() {
  const ut = [];
  const bundles = [];
  const lagg = (b) => { bundles.push(b); for (const e of b.entry ?? []) ut.push(e.resource); };
  const patienter = db.query('SELECT id FROM patienter ORDER BY id').all().map(p => p.id);
  for (const roll of ['lak-kard', 'lak-vc', 'lak-psyk']) {
    for (const pid of patienter) {
      const val = { [pid]: ALLA };
      for (const t of ['Patient', ...TYPER]) {
        try { lagg(fraga(roll, t === 'Patient' ? `/fhir/Patient?_id=${pid}` : `/fhir/${t}?patient=${pid}`, val)); } catch { /* nekad för rollen */ }
      }
    }
  }
  lagg(fraga('lak-kard', '/fhir/Organization'));
  lagg(fraga('lak-kard', '/fhir/Practitioner'));
  lagg(fraga('logg', '/fhir/AuditEvent?patient=p01'));
  ut.push(fraga(null, '/fhir/metadata'));
  return { resurser: ut, bundles };
}
const { resurser, bundles } = allaResurser();
const avTyp = (t) => resurser.filter(r => r.resourceType === t);

function* noder(v, vag = '') {
  yield [vag, v];
  if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* noder(v[i], `${vag}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* noder(x, vag ? `${vag}.${k}` : k);
}

describe('FHIR-struktur', () => {
  test('inga tomma listor, tomma strängar eller null, och varje kodning har system och kod', () => {
    expect(resurser.length).toBeGreaterThan(200);
    for (const typ of [...TYPER, 'Patient', 'Organization', 'Practitioner', 'AuditEvent']) expect(avTyp(typ).length).toBeGreaterThan(0);
    const fel = [];
    for (const r of [...resurser, ...bundles]) {
      for (const [vag, v] of noder(r)) {
        if (Array.isArray(v) && v.length === 0) fel.push(`${r.resourceType}/${r.id} ${vag}: tom lista`);
        if (v === null || v === '') fel.push(`${r.resourceType}/${r.id} ${vag}: tomt värde`);
        if (/\.coding\[\d+\]$|security\[\d+\]$|tag\[\d+\]$/.test(vag) && !(v.system && v.code)) fel.push(`${r.resourceType}/${r.id} ${vag}: kodning utan system eller kod`);
      }
    }
    expect(fel).toEqual([]);
  });

  test('vitalparametrar följer FHIR R4:s vitalparameterprofiler', () => {
    const vital = avTyp('Observation').filter(o => o.category?.[0]?.coding?.[0]?.code === 'vital-signs');
    expect(vital.length).toBeGreaterThan(20);
    const ucum = { heartrate: ['/min'], resprate: ['/min'], bodytemp: ['Cel'], bodyweight: ['kg'], bodyheight: ['cm'], oxygensat: ['%'], bp: ['mm[Hg]'] };
    const kod = { heartrate: '8867-4', resprate: '9279-1', bodytemp: '8310-5', bodyweight: '29463-7', bodyheight: '8302-2', oxygensat: '2708-6', bp: '85354-9' };
    for (const o of vital) {
      const profil = o.meta.profile[0].split('/').pop();
      expect(kod[profil]).toBeDefined();
      expect(o.code.coding.map(c => c.code)).toContain(kod[profil]);
      expect(o.effectiveDateTime).toBeDefined();
      expect(o.subject.reference).toStartWith('Patient/');
      const varden = o.component ? o.component.map(c => c.valueQuantity) : [o.valueQuantity];
      for (const q of varden) {
        expect(typeof q.value).toBe('number');
        expect(q.system).toBe('http://unitsofmeasure.org');
        expect(ucum[profil]).toContain(q.code);
      }
    }
    const bt = vital.find(o => o.meta.profile[0].endsWith('/bp'));
    expect(bt.component.map(c => c.code.coding[0].code)).toEqual(['8480-6', '8462-4']);
  });

  test('labbvärden har NPU-kod och UCUM-enhet', () => {
    const labb = avTyp('Observation').filter(o => o.category[0].coding[0].code === 'laboratory');
    expect(labb.length).toBeGreaterThan(10);
    for (const o of labb) {
      // eGFR har bara text, eftersom NPU saknar kod för skattat GFR.
      if (o.code.text === 'eGFR') expect(o.code.coding).toBeUndefined();
      else expect(o.code.coding).toEqual([{ system: 'http://npu-terminology.org', code: expect.stringMatching(/^NPU\d{5}$/) }]);
      expect(o.code.text.length).toBeGreaterThan(1);
      expect(o.valueQuantity.system).toBe('http://unitsofmeasure.org');
      expect(o.meta.profile).toBeUndefined();
    }
  });

  test('meta.profile bara för profiler som validerats', () => {
    const tillatna = new Set([...Object.values(fhir.PROFIL), ...['bp', 'heartrate', 'resprate', 'bodytemp', 'bodyweight', 'bodyheight', 'oxygensat'].map(p => `http://hl7.org/fhir/StructureDefinition/${p}`)]);
    for (const r of resurser) for (const p of r.meta?.profile ?? []) expect(tillatna.has(p)).toBe(true);
    for (const t of ['Patient', 'Organization', 'Practitioner']) expect(avTyp(t).every(r => r.meta.profile[0] === fhir.PROFIL[t])).toBe(true);
    for (const t of ['Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance', 'ServiceRequest', 'Composition', 'AuditEvent']) expect(avTyp(t).some(r => r.meta?.profile)).toBe(false);
  });

  test('Patient, Organization och Practitioner följer HL7 Swedens basprofiler', () => {
    for (const p of avTyp('Patient')) {
      expect(p.name.length).toBe(1);
      // Basprofilen tillåter högst ett personnummer och ett samordningsnummer. Varje patient har sin gällande identitet.
      expect(p.identifier.filter(i => i.system === 'http://electronichealth.se/identifier/personnummer').length).toBeLessThanOrEqual(1);
      expect(p.identifier.filter(i => i.system === 'http://electronichealth.se/identifier/samordningsnummer').length).toBeLessThanOrEqual(1);
      expect(p.identifier.filter(i => i.use === 'official').length).toBe(1);
      for (const i of p.identifier) expect(i.system).toMatch(/^(http:\/\/electronichealth\.se\/identifier\/(personnummer|samordningsnummer)|urn:oid:[0-2](\.\d+)+)$/);
      for (const s of p.meta.security ?? []) expect(['http://hl7.se/fhir/ig/base/CodeSystem/SecurityLabel', 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality']).toContain(s.system);
    }
    expect(avTyp('Patient').some(p => p.meta.security?.some(s => s.code === 'sekretessmarkering'))).toBe(true);
    for (const r of [...avTyp('Organization'), ...avTyp('Practitioner')]) {
      const hsa = r.identifier.filter(i => i.system === 'urn:oid:1.2.752.29.4.19');
      expect(hsa.length).toBe(1);
      expect(hsa[0].type.coding[0]).toMatchObject({ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'PRN' });
    }
    for (const p of avTyp('Practitioner')) expect(p.name.length).toBe(1);
  });

  test('varje tillägg och eget kodsystem har en publicerad definition', () => {
    const sd = new Set(DEFINITIONER.StructureDefinition.map(d => d.url));
    const cs = new Set(DEFINITIONER.CodeSystem.map(d => d.url));
    for (const r of resurser) {
      for (const [vag, v] of noder(r)) {
        if (vag.endsWith('.url') && /extension\[\d+\]\.url$/.test(vag)) expect(sd.has(v)).toBe(true);
        if (vag.endsWith('.system') && String(v).startsWith('https://vardkallan.404haven.se/fhir/CodeSystem/')) expect(cs.has(v)).toBe(true);
      }
    }
    for (const d of DEFINITIONER.StructureDefinition) expect(d.url).toBe(`${EXT}/${d.id}`);
    // Definitionerna kan läsas utan inloggning.
    expect(fhir.oppenSokvag('/fhir/StructureDefinition/uppfoljningsdatum')).toBe(true);
    expect(fraga(null, '/fhir/StructureDefinition/uppfoljningsdatum').url).toBe(`${EXT}/uppfoljningsdatum`);
    expect(fraga(null, '/fhir/CodeSystem').total).toBe(DEFINITIONER.CodeSystem.length);
    expect(fhir.oppenSokvag('/fhir/Patient')).toBe(false);
  });

  test('Condition och MedicationRequest har display ur kodverket', () => {
    const icd = avTyp('Condition').map(c => c.code.coding[0]);
    expect(icd.every(c => c.system === 'urn:oid:1.2.752.116.1.1.1' && c.display.length > 3)).toBe(true);
    const atc = avTyp('MedicationRequest').map(m => m.medicationCodeableConcept.coding[0]);
    expect(atc.every(c => c.system === 'http://www.whocc.no/atc' && c.display)).toBe(true);
    expect(atc.find(c => c.code === 'B01AA03').display).toBe('warfarin');
  });

  test('MedicationRequest har NPL-id med E-hälsomyndighetens system', () => {
    const npl = Object.fromEntries(KATALOG.map(l => [l.atc, l.npl]));
    const lm = avTyp('MedicationRequest').map(m => m.medicationCodeableConcept.coding);
    expect(lm.length).toBeGreaterThan(40);
    for (const [atc, nplid, ...ovr] of lm) {
      expect(ovr).toEqual([]);
      expect(nplid).toEqual({ system: 'http://electronichealth.se/fhir/NamingSystem/nplid', code: npl[atc.code] });
    }
  });
});
