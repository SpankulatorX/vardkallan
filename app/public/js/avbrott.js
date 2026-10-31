// Läsläge vid avbrott (D4). Upptäcker när servern inte svarar, visar läget "Avbrott: läsläge" med tidpunkten för
// läskopian, stänger av allt skrivande och kontrollerar var femte sekund om servern svarar igen. Då skickas
// åtkomsterna från läsläget till serverns åtkomstlogg, läskopian förnyas och appen återgår till vanligt läge.
// Demoknappen "Simulera avbrott" gör att just den här fliken beter sig som om servern var nere. Servern är igång
// för alla andra besökare.
import { esc, api, avbrott, krokar, notis, tidpunkt, ikon } from './ui.js';
import * as kopia from './lasekopia.js';
import { S, rita, uppdateraInkorg, demoknappar } from './app.js';

const SS_SIMULERAT = 'vk_simulerat_avbrott';
const SS_UTLOGGAD = 'vk_utloggad_under_avbrott';
const KONTROLL_MS = 5000;
const FORNYA_MS = 5 * 60_000;

let meta = null;         // { skapad, session, patienter } för läskopian som visas
let kontroll = null;
let vakt = null;
let atergar = false;
let senastFornyad = 0;
let fornyaTimer = null;

const ssLas = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSkriv = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* privat läge */ } };

// Hälsokontroll direkt mot servern, med tidsgräns.
async function serverSvarar() {
  const k = new AbortController();
  const t = setTimeout(() => k.abort(), 3000);
  try {
    const r = await fetch('/api/health', { cache: 'no-store', signal: k.signal });
    return r.ok;
  } catch { return false; } finally { clearTimeout(t); }
}

// Anropas av api() när ett anrop inte når servern. tvinga betyder att läget redan är bestämt (simulerat avbrott).
// Ett enstaka tappat anrop ger inte läsläge: servern måste också missa hälsokontrollen.
// Flera anrop kan misslyckas samtidigt; de väntar då på samma kontroll, så att läskopian är öppnad innan någon läser.
let pagar = null;
function upptackt(tvinga = false) {
  if (avbrott.aktivt) return Promise.resolve(true);
  pagar ??= (async () => {
    try {
      if (!tvinga && !avbrott.simulerat && await serverSvarar()) return false;
      try { meta = await kopia.oppna(); } catch { meta = null; }
      avbrott.aktivt = true;
      document.body.classList.add('laslage');
      visaRad();
      demoknappar();
      starta();
      return true;
    } finally { pagar = null; }
  })();
  return pagar;
}

export function init() {
  avbrott.simulerat = ssLas(SS_SIMULERAT) === '1';
  avbrott.upptackt = upptackt;
  avbrott.svara = kopia.svara;
  // Efter en ändring förnyas läskopian, så att den visar det som just sparades.
  krokar.efterSkrivning = (vag) => { if (!/^\/api\/(logout|lasekopia\/logg)/.test(vag)) fornya({ nu: true }); };
  document.getElementById('avbrott')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-avbrott="avsluta"]')) avslutaSimulering();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => console.warn('Service workern kunde inte registreras:', e?.message));
  }
  setInterval(() => fornya(), FORNYA_MS);
}

function starta() {
  if (!kontroll) kontroll = setInterval(() => { if (!avbrott.simulerat) kontrollera(); }, KONTROLL_MS);
  if (!vakt) {
    // Allt skrivande stängs av, även i vyer som ritas medan läsläget pågår.
    vakt = new MutationObserver(() => sparraSkrivning());
    vakt.observe(document.body, { childList: true, subtree: true });
  }
  sparraSkrivning();
}
function stoppa() {
  clearInterval(kontroll); kontroll = null;
  vakt?.disconnect(); vakt = null;
  document.body.classList.remove('laslage');
  document.querySelectorAll('[data-laslage-av]').forEach(el => { el.disabled = false; el.removeAttribute('data-laslage-av'); el.removeAttribute('title'); });
}

// Knappar och fält i innehållet stängs av. Läsfilter (data-las-ok), Logga ut, menyn och avbrottsraden lämnas.
function sparraSkrivning() {
  const rotar = [document.getElementById('innehall'), document.querySelector('.demorad'), ...document.querySelectorAll('dialog')].filter(Boolean);
  for (const rot of rotar) {
    for (const el of rot.querySelectorAll('button, input, select, textarea')) {
      if (el.disabled || el.closest('[data-las-ok]') || el.matches('[data-a="avbrott"]')) continue;
      el.disabled = true;
      el.setAttribute('data-laslage-av', '');
      el.title = 'Avstängt under avbrottet. Inget kan sparas förrän servern svarar igen.';
    }
  }
}

function visaRad() {
  const el = document.getElementById('avbrott');
  if (!el) return;
  if (!avbrott.aktivt) { el.hidden = true; el.innerHTML = ''; return; }
  const sim = avbrott.simulerat ? '<p class="avbrott-sim">Avbrottet är simulerat i den här fliken. Servern är igång för alla andra besökare.</p>' : '';
  const knapp = avbrott.simulerat ? '<button type="button" class="knapp liten sekundar" data-avbrott="avsluta">Avsluta simulerat avbrott</button>' : '';
  el.innerHTML = meta
    ? `<div class="avbrott-inre">${ikon.varning}<div class="avbrott-text">
        <h2 id="avbrott-rubrik">Avbrott: läsläge</h2>
        <p>Servern svarar inte. Du ser en läskopia från <strong data-laskopia-tid>${esc(tidpunkt(meta.skapad))}</strong>. Uppgifterna kan vara inaktuella: det som har ändrats efter den tiden syns inte.</p>
        <p>Allt skrivande är avstängt, eftersom inget kan sparas i journalen förrän servern svarar igen. Läskopian har arbetslistan och ${meta.patienter === 1 ? 'en patient' : `${meta.patienter} patienter`}. Det du läser loggas här och skickas till åtkomstloggen när förbindelsen är tillbaka.</p>${sim}
      </div>${knapp}</div>`
    : `<div class="avbrott-inre">${ikon.varning}<div class="avbrott-text">
        <h2 id="avbrott-rubrik">Avbrott: servern svarar inte</h2>
        <p>Det finns ingen läskopia att visa i den här fliken. Läskopian görs när du är inloggad, gäller i 8 timmar och raderas när du loggar ut. Allt skrivande är avstängt tills förbindelsen är tillbaka.</p>${sim}
      </div>${knapp}</div>`;
  el.hidden = false;
}

