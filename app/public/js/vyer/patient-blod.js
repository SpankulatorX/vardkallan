// Blod i patientens journal (runda 11, r4, Sussa 4.4.2.12). Läkaren beställer blod, och systemet beställer själv
// blodgruppering och bastest som saknas. Beställningen följs från upprättad till avslutad. Vid sängen kontrollerar
// systemet id-bandet, enhetsnumret, blodgruppen och bastestet i den gemensamma transfusionskontrollen, och en andra
// person kontrollerar i sin egen inloggning. Transfusionen blir en administrering i läkemedelslistan, och en
// transfusionsreaktion rapporteras till blodcentralen med systemets klassning och åtgärder.
import { esc, api, tidpunkt, klockslag, notis, medKnapp, ikon } from '../ui.js';
import { far, S } from '../app.js';

export const namn = 'patient-blod';

const STEG = ['Upprättad', 'Blodgruppering och bastest', 'Förenlighetsprövad', 'Utlämnad', 'Avslutad'];
const stegFor = (b) => ({ vantar_prov: 1, utreds: 1, beredd: 2, utlamnad: 3, avslutad: 4, makulerad: 4 }[b.status]);
const SYMTOM = [['feber', 'Feber'], ['frossa', 'Frossa'], ['urtikaria', 'Nässelutslag eller klåda'], ['andnod', 'Andnöd'], ['blodtrycksfall', 'Blodtrycksfall'], ['ryggsmarta', 'Smärta i rygg eller bröst'], ['morkUrin', 'Mörk urin'], ['takykardi', 'Hjärtklappning']];

export const kedja = (steg) => `<ol class="bl-kedja" aria-label="Beställningens steg">${STEG.map((s, i) => `<li class="${i < steg ? 'bl-klar' : i === steg ? 'bl-nu' : ''}"${i === steg ? ' aria-current="step"' : ''}>${esc(s)}</li>`).join('')}</ol>`;

