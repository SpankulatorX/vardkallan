// Remisser: inkommande och utgående för min vårdenhet, med statuskedjan och åtgärderna mottag, bedöm, svara och kvittera svar.
import { esc, api, datum, tidpunkt, notis, felNotis, dialog, ikon, PRIORITET_REMISS, vyRubrik, tom, migreradEtikett } from '../ui.js';
import { far, minVardenhet, uppdateraInkorg, enhetLista, laddaEnheter } from '../app.js';
// Runda 6, r4: bilagor, vidarebefordran och ledtider.
import { ledtiderHtml, lasFil, BILAGA_TEXT } from '../planering-ui.js';
// Runda 8, r2: fördelning, remisskonferens, på uppdrag och pappersremiss.
import * as r8 from '../remiss-r8-ui.js';
import { S } from '../app.js';

export const namn = 'remisser';

export function remissStatusText(r) {
  if (r.status === 'skickad') return 'Skickad, väntar på mottagningskvittens';
  if (r.status === 'mottagen') return 'Mottagen, väntar på bedömning';
  if (r.status === 'bedomd' && r.beslut === 'avvisad') return 'Avvisad';
  if (r.status === 'bedomd' && r.beslut === 'vidarebefordrad') return `Vidarebefordrad till ${r.vidarebefordrad?.till?.namn ?? 'en annan vårdenhet'}`;
  if (r.status === 'bedomd') return 'Accepterad, väntar på svar';
  if (r.status === 'besvarad') return 'Besvarad, svaret väntar på kvittens';
  if (r.status === 'svar_kvitterat') return 'Svaret är kvitterat';
  return r.status;
}

const STEG = [
  ['skickad', 'Skickad', 'skickad', 'avsandare'],
  ['mottagen', 'Mottagen', 'mottagen', 'mottagen'],
  ['bedomd', 'Bedömd', 'bedomd', 'bedomd'],
  ['besvarad', 'Besvarad', 'besvarad', 'besvarad'],
  ['svar_kvitterat', 'Svar kvitterat', 'svarKvitterat', 'svarKvitterat'],
];
const ORDNING = STEG.map(s => s[0]);

function kedja(r) {
  const nu = ORDNING.indexOf(r.status);
  const avvisad = r.beslut === 'avvisad' || r.beslut === 'vidarebefordrad';
  return `<ol class="kedja" aria-label="Remissens statuskedja">${STEG.map(([k, t, tid, av], i) => {
    const gjord = i <= nu;
    const stopp = avvisad && i > ORDNING.indexOf('bedomd');
    const vem = av === 'avsandare' ? r.avsandare : r.av?.[av];
    const text = k === 'bedomd' && gjord ? (r.beslut === 'vidarebefordrad' ? 'Vidarebefordrad' : avvisad ? 'Avvisad' : 'Accepterad') : t;
    const lage = stopp ? 'stoppad' : gjord ? (k === 'bedomd' && avvisad ? 'avvisad' : 'klar') : i === nu + 1 ? 'nasta' : 'vantar';
    const sr = stopp ? 'avslutad, remissen avvisades' : gjord ? 'klart' : i === nu + 1 ? 'nästa steg' : 'inte än';
    return `<li class="steg steg-${lage}"><span class="steg-punkt" aria-hidden="true">${gjord ? (lage === 'avvisad' ? ikon.kryss : ikon.bock) : ''}</span>
      <span class="steg-text"><strong>${esc(text)}</strong><span class="sr"> (${sr})</span>${gjord && r.tider[tid] ? `<span class="under-text">${esc(tidpunkt(r.tider[tid]))}${vem ? `, ${esc(vem.namn)}` : ''}</span>` : ''}</span></li>`;
  }).join('')}</ol>`;
}

export function atgarder(r) {
  const ve = minVardenhet();
  const a = [];
  // Runda 8, r2: den som registrerade en pappersremiss tar inte emot och handlägger den inte.
  if (r.extern?.registreradAv?.id && r.extern.registreradAv.id === S.session?.personal?.id) return a;
  if (r.status === 'skickad' && r.till.id === ve && far('mottag_remiss')) a.push(['mottag', 'Kvittera mottagen']);
  if (r.status === 'mottagen' && r.till.id === ve && far('bedom_remiss')) a.push(['bedom', 'Bedöm']);
  if (r.status === 'bedomd' && r.beslut === 'accepterad' && r.till.id === ve && far('svara_remiss')) a.push(['svara', 'Svara']);
  if (r.status === 'besvarad' && r.fran.id === ve && far('kvittera_svar')) a.push(['kvittera', 'Kvittera svaret']);
  // Runda 6, r4: mottagaren skickar vidare före bedömningen, och avsändaren kompletterar med en bilaga fram till svaret.
  if (['skickad', 'mottagen'].includes(r.status) && r.till.id === ve && far('bedom_remiss')) a.push(['vidarebefordra', 'Skicka vidare']);
  if ((['skickad', 'mottagen'].includes(r.status) || (r.status === 'bedomd' && r.beslut === 'accepterad')) && r.fran.id === ve && far('remittera')) a.push(['bilaga', 'Komplettera med bilaga']);
  // Runda 8, r2: fördela till en läkare och sätta på remisskonferens.
  a.push(...r8.atgarder(r));
  return a;
}

