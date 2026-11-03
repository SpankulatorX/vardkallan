// Patientjournalen: fast patienthuvud (armbandet), behörighetsrad och flikar.
import { esc, api, ikon, GRUND, migreradEtikett, ApiFel } from '../ui.js';
import { far, pa, S, uppdateraInkorg, rita } from '../app.js';
import { valDialog, nekadRuta } from '../behorighet.js';
import * as oversikt from './patient-oversikt.js';
import * as journal from './patient-journal.js';
import * as lakemedel from './patient-lakemedel.js';
import * as matvarden from './patient-matvarden.js';
import * as remisserFlik from './patient-remisser.js';
import * as logglista from './patient-logglista.js';
import * as uppmarksamhet from '../uppmarksamhet.js';
import * as identitet from './patient-identitet.js';
import * as utlamnat from './patient-utlamnat.js';

export const namn = 'patient';

const FLIKAR = [
  ['oversikt', 'Översikt', () => pa('las_oversikt', 'las_admin'), oversikt],
  ['journal', 'Journal', () => pa('las_journal', 'las_omvardnad'), journal],
  ['lakemedel', 'Läkemedel', () => far('las_lakemedel'), lakemedel],
  ['matvarden', 'Mätvärden', () => far('las_matvarden'), matvarden],
  ['remisser', 'Remisser', () => pa('las_remiss', 'las_remiss_status'), remisserFlik],
  ['logglista', 'Logglista', () => true, logglista],
  ['identitet', 'Identitet', () => pa('las_oversikt', 'las_admin'), identitet],
  ['utlamnat', 'Utskrifter', () => pa('skriv_ut', 'utlamna'), utlamnat],
];

let huvud = null;

const href = (id, flik, sub) => `#/patient/${encodeURIComponent(id)}${flik ? `/${flik}` : ''}${sub ? `/${encodeURIComponent(sub)}` : ''}`;
export const patientHref = href;

function grundChips(h) {
  const c = [];
  if (h.nodatkomst) c.push(['nodatkomst', 'Nödåtkomst, loggas och granskas']);
  else if (h.grund === 'administrativ') c.push(['administrativ', 'Administrativ uppgift på din enhet']);
  else c.push(['vardrelation', 'Vårdrelation på din enhet']);
  if (h.andraEnheterVisade && !h.nodatkomst) c.push(['aktivt_val', 'Aktivt val: andra vårdenheter']);
  if (h.samtyckeSparr) c.push(['samtycke_sparr', 'Samtycke till spärrade uppgifter']);
  if (h.identitetVisad) c.push(['identitet', 'Identitet visad']);
  return c.map(([k, t]) => `<li class="grund grund-${k}">${esc(t)}</li>`).join('');
}

function overkanslighetSignal(h) {
  if (h.overkanslighet == null) return '';
  if (!h.overkanslighet.length) return '<li class="signal signal-ingen">Ingen registrerad överkänslighet</li>';
  const amnen = h.overkanslighet.map(o => o.amne).join(', ');
  return `<li class="signal signal-overk"><details>
    <summary>${ikon.varning}<span>Överkänslighet: ${esc(amnen)}</span></summary>
    <ul class="signal-detalj">${h.overkanslighet.map(o => `<li><strong>${esc(o.amne)}</strong>${o.atc ? ` (ATC ${esc(o.atc)})` : ''}, ${o.allvarlighet === 'allvarlig' ? 'allvarlig' : 'måttlig'}. ${esc(o.reaktion ?? '')}
      <span class="under-text">Registrerad ${esc(o.datum ?? '')} av ${esc(o.vardenhet?.namn ?? '')}</span>${migreradEtikett(o)}</li>`).join('')}</ul>
  </details></li>`;
}

function bandHtml(h) {
  return `<header class="patientband" aria-label="Patient">
    <div class="band-las" aria-hidden="true"><span></span></div>
    <div class="band-id">
      <h1 tabindex="-1">${h.skyddad && !h.identitetVisad ? `${ikon.skold}<span>Skyddad identitet</span>` : esc(h.namn)}</h1>
      <p class="band-fakta">${h.identitet && h.identitet.typ !== 'personnummer' ? `<span class="tagg">${esc(h.identitet.typText)}</span>` : ''}<span class="pnr">${esc(h.personnummer)}</span><span>${esc(h.alder)} år</span><span>${h.kon === 'kvinna' ? 'Kvinna' : 'Man'}</span>${h.listning ? `<span>Listad på ${esc(h.listning.enhet.namn)}</span>` : ''}</p>
    </div>
    <ul class="band-signaler" aria-label="Uppmärksamhetssignaler och markeringar">
      ${h.uppmarksamhet ? uppmarksamhet.bandSignal(h) : overkanslighetSignal(h)}
      ${h.skyddad ? `<li class="signal signal-skydd">${ikon.skold}<span>Skyddade personuppgifter${h.identitetVisad ? ', identiteten visas' : ''}</span></li>` : ''}
      ${h.sparrmarkering ? `<li class="signal signal-sparr">${ikon.las}<span>Det finns spärrade uppgifter</span></li>` : ''}
    </ul>
    <div class="band-grund"><span class="band-etikett" id="grund-etikett">Åtkomsten vilar på</span><ul aria-labelledby="grund-etikett">${grundChips(h)}</ul></div>
  </header>`;
}

