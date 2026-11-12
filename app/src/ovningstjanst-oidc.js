// Runda 14, r1 (Sussa 5.2.1.1): övningstjänsten, en simulerad extern inloggningstjänst (OpenID Connect Provider) i samma
// server. Den finns för att systemförvaltaren i den publika demon ska kunna koppla in en inloggningstjänst med fyra ögon,
// pröva hela inloggningen med authorization code och PKCE, och se vad som händer med en biljett vars attribut inte
// stämmer. Den är inte Ineras IdP och inte någon regions tjänst, och den märks som simulerad överallt.
//
// Tjänsten talar samma protokoll som en verklig tjänst: den tar emot en begäran om inloggning, kontrollerar klient,
// redirect_uri, PKCE och nonce, ger en kod som används en gång och byter den mot en id-biljett signerad med ES256. Bytet
// görs utan nätverk, eftersom tjänsten finns i samma server, men Vårdkällan prövar biljetten på exakt samma sätt som från
// en extern tjänst. Klientens intyg (private_key_jwt) kontrolleras mot Vårdkällans publika nyckel.
//
// Attributen följer Ineras attributspecifikation för IdP (Medarbetare Bas) och räknas ur masterdata i sandlådan, som i en
// verklig tjänst där HSA är källan. Den som loggar in kan välja att biljetten ska innehålla fel uppgifter, för att se att
// Vårdkällan då stänger och förklarar varför.
import { generateKeyPairSync, createPublicKey, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Fel } from './db.js';
import { uppdragFor, uppdragHsaId } from './idp.js';
import * as jwt from './oidc-jwt.js';

export const SOKVAG = '/api/ovningstjanst';
export const NAMN = 'Övningstjänst för inloggning (simulerad)';
export const KLIENT_ID = 'vardkallan-demo';
export const utfardare = (bas) => `${bas}${SOKVAG}`;
const TILLITSNIVA = 'http://id.sambi.se/loa/loa3';
const KOD_S = 60;
const BEGARAN_MS = 10 * 60_000;
const MAX_BEGARAN = 2000;

// Tjänstens nyckel skapas när servern startar. Efter en omstart publicerar tjänsten en ny nyckel, och systemförvaltaren
// får då ett förslag om att byta nyckel med fyra ögon, som när en verklig tjänst byter nyckel.
const nyckel = (() => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ format: 'jwk' });
  const kid = `ovning-${jwt.tumavtryck(pub).slice(0, 12)}`;
  return { privat: privateKey, jwk: { ...pub, kid, use: 'sig', alg: 'ES256' } };
})();
export const jwks = () => ({ keys: [nyckel.jwk] });

export const metadata = (bas) => {
  const iss = utfardare(bas);
  return {
    issuer: iss, authorization_endpoint: `${iss}/authorize`, token_endpoint: `${iss}/token`, jwks_uri: `${iss}/jwks`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'],
    id_token_signing_alg_values_supported: ['ES256'], token_endpoint_auth_methods_supported: ['private_key_jwt'], subject_types_supported: ['public'],
    scopes_supported: ['openid', 'commission'], claims_supported: ['sub', 'employeeHsaId', 'given_name', 'family_name', 'name', 'commissionHsaId', 'commissionName',
      'commissionPurpose', 'healthCareUnitHsaId', 'healthCareUnitName', 'healthCareProviderHsaId', 'healthCareProviderName', 'healthcareProfessionalLicense', 'acr', 'amr', 'auth_time', 'jti'],
    acr_values_supported: [TILLITSNIVA], 'x-simulerad': `${NAMN}. Ingen verklig inloggningstjänst är ansluten.`,
  };
};

// Vad biljetten kan innehålla. ratt är uppgifterna ur katalogen, de andra visar att Vårdkällan stänger.
export const VARIANTER = [
  { id: 'ratt', text: 'Rätt uppgifter ur katalogen' },
  { id: 'annan_vardenhet', text: 'Ett medarbetaruppdrag på en annan vårdenhet' },
  { id: 'fel_andamal', text: 'Ett uppdrag med fel ändamål' },
  { id: 'saknar_legitimation', text: 'Utan legitimation', legitimerad: true },
  { id: 'saknar_uppdrag', text: 'Utan medarbetaruppdrag' },
  { id: 'okand_person', text: 'En person som inte finns i katalogen' },
];
const LEGITIMATION = { lakare: 'LK', sjukskoterska: 'SJ', fysioterapeut: 'FT', farmaceut: 'AP' };

// Begäranden och koder. En begäran hör till sessionen som startade den, och en kod används en gång.
const begaranden = new Map();
const koder = new Map();
const stada = (nu) => {
  for (const [id, b] of begaranden) if (b.skapad + BEGARAN_MS < nu) begaranden.delete(id);
  for (const [k, v] of koder) if (v.utgar < nu) koder.delete(k);
};
const textFel = (t) => new Fel(400, t, 'ogiltig');

