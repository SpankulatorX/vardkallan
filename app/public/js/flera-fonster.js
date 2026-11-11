// Runda 12, r3 (Sussa KD1.1.4.10): arbete över flera skärmar. Användarens fönster i samma webbläsare och inloggning
// talar med varandra genom en BroadcastChannel inom samma ursprung. När en patient öppnas i ett fönster följer de andra
// fönstren som visar en journal med, och behåller sin egen flik, så att till exempel läkemedelslistan på den andra
// skärmen alltid gäller samma patient. Ett fönster kan låsas till sin patient. Då följer det inte med, men visar tydligt
// att en annan patient är öppen i ett annat fönster, så att ingen kan arbeta i fel patients journal utan att se det.
//
// Kanalen bär bara patientens id och det namn som avsändaren redan visar. Varje fönster hämtar journalen själv, med
// sin egen behörighetsprövning och loggning på servern.
import { esc, ikon, notis } from './ui.js';


const LAS_NYCKEL = 'vk_fonster_last';
let kanal = null;
// Varje fönster får ett eget id när sidan laddas. Det sparas inte, eftersom en kopierad flik får en kopia av sessionStorage.
const egenId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
let personAktuell = null;
let aktuell = null;
let aktuellNamn = '';
let annan = null;

const lagrat = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const lagra = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* privat läge */ } };
export const last = () => lagrat(LAS_NYCKEL) === '1';

// Kanalen gäller en inloggad person, så att en annan persons fönster i samma webbläsare aldrig följer med.
export function starta(personalId) {
  if (personalId && personalId === personAktuell && kanal) return;
  stoppa();
  if (!personalId || typeof BroadcastChannel !== 'function') return;
  personAktuell = personalId;
  kanal = new BroadcastChannel(`vardkallan-fonster-${personalId}`);
  kanal.onmessage = (e) => taEmot(e.data);
}
export function stoppa() {
  kanal?.close();
  kanal = null;
  personAktuell = null;
  aktuell = null;
  annan = null;
  doljVarning();
}

// Anropas när ett fönster visar en patients journal, eller lämnar journalen (pid null).
export function patient(pid, namn = '') {
  if (pid === aktuell) { aktuellNamn = namn || aktuellNamn; return; }
  aktuell = pid;
  aktuellNamn = namn;
  if (!pid) { annan = null; doljVarning(); return; }
  if (annan && annan.pid === pid) { annan = null; doljVarning(); }
  kanal?.postMessage({ typ: 'patient', pid, namn, fran: egenId });
}

function taEmot(d) {
  if (!d || d.typ !== 'patient' || d.fran === egenId || typeof d.pid !== 'string' || !/^[\w-]+$/.test(d.pid)) return;
  if (!aktuell || d.pid === aktuell) { if (annan) { annan = null; doljVarning(); } return; }
  if (!last()) {
    // Fönstret följer med och behåller sin flik.
    const del = location.hash.match(/^#\/patient\/[\w-]+\/([a-z]+)/)?.[1];
    notis(`Journalen byttes till ${d.namn || 'en annan patient'}, eftersom patienten öppnades i ett annat fönster.`, 'info');
    location.hash = `#/patient/${encodeURIComponent(d.pid)}${del ? `/${del}` : ''}`;
    return;
  }
  annan = { pid: d.pid, namn: String(d.namn ?? '').slice(0, 120) };
  visaVarning();
}

function visaVarning() {
  let el = document.getElementById('fonster-varning');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fonster-varning';
    el.className = 'fonster-varning';
    el.setAttribute('role', 'alert');
    document.body.prepend(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fonster]');
      if (!b) return;
      if (b.dataset.fonster === 'byt' && annan) location.hash = `#/patient/${encodeURIComponent(annan.pid)}`;
      annan = null;
      doljVarning();
    });
  }
  el.innerHTML = `${ikon.varning}<p><strong>Det här fönstret visar ${esc(aktuellNamn || 'en annan patient')}.</strong> I ett annat fönster har du öppnat ${esc(annan.namn || 'en annan patient')}. Fönstret är låst och följer inte med.</p>
    <div class="knapprad"><button type="button" class="knapp liten" data-fonster="byt">Byt till ${esc(annan.namn || 'den patienten')}</button><button type="button" class="knapp liten sekundar" data-fonster="behall">Behåll ${esc(aktuellNamn || 'patienten')}</button></div>`;
  document.documentElement.dataset.fonsterVarning = '1';
}
function doljVarning() {
  document.getElementById('fonster-varning')?.remove();
  delete document.documentElement.dataset.fonsterVarning;
}

// Raden i journalen: öppna en del av journalen i ett nytt fönster, och lås eller släpp fönstret.
const DELAR = [['oversikt', 'Översikt'], ['journal', 'Journal'], ['lakemedel', 'Läkemedel'], ['matvarden', 'Mätvärden'], ['prover', 'Prover'], ['remisser', 'Remisser']];
export function radHtml(pid) {
  const l = last();
  return `<div class="fonster-rad" data-fonster-rad>
    <label for="fonster-del">Öppna i nytt fönster</label>
    <select id="fonster-del">${DELAR.map(([k, t]) => `<option value="${k}"${k === 'lakemedel' ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <button type="button" class="knapp liten sekundar" data-fonster-oppna="${esc(pid)}">${ikon.moduler}<span>Öppna</span></button>
    <button type="button" class="knapp liten text" data-fonster-las aria-pressed="${l}">${l ? ikon.las : ikon.oga}<span>${l ? 'Låst till patienten' : 'Följer andra fönster'}</span></button>
  </div>`;
}
export function kopplaRad(el) {
  el?.addEventListener('click', (e) => {
    const o = e.target.closest('[data-fonster-oppna]');
    if (o) {
      const del = el.querySelector('#fonster-del').value;
      window.open(`#/patient/${encodeURIComponent(o.dataset.fonsterOppna)}${del === 'oversikt' ? '' : `/${del}`}`, '_blank', 'noopener');
      return;
    }
    const b = e.target.closest('[data-fonster-las]');
    if (!b) return;
    const ny = !last();
    lagra(LAS_NYCKEL, ny ? '1' : null);
    b.setAttribute('aria-pressed', String(ny));
    b.innerHTML = `${ny ? ikon.las : ikon.oga}<span>${ny ? 'Låst till patienten' : 'Följer andra fönster'}</span>`;
    notis(ny ? 'Fönstret är låst till patienten och följer inte med när du byter patient i ett annat fönster.' : 'Fönstret följer med när du öppnar en patient i ett annat fönster.', 'info');
  });
}
