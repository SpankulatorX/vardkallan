// Patientens tider i översikten: kommande bokningar med kallelserna, och för vårdadministratören Boka om, Avboka och
// Boka tid för det patienten väntar på. Andra vårdenheters tider visas efter aktivt val, som vårdkontakterna.
import { esc, api, felNotis, notis, dialog } from '../ui.js';
import { far } from '../app.js';
import { tidText, kr, kallelseHtml, dagar } from '../tidbok-ui.js';
import { ombokaBokning, avbokaBokning } from './tidbok.js';
import { bokaPost } from './idag.js';
// Runda 6, r4: egna bevakningar för patienten.
import { nyBevakning } from '../planering-ui.js';

// Tiderna hämtas för sig. I läsläget vid avbrott finns de inte i läskopian, och då visas en förklaring.
export async function hamta(id) {
  try { return await api(`/api/patient/${encodeURIComponent(id)}/bokningar`); } catch (e) { if (e?.status === 401) throw e; return null; }
}

export function sektionHtml(t) {
  if (!t) return '<section class="ov-sektion" aria-labelledby="ov-tider"><div class="sektion-huvud"><h2 id="ov-tider">Bokade tider</h2></div><p class="tom liten">Tiderna kan inte visas just nu.</p></section>';
  const rad = (b) => `<li data-bokning="${b.id}"><strong>${esc(tidText(b.tid.start))}</strong> <span class="tagg${b.status === 'incheckad' ? ' tagg-pagaende' : ''}">${esc(b.statusText)}</span>
    <span class="under-text">${esc(b.tid.rubrik ?? b.tid.tidstypText)} hos ${esc(b.tid.vardgivare?.namn ?? '')}, ${esc(b.tid.mottagning?.namn ?? '')}${b.konummer ? `. Nummer ${esc(b.konummer)}` : ''}${b.betalning ? `. ${esc(b.betalning.sattText)}${b.betalning.belopp ? ` ${esc(kr(b.betalning.belopp))}` : ''}` : b.avgift ? `. Avgift ${esc(kr(b.avgift.belopp))}` : ''}</span>
    ${b.styrLakemedel ? `<span class="under-text">${esc(b.styrLakemedel)}</span>` : ''}
    ${b.kallelser.length ? `<details class="tider-kallelse"><summary>Kallelser (${b.kallelser.length})</summary>${b.kallelser.map(kallelseHtml).join('')}</details>` : ''}
    ${b.kanOmbokas ? `<span class="knapprad tat" data-skriv><button type="button" class="knapp text liten" data-tider="omboka" data-id="${b.id}">Boka om</button><button type="button" class="knapp text liten" data-tider="avboka" data-id="${b.id}">Avboka</button></span>` : ''}</li>`;
  const vantar = t.vantelista.map(p => `<li><strong>Väntar på tid:</strong> ${esc(p.orsak)}<span class="under-text">${esc(p.tidstypText)} hos ${esc(p.yrkesrollText)}, ${esc(dagar(p.vantatDagar))}${p.grans ? `, ${esc(dagar(p.grans.dagarKvar))} kvar till gränsen` : ''}</span>${p.styrLakemedel ? `<span class="under-text">${esc(p.styrLakemedel)}</span>` : ''}
    ${far('boka') ? `<span class="knapprad tat" data-skriv><button type="button" class="knapp liten" data-tider="boka" data-id="${p.id}">Boka tid</button></span>` : ''}</li>`).join('');
  return `<section class="ov-sektion ov-tider" aria-labelledby="ov-tider"><div class="sektion-huvud"><h2 id="ov-tider">Bokade tider</h2>${far('bevaka') ? '<button type="button" class="knapp text liten" data-tider="bevakning" data-skriv>Lägg bevakning</button>' : ''}${far('las_tidbok') ? '<a class="sektion-lank" href="#/tidbok">Tidbok</a>' : ''}</div>
    ${t.kommande.length || vantar ? `<ul class="enkel-lista">${t.kommande.map(rad).join('')}${vantar}</ul>` : '<p class="tom liten">Inga bokade tider.</p>'}
    ${t.dolda?.kraverVal ? `<p class="dampad liten">${t.dolda.kraverVal} ${t.dolda.kraverVal === 1 ? 'tid' : 'tider'} på andra vårdenheter visas efter ett aktivt val.</p>` : ''}</section>`;
}

