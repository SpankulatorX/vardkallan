// Runda 14, r5: instruktionsfilmerna (instruktionsfilmer.js, Sussa 11.2.1.4 och 10.1.1.3). Filmerna spelas in av
// test/instruktionsfilmer.cjs och ligger i docs/filmer/. I Docker-bygget finns bara app/, och då prövas registret.
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FILMER, filmer, MAX_BYTE } from '../src/instruktionsfilmer.js';
import { FLODEN } from '../src/klickbudget.js';

const ROT = join(import.meta.dir, '..', '..');
const KATALOG = join(ROT, 'docs', 'filmer');

describe('Instruktionsfilmer', () => {
  test('varje instruktionsfilm är ett flöde i klickbudgeten, och filmerna täcker läkaren, sjuksköterskan, undersköterskan, vårdadministratören, invånaren och systemförvaltaren', () => {
    const f = filmer();
    expect(f.length).toBe(FILMER.length);
    expect(new Set(f.map(x => x.id)).size).toBe(f.length);
    for (const x of f) {
      expect(FLODEN.some(fl => fl.id === x.flode), x.id).toBe(true);
      expect(x.beskrivning.length, x.id).toBeGreaterThan(40);
      expect(/[—–…]/.test(x.rubrik + x.beskrivning), x.id).toBe(false);
    }
    const roller = new Set(f.map(x => x.roll));
    for (const r of ['lak-kard', 'ssk-kard', 'usk-kard', 'adm-kard', 'sysf']) expect(roller.has(r), r).toBe(true);
    expect([...roller].some(r => r.startsWith('inv-'))).toBe(true);
  });

  test('skriptet som spelar in filmerna finns i repot, och varje film i docs/filmer/ är en WebM på högst 2 MB', () => {
    const skript = join(ROT, 'test', 'instruktionsfilmer.cjs');
    // I Docker-bygget finns bara app/. Filmerna och skriptet prövas när repot är monterat.
    if (!existsSync(join(ROT, 'test'))) return;
    expect(existsSync(skript)).toBe(true);
    expect(readFileSync(skript, 'utf8')).toContain('recordVideo');
    expect(existsSync(KATALOG)).toBe(true);
    const filer = readdirSync(KATALOG).filter(n => n.endsWith('.webm')).sort();
    expect(filer).toEqual(FILMER.map(x => `${x.id}.webm`).sort());
    for (const n of filer) {
      const b = readFileSync(join(KATALOG, n));
      expect(b.subarray(0, 4).toString('hex'), n).toBe('1a45dfa3');
      expect(statSync(join(KATALOG, n)).size, n).toBeLessThanOrEqual(MAX_BYTE);
      expect(statSync(join(KATALOG, n)).size, n).toBeGreaterThan(20_000);
    }
  });
});
