// Sök patient i hela regionen på namn eller identitet. Sökningen loggas. Systemet avgör självt om frågan är ett namn
// eller ett nummer (personnummer, samordningsnummer, reservnummer eller OID), och hittar också tidigare identiteter.
import { esc, api, vyRubrik, tom, faltFel, ikon } from '../ui.js';
import { arLogggranskare, far } from '../app.js';
import { patientCell, pnrCell, alderKon } from './arbetslista.js';
import { registreringHtml, kopplaRegistrering } from './patient-identitet.js';

export const namn = 'sok';

export async function visa(main, _p, q) {
  const fraga = q.get('q') ?? '';
  main.innerHTML = vyRubrik('Sök patient', arLogggranskare()
    ? 'Sök fram en patient för att se patientens logglista.'
    : 'Sök på namn, personnummer, samordningsnummer eller reservnummer i hela regionen. Att patienten hittas betyder inte att du får öppna journalen.') + `
    <form class="sokform" id="sokform" role="search">
      <div class="falt"><label for="sokfalt">Namn eller personnummer</label>
        <div class="sokrad"><input id="sokfalt" name="q" type="search" value="${esc(fraga)}" autocomplete="off" minlength="2" required aria-describedby="sok-hjalp" data-fokus><button class="knapp" type="submit">Sök</button></div>
        <span class="hjalp" id="sok-hjalp">Minst två tecken. Varje sökning loggas. En patient med skyddad identitet hittas bara på fullständigt personnummer, till exempel 19840416-2383.</span>
      </div>
      <p class="form-fel" role="alert" hidden></p>
    </form>
    ${far('registrera_patient') ? `<div class="knapprad"><button type="button" class="knapp sekundar" data-ny-patient>${ikon.plus}<span>Registrera ny patient</span></button></div>${registreringHtml()}` : ''}
    <div id="traffar" aria-live="polite"></div>`;
  kopplaRegistrering(main);
  const form = main.querySelector('#sokform');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.q.value.trim();
    const ny = `#/sok?q=${encodeURIComponent(v)}`;
    if (location.hash === ny) sok(main, v); else location.hash = ny;
  });
  if (fraga) await sok(main, fraga);
}

async function sok(main, fraga) {
  const form = main.querySelector('#sokform');
  const ut = main.querySelector('#traffar');
  let rader;
  try {
    rader = await api(`/api/sok?q=${encodeURIComponent(fraga)}`);
    faltFel(form, null);
  } catch (e) {
    if (e.status === 400) { faltFel(form, e, { q: 'q' }); ut.innerHTML = ''; return; }
    throw e;
  }
  if (!rader.length) { ut.innerHTML = tom(`Ingen patient hittades på "${fraga}".`); return; }
  const lg = arLogggranskare();
  ut.innerHTML = `<h2 class="sr">Träffar</h2><p class="antal-text">${rader.length === 1 ? 'En träff' : `${rader.length} träffar`}</p>
    <div class="tabellrulle"><table class="tabell">
      <thead><tr><th scope="col">Patient</th><th scope="col">Identitet</th><th scope="col">Ålder och kön</th>${lg ? '' : '<th scope="col">Vårdrelation på din enhet</th>'}</tr></thead>
      <tbody>${rader.map(p => `<tr>
        <td>${patientCell(p, lg ? `#/logg/patient/${encodeURIComponent(p.id)}` : `#/patient/${encodeURIComponent(p.id)}`)}</td>
        <td>${pnrCell(p)}${p.identitetstyp && p.identitetstyp !== 'personnummer' ? `<span class="under-text">${esc(p.typText)}</span>` : ''}${p.traffPa ? `<span class="under-text">Hittad på ${esc(p.traffPa.status === 'tidigare' ? 'tidigare' : 'extra')} identitet, ${esc(p.traffPa.typText.toLowerCase())}</span>` : ''}</td><td>${alderKon(p)}</td>
        ${lg ? '' : `<td>${p.vardrelation ? 'Ja' : '<span class="dampad">Nej, journalen kräver en grund</span>'}</td>`}
      </tr>`).join('')}</tbody>
    </table></div>`;
}