// Inloggningsbegäran (authorization_endpoint). Ett fel i klient eller redirect_uri skickas aldrig tillbaka till en adress,
// eftersom adressen då inte går att lita på (RFC 6749 4.1.2.1). Ger adressen i Vårdkällan där personen loggar in.
export function authorize(s, q, bas, nu = Date.now()) {
  stada(nu);
  const f = (n) => (typeof q.get(n) === 'string' ? q.get(n) : '');
  if (f('client_id') !== KLIENT_ID) throw textFel('Övningstjänsten känner inte igen klienten.');
  if (f('redirect_uri') !== `${bas}/api/inloggning/svar`) throw textFel('Adressen som svaret ska skickas till är inte registrerad för klienten.');
  if (f('response_type') !== 'code') throw textFel('Övningstjänsten ger bara authorization code.');
  if (!f('scope').split(' ').includes('openid')) throw textFel('Begäran saknar omfånget openid.');
  if (f('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(f('code_challenge'))) throw textFel('Begäran saknar PKCE med S256.');
  if (!f('state') || f('state').length > 200 || !f('nonce') || f('nonce').length > 200) throw textFel('Begäran saknar state eller nonce.');
  if (begaranden.size >= MAX_BEGARAN) throw new Fel(429, 'Övningstjänsten har för många inloggningar just nu. Försök igen om en stund.', 'nekad');
  const id = randomBytes(16).toString('base64url');
  begaranden.set(id, { s, redirect: f('redirect_uri'), state: f('state'), nonce: f('nonce'), challenge: f('code_challenge'), skapad: nu });
  return `/#/ovningstjanst/${id}`;
}

const hamtaBegaran = (s, id) => {
  const b = typeof id === 'string' ? begaranden.get(id) : null;
  if (!b || b.s !== s || b.skapad + BEGARAN_MS < Date.now()) throw new Fel(404, 'Inloggningen finns inte eller har gått ut. Börja om från inloggningssidan.', 'saknas');
  return b;
};

// Sidan i övningstjänsten: personerna att logga in som, som med det simulerade SITHS-kortet, och vad biljetten kan innehålla.
export function begaran(s, db, id) {
  hamtaBegaran(s, id);
  const personer = db.query("SELECT p.id, p.namn, p.titel, p.yrke, e.namn AS enhet FROM personal p LEFT JOIN enheter e ON e.id = p.enhet_id WHERE p.demo = 1 AND p.aktiv = 1 AND p.yrke <> 'systemkonto' ORDER BY p.rowid").all()
    .map(p => ({ id: p.id, namn: p.namn, titel: p.titel, enhet: p.enhet, legitimerad: Boolean(LEGITIMATION[p.yrke]) }));
  return { tjanst: NAMN, klient: 'Vårdkällan', varianter: VARIANTER, personer, simulerad: `${NAMN}. Ingen verklig inloggningstjänst är ansluten.` };
}

// Attributen för personen ur masterdata, med den valda varianten.
function pastaende(db, p, variant) {
  const u = uppdragFor(db, p);
  if (!u) throw new Fel(400, 'Personen har inget medarbetaruppdrag i katalogen.', 'ogiltig');
  const vg = db.query('SELECT namn FROM enheter WHERE hsa_id = ?').get(u.healthCareProviderHsaId);
  const [fornamn, ...rest] = p.namn.split(' ');
  const a = {
    employeeHsaId: p.hsa_id, given_name: fornamn, family_name: rest.join(' ') || fornamn, name: p.namn,
    commissionHsaId: u.commissionHsaId, commissionName: `${p.titel ?? 'Medarbetare'}, ${u.healthCareUnitName}`, commissionPurpose: u.commissionPurpose,
    healthCareUnitHsaId: u.healthCareUnitHsaId, healthCareUnitName: u.healthCareUnitName, healthCareProviderHsaId: u.healthCareProviderHsaId, healthCareProviderName: vg?.namn ?? null,
    ...(LEGITIMATION[p.yrke] ? { healthcareProfessionalLicense: [LEGITIMATION[p.yrke]] } : {}),
  };
  if (variant === 'annan_vardenhet') {
    const annan = db.query("SELECT hsa_id, namn FROM enheter WHERE typ = 'vardenhet' AND hsa_id <> ? ORDER BY id LIMIT 1").get(u.healthCareUnitHsaId);
    if (annan) Object.assign(a, { healthCareUnitHsaId: annan.hsa_id, healthCareUnitName: annan.namn, commissionHsaId: uppdragHsaId(p.hsa_id, annan.hsa_id) });
  }
  if (variant === 'fel_andamal') a.commissionPurpose = u.commissionPurpose === 'Vård och behandling' ? 'Statistik' : 'Vård och behandling';
  if (variant === 'saknar_legitimation') delete a.healthcareProfessionalLicense;
  if (variant === 'saknar_uppdrag') { delete a.commissionHsaId; delete a.commissionName; delete a.commissionPurpose; }
  if (variant === 'okand_person') Object.assign(a, { employeeHsaId: 'SE2321000164-DEMO-OKAND', given_name: 'Okänd', family_name: 'Person (demo)', name: 'Okänd Person (demo)' });
  return a;
}

// Personen har loggat in i övningstjänsten. Ger adressen som webbläsaren skickas tillbaka till, med koden.
export function svara(s, db, id, { personalId, variant } = {}, nu = Date.now()) {
  const b = hamtaBegaran(s, id);
  if (!VARIANTER.some(v => v.id === variant)) throw textFel('Välj vad biljetten ska innehålla.');
  const p = typeof personalId === 'string' ? db.query('SELECT * FROM personal WHERE id = ? AND demo = 1').get(personalId) : null;
  if (!p) throw textFel('Välj en person.');
  begaranden.delete(id);
  const kod = randomBytes(24).toString('base64url');
  koder.set(kod, { redirect: b.redirect, nonce: b.nonce, challenge: b.challenge, utgar: nu + KOD_S * 1000, attribut: pastaende(db, p, variant), sub: createHash('sha256').update(`ovning ${p.hsa_id}`).digest('hex').slice(0, 32) });
  const u = new URL(b.redirect);
  u.searchParams.set('code', kod);
  u.searchParams.set('state', b.state);
  return { adress: u.href };
}

const tokenFel = (fel, beskrivning) => { throw new Fel(400, `Biljetten godtogs inte: ${beskrivning}`, 'ogiltig_biljett', { error: fel }); };

// Bytet av koden mot en id-biljett (token_endpoint). falt är formulärets fält.
export function token(falt, { bas, rp, nu = Date.now() }) {
  if (falt.grant_type !== 'authorization_code') tokenFel('unsupported_grant_type', 'övningstjänsten ger bara authorization code.');
  const k = typeof falt.code === 'string' ? koder.get(falt.code) : null;
  // Koden används en gång, också när något annat i begäran är fel.
  if (k) koder.delete(falt.code);
  if (!k || k.utgar < nu) tokenFel('invalid_grant', 'koden är okänd, har redan använts eller har gått ut.');
  if (falt.redirect_uri !== k.redirect) tokenFel('invalid_grant', 'redirect_uri är inte samma som i begäran.');
  if (typeof falt.code_verifier !== 'string' || createHash('sha256').update(falt.code_verifier).digest('base64url') !== k.challenge) tokenFel('invalid_grant', 'PKCE stämmer inte.');
  // Klientens intyg, signerat med Vårdkällans nyckel.
  if (falt.client_id !== KLIENT_ID || falt.client_assertion_type !== 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer') tokenFel('invalid_client', 'klienten är okänd.');
  let intyg;
  try { intyg = jwt.verifiera(falt.client_assertion, [rp]).pastaende; } catch { tokenFel('invalid_client', 'klientens intyg stämmer inte.'); }
  const s = Math.floor(nu / 1000);
  if (intyg.iss !== KLIENT_ID || intyg.sub !== KLIENT_ID || intyg.aud !== `${utfardare(bas)}/token` || typeof intyg.exp !== 'number' || intyg.exp < s) tokenFel('invalid_client', 'klientens intyg gäller inte.');
  const iat = s;
  const atkomst = randomBytes(24).toString('base64url');
  const id = jwt.signera({ alg: 'ES256', typ: 'JWT', kid: nyckel.jwk.kid }, {
    iss: utfardare(bas), sub: k.sub, aud: [KLIENT_ID, utfardare(bas)], exp: iat + 300, iat, auth_time: iat, nonce: k.nonce, jti: randomUUID(),
    acr: TILLITSNIVA, amr: ['urn:oasis:names:tc:SAML:2.0:ac:classes:MobileTwoFactorContract'], at_hash: jwt.atHash(atkomst, 'ES256'), ...k.attribut,
  }, nyckel.privat);
  return { access_token: atkomst, token_type: 'Bearer', expires_in: 3600, id_token: id };
}

// Bara för testerna: en biljett signerad med övningstjänstens nyckel.
export const signeraForTest = (pastaende) => jwt.signera({ alg: 'ES256', typ: 'JWT', kid: nyckel.jwk.kid }, pastaende, nyckel.privat);
