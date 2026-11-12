// Sandlådor som vilar på disk, inga tappade sandlådor och en vänlig sida när demon är full (runda 13, r2).
// Tiderna skickas in som fasta värden, och katalogerna är egna för testet.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nySessionsDb } from '../src/db.js';
import * as vila from '../src/sandlada-vila.js';
import * as ff from '../src/flerfaktor.js';
import * as prenumeration from '../src/prenumeration.js';
import { testserver, klient, sandlada } from './hjalp.js';

const tmp = () => mkdtempSync(join(import.meta.dir, '..', '.testtmp-vila-'));
const MIN = 60_000;
// Ett mätvärde som testet själv registrerar, så att det syns om sandlådan har tappats eller bytts.
const markera = (k, varde = '71') => k.post('/api/patient/p01/matvarden', { typ: 'puls', varde });
// Anropet går genom servern, som läser in sandlådan om den vilar. Sedan kontrolleras att markeringen finns i den.
const harMarkering = async (app, k, varde = '71') => {
  const r = await k.get('/api/patient/p01/matvarden');
  return r.status === 200 && sandlada(app, k).db.query("SELECT count(*) AS n FROM matvarden WHERE typ = 'puls' AND CAST(varde AS TEXT) = ?").get(varde).n > 0;
};

describe('Vilande sandlådor: lagret', () => {
  let dir;
  beforeAll(() => { dir = tmp(); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('en sandlåda skrivs komprimerad till disk under ett namn som inte röjer id:t och läses in oförändrad', () => {
    const lager = vila.skapaVilolager({ katalog: dir });
    const db = nySessionsDb();
    try {
      const id = 'K'.repeat(32);
      const data = db.serialize();
      const r = lager.vila(id, data, { kopior: [['a', { x: 1 }]] });
      expect(r.byte).toBeLessThan(data.byteLength / 4);
      const filer = readdirSync(dir);
      expect(filer).toEqual([`${lager.namn(id)}.vila`]);
      expect(filer.join('')).not.toContain(id);
      expect(lager.byte()).toBe(r.byte);
      expect(lager.antal()).toBe(1);
      const ut = lager.vakna(id);
      expect(ut.meta).toEqual({ kopior: [['a', { x: 1 }]] });
      expect(Buffer.compare(Buffer.from(ut.data), Buffer.from(data))).toBe(0);
      // Ett nytt lager över samma katalog räknar med filerna som finns.
      expect(vila.skapaVilolager({ katalog: dir }).byte()).toBe(r.byte);
      lager.radera(id);
      expect(readdirSync(dir)).toEqual([]);
      expect(lager.vakna(id)).toBeNull();
      lager.vila('A'.repeat(32), data, {});
      lager.vila('B'.repeat(32), data, {});
      expect(lager.stada(['A'.repeat(32)])).toBe(1);
      expect(lager.finns('A'.repeat(32))).toBe(true);
      expect(lager.finns('B'.repeat(32))).toBe(false);
    } finally { db.close(); }
  });

  test('taket i minnet räknas ur containerns minnesgräns, och utan gräns gäller standardvärdet', () => {
    expect(vila.minnesgrans(() => 'max\n')).toBeNull();
    expect(vila.minnesgrans(() => `${512 * 1048576}\n`)).toBe(512 * 1048576);
    expect(vila.maxIMinnet(null)).toBe(40);
    const m512 = vila.maxIMinnet(512 * 1048576);
    const m1g = vila.maxIMinnet(1024 * 1048576);
    expect(m512).toBeGreaterThanOrEqual(2);
    expect(m1g).toBeGreaterThan(m512);
    expect(vila.besokareFor(1024)).toBe(m1g);
    // Det räknade taket får plats i gränsen med marginal.
    expect(vila.MATT.basMb + m512 * vila.MATT.perSandladaMb).toBeLessThan(512);
  });

  // Vågen i lasttestet 2026-11-12: med 0,75 processor höll 65 platser svarstidsmålet, medan 110 platser gav p95 över två
  // sekunder. Taket räknas därför också ur processorerna.
  test('taket i minnet räknas också ur containerns processorer, så att fler platser aldrig ger längre svarstider än målet', () => {
    expect(vila.processorer(() => '75000 100000\n')).toBe(0.75);
    expect(vila.processorer(() => 'max 100000\n')).toBeNull();
    expect(vila.maxIMinnet(2048 * 1048576, { cpu: 0.75 })).toBe(Math.floor(0.75 * vila.PER_PROCESSOR));
    expect(vila.maxIMinnet(512 * 1048576, { cpu: 4 })).toBe(vila.maxIMinnet(512 * 1048576));
    expect(vila.maxIMinnet(null, { cpu: 0.5 })).toBe(Math.min(40, Math.floor(0.5 * vila.PER_PROCESSOR)));
  });

  test('tiden tills det är lönt att försöka igen räknas ur när den första platsen blir ledig, inom rimliga gränser', () => {
    const nu = 1_000_000;
    expect(vila.forsokIgenOm([nu + 5 * MIN, nu + 2 * MIN], nu)).toBe(120);
    expect(vila.forsokIgenOm([nu + 1000], nu)).toBe(30);
    expect(vila.forsokIgenOm([], nu)).toBe(15 * 60);
    expect(vila.forsokIgenOm([nu + 20 * 3600_000], nu)).toBe(15 * 60);
  });
});

describe('Vilande sandlådor i servern', () => {
  let app, dir;
  const mottaget = [];
  beforeAll(() => {
    dir = tmp();
    app = testserver({ vilaKatalog: join(dir, 'vila'), kopieKatalog: join(dir, 'k1'), kopieAndra: join(dir, 'k2'), kopieMinuter: 0, maxIMinnet: 3, maxSandlador: 50,
      oppetApiVal: { skicka: async (adress, kropp) => { mottaget.push({ adress, kropp }); return { status: 'skickad', svar: 'HTTP 200' }; } } });
  });
  afterAll(() => { app.stopp(); rmSync(dir, { recursive: true, force: true }); });

  test('en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await markera(k)).status).toBe(201);
    const s = sandlada(app, k);
    expect(s.vilar).toBe(false);
    // Nio minuter utan användning räcker inte.
    app.vilaStadning(Date.now() + 9 * MIN);
    expect(s.vilar).toBe(false);
    app.vilaStadning(Date.now() + 11 * MIN);
    expect(s.vilar).toBe(true);
    expect(readdirSync(join(dir, 'vila')).filter(f => f.endsWith('.vila')).length).toBeGreaterThanOrEqual(1);
    expect(readdirSync(join(dir, 'vila')).join('')).not.toContain(s.kopieId);
    // Inloggningen och sandlådan finns kvar, och besökaren märker inget.
    const sess = await k.get('/api/session');
    expect(sess.data.inloggad).toBe(true);
    expect(sess.data.personal.id).toBe('lak-kard');
    expect(s.vilar).toBe(false);
    expect(await harMarkering(app, k)).toBe(true);
    expect(sandlada(app, k)).toBe(s);
  });

  test('en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar', async () => {
    const klienter = [];
    for (let i = 0; i < 8; i++) {
      const k = klient(app);
      await k.logga(i % 2 ? 'ssk-kard' : 'lak-kard');
      expect((await markera(k, String(60 + i))).status).toBe(201);
      klienter.push(k);
    }
    const vakna = () => [...app.sessioner.values()].filter(s => !s.vilar).length;
    expect(vakna()).toBeLessThanOrEqual(3);
    for (let i = 0; i < klienter.length; i++) {
      expect((await klienter[i].get('/api/session')).data.inloggad).toBe(true);
      expect(await harMarkering(app, klienter[i], String(60 + i))).toBe(true);
      expect(vakna()).toBeLessThanOrEqual(3);
    }
  }, 30_000);

  test('läskopians logg från läsläget tas emot för en sandlåda som vilar, utan inloggning', async () => {
    const k = klient(app);
    const ln = (await k.logga('lak-kard')).data.lasnyckel;
    await k.get('/api/lasekopia');
    const s = sandlada(app, k);
    app.vila(s);
    expect(s.vilar).toBe(true);
    const nyckel = await crypto.subtle.importKey('raw', Buffer.from(ln.nyckel, 'base64url'), 'AES-GCM', false, ['encrypt']);
    const rad = { id: crypto.randomUUID(), tid: new Date().toISOString(), patientId: 'p01', handling: 'las_oversikt', resurs: '/api/patient/p01' };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`vardkallan-laslogg|${ln.id}|lak-kard|${rad.id}`) }, nyckel, new TextEncoder().encode(JSON.stringify(rad)));
    const annan = klient(app);
    const r = await annan.post('/api/lasekopia/krypterad-logg', { kopiaId: ln.id, rader: [{ id: rad.id, iv: Buffer.from(iv).toString('base64url'), data: Buffer.from(data).toString('base64url') }] });
    expect(r.data).toEqual({ mottagna: 1, avvisade: [] });
    expect(annan.kaka()).toBeNull();
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = 'laslage:/api/patient/p01'").get().n).toBe(1);
  });

  test('flerfaktor: en inloggning som väntar på engångskoden fortsätter efter att sandlådan har vilat', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const hemlighet = ff.fran32(b.nyckel);
    expect((await k.post('/api/flerfaktor/totp', { kod: ff.totp(hemlighet, Date.now()) })).status).toBe(201);
    await k.post('/api/logout');
    expect((await k.post('/api/login', { personalId: 'adm-kard' })).data.flerfaktor.metoder).toEqual(['totp']);
    app.vila(sandlada(app, k));
    const r = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: ff.totp(hemlighet, Date.now() + 30_000) });
    expect(r.data.inloggad).toBe(true);
  });

  test('prenumerationer ger meddelanden också efter att sandlådan har vilat', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const sub = { resourceType: 'Subscription', status: 'requested', reason: 'Regionalt vårddatalager', criteria: 'Observation?patient=p01', channel: { type: 'rest-hook', endpoint: prenumeration.GODKANDA_MOTTAGARE[0], payload: 'application/fhir+json' } };
    expect((await k.raw('POST', '/fhir/Subscription', sub)).status).toBe(201);
    app.vila(sandlada(app, k));
    const fore = mottaget.length;
    expect((await markera(k, '83')).status).toBe(201);
    await Bun.sleep(20);
    expect(mottaget.length).toBe(fore + 1);
  });

  test('intensivvårdens realtidsvisning från den kopplade monitorn fortsätter efter att sandlådan har vilat', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    expect((await k.post('/api/patient/p22/mt/koppla', { streckkod: 'MT-MON-0005' })).status).toBe(201);
    expect((await k.get('/api/patient/p22/iva/realtid')).data.kopplad).toBe(true);
    app.vila(sandlada(app, k));
    // Visningen hämtar som ett bakgrundsanrop.
    const r = await k.get('/api/patient/p22/iva/realtid', { 'X-Vk-Bakgrund': '1' });
    expect(r.status).toBe(200);
    expect(r.data.kopplad).toBe(true);
    expect(r.data.kurvor.map(x => x.id)).toEqual(['ekg', 'art', 'pleth', 'andning']);
  });

  test('miljöer för acceptanstest: miljön och produktionsmiljön hittar varandra efter att båda har vilat', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const m = await k.post('/api/miljoer', { typ: 'acceptanstest' });
    expect(m.status).toBe(201);
    const prod = sandlada(app, k);
    const miljo = prod.miljoer[0].s;
    app.vila(prod);
    app.vila(miljo);
    const oppna = await fetch(app.url + m.data.adress, { headers: { Cookie: k.kaka() }, redirect: 'manual' });
    expect(oppna.status).toBe(302);
    const kaka = oppna.headers.get('set-cookie').split(';')[0];
    const imiljo = await fetch(`${app.url}/api/session`, { headers: { Cookie: kaka } }).then(x => x.json());
    expect(imiljo.miljo.typ).toBe('acceptanstest');
    app.vila(miljo);
    app.vila(prod);
    const tillbaka = await fetch(`${app.url}/api/miljoer/tillbaka`, { method: 'POST', headers: { Cookie: kaka, 'Content-Type': 'application/json' }, body: '{}' });
    expect(tillbaka.status).toBe(200);
    const ny = tillbaka.headers.get('set-cookie').split(';')[0];
    expect((await fetch(`${app.url}/api/miljoer`, { headers: { Cookie: ny } }).then(x => x.json())).skapade.length).toBe(1);
  });

  test('kalenderlänken fungerar för en sandlåda som vilar, och en okänd länk väcker inga sandlådor', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const token = (await k.post('/api/kalender/lank')).data.adress.split('/').at(-1).replace('.ics', '');
    const s = sandlada(app, k);
    // Efter en omstart finns inte länken i minnet, bara i sandlådan.
    app.glomKalenderlankar?.();
    app.vila(s);
    for (const x of app.sessioner.values()) app.vila(x);
    const okand = await fetch(`${app.url}/api/kalender/vkcal_${'Q'.repeat(32)}.ics`);
    expect(okand.status).toBe(404);
    expect([...app.sessioner.values()].every(x => x.vilar)).toBe(true);
    const ics = await fetch(`${app.url}/api/kalender/${token}.ics`);
    expect(ics.status).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');
    expect([...app.sessioner.values()].filter(x => !x.vilar)).toEqual([s]);
  });

  test('sidan om systemets uppbyggnad och driftsidan väcker inga andra sandlådor', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const egen = sandlada(app, k);
    for (const x of app.sessioner.values()) app.vila(x);
    expect((await k.get('/api/arkitektur')).status).toBe(200);
    const d = (await k.get('/api/drift')).data;
    expect([...app.sessioner.values()].filter(x => !x.vilar)).toEqual([egen]);
    expect(d.kapacitet).toMatchObject({ iMinnet: 1, maxIMinnet: 3, maxSandlador: 50, vilaMinuter: 10 });
    expect(d.kapacitet.vilar).toBe(app.sessioner.size - 1);
    expect(d.kapacitet.minne.rssMb).toBeGreaterThan(0);
  });

  test('en sandlåda som inte har använts på åtta timmar försvinner, också från disk och med sina säkerhetskopior', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/sakerhetskopior', {})).status).toBe(201);
    const s = sandlada(app, k);
    app.vila(s);
    expect(app.vilolager.finns(s.kopieId)).toBe(true);
    app.stadning(Date.now() + 8 * 3600_000 + MIN);
    expect([...app.sessioner.values()].includes(s)).toBe(false);
    expect(app.vilolager.finns(s.kopieId)).toBe(false);
    expect(app.kopior.lista(s.kopieId)).toEqual([]);
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
  });
});

