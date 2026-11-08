// Tabellen över de nationella tjänstekontrakten i bilaga K10 (runda 7, r5, Sussa 2.2.1), på sidan Öppet API. En rad per
// tjänstekontrakt: vad K10 anger, vilken FHIR-resurs eller vilket API som svarar mot det i Vårdkällan och om det är
// simulerat.
import { esc, api } from './ui.js';

export async function ritaTjanstekontrakt(el) {
  const d = await api('/api/tjanstekontrakt');
  const antal = (s) => d.kontrakt.filter(k => k.status === s).length;
  const symbol = (s) => (s ? `<span title="${esc(d.symboler[s])}">${esc(s)}</span>` : '');
  el.innerHTML = `<p class="under-text">Bilaga K10 har ${d.k10Rader} rader, och GetAllCareTypes står två gånger, så här finns ${d.kontrakt.length} tjänstekontrakt.
      ${antal('simulerad_producent')} har en simulerad producent, ${antal('fhir')} har uppgifterna i FHIR-API:t, ${antal('lokal')} har funktionen i Vårdkällan utan den nationella tjänsten och ${antal('saknas')} saknas.
      Inget är anslutet till tjänsteplattformen.</p>
    <p class="under-text">Den simulerade producenten svarar på <code>POST /api/riv/</code> och kontraktets namn, till exempel <code>/api/riv/GetDiagnosis</code> med <code>{"patientId":{"id":"194502024732","type":"1.2.752.129.2.1.3.1"}}</code>. Svaret är JSON i kontraktets struktur med huvud och kropp, och behörigheten och loggningen är samma som i FHIR-API:t.</p>
    <div class="tabellrulle"><table class="tabell tk-tabell"><thead><tr><th scope="col">Tjänstekontrakt</th><th scope="col">Information</th><th scope="col">Producent i K10</th><th scope="col">Konsument i K10</th><th scope="col">Nationella tjänster</th><th scope="col">I Vårdkällan</th><th scope="col">Status</th></tr></thead>
    <tbody>${d.kontrakt.map(k => `<tr data-kontrakt="${esc(k.kontrakt)}"><th scope="row"><code>${esc(k.kontrakt)}</code><span class="under-text">${esc(k.doman)}</span></th><td>${esc(k.information)}</td>
      <td>${symbol(k.k10.producent)}</td><td>${symbol(k.k10.konsument)}</td><td>${esc(k.tjanster.join(', '))}</td><td>${esc(k.motsvarighet)}</td>
      <td><span class="tagg${k.status === 'simulerad_producent' ? ' tagg-ok' : k.status === 'saknas' ? '' : ' tagg-pagaende'}">${esc(k.statusText)}</span></td></tr>`).join('')}</tbody></table></div>
    <p class="under-text">${Object.entries(d.symboler).map(([s, t]) => `${esc(s)} ${esc(t)}`).join('. ')}.</p>`;
}
