// Patientens remisser och formuläret för att skicka en ny.
import { esc, api, notis, medKnapp, ikon, idag, plusDagar } from '../ui.js';
import { far, minVardenhet, enhetLista, laddaEnheter } from '../app.js';
import { doldaRad } from './patient.js';
import { remissKort, kopplaAtgarder } from './remisser.js';
import { kontaktRad, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
// Runda 6, r4: utkast, bilagor och återanvändning av en tidigare remiss.
import { lasFil, BILAGA_TEXT } from '../planering-ui.js';
import { felNotis } from '../ui.js';

export async function visa(el, ctx) {
  const kan = far('remittera');
  const [d, , u] = await Promise.all([api(`/api/patient/${encodeURIComponent(ctx.id)}/remisser`), laddaEnheter(), kan ? api(`/api/patient/${encodeURIComponent(ctx.id)}/remissutkast`, { tyst: true }).catch(() => ({ utkast: [] })) : { utkast: [] }]);
  if (!ctx.aktuell()) return;
  let lista = d.remisser;
  tidigare = lista;
  el.innerHTML = `<div class="flikhuvud"><h2>Remisser</h2>${kan ? `<button type="button" class="knapp" data-ny aria-expanded="false" aria-controls="remissform">${ikon.remiss}<span>Skicka remiss</span></button>` : ''}</div>
    ${doldaRad(d.dolda)}
    ${u.utkast.length ? `<section class="ov-sektion" aria-labelledby="rf-utkast"><div class="sektion-huvud"><h3 id="rf-utkast">Dina utkast</h3></div><ul class="enkel-lista">${u.utkast.map(x => `<li><strong>${esc(x.till?.namn ?? 'Mottagare inte vald')}</strong>${x.fragestallning ? `, ${esc(x.fragestallning.slice(0, 80))}` : ''}
      <span class="under-text">Sparat ${esc(x.andrad.slice(0, 10))}${x.bilagor.length ? `, ${x.bilagor.length} ${x.bilagor.length === 1 ? 'bilaga' : 'bilagor'}` : ''}. Utkastet syns bara för dig.</span>
      <span class="knapprad tat"><button type="button" class="knapp liten sekundar" data-utkast="${x.id}">Fortsätt</button><button type="button" class="knapp liten text" data-utkast-bort="${x.id}">Ta bort</button></span></li>`).join('')}</ul></section>` : ''}
    <div id="remissform-plats"></div>
    <div id="p-remisser">${lista.length ? lista.map(r => remissKort(r)).join('') : '<p class="tom">Patienten har inga remisser som du kan se.</p>'}</div>`;
  kopplaAtgarder(el.querySelector('#p-remisser'), (id) => lista.find(r => String(r.id) === String(id)), () => ctx.ladda());
  el.querySelector('[data-ny]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#remissform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    remissForm(plats, ctx);
  });
  // Runda 6, r4: ett sparat utkast öppnas i formuläret, eller tas bort.
  el.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-utkast]');
    const t = e.target.closest('[data-utkast-bort]');
    try {
      if (f) remissForm(el.querySelector('#remissform-plats'), ctx, u.utkast.find(x => String(x.id) === f.dataset.utkast), lista);
      else if (t) { await api(`/api/remissutkast/${t.dataset.utkastBort}/ta-bort`, { metod: 'POST', data: {} }); notis('Utkastet är borttaget.'); ctx.ladda(); }
    } catch (err) { felNotis(err); }
  });
  // Från snabbvalet Skicka remiss i översikten (remisser/ny) öppnas formuläret direkt.
  if (ctx.sub === 'ny' && kan) el.querySelector('[data-ny]').click();
}

// Runda 6, r4: remisserna som kan återanvändas i ett nytt utkast.
let tidigare = [];

// Sparar formuläret som utkast och laddar upp valda bilagor. Returnerar utkastet.
async function sparaUtkast(ctx, form) {
  const data = { tillEnhetId: form.tillEnhetId.value || null, prioritet: form.prioritet.value, svarSenast: form.svarSenast.value, fragestallning: form.fragestallning.value.trim(), anamnes: form.anamnes.value.trim() };
  const u = form.dataset.utkastId ? await api(`/api/remissutkast/${form.dataset.utkastId}`, { metod: 'PUT', data })
    : await api(`/api/patient/${encodeURIComponent(ctx.id)}/remissutkast`, { metod: 'POST', data });
  form.dataset.utkastId = u.id;
  for (const fil of form.bilagor.files) await api(`/api/remissutkast/${u.id}/bilagor`, { metod: 'POST', data: await lasFil(fil) });
  form.bilagor.value = '';
  return u;
}

