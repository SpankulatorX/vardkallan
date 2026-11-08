// Runda 9, r7: levnadsvanor som strukturerade anteckningar och folkhälsoinsatser för riskgrupper (Sussa 6.2.2.1).
// Testnamnen står i src/sussa/mappning/6.2.2.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as journal from '../src/journal.js';
import * as levnadsvanor from '../src/levnadsvanor.js';
import * as R from '../public/js/levnadsvanor-regler.js';
import { KVA } from '../src/kodverk.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const NU = new Date('2026-11-08T10:00:00Z');
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Levnadsvanor', () => {
  test('systemet räknar risken för alkohol, fysisk aktivitet och matvanor och föreslår stöd med KVÅ-kod', () => {
    const v = R.prova({ alkohol: { glasPerVecka: '12', berusning: 'aldrig' }, stod: { alkohol: 'accepterat' } }).varde;
    expect(R.risk(v).alkohol).toMatchObject({ risk: true });
    expect(R.forslag(v).alkohol).toMatchObject({ kod: 'DV122', atgard: 'Rådgivande samtal om alkoholvanor' });
    expect(R.risk({ alkohol: { glasPerVecka: 3, berusning: 'manad' } }).alkohol.risk).toBe(true);
    expect(R.risk({ alkohol: { glasPerVecka: 1, berusning: 'aldrig' } }, { alder: 16 }).alkohol.risk).toBe(true);
    expect(R.risk({ fysisk: { traningMinuter: 30, vardagMinuter: 60 } }).fysisk).toMatchObject({ risk: true, varde: 120 });
    expect(R.risk({ fysisk: { traningMinuter: 60, vardagMinuter: 60 } }).fysisk.risk).toBe(false);
    expect(R.forslag({ fysisk: { traningMinuter: 0, vardagMinuter: 30 } }).fysisk).toMatchObject({ kod: 'DV132', tillagg: 'DV200' });
    expect(R.risk({ mat: { gronsaker: '1', frukt: '1', fisk: '0', sotsaker: '1' } }).mat).toMatchObject({ risk: true, varde: 3 });
    expect(R.forslag({ mat: { gronsaker: '3', frukt: '3', fisk: '2', sotsaker: '3' } }).mat.kod).toBeNull();
    for (const [kod, text] of Object.entries(R.KVA_LEVNADSVANOR)) expect(KVA[kod]).toBe(text);
    // Systemet förklarar på vanlig svenska.
    expect(R.prova({ alkohol: { glasPerVecka: 0, berusning: 'vecka' } }).varfor).toContain('Kontrollera svaren');
    expect(R.prova({ alkohol: { glasPerVecka: 20, berusning: 'aldrig' } }).falt).toBe('stod.alkohol');
    expect(R.prova({ fysisk: { traningMinuter: 'mycket', vardagMinuter: 10 } }).falt).toBe('fysisk.traningMinuter');
    expect(R.prova({}).varfor).toContain('minst ett');
  });

  test('anteckningen får text som systemet skriver, och samtalet registreras som åtgärd när den signeras', () => {
    const db = byggSeed(NU);
    const a = new Atkomst(db, personal(db, 'ssk-vc'), 'p07', {}, 'skriv_omvardnad');
    const svar = { alkohol: { glasPerVecka: 15, berusning: 'manad' }, mat: { gronsaker: '3', frukt: '2', fisk: '1', sotsaker: '2' }, stod: { alkohol: 'accepterat' }, givet: { alkohol: true }, kommentar: 'Vill dricka mindre.' };
    const ny = journal.skapaAnteckning(a, { typ: levnadsvanor.TYP, levnadsvanor: svar, sokord: [{ sokord: 'Aktuellt', text: 'Ska inte sparas' }] });
    expect(ny).toMatchObject({ typ: 'Levnadsvanor', kategori: 'omvardnad', status: 'utkast' });
    const text = JSON.stringify(ny.sokord);
    expect(text).toContain('15 standardglas en vanlig vecka');
    expect(text).toContain('Rådgivande samtal om alkoholvanor (KVÅ DV122): erbjudet och accepterat');
    expect(text).not.toContain('Ska inte sparas');
    expect(ny.levnadsvanor.risk.alkohol.risk).toBe(true);
    expect(ny.levnadsvanor.risk.mat.risk).toBe(false);
    expect(fel(() => journal.andraUtkast(a, journal.hamtaAnteckningRad(db, ny.id), { sokord: [{ sokord: 'Stöd', text: 'Eget' }] }))).toMatchObject({ status: 400 });
    journal.signera(a, journal.hamtaAnteckningRad(db, ny.id));
    expect(db.query("SELECT kod FROM atgarder WHERE patient_id = 'p07' AND kod = 'DV122'").all().length).toBe(1);
    // Svaren i en signerad anteckning ändras inte.
    expect(fel(() => db.query('UPDATE levnadsvanor SET svar = ? WHERE anteckning_id = ?').run('{}', ny.id))).toBeTruthy();
  });
});

