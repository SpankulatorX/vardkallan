// Öppet API: FHIR R4 med den inloggade sessionen. Exemplen anropar API:t på riktigt och visar svaret.
import { esc, api, raa, tal, vyRubrik } from '../ui.js';
import { arLogggranskare } from '../app.js';
// Runda 7, r5: tabellen över tjänstekontrakten i K10.
import { ritaTjanstekontrakt } from '../tjanstekontrakt.js';
// Runda 9, r6: ändringsloggen, utvecklarna och förvaltningen av API:t.
import { ritaAndringslogg, utvecklare, ritaForvaltning } from '../oppet-api-forvaltning.js';

export const namn = 'oppet-api';

export async function visa(main) {
  let pid = 'p01';
  let pnamn = 'Gunnar Åkesson';
  if (!arLogggranskare()) {
    try {
      const lista = await api('/api/arbetslista');
      const forsta = lista.find(p => !p.skyddad);
      if (forsta) { pid = forsta.id; pnamn = forsta.namn; }
    } catch { /* standardpatienten används */ }
  }
  const exempel = arLogggranskare()
    ? [['/fhir/metadata', 'Vad servern kan (CapabilityStatement)'], [`/fhir/AuditEvent?patient=${pid}`, `Åtkomstloggen för ${pnamn} som AuditEvent`], ['/fhir/Practitioner', 'All personal'], [`/fhir/Patient/${pid}`, 'Läsa en journal, vilket logggranskaren inte får']]
    : [['/fhir/metadata', 'Vad servern kan (CapabilityStatement)'], [`/fhir/Patient/${pid}`, `Patienten ${pnamn}`], [`/fhir/MedicationRequest?patient=${pid}`, 'Läkemedelsordinationer med ATC och uppföljningsdatum'],
      [`/fhir/Condition?patient=${pid}`, 'Diagnoser med ICD-10-SE'], [`/fhir/Observation?patient=${pid}`, 'Mätvärden med NPU och LOINC'], [`/fhir/AllergyIntolerance?patient=${pid}`, 'Överkänslighet'],
      [`/fhir/Flag?patient=${pid}`, 'Övrig uppmärksamhetsinformation (behandling, smitta och särskild vårdrutin)'],
      [`/fhir/Composition?patient=${pid}`, 'Journalanteckningar'], [`/fhir/ServiceRequest?patient=${pid}`, 'Remisser'], ['/fhir/Organization', 'Vårdenheter med HSA-id'], ['/fhir/Patient/p12', 'En patient utan vårdrelation'],
      // Runda 6, r5: SMART on FHIR och prenumerationer.
      ['/fhir/.well-known/smart-configuration', 'SMART on FHIR: hur externa tillämpningar ansluter'], ['/fhir/Subscription', 'Dina prenumerationer']];
  main.innerHTML = vyRubrik('Öppet API') + `<div class="ingress-block">
      <p>FHIR R4 är den internationella standarden från HL7 för att utbyta vårdinformation. Allt i Vårdkällan går att läsa genom samma öppna API som gränssnittet bygger på, i formatet application/fhir+json, med personnummer, ICD-10-SE, ATC, NPU för labbvärden och LOINC för vitalparametrar.</p>
      <p>API:t har samma behörighetskontroll och samma loggning som gränssnittet. Anropen nedan görs med din session som ${esc(arLogggranskare() ? 'logggranskare' : 'inloggad')}, så svaren visar exakt det din roll får se, och varje anrop som rör en patient hamnar i loggen.</p>
      <p>Mätvärden, anteckningar, ordinationer och remisser kan också skapas och ändras via API:t, genom samma funktioner och med samma varningar som i gränssnittet. Externa tillämpningar ansluter med SMART on FHIR och får aldrig mer än den inloggade, och prenumerationer meddelar bara id till adresser som administratören har godkänt.</p>
    </div>
    <section class="api-tackning" aria-labelledby="api-tackning-rubrik"><h2 id="api-tackning-rubrik">Vad går att göra via API:t?</h2><p class="under-text">Varje vanligt flöde i gränssnittet, och om det går att göra via det öppna API:t.</p><div id="api-tackning"></div></section>
    <section class="api-tackning" aria-labelledby="tk-rubrik"><h2 id="tk-rubrik">Nationella tjänstekontrakt</h2><div id="tk"><p class="tom">Hämtar tjänstekontrakten.</p></div></section>
    <section class="api-tackning" aria-labelledby="api-andr-rubrik"><h2 id="api-andr-rubrik">Ändringslogg</h2><div id="api-andringar"><p class="tom">Hämtar ändringsloggen.</p></div></section>
    <section class="api-tackning" aria-labelledby="api-utv-rubrik"><h2 id="api-utv-rubrik">För utvecklare</h2>${utvecklare()}</section>
    <section class="api-tackning" aria-labelledby="api-forv-rubrik"><h2 id="api-forv-rubrik">Ärenden, tillämpningar och mottagare</h2><div id="api-forvaltning"><p class="tom">Hämtar.</p></div></section>
    <section class="api-tackning" aria-labelledby="mt-format-rubrik"><h2 id="mt-format-rubrik">Medicinteknisk utrustning</h2><div id="mt-format"><p class="tom">Hämtar formaten.</p></div></section>
    <div class="api-delad">
      <ul class="api-exempel" aria-label="Exempel på anrop">${exempel.map(([v, t], i) => `<li><button type="button" class="api-knapp" data-vag="${esc(v)}"${i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"'}><code>GET ${esc(v)}</code><span>${esc(t)}</span></button></li>`).join('')}</ul>
      <section class="api-svar" aria-labelledby="api-svar-rubrik" aria-live="polite">
        <h2 id="api-svar-rubrik">Svar</h2><p class="api-status" id="api-status">Välj ett anrop.</p>
        <pre class="json" id="api-json" tabindex="0" aria-label="JSON-svaret"></pre>
      </section>
    </div>`;
  const kor = async (b) => {
    main.querySelectorAll('.api-knapp').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const vag = b.dataset.vag;
    const st = main.querySelector('#api-status');
    st.textContent = `Hämtar ${vag}.`;
    const r = await raa(vag);
    let text = r.text;
    try { text = JSON.stringify(JSON.parse(r.text), null, 2); } catch { /* visa som text */ }
    st.innerHTML = `<span class="http http-${r.status < 300 ? 'ok' : 'fel'}">HTTP ${r.status}</span> <code>${esc(r.typ ?? '')}</code>${r.server != null ? ` <span class="dampad">Serverns tid ${tal(r.server, 1)} ms</span>` : ''}`;
    main.querySelector('#api-json').textContent = text;
  };
  // Runda 6, r5: täckningen av klickbudgetens flöden (Sussa 2.5.1.3).
  api('/api/oppet-api/tackning').then((d) => {
    const STATUS = { ja: 'Ja', delvis: 'Delvis', nej: 'Nej', inte_bedomt: 'Inte bedömt' };
    main.querySelector('#api-tackning').innerHTML = `<table class="tabell"><thead><tr><th scope="col">Flöde</th><th scope="col">Via API:t</th><th scope="col">Hur, eller vad som saknas</th></tr></thead><tbody>${d.floden.map(f => `<tr><td>${esc(f.namn)}</td><td>${esc(STATUS[f.status] ?? f.status)}</td><td>${esc(f.text)}${f.anrop.length ? `<br><code>${f.anrop.map(esc).join('</code>, <code>')}</code>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }).catch(() => {});
  // Runda 7, r5.
  ritaTjanstekontrakt(main.querySelector('#tk')).catch(() => {});
  // Runda 9, r6.
  ritaAndringslogg(main.querySelector('#api-andringar')).catch(() => {});
  ritaForvaltning(main.querySelector('#api-forvaltning')).catch(() => {});
  // Runda 9, r2: formaten och profilerna för medicinteknisk utrustning (Sussa 3.6.1.4).
  fetch('/mt/format').then(r => r.json()).then((d) => {
    const el = main.querySelector('#mt-format');
    if (!el) return;
    el.innerHTML = `<p class="under-text">Patientmonitorer och infusionspumpar skickar till Vårdkällan med en egen nyckel för varje utrustning (Authorization: Bearer). Värdena tas bara emot när utrustningen är kopplad till en patient. ${esc(d.demo)}</p>
      <div class="tabellrulle"><table class="tabell mt-format"><thead><tr><th scope="col">Format</th><th scope="col">Adress</th><th scope="col">Innehåll och profil</th></tr></thead><tbody>${Object.values(d.format).map(f => `<tr><td>${esc(f.namn)}</td><td><code>POST ${esc(f.adress)}</code><br><span class="under-text">${esc(f.innehall)}</span></td><td>${esc(f.text)} ${esc(f.profil)}</td></tr>`).join('')}</tbody></table></div>
      <p class="under-text">Högst ${esc(d.tak.perMinut)} meddelanden per minut och ${esc(d.tak.varden)} värden per meddelande för varje utrustning.</p>`;
  }).catch(() => {});
  main.querySelector('.api-exempel').addEventListener('click', (e) => { const b = e.target.closest('.api-knapp'); if (b) kor(b).catch(() => {}); });
  await kor(main.querySelector('.api-knapp'));
}
