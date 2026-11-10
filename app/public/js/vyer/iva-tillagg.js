// Intensivvård, version 1.1 (runda 11, r7, Sussa 4.6.1.2 till 4.6.1.7): realtid med vågformer från den simulerade
// monitorn, behandlingsbegränsningar, patientens egna gränser, vätskebalansen med perspiratio, prognos och mål,
// andningsstödet, vårdtyngden enligt NEMS, sammanräkningen av givna doser och överrapporteringen enligt SBAR. Systemet
// räknar och föreslår, och användaren bekräftar.
import { esc, api, tidpunkt, klockslag, notis, medKnapp, ikon, tal } from '../ui.js';

const sv = (v, d = 0) => (v == null ? '' : tal(v, d));
const plus = (v) => `${v > 0 ? '+' : ''}${sv(v, 0)}`;
const NIVA = { larm: 'ruta-larm', varning: 'ruta-obs', observation: 'ruta-info', info: 'ruta-info' };
const LARMNAMN = { larm: 'Larm', varning: 'Varning', observation: 'Observation' };
const VILLKOR = { under: 'under', over: 'över' };

// Realtidsvisningen: en remsa per vågform och de aktuella siffrorna.
function remsa(k) {
  const B = 600, H = 70;
  const v = k.varden;
  if (!v.length) return '';
  let min = Math.min(...v), max = Math.max(...v);
  if (max - min < 1e-6) { min -= 1; max += 1; }
  const pts = v.map((y, i) => `${(i / (v.length - 1) * B).toFixed(1)},${(4 + (1 - (y - min) / (max - min)) * (H - 8)).toFixed(1)}`).join(' ');
  return `<div class="iva-remsa iva-remsa-${esc(k.id)}"><span class="iva-remsa-namn">${esc(k.namn)}</span>
    <svg viewBox="0 0 ${B} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`${k.namn}, de senaste ${Math.round(v.length / k.hz)} sekunderna`)}"><polyline class="iva-vag" points="${pts}"/></svg></div>`;
}
export function realtidHtml(r, pausad = false) {
  if (!r) return '';
  if (!r.kopplad) return `<p class="tom liten">${esc(r.text)}</p>`;
  const v = r.varden;
  const siffra = (namn, varde, enhet) => `<div><dt>${esc(namn)}</dt><dd><strong>${esc(varde ?? '')}</strong> <span class="enhet">${esc(enhet)}</span></dd></div>`;
  return `<p class="under-text">${esc(r.monitor.modell)}, ${esc(r.monitor.serienummer)}, kopplad sedan ${esc(tidpunkt(r.monitor.sedan))}. Uppdaterad kl. <span data-iva-rt-tid>${esc(klockslag(r.tid))}</span>.</p>
    ${r.larm.length ? `<ul class="iva-analys" aria-live="polite">${r.larm.map(l => `<li class="ruta ${NIVA[l.niva]} liten">${l.niva === 'larm' ? ikon.larm : ikon.info}<div><strong>${esc(l.niva === 'larm' ? 'Monitorlarm' : LARMNAMN[l.niva])}:</strong> ${esc(l.text)}</div></li>`).join('')}</ul>` : '<p class="liten">Inga larm från monitorn.</p>'}
    <div class="iva-realtid${pausad ? ' pausad' : ''}">
      <div class="iva-remsor">${r.kurvor.map(remsa).join('')}</div>
      <dl class="iva-siffror">${siffra('Puls', v.puls, 'slag/min')}${siffra('Blodtryck', `${v.sys}/${v.dia}`, 'mmHg')}${siffra('MAP', v.map, 'mmHg')}${siffra('SpO₂', v.saturation, '%')}${siffra('Andning', v.andningsfrekvens, '/min')}${siffra('Temp', sv(v.temp, 1), '°C')}</dl>
    </div>
    <p class="under-text">${esc(r.text)} ${esc(r.demo)}</p>`;
}

