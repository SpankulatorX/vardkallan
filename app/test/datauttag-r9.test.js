// Runda 9, r7: fler tabeller i datauttaget (Sussa 6.3.1.3) och kvalitetssäkring med kontrollregler per rad och fler
// sparade uppdateringar (Sussa 6.3.1.5). Testnamnen står i src/sussa/mappning/6.3.1.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as datauttag from '../src/datauttag.js';
import { nyDb, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
// NDJSON läses som text.
const text = async (k, vag) => (await fetch(app.url + vag, { headers: { Cookie: k.kaka() } })).text();

describe('Datauttag, runda 9', () => {
  test('mätvärden, anteckningar utan text, vårdtillfällen och patientavgifter följer samma regler som de andra tabellerna', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const d = sandlada(app, k).db;
    const m = (await k.get('/api/datauttag')).data;
    for (const t of ['Matvarde', 'Anteckning', 'Vardtillfalle', 'Patientavgift']) {
      expect(m.output.find(o => o.type === t).count).toBeGreaterThan(0);
      const rader = (await text(k, `/api/datauttag/${t}`)).trim().split('\n').map(x => JSON.parse(x));
      // Inga utelämnade fält: varje rad har exakt de dokumenterade fälten.
      for (const r of rader) expect(Object.keys(r).sort()).toEqual(Object.keys(datauttag.SCHEMA[t].falt).sort());
      const json = JSON.stringify(rader);
      for (const p of d.query('SELECT * FROM patienter').all()) { expect(json).not.toContain(p.personnummer); expect(json).not.toContain(p.efternamn); expect(json).not.toContain(`"${p.id}"`); }
    }
    // Anteckningarna har ingen fritext, och den spärrade psykiatrins anteckningar kommer inte med.
    const ant = await text(k, '/api/datauttag/Anteckning');
    for (const a of d.query('SELECT sokord FROM anteckningar').all()) for (const s of JSON.parse(a.sokord)) if (s.text.length > 12) expect(ant).not.toContain(s.text);
    const psyk = d.query("SELECT hsa_id FROM enheter WHERE id = 'uso-psyk'").get().hsa_id;
    const p04 = d.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk'").get().n;
    expect(p04).toBeGreaterThan(0);
    const psykRader = ant.trim().split('\n').map(x => JSON.parse(x)).filter(r => r.vardenhet === psyk);
    expect(psykRader.length).toBe(d.query("SELECT count(*) AS n FROM anteckningar a JOIN patienter p ON p.id = a.patient_id WHERE a.enhet_id = 'uso-psyk' AND a.patient_id <> 'p04' AND p.skyddad = 0 AND a.id NOT IN (SELECT ersatter_id FROM anteckningar WHERE ersatter_id IS NOT NULL)").get().n);
    // Mätvärdena pekar på vårdkontakter i tabellen Vardkontakt.
    const kontakter = new Set((await text(k, '/api/datauttag/Vardkontakt')).trim().split('\n').map(x => JSON.parse(x).rad));
    const mv = (await text(k, '/api/datauttag/Matvarde')).trim().split('\n').map(x => JSON.parse(x)).filter(r => r.vardkontakt);
    expect(mv.length).toBeGreaterThan(0);
    expect(mv.every(r => kontakter.has(r.vardkontakt))).toBe(true);
  });

  test('kontrollreglerna per rad står i manifestet och pekar ut rader som inte klarar dem', () => {
    const data = {
      Vardkontakt: [{ rad: 'k1', patient: 'x', vardenhet: 'h', vardform: 'oppenvard', startdatum: '2026-11-02', slutdatum: '2026-11-01' }],
      Diagnos: [{ rad: 'd1', patient: 'x', vardenhet: 'h', kod: 'hjärta', datum: '2026-11-01' }],
      Matvarde: [{ rad: 'm1', patient: 'x', vardenhet: 'h', vardkontakt: 'saknas', typ: 'blodtryck', varde: '120/80', datum: '2026-11-01' }, { rad: 'm2', patient: null, vardenhet: 'h', typ: 'puls', varde: 70, datum: '2026-11-01' }],
    };
    const q = datauttag.kvalitet(data);
    expect(q.Vardkontakt.avvikelser.datum.rader).toEqual(['k1']);
    expect(q.Diagnos.avvikelser.koder.rader).toEqual(['d1']);
    expect(q.Matvarde.avvikelser.referenser.rader).toEqual(['m1']);
    expect(q.Matvarde.avvikelser.obligatoriska.rader).toEqual(['m2']);
    expect(q.Matvarde).toMatchObject({ kontrollerade: 2, godkanda: 0 });
    // I seedens uttag klarar alla rader reglerna, och resultatet står i manifestet.
    const db = nyDb();
    const s = datauttag.uppdatera(db);
    const m = datauttag.manifest(db, '');
    expect(Object.keys(m.kvalitet.regler)).toEqual(['obligatoriska', 'koder', 'datum', 'referenser']);
    for (const t of datauttag.TYPER) expect(m.kvalitet.tabeller[t].godkanda).toBe(s.antal[t]);
  });

  test('en vecka av uppdateringar sparas, och ändringarna kan läsas sedan vilken av dem som helst', () => {
    const d = nyDb();
    const forsta = datauttag.uppdatera(d, new Date('2026-11-03T10:00:00Z'));
    d.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', 'uso-kard', 'I10.9', 'Hypertoni', 'bi', '2026-11-03')").run();
    datauttag.uppdatera(d, new Date('2026-11-04T01:30:00Z'));
    d.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', 'uso-kard', 'E78.0', 'Hyperkolesterolemi', 'bi', '2026-11-04')").run();
    datauttag.uppdatera(d, new Date('2026-11-05T01:30:00Z'));
    expect(datauttag.historik(d).length).toBe(3);
    const sedanForsta = datauttag.ndjson(d, 'Diagnos', { sedan: forsta.id, nu: new Date('2026-11-05T02:00:00Z') }).trim().split('\n').map(x => JSON.parse(x));
    expect(sedanForsta.map(r => r.kod).sort()).toEqual(['E78.0', 'I10.9']);
    for (let i = 0; i < 10; i++) datauttag.uppdatera(d);
    expect(datauttag.historik(d).length).toBe(datauttag.BEHALL);
    expect(datauttag.BEHALL).toBeGreaterThan(2);
    expect(datauttag.ndjson(d, 'Diagnos', { sedan: forsta.id })).toBeNull();
  });
});
