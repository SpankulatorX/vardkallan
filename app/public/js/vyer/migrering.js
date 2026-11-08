// Migreringsavstämning: per datatyp och källa antal i källan, överförda och verifierade, och öppna avvikelser.
import { esc, api, ikon, vyRubrik, tom, notis, medKnapp, tidpunkt } from '../ui.js';
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

async function inlasning(main) {
  const el = main.querySelector('#mig-inlasning');
  if (!el) return;
  const { filer } = await api('/api/migrering/filer');
  const filRad = (f) => `<li>${esc(f.kalla)}, ${esc(tidpunkt(f.tid))}: ${(f.perTyp ?? []).map(t => `${t.overforda} ${esc(typText(t.datatyp).toLowerCase())}`).join(', ')}, ${f.avvikelser} avvikelser.</li>`;
  el.innerHTML = `<section class="lm-sektion" aria-labelledby="mig-las"><h2 id="mig-las">Läs in en migreringsfil</h2>
    <p class="liten">Ett uttag ur källsystemet som FHIR Bundle av typen collection, med vårdkontakter, diagnoser, mätvärden och anteckningar. Systemet visar först vad som förs över och vad som blir avvikelser.</p>
    <p class="liten"><a href="/exempel/uttag-vas.json" download>Hämta ett exempeluttag ur VAS</a> (simulerat, med en post som blir en avvikelse och poster som saknas i filen).</p>
    <div class="falt"><label for="mig-fil">Migreringsfil (JSON)</label><input id="mig-fil" type="file" accept=".json,application/json,application/fhir+json"></div>
    <div id="mig-forhand" aria-live="polite"></div>
    ${filer.length ? `<h3>Inlästa filer</h3><ul>${filer.map(filRad).join('')}</ul>` : ''}</section>`;
  let fil = null;
  const ruta = el.querySelector('#mig-forhand');
  const rita = (p) => `<div class="ruta ruta-info liten"><p><strong>Från ${esc(p.kalla)}</strong>${p.redanInlast ? `. Filen lästes redan in ${esc(tidpunkt(p.redanInlast))}.` : ''}</p>
      <ul>${p.perTyp.map(t => `<li>${esc(typText(t.datatyp))}: ${t.kanForasOver} av ${t.iKallan} förs över${t.saknasIFilen ? `, ${t.saknasIFilen} saknas i filen` : ''}.</li>`).join('')}</ul>
      ${p.antalAvvikelser ? `<p>${p.antalAvvikelser} poster blir avvikelser:</p><ul>${p.avvikelser.map(a => `<li>Post ${a.post}: ${esc(a.orsak)}</li>`).join('')}</ul>` : ''}</div>
    ${p.redanInlast ? '' : '<div class="knapprad"><button type="button" class="knapp" id="mig-las-in">Läs in</button></div>'}`;
  el.querySelector('#mig-fil').addEventListener('change', async (e) => {
    fil = null;
    ruta.innerHTML = '';
    const f = e.target.files?.[0];
    if (!f) return;
    try { fil = JSON.parse(await f.text()); } catch { ruta.innerHTML = '<p class="ruta ruta-larm liten" role="status">Filen är inte JSON. Ett uttag behöver vara en FHIR Bundle i JSON.</p>'; return; }
    try { ruta.innerHTML = rita(await api('/api/migrering/forhandsvisa', { metod: 'POST', data: { fil }, tyst: true })); } catch (x) { ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(x.message)}</p>`; }
  });
  ruta.addEventListener('click', async (e) => {
    const b = e.target.closest('#mig-las-in');
    if (!b || !fil) return;
    try {
      const r = await medKnapp(b, () => api('/api/migrering/las-in', { metod: 'POST', data: { fil } }));
      notis(`Filen är inläst: ${r.perTyp.reduce((s, t) => s + t.overforda, 0)} poster förda över och ${r.avvikelser} avvikelser.`);
    } catch { return; }
    visa(main);
  });
}
