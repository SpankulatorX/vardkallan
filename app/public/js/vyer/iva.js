// Intensivvård (runda 9, r2, Sussa 4.6.1): översikten över patienterna på intensivvårdsavdelningen, övervakningen per
// patient med täta värden från monitorn, analysen med larm och förslag, infusionerna med titrering, vätskorna och den
// timvisa vätskebalansen, anestesibedömningen och uppföljningen av kvalitet och produktion. Systemet räknar allt det
// kan ur journalen, och bara godkända värden används i larm, förslag och doser.
import { esc, api, vyRubrik, tidpunkt, klockslag, notis, medKnapp, ikon, tal } from '../ui.js';
import { far, S } from '../app.js';
// Runda 11, r7: realtid, egna gränser, vätskemål, andningsstöd, NEMS och överrapportering (iva-tillagg.js).
import * as tillagg from './iva-tillagg.js';

export const namn = 'iva';

const NIVA = { larm: ['ruta-larm', 'Larm'], varning: ['ruta-obs', 'Varning'], forslag: ['ruta-info', 'Förslag'], observation: ['ruta-info', 'Observation'] };
const VARDEN = [['blodtryck', 'Blodtryck', 'mmHg'], ['puls', 'Puls', '/min'], ['saturation', 'SpO₂', '%'], ['andningsfrekvens', 'Andning', '/min'], ['temp', 'Temp', '°C']];
const sv = (v, d = 1) => (v == null ? '' : tal(v, d));

function analysHtml(a) {
  if (!a.length) return '<p class="tom liten">Inga larm eller förslag just nu.</p>';
  return `<ul class="iva-analys">${a.map(x => `<li class="ruta ${NIVA[x.niva][0]} liten">${x.niva === 'larm' ? ikon.larm : ikon.info}<div><strong>${esc(NIVA[x.niva][1])}:</strong> ${esc(x.text)}${x.gora ? ` <span class="under-text">${esc(x.gora)}</span>` : ''}</div></li>`).join('')}</ul>`;
}
function vardeRuta(v, typ) {
  if (!v) return '<span class="dampad">Inget värde</span>';
  return `<strong>${esc(typeof v.varde === 'number' ? sv(v.varde, 1) : v.varde)}</strong>${typ === 'blodtryck' && v.map != null ? ` <span class="under-text">MAP ${esc(v.map)}</span>` : ''}
    <span class="under-text">${esc(klockslag(v.tid))}${v.kalla === 'utrustning' ? (v.godkand ? ', monitor' : ', monitor, ej godkänt') : ''}</span>`;
}

