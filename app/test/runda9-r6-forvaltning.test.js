// Runda 9, r6: fler av klickbudgetens flöden via API:t och ärenden mellan kund och utvecklare (Sussa 2.5.1.3), och
// tillämpningar och mottagare som systemförvaltaren registrerar (2.6.1.2 och 2.5.1.2).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { randomBytes, createHash } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import { ANDRINGAR } from '../src/api-andringar.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const vantar = (k, pid) => sandlada(app, k).db.query("SELECT * FROM vantelista WHERE patient_id = ? AND status = 'vantar' AND remiss_id IS NOT NULL ORDER BY id LIMIT 1").get(pid);

describe('Fler flöden via API:t', () => {
  test('Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    const post = vantar(k, 'p10');
    expect(post).toBeTruthy();
    const forslag = (await k.get(`/api/vantelista/${post.id}/forslag`)).data.forslag;
    const r = await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }], participant: [{ actor: { reference: 'Patient/p10' }, status: 'accepted' }] });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ resourceType: 'Appointment', status: 'booked' });
    expect(r.headers.get('location')).toBe(`${app.url}/fhir/Appointment/${r.data.id}`);
    const db = sandlada(app, k).db;
    const b = db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(r.data.id));
    // Systemet valde sin första föreslagna tid, och posten på väntelistan är bokad som i gränssnittet.
    expect(b).toMatchObject({ patient_id: 'p10', tid_id: forslag[0].tidId, remiss_id: post.remiss_id });
    expect(db.query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).not.toBe('vantar');
    expect(logg(k).some(l => l.handling === 'boka' && l.patient_id === 'p10' && l.resurs === `bokning:${b.id}`)).toBe(true);
    // Samma remiss en gång till: den väntar inte längre på en tid.
    const igen = await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }] });
    expect(igen.status).toBe(400);
    expect(igen.data.issue[0].expression).toEqual(['Appointment.basedOn']);
  });

  test('Appointment: fel roll, en annan patient och en tid som inte passar remissen nekas med en förklaring', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    // En ny sandlåda, där remissen för patient 10 väntar på en tid.
    const post = vantar(k, 'p10');
    expect(post).toBeTruthy();
    const annanPid = post.patient_id === 'p02' ? 'p03' : 'p02';
    const annan = await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }], participant: [{ actor: { reference: `Patient/${annanPid}` } }] });
    const saknas = await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: 'ServiceRequest/999999' }] });
    expect(annan.status).toBe(400);
    expect(annan.data.issue[0].diagnostics).toBe(saknas.data.issue[0].diagnostics);
    // En gruppträff passar inte remissen.
    const grupp = sandlada(app, k).db.query("SELECT t.id FROM tider t WHERE t.tidstyp = 'grupp' LIMIT 1").get();
    const fel = await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }], slot: [{ reference: `Slot/${grupp.id}` }] });
    expect(fel.status).toBe(400);
    expect(fel.data.issue[0].diagnostics.length).toBeGreaterThan(10);
    // Remissen för en patient på en annan vårdenhet: samma svar som när remissen saknas.
    const vc = klient(app);
    await vc.logga('adm-kard');
    sandlada(app, vc).db.query("UPDATE vantelista SET enhet_id = 'vc-tybble' WHERE id = ?").run(vantar(vc, 'p10').id);
    const annanEnhet = await vc.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }] });
    expect(annanEnhet.status).toBe(400);
    expect(annanEnhet.data.issue[0].diagnostics).toBe(saknas.data.issue[0].diagnostics);
    const lak = klient(app);
    await lak.logga('lak-kard');
    expect((await lak.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${post.remiss_id}` }] })).status).toBe(403);
    expect(sandlada(app, k).db.query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).toBe('vantar');
  });

  test('Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await k.raw('POST', '/fhir/Encounter', { resourceType: 'Encounter', status: 'in-progress', class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP' }, subject: { reference: 'Patient/p11' }, reasonCode: [{ text: 'Elkonvertering' }] }, { Prefer: 'return=OperationOutcome' });
    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toMatch(/\/fhir\/Encounter\/vt-\d+$/);
    expect(r.data.issue[0].diagnostics).toContain('Systemet valde avdelningen');
    const db = sandlada(app, k).db;
    const vk = db.query("SELECT * FROM vardkontakter WHERE patient_id = 'p11' AND typ = 'slutenvard' AND vardtillfalle_id IS NOT NULL ORDER BY id DESC LIMIT 1").get();
    expect(vk).toMatchObject({ enhet_id: 'uso-kard-72', orsak: 'Elkonvertering', skapad_av: 'ssk-kard' });
    const las = await k.get(r.headers.get('location').replace(app.url, ''));
    expect(las.data).toMatchObject({ resourceType: 'Encounter', status: 'in-progress' });
    // Redan inskriven, ett besök i stället för en inskrivning och fel roll.
    expect((await k.raw('POST', '/fhir/Encounter', { resourceType: 'Encounter', class: { code: 'IMP' }, subject: { reference: 'Patient/p11' } })).status).toBe(400);
    const besok = await k.raw('POST', '/fhir/Encounter', { resourceType: 'Encounter', class: { code: 'AMB' }, subject: { reference: 'Patient/p01' } });
    expect(besok.status).toBe(400);
    expect(besok.data.issue[0].diagnostics).toContain('class IMP');
    const adm = klient(app);
    await adm.logga('adm-kard');
    expect((await adm.raw('POST', '/fhir/Encounter', { resourceType: 'Encounter', class: { code: 'IMP' }, subject: { reference: 'Patient/p14' } })).status).toBe(403);
  });
});

describe('Ärenden om API:t', () => {
  test('en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const ny = await k.post('/api/oppet-api/arenden', { typ: 'informationsmangd', rubrik: 'Levnadsvanor för vårddatalagret', text: 'Vårddatalagret behöver levnadsvanorna som strukturerade uppgifter.', resurstyp: 'NutritionOrder', tjanstekontrakt: 'GetCareDocumentation' });
    expect(ny.status).toBe(201);
    expect(ny.data).toMatchObject({ status: 'inkommen', typ: 'informationsmangd', skapadAv: 'Sara Lindqvist', nasta: [], svar: [] });
    const id = ny.data.id;
    // Läkaren kan inte föra ärendet vidare.
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'bedomd', beslut: 'Bedömd.' })).status).toBe(403);
    await k.logga('sysf');
    const lista = (await k.get('/api/oppet-api/arenden')).data.arenden;
    expect(lista.find(a => a.id === id).nasta).toEqual(['bedomd', 'avslag', 'besvarad']);
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'levererad', version: '0.9.0' })).status).toBe(400);
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'bedomd', beslut: 'Behovet är rimligt. Mappningen görs mot GetCareDocumentation.' })).data.status).toBe('bedomd');
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'planerad' })).status).toBe(400);
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'planerad', version: '1.1.0' })).data).toMatchObject({ status: 'planerad', version: '1.1.0' });
    const ej = await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'levererad' });
    expect(ej.status).toBe(400);
    expect(ej.data.fel).toContain('finns inte i ändringsloggen');
    expect((await k.post(`/api/oppet-api/arenden/${id}/status`, { status: 'levererad', version: ANDRINGAR[0].version })).data.status).toBe('levererad');
    expect((await k.post(`/api/oppet-api/arenden/${id}/svar`, { text: 'Finns nu i API:t.' })).status).toBe(201);
    const rader = logg(k).filter(l => l.resurs?.startsWith(`api:arende:${id}`));
    expect(rader.map(l => l.resurs)).toEqual([`api:arende:${id}`, `api:arende:${id}:bedomd`, `api:arende:${id}:planerad`, `api:arende:${id}:levererad`, `api:arende:${id}:svar`]);
    expect(rader.every(l => l.patient_id === null)).toBe(true);
  });

  test('systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const r = await k.post('/api/oppet-api/arenden', { typ: 'informationsmangd', rubrik: 'Mätvärden', text: 'Vi vill läsa blodtryck från vår tillämpning.', resurstyp: 'Observation' });
    expect(r.data.svar[0]).toMatchObject({ av: null });
    expect(r.data.svar[0].text).toContain('Observation finns redan i API:t');
    const pnr = await k.post('/api/oppet-api/arenden', { typ: 'fel', rubrik: 'Fel i svaret', text: 'Patienten 19121212-1212 får fel svar i Observation.' });
    expect(pnr.status).toBe(400);
    expect(pnr.data.fel).toContain('personnummer');
    expect((await k.post('/api/oppet-api/arenden', { typ: 'constructor', rubrik: 'Rubrik', text: 'En text om något.' })).status).toBe(400);
    expect((await klient(app).post('/api/oppet-api/arenden', { typ: 'fraga', rubrik: 'Fråga', text: 'En fråga om API:t.' })).status).toBe(401);
  });
});

const pkce = () => { const v = randomBytes(32).toString('base64url'); return { v, c: createHash('sha256').update(v).digest('base64url') }; };
// Hela starten från journalen för en tillämpning: start, auktorisering med PKCE och kod mot biljett.
async function startaTillampning(k, klientId, pid = 'p01', scope = 'launch patient/Observation.read patient/Patient.read') {
  const st = await k.post(`/api/patient/${pid}/tillampningar/${klientId}/starta`, {});
  if (st.status !== 200) return { status: st.status, data: st.data };
  const adress = new URL(st.data.adress, app.url);
  const { v, c } = pkce();
  const redirect = `${app.url}/tillampningar/blodtryck/index.html`;
  const u = new URL(`${app.url}/oauth/authorize`);
  for (const [n, x] of Object.entries({ response_type: 'code', client_id: klientId, redirect_uri: redirect, scope, state: 's1', aud: `${app.url}/fhir`, code_challenge: c, code_challenge_method: 'S256', launch: adress.searchParams.get('launch') })) u.searchParams.set(n, x);
  const r = await fetch(u, { headers: { Cookie: k.kaka() }, redirect: 'manual' });
  const tillbaka = new URL(r.headers.get('location'));
  const t = await fetch(`${app.url}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: tillbaka.searchParams.get('code') ?? '', redirect_uri: redirect, client_id: klientId, code_verifier: v }) });
  return { status: t.status, data: await t.json() };
}
const medBiljett = (token, vag) => fetch(`${app.url}${vag}`, { headers: { Authorization: `Bearer ${token}` } });

