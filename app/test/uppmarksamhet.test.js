import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { nyDb, atk, testserver, klient, sandlada } from './hjalp.js';
import { KATEGORIER, GRADER, TERMER, forHuvud, symbolFor } from '../src/uppmarksamhet.js';
import * as regler from '../src/uppmarksamhet-regler.js';
import { personal } from './hjalp.js';
import { iso, idag } from '../src/db.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const nyckel = (h, regel) => h.uppmarksamhet.forslag.find(f => f.regel === regel)?.nyckel;

describe('Uppmärksamhetsinformation', () => {
  test('strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell', () => {
    expect(Object.keys(KATEGORIER)).toEqual(['medicinskt', 'smitta', 'overkanslighet', 'vardrutin']);
    expect(KATEGORIER.medicinskt.namn).toBe('Medicinska tillstånd och behandlingar');
    expect(Object.values(KATEGORIER.medicinskt.undergrupper)).toEqual(['Annat medicinskt tillstånd', 'Behandling', 'Förekomst av implantat', 'Förekomst av transplantat']);
    expect(Object.values(KATEGORIER.smitta.undergrupper)).toEqual(['Förekomst av smittämne', 'Förekomst av smittsam sjukdom']);
    expect(Object.values(KATEGORIER.overkanslighet.undergrupper).slice(0, 4)).toEqual(['Kemikalie', 'Aktiv substans', 'Hjälpämne läkemedel', 'Läkemedelsprodukt']);
    expect(Object.values(KATEGORIER.vardrutin.undergrupper)).toEqual(['Information som kan leda till särskild vårdrutin', 'Beslut som kan leda till särskild vårdrutin']);
    expect(Object.keys(GRADER)).toEqual(['livshotande', 'skadlig', 'besvarande']);
    // Manuell registrering bara ur en lista, aldrig fritext, och bara för det systemet inte kan räkna ut själv.
    for (const t of TERMER) {
      expect(KATEGORIER[t.kategori].undergrupper[t.undergrupp]).toBeDefined();
      expect(t.kategori).not.toBe('overkanslighet');
      expect(t.motivering.length).toBeGreaterThan(10);
    }
  });

  test('överkänsligheterna som redan finns ingår, med grad, och syns i symbolen', () => {
    const db = nyDb();
    const u = forHuvud(atk(db, 'lak-kard', 'p01'));
    const pc = u.poster.find(p => p.kategori === 'overkanslighet');
    expect(pc).toMatchObject({ term: 'Penicilliner', grad: 'skadlig', bekraftad: true, undergrupp: 'aktiv_substans', kod: { system: 'atc', kod: 'J01C' } });
    expect(u.symbol.overkanslighet).toBe('skadlig');
    // Jordnöt ligger utanför undergrupperna i tabellen och visas som övrig överkänslighet, med livshotande grad.
    const leo = forHuvud(atk(db, 'lak-vc', 'p09'));
    expect(leo.poster.find(p => p.kategori === 'overkanslighet')).toMatchObject({ term: 'Jordnöt', grad: 'livshotande', undergrupp: 'ovrigt' });
    expect(leo.symbol.overkanslighet).toBe('livshotande');
  });

  test('en ny överkänslighet ingår direkt och systemet föreslår graden', () => {
    const db = nyDb();
    db.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum) VALUES ('p01', 'uso-kard', 'Ibuprofen', 'M01AE01', 'Anafylaxi', 'allvarlig', ?)").run(idag());
    const u = forHuvud(atk(db, 'lak-kard', 'p01'));
    expect(u.poster.find(p => p.term === 'Ibuprofen')).toMatchObject({ grad: 'livshotande', bekraftad: false });
    expect(u.symbol.overkanslighet).toBe('livshotande');
    expect(u.forslag.find(f => f.regel === 'overkanslighet-grad')).toMatchObject({ grad: 'livshotande', kategori: 'overkanslighet' });
  });

  test('förslag ur läkemedelslistan: antikoagulantia blir behandling, men inte tillfällig behandling', () => {
    const db = nyDb();
    const f = forHuvud(atk(db, 'lak-kard', 'p01')).forslag.find(x => x.regel === 'antikoagulantia');
    expect(f).toMatchObject({ kategori: 'medicinskt', undergrupp: 'behandling', term: 'Antikoagulantiabehandling', kod: { system: 'atc', kod: 'B01AA03' } });
    expect(f.kalla.text).toContain('Waran');
    expect(f.varfor).toContain('läkemedelslistan');
    // Fragmin efter höftfrakturen är tillfällig och ska inte bli uppmärksamhetsinformation.
    expect(forHuvud(atk(db, 'lak-kkoga', 'p07')).forslag.some(x => x.regel === 'antikoagulantia')).toBe(false);
  });

  test('förslag ur läkemedelslistan: immunsuppression och långvarig kortisonbehandling', () => {
    const db = nyDb();
    const ins = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      VALUES ('p01', 'uso-kard', 'VK-NPL-0049', '1 tablett på morgonen', 'staende', 'Polymyalgia rheumatica', ?, ?, 'lak-kard', ?)`);
    ins.run(idag(), idag(), iso());
    const f = forHuvud(atk(db, 'lak-kard', 'p01')).forslag.find(x => x.regel === 'kortison');
    expect(f).toMatchObject({ kategori: 'medicinskt', undergrupp: 'behandling', term: 'Långvarig kortisonbehandling' });
    const r = regler.foresla({ ordinationer: [{ id: 1, typ: 'staende', aktuell: true, lakemedel: { atc: 'L04AX03', namn: 'Metotrexat' } }], diagnoser: [], overkanslighet: [] });
    expect(r.find(x => x.regel === 'immunsuppression')).toMatchObject({ term: 'Immunsuppressiv behandling', undergrupp: 'behandling' });
  });

  test('förslag ur diagnoserna: bärarskap blir smitta, implantat och transplantat blir medicinska tillstånd', () => {
    const r = regler.foresla({
      ordinationer: [], overkanslighet: [],
      diagnoser: [{ id: 1, kod: 'Z22.3', text: 'Bärare av andra specificerade patogena bakterier' }, { id: 2, kod: 'U82.1', text: 'Resistens mot meticillin' },
        { id: 3, kod: 'Z95.0', text: 'Förekomst av elektronisk kardiell anordning' }, { id: 4, kod: 'Z94.0', text: 'Njurtransplanterad' }],
    });
    expect(r.find(x => x.regel === 'smitta-barare')).toMatchObject({ kategori: 'smitta', undergrupp: 'smittamne', term: 'Bärare av MRSA', kod: { system: 'icd10se', kod: 'Z22.3' } });
    expect(r.find(x => x.regel === 'implantat')).toMatchObject({ kategori: 'medicinskt', undergrupp: 'implantat', term: 'Förekomst av elektronisk kardiell anordning' });
    expect(r.find(x => x.regel === 'transplantat')).toMatchObject({ kategori: 'medicinskt', undergrupp: 'transplantat', term: 'Njurtransplanterad' });
  });

  test('förslagsreglerna ligger i en egen modul och är märkta som demoregler', () => {
    expect(regler.DEMOREGLER).toBe(true);
    expect(regler.REGLER.length).toBeGreaterThanOrEqual(6);
    for (const r of regler.REGLER) expect(r.beskrivning).toBeTruthy();
    const db = nyDb();
    for (const f of forHuvud(atk(db, 'lak-kard', 'p01')).forslag) expect(f.demoregel).toBe(true);
  });

  test('läkaren bekräftar ett förslag med ett klick, och det loggas med vem, var och när', async () => {
    const k = await inloggad('lak-kard');
    const h = (await k.get('/api/patient/p01')).data;
    const n = nyckel(h, 'antikoagulantia');
    expect(n).toBeTruthy();
    const fore = loggRader(k).length;
    const r = await k.post('/api/patient/p01/uppmarksamhet', { forslag: n });
    expect(r.status).toBe(201);
    const post = r.data.poster.find(p => p.term === 'Antikoagulantiabehandling');
    expect(post).toMatchObject({ kategori: 'medicinskt', bekraftad: true, registrerad: { av: 'Sara Lindqvist', titel: 'Läkare' } });
    expect(post.registrerad.vardenhet.namn).toContain('Kardiologiska kliniken');
    expect(post.registrerad.tid).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.data.forslag.some(f => f.regel === 'antikoagulantia')).toBe(false);
    expect(r.data.symbol.medicinskt).toBe(true);
    const nya = loggRader(k).slice(fore);
    expect(nya).toEqual([expect.objectContaining({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'skriv_journal', resultat: 'tillaten', resurs: '/api/patient/p01/uppmarksamhet' })]);
    // Samma uppgift registreras inte två gånger.
    const igen = await k.post('/api/patient/p01/uppmarksamhet', { forslag: n });
    expect(igen.status).toBe(400);
  });

  test('manuell registrering bara ur listan, och samma term inte två gånger', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p01/uppmarksamhet', { term: 'påhittad' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/uppmarksamhet', {})).status).toBe(400);
    const r = await k.post('/api/patient/p01/uppmarksamhet', { term: 'svar-intubation' });
    expect(r.status).toBe(201);
    expect(r.data.symbol.vardrutin).toBe(true);
    expect((await k.post('/api/patient/p01/uppmarksamhet', { term: 'svar-intubation' })).status).toBe(400);
    const t = await k.get('/api/uppmarksamhet/termer');
    expect(t.data.termer.map(x => x.id)).toContain('svar-intubation');
  });

  test('ett avfärdat förslag kommer inte tillbaka, och avfärdandet loggas', async () => {
    const k = await inloggad('lak-kard');
    const n = nyckel((await k.get('/api/patient/p01')).data, 'antikoagulantia');
    const r = await k.post('/api/patient/p01/uppmarksamhet/avfard', { forslag: n });
    expect(r.status).toBe(200);
    expect(r.data.forslag.some(f => f.regel === 'antikoagulantia')).toBe(false);
    expect(r.data.poster.some(p => p.term === 'Antikoagulantiabehandling')).toBe(false);
    expect((await k.get('/api/patient/p01')).data.uppmarksamhet.forslag.some(f => f.regel === 'antikoagulantia')).toBe(false);
    expect(loggRader(k).at(-2)).toMatchObject({ handling: 'skriv_journal', resurs: '/api/patient/p01/uppmarksamhet/avfard' });
  });

  test('när behandlingen sätts ut föreslår systemet att uppgiften avslutas, och den avslutas aldrig utan orsak', async () => {
    const k = await inloggad('lak-kard');
    const n = nyckel((await k.get('/api/patient/p01')).data, 'antikoagulantia');
    const post = (await k.post('/api/patient/p01/uppmarksamhet', { forslag: n })).data.poster.find(p => p.term === 'Antikoagulantiabehandling');
    const waran = sandlada(app, k).db.query("SELECT id FROM ordinationer WHERE patient_id = 'p01' AND lakemedel_id = 'VK-NPL-0001'").get();
    expect((await k.post(`/api/ordination/${waran.id}/utsatt`, { orsak: 'Byte till apixaban' })).status).toBe(200);
    const h = (await k.get('/api/patient/p01')).data;
    const avsluta = h.uppmarksamhet.forslag.find(f => f.typ === 'avsluta' && f.postId === post.id);
    expect(avsluta.varfor).toContain('utsatt');
    expect((await k.post(`/api/uppmarksamhet/${post.id}/avsluta`, {})).status).toBe(400);
    const r = await k.post(`/api/uppmarksamhet/${post.id}/avsluta`, { orsak: avsluta.orsak });
    expect(r.status).toBe(200);
    expect(r.data.poster.some(p => p.id === post.id)).toBe(false);
    expect(sandlada(app, k).db.query('SELECT status, avslutad_av FROM uppmarksamhet WHERE id = ?').get(post.id)).toEqual({ status: 'avslutad', avslutad_av: 'lak-kard' });
    expect(() => sandlada(app, k).db.query('DELETE FROM uppmarksamhet WHERE id = ?').run(post.id)).toThrow();
  });

  test('sjuksköterska och undersköterska ser informationen men bekräftar inte, vårdadministratören ser den inte', async () => {
    for (const id of ['ssk-kard', 'usk-kard']) {
      const k = await inloggad(id);
      const h = (await k.get('/api/patient/p01')).data;
      expect(h.uppmarksamhet.symbol.overkanslighet).toBe('skadlig');
      expect(h.uppmarksamhet.forslag).toEqual([]);
      expect(h.uppmarksamhet.kanAndra).toBe(false);
      expect((await k.post('/api/patient/p01/uppmarksamhet', { term: 'svar-intubation' })).status).toBe(403);
    }
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/patient/p01')).data.uppmarksamhet).toBeNull();
    expect((await adm.get('/api/arbetslista')).data.every(r => r.uppmarksamhet === null)).toBe(true);
  });

  test('spärrade uppgifter syns inte i symbolen förrän patienten samtycker', () => {
    const db = nyDb();
    db.query(`INSERT INTO uppmarksamhet (patient_id, enhet_id, kategori, undergrupp, term, motivering, status, registrerad, registrerad_av)
      VALUES ('p04', 'uso-psyk', 'vardrutin', 'information', 'Svår intubation', 'Demo', 'aktiv', ?, 'lak-psyk')`).run(iso());
    expect(forHuvud(atk(db, 'lak-kard', 'p04')).symbol.vardrutin).toBe(false);
    expect(forHuvud(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true })).symbol.vardrutin).toBe(true);
    expect(forHuvud(atk(db, 'lak-psyk', 'p04')).symbol.vardrutin).toBe(true);
  });

  test('arbetslistan visar bara kategorierna, utan innehåll', async () => {
    const k = await inloggad('lak-akut');
    const rad = (await k.get('/api/arbetslista')).data.find(r => r.id === 'p08');
    expect(rad.uppmarksamhet).toEqual({ medicinskt: false, smitta: true, overkanslighet: null, vardrutin: false });
    expect(JSON.stringify(rad)).not.toContain('MRSA');
  });

  test('väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet', async () => {
    const k = await inloggad('lak-akut');
    const p03 = (await k.get('/api/vantrum')).data.find(r => r.patientId === 'p03');
    expect(p03.namn).toBeNull();
    expect(p03.uppmarksamhet).toEqual({ medicinskt: false, smitta: false, overkanslighet: null, vardrutin: true });
    const annan = await inloggad('lak-kard');
    for (const r of (await annan.get('/api/vantrum')).data) expect(r.uppmarksamhet).toBeUndefined();
    // Symbolen kräver samma grund som journalen.
    const db = nyDb();
    expect(symbolFor(db, personal(db, 'lak-kard'), 'p13')).toBeNull();
  });

  test('läskopian har uppmärksamhetsinformationen och symbolen', async () => {
    const k = await inloggad('lak-akut');
    const kopia = (await k.get('/api/lasekopia')).data;
    expect(kopia.arbetslista.find(r => r.id === 'p08').uppmarksamhet.smitta).toBe(true);
    expect(kopia.patienter.p08.huvud.uppmarksamhet.poster.some(p => p.term === 'Bärare av MRSA')).toBe(true);
  });

  test('Min journal visar patientens uppmärksamhetsinformation, utan förslag och personalens id', async () => {
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-p01' })).status).toBe(200);
    const d = (await k.get('/api/min/journal/p01/oversikt')).data;
    expect(d.uppmarksamhet.poster.find(p => p.kategori === 'overkanslighet')).toMatchObject({ term: 'Penicilliner', grad: 'skadlig' });
    expect(d.uppmarksamhet.symbol.overkanslighet).toBe('skadlig');
    expect(d.uppmarksamhet.forslag).toBeUndefined();
    const text = JSON.stringify(d.uppmarksamhet);
    expect(text).not.toContain('lak-');
    expect(text).not.toContain('SE2321000164-VKP');
  });

  test('FHIR: Flag och AllergyIntolerance med samma behörighet och loggning', async () => {
    const k = await inloggad('lak-akut');
    const fore = loggRader(k).length;
    const b = (await k.get('/fhir/Flag?patient=p08')).data;
    expect(b.resourceType).toBe('Bundle');
    const flag = b.entry[0].resource;
    expect(flag).toMatchObject({ resourceType: 'Flag', status: 'active', subject: { reference: 'Patient/p08' }, code: { text: 'Bärare av MRSA' } });
    expect(flag.category[0].coding[0]).toMatchObject({ code: 'smitta' });
    expect(flag.code.coding[0]).toMatchObject({ code: 'Z22.3' });
    expect(loggRader(k).slice(fore)).toEqual([expect.objectContaining({ handling: 'las_oversikt', resurs: 'fhir/Flag?patient=p08', resultat: 'tillaten' })]);
    expect((await k.get(`/fhir/Flag/${flag.id}`)).data.id).toBe(flag.id);
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/fhir/Flag?patient=p01')).status).toBe(403);
    const inv = klient(app);
    await inv.post('/api/login/invanare', { invanareId: 'inv-p08' });
    expect((await inv.get('/fhir/Flag?patient=p08')).data.entry[0].resource.code.text).toBe('Bärare av MRSA');
    expect((await inv.get('/fhir/Flag?patient=p01')).status).toBe(404);
    // Ett avfärdat förslag är ingen uppmärksamhetsinformation och finns inte i FHIR.
    const lk = await inloggad('lak-kard');
    const n = nyckel((await lk.get('/api/patient/p01')).data, 'antikoagulantia');
    await lk.post('/api/patient/p01/uppmarksamhet/avfard', { forslag: n });
    const avf = sandlada(app, lk).db.query("SELECT id FROM uppmarksamhet WHERE status = 'avfard'").get();
    expect((await lk.get(`/fhir/Flag/${avf.id}`)).status).toBe(404);
    expect((await lk.get('/fhir/Flag?patient=p01')).data.entry ?? []).toEqual([]);
  });
});
