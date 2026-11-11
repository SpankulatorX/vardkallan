// Beredningsenheten för cytostatika (runda 11, r4, Sussa 4.8.1.2, 4.8.1.5 och 4.8.1.7). Arbetslistan med beräkningen ur
// beredningsordern och den batch som systemet föreslår, beredningen som farmaceuten signerar med batch och kontrollmätt
// volym, lagret, spårbarheten från en batch till patienterna, kapaciteten per dag och uppföljningen.
import { esc, api, vyRubrik, tidpunkt, datum, notis, medKnapp, ikon, tal } from '../ui.js';

export const namn = 'cytostatikaberedning';
const sv = (v, d = 1) => (v == null ? '' : tal(v, d));
const STATUS = { ok: 'Kan användas', gar_ut: 'Går ut inom 30 dagar', utgangen: 'Utgången', kasserad: 'Kasserad', slut: 'Slut' };

function dosKort(x) {
  const berakning = x.peroral
    ? `Tabletter för hela cykeln: ${x.tabletterTotalt.map(t => `${t.antal} à ${t.styrka} mg`).join(' och ')}. ${x.tabletterPerTillfalle.map(t => `${t.antal} à ${t.styrka} mg`).join(' och ')} per tillfälle.`
    : `${x.berakning}. Dra upp ${sv(x.volymLakemedel)} ml ur ${x.stam} och späd i ${x.barare} ${x.bararVolym} ml, totalt ${sv(x.totalVolym)} ml. Infunderas på ${x.infusionMinuter} minuter. Hållbar ${x.hallbarTimmar} timmar.`;
  return `<li class="bd-dos" data-bd-dos="${x.dosId}"><p><strong>${esc(x.lakemedel)} ${esc(sv(x.dos, 0))} mg</strong>, ${esc(x.patient.namn)} ${esc(x.patient.personnummer)} <span class="under-text">${esc(x.vardenhet)}, ${esc(x.regim)}, cykel ${esc(x.cykel)}. Etikett ${esc(x.etikett)}.</span></p>
    <p>${esc(berakning)}</p>
    <form class="falt-rad" data-bd-bered="${x.dosId}" novalidate aria-label="${esc(`Bered ${x.lakemedel} ${x.etikett}`)}">
      ${x.peroral ? `<p class="under-text">Systemet tar ${x.forslag.map(f => `${f.mangd} ${f.enhet} ur batch ${f.batch ?? 'saknas'}`).join(' och ')}.</p>`
        : `<div class="falt smal"><label for="bd-b-${x.dosId}">Batch</label><input id="bd-b-${x.dosId}" name="batch" value="${esc(x.forslag[0]?.batch ?? '')}" autocomplete="off" aria-describedby="bd-bh-${x.dosId}"><span class="hjalp" id="bd-bh-${x.dosId}">Förslaget går ut först${x.forslag[0]?.utgang ? `, ${esc(datum(x.forslag[0].utgang))}` : ''}. Skanna förpackningen om du tar en annan.</span></div>
        <div class="falt smal"><label for="bd-m-${x.dosId}">Kontrollmätt volym, ml</label><input id="bd-m-${x.dosId}" name="uppmattMl" inputmode="decimal" autocomplete="off" aria-describedby="bd-mh-${x.dosId}"><span class="hjalp" id="bd-mh-${x.dosId}">Beräknat ${esc(sv(x.volymLakemedel))} ml. Högst 5 procents avvikelse.</span></div>`}
      <div class="falt knappfalt"><button type="submit" class="knapp liten">Signera beredningen</button></div><p class="form-fel" role="alert" hidden></p>
    </form></li>`;
}

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Cytostatikaberedningen', 'Beredningsordrar från vårdenheterna på USÖ, lagret med batcher och spårbarheten från en batch till patienterna. Systemet räknar volymerna, föreslår batchen och kontrollerar mätningen.')}<div id="bd"><p class="tom">Hämtar arbetslistan.</p></div>`;
  const [a, l, u] = await Promise.all([api('/api/beredning/arbetslista'), api('/api/beredning/lager'), api('/api/beredning/uppfoljning')]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#bd');
  if (!el) return;
  const ladda = () => visa(main, _p, _q, ctx);
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="bd-att"><div class="sektion-huvud"><h2 id="bd-att">Att bereda</h2><p class="under-text">${esc(a.text)}</p></div>
      ${a.attBereda.length ? a.attBereda.map(dag => `<h3>${esc(datum(dag.datum))} <span class="under-text">${dag.kapacitet.bokade} av ${dag.kapacitet.platser} kurer</span></h3><ul class="bd-lista">${dag.doser.map(dosKort).join('')}</ul>`).join('') : '<p class="tom">Inga godkända kurer väntar på beredning.</p>'}
    </section>
    <section class="ov-sektion" aria-labelledby="bd-klara"><div class="sektion-huvud"><h2 id="bd-klara">Beredda i dag</h2></div>
      ${a.bereddaIdag.length ? `<ul class="enkel-lista">${a.bereddaIdag.map(x => `<li>${esc(x.lakemedel)} ${esc(sv(x.dos, 0))} mg, ${esc(x.patient.namn)}, ${esc(x.vardenhet)}. Signerad ${esc(tidpunkt(x.beredning.tid))} av ${esc(x.beredning.av)}, batch ${esc(x.beredning.batcher.map(b => b.batch).join(' och '))}.</li>`).join('')}</ul>` : '<p class="tom">Inget är berett i dag.</p>'}
    </section>
    <section class="ov-sektion" aria-labelledby="bd-lager"><div class="sektion-huvud"><h2 id="bd-lager">Lager</h2></div>
      ${l.varor.map(v => `<h3>${esc(v.namn)} <span class="under-text">${esc(sv(v.kvar))} ${esc(v.enhet)} kvar</span></h3>
        <p class="ruta ${v.racker ? 'ruta-info' : 'ruta-obs'} liten">${v.racker ? ikon.bock : ikon.varning}<span>${esc(v.text)}</span></p>
        <div class="tabellrulle"><table class="tabell"><caption class="sr">${esc(`Batcher av ${v.namn}`)}</caption><thead><tr><th scope="col">Batch</th><th scope="col">Utgång</th><th scope="col">Kvar</th><th scope="col">Status</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead>
        <tbody>${v.batcher.map(b => `<tr><th scope="row">${esc(b.batch)}</th><td>${esc(datum(b.utgang))}</td><td>${esc(sv(b.kvar))} ${esc(v.enhet)}</td><td${b.status === 'utgangen' ? ' class="text-larm"' : ''}>${esc(STATUS[b.status])}</td>
          <td>${b.status === 'utgangen' ? `<button type="button" class="knapp liten sekundar" data-bd-kassera="${b.id}">Kassera</button>` : `<button type="button" class="knapp liten sekundar" data-bd-spara="${esc(b.batch)}">Följ batchen</button>`}</td></tr>`).join('')}</tbody></table></div>`).join('')}
      <form class="mv-form" id="bd-ta-emot" novalidate aria-labelledby="bd-te-r"><h3 id="bd-te-r">Ta emot en leverans</h3><div class="falt-rad">
        <div class="falt"><label for="bd-vara">Vara</label><select id="bd-vara" name="vara">${l.varor.map(v => `<option value="${esc(v.id)}">${esc(v.namn)}, ${esc(v.perForpackning)} ${esc(v.enhet)} per förpackning</option>`).join('')}</select></div>
        <div class="falt smal"><label for="bd-batch">Batch</label><input id="bd-batch" name="batch" autocomplete="off"></div>
        <div class="falt smal"><label for="bd-utgang">Utgångsdatum</label><input id="bd-utgang" name="utgang" type="date"></div>
        <div class="falt smal"><label for="bd-antal">Förpackningar</label><input id="bd-antal" name="antal" type="number" min="1" max="50" value="1"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Ta emot</button></div></div><p class="form-fel" role="alert" hidden></p></form>
    </section>
    <section class="ov-sektion" aria-labelledby="bd-sp"><div class="sektion-huvud"><h2 id="bd-sp">Spårbarhet</h2><p class="under-text">Från en batch till varje patient som har fått den, om batchen dras tillbaka.</p></div>
      <form class="falt-rad" id="bd-sparform" novalidate><div class="falt smal"><label for="bd-spbatch">Batch</label><input id="bd-spbatch" name="batch" autocomplete="off"></div><div class="falt knappfalt"><button type="submit" class="knapp">Följ batchen</button></div></form>
      <div id="bd-spar" aria-live="polite"></div>
    </section>
    <section class="ov-sektion" aria-labelledby="bd-kap"><div class="sektion-huvud"><h2 id="bd-kap">Kapacitet</h2><p class="under-text">Hur många kurer beredningsenheten tar emot per dag. Läkaren får veta när en dag är full och vilken dag som har plats.</p></div>
      <div class="tabellrulle"><table class="tabell"><caption class="sr">Kapaciteten de kommande två veckorna</caption><thead><tr><th scope="col">Dag</th><th scope="col">Godkända kurer</th><th scope="col">Platser</th></tr></thead>
      <tbody>${a.kapacitet.map(k => `<tr><th scope="row">${esc(datum(k.datum))}</th><td>${k.bokade}</td><td><label class="sr" for="bd-k-${esc(k.datum)}">${esc(`Platser ${datum(k.datum)}`)}</label><input class="smal-tal" id="bd-k-${esc(k.datum)}" type="number" min="0" max="40" value="${k.platser}" data-bd-kap="${esc(k.datum)}"></td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="ov-sektion" aria-labelledby="bd-uppf"><div class="sektion-huvud"><h2 id="bd-uppf">Uppföljning, ${esc(datum(u.fran))} till ${esc(datum(u.till))}</h2></div>
      <dl class="pt-uppf"><div><dt>Beredningar</dt><dd>${u.beredningar}${u.perVara.length ? `: ${esc(u.perVara.map(x => `${x.namn} ${x.antal}`).join(', '))}` : ''}</dd></div>
        <div><dt>Kontrollmätningar</dt><dd>${u.kontrollmatningar}, varav ${u.overGransen} över gränsen</dd></div>
        <div><dt>Kassationer</dt><dd>${u.kassationer}${u.kasseradMangd.length ? `: ${esc(u.kasseradMangd.map(k => `${k.namn} ${sv(k.mangd)} ${k.enhet}`).join(', '))}` : ''}</dd></div>
        <div><dt>Tid från godkänd kur till beredd</dt><dd>${u.ledtidMinuter == null ? 'Inget underlag' : `${u.ledtidMinuter} minuter i medel`}</dd></div></dl>
      <p class="dampad liten">${esc(u.text)} ${esc(a.demoregel)}</p>
    </section>`;

  const spara = async (batch, knapp = null) => {
    try {
      const s = await medKnapp(knapp, () => api(`/api/beredning/sparbarhet?batch=${encodeURIComponent(batch)}`));
      el.querySelector('#bd-spar').innerHTML = `<h3>Batch ${esc(s.batch.batch)}, ${esc(s.batch.vara)}</h3>${s.doser.length ? `<ul class="enkel-lista">${s.doser.map(x => `<li>${esc(x.patient.namn)} ${esc(x.patient.personnummer)}, ${esc(x.vardenhet)}: ${esc(sv(x.mangd))} ${esc(x.enhet)} i ${esc(x.etikett)}, beredd ${esc(tidpunkt(x.bereddTid))}${x.givenTid ? `, given ${esc(tidpunkt(x.givenTid))}` : ', inte given än'}.</li>`).join('')}</ul>` : '<p class="tom">Ingen dos är beredd ur batchen.</p>'}<p class="under-text">${esc(s.text)}</p>`;
    } catch { /* notis */ }
  };
  el.addEventListener('submit', async (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.dataset.bdBered) {
      const data = f.batch ? { batch: f.batch.value, uppmattMl: f.uppmattMl.value } : {};
      try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/beredning/dos/${f.dataset.bdBered}/bered`, { metod: 'POST', data }), f); notis(r.text); ladda(); } catch (x) { if (x?.status === 409) { const ruta = f.querySelector('.form-fel'); ruta.textContent = x.message; ruta.hidden = false; } }
    } else if (f.id === 'bd-ta-emot') {
      try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api('/api/beredning/lager', { metod: 'POST', data: { vara: f.vara.value, batch: f.batch.value, utgang: f.utgang.value, antal: Number(f.antal.value) } }), f); notis(r.text); ladda(); } catch { /* i formuläret */ }
    } else if (f.id === 'bd-sparform') spara(f.batch.value, f.querySelector('[type=submit]'));
  });
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (t?.dataset.bdKassera) { try { const r = await medKnapp(t, () => api(`/api/beredning/lager/${t.dataset.bdKassera}/kassera`, { metod: 'POST', data: {} })); notis(r.text); ladda(); } catch { /* notis */ } }
    if (t?.dataset.bdSpara) { el.querySelector('#bd-spbatch').value = t.dataset.bdSpara; spara(t.dataset.bdSpara, t); }
  });
  el.addEventListener('change', async (e) => {
    const i = e.target.closest('[data-bd-kap]');
    if (!i) return;
    try { const r = await medKnapp(null, () => api('/api/beredning/kapacitet', { metod: 'POST', data: { datum: i.dataset.bdKap, platser: Number(i.value) } })); notis(r.text); } catch { ladda(); }
  });
}
