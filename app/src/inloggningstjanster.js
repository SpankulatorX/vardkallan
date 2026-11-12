// Runda 14, r1 (Sussa 5.2.1.1): inloggning genom beställarens inloggningstjänst. "Kärnsystemet ska bevilja åtkomst
// baserat på attribut i autentiseringsbiljett utfärdat genom av beställaren tillhandahållen IDP."
//
// En vårdgivare kopplar in sin egen inloggningstjänst (en OpenID Connect Provider, till exempel Ineras IdP för
// medarbetare eller regionens egen) i systemförvaltningen. Varje ändring, också ett byte av nyckel och en avstängning,
// föreslås av en systemförvaltare och gäller först när en annan systemförvaltare har godkänt den (fyra ögon), på samma
// sätt som parametrarna i konfiguration.js. Inloggningstjänstens publika nycklar pinnas i konfigurationen när den läggs
// in: biljetter verifieras bara mot de inlagda nycklarna, aldrig mot en nyckel som hämtas under inloggningen. Inga
// hemligheter sparas i databasen. Klienten autentiserar sig mot tjänsten med ett signerat intyg (private_key_jwt) med
// Vårdkällans egen nyckel, som inte ligger i databasen, eller med en hemlighet som driften lägger i serverns miljö; i
// databasen står bara namnet på miljövariabeln.
//
// Inloggningen följer OpenID Connect med authorization code och PKCE (S256). Svaret prövas: state och nonce ska vara de
// som denna session skapade och används en gång, biljetten ska vara signerad med en inlagd nyckel och en asymmetrisk
// algoritm, utfärdaren och mottagaren ska vara rätt och biljetten ska gälla nu. Sedan tolkas attributen enligt Ineras
// attributspecifikation för IdP (3.3 SAD - IdP - Attributlista Medarbetare - Bas): HSA-id, medarbetaruppdraget med
// ändamål och vårdenhet, vårdgivaren och den legitimerade yrkesgruppen. Åtkomsten räknas ur attributen och prövas mot
// masterdata, som för den simulerade autentiseringstjänsten i idp.js. Saknas ett attribut, eller motsäger det masterdata,
// blir det ingen inloggning, och systemet säger på vanlig svenska vad som är fel och vem som kan rätta det.
//
// Systemet är experten: systemförvaltaren skriver bara in tjänstens adress och klient-id. Systemet hämtar tjänstens
// uppgifter och nycklar (från adresser som driften har godkänt), visar nycklarnas tumavtryck så att de två
// systemförvaltarna kan jämföra dem med det tjänsten publicerar, kontrollerar att tjänsten stödjer det som krävs och
// föreslår själv ett byte av nyckel när tjänsten har bytt nyckel. Personalen väljer aldrig uppdrag eller behörighet.
//
// Servern hämtar bara från adresser vars ursprung driften har lagt i listan över godkända inloggningstjänster
// (INLOGGNING_TILLATNA). Det är taket: en systemförvaltare i en sandlåda kan aldrig få servern att anropa en annan adress.
// Övningstjänsten (ovningstjanst-oidc.js) är en simulerad extern inloggningstjänst i samma server och anropas utan nätverk.
import { randomBytes, createHash, generateKeyPairSync, createPrivateKey, createPublicKey, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Fel, iso } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';
import { uppdragFor } from './idp.js';
import * as jwt from './oidc-jwt.js';
import * as ovning from './ovningstjanst-oidc.js';

