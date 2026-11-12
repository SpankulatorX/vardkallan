// Runda 13, r4: mottagningarnas och operationsavdelningens arbetsdag ligger på dagtid oavsett när sandlådan skapas.
// Slutenvården och akuten går dygnet runt. På kvällen är dagens arbete gjort och nästa arbetsdag är planerad, och på
// natten väntas dagens patienter. Varje test ställer klockan, så att resultatet inte beror på när sviten körs.
import { describe, test, expect, afterEach } from 'bun:test';
import { lokalTid, datumAv, addDagar, nySessionsDb, arbetsdagensMitt, ARBETSDAG } from '../src/db.js';
import * as tidbok from '../src/tidbok.js';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { personal } from './hjalp.js';
import * as op from '../src/operation.js';
import * as opSeed from '../src/operation-seed.js';
import { sandlada as specialistSandlada } from './specialist.js';

afterEach(() => aterstallKlockan());

const TORSDAG = '2026-11-12';
const ms = (datum, klocka) => Date.parse(lokalTid(datum, klocka));
const dagens = (db) => db.query(`SELECT b.*, t.start, t.slut AS tid_slut, t.tidstyp, t.schema_id FROM bokningar b JOIN tider t ON t.id = b.tid_id
  WHERE t.relativ = 1 ORDER BY t.start`).all();

