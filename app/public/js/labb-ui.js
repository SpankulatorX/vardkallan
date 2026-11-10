// Gemensamt för beställning och svar i gränssnittet (runda 8, r1): beställningen som kort med kedjan från beställning
// till vidimering, rören med knappen Tagen, svaren med avvikelse och referensintervall, åtgärderna och raderna i inkorgen.
// Används av fliken Prover, provtagningsvyn och inkorgen.
import { esc, api, notis, medKnapp, ikon, tidpunkt, tal, dialog, felNotis } from './ui.js';
import { uppdateraInkorg } from './app.js';

const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');
const AVV = { hogt: 'Högt', lagt: 'Lågt', kritiskt_hogt: 'Kritiskt högt', kritiskt_lagt: 'Kritiskt lågt' };
const STATUS_KLASS = { bestalld: '', delvis_provtagen: 'tagg-pagaende', skickad: 'tagg-pagaende', delvis_besvarad: 'tagg-obs', besvarad: 'tagg-obs', vidimerad: 'tagg-ok', makulerad: 'tagg-larm' };
const ANALYS_STATUS = { bestalld: 'Väntar på provtagning', provtagen: 'Provtagen', mottagen: 'Hos laboratoriet', besvarad: 'Besvarad', makulerad: 'Makulerad', borttagen: 'Borttagen' };

const svarText = (s) => `${esc(s.namn)} <strong>${esc(tal(s.varde, 2))}</strong> ${esc(s.enhet ?? '')}${s.avvikande ? ` <span class="tagg ${s.avvikande.startsWith('kritiskt') ? 'tagg-larm' : 'tagg-obs'}">${esc(AVV[s.avvikande])}</span>` : ''}
  ${s.referens && (s.referens.lag != null || s.referens.hog != null) ? `<span class="under-text">Referens ${s.referens.lag != null ? esc(tal(s.referens.lag, 2)) : ''}${s.referens.lag != null && s.referens.hog != null ? ' till ' : s.referens.hog != null ? 'högst ' : ' och uppåt'}${s.referens.hog != null ? esc(tal(s.referens.hog, 2)) : ''}</span>` : ''}`;