// Uppdaterar realtidsvisningen var tredje sekund så länge vyn är öppen och användaren inte har pausat. Pausen gör att
// innehåll som rör sig kan stoppas (WCAG 2.2.2).
export function startaRealtid(el, pid, ctx = {}) {
  const ruta = el.querySelector('#iva-rt');
  const knapp = el.querySelector('[data-iva-rt-paus]');
  if (!ruta) return;
  let pausad = false;
  let timer = null;
  const tick = async () => {
    timer = null;
    if (!document.body.contains(ruta) || (ctx.aktuell && !ctx.aktuell())) return;
    if (!pausad && !document.hidden) {
      try { const r = await api(`/api/patient/${encodeURIComponent(pid)}/iva/realtid`); if (document.body.contains(ruta)) ruta.innerHTML = realtidHtml(r, pausad); if (!r.kopplad) return; } catch { return; }
    }
    if (document.body.contains(ruta)) timer = setTimeout(tick, 3000);
  };
  knapp?.addEventListener('click', () => {
    pausad = !pausad;
    knapp.setAttribute('aria-pressed', String(pausad));
    knapp.textContent = pausad ? 'Fortsätt realtid' : 'Pausa realtid';
    ruta.querySelector('.iva-realtid')?.classList.toggle('pausad', pausad);
  });
  timer = setTimeout(tick, 3000);
  return () => { if (timer) clearTimeout(timer); };
}

