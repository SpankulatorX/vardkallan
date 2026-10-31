// Remisser: inkommande och utgående för min vårdenhet, med statuskedjan och åtgärderna mottag, bedöm, svara och kvittera svar.
import { esc, api, datum, tidpunkt, notis, felNotis, dialog, ikon, PRIORITET_REMISS, vyRubrik, tom, migreradEtikett } from '../ui.js';
import { far, minVardenhet, uppdateraInkorg } from '../app.js';

export const namn = 'remisser';

export function remissStatusText(r) {
  if (r.status === 'skickad') return 'Skickad, väntar på mottagningskvittens';
  if (r.status === 'mottagen') return 'Mottagen, väntar på bedömning';
  if (r.status === 'bedomd' && r.beslut === 'avvisad') return 'Avvisad';
  if (r.status === 'bedomd') return 'Accepterad, väntar på svar';
  if (r.status === 'besvarad') return 'Besvarad, svaret väntar på kvittens';
  if (r.status === 'svar_kvitterat') return 'Svaret är kvitterat';
  return r.status;
}

const STEG = [
  ['skickad', 'Skickad', 'skickad', 'avsandare'],
  ['mottagen', 'Mottagen', 'mottagen', 'mottagen'],
  ['bedomd', 'Bedömd', 'bedomd', 'bedomd'],
  ['besvarad', 'Besvarad', 'besvarad', 'besvarad'],
  ['svar_kvitterat', 'Svar kvitterat', 'svarKvitterat', 'svarKvitterat'],
];
const ORDNING = STEG.map(s => s[0]);

function kedja(r) {
  const nu = ORDNING.indexOf(r.status);
  const avvisad = r.beslut === 'avvisad';
  return `<ol class="kedja" aria-label="Remissens statuskedja">${STEG.map(([k, t, tid, av], i) => {
    const gjord = i <= nu;
    const stopp = avvisad && i > ORDNING.indexOf('bedomd');
    const vem = av === 'avsandare' ? r.avsandare : r.av?.[av];
    const text = k === 'bedomd' && gjord ? (avvisad ? 'Avvisad' : 'Accepterad') : t;
    const lage = stopp ? 'stoppad' : gjord ? (k === 'bedomd' && avvisad ? 'avvisad' : 'klar') : i === nu + 1 ? 'nasta' : 'vantar';
    const sr = stopp ? 'avslutad, remissen avvisades' : gjord ? 'klart' : i === nu + 1 ? 'nästa steg' : 'inte än';
    return `<li class="steg steg-${lage}"><span class="steg-punkt" aria-hidden="true">${gjord ? (lage === 'avvisad' ? ikon.kryss : ikon.bock) : ''}</span>
      <span class="steg-text"><strong>${esc(text)}</strong><span class="sr"> (${sr})</span>${gjord && r.tider[tid] ? `<span class="under-text">${esc(tidpunkt(r.tider[tid]))}${vem ? `, ${esc(vem.namn)}` : ''}</span>` : ''}</span></li>`;
  }).join('')}</ol>`;
}

export function atgarder(r) {
  const ve = minVardenhet();
  const a = [];
  if (r.status === 'skickad' && r.till.id === ve && far('mottag_remiss')) a.push(['mottag', 'Kvittera mottagen']);
  if (r.status === 'mottagen' && r.till.id === ve && far('bedom_remiss')) a.push(['bedom', 'Bedöm']);
  if (r.status === 'bedomd' && r.beslut === 'accepterad' && r.till.id === ve && far('svara_remiss')) a.push(['svara', 'Svara']);
  if (r.status === 'besvarad' && r.fran.id === ve && far('kvittera_svar')) a.push(['kvittera', 'Kvittera svaret']);
  return a;
}

