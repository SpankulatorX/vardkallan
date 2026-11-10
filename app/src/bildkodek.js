// Bildkodek för bilder och media (runda 11, r5, Sussa 4.2.1.2 till 4.2.1.4).
//
// Systemet avgör själv vad en fil är ur innehållet och läser det som behövs för journalen: bildens storlek, tiden när
// bilden togs och kameran ur EXIF, filmens och ljudets längd och om filmen har ljud. Servern gör miniatyrer och
// visningsbilder, så att journalen visar samma bild i alla webbläsare och så att originalet aldrig behöver skickas för
// en miniatyr. Allt som tolkas har tak: på antalet pixlar, på antalet delar som läses i en fil och på hur mycket som
// packas upp (lärdomen om dekomprimeringsbomben).
//
// Fotografier avkodas och förminskas med Bun.Image (PNG, JPEG och WebP) med ett tak på pixlar. Ritade bilder (ikoner,
// ljudkurvor och de simulerade bilderna i arkivet) kodas som PNG här, utan att något packas upp.
import { deflateSync } from 'node:zlib';

// Taket för en bild som avkodas: 16 miljoner pixlar räcker för en mobilkamera på 12 megapixel.
export const MAX_PIXLAR = 16_000_000;
// Så många delar (boxar eller element) läses högst i en film- eller ljudfil, och så djupt.
export const MAX_DELAR = 2000;
const MAX_DJUP = 8;

// ---- Typen ur innehållet -------------------------------------------------------------------------------------------

const ascii = (buf, fran, langd) => buf.subarray(fran, fran + langd).toString('latin1');

