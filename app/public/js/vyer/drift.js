// Svarstider (D5): p50 och p95 per adress i API:t, för hela servern och för din sandlåda.
import { esc, api, tal, tidpunkt, ikon, vyRubrik, tom } from '../ui.js';
import { S } from '../app.js';

export const namn = 'drift';

function tabell(rader, mal, rubrik, id) {
  if (!rader.length) return `<section aria-labelledby="${id}"><h2 id="${id}">${esc(rubrik)}</h2>${tom('Inga mätningar än.')}</section>`;
  const max = Math.max(mal, ...rader.map(r => r.p95));
  return `<section aria-labelledby="${id}"><h2 id="${id}">${esc(rubrik)}</h2><div class="tabellrulle"><table class="tabell siffertabell drift-tabell">
    <thead><tr><th scope="col">Adress</th><th scope="col" class="tal">Anrop</th><th scope="col" class="tal">p50</th><th scope="col" class="tal">p95</th><th scope="col">p95 mot målet ${mal} ms</th></tr></thead>
    <tbody>${rader.map(r => `<tr${r.inomMal ? '' : ' class="avvikande"'}><th scope="row"><code>${esc(r.endpoint)}</code></th><td class="tal">${r.antal}</td><td class="tal">${tal(r.p50, 1)} ms</td><td class="tal">${tal(r.p95, 1)} ms</td>
      <td><span class="stapel" aria-hidden="true"><span style="width:${Math.max(1, Math.min(100, (r.p95 / max) * 100)).toFixed(1)}%"></span><span class="malstreck" style="left:${((mal / max) * 100).toFixed(1)}%"></span></span>${r.inomMal ? '<span class="sr">Inom målet</span>' : `<span class="avst avst-fel">${ikon.varning}Över målet</span>`}</td></tr>`).join('')}</tbody>
  </table></div></section>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Svarstider', 'Varje svar från servern har rubriken Server-Timing med serverns tid i millisekunder. Senaste värdet syns överst på sidan när du är inloggad.') + '<div id="drift"><p class="tom">Hämtar mätningarna.</p></div>';
  const d = await api('/api/drift');
  const sen = S.svarstid;
  const utanfor = d.server.filter(r => !r.inomMal).length;
  main.querySelector('#drift').innerHTML = `
    <dl class="faktarad">
      <div><dt>Mål</dt><dd>p95 under ${d.mal.p95Ms} ms per adress i API:t</dd></div>
      <div><dt>Adresser över målet</dt><dd>${utanfor ? `${utanfor} av ${d.server.length}` : `Inga av ${d.server.length}`}</dd></div>
      <div><dt>Servern startad</dt><dd>${esc(tidpunkt(d.startad))}</dd></div>
      <div><dt>Aktiva sandlådor</dt><dd>${d.sandladar}</dd></div>
      ${d.datauttag ? `<div><dt>Datauttag för uppföljning</dt><dd>Senast uppdaterat ${esc(tidpunkt(d.datauttag.senast))}. Nästa uppdatering ${esc(tidpunkt(d.datauttag.nasta))}, varje natt klockan ${esc(d.datauttag.klockan)}</dd></div>` : ''}
      ${sen ? `<div><dt>Ditt senaste anrop</dt><dd>${tal(sen.server, 1)} ms på servern, ${tal(sen.totalt, 0)} ms hela vägen</dd></div>` : ''}
    </dl>
    <p class="dampad liten">Mätningen gäller demons server, de senaste 1 000 anropen per adress för servern och 200 för din sandlåda. Den säger inget om ett produktionssystem med tusentals användare.</p>
    ${tabell(d.sandlada, d.mal.p95Ms, 'Din sandlåda', 'dr-s')}
    ${tabell(d.server, d.mal.p95Ms, 'Hela servern', 'dr-h')}`;
}
