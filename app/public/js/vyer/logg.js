// Logguppföljning för logggranskaren: filter, datum, loggkedjans status och logglistan per patient.
import { esc, api, tidpunkt, ikon, vyRubrik, tom, GRUND, HANDLING, YRKE, idag, plusDagar } from '../ui.js';

export const namn = 'logg';

const FLAGGOR = [['alla', 'Alla'], ['vard', 'Vårdens åtkomster'], ['nodatkomst', 'Nödåtkomst'], ['nekad', 'Nekade försök'], ['samtycke', 'Samtycke till spärrade uppgifter']];

export function kedjaRuta(hel, v) {
  return hel
    ? `<div class="kedja-status kedja-hel" role="status">${ikon.bock}<div><strong>Loggkedjan är hel.</strong><span>${v?.antal != null ? `Alla ${esc(v.antal)} rader är kontrollerade` : 'Varje rad är kontrollerad'} mot föregående rads hash. Ingen rad har ändrats eller tagits bort.</span></div></div>`
    : `<div class="kedja-status kedja-bruten" role="alert">${ikon.varning}<div><strong>Loggkedjan är bruten${v?.felRad ? ` vid rad ${esc(v.felRad)}` : ''}.</strong><span>${esc(v?.orsak ?? 'En rad stämmer inte med kedjan.')} Kontakta informationssäkerhet.</span></div></div>`;
}

