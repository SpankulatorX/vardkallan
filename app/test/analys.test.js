// Runda 9, r7: patientgruppering (Sussa 6.2.1.2) och statistik och analys i kärnsystemet (Sussa 6.2.1.1). Testnamnen
// står i src/sussa/mappning/6.2.1.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as analys from '../src/analys.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Patientgruppering', () => {
  test('villkoren kontrolleras och skrivs på vanlig svenska, och färdiga grupper har målvärden ur riktlinjerna', () => {
    const v = analys.provaVillkor({ diagnoser: { koder: ['e11'] }, matvarden: [{ typ: 'hba1c', jamforelse: 'over', varde: '52' }], demografi: { alderFran: 65 }, period: { fran: '2025-11-08', till: '2026-11-08' } });
    expect(v.diagnoser.koder).toEqual(['E11']);
    expect(analys.beskriv(v)).toBe('Patienter med diagnos E11, och senaste HbA1c under perioden över 52 mmol/mol, och 65 år eller äldre. Perioden är 2025-11-08 till 2026-11-08.');
    const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
    expect(fel(() => analys.provaVillkor({ diagnoser: { koder: ['hjärta'] } })).message).toContain('ICD-10-kod');
    expect(fel(() => analys.provaVillkor({})).message).toContain('minst ett villkor');
    expect(fel(() => analys.provaVillkor({ demografi: { alderFran: 80, alderTill: 60 } })).message).toContain('lägre');
    const mall = analys.MALLGRUPPER.find(m => m.id === 'diabetes-hba1c');
    expect(mall.villkor.matvarden[0]).toEqual({ typ: 'hba1c', jamforelse: 'over', varde: 52 });
    expect(analys.MATT_I_VILLKOR.hba1c.kalla).toContain('52');
  });

  test('läkaren grupperar sina patienter på diagnos, mätvärde, läkemedel, besök och demografi och får en lista som loggas', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const r = await k.post('/api/analys/grupp', { mall: 'diabetes-hba1c' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ niva: 'enhet', namn: 'Diabetes med HbA1c över målnivån' });
    expect(r.data.patienter.map(p => p.id)).toEqual(['p06']);
    expect(r.data.patienter[0].skal.join(' ')).toContain('HbA1c 61');
    // Hypertoni och minst en vårdkontakt, 60 år eller äldre, med läkemedel i ATC C08.
    const h = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['I10'] }, lakemedel: { atc: ['C08'] }, besok: { minst: 1 }, demografi: { alderFran: 60 } } });
    expect(h.data.patienter.map(p => p.id).sort()).toEqual(['p06', 'p07']);
    const db = sandlada(app, k).db;
    const rader = db.query("SELECT patient_id FROM atkomstlogg WHERE handling = 'patientgrupp' AND personal_id = 'lak-vc'").all().map(x => x.patient_id);
    expect(rader).toEqual(expect.arrayContaining(['p06', 'p07']));
    // Tidsintervallet: en period när inget HbA1c mättes ger ingen träff.
    const gammal = await k.post('/api/analys/grupp', { mall: 'diabetes-hba1c', period: { fran: '2020-01-01', till: '2020-12-31' } });
    expect(gammal.data.antal).toBe(0);
  });

  test('gruppen räknas bara på uppgifter som läkaren får se utan aktivt val, och aldrig på spärrade uppgifter', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    // Elin Sandberg (p04) har en depression på den spärrade psykiatrin och vårdas på kardiologen.
    const psyk = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['F33'] } } });
    expect(psyk.data.antal).toBe(0);
    expect(JSON.stringify(psyk.data)).not.toContain('Elin');
    // Hela svaret är detsamma med och utan en dold rad på den spärrade vårdenheten.
    const fore = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['I21'] } } });
    const db = sandlada(app, k).db;
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p04', 'uso-psyk', 'I21.9', 'Akut hjärtinfarkt', 'bi', '2026-11-01')").run();
    const efter = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['I21'] } } });
    expect(JSON.stringify(efter.data.patienter)).toBe(JSON.stringify(fore.data.patienter));
    // En diagnos från vårdcentralen (annan vårdenhet, kräver aktivt val) räknas inte för kardiologen.
    const vc = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['I10'] } } });
    expect(vc.data.patienter.map(p => p.id)).not.toContain('p01');
    // Läkemedelslistan är gemensam och räknas.
    const lm = await k.post('/api/analys/grupp', { villkor: { lakemedel: { atc: ['B01AA'] } } });
    expect(lm.data.patienter.map(p => p.id)).toContain('p01');
  });

  test('en patient utan vårdrelation på vårdenheten kommer aldrig med i läkarens grupp', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const db = sandlada(app, k).db;
    db.query("INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd) VALUES ('p90', '199001012384', 'Test', 'Utanför', 'kvinna', '1990-01-01')").run();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p90', 'vc-tybble', 'E11.9', 'Diabetes', 'huvud', '2026-01-01')").run();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p90', 'vc-tybble', 'hba1c', '80', 80, 'mmol/mol', '2026-10-01T10:00:00Z')").run();
    const r = await k.post('/api/analys/grupp', { mall: 'diabetes-hba1c' });
    expect(r.data.patienter.map(p => p.id)).not.toContain('p90');
  });

  test('uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const r = await k.post('/api/analys/grupp', { villkor: { diagnoser: { koder: ['I10'] } } });
    expect(r.status).toBe(200);
    expect(r.data.niva).toBe('region');
    expect(r.data.patienter).toBeUndefined();
    expect(r.data.antal).toBeGreaterThanOrEqual(5);
    // En fördelning med bara en liten ruta döljer också den näst minsta.
    const rutor = r.data.perKon;
    expect(rutor.every(x => x.varde == null || x.varde >= 5 || x.varde === 0)).toBe(true);
    if (rutor.some(x => x.dolt)) expect(rutor.filter(x => x.dolt).length).not.toBe(1);
    const liten = await k.post('/api/analys/grupp', { mall: 'diabetes-hba1c' });
    expect(liten.data).toMatchObject({ antal: null, antalDolt: true });
    const text = JSON.stringify([r.data, liten.data]);
    for (const namn of ['Gunnar', 'Birgitta', 'Margareta', '194502024732', 'p06']) expect(text).not.toContain(namn);
    expect(analys.skydda([{ varde: 3 }, { varde: 7 }, { varde: 12 }]).map(x => x.varde)).toEqual([null, null, 12]);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT patient_id, grund FROM atkomstlogg WHERE personal_id = 'uppf' AND resurs LIKE 'analys:%' ORDER BY id DESC LIMIT 1").get()).toEqual({ patient_id: null, grund: 'uppfoljning' });
  });

  test('ett sparat resultat läses bara av en roll som får se statistik, och svaret är detsamma oavsett om det finns', async () => {
    const u = klient(app);
    await u.logga('uppf');
    const res = await u.post('/api/analys/statistik', { matt: 'patienter', grupp: 'kon', spara: { namn: 'Delat', delad: true } });
    const id = res.data.sparat.id;
    await u.logga('eko');
    const finns = await u.get(`/api/analys/resultat/${id}`);
    const finnsInte = await u.get('/api/analys/resultat/999999');
    expect(finns.status).toBe(403);
    expect(JSON.stringify(finns.data)).toBe(JSON.stringify(finnsInte.data));
  });

  test('en roll utan behörighet att gruppera nekas och loggas', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    expect((await k.post('/api/analys/grupp', { mall: 'diabetes-hba1c' })).status).toBe(403);
    const e = klient(app);
    await e.logga('eko');
    expect((await e.post('/api/analys/statistik', { matt: 'vardkontakter' })).status).toBe(403);
  });
});

