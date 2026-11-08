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

// När frågeställningen inte visas för rollen skickar servern remissens status i stället.
const REMISSTATUS = { skickad: 'Status: skickad', mottagen: 'Status: mottagen', bedomd: 'Status: bedömd', besvarad: 'Status: besvarad', svar_kvitterat: 'Status: svaret är kvitterat' };
const TYP = { vardkontakt: 'Vårdkontakt', vardtillfalle: 'Vårdtillfälle', anteckning: 'Anteckning', ordination: 'Läkemedel', remiss: 'Remiss' };
// Tidslinjen i tidsordning, per vårdtillfälle och vårdkontakt, eller per hälsoärende. Valet gäller under sessionen.
const LAGEN = [['tid', 'I tidsordning'], ['kontakt', 'Per vårdkontakt'], ['arende', 'Per hälsoärende']];
let tidslinjeLage = 'tid';

const sektion = (id, rubrik, innehall, extra = '') => `<section class="ov-sektion" aria-labelledby="ov-${id}"><div class="sektion-huvud"><h2 id="ov-${id}">${esc(rubrik)}</h2>${extra}</div>${innehall}</section>`;
const tomRad = (t) => `<p class="tom liten">${esc(t)}</p>`;

export const varde = (m) => `${esc(typeof m.varde === 'number' ? tal(m.varde, 2) : m.varde)} <span class="enhet">${esc(m.enhet)}</span>`;

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
  const [d, t, kost] = await Promise.all([api(`/api/patient/${encodeURIComponent(ctx.id)}/oversikt`), tider.hamta(ctx.id), ekonomi.hamta(ctx.id)]);
  if (!ctx.aktuell()) return;
  const delar = [];
  // Runda 6, r3: tvångsvården först, eftersom fristerna räknas i timmar.
  const r3del = r3.oversiktHtml(d, ctx);

  if (d.lakemedel) {
    delar.push(sektion('lm', 'Aktuella läkemedel', lakemedelsalderRad(ctx.id) + (d.lakemedel.length ? `<div class="tabellrulle"><table class="tabell tat">
      <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Ordinationsorsak</th></tr></thead>
      <tbody>${d.lakemedel.map(o => `<tr><td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)}</span>${o.nll_status !== 'kvitterad' ? ` ${nllChip(o.nll_status)}` : ''}${migreradEtikett(o)}</td><td>${esc(o.dosering)}</td><td>${esc(o.ordinationsorsak)}</td></tr>`).join('')}</tbody></table></div>
      <p class="dampad liten">Alla utom de markerade är kvitterade av Nationella läkemedelslistan.</p>` : tomRad('Inga aktuella läkemedel.')), `<a class="sektion-lank" href="${ctx.href('lakemedel')}">Läkemedelslistan</a>`));
  }
  if (d.diagnoser) {
    delar.push(sektion('dia', 'Diagnoser', d.diagnoser.length ? `<ul class="enkel-lista">${d.diagnoser.map(x => `<li><span class="kod">${esc(x.kod)}</span> ${esc(x.text)}${x.typ === 'huvud' ? ' <span class="dampad">(huvuddiagnos)</span>' : ''}<span class="under-text">${esc(datum(x.datum))}, ${esc(x.vardenhet.namn)}</span>${migreradEtikett(x)}</li>`).join('')}</ul>` : tomRad('Inga diagnoser som du kan se.')));
  }
  if (d.matvarden) {
    delar.push(sektion('mv', 'Senaste mätvärden', d.matvarden.length ? `<dl class="matvarden-kort">${d.matvarden.map(m => `<div><dt>${esc(m.namn)}</dt><dd>${varde(m)}<span class="under-text">${esc(tidpunkt(m.tid))}</span></dd></div>`).join('')}</dl>` : tomRad('Inga mätvärden.'), `<a class="sektion-lank" href="${ctx.href('matvarden')}">Alla mätvärden</a>`));
  }
  // Runda 8, r5: tobaksvanorna. Systemet visar den senaste dokumentationen, eller att den saknas, och ett klick öppnar
  // mallen med fasta svarsalternativ.
  if (d.tobak) delar.push(sektion('tobak', 'Tobak och nikotin', tobakHtml(d.tobak, ctx)));
  if (d.anteckningar) {
    delar.push(sektion('ant', 'Senaste anteckningar', d.anteckningar.length ? `<ul class="ant-lista">${d.anteckningar.map(a => `<li><a href="${ctx.href('journal', a.id)}"><span class="ant-typ">${esc(a.typ)}</span>${a.status === 'utkast' ? ' <span class="tagg tagg-utkast">Utkast</span>' : ''}</a>
      <span class="under-text">${esc(tidpunkt(a.signerad?.tid ?? a.skapad))}, ${esc(a.enhet.namn)}, ${esc(a.forfattare?.namn ?? '')}</span>${migreradEtikett(a)}<p class="sammanfattning">${esc(a.sammanfattning)}</p></li>`).join('')}</ul>` : tomRad('Inga anteckningar som du kan se.'), `<a class="sektion-lank" href="${ctx.href('journal')}">Hela journalen</a>`));
  }
  if (d.remisser) {
    delar.push(sektion('rem', 'Pågående remisser', d.remisser.length ? `<ul class="enkel-lista">${d.remisser.map(r => `<li><strong>Till ${esc(r.till.namn)}</strong> från ${esc(r.fran.namn)}<span class="under-text">${esc(remissStatusText(r))}, svar senast ${esc(datum(r.svarSenast))}</span>${r.larm?.length ? `<span class="tagg tagg-larm">${esc(r.larm[0].text)}</span>` : ''}</li>`).join('')}</ul>` : tomRad('Inga pågående remisser.'), `<a class="sektion-lank" href="${ctx.href('remisser')}">Remisser</a>`));
  }
  delar.push(tider.sektionHtml(t));
  delar.push(vardkontakt.sektionHtml(d, ctx));
  // Runda 7, r3.
  delar.push(ekonomi.sektionHtml(kost));
  const k = d.kontakt;
  delar.push(sektion('kontakt', 'Kontaktuppgifter', ctx.patient.skyddad
    ? '<p class="dampad">Adress, telefon och kontaktperson visas aldrig för en patient med skyddade personuppgifter, inte heller efter Visa identitet.</p>'
    : `<dl class="faktalista"><div><dt>Adress</dt><dd>${esc(k.adress ?? '')}, ${esc(k.postnr ?? '')} ${esc(k.ort ?? '')}</dd></div><div><dt>Telefon</dt><dd>${esc(k.telefon ?? '')}</dd></div><div><dt>Kontaktperson</dt><dd>${esc(k.kontaktperson ?? 'Ingen angiven')}</dd></div></dl>`));

  const begransat = !d.lakemedel && !d.anteckningar
    ? '<p class="ruta ruta-info liten">Din yrkesroll ser administrativa uppgifter: vårdkontakter, kontaktuppgifter och remissernas status. Journaltext, diagnoser och läkemedel visas inte.</p>' : '';

  const rad = (t) => tidslinjeRad(t, ctx);
  const tidslinje = () => (tidslinjeLage === 'tid'
    ? (d.tidslinje.length ? `<ol class="tidslinje">${d.tidslinje.map(rad).join('')}</ol>` : tomRad('Inget att visa.'))
    : vardkontakt.grupperadTidslinje(d, tidslinjeLage, rad));
  el.innerHTML = `<h2 class="sr">Översikt</h2>${snabbval(ctx)}${doldaRad(d.dolda)}${begransat}${vardkontakt.forslagHtml(d)}
    <div class="oversikt-rutnat">${r3del}${delar.join('')}</div>
    <section class="tidslinje-sektion" aria-labelledby="ov-tl">
      <div class="sektion-huvud"><h2 id="ov-tl">Tidslinje</h2><p class="dampad liten">Nyast först. Migrerade poster från VAS och Cosmic ligger i samma kronologi och har samma vikt som ny dokumentation.</p></div>
      <div class="segment tl-lage" role="radiogroup" aria-label="Visa tidslinjen" data-las-ok>${LAGEN.map(([k, t]) => `<input type="radio" id="tl-${k}" name="tl-lage" value="${k}"${k === tidslinjeLage ? ' checked' : ''}><label for="tl-${k}">${esc(t)}</label>`).join('')}</div>
      <div id="tl-innehall">${tidslinje()}</div>
    </section>`;
  el.querySelector('.tl-lage').addEventListener('change', (e) => { tidslinjeLage = e.target.value; el.querySelector('#tl-innehall').innerHTML = tidslinje(); });
  vardkontakt.koppla(el, d, ctx, () => ctx.ladda());
  el.querySelector('[data-utskrift]')?.addEventListener('click', () => utskrift.skrivUt(ctx.id));
  el.querySelector('[data-aterbesok]')?.addEventListener('click', () => tider.satUppAterbesok(ctx.id, ctx.patient?.namn ?? 'patienten').catch(felNotis));
  tider.koppla(el, t, ctx, () => ctx.ladda());
  ekonomi.koppla(el, kost, ctx, () => ctx.ladda());
  r3.kopplaOversikt(el, d, ctx);
}

