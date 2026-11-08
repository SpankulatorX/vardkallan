// Runda 9, r6: det öppna API:t hålls aktuellt (Sussa 2.5.1.1), fler flöden via API:t och processen för nya gränssnitt
// (2.5.1.3), innovationsramverket (2.6.1.2), lagkravsmatrisen (2.7.1.2) och systemuppbyggnaden (2.1.1.1).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testserver, klient, sandlada } from './hjalp.js';
import { SYSTEM } from '../src/kodverk.js';
import { ANDRINGAR, VERSION, franCapability } from '../src/api-andringar.js';
import { SKRIVBARA } from '../src/fhir-skrivning.js';
import { LAGAR, MATRIS, LAGTESTER, lagmatris } from '../src/lagmatris.js';
import { MAPPNING, sussaRegister } from '../src/sussa/index.js';
import { KRAV, klickbudgetTest } from '../src/krav.js';
import { mobilaFloden, MOBILA, PERSPEKTIV, perKrav } from '../src/mobil.js';
import { FLODEN } from '../src/klickbudget.js';
import { SPEC } from '../src/sussa/index.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const ICD = SYSTEM.icd10se;
const diagnos = (pid, vk, kod = 'I10.9', extra = {}) => ({ resourceType: 'Condition', subject: { reference: `Patient/${pid}` }, encounter: { reference: `Encounter/${vk}` }, code: { coding: [{ system: ICD, code: kod }] }, ...extra });
// En vårdkontakt på kardiologen för patienten, som testet själv lägger in.
function nyKontakt(k, pid, enhet = 'uso-kard') {
  const db = sandlada(app, k).db;
  return Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut) VALUES (?, ?, 'oppenvard', '2026-11-02T09:00', '2026-11-02T09:30') RETURNING id").get(pid, enhet).id);
}

// Alla resurstyper i FHIR R4 (4.0.1).
const R4 = ('Account ActivityDefinition AdverseEvent AllergyIntolerance Appointment AppointmentResponse AuditEvent Basic Binary BiologicallyDerivedProduct BodyStructure Bundle '
  + 'CapabilityStatement CarePlan CareTeam CatalogEntry ChargeItem ChargeItemDefinition Claim ClaimResponse ClinicalImpression CodeSystem Communication CommunicationRequest '
  + 'CompartmentDefinition Composition ConceptMap Condition Consent Contract Coverage CoverageEligibilityRequest CoverageEligibilityResponse DetectedIssue Device DeviceDefinition '
  + 'DeviceMetric DeviceRequest DeviceUseStatement DiagnosticReport DocumentManifest DocumentReference EffectEvidenceSynthesis Encounter Endpoint EnrollmentRequest '
  + 'EnrollmentResponse EpisodeOfCare EventDefinition Evidence EvidenceVariable ExampleScenario ExplanationOfBenefit FamilyMemberHistory Flag Goal GraphDefinition Group '
  + 'GuidanceResponse HealthcareService ImagingStudy Immunization ImmunizationEvaluation ImmunizationRecommendation ImplementationGuide InsurancePlan Invoice Library Linkage '
  + 'List Location Measure MeasureReport Media Medication MedicationAdministration MedicationDispense MedicationKnowledge MedicationRequest MedicationStatement MedicinalProduct '
  + 'MedicinalProductAuthorization MedicinalProductContraindication MedicinalProductIndication MedicinalProductIngredient MedicinalProductInteraction MedicinalProductManufactured '
  + 'MedicinalProductPackaged MedicinalProductPharmaceutical MedicinalProductUndesirableEffect MessageDefinition MessageHeader MolecularSequence NamingSystem NutritionOrder '
  + 'Observation ObservationDefinition OperationDefinition OperationOutcome Organization OrganizationAffiliation Parameters Patient PaymentNotice PaymentReconciliation Person '
  + 'PlanDefinition Practitioner PractitionerRole Procedure Provenance Questionnaire QuestionnaireResponse RelatedPerson RequestGroup ResearchDefinition ResearchElementDefinition '
  + 'ResearchStudy ResearchSubject RiskAssessment RiskEvidenceSynthesis Schedule SearchParameter ServiceRequest Slot Specimen SpecimenDefinition StructureDefinition StructureMap '
  + 'Subscription Substance SubstanceNucleicAcid SubstancePolymer SubstanceProtein SubstanceReferenceInformation SubstanceSourceMaterial SubstanceSpecification SupplyDelivery '
  + 'SupplyRequest Task TerminologyCapabilities TestReport TestScript ValueSet VerificationResult VisionPrescription').split(' ');

