// Gemensamt för graviditetsjournalen, förlossningen och mödrahälsovården (runda 11, r3): varningsrutorna, kurvorna för
// symfys-fundusmått, partogram och CTG, rapporteringen till Graviditetsregistret och uppföljningen.
import { esc, api, tidpunkt, klockslag, ikon, notis, medKnapp, tal } from './ui.js';

export function varningar(lista, { niva = 'obs' } = {}) {
  if (!lista?.length) return '';
  return `<div class="ruta ruta-${niva === 'larm' ? 'larm' : 'obs'} liten ob-varningar" role="status">${ikon.varning}<ul class="enkel-lista">${lista.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>`;
}
export const attGora = (lista) => (lista?.length ? `<div class="ruta ruta-info liten ob-attgora">${ikon.info}<div><p><strong>Systemet föreslår</strong></p><ul class="enkel-lista">${lista.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div></div>` : '');

// Symfys-fundusmåttet mot veckan med det förväntade intervallet.
export function sfSvg(punkter) {
  if (!punkter?.length) return '<p class="tom liten">Inga symfys-fundusmått ännu.</p>';
  const B = 320, H = 150, V = 30, T = 8, U = 20, v0 = 20, v1 = 42, c0 = 14, c1 = 46;
  const x = (v) => V + ((v - v0) / (v1 - v0)) * (B - V - 8), y = (c) => T + (1 - (c - c0) / (c1 - c0)) * (H - T - U);
  const band = `${x(v0)},${y(v0 - 3)} ${x(v1)},${y(v1 - 3)} ${x(v1)},${y(v1 + 3)} ${x(v0)},${y(v0 + 3)}`;
  return `<svg class="kurva ob-kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(`Symfys-fundusmått: ${punkter.map(p => `vecka ${tal(p.vecka)} ${tal(p.sfMatt)} cm${p.avviker ? ', avviker' : ''}`).join('; ')}.`)}">
    <polygon class="ob-band" points="${band}"/>
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/><line class="kurva-axel" x1="${V}" x2="${B - 8}" y1="${H - U}" y2="${H - U}"/>
    ${[20, 25, 30, 35, 40].map(v => `<text class="kurva-text" x="${x(v)}" y="${H - 6}" text-anchor="middle">v ${v}</text>`).join('')}
    ${[20, 30, 40].map(c => `<text class="kurva-text" x="${V - 4}" y="${y(c) + 3}" text-anchor="end">${c}</text>`).join('')}
    ${punkter.length > 1 ? `<polyline class="kurva-linje" points="${punkter.map(p => `${x(p.vecka).toFixed(1)},${y(p.sfMatt).toFixed(1)}`).join(' ')}"/>` : ''}
    ${punkter.map(p => `<circle class="kurva-punkt${p.avviker ? ' kurva-utanfor' : ''}" cx="${x(p.vecka).toFixed(1)}" cy="${y(p.sfMatt).toFixed(1)}" r="3"/>`).join('')}
  </svg><p class="under-text">Det skuggade bandet är veckan plus minus tre centimeter. Röda punkter avviker.</p>`;
}

// Partogrammet: modermunnens öppning med varningslinjen och åtgärdslinjen.
export function partogramSvg(p) {
  const aktiva = p.filter(x => x.varningslinje != null);
  if (!p.length) return '<p class="tom liten">Ingen undersökning registrerad.</p>';
  const B = 360, H = 170, V = 28, T = 8, U = 22;
  const t0 = Date.parse(p[0].tid), t1 = Math.max(Date.parse(p.at(-1).tid), t0 + 6 * 3600_000);
  const x = (t) => V + ((Date.parse(t) - t0) / (t1 - t0)) * (B - V - 8), y = (o) => T + (1 - o / 10) * (H - T - U);
  const linje = (nyckel, klass) => (aktiva.length > 1 ? `<polyline class="${klass}" points="${aktiva.map(q => `${x(q.tid).toFixed(1)},${y(q[nyckel]).toFixed(1)}`).join(' ')}"/>` : '');
  return `<svg class="kurva ob-kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(`Partogram: ${p.map(q => `${klockslag(q.tid)} ${q.oppning} cm`).join(', ')}. ${aktiva.length ? `Senast varningslinje ${tal(aktiva.at(-1).varningslinje)} och åtgärdslinje ${tal(aktiva.at(-1).atgardslinje)} cm.` : 'Latent fas.'}`)}">
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/><line class="kurva-axel" x1="${V}" x2="${B - 8}" y1="${H - U}" y2="${H - U}"/>
    ${[0, 4, 10].map(o => `<text class="kurva-text" x="${V - 4}" y="${y(o) + 3}" text-anchor="end">${o}</text>`).join('')}
    <text class="kurva-text" x="${V}" y="${H - 6}">${esc(klockslag(p[0].tid))}</text>
    ${linje('varningslinje', 'ob-varningslinje')}${linje('atgardslinje', 'ob-atgardslinje')}
    <polyline class="kurva-linje" points="${p.map(q => `${x(q.tid).toFixed(1)},${y(q.oppning).toFixed(1)}`).join(' ')}"/>
    ${p.map(q => `<circle class="kurva-punkt${q.lage === 'over_atgardslinje' ? ' kurva-utanfor' : ''}" cx="${x(q.tid).toFixed(1)}" cy="${y(q.oppning).toFixed(1)}" r="3"/>`).join('')}
  </svg><p class="under-text">Heldragen linje: öppningen i centimeter. Streckad: varningslinjen. Prickad: åtgärdslinjen fyra timmar senare.</p>`;
}

