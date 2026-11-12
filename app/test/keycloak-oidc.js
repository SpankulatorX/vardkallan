// Runda 14, r1 (Sussa 5.2.1.1): prov mot Keycloak som "beställarens inloggningstjänst". Körs av test/keycloak-oidc.sh,
// inte av de vanliga servertesterna (CI har ingen Keycloak). Skriptet sätter upp en realm med en klient som kräver PKCE,
// ett omfång commission med attributen enligt Ineras attributspecifikation för IdP och testanvändare vars attribut
// räknas ur Vårdkällans masterdata, startar Vårdkällan i samma process, kopplar in Keycloak med fyra ögon och loggar in
// genom Keycloaks inloggningssida som en webbläsare. Keycloak autentiserar med lösenord och står här för SITHS, så
// tillitsnivån är ett fast attribut i omfånget.
import { starta } from '../src/server.js';
import { nySessionsDb } from '../src/db.js';
import { uppdragFor, uppdragHsaId } from '../src/idp.js';
import { writeFileSync } from 'node:fs';

const KC = process.env.KC_URL ?? 'http://127.0.0.1:18181';
const VK = process.env.VK_URL ?? 'http://127.0.0.1:18141';
const REALM = 'region-demo';
const ISS = `${KC}/realms/${REALM}`;
const HEMLIGHET = 'kc-klienthemlighet-endast-test';
process.env.VK_IDP_KEYCLOAK = HEMLIGHET;
const steg = [];
const ok = (namn, villkor, detalj = '') => { steg.push({ namn, ok: Boolean(villkor), detalj }); console.log(`${villkor ? 'OK  ' : 'FEL '} ${namn}${detalj ? `: ${detalj}` : ''}`); if (!villkor) throw new Error(namn); };

async function kc(vag, { metod = 'GET', data, token, form } = {}) {
  const h = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) };
  const r = await fetch(KC + vag, { method: metod, headers: h, body: data ? JSON.stringify(data) : form ? new URLSearchParams(form).toString() : undefined });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`Keycloak ${metod} ${vag}: ${r.status} ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function vantaPaKeycloak() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${KC}/realms/master`); if (r.ok) return; } catch { /* startar */ }
    await Bun.sleep(2000);
  }
  throw new Error('Keycloak startade inte.');
}

// Attributen för en person i Vårdkällans masterdata, som HSA skulle ge dem.
function attributFor(db, id, { vardenhet = null, legitimation = true } = {}) {
  const p = db.query('SELECT * FROM personal WHERE id = ?').get(id);
  const u = uppdragFor(db, p);
  const ve = vardenhet ? db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(vardenhet).hsa_id : u.healthCareUnitHsaId;
  const lic = { lakare: ['LK'], sjukskoterska: ['SJ'] }[p.yrke];
  return {
    employeeHsaId: [p.hsa_id], commissionHsaId: [vardenhet ? uppdragHsaId(p.hsa_id, ve) : u.commissionHsaId], commissionPurpose: [u.commissionPurpose],
    healthCareUnitHsaId: [ve], healthCareProviderHsaId: [u.healthCareProviderHsaId], ...(lic && legitimation ? { healthcareProfessionalLicense: lic } : {}),
  };
}

