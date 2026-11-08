// Läkemedelslistan: ordinationer med NLL-status, ordination med obligatoriska fält och varningar, utsättning och avstämning mot NLL.
import { esc, api, datum, tidpunkt, migreradEtikett, notis, felNotis, faltFel, medKnapp, dialog, ikon, ORDTYP, idag, plusDagar } from '../ui.js';
import { far } from '../app.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { doldaRad } from './patient.js';
import { nllChip } from './patient-oversikt.js';
import { lakemedelsalderRad } from '../avbrott.js';
import { kontaktRad, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
import * as administrering from './administrering.js';
// Läkemedelsprocessen, del 2 (runda 6, r2).
import * as lms from './lakemedelsstod.js';
import { S } from '../app.js';

let nastaOverforing = null;
// Vätskebalansens val (dygnsbrytning, filter och sortering) gäller tills sidan laddas om (runda 6, r2).
const vbVal = {};
let vbParam = '';
const SATT = { peroralt: 'Peroralt', subkutant: 'Subkutant', intravenost: 'Intravenöst', inhalation: 'Inhalation', sublingualt: 'Under tungan', intramuskulart: 'Intramuskulärt' };

// Delar som inte finns i läskopian under ett avbrott (vidimering och vätskebalans) visas inte då.
const kanske = (p) => p.catch(() => null);

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const [d, adm, vid, vb, dir, dygn, fg] = await Promise.all([
    api(`/api/patient/${pid}/lakemedel`),
    kanske(api(`/api/patient/${pid}/administreringar`)),
    far('ordinera') ? kanske(api(`/api/patient/${pid}/vidimering`)) : null,
    far('las_matvarden') ? kanske(api(`/api/patient/${pid}/vatskebalans${vbParam}`)) : null,
    // Runda 6, r2: generella direktiv, dosering över flera dygn och fördjupad läkemedelsgenomgång.
    far('ordinera_direktiv') ? kanske(api(`/api/patient/${pid}/direktiv`)) : null,
    kanske(api(`/api/patient/${pid}/doseringsoversikt`)),
    kanske(api(`/api/patient/${pid}/fordjupad-genomgang`)),
  ]);
  if (!ctx.aktuell()) return;
  const kanOrdinera = far('ordinera');
  const aktuella = d.ordinationer.filter(o => o.aktuell);
  const ovriga = d.ordinationer.filter(o => !o.aktuell);
  el.innerHTML = `<div class="flikhuvud"><h2>Läkemedel</h2>
      <div class="knapprad">${kanOrdinera ? `<button type="button" class="knapp" data-ny aria-expanded="false" aria-controls="ordform">${ikon.plus}<span>Ordinera</span></button><button type="button" class="knapp sekundar" data-mall aria-expanded="false">Ordinera från mall</button>`
        : far('registrera_muntlig_ordination') ? '<button type="button" class="knapp sekundar" data-muntlig aria-expanded="false">Muntlig ordination</button><p class="dampad liten">Din yrkesroll kan läsa läkemedelslistan men inte ordinera. Dokumentera en muntlig ordination från en läkare, eller ordinera enligt ett generellt direktiv.</p>' : '<p class="dampad liten">Din yrkesroll kan läsa läkemedelslistan men inte ordinera.</p>'}</div></div>
    ${kanOrdinera ? hjalpRuta('ordinera') : ''}
    ${lakemedelsalderRad(ctx.id)}
    ${doldaRad(d.dolda)}
    <p class="dampad liten">Läkemedelslistan är gemensam för vårdgivaren och följer Nationella läkemedelslistan (NLL). Varje ändring skickas till NLL och kvitteras. I demon är NLL simulerad.</p>
    <div id="ordform-plats"></div>
    <div id="mall-plats"></div>
    ${vid ? vidimeringPanel(vid) : ''}
    ${kanOrdinera ? nllDemo() : ''}
    <section aria-labelledby="lm-akt"><h3 id="lm-akt">Aktuella ordinationer <span class="antal">${aktuella.length}</span></h3>${lms.verktygsrad()}<div id="lm-akt-tabell">${tabell(lms.filtrera(aktuella), kanOrdinera, true)}</div></section>
    ${lms.direktivSektion(dir)}
    ${adm && (adm.doser.length || adm.vidBehov.length || adm.utanTider.length || adm.vantarPaHandelse.length || adm.kommandeHandelser?.length) ? `<section class="lm-sektion" aria-labelledby="lm-adm" id="lm-adm-sektion"><h3 id="lm-adm">Dagens administreringar</h3>${administrering.patientDoser(ctx.id, adm)}</section>` : ''}
    ${kanOrdinera && vid?.kan?.kan ? '<section class="lm-sektion" aria-labelledby="lm-genomgang"><h3 id="lm-genomgang">Läkemedelsgenomgång</h3><p class="liten">Systemet tar fram indikation, dubbelmedicinering, interaktioner, passerade uppföljningar och en läkemedelsberättelse ur historiken.</p><button type="button" class="knapp sekundar" data-genomgang>Gör läkemedelsgenomgång</button></section>' : ''}
    ${lms.doseringsSektion(dygn)}
    ${lms.fordjupadSektion(fg)}
    <div id="lm-vb-plats">${vb ? lms.vatskeSektion(vb) : ''}</div>
    ${ovriga.length ? `<section aria-labelledby="lm-utsatt"><h3 id="lm-utsatt">Utsatta och avslutade <span class="antal">${ovriga.length}</span></h3>${tabell(ovriga, kanOrdinera, false)}</section>` : ''}`;
  if (adm) administrering.koppla(el.querySelector('#lm-adm-sektion') ?? document.createElement('div'), () => ctx.ladda());
  // Runda 6, r2: filtrering och sortering ritar bara om tabellen.
  lms.kopplaVerktyg(el.querySelector('.lms-verktyg'), () => { el.querySelector('#lm-akt-tabell').innerHTML = tabell(lms.filtrera(aktuella), kanOrdinera, true); });
  // Vätskebalansens dygnsbrytning, filter och sortering hämtar om bara den delen.
  el.querySelector('#lm-vb-plats').addEventListener('change', async (e) => {
    const v = e.target.closest('[data-vb]');
    if (!v) return;
    vbVal[v.dataset.vb] = v.value;
    vbParam = `?${new URLSearchParams(Object.entries(vbVal).filter(([, x]) => x))}`;
    try { el.querySelector('#lm-vb-plats').innerHTML = lms.vatskeSektion(await api(`/api/patient/${pid}/vatskebalans${vbParam}`)); } catch (x) { felNotis(x); }
  });
  el.querySelector('[data-mall]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#mall-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    lms.mallar(plats, ctx);
  });
  el.querySelector('[data-muntlig]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#ordform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    ordinationsForm(plats, ctx, null, { muntlig: true });
  });
  // Från inkorgen (lakemedel/utvardera-<id>) öppnas utvärderingen direkt.
  if (/^utvardera-\d+$/.test(ctx.sub ?? '') && far('utvardera_lakemedel')) setTimeout(() => lms.utvardera(ctx, ctx.sub.slice(10), () => ctx.ladda()), 0);

  el.querySelector('[data-ny]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#ordform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    ordinationsForm(plats, ctx);
  });
  // Från snabbvalet Ordinera i översikten (lakemedel/ny) öppnas formuläret direkt.
  if (ctx.sub === 'ny' && kanOrdinera) el.querySelector('[data-ny]').click();
  // Återinsättning efter uppehåll (runda 5, r4): från inkorgen (lakemedel/aterinsatt-<id>) öppnas formuläret ifyllt ur
  // den ordination som gjorde uppehåll.
  const ater = kanOrdinera && /^aterinsatt-\d+$/.test(ctx.sub ?? '') ? d.ordinationer.find(o => String(o.id) === ctx.sub.slice(11) && o.utsatt?.plan?.typ === 'uppehall') : null;
  if (ater) {
    el.querySelector('[data-ny]').setAttribute('aria-expanded', 'true');
    ordinationsForm(el.querySelector('#ordform-plats'), ctx, ater);
  }
  // Från inkorgen när en vårdhändelse avbokades (lakemedel/utsatt-<id>, runda 5 r4) öppnas utsättningen direkt.
  const utsatt = kanOrdinera && /^utsatt-\d+$/.test(ctx.sub ?? '') ? el.querySelector(`[data-utsatt="${ctx.sub.slice(7)}"]`) : null;
  if (utsatt) setTimeout(() => utsatt.click(), 0);
  el.addEventListener('click', async (e) => {
    // Runda 6, r2: direktiv, utvärdering, signering, fördjupad genomgång och makulering av vätskebalans.
    const r6 = e.target.closest('[data-direktiv],[data-utvardera],[data-signera-muntlig],[data-fg],[data-makulera-vb]');
    if (r6?.dataset.direktiv) return lms.ordineraDirektiv(ctx, dir, r6);
    if (r6?.dataset.utvardera) return lms.utvardera(ctx, r6.dataset.utvardera, () => ctx.ladda());
    if (r6?.dataset.signeraMuntlig) return lms.signeraMuntlig(r6, r6.dataset.signeraMuntlig, () => ctx.ladda());
    if (r6?.dataset.fg) return lms.fordjupadSteg(ctx, fg, r6.dataset.fg, r6);
    if (r6?.dataset.makuleraVb) return lms.makulera(ctx.id, 'vatskebalans', r6.dataset.makuleraVb, r6.dataset.text, () => ctx.ladda());
    const v = e.target.closest('[data-vidimera],[data-genomgang],[data-vatska]');
    if (v?.dataset.vidimera != null) {
      try {
        await medKnapp(v, () => api(`/api/patient/${pid}/vidimering`, { metod: 'POST', data: {} }));
        notis('Läkemedelslistan är vidimerad.');
        ctx.ladda();
      } catch { /* notis visad */ }
      return;
    }
    if (v?.dataset.genomgang != null) return genomgang(ctx);
    if (v?.dataset.vatska != null) return registreraVatska(ctx, v.dataset.vatska);
    const b = e.target.closest('[data-utsatt],[data-avstam],[data-nll]');
    if (!b) return;
    if (b.dataset.nll) {
      try {
        const r = await medKnapp(b, () => api('/api/demo/nll-timeout', { metod: 'POST', data: b.dataset.nll === 'fel' ? { lage: 'fel' } : {} }));
        nastaOverforing = r.nastaOverforing;
        notis(nastaOverforing === 'fel' ? 'Nästa överföring till NLL får ett felsvar.' : 'Nästa överföring till NLL får inget svar i tid.', 'info');
        el.querySelector('#nll-lage').textContent = lageText();
      } catch { /* notis visad */ }
    } else if (b.dataset.utsatt) {
      const o = d.ordinationer.find(x => String(x.id) === b.dataset.utsatt);
      // Systemet kontrollerar först om läkemedlet har särskilda observationer vid utsättning (Sussa 3.5.2.8).
      let k = { varningar: [] };
      try { k = await medKnapp(b, () => api(`/api/ordination/${o.id}/utsattning`)); } catch { return; }
      const allv = k.varningar.filter(x => x.niva === 'allvarlig');
      // Antikoagulantia (runda 5): läkaren väljer en av systemets planer och bekräftar med Jag har en plan. Planen fyller
      // i orsaken, som går att ändra.
      const planer = k.planer ?? null;
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Sätt ut ${esc(o.lakemedel?.namn)}</h2>
          ${k.varningar.length ? `<div class="varningslista" role="alert"><h3>${ikon.varning}<span>Särskilda observationer vid utsättning</span></h3>
            <ul>${k.varningar.map(x => `<li><strong>${x.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(x.text)}${x.forslag ? ` <em>${esc(x.forslag)}</em>` : ''}</li>`).join('')}</ul>
            <p class="demoregel">${esc(k.anmarkning ?? 'Varningarna är demoregler, inte kliniskt beslutsstöd.')}</p></div>` : ''}
          ${planer ? `<fieldset class="ut-planer"><legend>Planen</legend>
            <div class="knapprad">${planer.map(p => `<button type="button" class="knapp sekundar liten" data-plan="${esc(p.typ)}" aria-pressed="false">${esc(p.text)}${p.ersattMed ? `: ${esc(p.ersattMed)}` : ''}</button>`).join('')}</div>
            <input type="hidden" name="plan" value="">
            <div class="falt" data-planfalt="byte" hidden><label for="ut-ersatt">Nytt medel</label><input id="ut-ersatt" name="ersattMed" maxlength="100" value="${esc(planer.find(p => p.typ === 'byte')?.ersattMed ?? '')}"></div>
            <div class="falt" data-planfalt="uppehall" hidden><label for="ut-ater">Sätts in igen</label><input id="ut-ater" name="aterinsattning" type="date" value="${esc(planer.find(p => p.typ === 'uppehall')?.aterinsattning ?? '')}"></div>
          </fieldset>` : ''}
          <p>Ordinationen raderas inte. Den flyttas till utsatta med orsak, tid och vem som satte ut den, och utsättningen skickas till NLL.</p>
          <div class="falt"><label for="ut-orsak">Orsak till utsättningen <span class="obl">(obligatoriskt${planer ? ', fylls i ur planen' : ''})</span></label><textarea id="ut-orsak" name="orsak" rows="2"${planer ? '' : ' required'} minlength="3" maxlength="300"></textarea></div>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp${allv.length ? ' knapp-allvar' : ''}" data-varde="ok">${planer ? 'Jag har en plan' : allv.length ? 'Sätt ut trots varningen' : 'Sätt ut'}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      {
        onOpen: (dl) => dl.addEventListener('click', (x) => {
          const pb = x.target.closest('[data-plan]');
          if (!pb) return;
          const p = planer.find(y => y.typ === pb.dataset.plan);
          dl.querySelector('input[name="plan"]').value = p.typ;
          const felruta = dl.querySelector('.dialog-fel');
          if (felruta) felruta.hidden = true;
          for (const b of dl.querySelectorAll('[data-plan]')) b.setAttribute('aria-pressed', String(b === pb));
          for (const f of dl.querySelectorAll('[data-planfalt]')) f.hidden = f.dataset.planfalt !== p.typ;
          const ersatt = dl.querySelector('input[name="ersattMed"]').value.trim();
          dl.querySelector('textarea[name="orsak"]').value = `${p.orsak}${p.typ === 'byte' && ersatt ? `: ${ersatt}` : ''}`;
        }),
        validera: (x) => (planer && !x.plan ? 'Välj planen för behandlingen.' : x.orsak.trim().length < 3 ? 'Ange orsaken med minst tre tecken.' : null),
      });
      if (!svar) return;
      const plan = planer ? { typ: svar.data.plan, ersattMed: svar.data.ersattMed?.trim() || null, aterinsattning: svar.data.aterinsattning || null } : undefined;
      try {
        const r = await api(`/api/ordination/${o.id}/utsatt`, { metod: 'POST', data: { orsak: svar.data.orsak.trim(), kvitteradeVarningar: allv.filter(x => !x.plan).map(x => ({ regel: x.regel })), plan } });
        nastaOverforing = null;
        notis(`${o.lakemedel?.namn} är utsatt. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        ctx.ladda();
      } catch (err) { felNotis(err); }
    } else if (b.dataset.avstam) {
      try {
        const r = await medKnapp(b, () => api(`/api/ordination/${b.dataset.avstam}/nll-avstam`, { metod: 'POST', data: {} }));
        nastaOverforing = null;
        notis(r.resultat === 'fanns_registrerad'
          ? `Avstämningen visar att NLL hade registrerat ordinationen. Kvittens ${r.kvittens}.`
          : `Ordinationen saknades i NLL och har skickats igen. ${nllResultat(r.nll)}`);
        ctx.ladda();
      } catch { /* notis visad */ }
    }
  });
}

const lageText = () => (nastaOverforing === 'fel' ? 'Nästa överföring får ett felsvar.' : nastaOverforing === 'timeout' ? 'Nästa överföring får inget svar i tid.' : 'Nästa överföring går som vanligt.');

function nllDemo() {
  return `<details class="demo-panel"><summary>Demo: simulera problem mot NLL</summary>
    <p>Att NLL inte svarar i tid får aldrig dölja en lyckad förskrivning. Simulera ett fel, ordinera sedan, och se att ordinationen ändå syns i listan med status Okänd, kontrolleras. Stäm sedan av mot NLL.</p>
    <div class="knapprad"><button type="button" class="knapp sekundar liten" data-nll="timeout">Simulera att NLL inte svarar i tid</button><button type="button" class="knapp sekundar liten" data-nll="fel">Simulera fel från NLL</button></div>
    <p class="liten" id="nll-lage" aria-live="polite">${esc(lageText())}</p>
  </details>`;
}

export function nllResultat(nll) {
  if (!nll) return '';
  if (nll.status === 'kvitterad') return `NLL kvitterade överföringen (${nll.kvittens}).`;
  if (nll.status === 'timeout') return 'NLL svarade inte i tid. Ordinationen gäller och visas i listan med status Okänd, kontrolleras. Stäm av mot NLL.';
  if (nll.status === 'fel') return 'NLL svarade med fel. Ordinationen visas i listan med status Fel från NLL. Stäm av för att skicka den igen.';
  return '';
}

function tabell(rader, kanOrdinera, aktuella) {
  if (!rader.length) return '<p class="tom liten">Inga.</p>';
  return `<div class="tabellrulle"><table class="tabell lm-tabell">
    <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Typ</th><th scope="col">Ordinationsorsak</th><th scope="col">${aktuella ? 'Uppföljning' : 'Utsatt'}</th><th scope="col">NLL</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
    <tbody>${rader.map(o => `<tr>
      <td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)} ${esc(o.lakemedel?.form)}</span> ${lms.taggar(o)}
        <span class="under-text">ATC ${esc(o.lakemedel?.atc)}, ordinerat ${esc(datum(o.start))} av ${esc(o.ordineradAv?.namn ?? '')}, ${esc(o.vardenhet?.namn ?? '')}</span>${migreradEtikett(o)}
        ${o.kvitteradeVarningar?.length ? `<span class="under-text">Kvitterade varningar: ${o.kvitteradeVarningar.map(k => `${esc(k.regel)} (${esc(k.motivering)})`).join('; ')}</span>` : ''}</td>
      <td>${esc(o.dosering)}${lms.underDosering(o)}${o.tider?.length ? `<span class="under-text">Kl. ${esc(o.tider.join(', '))}</span>` : ''}${o.administrationssattText ? `<span class="under-text">${esc(o.administrationssattText)}</span>` : ''}${o.vardhandelse ? `<span class="under-text">Inför ${esc(o.vardhandelse.text.toLowerCase())}${o.vardhandelse.administreras ? `, ges ${esc(tidpunkt(o.vardhandelse.administreras))}` : ', väntar på tid'}${o.vardhandelse.foljerTidbok ? '. Tiden följer tidboken' : ''}</span>${o.vardhandelse.forklaring ? `<span class="under-text">${esc(o.vardhandelse.forklaring)}</span>` : ''}` : ''}</td>
      <td>${esc(ORDTYP[o.typ] ?? o.typ)}</td>
      <td>${esc(o.ordinationsorsak)}</td>
      <td>${aktuella ? `${esc(datum(o.aktuelltUppfoljningsdatum ?? o.uppfoljningsdatum))}${o.slut ? `<span class="under-text">Slut ${esc(datum(o.slut))}</span>` : ''}` : (o.utsatt ? `${esc(datum(o.utsatt.tid))}<span class="under-text">${esc(o.utsatt.orsak ?? '')}, ${esc(o.utsatt.av ?? '')}</span>${o.utsatt.plan ? `<span class="under-text ut-plan">Plan: ${esc(o.utsatt.plan.text)}</span>` : ''}` : `Slut ${esc(datum(o.slut))}`)}</td>
      <td>${nllChip(o.nll_status)}</td>
      <td class="atgarder">
        ${kanOrdinera && ['okand_kontrolleras', 'fel'].includes(o.nll_status) ? `<button type="button" class="knapp liten" data-avstam="${o.id}">Stäm av mot NLL</button>` : ''}
        ${kanOrdinera && o.status === 'aktiv' ? `<button type="button" class="knapp liten sekundar" data-utsatt="${o.id}">Sätt ut</button>` : ''}
        ${o.muntlig && !o.muntlig.signerad && o.muntlig.lakare.id === S.session?.personal?.id ? `<button type="button" class="knapp liten" data-signera-muntlig="${o.id}">Signera</button>` : ''}
        ${aktuella && o.status === 'aktiv' && far('utvardera_lakemedel') ? `<button type="button" class="knapp liten sekundar" data-utvardera="${o.id}">Utvärdera</button>` : ''}
        <details class="historik"><summary>Historik</summary><ol>${(o.historik ?? []).map(h => `<li><time>${esc(tidpunkt(h.tid))}</time> ${esc(h.handelse)}${h.detalj ? `: ${esc(h.detalj)}` : ''}${h.av ? ` <span class="dampad">(${esc(h.av)})</span>` : ''}</li>`).join('')}</ol></details>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

// tidigare: en utsatt ordination som ska sättas in igen efter ett uppehåll (runda 5, r4). Formuläret fylls i ur den.
// muntlig (runda 6, r2): sjuksköterskan dokumenterar en muntlig ordination med läkarens namn, hur den lämnades och
// varför behandlingen inte kan vänta (HSLF-FS 2017:37 6 kap. 13 och 15 §§). Läkaren signerar den sedan.
function ordinationsForm(plats, ctx, tidigare = null, { muntlig = false } = {}) {
  const i = idag();
  plats.innerHTML = `<form class="ordform" id="ordform" novalidate aria-labelledby="ord-rubrik">
    <h3 id="ord-rubrik" tabindex="-1">${muntlig ? 'Muntlig ordination' : tidigare ? `Sätt in ${esc(tidigare.lakemedel?.namn ?? 'läkemedlet')} igen` : 'Ny ordination'}</h3>
    ${muntlig ? `<p class="forslag-varfor">En muntlig ordination får bara lämnas när patienten behöver omedelbar behandling. Dosen får ges direkt och de första två timmarna, och läkaren signerar sedan ordinationen i sin inkorg. Först då skickas den till NLL.</p>
    <div class="falt-rad" data-muntlig-falt><div class="falt"><label for="m-lak">Läkaren som ordinerade</label><select id="m-lak" name="lakareId"></select></div>
      <div class="falt"><label for="m-satt">Lämnades</label><select id="m-satt" name="satt"><option value="telefon">Per telefon</option><option value="muntligt">Muntligt på plats</option></select></div>
      <div class="falt bred"><label for="m-omed">Varför behandlingen inte kan vänta <span class="obl">(obligatoriskt)</span></label><input id="m-omed" name="omedelbar" maxlength="300"></div></div>` : ''}
    ${tidigare ? `<p class="forslag-varfor">Systemet har fyllt i ordinationen ur den som gjorde uppehåll (${esc(tidigare.utsatt.plan.text)}). Ändra det som inte stämmer.</p>` : ''}
    <div data-kontakt-plats></div>
    <div class="falt lm-sok"><label for="lm-sok">Läkemedel <span class="obl">(obligatoriskt)</span></label>
      <input id="lm-sok" type="search" autocomplete="off" placeholder="Sök på namn, substans eller ATC-kod" aria-describedby="lm-valt" aria-controls="lm-traffar">
      <input type="hidden" name="lakemedelId">
      <ul class="lm-traffar" id="lm-traffar" aria-label="Träffar i läkemedelskatalogen"></ul>
      <p class="hjalp" id="lm-valt" aria-live="polite">Inget läkemedel valt.</p>
    </div>
    <div class="falt-rad">
      <div class="falt bred"><label for="o-dosering">Dosering <span class="obl">(obligatoriskt)</span></label><input id="o-dosering" name="dosering" required maxlength="300" placeholder="Till exempel 1 tablett morgon och kväll"></div>
      <div class="falt smal"><label for="o-dos">Dos</label><input id="o-dos" name="dos" inputmode="decimal"></div>
      <div class="falt smal"><label for="o-dosenhet">Enhet</label><input id="o-dosenhet" name="dosEnhet" placeholder="mg"></div>
      <div class="falt smal"><label for="o-tider">Tider</label><input id="o-tider" name="tider" placeholder="08, 20"></div>
    </div>
    <div class="falt-rad">
      <div class="falt"><label for="o-typ">Typ</label><select id="o-typ" name="typ"><option value="staende">Stående</option><option value="vid_behov">Vid behov</option><option value="tillfallig">Tillfällig</option></select></div>
      <div class="falt"><label for="o-satt">Administrationssätt</label><select id="o-satt" name="administrationssatt">${Object.entries(SATT).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
      <div class="falt bred"><label for="o-orsak">Ordinationsorsak <span class="obl">(obligatoriskt)</span></label><input id="o-orsak" name="ordinationsorsak" required maxlength="300"></div>
    </div>
    <input type="hidden" name="mall"><input type="hidden" name="volymMl">
    <div data-r6-tillagg></div>
    <p class="forslag-varfor" id="o-forslag" aria-live="polite" hidden></p>
    <details class="o-handelse"${muntlig ? ' hidden' : ''}><summary>Ges inför en planerad vårdhändelse</summary>
      <input type="hidden" name="vhVal">
      <div class="vh-val" data-vh-val aria-live="polite"><p class="hjalp">Hämtar patientens bokningar.</p></div>
      <div class="falt-rad">
        <div class="falt bred" data-vh-ny hidden><label for="o-vh">Ny vårdhändelse</label><input id="o-vh" name="vardhandelse" maxlength="120" placeholder="Till exempel elkonvertering"></div>
        <div class="falt smal"><label for="o-vh-t">Timmar före</label><input id="o-vh-t" name="forskjutning" inputmode="decimal" value="1"></div>
      </div>
      <p class="hjalp">Ordinationen får inga fasta tider. Tiden kommer från tidboken: när vårdhändelsen bokas, bokas om eller avbokas räknar systemet om när läkemedlet ska ges.</p>
    </details>
    <div class="falt-rad">
      <div class="falt"><label for="o-upp">Uppföljningsdatum <span class="obl">(obligatoriskt)</span></label><input id="o-upp" name="uppfoljningsdatum" type="date" required min="${i}" value=""></div>
      <div class="falt"><label for="o-start">Startdatum</label><input id="o-start" name="start" type="date" value="${i}"></div>
      <div class="falt"><label for="o-slut">Slutdatum</label><input id="o-slut" name="slut" type="date"></div>
    </div>
    <p class="hjalp">Ordinationsorsak och uppföljningsdatum krävs av Nationella läkemedelslistan. Förslag på uppföljning: <button type="button" class="lanknapp" data-upp="14">om två veckor</button>, <button type="button" class="lanknapp" data-upp="90">om tre månader</button>.</p>
    <div id="varningar"></div>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp" data-spara>Kontrollera och spara</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  const kontakt = kontaktRad(form.querySelector('[data-kontakt-plats]'), ctx);
  // Runda 6, r2: läkarna på vårdenheten, med den som ansvarar för patienten först.
  if (muntlig) api(`/api/patient/${encodeURIComponent(ctx.id)}/muntlig-ordination`).then(m => { form.lakareId.innerHTML = m.lakare.map(l => `<option value="${esc(l.id)}">${esc(l.namn)}, ${esc(l.titel)}</option>`).join(''); }).catch(() => {});
  const sok = form.querySelector('#lm-sok');
  // Fokus i sökfältet, så att det går att börja skriva läkemedlets namn direkt.
  sok.focus();
  const traffar = form.querySelector('#lm-traffar');
  let timer = null;
  let kontrollerad = null;
  // Runda 5 (r3): varningarna som visas. En ny kontroll med samma varningar ritar inte om dem, så att en motivering som
  // redan är skriven finns kvar när systemets förslag på dos kommer efter den första kontrollen.
  let visadeVarningar = null;
  // Fält som förskrivaren har ändrat sedan läkemedlet valdes.
  const rorda = new Set();
  form.addEventListener('input', (e) => { if (e.target.name) rorda.add(e.target.name); });
  form.addEventListener('change', (e) => { if (e.target.name) rorda.add(e.target.name); });
  sok.addEventListener('input', () => {
    clearTimeout(timer);
    const v = sok.value.trim();
    if (v.length < 2) { traffar.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const lista = await api(`/api/lakemedel/katalog?q=${encodeURIComponent(v)}`);
        traffar.innerHTML = lista.length ? lista.slice(0, 8).map(l => `<li><button type="button" data-lm="${esc(l.id)}" data-namn="${esc(`${l.namn} ${l.styrka} ${l.form}`)}"><strong>${esc(l.namn)}</strong> ${esc(l.styrka)} ${esc(l.form)} <span class="dampad">${esc(l.substans)}, ATC ${esc(l.atc)}</span></button></li>`).join('') : '<li class="tom liten">Inget läkemedel i katalogen matchar.</li>';
      } catch (e) { felNotis(e); }
    }, 180);
  });
  traffar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lm]');
    if (b) valj(b.dataset);
  });
  async function valj(b, efter = null) {
    form.lakemedelId.value = b.lm;
    form.querySelector('#lm-valt').textContent = `Valt: ${b.namn}`;
    sok.value = b.namn;
    traffar.innerHTML = '';
    kontrollerad = null;
    form.querySelector('#varningar').innerHTML = '';
    visadeVarningar = null;
    rorda.clear();
    form.dosering.focus();
    // Fördefinierad ordination (Sussa 3.5.1.3): systemet föreslår dos, administrationssätt, tider och uppföljning ur
    // produkten och patienten. Förskrivaren ändrar bara det som avviker.
    try {
      const f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel/forslag?lakemedelId=${encodeURIComponent(b.lm)}`);
      if (form.lakemedelId.value !== b.lm) return;
      // Ett fält som förskrivaren redan har ändrat medan förslaget hämtades skrivs inte över.
      const satt = (namn, v) => { if (!rorda.has(namn) && v != null && v !== '') form[namn].value = v; };
      satt('dosering', f.dosering);
      satt('dos', f.dos);
      satt('dosEnhet', f.dosEnhet);
      satt('tider', (f.tider ?? []).join(', '));
      satt('typ', f.typ);
      satt('administrationssatt', f.administrationssatt);
      // Bara administrationssätt som passar läkemedelsformen går att välja (säkerhetsgranskningen av runda 5).
      if (f.tillatnaAdministrationssatt) for (const o of form.administrationssatt.options) o.hidden = o.disabled = !f.tillatnaAdministrationssatt.includes(o.value);
      satt('uppfoljningsdatum', f.uppfoljningsdatum);
      form.mall.value = f.mall ?? '';
      form.volymMl.value = f.volymMl ?? '';
      // Runda 6, r2: förpackning, spädning och trappschema ur förslaget.
      form.querySelector('[data-r6-tillagg]').innerHTML = r6Tillagg(f);
      const fv = form.querySelector('#o-forslag');
      fv.textContent = `Förslag ur ${f.mallnamn ? `mallen ${f.mallnamn}` : 'produktens styrka och form'}. ${f.varfor.filter(x => !x.startsWith('Mallen')).join(' ')} ${f.anmarkning}`.replace(/\s+/g, ' ').trim();
      fv.hidden = false;
      if (!rorda.size) (f.dosering ? form.ordinationsorsak : form.dosering).focus();
    } catch { if (!rorda.size) form.dosering.focus(); }
    efter?.();
  }
  // Återinsättning: läkemedlet och allt som den tidigare ordinationen hade, efter systemets förslag ur mallen. Ett
  // uppföljningsdatum som redan har passerat ersätts av förslaget.
  if (tidigare?.lakemedel) {
    const t = tidigare;
    valj({ lm: t.lakemedel.id, namn: `${t.lakemedel.namn} ${t.lakemedel.styrka} ${t.lakemedel.form}` }, () => {
      const satt = (namn, v) => { if (v != null && v !== '') form[namn].value = v; };
      satt('dosering', t.dosering);
      satt('dos', t.dos);
      satt('dosEnhet', t.dosEnhet);
      satt('tider', (t.tider ?? []).join(', '));
      satt('typ', t.typ);
      if (t.administrationssatt) satt('administrationssatt', t.administrationssatt);
      satt('ordinationsorsak', t.ordinationsorsak);
      if (t.uppfoljningsdatum >= i) satt('uppfoljningsdatum', t.uppfoljningsdatum);
      if (!form.uppfoljningsdatum.value) form.uppfoljningsdatum.value = plusDagar(i, 30);
      form.querySelector('[data-spara]').focus();
    });
  }
  form.addEventListener('click', (e) => {
    const u = e.target.closest('[data-upp]');
    if (u) { form.uppfoljningsdatum.value = plusDagar(form.start.value || i, Number(u.dataset.upp)); rorda.add('uppfoljningsdatum'); }
    if (e.target.closest('[data-stang]')) { plats.innerHTML = ''; plats.closest('.flikinnehall')?.querySelector('[data-ny]')?.setAttribute('aria-expanded', 'false'); }
  });
  form.addEventListener('input', (e) => { if (!e.target.closest('#varningar') && e.target !== sok) kontrollerad = null; });
  // Planerad vårdhändelse (Sussa 3.5.2.7): systemet föreslår patientens bokningar på vårdenheten, med den som passar
  // ordinationsorsaken först, och läkaren väljer med ett klick. Utan bokning sätter systemet upp vårdhändelsen på
  // väntelistan.
  form.querySelector('.o-handelse').addEventListener('toggle', (e) => {
    // Tiden kommer från vårdhändelsen, så ordinationen får inga fasta tider.
    form.tider.disabled = e.target.open;
    kontrollerad = null;
    if (e.target.open) vardhandelseVal(form, ctx, () => { kontrollerad = null; });
  });

  const data = () => ({
    lakemedelId: form.lakemedelId.value, dosering: form.dosering.value.trim(),
    dos: form.dos.value.trim() ? Number(form.dos.value.replace(',', '.')) : null, dosEnhet: form.dosEnhet.value.trim() || null,
    tider: form.tider.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean), typ: form.typ.value, vidBehov: form.typ.value === 'vid_behov',
    ordinationsorsak: form.ordinationsorsak.value.trim(), uppfoljningsdatum: form.uppfoljningsdatum.value, start: form.start.value || i, slut: form.slut.value || null,
    administrationssatt: form.administrationssatt.value, mall: form.mall.value || null, volymMl: form.volymMl.value ? Number(form.volymMl.value) : null,
    ...vardhandelseData(form),
    ...r6Data(form),
  });
  const NAMN = { lakemedelId: 'lakemedelId', dosering: 'dosering', dos: 'dos', typ: 'typ', ordinationsorsak: 'ordinationsorsak', uppfoljningsdatum: 'uppfoljningsdatum', start: 'start', slut: 'slut' };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('[data-spara]');
    const o = data();
    if (!o.lakemedelId) { faltFel(form, { message: 'Välj ett läkemedel i katalogen.', data: {} }); sok.focus(); return; }
    try {
      await medKnapp(knapp, async () => {
        // Första steget: kontroll. Varningar visas och allvarliga måste kvitteras med motivering.
        const nyckel = JSON.stringify(o);
        // En muntlig ordination kontrolleras när den sparas, och varningarna visas då (runda 6, r2).
        if (muntlig) {
          const kv = [...form.querySelectorAll('[data-motivering]')].map(t => ({ regel: t.dataset.motivering, motivering: t.value.trim() }));
          const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/muntlig-ordination`, { metod: 'POST', data: { ...o, kvitteradeVarningar: kv, lakareId: form.lakareId.value, satt: form.satt.value, omedelbar: form.omedelbar.value.trim(), ...nyKontaktData(kontakt) } });
          notis(`Den muntliga ordinationen av ${r.ordination.lakemedel?.namn} är dokumenterad. ${r.ordination.muntlig?.lakare?.namn ?? 'Läkaren'} signerar den i sin inkorg.`);
          ctx.ladda();
          return;
        }
        if (kontrollerad !== nyckel) {
          const k = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel/kontroll`, { metod: 'POST', data: o });
          kontrollerad = nyckel;
          const varningar = k.varningar.length ? JSON.stringify(k.varningar.map(v => [v.regel, v.niva, v.text])) : null;
          if (!varningar) form.querySelector('#varningar').innerHTML = '';
          if (varningar && varningar !== visadeVarningar) { visadeVarningar = varningar; visaVarningar(form, k); knapp.textContent = 'Spara ordinationen'; return; }
          visadeVarningar = varningar;
        }
        const kv = [...form.querySelectorAll('[data-motivering]')].map(t => ({ regel: t.dataset.motivering, motivering: t.value.trim() }));
        const saknas = kv.filter(k => k.motivering.length < 3);
        if (saknas.length) {
          const t = form.querySelector(`[data-motivering="${saknas[0].regel}"]`);
          t.setAttribute('aria-invalid', 'true'); t.focus();
          throw Object.assign(new Error('Allvarliga varningar måste kvitteras med en motivering innan ordinationen sparas.'), { status: 400, data: {} });
        }
        const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel`, { metod: 'POST', data: { ...o, kvitteradeVarningar: kv, ...nyKontaktData(kontakt) } });
        nastaOverforing = null;
        notis(`${r.ordination.lakemedel?.namn} är ordinerat. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        kontaktNotis(r);
        ctx.ladda();
      }, form);
    } catch (err) {
      if (err.status === 400 && err.data?.varningar) { visaVarningar(form, err.data); }
      else if (err.status === 400) faltFel(form, err, NAMN);
    }
  });
}

// Runda 6, r2: förpackningen i NPL, spädningen och trappschemat som systemet föreslår för produkten.
function r6Tillagg(f) {
  const ut = [];
  if (f.produkttyp && f.produkttyp.typ !== 'godkand') ut.push(`<p class="ruta ruta-info liten">${ikon.info}<span>${esc(f.produkttyp.typText)}. ${esc(f.produkttyp.beskrivning ?? '')}</span></p>`);
  if (f.forpackningar?.length) ut.push(`<div class="falt"><label for="o-fp">Förpackning</label><select id="o-fp" name="forpackning">${f.forpackningar.map(p => `<option value="${esc(p.nplpackid)}">${esc(p.text)}${p.forval ? ' (förval)' : ''}</option>`).join('')}</select><p class="hjalp">NPL-pack-id följer med överföringen till NLL.</p></div>`);
  if (f.spadning) {
    const s = f.spadning;
    ut.push(`<fieldset class="o-spadning"><legend>${s.basvatska ? 'Infusion' : 'Spädning'}, föreslagen av systemet</legend><div class="falt-rad">
      ${s.basvatska ? '' : `<div class="falt"><label for="o-sp-l">Späds i</label><select id="o-sp-l" name="spLosning">${s.losningar.map(l => `<option>${esc(l)}</option>`).join('')}</select></div>`}
      <div class="falt smal"><label for="o-sp-v">Volym ml</label><input id="o-sp-v" name="spVolym" inputmode="decimal" value="${esc(String(s.volymMl).replace('.', ','))}"></div>
      <div class="falt smal"><label for="o-sp-t">Minuter</label><input id="o-sp-t" name="spTid" inputmode="numeric" value="${esc(s.tidMin ?? '')}"></div>
      ${s.basvatska ? '<div class="falt smal"><label for="o-sp-k">Kaliumklorid mmol</label><input id="o-sp-k" name="spKalium" inputmode="decimal"></div>' : ''}</div>
      <p class="hjalp">Systemet räknar koncentration och hastighet och visar dem vid iordningsställandet.</p></fieldset>`);
  }
  if (f.trappning) {
    const t = f.trappning;
    ut.push(`<details class="o-trappning"><summary>${t.riktning === 'ned' ? 'Nedtrappning' : 'Upptrappning'} enligt schema</summary>
      <p class="hjalp">${esc(t.varfor ?? '')} Förslag: ${esc(t.dosering)}</p><input type="hidden" name="trRiktning" value="${esc(t.riktning)}"><div class="falt-rad">
      <div class="falt smal"><label for="o-tr-s">Startdos mg</label><input id="o-tr-s" name="trStart" inputmode="decimal" value="${esc(t.steg[0].dos)}"></div>
      <div class="falt smal"><label for="o-tr-d">Ändring mg</label><input id="o-tr-d" name="trSteg" inputmode="decimal" value="${esc(Math.abs((t.steg[1]?.dos ?? t.steg[0].dos) - t.steg[0].dos))}"></div>
      <div class="falt smal"><label for="o-tr-n">Dagar per steg</label><input id="o-tr-n" name="trDagar" inputmode="numeric" value="${esc(t.steg[1] ? Math.round((Date.parse(t.steg[1].fran) - Date.parse(t.steg[0].fran)) / 86400000) : 7)}"></div>
      <div class="falt smal"><label for="o-tr-e">Slutdos mg</label><input id="o-tr-e" name="trSlut" inputmode="decimal" value="${esc(t.steg.at(-1).dos)}"></div></div>
      <p class="hjalp">Doseringen, dosen per dag och slutdatumet räknas fram av systemet och visas i Läkemedel att ge.</p></details>`);
  }
  return ut.join('');
}
function r6Data(form) {
  const n = (v) => Number(String(v ?? '').replace(',', '.'));
  const ut = {};
  if (form.forpackning?.value) ut.forpackning = form.forpackning.value;
  if (form.spVolym) {
    ut.spadning = { losning: form.spLosning?.value, volymMl: n(form.spVolym.value), tidMin: form.spTid.value ? n(form.spTid.value) : null,
      tillsatser: form.spKalium?.value ? [{ lakemedelId: 'VK-EGEN-0001', mangd: n(form.spKalium.value) }] : [] };
  }
  if (form.querySelector('.o-trappning')?.open) ut.trappning = { riktning: form.trRiktning.value, startdos: n(form.trStart.value), steg: n(form.trSteg.value), dagar: n(form.trDagar.value), slutdos: n(form.trSlut.value) };
  return ut;
}

// Vårdhändelsen som läkaren har valt: en bokning, en post på väntelistan eller en ny vårdhändelse.
function vardhandelseData(form) {
  if (!form.querySelector('.o-handelse').open) return {};
  const val = form.vhVal.value;
  const forskjutningTimmar = -Number(form.forskjutning.value.replace(',', '.') || 0);
  if (val.startsWith('bokning:')) return { vardhandelse: { bokningId: Number(val.slice(8)), forskjutningTimmar }, tider: [] };
  if (val.startsWith('post:')) return { vardhandelse: { vantelistaId: Number(val.slice(5)), forskjutningTimmar }, tider: [] };
  if (val === 'ny') return { vardhandelse: { text: form.vardhandelse.value.trim(), forskjutningTimmar }, tider: [] };
  return {};
}

async function vardhandelseVal(form, ctx, andrad) {
  const ruta = form.querySelector('[data-vh-val]');
  if (ruta.dataset.hamtad) return;
  let f;
  try { f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardhandelse/forslag?text=${encodeURIComponent(form.ordinationsorsak.value.trim())}`); } catch (e) { ruta.innerHTML = `<p class="dampad liten">${esc(e.message)}</p>`; return; }
  ruta.dataset.hamtad = '1';
  const val = [
    ...f.bokningar.map(b => ({ v: `bokning:${b.id}`, rek: b.rekommenderad, text: `${b.text}, ${tidpunkt(b.start)}`, under: `Bokad ${b.tidstypText.toLowerCase()}${b.vardgivare ? ` hos ${b.vardgivare}` : ''}` })),
    ...f.vantelista.map(p => ({ v: `post:${p.id}`, rek: p.rekommenderad, text: p.text, under: `På väntelistan, ${(p.tidstypText ?? '').toLowerCase()} hos ${p.yrkesrollText}, väntar på tid` })),
    { v: 'ny', rek: false, text: 'Ny vårdhändelse', under: f.ny.text },
  ];
  const forval = val.find(x => x.rek)?.v ?? 'ny';
  ruta.innerHTML = `<p class="etikett" id="vh-rubrik">Vårdhändelse</p>
    <div class="knappval-lista vh-lista" role="group" aria-labelledby="vh-rubrik">${val.map(x => `<button type="button" class="knapp sekundar liten" data-vh="${esc(x.v)}" aria-pressed="false"><span>${esc(x.text)}${x.rek ? ' <span class="tagg">Föreslås</span>' : ''}</span><span class="under-text">${esc(x.under)}</span></button>`).join('')}</div>
    <p class="hjalp">${esc(f.hjalp)}</p>`;
  const valj = (v) => {
    form.vhVal.value = v;
    for (const b of ruta.querySelectorAll('[data-vh]')) b.setAttribute('aria-pressed', String(b.dataset.vh === v));
    form.querySelector('[data-vh-ny]').hidden = v !== 'ny';
    andrad();
  };
  ruta.addEventListener('click', (e) => { const b = e.target.closest('[data-vh]'); if (b) { valj(b.dataset.vh); if (b.dataset.vh === 'ny') form.vardhandelse.focus(); } });
  valj(forval);
}

