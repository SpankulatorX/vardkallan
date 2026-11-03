// Export av loggposter (Sussa 5.2.1.3), säkerhetsloggen (5.3.1.12) och stickprovskontroll (L4, HSLF-FS 2016:40
// 4 kap. 9 b §). Runda 6, r1.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import * as logg from '../src/logg.js';
import * as sakerhet from '../src/sakerhetslogg.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const sakerhetsrader = (k) => db(k).query('SELECT * FROM sakerhetslogg ORDER BY id').all();
// Filen som exporten ger, som text. Testklienten tolkar allt med json i innehållstypen som JSON, också NDJSON.
async function fil(k, vag) {
  const r = await fetch(app.url + vag, { headers: { Cookie: k.kaka() } });
  return { status: r.status, headers: r.headers, data: await r.text() };
}

describe('Export av loggen', () => {
  test('åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas', async () => {
    const k = await inloggad('logg');
    const r = await fil(k, '/api/logg/export?typ=atkomst&format=ndjson');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toStartWith('application/x-ndjson');
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="atkomstlogg-\d{4}-\d{2}-\d{2}\.ndjson"$/);
    expect(r.headers.get('x-kedjan-hel')).toBe('ja');
    const rader = r.data.trim().split('\n').map(l => JSON.parse(l));
    expect(rader.length).toBe(Number(r.headers.get('x-antal-rader')));
    expect(rader.length).toBeGreaterThan(3);
    // Kedjan går att kontrollera utanför systemet: varje rads föregående hash är förra radens hash.
    for (let i = 1; i < rader.length; i++) {
      expect(rader[i].id).toBeGreaterThan(rader[i - 1].id);
      if (rader[i].id === rader[i - 1].id + 1) expect(rader[i].prev_hash).toBe(rader[i - 1].hash);
    }
    const kanon = db(k).query('SELECT * FROM atkomstlogg WHERE id = ?').get(rader[0].id);
    expect(logg.hashFor(kanon.prev_hash, kanon)).toBe(rader[0].hash);
    // Skyddad identitet är maskerad också i exporten.
    expect(r.data).not.toContain('Engberg');
    expect(rader.find(x => x.patient_id === 'p03')?.patient_personnummer ?? '19840416-****').toBe('19840416-****');
    const loggad = db(k).query("SELECT * FROM atkomstlogg WHERE resurs = 'loggexport:atkomst:ndjson'").get();
    expect(loggad).toMatchObject({ personal_id: 'logg', grund: 'logggranskning', resultat: 'tillaten' });
    expect(loggad.syfte).toContain(`Export av ${rader.length} rader ur åtkomstloggen som NDJSON`);
    expect(sakerhetsrader(k).some(s => s.typ === 'loggexport')).toBe(true);
  });

  test('CSV har rubriker, semikolon och skydd mot formler, och säkerhetsloggen kan också exporteras', async () => {
    const k = await inloggad('logg');
    db(k).query("INSERT INTO installningar VALUES ('x', 'y')").run();
    logg.loggaRad(db(k), { personal_id: 'lak-kard', enhet_id: 'uso-kard', patient_id: 'p01', handling: 'las_oversikt', grund: 'vardrelation', syfte: '=HYPERLINK("x")' });
    const r = await k.get('/api/logg/export?typ=atkomst&format=csv');
    expect(r.headers.get('content-type')).toStartWith('text/csv');
    const rader = r.data.replace(/^﻿/, '').trim().split('\r\n');
    expect(rader[0]).toStartWith('"Rad";"Tid";"Personal-id";"Personal"');
    expect(r.data).toContain('"\'=HYPERLINK(""x"")"');
    const s = await fil(k, '/api/logg/export?typ=sakerhet&format=ndjson');
    expect(s.status).toBe(200);
    const ss = s.data.trim().split('\n').map(l => JSON.parse(l));
    expect(ss.some(x => x.typ === 'inloggning')).toBe(true);
    expect((await k.get('/api/logg/export?typ=annat')).status).toBe(400);
  });

  test('bara logggranskaren exporterar, och ett nekat försök loggas', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get('/api/logg/export');
    expect(r.status).toBe(403);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE resurs = '/api/logg/export' ORDER BY id DESC").get()).toMatchObject({ resultat: 'nekad', personal_id: 'lak-kard' });
    expect(sakerhetsrader(k).at(-1)).toMatchObject({ typ: 'avvisat_anrop', personal_id: 'lak-kard', status: 403, vag: '/api/logg/export' });
  });
});

