// Runda 11, r7: intensivvården i version 1.1 (Sussa 4.6.1.2, 4.6.1.3, 4.6.1.5, 4.6.1.6 och 4.6.1.7): realtid med
// vågformer, patientens egna regler, behandlingsbegränsningar, överrapportering, perspiratio, prognos och mål,
// andningsstöd, NEMS och sammanräkning av doser. Testerna skickar in en fast tid eller räknar relativt till anropet, så
// att de inte beror på klockslaget.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, atk, somPerson } from './hjalp.js';
import * as iva from '../src/iva.js';
import * as regler from '../src/iva-patientregler.js';
import * as vagform from '../src/iva-vagform.js';
import * as vatska from '../src/iva-vatskemal.js';
import * as nems from '../src/iva-nems.js';
import '../src/r11r7-rutter.js';
import { forRoll } from '../src/nyheter.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const MIN = 60_000;
const TIMME = 3600_000;
const NU = new Date('2026-11-08T12:00:00.000Z');
const t = (min) => new Date(NU.getTime() - min * MIN).toISOString();
let nr = 0;
const rad = (typ, varde, min, kalla = 'vardkallan') => ({ id: ++nr, typ, varde: String(varde), varde_num: typeof varde === 'number' ? varde : null, tid: t(min), kalla, vidimerad: null, enhet_id: 'uso-kard-hia' });
const regel = (x) => ({ id: ++nr, aktiv: true, antal: 1, niva: 'larm', gora: null, motivering: 'KOL med kronisk hypoxi', av: 'Sara Lindqvist', skapad: t(600), ...x,
  ersatter: regler.standardGrans(x.parameter, x.villkor) != null, text: `${x.parameter} ${x.villkor} ${x.grans}.` });

