import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { KONTRAKT, PRODUCENTER, STATUS, K10_RADER } from '../src/tjanstekontrakt.js';

// De nationella tjänstekontrakten i bilaga K10 (runda 7, r5, Sussa 2.2.1) och den simulerade producenten med ett
// RIV-TA-liknande API ovanpå samma behörighet och loggning som FHIR.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const fraga = (pnr, extra = {}) => ({ patientId: { id: pnr, type: '1.2.752.129.2.1.3.1' }, ...extra });

describe('Tjänstekontrakt', () => {
  test('tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status', async () => {
    // K10 har 81 rader, och GetAllCareTypes står två gånger.
    expect(K10_RADER).toBe(81);
    expect(KONTRAKT.length).toBe(80);
    expect(new Set(KONTRAKT.map(k => k.kontrakt)).size).toBe(80);
    for (const k of KONTRAKT) {
      expect(['producent', 'konsument', 'producent och konsument']).toContain(k.roll);
      expect(Object.keys(STATUS)).toContain(k.status);
      expect(k.motsvarighet.length).toBeGreaterThan(5);
      expect(k.sussa).toMatch(/^2\.2\.1\.\d+$/);
    }
    expect(KONTRAKT.find(k => k.kontrakt === 'GetDiagnosis')).toMatchObject({ roll: 'producent och konsument', status: 'simulerad_producent', api: '/api/riv/GetDiagnosis', tjanster: ['NPÖ', 'Journalen'] });
    expect(KONTRAKT.find(k => k.kontrakt === 'LookupResidentsForProfile')).toMatchObject({ roll: 'konsument', k10: { konsument: '①' } });
    expect(KONTRAKT.filter(k => k.status === 'simulerad_producent').map(k => k.kontrakt).sort()).toEqual([...PRODUCENTER].sort());
    expect((await klient(app).get('/api/tjanstekontrakt')).status).toBe(401);
    const k = await inloggad('uppf');
    expect((await k.get('/api/tjanstekontrakt')).data.kontrakt.length).toBe(80);
  });

  test('GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/riv/GetDiagnosis', fraga('194502024732'));
    expect(r.status).toBe(200);
    expect(r.data.result.resultCode).toBe('OK');
    const fhir = (await k.get('/fhir/Condition?patient=p01')).data;
    expect(r.data.diagnosis.length).toBe(fhir.entry?.length ?? 0);
    const d = r.data.diagnosis.find(x => x.body.diagnosisCode.code === 'I50.1');
    expect(d.body).toMatchObject({ typeOfDiagnosis: 'Huvuddiagnos', diagnosisCode: { codeSystem: '1.2.752.116.1.1.1', displayName: 'Vänsterhjärtsvikt' } });
    expect(d.header).toMatchObject({ sourceSystemHSAId: 'SE2321000164-VK0000', patientId: { id: '194502024732' } });
    expect(d.header.accountableHealthcareProfessional.healthcareProfessionalCareUnitHSAId).toMatch(/^SE2321000164-VK/);
    const logg = db(k).query("SELECT * FROM atkomstlogg WHERE patient_id = 'p01' AND resurs LIKE '%_kontrakt=GetDiagnosis%'").all();
    expect(logg.length).toBe(1);
    expect(logg[0]).toMatchObject({ handling: 'las_diagnoser', resultat: 'tillaten' });
  });

  test('GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR', async () => {
    const k = await inloggad('lak-kard');
    const dok = (await k.post('/api/riv/GetCareDocumentation', fraga('194502024732'))).data;
    const comp = (await k.get('/fhir/Composition?patient=p01')).data;
    expect(dok.careDocumentation.length).toBe(comp.entry.length);
    expect(dok.careDocumentation.every(x => typeof x.body.clinicalDocumentNote.clinicalDocumentNoteText === 'string')).toBe(true);
    const upp = (await k.post('/api/riv/GetAlertInformation', fraga('194502024732'))).data;
    const antal = async (vag) => (await k.get(vag)).data.entry?.length ?? 0;
    const flag = (await antal('/fhir/Flag?patient=p01')) + (await antal('/fhir/AllergyIntolerance?patient=p01'));
    expect(flag).toBeGreaterThan(0);
    expect(upp.alertInformation.length).toBe(flag);
    const kon = (await k.post('/api/riv/GetCareContacts', fraga('194502024732'))).data;
    expect(kon.careContact.length).toBe((await k.get('/fhir/Encounter?patient=p01')).data.entry?.length ?? 0);
    expect(kon.careContact.some(x => x.body.careContactCode === '3' && x.body.careContactOrgUnit.orgUnitHSAId === 'SE2321000164-VK0120')).toBe(true);
    // Filter på vårdenhet och period.
    const filtrerad = (await k.post('/api/riv/GetCareContacts', fraga('194502024732', { careUnitHSAId: ['SE2321000164-VK0110'] }))).data;
    expect(filtrerad.careContact.every(x => x.header.accountableHealthcareProfessional.healthcareProfessionalCareUnitHSAId === 'SE2321000164-VK0110')).toBe(true);
    expect((await k.post('/api/riv/GetCareContacts', fraga('194502024732', { datePeriod: { start: '20990101' } }))).data.careContact).toEqual([]);
  });

  test('producenten nekar fel roll och visar inte spärrade uppgifter', async () => {
    const k = await inloggad('uppf');
    expect((await k.post('/api/riv/GetDiagnosis', fraga('194502024732'))).status).toBe(403);
    const a = await inloggad('adm-kard');
    expect((await a.post('/api/riv/GetCareDocumentation', fraga('194502024732'))).status).toBe(403);
    // Patient 4 har spärrat Allmänpsykiatriska kliniken. Kardiologen ser varken diagnoserna därifrån eller att de finns.
    const l = await inloggad('lak-kard');
    const r = await l.post('/api/riv/GetDiagnosis', fraga('197701182383'));
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.data);
    expect(text).not.toContain('SE2321000164-VK0160');
    expect(text).not.toMatch(/psyk|spärr/i);
    const fhir = (await l.get('/fhir/Condition?patient=p04')).data;
    expect(r.data.diagnosis.length).toBe(fhir.entry?.length ?? 0);
  });

  test('okänt kontrakt, patient eller logisk adress ger ett fel på svenska', async () => {
    const k = await inloggad('lak-kard');
    const okand = await k.post('/api/riv/GetVaccinationHistory', fraga('194502024732'));
    expect(okand.status).toBe(404);
    expect(okand.data.fel).toContain('inte producent');
    // En patient som inte finns och en patient utan behörighet ger samma svar, och uppslaget loggas.
    const finnsInte = await k.post('/api/riv/GetDiagnosis', fraga('191212121212'));
    const utanGrund = await k.post('/api/riv/GetDiagnosis', fraga('194505124752'));
    expect(finnsInte.status).toBe(403);
    expect(utanGrund.status).toBe(403);
    expect(finnsInte.data).toEqual(utanGrund.data);
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE resultat = 'nekad' AND resurs = 'riv/GetDiagnosis' AND patient_id IS NULL").get().n).toBe(1);
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE resultat = 'nekad' AND patient_id = 'p20'").get().n).toBeGreaterThan(0);
    // Rollen prövas före uppslaget: uppföljningsrollen får samma svar för en patient som inte finns.
    await k.logga('uppf');
    expect((await k.post('/api/riv/GetDiagnosis', fraga('191212121212'))).data).toEqual((await k.post('/api/riv/GetDiagnosis', fraga('194502024732'))).data);
    await k.logga('lak-kard');
    expect((await k.post('/api/riv/GetDiagnosis', {})).status).toBe(400);
    expect((await k.post('/api/riv/GetDiagnosis', fraga('194502024732', { logicalAddress: 'SE0000000000-0000' }))).data.fel).toContain('logiska adressen');
    expect((await k.post('/api/riv/GetDiagnosis', { patientId: { id: '194502024732', type: '1.2.3' } })).status).toBe(400);
  });
});
