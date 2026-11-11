// Runda 12, r3 (vårt L5): flerfaktorn i webbläsaren. Passkeys med WebAuthn (navigator.credentials) och engångskoder
// från en app. Servern prövar allt; här översätts bara mellan WebAuthn och JSON, och den andra faktorn efterfrågas vid
// inloggningen.
import { esc, api, ikon, ApiFel } from './ui.js';

const tillBuf = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0)).buffer;
const tillText = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const harPasskey = () => typeof window.PublicKeyCredential === 'function' && Boolean(navigator.credentials);

// Begripliga svar när webbläsaren eller användaren avbryter.
export function passkeyFel(e) {
  if (/^NotAllowed/.test(e?.name ?? '')) return 'Passkeyn användes inte. Du avbröt, eller tiden gick ut. Försök igen.';
  if (e?.name === 'InvalidStateError') return 'Den här passkeyn är redan registrerad för dig.';
  if (e?.name === 'SecurityError') return 'Webbläsaren tillåter inte passkeys på den här adressen. Öppna demon med sitt namn i adressen, inte med en IP-adress.';
  if (e?.name === 'NotSupportedError') return 'Webbläsaren eller autentiseraren stöder inte de nyckeltyper som Vårdkällan godtar.';
  return e?.message || 'Passkeyn kunde inte användas.';
}

export async function skapaPasskey(alt) {
  const k = await navigator.credentials.create({ publicKey: {
    ...alt, challenge: tillBuf(alt.challenge), user: { ...alt.user, id: tillBuf(alt.user.id) },
    excludeCredentials: (alt.excludeCredentials ?? []).map(c => ({ ...c, id: tillBuf(c.id) })),
  } });
  return { id: k.id, rawId: tillText(k.rawId), clientDataJSON: tillText(k.response.clientDataJSON), attestationObject: tillText(k.response.attestationObject) };
}

export async function hamtaPasskey(alt) {
  const k = await navigator.credentials.get({ publicKey: { ...alt, challenge: tillBuf(alt.challenge), allowCredentials: (alt.allowCredentials ?? []).map(c => ({ ...c, id: tillBuf(c.id) })) } });
  return {
    id: k.id, rawId: tillText(k.rawId), clientDataJSON: tillText(k.response.clientDataJSON), authenticatorData: tillText(k.response.authenticatorData),
    signature: tillText(k.response.signature), userHandle: k.response.userHandle ? tillText(k.response.userHandle) : null,
  };
}

// Inloggningens andra steg. Visar en dialog med de faktorer som personen har, försöker med passkeyn direkt när den finns,
// och ger sessionen när servern har godkänt faktorn, eller null om personen avbryter.
export function andraFaktorn(utmaning, namn) {
  return new Promise(resolve => {
    let u = utmaning;
    const dl = document.createElement('dialog');
    dl.className = 'dialog flerfaktor-dialog';
    dl.setAttribute('aria-labelledby', 'ff-rubrik');
    const pk = u.metoder.includes('passkey');
    const kod = u.metoder.includes('totp');
    dl.innerHTML = `<div class="dialog-inre">
      <h2 id="ff-rubrik">${ikon.skold} Bekräfta att det är du</h2>
      <p>${esc(namn ?? 'Personen')} har flerfaktor påslagen i den här sandlådan. ${pk ? 'Använd din passkey' : 'Skriv koden från appen'}${pk && kod ? ', eller skriv koden från appen för engångskoder' : ''}.</p>
      ${pk ? `<div class="knapprad"><button type="button" class="knapp" data-ff="passkey">${ikon.nyckel}<span>Använd passkey</span></button></div>` : ''}
      ${kod ? `<form class="ff-kod" novalidate><label for="ff-kod">Kod från appen</label>
        <input id="ff-kod" name="kod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" aria-describedby="ff-kod-hjalp" ${pk ? '' : 'autofocus'}>
        <p class="liten dampad" id="ff-kod-hjalp">Sex siffror. Koden byts var 30:e sekund.</p>
        <div class="knapprad"><button type="submit" class="knapp${pk ? ' sekundar' : ''}" data-ff="totp">Bekräfta med koden</button></div></form>` : ''}
      <p class="dialog-fel" role="alert" hidden></p>
      <p class="liten dampad">Har du tappat bort din faktor? Återställ sandlådan med knappen överst. Då försvinner faktorn och allt annat du har gjort i demon.</p>
      <div class="knapprad"><button type="button" class="knapp text" data-ff="avbryt">Avbryt</button></div>
    </div>`;
    document.body.append(dl);
    const fel = dl.querySelector('.dialog-fel');
    const visaFel = (t) => { fel.textContent = t; fel.hidden = !t; };
    let klar = false;
    const avsluta = (v) => { if (klar) return; klar = true; dl.close(); setTimeout(() => dl.remove(), 30); resolve(v); };
    const skicka = async (data, knapp) => {
      if (knapp) knapp.disabled = true;
      try {
        avsluta(await api('/api/login/flerfaktor', { metod: 'POST', data, tyst: true, direkt: true }));
      } catch (e) {
        visaFel(e.message);
        // Med en ny utmaning går det att försöka igen. Utan den är inloggningen avbruten och rollen väljs på nytt.
        if (e instanceof ApiFel && e.data?.flerfaktor) { u = e.data.flerfaktor; if (knapp) knapp.disabled = false; }
        else dl.querySelectorAll('[data-ff="passkey"], [data-ff="totp"]').forEach(b => { b.disabled = true; });
      }
    };
    const medPasskey = async (knapp) => {
      if (!harPasskey()) return visaFel('Webbläsaren stöder inte passkeys.');
      visaFel('');
      let svar;
      try { svar = await hamtaPasskey(u.passkey); } catch (e) { return visaFel(passkeyFel(e)); }
      await skicka({ typ: 'passkey', svar }, knapp);
    };
    dl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ff]');
      if (!b || b.dataset.ff === 'totp') return;
      if (b.dataset.ff === 'avbryt') { api('/api/login/flerfaktor/avbryt', { metod: 'POST', tyst: true, direkt: true }).catch(() => {}); return avsluta(null); }
      if (b.dataset.ff === 'passkey') medPasskey(b);
    });
    dl.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = dl.querySelector('#ff-kod').value.replace(/\s/g, '');
      if (!/^\d{6}$/.test(v)) return visaFel('Skriv de sex siffrorna som appen visar just nu.');
      skicka({ typ: 'totp', kod: v }, dl.querySelector('[data-ff="totp"]'));
    });
    dl.addEventListener('cancel', (e) => { e.preventDefault(); api('/api/login/flerfaktor/avbryt', { metod: 'POST', tyst: true, direkt: true }).catch(() => {}); avsluta(null); });
    dl.showModal();
    (dl.querySelector('[autofocus]') ?? dl.querySelector('[data-ff="passkey"]'))?.focus();
    // Passkeyn efterfrågas direkt, så att den som bara har en passkey inte behöver klicka en gång till.
    if (pk && harPasskey()) medPasskey(dl.querySelector('[data-ff="passkey"]'));
  });
}
