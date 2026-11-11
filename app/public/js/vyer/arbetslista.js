// Arbetslistan: patienter med vårdrelation på min vårdenhet.
import { esc, api, ikon, vyRubrik, tom, VARDFORM } from '../ui.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { S, far } from '../app.js';
import { listCell } from '../uppmarksamhet.js';

export const namn = 'arbetslista';

const KON = { kvinna: 'Kvinna', man: 'Man' };

// Namncell som aldrig visar namnet på en skyddad patient.
export function patientCell(p, href) {
  const namn = p.skyddad
    ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span>`
    : esc(p.namn);
  return href ? `<a class="patientlank" href="${href}">${namn}</a>` : namn;
}
export const pnrCell = (p) => `<span class="pnr">${esc(p.personnummer)}</span>`;
// Runda 13, r4: ett reservnummer eller en annan identitet än personnummer syns som det den är, och en trolig dubblett
// som också står i listan markeras.
const idMarke = (p) => `${p.idTyp && p.idTyp !== 'personnummer' ? `<span class="under-text">${esc(p.idTypText)}</span>` : ''}${p.mojligDubblett ? '<span class="tagg tagg-obs">Möjlig dubblett</span>' : ''}`;
export const alderKon = (p) => `${esc(p.alder)} år, ${esc((KON[p.kon] ?? p.kon).toLowerCase())}`;

export async function visa(main) {
  // Runda 6, r4: läkare och sjuksköterskor når sitt schema i tidboken härifrån, utan att boka.
  // Runda 8, r3: avdelningens planerade händelser för den som arbetar på en avdelning.
  const planering = far('las_planering') ? `<li><a class="knapp liten sekundar" href="#/avdelning">${ikon.kalender}<span>Avdelningens planering</span></a></li>` : '';
  const tidbok = far('las_tidbok') && !far('boka') ? `<nav class="snabbval" aria-label="Tidboken"><ul><li><a class="knapp liten sekundar" href="#/tidbok">${ikon.klocka}<span>Min tidbok</span></a></li>${planering}</ul></nav>`
    : planering ? `<nav class="snabbval" aria-label="Planering"><ul>${planering}</ul></nav>` : '';
  main.innerHTML = vyRubrik('Arbetslista', `Patienter med vårdrelation på ${esc(S.session.enhet.vardenhet?.namn ?? S.session.enhet.namn)}.`) + `${hjalpRuta('oppna-patient')}${tidbok}<div id="lista"><p class="tom">Hämtar arbetslistan.</p></div>`;
  const rader = await api('/api/arbetslista');
  const el = main.querySelector('#lista');
  if (!rader.length) { el.innerHTML = tom('Det finns inga patienter med vårdrelation på din enhet just nu.'); return; }
  // Runda 13, r4: öppenvården delas i dagens besök och kontakter som har pågått sedan tidigare.
  const grupper = [
    ['slutenvard', 'Inskrivna'], ['akut', 'På akuten'], ['oppenvard', 'Öppenvård i dag'], ['oppenvard-pagaende', 'Pågående kontakter i öppenvården'],
    [null, 'Remisser, listade och nyligen avslutade'],
  ];
  const grupp = (r) => (r.vardform === 'oppenvard' && r.idag === false ? 'oppenvard-pagaende' : r.vardform);
  el.innerHTML = grupper.map(([vf, rubrik]) => {
    const g = rader.filter(r => (vf ? grupp(r) === vf : !['slutenvard', 'akut', 'oppenvard'].includes(r.vardform)));
    if (!g.length) return '';
    return `<section class="tabellsektion" aria-labelledby="g-${vf ?? 'ovr'}">
      <h2 id="g-${vf ?? 'ovr'}">${esc(rubrik)} <span class="antal">${g.length}</span></h2>
      <div class="tabellrulle"><table class="tabell">
        <thead><tr><th scope="col"><span class="sr">Uppmärksamhetsinformation</span><span aria-hidden="true" title="Uppmärksamhetsinformation">Upm.</span></th><th scope="col">Patient</th><th scope="col">Personnummer</th><th scope="col">Ålder och kön</th><th scope="col">Plats</th><th scope="col">Kontaktorsak</th><th scope="col"><span class="sr">Larm</span><span aria-hidden="true">Larm</span></th></tr></thead>
        <tbody>${g.map(p => `<tr${p.skyddad ? ' class="rad-skyddad"' : ''}>
          <td class="um-cell">${p.uppmarksamhet ? listCell(p.uppmarksamhet, `#/patient/${encodeURIComponent(p.id)}`) : ''}</td>
          <td>${patientCell(p, `#/patient/${encodeURIComponent(p.id)}`)}</td>
          <td>${pnrCell(p)}${idMarke(p)}</td>
          <td>${alderKon(p)}</td>
          <td>${esc(p.plats)}${p.vardform ? `<span class="under-text">${esc(VARDFORM[p.vardform])}</span>` : ''}</td>
          <td>${esc(p.orsak ?? '')}</td>
          <td>${p.larm ? `<span class="larmmarke" title="${p.larm} larm i inkorgen">${ikon.larm}<span>${p.larm}</span><span class="sr"> larm</span></span>` : '<span class="sr">Inga larm</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }).join('');
}
