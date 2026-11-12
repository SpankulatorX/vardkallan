// Runda 14, r3: e-remiss till och från vårdgivare utanför Vårdkällan (Sussa 2.2.1.12 och 3.3.1.2). Läkaren väljer
// mottagare och skriver frågeställningen. Systemet fyller i patienten, remittenten, vårdenheten och diagnoserna från den
// egna vårdenheten, skickar remissen med tjänstekontraktet och uppdaterar statusen när mottagaren svarar.
import { esc, api, notis, felNotis, medKnapp, PRIORITET_REMISS } from './ui.js';

export const knappar = (kan) => (kan ? `<button type="button" class="knapp sekundar" data-eremiss aria-expanded="false" aria-controls="eremiss-plats">Skicka e-remiss till annan vårdgivare</button>
  <button type="button" class="knapp text" data-eremiss-in>Ta emot en e-remiss (simulerat)</button>` : '');

// Det remisskortet visar om en e-remiss.
export function kortTillagg(r) {
  const e = r.eremiss;
  if (!e) return '';
  return `<p class="under-text">E-remiss ${e.riktning === 'ut' ? `till ${esc(e.motpart)}` : `från ${esc(e.motpart)}`} (simulerad motpart).${e.handelser.length ? ` ${esc(e.handelser.map(h => h.text).join(', '))}.` : ''}</p>
    ${e.handelser.filter(h => h.meddelande).map(h => `<p class="under-text">${esc(h.text)}: ${esc(h.meddelande)}</p>`).join('')}
    ${e.kanSvaraSimulerat ? `<button type="button" class="knapp liten text" data-eremiss-svara="${esc(r.id)}">Låt mottagaren svara (simulerat)</button>` : ''}`;
}

async function form(plats, ctx) {
  const d = await api('/api/eremiss/mottagare');
  plats.innerHTML = `<form class="eremiss-form ruta"><h3>E-remiss till annan vårdgivare</h3>
    <p class="liten">${esc(d.simulerat)} Patienten, du, vårdenheten och diagnoserna från din vårdenhet fylls i av systemet.</p>
    <div class="falt"><label for="er-mottagare">Mottagare</label><select id="er-mottagare" name="mottagare">${d.mottagare.map(m => `<option value="${esc(m.hsaId)}">${esc(m.namn)}</option>`).join('')}</select></div>
    <div class="falt"><label for="er-prio">Prioritet</label><select id="er-prio" name="prioritet">${Object.entries(PRIORITET_REMISS).map(([k, t]) => `<option value="${esc(k)}"${k === 'normal' ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
    <div class="falt"><label for="er-fraga">Frågeställning</label><textarea id="er-fraga" name="fragestallning" rows="3" required></textarea></div>
    <div class="falt"><label for="er-anamnes">Anamnes</label><textarea id="er-anamnes" name="anamnes" rows="3"></textarea></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Skicka e-remissen</button></div></form>`;
  // Frågeställningen har fokus direkt, eftersom allt annat är förvalt eller ifyllt av systemet.
  plats.querySelector('#er-fraga').focus();
  plats.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/eremiss`, { metod: 'POST', data: { mottagare: f.mottagare.value, prioritet: f.prioritet.value, fragestallning: f.fragestallning.value.trim(), anamnes: f.anamnes.value.trim() } }), f);
      notis(r.text);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}

export function koppla(el, ctx) {
  el.querySelector('[data-eremiss]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#remissform-plats');
    if (plats.querySelector('.eremiss-form')) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    form(plats, ctx).catch(felNotis);
  });
  el.querySelector('[data-eremiss-in]')?.addEventListener('click', async (e) => {
    try { notis((await medKnapp(e.currentTarget, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/eremiss/inkommande-simulerad`, { metod: 'POST', data: {} }))).text); ctx.ladda(); } catch (x) { felNotis(x); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-eremiss-svara]');
    if (!b) return;
    try { notis((await medKnapp(b, () => api(`/api/eremiss/${encodeURIComponent(b.dataset.eremissSvara)}/svara-simulerat`, { metod: 'POST', data: {} }))).text); ctx.ladda(); } catch (x) { felNotis(x); }
  });
}