function behorighetsrad(h) {
  const r = [];
  // En journal som är gallrad eller förstörd efter beslut (Sussa 5.4.2.4 och 5.3.1.7) säger det själv.
  if (h.journalForstord) r.push(`<div class="behorighet">${ikon.arkiv}<p>${esc(h.journalForstord.text)} Åtkomstloggen och uppgifterna om utlämnanden finns kvar.</p></div>`);
  if (h.skyddad && !h.identitetVisad && far('visa_identitet')) {
    r.push(`<div class="behorighet behorighet-skydd">${ikon.skold}<p>Namn och personnummer är dolda eftersom patienten har skyddade personuppgifter.</p><button type="button" class="knapp liten sekundar" data-val="visa_identitet">Visa identitet</button></div>`);
  }
  if (h.sparrmarkering && far('samtycke_sparr')) {
    r.push(`<div class="behorighet behorighet-sparr" data-sparr-rad>${ikon.las}<p>Det finns spärrade uppgifter från en annan vårdenhet. De visas bara om patienten samtycker nu.</p><button type="button" class="knapp liten sekundar" data-val="samtycke_sparr">Patienten samtycker till att spärren tillfälligt hävs</button></div>`);
  }
  // Troliga dubbletter som systemet har hittat (Sussa 3.1.1.2). Bara för den som kan slå samman journaler.
  if (h.dubbletter > 0 && far('sla_samman')) {
    r.push(`<div class="behorighet">${ikon.info}<p>Systemet har hittat ${h.dubbletter === 1 ? 'en trolig dubblett' : `${h.dubbletter} troliga dubbletter`} av journalen.</p><a class="knapp liten sekundar" href="${href(h.id, 'identitet')}">Visa förslaget</a></div>`);
  }
  if (h.harAndraEnheter && !h.andraEnheterVisade && far('andra_enheter')) {
    r.push(`<div class="behorighet">${ikon.info}<p data-andra-text>Det finns uppgifter från andra vårdenheter som inte visas.</p><button type="button" class="knapp liten sekundar" data-val="andra_enheter">Visa uppgifter från andra vårdenheter</button></div>`);
  }
  return r.join('');
}

// Rad om dolda poster i en lista, med knapp för rätt val.
// När patienthuvudet redan erbjuder samma val visas antalet där i stället, så att raden inte står två gånger.
export function doldaRad(dolda) {
  if (!dolda) return '';
  const r = [];
  const huvudText = document.querySelector('[data-andra-text]');
  if (dolda.kraverVal > 0 && huvudText) {
    huvudText.textContent = `${dolda.kraverVal === 1 ? 'En post' : `${dolda.kraverVal} poster`} från andra vårdenheter visas inte här.`;
  } else if (huvudText) {
    huvudText.textContent = 'Det finns uppgifter från andra vårdenheter som inte visas.';
  }
  if (dolda.kraverVal > 0 && !huvudText) {
    r.push(`<div class="behorighet behorighet-liten">${ikon.info}<p>${dolda.kraverVal === 1 ? 'En post' : `${dolda.kraverVal} poster`} från andra vårdenheter visas inte.</p>${far('andra_enheter') ? '<button type="button" class="knapp liten sekundar" data-val="andra_enheter">Visa uppgifter från andra vårdenheter</button>' : ''}</div>`);
  }
  if (dolda.sparrade && !document.querySelector('[data-sparr-rad]')) {
    r.push(`<div class="behorighet behorighet-sparr behorighet-liten">${ikon.las}<p>Det finns spärrade uppgifter som inte visas.</p>${far('samtycke_sparr') ? '<button type="button" class="knapp liten sekundar" data-val="samtycke_sparr">Patienten samtycker till att spärren tillfälligt hävs</button>' : ''}</div>`);
  }
  return r.join('');
}

// Ruta när en enskild uppgift kräver val eller samtycke.
export function kravRuta(e) {
  if (e?.kod === 'kraver_val') return `<div class="ruta ruta-info">${ikon.info}<div><p>${esc(e.message)}</p>${far('andra_enheter') ? '<button type="button" class="knapp liten" data-val="andra_enheter">Visa uppgifter från andra vårdenheter</button>' : ''}</div></div>`;
  if (e?.kod === 'kraver_samtycke') return `<div class="ruta ruta-sparr">${ikon.las}<div><p>${esc(e.message)}</p>${far('samtycke_sparr') ? '<button type="button" class="knapp liten" data-val="samtycke_sparr">Patienten samtycker till att spärren tillfälligt hävs</button>' : ''}</div></div>`;
  return nekadRuta(e, { rubrik: 'Uppgiften kan inte visas' });
}

