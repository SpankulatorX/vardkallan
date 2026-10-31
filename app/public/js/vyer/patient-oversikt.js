// Översikten: aktuella läkemedel, diagnoser, senaste mätvärden och anteckningar, pågående remisser och tidslinjen.
import { esc, api, datum, tidpunkt, klockslag, migreradEtikett, NLL, VARDFORM, tal } from '../ui.js';
import { doldaRad } from './patient.js';
import { remissStatusText } from './remisser.js';

// När frågeställningen inte visas för rollen skickar servern remissens status i stället.
const REMISSTATUS = { skickad: 'Status: skickad', mottagen: 'Status: mottagen', bedomd: 'Status: bedömd', besvarad: 'Status: besvarad', svar_kvitterat: 'Status: svaret är kvitterat' };
const TYP = { vardkontakt: 'Vårdkontakt', anteckning: 'Anteckning', ordination: 'Läkemedel', remiss: 'Remiss' };

const sektion = (id, rubrik, innehall, extra = '') => `<section class="ov-sektion" aria-labelledby="ov-${id}"><div class="sektion-huvud"><h2 id="ov-${id}">${esc(rubrik)}</h2>${extra}</div>${innehall}</section>`;
const tomRad = (t) => `<p class="tom liten">${esc(t)}</p>`;

export const varde = (m) => `${esc(typeof m.varde === 'number' ? tal(m.varde, 2) : m.varde)} <span class="enhet">${esc(m.enhet)}</span>`;

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/oversikt`);
  if (!ctx.aktuell()) return;
  const delar = [];

  if (d.lakemedel) {
    delar.push(sektion('lm', 'Aktuella läkemedel', d.lakemedel.length ? `<div class="tabellrulle"><table class="tabell tat">
      <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Ordinationsorsak</th></tr></thead>
      <tbody>${d.lakemedel.map(o => `<tr><td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)}</span>${o.nll_status !== 'kvitterad' ? ` ${nllChip(o.nll_status)}` : ''}${migreradEtikett(o)}</td><td>${esc(o.dosering)}</td><td>${esc(o.ordinationsorsak)}</td></tr>`).join('')}</tbody></table></div>
      <p class="dampad liten">Alla utom de markerade är kvitterade av Nationella läkemedelslistan.</p>` : tomRad('Inga aktuella läkemedel.'), `<a class="sektion-lank" href="${ctx.href('lakemedel')}">Läkemedelslistan</a>`));
  }
  if (d.diagnoser) {
    delar.push(sektion('dia', 'Diagnoser', d.diagnoser.length ? `<ul class="enkel-lista">${d.diagnoser.map(x => `<li><span class="kod">${esc(x.kod)}</span> ${esc(x.text)}${x.typ === 'huvud' ? ' <span class="dampad">(huvuddiagnos)</span>' : ''}<span class="under-text">${esc(datum(x.datum))}, ${esc(x.vardenhet.namn)}</span>${migreradEtikett(x)}</li>`).join('')}</ul>` : tomRad('Inga diagnoser som du kan se.')));
  }
  if (d.matvarden) {
    delar.push(sektion('mv', 'Senaste mätvärden', d.matvarden.length ? `<dl class="matvarden-kort">${d.matvarden.map(m => `<div><dt>${esc(m.namn)}</dt><dd>${varde(m)}<span class="under-text">${esc(tidpunkt(m.tid))}</span></dd></div>`).join('')}</dl>` : tomRad('Inga mätvärden.'), `<a class="sektion-lank" href="${ctx.href('matvarden')}">Alla mätvärden</a>`));
  }
  if (d.anteckningar) {
    delar.push(sektion('ant', 'Senaste anteckningar', d.anteckningar.length ? `<ul class="ant-lista">${d.anteckningar.map(a => `<li><a href="${ctx.href('journal', a.id)}"><span class="ant-typ">${esc(a.typ)}</span>${a.status === 'utkast' ? ' <span class="tagg tagg-utkast">Utkast</span>' : ''}</a>
      <span class="under-text">${esc(tidpunkt(a.signerad?.tid ?? a.skapad))}, ${esc(a.enhet.namn)}, ${esc(a.forfattare?.namn ?? '')}</span>${migreradEtikett(a)}<p class="sammanfattning">${esc(a.sammanfattning)}</p></li>`).join('')}</ul>` : tomRad('Inga anteckningar som du kan se.'), `<a class="sektion-lank" href="${ctx.href('journal')}">Hela journalen</a>`));
  }
  if (d.remisser) {
    delar.push(sektion('rem', 'Pågående remisser', d.remisser.length ? `<ul class="enkel-lista">${d.remisser.map(r => `<li><strong>Till ${esc(r.till.namn)}</strong> från ${esc(r.fran.namn)}<span class="under-text">${esc(remissStatusText(r))}, svar senast ${esc(datum(r.svarSenast))}</span>${r.larm?.length ? `<span class="tagg tagg-larm">${esc(r.larm[0].text)}</span>` : ''}</li>`).join('')}</ul>` : tomRad('Inga pågående remisser.'), `<a class="sektion-lank" href="${ctx.href('remisser')}">Remisser</a>`));
  }
  delar.push(sektion('vk', 'Vårdkontakter', d.vardkontakter.length ? `<ul class="enkel-lista">${d.vardkontakter.map(v => `<li><strong>${esc(v.orsak)}</strong>${v.pagaende ? ' <span class="tagg tagg-pagaende">Pågående</span>' : ''}<span class="under-text">${esc(VARDFORM[v.typ] ?? v.typ)}, ${esc(v.vardenhet.namn)}, ${esc(v.plats)}. ${esc(datum(v.start))}${v.slut ? ` till ${esc(datum(v.slut))}` : ''}</span>${migreradEtikett(v)}</li>`).join('')}</ul>` : tomRad('Inga vårdkontakter som du kan se.')));
  const k = d.kontakt;
  delar.push(sektion('kontakt', 'Kontaktuppgifter', ctx.patient.skyddad
    ? '<p class="dampad">Adress, telefon och kontaktperson visas aldrig för en patient med skyddade personuppgifter, inte heller efter Visa identitet.</p>'
    : `<dl class="faktalista"><div><dt>Adress</dt><dd>${esc(k.adress ?? '')}, ${esc(k.postnr ?? '')} ${esc(k.ort ?? '')}</dd></div><div><dt>Telefon</dt><dd>${esc(k.telefon ?? '')}</dd></div><div><dt>Kontaktperson</dt><dd>${esc(k.kontaktperson ?? 'Ingen angiven')}</dd></div></dl>`));

  const begransat = !d.lakemedel && !d.anteckningar
    ? '<p class="ruta ruta-info liten">Din yrkesroll ser administrativa uppgifter: vårdkontakter, kontaktuppgifter och remissernas status. Journaltext, diagnoser och läkemedel visas inte.</p>' : '';

  el.innerHTML = `<h2 class="sr">Översikt</h2>${doldaRad(d.dolda)}${begransat}
    <div class="oversikt-rutnat">${delar.join('')}</div>
    <section class="tidslinje-sektion" aria-labelledby="ov-tl">
      <div class="sektion-huvud"><h2 id="ov-tl">Tidslinje</h2><p class="dampad liten">Nyast först. Migrerade poster från VAS och Cosmic ligger i samma kronologi och har samma vikt som ny dokumentation.</p></div>
      ${d.tidslinje.length ? `<ol class="tidslinje">${d.tidslinje.map(t => tidslinjeRad(t, ctx)).join('')}</ol>` : tomRad('Inget att visa.')}
    </section>`;
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