export const SCHEMA = `
-- Runda 14, r1: ändringar av de betrodda inloggningstjänsterna. konfiguration är JSON med publika uppgifter och pinnade
-- publika nycklar, aldrig en hemlighet. En ändring gäller först när en annan systemförvaltare har godkänt den, och en
-- beslutad ändring ändras eller raderas aldrig.
CREATE TABLE IF NOT EXISTS inloggningstjanst_andringar (
  id INTEGER PRIMARY KEY, tjanst TEXT NOT NULL, atgard TEXT NOT NULL, konfiguration TEXT NOT NULL, forra TEXT,
  motivering TEXT NOT NULL, foreslagen_av TEXT NOT NULL, foreslagen TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vantar',
  beslutad_av TEXT, beslutad TEXT, beslut_kommentar TEXT,
  CHECK (atgard IN ('ny', 'andring', 'nyckelbyte', 'avstangning', 'ateraktivering')),
  CHECK (status IN ('vantar', 'godkand', 'avslagen', 'aterkallad')),
  CHECK (status <> 'godkand' OR (beslutad_av IS NOT NULL AND beslutad_av <> foreslagen_av)),
  CHECK (length(trim(motivering)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_inloggningstjanst ON inloggningstjanst_andringar (tjanst, status);
CREATE TRIGGER IF NOT EXISTS inloggningstjanst_raderas_ej BEFORE DELETE ON inloggningstjanst_andringar
  BEGIN SELECT RAISE(ABORT, 'En ändring av en inloggningstjänst raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS inloggningstjanst_andras_ej BEFORE UPDATE ON inloggningstjanst_andringar
  WHEN OLD.status <> 'vantar' OR NEW.id IS NOT OLD.id OR NEW.tjanst IS NOT OLD.tjanst OR NEW.atgard IS NOT OLD.atgard
    OR NEW.konfiguration IS NOT OLD.konfiguration OR NEW.forra IS NOT OLD.forra OR NEW.motivering IS NOT OLD.motivering
    OR NEW.foreslagen_av IS NOT OLD.foreslagen_av OR NEW.foreslagen IS NOT OLD.foreslagen
  BEGIN SELECT RAISE(ABORT, 'En beslutad ändring av en inloggningstjänst ändras inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }

export const ATGARD = { ny: 'Ny inloggningstjänst', andring: 'Ändrade uppgifter', nyckelbyte: 'Byte av nyckel', avstangning: 'Avstängning', ateraktivering: 'Återaktivering' };
const STATUS = { vantar: 'Väntar på godkännande', godkand: 'Godkänd', avslagen: 'Avslagen', aterkallad: 'Återkallad' };
export const KLIENTAUTENTISERING = {
  private_key_jwt: 'Signerat intyg med Vårdkällans nyckel (private_key_jwt)',
  client_secret_basic: 'Hemlighet i serverns miljö (client_secret_basic)',
};
export const ATTRIBUTPROFIL = {
  'inera-3.3': 'Ineras attributspecifikation för IdP, version 3.3 (Medarbetare Bas)',
};
// Källan för attributprofilen. Sidan är publicerad på Ineras wiki för Identitet och åtkomst.
export const ATTRIBUTKALLA = {
  titel: '3.3 SAD - IdP - Attributlista Medarbetare - Bas', version: '3.3 (sidversion 1, 2026-09-21)',
  adress: 'https://inera.atlassian.net/wiki/spaces/ST/pages/6044651764/3.3+SAD+-+IdP+-+Attributlista+Medarbetare+-+Bas',
  oidcProfil: 'https://inera.atlassian.net/wiki/spaces/ST/pages/6044651944/3.3+SAD+-+IdP+-+Medarbetare+Bas+OIDC-Profil',
};
export const SCOPE = 'openid commission';
// Tillitsnivå 3 eller 4. Lägre godtas aldrig för personalens inloggning, och det går inte att ändra här.
export const TILLITSNIVAER = ['http://id.sambi.se/loa/loa3', 'http://id.sambi.se/loa/loa4', 'http://id.elegnamnden.se/loa/1.0/loa3', 'http://id.elegnamnden.se/loa/1.0/loa4'];
// Den legitimerade yrkesgrupp (tvåställig kod i Socialstyrelsens HOSP-register) som en roll kräver. Roller utan
// legitimationskrav finns inte här.
export const LEGITIMATION = { lakare: ['LK'], sjukskoterska: ['SJ', 'BM'], fysioterapeut: ['FT', 'SG'], farmaceut: ['AP', 'RC'] };
export const LEGITIMATION_NAMN = { LK: 'läkare', SJ: 'sjuksköterska', BM: 'barnmorska', FT: 'fysioterapeut', SG: 'sjukgymnast', AP: 'apotekare', RC: 'receptarie' };
export const REDIRECT = '/api/inloggning/svar';
const KLOCKMARGINAL_S = 60;
const MAX_BILJETTALDER_S = 600;
const VANTAR_MS = 10 * 60_000;
const MAX_VANTANDE = 5;
const MAX_SVAR = 256 * 1024;
const HEMLIGHET_NAMN = /^VK_IDP_[A-Z0-9_]{1,40}$/;

// Vårdkällans egen nyckel för klientens intyg (private_key_jwt). Den läses från filen i INLOGGNING_RP_NYCKEL (PEM, EC
// P-256) eller skapas när servern startar. Den sparas aldrig i databasen, och den publika delen publiceras som JWKS.
const rp = (() => {
  let privat;
  try { privat = process.env.INLOGGNING_RP_NYCKEL ? createPrivateKey(readFileSync(process.env.INLOGGNING_RP_NYCKEL)) : null; } catch { privat = null; }
  if (!privat || privat.asymmetricKeyDetails?.namedCurve !== 'prime256v1') privat = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  const pub = createPublicKey(privat).export({ format: 'jwk' });
  const kid = jwt.tumavtryck(pub).slice(0, 16);
  return { privat, jwk: { ...pub, kid, use: 'sig', alg: 'ES256' }, tumavtryck: jwt.tumavtryck(pub) };
})();
export const rpJwks = () => ({ keys: [rp.jwk] });
export const rpPublik = () => rp.jwk;

// --- Adresser och hämtning ---

// Listan över godkända ursprung (schema, värd och port) från driften. Varje adress som servern anropar eller skickar en
// webbläsare till måste ha ett av dem som ursprung, utom övningstjänsten i samma server.
export function tillatnaUrsprung(lista = process.env.INLOGGNING_TILLATNA ?? '') {
  const ut = new Set();
  for (const s of (Array.isArray(lista) ? lista : String(lista).split(','))) {
    try { const u = new URL(String(s).trim()); if (['https:', 'http:'].includes(u.protocol)) ut.add(u.origin); } catch { /* inte en adress */ }
  }
  return ut;
}

function adress(text, falt) {
  let u;
  try { u = new URL(String(text ?? '').trim()); } catch { throw new Fel(400, `${falt} är inte en adress.`, 'ogiltig'); }
  if (!['https:', 'http:'].includes(u.protocol)) throw new Fel(400, `${falt} ska börja med https://.`, 'ogiltig');
  if (u.username || u.password) throw new Fel(400, `${falt} får inte innehålla användarnamn eller lösenord.`, 'ogiltig');
  if (u.hash) throw new Fel(400, `${falt} får inte ha något efter #.`, 'ogiltig');
  if (String(text).length > 300) throw new Fel(400, `${falt} är för lång.`, 'ogiltig');
  return u;
}
const arOvning = (ctx, utfardare) => utfardare === ovning.utfardare(ctx.bas);
function kravTillaten(ctx, url, falt, utfardare) {
  const u = adress(url, falt);
  if (arOvning(ctx, utfardare) && u.origin === new URL(ctx.bas).origin && u.pathname.startsWith(ovning.SOKVAG)) return u;
  if (!ctx.tillatna.has(u.origin)) {
    throw new Fel(400, `${falt} (${u.origin}) finns inte bland de inloggningstjänster som driften har godkänt. Servern anropar bara godkända adresser, så att ingen kan få den att anropa något annat. Be driften lägga till adressen i INLOGGNING_TILLATNA. I den publika demon går bara övningstjänsten att koppla in.`, 'ogiltig', { falt: ['utfardare'] });
  }
  return u;
}

// Hämtar JSON från en godkänd adress: ingen omdirigering, tidsgräns och tak på storleken.
async function hamtaJson(ctx, url, { method = 'GET', body = null, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(url, { method, body, headers: { Accept: 'application/json', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(ctx.tidsgransMs ?? 5000) });
  } catch {
    throw new Fel(502, `Inloggningstjänsten svarar inte (${new URL(url).origin}).`, 'tjanst_svarar_inte');
  }
  const text = await res.text();
  if (text.length > MAX_SVAR) throw new Fel(502, 'Inloggningstjänstens svar är för stort.', 'tjanst_fel');
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data };
}

// --- Konfigurationen ---

const kravRoll = (personal) => { if (!kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen kopplar in inloggningstjänster.', 'nekad'); };
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs, grund: 'administrativ' });
const text = (v, max = 200) => (typeof v === 'string' ? v.trim() : '').slice(0, max + 1);
const jsonFalt = (v, falt) => {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { throw new Fel(400, `${falt} är inte giltig JSON.`, 'ogiltig'); }
};