// Beställningen som kort. rubrikNiva är nivån på kortets rubrik, så att rubrikordningen blir rätt där kortet står.
export function bestallningKort(b, { rubrikNiva = 3, patient = null } = {}) {
  const h = `h${rubrikNiva}`;
  const k = b.kan ?? {};
  const aktiva = b.analyser.filter(a => a.status !== 'borttagen');
  const steg = `<ol class="pr-steg" aria-label="Beställningens steg">${b.steg.map(s => `<li class="${s.klar ? 'klar' : ''}">${s.klar ? ikon.bock : '<span class="pr-punkt" aria-hidden="true"></span>'}<span>${esc(s.text)}${s.tid ? `<span class="under-text">${esc(tidpunkt(s.tid))}</span>` : ''}</span><span class="sr">${s.klar ? ', klart' : ', inte klart'}</span></li>`).join('')}</ol>`;
  const rad = (a) => `<tr><th scope="row">${esc(a.namn)}${a.vidimerad ? '' : ''}<span class="under-text">${esc(a.lab?.kort ?? '')}</span></th>
    <td>${esc(a.statusText ?? ANALYS_STATUS[a.status] ?? a.status)}${a.besvarad ? `<span class="under-text">${esc(tidpunkt(a.besvarad))}</span>` : ''}${a.version > 1 ? ` <span class="tagg tagg-obs">Rättat svar, version ${esc(a.version)}</span>` : ''}</td>
    <td>${a.svar.length ? a.svar.map(s => `<div class="pr-svar">${svarText(s)}</div>`).join('') : a.text ? `<div class="pr-svar">${esc(a.text)}${a.avvikande ? ` <span class="tagg ${a.kritisk ? 'tagg-larm' : 'tagg-obs'}">${a.kritisk ? 'Kritiskt' : 'Fynd'}</span>` : ''}</div>` : ''}${a.vidimerad ? `<span class="under-text">Vidimerad av ${esc(a.vidimerad.av?.namn ?? '')}</span>` : ''}${svarExtra(a)}</td></tr>`;
  const ror = b.prov.length ? `<ul class="pr-ror" aria-label="Rör i provtagningsordning">${b.prov.map((p, i) => `<li class="${p.provtagen ? 'tagen' : ''}">
      <span class="pr-ror-nr" aria-hidden="true">${i + 1}</span><span class="pr-ror-text"><strong>${esc(p.rorNamn)}</strong> <span class="under-text">${esc(p.farg)}, ${esc(p.analyser.join(', '))}, ${esc(p.lab?.kort ?? '')}. Etikett ${esc(p.etikett)}</span>
      ${p.provtagen ? `<span class="under-text">${ikon.bock}Tagen ${esc(tidpunkt(p.provtagen.tid))} av ${esc(p.provtagen.av?.namn ?? '')}</span>` : `<span class="under-text">Planerad ${esc(tidpunkt(p.planerad))}${p.forsenad ? ' <span class="tagg tagg-larm">Försenad</span>' : ''}</span>`}</span>
      ${!p.provtagen && k.taProv ? `<button type="button" class="knapp liten" data-tagen="${p.id}" aria-label="Tagen: ${esc(p.rorNamn)}${patient ? `, ${esc(pnamn(patient))}` : ''}">Tagen</button>` : ''}</li>`).join('')}</ul>` : '';
  const knappar = [
    k.signera ? `<button type="button" class="knapp liten" data-labb="signera">Signera</button>` : '',
    k.vidimera ? `<button type="button" class="knapp liten" data-labb="vidimera">Vidimera svaren</button>` : '',
    k.skicka ? `<button type="button" class="knapp liten sekundar" data-labb="skicka">Skicka tagna rör</button>` : '',
    b.status !== 'makulerad' && b.prov.length ? `<a class="knapp liten sekundar" href="/api/labb/${b.id}/etiketter.pdf" target="_blank" rel="noopener">${ikon.logg}<span>Etiketter</span></a>` : '',
    b.status !== 'makulerad' && b.prov.length ? `<button type="button" class="knapp liten text" data-labb="visa-etiketter">Visa etiketterna</button>` : '',
    b.status !== 'makulerad' && b.prov.length ? `<a class="knapp liten text" href="/api/labb/${b.id}/anvisning.pdf" target="_blank" rel="noopener">Provtagningsanvisning</a>` : '',
    k.andra ? `<button type="button" class="knapp liten text" data-labb="andra">Ändra</button>` : '',
    k.overlata ? `<button type="button" class="knapp liten text" data-labb="overlat">Överlåt ansvaret</button>` : '',
    k.makulera ? `<button type="button" class="knapp liten text" data-labb="makulera">Makulera</button>` : '',
    k.simuleraSvar ? `<button type="button" class="knapp liten sekundar" data-labb="simulera">Simulera svar från laboratoriet</button>` : '',
    // Runda 11, r6: instrumentet mäter det patientnära provet, och det simulerade laboratoriet rättar ett svar.
    ...b.analyser.filter(a => a.kanMata).map(a => `<button type="button" class="knapp liten" data-instrument="${a.provId}" aria-label="Mät i instrumentet: ${esc(a.namn)}">Mät i instrumentet</button>`),
    ...b.analyser.filter(a => a.kanSimuleraRattelse).slice(0, 1).map(a => `<button type="button" class="knapp liten text" data-rattelse="${a.id}">Simulera rättat svar för ${esc(a.namn)}</button>`),
  ].filter(Boolean).join('');
  return `<article class="pr-best${b.kritisk ? ' pr-kritisk' : ''}" data-bestallning="${b.id}" aria-labelledby="pr-b-${b.id}">
    <div class="pr-best-huvud"><${h} id="pr-b-${b.id}">${esc(aktiva.map(a => a.namn).join(', '))}</${h}>
      <span class="tagg ${STATUS_KLASS[b.status] ?? ''}">${esc(b.statusText)}</span>${b.kritisk ? ` <span class="tagg tagg-larm">${ikon.larm}Kritiskt svar</span>` : b.avvikande ? ' <span class="tagg tagg-obs">Avvikande svar</span>' : ''}</div>
    <p class="under-text">${esc(b.nummer)}. ${b.paUppdrag ? `Beställd av ${esc(b.registreradAv?.namn ?? '')} på uppdrag av ${esc(b.ansvarig?.namn ?? '')}` : `Beställd av ${esc(b.ansvarig?.namn ?? '')}`} ${esc(tidpunkt(b.skapad))}, ${esc(b.vardenhet.namn)}.${b.anamnes ? ` Anamnes: ${esc(b.anamnes)}` : ''}</p>
    ${tillaggHtml(b)}
    ${b.makulerad ? `<p class="ruta ruta-info liten">Makulerad ${esc(tidpunkt(b.makulerad.tid))} av ${esc(b.makulerad.av?.namn ?? '')}: ${esc(b.makulerad.orsak)}</p>` : ''}
    ${steg}
    ${ror}
    <div class="tabellrulle"><table class="tabell tat pr-analystabell"><caption class="sr">Analyser och svar för ${esc(b.nummer)}</caption><thead><tr><th scope="col">Analys</th><th scope="col">Status</th><th scope="col">Svar</th></tr></thead><tbody>${aktiva.map(rad).join('')}</tbody></table></div>
    ${knappar ? `<div class="knapprad pr-knappar">${knappar}</div>` : ''}
    <details class="pr-historik"><summary>Historik</summary><ol class="enkel-lista">${b.historik.map(x => `<li>${esc(tidpunkt(x.tid))}: <strong>${esc(x.handelse)}</strong>${x.av ? `, ${esc(x.av.namn)}` : ''}${x.detalj ? `<span class="under-text">${esc(x.detalj)}</span>` : ''}</li>`).join('')}</ol></details>
  </article>`;
}