// CTG: fosterljuden per foster och värkarna de senaste 30 minuterna.
export function ctgSvg(c) {
  if (!c?.kopplad || !c.punkter?.length) return '';
  const B = 560, H = 220, V = 30, T = 6, Mid = 150, U = 18;
  const p = c.punkter, t0 = Date.parse(p[0].tid), t1 = Math.max(Date.parse(p.at(-1).tid), t0 + 60_000);
  const x = (t) => V + ((Date.parse(t) - t0) / (t1 - t0)) * (B - V - 8);
  const yf = (f) => T + (1 - (Math.min(210, Math.max(60, f)) - 60) / 150) * (Mid - T - 6);
  const yt = (v) => Mid + 6 + (1 - v / 100) * (H - Mid - 6 - U);
  const kanaler = p[0].fhr.map((_, i) => `<polyline class="ob-ctg ob-ctg-${i + 1}" points="${p.map(q => `${x(q.tid).toFixed(1)},${yf(q.fhr[i]).toFixed(1)}`).join(' ')}"/>`).join('');
  return `<svg class="kurva ob-ctg-kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(`CTG de senaste ${Math.round((t1 - t0) / 60000)} minuterna. ${c.analys.map(a => `${c.analys.length > 1 ? `Foster ${a.foster}: ` : ''}${a.klassText ?? ''}. ${a.text}`).join(' ')}`)}">
    <rect class="ob-normalband" x="${V}" width="${B - V - 8}" y="${yf(150)}" height="${yf(110) - yf(150)}"/>
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/>
    ${[60, 110, 150, 210].map(f => `<text class="kurva-text" x="${V - 4}" y="${yf(f) + 3}" text-anchor="end">${f}</text>`).join('')}
    ${kanaler}
    <polyline class="ob-toko" points="${p.map(q => `${x(q.tid).toFixed(1)},${yt(q.toko).toFixed(1)}`).join(' ')}"/>
    <text class="kurva-text" x="${V}" y="${H - 4}">${esc(klockslag(p[0].tid))}</text><text class="kurva-text" x="${B - 8}" y="${H - 4}" text-anchor="end">${esc(klockslag(p.at(-1).tid))}</text>
  </svg><p class="under-text">Övre delen: fosterljuden i slag per minut${p[0].fhr.length > 1 ? ', en linje per foster (heldragen foster 1, streckad foster 2)' : ''}, med normalbandet 110 till 150. Nedre delen: värkarna.</p>`;
}

