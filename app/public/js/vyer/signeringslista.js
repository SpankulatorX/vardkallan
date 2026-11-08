// Runda 9, r7: vårdenhetens osignerade poster per författare (Sussa 3.1.11.2), för verksamhetschefen och läkarna. Inga
// patientuppgifter: bara vem, hur många, vilka typer och hur gammalt det äldsta utkastet är.
import { esc, api, vyRubrik, tom } from '../ui.js';

export const namn = 'signeringslista';

export async function visa(main) {
  main.innerHTML = vyRubrik('Signeringslista', 'Osignerade anteckningar på vårdenheten per författare. Utkasten syns bara för den som skrev dem.') + '<div id="sl"><p class="tom">Hämtar.</p></div>';
  const l = await api('/api/signeringslista');
  main.querySelector('#sl').innerHTML = l.forfattare.length ? `<p>${esc(l.vardenhet)}</p><div class="tabellrulle"><table class="tabell">
    <thead><tr><th scope="col">Författare</th><th scope="col" class="tal">Osignerade</th><th scope="col">Typer</th><th scope="col" class="tal">Äldsta, dagar</th></tr></thead>
    <tbody>${l.forfattare.map(f => `<tr><th scope="row">${esc(f.namn)}<span class="under-text">${esc(f.titel ?? '')}</span></th><td class="tal">${f.antal}</td><td>${esc(Object.entries(f.typer).map(([t, n]) => `${t} ${n}`).join(', '))}</td><td class="tal">${f.aldstaDagar}</td></tr>`).join('')}</tbody></table></div>
    <p class="under-text">${esc(l.anmarkning)}</p>` : tom('Inga osignerade anteckningar på vårdenheten.');
}
