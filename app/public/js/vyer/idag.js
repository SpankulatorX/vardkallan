// Vårdadministratörens startsida: dagens arbete i ordning. Vilka som kommer i dag och om de har kommit, remisser som
// väntar på tid, väntelistan, kallelser som behöver gå ut och bevakningar som har löpt ut. Varje rad har en enda nästa
// åtgärd. Systemet har redan räknat ut ordningen, tiderna, kallelserna och avgifterna.
import { esc, api, vyRubrik, notis, felNotis, medKnapp, dialog, ikon } from '../ui.js';
import { patientCell, pnrCell } from './arbetslista.js';
import { valjTid, valjBetalsatt, tidText, kl, kr, gransHtml, kallelseHtml, dagar } from '../tidbok-ui.js';

export const namn = 'idag';

const sektion = (id, rubrik, antal, innehall, tomText) => `<section class="tabellsektion idag-sektion" id="idag-${id}" aria-labelledby="idag-${id}-r">
  <h2 id="idag-${id}-r">${esc(rubrik)} <span class="antal">${antal}</span></h2>
  ${antal ? innehall : `<p class="tom liten">${esc(tomText)}</p>`}</section>`;
const atgard = (a, data) => (a ? `<button type="button" class="knapp liten" data-atgard="${esc(a.typ)}" ${data}>${esc(a.text)}</button>` : '<span class="dampad liten">Ingen åtgärd</span>');
const patient = (p) => `${patientCell(p, `#/patient/${encodeURIComponent(p.id)}`)}<span class="under-text">${pnrCell(p)}</span>`;

