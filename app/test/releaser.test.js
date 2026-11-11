// Releaser med återgång (runda 12, r2, vårt D7 och M8): versionerade migreringar som går att backa, kontrollen av
// schemat när servern startar, återgång till förra versionen och godkännande av två systemförvaltare innan en
// uppgradering används. Tiderna skickas in som fasta värden.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSeed, nySessionsDb, installning } from '../src/db.js';
import * as releaser from '../src/releaser.js';
import * as lagring from '../src/lagring.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

const NU = new Date('2026-11-11T13:00:00Z');
const schema = (db) => db.query("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migreringar', 'parkerade_data') ORDER BY type, name").all();
const GRON = { tid: '2026-11-11T12:00:00Z', antal: 10, godkanda: 10, misslyckade: 0 };
const ROD = { tid: '2026-11-11T12:00:00Z', antal: 10, godkanda: 8, misslyckade: 2 };

// En påhittad nyare version av programmet med en migrering som skapar en tabell och en som lägger till en kolumn.
const NYARE = [...releaser.MIGRERINGAR,
  { id: 90, version: '9.0.0', namn: 'Prov: ny tabell', upp: ['CREATE TABLE prov_ny (id INTEGER PRIMARY KEY, text TEXT)'], ned: ['DROP TABLE prov_ny'], tabeller: ['prov_ny'] },
  { id: 91, version: '9.0.0', namn: 'Prov: ny kolumn', upp: ['ALTER TABLE enheter ADD COLUMN prov_farg TEXT'], ned: ['ALTER TABLE enheter DROP COLUMN prov_farg'], kolumner: [{ tabell: 'enheter', kolumn: 'prov_farg' }] },
];