async function sattUpp() {
  const admin = (await kc('/realms/master/protocol/openid-connect/token', { metod: 'POST', form: { grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: process.env.KC_ADMIN_LOSEN } })).access_token;
  await kc('/admin/realms', { metod: 'POST', token: admin, data: { realm: REALM, enabled: true, sslRequired: 'none' } });
  // Egna attribut på användarna (Keycloak 24 och senare kräver att de slås på i användarprofilen).
  const profil = await kc(`/admin/realms/${REALM}/users/profile`, { token: admin });
  await kc(`/admin/realms/${REALM}/users/profile`, { metod: 'PUT', token: admin, data: { ...profil, unmanagedAttributePolicy: 'ENABLED' } });
  // Omfånget commission med attributen som claims, och tillitsnivån som ett fast värde.
  const mapper = (namn, multi = false) => ({ name: namn, protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-attribute-mapper',
    config: { 'user.attribute': namn, 'claim.name': namn, 'jsonType.label': 'String', 'id.token.claim': 'true', 'access.token.claim': 'false', 'userinfo.token.claim': 'true', multivalued: String(multi) } });
  await kc(`/admin/realms/${REALM}/client-scopes`, { metod: 'POST', token: admin, data: {
    name: 'commission', protocol: 'openid-connect', attributes: { 'include.in.token.scope': 'true' },
    protocolMappers: [...['employeeHsaId', 'commissionHsaId', 'commissionPurpose', 'healthCareUnitHsaId', 'healthCareProviderHsaId'].map(n => mapper(n)), mapper('healthcareProfessionalLicense', true),
      { name: 'acr-loa3', protocol: 'openid-connect', protocolMapper: 'oidc-hardcoded-claim-mapper', config: { 'claim.name': 'acr', 'claim.value': 'http://id.sambi.se/loa/loa3', 'jsonType.label': 'String', 'id.token.claim': 'true', 'access.token.claim': 'false', 'userinfo.token.claim': 'false' } }],
  } });
  await kc(`/admin/realms/${REALM}/clients`, { metod: 'POST', token: admin, data: {
    clientId: 'vardkallan', enabled: true, protocol: 'openid-connect', publicClient: false, clientAuthenticatorType: 'client-secret', secret: HEMLIGHET,
    standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false, redirectUris: [`${VK}/api/inloggning/svar`],
    attributes: { 'pkce.code.challenge.method': 'S256' }, defaultClientScopes: ['basic', 'profile', 'commission'], optionalClientScopes: [],
  } });
  const db = nySessionsDb();
  const anv = [
    ['lak-kard', 'Sara', 'Lindqvist', attributFor(db, 'lak-kard')],
    ['lak-fel-enhet', 'Sara', 'Lindqvist', attributFor(db, 'lak-kard', { vardenhet: 'uso-akut' })],
    ['lak-utan-leg', 'Sara', 'Lindqvist', attributFor(db, 'lak-kard', { legitimation: false })],
  ];
  for (const [namn, fornamn, efternamn, attribut] of anv) {
    await kc(`/admin/realms/${REALM}/users`, { metod: 'POST', token: admin, data: { username: namn, enabled: true, emailVerified: true, email: `${namn}@demo.invalid`,
      firstName: fornamn, lastName: efternamn, attributes: attribut, credentials: [{ type: 'password', value: 'demo-losen-1', temporary: false }] } });
  }
}

