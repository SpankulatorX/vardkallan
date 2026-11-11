// Runda 13, r1: API för testinbjudan, synpunkter och testledarens läsning (testinbjudan.js och synpunkter.js).
//
// Att lämna en synpunkt och göra uppdragen kräver ingen inloggning, bara en sandlåda (sessionen). Läsningen kräver
// testledarens läskod, som inte har något med sessionen eller demorollerna att göra, så att länken i inlägget och
// demorollerna aldrig ger läsrätt. Inga svar till testaren innehåller patientuppgifter ur sandlådan.
import { join, dirname } from 'node:path';
import { Fel } from './db.js';
import * as sp from './synpunkter.js';
import * as ti from './testinbjudan.js';
import { SPARAS, VARFOR, HUR_LANGE, VEM_LASER, PERSONNUMMER_TEXT, TYPER, ALLVAR, JAMFORELSE, MAX_TEXT, MAX_KONTAKT, MAX_MITT_SYSTEM } from '../public/js/synpunkt-regler.js';

const LASKOD_FEL = 'Läskoden gäller inte.';

export function registreraRutter({ rutt, sessionFil = '', synpunktFil, version, gransnittVersion, tak = sp.TAK, takJamforelser = sp.TAK_JAMFORELSER }) {
  const fil = synpunktFil || process.env.SYNPUNKT_FIL || (sessionFil ? join(dirname(sessionFil), 'synpunkter.sqlite') : ':memory:');
  sp.satNyckel({ fil: fil !== ':memory:' ? join(dirname(fil), 'synpunkter.nyckel') : null });
  const db = sp.oppna(fil);
  sp.stada(db);
  const stadning = setInterval(() => { try { sp.stada(db); } catch (e) { console.error('Synpunkterna kunde inte gallras:', e.message); } }, 6 * 3600_000);
  stadning.unref?.();

  // Det servern fyller i själv i varje synpunkt och jämförelse.
  const sammanhang = (c) => {
    const t = c.db ? (() => { try { return ti.tillstand(c.db); } catch { return { aktiv: false }; } })() : { aktiv: false };
    return {
      session: c.s ?? {}, adress: c.ip, version: version ?? 'okänd', gransnitt: gransnittVersion() ?? 'okänd', webblasare: sp.webblasare(c.ua),
      roll: c.personal?.id ?? c.invanare?.id ?? null,
      rollText: c.personal ? `${c.personal.namn}, ${c.personal.titel ?? ''}`.replace(/, $/, '') : c.invanare ? 'Invånare i Min journal' : null,
      testroll: t.aktiv ? t.testroll : '', uppdrag: t.aktiv ? t.aktuellt ?? '' : '',
    };
  };

  // Fel läskod: samma svar varje gång, och efter MAX_FEL_LASKOD fel i timmen från en adress stoppas fler försök.
  const felForsok = new Map();
  function kravLaskod(c) {
    const nyckel = sp.skapareFor(c.ip);
    const timme = Math.floor(Date.now() / 3600_000);
    const f = felForsok.get(nyckel);
    const antal = f?.timme === timme ? f.antal : 0;
    if (antal >= sp.MAX_FEL_LASKOD) throw new Fel(429, 'För många försök med fel läskod. Vänta en timme.', 'for_manga');
    if (!sp.giltigLaskod(db, c.body.laskod)) {
      felForsok.set(nyckel, { timme, antal: antal + 1 });
      if (felForsok.size > 10000) felForsok.clear();
      throw new Fel(403, LASKOD_FEL, 'nekad');
    }
  }

  // Det formuläret och sidan Om demon visar, så att sidan säger samma sak som servern gör.
  rutt('GET', '/api/synpunkter/om', () => ({ sparas: SPARAS, varfor: VARFOR, hurLange: HUR_LANGE, vemLaser: VEM_LASER, personnummer: PERSONNUMMER_TEXT,
    typer: TYPER, allvar: ALLVAR, jamforelse: JAMFORELSE, max: { text: MAX_TEXT, kontakt: MAX_KONTAKT, mittSystem: MAX_MITT_SYSTEM }, ...ti.VAL }));
  rutt('POST', '/api/synpunkter', (c) => {
    const x = sammanhang(c);
    // Profilen från startsidan fyller i det testaren inte har fyllt i i formuläret.
    const profil = c.db ? ti.profilFor(c.db) : {};
    const body = { ...c.body };
    for (const k of ['yrke', 'system', 'ar', 'vardform']) if (body[k] === undefined && profil[k]) body[k] = profil[k];
    return [201, { ...sp.spara(db, body, { ...x, tak }), sparas: SPARAS }];
  });

  // Uppdragen.
  rutt('GET', '/api/testare/roller', () => ({ roller: ti.rollerUt(), ...ti.VAL }));
  rutt('GET', '/api/testare', (c) => ti.tillstand(c.db));
  rutt('POST', '/api/testare/starta', (c) => ti.starta(c.db, c.body));
  rutt('POST', '/api/testare/profil', (c) => ti.sparaProfil(c.db, c.body));
  rutt('POST', '/api/testare/avsluta', (c) => ti.avsluta(c.db));
  rutt('POST', '/api/testare/uppdrag/:id/svar', (c, id) => ti.svara(c.db, id, c.body));
  rutt('POST', '/api/testare/uppdrag/:id/hoppa', (c, id) => ti.hoppa(c.db, id));
  rutt('POST', '/api/testare/uppdrag/:id/jamforelse', (c, id) => {
    const x = sammanhang(c);
    return [201, ti.jamfor(c.db, id, c.body, (u) => sp.sparaJamforelse(db, c.body, { ...x, ...u, tak: takJamforelser }))];
  });

  // Testledaren, med läskoden.
  rutt('POST', '/api/testledare/synpunkter', (c) => { kravLaskod(c); return sp.lista(db, { filter: c.body.filter ?? {}, namnFor: ti.namnFor }); });
  rutt('POST', '/api/testledare/export', (c) => {
    kravLaskod(c);
    const format = ['csv', 'csv-uppdrag', 'md'].includes(c.body.format) ? c.body.format : 'csv';
    const ut = sp.exportera(db, { format, filter: c.body.filter ?? {}, namnFor: ti.namnFor });
    return new Response(ut.text, { status: 200, headers: { 'Content-Type': ut.contentType, 'Content-Disposition': `attachment; filename="${ut.namn}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  });

  return { db, stopp() { clearInterval(stadning); db.close(); } };
}
