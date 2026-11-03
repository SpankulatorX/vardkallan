// Det öppna API:t för externa tillämpningar (runda 6, r5): SMART on FHIR (Sussa 5.1.1.4, 2.6.1.2 och 5.2.1.6),
// prenumerationer (2.5.1.2), masterdata (5.1.2.3) och täckningen av klickbudgetens flöden (2.5.1.3).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import * as prenumeration from '../src/prenumeration.js';
import * as masterdata from '../src/masterdata.js';
import { tackning, TACKNING } from '../src/api-tackning.js';
import { FLODEN } from '../src/klickbudget.js';
import { ENHETER } from '../src/seed/enheter.js';
import { EXT } from '../src/fhir-definitioner.js';
import { idag, addDagar } from '../src/db.js';

const mottaget = [];
let app;
beforeAll(() => {
  app = testserver({ oppetApiVal: { skicka: async (adress, kropp) => { mottaget.push({ adress, kropp }); return { status: 'skickad', svar: 'HTTP 200' }; } } });
});
afterAll(() => app.stopp());
const vanta = () => new Promise(r => setTimeout(r, 60));
const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();

const REDIRECT = () => `${app.url}/tillampningar/blodtryck/index.html`;
const pkce = () => { const v = randomBytes(32).toString('base64url'); return { v, c: createHash('sha256').update(v).digest('base64url') }; };
async function konfiguration() { return (await fetch(`${app.url}/fhir/.well-known/smart-configuration`)).json(); }
async function auktorisera(k, { launch = null, scope = 'launch patient/Observation.read patient/Patient.read', utmaning, metod = 'S256', redirect = REDIRECT(), klientId = 'blodtryck' } = {}) {
  const konf = await konfiguration();
  const u = new URL(konf.authorization_endpoint);
  const p = { response_type: 'code', client_id: klientId, redirect_uri: redirect, scope, state: 'abc123', aud: `${app.url}/fhir`, code_challenge: utmaning, code_challenge_method: metod, ...(launch ? { launch } : {}) };
  for (const [n, v] of Object.entries(p)) if (v != null) u.searchParams.set(n, v);
  return fetch(u, { headers: k ? { Cookie: k.kaka() } : {}, redirect: 'manual' });
}
const tokenAnrop = async (kropp) => fetch(`${app.url}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(kropp) });
// Hela starten från journalen: start, auktorisering med PKCE och kod mot biljett.
async function startaFranJournalen(k, pid = 'p01') {
  const st = await k.post(`/api/patient/${pid}/tillampningar/blodtryck/starta`, {});
  expect(st.status).toBe(200);
  const adress = new URL(st.data.adress, app.url);
  const { v, c } = pkce();
  const r = await auktorisera(k, { launch: adress.searchParams.get('launch'), utmaning: c });
  expect(r.status).toBe(302);
  const tillbaka = new URL(r.headers.get('location'));
  expect(tillbaka.searchParams.get('state')).toBe('abc123');
  const t = await tokenAnrop({ grant_type: 'authorization_code', code: tillbaka.searchParams.get('code'), redirect_uri: REDIRECT(), client_id: 'blodtryck', code_verifier: v });
  return { svar: await t.json(), status: t.status, adress, kod: tillbaka.searchParams.get('code'), v };
}
const medBiljett = (token, vag, init = {}) => fetch(`${app.url}${vag}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });

