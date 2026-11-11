// Operation i patientens journal (runda 11, r2, Sussa 4.5.1.1 till 4.5.1.5 och 4.6.1.4): anmälan, förberedelserna med
// anestesibedömningen, planeringen, förloppet på salen med WHO:s checklista, anestesijournalen, sterilgodset och
// materialet, uppvakningen och överrapporteringen. Systemet fyller i det det vet, föreslår nästa steg och förklarar
// varför något inte går.
import { esc, api, tidpunkt, klockslag, datum, notis, medKnapp, ikon, dialog, tal } from '../ui.js';
import { far, S } from '../app.js';

const STATUS = { vantar: ['Väntar', 'tagg-utkast'], planerad: ['Planerad', ''], pagar: ['Pågår', 'tagg-ok'], uppvak: ['Uppvakning', 'tagg-ok'], klar: ['Klar', ''], avbokad: ['Avbokad', ''] };
const HANDELSE_CHECK = { anestesistart: 'fore_anestesi', knivtid: 'fore_snitt', ut_sal: 'fore_utflyttning' };
const MEDVETANDE = [['A', 'A, vaken'], ['C', 'C, ny förvirring'], ['V', 'V, reagerar på tilltal'], ['P', 'P, reagerar på smärta'], ['U', 'U, reagerar inte']];
const knapp = (attr, text, sekundar = false) => `<button type="button" class="knapp liten${sekundar ? ' sekundar' : ''}" ${attr}>${esc(text)}</button>`;
const kn = (v) => (v == null ? '' : tal(v, 1));

function paverkarHtml(o) {
  if (!o.paverkar?.length) return '';
  return `<ul class="op-paverkar">${o.paverkar.map(p => `<li class="ruta ${p.niva === 'varning' ? 'ruta-obs' : 'ruta-info'} liten">${p.niva === 'varning' ? ikon.varning : ikon.info}<span>${esc(p.text)}</span></li>`).join('')}</ul>`;
}

function forberedelserHtml(o) {
  const p = o.forberedelser.punkter;
  const an = p.find(x => x.id === 'anestesi');
  const aktiv = ['vantar', 'planerad'].includes(o.status);
  return `<section aria-labelledby="op-forb-${o.id}"><h4 id="op-forb-${o.id}">Förberedelser</h4>
    <ul class="op-forb">${p.map(x => `<li class="${x.klar ? 'op-klar' : 'op-kvar'}">${x.klar ? ikon.bock : ikon.klocka}<span><strong>${esc(x.namn)}</strong>: ${esc(x.text)}</span></li>`).join('')}</ul>
    ${aktiv ? `<p class="knapprad">${far('operation_anmala') && !S.session?.operation?.anestesi ? knapp(`data-op-avboka="${o.id}"`, 'Avboka', true) : ''}${!p.find(x => x.id === 'prover').klar && far('bestalla_prov') ? knapp(`data-op-prover="${o.id}"`, 'Beställ proverna') : ''}${far('anestesibedomning') && o.anestesi !== 'Lokalbedövning' ? knapp(`data-op-anestesi="${o.id}"`, an.klar ? 'Ny anestesibedömning' : 'Gör anestesibedömningen', an.klar) : ''}</p>` : ''}
    ${an.varningar?.length ? `<ul class="op-paverkar">${an.varningar.map(v => `<li class="ruta ruta-obs liten">${ikon.varning}<span>${esc(v)}</span></li>`).join('')}</ul>` : ''}
    ${an.skalor ? `<p class="under-text">${esc(an.skalor.rcri.namn)}: ${esc(an.skalor.rcri.text)} ${esc(an.skalor.apfel.namn)}: ${esc(an.skalor.apfel.text)}</p>` : ''}
    ${an.patientinformation ? `<details class="op-info"><summary>Information till patienten och närstående</summary><p>${esc(an.patientinformation)}</p></details>` : ''}
  </section>`;
}

