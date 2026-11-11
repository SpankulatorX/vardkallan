// Runda 13, r1: testarens verktyg i varje vy. Knappen Lämna synpunkt syns alltid, längst ner till höger (på mobil en
// rad längst ner), och panelen med uppdragen följer med mellan vyerna när testaren har valt en yrkesroll på #/testa.
//
// Systemet fyller själv i det som går att räkna ut: sidan, demorollen, uppdraget, versionen, skärmens bredd och
// webbläsaren (servern sätter version, gränssnitt, webbläsare och tid själv). Panelen frågar servern efter varje
// sidbyte och varje sparad ändring om ett uppdrag har blivit gjort, och ställer då jämförelsefrågan.
import { esc, api, ikon, krokar, notis, felNotis, faltFel } from './ui.js';
import { S, loggaIn, loggaInInvanare } from './app.js';
import { TYPER, ALLVAR, YRKEN, SYSTEM, AR, VARDFORM, JAMFORELSE, SPARAS, VEM_LASER, HUR_LANGE, PERSONNUMMER_TEXT, MAX_TEXT, MAX_KONTAKT, MAX_MITT_SYSTEM } from './synpunkt-regler.js';

const AKTIV = 'vk_testare_aktiv';
const OPPEN = 'vk_testare_oppen';
const las = (k, s = sessionStorage) => { try { return s.getItem(k); } catch { return null; } };
const satt = (k, v, s = sessionStorage) => { try { if (v == null) s.removeItem(k); else s.setItem(k, v); } catch { /* utan lagring */ } };

let T = null;
let rot = null;
let hamtar = null;
let senast = 0;

const val = (lista, namn, valt, tomText) => `<option value="">${esc(tomText)}</option>${lista.map(([k, t]) => `<option value="${esc(k)}"${k === valt ? ' selected' : ''}>${esc(t)}</option>`).join('')}`;
export function profilFalt(p = {}, prefix = 'tp') {
  return `<div class="falt-rad testare-profil">
    <div class="falt"><label for="${prefix}-system">Journalsystem du använder i dag</label><select id="${prefix}-system" name="system">${val(SYSTEM, 'system', p.system, 'Vill inte ange')}</select></div>
    <div class="falt"><label for="${prefix}-ar">Hur länge</label><select id="${prefix}-ar" name="ar">${val(AR, 'ar', p.ar, 'Vill inte ange')}</select></div>
    <div class="falt"><label for="${prefix}-yrke">Yrke</label><select id="${prefix}-yrke" name="yrke">${val(YRKEN, 'yrke', p.yrke, 'Vill inte ange')}</select></div>
    <div class="falt"><label for="${prefix}-vardform">Var du arbetar</label><select id="${prefix}-vardform" name="vardform">${val(VARDFORM, 'vardform', p.vardform, 'Vill inte ange')}</select></div>
  </div>`;
}
export const profilUr = (form) => Object.fromEntries(['system', 'ar', 'yrke', 'vardform'].map(k => [k, form.querySelector(`[name="${k}"]`)?.value ?? '']).filter(([, v]) => v));

// Vyn som systemet fyller i: adressens väg utan fråga.
const vyNu = () => (location.hash || '#/').split('?')[0];

export function init() {
  if (rot) return;
  rot = document.createElement('aside');
  rot.id = 'testare';
  rot.className = 'testare-dock';
  rot.setAttribute('aria-label', 'Testa Vårdkällan');
  rot.innerHTML = `<div class="testare-panel" id="testare-panel" hidden></div>
    <div class="testare-knappar">
      <button type="button" class="knapp sekundar testare-uppdragsknapp" data-tp="vaxla" aria-expanded="false" aria-controls="testare-panel" hidden></button>
      <button type="button" class="knapp testare-synpunkt" data-tp="synpunkt">${ikon.penna}<span>Lämna synpunkt</span></button>
    </div>
    <p class="sr" id="testare-meddelande" aria-live="polite"></p>`;
  document.body.append(rot);
  document.body.classList.add('har-testare');
  rot.addEventListener('click', klick);
  rot.addEventListener('submit', skicka);
  new ResizeObserver(() => document.documentElement.style.setProperty('--testare-hojd', `${rot.querySelector('.testare-knappar').offsetHeight}px`)).observe(rot);
  // Efter en sparad ändring kan ett uppdrag ha blivit gjort.
  const forra = krokar.efterSkrivning;
  krokar.efterSkrivning = (vag) => { forra?.(vag); if (!/^\/api\/(testare|synpunkter)/.test(vag)) uppdatera(); };
}

