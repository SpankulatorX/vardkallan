// Remiss, del 3 i gränssnittet (runda 8, r2): remiss på uppdrag, fördelning till en namngiven läkare, remisskonferens
// och registrering av en extern pappersremiss. Servern prövar all behörighet och fyller i det den kan räkna ut.
import { esc, api, notis, felNotis, dialog, medKnapp, tidpunkt, datum, idag, ikon, PRIORITET_REMISS, tom } from './ui.js';
import { far, minVardenhet, enhetLista, laddaEnheter, uppdateraInkorg, S } from './app.js';
// Runda 10, r6: remiss eller konsultation.
import { typFalt } from './remiss-r10-ui.js';

// Tidsramarna när en remiss accepteras, som på servern (remiss-r8.js). Förvalet räknas ur prioriteten.
export const TIDSRAMAR = [
  { dagar: 14, text: 'inom två veckor' }, { dagar: 30, text: 'inom en månad' }, { dagar: 60, text: 'inom två månader' },
  { dagar: 90, text: 'inom tre månader' }, { dagar: 180, text: 'inom sex månader' },
];
export const forvaldTidsram = (prioritet) => ({ akut: 14, skyndsam: 30 }[prioritet] ?? 90);
const tidsramText = (n) => TIDSRAMAR.find(t => t.dagar === n)?.text ?? '';

// Valet av tidsram i bedömningen, med systemets förval.
export function tidsramHtml(prioritet) {
  const f = forvaldTidsram(prioritet);
  return `<div class="r8-tidsram" data-tidsram><fieldset class="radiogrupp" aria-describedby="tr-hjalp"><legend>Besöket ska ske</legend>
    ${TIDSRAMAR.map(t => `<div class="radio"><input type="radio" id="tr-${t.dagar}" name="besokInomDagar" value="${t.dagar}"${t.dagar === f ? ' checked' : ''}><label for="tr-${t.dagar}">${esc(t.text[0].toUpperCase() + t.text.slice(1))}</label></div>`).join('')}
  </fieldset><p class="hjalp" id="tr-hjalp">Förvalt efter remissens prioritet. Normal prioritet följer vårdgarantin, tre månader (demoregel). Patienten hamnar på väntelistan med den gränsen.</p></div>`;
}

// Det som remisskortet visar utöver statuskedjan.
export function kortHtml(r) {
  const rader = [];
  if (r.extern) {
    rader.push(`Pappersremiss från ${esc(r.extern.enhet)}${r.extern.hsaId ? ` (HSA-id ${esc(r.extern.hsaId)} i den simulerade katalogen)` : ''}, remissdatum ${esc(datum(r.extern.remissdatum))}. Registrerad ${esc(tidpunkt(r.extern.registrerad))} av ${esc(r.extern.registreradAv?.namn ?? '')}.${r.status === 'skickad' ? ' Remissen ger vårdrelation när den har tagits emot.' : ''}${r.extern.svarText ? ` ${esc(r.extern.svarText)}` : ''}`);
  }
  if (r.paUppdrag) rader.push(`Skriven av ${esc(r.paUppdrag.skrivenAv?.namn ?? '')} på uppdrag av ${esc(r.avsandare?.namn ?? '')}, som har signerat den.`);
  if (r.fordelad) rader.push(`Fördelad till ${esc(r.fordelad.lakare?.namn ?? '')} för bedömning, ${esc(tidpunkt(r.fordelad.tid))} av ${esc(r.fordelad.av?.namn ?? '')}.`);
  if (r.konferens) rader.push(`På remisskonferensen ${esc(tidpunkt(r.konferens.tid))}.`);
  if (r.beslutPaUppdrag) rader.push(`Beslutet registrerades av ${esc(r.beslutPaUppdrag.registreradAv?.namn ?? '')} på uppdrag av ${esc(r.beslutPaUppdrag.ansvarig?.namn ?? '')}, som är ansvarig för beslutet.`);
  return rader.map(t => `<p class="ruta ruta-info liten r8-rad">${t}</p>`).join('');
}

