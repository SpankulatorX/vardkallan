// Skannade restjournaler (runda 10, r4, Sussa 3.1.10.1 och 3.1.10.2). Den som skannar väljer filen. Systemet läser
// textlagret, föreslår dokumenttyp och period, kontrollerar personnumret och sparar dokumentet, som sedan visas i
// översiktens tidslinje och är sökbart i journalen.
import { esc, api, tidpunkt, notis, medKnapp, ikon } from '../ui.js';
import { doldaRad } from './patient.js';

const lasFil = (fil) => new Promise((ok, fel) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] ?? '');
  r.onerror = () => fel(r.error);
  r.readAsDataURL(fil);
});

function dokumentRad(x, markerad) {
  return `<li class="rj-rad${markerad ? ' markerad' : ''}" id="rj-${x.id}">
    <p class="rj-rubrik"><strong>${esc(x.dokumenttypText)}</strong>, ${esc(x.period.text)} <span class="tagg tagg-migrerad">${ikon.arkiv}${esc(x.kallaEtikett)}</span></p>
    ${x.ursprung ? `<p>${esc(x.ursprung)}</p>` : ''}
    ${x.utdrag ? `<p class="rj-utdrag">${esc(x.utdrag)}</p>` : x.typ === 'application/pdf' ? '<p class="under-text">Systemet hittade ingen text i dokumentet.</p>' : '<p class="under-text">Bilden har ingen text som systemet kan läsa.</p>'}
    ${x.textOfullstandig ? '<p class="ruta ruta-info liten"><span>Texten är ofullständig. Dokumentet var för stort för att läsas helt, så sökningen hittar bara den del som lästes. Dokumentet är sparat i sin helhet.</span></p>' : ''}
    <p class="under-text">Skannad ${esc(tidpunkt(x.skannad.tid))} av ${esc(x.skannad.av ?? '')} på ${esc(x.vardenhet?.namn ?? '')}. ${esc(x.identitet)}</p>
    <p><a class="knapp liten sekundar" href="${esc(x.url)}" target="_blank" rel="noopener">Öppna ${esc(x.namn)}</a></p>
  </li>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/restjournaler`);
  if (!ctx.aktuell()) return;
  const markerad = ctx.sub ? Number(ctx.sub) : null;
  el.innerHTML = `<div class="flikhuvud"><h2>Restjournaler</h2><p class="dampad">Skannade pappersjournaler. De står också i översiktens tidslinje bland den övriga journalen.</p></div>${doldaRad(d.dolda)}
    ${d.kanSkanna ? `<form class="mv-form rj-form" id="rj-form" novalidate aria-labelledby="rj-skanna">
      <h3 id="rj-skanna">Skanna in en restjournal</h3>
      <div class="falt"><label for="rj-fil">Skannat dokument</label><input id="rj-fil" name="fil" type="file" accept="application/pdf,image/png,image/jpeg" aria-describedby="rj-fil-h"><span class="hjalp" id="rj-fil-h">PDF från skannern, eller en bild. Systemet läser texten och föreslår resten.</span></div>
      <div id="rj-forslag" aria-live="polite"></div>
      <p class="form-fel" role="alert" hidden></p>
    </form>` : ''}
    ${d.kanLasa ? `<section aria-labelledby="rj-lista"><h3 id="rj-lista">Inskannade</h3>${d.dokument.length ? `<ul class="rj-lista">${d.dokument.map(x => dokumentRad(x, x.id === markerad)).join('')}</ul>` : '<p class="tom">Inga skannade restjournaler som du kan se.</p>'}</section>`
      : '<p class="under-text">Din yrkesroll skannar in restjournaler men läser dem inte.</p>'}`;
  if (markerad) el.querySelector(`#rj-${markerad}`)?.scrollIntoView({ block: 'center' });

  const form = el.querySelector('#rj-form');
  if (!form) return;
  let fil = null;
  form.fil.addEventListener('change', async () => {
    const f = form.fil.files[0];
    const plats = el.querySelector('#rj-forslag');
    if (!f) { plats.innerHTML = ''; return; }
    try {
      fil = { namn: f.name, data: await lasFil(f) };
      const t = await medKnapp(null, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/restjournaler/tolka`, { metod: 'POST', data: { fil } }), form);
      plats.innerHTML = `<div class="ruta ${t.identitet === 'annan' ? 'ruta-larm' : 'ruta-info'} liten">${ikon.info}<span>${esc(t.text)}${t.redanSkannad ? ' Samma fil är redan inskannad.' : ''}${t.textOfullstandig ? ' Texten är ofullständig, eftersom dokumentet var för stort för att läsas helt. Dokumentet sparas ändå i sin helhet.' : ''}</span></div>
        ${t.identitet === 'annan' ? '' : `<div class="falt-rad">
          <div class="falt"><label for="rj-typ">Dokumenttyp</label><select id="rj-typ" name="dokumenttyp">${d.dokumenttyper.map(x => `<option value="${esc(x.id)}"${x.id === t.dokumenttyp ? ' selected' : ''}>${esc(x.text)}</option>`).join('')}</select></div>
          <div class="falt smal"><label for="rj-fran">Från</label><input id="rj-fran" name="periodFran" type="date" value="${esc(t.periodFran ?? '')}"></div>
          <div class="falt smal"><label for="rj-till">Till</label><input id="rj-till" name="periodTill" type="date" value="${esc(t.periodTill ?? '')}"></div>
          <div class="falt"><label for="rj-ursprung">Ursprung</label><input id="rj-ursprung" name="ursprung" maxlength="120" autocomplete="off" placeholder="Till exempel pappersjournal från medicinkliniken"></div>
        </div>
        ${t.identitet === 'stammer' ? '' : '<div class="kryssfalt"><input type="checkbox" id="rj-bekrafta" name="bekraftat"><label for="rj-bekrafta">Jag har kontrollerat att dokumentet gäller patienten</label></div>'}
        <p class="hjalp">${t.harText ? 'Dokumenttypen och perioden är systemets förslag ur texten. Ändra dem om de inte stämmer.' : 'Fyll i perioden om den syns på bilden.'}</p>
        <div class="knapprad"><button type="submit" class="knapp">Spara restjournalen</button></div>`}`;
    } catch { plats.innerHTML = ''; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fil || !form.dokumenttyp) return;
    const data = { fil, dokumenttyp: form.dokumenttyp.value, periodFran: form.periodFran.value || null, periodTill: form.periodTill.value || null, ursprung: form.ursprung.value.trim() || undefined };
    if (form.bekraftat) data.bekraftat = form.bekraftat.checked;
    try {
      await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/restjournaler`, { metod: 'POST', data }), form);
      notis('Restjournalen är inskannad och står i tidslinjen.');
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}
