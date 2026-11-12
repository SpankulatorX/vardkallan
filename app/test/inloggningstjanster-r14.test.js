// Runda 14, r1: inloggning genom beställarens inloggningstjänst (Sussa 5.2.1.1). Testnamnen används av mappningen i
// src/sussa/mappning/5.2.js. Testerna kör en lokal testutfärdare på en egen port (oidc-testutfardare.js) och
// övningstjänsten i samma server.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { testserver, sandlada } from './hjalp.js';
import { startaTestutfardare } from './oidc-testutfardare.js';
import * as tjanster from '../src/inloggningstjanster.js';
import * as jwt from '../src/oidc-jwt.js';
import * as idp from '../src/idp.js';

const HEMLIGHET = 'testhemlighet-som-aldrig-far-sparas';
process.env.VK_IDP_TEST = HEMLIGHET;

let app, op, op2;
beforeAll(() => {
  op = startaTestutfardare({ hemlighet: HEMLIGHET });
  op2 = startaTestutfardare({ klientId: 'vardkallan-intyg', rpJwk: tjanster.rpPublik(), nyckeltyp: 'rsa' });
  app = testserver({ inloggningTillatna: `${op.url},${op2.url}` });
});
afterAll(() => { app.stopp(); op.stopp(); op2.stopp(); });