export function remissKort(r, { visaPatient = false, markerad = false } = {}) {
  const klinisk = r.fragestallning != null;
  const a = atgarder(r);
  const patient = visaPatient && r.patient ? (r.patient.skyddad
    ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span> <span class="pnr">${esc(r.patient.personnummer)}</span>`
    : `<a href="#/patient/${encodeURIComponent(r.patient.id)}/remisser">${esc(r.patient.namn)}</a> <span class="pnr">${esc(r.patient.personnummer)}</span>`) : '';
  return `<article class="remiss${markerad ? ' markerad' : ''}${r.larm?.length ? ' har-larm' : ''}" id="remiss-${r.id}" aria-labelledby="rem-${r.id}-rubrik">
    <header class="remiss-huvud">
      <h3 id="rem-${r.id}-rubrik">${patient ? `${patient}<span class="remiss-riktning">` : '<span class="remiss-riktning">'}Från ${esc(r.fran.namn)} till ${esc(r.till.namn)}</span></h3>
      <p class="remiss-meta"><span class="prio prio-${esc(r.prioritet)}">${esc(PRIORITET_REMISS[r.prioritet] ?? r.prioritet)}</span><span>Svar senast ${esc(datum(r.svarSenast))}</span><span>Remitterande ${esc(r.avsandare?.namn ?? '')}</span>${migreradEtikett(r)}</p>
    </header>
    ${kedja(r)}
    ${r.larm?.length ? `<ul class="larmlista">${r.larm.map(l => `<li>${ikon.larm}<span>${esc(l.text)}</span></li>`).join('')}</ul>` : ''}
    ${klinisk ? `<dl class="remiss-text">
      <div><dt>Frågeställning</dt><dd>${esc(r.fragestallning)}</dd></div>
      ${r.anamnes ? `<div><dt>Anamnes</dt><dd>${esc(r.anamnes)}</dd></div>` : ''}
      ${r.motivering ? `<div><dt>${r.beslut === 'avvisad' ? 'Motivering till avvisning' : 'Kommentar vid bedömning'}</dt><dd>${esc(r.motivering)}</dd></div>` : ''}
      ${r.svar ? `<div><dt>Svar</dt><dd>${esc(r.svar)}</dd></div>` : ''}
    </dl>` : '<p class="dampad liten">Frågeställning, anamnes och svar är journaltext och visas inte för vårdadministratörer.</p>'}
    ${a.length ? `<div class="knapprad">${a.map(([k, t], i) => `<button type="button" class="knapp liten${i ? ' sekundar' : ''}" data-remiss-atgard="${k}" data-id="${r.id}">${esc(t)}</button>`).join('')}</div>` : ''}
  </article>`;
}

// Kopplar åtgärdsknapparna i en behållare. efter() körs när en åtgärd lyckats.
export function kopplaAtgarder(behallare, hamta, efter) {
  behallare.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-remiss-atgard]');
    if (!b) return;
    const id = b.dataset.id;
    const r = hamta(id);
    const typ = b.dataset.remissAtgard;
    let data = {};
    if (typ === 'bedom') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Bedöm remissen</h2>
        <p>Från ${esc(r.fran.namn)}. ${esc(r.fragestallning ?? '')}</p>
        <fieldset class="radiogrupp"><legend>Beslut</legend>
          <div class="radio"><input type="radio" id="b-acc" name="beslut" value="accepterad" checked><label for="b-acc">Acceptera</label></div>
          <div class="radio"><input type="radio" id="b-avv" name="beslut" value="avvisad"><label for="b-avv">Avvisa</label></div>
        </fieldset>
        <div class="falt"><label for="b-mot">Motivering <span class="obl">(obligatorisk vid avvisning)</span></label><textarea id="b-mot" name="motivering" rows="3" maxlength="2000"></textarea></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara bedömningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.beslut === 'avvisad' && x.motivering.trim().length < 3 ? 'En avvisad remiss måste ha en motivering.' : null) });
      if (!svar) return;
      data = { beslut: svar.data.beslut, motivering: svar.data.motivering.trim() };
    } else if (typ === 'svara') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Svara på remissen</h2>
        <p>Frågeställning: ${esc(r.fragestallning ?? '')}</p>
        <div class="falt"><label for="s-svar">Svar <span class="obl">(obligatoriskt)</span></label><textarea id="s-svar" name="svar" rows="6" required minlength="3" maxlength="8000"></textarea></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka svaret</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.svar.trim().length < 3 ? 'Skriv ett svar.' : null) });
      if (!svar) return;
      data = { svar: svar.data.svar.trim() };
    }
    const vag = { mottag: 'mottag', bedom: 'bedom', svara: 'svara', kvittera: 'kvittera-svar' }[typ];
    b.disabled = true;
    try {
      const ny = await api(`/api/remiss/${id}/${vag}`, { metod: 'POST', data });
      notis({ mottag: 'Remissen är kvitterad som mottagen.', bedom: ny.beslut === 'avvisad' ? 'Remissen är avvisad. Remittenten ser motiveringen.' : 'Remissen är accepterad.', svara: 'Svaret är skickat till remittenten.', kvittera: 'Svaret är kvitterat. Remisskedjan är avslutad.' }[typ]);
      await uppdateraInkorg();
      efter(ny);
    } catch (err) { felNotis(err); if (b.isConnected) b.disabled = false; }
  });
}

export async function visa(main, _p, q) {
  const riktning = q.get('riktning') === 'utgaende' ? 'utgaende' : 'inkommande';
  const markerad = q.get('remiss');
  main.innerHTML = vyRubrik('Remisser', 'Remisser till och från din vårdenhet. Varje steg kvitteras, och uteblivna steg ger larm i inkorgen.') + `
    <nav class="delflikar" aria-label="Riktning"><ul>
      <li><a href="#/remisser?riktning=inkommande"${riktning === 'inkommande' ? ' aria-current="page"' : ''}>Inkommande</a></li>
      <li><a href="#/remisser?riktning=utgaende"${riktning === 'utgaende' ? ' aria-current="page"' : ''}>Utgående</a></li>
    </ul></nav>
    <div id="remisslista"><p class="tom">Hämtar remisser.</p></div>`;
  const el = main.querySelector('#remisslista');
  let lista = [];
  const rita = async () => {
    const d = await api(`/api/remisser?riktning=${riktning}`);
    lista = d.remisser;
    const pagaende = lista.filter(r => r.status !== 'svar_kvitterat' && r.beslut !== 'avvisad');
    const avslutade = lista.filter(r => !pagaende.includes(r));
    el.innerHTML = !lista.length ? tom(riktning === 'inkommande' ? 'Inga remisser till din vårdenhet.' : 'Inga remisser från din vårdenhet.') : `
      <section aria-labelledby="rp"><h2 id="rp">Pågående <span class="antal">${pagaende.length}</span></h2>${pagaende.map(r => remissKort(r, { visaPatient: true, markerad: String(r.id) === markerad })).join('') || tom('Inga pågående.')}</section>
      ${avslutade.length ? `<section aria-labelledby="ra"><h2 id="ra">Avslutade <span class="antal">${avslutade.length}</span></h2>${avslutade.map(r => remissKort(r, { visaPatient: true, markerad: String(r.id) === markerad })).join('')}</section>` : ''}`;
    if (markerad) el.querySelector(`#remiss-${CSS.escape(markerad)}`)?.scrollIntoView({ block: 'center' });
  };
  kopplaAtgarder(el, (id) => lista.find(r => String(r.id) === String(id)), () => rita().catch(felNotis));
  await rita();
}
