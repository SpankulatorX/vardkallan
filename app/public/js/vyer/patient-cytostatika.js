// Cytostatika i patientens journal (runda 11, r4, Sussa 4.8.1.1 till 4.8.1.7). Läkaren ordinerar ur regimbiblioteket och
// godkänner kuren när systemet har prövat provsvaren, den kumulativa dosen och beredningsenhetens platser. Sjuksköterskan
// tar emot beredningen, ger premedicineringen, iordningställer vid sängen och ger kuren med dubbelkontroll, och
// registrerar infusionens start, avbrott, reaktioner och slut. Systemet räknar doser, takt och tabletter och säger vad
// som ska göras härnäst.
import { esc, api, tidpunkt, datum, notis, medKnapp, ikon, tal } from '../ui.js';
import { far, S } from '../app.js';

export const namn = 'patient-cytostatika';

const sv = (v, d = 1) => (v == null ? '' : tal(v, d));
const DOSSTEG = { beredd: 'ta-emot', mottagen: 'iordningstall', vantar_kontroll: 'kontrollera' };
let REAKTIONER = [];

// Läsningen vid sängen: id-bandet och etiketten skannas. Demoknappen fyller i det som en läsare skulle läsa.
function sangen(id, steg, etikett, pnr, { armband = true } = {}) {
  return `<form class="cy-sangen falt-rad" data-cy-form="${esc(steg)}" data-dos="${esc(id)}" novalidate>
    ${armband ? `<div class="falt smal"><label for="cy-arm-${esc(id)}-${esc(steg)}">Id-band</label><input id="cy-arm-${esc(id)}-${esc(steg)}" name="armband" autocomplete="off" inputmode="numeric"></div>` : ''}
    <div class="falt smal"><label for="cy-et-${esc(id)}-${esc(steg)}">Etikett</label><input id="cy-et-${esc(id)}-${esc(steg)}" name="streckkod" autocomplete="off"></div>
    <div class="falt knappfalt knapprad"><button type="button" class="knapp liten sekundar" data-cy-las="${esc(pnr)}|${esc(etikett)}">Läs med skannern (demo)</button>
      <button type="submit" class="knapp liten">${{ 'ta-emot': 'Ta emot', iordningstall: 'Iordningställ', kontrollera: 'Dubbelkontrollera' }[steg]}</button></div>
  </form>`;
}

