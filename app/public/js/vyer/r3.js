// Runda 6, r3: vårdplaner, psykiatrisk tvångsvård, samordnad planering (SIP och SPU) och ändringar i hälsoärenden.
// Fliken Planer, fliken Tvångsvård, delar av översikten och inkorgen, bevakningen av tvångsvården, uppföljningen och
// kommunens vy. Servern räknar alla frister och föreslår nästa steg. Gränssnittet visar dem och skickar det användaren
// bekräftar, och fälten i ett steg kommer från servern.
// Runda 10, r5: vårdförloppet med kunskapsstöd och vårdenhetens utfall (Sussa 3.2.1).
import * as kunskap from '../kunskapsstod-ui.js';
import { esc, api, datum, tidpunkt, ikon, vyRubrik, dialog, notis, felNotis, falt, tom } from '../ui.js';
import { far, pa, S } from '../app.js';

const STATUSKLASS = { passerad: 'tagg-larm', snart: 'tagg-obs', kommande: '', uppfylld: 'tagg-ok' };
const fristRad = (f) => `<li class="r3-frist r3-${esc(f.status)}"><strong>${esc(f.rubrik)}</strong> <span class="tagg ${STATUSKLASS[f.status] ?? ''}">${esc({ passerad: 'Passerad', snart: 'Snart', kommande: 'Kommande', uppfylld: 'Klar' }[f.status])}</span>
  <span class="under-text">${f.status === 'uppfylld' ? `Klar ${esc(tidpunkt(f.uppfylld))}` : `Senast ${esc(tidpunkt(f.senast))}`} (${esc(f.paragraf)}). ${esc(f.forklaring ?? '')}${f.konsekvens && f.status !== 'uppfylld' ? ` ${esc(f.konsekvens)}` : ''}</span></li>`;
const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');
const sektion = (id, rubrik, innehall, extra = '') => `<section class="ov-sektion" aria-labelledby="r3-${id}"><div class="sektion-huvud"><h2 id="r3-${id}">${esc(rubrik)}</h2>${extra}</div>${innehall}</section>`;

// En dialog byggd av serverns fält: kryss, text, val och datum. Kontrollerna visas först.
async function stegDialog(steg, rubrik = steg.rubrik) {
  const f = (x) => {
    if (x.typ === 'kryss') return `<div class="kryssfalt"><input type="checkbox" id="r3-${esc(x.namn)}" name="${esc(x.namn)}"${x.obligatorisk ? ' required' : ''}><label for="r3-${esc(x.namn)}">${esc(x.etikett)}</label></div>`;
    if (x.typ === 'val') return falt({ namn: x.namn, etikett: x.etikett, varde: x.varde, alternativ: x.alternativ });
    if (x.typ === 'datum') return falt({ namn: x.namn, etikett: x.etikett, typ: 'date', varde: x.varde ?? '', obligatorisk: x.obligatorisk });
    return falt({ namn: x.namn, etikett: x.etikett, typ: 'textarea', obligatorisk: x.obligatorisk });
  };
  const kontroller = (steg.kontroller ?? []).map(k => `<li class="${k.ok ? 'r3-ok' : 'r3-fel'}">${k.ok ? ikon.bock : ikon.varning}<span>${esc(k.text)}</span></li>`).join('');
  const svar = await dialog(`<h2 id="dlg-rubrik">${esc(rubrik)}</h2>
    <div class="dialog-text">${steg.forklaring ? `<p>${esc(steg.forklaring)}</p>` : ''}${kontroller ? `<ul class="r3-kontroller">${kontroller}</ul>` : ''}${steg.paragraf ? `<p class="dampad liten">Lagrum: ${esc(steg.paragraf)}</p>` : ''}</div>
    <form>${(steg.falt ?? []).map(f).join('')}</form><p class="dialog-fel" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok"${steg.kan === false ? ' disabled' : ''}>${esc(steg.knapp)}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, { klass: 'dialog-bred' });
  if (svar?.val !== 'ok') return null;
  const data = { ...svar.data };
  for (const x of steg.falt ?? []) if (x.typ === 'kryss') data[x.namn] = data[x.namn] === 'on';
  return data;
}

// ---------- Översikten ----------
export function oversiktHtml(d, ctx) {
  const r = d.r3;
  if (!r) return '';
  const delar = [];
  if (r.tvangsvard) {
    const t = r.tvangsvard;
    delar.push(sektion('tv', t.statusText, `<div class="ruta r3-tvang"><p><strong>${esc(t.lag ?? 'LPT')}</strong> på ${esc(t.enhet.namn)}.${t.frist ? ` ${esc(t.frist.rubrik)} senast ${esc(tidpunkt(t.frist.senast))} (${esc(t.frist.paragraf)}).` : ''}</p>
      ${t.pagaende.length ? `<p class="tagg tagg-larm">${t.pagaende.map(a => `${esc(a.typText)} sedan ${esc(tidpunkt(a.start))}`).join(', ')}</p>` : ''}
      ${t.parallellt?.length ? `<p class="liten">Vårdas samtidigt på ${t.parallellt.map(p => esc(p.enhet.namn)).join(', ')}. Tvångsvården och fristerna fortsätter.</p>` : ''}
      ${t.steg ? `<div class="knapprad" data-skriv><button type="button" class="knapp" data-tv-steg>${esc(t.steg.knapp)}</button></div>` : ''}</div>`, `<a class="sektion-lank" href="${ctx.href('tvangsvard')}">Tvångsvården</a>`));
  }
  if (r.vardplaner && (r.vardplaner.planer.length || r.vardplaner.forslag.length)) {
    const v = r.vardplaner;
    delar.push(sektion('vp', 'Vårdplaner', `${v.planer.length ? `<ul class="enkel-lista">${v.planer.map(p => `<li><a href="${ctx.href('planer')}">${esc(p.rubrik)}</a> <span class="dampad">${esc(p.statusText)}</span>${p.avvikelser ? ` <span class="tagg tagg-larm">${p.avvikelser === 1 ? 'En avvikelse' : `${p.avvikelser} avvikelser`}</span>` : ''}<span class="under-text">Följs upp ${esc(p.uppfoljning)}, ${esc(p.enhet.namn)}</span></li>`).join('')}</ul>` : ''}
      ${v.forslag.map(f => `<div class="ruta ruta-info liten r3-forslag" data-skriv><p>Systemet föreslår <strong>${esc(f.rubrik)}</strong>. ${esc(f.varfor)}</p><button type="button" class="knapp liten" data-vp-mall="${esc(f.mall)}">Sätt upp vårdplanen</button></div>`).join('')}`,
    `<a class="sektion-lank" href="${ctx.href('planer')}">Planer</a>`));
  }
  if (r.samordning) {
    const s = r.samordning;
    delar.push(sektion('sam', 'Samordnad planering', `${s.pagar.map(x => `<p><a href="${ctx.href('planer')}">${esc(x.typText)}</a>${x.beraknad ? `, beräknad utskrivning ${esc(x.beraknad)}` : ''}${x.frist ? `. ${esc(x.frist.rubrik)} senast ${esc(datum(x.frist.senast))}` : ''}${x.uppgifter ? ` <span class="tagg tagg-obs">${x.uppgifter} att göra</span>` : ''}</p>`).join('')}
      ${s.forslag ? `<div class="ruta ruta-info liten" data-skriv><p>${esc(s.forslag.varfor.join(' '))} Skicka inskrivningsmeddelandet senast ${esc(tidpunkt(s.forslag.senast))} om patienten kan behöva insatser efter utskrivningen.</p><a class="knapp liten sekundar" href="${ctx.href('planer')}">Samordnad planering</a></div>` : ''}`));
  }
  return delar.join('');
}
export function kopplaOversikt(el, d, ctx) {
  el.querySelector('[data-tv-steg]')?.addEventListener('click', async () => {
    try {
      const t = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tvangsvard`);
      const p = t.perioder.find(x => x.id === d.r3.tvangsvard.id);
      const steg = p?.nasta.find(x => x.primar);
      if (steg && await utforSteg(ctx, p, steg)) ctx.ladda();
    } catch (e) { felNotis(e); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-vp-mall]');
    if (!b) return;
    try { if (await satUppMall(ctx, b.dataset.vpMall)) ctx.ladda(); } catch (x) { felNotis(x); }
  });
}

