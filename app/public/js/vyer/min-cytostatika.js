// Min behandling i Min journal (runda 11, r4, Sussa 4.8.1.6): den perorala cytostatikabehandlingen som patienten har
// fått med sig hem, med instruktionen och dagarna. Patienten skriver varje dag om tabletterna är tagna och hur patienten mår,
// och systemet säger direkt om patienten ska ringa mottagningen. Mottagningen ser rapporterna i journalen.
import { esc, api, datum, notis, medKnapp, ikon } from '../ui.js';

export const namn = 'min-cytostatika';
const RUTA = { ok: 'ruta-info', ring_idag: 'ruta-obs', ring_nu: 'ruta-larm' };
const GRAD = ['Inget', 'Lite', 'Mycket', 'Kan inte äta eller gå'];

export async function visa(el, ctx) {
  const d = await api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/cytostatika`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<section class="min-sektion" aria-labelledby="min-cy-r"><h2 id="min-cy-r">Min behandling</h2><p class="ingress">${esc(d.text)}</p>
    ${d.behandlingar.length ? d.behandlingar.map(b => `<article class="min-cy" aria-labelledby="min-cy-${b.dosId}"><h3 id="min-cy-${b.dosId}">${esc(b.lakemedel)}, cykel ${b.cykel}</h3>
      <p>${esc(b.instruktion)}</p><p class="under-text">${esc(datum(b.fran))} till ${esc(datum(b.till))}. Från ${esc(b.vardenhet)}.</p>
      ${b.rapporter[0] ? `<p class="ruta ${RUTA[b.rapporter[0].bedomning]} liten">${b.rapporter[0].bedomning === 'ok' ? ikon.bock : ikon.larm}<span>${esc(b.rapporter[0].rad)}</span></p>` : ''}
      ${b.idag ? `<form class="mv-form" data-min-cy="${b.dosId}" novalidate aria-labelledby="min-cyf-${b.dosId}"><h4 id="min-cyf-${b.dosId}">I dag, ${esc(datum(b.idag))}</h4>
        <div class="kryssrad"><div class="kryssfalt"><input type="checkbox" id="min-cy-m-${b.dosId}" name="morgon"><label for="min-cy-m-${b.dosId}">Jag har tagit morgonens tabletter</label></div>
          <div class="kryssfalt"><input type="checkbox" id="min-cy-k-${b.dosId}" name="kvall"><label for="min-cy-k-${b.dosId}">Jag har tagit kvällens tabletter</label></div></div>
        <div class="falt-rad">
          <div class="falt smal"><label for="min-cy-t-${b.dosId}">Temperatur, om du har mätt</label><input id="min-cy-t-${b.dosId}" name="feber" inputmode="decimal" autocomplete="off"></div>
          <div class="falt smal"><label for="min-cy-d-${b.dosId}">Lösa avföringar i dag</label><input id="min-cy-d-${b.dosId}" name="diarre" type="number" min="0" max="20" value="0"></div>
          <div class="falt smal"><label for="min-cy-i-${b.dosId}">Illamående</label><select id="min-cy-i-${b.dosId}" name="illamaende">${GRAD.map((g, i) => `<option value="${i}">${esc(g)}</option>`).join('')}</select></div>
          <div class="falt smal"><label for="min-cy-h-${b.dosId}">Ömhet i händer och fötter</label><select id="min-cy-h-${b.dosId}" name="handfot">${GRAD.map((g, i) => `<option value="${i}">${esc(g)}</option>`).join('')}</select></div>
        </div>
        <div class="knapprad"><button type="submit" class="knapp">Skicka till mottagningen</button></div><p class="form-fel" role="alert" hidden></p></form>` : ''}
      ${b.dagar.length ? `<div class="tabellrulle"><table class="tabell tat"><caption>Dina dagar</caption><thead><tr><th scope="col">Dag</th><th scope="col">Morgon</th><th scope="col">Kväll</th><th scope="col">Bedömning</th></tr></thead>
        <tbody>${b.dagar.map(x => `<tr><th scope="row">${esc(datum(x.datum))}</th><td>${x.morgon ? 'Tagit' : 'Inte skrivet'}</td><td>${x.kvall ? 'Tagit' : 'Inte skrivet'}</td><td>${x.bedomning === 'ok' ? 'Fortsätt som vanligt' : x.bedomning === 'ring_nu' ? 'Ring nu' : x.bedomning === 'ring_idag' ? 'Ring samma dag' : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </article>`).join('') : '<p class="tom">Du har ingen behandling med tabletter att följa upp här.</p>'}</section>`;

  el.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-min-cy]');
    if (!f) return;
    e.preventDefault();
    const data = { dosId: Number(f.dataset.minCy), morgon: f.morgon.checked, kvall: f.kvall.checked, feber: f.feber.value || null, diarre: Number(f.diarre.value || 0), illamaende: Number(f.illamaende.value), handfot: Number(f.handfot.value) };
    try {
      const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/cytostatika/rapport`, { metod: 'POST', data }), f);
      notis(r.text, r.bedomning === 'ok' ? 'ok' : 'fel', { kvar: r.bedomning !== 'ok' });
      ctx.ladda();
    } catch { /* i formuläret */ }
  });
}
