import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';

// Runda 14, r2: HSA-katalogen (Sussa 2.2.1.1), PU-tjänsten (2.2.1.2) och engagemangsindex (2.2.1.10) med
// tjänstekontrakten i RIVTA, där Vårdkällan är konsument av simulerade tjänster med demons påhittade uppgifter.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
afterEach(() => rivta.nationella.satt(null));
async function inloggad(id) { const k = klient(app); await k.logga(id); return k; }

describe('Tjänstekontrakt i RIVTA, HSA, PU-tjänsten och engagemangsindex', () => {
  test('personalens uppgifter hämtas ur HSA-katalogen med GetEmployeeIncludingProtectedPerson och jämförs med personalkatalogen', async () => {
    const k = await inloggad('sysf');
    const db = sandlada(app, k).db;
    const r = await k.get('/api/rivta/hsa/lak-kard');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ stammer: true, hsa: { pahittad: true }, text: 'Personalkatalogen stämmer med HSA-katalogen.' });
    db.query("UPDATE personal SET titel = 'Annan titel' WHERE id = 'lak-kard'").run();
    const andrad = (await k.get('/api/rivta/hsa/lak-kard')).data;
    expect(andrad.stammer).toBe(false);
    expect(andrad.skillnader.map(s => s.falt)).toEqual(['titel']);
    expect(andrad.text).toContain('HSA är masterkatalog');
    expect(rivta.anropslogg(db).find(a => a.kontrakt === 'GetEmployeeIncludingProtectedPerson')).toMatchObject({ riktning: 'ut', resultat: 'ok' });
    expect((await (await inloggad('lak-kard')).get('/api/rivta/hsa/lak-kard')).status).toBe(403);
    // HSA-katalogen svarar inte: personalkatalogen gäller, och texten säger det.
    rivta.nationella.satt(() => { throw new Error('nere'); });
    expect((await k.get('/api/rivta/hsa/lak-kard')).data.stammer).toBeNull();
  });

  test('patientens folkbokföring hämtas ur PU-tjänsten med LookupResidentForFullProfile och skillnader visas', async () => {
    const k = await inloggad('adm-kard');
    const db = sandlada(app, k).db;
    const r = await k.get('/api/patient/p01/folkbokforing');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ stammer: true, sekretessmarkering: false });
    db.query("UPDATE patienter SET adress = 'Gamla gatan 1' WHERE id = 'p01'").run();
    const andrad = (await k.get('/api/patient/p01/folkbokforing')).data;
    expect(andrad.skillnader).toEqual([{ falt: 'adress', vardkallan: 'Gamla gatan 1', pu: 'Ekbacksvägen 12' }]);
    expect(andrad.text).toContain('Uppdatera patientens uppgifter efter folkbokföringen');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = 'rivta:LookupResidentForFullProfile'").get().n).toBe(2);
  });

  // Säkerhetsgranskningen av runda 14: jämförelsen får inte röja namn eller adress för en patient med skyddad identitet
  // eller sekretessmarkering utan det aktiva valet visa_identitet, och adressen jämförs aldrig för en sådan patient.
  test('jämförelsen med PU-tjänsten röjer inte namn eller adress för skyddad identitet utan aktivt val', async () => {
    const k = await inloggad('adm-kard');
    const db = sandlada(app, k).db;
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p03', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Test')").run(new Date().toISOString());
    expect((await k.get('/api/patient/p03/folkbokforing')).status).toBe(200);
    // Vårdkällan och PU-tjänstens kopia får olika efternamn och adress.
    db.query("UPDATE patienter SET efternamn = 'Nyström', adress = 'Hemliga vägen 3', postnr = '702 11', ort = 'Örebro' WHERE id = 'p03'").run();
    db.query("UPDATE rivta_sim_pu SET adress = 'Annan väg 9', postnr = '70299', ort = 'Kumla' WHERE patient_id = 'p03'").run();
    const utan = (await k.get('/api/patient/p03/folkbokforing')).data;
    expect(utan.stammer).toBe(false);
    expect(utan.skillnader).toEqual([{ falt: 'efternamn' }]);
    const text = JSON.stringify(utan);
    for (const x of ['Malin', 'Engberg', 'Nyström', 'Hemliga', 'Annan väg', '70299', '702 11', 'Kumla']) expect([x, text.includes(x)]).toEqual([x, false]);
    // Med det aktiva valet visa_identitet, gjort och prövat på servern, visas namnen men aldrig adressen.
    expect((await k.post('/api/patient/p03/val', { typ: 'visa_identitet', syfte: 'Kontroll av identiteten mot folkbokföringen' })).status).toBe(200);
    const med = (await k.get('/api/patient/p03/folkbokforing')).data;
    expect(med.skillnader).toEqual([{ falt: 'efternamn', vardkallan: 'Nyström', pu: 'Engberg' }]);
    expect(JSON.stringify(med)).not.toContain('Hemliga');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p03' AND resurs = 'rivta:LookupResidentForFullProfile'").get().n).toBe(3);
  });

  test('sekretessmarkering i PU-tjänsten ger bara vilka fält som skiljer sig, och fel roll eller vårdenhet nekas', async () => {
    const k = await inloggad('adm-kard');
    const db = sandlada(app, k).db;
    await k.get('/api/patient/p01/folkbokforing');
    db.query("UPDATE rivta_sim_pu SET skyddad = 1, efternamn = 'Pettersson' WHERE patient_id = 'p01'").run();
    db.query("UPDATE patienter SET adress = 'Gamla gatan 1' WHERE id = 'p01'").run();
    const d = (await k.get('/api/patient/p01/folkbokforing')).data;
    expect(d).toMatchObject({ stammer: false, sekretessmarkering: true, skillnader: [{ falt: 'efternamn' }] });
    const text = JSON.stringify(d);
    for (const x of ['Pettersson', 'Åkesson', 'Gamla gatan', 'Ekbacksvägen']) expect([x, text.includes(x)]).toEqual([x, false]);
    // Fel roll, och en vårdadministratör på en vårdenhet utan relation till patienten.
    expect((await (await inloggad('uppf')).get('/api/patient/p01/folkbokforing')).status).toBe(403);
    expect((await (await inloggad('adm-kard')).get('/api/patient/p13/folkbokforing')).status).toBe(403);
  });

  test('en person med sekretessmarkering får ingen adress ur PU-tjänsten', () => {
    const db = nyDb();
    const svar = rivta.anropaSynk(rivta.register.PU, { logiskAdress: rivta.nationella.NATIONELL, begaran: { personId: ['198404162383', '194502024732'], lookUpSpecification: {} }, transport: rivta.nationella.transport(db) });
    expect(svar.resident.length).toBe(2);
    const [skyddad, vanlig] = svar.resident;
    expect(skyddad.Sekretessmarkering).toBe('J');
    expect(skyddad.Personpost.Folkbokforingsadress).toBeUndefined();
    expect(vanlig.Personpost).toMatchObject({ PersonId: '194502024732', Folkbokforingsadress: { PostNr: '70227', Postort: 'Örebro' } });
  });

  test('engagemangsindex får en post per vårdenhet och informationsmängd, aldrig för skyddade personuppgifter eller spärrade uppgifter', async () => {
    const k = await inloggad('sysf');
    const db = sandlada(app, k).db;
    const r = await k.post('/api/rivta/engagemangsindex/p01', {});
    expect(r.status).toBe(200);
    // Runda 14, sammanslagningen: svaret har inget antal (sakerhet-r14-sammanslagning.test.js). Raderna räknas i indexet.
    const rader = db.query("SELECT * FROM rivta_sim_engagemang WHERE patient_id = 'p01'").all();
    expect(rader.length).toBeGreaterThan(0);
    expect(new Set(rader.map(x => x.kategori))).toEqual(new Set(['voo', 'dia']));
    expect((await k.post('/api/rivta/engagemangsindex/p03', {})).status).toBe(200);
    expect(db.query("SELECT count(*) AS n FROM rivta_sim_engagemang WHERE patient_id = 'p03'").get().n).toBe(0);
    await k.post('/api/rivta/engagemangsindex/p04', {});
    expect(db.query("SELECT count(*) AS n FROM rivta_sim_engagemang WHERE patient_id = 'p04' AND vardenhet_hsa = 'SE2321000164-VK0160'").get().n).toBe(0);
    expect((await (await inloggad('lak-kard')).post('/api/rivta/engagemangsindex/p01', {})).status).toBe(403);
  });
});
