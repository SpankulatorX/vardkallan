// Öppet API: FHIR R4 med den inloggade sessionen. Exemplen anropar API:t på riktigt och visar svaret.
import { esc, api, raa, tal, vyRubrik } from '../ui.js';
import { arLogggranskare } from '../app.js';

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
      [`/fhir/Composition?patient=${pid}`, 'Journalanteckningar'], [`/fhir/ServiceRequest?patient=${pid}`, 'Remisser'], ['/fhir/Organization', 'Vårdenheter med HSA-id'], ['/fhir/Patient/p12', 'En patient utan vårdrelation']];
  main.innerHTML = vyRubrik('Öppet API') + `<div class="ingress-block">
      <p>FHIR R4 är den internationella standarden från HL7 för att utbyta vårdinformation. Allt i Vårdkällan går att läsa genom samma öppna API som gränssnittet bygger på, i formatet application/fhir+json, med personnummer, ICD-10-SE, ATC, NPU för labbvärden och LOINC för vitalparametrar.</p>
      <p>API:t har samma behörighetskontroll och samma loggning som gränssnittet. Anropen nedan görs med din session som ${esc(arLogggranskare() ? 'logggranskare' : 'inloggad')}, så svaren visar exakt det din roll får se, och varje anrop som rör en patient hamnar i loggen. Resurserna är inte validerade mot HL7 Swedens basprofiler.</p>
    </div>
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
  main.querySelector('.api-exempel').addEventListener('click', (e) => { const b = e.target.closest('.api-knapp'); if (b) kor(b).catch(() => {}); });
  await kor(main.querySelector('.api-knapp'));
}
