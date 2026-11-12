// Runda 14, r1: en lokal testutfärdare (OpenID Connect Provider) på en egen port med egna nycklar, för servertesterna av
// inloggningen genom beställarens inloggningstjänst (Sussa 5.2.1.1). Den talar HTTP som en extern tjänst: metadata,
// JWKS, inloggningsbegäran som direkt skickar tillbaka en kod, och bytet av koden mot en id-biljett med kontroll av PKCE,
// redirect_uri och klientens autentisering. Testerna kan ändra attributen och biljetten för att pröva angreppen.
import { generateKeyPairSync, createHash, randomBytes, randomUUID } from 'node:crypto';
import * as jwt from '../src/oidc-jwt.js';

const nyNyckel = (kid, typ = 'ec') => {
  const { privateKey, publicKey } = typ === 'rsa' ? generateKeyPairSync('rsa', { modulusLength: 2048 }) : generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { kid, privat: privateKey, alg: typ === 'rsa' ? 'RS256' : 'ES256', jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: typ === 'rsa' ? 'RS256' : 'ES256' } };
};

export function startaTestutfardare({ klientId = 'vardkallan-test', hemlighet = null, rpJwk = null, nyckeltyp = 'ec' } = {}) {
  const ut = {
    klientId, nycklar: [nyNyckel('test-1', nyckeltyp)], koder: new Map(), anvandaKoder: 0,
    // Attributen i nästa biljett, som en funktion av begäran. Sätts av testet.
    attribut: () => ({}),
    // Ändrar biljettens huvud och påstående före signeringen, eller ger en egen biljett.
    manipulera: null,
    tokenanrop: [],
  };
  const server = Bun.serve({
    port: 0, hostname: '127.0.0.1',
    async fetch(req) {
      const u = new URL(req.url);
      const iss = ut.iss;
      if (u.pathname === '/.well-known/openid-configuration') {
        return Response.json({ issuer: iss, authorization_endpoint: `${iss}/authorize`, token_endpoint: `${iss}/token`, jwks_uri: `${iss}/jwks`,
          response_types_supported: ['code'], code_challenge_methods_supported: ['S256'], id_token_signing_alg_values_supported: ['ES256', 'RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'] });
      }
      if (u.pathname === '/jwks') return Response.json({ keys: ut.nycklar.map(n => n.jwk) });
      if (u.pathname === '/authorize') {
        const q = u.searchParams;
        if (q.get('client_id') !== klientId || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256') return new Response('fel begäran', { status: 400 });
        const kod = randomBytes(16).toString('base64url');
        ut.koder.set(kod, { redirect: q.get('redirect_uri'), challenge: q.get('code_challenge'), nonce: q.get('nonce'), scope: q.get('scope'), anvand: false });
        const r = new URL(q.get('redirect_uri'));
        r.searchParams.set('code', kod);
        r.searchParams.set('state', q.get('state'));
        return new Response(null, { status: 302, headers: { Location: r.href } });
      }
      if (u.pathname === '/token' && req.method === 'POST') {
        const f = Object.fromEntries(new URLSearchParams(await req.text()));
        ut.tokenanrop.push({ falt: f, auth: req.headers.get('authorization') });
        const fel = (e) => Response.json({ error: e }, { status: 400 });
        const k = ut.koder.get(f.code);
        if (!k) return fel('invalid_grant');
        if (k.anvand) { ut.anvandaKoder++; return fel('invalid_grant'); }
        k.anvand = true;
        if (f.redirect_uri !== k.redirect) return fel('invalid_grant');
        if (createHash('sha256').update(f.code_verifier ?? '').digest('base64url') !== k.challenge) return fel('invalid_grant');
        if (hemlighet) {
          const v = `Basic ${Buffer.from(`${klientId}:${hemlighet}`).toString('base64')}`;
          if (req.headers.get('authorization') !== v) return Response.json({ error: 'invalid_client' }, { status: 401 });
        } else if (rpJwk) {
          try {
            const p = jwt.verifiera(f.client_assertion, [rpJwk]).pastaende;
            if (p.iss !== klientId || p.sub !== klientId || p.aud !== `${iss}/token`) throw new Error('fel intyg');
          } catch { return Response.json({ error: 'invalid_client' }, { status: 401 }); }
        }
        const n = ut.nycklar[0];
        const iat = Math.floor(Date.now() / 1000);
        let huvud = { alg: n.alg, typ: 'JWT', kid: n.kid };
        let p = { iss, sub: 'test-sub', aud: [klientId, iss], exp: iat + 300, iat, auth_time: iat, nonce: k.nonce, jti: randomUUID(), acr: 'http://id.sambi.se/loa/loa3', ...ut.attribut(k) };
        let biljett;
        if (ut.manipulera) {
          const m = ut.manipulera(huvud, p, n);
          if (typeof m === 'string') biljett = m; else [huvud, p] = m;
        }
        biljett ??= jwt.signera(huvud, p, n.privat);
        return Response.json({ access_token: randomBytes(16).toString('base64url'), token_type: 'Bearer', expires_in: 3600, id_token: biljett });
      }
      return new Response('finns inte', { status: 404 });
    },
  });
  ut.url = `http://127.0.0.1:${server.port}`;
  ut.iss = ut.url;
  ut.bytNyckel = (typ = nyckeltyp) => { ut.nycklar = [nyNyckel(`test-${ut.nycklar.length + 1}-${randomBytes(2).toString('hex')}`, typ)]; };
  ut.stopp = () => server.stop(true);
  return ut;
}