// Efter varje sidbyte (app.js).
// Första gången efter att sessionen finns, så att uppdragen syns också i en ny flik, och sedan bara när uppdrag pågår.
let hamtatEnGang = false;
export function efterVy() { if (!hamtatEnGang || las(AKTIV) || T?.aktiv) { hamtatEnGang = true; uppdatera(); } }

export async function uppdatera({ visa = false } = {}) {
  if (!rot) return;
  const nr = ++senast;
  hamtar = api('/api/testare', { tyst: true, bakgrund: true, direkt: true }).catch(() => null);
  const t = await hamtar;
  if (nr !== senast || !t) return;
  const nyaKlara = T?.aktiv && t.aktiv ? t.attBesvara.filter(id => !T.attBesvara.includes(id)) : [];
  T = t;
  satt(AKTIV, t.aktiv ? '1' : null);
  if (nyaKlara.length) {
    const u = t.uppdrag.find(x => x.id === nyaKlara[0]);
    rot.querySelector('#testare-meddelande').textContent = `Uppdraget ${u?.titel ?? ''} är klart.`;
    satt(OPPEN, '1', localStorage);
  }
  rita({ oppna: visa || nyaKlara.length > 0 });
}

export async function starta(testroll, profil, knapp) {
  const r = await api('/api/testare/starta', { metod: 'POST', data: { testroll, profil } });
  T = r;
  satt(AKTIV, '1');
  satt(OPPEN, '1', localStorage);
  return r;
}

const ikonFor = (u, aktuell) => (u.status === 'klar' ? `<span class="tp-status tp-klar" aria-hidden="true">${ikon.bock}</span>` : u.status === 'hoppade_over' ? `<span class="tp-status tp-hoppad" aria-hidden="true">${ikon.pil}</span>` : `<span class="tp-status${aktuell ? ' tp-aktuell' : ''}" aria-hidden="true"></span>`);
const statusText = (u) => (u.status === 'klar' ? 'klart' : u.status === 'hoppade_over' ? 'överhoppat' : 'kvar');

function rita({ oppna = false } = {}) {
  const knapp = rot.querySelector('[data-tp="vaxla"]');
  const panel = rot.querySelector('#testare-panel');
  if (!T?.aktiv) { knapp.hidden = true; panel.hidden = true; panel.innerHTML = ''; document.body.classList.remove('har-uppdrag'); return; }
  document.body.classList.add('har-uppdrag');
  const n = T.uppdrag.length;
  const gjorda = T.klara + T.hoppade;
  knapp.hidden = false;
  knapp.innerHTML = `${ikon.lista}<span>Uppdrag ${Math.min(gjorda + 1, n)} av ${n}</span>`;
  const oppen = oppna || las(OPPEN, localStorage) === '1';
  panel.hidden = !oppen;
  knapp.setAttribute('aria-expanded', String(oppen));
  const fraga = T.attBesvara[0] ? T.uppdrag.find(u => u.id === T.attBesvara[0]) : null;
  const aktuell = T.uppdrag.find(u => u.id === T.aktuellt);
  const inloggadSom = S.session?.personal?.id ?? (S.session?.invanare ? S.session.invanare.id : null);
  const ratt = T.demoroll ? inloggadSom === T.demoroll : inloggadSom === T.invanare;
  panel.innerHTML = `<div class="tp-huvud"><h2 id="tp-rubrik">${esc(T.knapp)}: ${gjorda} av ${n} uppdrag</h2>
      <button type="button" class="knapp text liten" data-tp="stang" aria-label="Fäll ihop uppdragen">${ikon.kryss}</button></div>
    ${ratt ? '' : `<div class="ruta ruta-info liten tp-roll"><p>Uppdragen görs som ${esc(T.om.replace(/^Du (arbetar som|är) /, '').split(',')[0])}. ${inloggadSom ? 'Du är inloggad som någon annan.' : 'Du är inte inloggad.'}</p><button type="button" class="knapp liten" data-tp="logga-in">Logga in igen</button></div>`}
    ${fraga ? jamforelseHtml(fraga) : aktuell ? aktuelltHtml(aktuell) : `<div class="tp-klart"><p><strong>Alla uppdrag är gjorda.</strong> Tack! Du kan fortsätta pröva systemet fritt och lämna synpunkter från varje sida.</p><p><a href="#/testa">Välj en annan yrkesroll</a></p></div>`}
    <details class="tp-alla"><summary>Alla uppdrag</summary><ol class="tp-lista">${T.uppdrag.map(u => `<li class="${u.id === T.aktuellt ? 'tp-ar-aktuell' : ''}">${ikonFor(u, u.id === T.aktuellt)}<span>${u.sussa ? `<span class="tp-sussa">Sussa ${esc(u.sussa)}</span> ` : ''}${esc(u.titel)}<span class="sr">, ${statusText(u)}</span></span></li>`).join('')}</ol></details>`;
}

