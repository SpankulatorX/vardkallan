// Patientens remisser och formuläret för att skicka en ny.
import { esc, api, notis, medKnapp, ikon, idag, plusDagar } from '../ui.js';
import { far, minVardenhet, enhetLista, laddaEnheter } from '../app.js';
import { doldaRad } from './patient.js';
import { remissKort, kopplaAtgarder } from './remisser.js';

export async function visa(el, ctx) {
  const [d] = await Promise.all([api(`/api/patient/${encodeURIComponent(ctx.id)}/remisser`), laddaEnheter()]);
  if (!ctx.aktuell()) return;
  let lista = d.remisser;
  const kan = far('remittera');
  el.innerHTML = `<div class="flikhuvud"><h2>Remisser</h2>${kan ? `<button type="button" class="knapp" data-ny aria-expanded="false" aria-controls="remissform">${ikon.remiss}<span>Skicka remiss</span></button>` : ''}</div>
    ${doldaRad(d.dolda)}
    <div id="remissform-plats"></div>
    <div id="p-remisser">${lista.length ? lista.map(r => remissKort(r)).join('') : '<p class="tom">Patienten har inga remisser som du kan se.</p>'}</div>`;
  kopplaAtgarder(el.querySelector('#p-remisser'), (id) => lista.find(r => String(r.id) === String(id)), () => ctx.ladda());
  el.querySelector('[data-ny]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#remissform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    remissForm(plats, ctx);
  });
}

function remissForm(plats, ctx) {
  const min = minVardenhet();
  const enheter = enhetLista().filter(e => e.typ === 'vardenhet' && e.id !== min).sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  plats.innerHTML = `<form class="remissform" id="remissform" novalidate aria-labelledby="rf-rubrik">
    <h3 id="rf-rubrik" tabindex="-1">Ny remiss</h3>
    <div class="falt-rad">
      <div class="falt bred"><label for="rf-till">Till vårdenhet <span class="obl">(obligatoriskt)</span></label><select id="rf-till" name="tillEnhetId" required><option value="">Välj mottagare</option>${enheter.map(e => `<option value="${esc(e.id)}">${esc(e.namn)}</option>`).join('')}</select></div>
      <div class="falt"><label for="rf-prio">Prioritet</label><select id="rf-prio" name="prioritet"><option value="normal">Normal</option><option value="skyndsam">Skyndsam</option><option value="akut">Akut</option></select></div>
      <div class="falt"><label for="rf-svar">Sista svarsdatum <span class="obl">(obligatoriskt)</span></label><input id="rf-svar" name="svarSenast" type="date" required min="${idag()}" value="${plusDagar(idag(), 14)}"></div>
    </div>
    <div class="falt"><label for="rf-fraga">Frågeställning <span class="obl">(obligatoriskt)</span></label><textarea id="rf-fraga" name="fragestallning" rows="2" required minlength="3" maxlength="2000"></textarea></div>
    <div class="falt"><label for="rf-anamnes">Anamnes och relevanta fynd</label><textarea id="rf-anamnes" name="anamnes" rows="4" maxlength="8000"></textarea></div>
    <p class="hjalp">Mottagaren kvitterar att remissen kommit fram. Saknas kvittensen efter två timmar, eller saknas svar efter sista svarsdatum, får både du och mottagaren ett larm.</p>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Skicka remissen</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  form.querySelector('h3').focus();
  form.querySelector('[data-stang]').addEventListener('click', () => { plats.innerHTML = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { tillEnhetId: form.tillEnhetId.value, prioritet: form.prioritet.value, svarSenast: form.svarSenast.value, fragestallning: form.fragestallning.value.trim(), anamnes: form.anamnes.value.trim() };
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/remisser`, { metod: 'POST', data }), form);
      notis(`Remissen är skickad till ${r.till.namn}. Den väntar nu på mottagningskvittens.`);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}
