// Runda 12, r3 (vårt L5): flerfaktorsinloggning med öppna standarder, för personalen och för invånaren i Min journal.
//
// Två slag av andra faktor finns:
//   passkey     WebAuthn nivå 2 (W3C) med användarverifiering. Webbläsaren och autentiseraren (telefonen, datorns
//               inbyggda skydd eller en säkerhetsnyckel) skapar ett nyckelpar. Bara den publika nyckeln sparas, per
//               användare i sandlådan. Varje inloggning signerar en ny utmaning från servern, och servern prövar
//               signaturen, ursprunget, utmaningen, RP-id:t och att personen verifierades (PIN eller biometri).
//   totp        engångskoder enligt RFC 6238 (HMAC-SHA1, 30 sekunder, sex siffror) från en app i telefonen. Nyckeln
//               sparas krypterad med AES-256-GCM och en nyckel som aldrig ligger i databasen, och varje kod godtas en
//               gång.
//
// Ingen extern tjänst används. SITHS-kortet och e-legitimationen är fortfarande simulerade: valet av demoroll är den
// första faktorn, och flerfaktorn är den andra.
//
// Den publika demon får inte låsa ute besökaren. Därför slås flerfaktorn på av besökaren själv: en demoroll kräver
// flerfaktor i sandlådan från det ögonblick en passkey eller en app för engångskoder har registrerats för den, och
// inte förut. Den som tappar bort sin faktor återställer sandlådan, och då försvinner både faktorn och allt annat som
// gjorts i sandlådan, så att återställningen aldrig ger åtkomst till något som skyddades av faktorn.
//
// Systemet är experten: användaren väljer aldrig algoritm, längd på koden eller tidsfönster. Systemet säger vilken
// faktor som gäller, föreslår passkey först eftersom den inte går att lura till en falsk webbplats, och förklarar på
// vanlig svenska varför en kod eller en passkey inte godtas.
import { createHash, createHmac, createPublicKey, createCipheriv, createDecipheriv, randomBytes, verify, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Fel } from './db.js';

export const TYPER = { passkey: 'Passkey', totp: 'App för engångskoder' };
export const TOTP_STEG_S = 30;
export const TOTP_SIFFROR = 6;
// En kod från steget före eller efter godtas, så att en klocka som går lite fel i telefonen inte låser ute.
export const TOTP_FONSTER = 1;
export const UTMANING_S = 300;
// Så många felaktiga försök godtas per påbörjad inloggning, och så många per användare under en kvart.
export const MAX_FORSOK = 5;
export const MAX_FEL_PER_KVART = 10;
export const MAX_FAKTORER = 5;
export const UTFARDARE_TOTP = 'Vårdkällan (demo)';
// COSE-algoritmerna som servern godtar: ES256 och RS256 (RFC 8152 och RFC 8812).
export const ALGORITMER = [-7, -257];

