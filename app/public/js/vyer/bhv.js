// Barnhälsovård (runda 7, r6): rapporteringen till Svenska barnhälsovårdsregistret med kontroll före utskicket, och
// uppföljningen av kvalitet och produktion på barnavårdscentralen utan personuppgifter.
import { esc, api, vyRubrik, tidpunkt, ikon, notis, medKnapp } from '../ui.js';
// Runda 11, r7: valbara indikatorer (bhv-indikatorer-ui.js).
import { indikatorerHtml, kopplaIndikatorer } from '../bhv-indikatorer-ui.js';

export const namn = 'bhv';

export async function visa(main) {
  main.innerHTML = vyRubrik('Barnhälsovård', 'Rapporteringen till Svenska barnhälsovårdsregistret och uppföljningen på barnavårdscentralen.') + '<div id="bhv"><p class="tom">Hämtar.</p></div>';
  const [r, u, ind] = await Promise.all([api('/api/bhv/bhvq'), api('/api/bhv/uppfoljning'), api('/api/bhv/indikatorer').catch(() => null)]);
  const el = main.querySelector('#bhv');
  if (!el) return;
  const fel = r.barn.filter(b => b.fel.length);
  el.innerHTML = `<section aria-labelledby="bhv-q" class="ruta"><h2 id="bhv-q">Rapport till Svenska barnhälsovårdsregistret</h2>
      <p>${esc(r.text)} ${r.sedan ? `Förra utskicket ${esc(tidpunkt(r.sedan))}, kvittens ${esc(r.forraKvittens)}.` : 'Inget har skickats än.'}</p>
      <p class="under-text">Mottagare: ${esc(r.mottagare)}. Systemet sammanställer det som har registrerats sedan förra utskicket enligt registrets informationsspecifikation (bilaga K11) och kontrollerar varje barn före utskicket.</p>
      ${fel.length ? `<div class="ruta ruta-larm" data-bhvq-fel>${ikon.varning}<div><p><strong>${fel.length === 1 ? 'Ett barn har' : `${fel.length} barn har`} fel och skickas inte förrän felet är rättat.</strong></p>
        <ul>${fel.map(b => `<li>${esc(b.patient.namn)}: ${b.fel.map(f => `<a href="${esc(f.href)}">${esc(f.text)}</a>`).join(' ')}</li>`).join('')}</ul></div></div>` : ''}
      <dl class="faktarad">
        <div><dt>Barn att skicka</dt><dd data-bhvq-barn>${r.antal.barn}</dd></div>
        <div><dt>Nya uppgifter</dt><dd>${r.antal.observationer}</dd></div>
        <div><dt>Motsatt sig registrering</dt><dd>${r.undantagna.motsatt}</dd></div>
        <div><dt>Skyddade personuppgifter</dt><dd>${r.undantagna.skyddad}</dd></div>
      </dl>
      <p class="under-text">Barn som har motsatt sig registreringen rapporteras inte (patientdatalagen 7 kap. 2 §). ${esc(r.demoregel)}</p>
      ${r.antal.barn ? '<button type="button" class="knapp" data-bhvq-skicka>Skicka till registret</button>' : ''}
      ${r.utskick.length ? `<details><summary>Tidigare utskick (${r.utskick.length})</summary><ul class="enkel-lista">${r.utskick.map(x => `<li><strong>${esc(x.kvittens)}</strong><span class="under-text">${esc(tidpunkt(x.tid))} av ${esc(x.av ?? '')}: ${x.antalBarn} barn och ${x.antalObservationer} uppgifter.</span></li>`).join('')}</ul></details>` : ''}
    </section>
    <section aria-labelledby="bhv-u"><h2 id="bhv-u">Uppföljning på ${esc(u.enhet)}</h2>
      <p>${esc(u.text)} ${u.antalBarn} ${u.antalBarn === 1 ? 'barn är inskrivet' : 'barn är inskrivna'}. ${u.hemmatningarSomVantar === 1 ? 'En mätning hemma väntar' : `${u.hemmatningarSomVantar} mätningar hemma väntar`} på bekräftelse.</p>
      <div class="tabellrulle"><table class="tabell siffertabell"><caption>Hälsobesöken i programmet</caption>
        <thead><tr><th scope="col">Besök</th><th scope="col" class="tal">Barn som har passerat åldern</th><th scope="col" class="tal">Gjort i tid</th><th scope="col" class="tal">Med alla mått</th></tr></thead>
        <tbody>${u.besok.map(b => `<tr><th scope="row">${esc(b.text)}</th><td class="tal">${b.barn}</td><td class="tal">${b.iTid}</td><td class="tal">${b.medAllaMatt}</td></tr>`).join('')}</tbody></table></div>
      <div class="tabellrulle"><table class="tabell siffertabell"><caption>Vaccinationer</caption>
        <thead><tr><th scope="col">Dos</th><th scope="col" class="tal">Barn som har passerat åldern</th><th scope="col" class="tal">Givna</th></tr></thead>
        <tbody>${u.vaccinationer.map(v => `<tr><th scope="row">${esc(v.text)}</th><td class="tal">${v.barn}</td><td class="tal">${v.givna}</td></tr>`).join('')}</tbody></table></div>
      <p class="under-text">${esc(u.demoregel)}</p>
    </section>
    ${ind ? indikatorerHtml(ind) : ''}
    <details class="ruta"><summary>${esc(u.plan.rubrik)}</summary><p class="dampad">${esc(u.plan.status)}</p>
      <dl class="faktalista">${u.plan.delar.map(d => `<div><dt>${esc(d.rubrik)}</dt><dd>${esc(d.text)}</dd></div>`).join('')}</dl></details>`;
  kopplaIndikatorer(el, () => visa(main));
  el.querySelector('[data-bhvq-skicka]')?.addEventListener('click', async (e) => {
    try {
      const s = await medKnapp(e.currentTarget, () => api('/api/bhv/bhvq/skicka', { metod: 'POST', data: {} }));
      notis(s.text);
      visa(main);
    } catch { /* felet visas som notis */ }
  });
}
