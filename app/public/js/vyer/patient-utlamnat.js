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
    <td><strong>${esc(u.mottagare)}</strong><span class="under-text">${esc(u.beskrivning)}</span></td><td>${menHtml(u)}</td>
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
        ${menFalt(d.menprovning)}
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
  // Systemet föreslår beslut och grund när mottagaren väljs, och användaren ändrar bara om det inte stämmer.
  form?.mottagare.addEventListener('change', () => {
    const f = d.menprovning.forslag[form.mottagare.value.trim()] ?? { beslut: 'inget_men', grund: 'osl_25_1' };
    const r = form.querySelector(`[name="men_beslut"][value="${f.beslut}"]`);
    if (r) r.checked = true;
    form.men_grund.value = f.grund;
  });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('[type="submit"]');
    try {
      await medKnapp(knapp, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/utlamnanden`, { metod: 'POST', data: {
        mottagare: form.mottagare.value.trim(), beskrivning: form.beskrivning.value.trim(), aterlamnasSenast: form.original.checked ? d.forslagAterlamnas : null,
        menprovning: { beslut: form.querySelector('[name="men_beslut"]:checked')?.value, grund: form.men_grund.value, kommentar: form.men_kommentar.value.trim() || null },
      } }), form);
      notis('Utlämnandet är registrerat.');
      ctx.ladda();
    } catch { /* felet visas i formuläret eller som notis */ }
  });
}

// Runda 10, r2: den strukturerade menprövningen (Sussa 3.1.9.5).
function menHtml(u) {
  const m = u.menprovningBeslut;
  if (!m) return esc(u.menprovning ?? '');
  return `${esc(m.beslutText)}<span class="under-text">${esc(m.grundText)}</span><span class="under-text">Prövad av ${esc(m.av?.namn ?? '')}${m.kommentar ? `. ${esc(m.kommentar)}` : ''}</span>`;
}
function menFalt(k) {
  return `<fieldset class="valgrupp"><legend>Menprövning</legend>
    <p class="hjalp">Systemet föreslår beslut och grund när du väljer mottagare. Du som registrerar står som den som har prövat.</p>
    ${k.beslut.map((b, i) => `<label class="val-rad"><input type="radio" name="men_beslut" value="${esc(b.id)}"${i === 0 ? ' checked' : ''}><span>${esc(b.text)}</span></label>`).join('')}
    <div class="falt"><label for="utl-grund">Grund</label><select id="utl-grund" name="men_grund">${k.grunder.map(g => `<option value="${esc(g.id)}"${g.id === 'osl_25_1' ? ' selected' : ''}>${esc(g.text)}</option>`).join('')}</select></div>
    <div class="falt"><label for="utl-men-kommentar">Kommentar <span class="dampad">(krävs om något är borttaget)</span></label><input id="utl-men-kommentar" name="men_kommentar" maxlength="500" autocomplete="off"></div>
  </fieldset>`;
}
