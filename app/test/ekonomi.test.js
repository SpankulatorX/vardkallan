// Ekonomi (runda 7, r3, Sussa 7.1.1.1, 7.1.1.2, 7.1.2.1 och 3.4.4.4). Systemet är experten: transaktionsposterna skapas
// av systemet ur det som har hänt, betalningsmottagaren räknas fram, priset hämtas ur den prislista som gällde dagen för
// händelsen och vårdtillfället grupperas med en demoregel. Ingen registrerar en transaktion.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, migrera, idag, addDagar, datumAv } from '../src/db.js';
import * as ekonomi from '../src/ekonomi.js';
import { BASPRISER, DRG_DEMO, FOLKBOKFORING_DEMO } from '../src/ekonomi-schema.js';
import { avgiftFor, kontaktUt } from '../src/vardkontakt.js';
import * as tidbok from '../src/tidbok.js';
import { slaSamman } from '../src/identitet.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const vt = (d, pid) => d.query('SELECT * FROM vardtillfallen WHERE patient_id = ? ORDER BY id DESC').get(pid);
const kontakt = (d, id) => d.query('SELECT * FROM vardkontakter WHERE id = ?').get(id);
// Hela perioden för ett vårdtillfälle, i svensk tid.
const periodFor = (v) => ({ fran: datumAv(new Date(v.inskriven)), till: datumAv(new Date(v.utskriven ?? Date.now())) });
const rader = (d, vardenhet, period, nu) => ekonomi.transaktioner(d, { vardenhet, ...period, nu });

describe('Ekonomi: prislistor', () => {
  test('varje vårdenhet har en prislista med version, giltighetstid och demopriser, och kardiologin har en historik', () => {
    const d = byggSeed();
    const enheter = d.query("SELECT id FROM enheter WHERE typ = 'vardenhet'").all().map(e => e.id);
    for (const e of enheter) {
      const p = ekonomi.prislistaFor(d, e, idag());
      expect(p).toMatchObject({ enhet_id: e });
      expect(p.poster.vardkontakt.besok.pris).toBeGreaterThan(0);
      expect(p.poster.vardtillfalle.varddygn.pris).toBeGreaterThan(0);
      expect(Object.keys(p.poster.lakemedel).length).toBe(50);
    }
    const h = ekonomi.prislistaHistorik(d, 'uso-kard');
    expect(h.versioner.length).toBe(2);
    expect(h.versioner[0]).toMatchObject({ version: 2, giltigTill: null });
    expect(h.versioner[1].giltigTill).toBe(addDagar(h.versioner[0].giltigFran, -1));
    expect(h.versioner[0].andringar.length).toBeGreaterThan(0);
    expect(h.demo).toContain('Demopriser');
    // Priset hämtas ur den version som gällde dagen för händelsen.
    expect(ekonomi.prislistaFor(d, 'uso-kard-72', h.versioner[1].giltigFran).version).toBe(1);
    expect(ekonomi.prislistaFor(d, 'uso-kard-72', idag()).version).toBe(2);
    // En prislista ändras och raderas inte i databasen.
    expect(fel(() => d.query("UPDATE prislistor SET orsak = 'x' WHERE enhet_id = 'uso-kard'").run())).toBeTruthy();
    expect(fel(() => d.query("DELETE FROM prislistor WHERE enhet_id = 'uso-kard'").run())).toBeTruthy();
  });

  test('bara ekonomen ändrar en prislista, som blir en ny version från ett datum som inte har passerat, och ändringen loggas', async () => {
    const k = await inloggad('eko');
    const fore = (await k.get('/api/ekonomi/prislistor/uso-kard')).data;
    expect(fore.versioner.length).toBe(2);
    const fran = addDagar(idag(), 3);
    const r = await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'besok', pris: 2222 }], giltigFran: fran, orsak: 'Nytt demopris för besök' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ version: 3, giltigFran: fran });
    const efter = (await k.get('/api/ekonomi/prislistor/uso-kard')).data;
    expect(efter.versioner.map(v => v.version)).toEqual([3, 2, 1]);
    expect(efter.versioner[0].andringar).toEqual([{ kategori: 'vardkontakt', kod: 'besok', text: 'Besök i öppenvård', fore: fore.versioner[0].poster.vardkontakt.besok.pris, efter: 2222 }]);
    expect(efter.versioner[1].giltigTill).toBe(addDagar(fran, -1));
    expect(ekonomi.prislistaFor(db(k), 'uso-kard', fran).poster.vardkontakt.besok.pris).toBe(2222);
    expect(ekonomi.prislistaFor(db(k), 'uso-kard', idag()).version).toBe(2);
    const logg = db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'prislista' AND resurs LIKE '%:v3' ORDER BY id DESC").get();
    expect(logg).toMatchObject({ personal_id: 'eko', resurs: 'prislista:uso-kard:v3', grund: 'ekonomi', patient_id: null, syfte: 'Nytt demopris för besök' });
    // Inte bakåt i tiden, inte utan orsak och inte med ett ogiltigt pris.
    expect((await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'besok', pris: 1 }], giltigFran: addDagar(idag(), -1), orsak: 'Bakåt' })).status).toBe(400);
    expect((await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'besok', pris: 1 }], giltigFran: fran, orsak: '' })).status).toBe(400);
    expect((await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'besok', pris: -5 }], giltigFran: fran, orsak: 'Fel' })).status).toBe(400);
    expect((await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'finns-inte', pris: 5 }], giltigFran: fran, orsak: 'Fel' })).status).toBe(400);
    // Andra roller får inte ändra eller läsa prislistorna, och försöket loggas som nekat.
    for (const roll of ['lak-kard', 'adm-kard', 'vch-kard', 'uppf']) {
      await k.logga(roll);
      expect((await k.post('/api/ekonomi/prislistor/uso-kard', { andringar: [{ kategori: 'vardkontakt', kod: 'besok', pris: 1 }], giltigFran: fran, orsak: 'Försök' })).status).toBe(403);
      expect((await k.get('/api/ekonomi/prislistor/uso-kard')).status).toBe(403);
      expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'prislista' AND resultat = 'nekad' AND personal_id = ? ORDER BY id DESC").get(personal(db(k), roll).id)).toBeTruthy();
    }
    expect(verifiera(db(k)).hel).toBe(true);
  });
});

