// Patientens tider i översikten: kommande bokningar med kallelserna, och för vårdadministratören Boka om, Avboka och
// Boka tid för det patienten väntar på. Andra vårdenheters tider visas efter aktivt val, som vårdkontakterna.
import { esc, api, felNotis } from '../ui.js';
import { far } from '../app.js';
import { tidText, kr, kallelseHtml, dagar } from '../tidbok-ui.js';
import { ombokaBokning, avbokaBokning } from './tidbok.js';
import { bokaPost } from './idag.js';

// Tiderna hämtas för sig. I läsläget vid avbrott finns de inte i läskopian, och då visas en förklaring.
export async function hamta(id) {
  try { return await api(`/api/patient/${encodeURIComponent(id)}/bokningar`); } catch (e) { if (e?.status === 401) throw e; return null; }
}

export function sektionHtml(t) {
  if (!t) return '<section class="ov-sektion" aria-labelledby="ov-tider"><div class="sektion-huvud"><h2 id="ov-tider">Bokade tider</h2></div><p class="tom liten">Tiderna kan inte visas just nu.</p></section>';
  const rad = (b) => `<li data-bokning="${b.id}"><strong>${esc(tidText(b.tid.start))}</strong> <span class="tagg${b.status === 'incheckad' ? ' tagg-pagaende' : ''}">${esc(b.statusText)}</span>
    <span class="under-text">${esc(b.tid.rubrik ?? b.tid.tidstypText)} hos ${esc(b.tid.vardgivare?.namn ?? '')}, ${esc(b.tid.mottagning?.namn ?? '')}${b.konummer ? `. Nummer ${esc(b.konummer)}` : ''}${b.betalning ? `. ${esc(b.betalning.sattText)}${b.betalning.belopp ? ` ${esc(kr(b.betalning.belopp))}` : ''}` : b.avgift ? `. Avgift ${esc(kr(b.avgift.belopp))}` : ''}</span>
    ${b.kallelser.length ? `<details class="tider-kallelse"><summary>Kallelser (${b.kallelser.length})</summary>${b.kallelser.map(kallelseHtml).join('')}</details>` : ''}
    ${b.kanOmbokas ? `<span class="knapprad tat" data-skriv><button type="button" class="knapp text liten" data-tider="omboka" data-id="${b.id}">Boka om</button><button type="button" class="knapp text liten" data-tider="avboka" data-id="${b.id}">Avboka</button></span>` : ''}</li>`;
  const vantar = t.vantelista.map(p => `<li><strong>Väntar på tid:</strong> ${esc(p.orsak)}<span class="under-text">${esc(p.tidstypText)} hos ${esc(p.yrkesrollText)}, ${esc(dagar(p.vantatDagar))}${p.grans ? `, ${esc(dagar(p.grans.dagarKvar))} kvar till gränsen` : ''}</span>
    ${far('boka') ? `<span class="knapprad tat" data-skriv><button type="button" class="knapp liten" data-tider="boka" data-id="${p.id}">Boka tid</button></span>` : ''}</li>`).join('');
  return `<section class="ov-sektion ov-tider" aria-labelledby="ov-tider"><div class="sektion-huvud"><h2 id="ov-tider">Bokade tider</h2>${far('boka') ? '<a class="sektion-lank" href="#/tidbok">Tidbok</a>' : ''}</div>
    ${t.kommande.length || vantar ? `<ul class="enkel-lista">${t.kommande.map(rad).join('')}${vantar}</ul>` : '<p class="tom liten">Inga bokade tider.</p>'}
    ${t.dolda?.kraverVal ? `<p class="dampad liten">${t.dolda.kraverVal} ${t.dolda.kraverVal === 1 ? 'tid' : 'tider'} på andra vårdenheter visas efter ett aktivt val.</p>` : ''}</section>`;
}

export function koppla(el, t, ctx, ladda) {
  if (!t) return;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tider]');
    if (!b) return;
    const namn = ctx.patient?.namn ?? 'patienten';
    try {
      let klart = null;
      if (b.dataset.tider === 'omboka') klart = await ombokaBokning(b.dataset.id, namn);
      else if (b.dataset.tider === 'avboka') klart = await avbokaBokning(b.dataset.id, namn);
      else if (b.dataset.tider === 'boka') klart = await bokaPost(b.dataset.id, namn);
      if (klart) await ladda();
    } catch (err) { felNotis(err); }
  });
}
