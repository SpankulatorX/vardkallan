// Läskopian för avbrott (D4): en krypterad kopia i webbläsaren av det servern redan har lämnat ut till den inloggade,
// alltså arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten,
// läkemedlen och de senaste anteckningarna. Servern bygger kopian med samma behörighetskontroll som vanliga anrop
// (GET /api/lasekopia). Här lagras den bara, krypterad, och läses när servern inte svarar.
//
// Kryptering: AES-GCM med 256 bitars nyckel genom Web Crypto. Nyckeln skapas av servern vid inloggningen, byts vid
// varje ny inloggning och gäller i 8 timmar. I webbläsaren finns den i minnet som en CryptoKey som inte kan exporteras,
// och i sessionStorage för den här fliken, så att läsläget fungerar också om sidan laddas om under avbrottet. Nyckeln
// lagras aldrig i IndexedDB. Där ligger bara chiffertexten, slumpad IV och metadata (vem, när kopian skapades och hur
// länge nyckeln gäller). Metadata är bunden till chiffertexten som additional data, så ändrad metadata gör att
// dekrypteringen misslyckas och kopian kastas.
//
// Det skyddar mot:
//   att någon läser webbläsarens lagrade filer (IndexedDB på disken) efter att fliken är stängd, till exempel på en
//   delad eller stulen dator, eftersom sessionStorage och nyckeln försvinner med fliken;
//   att nästa person som loggar in i samma webbläsare läser föregående persons kopia, eftersom kopian raderas vid
//   utloggning och varje inloggning får en ny nyckel;
//   att en gammal kopia används, eftersom kopian kastas efter 8 timmar.
//
// Det skyddar inte mot:
//   skadlig kod som körs i sidan (XSS) eller i webbläsaren medan fliken är öppen, eftersom den kan använda nyckeln;
//   någon som sitter vid en olåst dator medan personen är inloggad;
//   skadeprogram på datorn medan fliken lever: webbläsaren kan skriva sessionStorage till disken för att kunna
//   återställa flikar, och nyckeln finns i minnet;
//   skärmdumpar och utskrifter. Kopian ersätter inte diskkryptering och en låst skärm.
import { ApiFel } from './ui.js';

const DB = 'vardkallan-lasekopia';
const FORRAD = 'poster';
const SS_NYCKEL = 'vk_lasnyckel';
export const MAX_ALDER_MS = 8 * 3600_000;

let nyckel = null;     // CryptoKey, går inte att exportera
let info = null;       // { giltigTill, personalId }
let kopia = null;      // den dekrypterade kopian, bara i minnet medan läsläget pågår
let kedja = Promise.resolve();

const franB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const ss = {
  las: () => { try { return JSON.parse(sessionStorage.getItem(SS_NYCKEL) || 'null'); } catch { return null; } },
  skriv: (v) => { try { sessionStorage.setItem(SS_NYCKEL, JSON.stringify(v)); } catch { /* privat läge */ } },
  ta: () => { try { sessionStorage.removeItem(SS_NYCKEL); } catch { /* privat läge */ } },
};

function oppnaDb() {
  return new Promise((ja, nej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(FORRAD, { keyPath: 'id' });
    r.onsuccess = () => ja(r.result);
    r.onerror = () => nej(r.error);
  });
}
async function forrad(lage, fn) {
  const db = await oppnaDb();
  try {
    return await new Promise((ja, nej) => {
      const tx = db.transaction(FORRAD, lage);
      const r = fn(tx.objectStore(FORRAD));
      tx.oncomplete = () => ja(r?.result);
      tx.onerror = () => nej(tx.error);
    });
  } finally { db.close(); }
}
const hamtaPost = (id) => forrad('readonly', s => s.get(id));
const sparaPost = (post) => forrad('readwrite', s => s.put(post));
const taBortPost = (id) => forrad('readwrite', s => s.delete(id));

const aad = (p) => new TextEncoder().encode(`vardkallan-lasekopia|${p.id}|${p.personalId}|${p.skapad}|${p.giltigTill}`);
async function kryptera(meta, varde) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(meta) }, nyckel, new TextEncoder().encode(JSON.stringify(varde)));
  return { ...meta, iv, data };
}
async function dekryptera(post) {
  const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: post.iv, additionalData: aad(post) }, nyckel, post.data);
  return JSON.parse(new TextDecoder().decode(klar));
}
const giltig = (post) => post && info && post.personalId === info.personalId && Date.now() < Date.parse(post.giltigTill)
  && Date.now() - Date.parse(post.skapad) < MAX_ALDER_MS;

// Nyckeln från servern ({ nyckel, giltigTill }) för den inloggade.
export async function satNyckel(lasnyckel, personalId) {
  if (!lasnyckel?.nyckel || !personalId) return;
  const ny = { nyckel: lasnyckel.nyckel, giltigTill: lasnyckel.giltigTill, personalId };
  const forra = ss.las();
  if (nyckel && forra?.nyckel === ny.nyckel && info?.personalId === personalId) return;
  // En ny nyckel betyder en ny inloggning. En kopia som är krypterad med den gamla nyckeln går inte att läsa och tas bort.
  if (forra && forra.nyckel !== ny.nyckel) await rensa();
  nyckel = await crypto.subtle.importKey('raw', franB64(ny.nyckel), 'AES-GCM', false, ['encrypt', 'decrypt']);
  info = { giltigTill: ny.giltigTill, personalId };
  ss.skriv(ny);
}