function aktuelltHtml(u) {
  return `<section class="tp-uppdrag" aria-labelledby="tp-aktuellt">
    <p class="tp-etikett">Nästa uppdrag${u.sussa ? `, Sussas testfall ${esc(u.sussa)}` : ''}</p>
    <h3 id="tp-aktuellt">${esc(u.titel)}</h3>
    <ul>${u.text.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    ${u.slut ? `<p class="dampad liten">Klart när: ${esc(u.slut)}</p>` : ''}
    ${u.fraga ? `<form class="tp-fraga" data-tp-form="svar" data-id="${esc(u.id)}" novalidate><div class="falt"><label for="tp-svar">${esc(u.fraga)}</label><input id="tp-svar" name="svar" maxlength="200" autocomplete="off"></div><p class="form-fel" role="alert" hidden></p><button type="submit" class="knapp liten">Svara</button></form>`
    : '<p class="dampad liten">Systemet bockar av uppdraget när det är gjort.</p>'}
    <p class="knapprad"><button type="button" class="knapp text liten" data-tp="hoppa" data-id="${esc(u.id)}">Hoppa över uppdraget</button></p>
  </section>`;
}

function jamforelseHtml(u) {
  return `<form class="tp-jamforelse" data-tp-form="jamforelse" data-id="${esc(u.id)}" novalidate aria-labelledby="tp-jf-rubrik">
    <p class="tp-etikett">${u.status === 'klar' ? 'Uppdraget är klart' : 'Du hoppade över uppdraget'}</p>
    <h3 id="tp-jf-rubrik">${esc(u.titel)}</h3>
    <fieldset><legend>Jämfört med hur du gör det i ditt journalsystem i dag, var det</legend>
      ${JAMFORELSE.map(([k, t]) => `<label class="val-rad"><input type="radio" name="jamforelse" value="${esc(k)}"><span>${esc(t)}</span></label>`).join('')}
    </fieldset>
    <div class="falt"><label for="tp-jf-text">Vad var bättre eller sämre? (frivilligt)</label><textarea id="tp-jf-text" name="text" rows="2" maxlength="${MAX_TEXT}"></textarea></div>
    <div class="falt"><label for="tp-jf-mitt">Ungefär hur många klick eller hur lång tid tar det i ditt system? (frivilligt)</label><input id="tp-jf-mitt" name="mittSystem" maxlength="${MAX_MITT_SYSTEM}" autocomplete="off"></div>
    ${T.profil?.system ? '' : `<details class="tp-om-dig"><summary>Om dig (frivilligt)</summary>${profilFalt(T.profil, 'tpj')}</details>`}
    <p class="form-fel" role="alert" hidden></p>
    <p class="knapprad"><button type="submit" class="knapp liten">Skicka</button><button type="button" class="knapp text liten" data-tp="hoppa-fraga" data-id="${esc(u.id)}">Svara inte</button></p>
  </form>`;
}

