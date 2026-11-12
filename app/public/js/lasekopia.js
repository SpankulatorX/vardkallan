// Läskopian för avbrott (D4): en krypterad kopia i webbläsaren av det servern redan har lämnat ut till den inloggade,
// alltså arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten,
// läkemedlen och de senaste anteckningarna. Servern bygger kopian med samma behörighetskontroll som vanliga anrop
// (GET /api/lasekopia). Här lagras den bara, krypterad, och läses när servern inte svarar.
//
// Kryptering: AES-GCM med 256 bitars nyckel genom Web Crypto. Nyckeln skapas av servern vid inloggningen, byts vid
// varje ny inloggning och gäller i 8 timmar. Den har ett id, läskopians id. I webbläsaren finns nyckeln i minnet som en
// CryptoKey som inte kan exporteras, och i sessionStorage för den här fliken, så att läsläget fungerar också om sidan
// laddas om under avbrottet. Nyckeln lagras aldrig i klartext i IndexedDB. Där ligger bara chiffertexten, slumpad IV och
// metadata (vem, vilken läskopia, när kopian skapades och hur länge nyckeln gäller). Metadata är bunden till
// chiffertexten som additional data, så ändrad metadata gör att dekrypteringen misslyckas och kopian kastas.
//
// Reservkopian (reservkopia.js) är samma chiffertext, sparad per person tillsammans med nyckeln inslagen med en nyckel
// som härleds ur personens reservkod. Med den går läsläget att öppna i en ny flik eller efter en omstart av webbläsaren.
//
// Loggen från läsläget: varje läsning sparas som en egen rad i IndexedDB, krypterad med läskopians nyckel. Raden kan
// skickas till servern utan nyckel och utan inloggning, eftersom servern har nyckeln och själv dekrypterar och
// kontrollerar raden (POST /api/lasekopia/krypterad-logg). Därför överlever loggen att fliken stängs.
//
// Det skyddar mot:
//   att någon läser webbläsarens lagrade filer (IndexedDB på disken) efter att fliken är stängd, till exempel på en
//   delad eller stulen dator, eftersom sessionStorage och nyckeln försvinner med fliken (reservkopian kräver koden);
//   att nästa person som loggar in i samma webbläsare läser föregående persons kopia, eftersom kopian raderas vid
//   utloggning och varje inloggning får en ny nyckel;
//   att en gammal kopia används, eftersom kopian kastas efter 8 timmar;
//   att loggrader förfalskas för en annan person, eftersom bara den som har läskopians nyckel kan skapa dem.
//
// Det skyddar inte mot:
//   skadlig kod som körs i sidan (XSS) eller i webbläsaren medan fliken är öppen, eftersom den kan använda nyckeln;
//   någon som sitter vid en olåst dator medan personen är inloggad;
//   skadeprogram på datorn medan fliken lever: webbläsaren kan skriva sessionStorage till disken för att kunna
//   återställa flikar, och nyckeln finns i minnet;
//   att webbläsaren återställer en stängd flik eller session: då kan flikens nyckel komma tillbaka, precis som
//   sessionskakan, och läsläget öppnas utan reservkod;
//   att den som har datorn raderar rader i loggen innan de har skickats (utlämnandet till läskopian loggas alltid);
//   skärmdumpar och utskrifter. Kopian ersätter inte diskkryptering och en låst skärm.
import { ApiFel } from './ui.js';

const DB = 'vardkallan-lasekopia';
// Runda 10, r1: version 3 har förrådet ko för skrivkön.
const DB_VERSION = 3;
const SS_NYCKEL = 'vk_lasnyckel';
export const MAX_ALDER_MS = 8 * 3600_000;

let nyckel = null;     // CryptoKey, går inte att exportera
let info = null;       // { giltigTill, personalId, kopiaId }
let kopia = null;      // den dekrypterade kopian, bara i minnet medan läsläget pågår
let medReserv = false; // kopian öppnades med reservkod
let kedja = Promise.resolve();