// Läser in nyckeln från sessionStorage, när sidan har laddats om under ett avbrott.
async function nyckelFranFlik() {
  if (nyckel) return true;
  const n = ss.las();
  if (!n?.nyckel || Date.now() >= Date.parse(n.giltigTill)) return false;
  nyckel = await crypto.subtle.importKey('raw', franB64(n.nyckel), 'AES-GCM', false, ['encrypt', 'decrypt']);
  info = { giltigTill: n.giltigTill, personalId: n.personalId };
  return true;
}

// Sparar en ny kopia från GET /api/lasekopia. Kopians session innehåller inte nyckeln.
export async function spara(ny) {
  if (!nyckel || ny?.session?.personal?.id !== info?.personalId) return null;
  const meta = { id: 'kopia', personalId: info.personalId, skapad: ny.skapad, giltigTill: ny.giltigTill < info.giltigTill ? ny.giltigTill : info.giltigTill };
  await sparaPost(await kryptera(meta, ny));
  return meta.skapad;
}

// Öppnar kopian för läsläget. Ger { skapad, session } eller null när ingen användbar kopia finns.
export async function oppna() {
  if (!(await nyckelFranFlik())) return null;
  const post = await hamtaPost('kopia');
  if (!post) return null;
  if (!giltig(post)) { await rensa(); return null; }
  try { kopia = await dekryptera(post); } catch { await taBortPost('kopia'); return null; }
  return { skapad: kopia.skapad, session: { ...kopia.session, inloggad: true }, patienter: Object.keys(kopia.patienter).length };
}
export const stang = () => { kopia = null; };
export const harKopia = () => Boolean(kopia);

// Raderar kopian, nyckeln och loggen. Med behallLogg finns åtkomstloggen från läsläget och nyckeln kvar tills
// loggen har skickats, för en utloggning som görs medan servern inte svarar.
export async function rensa({ behallLogg = false } = {}) {
  kopia = null;
  await kedja.catch(() => {});
  try {
    await taBortPost('kopia');
    if (!behallLogg) await taBortPost('logg');
  } catch { /* IndexedDB saknas */ }
  if (!behallLogg) { nyckel = null; info = null; ss.ta(); }
}

// Åtkomstloggen i läsläget. Raderna krypteras med samma nyckel och skickas till servern när den svarar igen.
function loggaLokalt(rad) {
  kedja = kedja.then(async () => {
    if (!nyckel) return;
    const rader = await lasLogg();
    rader.push(rad);
    await sparaPost(await kryptera({ id: 'logg', personalId: info.personalId, skapad: rader[0].tid, giltigTill: info.giltigTill }, rader));
  }).catch(e => console.warn('Åtkomsten i läsläget kunde inte loggas lokalt:', e));
  return kedja;
}
async function lasLogg() {
  const post = await hamtaPost('logg');
  if (!post || !nyckel) return [];
  try { return await dekryptera(post); } catch { return []; }
}
export async function hamtaLogg() {
  await kedja;
  if (!(await nyckelFranFlik())) return [];
  return lasLogg();
}
export async function tomLogg(ids) {
  kedja = kedja.then(async () => {
    const kvar = (await lasLogg()).filter(r => !ids.includes(r.id));
    if (!kvar.length) await taBortPost('logg');
    else await sparaPost(await kryptera({ id: 'logg', personalId: info.personalId, skapad: kvar[0].tid, giltigTill: info.giltigTill }, kvar));
  });
  return kedja;
}

const SAKNAS = 'Det här finns inte i läskopian. Under avbrottet går det att läsa arbetslistan och, för patienterna i läskopian, patienthuvudet, översikten, läkemedlen och de senaste anteckningarna.';
const ej = (fel, kod = 'ej_i_laskopian') => new ApiFel(0, { fel, kod });

// Besvarar ett anrop från läskopian, i samma form som servern. Varje läsning av patientuppgifter loggas lokalt.
export function svara(vag, metod = 'GET') {
  if (metod !== 'GET') throw ej('Under avbrottet går det inte att spara eller ändra något, eftersom det inte skulle nå journalen. Vänta tills förbindelsen är tillbaka.', 'laslage');
  if (!kopia) throw ej('Servern svarar inte, och det finns ingen läskopia i den här fliken. Vänta tills förbindelsen är tillbaka.', 'natverk');
  const p = decodeURI(vag.split('?')[0]);
  const ut = (v) => structuredClone(v);
  const logga = (patientId, handling) => loggaLokalt({ id: crypto.randomUUID(), tid: new Date().toISOString(), patientId, handling, resurs: p });
  if (p === '/api/session') return ut({ ...kopia.session, inloggad: true });
  if (p === '/api/arbetslista') return ut(kopia.arbetslista);
  if (p === '/api/mallar') return ut(kopia.mallar);
  if (p === '/api/enheter') return ut(kopia.enheter);
  let m = p.match(/^\/api\/patient\/([\w-]+)(?:\/(oversikt|lakemedel|anteckningar))?$/);
  if (m) {
    const post = kopia.patienter[m[1]];
    if (!post) throw ej('Patienten finns inte i läskopian. Bara patienterna på arbetslistan och de som du har öppnat under inloggningen kopieras.');
    const del = m[2];
    if (!del) { logga(m[1], post.handling); return ut(post.huvud); }
    if (del === 'oversikt') { logga(m[1], post.handling); return ut(post.oversikt); }
    if (del === 'lakemedel' && post.lakemedel) { logga(m[1], 'las_lakemedel'); return ut(post.lakemedel); }
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
