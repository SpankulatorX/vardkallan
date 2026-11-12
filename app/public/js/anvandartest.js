// Användartest (D6): testläget för en riktig användare. Uppgifterna visas en i taget i en list längst ner, och för
// varje uppgift räknas klick, fältbyten och tangenttryck med samma regler som klickbudgeten (anvandartest-rakning.js),
// tiden, om målet syntes på skärmen och om deltagaren behövde hjälp eller hoppade över uppgiften. Efter uppgifterna
// kommer en enkät med SUS och tre öppna frågor.
//
// Inget skickas till servern. Allt ligger i sessionStorage i den här fliken och rensas när testet avslutas.
// Resultatet visas i slutet och laddas ner som en JSON-fil eller kopieras som text. Testläget lyssnar bara på
// händelser när ett test pågår, så att det inte påverkar något annat.
import { esc, notis, ikon, vyRubrik, tidpunkt, tal, dialog, api } from './ui.js';
import { S, loggaIn, loggaUt, aterstallDemo, rita } from './app.js';
import { nyRakning, registrera, uppmatt } from './anvandartest-rakning.js';
import { FORMAT, UPPGIFTER, UPPGIFTSVERSION, STARTPUNKT, YRKESROLLER, ERFARENHET, OPPNA_FRAGOR } from './anvandartest-uppgifter.js';
import { SUS_PASTAENDEN, SUS_INSTRUKTION, SUS_SKALA, SUS_KALLA, susPoang } from './sus.js';

export const namn = 'anvandartest';

const NYCKEL = 'vk_anvandartest';
// Deltagarkoden är en kort kod som testledaren hittar på, till exempel L03. Sex siffror i rad avvisas, så att
// ett personnummer eller ett datum inte kan bli en kod.
const KODMONSTER = /^[A-Za-z0-9-]{1,12}$/;
const kodGiltig = (k) => KODMONSTER.test(k) && !/\d{6}/.test(k);

// Tillståndet. Speglas i sessionStorage, så att testet fortsätter om sidan laddas om.
let T = null;
const lasa = () => { try { return JSON.parse(sessionStorage.getItem(NYCKEL) ?? 'null'); } catch { return null; } };
const spara = () => { try { if (T) sessionStorage.setItem(NYCKEL, JSON.stringify(T)); } catch { /* fliken saknar lagring */ } };

const uppgift = (id) => UPPGIFTER.find(u => u.id === id);
const sek = (ms) => (ms == null ? '' : `${tal(ms / 1000, ms < 10000 ? 1 : 0)} s`);

