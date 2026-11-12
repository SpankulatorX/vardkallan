// Runda 13, r4: mottagningarnas och operationsavdelningens arbetsdag ligger på dagtid oavsett när sandlådan skapas.
// Slutenvården och akuten går dygnet runt. På kvällen är dagens arbete gjort och nästa arbetsdag är planerad, och på
// natten väntas dagens patienter. Varje test ställer klockan, så att resultatet inte beror på när sviten körs.
import { describe, test, expect, afterEach } from 'bun:test';
import { lokalTid, datumAv, addDagar, nySessionsDb, arbetsdagensMitt, ARBETSDAG } from '../src/db.js';
import * as tidbok from '../src/tidbok.js';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { personal, atk, testserver, klient, sandlada } from './hjalp.js';
import * as r8 from '../src/bokning-r8.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { Atkomst } from '../src/atkomst.js';
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

// Efter sammanslagningen av runda 13: arbetsdagen möter de andra delarnas kod. Klockan ställs i varje test.
describe('Arbetsdagen och de andra delarna (runda 13, efter sammanslagningen)', () => {
  const SONDAG = '2026-11-15';

  test('kassans demoläge tar inte betalt för en tid vars incheckning inte har öppnat, utan för en ankomst nu', async () => {
    const app = testserver();
    try {
      stallKlockan(new Date(ms(TORSDAG, '00:30')));
      const natt = klient(app);
      await natt.logga('adm-kard');
      const d = sandlada(app, natt).db;
      const fore = new Set(d.query("SELECT id FROM bokningar WHERE status = 'bokad'").all().map(r => r.id));
      expect((await natt.post('/api/demo/kassa-besok', {})).status).toBe(201);
      // Betalningen gäller ett besök som börjar nu, inte någon av dagens tider klockan åtta.
      const bet = d.query('SELECT b.id, t.start FROM betalningar x JOIN bokningar b ON b.id = x.bokning_id JOIN tider t ON t.id = b.tid_id ORDER BY x.id DESC').get();
      expect(fore.has(bet.id)).toBe(false);
      expect(Math.abs(Date.parse(bet.start) - ms(TORSDAG, '00:30'))).toBeLessThanOrEqual(15 * 60_000);
      stallKlockan(new Date(ms(TORSDAG, '11:00')));
      const dag = klient(app);
      await dag.logga('adm-kard');
      expect((await dag.post('/api/demo/kassa-besok', {})).status).toBe(201);
    } finally { app.stopp(); }
  });

  // Testarna från Reddit testar ofta på kvällen. Vårdadministratörens uppdrag Ta betalt och Gör dagsavslut, och
  // användartestets uppdrag Kassan, har alltid en patient att ta betalt av.
  for (const [namn, dag, klocka] of [['vardag 23.30', TORSDAG, '23:30'], ['söndag 12.00', SONDAG, '12:00'], ['vardag 00.30', TORSDAG, '00:30']]) {
    test(`${namn}: vårdadministratörens uppdrag har en incheckad patient att ta betalt av, och dagsavslutet går att göra`, async () => {
      const app = testserver({ synpunktFil: ':memory:' });
      try {
        stallKlockan(new Date(ms(dag, klocka)));
        const k = klient(app);
        await k.logga('adm-kard');
        expect((await k.post('/api/testare/starta', { testroll: 'vardadministrator', profil: {} })).status).toBe(200);
        const idag = (await k.get('/api/idag')).data;
        const rad = idag.dagens.find(x => x.rad?.atgard?.typ === 'betala');
        expect(rad).toBeTruthy();
        const betala = await k.post(`/api/bokning/${rad.id}/betala`, { satt: 'kort' });
        expect(betala.status).toBeLessThan(300);
        let t = (await k.get('/api/testare')).data;
        expect(t.uppdrag.find(u => u.id === 'betala').status).toBe('klar');
        const avslut = await k.post('/api/kassa/dagsavslut', {});
        expect(avslut.status).toBe(201);
        expect(avslut.data.antal).toBeGreaterThanOrEqual(1);
        t = (await k.get('/api/testare')).data;
        expect(t.uppdrag.find(u => u.id === 'dagsavslut').status).toBe('klar');
        // En ny start ger ingen ny ankomst när det redan finns en att ta betalt av.
        const k2 = klient(app);
        await k2.logga('adm-kard');
        expect((await k2.post('/api/testare/starta', { testroll: 'vardadministrator', profil: {} })).status).toBe(200);
        expect((await k2.post('/api/testare/starta', { testroll: 'vardadministrator', profil: {} })).status).toBe(200);
        expect((await k2.get('/api/idag')).data.dagens.filter(x => x.rad?.atgard?.typ === 'betala')).toHaveLength(1);
        // Användartestets förberedelse för Kassan ger en betalning att göra dagsavslut på.
        const k3 = klient(app);
        await k3.logga('adm-kard');
        expect((await k3.post('/api/demo/kassa-besok', {})).status).toBe(201);
        expect((await k3.get('/api/kassa')).data.kassorer.find(x => x.du)).toMatchObject({ kanAvsluta: true });
      } finally { app.stopp(); }
    });
  }

  test('en ankomst som registreras i efterhand på kvällen bockar av testinbjudans uppdrag 5.5', async () => {
    const app = testserver({ synpunktFil: ':memory:' });
    try {
      stallKlockan(new Date(ms(TORSDAG, '23:30')));
      const k = klient(app);
      await k.logga('adm-kard');
      expect((await k.post('/api/testare/starta', { testroll: 'vardadministrator', profil: {} })).status).toBe(200);
      const d = sandlada(app, k).db;
      const b = dagens(d).find(x => x.status === 'bokad' && tidbok.TIDSTYPER[x.tidstyp].fysisk && datumAv(new Date(x.start)) === TORSDAG);
      expect(b).toBeTruthy();
      expect((await k.post(`/api/bokning/${b.id}/checka-in`)).status).toBe(200);
      // Ankomsten räknas från den bokade tiden, men registreringen gjordes nu.
      expect(d.query('SELECT incheckad FROM bokningar WHERE id = ?').get(b.id).incheckad).toBe(b.start);
      const t = (await k.get('/api/testare')).data;
      expect(t.uppdrag.find(u => u.id === '5.5').status).toBe('klar');
    } finally { app.stopp(); }
  });

  test('en gruppträff vars brev inte hinner fram: den som läggs till efter utskicket får sin kallelse direkt, inte väntande', () => {
    stallKlockan(new Date(ms(TORSDAG, '11:00')));
    const db = nySessionsDb();
    laddaTestdata(db, personal(db, 'adm-kard'), { nu: new Date(ms(TORSDAG, '11:00')) });
    const tid = db.query("SELECT * FROM tider WHERE rubrik = 'Hjärtrehabilitering i grupp'").get();
    // Träffen flyttas till i morgon, så att ett brev inte hinner fram.
    const start = new Date(ms(addDagar(TORSDAG, 1), '11:45')).toISOString();
    db.query('UPDATE tider SET start = ?, slut = ? WHERE id = ?').run(start, new Date(Date.parse(start) + 2 * 3600_000).toISOString(), tid.id);
    for (const pid of ['sus10', 'sus08']) r8.laggTillGrupp(atk(db, 'adm-kard', pid, {}, 'boka'), tidbok.tidRad(db, tid.id));
    tidbok.kallaGrupp(db, personal(db, 'adm-kard'), tidbok.tidRad(db, tid.id), { Atkomst });
    // Utskicket är gjort, men inget brev gick iväg: patienterna ska få tiden per telefon.
    const status = db.query('SELECT DISTINCT k.status FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.tid_id = ?').all(tid.id).map(r => r.status);
    expect(status).toContain('kan_inte');
    expect(status).not.toContain('skickad');
    expect(status).not.toContain('vantar');
    const [, sen] = r8.laggTillGrupp(atk(db, 'adm-kard', 'sus11', {}, 'boka'), tidbok.tidRad(db, tid.id));
    expect(sen.kallelse.status).toBe('kan_inte');
    expect(sen.kallelse.forklaring).toContain('ett brev hinner inte fram');
  });

  test('Sussas gruppträff i testfall 5.3 ligger så långt fram att kallelsen hinner fram med brev, också från en söndag', () => {
    for (const [dag, klocka] of [[SONDAG, '12:00'], [SONDAG, '23:00'], [TORSDAG, '11:00'], [TORSDAG, '23:30']]) {
      const nu = new Date(ms(dag, klocka));
      stallKlockan(nu);
      const db = nySessionsDb();
      laddaTestdata(db, personal(db, 'adm-kard'), { nu });
      const tid = db.query("SELECT * FROM tider WHERE rubrik = 'Hjärtrehabilitering i grupp'").get();
      expect([dag, klocka, Date.parse(tid.start) - nu.getTime() >= tidbok.BREV_DAGAR * 86400_000]).toEqual([dag, klocka, true]);
      expect([0, 6]).not.toContain(new Date(tid.start).getUTCDay());
    }
  }, 30_000);
});