describe('Arbetsdagen på mottagningarna (runda 13, r4)', () => {
  test('arbetsdagens mitt är nu mitt på dagen, 08.30 på natten och morgonen och 14.30 på eftermiddagen och kvällen', () => {
    expect(arbetsdagensMitt(new Date(ms(TORSDAG, '02:00')))).toBe(ms(TORSDAG, ARBETSDAG.mittTidigast));
    expect(arbetsdagensMitt(new Date(ms(TORSDAG, '12:00')))).toBe(ms(TORSDAG, '12:00'));
    expect(arbetsdagensMitt(new Date(ms(TORSDAG, '21:00')))).toBe(ms(TORSDAG, ARBETSDAG.mittSenast));
    expect(arbetsdagensMitt(new Date(ms(TORSDAG, '23:59')))).toBe(ms(TORSDAG, ARBETSDAG.mittSenast));
  });

  for (const klocka of ['00:30', '02:30', '05:00', '07:45', '12:00', '16:45', '20:55', '23:30']) {
    test(`dagens tider på mottagningarna ligger mellan 07.30 och 16.30 (${klocka})`, () => {
      const nu = new Date(lokalTid(TORSDAG, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      const rader = dagens(db);
      expect(rader.length).toBeGreaterThan(3);
      for (const r of rader) {
        expect(datumAv(new Date(r.start))).toBe(TORSDAG);
        expect(Date.parse(r.start)).toBeGreaterThanOrEqual(ms(TORSDAG, ARBETSDAG.oppnar));
        expect(Date.parse(r.start)).toBeLessThanOrEqual(ms(TORSDAG, ARBETSDAG.stanger));
        // Ingen har checkat in före nu eller efter sin tid plus en timme.
        if (r.incheckad) expect(Date.parse(r.incheckad)).toBeLessThanOrEqual(nu.getTime());
      }
      // Lediga tider i dag ligger också på dagtid.
      for (const t of db.query('SELECT start FROM tider WHERE relativ = 1').all()) {
        expect(Date.parse(t.start)).toBeGreaterThanOrEqual(ms(TORSDAG, ARBETSDAG.oppnar));
        expect(Date.parse(t.start)).toBeLessThanOrEqual(ms(TORSDAG, ARBETSDAG.stanger));
      }
      db.close();
    });
  }

  for (const klocka of ['17:30', '20:55', '23:30']) {
    test(`på kvällen har dagens patienter varit där, och de som checkade in har ett avslutat besök (${klocka})`, () => {
      const nu = new Date(lokalTid(TORSDAG, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      const rader = dagens(db);
      for (const r of rader) expect(Date.parse(r.start)).toBeLessThan(nu.getTime());
      // Leo Bergström och Karl-Erik Brandt checkade in. Leos besök var avgiftsfritt och Karl-Erik betalade med kort när han kom.
      const leo = rader.find(r => r.patient_id === 'p09');
      const karlErik = rader.find(r => r.patient_id === 'p10');
      expect(leo.status).toBe('incheckad');
      expect(karlErik.status).toBe('incheckad');
      for (const b of [leo, karlErik]) {
        const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
        expect(v.slut).toBe(b.tid_slut);
        const bet = db.query('SELECT * FROM betalningar WHERE bokning_id = ?').get(b.id);
        expect(bet.tid).toBe(b.incheckad);
      }
      expect(db.query('SELECT satt FROM betalningar WHERE bokning_id = ?').get(karlErik.id).satt).toBe('kort');
      // Ahmed Hassan och David Nordin har ingen registrerad ankomst. Dagens arbete säger det och låter
      // vårdadministratören registrera ankomsten i efterhand.
      const s = tidbok.startsida(db, personal(db, 'adm-kard'));
      for (const pid of ['p08', 'p15']) {
        const rad = s.dagens.find(d => d.patient.id === pid).rad;
        expect(rad.status).toMatch(/^Ankomsten är inte registrerad\. Tiden var \d{2}\.\d{2}$/);
        expect(rad.atgard).toEqual({ typ: 'checka_in', text: 'Registrera ankomsten' });
      }
      db.close();
    });
  }

  test('en ankomst som registreras i efterhand räknas från den bokade tiden', () => {
    const nu = new Date(lokalTid(TORSDAG, '20:55'));
    stallKlockan(nu);
    const db = nySessionsDb();
    const ahmed = dagens(db).find(r => r.patient_id === 'p08');
    const ut = tidbok.checkaInRad(db, tidbok.bokningRad(db, ahmed.id), 'personal', { av: 'adm-kard' });
    expect(ut.incheckad).toBe(ahmed.start);
    expect(db.query('SELECT ankomst FROM vardkontakter WHERE id = ?').get(ahmed.vardkontakt_id).ankomst).toBe(ahmed.start);
    db.close();
  });

  for (const klocka of ['00:30', '02:30', '05:00']) {
    test(`på natten väntas dagens patienter, och ingen har checkat in (${klocka})`, () => {
      const nu = new Date(lokalTid(TORSDAG, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      for (const r of dagens(db)) {
        expect(Date.parse(r.start)).toBeGreaterThan(nu.getTime());
        expect(r.status).toBe('bokad');
        expect(r.incheckad).toBeNull();
      }
      expect(db.query('SELECT count(*) AS n FROM betalningar b JOIN bokningar k ON k.id = b.bokning_id JOIN tider t ON t.id = k.tid_id WHERE t.relativ = 1').get().n).toBe(0);
      db.close();
    });
  }

  test('mitt på dagen har några patienter kommit och några väntas', () => {
    const nu = new Date(lokalTid(TORSDAG, '12:00'));
    stallKlockan(nu);
    const db = nySessionsDb();
    const rader = dagens(db);
    expect(rader.some(r => Date.parse(r.start) < nu.getTime())).toBe(true);
    expect(rader.some(r => Date.parse(r.start) > nu.getTime())).toBe(true);
    expect(rader.find(r => r.patient_id === 'p09').status).toBe('incheckad');
    expect(rader.find(r => r.patient_id === 'p10').status).toBe('bokad');
    db.close();
  });

  for (const [datum, klocka] of [[TORSDAG, '20:55'], [TORSDAG, '10:00'], ['2026-11-11', '20:50'], ['2026-11-15', '12:00']]) {
    test(`distriktsläkarens tidbok har bokade patienter i dag på vardagar och nästa arbetsdag (${datum} ${klocka})`, () => {
      const nu = new Date(lokalTid(datum, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      const per = personal(db, 'lak-vc');
      const bokade = (d) => tidbok.tidbok(db, per, { datum: d }).scheman.flatMap(s => s.tider).flatMap(t => t.bokningar ?? []);
      const veckodag = new Date(`${datum}T12:00:00Z`).getUTCDay();
      if (veckodag >= 1 && veckodag <= 5) expect(bokade(datum).length).toBeGreaterThanOrEqual(2);
      let nasta = addDagar(datum, 1);
      while ([0, 6].includes(new Date(`${nasta}T12:00:00Z`).getUTCDay())) nasta = addDagar(nasta, 1);
      expect(bokade(nasta).length).toBeGreaterThanOrEqual(2);
      db.close();
    });
  }

  // Operationerna i Karlskoga: Göran Lindell klockan 07.30 och Barbro Sjödin klockan 10.00.
  const opStatus = (klocka) => {
    const bas = new Date(lokalTid(TORSDAG, klocka));
    const db = specialistSandlada(bas);
    opSeed.seeda(db, bas);
    const o = op.oversikt(db, personal(db, 'opk-kkoga'), () => ({}), { datum: TORSDAG }, bas);
    const ops = o.salar.find(s => s.id === 'kkoga-sal-1').operationer;
    return { db, ops, status: Object.fromEntries(ops.map(x => [x.patient.id, x.status])) };
  };
  for (const klocka of ['00:30', '05:00']) {
    test(`operationsprogrammet: på natten väntar dagens operationer och ingen är försenad (${klocka})`, () => {
      const { ops, status } = opStatus(klocka);
      expect(status).toEqual({ p71: 'planerad', p72: 'planerad' });
      expect(ops.some(x => x.forsenad)).toBe(false);
    });
  }
  test('operationsprogrammet: mitt på förmiddagen är den första operationen gjord eller pågår och den andra väntar', () => {
    const { ops, status } = opStatus('09:00');
    expect(['pagar', 'uppvak']).toContain(status.p71);
    expect(status.p72).toBe('planerad');
    expect(ops.some(x => x.forsenad)).toBe(false);
  });
  for (const klocka of ['17:30', '21:05', '23:30']) {
    test(`operationsprogrammet: på kvällen är dagens operationer genomförda och inte försenade (${klocka})`, () => {
      const { db, ops, status } = opStatus(klocka);
      expect(status).toEqual({ p71: 'klar', p72: 'klar' });
      expect(ops.some(x => x.forsenad || x.avvikelse)).toBe(false);
      // Förloppet har alla steg och ingreppet är registrerat som åtgärd.
      for (const x of ops) {
        const f = db.query('SELECT * FROM op_forlopp WHERE anmalan_id = ?').get(x.anmalanId);
        for (const h of ['in_sal', 'anestesistart', 'knivtid', 'op_slut', 'ut_sal']) expect(f[h]).toBeTruthy();
        expect(Date.parse(f.ut_sal)).toBeLessThan(Date.parse(lokalTid(TORSDAG, '16:30')));
      }
    });
  }
});