describe('Säkerhetsloggen', () => {
  test('inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser', async () => {
    const k = klient(app);
    await k.post('/api/login', { personalId: 'finns-inte' });
    await k.logga('usk-kard');
    await k.get('/api/logg');
    await k.post('/api/logout', {});
    const rader = sakerhetsrader(k);
    expect(rader.map(r => r.typ)).toEqual(['inloggning_misslyckad', 'inloggning', 'avvisat_anrop', 'utloggning']);
    expect(rader[1]).toMatchObject({ personal_id: 'usk-kard', enhet_id: 'uso-kard-72', beskrivning: 'Inloggning med SITHS-kort (simulerat).' });
    expect(rader[2]).toMatchObject({ status: 403, vag: '/api/logg', metod: 'GET', personal_id: 'usk-kard' });
    expect(rader[3]).toMatchObject({ typ: 'utloggning', personal_id: 'usk-kard' });
    // En nekad journal ger en säkerhetshändelse utan patientens id.
    await k.logga('lak-vc');
    await k.get('/api/patient/p12/anteckningar');
    const nekad = sakerhetsrader(k).at(-1);
    expect(nekad).toMatchObject({ typ: 'avvisat_anrop', status: 403, vag: '/api/patient/:id/anteckningar' });
    expect(JSON.stringify(sakerhetsrader(k))).not.toMatch(/p12/);
    const u = klient(app);
    await u.get('/api/arbetslista');
    expect(sakerhetsrader(u).at(-1)).toMatchObject({ typ: 'avvisat_anrop', status: 401, personal_id: null });
    await u.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect(sakerhetsrader(u).at(-1)).toMatchObject({ typ: 'inloggning', invanare_id: 'inv-p01' });
  });

  test('ändrade behörigheter och inställningar blir säkerhetshändelser', async () => {
    const k = await inloggad('ssk-kard');
    const d = db(k).query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' AND aterkallad_tid IS NULL ORDER BY id DESC").get();
    expect((await k.post(`/api/delegering/${d.id}/aterkalla`, { orsak: 'Uppföljningen visade att utbildningen behöver göras om' })).status).toBe(200);
    await k.post('/api/demo/nll-timeout', {});
    const rader = sakerhetsrader(k);
    expect(rader.find(r => r.typ === 'andrad_behorighet')).toMatchObject({ personal_id: 'ssk-kard', vag: '/api/delegering/:id/aterkalla' });
    expect(rader.find(r => r.typ === 'andrad_installning')).toMatchObject({ vag: '/api/demo/nll-timeout' });
    await k.post('/api/reset', {});
    expect(sakerhetsrader(k).map(r => r.typ)).toEqual(['andrad_installning']);
  });

  test('säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras', async () => {
    const k = await inloggad('logg');
    const d = db(k);
    expect(() => d.query("UPDATE sakerhetslogg SET beskrivning = 'x'").run()).toThrow(/kan inte ändras/);
    expect(() => d.query('DELETE FROM sakerhetslogg').run()).toThrow(/kan inte raderas/);
    expect(sakerhet.verifiera(d).hel).toBe(true);
    const v = (await k.get('/api/logg/sakerhet')).data;
    expect(v.verifiering.hel).toBe(true);
    expect(v.rader[0]).toMatchObject({ typ: 'inloggning', typText: 'Inloggning', personal: { id: 'logg' } });
    expect(d.query("SELECT * FROM atkomstlogg WHERE resurs = 'sakerhetslogg:alla'").get()).toMatchObject({ handling: 'las_logg', grund: 'logggranskning' });
    // En ändrad rad upptäcks när triggern släpps i en kopia.
    d.exec('DROP TRIGGER sakerhetslogg_ingen_andring');
    d.query("UPDATE sakerhetslogg SET beskrivning = 'ändrad' WHERE id = 1").run();
    expect(sakerhet.verifiera(d)).toMatchObject({ hel: false, felRad: 1, orsak: 'Raden har ändrats' });
    expect((await (await inloggad('lak-kard')).get('/api/logg/sakerhet')).status).toBe(403);
  });
});