// Åtgärderna på remisskortet: fördela och sätta på remisskonferens, för en remiss som inte är bedömd.
export function atgarder(r) {
  const a = [];
  if (!['skickad', 'mottagen'].includes(r.status) || r.till.id !== minVardenhet()) return a;
  if (far('fordela_remiss')) a.push(['fordela', r.fordelad ? 'Fördela till en annan läkare' : 'Fördela']);
  if (far('remisskonferens') && !r.konferens) a.push(['konferens', 'Till remisskonferens']);
  return a;
}

// Fördelningen: systemet föreslår bakjouren först, och ett klick på läkaren fördelar remissen.
export async function fordela(r, efter) {
  let f;
  try { f = await api(`/api/remiss/${r.id}/fordelning`); } catch (err) { felNotis(err); return; }
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Fördela remissen</h2>
    <div class="dialog-text"><p>Från ${esc(r.fran.namn)}. Läkaren får remissen i sin inkorg för bedömning. Systemet kvitterar att remissen har kommit fram.</p></div>
    <ul class="enkel-lista r8-lakare">${f.lakare.map(l => `<li><button type="button" class="knapp ${l.forvald ? '' : 'sekundar'} forslag-knapp" data-varde="${esc(l.id)}">${esc(l.namn)}, ${esc((l.titel ?? '').toLowerCase())}</button>
      <span class="under-text">${esc(l.skal)}</span></li>`).join('')}</ul>
    <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    const ny = await api(`/api/remiss/${r.id}/fordela`, { metod: 'POST', data: { lakareId: svar.val } });
    notis(`Remissen är fördelad till ${ny.fordelad.lakare.namn}.`);
    await uppdateraInkorg();
    efter(ny);
  } catch (err) { felNotis(err); }
}

export async function tillKonferens(r, efter) {
  try {
    const ny = await api(`/api/remiss/${r.id}/remisskonferens`, { metod: 'POST', data: {} });
    notis(`Remissen står på remisskonferensen ${tidpunkt(ny.konferens.tid)}.`);
    efter(ny);
  } catch (err) { felNotis(err); }
}

// ---------------------------------------------------------------------------------------------------------------
// Remiss på uppdrag

const uppdragRad = (u, lakaren) => `<li><strong>Till ${esc(u.till.namn)}</strong>${lakaren && u.fragestallning ? `, ${esc(u.fragestallning.slice(0, 80))}` : ''}
  <span class="under-text">${lakaren ? `Skriven ${esc(tidpunkt(u.skapad))} av ${esc(u.skrivenAv.namn)} på ditt uppdrag.` : `Väntar på signering av ${esc(u.uppdragsgivare.namn)}. Skriven ${esc(tidpunkt(u.skapad))}. Remissen skickas när läkaren har signerat.`}</span>
  <span class="knapprad tat">${lakaren ? `<button type="button" class="knapp liten" data-r8-granska="${u.id}">Granska och signera</button>` : ''}<button type="button" class="knapp liten text" data-r8-tillbaka="${u.id}">${lakaren ? 'Skicka inte' : 'Ta tillbaka'}</button></span></li>`;

export function uppdragSektion(lista) {
  if (!lista?.length) return '';
  const lakaren = S.session?.personal?.yrke === 'lakare';
  return `<section class="ov-sektion r8-uppdrag" aria-labelledby="rf-uppdrag"><div class="sektion-huvud"><h3 id="rf-uppdrag">${lakaren ? 'Remisser att signera' : 'Remisser på uppdrag som väntar på signering'}</h3></div>
    <ul class="enkel-lista">${lista.map(u => uppdragRad(u, lakaren)).join('')}</ul></section>`;
}

// Klick i listan: granska och signera (läkaren) eller ta tillbaka. efter() körs när något har ändrats.
export function kopplaUppdrag(el, efter) {
  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-r8-granska]');
    const t = e.target.closest('[data-r8-tillbaka]');
    if (g) { if (await signera(g.dataset.r8Granska)) efter(); return; }
    if (!t) return;
    try { await medKnapp(t, () => api(`/api/remiss-pa-uppdrag/${t.dataset.r8Tillbaka}/ta-tillbaka`, { metod: 'POST', data: {} })); notis('Remissen är tillbakatagen och skickas inte.'); await uppdateraInkorg(); efter(); } catch { /* felet visas som notis */ }
  });
}

