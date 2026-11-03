// Skrivning via FHIR (runda 6, r5, Sussa 2.5.1.1 till 2.5.1.3): samma funktion, behörighet, varningar och loggning som
// gränssnittet, och OperationOutcome med svensk text vid fel.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { idag, addDagar } from '../src/db.js';
import { testserver, klient, sandlada } from './hjalp.js';
import { EXT } from '../src/fhir-definitioner.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fhirAnrop = (k, metod, vag, kropp, extra = {}) => k.raw(metod, vag, kropp, extra);
const bt = (sys, dia, pid = 'p01') => ({
  resourceType: 'Observation', status: 'final', subject: { reference: `Patient/${pid}` },
  code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
  component: [
    { code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: sys, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } },
    { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: dia, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } },
  ],
});
const anteckning = (status, sokord, pid = 'p01') => ({
  resourceType: 'Composition', status, type: { text: 'Daganteckning' }, subject: { reference: `Patient/${pid}` },
  section: Object.entries(sokord).map(([title, text]) => ({ title, text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${text}</div>` } })),
});
const ordination = (npl, extra = {}) => ({
  resourceType: 'MedicationRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p01' },
  medicationCodeableConcept: { coding: [{ system: 'http://electronichealth.se/fhir/NamingSystem/nplid', code: npl }] },
  reasonCode: [{ text: 'Förmaksflimmer' }], ...extra,
});
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();

describe('FHIR-skrivning', () => {
  test('Observation: blodtryck registreras med samma funktion som gränssnittet och loggas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await fhirAnrop(k, 'POST', '/fhir/Observation', bt(131, 84));
    expect(r.status).toBe(201);
    expect(r.headers.get('content-type')).toContain('application/fhir+json');
    expect(r.data.resourceType).toBe('Observation');
    expect(r.headers.get('location')).toBe(`${app.url}/fhir/Observation/${r.data.id}`);
    expect(r.data.component.map(c => c.valueQuantity.value)).toEqual([131, 84]);
    const db = sandlada(app, k).db;
    const rad = db.query('SELECT * FROM matvarden WHERE id = ?').get(Number(r.data.id));
    // Samma rad som när gränssnittet registrerar: vårdenhet, person, enhet och vårdkontakt sätter systemet.
    const ui = await k.post('/api/patient/p01/matvarden', { typ: 'blodtryck', varde: '131/84' });
    const uiRad = db.query('SELECT * FROM matvarden WHERE id = ?').get(ui.data.id);
    for (const f of ['patient_id', 'enhet_id', 'typ', 'varde', 'matt_enhet', 'registrerad_av', 'vardkontakt_id']) expect(rad[f]).toEqual(uiRad[f]);
    expect(rad.registrerad_av).toBe('ssk-kard');
    expect(rad.vardkontakt_id).not.toBeNull();
    const l = logg(k).filter(x => x.resurs === 'fhir/Observation');
    expect(l.at(-1)).toMatchObject({ personal_id: 'ssk-kard', patient_id: 'p01', handling: 'registrera_matvarde', resultat: 'tillaten' });
  });

  test('Observation: fel värde och fel enhet ger OperationOutcome med svensk text och samma meddelande som gränssnittet', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await fhirAnrop(k, 'POST', '/fhir/Observation', bt(70, 90));
    const ui = await k.post('/api/patient/p01/matvarden', { typ: 'blodtryck', varde: '70/90' });
    expect(r.status).toBe(400);
    expect(r.data.resourceType).toBe('OperationOutcome');
    expect(r.data.issue[0]).toMatchObject({ severity: 'error', code: 'invalid', diagnostics: ui.data.fel, expression: ['Observation.value[x]'] });
    const enhet = bt(131, 84);
    enhet.component[0].valueQuantity.code = 'kPa';
    const e = await fhirAnrop(k, 'POST', '/fhir/Observation', enhet);
    expect(e.status).toBe(400);
    expect(e.data.issue[0].diagnostics).toBe('Fel enhet. Blodtryck anges i mmHg (UCUM mm[Hg]).');
    // Utan kod går mätvärdet att ange med namnet, så att ingen behöver kunna LOINC.
    const puls = await fhirAnrop(k, 'POST', '/fhir/Observation', { resourceType: 'Observation', status: 'final', subject: { reference: 'Patient/p01' }, code: { text: 'Puls' }, valueQuantity: { value: 72 } });
    expect(puls.status).toBe(201);
    expect(puls.data.code.coding[0].code).toBe('8867-4');
  });

  test('nekad: fel roll, ingen vårdrelation och Min journal nekas och nekandet loggas', async () => {
    const k = klient(app);
    await k.logga('logg');
    const r = await fhirAnrop(k, 'POST', '/fhir/Observation', bt(131, 84));
    expect(r.status).toBe(403);
    expect(r.data.issue[0].code).toBe('forbidden');
    const l = klient(app);
    await l.logga('lak-kard');
    // Patient 12 har ingen vårdrelation på kardiologen. Nödåtkomst är ett aktivt val som API:t aldrig gör.
    const fore = sandlada(app, l).db.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p12'").get().n;
    const ingen = await fhirAnrop(l, 'POST', '/fhir/Observation', bt(131, 84, 'p12'));
    expect(ingen.status).toBe(403);
    expect(ingen.data.issue[0].details.coding[0].code).toBe('kraver_val');
    expect(logg(l).at(-1)).toMatchObject({ patient_id: 'p12', resultat: 'nekad', grund: 'nekad' });
    expect(sandlada(app, l).db.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p12'").get().n).toBe(fore);
    const inv = klient(app);
    expect((await inv.post('/api/login/invanare', { invanareId: 'inv-p01' })).status).toBe(200);
    const m = await fhirAnrop(inv, 'POST', '/fhir/Observation', bt(131, 84));
    expect(m.status).toBe(403);
    expect(m.data.issue[0].diagnostics).toContain('Min journal kan bara läsa');
    const utan = klient(app);
    expect((await fhirAnrop(utan, 'POST', '/fhir/Observation', bt(131, 84))).status).toBe(401);
  });

  test('Composition: final skapar och signerar, preliminary sparar ett utkast med samma mall som gränssnittet', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await fhirAnrop(k, 'POST', '/fhir/Composition', anteckning('final', { Aktuellt: 'Mår bättre.', Bedömning: 'Stabil &amp; utan andfåddhet.' }));
    expect(r.status).toBe(201);
    expect(r.data.status).toBe('final');
    const db = sandlada(app, k).db;
    const rad = db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(r.data.id));
    expect(rad).toMatchObject({ status: 'signerad', signerad_av: 'lak-kard', kategori: 'lakare', typ: 'Daganteckning' });
    expect(JSON.parse(rad.sokord)).toEqual([{ sokord: 'Aktuellt', text: 'Mår bättre.' }, { sokord: 'Bedömning', text: 'Stabil & utan andfåddhet.' }]);
    const u = await fhirAnrop(k, 'POST', '/fhir/Composition', anteckning('preliminary', { Aktuellt: 'Utkast.' }));
    expect(u.status).toBe(201);
    expect(u.data.status).toBe('preliminary');
    const okand = await fhirAnrop(k, 'POST', '/fhir/Composition', { ...anteckning('final', { Aktuellt: 'x' }), type: { text: 'Påhittad typ' } });
    expect(okand.status).toBe(400);
    expect(okand.data.issue[0].diagnostics).toBe('Okänd anteckningstyp.');
    // Undersköterskan skriver inte läkaranteckningar, i gränssnittet eller i API:t.
    const usk = klient(app);
    await usk.logga('usk-kard');
    expect((await fhirAnrop(usk, 'POST', '/fhir/Composition', anteckning('final', { Aktuellt: 'x' }))).status).toBe(403);
  });

  test('Composition: ett utkast ändras med PUT och en signerad anteckning rättas med en ny version och orsak', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const u = await fhirAnrop(k, 'POST', '/fhir/Composition', anteckning('preliminary', { Aktuellt: 'Först.' }));
    const a = await fhirAnrop(k, 'PUT', `/fhir/Composition/${u.data.id}`, { ...anteckning('final', { Aktuellt: 'Ändrat.' }), id: u.data.id });
    expect(a.status).toBe(200);
    expect(a.data.status).toBe('final');
    expect(a.data.section[0].text.div).toContain('Ändrat.');
    const utanOrsak = await fhirAnrop(k, 'PUT', `/fhir/Composition/${u.data.id}`, { ...anteckning('final', { Aktuellt: 'Rättat.' }), id: u.data.id });
    expect(utanOrsak.status).toBe(400);
    expect(utanOrsak.data.issue[0].diagnostics).toBe('Ange orsak till rättelsen.');
    const ratt = { ...anteckning('final', { Aktuellt: 'Rättat.' }), id: u.data.id, extension: [{ url: `${EXT}/rattelseorsak`, valueString: 'Fel patient i första meningen.' }] };
    const r = await fhirAnrop(k, 'PUT', `/fhir/Composition/${u.data.id}`, ratt);
    expect(r.status).toBe(201);
    expect(r.data.id).not.toBe(u.data.id);
    expect(r.data.relatesTo[0]).toEqual({ code: 'replaces', targetReference: { reference: `Composition/${u.data.id}` } });
    // Den tidigare versionen står kvar.
    expect(sandlada(app, k).db.query('SELECT status FROM anteckningar WHERE id = ?').get(Number(u.data.id)).status).toBe('signerad');
    const fel = await fhirAnrop(k, 'PUT', `/fhir/Composition/${u.data.id}`, { ...ratt, id: '999' });
    expect(fel.status).toBe(400);
  });

  test('MedicationRequest: samma varningar som läkemedelslistan, och en allvarlig varning kvitteras med motivering', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    // Patient 1 har redan Waran.
    const r = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', ordination('19640101000028', { extension: [{ url: `${EXT}/uppfoljningsdatum`, valueDate: addDagar(idag(), 30) }], dosageInstruction: [{ text: 'Enligt ordinationsschema' }] }));
    const ui = await k.post('/api/patient/p01/lakemedel', { lakemedelId: 'VK-NPL-0001', dosering: 'Enligt ordinationsschema', ordinationsorsak: 'Förmaksflimmer', uppfoljningsdatum: addDagar(idag(), 30) });
    expect(r.status).toBe(400);
    expect(r.data.issue[0].diagnostics).toBe(ui.data.fel);
    const varning = r.data.issue.find(i => i.details?.coding?.[0]?.code === 'dubbel_substans');
    expect(varning).toMatchObject({ severity: 'warning', code: 'business-rule' });
    expect(varning.diagnostics).toContain('Kvittera varningen med tillägget kvitterad-varning');
    const kvitterad = ordination('19640101000028', { dosageInstruction: [{ text: 'Enligt ordinationsschema' }], extension: [
      { url: `${EXT}/uppfoljningsdatum`, valueDate: addDagar(idag(), 30) },
      { url: `${EXT}/kvitterad-varning`, extension: [{ url: 'regel', valueCode: 'dubbel_substans' }, { url: 'motivering', valueString: 'Byte av förpackning, den gamla sätts ut.' }] },
    ] });
    const ok = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', kvitterad, { Prefer: 'return=OperationOutcome' });
    expect(ok.status).toBe(201);
    expect(ok.data.resourceType).toBe('OperationOutcome');
    expect(ok.data.issue[0].diagnostics).toBe('Ordinationen är sparad.');
    expect(ok.data.issue.some(i => i.severity === 'warning' && i.diagnostics.includes('Waran'))).toBe(true);
    const rad = sandlada(app, k).db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(ok.headers.get('location').split('/').pop()));
    expect(JSON.parse(rad.kvitterade_varningar)).toEqual([{ regel: 'dubbel_substans', motivering: 'Byte av förpackning, den gamla sätts ut.' }]);
    // Sjuksköterskan ordinerar inte.
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    expect((await fhirAnrop(ssk, 'POST', '/fhir/MedicationRequest', ordination('19900615000168'))).status).toBe(403);
  });

  test('MedicationRequest: systemet fyller i dosering och uppföljningsdatum ur sitt förslag, men aldrig ordinationsorsaken', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    // Atorvastatin har patienten inte.
    const r = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', ordination('20070404000061', { reasonCode: [{ text: 'Hyperlipidemi' }] }), { Prefer: 'return=OperationOutcome' });
    expect(r.status).toBe(201);
    expect(r.data.issue[0].diagnostics).toMatch(/^Ordinationen är sparad\. Systemet fyllde i doseringen .+ och uppföljningsdatumet \d{4}-\d{2}-\d{2} ur sitt förslag\.$/);
    const f = await k.get('/api/patient/p01/lakemedel/forslag?lakemedelId=VK-NPL-0018');
    const rad = sandlada(app, k).db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(r.headers.get('location').split('/').pop()));
    expect(rad).toMatchObject({ dosering: f.data.dosering, uppfoljning: f.data.uppfoljningsdatum, orsak: 'Hyperlipidemi', ordinerad_av: 'lak-kard' });
    const utan = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', ordination('20041208000021', { reasonCode: [] }));
    expect(utan.status).toBe(400);
    expect(utan.data.issue[0].diagnostics).toContain('Ordinationsorsak och uppföljningsdatum är obligatoriska.');
    expect(utan.data.issue[0].expression).toContain('MedicationRequest.reasonCode[0].text');
    // ATC-koden räcker när den bara ger en produkt, annars ber systemet om NPL-id och säger vilka produkter det gäller.
    const atc = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', { ...ordination('x'), medicationCodeableConcept: { coding: [{ system: 'http://www.whocc.no/atc', code: 'C09AA05' }] }, dosageInstruction: [{ text: '1 tablett på morgonen' }] });
    expect(atc.status).toBe(201);
    expect(atc.data.medicationCodeableConcept.text).toContain('Ramipril');
    // Utan förslag för produkten skriver förskrivaren doseringen, som i gränssnittet.
    const utanDosering = await fhirAnrop(k, 'POST', '/fhir/MedicationRequest', ordination('20100615000052'));
    expect(utanDosering.status).toBe(400);
    expect(utanDosering.data.issue[0].expression).toEqual(['MedicationRequest.dosageInstruction[0].text']);
  });

  test('MedicationRequest: utsättning med status stopped, och antikoagulantia sätts bara ut med en plan', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const alvedon = db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn = 'Alvedon' AND o.status = 'aktiv'").get().id;
    const ingenOrsak = await fhirAnrop(k, 'PUT', `/fhir/MedicationRequest/${alvedon}`, { resourceType: 'MedicationRequest', id: String(alvedon), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' } });
    expect(ingenOrsak.status).toBe(400);
    expect(ingenOrsak.data.issue[0].diagnostics).toBe('Ange orsak till utsättningen.');
    const r = await fhirAnrop(k, 'PUT', `/fhir/MedicationRequest/${alvedon}`, { resourceType: 'MedicationRequest', id: String(alvedon), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' }, statusReason: { text: 'Smärtfri' } });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('stopped');
    expect(r.data.extension.find(e => e.url.endsWith('/utsattningsorsak')).valueString).toBe('Smärtfri');
    const andra = await fhirAnrop(k, 'PUT', `/fhir/MedicationRequest/${alvedon}`, { resourceType: 'MedicationRequest', id: String(alvedon), status: 'active', intent: 'order', subject: { reference: 'Patient/p01' } });
    expect(andra.status).toBe(405);
    const waran = db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn = 'Waran' AND o.status = 'aktiv'").get().id;
    const stopp = { resourceType: 'MedicationRequest', id: String(waran), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' } };
    const utanPlan = await fhirAnrop(k, 'PUT', `/fhir/MedicationRequest/${waran}`, stopp);
    expect(utanPlan.status).toBe(400);
    expect(utanPlan.data.issue[0].diagnostics).toContain('Antikoagulantia sätts bara ut med en plan');
    expect(utanPlan.data.issue.filter(i => i.diagnostics.startsWith('Plan ')).length).toBe(3);
    const ater = addDagar(idag(), 5);
    const medPlan = await fhirAnrop(k, 'PUT', `/fhir/MedicationRequest/${waran}`, { ...stopp, extension: [{ url: `${EXT}/utsattningsplan`, valueCode: 'uppehall' }, { url: `${EXT}/aterinsattningsdatum`, valueDate: ater }] });
    expect(medPlan.status).toBe(200);
    expect(medPlan.data.extension.find(e => e.url.endsWith('/aterinsattningsdatum')).valueDate).toBe(ater);
    expect(db.query('SELECT typ FROM utsattningsplaner WHERE ordination_id = ?').get(waran).typ).toBe('uppehall');
  });

  test('ServiceRequest: remissen får samma förval som formuläret och samma kontroller', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const sr = { resourceType: 'ServiceRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p01' }, performer: [{ reference: 'Organization/uso-kard' }], reasonCode: [{ text: 'Bedömning inför elkonvertering.' }], note: [{ text: 'Förmaksflimmer sedan 2014.' }] };
    const r = await fhirAnrop(k, 'POST', '/fhir/ServiceRequest', sr);
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ priority: 'routine', reasonCode: [{ text: 'Bedömning inför elkonvertering.' }] });
    expect(r.data.extension.find(e => e.url.endsWith('/svar-senast')).valueDate).toBe(addDagar(idag(), 14));
    const rad = sandlada(app, k).db.query('SELECT * FROM remisser WHERE id = ?').get(Number(r.data.id));
    expect(rad).toMatchObject({ fran_enhet_id: 'vc-tybble', till_enhet_id: 'uso-kard', avsandare_id: 'lak-vc', anamnes: 'Förmaksflimmer sedan 2014.', status: 'skickad' });
    const egen = await fhirAnrop(k, 'POST', '/fhir/ServiceRequest', { ...sr, performer: [{ reference: 'Organization/vc-tybble' }] });
    expect(egen.status).toBe(400);
    expect(egen.data.issue[0].expression).toContain('ServiceRequest.performer');
  });

  test('inget går att göra via API:t som gränssnittet inte tillåter: diagnoser, överkänslighet, borttagning och ändrade mätvärden', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const cond = await fhirAnrop(k, 'POST', '/fhir/Condition', { resourceType: 'Condition', subject: { reference: 'Patient/p01' }, code: { text: 'Hypertoni' } });
    expect(cond.status).toBe(405);
    expect(cond.data.issue[0]).toMatchObject({ code: 'not-supported' });
    expect(cond.data.issue[0].diagnostics).toContain('Diagnoser registreras inte i gränssnittet');
    expect((await fhirAnrop(k, 'POST', '/fhir/AllergyIntolerance', { resourceType: 'AllergyIntolerance', patient: { reference: 'Patient/p01' } })).status).toBe(405);
    const bort = await fhirAnrop(k, 'DELETE', '/fhir/Composition/1');
    expect(bort.status).toBe(405);
    expect(bort.data.issue[0].diagnostics).toContain('Journaluppgifter tas aldrig bort');
    const mv = await fhirAnrop(k, 'PUT', '/fhir/Observation/1', { ...bt(120, 80), id: '1' });
    expect(mv.status).toBe(405);
    expect(mv.data.issue[0].diagnostics).toContain('Ett registrerat mätvärde ändras inte');
    const fel = await fhirAnrop(k, 'POST', '/fhir/Observation', { resourceType: 'Patient' });
    expect(fel.status).toBe(400);
    expect((await k.raw('POST', '/fhir/Observation', undefined, { 'Content-Type': 'text/plain' })).status).toBe(415);
  });

  test('skrivning med sessionskakan kräver rätt ursprung, som andra skrivande anrop', async () => {
    const app2 = testserver({ origin: 'https://vardkallan.404haven.se' });
    try {
      const k = klient(app2, { origin: 'https://vardkallan.404haven.se' });
      await k.logga('ssk-kard');
      expect((await k.raw('POST', '/fhir/Observation', bt(130, 80))).status).toBe(201);
      const angripare = await fetch(`${app2.url}/fhir/Observation`, { method: 'POST', headers: { Cookie: k.kaka(), Origin: 'https://angripare.example', 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(bt(130, 80)) });
      expect(angripare.status).toBe(403);
      const utanUrsprung = await fetch(`${app2.url}/fhir/Observation`, { method: 'POST', headers: { Cookie: k.kaka(), 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(bt(130, 80)) });
      expect(utanUrsprung.status).toBe(403);
    } finally { app2.stopp(); }
  });
});
