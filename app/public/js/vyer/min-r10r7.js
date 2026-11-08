// Runda 10, r7: Min journal. Meddelanden till vården, vårdplanen med kommentarer, ombud med fullmakt, avgifter för
// tjänster och möteslänkar för videobesök. Servern prövar varje anrop och loggar det på patienten.
import { esc, api, notis, felNotis, medKnapp, ikon, tidpunkt, datum } from '../ui.js';
import { S, rita } from '../app.js';

const vag = (pid, v = '') => `/api/min/journal/${encodeURIComponent(pid)}${v}`;
const kr = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;

// --- Valet av journal: patienterna som invånaren är ombud för ------------------------------------------------------
export const ombudLista = (lista, href) => (lista.length ? `<h2 class="min-ombud-rubrik">Du är ombud för</h2><ul class="min-journaler">${lista.map(o =>
  `<li><a class="min-journalval" href="${href(o.patientId)}" data-ombud="${esc(o.patientId)}">${ikon.person}<span><strong>${esc(o.namn)}</strong><span class="under-text">${esc(o.alder)} år. Fullmakten gäller ${esc(o.omfattning.map(x => ({ tider: 'tider', meddelanden: 'meddelanden' })[x]).join(' och '))} till och med ${esc(o.giltigTill)}.</span></span></a></li>`).join('')}</ul>` : '');

// Förfrågningar om att bli ombud. Fullmakten gäller först när den som ska vara ombud har godkänt den.
export const forfragningarHtml = (lista) => (lista.length ? `<section class="ov-sektion" aria-labelledby="min-forfragan"><h2 id="min-forfragan" class="min-ombud-rubrik">Förfrågningar om att bli ombud</h2>
  <ul class="enkel-lista">${lista.map(f => `<li data-forfragan="${f.id}"><p><strong>${esc(f.patient.namn)}</strong> vill ge dig fullmakt: ${esc(f.omfattning.map(o => o.text.toLowerCase()).join(' och '))}, till och med ${esc(f.giltigTill)}.</p>
    <div class="knapprad"><button type="button" class="knapp" data-forfragan-svar="godkann" data-id="${f.id}">Godkänn</button><button type="button" class="knapp sekundar" data-forfragan-svar="avboj" data-id="${f.id}">Avböj</button></div></li>`).join('')}</ul>
  <p class="hjalp">Som ombud ser du tiderna och meddelandena, aldrig journalen. Det du gör loggas och syns för patienten.</p></section>` : '');
let kopplad = null;
export function kopplaForfragningar(main) {
  if (kopplad === main) return;
  kopplad = main;
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-forfragan-svar]');
    if (!b) return;
    try {
      const r = await medKnapp(b, () => api(`/api/min/fullmakt/${encodeURIComponent(b.dataset.id)}/${b.dataset.forfraganSvar}`, { metod: 'POST', data: {} }));
      notis(r.text);
      S.session = await api('/api/session');
      rita();
    } catch (err) { felNotis(err); }
  });
}