// Demoknappen.
export async function simulera() {
  avbrott.simulerat = true;
  ssSkriv(SS_SIMULERAT, '1');
  await upptackt(true);
  visaRad();
  if (meta) S.session = meta.session;
  rita();
}
async function avslutaSimulering() {
  avbrott.simulerat = false;
  ssSkriv(SS_SIMULERAT, null);
  await kontrollera();
  if (avbrott.aktivt) visaRad();
}

async function kontrollera() {
  if (!avbrott.aktivt || atergar || avbrott.simulerat) return;
  if (await serverSvarar()) await aterga();
}

// Servern svarar igen: skicka åtkomsterna från läsläget, förnya sessionen och läskopian och rita om.
// Skickar åtkomstloggen från läsläget. Ger antalet skickade rader, eller null om servern fortfarande inte svarar.
async function skickaLogg() {
  const rader = await kopia.hamtaLogg();
  if (!rader.length) return 0;
  try {
    const r = await api('/api/lasekopia/logg', { metod: 'POST', data: { rader }, direkt: true, tyst: true });
    if (r.avvisade.length) notis(`${r.avvisade.length === 1 ? 'En åtkomst' : `${r.avvisade.length} åtkomster`} från läsläget togs inte emot av servern.`, 'info');
  } catch (e) {
    if (e.status === 0) return null;
    notis(`Åtkomsterna från läsläget kunde inte föras över till åtkomstloggen: ${e.message}`, 'fel');
  }
  await kopia.tomLogg(rader.map(x => x.id));
  return rader.length;
}

// Personen loggade ut medan servern inte svarade. Nu när servern svarar skickas loggen och sessionen loggas ut där också.
export async function slutforUtloggning() {
  if (ssLas(SS_UTLOGGAD) !== '1') return false;
  if (await skickaLogg() === null) return false;
  ssSkriv(SS_UTLOGGAD, null);
  try { await api('/api/logout', { metod: 'POST', data: {}, direkt: true, tyst: true }); } catch { /* sessionen kan redan vara borta */ }
  await kopia.rensa();
  S.session = { inloggad: false };
  return true;
}

async function aterga() {
  atergar = true;
  try {
    const utloggad = ssLas(SS_UTLOGGAD) === '1';
    const antal = utloggad ? 0 : await skickaLogg();
    if (antal === null) return;
    if (utloggad && !(await slutforUtloggning())) return;
    avbrott.aktivt = false;
    meta = null;
    kopia.stang();
    stoppa();
    visaRad();
    if (!utloggad) {
      try { S.session = await api('/api/session', { tyst: true }); } catch { S.session = { inloggad: false }; }
      if (S.session.inloggad) await kopia.satNyckel(S.session.lasnyckel, S.session.personal.id);
    }
    notis(antal
      ? `Servern svarar igen. Läsläget är avslutat och ${antal === 1 ? 'åtkomsten' : `de ${antal} åtkomsterna`} under avbrottet finns nu i åtkomstloggen.`
      : 'Servern svarar igen. Läsläget är avslutat.');
    await uppdateraInkorg();
    rita();
    fornya({ nu: true });
  } finally { atergar = false; }
}

// Utloggning medan servern inte svarar: kopian raderas direkt. Loggen från läsläget och nyckeln finns kvar tills de
// har skickats, och servern loggar ut sessionen när den svarar igen.
export async function loggaUtUnderAvbrott() {
  ssSkriv(SS_UTLOGGAD, '1');
  await kopia.rensa({ behallLogg: true });
  meta = null;
  visaRad();
}

// Hämtar en ny läskopia från servern och sparar den krypterad. nu: direkt, annars högst en gång i minuten.
export function fornya({ nu = false } = {}) {
  if (avbrott.aktivt || avbrott.simulerat || !S.session?.inloggad) return;
  if (!nu && Date.now() - senastFornyad < 60_000) return;
  clearTimeout(fornyaTimer);
  fornyaTimer = setTimeout(async () => {
    const vem = S.session?.personal?.id;
    if (!vem || avbrott.aktivt) return;
    senastFornyad = Date.now();
    try {
      await kopia.satNyckel(S.session.lasnyckel, vem);
      const ny = await api('/api/lasekopia', { direkt: true, tyst: true });
      if (S.session?.personal?.id !== vem || avbrott.aktivt) return;
      const skapad = await kopia.spara(ny);
      if (skapad) document.documentElement.dataset.laskopia = skapad;
    } catch (e) {
      if (e.status && e.status !== 401) console.warn('Läskopian kunde inte förnyas:', e.message);
    }
  }, nu ? 300 : 0);
}

// Vid utloggning och vid byte av person.
export async function rensa() {
  delete document.documentElement.dataset.laskopia;
  await kopia.rensa();
}
