// Läsläge vid avbrott (D4). Upptäcker när servern inte svarar, visar läget "Avbrott: läsläge" med tidpunkten för
// läskopian, stänger av allt skrivande och kontrollerar var femte sekund om servern svarar igen. Då skickas
// åtkomsterna från läsläget till serverns åtkomstlogg, läskopian förnyas och appen återgår till vanligt läge.
// Med en reservkod (reservkopia.js) går läsläget att öppna också i en ny flik eller efter en omstart av webbläsaren.
// Demoknappen "Simulera avbrott" gör att just den här fliken beter sig som om servern var nere. Servern är igång
// för alla andra besökare.
import { esc, api, avbrott, krokar, notis, tidpunkt, klockslag, ikon, dialog } from './ui.js';
import * as kopia from './lasekopia.js';
import * as reserv from './reservkopia.js';
import { S, rita, uppdateraInkorg, demoknappar, laddaEnheter } from './app.js';

const SS_SIMULERAT = 'vk_simulerat_avbrott';
const SS_UTLOGGAD = 'vk_utloggad_under_avbrott';
const KONTROLL_MS = 5000;
const FORNYA_MS = 5 * 60_000;
// Rader per anrop när loggen från läsläget skickas. 100 krypterade rader ryms med marginal i serverns 64 kB.
const PER_ANROP = 100;

let meta = null;         // { skapad, session, patienter, reserv } för läskopian som visas
let minReserv = null;    // reservkopian för den inloggade, { giltigTill, ... } eller null
let antalReserv = 0;     // reservkopior på datorn
let kontroll = null;
let vakt = null;
let atergar = false;
let senastFornyad = 0;
let fornyaTimer = null;
// Utloggning i en flik meddelas webbläsarens andra flikar, så att de inte fortsätter i läsläge med läskopian.
const kanal = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vardkallan-avbrott') : null;

const ssLas = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSkriv = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* privat läge */ } };
// Väntande utloggning sparas i localStorage, så att den överlever att fliken stängs. Nästa start loggar ut sessionen
// på servern innan den används, även om en annan person öppnar sidan på samma dator.
const lsLas = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSkriv = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privat läge */ } };
const medTidsgrans = (p, ms) => Promise.race([p, new Promise((_, nej) => setTimeout(() => nej(new Error('tidsgräns')), ms))]);
const antalText = (n, en, flera) => (n === 1 ? en : `${n} ${flera}`);

// Skickar alla väntande åtkomster från läsläget, för alla läskopior på datorn. Raderna är krypterade med respektive
// läskopias nyckel och servern kontrollerar dem med samma nyckel, så det behövs varken inloggning eller nyckel här.
// En rad raderas lokalt när servern har svarat på den. Ger { mottagna, avvisade, forlorade, fel, perKopia }, eller
// null om servern inte svarar.
export async function skickaLoggar() {
  const alla = await kopia.vantandeLoggar();
  const res = { mottagna: 0, avvisade: 0, forlorade: 0, fel: null, perKopia: {} };
  const grupper = new Map();
  for (const r of alla) { if (!grupper.has(r.kopiaId)) grupper.set(r.kopiaId, []); grupper.get(r.kopiaId).push(r); }
  for (const [kopiaId, rader] of grupper) {
    for (let i = 0; i < rader.length; i += PER_ANROP) {
      const omgang = rader.slice(i, i + PER_ANROP);
      try {
        const r = await medTidsgrans(api('/api/lasekopia/krypterad-logg', {
          metod: 'POST', direkt: true, tyst: true,
          // klocka låter servern rätta tiderna om datorns klocka går fel.
          data: { kopiaId, klocka: new Date().toISOString(), rader: omgang.map(x => ({ id: x.id, iv: kopia.tillB64(x.iv), data: kopia.tillB64(x.data) })) },
        }), 8000);
        res.mottagna += r.mottagna;
        res.avvisade += r.avvisade.length;
        res.perKopia[kopiaId] = (res.perKopia[kopiaId] ?? 0) + r.mottagna;
        await kopia.taBortLoggar(omgang.map(x => x.id));
      } catch (e) {
        if (!e?.status) return null;
        // Läskopian finns inte längre på servern, eller raderna kan aldrig tas emot: de raderas och det syns.
        if (e.status === 404 || e.status === 400) {
          const resten = rader.slice(i);
          res.forlorade += resten.length;
          await kopia.taBortLoggar(resten.map(x => x.id));
          break;
        }
        res.fel = e.message;
        return res;
      }
    }
  }
  return res;
}

