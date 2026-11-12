// Runda 12, r3 (vårt L5): Inloggning och flerfaktor. Den inloggade, i personalen eller i Min journal, registrerar en
// passkey eller en app för engångskoder. Från det ögonblicket krävs den andra faktorn vid varje inloggning som samma
// person i sandlådan. Systemet föreslår passkey först och förklarar varför.
import { esc, api, vyRubrik, medKnapp, notis, ikon, datum, dialog } from '../ui.js';
import { S } from '../app.js';
import { harPasskey, skapaPasskey, passkeyFel } from '../flerfaktor-ui.js';

export const namn = 'flerfaktor';

const METOD = { passkey: 'Din inloggning bekräftades med en passkey.', totp: 'Din inloggning bekräftades med en kod från appen.' };

function oversiktHtml(o) {
  return `<section class="ruta ff-status" data-ff-status="${o.aktiv ? 'pa' : 'av'}" aria-labelledby="ff-status">
      <h2 id="ff-status">${o.aktiv ? `${ikon.bock} Flerfaktor är på` : `${ikon.info} Flerfaktor är av`}</h2>
      <p data-ff-text>${esc(o.text)}</p>
      ${o.metod ? `<p class="dampad">${esc(METOD[o.metod] ?? '')}</p>` : ''}
    </section>
    <section aria-labelledby="ff-faktorer">
      <h2 id="ff-faktorer">Dina faktorer</h2>
      ${o.faktorer.length ? `<ul class="lista-enkel" data-ff-lista>${o.faktorer.map(f => `<li>
        <span>${f.typ === 'passkey' ? ikon.nyckel : ikon.klocka} <strong>${esc(f.namn)}</strong> <span class="dampad">${esc(f.typText)}, registrerad ${esc(datum(f.skapad))}${f.senastAnvand ? `, senast använd ${esc(datum(f.senastAnvand))}` : ''}</span></span>
        <button type="button" class="knapp text liten" data-ta-bort="${f.id}" aria-label="Ta bort ${esc(f.namn)}">${ikon.kryss}<span>Ta bort</span></button></li>`).join('')}</ul>`
        : '<p class="tom" data-ff-lista>Inga faktorer registrerade.</p>'}
    </section>
    <section aria-labelledby="ff-lagg-till">
      <h2 id="ff-lagg-till">Lägg till en faktor</h2>
      <p>En passkey är säkrast: den fungerar bara på Vårdkällans egen adress och kan därför inte lockas ut av en falsk webbplats. Du bekräftar den med telefonens eller datorns skärmlås, fingeravtryck eller ansikte.</p>
      <div class="knapprad">
        <button type="button" class="knapp" data-a="passkey"${harPasskey() ? '' : ' disabled aria-describedby="ff-ingen-passkey"'}>${ikon.nyckel}<span>Lägg till passkey</span></button>
        <button type="button" class="knapp sekundar" data-a="totp">${ikon.klocka}<span>Lägg till app för engångskoder</span></button>
      </div>
      ${harPasskey() ? '' : '<p class="liten dampad" id="ff-ingen-passkey">Webbläsaren stöder inte passkeys. Använd en app för engångskoder.</p>'}
      <div id="ff-totp"></div>
    </section>
    <section class="ruta ruta-info" aria-labelledby="ff-demo">
      <h2 id="ff-demo">Så fungerar det i demon</h2>
      <p>SITHS-kortet och e-legitimationen är simulerade i demon, men flerfaktorn är riktig: passkeys enligt WebAuthn och engångskoder enligt RFC 6238, utan någon extern tjänst. Servern sparar bara passkeyns publika nyckel och appens nyckel krypterad.</p>
      <p>Flerfaktorn gäller bara i din sandlåda och bara för den du är inloggad som. Tappar du bort din faktor återställer du sandlådan med knappen överst. Då försvinner faktorn och allt annat du har gjort, så återställningen ger aldrig åtkomst till något som faktorn skyddade.</p>
      <p>Läsläget vid ett avbrott fungerar som förut: läskopian lämnas ut när inloggningen är klar, alltså efter den andra faktorn.</p>
    </section>`;
}