export function sakra(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS flerfaktorer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agare_typ TEXT NOT NULL CHECK (agare_typ IN ('personal', 'invanare')),
    agare_id TEXT NOT NULL,
    typ TEXT NOT NULL CHECK (typ IN ('passkey', 'totp')),
    namn TEXT NOT NULL,
    aktiv INTEGER NOT NULL DEFAULT 0,
    credential_id TEXT,
    publik_nyckel TEXT,
    algoritm INTEGER,
    raknare INTEGER NOT NULL DEFAULT 0,
    hemlighet TEXT,
    senast_steg INTEGER NOT NULL DEFAULT 0,
    skapad TEXT NOT NULL,
    senast_anvand TEXT
  )`);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS flerfaktorer_credential ON flerfaktorer (credential_id) WHERE credential_id IS NOT NULL');
  return db;
}

// Nyckeln som krypterar TOTP-nycklarna. Den finns aldrig i sandlådans databas. I drift kommer den från FLERFAKTOR_NYCKEL
// (64 hextecken) eller från en fil bredvid sessionsfilen, så att sparade sandlådor går att läsa efter en omstart.
let NYCKEL = null;
export function satNyckel({ hex = process.env.FLERFAKTOR_NYCKEL, fil = null } = {}) {
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) { NYCKEL = Buffer.from(hex, 'hex'); return; }
  if (fil) {
    try {
      if (existsSync(fil)) { const t = readFileSync(fil, 'utf8').trim(); if (/^[0-9a-f]{64}$/i.test(t)) { NYCKEL = Buffer.from(t, 'hex'); return; } }
      const ny = randomBytes(32);
      writeFileSync(fil, ny.toString('hex'), { mode: 0o600 });
      NYCKEL = ny;
      return;
    } catch { /* faller tillbaka på en slumpad nyckel */ }
  }
  NYCKEL = randomBytes(32);
}
const nyckel = () => { if (!NYCKEL) satNyckel(); return NYCKEL; };

// AES-256-GCM med ägaren som tilläggsdata, så att en krypterad nyckel inte går att flytta till en annan användare.
export function kryptera(klartext, agare) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', nyckel(), iv);
  c.setAAD(Buffer.from(agare));
  const ct = Buffer.concat([c.update(klartext), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}
export function dekryptera(text, agare) {
  const [v, iv, tag, ct] = String(text).split('.');
  if (v !== 'v1') throw new Error('Okänd version');
  const d = createDecipheriv('aes-256-gcm', nyckel(), Buffer.from(iv, 'base64url'));
  d.setAAD(Buffer.from(agare));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]);
}

// Base32 enligt RFC 4648, som apparna för engångskoder läser.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bitar = 0, varde = 0, ut = '';
  for (const b of buf) {
    varde = (varde << 8) | b; bitar += 8;
    while (bitar >= 5) { ut += B32[(varde >>> (bitar - 5)) & 31]; bitar -= 5; }
  }
  if (bitar > 0) ut += B32[(varde << (5 - bitar)) & 31];
  return ut;
}
export function fran32(text) {
  const t = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bitar = 0, varde = 0;
  const ut = [];
  for (const ch of t) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Ogiltig base32');
    varde = (varde << 5) | i; bitar += 5;
    if (bitar >= 8) { ut.push((varde >>> (bitar - 8)) & 255); bitar -= 8; }
  }
  return Buffer.from(ut);
}

// HOTP (RFC 4226) och TOTP (RFC 6238).
export function hotp(hemlighet, raknare, siffror = TOTP_SIFFROR) {
  const r = Buffer.alloc(8);
  r.writeBigUInt64BE(BigInt(raknare));
  const h = createHmac('sha1', hemlighet).update(r).digest();
  const o = h[h.length - 1] & 15;
  const tal = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(tal % 10 ** siffror).padStart(siffror, '0');
}
export const totpSteg = (ms) => Math.floor(ms / 1000 / TOTP_STEG_S);
export const totp = (hemlighet, ms, siffror = TOTP_SIFFROR) => hotp(hemlighet, totpSteg(ms), siffror);

// Minimal CBOR-avkodare (RFC 8949) för det WebAuthn skickar: heltal, byte- och textsträngar, listor, kartor och enkla
// värden. Taket på djup och längd gör att en förfalskad struktur inte kan få servern att arbeta länge.
export function cbor(buf) {
  let i = 0;
  const las = (djup) => {
    if (djup > 8 || i >= buf.length) throw new Error('Ogiltig CBOR');
    const forsta = buf[i++];
    const typ = forsta >> 5, info = forsta & 31;
    let n;
    if (info < 24) n = info;
    else if (info === 24) n = buf[i++];
    else if (info === 25) { n = buf.readUInt16BE(i); i += 2; }
    else if (info === 26) { n = buf.readUInt32BE(i); i += 4; }
    else if (info === 27) { const v = buf.readBigUInt64BE(i); i += 8; if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('För stort tal'); n = Number(v); }
    else throw new Error('Ogiltig CBOR');
    if (typ === 0) return n;
    if (typ === 1) return -1 - n;
    if (typ === 2 || typ === 3) {
      if (n > 4096 || i + n > buf.length) throw new Error('Ogiltig CBOR');
      const b = buf.subarray(i, i + n); i += n;
      return typ === 2 ? Buffer.from(b) : b.toString('utf8');
    }
    if (typ === 4) { if (n > 64) throw new Error('Ogiltig CBOR'); return Array.from({ length: n }, () => las(djup + 1)); }
    if (typ === 5) {
      if (n > 64) throw new Error('Ogiltig CBOR');
      const m = new Map();
      for (let k = 0; k < n; k++) { const nyckel_ = las(djup + 1); m.set(nyckel_, las(djup + 1)); }
      return m;
    }
    if (typ === 7) { if (n === 20) return false; if (n === 21) return true; if (n === 22) return null; }
    throw new Error('Ogiltig CBOR');
  };
  const v = las(0);
  return { varde: v, slut: i };
}

const b64u = (x) => Buffer.from(x).toString('base64url');
const fran64 = (t, falt) => {
  if (typeof t !== 'string' || t.length > 20000 || !/^[A-Za-z0-9_-]*={0,2}$/.test(t)) throw new Fel(400, 'Svaret från din passkey är ofullständigt. Försök igen.', 'ogiltig', { falt: [falt] });
  return Buffer.from(t, 'base64url');
};
const sha256 = (b) => createHash('sha256').update(b).digest();

// COSE-nyckeln (RFC 8152) som JWK, så att Node kan pröva signaturen.
export function coseTillJwk(m) {
  if (!(m instanceof Map)) throw new Error('Ingen nyckel');
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === -7 && m.get(-1) === 1) {
    const x = m.get(-2), y = m.get(-3);
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y) || x.length !== 32 || y.length !== 32) throw new Error('Fel nyckel');
    return { alg, jwk: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) } };
  }
  if (kty === 3 && alg === -257) {
    const n = m.get(-1), e = m.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e) || n.length < 256) throw new Error('Fel nyckel');
    return { alg, jwk: { kty: 'RSA', n: b64u(n), e: b64u(e) } };
  }
  throw new Error('Algoritmen stöds inte');
}

// Autentiseringsdatan (WebAuthn 6.1): RP-id:ts hash, flaggor, räknare och vid registrering nyckeln.
export function lasAutentiseringsdata(ad) {
  if (ad.length < 37) throw new Error('För kort');
  const ut = { rpIdHash: ad.subarray(0, 32), flaggor: ad[32], raknare: ad.readUInt32BE(33) };
  ut.up = Boolean(ut.flaggor & 0x01);
  ut.uv = Boolean(ut.flaggor & 0x04);
  if (ut.flaggor & 0x40) {
    if (ad.length < 55) throw new Error('För kort');
    const len = ad.readUInt16BE(53);
    if (len > 1023 || ad.length < 55 + len) throw new Error('För lång');
    ut.credentialId = ad.subarray(55, 55 + len);
    const { varde } = cbor(ad.subarray(55 + len));
    ut.nyckel = varde;
  }
  return ut;
}

const agareNyckel = (typ, id) => `${typ}:${id}`;
const rader = (db, typ, id) => db.query('SELECT * FROM flerfaktorer WHERE agare_typ = ? AND agare_id = ? ORDER BY id').all(typ, id);
// En faktor räknas bara när den går att använda. En TOTP-nyckel som inte går att dekryptera (till exempel efter att
// nyckeln har bytts) räknas inte, så att ingen låses ute av den.
function anvandbar(r) {
  if (!r.aktiv) return false;
  if (r.typ === 'passkey') return Boolean(r.credential_id && r.publik_nyckel);
  try { dekryptera(r.hemlighet, agareNyckel(r.agare_typ, r.agare_id)); return true; } catch { return false; }
}
export const aktiva = (db, typ, id) => rader(db, typ, id).filter(anvandbar);
export const kravs = (db, typ, id) => aktiva(db, typ, id).length > 0;
// Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 7): aktiva faktorer som inte går att pröva.
export const oprovbara = (db, typ, id) => rader(db, typ, id).filter(r => r.aktiv && !anvandbar(r));
export const metoder = (db, typ, id) => [...new Set(aktiva(db, typ, id).map(r => r.typ))].sort((a, b) => (a === 'passkey' ? -1 : b === 'passkey' ? 1 : 0));

const faktorUt = (r) => ({ id: r.id, typ: r.typ, typText: TYPER[r.typ], namn: r.namn, skapad: r.skapad, senastAnvand: r.senast_anvand, aktiv: Boolean(r.aktiv) });

// Översikten för den inloggade. metod är hur inloggningen i sessionen bekräftades.
// Runda 13, r3: kravsAvVardgivaren är parametern sakerhet.flerfaktor_kravs, som servern läser och skickar in.
export function oversikt(db, typ, id, { metod = null, kravsAvVardgivaren = false } = {}) {
  const a = aktiva(db, typ, id);
  return {
    aktiv: a.length > 0,
    faktorer: a.map(faktorUt),
    metod,
    max: MAX_FAKTORER,
    kravsAvVardgivaren,
    text: kravsAvVardgivaren
      ? (a.length ? 'Vårdgivaren kräver flerfaktor. Varje inloggning bekräftas med en av faktorerna nedan, och den sista faktorn går inte att ta bort.'
        : 'Vårdgivaren kräver flerfaktor. Registrera en passkey eller en app för engångskoder för att logga in.')
      : a.length
        ? 'Flerfaktor är på för dig i den här sandlådan. Varje inloggning bekräftas med en av faktorerna nedan.'
        : 'Flerfaktor är av. Registrera en passkey eller en app för engångskoder, så krävs den vid varje inloggning som du i den här sandlådan.',
  };
}

// Utmaningarna lever i sessionen i minnet, gäller en gång och i fem minuter.
function nyUtmaning(s, syfte, extra = {}, nu = Date.now()) {
  const u = { utmaning: b64u(randomBytes(32)), syfte, utgar: nu + UTMANING_S * 1000, ...extra };
  s.flerfaktorUtmaning = u;
  return u;
}
function tagUtmaning(s, syfte, nu = Date.now()) {
  const u = s.flerfaktorUtmaning;
  s.flerfaktorUtmaning = null;
  if (!u || u.syfte !== syfte || u.utgar < nu) throw new Fel(400, 'Utmaningen har gått ut eller redan använts. Börja om.', 'ogiltig');
  return u;
}

// Gemensam kontroll av clientDataJSON för registrering och inloggning (WebAuthn 7.1 och 7.2).
function provaKlientdata(raw, typ, u, ursprung) {
  let cd;
  try { cd = JSON.parse(raw.toString('utf8')); } catch { throw new Fel(400, 'Svaret från din passkey kunde inte läsas.', 'ogiltig'); }
  if (cd.type !== typ) throw new Fel(400, 'Svaret från din passkey gällde något annat. Försök igen.', 'ogiltig');
  const ok = typeof cd.challenge === 'string' && cd.challenge.length === u.utmaning.length
    && timingSafeEqual(Buffer.from(cd.challenge), Buffer.from(u.utmaning));
  if (!ok) throw new Fel(400, 'Svaret från din passkey gällde en annan utmaning. Försök igen.', 'ogiltig');
  if (cd.origin !== ursprung) throw new Fel(400, `Passkeyn användes på en annan webbplats (${String(cd.origin).slice(0, 80)}) än Vårdkällan. Den godtas inte, eftersom det kan vara en falsk sida.`, 'nekad');
  if (cd.crossOrigin === true) throw new Fel(400, 'Passkeyn användes i en ram från en annan webbplats och godtas inte.', 'nekad');
}

// Registreringen av en passkey: alternativen till navigator.credentials.create.
export function borjaPasskey(db, s, { typ, id, namn }, { rpId, nu = Date.now() } = {}) {
  if (rader(db, typ, id).filter(r => r.aktiv).length >= MAX_FAKTORER) throw new Fel(400, `Du har redan ${MAX_FAKTORER} faktorer. Ta bort en innan du lägger till en ny.`, 'ogiltig');
  const anvandarId = b64u(sha256(Buffer.from(`vardkallan:${typ}:${id}`)).subarray(0, 16));
  const u = nyUtmaning(s, 'registrering', { agare: agareNyckel(typ, id) }, nu);
  return {
    challenge: u.utmaning,
    rp: { id: rpId, name: 'Vårdkällan (demo)' },
    user: { id: anvandarId, name: `${namn} (demo)`, displayName: namn },
    pubKeyCredParams: ALGORITMER.map(alg => ({ type: 'public-key', alg })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    attestation: 'none',
    timeout: UTMANING_S * 1000,
    excludeCredentials: rader(db, typ, id).filter(r => r.credential_id).map(r => ({ type: 'public-key', id: r.credential_id })),
  };
}

// Prövar svaret från navigator.credentials.create och sparar den publika nyckeln. Attesteringen begärs inte (none),
// eftersom demon inte kräver en viss sorts autentiserare.
export function sparaPasskey(db, s, { typ, id }, body, { rpId, ursprung, nu = Date.now() } = {}) {
  const u = tagUtmaning(s, 'registrering', nu);
  if (u.agare !== agareNyckel(typ, id)) throw new Fel(400, 'Utmaningen gällde en annan inloggning. Börja om.', 'ogiltig');
  const svar = body?.svar ?? {};
  const cdRaw = fran64(svar.clientDataJSON, 'clientDataJSON');
  provaKlientdata(cdRaw, 'webauthn.create', u, ursprung);
  let ad;
  try {
    const { varde: att } = cbor(fran64(svar.attestationObject, 'attestationObject'));
    if (!(att instanceof Map) || !Buffer.isBuffer(att.get('authData'))) throw new Error('Saknar authData');
    ad = lasAutentiseringsdata(att.get('authData'));
  } catch (e) { if (e instanceof Fel) throw e; throw new Fel(400, 'Svaret från din passkey kunde inte läsas.', 'ogiltig'); }
  if (!ad.rpIdHash.equals(sha256(Buffer.from(rpId)))) throw new Fel(400, 'Passkeyn skapades för en annan webbplats och godtas inte.', 'nekad');
  if (!ad.up || !ad.uv) throw new Fel(400, 'Din passkey bekräftade inte att det var du (PIN-kod, fingeravtryck eller ansikte). Försök igen och bekräfta när du blir ombedd.', 'ogiltig');
  if (!ad.credentialId || !ad.nyckel) throw new Fel(400, 'Svaret från din passkey saknade nyckeln.', 'ogiltig');
  let nyckelInfo;
  try { nyckelInfo = coseTillJwk(ad.nyckel); createPublicKey({ key: nyckelInfo.jwk, format: 'jwk' }); } catch { throw new Fel(400, 'Din passkey använder en nyckeltyp som Vårdkällan inte godtar. Pröva en annan autentiserare.', 'ogiltig'); }
  const credId = b64u(ad.credentialId);
  if (db.query('SELECT 1 FROM flerfaktorer WHERE credential_id = ?').get(credId)) throw new Fel(400, 'Den här passkeyn är redan registrerad.', 'ogiltig');
  const namn = typeof body?.namn === 'string' && body.namn.trim() ? body.namn.trim().slice(0, 60) : 'Passkey';
  const r = db.query(`INSERT INTO flerfaktorer (agare_typ, agare_id, typ, namn, aktiv, credential_id, publik_nyckel, algoritm, raknare, skapad)
    VALUES (?, ?, 'passkey', ?, 1, ?, ?, ?, ?, ?) RETURNING *`).get(typ, id, namn, credId, JSON.stringify(nyckelInfo.jwk), nyckelInfo.alg, ad.raknare, new Date(nu).toISOString());
  return faktorUt(r);
}

// En ny nyckel för engångskoder. Den gäller först när en kod från appen har bekräftats (bekraftaTotp).
export function borjaTotp(db, { typ, id, namn }, { nu = Date.now() } = {}) {
  if (rader(db, typ, id).filter(r => r.aktiv).length >= MAX_FAKTORER) throw new Fel(400, `Du har redan ${MAX_FAKTORER} faktorer. Ta bort en innan du lägger till en ny.`, 'ogiltig');
  db.query("DELETE FROM flerfaktorer WHERE agare_typ = ? AND agare_id = ? AND typ = 'totp' AND aktiv = 0").run(typ, id);
  const hemlighet = randomBytes(20);
  const r = db.query(`INSERT INTO flerfaktorer (agare_typ, agare_id, typ, namn, aktiv, hemlighet, skapad) VALUES (?, ?, 'totp', 'App för engångskoder', 0, ?, ?) RETURNING id`)
    .get(typ, id, kryptera(hemlighet, agareNyckel(typ, id)), new Date(nu).toISOString());
  const nyckel32 = base32(hemlighet);
  const etikett = encodeURIComponent(`${UTFARDARE_TOTP}:${namn}`);
  return {
    id: r.id, nyckel: nyckel32, nyckelGrupper: nyckel32.match(/.{1,4}/g).join(' '),
    uri: `otpauth://totp/${etikett}?secret=${nyckel32}&issuer=${encodeURIComponent(UTFARDARE_TOTP)}&algorithm=SHA1&digits=${TOTP_SIFFROR}&period=${TOTP_STEG_S}`,
    steg: TOTP_STEG_S, siffror: TOTP_SIFFROR,
  };
}