export function meddelaLogg(res) {
  if (!res) return;
  if (res.avvisade) notis(`${antalText(res.avvisade, 'En åtkomst', 'åtkomster')} från läsläget togs inte emot av servern.`, 'info');
  if (res.forlorade) notis(`${antalText(res.forlorade, 'En åtkomst', 'åtkomster')} från läsläget kunde inte föras över, eftersom läskopian inte längre finns på servern.`, 'fel');
  if (res.fel) notis(`Åtkomsterna från läsläget kunde inte föras över till åtkomstloggen: ${res.fel} De sparas krypterade och skickas igen senare.`, 'fel');
}

// Åtkomsterna från läsläget skickas före utloggningen och raderas lokalt först när servern har tagit emot dem.
async function loggaUtPaServern() {
  const res = await skickaLoggar().catch(() => null);
  if (res === null) return false;
  meddelaLogg(res);
  try {
    await medTidsgrans(api('/api/logout', { metod: 'POST', data: {}, direkt: true, tyst: true }), 5000);
    return true;
  } catch (e) { return e?.status === 401; }
}

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
      uppdateraReservStatus();
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
  krokar.efterSkrivning = (vag) => { if (!/^\/api\/(logout|lasekopia\/)/.test(vag)) fornya({ nu: true }); };
  kanal?.addEventListener('message', (e) => { if (e.data?.typ === 'utloggad') utloggadIAnnanFlik(e.data.personalId); });
  document.getElementById('avbrott')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-avbrott]');
    if (b?.dataset.avbrott === 'avsluta') avslutaSimulering();
    else if (b?.dataset.avbrott === 'reservkod') valjReservkod();
    else if (b?.dataset.avbrott === 'stang') simuleraStangdFlik();
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

// Knappar och fält i innehållet stängs av. Läsfilter och reservinloggningen (data-las-ok), Logga ut, menyn och
// avbrottsraden lämnas.
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
  const knappar = [];
  if (meta && !meta.reserv && !minReserv) knappar.push('<button type="button" class="knapp liten" data-avbrott="reservkod">Välj reservkod</button>');
  if (avbrott.simulerat && meta && !meta.reserv) knappar.push('<button type="button" class="knapp liten sekundar" data-avbrott="stang">Stäng fliken (simulerat)</button>');
  if (avbrott.simulerat) knappar.push('<button type="button" class="knapp liten sekundar" data-avbrott="avsluta">Avsluta simulerat avbrott</button>');
  const patienter = meta ? (meta.patienter === 1 ? 'en patient' : `${meta.patienter} patienter`) : '';
  let rubrik;
  let text;
  if (meta?.reserv) {
    rubrik = 'Avbrott: läsläge med reservkod';
    text = `<p>Servern svarar inte. Du är inloggad med din reservkod och ser en läskopia från <strong data-laskopia-tid>${esc(tidpunkt(meta.skapad))}</strong>. Uppgifterna kan vara inaktuella: det som har ändrats efter den tiden syns inte.</p>
      <p>Allt skrivande är avstängt, eftersom inget kan sparas i journalen förrän servern svarar igen. Läskopian har arbetslistan och ${patienter}. Det du läser loggas krypterat på datorn och förs över till åtkomstloggen när förbindelsen är tillbaka, även om fliken stängs.</p>`;
  } else if (meta) {
    rubrik = 'Avbrott: läsläge';
    const om = minReserv
      ? `Du har en reservkopia på datorn som går ut ${esc(tidpunkt(minReserv.giltigTill))}, så du kommer in med reservkoden om fliken stängs.`
      : 'Stängs fliken eller startas webbläsaren om under avbrottet behövs en reservkod för att komma in igen.';
    text = `<p>Servern svarar inte. Du ser en läskopia från <strong data-laskopia-tid>${esc(tidpunkt(meta.skapad))}</strong>. Uppgifterna kan vara inaktuella: det som har ändrats efter den tiden syns inte.</p>
      <p>Allt skrivande är avstängt, eftersom inget kan sparas i journalen förrän servern svarar igen. Läskopian har arbetslistan och ${patienter}. Det du läser loggas här och skickas till åtkomstloggen när förbindelsen är tillbaka.</p>
      <p>${om}</p>`;
  } else {
    rubrik = 'Avbrott: servern svarar inte';
    const om = !S.session?.inloggad && antalReserv
      ? ' Har du valt en reservkod på den här datorn kan du logga in med den nedan och läsa din läskopia.'
      : '';
    text = `<p>Det finns ingen läskopia att visa i den här fliken. Läskopian görs när du är inloggad, gäller i 8 timmar och raderas när du loggar ut. Allt skrivande är avstängt tills förbindelsen är tillbaka.${om}</p>`;
  }
  el.innerHTML = `<div class="avbrott-inre">${ikon.varning}<div class="avbrott-text">
      <h2 id="avbrott-rubrik">${rubrik}</h2>${text}${sim}
    </div>${knappar.length ? `<div class="avbrott-knappar">${knappar.join('')}</div>` : ''}</div>`;
  el.hidden = false;
}