function dosRad(d, k, b, pnr) {
  const kan = far('ge_cytostatika') && b.vardenhet?.id && b.status === 'pagaende';
  const jag = S.session?.personal?.namn;
  const steg = kan && k.status === 'godkand' ? DOSSTEG[d.status] : null;
  let atg = '';
  if (steg === 'kontrollera' && d.iordningstalldAv === jag) atg = `<p class="under-text">Väntar på att en annan sjuksköterska eller läkare kontrollerar i sin egen inloggning.</p>`;
  else if (steg && !(d.peroral && steg === 'ta-emot')) atg = sangen(d.id, d.peroral && d.status === 'beredd' ? 'iordningstall' : steg, d.etikett, pnr, { armband: steg !== 'ta-emot' });
  else if (kan && d.peroral && d.status === 'beredd') atg = sangen(d.id, 'iordningstall', d.etikett, pnr);
  else if (kan && d.status === 'kontrollerad') atg = `<p class="knapprad"><button type="button" class="knapp liten" data-cy-dos="${d.peroral ? 'ge' : 'starta'}" data-dos="${d.id}">${d.peroral ? 'Överlämna till patienten' : 'Starta infusionen'}</button></p>`;
  else if (kan && d.status === 'pagar') {
    atg = `<p class="knapprad"><button type="button" class="knapp liten" data-cy-dos="avsluta" data-dos="${d.id}">Avsluta, allt har gått in</button>
      <button type="button" class="knapp liten sekundar" data-cy-oppna="paus-${d.id}">Pausa</button><button type="button" class="knapp liten sekundar" data-cy-oppna="reak-${d.id}">Reaktion</button>
      <button type="button" class="knapp liten knapp-allvar" data-cy-dos="extravasering" data-dos="${d.id}">Extravasering</button></p>`;
  } else if (kan && d.status === 'pausad') {
    atg = `<form class="falt-rad" data-cy-form="ateruppta" data-dos="${d.id}" novalidate><div class="falt smal"><label for="cy-pr-${d.id}">Takt</label><select id="cy-pr-${d.id}" name="procent"><option value="100">Full takt</option><option value="75">75 procent</option><option value="50">50 procent</option></select></div>
      <div class="falt knappfalt knapprad"><button type="submit" class="knapp liten">Återuppta</button><button type="button" class="knapp liten sekundar" data-cy-oppna="reak-${d.id}">Reaktion</button>
      <button type="button" class="knapp liten knapp-allvar" data-cy-dos="extravasering" data-dos="${d.id}">Extravasering</button></div></form>`;
  }
  const paus = `<form class="falt-rad" data-cy-form="pausa" data-dos="${d.id}" id="paus-${d.id}" hidden novalidate><div class="falt"><label for="cy-po-${d.id}">Varför pausas infusionen</label><input id="cy-po-${d.id}" name="orsak" maxlength="200" autocomplete="off"></div><div class="falt knappfalt"><button type="submit" class="knapp liten">Pausa</button></div></form>`;
  const reak = `<form class="falt-rad" data-cy-form="reaktion" data-dos="${d.id}" id="reak-${d.id}" hidden novalidate>
    <div class="falt"><label for="cy-rt-${d.id}">Reaktion</label><select id="cy-rt-${d.id}" name="typ">${REAKTIONER.map(r => `<option value="${esc(r.id)}">${esc(r.namn)}</option>`).join('')}</select></div>
    <div class="falt smal"><label for="cy-rg-${d.id}">Grad</label><select id="cy-rg-${d.id}" name="grad"><option value="1">1, lindrig</option><option value="2">2, måttlig</option><option value="3">3, svår</option><option value="4">4, livshotande</option></select></div>
    <div class="falt knappfalt"><button type="submit" class="knapp liten">Registrera</button></div></form>`;
  const info = [d.berakning, d.volym ? `${sv(d.volym)} ml${d.infusionMinuter ? ` på ${d.infusionMinuter} minuter` : ''}` : '', d.takt ? `${d.takt} ml/h` : '',
    d.beredning ? `Beredd av ${d.beredning.av}, batch ${d.beredning.batcher.join(' och ')}` : ''].filter(Boolean).join('. ');
  return `<li class="cy-dos cy-dos-${esc(d.status)}"><p><strong>${esc(d.lakemedel)} ${esc(sv(d.dos, 0))} mg</strong> <span class="tagg">${esc(d.statusText)}</span> <span class="under-text">Etikett ${esc(d.etikett)}</span></p>
    <p class="under-text">${esc(info)}</p>
    ${d.infusion.length ? `<ul class="enkel-lista under-text">${d.infusion.map(h => `<li>${esc(tidpunkt(h.tid))}, ${esc(h.av ?? '')}: ${esc(h.text ?? h.typ)}</li>`).join('')}</ul>` : ''}
    ${d.patientrapporter.length ? `<details><summary>Patientens rapporter i Min journal, ${d.patientrapporter.length}</summary><ul class="enkel-lista">${d.patientrapporter.map(r => `<li class="${r.bedomning === 'ok' ? '' : 'text-larm'}">${esc(datum(r.datum))}: ${r.morgon ? 'morgon' : 'inte morgon'}, ${r.kvall ? 'kväll' : 'inte kväll'}${r.feber ? `, ${esc(sv(r.feber))} grader` : ''}${r.diarre ? `, diarré ${r.diarre} gånger` : ''}${r.handfot ? `, hand och fot grad ${r.handfot}` : ''}. ${esc(r.rad)}</li>`).join('')}</ul></details>` : ''}
    ${atg}${d.status === 'pagar' || d.status === 'pausad' ? paus + reak : ''}
  </li>`;
}

