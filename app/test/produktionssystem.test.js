import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { LABORATORIER, DISCIPLINER, ANALYS } from '../src/labb-katalog.js';
import { ANALYS_SYSTEM, diagnosticReportFor } from '../src/produktionssystem.js';
import { MATKOD } from '../src/kodverk.js';

// Integration med produktionssystem för beställning och svar (runda 10, r6, Sussa 5.1.4.5). Producentsystemet ansluts
// genom det öppna gränssnittet med en nyckel som systemförvaltningen skapar, och beställning ut, status in, svar in och
// katalog in går i HL7 FHIR R4. Systemet är experten: det väljer standard och adresser, kontrollerar varje meddelande
// helt innan något sparas och förklarar på vanlig svenska vad som är fel.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
const ps = async (metod, vag, nyckel, kropp) => {
  const res = await fetch(app.url + vag, { method: metod, headers: { ...(nyckel ? { Authorization: `Bearer ${nyckel}` } : {}), ...(kropp !== undefined ? { 'Content-Type': 'application/fhir+json' } : {}) }, body: kropp !== undefined ? JSON.stringify(kropp) : undefined });
  return { status: res.status, data: await res.json() };
};
// Ansluter laboratoriet och beställer analyserna med provet taget, så att beställningen ligger i utkorgen.
async function forbered(lab, analyser) {
  const sysf = await inloggad('sysf');
  const lak = await inloggad('lak-kard');
  delaSandlada(lak, sysf);
  const a = await sysf.post(`/api/produktionssystem/${lab}/anslut`, {});
  const b = (await lak.post('/api/patient/p04/prover', { analyser, kvitteraDubbletter: true })).data.bestallning;
  for (const p of b.prov) await lak.post(`/api/labb/prov/${p.id}/tagen`, {});
  return { sysf, lak, nyckel: a.data.nyckel, anslut: a, b };
}
const basedOn = (analysId) => [{ reference: `ServiceRequest/labb-${analysId}` }];
const obs = (typ, varde) => ({ resourceType: 'Observation', id: typ, status: 'final', code: { coding: MATKOD[typ].coding }, valueQuantity: { value: varde } });

