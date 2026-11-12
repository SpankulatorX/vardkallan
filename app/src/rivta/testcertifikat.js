// Runda 14, r2: testcertifikat för ömsesidig TLS mellan tjänstekonsument, tjänsteplattform och producent i demon.
// Certifikaten skapas när de behövs, med en egen test-CA, och sparas aldrig i databasen eller i källkoden. De är märkta
// test i namnet och i organisationen, och de är aldrig SITHS-certifikat: en riktig anslutning till den nationella
// tjänsteplattformen kräver SITHS-funktionscertifikat från Inera och ett avtal.
//
// Ett certifikat är X.509 v3 med en EC-nyckel på kurvan P-256 och ECDSA med SHA-256, kodat i DER för hand
// (node:crypto skapar nycklar och signaturer men inte certifikat). Funktionscertifikatets HSA-id står i serialNumber i
// subjektet, som i SITHS.
import { generateKeyPairSync, createPublicKey, sign, createHash, randomBytes, X509Certificate } from 'node:crypto';

const tlv = (tagg, ...innehall) => {
  const b = Buffer.concat(innehall.map(x => (Buffer.isBuffer(x) ? x : Buffer.from(x))));
  const n = b.length;
  const len = n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x82, n >> 8, n & 255]) : Buffer.from([0x83, n >> 16, (n >> 8) & 255, n & 255]);
  return Buffer.concat([Buffer.from([tagg]), len, b]);
};
const seq = (...x) => tlv(0x30, ...x);
const set = (...x) => tlv(0x31, ...x);
const oid = (s) => {
  const d = s.split('.').map(Number);
  const ut = [40 * d[0] + d[1]];
  for (const v of d.slice(2)) {
    const bytes = [];
    let x = v;
    do { bytes.unshift(x & 0x7f); x >>>= 7; } while (x);
    for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80;
    ut.push(...bytes);
  }
  return tlv(0x06, Buffer.from(ut));
};
const heltal = (b) => tlv(0x02, b[0] & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const printable = (s) => tlv(0x13, Buffer.from(s, 'ascii'));
const tid = (d) => tlv(0x17, Buffer.from(`${d.toISOString().slice(2, 19).replace(/[-:T]/g, '')}Z`, 'ascii'));
const OID = {
  cn: '2.5.4.3', o: '2.5.4.10', ou: '2.5.4.11', c: '2.5.4.6', serialNumber: '2.5.4.5',
  ecdsaSha256: '1.2.840.10045.4.3.2', basicConstraints: '2.5.29.19', keyUsage: '2.5.29.15', extKeyUsage: '2.5.29.37', subjectAltName: '2.5.29.17',
  ski: '2.5.29.14', aki: '2.5.29.35', serverAuth: '1.3.6.1.5.5.7.3.1', clientAuth: '1.3.6.1.5.5.7.3.2',
};
// Ett namn: { c, o, ou, cn, serialNumber }. Landskod och serienummer är PrintableString, resten UTF8String.
const namn = (n) => seq(...[['c', n.c], ['o', n.o], ['ou', n.ou], ['cn', n.cn], ['serialNumber', n.serialNumber]]
  .filter(([, v]) => v).map(([k, v]) => set(seq(oid(OID[k]), k === 'c' || k === 'serialNumber' ? printable(v) : utf8(v)))));
const ext = (id, kritisk, varde) => seq(oid(id), ...(kritisk ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, varde));
const pem = (typ, der) => `-----BEGIN ${typ}-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${typ}-----\n`;
const nyckelId = (spki) => createHash('sha1').update(spki).digest();

// Runda 14, sammanslagningen: certifikatet gäller från fem år före sin tid. TLS prövar giltigheten mot datorns verkliga
// klocka, medan testerna med falsk klocka (scripts/klocktest.js) skapar certifikaten upp till två år fram i tiden, och
// en timme bakåt räckte då inte ("certificate is not yet valid").
const FORE_MS = 5 * 365 * 86400_000;
// Skapar ett certifikat. utfardare är { nyckel, namn, spki } för CA:n, eller null för ett självsignerat certifikat.
function certifikat({ subjekt, utfardare = null, ca = false, dns = [], ip = [], dagar = 365, nu = new Date(), serie = randomBytes(12) }) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const ut = utfardare ?? { nyckel: privateKey, namn: subjekt, spki };
  const tillagg = [
    ext(OID.basicConstraints, true, ca ? seq(tlv(0x01, Buffer.from([0xff]))) : seq()),
    ext(OID.keyUsage, true, ca ? tlv(0x03, Buffer.from([0x01, 0x06])) : tlv(0x03, Buffer.from([0x07, 0x80]))),
    ext(OID.ski, false, tlv(0x04, nyckelId(spki.subarray(-65)))),
    ext(OID.aki, false, seq(tlv(0x80, nyckelId(ut.spki.subarray(-65))))),
    ...(ca ? [] : [ext(OID.extKeyUsage, false, seq(oid(OID.serverAuth), oid(OID.clientAuth)))]),
    ...(dns.length || ip.length ? [ext(OID.subjectAltName, false, seq(...dns.map(d => tlv(0x82, Buffer.from(d, 'ascii'))), ...ip.map(a => tlv(0x87, Buffer.from(a.split('.').map(Number))))))] : []),
  ];
  // Serienumret är ett positivt heltal i DER med minsta möjliga längd. En inledande nolla gör kodningen ogiltig för
  // stränga tolkar, så den första byten är alltid mellan 1 och 127.
  serie = Buffer.from(serie);
  serie[0] = (serie[0] & 0x7f) || 1;
  const tbs = seq(
    tlv(0xa0, heltal(Buffer.from([2]))), heltal(serie), seq(oid(OID.ecdsaSha256)), namn(ut.namn),
    seq(tid(new Date(nu.getTime() - FORE_MS)), tid(new Date(nu.getTime() + dagar * 86400_000))),
    namn(subjekt), spki, tlv(0xa3, seq(...tillagg)),
  );
  const sig = sign('sha256', tbs, ut.nyckel);
  const der = seq(tbs, seq(oid(OID.ecdsaSha256)), tlv(0x03, Buffer.concat([Buffer.from([0]), sig])));
  return {
    cert: pem('CERTIFICATE', der), key: privateKey.export({ type: 'pkcs8', format: 'pem' }), nyckel: privateKey, spki, namn: subjekt,
    fingeravtryck: new X509Certificate(der).fingerprint256, der,
  };
}