describe('När demon är full', () => {
  test('en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget', async () => {
    const app = testserver({ maxIMinnet: 10, maxSandlador: 3 });
    try {
      const k = [klient(app), klient(app), klient(app)];
      for (const x of k) await x.logga('lak-kard');
      const ny = klient(app);
      const r = await ny.get('/api/session');
      expect(r.status).toBe(503);
      expect(r.data.kod).toBe('demo_full');
      expect(r.data.fel).toContain('många besökare');
      expect(r.data.orsak).toBe('disk');
      expect(r.data.forsokIgenSekunder).toBeGreaterThanOrEqual(30);
      expect(Number(r.headers.get('retry-after'))).toBe(r.data.forsokIgenSekunder);
      expect(r.headers.get('x-vk-full')).toBe('1');
      expect(ny.kaka()).toBeNull();
      expect(app.sessioner.size).toBe(3);
      for (const x of k) expect((await x.get('/api/session')).data.inloggad).toBe(true);
      // Hälsokontrollen och de offentliga sidorna svarar som vanligt.
      expect((await fetch(`${app.url}/api/health`)).status).toBe(200);
      expect((await fetch(`${app.url}/api/drift`)).status).toBe(200);
    } finally { app.stopp(); }
  });

  test('när alla platser i minnet används just nu får en ny besökare vänta, men en besökare vars sandlåda vilar kommer alltid in', async () => {
    const app = testserver({ maxIMinnet: 2, maxSandlador: 50, tryggSekunder: 20 });
    try {
      const a = klient(app); await a.logga('lak-kard'); await markera(a, '91');
      const b = klient(app); await b.logga('ssk-kard');
      // Båda platserna används just nu, så en tredje besökare får vänta.
      const ny = await klient(app).get('/api/session');
      expect(ny.status).toBe(503);
      expect(ny.data.orsak).toBe('minne');
      expect(ny.data.forsokIgenSekunder).toBeLessThanOrEqual(120);
      expect(app.sessioner.size).toBe(2);
      // a har gått ifrån en stund, och dess sandlåda vilar. c får platsen.
      app.vila(sandlada(app, a));
      const c = klient(app); await c.logga('lak-kard');
      expect(await klient(app).get('/api/session').then(r => r.status)).toBe(503);
      // a kommer tillbaka och får sin sandlåda; den som har varit oanvänd längst flyttas till disk.
      await Bun.sleep(1100);
      expect(await harMarkering(app, a, '91')).toBe(true);
      expect([...app.sessioner.values()].filter(s => !s.vilar).length).toBeLessThanOrEqual(2);
    } finally { app.stopp(); }
  });
});

