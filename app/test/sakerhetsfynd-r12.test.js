// Fynden från säkerhetsgranskningen av runda 12 som rättas i runda 13, r2 (fynd 1, 3, 4, 7, 8 och 11). Varje test
// var rött före rättningen. Tiderna skickas in som fasta värden, och katalogerna är egna för testet.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { nySessionsDb } from '../src/db.js';
import * as kopior from '../src/sakerhetskopior.js';
import * as ff from '../src/flerfaktor.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

const T0 = new Date('2026-11-11T10:00:00Z');
const min = (n) => new Date(T0.getTime() + n * 60_000);
const tmp = () => mkdtempSync(join(import.meta.dir, '..', '.testtmp-fynd-'));

describe('Säkerhetsfynd 1: säkerhetskopiorna har tak', () => {
  test('en manuell kopia per minut och tio per timme per sandlåda, sedan 429 med en förklaring', () => {
    const lager = kopior.skapaKopielager();
    const db = nySessionsDb();
    try {
      const sysf = personal(db, 'sysf');
      const tak = [];
      const sid = 'M'.repeat(32);
      expect(kopior.taNu(lager, sid, db, sysf, min(0), tak).kopia.verifierad).toBe(true);
      expect(() => kopior.taNu(lager, sid, db, sysf, min(0.5), tak)).toThrow(/en kopia i minuten/);
      for (let i = 1; i < 10; i++) kopior.taNu(lager, sid, db, sysf, min(i), tak);
      let fel;
      try { kopior.taNu(lager, sid, db, sysf, min(30), tak); } catch (e) { fel = e; }
      expect(fel.status).toBe(429);
      expect(fel.message).toContain('tio kopior');
      // En timme efter den första går det igen.
      expect(kopior.taNu(lager, sid, db, sysf, min(61), tak).kopia.verifierad).toBe(true);
    } finally { db.close(); }
  });

  test('API: den andra manuella kopian inom en minut ger 429', async () => {
    const app = testserver({ kopieMinuter: 0 });
    try {
      const k = klient(app);
      await k.logga('sysf');
      expect((await k.post('/api/sakerhetskopior', {})).status).toBe(201);
      const r = await k.post('/api/sakerhetskopior', {});
      expect(r.status).toBe(429);
      // Taket följer sandlådan, inte sessionskakan.
      await k.logga('sysf-2');
      expect((await k.post('/api/sakerhetskopior', {})).status).toBe(429);
    } finally { app.stopp(); }
  });

  test('ett tak för diskutrymmet över alla sandlådor, där de äldsta kopiorna tas bort först', () => {
    const db = nySessionsDb();
    try {
      const prov = kopior.skapaKopielager();
      const en = prov.ta('P'.repeat(32), db, { nu: T0 }).lagrat * 2;
      const lager = kopior.skapaKopielager({ maxByte: en * 3 + 10 });
      lager.ta('X'.repeat(32), db, { nu: min(0) });
      lager.ta('Y'.repeat(32), db, { nu: min(1) });
      lager.ta('Z'.repeat(32), db, { nu: min(2) });
      lager.ta('X'.repeat(32), db, { nu: min(3) });
      expect(lager.byte()).toBeLessThanOrEqual(en * 3 + 10);
      expect(lager.lista('X'.repeat(32)).map(p => p.tid)).toEqual([min(3).toISOString()]);
      expect(lager.lista('Y'.repeat(32)).length).toBe(1);
      expect(lager.lista('Z'.repeat(32)).length).toBe(1);
    } finally { db.close(); }
  });

  test('i demon sparas högst åtta kopior per sandlåda', () => {
    expect(kopior.skapaKopielager().behall).toBeLessThanOrEqual(8);
  });

  test('en sandlåda som är större än taket får ett begripligt fel i stället för en kopia', () => {
    const lager = kopior.skapaKopielager({ maxKopiaByte: 1024 * 1024 });
    const db = nySessionsDb();
    try {
      let fel;
      try { lager.ta('S'.repeat(32), db, { nu: T0 }); } catch (e) { fel = e; }
      expect(fel.status).toBe(413);
      expect(fel.message).toContain('för stor');
      expect(lager.lista('S'.repeat(32))).toEqual([]);
    } finally { db.close(); }
  });

  test('det schemalagda jobbet tar en sandlåda i taget och släpper fram andra anrop emellan', async () => {
    const lager = kopior.skapaKopielager();
    const s = [1, 2, 3].map(() => ({ db: nySessionsDb(), aktiv: T0.getTime() }));
    const sessioner = new Map(s.map((x, i) => [String(i).repeat(32), x]));
    try {
      const ordning = [];
      const jobb = kopior.schemalagdaStegvis(lager, sessioner, min(15)).then(n => { ordning.push('klar'); return n; });
      setTimeout(() => ordning.push('annat'), 0);
      expect(await jobb).toBe(3);
      expect(ordning).toEqual(['annat', 'klar']);
    } finally { for (const x of s) x.db.close(); }
  });
});

