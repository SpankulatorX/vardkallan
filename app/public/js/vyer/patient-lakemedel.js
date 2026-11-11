// Läkemedelslistan: ordinationer med NLL-status, ordination med obligatoriska fält och varningar, utsättning och avstämning mot NLL.
// Runda 10, r5: kunskapsstödet vid varningarna och läkemedelsinformationen (Sussa 3.5.1.5).
import * as kunskap from '../kunskapsstod-ui.js';
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
// Runda 9, r1: förbrukningsartiklar.
import * as forbrukning from './forbrukning.js';

let nastaOverforing = null;
// Vätskebalansens val (dygnsbrytning, filter och sortering) gäller tills sidan laddas om (runda 6, r2).
const vbVal = {};
let vbParam = '';
const SATT = { peroralt: 'Peroralt', subkutant: 'Subkutant', intravenost: 'Intravenöst', inhalation: 'Inhalation', sublingualt: 'Under tungan', intramuskulart: 'Intramuskulärt',
  // Runda 8, r4: administrationssätten för ögon, öron, näsa, hud, ändtarm och slida (ordinationsmallar.js).
  sond: 'Via sond', okulart: 'I ögat', aurikulart: 'I örat', nasalt: 'I näsan', kutant: 'På huden', transdermalt: 'Plåster på huden', rektalt: 'Rektalt', vaginalt: 'Vaginalt' };

