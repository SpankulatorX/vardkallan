// Testfiler för bilder och media (runda 11, r5): små filer som byggs i testet, så att inga riktiga bilder, filmer eller
// ljud behövs. Varje fil har bara de delar som systemet läser.
import { kodaPng, Duk } from '../src/bildkodek.js';

const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const box = (typ, ...delar) => { const inne = Buffer.concat(delar); return Buffer.concat([u32(8 + inne.length), Buffer.from(typ, 'latin1'), inne]); };

// En PNG med en bild av ett sår på huden, i den storlek som anges.
export function sarPng(bredd = 64, hojd = 48, storlek = 0.3) {
  const d = new Duk(bredd, hojd, [224, 186, 160]);
  d.ellips(bredd / 2, hojd / 2, bredd * storlek, hojd * storlek, [170, 40, 40]);
  return d.png();
}

// En JPEG gjord ur en PNG, med EXIF (tid, kamera, orientering och om platsuppgifter finns) om det anges.
export async function jpeg({ bredd = 64, hojd = 48, exif = null } = {}) {
  const ren = Buffer.from(await new Bun.Image(sarPng(bredd, hojd)).jpeg({ quality: 80 }).bytes());
  if (!exif) return ren;
  return Buffer.concat([ren.subarray(0, 2), app1(exif), ren.subarray(2)]);
}

// APP1 med EXIF i storendian: Make, Model, Orientation, pekare till Exif-IFD med DateTimeOriginal, och GPS-pekare.
function app1({ tagen = '2026:11:02 14:30:00', marke = 'Demokamera', modell = 'Demokamera X1', orientering = 1, plats = false }) {
  const poster = [];
  const extra = [];
  const ifd0Antal = 4 + (plats ? 1 : 0);
  const ifd0Slut = 8 + 2 + ifd0Antal * 12 + 4;
  let dataPos = ifd0Slut;
  const textPost = (tag, s) => {
    const b = Buffer.from(`${s}\0`, 'latin1');
    poster.push([tag, 2, b.length, dataPos]);
    extra.push(b);
    dataPos += b.length;
  };
  textPost(0x010f, marke);
  textPost(0x0110, modell);
  poster.push([0x0112, 3, 1, orientering << 16]);
  const exifIfd = dataPos;
  poster.push([0x8769, 4, 1, exifIfd]);
  if (plats) poster.push([0x8825, 4, 1, 0]);
  poster.sort((a, b) => a[0] - b[0]);
  const tid = Buffer.from(`${tagen}\0`, 'latin1');
  const exifDel = Buffer.alloc(2 + 12 + 4 + tid.length);
  exifDel.writeUInt16BE(1, 0);
  exifDel.writeUInt16BE(0x9003, 2); exifDel.writeUInt16BE(2, 4); exifDel.writeUInt32BE(tid.length, 6); exifDel.writeUInt32BE(exifIfd + 18, 10);
  tid.copy(exifDel, 18);
  const ifd0 = Buffer.alloc(2 + poster.length * 12 + 4);
  ifd0.writeUInt16BE(poster.length, 0);
  poster.forEach(([tag, typ, antal, varde], i) => { const o = 2 + i * 12; ifd0.writeUInt16BE(tag, o); ifd0.writeUInt16BE(typ, o + 2); ifd0.writeUInt32BE(antal, o + 4); ifd0.writeUInt32BE(varde >>> 0, o + 8); });
  const tiff = Buffer.concat([Buffer.from('MM\0*', 'latin1'), u32(8), ifd0, ...extra, exifDel]);
  const kropp = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const h = Buffer.alloc(4); h[0] = 0xff; h[1] = 0xe1; h.writeUInt16BE(kropp.length + 2, 2);
  return Buffer.concat([h, kropp]);
}

