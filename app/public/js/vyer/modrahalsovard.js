// Mödrahälsovården (runda 11, r3, Sussa 4.7.1.2 och 4.7.1.4): graviditeterna på vårdenheten med vecka, risk, nästa
// besök, varningar och det som systemet föreslår, rapporteringen av inskrivningar och efterkontroller till
// Graviditetsregistret och uppföljningen utan personuppgifter.
import { esc, api, vyRubrik, datum } from '../ui.js';
import { far } from '../app.js';
import { registretHtml, kopplaRegistret, uppfoljningHtml } from '../obstetrik-ui.js';
import { demoknapp, kopplaDemo } from './forlossning.js';

export const namn = 'modrahalsovard';
const enc = encodeURIComponent;

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Mödrahälsovård', 'Graviditeterna på vårdenheten, rapporteringen till Graviditetsregistret och uppföljningen.')}<div id="mhv"><p class="tom">Hämtar mödrahälsovården.</p></div>`;
  const ladda = () => visa(main, _p, _q, ctx);
  const [d, r, u] = await Promise.all([api('/api/modrahalsovard'), api('/api/graviditetsregistret').catch(() => null), far('statistik') ? api('/api/graviditet/uppfoljning').catch(() => null) : null]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#mhv');
  if (!el) return;
  el.innerHTML = `${!d.graviditeter.length ? demoknapp('Det finns inga graviditeter på vårdenheten i din sandlåda.') : ''}
    <section class="ov-sektion" aria-labelledby="mhv-g"><div class="sektion-huvud"><h2 id="mhv-g">Graviditeter på ${esc(d.vardenhet?.namn ?? '')}</h2>
      <p class="under-text">${esc(d.text)} ${d.antal.pagaende} pågående och ${d.antal.efterkontroll} som väntar på efterkontroll.</p></div>
    ${d.graviditeter.length ? `<div class="tabellrulle"><table class="tabell" id="mhv-tabell"><caption class="sr">Graviditeterna på vårdenheten</caption>
      <thead><tr><th scope="col">Patient</th><th scope="col">Vecka</th><th scope="col">Beräknad partus</th><th scope="col">Risk</th><th scope="col">Nästa besök</th><th scope="col">Systemet föreslår</th></tr></thead>
      <tbody>${d.graviditeter.map(g => `<tr${g.varningar.length ? ' class="rad-larm"' : ''}>
        <th scope="row"><a class="patientlank" href="#/patient/${enc(g.patientId)}/graviditet">${esc(g.namn)}</a>${g.antalFoster > 1 ? `<span class="under-text">${g.antalFoster} foster</span>` : ''}</th>
        <td>${esc(g.vecka ?? 'Förlöst')}</td><td>${esc(datum(g.bpd))}</td>
        <td><span class="tagg${g.risk.niva === 'normal' ? ' tagg-ok' : ' tagg-utkast'}">${esc(g.risk.namn)}</span></td>
        <td>${g.nasta ? `${esc(g.nasta.typ)}<span class="under-text">vecka ${g.nasta.vecka}, ${esc(datum(g.nasta.datum))}</span>` : ''}</td>
        <td>${g.varningar.length ? `<span class="text-larm">${esc(g.varningar.join(' '))}</span>` : ''}${g.attGora.length ? `<span class="under-text">${esc(g.attGora.join(' '))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom">Inga graviditeter.</p>'}
    </section>
    ${r ? registretHtml(r) : ''}${uppfoljningHtml(u)}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;
  kopplaRegistret(el, ladda);
  kopplaDemo(el, ladda);
}