function tidslinjeRad(t, ctx) {
  const lank = t.ref?.typ === 'anteckning' ? ctx.href('journal', t.ref.id) : t.ref?.typ === 'ordination' ? ctx.href('lakemedel') : t.ref?.typ === 'remiss' ? ctx.href('remisser') : null;
  const rubrik = lank ? `<a href="${lank}">${esc(t.rubrik)}</a>` : esc(t.rubrik);
  return `<li class="tl-${esc(t.typ)}">
    <time datetime="${esc(t.tid)}"><span class="tl-datum">${esc(datum(t.tid))}</span><span class="tl-tid">${esc(klockslag(t.tid))}</span></time>
    <div class="tl-kropp"><p class="tl-rubrik"><span class="tl-typ">${esc(TYP[t.typ] ?? t.typ)}</span>${rubrik}${migreradEtikett(t)}</p>
      ${t.text ? `<p class="tl-text">${esc(t.typ === 'remiss' ? (REMISSTATUS[t.text] ?? t.text) : t.text)}</p>` : ''}<p class="under-text">${esc(t.enhet?.namn ?? '')}</p></div>
  </li>`;
}

export const nllChip = (s) => `<span class="nll nll-${esc(s)}">${esc(NLL[s] ?? s)}</span>`;

// Runda 8, r5.
function tobakHtml(t, ctx) {
  const s = t.senaste;
  const text = s ? `<p><a href="${ctx.href('journal', s.anteckningId)}">${esc(s.text)}</a></p><p class="under-text">Dokumenterat ${esc(datum(s.tid))}, ${esc(s.enhet?.namn ?? '')}</p>`
    : tomRad('Tobaksvanorna är inte dokumenterade.');
  const knapp = pa('skriv_omvardnad') ? `<p class="knapprad tat" data-skriv><a class="knapp liten sekundar" href="${ctx.href('journal', 'tobak')}" data-tobak-ny>${ikon.penna}<span>${s ? 'Uppdatera tobaksvanor' : 'Dokumentera tobaksvanor'}</span></a></p>` : '';
  return text + knapp;
}
