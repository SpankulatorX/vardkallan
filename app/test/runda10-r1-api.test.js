// Runda 10, r1: det öppna API:t (Sussa 2.5.1.1 och 2.5.1.2). Systemkonton för tillämpningar utan inloggad person med
// SMART Backend Services, prenumerationer på en population (till exempel alla nya diagnoser på en vårdenhet för ett
// vårddatalager), registrering av patienter och överkänsligheter via FHIR och Patient/$everything för personalen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import { SYSTEM } from '../src/kodverk.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const ICD = SYSTEM.icd10se;

// Tillämpningens nyckelpar. Den privata nyckeln stannar i testet, som hos en riktig tillämpning.
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const offentlig = { ...publicKey.export({ format: 'jwk' }), kid: 'vardlager-1' };
const annan = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function intyg(id, { aud = `${app.url}/oauth/token`, nyckel = privateKey, exp = Math.floor(Date.now() / 1000) + 120, jti = randomUUID(), sub = id, alg = 'ES256' } = {}) {
  const h = b64({ alg, typ: 'JWT', kid: 'vardlager-1' });
  const p = b64({ iss: id, sub, aud, exp, jti });
  const s = sign('sha256', Buffer.from(`${h}.${p}`), { key: nyckel, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${s}`;
}
const biljett = (jwt, scope) => fetch(`${app.url}/oauth/token`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: jwt, ...(scope ? { scope } : {}) }),
}).then(async r => ({ status: r.status, data: await r.json() }));
const medBiljett = (token, vag, init = {}) => fetch(`${app.url}${vag}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/fhir+json' } : {}), ...(init.headers ?? {}) } })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

const KONTO = { namn: 'Regionens vårddatalager', syfte: 'Uppföljning av diagnoser och vårdkontakter i regionens vårddatalager.', mangder: ['diagnoser'], vardenheter: ['uso-kard'], nyckel: offentlig };
// Ett systemkonto i sandlådan, registrerat av systemförvaltaren.
async function nyttKonto(k, extra = {}) {
  await k.logga('sysf');
  const r = await k.post('/api/oppet-api/systemkonton', { ...KONTO, ...extra });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  return r.data;
}
function nyDiagnos(k, pid, enhet = 'uso-kard', kod = 'I48.0') {
  const db = sandlada(app, k).db;
  const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut) VALUES (?, ?, 'oppenvard', '2026-11-02T09:00', '2026-11-02T09:30') RETURNING id").get(pid, enhet).id);
  const d = db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, datum, vardkontakt_id, typ) VALUES (?, ?, ?, 'Förmaksflimmer', '2026-11-02', ?, 'huvud') RETURNING id").get(pid, enhet, kod, vk);
  return { vk, id: Number(d.id) };
}

describe('Systemkonton', () => {
  test('systemförvaltaren registrerar ett systemkonto, systemet räknar fram omfånget ur informationsmängderna och en privat nyckel sparas aldrig', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/oppet-api/systemkonton', KONTO)).status).toBe(403);
    await k.logga('sysf');
    const f = await k.post('/api/oppet-api/systemkonton/forslag', { mangder: ['diagnoser', 'vardkontakter'], vardenheter: ['uso-kard'] });
    expect(f.data.omfang).toEqual(['system/Condition.rs', 'system/Encounter.rs', 'system/Patient.r', 'system/Subscription.crds']);
    expect(f.data.far).toContain('Läsa diagnoser och vårdkontakter som har registrerats på Kardiologiska kliniken USÖ');
    // Den privata nyckeln avvisas med en förklaring.
    const privat = privateKey.export({ format: 'jwk' });
    const p = await k.post('/api/oppet-api/systemkonton', { ...KONTO, nyckel: privat });
    expect(p.status).toBe(400);
    expect(p.data.fel).toContain('privata delen');
    for (const fel of [{ mangder: [] }, { mangder: ['journal'] }, { vardenheter: [] }, { vardenheter: ['uso-kard-72'] }, { nyckel: { kty: 'oct', k: 'abc' } }, { syfte: 'kort' }, { syfte: 'Uppföljning för 19121212-1212 i datalagret.' }]) {
      expect([fel, (await k.post('/api/oppet-api/systemkonton', { ...KONTO, ...fel })).status]).toEqual([fel, 400]);
    }
    const r = await k.post('/api/oppet-api/systemkonton', KONTO);
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ namn: KONTO.namn, mangder: ['diagnoser'], omfang: ['system/Condition.rs', 'system/Patient.r', 'system/Subscription.crds'], nyckel: { kty: 'EC', kid: 'vardlager-1' } });
    expect(r.data.id).toMatch(/^sys-[A-Za-z0-9_-]{12}$/);
    const db = sandlada(app, k).db;
    expect(db.query('SELECT nyckel FROM api_systemkonton WHERE id = ?').get(r.data.id).nyckel).not.toContain('"d"');
    expect(db.query('SELECT yrke, aktiv, demo FROM personal WHERE id = ?').get(r.data.id)).toEqual({ yrke: 'systemkonto', aktiv: 1, demo: 0 });
    expect(logg(k).at(-1)).toMatchObject({ personal_id: 'sysf', handling: 'forvalta_api', resurs: `api:systemkonto:${r.data.id}`, patient_id: null });
    // Kontot kan aldrig logga in som en person.
    expect((await k.post('/api/login', { personalId: r.data.id })).status).toBe(400);
    const l = await k.get('/api/oppet-api/systemkonton');
    expect(l.data.konton.map(x => x.id)).toContain(r.data.id);
    expect(JSON.stringify(l.data)).not.toContain(offentlig.x);
  });

  test('SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas', async () => {
    const k = klient(app);
    const konto = await nyttKonto(k);
    const ok = await biljett(intyg(konto.id), 'system/Condition.rs system/Patient.r');
    expect(ok.status).toBe(200);
    expect(ok.data).toMatchObject({ token_type: 'Bearer', expires_in: 300, scope: 'system/Condition.rs system/Patient.r' });
    // Utan scope får kontot allt som det har fått.
    expect((await biljett(intyg(konto.id))).data.scope).toBe('system/Condition.rs system/Patient.r system/Subscription.crds');
    const nu = Math.floor(Date.now() / 1000);
    const jti = randomUUID();
    expect((await biljett(intyg(konto.id, { jti }))).status).toBe(200);
    for (const [vad, jwt, text] of [
      ['samma jti igen', intyg(konto.id, { jti }), 'redan använts'],
      ['fel nyckel', intyg(konto.id, { nyckel: annan }), 'Signaturen'],
      ['fel aud', intyg(konto.id, { aud: 'https://annan.example/token' }), 'aud'],
      ['har gått ut', intyg(konto.id, { exp: nu - 10 }), 'gått ut'],
      ['gäller för länge', intyg(konto.id, { exp: nu + 3600 }), 'högst fem minuter'],
      ['fel sub', intyg(konto.id, { sub: 'sys-annatkonto1' }), 'sub'],
      ['fel algoritm', intyg(konto.id, { alg: 'HS256' }), 'ES256'],
      ['okänt konto', intyg('sys-finnsinte123'), 'finns inte'],
      ['inte en JWT', 'abc.def', 'finns inte'],
    ]) {
      const r = await biljett(jwt);
      expect([vad, r.status, r.data.error]).toEqual([vad, 401, 'invalid_client']);
      expect(r.data.error_description).toContain(text);
    }
    expect((await biljett(intyg(konto.id), 'system/Observation.rs')).status).toBe(400);
    const rader = logg(k).filter(l => l.personal_id === konto.id);
    expect(rader.filter(l => l.grund === 'nekad').length).toBeGreaterThanOrEqual(6);
    expect(rader.some(l => l.grund === 'systemkonto' && l.handling === 'tillampning')).toBe(true);
    // Konfigurationen anger SMART Backend Services.
    const cfg = await (await fetch(`${app.url}/fhir/.well-known/smart-configuration`)).json();
    expect(cfg.grant_types_supported).toContain('client_credentials');
    expect(cfg.token_endpoint_auth_methods_supported).toContain('private_key_jwt');
    expect(cfg.capabilities).toContain('client-confidential-asymmetric');
  });

  test('systemkontot läser bara sina vårdenheters poster ur sina informationsmängder, aldrig skyddad identitet eller spärrade uppgifter, och varje läsning loggas', async () => {
    const k = klient(app);
    const konto = await nyttKonto(k, { vardenheter: ['uso-kard', 'uso-psyk'] });
    const token = (await biljett(intyg(konto.id))).data.access_token;
    const egen = nyDiagnos(k, 'p01');
    const r = await medBiljett(token, `/fhir/Condition/${egen.id}`);
    expect([r.status, r.data?.issue?.[0]?.diagnostics]).toEqual([200, undefined]);
    expect(r.data).toMatchObject({ resourceType: 'Condition', id: String(egen.id), subject: { reference: 'Patient/p01' } });
    const pat = await medBiljett(token, '/fhir/Patient/p01');
    expect([pat.status, pat.data?.issue?.[0]?.diagnostics]).toEqual([200, undefined]);
    expect((await medBiljett(token, '/fhir/Condition?patient=p01')).data.entry.map(e => e.resource.id)).toContain(String(egen.id));
    // Inte en annan vårdenhet, inte en annan informationsmängd, inte skyddad identitet och inte spärrade uppgifter.
    const annanEnhet = nyDiagnos(k, 'p01', 'uso-med');
    expect((await medBiljett(token, `/fhir/Condition/${annanEnhet.id}`)).status).toBe(403);
    expect((await medBiljett(token, '/fhir/Condition?patient=p01')).data.entry.map(e => e.resource.id)).not.toContain(String(annanEnhet.id));
    expect((await medBiljett(token, '/fhir/Observation?patient=p01')).status).toBe(403);
    const skyddad = nyDiagnos(k, 'p03');
    expect((await medBiljett(token, `/fhir/Condition/${skyddad.id}`)).status).toBe(403);
    expect((await medBiljett(token, '/fhir/Patient/p03')).status).toBe(403);
    const sparrad = nyDiagnos(k, 'p04', 'uso-psyk');
    expect(sandlada(app, k).db.query("SELECT 1 FROM sparrar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' AND aktiv = 1").get()).toBeTruthy();
    expect((await medBiljett(token, `/fhir/Condition/${sparrad.id}`)).status).toBe(403);
    // Skrivning och operationer nekas, och biljetten för ett systemkonto gäller inte omfång för personer.
    expect((await medBiljett(token, '/fhir/Condition', { method: 'POST', body: JSON.stringify({ resourceType: 'Condition', subject: { reference: 'Patient/p01' }, encounter: { reference: `Encounter/${egen.vk}` }, code: { coding: [{ system: ICD, code: 'I10.9' }] } }) })).status).toBe(403);
    expect((await medBiljett(token, '/fhir/Patient/p01/$everything')).status).toBe(403);
    const rader = logg(k).filter(l => l.personal_id === konto.id && l.patient_id === 'p01' && l.resultat === 'tillaten');
    expect(rader.map(l => l.resurs)).toEqual(expect.arrayContaining([`fhir/Condition/${egen.id}`, 'fhir/Patient/p01']));
    expect(new Set(rader.map(l => l.grund))).toEqual(new Set(['systemkonto']));
  });

  test('prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa', async () => {
    const k = klient(app);
    await k.logga('sysf');
    // Vårddatalagrets adress står redan i driftens konfiguration och är därför godkänd.
    const konto = await nyttKonto(k);
    const token = (await biljett(intyg(konto.id))).data.access_token;
    const sub = (criteria) => ({ resourceType: 'Subscription', status: 'requested', reason: 'Vårddatalagret', criteria, channel: { type: 'rest-hook', endpoint: 'https://vardlager.region.test/fhir-notis', payload: 'application/fhir+json' } });
    // Bara kontots informationsmängder.
    expect((await medBiljett(token, '/fhir/Observation', { method: 'POST', body: JSON.stringify(sub('Observation')) })).status).toBe(403);
    expect((await medBiljett(token, '/fhir/Subscription', { method: 'POST', body: JSON.stringify(sub('Observation')) })).status).toBe(403);
    const s = await medBiljett(token, '/fhir/Subscription', { method: 'POST', body: JSON.stringify(sub('Condition')) });
    expect(s.status).toBe(201);
    expect(s.data).toMatchObject({ resourceType: 'Subscription', status: 'active', criteria: 'Condition' });
    // Läkaren registrerar diagnoser i gränssnittet: en på kardiologen, en på en annan enhet och en för en skyddad patient.
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start) VALUES ('p01', 'uso-kard', 'oppenvard', '2026-11-08T09:00') RETURNING id").get().id);
    const d = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'I48.0' });
    expect(d.status).toBe(201);
    nyDiagnos(k, 'p01', 'uso-med');
    nyDiagnos(k, 'p03');
    await k.get('/api/session');
    const notiser = db.query('SELECT * FROM prenumeration_notiser WHERE prenumeration_id = ? ORDER BY id').all(Number(s.data.id));
    expect(notiser.map(n => n.fokus)).toEqual([`Condition/${d.data.id}`]);
    expect(notiser[0].handelse).toBe('ny');
    // Meddelandet loggas på patienten med systemkontot och grunden systemkonto, och innehåller bara id.
    expect(logg(k).some(l => l.personal_id === konto.id && l.patient_id === 'p01' && l.resurs === `fhir/Subscription/${s.data.id}/notis` && l.grund === 'systemkonto')).toBe(true);
    // Mottagaren hämtar posten med sin egen biljett.
    expect((await medBiljett(token, `/fhir/Condition/${d.data.id}`)).status).toBe(200);
  });

  test('ett återkallat systemkonto får ingen biljett, dess biljetter slutar gälla och dess prenumerationer avslutas', async () => {
    const k = klient(app);
    const konto = await nyttKonto(k);
    const token = (await biljett(intyg(konto.id))).data.access_token;
    const s = await medBiljett(token, '/fhir/Subscription', { method: 'POST', body: JSON.stringify({ resourceType: 'Subscription', reason: 'Vårddatalagret', criteria: 'Condition', channel: { type: 'rest-hook', endpoint: 'https://vardlager.region.test/fhir-notis', payload: 'application/fhir+json' } }) });
    expect(s.status).toBe(201);
    // En utloggning i sandlådan återkallar inte kontots biljett, eftersom den inte gäller en inloggad person.
    await k.post('/api/logout', {});
    expect((await medBiljett(token, '/fhir/Patient/p01')).status).toBe(200);
    await k.logga('lak-kard');
    expect((await k.post(`/api/oppet-api/systemkonton/${konto.id}/aterkalla`, { orsak: 'Prov' })).status).toBe(403);
    await k.logga('sysf');
    expect((await k.post(`/api/oppet-api/systemkonton/${konto.id}/aterkalla`, {})).status).toBe(400);
    const a = await k.post(`/api/oppet-api/systemkonton/${konto.id}/aterkalla`, { orsak: 'Vårddatalagret är avvecklat.' });
    expect(a.data).toMatchObject({ aterkallad: expect.any(String), aterkallade: 1, avslutade: 1 });
    expect((await medBiljett(token, '/fhir/Patient/p01')).status).toBe(401);
    expect((await biljett(intyg(konto.id))).data.error_description).toContain('återkallat');
    expect(sandlada(app, k).db.query('SELECT status FROM prenumerationer WHERE id = ?').get(Number(s.data.id)).status).toBe('avslutad');
  });
});

