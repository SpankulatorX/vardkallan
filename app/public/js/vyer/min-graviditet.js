// Min journal: graviditeten för kvinnan själv (runda 11, r3, Jonas beslut 2026-11-10). Besöksprogrammet, beräknad
// partus, ultraljuden och provsvaren, efter vårdgivarens visningsregler. Inskrivningssamtalet och svaren om våld visas
// aldrig här.
import { esc, api, datum } from '../ui.js';

export async function visa(el, ctx) {
  const d = await api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/graviditet`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Graviditet</h2></div><p class="ingress">${esc(d.text)}</p>
    ${d.graviditeter.map(g => `<section class="ov-sektion" aria-labelledby="min-gr-${g.id}"><div class="sektion-huvud"><h3 id="min-gr-${g.id}">${g.status === 'pagaende' ? `Du är i ${esc(g.graviditetslangd.text.replace('v ', 'vecka '))}` : 'Avslutad graviditet'}</h3>
      <p class="under-text">Beräknad partus ${esc(datum(g.bpd))}${g.antalFoster > 1 ? `, ${g.antalFoster} barn` : ''}. ${esc(g.vardenhet?.namn ?? '')}.</p></div>
      ${g.nasta ? `<p>Nästa besök: <strong>${esc(g.nasta.typ)}</strong> i vecka ${g.nasta.vecka}, omkring ${esc(datum(g.nasta.datum))}.</p>` : ''}
      <h4>Besöksprogrammet</h4>
      <div class="tabellrulle"><table class="tabell"><caption class="sr">Besöken under graviditeten</caption><thead><tr><th scope="col">Vecka</th><th scope="col">Omkring</th><th scope="col">Besök</th><th scope="col">Gjort</th></tr></thead>
        <tbody>${g.program.map(b => `<tr><th scope="row">${b.vecka}</th><td>${esc(datum(b.datum))}</td><td>${esc(b.typ)}</td><td>${b.gjort ? 'Ja' : ''}</td></tr>`).join('')}</tbody></table></div>
      <h4>Ultraljud</h4>${g.ultraljud.length ? `<ul class="enkel-lista">${g.ultraljud.map(u => `<li><strong>${esc(u.typText)}</strong> ${esc(datum(u.datum))}, ${esc(u.vecka.replace('v ', 'vecka '))}<span class="under-text">${u.foster.map(f => `${u.antalFoster > 1 ? `Barn ${f.ordning}: ` : ''}${f.hjartaktivitet ? 'hjärtat slår' : 'inget hjärtljud'}${f.skattadVikt ? `, uppskattad vikt ${f.skattadVikt} g` : ''}`).join('. ')}.</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga ultraljud ännu.</p>'}
      <h4>Provsvar</h4>${g.provsvar.length ? `<ul class="enkel-lista">${g.provsvar.map(p => `<li>${esc(p.namn)} ${esc(p.varde)}${p.enhet ? ` ${esc(p.enhet)}` : ''}<span class="under-text">${esc(datum(p.tid))}</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga provsvar att visa ännu.</p>'}
    </section>`).join('')}`;
}