// Typen och slaget (bild, video, ljud eller dokument) ur filens första byte. null när filen inte är något som stöds.
export function typUrInnehall(buf) {
  if (!buf || buf.length < 4) return null;
  if (ascii(buf, 0, 5) === '%PDF-') return { typ: 'application/pdf', slag: 'dokument' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { typ: 'image/png', slag: 'bild' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { typ: 'image/jpeg', slag: 'bild' };
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') return { typ: 'image/webp', slag: 'bild' };
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WAVE') return { typ: 'audio/wav', slag: 'ljud' };
  if (buf.length >= 12 && ascii(buf, 4, 4) === 'ftyp') {
    const info = mp4Info(buf);
    if (info.video) return { typ: 'video/mp4', slag: 'video' };
    if (info.ljud) return { typ: 'audio/mp4', slag: 'ljud' };
    return null;
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const info = webmInfo(buf);
    if (info.doctype !== 'webm') return null;
    if (info.video) return { typ: 'video/webm', slag: 'video' };
    if (info.ljud) return { typ: 'audio/webm', slag: 'ljud' };
    return null;
  }
  if (ascii(buf, 0, 4) === 'OggS') return { typ: 'audio/ogg', slag: 'ljud' };
  if (ascii(buf, 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0)) return { typ: 'audio/mpeg', slag: 'ljud' };
  return null;
}

// ---- MP4 (ISO BMFF) ------------------------------------------------------------------------------------------------

// Längd, spår och bildstorlek ur en MP4-fil. Läser boxarna moov, mvhd, trak, tkhd, mdia och hdlr, med tak på antal och djup.
export function mp4Info(buf) {
  const ut = { video: false, ljud: false, langdSek: null, bredd: null, hojd: null };
  let antal = 0;
  const las = (fran, till, djup) => {
    let p = fran;
    while (p + 8 <= till && antal++ < MAX_DELAR) {
      let storlek = buf.readUInt32BE(p);
      const typ = ascii(buf, p + 4, 4);
      let huvud = 8;
      if (storlek === 1) {
        if (p + 16 > till) return;
        const stor = buf.readBigUInt64BE(p + 8);
        if (stor > BigInt(till - p)) return;
        storlek = Number(stor);
        huvud = 16;
      } else if (storlek === 0) storlek = till - p;
      if (storlek < huvud || p + storlek > till) return;
      const inne = p + huvud, slut = p + storlek;
      if (['moov', 'trak', 'mdia'].includes(typ) && djup < MAX_DJUP) las(inne, slut, djup + 1);
      else if (typ === 'mvhd' && slut - inne >= 20) {
        const v = buf[inne];
        const skala = v === 1 ? (slut - inne >= 32 ? buf.readUInt32BE(inne + 20) : 0) : buf.readUInt32BE(inne + 12);
        const langd = v === 1 ? (slut - inne >= 32 ? Number(buf.readBigUInt64BE(inne + 24)) : 0) : buf.readUInt32BE(inne + 16);
        if (skala > 0 && Number.isFinite(langd)) ut.langdSek = Math.round((langd / skala) * 10) / 10;
      } else if (typ === 'tkhd' && slut - inne >= 84) {
        const b = buf.readUInt32BE(slut - 8) / 65536, h = buf.readUInt32BE(slut - 4) / 65536;
        if (b > 0 && h > 0 && !ut.bredd) { ut.bredd = Math.round(b); ut.hojd = Math.round(h); }
      } else if (typ === 'hdlr' && slut - inne >= 12) {
        const h = ascii(buf, inne + 8, 4);
        if (h === 'vide') ut.video = true;
        if (h === 'soun') ut.ljud = true;
      }
      p = slut;
    }
  };
  las(0, buf.length, 0);
  return ut;
}

// ---- WebM (Matroska) -----------------------------------------------------------------------------------------------

// Ett tal i EBML: längden står i de inledande bitarna. id behåller markeringen, storlek gör det inte.
function vint(buf, p, behall) {
  if (p >= buf.length) return null;
  const forsta = buf[p];
  let langd = 1;
  while (langd <= 8 && !(forsta & (0x80 >> (langd - 1)))) langd++;
  if (langd > 8 || p + langd > buf.length) return null;
  let v = behall ? forsta : forsta & (0xff >> langd);
  let alla = v === (0xff >> langd);
  for (let i = 1; i < langd; i++) { v = v * 256 + buf[p + i]; if (buf[p + i] !== 0xff) alla = false; }
  return { v, langd, okand: !behall && alla };
}
const uint = (buf, p, n) => { let v = 0; for (let i = 0; i < n && i < 8; i++) v = v * 256 + buf[p + i]; return v; };

// DocType, längd och spår ur en WebM-fil, med tak på antal element och djup. Klustren med själva filmen hoppas över.
export function webmInfo(buf) {
  const ut = { doctype: null, video: false, ljud: false, langdSek: null, bredd: null, hojd: null };
  let skala = 1_000_000, langd = null, antal = 0;
  const BEHALLARE = new Set([0x1a45dfa3, 0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0]);
  const las = (fran, till, djup) => {
    let p = fran;
    while (p < till && antal++ < MAX_DELAR) {
      const id = vint(buf, p, true);
      if (!id) return;
      const st = vint(buf, p + id.langd, false);
      if (!st) return;
      const inne = p + id.langd + st.langd;
      const slut = st.okand ? till : Math.min(till, inne + st.v);
      if (inne > till) return;
      if (id.v === 0x1f43b675) { if (st.okand) return; p = slut; continue; }
      if (BEHALLARE.has(id.v) && djup < MAX_DJUP) las(inne, slut, djup + 1);
      else if (id.v === 0x4282) ut.doctype = ascii(buf, inne, Math.min(16, slut - inne)).replace(/\0+$/, '');
      else if (id.v === 0x2ad7b1) skala = uint(buf, inne, slut - inne) || skala;
      else if (id.v === 0x4489) langd = slut - inne === 8 ? buf.readDoubleBE(inne) : slut - inne === 4 ? buf.readFloatBE(inne) : null;
      else if (id.v === 0x83) { const t = uint(buf, inne, slut - inne); if (t === 1) ut.video = true; if (t === 2) ut.ljud = true; }
      else if (id.v === 0xb0) ut.bredd = uint(buf, inne, slut - inne);
      else if (id.v === 0xba) ut.hojd = uint(buf, inne, slut - inne);
      if (st.okand) return;
      p = slut;
    }
  };
  las(0, buf.length, 0);
  if (Number.isFinite(langd) && langd > 0) ut.langdSek = Math.round((langd * skala) / 1e8) / 10;
  return ut;
}

// ---- WAV -----------------------------------------------------------------------------------------------------------

export function wavInfo(buf) {
  const ut = { kanaler: null, frekvens: null, bitar: null, langdSek: null, data: null };
  let p = 12, antal = 0, byteRate = 0;
  while (p + 8 <= buf.length && antal++ < MAX_DELAR) {
    const id = ascii(buf, p, 4);
    const storlek = buf.readUInt32LE(p + 4);
    const inne = p + 8, slut = Math.min(buf.length, inne + storlek);
    if (id === 'fmt ' && slut - inne >= 16) {
      ut.kanaler = buf.readUInt16LE(inne + 2); ut.frekvens = buf.readUInt32LE(inne + 4); byteRate = buf.readUInt32LE(inne + 8); ut.bitar = buf.readUInt16LE(inne + 14);
    } else if (id === 'data') {
      ut.data = [inne, slut];
      if (byteRate > 0) ut.langdSek = Math.round(((slut - inne) / byteRate) * 10) / 10;
    }
    p = inne + storlek + (storlek % 2);
  }
  return ut;
}

// ---- EXIF i JPEG ---------------------------------------------------------------------------------------------------

// Tiden när bilden togs, kameran, orienteringen och om bilden bär platsuppgifter. Läser bara APP1 med EXIF, med tak.
export function exifInfo(buf) {
  const ut = { tagen: null, kamera: null, orientering: 1, plats: false };
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return ut;
  let p = 2, antal = 0;
  while (p + 4 <= buf.length && antal++ < 100) {
    if (buf[p] !== 0xff) return ut;
    const markor = buf[p + 1];
    if (markor === 0xda || markor === 0xd9) return ut;
    const langd = buf.readUInt16BE(p + 2);
    if (markor === 0xe1 && langd > 14 && ascii(buf, p + 4, 6) === 'Exif\0\0') {
      lasTiff(buf.subarray(p + 10, Math.min(buf.length, p + 2 + langd)), ut);
      return ut;
    }
    p += 2 + langd;
  }
  return ut;
}

function lasTiff(t, ut) {
  if (t.length < 8) return;
  const le = ascii(t, 0, 2) === 'II';
  if (!le && ascii(t, 0, 2) !== 'MM') return;
  const u16 = (o) => (o + 2 <= t.length ? (le ? t.readUInt16LE(o) : t.readUInt16BE(o)) : 0);
  const u32 = (o) => (o + 4 <= t.length ? (le ? t.readUInt32LE(o) : t.readUInt32BE(o)) : 0);
  const text = (typ, antal, varde, o) => {
    if (typ !== 2 || antal === 0 || antal > 64) return null;
    const fran = antal <= 4 ? o + 8 : varde;
    if (fran + antal > t.length) return null;
    return ascii(t, fran, antal).replace(/\0.*$/s, '').trim() || null;
  };
  const ifd = (o, fn) => {
    const n = u16(o);
    if (!n || n > 200 || o + 2 + n * 12 > t.length) return;
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      fn(u16(e), u16(e + 2), u32(e + 4), u32(e + 8), e);
    }
  };
  let marke = null, modell = null, exif = 0;
  ifd(u32(4), (tag, typ, antal, varde, e) => {
    if (tag === 0x010f) marke = text(typ, antal, varde, e);
    else if (tag === 0x0110) modell = text(typ, antal, varde, e);
    else if (tag === 0x0112 && typ === 3) { const v = u16(e + 8); if (v >= 1 && v <= 8) ut.orientering = v; }
    else if (tag === 0x8769) exif = varde;
    else if (tag === 0x8825) ut.plats = true;
  });
  if (exif) {
    ifd(exif, (tag, typ, antal, varde, e) => {
      if (tag !== 0x9003) return;
      const s = text(typ, antal, varde, e);
      const m = s && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
      // EXIF anger lokal tid utan tidszon. Systemet tolkar den som svensk tid.
      if (m) ut.tagen = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    });
  }
  ut.kamera = [marke, modell && marke && modell.startsWith(marke) ? modell.slice(marke.length).trim() : modell].filter(Boolean).join(' ') || null;
}

// ---- Fotografier med Bun.Image -------------------------------------------------------------------------------------

// Bildens storlek, som den ska visas: Bun.Image vrider bilden efter orienteringen i EXIF. Kastar när bilden inte går
// att läsa eller har fler pixlar än taket.
export async function bildStorlek(buf) {
  const m = await new Bun.Image(buf, { maxPixels: MAX_PIXLAR }).metadata();
  return { bredd: m.width, hojd: m.height, format: m.format };
}

// En förminskad JPEG som ryms i maxSida gånger maxSida pixlar och står rätt efter EXIF. Bilden förstoras aldrig. Den
// förminskade bilden har ingen EXIF, så platsuppgifter i originalet följer inte med.
export async function forminska(buf, maxSida, { kvalitet = 82 } = {}) {
  const { bredd, hojd } = await bildStorlek(buf);
  const skala = Math.min(1, maxSida / Math.max(bredd, hojd));
  const b = Math.max(1, Math.round(bredd * skala)), h = Math.max(1, Math.round(hojd * skala));
  const data = Buffer.from(await new Bun.Image(buf, { maxPixels: MAX_PIXLAR }).resize(b, h).jpeg({ quality: kvalitet }).bytes());
  return { data, typ: 'image/jpeg', bredd: b, hojd: h };
}

// ---- PNG för ritade bilder -----------------------------------------------------------------------------------------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let x = 0xffffffff;
  for (let i = 0; i < buf.length; i++) x = CRC[(x ^ buf[i]) & 0xff] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
}
function del(typ, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(typ, 4, 'latin1');
  data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
}