function kurHtml(k, b, pnr, prov) {
  const kanOrd = far('ordinera_cytostatika') && b.status === 'pagaende';
  const premed = k.premedicinering.length ? `<p><strong>Premedicinering:</strong> ${k.premedicinering.map(p => `${esc(`${p.namn} ${p.dos} ${p.vag}`)} ${p.status === 'given' ? `<span class="tagg">Given ${esc(tidpunkt(p.given.tid))}</span>` : far('ge_cytostatika') && k.status === 'godkand' ? `<button type="button" class="knapp liten sekundar" data-cy-premed="${p.id}">Ge</button>` : ''}`).join(', ')}
    <span class="under-text">${esc(k.premedicinering[0].minuterFore)} minuter före kuren. Systemet släpper inte cytostatikan förrän premedicineringen är given.</span></p>` : '';
  let atg = '';
  if (kanOrd && k.status === 'planerad') {
    atg = `${prov ? `<p class="ruta ${prov.ok ? 'ruta-info' : 'ruta-obs'} liten">${prov.ok ? ikon.bock : ikon.varning}<span>${esc(prov.text)}</span></p>` : ''}
      <div class="knapprad"><button type="button" class="knapp liten" data-cy-kur="godkann" data-cykel="${k.id}"${prov && !prov.ok ? ' disabled' : ''}>Godkänn kuren</button>
      ${prov?.saknasAnalyser?.length ? `<button type="button" class="knapp liten sekundar" data-cy-kur="prover" data-cykel="${k.id}">Beställ proverna</button>` : ''}
      <button type="button" class="knapp liten sekundar" data-cy-kur="skjut-upp" data-cykel="${k.id}">Skjut upp en vecka</button>
      <button type="button" class="knapp liten sekundar" data-cy-oppna="dj-${k.id}">Justera dosen</button></div>
      <form class="falt-rad" id="dj-${k.id}" data-cy-form="dosjustera" data-cykel="${k.id}" hidden novalidate>
        <div class="falt smal"><label for="cy-da-${k.id}">Andel av full dos</label><select id="cy-da-${k.id}" name="dosandel">${[100, 90, 80, 75, 60, 50].map(x => `<option value="${x}"${x === k.dosandel ? ' selected' : ''}>${x} procent</option>`).join('')}</select></div>
        <div class="falt"><label for="cy-do-${k.id}">Orsak</label><input id="cy-do-${k.id}" name="orsak" maxlength="200" autocomplete="off"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp liten">Räkna om doserna</button></div><p class="form-fel" role="alert" hidden></p></form>`;
  }
  return `<article class="cy-kur" aria-labelledby="cy-k-${k.id}"><h4 id="cy-k-${k.id}">Cykel ${k.nummer}, ${esc(datum(k.dag1))} <span class="tagg">${esc(k.statusText)}</span></h4>
    <p class="under-text">Kroppsyta ${esc(sv(k.kroppsyta, 2))} m² (längd ${esc(sv(k.langd, 0))} cm, vikt ${esc(sv(k.vikt))} kg)${k.gfr ? `, GFR ${esc(k.gfr)} ml/min` : ''}. ${k.dosandel < 100 ? `${k.dosandel} procent av full dos: ${esc(k.dosandelOrsak ?? '')}.` : 'Full dos.'}${k.godkand ? ` Godkänd ${esc(tidpunkt(k.godkand.tid))} av ${esc(k.godkand.av)}.` : ''}</p>
    ${k.avvikelser.length ? `<div class="ruta ruta-obs liten">${ikon.info}<div><strong>Skillnad mot förra kuren:</strong> ${k.avvikelser.map(esc).join(' ')}</div></div>` : ''}
    ${k.kapacitet ? `<p class="under-text">Beredningsenheten har ${k.kapacitet.lediga} av ${k.kapacitet.platser} platser lediga ${esc(datum(k.dag1))}.</p>` : ''}
    ${premed}
    <ul class="cy-doser">${k.doser.map(d => dosRad(d, k, b, pnr)).join('')}</ul>
    ${atg}
  </article>`;
}

