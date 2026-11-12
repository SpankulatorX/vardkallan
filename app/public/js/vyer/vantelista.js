// Väntelistan för vårdenheten. Systemet räknar dagarna mot gränsen (vårdgarantin och måldatumet, demoregler) och lyfter
// den som riskerar att passera den. Boka tid och omprioritering är ett klick var, och en ändrad prioritet kräver en orsak.
import { esc, api, vyRubrik, notis, felNotis, dialog, ikon } from '../ui.js';
import { patientCell, pnrCell } from './arbetslista.js';
import { valjPrioritet, gransHtml, dagar } from '../tidbok-ui.js';
import { bokaPost } from './idag.js';
// Runda 6, r4: väntetidsstatistik utan personuppgifter och kallelse utan förbokad tid.
import { vantetiderHtml } from '../planering-ui.js';
const SJALV = ['aterbesok', 'telefon', 'video'];

export const namn = 'vantelista';

// Runda 13, r4: vårdgarantin i en egen kolumn, med datum, dagar kvar och väntan som inte räknas.
function garantiHtml(g) {
  if (!g?.galler) return '<span class="dampad">Gäller inte</span>';
  const text = g.pagar ? 'Räknas inte nu' : g.dagarKvar < 0 ? `${dagar(-g.dagarKvar)} efter` : g.dagarKvar === 0 ? 'I dag' : `${dagar(g.dagarKvar)} kvar`;
  return `${esc(g.datum)}<span class="under-text">${g.risk ? `<span class="tagg tagg-larm">${ikon.varning}${esc(text)}</span>` : esc(text)}</span><span class="under-text">${esc(g.text)}</span>`;
}

