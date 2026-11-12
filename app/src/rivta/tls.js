// Runda 14, r2: producentens transport med ömsesidig TLS. Bun.serve kan kräva klientcertifikat men visar inte
// certifikatet för den som svarar, så transporten är en TLS-server (node:tls) med en liten HTTP/1.1-tolk: bara POST,
// Content-Length eller chunked, tak på huvudets och kroppens storlek och en tidsgräns per förbindelse.
//
// Den anropande organisationen fastställs ur det prövade klientcertifikatet. Ett certifikat utan giltig kedja till
// den CA som transporten litar på avvisas redan i TLS. Kommer anropet från en tjänsteplattform (vars certifikat har ett
// fingeravtryck i plattformar) är den ursprungliga konsumenten huvudet x-rivta-original-serviceconsumer-hsaid; annars
// serialNumber i klientens certifikat. Certifikaten i demon är testcertifikat (testcertifikat.js), aldrig SITHS.
import tls from 'node:tls';

export const TAK = { huvud: 16 * 1024, kropp: 2 * 1024 * 1024, tidMs: 30_000, forbindelser: 50 };

// Den anropande organisationen ur certifikatet och huvudena. Ger { hsaId, via, fingeravtryck } eller null.
export function avsandareAv(cert, huvuden, plattformar = []) {
  if (!cert?.fingerprint256) return null;
  const fa = cert.fingerprint256;
  if (plattformar.includes(fa)) {
    const ursprung = huvuden['x-rivta-original-serviceconsumer-hsaid'];
    return typeof ursprung === 'string' && /^[A-Za-z0-9-]{3,64}$/.test(ursprung) ? { hsaId: ursprung, via: 'tjänsteplattform', fingeravtryck: fa } : null;
  }
  const hsa = cert.subject?.serialNumber;
  return typeof hsa === 'string' && /^[A-Za-z0-9-]{3,64}$/.test(hsa) ? { hsaId: hsa, via: 'direkt', fingeravtryck: fa } : null;
}