function reglerHtml(t) {
  const aktiva = t.regler.filter(r => r.aktiv);
  return `<section class="ov-sektion" aria-labelledby="iva-regler"><div class="sektion-huvud"><h2 id="iva-regler">Patientens egna gränser</h2>
      <p class="under-text">Avdelningens gränser gäller när patienten inte har en egen. En egen gräns som är mildare än avdelningens tystar aldrig larmet: systemet visar då en observation med motiveringen.</p></div>
    ${aktiva.length ? `<ul class="enkel-lista">${aktiva.map(r => `<li><span><strong>${esc(r.text)}</strong><span class="under-text">${r.ersatter ? 'Ersätter avdelningens gräns. ' : ''}${esc(r.motivering)}. ${esc(r.av ?? '')}, ${esc(tidpunkt(r.skapad))}.</span></span>
      ${t.kan.regler ? `<button type="button" class="knapp liten sekundar" data-iva-avsluta-regel="${esc(r.id)}">Avsluta</button>` : ''}</li>`).join('')}</ul>` : '<p class="tom liten">Inga egna gränser. Avdelningens gränser gäller.</p>'}
    ${t.kan.regler ? `<details><summary>Ny egen gräns</summary><form id="iva-regel" class="mt-koppla" novalidate>
      <div class="falt-rad">
        <div class="falt"><label for="iva-r-param">Parameter</label><select id="iva-r-param" name="parameter">${t.parametrar.map(p => `<option value="${esc(p.id)}">${esc(p.namn)}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="iva-r-villkor">Larma när värdet är</label><select id="iva-r-villkor" name="villkor"><option value="under">under</option><option value="over">över</option></select></div>
        <div class="falt smal"><label for="iva-r-grans">Gräns</label><input id="iva-r-grans" name="grans" inputmode="decimal" autocomplete="off"></div>
        <div class="falt smal"><label for="iva-r-niva">Nivå</label><select id="iva-r-niva" name="niva"><option value="larm">Larm</option><option value="varning">Varning</option></select></div>
      </div>
      <div class="falt"><label for="iva-r-mot">Motivering</label><input id="iva-r-mot" name="motivering" maxlength="300" autocomplete="off"></div>
      <p class="hjalp" data-iva-r-std></p>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp">Spara gränsen</button></div></form></details>` : ''}
  </section>`;
}

function vatskaHtml(t) {
  const v = t.vatska;
  const stod = v.aktivtStod;
  return `<section class="ov-sektion" aria-labelledby="iva-vm"><div class="sektion-huvud"><h2 id="iva-vm">Vätska, mål och andningsstöd</h2>
      <p class="under-text">Balans det senaste dygnet ${esc(plus(v.balans))} ml, med perspiratio ${esc(plus(v.balansMedPerspiratio))} ml.</p></div>
    ${v.perspiratio ? `<p>${esc(v.perspiratio.text)}</p>` : '<p class="dampad">Perspiratio räknas när patienten har en godkänd vikt.</p>'}
    <p>${esc(v.prognos.text)}</p>
    ${v.rekommendationer.length ? `<ul class="iva-analys">${v.rekommendationer.map(r => `<li class="ruta ${NIVA[r.niva] ?? 'ruta-info'} liten">${ikon.info}<div>${esc(r.text)}${r.gora ? ` <span class="under-text">${esc(r.gora)}</span>` : ''}</div></li>`).join('')}</ul>` : '<p class="tom liten">Inga behandlingsmål är satta.</p>'}
    <p>${stod ? `Andningsstöd: <strong>${esc(stod.typText)}</strong>, ${esc(stod.befuktningText.toLowerCase())}, sedan ${esc(tidpunkt(stod.start))}.` : 'Inget andningsstöd är registrerat.'}</p>
    ${t.kan.andningsstod ? `<form id="iva-stod" class="falt-rad" novalidate>
      <div class="falt"><label for="iva-stod-typ">Andningsstöd</label><select id="iva-stod-typ" name="typ">${Object.entries(t.andningsstodTyper).map(([k, x]) => `<option value="${esc(k)}"${stod?.typ === k ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="falt"><label for="iva-stod-bef">Befuktning</label><select id="iva-stod-bef" name="befuktning">${Object.entries(t.befuktningar).map(([k, x]) => `<option value="${esc(k)}"${(stod?.befuktning ?? 'aktiv') === k ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button>${stod ? ' <button type="button" class="knapp text" data-iva-stod-avsluta>Avsluta andningsstödet</button>' : ''}</div>
      <p class="form-fel" role="alert" hidden></p></form>` : ''}
    ${t.kan.mal ? `<details><summary>Sätt behandlingsmål</summary><form id="iva-mal" class="falt-rad" novalidate>
      <div class="falt"><label for="iva-mal-typ">Mål</label><select id="iva-mal-typ" name="typ">${Object.entries(t.malTyper).map(([k, m]) => `<option value="${esc(k)}">${esc(m.namn)} (${esc(m.enhet)})</option>`).join('')}</select></div>
      <div class="falt smal"><label for="iva-mal-varde">Värde</label><input id="iva-mal-varde" name="varde" inputmode="decimal" autocomplete="off"></div>
      <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Sätt målet</button></div><p class="form-fel" role="alert" hidden></p></form></details>` : ''}
    <p class="dampad liten">${esc(v.demoregel)}</p>
  </section>`;
}

function nemsHtml(t) {
  const n = t.nems;
  const valda = new Set((n.idag?.poster ?? n.forslag.map(f => f.id)));
  const varfor = new Map(n.forslag.map(f => [f.id, f.varfor]));
  return `<section class="ov-sektion" aria-labelledby="iva-nems"><div class="sektion-huvud"><h2 id="iva-nems">Vårdtyngd enligt NEMS</h2>
      <p class="under-text">${n.idag ? `Registrerat för ${esc(n.dygn)}: ${esc(n.idag.poang)} poäng av ${esc(n.idag.av ?? '')}.` : `Systemets förslag för ${esc(n.dygn)}: ${esc(n.forslagPoang)} poäng.`}</p></div>
    ${n.kan ? `<form id="iva-nems-form" novalidate><fieldset class="kryssgrupp"><legend>Poster det senaste dygnet. Systemet har kryssat i det som står i journalen.</legend>
      ${n.poster.map(p => `<div class="kryssfalt"><input type="checkbox" id="nems-${esc(p.id)}" name="poster" value="${esc(p.id)}"${valda.has(p.id) ? ' checked' : ''}><label for="nems-${esc(p.id)}">${esc(p.text)}, ${esc(p.poang)} poäng${varfor.has(p.id) ? ` <span class="under-text">${esc(varfor.get(p.id))}</span>` : ''}</label></div>`).join('')}
      </fieldset><p class="form-fel" role="alert" hidden></p><div class="knapprad"><button type="submit" class="knapp sekundar">Registrera vårdtyngden</button></div></form>`
      : `<ul class="enkel-lista">${n.forslag.map(f => `<li>${esc(n.poster.find(p => p.id === f.id)?.text ?? f.id)} <span class="under-text">${esc(f.varfor)}</span></li>`).join('') || '<li class="dampad">Inget att föreslå.</li>'}</ul>`}
    <p class="dampad liten">${esc(n.kalla)} ${esc(n.demoregel)}</p>
  </section>`;
}

function overrapporteringHtml(t) {
  const o = t.overrapportering;
  const del = (rubrik, rader) => `<div><dt>${esc(rubrik)}</dt><dd>${rader.map(r => `<p>${esc(r)}</p>`).join('')}</dd></div>`;
  return `<section class="ov-sektion" aria-labelledby="iva-sbar"><div class="sektion-huvud"><h2 id="iva-sbar">Överrapportering</h2>
      <p class="under-text">Systemet skriver underlaget enligt SBAR ur övervakningen och journalen.</p></div>
    <dl class="pt-uppf iva-sbar">${del('Situation', o.situation)}${del('Bakgrund', o.bakgrund)}${del('Aktuellt tillstånd', o.aktuellt)}${del('Rekommendation', o.rekommendation)}</dl>
    <div class="knapprad"><button type="button" class="knapp liten sekundar" data-iva-sbar-kopiera>Kopiera överrapporteringen</button></div>
  </section>`;
}

// Delarna som läggs i övervakningen. Behandlingsbegränsningarna står överst, realtiden efter larmen.
export function begransningarHtml(t) {
  if (!t?.begransningar.length) return '';
  return `<div class="ruta ruta-larm" data-iva-begransning>${ikon.varning}<div><p><strong>Behandlingsbegränsning:</strong> ${t.begransningar.map(b => esc(b.term)).join('. ')}.</p>
    <p class="under-text">${t.begransningar.map(b => esc(`${b.vardenhet ?? ''}${b.tid ? `, ${tidpunkt(b.tid)}` : ''}`)).join(' ')}</p></div></div>`;
}
export function realtidSektion(r) {
  return `<section class="ov-sektion" aria-labelledby="iva-rt-r"><div class="sektion-huvud"><h2 id="iva-rt-r">Realtid från monitorn</h2>
    ${r?.kopplad ? '<button type="button" class="knapp liten sekundar" data-iva-rt-paus aria-pressed="false">Pausa realtid</button>' : ''}</div>
    <div id="iva-rt">${realtidHtml(r)}</div></section>`;
}
export const sammanrakningHtml = (t) => (t?.sammanrakning.length ? `<h3>Givna doser</h3><ul class="iva-handelser">${t.sammanrakning.map(s => `<li class="${s.over ? 'text-larm' : ''}">${esc(s.text)}</li>`).join('')}</ul>` : '');
export function ovrigaHtml(t) {
  if (!t) return '';
  return `${reglerHtml(t)}${vatskaHtml(t)}${nemsHtml(t)}${overrapporteringHtml(t)}`;
}

export function koppla(el, pid, t, ladda) {
  if (!t) return;
  const id = encodeURIComponent(pid);
  const skicka = (sel, vag, data) => el.querySelector(sel)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/patient/${id}/${vag}`, { metod: 'POST', data: data(f) }), f); notis(r.text); ladda(); } catch { /* i formuläret */ }
  });
  // Avdelningens gräns för den valda parametern och riktningen visas medan läkaren skriver, så att ingen behöver minnas den.
  const rf = el.querySelector('#iva-regel');
  const visaStd = () => {
    if (!rf) return;
    const p = t.parametrar.find(x => x.id === rf.parameter.value);
    const s = p?.standard?.[rf.villkor.value];
    rf.querySelector('[data-iva-r-std]').textContent = s != null ? `Avdelningens gräns är ${VILLKOR[rf.villkor.value]} ${sv(s, p.id === 'temp' ? 1 : 0)} ${p.enhet}. Den egna gränsen ersätter den för patienten.` : `Avdelningen har ingen gräns ${VILLKOR[rf.villkor.value]} för ${p?.namn.toLowerCase() ?? ''}. Den egna gränsen läggs till. Värdet ska vara ${p?.min} till ${p?.max} ${p?.enhet ?? ''}.`;
  };
  rf?.parameter.addEventListener('change', visaStd);
  rf?.villkor.addEventListener('change', visaStd);
  visaStd();
  skicka('#iva-regel', 'iva/regler', (f) => ({ parameter: f.parameter.value, villkor: f.villkor.value, grans: f.grans.value, niva: f.niva.value, motivering: f.motivering.value }));
  skicka('#iva-stod', 'iva/andningsstod', (f) => ({ typ: f.typ.value, befuktning: f.befuktning.value }));
  skicka('#iva-mal', 'iva/mal', (f) => ({ typ: f.typ.value, varde: f.varde.value }));
  skicka('#iva-nems-form', 'iva/nems', (f) => ({ poster: [...f.querySelectorAll('[name=poster]:checked')].map(x => x.value) }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.ivaAvslutaRegel) { const r = await medKnapp(b, () => api(`/api/patient/${id}/iva/regler/${encodeURIComponent(b.dataset.ivaAvslutaRegel)}/avsluta`, { metod: 'POST', data: {} })); notis(r.text); ladda(); }
      else if (b.hasAttribute('data-iva-stod-avsluta')) { const r = await medKnapp(b, () => api(`/api/patient/${id}/iva/andningsstod/avsluta`, { metod: 'POST', data: {} })); notis(r.text); ladda(); }
      else if (b.hasAttribute('data-iva-sbar-kopiera')) { await navigator.clipboard?.writeText(t.overrapportering.text); notis('Överrapporteringen är kopierad.'); }
    } catch { /* notis */ }
  });
}
