// Runda 13, r4: seeddata som hänger ihop (fynden E2-31, E1-30, E2-3, E2-36, E2-43 och E1-8 i det utforskande testet).
// Varje test ställer klockan på en torsdag, så att resultatet inte beror på när sviten körs.
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { lokalTid, addDagar, datumAv, nySessionsDb } from '../src/db.js';
import { stallKlockan, aterstallKlockan } from './falsk-klocka.js';
import { testserver, klient, atk, personal } from './hjalp.js';
import { sandlada } from './specialist.js';
import * as administrering from '../src/administrering.js';
import * as obs from '../src/obstetrik.js';
import * as obsSeed from '../src/obstetrik-seed.js';

const TORSDAG = '2026-11-12';
const KLOCKAN = (k) => new Date(lokalTid(TORSDAG, k));

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
afterEach(() => aterstallKlockan());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };

describe('Seeddata som hänger ihop (runda 13, r4)', () => {
  for (const klocka of ['10:00', '21:00']) {
    test(`Emil Sjölund i sluten tvångsvård står bland psykiatrins inskrivna utan att röja var han vårdas (${klocka})`, async () => {
      stallKlockan(KLOCKAN(klocka));
      const k = await inloggad('lak-psyk');
      const lista = (await k.get('/api/arbetslista')).data;
      const emil = lista.find(r => r.id === 'p22');
      expect(emil).toMatchObject({ vardform: 'slutenvard', pagaende: true, plats: 'Vårdas på en annan vårdenhet' });
      expect(emil.orsak).toContain('Sluten psykiatrisk tvångsvård');
      expect(JSON.stringify(emil)).not.toMatch(/Hjärtintensiv|HIA|förmaksflimmer/i);
      // Elin Sandberg ligger inne på kardiologen. Hennes kontakt i psykiatrins öppenvård har pågått sedan länge och är
      // inget besök i dag, så arbetslistan säger det (gränssnittet visar den bland de pågående kontakterna).
      const elin = lista.find(r => r.id === 'p04');
      if (elin) expect(elin).toMatchObject({ vardform: 'oppenvard', idag: false });
    });
  }

  test('Emil Sjölund på hjärtintensiven har frekvensreglering och blodförtunnande, givna doser och värden det senaste dygnet', () => {
    stallKlockan(KLOCKAN('21:00'));
    const db = nySessionsDb();
    const lista = administrering.lista(atk(db, 'ssk-hia', 'p22', {}, 'las_lakemedel'));
    const namn = lista.doser.map(d => d.lakemedel.namn);
    expect(namn).toEqual(expect.arrayContaining(['Metoprolol Sandoz', 'Eliquis']));
    // Morgonens doser är givna. Kvällens doser klockan 20 är att ge nu.
    for (const d of lista.doser.filter(x => x.planerad < lokalTid(TORSDAG, '12:00'))) expect(d.status).toBe('given');
    expect(lista.doser.filter(d => d.status === 'forsenad')).toEqual([]);
    const senaste = db.query("SELECT max(tid) AS t FROM matvarden WHERE patient_id = 'p22' AND typ = 'puls'").get().t;
    expect(KLOCKAN('21:00').getTime() - Date.parse(senaste)).toBeLessThan(3 * 3600_000);
  });

  test('Annika Holmgren: reservnumret syns som reservnummer och båda journalerna markeras som möjlig dubblett', async () => {
    stallKlockan(KLOCKAN('10:00'));
    const k = await inloggad('ssk-kard');
    const lista = (await k.get('/api/arbetslista')).data;
    const p16 = lista.find(r => r.id === 'p16');
    const p17 = lista.find(r => r.id === 'p17');
    expect(p17).toMatchObject({ idTyp: 'reservnummer', idTypText: 'Reservnummer', mojligDubblett: true, plats: 'Avd 72, sal 4' });
    expect(p16).toMatchObject({ idTyp: 'personnummer', mojligDubblett: true });
    // Ingen annan patient i listan markeras.
    expect(lista.filter(r => r.mojligDubblett).map(r => r.id).sort()).toEqual(['p16', 'p17']);
    // En användare som bara ser den ena journalen får ingen markering, så att markeringen inte röjer den andra.
    const akut = await inloggad('lak-akut');
    const akutLista = (await akut.get('/api/arbetslista')).data;
    const akutIds = new Set(akutLista.map(r => r.id));
    for (const r of akutLista.filter(x => x.mojligDubblett)) expect([r.id, akutIds.has('p16') && akutIds.has('p17')]).toEqual([r.id, true]);
  });

  test('Amanda Lindholm i aktiv förlossning har en graviditetsjournal med ultraljud och besök, och barnmorskan erbjuds inte att skriva in en ny', () => {
    stallKlockan(KLOCKAN('21:00'));
    const db = sandlada(KLOCKAN('21:00'));
    obsSeed.seeda(db, KLOCKAN('21:00'));
    const mvc = obs.forPatient(atk(db, 'ssk-vc', 'obs3', {}, 'las_graviditet')).graviditeter[0];
    expect(mvc.ultraljud.length).toBe(1);
    expect(mvc.besok.length).toBe(4);
    // Barnmorskan på förlossningen ser den efter ett aktivt val, och utan valet får gränssnittet veta att den finns.
    const utan = obs.forPatient(atk(db, 'bm-uso', 'obs3', {}, 'las_graviditet'));
    expect(utan.graviditeter).toEqual([]);
    expect(utan.dolda.kraverVal).toBe(1);
    expect(obs.forPatient(atk(db, 'bm-uso', 'obs3', { andra_enheter: true }, 'las_graviditet')).graviditeter.length).toBe(1);
  });

  test('Waran ges klockan 18 varje dag, och gårdagens dos är given', () => {
    stallKlockan(KLOCKAN('21:00'));
    const db = nySessionsDb();
    const lista = administrering.lista(atk(db, 'ssk-kard', 'p01', {}, 'las_lakemedel'));
    const waran = lista.doser.filter(d => d.lakemedel.namn === 'Waran');
    expect(waran.map(d => d.planerad)).toEqual([lokalTid(TORSDAG, '18:00')]);
    expect(lista.utanTider.map(d => d.lakemedel.namn)).not.toContain('Waran');
    const igar = db.query("SELECT a.* FROM administreringar a JOIN ordinationer o ON o.id = a.ordination_id WHERE a.patient_id = 'p01' AND o.lakemedel_id = 'VK-NPL-0001' AND a.planerad = ?")
      .get(lokalTid(addDagar(TORSDAG, -1), '18:00'));
    expect(igar.status).toBe('given');
  });

  test('en patient som bor hemma har inga doser att ge och inga försenade doser, och läskopian säger detsamma', () => {
    stallKlockan(KLOCKAN('20:55'));
    const db = nySessionsDb();
    const lista = administrering.lista(atk(db, 'lak-vc', 'p10', {}, 'las_lakemedel'));
    expect(lista).toMatchObject({ ejInskriven: true, doser: [], sammanfattning: { forsenade: 0, totalt: 0 } });
    // Samma patient får doser att ge när han är inskriven.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p10', 'vc-tybble', 'slutenvard', ?, 'Hemsjukvård', 'Test')").run(KLOCKAN('08:00').toISOString());
    expect(administrering.lista(atk(db, 'lak-vc', 'p10', {}, 'las_lakemedel')).ejInskriven).toBeUndefined();
  });

  test('en inskrivning som användaren inte får se ger inga doser att ge, så att listan inte röjer den', () => {
    stallKlockan(KLOCKAN('20:55'));
    const db = nySessionsDb();
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p10', 'uso-psyk', 'slutenvard', ?, 'Avdelning', 'Test')").run(KLOCKAN('08:00').toISOString());
    const lista = administrering.lista(atk(db, 'lak-vc', 'p10', {}, 'las_lakemedel'));
    expect(lista.ejInskriven).toBe(true);
    expect(lista.dolda.sparrade).toBe(false);
  });
});