// Runda 11, r6: prioritet, vårdförlopp, upprepning, kontrollerna före undersökningen och underlagen till beställningen.
function tillaggHtml(b) {
  const taggar = [b.prioritet ? `<span class="tagg${b.prioritet.id === 'akut' ? ' tagg-larm' : ''}">${esc(b.prioritet.namn)}, senast ${esc(tidpunkt(b.prioritet.senast))}</span>` : '',
    b.svf ? `<span class="tagg tagg-obs">Vårdförlopp ${esc(b.svf.namn.toLocaleLowerCase('sv'))} (${esc(b.svf.kod)})</span>` : '',
    b.serie ? `<span class="tagg">Tillfälle ${esc(b.serie.nr)} av ${esc(b.serie.antal)}</span>` : ''].filter(Boolean).join(' ');
  const kontroller = (b.kontroller ?? []).filter(x => x.niva !== 'info');
  return [taggar ? `<p class="pr-taggar">${taggar}</p>` : '',
    kontroller.length ? `<ul class="pr-kontrollista">${kontroller.map(x => `<li class="ruta ${x.niva === 'varning' ? 'ruta-obs' : 'ruta-info'} liten">${ikon.info}<span>${esc(x.text)}</span></li>`).join('')}</ul>` : '',
    b.svfForslag ? `<p class="ruta ruta-obs liten">${ikon.info}<span>${esc(b.svfForslag)}</span></p>` : '',
    b.underlag?.length ? `<p class="liten">Underlag: ${b.underlag.map(u => `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.namn)}</a>`).join(', ')}</p>` : ''].join('');
}
// Koderna i svaret som text, studien i multimediaarkivet, bifogade underlag och tidigare versioner.
function svarExtra(a) {
  const delar = [];
  if (a.undersokning?.bokad && !a.undersokning.utford && a.undersokning.forberedelse) delar.push(`<span class="under-text">Förberedelse: ${esc(a.undersokning.forberedelse)}</span>`);
  if (a.koder?.length) delar.push(`<span class="under-text">${a.koder.map(k => `${esc(k.text)} <span class="pr-kod">(${esc(k.systemText)} ${esc(k.kod)})</span>`).join('. ')}</span>`);
  if (a.studie?.lank) delar.push(`<a class="under-text" href="${esc(a.studie.lank)}" target="_blank" rel="noopener">Bilderna i multimediaarkivet, studie ${esc(a.studie.uid)}</a>`);
  if (a.instrument) delar.push(`<span class="under-text">Mätt i patientnära instrument ${esc(a.instrument)}</span>`);
  for (const u of a.underlag ?? []) delar.push(`<a class="under-text" href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.namn)}</a>`);
  if (a.lastAldre) delar.push(`<span class="ruta ruta-obs liten">${esc(a.lastAldre.text)}</span>`);
  if (a.tidigare?.length) delar.push(`<details class="pr-versioner"><summary>Tidigare versioner</summary><ol class="enkel-lista">${a.tidigare.map(v => `<li>Version ${esc(v.version)}, ${esc(tidpunkt(v.mottagen))}: ${esc(v.text)}<span class="under-text">Ersatt ${esc(tidpunkt(v.ersatt))}. ${esc(v.orsak ?? '')}${v.vidimerad ? ` Vidimerad av ${esc(v.vidimerad.av)}.` : ''}</span></li>`).join('')}</ol></details>`);
  return delar.join('');
}

