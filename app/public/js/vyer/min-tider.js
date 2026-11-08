// Min journal: patientens tider. Kommande tider med kallelsen som patienten har fått, incheckning, betalning,
// bekräftelse, ombokning och avbokning, och egen bokning av de tidstyper som mottagningen öppnar för det. Systemet
// föreslår tiderna på samma sätt som för vårdadministratören.
import { esc, api, notis, felNotis, medKnapp } from '../ui.js';
import { valjTid, valjBetalsatt, tidText, kr } from '../tidbok-ui.js';
// Runda 6, r4: kallelsen som PDF och för kalendern, kallelser utan förbokad tid och språket för kallelserna.
import { kallelseFiler } from '../planering-ui.js';
// Runda 10, r7: avgifter för recept och intyg och möteslänkar för videobesök (min-r10r7.js).
import { tiderTillagg } from './min-r10r7.js';

const del = (pid, v = '') => `/api/min/journal/${encodeURIComponent(pid)}${v}`;
const STATUS = { bokad: 'Bokad', incheckad: 'Incheckad', ombokad: 'Ombokad', avbokad: 'Avbokad' };

function tidKort(b, pid) {
  const knappar = [
    b.kan.checkaIn && `<button type="button" class="knapp" data-min="checka-in" data-id="${b.id}">Checka in</button>`,
    b.kan.betala && `<button type="button" class="knapp" data-min="betala" data-id="${b.id}">Betala ${esc(kr(b.avgift.belopp))}</button>`,
    b.kan.bekrafta && `<button type="button" class="knapp sekundar liten" data-min="bekrafta" data-id="${b.id}">Jag kommer</button>`,
    b.kan.omboka && `<button type="button" class="knapp sekundar liten" data-min="omboka" data-id="${b.id}">Boka om</button>`,
    b.kan.avboka && `<button type="button" class="knapp text liten" data-min="avboka" data-id="${b.id}">Avboka</button>`,
  ].filter(Boolean);
  const kallelse = b.kallelser.filter(k => k.typ !== 'paminnelse').at(-1) ?? b.kallelser.at(-1);
  return `<li class="min-tid" data-tid-id="${b.id}">
    <p class="min-tid-nar"><strong>${esc(tidText(b.start))}</strong> <span class="tagg${b.status === 'incheckad' ? ' tagg-pagaende' : ''}">${esc(STATUS[b.status] ?? b.status)}</span>${b.bekraftad ? ' <span class="tagg">Bekräftad</span>' : ''}</p>
    <p>${esc(b.ingrepp ?? b.rubrik ?? b.tidstypText)} hos ${esc(b.yrkesroll)} ${esc(b.vardgivare ?? '')}, ${esc(b.lokal ? `${b.lokal}, ` : '')}${esc(b.mottagning)}</p>
    ${b.kedja ? `<p class="dampad liten">${esc(b.kedja.text)}.</p>` : ''}
    ${b.status === 'incheckad' ? `<p class="ruta ruta-info liten">Du är incheckad${b.konummer ? `. Vi ropar upp dig med nummer <strong>${esc(b.konummer)}</strong>` : ''}.${b.betalning ? ` ${esc(b.betalning.sattText)}${b.betalning.belopp ? ` ${esc(kr(b.betalning.belopp))}` : ''}.` : ''}</p>` : ''}
    ${b.avgift && b.status !== 'incheckad' ? `<p class="dampad liten">Avgift ${esc(kr(b.avgift.belopp))}. Avgifterna i demon är påhittade.</p>` : ''}
    ${b.varforInte ? `<p class="dampad liten">${esc(b.varforInte)}</p>` : ''}
    ${knappar.length ? `<div class="knapprad">${knappar.join('')}</div>` : ''}
    ${kallelse ? `<details class="tider-kallelse"><summary>Kallelsen du fick (${esc(kallelse.kanal)})</summary><p class="kallelse-text">${esc(kallelse.text)}</p>${kallelse.forklaring ? `<p class="hjalp">${esc(kallelse.forklaring)}</p>` : ''}${kallelseFiler(del(pid, `/kallelse/${kallelse.id}`))}</details>` : ''}
  </li>`;
}

