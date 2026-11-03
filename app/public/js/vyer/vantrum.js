// Väntrummet på akuten. Uppropning sker alltid med könummer, aldrig med namn.
import { esc, api, klockslag, ikon, vyRubrik, tom, PRIORITET_VANTRUM } from '../ui.js';
import { S } from '../app.js';
import { listCell } from '../uppmarksamhet.js';

export const namn = 'vantrum';

export async function visa(main) {
  main.innerHTML = vyRubrik('Väntrum på akuten', 'Akutmottagningen USÖ. Patienterna ropas upp med könummer.') + '<div id="vr"><p class="tom">Hämtar väntrummet.</p></div>';
  const rader = await api('/api/vantrum');
  const akut = rader.some(r => 'patientId' in r) || S.session.enhet.vardenhet?.id === 'uso-akut';
  const ordning = { rod: 0, orange: 1, gul: 2, gron: 3, bla: 4 };
  const sorterade = [...rader].sort((a, b) => (ordning[a.prioritet] ?? 9) - (ordning[b.prioritet] ?? 9) || a.ankomst.localeCompare(b.ankomst));
  main.querySelector('#vr').innerHTML = `<div class="vantrum-delad">
    <div>
      ${rader.length ? `<div class="tabellrulle"><table class="tabell vantrum-tabell">
        <caption class="sr">Väntande patienter, högst prioritet först</caption>
        <thead><tr><th scope="col">Könummer</th><th scope="col">Prioritet</th><th scope="col">Ankomst</th><th scope="col">Väntat</th><th scope="col">Uppropning</th>${akut ? '<th scope="col"><span class="sr">Uppmärksamhetsinformation</span><span aria-hidden="true" title="Uppmärksamhetsinformation">Upm.</span></th><th scope="col">Patient</th><th scope="col">Orsak</th>' : ''}</tr></thead>
        <tbody>${sorterade.map(r => `<tr>
          <th scope="row" class="konummer">${esc(r.konummer)}</th>
          <td><span class="triage triage-${esc(r.prioritet)}"><span class="triage-ruta" aria-hidden="true"></span>${esc(PRIORITET_VANTRUM[r.prioritet] ?? r.prioritet)}</span></td>
          <td>${esc(klockslag(r.ankomst))}</td>
          <td>${esc(r.vantetidMin)} min</td>
          <td><span class="uppropning">"${esc(r.uppropning)}"</span></td>
          ${akut ? `<td class="um-cell">${r.uppmarksamhet ? listCell(r.uppmarksamhet, `#/patient/${encodeURIComponent(r.patientId)}`) : ''}</td><td>${r.skyddad ? `<span class="skyddad-namn">${ikon.skold}<span>Namn visas inte, skyddad identitet</span></span>` : `<a href="#/patient/${encodeURIComponent(r.patientId)}">${esc(r.namn)}</a>`}</td><td>${esc(r.orsak ?? '')}</td>` : ''}
        </tr>`).join('')}</tbody></table></div>` : tom('Ingen väntar just nu.')}
      ${akut ? '' : '<p class="dampad liten">Du arbetar inte på akutmottagningen och ser därför bara könummer, ankomst och prioritet.</p>'}
    </div>
    <aside class="ruta ruta-forklaring" aria-labelledby="vr-varfor">
      <h2 id="vr-varfor">Varför bara könummer</h2>
      <p>När Region Örebro län gick över till ett nytt journalsystem hösten 2024 röjdes fem personer med skyddade personuppgifter mellan september och november, bland annat genom att de ropades upp med sitt riktiga namn i väntrummet. Det visade SVT Örebro i januari 2025.</p>
      <p>I Vårdkällan kan det inte hända genom uppropningen: väntrumsvyn och uppropningen har bara könummer för alla patienter. Namnet på en patient med skyddad identitet skickas aldrig från servern till väntrummet, inte ens till akutens personal.</p>
    </aside>
  </div>`;
}
