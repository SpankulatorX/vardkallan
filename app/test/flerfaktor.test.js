// Runda 12, r3 (vårt L5): flerfaktorsinloggning med passkeys (WebAuthn) och engångskoder (TOTP, RFC 6238), för
// personalen och för invånaren i Min journal. Testnamnen används i kravregistret (krav.js).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import * as ff from '../src/flerfaktor.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const sha256 = (b) => createHash('sha256').update(b).digest();
const b64u = (b) => Buffer.from(b).toString('base64url');

// En liten CBOR-kodare för testets mjukvaruautentiserare.
function cborKoda(v) {
  const huvud = (typ, n) => {
    if (n < 24) return Buffer.from([(typ << 5) | n]);
    if (n < 256) return Buffer.from([(typ << 5) | 24, n]);
    const b = Buffer.alloc(3); b[0] = (typ << 5) | 25; b.writeUInt16BE(n, 1); return b;
  };
  if (typeof v === 'number') return v >= 0 ? huvud(0, v) : huvud(1, -1 - v);
  if (Buffer.isBuffer(v)) return Buffer.concat([huvud(2, v.length), v]);
  if (typeof v === 'string') { const b = Buffer.from(v); return Buffer.concat([huvud(3, b.length), b]); }
  if (v instanceof Map) return Buffer.concat([huvud(5, v.size), ...[...v].flatMap(([k, x]) => [cborKoda(k), cborKoda(x)])]);
  throw new Error('kan inte koda');
}

// En autentiserare i mjukvara: ett nyckelpar per passkey, en räknare och användarverifiering.
function autentiserare({ rpId = '127.0.0.1', ursprung = app.url } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credId = randomBytes(16);
  let raknare = 0;
  const ad = ({ flaggor, med = false }) => {
    const r = Buffer.alloc(4); r.writeUInt32BE(++raknare);
    const delar = [sha256(Buffer.from(rpId)), Buffer.from([flaggor]), r];
    if (med) {
      const cose = cborKoda(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
      const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
      delar.push(Buffer.alloc(16), len, credId, cose);
    }
    return Buffer.concat(delar);
  };
  return {
    credId,
    skapa(alt, { uv = true, origin = ursprung, typ = 'webauthn.create' } = {}) {
      const cd = Buffer.from(JSON.stringify({ type: typ, challenge: alt.challenge, origin }));
      const att = cborKoda(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad({ flaggor: 0x41 | (uv ? 0x04 : 0), med: true })]]));
      return { id: b64u(credId), rawId: b64u(credId), clientDataJSON: b64u(cd), attestationObject: b64u(att) };
    },
    hamta(alt, { uv = true, origin = ursprung, nyckel = privateKey, challenge = alt.challenge } = {}) {
      const cd = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
      const a = ad({ flaggor: 0x01 | (uv ? 0x04 : 0) });
      const sig = sign('sha256', Buffer.concat([a, sha256(cd)]), { key: nyckel, dsaEncoding: 'der' });
      return { id: b64u(credId), rawId: b64u(credId), clientDataJSON: b64u(cd), authenticatorData: b64u(a), signature: b64u(sig) };
    },
  };
}

async function medPasskey(roll = 'lak-kard') {
  const k = klient(app);
  await k.logga(roll);
  const aut = autentiserare();
  const alt = (await k.post('/api/flerfaktor/passkey/borja')).data;
  const r = await k.post('/api/flerfaktor/passkey', { namn: 'Min telefon', svar: aut.skapa(alt) });
  expect(r.status).toBe(201);
  await k.post('/api/logout');
  return { k, aut };
}