// Sätter upp en standardplan: dialogen visar mål, åtgärder, ansvarig och uppföljning ur mallen.
async function satUppMall(ctx, mall) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardplaner`);
  const f = d.forslag.find(x => x.mall === mall);
  if (!f) return false;
  const svar = await dialog(`<h2 id="dlg-rubrik">Vårdplan: ${esc(f.rubrik)}</h2>
    <div class="dialog-text"><p>${esc(f.varfor)}</p>
    <h3>Mål</h3><ul class="enkel-lista">${f.mal.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
    <h3>Åtgärder</h3><ul class="enkel-lista">${f.atgarder.map(a => `<li>${esc(a.text)} <span class="dampad">${esc(a.ansvarigText)}${a.dagligen ? ', dagligen' : ''}</span></li>`).join('')}</ul>
    <p>Uppföljning ${esc(f.uppfoljning)}. Planen kan anpassas efter patienten när den är upprättad.</p>
    ${kunskap.vardforloppHtml(f.vardforlopp)}${kunskap.utfallHtml(f.utfall)}<p class="demoregel">${esc(d.demoregler)}</p></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok" autofocus>Upprätta vårdplanen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, { klass: 'dialog-bred' });
  if (svar?.val !== 'ok') return false;
  const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardplaner`, { metod: 'POST', data: { mall } });
  notis(`Vårdplanen ${r.rubrik} är upprättad. Den följs upp ${r.uppfoljning}.`);
  return true;
}

// Utför ett steg i tvångsvården som servern har föreslagit.
async function utforSteg(ctx, period, steg, extra = {}) {
  const data = (steg.falt?.length || steg.kontroller?.length) ? await stegDialog(steg) : {};
  if (data == null) return false;
  let typ = steg.typ;
  if (typ === 'beslut_ratten') typ = 'beslut_ratten';
  const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tvangsvard`, { metod: 'POST', data: { typ, period: period?.id, ...extra, ...data } });
  const nasta = r.frister?.find(f => f.status !== 'uppfylld');
  notis(typ === 'intagning' || typ === 'overgang11'
    ? `Beslutet om intagning är registrerat.${nasta ? ` ${nasta.rubrik} senast ${tidpunkt(nasta.senast)} (${nasta.paragraf}).` : ''}`
    : r.text ?? `${steg.knapp}: registrerat.`);
  return true;
}