describe('SMART on FHIR', () => {
  test('EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const konf = await konfiguration();
    expect(konf).toMatchObject({ code_challenge_methods_supported: ['S256'], token_endpoint: `${app.url}/oauth/token` });
    expect(konf.capabilities).toEqual(expect.arrayContaining(['launch-ehr', 'launch-standalone', 'client-public', 'context-ehr-patient']));
    const { svar, status, adress } = await startaFranJournalen(k);
    expect(adress.pathname).toBe('/tillampningar/blodtryck/index.html');
    expect(adress.searchParams.get('iss')).toBe(`${app.url}/fhir`);
    expect(status).toBe(200);
    expect(svar).toMatchObject({ token_type: 'Bearer', patient: 'p01', need_patient_banner: false, scope: 'launch patient/Observation.read patient/Patient.read' });
    expect(svar.expires_in).toBeGreaterThan(1700);
    expect(svar.expires_in).toBeLessThanOrEqual(1800);
    const obs = await (await medBiljett(svar.access_token, '/fhir/Observation?patient=p01')).json();
    expect(obs.resourceType).toBe('Bundle');
    expect(obs.entry.some(e => e.resource.code.coding?.[0]?.code === '85354-9')).toBe(true);
    expect(obs.link[0].url).toBe(`${app.url}/fhir/Observation?patient=p01`);
    const pat = await (await medBiljett(svar.access_token, '/fhir/Patient/p01')).json();
    expect(pat.name[0].family).toBe('Åkesson');
    const l = loggRader(k);
    expect(l.find(x => x.resurs === 'tillampning:blodtryck')).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'tillampning', resultat: 'tillaten' });
    expect(l.find(x => x.resurs === 'tillampning:blodtryck').syfte).toContain('giltig i 30 minuter');
    expect(l.some(x => x.resurs === 'fhir/Observation?patient=p01&_klient=blodtryck' && x.personal_id === 'lak-kard')).toBe(true);
  });

  test('omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const { svar } = await startaFranJournalen(k);
    const t = svar.access_token;
    // Läkaren får läsa patient 4, men tillämpningen startades för patient 1.
    expect((await k.get('/fhir/Observation?patient=p04')).status).toBe(200);
    const annan = await medBiljett(t, '/fhir/Observation?patient=p04');
    expect(annan.status).toBe(403);
    expect((await annan.json()).issue[0].diagnostics).toBe('Tillämpningen har bara tillgång till den patient som den startades för.');
    const p04 = sandlada(app, k).db.query("SELECT id FROM matvarden WHERE patient_id = 'p04' LIMIT 1").get().id;
    expect((await medBiljett(t, `/fhir/Observation/${p04}`)).status).toBe(403);
    expect((await medBiljett(t, '/fhir/MedicationRequest?patient=p01')).status).toBe(403);
    expect((await medBiljett(t, '/fhir/Practitioner')).status).toBe(403);
    const skriv = await medBiljett(t, '/fhir/Observation', { method: 'POST', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify({ resourceType: 'Observation', subject: { reference: 'Patient/p01' }, code: { text: 'Puls' }, valueQuantity: { value: 70 } }) });
    expect(skriv.status).toBe(403);
    expect((await skriv.json()).issue[0].diagnostics).toBe('Tillämpningen har inte fått tillgång till Observation för att skriva.');
    // Bara /fhir/<typ> och /fhir/<typ>/<id>: operationer och compartment-sökningar nekas, så att omfånget alltid gäller
    // den typ som lämnas ut. En sökning som pekar ut patienten på annat sätt än med patient eller subject nekas också.
    for (const vag of ['/fhir/Patient/p01/Observation', '/fhir/Patient/p01/MedicationRequest', '/fhir/Patient/p01/$everything', '/fhir/Observation/$lastn?patient=p01']) {
      const r = await medBiljett(t, vag);
      expect(r.status).toBe(403);
      expect(JSON.stringify(await r.json())).not.toMatch(/Omeprazol|Waran|valueQuantity/);
    }
    const pnr04 = sandlada(app, k).db.query("SELECT personnummer FROM patienter WHERE id = 'p04'").get().personnummer;
    expect((await medBiljett(t, `/fhir/Patient?identifier=${encodeURIComponent(pnr04)}`)).status).toBe(403);
    expect((await medBiljett(t, '/fhir/Appointment?actor=Patient/p04')).status).toBe(403);
    // Konformitetsresurserna läses utan omfång.
    expect((await medBiljett(t, '/fhir/metadata')).status).toBe(200);
  });

  test('biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Behövs för vården' })).status).toBe(200);
    const medVal = (await k.get('/fhir/Observation?patient=p01')).data.entry.length;
    const { svar } = await startaFranJournalen(k);
    const b = await (await medBiljett(svar.access_token, '/fhir/Observation?patient=p01')).json();
    // Akutens mätvärden kräver ett aktivt val. Läkaren har gjort valet i gränssnittet, men tillämpningen får dem inte.
    const db = sandlada(app, k).db;
    const akuten = db.query("SELECT id FROM matvarden WHERE patient_id = 'p01' AND enhet_id = 'uso-akut'").all().map(r => String(r.id));
    expect(akuten.length).toBeGreaterThan(0);
    expect(b.entry.length).toBeLessThan(medVal);
    expect(b.entry.some(e => akuten.includes(e.resource.id))).toBe(false);
    expect((await medBiljett(svar.access_token, `/fhir/Observation/${akuten[0]}`)).status).toBe(403);
    // Spärren: patient 4 har spärrat psykiatrin. Med samtycke i gränssnittet syns psykiatrins mätvärde, i tillämpningen aldrig.
    const psyk = db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES ('p04', 'uso-psyk', 'puls', '77', 77, 'slag/min', ?, 'lak-psyk')").run(new Date().toISOString()).lastInsertRowid;
    expect((await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' })).status).toBe(200);
    expect((await k.get('/fhir/Observation?patient=p04')).data.entry.some(e => e.resource.id === String(psyk))).toBe(true);
    const p04 = (await startaFranJournalen(k, 'p04')).svar.access_token;
    const sparrad = await (await medBiljett(p04, '/fhir/Observation?patient=p04')).json();
    expect(sparrad.entry.some(e => e.resource.id === String(psyk))).toBe(false);
    expect(JSON.stringify(sparrad)).not.toContain('uso-psyk');
    expect((await medBiljett(p04, `/fhir/Observation/${psyk}`)).status).toBe(403);
    // Ingen tillämpning startas utan behörighet: patient 12 saknar vårdrelation, och nödåtkomst följer aldrig med.
    expect((await k.get('/api/patient/p12/tillampningar')).status).toBe(403);
    expect((await k.post('/api/patient/p12/tillampningar/blodtryck/starta', {})).status).toBe(403);
    const adm = klient(app);
    await adm.logga('adm-kard');
    expect((await adm.post('/api/patient/p01/tillampningar/blodtryck/starta', {})).status).toBe(403);
    expect((await adm.get('/api/patient/p01/tillampningar')).data.tillampningar).toEqual([]);
  });

  test('PKCE krävs, koden går att använda en gång och fel adress eller okänd tillämpning avvisas utan omdirigering', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const st = await k.post('/api/patient/p01/tillampningar/blodtryck/starta', {});
    const launch = new URL(st.data.adress, app.url).searchParams.get('launch');
    const utan = await auktorisera(k, { launch, utmaning: null });
    expect(new URL(utan.headers.get('location')).searchParams.get('error')).toBe('invalid_request');
    const plain = await auktorisera(k, { launch, utmaning: pkce().c, metod: 'plain' });
    expect(new URL(plain.headers.get('location')).searchParams.get('error')).toBe('invalid_request');
    const fel = await auktorisera(k, { launch, utmaning: pkce().c, redirect: 'https://angripare.example/fanga' });
    expect(fel.status).toBe(400);
    expect(fel.headers.get('location')).toBeNull();
    expect(await fel.text()).toContain('Adressen som tillämpningen vill komma tillbaka till är inte registrerad.');
    expect((await auktorisera(k, { launch, utmaning: pkce().c, klientId: 'okand' })).status).toBe(400);
    // Utan inloggning startas inget.
    expect((await auktorisera(null, { utmaning: pkce().c })).status).toBe(401);
    // Fel verifierare, och samma kod två gånger.
    const { kod, v } = await startaFranJournalen(k);
    const igen = await tokenAnrop({ grant_type: 'authorization_code', code: kod, redirect_uri: REDIRECT(), client_id: 'blodtryck', code_verifier: v });
    expect(igen.status).toBe(400);
    const st2 = await k.post('/api/patient/p01/tillampningar/blodtryck/starta', {});
    const { c } = pkce();
    const r = await auktorisera(k, { launch: new URL(st2.data.adress, app.url).searchParams.get('launch'), utmaning: c });
    const kod2 = new URL(r.headers.get('location')).searchParams.get('code');
    const felV = await tokenAnrop({ grant_type: 'authorization_code', code: kod2, redirect_uri: REDIRECT(), client_id: 'blodtryck', code_verifier: pkce().v });
    expect(felV.status).toBe(400);
    expect((await felV.json()).error_description).toBe('PKCE-kontrollen misslyckades.');
    // En start från en annan sandlåda gäller inte.
    const annan = klient(app);
    await annan.logga('lak-kard');
    const lan = await auktorisera(annan, { launch: new URL(st.data.adress, app.url).searchParams.get('launch'), utmaning: pkce().c });
    expect(new URL(lan.headers.get('location')).searchParams.get('error')).toBe('invalid_request');
  });

  test('biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const a = (await startaFranJournalen(k)).svar.access_token;
    const b = (await startaFranJournalen(k)).svar.access_token;
    const c = (await startaFranJournalen(k)).svar.access_token;
    // Stäng i journalen återkallar tillämpningens biljetter för patienten.
    expect((await k.post('/api/patient/p01/tillampningar/blodtryck/stang', {})).data.aterkallade).toBe(3);
    expect((await medBiljett(a, '/fhir/Patient/p01')).status).toBe(401);
    const d = (await startaFranJournalen(k)).svar.access_token;
    const e = (await startaFranJournalen(k)).svar.access_token;
    // Utgången: tiden flyttas bakåt.
    app.oppetApi.smart.biljetter.get(d).utgar = Date.now() - 1000;
    const ut = await medBiljett(d, '/fhir/Patient/p01');
    expect(ut.status).toBe(401);
    expect(ut.headers.get('www-authenticate')).toContain('invalid_token');
    const db = sandlada(app, k).db;
    await k.post('/api/logout', {});
    expect((await medBiljett(e, '/fhir/Patient/p01')).status).toBe(401);
    const slut = db.query("SELECT syfte FROM atkomstlogg WHERE resurs = 'tillampning:blodtryck:slut' ORDER BY id").all().map(r => r.syfte);
    expect(slut).toEqual(expect.arrayContaining(['Åtkomstbiljetten återkallades när tillämpningen stängdes.', 'Åtkomstbiljetten gick ut.', 'Åtkomstbiljetten återkallades vid utloggning.']));
    expect([a, b, c, d, e].every(t => !app.oppetApi.smart.biljetter.has(t))).toBe(true);
  });

  test('standalone launch: personen väljer patienten bland sina patienter på arbetslistan', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const { v, c } = pkce();
    const r = await auktorisera(k, { scope: 'launch/patient patient/Observation.read', utmaning: c });
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('Välj patienten som tillämpningen ska öppnas för.');
    expect(html).toContain('Gunnar Åkesson');
    expect(html).not.toContain('<script');
    const biljett = html.match(/name="biljett" value="([^"]+)"/)[1];
    const val = (patient) => fetch(`${app.url}/oauth/authorize/val`, { method: 'POST', redirect: 'manual', headers: { Cookie: k.kaka(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ biljett, patient }) });
    const svar = await val('p01');
    expect(svar.status).toBe(302);
    const kod = new URL(svar.headers.get('location')).searchParams.get('code');
    const t = await (await tokenAnrop({ grant_type: 'authorization_code', code: kod, redirect_uri: REDIRECT(), client_id: 'blodtryck', code_verifier: v })).json();
    expect(t).toMatchObject({ patient: 'p01', need_patient_banner: true, scope: 'launch/patient patient/Observation.read' });
    expect((await medBiljett(t.access_token, '/fhir/Observation?patient=p01')).status).toBe(200);
    // Valet gäller en gång, och en patient utanför arbetslistan går inte att välja.
    expect((await val('p01')).status).toBe(400);
    const r2 = await auktorisera(k, { scope: 'launch/patient patient/Observation.read', utmaning: pkce().c });
    const b2 = (await r2.text()).match(/name="biljett" value="([^"]+)"/)[1];
    const p12 = await fetch(`${app.url}/oauth/authorize/val`, { method: 'POST', redirect: 'manual', headers: { Cookie: k.kaka(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ biljett: b2, patient: 'p12' }) });
    expect(p12.status).toBe(400);
  });
});

