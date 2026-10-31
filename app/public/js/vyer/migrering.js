// Migreringsavstämning: per datatyp och källa antal i källan, överförda och verifierade, och öppna avvikelser.
import { esc, api, ikon, vyRubrik, tom } from '../ui.js';
import { arLogggranskare } from '../app.js';

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
    <p class="ruta ruta-info liten">Avstämningen räknas på demons migrerade poster. Någon riktig migrering från VAS eller Cosmic görs inte.</p>
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
}
