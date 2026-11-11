// Översikten: aktuella läkemedel, diagnoser, senaste mätvärden och anteckningar, pågående remisser och tidslinjen.
import { esc, api, datum, tidpunkt, klockslag, migreradEtikett, NLL, tal, ikon, felNotis } from '../ui.js';
import { far, pa } from '../app.js';
import { doldaRad } from './patient.js';
import { remissStatusText } from './remisser.js';
import { lakemedelsalderRad } from '../avbrott.js';
import * as vardkontakt from './patient-vardkontakt.js';
import * as utskrift from '../utskrift.js';
import * as tider from './patient-tider.js';
// Runda 6, r3: tvångsvård, vårdplaner och samordnad planering i översikten.
import * as r3 from './r3.js';
// Runda 7, r3: kostnaderna i vårdprocessen, avgifter och högkostnadsskydd.
import * as ekonomi from '../ekonomi-ui.js';
// Runda 10, r2: översiktens delar, ordning och tidsurval efter situationen (Sussa 3.1.2.1 och 3.1.2.3).
import { dialog, notis } from '../ui.js';

// När frågeställningen inte visas för rollen skickar servern remissens status i stället.
const REMISSTATUS = { skickad: 'Status: skickad', mottagen: 'Status: mottagen', bedomd: 'Status: bedömd', besvarad: 'Status: besvarad', svar_kvitterat: 'Status: svaret är kvitterat' };
const TYP = { vardkontakt: 'Vårdkontakt', vardtillfalle: 'Vårdtillfälle', anteckning: 'Anteckning', ordination: 'Läkemedel', remiss: 'Remiss',
  // Runda 10, r5: uppgifter från en annan vårdgivare genom sammanhållen journalföring.
  extern: 'Annan vårdgivare' };
// Runda 10, r4: in- och utfarter, skannade restjournaler och donation.
Object.assign(TYP, { infart: 'In- och utfart', restjournal: 'Restjournal', dodsfall: 'Dödsfall', donation: 'Donation' });
const R10R4_FLIK = { infart: 'infarter', restjournal: 'restjournaler', donation: 'donation' };
// Tidslinjen i tidsordning, per vårdtillfälle och vårdkontakt, eller per hälsoärende. Valet gäller under sessionen.
const LAGEN = [['tid', 'I tidsordning'], ['kontakt', 'Per vårdkontakt'], ['arende', 'Per hälsoärende']];
let tidslinjeLage = 'tid';
// Runda 10, r2: situationen som användaren har valt under sessionen. Utan val väljer systemet ur sammanhanget.
let situationVal = null;

const sektion = (id, rubrik, innehall, extra = '') => `<section class="ov-sektion" aria-labelledby="ov-${id}"><div class="sektion-huvud"><h2 id="ov-${id}">${esc(rubrik)}</h2>${extra}</div>${innehall}</section>`;
const tomRad = (t) => `<p class="tom liten">${esc(t)}</p>`;

// Runda 13, r3 (E1-19, E2-20): ett värde utanför referensintervallet markeras, och ett kritiskt värde tydligt.
const avvikelse = (m) => (!m.avvikande ? '' : m.avvikande.startsWith('kritiskt')
  ? ` <span class="tagg tagg-larm" data-avvikande="${esc(m.avvikande)}">${esc(m.avvikandeText ?? 'Kritiskt')}</span>`
  : ` <span class="text-larm" data-avvikande="${esc(m.avvikande)}">${m.avvikande === 'hogt' ? '↑' : '↓'}<span class="sr"> ${esc(m.avvikandeText ?? '')}</span></span>`);
export const varde = (m) => `${esc(typeof m.varde === 'number' ? tal(m.varde, 2) : m.varde)} <span class="enhet">${esc(m.enhet)}</span>${avvikelse(m)}`;

