// Runda 10, r1: makulering via det öppna API:t (DELETE och $makulera) och identiteten för systemkonton som ett eget
// omfang, med pseudonym som förval (Sussa 2.5.1.2).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const fhirAnrop = (k, metod, vag, kropp, extra = {}) => k.raw(metod, vag, kropp, { ...(kropp ? { 'Content-Type': 'application/fhir+json' } : {}), ...extra });

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function intyg(id) {
  const h = b64({ alg: 'ES256', typ: 'JWT' });
  const p = b64({ iss: id, sub: id, aud: `${app.url}/oauth/token`, exp: Math.floor(Date.now() / 1000) + 120, jti: randomUUID() });
  return `${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
const biljett = async (id) => (await (await fetch(`${app.url}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: intyg(id) }) })).json()).access_token;
const medBiljett = (token, vag, init = {}) => fetch(`${app.url}${vag}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/fhir+json' } : {}) } })
  .then(async r => ({ status: r.status, text: await r.text() })).then(r => ({ ...r, data: r.text ? JSON.parse(r.text) : null }));
const KONTO = { namn: 'Regionens vårddatalager', syfte: 'Uppföljning av diagnoser i regionens vårddatalager.', mangder: ['diagnoser'], vardenheter: ['uso-kard'], nyckel: jwk };
async function konto(k, extra = {}) {
  await k.logga('sysf');
  const r = await k.post('/api/oppet-api/systemkonton', { ...KONTO, ...extra });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  return r.data;
}
function nyDiagnos(k, pid = 'p01') {
  const db = sandlada(app, k).db;
  const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut) VALUES (?, 'uso-kard', 'oppenvard', '2026-11-02T09:00', '2026-11-02T09:30') RETURNING id").get(pid).id);
  return Number(db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, datum, vardkontakt_id, typ) VALUES (?, 'uso-kard', 'I48.0', 'Förmaksflimmer', '2026-11-02', ?, 'huvud') RETURNING id").get(pid, vk).id);
}
// En dos vid behov som testet själv ger, så att testet inte beror på dagens dostider.
async function givenDos(k, pid = 'p01') {
  const db = sandlada(app, k).db;
  const lm = db.query("SELECT id FROM katalog WHERE atc = 'N02BE01' ORDER BY id LIMIT 1").get();
  const start = new Date(Date.now() - 2 * 86400_000).toISOString();
  const oid = Number(db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES (?, 'uso-kard', ?, '1 g vid behov, högst 4 gånger per dygn', 1, 'vid_behov', 'Smärta', '2026-12-31', ?, 'lak-kard', ?) RETURNING id")
    .get(pid, lm.id, start.slice(0, 10), start).id);
  const r = await k.post(`/api/patient/${pid}/administreringar`, { ordinationId: oid, atgard: 'ge' });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  return r.data.id;
}

describe('Makulering via API:t', () => {
  test('DELETE och $makulera makulerar en dos med samma regler som gränssnittet: orsak krävs, historiken står kvar och makuleringen loggas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = sandlada(app, k).db;
    const id = await givenDos(k);
    const utan = await fhirAnrop(k, 'DELETE', `/fhir/MedicationAdministration/${id}`);
    expect(utan.status).toBe(400);
    expect(utan.data.issue[0].diagnostics).toContain('orsak');
    const r = await fhirAnrop(k, 'DELETE', `/fhir/MedicationAdministration/${id}?orsak=${encodeURIComponent('Registrerad på fel patient.')}`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ resourceType: 'MedicationAdministration', id: String(id), status: 'entered-in-error' });
    expect(r.data.note.map(n => n.text)).toContain('Makulerad: Registrerad på fel patient.');
    // Dosen står kvar, med makuleringen bredvid.
    expect(db.query('SELECT status FROM administreringar WHERE id = ?').get(id).status).toBe('given');
    expect(db.query("SELECT * FROM makuleringar WHERE typ = 'administrering' AND post_id = ?").get(id)).toMatchObject({ av: 'ssk-kard', orsak: 'Registrerad på fel patient.' });
    expect(logg(k).some(l => l.resurs === `makulering:administrering:${id}` && l.personal_id === 'ssk-kard')).toBe(true);
    expect((await fhirAnrop(k, 'DELETE', `/fhir/MedicationAdministration/${id}?orsak=Igen`)).status).toBe(400);
    // $makulera med orsaken i Parameters.
    const id2 = await givenDos(k);
    const m = await fhirAnrop(k, 'POST', `/fhir/MedicationAdministration/${id2}/$makulera`, { resourceType: 'Parameters', parameter: [{ name: 'orsak', valueString: 'Dosen gavs inte.' }] }, { Prefer: 'return=OperationOutcome' });
    expect([m.status, m.data.issue[0].diagnostics]).toEqual([200, 'Dosen är makulerad. Den står kvar med orsaken.']);
    expect(db.query("SELECT orsak FROM makuleringar WHERE typ = 'administrering' AND post_id = ?").get(id2).orsak).toBe('Dosen gavs inte.');
  });

  test('makuleringen prövas som i gränssnittet: fel roll och en annan vårdenhet nekas, och en dos som inte finns ger 404', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const id = await givenDos(k);
    // Vårdadministratören får inte se doserna, och då finns dosen inte för henne, som i gränssnittet.
    await k.logga('adm-kard');
    expect([403, 404]).toContain((await fhirAnrop(k, 'DELETE', `/fhir/MedicationAdministration/${id}?orsak=Prov`)).status);
    await k.logga('lak-akut');
    expect([403, 404]).toContain((await fhirAnrop(k, 'DELETE', `/fhir/MedicationAdministration/${id}?orsak=Prov`)).status);
    await k.logga('ssk-kard');
    expect((await fhirAnrop(k, 'DELETE', '/fhir/MedicationAdministration/999999?orsak=Prov')).status).toBe(404);
    expect(sandlada(app, k).db.query("SELECT COUNT(*) n FROM makuleringar WHERE post_id = ?").get(id).n).toBe(0);
  });

  test('en provbeställning makuleras via API:t, och en resurs som inte går att makulera ger 405 med vad man gör i stället', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const b = await k.post('/api/patient/p01/prover', { analyser: ['tsh'], kvitteraDubbletter: true });
    expect(b.status).toBe(201);
    const analys = sandlada(app, k).db.query('SELECT id FROM labb_analyser WHERE bestallning_id = ? ORDER BY id LIMIT 1').get(b.data.bestallning.id).id;
    const r = await fhirAnrop(k, 'DELETE', `/fhir/ServiceRequest/labb-${analys}?orsak=${encodeURIComponent('Dubbelbeställd.')}`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ resourceType: 'ServiceRequest', id: `labb-${analys}`, status: 'revoked' });
    expect(sandlada(app, k).db.query('SELECT makulerad_orsak FROM labb_bestallningar WHERE id = ?').get(b.data.bestallning.id).makulerad_orsak).toBe('Dubbelbeställd.');
    for (const [vag, text] of [['/fhir/Composition/1', 'rättas med en ny version'], ['/fhir/MedicationRequest/1', 'sätts ut'], ['/fhir/Observation/1', 'Registrera ett nytt värde'], ['/fhir/Condition/1', 'rättas på vårdkontakten'], ['/fhir/ServiceRequest/1', 'Provbeställningar'], ['/fhir/Encounter/1', 'tas aldrig bort']]) {
      const x = await fhirAnrop(k, 'DELETE', `${vag}?orsak=Prov`);
      expect([vag, x.status]).toEqual([vag, 405]);
      expect(x.data.issue[0].diagnostics).toContain(text);
    }
  });

  test('ett systemkonto får bara makulera det som kontot självt har skrivit', async () => {
    const k = klient(app);
    const kt = await konto(k);
    await k.logga('ssk-kard');
    const id = await givenDos(k);
    const token = await biljett(kt.id);
    const r = await medBiljett(token, `/fhir/MedicationAdministration/${id}?orsak=Prov`, { method: 'DELETE' });
    expect(r.status).toBe(403);
    expect(r.data.issue[0].diagnostics).toBe('Ett systemkonto får bara makulera det som kontot självt har skrivit.');
    expect((await medBiljett(token, `/fhir/MedicationAdministration/${id}/$makulera`, { method: 'POST', body: JSON.stringify({ resourceType: 'Parameters', parameter: [{ name: 'orsak', valueString: 'Prov' }] }) })).status).toBe(403);
    expect(sandlada(app, k).db.query('SELECT COUNT(*) n FROM makuleringar WHERE post_id = ?').get(id).n).toBe(0);
  });
});

describe('Skrivning för systemkonton', () => {
  test('ett systemkonto kan inte registrera överkänslighet eller annat som kontot inte får skriva, och inget sparas', async () => {
    const k = klient(app);
    const kt = await konto(k, { mangder: ['diagnoser', 'overkanslighet'] });
    const token = await biljett(kt.id);
    const db = sandlada(app, k).db;
    const fore = db.query("SELECT COUNT(*) n FROM overkanslighet WHERE patient_id = 'p01'").get().n;
    const r = await medBiljett(token, '/fhir/AllergyIntolerance', { method: 'POST', body: JSON.stringify({ resourceType: 'AllergyIntolerance', patient: { reference: 'Patient/p01' }, code: { text: 'Latex' }, reaction: [{ manifestation: [{ text: 'Utslag' }] }] }) });
    expect(r.status).toBe(403);
    expect(db.query("SELECT COUNT(*) n FROM overkanslighet WHERE patient_id = 'p01'").get().n).toBe(fore);
    // Också om omfånget hade släppt igenom anropet nekar behörighetsmotorn, eftersom kontot bara har läshandlingar.
    const { prova } = await import('../src/atkomst.js');
    const pers = db.query('SELECT * FROM personal WHERE id = ?').get(kt.id);
    expect(prova(db, { personal: pers, patient: 'p01', handling: 'registrera_overkanslighet', resurs: { enhet_id: 'uso-kard' } }).tillaten).toBe(false);
  });
});

describe('Identitet för systemkonton', () => {
  test('förvalet är pseudonym: kontot ser aldrig patientens namn eller personnummer i resurser, sökningar eller prenumerationer', async () => {
    const k = klient(app);
    const kt = await konto(k);
    expect(kt).toMatchObject({ identitet: false, omfang: ['system/Condition.rs', 'system/Patient.r', 'system/Subscription.crds'] });
    expect(kt.far).toContain('pseudonym');
    const db = sandlada(app, k).db;
    const p = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
    const forbjudna = [p.fornamn, p.efternamn, p.personnummer, `${p.personnummer.slice(0, 8)}-${p.personnummer.slice(8)}`, p.personnummer.slice(2), 'p01'];
    const ren = (x) => { const t = JSON.stringify(x); for (const f of forbjudna) expect([f, t.includes(f)]).toEqual([f, false]); };
    const d = nyDiagnos(k);
    const token = await biljett(kt.id);
    const c = await medBiljett(token, `/fhir/Condition/${d}`);
    expect(c.status).toBe(200);
    ren(c.data);
    const ps = c.data.subject.reference.replace('Patient/', '');
    expect(ps).toMatch(/^ps-[A-Za-z0-9_-]{24}$/);
    const pat = await medBiljett(token, `/fhir/Patient/${ps}`);
    expect(pat.status).toBe(200);
    ren(pat.data);
    expect(pat.data).toMatchObject({ resourceType: 'Patient', id: ps, gender: 'male', birthDate: p.fodd.slice(0, 4) });
    expect(pat.data.name).toBeUndefined();
    const sok = await medBiljett(token, `/fhir/Condition?patient=${ps}`);
    expect(sok.data.entry.map(e => e.resource.id)).toContain(String(d));
    ren(sok.data);
    // Patientens riktiga id och personnumret går inte att söka med.
    expect((await medBiljett(token, '/fhir/Condition?patient=p01')).status).toBe(400);
    expect((await medBiljett(token, '/fhir/Patient/p01')).status).toBe(404);
    expect((await medBiljett(token, `/fhir/Patient?identifier=${p.personnummer}`)).status).toBe(400);
    // Pseudonymen är stabil för kontot, och olika mellan konton.
    expect((await medBiljett(await biljett(kt.id), `/fhir/Condition/${d}`)).data.subject.reference).toBe(`Patient/${ps}`);
    const kt2 = await konto(k, { namn: 'Engagemangsindex' });
    expect((await medBiljett(await biljett(kt2.id), `/fhir/Condition/${d}`)).data.subject.reference).not.toBe(`Patient/${ps}`);
    // Prenumerationen och meddelandet har bara id.
    const s = await medBiljett(token, '/fhir/Subscription', { method: 'POST', body: JSON.stringify({ resourceType: 'Subscription', reason: 'Vårddatalagret', criteria: 'Condition', channel: { type: 'rest-hook', endpoint: 'https://vardlager.region.test/fhir-notis', payload: 'application/fhir+json' } }) });
    expect(s.status).toBe(201);
    ren(s.data);
    ren((await medBiljett(token, '/fhir/Subscription')).data);
    const { meddelande } = await import('../src/prenumeration.js');
    await k.logga('lak-kard');
    const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start) VALUES ('p01', 'uso-kard', 'oppenvard', '2026-11-08T09:00') RETURNING id").get().id);
    const ny = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'I10.9' });
    expect(ny.status).toBe(201);
    const notiser = db.query('SELECT * FROM prenumeration_notiser WHERE prenumeration_id = ?').all(Number(s.data.id));
    expect(notiser.length).toBe(1);
    ren(notiser);
    ren(meddelande(app.url, { id: Number(s.data.id) }, { nummer: 1, tid: notiser[0].tid, handelse: 'ny', fokus: notiser[0].fokus }));
  });

  test('namn och personnummer kräver att systemförvaltaren väljer det med en motivering, och då får kontot dem', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/oppet-api/systemkonton', { ...KONTO, identitet: true })).status).toBe(400);
    expect((await k.post('/api/oppet-api/systemkonton', { ...KONTO, identitet: true, identitetMotivering: 'kort' })).status).toBe(400);
    const kt = await konto(k, { identitet: true, identitetMotivering: 'Vårddatalagret knyter posterna till personnumret för uppföljningen.' });
    expect(kt).toMatchObject({ identitet: true, omfang: expect.arrayContaining(['vardkallan/identitet']) });
    expect(logg(k).at(-1).syfte).toContain('Namn och personnummer: Vårddatalagret knyter');
    const d = nyDiagnos(k);
    const token = await biljett(kt.id);
    const c = await medBiljett(token, `/fhir/Condition/${d}`);
    expect(c.data.subject.reference).toBe('Patient/p01');
    const pat = await medBiljett(token, '/fhir/Patient/p01');
    const p = sandlada(app, k).db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
    expect(JSON.stringify(pat.data)).toContain(p.efternamn);
    expect(JSON.stringify(pat.data)).toContain(p.personnummer);
  });
});
