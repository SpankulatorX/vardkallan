// Säkerhetskopior på två platser med verifiering och återställning till en tidpunkt (runda 12, r2, Sussa KD1.1.3.6).
// Tiderna skickas in som fasta värden, och katalogerna är egna för testet.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nySessionsDb, migrera } from '../src/db.js';
import * as kopior from '../src/sakerhetskopior.js';
import { verifiera } from '../src/logg.js';
import * as sakerhetslogg from '../src/sakerhetslogg.js';
import { loggaRad } from '../src/logg.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

const T0 = new Date('2026-11-11T10:00:00Z');
const min = (n) => new Date(T0.getTime() + n * 60_000);
const tmp = () => mkdtempSync(join(import.meta.dir, '..', '.testtmp-kopior-'));
const antalMat = (db) => db.query("SELECT count(*) AS n FROM matvarden WHERE registrerad_av = 'prov-kopia'").get().n;
const mat = (db) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES ('p1', 'uso-kard', 'puls', '72', ?, 'prov-kopia')").run(new Date().toISOString());

describe('Säkerhetskopior', () => {
  let a, b;
  beforeAll(() => { a = tmp(); b = tmp(); });
  afterAll(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });

  test('varje kopia skrivs på två platser och verifieras på båda, och sandlådans id syns inte i något filnamn', () => {
    const lager = kopior.skapaKopielager({ katalog: a, andraKatalog: b });
    const db = nySessionsDb();
    try {
      const sid = 'A'.repeat(32);
      const p = lager.ta(sid, db, { orsak: 'manuell', nu: T0 });
      expect(p.verifierad).toBe(true);
      expect(p.platser).toEqual([{ plats: 1, ok: true }, { plats: 2, ok: true }]);
      expect(p.kontroller.map(k => k.id)).toEqual(expect.arrayContaining(['summa', 'integritet', 'atkomstlogg', 'tabeller']));
      for (const dir of [a, b]) {
        const mappar = readdirSync(dir);
        expect(mappar).toEqual([lager.nyckel(sid)]);
        expect(mappar.join('')).not.toContain(sid);
        const filer = readdirSync(join(dir, mappar[0]));
        expect(filer).toContain(`${p.id}.sqlite`);
        expect(filer).toContain('index.json');
      }
      // Ett nytt lager med samma nyckel hittar kopiorna igen efter en omstart.
      const igen = kopior.skapaKopielager({ katalog: a, andraKatalog: b, hemlighet: Buffer.from('fel nyckel') });
      expect(igen.lista(sid)).toEqual([]);
    } finally { db.close(); }
  });

  test('en skadad kopia underkänns, och återläsningen tar den från den andra platsen', () => {
    const lager = kopior.skapaKopielager();
    const db = nySessionsDb();
    try {
      const sid = 'B'.repeat(32);
      const p = lager.ta(sid, db, { nu: T0 });
      lager.skada(sid, p.id, 1);
      const r = lager.las(sid, p.id);
      expect(r.forsok).toEqual([{ plats: 1, ok: false }, { plats: 2, ok: true }]);
      expect(r.plats).toBe(2);
      lager.skada(sid, p.id, 2);
      expect(lager.las(sid, p.id).data).toBeNull();
      expect(kopior.verifieraKopia(Buffer.from('inte en databas'), p.sha256).ok).toBe(false);
    } finally { db.close(); }
  });

  test('schemaläggningen tar en kopia av varje sandlåda som har ändrats sedan sin senaste kopia, och sparar ett begränsat antal', () => {
    const lager = kopior.skapaKopielager({ behall: 3 });
    const s1 = { db: nySessionsDb(), aktiv: T0.getTime() };
    const s2 = { db: nySessionsDb(), aktiv: T0.getTime() };
    const sessioner = new Map([['C'.repeat(32), s1], ['D'.repeat(32), s2]]);
    try {
      expect(kopior.schemalagda(lager, sessioner, min(15))).toBe(2);
      // Ingen ändring sedan dess: ingen ny kopia.
      expect(kopior.schemalagda(lager, sessioner, min(30))).toBe(0);
      s1.aktiv = min(40).getTime();
      expect(kopior.schemalagda(lager, sessioner, min(45))).toBe(1);
      for (let i = 0; i < 4; i++) { s1.aktiv = min(50 + i * 15).getTime(); kopior.schemalagda(lager, sessioner, min(55 + i * 15)); }
      expect(lager.lista('C'.repeat(32)).length).toBe(3);
      expect(lager.lista('C'.repeat(32)).every(p => p.orsak === 'schema' && p.verifierad)).toBe(true);
    } finally { s1.db.close(); s2.db.close(); }
  });

  test('återställning till en tidpunkt tar den senaste verifierade kopian före tidpunkten, sparar läget före och behåller loggarna', () => {
    const lager = kopior.skapaKopielager();
    const sid = 'E'.repeat(32);
    let db = nySessionsDb();
    try {
      const sysf = personal(db, 'sysf');
      mat(db);
      lager.ta(sid, db, { orsak: 'schema', nu: min(0) });
      mat(db);
      lager.ta(sid, db, { orsak: 'schema', nu: min(15) });
      mat(db);
      loggaRad(db, { personal_id: 'lak-kard', enhet_id: 'uso-kard', patient_id: 'p1', handling: 'las_journal', grund: 'vardrelation' });
      const loggFore = db.query('SELECT count(*) AS n FROM atkomstlogg').get().n;
      expect(antalMat(db)).toBe(3);
      // Klockan 10.10: kopian från 10.00 är den senaste före, med ett mätvärde.
      const r = kopior.aterstall(lager, sid, db, sysf, { tid: min(10).toISOString() }, { migrera, nu: min(20) });
      expect(r.aterstalldTill.tid).toBe(min(0).toISOString());
      expect(r.fore.orsak).toBe('fore_aterstallning');
      expect(antalMat(r.db)).toBe(1);
      // Loggen har alla rader från före återställningen och en rad om återställningen, och kedjan håller.
      expect(r.db.query('SELECT count(*) AS n FROM atkomstlogg').get().n).toBe(loggFore + 1);
      expect(verifiera(r.db).hel).toBe(true);
      expect(sakerhetslogg.verifiera(r.db).hel).toBe(true);
      // Återställningen går att göra ogjord: kopian från före återställningen har alla tre.
      const fore = lager.las(sid, r.fore.id);
      const igen = kopior.aterstall(lager, sid, r.db, sysf, { tid: min(20).toISOString() }, { migrera, nu: min(21) });
      expect(igen.aterstalldTill.id).toBe(fore.post.id);
      expect(antalMat(igen.db)).toBe(3);
      r.db.close();
      db.close();
      db = igen.db;
      // En tidpunkt före den första kopian går inte, och fel värden förklaras.
      expect(() => kopior.aterstall(lager, sid, db, sysf, { tid: min(-60).toISOString() }, { migrera })).toThrow(/ingen verifierad kopia/);
      expect(() => kopior.aterstall(lager, sid, db, sysf, { tid: 1 }, { migrera })).toThrow(/Välj tidpunkten/);
    } finally { db.close(); }
  });

  test('bara systemförvaltningen ser och återställer kopiorna', () => {
    const lager = kopior.skapaKopielager();
    const db = nySessionsDb();
    try {
      for (const id of ['lak-kard', 'logg', 'ark']) {
        const p = personal(db, id);
        expect(() => kopior.oversikt(lager, 'F'.repeat(32), db, p)).toThrow(/systemförvaltningen/);
        expect(() => kopior.taNu(lager, 'F'.repeat(32), db, p)).toThrow(/systemförvaltningen/);
        expect(() => kopior.aterstall(lager, 'F'.repeat(32), db, p, { tid: T0.toISOString() })).toThrow(/systemförvaltningen/);
      }
    } finally { db.close(); }
  });
});