export const franB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export function tillB64(b) {
  const u = new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const ss = {
  las: () => { try { return JSON.parse(sessionStorage.getItem(SS_NYCKEL) || 'null'); } catch { return null; } },
  skriv: (v) => { try { sessionStorage.setItem(SS_NYCKEL, JSON.stringify(v)); } catch { /* privat läge */ } },
  ta: () => { try { sessionStorage.removeItem(SS_NYCKEL); } catch { /* privat läge */ } },
};

// Tre förråd: poster (fliken läskopia, id 'kopia'), reserv (reservkopior, en per person) och logg (en rad per läsning).
function oppnaDb() {
  return new Promise((ja, nej) => {
    const r = indexedDB.open(DB, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('poster')) db.createObjectStore('poster', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('reserv')) db.createObjectStore('reserv', { keyPath: 'personalId' });
      if (!db.objectStoreNames.contains('logg')) db.createObjectStore('logg', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ko')) db.createObjectStore('ko', { keyPath: 'id' });
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ja(r.result); };
    r.onerror = () => nej(r.error);
  });
}
async function forrad(namn, lage, fn) {
  const db = await oppnaDb();
  try {
    return await new Promise((ja, nej) => {
      const tx = db.transaction(namn, lage);
      const r = fn(tx.objectStore(namn));
      tx.oncomplete = () => ja(r?.result);
      tx.onerror = () => nej(tx.error);
      tx.onabort = () => nej(tx.error);
    });
  } finally { db.close(); }
}
// Lagringen för reservkopia.js. andra läser och skriver en post i samma transaktion.
export const lagring = {
  hamta: (namn, id) => forrad(namn, 'readonly', s => s.get(id)),
  alla: (namn) => forrad(namn, 'readonly', s => s.getAll()),
  spara: (namn, post) => forrad(namn, 'readwrite', s => s.put(post)),
  taBort: (namn, id) => forrad(namn, 'readwrite', s => s.delete(id)),
  andra: (namn, id, fn) => forrad(namn, 'readwrite', s => {
    const q = s.get(id);
    q.onsuccess = () => { const ny = q.result ? fn(q.result) : null; if (ny) s.put(ny); };
    return q;
  }),
};
const hamtaPost = (id) => lagring.hamta('poster', id);
const sparaPost = (post) => lagring.spara('poster', post);
const taBortPost = (id) => lagring.taBort('poster', id);

const importera = (b64) => crypto.subtle.importKey('raw', franB64(b64), 'AES-GCM', false, ['encrypt', 'decrypt']);
const aad = (p) => new TextEncoder().encode(`vardkallan-lasekopia|${p.id}|${p.kopiaId}|${p.personalId}|${p.skapad}|${p.giltigTill}`);
async function kryptera(meta, varde) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(meta) }, nyckel, new TextEncoder().encode(JSON.stringify(varde)));
  return { ...meta, iv, data };
}
async function dekryptera(post, k = nyckel) {
  const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: post.iv, additionalData: aad(post) }, k, post.data);
  return JSON.parse(new TextDecoder().decode(klar));
}
export const utgangen = (post, nu = Date.now()) => !post || nu >= Date.parse(post.giltigTill) || nu - Date.parse(post.skapad) >= MAX_ALDER_MS;
const giltig = (post) => post && info && post.personalId === info.personalId && post.kopiaId === info.kopiaId && !utgangen(post);

