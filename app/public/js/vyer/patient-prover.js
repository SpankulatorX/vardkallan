// Fliken Prover (runda 8, r1, Sussa 4.4 och testfall 3.1 till 3.3 och 3.5): beställningarna med hela kedjan från
// beställning till vidimering, beställningsformuläret med systemets förslag, provtagningen rör för rör, etiketterna och
// provtagningsanvisningen, och kontrollerna som läkaren ordinerar till avdelningen.
import { esc, api, notis, medKnapp, ikon, tidpunkt, dialog, ApiFel, felNotis } from '../ui.js';
import { far, pa, uppdateraInkorg } from '../app.js';
import { doldaRad } from './patient.js';
import { bestallningKort, kopplaBestallningar } from '../labb-ui.js';

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/prover`);
  if (!ctx.aktuell()) return;
  const kanBestalla = pa('bestalla_prov', 'bestalla_prov_uppdrag');
  const kanKontroll = far('ordinera_kontroll');
  const k = d.kontroller;
  el.innerHTML = `<div class="flikhuvud"><h2>Prover och kontroller</h2><div class="knapprad">
      ${kanBestalla ? `<button type="button" class="knapp" data-ny-prov aria-expanded="false" aria-controls="pr-form-plats">${ikon.plus}<span>${far('bestalla_prov') ? 'Beställ prover' : 'Beställ på uppdrag'}</span></button>` : ''}
      ${kanKontroll ? `<button type="button" class="knapp sekundar" data-ny-kontroll aria-expanded="false" aria-controls="pr-kontroll-plats">${ikon.klocka}<span>Ordinera kontroller</span></button>` : ''}</div></div>
    ${doldaRad(d.dolda)}
    <div id="pr-form-plats"></div>
    <div id="pr-kontroll-plats"></div>
    ${planeratHtml(d.planerat ?? [])}
    <section class="ov-sektion" aria-labelledby="pr-best"><div class="sektion-huvud"><h3 id="pr-best">Beställningar</h3></div>
      <p class="dampad liten">${esc(d.simulerat)}</p>
      <div id="pr-lista">${d.bestallningar.length ? d.bestallningar.map(b => bestallningKort(b, { rubrikNiva: 4 })).join('') : '<p class="tom">Patienten har inga beställningar som du kan se.</p>'}</div>
    </section>
    <section class="ov-sektion" aria-labelledby="pr-kontr"><div class="sektion-huvud"><h3 id="pr-kontr">Kontroller på avdelningen</h3></div>
      ${kontrollTabell(k.kontroller, kanKontroll)}
      <p class="dampad liten">Kontrollerna bockas av när mätvärdet registreras i tid på vårdenheten. ${esc(k.demoregel)}</p>
    </section>`;
  kopplaBestallningar(el.querySelector('#pr-lista'), (id) => d.bestallningar.find(b => String(b.id) === String(id)), () => ctx.ladda(), { lakare: d.lakare });
  el.querySelector('[data-ny-prov]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#pr-form-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    bestallForm(plats, ctx);
  });
  el.querySelector('[data-ny-kontroll]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#pr-kontroll-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    kontrollForm(plats, ctx, k.forslag);
  });
  el.querySelector('#pr-kontr')?.closest('section').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-avsluta-kontroll]');
    if (!b) return;
    try { const r = await medKnapp(b, () => api(`/api/kontroll/${b.dataset.avslutaKontroll}/avsluta`, { metod: 'POST', data: {} })); notis(r.text); ctx.ladda(); } catch { /* notis visad */ }
  });
  // Från snabbvalen i översikten (prover/ny och prover/kontroller) öppnas formuläret direkt.
  if (ctx.sub === 'ny' && kanBestalla) el.querySelector('[data-ny-prov]').click();
  if (ctx.sub === 'kontroller' && kanKontroll) el.querySelector('[data-ny-kontroll]').click();
}

// Runda 11, r6: allt som är planerat för patienten i alla vårdprocesser som användaren får se (Sussa 4.4.2.2 och 4.4.2.7).
const PLAN_TYP = { prov: 'Prov', undersokning: 'Undersökning', kontroll: 'Kontroll' };
function planeratHtml(lista) {
  return `<section class="ov-sektion" aria-labelledby="pr-plan"><div class="sektion-huvud"><h3 id="pr-plan">Planerat för patienten</h3></div>
    ${lista.length ? `<div class="tabellrulle"><table class="tabell tat pr-planerat"><caption class="sr">Planerade prover, undersökningar och kontroller i tidsordning</caption><thead><tr><th scope="col">När</th><th scope="col">Vad</th><th scope="col">Status</th><th scope="col">Vårdenhet</th></tr></thead><tbody>
      ${lista.map(x => `<tr><td>${esc(tidpunkt(x.tid))}${x.typ === 'undersokning' && !x.bokad && x.senast ? '<span class="under-text">senast</span>' : ''}</td><td><strong>${esc(x.rubrik)}</strong><span class="under-text">${esc(PLAN_TYP[x.typ])}${x.text ? `, ${esc(x.text)}` : ''}</span></td>
        <td><span class="tagg ${x.forsenad ? 'tagg-larm' : x.status === 'Bokad' ? 'tagg-ok' : ''}">${esc(x.status)}</span></td><td>${esc(x.vardenhet)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="tom liten">Inget är planerat för patienten bland det du kan se.</p>'}</section>`;
}

const STATUS_KLASS = { utford: 'tagg-ok', forsenad: 'tagg-larm', pagar: 'tagg-pagaende', planerad: '' };
const STATUS_TEXT = { utford: 'Utförd', forsenad: 'Försenad', pagar: 'Pågår', planerad: 'Planerad' };
function kontrollTabell(lista, kanAvsluta) {
  if (!lista.length) return '<p class="tom liten">Inga kontroller är ordinerade.</p>';
  return `<div class="tabellrulle"><table class="tabell tat pr-kontroller"><caption class="sr">Ordinerade kontroller</caption><thead><tr><th scope="col">Kontroll</th><th scope="col">Hur ofta</th><th scope="col">Nästa</th><th scope="col">Ordinerad av</th>${kanAvsluta ? '<th scope="col"><span class="sr">Åtgärd</span></th>' : ''}</tr></thead><tbody>
    ${lista.map(k => `<tr${k.aktiv ? '' : ' class="pr-avslutad"'}><td><strong>${esc(k.namn)}</strong>${k.intern ? ' <span class="tagg">Intern analys</span>' : ''}<span class="under-text">${esc(k.enhet.namn)}</span></td>
      <td>${esc(k.frekvensText)}<span class="under-text">Från ${esc(tidpunkt(k.start))}</span></td>
      <td>${!k.aktiv ? `<span class="tagg">${k.avslutad ? 'Avslutad' : 'Klar'}</span>` : k.nasta ? `${esc(tidpunkt(k.nasta.tid))} <span class="tagg ${STATUS_KLASS[k.nasta.status] ?? ''}">${esc(STATUS_TEXT[k.nasta.status] ?? k.nasta.status)}</span>` : '<span class="tagg tagg-ok">Utförd</span>'}</td>
      <td>${esc(k.ordineradAv ?? '')}</td>
      ${kanAvsluta ? `<td>${k.aktiv ? `<button type="button" class="knapp liten sekundar" data-avsluta-kontroll="${k.id}">Avsluta</button>` : ''}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

// Beställningsformuläret. Systemets förslag står först, och ett förslag beställs med ett klick. Den som vill välja
// själv söker bland analyserna, och systemet visar rör, laboratorium och om provet nyss är taget.
async function bestallForm(plats, ctx) {
  plats.innerHTML = '<p class="tom">Hämtar förslag.</p>';
  let f;
  try { f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/prover/forslag`); } catch (e) { plats.innerHTML = ''; felNotis(e); return; }
  const valda = new Set();
  const us = f.undersokning;
  const arUnd = (id) => Boolean(f.analyser.find(a => a.id === id)?.undersokning);
  const lakareVal = f.paUppdrag ? `<div class="falt"><label for="pr-lakare">På uppdrag av</label><select id="pr-lakare" name="lakareId">${f.lakare.map(l => `<option value="${esc(l.id)}"${l.forvald ? ' selected' : ''}>${esc(l.namn)}</option>`).join('')}</select>
    <p class="hjalp">Läkaren blir ansvarig för beställningen, får svaren och signerar beställningen i inkorgen.</p></div>` : '';
  const paketKort = (p) => `<li class="pr-paket"><div class="pr-paket-text"><strong>${esc(p.namn)}</strong>
      <span class="under-text">${p.analyser.length ? esc(p.analyser.map(a => a.namn).join(', ')) : 'Allt i paketet är redan taget eller beställt'}${p.analyser.length ? `, till ${esc([...new Set(p.analyser.map(a => a.lab.kort))].join(' och '))}` : ''}.</span>
      ${p.skal.length ? `<span class="under-text">${esc(p.skal.join(' '))}</span>` : ''}
      ${p.utelamnade.map(u => `<span class="under-text pr-utelamnad">${ikon.info}<span>Tas inte med: ${esc(u.skal)}</span></span>`).join('')}</div>
    <div class="knapprad tat">${p.analyser.length ? `<button type="button" class="knapp liten" data-bestall-paket="${esc(p.id)}">Beställ</button>` : ''}<button type="button" class="knapp liten sekundar" data-valj-paket="${esc(p.id)}">Välj och ändra</button></div></li>`;
  plats.innerHTML = `<form class="pr-form" id="pr-form" novalidate aria-labelledby="pr-form-rubrik">
    <h3 id="pr-form-rubrik">${f.paUppdrag ? 'Beställ prover på uppdrag' : 'Beställ prover'}</h3>
    ${lakareVal}
    <h4>Systemets förslag</h4>
    ${f.paket.length ? `<ul class="pr-paketlista" id="pr-forslag">${f.paket.map(paketKort).join('')}</ul>` : '<p class="liten">Systemet hittar inget paket som passar vårdkontakten, diagnoserna eller läkemedlen. Välj analyser eller ett paket nedan.</p>'}
    <details class="pr-valj" id="pr-valj"><summary>Välj analyser eller ett annat paket</summary>
      <div class="falt"><label for="pr-sok">Sök analys</label><input id="pr-sok" type="search" autocomplete="off" placeholder="Till exempel crp, blodstatus eller odling"></div>
      <ul class="pr-analyser" id="pr-analyser">${f.analyser.map(a => `<li class="kryssfalt" data-ord="${esc([a.namn, ...a.ord].join(' ').toLocaleLowerCase('sv'))}"><input type="checkbox" id="pr-a-${esc(a.id)}" value="${esc(a.id)}" data-analys>
        <label for="pr-a-${esc(a.id)}">${esc(a.namn)} <span class="under-text">${esc(a.ror)}, ${esc(a.lab.kort)}${f.dubbletter[a.id] ? `. ${esc(f.dubbletter[a.id])}` : ''}</span></label></li>`).join('')}</ul>
      <p class="liten">Paket: ${f.allaPaket.map(p => `<button type="button" class="knapp liten text" data-valj-paket="${esc(p.id)}">${esc(p.namn)}</button>`).join(' ')}</p>
      <fieldset class="kryssgrupp"><legend>Provtagning</legend>${f.tider.map((t, i) => `<div class="kryssfalt"><input type="radio" id="pr-tid-${t.id}" name="tid" value="${esc(t.tid)}"${i ? '' : ' checked'}><label for="pr-tid-${t.id}">${esc(t.text)}</label></div>`).join('')}</fieldset>
      <div class="falt" id="pr-anamnes-falt" hidden><label for="pr-anamnes" id="pr-anamnes-etikett">Anamnes till laboratoriet</label><textarea id="pr-anamnes" name="anamnes" rows="2" maxlength="500">${esc(f.anamnes ?? '')}</textarea>
        <p class="hjalp">Systemet har fyllt i texten ur vårdkontakten.</p></div>
      <div id="pr-us-falt" hidden>
        <div class="falt"><label for="pr-prio">Prioritet för undersökningen</label><select id="pr-prio" name="prioritet">${us.prioriteter.map(p => `<option value="${esc(p.id)}"${p.id === us.prioritet ? ' selected' : ''}>${esc(p.namn)}, ${esc(p.text)}</option>`).join('')}</select>
          <p class="hjalp">Systemets förslag: ${esc(us.prioritetSkal)}</p></div>
        <div class="falt"><label for="pr-svf">Standardiserat vårdförlopp</label><select id="pr-svf" name="svf"><option value="">Inget vårdförlopp</option>${us.vardforlopp.map(v => `<option value="${esc(v.id)}"${v.id === us.svf ? ' selected' : ''}>${esc(v.namn)}</option>`).join('')}</select>
          ${us.svf ? '<p class="hjalp">Systemet har valt vårdförloppet ur vårdkontaktens orsak.</p>' : ''}</div>
        <p class="hjalp">Systemet kontrollerar njurfunktionen före kontrast, graviditet före strålning och implantat före magnetkamera när du beställer.${us.njurfunktion ? ` Senaste eGFR som du ser: ${esc(String(Math.round(us.njurfunktion.varde)))}.` : ''}</p>
      </div>
      <fieldset class="kryssgrupp"><legend>Upprepa beställningen</legend>
        <div class="falt smal"><label for="pr-antal">Antal tillfällen</label><select id="pr-antal" name="antal">${Array.from({ length: us.upprepning.maxAntal }, (_, i) => `<option value="${i + 1}">${i ? `${i + 1} tillfällen` : 'En gång'}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="pr-intervall">Tid mellan tillfällena</label><select id="pr-intervall" name="intervall">${[[1, 'Varje dag'], [7, 'Varje vecka'], [14, 'Varannan vecka'], [30, 'Var 30:e dag']].map(([v, t]) => `<option value="${v}"${v === 7 ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <p class="hjalp">${esc(us.upprepning.text)}</p></fieldset>
      <div class="falt"><label for="pr-underlag">Bifoga underlag</label><input id="pr-underlag" name="underlag" type="file" multiple accept="image/png,image/jpeg,application/pdf,text/plain">
        <p class="hjalp">En bild, ett tidigare utlåtande eller ett dokument, högst 40 kB per fil. Underlaget följer med till laboratoriet eller röntgen.</p></div>
      <div class="falt"><label for="pr-kommentar">Kommentar till laboratoriet</label><input id="pr-kommentar" name="kommentar" maxlength="500"></div>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp" data-bestall-valda>Beställ</button></div>
    </details>
    <p class="dampad liten">${esc(f.simulerat)} ${esc(f.demoregel)}</p>
  </form>`;
  const form = plats.querySelector('#pr-form');
  const lakare = () => form.querySelector('[name="lakareId"]')?.value;
  const ritaVal = () => {
    form.querySelectorAll('[data-analys]').forEach(c => { c.checked = valda.has(c.value); });
    form.querySelector('#pr-anamnes-falt').hidden = ![...valda].some(id => f.analyser.find(a => a.id === id)?.anamnes);
    // Runda 11, r6: en undersökning har en frågeställning och en prioritet.
    const und = [...valda].some(arUnd);
    form.querySelector('#pr-anamnes-etikett').textContent = und ? 'Frågeställning till röntgen eller den utförande enheten' : 'Anamnes till laboratoriet';
    form.querySelector('#pr-us-falt').hidden = !und;
  };
  form.querySelector('#pr-sok').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLocaleLowerCase('sv');
    form.querySelectorAll('#pr-analyser li').forEach(li => { li.hidden = Boolean(q) && !li.dataset.ord.includes(q); });
  });
  form.addEventListener('change', (e) => {
    if (!e.target.matches('[data-analys]')) return;
    if (e.target.checked) valda.add(e.target.value); else valda.delete(e.target.value);
    ritaVal();
  });
  const skicka = async (knapp, data) => {
    try {
      const r = await medKnapp(knapp, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/prover`, { metod: 'POST', data }), data.paket ? null : form);
      notis(r.text);
      await uppdateraInkorg();
      ctx.ladda();
    } catch (e) {
      // Prov som nyss är tagna eller redan beställda: systemet förklarar och frågar om de ändå ska beställas.
      // Runda 11, r6: frågan om graviditet eller implantat, och varningarna före undersökningen.
      if (e instanceof ApiFel && e.kod === 'fraga') {
        const q = e.data.fraga;
        const svar = await dialog(`<form><h2 id="dlg-rubrik">${q.id === 'graviditet' ? 'Graviditet' : 'Implantat'}</h2><p>${esc(q.text)}</p>
          <fieldset class="kryssgrupp"><legend>Svar</legend>${(e.data.fragor ?? []).map((x, i) => `<div class="kryssfalt"><input type="radio" id="dlg-f-${esc(x.id)}" name="svar" value="${esc(x.id)}"${i ? '' : ' checked'}><label for="dlg-f-${esc(x.id)}">${esc(x.text)}</label></div>`).join('')}</fieldset>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Fortsätt</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (svar) await skicka(knapp, { ...data, [q.id]: svar.data.svar });
        return;
      }
      if (e instanceof ApiFel && e.kod === 'kontroll_kvittens') {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Kontrollera före undersökningen</h2>
          <ul class="mg-lista">${(e.data.kontroller ?? []).filter(x => x.niva !== 'info').map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>
          <p>Beställ om nyttan är större än risken. Varningarna följer med till röntgen.</p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Beställ ändå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (svar) await skicka(knapp, { ...data, kvitteraKontroller: true });
        return;
      }
      if (e instanceof ApiFel && e.kod === 'dubblett') {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Provet är nyss taget eller redan beställt</h2>
          <ul class="mg-lista">${(e.data.dubbletter ?? []).map(x => `<li>${esc(x.skal)}</li>`).join('')}</ul>
          <p>Ett nytt prov behövs sällan så snart. Beställ ändå om det finns ett skäl, så sparas varningen med beställningen.</p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Beställ ändå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (svar) await skicka(knapp, { ...data, kvitteraDubbletter: true });
      }
    }
  };
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bestall-paket]');
    if (b) {
      const p = f.paket.find(x => x.id === b.dataset.bestallPaket);
      skicka(b, { paket: p.id, analyser: p.analyser.map(a => a.id), lakareId: lakare() });
      return;
    }
    const v = e.target.closest('[data-valj-paket]');
    if (v) {
      const p = [...f.paket, ...f.allaPaket].find(x => x.id === v.dataset.valjPaket);
      valda.clear();
      for (const a of p.analyser) valda.add(a.id);
      ritaVal();
      form.querySelector('#pr-valj').open = true;
      form.querySelector('#pr-analyser').scrollIntoView({ block: 'nearest' });
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!valda.size) { notis('Välj minst en analys.', 'fel'); return; }
    const tid = form.querySelector('[name="tid"]:checked')?.value;
    const und = [...valda].some(arUnd);
    const antal = Number(form.antal.value);
    lasFiler(form.querySelector('#pr-underlag').files).then((underlag) => skicka(form.querySelector('[data-bestall-valda]'), {
      analyser: [...valda], planerad: tid, anamnes: form.querySelector('#pr-anamnes-falt').hidden ? undefined : form.anamnes.value.trim(), kommentar: form.kommentar.value.trim() || undefined, lakareId: lakare(),
      ...(und ? { prioritet: form.prioritet.value, svf: form.svf.value || undefined } : {}),
      ...(antal > 1 ? { upprepning: { antal, intervallDagar: Number(form.intervall.value) } } : {}),
      ...(underlag.length ? { underlag } : {}),
    })).catch(() => notis('Filen kunde inte läsas.', 'fel'));
  });
}