// Startar transporten. hantera({ metod, vag, huvuden, kropp, avsandare }) ger { status, headers, body }.
export function starta({ port = 0, hostname = '127.0.0.1', cert, key, ca, plattformar = [], hantera }) {
  let oppna = 0;
  const socklar = new Set();
  const server = tls.createServer({ cert, key, ca, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, (sock) => {
    if (++oppna > TAK.forbindelser) { oppna--; sock.destroy(); return; }
    socklar.add(sock);
    const peer = sock.getPeerCertificate?.() ?? null;
    let buf = Buffer.alloc(0);
    let upptagen = false;
    const tid = setTimeout(() => sock.destroy(), TAK.tidMs);
    const skicka = (status, headers, body, stang) => {
      const b = Buffer.from(body ?? '', 'utf8');
      const h = { ...headers, 'Content-Length': b.length, Connection: stang ? 'close' : 'keep-alive' };
      // Statusraden har ingen förklarande text utom för 200, vilket HTTP/1.1 tillåter.
      sock.write(`HTTP/1.1 ${status} ${status === 200 ? 'OK' : ''}\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
      sock.write(b);
      if (stang) sock.end();
    };
    const fel = (status, text) => skicka(status, { 'Content-Type': 'text/plain; charset=utf-8' }, text, true);
    const forsok = async () => {
      if (upptagen) return;
      const slut = buf.indexOf('\r\n\r\n');
      if (slut < 0) { if (buf.length > TAK.huvud) fel(431, 'Huvudet är för stort.'); return; }
      if (slut > TAK.huvud) { fel(431, 'Huvudet är för stort.'); return; }
      const rader = buf.subarray(0, slut).toString('latin1').split('\r\n');
      const [metod, vag, version] = rader[0].split(' ');
      if (!/^HTTP\/1\.[01]$/.test(version ?? '')) { fel(400, 'Bara HTTP/1.1.'); return; }
      const huvuden = {};
      for (const r of rader.slice(1)) {
        const i = r.indexOf(':');
        if (i < 1) { fel(400, 'Ett huvud går inte att läsa.'); return; }
        huvuden[r.slice(0, i).trim().toLowerCase()] = r.slice(i + 1).trim();
      }
      let kropp;
      let forbrukat;
      const resten = buf.subarray(slut + 4);
      if (/chunked/i.test(huvuden['transfer-encoding'] ?? '')) {
        const delar = [];
        let pos = 0;
        let storlek = 0;
        for (;;) {
          const r = resten.indexOf('\r\n', pos);
          if (r < 0) return;
          const n = parseInt(resten.subarray(pos, r).toString('latin1').split(';')[0], 16);
          if (!Number.isFinite(n) || n < 0) { fel(400, 'Fel i chunked kodning.'); return; }
          if ((storlek += n) > TAK.kropp) { fel(413, 'Kroppen är för stor.'); return; }
          if (n === 0) { const e = resten.indexOf('\r\n', r + 2); if (e < 0) return; forbrukat = e + 2; break; }
          if (resten.length < r + 2 + n + 2) return;
          delar.push(resten.subarray(r + 2, r + 2 + n));
          pos = r + 2 + n + 2;
        }
        kropp = Buffer.concat(delar);
      } else {
        const len = huvuden['content-length'];
        if (metod === 'POST' && len == null) { fel(411, 'Content-Length saknas.'); return; }
        const n = Number(len ?? 0);
        if (!Number.isInteger(n) || n < 0) { fel(400, 'Content-Length går inte att läsa.'); return; }
        if (n > TAK.kropp) { fel(413, 'Kroppen är för stor.'); return; }
        if (/100-continue/i.test(huvuden.expect ?? '') && resten.length < n && !sock.fortsatt) { sock.fortsatt = true; sock.write('HTTP/1.1 100 Continue\r\n\r\n'); }
        if (resten.length < n) return;
        kropp = resten.subarray(0, n);
        forbrukat = n;
      }
      buf = resten.subarray(forbrukat);
      sock.fortsatt = false;
      upptagen = true;
      const stang = /close/i.test(huvuden.connection ?? '') || version === 'HTTP/1.0';
      try {
        if (metod !== 'POST') { skicka(405, { Allow: 'POST', 'Content-Type': 'text/plain; charset=utf-8' }, 'Tjänstekontrakten tar bara emot POST.', true); return; }
        const r = await hantera({ metod, vag, huvuden, kropp: kropp.toString('utf8'), avsandare: avsandareAv(peer, huvuden, plattformar) });
        skicka(r.status, r.headers ?? {}, r.body, stang);
      } catch (e) {
        console.error('RIVTA-transporten:', e);
        fel(500, 'Ett fel uppstod.');
      } finally { upptagen = false; }
      if (!stang && buf.length) forsok();
    };
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length > TAK.huvud + TAK.kropp + 64) { fel(413, 'Anropet är för stort.'); return; }
      forsok();
    });
    sock.on('error', () => {});
    sock.on('close', () => { clearTimeout(tid); oppna--; socklar.delete(sock); });
  });
  // Ett certifikat som inte går att pröva ger ett fel på den råa förbindelsen innan TLS är klart. Förbindelsen stängs,
  // och felet får inte stoppa servern.
  server.on('connection', (s) => s.on('error', () => {}));
  server.on('tlsClientError', () => {});
  server.on('error', (e) => console.error('RIVTA-transporten:', e.message));
  return new Promise((ok) => server.listen(port, hostname, () => ok({ server, port: server.address().port, stopp: () => new Promise(r => { server.close(() => r()); for (const x of socklar) x.destroy(); }) })));
}

// Producentens HTTP-svar för en tjänst (tjanst.js) bakom transporten.
export const tjanstHanterare = (tjanst, ctx) => async ({ vag, huvuden, kropp, avsandare }) => {
  if (!avsandare) {
    const { fault, CONTENT_TYPE } = await import('./soap.js');
    return { status: 500, headers: { 'Content-Type': CONTENT_TYPE }, body: fault('Client', 'Den anropande organisationen kunde inte fastställas ur certifikatet eller tjänsteplattformens huvud.') };
  }
  return tjanst.hanteraAnrop(typeof ctx === 'function' ? ctx() : ctx, { text: kropp, soapAction: huvuden.soapaction ?? null, vag: vag.split('?')[0], avsandare });
};