// En prenumeration på mätvärden för patient 1 till en godkänd adress.
const sub = (kriterier = 'Observation?patient=p01', endpoint = prenumeration.GODKANDA_MOTTAGARE[0]) => ({ resourceType: 'Subscription', status: 'requested', reason: 'Regionalt vårddatalager', criteria: kriterier, channel: { type: 'rest-hook', endpoint, payload: 'application/fhir+json' } });

describe('Prenumerationer', () => {
  test('Subscription skapas med samma behörighet som läsningen och bara till adresser som administratören har godkänt', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.raw('POST', '/fhir/Subscription', sub());
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ resourceType: 'Subscription', status: 'active', criteria: 'Observation?patient=p01', channel: { type: 'rest-hook' } });
    expect(r.data.channel._payload.extension[0].valueCode).toBe('id-only');
    const ej = await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01', 'https://angripare.example/samla'));
    expect(ej.status).toBe(403);
    expect(ej.data.issue[0].diagnostics).toContain('Mottagaradressen är inte godkänd');
    expect((await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01', 'http://vardlager.region.test/fhir-notis'))).status).toBe(400);
    expect((await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01', 'https://127.0.0.1/fhir-notis'))).status).toBe(400);
    expect((await k.raw('POST', '/fhir/Subscription', sub('Observation'))).status).toBe(400);
    expect((await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01&_text=hemligt'))).status).toBe(400);
    // Läkaren har ingen vårdrelation till patient 12, så inte heller någon prenumeration. Nekandet loggas.
    const p12 = await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p12'));
    expect(p12.status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p12', resultat: 'nekad' });
    const usk = klient(app);
    await usk.logga('usk-kard');
    // Undersköterskan läser inte diagnoser.
    expect((await usk.raw('POST', '/fhir/Subscription', sub('Condition?patient=p01'))).status).toBe(403);
    // Bara den egna prenumerationen syns, och den avslutas med DELETE.
    expect((await usk.get(`/fhir/Subscription/${r.data.id}`)).status).toBe(404);
    expect((await k.get('/fhir/Subscription')).data.total).toBe(1);
    const av = await k.raw('DELETE', `/fhir/Subscription/${r.data.id}`);
    expect(av.data.status).toBe('off');
  });

  test('meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01&code=http://loinc.org|85354-9'));
    mottaget.length = 0;
    const db = sandlada(app, k).db;
    const mv = await k.post('/api/patient/p01/matvarden', { typ: 'blodtryck', varde: '144/91' });
    await k.post('/api/patient/p01/matvarden', { typ: 'puls', varde: '88' });
    await vanta();
    expect(mottaget.length).toBe(1);
    const { adress, kropp } = mottaget[0];
    expect(adress).toBe(prenumeration.GODKANDA_MOTTAGARE[0]);
    expect(kropp.type).toBe('history');
    const params = kropp.entry[0].resource.parameter;
    expect(params.find(p => p.name === 'subscription').valueReference.reference).toBe(`${app.url}/fhir/Subscription/${s.data.id}`);
    expect(params.find(p => p.name === 'notification-event').part.find(p => p.name === 'focus').valueReference.reference).toBe(`${app.url}/fhir/Observation/${mv.data.id}`);
    expect(kropp.entry[1]).toEqual({ fullUrl: `${app.url}/fhir/Observation/${mv.data.id}`, request: { method: 'POST', url: `Observation/${mv.data.id}` }, response: { status: '201' } });
    // Inga patientuppgifter någonstans i meddelandet.
    const text = JSON.stringify(kropp);
    const p = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
    for (const x of ['p01', p.personnummer, p.fornamn, p.efternamn, p.adress, '144/91', 'valueQuantity', 'component', 'subject', 'patient', 'uso-kard', 'Kardiolog', 'ssk-kard', 'lak-kard', 'Blodtryck', '85354-9']) expect(text).not.toContain(x);
    // Varje meddelande loggas på patienten, och utfallet sparas.
    expect(loggRader(k).some(r => r.resurs === `fhir/Subscription/${s.data.id}/notis` && r.patient_id === 'p01' && r.syfte.includes('bara med id'))).toBe(true);
    expect(prenumeration.notiser(db, s.data.id)[0]).toMatchObject({ status: 'skickad', fokus: `Observation/${mv.data.id}` });
    // Mottagaren hämtar med sin egen behörighet.
    expect((await k.get(`/fhir/Observation/${mv.data.id}`)).status).toBe(200);
    await k.raw('DELETE', `/fhir/Subscription/${s.data.id}`);
  });

  test('inget meddelande om det som prenumeranten inte får läsa: spärrad vårdenhet, annan vårdenhet och osignerade utkast', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const lm = await k.raw('POST', '/fhir/Subscription', sub('MedicationRequest?patient=p04'));
    const ant = await k.raw('POST', '/fhir/Subscription', sub('Composition?patient=p01'));
    const obs = await k.raw('POST', '/fhir/Subscription', sub('Observation?patient=p01'));
    expect([lm.status, ant.status, obs.status]).toEqual([201, 201, 201]);
    const db = sandlada(app, k).db;
    mottaget.length = 0;
    // Psykiatrin ordinerar för patient 4, som har spärrat psykiatrin. Läkemedel är gemensamma, men spärren gäller.
    await k.post('/api/logout', {});
    await k.logga('lak-psyk');
    const o = await k.post('/api/patient/p04/lakemedel', { lakemedelId: 'VK-NPL-0026', dosering: '1 g vid behov', ordinationsorsak: 'Huvudvärk', uppfoljningsdatum: addDagar(idag(), 14), vidBehov: true, typ: 'vid_behov' });
    expect(o.status).toBe(201);
    // Akuten registrerar ett mätvärde för patient 1, och kardiologen har inget aktivt val.
    await k.post('/api/logout', {});
    await k.logga('lak-akut');
    expect((await k.post('/api/patient/p01/matvarden', { typ: 'puls', varde: '91' })).status).toBe(201);
    await vanta();
    expect(mottaget.length).toBe(0);
    // Ett utkast ger inget meddelande, en signerad anteckning ger ett.
    await k.post('/api/logout', {});
    await k.logga('lak-kard');
    const u = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Utkast.' }] });
    await vanta();
    expect(mottaget.length).toBe(0);
    await k.post(`/api/anteckning/${u.data.id}/signera`, {});
    await vanta();
    expect(mottaget.map(m => m.kropp.entry[1].fullUrl)).toEqual([`${app.url}/fhir/Composition/${u.data.id}`]);
    // Kontroll: kardiologens egen ordination för patient 4 ger ett meddelande.
    mottaget.length = 0;
    const egen = await k.post('/api/patient/p04/lakemedel', { lakemedelId: 'VK-NPL-0026', dosering: '1 g vid behov', ordinationsorsak: 'Smärta', uppfoljningsdatum: addDagar(idag(), 14), vidBehov: true, typ: 'vid_behov' });
    await vanta();
    expect(mottaget.map(m => m.kropp.entry[1].fullUrl)).toEqual([`${app.url}/fhir/MedicationRequest/${egen.data.ordination.id}`]);
    expect(db.query("SELECT count(*) AS n FROM prenumeration_notiser").get().n).toBeGreaterThan(0);
  });

  test('skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(prenumeration.arInternIp(ip)).toBe(true);
    }
    for (const ip of ['93.184.216.34', '2a00:1450:4001:80b::200e']) expect(prenumeration.arInternIp(ip)).toBe(false);
    const g = ['https://vardlager.region.test/fhir-notis'];
    for (const fel of ['http://vardlager.region.test/fhir-notis', 'https://vardlager.region.test:8443/fhir-notis', 'https://a:b@vardlager.region.test/fhir-notis', 'https://vardlager.region.test/fhir-notis?x=1', 'https://vardlager.region.test/annan', 'https://[::1]/fhir-notis', 'https://169.254.169.254/latest']) {
      expect(() => prenumeration.provaMottagare(fel, g)).toThrow();
    }
    expect(prenumeration.provaMottagare('https://vardlager.region.test/fhir-notis', g).hostname).toBe('vardlager.region.test');
    // Namnet slås upp före sändningen, och en intern adress stoppar den innan något skickas.
    let hamtade = 0;
    const hamta = async () => { hamtade++; return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } }); };
    const intern = await prenumeration.skickaPaRiktigt(g[0], {}, { uppslag: async () => [{ address: '10.0.0.5', family: 4 }, { address: '93.184.216.34', family: 4 }], hamta });
    expect(intern.status).toBe('misslyckad');
    expect(hamtade).toBe(0);
    const omd = await prenumeration.skickaPaRiktigt(g[0], {}, { uppslag: async () => [{ address: '93.184.216.34', family: 4 }], hamta });
    expect(omd).toEqual({ status: 'misslyckad', svar: 'Mottagaren svarade med en omdirigering, som inte följs.' });
    expect(hamtade).toBe(1);
    let init;
    const ok = await prenumeration.skickaPaRiktigt(g[0], { a: 1 }, { uppslag: async () => [{ address: '93.184.216.34', family: 4 }], hamta: async (u, i) => { init = i; return new Response(null, { status: 200 }); } });
    expect(ok.status).toBe('skickad');
    expect(init.redirect).toBe('manual');
    // I demon simuleras sändningen.
    expect((await prenumeration.simulera()).status).toBe('simulerad');
  });
});