// Snabbval för de vanligaste åtgärderna, så att de nås med ett klick från översikten (klickbudgeten, D6).
// data-skriv döljer dem i läsläget vid avbrott.
function snabbval(ctx) {
  const v = [];
  if (pa('skriv_journal', 'skriv_omvardnad')) v.push([ctx.href('journal', 'ny'), ikon.penna, 'Ny anteckning']);
  if (far('ordinera')) v.push([ctx.href('lakemedel', 'ny'), ikon.plus, 'Ordinera']);
  if (far('registrera_matvarde')) v.push([ctx.href('matvarden', 'ny'), ikon.plus, 'Registrera mätvärde']);
  if (far('remittera')) v.push([ctx.href('remisser', 'ny'), ikon.remiss, 'Skicka remiss']);
  // Runda 8, r2: vårdadministratören skriver remisser på uppdrag av en läkare.
  if (far('remittera_pa_uppdrag')) v.push([ctx.href('remisser', 'uppdrag'), ikon.remiss, 'Remiss på uppdrag']);
  // Runda 8, r1: beställning av prover och ordination av kontroller (Sussa 4.4 och testfall 3.1, 3.2 och 3.5).
  if (pa('bestalla_prov', 'bestalla_prov_uppdrag')) v.push([ctx.href('prover', 'ny'), ikon.plus, 'Beställ prover']);
  if (far('ordinera_kontroll')) v.push([ctx.href('prover', 'kontroller'), ikon.klocka, 'Kontroller']);
  // Utskrift (Sussa 3.1.9): systemet föreslår syftet och delarna.
  const skrivUt = far('skriv_ut') ? `<li><button type="button" class="knapp liten sekundar" data-utskrift>${ikon.logg}<span>Skriv ut</span></button></li>` : '';
  // Runda 5, r1: återbesök som systemet föreslår ur planering, diagnos och senaste kontakt (Sussa 3.4.1.1).
  const aterbesok = far('skriv_journal') ? `<li><button type="button" class="knapp liten sekundar" data-aterbesok>${ikon.kalender}<span>Återbesök</span></button></li>` : '';
  if (!v.length && !skrivUt && !aterbesok) return '';
  return `<nav class="snabbval" aria-label="Snabbval" data-skriv><ul>${v.map(([h, ik, t]) => `<li><a class="knapp liten sekundar" href="${h}">${ik}<span>${esc(t)}</span></a></li>`).join('')}${aterbesok}${skrivUt}</ul></nav>`;
}

