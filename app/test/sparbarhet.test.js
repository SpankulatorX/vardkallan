// Runda 9, r7: spårbarhet mot kringsystem (Sussa 6.1.1.3), uppföljning av subprocesser med målvärden (Sussa 6.1.1.4)
// och vårdformer med övergångar och faktisk besökstid (Sussa 6.1.1.6). Testnamnen står i src/sussa/mappning/6.1.1.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as konfiguration from '../src/konfiguration.js';
import * as sparbarhet from '../src/sparbarhet.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Spårbarhet', () => {
  test('en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const b = db.query(`SELECT b.* FROM labb_bestallningar b WHERE b.vardkontakt_id IS NOT NULL AND b.enhet_id = 'uso-kard'
      AND EXISTS (SELECT 1 FROM labb_analyser a WHERE a.bestallning_id = b.id AND a.besvarad_tid IS NOT NULL) ORDER BY b.id LIMIT 1`).get();
    expect(b).toBeTruthy();
    const r = await k.get(`/api/vardkontakt/${b.vardkontakt_id}/handelser`);
    expect(r.status).toBe(200);
    expect(r.data.vardkontakt.processId).toBe(`urn:vardkallan:vardkontakt:${b.vardkontakt_id}`);
    const anrop = r.data.kringsystem.find(x => x.korrelationId === b.nummer);
    expect(anrop).toMatchObject({ system: 'Laboratoriet (simulerat)', objekt: `labb:${b.id}` });
    expect(anrop.svar.tid).toBeTruthy();
    const kedja = r.data.handelser.filter(h => h.korrelationId === b.nummer);
    expect(kedja.some(h => h.system === 'Vårdkällan')).toBe(true);
    expect(kedja.some(h => h.system === 'Laboratoriet (simulerat)' && h.handelse.startsWith('Svar'))).toBe(true);
    // Tiderna står i ordning.
    const tider = r.data.handelser.map(h => h.tid);
    expect([...tider].sort()).toEqual(tider);
  });

  test('överföringen till NLL och svaret från NLL syns i händelsekedjan, och varje del följer sin behörighet', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const o = db.query("SELECT o.vardkontakt_id, m.id FROM ordinationer o JOIN nll_meddelanden m ON m.ordination_id = o.id WHERE o.vardkontakt_id IS NOT NULL AND o.enhet_id LIKE 'uso-kard%' ORDER BY m.id LIMIT 1").get();
    expect(o).toBeTruthy();
    const r = await k.get(`/api/vardkontakt/${o.vardkontakt_id}/handelser`);
    const id = `NLL-${String(o.id).padStart(6, '0')}`;
    expect(r.data.kringsystem.find(x => x.korrelationId === id)).toMatchObject({ system: 'Nationella läkemedelslistan (simulerad)' });
    // Vårdadministratören ser kontakten, men inte provsvaren eller läkemedlen.
    const a = klient(app);
    await a.logga('adm-kard');
    const ra = await a.get(`/api/vardkontakt/${o.vardkontakt_id}/handelser`);
    expect(ra.status).toBe(200);
    expect(ra.data.kringsystem.filter(x => x.system !== 'Prenumerant i det öppna API:t')).toEqual([]);
    // En vårdkontakt på en spärrad vårdenhet ger inget svar alls.
    const psyk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' LIMIT 1").get();
    expect((await k.get(`/api/vardkontakt/${psyk.id}/handelser`)).status).toBe(403);
  });

  test('en ordination eller kontakt på en spärrad vårdenhet röjs aldrig, inte heller genom en prenumerationsnotis', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    // Elin Sandberg (p04) vårdas på avdelning 72 och har en spärr för psykiatrin.
    const v = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p04' AND enhet_id = 'uso-kard-72' AND typ = 'slutenvard' LIMIT 1").get();
    require('../src/prenumeration.js').sakraSchema(db);
    const fore = await k.get(`/api/vardkontakt/${v.id}/handelser`);
    expect(fore.status).toBe(200);
    const lm = db.query('SELECT id FROM katalog LIMIT 1').get().id;
    const o = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad, vardkontakt_id)
      VALUES ('p04', 'uso-psyk', ?, '1 x 1', 'staende', 'Depression', '2027-01-01', '2026-11-01', 'lak-psyk', '2026-11-01T10:00:00Z', ?)`).run(lm, v.id).lastInsertRowid;
    db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status) VALUES (?, 'ny', '2026-11-01T10:00:00Z', 'kvitterad')").run(o);
    db.query("INSERT INTO prenumeration_notiser (prenumeration_id, nummer, tid, handelse, fokus, status) VALUES (1, 1, '2026-11-01T10:01:00Z', 'create', ?, 'levererad')").run(`MedicationRequest/${o}`);
    const psyk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' LIMIT 1").get().id;
    db.query("INSERT INTO prenumeration_notiser (prenumeration_id, nummer, tid, handelse, fokus, status) VALUES (1, 2, '2026-11-01T10:02:00Z', 'create', ?, 'levererad')").run(`Encounter/${psyk}`);
    const efter = await k.get(`/api/vardkontakt/${v.id}/handelser`);
    expect(JSON.stringify(efter.data)).toBe(JSON.stringify(fore.data));
  });
});

