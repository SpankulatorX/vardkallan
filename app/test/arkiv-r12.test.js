// Exportpaketet i runda 12, r2 (vårt M12): återföringen av all data tar med alla tabeller, också de som inte hör till
// journalen, och paketet har XML-schemana i mappen schemas och registrerade medietyper i METS.xml, som E-ARK:s validator
// kräver (docs/fhir-validering.md, avsnittet om E-ARK).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag } from '../src/db.js';
import { packaUpp } from '../src/zip.js';
import { klassa } from '../src/lagring.js';
import { ATERFORING_KLASSER, ATERFORING_UTESLUTNA, HEMLIG_TABELL, aterforingsurval } from '../src/arkiv.js';

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
  test('återföringen av all data tar med varje tabell med vårdgivarens uppgifter och de gemensamma tabellerna som NDJSON och databasens schema, också tabeller som inte hör till journalen', async () => {
    const k = await inloggad('ark');
    const db = sandlada(app, k).db;
    const { filer, rot } = await paket(k, { omfattning: 'alla' });
    const tabeller = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
    expect(tabeller.length).toBeGreaterThan(100);
    const klass = klassa(db);
    for (const t of tabeller) {
      const f = filer.get(`${rot}representations/rep_1/data/tabeller/${t}.ndjson`);
      const ska = ATERFORING_KLASSER.includes(klass[t].typ) && !Object.hasOwn(ATERFORING_UTESLUTNA, t) && !HEMLIG_TABELL.test(t);
      expect({ t, finns: Boolean(f) }).toEqual({ t, finns: ska });
    }
    // Systemets egna tabeller och säkerhetsloggen följer inte med, och urval.json säger varför.
    for (const t of ['sakerhetslogg', 'api_systemkonton', 'ps_anslutningar', 'schema_migreringar', 'uppgraderingar']) expect(filer.has(`${rot}representations/rep_1/data/tabeller/${t}.ndjson`)).toBe(false);
    const urval = JSON.parse(filer.get(`${rot}representations/rep_1/data/tabeller/urval.json`).data);
    expect(urval.utelamnade.find(x => x.tabell === 'sakerhetslogg').skal).toMatch(/Säkerhetsloggen/);
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

  test('varje tabell är klassad för återföringen, och inga nycklar eller hemligheter följer med i paketet', async () => {
    const k = await inloggad('ark');
    const db = sandlada(app, k).db;
    // Varje tabell följer med eller är utelämnad av ett skäl. En ny tabell som inte är klassad i lagring.js fäller testet.
    const { med, utan } = aterforingsurval(db);
    expect(utan.filter(x => /inte klassad/.test(x.skal))).toEqual([]);
    expect(med.length + utan.length).toBe(db.query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get().n);
    // Kända hemliga värden läggs in i tabellerna med nycklar, HMAC och hemligheter, och söks sedan i hela paketet.
    const hemliga = [];
    const lagIn = (tabell, kolumn, fast = {}) => {
      const kol = db.query(`PRAGMA table_info("${tabell}")`).all().filter(c => !c.pk && (c.name === kolumn || Object.hasOwn(fast, c.name) || (c.notnull && c.dflt_value == null)));
      const v = `HEMLIGT-${tabell}-${kolumn}-${Math.random().toString(36).slice(2)}`;
      const varden = kol.map(c => (c.name === kolumn ? v : Object.hasOwn(fast, c.name) ? fast[c.name] : c.name === 'patient_id' ? 'p01' : /enhet/.test(c.name) ? 'uso-kard' : c.type === 'INTEGER' || c.type === 'REAL' ? 1 : `x-${c.name}`));
      db.query(`INSERT INTO "${tabell}" (${kol.map(c => `"${c.name}"`).join(', ')}) VALUES (${kol.map(() => '?').join(', ')})`).run(...varden);
      hemliga.push(v);
    };
    lagIn('forskningsbestallningar', 'nyckel', { status: 'registrerad' });
    lagIn('kalenderlankar', 'hmac');
    lagIn('mt_utrustning', 'nyckel_hmac', { typ: 'monitor' });
    lagIn('videomoten', 'kod');
    lagIn('ps_anslutningar', 'nyckel_hmac');
    for (const r of db.query('SELECT beskrivning FROM sakerhetslogg ORDER BY id DESC LIMIT 3').all()) if (r.beskrivning?.length > 20) hemliga.push(r.beskrivning);
    const { filer } = await paket(k, { omfattning: 'alla' });
    const allt = [...filer.values()].filter(f => f.data).map(f => f.data.toString('utf8')).join('\n');
    for (const v of hemliga) expect({ v, finns: allt.includes(v) }).toEqual({ v, finns: false });
    // Raderna själva följer med, utan de hemliga kolumnerna.
    expect(allt).toContain('x-titel');
  }, 30_000);
});