// En MP4 med en film eller bara ljud, med längd och bildstorlek i boxarna.
export function mp4({ video = true, sekunder = 12, bredd = 320, hojd = 240, fyllnad = 0 } = {}) {
  const mvhd = Buffer.alloc(100); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(sekunder * 1000, 16);
  const tkhd = Buffer.alloc(84); tkhd.writeUInt32BE(bredd * 65536, 76); tkhd.writeUInt32BE(hojd * 65536, 80);
  const hdlr = Buffer.alloc(24); hdlr.write(video ? 'vide' : 'soun', 8, 'latin1');
  const ftyp = box('ftyp', Buffer.from(video ? 'isom' : 'M4A ', 'latin1'), u32(0x200), Buffer.from('isomiso2', 'latin1'));
  return Buffer.concat([ftyp, box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd), box('mdia', box('hdlr', hdlr)))), box('mdat', Buffer.alloc(fyllnad))]);
}

// En WebM med ett videospår eller ett ljudspår, med längd i Info om den anges.
export function webm({ video = true, sekunder = null, bredd = 320, hojd = 240, fyllnad = 0 } = {}) {
  const el = (id, data) => {
    const idb = Buffer.from(id.toString(16).padStart(id > 0xffffff ? 8 : id > 0xffff ? 6 : id > 0xff ? 4 : 2, '0'), 'hex');
    const n = data.length;
    const st = Buffer.alloc(8); st[0] = 0x01; st.writeUIntBE(Math.floor(n / 2 ** 24), 1, 3); st.writeUIntBE(n % 2 ** 24, 4, 4);
    return Buffer.concat([idb, st, data]);
  };
  const uintEl = (id, v) => el(id, Buffer.from([v]));
  const header = el(0x1a45dfa3, Buffer.concat([el(0x4282, Buffer.from('webm', 'latin1'))]));
  const info = [uintEl(0x2ad7b1, 0)];
  info[0] = el(0x2ad7b1, Buffer.from([0x0f, 0x42, 0x40]));
  if (sekunder != null) { const f = Buffer.alloc(8); f.writeDoubleBE(sekunder * 1000); info.push(el(0x4489, f)); }
  const spar = video
    ? Buffer.concat([uintEl(0x83, 1), el(0xe0, Buffer.concat([el(0xb0, Buffer.from([bredd >> 8, bredd & 0xff])), el(0xba, Buffer.from([hojd >> 8, hojd & 0xff]))]))])
    : uintEl(0x83, 2);
  const segment = el(0x18538067, Buffer.concat([el(0x1549a966, Buffer.concat(info)), el(0x1654ae6b, el(0xae, spar)), el(0x1f43b675, Buffer.alloc(fyllnad))]));
  return Buffer.concat([header, segment]);
}

// En WAV med en ton, 8 kHz och 16 bitar i mono.
export function wav(sekunder = 1, frekvens = 8000) {
  const n = sekunder * frekvens;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin(i / 8) * 12000 * (i / n)), i * 2);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(1, 2); fmt.writeUInt32LE(frekvens, 4); fmt.writeUInt32LE(frekvens * 2, 8); fmt.writeUInt16LE(2, 12); fmt.writeUInt16LE(16, 14);
  const chunk = (id, b) => { const h = Buffer.alloc(8); h.write(id, 0, 'latin1'); h.writeUInt32LE(b.length, 4); return Buffer.concat([h, b]); };
  const inne = Buffer.concat([Buffer.from('WAVE', 'latin1'), chunk('fmt ', fmt), chunk('data', data)]);
  const h = Buffer.alloc(8); h.write('RIFF', 0, 'latin1'); h.writeUInt32LE(inne.length, 4);
  return Buffer.concat([h, inne]);
}

// En PNG vars huvud påstår en mycket stor bild, men som är liten packad: en dekomprimeringsbomb.
export function bombPng(sida = 30000) {
  const p = kodaPng(new Uint8Array(4), 2, 2, 1);
  // Byter storleken i IHDR och räknar om dess kontrollsumma genom att koda om huvudet.
  const ihdr = Buffer.from(p.subarray(8, 33));
  ihdr.writeUInt32BE(sida, 8); ihdr.writeUInt32BE(sida, 12);
  const crc = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(crc, 21);
  return Buffer.concat([p.subarray(0, 8), ihdr, p.subarray(33)]);
}
function crc32(buf) {
  let x = 0xffffffff;
  for (const v of buf) { x ^= v; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; }
  return (x ^ 0xffffffff) >>> 0;
}
