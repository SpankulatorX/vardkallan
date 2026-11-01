// Reservinloggning för läsläget (D4). I vården låser SITHS-kortet upp en privat nyckel med PIN-koden, även utan nät,
// och kortets hårdvara räknar felaktiga försök. I demon är kortet simulerat med en reservkod som personen väljer när
// hen är inloggad. Med koden går läskopian att öppna när servern inte svarar, också i en ny flik eller efter en
// omstart av webbläsaren, när flikens nyckel i sessionStorage är borta.
//
// Så fungerar det: läskopians nyckel (som servern lämnar ut vid inloggningen) slås in med AES-GCM och en nyckel som
// härleds ur reservkoden med PBKDF2 (SHA-256, 600 000 iterationer, slumpat salt på 16 byte). Den inslagna nyckeln är
// bunden till personen, läskopian, giltighetstiden, saltet och antalet iterationer som additional data. I IndexedDB
// sparas bara den inslagna nyckeln, saltet, den krypterade läskopian och vem den gäller i klartext (namn, titel,
// enhet och när den går ut, så att den som delar dator ser vilka reservkopior som finns). Koden och den råa nyckeln
// sparas aldrig. När koden låser upp reservkopian packas nyckeln upp direkt till en CryptoKey som inte kan exporteras.
//
// Fel kod ger ökande väntetid, och efter fem fel raderas reservkopian. Räknaren ligger i IndexedDB och kan kringgås av
// den som har datorn: den kan kopiera den inslagna nyckeln och pröva koder utan räknare. En kod med sex siffror står
// då inte emot länge, en lång lösenfras gör det bättre. I ett riktigt system håller kortet nyckeln och räknar försöken.
import * as lk from './lasekopia.js';

export const ITERATIONER = 600_000;
export const MAX_FORSOK = 5;
// Väntetid i sekunder efter första till fjärde felet. Det femte raderar reservkopian.
const VANTA_S = [2, 5, 15, 30];
const MIN_SIFFROR = 6;
const MIN_FRAS = 12;
const MAX_KOD = 200;

export class ReservFel extends Error {
  constructor(text, kod, data = {}) { super(text); this.kod = kod; this.data = data; }
}

// Koden måste vara minst sex siffror eller en lösenfras på minst tolv tecken.
export function kontrolleraKod(kod) {
  const k = String(kod ?? '');
  if (k.length > MAX_KOD) return `Reservkoden får vara högst ${MAX_KOD} tecken.`;
  if (/^\d+$/.test(k)) return k.length >= MIN_SIFFROR ? null : `En reservkod med bara siffror behöver minst ${MIN_SIFFROR} siffror.`;
  return k.length >= MIN_FRAS ? null : `Välj minst ${MIN_SIFFROR} siffror, eller en lösenfras på minst ${MIN_FRAS} tecken.`;
}

const aad = (r) => new TextEncoder().encode(`vardkallan-reservkod|${r.personalId}|${r.kopiaId}|${r.giltigTill}|${lk.tillB64(r.salt)}|${r.iterationer}`);
async function harled(kod, salt, iterationer) {
  const bas = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(kod).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterationer }, bas, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}
const utgangen = (r) => !r?.kopia || lk.utgangen(r.kopia) || Date.now() >= Date.parse(r.giltigTill);
const sammanfattning = (r) => ({ personalId: r.personalId, namn: r.namn, titel: r.titel, enhet: r.enhet, giltigTill: r.giltigTill, skapad: r.kopia.skapad, forsok: r.forsok ?? 0, vantaTill: r.vantaTill ?? null });

// Reservkopiorna på datorn, utgångna tas bort. Ger [{ personalId, namn, titel, enhet, giltigTill, skapad, forsok, vantaTill }].
export async function lista() {
  let alla = [];
  try { alla = await lk.lagring.alla('reserv'); } catch { return []; }
  const kvar = [];
  for (const r of alla) {
    if (utgangen(r)) await lk.lagring.taBort('reserv', r.personalId).catch(() => {});
    else kvar.push(sammanfattning(r));
  }
  return kvar.sort((a, b) => String(a.namn).localeCompare(String(b.namn), 'sv'));
}
export async function forPerson(personalId) {
  if (!personalId) return null;
  try {
    const r = await lk.lagring.hamta('reserv', personalId);
    if (!r) return null;
    if (utgangen(r)) { await lk.lagring.taBort('reserv', personalId); return null; }
    return sammanfattning(r);
  } catch { return null; }
}
export const taBort = (personalId) => lk.lagring.taBort('reserv', personalId).catch(() => {});

