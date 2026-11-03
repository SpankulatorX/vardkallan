// Skriver alla FHIR-resurser som demorollerna och invånarna når, med alla val gjorda, till katalogen i första argumentet:
// en underkatalog per resurstyp och def/ med Vårdkällans egna definitioner. Se docs/fhir-validering.md.
// Invånarens resurser (Min journal) har färre uppgifter än personalens och skrivs därför för sig, med inv- först i namnet.
import { mkdirSync, writeFileSync } from 'node:fs';
import * as fhir from '../../app/src/fhir.js';
import { nySessionsDb } from '../../app/src/db.js';
import * as tidbokFhir from '../../app/src/tidbok-fhir.js';
import { journaler } from '../../app/src/patientvy.js';
import { Atkomst } from '../../app/src/atkomst.js';
import * as ks from '../../app/src/kontrasignering.js';
// Runda 6, r1: en läkemedelsgenomgång, så att Procedure med KVÅ XV015 kommer med.
import { sparaGenomgang } from '../../app/src/vidimering.js';
// Runda 6, r5: prenumerationer, meddelanden, OperationOutcome från skrivningen och resurser som en klient skickar.
import * as prenumeration from '../../app/src/prenumeration.js';
import * as skrivning from '../../app/src/fhir-skrivning.js';
import { Fel } from '../../app/src/db.js';
import { EXT } from '../../app/src/fhir-definitioner.js';

const UT = process.argv[2];
if (!UT) { console.error('Ange en utkatalog.'); process.exit(2); }
const BAS = 'http://127.0.0.1:18798';
const db = nySessionsDb();
const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const fraga = (roll, vag, val = {}) => fhir.hantera({ db, personal: roll ? pers(roll) : null, valFor: (p) => val[p] ?? {}, url: new URL(BAS + vag), base: BAS }).body;
const fragaInvanare = (inv, vag) => fhir.hantera({ db, personal: null, invanare: inv, nekade: { antal: 0 }, valFor: () => ({}), url: new URL(BAS + vag), base: BAS }).body;
const skriv = (katalog, namn, r) => { mkdirSync(`${UT}/${katalog}`, { recursive: true }); writeFileSync(`${UT}/${katalog}/${namn}.json`, JSON.stringify(r, null, 1)); };

// Demon börjar med en begäran om kontrasignering som inte är gjord. Mottagaren kontrasignerar den här som i
// gränssnittet, så att Composition.attester kommer med i valideringen.
for (const k of db.query("SELECT * FROM kontrasigneringar WHERE status = 'begard' AND typ = 'anteckning'").all()) {
  ks.kontrasignera(new Atkomst(db, pers(k.mottagare_id), k.patient_id, {}, 'kontrasignera'), k);
}

sparaGenomgang(new Atkomst(db, pers('lak-kard'), 'p01', {}, 'ordinera'), {});

const sett = new Map();
const lagg = (b) => { for (const e of b.entry ?? []) sett.set(`${e.resource.resourceType}/${e.resource.id}`, e.resource); };
// Alla patientresurser i fhir.js och bokningarna i tidbok-fhir.js. Kontrollen sist i filen gör körningen röd om en
// resurstyp som API:t kan lämna ut inte kom med, så att listan följer med när en ny resurstyp tillkommer.
const TYPER = ['Patient', 'Encounter', 'EpisodeOfCare', 'Condition', 'Observation', 'MedicationRequest', 'MedicationAdministration', 'List',
  'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition', 'Appointment', 'Procedure'];
for (const roll of ['lak-kard', 'ssk-kard', 'adm-kard', 'lak-vc', 'lak-psyk', 'lak-akut']) {
  for (const { id } of db.query('SELECT id FROM patienter').all()) {
    const val = { [id]: { andra_enheter: true, nodatkomst: true, samtycke_sparr: true } };
    for (const t of TYPER) {
      try { lagg(fraga(roll, t === 'Patient' ? `/fhir/Patient?_id=${id}` : `/fhir/${t}?patient=${id}`, val)); } catch { /* rollen nekas, det är väntat */ }
    }
  }
}
lagg(fraga('lak-kard', '/fhir/Organization'));
lagg(fraga('lak-kard', '/fhir/Practitioner'));
lagg(fraga('logg', '/fhir/AuditEvent'));
// Tidboken: alla scheman och alla tider i dem, också de som har passerat.
const scheman = fraga('adm-kard', '/fhir/Schedule');
lagg(scheman);
for (const e of scheman.entry ?? []) lagg(fraga('adm-kard', `/fhir/Slot?schedule=${e.resource.id}&start=ge2000-01-01`));
for (const t of fhir.DEFINITIONSTYPER) for (const e of fraga(null, `/fhir/${t}`).entry) skriv('def', `${t}-${e.resource.id}`, e.resource);
skriv('CapabilityStatement', 'metadata', fraga(null, '/fhir/metadata'));

// Invånarna i Min journal: allt i $everything och bokningarna, för varje journal som invånaren får läsa.
const invanaren = new Map();
for (const inv of db.query('SELECT * FROM invanare ORDER BY id').all()) {
  for (const { patientId } of journaler(db, inv).filter(j => j.atkomst)) {
    for (const vag of [`/fhir/Patient/${patientId}/$everything`, `/fhir/Appointment?patient=${patientId}`]) {
      for (const e of fragaInvanare(inv, vag).entry ?? []) invanaren.set(`${e.resource.resourceType}/${e.resource.id}`, e.resource);
    }
  }
}

