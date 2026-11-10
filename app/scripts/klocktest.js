// Runda 11, r1: kör hela servertestsviten med falsk klocka vid en lista med tider och skriver vilka tester som faller
// vid vilken tid. Klockan sätts av test/falsk-klocka.js (preload) från miljövariabeln FALSK_NU.
//
//   bun scripts/klocktest.js                    alla tider, en i taget
//   bun scripts/klocktest.js --urval            urvalet som GitHub Actions kör
//   bun scripts/klocktest.js --tid vardag-0030  en eller flera tider (namnen i TIDER, kommaseparerade)
//   bun scripts/klocktest.js --parallellt 3     tre körningar samtidigt
//   bun scripts/klocktest.js --tz Europe/Stockholm   processens tidszon (som i driften), annars den som är satt
//   bun scripts/klocktest.js --lista            skriver tiderna och avslutar
//   bun scripts/klocktest.js -- test/tidbok.test.js  allt efter -- går till bun test (till exempel några filer)
//
// Resultatet skrivs också som JSON till .testtmp-klocktest/resultat.json. Avslutas med 1 om något test är rött
// vid någon tid, eller om en körning inte gav någon rapport.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tolkaJunit } from './junit-tolkning.js';

const rot = join(import.meta.dir, '..');

// Svensk lokaltid till UTC. Samma räkning som lokalTid i src/db.js, här utan att läsa in seeden.
function svensk(datum, klocka) {
  const [y, m, d] = datum.split('-').map(Number);
  const [h, mi] = klocka.split(':').map(Number);
  const forskjutning = (ms) => Date.parse(new Date(ms).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T') + 'Z') - ms;
  const gissning = Date.UTC(y, m - 1, d, h, mi);
  const utc = gissning - forskjutning(gissning - forskjutning(gissning));
  return new Date(utc).toISOString();
}

// Tiderna. En vardag (torsdag) och en söndag vid sju klockslag, omställningarna till sommartid och vintertid, nyår och
// skottdagen. Vid omställningen till vintertid finns klockan 02.30 två gånger; den anges därför i UTC.
const KLOCKSLAG = ['23:30', '00:30', '01:15', '02:30', '05:00', '12:00', '21:59'];
const dag = (prefix, datum, beskrivning) => KLOCKSLAG.map(k => ({
  namn: `${prefix}-${k.replace(':', '')}`, nu: svensk(datum, k), beskrivning: `${beskrivning} ${k.replace(':', '.')}`,
}));
export const TIDER = [
  ...dag('vardag', '2026-11-12', 'torsdag 12 november 2026'),
  ...dag('sondag', '2026-11-15', 'söndag 15 november 2026'),
  { namn: 'sommartid-fore', nu: svensk('2027-03-28', '01:30'), beskrivning: 'söndag 28 mars 2027 01.30, före omställningen till sommartid' },
  { namn: 'sommartid-efter', nu: svensk('2027-03-28', '03:30'), beskrivning: 'söndag 28 mars 2027 03.30, efter omställningen till sommartid' },
  { namn: 'vintertid-fore', nu: svensk('2026-10-25', '01:30'), beskrivning: 'söndag 25 oktober 2026 01.30 sommartid, före omställningen till vintertid' },
  { namn: 'vintertid-0230-sommar', nu: '2026-10-25T00:30:00.000Z', beskrivning: 'söndag 25 oktober 2026 02.30 sommartid (första gången)' },
  { namn: 'vintertid-0230-vinter', nu: '2026-10-25T01:30:00.000Z', beskrivning: 'söndag 25 oktober 2026 02.30 vintertid (andra gången)' },
  { namn: 'vintertid-efter', nu: svensk('2026-10-25', '03:30'), beskrivning: 'söndag 25 oktober 2026 03.30, efter omställningen till vintertid' },
  { namn: 'nyarsafton-2330', nu: svensk('2026-12-31', '23:30'), beskrivning: 'nyårsafton 2026 23.30' },
  { namn: 'nyarsdagen-0030', nu: svensk('2027-01-01', '00:30'), beskrivning: 'nyårsdagen 2027 00.30' },
  { namn: 'skottdag-0030', nu: svensk('2028-02-29', '00:30'), beskrivning: 'skottdagen 29 februari 2028 00.30' },
  { namn: 'skottdag-1200', nu: svensk('2028-02-29', '12:00'), beskrivning: 'skottdagen 29 februari 2028 12.00' },
];
// Urvalet för GitHub Actions: de tider som har fällt tester förut, och ett av varje slag av kalenderfall.
export const URVAL = ['vardag-2330', 'vardag-0030', 'vardag-0115', 'sondag-1200', 'vintertid-0230-vinter', 'nyarsdagen-0030', 'skottdag-0030'];

function argument(argv) {
  const a = { tider: null, parallellt: 1, tz: null, lista: false, extra: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--') { a.extra = argv.slice(i + 1); break; }
    if (x === '--urval') a.tider = URVAL;
    else if (x === '--tid') a.tider = String(argv[++i] ?? '').split(',').filter(Boolean);
    else if (x === '--parallellt') a.parallellt = Math.max(1, Number(argv[++i]) || 1);
    else if (x === '--tz') a.tz = argv[++i];
    else if (x === '--lista') a.lista = true;
    else throw new Error(`Okänt argument: ${x}`);
  }
  return a;
}

async function korVid(tid, { tz, extra, katalog }) {
  const xml = join(katalog, `${tid.namn}.xml`);
  const env = { ...process.env, FALSK_NU: tid.nu };
  if (tz) env.TZ = tz;
  const start = performance.now();
  const proc = Bun.spawn(['bun', 'test', '--preload', './test/falsk-klocka.js', '--reporter=junit', `--reporter-outfile=${xml}`, ...extra],
    { cwd: rot, env, stdout: 'pipe', stderr: 'pipe' });
  const [, fel] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  let tester = [];
  try { tester = tolkaJunit(readFileSync(xml, 'utf8')); } catch { /* ingen rapport */ }
  const roda = tester.filter(t => t.status === 'röd').map(t => ({ namn: t.namn, fil: t.fil }));
  // Felutskriften för de röda testerna, så att orsaken syns utan en ny körning.
  const utdrag = roda.length ? fel.split('\n').filter(r => /^\(fail\)|error:|Expected|Received/.test(r.trim())).slice(0, 40) : [];
  return { ...tid, antal: tester.length, roda, utdrag, exitkod: proc.exitCode, sekunder: Math.round((performance.now() - start) / 1000) };
}

if (import.meta.main) {
  const a = argument(Bun.argv.slice(2));
  if (a.lista) {
    for (const t of TIDER) console.log(`${t.namn.padEnd(24)} ${t.nu}  ${t.beskrivning}${URVAL.includes(t.namn) ? '  (urval)' : ''}`);
    process.exit(0);
  }
  const valda = a.tider ? a.tider.map(n => TIDER.find(t => t.namn === n) ?? (() => { throw new Error(`Okänd tid: ${n}`); })()) : TIDER;
  const katalog = join(rot, '.testtmp-klocktest');
  mkdirSync(katalog, { recursive: true });
  const resultat = [];
  const ko = [...valda];
  const arbetare = Array.from({ length: Math.min(a.parallellt, ko.length) }, async () => {
    while (ko.length) {
      const tid = ko.shift();
      const r = await korVid(tid, { tz: a.tz, extra: a.extra, katalog });
      resultat.push(r);
      const status = r.antal === 0 ? 'INGEN RAPPORT' : r.roda.length ? `${r.roda.length} röda` : 'grön';
      console.log(`${r.namn.padEnd(24)} ${r.nu}  ${String(r.antal).padStart(5)} tester  ${status}  (${r.sekunder} s)`);
      for (const t of r.roda) console.log(`    röd: ${t.fil} > ${t.namn}`);
    }
  });
  await Promise.all(arbetare);
  const ordning = (r) => valda.findIndex(t => t.namn === r.namn);
  resultat.sort((x, y) => ordning(x) - ordning(y));
  // Per test: vid vilka tider det faller.
  const perTest = new Map();
  for (const r of resultat) for (const t of r.roda) {
    const nyckel = `${t.fil} > ${t.namn}`;
    if (!perTest.has(nyckel)) perTest.set(nyckel, []);
    perTest.get(nyckel).push(r.namn);
  }
  console.log('');
  if (perTest.size) {
    console.log('Tester som faller, och vid vilka tider:');
    for (const [namn, tider] of perTest) console.log(`  ${namn}\n      ${tider.join(', ')}`);
  } else console.log(`Alla tester gröna vid ${resultat.length} tider.`);
  writeFileSync(join(katalog, 'resultat.json'), JSON.stringify({ tz: a.tz ?? process.env.TZ ?? null, bun: Bun.version, resultat }, null, 2));
  for (const r of resultat) rmSync(join(katalog, `${r.namn}.xml`), { force: true });
  const fel = resultat.some(r => r.antal === 0 || r.roda.length || r.exitkod !== 0);
  process.exit(fel ? 1 : 0);
}
