// Sök patient i hela regionen på namn eller identitet. Sökningen loggas. Systemet avgör självt om frågan är ett namn
// eller ett nummer (personnummer, samordningsnummer, reservnummer eller OID), och hittar också tidigare identiteter.
import { esc, api, vyRubrik, tom, faltFel, ikon } from '../ui.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { arLogggranskare, far } from '../app.js';
import { patientCell, pnrCell, alderKon } from './arbetslista.js';
import { registreringHtml, kopplaRegistrering } from './patient-identitet.js';
// Runda 6, r1: uppmärksamhetssymbolen i träffarna (Sussa 3.1.5.2), med samma regler som i patienthuvudet.
import { listCell } from '../uppmarksamhet.js';

export const namn = 'sok';

export async function visa(main, _p, q) {
  const fraga = q.get('q') ?? '';
  main.innerHTML = vyRubrik('Sök patient', arLogggranskare()
    ? 'Sök fram en patient för att se patientens logglista.'
    : 'Sök på namn, personnummer, samordningsnummer eller reservnummer i hela regionen. Att patienten hittas betyder inte att du får öppna journalen.') + `${arLogggranskare() ? '' : hjalpRuta('sok')}
    <form class="sokform" id="sokform" role="search">
      <div class="falt"><label for="sokfalt">Namn eller personnummer</label>
        <div class="sokrad"><input id="sokfalt" name="q" type="search" value="${esc(fraga)}" autocomplete="off" minlength="2" required aria-describedby="sok-hjalp" data-fokus><button class="knapp" type="submit">Sök</button></div>
        <span class="hjalp" id="sok-hjalp">Minst två tecken. Varje sökning loggas. En patient med skyddad identitet hittas bara på fullständigt personnummer, till exempel 19840416-2383.</span>
      </div>
      <p class="form-fel" role="alert" hidden></p>
    </form>
    ${far('registrera_patient') ? `<div class="knapprad"><button type="button" class="knapp sekundar" data-ny-patient>${ikon.plus}<span>Registrera ny patient</span></button></div>${registreringHtml()}` : ''}
    <div id="traffar" aria-live="polite"></div>
    ${far('patientgrupp') || far('statistik_region') ? journalerHtml(q.get('j') ?? '') : ''}`;
  kopplaRegistrering(main);
  kopplaJournaler(main);
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
      <thead><tr><th scope="col" class="um-cell"><span class="sr">Uppmärksamhet</span></th><th scope="col">Patient</th><th scope="col">Identitet</th><th scope="col">Ålder och kön</th>${lg ? '' : '<th scope="col">Vårdrelation på din enhet</th>'}</tr></thead>
      <tbody>${rader.map(p => `<tr>
        <td class="um-cell">${p.uppmarksamhet ? listCell(p.uppmarksamhet, `#/patient/${encodeURIComponent(p.id)}`) : ''}</td>
        <td>${patientCell(p, lg ? `#/logg/patient/${encodeURIComponent(p.id)}` : `#/patient/${encodeURIComponent(p.id)}`)}</td>
        <td>${pnrCell(p)}${p.identitetstyp && p.identitetstyp !== 'personnummer' ? `<span class="under-text">${esc(p.typText)}</span>` : ''}${p.traffPa ? `<span class="under-text">Hittad på ${esc(p.traffPa.status === 'tidigare' ? 'tidigare' : 'extra')} identitet, ${esc(p.traffPa.typText.toLowerCase())}</span>` : ''}</td><td>${alderKon(p)}</td>
        ${lg ? '' : `<td>${p.vardrelation ? 'Ja' : '<span class="dampad">Nej, journalen kräver en grund</span>'}</td>`}
      </tr>`).join('')}</tbody>
    </table></div>`;
}

// Runda 10, r2: samma sökfält över flera patienter (Sussa 3.1.8.2). En diagnos, ett läkemedel eller en läkemedelsgrupp
// blir ett villkor, och svaret är vårdenhetens patienter som du har vårdrelation till, eller antal för hela
// vårdgivaren för uppföljningen. Varje patient i listan loggas.
function journalerHtml(j) {
  return `<section class="ov-sektion" aria-labelledby="jsok-pat-rubrik"><h2 id="jsok-pat-rubrik">Sök i journalerna</h2>
    <form class="sokform" id="journalerform" role="search" aria-label="Sök i journalerna">
      <div class="falt"><label for="journalerfalt">Diagnos eller läkemedel</label>
        <div class="sokrad"><input id="journalerfalt" name="j" type="search" value="${esc(j)}" autocomplete="off" minlength="2" maxlength="60" aria-describedby="journaler-hjalp"><button class="knapp sekundar" type="submit">Sök i journalerna</button></div>
        <span class="hjalp" id="journaler-hjalp">Till exempel I48, förmaksflimmer, Waran eller blodförtunnande. Systemet gör om orden till koder och söker bland patienterna på din vårdenhet.</span>
      </div>
      <p class="form-fel" role="alert" hidden></p>
    </form>
    <div id="journalertraffar" aria-live="polite"></div></section>`;
}
function kopplaJournaler(main) {
  const form = main.querySelector('#journalerform');
  if (!form) return;
  const ut = main.querySelector('#journalertraffar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let d;
    try { d = await api(`/api/sok/journaler?q=${encodeURIComponent(form.j.value.trim())}`); faltFel(form, null); } catch (err) {
      if (err.status === 400) { faltFel(form, err, { q: 'j' }); ut.innerHTML = ''; return; }
      throw err;
    }
    if (d.niva === 'region') {
      ut.innerHTML = `<p class="ingress liten">${esc(d.tolkning)}</p><ul class="enkel-lista">${d.perKod.map(c => `<li>${esc(c.text)}: <strong>${c.antal == null ? 'färre än 5' : esc(c.antal)}</strong></li>`).join('')}</ul><p class="hjalp">${esc(d.anmarkning)}</p>`;
      return;
    }
    ut.innerHTML = `<p class="ingress liten">${esc(d.tolkning)}</p><p class="antal-text">${d.antal === 1 ? 'En patient' : `${esc(d.antal)} patienter`} på ${esc(d.vardenhet ?? '')}.</p>
      ${d.patienter.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Patient</th><th scope="col">Identitet</th><th scope="col">Varför</th></tr></thead>
      <tbody>${d.patienter.map(p => `<tr><td><a href="#/patient/${encodeURIComponent(p.id)}">${esc(p.namn)}</a></td><td><span class="pnr">${esc(p.personnummer)}</span></td><td>${esc(p.skal)}</td></tr>`).join('')}</tbody></table></div>` : tom('Ingen patient på din vårdenhet matchar.')}
      <p class="hjalp">${esc(d.anmarkning)}</p>`;
  });
  if (form.j.value.trim().length >= 2) form.requestSubmit();
}