export async function visa(el, ctx) {
  // Bokade tider (tidboken) hämtas samtidigt med översikten.
  // Runda 7, r3: kostnaderna hämtas samtidigt, för de roller som ser dem.
  const [d, t, kost] = await Promise.all([api(`/api/patient/${encodeURIComponent(ctx.id)}/oversikt${situationVal ? `?situation=${situationVal}` : ''}`), tider.hamta(ctx.id), ekonomi.hamta(ctx.id)]);
  if (!ctx.aktuell()) return;
  // Runda 10, r2: delarna samlas per id och visas i vyns ordning.
  const delar = [];
  const perDel = new Map();
  const push = delar.push.bind(delar);
  let aktuellDel = null;
  delar.push = (html) => { if (aktuellDel) perDel.set(aktuellDel, html); return push(html); };
  const som = (id, fn) => { aktuellDel = id; fn(); aktuellDel = null; };
  // Runda 6, r3: tvångsvården först, eftersom fristerna räknas i timmar.
  const r3del = r3.oversiktHtml(d, ctx);

  if (d.uppfoljning) som('uppfoljning', () => delar.push(sektion('uppf', 'Uppföljning och avvikelser', uppfoljningHtml(d.uppfoljning), `<a class="sektion-lank" href="${ctx.href('uppfoljning')}">Hela uppföljningen</a>`)));
  if (d.lakemedel) som('lakemedel', () => {
    delar.push(sektion('lm', 'Aktuella läkemedel', lakemedelsalderRad(ctx.id) + (d.lakemedel.length ? `<div class="tabellrulle"><table class="tabell tat">
      <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Ordinationsorsak</th></tr></thead>
      <tbody>${d.lakemedel.map(o => `<tr><td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)}</span>${o.nll_status !== 'kvitterad' ? ` ${nllChip(o.nll_status)}` : ''}${migreradEtikett(o)}</td><td>${esc(o.dosering)}</td><td>${esc(o.ordinationsorsak)}</td></tr>`).join('')}</tbody></table></div>
      <p class="dampad liten">Alla utom de markerade är kvitterade av Nationella läkemedelslistan.</p>` : tomRad('Inga aktuella läkemedel.')), `<a class="sektion-lank" href="${ctx.href('lakemedel')}">Läkemedelslistan</a>`));
  });
  if (d.diagnoser) som('diagnoser', () => {
    delar.push(sektion('dia', 'Diagnoser', d.diagnoser.length ? `<ul class="enkel-lista">${d.diagnoser.map(x => `<li><span class="kod">${esc(x.kod)}</span> ${esc(x.text)}${x.typ === 'huvud' ? ' <span class="dampad">(huvuddiagnos)</span>' : ''}<span class="under-text">${esc(datum(x.datum))}, ${esc(x.vardenhet.namn)}</span>${migreradEtikett(x)}</li>`).join('')}</ul>` : tomRad('Inga diagnoser som du kan se.'),
      // Runda 13, r3 (E1-36): läkaren sätter en diagnos med ICD-10-SE direkt i rutan Diagnoser.
      far('registrera_diagnos') ? '<button type="button" class="knapp liten sekundar" data-satt-diagnos>Sätt diagnos</button>' : ''));
  });
  if (d.matvarden) som('matvarden', () => {
    delar.push(sektion('mv', 'Senaste mätvärden', d.matvarden.length ? `<dl class="matvarden-kort">${d.matvarden.map(m => `<div><dt>${esc(m.namn)}</dt><dd>${varde(m)}<span class="under-text">${esc(tidpunkt(m.tid))}</span></dd></div>`).join('')}</dl>` : tomRad('Inga mätvärden.'), `<a class="sektion-lank" href="${ctx.href('matvarden')}">Alla mätvärden</a>`));
  });
  // Runda 8, r5: tobaksvanorna. Systemet visar den senaste dokumentationen, eller att den saknas, och ett klick öppnar
  // mallen med fasta svarsalternativ.
  if (d.tobak) som('tobak', () => delar.push(sektion('tobak', 'Tobak och nikotin', tobakHtml(d.tobak, ctx))));
  // Runda 9, r7: levnadsvanorna och systemets rekommendation när patienten ingår i en folkhälsoinsats.
  if (d.levnadsvanor) som('levnadsvanor', () => delar.push(sektion('levnadsvanor', 'Levnadsvanor', levnadsvanorHtml(d, ctx))));
  if (d.anteckningar) som('anteckningar', () => {
    delar.push(sektion('ant', 'Senaste anteckningar', d.anteckningar.length ? `<ul class="ant-lista">${d.anteckningar.map(a => `<li><a href="${ctx.href('journal', a.id)}"><span class="ant-typ">${esc(a.typ)}</span>${a.status === 'utkast' ? ' <span class="tagg tagg-utkast">Utkast</span>' : ''}</a>
      <span class="under-text">${esc(tidpunkt(a.signerad?.tid ?? a.skapad))}, ${esc(a.enhet.namn)}, ${esc(a.forfattare?.namn ?? '')}</span>${migreradEtikett(a)}<p class="sammanfattning">${esc(a.sammanfattning)}</p></li>`).join('')}</ul>` : tomRad('Inga anteckningar som du kan se.'), `<a class="sektion-lank" href="${ctx.href('journal')}">Hela journalen</a>`));
  });
  if (d.remisser) som('remisser', () => {
    delar.push(sektion('rem', 'Pågående remisser', d.remisser.length ? `<ul class="enkel-lista">${d.remisser.map(r => `<li><strong>Till ${esc(r.till.namn)}</strong> från ${esc(r.fran.namn)}<span class="under-text">${esc(remissStatusText(r))}, svar senast ${esc(datum(r.svarSenast))}</span>${r.larm?.length ? `<span class="tagg tagg-larm">${esc(r.larm[0].text)}</span>` : ''}</li>`).join('')}</ul>` : tomRad('Inga pågående remisser.'), `<a class="sektion-lank" href="${ctx.href('remisser')}">Remisser</a>`));
  });
  som('tider', () => delar.push(tider.sektionHtml(t)));
  som('vardkontakt', () => delar.push(vardkontakt.sektionHtml(d, ctx)));
  // Runda 7, r3.
  som('ekonomi', () => delar.push(ekonomi.sektionHtml(kost)));
  const k = d.kontakt ?? {};
  aktuellDel = 'kontakt';
  delar.push(sektion('kontakt', 'Kontaktuppgifter', ctx.patient.skyddad
    ? '<p class="dampad">Adress, telefon och kontaktperson visas aldrig för en patient med skyddade personuppgifter, inte heller efter Visa identitet.</p>'
    : `<dl class="faktalista"><div><dt>Adress</dt><dd>${esc(k.adress ?? '')}, ${esc(k.postnr ?? '')} ${esc(k.ort ?? '')}</dd></div><div><dt>Telefon</dt><dd>${esc(k.telefon ?? '')}</dd></div><div><dt>Kontaktperson</dt><dd>${esc(k.kontaktperson ?? 'Ingen angiven')}</dd></div></dl>`));
  aktuellDel = null;
  perDel.set('r3', r3del);
  const vy = d.vy;
  const ordning = vy ? vy.installning.delar : [...perDel.keys(), 'tidslinje'];
  const visade = ordning.filter(x => x !== 'tidslinje' && perDel.has(x)).map(x => perDel.get(x)).join('');

  const begransat = !d.lakemedel && !d.anteckningar
    ? '<p class="ruta ruta-info liten">Din yrkesroll ser administrativa uppgifter: vårdkontakter, kontaktuppgifter och remissernas status. Journaltext, diagnoser och läkemedel visas inte.</p>' : '';

  const rad = (t) => tidslinjeRad(t, ctx);
  const tidslinje = () => (tidslinjeLage === 'tid'
    ? (d.tidslinje.length ? `<ol class="tidslinje">${d.tidslinje.map(rad).join('')}</ol>` : tomRad('Inget att visa.'))
    : vardkontakt.grupperadTidslinje(d, tidslinjeLage, rad));
  const tlSektion = !ordning.includes('tidslinje') ? '' : `<section class="tidslinje-sektion" aria-labelledby="ov-tl">
      <div class="sektion-huvud"><h2 id="ov-tl">Tidslinje</h2><p class="dampad liten">Nyast först. Migrerade poster från VAS och Cosmic ligger i samma kronologi och har samma vikt som ny dokumentation.</p></div>
      <div class="segment tl-lage" role="radiogroup" aria-label="Visa tidslinjen" data-las-ok>${LAGEN.map(([k, t]) => `<input type="radio" id="tl-${k}" name="tl-lage" value="${k}"${k === tidslinjeLage ? ' checked' : ''}><label for="tl-${k}">${esc(t)}</label>`).join('')}</div>
      ${vy?.tidslinjeUtanfor ? `<p class="dampad liten">${esc(vy.installning.tidslinjeDagar)} dagar visas. ${esc(vy.tidslinjeUtanfor)} äldre poster finns i journalen.</p>` : ''}
      <div id="tl-innehall">${tidslinje()}</div>
    </section>`;
  el.innerHTML = `<h2 class="sr">Översikt</h2>${vyRad(vy, ctx)}${snabbval(ctx)}${doldaRad(d.dolda)}${begransat}${vardkontakt.forslagHtml(d)}
    <div class="oversikt-rutnat">${visade}<div id="ov-sj-plats"></div></div>${tlSektion}`;
  kopplaVy(el, vy, ctx);
  el.querySelector('.tl-lage')?.addEventListener('change', (e) => { tidslinjeLage = e.target.value; el.querySelector('#tl-innehall').innerHTML = tidslinje(); });
  vardkontakt.koppla(el, d, ctx, () => ctx.ladda());
  el.querySelector('[data-utskrift]')?.addEventListener('click', () => utskrift.skrivUt(ctx.id));
  el.querySelector('[data-satt-diagnos]')?.addEventListener('click', (e) => sattDiagnos(ctx, e.currentTarget).catch(felNotis));
  el.querySelector('[data-aterbesok]')?.addEventListener('click', () => tider.satUppAterbesok(ctx.id, ctx.patient?.namn ?? 'patienten').catch(felNotis));
  tider.koppla(el, t, ctx, () => ctx.ladda());
  ekonomi.koppla(el, kost, ctx, () => ctx.ladda());
  r3.kopplaOversikt(el, d, ctx);
  // Runda 10, r5: sammanhållen journalföring med en annan vårdgivare (Sussa 3.2.2.3).
  if (far('las_journal')) sammanhallenRuta(el.querySelector('#ov-sj-plats'), ctx);
}

