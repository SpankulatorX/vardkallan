// Förlossningen och BB (runda 11, r3, Sussa 4.7.1.1, 4.7.1.3 och 4.7.1.4): pågående förlossningar med partogram och CTG,
// mödrar och barn på BB, rapporteringen till Graviditetsregistret och uppföljningen. Förlossningen för en patient har
// partogrammet, CTG från den simulerade monitorn med systemets analys och barnmorskans bedömning, smärtlindringen med
// kontrollerna före EDA, födelsen av varje barn också vid flerbörd, födelseanmälan och BB-journalen för mor och barn.
import { esc, api, vyRubrik, tidpunkt, klockslag, notis, medKnapp, ikon, tal } from '../ui.js';
import { far } from '../app.js';
import { varningar, partogramSvg, ctgSvg, registretHtml, kopplaRegistret, uppfoljningHtml } from '../obstetrik-ui.js';
import { bbBarnHtml, kopplaBb } from './patient-graviditet.js';

export const namn = 'forlossning';
const enc = encodeURIComponent;
const fel = '<p class="form-fel" role="alert" hidden></p>';
const val = (lista, valt = null) => lista.map(([v, t]) => `<option value="${esc(v)}"${v === valt ? ' selected' : ''}>${esc(t)}</option>`).join('');
const nummer = (v) => (v === '' || v == null ? undefined : Number(String(v).replace(',', '.')));
const KLASS = { normal: 'tagg-ok', avvikande: 'tagg-utkast', patologiskt: 'tagg-larm' };

