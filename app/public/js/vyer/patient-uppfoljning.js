// Runda 10, r2: uppföljningsvyn (Sussa 3.1.2.2). Var i vårdprocessen patienten är, vårdplanernas mål och avvikelser,
// avvikande provsvar, läkemedel som ska följas upp, remisser med larm och samordnad planering med kommunen. Avvikelserna
// står först, och varje rad säger när, var och av vem. Allt kommer från det du redan får se.
import { esc, api, datum, tidpunkt, ikon } from '../ui.js';
import { doldaRad } from './patient.js';

let typVal = '';
const tid = (t) => (!t ? '' : String(t).length > 10 ? tidpunkt(t) : datum(t));

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/uppfoljning${typVal ? `?typ=${encodeURIComponent(typVal)}` : ''}`);
  if (!ctx.aktuell()) return;
  const alla = d.filter.reduce((s, f) => s + f.antal, 0);
  el.innerHTML = `<div class="flikhuvud"><h2 id="uppf-rubrik">Uppföljning och avvikelser</h2></div>
    <p class="ingress liten">${esc(d.lage.text)}</p>${doldaRad(d.dolda)}
    <fieldset class="segment" data-uppf-filter><legend>Visa</legend>
      <input type="radio" id="uf-alla" name="uf" value=""${typVal ? '' : ' checked'}><label for="uf-alla">Allt (${esc(alla)})</label>
      ${d.filter.map(f => `<input type="radio" id="uf-${esc(f.id)}" name="uf" value="${esc(f.id)}"${f.id === typVal ? ' checked' : ''}><label for="uf-${esc(f.id)}">${esc(f.text)} (${esc(f.antal)})</label>`).join('')}
    </fieldset>
    ${d.rader.length ? `<ol class="jsok-lista" aria-labelledby="uppf-rubrik">${d.rader.map(r => `<li class="jsok-traff${r.avvikelse ? ' avvikande' : ''}">
      <span class="jsok-rad1"><span class="tagg${r.avvikelse ? ' tagg-larm' : ''}">${r.avvikelse ? `${ikon.varning}<span>Avvikelse</span>` : esc(d.typer[r.typ] ?? r.typ)}</span><span class="jsok-rubrik">${r.ref ? `<a href="${esc(ctx.href(r.ref.flik, r.ref.sub))}">${esc(r.rubrik)}</a>` : esc(r.rubrik)}</span><time>${esc(tid(r.tid))}</time></span>
      <span class="jsok-text">${esc(r.text)}</span>
      <span class="under-text">${esc(r.enhet?.namn ?? '')}${r.av?.namn ? `, ${esc(r.av.namn)}` : ''}</span></li>`).join('')}</ol>` : '<p class="tom">Inget att följa upp som du kan se.</p>'}`;
  el.querySelector('[data-uppf-filter]').addEventListener('change', (e) => { typVal = e.target.value; ctx.ladda(); });
}
