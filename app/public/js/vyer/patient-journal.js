// Journalen: anteckningar per enhet och typ, läsning med versioner, ny anteckning från mall, utkast, signering och rättelse.
import { esc, api, tidpunkt, datum, migreradEtikett, notis, faltFel, medKnapp, ikon, ApiFel, felNotis } from '../ui.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { far, S, minVardenhet, uppdateraInkorg, vardenhetAv as enhetsVardenhet } from '../app.js';
import { doldaRad, kravRuta } from './patient.js';
import { dokumenterasHtml, kopplaDokumenteras, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
import * as kontrasignering from '../kontrasignering.js';
import { satUppAterbesok } from './patient-tider.js';
// Runda 10, r2: en enskild anteckning skrivs ut för sig (Sussa 3.1.9.4).
import * as utskrift from '../utskrift.js';
// Runda 8, r5: mallen för tobaksvanor med fasta svarsalternativ, och epikrisen med systemets förslag.
import * as tobak from './patient-tobak.js';
// Runda 9, r7: mallen för levnadsvanor har samma gränssnitt som mallen för tobaksvanor.
import * as levnadsvanor from './patient-levnadsvanor.js';
// Runda 10, r3: formulär som verksamheten har byggt, röstinmatning och rättstavning i sökorden.
import * as formular from './patient-formular.js';
import * as diktat from '../rostinmatning.js';
import * as stavning from '../stavning-ui.js';
// Ett formulär har sin definition med i mallen eller i anteckningen (a.formular), så att ett utkast och en rättelse fylls
// i med den version som anteckningen skrevs med.
const strukturerad = (typ, a = null) => {
  const f = a?.formular ?? mallar?.find(m => m.typ === typ)?.formular;
  if (f) return { modul: formular.modul(f), nyckel: 'formular' };
  return typ === 'Levnadsvanor' ? { modul: levnadsvanor, nyckel: 'levnadsvanor' } : { modul: tobak, nyckel: 'tobak' };
};

let mallar = null;
// Runda 10, r3: mallarna beror på vem som är inloggad (formulären har yrken och vårdenheter), så de hämtas igen när personen byts.
let mallarFor = null;
const filter = { enhet: '', typ: '' };

const kanSkriva = (kategori) => far(kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal');

export async function visa(el, ctx) {
  const [lista] = await Promise.all([
    api(`/api/patient/${encodeURIComponent(ctx.id)}/anteckningar`),
    mallar && mallarFor === S.session?.personal?.id ? Promise.resolve() : api('/api/mallar').then(m => { mallar = m; mallarFor = S.session?.personal?.id; }),
  ]);
  if (!ctx.aktuell()) return;
  const ant = lista.anteckningar;
  const enheter = [...new Map(ant.map(a => [a.enhet.id, a.enhet.namn]))];
  const typer = [...new Set(ant.map(a => a.typ))];
  if (filter.enhet && !enheter.some(([id]) => id === filter.enhet)) filter.enhet = '';
  if (filter.typ && !typer.includes(filter.typ)) filter.typ = '';
  const egnaMallar = mallar.filter(m => kanSkriva(m.kategori));

  // I läsläget vid avbrott kommer listan från läskopian, som bara har de senaste anteckningarna.
  const urKopia = lista.totalt > lista.iLaskopian
    ? `<p class="ruta ruta-info liten">Läskopian har de ${lista.iLaskopian} senaste av patientens ${lista.totalt} anteckningar som du kan se.</p>` : '';
  el.innerHTML = `<h2 class="sr">Journal</h2>${egnaMallar.length ? hjalpRuta('daganteckning') : ''}${urKopia}${doldaRad(lista.dolda)}
    <div class="journal-delad">
      <div class="journal-lista">
        <div class="journal-verktyg">
          <div class="falt kompakt" data-las-ok><label for="j-enhet">Enhet</label><select id="j-enhet"><option value="">Alla enheter</option>${enheter.map(([id, n]) => `<option value="${esc(id)}"${filter.enhet === id ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="falt kompakt" data-las-ok><label for="j-typ">Typ</label><select id="j-typ"><option value="">Alla typer</option>${typer.map(t => `<option${filter.typ === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          ${egnaMallar.length ? `<a class="knapp liten" href="${ctx.href('journal', 'ny')}" data-skriv>${ikon.plus}<span>Ny anteckning</span></a>` : ''}
        </div>
        <div id="j-poster"></div>
      </div>
      <div class="journal-las" id="j-las"></div>
    </div>`;

  const ritaLista = () => {
    const urval = ant.filter(a => (!filter.enhet || a.enhet.id === filter.enhet) && (!filter.typ || a.typ === filter.typ));
    const grupper = new Map();
    for (const a of urval) { if (!grupper.has(a.enhet.namn)) grupper.set(a.enhet.namn, []); grupper.get(a.enhet.namn).push(a); }
    el.querySelector('#j-poster').innerHTML = urval.length ? [...grupper].map(([enhet, rader]) => `<section class="j-grupp"><h3>${esc(enhet)}</h3><ul>${rader.map(a => `<li>
        <a href="${ctx.href('journal', a.id)}"${String(a.id) === String(ctx.sub) ? ' aria-current="true"' : ''}>
          <span class="j-rad1"><span class="j-typ">${esc(a.typ)}</span><time>${esc(datum(a.signerad?.tid ?? a.skapad))}</time></span>
          <span class="j-rad2">${esc(a.forfattare?.namn ?? '')}${a.status === 'utkast' ? ' <span class="tagg tagg-utkast">Utkast</span>' : ''}${a.version > 1 ? ` <span class="tagg">Rättad, version ${a.version}</span>` : ''}</span>
          ${a.kallaEtikett ? `<span class="j-rad2">${migreradEtikett(a)}</span>` : ''}
        </a></li>`).join('')}</ul></section>`).join('') : '<p class="tom">Inga anteckningar matchar urvalet.</p>';
  };
  ritaLista();
  el.querySelector('#j-enhet').addEventListener('change', e => { filter.enhet = e.target.value; ritaLista(); });
  el.querySelector('#j-typ').addEventListener('change', e => { filter.typ = e.target.value; ritaLista(); });

  const las = el.querySelector('#j-las');
  if (ctx.sub === 'ny') return nyForm(las, ctx, egnaMallar);
  // Runda 8, r5: direkt till mallen för tobaksvanor, och till epikrisen med systemets förslag.
  if (ctx.sub === 'tobak') return nyForm(las, ctx, egnaMallar, { typ: 'Tobaksvanor' });
  if (ctx.sub === 'levnadsvanor') return nyForm(las, ctx, egnaMallar, { typ: 'Levnadsvanor' });
  if (ctx.sub === 'epikris') return nyEpikris(las, ctx, egnaMallar);
  const id = ctx.sub ?? ant.find(a => a.status === 'signerad')?.id ?? ant[0]?.id;
  if (!id) { las.innerHTML = '<p class="tom">Det finns inga anteckningar än.</p>'; return; }
  await lasAnteckning(las, ctx, id);
}

async function lasAnteckning(las, ctx, id) {
  let a;
  try { a = await api(`/api/anteckning/${encodeURIComponent(id)}`); } catch (e) {
    if (e instanceof ApiFel && (e.status === 403 || e.status === 404)) { las.innerHTML = e.status === 404 ? '<p class="tom">Anteckningen finns inte eller är ett utkast som bara författaren ser.</p>' : kravRuta(e); return; }
    throw e;
  }
  if (!ctx.aktuell()) return;
  if (a.status === 'utkast' && a.forfattare?.id === S.session.personal.id) return utkastForm(las, ctx, a);
  const senaste = a.versioner.at(-1);
  const aldre = a.versioner.slice(0, -1).reverse();
  const kanRatta = !senaste.ersatt && senaste.status === 'signerad' && kanSkriva(senaste.kategori) && enhetsVardenhet(senaste.enhet.id) === minVardenhet();
  // Runda 5, r1: från en signerad anteckning föreslår systemet återbesöket ur anteckningens planering (Sussa 3.4.1.1).
  const kanAterbesok = senaste.status === 'signerad' && far('skriv_journal');
  const kanSkrivaUt = senaste.status === 'signerad' && far('skriv_ut');
  // Runda 10, r7: en signerad anteckning kan tas ut som Word-dokument (kontorsstödet). Uttaget loggas på patienten.
  const word = senaste.status === 'signerad' ? `<p class="liten"><a href="/api/anteckning/${encodeURIComponent(senaste.id)}/docx" download>Anteckningen som Word-dokument</a></p>` : '';
  las.innerHTML = `<article class="anteckning" aria-labelledby="ant-rubrik">
      ${anteckningHuvud(senaste, 'ant-rubrik', a.id !== senaste.id ? `<p class="ruta ruta-info liten">Du öppnade version ${a.version}. Här visas den gällande versionen ${senaste.version}.</p>` : '')}
      ${senaste.formular ? `<p class="under-text">Formuläret ${esc(senaste.formular.namn)}, version ${senaste.formular.version}. Texten är skriven av systemet ur svaren.</p>${formular.lasBild(senaste.formular)}` : ''}
      ${sokordHtml(senaste.sokord)}
      ${kontrasignering.html(a, senaste)}
      ${word}
      ${kanRatta || kanAterbesok || kanSkrivaUt ? `<div class="knapprad" data-skriv>${kanRatta ? `<button type="button" class="knapp sekundar" data-ratta>${ikon.penna}<span>Rätta anteckningen</span></button>` : ''}${kanAterbesok ? `<button type="button" class="knapp sekundar" data-aterbesok>${ikon.kalender}<span>Återbesök</span></button>` : ''}${kanSkrivaUt ? `<button type="button" class="knapp sekundar" data-skriv-ut-anteckning>${ikon.logg}<span>Skriv ut anteckningen</span></button>` : ''}</div>` : ''}
      ${aldre.length ? `<section class="versioner" aria-labelledby="ver-rubrik"><h3 id="ver-rubrik">Tidigare versioner</h3>
        <p class="dampad liten">En signerad anteckning ändras aldrig. En rättelse blir en ny version, och den tidigare står kvar överstruken men läsbar.</p>
        ${aldre.map(v => `<div class="version-gammal">
          <p class="version-meta"><strong>Version ${v.version}</strong>, signerad ${esc(tidpunkt(v.signerad?.tid))} av ${esc(v.signerad?.av?.namn ?? '')}. Ersatt av version ${v.version + 1}.</p>
          <div class="overstruken"><span class="sr">Ersatt text: </span>${sokordHtml(v.sokord, true)}</div>
        </div>`).join('')}</section>` : ''}
    </article>`;
  las.querySelector('[data-ratta]')?.addEventListener('click', () => rattaForm(las, ctx, senaste));
  las.querySelector('[data-aterbesok]')?.addEventListener('click', () => satUppAterbesok(ctx.id, ctx.patient?.namn ?? 'patienten', senaste.id).catch(felNotis));
  las.querySelector('[data-skriv-ut-anteckning]')?.addEventListener('click', () => utskrift.skrivUt(ctx.id, { poster: [{ typ: 'anteckning', id: senaste.id }] }));
  kontrasignering.koppla(las, a, () => ctx.ladda());
}


function anteckningHuvud(a, id, extra = '') {
  return `<header class="ant-huvud">
    <h2 id="${id}" tabindex="-1">${esc(a.typ)}</h2>
    <p class="ant-meta">${esc(a.enhet.namn)}</p>
    <dl class="ant-fakta">
      <div><dt>Skriven av</dt><dd>${esc(a.forfattare?.namn ?? '')}, ${esc(a.forfattare?.titel ?? '')}</dd></div>
      <div><dt>Skapad</dt><dd>${esc(tidpunkt(a.skapad))}</dd></div>
      <div><dt>Status</dt><dd>${a.signerad ? `Signerad ${esc(tidpunkt(a.signerad.tid))} av ${esc(a.signerad.av?.namn ?? '')}` : '<span class="tagg tagg-utkast">Utkast, inte signerat</span>'}</dd></div>
      ${a.version > 1 ? `<div><dt>Rättelse</dt><dd>Version ${a.version}. Orsak: ${esc(a.rattelseOrsak ?? '')}</dd></div>` : ''}
    </dl>
    ${migreradEtikett(a)}${extra}
  </header>`;
}

// Runda 10, r3: ett sökord med dikterad text märks.
const sokordHtml = (sokord, gammal = false) => `<dl class="sokord">${sokord.filter(s => s.text).map(s => `<div><dt>${esc(s.sokord)}${s.inmatning === 'rost' ? ' <span class="tagg">Dikterad</span>' : ''}</dt><dd>${gammal ? `<del>${esc(s.text)}</del>` : esc(s.text)}</dd></div>`).join('')}</dl>`;

// Runda 10, r3: fälten har stavningskontroll på svenska, och rösten markerar de fält den har skrivit i.
function sokordFalt(sokordLista, varden = {}, rost = new Set()) {
  return sokordLista.map((s, i) => `<div class="falt"><label for="so-${i}">${esc(s)}</label><textarea id="so-${i}" name="so-${i}" data-sokord="${esc(s)}" rows="${i < 2 ? 3 : 2}" spellcheck="true" lang="sv"${rost.has(s) ? ' data-inmatning="rost"' : ''}>${esc(varden[s] ?? '')}</textarea></div>`).join('');
}
const lasSokord = (form) => [...form.querySelectorAll('[data-sokord]')].map(t => ({ sokord: t.dataset.sokord, text: t.value.trim(), ...(t.dataset.inmatning === 'rost' ? { inmatning: 'rost' } : {}) })).filter(s => s.text);
// Runda 10, r3: knappen Diktera och rutan som visar vems journal dikteringen gäller.
const diktatHtml = () => `<div class="diktat"><button type="button" class="knapp liten sekundar" data-diktera aria-pressed="false">${ikon.penna}<span>Diktera</span></button><div data-diktat hidden></div></div>`;
const kopplaSokord = (form, ctx) => {
  stavning.koppla(form);
  diktat.koppla(form, { patient: { id: ctx.id, namn: ctx.patient?.namn ?? 'patienten', personnummer: ctx.patient?.personnummer ?? null } });
};

// Vilken vårdkontakt anteckningen hamnar på. Systemet väljer den; användaren väljer aldrig i en lista.
async function aktuellKontakt(ctx) {
  try { return await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardkontakt/aktuell`); } catch { return null; }
}

// Runda 8, r5: innehållet i formuläret för en mall. En strukturerad mall (tobaksvanor) har fasta svarsalternativ i
// stället för sökord.
const innehall = (m, varden = {}) => (m.strukturerad ? strukturerad(m.typ).modul.falt(varden) : `<fieldset class="sokordsfalt"><legend>Sökord</legend>${diktatHtml()}<div id="ny-sokord">${sokordFalt(m.sokord, varden)}</div></fieldset>`);
const fokusForsta = (form) => {
  const tom = [...form.querySelectorAll('#ny-sokord textarea')].find(t => !t.value.trim());
  (tom ?? form.querySelector('#ny-sokord textarea') ?? form.querySelector('h2'))?.focus();
};

// Runda 8, r5: epikrisen med det som systemet kan skriva ur vårdtillfället, diagnoserna och läkemedlen.
async function nyEpikris(las, ctx, egnaMallar) {
  let f = null;
  try { f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/epikris/forslag`); } catch { /* utan förslag */ }
  if (!ctx.aktuell()) return;
  return nyForm(las, ctx, egnaMallar, { typ: 'Epikris', varden: f?.sokord ?? {}, info: f?.text ?? null });
}

async function nyForm(las, ctx, egnaMallar, { typ = null, varden = {}, info = null } = {}) {
  // Runda 13, r4: systemet förväljer mallen efter patientens läge och vårdenheten, till exempel akutanteckning på akuten.
  if (!typ) typ = (ctx.patient?.anteckningsmallar ?? []).find(t => egnaMallar.some(m => m.typ === t)) ?? 'Daganteckning';
  if (!egnaMallar.length) { las.innerHTML = '<p class="tom">Din yrkesroll kan inte skriva anteckningar.</p>'; return; }
  const forval = egnaMallar.find(m => m.typ === typ) ?? egnaMallar.find(m => m.typ === 'Daganteckning') ?? egnaMallar[0];
  const dok = await aktuellKontakt(ctx);
  const kontakt = { val: null };
  las.innerHTML = `<form class="ant-form" id="ant-form" novalidate aria-labelledby="ny-rubrik">
    <h2 id="ny-rubrik" tabindex="-1">Ny anteckning</h2>
    <div id="ny-kontakt">${dokumenterasHtml(dok)}</div>
    <div class="falt-rad">
      <div class="falt"><label for="ny-mall">Mall</label><select id="ny-mall" name="typ">${egnaMallar.map(m => `<option${m === forval ? ' selected' : ''}>${esc(m.typ)}</option>`).join('')}</select></div>
    </div>
    ${info ? `<p class="ruta ruta-info liten" data-forslag-info>${esc(info)}</p>` : ''}
    <div id="ny-innehall">${innehall(forval, varden)}</div>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-spara>Spara utkast</button><button type="button" class="knapp" data-signera>Signera</button><a class="knapp text" href="${ctx.href('journal')}">Avbryt</a></div>
    <p class="hjalp">Ett utkast syns bara för dig. När du signerar kan anteckningen inte längre ändras, bara rättas.</p>
  </form>`;
  const form = las.querySelector('form');
  const ritaKontakt = () => { const k = form.querySelector('#ny-kontakt'); k.innerHTML = dokumenterasHtml(dok, kontakt.val); kopplaDokumenteras(k, dok, kontakt, ritaKontakt); };
  if (dok) kopplaDokumenteras(form.querySelector('#ny-kontakt'), dok, kontakt, ritaKontakt);
  const mall = () => egnaMallar.find(x => x.typ === form.typ.value);
  const kopplaMall = () => {
    if (mall().strukturerad) strukturerad(mall().typ).modul.koppla(form, { alder: ctx.patient?.alder ?? null, patientId: ctx.id });
    else kopplaSokord(form, ctx);
  };
  form.typ.addEventListener('change', () => {
    form.querySelector('#ny-innehall').innerHTML = innehall(mall());
    kopplaMall();
  });
  kopplaMall();
  const spara = async (knapp, signera) => {
    // Runda 8, r5: en strukturerad mall skickar svaren, och systemet skriver texten.
    const arStrukturerad = mall().strukturerad;
    const sokord = arStrukturerad ? null : lasSokord(form);
    if (!arStrukturerad && !sokord.length) { faltFel(form, { message: 'Skriv något under minst ett sökord.', data: {} }); form.querySelector('textarea')?.focus(); return; }
    try {
      const ny = await medKnapp(knapp, async () => {
        const innehallet = arStrukturerad ? { [strukturerad(mall().typ).nyckel]: strukturerad(mall().typ).modul.las(form) } : { sokord };
        const x = await api(`/api/patient/${encodeURIComponent(ctx.id)}/anteckningar`, { metod: 'POST', data: { typ: form.typ.value, ...innehallet, ...nyKontaktData(kontakt) } });
        if (signera) await api(`/api/anteckning/${x.id}/signera`, { metod: 'POST', data: {} });
        return x;
      }, form);
      notis(signera ? 'Anteckningen är signerad.' : 'Utkastet är sparat. Det syns bara för dig tills du signerar.');
      kontaktNotis(ny);
      await uppdateraInkorg();
      location.hash = ctx.href('journal', ny.id);
    } catch { /* felet visas i formuläret */ }
  };
  form.querySelector('[data-spara]').addEventListener('click', e => spara(e.currentTarget, false));
  form.querySelector('[data-signera]').addEventListener('click', e => spara(e.currentTarget, true));
  // Fokus i första tomma sökordet, så att det går att börja skriva direkt. Formuläret har rubriken som namn.
  fokusForsta(form);
}

async function utkastForm(las, ctx, a) {
  const mall = mallar.find(m => m.typ === a.typ);
  // Runda 8, r5: ett utkast i en strukturerad mall ändras med svaren. Runda 10, r3: också ett formulär.
  if (mall?.strukturerad || a.formular) return strukturForm(las, ctx, a, 'utkast');
  const varden = Object.fromEntries(a.sokord.map(s => [s.sokord, s.text]));
  const lista = [...new Set([...(mall?.sokord ?? []), ...a.sokord.map(s => s.sokord)])];
  const rost = new Set(a.sokord.filter(s => s.inmatning === 'rost').map(s => s.sokord));
  las.innerHTML = `<form class="ant-form" novalidate aria-labelledby="utk-rubrik">
    <h2 id="utk-rubrik" tabindex="-1">${esc(a.typ)}, utkast</h2>
    <p class="ant-meta">Skapat ${esc(tidpunkt(a.skapad))}${a.andrad ? `, senast ändrat ${esc(tidpunkt(a.andrad))}` : ''}. Bara du ser utkastet. Det hör till den vårdkontakt som systemet knöt det till när det sparades.</p>
    <fieldset class="sokordsfalt"><legend>Sökord</legend>${diktatHtml()}${sokordFalt(lista, varden, rost)}</fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-spara>Spara utkast</button><button type="button" class="knapp" data-signera>Signera</button></div>
  </form>`;
  const form = las.querySelector('form');
  kopplaSokord(form, ctx);
  const spara = async (knapp, signera) => {
    const sokord = lasSokord(form);
    if (!sokord.length) { faltFel(form, { message: 'Skriv något under minst ett sökord.', data: {} }); return; }
    try {
      await medKnapp(knapp, async () => {
        await api(`/api/anteckning/${a.id}`, { metod: 'PUT', data: { sokord } });
        if (signera) await api(`/api/anteckning/${a.id}/signera`, { metod: 'POST', data: {} });
      }, form);
      notis(signera ? 'Anteckningen är signerad.' : 'Utkastet är sparat.');
      await uppdateraInkorg();
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  };
  form.querySelector('[data-spara]').addEventListener('click', e => spara(e.currentTarget, false));
  form.querySelector('[data-signera]').addEventListener('click', e => spara(e.currentTarget, true));
}

function rattaForm(las, ctx, a) {
  const mall = mallar.find(m => m.typ === a.typ);
  if (mall?.strukturerad || a.formular) return strukturForm(las, ctx, a, 'ratta');
  const varden = Object.fromEntries(a.sokord.map(s => [s.sokord, s.text]));
  const lista = [...new Set([...(mall?.sokord ?? []), ...a.sokord.map(s => s.sokord)])];
  las.innerHTML = `<form class="ant-form" novalidate aria-labelledby="ratt-rubrik">
    <h2 id="ratt-rubrik" tabindex="-1">Rätta ${esc(a.typ.toLowerCase())}</h2>
    <p class="ant-meta">Version ${a.version}, signerad ${esc(tidpunkt(a.signerad?.tid))} av ${esc(a.signerad?.av?.namn ?? '')}. Rättelsen blir version ${a.version + 1} och signeras direkt. Den nuvarande versionen står kvar överstruken.</p>
    <div class="falt"><label for="ratt-orsak">Orsak till rättelsen <span class="obl">(obligatoriskt)</span></label><input id="ratt-orsak" name="orsak" required minlength="3" maxlength="300" autocomplete="off"></div>
    <fieldset class="sokordsfalt"><legend>Sökord</legend>${diktatHtml()}${sokordFalt(lista, varden, new Set(a.sokord.filter(s => s.inmatning === 'rost').map(s => s.sokord)))}</fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-spara>Signera rättelsen</button><button type="button" class="knapp text" data-avbryt>Avbryt</button></div>
  </form>`;
  const form = las.querySelector('form');
  kopplaSokord(form, ctx);
  form.querySelector('h2').focus();
  form.querySelector('[data-avbryt]').addEventListener('click', () => ctx.ladda());
  form.querySelector('[data-spara]').addEventListener('click', async (e) => {
    if (form.orsak.value.trim().length < 3) { faltFel(form, { message: 'Ange orsaken till rättelsen.', data: { falt: ['orsak'] } }); return; }
    const sokord = lasSokord(form);
    try {
      const ny = await medKnapp(e.currentTarget, () => api(`/api/anteckning/${a.id}/ratta`, { metod: 'POST', data: { orsak: form.orsak.value.trim(), sokord } }), form);
      notis('Rättelsen är signerad. Den tidigare versionen finns kvar, överstruken.');
      location.hash = ctx.href('journal', ny.id);
    } catch { /* felet visas i formuläret */ }
  });
}

// Runda 8, r5: ett utkast eller en rättelse i mallen för tobaksvanor. Svaren fylls i från anteckningen.
function strukturForm(las, ctx, a, lage) {
  const ratta = lage === 'ratta';
  const { modul, nyckel } = strukturerad(a.typ, a);
  const svar = a[nyckel]?.svar ?? {};
  las.innerHTML = `<form class="ant-form" novalidate aria-labelledby="st-rubrik">
    <h2 id="st-rubrik" tabindex="-1">${ratta ? `Rätta ${esc(a.typ.toLowerCase())}` : `${esc(a.typ)}, utkast`}</h2>
    <p class="ant-meta">${ratta ? `Version ${a.version}, signerad ${esc(tidpunkt(a.signerad?.tid))} av ${esc(a.signerad?.av?.namn ?? '')}. Rättelsen blir version ${a.version + 1} och signeras direkt. Den nuvarande versionen står kvar överstruken.` : `Skapat ${esc(tidpunkt(a.skapad))}. Bara du ser utkastet.`}</p>
    ${ratta ? '<div class="falt"><label for="ratt-orsak">Orsak till rättelsen <span class="obl">(obligatoriskt)</span></label><input id="ratt-orsak" name="orsak" required minlength="3" maxlength="300" autocomplete="off"></div>' : ''}
    ${modul.falt(svar)}
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad">${ratta ? '<button type="button" class="knapp" data-spara>Signera rättelsen</button><button type="button" class="knapp text" data-avbryt>Avbryt</button>' : '<button type="button" class="knapp sekundar" data-spara>Spara utkast</button><button type="button" class="knapp" data-signera>Signera</button>'}</div>
  </form>`;
  const form = las.querySelector('form');
  modul.koppla(form, { alder: ctx.patient?.alder ?? null, svar, patientId: ctx.id });
  form.querySelector('h2').focus();
  form.querySelector('[data-avbryt]')?.addEventListener('click', () => ctx.ladda());
  const spara = async (knapp, signera) => {
    if (ratta && form.orsak.value.trim().length < 3) { faltFel(form, { message: 'Ange orsaken till rättelsen.', data: { falt: ['orsak'] } }); return; }
    try {
      const ny = await medKnapp(knapp, async () => {
        if (ratta) return api(`/api/anteckning/${a.id}/ratta`, { metod: 'POST', data: { orsak: form.orsak.value.trim(), [nyckel]: modul.las(form) } });
        await api(`/api/anteckning/${a.id}`, { metod: 'PUT', data: { [nyckel]: modul.las(form) } });
        if (signera) await api(`/api/anteckning/${a.id}/signera`, { metod: 'POST', data: {} });
        return null;
      }, form);
      notis(ratta ? 'Rättelsen är signerad. Den tidigare versionen finns kvar, överstruken.' : signera ? 'Anteckningen är signerad.' : 'Utkastet är sparat.');
      await uppdateraInkorg();
      if (ny) location.hash = ctx.href('journal', ny.id); else ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  };
  form.querySelector('[data-spara]').addEventListener('click', e => spara(e.currentTarget, false));
  form.querySelector('[data-signera]')?.addEventListener('click', e => spara(e.currentTarget, true));
}