// PNG ur pixlar: kanaler 1 (gråskala), 3 (RGB) eller 4 (RGBA), 8 bitar. Varje rad filtreras med Sub.
export function kodaPng(pixlar, bredd, hojd, kanaler = 1) {
  const fargtyp = { 1: 0, 3: 2, 4: 6 }[kanaler];
  if (fargtyp == null || pixlar.length !== bredd * hojd * kanaler) throw new Error('Fel antal pixlar');
  const rad = bredd * kanaler;
  const ra = Buffer.alloc((rad + 1) * hojd);
  for (let y = 0; y < hojd; y++) {
    const o = y * (rad + 1), k = y * rad;
    ra[o] = 1;
    for (let x = 0; x < rad; x++) ra[o + 1 + x] = (pixlar[k + x] - (x >= kanaler ? pixlar[k + x - kanaler] : 0)) & 0xff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bredd, 0); ihdr.writeUInt32BE(hojd, 4); ihdr[8] = 8; ihdr[9] = fargtyp;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), del('IHDR', ihdr), del('IDAT', deflateSync(ra, { level: 6 })), del('IEND', Buffer.alloc(0))]);
}

// ---- Ritning -------------------------------------------------------------------------------------------------------

// En duk med RGB-pixlar och enkla former, för ikoner, ljudkurvor och de simulerade bilderna.
export class Duk {
  constructor(bredd, hojd, farg = [255, 255, 255]) {
    this.bredd = bredd; this.hojd = hojd; this.px = new Uint8Array(bredd * hojd * 3);
    this.fyll(0, 0, bredd, hojd, farg);
  }
  satt(x, y, [r, g, b], alfa = 1) {
    if (x < 0 || y < 0 || x >= this.bredd || y >= this.hojd) return;
    const i = (y * this.bredd + x) * 3;
    this.px[i] = Math.round(this.px[i] * (1 - alfa) + r * alfa);
    this.px[i + 1] = Math.round(this.px[i + 1] * (1 - alfa) + g * alfa);
    this.px[i + 2] = Math.round(this.px[i + 2] * (1 - alfa) + b * alfa);
  }
  fyll(x0, y0, b, h, farg) { for (let y = Math.max(0, y0); y < Math.min(this.hojd, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(this.bredd, x0 + b); x++) this.satt(x, y, farg); }
  ellips(cx, cy, rx, ry, farg, alfa = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) this.satt(x, y, farg, alfa * Math.min(1, (1 - d) * 6));
      }
    }
  }
  triangel([ax, ay], [bx, by], [cx, cy], farg) {
    const kant = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++) {
      for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
        const d1 = kant(x, y, ax, ay, bx, by), d2 = kant(x, y, bx, by, cx, cy), d3 = kant(x, y, cx, cy, ax, ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.satt(x, y, farg);
      }
    }
  }
  png() { return kodaPng(this.px, this.bredd, this.hojd, 3); }
}