// --- Meddelanden ------------------------------------------------------------------------------------------------------
const tradHtml = (t) => `<li class="min-trad" data-trad="${t.id}">
  <details${t.status !== 'avslutad' ? ' open' : ''}><summary><strong>${esc(t.typText)}</strong>${t.galler ? `: ${esc(t.galler)}` : ''} <span class="tagg${t.status === 'avslutad' ? '' : ' tagg-pagaende'}">${esc(t.statusText)}</span>
    <span class="under-text">${esc(t.vardenhet ?? '')}, ${esc(tidpunkt(t.skapad))}</span></summary>
    <ol class="meddelanden">${t.meddelanden.map(m => `<li class="meddelande meddelande-${esc(m.fran)}"><p class="under-text">${esc(m.vem ?? (m.fran === 'invanare' ? 'Du' : 'Vården'))}, ${esc(tidpunkt(m.tid))}</p><p class="kallelse-text">${esc(m.text)}</p></li>`).join('')}</ol>
    ${t.avgift ? `<p class="hjalp">Avgift: ${esc(kr(t.avgift.belopp))}. ${esc(t.avgift.text)}</p>` : ''}
    ${t.kanSvara ? `<form class="min-svar" novalidate><div class="falt"><label for="svar-${t.id}">Ditt svar</label><textarea id="svar-${t.id}" name="text" rows="2" maxlength="2000"></textarea></div><p class="form-fel" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp sekundar liten">Skicka svar</button></div></form>` : ''}
  </details></li>`;

function nyttHtml(d) {
  const opt = (lista, val = null) => lista.map(x => `<option value="${esc(x.id)}"${x.id === val ? ' selected' : ''}>${esc(x.text ?? x.namn)}${x.vardenhet ? `, ${esc(x.vardenhet)}` : ''}</option>`).join('');
  return `<form class="ov-sektion min-nytt" id="min-nytt" novalidate aria-labelledby="min-nytt-rubrik">
    <div class="sektion-huvud"><h3 id="min-nytt-rubrik">Nytt meddelande</h3></div>
    <div class="falt-rad">
      <div class="falt"><label for="mn-typ">Det gäller</label><select id="mn-typ" name="typ">${opt(d.typer, 'fraga')}</select></div>
      <div class="falt" data-mn="enhet"><label for="mn-enhet">Till</label><select id="mn-enhet" name="enhetId">${opt(d.mottagare)}</select></div>
      <div class="falt" data-mn="recept" hidden><label for="mn-lm">Läkemedel</label><select id="mn-lm" name="ordinationId">${opt(d.lakemedel)}</select></div>
      <div class="falt" data-mn="intyg" hidden><label for="mn-intyg">Intyg</label><select id="mn-intyg" name="intygstyp">${opt(d.intygstyper)}</select></div>
      <div class="falt" data-mn="vardplan" hidden><label for="mn-plan">Vårdplan</label><select id="mn-plan" name="planId">${opt(d.planer)}</select></div>
    </div>
    <div class="falt"><label for="mn-text">Meddelande</label><textarea id="mn-text" name="text" rows="4" maxlength="2000"></textarea></div>
    <p class="form-fel" hidden></p><div data-mn-akut></div>
    <div class="knapprad"><button type="submit" class="knapp">Skicka</button></div>
    <p class="hjalp">Systemet skickar meddelandet till rätt vårdenhet och yrkesroll: ett recept till den som ordinerade läkemedlet och en kommentar till vårdplanen till den vårdenhet som har planen. ${esc(d.demoregler)}</p>
  </form>`;
}

export async function meddelanden(el, ctx) {
  const d = await api(vag(ctx.pid, '/meddelanden'));
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Meddelanden</h2></div>
    ${d.kanSkriva ? nyttHtml(d) : '<p class="ruta ruta-info">Du har fem meddelanden som vården inte har avslutat. Vänta på svar innan du skriver ett nytt.</p>'}
    ${d.tradar.length ? `<ul class="min-tradar">${d.tradar.map(tradHtml).join('')}</ul>` : '<p class="tom">Du har inga meddelanden.</p>'}`;
  const form = el.querySelector('#min-nytt');
  const visaDelar = () => {
    if (!form) return;
    const typ = form.typ.value;
    for (const x of form.querySelectorAll('[data-mn]')) x.hidden = x.dataset.mn === 'enhet' ? ['recept', 'vardplan'].includes(typ) : x.dataset.mn !== typ;
  };
  visaDelar();
  form?.typ.addEventListener('change', visaDelar);
  const skicka = async (akutLast = false) => {
    const typ = form.typ.value;
    const data = { typ, text: form.text.value, akutLast };
    if (typ === 'recept') data.ordinationId = Number(form.ordinationId.value);
    else if (typ === 'vardplan') data.planId = Number(form.planId.value);
    else { data.enhetId = form.enhetId.value || undefined; if (typ === 'intyg') data.intygstyp = form.intygstyp.value; }
    const r = await medKnapp(form.querySelector('[type=submit]'), () => api(vag(ctx.pid, '/meddelanden'), { metod: 'POST', data }), form);
    if (!r.skickat) {
      form.querySelector('[data-mn-akut]').innerHTML = `<div class="ruta ruta-larm" role="alert"><p>${esc(r.akut)}</p><div class="knapprad"><button type="button" class="knapp sekundar liten" data-mn-skicka-anda>Jag har läst. Skicka ändå</button></div></div>`;
      return;
    }
    notis(r.text);
    await ctx.ladda();
  };
  form?.addEventListener('submit', async (e) => { e.preventDefault(); try { await skicka(); } catch (err) { if (err?.status !== 400) felNotis(err); } });
  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-mn-skicka-anda]')) { try { await skicka(true); } catch (err) { if (err?.status !== 400) felNotis(err); } }
  });
  el.addEventListener('submit', async (e) => {
    const f = e.target.closest('.min-svar');
    if (!f) return;
    e.preventDefault();
    const id = f.closest('[data-trad]').dataset.trad;
    try {
      await medKnapp(f.querySelector('[type=submit]'), () => api(vag(ctx.pid, `/meddelanden/${id}/svar`), { metod: 'POST', data: { text: f.text.value } }), f);
      notis('Ditt svar är skickat.');
      await ctx.ladda();
    } catch (err) { if (err?.status !== 400) felNotis(err); }
  });
}