// En liten kurva för övervakningen: punkterna i tidsordning, ihåliga när värdet från monitorn inte är godkänt.
function kurva(k) {
  const B = 300, H = 90, V = 32, T = 8, U = 16;
  const p = k.punkter;
  if (!p.length) return '';
  const alla = p.map(x => x.varden[0]);
  let min = Math.min(...alla), max = Math.max(...alla);
  if (min === max) { min -= 1; max += 1; }
  const t0 = Date.parse(p[0].tid), t1 = Date.parse(p.at(-1).tid);
  const x = (t) => V + (t1 === t0 ? 0.5 : (Date.parse(t) - t0) / (t1 - t0)) * (B - V - 6);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - U);
  return `<svg class="kurva iva-kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(`${k.namn}: ${p.length} värden från ${klockslag(p[0].tid)} till ${klockslag(p.at(-1).tid)}, senast ${alla.at(-1)}.`)}">
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/>
    <text class="kurva-text" x="${V - 4}" y="${T + 8}" text-anchor="end">${esc(sv(max))}</text><text class="kurva-text" x="${V - 4}" y="${H - U}" text-anchor="end">${esc(sv(min))}</text>
    <text class="kurva-text" x="${V}" y="${H - 3}">${esc(klockslag(p[0].tid))}</text><text class="kurva-text" x="${B - 6}" y="${H - 3}" text-anchor="end">${esc(klockslag(p.at(-1).tid))}</text>
    ${p.length > 1 ? `<polyline class="kurva-linje" points="${p.map(q => `${x(q.tid).toFixed(1)},${y(q.varden[0]).toFixed(1)}`).join(' ')}"/>` : ''}
    ${p.map(q => `<circle class="kurva-punkt${q.utanfor ? ' kurva-utanfor' : ''}${q.kalla === 'utrustning' && !q.godkand ? ' kurva-referens' : ''}" cx="${x(q.tid).toFixed(1)}" cy="${y(q.varden[0]).toFixed(1)}" r="2.5"/>`).join('')}
  </svg>`;
}

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Intensivvård', 'Alla patienter på intensivvårdsavdelningen med de senaste värdena, larm och förslag som systemet räknar fram, utrustningen, infusionerna och vätskebalansen.')}<div id="iva"><p class="tom">Hämtar översikten.</p></div>`;
  const [d, u] = await Promise.all([api('/api/iva'), far('statistik') ? api('/api/iva/uppfoljning').catch(() => null) : null]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#iva');
  if (!el) return;
  if (!d.enhet) { el.innerHTML = `<p class="tom">${esc(d.text)}</p>`; return; }
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="iva-enhet"><div class="sektion-huvud"><h2 id="iva-enhet">${esc(d.enhet.namn)}</h2><p class="under-text">${esc(d.text)}</p></div>
    ${d.patienter.length ? `<div class="tabellrulle"><table class="tabell iva-oversikt"><caption class="sr">Patienterna på avdelningen, de med larm först</caption>
      <thead><tr><th scope="col">Patient</th>${VARDEN.map(([, n, e]) => `<th scope="col">${esc(n)} <span class="enhet">${esc(e)}</span></th>`).join('')}<th scope="col">NEWS2</th><th scope="col">Larm och förslag</th><th scope="col">Infusioner och vätska</th></tr></thead>
      <tbody>${d.patienter.map(p => `<tr${p.larm ? ' class="rad-larm"' : ''}>
        <th scope="row"><a class="patientlank" href="#/iva/${encodeURIComponent(p.patientId)}">${esc(p.namn)}</a><span class="under-text">${esc(p.plats ?? '')}${p.utrustning.length ? `, ${esc(p.utrustning.map(x => x.text).join(', '))}` : ''}</span>
          ${p.vantar ? `<span class="tagg tagg-referens">${p.vantar} ej godkända värden</span>` : ''}
          ${p.behandlingsbegransningar?.length ? `<span class="tagg tagg-larm" title="${esc(p.behandlingsbegransningar.join('. '))}">Behandlingsbegränsning</span>` : ''}${p.egnaRegler ? '<span class="tagg">Egna gränser</span>' : ''}${p.nems ? `<span class="tagg">NEMS ${esc(p.nems.poang)}</span>` : ''}</th>
        ${VARDEN.map(([typ]) => `<td>${vardeRuta(p.varden[typ], typ)}</td>`).join('')}
        <td>${p.news2 ? `${esc(p.news2.komplett ? p.news2.poang : 'Ofullständig')}` : '<span class="dampad">Saknas</span>'}</td>
        <td>${p.analys.length ? `<ul class="iva-kort">${p.analys.slice(0, 3).map(a => `<li class="${a.niva === 'larm' ? 'text-larm' : ''}">${esc(NIVA[a.niva][1])}: ${esc(a.text)}</li>`).join('')}</ul>` : '<span class="dampad">Inga</span>'}</td>
        <td>${p.infusioner.map(i => `<span class="under-text">${esc(i.lakemedel)} ${esc(sv(i.dos, 3))} ${esc(i.dosEnhet)}, ${esc(sv(i.mlH))} ml/h</span>`).join('')}<span class="under-text">Balans 24 h ${p.vatska.balans > 0 ? '+' : ''}${esc(sv(p.vatska.balans, 0))} ml</span></td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="tom">Inga patienter på avdelningen just nu.</p>'}
    <p class="dampad liten">${esc(d.demoregel)} ${esc(d.demo)}</p>
  </section>
  ${u ? uppfoljningHtml(u) : ''}`;
}

function uppfoljningHtml(u) {
  if (!u.enheter.length) return '';
  return `<section class="ov-sektion" aria-labelledby="iva-uppf"><div class="sektion-huvud"><h2 id="iva-uppf">Uppföljning, senaste ${esc(u.dagar)} dagarna</h2></div>
    ${u.enheter.map(e => `<dl class="pt-uppf">
      <div><dt>Vårddygn</dt><dd>${esc(sv(e.vardygn))} på ${esc(e.vardtillfallen)} vårdtillfällen</dd></div>
      <div><dt>Beläggning</dt><dd>${esc(sv(e.belaggningProcent))} procent av ${esc(e.enhet.platser)} platser</dd></div>
      <div><dt>Medelvårdtid</dt><dd>${e.medelvardtidDygn != null ? `${esc(sv(e.medelvardtidDygn))} dygn` : 'Inga avslutade'}</dd></div>
      <div><dt>Vårdtyngd</dt><dd>Monitor ${esc(sv(e.vardtyngd.overvakningProcent ?? 0))} procent och infusion ${esc(sv(e.vardtyngd.infusionProcent ?? 0))} procent av vårddygnen</dd></div>
      ${e.kvalitet.map(k => `<div><dt>${esc(k.text)}</dt><dd>${k.varde == null ? 'Inget underlag' : k.enhet === 'procent' ? `${esc(sv(k.varde))} procent av ${esc(k.antal)}` : `${esc(k.varde)} av ${esc(k.antal)}`}</dd></div>`).join('')}
    </dl>`).join('')}
    <p class="dampad liten">${ikon.info}${esc(u.text)} ${esc(u.enheter[0].vardtyngd.text)}</p></section>`;
}

// Övervakningen av en patient.
export const patient = { namn: 'iva-patient', visa: visaPatient };
async function visaPatient(main, [pid], _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Övervakning')}<div id="iva-p"><p class="tom">Hämtar övervakningen.</p></div>`;
  const d = await rendera(main.querySelector('#iva-p'), pid, ctx, () => visaPatient(main, [pid], _q, ctx));
  if (d && main.querySelector('h1')) main.querySelector('h1').textContent = `Övervakning, ${d.patient.namn}`;
}
// Runda 11, r7: övervakningen ritas i ett element, så att samma vy finns som flik i journalen (patient-iva.js).
export async function rendera(el, pid, ctx = {}, ladda = () => rendera(el, pid, ctx), { iFlik = false } = {}) {
  const [d, an, inf, t, rt] = await Promise.all([
    api(`/api/patient/${encodeURIComponent(pid)}/iva`),
    far('las_journal') ? api(`/api/patient/${encodeURIComponent(pid)}/anestesi`).catch(() => null) : null,
    far('ordinera') ? api(`/api/patient/${encodeURIComponent(pid)}/iva/infusion/forslag`).catch(() => null) : null,
    api(`/api/patient/${encodeURIComponent(pid)}/iva/tillagg`).catch(() => null),
    api(`/api/patient/${encodeURIComponent(pid)}/iva/realtid`).catch(() => null),
  ]);
  if (ctx.aktuell && !ctx.aktuell()) return null;
  if (!el || !document.body.contains(el)) return null;
  const kanTitrera = ['lakare', 'sjukskoterska'].includes(S.session?.personal?.yrke);
  const timmar = d.vatska.timmar.slice(-12);
  el.innerHTML = `${iFlik ? '' : `<p class="under-text">${esc(d.patient.personnummer)}${d.patient.plats ? `, ${esc(d.patient.plats)}` : ''}</p>`}<p class="knapprad">${iFlik ? '' : '<a class="knapp liten sekundar" href="#/iva">Till översikten</a>'}<a class="knapp liten sekundar" href="#/patient/${encodeURIComponent(pid)}/matvarden">Mätvärden och utrustning</a>${iFlik ? '<a class="knapp liten sekundar" href="#/iva">Intensivvårdens översikt</a>' : `<a class="knapp liten sekundar" href="#/patient/${encodeURIComponent(pid)}">Journalen</a>`}</p>
    ${tillagg.begransningarHtml(t)}
    <section class="ov-sektion" aria-labelledby="iva-analys"><div class="sektion-huvud"><h2 id="iva-analys">Larm och förslag</h2></div>${analysHtml(d.analys)}</section>
    ${tillagg.realtidSektion(rt)}
    <section class="ov-sektion" aria-labelledby="iva-varden"><div class="sektion-huvud"><h2 id="iva-varden">Senaste värdena</h2></div>
      <dl class="iva-varden">${VARDEN.map(([typ, n, e]) => `<div><dt>${esc(n)} <span class="enhet">${esc(e)}</span></dt><dd>${vardeRuta(d.varden[typ], typ)}</dd></div>`).join('')}</dl>
      ${d.utrustning?.vantar.utrustning ? `<p class="ruta ruta-info liten">${ikon.info}<span>${d.utrustning.vantar.utrustning} värden från monitorn väntar på godkännande. <a href="#/patient/${encodeURIComponent(pid)}/matvarden">Granska och godkänn</a>.</span></p>` : ''}
      <div class="kurvor iva-kurvor">${d.kurvor.map(k => `<article class="kurvkort" aria-labelledby="iva-k-${esc(k.typ)}"><header><h3 id="iva-k-${esc(k.typ)}">${esc(k.namn)}</h3></header>${kurva(k)}</article>`).join('') || '<p class="tom liten">Inga värden de senaste timmarna.</p>'}</div>
      <p class="under-text">De senaste ${esc(d.timmar)} timmarna. Ihåliga punkter är värden från monitorn som inte är godkända.</p>
    </section>
    <section class="ov-sektion" aria-labelledby="iva-lm"><div class="sektion-huvud"><h2 id="iva-lm">Infusioner, bolusar och vätskor</h2></div>
      ${d.infusioner.length ? `<ul class="iva-infusioner">${d.infusioner.map(i => `<li class="mt-koppling"><div><strong>${esc(i.lakemedel)}</strong> ${esc(sv(i.dos, 3))} ${esc(i.dosEnhet)}, ${esc(sv(i.mlH))} ml/h (${esc(sv(i.perTimme, 3))} ${esc(i.perTimmeEnhet)} vid ${esc(sv(i.viktKg))} kg)
          <span class="under-text">Ordinerat ${esc(sv(i.intervall.min, 3))} till ${esc(sv(i.intervall.max, 3))} ${esc(i.dosEnhet)}.${i.senastAndrad ? ` Ändrad ${esc(tidpunkt(i.senastAndrad.tid))} av ${esc(i.senastAndrad.av ?? '')}.` : ''}${i.pump?.senaste ? ` Pumpen: ${esc(i.pump.senaste.text)}.` : ' Ingen pump kopplad.'}</span></div>
        ${i.titrering ? `<p class="${i.titrering.niva === 'larm' ? 'text-larm' : 'under-text'}">${esc(i.titrering.text)}</p>` : ''}
        ${kanTitrera && i.titrering?.forslag != null ? `<p class="knapprad"><button type="button" class="knapp liten" data-titrera="${esc(i.ordinationId)}">Ändra till ${esc(sv(i.titrering.forslag, 3))} ${esc(i.dosEnhet)}</button></p>` : ''}
      </li>`).join('')}</ul>` : '<p class="tom liten">Inga kontinuerliga infusioner.</p>'}
      ${inf && inf.protokoll.length ? `<form class="mt-koppla" id="iva-ny-inf" novalidate aria-labelledby="iva-ny-inf-r"><h3 id="iva-ny-inf-r">Ny kontinuerlig infusion</h3><p class="hjalp">${esc(inf.text)}</p>
        <div class="falt-rad"><div class="falt"><label for="iva-protokoll">Protokoll</label><select id="iva-protokoll" name="protokoll">${inf.protokoll.map(x => `<option value="${esc(x.id)}">${esc(x.namn)}${x.startMlH != null ? `, start ${esc(sv(x.startMlH))} ml/h` : ''}</option>`).join('')}</select></div>
        <div class="falt"><label for="iva-orsak">Ordinationsorsak</label><input id="iva-orsak" name="ordinationsorsak" autocomplete="off"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Ordinera</button></div></div><p class="form-fel" role="alert" hidden></p></form>` : ''}
      ${tillagg.sammanrakningHtml(t)}
      ${d.handelser.length ? `<h3>Det senaste dygnet</h3><ul class="iva-handelser">${d.handelser.map(h => `<li><span class="pt-tid">${esc(klockslag(h.tid))}</span> ${esc(h.text)}</li>`).join('')}</ul>` : ''}
    </section>
    <section class="ov-sektion" aria-labelledby="iva-vb"><div class="sektion-huvud"><h2 id="iva-vb">Vätskebalans per timme</h2><p class="under-text">Det senaste dygnet: in ${esc(sv(d.vatska.summaIn, 0))} ml, ut ${esc(sv(d.vatska.summaUt, 0))} ml, balans ${d.vatska.balans > 0 ? '+' : ''}${esc(sv(d.vatska.balans, 0))} ml${d.vatska.vikt ? `, vikt ${esc(sv(d.vatska.vikt.kg))} kg` : ''}.</p></div>
      ${d.vatska.oliguri ? `<p class="ruta ruta-obs liten">${ikon.varning}<span>${esc(d.vatska.oliguri.text)}</span></p>` : ''}
      <div class="tabellrulle"><table class="tabell tat"><caption class="sr">Intag, förluster och balans per timme de senaste tolv timmarna</caption><thead><tr><th scope="col">Timme</th><th scope="col">In</th><th scope="col">Ut</th><th scope="col">Urin</th><th scope="col">Urin ml/kg/h</th><th scope="col">Dränage</th><th scope="col">Kumulativ balans</th></tr></thead>
        <tbody>${timmar.map(t => `<tr><th scope="row">${esc(klockslag(t.fran))}</th><td>${esc(sv(t.in, 0))}</td><td>${esc(sv(t.ut, 0))}</td><td>${esc(sv(t.urin, 0))}</td><td${t.urinMlKgH != null && t.urin && t.urinMlKgH < 0.5 ? ' class="text-larm"' : ''}>${t.urinMlKgH != null && t.urin ? esc(sv(t.urinMlKgH, 2)) : ''}</td><td>${esc(sv(t.dran, 0))}</td><td>${esc(sv(t.kumulativ, 0))}</td></tr>`).join('')}</tbody></table></div>
    </section>
    ${tillagg.ovrigaHtml(t)}
    ${an ? anestesiHtml(an) : ''}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;
  tillagg.koppla(el, pid, t, ladda);
  tillagg.startaRealtid(el, pid, ctx);

  el.querySelectorAll('[data-titrera]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(pid)}/iva/infusion/${encodeURIComponent(b.dataset.titrera)}/dos`, { metod: 'POST', data: {} })); notis(r.text); ladda(); } catch { /* notis */ }
  }));
  const nf = el.querySelector('#iva-ny-inf');
  nf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await medKnapp(nf.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(pid)}/iva/infusion`, { metod: 'POST', data: { protokoll: nf.protokoll.value, ordinationsorsak: nf.ordinationsorsak.value } }), nf); notis(r.text); ladda(); } catch { /* i formuläret */ }
  });
  const af = el.querySelector('#iva-anestesi');
  af?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { ingrepp: af.ingrepp.value, asa: Number(af.asa.value), akut: af.akut.checked, anestesiform: af.anestesiform.value, luftvag: { mallampati: af.mallampati.value || null, tidigareSvarIntubation: af.svar.checked } };
    if (af.planerad.value) data.planerad = new Date(af.planerad.value).toISOString();
    try { const r = await medKnapp(af.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(pid)}/anestesi`, { metod: 'POST', data }), af); notis(r.text); ladda(); } catch { /* i formuläret */ }
  });
  return d;
}