describe('Subprocesser', () => {
  test('målvärdena för ledtiderna är parametrar som systemförvaltaren sätter, med samma standard som modulen', () => {
    const p = konfiguration.parametrar();
    expect(p['ledtid.remiss_svar_dagar']).toMatchObject({ omrade: 'uppfoljning', standard: sparbarhet.MAL_STANDARD.remissSvarDagar });
    expect(p['ledtid.labb_svar_timmar'].standard).toBe(sparbarhet.MAL_STANDARD.labbSvarTimmar);
    expect(p['ledtid.nll_kvittens_minuter'].standard).toBe(sparbarhet.MAL_STANDARD.nllKvittensMinuter);
    expect(konfiguration.prova('ledtid.remiss_svar_dagar', '0').ok).toBe(false);
  });

  test('remiss, provtagning och läkemedelsöverföring följs upp per steg mot målvärdena, utan personuppgifter', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const r = await k.get('/api/sparbarhet/subprocesser?dagar=365');
    expect(r.status).toBe(200);
    expect(r.data.subprocesser.map(s => s.id)).toEqual(['remiss', 'provtagning', 'lakemedelsoverforing']);
    const remiss = r.data.subprocesser[0];
    expect(remiss).toMatchObject({ mal: 14, malText: 'Besvarad inom 14 dagar' });
    expect(remiss.steg.map(s => s.namn)).toEqual(['Skickad till mottagen', 'Mottagen till bedömd', 'Bedömd till besvarad']);
    expect(JSON.stringify(r.data)).not.toMatch(/"p\d\d"|Gunnar|Elin/);
    // En ändring av målet slår igenom i uppföljningen.
    const db = sandlada(app, k).db;
    db.query("INSERT INTO konfig_andringar (slag, nyckel, varde, giltig_fran, galler_fran, status, foreslagen_av, foreslagen, beslutad_av, beslutad, motivering) VALUES ('parameter', 'ledtid.remiss_svar_dagar', '30', '2020-01-01', '2020-01-01', 'godkand', 'sysf', '2020-01-01', 'sysf-2', '2020-01-01', 'test')").run();
    const efter = await k.get('/api/sparbarhet/subprocesser?dagar=365');
    expect(efter.data.subprocesser[0].mal).toBe(30);
    const e = klient(app);
    await e.logga('eko');
    expect((await e.get('/api/sparbarhet/subprocesser')).status).toBe(403);
  });
});

