// Runda 14, r3: databaserna som en testfil skapar stängs när filen är klar, så att hela sviten håller sig inom
// containerns minne (en sandlåda i minnet ligger annars kvar i SQLite tills processen slutar).
// Anropas överst i testfilen: const nyDb = nyDbSomStangs();
import { afterAll } from 'bun:test';
import { nyDb } from './hjalp.js';
import * as r3 from '../src/rivta-r3.js';

export function nyDbSomStangs() {
  const oppna = [];
  afterAll(async () => {
    for (const db of oppna.splice(0)) {
      try { await r3.klart(db); } catch { /* det som pågår får inte hindra stängningen */ }
      try { db.close(); } catch { /* redan stängd */ }
    }
  });
  return () => { const db = nyDb(); oppna.push(db); return db; };
}