// Åtgärderna på korten i en behållare. hamta(id) ger beställningen och klar() ritar om.
export function kopplaBestallningar(behallare, hamta, klar, { lakare = [] } = {}) {
  if (!behallare) return;
  behallare.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tagen]');
    if (t) {
      try { const r = await medKnapp(t, () => api(`/api/labb/prov/${t.dataset.tagen}/tagen`, { metod: 'POST', data: {} })); notis(r.text); await klar(r); } catch { /* notis visad */ }
      return;
    }
    // Runda 11, r6: instrumentet och det rättade svaret.
    const ins = e.target.closest('[data-instrument]');
    if (ins) {
      try { const r = await medKnapp(ins, () => api(`/api/labb/prov/${ins.dataset.instrument}/instrument`, { metod: 'POST', data: {} })); notis(r.text); await uppdateraInkorg(); await klar(r); } catch { /* notis visad */ }
      return;
    }
    const ratt = e.target.closest('[data-rattelse]');
    if (ratt) {
      const kort = ratt.closest('[data-bestallning]');
      try { const r = await medKnapp(ratt, () => api(`/api/labb/${kort.dataset.bestallning}/analys/${ratt.dataset.rattelse}/simulera-rattelse`, { metod: 'POST', data: {} })); notis(r.text); await uppdateraInkorg(); await klar(r); } catch { /* notis visad */ }
      return;
    }
    const b = e.target.closest('[data-labb]');
    if (!b) return;
    const kort = b.closest('[data-bestallning]');
    const best = hamta(kort.dataset.bestallning);
    const id = best.id;
    const post = async (vag, data = {}) => { const r = await medKnapp(b, () => api(`/api/labb/${id}/${vag}`, { metod: 'POST', data })); notis(r.text); await uppdateraInkorg(); await klar(r); };
    try {
      if (b.dataset.labb === 'signera') return await post('signera');
      if (b.dataset.labb === 'vidimera') return await post('vidimera');
      if (b.dataset.labb === 'skicka') return await post('skicka');
      if (b.dataset.labb === 'simulera') return await post('simulera-svar');
      if (b.dataset.labb === 'visa-etiketter') return await visaEtiketter(id);
      if (b.dataset.labb === 'makulera') {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Makulera ${esc(best.nummer)}</h2>
          <p>Beställningen makuleras och tas inte. Inget raderas: makuleringen sparas med ditt namn, tiden och orsaken.${best.prov.some(p => p.skickad) ? ' Laboratoriet får veta det.' : ''}</p>
          <div class="falt"><label for="mak-orsak">Orsak</label><input id="mak-orsak" name="orsak" maxlength="300" required></div>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-varde="ok">Makulera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
        { validera: (v) => ((v.orsak ?? '').trim().length < 3 ? 'Skriv varför beställningen makuleras.' : null) });
        if (svar) await post('makulera', { orsak: svar.data.orsak.trim() });
        return;
      }
      if (b.dataset.labb === 'overlat') {
        const val = lakare.filter(l => l.id !== best.ansvarig?.id);
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Överlåt ansvaret för ${esc(best.nummer)}</h2>
          <p>Läkaren blir ansvarig för beställningen och får svaren att vidimera. Systemet prövar att läkaren har en vårdrelation till patienten.</p>
          <div class="falt"><label for="ov-lakare">Ny ansvarig läkare</label><select id="ov-lakare" name="lakareId">${val.map(l => `<option value="${esc(l.id)}">${esc(l.namn)}, ${esc(l.vardenhet)}</option>`).join('')}</select></div>
          <div class="falt"><label for="ov-orsak">Orsak</label><input id="ov-orsak" name="orsak" maxlength="300"></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Överlåt</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (svar) await post('overlat', { lakareId: svar.data.lakareId, orsak: svar.data.orsak?.trim() || undefined });
        return;
      }
      if (b.dataset.labb === 'andra') {
        const otagna = new Set(best.prov.filter(p => !p.provtagen).map(p => p.id));
        const kan = best.analyser.filter(a => a.status !== 'borttagen' && otagna.has(a.provId));
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Ändra ${esc(best.nummer)}</h2>
          <p>Analyser vars rör inte är taget kan tas bort. Ändringen sparas i beställningens historik.</p>
          <fieldset class="kryssgrupp"><legend>Ta bort</legend>${kan.map(a => `<div class="kryssfalt"><input type="checkbox" id="an-${a.id}" name="bort-${a.id}" value="${a.id}"><label for="an-${a.id}">${esc(a.namn)}</label></div>`).join('')}</fieldset>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara ändringen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
        { validera: (v) => (Object.keys(v).some(x => x.startsWith('bort-')) ? null : 'Välj en analys att ta bort.') });
        if (svar) await post('andra', { taBort: Object.entries(svar.data).filter(([x]) => x.startsWith('bort-')).map(([, v]) => Number(v)) });
      }
    } catch (err) { if (!err?.status) felNotis(err); }
  });
}