describe('Stickprovskontroll', () => {
  test('systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår', async () => {
    const k = await inloggad('logg');
    const fore = (await k.get('/api/stickprov')).data;
    expect(fore).toMatchObject({ stickprov: [], aktuellt: null, dags: true, antal: 10, dagar: 7 });
    expect(fore.regel).toContain('4 kap. 9 b §');
    const s = await k.post('/api/stickprov', {});
    expect(s.status).toBe(201);
    expect(s.data.rader.length).toBe(s.data.antal);
    expect(s.data.antal).toBeLessThanOrEqual(10);
    expect(s.data).toMatchObject({ granskade: 0, kvar: s.data.antal });
    const loggId = new Set(s.data.rader.map(r => r.loggId));
    expect(loggId.size).toBe(s.data.antal);
    for (const r of s.data.rader) {
      const l = db(k).query('SELECT * FROM atkomstlogg WHERE id = ?').get(r.loggId);
      expect(l.personal_id).not.toBeNull();
      expect(l.patient_id).not.toBeNull();
      expect(l.grund).not.toBe('logggranskning');
      expect(l.resultat).toBe('tillaten');
      expect(r.kontrollera.length).toBeGreaterThan(20);
    }
    const forsta = s.data.rader[0];
    const g = await k.post(`/api/stickprov/${s.data.id}/rad/${forsta.loggId}`, {});
    expect(g.data).toMatchObject({ granskade: 1, kvar: s.data.antal - 1 });
    expect(g.data.rader[0].granskad).toMatchObject({ bedomning: 'befogad', av: { id: 'logg' } });
    const ov = (await k.get('/api/stickprov')).data;
    expect(ov).toMatchObject({ kvarTotalt: s.data.antal - 1, dags: false });
    // Ett nytt stickprov tar inte samma åtkomster igen. Först några nya åtkomster i samma sandlåda.
    await k.logga('lak-kard');
    for (const v of ['/api/patient/p01', '/api/patient/p01/oversikt', '/api/patient/p04', '/api/patient/p17']) await k.get(v);
    await k.logga('logg');
    const ny = (await k.post('/api/stickprov', {})).data;
    expect(ny.rader.some(r => loggId.has(r.loggId))).toBe(false);
  });

  test('en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas', async () => {
    const k = await inloggad('logg');
    const s = (await k.post('/api/stickprov', {})).data;
    expect(s.rader.length).toBeGreaterThanOrEqual(2);
    const [a, b] = s.rader;
    expect((await k.post(`/api/stickprov/${s.id}/rad/${a.loggId}`, { bedomning: 'utreds' })).status).toBe(400);
    const u = await k.post(`/api/stickprov/${s.id}/rad/${a.loggId}`, { bedomning: 'utreds', kommentar: 'Ingen vårdkontakt på enheten den dagen' });
    expect(u.data.rader[0].granskad).toMatchObject({ bedomning: 'utreds', kommentar: 'Ingen vårdkontakt på enheten den dagen' });
    expect((await k.post(`/api/stickprov/${s.id}/rad/${a.loggId}`, {})).status).toBe(400);
    expect(() => db(k).query('UPDATE stickprov_rader SET bedomning = ? WHERE logg_id = ?').run('befogad', a.loggId)).toThrow(/ändras inte/);
    expect(() => db(k).query('DELETE FROM stickprov_rader').run()).toThrow(/raderas inte/);
    await k.post(`/api/stickprov/${s.id}/rad/${b.loggId}`, {});
    const loggat = db(k).query("SELECT * FROM atkomstlogg WHERE resurs LIKE ? ORDER BY id").all(`stickprov:${s.id}:rad:%`);
    expect(loggat.length).toBe(2);
    expect(loggat[0].syfte).toContain('ska utredas');
    const pid = db(k).query('SELECT patient_id FROM atkomstlogg WHERE id = ?').get(a.loggId).patient_id;
    expect(loggat[0].patient_id).toBe(pid);
    expect(sakerhetsrader(k).some(r => r.typ === 'stickprov')).toBe(true);
    const l = await inloggad('lak-kard');
    expect((await l.post('/api/stickprov', {})).status).toBe(403);
    expect((await l.get('/api/stickprov')).status).toBe(403);
  });
});
