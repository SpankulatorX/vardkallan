// Väntelistan för vårdenheten. Systemet räknar dagarna mot gränsen (vårdgarantin och måldatumet, demoregler) och lyfter
// den som riskerar att passera den. Boka tid och omprioritering är ett klick var, och en ändrad prioritet kräver en orsak.
import { esc, api, vyRubrik, notis, felNotis } from '../ui.js';
import { patientCell, pnrCell } from './arbetslista.js';
import { valjPrioritet, gransHtml, dagar } from '../tidbok-ui.js';
import { bokaPost } from './idag.js';

export const namn = 'vantelista';

const URVAL = [['alla', 'Alla'], ['risk', 'Nära gränsen'], ['remiss', 'Remisser'], ['hog', 'Hög prioritet']];
let urval = 'alla';
const passar = (p) => urval === 'alla' || (urval === 'risk' && p.grans?.risk) || (urval === 'remiss' && p.remiss) || (urval === 'hog' && p.prioritet === 'hog');

export async function visa(main, _p, _q, ctx = {}) {
  const d = await api('/api/vantelista');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const rita = () => {
    const poster = d.poster.filter(passar);
    main.querySelector('#vl-lista').innerHTML = poster.length ? `<div class="tabellrulle"><table class="tabell">
      <thead><tr><th scope="col">Patient</th><th scope="col">Vad</th><th scope="col">Prioritet</th><th scope="col">Väntat</th><th scope="col">Gräns</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
      <tbody>${poster.map(p => `<tr${p.grans?.risk ? ' class="rad-risk"' : ''}>
        <td>${patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}`)}<span class="under-text">${pnrCell(p.patient)}</span></td>
        <td>${esc(p.orsak)}<span class="under-text">${esc(p.tidstypText)} hos ${esc(p.yrkesrollText)}${p.onskad ? `, helst ${esc(p.onskad.namn)}` : ''}</span>${p.styrLakemedel ? '<span class="under-text"><span class="tagg">Styr en läkemedelsdos</span></span>' : ''}</td>
        <td>${esc(p.prioritetText)}${p.patientvald ? '<span class="under-text">Patientvald väntan</span>' : ''}</td>
        <td>${esc(dagar(p.vantatDagar))}<span class="under-text">sedan ${esc(p.fran)}</span></td>
        <td>${gransHtml(p.grans)}</td>
        <td class="atgarder"><button type="button" class="knapp liten" data-vl="boka" data-id="${p.id}">Boka tid</button><button type="button" class="knapp liten text" data-vl="prio" data-id="${p.id}">Ändra prioritet</button></td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="tom">Ingen på väntelistan passar urvalet.</p>';
  };
  main.innerHTML = vyRubrik('Väntelista', `Patienter som väntar på tid. De som är nära gränsen eller har passerat den står först.`) + `<div id="vl">
    <div class="segment" role="radiogroup" aria-label="Urval">${URVAL.map(([k, t]) => `<input type="radio" id="vl-${k}" name="vl-urval" value="${k}"${k === urval ? ' checked' : ''}><label for="vl-${k}">${esc(t)}</label>`).join('')}</div>
    <div id="vl-lista"></div><p class="hjalp">${esc(d.demoregler)}</p></div>`;
  rita();
  const el = main.querySelector('#vl');
  el.addEventListener('change', (e) => { if (e.target.name === 'vl-urval') { urval = e.target.value; rita(); } });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-vl]');
    if (!b) return;
    const p = d.poster.find(x => String(x.id) === b.dataset.id);
    try {
      if (b.dataset.vl === 'boka') { if (!(await bokaPost(p.id, p.patient.namn))) return; }
      else {
        const val = await valjPrioritet(p, d.prioriteringsorsaker);
        if (!val) return;
        const r = await api(`/api/vantelista/${p.id}/prioritet`, { metod: 'POST', data: val });
        notis(`Prioriteten för ${p.patient.namn} är ${r.prioritetText.toLowerCase()}.`);
      }
      await visa(main, _p, _q, ctx);
    } catch (err) { felNotis(err); }
  });
}
