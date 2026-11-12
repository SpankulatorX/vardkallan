// Sandlådor som vilar på disk (runda 13, r2). En sandlåda som inte har använts på en stund skrivs till disk och släpps
// ur minnet, och läses in igen nästa gång besökaren gör ett anrop. Bara databasen och det som kan växa (läskopiornas
// kopplingar och svarstiderna) skrivs till disk. Resten av sessionen, som är litet, finns kvar i minnet, så att allt som
// pekar på sandlådan (miljöer, åtkomstbiljetter, utrustningens nycklar, prenumerationer) gäller som förut.
//
// Filen heter efter en HMAC av sandlådans stabila id (kopieId) med en hemlig nyckel, aldrig efter sessionskakan eller
// id:t självt. Innehållet är komprimerat med zstd: en sandlåda på 3,3 MB blir omkring 0,3 MB på disken.
//
// Systemet räknar själv ut hur många sandlådor som får vara i minnet ur containerns minnesgräns (cgroup), och hur många
// som får vila ur diskens storlek och ledigt utrymme. Driften kan sätta taken med miljövariabler.
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync, statSync, statfsSync } from 'node:fs';
import { join } from 'node:path';

const MAGI = Buffer.from('VKV1');

// Packar databasen och sessionens tunga delar i ett block: magi, längden på metadata (4 byte), metadata som JSON och
// databasen. Hela blocket komprimeras.
export function packa(data, meta = {}) {
  const m = Buffer.from(JSON.stringify(meta), 'utf8');
  const langd = Buffer.alloc(4);
  langd.writeUInt32BE(m.length);
  return Bun.zstdCompressSync(Buffer.concat([MAGI, langd, m, Buffer.from(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength)]), { level: 3 });
}
export function packaUpp(komprimerat) {
  const b = Buffer.from(Bun.zstdDecompressSync(komprimerat));
  if (!b.subarray(0, 4).equals(MAGI)) throw new Error('Filen är inte en vilande sandlåda.');
  const n = b.readUInt32BE(4);
  const meta = JSON.parse(b.subarray(8, 8 + n).toString('utf8'));
  return { meta, data: b.subarray(8 + n) };
}

// Lagret med vilande sandlådor: en katalog på disken, eller en karta i minnet när servern inte sparar till disk (då
// sparar vilan ändå minne, eftersom sandlådan ligger komprimerad).
export function skapaVilolager({ katalog = null, hemlighet = randomBytes(32) } = {}) {
  const namn = (id) => createHmac('sha256', hemlighet).update(`vila:${id}`).digest('hex').slice(0, 32);
  const storlek = new Map();
  const minne = katalog ? null : new Map();
  if (katalog) {
    mkdirSync(katalog, { recursive: true, mode: 0o700 });
    // Filerna som redan finns räknas med i diskutrymmet.
    for (const f of readdirSync(katalog)) {
      if (!/^[0-9a-f]{32}\.vila$/.test(f)) continue;
      try { storlek.set(f.slice(0, 32), statSync(join(katalog, f)).size); } catch { /* borta */ }
    }
  }
  const fil = (k) => join(katalog, `${k}.vila`);
  function vila(id, data, meta) {
    const k = namn(id);
    const b = packa(data, meta);
    if (minne) minne.set(k, b);
    else {
      writeFileSync(fil(k) + '.tmp', b, { mode: 0o600 });
      renameSync(fil(k) + '.tmp', fil(k));
    }
    storlek.set(k, b.byteLength);
    return { byte: b.byteLength };
  }
  function vakna(id) {
    const k = namn(id);
    const b = minne ? minne.get(k) : (existsSync(fil(k)) ? readFileSync(fil(k)) : null);
    if (!b) return null;
    return packaUpp(b);
  }
  // Läser bara databasen ur filen, utan att väcka sandlådan (säkerhetskopiorna).
  const data = (id) => vakna(id)?.data ?? null;
  function radera(id) {
    const k = namn(id);
    storlek.delete(k);
    if (minne) minne.delete(k); else rmSync(fil(k), { force: true });
  }
  const finns = (id) => storlek.has(namn(id));
  // Tar bort filerna för sandlådor som inte finns. levande är id:n för sandlådorna som finns.
  function stada(levande) {
    const behall = new Set([...levande].filter(Boolean).map(namn));
    let n = 0;
    for (const k of [...storlek.keys()]) if (!behall.has(k)) { storlek.delete(k); if (minne) minne.delete(k); else rmSync(fil(k), { force: true }); n++; }
    if (katalog) for (const f of readdirSync(katalog)) if (/\.vila\.tmp$/.test(f)) rmSync(join(katalog, f), { force: true });
    return n;
  }
  const byte = () => { let s = 0; for (const v of storlek.values()) s += v; return s; };
  return { vila, vakna, data, radera, finns, stada, byte, antal: () => storlek.size, namn, typ: minne ? 'minne' : 'katalog', katalog };
}

