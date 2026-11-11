// Barnhälsovårdens indikatorer (runda 11, r7, Sussa 4.1.1.8): barnavårdscentralen väljer vilka som följs upp, och
// uppföljningsrollen ser alla indikatorer för regionen, där varje cell med färre än fem är spärrad för sig.
import { esc, api, notis, medKnapp, tal } from './ui.js';

export function indikatorerHtml(d) {
  return `<section aria-labelledby="bhv-ind"><h2 id="bhv-ind">Indikatorer på ${esc(d.enhet)}</h2>
    <p>${esc(d.text)}</p>
    <div class="tabellrulle"><table class="tabell siffertabell"><caption class="sr">Valda indikatorer</caption>
      <thead><tr><th scope="col">Indikator</th><th scope="col" class="tal">Uppfyllt</th><th scope="col" class="tal">Underlag</th><th scope="col" class="tal">Andel</th></tr></thead>
      <tbody>${d.resultat.map(r => `<tr><th scope="row">${esc(r.text)}</th><td class="tal">${esc(r.taljare)}</td><td class="tal">${esc(r.namnare)}</td><td class="tal">${r.procent == null ? 'Inget underlag' : `${esc(tal(r.procent, 1))} %`}</td></tr>`).join('')}</tbody></table></div>
    <details><summary>Välj indikatorer</summary><form id="bhv-ind-val" novalidate><fieldset class="kryssgrupp"><legend>Indikatorer som barnavårdscentralen följer upp</legend>
      ${d.katalog.map(i => `<div class="kryssfalt"><input type="checkbox" id="ind-${esc(i.id)}" name="indikatorer" value="${esc(i.id)}"${i.vald ? ' checked' : ''}><label for="ind-${esc(i.id)}">${esc(i.text)}</label></div>`).join('')}
      </fieldset><p class="form-fel" role="alert" hidden></p><div class="knapprad"><button type="submit" class="knapp sekundar">Spara valet</button></div></form></details>
  </section>`;
}
export function kopplaIndikatorer(el, ladda) {
  const f = el.querySelector('#bhv-ind-val');
  f?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const indikatorer = [...f.querySelectorAll('[name=indikatorer]:checked')].map(x => x.value);
    try { await medKnapp(f.querySelector('[type=submit]'), () => api('/api/bhv/indikatorer', { metod: 'POST', data: { indikatorer } }), f); notis('Indikatorerna är sparade.'); ladda(); } catch { /* i formuläret */ }
  });
}
export function regionHtml(r) {
  return `<section aria-labelledby="bhv-region"><h2 id="bhv-region">Barnhälsovården i regionen</h2><p>${esc(r.text)} ${esc(r.antalEnheter)} ${r.antalEnheter === 1 ? 'barnavårdscentral' : 'barnavårdscentraler'}.</p>
    ${r.indikatorer.map(i => `<div class="tabellrulle"><table class="tabell siffertabell"><caption>${esc(i.text)}</caption>
      <thead><tr><th scope="col">Barnavårdscentral</th><th scope="col" class="tal">Värde</th></tr></thead>
      <tbody>${i.enheter.map(e => `<tr><th scope="row">${esc(e.enhet)}</th><td class="tal">${esc(e.varde.text)}</td></tr>`).join('')}<tr><th scope="row">Regionen</th><td class="tal">${esc(i.region.text)}</td></tr></tbody></table></div>`).join('')}
  </section>`;
}
