// Uppmärksamhetsinformation (Sussa 3.1.5): symbolen, raden i patienthuvudet och förslagen att bekräfta.
//
// Symbolen följer principen i Socialstyrelsens informationsspecifikation: en stjärna där varje huvudgrupp har sin del.
// Armen uppe till höger är medicinska tillstånd och behandlingar, armen nere till vänster smitta, armen nere till höger
// särskild vårdrutin, och stapeln i mitten överkänslighet, fylld efter graden (hel för livshotande, halv för skadlig och
// bara punkten för besvärande). Färgen är aldrig enda bäraren: symbolen har alltid en textbeskrivning.
import { esc, api, dialog, notis, ikon, medKnapp, avbrott, datum, tidpunkt, migreradEtikett } from './ui.js';

const GRAD = { livshotande: 'livshotande', skadlig: 'skadlig', besvarande: 'besvärande' };
const KORT = { medicinskt: 'Medicinskt tillstånd eller behandling', smitta: 'Smitta', vardrutin: 'Särskild vårdrutin' };

// Text som beskriver symbolen, för skärmläsare och som verktygstips.
export function symbolText(s) {
  if (!s) return '';
  const d = [];
  if (s.overkanslighet) d.push(`Överkänslighet, ${GRAD[s.overkanslighet]}`);
  for (const k of ['medicinskt', 'smitta', 'vardrutin']) if (s[k]) d.push(KORT[k]);
  return d.length ? `Uppmärksamhetsinformation: ${d.join(', ')}` : 'Ingen uppmärksamhetsinformation';
}
export const harNagot = (s) => Boolean(s && (s.overkanslighet || s.medicinskt || s.smitta || s.vardrutin));

// Symbolen som SVG. Armarna ritas som halva staplar som vrids runt mitten: först konturen, sedan fyllningen ovanpå,
// så att bara stjärnans ytterkant syns.
export function symbolSvg(s, storlek = 22) {
  const arm = (vinkel, fyllning, klass) => `<rect x="15" y="1.5" width="10" height="19" rx="1.5" transform="rotate(${vinkel} 20 20)" class="${klass}" fill="${fyllning}"/>`;
  const gra = 'var(--um-gra)';
  const ok = s?.overkanslighet;
  const stapel = ok === 'livshotande' ? 'M18 5h4v17h-4z' : ok === 'skadlig' ? 'M18 14h4v8h-4z' : '';
  return `<svg class="um-symbol${harNagot(s) ? '' : ' um-tom'}" width="${storlek}" height="${storlek}" viewBox="0 0 40 40" role="img" aria-label="${esc(symbolText(s))}" focusable="false">
    <title>${esc(symbolText(s))}</title>
    ${[0, 60, 120, 180, 240, 300].map(v => arm(v, gra, 'um-kontur')).join('')}
    ${[0, 180, 300].map(v => arm(v, gra, 'um-arm')).join('')}
    ${arm(60, s?.medicinskt ? 'var(--um-medicinskt)' : gra, 'um-arm um-medicinskt')}
    ${arm(120, s?.vardrutin ? 'var(--um-vardrutin)' : gra, 'um-arm um-vardrutin')}
    ${arm(240, s?.smitta ? 'var(--um-smitta)' : gra, 'um-arm um-smitta')}
    <rect x="17" y="4" width="6" height="19" rx="1" fill="var(--yta)" stroke="var(--um-kant)" stroke-width="0.8"/>
    ${stapel ? `<path d="${stapel}" fill="var(--um-overk)"/>` : ''}
    <circle cx="20" cy="29" r="2.6" fill="${ok ? 'var(--um-overk)' : 'var(--yta)'}" stroke="var(--um-kant)" stroke-width="0.8"/>
  </svg>`;
}

// Cell i arbetslistan och väntrummet: bara symbolen, och innehållet ett klick bort i journalen.
export function listCell(s, href) {
  if (!harNagot(s)) return '<span class="sr">Ingen uppmärksamhetsinformation</span>';
  return `<a class="um-lank" href="${href}" title="${esc(symbolText(s))}">${symbolSvg(s, 24)}<span class="sr">${esc(symbolText(s))}. Öppna journalen för innehållet.</span></a>`;
}