// --- Vårdplanen -------------------------------------------------------------------------------------------------------
const planHtml = (p) => `<section class="ov-sektion min-plan" aria-labelledby="plan-${p.id}" data-plan="${p.id}">
  <div class="sektion-huvud"><h3 id="plan-${p.id}">${esc(p.rubrik)}</h3><span class="tagg${p.status === 'aktiv' ? ' tagg-pagaende' : ''}">${esc(p.statusText)}</span></div>
  <p class="under-text">${esc(p.vardenhet ?? '')}${p.nastaUppfoljning ? `. Nästa uppföljning ${esc(datum(p.nastaUppfoljning))}` : ''}.</p>
  <h4>Mål</h4><ul class="enkel-lista">${p.mal.map(m => `<li>${esc(m.text)} <span class="tagg">${esc(m.statusText)}</span></li>`).join('')}</ul>
  <h4>Det här gör vården</h4><ul class="enkel-lista">${p.atgarder.map(a => `<li>${esc(a.text)}${a.vem ? ` <span class="under-text">${esc(a.vem)}${a.dagligen ? ', varje dag' : ''}</span>` : ''}</li>`).join('')}</ul>
  ${p.uppfoljningar.length ? `<h4>Uppföljningar</h4><ul class="enkel-lista">${p.uppfoljningar.map(u => `<li>${esc(tidpunkt(u.tid))}: ${esc(u.text ?? 'Uppföljning')}</li>`).join('')}</ul>` : ''}
  ${p.kommentarer.antal ? `<p class="hjalp">Du har kommenterat planen ${p.kommentarer.antal} ${p.kommentarer.antal === 1 ? 'gång' : 'gånger'}. Svaren finns under Meddelanden.</p>` : ''}
  ${p.kanKommentera ? `<form class="min-kommentar" novalidate><div class="falt"><label for="kom-${p.id}">Din kommentar till planen</label><textarea id="kom-${p.id}" name="text" rows="2" maxlength="2000"></textarea></div><p class="form-fel" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp sekundar liten">Skicka kommentaren</button></div></form>` : ''}
</section>`;

export async function vardplan(el, ctx) {
  const d = await api(vag(ctx.pid, '/vardplaner'));
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Vårdplan</h2></div>
    ${d.planer.length ? d.planer.map(planHtml).join('') : '<p class="tom">Det finns ingen vårdplan.</p>'}
    <p class="hjalp">Kommentaren går till den vårdenhet som har planen och läses i vårdens vanliga arbete. Vid akuta besvär, ring 112.</p>`;
  el.addEventListener('submit', async (e) => {
    const f = e.target.closest('.min-kommentar');
    if (!f) return;
    e.preventDefault();
    const planId = Number(f.closest('[data-plan]').dataset.plan);
    try {
      const r = await medKnapp(f.querySelector('[type=submit]'), () => api(vag(ctx.pid, '/meddelanden'), { metod: 'POST', data: { typ: 'vardplan', planId, text: f.text.value, akutLast: true } }), f);
      notis(r.text);
      await ctx.ladda();
    } catch (err) { if (err?.status !== 400) felNotis(err); }
  });
}

// --- Ombud -----------------------------------------------------------------------------------------------------------
const fullmaktHtml = (f, kan) => `<li class="min-tid"><p><strong>${esc(f.ombud?.namn ?? f.patient?.namn ?? f.ombud?.personnummer ?? '')}</strong>${f.ombud?.namn ? ` <span class="under-text">${esc(f.ombud.personnummer)}</span>` : ''}
  <span class="tagg${f.aktiv ? ' tagg-pagaende' : ''}">${esc(f.statusText ?? '')}</span></p>
  <p>${esc(f.omfattning.map(x => x.text).join('. '))}. Till och med ${esc(f.giltigTill)}. ${esc(f.kallaText)}.</p>
  ${(f.aktiv || f.vantar) && kan ? `<div class="knapprad"><button type="button" class="knapp text liten" data-om-aterkalla="${f.id}">${f.ombud ? 'Återkalla fullmakten' : 'Avsäg dig fullmakten'}</button></div>` : ''}</li>`;