// Nyckeln från servern ({ id, nyckel, giltigTill }) för den inloggade. Ger { reservBorttagen } när personen hade en
// reservkopia från en tidigare inloggning: den går inte att förnya utan reservkoden och tas bort.
export async function satNyckel(lasnyckel, personalId) {
  if (!lasnyckel?.nyckel || !personalId) return {};
  const ny = { nyckel: lasnyckel.nyckel, id: lasnyckel.id, giltigTill: lasnyckel.giltigTill, personalId };
  const forra = ss.las();
  if (nyckel && forra?.nyckel === ny.nyckel && info?.personalId === personalId) return {};
  // En ny nyckel betyder en ny inloggning. En kopia som är krypterad med den gamla nyckeln går inte att läsa och tas bort.
  if (forra && forra.nyckel !== ny.nyckel) await rensa();
  let reservBorttagen = false;
  try {
    const r = await lagring.hamta('reserv', personalId);
    if (r && r.kopiaId !== ny.id) { await lagring.taBort('reserv', personalId); reservBorttagen = true; }
  } catch { /* IndexedDB saknas */ }
  nyckel = await importera(ny.nyckel);
  info = { giltigTill: ny.giltigTill, personalId, kopiaId: ny.id };
  medReserv = false;
  ss.skriv(ny);
  return { reservBorttagen };
}

// Läser in nyckeln från sessionStorage, när sidan har laddats om under ett avbrott.
async function nyckelFranFlik() {
  if (nyckel) return true;
  const n = ss.las();
  if (!n?.nyckel || !n.id || Date.now() >= Date.parse(n.giltigTill)) return false;
  nyckel = await importera(n.nyckel);
  info = { giltigTill: n.giltigTill, personalId: n.personalId, kopiaId: n.id };
  return true;
}

// Sparar en ny kopia från GET /api/lasekopia. Kopians session innehåller inte nyckeln. Har personen en reservkopia
// från samma inloggning förnyas den också. Det behöver inte reservkoden, eftersom nyckeln är densamma.
export async function spara(ny) {
  if (!nyckel || medReserv || ny?.session?.personal?.id !== info?.personalId || ny.kopiaId !== info.kopiaId) return null;
  const meta = { id: 'kopia', kopiaId: info.kopiaId, personalId: info.personalId, skapad: ny.skapad, giltigTill: ny.giltigTill < info.giltigTill ? ny.giltigTill : info.giltigTill };
  // Datorns klocka när kopian hämtades, så att åldern på läkemedelsuppgifterna i läsläget mäts med samma klocka hela
  // vägen och blir rätt även om datorns klocka går fel mot serverns.
  const post = await kryptera(meta, { ...ny, hamtadLokalt: new Date().toISOString() });
  await sparaPost(post);
  await lagring.andra('reserv', info.personalId, r => (r.kopiaId === post.kopiaId ? { ...r, kopia: post } : null)).catch(() => {});
  return meta.skapad;
}

// Öppnar fliken läskopia för läsläget. Ger { skapad, session, patienter } eller null när ingen användbar kopia finns.
export async function oppna() {
  if (!(await nyckelFranFlik())) return null;
  const post = await hamtaPost('kopia');
  if (!post) return null;
  if (!giltig(post)) { await taBortPost('kopia'); return null; }
  try { kopia = await dekryptera(post); } catch { await taBortPost('kopia'); return null; }
  await tillampaKo();
  return { skapad: kopia.skapad, session: { ...kopia.session, inloggad: true }, patienter: Object.keys(kopia.patienter).length };
}

// Öppnar en reservkopia med nyckeln som reservkoden låste upp (reservkopia.js). Nyckeln kan inte exporteras och finns
// bara i minnet, så en omladdning av sidan kräver koden igen.
export async function oppnaMedReserv(k, i, post) {
  if (post?.personalId !== i.personalId || post?.kopiaId !== i.kopiaId || utgangen(post)) throw new Error('Reservkopian gäller inte.');
  const v = await dekryptera(post, k);
  nyckel = k;
  info = { ...i };
  kopia = v;
  medReserv = true;
  await tillampaKo();
  return { skapad: v.skapad, session: { ...v.session, inloggad: true, reserv: true }, patienter: Object.keys(v.patienter).length, reserv: true };
}

