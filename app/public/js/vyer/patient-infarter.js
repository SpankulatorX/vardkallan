// In- och utfarter (runda 10, r4, Sussa 3.1.3.3 och 3.1.3.8): katetrar, sonder och dränage. Systemet förväljer storlek
// och tid, föreslår placeringar, räknar nästa skötsel och sätter KVÅ-koden. Den som registrerar väljer typ och skriver
// var den sitter.
import { esc, api, tidpunkt, notis, medKnapp, ikon, dialog } from '../ui.js';
import { doldaRad } from './patient.js';

const NIVA = { varning: 'ruta-larm', observera: 'ruta-info' };

function rad(x, kan) {
  return `<li class="if-rad${x.forsenad ? ' if-forsenad' : ''}" data-infart="${x.id}">
    <div class="if-text"><p class="if-rubrik"><strong>${esc(x.namn)}</strong> <span class="tagg">${esc(x.gruppText ?? '')}</span>${x.forsenad ? ' <span class="tagg tagg-larm">Skötseln är försenad</span>' : ''}</p>
      <p>${esc(x.storlekText)}, ${esc(x.placering)}. Satt ${esc(tidpunkt(x.lagd.tid))}${x.lagd.av ? ` av ${esc(x.lagd.av)}` : ''}, ${x.dygn} dygn${x.aktiv ? '' : ' totalt'}.</p>
      ${x.aktiv ? `<p class="under-text">Nästa skötsel senast ${esc(tidpunkt(x.nastaSkotsel))}. ${esc(x.skotselText ?? '')}</p>` : `<p class="under-text">Avvecklad ${esc(tidpunkt(x.avvecklad.tid))} av ${esc(x.avvecklad.av ?? '')}: ${esc(x.avvecklad.orsak)}.</p>`}
      ${x.rad.map(r => `<p class="ruta ${NIVA[r.niva] ?? 'ruta-info'} liten">${ikon.info}<span>${esc(r.text)}</span></p>`).join('')}
      ${x.skotsel.length ? `<details class="if-historik"><summary>Skötsel, ${x.skotsel.length} gånger</summary><ul class="enkel-lista">${x.skotsel.map(s => `<li>${esc(tidpunkt(s.tid))}, ${esc(s.av ?? '')}${s.anteckning ? `: ${esc(s.anteckning)}` : ''}</li>`).join('')}</ul></details>` : ''}
      <p class="under-text">${esc(x.kallaText)}${x.artikel ? `, artikel ${esc(x.artikel.artikel)}${x.artikel.batch ? `, batch ${esc(x.artikel.batch)}` : ''}` : ''}. ${esc(x.vardenhet?.namn ?? '')}.${x.ersatterId ? ' Ersätter en tidigare.' : ''}</p></div>
    ${x.aktiv && kan ? `<div class="if-knappar knapprad"><button type="button" class="knapp liten" data-if-skotsel="${x.id}">Skötsel gjord</button><button type="button" class="knapp liten sekundar" data-if-byt="${x.id}">Byt</button><button type="button" class="knapp liten sekundar" data-if-avveckla="${x.id}">Avveckla</button></div>` : ''}
  </li>`;
}

