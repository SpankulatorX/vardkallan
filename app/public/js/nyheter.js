// Nyhetsrutan efter en ny version (Sussa 10.1.1.4). Visar det som är nytt för den inloggades roll, med de stora
// förändringarna först, och stängs med ett klick. Servern vet vad användaren redan har stängt. Rutan ligger utanför
// huvudinnehållet, så att den inte skymmer något och inte byts ut när vyn byts.
import { esc, api, notis, medKnapp } from './ui.js';

const ROLLTEXT = {
  lakare: 'läkare', sjukskoterska: 'sjuksköterska', underskoterska: 'undersköterska', vardadministrator: 'vårdadministratör',
  logggranskare: 'logggranskare', arkivarie: 'arkivarie', uppfoljning: 'analytiker', kommun: 'kommunens personal', farmaceut: 'farmaceut',
  verksamhetschef: 'verksamhetschef', invanare: 'invånare',
};
export const rollText = (roll) => ROLLTEXT[roll] ?? 'användare';
export const datumText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// En nyhet. En stor förändring av arbetssättet är märkt så och har en länk dit förändringen finns. En liten står på en rad.
export const nyhetHtml = (n) => (n.omfattning === 'stor'
  ? `<li class="nyhet nyhet-stor"><strong class="nyhet-rubrik">${esc(n.rubrik)}</strong><span class="tagg tagg-stor">Ändrat arbetssätt</span>
    <p>${esc(n.text)}${n.var ? ` <a href="${esc(n.var)}">Gå dit</a>` : ''}</p></li>`
  : `<li class="nyhet nyhet-liten"><p><strong class="nyhet-rubrik">${esc(n.rubrik)}.</strong> ${esc(n.text)}</p></li>`);

let senast = null;

export async function visa() {
  const plats = document.getElementById('nyhetsruta');
  if (!plats) return;
  let d;
  try { d = await api('/api/nyheter', { tyst: true }); } catch { plats.replaceChildren(); return; }
  senast = d;
  if (!d.ruta) { plats.replaceChildren(); return; }
  plats.innerHTML = `<section class="nyhetsruta" aria-labelledby="nyheter-rubrik">
    <div class="nyhetsruta-inre">
      <h2 id="nyheter-rubrik">Nytt i Vårdkällan ${esc(d.ruta.version)} för dig som ${esc(rollText(d.roll))}</h2>
      <ul class="nyhetslista">${d.ruta.nyheter.map(n => nyhetHtml(n)).join('')}</ul>
      <div class="knapprad">
        <button type="button" class="knapp" data-a="stang-nyheter">Stäng nyheterna</button>
        <a class="knapp-lank" href="#/nyheter">Alla nyheter</a>
      </div>
    </div>
  </section>`;
}

export async function stang(knapp) {
  if (!senast?.ruta) return;
  const version = senast.ruta.version;
  await medKnapp(knapp, () => api('/api/nyheter/stang', { metod: 'POST', data: { version } }));
  senast = { ...senast, ruta: null };
  document.getElementById('nyhetsruta')?.replaceChildren();
  // Fokus går till vyns rubrik, så att den som använder tangentbordet inte hamnar i början av sidan.
  document.querySelector('main h1')?.focus();
  notis('Nyheterna är stängda. Du kan läsa dem igen under Alla nyheter på sidan Nyheter.', 'info');
}

export const tom = () => document.getElementById('nyhetsruta')?.replaceChildren();
