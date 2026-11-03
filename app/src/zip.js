// En enkel ZIP-fil utan komprimering (metoden stored), så att exportpaketet går att öppna med vanliga verktyg utan
// externa beroenden. Filnamnen är UTF-8 (flagga 11). Kataloger läggs in som egna poster så att tomma mappar finns med.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTid(d) {
  const tid = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
  const datum = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { tid, datum };
}

// filer: [{ namn, data (Buffer eller sträng) }]. Ett namn som slutar med / är en katalog.
export function zip(filer, tidpunkt = new Date()) {
  const { tid, datum } = dosTid(tidpunkt);
  const lokala = [];
  const centrala = [];
  let offset = 0;
  for (const f of filer) {
    const namn = Buffer.from(f.namn, 'utf8');
    const data = f.namn.endsWith('/') ? Buffer.alloc(0) : Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data ?? ''), 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(tid, 10); lh.writeUInt16LE(datum, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(namn.length, 26); lh.writeUInt16LE(0, 28);
    lokala.push(lh, namn, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(tid, 12); ch.writeUInt16LE(datum, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(namn.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(f.namn.endsWith('/') ? 0x10 : 0, 38); ch.writeUInt32LE(offset, 42);
    centrala.push(ch, namn);
    offset += 30 + namn.length + data.length;
  }
  const central = Buffer.concat(centrala);
  const slut = Buffer.alloc(22);
  slut.writeUInt32LE(0x06054b50, 0); slut.writeUInt16LE(0, 4); slut.writeUInt16LE(0, 6); slut.writeUInt16LE(filer.length, 8);
  slut.writeUInt16LE(filer.length, 10); slut.writeUInt32LE(central.length, 12); slut.writeUInt32LE(offset, 16); slut.writeUInt16LE(0, 20);
  return Buffer.concat([...lokala, central, slut]);
}

// Läser en ZIP-fil som zip() har skrivit. Används av testerna för att kontrollera paketet.
export function packaUpp(buf) {
  const ut = new Map();
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const storlek = buf.readUInt32LE(i + 18);
    const nl = buf.readUInt16LE(i + 26);
    const el = buf.readUInt16LE(i + 28);
    const namn = buf.subarray(i + 30, i + 30 + nl).toString('utf8');
    const data = buf.subarray(i + 30 + nl + el, i + 30 + nl + el + storlek);
    ut.set(namn, { data, crc: buf.readUInt32LE(i + 14) });
    i += 30 + nl + el + storlek;
  }
  return ut;
}