function remissForm(plats, ctx, utkast = null, lista = tidigare) {
  const min = minVardenhet();
  const enheter = enhetLista().filter(e => e.typ === 'vardenhet' && e.id !== min).sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  const egna = (lista ?? []).filter(r => r.fragestallning != null && r.fran.id === min);
  plats.innerHTML = `<form class="remissform" id="remissform" novalidate aria-labelledby="rf-rubrik"${utkast ? ` data-utkast-id="${utkast.id}"` : ''}>
    <h3 id="rf-rubrik" tabindex="-1">${utkast ? 'Utkast till remiss' : 'Ny remiss'}</h3>
    <div data-kontakt-plats></div>
    ${!utkast && egna.length ? `<div class="falt"><label for="rf-ater">Utgå från en tidigare remiss</label><select id="rf-ater"><option value="">Ny remiss</option>${egna.map(r => `<option value="${r.id}">${esc(r.till.namn)}, ${esc(r.fragestallning.slice(0, 60))}</option>`).join('')}</select></div>` : ''}
    <div class="falt-rad">
      <div class="falt bred"><label for="rf-till">Till vårdenhet <span class="obl">(obligatoriskt)</span></label><select id="rf-till" name="tillEnhetId" required><option value="">Välj mottagare</option>${enheter.map(e => `<option value="${esc(e.id)}">${esc(e.namn)}</option>`).join('')}</select></div>
      <div class="falt"><label for="rf-prio">Prioritet</label><select id="rf-prio" name="prioritet"><option value="normal">Normal</option><option value="skyndsam">Skyndsam</option><option value="akut">Akut</option></select></div>
      <div class="falt"><label for="rf-svar">Sista svarsdatum <span class="obl">(obligatoriskt)</span></label><input id="rf-svar" name="svarSenast" type="date" required min="${idag()}" value="${plusDagar(idag(), 14)}"></div>
    </div>
    <div class="falt"><label for="rf-fraga">Frågeställning <span class="obl">(obligatoriskt)</span></label><textarea id="rf-fraga" name="fragestallning" rows="2" required minlength="3" maxlength="2000"></textarea></div>
    <div class="falt"><label for="rf-anamnes">Anamnes och relevanta fynd</label><textarea id="rf-anamnes" name="anamnes" rows="4" maxlength="8000"></textarea></div>
    <div class="falt"><label for="rf-bilagor">Bilagor</label><input id="rf-bilagor" name="bilagor" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain">
      <p class="hjalp">${esc(BILAGA_TEXT)}${utkast?.bilagor?.length ? ` Bifogat: ${esc(utkast.bilagor.map(b => b.namn).join(', '))}.` : ''}</p></div>
    <p class="hjalp">Mottagaren kvitterar att remissen kommit fram. Saknas kvittensen efter två timmar, eller saknas svar efter sista svarsdatum, får både du och mottagaren ett larm.</p>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Skicka remissen</button><button type="button" class="knapp sekundar" data-utkast-spara>Spara utkast</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  // Runda 6, r4: ett utkast fylls i, och en tidigare remiss återanvänds genom ett nytt utkast som systemet fyller i.
  if (utkast) {
    form.tillEnhetId.value = utkast.till?.id ?? '';
    form.prioritet.value = utkast.prioritet;
    form.svarSenast.value = utkast.svarSenast;
    form.fragestallning.value = utkast.fragestallning;
    form.anamnes.value = utkast.anamnes;
  }
  form.querySelector('#rf-ater')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    try { remissForm(plats, ctx, await api(`/api/patient/${encodeURIComponent(ctx.id)}/remissutkast`, { metod: 'POST', data: { franRemissId: Number(e.target.value) } }), lista); notis('Utkastet är ifyllt från den tidigare remissen. Ändra det som inte stämmer.'); } catch (err) { felNotis(err); }
  });
  form.querySelector('[data-utkast-spara]').addEventListener('click', async (e) => {
    try { await medKnapp(e.currentTarget, () => sparaUtkast(ctx, form), form); notis('Utkastet är sparat. Bara du ser det.'); } catch { /* felet visas i formuläret */ }
  });
  form.tillEnhetId.focus();
  const kontakt = kontaktRad(form.querySelector('[data-kontakt-plats]'), ctx);
  form.querySelector('[data-stang]').addEventListener('click', () => { plats.innerHTML = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { tillEnhetId: form.tillEnhetId.value, prioritet: form.prioritet.value, svarSenast: form.svarSenast.value, fragestallning: form.fragestallning.value.trim(), anamnes: form.anamnes.value.trim(), ...nyKontaktData(kontakt) };
    // Runda 6, r4: med bilagor eller från ett utkast skickas remissen genom utkastet, så att bilagorna följer med.
    const viaUtkast = form.dataset.utkastId || form.bilagor.files.length;
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), async () => {
        if (!viaUtkast) return api(`/api/patient/${encodeURIComponent(ctx.id)}/remisser`, { metod: 'POST', data });
        const u = await sparaUtkast(ctx, form);
        return api(`/api/remissutkast/${u.id}/skicka`, { metod: 'POST', data: nyKontaktData(kontakt) });
      }, form);
      notis(`Remissen är skickad till ${r.till.namn}. Den väntar nu på mottagningskvittens.`);
      kontaktNotis(r);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}