function totpHtml(b) {
  return `<form class="ruta" id="ff-totp-form" novalidate aria-labelledby="ff-totp-rubrik">
    <h3 id="ff-totp-rubrik">Lägg in nyckeln i appen</h3>
    <ol>
      <li>Öppna en app för engångskoder i telefonen, till exempel den som följer med telefonens lösenordshanterare.</li>
      <li>Välj att lägga till ett konto med en nyckel, och skriv in nyckeln nedan. Allt annat är förvalt: sex siffror som byts var 30:e sekund.</li>
      <li>Skriv koden som appen visar.</li>
    </ol>
    <p><span class="dampad">Nyckel:</span> <code class="ff-nyckel" data-ff-nyckel="${esc(b.nyckel)}">${esc(b.nyckelGrupper)}</code></p>
    <p class="liten"><a href="${esc(b.uri)}">Öppna i appen på den här enheten</a></p>
    <label for="ff-ny-kod">Kod från appen</label>
    <input id="ff-ny-kod" name="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}">
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Bekräfta och slå på</button></div>
  </form>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Inloggning och flerfaktor', 'Skydda din inloggning med en passkey eller en app för engångskoder. Systemet frågar efter den vid varje inloggning.') + '<div id="ff"><p class="tom">Hämtar.</p></div>';
  const yta = main.querySelector('#ff');
  const rita = (o) => { yta.innerHTML = oversiktHtml(o); };
  rita(await api('/api/flerfaktor', { direkt: true }));
  const namn = S.session?.personal?.namn ?? S.session?.invanare?.namn ?? 'Passkey';
  yta.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.a === 'passkey') {
      const alt = await medKnapp(b, () => api('/api/flerfaktor/passkey/borja', { metod: 'POST', direkt: true })).catch(() => null);
      if (!alt) return;
      let svar;
      try { svar = await skapaPasskey(alt); } catch (err) { notis(passkeyFel(err), 'fel'); return; }
      const r = await medKnapp(b, () => api('/api/flerfaktor/passkey', { metod: 'POST', data: { namn: `Passkey för ${namn}`, svar }, direkt: true })).catch(() => null);
      if (r) { rita(r); notis('Passkeyn är registrerad. Den krävs vid nästa inloggning.'); }
    } else if (b.dataset.a === 'totp') {
      const r = await medKnapp(b, () => api('/api/flerfaktor/totp/borja', { metod: 'POST', direkt: true })).catch(() => null);
      if (!r) return;
      yta.querySelector('#ff-totp').innerHTML = totpHtml(r);
      yta.querySelector('#ff-ny-kod').focus();
    } else if (b.dataset.taBort) {
      const vag = `/api/flerfaktor/${encodeURIComponent(b.dataset.taBort)}/ta-bort`;
      let r = await api(vag, { metod: 'POST', data: {}, direkt: true }).catch(e => e);
      // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 8): en faktor tas bort först efter en färsk bekräftelse.
      // Har personen en app för engångskoder ber systemet om en kod, annars om en ny inloggning med passkeyn.
      if (r?.kod === 'bekrafta_faktor' && r.data?.metoder?.includes('totp')) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">${ikon.klocka}<span>Bekräfta med en kod</span></h2>
          <div class="falt"><label for="ff-bekrafta-kod">Kod från appen för engångskoder</label><input id="ff-bekrafta-kod" name="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></div>
          <p class="hjalp">Koden visar att det är du som tar bort faktorn, och inte någon som har kommit åt en öppen session.</p>
          <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp" data-varde="ok">Ta bort faktorn</button></div></form>`);
        if (!svar) return;
        r = await medKnapp(b, () => api(vag, { metod: 'POST', data: { kod: String(svar.data.kod ?? '').replace(/\s/g, '') }, direkt: true })).catch(() => null);
      } else if (r instanceof Error) { notis(r.message, 'fel'); r = null; }
      if (r) { rita(r); notis(r.aktiv ? 'Faktorn är borttagen.' : 'Faktorn är borttagen. Flerfaktor är av.'); }
    }
  });
  yta.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target.closest('#ff-totp-form');
    if (!form) return;
    const kod = form.querySelector('#ff-ny-kod').value.replace(/\s/g, '');
    const r = await medKnapp(form.querySelector('[type="submit"]'), () => api('/api/flerfaktor/totp', { metod: 'POST', data: { kod }, direkt: true }), form).catch(() => null);
    if (r) { rita(r); notis('Appen är registrerad. Koden krävs vid nästa inloggning.'); }
  });
}
