// Incheckningsskärmen i väntrummet (simulerad). Vårdadministratören öppnar den på en skärm i väntrummet, och patienten
// checkar in med sitt personnummer. Skärmen visar aldrig namn, bara tid, konummer och avgift, och samma text för ett
// nummer utan tid som för ett nummer som inte finns.
import { esc, api, felNotis } from '../ui.js';
import { S } from '../app.js';

export const namn = 'incheckning';

export async function visa(main) {
  main.innerHTML = `<div class="vyhuvud"><h1 tabindex="-1">Incheckning</h1><p class="ingress">Välkommen till ${esc(S.session.enhet.vardenhet?.namn ?? S.session.enhet.namn)}. Skärmen är simulerad i demon.</p></div>
    <div class="skarm" id="skarm">
      <form id="skarm-form" class="skarm-form" autocomplete="off">
        <label for="skarm-pnr">Skriv ditt personnummer</label>
        <input id="skarm-pnr" name="personnummer" inputmode="numeric" maxlength="20" placeholder="ÅÅÅÅMMDD-NNNN" data-fokus required>
        <button type="submit" class="knapp stor">Checka in</button>
      </form>
      <div id="skarm-svar" class="skarm-svar" role="status" aria-live="polite"></div>
      <p class="hjalp">Har du video- eller telefontid behöver du inte checka in. Skärmen visar aldrig ditt namn. Du kan också checka in i Min journal.</p>
      <p><a href="#/idag">Tillbaka till dagens arbete</a></p>
    </div>`;
  const form = main.querySelector('#skarm-form');
  const svar = main.querySelector('#skarm-svar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('[type="submit"]');
    b.disabled = true;
    try {
      const r = await api('/api/incheckning/skarm', { metod: 'POST', data: { personnummer: form.personnummer.value } });
      svar.className = `skarm-svar ${r.ok ? 'skarm-ok' : 'skarm-info'}`;
      svar.innerHTML = r.ok
        ? `<p class="skarm-nummer">${esc(r.konummer)}</p><p>${esc(r.redan ? 'Du var redan incheckad. ' : '')}${esc(r.text)}</p>`
        : `<p>${esc(r.text)}</p>`;
      form.reset();
    } catch (err) {
      // För många försök visas på skärmen, så att patienten vet att gå till receptionen.
      if (err?.status === 403) { svar.className = 'skarm-svar skarm-info'; svar.innerHTML = `<p>${esc(err.message)}</p>`; } else felNotis(err);
    } finally { b.disabled = false; form.personnummer.focus(); }
  });
}