// Etiketterna med streckkoden, som de skrivs ut. Streckkoden ritas av servern ur etikettens id.
async function visaEtiketter(id) {
  const e = await api(`/api/labb/${id}/etiketter`);
  await dialog(`<div><h2 id="dlg-rubrik">Etiketter för ${esc(e.nummer)}</h2>
    <p class="liten">Etikettskrivaren på din arbetsplats skriver ${e.format === 'a4' ? 'på A4-ark' : 'en etikett per rör'}.${e.skyddad ? ' Patienten har skyddade personuppgifter. Namn och personnummer står på etiketten först när du har valt att visa identiteten.' : ''}</p>
    <ul class="pr-etiketter">${e.etiketter.map(x => `<li class="pr-etikett"><strong>${esc(e.patient.namn)}</strong><span>${esc(e.patient.personnummer)}</span>${x.svg}<span><strong>${esc(x.etikett)}</strong> ${esc(e.nummer)}</span><span>${esc(x.analyser.join(', '))}</span><span>${esc(x.ror)}, ${esc(x.lab)}</span></li>`).join('')}</ul>
    <div class="knapprad"><a class="knapp" href="/api/labb/${id}/etiketter.pdf" target="_blank" rel="noopener">Skriv ut</a><a class="knapp sekundar" href="/api/labb/${id}/etiketter.pdf?format=${e.format === 'a4' ? 'etikett' : 'a4'}" target="_blank" rel="noopener">${e.format === 'a4' ? 'En etikett per sida' : 'A4-ark'}</a><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div></div>`, { klass: 'dialog-bred' });
}

// ---- Inkorgen -----------------------------------------------------------------------------------------------------

export const inkorgAntal = (d) => (d.provsvarAttVidimera?.length ?? 0) + (d.labbAttSignera?.length ?? 0) + (d.provsvarKritiska?.length ?? 0) + (d.provsvarRattade?.length ?? 0);

