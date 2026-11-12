// Tillväxt och barnhälsovård (Sussa 4.1, runda 7, r6): registrering av vikt, längd och huvudomfång vid besöket,
// kurvor med WHO:s referenslinjer, systemets larm med nästa steg, förändringen under en vald period, födelseuppgifter
// och målängd, mätningar hemma som väntar på bekräftelse, och barnhälsovårdens program med bokning och vaccinationer.
import { esc, api, datum, tidpunkt, notis, medKnapp, tal, ikon, dialog } from '../ui.js';
import { doldaRad } from './patient.js';
// Runda 13, r4: kontrollen före vaccinationen och dosens uppgifter, samma som i fliken Vaccinationer.
import { dosFaltHtml, provaDosFalt, dosData } from '../vaccination-ui.js';
import { kurvaSvg, teckenforklaring, tabell, zText, alderText } from '../tillvaxt-kurva.js';

const ALLVAR = { hog: 'ruta-larm', varning: 'ruta-larm', info: 'ruta-info' };
const SPANN = [['barn', 'Barnets ålder'], ['12', 'Första året'], ['24', 'Två år'], ['60', 'Fem år']];
const STATUS = { genomfort: 'Gjort', bokat: 'Bokat', nu: 'Ska göras nu', missat: 'Inte gjort', kommande: 'Kommande' };
let valtSpann = 'barn';
// Runda 11, r7: längre ålderspann för större barn, val av referens och val av vilka mått som visas (bara i webbläsaren).
const SPANN_STORA = [['120', 'Tio år'], ['228', '19 år']];
let valdReferens = 'auto';
const DOLDA_NYCKEL = 'vk-tillvaxt-dolda-matt';
const doldaMatt = () => { try { return new Set(JSON.parse(localStorage.getItem(DOLDA_NYCKEL) ?? '[]')); } catch { return new Set(); } };
const sparaDolda = (s) => { try { localStorage.setItem(DOLDA_NYCKEL, JSON.stringify([...s])); } catch { /* bara bekvämlighet */ } };

