// Prognosen för lagringens volym och lagringsklasserna (runda 12, r2, Sussa KD1.1.3.5). Tiden skickas in som ett fast
// värde, och testet räknar bara de rader det själv lägger in.
import { describe, test, expect } from 'bun:test';
import { nySessionsDb } from '../src/db.js';
import { prognos } from '../src/lagringsprognos.js';
import * as releaser from '../src/releaser.js';

const NU = new Date('2026-11-11T12:00:00Z');
const DAG = 86400_000;

describe('Lagringsprognos', () => {
  test('prognosen räknar tillväxten det senaste året och skriver fram storleken, också med fördubblad aktivitet', () => {
    const db = nySessionsDb();
    try {
      const fore = prognos(db, { nu: NU });
      const ins = db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES ('p01', 'uso-kard', 'puls', '70', ?, 'prov-prognos')");
      for (let i = 0; i < 500; i++) ins.run(new Date(NU.getTime() - (i % 300) * DAG).toISOString());
      // Rader äldre än ett år och i framtiden räknas inte som tillväxt.
      ins.run(new Date(NU.getTime() - 800 * DAG).toISOString());
      ins.run(new Date(NU.getTime() + 10 * DAG).toISOString());
      const p = prognos(db, { nu: NU });
      expect(p.tillvaxt.rader - fore.tillvaxt.rader).toBe(500);
      expect(p.tillvaxt.byte).toBeGreaterThan(0);
      const [ett, tre, tio] = p.scenarier;
      expect([ett.ar, tre.ar, tio.ar]).toEqual([1, 3, 10]);
      expect(ett.byte).toBe(p.byte + p.tillvaxt.byte);
      expect(tio.byteFordubblad).toBe(p.byte + 20 * p.tillvaxt.byte);
      expect(tio.kopiorByte).toBe(tio.byte * 2);
      // Bara antal och storlekar: inga patientuppgifter i svaret.
      const text = JSON.stringify(p);
      for (const x of db.query('SELECT fornamn, efternamn, personnummer FROM patienter').all()) {
        expect(text.includes(x.personnummer)).toBe(false);
        expect(text.includes(`${x.fornamn} ${x.efternamn}`)).toBe(false);
      }
    } finally { db.close(); }
  });

  test('lagringsklasserna delar upp volymen efter ålder och visar kostnaden per månad med och utan klasser', () => {
    const db = nySessionsDb();
    try {
      const ins = db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES ('p01', 'uso-kard', 'puls', '70', ?, 'prov-prognos')");
      for (let i = 0; i < 200; i++) ins.run(new Date(NU.getTime() - (4 * 365 + i) * DAG).toISOString());
      const p = prognos(db, { nu: NU });
      const [aktuell, aldre] = p.klasser.lista;
      expect(aktuell.id).toBe('aktuell');
      expect(aldre.id).toBe('aldre');
      expect(aldre.flyttEfterAr).toBe(3);
      expect(aldre.byte).toBeGreaterThan(0);
      expect(aktuell.byte + aldre.byte).toBe(p.byte);
      expect(p.klasser.krPerManad).toBeLessThan(p.klasser.krPerManadUtanKlasser);
      // Efter en återgång till förra versionen finns inga lagringsklasser, och prognosen säger det i stället för att fela.
      releaser.tillVersion(db, '1.1.0', releaser.MIGRERINGAR, NU);
      expect(prognos(db, { nu: NU }).klasser).toBeNull();
    } finally { db.close(); }
  });
});