describe('Folkhälsa', () => {
  test('en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const o = await k.get('/api/folkhalsa');
    expect(o.data.niva).toBe('enhet');
    const seed = o.data.insatser.find(i => i.omrade === 'alkohol');
    // Seedens insats: tre patienter med riskbruk när den startade, en har fått stöd och en har ingen risk längre.
    expect(seed).toMatchObject({ antal: 3, stod: 2, forbattrade: 1, vantar: 1, malAndel: 60, andelStod: 67, malUppnatt: true });
    const detalj = await k.get(`/api/folkhalsa/insatser/${seed.id}`);
    const per = Object.fromEntries(detalj.data.patienter.map(p => [p.id, p.status]));
    expect(per).toEqual({ p01: 'stod_givet', p10: 'forbattrad', p14: 'vantar_stod' });
    expect(detalj.data.patienter.find(p => p.id === 'p14').rekommendation).toBe('Erbjud rådgivande samtal om alkoholvanor (KVÅ DV122).');
    // En ny insats för fysisk aktivitet med vårdenhetens patienter som riskgrupp.
    const ny = await k.post('/api/folkhalsa/insatser', { omrade: 'fysisk' });
    expect(ny.status).toBe(201);
    expect(ny.data).toMatchObject({ namn: 'Otillräcklig fysisk aktivitet, Vårdcentralen Tybble', malAndel: 50 });
    expect(ny.data.patienter.map(p => p.id).sort()).toEqual(['p01', 'p06']);
    // Stöd efter starten räknas.
    const db = sandlada(app, k).db;
    db.query("INSERT INTO atgarder (patient_id, enhet_id, kod, tid, av) VALUES ('p06', 'vc-tybble', 'DV200', ?, 'lak-vc')").run(new Date(Date.now() + 1000).toISOString());
    const efter = await k.get(`/api/folkhalsa/insatser/${ny.data.id}`);
    expect(efter.data.stod).toBe(1);
    expect((await k.post(`/api/folkhalsa/insatser/${ny.data.id}/avsluta`)).data.avslutad).toBeTruthy();
    expect((await k.post('/api/folkhalsa/insatser', { omrade: 'socker' })).status).toBe(400);
  });

  test('rekommendationen syns i patientens översikt för den som kan ge stödet', async () => {
    const k = klient(app);
    await k.logga('ssk-vc');
    const o = await k.get('/api/patient/p14/oversikt');
    expect(o.data.folkhalsa[0].text).toContain('Erbjud rådgivande samtal om alkoholvanor (KVÅ DV122)');
    const g = await k.get('/api/patient/p01/oversikt');
    expect(g.data.folkhalsa).toEqual([]);
    expect(g.data.levnadsvanor.senaste.text).toContain('Alkohol: riskbruk av alkohol');
  });

  test('insatserna följer behörigheten: kardiologen ser inte vårdcentralens insats, och uppföljningen ser bara antal', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const o = await k.get('/api/folkhalsa');
    expect(o.data.insatser).toEqual([]);
    const id = sandlada(app, k).db.query('SELECT id FROM folkhalsoinsatser LIMIT 1').get().id;
    expect((await k.get(`/api/folkhalsa/insatser/${id}`)).status).toBe(404);
    const u = klient(app);
    await u.logga('uppf');
    const r = await u.get('/api/folkhalsa');
    expect(r.data.niva).toBe('region');
    expect(r.data.insatser[0]).toMatchObject({ namn: 'Riskbruk av alkohol, Vårdcentralen Tybble', antal: null });
    expect(JSON.stringify(r.data)).not.toMatch(/p01|p14|Gunnar/);
    const a = klient(app);
    await a.logga('adm-kard');
    expect((await a.post('/api/folkhalsa/insatser', { omrade: 'alkohol' })).status).toBe(403);
  });
});