// Vårdgivaren som en enhet hör till, i masterdata.
function vardgivareFor(db, enhetId) {
  let id = enhetId;
  for (let i = 0; i < 8 && id; i++) {
    const e = db.query('SELECT id, hsa_id, namn, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!e) return null;
    if (e.typ === 'vardgivare') return e;
    id = e.forald_id;
  }
  return null;
}

// Prövar en hel konfiguration och ger den normaliserade. Samma prövning när den föreslås och när den godkänns, eftersom
// listan över godkända adresser kan ha ändrats.
export function prova(db, konf, ctx) {
  const k = {};
  k.id = text(konf.id, 40);
  if (!/^t-[a-f0-9]{8}$/.test(k.id)) throw new Fel(400, 'Inloggningstjänstens id är ogiltigt.', 'ogiltig');
  k.namn = text(konf.namn, 80);
  if (k.namn.length < 3) throw new Fel(400, 'Skriv tjänstens namn, så som personalen känner igen den, till exempel Regionens inloggningstjänst.', 'ogiltig', { falt: ['namn'] });
  if (k.namn.length > 80) throw new Fel(400, 'Namnet får vara högst 80 tecken.', 'ogiltig', { falt: ['namn'] });
  if (/[\u2014\u2013\u2026<>]/.test(k.namn)) throw new Fel(400, 'Skriv namnet utan tankstreck, ellipser och vinkelparenteser.', 'ogiltig', { falt: ['namn'] });
  const vg = db.query("SELECT hsa_id, namn FROM enheter WHERE hsa_id = ? AND typ = 'vardgivare'").get(text(konf.vardgivareHsaId));
  if (!vg) throw new Fel(400, 'Vårdgivaren finns inte i masterdata.', 'ogiltig', { falt: ['vardgivareHsaId'] });
  k.vardgivareHsaId = vg.hsa_id;
  k.protokoll = konf.protokoll ?? 'oidc';
  if (k.protokoll === 'saml') throw new Fel(400, 'SAML 2.0 stöds inte ännu. Ineras IdP för medarbetare talar också OpenID Connect, som Vårdkällan stödjer. Välj OpenID Connect.', 'ogiltig', { falt: ['protokoll'] });
  if (k.protokoll !== 'oidc') throw new Fel(400, 'Välj OpenID Connect.', 'ogiltig', { falt: ['protokoll'] });
  k.utfardare = text(konf.utfardare, 300);
  adress(k.utfardare, 'Utfärdaren');
  k.simulerad = arOvning(ctx, k.utfardare);
  k.authorizationEndpoint = kravTillaten(ctx, konf.authorizationEndpoint, 'Adressen för inloggning (authorization_endpoint)', k.utfardare).href;
  k.tokenEndpoint = kravTillaten(ctx, konf.tokenEndpoint, 'Adressen för biljetten (token_endpoint)', k.utfardare).href;
  k.jwksUri = konf.jwksUri ? kravTillaten(ctx, konf.jwksUri, 'Adressen för nycklarna (jwks_uri)', k.utfardare).href : null;
  k.klientId = text(konf.klientId, 200);
  if (!k.klientId || k.klientId.length > 200 || !/^[\x21-\x7e]+$/.test(k.klientId)) throw new Fel(400, 'Skriv klient-id, som inloggningstjänsten gav Vårdkällan när den registrerades där.', 'ogiltig', { falt: ['klientId'] });
  k.klientautentisering = konf.klientautentisering ?? 'private_key_jwt';
  if (!Object.hasOwn(KLIENTAUTENTISERING, k.klientautentisering)) throw new Fel(400, 'Välj hur Vårdkällan autentiserar sig mot tjänsten.', 'ogiltig', { falt: ['klientautentisering'] });
  k.hemlighetMiljo = null;
  if (k.klientautentisering === 'client_secret_basic') {
    k.hemlighetMiljo = text(konf.hemlighetMiljo, 50);
    if (!HEMLIGHET_NAMN.test(k.hemlighetMiljo)) throw new Fel(400, 'Skriv namnet på miljövariabeln där driften lägger hemligheten. Namnet börjar med VK_IDP_ och har bara versaler, siffror och understreck. Hemligheten själv skrivs aldrig in här.', 'ogiltig', { falt: ['hemlighetMiljo'] });
  }
  k.attributprofil = konf.attributprofil ?? 'inera-3.3';
  if (!Object.hasOwn(ATTRIBUTPROFIL, k.attributprofil)) throw new Fel(400, 'Attributprofilen finns inte.', 'ogiltig');
  k.scope = SCOPE;
  const nycklar = Array.isArray(konf.nycklar) ? konf.nycklar : [];
  if (!nycklar.length) throw new Fel(400, 'Inloggningstjänsten har inga nycklar att lägga in.', 'ogiltig', { falt: ['jwks'] });
  if (nycklar.length > 10) throw new Fel(400, 'Högst tio nycklar kan läggas in.', 'ogiltig', { falt: ['jwks'] });
  k.nycklar = nycklar.map((n) => {
    const p = jwt.provaNyckel(n);
    if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: ['jwks'] });
    return p.jwk;
  });
  if (k.nycklar.length > 1 && (k.nycklar.some(n => !n.kid) || new Set(k.nycklar.map(n => n.kid)).size !== k.nycklar.length)) {
    throw new Fel(400, 'Med flera nycklar måste varje nyckel ha ett eget id (kid).', 'ogiltig', { falt: ['jwks'] });
  }
  k.aktiv = konf.aktiv !== false;
  return k;
}

// Kontrollerar tjänstens metadata (OpenID Connect Discovery) och ger adresserna. Systemet säger vad som saknas.
function lasMetadata(m, utfardare, klientautentisering) {
  if (!m || typeof m !== 'object') throw new Fel(400, 'Tjänstens metadata (openid-configuration) går inte att läsa.', 'ogiltig', { falt: ['metadata'] });
  if (m.issuer !== utfardare) throw new Fel(400, `Tjänsten anger utfärdaren ${String(m.issuer ?? 'ingen').slice(0, 120)}, men adressen som skrevs in är ${utfardare}. De ska vara exakt lika (OpenID Connect Discovery 4.3).`, 'ogiltig', { falt: ['utfardare'] });
  const lista = (v) => (Array.isArray(v) ? v : null);
  if (lista(m.response_types_supported) && !m.response_types_supported.includes('code')) throw new Fel(400, 'Tjänsten stödjer inte authorization code, som Vårdkällan kräver.', 'ogiltig');
  if (lista(m.code_challenge_methods_supported) && !m.code_challenge_methods_supported.includes('S256')) throw new Fel(400, 'Tjänsten stödjer inte PKCE med S256, som Vårdkällan kräver.', 'ogiltig');
  if (lista(m.id_token_signing_alg_values_supported) && !m.id_token_signing_alg_values_supported.some(a => Object.hasOwn(jwt.ALGORITMER, a))) {
    throw new Fel(400, `Tjänsten signerar inte biljetter med någon av algoritmerna ${Object.keys(jwt.ALGORITMER).join(', ')}.`, 'ogiltig');
  }
  if (lista(m.token_endpoint_auth_methods_supported) && !m.token_endpoint_auth_methods_supported.includes(klientautentisering)) {
    throw new Fel(400, `Tjänsten stödjer inte ${KLIENTAUTENTISERING[klientautentisering] ?? klientautentisering}. Välj ett annat sätt att autentisera Vårdkällan.`, 'ogiltig', { falt: ['klientautentisering'] });
  }
  return { authorizationEndpoint: m.authorization_endpoint, tokenEndpoint: m.token_endpoint, jwksUri: m.jwks_uri ?? null };
}

