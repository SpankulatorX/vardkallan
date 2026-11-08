// Runda 10, r1: fler skrivningar via det öppna API:t (Sussa 2.5.1.1). Överkänslighet registreras i gränssnittet och via
// FHIR med samma funktion, nya patienter registreras via FHIR med samma tolkning av numret och dubblettkontroll som i
// gränssnittet, och personalen läser hela journalen med Patient/$everything där varje del prövas och loggas för sig.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { SYSTEM } from '../src/kodverk.js';
import TESTPNR from '../src/seed/testpersonnummer.json' with { type: 'json' };

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const PNR = 'http://electronichealth.se/identifier/personnummer';

// Ett testpersonnummer från Skatteverket som inte finns i sandlådan.
const ledigtPnr = (db) => TESTPNR.find(n => !db.query('SELECT 1 FROM identiteter WHERE varde = ?').get(n) && !db.query('SELECT 1 FROM patienter WHERE personnummer = ?').get(n));
const allergi = (pid, extra = {}) => ({ resourceType: 'AllergyIntolerance', patient: { reference: `Patient/${pid}` }, code: { coding: [{ system: SYSTEM.atc, code: 'M01A' }] }, reaction: [{ manifestation: [{ text: 'Anafylaxi' }] }], criticality: 'high', ...extra });
function nyDiagnos(k, pid, enhet = 'uso-kard', kod = 'I48.0') {
  const db = sandlada(app, k).db;
  const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut) VALUES (?, ?, 'oppenvard', '2026-11-02T09:00', '2026-11-02T09:30') RETURNING id").get(pid, enhet).id);
  const d = db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, datum, vardkontakt_id, typ) VALUES (?, ?, ?, 'Förmaksflimmer', '2026-11-02', ?, 'huvud') RETURNING id").get(pid, enhet, kod, vk);
  return { vk, id: Number(d.id) };
}