function dagensHtml(s) {
  return `<div class="tabellrulle"><table class="tabell idag-tabell">
    <thead><tr><th scope="col">Tid</th><th scope="col">Patient</th><th scope="col">Besök</th><th scope="col">Status</th><th scope="col">Nästa åtgärd</th></tr></thead>
    <tbody>${s.dagens.map(d => `<tr${d.rad.sen ? ' class="rad-sen"' : ''}${d.patient.skyddad ? ' data-skyddad' : ''}>
      <td><strong>${esc(kl(d.tid.start))}</strong></td>
      <td>${patient(d.patient)}</td>
      <td>${esc(d.tid.tidstypText)}<span class="under-text">${esc(d.tid.vardgivare?.namn ?? '')}</span></td>
      <td>${d.rad.sen ? `<span class="tagg tagg-utkast">${esc(d.rad.status)}</span>` : esc(d.rad.status)}</td>
      <td class="atgarder">${atgard(d.rad.atgard, `data-bokning="${d.id}"`)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function posterHtml(poster, remiss) {
  return `<div class="tabellrulle"><table class="tabell idag-tabell">
    <thead><tr><th scope="col">Patient</th><th scope="col">${remiss ? 'Remiss' : 'Vad'}</th><th scope="col">Prioritet</th><th scope="col">Väntat</th><th scope="col">Gräns</th><th scope="col">Nästa åtgärd</th></tr></thead>
    <tbody>${poster.map(p => `<tr${p.grans?.risk ? ' class="rad-risk"' : ''}>
      <td>${patient(p.patient)}</td>
      <td>${remiss ? `Från ${esc(p.remiss.fran?.namn ?? '')}` : esc(p.orsak)}<span class="under-text">${esc(p.tidstypText)} hos ${esc(p.yrkesrollText)}</span>${p.styrLakemedel ? '<span class="under-text"><span class="tagg">Styr en läkemedelsdos</span></span>' : ''}</td>
      <td>${esc(p.prioritetText)}${p.patientvald ? '<span class="under-text">Patientvald väntan</span>' : ''}</td>
      <td>${esc(dagar(p.vantatDagar))}</td>
      <td>${gransHtml(p.grans)}</td>
      <td class="atgarder">${atgard(p.atgard, `data-post="${p.id}"`)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

const kallelserHtml = (s) => `<ul class="enkel-lista idag-lista">${s.kallelser.map((k, i) => `<li>
  ${k.typ === 'grupp' ? `<strong>${esc(k.tid.rubrik ?? 'Gruppträff')}, ${esc(k.antal)} deltagare</strong>` : `<strong>${patientCell(k.patient)}</strong>, ${esc(tidText(k.tid.start))}`}
  <span class="under-text">${esc(k.text)}</span>
  <span class="knapprad tat">${atgard(k.atgard, `data-kallelse="${i}"`)}</span></li>`).join('')}</ul>`;

const bevakningarHtml = (s) => `<ul class="enkel-lista idag-lista">${s.bevakningar.map(b => `<li>
  <strong>${patientCell(b.patient, `#/patient/${encodeURIComponent(b.patient.id)}`)}</strong> ${esc(b.text)}
  <span class="under-text">${b.avSystemet ? 'Lagd av systemet' : `Lagd av ${esc(b.skapadAv?.namn ?? '')}`}, gällde till och med ${esc(b.forfaller)}.</span>
  <span class="knapprad tat">${atgard(b.atgard, `data-bevakning="${b.id}"${b.vantelistaId ? ` data-post="${b.vantelistaId}"` : ''}`)}</span></li>`).join('')}</ul>`;

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = vyRubrik('Dagens arbete') + '<p class="tom">Hämtar dagens arbete.</p>';
  await rita(main, ctx.aktuell ?? (() => true));
}

// aktuell säger om vyn fortfarande visas. Har användaren gått vidare medan svaret hämtades ritas inget.
async function rita(main, aktuell) {
  const s = await api('/api/idag');
  if (!aktuell()) return;
  const kvar = s.antal.kvarAttCheckaIn;
  const dag = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
  main.innerHTML = vyRubrik('Dagens arbete', `${esc(s.vardenhet.namn)}, ${esc(dag)}. Systemet har ordnat dagens arbete. Varje rad har en nästa åtgärd.`) + `<div id="idag">
    <nav class="snabbval" aria-label="Tidboken"><ul>
      <li><a class="knapp liten sekundar" href="#/tidbok">${ikon.klocka}<span>Tidbok</span></a></li>
      <li><a class="knapp liten sekundar" href="#/vantelista">${ikon.lista}<span>Väntelista</span></a></li>
      <li><a class="knapp liten sekundar" href="#/incheckning">${ikon.kort}<span>Incheckningsskärm i väntrummet</span></a></li>
    </ul></nav>
    ${sektion('dagens', kvar ? `Patienter i dag, ${kvar} kvar att checka in` : 'Patienter i dag', s.dagens.length, dagensHtml(s), 'Inga patienter har tid i dag.')}
    ${sektion('remisser', 'Remisser som väntar på tid', s.remisser.length, posterHtml(s.remisser, true), 'Alla accepterade remisser har fått tid.')}
    ${sektion('vantelista', 'Väntelistan', s.vantelista.length, posterHtml(s.vantelista, false), 'Ingen väntar på tid.')}
    ${sektion('kallelser', 'Kallelser som behöver gå ut', s.kallelser.length, kallelserHtml(s), 'Alla kallelser är skickade. Påminnelser går ut av sig själva.')}
    ${sektion('bevakningar', 'Bevakningar som har löpt ut', s.bevakningar.length, bevakningarHtml(s), 'Inga bevakningar har löpt ut.')}
    <p class="hjalp">${esc(s.demoregler)} Patientavgifterna är demoregler.</p></div>`;
  // Lyssnaren sitter på innehållet, som ritas om efter varje åtgärd, så att den aldrig följer med till en annan vy.
  main.querySelector('#idag').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-atgard]');
    if (!b || upptagen) return;
    upptagen = true;
    try { await utfor(b, s); } catch (err) { felNotis(err); } finally { upptagen = false; }
    if (aktuell() && main.querySelector('#idag')) await rita(main, aktuell).catch(felNotis);
  });
}

let upptagen = false;