// Hur gammal läkemedelsdelen för en patient är i den öppna läskopian (Sussa 11.2.1.8): { tid, ms, maxMs, gammal },
// eller null när ingen kopia är öppen eller patienten saknar läkemedelsdel. tid är serverns tid när uppgifterna lästes
// ur journalen. Åldern är tiden sedan kopian hämtades, mätt med datorns klocka, plus hur gammal delen redan var då.
export function lakemedelsalder(patientId, nu = Date.now()) {
  const del = kopia?.patienter?.[patientId]?.lakemedelsdel;
  if (!del?.tid) return null;
  const hamtad = Date.parse(kopia.hamtadLokalt ?? kopia.skapad);
  const ms = Math.max(0, nu - hamtad + Date.parse(kopia.skapad) - Date.parse(del.tid));
  const maxMs = kopia.fornyas?.lakemedelMaxMs ?? 10 * 60_000;
  return { tid: del.tid, ms, maxMs, gammal: ms > maxMs };
}
// Den äldsta läkemedelsdelen i den öppna läskopian och hur många patienter som har en, för avbrottsraden.
export function aldstaLakemedel(nu = Date.now()) {
  const alla = Object.keys(kopia?.patienter ?? {}).map(id => lakemedelsalder(id, nu)).filter(Boolean);
  if (!alla.length) return null;
  return { ...alla.reduce((a, b) => (b.ms > a.ms ? b : a)), patienter: alla.length, gamla: alla.filter(a => a.gammal).length };
}

export const stang = () => { kopia = null; };
export const harKopia = () => Boolean(kopia);
export const arReserv = () => medReserv;
export const aktuell = () => (info ? { ...info, reserv: medReserv } : null);

// Glömmer nyckeln i den här fliken, men låter IndexedDB vara. Som när fliken stängs.
export function glomFlik() {
  kopia = null; nyckel = null; info = null; medReserv = false;
  ss.ta();
}

// Underlaget för att skapa en reservkopia: nyckeln i klartext från fliken, så att den kan slås in med reservkoden,
// och fliken läskopia. Finns bara för den som är inloggad i fliken, inte i läsläge med reservkod.
export async function underlagForReserv() {
  const n = ss.las();
  if (!nyckel || medReserv || !n?.nyckel || !info || n.id !== info.kopiaId || n.personalId !== info.personalId) return null;
  const post = await hamtaPost('kopia');
  if (!giltig(post)) return null;
  try { await dekryptera(post); } catch { return null; }
  return { radNyckel: franB64(n.nyckel), info: { ...info }, post };
}

// Raderar fliken läskopia och nyckeln. Loggen från läsläget och reservkopiorna lämnas, de tas bort för sig.
export async function rensa() {
  glomFlik();
  await kedja.catch(() => {});
  try {
    await taBortPost('kopia');
    await taBortPost('logg');
  } catch { /* IndexedDB saknas */ }
}

// Åtkomstloggen i läsläget. Varje rad krypteras för sig med läskopians nyckel och sparas tills servern har tagit emot
// den. Metadata i klartext är bara radens id och läskopians id.
const loggAad = (kopiaId, personalId, id) => new TextEncoder().encode(`vardkallan-laslogg|${kopiaId}|${personalId}|${id}`);
function loggaLokalt(rad) {
  const k = nyckel;
  const i = info;
  kedja = kedja.then(async () => {
    if (!k || !i?.kopiaId) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: loggAad(i.kopiaId, i.personalId, rad.id) }, k, new TextEncoder().encode(JSON.stringify(rad)));
    await lagring.spara('logg', { id: rad.id, kopiaId: i.kopiaId, iv, data });
  }).catch(e => console.warn('Åtkomsten i läsläget kunde inte loggas lokalt:', e));
  return kedja;
}
// Alla rader som väntar på att skickas, för alla läskopior på datorn.
export async function vantandeLoggar() {
  await kedja;
  try { return await lagring.alla('logg'); } catch { return []; }
}
export async function taBortLoggar(ids) {
  if (!ids.length) return;
  await forrad('logg', 'readwrite', s => { for (const id of ids) s.delete(id); });
}
// Raderna för läskopian i den här fliken, dekrypterade.
export async function hamtaLogg() {
  await kedja;
  if (!(await nyckelFranFlik())) return [];
  const ut = [];
  for (const r of await vantandeLoggar()) {
    if (r.kopiaId !== info.kopiaId) continue;
    try {
      const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv, additionalData: loggAad(r.kopiaId, info.personalId, r.id) }, nyckel, r.data);
      ut.push(JSON.parse(new TextDecoder().decode(klar)));
    } catch { /* inte den här personens rad */ }
  }
  return ut.sort((a, b) => a.tid.localeCompare(b.tid));
}

