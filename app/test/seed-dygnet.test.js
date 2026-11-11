// Runda 11, r1: seeden är relativ till nu, så att journalen, väntrummet och tidboken ser rimliga ut när som helst på
// dygnet. Dagens händelser hamnar på dagens svenska datum, i samma ordning som i seeden, och det som redan har hänt ligger
// före nu. Dagens patienter i tidboken ligger både före och efter nu. Varje test bygger seeden vid fasta tider.
import { describe, test, expect, afterEach } from 'bun:test';
import { byggSeed, lokalTid, datumAv, nySessionsDb, mallen } from '../src/db.js';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { ANKOMNA_5_6 } from '../src/seed/sussa-testdata.js';
import * as labb from '../src/labb.js';
import { atk, personal } from './hjalp.js';

afterEach(() => aterstallKlockan());

// Torsdag 12 november 2026 vid de klockslag som har fällt tester, och en söndag.
const TIDER = [['2026-11-12', '00:30'], ['2026-11-12', '01:15'], ['2026-11-12', '05:00'], ['2026-11-12', '09:30'],
  ['2026-11-12', '12:00'], ['2026-11-12', '23:30'], ['2026-11-15', '00:05'], ['2026-11-15', '23:55']];

describe('Seeden över dygnet (runda 11, r1)', () => {
  for (const [datum, klocka] of TIDER) {
    test(`dagens mätvärden och anteckningar ligger i dag, före nu och i seedens ordning (${datum} ${klocka})`, () => {
      const bas = new Date(lokalTid(datum, klocka));
      const db = byggSeed(bas);
      const idag = datumAv(bas);
      // p01: dagens puls, vikt och syremättnad (klockan 07.00 och 08.00 i seeden). p17, med reservnummer: puls 03.00 och 06.00.
      // Seeden lägger dem i tidsordning, och ordningen ska finnas kvar med olika tider, också när natten trycker ihop dem.
      for (const [pid, typ] of [['p01', 'puls'], ['p01', 'vikt'], ['p01', 'saturation'], ['p17', 'puls']]) {
        const rader = db.query('SELECT tid FROM matvarden WHERE patient_id = ? AND typ = ? ORDER BY id').all(pid, typ).map(r => r.tid);
        expect(rader.length).toBeGreaterThan(0);
        for (let i = 1; i < rader.length; i++) expect([pid, typ, i, rader[i - 1] < rader[i]]).toEqual([pid, typ, i, true]);
        expect(datumAv(new Date(rader.at(-1)))).toBe(idag);
        expect(Date.parse(rader.at(-1))).toBeLessThan(bas.getTime());
      }
      for (const a of db.query('SELECT skapad FROM anteckningar').all()) expect(Date.parse(a.skapad)).toBeLessThanOrEqual(bas.getTime());
      // Väntrummet på akuten: alla kom i dag, före nu, och i den ordning som seeden säger (90, 40 och 20 minuter sedan).
      const vr = db.query('SELECT ankomst FROM vantrum ORDER BY konummer').all().map(r => r.ankomst);
      expect(vr.length).toBe(3);
      for (const t of vr) {
        expect(datumAv(new Date(t))).toBe(idag);
        expect(Date.parse(t)).toBeLessThan(bas.getTime());
      }
      expect(vr[0] < vr[1] && vr[1] < vr[2]).toBe(true);
    });
  }

  for (const [datum, klocka] of [['2026-11-12', '00:30'], ['2026-11-12', '01:15'], ['2026-11-12', '12:00'], ['2026-11-12', '23:30'], ['2026-11-12', '23:50']]) {
    // Tiderna ligger på hela fem minuter, så 23.50 är den sista tiden då en tid efter nu ryms före midnatt.
    test(`dagens patienter i tidboken ligger i dag, några före och några efter nu (${datum} ${klocka})`, () => {
      const nu = new Date(lokalTid(datum, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      const idag = datumAv(nu);
      const dagens = db.query('SELECT t.start, t.slut, b.incheckad FROM tider t JOIN bokningar b ON b.tid_id = t.id WHERE t.relativ = 1').all();
      expect(dagens.length).toBe(3);
      for (const d of dagens) {
        expect(datumAv(new Date(d.start))).toBe(idag);
        if (d.incheckad) {
          expect(datumAv(new Date(d.incheckad))).toBe(idag);
          expect(Date.parse(d.incheckad)).toBeLessThanOrEqual(nu.getTime());
        }
      }
      expect(dagens.some(d => Date.parse(d.start) < nu.getTime())).toBe(true);
      expect(dagens.some(d => Date.parse(d.start) > nu.getTime())).toBe(true);
      // De lediga tiderna i dag ligger också i dag.
      for (const t of db.query('SELECT start FROM tider t WHERE t.relativ = 1 AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id)').all()) {
        expect(datumAv(new Date(t.start))).toBe(idag);
      }
      db.close();
    });
  }

  for (const klocka of ['00:20', '00:38', '01:15', '02:40', '12:00']) {
    test(`Sussas testdata: patienterna som har kommit till vårdcentralen kom i dag före nu, och Hamid Burvall får paketet vid feber (${klocka})`, () => {
      const nu = new Date(lokalTid('2026-11-12', klocka));
      stallKlockan(nu);
      const db = byggSeed(nu);
      laddaTestdata(db, personal(db, 'lak-vc'), { nu });
      const ph = ANKOMNA_5_6.map(() => '?').join(', ');
      const rader = db.query(`SELECT v.patient_id, v.start, v.ankomst FROM vardkontakter v JOIN bokningar b ON b.vardkontakt_id = v.id
        WHERE v.patient_id IN (${ph}) AND v.enhet_id = 'vc-tybble' AND b.status = 'incheckad'`).all(...ANKOMNA_5_6);
      const per = ANKOMNA_5_6.map(pid => rader.find(r => r.patient_id === pid));
      for (const r of per) {
        expect(datumAv(new Date(r.ankomst))).toBe('2026-11-12');
        expect(Date.parse(r.ankomst)).toBeLessThan(Date.parse(r.start));
        expect(Date.parse(r.start)).toBeLessThan(nu.getTime());
      }
      for (let i = 1; i < per.length; i++) expect(per[i - 1].start < per[i].start).toBe(true);
      const p = db.query("SELECT * FROM patienter WHERE id = 'sus19'").get();
      expect(labb.forslag(atk(db, 'lak-vc', 'sus19', {}, 'bestalla_prov'), p, nu).paket.map(x => x.id)).toContain('feber');
    });
  }

  test('mallen byggs om när den är mer än 30 minuter gammal, så att seeden följer klockan under dagen', () => {
    stallKlockan(new Date(lokalTid('2026-11-12', '00:10')));
    const a = mallen();
    stallKlockan(new Date(lokalTid('2026-11-12', '00:30')));
    expect(mallen()).toBe(a);
    stallKlockan(new Date(lokalTid('2026-11-12', '00:45')));
    expect(mallen()).not.toBe(a);
  });
});