export function demoknapp(text) {
  return `<div class="ruta ruta-info">${ikon.info}<div><p>${esc(text)}</p><p class="knapprad"><button type="button" class="knapp" data-ob-demo>Lägg in demopatienter</button></p>
    <p class="under-text">Fyra påhittade kvinnor med Skatteverkets testpersonnummer läggs in i din egen sandlåda: en graviditet i vecka 30, en ny inskrivning, en pågående förlossning med CTG och tvillingar på BB.</p></div></div>`;
}
export function kopplaDemo(el, ladda) {
  el.querySelector('[data-ob-demo]')?.addEventListener('click', async (e) => {
    try { const r = await medKnapp(e.currentTarget, () => api('/api/demo/obstetrik', { metod: 'POST', data: {} })); notis(r.text); ladda(); } catch { /* notis */ }
  });
}

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Förlossningen', 'Pågående förlossningar med partogram och CTG, mödrar och barn på BB, rapporteringen till Graviditetsregistret och uppföljningen.')}<div id="forl"><p class="tom">Hämtar förlossningen.</p></div>`;
  const ladda = () => visa(main, _p, _q, ctx);
  const [d, r, u] = await Promise.all([api('/api/forlossning'), api('/api/graviditetsregistret').catch(() => null), far('statistik') ? api('/api/graviditet/uppfoljning').catch(() => null) : null]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#forl');
  if (!el) return;
  el.innerHTML = `${!d.pagaende.length && !d.bb.length ? demoknapp('Det finns inga pågående förlossningar eller mödrar på BB i din sandlåda.') : ''}
    <section class="ov-sektion" aria-labelledby="forl-pag"><div class="sektion-huvud"><h2 id="forl-pag">Pågående förlossningar på ${esc(d.vardenhet?.namn ?? '')}</h2><p class="under-text">${esc(d.text)}</p></div>
    ${d.pagaende.length ? `<div class="tabellrulle"><table class="tabell" id="forl-tabell"><caption class="sr">Pågående förlossningar</caption>
      <thead><tr><th scope="col">Patient</th><th scope="col">Vecka</th><th scope="col">Öppning</th><th scope="col">Partogram</th><th scope="col">CTG</th><th scope="col">Smärtlindring</th></tr></thead>
      <tbody>${d.pagaende.map(p => `<tr${p.ctg?.klass === 'patologiskt' || p.lage?.id === 'over_atgardslinje' ? ' class="rad-larm"' : ''}>
        <th scope="row"><a class="patientlank" href="#/forlossning/${enc(p.patientId)}">${esc(p.namn)}</a><span class="under-text">Sedan ${esc(klockslag(p.start))}${p.antalFoster > 1 ? `, ${p.antalFoster} foster, ${p.fodda} födda` : ''}</span></th>
        <td>${esc(p.vecka)}</td><td>${p.oppning != null ? `${p.oppning} cm` : ''}</td><td>${esc(p.lage?.text ?? '')}${p.fosterljudVarning ? `<span class="text-larm under-text">${esc(p.fosterljudVarning)}</span>` : ''}</td>
        <td>${p.ctg ? `<span class="tagg ${KLASS[p.ctg.klass]}">${esc(p.ctg.klassText)}</span><span class="under-text">Nästa bedömning ${esc(klockslag(p.ctg.nastaBedomning))}${p.ctg.forsenad ? ', försenad' : ''}</span>` : '<span class="dampad">Inte kopplad</span>'}</td>
        <td>${esc(p.smartlindring.join(', '))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom">Inga pågående förlossningar.</p>'}
    </section>
    <section class="ov-sektion" aria-labelledby="forl-bb"><div class="sektion-huvud"><h2 id="forl-bb">BB</h2></div>
    ${d.bb.length ? `<div class="tabellrulle"><table class="tabell"><caption class="sr">Mödrar och barn på BB</caption>
      <thead><tr><th scope="col">Mor</th><th scope="col">Barn</th><th scope="col">Varningar</th><th scope="col">Kvar före hemgång</th></tr></thead>
      <tbody>${d.bb.map(p => `<tr><th scope="row"><a class="patientlank" href="#/forlossning/${enc(p.patientId)}">${esc(p.namn)}</a><span class="under-text">Förlöst ${esc(tidpunkt(p.avslutad))}</span></th>
        <td>${p.barn.map(b => `<a href="#/patient/${enc(b.patientId)}/nyfodd">${esc(b.namn)}</a><span class="under-text">${b.timmar} timmar${b.viktnedgang != null ? `, ${esc(tal(b.viktnedgang))} procent under födelsevikten` : ''}${b.anmalan ? '' : ', födelseanmälan inte skickad'}</span>`).join('')}</td>
        <td>${p.varningar.length ? `<span class="text-larm">${esc(p.varningar.join(' '))}</span>` : '<span class="dampad">Inga</span>'}</td>
        <td>${p.kvar.length ? `<span class="under-text">${esc(p.kvar.join(' '))}</span>` : 'Klar för hemgång'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom">Inga mödrar och barn på BB.</p>'}
    </section>
    ${r ? registretHtml(r) : ''}${uppfoljningHtml(u)}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;
  kopplaRegistret(el, ladda);
  kopplaDemo(el, ladda);
}

const SATT = [['vaginal', 'Vaginal förlossning'], ['instrumentell', 'Instrumentell vaginal förlossning (sugklocka)'], ['kejsarsnitt', 'Kejsarsnitt']];

function ctgHtml(d) {
  const c = d.ctg;
  const f = d.forlossning;
  const kan = d.kanRegistrera && f.status === 'pagaende';
  if (!c.kopplad) {
    return `<section class="ov-sektion" aria-labelledby="fp-ctg"><div class="sektion-huvud"><h2 id="fp-ctg">CTG</h2></div>
      ${kan ? `<form id="fp-ctg-koppla" class="ob-form" novalidate aria-label="Koppla CTG"><p class="hjalp">Monitorn är simulerad. Välj förlopp för att visa systemets analys.</p><div class="falt-rad">
        <div class="falt"><label for="fp-forlopp">Förlopp i den simulerade monitorn</label><select id="fp-forlopp" name="forlopp">${val(Object.entries(d.forlopp), 'normal')}</select></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Koppla CTG</button></div></div>${fel}</form>` : '<p class="tom liten">CTG är inte kopplad.</p>'}</section>`;
  }
  return `<section class="ov-sektion" aria-labelledby="fp-ctg"><div class="sektion-huvud"><h2 id="fp-ctg">CTG</h2><p class="under-text">${esc(c.utrustning)}, kopplad ${esc(klockslag(c.start))}.</p></div>
    ${ctgSvg(c)}
    <div class="ruta ${c.klass === 'patologiskt' ? 'ruta-larm' : c.klass === 'avvikande' ? 'ruta-obs' : 'ruta-info'} liten">${c.klass === 'normal' ? ikon.info : ikon.varning}<div>
      <p><strong>Systemets klassning: ${esc(c.klassText)}.</strong> ${esc(c.gora)}</p>
      <ul class="enkel-lista">${c.analys.map(a => `<li>${c.analys.length > 1 ? `Foster ${a.foster}: ` : ''}${esc(a.text)}</li>`).join('')}</ul>
      <p>Nästa bedömning senast ${esc(klockslag(c.nastaBedomning))}${c.forsenad ? ' <span class="tagg tagg-larm">Försenad</span>' : ''}.</p></div></div>
    ${kan ? `<p class="knapprad"><button type="button" class="knapp" id="fp-ctg-bekrafta">Bekräfta bedömningen: ${esc(c.klassText)}</button></p>
      <details><summary>Jag bedömer kurvan annorlunda</summary><form id="fp-ctg-annan" class="ob-form" novalidate aria-label="Annan bedömning av CTG"><div class="falt-rad">
        <div class="falt"><label for="fp-klass">Min bedömning</label><select id="fp-klass" name="klass">${val([['normal', 'Normalt CTG'], ['avvikande', 'Avvikande CTG'], ['patologiskt', 'Patologiskt CTG']], c.klass)}</select></div>
        <div class="falt"><label for="fp-motiv">Varför</label><input id="fp-motiv" name="motivering" maxlength="500" autocomplete="off"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp sekundar">Spara bedömningen</button></div></div>${fel}</form></details>` : ''}
    ${c.bedomningar.length ? `<details><summary>Dokumenterade bedömningar (${c.bedomningar.length})</summary><ul class="enkel-lista">${c.bedomningar.map(b => `<li><strong>${esc(klockslag(b.tid))} ${esc(b.klassText)}</strong>${b.avvekFranForslag ? ` (systemet föreslog ${esc(b.forslag)}: ${esc(b.motivering ?? '')})` : ''}<span class="under-text">${esc(b.atgard ?? '')} ${esc(b.av ?? '')}</span></li>`).join('')}</ul></details>` : ''}
    <p class="under-text">${esc(c.demoregel)}</p></section>`;
}

function smartlindringHtml(d) {
  const kan = d.kanRegistrera && d.forlossning.status === 'pagaende';
  const k = d.foreRegional;
  return `<section class="ov-sektion" aria-labelledby="fp-sm"><div class="sektion-huvud"><h2 id="fp-sm">Smärtlindring</h2></div>
    ${d.smartlindring.length ? `<ul class="enkel-lista">${d.smartlindring.map(s => `<li><strong>${esc(s.text)}</strong> ${esc(klockslag(s.tid))}<span class="under-text">${esc(s.av ?? '')}</span>${varningar(s.varningar)}</li>`).join('')}</ul>` : '<p class="tom liten">Ingen smärtlindring registrerad.</p>'}
    ${d.graviditet?.onskemal?.smartlindring?.length ? `<p class="under-text">Hennes önskemål: ${esc(d.graviditet.onskemal.smartlindring.map(x => x.text).join(', '))}.</p>` : ''}
    ${kan ? `<form id="fp-sm-ny" class="ob-form" novalidate aria-label="Registrera smärtlindring">
      <p class="hjalp">Före EDA och spinal kontrollerar systemet trombocyterna och heparin. ${k?.tpk ? `Senaste trombocyter ${esc(k.tpk.varde)}, ${esc(tidpunkt(k.tpk.tid))}.` : 'Trombocyterna är inte tagna.'}</p>
      <div class="falt-rad"><div class="falt"><label for="fp-metod">Smärtlindring</label><select id="fp-metod" name="metod">${val(Object.entries(d.smartlindringsval), 'lustgas')}</select></div>
      <div class="falt knappfalt"><button type="submit" class="knapp">Registrera</button></div></div>
      ${k?.hinder.length ? `<div class="kryssfalt"><input type="checkbox" id="fp-anest" name="anestesiBedomd"><label for="fp-anest">Anestesiläkaren har bedömt att EDA eller spinal kan läggas trots: ${esc(k.hinder.join(' '))}</label></div>` : ''}${fel}</form>` : ''}
  </section>`;
}

function fodelseHtml(d) {
  const f = d.forlossning;
  const kvar = f.antalFoster - f.barn.length;
  const kan = d.kanRegistrera;
  return `<section class="ov-sektion" aria-labelledby="fp-barn"><div class="sektion-huvud"><h2 id="fp-barn">${f.antalFoster > 1 ? 'Barnen' : 'Barnet'}</h2></div>
    ${d.barn.length ? `<ul class="enkel-lista ob-barn">${d.barn.map((b, i) => {
      const x = f.barn[i];
      return `<li><strong><a href="#/patient/${enc(b.patientId)}/nyfodd">${esc(b.namn)}</a></strong> född ${esc(klockslag(x.fodd))}, ${esc(x.satt)}, ${x.vikt} g, ${esc(tal(x.langd))} cm, Apgar ${esc(x.apgar.join('-'))}, ${esc(x.graviditetslangd)}
        <span class="under-text">${b.anmalan ? `Födelseanmälan: ${esc(b.anmalan.text ?? '')}` : 'Födelseanmälan är inte skickad. Systemet fyller i den ur förlossningsjournalen.'}</span>
        ${!b.anmalan && kan ? `<button type="button" class="knapp liten" data-fp-anmalan="${b.ordning}">Skicka födelseanmälan till Skatteverket (simulerat)</button>` : ''}</li>`;
    }).join('')}</ul>` : ''}
    ${f.status === 'pagaende' && kan && kvar > 0 ? `<form id="fp-fodelse" class="ob-form" novalidate aria-labelledby="fp-fodelse-r"><h3 id="fp-fodelse-r">${f.antalFoster > 1 ? `Registrera barn ${f.barn.length + 1} av ${f.antalFoster}` : 'Registrera födelsen'}</h3>
      <p class="hjalp">Systemet skapar barnets journal med reservnummer, kopplar barnet till modern och för födelseuppgifterna vidare till barnhälsovården.</p>
      <div class="falt-rad"><div class="falt"><label for="fp-kon">Kön</label><select id="fp-kon" name="kon">${val([['kvinna', 'Flicka'], ['man', 'Pojke']], 'kvinna')}</select></div>
      <div class="falt"><label for="fp-satt">Förlossningssätt</label><select id="fp-satt" name="satt">${val(SATT, 'vaginal')}</select></div>
      <div class="falt"><label for="fp-vikt">Vikt, g</label><input id="fp-vikt" name="vikt" inputmode="numeric" autocomplete="off"></div>
      <div class="falt"><label for="fp-langd">Längd, cm</label><input id="fp-langd" name="langd" inputmode="decimal" autocomplete="off"></div>
      <div class="falt"><label for="fp-hu">Huvudomfång, cm</label><input id="fp-hu" name="huvudomfang" inputmode="decimal" autocomplete="off"></div></div>
      <fieldset class="ob-falt"><legend>Apgar</legend><div class="falt-rad">${[1, 5, 10].map(m => `<div class="falt"><label for="fp-ap${m}">${m} minuter</label><input id="fp-ap${m}" name="apgar${m}" inputmode="numeric" autocomplete="off"></div>`).join('')}</div></fieldset>
      <div class="knapprad"><button type="submit" class="knapp">Registrera födelsen</button></div>${fel}</form>` : ''}
  </section>`;
}

function bbHtml(d) {
  const bb = d.bb;
  if (!bb) return '';
  const kan = bb.kanRegistrera;
  const k = bb.kontroller[0];
  return `<section class="ov-sektion" aria-labelledby="fp-bb"><div class="sektion-huvud"><h2 id="fp-bb">BB</h2></div>
    ${bb.utskriven ? `<p class="ruta ruta-info liten">${ikon.info}<span>Utskrivna från BB ${esc(tidpunkt(bb.utskriven.tid))} av ${esc(bb.utskriven.av ?? '')}.</span></p>` : ''}
    <h3>Modern</h3>
    ${k ? `<p class="under-text">Senaste kontroll ${esc(tidpunkt(k.tid))}, ${esc(k.av ?? '')}.</p>${varningar(k.varningar)}` : '<p class="tom liten">Ingen kontroll efter förlossningen.</p>'}
    ${kan ? `<form id="fp-bb-mor" class="ob-form" novalidate aria-label="Kontroll av modern"><div class="falt-rad">
      <div class="falt"><label for="bm-temp">Temperatur</label><input id="bm-temp" name="temp" inputmode="decimal" autocomplete="off"></div>
      <div class="falt"><label for="bm-puls">Puls</label><input id="bm-puls" name="puls" inputmode="numeric" autocomplete="off"></div>
      <div class="falt"><label for="bm-bt">Blodtryck</label><input id="bm-bt" name="blodtryck" autocomplete="off"></div>
      <div class="falt"><label for="bm-bl">Blödning</label><select id="bm-bl" name="blodning">${val([['', 'Inte bedömt'], ['normal', 'Normal'], ['riklig', 'Riklig']], '')}</select></div>
      <div class="falt"><label for="bm-liv">Livmodern</label><select id="bm-liv" name="livmoder">${val([['', 'Inte bedömt'], ['fast', 'Fast och väl kontraherad'], ['mjuk', 'Mjuk']], '')}</select></div>
      <div class="falt"><label for="bm-ur">Har kissat</label><select id="bm-ur" name="urinerat">${val([['', 'Inte frågat'], ['ja', 'Ja'], ['nej', 'Nej']], '')}</select></div></div>
      <div class="knapprad"><button type="submit" class="knapp liten">Spara kontrollen</button></div>${fel}</form>` : ''}
    ${bb.barn.map(b => `<h3>${esc(b.namn)}</h3>${bbBarnHtml(b, kan)}`).join('')}
    ${bb.kriterier?.length ? `<h3>Utskrivning</h3><ul class="enkel-lista ob-kriterier">${bb.kriterier.map(x => `<li>${x.ok ? ikon.bock : ikon.kryss}<span>${esc(x.text)}</span></li>`).join('')}</ul>
      ${kan ? `<div class="kryssfalt"><input type="checkbox" id="fp-pku"><label for="fp-pku">PKU-provet bokas som återbesök</label></div><p class="knapprad"><button type="button" class="knapp" id="fp-utskriv">Skriv ut mor och barn</button></p>` : ''}` : ''}
  </section>`;
}

export const patient = { namn: 'forlossning-patient', visa: visaPatient };
async function visaPatient(main, [pid], _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Förlossning')}<div id="fp"><p class="tom">Hämtar förlossningen.</p></div>`;
  const ladda = () => visaPatient(main, [pid], _q, ctx);
  const d = await api(`/api/patient/${enc(pid)}/forlossning`);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#fp');
  if (!el) return;
  if (!d.forlossning) { el.innerHTML = `<p class="tom">Patienten har ingen förlossning som du kan se.</p><p><a class="knapp liten sekundar" href="#/forlossning">Till förlossningen</a></p>`; return; }
  const f = d.forlossning;
  main.querySelector('h1').textContent = `Förlossning, ${d.patient.namn}`;
  const kan = d.kanRegistrera && f.status === 'pagaende';
  const g = d.graviditet;
  el.innerHTML = `<p class="under-text">${esc(d.patient.personnummer)}, ${esc(f.vecka)}${f.antalFoster > 1 ? `, ${f.antalFoster} foster` : ''}. Startad ${esc(tidpunkt(f.start))} på ${esc(f.vardenhet?.namn ?? '')}.</p>
    <p class="knapprad"><a class="knapp liten sekundar" href="#/forlossning">Till förlossningen</a><a class="knapp liten sekundar" href="#/patient/${enc(pid)}/graviditet">Graviditetsjournalen</a></p>
    ${g ? `<section class="ov-sektion" aria-labelledby="fp-grav"><div class="sektion-huvud"><h2 id="fp-grav">Från graviditetsjournalen</h2></div><dl class="faktalista ob-fakta">
      <div><dt>Risk</dt><dd>${esc(g.risk.namn)}${g.risk.faktorer.length ? `: ${esc(g.risk.faktorer.map(x => x.text).join(' '))}` : ''}</dd></div>
      <div><dt>Tidigare förlossningar</dt><dd>${g.paritet}${g.tidigareKejsarsnitt ? `, varav ${g.tidigareKejsarsnitt} kejsarsnitt` : ''}</dd></div>
      <div><dt>Önskemål</dt><dd>${esc(g.onskemal?.text || 'Inga skrivna')}</dd></div></dl></section>` : ''}
    <section class="ov-sektion" aria-labelledby="fp-part"><div class="sektion-huvud"><h2 id="fp-part">Partogram</h2></div>
      ${partogramSvg(f.partogram)}
      ${f.lage ? `<p class="${f.lage.id === 'over_atgardslinje' ? 'ruta ruta-larm liten' : 'under-text'}">${esc(f.lage.text)}</p>` : ''}${f.fosterljudVarning ? varningar([f.fosterljudVarning], { niva: 'larm' }) : ''}
      ${kan ? `<form id="fp-part-ny" class="ob-form" novalidate aria-label="Registrera undersökning"><div class="falt-rad">
        <div class="falt"><label for="fp-opp">Öppning, cm</label><input id="fp-opp" name="oppning" inputmode="numeric" autocomplete="off"></div>
        <div class="falt"><label for="fp-fl">Fosterljud</label><input id="fp-fl" name="fosterljud" inputmode="numeric" autocomplete="off"></div>
        <div class="falt"><label for="fp-vk">Värkar per tio minuter</label><input id="fp-vk" name="varkor" inputmode="numeric" autocomplete="off"></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Registrera</button></div></div>${fel}</form>` : ''}
    </section>
    ${f.status === 'pagaende' ? ctgHtml(d) : ''}${smartlindringHtml(d)}${fodelseHtml(d)}${bbHtml(d)}
    <p class="dampad liten">${esc(d.demoregel)}</p>`;

  const post = async (knapp, vag, data, form = null) => {
    try { const r = await medKnapp(knapp, () => api(vag, { metod: 'POST', data }), form); if (r.varningar?.length || r.varning) notis(`${r.text ?? 'Sparat.'} ${[r.varning, ...(r.varningar ?? [])].filter(Boolean).join(' ')}`, 'fel', { kvar: true }); else notis(r.text ?? 'Sparat.'); ladda(); } catch { /* notis eller formulär */ }
  };
  const fid = f.id;
  const form = (id, fn) => { const x = el.querySelector(id); x?.addEventListener('submit', (e) => { e.preventDefault(); fn(x); }); };
  form('#fp-part-ny', (x) => post(x.querySelector('[type=submit]'), `/api/forlossning/${fid}/partogram`, { oppning: nummer(x.oppning.value), fosterljud: nummer(x.fosterljud.value), varkor: nummer(x.varkor.value) }, x));
  form('#fp-ctg-koppla', (x) => post(x.querySelector('[type=submit]'), `/api/forlossning/${fid}/ctg`, { forlopp: x.forlopp.value }, x));
  el.querySelector('#fp-ctg-bekrafta')?.addEventListener('click', (e) => post(e.currentTarget, `/api/forlossning/${fid}/ctg-bedomning`, {}));
  form('#fp-ctg-annan', (x) => post(x.querySelector('[type=submit]'), `/api/forlossning/${fid}/ctg-bedomning`, { klass: x.klass.value, motivering: x.motivering.value }, x));
  form('#fp-sm-ny', (x) => post(x.querySelector('[type=submit]'), `/api/forlossning/${fid}/smartlindring`, { metod: x.metod.value, anestesiBedomd: x.anestesiBedomd?.checked === true }, x));
  form('#fp-fodelse', (x) => post(x.querySelector('[type=submit]'), `/api/forlossning/${fid}/fodelse`, { kon: x.kon.value, satt: x.satt.value, vikt: nummer(x.vikt.value), langd: nummer(x.langd.value), huvudomfang: nummer(x.huvudomfang.value),
    apgar: [1, 5, 10].map(m => nummer(x[`apgar${m}`].value)) }, x));
  el.querySelectorAll('[data-fp-anmalan]').forEach(b => b.addEventListener('click', () => post(b, `/api/forlossning/${fid}/fodelseanmalan`, { ordning: Number(b.dataset.fpAnmalan) })));
  form('#fp-bb-mor', (x) => post(x.querySelector('[type=submit]'), `/api/patient/${enc(pid)}/bb`, { temp: nummer(x.temp.value), puls: nummer(x.puls.value), blodtryck: x.blodtryck.value.trim() || undefined,
    blodning: x.blodning.value || undefined, livmoder: x.livmoder.value || undefined, urinerat: x.urinerat.value ? x.urinerat.value === 'ja' : undefined }, x));
  el.querySelector('#fp-utskriv')?.addEventListener('click', (e) => post(e.currentTarget, `/api/patient/${enc(pid)}/bb/utskrivning`, { pkuAterbesok: el.querySelector('#fp-pku')?.checked === true }));
  kopplaBb(el, ladda);
}