// Andra vårdgivare: systemet vet om samtycket finns och frågar bara när det saknas. Uppgifterna hämtas efter ett
// aktivt val med syfte och läggs i tidslinjen med källan utskriven.
async function sammanhallenRuta(plats, ctx) {
  if (!plats) return;
  let d;
  try { d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/sammanhallen`, { tyst: true }); } catch { return; }
  if (!ctx.aktuell()) return;
  const vg = d.vardgivare.map(v => v.namn).join(', ');
  plats.innerHTML = `<section class="ruta sj-ruta" aria-labelledby="ov-sj"><h2 id="ov-sj">Andra vårdgivare</h2>
    <p class="liten">${esc(d.text)}</p>
    ${d.sparrText ? `<p class="liten sj-sparr">${esc(d.sparrText)}</p>` : ''}
    ${d.hamtad ? `<p class="liten">Hämtat från ${esc(vg)}${d.grund === 'nodatkomst' ? ' med nödåtkomst' : ' med patientens samtycke'}. Uppgifterna finns i tidslinjen.</p>${d.samtycke ? '<button type="button" class="knapp liten sekundar" data-sj-aterkalla>Patienten återkallar samtycket</button>' : ''}`
      : `<form class="sj-form"><div class="falt"><label for="sj-syfte">Syfte</label><input id="sj-syfte" name="syfte" maxlength="300" value="Bedömning inför vården i dag" required></div>
        ${d.samtycke ? '' : '<label class="kryss"><input type="checkbox" name="samtycke" data-sj-samtycke> Patienten samtycker till att uppgifterna hämtas</label>'}
        <button type="submit" class="knapp liten">Hämta uppgifter från ${esc(vg)}</button></form>`}
    <p class="demoregel">${esc(d.simulerad)}</p></section>`;
  plats.querySelector('.sj-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api(`/api/patient/${encodeURIComponent(ctx.id)}/sammanhallen`, { metod: 'POST', data: { syfte: f.syfte.value, samtycke: Boolean(f.querySelector('[data-sj-samtycke]')?.checked) } });
      ctx.ladda();
    } catch (x) { felNotis(x); }
  });
  plats.querySelector('[data-sj-aterkalla]')?.addEventListener('click', async () => {
    try { await api(`/api/patient/${encodeURIComponent(ctx.id)}/sammanhallen/aterkalla`, { metod: 'POST', data: {} }); ctx.ladda(); } catch (x) { felNotis(x); }
  });
}

function tidslinjeRad(t, ctx) {
  const lank = t.ref?.typ === 'anteckning' ? ctx.href('journal', t.ref.id) : t.ref?.typ === 'ordination' ? ctx.href('lakemedel') : t.ref?.typ === 'remiss' ? ctx.href('remisser')
    : R10R4_FLIK[t.ref?.typ] ? ctx.href(R10R4_FLIK[t.ref.typ], t.ref.typ === 'restjournal' ? t.ref.id : undefined) : null;
  const rubrik = lank ? `<a href="${lank}">${esc(t.rubrik)}</a>` : esc(t.rubrik);
  return `<li class="tl-${esc(t.typ)}">
    <time datetime="${esc(t.tid)}"><span class="tl-datum">${esc(datum(t.tid))}</span>${String(t.tid).length > 10 ? `<span class="tl-tid">${esc(klockslag(t.tid))}</span>` : ''}</time>
    <div class="tl-kropp"><p class="tl-rubrik"><span class="tl-typ">${esc(TYP[t.typ] ?? t.typ)}</span>${rubrik}${migreradEtikett(t)}</p>
      ${t.text ? `<p class="tl-text">${esc(t.typ === 'remiss' ? (REMISSTATUS[t.text] ?? t.text) : t.text)}</p>` : ''}<p class="under-text">${esc(t.enhet?.namn ?? '')}</p>${t.typ === 'extern' ? `<p class="under-text"><span class="tagg tagg-demo">${esc(t.kallaEtikett)}</span></p>` : ''}</div>
  </li>`;
}

export const nllChip = (s) => `<span class="nll nll-${esc(s)}">${esc(NLL[s] ?? s)}</span>`;

// Runda 9, r7.
function levnadsvanorHtml(d, ctx) {
  const s = d.levnadsvanor.senaste;
  const rek = (d.folkhalsa ?? []).map(f => `<p class="ruta ruta-info liten">${ikon.info}<span>${esc(f.text)}</span></p>`).join('');
  const text = s ? `<p><a href="${ctx.href('journal', s.anteckningId)}">${esc(s.text)}</a></p><p class="under-text">Dokumenterat ${esc(datum(s.tid))}, ${esc(s.enhet?.namn ?? '')}</p>`
    : tomRad('Alkohol, fysisk aktivitet och matvanor är inte dokumenterade.');
  const knapp = pa('skriv_omvardnad') ? `<p class="knapprad tat"><a class="knapp liten sekundar" href="${ctx.href('journal', 'levnadsvanor')}" data-levnadsvanor-ny>${ikon.penna}<span>${s ? 'Uppdatera levnadsvanor' : 'Dokumentera levnadsvanor'}</span></a></p>` : '';
  return rek + text + knapp;
}

// Runda 8, r5.
function tobakHtml(t, ctx) {
  const s = t.senaste;
  const text = s ? `<p><a href="${ctx.href('journal', s.anteckningId)}">${esc(s.text)}</a></p><p class="under-text">Dokumenterat ${esc(datum(s.tid))}, ${esc(s.enhet?.namn ?? '')}</p>`
    : tomRad('Tobaksvanorna är inte dokumenterade.');
  const knapp = pa('skriv_omvardnad') ? `<p class="knapprad tat" data-skriv><a class="knapp liten sekundar" href="${ctx.href('journal', 'tobak')}" data-tobak-ny>${ikon.penna}<span>${s ? 'Uppdatera tobaksvanor' : 'Dokumentera tobaksvanor'}</span></a></p>` : '';
  return text + knapp;
}

// Runda 10, r2: raden med situationen och anpassningen. Systemet väljer situationen och säger varför, och användaren
// byter situation eller anpassar delar, ordning och tidsurval. Valet sparas på servern per situation.
function vyRad(vy, ctx) {
  if (!vy) return '';
  return `<div class="vyrad" data-las-ok>
    <fieldset class="segment" aria-describedby="ov-vy-varfor"><legend>Situation</legend>${vy.alternativ.situationer.map(s => `<input type="radio" id="ov-sit-${esc(s.id)}" name="ov-situation" value="${esc(s.id)}"${s.id === vy.situation ? ' checked' : ''}><label for="ov-sit-${esc(s.id)}">${esc(s.text)}</label>`).join('')}</fieldset>
    <p class="dampad liten" id="ov-vy-varfor">${esc(vy.varfor)} ${esc(vy.kallaText)}.</p>
    <p class="knapprad"><button type="button" class="knapp liten sekundar" data-anpassa-oversikt>Anpassa översikten</button>${pa('las_oversikt') ? `<a class="knapp liten text" href="${ctx.href('utbildningslage')}">Utbildningsläge</a>` : ''}</p>
  </div>`;
}

function kopplaVy(el, vy, ctx) {
  if (!vy) return;
  el.querySelector('.vyrad fieldset')?.addEventListener('change', (e) => { situationVal = e.target.value; ctx.ladda(); });
  el.querySelector('[data-anpassa-oversikt]')?.addEventListener('click', () => anpassa(vy).then(k => { if (k) ctx.ladda(); }).catch(felNotis));
}

async function anpassa(vy) {
  const valda = vy.installning.delar;
  const rader = [...valda, ...vy.alternativ.delar.map(d => d.id).filter(id => !valda.includes(id))];
  const text = Object.fromEntries(vy.alternativ.delar.map(d => [d.id, d.text]));
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Anpassa översikten vid ${esc(vy.situationText.toLowerCase())}</h2>
    <div class="dialog-text"><p>Valet sparas för dig och gäller den här situationen på alla datorer. Delar som din yrkesroll inte får läsa finns inte i listan.</p></div>
    <fieldset class="kryssgrupp"><legend>Delar och ordning</legend><ol class="vy-ordning">${rader.map(id => `<li data-id="${esc(id)}"><span class="kryssfalt"><input type="checkbox" id="vy-del-${esc(id)}" name="d_${esc(id)}"${valda.includes(id) ? ' checked' : ''}><label for="vy-del-${esc(id)}">${esc(text[id] ?? id)}</label></span> <button type="button" class="knapp liten text" data-upp aria-label="Flytta upp ${esc(text[id] ?? id)}">Upp</button></li>`).join('')}</ol></fieldset>
    <div class="falt"><label for="vy-tid">Tidslinjen visar</label><select id="vy-tid" name="tid">${vy.alternativ.tidsurval.map(t => `<option value="${t.dagar ?? ''}"${(t.dagar ?? null) === (vy.installning.tidslinjeDagar ?? null) ? ' selected' : ''}>${esc(t.text)}</option>`).join('')}</select></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="aterstall">Återställ förvalet</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div></form>`, {
    onOpen: (dl) => dl.querySelector('.vy-ordning').addEventListener('click', (e) => {
      const b = e.target.closest('[data-upp]');
      if (!b) return;
      const li = b.closest('li');
      if (li.previousElementSibling) li.parentElement.insertBefore(li, li.previousElementSibling);
      b.focus();
    }),
    validera: (data, dl, val) => (val === 'ok' && !dl.querySelector('.vy-ordning input:checked') ? 'Välj minst en del.' : null),
  });
  if (!svar) return false;
  if (svar.val === 'aterstall') { await api(`/api/oversiktsvy/${vy.situation}/aterstall`, { metod: 'POST', data: {} }); notis('Översikten visar förvalet igen.'); return true; }
  const ordning = [...document.querySelectorAll('.vy-ordning li')].map(li => li.dataset.id);
  const delar = ordning.filter(id => svar.data[`d_${id}`]);
  await api(`/api/oversiktsvy/${vy.situation}`, { metod: 'PUT', data: { installning: { delar, tidslinjeDagar: svar.data.tid ? Number(svar.data.tid) : null } } });
  notis('Översikten är sparad för situationen.');
  return true;
}

