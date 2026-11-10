// Cytostatika på vårdenheten (runda 11, r4, Sussa 4.8.1.4 och 4.8.1.7): kurerna från en vecka bakåt till två veckor framåt
// med vad som ska göras härnäst, doser som väntar på dubbelkontroll, beredningsenhetens lediga platser och uppföljningen
// av kvalitet och produktion. Regimbiblioteket med versioner som en regimansvarig läkare godkänner i sin egen inloggning.
import { esc, api, vyRubrik, tidpunkt, datum, notis, medKnapp, ikon } from '../ui.js';
import { far } from '../app.js';

export const namn = 'cytostatika-enhet';

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Cytostatika', 'Vårdenhetens kurer med nästa steg, dubbelkontrollerna och beredningsenhetens platser. Systemet räknar allt ur ordinationerna, beredningen och administreringen.')}<div id="cye"><p class="tom">Hämtar kurerna.</p></div>`;
  const d = await api('/api/cytostatika/enhet');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#cye');
  if (!el) return;
  const u = d.uppfoljning;
  el.innerHTML = `<p class="knapprad"><a class="knapp sekundar" href="#/cytostatika/regimer">Regimbiblioteket</a></p>
    <section class="ov-sektion" aria-labelledby="cye-kurer"><div class="sektion-huvud"><h2 id="cye-kurer">Kurer, ${esc(d.vardenhet.namn)}</h2><p class="under-text">${esc(d.text)}</p></div>
      ${d.kurer.length ? `<div class="tabellrulle"><table class="tabell"><caption class="sr">Kurerna i tidsordning</caption><thead><tr><th scope="col">Dag 1</th><th scope="col">Patient</th><th scope="col">Regim och cykel</th><th scope="col">Status</th><th scope="col">Nästa steg</th></tr></thead>
        <tbody>${d.kurer.map(k => `<tr><td>${esc(datum(k.dag1))}</td><th scope="row"><a class="patientlank" href="#/patient/${encodeURIComponent(k.patient.id)}/cytostatika">${esc(k.patient.namn)}</a></th><td>${esc(k.regim)}, cykel ${k.cykel} av ${k.cykler}</td><td>${esc(k.statusText)}</td><td>${esc(k.nasta)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom">Inga kurer de närmaste veckorna.</p>'}
    </section>
    ${d.kontroller.length ? `<section class="ov-sektion" aria-labelledby="cye-kontr"><div class="sektion-huvud"><h2 id="cye-kontr">Väntar på dubbelkontroll</h2></div><ul class="enkel-lista">${d.kontroller.map(k => `<li><a href="#/patient/${encodeURIComponent(k.patient.id)}/cytostatika">${esc(k.patient.namn)}</a>: ${esc(k.lakemedel)} ${esc(k.dos)} mg, iordningställd ${esc(tidpunkt(k.iordningstalld.tid))} av ${esc(k.iordningstalld.av)}.</li>`).join('')}</ul></section>` : ''}
    <section class="ov-sektion" aria-labelledby="cye-ber"><div class="sektion-huvud"><h2 id="cye-ber">Beredningen</h2><p class="under-text">Kurerna bereds av ${esc(d.beredning.enhet)}.</p></div>
      ${d.beredning.kapacitet.length ? `<ul class="cye-kap">${d.beredning.kapacitet.map(k => `<li${k.lediga === 0 ? ' class="text-larm"' : ''}>${esc(datum(k.datum))}: ${k.lediga} av ${k.platser} platser lediga</li>`).join('')}</ul>` : '<p class="under-text">Den simulerade externa beredningen svarar elektroniskt när en kur är beredd.</p>'}
    </section>
    ${u ? `<section class="ov-sektion" aria-labelledby="cye-uppf"><div class="sektion-huvud"><h2 id="cye-uppf">Uppföljning, ${esc(datum(u.fran))} till ${esc(datum(u.till))}</h2></div>
      <dl class="pt-uppf"><div><dt>Pågående behandlingar</dt><dd>${u.pagaende.length ? esc(u.pagaende.map(x => `${x.namn} ${x.antal}`).join(', ')) : 'Inga'}</dd></div>
        <div><dt>Planerade kurer de kommande fyra veckorna</dt><dd>${u.planeradeKurer}</dd></div><div><dt>Givna kurer</dt><dd>${u.givnaKurer}</dd></div><div><dt>Beredningar</dt><dd>${u.beredningar}</dd></div>
        <div><dt>Dosjusteringar</dt><dd>${u.dosjusteringar}</dd></div><div><dt>Uppskjutna cykler</dt><dd>${u.uppskjutna}</dd></div>
        <div><dt>Reaktioner under infusion</dt><dd>${u.reaktioner}</dd></div><div><dt>Avbrutna infusioner</dt><dd>${u.avbrutna}, varav ${u.extravaseringar} extravasering</dd></div></dl>
      <p class="dampad liten">${ikon.info}${esc(u.text)} Uppgifterna finns också i datauttaget för uppföljning, tabellen Cytostatikados.</p></section>` : ''}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;
}

function versionHtml(v) {
  return `<dl class="pt-uppf"><div><dt>Cykler</dt><dd>${v.cykler} var ${v.intervall}:e dag</dd></div>
    <div><dt>Läkemedel</dt><dd>${v.lakemedel.map(l => esc(`${l.namn} ${l.dos}${l.minuter ? `, ${l.minuter} minuter` : ''}${l.kumulativ ? `, högst ${l.kumulativ} mg/m² för hela livet` : ''}`)).join('<br>')}</dd></div>
    <div><dt>Premedicinering</dt><dd>${v.premedicinering.length ? esc(v.premedicinering.map(p => `${p.namn} ${p.dos} ${p.vag}`).join(', ')) : 'Ingen'}</dd></div>
    <div><dt>Prover före kuren</dt><dd>${esc(v.prover.join(', '))}</dd></div></dl>`;
}
function forslagForm(r, premed) {
  const g = r.gallande;
  return `<form class="mv-form" data-rb-foresla="${esc(r.id)}" id="rb-f-${esc(r.id)}" hidden novalidate aria-labelledby="rb-fr-${esc(r.id)}"><h3 id="rb-fr-${esc(r.id)}">Ny version av ${esc(g.namn)}</h3>
    <p class="hjalp">Ändra bara det som ska ändras. Systemet skriver vad som skiljer sig från den gällande versionen.</p>
    <div class="falt-rad"><div class="falt smal"><label for="rb-c-${esc(r.id)}">Cykler</label><input id="rb-c-${esc(r.id)}" name="cykler" type="number" min="1" max="12" value="${g.cykler}"></div>
      <div class="falt smal"><label for="rb-i-${esc(r.id)}">Intervall, dagar</label><input id="rb-i-${esc(r.id)}" name="intervall" type="number" min="7" max="42" value="${g.intervall}"></div></div>
    ${g.lakemedel.map(l => `<div class="falt-rad"><div class="falt smal"><label for="rb-d-${esc(r.id)}-${esc(l.id)}">${esc(l.namn)}, ${l.auc ? 'AUC' : 'mg/m²'}</label><input id="rb-d-${esc(r.id)}-${esc(l.id)}" name="dos_${esc(l.id)}" inputmode="decimal" value="${esc(l.auc ?? l.dosPerM2)}"></div>
      ${l.peroral ? '' : `<div class="falt smal"><label for="rb-m-${esc(r.id)}-${esc(l.id)}">${esc(l.namn)}, minuter</label><input id="rb-m-${esc(r.id)}-${esc(l.id)}" name="min_${esc(l.id)}" type="number" min="5" max="240" value="${esc(l.minuter)}"></div>`}</div>`).join('')}
    <fieldset><legend>Premedicinering</legend><div class="kryssrad">${premed.map(p => `<div class="kryssfalt"><input type="checkbox" id="rb-p-${esc(r.id)}-${esc(p.id)}" name="premed" value="${esc(p.id)}"${g.premedicinering.some(x => x.id === p.id) ? ' checked' : ''}><label for="rb-p-${esc(r.id)}-${esc(p.id)}">${esc(`${p.namn} ${p.dos} ${p.vag}`)}</label></div>`).join('')}</div></fieldset>
    <div class="falt"><label for="rb-mo-${esc(r.id)}">Varför ändras regimen</label><input id="rb-mo-${esc(r.id)}" name="motivering" maxlength="300" autocomplete="off"></div>
    <div class="knapprad"><button type="submit" class="knapp">Skicka till en regimansvarig läkare</button></div><p class="form-fel" role="alert" hidden></p></form>`;
}

export const regimer = { namn: 'cytostatika-regimer', visa: visaRegimer };
async function visaRegimer(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Regimbiblioteket', 'Regionens cytostatikaregimer med versioner. En ny version används först när en regimansvarig läkare har godkänt den i sin egen inloggning.')}<div id="rb"><p class="tom">Hämtar regimerna.</p></div>`;
  const d = await api('/api/cytostatika/regimer');
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#rb');
  if (!el) return;
  const ladda = () => visaRegimer(main, _p, _q, ctx);
  el.innerHTML = `<p class="ruta ruta-info liten">${ikon.info}<span>${esc(d.text)}${d.regimansvarig ? ' Du är regimansvarig och kan godkänna versioner som någon annan har skrivit.' : ''}</span></p>
    ${d.regimer.map(r => `<section class="ov-sektion" aria-labelledby="rb-${esc(r.id)}"><div class="sektion-huvud"><h2 id="rb-${esc(r.id)}">${esc(r.gallande.namn)}, version ${r.gallande.version}</h2>
        <p class="under-text">${r.gallande.beslut?.av ? `Godkänd ${esc(tidpunkt(r.gallande.beslut.tid))} av ${esc(r.gallande.beslut.av)}.` : 'Grundversionen i demon.'}</p></div>
      ${versionHtml(r.gallande)}
      ${r.vantande.map(v => `<div class="ruta ruta-obs">${ikon.info}<div><p><strong>Version ${v.version} väntar på godkännande.</strong> ${esc(v.andring)} Motivering: ${esc(v.motivering)}. Skriven ${esc(tidpunkt(v.skapad.tid))} av ${esc(v.skapad.av)}.</p>
        ${versionHtml(v)}
        ${v.kanGodkanna ? `<form class="falt-rad" data-rb-beslut="${v.id}" novalidate><div class="falt"><label for="rb-o-${v.id}">Orsak om du avslår</label><input id="rb-o-${v.id}" name="orsak" maxlength="300" autocomplete="off"></div>
          <div class="falt knappfalt knapprad"><button type="button" class="knapp" data-rb-godkann="${v.id}">Godkänn version ${v.version}</button><button type="submit" class="knapp sekundar">Avslå</button></div></form>` : `<p class="under-text">${v.skapad.av && far('ordinera_cytostatika') ? 'Godkänns av en annan regimansvarig läkare i sin egen inloggning.' : ''}</p>`}</div></div>`).join('')}
      ${d.kanForesla && !r.vantande.length ? `<p class="knapprad"><button type="button" class="knapp sekundar" data-rb-oppna="${esc(r.id)}">Föreslå en ny version</button></p>${forslagForm(r, d.premedicinering)}` : ''}
      ${r.tidigare.length ? `<details><summary>Tidigare versioner, ${r.tidigare.length}</summary><ul class="enkel-lista">${r.tidigare.map(v => `<li>Version ${v.version}, ${esc({ ersatt: 'ersatt', avslagen: 'avslagen' }[v.status] ?? v.status)}. ${esc(v.andring)}${v.beslut?.orsak ? ` Orsak: ${esc(v.beslut.orsak)}.` : ''}</li>`).join('')}</ul></details>` : ''}
    </section>`).join('')}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (t?.dataset.rbOppna) { const f = el.querySelector(`#rb-f-${t.dataset.rbOppna}`); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input')?.focus(); }
    if (t?.dataset.rbGodkann) { try { const r = await medKnapp(t, () => api(`/api/cytostatika/regimversion/${t.dataset.rbGodkann}/godkann`, { metod: 'POST', data: {} })); notis(r.text); ladda(); } catch { /* notis */ } }
  });
  el.addEventListener('submit', async (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.dataset.rbBeslut) {
      try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/cytostatika/regimversion/${f.dataset.rbBeslut}/avsla`, { metod: 'POST', data: { orsak: f.orsak.value } })); notis(r.text); ladda(); } catch { /* notis */ }
      return;
    }
    if (!f.dataset.rbForesla) return;
    const r = d.regimer.find(x => x.id === f.dataset.rbForesla);
    const fd = new FormData(f);
    const data = { cykler: Number(fd.get('cykler')), intervall: Number(fd.get('intervall')), doser: {}, minuter: {}, premedicinering: fd.getAll('premed'), motivering: fd.get('motivering') };
    for (const l of r.gallande.lakemedel) {
      data.doser[l.id] = Number(String(fd.get(`dos_${l.id}`)).replace(',', '.'));
      if (fd.get(`min_${l.id}`) != null) data.minuter[l.id] = Number(fd.get(`min_${l.id}`));
    }
    try { const x = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/cytostatika/regimer/${encodeURIComponent(r.id)}/version`, { metod: 'POST', data }), f); notis(x.text); ladda(); } catch { /* i formuläret */ }
  });
}