function behandlingHtml(b, pnr, prov) {
  const aktuell = b.kurer.filter(k => k.status !== 'klar').at(-1) ?? b.kurer.at(-1);
  const tidigare = b.kurer.filter(k => k !== aktuell);
  const kanNasta = far('ordinera_cytostatika') && b.status === 'pagaende' && aktuell.status === 'klar';
  return `<section class="ov-sektion cy-behandling" aria-labelledby="cy-b-${b.id}"><div class="sektion-huvud"><h3 id="cy-b-${b.id}">${esc(b.regim.namn)}, version ${esc(b.regim.version)}</h3>
      <p class="under-text">${esc(b.cykler)} cykler var ${esc(b.regim.intervall)}:e dag från ${esc(datum(b.start))}. ${b.status === 'pagaende' ? 'Pågår' : 'Avslutad'}. Ordinerad av ${esc(b.ordinerad.av)}, ${esc(b.vardenhet?.namn ?? '')}. Bereds av ${esc(b.beredningsenhet)}.</p></div>
    ${b.kumulativ.map(x => `<p class="ruta ${x.overskrids ? 'ruta-larm' : 'ruta-info'} liten">${x.overskrids ? ikon.larm : ikon.info}<span><strong>Kumulativ dos.</strong> ${esc(x.text)}</span></p>`).join('')}
    ${kurHtml(aktuell, b, pnr, prov)}
    ${kanNasta ? `<p class="knapprad"><button type="button" class="knapp" data-cy-nasta="${b.id}">Planera nästa cykel</button> <span class="under-text">Systemet räknar om doserna med dagens vikt.</span></p>` : ''}
    ${tidigare.length ? `<details><summary>Tidigare cykler, ${tidigare.length}</summary>${tidigare.map(k => kurHtml(k, { ...b, status: 'avslutad' }, pnr, null)).join('')}</details>` : ''}
    <details><summary>Historik</summary><ul class="enkel-lista">${b.historik.map(h => `<li>${esc(tidpunkt(h.tid))}, ${esc(h.av ?? '')}: ${esc(h.detalj ?? h.handelse)}</li>`).join('')}</ul></details>
  </section>`;
}

