// Runda 9, r5: behörighet, säkerhet, arkiv och miljöer (Sussa kapitel 5 och KD1.1.1.5). Testnamnen finns i
// src/sussa/runda9-r5.js och används av mappningen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateKeyPairSync, createHash, randomBytes } from 'node:crypto';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import * as idp from '../src/idp.js';
import * as masterdata from '../src/masterdata.js';
import { ROLLER, HANDLINGAR, Atkomst } from '../src/atkomst.js';
import * as skyddsbehov from '../src/skyddsbehov.js';
import * as pki from '../src/pki.js';
import * as signering from '../src/signering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as labb from '../src/labb.js';
import * as arkiv from '../src/arkiv.js';
import * as earkiv from '../src/earkiv.js';
import { zip, packaUpp } from '../src/zip.js';
import * as konfiguration from '../src/konfiguration.js';
import { datumAv } from '../src/db.js';
import * as logg from '../src/logg.js';
import * as miljoer from '../src/miljoer.js';
import TESTPERSONNUMMER from '../src/seed/testpersonnummer.json' with { type: 'json' };
import * as hotmodell from '../src/hotmodell.js';
import { sussaRegister } from '../src/sussa/index.js';
import kravspec from '../src/sussa/kravspec.json' with { type: 'json' };

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const las = (biljett) => JSON.parse(Buffer.from(biljett.split('.')[1], 'base64url').toString('utf8'));
const huvudFor = (biljett) => JSON.parse(Buffer.from(biljett.split('.')[0], 'base64url').toString('utf8'));
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const sakerhet = (k) => sandlada(app, k).db.query('SELECT * FROM sakerhetslogg ORDER BY id').all();
// En session med en sandlåda, utan inloggning.
async function nySession() { const k = klient(app); await k.get('/api/session'); return k; }

describe('Inloggning med biljett', () => {
  test('inloggningen går genom den simulerade autentiseringstjänsten, och personen, uppdraget och behörigheten tas ur biljettens attribut', async () => {
    const k = klient(app);
    const r = await k.logga('ssk-kard');
    expect(r.data.personal).toMatchObject({ id: 'ssk-kard', yrke: 'sjukskoterska' });
    // Sjuksköterskan arbetar på en arbetsplats, och uppdraget gäller vårdenheten den hör till.
    expect(r.data.uppdrag).toMatchObject({ utfardare: idp.UTFARDARE_NAMN, andamal: 'Vård och behandling', vardenhet: 'Kardiologiska kliniken USÖ', tillitsniva: idp.TILLITSNIVA });
    expect(r.data.behorigheter).toEqual(ROLLER.sjukskoterska);
    const s = sandlada(app, k);
    expect(s.uppdrag).toMatchObject({ personHsaId: pers(s.db, 'ssk-kard').hsa_id, yrke: 'sjukskoterska', utfardare: idp.UTFARDARE });
    // Biljetten som tjänsten utfärdar har attributen och är signerad med ES256.
    const b = idp.autentisera(s.db, pers(s.db, 'ssk-kard'));
    expect(huvudFor(b)).toMatchObject({ alg: 'ES256', typ: 'JWT' });
    const a = las(b);
    expect(a).toMatchObject({ iss: idp.UTFARDARE, aud: 'vardkallan', employeeHsaId: pers(s.db, 'ssk-kard').hsa_id, commissionPurpose: 'Vård och behandling',
      healthCareUnitHsaId: 'SE2321000164-VK0120', healthCareProviderHsaId: 'SE2321000164-VK0000', professionCode: 'sjukskoterska', amr: ['sc', 'pin'] });
    expect(a.exp - a.iat).toBe(idp.GILTIG_SEKUNDER);
    // Samma biljett utifrån ger samma inloggning.
    const k2 = await nySession();
    const r2 = await k2.post('/api/login/biljett', { biljett: b });
    expect(r2.status).toBe(200);
    expect(r2.data.personal.id).toBe('ssk-kard');
    expect(sakerhet(k2).at(-1)).toMatchObject({ typ: 'inloggning', personal_id: 'ssk-kard', beskrivning: 'Inloggning med biljett från autentiseringstjänsten.' });
    // Rollerna med andra ändamål får uppdrag för sitt ändamål.
    expect((await klient(app).logga('logg')).data.uppdrag.andamal).toBe('Kvalitetssäkring');
    expect((await klient(app).logga('uppf')).data.uppdrag.andamal).toBe('Statistik');
  });

  test('en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen', async () => {
    const k = await nySession();
    const db = sandlada(app, k).db;
    const ratt = idp.autentisera(db, pers(db, 'lak-kard'));
    const a = las(ratt);
    const h = huvudFor(ratt);
    const egen = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    const nu = Math.floor(Date.now() / 1000);
    const fall = [
      ['utfärdaren är inte en betrodd autentiseringstjänst', idp.signera(h, { ...a, iss: 'https://idp.example.invalid', jti: 'x1' }, egen)],
      ['signaturen stämmer inte', idp.signera(h, { ...a, jti: 'x2' }, egen)],
      // Ändrat innehåll med den riktiga signaturen.
      ['signaturen stämmer inte', `${ratt.split('.')[0]}.${Buffer.from(JSON.stringify({ ...a, professionCode: 'lakare', commissionPurpose: 'Administration' })).toString('base64url')}.${ratt.split('.')[2]}`],
      ['den är utfärdad till en annan tjänst', idp.utfarda({ ...a, aud: 'annan-tjanst', jti: 'x3' })],
      ['den har gått ut', idp.autentisera(db, pers(db, 'lak-kard'), { nu: Date.now() - 10 * 60_000 })],
      ['den är utfärdad i framtiden', idp.utfarda({ ...a, iat: nu + 3600, exp: nu + 3900, jti: 'x4' })],
      ['algoritmen godtas inte', `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${ratt.split('.')[1]}.`],
      ['algoritmen godtas inte', idp.signera({ ...h, alg: 'HS256' }, { ...a, jti: 'x5' }, egen)],
      ['tillitsnivån räcker inte', idp.utfarda({ ...a, acr: 'http://id.elegnamnden.se/loa/1.0/loa2', jti: 'x6' })],
      ['attributet commissionHsaId saknas', idp.utfarda({ ...a, commissionHsaId: undefined, jti: 'x7' })],
      ['den är inte en signerad JWT', 'inte-en-biljett'],
    ];
    for (const [orsak, biljett] of fall) {
      const r = await k.post('/api/login/biljett', { biljett });
      expect(r.status).toBe(401);
      expect(r.data.fel).toContain(orsak);
      expect(sakerhet(k).at(-1)).toMatchObject({ typ: 'inloggning_misslyckad', personal_id: null });
      expect(sakerhet(k).at(-1).beskrivning).toContain(orsak);
    }
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
    // Den riktiga biljetten godtas fortfarande.
    expect((await k.post('/api/login/biljett', { biljett: ratt })).status).toBe(200);
  });

  test('en biljett kan bara användas en gång', async () => {
    const k = await nySession();
    const db = sandlada(app, k).db;
    const b = idp.autentisera(db, pers(db, 'lak-akut'));
    expect((await k.post('/api/login/biljett', { biljett: b })).status).toBe(200);
    const k2 = await nySession();
    const r = await k2.post('/api/login/biljett', { biljett: b });
    expect(r.status).toBe(401);
    expect(r.data.fel).toContain('den har redan använts');
  });

  test('ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring', async () => {
    const k = await nySession();
    const db = sandlada(app, k).db;
    const lak = las(idp.autentisera(db, pers(db, 'lak-kard')));
    const ssk = las(idp.autentisera(db, pers(db, 'ssk-kard')));
    const akut = idp.uppdragFor(db, pers(db, 'lak-akut'));
    const fall = [
      ['annan vårdenhet än Kardiologiska kliniken USÖ', { ...lak, healthCareUnitHsaId: akut.healthCareUnitHsaId, commissionHsaId: idp.uppdragHsaId(lak.employeeHsaId, akut.healthCareUnitHsaId), jti: 'u1' }],
      ['Yrkesrollen i biljetten stämmer inte', { ...ssk, professionCode: 'lakare', jti: 'u2' }],
      ['gäller ändamålet Statistik', { ...lak, commissionPurpose: 'Statistik', jti: 'u3' }],
      ['Medarbetaruppdraget i biljetten finns inte i katalogen', { ...lak, commissionHsaId: 'SE2321000164-PAHITTAT', jti: 'u4' }],
      ['Personen i biljetten finns inte i katalogen', { ...lak, employeeHsaId: 'SE2321000164-VKP999', jti: 'u5' }],
    ];
    for (const [orsak, a] of fall) {
      const r = await k.post('/api/login/biljett', { biljett: idp.utfarda(a) });
      expect(r.status).toBe(403);
      expect(r.data.fel).toContain(orsak);
    }
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
  });

  test('autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning', async () => {
    const fore = app.sessioner.size;
    const konf = await (await fetch(`${app.url}/api/idp/.well-known/openid-configuration`)).json();
    expect(konf).toMatchObject({ issuer: idp.UTFARDARE, jwks_uri: `${app.url}/api/idp/jwks`, id_token_signing_alg_values_supported: ['ES256'] });
    expect(konf.claims_supported).toEqual(expect.arrayContaining(['employeeHsaId', 'commissionHsaId', 'commissionPurpose', 'healthCareUnitHsaId']));
    const jwks = await (await fetch(konf.jwks_uri)).json();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' });
    expect(jwks.keys[0].d).toBeUndefined();
    // Nyckeln i JWKS är den som biljetterna är signerade med.
    expect(huvudFor(idp.autentisera(nyDb(), pers(nyDb(), 'lak-kard'))).kid).toBe(jwks.keys[0].kid);
    expect(app.sessioner.size).toBe(fore);
  });
});

