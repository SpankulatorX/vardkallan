// Jämför who2007-tillvaxt.js med WHO:s anthroplus-tabeller (GPL-3.0). Användning: node jamfor_anthroplus.mjs RESEARCHKATALOG
import { readFileSync } from 'node:fs';
const rot = process.argv[2];
const m = await import(rot + '/who2007-tillvaxt.js');
const filer = { bmi: 'bfawho2007', langd: 'hfawho2007', vikt: 'wfawho2007' };
let fel = 0, antal = 0;
for (const [matt, f] of Object.entries(filer)) {
  const rader = readFileSync(`${rot}/original/anthroplus-${f}.txt`, 'utf8').trim().split('\n').slice(1).map((r) => r.split('\t').map(Number));
  const { fran, till } = m.WHO2007_INTERVALL[matt];
  for (const [sex, age, l, mm, s] of rader) {
    if (age < fran || age > till) continue;
    const v = m.WHO2007_LMS[matt][sex === 1 ? 'M' : 'K'][age - fran];
    antal++;
    if (Math.abs(v[0] - l) > 1e-9 || Math.abs(v[1] - mm) > 1e-9 || Math.abs(v[2] - s) > 1e-9) { fel++; if (fel < 10) console.log(matt, sex, age, v, [l, mm, s]); }
  }
  console.log(matt, 'anthroplus-åldrar', rader[0][1], 'till', rader.at(-1)[1]);
}
console.log('jämförda rader', antal, 'avvikelser', fel);