describe('Säkerhetskopior', () => {
  let app;
  let a, b;
  beforeAll(() => { a = tmp(); b = tmp(); app = testserver({ kopieKatalog: a, kopieAndra: b, kopieMinuter: 0 }); });
  afterAll(() => { app.stopp(); rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });

  test('API: systemförvaltaren ser när den senaste kopian togs och om den är verifierad, och återställer sandlådan till en tidpunkt', async () => {
    const k = klient(app);
    await k.logga('sysf');
    let r = await k.get('/api/sakerhetskopior');
    expect(r.status).toBe(200);
    expect(r.data.senaste).toBeNull();
    expect(r.data.platser.map(p => p.typ)).toEqual(['katalog', 'katalog']);
    r = await k.post('/api/sakerhetskopior', {});
    expect(r.status).toBe(201);
    expect(r.data.kopia.verifierad).toBe(true);
    const tid = r.data.kopia.tid;
    const s = sandlada(app, k);
    mat(s.db);
    expect(antalMat(s.db)).toBe(1);
    r = await k.get('/api/sakerhetskopior');
    expect(r.data.senaste.verifierad).toBe(true);
    expect(r.data.senaste.av).toBe('Tomas Lindh');
    r = await k.post('/api/sakerhetskopior/aterstall', { tid });
    expect(r.status).toBe(200);
    expect(r.data.aterstalldTill.tid).toBe(tid);
    expect(antalMat(sandlada(app, k).db)).toBe(0);
    // Sessionen fortsätter i den återställda sandlådan.
    expect((await k.get('/api/sakerhetskopior')).data.kopior.length).toBe(2);
    await k.logga('lak-kard');
    expect((await k.get('/api/sakerhetskopior')).status).toBe(403);
    // Kopiorna ligger i båda katalogerna.
    for (const dir of [a, b]) expect(readdirSync(dir).filter(x => /^[0-9a-f]{32}$/.test(x)).length).toBe(1);
  });
});

