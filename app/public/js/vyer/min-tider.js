// Min journal: patientens tider. Kommande tider med kallelsen som patienten har fått, incheckning, betalning,
// bekräftelse, ombokning och avbokning, och egen bokning av de tidstyper som mottagningen öppnar för det. Systemet
// föreslår tiderna på samma sätt som för vårdadministratören.
import { esc, api, notis, felNotis, medKnapp } from '../ui.js';
import { valjTid, valjBetalsatt, tidText, kr } from '../tidbok-ui.js';

const del = (pid, v = '') => `/api/min/journal/${encodeURIComponent(pid)}${v}`;
const STATUS = { bokad: 'Bokad', incheckad: 'Incheckad', ombokad: 'Ombokad', avbokad: 'Avbokad' };

function tidKort(b) {
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
    <p>${esc(b.rubrik ?? b.tidstypText)} hos ${esc(b.yrkesroll)} ${esc(b.vardgivare ?? '')}, ${esc(b.mottagning)}</p>
    ${b.status === 'incheckad' ? `<p class="ruta ruta-info liten">Du är incheckad${b.konummer ? `. Vi ropar upp dig med nummer <strong>${esc(b.konummer)}</strong>` : ''}.${b.betalning ? ` ${esc(b.betalning.sattText)}${b.betalning.belopp ? ` ${esc(kr(b.betalning.belopp))}` : ''}.` : ''}</p>` : ''}
    ${b.avgift && b.status !== 'incheckad' ? `<p class="dampad liten">Avgift ${esc(kr(b.avgift.belopp))}. Avgifterna i demon är påhittade.</p>` : ''}
    ${b.varforInte ? `<p class="dampad liten">${esc(b.varforInte)}</p>` : ''}
    ${knappar.length ? `<div class="knapprad">${knappar.join('')}</div>` : ''}
    ${kallelse ? `<details class="tider-kallelse"><summary>Kallelsen du fick (${esc(kallelse.kanal)})</summary><p class="kallelse-text">${esc(kallelse.text)}</p>${kallelse.forklaring ? `<p class="hjalp">${esc(kallelse.forklaring)}</p>` : ''}</details>` : ''}
  </li>`;
}

export async function visa(el, ctx) {
  const t = await api(del(ctx.pid, '/tider'));
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Tider</h2></div>
    ${t.kanal.forklaring ? `<p class="ruta ruta-info liten">${esc(t.kanal.forklaring)}</p>` : ''}
    ${t.kommande.length ? `<ul class="min-tider">${t.kommande.map(tidKort).join('')}</ul>` : '<p class="tom">Du har inga bokade tider.</p>'}
    ${t.boka.length ? `<section class="ov-sektion" aria-labelledby="min-boka"><div class="sektion-huvud"><h3 id="min-boka">Boka en ny tid</h3></div>
      <ul class="enkel-lista">${t.boka.map(v => `<li><strong>${esc(v.tidstypText)} hos ${esc(v.yrkesrollText)}</strong>, ${esc(v.vardenhet.namn)}
        <span class="knapprad tat"><button type="button" class="knapp sekundar liten" data-min="boka" data-nyckel="${esc(v.nyckel)}">Visa lediga tider</button></span></li>`).join('')}</ul>
      <p class="hjalp">Du kan boka de tider som mottagningarna där du redan får vård öppnar för det.</p></section>` : ''}
    ${t.tidigare.length ? `<section class="ov-sektion" aria-labelledby="min-tidigare"><div class="sektion-huvud"><h3 id="min-tidigare">Tidigare och ändrade tider</h3></div>
      <ul class="enkel-lista">${t.tidigare.map(b => `<li>${esc(tidText(b.start))}, ${esc(b.tidstypText)}, ${esc(b.mottagning)} <span class="tagg">${esc(STATUS[b.status] ?? b.status)}</span></li>`).join('')}</ul></section>` : ''}
    <p class="hjalp">${esc(t.demoregler)}</p>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-min]');
    if (!b) return;
    try { if (await atgard(b, t, ctx)) await ctx.ladda(); } catch (err) { felNotis(err); }
  });
}

async function atgard(b, t, ctx) {
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
  } else if (a === 'boka') {
    const f = await api(del(ctx.pid, `/boka/forslag?nyckel=${encodeURIComponent(b.dataset.nyckel)}`));
    const tidId = await valjTid({ rubrik: `Boka ${f.val.tidstypText.toLowerCase()}`, text: `${esc(f.val.tidstypText)} hos ${esc(f.val.yrkesrollText)}, ${esc(f.val.vardenhet.namn)}.`, forslag: f.forslag });
    if (!tidId) return false;
    const r = await post('/boka', { nyckel: b.dataset.nyckel, tidId });
    notis(`Din tid är bokad: ${tidText(r.start)}. Kallelsen finns här i Min journal.`);
  }
  return true;
}
