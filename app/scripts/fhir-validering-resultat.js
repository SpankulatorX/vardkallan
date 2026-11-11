// Runda 12, r2 (vårt D9): skriver fhir-validering.json ur HL7-validatorns utdata (ut-*.json från
// test/fhir-validering/validera.sh), med antal resurser, fel och varningar per resurstyp och en hash av koden som bygger
// FHIR-resurserna. Kravregistret räknar resultatet bara när hashen stämmer med den kod som byggs (klientresultat.js).
//   bun scripts/fhir-validering-resultat.js <katalog med ut-*.json> [validatorns version]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fhirKodHash } from '../src/klientresultat.js';

const DIR = process.argv[2];
const VALIDATOR = process.argv[3] || 'HL7 FHIR Validation tool 7.0.3';
if (!DIR) { console.error('Ange katalogen med validatorns utdata.'); process.exit(2); }
const KRAVDA = ['MedicationAdministration', 'List', 'Patient', 'MedicationRequest', 'Observation', 'Condition'];

const per = {};
const filer = readdirSync(DIR).filter(f => /^ut-.*\.json$/.test(f));
if (!filer.length) { console.error('Ingen utdata från validatorn.'); process.exit(1); }
for (const f of filer) {
  const d = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const oos = d.resourceType === 'Bundle' ? (d.entry ?? []).map(e => e.resource) : [d];
  for (const oo of oos) {
    const fil = (oo.extension ?? []).find(x => x.url.endsWith('operationoutcome-file'))?.valueString ?? '?/?';
    const typ = basename(dirname(fil)) || '?';
    const p = (per[typ] ??= { resurser: 0, fel: 0, varningar: 0 });
    p.resurser++;
    for (const i of oo.issue ?? []) {
      if (['error', 'fatal'].includes(i.severity)) p.fel++;
      else if (i.severity === 'warning') p.varningar++;
    }
  }
}
const summa = (k) => Object.values(per).reduce((s, p) => s + p[k], 0);
const saknas = KRAVDA.filter(t => !per[t]?.resurser);
const fel = summa('fel');
const { hash, filer: kodfiler } = fhirKodHash();
const ok = fel === 0 && !saknas.length;
const ut = {
  tid: new Date().toISOString(), validator: VALIDATOR, fhirKodHash: hash, kodfiler,
  resurser: summa('resurser'), fel, varningar: summa('varningar'), saknas, perTyp: per,
  tester: [{ namn: 'FHIR-validering > HL7:s validator ger inga fel för någon resurstyp, också MedicationAdministration och List, i den FHIR-kod som byggs', status: ok ? 'grön' : 'röd' }],
};
writeFileSync(join(import.meta.dir, '..', 'fhir-validering.json'), JSON.stringify(ut, null, 2) + '\n');
console.log(`fhir-validering.json: ${ut.resurser} resurser, ${fel} fel, ${ut.varningar} varningar${saknas.length ? `, saknas: ${saknas.join(', ')}` : ''}`);
