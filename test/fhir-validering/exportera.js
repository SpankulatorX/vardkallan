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

const sett = new Map();
const lagg = (b) => { for (const e of b.entry ?? []) sett.set(`${e.resource.resourceType}/${e.resource.id}`, e.resource); };
// Alla patientresurser i fhir.js och bokningarna i tidbok-fhir.js. Kontrollen sist i filen gör körningen röd om en
// resurstyp som API:t kan lämna ut inte kom med, så att listan följer med när en ny resurstyp tillkommer.
const TYPER = ['Patient', 'Encounter', 'EpisodeOfCare', 'Condition', 'Observation', 'MedicationRequest', 'MedicationAdministration', 'List',
  'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition', 'Appointment'];
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
if (saknas.length) { console.error(`Resurstyper som inte kom med i utskriften: ${saknas.join(', ')}`); process.exit(1); }