// ---------- Fliken Tvångsvård ----------
export const tvangsvardFlik = {
  async visa(el, ctx) {
    const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tvangsvard`);
    if (!ctx.aktuell()) return;
    const ny = [d.vardintyg, d.lrv].filter(Boolean);
    el.innerHTML = `<h2 class="sr">Tvångsvård</h2>
      ${ny.length ? `<div class="knapprad" data-skriv>${ny.map((s, i) => `<button type="button" class="knapp${i ? ' sekundar' : ''}" data-tv-ny="${i}">${esc(s.knapp)}</button>`).join('')}</div>` : ''}
      ${d.perioder.length ? d.perioder.map(p => periodHtml(p)).join('') : tom('Det finns ingen tvångsvård som du kan se.')}`;
    el.addEventListener('click', async (e) => {
      try {
        const nyKnapp = e.target.closest('[data-tv-ny]');
        if (nyKnapp) { const s = ny[Number(nyKnapp.dataset.tvNy)]; const data = await stegDialog(s); if (data == null) return; const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/tvangsvard`, { metod: 'POST', data: { typ: s === d.lrv ? 'lrv' : 'vardintyg', ...data } }); notis(r.text); return ctx.ladda(); }
        const b = e.target.closest('[data-tv]');
        if (!b) return;
        const p = d.perioder.find(x => x.id === Number(b.dataset.period));
        const [vad, varde] = b.dataset.tv.split(':');
        if (vad === 'steg') { if (await utforSteg(ctx, p, p.nasta[Number(varde)])) ctx.ladda(); return; }
        if (vad === 'forlang' || vad === 'slut') {
          const steg = { typ: vad === 'forlang' ? 'forlangning' : 'atgard_slut', knapp: vad === 'forlang' ? 'Förläng med ett nytt beslut' : 'Avsluta åtgärden', falt: vad === 'forlang' ? [{ namn: 'synnerliga', typ: 'kryss', etikett: 'Av synnerliga skäl' }] : [] };
          if (await utforSteg(ctx, p, steg, { avser: Number(varde) })) ctx.ladda();
          return;
        }
        if (vad === 'uppgift') { const u = p.uppgifter.find(x => x.id === b.dataset.uppgift); if (await utforSteg(ctx, p, { typ: u.typ, knapp: 'Markera som gjort' }, { avser: u.avser ?? u.id })) ctx.ladda(); }
      } catch (x) { felNotis(x); }
    });
  },
};
function periodHtml(p) {
  const egen = p.nasta.length > 0;
  const pagar = p.atgarder.filter(a => a.pagar);
  return `<article class="ruta r3-period" aria-label="${esc(p.statusText)}">
    <h3>${esc(p.statusText)}${p.lag ? ` <span class="tagg">${esc(p.lag)}</span>` : ''}</h3>
    <p class="dampad">${esc(p.enhet.namn)}${p.intagning ? `, intagen ${esc(tidpunkt(p.intagning))} (${esc(p.grund)})` : ''}${p.giltigTill ? `. Vården får pågå till ${esc(tidpunkt(p.giltigTill))} (${esc(p.giltigParagraf)})` : ''}.</p>
    ${p.slutOrsak ? `<p class="ruta ruta-info liten">${esc(p.slutOrsak)}</p>` : ''}
    ${p.iAvvaktan ? `<p class="liten">${esc(p.iAvvaktan)}</p>` : ''}
    ${p.parallellt.length ? `<p class="ruta ruta-info liten">Patienten vårdas samtidigt på ${p.parallellt.map(x => `${esc(x.enhet.namn)} (${esc(x.orsak ?? '')} sedan ${esc(datum(x.start))})`).join(', ')}. Tvångsvårdsperioden fortsätter, och fristerna räknas som vanligt.</p>` : ''}
    ${egen && p.nasta.length ? `<div class="knapprad" data-skriv>${p.nasta.map((s, i) => `<button type="button" class="knapp${s.primar ? '' : ' sekundar'} liten" data-tv="steg:${i}" data-period="${p.id}">${esc(s.knapp)}</button>`).join('')}</div>` : ''}
    ${p.frister.length ? `<h4>Frister</h4><ul class="enkel-lista">${p.frister.map(fristRad).join('')}</ul>` : ''}
    ${pagar.length ? `<h4>Pågående tvångsåtgärder</h4><ul class="enkel-lista">${pagar.map(a => `<li><strong>${esc(a.typText)}</strong> sedan ${esc(tidpunkt(a.start))}${a.giltigTill ? `, beslutet gäller till ${esc(tidpunkt(a.giltigTill))}` : ''} (${esc(a.paragraf)})<span class="under-text">${esc(a.krav)}</span>
      ${egen ? `<span class="knapprad" data-skriv><button type="button" class="knapp liten sekundar" data-tv="forlang:${a.id}" data-period="${p.id}">Förläng</button><button type="button" class="knapp liten sekundar" data-tv="slut:${a.id}" data-period="${p.id}">Avsluta</button></span>` : ''}</li>`).join('')}</ul>` : ''}
    ${p.uppgifter.length ? `<h4>Det lagen kräver</h4><ul class="enkel-lista">${p.uppgifter.map(u => `<li>${esc(u.text)} <span class="dampad">(${esc(u.paragraf)})</span>${u.nar ? `<span class="under-text">${esc(u.nar)}</span>` : ''}${egen && ['ivo', 'uppfoljningssamtal', 'stodperson', 'socialtjanst'].includes(u.typ) ? ` <button type="button" class="knapp liten sekundar" data-skriv data-tv="uppgift" data-uppgift="${esc(u.id)}" data-period="${p.id}">Markera som gjort</button>` : ''}</li>`).join('')}</ul>` : ''}
    <details><summary>Beslutsjournal (${p.beslutsjournal.length})</summary><ol class="enkel-lista">${p.beslutsjournal.map(h => `<li><strong>${esc(h.typText)}</strong> ${esc(tidpunkt(h.tid))}${h.paragraf ? ` <span class="dampad">(${esc(h.paragraf)})</span>` : ''}<span class="under-text">${esc(h.av?.namn ?? '')}, ${esc(h.av?.titel ?? '')}, registrerat på ${esc(h.registreradPa?.namn ?? '')} ${esc(tidpunkt(h.registrerad))}${h.text ? `. ${esc(h.text)}` : ''}</span></li>`).join('')}</ol></details>
  </article>`;
}

