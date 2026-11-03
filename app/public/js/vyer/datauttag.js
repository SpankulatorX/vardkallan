// Datauttaget för uppföljning (Sussa 6.3.1): manifestet, tabellerna med antal och ändringar sedan förra uppdateringen,
// länkar till NDJSON-filerna och beskrivningen av fälten. Inga namn och inga personnummer.
import { esc, api, vyRubrik, tidpunkt, ikon } from '../ui.js';

export const namn = 'datauttag';

export async function visa(main) {
  main.innerHTML = vyRubrik('Datauttag för uppföljning', 'En accesspunkt med vårdkontakter, diagnoser, ordinationer och remisser utan namn, personnummer och fritext. Den uppdateras av sig själv varje natt.') + '<div id="du"><p class="tom">Hämtar uttaget.</p></div>';
  const [m, schema] = await Promise.all([api('/api/datauttag'), api('/api/datauttag/schema')]);
  const el = main.querySelector('#du');
  el.innerHTML = `
    <dl class="faktarad">
      <div><dt>Senast uppdaterat</dt><dd>${esc(tidpunkt(m.transactionTime))}</dd></div>
      <div><dt>Nästa uppdatering</dt><dd>${esc(tidpunkt(m.nastaUppdatering))}, varje natt klockan ${esc(m.uppdaterasKlockan)}</dd></div>
      <div><dt>Format</dt><dd>NDJSON med ett manifest som i FHIR Bulk Data</dd></div>
    </dl>
    <div class="tabellrulle"><table class="tabell siffertabell">
      <thead><tr><th scope="col">Tabell</th><th scope="col" class="tal">Rader</th><th scope="col" class="tal">Nya</th><th scope="col" class="tal">Ändrade</th><th scope="col" class="tal">Borttagna</th><th scope="col">Hämta</th></tr></thead>
      <tbody>${m.output.map(o => { const a = m.andringar[o.type]; return `<tr><th scope="row">${esc(o.type)}<span class="under-text">${esc(schema.tabeller[o.type].beskrivning)}</span></th><td class="tal">${o.count}</td><td class="tal">${a.forstaUppdateringen ? '' : a.ny}</td><td class="tal">${a.forstaUppdateringen ? '' : a.andrad}</td><td class="tal">${a.forstaUppdateringen ? '' : a.borttagen}</td>
        <td><a href="/api/datauttag/${esc(o.type)}" download="${esc(o.type)}.ndjson">Alla rader</a>${a.forstaUppdateringen ? '' : ` <a href="/api/datauttag/${esc(o.type)}?andringar=1" download="${esc(o.type)}-andringar.ndjson">Ändringar</a>`}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <div class="ruta ruta-info">${ikon.info}<div><p>${esc(m.utelamnat.text)}</p><p>Utelämnade rader i den här uppdateringen: ${m.utelamnat.sparrade} spärrade och ${m.utelamnat.skyddadeUppgifter} om patienter med skyddade personuppgifter.</p></div></div>
    <section aria-labelledby="du-falt"><h2 id="du-falt">Fälten</h2>
      ${Object.entries(schema.tabeller).map(([t, s]) => `<details class="ruta"><summary>${esc(t)}</summary><dl class="faktalista">${Object.entries(s.falt).map(([f, b]) => `<div><dt><code>${esc(f)}</code></dt><dd>${esc(b)}</dd></div>`).join('')}</dl></details>`).join('')}
    </section>
    <section aria-labelledby="du-man"><h2 id="du-man">Manifestet</h2><p class="dampad liten">Samma form som när en export i FHIR Bulk Data Access är klar. Adressen är <code>/api/datauttag</code>.</p>
      <pre class="kodblock">${esc(JSON.stringify({ transactionTime: m.transactionTime, requiresAccessToken: m.requiresAccessToken, output: m.output }, null, 2))}</pre></section>`;
}