export async function visa(el, ctx) {
  const q = ctx.q ?? new URLSearchParams();
  const fran = q.get('fran') ?? '';
  const till = q.get('till') ?? '';
  const fraga = new URLSearchParams();
  if (fran) fraga.set('fran', fran);
  if (till) fraga.set('till', till);
  if (valdReferens !== 'auto') fraga.set('referens', valdReferens);
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tillvaxt${fraga.toString() ? `?${fraga}` : ''}`);
  if (!ctx.aktuell()) return;
  const b = d.barn;
  const bhv = d.bhv;
  const tillManader = valtSpann === 'barn' ? null : Number(valtSpann);
  el.innerHTML = `<div class="flikhuvud"><h2>Tillväxt</h2><p class="dampad">${esc(b.alderText)}${b.korrigerad ? `. ${esc(b.korrigerad.text)}` : ''}</p></div>${doldaRad(d.dolda)}
    ${d.larm.map(l => `<div class="ruta ${ALLVAR[l.allvar]} tv-larm" data-tv-larm="${esc(l.regel)}">${ikon.larm}<div><p><strong>${esc(l.rubrik)}.</strong> ${esc(l.text)}</p><p>${esc(l.nastaSteg)}</p>
      ${l.atgard === 'lakarbesok' && d.kan.boka && bhv?.egenEnhet ? `<button type="button" class="knapp liten" data-lakarbesok="${l.matt === 'huvudomfang' ? 'snart' : ''}" data-orsak="${esc(l.rubrik)}">Sätt upp besök hos BVC-läkaren</button>` : ''}
      <p class="under-text">${esc(l.demoregel)}</p></div></div>`).join('')}
    ${d.kan.registrera ? registrering(bhv, b) : ''}
    ${d.hemmatningar.length ? `<section aria-labelledby="tv-hemma"><h3 id="tv-hemma">Mätningar hemma som väntar</h3><ul class="enkel-lista">${d.hemmatningar.map(h => `<li class="tv-hemma-rad"><span><strong>${esc(h.namn)} ${esc(tal(h.varde, h.typ === 'vikt' ? 2 : 1))} ${esc(h.enhet)}</strong><span class="under-text">Mätt ${esc(tidpunkt(h.tid))} av ${esc(h.av)}.</span></span>
      ${d.kan.registrera ? `<span class="knapprad"><button type="button" class="knapp liten" data-bekrafta="${h.id}">Bekräfta</button><button type="button" class="knapp liten sekundar" data-avvisa="${h.id}">Använd inte</button></span>` : ''}</li>`).join('')}</ul></section>` : ''}
    <section aria-labelledby="tv-kurvor"><div class="sektion-huvud"><h3 id="tv-kurvor">Kurvor</h3>
      <fieldset class="segment tv-spann"><legend class="sr">Visa ålder</legend>${[...SPANN, ...(b.alderManader > 60 ? SPANN_STORA : [])].map(([v, t]) => `<input type="radio" id="tv-spann-${v}" name="tv-spann" value="${v}"${v === valtSpann ? ' checked' : ''}><label for="tv-spann-${v}">${esc(t)}</label>`).join('')}</fieldset></div>
      ${valHtml(d)}
      <p class="under-text">${esc(d.referens.text)} ${esc(d.referens.kalla)}. Licens: ${esc(d.referens.licens)}</p>
      ${b.inomReferens ? '' : '<p class="ruta ruta-info">Barnets ålder ligger utanför den valda referensen, så kurvorna visas utan referenslinjer. Välj WHO efter barnets ålder för att se linjerna.</p>'}
      ${teckenforklaring()}
      <div class="kurvor tv-kurvor">${d.kurvor.map(k => `<article class="kurvkort" id="tv-kurva-${esc(k.matt)}" aria-labelledby="tv-k-${esc(k.matt)}"${doldaMatt().has(k.matt) ? ' hidden' : ''}>
        <header><h4 id="tv-k-${esc(k.matt)}">${esc(k.namn)}${k.harledd ? ' <span class="tagg">Räknas av systemet</span>' : ''}</h4>${k.senaste ? `<p class="kurva-senaste">${esc(tal(k.senaste.varde, k.matt === 'vikt' ? 2 : 1))} <span class="enhet">${esc(k.enhet)}</span></p>` : ''}</header>
        ${k.senaste ? `<p class="under-text">${esc(zText(k.senaste.z))}${k.senaste.percentil ? `, percentil ${k.senaste.percentil}` : ''}, ${esc(alderText(k.senaste.alder))}</p>` : '<p class="tom liten">Inga värden.</p>'}
        ${kurvaSvg(k, { handelser: d.handelser, till: tillManader })}
        ${tabell(k)}
      </article>`).join('')}</div>
      ${d.handelser.length ? `<ol class="tv-handelser" aria-label="Händelser på kurvorna">${d.handelser.map(h => `<li>${esc(datum(h.tid))}: ${esc(h.text)}</li>`).join('')}</ol>` : ''}
      ${d.kan.registrera ? `<details class="tv-ny-handelse"><summary>Lägg till en händelse på kurvan</summary><form id="tv-handelse" class="falt-rad" novalidate>
        <div class="falt"><label for="tv-h-text">Vad hände</label><input id="tv-h-text" name="text" maxlength="120" autocomplete="off"></div>
        <div class="falt smal"><label for="tv-h-datum">Datum</label><input id="tv-h-datum" name="datum" type="date"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Lägg till</button></div><p class="form-fel" role="alert" hidden></p></form></details>` : ''}
    </section>
    <section aria-labelledby="tv-analys"><h3 id="tv-analys">Förändring under perioden</h3>
      <form id="tv-period" class="falt-rad" novalidate>
        <div class="falt smal"><label for="tv-fran">Från</label><input id="tv-fran" name="fran" type="date" value="${esc(fran)}"></div>
        <div class="falt smal"><label for="tv-till">Till</label><input id="tv-till" name="till" type="date" value="${esc(till)}"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Räkna</button></div>
      </form>
      <ul class="enkel-lista">${d.analys.map(a => `<li><strong>${esc(a.namn)}</strong><span class="under-text">${esc(a.text)}</span></li>`).join('')}</ul>
      <p class="under-text">Tomma fält betyder hela tiden sedan födelsen.</p>
    </section>
    ${pubertetHtml(d)}
    ${importHtml(d)}
    ${fodselHtml(d)}
    ${bhv?.program ? programHtml(d, bhv) : bhv?.inskriven === false ? '<p class="tom">Barnet är inte inskrivet i barnhälsovården i Vårdkällan.</p>' : ''}`;

  koppla(el, ctx, d);
  // Formuläret vid besöket: vikten har fokus, så att mätningen kan skrivas direkt.
  if (d.kan.registrera && b.inomReferens) el.querySelector('#tv-vikt')?.focus({ preventScroll: true });
}

// Runda 11, r7: referensen och måtten som visas. Referenserna som inte får användas fritt står med skälet.
function valHtml(d) {
  const dolda = doldaMatt();
  return `<div class="tv-val">
    <div class="falt"><label for="tv-referens">Referens</label><select id="tv-referens">${d.referenser.map(r => `<option value="${esc(r.id)}"${r.id === (d.referens.vald ?? 'auto') ? ' selected' : ''}>${esc(r.namn)}</option>`).join('')}${d.ejTillgangliga.map(r => `<option value="" disabled>${esc(r.namn)}, finns inte</option>`).join('')}</select></div>
    <fieldset class="kryssgrupp"><legend>Mått som visas</legend>${d.kurvor.map(k => `<div class="kryssfalt"><input type="checkbox" id="tv-visa-${esc(k.matt)}" data-tv-visa="${esc(k.matt)}"${dolda.has(k.matt) ? '' : ' checked'}><label for="tv-visa-${esc(k.matt)}">${esc(k.namn)}</label></div>`).join('')}</fieldset>
  </div>
  <details class="tv-ej-referens"><summary>Referenser som inte finns i Vårdkällan</summary><ul class="enkel-lista">${d.ejTillgangliga.map(r => `<li><strong>${esc(r.namn)}</strong><span class="under-text">${esc(r.skal)}</span></li>`).join('')}</ul></details>`;
}

// Runda 11, r7: pubertet enligt Tanners stadier. Bara de mått som gäller barnets kön visas.
function pubertetHtml(d) {
  const p = d.pubertet;
  if (!p?.visas) return '';
  const sel = (id, namn) => `<div class="falt smal"><label for="tv-pb-${id}">${esc(namn)}</label><select id="tv-pb-${id}" name="${id}"><option value="">Inte bedömt</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join('')}</select></div>`;
  return `<section aria-labelledby="tv-pubertet"><h3 id="tv-pubertet">Pubertet</h3>
    ${p.bedomning ? `<div class="ruta ruta-larm">${ikon.varning}<div><p>${esc(p.bedomning.text)}</p><p>${esc(p.bedomning.nastaSteg)}</p><p class="under-text">${esc(p.bedomning.demoregel)}</p></div></div>` : ''}
    <p>${p.start ? esc(p.start.text) : 'Puberteten har inte börjat enligt registreringarna.'}</p>
    ${p.poster.length ? `<div class="tabellrulle"><table class="tabell"><caption class="sr">Registrerade pubertetsstadier</caption><thead><tr><th scope="col">Datum</th><th scope="col">Ålder</th><th scope="col">Stadier</th><th scope="col">Registrerat av</th></tr></thead>
      <tbody>${p.poster.map(x => `<tr><td>${esc(datum(x.tid))}</td><td>${esc(tal(x.alderAr, 1))} år</td><td>${esc(x.text)}</td><td>${esc(x.av ?? '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${d.kan.registrera ? `<details><summary>Registrera pubertetsstadium</summary><form id="tv-pubertet-form" novalidate><div class="falt-rad">
      ${p.matt.map(m => sel(m.id, m.namn)).join('')}
      ${p.testikelvolym ? '<div class="falt smal"><label for="tv-pb-testikel">Testikelvolym</label><div class="med-enhet"><input id="tv-pb-testikel" name="testikelvolym" inputmode="decimal" autocomplete="off"><span class="enhet">ml</span></div></div>' : ''}
      ${p.menarke ? '<div class="falt smal"><label for="tv-pb-menarke">Menarke</label><input id="tv-pb-menarke" name="menarke" type="date"></div>' : ''}
      <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button></div></div><p class="form-fel" role="alert" hidden></p></form></details>` : ''}
    <p class="under-text">${esc(p.kalla)}</p>
  </section>`;
}

// Runda 11, r7: import från en fil eller från ett annat journalsystem. Systemet granskar först och sparar sedan.
function importHtml(d) {
  if (!d.import) return '';
  return `<details class="tv-import" id="tv-import"><summary>Läs in tillväxtdata från en fil eller ett annat journalsystem</summary>
    <p class="hjalp">Systemet läser filen, kontrollerar att den gäller barnet, prövar varje värde och visar vad som är nytt innan något sparas. Format: ${esc(Object.values(d.import.format).join('. '))}.</p>
    <div class="falt-rad"><div class="falt"><label for="tv-import-fil">Fil</label><input id="tv-import-fil" type="file" accept=".json,.csv,.txt,application/json,text/csv"></div>
      <div class="falt knappfalt"><button type="button" class="knapp sekundar" data-tv-journalsystem>Hämta från ${esc(d.import.simuleratSystem)}</button></div></div>
    <div id="tv-import-granskning"></div><p class="form-fel" role="alert" hidden></p>
  </details>`;
}
const IMPORTSTATUS = { ny: 'Ny', finns: 'Finns redan', fel: 'Läses inte in' };
function granskningHtml(g) {
  return `<p><strong>${esc(g.kallsystem)}.</strong> ${esc(g.text)}</p>
    <div class="tabellrulle"><table class="tabell"><caption class="sr">Mätvärdena i filen</caption><thead><tr><th scope="col">Datum</th><th scope="col">Mått</th><th scope="col">Värde</th><th scope="col">Uppmätt på</th><th scope="col">Status</th></tr></thead>
      <tbody>${g.rader.map(r => `<tr class="tv-import-rad status-${esc(r.status)}"><td>${esc(r.datum ?? r.tid ?? '')}</td><td>${esc(r.namn ?? '')}</td><td>${r.varde != null && Number.isFinite(Number(r.varde)) ? esc(`${tal(Number(r.varde), r.typ === 'vikt' ? 2 : 1)} ${r.enhet ?? ''}`) : ''}</td><td>${esc(r.ursprungEnhet ?? '')}</td><td>${esc(IMPORTSTATUS[r.status])}${r.orsak ? `<span class="under-text">${esc(r.orsak)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
    ${g.antal.ny && !g.redanInlast ? `<div class="knapprad"><button type="button" class="knapp" data-tv-importera>Läs in ${g.antal.ny} ${g.antal.ny === 1 ? 'nytt värde' : 'nya värden'}</button></div>` : ''}`;
}

function registrering(bhv, b = null) {
  const n = bhv?.program?.nasta;
  return `<form class="mv-form tv-form" id="tv-form" novalidate aria-labelledby="tv-reg">
    <h3 id="tv-reg">Registrera mätning</h3>
    ${n && n.status === 'nu' ? `<p class="hjalp">Mätningen räknas till ${esc(n.text.toLowerCase())} i barnhälsovårdens program.</p>` : ''}
    <div class="falt-rad">
      <div class="falt smal"><label for="tv-vikt">Vikt</label><div class="med-enhet"><input id="tv-vikt" name="vikt" inputmode="decimal" autocomplete="off"><span class="enhet">kg</span></div></div>
      <div class="falt smal"><label for="tv-langd">Längd</label><div class="med-enhet"><input id="tv-langd" name="langd" inputmode="decimal" autocomplete="off"><span class="enhet">cm</span></div></div>
      <div class="falt smal"><label for="tv-huvud">Huvudomfång</label><div class="med-enhet"><input id="tv-huvud" name="huvudomfang" inputmode="decimal" autocomplete="off"><span class="enhet">cm</span></div></div>
      ${b && b.alderManader >= 24 ? '<div class="falt smal"><label for="tv-sitthojd">Sitthöjd</label><div class="med-enhet"><input id="tv-sitthojd" name="sitthojd" inputmode="decimal" autocomplete="off"><span class="enhet">cm</span></div></div>' : ''}
      <div class="falt knappfalt"><button type="submit" class="knapp">Registrera</button></div>
    </div>
    <p class="hjalp">Systemet sätter tid, vårdkontakt och kod och räknar BMI, SD och percentil.</p>
    <p class="form-fel" role="alert" hidden></p>
  </form>`;
}

function fodselHtml(d) {
  const f = d.fodsel;
  const m = d.foraldrar;
  const rad = (t, v) => `<li><span>${esc(t)}</span><strong>${v ?? '<span class="dampad">Saknas</span>'}</strong></li>`;
  return `<section aria-labelledby="tv-fodsel"><h3 id="tv-fodsel">Födelse och föräldrar</h3>
    <ul class="tv-fakta">
      ${rad('Graviditetslängd', f.graviditetslangd ? `vecka ${esc(f.graviditetslangd)}` : null)}
      ${rad('Födelsevikt', f.vikt ? `${esc(tal(f.vikt, 3))} kg` : null)}
      ${rad('Födelselängd', f.langd ? `${esc(tal(f.langd, 1))} cm` : null)}
      ${rad('Huvudomfång vid födelsen', f.huvudomfang ? `${esc(tal(f.huvudomfang, 1))} cm` : null)}
      ${rad('Längd, biologisk mor', m.mor ? `${esc(m.mor)} cm` : null)}
      ${rad('Längd, biologisk far', m.far ? `${esc(m.far)} cm` : null)}
    </ul>
    ${m.malangd ? `<p>${esc(m.malangd.text)} <span class="under-text">Demoregel: Tanners formel.</span></p>` : '<p class="dampad">Målängden räknas när båda föräldrarnas längd finns.</p>'}
    ${d.kan.registrera ? `<details><summary>Registrera en uppgift</summary><form id="tv-uppgift" class="falt-rad" novalidate>
      <div class="falt"><label for="tv-u-typ">Uppgift</label><select id="tv-u-typ" name="typ">${Object.entries(d.uppgiftstyper).filter(([k]) => k !== 'tb_risk').map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('')}</select></div>
      <div class="falt smal"><label for="tv-u-varde">Värde</label><input id="tv-u-varde" name="varde" inputmode="decimal" autocomplete="off"></div>
      <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button></div><p class="form-fel" role="alert" hidden></p></form></details>` : ''}
  </section>`;
}

function programHtml(d, bhv) {
  const p = bhv.program;
  const n = p.nasta;
  const forslag = bhv.forslag ?? [];
  return `<section aria-labelledby="tv-program" class="tv-program"><h3 id="tv-program">Barnhälsovårdens program</h3>
    <p>${esc(p.text)} ${bhv.egenEnhet ? '' : `Barnet är inskrivet på ${esc(bhv.enhet.namn)}, som bokar besöken och ger vaccinationerna.`}</p>
    ${n && bhv.egenEnhet && d.kan.boka && n.status !== 'bokat' ? `<div class="tv-forslag"><p><strong>${esc(n.text)}</strong>${n.vacciner.filter(v => !v.given).length ? `, med ${esc(n.vacciner.filter(v => !v.given).map(v => v.text).join(' och '))}` : ''}. ${n.team ? 'Teambesök med läkare och sjuksköterska.' : n.hem ? 'Hembesök.' : ''}</p>
      ${forslag.length ? `<ul class="forslag-lista">${forslag.map(f => `<li><button type="button" class="knapp liten" data-boka="${f.tidId}">Boka ${esc(tidpunkt(f.start))}</button><span class="under-text">${esc(f.vardgivare?.namn ?? '')}, ${esc(f.mottagning?.namn ?? '')}. ${esc(f.skal.join(' '))}</span></li>`).join('')}</ul>` : '<p class="dampad">Det finns ingen ledig tid i tidboken inom besökets tidsfönster.</p>'}
      <button type="button" class="knapp liten sekundar" data-vantelista>Lägg på väntelistan i stället</button></div>` : ''}
    ${p.attGe.length && bhv.egenEnhet && d.kan.vaccinera ? `<div class="tv-vacciner"><h4>Vaccinationer som kan ges nu</h4><ul class="enkel-lista">${p.attGe.map(v => `<li><span><strong>${esc(v.text)}</strong><span class="under-text">${esc(v.sjukdomar)}. ATC ${esc(v.atc)}.</span></span><button type="button" class="knapp liten" data-vaccin="${esc(v.id)}">Registrera given</button></li>`).join('')}</ul></div>` : ''}
    <details class="tv-program-lista"><summary>Alla besök i programmet</summary><div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Besök</th><th scope="col">Omkring</th><th scope="col">Vaccinationer</th><th scope="col">Status</th></tr></thead>
      <tbody>${p.besok.map(x => `<tr class="tv-status-${esc(x.status)}"><td>${esc(x.text)}</td><td>${esc(x.datum)}</td><td>${esc(x.vacciner.map(v => `${v.text}${v.given ? ' (given)' : ''}`).join(', '))}</td><td>${esc(STATUS[x.status])}</td></tr>`).join('')}</tbody></table></div>
      <p class="under-text">Senare ger elevhälsan: ${esc(p.elevhalsan.map(e => `${e.text} (${e.nar.toLowerCase()})`).join(', '))}. ${esc(p.demoregel)} Källor: ${esc(p.kallor.besok)}. ${esc(p.kallor.vaccin)}.</p></details>
    ${bhv.vaccinationer.length ? `<details><summary>Givna vaccinationer (${bhv.vaccinationer.length})</summary><ul class="enkel-lista">${bhv.vaccinationer.map(v => `<li><strong>${esc(v.text)}</strong><span class="under-text">${esc(datum(v.tid))}, ${esc(v.vardenhet.namn)}${v.batch ? `, batch ${esc(v.batch)}` : ''}${v.stalleText ? `, ${esc(v.stalleText.toLowerCase())}` : ''}. ATC ${esc(v.atc)}.</span></li>`).join('')}</ul></details>` : ''}
    ${bhv.egenEnhet && d.kan.registrera ? `<div class="kryssfalt tv-bhvq"><input type="checkbox" id="tv-bhvq"${bhv.bhvqMotsatt ? ' checked' : ''}><label for="tv-bhvq">Vårdnadshavaren har motsatt sig att uppgifterna rapporteras till Svenska barnhälsovårdsregistret</label></div>` : ''}
  </section>`;
}

function koppla(el, ctx, d) {
  const id = encodeURIComponent(ctx.id);
  el.querySelectorAll('[name="tv-spann"]').forEach(r => r.addEventListener('change', () => { valtSpann = r.value; ctx.ladda(); }));
  // Runda 11, r7: referensen, måtten som visas, pubertet och import.
  el.querySelector('#tv-referens')?.addEventListener('change', (e) => { if (e.target.value) { valdReferens = e.target.value; ctx.ladda(); } });
  el.querySelectorAll('[data-tv-visa]').forEach(c => c.addEventListener('change', () => {
    const s = doldaMatt();
    if (c.checked) s.delete(c.dataset.tvVisa); else s.add(c.dataset.tvVisa);
    sparaDolda(s);
    const art = el.querySelector(`#tv-kurva-${CSS.escape(c.dataset.tvVisa)}`);
    if (art) art.hidden = !c.checked;
  }));
  const pf = el.querySelector('#tv-pubertet-form');
  pf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    for (const [k, v] of new FormData(pf)) if (String(v).trim() !== '') data[k] = ['brost', 'genitalia', 'pubes'].includes(k) ? Number(v) : v;
    try { const r = await medKnapp(pf.querySelector('[type=submit]'), () => api(`/api/patient/${id}/tillvaxt/pubertet`, { metod: 'POST', data }), pf); notis(r.text); ctx.ladda(); } catch { /* i formuläret */ }
  });
  const imp = el.querySelector('#tv-import');
  let granskad = null;
  const visaGranskning = (g, format, innehall) => {
    granskad = { format, innehall, hash: g.hash };
    imp.querySelector('#tv-import-granskning').innerHTML = granskningHtml(g);
    imp.querySelector('.form-fel').hidden = true;
  };
  const importFel = (x) => { const f = imp.querySelector('.form-fel'); f.textContent = x?.message ?? 'Filen kunde inte läsas in.'; f.hidden = false; };
  // Systemet avgör formatet själv ur innehållet: en FHIR Bundle, ett svar från GetObservations eller CSV.
  const formatFor = (text) => { try { const j = JSON.parse(text); return Array.isArray(j?.observation) ? 'riv' : 'fhir'; } catch { return 'csv'; } };
  imp?.querySelector('#tv-import-fil').addEventListener('change', async (e) => {
    const fil = e.target.files?.[0];
    if (!fil) return;
    if (fil.size > d.import.maxTecken * 2) { importFel({ message: 'Filen är för stor för att läsas in.' }); return; }
    const text = await fil.text();
    const format = formatFor(text);
    try { visaGranskning(await api(`/api/patient/${id}/tillvaxt/import/granska`, { metod: 'POST', data: { format, innehall: text } }), format, text); } catch (x) { importFel(x); }
  });
  imp?.addEventListener('click', async (e) => {
    const knapp = e.target.closest('button');
    if (!knapp) return;
    try {
      if (knapp.hasAttribute('data-tv-journalsystem')) { const g = await medKnapp(knapp, () => api(`/api/patient/${id}/tillvaxt/import/journalsystem`, { metod: 'POST', data: {} })); visaGranskning(g, 'riv', g.innehall); }
      else if (knapp.hasAttribute('data-tv-importera') && granskad) { const r = await medKnapp(knapp, () => api(`/api/patient/${id}/tillvaxt/import`, { metod: 'POST', data: granskad })); notis(r.text); ctx.ladda(); }
    } catch (x) { importFel(x); }
  });
  const form = el.querySelector('#tv-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries([...new FormData(form)].filter(([, v]) => String(v).trim() !== ''));
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${id}/tillvaxt`, { metod: 'POST', data }), form);
      notis(r.text);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
  el.querySelector('#tv-period')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const ny = `${ctx.href('tillvaxt')}${f.fran.value || f.till.value ? `?fran=${encodeURIComponent(f.fran.value)}&till=${encodeURIComponent(f.till.value)}` : ''}`;
    if (location.hash === ny) ctx.ladda(); else location.hash = ny;
  });
  const enkel = (sel, vag, data, text) => el.querySelector(sel)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/patient/${id}/${vag}`, { metod: 'POST', data: data(f) }), f);
      notis(text);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
  enkel('#tv-handelse', 'tillvaxt/handelse', (f) => ({ text: f.text.value, datum: f.datum.value || undefined }), 'Händelsen visas på kurvan.');
  enkel('#tv-uppgift', 'tillvaxt/uppgift', (f) => ({ typ: f.typ.value, varde: f.varde.value }), 'Uppgiften är registrerad.');
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.bekrafta) {
        const r = await medKnapp(b, () => api(`/api/hemmatning/${b.dataset.bekrafta}/bekrafta`, { metod: 'POST', data: {} }));
        notis(r.text); ctx.ladda();
      } else if (b.dataset.avvisa) {
        const svar = await dialog(`<h2 id="dlg-rubrik">Använd inte mätningen</h2><form><div class="falt"><label for="dlg-orsak">Varför används mätningen inte? Vårdnadshavaren ser svaret.</label><input id="dlg-orsak" name="orsak" maxlength="120" required></div></form>
          <p class="dialog-fel" role="alert" hidden></p><div class="knapprad"><button type="button" class="knapp" data-varde="ok">Använd inte</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
        if (!svar) return;
        const r = await api(`/api/hemmatning/${b.dataset.avvisa}/avvisa`, { metod: 'POST', data: { orsak: svar.data.orsak } });
        notis(r.text); ctx.ladda();
      } else if (b.dataset.boka) {
        const r = await medKnapp(b, () => api(`/api/patient/${id}/bhv/boka`, { metod: 'POST', data: { besokId: d.bhv.program.nasta.id, tidId: Number(b.dataset.boka) } }));
        notis(r.text); ctx.ladda();
      } else if (b.hasAttribute('data-vantelista')) {
        const r = await medKnapp(b, () => api(`/api/patient/${id}/bhv/boka`, { metod: 'POST', data: { besokId: d.bhv.program.nasta.id } }));
        notis(r.text); ctx.ladda();
      } else if (b.dataset.vaccin) {
        const data = await vaccinFraga(d, b.dataset.vaccin);
        if (!data) return;
        const r = await medKnapp(b, () => api(`/api/patient/${id}/vaccination`, { metod: 'POST', data }));
        notis(r.text); ctx.ladda();
      } else if (b.hasAttribute('data-lakarbesok')) {
        const r = await medKnapp(b, () => api(`/api/patient/${id}/bhv/lakarbesok`, { metod: 'POST', data: { snart: b.dataset.lakarbesok === 'snart', orsak: b.dataset.orsak } }));
        notis(r.text); ctx.ladda();
      }
    } catch { /* felet visas som notis */ }
  });
  el.querySelector('#tv-bhvq')?.addEventListener('change', async (e) => {
    try { const r = await api(`/api/patient/${id}/bhv/bhvq`, { metod: 'POST', data: { motsatt: e.target.checked } }); notis(r.text); } catch { e.target.checked = !e.target.checked; }
  });
}

// Före varje dos: frågan om vaccinationer som barnet har fått någon annanstans, som alla barn får, och varningen när
// vaccinationer på en annan vårdenhet bara syns efter ett aktivt val. Varningen säger inget om vilken vårdenhet,
// vilket vaccin eller när.
async function vaccinFraga(d, vaccinId) {
  const v = d.bhv.program.attGe.find(x => x.id === vaccinId);
  const dold = d.bhv.doldaVaccinationer?.kraverVal;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Ge ${esc(v?.text ?? 'dosen')}</h2>
    ${dold ? `<div class="ruta ruta-larm" data-dolda-vaccinationer>${ikon.varning}<div><p>${esc(d.bhv.doldaVaccinationer.text)}</p>
      <div class="kryssfalt"><input type="checkbox" id="dlg-dolda" name="dolda" value="ja"><label for="dlg-dolda">Jag ger dosen utan att se dem. Det loggas.</label></div></div></div>` : ''}
    <fieldset class="kryssgrupp"><legend>Har barnet fått vaccinationer någon annanstans, till exempel på en annan vårdenhet eller utomlands? Fråga vårdnadshavaren.</legend>
      <div class="kryssfalt"><input type="radio" id="dlg-andra-nej" name="andra" value="nej"><label for="dlg-andra-nej">Nej, inga andra vaccinationer</label></div>
      <div class="kryssfalt"><input type="radio" id="dlg-andra-ja" name="andra" value="ja"><label for="dlg-andra-ja">Ja, eller vårdnadshavaren vet inte</label></div>
    </fieldset>
    ${dosFaltHtml('dlg', { barn: true })}
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera given</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (!x.andra ? 'Svara på frågan om andra vaccinationer.' : x.andra === 'ja' ? 'Registrera inte dosen förrän du vet vilka vaccinationer barnet har fått. Fråga vårdnadshavaren eller titta i barnets vaccinationskort.' : dold && x.dolda !== 'ja' ? 'Gör ett aktivt val för att se vaccinationerna, eller bekräfta att du ger dosen utan att se dem.' : provaDosFalt(x)),
    onOpen: (dl) => dl.querySelector('#dlg-andra-nej').focus() });
  if (!svar) return null;
  // Runda 13, r4: kontrollen före vaccinationen och dosens batch, utgångsdatum och injektionsställe.
  return { vaccinId, andraVaccinationer: 'nej', ...dosData(svar.data), ...(dold ? { bekraftaDolda: true } : {}) };
}