// ---------- Fliken Planer: vårdplaner, samordnad planering och hälsoärenden ----------
export const planerFlik = {
  async visa(el, ctx) {
    const pid = encodeURIComponent(ctx.id);
    const [v, s, o] = await Promise.all([
      pa('las_vardplan') ? api(`/api/patient/${pid}/vardplaner`) : null,
      pa('samordna', 'las_vardplan') ? api(`/api/patient/${pid}/samordning`) : null,
      api(`/api/patient/${pid}/oversikt`),
    ]);
    if (!ctx.aktuell()) return;
    const arenden = o.vardstruktur?.halsoarenden ?? [];
    el.innerHTML = `<h2 class="sr">Planer</h2>
      ${v ? `<section aria-labelledby="pl-vp"><div class="sektion-huvud"><h2 id="pl-vp">Vårdplaner</h2></div>
        ${v.forslag.map(f => `<div class="ruta ruta-info liten" data-skriv><p>Systemet föreslår <strong>${esc(f.rubrik)}</strong>. ${esc(f.varfor)}</p><button type="button" class="knapp liten" data-vp-mall="${esc(f.mall)}">Sätt upp vårdplanen</button></div>`).join('')}
        ${v.kan.skapa ? `<div class="knapprad" data-skriv><button type="button" class="knapp liten sekundar" data-vp-ny>Ny individuell vårdplan</button></div>` : ''}
        ${v.planer.length ? v.planer.map(planHtml).join('') : tom('Inga vårdplaner som du kan se.')}<p class="demoregel">${esc(v.demoregler)}</p></section>` : ''}
      ${s ? `<section aria-labelledby="pl-sam"><div class="sektion-huvud"><h2 id="pl-sam">Samordnad planering</h2></div>
        ${s.forslag.spu ? `<div class="ruta ruta-info liten" data-skriv><p>${esc(s.forslag.spu.varfor.join(' '))} ${esc(s.forslag.spu.forklaring)}</p><button type="button" class="knapp liten" data-sam-spu>Skicka inskrivningsmeddelande</button><p class="demoregel">${esc(s.forslag.spu.demoregel)}</p></div>` : ''}
        ${s.kan.skapa ? `<div class="knapprad" data-skriv><button type="button" class="knapp liten sekundar" data-sam-sip="sip">Ny samordnad individuell plan</button>${S.session?.r3?.tvangsvardsenhet ? '<button type="button" class="knapp liten sekundar" data-sam-sip="lpt7a">Samordnad vårdplan vid öppen tvångsvård</button>' : ''}</div>` : ''}
        ${s.samordningar.length ? s.samordningar.map(x => samordningHtml(x)).join('') : tom('Ingen samordnad planering som du kan se.')}</section>` : ''}
      ${arenden.length ? `<section aria-labelledby="pl-ha"><div class="sektion-huvud"><h2 id="pl-ha">Hälsoärenden</h2></div>
        ${(o.r3?.halsoarendeForslag ?? []).map((f, i) => `<div class="ruta ruta-info liten" data-skriv><p>${esc(f.text)}</p><button type="button" class="knapp liten" data-ha-forslag="${i}">${f.typ === 'avsluta' ? 'Avsluta ärendet' : 'Slå ihop'}</button></div>`).join('')}
        <ul class="enkel-lista">${arenden.map(h => `<li><strong>${esc(h.rubrik)}</strong> <span class="dampad">${esc(h.status === 'avslutat' ? 'Avslutat' : 'Aktivt')}, ${h.kontakter.length} vårdkontakter</span>
          ${far('halsoarende') ? `<span class="knapprad" data-skriv><button type="button" class="knapp liten sekundar" data-ha="${h.status === 'avslutat' ? 'oppna' : 'avsluta'}" data-id="${h.id}">${h.status === 'avslutat' ? 'Öppna igen' : 'Avsluta'}</button>${h.kontakter.length > 1 ? `<button type="button" class="knapp liten sekundar" data-ha="dela" data-id="${h.id}">Dela</button>` : ''}${arenden.length > 1 ? `<button type="button" class="knapp liten sekundar" data-ha="sla-ihop" data-id="${h.id}">Slå ihop</button><button type="button" class="knapp liten sekundar" data-ha="flytta" data-id="${h.id}">Flytta en kontakt</button>` : ''}<button type="button" class="knapp liten sekundar" data-ha="historik" data-id="${h.id}">Historik</button></span>` : ''}</li>`).join('')}</ul></section>` : ''}`;
    const kontaktText = (id) => { const k = o.vardkontakter.find(x => x.id === id); return k ? `${datum(k.start)} ${k.orsak ?? ''}, ${k.enhet?.namn ?? ''}` : `Vårdkontakt ${id}`; };
    el.addEventListener('click', async (e) => {
      try {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.vpMall) { if (await satUppMall(ctx, b.dataset.vpMall)) ctx.ladda(); return; }
        if ('vpNy' in b.dataset) { if (await nyPlan(ctx)) ctx.ladda(); return; }
        if (b.dataset.vp) { if (await andraPlan(v.planer.find(p => p.id === Number(b.dataset.plan)), b.dataset.vp, b.dataset.atgard)) ctx.ladda(); return; }
        if ('samSpu' in b.dataset) {
          const f = s.forslag.spu;
          const data = await stegDialog({ knapp: 'Skicka inskrivningsmeddelandet', forklaring: `Mottagare: ${f.mottagare.map(m => m.namn).join(' och ')}. ${f.adress ? `Adress: ${f.adress}.` : 'Ingen adress skickas.'}`, paragraf: '2 kap. 1 till 3 §§ lag (2017:612)',
            falt: [{ namn: 'socialtjanst', typ: 'kryss', etikett: 'Insatser från socialtjänsten' }, { namn: 'kommunalHsv', typ: 'kryss', etikett: 'Kommunal hälso- och sjukvård' }, { namn: 'oppenvard', typ: 'kryss', etikett: 'Regionens öppna vård' }, { namn: 'beraknad', typ: 'datum', etikett: 'Beräknad utskrivning', varde: f.beraknad, obligatorisk: true }] }, 'Inskrivningsmeddelande');
          if (data == null) return;
          await api(`/api/patient/${pid}/samordning`, { metod: 'POST', data: { typ: 'spu', behov: { socialtjanst: data.socialtjanst || f.behov.socialtjanst, kommunalHsv: data.kommunalHsv || f.behov.kommunalHsv, oppenvard: data.oppenvard || f.behov.oppenvard }, beraknad: data.beraknad } });
          notis('Inskrivningsmeddelandet är skickat.');
          return ctx.ladda();
        }
        if (b.dataset.samSip) { if (await nySip(ctx, b.dataset.samSip)) ctx.ladda(); return; }
        if (b.dataset.sam) { if (await andraSamordning(s.samordningar.find(x => x.id === Number(b.dataset.id)), b.dataset.sam)) ctx.ladda(); return; }
        if (b.dataset.haForslag) { const f = o.r3.halsoarendeForslag[Number(b.dataset.haForslag)]; await api(`/api/halsoarende/${f.halsoarendeId}/${f.typ === 'avsluta' ? 'avsluta' : 'sla-ihop'}`, { metod: 'POST', data: f.typ === 'avsluta' ? {} : { med: f.med } }); notis('Hälsoärendet är ändrat.'); return ctx.ladda(); }
        if (b.dataset.ha) { if (await andraArende(arenden, Number(b.dataset.id), b.dataset.ha, kontaktText)) ctx.ladda(); }
      } catch (x) { felNotis(x); }
    });
  },
};

