// Kontrasignering i anteckningsvyn (Sussa 3.1.11.3). Systemet föreslår vem som ska kontrasignera, och den som får
// begäran kontrasignerar med ett klick. Servern prövar allt: att uppgiften är den egna vårdenhetens, att mottagaren får
// läsa den och att den som signerade inte kontrasignerar själv.
import { esc, api, dialog, notis, felNotis, tidpunkt, ikon } from './ui.js';
import { far, uppdateraInkorg } from './app.js';

// Raden under anteckningen. a är svaret från /api/anteckning/:id, som har kontrasigneringens status.
export function html(a, senaste) {
  const ks = a.kontrasignering;
  if (!ks || a.id !== senaste.id || senaste.status !== 'signerad') return '';
  const rader = ks.begaranden.map(k => k.status === 'kontrasignerad'
    ? `<li class="ks-klar">${ikon.bock}<span>Kontrasignerad ${esc(tidpunkt(k.kontrasignerad))} av ${esc(k.mottagare?.namn ?? '')}, ${esc(k.mottagare?.titel ?? '')}.</span></li>`
    : `<li class="ks-vantar">${ikon.klocka}<span>Kontrasignering begärd ${esc(tidpunkt(k.begard))} av ${esc(k.begardAv?.namn ?? '')}, hos ${esc(k.mottagare?.namn ?? '')}.${k.kommentar ? ` ${esc(k.kommentar)}` : ''}</span></li>`).join('');
  const knappar = [
    ks.kan.kontrasignera ? `<button type="button" class="knapp" data-kontrasignera="${esc(ks.minBegaran)}">${ikon.bock}<span>Kontrasignera</span></button>` : '',
    ks.kan.begara && far('begara_kontrasignering') ? `<button type="button" class="knapp sekundar" data-begar-ks>${ikon.penna}<span>Begär kontrasignering</span></button>` : '',
  ].join('');
  if (!rader && !knappar) return '';
  return `<section class="kontrasignering" aria-label="Kontrasignering">${rader ? `<ul class="ks-lista">${rader}</ul>` : ''}${knappar ? `<div class="knapprad">${knappar}</div>` : ''}</section>`;
}

export function koppla(el, a, ladda) {
  el.querySelector('[data-kontrasignera]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await api(`/api/kontrasignering/${encodeURIComponent(b.dataset.kontrasignera)}/kontrasignera`, { metod: 'POST', data: {} });
      notis('Anteckningen är kontrasignerad.');
      await uppdateraInkorg();
      ladda();
    } catch (err) { felNotis(err); b.disabled = false; }
  });
  el.querySelector('[data-begar-ks]')?.addEventListener('click', async () => {
    let f;
    try { f = await api(`/api/kontrasignering/forslag?typ=anteckning&id=${encodeURIComponent(a.id)}`); } catch (err) { felNotis(err); return; }
    if (!f.forslag.length) { notis(f.skal, 'info'); return; }
    const svar = await dialog(`<h2 id="dlg-rubrik">Begär kontrasignering</h2>
      <p>${esc(f.skal)}</p>
      <form novalidate>
        <div class="falt"><label for="ks-mottagare">Kontrasigneras av</label><select id="ks-mottagare" name="mottagareId">${f.forslag.map((k, i) => `<option value="${esc(k.id)}"${i === 0 ? ' selected' : ''}>${esc(k.namn)}, ${esc(k.titel ?? '')}</option>`).join('')}</select></div>
        <div class="falt"><label for="ks-kommentar">Kommentar (frivillig)</label><input id="ks-kommentar" name="kommentar" maxlength="300" autocomplete="off"></div>
        <p class="dialog-fel" role="alert" hidden></p>
      </form>
      <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp" data-varde="ok">Skicka</button></div>`);
    if (!svar) return;
    try {
      const r = await api('/api/kontrasigneringar', { metod: 'POST', data: { typ: 'anteckning', id: a.id, mottagareId: svar.data.mottagareId, kommentar: svar.data.kommentar } });
      notis(`Begäran om kontrasignering är skickad till ${r.mottagare.namn}.`);
      ladda();
    } catch (err) { felNotis(err); }
  });
}