describe('Fler skrivningar via API:t', () => {
  // Runda 10, r1: registreringen görs i överkänslighetens eget flöde (overkanslighet.js, runda 10, r2). Det som r1 lade
  // till är uppmärksamhetsinformationen med bekräftad grad och ATC-kod och varningarna för läkemedel som omfattas.
  test('Överkänslighet: läkarens registrering blir uppmärksamhetsinformation med bekräftad grad och ATC-kod och varnar för läkemedel i listan som omfattas, bara bland ordinationer som läkaren får se', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    // En aktuell ordination på kardiologen och en på psykiatrin, som patienten har spärrat.
    const lm = db.query("SELECT id, namn FROM katalog WHERE atc LIKE 'M01A%' ORDER BY id LIMIT 1").get();
    const lm2 = db.query("SELECT id, namn FROM katalog WHERE atc LIKE 'M01A%' AND id <> ? ORDER BY id LIMIT 1").get(lm.id);
    const ord = (pid, enhet, lid) => db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES (?, ?, ?, '1 tablett vid behov', 1, 'vid_behov', 'Smärta', '2026-12-31', '2026-11-01', 'lak-kard', '2026-11-01T08:00:00.000Z')").run(pid, enhet, lid);
    ord('p01', 'uso-kard', lm.id);
    ord('p04', 'uso-psyk', lm2.id);
    const r = await k.post('/api/patient/p01/overkanslighet', { amne: 'NSAID', reaktion: 'Nässelutslag och svullnad i huden' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ amne: 'Antiinflammatoriska läkemedel (NSAID)', atc: 'M01A', allvarlighet: 'mattlig', grad: 'besvarande', gradBekraftad: true });
    expect(r.data.varningar.map(v => v.text).join(' ')).toContain(lm.namn);
    const h = await k.get('/api/patient/p01');
    expect(h.data.uppmarksamhet.poster.find(p => p.term === 'Antiinflammatoriska läkemedel (NSAID)')).toMatchObject({ kategori: 'overkanslighet', grad: 'besvarande', bekraftad: true, kod: { system: 'atc', kod: 'M01A' } });
    // Läkaren väljer graden själv.
    const v = await k.post('/api/patient/p01/overkanslighet', { amne: 'Latex', reaktion: 'Utslag', grad: 'livshotande' });
    expect(v.data).toMatchObject({ grad: 'livshotande', gradBekraftad: true, varningar: [] });
    expect((await k.post('/api/patient/p01/overkanslighet', { amne: 'Ägg', reaktion: 'Utslag', grad: 'farlig' })).status).toBe(400);
    // Den spärrade vårdenhetens ordination ger ingen varning, och svaret röjer den inte.
    const s = await k.post('/api/patient/p04/overkanslighet', { amne: 'NSAID', reaktion: 'Utslag' });
    expect(s.status).toBe(201);
    expect(JSON.stringify(s.data)).not.toContain(lm2.namn);
    // En sjuksköterska registrerar, och då föreslår systemet graden för läkaren att bekräfta.
    await k.logga('ssk-kard');
    const n = await k.post('/api/patient/p01/overkanslighet', { amne: 'Jordnöt', reaktion: 'Anafylaxi' });
    expect(n.data).toMatchObject({ grad: 'livshotande', gradBekraftad: false });
    await k.logga('lak-kard');
    const f = (await k.get('/api/patient/p01')).data.uppmarksamhet.forslag;
    expect(f.some(x => x.kategori === 'overkanslighet' && x.term === 'Jordnöt' && x.grad === 'livshotande')).toBe(true);
  });

  test('AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    expect((await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01'))).status).toBe(403);
    await k.logga('lak-kard');
    const r = await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01'));
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ resourceType: 'AllergyIntolerance', patient: { reference: 'Patient/p01' }, criticality: 'high' });
    expect(r.data.code.coding[0].code).toBe('M01A');
    expect(r.headers.get('location')).toBe(`${app.url}/fhir/AllergyIntolerance/${r.data.id}`);
    // Samma rad som gränssnittet: med version, historik och uppmärksamhetsinformationen med graden.
    const db = sandlada(app, k).db;
    expect(db.query('SELECT version, registrerad_av FROM overkanslighet WHERE id = ?').get(Number(r.data.id))).toEqual({ version: 1, registrerad_av: 'lak-kard' });
    expect(db.query("SELECT handelse FROM overkanslighet_handelser WHERE overkanslighet_id = ?").all(Number(r.data.id)).map(x => x.handelse)).toEqual(['registrerad']);
    const h = await k.get('/api/patient/p01');
    expect(h.data.uppmarksamhet.poster.some(p => p.kategori === 'overkanslighet' && p.bekraftad && p.kod?.kod === r.data.code.coding[0].code)).toBe(true);
    // Ämnet med bara text och en lindrig reaktion.
    const t = await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01', { code: { text: 'Latex' }, reaction: [{ manifestation: [{ text: 'Hudutslag' }] }], criticality: 'low' }));
    expect(t.status).toBe(201);
    expect(t.data).toMatchObject({ criticality: 'low', category: ['environment'] });
    const dubblett = await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01', { code: { text: 'Latex' }, reaction: [{ manifestation: [{ text: 'Utslag' }] }] }));
    expect(dubblett.status).toBe(400);
    expect(dubblett.data.issue[0].diagnostics).toContain('redan registrerad');
    expect((await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01', { code: { text: 'Ägg' }, reaction: [] }))).status).toBe(400);
    expect((await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p01', { code: { coding: [{ system: SYSTEM.atc, code: 'X99' }] } }))).status).toBe(400);
    expect((await k.raw('POST', '/fhir/AllergyIntolerance', allergi('p99'))).status).toBe(404);
    expect(logg(k).some(l => l.handling === 'registrera_overkanslighet' && l.resurs === `overkanslighet:${r.data.id}` && l.resultat === 'tillaten')).toBe(true);
  });

  test('Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const pnr = ledigtPnr(db);
    const ny = { resourceType: 'Patient', identifier: [{ system: PNR, value: pnr }], name: [{ family: 'Demosson', given: ['Ida'] }] };
    const r = await k.raw('POST', '/fhir/Patient', ny);
    expect([r.status, r.data.issue?.[0]?.diagnostics]).toEqual([201, undefined]);
    // Kön och födelsedatum tolkar systemet ur numret, som i gränssnittet.
    expect(r.data).toMatchObject({ resourceType: 'Patient', name: [{ family: 'Demosson', given: ['Ida'] }], birthDate: `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}` });
    expect(r.data.identifier[0]).toMatchObject({ system: PNR, value: pnr });
    const dubblett = await k.raw('POST', '/fhir/Patient', ny);
    expect(dubblett.status).toBe(409);
    expect(dubblett.data.issue[0].diagnostics).toContain('finns redan');
    // Utan identitet skapar systemet ett reservnummer ur kön och födelsedatumet.
    const res = await k.raw('POST', '/fhir/Patient', { resourceType: 'Patient', gender: 'female', birthDate: '1950-04-02' });
    expect(res.status).toBe(201);
    expect(res.data.identifier[0].system).not.toBe(PNR);
    expect((await k.raw('POST', '/fhir/Patient', { resourceType: 'Patient', identifier: [{ system: PNR, value: '19121212121' }], name: [{ family: 'A', given: ['B'] }] })).status).toBe(400);
    expect(logg(k).some(l => l.handling === 'registrera_patient' && l.patient_id === r.data.id && l.resurs.startsWith('registrering:'))).toBe(true);
    await k.logga('logg');
    expect((await k.raw('POST', '/fhir/Patient', ny)).status).toBe(403);
  });

  test('Patient/$everything för personalen: varje resurstyp prövas och loggas för sig, och bara det personen får se kommer med', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const egen = nyDiagnos(k, 'p01');
    const annan = nyDiagnos(k, 'p01', 'uso-med');
    const r = await k.raw('GET', '/fhir/Patient/p01/$everything');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ resourceType: 'Bundle', type: 'searchset' });
    const typer = new Set(r.data.entry.map(e => e.resource.resourceType));
    for (const t of ['Patient', 'Condition', 'Observation', 'MedicationRequest', 'Encounter']) expect([t, typer.has(t)]).toEqual([t, true]);
    const diagnoser = r.data.entry.filter(e => e.resource.resourceType === 'Condition').map(e => e.resource.id);
    expect(diagnoser).toContain(String(egen.id));
    // En annan vårdenhets diagnos kräver ett aktivt val och kommer inte med.
    expect(diagnoser).not.toContain(String(annan.id));
    const rader = logg(k).filter(l => l.personal_id === 'lak-kard' && l.patient_id === 'p01' && l.resurs?.startsWith('fhir/'));
    expect(rader.map(l => l.resurs)).toEqual(expect.arrayContaining(['fhir/Patient/p01/$everything', 'fhir/Condition?patient=p01', 'fhir/Observation?patient=p01']));
    // Utan vårdrelation nekas hela operationen, och det loggas.
    const utan = db.query("SELECT id FROM patienter p WHERE skyddad = 0 AND sammanslagen_till IS NULL AND NOT EXISTS (SELECT 1 FROM vardkontakter v WHERE v.patient_id = p.id AND v.enhet_id LIKE 'uso-kard%') AND NOT EXISTS (SELECT 1 FROM remisser r WHERE r.patient_id = p.id) AND NOT EXISTS (SELECT 1 FROM listningar l WHERE l.patient_id = p.id) ORDER BY id LIMIT 1").get();
    expect((await k.raw('GET', `/fhir/Patient/${utan.id}/$everything`)).status).toBe(403);
    // CapabilityStatement beskriver operationen för personalen.
    const cs = (await k.raw('GET', '/fhir/metadata')).data;
    expect(cs.rest[0].resource.find(x => x.type === 'Patient').operation[0].documentation).toContain('personalen');
  });
});