const SAKNAS = 'Det här finns inte i läskopian. Under avbrottet går det att läsa arbetslistan och, för patienterna i läskopian, patienthuvudet, översikten, läkemedlen, mätvärdena, remisserna och de senaste anteckningarna.';
const ej = (fel, kod = 'ej_i_laskopian') => new ApiFel(0, { fel, kod });

// Besvarar ett anrop från läskopian, i samma form som servern. Varje läsning av patientuppgifter loggas lokalt.
// Runda 10, r1: en dos eller ett mätvärde som gränssnittet skickar med ko läggs i skrivkön. Allt annat skrivande stoppas.
export function svara(vag, metod = 'GET', { data, ko = false } = {}) {
  if (metod !== 'GET') {
    if (ko && kopia) return koa(decodeURI(vag.split('?')[0]), data);
    throw ej('Under avbrottet går det inte att spara eller ändra något, eftersom det inte skulle nå journalen. Vänta tills förbindelsen är tillbaka.', 'laslage');
  }
  if (!kopia) throw ej('Servern svarar inte, och det finns ingen läskopia i den här fliken. Vänta tills förbindelsen är tillbaka.', 'natverk');
  const p = decodeURI(vag.split('?')[0]);
  const ut = (v) => structuredClone(v);
  const logga = (patientId, handling) => loggaLokalt({ id: crypto.randomUUID(), tid: new Date().toISOString(), patientId, handling, resurs: p });
  if (p === '/api/session') return ut({ ...kopia.session, inloggad: true, ...(medReserv ? { reserv: true } : {}) });
  if (p === '/api/arbetslista') return ut(kopia.arbetslista);
  if (p === '/api/mallar') return ut(kopia.mallar);
  if (p === '/api/enheter') return ut(kopia.enheter);
  let m = p.match(/^\/api\/patient\/([\w-]+)(?:\/([a-z]+))?$/);
  if (m) {
    const post = kopia.patienter[m[1]];
    if (!post) throw ej('Patienten finns inte i läskopian. Bara patienterna på arbetslistan och de som du har öppnat under inloggningen kopieras.');
    const del = m[2];
    if (!del) { logga(m[1], post.handling); return ut(post.huvud); }
    if (del === 'oversikt') { logga(m[1], post.handling); return ut(post.oversikt); }
    // Läkemedelsdelen: servern säger vilka delar den har och med vilken läshandling de loggas, så att en ny del som
    // administreringar inte behöver något nytt här. En kopia från en äldre version har bara läkemedelslistan.
    const lm = post.lakemedelsdel?.delar ?? (post.lakemedel ? { lakemedel: 'las_lakemedel' } : {});
    if (Object.hasOwn(lm, del) && post[del]) { logga(m[1], lm[del]); return ut(post[del]); }
    // Runda 10, r1: mätvärdena och remisserna, med den läshandling som servern anger.
    const jd = post.journaldel?.delar ?? {};
    if (Object.hasOwn(jd, del) && post[del]) { logga(m[1], jd[del]); return ut(post[del]); }
    if (del === 'anteckningar' && post.anteckningar) {
      logga(m[1], kopia.session.behorigheter?.includes('las_journal') ? 'las_journal' : 'las_omvardnad');
      return ut(post.anteckningar);
    }
    throw ej(SAKNAS);
  }
  m = p.match(/^\/api\/anteckning\/(\d+)$/);
  if (m) {
    for (const [pid, post] of Object.entries(kopia.patienter)) {
      const a = post.anteckning?.[m[1]];
      if (a) { logga(pid, a.kategori === 'omvardnad' ? 'las_omvardnad' : 'las_journal'); return ut(a); }
    }
    throw ej('Anteckningen finns inte i läskopian. Bara de senaste anteckningarna kopieras.');
  }
  throw ej(SAKNAS);
}