// Prövar en kod mot en nyckel. Steget som godtas sparas, så att samma kod aldrig godtas två gånger.
function provaKod(db, r, kod, nu) {
  const hemlighet = dekryptera(r.hemlighet, agareNyckel(r.agare_typ, r.agare_id));
  const steg = totpSteg(nu);
  for (let d = -TOTP_FONSTER; d <= TOTP_FONSTER; d++) {
    const s = steg + d;
    const vantad = Buffer.from(hotp(hemlighet, s));
    if (vantad.length === kod.length && timingSafeEqual(vantad, Buffer.from(kod))) {
      if (s <= r.senast_steg) return 'anvand';
      db.query('UPDATE flerfaktorer SET senast_steg = ?, senast_anvand = ? WHERE id = ?').run(s, new Date(nu).toISOString(), r.id);
      return 'ok';
    }
  }
  return 'fel';
}
const kodUr = (kod) => {
  const k = typeof kod === 'string' || typeof kod === 'number' ? String(kod).replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(k)) throw new Fel(400, 'Skriv de sex siffrorna som appen visar just nu.', 'ogiltig', { falt: ['kod'] });
  return k;
};

export function bekraftaTotp(db, { typ, id }, kod, { nu = Date.now() } = {}) {
  const k = kodUr(kod);
  const r = db.query("SELECT * FROM flerfaktorer WHERE agare_typ = ? AND agare_id = ? AND typ = 'totp' AND aktiv = 0 ORDER BY id DESC LIMIT 1").get(typ, id);
  if (!r) throw new Fel(400, 'Börja med att lägga till appen, så att du får en nyckel att skriva in.', 'ogiltig');
  const utfall = provaKod(db, r, k, nu);
  if (utfall !== 'ok') throw new Fel(400, 'Koden stämmer inte. Kontrollera att du skrev in nyckeln rätt i appen och att telefonens klocka går rätt, och skriv den kod som visas nu.', 'ogiltig', { falt: ['kod'] });
  db.query('UPDATE flerfaktorer SET aktiv = 1 WHERE id = ?').run(r.id);
  return faktorUt(db.query('SELECT * FROM flerfaktorer WHERE id = ?').get(r.id));
}

