// Runda 13, r3: rättelser från det utforskande testet som inte har en egen testfil. Fyndets nummer står i testnamnet
// (E1, E2 och E3 är testarnas rapporter). Testnamnen används i kravregistret.
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { byggSeed } from '../src/db.js';
import * as journal from '../src/journal.js';
import { atk } from './hjalp.js';

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Fynd från det utforskande testet', () => {
  test('E1-23: bara den som skrev en signerad anteckning kan rätta den, och andra får veta att de skriver en ny anteckning', () => {
    const db = byggSeed();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Mår bra.' }] });
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id));
    const rattelse = { orsak: 'Fel dag', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre.' }] };
    // Överläkaren på samma klinik kan inte rätta kollegans anteckning.
    const e = fel(() => journal.ratta(atk(db, 'ol-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Bara Sara Lindqvist kan rätta anteckningen');
    expect(e.message).toContain('ny anteckning');
    // Den som skrev den kan.
    expect(journal.ratta(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse).version).toBe(2);
  });

  test('E1-26: hjälptexten i Sök patient visar inte personnumret för någon patient i demon', () => {
    const db = byggSeed();
    const text = readFileSync(new URL('../public/js/vyer/sok.js', import.meta.url), 'utf8');
    for (const p of db.query('SELECT personnummer FROM patienter').all()) {
      const pnr = p.personnummer;
      expect(text).not.toContain(pnr);
      expect(text).not.toContain(`${pnr.slice(0, 8)}-${pnr.slice(8)}`);
    }
  });
});