// Miniatyren för en film, ett ljud eller ett dokument, som servern ritar när den inte kan göra en bild ur filen.
// För ett ljud i WAV ritar systemet ljudkurvan ur själva ljudet.
export function ritadMiniatyr(slag, buf = null) {
  const d = new Duk(256, 192, slag === 'video' ? [38, 50, 56] : slag === 'ljud' ? [232, 240, 247] : [245, 245, 240]);
  if (slag === 'video') {
    d.ellips(128, 96, 44, 44, [255, 255, 255], 0.9);
    d.triangel([114, 74], [114, 118], [150, 96], [38, 50, 56]);
  } else if (slag === 'ljud') {
    const kurva = buf ? ljudkurva(buf, 200) : null;
    for (let i = 0; i < 200; i++) {
      const v = kurva ? kurva[i] : 0.15 + 0.6 * Math.abs(Math.sin(i / 7) * Math.sin(i / 23));
      const h = Math.max(2, Math.round(v * 140));
      d.fyll(28 + i, 96 - Math.round(h / 2), 1, h, [27, 94, 140]);
    }
  } else {
    d.fyll(78, 26, 100, 140, [255, 255, 255]);
    for (let i = 0; i < 6; i++) d.fyll(92, 48 + i * 18, i === 5 ? 44 : 72, 6, [160, 160, 160]);
    d.fyll(78, 26, 100, 3, [180, 40, 40]);
  }
  return d.png();
}

// Ljudkurvan ur PCM i WAV (8 eller 16 bitar): den största utslaget i varje del, mellan 0 och 1. null för annat ljud.
export function ljudkurva(buf, delar = 200) {
  const w = wavInfo(buf);
  if (!w.data || ![8, 16].includes(w.bitar) || !w.kanaler) return null;
  const [fran, till] = w.data;
  const steg = (w.bitar / 8) * w.kanaler;
  const antal = Math.floor((till - fran) / steg);
  if (antal < delar) return null;
  const ut = new Array(delar).fill(0);
  const per = Math.floor(antal / delar);
  for (let i = 0; i < delar; i++) {
    let max = 0;
    for (let j = 0; j < per; j += Math.max(1, Math.floor(per / 400))) {
      const o = fran + (i * per + j) * steg;
      const v = w.bitar === 16 ? Math.abs(buf.readInt16LE(o)) / 32768 : Math.abs(buf[o] - 128) / 128;
      if (v > max) max = v;
    }
    ut[i] = max;
  }
  return ut;
}