function las(e, steg, pnr) {
  return `<form class="falt-rad" data-bl-form="${steg}" data-enhet="${e.id}" novalidate>
    <div class="falt smal"><label for="bl-a-${e.id}-${steg}">Id-band</label><input id="bl-a-${e.id}-${steg}" name="armband" autocomplete="off" inputmode="numeric"></div>
    <div class="falt smal"><label for="bl-e-${e.id}-${steg}">Enhetsnummer på påsen</label><input id="bl-e-${e.id}-${steg}" name="enhetsnummer" autocomplete="off"></div>
    <div class="falt knappfalt knapprad"><button type="button" class="knapp liten sekundar" data-bl-las="${esc(pnr)}|${esc(e.enhetsnummer)}">Läs med skannern (demo)</button>
      <button type="submit" class="knapp liten">${steg === 'forbered' ? 'Förbered vid sängen' : 'Kontrollera'}</button></div></form>`;
}
function reaktionForm(e) {
  return `<form class="bl-reak" data-bl-form="reaktion" data-enhet="${e.id}" id="bl-r-${e.id}" hidden novalidate><fieldset><legend>Patientens symtom</legend>
    <div class="kryssrad">${SYMTOM.map(([id, t]) => `<div class="kryssfalt"><input type="checkbox" id="bl-s-${e.id}-${id}" name="symtom" value="${id}"><label for="bl-s-${e.id}-${id}">${esc(t)}</label></div>`).join('')}</div></fieldset>
    <div class="falt-rad"><div class="falt smal"><label for="bl-t-${e.id}">Temperatur</label><input id="bl-t-${e.id}" name="temp" inputmode="decimal" autocomplete="off"></div>
    <div class="falt knappfalt"><button type="submit" class="knapp liten knapp-allvar">Rapportera reaktionen</button></div></div>
    <p class="hjalp">Systemet klassar reaktionen, stoppar transfusionen och skickar rapporten till blodcentralen.</p></form>`;
}
function enhetHtml(e, b, pnr) {
  const kan = far('ge_lakemedel');
  const jag = S.session?.personal?.namn;
  const reakKnapp = `<button type="button" class="knapp liten sekundar" data-bl-oppna="bl-r-${e.id}">Transfusionsreaktion</button>`;
  let atg = '';
  if (kan && e.status === 'utlamnad') atg = `${las(e, 'forbered', pnr)}<p class="knapprad"><button type="button" class="knapp liten sekundar" data-bl-atg="aterlamna" data-enhet="${e.id}">Återlämna</button></p>`;
  else if (kan && e.status === 'vantar_kontroll') atg = e.forbereddAv === jag ? '<p class="under-text">Väntar på att en annan sjuksköterska eller läkare kontrollerar i sin egen inloggning.</p>' : las(e, 'kontrollera', pnr);
  else if (kan && e.status === 'kontrollerad') atg = `<p class="knapprad"><button type="button" class="knapp liten" data-bl-atg="starta" data-enhet="${e.id}">Starta transfusionen</button></p>`;
  else if (kan && e.status === 'pagar') atg = `<p class="knapprad"><button type="button" class="knapp liten" data-bl-atg="avsluta" data-enhet="${e.id}">Avsluta, ingen reaktion</button>${reakKnapp}</p>${reaktionForm(e)}`;
  else if (kan && e.status === 'transfunderad') atg = `<p class="knapprad">${reakKnapp}</p>${reaktionForm(e)}`;
  return `<li><p><strong>Enhet ${esc(e.enhetsnummer)}</strong>, blodgrupp ${esc(e.blodgrupp)} <span class="tagg">${esc(e.statusText)}</span></p>
    <p class="under-text">Hållbar till ${esc(e.hallbar)}.${e.startaSenast ? ` Starta senast klockan ${esc(klockslag(e.startaSenast))}, annars återlämnas blodet.` : ''}${e.start ? ` Startad ${esc(tidpunkt(e.start))} av ${esc(e.givenAv ?? '')}, kontrollerad av ${esc(e.kontrolleradAv ?? '')}.` : ''}${e.slut ? ` Slut ${esc(tidpunkt(e.slut))}.` : ''}${e.reaktion ? ` ${esc(e.reaktion)}.` : ''}</p>${atg}</li>`;
}
function reaktionHtml(r) {
  return `<div class="ruta ${r.allvarlighet === 'allvarlig' ? 'ruta-larm' : 'ruta-obs'}">${ikon.larm}<div><p><strong>${esc(r.typText)}</strong>, enhet ${esc(r.enhetsnummer)}. ${esc(r.symtom.join(', '))}${r.temp ? `, ${esc(String(r.temp).replace('.', ','))} grader` : ''}. Rapporterad ${esc(tidpunkt(r.tid))} av ${esc(r.av ?? '')}, mottagen av blodcentralen.</p>
    <ul class="enkel-lista">${r.atgarder.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    ${r.proverBestallda ? `<p class="under-text">Proverna är beställda: ${esc(r.prover.join(', '))}.</p>` : far('bestalla_prov') ? `<p class="knapprad"><button type="button" class="knapp liten" data-bl-prover="${r.id}">Beställ proverna: ${esc(r.prover.join(', '))}</button></p>` : ''}</div></div>`;
}
function bestallningHtml(b, pnr) {
  const kan = far('ge_lakemedel');
  return `<article class="ov-sektion bl-best" aria-labelledby="bl-b-${b.id}"><div class="sektion-huvud"><h3 id="bl-b-${b.id}">${esc(b.antal)} ${esc(b.produkt.namn.toLowerCase())}, ${esc(b.nummer)}</h3>
      <p class="under-text">${esc(b.statusText)}. ${esc(b.indikation)}. Beställd ${esc(tidpunkt(b.bestalld.tid))} av ${esc(b.bestalld.av)}, ${esc(b.vardenhet?.namn ?? '')}.${b.ordinationId ? ' Står som tillfällig ordination i läkemedelslistan.' : ''}</p></div>
    ${kedja(stegFor(b))}
    ${b.avvikelser.filter(a => !a.kvitterad).map(a => `<p class="ruta ruta-obs liten">${ikon.varning}<span>${esc(a.orsak)}</span></p>`).join('')}
    ${b.reaktioner.map(reaktionHtml).join('')}
    ${kan && b.status === 'beredd' ? `<p class="knapprad"><button type="button" class="knapp" data-bl-utlamna="${b.id}">Hämta från blodcentralen</button> <span class="under-text">Transfusionen ska starta inom 30 minuter efter hämtningen.</span></p>` : ''}
    ${b.enheter.length ? `<ul class="bl-enheter">${b.enheter.map(e => enhetHtml(e, b, pnr)).join('')}</ul>` : ''}
    <details><summary>Historik</summary><ul class="enkel-lista">${b.historik.map(h => `<li>${esc(tidpunkt(h.tid))}, ${esc(h.av ?? '')}: ${esc(h.detalj ?? h.handelse)}</li>`).join('')}</ul></details>
  </article>`;
}

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const [d, f] = await Promise.all([api(`/api/patient/${pid}/blod`), far('bestalla_prov') ? api(`/api/patient/${pid}/blod/forslag`).catch(() => null) : null]);
  if (!ctx.aktuell()) return;
  const pnr = ctx.patient?.personnummer ?? '';
  el.innerHTML = `<div class="flikhuvud"><h2>Blod</h2><p class="dampad">Beställningar till blodcentralen från upprättad till avslutad, och transfusionen vid sängen. <a href="#/blodcentral">Blodcentralen</a></p></div>
    ${f ? `<form class="mv-form" id="bl-ny" novalidate aria-labelledby="bl-ny-r"><h3 id="bl-ny-r">Beställ blod</h3>
      <p class="ruta ruta-info liten">${ikon.info}<span>${esc(f.text)}</span></p>
      <div class="falt-rad">
        <div class="falt"><label for="bl-produkt">Produkt</label><select id="bl-produkt" name="produkt">${f.produkter.map(p => `<option value="${esc(p.id)}"${p.id === f.produkt ? ' selected' : ''}>${esc(p.namn)}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="bl-antal">Antal enheter</label><select id="bl-antal" name="antal">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === f.antal ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="falt"><label for="bl-indikation">Indikation</label><input id="bl-indikation" name="indikation" maxlength="300" autocomplete="off" list="bl-ind"><datalist id="bl-ind"><option value="Anemi med symtom"><option value="Postoperativ anemi"><option value="Pågående blödning"><option value="Trombocytopeni inför ingrepp"></datalist></div>
      </div>
      <div class="knapprad"><button type="submit" class="knapp">Beställ</button></div><p class="form-fel" role="alert" hidden></p></form>` : ''}
    ${d.bestallningar.length ? d.bestallningar.map(b => bestallningHtml(b, pnr)).join('') : '<p class="tom">Inga blodbeställningar som du kan se.</p>'}
    <p class="under-text">${esc(d.demoregel)}</p>`;

  const post = async (knapp, vag, data = {}, form = null, text = null) => {
    try {
      const r = await medKnapp(knapp, () => api(vag, { metod: 'POST', data }), form);
      if (r?.reaktion) notis(`${r.reaktion.typText}. ${r.reaktion.atgarder.join(' ')}`, 'fel', { kvar: true });
      else if (text) notis(text);
      ctx.ladda();
    } catch { /* notis eller i formuläret */ }
  };
  el.querySelector('#bl-ny')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fo = e.currentTarget;
    if (!fo.indikation.value.trim()) { fo.indikation.setAttribute('aria-invalid', 'true'); fo.indikation.focus(); return; }
    post(fo.querySelector('[type=submit]'), `/api/patient/${pid}/blod`, { produkt: fo.produkt.value, antal: Number(fo.antal.value), indikation: fo.indikation.value }, fo, 'Blodet är beställt.');
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.blOppna) { const x = el.querySelector(`#${t.dataset.blOppna}`); x.hidden = !x.hidden; if (!x.hidden) x.querySelector('input')?.focus(); return; }
    if (t.dataset.blLas) { const [p, n] = t.dataset.blLas.split('|'); const fo = t.closest('form'); fo.armband.value = p; fo.enhetsnummer.value = n; fo.querySelector('[type=submit]').focus(); return; }
    if (t.dataset.blUtlamna) post(t, `/api/blod/${t.dataset.blUtlamna}/utlamna`, {}, null, 'Blodet är hämtat. Starta inom 30 minuter.');
    if (t.dataset.blAtg) {
      const data = t.dataset.blAtg === 'aterlamna' ? { orsak: 'Behövs inte längre' } : {};
      post(t, `/api/blodenhet/${t.dataset.enhet}/${t.dataset.blAtg}`, data, null, { starta: 'Transfusionen är startad och står i läkemedelslistan.', avsluta: 'Transfusionen är avslutad.', aterlamna: 'Enheten är återlämnad.' }[t.dataset.blAtg]);
    }
    if (t.dataset.blProver) post(t, `/api/blod/reaktion/${t.dataset.blProver}/prover`, {}, null, 'Proverna efter reaktionen är beställda.');
  });
  el.addEventListener('submit', (e) => {
    const fo = e.target.closest('[data-bl-form]');
    if (!fo) return;
    e.preventDefault();
    const s = fo.dataset.blForm;
    if (s === 'reaktion') {
      const symtom = [...fo.querySelectorAll('[name=symtom]:checked')].map(x => x.value);
      if (!symtom.length) { notis('Välj patientens symtom.', 'fel'); return; }
      return post(fo.querySelector('[type=submit]'), `/api/blodenhet/${fo.dataset.enhet}/reaktion`, { symtom, temp: fo.temp.value || null }, null);
    }
    post(fo.querySelector('[type=submit]'), `/api/blodenhet/${fo.dataset.enhet}/${s}`, { armband: fo.armband.value, enhetsnummer: fo.enhetsnummer.value }, null, s === 'forbered' ? 'Enheten väntar på kontroll av en andra person.' : 'Enheten är kontrollerad.');
  });
}