// Runda 6, r4: en kallelse där patienten väljer en tid själv inom ramen, och språket för kallelserna.
const ramKort = (r) => `<li class="min-tid min-ram"><p class="min-tid-nar"><strong>${esc(r.tidstypText)} hos ${esc(r.yrkesrollText)}, ${esc(r.vardenhet ?? '')}</strong> <span class="tagg">Välj en tid</span></p>
  <p class="kallelse-text">${esc(r.text)}</p><div class="knapprad"><button type="button" class="knapp" data-min="ram" data-id="${r.id}">Välj tid</button></div></li>`;
const sprakHtml = (s) => `<section class="ov-sektion" aria-labelledby="min-sprak"><div class="sektion-huvud"><h3 id="min-sprak">Språk för kallelser</h3></div>
  <div class="falt-rad"><div class="falt"><label for="min-sprakval">Kallelser och påminnelser skrivs på</label><select id="min-sprakval">${[['sv', 'Svenska'], ['en', 'Engelska']].map(([k, t]) => `<option value="${k}"${s.sprak === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
  <div class="falt"><button type="button" class="knapp sekundar liten" data-min="sprak">Spara</button></div></div></section>`;

// Runda 7, r3: högkostnadsskyddet med varje avgift som räknas.
const hogkostnadHtml = (hk) => `<section class="ov-sektion min-hogkostnad" aria-labelledby="min-hk"><div class="sektion-huvud"><h3 id="min-hk">Högkostnadsskydd</h3></div>
  <p>${esc(hk.text)}</p>
  ${hk.avgifter.length ? `<details><summary>Avgifter som räknas (${hk.avgifter.length})</summary><ul class="enkel-lista">${hk.avgifter.map(a => `<li>${esc(a.datum)}, ${esc(a.vardenhet ?? '')}: ${esc(kr(a.belopp))}</li>`).join('')}</ul></details>` : ''}
  <p class="hjalp">${esc(hk.demo)}</p></section>`;

export async function visa(el, ctx) {
  // Runda 7, r3: högkostnadsskyddet hämtas samtidigt. Patienten ser hela skyddet med alla avgifter.
  const [t, hk, extra] = await Promise.all([api(del(ctx.pid, '/tider')), api(del(ctx.pid, '/hogkostnadsskydd')).catch(() => null), tiderTillagg(ctx.pid)]);
  if (!ctx.aktuell()) return;
  t.tjanstavgifter = extra.avgifter;
  el.innerHTML = `<div class="flikhuvud"><h2>Tider</h2></div>
    ${t.kanal.forklaring ? `<p class="ruta ruta-info liten">${esc(t.kanal.forklaring)}</p>` : ''}
    ${t.kallelserUtanTid?.length ? `<ul class="min-tider">${t.kallelserUtanTid.map(ramKort).join('')}</ul>` : ''}
    ${t.kommande.length ? `<ul class="min-tider">${t.kommande.map(b => tidKort(b, ctx.pid)).join('')}</ul>` : '<p class="tom">Du har inga bokade tider.</p>'}
    ${t.boka.length ? `<section class="ov-sektion" aria-labelledby="min-boka"><div class="sektion-huvud"><h3 id="min-boka">Boka en ny tid</h3></div>
      <ul class="enkel-lista">${t.boka.map(v => `<li><strong>${esc(v.tidstypText)} hos ${esc(v.yrkesrollText)}</strong>, ${esc(v.vardenhet.namn)}
        <span class="knapprad tat"><button type="button" class="knapp sekundar liten" data-min="boka" data-nyckel="${esc(v.nyckel)}">Visa lediga tider</button></span></li>`).join('')}</ul>
      <p class="hjalp">Du kan boka de tider som mottagningarna där du redan får vård öppnar för det.</p></section>` : ''}
    ${t.tidigare.length ? `<section class="ov-sektion" aria-labelledby="min-tidigare"><div class="sektion-huvud"><h3 id="min-tidigare">Tidigare och ändrade tider</h3></div>
      <ul class="enkel-lista">${t.tidigare.map(b => `<li>${esc(tidText(b.start))}, ${esc(b.tidstypText)}, ${esc(b.mottagning)} <span class="tagg">${esc(STATUS[b.status] ?? b.status)}</span></li>`).join('')}</ul></section>` : ''}
    ${extra.html}
    ${hk ? hogkostnadHtml(hk) : ''}
    ${t.sprak ? sprakHtml(t.sprak) : ''}
    <p class="hjalp">${esc(t.demoregler)}</p>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-min], [data-avgift-betala]');
    if (!b) return;
    try { if (await atgard(b, t, ctx)) await ctx.ladda(); } catch (err) { felNotis(err); }
  });
}