// Reservkopian för den inloggade och antalet reservkopior på datorn, i sidhuvudet och i avbrottsraden.
export async function uppdateraReservStatus() {
  const vem = S.session?.inloggad ? S.session.personal?.id : null;
  try {
    const alla = await reserv.lista();
    antalReserv = alla.length;
    minReserv = alla.find(r => r.personalId === vem) ?? null;
  } catch { antalReserv = 0; minReserv = null; }
  const t = document.querySelector('[data-reserv-text]');
  if (t) {
    t.textContent = minReserv ? `Reservkopia till ${klockslag(minReserv.giltigTill)}` : 'Reservkod';
    t.closest('button').title = minReserv ? `Du har en reservkopia på den här datorn som går ut ${tidpunkt(minReserv.giltigTill)}.` : 'Välj en reservkod för läsläget vid avbrott.';
  }
  if (avbrott.aktivt) visaRad();
}

// Dialogen för att välja, byta eller ta bort reservkoden.
export async function valjReservkod() {
  const vem = S.session?.inloggad ? S.session.personal : null;
  if (!vem) return;
  const finns = await reserv.forPerson(vem.id);
  const status = finns ? `<p class="ruta ruta-info">Du har en reservkopia på den här datorn. Den går ut ${esc(tidpunkt(finns.giltigTill))}.</p>` : '';
  if (kopia.arReserv()) {
    await dialog(`<div data-las-ok><h2 id="dlg-rubrik">${ikon.nyckel}Reservkod</h2>${status}
      <p>Du är inloggad med din reservkod. Den kan bytas när servern svarar igen.</p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="avbryt">Stäng</button></div></div>`);
    return;
  }
  const svar = await dialog(`<form data-las-ok autocomplete="off">
      <h2 id="dlg-rubrik">${ikon.nyckel}Reservkod för läsläget</h2>
      <div class="dialog-text">
        <p>Om servern inte svarar och fliken stängs, eller webbläsaren startas om, kommer du åt din läskopia igen med en reservkod. Den gäller bara på den här datorn och i den här webbläsaren, och raderas när du loggar ut.</p>
        <p>I vården gör SITHS-kortet och dess PIN-kod det här. I demon är kortet simulerat.</p>
      </div>${status}
      <div class="falt"><label for="dlg-kod">${finns ? 'Ny reservkod' : 'Reservkod'}</label><input id="dlg-kod" name="kod" type="password" autocomplete="off" maxlength="200" aria-describedby="dlg-kod-h" autofocus>
        <span class="hjalp" id="dlg-kod-h">Minst 6 siffror, eller en lösenfras på minst 12 tecken. Koden sparas inte någonstans, så spara den inte heller i webbläsaren. Efter 5 fel raderas reservkopian.</span></div>
      <div class="falt"><label for="dlg-kod2">Upprepa reservkoden</label><input id="dlg-kod2" name="kod2" type="password" autocomplete="off" maxlength="200"></div>
      <p class="dialog-fel form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="spara">Spara reservkod</button>${finns ? '<button type="button" class="knapp sekundar" data-varde="ta_bort">Ta bort reservkopian</button>' : ''}<button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
    </form>`, {
    validera: (d, _dl, varde) => {
      if (varde !== 'spara') return null;
      const fel = reserv.kontrolleraKod(d.kod);
      if (fel) return fel;
      return d.kod === d.kod2 ? null : 'Reservkoderna är inte lika.';
    },
  });
  if (!svar) return;
  const knapp = document.querySelector('[data-a="reservkod"]');
  knapp?.setAttribute('aria-busy', 'true');
  try {
    if (svar.val === 'ta_bort') {
      await reserv.taBort(vem.id);
      notis('Reservkopian är raderad från datorn.', 'info');
    } else {
      const vemText = { namn: vem.namn, titel: vem.titel, enhet: S.session.enhet?.namn ?? '' };
      let r;
      try { r = await reserv.skapa(svar.data.kod, vemText); } catch (e) {
        // Läskopian sparas strax efter inloggningen. Är den inte klar än hämtas den nu och försöket görs igen.
        if (e.kod !== 'ej_klar' || avbrott.aktivt) throw e;
        await fornyaNu();
        r = await reserv.skapa(svar.data.kod, vemText);
      }
      notis(`Reservkoden är sparad. Reservkopian går ut ${tidpunkt(r.giltigTill)}.`);
    }
  } catch (e) {
    notis(e.message || 'Reservkoden kunde inte sparas.', 'fel');
  } finally {
    svar.data.kod = null;
    svar.data.kod2 = null;
    knapp?.removeAttribute('aria-busy');
  }
  await uppdateraReservStatus();
}

