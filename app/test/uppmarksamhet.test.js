import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { nyDb, atk, testserver, klient, sandlada } from './hjalp.js';
import { KATEGORIER, GRADER, TERMER, forHuvud, symbolFor, registrera } from '../src/uppmarksamhet.js';
import * as regler from '../src/uppmarksamhet-regler.js';
import * as umi from '../src/umi-kodverk.js';
import { provaBegrepp } from '../src/fackssprak.js';
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
    // Runda 10, r4: listan är Socialstyrelsens kodverkslista, och motiveringen är listans (den saknas för en del termer).
    for (const t of TERMER) {
      expect(KATEGORIER[t.kategori].undergrupper[t.undergrupp]).toBeDefined();
      expect(t.kategori).not.toBe('overkanslighet');
      expect(umi.termFor(t.undergrupp, t.term)).toBeTruthy();
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

  test('förslag ur läkemedelslistan: immunmodulerande behandling och cytostatika enligt kodverkslistan', () => {
    const db = nyDb();
    const ins = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      VALUES ('p01', 'uso-kard', 'VK-NPL-0049', '1 tablett på morgonen', 'staende', 'Polymyalgia rheumatica', ?, ?, 'lak-kard', ?)`);
    ins.run(idag(), idag(), iso());
    // Glukokortikoider står inte bland behandlingarna i kodverkslistan och blir inget förslag.
    expect(forHuvud(atk(db, 'lak-kard', 'p01')).forslag.some(x => x.kod?.kod?.startsWith('H02'))).toBe(false);
    const r = regler.foresla({ ordinationer: [{ id: 1, typ: 'staende', aktuell: true, lakemedel: { atc: 'L04AX03', namn: 'Metotrexat' } }, { id: 2, typ: 'staende', aktuell: true, lakemedel: { atc: 'L01XE01', namn: 'Imatinib' } }], diagnoser: [], overkanslighet: [] });
    expect(r.find(x => x.regel === 'immunsuppression')).toMatchObject({ term: 'Immunmodulerande behandling', undergrupp: 'behandling', nationell: { atc: ['L03A', 'L04'] } });
    expect(r.find(x => x.regel === 'cytostatika')).toMatchObject({ term: 'Cytostatikabehandling' });
    expect(r.find(x => x.regel === 'cytostatika').motivering).toContain('Kemoterapi');
  });

  test('förslag ur diagnoserna: bärarskap blir smitta, implantat och transplantat blir medicinska tillstånd', () => {
    const r = regler.foresla({
      ordinationer: [], overkanslighet: [],
      diagnoser: [{ id: 1, kod: 'Z22.3', text: 'Bärare av andra specificerade patogena bakterier' }, { id: 2, kod: 'U82.1', text: 'Resistens mot meticillin' },
        { id: 5, kod: 'B95.6', text: 'Staphylococcus aureus som orsak till sjukdomar som klassificeras i andra kapitel' },
        { id: 3, kod: 'Z95.0', text: 'Förekomst av elektronisk kardiell anordning' }, { id: 4, kod: 'Z94.0', text: 'Njurtransplanterad' }],
    });
    // Runda 10, r4: termerna är kodverkslistans, med Snomed CT.
    expect(r.find(x => x.regel === 'smitta-barare')).toMatchObject({ kategori: 'smitta', undergrupp: 'smittamne', term: 'MRSA (meticillinresistenta Staphylococcus aureus)', kod: { system: 'icd10se', kod: 'Z22.3' },
      nationell: { snomed: [{ kod: '432415000' }], icd: ['Z22.3C', 'B95.6', 'U82.1'] } });
    // Utan alla koderna i kombinationen blir det inget förslag om MRSA.
    expect(regler.foresla({ ordinationer: [], overkanslighet: [], diagnoser: [{ id: 1, kod: 'Z22.3', text: 'Bärare' }, { id: 2, kod: 'U82.1', text: 'Resistens' }] }).some(x => x.regel === 'smitta-barare')).toBe(false);
    // Z95.0 gäller flera implantat i kodverkslistan: ett förslag per implantat, och läkaren bekräftar det som stämmer.
    const imp = r.filter(x => x.regel === 'implantat').map(x => x.term);
    expect(imp).toEqual(expect.arrayContaining(['Pacemaker', 'Pacemakerelektrod']));
    expect(r.find(x => x.term === 'Pacemaker').varfor).toContain('Bekräfta den som stämmer');
    expect(r.find(x => x.regel === 'transplantat')).toMatchObject({ kategori: 'medicinskt', undergrupp: 'transplantat', term: 'Njurtransplanterad', nationell: { snomed: [{ kod: '737295003' }] } });
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
    // Runda 10, r4: termerna är kodverkslistans. Ett äldre id pekar på listans term.
    const r = await k.post('/api/patient/p01/uppmarksamhet', { term: 'avsta-hlr' });
    expect(r.status).toBe(201);
    expect(r.data.symbol.vardrutin).toBe(true);
    expect(r.data.poster.find(p => p.kategori === 'vardrutin').term).toBe('Läkarbeslut finns om att inte utföra hjärt-lungräddning');
    expect((await k.post('/api/patient/p01/uppmarksamhet', { term: 'lakarbeslut-finns-om-att-inte-utfora-hjart-lungraddning' })).status).toBe(400);
    const t = await k.get('/api/uppmarksamhet/termer');
    expect(t.data.termer.map(x => x.id)).toContain('svarintuberad');
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
    expect((await k.post(`/api/ordination/${waran.id}/utsatt`, { orsak: 'Byte till apixaban', plan: { typ: 'byte', ersattMed: 'Eliquis' } })).status).toBe(200);
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

  test('en bekräftad uppgift ur spärrade uppgifter följer källans spärr, och utsättningen röjs inte i förslagen', () => {
    const db = nyDb();
    db.query(`INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p04', 'uso-psyk', 'Z22.3', 'Bärare av andra specificerade patogena bakterier', 'bi', ?)`).run(idag());
    // Runda 10, r4: MRSA i kodverkslistan är kombinationen Z22.3, B95.6 och U82.1.
    for (const [kod, text] of [['B95.6', 'Staphylococcus aureus'], ['U82.1', 'Resistens mot meticillin']]) db.query(`INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p04', 'uso-psyk', ?, ?, 'bi', ?)`).run(kod, text, idag());
    const medSamtycke = atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'skriv_journal');
    const f = forHuvud(medSamtycke).forslag.find(x => x.regel === 'smitta-barare');
    expect(f).toBeTruthy();
    registrera(medSamtycke, { forslag: f.nyckel });
    expect(db.query("SELECT enhet_id FROM uppmarksamhet WHERE patient_id = 'p04' AND regel = 'smitta-barare'").get().enhet_id).toBe('uso-psyk');
    expect(forHuvud(atk(db, 'lak-kard', 'p04')).symbol.smitta).toBe(false);
    expect(forHuvud(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true })).symbol.smitta).toBe(true);
    // En uppgift ur en spärrad ordination som har satts ut: förslaget att avsluta, med läkemedlets namn och orsak, visas inte utan samtycke.
    const o = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, utsatt_tid, utsatt_orsak, ordinerad_av, skapad)
      SELECT 'p04', 'uso-psyk', id, '1 x 1', 'staende', 'Demo', ?, ?, 'utsatt', ?, 'Hemlig orsak', 'lak-psyk', ? FROM katalog WHERE atc LIKE 'B01AF%' LIMIT 1`).run(idag(), idag(), iso(), iso());
    db.query(`INSERT INTO uppmarksamhet (patient_id, enhet_id, kategori, undergrupp, term, status, registrerad, registrerad_av, kalla_typ, kalla_id, regel)
      VALUES ('p04', 'uso-kard', 'medicinskt', 'behandling', 'Antikoagulantiabehandling', 'aktiv', ?, 'lak-kard', 'ordination', ?, 'antikoagulantia')`).run(iso(), o.lastInsertRowid);
    const utan = forHuvud(atk(db, 'lak-kard', 'p04', {}, 'skriv_journal')).forslag.filter(x => x.typ === 'avsluta');
    expect(JSON.stringify(utan)).not.toContain('Hemlig orsak');
    expect(utan).toEqual([]);
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
    expect(kopia.patienter.p08.huvud.uppmarksamhet.poster.some(p => p.term === 'MRSA (meticillinresistenta Staphylococcus aureus)')).toBe(true);
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
    expect(flag).toMatchObject({ resourceType: 'Flag', status: 'active', subject: { reference: 'Patient/p08' }, code: { text: 'MRSA (meticillinresistenta Staphylococcus aureus)' } });
    expect(flag.category[0].coding[0]).toMatchObject({ code: 'smitta' });
    expect(flag.code.coding[0]).toMatchObject({ code: 'Z22.3' });
    // Runda 10, r4: och termens begrepp i Snomed CT ur kodverkslistan.
    expect(flag.code.coding[1]).toEqual({ system: 'http://snomed.info/sct', code: '432415000' });
    expect(loggRader(k).slice(fore)).toEqual([expect.objectContaining({ handling: 'las_oversikt', resurs: 'fhir/Flag?patient=p08', resultat: 'tillaten' })]);
    expect((await k.get(`/fhir/Flag/${flag.id}`)).data.id).toBe(flag.id);
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/fhir/Flag?patient=p01')).status).toBe(403);
    const inv = klient(app);
    await inv.post('/api/login/invanare', { invanareId: 'inv-p08' });
    expect((await inv.get('/fhir/Flag?patient=p08')).data.entry[0].resource.code.text).toBe('MRSA (meticillinresistenta Staphylococcus aureus)');
    expect((await inv.get('/fhir/Flag?patient=p01')).status).toBe(404);
    // Ett avfärdat förslag är ingen uppmärksamhetsinformation och finns inte i FHIR.
    const lk = await inloggad('lak-kard');
    const n = nyckel((await lk.get('/api/patient/p01')).data, 'antikoagulantia');
    await lk.post('/api/patient/p01/uppmarksamhet/avfard', { forslag: n });
    const avf = sandlada(app, lk).db.query("SELECT id FROM uppmarksamhet WHERE status = 'avfard'").get();
    expect((await lk.get(`/fhir/Flag/${avf.id}`)).status).toBe(404);
    expect((await lk.get('/fhir/Flag?patient=p01')).data.entry ?? []).toEqual([]);
  });

  // Runda 10, r4: Socialstyrelsens kodverkslista (Sussa 3.1.5.1).
  test('kodverkslistan är Socialstyrelsens version 6.1.2 med Snomed CT, ICD-10-SE, ATC och motivering för termerna', () => {
    expect(umi.KODVERK.kalla).toMatchObject({ publicerad: '2025-12-15', sha256: 'deb89adce3e87447e1b5aba11a6be716326a69a37aa598b884be21eb7c048db9', snomed: 'SCTSE 2025_1' });
    expect(umi.TERMER.length).toBe(94);
    const ug = new Set(umi.TERMER.map(t => t.undergrupp));
    for (const u of ['annat_tillstand', 'behandling', 'implantat', 'transplantat', 'smittamne', 'smittsam_sjukdom', 'kemikalie', 'information', 'beslut']) expect(ug.has(u)).toBe(true);
    for (const t of umi.TERMER) {
      expect(t.icd.length + t.atc.length + t.snomed.length).toBeGreaterThan(0);
      for (const s of [...t.snomed, ...t.material]) expect({ kod: s.kod, ok: provaBegrepp(s.kod).ok }).toEqual({ kod: s.kod, ok: true });
      for (const k of t.icd) expect(k).toMatch(/^[A-Z]\d{2}(\.\d{1,2}[A-Z]?)?$|^[A-Z]\d{3}$/);
      expect(KATEGORIER[t.kategori].undergrupper[t.undergrupp]).toBeDefined();
    }
    expect(umi.termMedId('addisons-sjukdom')).toMatchObject({ icd: ['E27.1'], snomed: [{ kod: '373662000' }, { kod: '363732003' }] });
    expect(umi.termMedId('addisons-sjukdom').motivering).toBe('Patienten har behov av kortisonsubstitution i samband med annat insjuknande, till exempel infektion.');
    for (const id of Object.keys(umi.ALIAS)) expect(umi.termMedId(id)).toBeTruthy();
    expect(umi.termMedId('constructor')).toBeNull();
    expect(umi.svensktBegrepp('59821000052101')).toBe(true);
    expect(umi.svensktBegrepp('432415000')).toBe(false);
    // Reaktionen vid överkänslighet blir en term i listan.
    expect(umi.reaktionFor('Anafylaxi efter injektion')).toMatchObject({ term: 'Anafylaktisk reaktion', typ: 'Varningsinformation', snomed: { kod: '39579001' } });
    expect(umi.reaktionFor('Klåda och hudrodnad')).toMatchObject({ typ: 'Observandum' });
  });

  test('registrerad uppmärksamhetsinformation har termen ur kodverkslistan med koder och motivering', async () => {
    const k = await inloggad('lak-kard');
    const n = nyckel((await k.get('/api/patient/p01')).data, 'antikoagulantia');
    const r = await k.post('/api/patient/p01/uppmarksamhet', { forslag: n });
    const post = r.data.poster.find(p => p.term === 'Antikoagulantiabehandling');
    expect(post.nationell).toMatchObject({ id: 'antikoagulantiabehandling', atc: ['B01AA', 'B01AB', 'B01AE', 'B01AF'], icd: ['Z92.1'], oid: '1.2.752.116.3.1.16.1.2' });
    expect(post.nationell.kalla).toContain('version 6.1.2');
    expect(post.motivering).toBe(umi.termMedId('antikoagulantiabehandling').motivering);
    // Överkänsligheten får reaktionen som term i kodverkslistan.
    const pc = r.data.poster.find(p => p.kategori === 'overkanslighet');
    expect(pc).toHaveProperty('reaktion');
    // Seedens MRSA och blodtransfusion är kodverkslistans termer.
    const h8 = forHuvud(atk(nyDb(), 'lak-inf', 'p08'));
    expect(h8.poster.find(p => p.kategori === 'smitta').nationell.snomed[0].kod).toBe('432415000');
  });
});