// Sammanfattningen av uppföljningsvyn: var i vårdprocessen och antalet avvikelser.
function uppfoljningHtml(u) {
  return `<p>${esc(u.lage.text)}</p><p class="${u.avvikelser ? 'tagg tagg-larm' : 'dampad liten'}">${u.avvikelser ? `${esc(u.avvikelser)} ${u.avvikelser === 1 ? 'avvikelse' : 'avvikelser'} att följa upp` : 'Inga avvikelser att följa upp.'}</p>`;
}

// Runda 13, r3 (E1-36): diagnosen sätts på den pågående vårdkontakten med kod eller text ur ICD-10-SE. Systemet avgör om
// den är huvud- eller bidiagnos och prövar koden mot den utgåva som gäller.
// Runda 13, r3: vardkontakt ger kontakten direkt, när läkaren avslutar den (patient-vardkontakt.js). Ger true när
// diagnosen är satt.
export async function sattDiagnos(ctx, knapp, { vardkontakt = null } = {}) {
  const pid = encodeURIComponent(ctx.id);
  const akt = vardkontakt ? { vardkontakt } : await api(`/api/patient/${pid}/vardkontakt/aktuell`);
  if (!akt.vardkontakt?.id) { notis('Diagnosen sätts på en vårdkontakt. Patienten har ingen pågående kontakt på din vårdenhet. Skriv anteckningen först, så skapar systemet kontakten.', 'info'); return; }
  const val = await api('/api/rapportering/rattning/val');
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Sätt diagnos</h2>
    <p>Vårdkontakten: ${esc(akt.vardkontakt.orsak ?? '')}, ${esc(akt.vardkontakt.vardenhet?.namn ?? '')}.</p>
    <div class="falt"><label for="sd-kod">Diagnos, kod eller text i ICD-10-SE</label><input id="sd-kod" name="kod" list="sd-lista" required autocomplete="off"><datalist id="sd-lista">${(val.diagnoser ?? []).slice(0, 400).map(x => `<option value="${esc(x.kod)}">${esc(x.text)}</option>`).join('')}</datalist>
      <span class="hjalp">Skriv början av koden eller ordet och välj i listan. Systemet avgör om det är huvud- eller bidiagnos.</span></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Sätt diagnosen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return false;
  const kod = String(svar.data.kod ?? '').trim().split(/\s/)[0];
  const r = await api(`/api/vardkontakt/${encodeURIComponent(akt.vardkontakt.id)}/diagnos`, { metod: 'POST', data: { kod } });
  notis(`${r.kod} ${r.text} är satt som ${r.typ === 'huvud' ? 'huvuddiagnos' : 'bidiagnos'}.`);
  ctx.ladda?.();
  void knapp;
  return true;
}

