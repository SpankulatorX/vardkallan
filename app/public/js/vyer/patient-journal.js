// Journalen: anteckningar per enhet och typ, läsning med versioner, ny anteckning från mall, utkast, signering och rättelse.
import { esc, api, tidpunkt, datum, migreradEtikett, notis, faltFel, medKnapp, ikon, ApiFel } from '../ui.js';
import { far, S, minVardenhet, uppdateraInkorg, vardenhetAv as enhetsVardenhet } from '../app.js';
import { doldaRad, kravRuta } from './patient.js';
import { dokumenterasHtml, kopplaDokumenteras, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
import * as kontrasignering from '../kontrasignering.js';

let mallar = null;
const filter = { enhet: '', typ: '' };

const kanSkriva = (kategori) => far(kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal');

export async function visa(el, ctx) {
  const [lista] = await Promise.all([
    api(`/api/patient/${encodeURIComponent(ctx.id)}/anteckningar`),
    mallar ? Promise.resolve() : api('/api/mallar').then(m => { mallar = m; }),
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
  el.innerHTML = `<h2 class="sr">Journal</h2>${urKopia}${doldaRad(lista.dolda)}
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
  las.innerHTML = `<article class="anteckning" aria-labelledby="ant-rubrik">
      ${anteckningHuvud(senaste, 'ant-rubrik', a.id !== senaste.id ? `<p class="ruta ruta-info liten">Du öppnade version ${a.version}. Här visas den gällande versionen ${senaste.version}.</p>` : '')}
      ${sokordHtml(senaste.sokord)}
      ${kontrasignering.html(a, senaste)}
      ${kanRatta ? `<div class="knapprad"><button type="button" class="knapp sekundar" data-ratta>${ikon.penna}<span>Rätta anteckningen</span></button></div>` : ''}
      ${aldre.length ? `<section class="versioner" aria-labelledby="ver-rubrik"><h3 id="ver-rubrik">Tidigare versioner</h3>
        <p class="dampad liten">En signerad anteckning ändras aldrig. En rättelse blir en ny version, och den tidigare står kvar överstruken men läsbar.</p>
        ${aldre.map(v => `<div class="version-gammal">
          <p class="version-meta"><strong>Version ${v.version}</strong>, signerad ${esc(tidpunkt(v.signerad?.tid))} av ${esc(v.signerad?.av?.namn ?? '')}. Ersatt av version ${v.version + 1}.</p>
          <div class="overstruken"><span class="sr">Ersatt text: </span>${sokordHtml(v.sokord, true)}</div>
        </div>`).join('')}</section>` : ''}
    </article>`;
  las.querySelector('[data-ratta]')?.addEventListener('click', () => rattaForm(las, ctx, senaste));
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

const sokordHtml = (sokord, gammal = false) => `<dl class="sokord">${sokord.filter(s => s.text).map(s => `<div><dt>${esc(s.sokord)}</dt><dd>${gammal ? `<del>${esc(s.text)}</del>` : esc(s.text)}</dd></div>`).join('')}</dl>`;

function sokordFalt(sokordLista, varden = {}) {
  return sokordLista.map((s, i) => `<div class="falt"><label for="so-${i}">${esc(s)}</label><textarea id="so-${i}" name="so-${i}" data-sokord="${esc(s)}" rows="${i < 2 ? 3 : 2}">${esc(varden[s] ?? '')}</textarea></div>`).join('');
}
const lasSokord = (form) => [...form.querySelectorAll('[data-sokord]')].map(t => ({ sokord: t.dataset.sokord, text: t.value.trim() })).filter(s => s.text);

// Vilken vårdkontakt anteckningen hamnar på. Systemet väljer den; användaren väljer aldrig i en lista.
async function aktuellKontakt(ctx) {
  try { return await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardkontakt/aktuell`); } catch { return null; }
}

async function nyForm(las, ctx, egnaMallar) {
  if (!egnaMallar.length) { las.innerHTML = '<p class="tom">Din yrkesroll kan inte skriva anteckningar.</p>'; return; }
  const forval = egnaMallar.find(m => m.typ === 'Daganteckning') ?? egnaMallar[0];
  const dok = await aktuellKontakt(ctx);
  const kontakt = { val: null };
  las.innerHTML = `<form class="ant-form" id="ant-form" novalidate aria-labelledby="ny-rubrik">
    <h2 id="ny-rubrik" tabindex="-1">Ny anteckning</h2>
    <div id="ny-kontakt">${dokumenterasHtml(dok)}</div>
    <div class="falt-rad">
      <div class="falt"><label for="ny-mall">Mall</label><select id="ny-mall" name="typ">${egnaMallar.map(m => `<option${m === forval ? ' selected' : ''}>${esc(m.typ)}</option>`).join('')}</select></div>
    </div>
    <fieldset class="sokordsfalt"><legend>Sökord</legend><div id="ny-sokord">${sokordFalt(forval.sokord)}</div></fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-spara>Spara utkast</button><button type="button" class="knapp" data-signera>Signera</button><a class="knapp text" href="${ctx.href('journal')}">Avbryt</a></div>
    <p class="hjalp">Ett utkast syns bara för dig. När du signerar kan anteckningen inte längre ändras, bara rättas.</p>
  </form>`;
  const form = las.querySelector('form');
  const ritaKontakt = () => { const k = form.querySelector('#ny-kontakt'); k.innerHTML = dokumenterasHtml(dok, kontakt.val); kopplaDokumenteras(k, dok, kontakt, ritaKontakt); };
  if (dok) kopplaDokumenteras(form.querySelector('#ny-kontakt'), dok, kontakt, ritaKontakt);
  form.typ.addEventListener('change', () => {
    const m = egnaMallar.find(x => x.typ === form.typ.value);
    form.querySelector('#ny-sokord').innerHTML = sokordFalt(m.sokord);
  });
  const spara = async (knapp, signera) => {
    const sokord = lasSokord(form);
    if (!sokord.length) { faltFel(form, { message: 'Skriv något under minst ett sökord.', data: {} }); form.querySelector('textarea')?.focus(); return; }
    try {
      const ny = await medKnapp(knapp, async () => {
        const x = await api(`/api/patient/${encodeURIComponent(ctx.id)}/anteckningar`, { metod: 'POST', data: { typ: form.typ.value, sokord, ...nyKontaktData(kontakt) } });
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
  // Fokus i första sökordet, så att det går att börja skriva direkt. Formuläret har rubriken som namn.
  form.querySelector('#ny-sokord textarea')?.focus();
}

async function utkastForm(las, ctx, a) {
  const mall = mallar.find(m => m.typ === a.typ);
  const varden = Object.fromEntries(a.sokord.map(s => [s.sokord, s.text]));
  const lista = [...new Set([...(mall?.sokord ?? []), ...a.sokord.map(s => s.sokord)])];
  las.innerHTML = `<form class="ant-form" novalidate aria-labelledby="utk-rubrik">
    <h2 id="utk-rubrik" tabindex="-1">${esc(a.typ)}, utkast</h2>
    <p class="ant-meta">Skapat ${esc(tidpunkt(a.skapad))}${a.andrad ? `, senast ändrat ${esc(tidpunkt(a.andrad))}` : ''}. Bara du ser utkastet. Det hör till den vårdkontakt som systemet knöt det till när det sparades.</p>
    <fieldset class="sokordsfalt"><legend>Sökord</legend>${sokordFalt(lista, varden)}</fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-spara>Spara utkast</button><button type="button" class="knapp" data-signera>Signera</button></div>
  </form>`;
  const form = las.querySelector('form');
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
  const varden = Object.fromEntries(a.sokord.map(s => [s.sokord, s.text]));
  const lista = [...new Set([...(mall?.sokord ?? []), ...a.sokord.map(s => s.sokord)])];
  las.innerHTML = `<form class="ant-form" novalidate aria-labelledby="ratt-rubrik">
    <h2 id="ratt-rubrik" tabindex="-1">Rätta ${esc(a.typ.toLowerCase())}</h2>
    <p class="ant-meta">Version ${a.version}, signerad ${esc(tidpunkt(a.signerad?.tid))} av ${esc(a.signerad?.av?.namn ?? '')}. Rättelsen blir version ${a.version + 1} och signeras direkt. Den nuvarande versionen står kvar överstruken.</p>
    <div class="falt"><label for="ratt-orsak">Orsak till rättelsen <span class="obl">(obligatoriskt)</span></label><input id="ratt-orsak" name="orsak" required minlength="3" maxlength="300" autocomplete="off"></div>
    <fieldset class="sokordsfalt"><legend>Sökord</legend>${sokordFalt(lista, varden)}</fieldset>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-spara>Signera rättelsen</button><button type="button" class="knapp text" data-avbryt>Avbryt</button></div>
  </form>`;
  const form = las.querySelector('form');
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
