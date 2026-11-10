// Blodcentralen (simulerad) sedd från den egna vårdenheten (runda 11, r4, Sussa 4.4.2.12): varje blodbeställning i
// kedjan från upprättad till avslutad, enheterna som är ute på avdelningen och när de ska återlämnas, rapporterna om
// transfusionsreaktioner och lagret per blodgrupp.
import { esc, api, vyRubrik, tidpunkt, klockslag, ikon } from '../ui.js';
import { kedja } from './patient-blod.js';

export const namn = 'blodcentral';

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Blodcentralen', 'Vårdenhetens blodbeställningar från upprättad till avslutad, blodet som är ute på avdelningen och rapporterna om transfusionsreaktioner. Blodcentralen är simulerad.')}<div id="bc"><p class="tom">Hämtar beställningarna.</p></div>`;
  const d = await api('/api/blodcentral');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#bc');
  if (!el) return;
  const reaktioner = d.bestallningar.flatMap(b => b.reaktioner.map(r => ({ ...r, b })));
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="bc-best"><div class="sektion-huvud"><h2 id="bc-best">Beställningar, ${esc(d.vardenhet.namn)}</h2><p class="under-text">${esc(d.text)}</p></div>
      ${d.bestallningar.length ? d.bestallningar.map(b => `<article class="bc-rad" aria-labelledby="bc-b-${b.id}"><h3 id="bc-b-${b.id}"><a class="patientlank" href="#/patient/${encodeURIComponent(b.patient.id)}/blod">${esc(b.patient.namn)}</a>: ${esc(b.antal)} ${esc(b.produkt.toLowerCase())} <span class="under-text">${esc(b.nummer)}, ${esc(tidpunkt(b.skapad))}</span></h3>
        ${kedja(b.steg)}
        ${b.enheter.length ? `<ul class="enkel-lista">${b.enheter.map(e => `<li${e.forSent ? ' class="text-larm"' : ''}>Enhet ${esc(e.enhetsnummer)}, ${esc(e.blodgrupp)}: ${esc(e.statusText)}${e.startaSenast ? `. ${e.forSent ? 'Mer än 30 minuter sedan utlämningen. Återlämna enheten.' : `Starta senast klockan ${esc(klockslag(e.startaSenast))}.`}` : ''}</li>`).join('')}</ul>` : ''}
      </article>`).join('') : '<p class="tom">Inga blodbeställningar de senaste två veckorna som du kan se.</p>'}
    </section>
    <section class="ov-sektion" aria-labelledby="bc-hv"><div class="sektion-huvud"><h2 id="bc-hv">Transfusionsreaktioner</h2><p class="under-text">Rapporterna till blodcentralen (hemovigilans).</p></div>
      ${reaktioner.length ? `<ul class="enkel-lista">${reaktioner.map(r => `<li class="${r.allvarlighet === 'allvarlig' ? 'text-larm' : ''}">${esc(tidpunkt(r.tid))}, ${esc(r.b.patient.namn)}: ${esc(r.typText)}, enhet ${esc(r.enhetsnummer)}. ${r.proverBestallda ? 'Proverna är beställda.' : 'Proverna är inte beställda än.'}</li>`).join('')}</ul>` : '<p class="tom">Inga rapporterade reaktioner.</p>'}
    </section>
    <section class="ov-sektion" aria-labelledby="bc-lager"><div class="sektion-huvud"><h2 id="bc-lager">Erytrocyter i lager</h2></div>
      <div class="tabellrulle"><table class="tabell"><caption class="sr">Lagret per blodgrupp</caption><thead><tr><th scope="col">Blodgrupp</th><th scope="col">I lager</th><th scope="col">Reserverade och utlämnade</th></tr></thead>
      <tbody>${d.lager.map(l => `<tr><th scope="row">${esc(l.blodgrupp)}</th><td${l.lagt ? ' class="text-larm"' : ''}>${l.iLager}${l.lagt ? ' (lågt)' : ''}</td><td>${l.reserverade}</td></tr>`).join('')}</tbody></table></div>
      <p class="dampad liten">${ikon.info}${esc(d.demoregel)}</p>
    </section>`;
}
