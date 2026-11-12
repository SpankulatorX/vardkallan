// Runda 14, r1 (Sussa 5.2.1.1): rutterna för inloggning genom beställarens inloggningstjänst, systemförvaltningens sida
// för inloggningstjänsterna och övningstjänsten (den simulerade externa tjänsten). Behörigheten prövas i modulerna.
import { Fel } from './db.js';
import * as tjanster from './inloggningstjanster.js';
import * as ovning from './ovningstjanst-oidc.js';
import * as sakerhetslogg from './sakerhetslogg.js';

export const UTAN_SESSION = ['/api/inloggning/rp-jwks', `${ovning.SOKVAG}/.well-known/openid-configuration`, `${ovning.SOKVAG}/jwks`];
const RESULTAT = '/#/inloggning/extern';

const omdirigera = (adress) => new Response(null, { status: 302, headers: { Location: adress, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const forhand = async (fn) => {
  try { return await fn(); } catch (e) {
    if (e instanceof Fel && [400, 409].includes(e.status)) return { ok: false, varfor: e.message };
    throw e;
  }
};

export function registreraRutter({ rutt, kravInloggad, loggaInMedUppdrag, origin = '', tillatna = '' }) {
  const ursprung = tjanster.tillatnaUrsprung(tillatna);
  const ctxFor = (c) => ({ bas: origin || `${c.url.protocol}//${c.url.host}`, tillatna: ursprung });

  // Inloggningssidan: tjänsterna som är inkopplade i sandlådan, bara id och namn.
  rutt('GET', '/api/inloggning/tjanster', (c) => ({ tjanster: tjanster.forInloggningssidan(c.db) }));
  rutt('GET', '/api/inloggning/rp-jwks', () => tjanster.rpJwks());

  // Början av inloggningen: webbläsaren skickas till tjänsten. Ett fel visas på resultatsidan.
  rutt('GET', '/api/inloggning/extern/:id', (c, id) => {
    c.kakaPaSvar = true;
    try { return omdirigera(tjanster.borja(c.s, c.db, id, ctxFor(c))); } catch (e) {
      if (!(e instanceof Fel)) throw e;
      c.s.externtResultat = { ok: false, text: e.message };
      return omdirigera(RESULTAT);
    }
  });

  // Svaret från tjänsten. Lyckas inloggningen loggas personen in som med en biljett från den simulerade tjänsten,
  // annars sparas orsaken för resultatsidan och i säkerhetsloggen.
  rutt('GET', tjanster.REDIRECT, async (c) => {
    c.kakaPaSvar = true;
    try {
      const r = await tjanster.tillbaka(c.s, c.db, c.url.searchParams, ctxFor(c));
      const ut = loggaInMedUppdrag(c, r.personal, r.uppdrag);
      sakerhetslogg.logga(c.db, { typ: ut?.flerfaktor?.kravs ? 'flerfaktor' : 'inloggning', personal_id: r.personal.id, enhet_id: r.personal.enhet_id, metod: 'GET', vag: tjanster.REDIRECT, status: 302,
        beskrivning: `Inloggning genom ${r.tjanst.namn} (OpenID Connect).${ut?.flerfaktor?.kravs ? ' Inloggningen väntar på den andra faktorn.' : ''}` });
      c.s.externtResultat = { ok: true, tjanst: r.tjanst.namn, flerfaktor: Boolean(ut?.flerfaktor?.kravs) };
    } catch (e) {
      if (!(e instanceof Fel)) throw e;
      sakerhetslogg.logga(c.db, { typ: 'inloggning_misslyckad', metod: 'GET', vag: tjanster.REDIRECT, status: e.status,
        beskrivning: `Inloggning genom ${e.tjanst?.namn ?? 'en extern inloggningstjänst'} misslyckades. ${e.message}`.slice(0, 400) });
      c.s.externtResultat = { ok: false, text: e.message, tjanst: e.tjanst?.namn ?? null };
    }
    return omdirigera(RESULTAT);
  });
  // Resultatsidan läser utfallet en gång.
  rutt('GET', '/api/inloggning/resultat', (c) => {
    const r = c.s.externtResultat ?? null;
    c.s.externtResultat = null;
    return { resultat: r };
  });

  // Systemförvaltningen.
  rutt('GET', '/api/inloggningstjanster', (c) => tjanster.oversikt(c.db, kravInloggad(c), ctxFor(c)));
  rutt('POST', '/api/inloggningstjanster/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(async () => ({ ok: true, ...(await tjanster.forhandsvisa(c.db, p, c.body, ctxFor(c))) })); });
  rutt('POST', '/api/inloggningstjanster', async (c) => [201, await tjanster.foresla(c.db, kravInloggad(c), c.body, ctxFor(c))]);
  rutt('POST', '/api/inloggningstjanster/:tjanst/nycklar', async (c, t) => [201, await tjanster.foreslaNycklar(c.db, kravInloggad(c), t, c.body, ctxFor(c))]);
  rutt('POST', '/api/inloggningstjanster/:tjanst/aktiv', (c, t) => [201, tjanster.foreslaAktiv(c.db, kravInloggad(c), t, c.body, ctxFor(c))]);
  rutt('POST', '/api/inloggningstjanster/andring/:id/godkann', (c, id) => tjanster.godkann(c.db, kravInloggad(c), id, c.body, ctxFor(c)));
  rutt('POST', '/api/inloggningstjanster/andring/:id/avsluta', (c, id) => tjanster.avsluta(c.db, kravInloggad(c), id, c.body));

  // Övningstjänsten: metadata, nycklar, inloggningsbegäran och sidan där personen loggar in.
  rutt('GET', `${ovning.SOKVAG}/.well-known/openid-configuration`, (c) => ovning.metadata(ctxFor(c).bas));
  rutt('GET', `${ovning.SOKVAG}/jwks`, () => ovning.jwks());
  rutt('GET', `${ovning.SOKVAG}/authorize`, (c) => {
    c.kakaPaSvar = true;
    try { return omdirigera(ovning.authorize(c.s, c.url.searchParams, ctxFor(c).bas)); } catch (e) {
      if (!(e instanceof Fel)) throw e;
      return new Response(`${ovning.NAMN}: ${e.message}`, { status: e.status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  });
  rutt('GET', `${ovning.SOKVAG}/begaran/:id`, (c, id) => ovning.begaran(c.s, c.db, id));
  rutt('POST', `${ovning.SOKVAG}/begaran/:id`, (c, id) => ovning.svara(c.s, c.db, id, c.body));
}
