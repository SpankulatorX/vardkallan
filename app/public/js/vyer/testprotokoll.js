// Runda 14, r4 (Sussa 11.2.1.7): testprotokollet med spårbarhet från varje krav till dess testfall, med resultat, tid
// och den byggda versionen. Sidan är öppen utan inloggning, som kravsidan, och är gjord för att skrivas ut och lämnas
// till en beställare inför acceptanstest. Allt räknas av servern ur kravregistren och testresultaten (testprotokoll.js).
import { esc, api, vyRubrik, ikon, tidpunkt } from '../ui.js';

export const namn = 'testprotokoll';

const KLASS = { 'grön': 'ok', 'röd': 'fel', saknas: 'fel', inaktuell: 'hoppad', hoppad: 'hoppad' };
const KRAVSTATUS = { uppfyllt_demo: 'Uppfyllt i demon', delvis: 'Delvis', planerat: 'Planerat' };
const tid = (iso) => (iso ? tidpunkt(iso) : 'Inte kört');

function kravHtml(k, register) {
  const hid = `tp-${register}-${k.id.replace(/[^\w]/g, '-')}`;
  return `<section class="tpr-krav tpr-${esc(k.resultat)}" aria-labelledby="${hid}">
    <h3 id="${hid}"><span class="krav-id">${esc(k.id)}</span> ${esc(k.rubrik)}</h3>
    <p class="tpr-krav-status">${k.resultat === 'godkant' ? ikon.bock : ikon.varning}<span>${esc(k.resultatText)}. Status i registret: ${esc(KRAVSTATUS[k.kravstatus] ?? k.kravstatus)}.</span></p>
    <div class="tabellrulle"><table class="tabell tpr-tabell"><caption class="sr">Testfall för ${esc(k.id)}</caption>
      <thead><tr><th scope="col">Testfall</th><th scope="col">Resultat</th><th scope="col">Körning och tid</th></tr></thead>
      <tbody>${k.testfall.map(t => `<tr><td class="tpr-namn">${esc(t.namn)}</td><td><span class="tpr-resultat tpr-${KLASS[t.status] ?? 'hoppad'}">${esc(t.statusText)}</span></td><td>${esc(t.kalla ?? 'Inte kört')}<br><span class="dampad">${esc(tid(t.tid))}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Testprotokoll', 'Spårbarheten från varje krav till dess testfall, med resultatet från det senaste bygget. Protokollet är underlaget inför ett acceptanstest och kan skrivas ut.') + '<div id="tp"><p class="tom">Hämtar protokollet.</p></div>';
  const p = await api('/api/krav/testprotokoll');
  const v = p.version;
  const s = p.summa;
  main.querySelector('#tp').innerHTML = `
    <p class="knapprad"><button type="button" class="knapp" id="tp-skriv-ut">Skriv ut protokollet</button> <a href="#/krav">Till kravspårbarheten</a></p>
    <section class="ruta ruta-info" id="tp-acceptanstest" aria-labelledby="tp-acc-rubrik"><h2 id="tp-acc-rubrik">Acceptanstest</h2><p>${esc(p.acceptanstest.text)}</p></section>
    <dl class="faktarad" id="tp-version">
      <div><dt>Version</dt><dd>Version ${esc(v.app ?? 'okänd')}</dd></div>
      <div><dt>Kod</dt><dd><code>${esc(v.kort ?? 'okänd')}</code></dd></div>
      <div><dt>Servertesterna kördes</dt><dd>${esc(tid(v.testkorning))}</dd></div>
      <div><dt>Krav med testfall</dt><dd>${s.krav}, varav ${s.godkanda} godkända</dd></div>
      <div><dt>Testfall</dt><dd>${s.testfall}, varav ${s.status['grön'] ?? 0} godkända</dd></div>
    </dl>
    <p class="dampad liten">Koden anges som de första tecknen av en sha256 över serverns och gränssnittets källkod (${esc(v.kodhash ?? 'okänd')}). Resultaten gäller den kod som körs här.</p>
    <section aria-labelledby="tp-korningar"><h2 id="tp-korningar">Körningar</h2>
      <div class="tabellrulle"><table class="tabell tpr-tabell"><caption class="sr">Körningarna som resultaten kommer från</caption>
        <thead><tr><th scope="col">Körning</th><th scope="col">Tid</th><th scope="col">Testfall</th><th scope="col">Godkända</th></tr></thead>
        <tbody>${p.korningar.map(k => `<tr><td>${esc(k.kalla)}</td><td>${esc(tid(k.tid))}</td><td>${k.antal}</td><td>${k.godkanda}</td></tr>`).join('') || '<tr><td colspan="4">Inga testresultat finns i bygget.</td></tr>'}</tbody>
      </table></div>
    </section>
    <section id="tp-egna" aria-labelledby="tp-egna-rubrik"><h2 id="tp-egna-rubrik">Eget ramverk</h2>${p.egna.map(k => kravHtml(k, 'egna')).join('')}</section>
    <section id="tp-sussa" aria-labelledby="tp-sussa-rubrik"><h2 id="tp-sussa-rubrik">Sussas kravspecifikation</h2>${p.sussa.map(k => kravHtml(k, 'sussa')).join('')}</section>
    <section id="tp-utan" aria-labelledby="tp-utan-rubrik"><h2 id="tp-utan-rubrik">Krav utan testfall</h2>
      <p>Eget ramverk: ${esc(p.utanTestfall.egna.map(k => k.id).join(', ') || 'inga')}.</p>
      <p>Sussas kravspecifikation, ${p.utanTestfall.sussa.length} poster: ${esc(p.utanTestfall.sussa.map(k => k.id).join(', ') || 'inga')}.</p>
    </section>`;
  main.querySelector('#tp-skriv-ut').addEventListener('click', () => window.print());
}