describe('Masterdata', () => {
  test('organisation och personal i sandlådan kommer från filadaptern', () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    expect(db.query('SELECT id, hsa_id AS hsaId, namn FROM enheter ORDER BY rowid').all()).toEqual(f.organisation().map(e => ({ id: e.id, hsaId: e.hsaId, namn: e.namn })));
    expect(db.query('SELECT id FROM personal ORDER BY id').all().map(p => p.id)).toEqual(f.personal().map(p => p.id).sort());
    expect(db.query("SELECT hsa_id FROM personal WHERE id = 'lak-kard'").get().hsa_id).toBe(f.personal().find(p => p.id === 'lak-kard').hsaId);
    expect(f.organisation().length).toBe(ENHETER.length);
    for (const del of Object.keys(masterdata.KONTRAKT)) expect(masterdata.validera(del, masterdata.kalla(del)[del]()).fel).toEqual([]);
  });

  test('källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats', () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    const hsa = {
      id: 'hsa-simulerad', namn: 'HSA-katalogen (simulerad)', beskrivning: 'Testkälla',
      organisation: () => [...f.organisation().map(e => (e.id === 'uso-kard' ? { ...e, namn: 'Hjärtkliniken USÖ' } : e)), { id: 'uso-ny', hsaId: 'SE2321000164-VK0199', namn: 'Ny enhet USÖ', typ: 'vardenhet', forald: 'uso' }],
      personal: () => f.personal().filter(p => p.id !== 'lak-vc'),
    };
    const forra = masterdata.bytKalla('organisation', hsa);
    try {
      expect(masterdata.kalla('organisation').namn).toBe('HSA-katalogen (simulerad)');
      const r = masterdata.synkronisera(db, 'organisation');
      expect(r).toMatchObject({ kalla: 'HSA-katalogen (simulerad)', nya: ['uso-ny'], andrade: ['uso-kard'], fel: [] });
      expect(db.query("SELECT namn FROM enheter WHERE id = 'uso-kard'").get().namn).toBe('Hjärtkliniken USÖ');
    } finally { masterdata.bytKalla('organisation', forra); }
    const p = masterdata.synkronisera(db, 'personal', hsa);
    expect(p.inaktiverade).toEqual(['lak-vc']);
    // Ingen rad raderas: personen finns kvar, inaktiv, eftersom journalen och loggen pekar på den.
    expect(db.query("SELECT aktiv FROM personal WHERE id = 'lak-vc'").get().aktiv).toBe(0);
    expect(masterdata.oversikt(db).find(d => d.del === 'personal').senaste).toMatchObject({ inaktiverade: 1, fel: 0 });
    expect(() => masterdata.bytKalla('personal', { id: 'x', namn: 'Utan funktion' })).toThrow();
  });

  test('en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt', () => {
    const db = nyDb();
    const fore = db.query('SELECT * FROM enheter ORDER BY id').all();
    const trasig = { id: 't', namn: 'Trasig källa', organisation: () => [{ id: 'x', namn: 'Utan HSA-id', typ: 'vardenhet' }, { id: 'y', hsaId: 'H', namn: 'Okänd', typ: 'planet' }] };
    const r = masterdata.synkronisera(db, 'organisation', trasig);
    expect(r.fel).toEqual(['Organisation, post 1: saknar hsaId.', 'Organisation, post 2: okänd enhetstyp planet.']);
    expect(db.query('SELECT * FROM enheter ORDER BY id').all()).toEqual(fore);
    const f = masterdata.filadapter();
    const folk = { id: 'pu', namn: 'Folkbokföringen (simulerad)', befolkning: () => f.befolkning().map(p => (p.identitet === '194502024732' ? { ...p, skyddad: true } : p)) };
    const b = masterdata.synkronisera(db, 'befolkning', folk);
    expect(b.andrade).toEqual(['p01']);
    expect(db.query("SELECT skyddad FROM patienter WHERE id = 'p01'").get().skyddad).toBe(1);
  });

  test('API: masterdata visar källan, antalet och den senaste synkroniseringen per del', async () => {
    const k = klient(app);
    expect((await k.get('/api/masterdata')).status).toBe(401);
    await k.logga('lak-kard');
    const r = await k.get('/api/masterdata');
    expect(r.data.delar.map(d => [d.del, d.kalla.id])).toEqual([['organisation', 'fil'], ['personal', 'fil'], ['befolkning', 'fil']]);
    expect(r.data.delar.every(d => d.antal > 0)).toBe(true);
  });
});

