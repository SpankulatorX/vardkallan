// Migreringsavstämning: per datatyp och källa antal i källan, överförda och verifierade, och öppna avvikelser.
import { esc, api, ikon, vyRubrik, tom, notis, medKnapp, tidpunkt, dialog } from '../ui.js';
import { arLogggranskare, far } from '../app.js';

export const namn = 'migrering';

const DATATYP = { anteckningar: 'Journalanteckningar', diagnoser: 'Diagnoser', matvarden: 'Mätvärden', ordinationer: 'Läkemedelsordinationer', overkanslighet: 'Överkänslighet', vardkontakter: 'Vårdkontakter', remisser: 'Remisser' };
const KALLA = (k) => (k?.startsWith('migrerad:') ? k.slice(9) : k);
const STATUS = { oppen: 'Öppen', atgardad: 'Åtgärdad', stangd: 'Stängd' };

export async function visa(main) {
  main.innerHTML = vyRubrik('Migreringsavstämning', 'Historik från de tidigare journalsystemen VAS och Cosmic ska finnas kvar, vara verifierad och synas i samma kronologi som ny dokumentation.') + '<div id="mig"><p class="tom">Hämtar avstämningen.</p></div>';
  const d = await api('/api/migrering');
  const rader = d.datatyper;
  const s = d.summa;
  main.querySelector('#mig').innerHTML = `
    <p class="ruta ruta-info liten">Demons migrerade historik från VAS och Cosmic är påhittad. Systemförvaltningen kan läsa in ett simulerat uttag ur ett annat journalsystem som en FHIR Bundle, och avstämningen räknas då med.</p>
    ${far('konfigurera') ? '<div id="mig-inlasning"></div>' : ''}
    <div class="tabellrulle"><table class="tabell siffertabell">
      <caption class="sr">Antal poster per datatyp och källa</caption>
      <thead><tr><th scope="col">Datatyp</th><th scope="col">Källa</th><th scope="col" class="tal">I källan</th><th scope="col" class="tal">Överförda</th><th scope="col" class="tal">Verifierade</th><th scope="col">Avstämning</th></tr></thead>
      <tbody>${rader.map(r => `<tr${r.avvikelse ? ' class="avvikande"' : ''}><th scope="row">${esc(DATATYP[r.datatyp] ?? r.datatyp)}</th><td>${esc(KALLA(r.kalla))}</td>
        <td class="tal">${r.antalKalla}</td><td class="tal">${r.antalOverforda}</td><td class="tal">${r.antalVerifierade}</td>
        <td>${r.avvikelse ? `<span class="avst avst-fel">${ikon.varning}Avvikelse, ${r.antalKalla - r.antalOverforda} saknas</span>` : `<span class="avst avst-ok">${ikon.bock}Stämmer</span>`}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row" colspan="2">Summa</th><td class="tal">${s.antalKalla}</td><td class="tal">${s.antalOverforda}</td><td class="tal">${s.antalVerifierade}</td><td></td></tr></tfoot>
    </table></div>
    <section aria-labelledby="mig-avv"><h2 id="mig-avv">Avvikelser <span class="antal${d.avvikelser.some(a => a.status === 'oppen') ? ' antal-aktiv' : ''}">${d.avvikelser.length}</span></h2>
      ${d.avvikelser.length ? `<ul class="avvikelselista">${d.avvikelser.map(a => `<li class="avvikelse">
        <p class="avv-rubrik"><span class="tagg${a.status === 'oppen' ? ' tagg-larm' : ''}">${esc(STATUS[a.status] ?? a.status)}</span><strong>${esc(DATATYP[a.datatyp] ?? a.datatyp)} från ${esc(KALLA(a.kalla))}</strong>${a.patientId && !arLogggranskare() ? `<a href="#/patient/${encodeURIComponent(a.patientId)}">Öppna patientens journal</a>` : ''}</p>
        <p>${esc(a.beskrivning)}</p><p><strong>Åtgärd:</strong> ${esc(a.atgard)}</p></li>`).join('')}</ul>` : tom('Inga avvikelser.')}
    </section>`;
  // Runda 9, r4: systemförvaltningen läser in en migreringsfil (migreringsimport.js).
  if (far('konfigurera')) inlasning(main);
}

const TYP = { vardkontakter: 'Vårdkontakter', diagnoser: 'Diagnoser', matvarden: 'Mätvärden', anteckningar: 'Journalanteckningar' };
const typText = (t) => TYP[t] ?? t;

// En framlagd fil: vad som förs över, avvikelserna och vem som lade fram den. Fyra ögon: en annan systemförvaltare godkänner.
function vantandeRad(f) {
  return `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">Uttag ur ${esc(f.kalla)}</span>
      <span class="under-text">${(f.perTyp ?? []).map(t => `${t.kanForasOver} ${esc(typText(t.datatyp).toLowerCase())}`).join(', ')} förs över, och ${f.antalAvvikelser} poster blir avvikelser. Framlagd av ${esc(f.foreslagenAv)} ${esc(tidpunkt(f.foreslagen))}.</span></div>
    <div class="ik-knappar">${f.kanGodkanna ? `<button type="button" class="knapp liten" data-mig-godkann="${f.id}">Godkänn och läs in</button><button type="button" class="knapp liten sekundar" data-mig-avsla="${f.id}">Avslå</button>` : ''}${f.egen ? `<button type="button" class="knapp liten sekundar" data-mig-aterkalla="${f.id}">Återkalla</button>` : ''}</div></li>`;
}

async function inlasning(main) {
  const el = main.querySelector('#mig-inlasning');
  if (!el) return;
  const { filer } = await api('/api/migrering/filer');
  const vantar = filer.filter(f => f.status === 'vantar');
  const inlasta = filer.filter(f => f.status === 'inlast');
  const filRad = (f) => `<li>${esc(f.kalla)}, ${esc(tidpunkt(f.tid))}: ${(f.perTyp ?? []).map(t => `${t.overforda} ${esc(typText(t.datatyp).toLowerCase())}`).join(', ')}, ${f.avvikelser} avvikelser. Framlagd av ${esc(f.foreslagenAv)} och godkänd av ${esc(f.beslutadAv)}.</li>`;
  el.innerHTML = `<section class="lm-sektion" aria-labelledby="mig-las"><h2 id="mig-las">Läs in en migreringsfil</h2>
    <p class="liten">Ett uttag ur källsystemet som FHIR Bundle av typen collection, med vårdkontakter, diagnoser, mätvärden och anteckningar. Systemet visar först vad som förs över och vad som blir avvikelser, och filen skrivs i journalerna när en annan systemförvaltare har godkänt den.</p>
    <p class="liten"><a href="/exempel/uttag-vas.json" download>Hämta ett exempeluttag ur VAS</a> (simulerat, med en post som blir en avvikelse och poster som saknas i filen).</p>
    <div class="falt"><label for="mig-fil">Migreringsfil (JSON)</label><input id="mig-fil" type="file" accept=".json,application/json,application/fhir+json"></div>
    <div id="mig-forhand" aria-live="polite"></div>
    <h3 id="mig-vantar">Väntar på godkännande <span class="antal${vantar.some(f => f.kanGodkanna) ? ' antal-aktiv' : ''}">${vantar.length}</span></h3>
    ${vantar.length ? `<ul class="inkorg-lista">${vantar.map(vantandeRad).join('')}</ul>` : '<p class="tom liten">Inga filer väntar på godkännande.</p>'}
    ${inlasta.length ? `<h3 id="mig-inlasta">Inlästa filer</h3><ul>${inlasta.map(filRad).join('')}</ul>` : ''}</section>`;
  let fil = null;
  const ruta = el.querySelector('#mig-forhand');
  const rita = (p) => `<div class="ruta ruta-info liten"><p><strong>Från ${esc(p.kalla)}</strong>${p.redanInlast ? `. Filen lästes redan in ${esc(tidpunkt(p.redanInlast))}.` : p.vantar ? '. Filen väntar redan på godkännande.' : ''}</p>
      <ul>${p.perTyp.map(t => `<li>${esc(typText(t.datatyp))}: ${t.kanForasOver} av ${t.iKallan} förs över${t.saknasIFilen ? `, ${t.saknasIFilen} saknas i filen` : ''}.</li>`).join('')}</ul>
      ${p.antalAvvikelser ? `<p>${p.antalAvvikelser} poster blir avvikelser:</p><ul>${p.avvikelser.map(a => `<li>Post ${a.post}: ${esc(a.orsak)}</li>`).join('')}</ul>` : ''}</div>
    ${p.redanInlast || p.vantar ? '' : '<div class="knapprad"><button type="button" class="knapp" id="mig-lagg-fram">Skicka för godkännande</button></div>'}`;
  el.querySelector('#mig-fil').addEventListener('change', async (e) => {
    fil = null;
    ruta.innerHTML = '';
    const f = e.target.files?.[0];
    if (!f) return;
    try { fil = JSON.parse(await f.text()); } catch { ruta.innerHTML = '<p class="ruta ruta-larm liten" role="status">Filen är inte JSON. Ett uttag behöver vara en FHIR Bundle i JSON.</p>'; return; }
    try { ruta.innerHTML = rita(await api('/api/migrering/forhandsvisa', { metod: 'POST', data: { fil }, tyst: true })); } catch (x) { ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(x.message)}</p>`; }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('#mig-lagg-fram');
    const g = e.target.closest('[data-mig-godkann]');
    const a = e.target.closest('[data-mig-avsla]');
    const r = e.target.closest('[data-mig-aterkalla]');
    try {
      if (b && fil) { await medKnapp(b, () => api('/api/migrering/filer', { metod: 'POST', data: { fil } })); notis('Filen väntar på att en annan systemförvaltare godkänner den. Inget är skrivet i journalerna ännu.'); }
      else if (g) {
        const x = await medKnapp(g, () => api(`/api/migrering/filer/${g.dataset.migGodkann}/godkann`, { metod: 'POST', data: {} }));
        notis(`Filen är inläst: ${x.perTyp.reduce((s, t) => s + t.overforda, 0)} poster förda över och ${x.avvikelser} avvikelser.`);
      } else if (r) { await medKnapp(r, () => api(`/api/migrering/filer/${r.dataset.migAterkalla}/avsluta`, { metod: 'POST', data: {} })); notis('Filen är återkallad.'); }
      else if (a) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Avslå filen</h2>
          <div class="falt"><label for="mig-kommentar">Varför avslås den? <span class="obl">(obligatoriskt)</span></label><textarea id="mig-kommentar" name="kommentar" rows="3" required maxlength="500"></textarea></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avslå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        await medKnapp(a, () => api(`/api/migrering/filer/${a.dataset.migAvsla}/avsluta`, { metod: 'POST', data: { kommentar: svar.data.kommentar } }));
        notis('Filen är avslagen.');
      } else return;
    } catch { return; }
    visa(main);
  });
}

