// Systemförvaltningen (runda 7, r4, Sussa 12.1 och KD1.1.3): systemförvaltarens fyra sidor. Regler och parametrar på
// ett ställe med giltighetsdatum, förhandsvisning och fyra ögon, omorganisation enligt HSA:s regler, undantag från
// visning och publicering, och lagring med provåterläsning. Systemet fyller i datum och förslag, förhandsvisar effekten
// medan man skriver och förklarar varför ett värde inte går. Inga patientuppgifter visas, bara antal.
import { esc, api, datum, tidpunkt, notis, medKnapp, dialog, vyRubrik, ikon, tal } from '../ui.js';
// Runda 8, r5: hjälpen i sammanhanget.
import { hjalpRuta } from '../hjalp.js';

// Förhandsvisning medan man skriver, med en kort paus så att inte varje tangent blir ett anrop.
function medForhandsvisning(dl, hamta, rita) {
  let timer = null;
  let nr = 0;
  const kor = async () => {
    if (!dl.open) return;
    const mitt = ++nr;
    const ruta = dl.querySelector('[data-forhand]');
    try {
      const f = await hamta();
      if (mitt === nr && ruta) ruta.innerHTML = rita(f);
    } catch (e) {
      if (mitt === nr && ruta) ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(e.message)}</p>`;
    }
  };
  dl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(kor, 250); });
  dl.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(kor, 50); });
  kor();
}

const tyst = (vag, data) => api(vag, { metod: 'POST', data, tyst: true });

function andringRad(a, { knappar = true } = {}) {
  return `<li class="ik-ater sf-andring"><div class="ik-text"><span class="ik-rubrik">${esc(a.rubrik)}</span>
      <span class="under-text">Från ${esc(a.forraText ?? '')} till <strong>${esc(a.vardeText ?? '')}</strong>, från ${esc(datum(a.giltigFran))}. Föreslagen av ${esc(a.foreslagenAv)} ${esc(tidpunkt(a.foreslagen))}.</span>
      <span class="under-text">Motivering: ${esc(a.motivering)}</span></div>
    ${knappar ? `<div class="ik-knappar">${a.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann="${a.id}">Godkänn</button><button type="button" class="knapp liten sekundar" data-avsla="${a.id}">Avslå</button>` : ''}${a.egen ? `<button type="button" class="knapp liten sekundar" data-aterkalla="${a.id}">Återkalla</button>` : ''}</div>` : ''}</li>`;
}

function historikTabell(rader) {
  if (!rader.length) return '<p class="tom liten">Inga beslutade ändringar ännu.</p>';
  return `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Ändring</th><th scope="col">Från och till</th><th scope="col">Gäller från</th><th scope="col">Föreslagen av</th><th scope="col">Beslut</th></tr></thead><tbody>
    ${rader.map(a => `<tr><th scope="row">${esc(a.rubrik)}</th><td>${esc(a.forraText ?? '')} till ${esc(a.vardeText ?? '')}<br><span class="dampad liten">${esc(a.motivering)}</span></td>
      <td>${a.gallerFran ? esc(datum(a.gallerFran)) : ''}</td><td>${esc(a.foreslagenAv)}</td><td>${esc(a.statusText)} av ${esc(a.beslutadAv ?? '')}, ${esc(tidpunkt(a.beslutad))}${a.kommentar ? `<br><span class="dampad liten">${esc(a.kommentar)}</span>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}

// Godkänn, avslå och återkalla, gemensamt för parametrar och undantag.
async function beslut(main, e, bas, visaIgen) {
  const g = e.target.closest('[data-godkann]');
  const a = e.target.closest('[data-avsla]');
  const r = e.target.closest('[data-aterkalla]');
  if (!g && !a && !r) return false;
  try {
    if (g) { await medKnapp(g, () => api(`${bas}/${g.dataset.godkann}/godkann`, { metod: 'POST', data: {} })); notis('Ändringen är godkänd. Den gäller från dagen som står i historiken.'); }
    if (r) { await medKnapp(r, () => api(`${bas}/${r.dataset.aterkalla}/avsluta`, { metod: 'POST', data: {} })); notis('Förslaget är återkallat.'); }
    if (a) {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Avslå ändringen</h2>
        <div class="falt"><label for="sf-kommentar">Varför avslås den? <span class="obl">(obligatoriskt)</span></label><textarea id="sf-kommentar" name="kommentar" rows="3" required maxlength="500"></textarea>
        <p class="hjalp">Den som föreslog ändringen ser kommentaren i historiken.</p></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avslå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (svar) { await medKnapp(a, () => api(`${bas}/${a.dataset.avsla}/avsluta`, { metod: 'POST', data: { kommentar: svar.data.kommentar } })); notis('Ändringen är avslagen.'); }
    }
  } catch { /* notis visad */ }
  visaIgen(main);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Regler och parametrar (Sussa 12.1.1.3, 12.1.1.5 till 12.1.1.9)

export const regler = {
  namn: 'regler',
  async visa(main) {
    // Runda 8, r5: hjälpen i sammanhanget.
    main.innerHTML = vyRubrik('Regler och parametrar', 'Demoreglerna och parametrarna som systemet använder, på ett ställe. En ändring gäller från ett datum och först när en annan systemförvaltare har godkänt den.') + hjalpRuta('regler') + '<div id="sf-regler"><p class="tom">Hämtar.</p></div>';
    const o = await api('/api/konfiguration');
    const el = main.querySelector('#sf-regler');
    if (!el) return;
    const vardeCell = (p) => `<strong>${esc(p.vardeText)}</strong>${p.arStandard ? '' : ' <span class="tagg">Ändrad</span>'}${p.kommande ? `<br><span class="under-text">${esc(p.kommande.vardeText)} från ${esc(datum(p.kommande.gallerFran))}</span>` : ''}${p.vantar ? `<br><span class="under-text">Väntar på godkännande: ${esc(p.vantar.vardeText)}</span>` : ''}`;
    el.innerHTML = `
      <section class="inkorg-sektion" aria-labelledby="sf-att-godkanna"><h2 id="sf-att-godkanna">Att godkänna <span class="antal${o.attGodkanna.length ? ' antal-aktiv' : ''}">${o.attGodkanna.length}</span></h2>
        ${o.attGodkanna.length ? `<ul class="inkorg-lista">${o.attGodkanna.map(a => andringRad(a)).join('')}</ul>` : '<p class="tom liten">Inga ändringar väntar på ditt godkännande.</p>'}</section>
      ${o.mina.length ? `<section class="inkorg-sektion" aria-labelledby="sf-mina"><h2 id="sf-mina">Mina förslag</h2><p class="liten">Väntar på att en annan systemförvaltare godkänner dem.</p><ul class="inkorg-lista">${o.mina.map(a => andringRad(a)).join('')}</ul></section>` : ''}
      ${o.grupper.map(g => `<section class="lm-sektion sf-omrade" aria-labelledby="sf-${esc(g.id)}"><h2 id="sf-${esc(g.id)}">${esc(g.rubrik)}</h2>
        <div class="tabellrulle"><table class="tabell sf-tabell"><thead><tr><th scope="col">Regel</th><th scope="col">Gäller nu</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
        ${g.parametrar.map(p => `<tr data-nyckel="${esc(p.nyckel)}"><th scope="row">${esc(p.rubrik)}<br><span class="dampad liten">${esc(p.beskrivning)}</span></th><td>${vardeCell(p)}</td>
          <td class="atgarder">${p.vantar ? '' : `<button type="button" class="knapp liten sekundar" data-andra="${esc(p.nyckel)}">Ändra</button>`}</td></tr>`).join('')}
        </tbody></table></div></section>`).join('')}
      <section class="lm-sektion" aria-labelledby="sf-lasta"><h2 id="sf-lasta">Det här går inte att ändra här</h2>
        <ul class="sf-lasta">${o.lasta.map(l => `<li><strong>${esc(l.rubrik)}.</strong> ${esc(l.varfor)}</li>`).join('')}</ul></section>
      <section class="lm-sektion" aria-labelledby="sf-historik"><h2 id="sf-historik">Historik</h2>${historikTabell(o.historik)}</section>
      <p class="demoregel">${esc(o.anmarkning)}</p>`;
    el.addEventListener('click', async (e) => {
      if (await beslut(main, e, '/api/konfiguration', regler.visa)) return;
      const b = e.target.closest('[data-andra]');
      if (b) andraParameter(main, o, b.dataset.andra, b);
    });
  },
};

async function andraParameter(main, o, nyckel, knapp) {
  const p = o.grupper.flatMap(g => g.parametrar).find(x => x.nyckel === nyckel);
  const lista = p.typ === 'lista';
  // Runda 8, r5: en regel med svaret ja eller nej väljs med två alternativ. Det som inte gäller nu är förvalt.
  const janej = p.typ === 'janej';
  const varde = lista ? p.varde.join(', ') : String(p.varde);
  const vardeFalt = janej
    ? `<fieldset class="kryssgrupp"><legend>Nytt värde</legend>${[['ja', p.text?.true], ['nej', p.text?.false]].map(([v, t]) => `<div class="kryssfalt"><input type="radio" id="sf-varde-${v}" name="varde" value="${v}"${(p.varde ? 'ja' : 'nej') !== v ? ' checked' : ''}><label for="sf-varde-${v}">${esc(t ?? v)}</label></div>`).join('')}
      <p class="hjalp">Gäller nu: ${esc(p.vardeText)}.</p></fieldset>`
    : `<div class="falt"><label for="sf-varde">${lista ? 'Sökorden, i ordning, med komma emellan' : `Nytt värde i ${esc(p.enhet)}`}</label>
      ${lista ? `<textarea id="sf-varde" name="varde" rows="3" required>${esc(varde)}</textarea>` : `<input id="sf-varde" name="varde" inputmode="numeric" value="${esc(varde)}" required>`}
      ${lista ? '' : `<p class="hjalp">Mellan ${esc(p.min)} och ${esc(p.max)} ${esc(p.enhet)}. Gäller nu: ${esc(p.vardeText)}.</p>`}</div>`;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${esc(p.rubrik)}</h2>
    <p class="liten">${esc(p.beskrivning)}</p>
    ${vardeFalt}
    <div class="falt smal"><label for="sf-fran">Gäller från</label><input id="sf-fran" name="giltigFran" type="date" value="${esc(o.forvalDatum)}" min="${esc(o.forvalDatum.slice(0, 10))}"></div>
    <div class="falt"><label for="sf-motivering">Varför behövs ändringen? <span class="obl">(obligatoriskt)</span></label><textarea id="sf-motivering" name="motivering" rows="2" required maxlength="1000"></textarea></div>
    <div class="sf-forhand" data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka för godkännande</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const f = dl.querySelector('#sf-varde') ?? dl.querySelector('[name="varde"]:checked');
      f.focus(); if (!janej) f.select();
      const las = () => (janej ? dl.querySelector('[name="varde"]:checked')?.value : f.value);
      medForhandsvisning(dl, () => tyst('/api/konfiguration/forhandsvisa', { nyckel, varde: las(), giltigFran: dl.querySelector('#sf-fran').value }),
        (r) => (r.ok
          ? `<div class="ruta ruta-info liten"><p><strong>Effekt</strong></p><ul>${r.effekt.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
          : `<p class="ruta ruta-larm liten" role="status">${esc(r.varfor)}</p>`));
    },
  });
  if (!svar) return;
  try {
    const r = await medKnapp(knapp, () => api('/api/konfiguration', { metod: 'POST', data: { nyckel, ...svar.data } }));
    notis(`Ändringen av ${r.andring.rubrik.toLowerCase()} väntar på att en annan systemförvaltare godkänner den.`);
  } catch { /* notis visad */ }
  regler.visa(main);
}