// SMART on FHIR: en åtkomstbiljett för en tillämpning, som i oppet-api.test.js.
const pkce = () => { const v = randomBytes(32).toString('base64url'); return { v, c: createHash('sha256').update(v).digest('base64url') }; };
async function smartBiljett(k, pid = 'p01') {
  const st = await k.post(`/api/patient/${pid}/tillampningar/blodtryck/starta`, {});
  const adress = new URL(st.data.adress, app.url);
  const konf = await (await fetch(`${app.url}/fhir/.well-known/smart-configuration`)).json();
  const { v, c } = pkce();
  const u = new URL(konf.authorization_endpoint);
  const redirect = `${app.url}/tillampningar/blodtryck/index.html`;
  const p = { response_type: 'code', client_id: 'blodtryck', redirect_uri: redirect, scope: 'launch patient/Observation.read patient/Patient.read', state: 's', aud: `${app.url}/fhir`, code_challenge: c, code_challenge_method: 'S256', launch: adress.searchParams.get('launch') };
  for (const [n, x] of Object.entries(p)) u.searchParams.set(n, x);
  const r = await fetch(u, { headers: { Cookie: k.kaka() }, redirect: 'manual' });
  const kod = new URL(r.headers.get('location')).searchParams.get('code');
  const t = await fetch(`${app.url}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: kod, redirect_uri: redirect, client_id: 'blodtryck', code_verifier: v }) });
  return (await t.json()).access_token;
}

// En källa för personalen: filadapterns personal med ändringar.
const kallaMed = (andra) => {
  const f = masterdata.filadapter();
  return { id: 'hsa-test', namn: 'HSA-katalogen (simulerad i testet)', personal: () => andra(f.personal()) };
};
const NY = { id: 'ssk-ny', hsaId: 'SE2321000164-VKP900', namn: 'Elsa Testberg', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhetId: 'uso-kard-72', demo: false, aktiv: true };

describe('Behörighet ur masterdata', () => {
  test('en ny person i källan får behörighet ur yrke och vårdenhet utan administration och kan logga in med biljett', async () => {
    const k = await nySession();
    const db = sandlada(app, k).db;
    const r = masterdata.synkronisera(db, 'personal', kallaMed(l => [...l, NY]));
    expect(r.nya).toEqual(['ssk-ny']);
    // Ingen behörighet läggs upp: biljetten från autentiseringstjänsten räcker.
    const inn = await k.post('/api/login/biljett', { biljett: idp.autentisera(db, pers(db, 'ssk-ny')) });
    expect(inn.status).toBe(200);
    expect(inn.data.personal).toMatchObject({ id: 'ssk-ny', yrke: 'sjukskoterska' });
    expect(inn.data.behorigheter).toEqual(ROLLER.sjukskoterska);
    expect(inn.data.uppdrag.vardenhet).toBe('Kardiologiska kliniken USÖ');
    // Behörigheten räknas ur yrke, enhet och vårdrelation: arbetslistan och journalen på den egna vårdenheten.
    const lista = (await k.get('/api/arbetslista')).data;
    expect(lista.length).toBeGreaterThan(0);
    expect((await k.get(`/api/patient/${lista[0].id}`)).status).toBe(200);
    // Men inte det yrkesrollen inte får.
    expect((await k.post(`/api/patient/${lista[0].id}/lakemedel/kontroll`, {})).status).toBe(403);
    // Demoinloggningen gäller fortfarande bara demorollerna.
    expect((await (await nySession()).post('/api/login', { personalId: 'ssk-ny' })).status).toBe(400);
  });

  test('en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya', async () => {
    const k = await nySession();
    const db = sandlada(app, k).db;
    masterdata.synkronisera(db, 'personal', kallaMed(l => [...l, NY]));
    await k.post('/api/login/biljett', { biljett: idp.autentisera(db, pers(db, 'ssk-ny')) });
    const pid = (await k.get('/api/arbetslista')).data[0].id;
    // Personen blir läkare på samma vårdenhet enligt källan.
    const r = masterdata.synkronisera(db, 'personal', kallaMed(l => [...l, { ...NY, yrke: 'lakare', titel: 'Läkare' }]));
    expect(r.andrade).toEqual(['ssk-ny']);
    const ut = await k.get('/api/arbetslista');
    expect(ut.status).toBe(401);
    expect(ut.data.fel).toContain('Yrkesrollen i biljetten stämmer inte med katalogen');
    expect(sakerhet(k).some(x => x.typ === 'utloggning' && x.personal_id === 'ssk-ny' && x.beskrivning.startsWith('Inloggningen avslutades av systemet'))).toBe(true);
    // Den nya inloggningen ger läkarens behörighet.
    const inn = await k.post('/api/login/biljett', { biljett: idp.autentisera(db, pers(db, 'ssk-ny')) });
    expect(inn.data.behorigheter).toEqual(ROLLER.lakare);
    expect((await k.post(`/api/patient/${pid}/lakemedel/kontroll`, {})).status).not.toBe(403);
    // Personen flyttar till akutmottagningen: uppdraget på kardiologen gäller inte längre.
    masterdata.synkronisera(db, 'personal', kallaMed(l => [...l, { ...NY, yrke: 'lakare', titel: 'Läkare', enhetId: 'uso-akut' }]));
    const ut2 = await k.get(`/api/patient/${pid}`);
    expect(ut2.status).toBe(401);
    expect(ut2.data.fel).toContain('annan vårdenhet');
    const in2 = await k.post('/api/login/biljett', { biljett: idp.autentisera(db, pers(db, 'ssk-ny')) });
    expect(in2.data.uppdrag.vardenhet).toBe('Akutmottagningen USÖ');
  });

  test('en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const token = await smartBiljett(k);
    const medToken = () => fetch(`${app.url}/fhir/Observation?patient=p01`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await medToken()).status).toBe(200);
    expect((await k.get('/api/patient/p01')).status).toBe(200);
    const r = masterdata.synkronisera(db, 'personal', kallaMed(l => l.filter(p => p.id !== 'lak-kard')));
    expect(r.inaktiverade).toEqual(['lak-kard']);
    // Pågående session och tillämpningens åtkomstbiljett upphör vid nästa anrop.
    const ut = await k.get('/api/patient/p01');
    expect(ut.status).toBe(401);
    expect(ut.data.fel).toContain('inte längre aktiv i katalogen');
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
    expect((await medToken()).status).toBe(401);
    // Ny inloggning nekas, både som demoroll och med en biljett, och orsaken loggas.
    const igen = await k.post('/api/login', { personalId: 'lak-kard' });
    expect(igen.status).toBe(403);
    expect(igen.data.fel).toContain('finns inte som aktiv personal');
    expect(sakerhet(k).at(-1)).toMatchObject({ typ: 'inloggning_misslyckad' });
    expect(sakerhet(k).at(-1).beskrivning).toContain('finns inte som aktiv personal');
    const forr = idp.utfarda({ ...las(idp.autentisera(nyDb(), pers(nyDb(), 'lak-kard'))), jti: 'inaktiv-1' });
    const b = await k.post('/api/login/biljett', { biljett: forr });
    expect(b.status).toBe(403);
    expect(b.data.fel).toContain('inte längre som aktiv personal');
    // Personal som redan är inaktiv i seeden (lak-vas) får ingen biljett alls.
    expect(() => idp.autentisera(db, pers(db, 'lak-vas'))).toThrow('finns inte som aktiv personal');
    // När källan har personen igen kan den logga in.
    masterdata.synkronisera(db, 'personal', kallaMed(l => l));
    expect((await k.post('/api/login', { personalId: 'lak-kard' })).status).toBe(200);
  });
});

describe('Skyddsbehov', () => {
  test('varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan', async () => {
    const db = nyDb();
    const kolumner = (t) => db.query(`PRAGMA table_info("${t}")`).all().map(k => k.name);
    expect(skyddsbehov.INFORMATIONSTYPER.length).toBeGreaterThanOrEqual(10);
    for (const t of skyddsbehov.INFORMATIONSTYPER) {
      expect(Object.keys(skyddsbehov.NIVAER).map(Number)).toContain(t.niva);
      expect(t.skydd.length).toBeGreaterThan(20);
      // Tabellen och kolumnerna som klassningen hänvisar till finns.
      const k = kolumner(t.tabell);
      expect(k.length).toBeGreaterThan(0);
      for (const kol of Object.values(t.urskiljs).filter(Boolean)) expect(k).toContain(kol);
      for (const h of t.handlingar ?? []) expect(HANDLINGAR[h]).toBeDefined();
    }
    const niva = (id) => skyddsbehov.typ(id).niva;
    expect([niva('tvangsvard'), niva('skyddad_identitet'), niva('sparrad'), niva('atkomstlogg')]).toEqual([3, 3, 3, 3]);
    expect([niva('anteckning'), niva('lakemedel'), niva('vardplan')]).toEqual([2, 2, 2]);
    // Organisation, process och plan: en tvångsvårdshändelse hör till vårdenheten och perioden, en vårdplan är själv planen.
    expect(skyddsbehov.typ('tvangsvard').urskiljs).toEqual({ organisation: 'enhet_id', process: 'period_id', plan: null });
    expect(skyddsbehov.typ('samordnad').urskiljs.plan).toBe('id');
    expect(skyddsbehov.HOGA_HANDLINGAR).toEqual(expect.arrayContaining(['las_tvangsvard', 'tvangsvard', 'visa_identitet', 'samtycke_sparr']));
    // API: klassningen kan läsas av personalen, utan patientuppgifter.
    const k = klient(app);
    expect((await k.get('/api/skyddsbehov')).status).toBe(401);
    await k.logga('usk-kard');
    const r = (await k.get('/api/skyddsbehov')).data;
    expect(r.typer.find(t => t.id === 'tvangsvard')).toMatchObject({ niva: 3, nivaNamn: 'Mycket högt' });
    expect(r.standard).toContain('Högt');
  });

  test('logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01')).status).toBe(200);
    expect((await k.get('/api/patient/p03')).status).toBe(200);
    await k.logga('lak-psyk');
    expect((await k.get('/api/patient/p22/tvangsvard')).status).toBe(200);
    await k.logga('logg');
    const r = (await k.get('/api/logg?flagga=skyddsbehov')).data;
    expect(r.flagga).toBe('skyddsbehov');
    expect(r.rader.length).toBeGreaterThan(0);
    expect(r.rader.every(x => x.skyddsniva === 3)).toBe(true);
    expect(r.rader.some(x => x.patientId === 'p03' && x.personal?.id === 'lak-kard')).toBe(true);
    expect(r.rader.some(x => x.patientId === 'p22' && x.handling === 'las_tvangsvard')).toBe(true);
    expect(r.rader.some(x => x.patientId === 'p01')).toBe(false);
    // I hela loggen har varje rad sin nivå.
    const alla = (await k.get('/api/logg')).data.rader;
    expect(alla.find(x => x.patientId === 'p01' && x.personal?.id === 'lak-kard').skyddsniva).toBe(2);
    expect(alla.filter(x => x.skyddsniva === 3).length).toBe(r.rader.length);
  });

  test('stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov', async () => {
    for (let i = 0; i < 3; i++) {
      const k = klient(app);
      await k.logga('lak-kard');
      for (let j = 0; j < 30; j++) await k.get('/api/patient/p01');
      await k.get('/api/patient/p03');
      await k.logga('logg');
      const s = await k.post('/api/stickprov', {});
      expect(s.status).toBe(201);
      const hoga = s.data.rader.filter(r => r.skyddsniva === 3);
      expect(hoga.length).toBeGreaterThanOrEqual(1);
      expect(hoga.some(r => r.patient?.id === 'p03' && r.skyddsorsak === 'Patienten har skyddade personuppgifter.')).toBe(true);
      // Resten är slumpvis dragna bland alla andra åtkomster.
      expect(s.data.rader.length).toBe(10);
    }
  });
});

// Laboratoriets svar i en egen sandlåda: en beställning för patient 1 som är provtagen och skickad.
const BAS = new Date('2026-11-08T09:00:00Z');
const T = (min) => new Date(BAS.getTime() + min * 60_000);
function provtagen(db) {
  const b = labb.bestall(new Atkomst(db, pers(db, 'lak-kard'), 'p01', {}, 'bestalla_prov'), { paket: 'feber' }, BAS).bestallning;
  for (const p of b.prov) labb.taProv(new Atkomst(db, pers(db, 'ssk-kard'), 'p01', {}, 'ta_prov'), labb.provRad(db, p.id), T(5));
  return b;
}
const bevisRader = (db, typ) => { signering.sakraSchema(db); return db.query('SELECT * FROM signerade_meddelanden WHERE typ = ? ORDER BY tid').all(typ); };
// Bevisen för svaren på en beställning. Seeden har egna svar från laboratoriet med egna bevis.
const svarsbevis = (db, b) => {
  const ids = new Set(db.query('SELECT id FROM labb_analyser WHERE bestallning_id = ?').all(b.id).map(r => r.id));
  return bevisRader(db, 'labbsvar').filter(x => ids.has(Number(x.kalla.split(':')[1])));
};

describe('Signerade meddelanden', () => {
  test('en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas', () => {
    const db = nyDb();
    const o = db.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id LIMIT 1").get();
    const r = lakemedel.overfor(db, o.id, 'ny');
    expect(r.status).toBe('kvitterad');
    const [b] = bevisRader(db, 'nll');
    expect(b).toMatchObject({ riktning: 'ut', motpart: 'nll', status: 'kvitterat', orsak: null });
    const m = JSON.parse(b.meddelande);
    const kv = JSON.parse(b.kvittens);
    expect(m.huvud).toMatchObject({ typ: 'nll', avsandare: 'vardkallan', mottagare: 'nll' });
    expect(kv.huvud).toMatchObject({ typ: 'kvittens', avsandare: 'nll', avser: m.huvud.id, innehallHash: m.huvud.innehallHash, resultat: 'mottaget' });
    // Signaturerna går att kontrollera med certifikaten i meddelandet, och kedjan går till den betrodda roten.
    expect(pki.verifieraKedja(m.kedja)).toMatchObject({ ok: true, part: 'vardkallan' });
    expect(pki.verifieraKedja(kv.kedja)).toMatchObject({ ok: true, part: 'nll' });
    expect(m.kedja.at(-1)).not.toBe(pki.ROT.cert.toString());
    // Innehållet sparas inte i beviset, bara dess hash. Beviset stämmer med journalen.
    expect(b.meddelande).not.toContain(db.query("SELECT personnummer FROM patienter WHERE id = 'p01'").get().personnummer);
    const innehall = lakemedel.nllInnehall(db, o.id, 'ny', m.huvud.tid);
    expect(signering.hash(innehall)).toBe(b.innehall_hash);
    expect(signering.kontrolleraBevis(db, b.id, innehall)).toMatchObject({ hel: true, signatur: 'Signaturen och certifikatet stämmer.' });
    // Ordinationen säger att överföringen är signerad och kvitterad.
    const ut = lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, o.id));
    expect(ut.nll.at(-1)).toMatchObject({ status: 'kvitterad', signerad: 'kvitterat' });
  });

  test('ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt', () => {
    const db = nyDb();
    const innehall = { exempel: 'förskrivning', dos: 1 };
    const m = signering.signera('vardkallan', { typ: 'nll', mottagare: 'nll', innehall });
    // Mottagaren ser ett ändrat innehåll och ett ändrat huvud.
    expect(signering.kvittera('nll', m, { ...innehall, dos: 2 }).huvud).toMatchObject({ resultat: 'avvisat', orsak: 'Innehållet har ändrats efter att meddelandet signerades.' });
    expect(signering.kvittera('nll', { ...m, huvud: { ...m.huvud, mottagare: 'labb' } }, innehall).huvud.orsak).toBe('Signaturen stämmer inte med meddelandet.');
    // En kvittens som ändras på vägen godtas inte, och överföringen räknas inte som kvitterad.
    const b = signering.skicka(db, { typ: 'nll', kalla: 'prov:1', enhetId: 'uso-kard', innehall, mottagaren: (mm, i) => { const kv = signering.kvittera('nll', mm, i); return { ...kv, huvud: { ...kv.huvud, tid: '2020-01-01T00:00:00.000Z' } }; } });
    expect(b).toMatchObject({ status: 'avvisat', orsak: 'Kvittensen godtogs inte: Signaturen stämmer inte med meddelandet.' });
    // En kvittens som gäller ett annat meddelande godtas inte heller.
    const annan = signering.signera('vardkallan', { typ: 'nll', mottagare: 'nll', innehall });
    expect(signering.skicka(db, { typ: 'nll', kalla: 'prov:2', enhetId: 'uso-kard', innehall, mottagaren: (mm, i) => signering.kvittera('nll', annan, i) }).status).toBe('avvisat');
    // Journalen ändras efter överföringen: beviset visar det.
    const o = db.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id LIMIT 1").get();
    lakemedel.overfor(db, o.id, 'ny');
    const rad = bevisRader(db, 'nll').find(x => x.kalla.startsWith(`nll:${o.id}:`));
    const tid = JSON.parse(rad.meddelande).huvud.tid;
    db.query("UPDATE ordinationer SET dosering = '10 mg dagligen' WHERE id = ?").run(o.id);
    const k = signering.kontrolleraBevis(db, rad.id, lakemedel.nllInnehall(db, o.id, 'ny', tid));
    expect(k).toMatchObject({ hel: false, innehall: 'Innehållet i journalen stämmer inte längre med det som signerades.', signatur: 'Signaturen och certifikatet stämmer.' });
  });

  test('ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar', () => {
    // Rätt signerat svar: mätvärdena kommer in, och beviset stämmer med journalen.
    const db = nyDb();
    const b = provtagen(db);
    expect(labb.forfallnaSvar(db, T(5 + labb.SVAR_MINUTER))).toBe(4);
    const mottagna = svarsbevis(db, b);
    expect(mottagna).toHaveLength(4);
    expect(mottagna.every(x => x.riktning === 'in' && x.status === 'mottaget' && x.motpart === 'labb')).toBe(true);
    const a = Number(mottagna[0].kalla.split(':')[1]);
    expect(signering.kontrolleraBevis(db, mottagna[0].id, labb.mottagetSvar(db, a)).hel).toBe(true);
    // Ett svar som ändras på vägen tas inte emot, och inga mätvärden kommer in.
    const db2 = nyDb();
    const b2 = provtagen(db2);
    const db3 = nyDb();
    const b3 = provtagen(db3);
    const forra = labb.sattKanal(({ meddelande, innehall }) => ({ meddelande, innehall: { ...innehall, provtagen: '2020-01-01T00:00:00.000Z', varden: innehall.varden.map(v => ({ ...v, varde: v.varde * 10 })) } }));
    try {
      const fore = db2.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p01'").get().n;
      expect(labb.forfallnaSvar(db2, T(5 + labb.SVAR_MINUTER))).toBe(0);
      expect(db2.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p01'").get().n).toBe(fore);
      const avv = svarsbevis(db2, b2);
      expect(avv[0]).toMatchObject({ status: 'avvisat', orsak: 'Innehållet har ändrats efter att meddelandet signerades.' });
      expect(labb.bestallningUt(db2, labb.bestallningRad(db2, b2.id), pers(db2, 'lak-kard'), T(60)).status).not.toBe('besvarad');
      expect(db2.query("SELECT detalj FROM labb_historik WHERE bestallning_id = ? AND handelse = 'Svaret från laboratoriet togs inte emot'").get(b2.id).detalj).toContain('Innehållet har ändrats');
      // Ett svar signerat av någon som inte har ett certifikat från en betrodd utfärdare tas inte emot.
      const falsk = pki.skapaUtfardare({ cn: 'Falsk utfärdare', o: 'Ingen' });
      const falskLabb = pki.utfarda(falsk, { part: 'labb', namn: 'Falskt laboratorium' });
      labb.sattKanal(({ meddelande, innehall }) => ({ meddelande: { ...meddelande, kedja: falskLabb.kedja }, innehall }));
      expect(labb.forfallnaSvar(db3, T(5 + labb.SVAR_MINUTER))).toBe(0);
      expect(svarsbevis(db3, b3)[0].orsak).toBe('Kedjan går inte till en betrodd utfärdare.');
    } finally { labb.sattKanal(forra); }
    expect(b.id).toBeGreaterThan(0);
  });

  test('bevisen kan inte ändras eller raderas', () => {
    const db = nyDb();
    const o = db.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id LIMIT 1").get();
    lakemedel.overfor(db, o.id, 'ny');
    expect(() => db.query("UPDATE signerade_meddelanden SET status = 'avvisat'").run()).toThrow('ändras inte');
    expect(() => db.query('DELETE FROM signerade_meddelanden').run()).toThrow('raderas inte');
  });

  test('API: systemförvaltaren ser certifikaten och bevisen utan patientuppgifter och kontrollerar ett bevis, andra roller nekas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.get('/api/certifikat')).status).toBe(403);
    const db = sandlada(app, k).db;
    const o = db.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id LIMIT 1").get();
    lakemedel.overfor(db, o.id, 'ny');
    await k.logga('sysf');
    const r = (await k.get('/api/certifikat')).data;
    expect(r.betrodda).toHaveLength(1);
    expect(r.betrodda[0]).toMatchObject({ utfardareCa: true, aterkallat: false });
    expect(r.instanser.map(i => i.part).sort()).toEqual(['earkiv', 'labb', 'nll', 'vardkallan']);
    expect(r.instanser.every(i => i.kontroll === null && !i.utfardareCa && i.utfardare === r.utfardare.amne)).toBe(true);
    expect(r.meddelanden.senaste[0]).toMatchObject({ typText: 'Förskrivning till läkemedelslistan', riktning: 'ut', status: 'kvitterat' });
    const text = JSON.stringify(r);
    for (const x of ['p01', db.query("SELECT personnummer FROM patienter WHERE id = 'p01'").get().personnummer, 'Åkesson']) expect(text).not.toContain(x);
    const kontroll = (await k.get(`/api/signerade/${r.meddelanden.senaste[0].id}/kontroll`)).data;
    expect(kontroll).toMatchObject({ hel: true, innehall: 'Innehållet är detsamma som när det signerades.', kvittens: 'Kvittensen är signerad av mottagaren och stämmer.' });
  });
});

describe('Certifikat mellan instanser', () => {
  test('kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte', () => {
    const labbet = pki.instans('labb');
    expect(pki.verifieraKedja(labbet.kedja)).toMatchObject({ ok: true, part: 'labb', namn: 'Simulerat laboratorium (demo)' });
    // Certifikaten är X.509 med ECDSA P-256, och rotutfärdaren är den enda betrodda.
    expect(labbet.cert.publicKey.asymmetricKeyDetails.namedCurve).toBe('prime256v1');
    expect(pki.ROT.cert.ca).toBe(true);
    expect(Boolean(pki.MELLAN.cert.checkIssued(pki.ROT.cert))).toBe(true);
    const falsk = pki.skapaUtfardare({ cn: 'Annan utfärdare', o: 'Ingen' });
    expect(pki.verifieraKedja(pki.utfarda(falsk, { part: 'labb', namn: 'Falskt' }).kedja).orsak).toBe('Kedjan går inte till en betrodd utfärdare.');
    // Med den andra utfärdaren i listan godtas samma kedja, så det är listan som avgör.
    expect(pki.verifieraKedja(pki.utfarda(falsk, { part: 'labb', namn: 'Annat' }).kedja, { betrodda: [falsk.cert] }).ok).toBe(true);
    // En instans kan inte utfärda certifikat åt andra.
    const somUtfardare = { subjekt: { cn: 'labb', o: 'Simulerat laboratorium (demo)' }, privat: labbet.privat, cert: labbet.cert };
    const fran = pki.utfarda(somUtfardare, { part: 'nll', namn: 'Falsk läkemedelslista' });
    expect(pki.verifieraKedja([fran.kedja[0], labbet.kedja[0], labbet.kedja[1]]).ok).toBe(false);
    expect(pki.verifieraKedja([labbet.kedja[1]]).orsak).toBe('Certifikatet tillhör en utfärdare och inte en instans.');
    expect(pki.verifieraKedja(['inte ett certifikat']).orsak).toBe('Certifikatet går inte att läsa.');
  });

  test('ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas', () => {
    const gammal = pki.utfarda(pki.MELLAN, { part: 'labb', namn: 'Gammalt', fran: new Date('2020-01-01'), till: new Date('2021-01-01') });
    expect(pki.verifieraKedja(gammal.kedja, { nu: new Date('2026-11-08T09:00:00Z') }).orsak).toBe('Certifikatet för instansen har gått ut.');
    expect(pki.verifieraKedja(gammal.kedja, { nu: new Date('2020-06-01') }).ok).toBe(true);
    expect(pki.verifieraKedja(gammal.kedja, { nu: new Date('2019-06-01') }).orsak).toBe('Certifikatet för instansen gäller inte ännu.');
    const l = pki.instans('labb');
    expect(pki.verifieraKedja(l.kedja, { aterkallade: new Set([l.cert.serialNumber]) }).orsak).toBe('Certifikatet för instansen är återkallat.');
    expect(pki.verifieraKedja(l.kedja, { aterkallade: new Set([pki.MELLAN.cert.serialNumber]) }).orsak).toBe('Certifikatet för utfärdaren är återkallat.');
    // Ett meddelande signerat med ett utgånget certifikat godtas inte, inte heller när signaturen stämmer.
    const m = signering.signera('labb', { typ: 'labbsvar', mottagare: 'vardkallan', innehall: { a: 1 } });
    expect(signering.kontrollera({ ...m, kedja: gammal.kedja }, { avsandare: 'labb', innehall: { a: 1 } })).toBe('Certifikatet för instansen har gått ut.');
  });

  test('ett certifikat för en annan instans godtas inte som avsändare', () => {
    const m = signering.signera('nll', { typ: 'labbsvar', mottagare: 'vardkallan', innehall: { a: 1 } });
    expect(signering.kontrollera(m, { avsandare: 'labb', innehall: { a: 1 } })).toBe('Certifikatet tillhör inte avsändaren.');
    // En äkta kedja för laboratoriet med läkemedelslistans signatur stämmer inte.
    const blandad = { ...m, huvud: { ...m.huvud, avsandare: 'labb' }, kedja: pki.instans('labb').kedja };
    expect(signering.kontrollera(blandad, { avsandare: 'labb', innehall: { a: 1 } })).toBe('Signaturen stämmer inte med meddelandet.');
  });

  test('när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/certifikat/aterkalla', { part: 'vardkallan' })).status).toBe(400);
    expect((await k.post('/api/certifikat/aterkalla', { part: 'constructor' })).status).toBe(400);
    const r = await k.post('/api/certifikat/aterkalla', { part: 'labb' });
    expect(r.status).toBe(200);
    expect(r.data.instanser.find(i => i.part === 'labb')).toMatchObject({ aterkallat: true, kontroll: 'Certifikatet för instansen är återkallat.' });
    expect(sakerhet(k).at(-1)).toMatchObject({ typ: 'andrad_behorighet', personal_id: 'sysf' });
    const db = sandlada(app, k).db;
    const bb = provtagen(db);
    expect(labb.forfallnaSvar(db, T(5 + labb.SVAR_MINUTER))).toBe(0);
    expect(svarsbevis(db, bb)[0]).toMatchObject({ status: 'avvisat', orsak: 'Certifikatet för instansen är återkallat.' });
    // En annan sandlåda tar emot svaren som vanligt.
    const annan = nyDb();
    provtagen(annan);
    expect(labb.forfallnaSvar(annan, T(5 + labb.SVAR_MINUTER))).toBe(4);
    // Läkemedelslistans certifikat återkallat: överföringen räknas inte som kvitterad.
    pki.aterkalla(annan, pki.instans('nll').cert.serialNumber, 'Prov');
    const o = annan.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id LIMIT 1").get();
    expect(lakemedel.overfor(annan, o.id, 'ny').status).toBe('fel');
    expect(annan.query("SELECT nll_status FROM ordinationer WHERE id = ?").get(o.id).nll_status).toBe('fel');
  });
});

describe('E-arkiv', () => {
  const beslut = (k, data) => k.post('/api/arkiv/beslut', { diarienummer: 'DEMO-2026-0099', beslutsdatum: '2026-11-01', ...data });

  test('paketet har ett index med e-arkivets dataelement för varje journalhandling, och mappningen står i dokumentationen', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    const b = arkiv.hamtaBeslut(db, (await beslut(k, { typ: 'leverans', patientId: 'p01' })).data.id);
    const { paket, objid } = arkiv.exportera(db, pers(db, 'ark'), b);
    const filer = packaUpp(paket);
    const rot = `${objid}/`;
    const idx = filer.get(`${rot}metadata/descriptive/earkiv-index.xml`).data.toString('utf8');
    const poster = [...idx.matchAll(/<handling>([\s\S]*?)<\/handling>/g)].map(m => m[1]);
    const antal = ['anteckningar WHERE status = \'signerad\' AND', 'diagnoser WHERE', 'matvarden WHERE', 'ordinationer WHERE', 'vardkontakter WHERE', 'remisser WHERE']
      .reduce((s, t) => s + db.query(`SELECT count(*) AS n FROM ${t} patient_id = 'p01'`).get().n, 0);
    expect(poster.length).toBe(antal);
    for (const p of poster) for (const d of earkiv.DATAELEMENT.filter(x => x.obligatorisk)) expect(p).toMatch(new RegExp(`<${d.namn}>[^<]+</${d.namn}>`));
    // Varje post pekar på en resurs som finns i filen.
    const bundle = JSON.parse(filer.get(`${rot}representations/rep_1/data/journal/p01.json`).data);
    const urls = new Set(bundle.entry.map(e => e.fullUrl));
    for (const p of poster) expect(urls.has(p.match(/<Referens>([^<]+)<\/Referens>/)[1])).toBe(true);
    // METS.xml beskriver indexet som beskrivande metadata med kontrollsumma, och dokumentationen har mappningen.
    const mets = filer.get(`${rot}METS.xml`).data.toString('utf8');
    expect(mets).toMatch(/<dmdSec [^>]*><mdRef [^>]*xlink:href="metadata\/descriptive\/earkiv-index.xml"[^>]*CHECKSUM="[0-9A-F]{64}"/);
    const dok = filer.get(`${rot}documentation/beskrivning.md`).data.toString('utf8');
    expect(dok).toContain('## Mappning mot e-arkivets dataelement');
    for (const d of earkiv.DATAELEMENT) expect(dok).toContain(`| ${d.namn} |`);
    expect(earkiv.mottagningskontroll(paket)).toMatchObject({ fel: [], handlingar: antal });
  });

  test('leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen', async () => {
    const k = klient(app);
    await k.logga('ark');
    const b = (await beslut(k, { typ: 'leverans', omfattning: 'alla' })).data;
    const r = await k.post(`/api/arkiv/beslut/${b.id}/leverera`, {});
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'kvitterat', orsak: null, mottagare: 'Simulerat e-arkiv (demo)', kontroll: { fel: [] } });
    expect(r.data.kontroll.handlingar).toBeGreaterThan(100);
    expect(r.data.beslut.exporter[0].leverans).toMatchObject({ status: 'kvitterat', mottagare: 'Simulerat e-arkiv (demo)' });
    const db = sandlada(app, k).db;
    const rad = db.query('SELECT * FROM signerade_meddelanden WHERE id = ?').get(r.data.bevis);
    expect(rad).toMatchObject({ riktning: 'ut', typ: 'earkiv', motpart: 'earkiv', kalla: `arkivexporter:${r.data.paket}` });
    expect(JSON.parse(rad.kvittens).huvud).toMatchObject({ avsandare: 'earkiv', resultat: 'mottaget' });
    // Beviset kontrolleras mot exporten som den är sparad.
    expect((await k.get(`/api/arkiv/leverans/${r.data.bevis}/kontroll`)).data).toMatchObject({ hel: true });
    // Leveransen loggas, och bara arkivarien levererar.
    expect(db.query("SELECT * FROM atkomstlogg WHERE resurs LIKE ? ORDER BY id DESC").get(`%${r.data.paket}:leverans`)).toMatchObject({ handling: 'arkivera', grund: 'arkivbeslut', personal_id: 'ark' });
    await k.logga('lak-kard');
    expect((await k.post(`/api/arkiv/beslut/${b.id}/leverera`, {})).status).toBe(403);
  });

  test('ett paket som ändras på vägen eller saknar en fil avvisas av mottagningskontrollen med orsaken', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    const b = arkiv.hamtaBeslut(db, (await beslut(k, { typ: 'leverans', patientId: 'p02' })).data.id);
    const { paket, objid } = arkiv.exportera(db, pers(db, 'ark'), b);
    // En byte ändras på vägen.
    const andrad = earkiv.leverera(db, { objid, paket, paketPaVagen: (p) => { const x = Buffer.from(p); x[x.length - 200] ^= 1; return x; } });
    expect(andrad.status).toBe('avvisat');
    expect(andrad.orsak).toContain('Paketet stämmer inte med det signerade manifestet.');
    // Ett paket utan journalfilen: manifestet stämmer, men mottagningskontrollen hittar felet.
    const filer = packaUpp(paket);
    const utan = zip([...filer].filter(([n]) => !n.endsWith('/p02.json')).map(([namn, f]) => (namn.endsWith('/') ? { namn } : { namn, data: f.data })));
    const saknas = earkiv.leverera(db, { objid, paket: utan });
    expect(saknas.status).toBe('avvisat');
    expect(saknas.orsak).toContain('Filen representations/rep_1/data/journal/(fil för en patient) finns i METS.xml men inte i paketet.');
    // Felen bär inte patientens id.
    expect(JSON.stringify(saknas)).not.toContain('p02');
    expect(saknas.kontroll.fel).toContain('Journalhandling 1 i indexet pekar på en fil som inte finns.');
  });

  test('journalhandlingar och åtkomstloggen ligger skilda åt, och indexet tar bara med journalhandlingarna', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    const b = arkiv.hamtaBeslut(db, (await beslut(k, { typ: 'leverans', patientId: 'p01' })).data.id);
    const { paket, objid } = arkiv.exportera(db, pers(db, 'ark'), b);
    const filer = packaUpp(paket);
    expect(filer.has(`${objid}/representations/rep_1/data/ovrigt/p01-atkomstlogg.ndjson`)).toBe(true);
    const idx = filer.get(`${objid}/metadata/descriptive/earkiv-index.xml`).data.toString('utf8');
    expect(idx).not.toContain('atkomstlogg');
    expect(idx).not.toContain('ovrigt/');
    expect([...idx.matchAll(/<Fil>([^<]+)<\/Fil>/g)].every(m => m[1] === 'representations/rep_1/data/journal/p01.json')).toBe(true);
  });
});

describe('Gallringsregler', () => {
  const beslut = (k, data) => k.post('/api/arkiv/beslut', { diarienummer: 'DEMO-2026-0110', beslutsdatum: '2026-11-01', ...data });
  const arSedan = (ar) => new Date(Date.now() - ar * 365.25 * 86400_000).toISOString();
  // Systemförvaltarna ändrar en regel med fyra ögon, som på sidan Regler och parametrar.
  const andraRegel = (db, nyckel, varde) => {
    const { andring } = konfiguration.foresla(db, pers(db, 'sysf'), { nyckel, varde, giltigFran: datumAv(new Date()), motivering: 'Regionens gallringsbeslut.' });
    konfiguration.godkann(db, pers(db, 'sysf-2'), andring.id, {});
  };

  test('reglerna per informationsmängd är parametrar med lagens lägsta gräns, som systemförvaltaren ändrar med fyra ögon, och arkivarien ser dem', async () => {
    const p = konfiguration.parametrar();
    expect(p['arkiv.gallring_matvarden_ar'].standard).toBe(arkiv.GALLRING_MATVARDEN_AR);
    expect(p['arkiv.gallring_kallelser_ar'].standard).toBe(arkiv.GALLRING_KALLELSER_AR);
    expect(konfiguration.prova('arkiv.gallring_matvarden_ar', 5).varfor).toContain('patientdatalagen 3 kap. 17 §');
    expect(konfiguration.prova('arkiv.gallring_kallelser_ar', 0).ok).toBe(false);
    expect(konfiguration.prova('arkiv.gallring_matvarden_ar', 20)).toEqual({ ok: true, varde: 20 });
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    const fore = (await k.get('/api/arkiv/typer')).data.gallringsregler;
    expect(fore.map(r => [r.mangd, r.ar])).toEqual([['journal', 10], ['matvarden', 100], ['kallelser', 2]]);
    andraRegel(db, 'arkiv.gallring_matvarden_ar', 20);
    expect((await k.get('/api/arkiv/typer')).data.gallringsregler.find(r => r.mangd === 'matvarden').ar).toBe(20);
    // Beslutet tar med reglerna som de gäller när det registreras.
    const b = (await beslut(k, { typ: 'gallring' })).data;
    expect(b.omfattning.delar.map(d => [d.mangd, d.ar])).toEqual([['matvarden', 20], ['kallelser', 2]]);
    andraRegel(db, 'arkiv.gallring_matvarden_ar', 30);
    expect(arkiv.hamtaBeslut(db, b.id).omfattning).toContain('"ar":20');
  });

  test('ett gallringsbeslut gallrar mätvärden och kallelser som är äldre än regeln i journaler som finns kvar, och resten av journalen är orörd', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    andraRegel(db, 'arkiv.gallring_matvarden_ar', 20);
    andraRegel(db, 'arkiv.gallring_kallelser_ar', 1);
    const ins = (tid) => Number(db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES ('p01', 'uso-kard', 'vikt', '80', 80, 'kg', ?, 'vardkallan')").run(tid).lastInsertRowid);
    const gammal = ins(arSedan(30));
    const ny = ins(arSedan(5));
    const bokning = db.query("SELECT id FROM bokningar WHERE patient_id = 'p01' LIMIT 1").get()?.id ?? 1;
    const kallelse = Number(db.query("INSERT INTO kallelser (bokning_id, patient_id, typ, kanal, text, status, skapad, skickad) VALUES (?, 'p01', 'kallelse', 'brev', 'Välkommen.', 'skickad', ?, ?)").run(bokning, arSedan(2), arSedan(2)).lastInsertRowid);
    const fore = Object.fromEntries(['anteckningar', 'diagnoser', 'ordinationer', 'vardkontakter'].map(t => [t, db.query(`SELECT count(*) AS n FROM ${t} WHERE patient_id = 'p01'`).get().n]));
    const b = (await beslut(k, { typ: 'gallring' })).data;
    const u = (await k.get(`/api/arkiv/beslut/${b.id}/underlag`)).data;
    // Hela journaler som förut, och delar av andra journaler per informationsmängd.
    expect(u.patienter.map(p => p.id)).not.toContain('p01');
    const mv = u.delar.find(d => d.mangd === 'matvarden');
    expect(mv).toMatchObject({ text: 'Mätvärden', ar: 20 });
    expect(mv.patienter.find(p => p.id === 'p01').antal).toBeGreaterThanOrEqual(1);
    expect(u.delar.find(d => d.mangd === 'kallelser').patienter.some(p => p.id === 'p01')).toBe(true);
    const v = await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {});
    expect(v.status).toBe(200);
    expect(v.data.resultat.delar.rader.matvarden).toBeGreaterThanOrEqual(1);
    expect(db.query('SELECT id FROM matvarden WHERE id = ?').get(gammal)).toBeNull();
    expect(db.query('SELECT id FROM matvarden WHERE id = ?').get(ny)).toMatchObject({ id: ny });
    expect(db.query('SELECT id FROM kallelser WHERE id = ?').get(kallelse)).toBeNull();
    for (const [t, n] of Object.entries(fore)) expect(db.query(`SELECT count(*) AS c FROM ${t} WHERE patient_id = 'p01'`).get().c).toBe(n);
    expect(db.query("SELECT journal_forstord FROM patienter WHERE id = 'p01'").get().journal_forstord).toBeNull();
    // Triggrarna är tillbaka.
    expect(() => db.query('DELETE FROM kallelser WHERE patient_id = ?').run('p01')).toThrow();
  });

  test('gallringen av delar loggas per journal utan innehåll, åtkomstloggen är hel och beslutet kan bara verkställas en gång', async () => {
    const k = klient(app);
    await k.logga('ark');
    const db = sandlada(app, k).db;
    andraRegel(db, 'arkiv.gallring_matvarden_ar', 20);
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES ('p02', 'uso-kard', 'vikt', '71', 71, 'kg', ?, 'vardkallan')").run(arSedan(25));
    const b = (await beslut(k, { typ: 'gallring' })).data;
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(200);
    const rad = db.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p02' AND handling = 'gallra' ORDER BY id DESC").get();
    expect(rad).toMatchObject({ grund: 'arkivbeslut', resurs: `beslut:${b.id}:delar`, personal_id: 'ark' });
    expect(rad.syfte).toContain('1 mätvärde äldre än 20 år');
    expect(rad.syfte).not.toContain('71');
    expect(logg.verifiera(db).hel).toBe(true);
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(400);
    // Bara arkivarien ser reglerna och verkställer.
    await k.logga('lak-kard');
    expect((await k.get('/api/arkiv/typer')).status).toBe(403);
  });
});

describe('Miljöer', () => {
  // Öppnar adressen till miljön och ger den nya sessionens kaka och id.
  // Länken öppnas i webbläsaren som skapade miljön, med produktionsmiljöns kaka.
  async function oppna(adress, prodKaka) {
    const r = await fetch(`${app.url}${adress}`, { redirect: 'manual', headers: prodKaka ? { Cookie: prodKaka } : {} });
    expect(r.status).toBe(302);
    const kaka = r.headers.get('set-cookie').split(';')[0];
    return { kaka, sid: kaka.split('=')[1] };
  }
  const medKaka = (kaka, vag, init = {}) => fetch(`${app.url}${vag}`, { ...init, headers: { Cookie: kaka, ...(init.headers ?? {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });

  test('systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const prod = sandlada(app, k).db;
    const patienter = prod.query('SELECT * FROM patienter').all();
    const r = await k.post('/api/miljoer', { typ: 'acceptanstest' });
    expect(r.status).toBe(201);
    expect(r.data.miljo).toMatchObject({ typ: 'acceptanstest', text: 'Acceptanstestmiljö' });
    const { sid, kaka } = await oppna(r.data.adress, k.kaka());
    const env = app.sessioner.get(sid).db;
    // Skarpa data: journalens innehåll är detsamma.
    for (const t of ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'vardkontakter', 'remisser']) {
      expect(env.query(`SELECT count(*) AS n FROM ${t}`).get().n).toBe(prod.query(`SELECT count(*) AS n FROM ${t}`).get().n);
    }
    expect(env.query("SELECT kod FROM diagnoser WHERE patient_id = 'p01' ORDER BY id").all()).toEqual(prod.query("SELECT kod FROM diagnoser WHERE patient_id = 'p01' ORDER BY id").all());
    // Avidentifierat: inga namn, personnummer, adresser eller telefonnummer finns kvar någonstans i patienternas rader.
    const nya = env.query('SELECT * FROM patienter').all();
    expect(nya).toHaveLength(patienter.length);
    expect(nya.every(p => p.fornamn === 'Patient' && /^P\d{3}$/.test(p.efternamn) && p.adress === null && p.telefon === null && p.kontaktperson === null)).toBe(true);
    const tillatna = new Set(TESTPERSONNUMMER);
    expect(nya.every(p => tillatna.has(p.personnummer))).toBe(true);
    const gamlaPnr = new Set(patienter.map(p => p.personnummer));
    expect(nya.some(p => gamlaPnr.has(p.personnummer))).toBe(false);
    const allt = env.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name)
      .filter(t => env.query(`PRAGMA table_info("${t}")`).all().some(c => c.name === 'patient_id') || ['patienter', 'invanare'].includes(t))
      .map(t => JSON.stringify(env.query(`SELECT * FROM "${t}"`).all())).join('\n');
    for (const p of patienter) {
      expect(allt).not.toContain(p.personnummer);
      expect(allt).not.toContain(`${p.personnummer.slice(0, 8)}-${p.personnummer.slice(8)}`);
      expect(allt).not.toContain(`${p.fornamn} ${p.efternamn}`);
      if (p.adress) expect(allt).not.toContain(p.adress);
    }
    // Skyddad identitet följer med som markering, och loggarna börjar om i miljön.
    expect(env.query('SELECT count(*) AS n FROM patienter WHERE skyddad = 1').get().n).toBe(prod.query('SELECT count(*) AS n FROM patienter WHERE skyddad = 1').get().n);
    expect(env.query('SELECT count(*) AS n FROM atkomstlogg').get().n).toBe(0);
    // Produktionsmiljön är oförändrad.
    expect(prod.query('SELECT * FROM patienter').all()).toEqual(patienter);
    // Miljön fungerar: en läkare loggar in i miljön.
    expect((await medKaka(kaka, '/api/login', { method: 'POST', body: JSON.stringify({ personalId: 'lak-kard' }) })).status).toBe(200);
    expect([...app.sessioner.values()].some(x => x.db === env && x.personalId === 'lak-kard')).toBe(true);
  });

  test('utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const prod = sandlada(app, k).db;
    const { andring } = konfiguration.foresla(prod, pers(prod, 'sysf'), { nyckel: 'logg.stickprov_antal', varde: 25, giltigFran: datumAv(new Date()), motivering: 'Större urval.' });
    konfiguration.godkann(prod, pers(prod, 'sysf-2'), andring.id, {});
    // En patient som bara finns så i produktionen.
    prod.query("UPDATE patienter SET fornamn = 'Endast', efternamn = 'Produktion' WHERE id = 'p02'").run();
    for (const typ of ['utbildning', 'test']) {
      const r = await k.post('/api/miljoer', { typ });
      expect(r.status).toBe(201);
      const { sid } = await oppna(r.data.adress, k.kaka());
      const env = app.sessioner.get(sid).db;
      expect(konfiguration.varde(env, 'logg.stickprov_antal')).toBe(25);
      expect(r.data.resultat.kopierade).toContain('konfig_andringar');
      // Fiktiva data: demons påhittade patienter, inte produktionens.
      expect(env.query("SELECT efternamn FROM patienter WHERE id = 'p02'").get().efternamn).not.toBe('Produktion');
      expect(env.query("SELECT personnummer FROM patienter WHERE id = 'p01'").get().personnummer).toBe(nyDb().query("SELECT personnummer FROM patienter WHERE id = 'p01'").get().personnummer);
      expect(miljoer.miljoFor(env)).toMatchObject({ typ, text: miljoer.MILJOER[typ].text });
    }
  });

  test('miljön är märkt i varje svar om sessionen och går inte att återställa, och det går att gå tillbaka till produktionsmiljön', async () => {
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.get('/api/session')).data.miljo).toMatchObject({ typ: 'produktion' });
    const r = await k.post('/api/miljoer', { typ: 'test' });
    const { kaka } = await oppna(r.data.adress, k.kaka());
    const s = await (await medKaka(kaka, '/api/session')).json();
    expect(s).toMatchObject({ inloggad: false, miljo: { typ: 'test', text: 'Testmiljö', kort: 'Test' } });
    // Länken gäller en gång, och bara i webbläsaren som skapade miljön.
    expect((await fetch(`${app.url}${r.data.adress}`, { redirect: 'manual', headers: { Cookie: k.kaka() } })).status).toBe(410);
    const r2 = await k.post('/api/miljoer', { typ: 'utbildning' });
    const annan = await fetch(`${app.url}${r2.data.adress}`, { redirect: 'manual' });
    expect(annan.status).toBe(403);
    expect(annan.headers.get('set-cookie')).toBeNull();
    expect((await fetch(`${app.url}${r2.data.adress}`, { redirect: 'manual', headers: { Cookie: (await nySession()).kaka() } })).status).toBe(403);
    expect((await fetch(`${app.url}${r2.data.adress}`, { redirect: 'manual', headers: { Cookie: k.kaka() } })).status).toBe(302);
    expect((await medKaka(kaka, '/api/reset', { method: 'POST', body: '{}' })).status).toBe(400);
    // Tillbaka till produktionsmiljön: sessionskakan byts till produktionens.
    const t = await medKaka(kaka, '/api/miljoer/tillbaka', { method: 'POST', body: '{}' });
    expect(t.status).toBe(200);
    const tillbaka = t.headers.get('set-cookie').split(';')[0];
    expect(tillbaka).toBe(k.kaka());
    expect((await (await medKaka(tillbaka, '/api/session')).json()).miljo.typ).toBe('produktion');
  });

  test('bara systemförvaltaren skapar miljöer, högst tre per sandlåda och inte ur en annan miljö', async () => {
    const l = klient(app);
    await l.logga('lak-kard');
    expect((await l.post('/api/miljoer', { typ: 'test' })).status).toBe(403);
    const k = klient(app);
    await k.logga('sysf');
    expect((await k.post('/api/miljoer', { typ: 'produktion' })).status).toBe(400);
    expect((await k.post('/api/miljoer', { typ: 'constructor' })).status).toBe(400);
    const r = await k.post('/api/miljoer', { typ: 'test' });
    await k.post('/api/miljoer', { typ: 'utbildning' });
    await k.post('/api/miljoer', { typ: 'test' });
    const fjarde = await k.post('/api/miljoer', { typ: 'test' });
    expect(fjarde.status).toBe(429);
    expect(fjarde.data.fel).toContain('redan 3 miljöer');
    expect((await k.get('/api/miljoer')).data.skapade).toHaveLength(3);
    // I en miljö skapas inga nya miljöer.
    const { kaka } = await oppna(r.data.adress, k.kaka());
    const inne = await medKaka(kaka, '/api/login', { method: 'POST', body: JSON.stringify({ personalId: 'sysf' }) });
    const nyKaka = inne.headers.get('set-cookie')?.split(';')[0] ?? kaka;
    const iMiljo = await medKaka(nyKaka, '/api/miljoer', { method: 'POST', body: JSON.stringify({ typ: 'test' }) });
    expect(iMiljo.status).toBe(400);
  });
});

describe('Säkerhetsarkitektur', () => {
  test('hotmodellen har yttre och inre hot, och varje hot pekar på en kontroll, en princip och tester', () => {
    expect(hotmodell.HOT.filter(h => h.slag === 'yttre').length).toBeGreaterThanOrEqual(5);
    expect(hotmodell.HOT.filter(h => h.slag === 'inre').length).toBeGreaterThanOrEqual(5);
    expect(new Set(hotmodell.HOT.map(h => h.id)).size).toBe(hotmodell.HOT.length);
    for (const h of hotmodell.HOT) {
      expect(['yttre', 'inre']).toContain(h.slag);
      expect(h.hot.length).toBeGreaterThan(20);
      expect(h.kontroll.length).toBeGreaterThan(20);
      expect(h.principer.length).toBeGreaterThan(0);
      for (const p of h.principer) expect(Object.keys(hotmodell.PRINCIPER)).toContain(p);
      expect(h.tester.length).toBeGreaterThan(0);
      // Testnamnen har formen Grupp > test, som i resten av registret.
      for (const t of h.tester) expect(t).toMatch(/^[^>]+ > .+/);
    }
    // Hotmodellens tester är mappade på posten, så att bygget prövar dem.
    const post = sussaRegister().poster.find(p => p.id === '5.3.1.18');
    for (const t of hotmodell.HOTMODELL_TESTER) expect(post.tester.map(x => x.namn)).toContain(t);
  });

  test('varje princip i Sussas kravtext möts av minst ett hot i hotmodellen', () => {
    const krav = kravspec.poster.find(p => p.id === '5.3.1.18');
    const principer = Object.values(hotmodell.PRINCIPER);
    for (const m of krav.mervarden) expect(principer.some(p => m.startsWith(p))).toBe(true);
    for (const k of Object.keys(hotmodell.PRINCIPER)) expect(hotmodell.HOT.some(h => h.principer.includes(k))).toBe(true);
  });
});

describe('Nyheter i runda 9, r5', () => {
  test('nyheterna om inloggningen, miljöerna, certifikaten, e-arkivet, gallringen och skyddsbehovet går till rätt roller', async () => {
    const k = klient(app);
    const ids = async (roll) => { await k.logga(roll); const r = (await k.get('/api/nyheter')).data; return r.alla.find(v => v.version === r.version)?.nyheter.map(n => n.id) ?? []; };
    expect(await ids('sysf')).toEqual(expect.arrayContaining(['inloggning-uppdrag', 'miljoer', 'certifikat', 'gallringsregler']));
    expect(await ids('ark')).toEqual(expect.arrayContaining(['inloggning-uppdrag', 'earkiv-leverans', 'gallringsregler']));
    expect(await ids('logg')).toEqual(expect.arrayContaining(['inloggning-uppdrag', 'skyddsbehov-logg']));
    const lak = await ids('lak-kard');
    expect(lak).toContain('inloggning-uppdrag');
    for (const id of ['miljoer', 'certifikat', 'earkiv-leverans', 'gallringsregler', 'skyddsbehov-logg']) expect(lak).not.toContain(id);
    // Invånaren får ingen av dem.
    const i = klient(app);
    await i.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const inv = (await i.get('/api/nyheter')).data;
    const invIds = inv.alla.flatMap(v => v.nyheter.map(n => n.id));
    for (const id of ['inloggning-uppdrag', 'miljoer', 'certifikat', 'earkiv-leverans', 'gallringsregler', 'skyddsbehov-logg']) expect(invIds).not.toContain(id);
  });
});

// Ett serienummer vars första slumpade byte är 0 får inte kodas med en inledande nolla, eftersom DER kräver den kortaste
// formen och certifikatet då inte går att läsa. Det hände ungefär en gång på 128 och stoppade servern när den startade.
test('ett certifikat går att läsa också när serienumrets första slumpade byte är 0', () => {
  const serie = pki.nySerie(Buffer.alloc(12, 0));
  expect(serie[0]).toBeGreaterThan(0);
  expect(serie[0] & 0x80).toBe(0);
  const utf = pki.skapaUtfardare({ cn: 'Prov', o: 'Prov', serie });
  expect(utf.cert.serialNumber.length).toBe(24);
});