function anestesiHtml(an) {
  const f = an.forslag;
  return `<section class="ov-sektion" aria-labelledby="iva-an"><div class="sektion-huvud"><h2 id="iva-an">Anestesibedömning</h2></div>
    ${an.bedomningar.length ? `<ul class="iva-handelser">${an.bedomningar.map(b => `<li><strong>${esc(b.asaText)}</strong> ${esc(b.ingrepp)}, ${esc(b.anestesiformText)}. <span class="under-text">${esc(tidpunkt(b.tid))}, ${esc(b.av ?? '')}${b.fasta ? `. ${esc(b.fasta.text)}` : ''}</span></li>`).join('')}</ul>` : '<p class="tom liten">Ingen anestesibedömning är gjord.</p>'}
    ${f ? `<form class="mt-koppla" id="iva-anestesi" novalidate aria-labelledby="iva-an-ny"><h3 id="iva-an-ny">Ny anestesibedömning</h3><p class="hjalp">${esc(f.text)}</p>
      <dl class="pt-uppf">
        <div><dt>Läkemedel</dt><dd>${f.lakemedel.length ? f.lakemedel.map(l => `${esc(l.text)}${l.observation ? ` <strong>${esc(l.observation)}</strong>` : ''}`).join('<br>') : 'Inga aktuella'}</dd></div>
        <div><dt>Överkänslighet</dt><dd>${f.overkanslighet.length ? f.overkanslighet.map(o => esc(`${o.amne}${o.reaktion ? ` (${o.reaktion})` : ''}`)).join(', ') : 'Ingen registrerad'}</dd></div>
        <div><dt>Diagnoser</dt><dd>${f.diagnoser.length ? f.diagnoser.map(d => esc(`${d.kod} ${d.text}`)).join('<br>') : 'Inga'}</dd></div>
        <div><dt>Vikt och BMI</dt><dd>${f.vikt ? `${esc(sv(f.vikt.kg))} kg` : 'Ingen godkänd vikt'}${f.bmi ? `, BMI ${esc(sv(f.bmi))}` : ''}</dd></div>
        <div><dt>Tidigare anestesier</dt><dd>${f.tidigare.length ? f.tidigare.map(t => esc(`${t.tid.slice(0, 10)} ${t.ingrepp}, ASA ${t.asa}`)).join('<br>') : 'Inga registrerade i Vårdkällan'}</dd></div>
        ${f.luftvag.risker.length ? `<div><dt>Luftväg</dt><dd class="text-larm">${f.luftvag.risker.map(esc).join(' ')}</dd></div>` : ''}
      </dl>
      <div class="falt-rad">
        <div class="falt"><label for="an-ingrepp">Ingrepp</label><input id="an-ingrepp" name="ingrepp" autocomplete="off"></div>
        <div class="falt"><label for="an-planerad">Planerad tid</label><input id="an-planerad" name="planerad" type="datetime-local"></div>
        <div class="falt smal"><label for="an-asa">ASA-klass</label><select id="an-asa" name="asa">${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${n === f.asa.asa ? ' selected' : ''}>ASA ${n}</option>`).join('')}</select><span class="hjalp">${esc(f.asa.text)} ${esc(f.asa.grund)}</span></div>
        <div class="falt"><label for="an-form">Anestesiform</label><select id="an-form" name="anestesiform">${Object.entries(an.anestesiformer).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="an-mallampati">Mallampati</label><select id="an-mallampati" name="mallampati"><option value="">Inte bedömt</option>${[1, 2, 3, 4].map(n => `<option value="${n}">${n}</option>`).join('')}</select></div>
      </div>
      <div class="falt-rad"><div class="kryssfalt"><input type="checkbox" id="an-akut" name="akut"><label for="an-akut">Akut ingrepp (E)</label></div>
        <div class="kryssfalt"><input type="checkbox" id="an-svar" name="svar"><label for="an-svar">Svår intubation tidigare</label></div></div>
      <p class="under-text">Systemet räknar fastan ur den planerade tiden: ${esc(String(6))} timmar för fast föda och ${esc(String(2))} timmar för klara drycker.</p>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp">Spara bedömningen</button></div>
    </form>` : ''}
  </section>`;
}
