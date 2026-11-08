// Runda 9, r5: certifikat mellan instanser och delsystem (Sussa 5.3.1.8). Varje instans som Vårdkällan utbyter
// meddelanden med (det simulerade laboratoriet, den simulerade läkemedelslistan och det simulerade e-arkivet) och
// Vårdkällan själv har ett X.509-certifikat med en nyckel för ECDSA P-256. Certifikaten är utfärdade av en
// mellanliggande utfärdare, som i sin tur är utfärdad av en rotutfärdare.
//
// Rotutfärdaren är en test-CA som står för den publikt erkända utfärdaren i demon. Den skapas när servern startar och är
// inte publikt erkänd. I drift används certifikat från en utfärdare som är publikt erkänd, och listan över betrodda
// utfärdare innehåller den. Kontrollen är densamma: kedjan ska gå till en betrodd rot, varje certifikat ska vara signerat
// av nästa, gälla vid tidpunkten och inte vara återkallat, och bara en utfärdare får utfärda certifikat.
//
// Certifikaten byggs här i DER (ASN.1) och läses och kontrolleras med X509Certificate i node:crypto, så att kontrollen
// görs av samma kod som läser vilket certifikat som helst. Återkallade certifikat står i en spärrlista per sandlåda, så
// att en återkallelse i demon aldrig påverkar andra besökare.
import { X509Certificate, generateKeyPairSync, sign, createHash, randomBytes } from 'node:crypto';

// DER: längd, TLV och de typer som certifikatet behöver.
const len = (n) => (n < 128 ? Buffer.from([n]) : (() => { const b = []; while (n) { b.unshift(n & 0xff); n >>= 8; } return Buffer.from([0x80 | b.length, ...b]); })());
const tlv = (tag, inne) => Buffer.concat([Buffer.from([tag]), len(inne.length), inne]);
const seq = (...d) => tlv(0x30, Buffer.concat(d));
const set = (...d) => tlv(0x31, Buffer.concat(d));
const heltal = (buf) => tlv(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const sant = () => Buffer.from([0x01, 0x01, 0xff]);
const oktett = (b) => tlv(0x04, b);
const bitar = (b, oanvanda = 0) => tlv(0x03, Buffer.concat([Buffer.from([oanvanda]), b]));
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const tryckbar = (s) => tlv(0x13, Buffer.from(s, 'ascii'));
const explicit = (n, d) => tlv(0xa0 + n, d);
function oid(s) {
  const p = s.split('.').map(Number);
  const ut = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const b = [v & 0x7f]; let x = v >> 7; while (x) { b.unshift(0x80 | (x & 0x7f)); x >>= 7; } ut.push(...b); }
  return tlv(0x06, Buffer.from(ut));
}
// UTCTime till och med 2049, därefter GeneralizedTime, som X.509 kräver.
function tid(d) {
  const z = d.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  return d.getUTCFullYear() < 2050 ? tlv(0x17, Buffer.from(z.slice(2), 'ascii')) : tlv(0x18, Buffer.from(z, 'ascii'));
}
const ECDSA_SHA256 = seq(oid('1.2.840.10045.4.3.2'));
const namn = ({ cn, o = 'Vårdkällan demo' }) => seq(set(seq(oid('2.5.4.6'), tryckbar('SE'))), set(seq(oid('2.5.4.10'), utf8(o))), set(seq(oid('2.5.4.3'), utf8(cn))));

// Ett certifikat. utfardare är { namn, nyckel } eller null för ett självsignerat rotcertifikat.
function bygg({ subjekt, publik, utfardare, privat, serie, fran, till, ca, sokvagslangd = null }) {
  const ext = [
    seq(oid('2.5.29.19'), sant(), oktett(ca ? seq(sant(), ...(sokvagslangd != null ? [heltal(Buffer.from([sokvagslangd]))] : [])) : seq())),
    // keyUsage: digitalSignature för en instans, keyCertSign och cRLSign för en utfärdare.
    seq(oid('2.5.29.15'), sant(), oktett(ca ? bitar(Buffer.from([0x06]), 1) : bitar(Buffer.from([0x80]), 7))),
    seq(oid('2.5.29.14'), oktett(oktett(createHash('sha1').update(publik.export({ type: 'spki', format: 'der' })).digest()))),
  ];
  const tbs = seq(explicit(0, heltal(Buffer.from([2]))), heltal(serie), ECDSA_SHA256, namn(utfardare ?? subjekt), seq(tid(fran), tid(till)),
    namn(subjekt), publik.export({ type: 'spki', format: 'der' }), explicit(3, seq(...ext)));
  const sig = sign('sha256', tbs, privat);
  return new X509Certificate(seq(tbs, ECDSA_SHA256, bitar(sig)));
}