const kanSkriva = (u) => u?.kanAndra && !avbrott.aktivt && !avbrott.simulerat;
// Runda 10, r2: överkänslighet registreras, ändras och avslutas i ett eget flöde (Sussa 3.1.6.2).
const kanOk = (u) => u?.kanAndraOverkanslighet && !avbrott.aktivt && !avbrott.simulerat;
const okKnappar = (p, u) => (kanOk(u) && p.kategori === 'overkanslighet' && p.overkanslighetId
  ? ` <button type="button" class="knapp liten sekundar" data-ok-andra="${esc(p.overkanslighetId)}">Ändra</button><button type="button" class="knapp liten sekundar" data-ok-avsluta="${esc(p.overkanslighetId)}" data-ok-term="${esc(p.term)}">Avsluta</button>` : '');
const nyOkKnapp = (u) => (kanOk(u) ? ' <button type="button" class="knapp liten sekundar" data-ok-ny>Ny överkänslighet</button>' : '');

function postRad(p, u) {
  const grad = p.kategori === 'overkanslighet' ? ` <span class="tagg ${p.grad === 'livshotande' ? 'tagg-larm' : ''}">${esc(GRAD[p.grad] ?? '')}${p.bekraftad ? '' : ', föreslagen'}</span>` : '';
  const kod = p.kod ? ` <span class="kod">${esc(p.kod.system === 'atc' ? 'ATC' : 'ICD-10-SE')} ${esc(p.kod.kod)}</span>` : '';
  const vem = p.registrerad?.av ? `av ${esc(p.registrerad.av)}, ${esc(p.registrerad.vardenhet?.namn ?? '')}` : `på ${esc(p.registrerad?.vardenhet?.namn ?? '')}`;
  const nar = p.registrerad?.tid?.length > 10 ? tidpunkt(p.registrerad.tid) : datum(p.registrerad?.tid);
  const gradAv = p.gradBekraftad?.av ? ` Graden bekräftad av ${esc(p.gradBekraftad.av)} ${esc(datum(p.gradBekraftad.tid))}.` : '';
  const avsluta = kanSkriva(u) && p.id && p.kategori !== 'overkanslighet' ? ` <button type="button" class="knapp liten sekundar" data-um-avsluta="${esc(p.id)}" data-um-term="${esc(p.term)}">Avsluta</button>` : '';
  return `<li><strong>${esc(p.term)}</strong>${grad}${kod}${avsluta}${okKnappar(p, u)}
    <span class="under-text">${esc(p.undergruppText ?? '')}. ${esc(p.motivering ?? '')}</span>
    <span class="under-text">Registrerad ${esc(nar)} ${vem}.${gradAv}</span>${migreradEtikett(p)}</li>`;
}

// Raden i patienthuvudet. Sammanfattningen syns direkt och innehållet ett klick bort.
export function bandSignal(h) {
  const u = h.uppmarksamhet;
  if (!u) return '';
  if (!u.poster.length) {
    return `<li class="signal signal-ingen signal-um">${symbolSvg(u.symbol, 18)}<span>Ingen uppmärksamhetsinformation</span>${kanSkriva(u) ? ' <button type="button" class="knapp-lank" data-um-lagg>Lägg till</button>' : ''}${nyOkKnapp(u)}</li>`;
  }
  const delar = [];
  const ok = u.poster.filter(p => p.kategori === 'overkanslighet');
  if (ok.length) delar.push(`Överkänslighet: ${ok.map(p => p.term).join(', ')}`);
  for (const k of ['medicinskt', 'smitta', 'vardrutin']) {
    const p = u.poster.filter(x => x.kategori === k);
    if (p.length) delar.push(`${p[0].kategoriText}: ${p.map(x => x.term).join(', ')}`);
  }
  const grupper = ['overkanslighet', 'medicinskt', 'smitta', 'vardrutin'].map(k => {
    const p = u.poster.filter(x => x.kategori === k);
    return p.length ? `<li class="um-grupp um-grupp-${k}"><h3>${esc(p[0].kategoriText)}</h3><ul>${p.map(x => postRad(x, u)).join('')}</ul></li>` : '';
  }).join('');
  return `<li class="signal signal-um${u.symbol.overkanslighet ? ' signal-overk' : ''}"><details>
    <summary>${symbolSvg(u.symbol, 24)}<span>${esc(delar.join('. '))}</span></summary>
    <div class="um-panel">
      <ul class="um-grupper">${grupper}</ul>
      <p class="under-text">Strukturerad efter huvudgrupperna i Socialstyrelsens informationsspecifikation för uppmärksamhetsinformation.</p>
      ${kanSkriva(u) ? '<button type="button" class="knapp liten sekundar" data-um-lagg>Lägg till uppmärksamhetsinformation</button>' : ''}${nyOkKnapp(u)}
    </div>
  </details></li>`;
}