export function taBort(db, { typ, id }, fid, { kravsAvVardgivaren = false } = {}) {
  const r = db.query('SELECT * FROM flerfaktorer WHERE id = ? AND agare_typ = ? AND agare_id = ?').get(Number(fid) || 0, typ, id);
  if (!r) throw new Fel(404, 'Faktorn finns inte.', 'saknas');
  // Runda 13, r3: när vårdgivaren kräver flerfaktor går den sista faktorn inte att ta bort.
  if (kravsAvVardgivaren && anvandbar(r) && aktiva(db, typ, id).length <= 1) {
    throw new Fel(400, 'Vårdgivaren kräver flerfaktor, så den sista faktorn går inte att ta bort. Lägg till en ny faktor först, och ta sedan bort den gamla.', 'ogiltig');
  }
  db.query('DELETE FROM flerfaktorer WHERE id = ?').run(r.id);
  return { borttagen: faktorUt(r), ...oversikt(db, typ, id) };
}

// Inloggningens andra steg: vad klienten behöver för att be om faktorn.
export function inloggningsutmaning(db, s, { typ, id, registrera = false }, { rpId, nu = Date.now() } = {}) {
  const m = metoder(db, typ, id);
  const ut = { metoder: m };
  // Runda 13, r3: vårdgivaren kräver flerfaktor och personen har ingen faktor. Klienten leds till att registrera en.
  if (registrera) {
    ut.registrera = true;
    ut.text = 'Vårdgivaren kräver flerfaktor vid inloggning. Registrera en passkey eller en app för engångskoder. När den är bekräftad är du inloggad.';
  }
  if (m.includes('passkey')) {
    const u = nyUtmaning(s, 'inloggning', { agare: agareNyckel(typ, id) }, nu);
    ut.passkey = {
      challenge: u.utmaning, rpId, userVerification: 'required', timeout: UTMANING_S * 1000,
      allowCredentials: aktiva(db, typ, id).filter(r => r.typ === 'passkey').map(r => ({ type: 'public-key', id: r.credential_id })),
    };
  }
  return ut;
}