describe('Öppet API hålls aktuellt', () => {
  test('Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const vk = nyKontakt(k, 'p01');
    const r = await k.raw('POST', '/fhir/Condition', diagnos('p01', vk, 'I48.0'));
    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toBe(`${app.url}/fhir/Condition/${r.data.id}`);
    expect(r.data).toMatchObject({ resourceType: 'Condition', subject: { reference: 'Patient/p01' }, encounter: { reference: `Encounter/${vk}` } });
    expect(r.data.code.coding[0]).toMatchObject({ system: ICD, code: 'I48.0' });
    // Systemet sätter texten ur ICD-10-SE och avgör huvud- eller bidiagnos, som i gränssnittet.
    const rad = sandlada(app, k).db.query('SELECT * FROM diagnoser WHERE id = ?').get(Number(r.data.id));
    expect(rad).toMatchObject({ patient_id: 'p01', enhet_id: 'uso-kard', vardkontakt_id: vk, kod: 'I48.0', typ: 'huvud' });
    expect(rad.text.length).toBeGreaterThan(5);
    const bi = await k.raw('POST', '/fhir/Condition', diagnos('p01', vk, 'I10.9'), { Prefer: 'return=OperationOutcome' });
    expect(bi.data.issue[0].diagnostics).toContain('bidiagnos');
    // Samma diagnos en gång till ger ingen ny rad.
    const igen = await k.raw('POST', '/fhir/Condition', diagnos('p01', vk, 'I48.0'));
    expect(igen.status).toBe(200);
    expect(igen.data.id).toBe(r.data.id);
    expect(logg(k).some(l => l.handling === 'registrera_diagnos' && l.patient_id === 'p01' && l.resurs === `vardkontakt:${vk}:diagnos:${r.data.id}`)).toBe(true);
    // Diagnosen kan läsas tillbaka.
    expect((await k.get(`/fhir/Condition/${r.data.id}`)).data.code.coding[0].code).toBe('I48.0');
  });

  test('Condition: fel roll, en vårdkontakt på en annan patient, en annan vårdenhet, en okänd kod och ett annat kodverk nekas med en förklaring', async () => {
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    const vk = nyKontakt(ssk, 'p01');
    const nekad = await ssk.raw('POST', '/fhir/Condition', diagnos('p01', vk));
    expect(nekad.status).toBe(403);
    expect(nekad.data.resourceType).toBe('OperationOutcome');
    const k = klient(app);
    await k.logga('lak-kard');
    const egen = nyKontakt(k, 'p01');
    // En kontakt som gäller en annan patient, en som saknas, en på en annan vårdenhet och en för en patient som läkaren
    // inte har vårdrelation till ger samma svar, så att svaret aldrig röjer vems kontakten är.
    const annan = await k.raw('POST', '/fhir/Condition', diagnos('p02', egen));
    const saknas = await k.raw('POST', '/fhir/Condition', diagnos('p02', 999999));
    const vc = nyKontakt(k, 'p01', 'vc-tybble');
    const annanEnhet = await k.raw('POST', '/fhir/Condition', diagnos('p01', vc));
    // En kontakt för patient 12 som inte ger vårdrelation, som en kontakt under nödåtkomst.
    const p12 = nyKontakt(k, 'p12');
    sandlada(app, k).db.query('UPDATE vardkontakter SET ger_vardrelation = 0 WHERE id = ?').run(p12);
    const utanRelation = await k.raw('POST', '/fhir/Condition', diagnos('p12', p12));
    for (const r of [annan, saknas, annanEnhet, utanRelation]) {
      expect(r.status).toBe(403);
      expect(r.data.issue[0].diagnostics).toBe(saknas.data.issue[0].diagnostics);
      expect(r.data.issue[0].expression).toEqual(['Condition.encounter']);
    }
    expect(nekad.data.issue[0].diagnostics).toContain('yrkesroll');
    const okand = await k.raw('POST', '/fhir/Condition', diagnos('p01', egen, 'Q99.99'));
    expect(okand.status).toBe(400);
    expect(okand.data.issue[0].diagnostics).toContain('ICD-10-SE');
    const snomed = await k.raw('POST', '/fhir/Condition', { ...diagnos('p01', egen), code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003' }] } });
    expect(snomed.status).toBe(400);
    expect((await k.raw('POST', '/fhir/Condition', { ...diagnos('p01', egen), encounter: undefined })).status).toBe(400);
    expect((await k.raw('PUT', '/fhir/Condition/1', { ...diagnos('p01', egen), id: '1' })).status).toBe(405);
    expect(sandlada(app, k).db.query('SELECT COUNT(*) n FROM diagnoser WHERE vardkontakt_id IN (?, ?, ?)').get(egen, vc, p12).n).toBe(0);
  });

  test('CapabilityStatement har versionen och listar varje resurstyp och operation som servern har, och inget annat', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const cs = (await k.get('/fhir/metadata')).data;
    expect(cs.software.version).toBe(JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')).version);
    expect(cs.software.releaseDate).toBe(ANDRINGAR[0].datum);
    const listade = new Map(cs.rest[0].resource.map(r => [r.type, r]));
    for (const t of R4) {
      const las = await k.get(`/fhir/${t}?patient=p01`);
      const okand = las.status === 404 && /Okänd FHIR-resurs/.test(las.data?.issue?.[0]?.diagnostics ?? '');
      if (listade.has(t)) expect([t, okand]).toEqual([t, false]);
      else expect([t, las.status]).toEqual([t, 404]);
      // Skrivning: det som anges som create går att skriva, och inget annat.
      const skapa = listade.get(t)?.interaction.some(i => i.code === 'create');
      const post = await k.raw('POST', `/fhir/${t}`, { resourceType: t });
      if (skapa) expect([t, post.status === 405 || post.status === 404]).toEqual([t, false]);
      else expect([t, post.status]).toEqual([t, listade.has(t) ? 405 : 404]);
    }
    // Varje skrivbar resurstyp i fhir-skrivning.js anges som create.
    for (const t of Object.keys(SKRIVBARA)) expect([t, listade.get(t).interaction.map(i => i.code)]).toEqual([t, expect.arrayContaining(['create'])]);
    // Operationerna: de som anges fungerar, och en okänd operation ger 404.
    const operationer = cs.rest[0].resource.flatMap(r => (r.operation ?? []).map(o => [r.type, o.name]));
    expect(operationer).toEqual([['Patient', 'everything']]);
    // $everything gäller bara invånarens session, och personalen får ett fel som säger det.
    expect(cs.rest[0].resource.find(r => r.type === 'Patient').operation[0].documentation).toContain('Min journal');
    const inv = klient(app);
    expect((await inv.post('/api/login/invanare', { invanareId: 'inv-p01' })).status).toBe(200);
    expect((await inv.get('/fhir/Patient/p01/$everything')).data.resourceType).toBe('Bundle');
    expect((await inv.get('/fhir/Patient/p01/$validate')).status).toBe(404);
    expect((await k.get('/fhir/Patient/p01/$validate')).status).toBe(404);
  });

  test('ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad', async () => {
    const cs = (await klient(app).get('/fhir/metadata')).data;
    expect(ANDRINGAR[0].version).toBe(VERSION);
    expect(cs.software.version).toBe(VERSION);
    const fran = franCapability(cs);
    const loggade = ANDRINGAR.flatMap(a => a.resurser);
    const skrivna = ANDRINGAR.flatMap(a => a.skrivning);
    expect([...loggade].sort()).toEqual([...new Set(fran.resurser)].sort());
    expect(new Set(loggade).size).toBe(loggade.length);
    expect([...skrivna].sort()).toEqual([...new Set(fran.skrivning)].sort());
    // Versionerna står i ordning med den senaste först, och varje rad har datum och text.
    const nummer = ANDRINGAR.map(a => a.version.split('.').map(Number));
    for (let i = 1; i < nummer.length; i++) expect(nummer[i - 1][0] * 1000 + nummer[i - 1][1] > nummer[i][0] * 1000 + nummer[i][1]).toBe(true);
    for (const a of ANDRINGAR) { expect(a.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(a.text.length).toBeGreaterThan(10); }
    // Loggen kan läsas utan inloggning.
    const r = await klient(app).get('/api/oppet-api/andringar');
    expect(r.status).toBe(200);
    expect(r.data.version).toBe(VERSION);
    expect(r.data.andringar[0].skrivning).toContain('Condition:create');
  });
});

// Sussa 2.7.1.2: lagkravsmatrisen.
describe('Lagkravsmatris', () => {
  test('varje relevant lag finns, och varje rad har tester eller en avgränsning med en förklaring', () => {
    const kort = LAGAR.map(l => l.kort);
    for (const lag of ['PDL', 'HSLF-FS 2016:40', 'Lag 2022:913', 'Patientsäkerhetslagen', 'Patientlagen', 'OSL', 'GDPR', 'Arkivlagen', 'NLL', 'HSLF-FS 2017:37', 'DOS-lagen', 'Cybersäkerhetslagen', 'MDR', 'Säkerhetsskyddslagen']) {
      expect([lag, kort.includes(lag), MATRIS.some(r => r.lag === lag)]).toEqual([lag, true, true]);
    }
    for (const r of MATRIS) {
      expect(kort).toContain(r.lag);
      expect([r.lag, r.paragraf, r.skyldighet.length > 20]).toEqual([r.lag, r.paragraf, true]);
      // En rad utan avgränsning har en funktion i systemet och tester. En avgränsning förklarar varför.
      if (r.avgransning) expect(r.avgransning.length).toBeGreaterThan(40);
      else expect([r.paragraf, r.tester.length > 0, (r.stod ?? '').length > 20]).toEqual([r.paragraf, true, true]);
    }
    // Organisationens och tillverkarens skyldigheter står som avgränsningar, inte som uppfyllda.
    for (const lag of ['MDR', 'Cybersäkerhetslagen', 'Säkerhetsskyddslagen']) expect(MATRIS.filter(r => r.lag === lag).every(r => r.avgransning)).toBe(true);
  });

  test('matrisens tester räknas in i 2.7.1.2, och statusen per rad följer testerna', () => {
    const post = MAPPNING.find(m => m.id === '2.7.1.2');
    for (const t of LAGTESTER) expect(post.tester).toContain(t);
    const grona = new Map(LAGTESTER.map(t => [t, 'grön']));
    expect(lagmatris(grona).rader.every(r => r.status === (r.avgransning ? 'avgransad' : 'uppfylld'))).toBe(true);
    const enRod = new Map([...grona, [LAGTESTER[0], 'röd']]);
    const rader = lagmatris(enRod).rader;
    expect(rader.filter(r => r.status === 'delvis').every(r => r.tester.some(t => t.namn === LAGTESTER[0]))).toBe(true);
    expect(rader.some(r => r.status === 'delvis')).toBe(true);
    // Kravet L13 har testerna för dataskyddsförordningen, arkivlagen och tillgänglighetslagen.
    const l13 = KRAV.find(k => k.id === 'L13');
    expect(l13.status).toBe('delvis');
    expect(l13.tester.length).toBeGreaterThan(5);
    expect(l13.tester.every(t => LAGTESTER.includes(t))).toBe(true);
  });

  test('API: krav/sussa ger matrisen under 2.7.1.2 med status per rad', async () => {
    const r = await klient(app).get('/api/krav/sussa');
    const post = r.data.poster.find(p => p.id === '2.7.1.2');
    expect(post.lagmatris.rader.length).toBe(MATRIS.length);
    expect(post.lagmatris.granskning).toContain('inte juridiskt granskade');
    expect(new Set(post.lagmatris.rader.map(x => x.status)).size).toBeGreaterThan(0);
    expect(sussaRegister(null).poster.find(p => p.id === '2.7.1.2').lagmatris.rader.every(x => x.status !== 'uppfylld')).toBe(true);
  });
});

// Sussa 2.3.1.2 och 2.3.1.3: de mobila flödena och uppställningen per funktionellt krav.
describe('Mobilt arbetssätt', () => {
  test('varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden', () => {
    const m = mobilaFloden();
    expect(m.map(f => f.id)).toEqual(FLODEN.map(f => f.id));
    for (const id of Object.keys(MOBILA)) expect(FLODEN.some(f => f.id === id)).toBe(true);
    for (const f of m) expect([f.id, f.text.length > 20]).toEqual([f.id, true]);
    for (const p of Object.keys(PERSPEKTIV)) expect([p, m.filter(f => f.mobil && f.perspektiv === p).length > 0]).toEqual([p, true]);
    // Vid sängen: att ge läkemedel och registrera mätvärden är mobila flöden.
    expect(m.filter(f => f.mobil).map(f => f.id)).toEqual(expect.arrayContaining(['ge-dos', 'blodtryck', 'news2', 'grundmatningar']));
  });

  test('uppställningen per funktionellt krav i kapitel 3 och 4 räknas ur registret och anger bara flöden som prövas i 360 px', () => {
    const krav = perKrav(SPEC.poster, MAPPNING, klickbudgetTest);
    expect(krav.length).toBeGreaterThan(20);
    expect(krav.every(k => ['3', '4'].includes(SPEC.poster.find(p => p.id === k.id).kapitel))).toBe(true);
    const mobila = new Set(mobilaFloden().filter(f => f.mobil).map(f => f.namn));
    for (const k of krav) {
      for (const namn of k.mobila) expect(mobila.has(namn)).toBe(true);
      if (!k.mobila.length) expect(k.varfor.length).toBeGreaterThan(10);
    }
    // Kravet om administrering av läkemedel har flödet att ge en dos.
    expect(krav.filter(k => k.mobila.includes('Ge en dos')).length).toBeGreaterThan(0);
    expect(sussaRegister(null).poster.find(p => p.id === '2.3.1.3').mobil.krav.length).toBe(krav.length);
  });
});
