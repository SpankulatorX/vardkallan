// Läkemedelsansvar (runda 6, r6): verksamhetschefens sida för uppdragen i läkemedelshanteringen på vårdenheten.
// Påminnelserna står först, med det systemet föreslår, så att verksamhetschefen utser med två klick. Sedan uppdragen
// med vem som har dem, omfattningen och perioden, och ansvarsdokumentet med när det senast sågs över.
import { esc, api, datum, notis, medKnapp, dialog, vyRubrik, ikon } from '../ui.js';

export const namn = 'lakemedelsansvar';

const person = (u) => `${esc(u.personal?.namn ?? '')}${u.personal?.titel ? `, ${esc(u.personal.titel.toLowerCase())}` : ''}`;
const period = (u) => `${esc(datum(u.fran))} till ${esc(datum(u.till))}`;

function uppdragHtml(o, u) {
  const rader = u.gallande.map(g => `<li class="ik-ater la-rad"><div class="ik-text"><span class="ik-rubrik">${person(g)}${g.reserv ? ' (reserv)' : ''}</span>
      <span class="under-text">${period(g)}. Utsedd av ${esc(g.sattAv)}.</span></div>
      ${o.kanAndra ? `<div class="ik-knappar"><button type="button" class="knapp liten sekundar" data-avsluta="${g.id}" data-namn="${esc(g.personal?.namn ?? '')}">Avsluta</button></div>` : ''}</li>`);
  const kommande = u.kommande.map(g => `<li class="ik-ater la-rad"><div class="ik-text"><span class="ik-rubrik">${person(g)}${g.reserv ? ' (reserv)' : ''}</span><span class="under-text">Börjar ${esc(datum(g.fran))}, gäller till ${esc(datum(g.till))}.</span></div></li>`);
  const saknas = u.saknas.map(r => `<li class="ik-ater la-rad ik-larm"><div class="ik-text"><span class="ik-rubrik">${r ? 'Reservkontrollant saknas' : 'Saknas'}</span></div>
      ${o.kanAndra ? `<div class="ik-knappar"><button type="button" class="knapp liten" data-utse="${esc(u.typ)}" data-reserv="${r}">Utse</button></div>` : ''}</li>`);
  return `<section class="lm-sektion la-uppdrag" id="la-${esc(u.typ)}" aria-labelledby="la-${esc(u.typ)}-rubrik">
    <h2 id="la-${esc(u.typ)}-rubrik">${esc(u.namn)}</h2>
    <p class="dampad liten">${esc(u.kalla)}. Utses av ${esc(u.utsesAv.toLowerCase())}.</p>
    <ul class="inkorg-lista">${[...rader, ...kommande, ...saknas].join('')}</ul>
    <details class="la-omfattning"><summary>Omfattning enligt ansvarsdokumentet</summary><ul>${u.omfattning.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
    ${u.tidigare.length ? `<details class="la-tidigare"><summary>Tidigare uppdrag</summary><ul>${u.tidigare.map(g => `<li>${person(g)}${g.reserv ? ' (reserv)' : ''}: ${period(g)}${g.avslutat ? `, avslutat från ${esc(datum(g.avslutat.fran))} av ${esc(g.avslutat.av ?? '')}: ${esc(g.avslutat.orsak ?? '')}` : ''}.</li>`).join('')}</ul></details>` : ''}
  </section>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Läkemedelsansvar', 'Uppdragen i läkemedelshanteringen på vårdenheten, med omfattning och period.') + '<div id="la"><p class="tom">Hämtar.</p></div>';
  const o = await api('/api/lakemedelsansvar');
  const el = main.querySelector('#la');
  if (!el) return;
  const d = o.ansvarsdokument;
  const pam = o.paminnelser.map((p, i) => `<li class="ik-ater la-paminnelse ik-larm"><div class="ik-text"><span class="ik-rubrik">${ikon.larm}<span>${esc(p.namn)}</span></span>
      <span class="under-text">${esc(p.text)}</span>${p.forslag?.personalId ? `<span class="under-text la-forslag">Förslag: ${esc(p.forslag.varfor)}</span>` : ''}</div>
      <div class="ik-knappar">${p.forslag?.personalId ? `<button type="button" class="knapp liten" data-paminnelse="${i}">${p.typ === 'gar_ut' ? 'Förnya' : `Utse ${esc(p.forslag.kandidater[0].namn)}`}</button>` : ''}${p.typ === 'oversyn' ? '<button type="button" class="knapp liten" data-oversyn>Markera som genomgånget</button>' : ''}</div></li>`);
  el.innerHTML = `${o.kanAndra ? `<section class="inkorg-sektion" aria-labelledby="la-pam"><h2 id="la-pam">Att göra <span class="antal${pam.length ? ' antal-aktiv' : ''}">${pam.length}</span></h2>
      ${pam.length ? `<ul class="inkorg-lista">${pam.join('')}</ul>` : '<p class="tom liten">Alla uppdrag är tillsatta och ansvarsdokumentet är aktuellt.</p>'}</section>` : ''}
    <p class="ruta ruta-info liten">${esc(o.ledningsansvar)}</p>
    <div class="la-rutnat">${o.uppdrag.map(u => uppdragHtml(o, u)).join('')}</div>
    <section class="lm-sektion" aria-labelledby="la-dok"><h2 id="la-dok">Ansvarsdokumentet</h2>
      <p>${d.senast ? `Senast reviderat ${esc(datum(d.senast.datum))} av ${esc(d.senast.av)} (${esc(d.senast.hur)}).` : 'Har inte reviderats.'} ${d.forfallet ? 'Ska ses över nu.' : `Nästa genomgång senast ${esc(datum(d.nasta))}.`} Det revideras vid förändringar och minst en gång per år, och varje ändrat uppdrag räknas som en revidering.</p>
      ${o.kanAndra && !d.forfallet ? '<button type="button" class="knapp sekundar" data-oversyn>Markera som genomgånget</button>' : ''}</section>
    <p class="demoregel">${esc(o.anmarkning)}</p>`;
  el.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-paminnelse]');
    if (p) return utse(main, o.paminnelser[Number(p.dataset.paminnelse)].forslag, p);
    const u = e.target.closest('[data-utse]');
    if (u) {
      const typ = o.uppdrag.find(x => x.typ === u.dataset.utse);
      return utse(main, typ.forslag[u.dataset.reserv === 'true' ? 1 : 0], u);
    }
    const a = e.target.closest('[data-avsluta]');
    if (a) return avsluta(main, a);
    const g = e.target.closest('[data-oversyn]');
    if (g) {
      try { await medKnapp(g, () => api('/api/lakemedelsansvar/oversyn', { metod: 'POST', data: {} })); notis('Ansvarsdokumentet är markerat som genomgånget.'); visa(main); } catch { /* notis visad */ }
    }
  });
}

// Systemet har fyllt i personen, perioden och omfattningen. Verksamhetschefen ändrar bara det som inte passar.
async function utse(main, f, knapp) {
  if (!f?.personalId) { visa(main); return; }
  const namnet = f.reserv ? 'reservkontrollant för narkotikaförbrukningen' : (main.querySelector(`#la-${f.typ}-rubrik`)?.textContent ?? '').toLowerCase();
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Utse ${esc(namnet)}</h2>
    <div class="falt"><label for="la-person">Person</label><select id="la-person" name="personalId">${f.kandidater.map(k => `<option value="${esc(k.id)}"${k.id === f.personalId ? ' selected' : ''}>${esc(k.namn)}, ${esc((k.titel ?? '').toLowerCase())}</option>`).join('')}</select>
      <p class="hjalp">${esc(f.varfor)}</p></div>
    <div class="falt-rad"><div class="falt smal"><label for="la-fran">Från</label><input id="la-fran" name="fran" type="date" value="${esc(f.fran)}"></div>
      <div class="falt smal"><label for="la-till">Till och med</label><input id="la-till" name="till" type="date" value="${esc(f.till)}"></div></div>
    <p class="liten">Ett år föreslås, så att uppdraget följer den årliga genomgången av ansvarsdokumentet.</p>
    <details><summary>Omfattning som skrivs in i ansvarsdokumentet</summary><ul class="liten">${f.omfattning.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
    <div class="falt"><label for="la-tillagg">Tillägg till omfattningen, om något</label><input id="la-tillagg" name="tillagg" maxlength="300"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Utse</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { klass: 'dialog-bred', onOpen: (dl) => dl.querySelector('[data-varde="ok"]').focus() });
  if (!svar) { visa(main); return; }
  try {
    const r = await medKnapp(knapp, () => api('/api/lakemedelsansvar/uppdrag', { metod: 'POST', data: { typ: f.typ, reserv: f.reserv, ...svar.data } }));
    notis(`${r.uppdrag.personal.namn} är utsedd till ${r.uppdrag.namn.toLowerCase()} från ${datum(r.uppdrag.fran)} till ${datum(r.uppdrag.till)}.`);
  } catch { /* notis visad */ }
  visa(main);
}

async function avsluta(main, knapp) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Avsluta uppdraget för ${esc(knapp.dataset.namn)}</h2>
    <p>Uppdraget gäller inte från och med i dag. Det finns kvar i historiken med ditt namn och orsaken.</p>
    <fieldset class="kryssgrupp"><legend>Orsak</legend>
      ${['Byter arbetsuppgifter', 'Slutar på vårdenheten', 'Uppdraget ges till någon annan'].map((x, i) => `<div class="kryssfalt"><input type="radio" id="la-o${i}" name="orsak" value="${esc(x)}"${i ? '' : ' checked'}><label for="la-o${i}">${esc(x)}</label></div>`).join('')}
    </fieldset>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta uppdraget</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) { visa(main); return; }
  try {
    await medKnapp(knapp, () => api(`/api/lakemedelsansvar/uppdrag/${encodeURIComponent(knapp.dataset.avsluta)}/avsluta`, { metod: 'POST', data: { orsak: svar.data.orsak } }));
    notis('Uppdraget är avslutat.');
  } catch { /* notis visad */ }
  visa(main);
}