describe('Ekonomi: faktureringsunderlag', () => {
  test('systemet skapar transaktionsposter ur vårdtillfället med vårddygn, material, DRG och sammanhållande id utan att någon registrerar dem', () => {
    const d = byggSeed();
    const v = vt(d, 'p10');
    expect(v.utskriven).toBeTruthy();
    const t = rader(d, 'lind-med', periodFor(v));
    const dygn = t.filter(r => r.typ === 'varddygn');
    const vist = d.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ?').all(v.id);
    const antalDygn = vist.reduce((s, x) => s + Math.max(1, Math.ceil((Date.parse(x.slut) - Date.parse(x.start)) / 86400_000)), 0);
    expect(dygn.length).toBe(antalDygn);
    for (const r of dygn) {
      expect(r).toMatchObject({ vardtillfalleId: v.id, sammanhallandeId: `vardtillfalle:${v.id}`, vardenhet: { id: 'lind-med' }, demo: true });
      expect(vist.map(x => x.id)).toContain(r.vardkontaktId);
      expect(r.belopp).toBe(r.aPris * r.antal);
    }
    expect(t.filter(r => r.typ === 'material' && r.kod === 'MAT-DYGN').length).toBe(antalDygn);
    const drg = t.find(r => r.typ === 'drg');
    expect(drg).toMatchObject({ kod: 'VK-DRG-05B', vardtillfalleId: v.id, datum: datumAv(new Date(v.utskriven)) });
    expect(drg.text).toContain('demogrupp');
    // Stabila id: samma underlag två gånger ger samma rader.
    expect(rader(d, 'lind-med', periodFor(v)).map(r => r.id)).toEqual(t.map(r => r.id));
    expect(new Set(t.map(r => r.id)).size).toBe(t.length);
    // Migrerad historik och planerade kontakter som inte har ägt rum kommer inte med.
    const alla = rader(d, 'uso-kard', { fran: '2000-01-01', till: addDagar(idag(), 400) });
    const vkIds = new Set(alla.map(r => r.vardkontaktId).filter(Boolean));
    for (const id of vkIds) {
      const x = kontakt(d, id);
      expect(x.kalla).toBe('vardkallan');
      expect(Boolean(x.planerad && !x.ankomst)).toBe(false);
    }
  });

  test('läkemedel som gavs på enheten och åtgärder med KVÅ blir poster med pris ur prislistan och materialschablon', () => {
    const d = byggSeed();
    const v = vt(d, 'p01');
    const t = rader(d, 'uso-kard', { fran: datumAv(new Date(v.inskriven)), till: idag() });
    const lm = t.filter(r => r.typ === 'lakemedel' && r.patient.id === 'p01');
    const givna = d.query("SELECT * FROM administreringar WHERE patient_id = 'p01' AND status IN ('given', 'overlamnad')").all();
    expect(lm.length).toBe(givna.length);
    const p = ekonomi.prislistaFor(d, 'uso-kard', idag());
    for (const r of lm) expect(r.aPris).toBe(p.poster.lakemedel[r.kod].pris);
    const atg = t.filter(r => r.typ === 'atgard' && r.patient.id === 'p01');
    expect(atg.length).toBeGreaterThan(0);
    for (const r of atg) {
      expect(r.kod).toBe('QD008');
      expect(r.text).toBe('Övervakning av vitala tecken');
      expect(t.some(m => m.typ === 'material' && m.kod === 'MAT-OVERV' && m.kalla === r.kalla)).toBe(true);
    }
    // Injektioner ger injektionsmaterial (patient 7 får Fragmin på ortopeden i Karlskoga).
    const k = rader(d, 'kkoga-ort', { fran: datumAv(new Date(vt(d, 'p07').inskriven)), till: idag() });
    expect(k.some(r => r.typ === 'material' && r.kod === 'MAT-INJ')).toBe(true);
  });

  test('ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/patient/p05/vardkontakter', {});
    expect(r.status).toBe(201);
    const t = rader(db(k), 'uso-kard', { fran: idag(), till: idag() });
    const besok = t.find(x => x.typ === 'vardkontakt' && x.vardkontaktId === r.data.id);
    expect(besok).toMatchObject({ kod: 'besok', sammanhallandeId: `vardkontakt:${r.data.id}`, betalare: { typ: 'egen_region' }, debiteras: false });
    const avg = t.find(x => x.typ === 'patientavgift' && x.vardkontaktId === r.data.id);
    expect(avg).toMatchObject({ belopp: r.data.avgift.belopp, betalare: { typ: 'patient' }, status: 'faktureras', debiteras: true });
  });

  test('betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region', () => {
    const d = byggSeed();
    // Utomlänsvård: patient 12 är folkbokförd i Värmland enligt den simulerade folkbokföringen.
    expect(FOLKBOKFORING_DEMO.p12.region).toBe('Region Värmland');
    const v12 = vt(d, 'p12');
    const t12 = rader(d, 'uso-ort', periodFor(v12));
    const drg = t12.find(r => r.typ === 'drg');
    expect(drg.betalare).toMatchObject({ typ: 'annan_region', namn: 'Region Värmland', lanKod: '17', simulerad: true });
    expect(drg.debiteras).toBe(true);
    // Vårddygnen ingår i DRG-ersättningen och debiteras inte för sig.
    for (const r of t12.filter(x => x.typ === 'varddygn')) expect(r).toMatchObject({ debiteras: false, ingarI: 'drg' });
    // Barn: vårdnadshavaren betalar patientavgiften.
    expect(ekonomi.avgiftsbetalare(d, d.query("SELECT * FROM patienter WHERE id = 'p09'").get(), idag())).toMatchObject({ typ: 'vardnadshavare', namn: 'Johanna Bergström', identitet: '19861214-2383' });
    // Asylsökande med LMA-kort: Migrationsverket (simulerat) och en lägre patientavgift.
    const p18 = d.query("SELECT * FROM patienter WHERE id = 'p18'").get();
    expect(ekonomi.vardbetalare(d, p18, idag())).toMatchObject({ typ: 'migrationsverket', debiteras: true, simulerad: true });
    expect(avgiftFor(d, p18, { id: 0, typ: 'oppenvard', kontaktsatt: 'besok', start: new Date().toISOString(), kalla: 'vardkallan', patient_id: 'p18' })).toMatchObject({ belopp: 50, demoregler: true });
    // Reservnummer: identiteten är inte fastställd, och underlaget väntar.
    const p17 = d.query("SELECT * FROM patienter WHERE id = 'p17'").get();
    expect(ekonomi.vardbetalare(d, p17, idag())).toMatchObject({ typ: 'okand_identitet', debiteras: false, vantar: true });
    // Patient i länet: egen region, ingen faktura.
    expect(ekonomi.vardbetalare(d, d.query("SELECT * FROM patienter WHERE id = 'p01'").get(), idag())).toMatchObject({ typ: 'egen_region', namn: 'Region Örebro län', debiteras: false });
  });

  test('när reservnumret ersätts av personnumret följer underlaget med och betalningsmottagaren blir känd', () => {
    const d = byggSeed();
    const v17 = vt(d, 'p17');
    const fore = rader(d, 'uso-kard', { fran: datumAv(new Date(v17.inskriven)), till: idag() }).filter(r => r.vardtillfalleId === v17.id);
    expect(fore.length).toBeGreaterThan(0);
    for (const r of fore) expect(r.betalare.typ).toBe('okand_identitet');
    slaSamman(d, { fran: 'p17', till: 'p16', personal: personal(d, 'adm-kard'), grund: 'Samma person' });
    const efter = rader(d, 'uso-kard', { fran: datumAv(new Date(v17.inskriven)), till: idag() }).filter(r => r.vardtillfalleId === v17.id);
    expect(efter.map(r => r.id)).toEqual(fore.map(r => r.id));
    for (const r of efter) expect(r).toMatchObject({ patient: { id: 'p16', identitetstyp: 'personnummer' }, betalare: { typ: 'egen_region' } });
  });

  test('skyddad identitet: underlaget innehåller aldrig adressen eller namnet', () => {
    const d = byggSeed();
    const p = d.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt) VALUES ('p03', 'vc-tybble', 'oppenvard', ?, ?, 'Mottagning', 'Kontroll', 'vardkallan', 'besok')")
      .run(new Date(Date.now() - 3600_000).toISOString(), new Date(Date.now() - 1800_000).toISOString());
    const k = personal(d, 'eko');
    const ut = ekonomi.exportera(d, k, { vardenhet: 'vc-tybble', fran: idag(), till: idag(), format: 'json' });
    const j = JSON.parse(ut.text);
    const egna = j.poster.filter(r => r.patient.id === 'p03');
    expect(egna.length).toBeGreaterThan(0);
    for (const r of egna) expect(r.patient).toMatchObject({ skyddad: true, namn: null, adress: null, postnr: null, ort: null });
    for (const s of [p.fornamn, p.efternamn, 'Engberg']) expect(ut.text).not.toContain(s);
    const csv = ekonomi.exportera(d, k, { vardenhet: 'vc-tybble', fran: idag(), till: idag(), format: 'csv' }).text;
    expect(csv).not.toContain('Engberg');
    expect(csv).toContain('Skatteverket');
  });

  test('DRG: vårdtillfället grupperas med en demoregel ur den ansvariga vårdenhetens huvuddiagnos, och utan huvuddiagnos förklarar systemet varför', () => {
    const d = byggSeed();
    for (const g of DRG_DEMO) expect(g.text).toContain('demogrupp');
    expect(ekonomi.drgFor(d, vt(d, 'p10'))).toMatchObject({ kod: 'VK-DRG-05B', demo: true });
    expect(ekonomi.drgFor(d, vt(d, 'p04'))).toMatchObject({ kod: 'VK-DRG-05A' });
    // Patient 22 har en depression på psykiatrin och förmaksflimmer på kardiologin, som har det medicinska ansvaret.
    expect(ekonomi.drgFor(d, vt(d, 'p22'))).toMatchObject({ kod: 'VK-DRG-05C' });
    // Bidiagnos ger högre vikt.
    const p01 = ekonomi.drgFor(d, vt(d, 'p01'));
    const grupp = DRG_DEMO.find(g => g.kod === p01.kod);
    expect(p01.vikt).toBeCloseTo(grupp.vikt + 0.1, 5);
    const utan = d.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, kalla) VALUES ('p02', 'uso-inf', ?, 'vardkallan')").run(new Date().toISOString());
    const g = ekonomi.drgFor(d, d.query('SELECT * FROM vardtillfallen WHERE id = ?').get(utan.lastInsertRowid));
    expect(g).toMatchObject({ kod: 'VK-DRG-00', vikt: 0 });
    expect(g.forklaring).toContain('huvuddiagnos');
    expect(ekonomi.DEMO).toContain('NordDRG');
  });

  test('medicinskt färdigbehandlad registreras av läkaren på vårdtillfället och ingår i underlaget', async () => {
    const k = await inloggad('lak-kard');
    const v = vt(db(k), 'p04');
    const r = await k.post(`/api/vardtillfalle/${v.id}/fardigbehandlad`, {});
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ datum: idag(), kalla: 'registrerad', av: { namn: 'Sara Lindqvist' } });
    expect((await k.post(`/api/vardtillfalle/${v.id}/fardigbehandlad`, {})).status).toBe(400);
    const t = rader(db(k), 'uso-kard', { fran: datumAv(new Date(v.inskriven)), till: idag() }).filter(x => x.vardtillfalleId === v.id && x.typ === 'varddygn');
    for (const x of t) expect(x.fardigbehandlad).toBe(idag());
    expect(t.filter(x => x.efterFardigbehandlad).every(x => x.datum >= idag())).toBe(true);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'fardigbehandlad' AND patient_id = 'p04' ORDER BY id DESC").get()).toMatchObject({ personal_id: 'lak-kard', resultat: 'tillaten' });
    // Datumet kan inte ligga före inskrivningen eller i framtiden.
    const v1 = vt(db(k), 'p17');
    expect((await k.post(`/api/vardtillfalle/${v1.id}/fardigbehandlad`, { datum: addDagar(idag(), 1) })).status).toBe(400);
    expect((await k.post(`/api/vardtillfalle/${v1.id}/fardigbehandlad`, { datum: '2001-01-01' })).status).toBe(400);
    // Sjuksköterskan registrerar inte, och en läkare på en annan vårdenhet nekas och det loggas.
    await k.logga('ssk-kard');
    expect((await k.post(`/api/vardtillfalle/${v1.id}/fardigbehandlad`, {})).status).toBe(403);
    await k.logga('lak-vc');
    expect((await k.post(`/api/vardtillfalle/${v1.id}/fardigbehandlad`, {})).status).toBe(403);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'fardigbehandlad' AND personal_id = 'lak-vc' ORDER BY id DESC").get().resultat).toBe('nekad');
    // Ändras och raderas inte.
    expect(fel(() => db(k).query("UPDATE fardigbehandlad SET datum = '2001-01-01'").run())).toBeTruthy();
    expect(fel(() => db(k).query('DELETE FROM fardigbehandlad').run())).toBeTruthy();
  });

  test('i en samordnad planering vid utskrivning är underrättelsen om utskrivningsklar registreringen, och kommunens betalningsansvar kommer med', () => {
    const d = byggSeed();
    const v = vt(d, 'p01');
    const s = d.query("SELECT * FROM samordningar WHERE patient_id = 'p01' AND typ = 'spu'").get();
    const uk = new Date(Date.parse(v.inskriven) + 26 * 3600_000).toISOString();
    d.query("INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, 'utskrivningsklar', ?, 'lak-kard', 'uso-kard', '{}')").run(s.id, uk);
    const f = ekonomi.fardigbehandlad(d, v);
    expect(f).toMatchObject({ datum: datumAv(new Date(uk)), kalla: 'spu', kanRegistreras: false });
    expect(f.varforInte).toContain('samordnade planeringen');
    const fel400 = fel(() => ekonomi.registreraFardigbehandlad(atk(d, 'lak-kard', 'p01', {}, 'fardigbehandlad'), v, {}));
    expect(fel400.status).toBe(400);
    // Kommunens betalningsansvar gäller bara när villkoren är uppfyllda. Annars stannar dygnen hos regionen och systemet säger varför.
    const t = rader(d, 'uso-kard', { fran: datumAv(new Date(v.inskriven)), till: idag() }).filter(x => x.vardtillfalleId === v.id && x.typ === 'varddygn');
    expect(t.every(x => x.fardigbehandlad === datumAv(new Date(uk)))).toBe(true);
    expect(t.some(x => x.efterFardigbehandlad)).toBe(true);
  });

  test('utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas', async () => {
    const k = await inloggad('ssk-kard');
    const r = await k.post('/api/patient/p01/hjalpmedel', { artikel: 'HM-ROLLATOR' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ artikel: 'HM-ROLLATOR', text: 'Rollator' });
    const t = rader(db(k), 'uso-kard', { fran: idag(), till: idag() });
    expect(t.find(x => x.typ === 'hjalpmedel' && x.kalla === `hjalpmedel:${r.data.id}`)).toMatchObject({ kod: 'HM-ROLLATOR', patient: { id: 'p01' } });
    expect((await k.post('/api/patient/p01/hjalpmedel', { artikel: 'HM-FINNS-INTE' })).status).toBe(400);
    // Seedens knäortos har en hjälpmedelsavgift.
    const d = byggSeed();
    const t19 = rader(d, 'uso-ort', { fran: addDagar(idag(), -10), till: idag() });
    expect(t19.find(x => x.typ === 'hjalpmedel' && x.kod === 'HM-ORTOS-KNA')).toBeTruthy();
    expect(t19.find(x => x.typ === 'patientavgift' && x.kod === 'HM-ORTOS-KNA')).toMatchObject({ belopp: BASPRISER.hjalpmedel['HM-ORTOS-KNA'].avgift });
    // Vårdadministratören och undersköterskan lämnar inte ut hjälpmedel.
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p01/hjalpmedel', { artikel: 'HM-ROLLATOR' })).status).toBe(403);
  });

  test('export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna', async () => {
    const k = await inloggad('eko');
    const v = vt(db(k), 'p10');
    const manad = datumAv(new Date(v.utskriven)).slice(0, 7);
    const csv = await k.get(`/api/ekonomi/underlag?vardenhet=lind-med&period=${manad}&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('content-disposition')).toContain(`faktureringsunderlag-lind-med-${manad}.csv`);
    const rad1 = csv.data.split('\n')[0];
    for (const kol of ['Post-id', 'Sammanhållande id', 'Vårdkontakt', 'Vårdtillfälle', 'Typ', 'Datum', 'Belopp', 'Betalningsmottagare', 'DRG', 'Medicinskt färdigbehandlad', 'Demo']) expect(rad1).toContain(kol);
    expect(csv.data).toContain('VK-DRG-05B');
    const json = await k.get(`/api/ekonomi/underlag?vardenhet=lind-med&period=${manad}&format=json`);
    expect(json.status).toBe(200);
    expect(json.data).toMatchObject({ format: 'vardkallan-faktureringsunderlag', demo: true, vardenhet: { id: 'lind-med', hsaId: 'SE2321000164-VK0210' }, period: { fran: `${manad}-01` } });
    expect(json.data.poster.every(r => r.datum.startsWith(manad))).toBe(true);
    expect(json.data.antal).toBe(json.data.poster.length);
    // Exporten loggas på varje patient i underlaget och sparas.
    const pids = [...new Set(json.data.poster.map(r => r.patient.id))];
    const logg = db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'faktureringsunderlag' AND personal_id = 'eko' AND patient_id IS NOT NULL AND resurs = ?").all(`faktureringsunderlag:${json.data.exportId}`);
    expect(logg.map(l => l.patient_id).sort()).toEqual(pids.sort());
    for (const l of logg) expect(l.grund).toBe('ekonomi');
    const ex = (await k.get('/api/ekonomi/exporter')).data.exporter;
    expect(ex[0]).toMatchObject({ id: json.data.exportId, format: 'json', antal: json.data.antal, vardenhet: { id: 'lind-med' }, av: { namn: 'Fredrik Alm' } });
    expect(ex[1]).toMatchObject({ format: 'csv' });
    expect(JSON.stringify(ex)).not.toContain('Brandt');
    // Fel vårdenhet, period eller format.
    expect((await k.get(`/api/ekonomi/underlag?vardenhet=finns-inte&period=${manad}&format=csv`)).status).toBe(400);
    expect((await k.get('/api/ekonomi/underlag?vardenhet=lind-med&period=2026-13&format=csv')).status).toBe(400);
    expect((await k.get(`/api/ekonomi/underlag?vardenhet=lind-med&period=${manad}&format=xml`)).status).toBe(400);
    // Andra roller nekas, och nekandet loggas.
    for (const roll of ['lak-kard', 'adm-kard', 'uppf', 'logg']) {
      await k.logga(roll);
      expect((await k.get(`/api/ekonomi/underlag?vardenhet=lind-med&period=${manad}&format=csv`)).status).toBe(403);
      expect((await k.get('/api/ekonomi/oversikt')).status).toBe(403);
    }
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'faktureringsunderlag' AND resultat = 'nekad'").get().n).toBeGreaterThanOrEqual(8);
    expect(verifiera(db(k)).hel).toBe(true);
  });

  test('utomlänsvård: underlaget har en del per hemregion med de uppgifter som den nationella tjänsten för utomlänsvård behöver (simulerad)', () => {
    const d = byggSeed();
    const v12 = vt(d, 'p12');
    const j = JSON.parse(ekonomi.exportera(d, personal(d, 'eko'), { vardenhet: 'uso-ort', ...periodFor(v12), format: 'json' }).text);
    const g = j.utomlansvard.find(x => x.lanKod === '17');
    expect(g).toMatchObject({ hemregion: 'Region Värmland', vardandeRegion: 'Region Örebro län', simulerad: true });
    const rad = g.poster.find(x => x.vardform === 'slutenvard');
    expect(rad).toMatchObject({ patientIdentitet: '19981221-2398', vardenhetHsa: 'SE2321000164-VK0150', sammanhallandeId: `vardtillfalle:${v12.id}`, inskriven: v12.inskriven, utskriven: v12.utskriven });
    expect(rad.drg.kod).toBe('VK-DRG-08B');
    expect(g.summa).toBe(g.poster.reduce((s, x) => s + x.belopp, 0));
    // Huvuddiagnosen kom från ortopedens besök före operationen, och det står i underlaget.
    expect(j.varningar.some(x => x.includes('kontakt före inskrivningen'))).toBe(true);
  });

  test('vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren', async () => {
    const k = await inloggad('adm-kard');
    const p05 = () => db(k).query("SELECT * FROM patienter WHERE id = 'p05'").get();
    expect(ekonomi.vardbetalare(db(k), p05(), idag()).typ).toBe('egen_region');
    expect((await k.post('/api/patient/p05/lma', { nummer: 'x', giltigTill: addDagar(idag(), 30) })).status).toBe(400);
    expect((await k.post('/api/patient/p05/lma', { nummer: 'DEMO-LMA-1234', giltigTill: addDagar(idag(), -1) })).status).toBe(400);
    const r = await k.post('/api/patient/p05/lma', { nummer: 'DEMO-LMA-1234', giltigTill: addDagar(idag(), 30) });
    expect(r.status).toBe(201);
    expect(ekonomi.vardbetalare(db(k), p05(), idag())).toMatchObject({ typ: 'migrationsverket', lmaKort: 'DEMO-LMA-1234' });
    expect(avgiftFor(db(k), p05(), { id: 0, typ: 'oppenvard', kontaktsatt: 'besok', start: new Date().toISOString(), kalla: 'vardkallan', patient_id: 'p05' }).belopp).toBe(50);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'lma' AND patient_id = 'p05' ORDER BY id DESC").get()).toMatchObject({ personal_id: 'adm-kard', resultat: 'tillaten' });
    await k.logga('lak-kard');
    expect((await k.post('/api/patient/p05/lma', { nummer: 'DEMO-LMA-9999', giltigTill: addDagar(idag(), 30) })).status).toBe(403);
  });

  test('översikten per vårdenhet visar antal, summa och varningar utan personuppgifter, och förra månaden är förvald', async () => {
    const k = await inloggad('eko');
    const o = (await k.get('/api/ekonomi/oversikt')).data;
    const forra = addDagar(`${idag().slice(0, 7)}-01`, -1).slice(0, 7);
    expect(o.period).toMatchObject({ manad: forra });
    expect(o.perioder[0]).toMatchObject({ manad: idag().slice(0, 7), pagar: true });
    expect(o.vardenheter.map(v => v.vardenhet.id)).toContain('uso-kard');
    for (const v of o.vardenheter) expect(v.antal).toBeGreaterThanOrEqual(0);
    const s = JSON.stringify(o);
    for (const x of ['"p0', '"p1', 'Gunnar', 'Åkesson', 'Brandt', '19450202', '19450202-']) expect(s).not.toContain(x);
    expect(o.demo).toContain('Demopriser');
    // Översikten loggas utan patient.
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'faktureringsunderlag' AND resurs LIKE 'faktureringsunderlag:oversikt:%' ORDER BY id DESC").get()).toMatchObject({ patient_id: null, grund: 'ekonomi' });
    // Varningarna säger vad som väntar, utan vem.
    const kard = (await k.get(`/api/ekonomi/oversikt?period=${idag().slice(0, 7)}`)).data.vardenheter.find(v => v.vardenhet.id === 'uso-kard');
    expect(kard.varningar.some(v => v.includes('reservnummer'))).toBe(true);
  });
});

describe('Ekonomi: kostnader i vårdprocessen', () => {
  test('läkaren ser kostnaden hittills för vårdtillfället per kategori enligt prislistan, med DRG och högkostnadsskyddet', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get('/api/patient/p01/kostnader');
    expect(r.status).toBe(200);
    const v = vt(db(k), 'p01');
    expect(r.data.aktuell).toMatchObject({ typ: 'vardtillfalle', id: v.id });
    expect(r.data.aktuell.demo).toContain('Demopriser');
    const kat = Object.fromEntries(r.data.aktuell.kategorier.map(x => [x.typ, x]));
    for (const t of ['varddygn', 'lakemedel', 'material', 'atgard']) expect(kat[t].belopp).toBeGreaterThan(0);
    expect(r.data.aktuell.totalt).toBe(r.data.aktuell.kategorier.reduce((s, x) => s + x.belopp, 0));
    expect(r.data.aktuell.drg).toMatchObject({ preliminar: true });
    expect(r.data.aktuell.drg.belopp).toBeGreaterThan(0);
    expect(r.data.aktuell.lakemedel.length).toBeGreaterThan(0);
    expect(r.data.hogkostnadsskydd).toMatchObject({ grans: 1450 });
    expect(r.data.hogkostnadsskydd.betalt + r.data.hogkostnadsskydd.kvar).toBe(1450);
    expect(r.data.aktuell.fardigbehandlad).toMatchObject({ kanRegistreras: false });
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'las_kostnader' AND patient_id = 'p01' ORDER BY id DESC").get()).toMatchObject({ personal_id: 'lak-kard', resultat: 'tillaten' });
  });

  test('vårdadministratören ser bara patientavgifterna och högkostnadsskyddet, och undersköterskan ser inga kostnader', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.get('/api/patient/p01/kostnader');
    expect(r.status).toBe(200);
    expect(r.data.aktuell.kategorier).toBeUndefined();
    expect(r.data.aktuell.lakemedel).toBeUndefined();
    const s = JSON.stringify(r.data);
    for (const x of ['Furosemid', 'Metoprolol', 'Alvedon', 'QD008', 'VK-NPL', 'DRG']) expect(s).not.toContain(x);
    expect(r.data.hogkostnadsskydd).toBeTruthy();
    await k.logga('usk-kard');
    expect((await k.get('/api/patient/p01/kostnader')).status).toBe(403);
  });

  test('spärr och inre sekretess: kostnader från en spärrad eller annan vårdenhet syns inte och nämns inte', async () => {
    const d = byggSeed();
    // Patient 22 låg först på psykiatrin, som han spärrar i det här testet, och ligger nu på hjärtintensiven.
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p22', 'uso-psyk', ?)").run(idag());
    const a = atk(d, 'lak-kard', 'p22', {}, 'las_kostnader');
    const ut = ekonomi.kostnader(a, {});
    expect(ut.aktuell.typ).toBe('vardtillfalle');
    const psyk = d.query("SELECT id FROM vardkontakter WHERE patient_id = 'p22' AND enhet_id = 'uso-psyk'").all().map(x => x.id);
    expect(ut.aktuell.vistelser.map(x => x.id).some(id => psyk.includes(id))).toBe(false);
    const s = JSON.stringify(ut);
    for (const x of ['psyk', 'Allmänpsykiatriska', 'F32', 'Depression', 'spärr']) expect(s).not.toContain(x);
    expect(ut.aktuell.drg.kod).toBe('VK-DRG-05C');
    // Utan spärr men på en annan vårdenhet: kontakten på psykiatrin syns först efter aktivt val.
    const d2 = byggSeed();
    const b = atk(d2, 'lak-kard', 'p22', {}, 'las_kostnader');
    expect(ekonomi.kostnader(b, {}).aktuell.vistelser.map(x => x.id).some(id => psyk.includes(id))).toBe(false);
    const c = atk(d2, 'lak-kard', 'p22', { andra_enheter: true }, 'las_kostnader');
    expect(ekonomi.kostnader(c, {}).aktuell.vistelser.map(x => x.id).some(id => psyk.includes(id))).toBe(true);
  });

  test('en öppenvårdskontakt i dag har en egen kostnadsruta', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/patient/p05/vardkontakter', {});
    await k.logga('lak-kard');
    const ut = (await k.get(`/api/patient/p05/kostnader?vardkontakt=${r.data.id}`)).data;
    expect(ut.aktuell).toMatchObject({ typ: 'vardkontakt', id: r.data.id });
    expect(ut.aktuell.kategorier.find(x => x.typ === 'vardkontakt').belopp).toBe(ekonomi.prislistaFor(db(k), 'uso-kard', idag()).poster.vardkontakt.besok.pris);
    expect(ut.aktuell.patientavgifter[0]).toMatchObject({ belopp: r.data.avgift.belopp });
    // En kontakt hos en annan patient går inte att nå genom adressen.
    expect((await k.get(`/api/patient/p01/kostnader?vardkontakt=${r.data.id}`)).status).toBe(404);
  });
});

describe('Ekonomi: skydd i underlaget och högkostnadsskyddet', () => {
  // Barnet Leo Bergström (p09) har en vårdkontakt i dag på kardiologiska mottagningen, och vårdnadshavaren är
  // Johanna Bergström (inv-vh01).
  const VARDNADSHAVARE = ['Johanna', '19861214-2383', '198612142383'];
  const BARNETS_ADRESS = ['Lövstagatan', '702 13'];
  const underlag = (d) => ekonomi.exportera(d, personal(d, 'eko'), { vardenhet: 'uso-kard', fran: addDagar(idag(), -1), till: idag(), format: 'json' }).text;
  const underlagCsv = (d) => ekonomi.exportera(d, personal(d, 'eko'), { vardenhet: 'uso-kard', fran: addDagar(idag(), -1), till: idag(), format: 'csv' }).text;

  test('ett barn med skyddade personuppgifter: varken vårdnadshavarens namn och identitet eller adressen finns i underlaget', () => {
    const d = byggSeed();
    expect(underlag(d)).toContain('Johanna Bergström');
    d.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p09'").run();
    for (const text of [underlag(d), underlagCsv(d)]) {
      for (const s of [...VARDNADSHAVARE, ...BARNETS_ADRESS, 'Leo']) expect(text).not.toContain(s);
      expect(text).toContain('Skatteverket');
    }
    const r = JSON.parse(underlag(d)).poster.find(x => x.patient.id === 'p09' && x.typ === 'patientavgift');
    expect(r.betalare).toMatchObject({ typ: 'vardnadshavare', namn: null, identitet: null, skyddad: true });
  });

  test('en vårdnadshavare med skyddade personuppgifter: namn, identitet och barnets adress lämnas inte ut', () => {
    const d = byggSeed();
    // Vårdnadshavaren har en egen journal med skyddade personuppgifter. Skyddet följer personen, inte barnet.
    d.query("INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, skyddad) VALUES ('pvh', '198612142383', 'Johanna', 'Bergström', 'kvinna', '1986-12-14', 1)").run();
    d.query("UPDATE invanare SET patient_id = 'pvh' WHERE id = 'inv-vh01'").run();
    for (const text of [underlag(d), underlagCsv(d)]) {
      for (const s of [...VARDNADSHAVARE, ...BARNETS_ADRESS]) expect(text).not.toContain(s);
      expect(text).toContain('Skatteverket');
    }
    const r = JSON.parse(underlag(d)).poster.find(x => x.patient.id === 'p09' && x.typ === 'patientavgift');
    expect(r.betalare).toMatchObject({ typ: 'vardnadshavare', namn: null, identitet: null, skyddad: true });
    expect(r.patient).toMatchObject({ adress: null, postnr: null, ort: null });
  });

  test('högkostnadsskyddet räknas bara på de kontakter användaren får se: en spärrad enhet utan och med samtycke', () => {
    const d = byggSeed();
    // Elin Sandberg (p04) spärrar psykiatrin. Ett besök där för 30 dagar sedan får inte synas i beloppen utan samtycke.
    const t = new Date(Date.now() - 30 * 86400_000).toISOString();
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt) VALUES ('p04', 'uso-psyk', 'oppenvard', ?, ?, 'Mottagning', 'Samtal', 'vardkallan', 'besok')")
      .run(t, new Date(Date.parse(t) + 1800_000).toISOString());
    const utan = ekonomi.kostnader(atk(d, 'lak-kard', 'p04', {}, 'las_kostnader'), {});
    const med = ekonomi.kostnader(atk(d, 'lak-kard', 'p04', { samtycke_sparr: true }, 'las_kostnader'), {});
    expect(med.hogkostnadsskydd.betalt - utan.hogkostnadsskydd.betalt).toBe(200);
    expect(utan.hogkostnadsskydd.betalt + utan.hogkostnadsskydd.kvar).toBe(1450);
    // Inte heller texten eller något annat i svaret röjer besöket.
    for (const s of ['psyk', 'Samtal']) expect(JSON.stringify(utan)).not.toContain(s);
    expect(utan.hogkostnadsskydd.text).not.toContain(`${med.hogkostnadsskydd.betalt} kr av`);
    expect(utan.hogkostnadsskydd.text).toContain(`${utan.hogkostnadsskydd.betalt} kr av`);
    // Inre sekretess utan spärr: en annan vårdenhets besök räknas först efter aktivt val.
    const d2 = byggSeed();
    d2.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt) VALUES ('p01', 'uso-ort', 'oppenvard', ?, ?, 'Mottagning', 'Knä', 'vardkallan', 'besok')")
      .run(t, new Date(Date.parse(t) + 1800_000).toISOString());
    const a = ekonomi.kostnader(atk(d2, 'lak-kard', 'p01', {}, 'las_kostnader'), {}).hogkostnadsskydd;
    const b = ekonomi.kostnader(atk(d2, 'lak-kard', 'p01', { andra_enheter: true }, 'las_kostnader'), {}).hogkostnadsskydd;
    expect(b.betalt).toBeGreaterThanOrEqual(a.betalt);
    // Patient 1 är 81 år och betalar inget, så beloppet är detsamma. Ett frikort röjs inte av ett dolt besök.
    expect(a.frikort).toBe(false);
  });
});

describe('Ekonomi: avgifter som taket har påverkat', () => {
  test('en dold kontakt som gör nästa synliga avgift nedsatt men inte noll ändrar inte svaret i kostnadsrutan', () => {
    // Elin Sandberg (p04) spärrar psykiatrin och har ett akutbesök för 400 kr på en annan vårdenhet. Fem besök på
    // psykiatrin för 1 000 kr gör att dagens besök på kardiologin i verkligheten kostar 50 kr i stället för 200 kr.
    // Rutan ska se ut som om de dolda besöken inte fanns.
    const nu0 = Date.now();
    const bygg = (medDolda) => {
      const d = byggSeed();
      const ins = d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt) VALUES ('p04', ?, 'oppenvard', ?, ?, 'Mottagning', ?, 'vardkallan', 'besok')");
      if (medDolda) for (let i = 0; i < 5; i++) { const t = new Date(nu0 - (40 + i * 20) * 86400_000).toISOString(); ins.run('uso-psyk', t, new Date(Date.parse(t) + 1800_000).toISOString(), 'Samtal'); }
      const t = new Date(nu0 - 2 * 3600_000).toISOString();
      const id = Number(ins.run('uso-kard-mott', t, new Date(Date.parse(t) + 1800_000).toISOString(), 'Återbesök').lastInsertRowid);
      const v = d.query('SELECT * FROM vardkontakter WHERE id = ?').get(id);
      return { d, v, ut: ekonomi.kostnader(atk(d, 'lak-kard', 'p04', {}, 'las_kostnader'), { vardkontakt: id }, nu0) };
    };
    const med = bygg(true);
    const utan = bygg(false);
    // Kontroll: med de dolda besöken är den verkliga avgiften nedsatt men inte noll.
    const verklig = avgiftFor(med.d, med.d.query("SELECT * FROM patienter WHERE id = 'p04'").get(), med.v);
    expect(verklig.belopp).toBeGreaterThan(0);
    expect(verklig.belopp).toBeLessThan(200);
    // Hela svaret, med belopp, status och texter, är detsamma. Bara kontaktens id skiljer mellan sandlådorna.
    const vy = (x) => JSON.stringify({ ...x.ut, aktuell: { ...x.ut.aktuell, id: 0, vistelser: x.ut.aktuell.vistelser.map(v => ({ ...v, id: 0 })) } });
    expect(vy(med)).toBe(vy(utan));
    expect(med.ut.aktuell.patientavgifter[0]).toMatchObject({ belopp: 200, status: 'faktureras' });
    expect(JSON.stringify(med.ut)).not.toContain('nås med');
  });
});

describe('Ekonomi: avgiften visas som e-frikortet', () => {
  // David Nordin (p15) har en bokad tid i dag på kardiologiska mottagningen. Besök på psykiatrin är dolda för
  // vårdadministratören där. Avgiften ska vara rätt, men svaret får inte röja hur nära taket patienten är.
  // Samma sandlåda: först utan dolda besök, sedan med ett dolt besök i taget.
  const sandlada1 = () => {
    const d = byggSeed();
    const ins = d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt) VALUES ('p15', 'uso-psyk', 'oppenvard', ?, ?, 'Mottagning', 'Samtal', 'vardkallan', 'besok')");
    let n = 0;
    const dolt = () => { const t = new Date(Date.now() - (30 + n++ * 15) * 86400_000).toISOString(); ins.run(t, new Date(Date.parse(t) + 1800_000).toISOString()); };
    const b = d.query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p15' AND t.relativ = 1").get();
    const v = d.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
    return { d, b, v, dolt };
  };
  const visning = ({ d, b, v }) => ({ kontakt: kontaktUt(d, v, personal(d, 'adm-kard')).avgift, bokning: (({ demoregler, ...r }) => r)(tidbok.avgiftForBokning(d, b)) });
  const utanBelopp = (x) => JSON.parse(JSON.stringify(x, (k, val) => (['belopp', 'frikort', 'frikortTill', 'satt'].includes(k) ? undefined : val)));

  test('i vårdkontaktslistan och tidbokens betalning skiljer sig svaret med och utan dolda besök bara i beloppet och frikortsstatusen', () => {
    const s1 = sandlada1();
    const utan = visning(s1);
    expect(utan.kontakt.belopp).toBe(200);
    // Så många dolda besök att dagens avgift blir nedsatt men inte noll, och sedan så många att patienten har frikort.
    let nedsatt = null;
    for (let i = 0; i < 10 && !nedsatt; i++) { s1.dolt(); const x = visning(s1); if (x.kontakt.belopp > 0 && x.kontakt.belopp < 200) nedsatt = x; }
    expect(nedsatt).toBeTruthy();
    expect(utanBelopp(nedsatt)).toEqual(utanBelopp(utan));
    expect(nedsatt.kontakt.text).toContain('enligt högkostnadsskyddet');
    for (let i = 0; i < 3; i++) s1.dolt();
    const frikort = visning(s1);
    expect(frikort.kontakt).toMatchObject({ belopp: 0, frikort: true });
    expect(frikort.kontakt.text).toMatch(/^Frikort gäller till och med \d{4}-\d{2}-\d{2}\./);
    expect(frikort.bokning).toMatchObject({ belopp: 0, satt: 'frikort' });
    // Aldrig summan av betalda avgifter, antal besök eller hur nära taket patienten är.
    for (const x of [utan, nedsatt, frikort]) {
      const s = JSON.stringify(x);
      for (const ord of ['nås', 'återstår', 'kr av', '1450', '1 450', 'betalat', 'besök i år']) expect(s).not.toContain(ord);
    }
  });

  test('patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det', async () => {
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-p15' })).status).toBe(200);
    const r = await k.get('/api/min/journal/p15/hogkostnadsskydd');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ grans: 1450, demoregler: true });
    expect(r.data.betalt + r.data.kvar).toBe(1450);
    expect(Array.isArray(r.data.avgifter)).toBe(true);
    expect(r.data.text).toContain('högkostnadsskyddet');
    expect((await k.get('/api/min/journal/p01/hogkostnadsskydd')).status).toBeGreaterThanOrEqual(403);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE invanare_id = 'inv-p15' AND resurs = 'min:hogkostnadsskydd' ORDER BY id DESC").get()).toBeTruthy();
    // Kostnadsrutan säger att beloppet gäller de besök användaren kan se, och var patienten ser hela skyddet.
    const l = await inloggad('lak-kard');
    expect((await l.get('/api/patient/p01/kostnader')).data.hogkostnadsskydd.text).toContain('Patienten ser hela högkostnadsskyddet i Min journal');
  });
});

describe('Ekonomi: export för en spärrad vårdenhet', () => {
  test('underlaget för en vårdenhet som patienten har spärrat har minsta möjliga uppgifter och inget om andra vårdenheter', () => {
    const d = byggSeed();
    // Emil Sjölund (p22) låg först på psykiatrin och ligger nu på hjärtintensiven. Han spärrar psykiatrin.
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p22', 'uso-psyk', ?)").run(idag());
    const v = vt(d, 'p22');
    const psykStart = d.query("SELECT min(start) AS s FROM vardkontakter WHERE patient_id = 'p22' AND enhet_id = 'uso-psyk'").get().s;
    const kardStart = d.query("SELECT min(start) AS s FROM vardkontakter WHERE patient_id = 'p22' AND enhet_id = 'uso-kard-hia'").get().s;
    const period = { fran: datumAv(new Date(v.inskriven)), till: idag() };
    const eko = personal(d, 'eko');
    const psyk = JSON.parse(ekonomi.exportera(d, eko, { vardenhet: 'uso-psyk', ...period, format: 'json' }).text).poster.filter(r => r.patient.id === 'p22');
    expect(psyk.length).toBeGreaterThan(0);
    for (const r of psyk) {
      expect(r.vardtillfalleId).toBeNull();
      expect(r.halsoarendeId).toBeNull();
      expect(r.ingarI).toBeNull();
      expect(r.sammanhallandeId).toMatch(/^vardkontakt:/);
    }
    const sPsyk = JSON.stringify(psyk);
    for (const x of ['kard', 'Hjärt', 'I48', 'F32', 'DRG-05']) expect(sPsyk).not.toContain(x);
    // Kardiologins underlag för samma patient nämner inte psykiatrin, och DRG räknas på dygnen där.
    const kardText = ekonomi.exportera(d, eko, { vardenhet: 'uso-kard', ...period, format: 'json' }).text;
    const kard = JSON.parse(kardText).poster.filter(r => r.patient.id === 'p22');
    expect(kard.length).toBeGreaterThan(0);
    const s = JSON.stringify(kard);
    for (const x of ['psyk', 'Psyk', 'F32', 'I48', psykStart]) expect(s).not.toContain(x);
    for (const r of kard.filter(x => x.typ === 'drg')) expect(Date.parse(r.inskriven)).toBeGreaterThanOrEqual(Date.parse(kardStart));
    // Inga diagnoskoder utöver DRG-gruppen, för någon patient.
    expect(kardText).not.toMatch(/huvuddiagnosen|"huvuddiagnosFran"/);
  });
});

describe('Ekonomi: ChargeItem i FHIR', () => {
  test('ChargeItem med samma behörighet och loggning som kostnadsrutan', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get('/fhir/ChargeItem?patient=p01');
    expect(r.status).toBe(200);
    expect(r.data.resourceType).toBe('Bundle');
    const poster = r.data.entry.map(e => e.resource);
    expect(poster.length).toBeGreaterThan(0);
    for (const c of poster) {
      expect(c).toMatchObject({ resourceType: 'ChargeItem', status: 'billable', subject: { reference: 'Patient/p01' } });
      expect(c.id).toMatch(/^[A-Za-z0-9\-.]{1,64}$/);
      expect(c.priceOverride.currency).toBe('SEK');
    }
    expect(poster.some(c => c.code.text.includes('Vårddygn'))).toBe(true);
    expect(db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'las_kostnader' AND patient_id = 'p01' AND resurs LIKE 'fhir/ChargeItem%' ORDER BY id DESC").get()).toBeTruthy();
    const en = await k.get(`/fhir/ChargeItem/${poster[0].id}`);
    expect(en.status).toBe(200);
    expect(en.data.id).toBe(poster[0].id);
    expect((await k.get('/fhir/ChargeItem/finns.inte.1')).status).toBe(404);
    const cap = (await k.get('/fhir/metadata')).data;
    expect(cap.rest[0].resource.some(x => x.type === 'ChargeItem')).toBe(true);
    // Vårdadministratören får bara patientavgifterna, och undersköterskan inget.
    await k.logga('adm-kard');
    const adm = (await k.get('/fhir/ChargeItem?patient=p01')).data;
    expect(JSON.stringify(adm)).not.toMatch(/Vårddygn|VK-NPL|QD008/);
    await k.logga('usk-kard');
    expect((await k.get('/fhir/ChargeItem?patient=p01')).status).toBe(403);
    // Spärr: en post från en spärrad vårdenhet finns inte och nämns inte.
    const d = byggSeed();
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p22', 'uso-psyk', ?)").run(idag());
    const s = JSON.stringify(ekonomi.chargeItems(atk(d, 'lak-kard', 'p22', { andra_enheter: true }, 'las_kostnader')));
    for (const x of ['psyk', 'Allmänpsykiatriska']) expect(s).not.toContain(x);
  });
});

describe('Ekonomi: sandlådor och roller', () => {
  test('en sandlåda från före runda 7 får tabellerna, prislistorna och ekonomen', () => {
    const d = byggSeed();
    for (const t of ['prislistor', 'fakturaexporter', 'fardigbehandlad', 'hjalpmedel_utlamnade', 'lma_kort']) d.exec(`DROP TABLE ${t}`);
    d.query("DELETE FROM personal WHERE id = 'eko'").run();
    migrera(d);
    expect(ekonomi.prislistaFor(d, 'uso-kard', idag())).toBeTruthy();
    expect(personal(d, 'eko')).toMatchObject({ yrke: 'ekonom', demo: 1 });
  });
});