// Händelserna översätts till enkla objekt som räkningen förstår. Varje element får ett nummer, så att ett klick i
// ett fält eller dess etikett kan kopplas till att fältet får fokus.
const nummer = new WeakMap();
let nastaNummer = 1;
const idFor = (el) => { if (!el) return null; let n = nummer.get(el); if (!n) { n = nastaNummer++; nummer.set(el, n); } return n; };
const TEXTTYPER = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);
const arTextfalt = (el) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXTTYPER.has(el.type)) || Boolean(el?.isContentEditable);
const KLICKBAR = 'a[href], button, summary, label, input, [role="button"], [role="link"], [role="tab"], [role="option"], [role="menuitem"], [role="checkbox"], [role="radio"]';
const kort = (s) => String(s ?? '').replace(/\(obligatoriskt\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
// Vad ett element heter, för stegloggen. För textfält används etiketten, aldrig det som har skrivits.
function beskriv(el) {
  if (!el) return '';
  if (arTextfalt(el) || el instanceof HTMLSelectElement) return kort(el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.getAttribute('placeholder') || el.name);
  return kort(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.value);
}
function malFor(t) {
  const el = t instanceof Element ? t : t?.parentElement;
  if (!el) return {};
  const textfalt = arTextfalt(el);
  const lista = el.closest('select');
  const kontroll = el.closest('label')?.control ?? null;
  const egen = kontroll && kontroll !== el && !el.closest('input, select, textarea') ? kontroll : null;
  const klickbart = el.closest(KLICKBAR) ?? (getComputedStyle(el).cursor === 'pointer' ? el : null);
  return {
    id: idFor(lista ?? el), textfalt, lista: Boolean(lista), etikettFor: egen ? idFor(egen) : null, etikettTillTextfalt: Boolean(egen && arTextfalt(egen)),
    klickbar: Boolean(klickbart), text: beskriv(textfalt ? el : lista ?? klickbart ?? el),
  };
}
// Bara händelser från användaren räknas (isTrusted). Undantaget är ett nytt värde i en rullgardinslista: ett
// hjälpmedel eller ett testskript (Playwrights selectOption) kan sätta värdet utan musklick, och gränssnittet
// skickar aldrig själv sådana händelser. Det räknas som ett listval, två klick, som i klickbudgeten.
function lyssna(e) {
  if (!T?.pagar) return;
  if (!e.isTrusted && !(e.type === 'change' && e.target instanceof HTMLSelectElement)) return;
  if (e.target instanceof Element && e.target.closest('#testlage')) return;
  const h = { typ: e.type, tid: Date.now(), mal: malFor(e.target), detail: e.detail };
  if (e.type === 'keydown') Object.assign(h, { tangent: e.key, iTextfalt: arTextfalt(e.target), iTextruta: e.target instanceof HTMLTextAreaElement, iLista: e.target instanceof HTMLSelectElement });
  registrera(T.pagar.rakning, h);
  spara();
}
let lyssnar = false;
function borjaLyssna() {
  if (lyssnar) return;
  lyssnar = true;
  for (const typ of ['pointerdown', 'click', 'focusin', 'keydown', 'change']) document.addEventListener(typ, lyssna, true);
}
function slutaLyssna() {
  if (!lyssnar) return;
  lyssnar = false;
  for (const typ of ['pointerdown', 'click', 'focusin', 'keydown', 'change']) document.removeEventListener(typ, lyssna, true);
}

// Målet för uppgiften: en notis eller ett element med en viss text, eventuellt på en viss adress.
function malSyns(k) {
  if (k.hash && !new RegExp(k.hash).test(location.hash)) return false;
  if (k.notis) return [...document.querySelectorAll('#notiser .notis')].some(n => n.textContent.includes(k.notis));
  if (k.sel) return [...document.querySelectorAll(k.sel)].some(el => el.offsetParent !== null && (!k.text || el.textContent.includes(k.text)));
  return false;
}
let kontrollTimer = null;
function kontrollera() {
  const p = T?.pagar;
  if (!p) return;
  if (p.malTid == null && malSyns(uppgift(p.id).kontroll)) { p.malTid = Date.now() - p.start; spara(); }
}

const vantaPa = (sel, ms = 15000) => new Promise((ja, nej) => {
  const t0 = Date.now();
  const titta = () => {
    if (document.querySelector(sel)) return ja();
    if (Date.now() - t0 > ms) return nej(new Error('Startsidan för uppgiften visades inte.'));
    setTimeout(titta, 100);
  };
  titta();
});

// Startpunkter som behöver ett läge som inte finns i seeden (runda 5, r4). Samma förberedelse som i
// test/flodessteg.cjs: demon återställs och Gunnar Åkessons Waran gör uppehåll med återinsättning i morgon.
const FORBERED = {
  'uppehall-waran': async () => {
    await aterstallDemo();
    const l = await api('/api/patient/p01/lakemedel');
    const w = l.ordinationer.find(o => o.lakemedel?.namn === 'Waran' && o.status === 'aktiv');
    const imorgon = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    if (w) await api(`/api/ordination/${w.id}/utsatt`, { metod: 'POST', data: { plan: { typ: 'uppehall', aterinsattning: imorgon } } });
  },
  // Demoläget med en remiss som en vårdhändelse hänger på, som i test/flodessteg.cjs.
  'remiss-vardhandelse': async () => {
    await aterstallDemo();
    await api('/api/demo/remiss-vardhandelse', { metod: 'POST', data: {} });
  },
  // Runda 6, r2: bara återställning, så att patienten är som i seeden.
  aterstall: async () => { await aterstallDemo(); },
  // Runda 7, r2: demoläget flyttar inloggningens tid så att varningen före utloggningen visas direkt.
  'inloggning-gar-ut': async () => { await aterstallDemo(); await api('/api/demo/inloggning-gar-ut', { metod: 'POST', data: { sekunder: 240 } }); },
  // Runda 9, r2: en simulerad monitor kopplas till Gunnar Åkesson, så att värden väntar på godkännande.
  'koppla-monitor': async () => { await aterstallDemo(); await api('/api/patient/p01/mt/koppla', { metod: 'POST', data: { streckkod: 'MT-MON-0001' } }); },
  // Runda 10, r4: Karl-Erik Brandt på hjärtintensiven har avlidit, så att förslaget om donation ligger i inkorgen.
  donation: async () => { await aterstallDemo(); await api('/api/demo/donation', { metod: 'POST', data: {} }); await api('/api/patient/p10/dodsfall', { metod: 'POST', data: { kriterier: 'direkta' } }); },
  // Runda 10, r7: en patient checkas in och betalar med kort, så att kassan har en betalning att göra dagsavslut på.
  'kassa-besok': async () => { await aterstallDemo(); await api('/api/demo/kassa-besok', { metod: 'POST', data: {} }); },
  // Runda 11, r3: demopatienterna för mödrahälsovården och förlossningen.
  obstetrik: async () => { await aterstallDemo(); await api('/api/demo/obstetrik', { metod: 'POST', data: {} }); },
  // Runda 11, r4: Annika Holmgrens kur är godkänd, så att beredningsenheten har en kur att bereda.
  'cytostatika-kur': async () => { await aterstallDemo(); await api('/api/demo/cytostatika-kur', { metod: 'POST', data: {} }); },
  // Runda 14, r1: övningstjänsten kopplas in av de två systemförvaltarna, och sedan loggas personen ut, så att uppgiften
  // börjar på inloggningssidan.
  inloggningstjanst: async () => {
    await aterstallDemo();
    const { tjanster } = await api('/api/inloggning/tjanster');
    if (!tjanster.length) {
      await loggaIn('sysf');
      const f = await api('/api/inloggningstjanster', { metod: 'POST', data: { ovning: true, motivering: 'Prövar inloggningen genom en extern inloggningstjänst.' } });
      await loggaIn('sysf-2');
      await api(`/api/inloggningstjanster/andring/${f.andring.id}/godkann`, { metod: 'POST', data: {} });
    }
    await loggaUt();
  },
};

// Uppgiften börjar på samma sätt som i skriptet: vid byte av demoroll loggas rollen in och demon återställs, så att
// patienterna är som i seeden. Sedan visas startsidan, och först därefter räknas stegen.
async function borjaUppgift(knapp) {
  const u = uppgift(T.uppgifter[T.index]);
  knapp.disabled = true;
  try {
    if (T.roll !== u.roll || S.session?.personal?.id !== u.roll) {
      await loggaIn(u.roll);
      await aterstallDemo();
      T.roll = u.roll;
    }
    const sp = STARTPUNKT[u.start];
    if (sp.forbered) await FORBERED[sp.forbered]();
    if (location.hash === sp.hash) await rita(); else location.hash = sp.hash;
    await vantaPa(sp.klar);
    document.getElementById('notiser').replaceChildren();
    T.pagar = { id: u.id, start: Date.now(), rakning: nyRakning(), hjalp: [], malTid: null };
    spara();
    kontrollTimer ??= setInterval(kontrollera, 250);
  } catch (e) {
    notis(e?.message || 'Uppgiften kunde inte startas.', 'fel');
  }
  ritaList();
}

function avslutaUppgift(status) {
  const p = T.pagar;
  kontrollera();
  const r = p.rakning;
  T.resultat.push({
    id: p.id, ordning: T.resultat.length + 1, status, malUppnatt: p.malTid != null,
    tidMs: Date.now() - p.start, tidTillMalMs: p.malTid, hjalp: p.hjalp.length, hjalpVidMs: p.hjalp,
    klick: r.klick, faltbyten: r.faltbyten, tangenter: r.tangenter, uppmatt: uppmatt(r), ovrigaKlick: r.ovrigaKlick, steg: r.steg,
  });
  T.pagar = null;
  T.index++;
  if (T.index >= T.uppgifter.length) {
    T.fas = 'enkat';
    clearInterval(kontrollTimer); kontrollTimer = null;
    slutaLyssna();
    spara();
    ritaList();
    loggaUt().then(() => { location.hash = '#/anvandartest'; });
    return;
  }
  spara();
  ritaList();
}

// Listen längst ner. Den visar uppgiften och knapparna, och inget annat.
function ritaList() {
  let el = document.getElementById('testlage');
  if (!T || T.fas !== 'uppgift') {
    el?.remove();
    document.body.classList.remove('testlage-aktivt');
    return;
  }
  if (!el) {
    el = document.createElement('section');
    el.id = 'testlage';
    el.className = 'testlage';
    el.setAttribute('aria-label', 'Användartest');
    document.body.append(el);
    el.addEventListener('click', listKlick);
    new ResizeObserver(() => document.documentElement.style.setProperty('--testlage-hojd', `${el.offsetHeight}px`)).observe(el);
  }
  document.body.classList.add('testlage-aktivt');
  const u = uppgift(T.uppgifter[T.index]);
  const nr = `Uppgift ${T.index + 1} av ${T.uppgifter.length}`;
  el.innerHTML = `<div class="testlage-inre">
    <p class="testlage-nr">${esc(nr)}</p>
    <p class="testlage-text" id="testlage-text" aria-live="polite">${esc(u.text)}</p>
    <div class="testlage-knappar">${T.pagar
      ? `<button type="button" class="knapp liten" data-t="klar">${ikon.bock}<span>Klar</span></button>
         <button type="button" class="knapp sekundar liten" data-t="hjalp">Hjälp behövdes${T.pagar.hjalp.length ? ` (${T.pagar.hjalp.length})` : ''}</button>
         <button type="button" class="knapp text liten" data-t="hoppa">Hoppa över</button>`
      : `<button type="button" class="knapp liten" data-t="borja">Börja uppgiften</button>
         <button type="button" class="knapp text liten" data-t="avbryt">Avbryt testet</button>`}</div>
  </div>`;
}

async function listKlick(e) {
  const b = e.target.closest('[data-t]');
  if (!b || !T) return;
  const t = b.dataset.t;
  if (t === 'borja') await borjaUppgift(b);
  else if (t === 'klar' && T.pagar) avslutaUppgift('klar');
  else if (t === 'hoppa' && T.pagar) avslutaUppgift('hoppade_over');
  else if (t === 'hjalp' && T.pagar) { T.pagar.hjalp.push(Date.now() - T.pagar.start); spara(); ritaList(); }
  else if (t === 'avbryt') {
    const svar = await dialog(`<h2 id="dlg-rubrik">Avbryta testet?</h2><p>Allt som har mätts i testet raderas. Inget har sparats någon annanstans.</p>
      <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-varde="ok">Avbryt och radera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Fortsätt testet</button></div>`);
    if (svar?.val === 'ok') await rensa({ loggaUt: true });
  }
}

// Testet avslutas: tillståndet raderas ur minnet och ur sessionStorage.
async function rensa({ loggaUt: ut = false } = {}) {
  T = null;
  try { sessionStorage.removeItem(NYCKEL); } catch { /* ingen lagring */ }
  clearInterval(kontrollTimer); kontrollTimer = null;
  slutaLyssna();
  ritaList();
  if (ut && S.session?.inloggad) await loggaUt();
  if (location.hash === '#/anvandartest') rita(); else location.hash = '#/anvandartest';
}

export function init() {
  T = lasa();
  if (!T || T.format !== FORMAT) { T = null; return; }
  if (T.fas === 'uppgift') {
    borjaLyssna();
    if (T.pagar) kontrollTimer ??= setInterval(kontrollera, 250);
  }
  ritaList();
}

async function starta(form, knapp) {
  const data = new FormData(form);
  const kod = String(data.get('deltagarkod') ?? '').trim();
  const valda = UPPGIFTER.filter(u => data.getAll('uppgift').includes(u.id)).map(u => u.id);
  const ruta = form.querySelector('.form-fel');
  const fel = !kodGiltig(kod) ? 'Deltagarkoden ska vara 1 till 12 bokstäver, siffror eller bindestreck, utan namn och utan sex siffror i rad.'
    : !valda.length ? 'Välj minst en uppgift.' : null;
  if (fel) { ruta.textContent = fel; ruta.hidden = false; return; }
  knapp.disabled = true;
  let version = { app: null, gransnitt: null };
  try {
    const h = await (await fetch('/api/health', { cache: 'no-store' })).json();
    version = { app: h.version ?? null, gransnitt: h.gransnitt ?? null };
  } catch { /* versionen blir okänd */ }
  T = {
    format: FORMAT, formatversion: 1, datum: new Date().toISOString(), deltagarkod: kod,
    version: { ...version, uppgifter: UPPGIFTSVERSION }, uppgifter: valda, index: 0, fas: 'uppgift', roll: null, pagar: null, resultat: [], enkat: null,
  };
  spara();
  borjaLyssna();
  ritaList();
  rita();
}

// Resultatet som det laddas ner. Uppgifter som inte valdes står som ej gjorda.
export function resultatfil(t = T) {
  const e = t.enkat ?? {};
  return {
    format: t.format, formatversion: t.formatversion, datum: t.datum, avslutad: e.tid ?? null, deltagarkod: t.deltagarkod, version: t.version,
    deltagare: { yrkesroll: e.yrkesroll ?? null, erfarenhet: e.erfarenhet ?? null },
    uppgifter: t.resultat, ejGjorda: UPPGIFTER.map(u => u.id).filter(id => !t.uppgifter.includes(id)),
    sus: { svar: e.sus ?? null, poang: susPoang(e.sus), kalla: SUS_KALLA },
    oppnaSvar: Object.fromEntries(OPPNA_FRAGOR.map(([k]) => [k, e.oppna?.[k] ?? ''])),
  };
}

const STATUSTEXT = { klar: 'Klar', hoppade_over: 'Hoppade över' };
const etikett = (lista, v) => lista.find(([k]) => k === v)?.[1] ?? '';

export function resultatText(r) {
  const rader = [
    'Användartest i Vårdkällan',
    `Deltagarkod: ${r.deltagarkod}`,
    `Datum: ${tidpunkt(r.datum)}`,
    `Version: app ${r.version.app ?? 'okänd'}, gränssnitt ${r.version.gransnitt ? r.version.gransnitt.slice(0, 12) : 'okänt'}, uppgifter ${r.version.uppgifter}`,
    `Yrkesroll: ${etikett(YRKESROLLER, r.deltagare.yrkesroll)}. Erfarenhet av journalsystem: ${etikett(ERFARENHET, r.deltagare.erfarenhet)}.`,
    '',
    'Uppgift | Status | Målet nåddes | Tid | Klick | Fältbyten | Tangenter | Summa | Hjälp',
    ...r.uppgifter.map(u => `${uppgift(u.id)?.namn ?? u.id} | ${STATUSTEXT[u.status]} | ${u.malUppnatt ? 'ja' : 'nej'} | ${sek(u.tidMs)} | ${u.klick} | ${u.faltbyten} | ${u.tangenter} | ${u.uppmatt} | ${u.hjalp}`),
    '',
    `SUS: ${r.sus.poang == null ? 'inga svar' : tal(r.sus.poang, 1)}`,
    ...OPPNA_FRAGOR.flatMap(([k, fraga]) => ['', fraga, r.oppnaSvar[k] || '(inget svar)']),
    '',
    'Resultatfil (JSON):',
    JSON.stringify(r, null, 2),
  ];
  return `${rader.join('\n')}\n`;
}

const filnamn = (r) => `anvandartest-${r.deltagarkod}-${r.datum.slice(0, 10)}.json`;

function laddaNer(r) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(r, null, 2)}\n`], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filnamn(r);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Vyn #/anvandartest: start, enkät eller resultat beroende på var testet är.
export async function visa(main) {
  if (!T) return visaStart(main);
  if (T.fas === 'enkat') return visaEnkat(main);
  if (T.fas === 'resultat') return visaResultat(main);
  main.innerHTML = vyRubrik('Användartest pågår') + `<div class="ruta ruta-info"><p>Uppgiften visas längst ner på skärmen. Tryck på Börja uppgiften när du har läst den.</p></div>`;
}

function visaStart(main) {
  main.innerHTML = vyRubrik('Användartest', 'Ett test av hur Vårdkällan fungerar för den som arbetar i vården. Deltagaren får några uppgifter, en i taget, och svarar efteråt på en kort enkät.') + `
    <div class="anvandartest">
      ${/* Runda 13, r1: den som testar på egen hand hänvisas till startsidan för testare. */ ''}
      <p class="ruta ruta-info at-ensam">Det här är ett lett test, där en testledare ger dig en deltagarkod och sitter bredvid. Testar du på egen hand passar <a href="#/testa">startsidan för testare</a> bättre: där väljer du yrke, får uppdragen och lämnar synpunkter direkt i systemet.</p>
      <section class="ruta at-info" aria-labelledby="at-info-rubrik">
        <h2 id="at-info-rubrik">Till deltagaren</h2>
        <p>Tack för att du vill vara med. Det är systemet som testas, inte du. Det finns inga fel svar, och det är lika värdefullt när något inte fungerar som när det gör det.</p>
        <p>Alla patienter i demon är påhittade. Inga uppgifter om dig samlas in, utöver din yrkesroll och hur länge du har arbetat med journalsystem. Du kan avbryta när du vill, utan att ange skäl.</p>
        <p>Uppgifterna visas en i taget längst ner på skärmen. Läs uppgiften, tryck på Börja uppgiften och gör den som du skulle göra i ditt arbete. Tryck på Klar när du tycker att du är klar, eller på Hoppa över om du inte vill fortsätta med uppgiften. Säg gärna högt vad du tänker medan du arbetar.</p>
      </section>
      <section class="ruta at-info" aria-labelledby="at-matning-rubrik">
        <h2 id="at-matning-rubrik">Vad som mäts</h2>
        <p>För varje uppgift räknas klick, fältbyten och tangenttryck på samma sätt som i klickbudgeten, tiden och om uppgiftens mål syntes på skärmen. Det som skrivs i fälten sparas inte. Inget skickas till servern. Resultatet finns bara i den här webbläsarfliken tills det laddas ner eller kopieras, och raderas när testet avslutas.</p>
        <p><a href="#/sussatest">Sussas testfall med SUS och expertgranskning</a> är formulären för att testa Vårdkällan på samma sätt som Cosmic testades i upphandlingen.</p>
      </section>
      <form id="at-start" class="ruta" novalidate>
        <h2>Starta testet</h2>
        <div class="falt"><label for="at-kod">Deltagarkod <span class="obl">(obligatoriskt)</span></label>
          <input id="at-kod" name="deltagarkod" type="text" maxlength="12" autocomplete="off" spellcheck="false" aria-describedby="at-kod-h" required>
          <span class="hjalp" id="at-kod-h">En kod som testledaren hittar på, till exempel L03 eller S12. Inte namn, initialer eller personnummer.</span></div>
        <fieldset class="at-uppgifter"><legend>Uppgifter</legend>
          <p class="hjalp">Välj de uppgifter som passar deltagarens yrkesroll. Rollen i demon står inom parentes.</p>
          ${UPPGIFTER.map(u => `<label class="val"><input type="checkbox" name="uppgift" value="${esc(u.id)}" checked> ${esc(u.namn)} <span class="dampad">(${esc(ROLLTEXT[u.roll] ?? u.roll)})</span></label>`).join('')}
        </fieldset>
        <p class="form-fel ruta ruta-larm liten" role="alert" hidden></p>
        <button type="submit" class="knapp">Starta testet</button>
      </form>
    </div>`;
  const form = main.querySelector('#at-start');
  form.addEventListener('submit', (e) => { e.preventDefault(); starta(form, form.querySelector('[type="submit"]')); });
}

const ROLLTEXT = { 'lak-kard': 'läkare, kardiologen', 'ssk-kard': 'sjuksköterska, avdelning 72', 'lak-vc': 'distriktsläkare, vårdcentral', 'lak-akut': 'läkare, akuten', 'adm-kard': 'vårdadministratör, kardiologen' };

function visaEnkat(main) {
  const radio = (namn, lista) => lista.map(([v, t]) => `<label class="val"><input type="radio" name="${namn}" value="${esc(v)}" required> ${esc(t)}</label>`).join('');
  main.innerHTML = vyRubrik('Enkät efter testet', 'Uppgifterna är klara. Svara på frågorna nedan. Det tar några minuter.') + `
    <form id="at-enkat" class="anvandartest" novalidate>
      <section class="ruta" aria-labelledby="at-bakgrund">
        <h2 id="at-bakgrund">Om dig</h2>
        <fieldset><legend>Din yrkesroll</legend>${radio('yrkesroll', YRKESROLLER)}</fieldset>
        <fieldset><legend>Hur länge har du arbetat med journalsystem?</legend>${radio('erfarenhet', ERFARENHET)}</fieldset>
      </section>
      <section class="ruta" aria-labelledby="at-sus">
        <h2 id="at-sus">Hur upplevde du systemet?</h2>
        <p>${esc(SUS_INSTRUKTION)}</p>
        <ol class="sus-lista">${SUS_PASTAENDEN.map((p, i) => `<li><fieldset class="sus"><legend>${esc(p)}</legend>
          <div class="sus-skala"><span class="sus-anda" aria-hidden="true">${esc(SUS_SKALA[1])}</span>
          ${[1, 2, 3, 4, 5].map(v => `<label class="sus-val"><input type="radio" name="sus${i + 1}" value="${v}" required><span>${v}<span class="sr">${SUS_SKALA[v] ? `, ${esc(SUS_SKALA[v])}` : ''}</span></span></label>`).join('')}
          <span class="sus-anda" aria-hidden="true">${esc(SUS_SKALA[5])}</span></div></fieldset></li>`).join('')}</ol>
        <p class="dampad liten">Enkäten är System Usability Scale (SUS). Källa: ${esc(SUS_KALLA)}.</p>
      </section>
      <section class="ruta" aria-labelledby="at-oppna">
        <h2 id="at-oppna">Med egna ord</h2>
        <p class="hjalp">Skriv inga namn eller andra personuppgifter, varken om dig själv, kollegor eller patienter.</p>
        ${OPPNA_FRAGOR.map(([k, f]) => `<div class="falt"><label for="at-${k}">${esc(f)}</label><textarea id="at-${k}" name="${k}" rows="3" maxlength="2000"></textarea></div>`).join('')}
      </section>
      <p class="form-fel ruta ruta-larm liten" role="alert" hidden></p>
      <button type="submit" class="knapp">Spara svaren och visa resultatet</button>
    </form>`;
  const form = main.querySelector('#at-enkat');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const sus = SUS_PASTAENDEN.map((_, i) => (d.get(`sus${i + 1}`) == null ? null : Number(d.get(`sus${i + 1}`))));
    const ruta = form.querySelector('.form-fel');
    const saknas = [!d.get('yrkesroll') && 'yrkesroll', !d.get('erfarenhet') && 'erfarenhet', sus.some(v => v == null) && `påstående ${sus.map((v, i) => (v == null ? i + 1 : null)).filter(Boolean).join(', ')}`].filter(Boolean);
    if (saknas.length) { ruta.textContent = `Svar saknas: ${saknas.join('; ')}.`; ruta.hidden = false; ruta.focus?.(); return; }
    T.enkat = {
      tid: new Date().toISOString(), yrkesroll: d.get('yrkesroll'), erfarenhet: d.get('erfarenhet'), sus,
      oppna: Object.fromEntries(OPPNA_FRAGOR.map(([k]) => [k, String(d.get(k) ?? '').trim()])),
    };
    T.fas = 'resultat';
    spara();
    rita();
  });
}

function visaResultat(main) {
  const r = resultatfil();
  main.innerHTML = vyRubrik('Resultat av användartestet', `Deltagare ${esc(r.deltagarkod)}, ${esc(tidpunkt(r.datum))}.`) + `
    <div class="anvandartest">
      <div class="ruta ruta-info"><p>Resultatet finns bara i den här webbläsarfliken. Ladda ner filen eller kopiera texten och lämna den till testledaren innan testet avslutas. Inget har skickats till servern.</p></div>
      <div class="tabellrulle"><table class="tabell siffertabell at-tabell">
        <caption>Uppgifter</caption>
        <thead><tr><th scope="col">Uppgift</th><th scope="col">Status</th><th scope="col">Målet nåddes</th><th scope="col" class="tal">Tid</th><th scope="col" class="tal">Klick</th><th scope="col" class="tal">Fältbyten</th><th scope="col" class="tal">Tangenter</th><th scope="col" class="tal">Summa</th><th scope="col" class="tal">Hjälp</th></tr></thead>
        <tbody>${r.uppgifter.map(u => `<tr data-uppgift="${esc(u.id)}"><th scope="row">${esc(uppgift(u.id)?.namn ?? u.id)}</th><td>${esc(STATUSTEXT[u.status])}</td><td>${u.malUppnatt ? 'Ja' : 'Nej'}</td>
          <td class="tal">${esc(sek(u.tidMs))}</td><td class="tal">${u.klick}</td><td class="tal">${u.faltbyten}</td><td class="tal">${u.tangenter}</td><td class="tal"><strong>${u.uppmatt}</strong></td><td class="tal">${u.hjalp}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="at-sus-poang">SUS-poäng: <strong data-sus>${r.sus.poang == null ? 'inga svar' : esc(tal(r.sus.poang, 1))}</strong> av 100</p>
      <div class="at-knappar">
        <button type="button" class="knapp" data-r="ladda">Ladda ner resultatfil</button>
        <button type="button" class="knapp sekundar" data-r="kopiera">Kopiera som text</button>
        <button type="button" class="knapp text" data-r="avsluta">Avsluta och rensa</button>
      </div>
      <div class="falt at-kopia" hidden><label for="at-text">Resultatet som text</label><textarea id="at-text" rows="12" readonly></textarea></div>
    </div>`;
  main.querySelector('.at-knappar').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    if (b.dataset.r === 'ladda') laddaNer(r);
    else if (b.dataset.r === 'kopiera') {
      const text = resultatText(r);
      const ruta = main.querySelector('.at-kopia');
      ruta.querySelector('textarea').value = text;
      ruta.hidden = false;
      try { await navigator.clipboard.writeText(text); notis('Resultatet är kopierat.'); } catch {
        ruta.querySelector('textarea').select();
        notis('Texten kunde inte kopieras automatiskt. Markera den i rutan och kopiera den.', 'info');
      }
    } else if (b.dataset.r === 'avsluta') {
      const svar = await dialog(`<h2 id="dlg-rubrik">Avsluta testet?</h2><p>Resultatet raderas ur webbläsaren. Har du laddat ner eller kopierat det?</p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta och rensa</button><button type="button" class="knapp sekundar" data-varde="avbryt">Tillbaka till resultatet</button></div>`);
      if (svar?.val === 'ok') { await rensa(); notis('Testet är avslutat och resultatet är raderat ur webbläsaren.', 'info'); }
    }
  });
}
