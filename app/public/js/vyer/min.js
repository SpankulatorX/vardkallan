// Min journal: invånarens egen journal. Ramen, valet av journal (egen eller barnets) och flikarna. Delarna ritas i
// min-delar.js. Servern prövar i varje anrop att invånaren får läsa journalen och loggar läsningen.
import { esc, api, ikon, ApiFel, vyRubrik } from '../ui.js';
import { S } from '../app.js';
import * as delar from './min-delar.js';
import * as tider from './min-tider.js';
// Runda 7, r6: barnets tillväxt för vårdnadshavaren.
import * as tillvaxt from './min-tillvaxt.js';
// Runda 11, r3: graviditeten för kvinnan själv.
import * as minGraviditet from './min-graviditet.js';
// Runda 9, r2: patientens egna mätningar (mt-ui.js).
import { minEgna } from '../mt-ui.js';
// Runda 10, r7: meddelanden, vårdplaner och ombud (min-r10r7.js).
import * as r10r7 from './min-r10r7.js';

export const namn = 'min';

const FLIKAR = [
  ['oversikt', 'Översikt', delar.oversikt],
  ['tider', 'Tider', tider.visa],
  ['anteckningar', 'Anteckningar', delar.anteckningar],
  ['diagnoser', 'Diagnoser', delar.diagnoser],
  ['lakemedel', 'Läkemedel', delar.lakemedel],
  ['provsvar', 'Provsvar', delar.provsvar],
  // Runda 9, r2: egna mätningar som patienten lämnar till vården.
  ['egenmatning', 'Egna mätningar', minEgna],
  // Runda 7, r6: visas för barn och ungdomar. Villkoret får huvudet.
  ['tillvaxt', 'Tillväxt', tillvaxt.visa, (h) => !h || h.patient.alder < 18],
  // Runda 11, r3: graviditeten, när kvinnan själv har en som visas enligt visningsreglerna.
  ['graviditet', 'Graviditet', minGraviditet.visa, (h) => !h || Boolean(h.graviditet)],
  ['remisser', 'Remisser', delar.remisser],
  ['logglista', 'Vem har läst', delar.logglista],
  ['sparrar', 'Spärrar', delar.sparrar],
  // Runda 10, r7: meddelanden till vården, vårdplanen och ombud med fullmakt.
  ['meddelanden', 'Meddelanden', r10r7.meddelanden],
  ['vardplan', 'Vårdplan', r10r7.vardplan],
  ['ombud', 'Ombud', r10r7.ombud],
];
// Runda 10, r7: ett ombud ser bara tider, meddelanden och sin fullmakt, aldrig journalen.
const OMBUD_FLIKAR = ['tider', 'meddelanden', 'ombud'];
const synligFlik = (f, h) => (!f[3] || f[3](h)) && (h?.relation !== 'ombud' || OMBUD_FLIKAR.includes(f[0]));

let huvud = null;
const href = (pid, del, sub) => `#/min/${encodeURIComponent(pid)}${del && del !== 'oversikt' ? `/${del}` : ''}${sub ? `/${encodeURIComponent(sub)}` : ''}`;

// Utan journal i adressen: den egna journalen direkt, eller ett val när invånaren är vårdnadshavare.
function valAvJournal(main) {
  r10r7.kopplaForfragningar(main);
  const j = S.session?.journaler ?? [];
  const egen = j.find(x => x.relation === 'egen');
  const barn = j.filter(x => x.relation === 'vardnadshavare');
  main.innerHTML = vyRubrik('Min journal', 'Välj vems journal du vill läsa.') + `
    <ul class="min-journaler">
      ${egen ? `<li>${egen.atkomst ? `<a class="min-journalval" href="${href(egen.patientId)}">${ikon.person}<span><strong>Din journal</strong><span class="under-text">${esc(egen.namn)}, ${esc(egen.alder)} år</span></span></a>` : `<p>${esc(egen.skal)}</p>`}</li>` : ''}
      ${barn.map(b => `<li>${b.atkomst
        ? `<a class="min-journalval" href="${href(b.patientId)}">${ikon.person}<span><strong>${esc(b.namn)}</strong><span class="under-text">${esc(b.alder)} år. Du är vårdnadshavare.</span></span></a>`
        : `<div class="min-journalval min-journalval-stangd">${ikon.las}<span><strong>${esc(b.namn)}</strong><span class="under-text">${esc(b.skal ?? '')}</span></span></div>`}</li>`).join('')}
    </ul>
    ${r10r7.forfragningarHtml(S.session?.ombudForfragningar ?? [])}
    ${r10r7.ombudLista(S.session?.ombudFor ?? [], (pid) => href(pid, 'tider'))}
    ${egen ? '' : '<p class="dampad">Det finns ingen journal om dig själv i Vårdkällans demo.</p>'}`;
}

