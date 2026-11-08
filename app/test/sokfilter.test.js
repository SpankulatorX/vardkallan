// Runda 10, r2: filter på typ, tid och vårdenhet i sökträffarna, och samma sökfält över flera patienter på grupp-,
// vårdenhets- och vårdgivarnivå (Sussa 3.1.8.2).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const fraga = async (k, pid, q, filter = {}) => (await k.get(`/api/patient/${pid}/sok?${new URLSearchParams({ q, ...filter })}`));
const dag = (t) => String(t).slice(0, 10);

describe('Sökning, filter och flera patienter', () => {
  test('sökträffarna filtreras på typ, tid och vårdenhet, och filtren räknas bara på det som syns', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Läsa tidigare vård' });
    const alla = (await fraga(k, 'p01', 'blodtryck')).data;
    expect(alla.filter.typer.map(t => t.typ)).toEqual(expect.arrayContaining(['matvarde', 'anteckning']));
    expect(alla.filter.typer.reduce((s, t) => s + t.antal, 0)).toBe(alla.antal);
    expect(alla.filter.vardenheter.reduce((s, t) => s + t.antal, 0)).toBe(alla.antal);
    const mv = (await fraga(k, 'p01', 'blodtryck', { typ: 'matvarde' })).data;
    expect(mv.traffar.length).toBeGreaterThan(0);
    expect(mv.traffar.every(t => t.typ === 'matvarde')).toBe(true);
    expect(mv.antal).toBe(alla.filter.typer.find(t => t.typ === 'matvarde').antal);
    // Filtren efter ett urval visar fortfarande alla typer, så att användaren kan byta.
    expect(mv.filter.typer.length).toBe(alla.filter.typer.length);
    const ve = alla.filter.vardenheter[0];
    const perEnhet = (await fraga(k, 'p01', 'blodtryck', { vardenhet: ve.id })).data;
    expect(perEnhet.traffar.every(t => t.vardenhet.id === ve.id || t.vardenhetId === ve.id)).toBe(true);
    expect(perEnhet.antal).toBe(ve.antal);
    const tider = alla.traffar.map(t => dag(t.tid)).sort();
    const fran = tider[Math.floor(tider.length / 2)];
    const intervall = (await fraga(k, 'p01', 'blodtryck', { fran, till: tider.at(-1) })).data;
    expect(intervall.traffar.every(t => dag(t.tid) >= fran)).toBe(true);
    expect(intervall.antal).toBe(tider.filter(t => t >= fran).length);
    expect(intervall.tolkning).toContain(`från ${fran}`);
    // Ett okänt filter eller ett felaktigt datum avvisas med en förklaring.
    expect((await fraga(k, 'p01', 'blodtryck', { typ: 'hemligt' })).status).toBe(400);
    expect((await fraga(k, 'p01', 'blodtryck', { fran: '2026-13-01' })).status).toBe(400);
  });

  test('ett filter på en spärrad vårdenhet ger samma svar som en vårdenhet utan träffar', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Läsa tidigare vård' });
    const a = (await fraga(k, 'p04', 'sertralin', { vardenhet: 'uso-psyk' })).data;
    const b = (await fraga(k, 'p04', 'sertralin', { vardenhet: 'vc-tybble' })).data;
    expect(a.antal).toBe(0);
    expect(JSON.stringify({ ...a, filter: null })).toBe(JSON.stringify({ ...b, filter: null }));
    expect(JSON.stringify({ ...a.filter, valt: null })).toBe(JSON.stringify({ ...b.filter, valt: null }));
  });

  test('samma sökfält söker över vårdenhetens patienter: en diagnos, ett läkemedel eller en grupp blir villkor', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get(`/api/sok/journaler?q=${encodeURIComponent('blodförtunnande')}`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ niva: 'enhet', villkor: { lakemedel: { atc: ['B01A'] } } });
    expect(r.data.tolkning).toContain('läkemedel i gruppen blodförtunnande');
    expect(r.data.patienter.map(p => p.id)).toContain('p01');
    // Samma patienter som patientgrupperingen med samma villkor.
    const g = (await k.post('/api/analys/grupp', { villkor: { lakemedel: { atc: ['B01A'] } } })).data;
    expect(r.data.patienter.map(p => p.id).sort()).toEqual(g.patienter.map(p => p.id).sort());
    // Ett läkemedelsnamn och en diagnos i ord tolkas till koder.
    expect((await k.get('/api/sok/journaler?q=Waran')).data.villkor).toEqual({ lakemedel: { atc: ['B01AA03'] }, period: expect.any(Object) });
    const ff = (await k.get(`/api/sok/journaler?q=${encodeURIComponent('förmaksflimmer')}`)).data;
    expect(ff.villkor.diagnoser.koder).toEqual(expect.arrayContaining(['I48.0']));
    // Varje patient i svaret loggas på den inloggade.
    const logg = sandlada(app, k).db.query("SELECT patient_id FROM atkomstlogg WHERE personal_id = 'lak-kard' AND resurs = 'sok:journaler' AND handling = 'patientgrupp'").all().map(x => x.patient_id);
    for (const p of r.data.patienter) expect(logg).toContain(p.id);
    // En fråga som inte går att göra till ett villkor förklaras.
    const fri = await k.get(`/api/sok/journaler?q=${encodeURIComponent('trött')}`);
    expect(fri.status).toBe(400);
    expect(fri.data.fel).toContain('diagnos');
  });

  test('en patient utan vårdrelation, en spärrad vårdenhets uppgift och skyddad identitet följer behörigheten i sökningen över patienter', async () => {
    const k = await inloggad('lak-psyk');
    const d = (await k.get('/api/sok/journaler?q=sertralin')).data;
    // Psykiatrins egen ordination hittas på den egna vårdenheten.
    expect(d.patienter.map(p => p.id)).toContain('p04');
    const kard = await inloggad('lak-kard');
    const e = (await kard.get('/api/sok/journaler?q=sertralin')).data;
    expect(JSON.stringify(e)).not.toContain('p04');
    const vc = await inloggad('lak-vc');
    const s = (await vc.get(`/api/sok/journaler?q=${encodeURIComponent('jordnöt')}`));
    expect(s.status).toBe(400);
    const skydd = (await vc.get('/api/sok/journaler?q=J45')).data;
    for (const p of skydd.patienter.filter(x => x.skyddad)) { expect(p.namn).toBe('Skyddad identitet'); expect(p.personnummer).toMatch(/\*\*\*\*$/); }
  });

  test('på vårdgivarnivå får uppföljningen antal utan personuppgifter, och andra roller nekas', async () => {
    const u = await inloggad('uppf');
    const r = (await u.get(`/api/sok/journaler?q=${encodeURIComponent('blodförtunnande')}`)).data;
    expect(r.niva).toBe('region');
    expect(r.patienter).toBeUndefined();
    expect(JSON.stringify(r)).not.toMatch(/p0\d|Åkesson/);
    expect(r.antal === null ? r.antalDolt : typeof r.antal === 'number').toBe(true);
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/sok/journaler?q=I48')).status).toBe(403);
  });
});
