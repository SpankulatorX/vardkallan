// Rapportering till myndigheter och register (runda 7, r5, Sussa 6.3.2): patientregistret, väntetiderna,
// Vårdtillfällesdatabasen, medicinska födelseregistret och ett demoregister för hjärtsvikt. Systemet sammanställer och
// kontrollerar varje rapport själv, och uppföljningsrollen granskar och skickar. Inga patientuppgifter visas här:
// felen saknar patient, och filerna visas bara med hur många rader som har varje fält ifyllt. Mottagarna är simulerade.
import { esc, api, vyRubrik, tidpunkt, datum, ikon, dialog, medKnapp, notis, plural } from '../ui.js';

export const namn = 'rapportering';

const kortSha = (s) => `${s.slice(0, 12)}`;

function kort(r) {
  return `<article class="ruta rapport-kort" data-rapport="${esc(r.id)}">
    <h2>${esc(r.namn)}${r.antagande ? ' <span class="tagg tagg-obs">Antaget format</span>' : ''}</h2>
    <p class="under-text">${esc(r.mottagare)}</p>
    <dl class="faktarad">
      <div><dt>Avser</dt><dd>${esc(r.period.text)}</dd></div>
      <div><dt>Senast</dt><dd>${esc(datum(r.period.sistaInlamning))}</dd></div>
      <div><dt>Rader</dt><dd>${r.antal.rader}</dd></div>
      <div><dt>Att rätta</dt><dd>${r.fel ? `<span class="tagg tagg-larm">${r.fel}</span>` : '<span class="tagg tagg-ok">Inga fel</span>'}</dd></div>
      <div><dt>Senast skickad</dt><dd>${r.senast ? esc(tidpunkt(r.senast.skickad)) : 'Inte skickad'}</dd></div>
    </dl>
    <div class="knapprad"><button type="button" class="knapp" data-granska="${esc(r.id)}">Granska</button></div>
  </article>`;
}