// ---------------------------------------------------------------------------------------------------------------
// Omorganisation (Sussa 12.1.1.1 och 12.1.1.4)

const TYPNAMN = { vardgivare: 'Vårdgivare', sjukhus: 'Sjukhus', vardenhet: 'Vårdenhet', arbetsplats: 'Arbetsplats' };

export const omorganisation = {
  namn: 'omorganisation',
  async visa(main) {
    main.innerHTML = vyRubrik('Omorganisation', 'Förbered en förändring med ett datum. Systemet visar i förväg vad som påverkas och flyttar det självt den dagen. Det som redan har hänt stannar där det hände.') + '<div id="sf-omorg"><p class="tom">Hämtar.</p></div>';
    const o = await api('/api/omorganisation');
    const el = main.querySelector('#sf-omorg');
    if (!el) return;
    const alla = [];
    const platta = (n, djup = 0) => { alla.push({ ...n, djup }); n.barn.forEach(b => platta(b, djup + 1)); };
    o.organisation.forEach(n => platta(n));
    const forberedda = o.forandringar.filter(f => f.status === 'forberedd');
    const ovriga = o.forandringar.filter(f => f.status !== 'forberedd');
    el.innerHTML = `
      <section class="inkorg-sektion" aria-labelledby="sf-forberedda"><h2 id="sf-forberedda">Förberedda förändringar <span class="antal${forberedda.length ? ' antal-aktiv' : ''}">${forberedda.length}</span></h2>
        ${forberedda.length ? `<ul class="inkorg-lista">${forberedda.map(f => `<li class="ik-ater sf-forandring"><div class="ik-text"><span class="ik-rubrik">${esc(f.beskrivning)}</span>
          <span class="under-text">${esc(f.typText)} den ${esc(datum(f.datum))}${f.dagarKvar > 0 ? `, om ${f.dagarKvar} ${f.dagarKvar === 1 ? 'dag' : 'dagar'}` : ''}. Förberedd av ${esc(f.forbereddAv)}.${f.vantarPaGodkannande ? ' Ändrar vem som har åtkomst och väntar på att en annan systemförvaltare godkänner den.' : `${f.godkandAv ? ` Godkänd av ${esc(f.godkandAv)}.` : ''} Systemet genomför den på dagen.`}</span></div>
          <div class="ik-knappar">${f.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann-omorg="${f.id}">Godkänn</button>` : ''}<button type="button" class="knapp liten sekundar" data-avbryt="${f.id}">Avbryt</button></div></li>`).join('')}</ul>` : '<p class="tom liten">Inga förändringar är förberedda.</p>'}</section>
      <section class="lm-sektion" aria-labelledby="sf-org"><h2 id="sf-org">Organisationen</h2>
        <div class="tabellrulle"><table class="tabell sf-org"><thead><tr><th scope="col">Enhet</th><th scope="col">HSA-id</th><th scope="col" class="tal">Personal</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
          ${alla.map(n => `<tr data-enhet="${esc(n.id)}"><th scope="row" class="sf-djup-${Math.min(n.djup, 3)}">${esc(n.namn)}<br><span class="dampad liten">${esc(TYPNAMN[n.typ] ?? n.typ)}</span></th><td>${esc(n.hsaId)}</td><td class="tal">${n.personal}</td>
            <td class="atgarder">${n.typ === 'vardgivare' ? '' : `<button type="button" class="knapp liten sekundar" data-forandra="${esc(n.id)}">Ändra</button>`}</td></tr>`).join('')}
        </tbody></table></div></section>
      ${o.stangda.length ? `<section class="lm-sektion" aria-labelledby="sf-stangda"><h2 id="sf-stangda">Stängda enheter</h2><p class="liten">Finns kvar, eftersom uppgifter, spärrar och loggar pekar på dem (HSA 2.1).</p>
        <ul>${o.stangda.map(s => `<li>${esc(s.namn)} (${esc(s.hsaId)}), stängd ${esc(datum(s.till))}${s.efterfoljare.length ? `. Verksamheten finns på ${esc(s.efterfoljare.join(' och '))}` : ''}.</li>`).join('')}</ul></section>` : ''}
      ${ovriga.length ? `<section class="lm-sektion" aria-labelledby="sf-genomforda"><h2 id="sf-genomforda">Genomförda och avbrutna</h2><ul>${ovriga.map(f => `<li><strong>${esc(f.beskrivning)}</strong>, ${esc(datum(f.datum))}: ${esc(f.statusText.toLowerCase())}${f.resultat?.length ? `. ${esc(f.resultat.map(r => r.text).join(', '))}` : ''}.</li>`).join('')}</ul></section>` : ''}
      <p class="demoregel">${esc(o.anmarkning)}</p>`;
    el.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-godkann-omorg]');
      if (g) {
        try {
          const r = await medKnapp(g, () => api(`/api/omorganisation/${g.dataset.godkannOmorg}/godkann`, { metod: 'POST', data: {} }));
          notis(r.omorganisation.status === 'genomford' ? `Förändringen är godkänd och genomförd: ${r.omorganisation.beskrivning}.` : 'Förändringen är godkänd. Systemet genomför den på dagen.');
        } catch { /* notis visad */ }
        return omorganisation.visa(main);
      }
      const a = e.target.closest('[data-avbryt]');
      if (a) {
        try { await medKnapp(a, () => api(`/api/omorganisation/${a.dataset.avbryt}/avbryt`, { metod: 'POST', data: {} })); notis('Förändringen är avbruten. Inget har ändrats.'); } catch { /* notis visad */ }
        return omorganisation.visa(main);
      }
      const b = e.target.closest('[data-forandra]');
      if (b) forbered(main, o, alla, alla.find(n => n.id === b.dataset.forandra), b);
    });
  },
};

// Förändringarna som går att göra för en enhet. Namnbyte är förvalt, eftersom det är det vanligaste.
const TYPER_FOR = (n) => (n.typ === 'vardenhet' ? ['namnbyte', 'sammanslagning', 'delning', 'nedlaggning', 'ny_enhet'] : n.typ === 'sjukhus' ? ['namnbyte', 'ny_enhet'] : ['namnbyte']);

function typFalt(typ, n, alla, o) {
  const vardenheter = alla.filter(x => x.typ === 'vardenhet' && x.id !== n.id);
  const ap = alla.filter(x => x.typ === 'arbetsplats' && n.barn.some(b => b.id === x.id));
  if (typ === 'namnbyte') return `<div class="falt"><label for="sf-namn">Nytt namn</label><input id="sf-namn" name="namn" value="${esc(n.namn)}" required maxlength="120"></div>`;
  if (typ === 'ny_enhet') return `<div class="falt"><label for="sf-namn">Namn på ${n.typ === 'vardenhet' ? 'den nya arbetsplatsen' : 'den nya vårdenheten'} under ${esc(n.namn)}</label><input id="sf-namn" name="namn" required maxlength="120"></div>`;
  if (typ === 'sammanslagning') return `<fieldset class="kryssgrupp"><legend>Slås samman med</legend>${vardenheter.map((v, i) => `<div class="kryssfalt"><input type="checkbox" id="sf-g${i}" name="gamla" value="${esc(v.id)}"><label for="sf-g${i}">${esc(v.namn)}</label></div>`).join('')}</fieldset>
    <div class="falt"><label for="sf-namn">Namn på den nya vårdenheten</label><input id="sf-namn" name="namn" required maxlength="120"></div>`;
  if (typ === 'delning') return `<div class="falt"><label for="sf-namn1">Namn på den första nya vårdenheten</label><input id="sf-namn1" name="namn1" required maxlength="120"><p class="hjalp">Den tar över det som hör till vårdenheten själv.</p></div>
    <div class="falt"><label for="sf-namn2">Namn på den andra nya vårdenheten</label><input id="sf-namn2" name="namn2" required maxlength="120"></div>
    ${ap.length ? `<fieldset class="kryssgrupp"><legend>Arbetsplatser som går till den andra</legend>${ap.map((a, i) => `<div class="kryssfalt"><input type="checkbox" id="sf-a${i}" name="till2" value="${esc(a.id)}"><label for="sf-a${i}">${esc(a.namn)}</label></div>`).join('')}</fieldset>` : ''}`;
  const forslag = o.mottagare[n.id];
  return `<div class="falt"><label for="sf-mottagare">Vårdenheten som tar över det som pågår</label><select id="sf-mottagare" name="mottagare">${vardenheter.map(v => `<option value="${esc(v.id)}"${v.id === forslag ? ' selected' : ''}>${esc(v.namn)}</option>`).join('')}</select>
    <p class="hjalp">Systemet föreslår en vårdenhet i samma del av organisationen.</p></div>`;
}

function lasPlan(dl, typ, n) {
  const v = (s) => dl.querySelector(s)?.value ?? '';
  const kryss = (namn) => [...dl.querySelectorAll(`input[name="${namn}"]:checked`)].map(x => x.value);
  if (typ === 'namnbyte') return { enhet: n.id, namn: v('#sf-namn') };
  if (typ === 'ny_enhet') return { forald: n.id, namn: v('#sf-namn') };
  if (typ === 'sammanslagning') return { gamla: [n.id, ...kryss('gamla')], namn: v('#sf-namn') };
  if (typ === 'delning') {
    const till2 = kryss('till2');
    const ap = n.barn.filter(b => b.typ === 'arbetsplats').map(b => b.id);
    return { gammal: n.id, nya: [{ namn: v('#sf-namn1'), arbetsplatser: ap.filter(a => !till2.includes(a)) }, { namn: v('#sf-namn2'), arbetsplatser: till2 }] };
  }
  return { enhet: n.id, mottagare: v('#sf-mottagare') };
}

function ritaForhandsvisning(f) {
  if (!f.ok) return `<p class="ruta ruta-larm liten" role="status">${esc(f.varfor)}</p>`;
  return `<div class="ruta ruta-info liten sf-paverkas"><p><strong>${esc(f.beskrivning)}</strong> den ${esc(datum(f.datum))}. ${esc(f.k6)}</p>
    <ul>${f.paverkas.map(p => `<li><strong>${esc(p.text)}: ${tal(p.antal, 0)}.</strong> ${esc(p.atgard)}</li>`).join('')}</ul>
    ${f.manuellt.length ? `<p><strong>Görs inte av systemet</strong></p><ul>${f.manuellt.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>`;
}

async function forbered(main, o, alla, n, knapp) {
  const typer = TYPER_FOR(n);
  let plan = null;
  let typ = typer[0];
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Förbered en förändring för ${esc(n.namn)}</h2>
    ${typer.length > 1 ? `<div class="falt"><label for="sf-typ">Förändring</label><select id="sf-typ" name="typ">${typer.map(t => `<option value="${t}">${esc(o.typer[t].text)}</option>`).join('')}</select></div>` : ''}
    <div class="sf-typfalt" data-typfalt>${typFalt(typ, n, alla, o)}</div>
    <div class="falt smal"><label for="sf-datum">Gäller från</label><input id="sf-datum" name="datum" type="date" value="${esc(o.forvalDatum)}"><p class="hjalp">Förvalt är första dagen i nästa månad.</p></div>
    <div data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Förbered</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    validera: (_d, dl) => { plan = lasPlan(dl, typ, n); return null; },
    onOpen: (dl) => {
      const f = dl.querySelector('#sf-namn');
      if (f) { f.focus(); f.select(); }
      dl.querySelector('#sf-typ')?.addEventListener('change', (e) => {
        typ = e.target.value;
        dl.querySelector('[data-typfalt]').innerHTML = typFalt(typ, n, alla, o);
        dl.querySelector('[data-typfalt] input, [data-typfalt] select')?.focus();
      });
      medForhandsvisning(dl, () => tyst('/api/omorganisation/forhandsvisa', { typ, datum: dl.querySelector('#sf-datum').value, plan: lasPlan(dl, typ, n) }), ritaForhandsvisning);
    },
  });
  if (!svar || !plan) return;
  try {
    const r = await medKnapp(knapp, () => api('/api/omorganisation', { metod: 'POST', data: { typ, datum: svar.data.datum, plan } }));
    const f = r.omorganisation;
    notis(f.status === 'genomford' ? `Förändringen är genomförd: ${f.beskrivning}.`
      : f.vantarPaGodkannande ? `Förändringen är förberedd till ${datum(f.datum)}: ${f.beskrivning}. Den väntar på att en annan systemförvaltare godkänner den.`
        : `Förändringen är förberedd till ${datum(f.datum)}: ${f.beskrivning}. Systemet genomför den på dagen.`);
  } catch { /* notis visad */ }
  omorganisation.visa(main);
}