// Runda 13, r4: väntan som patienten har valt eller som har medicinska skäl registreras som en egen åtgärd.
async function valjVantan(p, typer) {
  if (p.vantan) {
    const svar = await dialog(`<h2 id="dlg-rubrik">Avsluta väntan</h2><div class="dialog-text"><p>${esc(p.patient.namn)}: ${esc(p.vantan.typText.toLowerCase())} sedan ${esc(p.vantan.fran)}. När väntan avslutas räknas vårdgarantin igen från i dag.</p></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta väntan</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
    return svar ? { typ: p.vantan.typ, steg: 'slut' } : null;
  }
  let typ = null;
  const svar = await dialog(`<h2 id="dlg-rubrik">Registrera väntan</h2>
    <div class="dialog-text"><p>${esc(p.patient.namn)}, ${esc(p.orsak)}. Tiden räknas inte i vårdgarantin medan patienten själv har valt att vänta eller av medicinska skäl inte kan få vård (demoregel).</p></div>
    <div class="falt"><span class="etikett" id="va-typ">Väntan</span><div class="knappval-lista" role="group" aria-labelledby="va-typ" data-grupp="typ">
      ${Object.entries(typer).map(([k, t]) => `<button type="button" class="knapp sekundar liten" data-val="${esc(k)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div></div>
    <form class="falt" novalidate><label for="va-kommentar">Kommentar, om något behöver sägas</label><input id="va-kommentar" name="kommentar" maxlength="300" autocomplete="off"></form>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, {
    onOpen: (dl) => dl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grupp] button[data-val]');
      if (!b) return;
      for (const x of b.closest('[data-grupp]').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      typ = b.dataset.val;
    }),
    validera: () => (!typ ? 'Välj vilken sorts väntan.' : null),
  });
  if (!svar) return null;
  return { typ, steg: 'start', kommentar: svar.data?.kommentar ?? '' };
}

async function valjAvslut(p, orsaker) {
  let orsak = null;
  const svar = await dialog(`<h2 id="dlg-rubrik">Ta bort från väntelistan</h2>
    <div class="dialog-text"><p>${esc(p.patient.namn)}, ${esc(p.orsak)}. Orsaken sparas i väntelistans historik.</p></div>
    <div class="falt"><span class="etikett" id="av-orsak">Orsak</span><div class="knappval-lista" role="group" aria-labelledby="av-orsak" data-grupp="orsak">
      ${Object.entries(orsaker).map(([k, t]) => `<button type="button" class="knapp sekundar liten" data-val="${esc(k)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Ta bort</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, {
    onOpen: (dl) => dl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grupp] button[data-val]');
      if (!b) return;
      for (const x of b.closest('[data-grupp]').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      orsak = b.dataset.val;
    }),
    validera: () => (!orsak ? 'Välj orsaken.' : null),
  });
  if (!svar) return null;
  return { orsak };
}

const URVAL = [['alla', 'Alla'], ['risk', 'Nära gränsen'], ['remiss', 'Remisser'], ['hog', 'Hög prioritet']];
let urval = 'alla';
const passar = (p) => urval === 'alla' || (urval === 'risk' && p.grans?.risk) || (urval === 'remiss' && p.remiss) || (urval === 'hog' && p.prioritet === 'hog');

export async function visa(main, _p, _q, ctx = {}) {
  const d = await api('/api/vantelista');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const rita = () => {
    const poster = d.poster.filter(passar);
    main.querySelector('#vl-lista').innerHTML = poster.length ? `<div class="tabellrulle"><table class="tabell">
      <thead><tr><th scope="col">Patient</th><th scope="col">Vad</th><th scope="col">Prioritet</th><th scope="col">Väntat</th><th scope="col">Gräns</th><th scope="col">Vårdgaranti</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
      <tbody>${poster.map(p => `<tr${p.grans?.risk ? ' class="rad-risk"' : ''}>
        <td>${patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}`)}<span class="under-text">${pnrCell(p.patient)}</span></td>
        <td>${esc(p.orsak)}<span class="under-text">${esc(p.tidstypText)} hos ${esc(p.yrkesrollText)}${p.onskad ? `, helst ${esc(p.onskad.namn)}` : ''}</span>${p.styrLakemedel ? '<span class="under-text"><span class="tagg">Styr en läkemedelsdos</span></span>' : ''}${p.ingrepp ? `<span class="under-text">Kräver ${esc(p.ingrepp.krav.join(' och ').toLowerCase())}</span>` : ''}${p.mall ? `<span class="under-text">${esc(p.mall.namn)}</span>` : ''}${p.kalladUtanTid ? `<span class="under-text"><span class="tagg">Väljer tid själv i Min journal till och med ${esc(p.kalladUtanTid.till)}</span></span>` : ''}</td>
        <td>${esc(p.prioritetText)}${p.vantan ? `<span class="under-text"><span class="tagg">${esc(p.vantan.typText)} sedan ${esc(p.vantan.fran)}</span></span>` : p.patientvald ? '<span class="under-text">Patientvald väntan</span>' : ''}</td>
        <td>${esc(dagar(p.vantatDagar))}<span class="under-text">sedan ${esc(p.fran)}</span></td>
        <td>${gransHtml(p.grans)}</td>
        <td>${garantiHtml(p.vardgaranti)}</td>
        <td class="atgarder"><button type="button" class="knapp liten" data-vl="boka" data-id="${p.id}">Boka tid</button><button type="button" class="knapp liten text" data-vl="prio" data-id="${p.id}">Ändra prioritet</button><button type="button" class="knapp liten text" data-vl="vantan" data-id="${p.id}">${p.vantan ? 'Avsluta väntan' : 'Registrera väntan'}</button><button type="button" class="knapp liten text" data-vl="avsluta" data-id="${p.id}">Ta bort från listan</button>${SJALV.includes(p.tidstyp) && !p.kalladUtanTid ? `<button type="button" class="knapp liten text" data-vl="sjalv" data-id="${p.id}">Låt patienten välja tid</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="tom">Ingen på väntelistan passar urvalet.</p>';
  };
  main.innerHTML = vyRubrik('Väntelista', `Patienter som väntar på tid. De som är nära gränsen eller har passerat den står först.`) + `<div id="vl">
    <div class="segment" role="radiogroup" aria-label="Urval">${URVAL.map(([k, t]) => `<input type="radio" id="vl-${k}" name="vl-urval" value="${k}"${k === urval ? ' checked' : ''}><label for="vl-${k}">${esc(t)}</label>`).join('')}</div>
    <div id="vl-lista"></div><p class="hjalp">${esc(d.demoregler)}</p><div id="vl-statistik"></div></div>`;
  rita();
  api('/api/vantelista/statistik', { tyst: true }).then(s => { if (main.querySelector('#vl-statistik')) main.querySelector('#vl-statistik').innerHTML = vantetiderHtml(s); }).catch(() => {});
  const el = main.querySelector('#vl');
  el.addEventListener('change', (e) => { if (e.target.name === 'vl-urval') { urval = e.target.value; rita(); } });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-vl]');
    if (!b) return;
    const p = d.poster.find(x => String(x.id) === b.dataset.id);
    try {
      if (b.dataset.vl === 'boka') { if (!(await bokaPost(p.id, p.patient.namn))) return; }
      else if (b.dataset.vl === 'sjalv') {
        const r = await api(`/api/vantelista/${p.id}/kalla-utan-tid`, { metod: 'POST', data: {} });
        notis(`${p.patient.namn} har fått en kallelse i Min journal och väljer själv en tid till och med ${r.till}.`);
      }
      else if (b.dataset.vl === 'vantan') {
        const val = await valjVantan(p, d.vantan);
        if (!val) return;
        await api(`/api/vantelista/${p.id}/vantan`, { metod: 'POST', data: val });
        notis(val.steg === 'start' ? `${d.vantan[val.typ]} är registrerad för ${p.patient.namn}. Tiden räknas inte i vårdgarantin.` : `Väntan är avslutad för ${p.patient.namn}.`);
      }
      else if (b.dataset.vl === 'avsluta') {
        const val = await valjAvslut(p, d.avslut);
        if (!val) return;
        await api(`/api/vantelista/${p.id}/avsluta`, { metod: 'POST', data: val });
        notis(`${p.patient.namn} är borttagen från väntelistan.`);
      }
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