async function atgard(b, t, ctx) {
  // Runda 10, r7: en avgift för en receptförnyelse eller ett intyg.
  if (b.dataset.avgiftBetala) {
    const avg = t.tjanstavgifter.find(x => String(x.id) === b.dataset.avgiftBetala);
    const satt = await valjBetalsatt({ belopp: avg.belopp, text: avg.text }, 'Du');
    if (!satt) return false;
    const r = await api(del(ctx.pid, `/avgift/${avg.id}/betala`), { metod: 'POST', data: { satt } });
    notis(`Betalt. Kvitto ${r.betalning?.kvitto ?? ''}.`);
    return true;
  }
  const a = b.dataset.min;
  const bok = t.kommande.find(x => String(x.id) === b.dataset.id);
  const post = (vag, data = {}) => api(del(ctx.pid, vag), { metod: 'POST', data });
  if (a === 'checka-in') {
    const r = await medKnapp(b, () => post(`/bokning/${bok.id}/checka-in`));
    notis(`Du är incheckad${r.konummer ? `. Vi ropar upp dig med nummer ${r.konummer}` : ''}.`);
  } else if (a === 'betala') {
    const satt = await valjBetalsatt(bok.avgift, 'Du');
    if (!satt) return false;
    const r = await post(`/bokning/${bok.id}/betala`, { satt });
    notis(`Betalt. Kvitto ${r.betalning?.kvitto ?? ''}.`);
  } else if (a === 'bekrafta') {
    await medKnapp(b, () => post(`/bokning/${bok.id}/bekrafta`));
    notis('Tack. Mottagningen ser att du kommer.');
  } else if (a === 'omboka') {
    const f = await api(del(ctx.pid, `/bokning/${bok.id}/forslag`));
    const tidId = await valjTid({ rubrik: 'Boka om din tid', text: `Din tid nu: ${esc(tidText(bok.start))}. Välj en ny tid. Den gamla tiden avbokas av sig själv.`, forslag: f.forslag });
    if (!tidId) return false;
    const r = await post(`/bokning/${bok.id}/omboka`, { tidId });
    notis(`Din tid är ombokad till ${tidText(r.start)}. Du har fått en ny kallelse här i Min journal.`);
  } else if (a === 'avboka') {
    await medKnapp(b, () => post(`/bokning/${bok.id}/avboka`));
    notis('Din tid är avbokad. Mottagningen hör av sig om en ny tid.');
  } else if (a === 'ram') {
    // Runda 6, r4: kallelse utan förbokad tid. Systemet föreslår tider inom ramen.
    const r = t.kallelserUtanTid.find(x => String(x.id) === b.dataset.id);
    const f = await api(del(ctx.pid, `/kallelse-ram/${r.id}/forslag`));
    const tidId = await valjTid({ rubrik: `Välj tid för ${r.tidstypText.toLowerCase()}`, text: `${esc(r.tidstypText)} hos ${esc(r.yrkesrollText)}, ${esc(r.vardenhet ?? '')}. Tiderna ligger mellan ${esc(r.fran)} och ${esc(r.till)}.`, forslag: f.forslag });
    if (!tidId) return false;
    const ny = await post(`/kallelse-ram/${r.id}/boka`, { tidId });
    notis(`Din tid är bokad: ${tidText(ny.start)}. Kallelsen finns här i Min journal.`);
  } else if (a === 'sprak') {
    const val = b.closest('section').querySelector('#min-sprakval').value;
    const r = await medKnapp(b, () => post('/sprak', { sprak: val }));
    notis(`Kallelser skrivs nu på ${r.text.toLowerCase()}.`);
  } else if (a === 'boka') {
    const f = await api(del(ctx.pid, `/boka/forslag?nyckel=${encodeURIComponent(b.dataset.nyckel)}`));
    const tidId = await valjTid({ rubrik: `Boka ${f.val.tidstypText.toLowerCase()}`, text: `${esc(f.val.tidstypText)} hos ${esc(f.val.yrkesrollText)}, ${esc(f.val.vardenhet.namn)}.`, forslag: f.forslag });
    if (!tidId) return false;
    const r = await post('/boka', { nyckel: b.dataset.nyckel, tidId });
    notis(`Din tid är bokad: ${tidText(r.start)}. Kallelsen finns här i Min journal.`);
  }
  return true;
}