describe('Innovationsramverket', () => {
  test('en tillämpning registreras med källkoden, licensen och versionen, och öppen källkod kräver adressen till källkoden', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const t = { namn: 'Vätska i mobilen', beskrivning: 'Visar vätskebalansen i mobilen för hemsjukvården.', adress: '/tillampningar/blodtryck/index.html', omfang: 'patient/Observation.read' };
    // Utan källkod föreslår systemet sluten källkod hos utvecklaren och version 1.0.0.
    const utan = await k.post('/api/oppet-api/tillampningar', t);
    expect(utan.data).toMatchObject({ licens: 'Sluten källkod hos utvecklaren', version: '1.0.0', kallkod: null });
    // Med källkod föreslår systemet EUPL 1.2.
    const med = await k.post('/api/oppet-api/tillampningar', { ...t, namn: 'Vätska i plattan', kallkod: 'https://github.com/exempel/vatska', version: '2.1.0' });
    expect(med.data).toMatchObject({ licens: 'EUPL-1.2', version: '2.1.0', kallkod: 'https://github.com/exempel/vatska' });
    for (const fel of [{ licens: 'MIT' }, { kallkod: 'http://github.com/x' }, { kallkod: 'inte en adress' }, { licens: 'Fri', kallkod: 'https://github.com/x/y' }, { version: 'ett', kallkod: 'https://github.com/x/y' }]) {
      expect([fel, (await k.post('/api/oppet-api/tillampningar', { ...t, namn: 'Vätska igen', ...fel })).status]).toEqual([fel, 400]);
    }
    const o = (await k.get('/api/oppet-api/forvaltning')).data;
    expect(o.licenser).toContain('EUPL-1.2');
    expect(o.tillampningar.find(x => x.id === 'blodtryck')).toMatchObject({ kallkod: 'https://github.com/SpankulatorX/vardkallan', licens: 'EUPL-1.2' });
    expect(o.tillampningar.find(x => x.id === 'vatska-i-plattan').kallkod).toBe('https://github.com/exempel/vatska');
  });
});