export async function ombud(el, ctx) {
  const d = await api(vag(ctx.pid, '/ombud'));
  if (!ctx.aktuell()) return;
  if (d.relation === 'ombud') {
    el.innerHTML = `<div class="flikhuvud"><h2>Din fullmakt</h2></div><ul class="min-tider">${fullmaktHtml(d.egen, true)}</ul>
      <p class="hjalp">Som ombud ser du tider och meddelanden, aldrig journalen. Det du gör loggas och syns för patienten. ${esc(d.demoregler)}</p>`;
  } else {
    el.innerHTML = `<div class="flikhuvud"><h2>Ombud</h2></div>
      <p>Ett ombud kan boka, boka om och avboka dina tider och skriva till vården för din räkning. Ombudet loggar in med sin egen e-legitimation och kan aldrig läsa din journal.</p>
      ${d.fullmakter.length ? `<ul class="min-tider">${d.fullmakter.map(f => fullmaktHtml(f, d.kanGe)).join('')}</ul>` : '<p class="tom">Du har inga ombud.</p>'}
      ${d.kanGe ? `<form class="ov-sektion" id="om-ny" novalidate aria-labelledby="om-ny-rubrik"><div class="sektion-huvud"><h3 id="om-ny-rubrik">Ge en fullmakt</h3></div>
        <div class="falt"><label for="om-pnr">Ombudets personnummer</label><input id="om-pnr" name="personnummer" inputmode="numeric" autocomplete="off" maxlength="13"></div>
        <fieldset class="radiogrupp"><legend>Fullmakten gäller</legend>${d.omfattning.map(o => `<div class="radio"><input type="checkbox" id="om-${o.id}" name="omfattning" value="${o.id}" checked><label for="om-${o.id}">${esc(o.text)}</label></div>`).join('')}</fieldset>
        <p class="form-fel" hidden></p><div class="knapprad"><button type="submit" class="knapp">Ge fullmakt</button></div></form>` : `<p class="ruta ruta-info">${esc(d.varforInte ?? '')}</p>`}
      <p class="hjalp">${esc(d.demoregler)}</p>`;
  }
  el.querySelector('#om-ny')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const omfattning = [...f.querySelectorAll('[name=omfattning]:checked')].map(x => x.value);
    try {
      const r = await medKnapp(f.querySelector('[type=submit]'), () => api(vag(ctx.pid, '/ombud'), { metod: 'POST', data: { personnummer: f.personnummer.value, omfattning } }), f);
      notis(r.text);
      await ctx.ladda();
    } catch (err) { if (err?.status !== 400) felNotis(err); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-om-aterkalla]');
    if (!b) return;
    try {
      await medKnapp(b, () => api(vag(ctx.pid, `/ombud/${b.dataset.omAterkalla}/aterkalla`), { metod: 'POST', data: {} }));
      notis('Fullmakten är återkallad.');
      if (d.relation === 'ombud') location.hash = '#/min'; else await ctx.ladda();
    } catch (err) { felNotis(err); }
  });
}

// --- Under Tider: avgifter för tjänster och möteslänkar ------------------------------------------------------------
export async function tiderTillagg(pid) {
  const [a, v] = await Promise.all([api(vag(pid, '/avgifter')).catch(() => null), api(vag(pid, '/videomoten')).catch(() => null)]);
  const avgifter = a?.avgifter ?? [];
  return {
    html: `${v?.moten?.length ? `<section class="ov-sektion" aria-labelledby="min-video"><div class="sektion-huvud"><h3 id="min-video">Videobesök</h3></div><ul class="enkel-lista">${v.moten.map(m => `<li><a href="${esc(m.lank)}">Öppna videomötet</a> <span class="under-text">Simulerat möte</span></li>`).join('')}</ul></section>` : ''}
      ${avgifter.length ? `<section class="ov-sektion" aria-labelledby="min-avgifter"><div class="sektion-huvud"><h3 id="min-avgifter">Avgifter för recept och intyg</h3></div>
      <ul class="enkel-lista">${avgifter.map(x => `<li><strong>${esc(x.tjanstText)}</strong>, ${esc(x.vardenhet ?? '')}: ${esc(kr(x.belopp))} <span class="tagg">${esc(x.statusText)}</span>
        ${x.betalning ? `<span class="under-text">Kvitto ${esc(x.betalning.kvitto)}</span>` : ''}${x.status === 'att_betala' ? ` <span class="knapprad tat"><button type="button" class="knapp sekundar liten" data-avgift-betala="${x.id}" data-belopp="${x.belopp}">Betala</button></span>` : ''}</li>`).join('')}</ul>
      <p class="hjalp">${esc(a.demoregler)}</p></section>` : ''}`,
    avgifter,
  };
}