// En test-CA och funktionscertifikat utfärdade av den. Allt är märkt som test och gäller bara i demon.
export function testCa({ namn: caNamn = 'Vårdkällan test-CA för tjänstekontrakt (inte SITHS)' } = {}) {
  const ca = certifikat({ subjekt: { c: 'SE', o: 'Vårdkällan testcertifikat (demo)', cn: caNamn }, ca: true, dagar: 3650 });
  return {
    cert: ca.cert, key: ca.key, fingeravtryck: ca.fingeravtryck,
    // Ett funktionscertifikat för en organisation. hsaId står i serialNumber, och värdnamnen i subjectAltName.
    utfarda({ hsaId, cn, dns = ['localhost'], ip = ['127.0.0.1'], dagar = 365, serie }) {
      return certifikat({ subjekt: { c: 'SE', o: 'Vårdkällan testcertifikat (demo)', cn: `Test ${cn}`, serialNumber: hsaId }, utfardare: { nyckel: ca.nyckel, namn: ca.namn, spki: ca.spki }, dns, ip, dagar, ...(serie ? { serie } : {}) });
    },
  };
}

// Den offentliga nyckeln i ett certifikat som JWK, för systemkontot som certifikatets organisation prövas mot.
export const jwkAv = (certPem) => createPublicKey(certPem).export({ format: 'jwk' });