function detalj(d) {
  const fel = d.felLista.map(f => `<li><strong>${esc(f.enhet?.namn ?? 'Vårdgivaren')}</strong>: ${esc(f.text)}
    <span class="under-text">${esc(f.vem)} rättar.${f.iInkorgen ? ' Felet ligger i deras inkorg.' : ''}${f.lank ? ` <a href="${esc(f.lank)}">Visa mappningen</a>` : ''}</span></li>`).join('');
  const und = d.undantag.map(u => `<tr><th scope="row">${esc(u.text)}<span class="under-text">${esc(u.bestammelse)}</span></th><td class="tal">${u.antal}</td><td>${u.ingar ? 'Rapporteras' : 'Rapporteras inte'}</td></tr>`).join('');
  const filer = d.filer.map(f => `<tr><th scope="row"><code>${esc(f.namn)}</code><span class="under-text">${esc(f.rubrik)}</span></th><td class="tal">${f.antal}</td><td><code>${esc(kortSha(f.sha256))}</code></td></tr>`).join('');
  // Filernas innehåll visas inte, bara hur många rader som har varje fält ifyllt, så att inget pekar ut en patient.
  const ifyllda = d.filer.filter(f => f.antal).map(f => `<details class="ruta"><summary>${esc(f.rubrik)}, ifyllda fält</summary>
    <div class="tabellrulle"><table class="tabell siffertabell"><thead><tr><th scope="col">Fält</th><th scope="col" class="tal">Ifyllt på rader</th></tr></thead><tbody>${f.ifyllda.map(x => `<tr><td>${esc(x.falt)}</td><td class="tal">${x.ifyllda} av ${f.antal}</td></tr>`).join('')}</tbody></table></div></details>`).join('');
  const skickaText = d.fel ? `Skicka ${plural(d.antal.kontakter - d.kvarhallna, 'kontakt', 'kontakter')}` : 'Skicka';
  return `<section class="rapport-detalj" aria-labelledby="rd-rubrik">
    <h2 id="rd-rubrik">${esc(d.namn)}, ${esc(d.period.text)}</h2>
    <p>${esc(d.bestammelse)} ${esc(d.frekvens)}</p>
    ${d.kalla ? `<p class="under-text">Format: <a href="${esc(d.kalla.url)}" rel="noopener" target="_blank">${esc(d.kalla.namn)}</a>. ${esc(d.kalla.version)}</p>` : ''}
    <div class="ruta ruta-info">${ikon.info}<div><p>Systemet har sammanställt rapporten ur det som är registrerat och kontrollerat den mot filspecifikationen. ${d.format.ok ? 'Alla filer följer formatet.' : esc(d.format.fel.join(' '))}</p>
      <p>${plural(d.antal.patienter, 'patient', 'patienter')} och ${plural(d.antal.rader, 'rad', 'rader')} i filerna.${d.kvarhallna ? ` ${plural(d.kvarhallna, 'kontakt hålls', 'kontakter hålls')} kvar tills felet är rättat och kommer med av sig själv i nästa rapport.` : ''}</p></div></div>
    <h3>Att rätta</h3>${fel ? `<ul class="rapport-fel">${fel}</ul>` : '<p class="tom">Inga fel. Allt kan skickas.</p>'}
    ${d.varningLista.length ? `<h3>Att känna till</h3><ul class="rapport-varn">${d.varningLista.map(v => `<li>${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${und ? `<h3>Det som inte rapporteras eller rapporteras trots ett skydd</h3><div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Vad</th><th scope="col" class="tal">Antal</th><th scope="col">Rapporteras</th></tr></thead><tbody>${und}</tbody></table></div>` : ''}
    <h3>Filerna</h3><div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Fil</th><th scope="col" class="tal">Rader</th><th scope="col">SHA-256</th></tr></thead><tbody>${filer}</tbody></table></div>
    ${ifyllda}
    <div class="knapprad"><button type="button" class="knapp" data-skicka="${esc(d.id)}">${esc(skickaText)} till ${esc(d.kortnamn === 'Kvalitetsregister' ? 'kvalitetsregistret' : d.namn.toLowerCase())}</button></div>
  </section>`;
}

async function ritaHistorik(el) {
  const [h, a] = await Promise.all([api('/api/rapportering/historik'), api('/api/rapportering/aterkoppling')]);
  el.querySelector('#rap-historik').innerHTML = h.skickade.length
    ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Rapport</th><th scope="col">Period</th><th scope="col">Skickad</th><th scope="col" class="tal">Rader</th><th scope="col">Kvittens</th></tr></thead><tbody>${h.skickade.map(s => `<tr><td>${esc(s.mottagare)}</td><td>${esc(s.period.replace('/', ' till '))}</td><td>${esc(tidpunkt(s.skickad))}</td><td class="tal">${s.antal.rader}</td><td><code>${esc(s.kvittens.id)}</code></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="tom">Inget har skickats än.</p>';
  el.querySelector('#rap-aterkoppling').innerHTML = a.aterkoppling
    ? `<p>${esc(a.aterkoppling.text)} Mottagen ${esc(tidpunkt(a.aterkoppling.tid))}.</p><div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Vårdenhet</th><th scope="col" class="tal">Patienter</th><th scope="col" class="tal">RAS-hämmare</th><th scope="col" class="tal">Betablockerare</th></tr></thead><tbody>${a.aterkoppling.enheter.map(e => `<tr><td>${esc(e.namn)}</td><td class="tal">${e.antal}</td><td class="tal">${e.andelRas} procent</td><td class="tal">${e.andelBb} procent</td></tr>`).join('')}<tr><td>Jämförelse (påhittad)</td><td></td><td class="tal">${a.aterkoppling.jamforelse.ras} procent</td><td class="tal">${a.aterkoppling.jamforelse.bb} procent</td></tr></tbody></table></div>`
    : '<p class="tom">Ingen återkoppling än. Den kommer när rapporten till kvalitetsregistret har skickats.</p>';
}

async function ritaMappning(el) {
  const m = await api('/api/rapportering/mappning');
  el.innerHTML = `<p class="under-text">Varje vårdenhet med sjukhuskod och medicinskt verksamhetsområde ur Socialstyrelsens förteckningar. Vårdenheternas HSA-id är påhittade i demon.</p>
    <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Vårdenhet</th><th scope="col">Sjukhus</th><th scope="col">Verksamhetsområde</th><th scope="col">Akutverksamhet</th></tr></thead><tbody>${m.enheter.map(e => `<tr><td>${esc(e.namn)}</td><td>${e.primarvard ? 'Primärvård, rapporteras inte till patientregistret' : esc(e.sjukhus ?? 'Saknas')}</td><td>${esc(e.mvo ?? '')} ${esc(e.mvoText ?? '')}</td><td>${esc(e.akutverksamhet ?? '')}</td></tr>`).join('')}</tbody></table></div>
    <h3>Källor</h3><ul>${m.kallor.map(k => `<li><a href="${esc(k.url)}" rel="noopener" target="_blank">${esc(k.namn)}</a>. ${esc(k.version)}</li>`).join('')}</ul>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Rapportering', 'Systemet sammanställer rapporterna till myndigheter och register ur det som redan är registrerat och kontrollerar dem innan de skickas. Mottagarna är simulerade, och inget lämnar Vårdkällan.')
    + '<div id="rap"><p class="tom">Sammanställer rapporterna.</p></div>';
  const d = await api('/api/rapportering');
  const el = main.querySelector('#rap');
  if (!el) return;
  el.innerHTML = `<div class="rapport-lista">${d.rapporter.map(kort).join('')}</div>
    <div id="rap-detalj" aria-live="polite"></div>
    <section aria-labelledby="rap-h"><h2 id="rap-h">Skickade rapporter</h2><div id="rap-historik"></div></section>
    <section aria-labelledby="rap-a"><h2 id="rap-a">Återkoppling från kvalitetsregistret</h2><div id="rap-aterkoppling"></div></section>
    <details class="ruta" id="rap-mappning"${location.hash.includes('visa=mappning') ? ' open' : ''}><summary>Mappning och källor</summary><div id="rap-mappning-innehall"><p class="tom">Öppna för att se mappningen.</p></div></details>`;
  ritaHistorik(el).catch(() => {});
  const mapp = el.querySelector('#rap-mappning');
  const visaMappning = () => ritaMappning(el.querySelector('#rap-mappning-innehall')).catch(() => {});
  if (mapp.open) visaMappning();
  mapp.addEventListener('toggle', () => { if (mapp.open) visaMappning(); });

  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-granska]');
    if (g) {
      const r = await medKnapp(g, () => api(`/api/rapportering/${encodeURIComponent(g.dataset.granska)}`));
      const ruta = el.querySelector('#rap-detalj');
      ruta.innerHTML = detalj(r);
      ruta.querySelector('h2').scrollIntoView({ block: 'start' });
      return;
    }
    const s = e.target.closest('[data-skicka]');
    if (!s) return;
    const svar = await dialog(`<form><h2 id="dlg-rubrik">Skicka rapporten</h2>
      <p>${esc(s.textContent)}. Systemet skickar filerna till den simulerade mottagaren och loggar varje patient i åtkomstloggen, så att patienten ser det i Min journal.</p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
    { onOpen: (dl) => dl.querySelector('[data-varde="ok"]').focus() });
    if (!svar) return;
    try {
      const ut = await medKnapp(s, () => api(`/api/rapportering/${encodeURIComponent(s.dataset.skicka)}/skicka`, { metod: 'POST', data: {} }));
      notis(`Rapporten är skickad till den simulerade mottagaren. Kvittens ${ut.kvittens.id}.`);
      await visa(main);
    } catch { /* felet visas som notis */ }
  });
}