// Läkaren granskar remissen som har skrivits på uppdrag och signerar den. Systemet föreslår att lägga till läkarens
// egen anteckning om patienten. Signeringen skickar remissen.
export async function signera(id) {
  let u;
  try { u = await api(`/api/remiss-pa-uppdrag/${id}`); } catch (err) { felNotis(err); return false; }
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Signera remissen</h2>
    <div class="dialog-text"><p>Till ${esc(u.till.namn)}, ${esc(PRIORITET_REMISS[u.prioritet] ?? u.prioritet).toLowerCase()} prioritet, svar senast ${esc(datum(u.svarSenast))}. Skriven av ${esc(u.skrivenAv.namn)} på ditt uppdrag.</p></div>
    <dl class="remiss-text"><div><dt>Frågeställning</dt><dd>${esc(u.fragestallning)}</dd></div>${u.anamnes ? `<div><dt>Anamnes</dt><dd>${esc(u.anamnes)}</dd></div>` : ''}</dl>
    ${u.forslag ? `<div class="kryss"><input type="checkbox" id="r8-ant" name="medAnteckning" value="ja" checked><label for="r8-ant">Lägg till ur din anteckning (${esc(u.forslag.kalla)})</label></div><p class="hjalp">${esc(u.forslag.text)}</p>` : ''}
    <p class="hjalp">Du står som remittent. Remissen skickas när du signerar.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Signera och skicka</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return false;
  try {
    const r = await api(`/api/remiss-pa-uppdrag/${id}/signera`, { metod: 'POST', data: { medAnteckning: svar.data.medAnteckning === 'ja' } });
    notis(`Remissen är signerad och skickad till ${r.till.namn}.`);
    await uppdateraInkorg();
    return true;
  } catch (err) { felNotis(err); return false; }
}

// Formuläret för en remiss på uppdrag. Systemet föreslår uppdragsgivaren och fyller i prioritet och svarsdatum.
export async function uppdragForm(plats, ctx, efter) {
  let f;
  try { [f] = await Promise.all([api(`/api/patient/${encodeURIComponent(ctx.id)}/remiss-pa-uppdrag/forslag`), laddaEnheter()]); } catch (err) { felNotis(err); return; }
  const min = minVardenhet();
  const enheter = enhetLista().filter(e => e.typ === 'vardenhet' && e.id !== min && !e.stangd).sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  const forvald = f.uppdragsgivare.find(l => l.forvald);
  plats.innerHTML = `<form class="remissform" id="uppdragform" novalidate aria-labelledby="ru-rubrik">
    <h3 id="ru-rubrik" tabindex="-1">Remiss på uppdrag</h3>
    <p class="hjalp">${esc(f.text)} Du ser inte remissens text efter att den är skickad, eftersom den är journaltext.</p>
    ${typFalt('ru')}
    <div class="falt-rad">
      <div class="falt bred"><label for="ru-lakare">Uppdragsgivare och remittent <span class="obl">(obligatoriskt)</span></label><select id="ru-lakare" name="uppdragsgivareId" required>
        ${forvald ? '' : '<option value="">Välj läkare</option>'}${f.uppdragsgivare.map(l => `<option value="${esc(l.id)}"${l.forvald ? ' selected' : ''}>${esc(l.namn)}, ${esc((l.titel ?? '').toLowerCase())}</option>`).join('')}</select>
        ${forvald?.skal ? `<p class="hjalp">Förvald: ${esc(forvald.skal)}</p>` : ''}</div>
      <div class="falt bred"><label for="ru-till">Till vårdenhet <span class="obl">(obligatoriskt)</span></label><select id="ru-till" name="tillEnhetId" required><option value="">Välj mottagare</option>${enheter.map(e => `<option value="${esc(e.id)}">${esc(e.namn)}</option>`).join('')}</select></div>
    </div>
    <div class="falt-rad">
      <div class="falt"><label for="ru-prio">Prioritet</label><select id="ru-prio" name="prioritet"><option value="normal">Normal</option><option value="skyndsam">Skyndsam</option><option value="akut">Akut</option></select></div>
      <div class="falt"><label for="ru-svar">Sista svarsdatum <span class="obl">(obligatoriskt)</span></label><input id="ru-svar" name="svarSenast" type="date" required min="${idag()}" value="${esc(f.svarSenast)}"></div>
    </div>
    <div class="falt"><label for="ru-fraga">Frågeställning <span class="obl">(obligatoriskt)</span></label><textarea id="ru-fraga" name="fragestallning" rows="2" required minlength="3" maxlength="2000"></textarea></div>
    <div class="falt"><label for="ru-anamnes">Anamnes och relevanta fynd</label><textarea id="ru-anamnes" name="anamnes" rows="4" maxlength="8000"></textarea></div>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Skicka till läkaren för signering</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  form.tillEnhetId.focus();
  form.querySelector('[data-stang]').addEventListener('click', () => { plats.innerHTML = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const u = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/remiss-pa-uppdrag`, { metod: 'POST', data: { ...data, fragestallning: data.fragestallning.trim(), anamnes: data.anamnes.trim() } }), form);
      notis(`Remissen väntar på signering av ${u.uppdragsgivare.namn}. Den skickas till ${u.till.namn} när läkaren har signerat.`);
      plats.innerHTML = '';
      efter();
    } catch { /* felet visas i formuläret */ }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Remisskonferensen

