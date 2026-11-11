// Exportpaketet i runda 12, r2 (vårt M12): återföringen av all data tar med alla tabeller, också de som inte hör till
// journalen, och paketet har XML-schemana i mappen schemas och registrerade medietyper i METS.xml, som E-ARK:s validator
// kräver (docs/fhir-validering.md, avsnittet om E-ARK).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag } from '../src/db.js';
import { packaUpp } from '../src/zip.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const raw = async (k, vag) => {
  const res = await fetch(app.url + vag, { method: 'POST', headers: { Cookie: k.kaka(), 'Content-Type': 'application/json' }, body: '{}' });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
};
const paket = async (k, data) => {
  const b = (await k.post('/api/arkiv/beslut', { diarienummer: 'DEMO-2026-0042', beslutsdatum: idag(), typ: 'leverans', ...data })).data;
  const r = await raw(k, `/api/arkiv/beslut/${b.id}/paket`);
  expect(r.status).toBe(200);
  const filer = packaUpp(r.buf);
  return { filer, rot: [...filer.keys()][0] };
};

describe('Arkiv', () => {
  test('återföringen av all data tar med varje tabell i databasen som NDJSON och databasens schema, också tabeller som inte hör till journalen', async () => {
    const k = await inloggad('ark');
    const db = sandlada(app, k).db;
    const { filer, rot } = await paket(k, { omfattning: 'alla' });
    const tabeller = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
    expect(tabeller.length).toBeGreaterThan(100);
    for (const t of tabeller) {
      const f = filer.get(`${rot}representations/rep_1/data/tabeller/${t}.ndjson`);
      expect({ t, finns: Boolean(f) }).toEqual({ t, finns: true });
    }
    // Tabeller som inte hör till journalen, till exempel inställningarna och reglerna, följer med rad för rad.
    const inst = filer.get(`${rot}representations/rep_1/data/tabeller/installningar.ndjson`).data.toString('utf8').trim().split('\n').map(x => JSON.parse(x));
    expect(inst.length).toBe(db.query('SELECT count(*) AS n FROM installningar').get().n);
    const schema = filer.get(`${rot}representations/rep_1/data/tabeller/schema.sql`).data.toString('utf8');
    expect(schema).toContain('CREATE TABLE patienter');
    expect(schema).toContain('CREATE TRIGGER atkomstlogg_ingen_andring');
    // Varje fil står i METS.xml med sin kontrollsumma.
    const mets = filer.get(`${rot}METS.xml`).data.toString('utf8');
    const f = filer.get(`${rot}representations/rep_1/data/tabeller/katalog.ndjson`).data;
    expect(mets).toContain(`CHECKSUM="${createHash('sha256').update(f).digest('hex').toUpperCase()}"`);
    // Ett paket för en patient har inga tabeller, bara journalen.
    const en = await paket(k, { patientId: 'p01' });
    expect([...en.filer.keys()].some(x => x.includes('/data/tabeller/'))).toBe(false);
  }, 30_000);

  test('paketet har XML-schemana i mappen schemas och bara registrerade medietyper i METS.xml, som E-ARK:s validator kräver', async () => {
    const k = await inloggad('ark');
    const { filer, rot } = await paket(k, { patientId: 'p01' });
    for (const x of ['mets.xsd', 'xlink.xsd', 'DILCISExtensionMETS.xsd', 'DILCISExtensionSIPMETS.xsd']) expect(filer.has(`${rot}schemas/${x}`)).toBe(true);
    const mets = filer.get(`${rot}METS.xml`).data.toString('utf8');
    expect(mets).toMatch(/<fileGrp ID="fg-Schemas" USE="Schemas">\s*<file /);
    expect(mets).toContain('xlink:href="schemas/mets.xsd"');
    expect(mets).not.toContain('application/x-ndjson');
    expect(mets).toContain('<div ID="rep1" LABEL="Representations">');
    const typer = [...mets.matchAll(/MIMETYPE="([^"]+)"/g)].map(m => m[1]);
    for (const t of typer) expect(['application/fhir+json', 'application/json', 'application/xml', 'text/xml', 'text/plain', 'text/markdown']).toContain(t);
  });
});