function ordinationHtml(d, idag) {
  const imorgon = new Date(Date.parse(`${idag}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  return `<form class="mv-form" id="cy-ord" novalidate aria-labelledby="cy-ord-r"><h3 id="cy-ord-r">Ordinera ur regimbiblioteket</h3>
    <p class="hjalp">Systemet hämtar längd och vikt ur journalen, räknar kroppsyta, njurfunktion och varje dos och lägger ut cyklerna med premedicineringen. Du väljer regim och startdag.</p>
    <div class="falt-rad">
      <div class="falt"><label for="cy-regim">Regim</label><select id="cy-regim" name="regim">${d.regimer.map(r => `<option value="${esc(r.id)}">${esc(r.namn)}, version ${esc(r.version)}</option>`).join('')}</select></div>
      <div class="falt smal"><label for="cy-start">Startdag</label><input id="cy-start" name="start" type="date" value="${esc(imorgon)}" min="${esc(idag)}"></div>
    </div>
    <p class="under-text" id="cy-regim-info"></p>
    <div class="knapprad"><button type="submit" class="knapp">Ordinera</button> <a class="knapp sekundar" href="#/cytostatika/regimer">Regimbiblioteket</a></div>
    <p class="form-fel" role="alert" hidden></p>
  </form>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/cytostatika`);
  REAKTIONER = d.reaktioner;
  const pagande = d.behandlingar.find(b => b.status === 'pagaende');
  const planerad = pagande?.kurer.find(k => k.status === 'planerad');
  const prov = planerad && far('ordinera_cytostatika') ? await api(`/api/cytostatika/cykel/${planerad.id}/provkontroll`).catch(() => null) : null;
  if (!ctx.aktuell()) return;
  const pnr = ctx.patient?.personnummer ?? '';
  const idag = S.session?.demoDatum ?? new Date().toISOString().slice(0, 10);
  el.innerHTML = `<div class="flikhuvud"><h2>Cytostatika</h2><p class="dampad">Behandling ur regimbiblioteket, beredningen, premedicineringen och administreringen med dubbelkontroll.</p></div>
    ${!pagande && far('ordinera_cytostatika') ? ordinationHtml(d, idag) : ''}
    ${d.behandlingar.length ? d.behandlingar.map(b => behandlingHtml(b, pnr, b === pagande ? prov : null)).join('') : '<p class="tom">Ingen cytostatikabehandling som du kan se.</p>'}
    <p class="under-text">${esc(d.demoregel)}</p>`;

  const info = () => {
    const f = el.querySelector('#cy-ord');
    if (!f) return;
    const r = d.regimer.find(x => x.id === f.regim.value);
    el.querySelector('#cy-regim-info').textContent = `${r.cykler} cykler var ${r.intervall}:e dag. ${r.lakemedel.map(l => `${l.namn} ${l.dos}`).join(', ')}.${r.premedicinering.length ? ` Premedicinering: ${r.premedicinering.join(', ')}.` : ''}`;
  };
  info();
  el.querySelector('#cy-regim')?.addEventListener('change', info);
  const post = async (knapp, vag, data = {}, form = null, text = null) => {
    try {
      const r = await medKnapp(knapp, () => api(vag, { metod: 'POST', data }), form);
      if (r?.rad) notis(r.rad.text, r.rad.atgard === 'fortsatt' ? 'info' : 'fel', { kvar: r.rad.atgard !== 'fortsatt' });
      else if (r?.instruktion) notis(r.instruktion, 'info', { kvar: true });
      else if (text) notis(text);
      ctx.ladda();
    } catch (e) {
      // Beredningsenheten är full: systemet föreslår den första lediga dagen.
      if (e?.kod === 'kapacitet' && e.data?.dagar && knapp?.dataset.cykel) {
        const b2 = document.createElement('button');
        b2.type = 'button'; b2.className = 'knapp liten'; b2.textContent = `Skjut upp till ${datum(e.data.forslag)}`;
        b2.addEventListener('click', () => post(b2, `/api/cytostatika/cykel/${knapp.dataset.cykel}/skjut-upp`, { dagar: e.data.dagar, orsak: 'Beredningsenheten har inga lediga platser' }, null, 'Kuren är uppskjuten.'));
        knapp.after(b2);
      }
    }
  };
  el.querySelector('#cy-ord')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    post(f.querySelector('[type=submit]'), `/api/patient/${encodeURIComponent(ctx.id)}/cytostatika`, { regim: f.regim.value, start: f.start.value }, f, 'Behandlingen är ordinerad.');
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.cyOppna) { const x = el.querySelector(`#${t.dataset.cyOppna}`); x.hidden = !x.hidden; if (!x.hidden) x.querySelector('input, select')?.focus(); return; }
    if (t.dataset.cyLas) {
      const [p, et] = t.dataset.cyLas.split('|');
      const f = t.closest('form');
      if (f.armband) f.armband.value = p;
      f.streckkod.value = et;
      f.querySelector('[type=submit]').focus();
      return;
    }
    if (t.dataset.cyKur) {
      const texter = { godkann: 'Kuren är godkänd och beredningsordern skickad.', prover: 'Proverna är beställda.', 'skjut-upp': 'Kuren är uppskjuten.' };
      post(t, `/api/cytostatika/cykel/${t.dataset.cykel}/${t.dataset.cyKur}`, {}, null, texter[t.dataset.cyKur]);
    }
    if (t.dataset.cyPremed) post(t, `/api/cytostatika/premed/${t.dataset.cyPremed}/ge`, { armband: pnr }, null, 'Premedicineringen är given.');
    if (t.dataset.cyDos) {
      const texter = { starta: 'Infusionen är startad.', avsluta: 'Infusionen är avslutad.', ge: null, extravasering: null };
      post(t, `/api/cytostatika/dos/${t.dataset.dos}/${t.dataset.cyDos}`, {}, null, texter[t.dataset.cyDos]);
    }
    if (t.dataset.cyNasta) post(t, `/api/cytostatika/behandling/${t.dataset.cyNasta}/nasta`, {}, null, 'Nästa cykel är planerad.');
  });
  el.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-cy-form]');
    if (!f || f.id === 'cy-ord') return;
    e.preventDefault();
    const s = f.dataset.cyForm;
    const data = Object.fromEntries(new FormData(f));
    if (s === 'dosjustera') return post(f.querySelector('[type=submit]'), `/api/cytostatika/cykel/${f.dataset.cykel}/dosjustera`, { dosandel: Number(data.dosandel), orsak: data.orsak }, f, 'Doserna är omräknade.');
    const texter = { 'ta-emot': 'Dosen är mottagen.', iordningstall: 'Dosen är iordningställd och väntar på dubbelkontroll.', kontrollera: 'Dosen är dubbelkontrollerad.', pausa: 'Infusionen är pausad.', ateruppta: 'Infusionen är återupptagen.' };
    if (data.procent) data.procent = Number(data.procent);
    if (data.grad) data.grad = Number(data.grad);
    post(f.querySelector('[type=submit]'), `/api/cytostatika/dos/${f.dataset.dos}/${s}`, data, null, texter[s] ?? null);
  });
}
