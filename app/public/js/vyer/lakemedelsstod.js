// Läkemedelsprocessen, del 2 (runda 6, r2) i gränssnittet: mallar med flera ordinationer, generella direktiv, muntlig
// ordination att signera, utvärdering, makulering, dosering över flera dygn, fördjupad läkemedelsgenomgång och den
// samlade vätskebalansen. Delarna används i patientens läkemedelsflik, och sidan Direktiv och uppföljning
// (#/lakemedelsstod) visar vårdenhetens direktiv och uppföljningen på vårdenhetens nivå.
import { esc, api, datum, tidpunkt, klockslag, notis, felNotis, medKnapp, dialog, ikon, vyRubrik, tom, idag, plusDagar } from '../ui.js';
import { far } from '../app.js';

export const namn = 'lakemedelsstod';
const tal = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const varnLista = (v) => (v.length ? `<ul class="lms-varn">${v.map(x => `<li><strong>${x.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(x.text)}</li>`).join('')}</ul>` : '');

// Taggar för en ordination i läkemedelslistan: läkemedelstyp, muntlig ordination, direktiv, mall, trappschema och
// passerad uppföljning.
export function taggar(o) {
  const t = [];
  if (o.produkttyp && o.produkttyp.typ !== 'godkand') t.push(`<span class="tagg tagg-demo" title="${esc(o.produkttyp.beskrivning ?? '')}">${esc(o.produkttyp.typText)}</span>`);
  if (o.muntlig) t.push(`<span class="tagg${o.muntlig.signerad ? '' : ' tagg-larm'}">${o.muntlig.signerad ? 'Muntlig, signerad' : `Muntlig, väntar på signering av ${esc(o.muntlig.lakare.namn)}`}</span>`);
  if (o.direktiv) t.push('<span class="tagg">Generellt direktiv</span>');
  if (o.paket) t.push(`<span class="tagg">Mall: ${esc(o.paket.namn)}</span>`);
  if (o.trappning?.idag?.steg) t.push(`<span class="tagg">${o.trappning.riktning === 'ned' ? 'Nedtrappning' : 'Upptrappning'}, steg ${o.trappning.idag.steg} av ${o.trappning.idag.antal}</span>`);
  if (o.uppfoljningPasserad) t.push('<span class="tagg tagg-larm">Uppföljningen har passerat</span>');
  if (o.sarskildObservation) t.push(`<span class="tagg tagg-obs" title="${esc(o.sarskildObservation)}">Särskild observation vid utsättning</span>`);
  return t.join(' ');
}
// Det som står under doseringen: spädning, trappschemat i dag och förpackningen.
export function underDosering(o) {
  return [
    o.spadning && `<span class="under-text lms-spadning">${esc(o.spadning.text)}</span>`,
    o.trappning?.idag?.dosering && `<span class="under-text">I dag: ${esc(o.trappning.idag.dosering)}</span>`,
    o.forpackning && `<span class="under-text">Förpackning ${esc(o.forpackning.text)}, NPL-pack-id ${esc(o.forpackning.nplpackid)}${o.forpackning.vald ? '' : ' (förval)'}</span>`,
  ].filter(Boolean).join('');
}