function planHtml(p) {
  const utfora = new Set(p.kan.utfora);
  return `<article class="ruta r3-plan" aria-label="${esc(p.rubrik)}">
    <h3>${esc(p.rubrik)} <span class="tagg">${esc(p.statusText)}</span>${p.standard ? ' <span class="tagg">Standardplan</span>' : ''}</h3>
    <p class="dampad liten">${esc(p.enhet.namn)}, upprättad ${esc(tidpunkt(p.skapad))} av ${esc(p.skapadAv?.namn ?? '')}. Följs upp ${esc(p.uppfoljning)}.${p.grund ? ` ${esc(p.grund)}` : ''}</p>
    ${p.avvikelser.length ? `<ul class="r3-avvikelser">${p.avvikelser.map(a => `<li class="tagg tagg-larm">${esc(a.text)}</li>`).join('')}</ul>` : ''}
    ${p.status !== 'avslutad' ? kunskap.vardforloppHtml(p.vardforlopp) : ''}
    <h4>Mål</h4><ul class="enkel-lista">${p.mal.map(m => `<li>${esc(m.text)} <span class="dampad">${esc(m.statusText)}</span></li>`).join('')}</ul>
    ${p.utfall ? kunskap.utfallHtml(p.utfall) : ''}
    <h4>Åtgärder</h4><ul class="enkel-lista">${p.atgarder.map(a => `<li>${esc(a.text)} <span class="dampad">${esc(a.ansvarigText)}${a.dagligen ? ', dagligen' : ''}</span>${a.senastUtford ? `<span class="under-text">Senast ${esc(tidpunkt(a.senastUtford))}${a.utfordAvSystemet ? ', registrerat som mätvärde' : a.utfordAv ? ` av ${esc(a.utfordAv.namn)}` : ''}</span>` : ''}${utfora.has(a.id) ? ` <button type="button" class="knapp liten sekundar" data-skriv data-vp="utfort" data-plan="${p.id}" data-atgard="${a.id}">Utförd</button>` : ''}</li>`).join('')}</ul>
    ${p.kan.andra ? `<div class="knapprad" data-skriv>${p.status === 'aktiv' ? `<button type="button" class="knapp liten" data-vp="uppfoljning" data-plan="${p.id}">Följ upp</button><button type="button" class="knapp liten sekundar" data-vp="atgard" data-plan="${p.id}">Lägg till åtgärd</button><button type="button" class="knapp liten sekundar" data-vp="mal" data-plan="${p.id}">Lägg till mål</button><button type="button" class="knapp liten sekundar" data-vp="pausa" data-plan="${p.id}">Uppehåll</button>` : `<button type="button" class="knapp liten" data-vp="ateruppta" data-plan="${p.id}">Återuppta</button>`}<button type="button" class="knapp liten sekundar" data-vp="avsluta" data-plan="${p.id}">Avsluta</button></div>` : ''}
    <details><summary>Historik (${p.historik.length})</summary><ol class="enkel-lista">${p.historik.map(h => `<li>${esc(h.text)}<span class="under-text">${esc(tidpunkt(h.tid))}, ${esc(h.av?.namn ?? '')}, ${esc(h.enhet?.namn ?? '')}</span></li>`).join('')}</ol></details>
  </article>`;
}
const ANSVAR = [['sjukskoterska', 'Sjuksköterska'], ['underskoterska', 'Undersköterska'], ['lakare', 'Läkare']];
async function nyPlan(ctx) {
  const data = await stegDialog({ knapp: 'Upprätta vårdplanen', falt: [{ namn: 'rubrik', typ: 'text', etikett: 'Vad planen gäller', obligatorisk: true }, { namn: 'mal', typ: 'text', etikett: 'Mål', obligatorisk: true }, { namn: 'atgard', typ: 'text', etikett: 'Åtgärd', obligatorisk: true }, { namn: 'ansvarig', typ: 'val', etikett: 'Ansvarig', varde: 'sjukskoterska', alternativ: ANSVAR }] }, 'Ny individuell vårdplan');
  if (data == null) return false;
  const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardplaner`, { metod: 'POST', data: { rubrik: data.rubrik, mal: [data.mal], atgarder: [{ text: data.atgard, ansvarig: data.ansvarig }] } });
  notis(`Vårdplanen ${r.rubrik} är upprättad. Den följs upp ${r.uppfoljning}.`);
  return true;
}
async function andraPlan(p, vad, atgard) {
  let data = {};
  if (vad === 'utfort') data = { atgard: Number(atgard) };
  else if (vad === 'mal') { const d = await stegDialog({ knapp: 'Lägg till', falt: [{ namn: 'text', typ: 'text', etikett: 'Mål', obligatorisk: true }] }, 'Nytt mål'); if (!d) return false; data = d; }
  else if (vad === 'atgard') { const d = await stegDialog({ knapp: 'Lägg till', falt: [{ namn: 'text', typ: 'text', etikett: 'Åtgärd', obligatorisk: true }, { namn: 'ansvarig', typ: 'val', etikett: 'Ansvarig', varde: 'sjukskoterska', alternativ: ANSVAR }] }, 'Ny åtgärd'); if (!d) return false; data = d; }
  else if (vad === 'pausa') { const d = await stegDialog({ knapp: 'Gör uppehåll', falt: [{ namn: 'orsak', typ: 'text', etikett: 'Orsak', obligatorisk: true }] }, 'Uppehåll i vårdplanen'); if (!d) return false; data = d; }
  else if (vad === 'avsluta') { const d = await stegDialog({ knapp: 'Avsluta planen', falt: [{ namn: 'kommentar', typ: 'text', etikett: 'Utvärdering' }] }, 'Avsluta vårdplanen'); if (!d) return false; data = d; }
  else if (vad === 'uppfoljning') {
    const d = await stegDialog({ knapp: 'Spara uppföljningen', falt: [...p.mal.map(m => ({ namn: `mal-${m.id}`, typ: 'val', etikett: m.text, varde: 'uppnatt', alternativ: [['uppnatt', 'Uppnått'], ['delvis', 'Delvis uppnått'], ['ej_uppnatt', 'Inte uppnått']] })), { namn: 'kommentar', typ: 'text', etikett: 'Kommentar' }] }, `Följ upp ${p.rubrik}`);
    if (!d) return false;
    data = { mal: Object.fromEntries(p.mal.map(m => [m.id, d[`mal-${m.id}`]])), kommentar: d.kommentar };
  }
  await api(`/api/vardplan/${p.id}/${vad}`, { metod: 'POST', data });
  notis({ utfort: 'Åtgärden är registrerad som utförd.', uppfoljning: 'Uppföljningen är sparad.', pausa: 'Planen har uppehåll.', ateruppta: 'Planen är återupptagen.', avsluta: 'Planen är avslutad.' }[vad] ?? 'Planen är ändrad.');
  return true;
}

function samordningHtml(s) {
  const knapp = (vad, text, primar = false) => `<button type="button" class="knapp liten${primar ? '' : ' sekundar'}" data-sam="${vad}" data-id="${s.id}">${esc(text)}</button>`;
  const agare = s.enhet && S.session?.enhet?.vardenhet?.id === s.enhet.id;
  const knappar = [];
  if (s.status !== 'avslutad') {
    if (s.typ === 'spu' && !s.utskrivningsklar && far('ordinera')) knappar.push(knapp('utskrivningsklar', 'Patienten är utskrivningsklar', true));
    if (s.typ === 'spu') knappar.push(knapp('beraknad', 'Ändra beräknad utskrivning'));
    for (const u of s.uppgifter) {
      if (u.id === 'fast_vardkontakt') knappar.push(knapp('fast-vardkontakt', 'Utse mig till fast vårdkontakt', true));
      if (u.id === 'plan') knappar.push(knapp('plan', 'Upprätta individuell plan', true));
    }
    if (s.frister.some(f => f.id === 'kallelse' && f.status !== 'uppfylld') && s.fastVardkontakt?.id === S.session?.personal?.id) knappar.push(knapp('kallelse', 'Skicka kallelse till samordnad individuell planering', true));
  }
  return `<article class="ruta r3-sam" aria-label="${esc(s.typText)}">
    <h3>${esc(s.typText)} <span class="tagg">${esc({ pagar: 'Pågår', utskrivningsklar: 'Utskrivningsklar', avslutad: 'Avslutad' }[s.status])}</span></h3>
    <p class="dampad liten">${esc(s.enhet.namn)}. Mottagare: ${s.mottagare.map(m => esc(m?.namn ?? '')).join(', ')}.${s.beraknad ? ` Beräknad utskrivning ${esc(s.beraknad)}.` : ''}${s.fastVardkontakt ? ` Fast vårdkontakt: ${esc(s.fastVardkontakt.namn)}.` : ''}</p>
    ${s.frister.length ? `<ul class="enkel-lista">${s.frister.map(fristRad).join('')}</ul>` : ''}
    ${s.uppgifter.length ? `<ul class="enkel-lista">${s.uppgifter.map(u => `<li>${esc(u.text)} <span class="dampad">(${esc(u.paragraf)})</span></li>`).join('')}</ul>` : ''}
    ${s.plan ? `<h4>Individuell plan</h4><ul class="enkel-lista">${s.plan.insatser.map(i => `<li>${esc(i.text)} <span class="dampad">${i.huvudman === 'kommun' ? 'Kommunen' : 'Regionen'}</span></li>`).join('')}</ul><p class="liten">Övergripande ansvar: ${s.plan.overgripande === 'kommun' ? 'kommunen' : 'regionen'}.${s.plan.andra ? ` ${esc(s.plan.andra)}` : ''} Patienten ${s.plan.patientDelaktig ? 'deltog' : 'deltog inte'}.</p>` : ''}
    ${s.betalning ? `<p class="liten">Kommunens betalningsansvar från ${esc(s.betalning.fran)}: ${s.betalning.uppfyllda ? 'villkoren är uppfyllda' : 'alla villkor är inte uppfyllda'}. ${esc(s.betalning.text)}</p>` : ''}
    ${knappar.length && (agare || s.uppgifter.length || knappar.length) ? `<div class="knapprad" data-skriv>${knappar.join('')}</div>` : ''}
    <details><summary>Historik (${s.historik.length})</summary><ol class="enkel-lista">${s.historik.map(h => `<li>${esc(h.text)}${h.paragraf ? ` <span class="dampad">(${esc(h.paragraf)})</span>` : ''}<span class="under-text">${esc(tidpunkt(h.tid))}, ${esc(h.av?.namn ?? '')}, ${esc(h.enhet?.namn ?? '')}</span></li>`).join('')}</ol></details>
  </article>`;
}
const PLANFALT = [{ namn: 'samtycke', typ: 'kryss', etikett: 'Patienten samtycker till att planen upprättas (16 kap. 4 § HSL och 10 kap. 8 § SoL)', obligatorisk: true },
  { namn: 'region', typ: 'text', etikett: 'Insatser från regionen' }, { namn: 'kommun', typ: 'text', etikett: 'Insatser från kommunen' }, { namn: 'andra', typ: 'text', etikett: 'Åtgärder av någon annan än region och kommun' },
  { namn: 'overgripande', typ: 'val', etikett: 'Övergripande ansvar', varde: 'region', alternativ: [['region', 'Regionen'], ['kommun', 'Kommunen']] },
  { namn: 'patientDelaktig', typ: 'kryss', etikett: 'Planen upprättades tillsammans med patienten' }, { namn: 'narstaende', typ: 'kryss', etikett: 'Närstående deltog' }];
const planData = (d) => ({ samtycke: d.samtycke, insatser: [d.region && { text: d.region, huvudman: 'region' }, d.kommun && { text: d.kommun, huvudman: 'kommun' }].filter(Boolean), andra: d.andra, overgripande: d.overgripande, patientDelaktig: d.patientDelaktig, narstaende: d.narstaende });
async function nySip(ctx, typ) {
  const d = await stegDialog({ knapp: 'Upprätta planen', paragraf: typ === 'lpt7a' ? '7 a § LPT' : '16 kap. 4 § HSL, 10 kap. 8 och 9 §§ SoL', falt: PLANFALT }, typ === 'lpt7a' ? 'Samordnad vårdplan vid öppen tvångsvård' : 'Samordnad individuell plan');
  if (!d) return false;
  await api(`/api/patient/${encodeURIComponent(ctx.id)}/samordning`, { metod: 'POST', data: { typ, ...planData(d) } });
  notis('Planen är upprättad och skickad till kommunen.');
  return true;
}
async function andraSamordning(s, vad) {
  let data = {};
  if (vad === 'beraknad') { const d = await stegDialog({ knapp: 'Skicka', paragraf: '2 kap. 4 § lag (2017:612)', forklaring: 'Systemet skickar den nya tidpunkten till mottagarna.', falt: [{ namn: 'datum', typ: 'datum', etikett: 'Beräknad utskrivning', varde: s.beraknad, obligatorisk: true }] }, 'Ny beräknad utskrivning'); if (!d) return false; data = d; }
  if (vad === 'utskrivningsklar') { const d = await stegDialog({ knapp: 'Skicka underrättelsen', paragraf: '3 kap. 1 § lag (2017:612)', forklaring: 'Systemet underrättar kommunen och den öppna vården.', falt: [{ namn: 'information', typ: 'text', etikett: 'Information som behövs för insatserna efter utskrivningen' }] }, 'Patienten är utskrivningsklar'); if (!d) return false; data = d; }
  if (vad === 'plan') { const d = await stegDialog({ knapp: 'Upprätta planen', paragraf: '4 kap. 2 § lag (2017:612)', falt: PLANFALT }, 'Individuell plan'); if (!d) return false; data = planData(d); }
  await api(`/api/samordning/${s.id}/${vad}`, { metod: 'POST', data });
  notis({ utskrivningsklar: 'Underrättelsen om att patienten är utskrivningsklar är skickad.', 'fast-vardkontakt': 'Du är patientens fasta vårdkontakt.', kallelse: 'Kallelsen är skickad.', plan: 'Planen är upprättad.', beraknad: 'Den nya tidpunkten är skickad.' }[vad] ?? 'Klart.');
  return true;
}

async function andraArende(arenden, id, vad, kontaktText) {
  const h = arenden.find(x => x.id === id);
  if (vad === 'historik') {
    const d = await api(`/api/halsoarende/${id}`);
    await dialog(`<h2 id="dlg-rubrik">Historik: ${esc(h.rubrik)}</h2><ol class="enkel-lista">${d.historik.map(x => `<li>${esc(x.text)}<span class="under-text">${esc(tidpunkt(x.tid))}, ${esc(x.av?.namn ?? '')}</span></li>`).join('') || '<li>Inga ändringar.</li>'}</ol><div class="knapprad"><button type="button" class="knapp" data-varde="avbryt">Stäng</button></div>`);
    return false;
  }
  const andra = arenden.filter(x => x.id !== id).map(x => [String(x.id), x.rubrik]);
  let data = {};
  if (vad === 'dela') { const d = await stegDialog({ knapp: 'Dela ärendet', falt: [{ namn: 'rubrik', typ: 'text', etikett: 'Det nya ärendets rubrik', obligatorisk: true }, ...h.kontakter.map(k => ({ namn: `k${k}`, typ: 'kryss', etikett: kontaktText(k) }))] }, `Dela ${h.rubrik}`); if (!d) return false; data = { rubrik: d.rubrik, kontakter: h.kontakter.filter(k => d[`k${k}`]) }; }
  if (vad === 'sla-ihop') { const d = await stegDialog({ knapp: 'Slå ihop', falt: [{ namn: 'med', typ: 'val', etikett: 'Slå ihop med', varde: andra[0]?.[0], alternativ: andra }] }, `Slå ihop ${h.rubrik}`); if (!d) return false; data = { med: Number(d.med) }; }
  if (vad === 'flytta') { const d = await stegDialog({ knapp: 'Flytta', falt: [{ namn: 'kontakt', typ: 'val', etikett: 'Vårdkontakt', varde: String(h.kontakter[0]), alternativ: h.kontakter.map(k => [String(k), kontaktText(k)]) }, { namn: 'till', typ: 'val', etikett: 'Till ärendet', varde: andra[0]?.[0], alternativ: andra }] }, 'Flytta en vårdkontakt'); if (!d) return false; data = { kontakt: Number(d.kontakt), till: Number(d.till) }; }
  await api(`/api/halsoarende/${id}/${vad}`, { metod: 'POST', data });
  notis('Hälsoärendet är ändrat.');
  return true;
}

// ---------- Inkorgen ----------
export function inkorgSektioner(d, sektion, rad) {
  const pat = (id, flik) => `#/patient/${encodeURIComponent(id)}/${flik}`;
  const tv = (d.tvangsvard ?? []).map(x => rad(pat(x.patientId, 'tvangsvard'), `${esc(x.statusText)}, ${esc(pnamn(x.patient))}`,
    esc([...x.frister.map(f => `${f.rubrik} senast ${tidpunkt(f.senast)} (${f.paragraf})`), ...x.uppgifter.map(u => `${u.text} (${u.paragraf})`)].join('. ')), x.frister.some(f => f.status === 'passerad') ? 'ik-larm' : ''));
  const vp = (d.vardplanerUppfoljning ?? []).map(x => rad(pat(x.patientId, 'planer'), `${esc(x.rubrik)}, ${esc(pnamn(x.patient))}`, `Vårdplanen skulle ha följts upp ${esc(x.uppfoljning)}.`));
  const sam = (d.samordning ?? []).map(x => rad(pat(x.patientId, 'planer'), `${esc(x.typText)}, ${esc(pnamn(x.patient))}`, esc([...x.uppgifter.map(u => `${u.text} (${u.paragraf})`), x.frist ? `${x.frist.rubrik} senast ${datum(x.frist.senast)} (${x.frist.paragraf})` : null].filter(Boolean).join(' '))));
  return `${tv.length || S.session?.r3?.tvangsvardsenhet ? sektion('tv', 'Tvångsvård', tv, 'Inga frister eller uppgifter i tvångsvården.', 'Frister som är nära eller har passerat och det som lagen kräver, för patienterna på din vårdenhet.') : ''}
    ${vp.length ? sektion('vp', 'Vårdplaner att följa upp', vp, '', 'Vårdplaner på din vårdenhet vars uppföljningsdatum har passerat.') : ''}
    ${sam.length ? sektion('sam', 'Samordnad planering', sam, '', 'Det som din vårdenhet ska göra i en samordnad planering vid utskrivning eller en samordnad individuell plan.') : ''}`;
}
export const inkorgAntal = (d) => (d.tvangsvard?.length ?? 0) + (d.vardplanerUppfoljning?.length ?? 0) + (d.samordning?.length ?? 0);

