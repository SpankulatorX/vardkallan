// Runda 14, sammanslagningen: säkerhetsgenomgången av de fem delarna tillsammans. Varje test prövar ett fynd som
// rättades vid sammanslagningen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { iso } from '../src/db.js';
import * as intyg from '../src/lakarintyg.js';
import * as eremiss from '../src/eremiss.js';
import { atk, testserver, klient, sandlada } from './hjalp.js';
import { nyDbSomStangs } from './r14r3-hjalp.js';

const nyDb = nyDbSomStangs();
const DAG = '2026-11-12';
const patient = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const diagnos = (db, enhet, kod, text, datum) =>
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', ?, ?, ?, 'huvud', ?)").run(enhet, kod, text, datum);
// Två sandlådor med samma diagnos på läkarens egen vårdenhet. I den andra har patienten dessutom många nyare diagnoser på
// en spärrad vårdenhet.
function tvaSandlador(antal) {
  const utan = nyDb();
  const med = nyDb();
  for (const db of [utan, med]) {
    diagnos(db, 'vc-tybble', 'M17.1', 'Primär gonartros', '2026-10-01');
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p11', 'uso-psyk', ?, 1)").run(iso());
  }
  for (let i = 0; i < antal; i++) diagnos(med, 'uso-psyk', 'F32.1', 'Medelsvår depressiv episod', '2099-01-01');
  return { utan, med };
}

describe('Säkerhetsgenomgången av runda 14', () => {
  test('förslaget och förifyllnaden av intyget är desamma med och utan många nyare diagnoser på en spärrad vårdenhet', () => {
    const { utan, med } = tvaSandlador(60);
    const svar = (db) => JSON.stringify(intyg.forslag(atk(db, 'lak-vc', 'p11', {}, 'skriv_intyg'), patient(db, 'p11'), DAG));
    expect(svar(utan)).toContain('från din vårdenhet förifylls');
    expect(svar(med)).toBe(svar(utan));
  });

  test('diagnoserna i en e-remiss är desamma med och utan många nyare diagnoser på en spärrad vårdenhet', () => {
    const { utan, med } = tvaSandlador(30);
    const svar = (db) => JSON.stringify(eremiss.diagnoserForRemiss(atk(db, 'lak-vc', 'p11', {}, 'remittera')).map(d => [d.kod, d.text]));
    expect(svar(utan)).toContain('M17.1');
    expect(svar(med)).toBe(svar(utan));
  });

  describe('engagemangsindex', () => {
    let app;
    beforeAll(() => { app = testserver(); });
    afterAll(() => app.stopp());

    test('svaret till systemförvaltaren röjer inte hur många engagemang patienten har eller om personuppgifterna är skyddade', async () => {
      const k = klient(app);
      await k.logga('sysf');
      const db = sandlada(app, k).db;
      const vanlig = await k.post('/api/rivta/engagemangsindex/p01', {});
      expect(vanlig.status).toBe(200);
      expect(db.query("SELECT count(*) AS n FROM rivta_sim_engagemang WHERE patient_id = 'p01'").get().n).toBeGreaterThan(0);
      db.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p02'").run();
      const skyddad = await k.post('/api/rivta/engagemangsindex/p02', {});
      expect(skyddad.status).toBe(200);
      expect(db.query("SELECT count(*) AS n FROM rivta_sim_engagemang WHERE patient_id = 'p02'").get().n).toBe(0);
      expect(JSON.stringify(skyddad.data)).toBe(JSON.stringify(vanlig.data));
      // Antalet står i åtkomstloggen, som granskas av dem som får se den.
      const logg = db.query("SELECT syfte FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = 'rivta:Update' ORDER BY id DESC").get();
      expect(logg.syfte).toMatch(/\d+ engagemang skickades/);
    });
  });
});