// Reservinloggningen har öppnat en reservkopia (vyer/inloggning.js).
export async function oppnadMedReserv(m) {
  meta = m;
  S.session = m.session;
  await laddaEnheter().catch(() => {});
  visaRad();
  demoknappar();
  starta();
  await uppdateraReservStatus();
  notis(`Du är inloggad med reservkod. Läskopian är från ${tidpunkt(m.skapad)}.`, 'info');
  rita();
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
// Som när fliken stängs: flikens nyckel glöms och sidan laddas om. Avbrottet fortsätter att vara simulerat, så att
// reservinloggningen syns.
function simuleraStangdFlik() {
  kopia.glomFlik();
  location.reload();
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

// Personen loggade ut medan servern inte svarade. Nu när servern svarar skickas loggen och sessionen loggas ut där också.
export async function slutforUtloggning() {
  if (lsLas(SS_UTLOGGAD) !== '1') return false;
  if (!(await loggaUtPaServern())) return false;
  lsSkriv(SS_UTLOGGAD, null);
  await kopia.rensa();
  S.session = { inloggad: false };
  return true;
}

// Servern svarar igen: skicka åtkomsterna från läsläget, förnya sessionen och läskopian och rita om.
// Sessionen hämtas medan läsläget fortfarande gäller, så att inget görs mot servern innan det är klart vem som är
// inloggad. Fliken fortsätter bara som samma person som läskopian gällde: är någon annan, eller ingen, inloggad i
// webbläsarens session visas inloggningen.
async function aterga() {
  atergar = true;
  try {
    const res = await skickaLoggar().catch(() => null);
    if (res === null) return;
    const utloggad = lsLas(SS_UTLOGGAD) === '1';
    if (utloggad && !(await slutforUtloggning())) return;
    const forra = kopia.aktuell();
    let s = { inloggad: false };
    let annan = false;
    if (!utloggad) {
      try { s = await api('/api/session', { tyst: true, direkt: true }); } catch (e) { if (!e?.status) return; }
      // En inloggad patient eller en annan person i personalen tar inte över läsläget.
      if (forra && s.inloggad && s.personal?.id !== forra.personalId) { s = { inloggad: false }; annan = true; }
    }
    avbrott.aktivt = false;
    meta = null;
    kopia.stang();
    S.session = s;
    if (s.inloggad && s.personal) await kopia.satNyckel(s.lasnyckel, s.personal.id);
    else if (forra?.reserv) kopia.glomFlik();
    else await kopia.rensa();
    stoppa();
    visaRad();
    const antal = forra ? res.perKopia[forra.kopiaId] ?? 0 : 0;
    const loggen = antal ? ` och ${antal === 1 ? 'åtkomsten' : `de ${antal} åtkomsterna`} under avbrottet finns nu i åtkomstloggen` : '';
    const fortsatt = forra && !utloggad && !s.inloggad ? ` Logga in för att fortsätta${annan ? ', någon annan är inloggad i webbläsaren' : ''}.` : '';
    notis(`Servern svarar igen. Läsläget är avslutat${loggen}.${fortsatt}`);
    meddelaLogg({ ...res, mottagna: 0 });
    await uppdateraInkorg();
    rita();
    fornya({ nu: true });
    uppdateraReservStatus();
  } finally { atergar = false; }
}

// En annan flik har loggat ut. Flikar som hör till webbläsarens session, och ett läsläge med reservkod för samma
// person, avslutas: nyckeln och läskopian glöms och inloggningen visas.
function utloggadIAnnanFlik(personalId) {
  const a = kopia.aktuell();
  if (!S.session?.inloggad && !a) return;
  if (a?.reserv && a.personalId !== personalId) return;
  kopia.glomFlik();
  meta = null;
  minReserv = null;
  delete document.documentElement.dataset.laskopia;
  S.session = { inloggad: false };
  S.inkorg = null;
  if (avbrott.aktivt) visaRad();
  notis('Du är utloggad, eftersom någon loggade ut i en annan flik.', 'info');
  if (location.hash === '#/') rita(); else location.hash = '#/';
  uppdateraReservStatus();
}
const meddelaUtloggning = (personalId) => { try { kanal?.postMessage({ typ: 'utloggad', personalId }); } catch { /* kanalen är stängd */ } };

// Utloggning medan servern inte svarar: läskopian och personens reservkopia raderas direkt. Loggen från läsläget
// finns kvar krypterad tills den har skickats, och servern loggar ut sessionen när den svarar igen.
export async function loggaUtUnderAvbrott() {
  lsSkriv(SS_UTLOGGAD, '1');
  const vem = kopia.aktuell()?.personalId ?? S.session?.personal?.id;
  // Vid simulerat avbrott, eller om servern hinner svara, loggas sessionen ut direkt.
  const klar = await loggaUtPaServern();
  if (klar) lsSkriv(SS_UTLOGGAD, null);
  await kopia.rensa();
  if (vem) await reserv.taBort(vem);
  meddelaUtloggning(vem);
  meta = null;
  minReserv = null;
  await uppdateraReservStatus();
  visaRad();
  return klar;
}

// Hämtar en ny läskopia från servern och sparar den krypterad.
export async function fornyaNu() {
  const vem = S.session?.personal?.id;
  if (!vem || avbrott.aktivt || avbrott.simulerat) return;
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
}
// nu: direkt, annars högst en gång i minuten.
export function fornya({ nu = false } = {}) {
  if (avbrott.aktivt || avbrott.simulerat || !S.session?.inloggad) return;
  if (!nu && Date.now() - senastFornyad < 60_000) return;
  clearTimeout(fornyaTimer);
  fornyaTimer = setTimeout(() => fornyaNu(), nu ? 300 : 0);
}

// Vid utloggning och vid byte av person. Med personalId (vid utloggning) raderas också personens reservkopia, och
// webbläsarens andra flikar får veta att personen har loggat ut.
export async function rensa({ personalId = null } = {}) {
  delete document.documentElement.dataset.laskopia;
  await kopia.rensa();
  if (personalId) {
    await reserv.taBort(personalId);
    meddelaUtloggning(personalId);
  }
  minReserv = null;
}