// Förslagen visas under patienthuvudet, så att läkaren bekräftar med ett klick utan att leta.
export function forslagRader(h) {
  const u = h.uppmarksamhet;
  if (!kanSkriva(u) || !u.forslag.length) return '';
  return u.forslag.map(f => {
    if (f.typ === 'avsluta') {
      return `<div class="behorighet um-forslag" data-um-forslag="${esc(f.nyckel)}">${ikon.info}<p><strong>${esc(f.term)}</strong> kan avslutas. ${esc(f.varfor)} <span class="dampad">Förslag från systemet (demoregel).</span></p>
        <button type="button" class="knapp liten sekundar" data-um-avsluta="${esc(f.postId)}" data-um-orsak="${esc(f.orsak)}">Avsluta uppgiften</button></div>`;
    }
    const knappar = f.kategori === 'overkanslighet'
      ? ['livshotande', 'skadlig', 'besvarande'].map(g => `<button type="button" class="knapp liten${g === f.grad ? '' : ' sekundar'}" data-um-bekrafta="${esc(f.nyckel)}" data-um-grad="${g}">${g === f.grad ? 'Bekräfta: ' : ''}${esc(GRAD[g])}</button>`).join('')
      : `<button type="button" class="knapp liten" data-um-bekrafta="${esc(f.nyckel)}">Bekräfta</button><button type="button" class="knapp liten sekundar" data-um-avfarda="${esc(f.nyckel)}">Inte aktuellt</button>`;
    const vad = f.kategori === 'overkanslighet' ? `Graden för överkänsligheten mot <strong>${esc(f.term)}</strong>` : `<strong>${esc(f.term)}</strong> (${esc(f.kategoriText)}, ${esc(String(f.undergruppText ?? '').toLowerCase())})`;
    return `<div class="behorighet um-forslag" data-um-forslag="${esc(f.nyckel)}">${symbolSvg({ [f.kategori]: f.kategori === 'overkanslighet' ? f.grad : true }, 20)}<p>Föreslagen uppmärksamhetsinformation: ${vad}. ${esc(f.varfor)} <span class="dampad">Förslag från systemet (demoregel).</span></p>
      <span class="knapprad">${knappar}</span></div>`;
  }).join('');
}

async function laggTill(pid) {
  const { termer } = await api('/api/uppmarksamhet/termer');
  const grupper = [...new Set(termer.map(t => t.kategoriText))];
  const svar = await dialog(`<h2 id="dlg-rubrik">Lägg till uppmärksamhetsinformation</h2>
    <p>Överkänslighet, läkemedelsbehandling, smitta och implantat hämtar systemet själv ur journalen och föreslår. Här finns det som systemet inte kan räkna ut. Välj i listan.</p>
    <form>${grupper.map(g => `<fieldset class="um-val"><legend>${esc(g)}</legend>${termer.filter(t => t.kategoriText === g).map(t => `<label><input type="radio" name="term" value="${esc(t.id)}" required> ${esc(t.term)}<span class="under-text">${esc(t.motivering)}</span></label>`).join('')}</fieldset>`).join('')}
    <p class="dialog-fel" role="alert" hidden></p></form>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
  if (!svar) return false;
  await api(`/api/patient/${encodeURIComponent(pid)}/uppmarksamhet`, { metod: 'POST', data: { term: svar.data.term } });
  notis('Uppmärksamhetsinformationen är registrerad.');
  return true;
}

async function avslutaPost(id, term, orsak) {
  let o = orsak;
  if (!o) {
    const svar = await dialog(`<h2 id="dlg-rubrik">Avsluta ${esc(term)}</h2><p>Uppgiften finns kvar i journalen och visar vem som avslutade den och varför.</p>
      <form><div class="falt"><label for="um-orsak">Varför avslutas uppgiften? <span class="obl">(obligatoriskt)</span></label><textarea id="um-orsak" name="orsak" rows="2" required minlength="3"></textarea></div><p class="dialog-fel" role="alert" hidden></p></form>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
    if (!svar) return false;
    o = svar.data.orsak;
  }
  await api(`/api/uppmarksamhet/${encodeURIComponent(id)}/avsluta`, { metod: 'POST', data: { orsak: o } });
  notis('Uppgiften är avslutad.');
  return true;
}