// ---------- Bevakningen av tvångsvården (Sussa 3.2.3.4) ----------
function statistikHtml(t) {
  return `<div class="tabellrulle"><table class="tabell"><caption>Senaste ${t.period.dagar} dagarna, ${esc(t.vardenhet.namn)}</caption><tbody>
    <tr><th scope="row">Pågående perioder</th><td>${esc(t.perioder.pagaende)}</td></tr><tr><th scope="row">Avslutade perioder</th><td>${esc(t.perioder.avslutade)}</td></tr>
    <tr><th scope="row">LPT och LRV</th><td>${esc(t.perioder.lpt)} och ${esc(t.perioder.lrv)}</td></tr>
    ${Object.values(t.atgarder).map(a => `<tr><th scope="row">${esc(a.text)}</th><td>${esc(a.antal)}</td></tr>`).join('')}
    <tr><th scope="row">Passerade frister</th><td>${esc(t.passeradeFrister)}</td></tr><tr><th scope="row">Medellängd för avslutade perioder</th><td>${t.medellangdDagar == null ? 'Visas inte för färre än tre perioder' : `${t.medellangdDagar} dagar`}</td></tr>
  </tbody></table></div>`;
}
export const bevakningVy = {
  namn: 'tvangsvard',
  async visa(main) {
    main.innerHTML = vyRubrik('Tvångsvård', 'Alla pågående tvångsvårdsperioder på vårdenheten, med den frist som kommer först överst. Systemet räknar fristerna ur LPT och LRV.') + '<div id="tv-bev"><p class="tom">Hämtar.</p></div>';
    const d = await api('/api/tvangsvard/bevakning');
    main.querySelector('#tv-bev').innerHTML = `${d.rader.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Patient</th><th scope="col">Vård</th><th scope="col">Nästa frist</th><th scope="col">Pågående åtgärder</th><th scope="col">Att göra</th></tr></thead>
      <tbody>${d.rader.map(r => `<tr class="${r.frist?.status === 'passerad' ? 'r3-passerad' : ''}"><td><a class="patientlank" href="#/patient/${encodeURIComponent(r.patientId)}/tvangsvard">${r.skyddad ? `${ikon.skold}<span class="skyddad-namn">${esc(r.namn)}</span>` : esc(r.namn)}</a><span class="under-text pnr">${esc(r.personnummer)}</span></td>
        <td>${esc(r.statusText)}${r.giltigTill ? `<span class="under-text">Till ${esc(datum(r.giltigTill))}</span>` : ''}</td><td>${r.frist ? `${esc(r.frist.rubrik)}<span class="under-text">${esc(tidpunkt(r.frist.senast))} (${esc(r.frist.paragraf)})</span>` : 'Ingen'}</td>
        <td>${r.pagaende.map(a => esc(a.typText)).join(', ') || 'Inga'}</td><td>${r.uppgifter}</td></tr>`).join('')}</tbody></table></div>` : tom('Ingen pågående tvångsvård på vårdenheten.')}
      <h2>Uppföljning utan personuppgifter</h2>${d.statistik.map(statistikHtml).join('')}`;
  },
};

// ---------- Uppföljning av planer och tvångsvård (Sussa 3.2.3.4 och 4.3.1.3) ----------
export const uppfoljningVy = {
  namn: 'planuppfoljning',
  async visa(main) {
    main.innerHTML = vyRubrik('Tvångsvård och samordning', 'Uppföljning per vårdenhet utan namn, personnummer eller id. Grupper med färre än tre visas inte som tal.') + '<div id="pu"><p class="tom">Hämtar.</p></div>';
    const d = await api('/api/uppfoljning/planer');
    const sam = d.samordning.filter(x => x.spu.antal || x.sip.antal);
    main.querySelector('#pu').innerHTML = `<h2>Psykiatrisk tvångsvård</h2>${d.tvangsvard.map(statistikHtml).join('') || tom('Ingen tvångsvård.')}
      <h2>Samordnad planering</h2>${sam.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Vårdenhet</th><th scope="col">SPU</th><th scope="col">Inskrivningsmeddelande i tid</th><th scope="col">Kallelser i tid</th><th scope="col">Utskrivningsklara vårddygn</th><th scope="col">SIP</th><th scope="col">Med patienten</th></tr></thead>
      <tbody>${sam.map(x => `<tr><th scope="row">${esc(x.vardenhet.namn)}</th><td>${esc(x.spu.antal)}</td><td>${esc(x.spu.inskrivningsmeddelandeITid ?? 'Visas inte')}</td><td>${esc(x.spu.kallelserITid)}</td><td>${esc(x.spu.utskrivningsklaraVarddygn ?? 'Visas inte')}</td><td>${esc(x.sip.antal)}</td><td>${esc(x.sip.patientDelaktig)}</td></tr>`).join('')}</tbody></table></div><p class="dampad liten">${esc(sam[0].anmarkning)}</p>` : tom('Ingen samordnad planering.')}`;
  },
};