const AR = 365.25 * 86400_000;
const nySerie = () => { const b = randomBytes(12); b[0] &= 0x7f; return b; };

// En utfärdare med nyckelpar och certifikat. over är utfärdaren över, null för en rot.
// Demons data går flera år bakåt, och ett svar från laboratoriet i seeden prövas vid sin egen tid. Därför gäller demons
// certifikat från tio år bakåt.
export function skapaUtfardare({ cn, o, over = null, fran = new Date(Date.now() - 10 * AR), till = new Date(Date.now() + 20 * AR) }) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const cert = bygg({ subjekt: { cn, o }, publik: publicKey, utfardare: over ? over.subjekt : null, privat: over ? over.privat : privateKey, serie: nySerie(), fran, till, ca: true, sokvagslangd: over ? 0 : 1 });
  return { subjekt: { cn, o }, privat: privateKey, cert };
}

// Ett certifikat för en instans. part är instansens id, som står i certifikatets namn (CN).
export function utfarda(utf, { part, namn: visning, fran = new Date(Date.now() - 10 * AR), till = new Date(Date.now() + 2 * AR) }) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const cert = bygg({ subjekt: { cn: part, o: visning }, publik: publicKey, utfardare: utf.subjekt, privat: utf.privat, serie: nySerie(), fran, till, ca: false });
  return { part, namn: visning, privat: privateKey, cert, kedja: [cert.toString(), utf.cert.toString()] };
}

// Demons utfärdare och instanser. Skapas när servern startar och lever i minnet.
export const ROT = skapaUtfardare({ cn: 'Vårdkällan test-CA (demo, står för en publikt erkänd utfärdare)', o: 'Vårdkällan demo' });
export const MELLAN = skapaUtfardare({ cn: 'Vårdkällan test-CA för tjänster (demo)', o: 'Vårdkällan demo', over: ROT });
export const PARTER = {
  vardkallan: { namn: 'Vårdkällan (den här instansen)', roll: 'Avsändare av meddelanden till andra organisationer' },
  labb: { namn: 'Simulerat laboratorium (demo)', roll: 'Svarar på beställningar av prover' },
  nll: { namn: 'Simulerad läkemedelslista (demo)', roll: 'Tar emot förskrivningar och utsättningar' },
  earkiv: { namn: 'Simulerat e-arkiv (demo)', roll: 'Tar emot exportpaket och kvitterar dem' },
};
const INSTANSER = new Map(Object.entries(PARTER).map(([part, p]) => [part, utfarda(MELLAN, { part, namn: p.namn })]));
export const instans = (part) => INSTANSER.get(part) ?? null;

// Listan över betrodda rotutfärdare. I drift innehåller den de publikt erkända utfärdarna.
export const BETRODDA = [ROT.cert];

const avtryck = (c) => c.fingerprint256;

