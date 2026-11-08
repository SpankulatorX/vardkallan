// Runda 10, r3: röstinmatning i anteckningens sökord (Sussa 3.1.3.2 och 3.1.3.7). Webbläsarens taligenkänning (Web Speech
// API) gör tal till text på svenska, och rost-regler.js avgör vad texten betyder: text i det sökord som dikteras, eller
// ett röstkommando som skiljetecken, ny rad, nästa sökord, gå till ett sökord, ångra och sluta diktera.
//
// Säkerheten kring patientens identitet: dikteringen hör till den patient och den anteckning som var öppen när den
// startade. Rutan över fälten visar hela tiden vems journal det är, och byter man sida eller patient avbryts dikteringen
// och det som inte är skrivet kastas. Den dikterade texten hamnar i fälten som ett utkast, som sparas och signeras med
// knapparna som vanligt, och rösten kan aldrig signera. Sökord med dikterad text märks, så att det syns i anteckningen.
//
// Igenkänningen görs lokalt i webbläsaren när den kan (processLocally). Annars kan webbläsaren skicka ljudet till sin
// leverantörs tjänst, vilket står i rutan. I demon finns bara påhittade patienter.
import { esc, notis } from './ui.js';
import * as R from './rost-regler.js';

// Motorn: webbläsarens taligenkänning. Testerna sätter window.__vkTaligenkanning till en simulerad motor.
const motor = () => window.__vkTaligenkanning ?? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
export const finns = () => Boolean(motor());

// Kopplar knappen Diktera till anteckningsformuläret. patient är { id, namn, personnummer } för den öppna patienten.
export function koppla(form, { patient }) {
  const knapp = form.querySelector('[data-diktera]');
  const ruta = form.querySelector('[data-diktat]');
  if (!knapp || !ruta) return;
  if (!finns()) {
    knapp.hidden = true;
    ruta.hidden = false;
    ruta.innerHTML = '<p class="hjalp">Webbläsaren har ingen taligenkänning. Röstinmatning fungerar i till exempel Chrome och Edge.</p>';
    return;
  }
  let rec = null;
  let falt = null;
  const historik = [];
  const startHash = location.hash;
  const sokordFalt = () => [...form.querySelectorAll('[data-sokord]')].filter(t => t.tagName === 'TEXTAREA');
  const namn = () => sokordFalt().map(t => t.dataset.sokord);
  const markera = (t) => {
    for (const x of sokordFalt()) x.classList.toggle('dikteras', x === t);
    falt = t;
    const el = ruta.querySelector('[data-diktat-falt]');
    if (el) el.textContent = t ? `Du dikterar under ${t.dataset.sokord}.` : '';
  };
  const sluta = ({ avbrutet = false } = {}) => {
    if (!rec) return;
    const r = rec;
    rec = null;
    try { avbrutet ? r.abort() : r.stop(); } catch { /* redan stoppad */ }
    for (const x of sokordFalt()) x.classList.remove('dikteras');
    knapp.setAttribute('aria-pressed', 'false');
    knapp.querySelector('span').textContent = 'Diktera';
    window.removeEventListener('hashchange', vidByte);
    ruta.innerHTML = avbrutet ? '<p class="ruta ruta-info liten" role="status">Dikteringen avbröts eftersom du lämnade anteckningen. Det som inte var skrivet i fälten är borta.</p>'
      : historik.length ? '<p class="ruta ruta-info liten" role="status">Dikteringen är klar. Läs igenom den dikterade texten innan du signerar.</p>' : '';
  };
  // En annan sida eller en annan patient avbryter dikteringen, så att inget hamnar i fel journal.
  const vidByte = () => { if (location.hash !== startHash || !form.isConnected) sluta({ avbrutet: true }); };
  const tillampa = (transkript) => {
    for (const d of R.tolka(transkript, { sokord: namn() })) {
      const lista = sokordFalt();
      if (d.typ === 'text') {
        const t = falt ?? lista.find(x => !x.value.trim()) ?? lista[0];
        historik.push({ t, forra: t.value, rost: t.dataset.inmatning });
        t.value = R.skriv(t.value, d.ord);
        t.dataset.inmatning = 'rost';
        t.dispatchEvent(new Event('input', { bubbles: true }));
        markera(t);
      } else if (d.kommando === 'nasta' || d.kommando === 'foregaende') {
        const i = lista.indexOf(falt);
        const ny = lista[Math.max(0, Math.min(lista.length - 1, i + (d.kommando === 'nasta' ? 1 : -1)))];
        ny.focus();
        markera(ny);
      } else if (d.kommando === 'ga_till') {
        const ny = lista.find(x => x.dataset.sokord === d.sokord);
        if (ny) { ny.focus(); markera(ny); }
      } else if (d.kommando === 'angra') {
        const h = historik.pop();
        if (h) { h.t.value = h.forra; if (h.rost) h.t.dataset.inmatning = h.rost; else delete h.t.dataset.inmatning; h.t.dispatchEvent(new Event('input', { bubbles: true })); }
      } else if (d.kommando === 'sluta') { sluta(); return; }
      else if (d.kommando === 'signera') notis(d.text, 'info');
    }
  };
  const starta = () => {
    const Motor = motor();
    rec = new Motor();
    rec.lang = 'sv-SE';
    rec.continuous = true;
    rec.interimResults = true;
    // Lokal igenkänning när webbläsaren har den, så att ljudet inte lämnar datorn.
    const lokal = 'processLocally' in rec;
    if (lokal) rec.processLocally = true;
    const aktiv = (sokordFalt().includes(document.activeElement) ? document.activeElement : null);
    ruta.hidden = false;
    ruta.innerHTML = `<div class="ruta ruta-info liten diktat-ruta" role="status">
        <p><strong>Diktering pågår i journalen för ${esc(patient.namn)}${patient.personnummer ? `, ${esc(patient.personnummer)}` : ''}.</strong> <span data-diktat-falt></span></p>
        <p class="diktat-hor" data-diktat-hor aria-live="off"></p>
        <p class="hjalp">Säg nästa sökord, gå till och sökordets namn, punkt, kommatecken, ny rad, ångra eller sluta diktera. ${lokal ? 'Igenkänningen görs i webbläsaren.' : 'Webbläsaren kan skicka ljudet till sin leverantörs tjänst för igenkänningen. I demon finns bara påhittade patienter.'} Signeringen gör du själv med knappen.</p>
      </div>`;
    markera(aktiv ?? sokordFalt().find(x => !x.value.trim()) ?? sokordFalt()[0]);
    rec.onresult = (e) => {
      if (!rec || location.hash !== startHash) return;
      let tillfallig = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) tillampa(r[0].transcript);
        else tillfallig += r[0].transcript;
      }
      const hor = ruta.querySelector('[data-diktat-hor]');
      if (hor) hor.textContent = tillfallig ? `Hör: ${tillfallig}` : '';
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      const varfor = e.error === 'not-allowed' ? 'Webbläsaren fick inte använda mikrofonen. Tillåt mikrofonen för sidan och försök igen.' : e.error === 'no-speech' ? 'Inget tal hördes.' : 'Taligenkänningen avbröts.';
      notis(varfor, 'info');
      sluta();
    };
    rec.onend = () => { if (rec) sluta(); };
    window.addEventListener('hashchange', vidByte);
    knapp.setAttribute('aria-pressed', 'true');
    knapp.querySelector('span').textContent = 'Sluta diktera';
    rec.start();
  };
  knapp.addEventListener('click', () => (rec ? sluta() : starta()));
}