describe('Integration med produktionssystem', () => {
  test('disciplinerna: klinisk kemi, klinisk fysiologi, klinisk neurofysiologi, mikrobiologi, immunologi, patologi, genetik, radiologi och transfusionsmedicin har laboratorier och analyser', () => {
    for (const d of ['klinisk_kemi', 'klinisk_fysiologi', 'klinisk_neurofysiologi', 'mikrobiologi', 'klinisk_immunologi', 'patologi', 'klinisk_genetik', 'radiologi', 'transfusionsmedicin']) {
      expect(Object.hasOwn(DISCIPLINER, d)).toBe(true);
      expect(LABORATORIER.some(l => l.disciplin === d)).toBe(true);
      expect(Object.values(ANALYS).some(a => a.disciplin === d)).toBe(true);
    }
  });

  test('anslutning: systemförvaltaren ansluter laboratoriet, nyckeln visas en gång och sparas som HMAC, och andra roller får inte', async () => {
    const lak = await inloggad('lak-kard');
    expect((await lak.post('/api/produktionssystem/lab-kem-uso/anslut', {})).status).toBe(403);
    const sysf = await inloggad('sysf');
    const a = await sysf.post('/api/produktionssystem/lab-kem-uso/anslut', {});
    expect(a.status).toBe(201);
    expect(a.data.nyckel).toMatch(/^vkps_/);
    expect(a.data.standard).toBe('HL7 FHIR R4');
    expect(a.data.floden.map(f => f.id)).toEqual(['bestallning', 'status', 'svar', 'katalog']);
    expect(JSON.stringify(db(sysf).query('SELECT * FROM ps_anslutningar').all())).not.toContain(a.data.nyckel);
    expect((await sysf.post('/api/produktionssystem/constructor/anslut', {})).status).toBe(404);
    const o = (await sysf.get('/api/produktionssystem')).data;
    expect(o.laboratorier.find(l => l.id === 'lab-kem-uso')).toMatchObject({ ansluten: true, disciplinNamn: 'Klinisk kemi' });
    // Utan nyckel, med fel nyckel och efter en ny nyckel gäller den gamla inte.
    expect((await ps('GET', '/ps/bestallningar')).status).toBe(401);
    expect((await ps('GET', '/ps/bestallningar', 'vkps_fel')).status).toBe(401);
    expect((await ps('GET', '/ps/bestallningar', a.data.nyckel)).status).toBe(200);
    const ny = (await sysf.post('/api/produktionssystem/lab-kem-uso/anslut', {})).data.nyckel;
    expect((await ps('GET', '/ps/bestallningar', a.data.nyckel)).status).toBe(401);
    expect((await ps('GET', '/ps/bestallningar', ny)).status).toBe(200);
    expect((await sysf.post('/api/produktionssystem/lab-kem-uso/koppla-fran', {})).status).toBe(200);
    expect((await ps('GET', '/ps/bestallningar', ny)).status).toBe(401);
    // Gränssnittets beskrivning kräver ingen nyckel och har inga patientuppgifter.
    expect((await ps('GET', '/ps')).data.floden).toHaveLength(4);
  });

  test('beställning ut: proverna går till utkorgen som Patient, ServiceRequest och Specimen, hämtningen loggas på patienten och det simulerade laboratoriet svarar inte', async () => {
    const { lak, nyckel, b } = await forbered('lab-kem-uso', ['crp', 'kreatinin']);
    const best = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.id === b.id);
    expect(best.analyser.every(a => a.status === 'skickad')).toBe(true);
    expect(best.producentsystem.map(x => x.lab.id)).toEqual(['lab-kem-uso']);
    expect(best.kan.simuleraSvar).toBe(false);
    expect((await lak.post(`/api/labb/${b.id}/simulera-svar`, {})).status).toBe(409);
    const h = await ps('GET', '/ps/bestallningar', nyckel);
    expect(h.status).toBe(200);
    expect(h.data).toMatchObject({ resourceType: 'Bundle', type: 'searchset', total: 1 });
    const m = h.data.entry[0].resource;
    expect(m.meta.tag[0].code).toBe('bestallning');
    const typer = m.entry.map(e => e.resource.resourceType);
    expect(typer.filter(t => t === 'ServiceRequest')).toHaveLength(2);
    expect(typer).toContain('Specimen');
    const pat = m.entry.find(e => e.resource.resourceType === 'Patient').resource;
    expect(pat.identifier[0].value).toBe(db(lak).query("SELECT personnummer FROM patienter WHERE id = 'p04'").get().personnummer);
    // Runda 11: könet i databasen är "kvinna" eller "man", och laboratoriet får det som FHIR:s female eller male.
    const kon = db(lak).query("SELECT kon FROM patienter WHERE id = 'p04'").get().kon;
    expect(pat.gender).toBe({ kvinna: 'female', man: 'male' }[kon]);
    expect(m.entry.find(e => e.resource.resourceType === 'ServiceRequest').resource.requisition.value).toBe(b.nummer);
    expect(db(lak).query("SELECT * FROM atkomstlogg WHERE handling = 'labb_integration' AND patient_id = 'p04'").all().length).toBe(1);
    // Kvittensen tar bort meddelandet ur utkorgen. En kvittens av ett annat laboratoriums meddelande ger 404.
    expect((await ps('POST', `/ps/bestallningar/${m.id.replace('ps-', '')}/kvittens`, nyckel, {})).status).toBe(200);
    expect((await ps('GET', '/ps/bestallningar', nyckel)).data.total).toBe(0);
    expect((await ps('POST', '/ps/bestallningar/999999/kvittens', nyckel, {})).status).toBe(404);
    // En skyddad identitet skickas utan namn och med säkerhetsmärkning.
    db(lak).query("UPDATE patienter SET skyddad = 1 WHERE id = 'p04'").run();
    const b2 = (await lak.post('/api/patient/p04/prover', { analyser: ['natrium'], kvitteraDubbletter: true })).data.bestallning;
    for (const p of b2.prov) await lak.post(`/api/labb/prov/${p.id}/tagen`, {});
    const sk = (await ps('GET', '/ps/bestallningar', nyckel)).data.entry[0].resource.entry.find(e => e.resource.resourceType === 'Patient').resource;
    expect(sk.name).toBeUndefined();
    expect(sk.meta.security[0].code).toBe('R');
    // En makulering går samma väg.
    const b3 = (await lak.post('/api/patient/p04/prover', { analyser: ['kalium'], kvitteraDubbletter: true })).data.bestallning;
    for (const p of b3.prov) await lak.post(`/api/labb/prov/${p.id}/tagen`, {});
    expect((await lak.post(`/api/labb/${b3.id}/makulera`, { orsak: 'Fel patient.' })).status).toBe(200);
    expect((await ps('GET', '/ps/bestallningar', nyckel)).data.entry.map(e => e.resource.meta.tag[0].code)).toContain('makulering');
  });

  test('status och svar in: mottagen och svar med NPU-kod blir mätvärden som väntar på vidimering, och ett kritiskt värde larmar efter Vårdkällans egna gränser', async () => {
    const { lak, nyckel, b } = await forbered('lab-kem-uso', ['crp', 'kalium']);
    const [crp, kalium] = b.analyser;
    const t = await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'received', intent: 'order', basedOn: basedOn(crp.id) });
    expect(t.status).toBe(200);
    expect(db(lak).query('SELECT status, mottagen_tid FROM labb_analyser WHERE id = ?').get(crp.id)).toMatchObject({ status: 'mottagen' });
    const s = await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(crp.id), contained: [obs('crp', 42)], result: [{ reference: '#crp' }] });
    expect(s.status).toBe(201);
    // Kalium 6,8 är kritiskt efter Vårdkällans gränser, fast laboratoriet inte markerar det.
    const k = await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(kalium.id), contained: [obs('kalium', 6.8)], result: [{ reference: '#kalium' }] });
    expect(k.status).toBe(201);
    expect(k.data.issue[0].diagnostics).toContain('kritiskt');
    const best = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.id === b.id);
    expect(best.status).toBe('besvarad');
    expect(best.analyser.find(a => a.id === kalium.id)).toMatchObject({ kritisk: true });
    expect(db(lak).query("SELECT varde_num FROM matvarden m JOIN labb_svar s ON s.matvarde_id = m.id WHERE s.analys_rad_id = ?").get(crp.id).varde_num).toBe(42);
    const ink = (await lak.get('/api/inkorg')).data;
    expect(ink.provsvarAttVidimera.some(x => x.bestallningId === b.id)).toBe(true);
    expect((await lak.post(`/api/labb/${b.id}/vidimera`, {})).data.bestallning.status).toBe('vidimerad');
    // Ett svar till på samma analys tas inte emot.
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(crp.id), contained: [obs('crp', 5)], result: [{ reference: '#crp' }] })).status).toBe(400);
  });

  test('svar in: ett meddelande som inte går att ta emot får en förklaring på svenska och ändrar ingenting', async () => {
    const { lak, nyckel, b } = await forbered('lab-kem-uso', ['kreatinin']);
    const a = b.analyser[0];
    const fel = [
      [{ resourceType: 'Observation' }, 'DiagnosticReport'],
      [{ resourceType: 'DiagnosticReport', status: 'final', basedOn: [] }, 'basedOn'],
      [{ resourceType: 'DiagnosticReport', status: 'preliminary', basedOn: basedOn(a.id) }, 'final'],
      [{ resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id), contained: [obs('crp', 4)], result: [{ reference: '#crp' }] }, 'hör inte till'],
      [{ resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id), contained: [{ ...obs('kreatinin', 'hög') }], result: [{ reference: '#kreatinin' }] }, 'tal'],
      [{ resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id), contained: [{ ...obs('kreatinin', 80), valueQuantity: { value: 80, unit: 'mg/dl' } }], result: [{ reference: '#kreatinin' }] }, 'Enheten'],
    ];
    for (const [kropp, text] of fel) {
      const r = await ps('POST', '/ps/DiagnosticReport', nyckel, kropp);
      expect(r.status).toBe(400);
      expect(r.data.resourceType).toBe('OperationOutcome');
      expect(r.data.issue[0].diagnostics).toContain(text);
    }
    expect(db(lak).query('SELECT status FROM labb_analyser WHERE id = ?').get(a.id).status).toBe('skickad');
    expect(db(lak).query('SELECT count(*) AS n FROM labb_svar WHERE analys_rad_id = ?').get(a.id).n).toBe(0);
    // En analys hos ett annat laboratorium finns inte för det här producentsystemet.
    const sysf2 = await inloggad('sysf');
    delaSandlada(lak, sysf2);
    const annan = (await sysf2.post('/api/produktionssystem/lab-mikro-uso/anslut', {})).data.nyckel;
    expect((await ps('POST', '/ps/DiagnosticReport', annan, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id) })).status).toBe(404);
    expect((await ps('POST', '/ps/Task', annan, { resourceType: 'Task', status: 'received', basedOn: basedOn(a.id) })).status).toBe(404);
    // Ett prov som inte kan analyseras blir ett besked till läkaren, med orsaken.
    expect((await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'rejected', basedOn: basedOn(a.id) })).status).toBe(400);
    expect((await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'rejected', basedOn: basedOn(a.id), statusReason: { text: 'Hemolys.' } })).status).toBe(200);
    expect(db(lak).query('SELECT status, svar_text FROM labb_analyser WHERE id = ?').get(a.id)).toMatchObject({ status: 'besvarad', svar_text: expect.stringContaining('Hemolys') });
    // Avvisade meddelanden räknas i översikten.
    expect((await sysf2.get('/api/produktionssystem')).data.laboratorier.find(l => l.id === 'lab-kem-uso').inkommande.avvisade).toBeGreaterThanOrEqual(5);
  });

  test('svar in för mikrobiologi, immunologi och genetik: fynd i Snomed CT och utlåtanden i text', async () => {
    const m = await forbered('lab-mikro-uso', ['urinodling']);
    const u = m.b.analyser[0];
    expect((await ps('POST', '/ps/DiagnosticReport', m.nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(u.id), conclusion: 'Växt.' })).status).toBe(400);
    expect((await ps('POST', '/ps/DiagnosticReport', m.nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(u.id), conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '112283007' }] }] })).status).toBe(201);
    expect(db(m.lak).query('SELECT fynd, avvikande FROM labb_analyser WHERE id = ?').get(u.id)).toEqual({ fynd: 'e_coli', avvikande: 'fynd' });
    for (const [lab, analys] of [['lab-imm-uso', 'ana'], ['lab-gen-uso', 'hfe']]) {
      const x = await forbered(lab, [analys]);
      const a = x.b.analyser[0];
      expect(a.lab.id).toBe(lab);
      expect((await ps('POST', '/ps/DiagnosticReport', x.nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id) })).status).toBe(400);
      expect((await ps('POST', '/ps/DiagnosticReport', x.nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(a.id), conclusion: 'Utlåtande från laboratoriet.' })).status).toBe(201);
      expect(db(x.lak).query('SELECT svar_text FROM labb_analyser WHERE id = ?').get(a.id).svar_text).toBe('Utlåtande från laboratoriet.');
    }
  });

  test('undersökningar: klinisk fysiologi, neurofysiologi och radiologi skickas direkt utan provtagning och besvaras med ett utlåtande', async () => {
    const lak = await inloggad('lak-kard');
    const b = await lak.post('/api/patient/p04/prover', { analyser: ['ekg', 'eeg', 'rtg_lungor'], anamnes: 'Svimning och hosta.', kvitteraDubbletter: true, graviditet: 'nej' });
    expect(b.status).toBe(201);
    const best = b.data.bestallning;
    expect(best.analyser.map(a => a.lab.id).sort()).toEqual(['lab-fys-uso', 'lab-nfys-uso', 'lab-rad-uso']);
    // Ingen provtagning: beställningen är skickad direkt och står inte på provtagningslistan.
    expect(best.analyser.every(a => a.status === 'mottagen')).toBe(true);
    expect(best.steg.find(s => s.steg === 'provtagen')).toMatchObject({ text: 'Skickad till den utförande enheten', klar: true });
    expect(best.kan.taProv).toBe(false);
    expect(best.historik.find(h => h.handelse === 'Skickad').detalj).not.toContain('rör');
    const ssk = await inloggad('ssk-kard');
    delaSandlada(lak, ssk);
    const rad = (await ssk.get('/api/provtagning')).data.patienter.find(p => p.patient.id === 'p04');
    expect(rad?.bestallningar.find(x => x.id === best.id)?.prov.every(p => p.provtagen) ?? true).toBe(true);
    // Det simulerade laboratoriet svarar med utlåtandet, och FHIR har ingen Specimen för en undersökning.
    expect((await lak.post(`/api/labb/${best.id}/simulera-svar`, {})).status).toBe(200);
    const svar = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.id === best.id);
    expect(svar.analyser.find(a => a.analys === 'ekg').text).toContain('Normalt vilo-EKG');
    const sr = await lak.raw('GET', `/fhir/ServiceRequest/labb-${best.analyser[0].id}`);
    expect(sr.data.specimen).toBeUndefined();
    // Med ett anslutet producentsystem (radiologins) går beställningen genom gränssnittet, utan Specimen.
    const sysf = await inloggad('sysf');
    delaSandlada(lak, sysf);
    const nyckel = (await sysf.post('/api/produktionssystem/lab-rad-uso/anslut', {})).data.nyckel;
    const r = (await lak.post('/api/patient/p04/prover', { analyser: ['rtg_lungor'], anamnes: 'Hosta.', kvitteraDubbletter: true, graviditet: 'nej' })).data.bestallning;
    expect(r.analyser[0].status).toBe('skickad');
    const m = (await ps('GET', '/ps/bestallningar', nyckel)).data.entry[0].resource;
    expect(m.entry.map(e => e.resource.resourceType).sort()).toEqual(['Patient', 'ServiceRequest']);
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(r.analyser[0].id), conclusion: 'Inga infiltrat.' })).status).toBe(201);
  });

  test('transfusionsmedicin: blodgruppering, bastest och blodkomponenter går mellan Vårdkällan och blodcentralens producentsystem', async () => {
    const sysf = await inloggad('sysf');
    const lak = await inloggad('lak-kard');
    delaSandlada(lak, sysf);
    const nyckel = (await sysf.post('/api/produktionssystem/lab-blod-uso/anslut', {})).data.nyckel;
    // (4) Blodcentralens katalog kopplas till blodgruppering och bastest.
    const ad = (kod, title) => ({ resource: { resourceType: 'ActivityDefinition', status: 'active', title, code: { coding: [{ system: ANALYS_SYSTEM, code: kod }] } } });
    expect((await ps('PUT', '/ps/katalog', nyckel, { resourceType: 'Bundle', entry: [ad('blodgruppering', 'B-Blodgruppering'), ad('bastest', 'B-Bastest')] })).data.vardkallan.kopplade).toBe(2);
    // (1) Läkaren beställer erytrocyter. Systemet beställer blodgruppering och bastest, och blodbeställningen går ut.
    const best = await lak.post('/api/patient/p04/blod', { produkt: 'erytrocyter', antal: 2, indikation: 'Hb 72 med trötthet.' });
    expect(best.status).toBe(201);
    const blodId = best.data.id;
    const prover = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.analyser.some(a => a.analys === 'bastest') && x.status === 'bestalld');
    // Runda 13, r3 (E2-53): rören för blodgruppering och bastest tas efter kontroll med armbandet.
    const p04Band = (await lak.post('/api/patient/p04/armband')).data.kod;
    for (const p of prover.prov) await lak.post(`/api/labb/prov/${p.id}/tagen`, { identitet: { armband: p04Band } });
    const ut = (await ps('GET', '/ps/bestallningar', nyckel)).data.entry.map(e => e.resource);
    const bm = ut.find(m => m.meta.tag[0].code === 'blodbestallning');
    const sr = bm.entry.find(e => e.resource.resourceType === 'ServiceRequest').resource;
    expect(sr).toMatchObject({ id: `blod-${blodId}`, quantityQuantity: { value: 2 }, code: { coding: [{ code: 'erytrocyter' }] }, reasonCode: [{ text: 'Hb 72 med trötthet.' }] });
    expect(ut.find(m => m.meta.tag[0].code === 'bestallning').entry.filter(e => e.resource.resourceType === 'ServiceRequest')).toHaveLength(2);
    // Den simulerade blodcentralen bereder inget när producentsystemet är anslutet.
    expect((await lak.get('/api/patient/p04/blod')).data.bestallningar.find(x => x.id === blodId).status).toBe('vantar_prov');
    // (2) och (3): status och svar. Blodgruppen ska gå att läsa, och bastestets utfall anges i Snomed CT.
    const gr = prover.analyser.find(a => a.analys === 'blodgruppering');
    const bt = prover.analyser.find(a => a.analys === 'bastest');
    expect((await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'received', basedOn: basedOn(gr.id) })).status).toBe(200);
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(gr.id), conclusion: 'Grupp A.' })).status).toBe(400);
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(gr.id), conclusion: 'Blodgrupp A RhD positiv.' })).status).toBe(201);
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(bt.id), conclusion: 'Negativ.' })).status).toBe(400);
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: basedOn(bt.id), conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '260385009' }] }] })).status).toBe(201);
    // Blodcentralen bereder enheterna. Systemet prövar blodgruppen mot patientens och antalet mot beställningen.
    const blodBas = [{ reference: `ServiceRequest/blod-${blodId}` }];
    const enheter = (grupp, nr) => [{ type: { text: 'blodgrupp' }, valueString: grupp }, ...nr.map(n => ({ type: { text: 'blodenhet' }, valueIdentifier: { value: n } }))];
    expect((await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'received', basedOn: blodBas })).status).toBe(200);
    const oforenlig = await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'completed', basedOn: blodBas, output: enheter('B+', ['E00000001', 'E00000002']) });
    expect(oforenlig.status).toBe(400);
    expect(oforenlig.data.issue[0].diagnostics).toContain('inte förenlig');
    expect((await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'completed', basedOn: blodBas, output: enheter('O-', ['E00000001']) })).data.issue[0].diagnostics).toContain('2 enheter');
    const ok = await ps('POST', '/ps/Task', nyckel, { resourceType: 'Task', status: 'completed', basedOn: blodBas, output: enheter('O-', ['E00000001', 'E00000002']) });
    expect(ok.status).toBe(200);
    const b = (await lak.get('/api/patient/p04/blod')).data.bestallningar.find(x => x.id === blodId);
    expect(b.status).toBe('beredd');
    expect(b.enheter.map(e => [e.enhetsnummer, e.blodgrupp])).toEqual([['E00000001', 'O-'], ['E00000002', 'O-']]);
    // Ett annat laboratorium kan inte svara på en blodbeställning.
    const annan = (await sysf.post('/api/produktionssystem/lab-kem-uso/anslut', {})).data.nyckel;
    expect((await ps('POST', '/ps/Task', annan, { resourceType: 'Task', status: 'received', basedOn: blodBas })).status).toBe(404);
    // Det simulerade producentsystemet går samma väg: proverna och sedan blodet, med patientens blodgrupp.
    const andra = await lak.post('/api/patient/p04/blod', { produkt: 'plasma', antal: 1, indikation: 'Blödning.' });
    expect((await sysf.post('/api/produktionssystem/lab-blod-uso/simulera', {})).data.svar).toBe(1);
    const p2 = (await lak.get('/api/patient/p04/blod')).data.bestallningar.find(x => x.id === andra.data.id);
    expect(p2).toMatchObject({ status: 'beredd', enheter: [{ blodgrupp: 'A+' }] });
  });

  test('katalog in: laboratoriets katalog kopplas till Vårdkällans analyser, och en analys som inte erbjuds kan inte beställas', async () => {
    const sysf = await inloggad('sysf');
    const lak = await inloggad('lak-kard');
    delaSandlada(lak, sysf);
    const nyckel = (await sysf.post('/api/produktionssystem/lab-kem-uso/anslut', {})).data.nyckel;
    const ad = (kod, title, status, extra = {}) => ({ resource: { resourceType: 'ActivityDefinition', status, title, code: { coding: [{ system: 'urn:lab:demo', code: kod }, ...(extra.coding ?? [])] }, ...(extra.timingDuration ? { timingDuration: extra.timingDuration } : {}) } });
    expect((await ps('PUT', '/ps/katalog', nyckel, { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient' } }] })).status).toBe(400);
    expect((await ps('PUT', '/ps/katalog', nyckel, { resourceType: 'Bundle', entry: [ad('', 'Utan kod', 'active')] })).status).toBe(400);
    const k = await ps('PUT', '/ps/katalog', nyckel, { resourceType: 'Bundle', type: 'collection', entry: [
      ad('L-CRP', 'P-CRP', 'active', { coding: [{ system: ANALYS_SYSTEM, code: 'crp' }], timingDuration: { value: 1, unit: 'h' } }),
      ad('L-NA', 'P-Natrium', 'active', { coding: MATKOD.natrium.coding }),
      ad('L-K', 'P-Kalium', 'retired', { coding: [{ system: ANALYS_SYSTEM, code: 'kalium' }] }),
      ad('L-NY', 'P-Ny analys', 'active'),
    ] });
    expect(k.status).toBe(200);
    expect(k.data.vardkallan).toMatchObject({ analyser: 4, kopplade: 3, attKoppla: [{ kod: 'L-NY', namn: 'P-Ny analys' }] });
    expect(k.data.vardkallan.ejErbjudna).toContain('P-Kalium');
    expect(db(sysf).query("SELECT svarstid_minuter FROM ps_katalog WHERE lab_id = 'lab-kem-uso' AND kod = 'L-CRP'").get().svarstid_minuter).toBe(60);
    // Kalium är utgånget och glukos finns inte i katalogen: systemet säger varför de inte kan beställas.
    for (const analys of ['kalium', 'glukos']) {
      const r = await lak.post('/api/patient/p04/prover', { analyser: [analys], kvitteraDubbletter: true });
      expect(r.status).toBe(400);
      expect(r.data.fel).toContain('enligt laboratoriets egen katalog');
    }
    expect((await lak.post('/api/patient/p04/prover', { analyser: ['crp', 'natrium'], kvitteraDubbletter: true })).status).toBe(201);
    // Ett annat laboratorium påverkas inte, och översikten visar katalogen utan patientuppgifter.
    expect((await lak.post('/api/patient/p04/prover', { analyser: ['urinodling'], anamnes: 'Sveda.', kvitteraDubbletter: true })).status).toBe(201);
    const o = (await sysf.get('/api/produktionssystem')).data.laboratorier.find(l => l.id === 'lab-kem-uso');
    expect(o.katalog).toMatchObject({ analyser: 4, erbjuds: 3, attKoppla: 1 });
  });

  test('det simulerade producentsystemet hämtar, kvitterar och svarar genom samma gränssnitt, för systemförvaltningen', async () => {
    const { sysf, lak, b } = await forbered('lab-kem-uso', ['crp', 'kreatinin']);
    expect((await lak.post('/api/produktionssystem/lab-kem-uso/simulera', {})).status).toBe(403);
    const s = await sysf.post('/api/produktionssystem/lab-kem-uso/simulera', {});
    expect(s.status).toBe(200);
    expect(s.data).toMatchObject({ meddelanden: 1, svar: 2 });
    expect(s.data.simulerad).toContain('simulerat');
    const best = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.id === b.id);
    expect(best.status).toBe('besvarad');
    // Kreatininet ger eGFR, som Vårdkällan räknar själv.
    expect(best.analyser.find(a => a.analys === 'kreatinin').svar.map(v => v.typ)).toEqual(expect.arrayContaining(['kreatinin', 'egfr']));
    expect(db(sysf).query("SELECT count(*) AS n FROM ps_meddelanden WHERE riktning = 'in' AND typ = 'svar' AND resultat = 'mottaget'").get().n).toBe(2);
    // Ett svar från det simulerade laboratoriet blir en giltig DiagnosticReport för ett producentsystem.
    const dr = diagnosticReportFor({ varden: [{ typ: 'crp', varde: 3, enhet: 'mg/L' }], text: null, fynd: null }, basedOn(1), ANALYS.crp);
    expect(dr).toMatchObject({ resourceType: 'DiagnosticReport', status: 'final', result: [{ reference: '#v1' }] });
  });
});
