// Runda 9, r5: inloggning genom en autentiseringstjänst (IdP) med en biljett enligt OpenID Connect (Sussa 5.2.1.6) och
// behörighet ur masterdata utan administration (Sussa 5.2.1.8).
//
// Autentiseringstjänsten är simulerad, som de andra nationella tjänsterna i demon. Den autentiserar personen med ett
// simulerat SITHS-kort (in-band, i samma webbläsare), läser personen och medarbetaruppdraget ur masterdata (HSA i drift)
// och utfärdar en id-biljett: en JWT signerad med ES256 (ECDSA P-256 och SHA-256), med personens HSA-id, uppdragets
// HSA-id, ändamål och vårdenhet, vårdgivaren och yrkesrollen som attribut. Den publika nyckeln publiceras som JWKS, och
// konfigurationen som OpenID Connect Discovery.
//
// Vårdkällan litar bara på utfärdarna i BETRODDA. En biljett godtas när algoritmen är ES256, nyckeln är utfärdarens,
// signaturen stämmer, utfärdaren och mottagaren är rätt, den inte har gått ut eller utfärdats i framtiden och den inte
// har använts förut. Inloggningen tas sedan helt ur biljettens attribut: personen ur HSA-id, vårdenheten ur uppdraget och
// behörigheten ur yrkesrollen. Systemet prövar att attributen stämmer med masterdata nu: att personen är aktiv, att
// uppdraget gäller personens vårdenhet och yrkesroll och att ändamålet passar rollen. Samma prövning görs i varje anrop
// (uppdragGaller), så en person som synkroniseringen gör inaktiv eller flyttar till en annan vårdenhet förlorar
// åtkomsten direkt, och ingen behöver ta bort något för hand.
//
// Systemet är experten: personen väljer aldrig uppdrag, vårdenhet eller behörighet. Allt räknas ut ur masterdata, och när
// något inte stämmer säger systemet på vanlig svenska vad som är fel och vem som kan rätta det.
import { generateKeyPairSync, createPublicKey, sign, verify, randomUUID, createHash } from 'node:crypto';
import { Fel } from './db.js';
import { vardenhetFor } from './atkomst.js';

export const UTFARDARE = 'urn:vardkallan:demo:simulerad-idp';
export const UTFARDARE_NAMN = 'Simulerad autentiseringstjänst (demo)';
export const MOTTAGARE = 'vardkallan';
export const ALG = 'ES256';
export const GILTIG_SEKUNDER = 300;
// Tillitsnivå 3 i e-legitimationsnämndens ramverk, som SITHS-kortet motsvarar. amr enligt RFC 8176: smartkort och PIN.
export const TILLITSNIVA = 'http://id.elegnamnden.se/loa/1.0/loa3';
const KLOCKMARGINAL_S = 60;

// Ändamålet med behandlingen (medarbetaruppdragets syfte i HSA) per yrkesroll. Rollen avgör ändamålet, så att
// personalen aldrig behöver välja det.
export const ANDAMAL = {
  lakare: 'Vård och behandling', sjukskoterska: 'Vård och behandling', underskoterska: 'Vård och behandling', fysioterapeut: 'Vård och behandling',
  farmaceut: 'Vård och behandling', vardadministrator: 'Vård och behandling', kommun: 'Vård och behandling',
  logggranskare: 'Kvalitetssäkring', uppfoljning: 'Statistik', arkivarie: 'Administration', ekonom: 'Administration',
  systemforvaltare: 'Administration', verksamhetschef: 'Administration',
};

// Utfärdarens nyckelpar skapas när servern startar. Den privata nyckeln lämnar aldrig modulen.
function nyttNyckelpar() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const kid = createHash('sha256').update(JSON.stringify([jwk.crv, jwk.x, jwk.y])).digest('base64url').slice(0, 16);
  return { privateKey, publicKey, kid, jwk: { ...jwk, kid, use: 'sig', alg: ALG } };
}
const nyckel = nyttNyckelpar();

// Utfärdarna som Vårdkällan litar på, med deras publika nycklar. I drift läses nycklarna från utfärdarens JWKS.
export const BETRODDA = new Map([[UTFARDARE, { namn: UTFARDARE_NAMN, nycklar: new Map([[nyckel.kid, nyckel.publicKey]]) }]]);