// ---------------------------------------------------------------------------------------------------------------
// Undantag från visning och publicering (Sussa 12.1.1.10)

export const undantag = {
  namn: 'undantag',
  async visa(main) {
    main.innerHTML = vyRubrik('Undantag från visning', 'Uppgifter som inte visas i systemet, inte lämnas ut genom FHIR till externa tillämpningar eller inte publiceras till nationella tjänster. Det som är undantaget står här, och personalen ser en rad i journalen om det.') + '<div id="sf-undantag"><p class="tom">Hämtar.</p></div>';
    const o = await api('/api/undantag');
    const el = main.querySelector('#sf-undantag');
    if (!el) return;
    el.innerHTML = `
      <section class="inkorg-sektion" aria-labelledby="sf-u-aktiva"><h2 id="sf-u-aktiva">Undantaget nu <span class="antal${o.aktiva.length ? ' antal-aktiv' : ''}">${o.aktiva.length}</span></h2>
        ${o.aktiva.length ? `<ul class="inkorg-lista">${o.aktiva.map(u => `<li class="ik-ater sf-undantag-rad"><div class="ik-text"><span class="ik-rubrik">${ikon.oga}<span>${esc(u.omfangText)}: ${esc(u.namn)}</span></span>
          <span class="under-text">Undantaget från ${esc(u.kanalText)}, från ${esc(datum(u.gallerFran))}. Beslutat av ${esc(u.beslutadAv ?? '')}.</span><span class="under-text">Motivering: ${esc(u.motivering)}</span></div>
          <div class="ik-knappar"><button type="button" class="knapp liten sekundar" data-avsluta-undantag="${esc(u.nyckel)}">Avsluta</button></div></li>`).join('')}</ul>` : '<p class="tom liten">Inget är undantaget.</p>'}
        <button type="button" class="knapp" data-nytt-undantag>Nytt undantag</button></section>
      <section class="inkorg-sektion" aria-labelledby="sf-u-godkanna"><h2 id="sf-u-godkanna">Att godkänna <span class="antal${o.attGodkanna.length ? ' antal-aktiv' : ''}">${o.attGodkanna.length}</span></h2>
        ${o.attGodkanna.length ? `<ul class="inkorg-lista">${o.attGodkanna.map(a => andringRad(a)).join('')}</ul>` : '<p class="tom liten">Inga undantag väntar på ditt godkännande.</p>'}
        ${o.mina.length ? `<p class="liten">Dina förslag som väntar på en annan systemförvaltare:</p><ul class="inkorg-lista">${o.mina.map(a => andringRad(a)).join('')}</ul>` : ''}</section>
      ${o.kommande.length ? `<section class="lm-sektion" aria-labelledby="sf-u-kommande"><h2 id="sf-u-kommande">Beslutade, gäller senare</h2><ul>${o.kommande.map(a => `<li>${esc(a.rubrik)}: ${esc(a.vardeText)} från ${esc(datum(a.gallerFran))}.</li>`).join('')}</ul></section>` : ''}
      <section class="lm-sektion" aria-labelledby="sf-u-publ"><h2 id="sf-u-publ">Publicering till nationella tjänster (simulerad)</h2>
        <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Uppgifter</th><th scope="col" class="tal">Publiceras</th><th scope="col" class="tal">Undantagna</th></tr></thead><tbody>
          ${o.publicering.map(p => `<tr><th scope="row">${esc(p.text)}</th><td class="tal">${tal(p.antal, 0)}</td><td class="tal">${tal(p.undantagna, 0)}</td></tr>`).join('')}</tbody></table></div>
        <p class="demoregel">${esc(o.anmarkning)}</p></section>
      <section class="lm-sektion" aria-labelledby="sf-u-regler"><h2 id="sf-u-regler">Det här gör ett undantag aldrig</h2><ul>${o.regler.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>
      <section class="lm-sektion" aria-labelledby="sf-u-historik"><h2 id="sf-u-historik">Historik</h2>${historikTabell(o.historik)}</section>`;
    el.addEventListener('click', async (e) => {
      if (await beslut(main, e, '/api/undantag', undantag.visa)) return;
      const n = e.target.closest('[data-nytt-undantag]');
      if (n) return nyttUndantag(main, o, n);
      const a = e.target.closest('[data-avsluta-undantag]');
      if (a) {
        const u = o.aktiva.find(x => x.nyckel === a.dataset.avslutaUndantag);
        return nyttUndantag(main, o, a, { omfang: u.omfang, varde: u.varde, kanaler: [] });
      }
    });
  },
};