// Delar som inte finns i läskopian under ett avbrott (vidimering och vätskebalans) visas inte då.
const kanske = (p) => p.catch(() => null);

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const [d, adm, vid, vb, dir, dygn, fg, fb, lb, kp] = await Promise.all([
    api(`/api/patient/${pid}/lakemedel`),
    kanske(api(`/api/patient/${pid}/administreringar`)),
    far('ordinera') ? kanske(api(`/api/patient/${pid}/vidimering`)) : null,
    far('las_matvarden') ? kanske(api(`/api/patient/${pid}/vatskebalans${vbParam}`)) : null,
    // Runda 6, r2: generella direktiv, dosering över flera dygn och fördjupad läkemedelsgenomgång.
    far('ordinera_direktiv') ? kanske(api(`/api/patient/${pid}/direktiv`)) : null,
    kanske(api(`/api/patient/${pid}/doseringsoversikt`)),
    kanske(api(`/api/patient/${pid}/fordjupad-genomgang`)),
    // Runda 9, r1: förbrukningsartiklar, beställningar och klinisk prövning.
    kanske(forbrukning.hamta(ctx.id)),
    kanske(api(`/api/patient/${pid}/lakemedelsbestallningar`)),
    far('las_oversikt') ? kanske(api(`/api/patient/${pid}/provningar`)) : null,
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
    <div id="lm-fb-plats"></div>
    <div id="lm-lb-plats"></div>
    <div id="lm-kp-plats"></div>
    <div id="lm-ov-plats"></div>
    ${lms.direktivSektion(dir)}
    ${adm && (adm.doser.length || adm.vidBehov.length || adm.utanTider.length || adm.vantarPaHandelse.length || adm.kommandeHandelser?.length || adm.egenadministrering?.length) ? `<section class="lm-sektion" aria-labelledby="lm-adm" id="lm-adm-sektion"><h3 id="lm-adm">Dagens administreringar</h3>${administrering.patientDoser(ctx.id, adm)}</section>` : ''}
    ${kanOrdinera && vid?.kan?.kan ? '<section class="lm-sektion" aria-labelledby="lm-genomgang"><h3 id="lm-genomgang">Läkemedelsgenomgång</h3><p class="liten">Systemet tar fram indikation, dubbelmedicinering, interaktioner, passerade uppföljningar och en läkemedelsberättelse ur historiken.</p><button type="button" class="knapp sekundar" data-genomgang>Gör läkemedelsgenomgång</button></section>' : ''}
    ${lms.doseringsSektion(dygn)}
    ${lms.fordjupadSektion(fg)}
    <div id="lm-vb-plats">${vb ? lms.vatskeSektion(vb) : ''}</div>
    ${ovriga.length ? `<section aria-labelledby="lm-utsatt"><h3 id="lm-utsatt">Utsatta och avslutade <span class="antal">${ovriga.length}</span></h3>${tabell(ovriga, kanOrdinera, false)}</section>` : ''}`;
  if (adm) administrering.koppla(el.querySelector('#lm-adm-sektion') ?? document.createElement('div'), () => ctx.ladda());
  // Runda 9, r1: förbrukningsartiklarna, beställningarna och den kliniska prövningen.
  if (fb) forbrukning.visa(el.querySelector('#lm-fb-plats'), ctx.id, fb);
  if (lb) forbrukning.visaBestallningar(el.querySelector('#lm-lb-plats'), ctx.id, lb);
  if (kp) forbrukning.visaProvningar(el.querySelector('#lm-kp-plats'), ctx.id, kp);
  // Runda 10, r5: läkemedelsberättelsen och läkemedelslistan till nästa vårdgivare (Sussa 3.5.1.1).
  overforingSektion(el.querySelector('#lm-ov-plats'), ctx);
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
    // Runda 8, r4: dosändring i en pågående ordination.
    const da = e.target.closest('[data-dosandring]');
    if (da) return andraDos(ctx, da.dataset.dosandring, da);
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
            <ul>${k.varningar.map(kunskap.varningHtml).join('')}</ul>
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
      <td>${esc(o.dosering)}${lms.underDosering(o)}${(o.planeradeDosandringar ?? []).map(d => `<span class="under-text lm-dosandring">Ny dosering från ${esc(datum(d.fran))}: ${esc(d.lakemedel && d.lakemedel.id !== o.lakemedel?.id ? `${d.lakemedel.namn} ${d.lakemedel.styrka}, ` : '')}${esc(d.dosering)}</span>`).join('')}${o.tider?.length ? `<span class="under-text">Kl. ${esc(o.tider.join(', '))}</span>` : ''}${o.administrationssattText ? `<span class="under-text">${esc(o.administrationssattText)}</span>` : ''}${o.vardhandelse ? `<span class="under-text">Inför ${esc(o.vardhandelse.text.toLowerCase())}${o.vardhandelse.administreras ? `, ges ${esc(tidpunkt(o.vardhandelse.administreras))}` : ', väntar på tid'}${o.vardhandelse.foljerTidbok ? '. Tiden följer tidboken' : ''}</span>${o.vardhandelse.forklaring ? `<span class="under-text">${esc(o.vardhandelse.forklaring)}</span>` : ''}` : ''}</td>
      <td>${esc(ORDTYP[o.typ] ?? o.typ)}</td>
      <td>${esc(o.ordinationsorsak)}</td>
      <td>${aktuella ? `${esc(datum(o.aktuelltUppfoljningsdatum ?? o.uppfoljningsdatum))}${o.slut ? `<span class="under-text">Slut ${esc(datum(o.slut))}</span>` : ''}` : (o.utsatt ? `${esc(datum(o.utsatt.tid))}<span class="under-text">${esc(o.utsatt.orsak ?? '')}, ${esc(o.utsatt.av ?? '')}</span>${o.utsatt.plan ? `<span class="under-text ut-plan">Plan: ${esc(o.utsatt.plan.text)}</span>` : ''}` : `Slut ${esc(datum(o.slut))}`)}</td>
      <td>${nllChip(o.nll_status)}</td>
      <td class="atgarder">
        ${kanOrdinera && ['okand_kontrolleras', 'fel'].includes(o.nll_status) ? `<button type="button" class="knapp liten" data-avstam="${o.id}">Stäm av mot NLL</button>` : ''}
        ${kanOrdinera && o.status === 'aktiv' && aktuella && kanAndraDos(o) ? `<button type="button" class="knapp liten sekundar" data-dosandring="${o.id}">Ändra dos</button>` : ''}
        ${kanOrdinera && o.status === 'aktiv' ? `<button type="button" class="knapp liten sekundar" data-utsatt="${o.id}">Sätt ut</button>` : ''}
        ${o.muntlig && !o.muntlig.signerad && o.muntlig.lakare.id === S.session?.personal?.id ? `<button type="button" class="knapp liten" data-signera-muntlig="${o.id}">Signera</button>` : ''}
        ${aktuella && o.status === 'aktiv' && far('utvardera_lakemedel') ? `<button type="button" class="knapp liten sekundar" data-utvardera="${o.id}">Utvärdera</button>` : ''}
        <details class="historik"><summary>Historik</summary><ol>${(o.historik ?? []).map(h => `<li><time>${esc(tidpunkt(h.tid))}</time> ${esc(h.handelse)}${h.detalj ? `: ${esc(h.detalj)}` : ''}${h.av ? ` <span class="dampad">(${esc(h.av)})</span>` : ''}</li>`).join('')}</ol></details>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

// Runda 8, r4: dosen kan ändras i en pågående ordination utan trappschema, spädning, osignerad muntlig ordination eller
// direktiv. Servern prövar samma sak och förklarar varför när det inte går.
const kanAndraDos = (o) => !o.trappning && !o.spadning && !o.direktiv && !(o.muntlig && !o.muntlig.signerad);

// Runda 8, r4: dosändring (dosandring.js). Systemet föreslår produkterna med samma substans och form, och fyller i
// doseringen när en annan styrka väljs. Den nya doseringen gäller från i dag eller ett senare datum.
async function andraDos(ctx, id, knapp) {
  let u;
  try { u = await medKnapp(knapp, () => api(`/api/ordination/${encodeURIComponent(id)}/dosandring`)); } catch { return; }
  const o = u.ordination;
  const tal = (x) => (x == null ? '' : String(x).replace('.', ','));
  const alt = u.alternativ;
  const html = `<form><h2 id="dlg-rubrik">Ändra dos: ${esc(o.lakemedel?.namn)} ${esc(o.lakemedel?.styrka)}</h2>
    <p>Nu: ${esc(o.dosering)}${o.tider?.length ? `, kl. ${esc(o.tider.join(', '))}` : ''}. Ordinationen fortsätter med samma orsak och uppföljning, och ändringen skickas till NLL. Den gamla doseringen finns kvar i historiken.</p>
    ${alt.length > 1 ? `<fieldset class="da-styrka"><legend>Styrka</legend><div class="knapprad">${alt.map(a => `<button type="button" class="knapp sekundar liten" data-styrka="${esc(a.id)}" aria-pressed="${a.nuvarande}">${esc(a.styrka)}${a.namn !== o.lakemedel?.namn ? ` <span class="dampad">${esc(a.namn)}</span>` : ''}</button>`).join('')}</div></fieldset>` : ''}
    <input type="hidden" name="lakemedelId" value="${esc(o.lakemedel?.id ?? '')}">
    <div class="falt"><label for="da-dosering">Dosering <span class="obl">(obligatoriskt)</span></label><input id="da-dosering" name="dosering" value="${esc(o.dosering)}" maxlength="300" required></div>
    <div class="falt-rad">
      <div class="falt smal"><label for="da-dos">Dos</label><input id="da-dos" name="dos" inputmode="decimal" value="${esc(tal(o.dos))}"></div>
      <div class="falt smal"><label for="da-enhet">Enhet</label><input id="da-enhet" name="dosEnhet" value="${esc(o.dosEnhet ?? '')}"></div>
      ${o.vidBehov ? '' : `<div class="falt smal"><label for="da-tider">Tider</label><input id="da-tider" name="tider" value="${esc((o.tider ?? []).join(', '))}"></div>`}
      <div class="falt"><label for="da-fran">Gäller från</label><input id="da-fran" name="fran" type="date" min="${esc(u.fran)}" max="${esc(o.slut ?? u.franSenast)}" value="${esc(u.fran)}" required></div>
    </div>
    <p class="forslag-varfor" data-da-varfor aria-live="polite" hidden></p>
    <div class="falt"><label for="da-orsak">Orsak till ändringen</label><input id="da-orsak" name="orsak" maxlength="300"></div>
    ${u.planerade?.length ? `<p class="liten">Redan planerat: ${u.planerade.map(d => `${esc(datum(d.fran))}, ${esc(d.dosering)}`).join('; ')}.</p>` : ''}
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Ändra dosen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`;
  const svar = await dialog(html, {
    onOpen: (dl) => dl.addEventListener('click', (x) => {
      const b = x.target.closest('[data-styrka]');
      if (!b) return;
      const a = alt.find(y => y.id === b.dataset.styrka);
      const f = a.forslag ?? { dosering: o.dosering, dos: o.dos, dosEnhet: o.dosEnhet, tider: o.tider, varfor: null };
      dl.querySelector('input[name="lakemedelId"]').value = a.id;
      for (const k of dl.querySelectorAll('[data-styrka]')) k.setAttribute('aria-pressed', String(k === b));
      dl.querySelector('input[name="dosering"]').value = f.dosering ?? '';
      dl.querySelector('input[name="dos"]').value = tal(f.dos);
      dl.querySelector('input[name="dosEnhet"]').value = f.dosEnhet ?? '';
      const tider = dl.querySelector('input[name="tider"]');
      if (tider) tider.value = (f.tider ?? []).join(', ');
      const v = dl.querySelector('[data-da-varfor]');
      v.textContent = f.varfor ?? '';
      v.hidden = !f.varfor;
    }),
    validera: (x) => (!x.dosering.trim() ? 'Ange doseringen.' : null),
  });
  if (!svar) return;
  const d = svar.data;
  const data = { lakemedelId: d.lakemedelId, dosering: d.dosering.trim(), dos: d.dos.trim() ? Number(d.dos.replace(',', '.')) : null, dosEnhet: d.dosEnhet.trim() || null,
    tider: (d.tider ?? '').split(/[,\s]+/).map(t => t.trim()).filter(Boolean), fran: d.fran, orsak: d.orsak.trim() || undefined };
  const vag = `/api/ordination/${encodeURIComponent(id)}/dosandring`;
  try {
    let r;
    try { r = await api(vag, { metod: 'POST', data }); } catch (e) {
      if (!(e.status === 400 && e.data?.varningar)) throw e;
      // En allvarlig varning kvitteras med motivering, som vid en ny ordination.
      const k = await dialog(`<form><h2 id="dlg-rubrik">${ikon.varning}<span>Varning vid dosändringen</span></h2>
        <div class="varningslista" role="alert"><ul>${e.data.varningar.map(v => `<li><strong>${v.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(v.text)}</li>`).join('')}</ul>
        ${e.data.kraverKvittens.map((rg, n) => `<div class="falt"><label for="da-kv-${n}">Motivering (${esc(rg.replace(/_/g, ' '))}) <span class="obl">(obligatoriskt)</span></label><textarea id="da-kv-${n}" name="kv_${esc(rg)}" rows="2" maxlength="500" required minlength="3"></textarea></div>`).join('')}
        <p class="demoregel">Varningarna är demoregler, inte kliniskt beslutsstöd.</p></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Ändra dosen ändå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!k) return;
      r = await api(vag, { metod: 'POST', data: { ...data, kvitteradeVarningar: Object.entries(k.data).map(([n, m]) => ({ regel: n.slice(3), motivering: String(m).trim() })) } });
    }
    nastaOverforing = null;
    notis(`${r.ordination.lakemedel?.namn}: ${r.dosandring.galler ? 'dosen är ändrad' : `den nya doseringen gäller från ${datum(r.dosandring.fran)}`}. ${nllResultat(r.nll)}`, r.nll?.status === 'kvitterad' ? 'ok' : 'info');
    ctx.ladda();
  } catch (e) { felNotis(e); }
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
      <div class="falt bred"><label for="m-omed">Varför behandlingen inte kan vänta <span class="obl">(obligatoriskt)</span></label><input id="m-omed" name="omedelbar" maxlength="300"></div></div>
    <p class="hjalp" data-muntlig-forval hidden>Läkaren och skälet är ifyllda från din förra muntliga ordination för patienten. Ändra dem om de inte stämmer.</p>` : ''}
    ${tidigare ? `<p class="forslag-varfor">Systemet har fyllt i ordinationen ur den som gjorde uppehåll (${esc(tidigare.utsatt.plan.text)}). Ändra det som inte stämmer.</p>` : ''}
    <div data-kontakt-plats></div>
    <div class="falt lm-sok"><label for="lm-sok">Läkemedel <span class="obl">(obligatoriskt)</span></label>
      <input id="lm-sok" type="search" autocomplete="off" placeholder="Sök på namn, substans eller ATC-kod" aria-describedby="lm-valt" aria-controls="lm-traffar">
      <input type="hidden" name="lakemedelId">
      <ul class="lm-traffar" id="lm-traffar" aria-label="Träffar i läkemedelskatalogen"></ul>
      <p class="hjalp" id="lm-valt" aria-live="polite">Inget läkemedel valt.</p>
    </div>
    <details class="lm-kunskap-ruta" data-lm-kunskap hidden><summary>Om läkemedlet och patienten</summary><div data-lm-kunskap-innehall></div></details>
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
    <p class="hjalp">Förslag på typ: <button type="button" class="lanknapp" data-engangs>engångsdos</button>, som ges en gång i dag.</p>
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
  if (muntlig) api(`/api/patient/${encodeURIComponent(ctx.id)}/muntlig-ordination`).then(m => {
    form.lakareId.innerHTML = m.lakare.map(l => `<option value="${esc(l.id)}">${esc(l.namn)}, ${esc(l.titel)}</option>`).join('');
    // Runda 8, r4: samma läkare, sätt och skäl som i sjuksköterskans förra muntliga ordination för patienten.
    if (m.senaste) {
      form.lakareId.value = m.senaste.lakareId;
      form.satt.value = m.senaste.satt;
      if (!form.omedelbar.value) form.omedelbar.value = m.senaste.omedelbar;
      const t = form.querySelector('[data-muntlig-forval]');
      if (t) t.hidden = false;
    }
  }).catch(() => {});
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
  // Runda 8, r4: infusionen med basvätska som doseringen skrivs ur, när produkten är en sådan.
  let infusion = null;
  form.addEventListener('input', (e) => {
    if (e.target.name) rorda.add(e.target.name);
    if (infusion && e.target.closest('.o-spadning') && !rorda.has('dosering')) form.dosering.value = infusionsText(form, infusion);
  });
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
    // Runda 10, r5: läkemedelsinformationen för patienten hämtas i bakgrunden (Sussa 3.5.1.5).
    const kr = form.querySelector('[data-lm-kunskap]');
    if (kr) {
      kr.hidden = true;
      api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedelsinfo/${encodeURIComponent(b.lm)}`, { tyst: true, bakgrund: true }).then(info => {
        if (form.lakemedelId.value !== b.lm) return;
        kr.querySelector('[data-lm-kunskap-innehall]').innerHTML = kunskap.lakemedelsinfoHtml(info);
        kr.hidden = false;
      }).catch(() => {});
    }
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
      // Runda 12, r1: ordinationsorsaken är frivillig när ordinationen inte förs över till NLL och vårdgivaren har valt det.
      form.ordinationsorsak.required = !f.orsakFrivillig;
      const obl = form.querySelector('label[for="o-orsak"] .obl');
      if (obl) obl.textContent = f.orsakFrivillig ? '(frivilligt)' : '(obligatoriskt)';
      if (f.orsakText) form.ordinationsorsak.title = f.orsakText;
      form.mall.value = f.mall ?? '';
      form.volymMl.value = f.volymMl ?? '';
      // Runda 6, r2: förpackning, spädning och trappschema ur förslaget.
      form.querySelector('[data-r6-tillagg]').innerHTML = r6Tillagg(f);
      // Runda 8, r4: en engångsdos slutar samma dag, och doseringen för en infusion med basvätska skriver systemet ur
      // infusionen och tillsatserna så länge förskrivaren inte har skrivit en egen.
      if (f.engangs && !rorda.has('slut')) form.slut.value = form.start.value || i;
      infusion = f.spadning?.basvatska ? f.spadning : null;
      if (infusion && !rorda.has('dosering')) form.dosering.value = infusionsText(form, infusion);
      const fv = form.querySelector('#o-forslag');
      fv.textContent = `Förslag ur ${f.mallnamn ? `mallen ${f.mallnamn}` : 'produktens styrka och form'}. ${f.varfor.filter(x => !x.startsWith('Mallen')).join(' ')} ${f.anmarkning}`.replace(/\s+/g, ' ').trim();
      fv.hidden = false;
      if (!rorda.size) (form.dosering.value ? form.ordinationsorsak : form.dosering).focus();
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
    // Runda 8, r4: engångsdos. Systemet sätter typen, slutdatumet och doseringen ur dosen och administrationssättet.
    if (e.target.closest('[data-engangs]')) {
      form.typ.value = 'tillfallig';
      form.slut.value = form.start.value || i;
      form.tider.value = '';
      const satt = form.administrationssatt.value;
      const dos = form.dos.value.trim();
      if (dos) form.dosering.value = `${dos} ${form.dosEnhet.value.trim()}${satt && satt !== 'peroralt' ? ` ${(SATT[satt] ?? '').toLowerCase()}` : ''} som engångsdos`.replace(/\s+/g, ' ');
      for (const x of ['typ', 'slut', 'tider', 'dosering']) rorda.add(x);
      kontrollerad = null;
    }
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
  // Runda 8, r4: ett koncentrat som ska sättas till en infusion.
  if (f.tillsats) ut.push(`<p class="ruta ruta-info liten">${ikon.info}<span>${esc(f.tillsats.text)}</span></p>`);
  if (f.produkttyp && f.produkttyp.typ !== 'godkand') ut.push(`<p class="ruta ruta-info liten">${ikon.info}<span>${esc(f.produkttyp.typText)}. ${esc(f.produkttyp.beskrivning ?? '')}</span></p>`);
  if (f.forpackningar?.length) ut.push(`<div class="falt"><label for="o-fp">Förpackning</label><select id="o-fp" name="forpackning">${f.forpackningar.map(p => `<option value="${esc(p.nplpackid)}">${esc(p.text)}${p.forval ? ' (förval)' : ''}</option>`).join('')}</select><p class="hjalp">NPL-pack-id följer med överföringen till NLL.</p></div>`);
  if (f.spadning) {
    const s = f.spadning;
    ut.push(`<fieldset class="o-spadning"><legend>${s.basvatska ? 'Infusion' : 'Spädning'}, föreslagen av systemet</legend><div class="falt-rad">
      ${s.basvatska ? '' : `<div class="falt"><label for="o-sp-l">Späds i</label><select id="o-sp-l" name="spLosning">${s.losningar.map(l => `<option>${esc(l)}</option>`).join('')}</select></div>`}
      <div class="falt smal"><label for="o-sp-v">Volym ml</label><input id="o-sp-v" name="spVolym" inputmode="decimal" value="${esc(String(s.volymMl).replace('.', ','))}"></div>
      <div class="falt smal"><label for="o-sp-t">Minuter</label><input id="o-sp-t" name="spTid" inputmode="numeric" value="${esc(s.tidMin ?? '')}"></div>
      ${s.basvatska ? (s.tillsatsVal ?? []).map((t, n) => `<div class="falt smal"><label for="o-sp-t${n}">${esc(t.namn[0].toUpperCase() + t.namn.slice(1))}, ${esc(t.enhet)}</label><input id="o-sp-t${n}" name="spTillsats${n}" data-tillsats="${esc(t.lakemedelId)}" inputmode="decimal"></div>`).join('') : ''}</div>
      <p class="hjalp">Systemet räknar koncentration och hastighet och visar dem vid iordningsställandet.</p></fieldset>`);
  }
  // Runda 9, r1: syrgas i liter per minut med utrustning och mål. Utan vald utrustning väljer systemet ur flödet.
  if (f.gas) {
    const g = f.gas;
    ut.push(`<fieldset class="o-gas"><legend>Syrgas, föreslagen av systemet</legend><p class="hjalp">${esc(g.text)}</p><div class="falt-rad">
      <div class="falt"><label for="o-gas-u">Utrustning</label><select id="o-gas-u" name="gasUtrustning"><option value="">Systemet väljer ur flödet</option>${g.utrustningar.map(u => `<option value="${esc(u.id)}">${esc(u.namn[0].toUpperCase() + u.namn.slice(1))}, ${esc(String(u.min).replace('.', ','))} till ${esc(String(u.max))} l/min</option>`).join('')}</select></div>
      <div class="falt smal"><label for="o-gas-min">Syremättnad från, procent</label><input id="o-gas-min" name="gasMalMin" inputmode="numeric" value="${esc(g.malMin)}"></div>
      <div class="falt smal"><label for="o-gas-max">till, procent</label><input id="o-gas-max" name="gasMalMax" inputmode="numeric" value="${esc(g.malMax)}"></div></div></fieldset>`);
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
  // Runda 9, r1: patienten sköter läkemedlet själv under vårdtiden. Systemet säger varför när det inte går.
  if (!f.gas && f.produkttyp?.typ !== 'blodprodukt') ut.push(`<div class="kryssfalt o-egen"><input type="checkbox" id="o-egen" name="egenadministrering" value="ja"><label for="o-egen">Patienten sköter läkemedlet själv under vårdtiden</label>
    <p class="hjalp">Doserna kommer inte med bland sjuksköterskans doser att ge. Sjuksköterskan kvitterar patientens intag.</p></div>`);
  return ut.join('');
}
function r6Data(form) {
  const n = (v) => Number(String(v ?? '').replace(',', '.'));
  const ut = {};
  if (form.forpackning?.value) ut.forpackning = form.forpackning.value;
  if (form.spVolym) {
    ut.spadning = { losning: form.spLosning?.value, volymMl: n(form.spVolym.value), tidMin: form.spTid.value ? n(form.spTid.value) : null,
      // Runda 8, r4: varje tillsats som har en mängd.
      tillsatser: [...form.querySelectorAll('[data-tillsats]')].filter(t => t.value.trim()).map(t => ({ lakemedelId: t.dataset.tillsats, mangd: n(t.value) })) };
  }
  // Runda 9, r1.
  if (form.egenadministrering?.checked) ut.egenadministrering = true;
  if (form.gasMalMin) ut.gas = { utrustning: form.gasUtrustning.value || null, malMin: n(form.gasMalMin.value), malMax: n(form.gasMalMax.value) };
  if (form.querySelector('.o-trappning')?.open) ut.trappning = { riktning: form.trRiktning.value, startdos: n(form.trStart.value), steg: n(form.trSteg.value), dagar: n(form.trDagar.value), slutdos: n(form.trSlut.value) };
  return ut;
}