describe('Tillämpningar och mottagare', () => {
  test('systemförvaltaren registrerar en tillämpning, systemet föreslår behörighet och text ur omfånget, och den startas från journalen', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const f = await k.post('/api/oppet-api/tillampningar/forslag', { omfang: 'patient/Observation.read patient/Patient.read' });
    expect(f.data).toMatchObject({ kravs: 'las_matvarden', patient: true });
    expect(f.data.far).toBe('Läsa patientens mätvärden och namn. Inget annat, och bara det du själv får se utan aktiva val.');
    const r = await k.post('/api/oppet-api/tillampningar', { namn: 'Vikt och längd', beskrivning: 'Visar patientens vikt över tid för dietisten.', adress: '/tillampningar/blodtryck/index.html', omfang: 'patient/Observation.read patient/Patient.read' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ id: 'vikt-och-langd', kravs: 'las_matvarden', omfang: ['launch', 'launch/patient', 'patient/Observation.read', 'patient/Patient.read'] });
    expect(logg(k).at(-1)).toMatchObject({ personal_id: 'sysf', handling: 'forvalta_api', resurs: 'api:tillampning:vikt-och-langd', patient_id: null });
    await k.logga('lak-kard');
    const lista = (await k.get('/api/patient/p01/tillampningar')).data.tillampningar;
    expect(lista.map(t => t.id)).toEqual(expect.arrayContaining(['blodtryck', 'vikt-och-langd']));
    const b = await startaTillampning(k, 'vikt-och-langd');
    expect(b.status).toBe(200);
    expect(b.data.patient).toBe('p01');
    expect((await medBiljett(b.data.access_token, '/fhir/Observation?patient=p01')).status).toBe(200);
    // Omfånget gäller: tillämpningen får inte läsa diagnoser.
    expect((await medBiljett(b.data.access_token, '/fhir/Condition?patient=p01')).status).toBe(403);
  });

  test('en återkallad tillämpning kan inte startas, och dess åtkomstbiljetter återkallas direkt', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/oppet-api/tillampningar', { namn: 'Puls i mobilen', beskrivning: 'Visar pulsen i mobilen vid sängen.', adress: '/tillampningar/blodtryck/index.html', omfang: 'patient/Observation.read' })).status).toBe(201);
    await k.logga('lak-kard');
    const b = await startaTillampning(k, 'puls-i-mobilen', 'p01', 'launch patient/Observation.read');
    expect(b.status).toBe(200);
    // En annan sandlåda har inte tillämpningen.
    const sysf = klient(app);
    await sysf.logga('sysf');
    expect((await sysf.post('/api/oppet-api/tillampningar/puls-i-mobilen/aterkalla', { orsak: 'Prov' })).status).toBe(404);
    // En inloggning som systemförvaltare i samma webbläsare återkallar läkarens biljetter. För att visa att återkallelsen
    // tar bort biljetterna görs den här med modulen, medan läkaren är inloggad i sandlådan.
    const b2 = b;
    expect((await medBiljett(b2.data.access_token, '/fhir/Observation?patient=p01')).status).toBe(200);
    const s = sandlada(app, k);
    const { aterkallaTillampning } = await import('../src/api-forvaltning.js');
    const forv = s.db.query("SELECT * FROM personal WHERE id = 'sysf'").get();
    expect(() => aterkallaTillampning(s.db, forv, 'puls-i-mobilen', {})).toThrow('Ange varför');
    const a = aterkallaTillampning(s.db, forv, 'puls-i-mobilen', { orsak: 'Avtalet med leverantören har upphört.' }, { aterkallaBiljetter: (id) => app.oppetApi.smart.aterkalla(s, 'Återkallad.', x => x.klient === id) });
    expect(a).toMatchObject({ aterkallad: expect.any(String), aterkallade: 1 });
    expect((await medBiljett(b2.data.access_token, '/fhir/Observation?patient=p01')).status).toBe(401);
    expect((await k.get('/api/patient/p01/tillampningar')).data.tillampningar.map(t => t.id)).not.toContain('puls-i-mobilen');
    expect((await k.post('/api/patient/p01/tillampningar/puls-i-mobilen/starta', {})).status).toBe(403);
    // Den fasta demotillämpningen kan inte återkallas.
    await k.logga('sysf');
    expect((await k.post('/api/oppet-api/tillampningar/blodtryck/aterkalla', { orsak: 'Prov' })).status).toBe(400);
  });

  test('bara systemförvaltaren registrerar, och adresser, omfång och namn prövas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const ok = { namn: 'Läkemedel', beskrivning: 'Visar läkemedlen på en surfplatta.', adress: '/tillampningar/blodtryck/index.html', omfang: 'patient/MedicationRequest.read' };
    expect((await k.post('/api/oppet-api/tillampningar', ok)).status).toBe(403);
    expect((await k.post('/api/oppet-api/mottagare', { adress: 'https://vardlager.region.test/ny', syfte: 'Vårddatalagret' })).status).toBe(403);
    await k.logga('sysf');
    for (const adress of ['http://partner.example/app', 'https://127.0.0.1/app', 'https://a:b@partner.example/app', 'https://partner.example:8443/app', '/tillampningar/../api/krav', 'javascript:alert(1)']) {
      expect([adress, (await k.post('/api/oppet-api/tillampningar', { ...ok, adress })).status]).toEqual([adress, 400]);
    }
    expect((await k.post('/api/oppet-api/tillampningar', { ...ok, omfang: 'patient/AuditEvent.read' })).status).toBe(400);
    expect((await k.post('/api/oppet-api/tillampningar', { ...ok, omfang: 'nonsens' })).status).toBe(400);
    expect((await k.post('/api/oppet-api/tillampningar', { ...ok, namn: 'Blodtryck' })).status).toBe(409);
    expect((await k.post('/api/oppet-api/tillampningar', { ...ok, adress: 'https://partner.example/lakemedel' })).status).toBe(201);
  });

  test('systemförvaltaren godkänner en mottagare, en prenumeration till den kan skapas, och när mottagaren återkallas avslutas prenumerationen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const sub = { resourceType: 'Subscription', status: 'requested', reason: 'Engagemangsindex', criteria: 'Observation?patient=p01', channel: { type: 'rest-hook', endpoint: 'https://engagemang.region.test/notis', payload: 'application/fhir+json' } };
    expect((await k.raw('POST', '/fhir/Subscription', sub)).status).toBe(403);
    await k.logga('sysf');
    for (const adress of ['http://engagemang.region.test/notis', 'https://10.0.0.1/notis', 'https://engagemang.region.test:8443/notis', 'inte en adress']) {
      expect([adress, (await k.post('/api/oppet-api/mottagare', { adress, syfte: 'Regionens engagemangsindex' })).status]).toEqual([adress, 400]);
    }
    const m = await k.post('/api/oppet-api/mottagare', { adress: 'https://engagemang.region.test/notis', syfte: 'Regionens engagemangsindex' });
    expect(m.status).toBe(201);
    expect((await k.post('/api/oppet-api/mottagare', { adress: 'https://engagemang.region.test/notis', syfte: 'Samma adress igen' })).status).toBe(409);
    await k.logga('lak-kard');
    const s = await k.raw('POST', '/fhir/Subscription', sub);
    expect(s.status).toBe(201);
    await k.logga('sysf');
    const a = await k.post(`/api/oppet-api/mottagare/${m.data.id}/aterkalla`, { orsak: 'Tjänsten är avvecklad.' });
    expect(a.data.avslutade).toBe(1);
    expect(sandlada(app, k).db.query('SELECT status FROM prenumerationer WHERE id = ?').get(Number(s.data.id)).status).toBe('avslutad');
    await k.logga('lak-kard');
    expect((await k.raw('POST', '/fhir/Subscription', sub)).status).toBe(403);
    expect(logg(k).filter(l => l.handling === 'forvalta_api').map(l => l.resurs)).toEqual(expect.arrayContaining([`api:mottagare:${m.data.id}`, `api:mottagare:${m.data.id}:aterkallad`]));
  });
});