// Flödena som står som ja i täckningen görs här via det öppna API:t, ett efter ett.
async function fhirKlient(roll) { const k = klient(app); await k.logga(roll); return k; }
const GOR_VIA_API = {
  'oppna-patient': async () => {
    const k = await fhirKlient('lak-kard');
    for (const v of ['/fhir/Patient/p01', '/fhir/Observation?patient=p01', '/fhir/MedicationRequest?patient=p01', '/fhir/Condition?patient=p01', '/fhir/Composition?patient=p01']) expect((await k.get(v)).status).toBe(200);
  },
  'las-anteckning': async () => {
    const k = await fhirKlient('lak-kard');
    const b = (await k.get('/fhir/Composition?patient=p01')).data;
    expect((await k.get(`/fhir/Composition/${b.entry[0].resource.id}`)).data.section.length).toBeGreaterThan(0);
  },
  daganteckning: async () => {
    const k = await fhirKlient('lak-kard');
    const r = await k.raw('POST', '/fhir/Composition', { resourceType: 'Composition', status: 'final', type: { text: 'Daganteckning' }, subject: { reference: 'Patient/p01' }, section: [{ title: 'Aktuellt', text: { status: 'generated', div: '<div xmlns="http://www.w3.org/1999/xhtml">Mår bättre.</div>' } }, { title: 'Bedömning', text: { status: 'generated', div: '<div xmlns="http://www.w3.org/1999/xhtml">Stabil.</div>' } }] });
    expect(r.data.status).toBe('final');
  },
  ordinera: async () => {
    const k = await fhirKlient('lak-kard');
    const r = await k.raw('POST', '/fhir/MedicationRequest', { resourceType: 'MedicationRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p01' }, medicationCodeableConcept: { coding: [{ system: 'http://electronichealth.se/fhir/NamingSystem/nplid', code: '20070404000061' }] }, reasonCode: [{ text: 'Hyperlipidemi' }] });
    expect(r.status).toBe(201);
  },
  utsattning: async () => {
    const k = await fhirKlient('lak-kard');
    const id = sandlada(app, k).db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn = 'Alvedon' AND o.status = 'aktiv'").get().id;
    expect((await k.raw('PUT', `/fhir/MedicationRequest/${id}`, { resourceType: 'MedicationRequest', id: String(id), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' }, statusReason: { text: 'Smärtfri' } })).data.status).toBe('stopped');
  },
  blodtryck: async () => {
    const k = await fhirKlient('ssk-kard');
    const r = await k.raw('POST', '/fhir/Observation', { resourceType: 'Observation', status: 'final', subject: { reference: 'Patient/p01' }, code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] }, component: [{ code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 128 } }, { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: 82 } }] });
    expect(r.status).toBe(201);
  },
  remiss: async () => {
    const k = await fhirKlient('lak-vc');
    const r = await k.raw('POST', '/fhir/ServiceRequest', { resourceType: 'ServiceRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p01' }, performer: [{ reference: 'Organization/uso-kard' }], reasonCode: [{ text: 'Bedömning inför elkonvertering.' }], note: [{ text: 'Förmaksflimmer sedan 2014. Waran, INR 2,4.' }] });
    expect(r.status).toBe(201);
  },
  'utsattning-varning': async () => {
    const k = await fhirKlient('lak-kard');
    const id = sandlada(app, k).db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn = 'Metoprolol Sandoz' AND o.status = 'aktiv'").get().id;
    const stopp = { resourceType: 'MedicationRequest', id: String(id), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' }, statusReason: { text: 'Bradykardi' } };
    const forst = await k.raw('PUT', `/fhir/MedicationRequest/${id}`, stopp);
    expect(forst.status).toBe(400);
    const regel = forst.data.issue.find(i => i.details?.coding?.[0]?.system?.endsWith('/varningsregel'))?.details.coding[0].code;
    const r = await k.raw('PUT', `/fhir/MedicationRequest/${id}`, { ...stopp, extension: [{ url: `${EXT}/kvitterad-varning`, extension: [{ url: 'regel', valueCode: regel }, { url: 'motivering', valueString: 'Bradykardi' }] }] });
    expect(r.data.status).toBe('stopped');
  },
  'utsattning-plan': async () => {
    const k = await fhirKlient('lak-kard');
    const id = sandlada(app, k).db.query("SELECT o.id FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn = 'Waran' AND o.status = 'aktiv'").get().id;
    const r = await k.raw('PUT', `/fhir/MedicationRequest/${id}`, { resourceType: 'MedicationRequest', id: String(id), status: 'stopped', intent: 'order', subject: { reference: 'Patient/p01' }, extension: [{ url: `${EXT}/utsattningsplan`, valueCode: 'avslutad' }] });
    expect(r.data.status).toBe('stopped');
  },
  'extern-tillampning': async () => {
    const k = await fhirKlient('lak-kard');
    const { svar } = await startaFranJournalen(k);
    expect((await medBiljett(svar.access_token, '/fhir/Observation?patient=p01')).status).toBe(200);
  },
};

describe('API-täckning', () => {
  test('varje flöde i klickbudgeten är bedömt för API:t, och bedömningen gäller flöden som finns', () => {
    const t = tackning();
    expect(t.map(f => f.id)).toEqual(FLODEN.map(f => f.id));
    for (const id of Object.keys(TACKNING)) expect(FLODEN.some(f => f.id === id)).toBe(true);
    for (const f of t) {
      expect(['ja', 'delvis', 'nej', 'inte_bedomt']).toContain(f.status);
      expect(f.text.length).toBeGreaterThan(10);
    }
  });

  test('varje flöde som står som ja görs via det öppna API:t', async () => {
    const ja = tackning().filter(f => f.status === 'ja').map(f => f.id);
    expect(ja.sort()).toEqual(Object.keys(GOR_VIA_API).sort());
    for (const id of ja) await GOR_VIA_API[id]();
  });

  test('API: täckningen kan läsas utan inloggning', async () => {
    const r = await klient(app).get('/api/oppet-api/tackning');
    expect(r.data.floden.length).toBe(FLODEN.length);
  });
});