// En klient som håller sessionskakan också genom omdirigeringar.
function webblasare() {
  let kaka = null;
  const ta = (r) => { const sc = r.headers.get('set-cookie'); if (sc) kaka = sc.split(';')[0]; return r; };
  const anrop = async (metod, vag, kropp) => {
    const h = { ...(kaka ? { Cookie: kaka } : {}), ...(kropp !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const r = ta(await fetch(app.url + vag, { method: metod, headers: h, body: kropp !== undefined ? JSON.stringify(kropp) : undefined, redirect: 'manual' }));
    const typ = r.headers.get('content-type') || '';
    return { status: r.status, data: typ.includes('json') ? await r.json() : await r.text(), headers: r.headers };
  };
  const b = {
    get: (v) => anrop('GET', v), post: (v, k = {}) => anrop('POST', v, k), kaka: () => kaka,
    // En navigering till en hel adress, med kakan, utan att följa omdirigeringen.
    hamta: async (adress) => ta(await fetch(adress, { headers: kaka ? { Cookie: kaka } : {}, redirect: 'manual' })),
    async som(id) { await anrop('POST', '/api/logout', {}); const r = await anrop('POST', '/api/login', { personalId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return r; },
    // Följer inloggningen genom tjänsten: Vårdkällan, tjänsten och tillbaka. Ger resultatet som resultatsidan läser.
    async extern(tjanstId, { innan = null } = {}) {
      const r1 = ta(await fetch(`${app.url}/api/inloggning/extern/${tjanstId}`, { headers: kaka ? { Cookie: kaka } : {}, redirect: 'manual' }));
      const till = r1.headers.get('location');
      if (!/^https?:/.test(till)) return { steg: 'start', ...(await anrop('GET', '/api/inloggning/resultat')).data.resultat };
      const r2 = await fetch(till, { redirect: 'manual' });
      let svar = r2.headers.get('location');
      if (innan) svar = innan(svar);
      const r3 = ta(await fetch(svar, { headers: kaka ? { Cookie: kaka } : {}, redirect: 'manual' }));
      expect(r3.status).toBe(302);
      expect(r3.headers.get('location')).toBe('/#/inloggning/extern');
      return { svar, ...(await anrop('GET', '/api/inloggning/resultat')).data.resultat };
    },
  };
  return b;
}
const db = (b) => sandlada(app, b).db;
const pers = (d, id) => d.query('SELECT * FROM personal WHERE id = ?').get(id);
const sakerhet = (b) => db(b).query('SELECT * FROM sakerhetslogg ORDER BY id').all();
// Attributen för personen enligt Ineras attributspecifikation, ur masterdata.
function attributFor(d, id) {
  const p = pers(d, id);
  const u = idp.uppdragFor(d, p);
  return { employeeHsaId: p.hsa_id, given_name: p.namn.split(' ')[0], family_name: p.namn.split(' ').slice(1).join(' '), commissionHsaId: u.commissionHsaId,
    commissionPurpose: u.commissionPurpose, healthCareUnitHsaId: u.healthCareUnitHsaId, healthCareProviderHsaId: u.healthCareProviderHsaId,
    ...({ lakare: { healthcareProfessionalLicense: ['LK'] }, sjukskoterska: { healthcareProfessionalLicense: ['SJ'] } }[p.yrke] ?? {}) };
}

// Kopplar in testutfärdaren i sandlådan med fyra ögon och ger tjänstens id.
async function kopplaIn(b, { utf = op, klientautentisering = 'client_secret_basic' } = {}) {
  await b.som('sysf');
  const r = await b.post('/api/inloggningstjanster', { namn: 'Regionens inloggningstjänst (test)', utfardare: utf.iss, klientId: utf.klientId, klientautentisering,
    ...(klientautentisering === 'client_secret_basic' ? { hemlighetMiljo: 'VK_IDP_TEST' } : {}), motivering: 'Regionen ska logga in med sin egen inloggningstjänst.' });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  await b.som('sysf-2');
  const g = await b.post(`/api/inloggningstjanster/andring/${r.data.andring.id}/godkann`, {});
  if (g.status !== 200) throw new Error(JSON.stringify(g.data));
  await b.post('/api/logout', {});
  return r.data.andring.tjanst;
}

describe('Inloggningstjänst (5.2.1.1)', () => {
  test('en extern inloggningstjänst kopplas in med fyra ögon, och nycklarna pinnas med tumavtryck', async () => {
    const b = webblasare();
    await b.som('sysf');
    // Vårdgivaren tas ur systemförvaltarens plats i katalogen, aldrig ur anropet.
    const f = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Regionens inloggningstjänst', utfardare: op.iss, klientId: op.klientId, klientautentisering: 'client_secret_basic', hemlighetMiljo: 'VK_IDP_TEST', vardgivareHsaId: 'DEMO-KOMMUN-0001' });
    expect(f.data.ok).toBe(true);
    expect(f.data.konfiguration).toMatchObject({ utfardare: op.iss, tokenEndpoint: `${op.iss}/token`, protokoll: 'oidc', vardgivareHsaId: 'SE2321000164-VK0000', hemlighetFinns: true });
    expect(f.data.konfiguration.nycklar[0].tumavtryck).toBe(jwt.tumavtryck(op.nycklar[0].jwk));
    const r = await b.post('/api/inloggningstjanster', { namn: 'Regionens inloggningstjänst', utfardare: op.iss, klientId: op.klientId, klientautentisering: 'client_secret_basic', hemlighetMiljo: 'VK_IDP_TEST', motivering: 'Inloggning med regionens tjänst.' });
    expect(r.status).toBe(201);
    // Den som föreslog kan inte godkänna, och inget gäller ännu.
    expect((await b.post(`/api/inloggningstjanster/andring/${r.data.andring.id}/godkann`, {})).status).toBe(403);
    expect((await b.get('/api/inloggning/tjanster')).data.tjanster).toEqual([]);
    await b.som('sysf-2');
    const o = await b.get('/api/inloggningstjanster');
    expect(o.data.attGodkanna.map(a => a.id)).toContain(r.data.andring.id);
    expect(o.data.attGodkanna[0].nycklar[0].tumavtryck).toBe(jwt.tumavtryck(op.nycklar[0].jwk));
    expect((await b.post(`/api/inloggningstjanster/andring/${r.data.andring.id}/godkann`, {})).status).toBe(200);
    expect((await b.get('/api/inloggning/tjanster')).data.tjanster).toEqual([{ id: r.data.andring.tjanst, namn: 'Regionens inloggningstjänst', simulerad: false }]);
    expect(sakerhet(b).at(-1)).toMatchObject({ typ: 'andrad_installning', personal_id: 'sysf-2' });
    expect(sakerhet(b).at(-1).beskrivning).toContain('Ny inloggningstjänst: Regionens inloggningstjänst, föreslagen av Tomas Lindh och godkänd av Nora Ekholm.');
  });

  test('servern anropar bara inloggningstjänster som driften har godkänt', async () => {
    const b = webblasare();
    await b.som('sysf');
    const r = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Någon annans tjänst', utfardare: 'http://127.0.0.1:1/oidc', klientId: 'x' });
    expect(r.data.ok).toBe(false);
    expect(r.data.varfor).toContain('finns inte bland de inloggningstjänster som driften har godkänt');
    // Metadata som pekar ut en annan adress för biljetten stoppas också, också när den klistras in.
    const m = { issuer: op.iss, authorization_endpoint: `${op.iss}/authorize`, token_endpoint: 'http://169.254.169.254/token', jwks_uri: `${op.iss}/jwks` };
    const r2 = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Tjänst', utfardare: op.iss, klientId: 'x', metadata: JSON.stringify(m), jwks: JSON.stringify({ keys: [op.nycklar[0].jwk] }) });
    expect(r2.data.ok).toBe(false);
    expect(r2.data.varfor).toContain('Adressen för biljetten (token_endpoint) (http://169.254.169.254)');
    // En annan utfärdare i metadata än den som skrevs in.
    const r3 = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Tjänst', utfardare: op.iss, klientId: 'x', metadata: JSON.stringify({ ...m, token_endpoint: `${op.iss}/token`, issuer: 'https://annan.example' }), jwks: JSON.stringify({ keys: [op.nycklar[0].jwk] }) });
    expect(r3.data.varfor).toContain('ska vara exakt lika');
  });

  test('nycklar med privata delar, symmetriska nycklar och för korta RSA-nycklar godtas inte', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    expect(jwt.provaNyckel(ec.privateKey.export({ format: 'jwk' })).varfor).toContain('privata delar');
    expect(jwt.provaNyckel({ kty: 'oct', k: 'aGVtbGlnaGV0' }).varfor).toContain('privata delar');
    expect(jwt.provaNyckel({ kty: 'oct' }).varfor).toContain('asymmetrisk');
    const kort = generateKeyPairSync('rsa', { modulusLength: 1024 });
    expect(jwt.provaNyckel(kort.publicKey.export({ format: 'jwk' })).varfor).toContain('2048 bitar');
    expect(jwt.provaNyckel({ ...ec.publicKey.export({ format: 'jwk' }), use: 'enc' }).varfor).toContain('signering');
    expect(jwt.provaNyckel({ ...ec.publicKey.export({ format: 'jwk' }), alg: 'HS256' }).varfor).toContain('godtas inte');
    expect(jwt.provaNyckel(ec.publicKey.export({ format: 'jwk' })).ok).toBe(true);
  });

  test('inloggning med authorization code och PKCE ger åtkomst ur biljettens attribut, och personen väljer inget', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b);
    op.attribut = () => attributFor(db(b), 'lak-kard');
    op.manipulera = null;
    const r = await b.extern(id);
    expect(r).toMatchObject({ ok: true, tjanst: 'Regionens inloggningstjänst (test)' });
    const s = await b.get('/api/session');
    expect(s.data.personal.id).toBe('lak-kard');
    expect(s.data.uppdrag).toMatchObject({ utfardare: 'Regionens inloggningstjänst (test)', andamal: 'Vård och behandling', vardenhet: 'Kardiologiska kliniken USÖ', tillitsniva: 'http://id.sambi.se/loa/loa3' });
    expect(s.data.uppdrag.metod).toContain('authorization code och PKCE');
    // Bytet av koden gick med PKCE och klientens hemlighet ur miljön, och redirect_uri var Vårdkällans.
    const t = op.tokenanrop.at(-1);
    expect(t.falt).toMatchObject({ grant_type: 'authorization_code', redirect_uri: `${app.url}/api/inloggning/svar` });
    expect(t.falt.code_verifier.length).toBeGreaterThanOrEqual(43);
    expect(t.auth).toBe(`Basic ${Buffer.from(`${op.klientId}:${HEMLIGHET}`).toString('base64')}`);
    expect(sakerhet(b).at(-1)).toMatchObject({ typ: 'inloggning', personal_id: 'lak-kard', beskrivning: 'Inloggning genom Regionens inloggningstjänst (test) (OpenID Connect).' });
    // Behörigheten följer rollen ur masterdata: läkaren når journalen.
    expect((await b.get('/api/patienter?q=Lindqvist')).status).not.toBe(401);
  });

  test('klienten kan autentisera sig med ett signerat intyg (private_key_jwt), och tjänsten kan signera med RSA', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b, { utf: op2, klientautentisering: 'private_key_jwt' });
    op2.attribut = () => attributFor(db(b), 'ssk-kard');
    const r = await b.extern(id);
    expect(r.ok).toBe(true);
    expect((await b.get('/api/session')).data.personal.id).toBe('ssk-kard');
    const f = op2.tokenanrop.at(-1).falt;
    expect(f.client_assertion_type).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(jwt.verifiera(f.client_assertion, [tjanster.rpPublik()]).pastaende).toMatchObject({ iss: 'vardkallan-intyg', sub: 'vardkallan-intyg', aud: `${op2.iss}/token` });
  });

  test('en biljett med fel signatur, alg none, HS256 med den publika nyckeln, fel utfärdare, fel mottagare, fel nonce eller som har gått ut avvisas', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b);
    op.attribut = () => attributFor(db(b), 'lak-kard');
    const egen = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const nu = Math.floor(Date.now() / 1000);
    const fall = [
      ['signaturen stämmer inte', (h, p) => jwt.signera(h, p, egen)],
      ['algoritmen none godtas inte', (h, p) => `${b64({ ...h, alg: 'none' })}.${b64(p)}.`],
      ['algoritmen HS256 godtas inte', (h, p, n) => {
        const { createHmac } = require('node:crypto');
        const data = `${b64({ ...h, alg: 'HS256' })}.${b64(p)}`;
        return `${data}.${createHmac('sha256', JSON.stringify(n.jwk)).update(data).digest('base64url')}`;
      }],
      ['den är utfärdad av en annan tjänst', (h, p) => [h, { ...p, iss: 'https://annan.example' }]],
      ['den är utfärdad till en annan tjänst', (h, p) => [h, { ...p, aud: 'annan-klient' }]],
      ['den är utfärdad också till andra tjänster', (h, p) => [h, { ...p, aud: [op.klientId, 'annan-klient'] }]],
      ['den hör inte till den här inloggningen (nonce)', (h, p) => [h, { ...p, nonce: 'gammal' }]],
      ['den har gått ut', (h, p) => [h, { ...p, iat: nu - 400, exp: nu - 100 }]],
      ['den är utfärdad i framtiden', (h, p) => [h, { ...p, iat: nu + 3600, exp: nu + 3900 }]],
      ['tillitsnivån räcker inte', (h, p) => [h, { ...p, acr: 'http://id.sambi.se/loa/loa2' }]],
      ['huvudet hänvisar till en egen nyckel (jwk)', (h, p, n) => [{ ...h, jwk: n.jwk }, p]],
      ['nyckeln som biljetten är signerad med är inte inlagd', (h, p) => [{ ...h, kid: 'annan' }, p]],
    ];
    for (const [orsak, fn] of fall) {
      op.manipulera = fn;
      const r = await b.extern(id);
      expect({ orsak, ok: r.ok, text: r.text }).toMatchObject({ orsak, ok: false, text: expect.stringContaining(orsak) });
      expect((await b.get('/api/session')).data.personal).toBeFalsy();
      expect(sakerhet(b).at(-1)).toMatchObject({ typ: 'inloggning_misslyckad', vag: '/api/inloggning/svar' });
      expect(sakerhet(b).at(-1).beskrivning).toContain(orsak);
    }
    op.manipulera = null;
    expect((await b.extern(id)).ok).toBe(true);
  });

  test('state hör till sessionen och används en gång, och koden kan inte användas igen', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b);
    op.attribut = () => attributFor(db(b), 'lak-kard');
    op.manipulera = null;
    let svaret;
    expect((await b.extern(id, { innan: (s) => { svaret = s; return s; } })).ok).toBe(true);
    await b.post('/api/logout', {});
    // Samma svar en gång till: state är förbrukat.
    const r = await fetch(svaret, { headers: { Cookie: b.kaka() }, redirect: 'manual' });
    expect(r.status).toBe(302);
    expect((await b.get('/api/inloggning/resultat')).data.resultat.text).toContain('har redan använts eller har gått ut');
    // En annan webbläsare med samma svar (en angripare som vill logga in någon annan) får ingen inloggning.
    const annan = webblasare();
    await annan.get('/api/session');
    await fetch(svaret, { headers: { Cookie: annan.kaka() }, redirect: 'manual' });
    expect((await annan.get('/api/session')).data.personal).toBeFalsy();
    // Ett svar med ett påhittat state.
    const fel = new URL(svaret); fel.searchParams.set('state', 'pahittat');
    await fetch(fel, { headers: { Cookie: b.kaka() }, redirect: 'manual' });
    expect((await b.get('/api/session')).data.personal).toBeFalsy();
  });

  test('attribut som saknas eller motsäger masterdata ger ingen åtkomst, med orsaken på vanlig svenska', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b);
    op.manipulera = null;
    const d = db(b);
    const lak = attributFor(d, 'lak-kard');
    const akut = idp.uppdragFor(d, pers(d, 'lak-akut'));
    d.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES ('lak-slutat', 'Test Slutat', 'lakare', 'Läkare', 'uso-kard', 'SE2321000164-TEST01', 0, 0)").run();
    const fall = [
      ['annan vårdenhet än Kardiologiska kliniken USÖ', { ...lak, healthCareUnitHsaId: akut.healthCareUnitHsaId, commissionHsaId: idp.uppdragHsaId(lak.employeeHsaId, akut.healthCareUnitHsaId) }],
      ['Medarbetaruppdraget i biljetten finns inte i katalogen', { ...lak, commissionHsaId: 'SE2321000164-PAHITTAT' }],
      ['ändamålet Statistik', { ...lak, commissionPurpose: 'Statistik' }],
      ['saknar attributet commissionPurpose', { ...lak, commissionPurpose: undefined }],
      ['saknar attributet employeeHsaId', { ...lak, employeeHsaId: undefined }],
      ['saknar legitimationen som läkare', { ...lak, healthcareProfessionalLicense: ['SJ'] }],
      ['saknar legitimationen som läkare', { ...lak, healthcareProfessionalLicense: undefined }],
      ['en annan vårdgivare än den som inloggningstjänsten är inkopplad för', { ...lak, healthCareProviderHsaId: 'SE2321000164-ANNAN' }],
      ['Personen i biljetten finns inte i katalogen', { ...lak, employeeHsaId: 'SE2321000164-VKP999' }],
      ['finns inte som aktiv personal', { ...lak, employeeHsaId: 'SE2321000164-TEST01', commissionHsaId: idp.uppdragHsaId('SE2321000164-TEST01', lak.healthCareUnitHsaId) }],
      ['säger olika saker', { ...lak, healthcareUnitHsaId: akut.healthCareUnitHsaId }],
    ];
    for (const [orsak, a] of fall) {
      op.attribut = () => a;
      const r = await b.extern(id);
      expect({ orsak, ok: r.ok, text: r.text }).toMatchObject({ orsak, ok: false, text: expect.stringContaining(orsak) });
      expect((await b.get('/api/session')).data.personal).toBeFalsy();
    }
    // En roll utan legitimationskrav (undersköterskan) loggar in utan legitimation.
    op.attribut = () => attributFor(d, 'usk-kard');
    expect((await b.extern(id)).ok).toBe(true);
  });

  test('ett byte av nyckel kräver fyra ögon, och systemet föreslår bytet när tjänsten har bytt nyckel', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const extra = startaTestutfardare({ hemlighet: HEMLIGHET });
    // En egen server med den extra utfärdaren bland de godkända.
    const app2 = testserver({ inloggningTillatna: extra.url });
    try {
      const anropa = async (metod, vag, kropp, kaka) => {
        const r = await fetch(app2.url + vag, { method: metod, headers: { ...(kaka.v ? { Cookie: kaka.v } : {}), ...(kropp ? { 'Content-Type': 'application/json' } : {}) }, body: kropp ? JSON.stringify(kropp) : undefined, redirect: 'manual' });
        const sc = r.headers.get('set-cookie'); if (sc) kaka.v = sc.split(';')[0];
        return { status: r.status, data: (r.headers.get('content-type') || '').includes('json') ? await r.json() : null, headers: r.headers };
      };
      const k = { v: null };
      const som = async (id) => { await anropa('POST', '/api/logout', {}, k); await anropa('POST', '/api/login', { personalId: id }, k); };
      const loggaIn = async (tid) => {
        const r1 = await anropa('GET', `/api/inloggning/extern/${tid}`, null, k);
        const r2 = await fetch(r1.headers.get('location'), { redirect: 'manual' });
        await anropa('GET', r2.headers.get('location').replace(app2.url, ''), null, k);
        return (await anropa('GET', '/api/inloggning/resultat', null, k)).data.resultat;
      };
      await som('sysf');
      const f = await anropa('POST', '/api/inloggningstjanster', { namn: 'Regionens tjänst', utfardare: extra.iss, klientId: extra.klientId, klientautentisering: 'client_secret_basic', hemlighetMiljo: 'VK_IDP_TEST', motivering: 'Ny tjänst.' }, k);
      await som('sysf-2');
      await anropa('POST', `/api/inloggningstjanster/andring/${f.data.andring.id}/godkann`, {}, k);
      const tid = f.data.andring.tjanst;
      await anropa('POST', '/api/logout', {}, k);
      const d = app2.sessioner.get(k.v.split('=')[1]).db;
      extra.attribut = () => attributFor(d, 'lak-kard');
      expect((await loggaIn(tid)).ok).toBe(true);
      // Tjänsten byter nyckel. Inloggningen stängs tills den nya nyckeln är inlagd.
      extra.bytNyckel();
      await anropa('POST', '/api/logout', {}, k);
      expect((await loggaIn(tid)).text).toContain('nyckeln som biljetten är signerad med är inte inlagd');
      await som('sysf');
      const o = await anropa('GET', '/api/inloggningstjanster', null, k);
      expect(o.data.tjanster[0].nyckellage.andrad).toBe(true);
      const n = await anropa('POST', `/api/inloggningstjanster/${tid}/nycklar`, { motivering: 'Tjänsten har bytt nyckel.' }, k);
      expect(n.status).toBe(201);
      expect(n.data.andring.nycklar[0]).toMatchObject({ ny: true, tumavtryck: jwt.tumavtryck(extra.nycklar[0].jwk) });
      expect(n.data.andring.borttagnaNycklar).toHaveLength(1);
      expect((await anropa('POST', `/api/inloggningstjanster/andring/${n.data.andring.id}/godkann`, {}, k)).status).toBe(403);
      await anropa('POST', '/api/logout', {}, k);
      expect((await loggaIn(tid)).ok).toBe(false);
      await som('sysf-2');
      expect((await anropa('POST', `/api/inloggningstjanster/andring/${n.data.andring.id}/godkann`, {}, k)).status).toBe(200);
      await anropa('POST', '/api/logout', {}, k);
      expect((await loggaIn(tid)).ok).toBe(true);
    } finally { app2.stopp(); extra.stopp(); }
  }, 30_000);

  test('en avstängd tjänst går inte att logga in med, och den som är inloggad genom den loggas ut', async () => {
    const b = webblasare();
    await b.get('/api/session');
    const id = await kopplaIn(b);
    op.manipulera = null;
    op.attribut = () => attributFor(db(b), 'lak-kard');
    expect((await b.extern(id)).ok).toBe(true);
    // En annan webbläsare i samma sandlåda stänger av tjänsten med fyra ögon.
    const s = sandlada(app, b);
    const andra = webblasare();
    await andra.get('/api/session');
    sandlada(app, andra).db = s.db;
    await andra.som('sysf');
    const r = await andra.post(`/api/inloggningstjanster/${id}/aktiv`, { aktiv: false, motivering: 'Tjänsten ska bytas ut.' });
    expect(r.status).toBe(201);
    await andra.som('sysf-2');
    expect((await andra.post(`/api/inloggningstjanster/andring/${r.data.andring.id}/godkann`, {})).status).toBe(200);
    const nasta = await b.get('/api/inkorg');
    expect(nasta.status).toBe(401);
    expect(nasta.data.fel).toContain('Inloggningstjänsten som du loggade in med är avstängd.');
    expect((await b.get('/api/inloggning/tjanster')).data.tjanster).toEqual([]);
    expect((await b.extern(id)).text).toContain('finns inte eller är avstängd');
  });

  test('konfigurationen sparar inga hemligheter, bara namnet på miljövariabeln', async () => {
    const b = webblasare();
    await b.get('/api/session');
    await kopplaIn(b);
    const rader = JSON.stringify(db(b).query('SELECT * FROM inloggningstjanst_andringar').all());
    expect(rader).toContain('VK_IDP_TEST');
    expect(rader).not.toContain(HEMLIGHET);
    expect(rader).not.toContain('"d":');
    const o = await b.som('sysf').then(() => b.get('/api/inloggningstjanster'));
    expect(JSON.stringify(o.data)).not.toContain(HEMLIGHET);
    // Ett namn som inte börjar med VK_IDP_ godtas inte, så att ingen kan skicka andra delar av serverns miljö.
    const r = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Tjänst', utfardare: op.iss, klientId: op.klientId, klientautentisering: 'client_secret_basic', hemlighetMiljo: 'PATH' });
    expect(r.data.varfor).toContain('börjar med VK_IDP_');
  });

  test('en beslutad ändring av en inloggningstjänst ändras eller raderas inte, och bara systemförvaltningen kopplar in tjänster', async () => {
    const b = webblasare();
    await b.get('/api/session');
    await kopplaIn(b);
    const d = db(b);
    expect(() => d.query("UPDATE inloggningstjanst_andringar SET konfiguration = '{}'").run()).toThrow();
    expect(() => d.query('DELETE FROM inloggningstjanst_andringar').run()).toThrow();
    expect(() => d.query("INSERT INTO inloggningstjanst_andringar (tjanst, atgard, konfiguration, motivering, foreslagen_av, foreslagen, status, beslutad_av) VALUES ('t-00000000', 'ny', '{}', 'x', 'sysf', 'nu', 'godkand', 'sysf')").run()).toThrow();
    await b.som('lak-kard');
    expect((await b.get('/api/inloggningstjanster')).status).toBe(403);
    expect((await b.post('/api/inloggningstjanster', { ovning: true, motivering: 'x' })).status).toBe(403);
  });

  test('SAML avvisas med förklaringen att Ineras IdP också talar OpenID Connect', async () => {
    const b = webblasare();
    await b.som('sysf');
    const r = await b.post('/api/inloggningstjanster/forhandsvisa', { namn: 'Tjänst', utfardare: op.iss, klientId: op.klientId, protokoll: 'saml' });
    expect(r.data.varfor).toContain('SAML 2.0 stöds inte ännu');
  });

  test('övningstjänsten i demon: hela inloggningen, och en biljett med fel vårdenhet ger ingen åtkomst', async () => {
    const b = webblasare();
    await b.som('sysf');
    const f = await b.post('/api/inloggningstjanster/forhandsvisa', { ovning: true });
    expect(f.data.konfiguration).toMatchObject({ simulerad: true, namn: 'Övningstjänst för inloggning (simulerad)', klientautentisering: 'private_key_jwt' });
    const r = await b.post('/api/inloggningstjanster', { ovning: true, motivering: 'Prövar inloggningen genom en extern tjänst.' });
    await b.som('sysf-2');
    await b.post(`/api/inloggningstjanster/andring/${r.data.andring.id}/godkann`, {});
    await b.post('/api/logout', {});
    const loggaIn = async (variant, personalId = 'lak-kard') => {
      const r1 = await b.hamta(`${app.url}/api/inloggning/extern/${r.data.andring.tjanst}`);
      const auth = new URL(r1.headers.get('location'));
      expect(auth.pathname).toBe('/api/ovningstjanst/authorize');
      expect(auth.searchParams.get('code_challenge_method')).toBe('S256');
      const r2 = await b.hamta(auth.href);
      const sida = r2.headers.get('location');
      expect(sida).toMatch(/^\/#\/ovningstjanst\/[A-Za-z0-9_-]+$/);
      const bid = sida.split('/').pop();
      const be = await b.get(`/api/ovningstjanst/begaran/${bid}`);
      expect(be.data.simulerad).toContain('simulerad');
      // En annan webbläsare kan inte slutföra någon annans inloggning i övningstjänsten.
      const annan = webblasare();
      expect((await annan.post(`/api/ovningstjanst/begaran/${bid}`, { personalId, variant })).status).toBe(404);
      const sv = await b.post(`/api/ovningstjanst/begaran/${bid}`, { personalId, variant });
      expect((await b.hamta(sv.data.adress)).status).toBe(302);
      return (await b.get('/api/inloggning/resultat')).data.resultat;
    };
    expect(await loggaIn('ratt')).toMatchObject({ ok: true, tjanst: 'Övningstjänst för inloggning (simulerad)' });
    const s = await b.get('/api/session');
    expect(s.data.personal.id).toBe('lak-kard');
    expect(s.data.uppdrag.metod).toContain('Simulerad extern inloggningstjänst');
    await b.post('/api/logout', {});
    const fel = await loggaIn('annan_vardenhet');
    expect(fel.ok).toBe(false);
    expect(fel.text).toContain('annan vårdenhet än Kardiologiska kliniken USÖ');
    expect((await loggaIn('fel_andamal')).text).toContain('rollen kräver ett uppdrag för vård och behandling');
    expect((await loggaIn('saknar_legitimation')).text).toContain('saknar legitimationen som läkare');
    expect((await loggaIn('saknar_uppdrag')).text).toContain('saknar attributet commissionHsaId');
    expect((await loggaIn('okand_person')).text).toContain('finns inte i katalogen');
  });

  test('övningstjänsten ger koden en gång och kräver rätt PKCE och klientens intyg', async () => {
    const { token, authorize, svara, KLIENT_ID } = await import('../src/ovningstjanst-oidc.js');
    const b = webblasare();
    await b.get('/api/session');
    const s = sandlada(app, b);
    const bas = 'http://127.0.0.1:1';
    const verifier = 'v'.repeat(43);
    const ny = () => {
      const q = new URLSearchParams({ client_id: KLIENT_ID, redirect_uri: `${bas}/api/inloggning/svar`, response_type: 'code', scope: 'openid commission', state: 's1', nonce: 'n1',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
      const sida = authorize(s, q, bas);
      return new URL(svara(s, s.db, sida.split('/').pop(), { personalId: 'lak-kard', variant: 'ratt' }).adress).searchParams.get('code');
    };
    const falt = (kod, v = verifier) => ({ grant_type: 'authorization_code', code: kod, redirect_uri: `${bas}/api/inloggning/svar`, code_verifier: v, client_id: KLIENT_ID,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: 'inte.ett.intyg' });
    const kod = ny();
    expect(() => token(falt(kod, 'fel'.repeat(15)), { bas, rp: tjanster.rpPublik() })).toThrow('PKCE stämmer inte');
    // Koden förbrukades av det misslyckade försöket.
    expect(() => token(falt(kod), { bas, rp: tjanster.rpPublik() })).toThrow('redan använts');
    expect(() => token(falt(ny()), { bas, rp: tjanster.rpPublik() })).toThrow('klientens intyg stämmer inte');
    // En begäran utan PKCE eller med en annan redirect_uri tas inte emot.
    expect(() => authorize(s, new URLSearchParams({ client_id: KLIENT_ID, redirect_uri: `${bas}/api/inloggning/svar`, response_type: 'code', scope: 'openid', state: 's', nonce: 'n' }), bas)).toThrow('PKCE');
    expect(() => authorize(s, new URLSearchParams({ client_id: KLIENT_ID, redirect_uri: 'https://angripare.example/svar', response_type: 'code', scope: 'openid', state: 's', nonce: 'n', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' }), bas)).toThrow('inte registrerad');
  });
});
