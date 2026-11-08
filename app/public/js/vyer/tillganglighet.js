// Tillgänglighetsredogörelsen (Sussa 8.4.1.3): varje krav i bilaga K2 med status och hur det är testat, med testernas
// status från det senaste bygget. Sidan är öppen utan inloggning och nås från länken Tillgänglighet längst ned.
import { esc, api, vyRubrik, ikon } from '../ui.js';
import { kontrastLage } from '../kontrast.js';

export const namn = 'tillganglighet';

const IKON = { uppfyllt: ikon.bock, delvis: ikon.varning, ej: ikon.kryss, ej_tillampligt: ikon.info };
const TESTSTATUS = { grön: 'Grönt', röd: 'Rött', saknas: 'Inte kört', inaktuell: 'Inaktuellt', hoppad: 'Hoppat över' };
const statusHtml = (x) => `<span class="tg-status tg-${esc(x.status)}">${IKON[x.status] ?? ''}<span>${esc(x.statusText)}</span></span>`;

function kravHtml(x) {
  return `<details class="tg-krav">
    <summary><span class="krav-id">${esc(x.id)}</span><span class="tg-rubrik">${esc(x.rubrik)}<span class="under-text">EN 301 549 ${esc(x.en)}, nivå ${esc(x.niva)}${x.manuell ? ', kräver bedömning av en människa' : ''}</span></span>${statusHtml(x)}</summary>
    <div class="tg-innehall">
      <p>${esc(x.hur)}</p>
      ${x.anmarkning ? `<p class="dampad">${esc(x.anmarkning)}</p>` : ''}
      ${x.tester.length ? `<h3 class="tg-h">Tester</h3><ul class="testlista">${x.tester.map(t => `<li><span class="teststatus test-${t.status === 'grön' ? 'gron' : 'ej'}">${t.status === 'grön' ? ikon.bock : ikon.kryss}<span>${esc(TESTSTATUS[t.status] ?? t.status)}</span></span> ${esc(t.namn)}</li>`).join('')}</ul>` : '<p class="dampad">Inga automatiska tester. Bedömt i koden.</p>'}
    </div>
  </details>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Tillgänglighet', 'Hur Vårdkällan uppfyller kraven i bilaga K2, Tillgänglighetskrav enligt EN 301 549, och WCAG 2.1 nivå AA. Statusen kommer från testerna i det senaste bygget.') + '<div id="tg"><p class="tom">Hämtar redogörelsen.</p></div>';
  const d = await api('/api/tillganglighet');
  const s = d.summa;
  main.querySelector('#tg').innerHTML = `
    <dl class="faktarad">
      <div><dt>Uppfyllda</dt><dd>${s.uppfyllt} av ${d.krav.length}</dd></div>
      <div><dt>Delvis uppfyllda</dt><dd>${s.delvis}</dd></div>
      <div><dt>Ej uppfyllda</dt><dd>${s.ej}</dd></div>
      <div><dt>Ej tillämpliga</dt><dd>${s.ej_tillampligt}</dd></div>
    </dl>
    <section class="ruta" aria-labelledby="tg-inst">
      <h2 id="tg-inst">Inställningar</h2>
      <p>Knappen Hög kontrast högst upp på sidan ger starkare färger, tydligare ramar och understrukna länkar. Den är ${kontrastLage() ? 'på' : 'av'} nu. Systemet följer också datorns inställningar för hög kontrast och minskade rörelser, utan att du behöver välja något. Allt går att förstora till 200 procent och att använda med tangentbordet.</p>
    </section>
    <section aria-labelledby="tg-anp">
      <h2 id="tg-anp">Anpassning för funktionsnedsättningar</h2>
      <div class="tg-anpassning">${d.anpassning.map(a => `<div class="ruta"><h3>${esc(a.rubrik)}</h3><p>${esc(a.text)}</p><p class="liten">${a.allaGrona ? `${ikon.bock}<span> Testerna är gröna.</span>` : `${ikon.varning}<span> Alla tester är inte gröna.</span>`}</p></div>`).join('')}</div>
    </section>
    <section aria-labelledby="tg-k2">
      <h2 id="tg-k2">Krav i bilaga K2</h2>
      <div class="tg-lista">${d.krav.map(kravHtml).join('')}</div>
    </section>
    <section aria-labelledby="tg-wcag">
      <h2 id="tg-wcag">Krav i WCAG 2.1 utöver K2</h2>
      <div class="tg-lista">${d.tillagg.map(kravHtml).join('')}</div>
    </section>
    <p class="dampad liten">Källa: ${esc(d.kalla)} Kontrollerna är skrivna i projektet, utan en extern tillgänglighetsmotor. Ingen granskning med skärmläsare och inget test med användare med funktionsnedsättning är gjort.</p>`;
}
