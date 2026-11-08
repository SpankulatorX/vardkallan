// Skriver docs/tillganglighet.md ur tillgänglighetsregistret i src/tillganglighet.js.
// Användning från app/: bun scripts/tillganglighet-md.js [katalog], där katalogen är den som har docs/ (standard: ..).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdown } from '../src/tillganglighet.js';

const fil = join(process.argv[2] ?? join(import.meta.dir, '..', '..'), 'docs', 'tillganglighet.md');
writeFileSync(fil, markdown());
console.log(`Skrev ${fil}`);
