// Runda 10, r2: utbildningsläget (Sussa 3.1.2.4). Journalen visas pseudonymiserad för undervisning och handledning, och
// vyn säger vilka uppgifter som aldrig visas och vilka begränsningar som finns. Servern tar bort uppgifterna, så att
// de aldrig når webbläsaren.
import { esc, api } from '../ui.js';

const dag = (n) => (n === 0 ? 'Dag 0' : `Dag ${n}`);

export async function visa(el, ctx) {
  const u = await api(`/api/patient/${encodeURIComponent(ctx.id)}/utbildningsvy`);
  if (!ctx.aktuell()) return;
  let nr = 0;
  const lista = (rubrik, rader, fn) => (rader == null ? '' : `<section class="ov-sektion" aria-labelledby="utb-${++nr}"><h3 id="utb-${nr}">${esc(rubrik)}</h3>${rader.length ? `<ul class="enkel-lista">${rader.map(fn).join('')}</ul>` : '<p class="tom liten">Inget att visa.</p>'}</section>`);
  el.innerHTML = `<div class="flikhuvud"><h2>Utbildningsläge: ${esc(u.patient.pseudonym)}</h2></div>
    <p class="ruta ruta-info">${esc(u.patient.pseudonym)}, ${esc(u.patient.kon === 'kvinna' ? 'kvinna' : 'man')}, ${esc(u.patient.aldersgrupp)}. Tiden räknas i dagar från den senaste uppgiften, som är dag 0.</p>
    <details class="ruta"><summary>Det här visas aldrig i utbildningsläget</summary><ul>${u.visasAldrig.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="hjalp">${esc(u.begransningar)}</p></details>
    <div class="oversikt-rutnat">
      ${lista('Diagnoser', u.diagnoser, d => `<li><span class="kod">${esc(d.kod)}</span> ${esc(d.text)}<span class="under-text">${esc(dag(d.dag))}, ${esc(d.enhet)}</span></li>`)}
      ${lista('Aktuella läkemedel', u.lakemedel, l => `<li><strong>${esc(l.namn)}</strong> ${esc(l.dosering)}<span class="under-text">${esc(l.orsak)}. ${esc(dag(l.dag))}</span></li>`)}
      ${lista('Senaste mätvärden', u.matvarden, m => `<li>${esc(m.namn)}: ${esc(m.varde)}<span class="under-text">${esc(dag(m.dag))}</span></li>`)}
    </div>
    ${lista('Anteckningar', u.anteckningar, a => `<li><strong>${esc(a.typ)}</strong><span class="under-text">${esc(dag(a.dag))}, ${esc(a.enhet)}${a.skrivenAv ? `, ${esc(a.skrivenAv)}` : ''}</span><dl class="sokord">${a.sokord.map(s => `<div><dt>${esc(s.sokord)}</dt><dd>${esc(s.text)}</dd></div>`).join('')}</dl></li>`)}`;
}