function planeringHtml(o) {
  const p = o.planering;
  if (!p) return o.status === 'vantar' && far('operation_planera') ? `<p class="knapprad">${knapp(`data-op-planera="${o.id}"`, 'Planera operationen')}</p>` : '';
  const t = p.team;
  return `<section aria-labelledby="op-plan-${o.id}"><h4 id="op-plan-${o.id}">Planering</h4>
    <dl class="op-dl"><div><dt>Sal och tid</dt><dd>${esc(p.sal.namn)}, ${esc(tidpunkt(p.start))} till ${esc(klockslag(p.slut))}</dd></div>
      <div><dt>Team</dt><dd>Operatör ${esc(t.operator ?? 'saknas')}, operationssjuksköterska ${esc(t.opssk ?? 'saknas')}, anestesiläkare ${esc(t.anestesilakare ?? 'saknas')}, anestesisjuksköterska ${esc(t.anestesissk ?? 'saknas')}</dd></div>
      ${p.utrustning?.length ? `<div><dt>Utrustning och sterilgods</dt><dd>${esc(p.utrustning.map(u => u.namn).join(', '))}</dd></div>` : ''}</dl>
    ${p.kallelse ? `<details class="op-info"><summary>Kallelsen till patienten</summary><p>${esc(p.kallelse)}</p></details>` : ''}
    ${o.status === 'planerad' && far('operation_planera') && !S.session?.operation?.anestesi ? `<p class="knapprad">${knapp(`data-op-stryk="${o.id}"`, 'Stryk operationen', true)}</p>` : ''}
  </section>`;
}

function nastaHandelse(o) {
  if (!['planerad', 'pagar'].includes(o.status) || !o.forlopp && o.status !== 'planerad') return null;
  const tider = o.forlopp?.tider ?? [];
  const id = ['in_sal', 'anestesistart', 'knivtid', 'op_slut', 'ut_sal'].find(h => !tider.find(x => x.id === h)?.tid);
  return id ?? null;
}

function checklistaHtml(o, u) {
  const nasta = nastaHandelse(o);
  const del = nasta && HANDELSE_CHECK[nasta];
  if (!del || !u) return '';
  const d = u.delar.find(x => x.id === del);
  if (d.klar) return '';
  return `<form class="op-check" data-op-check="${o.id}" data-del="${esc(del)}" novalidate aria-labelledby="op-ck-${o.id}">
    <h4 id="op-ck-${o.id}">Checklista för säker kirurgi: ${esc(d.namn.toLocaleLowerCase('sv'))}</h4>
    <p class="hjalp">Teamet går igenom punkterna tillsammans. Det systemet redan har kontrollerat är ifyllt.</p>
    ${d.punkter.map(p => `<div class="kryssfalt"><input type="checkbox" id="ck-${o.id}-${esc(p.id)}" name="${esc(p.id)}"${p.forifylld ? ' checked' : ''}${p.ejAktuell ? ' disabled' : ''}>
      <label for="ck-${o.id}-${esc(p.id)}">${esc(p.namn)}<span class="under-text">${esc(p.text)}</span></label></div>`).join('')}
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Teamet har bekräftat</button></div>
  </form>`;
}

// Runda 11, r2: ASA-klassen bekräftas av en läkare på operationsdagen före induktionen.
function asaHtml(o, nasta) {
  if (!['planerad', 'pagar'].includes(o.status) || o.anestesi === 'Lokalbedövning') return '';
  if (o.asaBekraftad) return `<p class="under-text">${ikon.bock} ${esc(o.asaBekraftad.text)} bekräftad i dag klockan ${esc(klockslag(o.asaBekraftad.tid))} av ${esc(o.asaBekraftad.av ?? '')}.</p>`;
  if (!['in_sal', 'anestesistart'].includes(nasta)) return '';
  return `<p class="ruta ruta-info liten">${ikon.info}<span>ASA-klassen bekräftas av anestesiläkaren i dag innan anestesin startar.</span></p>
    ${far('anestesibedomning') ? `<p class="knapprad">${knapp(`data-op-asa="${o.id}"`, 'Bekräfta ASA-klassen')}</p>` : ''}`;
}

function forloppHtml(o, u) {
  if (o.status === 'vantar') return '';
  const tider = o.forlopp?.tider ?? [['in_sal', 'In på sal'], ['anestesistart', 'Anestesistart'], ['knivtid', 'Knivtid (snitt)'], ['op_slut', 'Operationen slut'], ['ut_sal', 'Ut från sal']].map(([id, namn]) => ({ id, namn, tid: null }));
  const nasta = nastaHandelse(o);
  const del = nasta && HANDELSE_CHECK[nasta];
  const klarCheck = !del || u?.delar.find(x => x.id === del)?.klar;
  const kan = far('operation_registrera');
  return `<section aria-labelledby="op-forl-${o.id}"><h4 id="op-forl-${o.id}">Förlopp på salen</h4>
    <ol class="op-tider">${tider.map(t => `<li class="${t.tid ? 'op-klar' : t.id === nasta ? 'op-nasta' : 'op-kvar'}"><span class="pt-tid">${t.tid ? esc(klockslag(t.tid)) : ''}</span> ${esc(t.namn)}</li>`).join('')}</ol>
    ${o.forlopp?.avvikelse ? `<p class="under-text">${esc(o.forlopp.avvikelse.text)}</p>` : ''}
    ${asaHtml(o, nasta)}
    ${kan && nasta && klarCheck && (nasta !== 'anestesistart' || o.asaBekraftad || o.anestesi === 'Lokalbedövning') ? `<p class="knapprad">${knapp(`data-op-handelse="${esc(nasta)}" data-op="${o.id}"`, tider.find(t => t.id === nasta).namn)}</p>` : ''}
    ${kan ? checklistaHtml(o, u) : ''}
  </section>`;
}

