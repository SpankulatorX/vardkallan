// Skriver alla FHIR-resurser som demorollerna når, med alla val gjorda, till katalogen i första argumentet:
// en underkatalog per resurstyp och def/ med Vårdkällans egna definitioner. Se docs/fhir-validering.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import * as fhir from '../../app/src/fhir.js';
import { nySessionsDb } from '../../app/src/db.js';

const UT = process.argv[2];
if (!UT) { console.error('Ange en utkatalog.'); process.exit(2); }
const BAS = 'http://127.0.0.1:18798';
const db = nySessionsDb();
const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const fraga = (roll, vag, val = {}) => fhir.hantera({ db, personal: roll ? pers(roll) : null, valFor: (p) => val[p] ?? {}, url: new URL(BAS + vag), base: BAS }).body;
const skriv = (katalog, namn, r) => { mkdirSync(`${UT}/${katalog}`, { recursive: true }); writeFileSync(`${UT}/${katalog}/${namn}.json`, JSON.stringify(r, null, 1)); };

const sett = new Map();
const lagg = (b) => { for (const e of b.entry ?? []) sett.set(`${e.resource.resourceType}/${e.resource.id}`, e.resource); };
const TYPER = ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Flag', 'ServiceRequest', 'Composition'];
for (const roll of ['lak-kard', 'lak-vc', 'lak-psyk', 'lak-akut']) {
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
for (const t of fhir.DEFINITIONSTYPER) for (const e of fraga(null, `/fhir/${t}`).entry) skriv('def', `${t}-${e.resource.id}`, e.resource);
skriv('CapabilityStatement', 'metadata', fraga(null, '/fhir/metadata'));

const antal = {};
for (const r of sett.values()) { skriv(r.resourceType, `${r.resourceType}-${r.id}`, r); antal[r.resourceType] = (antal[r.resourceType] ?? 0) + 1; }
console.log(JSON.stringify(antal));