// Säkerhetsgranskningen av runda 9, r6: en biljett för en patient kan inte boka en remiss för en annan, och mottagare
// som godkänns i sandlådan kan aldrig gå utöver driftens konfiguration.
describe('Säkerhetsgranskning av runda 9 r6', () => {
  test('en biljett för patient A kan inte boka en remiss för patient B, med eller utan participant och subject', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/oppet-api/tillampningar', { namn: 'Bokning i mobilen', beskrivning: 'Bokar tider för remisser från mobilen.', adress: '/tillampningar/blodtryck/index.html', omfang: 'patient/Appointment.write patient/Patient.read' })).status).toBe(201);
    await k.logga('adm-kard');
    const remissB = vantar(k, 'p10').remiss_id;
    const scope = 'launch patient/Appointment.write patient/Patient.read';
    const a = await startaTillampning(k, 'bokning-i-mobilen', 'p01', scope);
    expect(a.data.patient).toBe('p01');
    const boka = (token, extra) => fetch(`${app.url}/fhir/Appointment`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/fhir+json' },
      body: JSON.stringify({ resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${remissB}` }], ...extra }) });
    for (const extra of [{}, { participant: [{ actor: { reference: 'Patient/p01' } }] }, { subject: { reference: 'Patient/p01' } }, { patient: { reference: 'Patient/p01' } }]) {
      const r = await boka(a.data.access_token, extra);
      expect([JSON.stringify(extra), r.status]).toEqual([JSON.stringify(extra), 403]);
    }
    expect(sandlada(app, k).db.query("SELECT COUNT(*) n FROM bokningar WHERE patient_id = 'p10' AND remiss_id = ?").get(remissB).n).toBe(0);
    // Med sessionen avvisas okända fält på toppnivå.
    expect((await k.raw('POST', '/fhir/Appointment', { resourceType: 'Appointment', status: 'booked', basedOn: [{ reference: `ServiceRequest/${remissB}` }], subject: { reference: 'Patient/p10' } })).status).toBe(400);
    // En biljett för patient B bokar B:s remiss.
    const b = await startaTillampning(k, 'bokning-i-mobilen', 'p10', scope);
    expect((await boka(b.data.access_token, {})).status).toBe(201);
  });

  test('en mottagare utanför driftens konfiguration godkänns inte och får aldrig något skickat', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const utanfor = await k.post('/api/oppet-api/mottagare', { adress: 'https://angripare.example/samla', syfte: 'En adress utanför driftens domäner' });
    expect(utanfor.status).toBe(400);
    expect(utanfor.data.fel).toContain('driften');
    // När meddelanden skickas på riktigt gäller bara konfigurationen, också för mottagare som redan finns i sandlådan.
    const skickat = [];
    const app2 = testserver({ oppetApiVal: { skicka: async (adress) => { skickat.push(adress); return { status: 'skickad', svar: 'HTTP 200' }; }, endastKonfiguration: true } });
    try {
      const s = klient(app2);
      await s.logga('sysf');
      expect((await s.post('/api/oppet-api/mottagare', { adress: 'https://engagemang.region.test/notis', syfte: 'Regionens engagemangsindex' })).status).toBe(400);
      const db = sandlada(app2, s).db;
      // En rad som har kommit in förbi kontrollen, och en prenumeration till den.
      const forv = await import('../src/api-forvaltning.js');
      forv.sakraSchema(db);
      db.query("INSERT INTO api_mottagare (adress, syfte, godkand, godkand_av) VALUES ('https://angripare.example/samla', 'Utanför', '2026-11-08', 'sysf')").run();
      await s.logga('lak-kard');
      const sub = (endpoint) => ({ resourceType: 'Subscription', status: 'requested', reason: 'Prov', criteria: 'Observation?patient=p01', channel: { type: 'rest-hook', endpoint, payload: 'application/fhir+json' } });
      expect((await s.raw('POST', '/fhir/Subscription', sub('https://angripare.example/samla'))).status).toBe(403);
      expect((await s.raw('POST', '/fhir/Subscription', sub('https://vardlager.region.test/fhir-notis'))).status).toBe(201);
      db.query("INSERT INTO prenumerationer (personal_id, typ, patient_id, kriterier, mottagare, status, orsak, skapad) VALUES ('lak-kard', 'Observation', 'p01', 'Observation?patient=p01', 'https://angripare.example/samla', 'aktiv', 'Prov', '2026-11-08')").run();
      await s.logga('ssk-kard');
      expect((await s.raw('POST', '/fhir/Observation', { resourceType: 'Observation', status: 'final', subject: { reference: 'Patient/p01' }, code: { coding: [{ system: 'http://loinc.org', code: '8867-4' }] }, valueQuantity: { value: 72 } })).status).toBe(201);
      await new Promise(r => setTimeout(r, 80));
      expect(skickat).toContain('https://vardlager.region.test/fhir-notis');
      expect(skickat).not.toContain('https://angripare.example/samla');
      const utfall = db.query("SELECT n.status FROM prenumeration_notiser n JOIN prenumerationer p ON p.id = n.prenumeration_id WHERE p.mottagare = 'https://angripare.example/samla'").all();
      expect(utfall.length).toBeGreaterThan(0);
      expect(utfall.every(r => r.status === 'misslyckad')).toBe(true);
    } finally { app2.stopp(); }
  });

  test('den uppslagna adressen låses för själva anropet, så att en ny uppslagning inte kan leda till en intern adress', async () => {
    const prenumeration = await import('../src/prenumeration.js');
    let uppslag = 0;
    let fast = null;
    const r = await prenumeration.skickaPaRiktigt('https://vardlager.region.test/fhir-notis', { a: 1 }, {
      uppslag: async () => { uppslag++; return uppslag === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }]; },
      hamta: async (_u, _init, pin) => { fast = pin; return new Response(null, { status: 200 }); },
    });
    expect(r.status).toBe('skickad');
    expect(uppslag).toBe(1);
    expect(fast).toEqual({ ip: '93.184.216.34', family: 4 });
    // Standardsändningen ansluter till den låsta adressen och slår aldrig upp namnet igen: ett namn som inte finns når ändå
    // servern på den låsta adressen.
    const { createServer } = await import('node:net');
    let anslutningar = 0;
    const server = createServer((sock) => { anslutningar++; sock.destroy(); });
    await new Promise(res => server.listen(0, '127.0.0.1', res));
    try {
      const ut = await prenumeration.postaFast('https://finns-inte.region.test/notis', { headers: {}, body: '{}' }, { ip: '127.0.0.1', family: 4, port: server.address().port });
      expect(ut).toBeNull();
      expect(anslutningar).toBe(1);
    } finally { server.close(); }
  });
});