// ---------------------------------------------------------------------------------------------------------------
// Runda 10, r1: skrivkön (Sussa 2.3.1.4). Under ett avbrott kan en dos ges och ett mätvärde registreras för en patient i
// läskopian. Registreringen krypteras med läskopians nyckel, med radens id, läskopians id och personen som additional
// data, och sparas i förrådet ko tills servern har tagit emot den (POST /api/skrivko, skrivko.js). Servern har nyckeln
// och dekrypterar själv, så kön kan skickas också efter att fliken har stängts, av samma person i samma webbläsare.
// I läskopian märks registreringen som inte sparad i journalen, så att ingen tror att den redan finns där.
// Metadata i klartext är bara radens id, läskopians id och när raden skapades.
const koAad = (kopiaId, personalId, id) => new TextEncoder().encode(`vardkallan-skrivko|${kopiaId}|${personalId}|${id}`);
const KOBARA = [
  { re: /^\/api\/patient\/([\w-]+)\/matvarden$/, typ: 'matvarde', handling: 'registrera_matvarde' },
  { re: /^\/api\/patient\/([\w-]+)\/administreringar$/, typ: 'dos', handling: 'ge_lakemedel' },
];
const harRatt = (h) => (kopia?.session?.behorigheter ?? []).includes(h);
const vem = () => ({ id: kopia.session.personal?.id, namn: kopia.session.personal?.namn });

// Visar en registrering i kön i den öppna läskopian, så att dosen inte ges igen och värdet syns i listan.
function tillampa(rad) {
  const post = kopia?.patienter?.[rad.patientId];
  if (!post) return null;
  if (rad.typ === 'matvarde') {
    const lista = post.matvarden?.matvarden;
    if (!lista) return null;
    const t = post.matvarden.typer?.[rad.data.typ] ?? null;
    const m = { id: `ko-${rad.id}`, typ: rad.data.typ, namn: t?.namn ?? rad.data.typ, varde: rad.data.varde, enhet: t?.enhet ?? '', tid: rad.gjord,
      vardenhet: { namn: kopia.session.enhet?.namn ?? '' }, registreradAv: vem(), ejSparad: true };
    if (!lista.some(x => x.id === m.id)) lista.unshift(m);
    return m;
  }
  const a = post.administreringar;
  if (!a) return null;
  const adm = { status: 'given', tid: rad.gjord, utfordAv: vem(), ejSparad: true };
  const d = rad.data.planerad ? (a.doser ?? []).find(x => x.ordinationId === rad.data.ordinationId && x.planerad === rad.data.planerad) : null;
  if (d) { d.status = 'given'; d.forslag = null; d.administrering = adm; return { ...adm, lakemedel: d.lakemedel }; }
  const v = [...(a.vidBehov ?? []), ...(a.utanTider ?? [])].find(x => x.ordinationId === rad.data.ordinationId);
  if (v) { v.senaste = adm; v.kanGesNu = false; if (Array.isArray(v.givnaIdag)) v.givnaIdag.push(adm); return { ...adm, lakemedel: v.lakemedel }; }
  return adm;
}