describe('Vårdformer', () => {
  test('utskrivning till hemsjukvård görs i ett steg, med föregående kontakt och samma hälsoärende', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const vt = db.query("SELECT id FROM vardtillfallen WHERE patient_id = 'p01' AND utskriven IS NULL").get();
    const r = await k.post(`/api/vardtillfalle/${vt.id}/overgang`, { till: 'hemsjukvard' });
    expect(r.status).toBe(200);
    expect(r.data.ny).toMatchObject({ typ: 'hemsjukvard', kontaktsatt: 'hembesok', planerad: true });
    expect(r.data.vardtillfalle.utskriven ?? r.data.vardtillfalle.status).toBeTruthy();
    const ny = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(r.data.ny.id);
    const sluten = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(ny.foregaende_id);
    expect(sluten.typ).toBe('slutenvard');
    expect(sluten.slut).toBeTruthy();
    expect(ny.halsoarende_id).toBe(sluten.halsoarende_id);
    expect(ny.halsoarende_id).toBeTruthy();
    // Händelsekedjan visar övergången.
    const h = await k.get(`/api/vardkontakt/${ny.id}/handelser`);
    expect(h.data.vardformer.map(x => x.vardform)).toEqual(expect.arrayContaining(['slutenvard', 'hemsjukvard']));
    expect((await k.post(`/api/vardtillfalle/${vt.id}/overgang`, { till: 'kommunen' })).status).toBe(400);
  });

  test('en dagkirurgisk kontakt där patienten blir kvar skrivs in i samma hälsoärende', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const d = await k.post('/api/patient/p11/dagkirurgi', { orsak: 'Elkonvertering av förmaksflimmer' });
    expect(d.status).toBe(201);
    expect(d.data).toMatchObject({ typ: 'dagkirurgi', plats: 'Dagkirurgi' });
    const o = await k.post(`/api/vardkontakt/${d.data.id}/overgang`, { till: 'slutenvard' });
    expect(o.status).toBe(201);
    const dag = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(d.data.id);
    const sluten = db.query("SELECT * FROM vardkontakter WHERE foregaende_id = ? AND typ = 'slutenvard'").get(d.data.id);
    expect(dag.slut).toBeTruthy();
    expect(sluten.halsoarende_id).toBe(dag.halsoarende_id);
    expect(sluten.orsak).toContain('Kvar efter dagkirurgi');
  });

  test('en dagkirurgisk kontakt eller uppföljning kan inte bakdateras eller läggas mer än ett år fram', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const bak = new Date(Date.now() - 200 * 86400_000).toISOString();
    const fram = new Date(Date.now() + 500 * 86400_000).toISOString();
    const antal = () => db.query("SELECT count(*) AS n FROM vardkontakter WHERE patient_id = 'p11'").get().n;
    const fore = antal();
    expect((await k.post('/api/patient/p11/dagkirurgi', { orsak: 'Elkonvertering', start: bak })).status).toBe(400);
    expect((await k.post('/api/patient/p11/dagkirurgi', { orsak: 'Elkonvertering', start: fram })).status).toBe(400);
    expect(antal()).toBe(fore);
    // Utan tid gäller nu.
    const nu = await k.post('/api/patient/p11/dagkirurgi', { orsak: 'Elkonvertering' });
    expect(Math.abs(Date.parse(nu.data.start) - Date.now())).toBeLessThan(60_000);
    const vt = db.query("SELECT id FROM vardtillfallen WHERE patient_id = 'p01' AND utskriven IS NULL").get();
    expect((await k.post(`/api/vardtillfalle/${vt.id}/overgang`, { till: 'oppenvard', start: bak })).status).toBe(400);
    expect((await k.post(`/api/vardtillfalle/${vt.id}/overgang`, { till: 'oppenvard', start: fram })).status).toBe(400);
    expect(db.query('SELECT utskriven FROM vardtillfallen WHERE id = ?').get(vt.id).utskriven).toBeNull();
  });

  test('den faktiska besökstiden registreras utan att kontakten avslutas', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    const db = sandlada(app, k).db;
    const v = db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, ankomst, plats, orsak, kalla) VALUES ('p11', 'uso-kard-mott', 'oppenvard', 'besok', ?, ?, 'Mottagning', 'Hjärtrytm', 'vardkallan')")
      .run(new Date(Date.now() - 50 * 60_000).toISOString(), new Date(Date.now() - 45 * 60_000).toISOString()).lastInsertRowid;
    const r = await k.post(`/api/vardkontakt/${v}/besok-slut`);
    expect(r.status).toBe(200);
    expect(r.data.faktiskBesokstidMinuter).toBe(45);
    expect(r.data.pagaende).toBe(true);
    expect(r.data.text).toContain('fortfarande öppen');
    expect((await k.post(`/api/vardkontakt/${v}/besok-slut`)).status).toBe(400);
    // En annan vårdenhets kontakt nekas.
    const vc = db.query("SELECT id FROM vardkontakter WHERE enhet_id = 'vc-tybble' AND slut IS NULL LIMIT 1").get();
    if (vc) expect([403, 400]).toContain((await k.post(`/api/vardkontakt/${vc.id}/besok-slut`)).status);
  });
});