// Fynd 3 och 4: återställningen av sandlådan och inläsningen av en kopia.
describe('Säkerhetsfynd 3 och 4: återställning och inläsning av kopior', () => {
  let app, dir;
  beforeAll(() => { dir = tmp(); app = testserver({ kopieKatalog: join(dir, 'a'), kopieAndra: join(dir, 'b'), kopieMinuter: 0 }); });
  afterAll(() => { app.stopp(); rmSync(dir, { recursive: true, force: true }); });
  const antalMat = (k) => sandlada(app, k).db.query("SELECT count(*) AS n FROM matvarden WHERE registrerad_av = 'prov-fynd'").get().n;
  const mat = (k) => sandlada(app, k).db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES ('p01', 'uso-kard', 'puls', '72', ?, 'prov-fynd')").run(new Date().toISOString());
  // sysf föreslår, sysf-2 godkänner i sin egen inloggning.
  async function aterstall(k, tid) {
    await k.logga('sysf');
    const f = await k.post('/api/sakerhetskopior/aterstall', { tid });
    if (f.status !== 202) return f;
    await k.logga('sysf-2');
    return k.post('/api/sakerhetskopior/aterstall/godkann', {});
  }
  async function totp(k, id) {
    await k.logga(id);
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    expect((await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) })).status).toBe(201);
    return h;
  }
  // Ny sandlåda, och en kopia av den. Väntar en sekund så att kopians tid skiljer sig från det som görs efter den.
  async function nyMedKopia(k) {
    await k.logga('sysf');
    await k.post('/api/reset', {});
    await k.logga('sysf');
    const tid = (await k.post('/api/sakerhetskopior', {})).data.kopia.tid;
    await Bun.sleep(1100);
    return tid;
  }

  test('fynd 3: efter en återställning av demon finns inga kopior från före återställningen', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/sakerhetskopior', {})).status).toBe(201);
    const fore = sandlada(app, k).kopieId;
    expect((await k.post('/api/reset', {})).status).toBe(200);
    expect(sandlada(app, k).kopieId).not.toBe(fore);
    expect(app.kopior.lista(fore)).toEqual([]);
    await k.logga('sysf');
    expect((await k.get('/api/sakerhetskopior')).data.kopior).toEqual([]);
  });

  test('fynd 3: efter inläsning av en kopia är sessionen utloggad, och en roll med faktor i kopian kräver faktorn', async () => {
    const k = klient(app);
    await k.logga('sysf');
    await k.post('/api/reset', {});
    await totp(k, 'lak-kard');
    await k.logga('sysf');
    const tid = (await k.post('/api/sakerhetskopior', {})).data.kopia.tid;
    await Bun.sleep(1100);
    // Faktorn försvinner efter kopian (som om den hade tagits bort).
    sandlada(app, k).db.query("DELETE FROM flerfaktorer WHERE agare_id = 'lak-kard'").run();
    const r = await aterstall(k, tid);
    expect(r.status).toBe(200);
    expect(r.data.utloggad).toBe(true);
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
    const login = await k.post('/api/login', { personalId: 'lak-kard' });
    expect(login.data.flerfaktor?.metoder).toEqual(['totp']);
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
  });

  test('fynd 3: en faktor som registrerades efter kopian finns kvar efter inläsningen', async () => {
    const k = klient(app);
    const tid = await nyMedKopia(k);
    await totp(k, 'lak-kard');
    expect((await aterstall(k, tid)).status).toBe(200);
    const login = await k.post('/api/login', { personalId: 'lak-kard' });
    expect(login.data.flerfaktor?.metoder).toEqual(['totp']);
  });

  test('fynd 4: en ensam systemförvaltare kan inte läsa in en kopia, och förslaget säger vad som går förlorat', async () => {
    const k = klient(app);
    const tid = await nyMedKopia(k);
    mat(k);
    const f = await k.post('/api/sakerhetskopior/aterstall', { tid });
    expect(f.status).toBe(202);
    expect(f.data.vantar).toBe(true);
    expect(f.data.forlust).toEqual(expect.arrayContaining([{ text: 'mätvärden', antal: 1 }]));
    expect(antalMat(k)).toBe(1);
    // Samma person kan inte godkänna sitt eget förslag.
    const sjalv = await k.post('/api/sakerhetskopior/aterstall/godkann', {});
    expect(sjalv.status).toBe(403);
    expect(antalMat(k)).toBe(1);
    expect((await k.get('/api/sakerhetskopior')).data.vantande).toMatchObject({ tid, av: 'Tomas Lindh' });
    await k.logga('sysf-2');
    const ok = await k.post('/api/sakerhetskopior/aterstall/godkann', {});
    expect(ok.status).toBe(200);
    expect(antalMat(k)).toBe(0);
  });

  test('fynd 4: en spärr som har registrerats efter kopian stoppar inläsningen med en förklaring, också mellan förslag och godkännande', async () => {
    const k = klient(app);
    const tid = await nyMedKopia(k);
    const db = () => sandlada(app, k).db;
    db().query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p01', 'uso-kard', ?)").run(new Date().toISOString());
    const r = await k.post('/api/sakerhetskopior/aterstall', { tid });
    expect(r.status).toBe(409);
    expect(r.data.fel).toContain('spärr');
    db().query('DELETE FROM sparrar WHERE id = (SELECT max(id) FROM sparrar)').run();
    expect((await k.post('/api/sakerhetskopior/aterstall', { tid })).status).toBe(202);
    // En spärr hävs efter förslaget.
    db().query('UPDATE sparrar SET aktiv = 0 WHERE id = (SELECT min(id) FROM sparrar)').run();
    await k.logga('sysf-2');
    const g = await k.post('/api/sakerhetskopior/aterstall/godkann', {});
    expect(g.status).toBe(409);
    expect(g.data.fel).toContain('spärr');
  });
});