function bandHtml(h) {
  const vh = h.relation === 'vardnadshavare';
  return `<header class="min-band" aria-label="Journalen gäller">
    <div class="min-band-id">
      <h1 tabindex="-1">${esc(h.patient.namn)}</h1>
      <p class="band-fakta"><span class="pnr">${esc(h.patient.personnummer)}</span><span>${esc(h.patient.alder)} år</span><span>${esc(h.vardgivare ?? '')}</span></p>
    </div>
    <ul class="band-signaler" aria-label="Markeringar">
      ${vh ? `<li class="signal signal-vh">${ikon.person}<span>Du läser som vårdnadshavare</span></li>` : ''}
      ${h.relation === 'ombud' ? `<li class="signal signal-vh">${ikon.person}<span>Du är ombud med fullmakt</span></li>` : ''}
      ${h.patient.skyddad ? `<li class="signal signal-skydd">${ikon.skold}<span>Skyddade personuppgifter</span></li>` : ''}
      ${h.sparrar.length ? `<li class="signal signal-sparr">${ikon.las}<span>${h.sparrar.length === 1 ? 'En spärr' : `${h.sparrar.length} spärrar`} mot andra vårdenheter</span></li>` : ''}
    </ul>
  </header>`;
}

const flikarHtml = (pid, aktiv) => `<nav class="flikar min-flikar" aria-label="Journalens delar"><ul>${FLIKAR.filter(f => synligFlik(f, huvud)).map(([k, t]) =>
  `<li><a href="${href(pid, k)}"${k === aktiv ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>`;

export async function visa(main, [pid, del, sub], q, ctx = {}) {
  if (!pid) {
    const j = S.session?.journaler ?? [];
    // Bara den egna journalen: den visas direkt. En vårdnadshavare väljer, så att det syns vems journal det är.
    // Runda 10, r7: en förfrågan om att bli ombud visas på valet av journal, så då visas valet.
    if (j.length === 1 && j[0].atkomst && j[0].relation === 'egen' && !S.session?.ombudForfragningar?.length) {
      history.replaceState(null, '', href(j[0].patientId));
      main.dataset.vy = `min:${j[0].patientId}`;
      return visa(main, [j[0].patientId], q, ctx);
    }
    huvud = null;
    return valAvJournal(main);
  }
  let f = FLIKAR.find(x => x[0] === (del ?? 'oversikt')) ?? FLIKAR[0];
  if (!ctx.sammaPatient || !huvud || huvud.patient.id !== pid || !main.querySelector('.min-vy')) {
    main.innerHTML = '<p class="tom">Öppnar journalen.</p>';
    try { huvud = await api(`/api/min/journal/${encodeURIComponent(pid)}`); } catch (e) {
      if (e instanceof ApiFel && [403, 404].includes(e.status)) {
        huvud = null;
        main.innerHTML = `${vyRubrik(e.status === 403 ? 'Journalen kan inte visas' : 'Journalen finns inte')}<div class="ruta ruta-info"><p>${esc(e.message)}</p><p><a href="#/min">Tillbaka till Min journal</a></p></div>`;
        return;
      }
      throw e;
    }
    if (ctx.aktuell && !ctx.aktuell()) return;
    main.innerHTML = `<div class="min-vy">${bandHtml(huvud)}<div id="min-flikrad"></div><div class="min-del" id="min-del"></div></div>`;
  }
  // Runda 10, r7: ett ombud börjar på Tider, och en flik som ombudet inte ser visas inte.
  if (!synligFlik(f, huvud)) f = FLIKAR.find(x => x[0] === 'tider');
  // Den som bytte flik med tangentbordet behåller fokus på fliken när flikraden ritas om.
  const flikrad = main.querySelector('#min-flikrad');
  const hadeFokus = flikrad.contains(document.activeElement);
  flikrad.innerHTML = flikarHtml(pid, f[0]);
  // På en smal skärm rullar flikraden i sidled. Den valda fliken ska synas.
  const rad = main.querySelector('.min-flikar');
  const vald = rad.querySelector('[aria-current]');
  if (rad.scrollWidth > rad.clientWidth) {
    rad.scrollLeft += vald.getBoundingClientRect().left - rad.getBoundingClientRect().left - (rad.clientWidth - vald.offsetWidth) / 2;
  }
  if (hadeFokus) vald.focus({ preventScroll: true });
  const yttre = main.querySelector('#min-del');
  const el = document.createElement('div');
  el.innerHTML = '<p class="tom">Hämtar.</p>';
  yttre.replaceChildren(el);
  const dctx = {
    pid, sub, huvud, href: (d, s) => href(pid, d, s), aktuell: ctx.aktuell ?? (() => true),
    ladda: () => visa(main, [pid, del, sub], q, { aktuell: () => true, sammaPatient: true }),
  };
  try {
    await f[2](el, dctx);
  } catch (e) {
    if (e instanceof ApiFel && [403, 404].includes(e.status)) { el.innerHTML = `<div class="ruta ruta-info"><p>${esc(e.message)}</p></div>`; return; }
    throw e;
  }
}