// Lägger en registrering i kön. Ger ett svar i samma form som servern, märkt koad och ejSparad.
async function koa(p, data) {
  const k = KOBARA.find(x => x.re.test(p));
  if (!k) throw ej('Under avbrottet går det bara att ge doser och registrera mätvärden. Allt annat väntar tills förbindelsen är tillbaka.', 'laslage');
  const pid = p.match(k.re)[1];
  if (!kopia.patienter[pid]) throw ej('Patienten finns inte i läskopian, så registreringen kan inte sparas under avbrottet.');
  if (!harRatt(k.handling)) throw ej('Din yrkesroll får inte göra det här.', 'nekad');
  const gjord = typeof data?.tid === 'string' && Number.isFinite(Date.parse(data.tid)) && Date.parse(data.tid) <= Date.now() ? new Date(Date.parse(data.tid)).toISOString() : new Date().toISOString();
  let innehall;
  if (k.typ === 'matvarde') {
    if (!data?.typ || data.varde == null || data.varde === '') throw ej('Ange mätvärdet.', 'ogiltig');
    innehall = { typ: data.typ, varde: data.varde };
  } else {
    if ((data?.atgard ?? 'ge') !== 'ge' || !Number.isInteger(data?.ordinationId)) throw ej('Under avbrottet går det bara att registrera att en ordinerad dos ges.', 'laslage');
    const doser = kopia.patienter[pid].administreringar?.doser ?? [];
    const d = data.planerad ? doser.find(x => x.ordinationId === data.ordinationId && x.planerad === data.planerad) : null;
    if (d && ['given', 'overlamnad'].includes(d.status)) throw ej(`Dosen är redan registrerad som ${d.status === 'given' ? 'given' : 'överlämnad'}${d.administrering?.ejSparad ? ' i kön på den här datorn' : ''}. Ges den igen får patienten dubbel dos.`, 'ogiltig');
    innehall = { ordinationId: data.ordinationId, ...(data.planerad ? { planerad: data.planerad } : {}), ...(data.kontrollkod ? { kontrollkod: data.kontrollkod } : {}), ...(data.dos != null ? { dos: data.dos } : {}),
      // Runda 13, r3 (E2-5): skannat armband eller uppgiften om hur identiteten kontrollerades följer med dosen i kön.
      ...(data.armband ? { armband: data.armband } : {}), ...(data.identitet ? { identitet: data.identitet } : {}) };
  }
  const rad = { id: crypto.randomUUID(), typ: k.typ, patientId: pid, gjord, data: innehall };
  const i = info;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const krypt = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: koAad(i.kopiaId, i.personalId, rad.id) }, nyckel, new TextEncoder().encode(JSON.stringify(rad)));
  await lagring.spara('ko', { id: rad.id, kopiaId: i.kopiaId, skapad: new Date().toISOString(), iv, data: krypt });
  const visad = tillampa(rad);
  // Avbrottsraden räknar raderna i kön (avbrott.js).
  try { window.dispatchEvent(new Event('vk-skrivko')); } catch { /* utan fönster */ }
  if (k.typ === 'matvarde') return { ...(visad ?? { namn: data.typ, varde: data.varde, enhet: '' }), koad: true, ejSparad: true };
  return { koad: true, administrering: { ...(visad ?? {}), status: 'given', tid: gjord, ejSparad: true }, varningar: [] };
}

// Läser kön för den öppna läskopian och visar raderna i kopian, när läsläget öppnas på nytt.
async function tillampaKo() {
  for (const r of await koRader().catch(() => [])) {
    const rad = await lasKo(r);
    if (rad) tillampa(rad);
  }
}
// Alla rader i kön på datorn, krypterade.
export async function koRader() {
  try { return await lagring.alla('ko'); } catch { return []; }
}
// En rad i klartext, om den hör till den öppna läskopian och nyckeln finns i fliken. Annars null.
export async function lasKo(r) {
  if (!nyckel || !info || r.kopiaId !== info.kopiaId) return null;
  try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv, additionalData: koAad(r.kopiaId, info.personalId, r.id) }, nyckel, r.data))); } catch { return null; }
}
export async function taBortKo(ids) {
  if (!ids.length) return;
  await forrad('ko', 'readwrite', s => { for (const id of ids) s.delete(id); });
}