// Runda 6, r4: bilagor, vidarebefordran och egen vårdbegäran på remisskortet.
function r4Html(r, klinisk) {
  const bilagor = klinisk && r.bilagor?.length ? `<ul class="enkel-lista remiss-bilagor">${r.bilagor.map(b => `<li><a href="/api/bilaga/${b.id}" download>${esc(b.namn)}</a> <span class="dampad liten">${esc(b.typText)}, ${esc(Math.ceil(b.storlek / 1024))} kB${b.avPatienten ? ', från patienten' : ''}</span></li>`).join('')}</ul>`
    : !klinisk && r.antalBilagor ? `<p class="dampad liten">${esc(r.antalBilagor)} ${r.antalBilagor === 1 ? 'bilaga' : 'bilagor'}. Bilagor är journalhandlingar och visas inte för vårdadministratörer.</p>` : '';
  const vb = r.vidarebefordrad ? `<p class="ruta ruta-info liten">Vidarebefordrad till ${esc(r.vidarebefordrad.till.namn)} ${esc(tidpunkt(r.vidarebefordrad.tid))}${r.vidarebefordrad.av ? ` av ${esc(r.vidarebefordrad.av.namn)}` : ''}.${r.vidarebefordrad.motivering ? ` ${esc(r.vidarebefordrad.motivering)}` : ''}</p>` : '';
  const fran = r.vidarebefordradFran ? `<p class="ruta ruta-info liten">Vidarebefordrad från ${esc(r.vidarebefordradFran.fran.namn)} ${esc(tidpunkt(r.vidarebefordradFran.tid))}.${r.vidarebefordradFran.motivering ? ` ${esc(r.vidarebefordradFran.motivering)}` : ''}</p>` : '';
  // Runda 8, r2: på uppdrag, fördelning, konferens, beslut på uppdrag och pappersremiss.
  return `${bilagor}${vb}${fran}${r8.kortHtml(r)}`;
}