async function klick(e) {
  const b = e.target.closest('[data-tp]');
  if (!b) return;
  const a = b.dataset.tp;
  try {
    if (a === 'synpunkt') return synpunktDialog();
    if (a === 'vaxla' || a === 'stang') {
      const panel = rot.querySelector('#testare-panel');
      const oppen = a === 'vaxla' ? panel.hidden : false;
      satt(OPPEN, oppen ? '1' : '0', localStorage);
      rita();
      if (a === 'stang') rot.querySelector('[data-tp="vaxla"]').focus();
      return;
    }
    if (a === 'logga-in') return T.demoroll ? loggaIn(T.demoroll, b) : loggaInInvanare(T.invanare, b);
    if (a === 'hoppa') { T = await api(`/api/testare/uppdrag/${encodeURIComponent(b.dataset.id)}/hoppa`, { metod: 'POST', data: {}, direkt: true }); return rita({ oppna: true }); }
    if (a === 'hoppa-fraga') { const r = await api(`/api/testare/uppdrag/${encodeURIComponent(b.dataset.id)}/jamforelse`, { metod: 'POST', data: { hoppa: true }, direkt: true }); T = r.tillstand; return rita({ oppna: true }); }
  } catch (err) { felNotis(err); }
}

async function skicka(e) {
  const form = e.target.closest('[data-tp-form]');
  if (!form) return;
  e.preventDefault();
  const knapp = form.querySelector('[type="submit"]');
  knapp.disabled = true;
  try {
    const id = encodeURIComponent(form.dataset.id);
    if (form.dataset.tpForm === 'svar') {
      const r = await api(`/api/testare/uppdrag/${id}/svar`, { metod: 'POST', data: { svar: form.querySelector('[name="svar"]').value }, direkt: true });
      T = r.tillstand;
      if (!r.ratt) { const f = form.querySelector('.form-fel'); f.textContent = r.text; f.hidden = false; return; }
      rot.querySelector('#testare-meddelande').textContent = r.text;
      return rita({ oppna: true });
    }
    const jf = form.querySelector('[name="jamforelse"]:checked')?.value;
    if (!jf) { const f = form.querySelector('.form-fel'); f.textContent = 'Välj om det var lättare, ungefär lika eller svårare, eller att det inte går att jämföra.'; f.hidden = false; form.querySelector('[name="jamforelse"]').focus(); return; }
    const r = await api(`/api/testare/uppdrag/${id}/jamforelse`, { metod: 'POST', direkt: true,
      data: { jamforelse: jf, text: form.querySelector('[name="text"]').value, mittSystem: form.querySelector('[name="mittSystem"]').value, bredd: window.innerWidth, ...profilUr(form) } });
    T = r.tillstand;
    notis(`Tack! Svaret är sparat med nummer ${r.nummer}.`);
    rita({ oppna: true });
    rot.querySelector('#tp-aktuellt, #tp-jf-rubrik, #tp-rubrik')?.setAttribute('tabindex', '-1');
    rot.querySelector('#tp-aktuellt, #tp-jf-rubrik, #tp-rubrik')?.focus();
  } catch (err) {
    if (err?.status === 400) faltFel(form, err); else felNotis(err);
  } finally { if (knapp.isConnected) knapp.disabled = false; }
}