// Prövar den andra faktorn. Kastar Fel med ett begripligt skäl, eller ger metoden som användes.
export function prova(db, s, { typ, id }, body, { rpId, ursprung, nu = Date.now() } = {}) {
  if (body?.typ === 'totp') {
    const k = kodUr(body.kod);
    const rs = aktiva(db, typ, id).filter(r => r.typ === 'totp');
    if (!rs.length) throw new Fel(400, 'Du har ingen app för engångskoder. Bekräfta med din passkey.', 'ogiltig');
    let anvand = false;
    for (const r of rs) {
      const u = provaKod(db, r, k, nu);
      if (u === 'ok') return { metod: 'totp', faktor: faktorUt(r) };
      if (u === 'anvand') anvand = true;
    }
    throw new Fel(400, anvand ? 'Koden har redan använts. Vänta tills appen visar en ny kod.' : 'Koden stämmer inte. Skriv den kod som appen visar just nu.', 'ogiltig', { falt: ['kod'] });
  }
  if (body?.typ === 'passkey') {
    const u = tagUtmaning(s, 'inloggning', nu);
    if (u.agare !== agareNyckel(typ, id)) throw new Fel(400, 'Utmaningen gällde en annan inloggning. Börja om.', 'ogiltig');
    const svar = body.svar ?? {};
    const credId = b64u(fran64(svar.id ?? svar.rawId, 'id'));
    const r = aktiva(db, typ, id).find(x => x.typ === 'passkey' && x.credential_id === credId);
    if (!r) throw new Fel(400, 'Den passkeyn är inte registrerad för dig i den här sandlådan.', 'nekad');
    const cdRaw = fran64(svar.clientDataJSON, 'clientDataJSON');
    provaKlientdata(cdRaw, 'webauthn.get', u, ursprung);
    const adRaw = fran64(svar.authenticatorData, 'authenticatorData');
    let ad;
    try { ad = lasAutentiseringsdata(adRaw); } catch { throw new Fel(400, 'Svaret från din passkey kunde inte läsas.', 'ogiltig'); }
    if (!ad.rpIdHash.equals(sha256(Buffer.from(rpId)))) throw new Fel(400, 'Passkeyn gällde en annan webbplats och godtas inte.', 'nekad');
    if (!ad.up || !ad.uv) throw new Fel(400, 'Din passkey bekräftade inte att det var du (PIN-kod, fingeravtryck eller ansikte). Försök igen.', 'ogiltig');
    const signatur = fran64(svar.signature, 'signature');
    const data = Buffer.concat([adRaw, sha256(cdRaw)]);
    let ok = false;
    try {
      const key = createPublicKey({ key: JSON.parse(r.publik_nyckel), format: 'jwk' });
      ok = r.algoritm === -7 ? verify('sha256', data, { key, dsaEncoding: 'der' }, signatur) : verify('sha256', data, key, signatur);
    } catch { ok = false; }
    if (!ok) throw new Fel(400, 'Signaturen från din passkey stämmer inte. Försök igen.', 'nekad');
    // Räknaren ska öka om autentiseraren räknar. En lägre räknare kan betyda att nyckeln har kopierats.
    if ((ad.raknare || r.raknare) && ad.raknare <= r.raknare) throw new Fel(400, 'Din passkey svarade med en räknare som inte ökade. Den kan vara kopierad, och godtas inte. Registrera den på nytt.', 'nekad');
    db.query('UPDATE flerfaktorer SET raknare = ?, senast_anvand = ? WHERE id = ?').run(ad.raknare, new Date(nu).toISOString(), r.id);
    return { metod: 'passkey', faktor: faktorUt(r) };
  }
  throw new Fel(400, 'Välj hur du vill bekräfta: med din passkey eller med en kod från appen.', 'ogiltig', { falt: ['typ'] });
}

// Taket på felaktiga försök per användare i sandlådan under en kvart. Räknas i sessionen i minnet.
export function raknaFel(s, agare, nu = Date.now()) {
  s.flerfaktorFel ??= new Map();
  const lista = (s.flerfaktorFel.get(agare) ?? []).filter(t => t > nu - 15 * 60_000);
  lista.push(nu);
  s.flerfaktorFel.set(agare, lista);
  return lista.length;
}
export function sparrad(s, agare, nu = Date.now()) {
  const lista = (s.flerfaktorFel?.get(agare) ?? []).filter(t => t > nu - 15 * 60_000);
  return lista.length >= MAX_FEL_PER_KVART;
}
export { agareNyckel };
