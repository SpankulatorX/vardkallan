// Alla nyheter för den inloggades roll, version för version (Sussa 10.1.1.4). Här läser man igen det som visades i
// nyhetsrutan efter en ny version.
import { esc, api, vyRubrik, tom } from '../ui.js';
import { nyhetHtml, rollText, datumText } from '../nyheter.js';

export const namn = 'nyheter';

export async function visa(main) {
  main.innerHTML = vyRubrik('Nyheter', 'Det som är nytt i varje version av Vårdkällan, för din roll. Nyhetsrutan efter en ny version visar samma sak.') + '<div id="nyheter-lista"><p class="tom">Hämtar nyheterna.</p></div>';
  const d = await api('/api/nyheter');
  const el = main.querySelector('#nyheter-lista');
  if (!d.alla.length) { el.innerHTML = tom('Det finns inga nyheter för din roll.'); return; }
  el.innerHTML = `<p class="dampad">Visar nyheterna för dig som ${esc(rollText(d.roll))}. Vårdkällan har nu version ${esc(d.version)}.</p>
    ${d.alla.map(v => `<section class="ruta nyhetsversion" aria-labelledby="ny-${esc(v.version)}">
      <h2 id="ny-${esc(v.version)}">Version ${esc(v.version)}<span class="under-text">${esc(datumText(v.datum))}${v.version === d.version ? ', den som körs nu' : ''}</span></h2>
      <ul class="nyhetslista">${v.nyheter.map(n => nyhetHtml(n)).join('')}</ul>
    </section>`).join('')}`;
}
