// Runda 14, r4 (Sussa 11.2.1.8): vårdenhetens reservdator för läkemedel. En sjuksköterska eller läkare öppnar sidan på
// en dator på vårdenheten och låter den vara öppen. Sidan hämtar själv listan över alla inskrivna patienter med
// ordinationer och dagens doser var fjärde minut. Svarar inte kärnsystemet visas den senaste listan med sin ålder, och
// den kan skrivas ut. Ingen behöver komma ihåg att ta ut en reservlista.
import { esc, api, vyRubrik, tidpunkt, klockslag, ikon, plural } from '../ui.js';
import { aktuellNav } from '../app.js';

export const namn = 'reservdator';

const STATUS = { att_ge: 'Att ge', forsenad: 'Försenad', kommande: 'Kommande', given: 'Given', overlamnad: 'Överlämnad', ej_given: 'Inte given', iordningstalld: 'Iordningsställd' };
// Den senaste listan och när den hämtades, mätt med datorns klocka. Bara i minnet, så att den försvinner när fliken stängs.
let senast = null;

const minuter = (ms) => Math.max(0, Math.floor(ms / 60_000));
function aldersrad(l, hamtad, fel) {
  const alder = Date.now() - hamtad;
  const gammal = alder > l.fornyas.maxAlderMs;
  const text = `Listan hämtades kl. ${klockslag(new Date(hamtad).toISOString())}, för ${plural(minuter(alder), 'minut', 'minuter')} sedan.`;
  if (gammal) return `<p class="ruta ruta-larm" role="alert" data-reserv-alder="gammal">${ikon.varning}<span>${esc(text)} Uppgifterna är äldre än tio minuter. Ändringar efter den tiden syns inte. Fråga den som är ansvarig för patientens läkemedel innan du ger något som kan ha ändrats.</span></p>`;
  if (fel) return `<p class="ruta ruta-info" role="status" data-reserv-alder="avbrott">${esc(text)} Kärnsystemet svarar inte just nu. Listan visas som den var och förnyas så snart kärnsystemet svarar.</p>`;
  return `<p class="ruta ruta-info liten" role="status" data-reserv-alder="aktuell">${esc(text)} Den förnyas av sig själv var fjärde minut.</p>`;
}

const patientHtml = (p) => `<section class="reserv-patient" aria-labelledby="rp-${esc(p.id)}">
  <h2 id="rp-${esc(p.id)}">${esc(p.namn)} <span class="under-text">${esc(p.personnummer)}, ${esc(p.plats ?? '')}</span></h2>
  ${p.ordinationer.length ? `<div class="tabellrulle"><table class="tabell kompakt"><caption class="sr">Ordinationer för ${esc(p.namn)}</caption>
    <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Tider</th></tr></thead>
    <tbody>${p.ordinationer.map(o => `<tr><th scope="row">${esc(o.lakemedel)}${o.orsak ? `<span class="under-text">${esc(o.orsak)}</span>` : ''}</th><td>${esc(o.dosering ?? '')}${o.vidBehov ? ' <span class="tagg">Vid behov</span>' : ''}</td><td>${esc((o.tider ?? []).join(', '))}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="tom">Inga aktuella ordinationer.</p>'}
  ${p.doser.length ? `<h3>Dagens doser</h3><ul class="reserv-doser">${p.doser.map(d => `<li><span>${esc(klockslag(d.planerad))} ${esc(d.lakemedel)}</span> <span class="tagg">${esc(STATUS[d.status] ?? d.status)}</span>${d.given?.tid ? `<span class="under-text">Registrerad kl. ${esc(klockslag(d.given.tid))}</span>` : ''}</li>`).join('')}</ul>` : ''}
</section>`;

function rita(el) {
  const { lista: l, hamtad, fel } = senast;
  el.innerHTML = `${aldersrad(l, hamtad, fel)}
    <p class="dampad liten">${esc(l.vardenhet.namn)}. ${esc(plural(l.patienter.length, 'inskriven patient', 'inskrivna patienter'))}. ${esc(l.simulerat)}</p>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-skriv-ut>${ikon.logg}<span>Skriv ut listan</span></button></div>
    ${l.patienter.length ? l.patienter.map(patientHtml).join('') : '<p class="tom">Inga patienter är inskrivna på vårdenheten.</p>'}`;
  el.querySelector('[data-skriv-ut]').addEventListener('click', () => window.print());
}

async function hamta() {
  try {
    const lista = await api('/api/reservlista');
    senast = { lista, hamtad: Date.now(), fel: false };
  } catch (e) {
    if (!senast) throw e;
    senast = { ...senast, fel: true };
  }
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Reservdator för läkemedel', 'Låt sidan vara öppen på en dator på vårdenheten. Den hämtar själv ordinationerna och dagens doser för alla inskrivna patienter var fjärde minut, och visar dem också när kärnsystemet inte svarar.')
    + '<div id="reservdator" class="reservdator"><p class="tom">Hämtar listan.</p></div>';
  const el = main.querySelector('#reservdator');
  const nr = aktuellNav();
  await hamta();
  rita(el);
  // Var 30:e sekund: åldern visas på nytt, och listan hämtas om den har hunnit bli fyra minuter gammal.
  const tick = async () => {
    if (aktuellNav() !== nr || !el.isConnected) return;
    if (Date.now() - senast.hamtad >= senast.lista.fornyas.intervallMs || senast.fel) await hamta();
    if (aktuellNav() !== nr || !el.isConnected) return;
    rita(el);
    setTimeout(tick, 30_000);
  };
  setTimeout(tick, 30_000);
}
