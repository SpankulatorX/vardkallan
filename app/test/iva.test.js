// Anestesi och intensivvård (runda 9, r2, Sussa 4.6.1.1 till 4.6.1.7): översikt och övervakning, analys mot
// fördefinierade parametrar, anestesibedömning, kontinuerliga infusioner med titrering, timvis vätskebalans och
// uppföljning av kvalitet och produktion.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, personal, atk } from './hjalp.js';
import * as iva from '../src/iva.js';
import * as mt from '../src/medicinteknik.js';
import * as konfiguration from '../src/konfiguration.js';
import { MATTYPER } from '../src/journal.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const MIN = 60_000;
const TIMME = 3600_000;
const NU = new Date('2026-11-08T12:00:00.000Z');
const t = (min) => new Date(NU.getTime() - min * MIN).toISOString();
// Ett mätvärde för analysen, som en rad ur matvarden.
let nr = 0;
const rad = (typ, varde, min, kalla = 'vardkallan', vidimerad = null) => ({ id: ++nr, typ, varde: String(varde), varde_num: typeof varde === 'number' ? varde : null, tid: t(min), kalla, vidimerad, enhet_id: 'uso-kard-hia' });

describe('Intensivvård', () => {
  test('analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag', () => {
    // MAP under 65 i två värden i rad ger larm, och fallet från MAP 93 för en timme sedan ger en trendvarning.
    const r = iva.analysera({ rader: [rad('blodtryck', '80/50', 2), rad('blodtryck', '82/52', 12), rad('blodtryck', '125/77', 70), rad('saturation', 87, 2), rad('puls', 118, 2), rad('temp', 38.7, 30)], nu: NU });
    expect(r.map(x => [x.niva, x.regel])).toEqual([['larm', 'map_lag'], ['larm', 'saturation_lag'], ['varning', 'map_trend'], ['varning', 'puls'], ['varning', 'feber']]);
    expect(r[0].text).toBe('MAP 60 mmHg kl. 12.58 och 62 mmHg kl. 12.48, under 65 mmHg.');
    expect(r[0].gora).toContain('kontakta ansvarig läkare');
    expect(r[2].text).toContain('MAP har sjunkit från 93 till 60 mmHg (35 procent)');
    // Bara ett lågt värde ger en varning, och gränsen följer parametrarna.
    expect(iva.analysera({ rader: [rad('blodtryck', '80/50', 2), rad('blodtryck', '120/80', 12)], nu: NU }).map(x => [x.niva, x.regel])).toEqual([['varning', 'map_lag']]);
    expect(iva.analysera({ rader: [rad('blodtryck', '80/50', 2)], params: { ...iva.STANDARD, mapLag: 55 }, nu: NU })).toEqual([]);
    // Värden från monitorn som inte är godkända räknas inte, men systemet säger att de bör granskas.
    const ej = iva.analysera({ rader: [rad('blodtryck', '80/50', 2, 'utrustning'), rad('blodtryck', '80/50', 7, 'utrustning')], nu: NU });
    expect(ej.map(x => [x.niva, x.regel])).toEqual([['observation', 'ej_godkant']]);
    expect(ej[0].text).toContain('Värdet är inte godkänt, så systemet räknar inte med det');
    // Godkända värden från monitorn räknas som andra värden.
    expect(iva.analysera({ rader: [rad('blodtryck', '80/50', 2, 'utrustning', t(1)), rad('blodtryck', '80/50', 7, 'utrustning', t(1))], nu: NU })[0].regel).toBe('map_lag');
    expect(iva.IVA_REGLER.length).toBe(10);
  });

  test('parametrarna för analysen finns i konfigurationen med samma standardvärden som modulen', () => {
    const p = konfiguration.parametrar();
    expect(p['iva.map_lag'].standard).toBe(iva.STANDARD.mapLag);
    expect(p['iva.saturation_lag'].standard).toBe(iva.STANDARD.saturationLag);
    expect(p['iva.trend_minuter'].standard).toBe(iva.STANDARD.trendMinuter);
    expect(p['iva.oliguri_timmar'].standard).toBe(iva.STANDARD.oliguriTimmar);
    expect(konfiguration.OMRADEN[p['iva.map_lag'].omrade].sussa).toBe('4.6.1.3');
    expect(konfiguration.prova('iva.map_lag', 40)).toMatchObject({ ok: false });
    expect(iva.parametrar(nyDb(), NU)).toEqual(iva.STANDARD);
  });

  test('översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans', async () => {
    const k = await inloggad('lak-kard');
    const d = (await k.get('/api/iva')).data;
    expect(d.enhet).toMatchObject({ id: 'uso-kard-hia', namn: 'Hjärtintensivvårdsavdelningen (HIA)', platser: 8, belagda: 1 });
    const p = d.patienter.find(x => x.patientId === 'p22');
    expect(p).toMatchObject({ plats: 'Hjärtintensiven, sal 3', utrustning: [], infusioner: [], vatska: { balans: 0 } });
    expect(p.varden.puls).toMatchObject({ varde: 132, godkand: true });
    // Pulsen 132 är från i förrgår och ligger utanför analysens fönster på sex timmar.
    expect(p.analys).toEqual([]);
    expect(d.demoregel).toContain('demoregler');
    // Varje patient i översikten loggas en gång per session.
    await k.get('/api/iva');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p22' AND resurs = 'iva:oversikt:uso-kard-hia'").get().n).toBe(1);
    // Sessionen säger att vårdenheten har en intensivvårdsavdelning, och på vårdcentralen finns ingen.
    expect((await k.get('/api/session')).data.iva.enheter.map(e => e.id)).toEqual(['uso-kard-hia']);
    const vc = await inloggad('lak-vc');
    expect((await vc.get('/api/iva')).data).toMatchObject({ enheter: [], patienter: [], text: 'Din vårdenhet har ingen intensivvårdsavdelning i demon.' });
    expect((await vc.get('/api/session')).data.iva).toBeNull();
    expect((await (await inloggad('logg')).get('/api/iva')).status).toBe(403);
  });

  test('övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta', async () => {
    const k = await inloggad('ssk-kard');
    const kp = (await k.post('/api/patient/p22/mt/koppla', { streckkod: 'MT-MON-0005' })).data.koppling;
    const start = Date.parse(kp.start);
    mt.efterTid(db(k), MATTYPER, new Date(start + 60 * MIN));
    // Värdena ligger i framtiden i förhållande till klockan, så vyn läses med samma tid som simuleringen.
    const a = atk(db(k), 'ssk-kard', 'p22', {}, 'las_matvarden');
    const p = db(k).query("SELECT * FROM patienter WHERE id = 'p22'").get();
    const v = iva.overvakning(a, p, { timmar: 2 }, new Date(start + 60 * MIN));
    const puls = v.kurvor.find(x => x.typ === 'puls');
    expect(puls.punkter.length).toBeGreaterThanOrEqual(12);
    expect(puls.punkter.filter(x => x.kalla === 'utrustning').length).toBeGreaterThanOrEqual(12);
    expect(puls.punkter.every(x => x.kalla !== 'utrustning' || x.godkand === false)).toBe(true);
    expect(v.map.length).toBeGreaterThanOrEqual(12);
    expect(v.utrustning.aktiva.map(x => x.utrustning.id)).toEqual(['mt-mon-hia-3']);
    expect(v.utrustning.vantar.utrustning).toBeGreaterThanOrEqual(60);
    expect(v.regler.length).toBe(iva.IVA_REGLER.length);
    // Över HTTP: samma vy med de värden som har kommit hittills.
    const h = (await k.get('/api/patient/p22/iva?timmar=6')).data;
    expect(h.timmar).toBe(6);
    expect(h.utrustning.aktiva.length).toBe(1);
  });

  test('anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta', async () => {
    const k = await inloggad('lak-kard');
    const planerad = new Date(Date.now() + 26 * TIMME).toISOString();
    const d = (await k.get(`/api/patient/p01/anestesi?planerad=${encodeURIComponent(planerad)}`)).data;
    const f = d.forslag;
    expect(f.lakemedel.find(l => l.text.startsWith('Waran'))).toMatchObject({ observation: 'Antikoagulantia: planera uppehåll inför ingreppet.' });
    expect(f.asa.asa).toBeGreaterThanOrEqual(2);
    expect(f.asa.text).toContain('Läkaren bestämmer klassen');
    expect(f.asa.grund).toContain('I50');
    expect(f.vikt.kg).toBe(81.6);
    expect(Date.parse(planerad) - Date.parse(f.fasta.fastFodaTill)).toBe(6 * TIMME);
    expect(Date.parse(planerad) - Date.parse(f.fasta.klaraDryckerTill)).toBe(2 * TIMME);
    expect(f.tidigare).toEqual([]);
    const fel = await k.post('/api/patient/p01/anestesi', { asa: 7 });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toBe('Kontrollera ingreppet, ASA-klass 1 till 5, anestesiformen.');
    const r = await k.post('/api/patient/p01/anestesi', { ingrepp: 'Elkonvertering', planerad, asa: 3, anestesiform: 'generell', luftvag: { mallampati: 2, tidigareSvarIntubation: true } });
    expect(r.status).toBe(201);
    expect(r.data.bedomning).toMatchObject({ asaText: 'ASA 3', anestesiformText: 'Generell anestesi', av: 'Sara Lindqvist', luftvag: { mallampati: 2, tidigareSvarIntubation: true } });
    expect(r.data.bedomning.underlag.lakemedel.length).toBe(f.lakemedel.length);
    const igen = (await k.get('/api/patient/p01/anestesi')).data;
    expect(igen.bedomningar.length).toBe(1);
    expect(igen.forslag.tidigare.map(x => x.ingrepp)).toEqual(['Elkonvertering']);
    expect(igen.forslag.luftvag.risker.some(x => x.startsWith('Svår intubation'))).toBe(true);
    // Sjuksköterskan läser bedömningen men gör den inte, och en bedömning ändras inte.
    const s = await inloggad('ssk-kard');
    expect((await s.post('/api/patient/p01/anestesi', { ingrepp: 'X', asa: 1, anestesiform: 'generell' })).status).toBe(403);
    expect(() => db(k).query('UPDATE anestesibedomningar SET asa = 1').run()).toThrow();
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'anestesibedomning' AND resurs LIKE 'anestesi:%'").get().n).toBe(1);
  });

  test('anestesibedömningen räknar bara det som läkaren får se, så en spärrad vårdenhets diagnoser röjs inte', async () => {
    const k = await inloggad('lak-kard');
    const d = (await k.get('/api/patient/p04/anestesi')).data.forslag;
    expect(JSON.stringify(d)).not.toContain('F33');
    expect(d.diagnoser.every(x => !x.kod.startsWith('F'))).toBe(true);
  });

  test('en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden', async () => {
    const k = await inloggad('lak-kard');
    const f = (await k.get('/api/patient/p01/iva/infusion/forslag')).data;
    expect(f.protokoll[0]).toMatchObject({ id: 'morfin', dosEnhet: 'mg/kg/h', startMlH: 1.6, lakemedel: 'Morfin Abcur 10 mg/ml' });
    expect(f.text).toContain('81,6 kg');
    expect((await k.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin' })).status).toBe(400);
    const r = await k.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Postoperativ smärta' });
    expect(r.status).toBe(201);
    expect(r.data.ordination.dosering).toContain('0,01 till 0,04 mg/kg/h (0,8 till 3,3 ml/h vid 81,6 kg)');
    expect(r.data.infusion).toMatchObject({ dos: 0.02, mlH: 1.6, perTimme: 1.632, perTimmeEnhet: 'mg/h', intervall: { min: 0.01, max: 0.04 } });
    expect(r.data.text).toContain('Starta pumpen på 1,6 ml/h');
    const oid = r.data.ordination.id;
    // Sjuksköterskan registrerar smärta NRS 6, och systemet föreslår att dosen ökas med ett steg.
    await k.post('/api/logout');
    await k.logga('ssk-kard');
    expect((await k.post('/api/patient/p01/matvarden', { typ: 'smarta', varde: 6 })).status).toBe(201);
    const inf = (await k.get('/api/patient/p01/iva')).data.infusioner.find(i => i.ordinationId === oid);
    expect(inf.titrering).toMatchObject({ parameter: 'smarta', varde: 6, forslag: 0.025, mlH: 2 });
    expect(inf.titrering.text).toContain('över målet 0 till 3');
    const dos = await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, {});
    expect(dos.status).toBe(200);
    expect(dos.data).toMatchObject({ dos: 0.025, mlH: 2, text: 'Dosen är 0,025 mg/kg/h. Ställ pumpen på 2 ml/h.' });
    expect((await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 0.08 })).data.fel).toContain('utanför det ordinerade intervallet 0,01 till 0,04 mg/kg/h');
    // Låg andningsfrekvens går före smärtan: systemet föreslår lägsta dos och larmar.
    await k.post('/api/patient/p01/matvarden', { typ: 'andningsfrekvens', varde: 8 });
    const efter = (await k.get('/api/patient/p01/iva')).data;
    const t2 = efter.infusioner.find(i => i.ordinationId === oid).titrering;
    expect(t2).toMatchObject({ parameter: 'andningsfrekvens', forslag: 0.01, niva: 'larm' });
    expect(efter.analys.find(a => a.regel === 'titrering')).toMatchObject({ niva: 'larm' });
    // Undersköterskan utan delegering ändrar inte dosen.
    await k.post('/api/logout');
    await k.logga('usk-kard');
    expect((await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 0.02 })).status).toBe(403);
    expect(db(k).query('SELECT count(*) AS n FROM iva_titreringar WHERE ordination_id = ?').get(oid).n).toBe(1);
  });

  test('en infusion ordineras inte utan godkänd vikt, och en vikt som patienten själv har mätt räknas inte', async () => {
    const d = nyDb();
    const l = personal(d, 'lak-kard');
    d.query("DELETE FROM matvarden WHERE patient_id = 'p01' AND typ = 'vikt'").run();
    d.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES ('p01', 'uso-kard-72', 'vikt', '80', 80, 'kg', ?, 'patient')").run(new Date().toISOString());
    const a = atk(d, l.id, 'p01', {}, 'ordinera');
    expect(() => iva.ordineraInfusion(a, d.query("SELECT * FROM patienter WHERE id = 'p01'").get(), { protokoll: 'morfin', ordinationsorsak: 'Smärta' })).toThrow('Patientens vikt saknas');
  });

  test('infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen', async () => {
    const k = await inloggad('lak-kard');
    const oid = (await k.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Smärta' })).data.ordination.id;
    await k.post('/api/logout');
    await k.logga('ssk-kard');
    db(k).query("UPDATE mt_utrustning SET simulerad = 0 WHERE id = 'mt-pump-hia-1'").run();
    expect((await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-PMP-0001', ordinationId: oid })).status).toBe(201);
    const nyckel = (await k.post('/api/mt/utrustning/mt-pump-hia-1/nyckel')).data.nyckel;
    const nu = new Date().toISOString();
    await fetch(`${app.url}/mt/fhir`, { method: 'POST', headers: { Authorization: `Bearer ${nyckel}`, 'Content-Type': 'application/fhir+json' }, body: JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [
      { resource: { resourceType: 'Device', identifier: [{ value: 'mt-pump-hia-1' }] } },
      { resource: { resourceType: 'MedicationAdministration', status: 'completed', category: { text: 'bolus' }, request: { reference: `MedicationRequest/${oid}` }, effectivePeriod: { start: nu, end: nu }, dosage: { dose: { value: 2, unit: 'mL', system: 'http://unitsofmeasure.org', code: 'mL' } } } }] }) });
    await k.post('/api/patient/p01/vatskebalans', { riktning: 'ut', typ: 'urin', volymMl: 120 });
    const v = (await k.get('/api/patient/p01/iva')).data;
    expect(v.infusioner[0].bolusar[0]).toMatchObject({ volymMl: 2, dos: 2, enhet: 'mg' });
    expect(v.infusioner[0].pump.koppling.utrustning.id).toBe('mt-pump-hia-1');
    expect(v.handelser.map(h => h.typ)).toEqual(expect.arrayContaining(['bolus', 'forlust']));
    expect(v.handelser.find(h => h.typ === 'bolus').text).toBe('Bolus Morfin Abcur 10 mg/ml, 2 mg (2 ml)');
    expect(v.vatska.summaIn).toBeGreaterThanOrEqual(2);
    expect(v.vatska.summaUt).toBeGreaterThanOrEqual(120);
    expect(v.vatska.timmar.length).toBe(24);
  });

  test('vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri', () => {
    const d = nyDb();
    const ins = d.query("INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av) VALUES ('p01', 'uso-kard-72', ?, ?, ?, ?, ?, 'ssk-kard')");
    d.query("DELETE FROM vatskebalans WHERE patient_id = 'p01'").run();
    // Vikten 81,6 kg: 30 ml urin per timme är 0,37 ml/kg/h.
    const v0 = d.query("SELECT tid FROM matvarden WHERE patient_id = 'p01' AND typ = 'vikt' ORDER BY tid DESC").get();
    const nu = new Date(Date.parse(v0.tid) + 4 * TIMME + 30 * MIN);
    const h = (n, m = 10) => new Date(Math.ceil(nu.getTime() / TIMME) * TIMME - n * TIMME + m * MIN).toISOString();
    ins.run('in', 'infusion', 500, h(4), h(4));
    ins.run('ut', 'urin', 100, h(4, 20), h(4, 20));
    ins.run('ut', 'urin', 30, h(3), h(3));
    ins.run('ut', 'dran', 50, h(3), h(3));
    ins.run('ut', 'urin', 30, h(2), h(2));
    const a = atk(d, 'ssk-kard', 'p01', {}, 'las_matvarden');
    const r = iva.vatskaTimvis(a, { timmar: 6 }, nu);
    expect(r.timmar.length).toBe(6);
    const tim = r.timmar.slice(-4, -1);
    expect(tim.map(x => [x.in, x.ut, x.urin, x.dran])).toEqual([[500, 100, 100, 0], [0, 80, 30, 50], [0, 30, 30, 0]]);
    expect(tim.map(x => x.kumulativ)).toEqual([400, 320, 290]);
    expect(tim.map(x => x.urinMlKgH)).toEqual([1.23, 0.37, 0.37]);
    expect(r).toMatchObject({ summaIn: 500, summaUt: 210, balans: 290, vikt: { kg: 81.6 } });
    expect(r.oliguri.text).toBe('Urinen har varit under 0,5 ml/kg/h i 2 timmar (0,37, 0,37 ml/kg/h vid vikten 81,6 kg).');
    expect(iva.analysera({ rader: [], vatska: r, nu }).map(x => x.regel)).toEqual(['oliguri']);
  });

  test('uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter', async () => {
    const k = await inloggad('lak-kard');
    const u = (await k.get('/api/iva/uppfoljning?dagar=30')).data;
    expect(u.dagar).toBe(30);
    const e = u.enheter[0];
    expect(e.enhet).toMatchObject({ id: 'uso-kard-hia', platser: 8 });
    expect(e.vardygn).toBeGreaterThanOrEqual(1.9);
    expect(e.vardtillfallen).toBeGreaterThanOrEqual(1);
    expect(e.belaggningProcent).toBe(Math.round(e.vardygn / (8 * 30) * 1000) / 10);
    expect(e.vardtyngd).toMatchObject({ overvakningProcent: 0, infusionProcent: 0 });
    expect(e.kvalitet.map(x => x.id)).toEqual(['godkanda_inom_timme', 'vatskebalans', 'aterinskrivning_48h']);
    // Runda 10, r6: periodens tider räknas inte, så att testet inte beror på klockslaget (19 i 2026-11-08T19:00).
    const text = JSON.stringify({ ...u, fran: null, till: null });
    for (const x of ['p22', 'Hjärtintensiven, sal 3', '19']) expect(text).not.toContain(x);
    // Uppföljningsrollen ser alla intensivvårdsavdelningar, vårdcentralens läkare ingen, och logggranskaren inget alls.
    expect((await (await inloggad('uppf')).get('/api/iva/uppfoljning')).data.enheter.map(x => x.enhet.id)).toEqual(['uso-kard-hia']);
    expect((await (await inloggad('lak-vc')).get('/api/iva/uppfoljning')).data.enheter).toEqual([]);
    expect((await (await inloggad('logg')).get('/api/iva/uppfoljning')).status).toBe(403);
    // Med en kopplad monitor och godkända värden räknas övervakningen och indikatorn för godkännandet.
    const d = nyDb();
    const s = personal(d, 'ssk-kard');
    const a = atk(d, s.id, 'p22', {}, 'koppla_utrustning');
    const nu = new Date();
    mt.koppla(a, d.query("SELECT * FROM patienter WHERE id = 'p22'").get(), { streckkod: 'MT-MON-0005' }, new Date(nu.getTime() - 3 * TIMME));
    mt.efterTid(d, MATTYPER, nu);
    const synliga = d.query("SELECT * FROM matvarden WHERE patient_id = 'p22' AND kalla = 'utrustning'").all();
    mt.godkann(atk(d, s.id, 'p22', {}, 'godkanna_matvarde'), synliga, {}, nu);
    const u2 = iva.uppfoljning(d, personal(d, 'lak-kard'), { dagar: 30 }, nu);
    expect(u2.enheter[0].vardtyngd.overvakningProcent).toBeGreaterThan(0);
    expect(u2.enheter[0].kvalitet[0].antal).toBeGreaterThan(0);
  });
});