describe('Omstart med vilande sandlådor', () => {
  test('vid stopp skrivs sandlådorna till disk, sessionsfilen har inga databaser, och efter start vilar de tills de används', async () => {
    const dir = tmp();
    const fil = join(dir, 'sessioner.json');
    const a = testserver({ sessionFil: fil, maxIMinnet: 5 });
    const k = klient(a);
    await k.logga('lak-kard');
    await markera(k, '77');
    expect(a.spara()).toBe(1);
    a.stopp();
    const sparat = readFileSync(fil, 'utf8');
    expect(sparat.length).toBeLessThan(20_000);
    expect(JSON.parse(sparat)[0].db).toBeUndefined();
    const b = testserver({ sessionFil: fil, maxIMinnet: 5 });
    try {
      expect(b.sessioner.size).toBe(1);
      const s = [...b.sessioner.values()][0];
      expect(s.vilar).toBe(true);
      const sess = await fetch(`${b.url}/api/session`, { headers: { Cookie: k.kaka() } }).then(x => x.json());
      expect(sess.inloggad).toBe(true);
      expect(s.vilar).toBe(false);
      expect(s.db.query("SELECT count(*) AS n FROM matvarden WHERE varde = '77'").get().n).toBe(1);
    } finally { b.stopp(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('en sessionsfil från version 1.2, med databaserna i filen, läses in som vilande sandlådor', async () => {
    const dir = tmp();
    const fil = join(dir, 'sessioner.json');
    const db = nySessionsDb();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES ('p01', 'uso-kard', 'puls', '66', ?, 'lak-kard')").run(new Date().toISOString());
    const sid = 'S'.repeat(32);
    writeFileSync(fil, JSON.stringify([{ v: 1, sid, personalId: null, invanareId: null, val: {}, sist: Date.now(), aktiv: Date.now(), db: Buffer.from(db.serialize()).toString('base64'), lasnyckel: null, oppnade: [], kopieId: 'T'.repeat(32), kopior: [] }]));
    db.close();
    const b = testserver({ sessionFil: fil, maxIMinnet: 5 });
    try {
      const s = b.sessioner.get(sid);
      expect(s.vilar).toBe(true);
      expect(s.db.query("SELECT count(*) AS n FROM matvarden WHERE varde = '66'").get().n).toBe(1);
    } finally { b.stopp(); rmSync(dir, { recursive: true, force: true }); }
  });
});

// Vågen i lasttestet 2026-11-12: en registrering misslyckades ibland på en anslutning som servern hade stängt efter tio
// sekunder utan anrop, medan besökaren läste (Bun stänger annars efter 10 till 12 sekunder). Servern håller nu vilande
// anslutningar öppna längre än en lång betänketid.
describe('Anslutningar', () => {
  test('en anslutning som har varit tyst i sexton sekunder kan användas för nästa anrop', async () => {
    const app = testserver();
    const net = require('node:net');
    try {
      const sock = net.connect(app.port, '127.0.0.1');
      await new Promise((r, f) => { sock.once('connect', r); sock.once('error', f); });
      let data = '';
      sock.on('data', (d) => { data += d.toString(); });
      const fraga = 'GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n';
      const antal = () => (data.match(/HTTP\/1\.1 200/g) ?? []).length;
      const svar = async (n) => { const slut = Date.now() + 5000; while (antal() < n && Date.now() < slut) await Bun.sleep(20); return antal(); };
      sock.write(fraga);
      expect(await svar(1)).toBe(1);
      await Bun.sleep(16_000);
      expect(sock.readyState).toBe('open');
      sock.write(fraga);
      expect(await svar(2)).toBe(2);
      sock.destroy();
    } finally { app.stopp(); }
  }, 30_000);
});