// Rapporteringen till Graviditetsregistret, som på barnhälsovårdens sida.
export function registretHtml(r) {
  const fel = r.poster.filter(p => p.fel.length);
  return `<section aria-labelledby="ob-gr" class="ruta ob-register"><h2 id="ob-gr">Rapport till Graviditetsregistret</h2>
    <p>${esc(r.text)} ${r.sedan ? `Förra utskicket ${esc(tidpunkt(r.sedan))}, kvittens ${esc(r.forraKvittens)}.` : 'Inget har skickats än.'}</p>
    <p class="under-text">Mottagare: ${esc(r.mottagare)}. Systemet sammanställer det som är nytt sedan förra utskicket och kontrollerar varje post före utskicket. Svaren på frågorna om våld skickas aldrig, bara om frågorna är ställda.</p>
    ${fel.length ? `<div class="ruta ruta-larm" data-gr-fel>${ikon.varning}<div><p><strong>${fel.length === 1 ? 'En post har' : `${fel.length} poster har`} fel och skickas inte förrän felet är rättat.</strong></p>
      <ul>${fel.map(p => `<li>${esc(p.patient?.namn ?? '')}: ${p.fel.map(f => `<a href="${esc(f.href)}">${esc(f.text)}</a>`).join(' ')}</li>`).join('')}</ul></div></div>` : ''}
    <dl class="faktarad">${r.perTyp.map(t => `<div><dt>Nya ${esc(t.text)}</dt><dd>${t.antal}</dd></div>`).join('')}
      <div><dt>Motsatt sig registrering</dt><dd>${r.undantagna.motsatt}</dd></div><div><dt>Skyddade personuppgifter</dt><dd>${r.undantagna.skyddad}</dd></div></dl>
    <p class="under-text">Den som har motsatt sig registreringen rapporteras inte (patientdatalagen 7 kap. 2 §). ${esc(r.demoregel)}</p>
    ${r.antal.klara ? '<button type="button" class="knapp" data-gr-skicka>Skicka till registret</button>' : ''}
    ${r.utskick.length ? `<details><summary>Tidigare utskick (${r.utskick.length})</summary><ul class="enkel-lista">${r.utskick.map(x => `<li><strong>${esc(x.kvittens)}</strong><span class="under-text">${esc(tidpunkt(x.tid))} av ${esc(x.av ?? '')}: ${x.antal} poster.</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}
export function kopplaRegistret(el, ladda) {
  el.querySelector('[data-gr-skicka]')?.addEventListener('click', async (e) => {
    try { const s = await medKnapp(e.currentTarget, () => api('/api/graviditetsregistret/skicka', { metod: 'POST', data: {} })); notis(s.text); ladda(); } catch { /* notis */ }
  });
}

const procent = (v) => (v == null ? 'Inget underlag' : `${tal(v, 0)} procent`);
export function uppfoljningHtml(u) {
  if (!u) return '';
  return `<section aria-labelledby="ob-uf" class="ob-uppfoljning"><h2 id="ob-uf">Uppföljning på ${esc(u.vardenhet?.namn ?? '')}, ${esc(u.fran)} till ${esc(u.till)}</h2>
    <dl class="pt-uppf">
      <div><dt>Pågående graviditeter</dt><dd>${u.graviditeter.pagaende}, varav ${u.graviditeter.flerbord} flerbörd och ${u.graviditeter.overBpd} efter beräknad partus</dd></div>
      <div><dt>Inskrivningssamtal</dt><dd>${u.inskrivning.samtal}. Frågorna om våld ställda: ${procent(u.inskrivning.valdfraganStalld)}. Röker vid inskrivningen: ${procent(u.inskrivning.rokerVidInskrivning)}.</dd></div>
      <div><dt>Ultraljud</dt><dd>${u.ultraljud.antal}, varav ${u.ultraljud.medVarning} med varning</dd></div>
      <div><dt>Förlossningar</dt><dd>${u.forlossningar.antal} med ${u.forlossningar.barn} barn, ${u.forlossningar.flerbord} flerbörd. Kejsarsnitt ${procent(u.forlossningar.kejsarsnitt)}. Apgar under 7 vid 5 minuter ${procent(u.forlossningar.apgarUnder7)}.${u.forlossningar.medelvikt ? ` Medelvikt ${tal(u.forlossningar.medelvikt, 0)} g.` : ''}</dd></div>
      <div><dt>Över åtgärdslinjen</dt><dd>${procent(u.forlossningar.overAtgardslinjen)}</dd></div>
      <div><dt>Patologiskt CTG</dt><dd>${procent(u.ctg.patologisktAndel)}</dd></div>
      <div><dt>Smärtlindring</dt><dd>${u.smartlindring.length ? u.smartlindring.map(s => `${esc(s.namn)} ${tal(s.andel, 0)} procent`).join(', ') : 'Inget underlag'}</dd></div>
      <div><dt>Födelseanmälan</dt><dd>${u.fodelseanmalan.medPersonnummer} av ${u.fodelseanmalan.barn} barn har fått personnummer</dd></div>
      <div><dt>Efterkontroller</dt><dd>${u.efterkontroll.antal}. EPDS 12 eller mer: ${procent(u.efterkontroll.epdsOverGrans)}.</dd></div>
    </dl>
    <div class="tabellrulle"><table class="tabell siffertabell"><caption>Väntade förlossningar per vecka</caption><thead><tr><th scope="col">Vecka från</th><th scope="col" class="tal">Antal</th></tr></thead>
      <tbody>${u.vantadeForlossningar.map(v => `<tr><th scope="row">${esc(v.fran)}</th><td class="tal">${v.antal}</td></tr>`).join('')}</tbody></table></div>
    <p class="under-text">${esc(u.text)} ${esc(u.textR11)}</p></section>`;
}