export function koppla(el, t, ctx, ladda) {
  if (!t) return;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tider]');
    if (!b) return;
    const namn = ctx.patient?.namn ?? 'patienten';
    try {
      let klart = null;
      if (b.dataset.tider === 'omboka') klart = await ombokaBokning(b.dataset.id, namn);
      else if (b.dataset.tider === 'avboka') klart = await avbokaBokning(b.dataset.id, namn, t.kommande.find(x => String(x.id) === b.dataset.id)?.styrLakemedel);
      else if (b.dataset.tider === 'boka') klart = await bokaPost(b.dataset.id, namn);
      else if (b.dataset.tider === 'bevakning') klart = await nyBevakning(ctx.id, namn);
      if (klart) await ladda();
    } catch (err) { felNotis(err); }
  });
}

// Runda 5, r1: läkaren sätter upp ett återbesök (Sussa 3.4.1.1). Systemet föreslår tidstyp, yrkesroll och tidsram ur
// anteckningens planering, diagnosen och den senaste kontakten, och säger varför. Läkaren bekräftar med ett klick och
// ändrar bara det som inte passar. Posten hamnar på väntelistan och i vårdadministratörens Dagens arbete.
export async function satUppAterbesok(pid, namn, anteckningId = null) {
  const vag = `/api/patient/${encodeURIComponent(pid)}/aterbesok`;
  const f = await api(`${vag}/forslag${anteckningId ? `?anteckningId=${encodeURIComponent(anteckningId)}` : ''}`);
  if (!f.kan) { notis(f.varforInte, 'info'); return null; }
  const val = { tidstyp: f.forslag.tidstyp, yrkesroll: f.forslag.yrkesroll, inomDagar: f.forslag.inomDagar };
  const grupp = (namnet, rubrik, lista, nyckel, text) => `<div class="falt"><span class="etikett" id="ab-${namnet}">${esc(rubrik)}</span>
    <div class="knappval-lista" role="group" aria-labelledby="ab-${namnet}" data-grupp="${namnet}">${lista.map(x => `<button type="button" class="knapp sekundar liten" data-val="${esc(x[nyckel])}" aria-pressed="${String(x[nyckel]) === String(val[namnet])}">${esc(x[text])}</button>`).join('')}</div></div>`;
  const svar = await dialog(`<h2 id="dlg-rubrik">Återbesök för ${esc(namn)}</h2>
    <div class="dialog-text"><p>Systemet föreslår <strong>${esc(f.forslag.tidstypText.toLowerCase())} hos ${esc(f.forslag.yrkesrollText)} inom ${esc(f.forslag.inomText)}</strong>${f.forslag.onskad ? `, helst hos ${esc(f.forslag.onskad.namn)}` : ''}, på ${esc(f.vardenhet.namn)}.</p>
    <ul class="liten ab-varfor">${f.varfor.map(v => `<li>${esc(v)}</li>`).join('')}</ul>
    ${f.redan.length ? `<p class="ruta ruta-info liten">Patienten väntar redan på ${f.redan.map(r => `${esc((r.tidstypText ?? '').toLowerCase())} hos ${esc(r.yrkesrollText)} (${esc(r.orsak)})`).join(' och ')}. Ett nytt återbesök läggs till.</p>` : ''}</div>
    ${grupp('tidstyp', 'Typ', f.alternativ.tidstyper, 'id', 'text')}
    ${grupp('yrkesroll', 'Hos', f.alternativ.yrkesroller, 'id', 'text')}
    ${grupp('inomDagar', 'Inom', f.alternativ.tidsramar, 'dagar', 'text')}
    <p class="demoregel">${esc(f.anmarkning)}</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok" autofocus>Sätt upp återbesök</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => dl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grupp] button[data-val]');
      if (!b) return;
      const g = b.closest('[data-grupp]');
      for (const x of g.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      val[g.dataset.grupp] = g.dataset.grupp === 'inomDagar' ? Number(b.dataset.val) : b.dataset.val;
    }),
  });
  if (svar?.val !== 'ok') return null;
  const r = await api(vag, { metod: 'POST', data: { ...val, ...(anteckningId ? { anteckningId: Number(anteckningId) } : {}) } });
  notis(`Återbesöket står på väntelistan: ${r.tidstypText.toLowerCase()} hos ${r.yrkesrollText} senast ${r.mal}. Vårdadministratören bokar tiden.`);
  return r;
}