// Klick på förslag, Lägg till och Avsluta i patientvyn. efter() ritar om patienthuvudet.
export function koppla(rot, pid, efter) {
  rot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-um-bekrafta], [data-um-avfarda], [data-um-lagg], [data-um-avsluta], [data-ok-ny], [data-ok-andra], [data-ok-avsluta]');
    if (!b) return;
    e.preventDefault();
    let klar = false;
    try {
      await medKnapp(b, async () => {
        if (b.dataset.umBekrafta) {
          const data = { forslag: b.dataset.umBekrafta, ...(b.dataset.umGrad ? { grad: b.dataset.umGrad } : {}) };
          await api(`/api/patient/${encodeURIComponent(pid)}/uppmarksamhet`, { metod: 'POST', data });
          notis('Uppmärksamhetsinformationen är bekräftad.');
          klar = true;
        } else if (b.dataset.umAvfarda) {
          await api(`/api/patient/${encodeURIComponent(pid)}/uppmarksamhet/avfard`, { metod: 'POST', data: { forslag: b.dataset.umAvfarda } });
          notis('Förslaget är avfärdat och visas inte igen.');
          klar = true;
        } else if ('umLagg' in b.dataset) klar = await laggTill(pid);
        else if ('okNy' in b.dataset) klar = await nyOverkanslighet(pid);
        else if (b.dataset.okAndra) klar = await andraOverkanslighet(pid, Number(b.dataset.okAndra));
        else if (b.dataset.okAvsluta) klar = await avslutaOverkanslighet(b.dataset.okAvsluta, b.dataset.okTerm ?? '');
        else klar = await avslutaPost(b.dataset.umAvsluta, b.dataset.umTerm ?? '', b.dataset.umOrsak ?? '');
      });
    } catch { return; }
    if (klar) await efter();
  });
}

// Runda 10, r2: överkänslighetens eget flöde. Systemet slår upp ATC-koden ur ämnet och föreslår allvarlighetsgraden ur
// reaktionen medan användaren skriver, och förklarar förslaget. Användaren behöver inte kunna koderna.
const ALLV = [['allvarlig', 'Allvarlig'], ['mattlig', 'Måttlig'], ['lindrig', 'Lindrig']];
const allvFalt = (vald) => `<fieldset class="radiogrupp"><legend>Allvarlighet</legend>${ALLV.map(([k, t]) => `<div class="radio"><input type="radio" id="ok-allv-${k}" name="allvarlighet" value="${k}"${k === vald ? ' checked' : ''}><label for="ok-allv-${k}">${t}</label></div>`).join('')}</fieldset>`;
function kopplaForslag(dl) {
  const form = dl.querySelector('form');
  const ruta = dl.querySelector('[data-ok-forslag]');
  let nr = 0;
  const uppdatera = async () => {
    const amne = form.amne?.value.trim() ?? '';
    if (amne.length < 2) { ruta.textContent = ''; return; }
    const mitt = ++nr;
    try {
      const f = await api('/api/overkanslighet/forslag', { metod: 'POST', data: { amne, reaktion: form.reaktion.value.trim() } });
      if (mitt !== nr) return;
      ruta.textContent = f.varfor.join(' ');
      const r = form.querySelector(`[name="allvarlighet"][value="${f.allvarlighet}"]`);
      if (r && !form.dataset.allvVald) r.checked = true;
    } catch { ruta.textContent = ''; }
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'allvarlighet') form.dataset.allvVald = '1'; else uppdatera(); });
}