// Skapar eller byter reservkoden för den som är inloggad i fliken. vem är { namn, titel, enhet } att visa.
export async function skapa(kod, vem) {
  const felText = kontrolleraKod(kod);
  if (felText) throw new ReservFel(felText, 'ogiltig');
  const u = await lk.underlagForReserv();
  if (!u) throw new ReservFel('Läskopian är inte klar än. Vänta en stund och försök igen.', 'ej_klar');
  try {
    const post = {
      personalId: u.info.personalId, namn: vem.namn, titel: vem.titel, enhet: vem.enhet,
      kopiaId: u.info.kopiaId, giltigTill: u.post.giltigTill, skapad: new Date().toISOString(),
      salt: crypto.getRandomValues(new Uint8Array(16)), iterationer: ITERATIONER, wrapIv: crypto.getRandomValues(new Uint8Array(12)),
      forsok: 0, vantaTill: null, kopia: u.post,
    };
    const kek = await harled(kod, post.salt, post.iterationer);
    // Nyckeln importeras som exporterbar bara för att kunna slås in, och kastas direkt efteråt.
    const tillfallig = await crypto.subtle.importKey('raw', u.radNyckel, 'AES-GCM', true, ['encrypt', 'decrypt']);
    post.inslagen = await crypto.subtle.wrapKey('raw', tillfallig, kek, { name: 'AES-GCM', iv: post.wrapIv, additionalData: aad(post) });
    await lk.lagring.spara('reserv', post);
    return sammanfattning(post);
  } finally { u.radNyckel.fill(0); }
}

// Så länge ett försök pågår är reservkopian spärrad för andra försök, också från andra flikar. Spärren släpper av sig
// själv om fliken stängs mitt i försöket.
const SPARR_MS = 15_000;

// Låser upp reservkopian med koden och öppnar läsläget. Väntetiden kontrolleras, försöket räknas och spärren sätts i
// en och samma transaktion innan koden prövas. Så kan flera flikar inte pröva samtidigt eller hoppa över väntetiden,
// och ett försök räknas även om fliken stängs mitt i.
let pagar = null;
export async function lasUpp(personalId, kod) {
  if (pagar) throw new ReservFel('Ett försök pågår redan.', 'pagar');
  pagar = (async () => {
    let beslut = null;
    await lk.lagring.andra('reserv', personalId, x => {
      const nu = Date.now();
      if (utgangen(x)) { beslut = { utgangen: true }; return null; }
      const vanta = x.vantaTill ? Math.ceil((Date.parse(x.vantaTill) - nu) / 1000) : 0;
      if (vanta > 0) { beslut = { vanta }; return null; }
      beslut = { forsok: (x.forsok ?? 0) + 1 };
      return { ...x, forsok: beslut.forsok, vantaTill: new Date(nu + SPARR_MS).toISOString() };
    });
    if (!beslut) throw new ReservFel('Det finns ingen reservkopia för den personen på den här datorn.', 'saknas');
    if (beslut.utgangen) { await taBort(personalId); throw new ReservFel('Reservkopian har gått ut och är raderad.', 'utgangen'); }
    if (beslut.vanta) throw new ReservFel(`Vänta ${beslut.vanta} ${beslut.vanta === 1 ? 'sekund' : 'sekunder'} innan nästa försök.`, 'vanta', { vantaS: beslut.vanta });
    const { forsok } = beslut;
    const r = await lk.lagring.hamta('reserv', personalId);
    if (!r) throw new ReservFel('Det finns ingen reservkopia för den personen på den här datorn.', 'saknas');
    let k;
    try {
      const kek = await harled(kod, r.salt, r.iterationer);
      k = await crypto.subtle.unwrapKey('raw', r.inslagen, kek, { name: 'AES-GCM', iv: r.wrapIv, additionalData: aad(r) }, 'AES-GCM', false, ['encrypt', 'decrypt']);
    } catch {
      if (forsok >= MAX_FORSOK) {
        await taBort(personalId);
        throw new ReservFel(`Fel reservkod ${MAX_FORSOK} gånger. Reservkopian är raderad från datorn.`, 'raderad');
      }
      const s = VANTA_S[forsok - 1];
      await lk.lagring.andra('reserv', personalId, x => ({ ...x, forsok, vantaTill: new Date(Date.now() + s * 1000).toISOString() }));
      const kvar = MAX_FORSOK - forsok;
      throw new ReservFel(`Fel reservkod. ${kvar === 1 ? 'Ett försök' : `${kvar} försök`} kvar innan reservkopian raderas. Vänta ${s} sekunder innan nästa försök.`, 'fel', { kvar, vantaS: s });
    }
    let m;
    try { m = await lk.oppnaMedReserv(k, { personalId, giltigTill: r.giltigTill, kopiaId: r.kopiaId }, r.kopia); } catch {
      await taBort(personalId);
      throw new ReservFel('Reservkopian gick inte att läsa och är raderad.', 'trasig');
    }
    await lk.lagring.andra('reserv', personalId, x => ({ ...x, forsok: 0, vantaTill: null }));
    return m;
  })();
  try { return await pagar; } finally { pagar = null; }
}
