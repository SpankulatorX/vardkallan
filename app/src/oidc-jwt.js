// Runda 14, r1 (Sussa 5.2.1.1): JWT och JWK för inloggning genom beställarens inloggningstjänst med OpenID Connect.
//
// Bara asymmetriska algoritmer godtas: ES256, ES384, RS256 och PS256. none och HMAC (HS256 och liknande) avvisas alltid,
// så att en publik nyckel aldrig kan användas som delad hemlighet. Algoritmen i biljettens huvud måste passa nyckelns
// typ och kurva, och nyckelns egen alg om den anger en. Nycklarna är publika JWK som systemförvaltaren har pinnat (lagt
// in med fyra ögon). En nyckel med privata delar eller en symmetrisk nyckel godtas aldrig.
import { createPublicKey, createHash, sign, verify, constants } from 'node:crypto';

export const ALGORITMER = {
  ES256: { kty: 'EC', crv: 'P-256', hash: 'sha256', siglen: 64 },
  ES384: { kty: 'EC', crv: 'P-384', hash: 'sha384', siglen: 96 },
  RS256: { kty: 'RSA', hash: 'sha256' },
  PS256: { kty: 'RSA', hash: 'sha256', pss: true },
};
const PRIVATA = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k', 'oth'];
const MAX_BILJETT = 16000;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const las = (del) => { try { const v = JSON.parse(Buffer.from(del, 'base64url').toString('utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };

// Tumavtrycket för en publik nyckel enligt RFC 7638 (SHA-256 över de obligatoriska fälten i ordning), som båda
// systemförvaltarna jämför med det som inloggningstjänsten publicerar.
export function tumavtryck(jwk) {
  const delar = jwk.kty === 'EC' ? { crv: jwk.crv, kty: 'EC', x: jwk.x, y: jwk.y } : { e: jwk.e, kty: 'RSA', n: jwk.n };
  return createHash('sha256').update(JSON.stringify(delar)).digest('base64url');
}

// Prövar att en JWK är en publik nyckel för signering som går att använda. Ger { ok, jwk, varfor } med en normaliserad
// nyckel som bara har de publika fälten, kid, alg och tumavtrycket.
export function provaNyckel(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) return { ok: false, varfor: 'Nyckeln är inte en JWK.' };
  if (PRIVATA.some(f => f in jwk)) return { ok: false, varfor: 'Nyckeln innehåller privata delar. Lägg bara in inloggningstjänstens publika nyckel. En privat nyckel ska aldrig lämna inloggningstjänsten.' };
  if (jwk.kty !== 'EC' && jwk.kty !== 'RSA') return { ok: false, varfor: `Nyckeltypen ${String(jwk.kty ?? 'saknas').slice(0, 10)} godtas inte. Bara EC och RSA, eftersom biljetten ska vara signerad med en asymmetrisk nyckel.` };
  if (jwk.use !== undefined && jwk.use !== 'sig') return { ok: false, varfor: 'Nyckeln är inte till för signering (use är inte sig).' };
  if (jwk.alg !== undefined && !Object.hasOwn(ALGORITMER, jwk.alg)) return { ok: false, varfor: `Algoritmen ${String(jwk.alg).slice(0, 10)} godtas inte. Bara ${Object.keys(ALGORITMER).join(', ')}.` };
  if (jwk.alg !== undefined && ALGORITMER[jwk.alg].kty !== jwk.kty) return { ok: false, varfor: 'Nyckelns algoritm passar inte nyckeltypen.' };
  if (jwk.kid !== undefined && (typeof jwk.kid !== 'string' || !jwk.kid || jwk.kid.length > 200)) return { ok: false, varfor: 'Nyckelns id (kid) är inte en text.' };
  let pub;
  const falt = jwk.kty === 'EC' ? { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y } : { kty: 'RSA', n: jwk.n, e: jwk.e };
  if (jwk.kty === 'EC' && !['P-256', 'P-384'].includes(jwk.crv)) return { ok: false, varfor: 'Kurvan godtas inte. Bara P-256 och P-384.' };
  try { pub = createPublicKey({ key: falt, format: 'jwk' }); } catch { return { ok: false, varfor: 'Nyckeln går inte att läsa.' }; }
  if (jwk.kty === 'RSA' && pub.asymmetricKeyDetails.modulusLength < 2048) return { ok: false, varfor: 'RSA-nyckeln är kortare än 2048 bitar och är inte säker nog.' };
  const ut = { ...falt, ...(jwk.kid ? { kid: jwk.kid } : {}), ...(jwk.alg ? { alg: jwk.alg } : {}), use: 'sig' };
  return { ok: true, jwk: { ...ut, tumavtryck: tumavtryck(falt) } };
}

// Algoritmerna som en pinnad nyckel kan verifiera.
function passar(jwk, alg) {
  const a = Object.hasOwn(ALGORITMER, alg) ? ALGORITMER[alg] : null;
  if (!a || a.kty !== jwk.kty) return false;
  if (a.crv && a.crv !== jwk.crv) return false;
  return !jwk.alg || jwk.alg === alg;
}

// Signerar en JWT. Används av övningstjänsten, klientens intyg (private_key_jwt) och testerna.
export function signera(huvud, pastaende, privat) {
  const a = ALGORITMER[huvud.alg];
  if (!a) throw new Error(`Algoritmen ${huvud.alg} stöds inte.`);
  const data = `${b64(huvud)}.${b64(pastaende)}`;
  const opt = a.kty === 'EC' ? { key: privat, dsaEncoding: 'ieee-p1363' } : a.pss ? { key: privat, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : { key: privat };
  return `${data}.${sign(a.hash, Buffer.from(data), opt).toString('base64url')}`;
}

// Verifierar signaturen på en JWT mot de pinnade nycklarna. Kastar ett fel med orsaken på vanlig svenska. Ger huvudet
// och påståendet; resten (utfärdare, mottagare, tider) prövar den som anropar.
export class JwtFel extends Error {}
const nej = (t) => { throw new JwtFel(t); };
export function verifiera(biljett, nycklar) {
  if (typeof biljett !== 'string' || !biljett || biljett.length > MAX_BILJETT) nej('den saknas eller är för lång.');
  const delar = biljett.split('.');
  if (delar.length !== 3) nej('den är inte en signerad JWT.');
  if (!delar.every(d => /^[A-Za-z0-9_-]*$/.test(d))) nej('den är inte kodad som en JWT.');
  const huvud = las(delar[0]);
  const p = las(delar[1]);
  if (!huvud || !p) nej('den går inte att läsa.');
  if (typeof huvud.alg !== 'string' || !Object.hasOwn(ALGORITMER, huvud.alg)) nej(`algoritmen ${String(huvud.alg ?? 'saknas').slice(0, 10)} godtas inte, bara ${Object.keys(ALGORITMER).join(', ')}.`);
  // Biljetten får inte kräva tillägg som vi inte förstår, och får inte bära egna nycklar eller hänvisa till andra.
  if ('crit' in huvud) nej('huvudet kräver tillägg (crit) som inte stöds.');
  for (const f of ['jwk', 'jku', 'x5u', 'x5c']) if (f in huvud) nej(`huvudet hänvisar till en egen nyckel (${f}), och bara de inlagda nycklarna godtas.`);
  if (huvud.typ !== undefined && !['JWT', 'jwt', 'application/jwt'].includes(huvud.typ)) nej('typen i huvudet är inte JWT.');
  const kandidater = nycklar.filter(k => (huvud.kid === undefined ? nycklar.length === 1 : k.kid === huvud.kid));
  if (!kandidater.length) nej(huvud.kid === undefined ? 'huvudet saknar nyckelns id (kid), och det finns flera inlagda nycklar.' : 'nyckeln som biljetten är signerad med är inte inlagd. En ny nyckel hos inloggningstjänsten läggs in av systemförvaltningen med fyra ögon.');
  const jwk = kandidater[0];
  if (!passar(jwk, huvud.alg)) nej(`algoritmen ${huvud.alg} passar inte den inlagda nyckeln.`);
  const a = ALGORITMER[huvud.alg];
  let sig;
  try { sig = Buffer.from(delar[2], 'base64url'); } catch { sig = Buffer.alloc(0); }
  if (a.siglen && sig.length !== a.siglen) nej('signaturen stämmer inte.');
  const pub = createPublicKey({ key: jwk.kty === 'EC' ? { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y } : { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  const opt = a.kty === 'EC' ? { key: pub, dsaEncoding: 'ieee-p1363' } : a.pss ? { key: pub, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : { key: pub };
  let ok = false;
  try { ok = verify(a.hash, Buffer.from(`${delar[0]}.${delar[1]}`), opt, sig); } catch { ok = false; }
  if (!ok) nej('signaturen stämmer inte.');
  return { huvud, pastaende: p, nyckel: jwk };
}

// at_hash enligt OpenID Connect Core 3.1.3.6: vänstra halvan av hashen av åtkomstbiljetten.
export function atHash(atkomstbiljett, alg) {
  const h = createHash(ALGORITMER[alg]?.hash ?? 'sha256').update(atkomstbiljett).digest();
  return h.subarray(0, h.length / 2).toString('base64url');
}
