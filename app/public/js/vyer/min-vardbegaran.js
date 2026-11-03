// Runda 6, r4: egen vårdbegäran i Min journal (Sussa 3.3.2.1). Invånaren beskriver sitt besvär med egna ord, och
// systemet föreslår vårdenheten och varnar om något låter akut. Begäran hamnar som en remiss hos vårdenheten, och svaret
// visas under Remisser.
import { esc, api, notis, felNotis, medKnapp } from '../ui.js';
import { lasFil, BILAGA_TEXT } from '../planering-ui.js';

const vag = (pid, v) => `/api/min/journal/${encodeURIComponent(pid)}/${v}`;

export const knappHtml = () => `<div class="knapprad" data-vb-plats><button type="button" class="knapp" data-vb="ny">Ny vårdbegäran</button></div>`;

const formHtml = () => `<form class="ov-sektion min-vb" novalidate aria-labelledby="vb-rubrik">
  <h3 id="vb-rubrik" tabindex="-1">Ny vårdbegäran</h3>
  <p class="hjalp">Beskriv med egna ord vad du känner, sedan när och om det har blivit sämre. Systemet föreslår vart begäran ska. Vid akuta besvär, ring 112.</p>
  <div class="falt"><label for="vb-besvar">Ditt besvär</label><textarea id="vb-besvar" name="besvar" rows="4" maxlength="2000" required></textarea></div>
  <div class="knapprad"><button type="button" class="knapp sekundar" data-vb="forslag">Föreslå vårdenhet</button><button type="button" class="knapp text" data-vb="stang">Avbryt</button></div>
  <div data-vb-forslag></div>
</form>`;

const forslagHtml = (f) => `${f.akut ? `<p class="ruta ruta-larm" role="alert">${esc(f.akut)}</p>` : ''}
  <fieldset class="radiogrupp"><legend>Vårdenhet</legend>${f.forslag.map((x, i) => `<div class="radio"><input type="radio" id="vb-e${i}" name="enhetId" value="${esc(x.enhet.id)}"${x.rekommenderad ? ' checked' : ''}><label for="vb-e${i}">${esc(x.enhet.namn)}${x.rekommenderad ? ' (systemets förslag)' : ''}</label><span class="under-text">${esc(x.skal)}</span></div>`).join('')}</fieldset>
  <div class="falt"><label for="vb-fil">Bifoga en fil, till exempel en bild</label><input id="vb-fil" name="fil" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"><p class="hjalp">${esc(BILAGA_TEXT)}</p></div>
  <p class="hjalp">${esc(f.demoregler)}</p>
  <div class="knapprad"><button type="button" class="knapp" data-vb="skicka">Skicka vårdbegäran</button></div>`;

export function koppla(el, ctx) {
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-vb]');
    if (!b) return;
    const plats = el.querySelector('[data-vb-plats]');
    try {
      if (b.dataset.vb === 'ny') { plats.innerHTML = formHtml(); plats.querySelector('textarea').focus(); return; }
      if (b.dataset.vb === 'stang') { plats.innerHTML = knappHtml().replace(/^<div[^>]*>|<\/div>$/g, ''); return; }
      const form = plats.querySelector('form');
      const besvar = form.besvar.value.trim();
      if (b.dataset.vb === 'forslag') {
        const f = await medKnapp(b, () => api(vag(ctx.pid, 'vardbegaran/forslag'), { metod: 'POST', data: { besvar } }));
        form.querySelector('[data-vb-forslag]').innerHTML = forslagHtml(f);
      } else if (b.dataset.vb === 'skicka') {
        const enhetId = form.querySelector('input[name="enhetId"]:checked')?.value;
        const fil = form.fil?.files?.[0];
        const data = { besvar, enhetId, ...(fil ? { bilaga: await lasFil(fil) } : {}) };
        const r = await medKnapp(b, () => api(vag(ctx.pid, 'vardbegaran'), { metod: 'POST', data }));
        notis(`Din vårdbegäran är skickad till ${r.till}. Du ser svaret här under Remisser.`);
        await ctx.ladda?.();
      }
    } catch (err) { if (err?.status !== 400) felNotis(err); }
  });
}