export function inkorgSektioner(d, sektion, ar) {
  const pat = (id) => `#/patient/${encodeURIComponent(id)}/prover`;
  const kritiska = (d.provsvarKritiska ?? []).map(x => `<li class="ik-larm"><a href="${pat(x.patientId)}"><span class="ik-rubrik">${ikon.larm}<span>Kritiskt provsvar, ${esc(pnamn(x.patient))}</span></span>
    <span class="under-text">${esc(x.text)}. Besvarat ${esc(tidpunkt(x.besvarad))}.</span><span class="under-text ik-atgard">${esc(x.atgard)}</span></a>${ikon.pil}</li>`);
  const vid = (d.provsvarAttVidimera ?? []).map(x => `<li class="ik-ater${x.kritisk ? ' ik-larm' : ''}"><div class="ik-text"><span class="ik-rubrik">${x.kraverVal ? 'Provsvar' : esc(x.analyser.map(a => a.namn).join(', '))}, ${esc(pnamn(x.patient))}${x.avvikande ? ' <span class="tagg tagg-obs">Avvikande</span>' : ''}</span>
      <span class="under-text">${x.kraverVal ? esc(x.text) : esc(x.analyser.map(a => a.text).join('. '))}. ${esc(x.nummer)}, besvarat ${esc(tidpunkt(x.besvarad))}.</span></div>
    <div class="ik-knappar"><a class="knapp liten sekundar" href="${pat(x.patientId)}">Läs</a>${x.kraverVal ? '' : `<button type="button" class="knapp liten" data-labb-vidimera="${x.bestallningId}">Vidimera</button>`}</div></li>`);
  const sign = (d.labbAttSignera ?? []).map(x => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">${esc(x.analyser.join(', '))}, ${esc(pnamn(x.patient))}</span>
      <span class="under-text">Beställt på ditt uppdrag av ${esc(x.registreradAv)} ${esc(tidpunkt(x.skapad))}. ${esc(x.nummer)}.</span></div>
    <div class="ik-knappar"><a class="knapp liten sekundar" href="${pat(x.patientId)}">Läs</a><button type="button" class="knapp liten" data-labb-signera="${x.bestallningId}">Signera</button></div></li>`);
  // Runda 11, r6: rättade svar för den som läste den tidigare versionen.
  const rattade = (d.provsvarRattade ?? []).map(x => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">Rättat svar: ${esc(x.analys)}, ${esc(pnamn(x.patient))}</span>
      <span class="under-text">${esc(x.text)}${x.orsak ? ` ${esc(x.orsak)}` : ''} ${esc(x.nummer)}, rättat ${esc(tidpunkt(x.rattad))}.</span></div>
    <div class="ik-knappar"><a class="knapp liten sekundar" href="${pat(x.patientId)}">Läs</a><button type="button" class="knapp liten" data-labb-last="${x.analysId}">Jag har läst</button></div></li>`);
  return [
    rattade.length ? sektion('labbrattade', 'Rättade svar', rattade, '', 'Svar som laboratoriet eller röntgen har rättat efter att du läste dem. Den tidigare versionen finns kvar i beställningen.') : '',
    kritiska.length ? sektion('labbkritisk', 'Kritiska provsvar', kritiska, '', 'Svar som ligger utanför demons gränser för kritiska värden. De larmar den ansvariga läkaren och sjuksköterskorna på vårdenheten tills läkaren har vidimerat dem. Demoregel.') : '',
    ar('vidimera_provsvar') ? sektion('labbvid', 'Provsvar att vidimera', vid, 'Inga provsvar väntar på din vidimering.', 'Svar på beställningar där du är ansvarig läkare. Avvikande och kritiska svar står först.') : '',
    sign.length ? sektion('labbsign', 'Labbeställningar att signera', sign, '', 'Beställningar som en sjuksköterska eller undersköterska har gjort på ditt uppdrag.') : '',
  ].join('');
}

// Knapparna Vidimera och Signera i inkorgen. Returnerar true om knappen hanterades.
export async function inkorgKlick(e, omrita) {
  const v = e.target.closest('[data-labb-vidimera]');
  const s = e.target.closest('[data-labb-signera]');
  const l = e.target.closest('[data-labb-last]');
  if (l) {
    try { const r = await medKnapp(l, () => api(`/api/labb/analys/${l.dataset.labbLast}/last`, { metod: 'POST', data: {} })); notis(r.text); await uppdateraInkorg(); await omrita(); } catch { /* notis visad */ }
    return true;
  }
  if (!v && !s) return false;
  const b = v ?? s;
  try {
    const r = await medKnapp(b, () => api(`/api/labb/${v ? v.dataset.labbVidimera : s.dataset.labbSignera}/${v ? 'vidimera' : 'signera'}`, { metod: 'POST', data: {} }));
    notis(r.text);
    await uppdateraInkorg();
    await omrita();
  } catch { /* notis visad */ }
  return true;
}