// Filtrering och sortering av läkemedelslistan (Sussa 3.5.1.8). Valen sparas i webbläsaren för sessionen.
const FILTER = { alla: 'Alla', staende: 'Stående', vid_behov: 'Vid behov', tillfallig: 'Tillfälliga', obs: 'Särskild observation', uppfoljning: 'Uppföljning passerad' };
const SORT = { namn: 'Läkemedel', start: 'Senast insatt', uppfoljning: 'Uppföljning', enhet: 'Vårdenhet' };
let val = { filter: 'alla', sort: 'namn' };
try { val = { ...val, ...JSON.parse(sessionStorage.getItem('vk-lm-val') ?? '{}') }; } catch { /* ingen lagring */ }
export function verktygsrad() {
  return `<div class="lms-verktyg" role="group" aria-label="Filtrera och sortera läkemedelslistan">
    <div class="knappval-lista lms-filter">${Object.entries(FILTER).map(([k, t]) => `<button type="button" class="knapp liten sekundar" data-lmfilter="${k}" aria-pressed="${val.filter === k}">${esc(t)}</button>`).join('')}</div>
    <div class="falt lms-sort"><label for="lm-sort">Sortera</label><select id="lm-sort" data-lmsort>${Object.entries(SORT).map(([k, t]) => `<option value="${k}"${val.sort === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
  </div>`;
}
export function filtrera(rader) {
  const f = { alla: () => true, staende: (o) => o.typ === 'staende', vid_behov: (o) => o.typ === 'vid_behov', tillfallig: (o) => o.typ === 'tillfallig', obs: (o) => Boolean(o.sarskildObservation), uppfoljning: (o) => o.uppfoljningPasserad }[val.filter] ?? (() => true);
  const s = { namn: (a, b) => a.lakemedel.namn.localeCompare(b.lakemedel.namn, 'sv'), start: (a, b) => b.skapad.localeCompare(a.skapad), uppfoljning: (a, b) => (a.aktuelltUppfoljningsdatum ?? '').localeCompare(b.aktuelltUppfoljningsdatum ?? ''), enhet: (a, b) => (a.vardenhet?.namn ?? '').localeCompare(b.vardenhet?.namn ?? '', 'sv') }[val.sort];
  return rader.filter(f).sort(s);
}
export function kopplaVerktyg(el, rita) {
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-lmfilter]'); if (!b) return; val.filter = b.dataset.lmfilter; spara(); rita(); });
  el.addEventListener('change', (e) => { if (!e.target.matches('[data-lmsort]')) return; val.sort = e.target.value; spara(); rita(); });
}
const spara = () => { try { sessionStorage.setItem('vk-lm-val', JSON.stringify(val)); } catch { /* ingen lagring */ } };

// Mallar med flera ordinationer (Sussa 3.5.1.3, 3.5.2.14). Läkaren väljer mallen, systemet fyller i allt och varnar per
// ordination, och läkaren ordinerar med ett klick.
export async function mallar(plats, ctx) {
  const pid = encodeURIComponent(ctx.id);
  let lista;
  try { lista = await api(`/api/patient/${pid}/ordinationspaket`); } catch { return; }
  plats.innerHTML = `<section class="lms-mallar" aria-labelledby="mall-rubrik"><h3 id="mall-rubrik" tabindex="-1">Ordinera från mall</h3>
    ${lista.paket.length ? `<div class="knappval-lista">${lista.paket.map(p => `<button type="button" class="knapp sekundar liten" data-paket="${esc(p.id)}"><span>${esc(p.namn)}</span><span class="under-text">${esc(p.beskrivning)} ${p.godkand ? `Godkänd av ${esc(p.godkand.av)}.` : `Fastställd av ${esc(p.faststalltAv)}.`}</span></button>`).join('')}</div>` : '<p class="tom liten">Det finns inga godkända mallar för din vårdenhet.</p>'}
    <div data-paket-forslag></div>
    <p class="demoregel">${esc(lista.anmarkning)}</p></section>`;
  plats.querySelector('#mall-rubrik').focus();
  plats.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-paket]');
    if (b) return visaForslag(plats, ctx, b.dataset.paket, b);
    const o = e.target.closest('[data-paket-ordinera]');
    if (o) return ordineraPaket(plats, ctx, o);
  });
}
async function visaForslag(plats, ctx, id, knapp) {
  let f;
  try { f = await medKnapp(knapp, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/ordinationspaket/${encodeURIComponent(id)}`)); } catch { return; }
  for (const b of plats.querySelectorAll('[data-paket]')) b.setAttribute('aria-pressed', String(b.dataset.paket === id));
  const LAGE = { tas_med: ['Ordineras', 'tagg-ok'], utesluten: ['Tas inte med', 'tagg-utkast'], kraver_motivering: ['Kräver motivering', 'tagg-larm'] };
  const antal = f.poster.filter(x => x.lage === 'tas_med').length;
  plats.querySelector('[data-paket-forslag]').innerHTML = `<div class="lms-forslag" data-paket-id="${esc(id)}">
    <h4>${esc(f.paket.namn)}</h4>
    ${f.vardhandelse ? `<p class="liten">Vårdhändelse: ${esc(f.paket.vardhandelse)}. ${esc(f.vardhandelse.text)}</p>` : ''}
    <ul class="lms-poster">${f.poster.map(x => `<li data-post="${x.post}">
      <div><strong>${esc(x.lakemedel.namn)}</strong> <span class="tagg ${LAGE[x.lage][1]}">${LAGE[x.lage][0]}</span>
        <span class="under-text">${esc(x.sammanfattning)}</span>${x.spadning ? `<span class="under-text lms-spadning">${esc(x.spadning.text)}</span>` : ''}
        ${x.varfor ? `<span class="under-text adm-varfor">${esc(x.varfor)}</span>` : ''}${x.lage !== 'utesluten' ? varnLista(x.varningar) : ''}
        ${x.lage === 'kraver_motivering' ? [...new Set(x.varningar.filter(v => v.niva === 'allvarlig').map(v => v.regel))].map((r, n) => `<div class="falt"><label for="pm-${x.post}-${n}">Motivering för att ta med ${esc(x.lakemedel.namn)} trots varningen</label><textarea id="pm-${x.post}-${n}" rows="2" maxlength="500" data-paket-mot="${x.post}" data-regel="${esc(r)}"></textarea></div>`).join('') : ''}</div>
      ${x.lage === 'tas_med' ? `<div class="kryssfalt"><input type="checkbox" id="pu-${x.post}" data-uteslut="${x.post}"><label for="pu-${x.post}">Ta inte med</label></div>` : ''}
    </li>`).join('')}</ul>
    <div class="knapprad"><button type="button" class="knapp" data-paket-ordinera>${antal === 1 ? 'Ordinera läkemedlet' : `Ordinera ${antal} läkemedel`}</button></div>
    <p class="demoregel">${esc(f.anmarkning)}</p></div>`;
}
async function ordineraPaket(plats, ctx, knapp) {
  const ruta = plats.querySelector('.lms-forslag');
  const motiveringar = {};
  for (const t of ruta.querySelectorAll('[data-paket-mot]')) if (t.value.trim().length >= 3) (motiveringar[t.dataset.paketMot] ??= []).push({ regel: t.dataset.regel, motivering: t.value.trim() });
  const uteslut = [...ruta.querySelectorAll('[data-uteslut]:checked')].map(c => Number(c.dataset.uteslut));
  try {
    const r = await medKnapp(knapp, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/ordinationspaket/${encodeURIComponent(ruta.dataset.paketId)}`, { metod: 'POST', data: { motiveringar, uteslut } }));
    notis(`${r.ordinationer.length === 1 ? 'Ett läkemedel är ordinerat' : `${r.ordinationer.length} läkemedel är ordinerade`} ur mallen ${r.paket.namn}.${r.utelamnade.length ? ` ${r.utelamnade.length} togs inte med.` : ''}`);
    ctx.ladda();
  } catch (e) { felNotis(e); }
}

// Generella direktiv (Sussa 3.5.2.15) för sjuksköterskan i läkemedelsfliken.
export function direktivSektion(d) {
  if (!d?.direktiv?.length) return '';
  return `<section class="lm-sektion" aria-labelledby="lm-dir"><h3 id="lm-dir">Ordinera enligt generellt direktiv</h3>
    <p class="liten">Direktiven är fastställda av en läkare för din vårdenhet. Systemet prövar dem mot patienten och säger varför ett direktiv inte går att använda.</p>
    <ul class="adm-lista">${d.direktiv.map(x => `<li class="adm-vb"><div><strong>${esc(x.lakemedel.namn)}</strong> <span class="dampad">${esc(x.indikation)}</span>
      <span class="under-text">${esc(x.dosering)}. ${esc(x.maxdosText ?? '')}. Högst ${x.maxTillfallen} ${x.maxTillfallen === 1 ? 'tillfälle' : 'tillfällen'} utan läkarkontakt. Fastställt av ${esc(x.faststalltAv)}, gäller till ${esc(x.giltigtTill)}.</span>
      ${x.ryms ? '' : `<span class="under-text adm-varfor">${x.varfor.map(esc).join(' ')}</span>`}</div>
      ${x.ryms ? `<button type="button" class="knapp liten" data-direktiv="${x.id}">Ordinera</button>` : ''}</li>`).join('')}</ul>
    <p class="demoregel">${esc(d.anmarkning ?? '')}</p></section>`;
}
export async function ordineraDirektiv(ctx, d, knapp) {
  const x = d.direktiv.find(y => String(y.id) === knapp.dataset.direktiv);
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${esc(x.lakemedel.namn)} enligt generellt direktiv</h2>
    <p>${esc(x.indikation)}. ${esc(x.dosering)}.</p>
    ${x.bekrafta.length ? `<fieldset class="kryssgrupp"><legend>Kontrollera med patienten att hen inte har</legend>${x.bekrafta.map((b, i) => `<div class="kryssfalt"><input type="checkbox" id="db-${i}" name="b${i}" value="${esc(b)}"><label for="db-${i}">${esc(b)}</label></div>`).join('')}</fieldset>` : ''}
    <div class="falt"><label for="d-bed">Din bedömning av behovet <span class="obl">(dokumenteras i journalen)</span></label><textarea id="d-bed" name="bedomning" rows="2" maxlength="500">${esc(x.bedomningForslag)}</textarea></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Ordinera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (v) => (x.bekrafta.some((_, i) => !v[`b${i}`]) ? 'Kontrollera och bekräfta varje punkt med patienten.' : (v.bedomning ?? '').trim().length < 3 ? 'Skriv din bedömning.' : null) });
  if (!svar) return;
  try {
    const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/direktiv/${x.id}`, { metod: 'POST', data: { bedomning: svar.data.bedomning.trim(), bekraftade: x.bekrafta } });
    notis(`${r.ordination.lakemedel?.namn} är ordinerat enligt det generella direktivet. Dosen finns i Läkemedel att ge.`);
    ctx.ladda();
  } catch (e) { felNotis(e); }
}