async function nyttUndantag(main, o, knapp, forval = null) {
  const valOmfang = (om) => o.valbara[om].map(v => `<option value="${esc(v.varde)}"${forval?.varde === v.varde ? ' selected' : ''}>${esc(v.namn)}</option>`).join('');
  const avslut = forval && !forval.kanaler.length;
  // Det valda läses ur dialogen när den skickas. Ett avslut gäller det undantag som redan finns.
  const las = (dl) => (avslut ? { omfang: forval.omfang, varde: forval.varde, kanaler: [] }
    : { omfang: dl.querySelector('#sf-u-omfang').value, varde: dl.querySelector('#sf-u-varde').value, kanaler: [...dl.querySelectorAll('input[name="kanaler"]:checked')].map(x => x.value) });
  let valt = null;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${avslut ? 'Avsluta undantaget' : 'Nytt undantag'}</h2>
    <div class="falt-rad"><div class="falt smal"><label for="sf-u-omfang">Vad</label><select id="sf-u-omfang" name="omfang"${avslut ? ' disabled' : ''}>${Object.entries(o.omfang).map(([k, t]) => `<option value="${k}"${forval?.omfang === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="falt"><label for="sf-u-varde">Vilken</label><select id="sf-u-varde" name="varde"${avslut ? ' disabled' : ''}>${valOmfang(forval?.omfang ?? 'anteckningstyp')}</select></div></div>
    ${avslut ? '<p>Uppgifterna visas och publiceras som förut när undantaget har avslutats.</p>' : `<fieldset class="kryssgrupp"><legend>Undantas från</legend>${Object.entries(o.kanaler).map(([k, t], i) => `<div class="kryssfalt"><input type="checkbox" id="sf-u-k${i}" name="kanaler" value="${k}"${k === 'nationell' ? ' checked' : ''}><label for="sf-u-k${i}">${esc(t)}</label></div>`).join('')}</fieldset>`}
    <div class="falt smal"><label for="sf-u-fran">Gäller från</label><input id="sf-u-fran" name="giltigFran" type="date" value="${esc(o.forvalDatum)}"></div>
    <div class="falt"><label for="sf-u-motivering">Motivering, som personalen ser i journalen <span class="obl">(obligatoriskt)</span></label><textarea id="sf-u-motivering" name="motivering" rows="2" required maxlength="500"></textarea></div>
    <div data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka för godkännande</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      dl.querySelector('#sf-u-omfang').addEventListener('change', (e) => { dl.querySelector('#sf-u-varde').innerHTML = valOmfang(e.target.value); });
      medForhandsvisning(dl, () => tyst('/api/undantag/forhandsvisa', las(dl)),
        (r) => (r.ok ? `<div class="ruta ruta-info liten"><ul>${r.effekt.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : `<p class="ruta ruta-larm liten" role="status">${esc(r.varfor)}</p>`));
    },
    validera: (_d, dl) => { valt = las(dl); return null; },
  });
  if (!svar || !valt) return;
  try {
    await medKnapp(knapp, () => api('/api/undantag', { metod: 'POST', data: { ...valt, giltigFran: svar.data.giltigFran, motivering: svar.data.motivering } }));
    notis(avslut ? 'Avslutet väntar på att en annan systemförvaltare godkänner det.' : 'Undantaget väntar på att en annan systemförvaltare godkänner det.');
  } catch { /* notis visad */ }
  undantag.visa(main);
}