// Formuläret för en synpunkt. Texten har fokus direkt, så att testaren kan börja skriva.
let dlgOppen = false;
export function synpunktDialog() {
  if (dlgOppen) return;
  dlgOppen = true;
  const forra = document.activeElement;
  const vy = vyNu();
  const roll = S.session?.personal ? `${S.session.personal.namn}, ${S.session.personal.titel}` : S.session?.invanare ? 'invånare i Min journal' : 'inte inloggad';
  const dl = document.createElement('dialog');
  dl.className = 'dialog dialog-bred synpunkt-dialog';
  dl.setAttribute('aria-labelledby', 'sp-rubrik');
  dl.innerHTML = `<div class="dialog-inre"><form id="sp-form" novalidate>
    <h2 id="sp-rubrik">${ikon.penna}Lämna en synpunkt</h2>
    <p class="liten dampad">Vad är fel, vad saknas eller vad är svårt? Skriv vad du gjorde, vad som hände och vad du väntade dig.</p>
    <div class="falt"><label for="sp-text">Din synpunkt <span class="obl">(obligatoriskt)</span></label><textarea id="sp-text" name="text" rows="4" maxlength="${MAX_TEXT}" required aria-required="true" aria-describedby="sp-pnr"></textarea>
      <span class="hjalp" id="sp-pnr">${esc(PERSONNUMMER_TEXT)}</span></div>
    <fieldset><legend>Vad gäller det?</legend><div class="sp-val">${TYPER.map(([k, t]) => `<label class="val-rad"><input type="radio" name="typ" value="${esc(k)}"><span>${esc(t)}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Hur allvarligt är det för dig?</legend>${ALLVAR.map(([k, t]) => `<label class="val-rad"><input type="radio" name="allvar" value="${esc(k)}"><span>${esc(t)}</span></label>`).join('')}</fieldset>
    <details class="sp-mer"><summary>Om dig och kontakt (frivilligt)</summary>
      ${profilFalt(T?.profil ?? {}, 'sp')}
      <div class="falt"><label for="sp-kontakt">Vill du att projektet kontaktar dig? E-post eller telefon</label><input id="sp-kontakt" name="kontakt" maxlength="${MAX_KONTAKT}" autocomplete="off" aria-describedby="sp-kontakt-h"><span class="hjalp" id="sp-kontakt-h">Helt frivilligt. ${esc(HUR_LANGE)}</span></div>
    </details>
    <details class="sp-sparas"><summary>Det här sparas</summary><ul>${SPARAS.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p>${esc(VEM_LASER)}</p><p><a href="#/om">Mer om demon och integriteten</a></p></details>
    <p class="liten dampad sp-auto">Systemet fyller i själv: sidan ${esc(vy)}, ${esc(roll)}${T?.aktiv && T.aktuellt ? `, uppdraget ${esc(T.uppdrag.find(u => u.id === T.aktuellt)?.titel ?? '')}` : ''}, version och skärmbredd.</p>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Skicka synpunkten</button><button type="button" class="knapp sekundar" data-sp="stang">Avbryt</button></div>
  </form></div>`;
  document.body.append(dl);
  const stang = () => { dl.close(); };
  dl.addEventListener('close', () => { dlgOppen = false; setTimeout(() => dl.remove(), 30); if (forra?.isConnected) forra.focus(); });
  dl.addEventListener('click', (e) => { if (e.target.closest('[data-sp="stang"]')) stang(); });
  dl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = dl.querySelector('form');
    const fel = form.querySelector('.form-fel');
    const data = { text: form.querySelector('[name="text"]').value, typ: form.querySelector('[name="typ"]:checked')?.value, allvar: form.querySelector('[name="allvar"]:checked')?.value,
      kontakt: form.querySelector('[name="kontakt"]').value, vy, bredd: window.innerWidth, ...profilUr(form) };
    const saknas = !data.text.trim() ? ['text', 'Skriv din synpunkt.'] : !data.typ ? ['typ', 'Välj vad synpunkten gäller.'] : !data.allvar ? ['allvar', 'Välj hur allvarligt det är för dig.'] : null;
    if (saknas) { fel.textContent = saknas[1]; fel.hidden = false; form.querySelector(`[name="${saknas[0]}"]`).focus(); return; }
    const knapp = form.querySelector('[type="submit"]');
    knapp.disabled = true;
    try {
      const r = await api('/api/synpunkter', { metod: 'POST', data, direkt: true });
      dl.querySelector('.dialog-inre').innerHTML = `<div class="synpunkt-kvitto" role="status">
        <h2 id="sp-rubrik" tabindex="-1">${ikon.bock}Tack!</h2>
        <p>Din synpunkt är sparad med nummer <strong>${esc(r.nummer)}</strong>. Du kan inte läsa eller ändra den efteråt, men numret visar att den har kommit fram.</p>
        <div class="knapprad"><button type="button" class="knapp" data-sp="stang">Stäng</button></div></div>`;
      dl.querySelector('#sp-rubrik').focus();
    } catch (err) {
      if (err?.status === 400) {
        if (err.data?.falt?.some(f => ['yrke', 'system', 'ar', 'vardform', 'kontakt'].includes(f))) dl.querySelector('.sp-mer').open = true;
        faltFel(form, err);
      } else { fel.textContent = err?.message ?? 'Synpunkten kunde inte skickas.'; fel.hidden = false; }
    } finally { if (knapp.isConnected) knapp.disabled = false; }
  });
  dl.addEventListener('cancel', (e) => { e.preventDefault(); stang(); });
  dl.showModal();
  dl.querySelector('#sp-text').focus();
}
