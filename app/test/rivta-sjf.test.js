import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import * as sj from '../src/sammanhallen.js';
import * as nationella from '../src/rivta/nationella.js';
import { anropslogg } from '../src/rivta/index.js';

// Runda 14, r2: Vårdkällan som konsument av de nationella tjänsterna för sammanhållen journalföring (Sussa 2.2.1.3,
// 2.2.1.4 och 2.2.1.10): den aggregerande tjänsten, spärrtjänsten och samtyckestjänsten, simulerade i demon och anropade
// med SOAP enligt de pinnade tjänstekontrakten.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
afterEach(() => nationella.satt(null));
async function inloggad(id) { const k = klient(app); await k.logga(id); return k; }
const hamta = (k, pid, body = {}) => k.post(`/api/patient/${pid}/sammanhallen`, { syfte: 'Bedömning av patientens hjärtsvikt', ...body });
const T = 'Tjänstekontrakt i RIVTA, sammanhållen journalföring';

describe(T, () => {
  test('uppgifterna från andra vårdgivare hämtas från den aggregerande tjänsten och prövas mot spärrtjänsten', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const d = (await hamta(k, 'p01', { samtycke: true })).data;
    expect(d.hamtad).toBe(true);
    // Samma uppgifter som den simulerade vårdgivaren har, utom den som patienten har spärrat där.
    expect(d.poster.map(p => p.id).sort()).toEqual(sj.POSTER.p01.filter(p => !p.sparrad).map(p => p.id).sort());
    expect(d.poster.find(p => p.id === 'hh-2').tid).toBe('2025-09-12T09:05:00.000Z');
    expect(d.sparrText).toBe(sj.SPARR_TEXT);
    // Varje kontrakt anropades som konsument, och svaren validerades.
    const ut = anropslogg(db, { max: 100 }).filter(r => r.riktning === 'ut' && r.resultat === 'ok').map(r => r.kontrakt);
    for (const k2 of ['GetCareDocumentation', 'GetDiagnosis', 'GetCareContacts', 'GetMedicationHistory', 'CheckBlocks', 'GetAllBlocksForPatient', 'CheckConsent', 'RegisterExtendedConsent']) expect(ut).toContain(k2);
    expect(JSON.stringify(anropslogg(db, { max: 100 }))).not.toContain('194502024732');
  });

  test('samtycket registreras och återkallas i samtyckestjänsten, och ett samtycke som saknas där registreras igen', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    await hamta(k, 'p01', { samtycke: true });
    const fraga = () => nationella.anropa(db, 'CheckConsent', { AccessingActor: { EmployeeId: db.query("SELECT hsa_id FROM personal WHERE id = 'lak-kard'").get().hsa_id, CareProviderId: 'SE2321000164-VK0000', CareUnitId: 'SE2321000164-VK0120' }, PatientId: '194502024732' }).CheckResultType.HasConsent;
    expect(fraga()).toBe(true);
    // Tjänsten tappar samtycket: nästa gång läget visas registreras det igen ur Vårdkällans register.
    db.query("UPDATE rivta_sim_samtycken SET aterkallat = 'x'").run();
    expect(fraga()).toBe(false);
    await k.get('/api/patient/p01/sammanhallen');
    expect(fraga()).toBe(true);
    // Återkallat i Vårdkällan blir det återkallat i tjänsten.
    expect((await k.post('/api/patient/p01/sammanhallen/aterkalla', {})).status).toBe(200);
    expect(fraga()).toBe(false);
  });

  test('när spärrtjänsten inte svarar eller svarar fel visas inga uppgifter från andra vårdgivare', async () => {
    const k = await inloggad('lak-kard');
    await hamta(k, 'p01', { samtycke: true });
    // Tjänsten svarar med ett SOAP Fault: inget visas, och texten säger varför.
    nationella.satt(() => ({ status: 500, text: '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Server</faultcode><faultstring>nere</faultstring></s:Fault></s:Body></s:Envelope>' }));
    const d = (await k.get('/api/patient/p01/sammanhallen')).data;
    expect(d.poster).toEqual([]);
    expect(d.fel).toBe(sj.EJ_SVAR_TEXT);
    expect((await k.get('/api/patient/p01/oversikt')).data.tidslinje.some(t => t.typ === 'extern')).toBe(false);
    // Ett svar som inte följer schemat används aldrig.
    nationella.satt(() => ({ status: 200, text: '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><x:Annat xmlns:x="urn:x"/></s:Body></s:Envelope>' }));
    expect((await k.get('/api/patient/p01/sammanhallen')).data.poster).toEqual([]);
    nationella.satt(() => { throw new Error('ingen förbindelse'); });
    expect((await k.get('/api/patient/p01/sammanhallen')).data.fel).toBe(sj.EJ_SVAR_TEXT);
  });

  test('en spärr hos en annan vårdgivare hävs tillfälligt med patientens samtycke i stunden', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    expect((await k.post('/api/patient/p01/sammanhallen/hav-sparr', { samtycke: true })).status).toBe(400);
    await hamta(k, 'p01', { samtycke: true });
    expect((await k.post('/api/patient/p01/sammanhallen/hav-sparr', {})).data.falt).toEqual(['samtycke']);
    const r = await k.post('/api/patient/p01/sammanhallen/hav-sparr', { samtycke: true });
    expect(r.status).toBe(200);
    expect(r.data.poster.length).toBe(sj.POSTER.p01.length);
    expect(db.query("SELECT grund FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = 'sammanhallen:sparr:havd'").get().grund).toBe('samtycke_sparr');
    // Hävningen gäller bara den som gjorde den: en kollega på samma vårdenhet ser inte uppgiften.
    await k.logga('ssk-kard');
    const d = (await hamta(k, 'p01')).data;
    expect(d.poster.length).toBe(sj.POSTER.p01.length - 1);
  });

  test('Vårdkällans egna spärrar jämförs med spärrtjänsten, och skillnaden förklaras', async () => {
    const k = await inloggad('adm-kard');
    const db = sandlada(app, k).db;
    const fore = await k.get('/api/patient/p01/sparr/sparrtjansten');
    expect(fore.status).toBe(200);
    expect(fore.data).toMatchObject({ stammer: true, text: 'Vårdkällans spärrar stämmer med spärrtjänsten.' });
    // En spärr som bara finns i Vårdkällan, och en som bara finns i tjänsten.
    db.query("INSERT INTO sparrar (patient_id, enhet_id, aktiv, registrerad) VALUES ('p01', 'uso-ort', 1, ?)").run(new Date().toISOString());
    db.query("INSERT INTO rivta_sim_sparrar (block_id, patient_id, typ, vardgivare_hsa, vardenhet_hsa, skapad) VALUES ('test-1', 'p01', 'Inner', 'SE2321000164-VK0000', 'SE2321000164-VK0160', 'x')").run();
    const efter = (await k.get('/api/patient/p01/sparr/sparrtjansten')).data;
    expect(efter.stammer).toBe(false);
    expect(efter.baraVardkallan).toEqual([db.query("SELECT namn FROM enheter WHERE id = 'uso-ort'").get().namn]);
    expect(efter.baraTjansten).toEqual([db.query("SELECT namn FROM enheter WHERE hsa_id = 'SE2321000164-VK0160'").get().namn]);
    expect(efter.text).toContain('det strängaste gäller');
    // Bara den som registrerar spärrar ser jämförelsen.
    expect((await (await inloggad('lak-kard')).get('/api/patient/p01/sparr/sparrtjansten')).status).toBe(403);
  });
});