function formular(d) {
  const t = d.typer[0];
  return `<form class="mv-form if-form" id="if-form" novalidate aria-labelledby="if-reg">
    <h3 id="if-reg">Registrera in- eller utfart</h3>
    <div class="falt-rad">
      <div class="falt"><label for="if-typ">Typ</label><select id="if-typ" name="typ">${d.typer.map(x => `<option value="${esc(x.id)}">${esc(x.namn)}</option>`).join('')}</select></div>
      <div class="falt smal"><label for="if-storlek">Storlek</label><select id="if-storlek" name="storlek">${t.storlekar.map(s => `<option value="${esc(s)}"${s === t.standard ? ' selected' : ''}>${esc(s)} ${esc(t.enhet)}</option>`).join('')}</select></div>
      <div class="falt"><label for="if-placering">Var den sitter</label><input id="if-placering" name="placering" list="if-placeringar" maxlength="60" autocomplete="off" required><datalist id="if-placeringar">${t.placeringar.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    </div>
    <details class="if-mer"><summary>Tid och skanning vid sängen</summary><div class="falt-rad">
      <div class="falt"><label for="if-lagd">Satt</label><input id="if-lagd" name="lagd" type="datetime-local" aria-describedby="if-lagd-h"><span class="hjalp" id="if-lagd-h">Tomt betyder att du satte den nu. En tidigare tid betyder att någon annan satte den.</span></div>
      <div class="falt"><label for="if-armband">Armband</label><input id="if-armband" name="armband" autocomplete="off" aria-describedby="if-armband-h"><span class="hjalp" id="if-armband-h">Skanna patientens armband. Systemet kontrollerar att det är rätt patient.</span></div>
      <div class="falt"><label for="if-forpackning">Förpackning</label><input id="if-forpackning" name="forpackning" autocomplete="off" aria-describedby="if-forp-h"><span class="hjalp" id="if-forp-h">Skanna förpackningens streckkod. Systemet sparar artikel, batch och utgångsdatum.</span></div>
    </div></details>
    <p class="hjalp">Systemet sätter vårdkontakt, KVÅ-kod och nästa skötsel.</p>
    <div class="knapprad"><button type="submit" class="knapp">Registrera</button></div>
    <p class="form-fel" role="alert" hidden></p>
  </form>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/infarter`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>In- och utfarter</h2><p class="dampad">Katetrar, sonder och dränage från insättning till avveckling.</p></div>${doldaRad(d.dolda)}
    ${d.kanRegistrera ? formular(d) : ''}
    <section aria-labelledby="if-aktiva"><h3 id="if-aktiva">Sitter nu</h3>${d.aktiva.length ? `<ul class="if-lista">${d.aktiva.map(x => rad(x, d.kanRegistrera)).join('')}</ul>` : '<p class="tom">Inga in- eller utfarter som du kan se.</p>'}</section>
    ${d.avvecklade.length ? `<section aria-labelledby="if-avvecklade"><h3 id="if-avvecklade">Avvecklade</h3><ul class="if-lista">${d.avvecklade.map(x => rad(x, false)).join('')}</ul></section>` : ''}
    <p class="under-text">${esc(d.demoregel)}</p>`;

  const form = el.querySelector('#if-form');
  if (form) {
    const satt = () => {
      const t = d.typer.find(x => x.id === form.typ.value);
      form.storlek.innerHTML = t.storlekar.map(s => `<option value="${esc(s)}"${s === t.standard ? ' selected' : ''}>${esc(s)} ${esc(t.enhet)}</option>`).join('');
      el.querySelector('#if-placeringar').innerHTML = t.placeringar.map(p => `<option value="${esc(p)}">`).join('');
    };
    form.typ.addEventListener('change', satt);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.placering.value.trim()) { form.placering.setAttribute('aria-invalid', 'true'); form.placering.focus(); return; }
      const data = { typ: form.typ.value, storlek: form.storlek.value, placering: form.placering.value.trim() };
      if (form.lagd.value) data.lagd = new Date(form.lagd.value).toISOString();
      if (form.armband.value.trim()) data.armband = form.armband.value.trim();
      if (form.forpackning.value.trim()) data.forpackning = form.forpackning.value.trim();
      try {
        const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/infarter`, { metod: 'POST', data }), form);
        notis(`${r.namn} är registrerad. Nästa skötsel senast ${tidpunkt(r.nastaSkotsel)}.`);
        ctx.ladda();
      } catch { /* felet visas i formuläret */ }
    });
  }
  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-if-skotsel]');
    const b = e.target.closest('[data-if-byt]');
    const a = e.target.closest('[data-if-avveckla]');
    try {
      if (s) {
        await medKnapp(s, () => api(`/api/infart/${s.dataset.ifSkotsel}/skotsel`, { metod: 'POST', data: {} }));
        notis('Skötseln är registrerad.');
        ctx.ladda();
      } else if (b) {
        await medKnapp(b, () => api(`/api/infart/${b.dataset.ifByt}/byt`, { metod: 'POST', data: {} }));
        notis('Den gamla är avvecklad och en ny med samma storlek och placering är registrerad.');
        ctx.ladda();
      } else if (a) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Avveckla</h2>
          <div class="falt"><label for="if-orsak">Varför</label><select id="if-orsak" name="orsak">${d.orsaker.filter(o => o.id !== 'byte').map(o => `<option value="${esc(o.id)}">${esc(o.text)}</option>`).join('')}</select></div>
          <p class="hjalp">Systemet registrerar avvecklingen med KVÅ-kod.</p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avveckla</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        await medKnapp(a, () => api(`/api/infart/${a.dataset.ifAvveckla}/avveckla`, { metod: 'POST', data: { orsak: svar.data.orsak } }));
        notis('Avvecklingen är registrerad.');
        ctx.ladda();
      }
    } catch { /* felet visas som notis */ }
  });
}
