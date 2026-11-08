// Runda 10, r5: kunskapsstödet och det kunskapsgenererande stödet i gränssnittet (Sussa 3.2.1 och 3.5.1.5). Texterna
// kommer från servern, som också avgör vad som visas. Här finns bara hur de ritas.
import { esc } from './ui.js';

const STATUS = { klar: 'Klart', pagar: 'Pågår', kvar: 'Kvar' };

// Vårdförloppet i en vårdplan: stegen med status, nästa steg och källan.
export function vardforloppHtml(f, { oppen = false } = {}) {
  if (!f) return '';
  return `<section class="kunskap vardforlopp" aria-label="${esc(f.rubrik)}">
    <p class="kunskap-nasta"><strong>${esc(f.nasta.text)}</strong></p>
    <details${oppen ? ' open' : ''}><summary>${esc(f.rubrik)}</summary>
      <p>${esc(f.sammanfattning)}</p>
      <ol class="vf-steg">${f.steg.map(s => `<li class="vf-${esc(s.status)}"><span class="tagg">${esc(STATUS[s.status] ?? s.status)}</span> <strong>${esc(s.rubrik)}</strong><span class="under-text">${esc(s.text)}</span></li>`).join('')}</ol>
      <p class="demoregel">Källa: ${esc(f.kalla)}. ${esc(f.demomarkning)}</p>
    </details>
  </section>`;
}

// Vårdenhetens utfall (det kunskapsgenererande stödet).
export function utfallHtml(u) {
  if (!u) return '';
  return `<p class="kunskap-utfall"><span class="tagg">Erfarenhet på vårdenheten</span> ${esc(u.text)}<span class="demoregel">${esc(u.demomarkning)}</span></p>`;
}

// En varning med varför, vad användaren kan göra, källan och hur ofta varningen har kvitterats.
export function varningHtml(v) {
  const k = v.kunskap;
  return `<li><strong>${v.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(v.text)}${k ? `
    <span class="under-text"><strong>Varför:</strong> ${esc(k.varfor)}</span>${k.vadGora ? `<span class="under-text"><strong>Vad du kan göra:</strong> ${esc(k.vadGora)}</span>` : ''}
    <span class="under-text demoregel">Källa: ${esc(k.kalla)}</span>` : ''}${v.utfall ? `<span class="under-text">${esc(v.utfall.text)}</span>` : ''}</li>`;
}

// Läkemedelsinformationen för patienten.
export function lakemedelsinfoHtml(i) {
  const nj = i.njurfunktion;
  return `<section class="kunskap lm-kunskap" aria-label="Om ${esc(i.lakemedel.namn)}">
    <h4>Om ${esc(i.lakemedel.namn)} <span class="dampad">${esc(i.lakemedel.substans)}, ${esc(i.lakemedel.atc)}</span></h4>
    <p>${esc(i.egenskaper)}</p>
    ${i.dosering ? `<p><strong>Dosering:</strong> ${esc(i.dosering)}</p>` : ''}
    <p class="${nj.niva === 'allvarlig' ? 'kunskap-allvarlig' : nj.niva ? 'kunskap-observera' : ''}"><strong>Njurfunktion:</strong> ${esc(nj.patient)}${nj.text ? ` ${esc(nj.text)}` : ''}</p>
    ${i.aldre.olamplig ? `<p class="${i.aldre.patient ? 'kunskap-observera' : ''}"><strong>Äldre:</strong> ${esc(i.aldre.patient ?? i.aldre.text)}</p>` : ''}
    ${i.utfall ? utfallHtml(i.utfall) : ''}
    <p class="demoregel">Källa: ${esc(i.kalla)}. ${esc(i.simulerad)} ${esc(i.demomarkning)}</p>
  </section>`;
}