// En webbläsare: kakor per namn (båda tjänsterna ligger på 127.0.0.1) och omdirigeringar för hand.
function webblasare() {
  const kakor = new Map();
  const ta = (r) => { for (const sc of r.headers.getSetCookie()) { const [nv] = sc.split(';'); const i = nv.indexOf('='); kakor.set(nv.slice(0, i), nv.slice(i + 1)); } return r; };
  const kaka = () => [...kakor].map(([n, v]) => `${n}=${v}`).join('; ');
  const hamta = async (url, { metod = 'GET', data, form } = {}) => ta(await fetch(url, { method: metod, redirect: 'manual',
    headers: { Cookie: kaka(), ...(data ? { 'Content-Type': 'application/json' } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: data ? JSON.stringify(data) : form ? new URLSearchParams(form).toString() : undefined }));
  // Keycloaks kakor tas bort före nästa användare, så att Keycloak inte loggar in samma person igen (enkel inloggning).
  const glomKeycloak = () => { for (const n of [...kakor.keys()]) if (n !== 'vk_sid') kakor.delete(n); };
  return { hamta, glomKeycloak, json: async (url, opt) => (await hamta(url, opt)).json() };
}

async function loggaIn(b, tjanst, anvandare) {
  b.glomKeycloak();
  const r1 = await b.hamta(`${VK}/api/inloggning/extern/${tjanst}`);
  const till = r1.headers.get('location');
  const sida = await b.hamta(till);
  const html = await sida.text();
  const action = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!action) throw new Error(`Keycloaks inloggningssida saknar formulär (${sida.status})`);
  const r2 = await b.hamta(action, { metod: 'POST', form: { username: anvandare, password: 'demo-losen-1', credentialId: '' } });
  const svar = r2.headers.get('location');
  if (!svar?.startsWith(`${VK}/api/inloggning/svar`)) throw new Error(`Keycloak skickade inte tillbaka till Vårdkällan (${r2.status} ${svar})`);
  await b.hamta(svar);
  return { till, resultat: (await b.json(`${VK}/api/inloggning/resultat`)).resultat };
}

await vantaPaKeycloak();
await sattUpp();
const app = starta({ port: Number(new URL(VK).port), hostname: '127.0.0.1', origin: VK, inloggningTillatna: KC, nyaPerTimme: 1000 });
try {
  const b = webblasare();
  await b.hamta(`${VK}/api/session`);
  await b.hamta(`${VK}/api/login`, { metod: 'POST', data: { personalId: 'sysf' } });
  const f = await b.json(`${VK}/api/inloggningstjanster`, { metod: 'POST', data: { namn: 'Regionens inloggningstjänst (Keycloak, lokalt prov)', utfardare: ISS, klientId: 'vardkallan',
    klientautentisering: 'client_secret_basic', hemlighetMiljo: 'VK_IDP_KEYCLOAK', motivering: 'Lokalt prov mot Keycloak.' } });
  ok('systemförvaltaren föreslår Keycloak, och systemet hämtar metadata och nycklar', f.andring?.nycklar?.length >= 1, f.andring ? `${f.andring.nycklar.length} nyckel, tumavtryck ${f.andring.nycklar[0].tumavtryck}` : JSON.stringify(f));
  await b.hamta(`${VK}/api/logout`, { metod: 'POST', data: {} });
  await b.hamta(`${VK}/api/login`, { metod: 'POST', data: { personalId: 'sysf-2' } });
  const g = await b.hamta(`${VK}/api/inloggningstjanster/andring/${f.andring.id}/godkann`, { metod: 'POST', data: {} });
  ok('en andra systemförvaltare godkänner', g.status === 200);
  await b.hamta(`${VK}/api/logout`, { metod: 'POST', data: {} });

  const r = await loggaIn(b, f.andring.tjanst, 'lak-kard');
  const u = new URL(r.till);
  ok('begäran till Keycloak har authorization code och PKCE med S256', u.searchParams.get('response_type') === 'code' && u.searchParams.get('code_challenge_method') === 'S256' && u.searchParams.get('nonce'));
  ok('inloggningen genom Keycloak lyckas med rätt attribut', r.resultat?.ok === true, JSON.stringify(r.resultat));
  const s = await b.json(`${VK}/api/session`);
  ok('personen och uppdraget kommer ur biljetten och katalogen', s.personal?.id === 'lak-kard' && s.uppdrag?.vardenhet === 'Kardiologiska kliniken USÖ', `${s.personal?.namn}, ${s.uppdrag?.vardenhet}, ${s.uppdrag?.metod}`);
  await b.hamta(`${VK}/api/logout`, { metod: 'POST', data: {} });

  const fel = await loggaIn(b, f.andring.tjanst, 'lak-fel-enhet');
  ok('ett uppdrag på en annan vårdenhet ger ingen åtkomst', fel.resultat?.ok === false && /annan vårdenhet/.test(fel.resultat.text), fel.resultat?.text);
  const leg = await loggaIn(b, f.andring.tjanst, 'lak-utan-leg');
  ok('en biljett utan legitimation för läkaren ger ingen åtkomst', leg.resultat?.ok === false && /legitimationen som läkare/.test(leg.resultat.text), leg.resultat?.text);
  ok('ingen är inloggad efter de misslyckade försöken', !(await b.json(`${VK}/api/session`)).personal);
} finally {
  app.stopp();
  writeFileSync(process.env.KC_RESULTAT ?? '/dev/null', JSON.stringify({ keycloak: process.env.KC_VERSION ?? null, tid: new Date().toISOString(), steg }, null, 1));
}
const fela = steg.filter(x => !x.ok).length;
console.log(fela ? `${fela} fel` : `Alla ${steg.length} steg gröna`);
process.exit(fela ? 1 : 0);
