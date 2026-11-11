// Runda 13, r1: synpunkter från testare. De sparas i en egen databas som alla sandlådor delar, utan patientuppgifter och
// utan riktiga personnummer, och läses bara av testledaren med en läskod som skapas av ett skript på servern och bara
// sparas som hash. Den som lämnar en synpunkt kan inte läsa eller ändra den efteråt, men får ett kort nummer.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { testserver, klient } from './hjalp.js';
import * as sp from '../src/synpunkter.js';
import { TYPER, ALLVAR, SYSTEM, AR, VARDFORM, MAX_TEXT, MAX_KONTAKT, GALLRING_DAGAR, KONTAKT_DAGAR, SPARAS, kandidater } from '../public/js/synpunkt-regler.js';

let app;
beforeAll(() => { app = testserver({ synpunktFil: ':memory:' }); });
afterAll(() => app.stopp());

const GRUND = { typ: 'svart', allvar: 'stor', text: 'Det tog lång tid att hitta var man ordinerar.', vy: '#/patient/p01/lakemedel', bredd: 390 };
const nyKod = () => sp.skapaLaskod(app.synpunkter.db, { namn: 'test' }).kod;

describe('Synpunkter', () => {
  test(`en testare lämnar en synpunkt utan inloggning och får ett kort nummer, och systemet fyller i version, gränssnitt, webbläsare och tid`, async () => {
    const k = klient(app);
    const r = await k.post('/api/synpunkter', GRUND, { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.39 Mobile Safari/537.36' });
    expect(r.status).toBe(201);
    expect(r.data.nummer).toMatch(/^S-[A-HJ-NP-Z2-9]{6}$/);
    // Svaret innehåller bara numret och vad som sparas, aldrig synpunkten själv.
    expect(JSON.stringify(r.data)).not.toContain('ordinerar');
    const kod = nyKod();
    const l = await klient(app).post('/api/testledare/synpunkter', { laskod: kod });
    expect(l.status).toBe(200);
    const s = l.data.synpunkter.find(x => x.nummer === r.data.nummer);
    expect(s).toMatchObject({ typ: 'svart', allvar: 'stor', text: GRUND.text, vy: '#/patient/p01/lakemedel', bredd: 390, roll: null, webblasare: 'Chrome 131, Android' });
    expect(s.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(s.gransnitt).toMatch(/^[0-9a-f]{12}$/);
    expect(Date.parse(s.tid)).toBeGreaterThan(Date.now() - 60_000);
    // Klientens påstådda version och tid används inte.
    const r2 = await k.post('/api/synpunkter', { ...GRUND, version: '9.9.9', tid: '2001-01-01T00:00:00Z', gransnitt: 'falsk', roll: 'sysf' });
    const s2 = (await klient(app).post('/api/testledare/synpunkter', { laskod: kod })).data.synpunkter.find(x => x.nummer === r2.data.nummer);
    expect(s2.version).not.toBe('9.9.9');
    expect(s2.gransnitt).not.toBe('falsk');
    expect(s2.roll).toBeNull();
  });

  test(`roll och yrke för det valda uppdraget fylls i av servern ur sessionen`, async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await k.post('/api/synpunkter', { ...GRUND, typ: 'fel' });
    const s = (await klient(app).post('/api/testledare/synpunkter', { laskod: nyKod() })).data.synpunkter.find(x => x.nummer === r.data.nummer);
    expect(s.roll).toBe('ssk-kard');
    expect(s.rollText).toBe('Johan Ek, Sjuksköterska');
  });

  test(`typ, allvar, yrke och journalsystem prövas mot listorna, och text och kontakt har en största längd`, async () => {
    const k = klient(app);
    expect((await k.post('/api/synpunkter', { ...GRUND, typ: 'okänd' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, allvar: 7 })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, yrke: 'astronaut' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, system: 'okänt' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, system: ['cosmic'] })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, ar: 'evigt' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, vardform: 'rymden' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, text: 'x'.repeat(MAX_TEXT + 1) })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, text: '  ' })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, text: ['en lista'] })).status).toBe(400);
    expect((await k.post('/api/synpunkter', { ...GRUND, kontakt: 'a'.repeat(MAX_KONTAKT + 1) })).status).toBe(400);
    const ok = await k.post('/api/synpunkter', { ...GRUND, yrke: 'lakare', system: 'cosmic', ar: '3-10', vardform: 'region', kontakt: 'testare@example.org' });
    expect(ok.status).toBe(201);
    const s = (await klient(app).post('/api/testledare/synpunkter', { laskod: nyKod() })).data.synpunkter.find(x => x.nummer === ok.data.nummer);
    expect(s).toMatchObject({ yrke: 'lakare', system: 'cosmic', ar: '3-10', vardform: 'region', kontakt: 'testare@example.org' });
    expect(TYPER.map(t => t[0])).toEqual(['fel', 'saknas', 'svart', 'vard', 'annat']);
    expect(ALLVAR).toHaveLength(3);
    expect(SYSTEM.map(t => t[1])).toEqual(expect.arrayContaining(['Cosmic', 'Take Care', 'Melior', 'NCS Cross', 'Pascal']));
    expect(VARDFORM.map(t => t[0])).toEqual(['region', 'kommun', 'privat', 'annan']);
    expect(AR.length).toBeGreaterThanOrEqual(4);
  });

  test(`ett riktigt personnummer tas inte emot i texten eller kontaktfältet, men testpersonnummer och demons patienter går bra`, async () => {
    const k = klient(app);
    // 19800101-0019 har rätt kontrollsiffra men är inget av Skatteverkets testpersonnummer.
    for (const t of ['Patienten 19800101-0019 fick fel dos', 'pnr 800101-0019', '8001010019', '19800101 0019', 'samordningsnummer 19800161-0016']) {
      const r = await k.post('/api/synpunkter', { ...GRUND, text: t });
      expect(r.status).toBe(400);
      expect(r.data.fel).toContain('personnummer');
      expect(r.data.falt).toEqual(['text']);
    }
    const kr = await k.post('/api/synpunkter', { ...GRUND, kontakt: 'ring 19800101-0019' });
    expect(kr.status).toBe(400);
    expect(kr.data.falt).toEqual(['kontakt']);
    // Skatteverkets testpersonnummer, en demopatients nummer och vanliga tal går bra.
    for (const t of ['Patienten 19901116-2964 visades fel', 'Testa 189001019802', 'Blodtrycket 120/80 och puls 72, 3 doser', 'Telefon +46701234567']) {
      expect((await k.post('/api/synpunkter', { ...GRUND, text: t })).status).toBe(201);
    }
    expect(kandidater('ring 070-123 45 67 eller 19901116-2964')).toEqual(['070-123 45 67', '19901116-2964']);
  });

  test(`HTML tas inte emot, och styrtecken och riktningstecken tas bort`, async () => {
    const k = klient(app);
    const r = await k.post('/api/synpunkter', { ...GRUND, text: 'Knappen <script>alert(1)</script> syns inte' });
    expect(r.status).toBe(400);
    expect(r.data.falt).toEqual(['text']);
    expect((await k.post('/api/synpunkter', { ...GRUND, kontakt: '<a href="x">mejl</a>' })).status).toBe(400);
    // Mindre än och större än i vanlig text går bra.
    const ok = await k.post('/api/synpunkter', { ...GRUND, text: 'Kalium <3,5 ska larma‮osynligt\u0007' });
    expect(ok.status).toBe(201);
    const s = (await klient(app).post('/api/testledare/synpunkter', { laskod: nyKod() })).data.synpunkter.find(x => x.nummer === ok.data.nummer);
    expect(s.text).toBe('Kalium <3,5 ska larmaosynligt');
  });

  test(`vyn sparas bara som adressens väg, utan fråga och utan text, så att inga patientuppgifter följer med`, async () => {
    const k = klient(app);
    const r = await k.post('/api/synpunkter', { ...GRUND, vy: '#/sok?q=Elin Sandberg' });
    const r2 = await k.post('/api/synpunkter', { ...GRUND, vy: 'javascript:alert(1)' });
    const lista = (await klient(app).post('/api/testledare/synpunkter', { laskod: nyKod() })).data.synpunkter;
    expect(lista.find(x => x.nummer === r.data.nummer).vy).toBe('#/sok');
    expect(lista.find(x => x.nummer === r2.data.nummer).vy).toBe('okänd');
    expect(JSON.stringify(lista)).not.toContain('Elin');
  });

  test(`läsningen kräver en giltig läskod, och fel kod ger samma svar varje gång med ett tak på försöken`, async () => {
    const t = testserver({ synpunktFil: ':memory:' });
    try {
      const k = klient(t);
      for (const laskod of [undefined, '', 'fel', 'x'.repeat(43), 12345]) {
        const r = await k.post('/api/testledare/synpunkter', { laskod });
        expect(r.status).toBe(403);
        expect(r.data.fel).toBe('Läskoden gäller inte.');
      }
      // Efter tio fel försök i timmen från samma adress stoppas fler försök, också med rätt kod.
      for (let i = 0; i < 5; i++) await k.post('/api/testledare/synpunkter', { laskod: 'fel' });
      const kod = sp.skapaLaskod(t.synpunkter.db, { namn: 'x' }).kod;
      expect((await klient(t).post('/api/testledare/synpunkter', { laskod: kod })).status).toBe(429);
    } finally { t.stopp(); }
  });

  test(`läskoden är slumpad med minst 192 bitar, sparas bara som hash och kan återkallas`, () => {
    const db = sp.oppna(':memory:');
    const { kod, id } = sp.skapaLaskod(db, { namn: 'Testledare' });
    expect(Buffer.from(kod, 'base64url').length * 8).toBeGreaterThanOrEqual(192);
    const rader = db.query('SELECT * FROM synpunkt_laskoder').all();
    expect(JSON.stringify(rader)).not.toContain(kod);
    expect(rader[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sp.giltigLaskod(db, kod)).toBe(true);
    sp.aterkallaLaskod(db, id);
    expect(sp.giltigLaskod(db, kod)).toBe(false);
    db.close();
  });

  test(`tak per session och minut, per session och timme, per adress och dygn och totalt`, async () => {
    const t = testserver({ synpunktFil: ':memory:', synpunktTak: { perMinut: 3, perTimme: 4, perAdress: 6, totalt: 8 } });
    try {
      const a = klient(t);
      for (let i = 0; i < 3; i++) expect((await a.post('/api/synpunkter', GRUND)).status).toBe(201);
      const r = await a.post('/api/synpunkter', GRUND);
      expect(r.status).toBe(429);
      expect(r.data.fel).toContain('minut');
      // En annan session från samma adress: taket per adress och dygn.
      const b = klient(t);
      for (let i = 0; i < 3; i++) expect((await b.post('/api/synpunkter', GRUND)).status).toBe(201);
      const r2 = await b.post('/api/synpunkter', GRUND);
      expect(r2.status).toBe(429);
      // Adressen sparas bara som HMAC med en hemlig nyckel.
      const rader = t.synpunkter.db.query('SELECT skapare FROM synpunkter').all();
      expect(rader.every(x => /^[0-9a-f]{64}$/.test(x.skapare))).toBe(true);
      expect(JSON.stringify(rader)).not.toContain('127.0.0.1');
    } finally { t.stopp(); }
    const t2 = testserver({ synpunktFil: ':memory:', synpunktTak: { perMinut: 100, perTimme: 100, perAdress: 100, totalt: 2 } });
    try {
      const a = klient(t2);
      expect((await a.post('/api/synpunkter', GRUND)).status).toBe(201);
      expect((await a.post('/api/synpunkter', GRUND)).status).toBe(201);
      const r = await a.post('/api/synpunkter', GRUND);
      expect(r.status).toBe(503);
      expect(r.data.fel).toContain('tar inte emot fler synpunkter');
    } finally { t2.stopp(); }
  });

  test(`export som CSV och Markdown, utan klickbara länkar, utan formler och utan HTML`, async () => {
    const t = testserver({ synpunktFil: ':memory:' });
    try {
      const k = klient(t);
      await k.post('/api/synpunkter', { ...GRUND, text: 'Se https://exempel.example/sida och www.exempel.example | *fet* [länk](http://x.example)' });
      await k.post('/api/synpunkter', { ...GRUND, typ: 'fel', text: '=HYPERLINK("http://x.example","klicka")' });
      const kod = sp.skapaLaskod(t.synpunkter.db, { namn: 'x' }).kod;
      const csv = await klient(t).post('/api/testledare/export', { laskod: kod, format: 'csv' });
      expect(csv.status).toBe(200);
      expect(csv.headers.get('content-type')).toContain('text/csv');
      expect(csv.headers.get('content-disposition')).toMatch(/attachment; filename="synpunkter-\d{4}-\d{2}-\d{2}\.csv"/);
      expect(csv.data).toContain(';"\'=HYPERLINK');
      const md = await klient(t).post('/api/testledare/export', { laskod: kod, format: 'md' });
      expect(md.headers.get('content-type')).toContain('text/markdown');
      expect(md.data).not.toContain('https://');
      expect(md.data).not.toContain('](http');
      expect(md.data).toContain('hxxps://exempel.example/sida');
      expect(md.data).toContain('\\*fet\\*');
      // Filtret gäller också exporten.
      const fel = await klient(t).post('/api/testledare/export', { laskod: kod, format: 'md', filter: { typ: 'fel' } });
      expect(fel.data).toContain('HYPERLINK');
      expect(fel.data).not.toContain('exempel.example');
      expect((await klient(t).post('/api/testledare/export', { laskod: 'fel', format: 'csv' })).status).toBe(403);
    } finally { t.stopp(); }
  });

  test(`synpunkterna överlever en omstart i en fil bredvid sandlådorna, och nyckeln för adresserna också`, async () => {
    const kat = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'vk-synp-'));
    try {
      const sessionFil = join(kat, 'sessioner.json');
      const t = testserver({ sessionFil });
      const r = await klient(t).post('/api/synpunkter', GRUND);
      expect(r.status).toBe(201);
      t.stopp();
      expect(existsSync(join(kat, 'synpunkter.sqlite'))).toBe(true);
      expect(readFileSync(join(kat, 'synpunkter.nyckel'), 'utf8')).toMatch(/^[0-9a-f]{64}$/);
      const t2 = testserver({ sessionFil });
      try {
        const kod = sp.skapaLaskod(t2.synpunkter.db, { namn: 'x' }).kod;
        const l = await klient(t2).post('/api/testledare/synpunkter', { laskod: kod });
        expect(l.data.synpunkter.map(x => x.nummer)).toContain(r.data.nummer);
      } finally { t2.stopp(); }
    } finally { rmSync(kat, { recursive: true, force: true }); }
  });

  test(`gallring: kontaktuppgiften raderas efter ${KONTAKT_DAGAR} dagar och synpunkten efter ${GALLRING_DAGAR} dagar`, () => {
    const db = sp.oppna(':memory:');
    const nu = new Date('2026-11-12T10:00:00Z');
    const bas = { adress: '10.0.0.1', session: {}, version: '1.3.0', gransnitt: 'a'.repeat(64), webblasare: 'Firefox 140, Linux' };
    sp.spara(db, { ...GRUND, kontakt: 'x@example.org' }, { ...bas, nu });
    sp.stada(db, { nu: new Date(nu.getTime() + (KONTAKT_DAGAR + 1) * 86400_000) });
    expect(db.query('SELECT kontakt FROM synpunkter').get().kontakt).toBe('');
    sp.stada(db, { nu: new Date(nu.getTime() + (GALLRING_DAGAR + 1) * 86400_000) });
    expect(db.query('SELECT count(*) n FROM synpunkter').get().n).toBe(0);
    expect(SPARAS.length).toBeGreaterThanOrEqual(5);
    db.close();
  });

  test(`de nya synpunkterna som Markdown för skriptet på servern, en gång var`, () => {
    const db = sp.oppna(':memory:');
    const bas = { adress: '10.0.0.1', session: {}, version: '1.3.0', gransnitt: 'a'.repeat(64), webblasare: 'Firefox 140, Linux', nu: new Date('2026-11-12T10:00:00Z') };
    sp.spara(db, { ...GRUND, text: 'Första synpunkten' }, bas);
    const forsta = sp.nyaSomMarkdown(db);
    expect(forsta.antal).toBe(1);
    expect(forsta.text).toContain('Första synpunkten');
    expect(forsta.text).toContain('Svårt eller krångligt');
    expect(sp.nyaSomMarkdown(db).antal).toBe(0);
    sp.spara(db, { ...GRUND, text: 'Andra synpunkten' }, { ...bas, session: {} });
    const andra = sp.nyaSomMarkdown(db);
    expect(andra.antal).toBe(1);
    expect(andra.text).not.toContain('Första');
    db.close();
  });

  test(`skriptet på servern skapar en läskod som visas en gång och skriver ut de nya synpunkterna som Markdown`, () => {
    const kat = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'vk-synp-skript-'));
    try {
      const fil = join(kat, 'synpunkter.sqlite');
      const kor = (...a) => Bun.spawnSync(['bun', join(import.meta.dir, '..', 'scripts', 'testinbjudan.js'), ...a], { env: { ...process.env, SYNPUNKT_FIL: fil } });
      const ny = kor('ny-laskod', 'Testledare');
      expect(ny.exitCode).toBe(0);
      const kod = ny.stdout.toString().match(/\n\n([A-Za-z0-9_-]{43})\n\n/)[1];
      const db = sp.oppna(fil);
      expect(sp.giltigLaskod(db, kod)).toBe(true);
      sp.spara(db, { ...GRUND, text: 'Från skriptet' }, { adress: '10.0.0.2', session: {}, version: '1.3.0', gransnitt: 'b'.repeat(64) });
      db.close();
      expect(kor('laskoder').stdout.toString()).not.toContain(kod);
      expect(kor('nya').stdout.toString()).toContain('Från skriptet');
      expect(kor('nya').stdout.toString()).toContain('0 nya synpunkter');
      expect(kor('aterkalla', '1').stdout.toString()).toContain('återkallad');
      expect(kor('okänt').exitCode).toBe(2);
    } finally { rmSync(kat, { recursive: true, force: true }); }
  });

  test(`webbläsaren sparas som namn, huvudversion och operativsystem, aldrig hela rubriken`, () => {
    expect(sp.webblasare('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70')).toBe('Edge 131, Windows');
    expect(sp.webblasare('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe('Safari 18, iOS');
    expect(sp.webblasare('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe('Firefox 140, Linux');
    expect(sp.webblasare('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')).toBe('Chrome 131, macOS');
    expect(sp.webblasare('curl/8.0')).toBe('Okänd');
    expect(sp.webblasare(undefined)).toBe('Okänd');
  });
});