// ---------------------------------------------------------------------------------------------------------------
// Lagring (KD1.1.3.3 till KD1.1.3.6)

const storlek = (b) => (b >= 1048576 ? `${tal(b / 1048576, 1)} MB` : `${tal(b / 1024, 0)} kB`);

export const lagring = {
  namn: 'lagring',
  async visa(main) {
    main.innerHTML = vyRubrik('Lagring', 'Databasens storlek, varje huvudmans uppgifter för sig och provåterläsning av säkerhetskopian.') + '<div id="sf-lagring"><p class="tom">Hämtar.</p></div>';
    const o = await api('/api/lagring');
    const el = main.querySelector('#sf-lagring');
    if (!el) return;
    const senaste = o.matningar[0];
    el.innerHTML = `
      <section class="inkorg-sektion" aria-labelledby="sf-l-prov"><h2 id="sf-l-prov">Säkerhetskopiering och återläsning</h2>
        ${senaste ? `<p class="${senaste.godkand ? 'ruta ruta-ok' : 'ruta ruta-larm'} liten">${senaste.godkand ? ikon.bock : ikon.varning} Senaste provåterläsning ${esc(tidpunkt(senaste.tid))}: ${senaste.godkand ? 'godkänd' : 'underkänd'}, ${esc(storlek(senaste.byte))}, ${tal(senaste.rader, 0)} rader i ${senaste.tabeller} tabeller, ${senaste.ms} ms.</p>` : '<p class="liten">Ingen provåterläsning är gjord i den här sandlådan än. Den körs också automatiskt i bygget.</p>'}
        <button type="button" class="knapp" data-prova>Pröva säkerhetskopiering och återläsning</button>
        <div data-provresultat aria-live="polite"></div></section>
      <section class="lm-sektion" aria-labelledby="sf-l-huvudman"><h2 id="sf-l-huvudman">Uppgifter per huvudman</h2>
        <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Huvudman</th><th scope="col" class="tal">Rader</th><th scope="col" class="tal">Patienter</th><th scope="col">Uttag</th></tr></thead><tbody>
          ${o.huvudman.map(h => `<tr><th scope="row">${esc(h.namn)}</th><td class="tal">${tal(h.rader, 0)}</td><td class="tal">${tal(h.patienter, 0)}</td><td>${h.kontroll.ok ? ikon.bock : ikon.varning} ${esc(h.kontroll.text)}</td></tr>`).join('')}</tbody></table></div>
        ${o.oklassadeText ? `<p class="ruta ruta-larm liten">${esc(o.oklassadeText)}</p>` : ''}</section>
      <section class="lm-sektion" aria-labelledby="sf-l-uttag"><h2 id="sf-l-uttag">Uttag som fil</h2>
        <p class="liten">En huvudman kan ta med sig sina uppgifter, till exempel vid byte av journalsystem. Uttaget kräver ett beslut med diarienummer och skäl, och en annan systemförvaltare godkänner det. Filen har ett manifest med kontrollsummor, en NDJSON-fil per tabell och ett FHIR-bundle per patient, och varje patient i filen loggas.</p>
        ${o.uttag.length ? `<ul class="inkorg-lista">${o.uttag.map(u => `<li class="ik-ater sf-uttag"><div class="ik-text"><span class="ik-rubrik">${esc(u.huvudman.namn)}, beslut ${esc(u.diarienummer)}</span>
          <span class="under-text">${esc(u.skalText)}: ${esc(u.motivering)} Registrerat av ${esc(u.beslutatAv)} ${esc(tidpunkt(u.beslutat))}.</span>
          <span class="under-text">${u.status === 'godkant' ? `Godkänt av ${esc(u.godkantAv)}.${u.filer ? ` Filen har tagits ut ${u.filer} ${u.filer === 1 ? 'gång' : 'gånger'}.` : ''}` : 'Väntar på att en annan systemförvaltare godkänner beslutet.'}</span></div>
          <div class="ik-knappar">${u.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann-uttag="${u.id}">Godkänn</button>` : ''}${u.status === 'godkant' ? `<a class="knapp liten" href="/api/lagring/uttag/${u.id}/fil" download data-hamta-uttag>Hämta filen</a>` : ''}</div></li>`).join('')}</ul>` : ''}
        <button type="button" class="knapp sekundar" data-nytt-uttag>Registrera beslut om uttag</button></section>
      <section class="lm-sektion" aria-labelledby="sf-l-volym"><h2 id="sf-l-volym">Volym</h2>
        <p>Databasen är ${esc(storlek(o.byte))} med ${tal(o.rader, 0)} rader i ${o.tabeller} tabeller.</p>
        <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Största tabellerna</th><th scope="col" class="tal">Rader</th></tr></thead><tbody>
          ${o.storsta.map(t => `<tr><th scope="row">${esc(t.tabell)}</th><td class="tal">${tal(t.rader, 0)}</td></tr>`).join('')}</tbody></table></div>
        ${o.matningar.length > 1 ? `<p class="liten">Tidigare mätningar: ${o.matningar.slice(1).map(m => `${esc(tidpunkt(m.tid))} ${esc(storlek(m.byte))}`).join(', ')}.</p>` : ''}</section>
      <section class="lm-sektion" aria-labelledby="sf-l-rutin"><h2 id="sf-l-rutin">Rutinen</h2><ul>${o.rutin.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="demoregel">${esc(o.anmarkning)}</p></section>`;
    el.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-godkann-uttag]');
      if (g) {
        try { await medKnapp(g, () => api(`/api/lagring/uttag/${g.dataset.godkannUttag}/godkann`, { metod: 'POST', data: {} })); notis('Uttaget är godkänt. Filen kan hämtas.'); } catch { /* notis visad */ }
        return lagring.visa(main);
      }
      const n = e.target.closest('[data-nytt-uttag]');
      if (n) return nyttUttag(main, o, n);
      const b = e.target.closest('[data-prova]');
      if (!b) return;
      try {
        const r = await medKnapp(b, () => api('/api/lagring/prov', { metod: 'POST', data: {} }));
        notis(r.ok ? 'Säkerhetskopian lästes tillbaka och allt stämmer.' : 'Provåterläsningen hittade avvikelser.', r.ok ? 'ok' : 'fel');
        lagring.visa(main).then(() => {
          const ut = main.querySelector('[data-provresultat]');
          if (ut) ut.innerHTML = `<ul class="sf-kontroller">${r.kontroller.map(k => `<li>${k.ok ? ikon.bock : ikon.kryss} ${esc(k.text)}${k.detalj ? `: ${esc(k.detalj)}` : ''}</li>`).join('')}</ul><p class="dampad liten">SHA-256 för kopian: ${esc(r.sha256)}</p>`;
        });
      } catch { /* notis visad */ }
    });
  },
};

// Beslut om uttag: huvudmannen, diarienumret, skälet och vad beslutet gäller. Systemet föreslår den första huvudmannen.
async function nyttUttag(main, o, knapp) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Registrera beslut om uttag</h2>
    <div class="falt"><label for="sf-ut-hm">Huvudman</label><select id="sf-ut-hm" name="huvudman">${o.huvudman.map(h => `<option value="${esc(h.id)}">${esc(h.namn)}</option>`).join('')}</select></div>
    <div class="falt"><label for="sf-ut-dnr">Beslutets diarienummer <span class="obl">(obligatoriskt)</span></label><input id="sf-ut-dnr" name="diarienummer" required maxlength="60"></div>
    <div class="falt"><label for="sf-ut-skal">Skäl</label><select id="sf-ut-skal" name="skal">${Object.entries(o.skal).map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('')}</select></div>
    <div class="falt"><label for="sf-ut-mot">Vad beslutet gäller <span class="obl">(obligatoriskt)</span></label><textarea id="sf-ut-mot" name="motivering" rows="2" required maxlength="500"></textarea></div>
    <p class="liten">En annan systemförvaltare godkänner beslutet innan filen kan hämtas.</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera beslutet</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, { klass: 'dialog-bred' });
  if (!svar) return;
  try {
    await medKnapp(knapp, () => api('/api/lagring/uttag', { metod: 'POST', data: svar.data }));
    notis('Beslutet är registrerat och väntar på att en annan systemförvaltare godkänner det.');
  } catch { /* notis visad */ }
  lagring.visa(main);
}
