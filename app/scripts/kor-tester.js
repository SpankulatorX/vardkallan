// Kör bun test, skriver test-resultat.json som /api/krav läser och stoppar bygget om något test är rött
// eller om kravregistret pekar på ett test som inte finns.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { KRAV } from '../src/krav.js';
import { lasKlientresultat } from '../src/klientresultat.js';

const rot = join(import.meta.dir, '..');
const xml = join(rot, 'test-resultat.xml');
const proc = Bun.spawnSync(['bun', 'test', '--reporter=junit', `--reporter-outfile=${xml}`], { cwd: rot, stdout: 'inherit', stderr: 'inherit' });

const avkoda = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'");
const attr = (s, namn) => { const m = s.match(new RegExp(`\\s${namn}="([^"]*)"`)); return m ? avkoda(m[1]) : null; };

let text = '';
try { text = readFileSync(xml, 'utf8'); } catch { console.error('Ingen JUnit-rapport skrevs.'); process.exit(1); }
const tester = [];
const stack = [];
let aktuell = null;
for (const m of text.matchAll(/<(\/?)(testsuites|testsuite|testcase|failure|error|skipped)\b([^>]*?)(\/?)>/g)) {
  const [, stang, tagg, attrs, sjalvstangd] = m;
  if (tagg === 'testsuite') {
    if (stang) stack.pop();
    else if (!sjalvstangd) stack.push({ namn: attr(attrs, 'name'), fil: attr(attrs, 'file') });
  } else if (tagg === 'testcase') {
    if (stang) { if (aktuell) tester.push(aktuell); aktuell = null; continue; }
    const grupper = stack.slice(1).map(s => s.namn);
    const t = { namn: [...grupper, attr(attrs, 'name')].join(' > '), fil: stack[0]?.namn ?? null, status: 'grön' };
    if (sjalvstangd) tester.push(t); else aktuell = t;
  } else if ((tagg === 'failure' || tagg === 'error') && aktuell && !stang) aktuell.status = 'röd';
  else if (tagg === 'skipped' && aktuell && !stang) aktuell.status = 'hoppad';
}
try { unlinkSync(xml); } catch { /* ingen fil */ }

// Testerna av gränssnittet körs i Playwright före bygget och följer med som klickbudget.json och klienttest-resultat.json.
const klient = lasKlientresultat({ klickbudget: join(rot, 'klickbudget.json'), klienttester: join(rot, 'klienttest-resultat.json') });
const namn = new Set([...tester, ...klient.tester].map(t => t.namn));
const inaktuella = klient.tester.filter(t => t.status === 'inaktuell').length;
if (inaktuella) console.warn(`${inaktuella} tester av gränssnittet är inaktuella: public/ har ändrats sedan Playwright-testerna kördes.`);
const saknas = [...new Set(KRAV.flatMap(k => k.tester).filter(t => !namn.has(t)))];
const resultat = {
  tid: new Date().toISOString(), bun: Bun.version, antal: tester.length,
  godkanda: tester.filter(t => t.status === 'grön').length, misslyckade: tester.filter(t => t.status === 'röd').length,
  hoppade: tester.filter(t => t.status === 'hoppad').length, tester,
};
writeFileSync(join(rot, 'test-resultat.json'), JSON.stringify(resultat, null, 2));
console.log(`\ntest-resultat.json: ${resultat.godkanda} gröna, ${resultat.misslyckade} röda, ${resultat.hoppade} hoppade av ${resultat.antal}`);
if (saknas.length) {
  console.error(`Kravregistret pekar på tester som inte finns:\n  ${saknas.join('\n  ')}`);
  process.exit(1);
}
if (proc.exitCode !== 0 || resultat.misslyckade > 0 || resultat.antal === 0) process.exit(1);