describe('Flerfaktor', () => {
  test('utan registrerad faktor loggar demorollen in som förut, och flerfaktor är av', async () => {
    const k = klient(app);
    const r = await k.logga('ssk-kard');
    expect(r.data.inloggad).toBe(true);
    expect(r.data.flerfaktor).toEqual({ aktiv: false, metod: null });
    const o = await k.get('/api/flerfaktor');
    expect(o.data.aktiv).toBe(false);
    expect(o.data.faktorer).toEqual([]);
    expect(o.data.text).toContain('Flerfaktor är av');
  });

  test('en passkey registreras med WebAuthn, och bara den publika nyckeln sparas', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const alt = (await k.post('/api/flerfaktor/passkey/borja')).data;
    expect(alt.rp.id).toBe('127.0.0.1');
    expect(alt.authenticatorSelection.userVerification).toBe('required');
    expect(alt.pubKeyCredParams.map(p => p.alg)).toEqual([-7, -257]);
    const aut = autentiserare();
    const r = await k.post('/api/flerfaktor/passkey', { namn: 'Bärbar dator', svar: aut.skapa(alt) });
    expect(r.status).toBe(201);
    expect(r.data.aktiv).toBe(true);
    expect(r.data.faktorer.map(f => [f.typ, f.namn])).toEqual([['passkey', 'Bärbar dator']]);
    const rad = sandlada(app, k).db.query("SELECT * FROM flerfaktorer WHERE agare_id = 'lak-vc'").get();
    expect(rad.credential_id).toBe(b64u(aut.credId));
    expect(Object.keys(JSON.parse(rad.publik_nyckel)).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    expect(rad.hemlighet).toBeNull();
    // Samma utmaning går inte att använda två gånger.
    const igen = await k.post('/api/flerfaktor/passkey', { svar: aut.skapa(alt) });
    expect(igen.status).toBe(400);
  });

  test('med en passkey väntar inloggningen på den andra faktorn och ger varken behörighet eller läskopia förrän den är godkänd', async () => {
    const { k, aut } = await medPasskey('lak-kard');
    const forsta = await k.post('/api/login', { personalId: 'lak-kard' });
    expect(forsta.status).toBe(200);
    expect(forsta.data.inloggad).toBe(false);
    expect(forsta.data.lasnyckel).toBeUndefined();
    expect(forsta.data.flerfaktor.kravs).toBe(true);
    expect(forsta.data.flerfaktor.metoder).toEqual(['passkey']);
    expect(forsta.data.flerfaktorVantar).toMatchObject({ typ: 'personal', metoder: ['passkey'] });
    expect((await k.get('/api/arbetslista')).status).toBe(401);
    expect((await k.get('/api/lasekopia')).status).toBe(401);
    const andra = await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(forsta.data.flerfaktor.passkey) });
    expect(andra.status).toBe(200);
    expect(andra.data.inloggad).toBe(true);
    expect(andra.data.personal.id).toBe('lak-kard');
    expect(andra.data.flerfaktor).toEqual({ aktiv: true, metod: 'passkey' });
    expect(andra.data.lasnyckel?.nyckel).toBeTruthy();
    expect((await k.get('/api/arbetslista')).status).toBe(200);
  });

  test('en signatur från fel nyckel, fel ursprung, en gammal utmaning eller utan användarverifiering godtas inte', async () => {
    const { k, aut } = await medPasskey('fys-kard');
    let u = (await k.post('/api/login', { personalId: 'fys-kard' })).data.flerfaktor;
    const annan = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    const forsok = [
      [{ nyckel: annan }, /Signaturen/],
      [{ origin: 'https://falsk.example' }, /annan webbplats/],
      [{ uv: false }, /bekräftade inte att det var du/],
      [{ challenge: b64u(randomBytes(32)) }, /annan utmaning/],
    ];
    for (const [opt, text] of forsok) {
      const r = await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(u.passkey, opt) });
      expect(r.status).toBe(400);
      expect(r.data.fel).toMatch(text);
      expect(r.data.flerfaktor.passkey.challenge).not.toBe(u.passkey.challenge);
      u = r.data.flerfaktor;
      expect((await k.get('/api/session')).data.inloggad).toBe(false);
    }
    const ok = await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(u.passkey) });
    expect(ok.data.inloggad).toBe(true);
  });

  test('en app för engångskoder enligt RFC 6238 registreras med en kod, nyckeln sparas krypterad och varje kod godtas en gång', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    expect(b.uri).toMatch(/^otpauth:\/\/totp\/.+\?secret=[A-Z2-7]+&issuer=.+&algorithm=SHA1&digits=6&period=30$/);
    const hemlighet = ff.fran32(b.nyckel);
    expect(hemlighet.length).toBe(20);
    const rad = sandlada(app, k).db.query("SELECT * FROM flerfaktorer WHERE agare_id = 'adm-kard'").get();
    expect(rad.aktiv).toBe(0);
    expect(rad.hemlighet).not.toContain(b.nyckel);
    expect(rad.hemlighet.startsWith('v1.')).toBe(true);
    expect(JSON.stringify(rad)).not.toContain(hemlighet.toString('hex'));
    // Inte på förrän en kod har bekräftats, och en fel kod godtas inte.
    expect((await k.get('/api/flerfaktor')).data.aktiv).toBe(false);
    expect((await k.post('/api/flerfaktor/totp', { kod: '000000' === ff.totp(hemlighet, Date.now()) ? '111111' : '000000' })).status).toBe(400);
    const ok = await k.post('/api/flerfaktor/totp', { kod: ff.totp(hemlighet, Date.now()) });
    expect(ok.status).toBe(201);
    expect(ok.data.faktorer.map(f => f.typ)).toEqual(['totp']);
    await k.post('/api/logout');
    const forsta = await k.post('/api/login', { personalId: 'adm-kard' });
    expect(forsta.data.flerfaktor.metoder).toEqual(['totp']);
    expect(forsta.data.flerfaktor.passkey).toBeUndefined();
    // Koden som bekräftade appen har redan använts.
    const anvand = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: ff.totp(hemlighet, Date.now()) });
    expect(anvand.status).toBe(400);
    expect(anvand.data.fel).toMatch(/redan använts|stämmer inte/);
    const nasta = ff.totp(hemlighet, Date.now() + 30_000);
    const r = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: nasta });
    expect(r.data.inloggad).toBe(true);
    expect(r.data.flerfaktor.metod).toBe('totp');
    await k.post('/api/logout');
    await k.post('/api/login', { personalId: 'adm-kard' });
    const igen = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: nasta });
    expect(igen.status).toBe(400);
    expect(igen.data.fel).toContain('redan använts');
  });

  test('invånaren i Min journal kan slå på flerfaktor och loggar sedan in med engångskod', async () => {
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-p01' })).data.inloggad).toBe(true);
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    expect((await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) })).status).toBe(201);
    await k.post('/api/logout');
    const forsta = await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect(forsta.data.inloggad).toBe(false);
    expect(forsta.data.flerfaktor.metoder).toEqual(['totp']);
    expect((await k.get('/api/min/journal/p01')).status).toBe(401);
    const r = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: ff.totp(h, Date.now() + 30_000) });
    expect(r.data.inloggad).toBe(true);
    expect(r.data.roll).toBe('invanare');
    expect(r.data.flerfaktor.metod).toBe('totp');
    expect(r.data.lasnyckel).toBeUndefined();
    // Invånarens faktor gäller bara invånaren: personalen i samma sandlåda loggar in som förut.
    await k.post('/api/logout');
    expect((await k.logga('lak-kard')).data.inloggad).toBe(true);
  });

  test('för många felaktiga koder avbryter inloggningen, och återställd sandlåda tar bort faktorn så att ingen låses ute', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    const b = (await k.post('/api/flerfaktor/totp/borja')).data;
    const h = ff.fran32(b.nyckel);
    await k.post('/api/flerfaktor/totp', { kod: ff.totp(h, Date.now()) });
    await k.post('/api/logout');
    await k.post('/api/login', { personalId: 'usk-kard' });
    const giltiga = new Set([-1, 0, 1].map(d => ff.totp(h, Date.now() + d * 30_000)));
    const fel = ['123456', '234567', '345678', '456789', '567890', '678901'].filter(x => !giltiga.has(x));
    let sista;
    for (let i = 0; i < ff.MAX_FORSOK; i++) sista = await k.post('/api/login/flerfaktor', { typ: 'totp', kod: fel[i] });
    expect(sista.data.fel).toContain('För många felaktiga försök');
    expect((await k.post('/api/login/flerfaktor', { typ: 'totp', kod: ff.totp(h, Date.now() + 30_000) })).data.fel).toContain('Välj rollen igen');
    // Sandlådan återställs: faktorn och allt annat i den försvinner, och rollen loggar in utan flerfaktor.
    expect((await k.post('/api/reset')).status).toBe(200);
    const ny = await k.post('/api/login', { personalId: 'usk-kard' });
    expect(ny.data.inloggad).toBe(true);
    expect(ny.data.flerfaktor.aktiv).toBe(false);
  });

  test('TOTP stämmer med testvektorerna i RFC 6238', () => {
    const h = Buffer.from('12345678901234567890');
    expect(ff.totp(h, 59_000, 8)).toBe('94287082');
    expect(ff.totp(h, 1111111109_000, 8)).toBe('07081804');
    expect(ff.totp(h, 1234567890_000, 8)).toBe('89005924');
    expect(ff.totp(h, 2000000000_000, 8)).toBe('69279037');
    expect(ff.fran32(ff.base32(h)).equals(h)).toBe(true);
    expect(ff.base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  test('säkerhetsloggen visar registrering, väntande inloggning, misslyckad och lyckad andra faktor', async () => {
    const { k, aut } = await medPasskey('far-kard');
    const u = (await k.post('/api/login', { personalId: 'far-kard' })).data.flerfaktor;
    const fel = await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(u.passkey, { uv: false }) });
    await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(fel.data.flerfaktor.passkey) });
    const rader = sandlada(app, k).db.query("SELECT typ, beskrivning FROM sakerhetslogg WHERE personal_id = 'far-kard' ORDER BY id").all();
    const typer = rader.map(r => r.typ);
    expect(typer).toEqual(['inloggning', 'flerfaktor', 'utloggning', 'flerfaktor', 'inloggning_misslyckad', 'inloggning']);
    expect(rader[1].beskrivning).toContain('passkey registrerades');
    expect(rader[3].beskrivning).toContain('väntar på den andra faktorn');
    expect(rader[5].beskrivning).toContain('flerfaktor');
  });

  test('en faktor tas bort av den inloggade, och utan faktorer är flerfaktor av igen', async () => {
    const { k, aut } = await medPasskey('vch-kard');
    const u = (await k.post('/api/login', { personalId: 'vch-kard' })).data.flerfaktor;
    await k.post('/api/login/flerfaktor', { typ: 'passkey', svar: aut.hamta(u.passkey) });
    const o = (await k.get('/api/flerfaktor')).data;
    expect(o.metod).toBe('passkey');
    const r = await k.post(`/api/flerfaktor/${o.faktorer[0].id}/ta-bort`);
    expect(r.data.aktiv).toBe(false);
    // Ingen annan än den inloggade kan ta bort faktorn.
    const annan = klient(app);
    await annan.logga('lak-kard');
    expect((await annan.post(`/api/flerfaktor/${o.faktorer[0].id}/ta-bort`)).status).toBe(404);
    await k.post('/api/logout');
    expect((await k.post('/api/login', { personalId: 'vch-kard' })).data.inloggad).toBe(true);
  });
});