function visaVarningar(form, k) {
  const allv = k.varningar.filter(v => v.niva === 'allvarlig');
  const obs = k.varningar.filter(v => v.niva !== 'allvarlig');
  const regler = [...new Set(allv.map(v => v.regel))];
  const ut = form.querySelector('#varningar');
  ut.innerHTML = `<div class="varningslista" role="alert">
    <h4>${ikon.varning}<span>${k.varningar.length === 1 ? 'En varning' : `${k.varningar.length} varningar`} före sparande</span></h4>
    ${allv.length ? `<ul class="varn-allvarlig">${allv.map(v => `<li><strong>Allvarlig.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${obs.length ? `<ul class="varn-observera">${obs.map(v => `<li><strong>Observera.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${regler.map((r, n) => `<div class="falt"><label for="kv-${n}">Motivering för att ordinera trots varningen (${esc(r.replace(/_/g, ' '))}) <span class="obl">(obligatoriskt)</span></label><textarea id="kv-${n}" rows="2" data-motivering="${esc(r)}" maxlength="500"></textarea></div>`).join('')}
    <p class="demoregel">${esc(k.anmarkning ?? 'Varningarna är demoregler, inte kliniskt beslutsstöd.')}</p>
  </div>`;
  ut.querySelector('textarea')?.focus();
}

// Vidimering (Sussa 3.5.2.9): vad som har ändrats sedan den senaste vidimeringen, och hela listan vidimeras med ett klick.
function vidimeringPanel(v) {
  const rad = (o) => `<li>${o.andring === 'utsatt' ? 'Utsatt' : o.andring === 'andrad' ? 'Ändrad' : 'Ny'}: <strong>${esc(o.lakemedel?.namn)}</strong> ${esc(o.dosering)}
    <span class="dampad">${o.andring === 'utsatt' ? `${esc(tidpunkt(o.utsatt?.tid))}${o.utsatt?.av ? ` av ${esc(o.utsatt.av)}` : ''}, ${esc(o.utsatt?.orsak ?? '')}` : `${esc(tidpunkt(o.skapad))} av ${esc(o.ordineradAv?.namn ?? '')}, ${esc(o.vardenhet?.namn ?? '')}`}</span></li>`;
  const andr = [...v.andringar.nya, ...v.andringar.utsatta];
  return `<section class="vidimering${v.behovs ? ' behovs' : ''}" aria-labelledby="vid-rubrik">
    <h3 id="vid-rubrik">Vidimering av pågående ordinationer</h3>
    <p>${esc(v.text)}</p>
    ${andr.length ? `<ul>${andr.map(rad).join('')}</ul>` : ''}
    ${v.behovs && v.kan?.kan ? '<button type="button" class="knapp" data-vidimera>Vidimera listan</button>' : ''}
    ${v.kan?.varfor ? `<p class="dampad liten">${esc(v.kan.varfor)}</p>` : ''}
    ${v.dolda?.sparrade ? '<p class="dampad liten">Ordinationer från spärrade vårdenheter ingår inte i vidimeringen.</p>' : ''}
  </section>`;
}

async function registreraVatska(ctx, riktning) {
  const typer = riktning === 'in' ? [['dryck', 'Dryck'], ['mat', 'Mat och sondnäring'], ['infusion', 'Infusion']] : [['urin', 'Urin'], ['dran', 'Dränage'], ['krakning', 'Kräkning'], ['avforing', 'Avföring']];
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${riktning === 'in' ? 'Registrera intag' : 'Registrera förlust'}</h2>
    <div class="falt-rad"><div class="falt"><label for="vb-typ">Typ</label><select id="vb-typ" name="typ">${typer.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
    <div class="falt"><label for="vb-ml">Volym i ml <span class="obl">(obligatoriskt)</span></label><input id="vb-ml" name="volymMl" inputmode="numeric" required></div>
    ${riktning === 'in' ? '<div class="falt"><label for="vb-kcal">Kalorier (kcal)</label><input id="vb-kcal" name="kcal" inputmode="numeric"></div>' : ''}</div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (!(Number(x.volymMl.replace(',', '.')) > 0) ? 'Ange volymen i ml.' : null) });
  if (!svar) return;
  try {
    await api(`/api/patient/${encodeURIComponent(ctx.id)}/vatskebalans`, { metod: 'POST', data: { riktning, typ: svar.data.typ, volymMl: Number(svar.data.volymMl.replace(',', '.')), ...(svar.data.kcal?.trim() ? { kcal: Number(svar.data.kcal.replace(',', '.')) } : {}) } });
    notis('Vätskebalansen är registrerad.');
    ctx.ladda();
  } catch (e) { felNotis(e); }
}

// Läkemedelsgenomgång (Sussa 3.5.1.6, 3.5.1.11). Systemet tar fram fynden och läkemedelsberättelsen, läkaren läser,
// kompletterar och sparar.
async function genomgang(ctx) {
  let g;
  try { g = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedelsgenomgang`); } catch (e) { felNotis(e); return; }
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Läkemedelsgenomgång</h2>
    <h3>Pågående läkemedel och indikation</h3>
    <ul class="liten">${g.ordinationer.map(o => `<li><strong>${esc(o.lakemedel?.namn)}</strong> ${esc(o.dosering)}. ${esc(o.ordinationsorsak)}</li>`).join('')}</ul>
    <h3>Systemets fynd</h3>
    ${g.fynd.length ? `<ul class="genomgang-fynd">${g.fynd.map(f => `<li><strong>${f.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(f.text)}</li>`).join('')}</ul>` : '<p class="liten">Systemet hittade inget att påpeka.</p>'}
    <p class="demoregel">${esc(g.anmarkning)}</p>
    <div class="falt"><label for="lg-ber">Läkemedelsberättelse, framtagen av systemet</label><textarea id="lg-ber" name="berattelse" rows="8" maxlength="4000">${esc(g.berattelse.text)}</textarea></div>
    <div class="falt"><label for="lg-bed">Bedömning</label><textarea id="lg-bed" name="bedomning" rows="2" maxlength="2000"></textarea></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara genomgången</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedelsgenomgang`, { metod: 'POST', data: { berattelse: svar.data.berattelse, bedomning: svar.data.bedomning } });
    notis('Läkemedelsgenomgången är sparad.');
    ctx.ladda();
  } catch (e) { felNotis(e); }
}