// Ordination av kontroller (Sussas testfall 3.5). Systemet föreslår starttiden, klockan 7 på morgonen, och lägger
// kontrollerna på avdelningen där patienten ligger. Vätskebalansen följs under ett dygn.
function kontrollForm(plats, ctx, f) {
  plats.innerHTML = `<form class="pr-form" id="pr-kform" novalidate aria-labelledby="pr-kform-rubrik">
    <h3 id="pr-kform-rubrik">Ordinera kontroller</h3>
    <p class="liten">Kontrollerna görs på ${esc(f.enhet.namn)}, och sjuksköterskan ser dem som uppgifter med tid.</p>
    <fieldset class="kryssgrupp pr-kontrollval"><legend>Kontroller</legend>${f.kontroller.map(k => `<div class="kryssfalt"><input type="checkbox" id="pr-k-${esc(k.id)}" name="kontroll" value="${esc(k.id)}"><label for="pr-k-${esc(k.id)}">${esc(k.namn)}${k.vatskebalans ? ' <span class="under-text">under ett dygn</span>' : k.intern ? ' <span class="under-text">intern analys</span>' : ''}</label></div>`).join('')}</fieldset>
    <div class="falt"><label for="pr-frekvens">Hur ofta</label><select id="pr-frekvens" name="frekvens">${f.frekvenser.map(x => `<option value="${esc(x.id)}">${esc(x.namn)}</option>`).join('')}</select></div>
    <div class="falt" id="pr-dygn-falt" hidden><label for="pr-dygn">Antal dygn</label><input id="pr-dygn" name="dygn" type="number" min="1" max="14" value="1" inputmode="numeric"></div>
    <fieldset class="kryssgrupp"><legend>Från</legend>
      <div class="kryssfalt"><input type="radio" id="pr-start-f" name="start" value="${esc(f.start)}" checked><label for="pr-start-f">${esc(f.startText.charAt(0).toUpperCase() + f.startText.slice(1))}, morgonrundan</label></div>
      <div class="kryssfalt"><input type="radio" id="pr-start-nu" name="start" value=""><label for="pr-start-nu">Nu</label></div>
    </fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp" data-spara-kontroll>Ordinera</button></div>
  </form>`;
  const form = plats.querySelector('#pr-kform');
  form.frekvens.addEventListener('change', () => { form.querySelector('#pr-dygn-falt').hidden = form.frekvens.value === 'en_gang'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kontroller = [...form.querySelectorAll('[name="kontroll"]:checked')].map(c => c.value);
    const startVal = form.querySelector('[name="start"]:checked').value;
    try {
      const r = await medKnapp(form.querySelector('[data-spara-kontroll]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/kontroller`, { metod: 'POST',
        data: { kontroller, frekvens: form.frekvens.value, start: startVal || new Date().toISOString(), dygn: form.frekvens.value === 'en_gang' ? undefined : Number(form.dygn.value) } }), form);
      notis(r.text);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}

// Runda 11, r6: filerna som bifogas till beställningen, i base64. Servern avgör typen ur innehållet.
export function lasFiler(filer) {
  return Promise.all([...(filer ?? [])].map(fil => new Promise((ok, fel) => {
    const r = new FileReader();
    r.onload = () => ok({ namn: fil.name, data: String(r.result).replace(/^data:[^,]*,/, '') });
    r.onerror = () => fel(r.error);
    r.readAsDataURL(fil);
  })));
}
