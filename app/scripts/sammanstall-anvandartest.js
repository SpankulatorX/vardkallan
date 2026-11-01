// Sammanställer resultatfilerna från användartestet (D6). Läser JSON-filer eller kopierade textfiler, en per
// deltagare, och skriver en tabell per flöde med median och spridning för steg och tid, andelen som slutförde
// uppgiften, jämförelsen med klickbudgeten och skriptets mätning, och SUS-poängen. Se docs/anvandartest.md.
//
// Användning:
//   bun scripts/sammanstall-anvandartest.js <fil eller katalog> [fler] [--json] [--klickbudget klickbudget.json]
// Utan --klickbudget läses app/klickbudget.json, om den finns. Med --json skrivs sammanställningen som JSON.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { lasResultat, sammanstall, somText } from '../src/anvandartest.js';

const arg = process.argv.slice(2);
const somJson = arg.includes('--json');
const kbIndex = arg.indexOf('--klickbudget');
const kbFil = kbIndex >= 0 ? arg[kbIndex + 1] : join(import.meta.dir, '..', 'klickbudget.json');
const vagar = arg.filter((a, i) => !a.startsWith('--') && (kbIndex < 0 || i !== kbIndex + 1));
if (!vagar.length) {
  console.error('Ange resultatfiler eller en katalog med resultatfiler.');
  process.exit(2);
}

const filer = [];
for (const v of vagar) {
  if (statSync(v).isDirectory()) for (const n of readdirSync(v).sort()) { if (/\.(json|txt)$/i.test(n)) filer.push(join(v, n)); }
  else filer.push(v);
}
const resultat = [];
for (const f of filer) {
  try { resultat.push(lasResultat(readFileSync(f, 'utf8'))); } catch (e) { console.error(`Hoppar över ${f}: ${e.message}`); }
}
if (!resultat.length) {
  console.error('Inga resultatfiler från användartestet hittades.');
  process.exit(1);
}
let skript = null;
try { if (kbFil && existsSync(kbFil)) skript = JSON.parse(readFileSync(kbFil, 'utf8')); } catch { skript = null; }
const s = sammanstall(resultat, { skript });
process.stdout.write(somJson ? `${JSON.stringify(s, null, 2)}\n` : somText(s));