function flikarHtml(id, aktiv) {
  return `<nav class="flikar" aria-label="Journalens delar"><ul>${FLIKAR.filter(f => f[2]()).map(([k, t]) =>
    `<li><a href="${href(id, k === 'oversikt' ? null : k)}"${k === aktiv ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>`;
}

async function ingenAtkomst(main, id, e) {
  if (e.status === 404) {
    main.innerHTML = `<div class="vyhuvud"><h1 tabindex="-1">Patienten finns inte</h1></div><p>Det finns ingen patient med id ${esc(id)} i demon. <a href="#/sok">Sök patient</a></p>`;
    return;
  }
  if (e.kod === 'kraver_val' && far('nodatkomst')) {
    main.innerHTML = `<div class="vyhuvud"><h1 tabindex="-1">Ingen vårdrelation</h1></div>
      <div class="ruta ruta-nod">
        <p>${esc(e.message)}</p>
        <p>Journalen är inte öppnad. Försöket är loggat, som alla försök att öppna en journal.</p>
        <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-val="nodatkomst">${ikon.varning}<span>Nödåtkomst</span></button><a class="knapp sekundar" href="#/sok">Tillbaka till sök</a></div>
      </div>`;
    main.querySelector('[data-val]').addEventListener('click', async () => {
      if (await valDialog('nodatkomst', id)) visa(main, [id], new URLSearchParams(), { aktuell: () => true });
    });
    return;
  }
  main.innerHTML = `<div class="vyhuvud"><h1 tabindex="-1">Journalen är inte öppnad</h1></div>${nekadRuta(e)}<p><a href="#/sok">Tillbaka till sök</a></p>`;
}

export async function visa(main, [id, flik, sub], q, ctx = {}) {
  const tillgangliga = FLIKAR.filter(f => f[2]());
  let f = tillgangliga.find(x => x[0] === (flik ?? 'oversikt')) ?? tillgangliga[0];
  if (!ctx.sammaPatient || !huvud || huvud.id !== id || !main.querySelector('.patientvy')) {
    main.innerHTML = '<p class="tom">Öppnar journalen.</p>';
    try { huvud = await api(`/api/patient/${encodeURIComponent(id)}`); } catch (e) {
      if (e instanceof ApiFel && [403, 404].includes(e.status)) { huvud = null; return ingenAtkomst(main, id, e); }
      throw e;
    }
    // En journal som har slagits samman med en annan leder till den gällande journalen.
    if (huvud.id !== id) {
      history.replaceState(null, '', href(huvud.id, flik, sub));
      id = huvud.id;
    }
    if (ctx.aktuell && !ctx.aktuell()) return;
    main.innerHTML = `<div class="patientvy">
      ${bandHtml(huvud)}
      <div class="behorighetsrad" id="behorighetsrad">${uppmarksamhet.forslagRader(huvud)}${behorighetsrad(huvud)}</div>
      <div id="flikrad"></div>
      <section class="flikinnehall" id="flikinnehall"></section>
    </div>`;
    // Uppmärksamhetsinformation: efter en bekräftelse ritas huvudet om med den nya symbolen.
    uppmarksamhet.koppla(main.querySelector('.patientvy'), id, async () => { huvud = null; await rita(); });
    main.querySelector('.patientvy').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-val]');
      if (!b) return;
      if (await valDialog(b.dataset.val, id)) {
        huvud = null;
        await uppdateraInkorg();
        rita();
      }
    });
  }
  main.querySelector('#flikrad').innerHTML = flikarHtml(id, f[0]);
  // En ny behållare per visning, så att lyssnare från en tidigare flik inte ligger kvar.
  const yttre = main.querySelector('#flikinnehall');
  const el = document.createElement('div');
  el.innerHTML = '<p class="tom">Hämtar.</p>';
  yttre.replaceChildren(el);
  const fctx = {
    id, sub, q, patient: huvud, href: (fl, s) => href(id, fl, s),
    // Efter en sparad ändring ritas fliken om. Ett formulär som öppnades med /ny, eller med /aterinsatt-<id> från
    // inkorgen (runda 5, r4), öppnas inte igen.
    ladda: () => {
      const engang = (sub === 'ny' || /^aterinsatt-/.test(sub ?? '')) && flik !== 'journal';
      if (engang) history.replaceState(null, '', href(id, flik));
      return visa(main, [id, flik, engang ? undefined : sub], q, { aktuell: () => true, sammaPatient: true });
    },
    laddaOm: () => { huvud = null; return rita(); },
    aktuell: ctx.aktuell ?? (() => true),
  };
  try {
    await f[3].visa(el, fctx);
  } catch (e) {
    if (e instanceof ApiFel && e.status === 403) { yttre.innerHTML = kravRuta(e); return; }
    throw e;
  }

}

// Kort om patienten för vyer utanför journalen.
export const aktuellPatient = () => huvud;
export const nollstall = () => { huvud = null; };
export { S };