export const jwks = () => ({ keys: [nyckel.jwk] });
export const konfiguration = (bas) => ({
  issuer: UTFARDARE, jwks_uri: `${bas}/api/idp/jwks`, id_token_signing_alg_values_supported: [ALG], subject_types_supported: ['public'],
  response_types_supported: ['id_token'], claims_supported: ['sub', 'employeeHsaId', 'name', 'commissionHsaId', 'commissionPurpose', 'healthCareUnitHsaId',
    'healthCareUnitName', 'healthCareProviderHsaId', 'professionCode', 'acr', 'amr', 'auth_time', 'jti'],
  acr_values_supported: [TILLITSNIVA], 'x-simulerad': `${UTFARDARE_NAMN}. Ingen verklig autentiseringstjänst är ansluten.`,
});

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Signerar en biljett med en given nyckel. Testerna använder den för att göra förfalskade biljetter med egna nycklar.
export function signera(huvud, pastaende, privat) {
  const data = `${b64(huvud)}.${b64(pastaende)}`;
  return `${data}.${sign('sha256', Buffer.from(data), { key: privat, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

// Vårdgivaren som en enhet hör till: den närmaste överordnade enheten av typen vårdgivare eller kommun.
function vardgivareFor(db, enhetId) {
  let id = enhetId;
  for (let i = 0; i < 8 && id; i++) {
    const e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!e) return null;
    if (e.typ === 'vardgivare' || e.typ === 'kommun') return e.id;
    id = e.forald_id;
  }
  return null;
}
const enhet = (db, id) => (id ? db.query('SELECT * FROM enheter WHERE id = ?').get(id) : null);
// Medarbetaruppdragets HSA-id räknas ur personens HSA-id och vårdenhetens, så att samma person och vårdenhet alltid ger
// samma uppdrag, och ett nytt uppdrag när personen byter vårdenhet.
export const uppdragHsaId = (personHsa, enhetHsa) => `${personHsa}-${createHash('sha256').update(`${personHsa} ${enhetHsa}`).digest('hex').slice(0, 8).toUpperCase()}`;

// Medarbetaruppdraget som masterdata ger personen just nu: vårdenheten, vårdgivaren, ändamålet och yrkesrollen.
export function uppdragFor(db, p) {
  const ve = enhet(db, vardenhetFor(db, p.enhet_id));
  const vg = enhet(db, vardgivareFor(db, p.enhet_id));
  if (!ve) return null;
  return {
    commissionHsaId: uppdragHsaId(p.hsa_id, ve.hsa_id), commissionPurpose: ANDAMAL[p.yrke] ?? 'Vård och behandling',
    healthCareUnitHsaId: ve.hsa_id, healthCareUnitName: ve.namn, healthCareProviderHsaId: vg?.hsa_id ?? null, professionCode: p.yrke,
  };
}

// Den simulerade autentiseringstjänsten: autentiserar personen med det simulerade SITHS-kortet och utfärdar biljetten.
// Personen måste vara aktiv i masterdata, annars utfärdas ingen biljett.
export function autentisera(db, p, { nu = Date.now(), nonce = null } = {}) {
  if (!p) throw new Fel(400, 'Personen finns inte i katalogen.', 'ogiltig');
  if (!p.aktiv) throw new Fel(403, `${p.namn} finns inte som aktiv personal i katalogen och kan inte logga in. Kontakta din chef om du ska ha åtkomst.`, 'nekad');
  const u = uppdragFor(db, p);
  if (!u) throw new Fel(403, 'Personen har inget medarbetaruppdrag på en vårdenhet.', 'nekad');
  const iat = Math.floor(nu / 1000);
  return utfarda({
    iss: UTFARDARE, aud: MOTTAGARE, sub: p.hsa_id, employeeHsaId: p.hsa_id, name: p.namn, ...u,
    acr: TILLITSNIVA, amr: ['sc', 'pin'], auth_time: iat, iat, exp: iat + GILTIG_SEKUNDER, jti: randomUUID(), ...(nonce ? { nonce } : {}),
  });
}
// Utfärdarens signering av attributen. Bara servern når den. Testerna använder den för biljetter med fel attribut men
// rätt signatur, för att visa att attributen prövas för sig.
export const utfarda = (pastaende) => signera({ alg: ALG, typ: 'JWT', kid: nyckel.kid }, pastaende, nyckel.privateKey);

// Biljetter som redan har använts, med tiden de går ut. En biljett går bara att använda en gång.
// Biljetterna går ut efter fem minuter, och bara biljetter med giltig signatur kommer hit, så listan är liten. Taket
// skyddar ändå servern om någon skulle få tag på många giltiga biljetter.
const anvanda = new Map();
const MAX_ANVANDA = 20000;
function stadaAnvanda(nu) { for (const [jti, exp] of anvanda) if (exp * 1000 < nu) anvanda.delete(jti); }

const avvisa = (skal) => { throw new Fel(401, `Biljetten godtogs inte: ${skal}`, 'ogiltig_biljett'); };
function las(del) { try { return JSON.parse(Buffer.from(del, 'base64url').toString('utf8')); } catch { return null; } }

// Verifierar biljetten och ger dess attribut. Kastar Fel med orsaken på vanlig svenska. forbruka: false prövar bara.
export function verifiera(biljett, { nu = Date.now(), forbruka = true } = {}) {
  if (typeof biljett !== 'string' || biljett.length > 8000) avvisa('den saknas eller är för lång.');
  const delar = biljett.split('.');
  if (delar.length !== 3) avvisa('den är inte en signerad JWT.');
  const huvud = las(delar[0]);
  const p = las(delar[1]);
  if (!huvud || !p || typeof p !== 'object') avvisa('den går inte att läsa.');
  if (huvud.alg !== ALG) avvisa(`algoritmen godtas inte, bara ${ALG}.`);
  const utf = BETRODDA.get(p.iss);
  if (!utf) avvisa('utfärdaren är inte en betrodd autentiseringstjänst.');
  const nyck = utf.nycklar.get(huvud.kid);
  if (!nyck) avvisa('nyckeln är inte utfärdarens.');
  let sig;
  try { sig = Buffer.from(delar[2], 'base64url'); } catch { sig = Buffer.alloc(0); }
  const ok = sig.length === 64 && verify('sha256', Buffer.from(`${delar[0]}.${delar[1]}`), { key: nyck, dsaEncoding: 'ieee-p1363' }, sig);
  if (!ok) avvisa('signaturen stämmer inte.');
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (!aud.includes(MOTTAGARE)) avvisa('den är utfärdad till en annan tjänst.');
  const s = Math.floor(nu / 1000);
  if (typeof p.exp !== 'number' || p.exp <= s) avvisa('den har gått ut.');
  if (typeof p.iat !== 'number' || p.iat > s + KLOCKMARGINAL_S) avvisa('den är utfärdad i framtiden.');
  if (typeof p.nbf === 'number' && p.nbf > s + KLOCKMARGINAL_S) avvisa('den gäller inte ännu.');
  if (p.acr !== TILLITSNIVA) avvisa('tillitsnivån räcker inte.');
  for (const f of ['employeeHsaId', 'commissionHsaId', 'commissionPurpose', 'healthCareUnitHsaId', 'professionCode', 'jti']) {
    if (typeof p[f] !== 'string' || !p[f]) avvisa(`attributet ${f} saknas.`);
  }
  stadaAnvanda(nu);
  if (anvanda.has(p.jti)) avvisa('den har redan använts.');
  if (forbruka) {
    if (anvanda.size >= MAX_ANVANDA) throw new Fel(429, 'För många inloggningar just nu. Försök igen om en stund.', 'nekad');
    anvanda.set(p.jti, p.exp);
  }
  return p;
}

// Prövar biljettens attribut mot masterdata och ger personen och uppdraget för sessionen.
export function loggaIn(db, attribut) {
  const p = db.query('SELECT * FROM personal WHERE hsa_id = ?').get(attribut.employeeHsaId);
  if (!p) throw new Fel(403, 'Personen i biljetten finns inte i katalogen.', 'nekad');
  // Runda 10, r1: ett systemkonto för en extern tillämpning är ingen person och kan aldrig logga in (systemkonton.js).
  if (p.yrke === 'systemkonto') throw new Fel(403, 'Ett systemkonto för en extern tillämpning kan inte logga in som en person.', 'nekad');
  if (!p.aktiv) throw new Fel(403, `${p.namn} finns inte längre som aktiv personal i katalogen och kan inte logga in. Kontakta din chef om du ska ha åtkomst.`, 'nekad');
  const u = uppdragFor(db, p);
  const fel = jamfor(p, u, attribut);
  if (fel) throw new Fel(403, fel, 'nekad');
  return {
    personal: p,
    uppdrag: {
      utfardare: attribut.iss, personHsaId: attribut.employeeHsaId, uppdragHsaId: attribut.commissionHsaId, andamal: attribut.commissionPurpose,
      vardenhetHsaId: attribut.healthCareUnitHsaId, vardgivareHsaId: attribut.healthCareProviderHsaId ?? null, yrke: attribut.professionCode,
      tillitsniva: attribut.acr, autentiserad: new Date((attribut.auth_time ?? attribut.iat) * 1000).toISOString(), biljett: attribut.jti,
    },
  };
}

// Skillnaden mellan uppdraget i biljetten och det som masterdata säger nu, på vanlig svenska. null när de stämmer.
function jamfor(p, u, a) {
  if (!u) return 'Personen har inget medarbetaruppdrag på en vårdenhet i katalogen.';
  if (a.healthCareUnitHsaId !== u.healthCareUnitHsaId) return `Medarbetaruppdraget i biljetten gäller en annan vårdenhet än ${u.healthCareUnitName}, där ${p.namn} arbetar enligt katalogen.`;
  if (a.commissionHsaId !== u.commissionHsaId) return 'Medarbetaruppdraget i biljetten finns inte i katalogen.';
  if (a.professionCode !== p.yrke) return 'Yrkesrollen i biljetten stämmer inte med katalogen.';
  if (a.commissionPurpose !== u.commissionPurpose) return `Medarbetaruppdraget gäller ändamålet ${a.commissionPurpose}, men rollen kräver ett uppdrag för ${u.commissionPurpose.toLowerCase()}.`;
  return null;
}

// Om sessionens uppdrag fortfarande gäller enligt masterdata. Ger null när det gäller, annars orsaken.
export function uppdragGaller(db, p, uppdrag) {
  if (!p) return 'Personen finns inte i katalogen.';
  if (!p.aktiv) return 'Personen är inte längre aktiv i katalogen.';
  if (!uppdrag) return 'Inloggningen saknar medarbetaruppdrag.';
  if (uppdrag.personHsaId !== p.hsa_id) return 'Personens HSA-id har ändrats i katalogen.';
  const u = uppdragFor(db, p);
  return jamfor(p, u, { healthCareUnitHsaId: uppdrag.vardenhetHsaId, commissionHsaId: uppdrag.uppdragHsaId, professionCode: uppdrag.yrke, commissionPurpose: uppdrag.andamal });
}

// Uppdraget för en session som sparades av en äldre version, före biljetterna: det räknas ur masterdata.
export function uppdragUrMasterdata(db, p) {
  const u = p && uppdragFor(db, p);
  if (!u) return null;
  return { utfardare: UTFARDARE, personHsaId: p.hsa_id, uppdragHsaId: u.commissionHsaId, andamal: u.commissionPurpose, vardenhetHsaId: u.healthCareUnitHsaId,
    vardgivareHsaId: u.healthCareProviderHsaId, yrke: p.yrke, tillitsniva: TILLITSNIVA, autentiserad: null, biljett: null };
}

// Det som gränssnittet och API:t visar om inloggningen, utan biljettens id.
export const uppdragUt = (db, u) => (u ? {
  utfardare: BETRODDA.get(u.utfardare)?.namn ?? u.utfardare, metod: 'SITHS-kort (simulerat), OpenID Connect', andamal: u.andamal,
  uppdragHsaId: u.uppdragHsaId, vardenhet: db.query('SELECT namn FROM enheter WHERE hsa_id = ?').get(u.vardenhetHsaId)?.namn ?? null, tillitsniva: u.tillitsniva,
} : null);