// Utvärdering av effekt och biverkan (Sussa 3.5.2.10, 3.5.2.20).
export async function utvardera(ctx, ordinationId, efter = null) {
  let u;
  try { u = await api(`/api/ordination/${ordinationId}/utvardering`); } catch (e) { felNotis(e); return; }
  const radio = (namn, alt, forval) => Object.entries(alt).map(([k, t], i) => `<div class="kryssfalt"><input type="radio" id="u-${namn}-${i}" name="${namn}" value="${k}"${k === forval ? ' checked' : ''}><label for="u-${namn}-${i}">${esc(t)}</label></div>`).join('');
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Utvärdera ${esc(u.lakemedel)}</h2>
    <p class="liten">Ordinationsorsak: ${esc(u.ordinationsorsak)}. Uppföljning ${esc(u.uppfoljningsdatum)}.</p>
    ${u.tidigare.length ? `<p class="liten">Senast: ${esc(u.tidigare[0].effektText)}, ${esc(u.tidigare[0].biverkanText.toLowerCase())}, ${esc(u.tidigare[0].av)} ${esc(tidpunkt(u.tidigare[0].tid))}.</p>` : ''}
    <fieldset class="kryssgrupp"><legend>Effekt</legend>${radio('effekt', u.val.effekt, u.forslag.effekt)}</fieldset>
    <fieldset class="kryssgrupp"><legend>Biverkan</legend>${radio('biverkan', u.val.biverkan, u.forslag.biverkan)}</fieldset>
    <div class="falt"><label for="u-bt">Vilken biverkan</label><input id="u-bt" name="biverkanText" maxlength="500"></div>
    <fieldset class="kryssgrupp"><legend>Beslut</legend>${radio('beslut', u.val.beslut, u.forslag.beslut)}</fieldset>
    ${u.val.beslut.fortsatt ? `<div class="falt"><label for="u-ny">Nästa uppföljning</label><input id="u-ny" name="nyttUppfoljningsdatum" type="date" value="${esc(u.forslag.nyttUppfoljningsdatum)}"></div>` : ''}
    <p class="hjalp">${esc(u.biverkningsrapport)}</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara utvärderingen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (v) => (v.biverkan !== 'ingen' && (v.biverkanText ?? '').trim().length < 3 ? 'Skriv vilken biverkan det gäller.' : null) });
  if (!svar) return;
  try {
    const r = await api(`/api/ordination/${ordinationId}/utvardering`, { metod: 'POST', data: { ...svar.data, biverkanText: svar.data.biverkanText?.trim() || null } });
    notis(r.nasta ? `Utvärderingen är sparad. ${r.nasta.text}` : `Utvärderingen är sparad. Nästa uppföljning ${r.uppfoljningsdatum}.`, r.nasta ? 'info' : 'ok');
    efter?.(r);
  } catch (e) { felNotis(e); }
}