// Fynd 7, 8 och 11.
describe('Säkerhetsfynd 7, 8 och 11: flerfaktorn och parametrarnas namn', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());
  async function medTotp(id) {
    const k = klient(app);
    await k.logga(id);
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    const r = await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) });
    expect(r.status).toBe(201);
    return { k, h, fid: r.data.faktorer[0].id };
  }

  test('fynd 7: en aktiv faktor vars nyckel inte går att dekryptera stoppar inloggningen och loggas, i stället för att släppa igenom', async () => {
    const { k } = await medTotp('adm-kard');
    await k.post('/api/logout');
    sandlada(app, k).db.query("UPDATE flerfaktorer SET hemlighet = ? WHERE agare_id = 'adm-kard'").run(ff.kryptera('ABCDEFGHIJKLMNOPQRST', 'personal:annan'));
    const r = await k.post('/api/login', { personalId: 'adm-kard' });
    expect(r.status).toBe(403);
    expect(r.data.fel).toContain('kan inte prövas');
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
    const sl = sandlada(app, k).db.query("SELECT beskrivning FROM sakerhetslogg WHERE beskrivning LIKE '%kan inte prövas%'").all();
    expect(sl.length).toBeGreaterThanOrEqual(1);
  });

  test('fynd 8: en faktor tas bara bort efter en färsk bekräftelse med en faktor', async () => {
    const { k, h, fid } = await medTotp('lak-kard');
    // Registreringen för mer än fem minuter sedan räknas inte som färsk.
    sandlada(app, k).flerfaktorTid = Date.now() - 6 * 60_000;
    const r = await k.post(`/api/flerfaktor/${fid}/ta-bort`, {});
    expect(r.status).toBe(403);
    expect(r.data.kod).toBe('bekrafta_faktor');
    expect((await k.get('/api/flerfaktor')).data.aktiv).toBe(true);
    // En fel kod räcker inte, en rätt kod gör det.
    expect((await k.post(`/api/flerfaktor/${fid}/ta-bort`, { kod: '000000' === ff.totp(h, Date.now() + 30_000) ? '111111' : '000000' })).status).toBe(400);
    const ok = await k.post(`/api/flerfaktor/${fid}/ta-bort`, { kod: ff.totp(h, Date.now() + 30_000) });
    expect(ok.status).toBe(200);
    expect(ok.data.aktiv).toBe(false);
  });

  test('fynd 11: parametrar med namn som __proto__ och constructor finns inte, i förhandsvisningen och i förslaget', async () => {
    const k = klient(app);
    await k.logga('sysf');
    for (const nyckel of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const f = await k.post('/api/konfiguration/forhandsvisa', { nyckel, varde: 1 });
      expect(f.status).toBe(404);
      expect(f.data.fel).toBe('Parametern finns inte.');
      const p = await k.post('/api/konfiguration', { nyckel, varde: 1, motivering: 'Prov av namnet.' });
      expect(p.status).toBe(404);
    }
    expect(sandlada(app, k).db.query("SELECT count(*) AS n FROM konfig_andringar WHERE nyckel IN ('__proto__', 'constructor', 'toString', 'hasOwnProperty')").get().n).toBe(0);
  });
});
