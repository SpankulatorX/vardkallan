// Röntgenklinikens arbetslista (runda 11, r6, Sussa 4.4.2.7 och 4.4.2.8): inkomna undersökningar efter prioritet och
// senaste dag, med frågeställningen och systemets kontroller före undersökningen. Systemet föreslår den första lediga
// tiden inom prioriteten, och ett klick bokar den. Röntgensjuksköterskan registrerar när undersökningen är gjord, och
// studien läggs i multimediaarkivet. Utlåtandet från radiologen är simulerat i demon.
import { esc, api, vyRubrik, tidpunkt, notis, medKnapp, ikon, dialog } from '../ui.js';

export const namn = 'undersokningar';

const NIVA = { stopp: 'ruta-larm', varning: 'ruta-obs', tillagd: 'ruta-info', info: 'ruta-info' };
const pnamn = (p) => (p.skyddad ? 'Skyddad identitet' : p.namn);

function rad(r) {
  const knappar = [
    !r.bokad && !r.besvarad && !r.vantar.length && r.forslag ? `<button type="button" class="knapp liten" data-boka="${r.id}" data-mr="${r.mrKontroll ? 1 : 0}" aria-label="Boka ${esc(tidpunkt(r.forslag))}: ${esc(r.undersokning)}, ${esc(pnamn(r.patient))}">Boka ${esc(tidpunkt(r.forslag))}</button>` : '',
    r.bokad && !r.utford ? `<button type="button" class="knapp liten" data-utford="${r.id}" aria-label="Gjord: ${esc(r.undersokning)}, ${esc(pnamn(r.patient))}">Gjord</button>` : '',
    r.bokad && !r.utford ? `<button type="button" class="knapp liten text" data-boka="${r.id}" data-om="1" data-mr="0">Boka om</button>` : '',
    r.utford && !r.besvarad ? `<button type="button" class="knapp liten sekundar" data-utlatande="${r.id}">Simulera utlåtande från radiologen</button>` : '',
  ].filter(Boolean).join('');
  const status = r.besvarad ? `<span class="tagg tagg-ok">Utlåtande skickat</span>` : r.utford ? `<span class="tagg tagg-pagaende">Gjord ${esc(tidpunkt(r.utford))}</span>`
    : r.bokad ? `<span class="tagg">Bokad ${esc(tidpunkt(r.bokad))}</span>` : `<span class="tagg ${r.sen ? 'tagg-larm' : 'tagg-obs'}">Att boka</span>`;
  return `<li class="us-rad${r.prioritet.id === 'akut' ? ' us-akut' : ''}" data-rad="${r.id}">
    <div class="us-huvud"><h3 id="us-${r.id}">${esc(r.undersokning)}, ${esc(pnamn(r.patient))} <span class="pnr">${esc(r.patient.personnummer)}</span></h3>
      <span class="tagg ${r.prioritet.id === 'akut' ? 'tagg-larm' : r.prioritet.id === 'svf' ? 'tagg-obs' : ''}">${esc(r.prioritet.namn)}, ${esc(r.prioritet.text)}</span> ${status}</div>
    <p class="under-text">${esc(r.nummer)}, ${esc(r.lab.kort)}. Beställd av ${esc(r.bestallare.namn)}, ${esc(r.bestallare.vardenhet)}, ${esc(tidpunkt(r.bestalld))}. Senast ${esc(tidpunkt(r.senast))}.${r.svf ? ` Standardiserat vårdförlopp ${esc(r.svf.namn.toLocaleLowerCase('sv'))} (${esc(r.svf.kod)}).` : ''}</p>
    <p><strong>Frågeställning:</strong> ${esc(r.fragestallning ?? '')}${r.kommentar ? ` <span class="under-text">Kommentar: ${esc(r.kommentar)}</span>` : ''}</p>
    ${r.kontroller.length || r.vantar.length || r.mrKontroll ? `<ul class="us-kontroller">${[...r.vantar.map(v => ({ niva: v.stopp ? 'stopp' : 'tillagd', text: v.text })), ...r.kontroller].map(k => `<li class="ruta ${NIVA[k.niva] ?? 'ruta-info'} liten">${k.niva === 'stopp' ? ikon.larm : ikon.info}<span>${esc(k.text)}</span></li>`).join('')}
      ${r.mrKontroll ? `<li class="ruta ruta-obs liten">${ikon.info}<span>Kontrollera MR-säkerheten med patienten och implantatets dokumentation innan undersökningen bokas.</span></li>` : ''}</ul>` : ''}
    ${r.underlag.length ? `<p class="liten">Underlag: ${r.underlag.map(u => `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.namn)}</a>`).join(', ')}</p>` : ''}
    ${r.studie ? `<p class="liten">Studie i multimediaarkivet: ${esc(r.studie.uid)}</p>` : ''}
    ${knappar ? `<div class="knapprad">${knappar}</div>` : ''}
  </li>`;
}

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Undersökningar', 'Inkomna beställningar till röntgenkliniken efter prioritet och senaste dag. Systemet föreslår den första lediga tiden inom prioriteten och visar kontrollerna före undersökningen.')}
    <div id="us"><p class="tom">Hämtar undersökningarna.</p></div>`;
  const d = await api('/api/undersokningar');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#us');
  if (!el) return;
  const grupp = (rubrik, id, rader, tomText) => `<section class="ov-sektion" aria-labelledby="${id}"><div class="sektion-huvud"><h2 id="${id}">${esc(rubrik)} <span class="antal">${rader.length}</span></h2></div>
    ${rader.length ? `<ul class="us-lista">${rader.map(rad).join('')}</ul>` : `<p class="tom liten">${esc(tomText)}</p>`}</section>`;
  el.innerHTML = `<p class="liten">${esc(d.vardenhet.namn)}: ${esc(d.laboratorier.map(l => l.kort).join(' och '))}.</p>
    ${grupp('Att boka', 'us-boka', d.rader.filter(r => !r.bokad && !r.besvarad), 'Inga undersökningar väntar på tid.')}
    ${grupp('Bokade', 'us-bokade', d.rader.filter(r => r.bokad && !r.utford && !r.besvarad), 'Inga bokade undersökningar.')}
    ${grupp('Gjorda i dag', 'us-gjorda', d.rader.filter(r => r.utford || r.besvarad), 'Inga undersökningar är gjorda i dag.')}
    <p class="dampad liten">${esc(d.simulerat)} ${esc(d.demoregel)}</p>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-boka], [data-utford], [data-utlatande]');
    if (!b) return;
    try {
      let r;
      if (b.dataset.boka) {
        let data = {};
        if (b.dataset.mr === '1') {
          const svar = await dialog(`<form><h2 id="dlg-rubrik">MR-säkerhet</h2>
            <p>Beställaren har angett att patienten kan ha ett implantat. Kontrollera med patienten och implantatets dokumentation att implantatet tål magnetkameran.</p>
            <div class="knapprad"><button type="button" class="knapp" data-varde="ok">MR-säkerheten är kontrollerad, boka</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
          if (!svar) return;
          data = { mrKontrollerad: true };
        }
        r = await medKnapp(b, () => api(`/api/undersokningar/${b.dataset.boka}/boka`, { metod: 'POST', data }));
      } else if (b.dataset.utford) r = await medKnapp(b, () => api(`/api/undersokningar/${b.dataset.utford}/utford`, { metod: 'POST', data: {} }));
      else r = await medKnapp(b, () => api(`/api/undersokningar/${b.dataset.utlatande}/simulera-utlatande`, { metod: 'POST', data: {} }));
      notis(r.text);
      visa(main, _p, _q, ctx);
    } catch { /* notis visad */ }
  });
}