// ---------- Kommunens vy (simulerad part) ----------
export const samverkanVy = {
  namn: 'samverkan',
  async visa(main) {
    main.innerHTML = vyRubrik('Samverkan', 'Samordnad planering som regionen har skickat till kommunen. Kommunen är en simulerad part i demon och ser bara det som har skickats hit, aldrig journalen.') + '<div id="sv"><p class="tom">Hämtar.</p></div>';
    const lista = await api('/api/samverkan');
    const rita = async () => {
      main.querySelector('#sv').innerHTML = lista.length ? (await Promise.all(lista.map(x => api(`/api/samverkan/${x.id}`)))).map(s => `<article class="ruta r3-sam" aria-label="${esc(s.typText)}">
        <h2>${esc(s.typText)}: ${s.patient.skyddad ? `${ikon.skold}<span>Skyddad identitet</span>` : esc(s.patient.namn)}</h2>
        <p>${s.patient.personnummer ? `<span class="pnr">${esc(s.patient.personnummer)}</span>. ` : ''}${s.patient.adress ? `${esc(s.patient.adress)}. ` : s.patient.skyddad ? 'Patienten har skyddade personuppgifter. Kontakta vårdenheten. ' : ''}Från ${esc(s.enhet.namn)}.${s.beraknad ? ` Beräknad utskrivning ${esc(s.beraknad)}.` : ''}${s.utskrivningsklar ? ` Utskrivningsklar ${esc(tidpunkt(s.utskrivningsklar))}.` : ''}</p>
        ${s.information.length ? `<p class="liten">${s.information.map(esc).join(' ')}</p>` : ''}
        ${s.plan ? `<ul class="enkel-lista">${s.plan.insatser.map(i => `<li>${esc(i.text)} <span class="dampad">${i.huvudman === 'kommun' ? 'Kommunen' : 'Regionen'}</span></li>`).join('')}</ul>` : ''}
        ${s.betalning ? `<p class="liten">Betalningsansvar från ${esc(s.betalning.fran)}: ${s.betalning.uppfyllda ? 'villkoren är uppfyllda' : 'alla villkor är inte uppfyllda'}.</p>` : ''}
        ${s.uppgifter.map(u => `<p class="ruta ruta-info liten">${esc(u.text)} (${esc(u.paragraf)}) <button type="button" class="knapp liten" data-sv="${u.id === 'justera' ? 'justera' : 'planering'}" data-id="${s.id}">${u.id === 'justera' ? 'Justera planen' : 'Planeringen är påbörjad'}</button></p>`).join('')}
      </article>`).join('') : tom('Inget har skickats till kommunen.');
    };
    await rita();
    main.querySelector('#sv').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sv]');
      if (!b) return;
      try { await api(`/api/samverkan/${b.dataset.id}/${b.dataset.sv}`, { metod: 'POST', data: {} }); notis('Registrerat.'); await rita(); } catch (x) { felNotis(x); }
    });
  },
};