const antal = {};
for (const r of sett.values()) { skriv(r.resourceType, `${r.resourceType}-${r.id}`, r); antal[r.resourceType] = (antal[r.resourceType] ?? 0) + 1; }
for (const r of invanaren.values()) { skriv(r.resourceType, `inv-${r.resourceType}-${r.id}`, r); antal[`${r.resourceType} (invånare)`] = (antal[`${r.resourceType} (invånare)`] ?? 0) + 1; }
console.log(JSON.stringify(antal));
const saknas = [...fhir.TYPER, ...tidbokFhir.TIDBOK_TYPER, ...fhir.DEFINITIONSTYPER].filter(t => !antal[t] && !(fhir.DEFINITIONSTYPER.includes(t) && fraga(null, `/fhir/${t}`).entry?.length));
// Kontrasigneringen syns som attester i Composition och vårdtillfället som Encounter med id vt-, så de kontrolleras för sig.
if (![...sett.values()].some(r => r.resourceType === 'Composition' && r.attester?.length)) saknas.push('Composition med attester');
if (![...sett.values()].some(r => r.resourceType === 'Encounter' && r.id.startsWith('vt-'))) saknas.push('Encounter för vårdtillfälle');
// Runda 6, r1: NEWS2 som härledd Observation, GCS med komponenter, medvetandegrad som kodat värde och Procedure med KVÅ.
if (!antal.Procedure) saknas.push('Procedure');
for (const [namn, f] of [['NEWS2', (r) => r.id.startsWith('news2-')], ['GCS', (r) => r.code?.text === 'GCS'], ['Medvetandegrad', (r) => r.code?.text === 'Medvetandegrad'], ['eGFR', (r) => r.code?.text === 'eGFR']]) {
  if (![...sett.values()].some(r => r.resourceType === 'Observation' && f(r))) saknas.push(`Observation för ${namn}`);
}
// Runda 6, r5: en prenumeration, ett meddelande med bara id, OperationOutcome för en kvittering som saknas och en lyckad
// skrivning, och resurser som en klient skickar in: en ordination med kvitterad varning och en rättelse med orsak.
const prn = prenumeration.skapa(db, pers('lak-kard'), { resourceType: 'Subscription', reason: 'Regionalt vårddatalager', criteria: 'Observation?patient=p01', channel: { type: 'rest-hook', endpoint: prenumeration.GODKANDA_MOTTAGARE[0], payload: 'application/fhir+json' } });
skriv('Subscription', `Subscription-${prn.id}`, prenumeration.subscription(prn));
skriv('Notis', 'notis-1', prenumeration.meddelande(BAS, prn, { nummer: 1, tid: new Date().toISOString(), handelse: 'ny', fokus: 'Observation/1' }));
skriv('OperationOutcome', 'kvittens-saknas', skrivning.utfall('MedicationRequest', new Fel(400, 'Allvarliga varningar måste kvitteras med motivering innan ordinationen sparas.', 'ogiltig', {
  falt: ['ordinationsorsak'], kraverKvittens: ['dubbel_substans'], varningar: [{ niva: 'allvarlig', regel: 'dubbel_substans', text: 'Patienten har redan en aktiv ordination av warfarin (Waran).' }, { niva: 'observera', regel: 'dubbel_grupp', text: 'Patienten har redan ett läkemedel i samma grupp.' }] })));
skriv('OperationOutcome', 'sparad', skrivning.lyckat('Ordinationen är sparad.', [{ niva: 'observera', text: 'Patienten har redan ett läkemedel i samma grupp.' }]));
skriv('OperationOutcome', 'tas-inte-bort', skrivning.utfall('Composition', new Fel(405, skrivning.TABORT_TEXT, 'ogiltig')));
skriv('Klient', 'MedicationRequest-kvitterad', { resourceType: 'MedicationRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p01' },
  medicationCodeableConcept: { coding: [{ system: 'http://electronichealth.se/fhir/NamingSystem/nplid', code: '19640101000028' }] }, reasonCode: [{ text: 'Förmaksflimmer' }],
  extension: [{ url: `${EXT}/uppfoljningsdatum`, valueDate: '2026-12-03' }, { url: `${EXT}/kvitterad-varning`, extension: [{ url: 'regel', valueCode: 'dubbel_substans' }, { url: 'motivering', valueString: 'Byte av förpackning.' }] }] });
skriv('Klient', 'Composition-rattelse', { resourceType: 'Composition', status: 'final', type: { text: 'Daganteckning' }, subject: { reference: 'Patient/p01' }, date: new Date().toISOString(),
  author: [{ reference: 'Practitioner/lak-kard' }], title: 'Daganteckning', extension: [{ url: `${EXT}/rattelseorsak`, valueString: 'Fel i första meningen.' }],
  section: [{ title: 'Aktuellt', text: { status: 'generated', div: '<div xmlns="http://www.w3.org/1999/xhtml">Mår bättre.</div>' } }] });
skriv('Klient', 'Observation-blodtryck', { resourceType: 'Observation', status: 'final', subject: { reference: 'Patient/p01' }, effectiveDateTime: new Date().toISOString(),
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }], code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
  component: [{ code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 131, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } },
    { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: 84, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }] });
if (saknas.length) { console.error(`Resurstyper som inte kom med i utskriften: ${saknas.join(', ')}`); process.exit(1); }