describe('Releaser', () => {
  test('varje migrering har en återställning, och upp och sedan ned ger samma schema som före', () => {
    for (const m of releaser.MIGRERINGAR) {
      expect(m.ned.length).toBeGreaterThan(0);
      expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    const db = byggSeed(NU);
    try {
      const efter = schema(db);
      releaser.tillVersion(db, '1.1.0', releaser.MIGRERINGAR, NU);
      const fore = schema(db);
      expect(fore).not.toEqual(efter);
      expect(releaser.schemastatus(db).schemaversion).toBe(0);
      releaser.tillVersion(db, releaser.VERSION, releaser.MIGRERINGAR, NU);
      expect(schema(db)).toEqual(efter);
      expect(releaser.schemastatus(db).schemaversion).toBe(Math.max(...releaser.MIGRERINGAR.map(m => m.id)));
      expect(db.query('PRAGMA integrity_check').get().integrity_check).toBe('ok');
    } finally { db.close(); }
  });

  test('schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen', () => {
    const db = byggSeed(NU);
    try {
      // Den nyare versionen startar och uppgraderar databasen.
      let k = releaser.kontrolleraVidStart(db, NYARE, '9.0.0', NU);
      expect(k.tillampade.map(m => m.id)).toEqual([90, 91]);
      expect(k.stammer).toBe(true);
      db.query("INSERT INTO prov_ny (text) VALUES ('skrivet i 9.0.0')").run();
      db.query("UPDATE enheter SET prov_farg = 'blå' WHERE id = 'uso-kard'").run();
      // Programmet går tillbaka till den nuvarande versionen, som inte känner till migreringarna 90 och 91.
      k = releaser.kontrolleraVidStart(db, releaser.MIGRERINGAR, releaser.VERSION, NU);
      expect(k.backade.map(m => m.id)).toEqual([91, 90]);
      expect(k.backade.every(m => m.kand === false)).toBe(true);
      expect(k.stammer).toBe(true);
      expect(k.driftversion).toBe(releaser.VERSION);
      expect(db.query("SELECT 1 FROM sqlite_master WHERE name = 'prov_ny'").get()).toBeNull();
      expect(db.query('PRAGMA table_info(enheter)').all().map(c => c.name)).not.toContain('prov_farg');
      // Inget har försvunnit: det som skrevs i den nyare versionen är undanlagt och kommer tillbaka vid nästa uppgradering.
      expect(db.query('SELECT count(*) AS n FROM parkerade_data').get().n).toBe(2);
      k = releaser.kontrolleraVidStart(db, NYARE, '9.0.0', NU);
      expect(db.query('SELECT text FROM prov_ny').all()).toEqual([{ text: 'skrivet i 9.0.0' }]);
      expect(db.query("SELECT prov_farg FROM enheter WHERE id = 'uso-kard'").get().prov_farg).toBe('blå');
      expect(db.query('SELECT count(*) AS n FROM parkerade_data').get().n).toBe(0);
      // En sandlåda som läses in igen utan ändringar behöver ingenting.
      k = releaser.kontrolleraVidStart(db, NYARE, '9.0.0', NU);
      expect(k.tillampade).toEqual([]);
      expect(k.backade).toEqual([]);
    } finally { db.close(); }
  });

  test('en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång', () => {
    const db = nySessionsDb();
    const sysf = personal(db, 'sysf');
    releaser.aterga(db, sysf, {}, NU);
    expect(releaser.driftversion(db)).toBe(releaser.forraVersion(releaser.VERSION));
    const data = db.serialize();
    db.close();
    const igen = Database.deserialize(data);
    try {
      const k = releaser.kontrolleraVidStart(igen);
      // Servern startar om, men uppgraderingen tillämpas inte förrän den är godkänd.
      expect(k.tillampade).toEqual([]);
      expect(k.stammer).toBe(true);
      expect(k.schemaversion).toBe(0);
    } finally { igen.close(); }
  });

  test('uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen', () => {
    const db = nySessionsDb();
    try {
      const sysf = personal(db, 'sysf');
      let o = releaser.oversikt(db, sysf, { testresultat: GRON });
      expect(o.driftversion).toBe(releaser.VERSION);
      expect(o.schema.stammer).toBe(true);
      expect(o.forra.version).toBe(releaser.forraVersion(releaser.VERSION));
      expect(o.migreringar.every(m => m.tillampad && m.aterstallning)).toBe(true);
      releaser.aterga(db, sysf, {}, NU);
      o = releaser.oversikt(db, sysf, { testresultat: GRON });
      expect(o.vantar.till).toBe(releaser.VERSION);
      const v = o.nasta.find(x => x.version === releaser.VERSION);
      expect(v.nyheter.length).toBeGreaterThan(0);
      expect(v.api.text.length).toBeGreaterThan(0);
      expect(v.migreringar.map(m => m.id)).toEqual(releaser.MIGRERINGAR.filter(m => m.version === releaser.VERSION).map(m => m.id));
      expect(o.tester.gron).toBe(true);
    } finally { db.close(); }
  });

  test('en uppgradering vars tester inte är gröna stoppas och kan inte godkännas', () => {
    const db = nySessionsDb();
    try {
      const sysf = personal(db, 'sysf');
      const { vantar } = releaser.aterga(db, sysf, {}, NU);
      for (const r of [ROD, null, { antal: 0, godkanda: 0, misslyckade: 0 }]) {
        expect(releaser.testlage(r).gron).toBe(false);
        let fel = null;
        try { releaser.godkann(db, sysf, vantar.id, { testresultat: r }, NU); } catch (e) { fel = e; }
        expect(fel?.status).toBe(409);
        expect(fel.message).toMatch(/stoppad/);
      }
      expect(releaser.oversikt(db, sysf, { testresultat: ROD }).tester.text).toMatch(/2 av 10 tester i bygget är röda/);
      expect(releaser.oversikt(db, sysf, { testresultat: ROD }).vantar.godkand1Av).toBeNull();
    } finally { db.close(); }
  });

  test('återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den', () => {
    const db = nySessionsDb();
    try {
      const sysf = personal(db, 'sysf');
      const sysf2 = personal(db, 'sysf-2');
      const fore = lagring.sakerhetskopiera(db);
      const r = releaser.aterga(db, sysf, {}, NU);
      expect(r.backade.length).toBe(releaser.MIGRERINGAR.filter(m => m.version === releaser.VERSION).length);
      expect(db.query("SELECT 1 FROM sqlite_master WHERE name = 'lagringsklasser'").get()).toBeNull();
      // En återgång när den förra versionen redan är i drift går inte.
      expect(() => releaser.aterga(db, sysf, {}, NU)).toThrow(/väntar redan/);
      const g1 = releaser.godkann(db, sysf, r.vantar.id, { testresultat: GRON }, NU);
      expect(g1.genomford).toBe(false);
      expect(releaser.driftversion(db)).toBe(releaser.forraVersion(releaser.VERSION));
      // Samma person en gång till: fyra ögon.
      let fel = null;
      try { releaser.godkann(db, sysf, r.vantar.id, { testresultat: GRON }, NU); } catch (e) { fel = e; }
      expect(fel?.status).toBe(403);
      const g2 = releaser.godkann(db, sysf2, r.vantar.id, { testresultat: GRON }, NU);
      expect(g2.genomford).toBe(true);
      expect(g2.uppgradering.godkand1Av).toBe(sysf.namn);
      expect(g2.uppgradering.godkand2Av).toBe(sysf2.namn);
      expect(releaser.driftversion(db)).toBe(releaser.VERSION);
      expect(g2.schema.stammer).toBe(true);
      // Lagringsklasserna, som togs bort vid återgången, är tillbaka med sitt innehåll.
      const klasser = db.query('SELECT id FROM lagringsklasser ORDER BY id').all().map(x => x.id);
      expect(klasser).toEqual(['aktuell', 'aldre']);
      // Allt annat är som före återgången: samma tabeller, triggrar och index.
      const original = Database.deserialize(fore);
      try {
        const tab = (d) => d.query("SELECT type, name, sql FROM sqlite_master WHERE name NOT IN ('schema_migreringar', 'parkerade_data', 'uppgraderingar') ORDER BY type, name").all();
        expect(tab(db)).toEqual(tab(original));
      } finally { original.close(); }
      // Händelserna är loggade i säkerhetsloggen.
      expect(db.query("SELECT count(*) AS n FROM sakerhetslogg WHERE beskrivning LIKE '%version ' || ? || '%'").get(releaser.VERSION).n).toBeGreaterThanOrEqual(3);
    } finally { db.close(); }
  });

  test('bara systemförvaltningen ser och gör uppgraderingar', () => {
    const db = nySessionsDb();
    try {
      for (const id of ['lak-kard', 'vch-kard', 'logg']) {
        const p = personal(db, id);
        expect(() => releaser.oversikt(db, p, { testresultat: GRON })).toThrow(/systemförvaltningen/);
        expect(() => releaser.aterga(db, p, {}, NU)).toThrow(/systemförvaltningen/);
      }
    } finally { db.close(); }
  });
});

describe('Releaser', () => {
  let app;
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-releaser-'));
    writeFileSync(join(dir, 'gron.json'), JSON.stringify(GRON));
    app = testserver({ testresultat: join(dir, 'gron.json') });
  });
  afterAll(() => { app.stopp(); rmSync(dir, { recursive: true, force: true }); });

  test('API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen', async () => {
    const k = klient(app);
    await k.logga('sysf');
    let r = await k.get('/api/uppgraderingar');
    expect(r.status).toBe(200);
    expect(r.data.driftversion).toBe(releaser.VERSION);
    expect(r.data.tester.gron).toBe(true);
    r = await k.post('/api/uppgraderingar/atergang', {});
    expect(r.status).toBe(200);
    const id = r.data.vantar.id;
    r = await k.post(`/api/uppgraderingar/${id}/godkann`, {});
    expect(r.status).toBe(200);
    expect(r.data.genomford).toBe(false);
    r = await k.post(`/api/uppgraderingar/${id}/godkann`, {});
    expect(r.status).toBe(403);
    // Den andra systemförvaltaren loggar in i samma sandlåda och godkänner.
    await k.logga('sysf-2');
    r = await k.post(`/api/uppgraderingar/${id}/godkann`, {});
    expect(r.status).toBe(200);
    expect(r.data.genomford).toBe(true);
    expect(installning(sandlada(app, k).db, 'driftversion')).toBe(releaser.VERSION);
    const h = await fetch(app.url + '/api/health').then(x => x.json());
    expect(h.schemaversion).toBe(Math.max(...releaser.MIGRERINGAR.map(m => m.id)));
    // En läkare når inte uppgraderingarna.
    await k.logga('lak-kard');
    expect((await k.get('/api/uppgraderingar')).status).toBe(403);
  });
});