// Hämtar metadata och nycklar: för övningstjänsten direkt, annars från en godkänd adress. Det som systemförvaltaren har
// klistrat in används i stället för det som hämtas.
async function uppgifter(ctx, utfardare, { metadata = null, jwks = null, klientautentisering }) {
  let m = metadata;
  if (!m) {
    if (arOvning(ctx, utfardare)) m = ovning.metadata(ctx.bas);
    else {
      const u = kravTillaten(ctx, `${utfardare.replace(/\/$/, '')}/.well-known/openid-configuration`, 'Utfärdaren', utfardare);
      const r = await hamtaJson(ctx, u.href);
      if (r.status !== 200 || !r.data) throw new Fel(400, `Tjänstens metadata gick inte att hämta (svar ${r.status}). Klistra in metadata och nycklar i stället.`, 'ogiltig');
      m = r.data;
    }
  }
  const adr = lasMetadata(m, utfardare, klientautentisering);
  let n = jwks;
  if (!n) {
    if (arOvning(ctx, utfardare)) n = ovning.jwks();
    else {
      if (!adr.jwksUri) throw new Fel(400, 'Tjänsten anger ingen adress för nycklarna (jwks_uri). Klistra in nycklarna i stället.', 'ogiltig');
      const u = kravTillaten(ctx, adr.jwksUri, 'Adressen för nycklarna (jwks_uri)', utfardare);
      const r = await hamtaJson(ctx, u.href);
      if (r.status !== 200 || !r.data) throw new Fel(400, `Tjänstens nycklar gick inte att hämta (svar ${r.status}).`, 'ogiltig');
      n = r.data;
    }
  }
  if (!n || !Array.isArray(n.keys)) throw new Fel(400, 'Nycklarna är inte en JWKS (ett objekt med keys).', 'ogiltig', { falt: ['jwks'] });
  // Nycklar för kryptering hör inte hit. De hoppas över i stället för att stoppa, eftersom en JWKS ofta har båda.
  const sig = n.keys.filter(x => x && typeof x === 'object' && x.use !== 'enc');
  return { ...adr, nycklar: sig };
}

function andringar(db) {
  try { return db.query('SELECT * FROM inloggningstjanst_andringar ORDER BY id').all(); } catch { return []; }
}

// De gällande inloggningstjänsterna: för varje tjänst den senast godkända versionen.
export function gallande(db) {
  const ut = new Map();
  for (const a of andringar(db).filter(x => x.status === 'godkand').sort((x, y) => (x.beslutad === y.beslutad ? x.id - y.id : x.beslutad.localeCompare(y.beslutad)))) {
    ut.set(a.tjanst, { konf: JSON.parse(a.konfiguration), andringId: a.id });
  }
  return ut;
}
export const aktiva = (db) => [...gallande(db).values()].filter(g => g.konf.aktiv).map(g => g.konf);

function hamta(db, id) {
  const a = (() => { try { return db.query('SELECT * FROM inloggningstjanst_andringar WHERE id = ?').get(Number(id)); } catch { return null; } })();
  if (!a) throw new Fel(404, 'Ändringen finns inte.', 'saknas');
  return a;
}