describe('Statistik och analys', () => {
  test('uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter', async () => {
    const k = klient(app);
    await k.logga('uppf');
    const o = await k.get('/api/analys');
    expect(o.data.niva).toBe('region');
    expect(o.data.matt.map(m => m.id)).toEqual(expect.arrayContaining(['vardkontakter', 'patienter', 'vardtid', 'diagnoser', 'ordinationer', 'remissledtid', 'labbsvarstid']));
    const r = await k.post('/api/analys/statistik', { matt: 'vardkontakter', grupp: 'vardform', period: { fran: '2025-11-08', till: '2026-11-08' } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ niva: 'region', rubrik: 'Antal vårdkontakter', gruppRubrik: 'Vårdform', diagram: 'stapel', vardenhet: 'Hela vårdgivaren' });
    expect(r.data.rader.length).toBeGreaterThan(0);
    const manad = await k.post('/api/analys/statistik', { matt: 'vardkontakter', grupp: 'manad' });
    expect(manad.data.diagram).toBe('linje');
    const vc = await k.post('/api/analys/statistik', { matt: 'patienter', grupp: 'kon', vardenhet: 'vc-tybble' });
    expect(vc.data.vardenhet).toBe('Vårdcentralen Tybble');
    // Med en patientgrupp som filter.
    const hyp = await k.post('/api/analys/statistik', { matt: 'vardkontakter', grupp: 'vardenhet', villkor: { diagnoser: { koder: ['I10'] } } });
    expect(hyp.data.patientgrupp).toContain('I10');
    const diag = await k.post('/api/analys/statistik', { matt: 'diagnoser', grupp: 'kategori' });
    expect(diag.data.rader[0].nyckel).toMatch(/^[A-Z]\d{2}$/);
    const text = JSON.stringify([r.data, manad.data, vc.data, hyp.data, diag.data]);
    for (const namn of ['Gunnar', 'Elin', '194502024732', '"p0']) expect(text).not.toContain(namn);
    expect(r.data.rader.every(x => x.varde == null || x.varde === 0 || x.varde >= 5)).toBe(true);
  });

  test('vårdenhetens statistik räknas bara på den egna vårdenhetens uppgifter, och en annan vårdenhet nekas', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    const r = await k.post('/api/analys/statistik', { matt: 'vardkontakter', grupp: 'vardenhet' });
    expect(r.data.niva).toBe('enhet');
    expect(r.data.rader.map(x => x.nyckel).filter(n => n !== 'Kardiologiska kliniken USÖ')).toEqual([]);
    expect((await k.post('/api/analys/statistik', { matt: 'vardkontakter', vardenhet: 'vc-tybble' })).status).toBe(403);
  });

  test('urval och resultat sparas, återanvänds och delas med vårdenheten, och prövas med den egna behörigheten', async () => {
    const a = klient(app);
    await a.logga('lak-vc');
    const sparat = await a.post('/api/analys/urval', { namn: 'Mina diabetespatienter', slag: 'grupp', villkor: analys.MALLGRUPPER[0].villkor, delad: true });
    expect(sparat.status).toBe(200);
    const igen = await a.post('/api/analys/grupp', { urvalId: sparat.data.id });
    expect(igen.data).toMatchObject({ namn: 'Mina diabetespatienter', urvalId: sparat.data.id });
    // Distriktssköterskan på samma vårdenhet ser det delade urvalet, och kardiologen gör det inte. Urvalen finns i
    // sandlådan, så de andra loggar in i samma session.
    const s = sandlada(app, a);
    await a.logga('ssk-vc');
    expect((await a.get('/api/analys')).data.urval.map(u => u.namn)).toContain('Mina diabetespatienter');
    await a.logga('lak-kard');
    expect((await a.get('/api/analys')).data.urval.map(u => u.namn)).not.toContain('Mina diabetespatienter');
    expect((await a.post('/api/analys/grupp', { urvalId: sparat.data.id })).status).toBe(404);
    // Ett sparat resultat innehåller bara antal.
    await a.logga('uppf');
    const res = await a.post('/api/analys/statistik', { matt: 'patienter', grupp: 'aldersgrupp', spara: { namn: 'Patienter per ålder', delad: true } });
    expect(res.data.sparat.id).toBeGreaterThan(0);
    const las = await a.get(`/api/analys/resultat/${res.data.sparat.id}`);
    expect(las.data.resultat.rubrik).toBe('Antal patienter med vårdkontakt');
    expect(s.db.query('SELECT resultat FROM analysresultat WHERE id = ?').get(res.data.sparat.id).resultat).not.toMatch(/"p\d\d"/);
    // Bara ägaren tar bort ett urval.
    expect((await a.post(`/api/analys/urval/${sparat.data.id}/ta-bort`)).status).toBe(404);
    await a.logga('lak-vc');
    expect((await a.post(`/api/analys/urval/${sparat.data.id}/ta-bort`)).data.borttagen).toBe(true);
  });
});