// ---------------------------------------------------------------------------------------------------------------
// Taken. Systemet räknar ut dem själv ur minnesgränsen och disken.

// Mätt med lasttestet i runda 13 (docs/design.md, Kapacitet): processen utan sandlådor och en sandlåda i arbete.
export const MATT = { basMb: 230, perSandladaMb: 9 };
// Så stor del av minnesgränsen som sandlådorna får använda. Resten är marginal för sandlådor som byts, svar som byggs
// och skräpsamlingen.
const ANDEL = 0.8;

// Containerns minnesgräns i byte (cgroup v2 och v1), eller null utan gräns.
export function minnesgrans(las = (f) => readFileSync(f, 'utf8')) {
  for (const f of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const t = las(f).trim();
      if (t === 'max') return null;
      const n = Number(t);
      // cgroup v1 visar ett mycket stort tal när gränsen saknas.
      if (Number.isFinite(n) && n > 0 && n < 2 ** 50) return n;
    } catch { /* nästa */ }
  }
  return null;
}
// Det minne som containern använder just nu enligt cgroup, eller null.
export function minneNu(las = (f) => readFileSync(f, 'utf8')) {
  for (const f of ['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']) {
    try { const n = Number(las(f).trim()); if (Number.isFinite(n) && n > 0) return n; } catch { /* nästa */ }
  }
  return null;
}

// Hur många sandlådor som får vara i minnet med en minnesgräns i byte. Utan gräns gäller standardvärdet.
// Runda 13, r2: med cpu (antal processorer, till exempel 0,75) gäller också taket per processor. Vågen i lasttestet
// 2026-11-12 med 0,75 processor: 65 platser höll p95 under 160 ms, 110 platser gav p95 över två sekunder, eftersom fler
// besökare i arbete då delar samma processor. Taket räknas därför ur det som tar slut först.
export const PER_PROCESSOR = 85;
export function maxIMinnet(grans, { basMb = MATT.basMb, perSandladaMb = MATT.perSandladaMb, standard = 40, cpu = null } = {}) {
  const minne = grans ? Math.max(2, Math.floor((grans / 1048576 * ANDEL - basMb) / perSandladaMb)) : standard;
  return cpu ? Math.min(minne, Math.max(2, Math.floor(cpu * PER_PROCESSOR))) : minne;
}
// Containerns processorer enligt cgroup (cpu.max i v2, kvoten i v1), eller null utan gräns.
export function processorer(las = (f) => readFileSync(f, 'utf8')) {
  try {
    const [kvot, period] = las('/sys/fs/cgroup/cpu.max').trim().split(/\s+/);
    if (kvot === 'max') return null;
    const n = Number(kvot) / Number(period);
    if (Number.isFinite(n) && n > 0) return n;
  } catch { /* v1 */ }
  try {
    const k = Number(las('/sys/fs/cgroup/cpu/cpu.cfs_quota_us').trim());
    const p = Number(las('/sys/fs/cgroup/cpu/cpu.cfs_period_us').trim());
    if (k > 0 && p > 0) return k / p;
  } catch { /* ingen gräns */ }
  return null;
}
// Hur många besökare som kan arbeta samtidigt med en minnesgräns i MB, för dokumentationen och driftsidan.
export const besokareFor = (mb, matt = MATT) => maxIMinnet(mb * 1048576, matt);

// Diskens lediga utrymme i byte där katalogen ligger, eller null.
export function ledigtPaDisk(katalog) {
  if (!katalog) return null;
  try { const s = statfsSync(katalog); return s.bavail * s.bsize; } catch { return null; }
}

// Sekunder tills det är lönt att försöka igen, ur när platser blir lediga. tider är millisekunder då en plats blir ledig.
export function forsokIgenOm(tider, nu = Date.now(), { min = 30, max = 15 * 60 } = {}) {
  const forsta = tider.filter(Number.isFinite).sort((a, b) => a - b)[0];
  const s = forsta == null ? max : Math.ceil((forsta - nu) / 1000);
  return Math.max(min, Math.min(max, s));
}