const motivering = (m) => {
  const t = typeof m === 'string' ? m.trim() : '';
  if (!t) throw new Fel(400, 'Skriv varför ändringen behövs. Motiveringen följer med ändringen i historiken.', 'ogiltig', { falt: ['motivering'] });
  if (t.length > 1000) throw new Fel(400, 'Motiveringen får vara högst 1000 tecken.', 'ogiltig', { falt: ['motivering'] });
  return t;
};
function kravIngenVantande(db, tjanst) {
  if (andringar(db).some(a => a.tjanst === tjanst && a.status === 'vantar')) {
    throw new Fel(409, 'Det finns redan en ändring av tjänsten som väntar på godkännande. Godkänn, avslå eller återkalla den först.', 'ogiltig');
  }
}
function spara(db, personal, tjanst, atgard, konf, forra, m, nu) {
  const r = db.query(`INSERT INTO inloggningstjanst_andringar (tjanst, atgard, konfiguration, forra, motivering, foreslagen_av, foreslagen)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(tjanst, atgard, JSON.stringify(konf), forra ? JSON.stringify(forra) : null, m, personal.id, iso(nu));
  const id = Number(r.lastInsertRowid);
  loggaAtgard(db, personal, `inloggningstjanst:${id}`);
  return andringUt(db, hamta(db, id), personal);
}

// Förslaget till en ny inloggningstjänst, utan att spara det: det systemet har hämtat och kontrollerat, med
// nycklarnas tumavtryck. ovning: true fyller i allt för övningstjänsten.
export async function forhandsvisa(db, personal, inp = {}, ctx) {
  kravRoll(personal);
  const vg = vardgivareFor(db, personal.enhet_id) ?? db.query("SELECT hsa_id, namn FROM enheter WHERE typ = 'vardgivare' ORDER BY id LIMIT 1").get();
  const ovningen = inp.ovning === true;
  const utfardare = ovningen ? ovning.utfardare(ctx.bas) : text(inp.utfardare, 300);
  if (!utfardare) throw new Fel(400, 'Skriv inloggningstjänstens adress (utfärdaren), till exempel https://idp.example.se/oidc.', 'ogiltig', { falt: ['utfardare'] });
  adress(utfardare, 'Utfärdaren');
  const klientautentisering = ovningen ? 'private_key_jwt' : inp.klientautentisering ?? 'private_key_jwt';
  const u = await uppgifter(ctx, utfardare, { metadata: ovningen ? null : jsonFalt(inp.metadata, 'Metadata'), jwks: ovningen ? null : jsonFalt(inp.jwks, 'Nycklarna'), klientautentisering });
  const konf = prova(db, {
    id: `t-${randomBytes(4).toString('hex')}`, namn: ovningen ? ovning.NAMN : inp.namn, vardgivareHsaId: inp.vardgivareHsaId ?? vg?.hsa_id,
    protokoll: inp.protokoll ?? 'oidc', utfardare, ...u, klientId: ovningen ? ovning.KLIENT_ID : inp.klientId, klientautentisering,
    hemlighetMiljo: inp.hemlighetMiljo, attributprofil: inp.attributprofil,
  }, ctx);
  return { konfiguration: konfUt(db, konf, ctx), varningar: varningar(konf) };
}

function varningar(konf) {
  const v = [];
  if (konf.klientautentisering === 'client_secret_basic' && !process.env[konf.hemlighetMiljo]) {
    v.push(`Hemligheten finns inte i serverns miljö (${konf.hemlighetMiljo}). Inloggningen fungerar först när driften har lagt in den.`);
  }
  if (konf.klientautentisering === 'private_key_jwt' && !konf.simulerad) {
    v.push(`Tjänsten behöver Vårdkällans publika nyckel för att godta klientens intyg. Nyckelns tumavtryck är ${rp.tumavtryck}, och den publiceras på /api/inloggning/rp-jwks.`);
  }
  return v;
}

export async function foresla(db, personal, inp = {}, ctx, nu = new Date()) {
  kravRoll(personal);
  const m = motivering(inp.motivering);
  const { konfiguration } = await forhandsvisa(db, personal, inp, ctx);
  const konf = prova(db, { ...konfiguration, nycklar: konfiguration.nycklar }, ctx);
  if (aktiva(db).some(t => t.utfardare === konf.utfardare && t.klientId === konf.klientId)) {
    throw new Fel(409, 'Inloggningstjänsten är redan inkopplad med samma utfärdare och klient-id.', 'ogiltig');
  }
  if (andringar(db).some(a => a.status === 'vantar' && a.atgard === 'ny' && JSON.parse(a.konfiguration).utfardare === konf.utfardare)) {
    throw new Fel(409, 'Samma inloggningstjänst väntar redan på godkännande.', 'ogiltig');
  }
  return { andring: spara(db, personal, konf.id, 'ny', konf, null, m, nu) };
}

const gallandeFor = (db, tjanst) => {
  const g = gallande(db).get(String(tjanst));
  if (!g) throw new Fel(404, 'Inloggningstjänsten finns inte.', 'saknas');
  return g;
};

// Byte av nyckel: systemet hämtar tjänstens nycklar nu (eller tar de inklistrade) och föreslår dem. Ett byte gäller
// först efter fyra ögon, så att ingen ensam kan lägga in en nyckel som systemet sedan litar på.
export async function foreslaNycklar(db, personal, tjanst, inp = {}, ctx, nu = new Date()) {
  kravRoll(personal);
  const m = motivering(inp.motivering);
  const g = gallandeFor(db, tjanst);
  kravIngenVantande(db, g.konf.id);
  const n = await nycklarNu(ctx, g.konf, jsonFalt(inp.jwks, 'Nycklarna'));
  const konf = prova(db, { ...g.konf, nycklar: n }, ctx);
  const fore = new Set(g.konf.nycklar.map(x => x.tumavtryck));
  if (konf.nycklar.length === g.konf.nycklar.length && konf.nycklar.every(x => fore.has(x.tumavtryck))) {
    throw new Fel(400, 'Nycklarna är redan inlagda. Inget behöver bytas.', 'ogiltig');
  }
  return { andring: spara(db, personal, g.konf.id, 'nyckelbyte', konf, g.konf, m, nu) };
}
async function nycklarNu(ctx, konf, inklistrade) {
  if (inklistrade) {
    if (!Array.isArray(inklistrade.keys)) throw new Fel(400, 'Nycklarna är inte en JWKS (ett objekt med keys).', 'ogiltig', { falt: ['jwks'] });
    return inklistrade.keys.filter(x => x && x.use !== 'enc');
  }
  if (konf.simulerad && arOvning(ctx, konf.utfardare)) return ovning.jwks().keys;
  if (!konf.jwksUri) throw new Fel(400, 'Tjänsten har ingen adress för nycklarna. Klistra in de nya nycklarna.', 'ogiltig', { falt: ['jwks'] });
  const r = await hamtaJson(ctx, kravTillaten(ctx, konf.jwksUri, 'Adressen för nycklarna (jwks_uri)', konf.utfardare).href);
  if (r.status !== 200 || !Array.isArray(r.data?.keys)) throw new Fel(400, `Tjänstens nycklar gick inte att hämta (svar ${r.status}).`, 'ogiltig');
  return r.data.keys.filter(x => x && x.use !== 'enc');
}

// Om tjänsten nu publicerar andra nycklar än de inlagda. Systemet föreslår då ett byte. Bara för övningstjänsten och
// adresser som driften har godkänt, och ett fel räknas som att inget är känt.
export async function nyckellage(ctx, konf) {
  try {
    const n = await nycklarNu(ctx, konf, null);
    const nu = new Set(n.map(x => jwt.provaNyckel(x)).filter(p => p.ok).map(p => p.jwk.tumavtryck));
    const inlagda = new Set(konf.nycklar.map(x => x.tumavtryck));
    return { andrad: nu.size > 0 && (nu.size !== inlagda.size || [...nu].some(t => !inlagda.has(t))) };
  } catch { return { andrad: null }; }
}

export function foreslaAktiv(db, personal, tjanst, { aktiv, motivering: mot } = {}, ctx, nu = new Date()) {
  kravRoll(personal);
  const m = motivering(mot);
  const g = gallandeFor(db, tjanst);
  kravIngenVantande(db, g.konf.id);
  const pa = aktiv === true;
  if (g.konf.aktiv === pa) throw new Fel(400, pa ? 'Tjänsten är redan påslagen.' : 'Tjänsten är redan avstängd.', 'ogiltig');
  return { andring: spara(db, personal, g.konf.id, pa ? 'ateraktivering' : 'avstangning', { ...g.konf, aktiv: pa }, g.konf, m, nu) };
}

export function godkann(db, personal, id, { kommentar } = {}, ctx, nu = new Date()) {
  kravRoll(personal);
  const a = hamta(db, id);
  if (a.status !== 'vantar') throw new Fel(409, 'Ändringen är redan beslutad.', 'ogiltig');
  if (a.foreslagen_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som föreslog ändringen måste godkänna den.', 'nekad');
  // Prövas igen: driften kan ha tagit bort adressen sedan ändringen föreslogs. En avstängning prövas inte, så att en
  // tjänst alltid går att stänga av.
  const konf = JSON.parse(a.konfiguration);
  if (a.atgard !== 'avstangning') {
    try { prova(db, konf, ctx); } catch (e) { if (e instanceof Fel) throw new Fel(400, `Ändringen kan inte godkännas: ${e.message}`, 'ogiltig'); throw e; }
  }
  db.query("UPDATE inloggningstjanst_andringar SET status = 'godkand', beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?")
    .run(personal.id, iso(nu), typeof kommentar === 'string' && kommentar.trim() ? kommentar.trim().slice(0, 500) : null, a.id);
  loggaAtgard(db, personal, `inloggningstjanst:${a.id}`);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id,
    beskrivning: `${ATGARD[a.atgard]}: ${konf.namn}, föreslagen av ${personnamn(db, a.foreslagen_av)} och godkänd av ${personal.namn}.` });
  return { andring: andringUt(db, hamta(db, a.id), personal) };
}

export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const a = hamta(db, id);
  if (a.status !== 'vantar') throw new Fel(409, 'Ändringen är redan beslutad.', 'ogiltig');
  const egen = a.foreslagen_av === personal.id;
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (!egen && !k) throw new Fel(400, 'Skriv varför ändringen avslås, så att den som föreslog den vet vad som behöver göras.', 'ogiltig', { falt: ['kommentar'] });
  db.query('UPDATE inloggningstjanst_andringar SET status = ?, beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?')
    .run(egen ? 'aterkallad' : 'avslagen', personal.id, iso(nu), k || null, a.id);
  loggaAtgard(db, personal, `inloggningstjanst:${a.id}`);
  return { andring: andringUt(db, hamta(db, a.id), personal) };
}

// Konfigurationen som den visas: utan något som är hemligt (det finns inget hemligt i den, men namnet på
// miljövariabeln visas bara som att hemligheten finns eller inte).
function konfUt(db, k, ctx) {
  const vg = db.query('SELECT namn FROM enheter WHERE hsa_id = ?').get(k.vardgivareHsaId);
  return {
    ...k, vardgivare: vg?.namn ?? k.vardgivareHsaId, klientautentiseringText: KLIENTAUTENTISERING[k.klientautentisering],
    attributprofilText: ATTRIBUTPROFIL[k.attributprofil], hemlighetFinns: k.hemlighetMiljo ? Boolean(process.env[k.hemlighetMiljo]) : null,
    redirectUri: `${ctx?.bas ?? ''}${REDIRECT}`,
  };
}

export function andringUt(db, a, personal = null) {
  const k = JSON.parse(a.konfiguration);
  const f = a.forra ? JSON.parse(a.forra) : null;
  const fore = new Set((f?.nycklar ?? []).map(n => n.tumavtryck));
  const efter = new Set(k.nycklar.map(n => n.tumavtryck));
  return {
    id: a.id, tjanst: a.tjanst, atgard: a.atgard, atgardText: ATGARD[a.atgard], namn: k.namn, utfardare: k.utfardare, simulerad: Boolean(k.simulerad),
    nycklar: k.nycklar.map(n => ({ kid: n.kid ?? null, kty: n.kty, alg: n.alg ?? null, tumavtryck: n.tumavtryck, ny: Boolean(f) && !fore.has(n.tumavtryck) })),
    borttagnaNycklar: (f?.nycklar ?? []).filter(n => !efter.has(n.tumavtryck)).map(n => ({ kid: n.kid ?? null, tumavtryck: n.tumavtryck })),
    aktiv: k.aktiv, motivering: a.motivering, foreslagenAv: personnamn(db, a.foreslagen_av), foreslagen: a.foreslagen,
    status: a.status, statusText: STATUS[a.status], beslutadAv: personnamn(db, a.beslutad_av), beslutad: a.beslutad, kommentar: a.beslut_kommentar,
    egen: personal ? a.foreslagen_av === personal.id : false,
    kanGodkanna: Boolean(personal && a.status === 'vantar' && a.foreslagen_av !== personal.id),
  };
}

// Sidan i systemförvaltningen.
export async function oversikt(db, personal, ctx) {
  kravRoll(personal);
  const alla = andringar(db);
  const tjanster = [];
  for (const g of gallande(db).values()) {
    tjanster.push({ ...konfUt(db, g.konf, ctx), nyckellage: g.konf.aktiv ? await nyckellage(ctx, g.konf) : { andrad: null },
      vantar: alla.some(a => a.tjanst === g.konf.id && a.status === 'vantar') });
  }
  const vantande = alla.filter(a => a.status === 'vantar').map(a => andringUt(db, a, personal));
  return {
    tjanster, attGodkanna: vantande.filter(a => a.kanGodkanna), mina: vantande.filter(a => a.egen),
    historik: alla.filter(a => a.status !== 'vantar').reverse().slice(0, 50).map(a => andringUt(db, a, personal)),
    vardkallan: { redirectUri: `${ctx.bas}${REDIRECT}`, rpJwksUri: `${ctx.bas}/api/inloggning/rp-jwks`, rpTumavtryck: rp.tumavtryck, scope: SCOPE },
    tillatna: [...ctx.tillatna], ovningFinns: true, attributkalla: ATTRIBUTKALLA,
    simulerad: 'Den simulerade autentiseringstjänsten med demorollerna finns kvar. Övningstjänsten är en simulerad extern inloggningstjänst i samma server. Ingen verklig regions inloggningstjänst är inkopplad i demon.',
  };
}

// Tjänsterna som visas på inloggningssidan: bara id och namn.
export const forInloggningssidan = (db) => aktiva(db).map(t => ({ id: t.id, namn: t.namn, simulerad: Boolean(t.simulerad) }));

// --- Inloggningen ---

const slump = (n = 32) => randomBytes(n).toString('base64url');
const s256 = (v) => createHash('sha256').update(v).digest('base64url');

// Början av inloggningen: state, nonce och PKCE för den här sessionen, och adressen som webbläsaren skickas till.
export function borja(s, db, tjanstId, ctx, nu = Date.now()) {
  const g = gallande(db).get(String(tjanstId));
  if (!g || !g.konf.aktiv) throw new Fel(404, 'Inloggningstjänsten finns inte eller är avstängd.', 'saknas');
  const k = g.konf;
  kravTillaten(ctx, k.authorizationEndpoint, 'Adressen för inloggning', k.utfardare);
  const vantar = (s.externaInloggningar ??= new Map());
  for (const [st, v] of vantar) if (v.skapad + VANTAR_MS < nu) vantar.delete(st);
  while (vantar.size >= MAX_VANTANDE) vantar.delete(vantar.keys().next().value);
  const state = slump();
  const nonce = slump();
  const verifier = slump(48);
  vantar.set(state, { tjanst: k.id, andringId: g.andringId, nonce, verifier, skapad: nu });
  const u = new URL(k.authorizationEndpoint);
  for (const [n, v] of Object.entries({ response_type: 'code', client_id: k.klientId, redirect_uri: `${ctx.bas}${REDIRECT}`, scope: k.scope, state, nonce, code_challenge: s256(verifier), code_challenge_method: 'S256' })) {
    u.searchParams.set(n, v);
  }
  return u.href;
}

// Klientens autentisering mot tjänstens adress för biljetten.
function klientAuth(k) {
  if (k.klientautentisering === 'client_secret_basic') {
    const h = process.env[k.hemlighetMiljo];
    if (!h) throw new Fel(503, 'Hemligheten för inloggningstjänsten finns inte i serverns miljö. Kontakta driften.', 'tjanst_fel');
    return { headers: { Authorization: `Basic ${Buffer.from(`${encodeURIComponent(k.klientId)}:${encodeURIComponent(h)}`).toString('base64')}` }, falt: {} };
  }
  const iat = Math.floor(Date.now() / 1000);
  const intyg = jwt.signera({ alg: 'ES256', typ: 'JWT', kid: rp.jwk.kid }, { iss: k.klientId, sub: k.klientId, aud: k.tokenEndpoint, jti: randomUUID(), iat, exp: iat + 60 }, rp.privat);
  return { headers: {}, falt: { client_id: k.klientId, client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: intyg } };
}

async function hamtaBiljett(k, kod, verifier, ctx) {
  const auth = klientAuth(k);
  const falt = { grant_type: 'authorization_code', code: kod, redirect_uri: `${ctx.bas}${REDIRECT}`, code_verifier: verifier, ...auth.falt };
  if (k.simulerad && arOvning(ctx, k.utfardare)) return ovning.token(falt, { bas: ctx.bas, rp: rpPublik() });
  const u = kravTillaten(ctx, k.tokenEndpoint, 'Adressen för biljetten', k.utfardare);
  const r = await hamtaJson(ctx, u.href, { method: 'POST', body: new URLSearchParams(falt).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...auth.headers } });
  if (r.status !== 200 || !r.data) {
    const kodFel = typeof r.data?.error === 'string' && /^[a-z_]{1,40}$/.test(r.data.error) ? ` (${r.data.error})` : '';
    throw new Fel(401, `Biljetten godtogs inte: inloggningstjänsten lämnade inte ut någon biljett${kodFel}.`, 'ogiltig_biljett');
  }
  return r.data;
}

// Biljetter som redan har använts, per utfärdare och jti, med tiden de går ut.
const anvanda = new Map();
const MAX_ANVANDA = 20000;

const avvisa = (skal) => { throw new Fel(401, `Biljetten godtogs inte: ${skal}`, 'ogiltig_biljett'); };

// Prövar id-biljetten. Ger påståendet.
export function provaIdBiljett(idBiljett, k, { nonce, nu = Date.now(), atkomstbiljett = null, forbruka = true } = {}) {
  let v;
  try { v = jwt.verifiera(idBiljett, k.nycklar); } catch (e) { if (e instanceof jwt.JwtFel) avvisa(e.message); throw e; }
  const p = v.pastaende;
  if (p.iss !== k.utfardare) avvisa('den är utfärdad av en annan tjänst än den inkopplade.');
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (!aud.includes(k.klientId)) avvisa('den är utfärdad till en annan tjänst.');
  // Ineras IdP lägger både klientens id och sitt eget i aud. Andra mottagare godtas inte.
  if (aud.some(a => a !== k.klientId && a !== k.utfardare)) avvisa('den är utfärdad också till andra tjänster.');
  if (p.azp !== undefined && p.azp !== k.klientId) avvisa('den är utfärdad till en annan klient (azp).');
  const s = Math.floor(nu / 1000);
  if (typeof p.exp !== 'number' || p.exp + KLOCKMARGINAL_S <= s) avvisa('den har gått ut.');
  if (typeof p.iat !== 'number' || p.iat > s + KLOCKMARGINAL_S) avvisa('den är utfärdad i framtiden.');
  if (p.iat < s - MAX_BILJETTALDER_S) avvisa('den är för gammal.');
  if (typeof p.nbf === 'number' && p.nbf > s + KLOCKMARGINAL_S) avvisa('den gäller inte ännu.');
  if (typeof p.nonce !== 'string' || p.nonce !== nonce) avvisa('den hör inte till den här inloggningen (nonce).');
  if (atkomstbiljett && p.at_hash !== undefined && p.at_hash !== jwt.atHash(atkomstbiljett, v.huvud.alg)) avvisa('den hör inte ihop med åtkomstbiljetten (at_hash).');
  if (!TILLITSNIVAER.includes(p.acr)) avvisa('tillitsnivån räcker inte. Personalen ska logga in med tillitsnivå 3 eller högre, till exempel SITHS.');
  if (typeof p.sub !== 'string' || !p.sub) avvisa('den saknar subjekt (sub).');
  const jti = typeof p.jti === 'string' && p.jti ? `${k.utfardare} ${p.jti}` : null;
  if (jti) {
    for (const [j, exp] of anvanda) if (exp * 1000 < nu) anvanda.delete(j);
    if (anvanda.has(jti)) avvisa('den har redan använts.');
    if (forbruka) {
      if (anvanda.size >= MAX_ANVANDA) throw new Fel(429, 'För många inloggningar just nu. Försök igen om en stund.', 'nekad');
      anvanda.set(jti, p.exp);
    }
  }
  return p;
}

// Attributen enligt Ineras attributspecifikation. Bas skriver healthCare och Plus healthcare. Båda godtas, men om båda
// finns och skiljer sig motsäger biljetten sig själv.
const HSA = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
function attribut(p, namn, alternativ = null) {
  const v = p[namn];
  const w = alternativ ? p[alternativ] : undefined;
  if (v !== undefined && w !== undefined && JSON.stringify(v) !== JSON.stringify(w)) avvisa(`attributen ${namn} och ${alternativ} säger olika saker.`);
  return v ?? w;
}
export function tolka(p) {
  const str = (v, f) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'string' || v.length > 200) avvisa(`attributet ${f} är inte en text.`);
    return v.trim();
  };
  const lic = attribut(p, 'healthcareProfessionalLicense', 'healthCareProfessionalLicense');
  const lista = lic == null ? [] : Array.isArray(lic) ? lic : [lic];
  if (lista.length > 20 || lista.some(x => typeof x !== 'string')) avvisa('attributet healthcareProfessionalLicense är inte en lista med koder.');
  return {
    personHsaId: str(p.employeeHsaId, 'employeeHsaId'), uppdragHsaId: str(p.commissionHsaId, 'commissionHsaId'),
    andamal: str(p.commissionPurpose, 'commissionPurpose'), vardenhetHsaId: str(attribut(p, 'healthCareUnitHsaId', 'healthcareUnitHsaId'), 'healthCareUnitHsaId'),
    vardgivareHsaId: str(attribut(p, 'healthCareProviderHsaId', 'healthcareProviderHsaId'), 'healthCareProviderHsaId'),
    legitimation: lista.map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)),
    fornamn: str(p.given_name, 'given_name'), efternamn: str(p.family_name, 'family_name'), tillitsniva: p.acr,
  };
}

// Prövar attributen mot masterdata. Ger personen och medarbetaruppdraget för sessionen. Saknas ett attribut, eller
// motsäger det masterdata, blir det ingen åtkomst.
export function provaMotMasterdata(db, k, a, p) {
  const nek = (t) => { throw new Fel(403, t, 'nekad'); };
  for (const [f, namn] of [['personHsaId', 'employeeHsaId (personens HSA-id)'], ['uppdragHsaId', 'commissionHsaId (medarbetaruppdraget)'], ['andamal', 'commissionPurpose (uppdragets ändamål)'], ['vardenhetHsaId', 'healthCareUnitHsaId (vårdenheten)'], ['vardgivareHsaId', 'healthCareProviderHsaId (vårdgivaren)']]) {
    if (!a[f]) nek(`Biljetten saknar attributet ${namn}. Inloggningstjänsten behöver lämna ut det för att Vårdkällan ska kunna räkna ut behörigheten. Kontakta systemförvaltningen.`);
  }
  for (const f of ['personHsaId', 'uppdragHsaId', 'vardenhetHsaId', 'vardgivareHsaId']) if (!HSA.test(a[f])) nek('Ett HSA-id i biljetten har fel form.');
  const pers = db.query('SELECT * FROM personal WHERE hsa_id = ?').get(a.personHsaId);
  if (!pers) nek('Personen i biljetten finns inte i katalogen. Kontakta din chef om du ska ha åtkomst.');
  if (pers.yrke === 'systemkonto') nek('Ett systemkonto för en extern tillämpning kan inte logga in som en person.');
  if (!pers.aktiv) nek(`${pers.namn} finns inte som aktiv personal i katalogen och kan inte logga in. Kontakta din chef om du ska ha åtkomst.`);
  const vg = vardgivareFor(db, pers.enhet_id);
  if (a.vardgivareHsaId !== k.vardgivareHsaId) nek('Biljetten gäller en annan vårdgivare än den som inloggningstjänsten är inkopplad för.');
  if (!vg || vg.hsa_id !== a.vardgivareHsaId) nek(`Medarbetaruppdraget i biljetten gäller en annan vårdgivare än den ${pers.namn} arbetar hos enligt katalogen.`);
  const u = uppdragFor(db, pers);
  if (!u) nek('Personen har inget medarbetaruppdrag på en vårdenhet i katalogen.');
  if (a.vardenhetHsaId !== u.healthCareUnitHsaId) nek(`Medarbetaruppdraget i biljetten gäller en annan vårdenhet än ${u.healthCareUnitName}, där ${pers.namn} arbetar enligt katalogen. Välj uppdraget för ${u.healthCareUnitName} när du loggar in, eller be den som administrerar HSA rätta uppdraget.`);
  if (a.uppdragHsaId !== u.commissionHsaId) nek('Medarbetaruppdraget i biljetten finns inte i katalogen. Be den som administrerar HSA kontrollera uppdraget.');
  if (a.andamal !== u.commissionPurpose) nek(`Medarbetaruppdraget gäller ändamålet ${a.andamal}, men rollen kräver ett uppdrag för ${u.commissionPurpose.toLowerCase()}. Be den som administrerar HSA rätta uppdragets ändamål.`);
  const kravs = LEGITIMATION[pers.yrke];
  if (kravs && !a.legitimation.some(l => kravs.includes(l))) {
    nek(`Biljetten saknar legitimationen som ${kravs.map(l => LEGITIMATION_NAMN[l]).join(' eller ')}, som rollen kräver enligt katalogen. Legitimationen kommer från Socialstyrelsens register genom HSA. Kontakta din chef om den saknas.`);
  }
  return {
    personal: pers,
    uppdrag: {
      utfardare: k.utfardare, extern: true, tjanst: k.id, tjanstNamn: k.namn, simulerad: Boolean(k.simulerad), personHsaId: a.personHsaId,
      uppdragHsaId: a.uppdragHsaId, andamal: a.andamal, vardenhetHsaId: a.vardenhetHsaId, vardgivareHsaId: a.vardgivareHsaId, yrke: pers.yrke,
      legitimation: a.legitimation, tillitsniva: a.tillitsniva, autentiserad: new Date(((typeof p.auth_time === 'number' ? p.auth_time : p.iat)) * 1000).toISOString(),
      biljett: typeof p.jti === 'string' ? p.jti.slice(0, 100) : null,
    },
  };
}

// Svaret från tjänsten (redirect_uri). Ger { personal, uppdrag, tjanst } eller kastar Fel med orsaken.
export async function tillbaka(s, db, q, ctx, nu = Date.now()) {
  const state = typeof q.get('state') === 'string' ? q.get('state') : '';
  const v = state && s.externaInloggningar?.get(state);
  if (!v || v.skapad + VANTAR_MS < nu) {
    if (v) s.externaInloggningar.delete(state);
    throw new Fel(400, 'Inloggningen hör inte till den här webbläsaren, har redan använts eller har gått ut. Börja om från inloggningssidan.', 'ogiltig_biljett');
  }
  // state används en gång, också när något nedan går fel.
  s.externaInloggningar.delete(state);
  const g = gallande(db).get(v.tjanst);
  if (!g || !g.konf.aktiv) throw new Fel(403, 'Inloggningstjänsten är inte längre godkänd. Kontakta systemförvaltningen.', 'nekad');
  const k = g.konf;
  const tjanst = { id: k.id, namn: k.namn };
  if (q.get('error')) {
    const e = String(q.get('error'));
    throw Object.assign(new Fel(401, `Inloggningstjänsten avbröt inloggningen${/^[a-z_]{1,40}$/.test(e) ? ` (${e})` : ''}. Försök igen, eller kontakta systemförvaltningen om det inte går.`, 'ogiltig_biljett'), { tjanst });
  }
  // RFC 9207: utfärdaren i svaret, om tjänsten skickar den, ska vara den inkopplade.
  if (q.get('iss') && q.get('iss') !== k.utfardare) throw Object.assign(new Fel(401, 'Biljetten godtogs inte: svaret kom från en annan utfärdare.', 'ogiltig_biljett'), { tjanst });
  const kod = q.get('code');
  if (typeof kod !== 'string' || !kod || kod.length > 2000) throw Object.assign(new Fel(400, 'Svaret från inloggningstjänsten saknar kod.', 'ogiltig_biljett'), { tjanst });
  try {
    const svar = await hamtaBiljett(k, kod, v.verifier, ctx);
    if (typeof svar?.id_token !== 'string') avvisa('inloggningstjänsten lämnade inte ut någon id-biljett.');
    const p = provaIdBiljett(svar.id_token, k, { nonce: v.nonce, nu, atkomstbiljett: typeof svar.access_token === 'string' ? svar.access_token : null });
    const a = tolka(p);
    return { ...provaMotMasterdata(db, k, a, p), tjanst };
  } catch (e) { if (e instanceof Fel) e.tjanst = tjanst; throw e; }
}

// Om sessionens uppdrag från en extern tjänst fortfarande gäller: tjänsten ska vara godkänd och påslagen nu. Ger null
// när det gäller, annars orsaken. Slås upp i databasen vid varje anrop.
export function galler(db, uppdrag) {
  if (!uppdrag?.extern) return null;
  const g = gallande(db).get(uppdrag.tjanst);
  if (!g || !g.konf.aktiv) return 'Inloggningstjänsten som du loggade in med är avstängd.';
  if (g.konf.utfardare !== uppdrag.utfardare) return 'Inloggningstjänsten som du loggade in med har ändrats.';
  return null;
}