// Säkerhetsgranskningen av runda 12, r2: kopiorna hör till sandlådans stabila id och inte till sessionskakan, som byts
// vid varje inloggning, och de försvinner med sandlådan.
describe('Säkerhetskopior', () => {
  let app;
  let a, b;
  beforeAll(() => { a = tmp(); b = tmp(); app = testserver({ kopieKatalog: a, kopieAndra: b, kopieMinuter: 0, maxSessioner: 3 }); });
  afterAll(() => { app.stopp(); rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });
  const kataloger = (dir) => readdirSync(dir).filter(x => /^[0-9a-f]{32}$/.test(x));

  test('en session vars kaka har bytts vid en ny inloggning hittar sina kopior, och kopiorna försvinner när sandlådan trängs undan', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const id = sandlada(app, k).kopieId;
    expect(id).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const r = await k.post('/api/sakerhetskopior', {});
    expect(r.status).toBe(201);
    const kaka = k.kaka();
    // Den andra systemförvaltaren loggar in i samma sandlåda, och sessionskakan byts.
    await k.logga('sysf-2');
    expect(k.kaka()).not.toBe(kaka);
    expect(sandlada(app, k).kopieId).toBe(id);
    const o = await k.get('/api/sakerhetskopior');
    expect(o.data.kopior.map(x => x.id)).toEqual([r.data.kopia.id]);
    expect(kataloger(a)).toEqual([app.kopior.nyckel(id)]);
    // Tre nya sandlådor tränger undan den första, och dess kopior försvinner på båda platserna.
    for (let i = 0; i < 3; i++) await klient(app).logga('lak-kard');
    expect([...app.sessioner.values()].some(s => s.kopieId === id)).toBe(false);
    for (const dir of [a, b]) expect(kataloger(dir)).toEqual([]);
  });

  test('städningen tar bort kopiorna för sandlådor som inte finns och behåller de andra', () => {
    const lager = kopior.skapaKopielager({ katalog: a, andraKatalog: b });
    const db = nySessionsDb();
    try {
      lager.ta('X'.repeat(32), db, { nu: T0 });
      lager.ta('Y'.repeat(32), db, { nu: T0 });
      expect(lager.stada(['X'.repeat(32)])).toBe(2);
      for (const dir of [a, b]) expect(kataloger(dir)).toEqual([lager.nyckel('X'.repeat(32))]);
      expect(lager.lista('Y'.repeat(32))).toEqual([]);
      expect(lager.lista('X'.repeat(32)).length).toBe(1);
      lager.stada([]);
    } finally { db.close(); }
  });
});
