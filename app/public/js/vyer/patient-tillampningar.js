// Externa tillämpningar i journalen (runda 6, r5, Sussa 5.1.1.4). En registrerad tillämpning startas för patienten med
// SMART on FHIR och visas i en ram i journalen. Systemet sköter starten: patienten och den inloggade följer med, och
// åtkomsten begränsas till det tillämpningen är registrerad för. Stäng återkallar tillämpningens åtkomst.
import { esc, api, notis, felNotis } from '../ui.js';

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tillampningar`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Tillämpningar</h2></div>
    <p class="ingress">${esc(d.villkor)}</p>
    <ul class="tillampningar">${d.tillampningar.map(t => `<li class="tillampning">
      <div><h3>${esc(t.namn)}</h3><p>${esc(t.beskrivning)}</p><p class="under-text">Får: ${esc(t.far)}</p></div>
      ${t.kanStartas ? `<button type="button" class="knapp" data-starta="${esc(t.id)}" data-namn="${esc(t.namn)}">Starta</button>` : '<p class="under-text">Kan inte startas för patienten, eftersom uppgifterna kräver ett aktivt val. En tillämpning får aldrig aktiva val.</p>'}
    </li>`).join('') || '<li class="tom">Det finns inga tillämpningar för din yrkesroll.</li>'}</ul>
    <section class="tillampning-ram" id="tillampning-ram" aria-labelledby="ram-namn" hidden>
      <div class="ram-huvud"><h3 id="ram-namn"></h3><p class="under-text" data-tillampning-status role="status"></p><button type="button" class="knapp liten sekundar" data-stang>Stäng</button></div>
      <iframe title="Extern tillämpning" referrerpolicy="same-origin"></iframe>
    </section>`;
  const ram = el.querySelector('#tillampning-ram');
  const iframe = ram.querySelector('iframe');
  const status = ram.querySelector('[data-tillampning-status]');
  let aktiv = null;
  // Tillämpningen säger till när den visar något. Bara meddelanden från ramen och samma webbplats räknas.
  const lyssna = (e) => {
    if (e.origin !== location.origin || e.source !== iframe.contentWindow || e.data?.typ !== 'vardkallan-tillampning') return;
    status.textContent = e.data.fel ? `${aktiv?.namn ?? 'Tillämpningen'}: ${String(e.data.fel)}` : `${aktiv?.namn ?? 'Tillämpningen'} visar ${Number(e.data.antal) || 0} blodtryck.`;
  };
  window.addEventListener('message', lyssna);
  const stang = async () => {
    if (!aktiv) return;
    const klient = aktiv.id;
    aktiv = null;
    iframe.removeAttribute('src');
    ram.hidden = true;
    try { await api(`/api/patient/${encodeURIComponent(ctx.id)}/tillampningar/${encodeURIComponent(klient)}/stang`, { metod: 'POST', data: {} }); } catch { /* biljetten går ut ändå */ }
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-starta]');
    if (b) {
      try {
        const s = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tillampningar/${encodeURIComponent(b.dataset.starta)}/starta`, { metod: 'POST', data: {} });
        aktiv = { id: b.dataset.starta, namn: b.dataset.namn };
        ram.querySelector('#ram-namn').textContent = b.dataset.namn;
        status.textContent = `Startar ${b.dataset.namn}.`;
        ram.hidden = false;
        iframe.src = s.adress;
      } catch (err) { felNotis(err); }
      return;
    }
    if (e.target.closest('[data-stang]')) { await stang(); notis('Tillämpningen är stängd och dess åtkomst är återkallad.', 'info'); }
  });
  // När fliken lämnas tas ramen bort med sin behållare, och lyssnaren likaså.
  new MutationObserver((_, o) => { if (!el.isConnected) { window.removeEventListener('message', lyssna); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true });
}
