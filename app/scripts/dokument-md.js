// Runda 12, r3: skriver docs/behorighetsanalys.md, docs/mdr-bedomning.md och docs/testmetod.md ur registren i src/.
// Användning från app/: bun scripts/dokument-md.js [katalog], där katalogen är den som har docs/ (standard: ..).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdown as behorighet } from '../src/behorighetsanalys.js';
import { markdown as mdr } from '../src/mdr-bedomning.js';
import { markdown as testmetod } from '../src/testmetod.js';
// Runda 14, r4 (Sussa 3.6.1.3): gränssnitten för informationsutbyte (gransnitt-utbyte.js).
import { markdown as gransnitt } from '../src/gransnitt-utbyte.js';

const rot = process.argv[2] ?? join(import.meta.dir, '..', '..');
const DOKUMENT = [['behorighetsanalys.md', behorighet()], ['mdr-bedomning.md', mdr()], ['testmetod.md', testmetod()]];
// Runda 14, r4.
DOKUMENT.push(['gransnitt.md', gransnitt()]);
for (const [namn, md] of DOKUMENT) {
  const fil = join(rot, 'docs', namn);
  writeFileSync(fil, md);
  console.log(`Skrev ${fil}`);
}
