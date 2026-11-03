// Delegering av läkemedelshantering (runda 5, HSLF-FS 2017:37 9 kap.). Sjuksköterskan ser undersköterskorna på sin
// vårdenhet med deras delegeringar och registrerar en ny med ett förslag som systemet har fyllt i: vad som omfattas,
// giltighet och uppföljning. Undersköterskan ser sina egna delegeringar. Servern kontrollerar allt.
import { esc, api, vyRubrik, notis, felNotis, medKnapp, dialog, datum, tidpunkt, tom } from '../ui.js';

export const namn = 'delegeringar';

const STATUS = { giltig: ['Gäller', 'tagg-ok'], utgangen: ['Har gått ut', 'tagg-utkast'], kommande: ['Börjar senare', ''], aterkallad: ['Återkallad', 'tagg-larm'] };
const dagarText = (n) => (n === 0 ? 'går ut i dag' : n === 1 ? 'går ut i morgon' : `${n} dagar kvar`);

function beslutRad(d, kanAterkalla) {
  const [st, kl] = STATUS[d.status] ?? [d.status, ''];
  return `<tr>
    <td><span class="tagg ${kl}">${esc(st)}</span>${d.status === 'giltig' ? `<span class="under-text">${esc(dagarText(d.dagarKvar))}</span>` : ''}</td>
    <td>${esc(d.omfattningText.join(', '))}</td>
    <td>${esc(datum(d.fran))} till ${esc(datum(d.till))}<span class="under-text">Följs upp senast ${esc(datum(d.uppfoljning))}</span></td>
    <td>${esc(d.utfardadAv.namn)}<span class="under-text">Beslutad ${esc(tidpunkt(d.beslutad))}</span>
      ${d.aterkallad ? `<span class="under-text">Återkallad ${esc(tidpunkt(d.aterkallad.tid))} av ${esc(d.aterkallad.av)}: ${esc(d.aterkallad.orsak)}</span>` : ''}</td>
    <td class="atgarder">${kanAterkalla && d.status !== 'aterkallad' && d.status !== 'utgangen' ? `<button type="button" class="knapp liten text" data-del="aterkalla" data-id="${d.id}">Återkalla</button>` : ''}</td>
  </tr>`;
}
const tabell = (lista, kanAterkalla) => (lista.length ? `<div class="tabellrulle"><table class="tabell del-tabell">
  <thead><tr><th scope="col">Status</th><th scope="col">Omfattar</th><th scope="col">Giltig</th><th scope="col">Utfärdad av</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
  <tbody>${lista.map(d => beslutRad(d, kanAterkalla)).join('')}</tbody></table></div>` : '<p class="tom liten">Inga delegeringar.</p>');

export async function visa(main, _p, _q, ctx = {}) {
  const d = await api('/api/delegeringar');
  if (ctx.aktuell && !ctx.aktuell()) return;
  if (!d.kan) {
    main.innerHTML = vyRubrik('Mina delegeringar', 'Vilka läkemedel du får ge med delegering, och hur länge.') + `<div id="del">
      ${tabell(d.egna, false)}<p class="hjalp">${esc(d.demoregler)}</p></div>`;
    return;
  }
  main.innerHTML = vyRubrik('Delegeringar', `Delegering av iordningställande, administrering och överlämnande av läkemedel på ${esc(d.vardenhet?.namn ?? 'din vårdenhet')} (${esc(d.foreskrift)}). Systemet kontrollerar själv att delegeringen gäller varje dos.`) + `<div id="del">
    ${d.personal.length ? d.personal.map(p => `<section class="del-person" aria-labelledby="del-${esc(p.id)}">
      <div class="flikhuvud"><h2 id="del-${esc(p.id)}">${esc(p.namn)} <span class="dampad liten">${esc(p.titel ?? '')}, ${esc(p.enhet?.namn ?? '')}</span></h2>
        <button type="button" class="knapp" data-del="ny" data-id="${esc(p.id)}">Ny delegering</button></div>
      ${p.giltig ? `<p class="liten">Gäller till och med ${esc(datum(p.giltig.till))}: ${esc(p.giltig.omfattningText.join(', ').toLowerCase())}.</p>` : `<p class="liten">${esc(p.namn)} har ingen giltig delegering och kan inte ge läkemedel.</p>`}
      ${tabell(p.delegeringar, true)}
    </section>`).join('') : tom('Det finns inga undersköterskor på vårdenheten.')}
    <p class="hjalp">${esc(d.demoregler)}</p></div>`;
  main.querySelector('#del').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (b.dataset.del === 'ny') return ny(d, d.personal.find(p => p.id === b.dataset.id), () => visa(main, _p, _q, ctx));
    if (b.dataset.del === 'aterkalla') return aterkalla(b, () => visa(main, _p, _q, ctx));
  });
}