export async function konferensVy(el, { remissKort, kopplaAtgarder }) {
  const d = await api('/api/remisskonferens');
  const admin = d.kanRegistreraPaUppdrag;
  const lakaren = far('bedom_remiss');
  el.innerHTML = `<section aria-labelledby="kf-rubrik" class="r8-konferens">
    <h2 id="kf-rubrik">Remisskonferens <span class="antal">${d.remisser.length}</span></h2>
    <p class="dampad liten">${esc(d.konferens.text)} Nästa konferens ${esc(tidpunkt(d.konferens.tid))}. Remisserna står i ordning efter prioritet och ankomst, och varje beslut tas med ett klick.</p>
    ${admin && d.remisser.length ? `<div class="falt"><label for="kf-ansvarig">Beslut som fattas av</label><select id="kf-ansvarig"><option value="">Välj läkare</option>${d.lakare.map(l => `<option value="${esc(l.id)}">${esc(l.namn)}, ${esc((l.titel ?? '').toLowerCase())}</option>`).join('')}</select>
      <p class="hjalp">Du registrerar de beslut som läkaren fattar på konferensen. Läkaren står som ansvarig för beslutet, och du ser ingen journaltext.</p></div>` : ''}
    <div id="kf-lista">${d.remisser.length ? d.remisser.map(r => `${remissKort(r, { visaPatient: true })}${(lakaren || admin) ? `<div class="knapprad r8-konf-knappar" data-konf-for="${r.id}">
      <button type="button" class="knapp liten" data-konf="accepterad" data-id="${r.id}">${r.konsultation ? 'Acceptera, besvaras med råd' : `Acceptera, besök ${esc(tidsramText(r.forvaldTidsram))}`}</button>
      <button type="button" class="knapp liten sekundar" data-konf="avvisad" data-id="${r.id}">Avvisa</button></div>` : ''}`).join('') : tom('Inga remisser står på remisskonferensen. Sätt en inkommande remiss på konferensen med Till remisskonferens.')}</div>
  </section>`;
  const lista = d.remisser;
  const rita = () => konferensVy(el, { remissKort, kopplaAtgarder }).catch(felNotis);
  kopplaAtgarder(el.querySelector('#kf-lista'), (id) => lista.find(r => String(r.id) === String(id)), rita);
  el.querySelector('#kf-lista').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-konf]');
    if (!b) return;
    const r = lista.find(x => String(x.id) === b.dataset.id);
    const ansvarigId = el.querySelector('#kf-ansvarig')?.value;
    if (!lakaren && !ansvarigId) { notis('Välj först den läkare som fattar besluten.', 'fel'); el.querySelector('#kf-ansvarig')?.focus(); return; }
    let data = { beslut: b.dataset.konf, besokInomDagar: r.forvaldTidsram };
    if (data.beslut === 'avvisad') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Avvisa remissen</h2>
        <div class="falt"><label for="kf-mot">Motivering <span class="obl">(obligatorisk)</span></label><textarea id="kf-mot" name="motivering" rows="3" maxlength="2000" required></textarea></div>
        <p class="hjalp">Remittenten ser motiveringen.</p><p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avvisa</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.motivering.trim().length < 3 ? 'Skriv en motivering.' : null) });
      if (!svar) return;
      data = { beslut: 'avvisad', motivering: svar.data.motivering.trim() };
    }
    try {
      const ny = await medKnapp(b, () => (lakaren ? api(`/api/remiss/${r.id}/bedom`, { metod: 'POST', data }) : api(`/api/remiss/${r.id}/beslut-pa-uppdrag`, { metod: 'POST', data: { ...data, ansvarigId } })));
      notis(data.beslut === 'accepterad' ? (r.konsultation ? 'Konsultationen är accepterad och besvaras med råd.' : `Remissen är accepterad. Besöket ska ske ${tidsramText(data.besokInomDagar)}.`) : 'Remissen är avvisad. Remittenten ser motiveringen.');
      if (!lakaren) notis(`Beslutet är registrerat med ${ny.beslutPaUppdrag?.ansvarig?.namn ?? 'läkaren'} som ansvarig.`, 'info');
      await uppdateraInkorg();
      rita();
    } catch { /* felet visas som notis */ }
  });
  // Läkaren väljs en gång för hela konferensen.
  const sel = el.querySelector('#kf-ansvarig');
  if (sel) {
    try { const v = sessionStorage.getItem('vk-konferens-ansvarig'); if (v && [...sel.options].some(o => o.value === v)) sel.value = v; } catch { /* inget sparat */ }
    sel.addEventListener('change', () => { try { sessionStorage.setItem('vk-konferens-ansvarig', sel.value); } catch { /* inget sparas */ } });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Extern pappersremiss

export async function skannadeSektion(el, efter) {
  if (!far('registrera_extern_remiss')) return;
  let d;
  try { d = await api('/api/skannade-remisser'); } catch { return; }
  el.innerHTML = d.dokument.length ? `<section class="ov-sektion r8-skannade" aria-labelledby="rs-rubrik"><div class="sektion-huvud"><h2 id="rs-rubrik">Inskannade pappersremisser <span class="antal antal-aktiv">${d.dokument.length}</span></h2></div>
    <p class="dampad liten">Remisser på papper från vårdgivare utanför Vårdkällan, inskannade till vårdenheten. Registrera dem, så går de in bland de inkommande remisserna.</p>
    <ul class="enkel-lista">${d.dokument.map(x => `<li><strong>${esc(x.namn)}</strong> <span class="under-text">Inskannad ${esc(tidpunkt(x.inskannad))}, ${esc(Math.ceil(x.storlek / 1024))} kB.</span>
      <span class="knapprad tat"><a class="knapp liten sekundar" href="/api/skannad-remiss/${x.id}" target="_blank" rel="noopener">Visa</a><button type="button" class="knapp liten" data-skann="${x.id}">Registrera</button></span></li>`).join('')}</ul></section>` : '';
  el.querySelectorAll('[data-skann]').forEach(b => b.addEventListener('click', () => registrera(Number(b.dataset.skann), d.dokument.find(x => x.id === Number(b.dataset.skann)), efter)));
}

// Registreringen: patienten hittas på namn eller nummer, avsändaren väljs ur den simulerade HSA-katalogen eller skrivs
// som fritext, och remissdatumet är förvalt till i dag.
async function registrera(id, dok, efter) {
  let hsa = { enheter: [] };
  try { hsa = await api('/api/hsa-katalog'); } catch { /* fritext går alltid */ }
  let vald = null;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Registrera pappersremiss</h2>
    <div class="dialog-text"><p>${esc(dok?.namn ?? 'Inskannad remiss')}. <a href="/api/skannad-remiss/${id}" target="_blank" rel="noopener">Visa den inskannade remissen</a>. Den blir bilaga till remissen.</p></div>
    <div class="falt"><label for="ex-patient">Patient, namn eller personnummer <span class="obl">(obligatoriskt)</span></label><input id="ex-patient" name="sok" autocomplete="off" autofocus maxlength="60">
      <div class="r8-traffar" data-traffar aria-live="polite"></div></div>
    <div class="falt"><label for="ex-enhet">Från enhet <span class="obl">(obligatoriskt)</span></label><input id="ex-enhet" name="enhet" list="ex-hsa" maxlength="120" required>
      <datalist id="ex-hsa">${hsa.enheter.map(e => `<option value="${esc(e.namn)}">${esc(e.vardgivare)}</option>`).join('')}</datalist>
      <p class="hjalp">Välj ur HSA-katalogen eller skriv enhetens namn. ${esc(hsa.text ?? '')}</p></div>
    <div class="falt-rad">
      <div class="falt"><label for="ex-datum">Remissdatum</label><input id="ex-datum" name="remissdatum" type="date" max="${idag()}" value="${idag()}" required></div>
      <div class="falt bred"><label for="ex-remittent">Remittent</label><input id="ex-remittent" name="remittent" maxlength="120"></div>
    </div>
    <div class="falt"><label for="ex-fraga">Frågeställning <span class="obl">(obligatoriskt)</span></label><textarea id="ex-fraga" name="fragestallning" rows="2" maxlength="2000" required></textarea></div>
    <div class="falt"><label for="ex-anamnes">Anamnes</label><textarea id="ex-anamnes" name="anamnes" rows="3" maxlength="8000"></textarea></div>
    <p class="hjalp">Remissen går till din vårdenhet och väntar på mottagningskvittens. Den ger vårdrelation till patienten först när den har tagits emot.</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  {
    validera: (x) => (!vald ? 'Välj patienten.' : x.enhet.trim().length < 2 ? 'Skriv eller välj avsändande enhet.' : x.fragestallning.trim().length < 3 ? 'Skriv frågeställningen.' : null),
    onOpen: (dl) => {
      const falt = dl.querySelector('#ex-patient');
      const plats = dl.querySelector('[data-traffar]');
      let timer = null;
      const visa = (p) => { vald = p; plats.innerHTML = `<p class="ruta ruta-ok liten" data-vald="${esc(p.id)}">${ikon.bock}<span>${esc(p.namn)}, <span class="pnr">${esc(p.personnummer)}</span>. Kontrollera mot remissen.</span></p>`; };
      const sok = async () => {
        const q = falt.value.trim();
        vald = null;
        if (q.length < 3) { plats.innerHTML = ''; return; }
        try {
          const d = await api(`/api/sok?q=${encodeURIComponent(q)}`, { tyst: true });
          if (falt.value.trim() !== q) return;
          const t = Array.isArray(d) ? d : (d.traffar ?? []);
          if (t.length === 1) visa(t[0]);
          else plats.innerHTML = t.length ? `<ul class="enkel-lista">${t.slice(0, 6).map(p => `<li><button type="button" class="knapp liten text" data-patient="${esc(p.id)}">${esc(p.namn)}, <span class="pnr">${esc(p.personnummer)}</span></button></li>`).join('')}</ul>` : '<p class="hjalp">Ingen patient hittades. Registrera patienten först under Sök patient.</p>';
        } catch { plats.innerHTML = ''; }
      };
      falt.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(sok, 250); });
      plats.addEventListener('click', (e) => { const b = e.target.closest('[data-patient]'); if (!b) return; visa((plats.querySelectorAll('[data-patient]').length ? [...plats.querySelectorAll('[data-patient]')] : []).map(x => ({ id: x.dataset.patient, namn: x.textContent.split(',')[0], personnummer: x.querySelector('.pnr')?.textContent ?? '' })).find(p => p.id === b.dataset.patient)); });
    },
  });
  if (!svar) return;
  const x = svar.data;
  try {
    const r = await api('/api/extern-remiss', { metod: 'POST', data: { skanningId: id, patientId: vald.id, enhet: x.enhet.trim(), remittent: x.remittent.trim(), remissdatum: x.remissdatum, fragestallning: x.fragestallning.trim(), anamnes: x.anamnes.trim() } });
    notis(`Pappersremissen från ${r.extern.enhet} är registrerad och står bland de inkommande remisserna.`);
    efter(r);
  } catch (err) { felNotis(err); }
}