// Kontrollerar en certifikatkedja (PEM, instansens certifikat först) vid tidpunkten nu. aterkallade är serienumren som
// står i spärrlistan. Ger { ok, part, namn, serie, giltigTill, orsak } där orsak är på vanlig svenska.
export function verifieraKedja(kedja, { nu = new Date(), betrodda = BETRODDA, aterkallade = new Set() } = {}) {
  const nej = (orsak) => ({ ok: false, orsak });
  if (!Array.isArray(kedja) || !kedja.length || kedja.length > 4) return nej('Certifikatkedjan saknas.');
  let certs;
  try { certs = kedja.map(p => new X509Certificate(p)); } catch { return nej('Certifikatet går inte att läsa.'); }
  const blad = certs[0];
  if (blad.ca) return nej('Certifikatet tillhör en utfärdare och inte en instans.');
  for (let i = 0; i < certs.length; i++) {
    const c = certs[i];
    if (new Date(c.validFrom) > nu) return nej(`Certifikatet ${i === 0 ? 'för instansen' : 'för utfärdaren'} gäller inte ännu.`);
    if (new Date(c.validTo) < nu) return nej(`Certifikatet ${i === 0 ? 'för instansen' : 'för utfärdaren'} har gått ut.`);
    if (aterkallade.has(c.serialNumber)) return nej(`Certifikatet ${i === 0 ? 'för instansen' : 'för utfärdaren'} är återkallat.`);
    const over = certs[i + 1] ?? betrodda.find(r => c.checkIssued(r));
    if (!over) return nej('Kedjan går inte till en betrodd utfärdare.');
    if (!over.ca) return nej('Certifikatet är utfärdat av en instans och inte av en utfärdare.');
    if (!c.checkIssued(over) || !c.verify(over.publicKey)) return nej('Signaturen på certifikatet stämmer inte.');
  }
  // Kedjans sista certifikat ska vara utfärdat av, eller vara, en betrodd rot.
  const sista = certs.at(-1);
  const rot = betrodda.find(r => avtryck(r) === avtryck(sista) || (sista.checkIssued(r) && sista.verify(r.publicKey)));
  if (!rot) return nej('Kedjan går inte till en betrodd utfärdare.');
  const cn = blad.subject.split('\n').find(r => r.startsWith('CN='))?.slice(3) ?? null;
  const o = blad.subject.split('\n').find(r => r.startsWith('O='))?.slice(2) ?? null;
  return { ok: true, part: cn, namn: o, serie: blad.serialNumber, giltigTill: new Date(blad.validTo).toISOString(), publik: blad.publicKey, orsak: null };
}

// Det som gränssnittet visar om ett certifikat.
export const certifikatUt = (c, aterkallade = new Set()) => ({
  amne: c.subject.split('\n').find(r => r.startsWith('CN='))?.slice(3), organisation: c.subject.split('\n').find(r => r.startsWith('O='))?.slice(2),
  utfardare: c.issuer.split('\n').find(r => r.startsWith('CN='))?.slice(3), serie: c.serialNumber, giltigFran: new Date(c.validFrom).toISOString(),
  giltigTill: new Date(c.validTo).toISOString(), utfardareCa: c.ca, avtryck: c.fingerprint256, aterkallat: aterkallade.has(c.serialNumber),
});

// Spärrlistan i sandlådan: certifikat som har återkallats där.
export const SCHEMA = `CREATE TABLE IF NOT EXISTS pki_aterkallade (serie TEXT PRIMARY KEY, tid TEXT NOT NULL, orsak TEXT NOT NULL, enhet_id TEXT NOT NULL DEFAULT 'rol');`;
export function aterkallade(db) {
  db.exec(SCHEMA);
  return new Set(db.query('SELECT serie FROM pki_aterkallade').all().map(r => r.serie));
}
export function aterkalla(db, serie, orsak) {
  db.exec(SCHEMA);
  db.query('INSERT OR IGNORE INTO pki_aterkallade (serie, tid, orsak) VALUES (?, ?, ?)').run(serie, new Date().toISOString(), orsak);
}

// Översikten för systemförvaltaren: betrodda utfärdare, utfärdaren för tjänsterna och instansernas certifikat.
export function oversikt(db, nu = new Date()) {
  const at = aterkallade(db);
  return {
    betrodda: BETRODDA.map(c => certifikatUt(c, at)),
    utfardare: certifikatUt(MELLAN.cert, at),
    instanser: [...INSTANSER.values()].map(i => ({ part: i.part, roll: PARTER[i.part].roll, ...certifikatUt(i.cert, at), kontroll: verifieraKedja(i.kedja, { nu, aterkallade: at }).orsak })),
    forklaring: 'Rotutfärdaren är en test-CA som står för den publikt erkända utfärdaren i demon. I drift kommer certifikaten från en publikt erkänd utfärdare, och kontrollen är densamma.',
  };
}
