// Runda 14, r4 (Sussa 3.6.1.3): dokumentationen av gränssnitten för informationsutbyte. Testerna stoppar bygget när
// koden har ett gränssnitt mot andra system som inte står i registret (gransnitt-utbyte.js), när registret pekar på något
// som inte finns och när docs/gransnitt.md inte är skrivet ur registret.
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as gu from '../src/gransnitt-utbyte.js';
import { capability } from '../src/fhir.js';
import { PRODUCENTER } from '../src/tjanstekontrakt.js';

const APP = gu.APP;
const DOCS = join(APP, '..', 'docs');
const serverText = readFileSync(join(APP, 'src', 'server.js'), 'utf8');
const filer = gu.kallfiler();
const utan = (id) => gu.GRANSSNITT.filter(x => x.id !== id);

describe('Gränssnitten för informationsutbyte', () => {
  test('varje adressprefix som servern skickar vidare hör till ett gränssnitt i registret eller är internt med motivering', () => {
    const prefix = gu.serverprefix(serverText);
    for (const p of ['/fhir', '/oauth', '/mt', '/ps', '/api']) expect(prefix).toContain(p);
    const tackt = (p, register = gu.GRANSSNITT) => Object.hasOwn(gu.INTERNA, p) || register.some(x => x.prefix.includes(p));
    for (const p of prefix) expect(tackt(p), `${p} saknas i app/src/gransnitt-utbyte.js`).toBe(true);
    for (const t of Object.values(gu.INTERNA)) expect(t.length).toBeGreaterThan(20);
    // Kontrollen fångar ett nytt prefix: ett gränssnitt som servern skickar vidare till men som inte står i registret.
    const ny = gu.serverprefix("if (url.pathname.startsWith('/rivta/')) svar = x; else if (url.pathname === '/mt') y;");
    expect(ny).toEqual(['/mt', '/rivta']);
    expect(tackt('/rivta', utan('rivta'))).toBe(false);
  });

  test('varje rutt i API:t som tyder på informationsutbyte hör till ett gränssnitt i registret', () => {
    const alla = gu.rutter(filer);
    expect(alla.length).toBeGreaterThan(300);
    const utbyte = alla.filter(r => gu.ORD_FOR_UTBYTE.test(r.vag));
    for (const v of ['/api/datauttag', '/api/riv/:kontrakt', '/api/idp/jwks', '/api/dicomweb/studies', '/api/login/biljett']) expect(utbyte.map(r => r.vag)).toContain(v);
    for (const r of utbyte) expect(gu.gransnittFor(r.vag), `${r.metod} ${r.vag} i ${r.fil} saknas i app/src/gransnitt-utbyte.js`).not.toBeNull();
    // En ny rutt för intyg, utan ett gränssnitt i registret, fångas.
    expect(gu.ORD_FOR_UTBYTE.test('/api/intyg/:id/skicka')).toBe(true);
    expect(gu.gransnittFor('/api/intyg/:id/skicka', utan('intyg'))).toBeNull();
    expect(gu.gransnittFor('/api/intyg/:id/skicka')?.id).toBe('intyg');
    expect(gu.gransnittFor('/api/arkiv/beslut/:id/paket')?.id).toBe('earkiv');
  });

  test('varje fil i src/rivta och varje fil som bygger SOAP eller RIV-TA hör till ett gränssnitt i registret', () => {
    const soap = filer.filter(f => f.fil !== 'src/gransnitt-utbyte.js' && (f.fil.startsWith('src/rivta/') || gu.SOAP_ELLER_RIV.test(f.text)));
    const hor = (fil, register = gu.GRANSSNITT) => register.some(x => x.kod.includes(fil) || (x.katalog && fil.startsWith(`${x.katalog}/`)));
    for (const f of soap) expect(hor(f.fil), `${f.fil} saknas i app/src/gransnitt-utbyte.js`).toBe(true);
    expect(gu.SOAP_ELLER_RIV.test('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">')).toBe(true);
    expect(gu.SOAP_ELLER_RIV.test('urn:riv:clinicalprocess:healthcond:description:GetDiagnosisResponder:2')).toBe(true);
    expect(hor('src/rivta/grund.js')).toBe(true);
    expect(hor('src/rivta/grund.js', utan('rivta'))).toBe(false);
  });

  test('varje adress, fil och dokument som registret nämner finns, och varje gränssnitt har ett avsnitt', () => {
    expect(new Set(gu.GRANSSNITT.map(x => x.id)).size).toBe(gu.GRANSSNITT.length);
    const kalla = filer.map(f => f.text).join('\n');
    const md = gu.markdown();
    for (const x of gu.GRANSSNITT) {
      expect(md).toContain(`\n## ${x.rubrik}\n`);
      for (const k of ['standard', 'riktning', 'text', 'behorighet']) expect(String(typeof x[k] === 'function' ? x[k]() : x[k]).length, `${x.id}.${k}`).toBeGreaterThan(10);
      if (x.hanvisning) { expect(x.hanvisning).toMatch(/^docs\/[\w-]+\.md$/); continue; }
      expect(x.adresser.length + x.kod.length, x.id).toBeGreaterThan(0);
      for (const a of x.adresser) expect(kalla.includes(a.replace(/:\w+$/, '')), `${x.id}: ${a}`).toBe(true);
      for (const f of x.kod) expect(existsSync(join(APP, f)), `${x.id}: ${f}`).toBe(true);
      if (existsSync(DOCS)) for (const d of x.dokument) expect(existsSync(join(APP, '..', d)), `${x.id}: ${d}`).toBe(true);
    }
    // Processen för egen utveckling och förvaltning.
    expect(md).toContain('## Process för egen utveckling och förvaltning');
    for (const [rubrik] of gu.PROCESS) expect(md).toContain(`**${rubrik}.**`);
    for (const t of ['api-andringar.js', 'CapabilityStatement', 'kor-tester.js', 'Öppet API', 'EUPL 1.2']) expect(md).toContain(t);
    // Delarna som beskrivs i andra dokument hänvisar dit.
    expect(gu.GRANSSNITT.find(x => x.id === 'rivta').hanvisning).toBe('docs/rivta.md');
    expect(gu.GRANSSNITT.find(x => x.id === 'inloggningstjanst').hanvisning).toBe('docs/sakerhetsarkitektur.md');
  });

  test('dokumentet räknar FHIR-resurserna och tjänstekontrakten ur koden och är skrivet ur registret', () => {
    const md = gu.markdown();
    for (const t of capability('').rest[0].resource.map(r => r.type)) expect(md).toContain(t);
    for (const k of PRODUCENTER) expect(md).toContain(k);
    expect(md).not.toMatch(/[–—…]/);
    const fil = join(DOCS, 'gransnitt.md');
    if (existsSync(DOCS)) expect(readFileSync(fil, 'utf8')).toBe(md);
  });
});