async function nyOverkanslighet(pid) {
  const { amnen } = await api('/api/overkanslighet/amnen');
  const svar = await dialog(`<h2 id="dlg-rubrik">Ny överkänslighet</h2>
    <form><div class="falt"><label for="ok-amne">Överkänslig mot <span class="obl">(obligatoriskt)</span></label><input id="ok-amne" name="amne" list="ok-amnen" required minlength="2" maxlength="120" autocomplete="off"><datalist id="ok-amnen">${amnen.map(a => `<option value="${esc(a.amne)}">`).join('')}</datalist></div>
      <div class="falt"><label for="ok-reaktion">Reaktion <span class="obl">(obligatoriskt)</span></label><input id="ok-reaktion" name="reaktion" required minlength="2" maxlength="300" autocomplete="off"></div>
      ${allvFalt('mattlig')}
      <p class="hjalp" data-ok-forslag aria-live="polite"></p>
      <p class="dialog-fel" role="alert" hidden></p></form>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, { onOpen: kopplaForslag });
  if (!svar) return false;
  const r = await api(`/api/patient/${encodeURIComponent(pid)}/overkanslighet`, { metod: 'POST', data: { amne: svar.data.amne, reaktion: svar.data.reaktion, allvarlighet: svar.data.allvarlighet } });
  notis(`Överkänslighet mot ${r.amne.toLowerCase()} är registrerad${r.atc ? ` med ATC-kod ${r.atc}` : ''}.`);
  return true;
}

async function andraOverkanslighet(pid, id) {
  const d = await api(`/api/patient/${encodeURIComponent(pid)}/overkanslighet`);
  const o = d.aktuella.find(x => x.id === id);
  if (!o) { notis('Överkänsligheten finns inte längre.'); return true; }
  const svar = await dialog(`<h2 id="dlg-rubrik">Ändra överkänslighet mot ${esc(o.amne.toLowerCase())}</h2>
    <p>Ändringen blir version ${esc(o.version + 1)}. Den tidigare versionen finns kvar i historiken med vem som ändrade och varför.</p>
    <form><input type="hidden" name="amne" value="${esc(o.amne)}">
      <div class="falt"><label for="ok-reaktion">Reaktion</label><input id="ok-reaktion" name="reaktion" required minlength="2" maxlength="300" value="${esc(o.reaktion ?? '')}" autocomplete="off"></div>
      ${allvFalt(o.allvarlighet)}
      <div class="falt"><label for="ok-orsak">Varför ändras uppgiften? <span class="obl">(obligatoriskt)</span></label><input id="ok-orsak" name="orsak" required minlength="3" maxlength="300" autocomplete="off"></div>
      <p class="hjalp" data-ok-forslag aria-live="polite"></p>
      <p class="dialog-fel" role="alert" hidden></p></form>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara ny version</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, { onOpen: kopplaForslag });
  if (!svar) return false;
  await api(`/api/overkanslighet/${encodeURIComponent(id)}/andra`, { metod: 'POST', data: { reaktion: svar.data.reaktion, allvarlighet: svar.data.allvarlighet, orsak: svar.data.orsak } });
  notis('Överkänsligheten är ändrad.');
  return true;
}

async function avslutaOverkanslighet(id, term) {
  const svar = await dialog(`<h2 id="dlg-rubrik">Avsluta överkänslighet mot ${esc(term.toLowerCase())}</h2><p>Uppgiften försvinner ur basfakta och symbolen men finns kvar i historiken med vem som avslutade den och varför.</p>
    <form><div class="falt"><label for="ok-avsl">Varför avslutas den? <span class="obl">(obligatoriskt)</span></label><textarea id="ok-avsl" name="orsak" rows="2" required minlength="3"></textarea></div><p class="dialog-fel" role="alert" hidden></p></form>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
  if (!svar) return false;
  await api(`/api/overkanslighet/${encodeURIComponent(id)}/avsluta`, { metod: 'POST', data: { orsak: svar.data.orsak } });
  notis('Överkänsligheten är avslutad.');
  return true;
}