const patientCell = (r, lank = true) => {
  if (!r.patient) return '<span class="dampad">Ingen patient</span>';
  const n = r.patient.skyddad ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span>` : esc(r.patient.namn);
  return `${lank ? `<a href="#/logg/patient/${encodeURIComponent(r.patient.id)}">${n}</a>` : n}<span class="under-text pnr">${esc(r.patient.personnummer)}</span>`;
};

// Förklaring under handlingen: söksträngen, och om raden gäller läskopian för avbrott (D4).
function resursText(r) {
  if (r.resurs && r.handling === 'sok') return `<span class="under-text">${esc(r.resurs.replace(/^sok:/, 'Sökte på '))}</span>`;
  if (r.resurs === 'lasekopia') return '<span class="under-text">Lämnades ut till läskopian för avbrott</span>';
  if (r.resurs === 'lasekopia:slut') return '<span class="under-text">Senaste utlämnandet till läskopian för avbrott</span>';
  if (r.resurs?.startsWith('laslage:')) return '<span class="under-text">Läst i läsläget under ett avbrott</span>';
  if (r.resurs?.startsWith('fhir/') && r.invanare) return '<span class="under-text">Via det öppna API:t</span>';
  return '';
}

// En rad från Min journal har invånaren i stället för personal. Patientens egen läsning visas utan namn.
const INVANARE = { egen: 'Patienten själv', vardnadshavare: 'Vårdnadshavare', annan: 'Invånare' };
function vemCell(r) {
  if (r.invanare) return `${esc(r.invanare.namn ?? INVANARE[r.invanare.relation] ?? 'Invånare')}<span class="under-text">${esc(r.invanare.namn ? INVANARE[r.invanare.relation] ?? 'Invånare' : 'Invånare')}, e-legitimation</span>`;
  return `${esc(r.personal?.namn ?? '')}<span class="under-text">${esc(YRKE[r.personal?.yrke] ?? '')}</span>`;
}

export function loggTabell(rader, { visaPatient = true } = {}) {
  if (!rader.length) return tom('Inga loggrader matchar urvalet.');
  return `<div class="tabellrulle"><table class="tabell logg-tabell">
    <thead><tr><th scope="col">Tid</th><th scope="col">Vem</th><th scope="col">Enhet</th>${visaPatient ? '<th scope="col">Patient</th>' : ''}<th scope="col">Handling</th><th scope="col">Grund</th><th scope="col">Syfte</th><th scope="col">Resultat</th></tr></thead>
    <tbody>${rader.map(r => `<tr class="${r.flaggad ? 'flaggad' : ''}${r.resultat === 'nekad' ? ' nekad' : ''}">
      <td>${esc(tidpunkt(r.tid))}</td>
      <td>${vemCell(r)}</td>
      <td>${r.invanare ? '<span class="dampad">Min journal</span>' : esc(r.enhet?.namn ?? '')}</td>
      ${visaPatient ? `<td>${patientCell(r)}</td>` : ''}
      <td>${esc(HANDLING[r.handling] ?? r.handling)}${resursText(r)}</td>
      <td><span class="grund grund-${esc(r.grund)}">${esc(GRUND[r.grund] ?? r.grund)}</span></td>
      <td>${esc(r.syfte ?? '')}</td>
      <td>${r.resultat === 'nekad' ? `<span class="resultat-nekad">${ikon.las}Nekad</span>` : 'Tillåten'}${r.flaggad ? '<span class="sr">, flaggad för uppföljning</span>' : ''}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

export async function visa(main, _p, q) {
  const flagga = FLAGGOR.some(f => f[0] === q.get('flagga')) ? q.get('flagga') : 'alla';
  const fran = q.get('fran') ?? plusDagar(idag(), -7);
  const till = q.get('till') ?? idag();
  main.innerHTML = vyRubrik('Logguppföljning', 'Varje åtkomst till varje journal. Nödåtkomst, nekade försök och samtycken flaggas för uppföljning.') + `
    <form class="loggfilter" id="loggfilter">
      <fieldset class="segment"><legend>Visa</legend>${FLAGGOR.map(([k, t]) => `<input type="radio" id="fl-${k}" name="flagga" value="${k}"${k === flagga ? ' checked' : ''}><label for="fl-${k}">${esc(t)}</label>`).join('')}</fieldset>
      <div class="falt kompakt"><label for="lf-fran">Från</label><input id="lf-fran" name="fran" type="date" value="${esc(fran)}"></div>
      <div class="falt kompakt"><label for="lf-till">Till</label><input id="lf-till" name="till" type="date" value="${esc(till)}"></div>
      <button type="submit" class="knapp">Visa loggen</button>
    </form>
    <div id="loggresultat"><p class="tom">Hämtar loggen.</p></div>`;
  const form = main.querySelector('#loggfilter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams({ flagga: form.flagga.value, fran: form.fran.value, till: form.till.value });
    location.hash = `#/logg?${p}`;
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'flagga') form.requestSubmit(); });
  const d = await api(`/api/logg?${new URLSearchParams({ flagga, ...(fran ? { fran } : {}), ...(till ? { till } : {}) })}`);
  const flaggade = d.rader.filter(r => r.flaggad).length;
  main.querySelector('#loggresultat').innerHTML = `${kedjaRuta(d.kedjaHel, d.verifiering)}
    <p class="antal-text">${d.rader.length === 1 ? 'En rad' : `${d.rader.length} rader`}${flagga === 'alla' && flaggade ? `, varav ${flaggade} flaggade för uppföljning` : ''}. Nyast först, högst 500.</p>
    ${loggTabell(d.rader)}`;
}

// Logglistan för en patient: underlag för patientens rätt till logginformation.
export const patient = {
  namn: 'loggpatient',
  async visa(main, [id]) {
    main.innerHTML = vyRubrik('Logglista för patient') + '<div id="lp"><p class="tom">Hämtar logglistan.</p></div>';
    const d = await api(`/api/patient/${encodeURIComponent(id)}/logglista`);
    const p = d.patient;
    main.querySelector('h1').textContent = p.skyddad ? 'Logglista, skyddad identitet' : `Logglista för ${p.namn}`;
    main.querySelector('#lp').innerHTML = `<p class="ingress">Personnummer <span class="pnr">${esc(p.personnummer)}</span>. Patienten har rätt att få veta vem som har tagit del av journalen (patientdatalagen 8 kap. 5 §). Listan visar alla åtkomster, även nekade försök.</p>
      ${kedjaRuta(d.kedjaHel)}
      ${loggTabell(d.rader, { visaPatient: false })}
      <p><a href="#/logg">Tillbaka till logguppföljningen</a></p>`;
  },
};