// Muntlig ordination som läkaren signerar.
export async function signeraMuntlig(knapp, ordinationId, efter) {
  try {
    const r = await medKnapp(knapp, () => api(`/api/ordination/${ordinationId}/muntlig/signera`, { metod: 'POST', data: {} }));
    notis(`Den muntliga ordinationen av ${r.ordination.lakemedel?.namn} är signerad. ${r.nll.status === 'kvitterad' ? 'NLL kvitterade överföringen.' : ''}`);
    efter?.();
  } catch { /* notis visad */ }
}

// Makulering av en felaktig registrering (Sussa 3.5.2.2). Registreringen raderas aldrig.
export async function makulera(pid, typ, id, text, efter) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Makulera registreringen</h2>
    <p>${esc(text)}</p><p>Registreringen raderas inte. Den visas överstruken med din orsak, och räknas inte längre i dagens doser och i vätskebalansen.</p>
    <div class="knapprad" data-forslag-rad>${['Registrerad på fel patient', 'Registrerad två gånger', 'Fel läkemedel eller dos'].map(t => `<button type="button" class="knapp liten sekundar" data-orsak="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="falt"><label for="mak-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="mak-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-varde="ok">Makulera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { onOpen: (dl) => dl.addEventListener('click', (x) => { const o = x.target.closest('[data-orsak]'); if (o) dl.querySelector('textarea').value = o.dataset.orsak; }) });
  if (!svar) return;
  try {
    await api(`/api/patient/${encodeURIComponent(pid)}/makulera`, { metod: 'POST', data: { typ, id: Number(id), orsak: svar.data.orsak.trim() } });
    notis('Registreringen är makulerad.');
    efter?.();
  } catch (e) { felNotis(e); }
}

// Dosering över flera dygn (Sussa 3.5.1.2, 3.5.1.8).
const STATUSKORT = { kommande: '', att_ge: 'Nu', forsenad: 'Försenad', iordningstalld: 'Iordningsställd', given: 'Given', overlamnad: 'Överlämnad', ej_given: 'Inte given' };
export function doseringsSektion(v) {
  if (!v?.rader?.length) return '';
  const dag = (d) => (d === idag() ? 'I dag' : new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'numeric' }));
  return `<section class="lm-sektion" aria-labelledby="lm-dygn"><h3 id="lm-dygn">Dosering över flera dygn</h3>
    <div class="tabellrulle"><table class="tabell lms-dygn"><thead><tr><th scope="col">Läkemedel</th>${v.dagar.map(d => `<th scope="col">${esc(dag(d))}</th>`).join('')}</tr></thead>
    <tbody>${v.rader.map(r => `<tr><th scope="row">${esc(r.lakemedel.namn)}<span class="under-text">${esc(r.dosering)}</span></th>${v.dagar.map(d => `<td>${(r.dagar[d] ?? []).map(x => (x.vidBehov
      ? `<span class="lms-cell">${esc(x.text)}</span>`
      : `<span class="lms-cell lms-${esc(x.status)}"><time>${esc(klockslag(x.tid))}</time> ${x.dos != null ? `${esc(tal(x.dos))} ${esc(x.dosEnhet ?? '')}` : ''}${STATUSKORT[x.status] ? ` <span class="dampad">${esc(STATUSKORT[x.status])}</span>` : ''}</span>`)).join('') || '<span class="dampad">Ingen dos</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${v.dolda?.sparrade ? '<p class="dampad liten">Ordinationer från spärrade vårdenheter visas inte.</p>' : ''}</section>`;
}

// Fördjupad läkemedelsgenomgång (Sussa 3.5.1.6, HSLF-FS 2017:37 11 kap.).
export function fordjupadSektion(g) {
  if (!g) return '';
  const p = g.pagar;
  const steg = p ? [['Patientens medverkan', p.steg.patient], ['Farmaceutens bedömning', p.steg.farmaceut], ['Läkarens beslut', p.steg.lakare]] : [];
  return `<section class="lm-sektion" aria-labelledby="lm-fordjupad"><h3 id="lm-fordjupad">Fördjupad läkemedelsgenomgång</h3>
    ${p ? `<p>Startad ${esc(tidpunkt(p.startad))} av ${esc(p.startadAv)}. <span class="tagg tagg-pagaende">${esc(p.statusText)}</span></p>
      <ol class="lms-steg">${steg.map(([t, s]) => `<li>${esc(t)}: ${s ? `klart, ${esc(s.av)} ${esc(tidpunkt(s.tid))}` : '<span class="dampad">väntar</span>'}</li>`).join('')}</ol>
      <div class="knapprad">${g.kan.patient ? '<button type="button" class="knapp liten sekundar" data-fg="patient">Registrera patientens medverkan</button>' : ''}${g.kan.farmaceut ? '<button type="button" class="knapp liten" data-fg="farmaceut">Gör farmaceutens bedömning</button>' : ''}${g.kan.lakare ? '<button type="button" class="knapp liten" data-fg="lakare">Besluta och avsluta</button>' : ''}</div>`
    : `<p class="liten">Systemet tar fram underlaget för varje läkemedel enligt 11 kap. 11 §: indikation, effekt, dos mot njurfunktion och ålder, biverkningar och interaktioner. Farmaceuten föreslår åtgärder, patienten medverkar och läkaren beslutar.</p>
      ${g.kan.starta ? '<button type="button" class="knapp sekundar" data-fg="starta">Starta fördjupad läkemedelsgenomgång</button>' : ''}`}
    ${g.tidigare.length ? `<details class="historik"><summary>Tidigare fördjupade genomgångar (${g.tidigare.length})</summary>${g.tidigare.map(t => `<pre class="lms-sammanfattning">${esc(t.steg.lakare?.sammanfattning ?? '')}</pre>`).join('')}</details>` : ''}
  </section>`;
}
export async function fordjupadSteg(ctx, g, typ, knapp) {
  const pid = encodeURIComponent(ctx.id);
  if (typ === 'starta') {
    try { await medKnapp(knapp, () => api(`/api/patient/${pid}/fordjupad-genomgang`, { metod: 'POST', data: {} })); notis('Den fördjupade läkemedelsgenomgången är startad. Farmaceuten ser den i sin inkorg.'); ctx.ladda(); } catch { /* notis visad */ }
    return;
  }
  const u = g.underlag;
  const ATG = g.atgarder;
  const rader = (namn, forslag) => u.map((x, i) => {
    const f = forslag?.find(y => y.ordinationId === x.ordinationId);
    const forval = f?.atgard ?? x.forslag;
    return `<li><strong>${esc(x.lakemedel.namn)}</strong> <span class="dampad">${esc(x.dosering)}</span>
      <ul class="liten">${x.kontroller.map(k => `<li>${esc(k.punkt)}: ${esc(k.text)}</li>`).join('')}</ul>
      ${f ? `<p class="liten">Farmaceuten föreslår: ${esc(f.atgardText)}${f.motivering ? `. ${esc(f.motivering)}` : ''}</p>` : ''}
      <div class="falt-rad"><div class="falt"><label for="${namn}-a-${i}">Åtgärd</label><select id="${namn}-a-${i}" name="a_${x.ordinationId}">${Object.entries(ATG).map(([k, t]) => `<option value="${k}"${k === forval ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="falt bred"><label for="${namn}-m-${i}">Motivering</label><input id="${namn}-m-${i}" name="m_${x.ordinationId}" maxlength="500" value="${esc(f?.motivering ?? x.forslagMotivering ?? '')}"></div></div></li>`;
  }).join('');
  const lista = (data) => u.map(x => ({ ordinationId: x.ordinationId, atgard: data[`a_${x.ordinationId}`], motivering: (data[`m_${x.ordinationId}`] ?? '').trim() }));
  let html;
  if (typ === 'patient') {
    html = `<h2 id="dlg-rubrik">Patientens medverkan</h2>
      <fieldset class="kryssgrupp"><legend>Deltog patienten?</legend><div class="kryssfalt"><input type="radio" id="fg-ja" name="deltog" value="ja" checked><label for="fg-ja">Ja</label></div><div class="kryssfalt"><input type="radio" id="fg-nej" name="deltog" value="nej"><label for="fg-nej">Nej</label></div></fieldset>
      <div class="falt"><label for="fg-varfor">Om inte, varför</label><input id="fg-varfor" name="varforInte" maxlength="300"></div>
      <fieldset class="kryssgrupp"><legend>Besvär som patienten har</legend>${Object.entries(g.besvar).map(([k, t]) => `<div class="kryssfalt"><input type="checkbox" id="fg-${k}" name="besvar_${k}" value="1"><label for="fg-${k}">${esc(t)}</label></div>`).join('')}</fieldset>
      <div class="falt"><label for="fg-syn">Patientens egna synpunkter och önskemål</label><textarea id="fg-syn" name="synpunkter" rows="2" maxlength="1000"></textarea></div>`;
  } else if (typ === 'farmaceut') {
    html = `<h2 id="dlg-rubrik">Farmaceutens bedömning</h2><p class="liten">Systemets underlag per läkemedel och ett förslag på åtgärd. Ändra det som inte stämmer.</p>
      <ol class="lms-underlag">${rader('fa')}</ol>
      <div class="falt"><label for="fa-bed">Sammanfattande bedömning</label><textarea id="fa-bed" name="bedomning" rows="2" maxlength="2000"></textarea></div>`;
  } else {
    html = `<h2 id="dlg-rubrik">Läkarens beslut</h2>${g.pagar.steg.patient ? `<p class="liten">Patienten: ${g.pagar.steg.patient.deltog ? 'deltog' : `deltog inte (${esc(g.pagar.steg.patient.varforInte)})`}. ${g.pagar.steg.patient.besvar.map(b => esc(b.text)).join(', ')}${g.pagar.steg.patient.synpunkter ? `. ${esc(g.pagar.steg.patient.synpunkter)}` : ''}</p>` : ''}
      <ol class="lms-underlag">${rader('la', g.pagar.steg.farmaceut?.forslag)}</ol>
      <div class="falt"><label for="la-mal">Mål med behandlingen <span class="obl">(obligatoriskt)</span></label><textarea id="la-mal" name="mal" rows="2" maxlength="1000"></textarea></div>
      <div class="falt-rad"><div class="falt"><label for="la-upp">Uppföljning senast</label><input id="la-upp" name="uppfoljningsdatum" type="date" value="${esc(plusDagar(idag(), 28))}"></div>
      <div class="falt bred"><label for="la-ans">Ansvarig för uppföljningen</label><input id="la-ans" name="uppfoljningAnsvarig" maxlength="200" placeholder="Din vårdenhet"></div></div>
      <div class="kryssfalt"><input type="checkbox" id="la-inf" name="patientInformerad" value="1"><label for="la-inf">Patienten har fått information om åtgärderna och en uppdaterad läkemedelslista</label></div>`;
  }
  const svar = await dialog(`<form>${html}<p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, { klass: 'dialog-bred' });
  if (!svar) return;
  const v = svar.data;
  const data = typ === 'patient' ? { typ, deltog: v.deltog === 'ja', varforInte: v.varforInte, besvar: Object.keys(g.besvar).filter(k => v[`besvar_${k}`]), synpunkter: v.synpunkter }
    : typ === 'farmaceut' ? { typ, forslag: lista(v), bedomning: v.bedomning }
      : { typ, beslut: lista(v), mal: v.mal, uppfoljningsdatum: v.uppfoljningsdatum, uppfoljningAnsvarig: v.uppfoljningAnsvarig, patientInformerad: Boolean(v.patientInformerad) };
  try {
    const r = await api(`/api/patient/${pid}/fordjupad-genomgang/${g.pagar.id}/steg`, { metod: 'POST', data });
    notis(typ === 'lakare' ? `Genomgången är avslutad.${r.nasta?.length ? ` Nästa steg i läkemedelslistan: ${r.nasta.map(n => n.text).join(', ')}.` : ''}` : 'Steget är sparat.', typ === 'lakare' && r.nasta?.length ? 'info' : 'ok');
    ctx.ladda();
  } catch (e) { felNotis(e); }
}

// Vätskebalans (Sussa 3.5.2.3, 3.5.3.1 till 3.5.3.3): dygn med valbar brytning, filter och sortering, kalorier, beredd
// volym, vikt och förväntad balans de närmaste 24 timmarna.
const ml = (n) => String(n).replace('.', ',');
export function vatskeSektion(vb) {
  const kan = far('registrera_matvarde');
  return `<section class="lm-sektion lms-vatska" aria-labelledby="lm-vb"><h3 id="lm-vb">Vätskebalans</h3>
    <div class="lms-verktyg">
      <div class="falt"><label for="vb-bryt">Dygnsbrytning</label><select id="vb-bryt" data-vb="brytning">${vb.brytningar.map(b => `<option value="${b}"${vb.brytning.startsWith(b) ? ' selected' : ''}>Kl. ${b}</option>`).join('')}</select></div>
      <div class="falt"><label for="vb-rikt">Visa</label><select id="vb-rikt" data-vb="riktning"><option value="">Intag och förluster</option><option value="in"${vb.filter.riktning === 'in' ? ' selected' : ''}>Bara intag</option><option value="ut"${vb.filter.riktning === 'ut' ? ' selected' : ''}>Bara förluster</option></select></div>
      <div class="falt"><label for="vb-sort">Sortera</label><select id="vb-sort" data-vb="sortering"><option value="tid">Tid</option><option value="volym"${vb.filter.sortering === 'volym' ? ' selected' : ''}>Volym</option></select></div>
    </div>
    <p class="vb-summa"><span>In ${ml(vb.summaIn)} ml</span><span>Ut ${ml(vb.summaUt)} ml</span><span>Balans ${vb.balans > 0 ? '+' : ''}${ml(vb.balans)} ml</span><span>${ml(vb.kcalIn)} kcal</span>${vb.vikt ? `<span>Vikt ${ml(vb.vikt.kg)} kg${vb.vikt.andringKg != null ? ` (${vb.vikt.andringKg > 0 ? '+' : ''}${ml(vb.vikt.andringKg)} kg under vårdtillfället)` : ''}</span>` : ''}</p>
    <p class="liten dampad">Dygnet ${esc(tidpunkt(vb.fran))} till ${esc(tidpunkt(vb.till))}.</p>
    ${vb.poster.length ? `<ul class="liten lms-vbposter">${vb.poster.map(p => `<li class="${p.makulerad ? 'makulerad' : ''}">${esc(klockslag(p.tid))} ${p.riktning === 'in' ? 'In' : 'Ut'}: ${esc(p.typText)} ${ml(p.volymMl)} ml${p.kcal ? `, ${ml(p.kcal)} kcal` : ''}${p.automatisk ? ' <span class="tagg">Från administrering</span>' : ''} <span class="dampad">${esc(p.registreradAv ?? '')}</span>${p.makulerad ? ` <span class="dampad">Makulerad av ${esc(p.makulerad.av)}: ${esc(p.makulerad.orsak)}</span>` : kan && !p.automatisk ? ` <button type="button" class="knapp-lank" data-makulera-vb="${p.id}" data-text="${esc(`${p.typText} ${ml(p.volymMl)} ml kl. ${klockslag(p.tid)}`)}">Makulera</button>` : ''}</li>`).join('')}</ul>` : '<p class="tom liten">Inget registrerat det här dygnet.</p>'}
    ${vb.beredd.poster.length ? `<p class="liten">Iordningsställt, inte givet: ${vb.beredd.poster.map(b => `${esc(b.lakemedel)} ${ml(b.volymMl)} ml`).join(', ')}.</p>` : ''}
    <h4>Förväntat de närmaste 24 timmarna</h4>
    <p class="vb-summa"><span>In ${ml(vb.prognos.summaIn)} ml</span><span>Ut ${ml(vb.prognos.summaUt)} ml</span><span>Balans ${vb.prognos.balans > 0 ? '+' : ''}${ml(vb.prognos.balans)} ml</span>${vb.prognos.kcal ? `<span>${ml(vb.prognos.kcal)} kcal</span>` : ''}</p>
    ${vb.prognos.poster.length ? `<ul class="liten">${vb.prognos.poster.map(p => `<li>${esc(tidpunkt(p.tid))} ${esc(p.lakemedel)} ${ml(p.volymMl)} ml${p.iordningstalld ? ' <span class="tagg">Iordningsställd</span>' : ''}</li>`).join('')}</ul>` : ''}
    <p class="dampad liten">${esc(vb.prognos.text)}</p>
    ${kan ? '<div class="knapprad"><button type="button" class="knapp liten sekundar" data-vatska="in">Registrera intag</button><button type="button" class="knapp liten sekundar" data-vatska="ut">Registrera förlust</button></div>' : ''}
  </section>`;
}

// Sidan Direktiv och uppföljning (#/lakemedelsstod): vårdenhetens generella direktiv och, för läkaren, uppföljningen
// på vårdenhetens nivå och fastställandet av nya direktiv.
export async function visa(main) {
  main.innerHTML = vyRubrik('Direktiv och uppföljning', 'Vårdenhetens generella direktiv och uppföljningen av läkemedelsbehandlingen.') + '<div id="lms"><p class="tom">Hämtar.</p></div>';
  const [d, g] = await Promise.all([api('/api/direktiv'), far('ordinera') ? api('/api/lakemedel/uppfoljning').catch(() => null) : null]);
  const el = main.querySelector('#lms');
  if (!el) return;
  el.innerHTML = `<section class="lm-sektion" aria-labelledby="lms-dir"><h2 id="lms-dir">Generella direktiv</h2>
      <p class="liten">Ett generellt direktiv fastställs skriftligt av verksamhetschefen eller den medicinskt ansvariga läkaren (HSLF-FS 2017:37 6 kap. 6 §, Gröna häftet 1.4.2). Sjuksköterskan ordinerar inom det efter sin bedömning av patienten, och systemet prövar ramarna.</p>
      ${d.direktiv.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Läkemedel och indikation</th><th scope="col">Dosering och maxdos</th><th scope="col">Kontraindikationer</th><th scope="col">Gäller</th>${d.kanFaststalla ? '<th scope="col"><span class="sr">Åtgärder</span></th>' : ''}</tr></thead>
      <tbody>${d.direktiv.map(x => `<tr class="${x.giltigt ? '' : 'makulerad'}"><td><strong>${esc(x.lakemedel.namn)}</strong><span class="under-text">${esc(x.indikation)}</span></td>
        <td>${esc(x.dosering)}<span class="under-text">${esc(x.maxdosText ?? '')}. Högst ${x.maxTillfallen} ${x.maxTillfallen === 1 ? 'tillfälle' : 'tillfällen'} utan läkarkontakt.</span></td>
        <td>${x.kontraindikationer.map(k => esc(k.text)).join('; ')}</td>
        <td>${esc(x.vardenhet.namn)}<span class="under-text">Fastställt av ${esc(x.faststalltAv)}, till ${esc(x.giltigtTill)}${x.upphavt ? `. Upphävt ${esc(datum(x.upphavt.tid))} av ${esc(x.upphavt.av)}: ${esc(x.upphavt.orsak)}` : ''}</span></td>
        ${d.kanFaststalla ? `<td class="atgarder">${x.giltigt ? `<button type="button" class="knapp liten sekundar" data-upphav="${x.id}">Upphäv</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : tom('Inga generella direktiv.')}
      ${d.kanFaststalla ? '<button type="button" class="knapp" data-nytt-direktiv>Fastställ ett direktiv</button>' : ''}
      ${!d.kanFaststalla && d.faststallaText ? `<p class="ruta ruta-info liten">${esc(d.faststallaText)}</p>` : ''}
      <p class="demoregel">${esc(d.anmarkning)}</p></section>
    ${g ? `<section class="lm-sektion" aria-labelledby="lms-upp"><h2 id="lms-upp">Uppföljning på vårdenhetens nivå</h2>
      <p class="liten">${esc(g.vardenhet ?? '')}: ${g.summa.pagaende} pågående ordinationer, ${g.summa.passerade} med passerad uppföljning, ${g.summa.utvarderade} utvärderade. ${esc(g.anmarkning)}</p>
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Substans</th><th scope="col">Pågående</th><th scope="col">Patienter</th><th scope="col">Passerad uppföljning</th><th scope="col">Utvärderade</th><th scope="col">God effekt</th><th scope="col">Biverkningar</th></tr></thead>
      <tbody>${g.rader.map(r => `<tr><td>${esc(r.substans)}</td><td>${r.pagaende}</td><td>${r.patienter}</td><td>${r.passerade}</td><td>${r.utvarderade}</td><td>${r.andelGodEffekt == null ? '' : `${r.andelGodEffekt} %`}</td><td>${r.biverkningar}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
  el.addEventListener('click', async (e) => {
    const u = e.target.closest('[data-upphav]');
    if (u) {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Upphäv direktivet</h2><p>Direktivet ändras aldrig och finns kvar i historiken, men kan inte användas längre.</p>
        <div class="falt"><label for="up-orsak">Orsak</label><input id="up-orsak" name="orsak" maxlength="300" required minlength="3"></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Upphäv</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      try { await api(`/api/direktiv/${u.dataset.upphav}/upphav`, { metod: 'POST', data: { orsak: svar.data.orsak } }); notis('Direktivet är upphävt.'); visa(main); } catch (x) { felNotis(x); }
      return;
    }
    if (e.target.closest('[data-nytt-direktiv]')) return nyttDirektiv(main);
  });
}

async function nyttDirektiv(main) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Fastställ ett generellt direktiv</h2>
    <div class="falt"><label for="nd-lm">Läkemedel</label><input id="nd-lm" name="sok" placeholder="Sök i katalogen" autocomplete="off"></div>
    <input type="hidden" name="lakemedelId"><ul class="lm-traffar" data-nd-traffar></ul>
    <div class="falt"><label for="nd-ind">Indikation</label><input id="nd-ind" name="indikation" maxlength="200" required></div>
    <div class="falt"><label for="nd-dos">Dosering</label><input id="nd-dos" name="dosering" maxlength="300" required placeholder="Till exempel 2 tabletter vid behov, minst 4 timmar mellan doserna"></div>
    <div class="falt-rad"><div class="falt smal"><label for="nd-d">Dos</label><input id="nd-d" name="dos" inputmode="decimal" required></div><div class="falt smal"><label for="nd-e">Enhet</label><input id="nd-e" name="dosEnhet" value="mg"></div>
      <div class="falt smal"><label for="nd-max">Högst per dygn</label><input id="nd-max" name="maxPerDygn" inputmode="numeric" value="3"></div><div class="falt smal"><label for="nd-int">Timmar mellan</label><input id="nd-int" name="minstaIntervallTimmar" inputmode="decimal" value="4"></div>
      <div class="falt smal"><label for="nd-till">Tillfällen</label><input id="nd-till" name="maxTillfallen" inputmode="numeric" value="3"></div></div>
    <div class="falt"><label for="nd-maxt">Maxdos i text</label><input id="nd-maxt" name="maxdosText" maxlength="200"></div>
    <div class="falt"><label for="nd-k">Kontraindikationer som sjuksköterskan kontrollerar, en per rad</label><textarea id="nd-k" name="kontra" rows="2" required></textarea></div>
    <div class="falt"><label for="nd-ae">Lägsta ålder, om det finns en</label><input id="nd-ae" name="alder" inputmode="numeric"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Fastställ</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { klass: 'dialog-bred', validera: (v) => (!v.lakemedelId ? 'Välj läkemedlet i katalogen.' : null),
    onOpen: (dl) => {
      const t = dl.querySelector('[data-nd-traffar]');
      dl.querySelector('#nd-lm').addEventListener('input', async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) { t.innerHTML = ''; return; }
        try { const l = await api(`/api/lakemedel/katalog?q=${encodeURIComponent(q)}`); t.innerHTML = l.slice(0, 6).map(x => `<li><button type="button" data-nd="${esc(x.id)}">${esc(x.namn)} ${esc(x.styrka)} ${esc(x.form)}</button></li>`).join(''); } catch { /* tyst */ }
      });
      t.addEventListener('click', (e) => { const b = e.target.closest('[data-nd]'); if (!b) return; dl.querySelector('[name="lakemedelId"]').value = b.dataset.nd; dl.querySelector('#nd-lm').value = b.textContent; t.innerHTML = ''; });
    } });
  if (!svar) return;
  const v = svar.data;
  const kontraindikationer = v.kontra.split('\n').map(x => x.trim()).filter(Boolean).map(text => ({ typ: 'bekrafta', text }));
  if (v.alder) kontraindikationer.push({ typ: 'alder_under', ar: Number(v.alder), text: `Patienten är under ${Number(v.alder)} år` });
  try {
    await api('/api/direktiv', { metod: 'POST', data: { lakemedelId: v.lakemedelId, indikation: v.indikation, dosering: v.dosering, dos: Number(v.dos.replace(',', '.')), dosEnhet: v.dosEnhet, maxPerDygn: Number(v.maxPerDygn), minstaIntervallTimmar: Number(v.minstaIntervallTimmar.replace(',', '.')), maxTillfallen: Number(v.maxTillfallen), maxdosText: v.maxdosText, kontraindikationer } });
    notis('Direktivet är fastställt för din vårdenhet och gäller i ett år.');
    visa(main);
  } catch (e) { felNotis(e); }
}
