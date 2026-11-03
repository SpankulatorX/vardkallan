// Utskrifter och utlämnade journalhandlingar för patienten (Sussa 3.1.9.3 och 3.1.9.5). Varje utskrift med id, syfte,
// vem och vad som inte kom med, och varje utlämnande med mottagare, menprövning och återlämnande.
import { esc, api, tidpunkt, datum, notis, medKnapp, ikon, plural } from '../ui.js';
import { doldaRad } from './patient.js';
import * as utskrift from '../utskrift.js';

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/utskrifter`);
  if (!ctx.aktuell()) return;
  const utsk = d.utskrifter.map(u => `<tr><td><strong>${esc(u.id)}</strong><span class="under-text">${esc(tidpunkt(u.tid))}</span></td>
    <td>${esc(u.av?.namn ?? '')}<span class="under-text">${esc(u.enhet.namn)}</span></td><td>${esc(u.syfte)}<span class="under-text">${esc(u.delar.join(', '))}, ${esc(plural(u.antalPoster, 'post', 'poster'))}${u.avidentifierad ? ', avidentifierad' : ''}</span></td>
    <td>${u.utelamnat.length ? `<ul class="liten">${u.utelamnat.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="dampad">Inget</span>'}</td></tr>`).join('');
  const utl = d.utlamnanden.map(u => `<tr${u.forsenad ? ' class="avvikande"' : ''}><td>${esc(tidpunkt(u.utlamnad))}<span class="under-text">${esc(u.av?.namn ?? '')}, ${esc(u.enhet.namn)}</span></td>
    <td><strong>${esc(u.mottagare)}</strong><span class="under-text">${esc(u.beskrivning)}</span></td><td>${esc(u.menprovning ?? '')}</td>
    <td>${u.aterlamnad ? `${ikon.bock} Återlämnad ${esc(tidpunkt(u.aterlamnad))}<span class="under-text">${esc(u.aterlamnadAv?.namn ?? '')}</span>`
      : u.aterlamnasSenast ? `${u.forsenad ? `<span class="avst avst-fel">${ikon.varning}Försenad</span>` : ''} Senast ${esc(datum(u.aterlamnasSenast))}${d.kan.utlamna ? ` <button type="button" class="knapp liten sekundar" data-aterlamna="${u.id}">Registrera återlämnande</button>` : ''}`
      : '<span class="dampad">Kopia, lämnas inte tillbaka</span>'}</td></tr>`).join('');
  el.innerHTML = `<h2 class="sr">Utskrifter och utlämnanden</h2>${doldaRad(d.dolda)}
    ${d.kan.skrivUt ? `<div class="knapprad" data-skriv><button type="button" class="knapp liten" data-utskrift>${ikon.logg}<span>Skriv ut</span></button></div>` : ''}
    <section aria-labelledby="ul-utl"><h3 id="ul-utl">Utlämnade journalhandlingar</h3>
      <p class="dampad liten">Vem som har fått en journalhandling och när (patientdatalagen 3 kap. 11 §). Originalhandlingar som ska tillbaka har ett datum, och en försenad hamnar i vårdenhetens inkorg.</p>
      ${utl ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Utlämnad</th><th scope="col">Mottagare och handling</th><th scope="col">Menprövning</th><th scope="col">Återlämnande</th></tr></thead><tbody>${utl}</tbody></table></div>` : '<p class="tom">Inga utlämnade journalhandlingar.</p>'}
    </section>
    ${d.kan.utlamna ? `<details class="ruta" data-skriv><summary>Registrera ett utlämnande</summary>
      <form id="utl-form" class="ant-form" novalidate>
        <div class="falt"><label for="utl-mottagare">Mottagare</label><input id="utl-mottagare" name="mottagare" list="utl-forslag" required maxlength="120" autocomplete="off"><datalist id="utl-forslag">${d.mottagare.map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
        <div class="falt"><label for="utl-beskr">Vilken handling</label><input id="utl-beskr" name="beskrivning" required maxlength="300" autocomplete="off"></div>
        <label class="val-rad"><input type="checkbox" name="original"><span>Originalhandling som ska lämnas tillbaka<span class="under-text">Systemet föreslår ${esc(datum(d.forslagAterlamnas))} och påminner i inkorgen om den inte har kommit tillbaka.</span></span></label>
        <p class="form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="submit" class="knapp">Registrera utlämnandet</button></div>
      </form></details>` : ''}
    <section aria-labelledby="ul-utsk"><h3 id="ul-utsk">Utskrifter</h3>
      <p class="dampad liten">Varje utskrift har ett utskrifts-id som står på varje sida. Logggranskaren kan söka på id:t.</p>
      ${utsk ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Utskrifts-id</th><th scope="col">Av</th><th scope="col">Syfte och innehåll</th><th scope="col">Fanns inte med</th></tr></thead><tbody>${utsk}</tbody></table></div>` : '<p class="tom">Inga utskrifter.</p>'}
    </section>`;
  el.querySelector('[data-utskrift]')?.addEventListener('click', async () => { if (await utskrift.skrivUt(ctx.id)) ctx.ladda(); });
  el.querySelectorAll('[data-aterlamna]').forEach(b => b.addEventListener('click', async () => {
    try {
      await medKnapp(b, () => api(`/api/utlamnande/${b.dataset.aterlamna}/aterlamna`, { metod: 'POST', data: {} }));
      notis('Återlämnandet är registrerat.');
      ctx.ladda();
    } catch { /* notis visad */ }
  }));
  const form = el.querySelector('#utl-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('[type="submit"]');
    try {
      await medKnapp(knapp, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/utlamnanden`, { metod: 'POST', data: {
        mottagare: form.mottagare.value.trim(), beskrivning: form.beskrivning.value.trim(), aterlamnasSenast: form.original.checked ? d.forslagAterlamnas : null,
      } }), form);
      notis('Utlämnandet är registrerat.');
      ctx.ladda();
    } catch { /* felet visas i formuläret eller som notis */ }
  });
}