describe('Intensivvård, version 1.1', () => {
  test('realtidsvisningen har vågformer som följer pulsen, blodtrycket och andningen, och samma tid ger samma kurva', () => {
    const v = vagform.vagformer({ puls: 60, sys: 120, dia: 80, af: 12 }, NU.getTime(), 7);
    const ekg = v.kurvor.find(k => k.id === 'ekg').varden;
    expect(ekg.length).toBe(vagform.SEKUNDER * vagform.HZ.ekg);
    // R-taggarna: lokala toppar över 0,7 mV. Puls 60 på åtta sekunder ger omkring åtta slag.
    const toppar = ekg.filter((x, i) => x > 0.7 && x >= (ekg[i - 1] ?? 0) && x > (ekg[i + 1] ?? 0)).length;
    expect(toppar).toBeGreaterThanOrEqual(7);
    expect(toppar).toBeLessThanOrEqual(9);
    const art = v.kurvor.find(k => k.id === 'art').varden;
    expect(Math.min(...art)).toBeGreaterThanOrEqual(79);
    expect(Math.max(...art)).toBeLessThanOrEqual(121);
    expect(Math.max(...art)).toBeGreaterThan(110);
    // Snabbare puls ger fler slag, och samma indata ger samma kurva.
    const snabb = vagform.vagformer({ puls: 120, sys: 120, dia: 80, af: 12 }, NU.getTime(), 7).kurvor[0].varden;
    expect(snabb.filter((x, i) => x > 0.7 && x >= (snabb[i - 1] ?? 0) && x > (snabb[i + 1] ?? 0)).length).toBeGreaterThanOrEqual(14);
    expect(vagform.vagformer({ puls: 60, sys: 120, dia: 80, af: 12 }, NU.getTime(), 7)).toEqual(v);
  });

  test('realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session', async () => {
    const k = await inloggad('ssk-kard');
    const fore = (await k.get('/api/patient/p22/iva/realtid')).data;
    expect(fore.kopplad).toBe(false);
    expect(fore.text).toContain('Koppla monitorn');
    expect((await k.post('/api/patient/p22/mt/koppla', { streckkod: 'MT-MON-0005' })).status).toBe(201);
    const r = (await k.get('/api/patient/p22/iva/realtid')).data;
    expect(r.kopplad).toBe(true);
    expect(r.monitor.serienummer).toBe('DEMO-MON-0005');
    expect(r.kurvor.map(x => x.id)).toEqual(['ekg', 'art', 'pleth', 'andning']);
    expect(r.kurvor[0].varden.length).toBe(800);
    expect(typeof r.varden.puls).toBe('number');
    expect(r.granser.saturation.under).toMatchObject({ grans: 90, kalla: 'avdelning' });
    expect(r.demo).toContain('simulerade monitorn');
    await k.get('/api/patient/p22/iva/realtid');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p22' AND resurs = 'iva:realtid:p22'").get().n).toBe(1);
    // Personal på en annan vårdenhet utan vårdrelation får inte se realtiden.
    expect((await (await inloggad('ssk-vc')).get('/api/patient/p22/iva/realtid')).status).toBe(403);
    // Monitorns larm: ett värde under patientens egen gräns larmar, och ett värde under avdelningens men inte under
    // en mildare egen gräns ger en observation, aldrig tystnad.
    const g = regler.gransFor([regel({ parameter: 'saturation', villkor: 'under', grans: 85 })]);
    expect(vagform.monitorlarm({ saturation: 84 }, g)).toEqual([expect.objectContaining({ niva: 'larm', kalla: 'patient' })]);
    const obs = vagform.monitorlarm({ saturation: 87 }, g);
    expect(obs).toEqual([expect.objectContaining({ niva: 'observation', kalla: 'avdelning' })]);
    expect(obs[0].text).toContain('avdelningens gräns 90 %');
    expect(vagform.monitorlarm({ saturation: 92 }, g)).toEqual([]);
  });

  test('patientens egen gräns prövas i analysen, och en mildare gräns gör avdelningens larm till en observation i stället för att tysta det', () => {
    const rader = [rad('saturation', 87, 2)];
    // Utan egen regel larmar avdelningens gräns 90 %.
    const std = iva.analysera({ rader, nu: NU });
    expect(std.map(x => [x.niva, x.regel])).toEqual([['larm', 'saturation_lag']]);
    // Med patientens gräns 85 % blir larmet en observation som säger varför.
    const r85 = [regel({ parameter: 'saturation', villkor: 'under', grans: 85 })];
    const med = regler.tillampa(r85, std, { rader, nu: NU });
    expect(med.map(x => [x.niva, x.regel])).toEqual([['observation', 'saturation_lag']]);
    expect(med[0].text).toContain('Avdelningens gräns skulle ha gett larm');
    expect(med[0].text).toContain('KOL med kronisk hypoxi');
    // Under patientens gräns larmar patientregeln, och avdelningens larm finns kvar.
    const lag = [rad('saturation', 83, 2)];
    const r = regler.tillampa(r85, iva.analysera({ rader: lag, nu: NU }), { rader: lag, nu: NU });
    expect(r.map(x => [x.niva, x.regel])).toEqual([['larm', 'saturation_lag'], ['larm', 'patient']]);
    expect(r[1].text).toContain('under patientens gräns 85 %');
    // En strängare regel och en regel som läggs till: MAP under 70 och puls över 100 i två värden i rad.
    const rader2 = [rad('blodtryck', '95/58', 2), rad('puls', 104, 2), rad('puls', 102, 12)];
    const r2 = regler.tillampa([regel({ parameter: 'map', villkor: 'under', grans: 75, niva: 'varning' }), regel({ parameter: 'puls', villkor: 'over', grans: 100, antal: 2 })],
      iva.analysera({ rader: rader2, nu: NU }), { rader: rader2, nu: NU });
    expect(r2.map(x => [x.niva, x.regel])).toEqual([['larm', 'patient'], ['varning', 'patient']]);
    expect(r2[0].text).toContain('104 slag/min');
    // Ett värde som inte är godkänt räknas inte i patientens regel heller.
    expect(regler.tillampa(r85, [], { rader: [rad('saturation', 80, 2, 'utrustning')], nu: NU })).toEqual([]);
  });

  test('läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/patient/p22/iva/regler', { parameter: 'saturation', villkor: 'under', grans: '85', motivering: 'KOL med kronisk hypoxi, mål 88 till 92 %' });
    expect(r.status).toBe(201);
    expect(r.data.text).toContain('ersätter avdelningens gräns 90 %');
    expect(r.data.text).toContain('larmar senare för patienten');
    expect(r.data.regel).toMatchObject({ ersatter: true, av: 'Sara Lindqvist', aktiv: true });
    for (const fel of [{ grans: 60 }, { grans: [85] }, { grans: '85; drop' }, { parameter: 'constructor' }, { villkor: 'mellan' }, { motivering: '' }, { antal: 5 }, { niva: 'tyst' }]) {
      const x = await k.post('/api/patient/p22/iva/regler', { parameter: 'saturation', villkor: 'under', grans: 86, motivering: 'Motivering', ...fel });
      expect(x.status).toBe(400);
      expect(x.data.fel).toStartWith('Kontrollera');
    }
    const ny = await k.post('/api/patient/p22/iva/regler', { parameter: 'saturation', villkor: 'under', grans: 88, motivering: 'Nytt mål efter blodgas' });
    expect(ny.status).toBe(201);
    expect(ny.data.regler.filter(x => x.parameter === 'saturation').map(x => x.grans)).toEqual([88]);
    expect(db(k).query("SELECT count(*) AS n FROM iva_patientregler WHERE patient_id = 'p22' AND avslutad IS NOT NULL").get().n).toBe(1);
    expect(() => db(k).query('UPDATE iva_patientregler SET grans = 50').run()).toThrow();
    expect(() => db(k).query('DELETE FROM iva_patientregler').run()).toThrow();
    // Översikten använder regeln, och avslutet ger tillbaka avdelningens gräns.
    const p = (await k.get('/api/iva')).data.patienter.find(x => x.patientId === 'p22');
    expect(p.egnaRegler).toBe(1);
    const a = await k.post(`/api/patient/p22/iva/regler/${ny.data.regel.id}/avsluta`, {});
    expect(a.data.text).toContain('Avdelningens gräns gäller igen');
    // Sjuksköterskan sätter inte egna gränser, och det nekade försöket loggas.
    const s = await inloggad('ssk-kard');
    expect((await s.post('/api/patient/p22/iva/regler', { parameter: 'puls', villkor: 'over', grans: 150, motivering: 'X' })).status).toBe(403);
    expect(db(s).query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'ssk-kard' AND resultat = 'nekad' AND patient_id = 'p22'").get().n).toBeGreaterThanOrEqual(1);
  });

  test('en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    // p04 har en spärrad vårdenhet (psykiatrin) för läkaren på kardiologen.
    const sparrad = d.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get()?.enhet_id;
    expect(sparrad).toBeTruthy();
    const fore = JSON.stringify((await k.get('/api/patient/p04/iva/tillagg')).data).replace(/"tid":"[^"]*"/g, '');
    d.query("INSERT INTO iva_patientregler (patient_id, enhet_id, parameter, villkor, grans, antal, niva, motivering, ersatter, skapad, av) VALUES ('p04', ?, 'puls', 'over', 60, 1, 'larm', 'HEMLIG-MOTIVERING', 1, ?, 'lak-psyk')").run(sparrad, new Date().toISOString());
    d.query("INSERT INTO iva_andningsstod (patient_id, enhet_id, typ, befuktning, start, av) VALUES ('p04', ?, 'invasiv', 'ingen', ?, 'lak-psyk')").run(sparrad, new Date(Date.now() - TIMME).toISOString());
    d.query("INSERT INTO iva_behandlingsmal (patient_id, enhet_id, typ, varde, skapad, av) VALUES ('p04', ?, 'vatskebalans', -2000, ?, 'lak-psyk')").run(sparrad, new Date().toISOString());
    d.query("INSERT INTO iva_nems (patient_id, enhet_id, dygn, poang, poster, forslag, tid, av) VALUES ('p04', ?, ?, 30, '[]', '[]', ?, 'lak-psyk')").run(sparrad, nems.dygnFor(new Date()), new Date().toISOString());
    const efter = (await k.get('/api/patient/p04/iva/tillagg')).data;
    expect(JSON.stringify(efter)).not.toContain('HEMLIG-MOTIVERING');
    expect(JSON.stringify(efter).replace(/"tid":"[^"]*"/g, '')).toBe(fore);
  });

  test('behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p22/uppmarksamhet', { term: 'avsta-hlr' })).status).toBe(201);
    const p = (await k.get('/api/iva')).data.patienter.find(x => x.patientId === 'p22');
    expect(p.behandlingsbegransningar).toEqual(['Läkarbeslut finns om att inte utföra hjärt-lungräddning']);
    const d = (await k.get('/api/patient/p22/iva/tillagg')).data;
    expect(d.begransningar.map(x => x.term)).toEqual(['Läkarbeslut finns om att inte utföra hjärt-lungräddning']);
    const o = d.overrapportering;
    expect(o.situation[0]).toContain('Hjärtintensiven, sal 3');
    expect(o.situation.join(' ')).toContain('inte utföra hjärt-lungräddning');
    expect(o.text).toMatch(/^Situation\n/);
    expect(o.text).toContain('\n\nBakgrund\n');
    expect(o.text).toContain('\n\nRekommendation\n');
    // Överrapporteringen bygger bara på det läkaren får se: en spärrad vårdenhets diagnos finns inte med.
    const p04 = (await k.get('/api/patient/p04/iva/tillagg')).data.overrapportering;
    expect(JSON.stringify(p04)).not.toContain('F33');
  });

  test('perspiratio räknas ur vikten, febern och andningsstödet, och dygnsbrytningen kl. 06 följer svensk tid också vid omställningen', () => {
    const p = vatska.perspiratio({ vikt: 80 });
    expect(p.perTimme).toBe(40);
    expect(vatska.perspiratio({ vikt: 80, temp: 39 }).perTimme).toBe(48);
    expect(vatska.perspiratio({ vikt: 80, stod: { befuktning: 'aktiv' } }).perTimme).toBe(26.4);
    expect(vatska.perspiratio({ vikt: 80, stod: { befuktning: 'ingen' } }).perTimme).toBe(46.8);
    expect(vatska.perspiratio({ vikt: 80, temp: 39 }).text).toContain('20 procent mer för febern');
    expect(vatska.perspiratio({ vikt: null })).toBeNull();
    // Kl. 12.00 UTC i november är 13.00 svensk tid: senaste brytningen 05.00 UTC och nästa 05.00 UTC dagen efter.
    expect(vatska.dygnsbrytning(NU)).toEqual({ senaste: '2026-11-08T05:00:00.000Z', nasta: '2026-11-09T05:00:00.000Z' });
    // 00.30 svensk tid (23.30 UTC) ligger före brytningen samma natt.
    expect(vatska.dygnsbrytning(new Date('2026-11-12T23:30:00Z'))).toEqual({ senaste: '2026-11-12T05:00:00.000Z', nasta: '2026-11-13T05:00:00.000Z' });
    // Omställningen till vintertid 2026-10-25: brytningen före är 04.00 UTC (sommartid) och den efter 05.00 UTC.
    expect(vatska.dygnsbrytning(new Date('2026-10-25T12:00:00Z'))).toEqual({ senaste: '2026-10-25T05:00:00.000Z', nasta: '2026-10-26T05:00:00.000Z' });
    expect(vatska.dygnsbrytning(new Date('2026-10-25T02:30:00Z'))).toEqual({ senaste: '2026-10-24T04:00:00.000Z', nasta: '2026-10-25T05:00:00.000Z' });
  });

  test('läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'vatskebalans', varde: '-500' })).status).toBe(201);
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'energi', varde: 25 })).status).toBe(201);
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'vikt', varde: 70 })).status).toBe(201);
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'vikt', varde: [70] })).status).toBe(400);
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'energi', varde: 500 })).status).toBe(400);
    expect((await k.post('/api/patient/p22/iva/mal', { typ: 'toString', varde: 1 })).status).toBe(400);
    // Samma sandlåda med sjuksköterskan.
    const s = k;
    somPerson(sandlada(app, k), 'ssk-kard');
    db(s).query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES ('p22', 'uso-kard-hia', 'vikt', '72', 72, 'kg', ?, 'ssk-kard')").run(new Date(Date.now() - 3 * TIMME).toISOString());
    expect((await s.post('/api/patient/p22/iva/mal', { typ: 'vikt', varde: 70 })).status).toBe(403);
    // Sjuksköterskan registrerar andningsstödet, och perspiratio räknas med befuktningen.
    expect((await s.post('/api/patient/p22/iva/andningsstod', { typ: 'invasiv', befuktning: 'aktiv' })).status).toBe(201);
    expect((await s.post('/api/patient/p22/iva/andningsstod', { typ: 'respirator' })).status).toBe(400);
    const d = (await s.get('/api/patient/p22/iva/tillagg')).data;
    expect(d.vatska.mal.vatskebalans.varde).toBe(-500);
    expect(d.vatska.aktivtStod.typ).toBe('invasiv');
    expect(d.vatska.perspiratio.text).toContain('aktiv befuktning');
    const typer = d.vatska.rekommendationer.map(x => x.typ);
    expect(typer).toEqual(expect.arrayContaining(['vatskebalans', 'energi', 'vikt']));
    expect(d.vatska.rekommendationer.find(x => x.typ === 'vatskebalans').text).toContain('målet -500 ml');
    expect(d.vatska.prognos.text).toContain('Beräknat till kl. 06');
    expect(d.vatska.timmar.length).toBe(24);
    // Elektrolyterna: ett godkänt kalium under målet ger en rekommendation.
    const a = atk(db(s), 'ssk-kard', 'p22', {}, 'las_matvarden');
    const nu = new Date();
    db(s).query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES ('p22', 'uso-kard-hia', 'kalium', '3,1', 3.1, 'mmol/L', ?, 'ssk-kard')").run(new Date(nu.getTime() - 30 * MIN).toISOString());
    const u = vatska.utokad(a, { nu });
    expect(u.rekommendationer.find(x => x.typ === 'kalium').text).toContain('Kalium 3,1 mmol/L');
    expect((await s.post('/api/patient/p22/iva/andningsstod/avsluta', {})).data.text).toContain('är avslutad');
  });

  test('NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen', async () => {
    expect(nems.POSTER.reduce((s, p) => s + p.poang, 0)).toBe(66);
    expect(nems.poang(['basal', 'iv_lakemedel', 'ventilation', 'vasoaktiv_flera']).poang).toBe(39);
    expect(() => nems.poang(['ventilation', 'andningsvard'])).toThrow('kan inte båda väljas');
    expect(() => nems.poang(['basal', '__proto__'])).toThrow('Välj posterna ur listan');
    expect(() => nems.poang('basal')).toThrow();
    const f = nems.forslag({ monitor: true, ivLakemedel: ['Morfin Abcur'], vasoaktiva: [], andningsstod: [{ typ: 'invasiv', typText: 'Invasiv ventilation i respirator', start: t(120) }], syrgas: true });
    expect(f.map(x => x.id)).toEqual(['basal', 'iv_lakemedel', 'ventilation']);
    expect(f[2].varfor).toContain('Invasiv ventilation');
    const s = await inloggad('ssk-kard');
    expect((await s.post('/api/patient/p22/iva/andningsstod', { typ: 'hogflode', befuktning: 'aktiv' })).status).toBe(201);
    const v = (await s.get('/api/patient/p22/iva/tillagg')).data.nems;
    expect(v.forslag.map(x => x.id)).toContain('andningsvard');
    expect(v.kan).toBe(true);
    const r = await s.post('/api/patient/p22/iva/nems', {});
    expect(r.status).toBe(201);
    expect(r.data.registrering.poang).toBe(v.forslagPoang);
    const r2 = await s.post('/api/patient/p22/iva/nems', { poster: [...v.forslag.map(x => x.id), 'atgard_iva'] });
    expect(r2.data.registrering.poang).toBe(v.forslagPoang + 5);
    expect(r2.data.text).toContain('skiljer sig från systemets förslag');
    expect((await s.post('/api/patient/p22/iva/nems', { poster: ['ventilation', 'andningsvard'] })).status).toBe(400);
    expect((await s.post('/api/patient/p22/iva/nems', { poang: 66, poster: ['basal'] })).data.registrering.poang).toBe(9);
    // Undersköterskan registrerar inte vårdtyngden.
    expect((await (await inloggad('usk-kard')).post('/api/patient/p22/iva/nems', {})).status).toBe(403);
    // Uppföljningen visar vårdtyngden enligt NEMS per avdelning, utan personuppgifter.
    somPerson(sandlada(app, s), 'lak-kard');
    const u = (await s.get('/api/iva/uppfoljning')).data;
    const e = u.enheter.find(x => x.enhet.id === 'uso-kard-hia');
    expect(e.vardtyngd.nems.vardygnMedNems).toBe(1);
    expect(e.vardtyngd.nems.medel).toBe(9);
    expect(e.vardtyngd.nems.andelRegistreradeProcent).toBeGreaterThan(0);
    expect(JSON.stringify(u)).not.toContain('p22');
  });

  test('infusionerna har en sammanräkning av givna doser det senaste dygnet och sedan starten', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Smärta efter ingrepp' });
    expect(r.status).toBe(201);
    const d = db(k);
    const oid = r.data.ordination.id;
    // Infusionen startade för fyra timmar sedan med 0,02 mg/kg/h och höjdes till 0,03 för två timmar sedan.
    const nu = new Date();
    d.query('UPDATE iva_infusioner SET skapad = ? WHERE ordination_id = ?').run(new Date(nu.getTime() - 4 * TIMME).toISOString(), oid);
    d.query("INSERT INTO iva_titreringar (ordination_id, patient_id, enhet_id, tid, dos, av) VALUES (?, 'p01', 'uso-kard', ?, 0.03, 'ssk-kard')").run(oid, new Date(nu.getTime() - 2 * TIMME).toISOString());
    const vikt = d.query('SELECT vikt_kg FROM iva_infusioner WHERE ordination_id = ?').get(oid).vikt_kg;
    const { sammanrakning } = await import('../src/r11r7-rutter.js');
    const [s] = sammanrakning(d, [{ ordinationId: oid, lakemedel: 'Morfin Abcur 10 mg/ml' }], nu);
    expect(s.senasteDygnet).toBeCloseTo((0.02 * 2 + 0.03 * 2) * vikt, 1);
    expect(s.text).toContain('mg det senaste dygnet');
    expect(s.over).toBe(false);
    const t2 = (await k.get('/api/patient/p01/iva/tillagg')).data;
    expect(t2.sammanrakning.map(x => x.ordinationId)).toContain(oid);
  });

  test('noradrenalin ordineras i µg/kg/min och titreras mot målet för medelartärtrycket, patientens eget mål när läkaren har satt ett', async () => {
    const k = await inloggad('lak-kard');
    const f = (await k.get('/api/patient/p01/iva/infusion/forslag')).data;
    expect(f.protokoll.map(x => x.id)).toEqual(expect.arrayContaining(['morfin', 'noradrenalin', 'propofol', 'midazolam']));
    const nora = f.protokoll.find(x => x.id === 'noradrenalin');
    expect(nora.lakemedel).toBe('Noradrenalin Abcur 1 mg/ml');
    // 0,05 µg/kg/min vid 81,6 kg och 0,08 mg/ml: 0,05 × 81,6 × 60 / 1000 / 0,08 = 3,06 ml/h.
    expect(nora.startMlH).toBe(3.1);
    const r = await k.post('/api/patient/p01/iva/infusion', { protokoll: 'noradrenalin', ordinationsorsak: 'Cirkulatoriskt stöd' });
    expect(r.status).toBe(201);
    expect(r.data.infusion).toMatchObject({ dosEnhet: 'µg/kg/min', dos: 0.05, mlH: 3.1 });
    expect(r.data.ordination.dosering).toContain('µg/kg/min');
    const d = db(k);
    const oid = r.data.ordination.id;
    const a = atk(d, 'lak-kard', 'p01', {}, 'las_lakemedel');
    const nu = new Date();
    const map = (bt, min) => ({ id: 900000 + min, typ: 'blodtryck', varde: bt, varde_num: null, tid: new Date(nu.getTime() - min * MIN).toISOString(), kalla: 'vardkallan', vidimerad: null, enhet_id: 'uso-kard' });
    // MAP 68 ligger inom avdelningens mål 65 till 75: behåll dosen.
    const inom = iva.infusionerFor(a, [map('90/57', 5)], nu).find(x => x.ordinationId === oid);
    expect(inom.titrering.forslag).toBeNull();
    expect(inom.titrering.text).toContain('inom målet 65 till 75');
    // MAP 63 är under målet: systemet föreslår att öka till 0,07.
    const lagt = iva.infusionerFor(a, [map('90/50', 5)], nu).find(x => x.ordinationId === oid);
    expect(lagt.titrering.forslag).toBe(0.07);
    // Med patientens egen gräns MAP under 72 blir målet 72 till 82, och MAP 68 ger ett förslag att öka.
    expect((await k.post('/api/patient/p01/iva/regler', { parameter: 'map', villkor: 'under', grans: 72, motivering: 'Högre perfusionstryck efter hjärtstopp' })).status).toBe(201);
    const egen = iva.infusionerFor(a, [map('90/57', 5)], nu).find(x => x.ordinationId === oid);
    expect(egen.titrering.forslag).toBe(0.07);
    expect(egen.titrering.text).toContain('målet 72 till 82 (patientens mål)');
    // Puls över 140 är säkerhetsgränsen: minska till lägsta dos.
    const pulsRad = { ...map('100/60', 3), id: 900100, typ: 'puls', varde: '150', varde_num: 150 };
    const sak = iva.infusionerFor(a, [map('90/50', 5), pulsRad], nu).find(x => x.ordinationId === oid);
    expect(sak.titrering).toMatchObject({ niva: 'larm' });
    expect(sak.titrering.text).toContain('över 140');
  });

  test('propofol och midazolam ordineras med dosintervall utan automatisk titrering, och utdelningen visar varje dos med tid, vem och ml/h', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/patient/p01/iva/infusion', { protokoll: 'propofol', ordinationsorsak: 'Sedering i respirator' });
    expect(r.status).toBe(201);
    expect(r.data.infusion.titrering).toBeNull();
    expect(r.data.ordination.dosering).toContain('mg/kg/h');
    const oid = r.data.ordination.id;
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 2 })).status).toBe(200);
    expect((await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 9 })).status).toBe(400);
    const t = (await k.get('/api/patient/p01/iva/tillagg')).data;
    const s = t.sammanrakning.find(x => x.ordinationId === oid);
    expect(s.utdelning.map(u => u.dos)).toEqual([1, 2]);
    expect(s.utdelning[1]).toMatchObject({ av: 'Johan Ek', mlH: expect.any(Number) });
    expect(s.utdelning[0].text).toContain('Start');
    somPerson(sandlada(app, k), 'lak-kard');
    expect((await k.post('/api/patient/p01/iva/infusion', { protokoll: 'midazolam', ordinationsorsak: 'Sedering' })).data.infusion.dosEnhet).toBe('mg/kg/h');
  });

  test('en dosändring prövar armbandet mot patientens identitet, och ett armband som inte hör till patienten nekas och loggas', async () => {
    const k = await inloggad('lak-kard');
    const oid = (await k.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Smärta' })).data.ordination.id;
    somPerson(sandlada(app, k), 'ssk-kard');
    const fel = await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 0.03, armband: '199001011234' });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('Armbandet hör inte till den här patienten');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01' AND resultat = 'nekad' AND resurs LIKE 'iva:infusion:%:armband'").get().n).toBe(1);
    const ok = await k.post(`/api/patient/p01/iva/infusion/${oid}/dos`, { dos: 0.03, armband: '194502024732' });
    expect(ok.status).toBe(200);
    expect(ok.data.text).toContain('Armbandet stämmer');
    somPerson(sandlada(app, k), 'lak-kard');
  });

  test('utdelningen röjer varken grund eller namn för en titrering på en spärrad vårdenhet, men dosen räknas med i summan', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const sparrad = d.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get().enhet_id;
    d.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES ('p04', 'uso-kard', 'vikt', '70', 70, 'kg', ?, 'lak-kard')").run(new Date(Date.now() - 5 * TIMME).toISOString());
    const r = await k.post('/api/patient/p04/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Smärta' });
    expect(r.status).toBe(201);
    const oid = r.data.ordination.id;
    d.query('UPDATE iva_infusioner SET skapad = ? WHERE ordination_id = ?').run(new Date(Date.now() - 4 * TIMME).toISOString(), oid);
    d.query("INSERT INTO iva_titreringar (ordination_id, patient_id, enhet_id, tid, dos, av, grund) VALUES (?, 'p04', ?, ?, 0.03, 'lak-psyk', 'HEMLIG-GRUND')").run(oid, sparrad, new Date(Date.now() - 2 * TIMME).toISOString());
    const s = (await k.get('/api/patient/p04/iva/tillagg')).data.sammanrakning.find(x => x.ordinationId === oid);
    const text = JSON.stringify(s);
    expect(text).not.toContain('HEMLIG-GRUND');
    expect(text).not.toContain('Lena Ström');
    expect(s.utdelning.map(u => u.dos)).toEqual([0.02, 0.03]);
    expect(s.utdelning[1].av).toBeNull();
    expect(s.senasteDygnet).toBeCloseTo((0.02 * 2 + 0.03 * 2) * 70, 1);
  });

  test('överrapporteringen röjer varken orsak eller tid för en vårdkontakt på en spärrad vårdenhet eller på en annan vårdenhet utan aktivt val', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const sparrad = d.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get().enhet_id;
    // Två intensivvårdsavdelningar till i testet: en på den spärrade vårdenheten och en på medicinkliniken, som kräver
    // aktivt val för läkaren på kardiologen. Patienten har också en vårdkontakt på Hjärtintensiven som får visas.
    iva.IVA_ENHETER[sparrad] = { platser: 2 };
    iva.IVA_ENHETER['uso-med'] = { platser: 2 };
    try {
      const t = (h) => new Date(Date.now() - h * TIMME).toISOString();
      const vk = d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, ger_vardrelation) VALUES ('p04', ?, 'slutenvard', ?, ?, ?, 0)");
      vk.run('uso-kard-hia', t(5), 'Hjärtintensiven, sal 6', 'Synlig orsak');
      const fore = (await k.get('/api/patient/p04/iva/tillagg')).data.overrapportering;
      vk.run(sparrad, t(2), 'Sal 1', 'HEMLIG-ORSAK-SPARR');
      vk.run('uso-med', t(1), 'Sal 2', 'HEMLIG-ORSAK-VAL');
      const efter = (await k.get('/api/patient/p04/iva/tillagg')).data.overrapportering;
      const text = JSON.stringify(efter);
      for (const x of ['HEMLIG-ORSAK-SPARR', 'HEMLIG-ORSAK-VAL', 'Sal 1', 'Sal 2']) expect(text).not.toContain(x);
      expect(JSON.stringify({ ...efter, tid: null })).toBe(JSON.stringify({ ...fore, tid: null }));
      expect(efter.situation.join(' ')).toContain('synlig orsak');
    } finally {
      delete iva.IVA_ENHETER[sparrad];
      delete iva.IVA_ENHETER['uso-med'];
    }
  });

  test('nyheterna i version 1.1 för intensivvården och tillväxten visas för rätt roller', () => {
    const ids = (roll) => forRoll(roll).find(v => v.version === '1.1.0')?.nyheter.map(n => n.id) ?? [];
    expect(ids('lakare')).toEqual(expect.arrayContaining(['iva-realtid-regler', 'tillvaxt-referens-pubertet-import', 'bhv-indikatorer']));
    expect(ids('underskoterska')).toEqual(expect.arrayContaining(['iva-realtid-regler']));
    expect(ids('underskoterska')).not.toContain('tillvaxt-referens-pubertet-import');
    expect(ids('uppfoljning')).toEqual(expect.arrayContaining(['bhv-indikatorer']));
    expect(ids('invanare')).not.toContain('iva-realtid-regler');
  });
});