// Bokar en post på väntelistan från förslagen. Används också av väntelistan och patientens översikt.
export async function bokaPost(id, namn) {
  const f = await api(`/api/vantelista/${id}/forslag`);
  // En planerad vårdhändelse: dialogen säger att tiden styr en läkemedelsdos, aldrig vilket läkemedel (runda 5, r1).
  const styr = f.post.styrLakemedel ? `</p><p class="ruta ruta-info liten">${esc(f.post.styrLakemedel)}` : '';
  const tidId = await valjTid({ rubrik: `Boka tid för ${namn}`, text: `${esc(f.post.orsak)}. ${esc(f.post.tidstypText)} hos ${esc(f.post.yrkesrollText)}.${styr}`, forslag: f.forslag, demoregler: f.demoregler });
  if (!tidId) return null;
  const r = await api(`/api/vantelista/${id}/boka`, { metod: 'POST', data: { tidId } });
  notis(`${namn} har fått en tid ${tidText(r.tid.start)}. Kallelsen är skickad${r.kallelse?.kanalText ? ` via ${r.kallelse.kanalText.toLowerCase()}` : ''}.`);
  return r;
}

async function utfor(b, s) {
  const typ = b.dataset.atgard;
  if (typ === 'checka_in') {
    const d = s.dagens.find(x => String(x.id) === b.dataset.bokning);
    const r = await medKnapp(b, () => api(`/api/bokning/${d.id}/checka-in`, { metod: 'POST', data: {} }));
    const avg = r.betalning ? `${r.betalning.sattText}.` : r.avgift?.belopp ? `Att betala ${kr(r.avgift.belopp)}.` : '';
    notis(`${d.patient.namn} är incheckad${r.konummer ? ` med nummer ${r.konummer}` : ''}. ${avg}`.trim());
  } else if (typ === 'betala') {
    const d = s.dagens.find(x => String(x.id) === b.dataset.bokning);
    const satt = await valjBetalsatt(d.avgift, d.patient.namn);
    if (!satt) return;
    const r = await api(`/api/bokning/${d.id}/betala`, { metod: 'POST', data: { satt } });
    notis(`${kr(r.betalning.belopp)} är betalt med ${r.betalning.sattText.toLowerCase()}. Kvitto ${r.betalning.kvitto}.`);
  } else if (typ === 'boka') {
    const p = [...s.remisser, ...s.vantelista].find(x => String(x.id) === b.dataset.post);
    await bokaPost(b.dataset.post, p?.patient.namn ?? s.bevakningar.find(x => String(x.id) === b.dataset.bevakning)?.patient.namn ?? 'Patienten');
  } else if (typ === 'kalla_grupp') {
    const k = s.kallelser[Number(b.dataset.kallelse)];
    const svar = await dialog(`<h2 id="dlg-rubrik">Skicka kallelser till ${esc(k.tid.rubrik ?? 'gruppträffen')}</h2>
      <div class="dialog-text"><p>${esc(tidText(k.tid.start))}, ${esc(k.tid.vardgivare?.namn ?? '')}. ${esc(k.antal)} deltagare.</p>
      <p>Systemet har skrivit kallelserna och väljer kanal för var och en: Min journal, sms eller brev. En patient med skyddade personuppgifter får sin kallelse bara i Min journal.</p></div>
      ${k.exempel ? kallelseHtml({ typ: 'kallelse', text: k.exempel }) : ''}
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka ${esc(k.antal)} kallelser</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, { klass: 'dialog-bred' });
    if (svar?.val !== 'ok') return;
    const r = await api(`/api/tid/${k.tid.id}/kalla`, { metod: 'POST', data: {} });
    notis(`${r.skickade.length} kallelser är skickade till ${k.tid.rubrik ?? 'gruppträffen'}.`);
  } else if (typ === 'kallelse_klar') {
    const k = s.kallelser[Number(b.dataset.kallelse)];
    await medKnapp(b, () => api(`/api/kallelse/${k.kallelseId}/klar`, { metod: 'POST', data: {} }));
    notis('Kallelsen är markerad som lämnad.');
  } else if (typ === 'bevakning_klar') {
    await medKnapp(b, () => api(`/api/bevakning/${b.dataset.bevakning}/klar`, { metod: 'POST', data: {} }));
    notis('Bevakningen är klar.');
  }
}
