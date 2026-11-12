// Runda 14, r4 (Sussa 11.2.1.7): skriver docs/testprotokoll.md ur kravregistret, Sussa-registret och resultaten från
// det senaste bygget (test-resultat.json från scripts/kor-tester.js och gränssnittens resultatfiler i app/).
// Användning från app/, efter kor-tester.js och gränssnittstesterna: bun scripts/testprotokoll-md.js [katalog], där
// katalogen är den som har docs/ (standard: ..).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { franFiler, markdown } from '../src/testprotokoll.js';

const app = join(import.meta.dir, '..');
const rot = process.argv[2] ?? join(app, '..');
const p = franFiler({
  testresultat: join(app, 'test-resultat.json'),
  klientresultat: { klickbudget: join(app, 'klickbudget.json'), klienttester: join(app, 'klienttest-resultat.json'), sussatestfall: join(app, 'sussa-testfall.json'),
    lasttest: join(app, 'lasttest.json'), fhirvalidering: join(app, 'fhir-validering.json') },
});
if (!p.version.testkorning) console.warn('Det finns ingen test-resultat.json. Kör bun scripts/kor-tester.js först, annars står varje servertest som inte kört.');
const fil = join(rot, 'docs', 'testprotokoll.md');
writeFileSync(fil, markdown(p));
console.log(`Skrev ${fil}: ${p.summa.krav} krav och poster med ${p.summa.testfall} testfall, ${p.summa.status['grön']} godkända.`);