export function remissKort(r, { visaPatient = false, markerad = false } = {}) {
  const klinisk = r.fragestallning != null;
  const a = atgarder(r);
  const patient = visaPatient && r.patient ? (r.patient.skyddad
    ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span> <span class="pnr">${esc(r.patient.personnummer)}</span>`
    : `<a href="#/patient/${encodeURIComponent(r.patient.id)}/remisser">${esc(r.patient.namn)}</a> <span class="pnr">${esc(r.patient.personnummer)}</span>`) : '';
  return `<article class="remiss${markerad ? ' markerad' : ''}${r.larm?.length ? ' har-larm' : ''}" id="remiss-${r.id}" aria-labelledby="rem-${r.id}-rubrik">
    <header class="remiss-huvud">
      <h3 id="rem-${r.id}-rubrik">${patient ? `${patient}<span class="remiss-riktning">` : '<span class="remiss-riktning">'}Från ${esc(r.fran.namn)} till ${esc(r.till.namn)}</span></h3>
      <p class="remiss-meta"><span class="prio prio-${esc(r.prioritet)}">${esc(PRIORITET_REMISS[r.prioritet] ?? r.prioritet)}</span><span>Svar senast ${esc(datum(r.svarSenast))}</span><span>Remitterande ${esc(r.avsandare?.namn ?? '')}</span>${migreradEtikett(r)}${r.egen ? '<span class="tagg">Egen vårdbegäran</span>' : ''}</p>
    </header>
    ${kedja(r)}
    ${r.larm?.length ? `<ul class="larmlista">${r.larm.map(l => `<li>${ikon.larm}<span>${esc(l.text)}</span></li>`).join('')}</ul>` : ''}
    ${klinisk ? `<dl class="remiss-text">
      <div><dt>Frågeställning</dt><dd>${esc(r.fragestallning)}</dd></div>
      ${r.anamnes ? `<div><dt>Anamnes</dt><dd>${esc(r.anamnes)}</dd></div>` : ''}
      ${r.motivering ? `<div><dt>${r.beslut === 'avvisad' ? 'Motivering till avvisning' : 'Kommentar vid bedömning'}</dt><dd>${esc(r.motivering)}</dd></div>` : ''}
      ${r.svar ? `<div><dt>Svar</dt><dd>${esc(r.svar)}</dd></div>` : ''}
    </dl>` : '<p class="dampad liten">Frågeställning, anamnes och svar är journaltext och visas inte för vårdadministratörer.</p>'}
    ${r4Html(r, klinisk)}
    ${a.length ? `<div class="knapprad">${a.map(([k, t], i) => `<button type="button" class="knapp liten${i ? ' sekundar' : ''}" data-remiss-atgard="${k}" data-id="${r.id}">${esc(t)}</button>`).join('')}</div>` : ''}
  </article>`;
}

// Kopplar åtgärdsknapparna i en behållare. efter() körs när en åtgärd lyckats.
export function kopplaAtgarder(behallare, hamta, efter) {
  behallare.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-remiss-atgard]');
    if (!b) return;
    const id = b.dataset.id;
    const r = hamta(id);
    const typ = b.dataset.remissAtgard;
    let data = {};
    // Runda 5, r4: vad en avvisning gör med läkemedel som väntar på en vårdhändelse hämtas redan när dialogen öppnas.
    let avvisning = null;
    if (typ === 'bedom') {
      const forhand = api(`/api/remiss/${id}/avvisning`, { tyst: true }).catch(() => null);
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Bedöm remissen</h2>
        <p>Från ${esc(r.fran.namn)}. ${esc(r.fragestallning ?? '')}</p>
        <fieldset class="radiogrupp"><legend>Beslut</legend>
          <div class="radio"><input type="radio" id="b-acc" name="beslut" value="accepterad" checked><label for="b-acc">Acceptera</label></div>
          <div class="radio"><input type="radio" id="b-avv" name="beslut" value="avvisad"><label for="b-avv">Avvisa</label></div>
        </fieldset>
        ${r8.tidsramHtml(r.prioritet)}
        <div class="falt"><label for="b-mot">Motivering <span class="obl">(obligatorisk vid avvisning)</span></label><textarea id="b-mot" name="motivering" rows="3" maxlength="2000"></textarea></div>
        <div class="b-avvisning" data-avvisning hidden></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara bedömningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      {
        validera: (x) => (x.beslut === 'avvisad' && x.motivering.trim().length < 3 ? 'En avvisad remiss måste ha en motivering.' : null),
        onOpen: (dl) => {
          const plats = dl.querySelector('[data-avvisning]');
          const visa = () => { plats.hidden = !(dl.querySelector('#b-avv').checked && plats.innerHTML); dl.querySelector('[data-tidsram]').hidden = dl.querySelector('#b-avv').checked; };
          dl.querySelectorAll('input[name="beslut"]').forEach(r => r.addEventListener('change', visa));
          forhand.then((f) => {
            if (!f || (!f.vardhandelser.length && !f.dolda) || !plats.isConnected) return;
            avvisning = f;
            plats.innerHTML = avvisningHtml(f);
            visa();
          });
        },
      });
      if (!svar) return;
      data = { beslut: svar.data.beslut, motivering: svar.data.motivering.trim() };
      // Runda 8, r2: inom vilken tid besöket ska ske.
      if (data.beslut === 'accepterad' && svar.data.besokInomDagar) data.besokInomDagar = Number(svar.data.besokInomDagar);
      if (data.beslut === 'avvisad' && avvisning?.vardhandelser.length) {
        data.vardhandelser = avvisning.vardhandelser.map(v => ({ ordinationId: v.ordinationId, val: svar.data[`vh_${v.ordinationId}`], orsak: svar.data[`orsak_${v.ordinationId}`] }));
      }
    } else if (typ === 'fordela') {
      // Runda 8, r2: ett klick på läkaren fördelar remissen.
      await r8.fordela(r, efter);
      return;
    } else if (typ === 'konferens') {
      await r8.tillKonferens(r, efter);
      return;
    } else if (typ === 'vidarebefordra') {
      // Runda 6, r4: systemet kvitterar mottagningen och skickar remissen vidare med samma avsändare.
      await laddaEnheter();
      const enheter = enhetLista().filter(x => x.typ === 'vardenhet' && x.id !== minVardenhet() && x.id !== r.fran.id).sort((x, y) => x.namn.localeCompare(y.namn, 'sv'));
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Skicka remissen vidare</h2>
        <div class="dialog-text"><p>Från ${esc(r.fran.namn)}. Remissen går vidare med samma avsändare, så att svaret kommer rätt. Systemet kvitterar att den har kommit fram till er.</p></div>
        <div class="falt"><label for="vb-till">Till vårdenhet</label><select id="vb-till" name="tillEnhetId" required><option value="">Välj vårdenhet</option>${enheter.map(x => `<option value="${esc(x.id)}">${esc(x.namn)}</option>`).join('')}</select></div>
        <div class="falt"><label for="vb-mot">Motivering <span class="obl">(obligatorisk)</span></label><textarea id="vb-mot" name="motivering" rows="3" maxlength="1000" required></textarea></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka vidare</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (!x.tillEnhetId ? 'Välj vårdenhet.' : x.motivering.trim().length < 3 ? 'Skriv varför remissen skickas vidare.' : null) });
      if (!svar) return;
      try {
        const ny = await api(`/api/remiss/${id}/vidarebefordra`, { metod: 'POST', data: { tillEnhetId: svar.data.tillEnhetId, motivering: svar.data.motivering.trim() } });
        notis(`Remissen är skickad vidare till ${ny.ny.till.namn}. Avsändaren ser var den är.`);
        await uppdateraInkorg();
        efter(ny.gammal);
      } catch (err) { felNotis(err); }
      return;
    } else if (typ === 'bilaga') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Komplettera med en bilaga</h2>
        <div class="falt"><label for="rb-fil">Fil</label><input id="rb-fil" name="fil" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" required></div>
        <p class="hjalp">${esc(BILAGA_TEXT)}</p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Bifoga</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      const fil = svar?.data?.fil;
      if (!fil || !fil.size) return;
      try {
        await api(`/api/remiss/${id}/bilagor`, { metod: 'POST', data: await lasFil(fil) });
        notis('Bilagan är bifogad. Mottagaren ser den på remissen.');
        efter(r);
      } catch (err) { felNotis(err); }
      return;
    } else if (typ === 'svara') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Svara på remissen</h2>
        <p>Frågeställning: ${esc(r.fragestallning ?? '')}</p>
        <div class="falt"><label for="s-svar">Svar <span class="obl">(obligatoriskt)</span></label><textarea id="s-svar" name="svar" rows="6" required minlength="3" maxlength="8000"></textarea></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka svaret</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.svar.trim().length < 3 ? 'Skriv ett svar.' : null) });
      if (!svar) return;
      data = { svar: svar.data.svar.trim() };
    }
    const vag = { mottag: 'mottag', bedom: 'bedom', svara: 'svara', kvittera: 'kvittera-svar' }[typ];
    b.disabled = true;
    try {
      const ny = await api(`/api/remiss/${id}/${vag}`, { metod: 'POST', data });
      // Läkemedel som sattes ut eller behölls vid avvisningen, och läkemedel som den som avvisar inte kan se (runda 5, r4).
      const utsatta = (ny.vardhandelser ?? []).filter(v => v.val === 'satt_ut').map(v => avvisning?.vardhandelser.find(x => x.ordinationId === v.ordinationId)?.lakemedel).filter(Boolean);
      if (utsatta.length) notis(`Remissen är avvisad, och ${utsatta.join(' och ')} är utsatt.`);
      if (ny.dolda) notis(ny.dolda, 'info');
      if (!utsatta.length) notis({ mottag: 'Remissen är kvitterad som mottagen.', bedom: ny.beslut === 'avvisad' ? 'Remissen är avvisad. Remittenten ser motiveringen.' : `Remissen är accepterad.${ny.vantelista?.besokInomDagar ? ` Besöket ska ske ${r8.TIDSRAMAR.find(t => t.dagar === ny.vantelista.besokInomDagar)?.text}.` : ''}`, svara: 'Svaret är skickat till remittenten.', kvittera: 'Svaret är kvitterat. Remisskedjan är avslutad.' }[typ]);
      await uppdateraInkorg();
      efter(ny);
    } catch (err) { felNotis(err); if (b.isConnected) b.disabled = false; }
  });
}

// Frågan när en avvisning avbokar en vårdhändelse som ett läkemedel väntar på (runda 5, r4). Sätt ut är förvalt med
// systemets orsak, Behåll visas bara när någon fortfarande har grund, och Avbryt i dialogen avvisar inte remissen.
function avvisningHtml(f) {
  return `${f.vardhandelser.map(v => `<fieldset class="radiogrupp"><legend>${esc(v.fraga)}</legend>
      <div class="radio"><input type="radio" id="vh-${v.ordinationId}-ut" name="vh_${v.ordinationId}" value="satt_ut" checked><label for="vh-${v.ordinationId}-ut">Sätt ut</label></div>
      ${v.kanBehalla ? `<div class="radio"><input type="radio" id="vh-${v.ordinationId}-beh" name="vh_${v.ordinationId}" value="behall"><label for="vh-${v.ordinationId}-beh">Behåll och sätt upp vårdhändelsen igen</label></div>` : `<p class="hjalp">${esc(v.varforInteBehalla)}</p>`}
      <div class="falt"><label for="vh-${v.ordinationId}-orsak">Orsak till utsättningen</label><input id="vh-${v.ordinationId}-orsak" name="orsak_${v.ordinationId}" value="${esc(v.orsak)}" maxlength="300"></div>
    </fieldset>`).join('')}
    ${f.dolda ? `<p class="hjalp">${esc(f.dolda)}</p>` : ''}
    ${f.vardhandelser.length ? '<p class="hjalp">Välj Avbryt om remissen inte ska avvisas.</p>' : ''}`;
}

export async function visa(main, _p, q) {
  const riktning = q.get('riktning') === 'utgaende' ? 'utgaende' : 'inkommande';
  // Runda 8, r2: remisskonferensen som en egen delflik.
  const konferens = q.get('vy') === 'konferens' && (far('remisskonferens') || far('bedom_remiss'));
  const markerad = q.get('remiss');
  main.innerHTML = vyRubrik('Remisser', 'Remisser till och från din vårdenhet. Varje steg kvitteras, och uteblivna steg ger larm i inkorgen.') + `
    <nav class="delflikar" aria-label="Riktning"><ul>
      <li><a href="#/remisser?riktning=inkommande"${riktning === 'inkommande' && !konferens ? ' aria-current="page"' : ''}>Inkommande</a></li>
      <li><a href="#/remisser?riktning=utgaende"${riktning === 'utgaende' && !konferens ? ' aria-current="page"' : ''}>Utgående</a></li>
      ${far('remisskonferens') || far('bedom_remiss') ? `<li><a href="#/remisser?vy=konferens"${konferens ? ' aria-current="page"' : ''}>Remisskonferens</a></li>` : ''}
    </ul></nav>
    <div id="remiss-skannade"></div><div id="remisslista"><p class="tom">Hämtar remisser.</p></div><div id="remiss-ledtider"></div>`;
  // Runda 6, r4: ledtider och avvikelser för vårdenheten, utan personuppgifter.
  if (far('statistik')) api('/api/remisser/statistik', { tyst: true }).then(s => { const p = main.querySelector('#remiss-ledtider'); if (p) p.innerHTML = ledtiderHtml(s); }).catch(() => {});
  const el = main.querySelector('#remisslista');
  // Runda 8, r2: konferensen i stället för listan, och de inskannade pappersremisserna ovanför de inkommande.
  if (konferens) { await r8.konferensVy(el, { remissKort, kopplaAtgarder }); return; }
  let lista = [];
  const rita = async () => {
    const d = await api(`/api/remisser?riktning=${riktning}`);
    lista = d.remisser;
    const pagaende = lista.filter(r => r.status !== 'svar_kvitterat' && !['avvisad', 'vidarebefordrad'].includes(r.beslut));
    const avslutade = lista.filter(r => !pagaende.includes(r));
    el.innerHTML = !lista.length ? tom(riktning === 'inkommande' ? 'Inga remisser till din vårdenhet.' : 'Inga remisser från din vårdenhet.') : `
      <section aria-labelledby="rp"><h2 id="rp">Pågående <span class="antal">${pagaende.length}</span></h2>${pagaende.map(r => remissKort(r, { visaPatient: true, markerad: String(r.id) === markerad })).join('') || tom('Inga pågående.')}</section>
      ${avslutade.length ? `<section aria-labelledby="ra"><h2 id="ra">Avslutade <span class="antal">${avslutade.length}</span></h2>${avslutade.map(r => remissKort(r, { visaPatient: true, markerad: String(r.id) === markerad })).join('')}</section>` : ''}`;
    if (markerad) el.querySelector(`#remiss-${CSS.escape(markerad)}`)?.scrollIntoView({ block: 'center' });
  };
  kopplaAtgarder(el, (id) => lista.find(r => String(r.id) === String(id)), () => rita().catch(felNotis));
  if (riktning === 'inkommande') {
    const sk = main.querySelector('#remiss-skannade');
    const skannade = () => r8.skannadeSektion(sk, () => { skannade(); rita().catch(felNotis); });
    skannade();
  }
  await rita();
}