// Runda 8, r4: doseringen för en infusion med basvätska, skriven ur volymen, tillsatserna och tiden.
const talText = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
function infusionsText(form, inf) {
  const n = (v) => Number(String(v ?? '').replace(',', '.'));
  const vol = n(form.spVolym?.value);
  const tid = n(form.spTid?.value);
  const tillsatser = [...form.querySelectorAll('[data-tillsats]')].filter(t => n(t.value) > 0)
    .map(t => { const d = (inf.tillsatsVal ?? []).find(x => x.lakemedelId === t.dataset.tillsats); return `${talText(n(t.value))} ${d?.enhet ?? ''} ${d?.namn ?? ''}`.replace(/\s+/g, ' ').trim(); });
  const tidText = !(tid > 0) ? '' : tid === 60 ? '1 timme' : tid >= 120 && tid % 60 === 0 ? `${tid / 60} timmar` : `${talText(tid)} minuter`;
  return `${vol > 0 ? `${talText(vol)} ml ` : ''}${inf.namn ?? ''}${tillsatser.length ? ` med ${tillsatser.join(' och ')}` : ''}, intravenöst${tidText ? ` under ${tidText}` : ''}`.trim();
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
    ${allv.length ? `<ul class="varn-allvarlig">${allv.map(kunskap.varningHtml).join('')}</ul>` : ''}
    ${obs.length ? `<ul class="varn-observera">${obs.map(kunskap.varningHtml).join('')}</ul>` : ''}
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

// Runda 10, r5: överföringen till nästa vårdgivare. Systemet väljer mottagarna och tar fram innehållet, och läkaren
// skickar med ett klick. Mottagaren kvitterar här.
async function overforingSektion(plats, ctx) {
  if (!plats) return;
  const pid = encodeURIComponent(ctx.id);
  let d;
  try { d = await api(`/api/patient/${pid}/lakemedelsoverforing`, { tyst: true }); } catch { return; }
  if (!ctx.aktuell() || (!d.forslag && !d.overforingar.length)) return;
  const f = d.forslag;
  const rad = (o) => `<li><strong>${esc(o.fran?.namn ?? '')}</strong> till <strong>${esc(o.mottagare.namn)}</strong>, ${esc(tidpunkt(o.skickad))} av ${esc(o.skickadAv?.namn ?? '')}. <span class="tagg">${esc(o.statusText)}</span>${o.kvitteradAv ? `<span class="under-text">Kvitterad ${esc(tidpunkt(o.kvitterad))} av ${esc(o.kvitteradAv.namn)}</span>` : ''}
    <details><summary>Innehållet</summary><pre class="lm-berattelse">${esc(o.berattelse)}</pre>
      <ul class="enkel-lista">${o.lista.map(x => `<li>${esc(x.lakemedel)} ${esc(x.styrka ?? '')}: ${esc(x.dosering)}. ${esc(x.ordinationsorsak)}</li>`).join('')}</ul>
      ${o.epikris ? `<pre class="lm-berattelse">${esc(o.epikris.text)}</pre>` : ''}</details>
    ${o.kanKvittera ? `<button type="button" class="knapp liten" data-ov-kvittera="${o.id}">Kvittera</button>` : ''}</li>`;
  plats.innerHTML = `<section class="lm-sektion" aria-labelledby="lm-ov"><h3 id="lm-ov">Till nästa vårdgivare</h3>
    ${f ? `<p>${esc(f.text)}</p>
      ${f.mottagare.length ? `<ul class="enkel-lista">${f.mottagare.map(m => `<li>${esc(m.namn)} <span class="dampad">${esc(m.varfor)}</span></li>`).join('')}</ul>` : ''}
      <details><summary>Det som skickas</summary><pre class="lm-berattelse">${esc(f.berattelse)}</pre><p class="liten">${f.lista.length} aktuella läkemedel${f.epikris ? ' och den signerade epikrisen' : ''}.</p></details>
      ${f.varfor ? `<p class="forslag-varfor">${esc(f.varfor)}</p>` : ''}
      ${f.kan.skicka ? `${f.kraverSamtycke ? '<label class="kryss"><input type="checkbox" data-ov-samtycke> Patienten samtycker till att läkemedelsberättelsen skickas</label>' : ''}<button type="button" class="knapp" data-ov-skicka>Skicka läkemedelsberättelsen</button>` : ''}` : ''}
    ${d.overforingar.length ? `<h4>Skickade och mottagna</h4><ul class="enkel-lista">${d.overforingar.map(rad).join('')}</ul>` : ''}
  </section>`;
  plats.querySelector('[data-ov-skicka]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const r = await api(`/api/patient/${pid}/lakemedelsoverforing`, { metod: 'POST', data: { samtycke: Boolean(plats.querySelector('[data-ov-samtycke]')?.checked) } });
      notis(r.text);
      overforingSektion(plats, ctx);
    } catch (x) { b.disabled = false; felNotis(x); }
  });
  plats.querySelectorAll('[data-ov-kvittera]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(`/api/lakemedelsoverforing/${b.dataset.ovKvittera}/kvittera`, { metod: 'POST', data: {} }); notis('Överföringen är kvitterad.'); overforingSektion(plats, ctx); } catch (x) { b.disabled = false; felNotis(x); }
  }));
}