// Ny delegering med systemets förslag ifyllt: samma omfattning som den nuvarande, från i dag och ett år.
async function ny(d, p, ladda) {
  const f = p.forslag;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Ny delegering för ${esc(p.namn)}</h2>
    <p>Delegeringen gäller ${esc(d.vardenhet?.namn ?? 'din vårdenhet')}. Systemet har fyllt i förslaget. Ändra det som inte stämmer.</p>
    <fieldset class="kryssgrupp"><legend>Vad ${esc(p.namn)} får ge</legend>
      ${d.omfattningar.map(o => `<div class="kryssfalt"><input type="checkbox" id="del-${esc(o.id)}" name="omf_${esc(o.id)}" value="ja"${f.omfattning.includes(o.id) ? ' checked' : ''}><label for="del-${esc(o.id)}">${esc(o.text)}</label></div>`).join('')}
    </fieldset>
    <div class="falt-rad"><div class="falt"><label for="del-fran">Gäller från</label><input id="del-fran" name="fran" type="date" value="${esc(f.fran)}" min="${esc(f.fran)}" max="${esc(f.franSenast)}" required></div>
      <div class="falt"><label for="del-till">Gäller till och med</label><input id="del-till" name="till" type="date" value="${esc(f.till)}" min="${esc(f.fran)}" max="${esc(f.senast)}" required></div></div>
    <p class="hjalp">Ett delegeringsbeslut är tidsbegränsat och gäller högst ett år. Det följs upp senast sista dagen, och en påminnelse kommer i inkorgen 30 dagar före.</p>
    <div class="kryssfalt"><input type="checkbox" id="del-intyg" name="intyg" value="ja" required><label for="del-intyg">Jag har kontrollerat att ${esc(p.namn)} har dokumenterade kunskaper om läkemedelshantering och riskerna, och den kompetens som uppgiften kräver.</label></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera delegeringen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (!Object.keys(x).some(k => k.startsWith('omf_')) ? 'Välj vad delegeringen omfattar.' : null) });
  if (!svar) return;
  const omfattning = Object.keys(svar.data).filter(k => k.startsWith('omf_')).map(k => k.slice(4));
  try {
    const r = await api('/api/delegeringar', { metod: 'POST', data: { personalId: p.id, omfattning, fran: svar.data.fran, till: svar.data.till, kunskapKontrollerad: svar.data.intyg === 'ja' } });
    notis(`Delegeringen för ${r.personal.namn} är registrerad och gäller till och med ${datum(r.till)}.`);
    ladda();
  } catch (e) { felNotis(e); }
}

async function aterkalla(b, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Återkalla delegeringen</h2>
    <p>Delegeringen slutar gälla direkt. Beslutet finns kvar med vem som återkallade det och varför.</p>
    <div class="falt"><label for="del-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="del-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-varde="ok">Återkalla</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (x.orsak.trim().length < 3 ? 'Ange orsaken med minst tre tecken.' : null) });
  if (!svar) return;
  try {
    await medKnapp(b, () => api(`/api/delegering/${b.dataset.id}/aterkalla`, { metod: 'POST', data: { orsak: svar.data.orsak.trim() } }));
    notis('Delegeringen är återkallad.');
    ladda();
  } catch { /* notis visad */ }
}