function anestesiHtml(o, j) {
  if (!j || !o.forlopp?.tider?.find(t => t.id === 'in_sal')?.tid) return '';
  const v = j.varden.slice(-6).reverse();
  const kan = far('operation_registrera') && j.pagar;
  const lm = j.forslag.lakemedel;
  const forval = j.forslag.profylax.given ? lm[0]?.kod : j.forslag.profylax.lakemedel;
  return `<section aria-labelledby="op-an-${o.id}"><h4 id="op-an-${o.id}">Anestesijournal</h4>
    <p class="under-text">${esc(j.monitor.kalla)}, värden var ${esc(j.monitor.intervallMinuter)} minut. ${esc(j.varden.length)} värden.</p>
    ${v.length ? `<div class="tabellrulle"><table class="tabell op-varden"><caption class="sr">De senaste värdena från anestesimonitorn</caption>
      <thead><tr><th scope="col">Tid</th><th scope="col">Puls</th><th scope="col">Blodtryck</th><th scope="col">MAP</th><th scope="col">SpO₂</th><th scope="col">EtCO₂ kPa</th><th scope="col">Andning</th><th scope="col">Temp</th></tr></thead>
      <tbody>${v.map(x => `<tr><th scope="row">${esc(klockslag(x.tid))}</th><td>${esc(x.puls)}</td><td>${esc(x.blodtryck)}</td><td>${esc(x.map)}</td><td>${esc(x.saturation)}</td><td>${esc(kn(x.etco2))}</td><td>${esc(x.andningsfrekvens)}</td><td>${esc(kn(x.temp))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="${j.forslag.profylax.given ? 'under-text' : 'ruta ruta-info liten'}">${j.forslag.profylax.given ? '' : ikon.info}<span>${esc(j.forslag.profylax.text)}</span></p>
    ${j.lakemedel.length ? `<h5>Läkemedel</h5><ul class="enkel-lista">${j.lakemedel.map(l => `<li><span class="pt-tid">${esc(klockslag(l.tid))}</span> ${esc(l.namn)} ${esc(kn(l.dos))} ${esc(l.enhet)} ${esc(l.vag ?? '')}<span class="under-text">${esc(l.av ?? '')}</span></li>`).join('')}</ul>` : ''}
    <h5>Vätskor</h5><p>In ${esc(j.vatskor.in)} ml, ut ${esc(j.vatskor.ut)} ml, balans ${j.vatskor.balans > 0 ? '+' : ''}${esc(j.vatskor.balans)} ml.</p>
    ${j.handelser.length ? `<h5>Händelser</h5><ul class="enkel-lista">${j.handelser.map(h => `<li><span class="pt-tid">${esc(klockslag(h.tid))}</span> ${esc(h.namn)}${h.text ? `: ${esc(h.text)}` : ''}</li>`).join('')}</ul>` : ''}
    ${kan ? `<form class="op-rad" data-op-lm="${o.id}" novalidate aria-label="Ge ett läkemedel"><div class="falt-rad">
        <div class="falt"><label for="op-lm-${o.id}">Läkemedel</label><select id="op-lm-${o.id}" name="lakemedel">${lm.map(l => `<option value="${esc(l.kod)}" data-dos="${esc(l.dos)}"${l.kod === forval ? ' selected' : ''}>${esc(l.text)}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="op-dos-${o.id}">Dos</label><input id="op-dos-${o.id}" name="dos" inputmode="decimal" autocomplete="off" placeholder="Föreslagen"><span class="hjalp">Tomt ger den föreslagna dosen.</span></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Ge</button></div></div><p class="form-fel" role="alert" hidden></p></form>
      <form class="op-rad" data-op-vatska="${o.id}" novalidate aria-label="Registrera vätska"><div class="falt-rad">
        <div class="falt"><label for="op-vs-${o.id}">Vätska</label><select id="op-vs-${o.id}" name="slag">${j.katalog.vatskor.map(x => `<option value="${esc(x.id)}">${esc(x.namn)} (${x.riktning === 'in' ? 'in' : 'ut'})</option>`).join('')}</select></div>
        <div class="falt smal"><label for="op-vol-${o.id}">Volym ml</label><input id="op-vol-${o.id}" name="volym" inputmode="numeric" autocomplete="off"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button></div></div><p class="form-fel" role="alert" hidden></p></form>
      <form class="op-rad" data-op-hand="${o.id}" novalidate aria-label="Registrera en händelse"><div class="falt-rad">
        <div class="falt"><label for="op-h-${o.id}">Händelse</label><select id="op-h-${o.id}" name="handelse">${j.katalog.handelser.map(x => `<option value="${esc(x.id)}">${esc(x.namn)}</option>`).join('')}</select></div>
        <div class="falt"><label for="op-ht-${o.id}">Beskrivning</label><input id="op-ht-${o.id}" name="text" maxlength="500" autocomplete="off"><span class="hjalp">Krävs för en komplikation eller en anteckning.</span></div>
        <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button></div></div><p class="form-fel" role="alert" hidden></p></form>` : ''}
    <p class="dampad liten">${esc(j.demoregel)}</p>
  </section>`;
}

function sterilgodsHtml(o, g, p, pagar) {
  if (!g?.galler.length && !p) return '';
  const kan = far('operation_registrera') && pagar;
  const STAT = { reserverad: 'Reserverat', oppnad: 'Öppnat', raknad: 'Räknat', retur: 'Skickat till sterilcentralen' };
  return `<section aria-labelledby="op-sg-${o.id}"><h4 id="op-sg-${o.id}">Sterilgods och material</h4>
    ${g?.galler.length ? `<ul class="enkel-lista">${g.galler.map(x => `<li><strong>${esc(x.namn)} ${esc(x.galler)}</strong>, charge ${esc(x.charge)}, ${esc(x.instrument)} instrument, utgår ${esc(datum(x.utgang))}. <span class="tagg">${esc(STAT[x.status])}</span>
      ${kan && x.status === 'reserverad' ? knapp(`data-op-oppna="${esc(x.galler)}" data-op="${o.id}"`, 'Öppna gallret', true) : ''}${kan && x.status === 'oppnad' ? knapp(`data-op-rakna="${esc(x.galler)}" data-op="${o.id}" data-antal="${esc(x.instrument)}"`, 'Räkna', true) : ''}</li>`).join('')}</ul>` : ''}
    ${p ? `<details class="op-info"${kan && !p.registrerad ? ' open' : ''}><summary>Plocklista${p.registrerad ? ', förbrukningen är registrerad' : ''}</summary>
      <ul class="enkel-lista">${(p.registrerad ? p.forbrukning : p.rader).map(r => `<li>${esc(r.antal)} st ${esc(r.namn)}${r.lot ? `, lot ${esc(r.lot)}` : ''}${!p.registrerad && !r.racker ? ' <span class="tagg tagg-utkast">Räcker inte i förrådet</span>' : ''}</li>`).join('')}</ul>
      ${kan && !p.registrerad ? `<form class="op-rad" data-op-forb="${o.id}" novalidate aria-label="Registrera förbrukningen">
        ${p.rader.filter(r => r.implantat).map(r => `<div class="falt"><label for="op-lot-${o.id}-${esc(r.artikel)}">Lot för ${esc(r.namn.toLocaleLowerCase('sv'))}</label><input id="op-lot-${o.id}-${esc(r.artikel)}" name="lot:${esc(r.artikel)}" autocomplete="off" maxlength="40"></div>`).join('')}
        <p class="form-fel" role="alert" hidden></p><div class="knapprad"><button type="submit" class="knapp sekundar">Registrera förbrukningen enligt plocklistan</button></div></form>` : ''}
    </details>` : ''}
  </section>`;
}

function uppvakningHtml(o, u) {
  if (o.status === 'klar' && o.forlopp?.uppvakning) {
    return `<section aria-labelledby="op-up-${o.id}"><h4 id="op-up-${o.id}">Uppvakning och överrapportering</h4>
      <p class="under-text">Utskriven från uppvakningen ${esc(tidpunkt(o.forlopp.uppvakning.utskriven))} av ${esc(o.forlopp.uppvakning.av ?? '')}.</p><p>${esc(o.forlopp.uppvakning.overrapport ?? '')}</p></section>`;
  }
  if (o.status !== 'uppvak' || !u) return '';
  const kan = far('operation_registrera');
  return `<section aria-labelledby="op-up-${o.id}"><h4 id="op-up-${o.id}">Uppvakning</h4>
    <p class="${u.kanSkrivasUt ? 'ruta ruta-info liten' : 'under-text'}">${esc(u.text)} ${esc(u.minuter)} minuter på uppvakningen.</p>
    <ul class="op-forb">${u.kriterier.map(k => `<li class="${k.uppfyllt ? 'op-klar' : 'op-kvar'}">${k.uppfyllt ? ikon.bock : ikon.klocka}<span>${esc(k.text)}</span></li>`).join('')}</ul>
    ${kan ? `<form class="op-rad" data-op-kontroll="${o.id}" novalidate aria-label="Registrera kontroller"><div class="falt-rad">
      <div class="falt smal"><label for="op-k-med-${o.id}">Vakenhet</label><select id="op-k-med-${o.id}" name="medvetande"><option value="">Ej mätt</option>${MEDVETANDE.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>
      ${[['saturation', 'SpO₂ %'], ['andningsfrekvens', 'Andning per minut'], ['puls', 'Puls'], ['blodtryck', 'Blodtryck'], ['smarta', 'Smärta 0 till 10']].map(([n, t]) => `<div class="falt smal"><label for="op-k-${n}-${o.id}">${esc(t)}</label><input id="op-k-${n}-${o.id}" name="${n}" autocomplete="off"${n === 'blodtryck' ? '' : ' inputmode="numeric"'}></div>`).join('')}
      <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Registrera</button></div></div><p class="form-fel" role="alert" hidden></p></form>
      ${u.kanSkrivasUt ? `<p class="knapprad">${knapp(`data-op-skrivut="${o.id}"`, 'Skriv ut till avdelningen')}</p>` : ''}` : ''}
    <p class="dampad liten">${esc(u.demoregel)}</p>
  </section>`;
}

function kortHtml(o, x) {
  const [st, kl] = STATUS[o.status] ?? [o.status, ''];
  return `<article class="op-kort" aria-labelledby="op-r-${o.id}">
    <header><h3 id="op-r-${o.id}">${esc(o.ingrepp)}${o.sida ? `, ${esc(o.sida)} sida` : ''}</h3><span class="tagg ${kl}">${esc(st)}</span></header>
    <p class="under-text">KVÅ ${esc(o.kva)}. ${esc(o.prioritet.namn)}, målet är ${esc(datum(o.malDatum))}${o.overMal ? ' och har passerats' : ''}. ${o.behandlingsgaranti && o.status !== 'klar' ? `${esc(o.behandlingsgaranti.text)} ` : ''}${esc(o.anestesi)}, beräknat ${esc(o.minuter)} minuter. Anmäld ${esc(tidpunkt(o.anmald.tid))} av ${esc(o.anmald.av ?? '')}, ${esc(o.vardenhet?.namn ?? '')}.</p>
    ${paverkarHtml(o)}
    ${o.status !== 'klar' ? forberedelserHtml(o) : ''}
    ${planeringHtml(o)}
    ${forloppHtml(o, x.checklista)}
    ${anestesiHtml(o, x.journal)}
    ${sterilgodsHtml(o, x.sterilgods, x.plocklista, o.status === 'pagar')}
    ${uppvakningHtml(o, x.uppvakning)}
  </article>`;
}

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const d = await api(`/api/patient/${pid}/operation`);
  if (!ctx.aktuell()) return;
  // Detaljerna hämtas för operationer som pågår, är planerade eller nyss är klara.
  const extra = {};
  await Promise.all(d.operationer.filter(o => o.status !== 'vantar').slice(0, 3).map(async (o) => {
    const g = (del) => api(`/api/operation/${o.id}/${del}`).catch(() => null);
    const [ck, j, sgods, pl, u] = await Promise.all([
      ['planerad', 'pagar'].includes(o.status) ? g('checklista') : null, o.forlopp ? g('anestesijournal') : null, g('sterilgods'),
      ['pagar', 'uppvak', 'klar'].includes(o.status) ? g('plocklista') : null, o.status === 'uppvak' ? g('uppvakning') : null]);
    extra[o.id] = { checklista: ck?.underlag ?? null, journal: j, sterilgods: sgods, plocklista: pl, uppvakning: u };
  }));
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Operation</h2>${far('operation_anmala') && !S.session?.operation?.anestesi ? knapp('data-op-anmal', 'Anmäl till operation') : ''}</div>
    <p class="under-text">Systemet sätter KVÅ, operationstid, mål för väntetiden och förberedelser ur ingreppet, föreslår tid och team och håller ordningen på salen.</p>
    ${d.operationer.length ? d.operationer.map(o => kortHtml(o, extra[o.id] ?? {})).join('') : '<p class="tom">Inga operationer som du kan se.</p>'}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;

  const post = (vag, data, b, form) => medKnapp(b, () => api(vag, { metod: 'POST', data }), form);
  el.addEventListener('click', async (e) => {
    const t = (s) => e.target.closest(s);
    try {
      if (t('[data-op-anmal]')) {
        const f = await api(`/api/patient/${pid}/operation/forslag`);
        const s = await dialog(`<form><h2 id="dlg-rubrik">Anmäl till operation</h2><p class="hjalp">Systemet sätter KVÅ, operationstid, anestesiform och målet för väntetiden ur ingreppet och prioriteten.</p>
          <div class="falt"><label for="op-ing">Ingrepp</label><select id="op-ing" name="kva">${f.ingrepp.map(i => `<option value="${esc(i.kva)}" data-sida="${i.sida ? 1 : 0}">${esc(i.namn)} (${esc(i.kva)}, ${esc(i.minuter)} minuter)</option>`).join('')}</select></div>
          <div class="falt"><label for="op-sida">Sida</label><select id="op-sida" name="sida"><option value="">Ingreppet görs inte på en sida</option><option value="hoger">Höger</option><option value="vanster">Vänster</option></select><span class="hjalp">Krävs för höft och knä.</span></div>
          <div class="falt"><label for="op-prio">Prioritet</label><select id="op-prio" name="prioritet">${f.prioriteter.map(p => `<option value="${esc(p.id)}"${p.id === f.prioritet ? ' selected' : ''}>${esc(p.namn)}</option>`).join('')}</select></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Anmäl</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        await post(`/api/patient/${pid}/operation`, { kva: s.data.kva, sida: s.data.sida || undefined, prioritet: s.data.prioritet }, null);
        notis('Patienten är anmäld och står på vårdenhetens väntelista.');
        ctx.ladda();
      } else if (t('[data-op-prover]')) {
        await post(`/api/operation/${t('[data-op-prover]').dataset.opProver}/prover`, {}, t('[data-op-prover]'));
        notis('Proverna före operationen är beställda.');
        ctx.ladda();
      } else if (t('[data-op-anestesi]')) {
        const aid = t('[data-op-anestesi]').dataset.opAnestesi;
        const a = await api(`/api/patient/${pid}/anestesi?anmalan=${encodeURIComponent(aid)}`);
        const f = a.forslag;
        const s = await dialog(`<form><h2 id="dlg-rubrik">Anestesibedömning</h2><p class="hjalp">${esc(f.text)} Ingreppet och tiden kommer från operationen.</p>
          <dl class="op-dl"><div><dt>Ingrepp</dt><dd>${esc(f.ingrepp ?? '')}${f.planerad ? `, ${esc(tidpunkt(f.planerad))}` : ''}</dd></div>
            <div><dt>Läkemedel</dt><dd>${f.lakemedel.length ? f.lakemedel.map(l => `${esc(l.text)}${l.observation ? ` <strong>${esc(l.observation)}</strong>` : ''}`).join('<br>') : 'Inga aktuella'}</dd></div>
            <div><dt>Överkänslighet</dt><dd>${f.overkanslighet.length ? esc(f.overkanslighet.map(o => o.amne).join(', ')) : 'Ingen registrerad'}</dd></div>
            <div><dt>Risk</dt><dd>${esc(f.skalor.rcri.text)} ${esc(f.skalor.rcri.grund)}<br>${esc(f.skalor.apfel.text)}</dd></div>
            ${f.luftvag.risker.length ? `<div><dt>Luftväg</dt><dd class="text-larm">${esc(f.luftvag.risker.join(' '))}</dd></div>` : ''}</dl>
          <div class="falt"><label for="an-asa">ASA-klass</label><select id="an-asa" name="asa">${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${n === f.asa.asa ? ' selected' : ''}>ASA ${n}</option>`).join('')}</select><span class="hjalp">${esc(f.asa.text)} ${esc(f.asa.grund)}</span></div>
          <div class="falt"><label for="an-form">Anestesiform</label><select id="an-form" name="anestesiform">${Object.entries(a.anestesiformer).map(([k, v]) => `<option value="${esc(k)}"${k === f.anestesiform ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div class="falt"><label for="an-mall">Mallampati</label><select id="an-mall" name="mallampati"><option value="">Inte bedömt</option>${[1, 2, 3, 4].map(n => `<option value="${n}">${n}</option>`).join('')}</select></div>
          <div class="falt"><label for="an-samt">Samtycke till anestesin</label><select id="an-samt" name="samtycke" required><option value="">Välj</option>${Object.entries(f.samtycken).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></div>
          <div class="kryssfalt"><input type="checkbox" id="an-ponv" name="ponvTidigare"><label for="an-ponv">Illamående efter tidigare operation eller åksjuka</label></div>
          <div class="kryssfalt"><input type="checkbox" id="an-rok" name="rokare"><label for="an-rok">Röker</label></div>
          <p class="hjalp">${esc(f.giltighet.text)} Systemet skriver informationen till patienten.</p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara bedömningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        const r = await post(`/api/patient/${pid}/anestesi`, { anmalanId: Number(aid), asa: Number(s.data.asa), anestesiform: s.data.anestesiform, samtycke: s.data.samtycke,
          ponvTidigare: Boolean(s.data.ponvTidigare), rokare: Boolean(s.data.rokare), luftvag: { mallampati: s.data.mallampati || null } }, null);
        notis(r.text);
        ctx.ladda();
      } else if (t('[data-op-planera]')) {
        const aid = t('[data-op-planera]').dataset.opPlanera;
        await planeraDialog(aid, t('[data-op-planera]'));
        ctx.ladda();
      } else if (t('[data-op-stryk]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Stryk operationen</h2><p class="hjalp">Patienten står kvar på väntelistan med samma prioritet och mål.</p>
          <div class="falt"><label for="op-orsak">Orsak</label><select id="op-orsak" name="orsak">${[['patient_sjuk', 'Patienten är sjuk'], ['patient_avstar', 'Patienten avstår'], ['akut_gick_fore', 'En akut operation gick före'], ['tidsbrist', 'Tiden räckte inte'], ['forberedelse_saknas', 'Förberedelserna var inte klara'], ['personal_saknas', 'Personal saknades']].map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Stryk</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        await post(`/api/operation/${t('[data-op-stryk]').dataset.opStryk}/stryk`, { orsak: s.data.orsak }, null);
        notis('Operationen är struken och patienten står kvar på väntelistan.');
        ctx.ladda();
      } else if (t('[data-op-handelse]')) {
        const b = t('[data-op-handelse]');
        const data = { handelse: b.dataset.opHandelse };
        if (data.handelse === 'in_sal') {
          const s = await dialog(`<form><h2 id="dlg-rubrik">In på sal</h2><div class="falt"><label for="op-arm">Armband</label><input id="op-arm" name="armband" autocomplete="off" inputmode="numeric"><span class="hjalp">Skanna id-bandet. Systemet kontrollerar att det hör till patienten.</span></div>
            <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
          if (!s) return;
          if (s.data.armband) data.armband = s.data.armband;
        }
        await post(`/api/operation/${b.dataset.op}/handelse`, data, b);
        notis(`${b.textContent.trim()} är registrerat klockan ${klockslag(new Date().toISOString())}.`);
        ctx.ladda();
      } else if (t('[data-op-avboka]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Avboka operationen</h2><p class="hjalp">Patienten lämnar väntelistan, och anestesienheten har inte längre någon beställning.</p>
          <div class="falt"><label for="op-avb">Orsak</label><select id="op-avb" name="orsak"><option value="ej_aktuell">Operationen är inte längre aktuell</option><option value="patient_avstar">Patienten avstår från operationen</option><option value="annan_vardgivare">Patienten opereras hos en annan vårdgivare</option></select></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avboka</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        await post(`/api/operation/${t('[data-op-avboka]').dataset.opAvboka}/avboka`, { orsak: s.data.orsak }, null);
        notis('Operationen är avbokad.');
        ctx.ladda();
      } else if (t('[data-op-asa]')) {
        await post(`/api/operation/${t('[data-op-asa]').dataset.opAsa}/bekrafta-asa`, {}, t('[data-op-asa]'));
        notis('ASA-klassen är bekräftad för i dag.');
        ctx.ladda();
      } else if (t('[data-op-oppna]')) {
        const b = t('[data-op-oppna]');
        const r = await post(`/api/operation/${b.dataset.op}/galler-oppna`, { galler: b.dataset.opOppna }, b);
        notis(r.text);
        ctx.ladda();
      } else if (t('[data-op-rakna]')) {
        const b = t('[data-op-rakna]');
        const s = await dialog(`<form><h2 id="dlg-rubrik">Räkna ${esc(b.dataset.opRakna)}</h2><div class="falt"><label for="op-ant">Antal instrument</label><input id="op-ant" name="instrument" inputmode="numeric" autocomplete="off"><span class="hjalp">Gallret ska innehålla ${esc(b.dataset.antal)} instrument.</span></div>
          <div class="kryssfalt"><input type="checkbox" id="op-kn" name="kn"><label for="op-kn">Kompresser och nålar är räknade och stämmer</label></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara räkningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        const r = await post(`/api/operation/${b.dataset.op}/galler-rakna`, { galler: b.dataset.opRakna, instrument: Number(s.data.instrument), kompresserOchNalar: Boolean(s.data.kn) }, null);
        notis(r.text);
        ctx.ladda();
      } else if (t('[data-op-skrivut]')) {
        const r = await post(`/api/operation/${t('[data-op-skrivut]').dataset.opSkrivut}/skriv-ut`, {}, t('[data-op-skrivut]'));
        notis(r.kontroller ? 'Patienten är utskriven och de postoperativa kontrollerna är ordinerade.' : 'Patienten är utskriven från uppvakningen. Överrapporteringen är skriven.');
        ctx.ladda();
      }
    } catch { /* felet visas som notis eller i formuläret */ }
  });
  el.addEventListener('submit', async (e) => {
    const f = e.target;
    e.preventDefault();
    const b = f.querySelector('[type=submit]');
    try {
      let r;
      if (f.dataset.opCheck) {
        const bekraftade = [...f.querySelectorAll('input[type=checkbox]')].filter(x => x.checked).map(x => x.name);
        r = await post(`/api/operation/${f.dataset.opCheck}/checklista`, { del: f.dataset.del, bekraftade }, b, f);
        notis('Checklistan är bekräftad.');
      } else if (f.dataset.opLm) {
        r = await post(`/api/operation/${f.dataset.opLm}/anestesi-lakemedel`, { lakemedel: f.lakemedel.value, ...(f.dos.value.trim() ? { dos: f.dos.value.trim() } : {}) }, b, f);
        notis(r.text);
      } else if (f.dataset.opVatska) {
        r = await post(`/api/operation/${f.dataset.opVatska}/anestesi-vatska`, { slag: f.slag.value, volym: Number(f.volym.value) }, b, f);
        notis(r.text);
      } else if (f.dataset.opHand) {
        r = await post(`/api/operation/${f.dataset.opHand}/anestesi-handelse`, { handelse: f.handelse.value, text: f.text.value }, b, f);
        notis(r.text);
      } else if (f.dataset.opForb) {
        const lotter = Object.fromEntries([...f.querySelectorAll('input[name^="lot:"]')].map(x => [x.name.slice(4), x.value.trim()]));
        r = await post(`/api/operation/${f.dataset.opForb}/forbrukning`, { lotter }, b, f);
        notis(r.text);
      } else if (f.dataset.opKontroll) {
        const varden = Object.fromEntries([...new FormData(f)].filter(([, v]) => String(v).trim()).map(([k, v]) => [k, k === 'medvetande' || k === 'blodtryck' ? v : Number(String(v).replace(',', '.'))]));
        await post(`/api/operation/${f.dataset.opKontroll}/kontroll`, { varden }, b, f);
        notis('Kontrollerna är registrerade.');
      }
      ctx.ladda();
    } catch { /* i formuläret */ }
  });
}

// Planeringen med systemets förslag, som också används från operationsavdelningens väntelista.
export async function planeraDialog(aid, knappEl) {
  const f = await medKnapp(knappEl, () => api(`/api/operation/${encodeURIComponent(aid)}/planeringsforslag`));
  const s = await dialog(`<form><h2 id="dlg-rubrik">Planera operationen</h2><p>Systemets förslag: ${esc(f.text)}</p>
    <dl class="op-dl"><div><dt>Operatör</dt><dd>${esc(f.operator?.namn ?? 'saknas')}</dd></div><div><dt>Operationssjuksköterska</dt><dd>${esc(f.opssk?.namn ?? 'saknas')}</dd></div>
      <div><dt>Anestesiläkare</dt><dd>${esc(f.anestesilakare?.namn ?? 'saknas')}</dd></div><div><dt>Anestesisjuksköterska</dt><dd>${esc(f.anestesissk?.namn ?? 'saknas')}</dd></div>
      <div><dt>Utrustning</dt><dd>${esc(f.utrustning.map(u => u.namn).join(', ') || 'Ingen särskild')}</dd></div></dl>
    <p class="hjalp">Systemet har prövat att salen, teamet och utrustningen är lediga och skriver kallelsen till patienten.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Planera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!s) return null;
  const r = await medKnapp(null, () => api(`/api/operation/${encodeURIComponent(aid)}/planera`, { metod: 'POST', data: {} }));
  notis(`Operationen är planerad ${tidpunkt(r.planering.start)} i ${r.planering.sal.namn}. Kallelsen är skickad (simulerad).`);
  return r;
}
