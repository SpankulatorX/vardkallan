// Runda 13, r3 (vårt L5, beslut från Jonas): vårdgivaren kan kräva flerfaktor vid inloggning. Parametern
// sakerhet.flerfaktor_kravs ändras med fyra ögon som andra parametrar, står på nej i demon och är en demoregel. När
// den står på ja får ingen behörighet förrän den andra faktorn är bekräftad, och den som saknar en faktor leds direkt
// till att registrera en. Testnamnen används i kravregistret (krav.js).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, personal } from './hjalp.js';
import { datumAv } from '../src/db.js';
import * as konfiguration from '../src/konfiguration.js';
import * as ff from '../src/flerfaktor.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const NYCKEL = 'sakerhet.flerfaktor_kravs';
// Den ena systemförvaltaren föreslår och den andra godkänner, i sandlådans databas.
function kravFlerfaktor(db, varde = true) {
  const nu = new Date();
  const { andring } = konfiguration.foresla(db, personal(db, 'sysf'), { nyckel: NYCKEL, varde, giltigFran: datumAv(nu), motivering: 'Prov.' }, nu);
  return konfiguration.godkann(db, personal(db, 'sysf-2'), andring.id, {}, nu).andring;
}

describe('Flerfaktor som krav', () => {
  test('parametern Flerfaktor krävs vid inloggning är en demoregel som står på nej och ändras med fyra ögon', () => {
    const k = klient(app);
    const def = konfiguration.parametrar()[NYCKEL];
    expect(def).toMatchObject({ omrade: 'sakerhet', typ: 'janej', standard: false });
    expect(def.rubrik).toBe('Flerfaktor krävs vid inloggning');
    expect(def.beskrivning).toContain('Demoregel');
    return k.logga('lak-kard').then(() => {
      const db = sandlada(app, k).db;
      expect(konfiguration.varde(db, NYCKEL)).toBe(false);
      const { andring } = konfiguration.foresla(db, personal(db, 'sysf'), { nyckel: NYCKEL, varde: 'ja', giltigFran: datumAv(new Date()), motivering: 'Prov.' });
      // Samma systemförvaltare kan inte godkänna sin egen ändring.
      expect(fel(() => konfiguration.godkann(db, personal(db, 'sysf'), andring.id, {})).message).toContain('Fyra ögon');
      expect(konfiguration.varde(db, NYCKEL)).toBe(false);
      konfiguration.godkann(db, personal(db, 'sysf-2'), andring.id, {});
      expect(konfiguration.varde(db, NYCKEL)).toBe(true);
    });
  });

  test('med kravet på ja leds den som saknar faktor till att registrera en, och får ingen behörighet eller läskopia förrän den är bekräftad', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    kravFlerfaktor(sandlada(app, k).db);
    await k.post('/api/logout');
    const forsta = await k.post('/api/login', { personalId: 'ssk-kard' });
    expect(forsta.status).toBe(200);
    expect(forsta.data.inloggad).toBe(false);
    expect(forsta.data.lasnyckel).toBeUndefined();
    expect(forsta.data.flerfaktor).toMatchObject({ kravs: true, registrera: true, metoder: [] });
    expect(forsta.data.flerfaktorVantar).toMatchObject({ registrera: true });
    // Ingen behörighet medan faktorn saknas.
    expect((await k.get('/api/patient/p01')).status).toBe(401);
    expect((await k.get('/api/inkorg')).status).toBe(401);
    // Översikten säger att vårdgivaren kräver flerfaktor.
    const o = (await k.get('/api/flerfaktor')).data;
    expect(o.kravsAvVardgivaren).toBe(true);
    expect(o.text).toContain('Vårdgivaren kräver flerfaktor');
    // Appen för engångskoder registreras, och koden som bekräftar den är den andra faktorn.
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    const r = await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) });
    expect(r.status).toBe(201);
    expect(r.data.inloggad).toBe(true);
    expect(r.data.personal.id).toBe('ssk-kard');
    expect(r.data.flerfaktor).toMatchObject({ aktiv: true, metod: 'totp' });
    expect(r.data.lasnyckel).toBeTruthy();
    expect((await k.get('/api/patient/p01')).status).toBe(200);
    // Nästa inloggning kräver faktorn som vanligt.
    await k.post('/api/logout');
    const nasta = await k.post('/api/login', { personalId: 'ssk-kard' });
    expect(nasta.data.inloggad).toBe(false);
    expect(nasta.data.flerfaktor.metoder).toEqual(['totp']);
    expect(nasta.data.flerfaktor.registrera).toBeUndefined();
  });

  test('med kravet på ja ger en felaktig kod vid registreringen ingen inloggning, och för många försök avbryter', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    kravFlerfaktor(sandlada(app, k).db);
    await k.post('/api/logout');
    await k.post('/api/login', { personalId: 'usk-kard' });
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    const giltiga = new Set([-1, 0, 1].map(d => ff.totp(h, Date.now() + d * 30_000)));
    const felkoder = ['123456', '234567', '345678', '456789', '567890', '678901', '789012'].filter(x => !giltiga.has(x));
    let sista;
    for (let i = 0; i < ff.MAX_FORSOK; i++) {
      sista = await k.post('/api/flerfaktor/totp', { kod: felkoder[i] });
      expect(sista.status).toBe(400);
      expect(sista.data.inloggad).toBeUndefined();
    }
    expect(sista.data.fel).toContain('För många felaktiga försök');
    expect((await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) })).status).toBe(401);
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
  });

  test('den som redan är inloggad loggas inte ut när kravet slås på, utan får frågan vid nästa inloggning', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    kravFlerfaktor(sandlada(app, k).db);
    const s = (await k.get('/api/session')).data;
    expect(s.inloggad).toBe(true);
    expect((await k.get('/api/patient/p01')).status).toBe(200);
    await k.post('/api/logout');
    expect((await k.post('/api/login', { personalId: 'lak-kard' })).data.flerfaktor.registrera).toBe(true);
  });

  test('med kravet på ja leds invånaren i Min journal till att registrera en faktor innan journalen visas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    kravFlerfaktor(sandlada(app, k).db);
    await k.post('/api/logout');
    const forsta = await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect(forsta.data.inloggad).toBe(false);
    expect(forsta.data.flerfaktor).toMatchObject({ kravs: true, registrera: true });
    expect((await k.get('/api/min/journal/p01')).status).toBe(401);
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const r = await k.post('/api/flerfaktor/totp', { kod: ff.totp(ff.fran32(b.nyckel), Date.now()) });
    expect(r.status).toBe(201);
    expect(r.data.inloggad).toBe(true);
    expect(r.data.roll).toBe('invanare');
    expect(r.data.lasnyckel).toBeUndefined();
  });

  test('med kravet på ja går den sista faktorn inte att ta bort, och säkerhetsloggen visar inloggningen med den nya faktorn', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    kravFlerfaktor(sandlada(app, k).db);
    await k.post('/api/logout');
    await k.post('/api/login', { personalId: 'adm-kard' });
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    await k.post('/api/flerfaktor/totp', { kod: ff.totp(ff.fran32(b.nyckel), Date.now()) });
    const o = (await k.get('/api/flerfaktor')).data;
    const r = await k.post(`/api/flerfaktor/${o.faktorer[0].id}/ta-bort`);
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('Vårdgivaren kräver flerfaktor');
    expect((await k.get('/api/flerfaktor')).data.faktorer.length).toBe(1);
    const rader = sandlada(app, k).db.query("SELECT typ, beskrivning FROM sakerhetslogg WHERE personal_id = 'adm-kard' ORDER BY id").all();
    expect(rader.map(x => x.typ).slice(-3)).toEqual(['flerfaktor', 'flerfaktor', 'inloggning']);
    expect(rader.at(-1).beskrivning).toContain('flerfaktor');
  });
});
