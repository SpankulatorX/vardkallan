// Sökning i patientens journal (Sussa 3.1.8.1 och 3.1.8.2, runda 6, r1).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, atk } from './hjalp.js';
import { tolka, sok } from '../src/journalsok.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const fraga = async (k, pid, q) => (await k.get(`/api/patient/${pid}/sok?q=${encodeURIComponent(q)}`));
const text = (t) => t.delar.map(d => d.text).join('');
const markerat = (t) => t.delar.filter(d => d.markerad).map(d => d.text.toLocaleLowerCase('sv-SE'));
// Svaret utan själva frågan, för att jämföra två sökningar.
const utanFraga = (d) => JSON.stringify({ ...d, fraga: null, tolkning: null });

describe('Sökning i journalen', () => {
  test('blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning', async () => {
    const k = await inloggad('lak-kard');
    const r = await fraga(k, 'p01', 'blodtryck');
    expect(r.status).toBe(200);
    const d = r.data;
    expect(d.tolkning).toContain('mätvärdena blodtryck');
    const mv = d.traffar.filter(t => t.typ === 'matvarde');
    expect(mv.length).toBeGreaterThanOrEqual(3);
    expect(mv.every(t => t.ref.flik === 'matvarden' && t.ref.sub === 'blodtryck' && markerat(t).includes('blodtryck'))).toBe(true);
    const ant = d.traffar.filter(t => t.typ === 'anteckning');
    expect(ant.length).toBeGreaterThan(0);
    expect(ant.every(t => markerat(t).every(m => m === 'blodtryck') && t.ref.flik === 'journal')).toBe(true);
    // Nyast först.
    const tider = d.traffar.map(t => String(t.tid));
    expect([...tider].sort().reverse()).toEqual(tider);
    // Ett vanligt ord tolkas: bt och feber leder till blodtryck och temperatur.
    expect([...tolka('bt').matTyper]).toEqual(['blodtryck']);
    expect([...tolka('feber').matTyper]).toEqual(['temp']);
  });

  test('en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen', async () => {
    const k = await inloggad('lak-kard');
    const icd = (await fraga(k, 'p01', 'I48')).data;
    const dia = icd.traffar.filter(t => t.typ === 'diagnos');
    expect(dia.length).toBeGreaterThanOrEqual(1);
    expect(dia.every(t => t.kod.system === 'ICD-10-SE' && t.kod.kod.startsWith('I48') && t.kod.markerad)).toBe(true);
    expect(icd.tolkning).toContain('diagnoser med koden I48');
    const med = (await fraga(k, 'p01', 'i48.1')).data.traffar.filter(t => t.typ === 'diagnos');
    expect(med.map(t => t.kod.kod)).toEqual(['I48.1']);
    const lm = (await fraga(k, 'p01', 'metoprolol')).data.traffar.filter(t => t.typ === 'ordination');
    expect(lm.length).toBeGreaterThanOrEqual(1);
    expect(lm.every(t => /Metoprolol/i.test(text(t)) && t.ref.flik === 'lakemedel')).toBe(true);
  });

  test('en läkemedelsgrupp hittar ordinationen och anteckningar som nämner läkemedlet', async () => {
    const k = await inloggad('lak-kard');
    const d = (await fraga(k, 'p01', 'blodförtunnande')).data;
    expect(d.tolkning).toContain('läkemedel i gruppen blodförtunnande');
    const lm = d.traffar.filter(t => t.typ === 'ordination');
    expect(lm.some(t => text(t).startsWith('Waran') && t.kod.kod === 'B01AA03' && t.kod.markerad)).toBe(true);
    // Anteckningarna som nämner Waran är från andra vårdenheter och söks efter ett aktivt val.
    expect(d.traffar.some(t => t.typ === 'anteckning')).toBe(false);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Läsa tidigare vård' });
    const efter = (await fraga(k, 'p01', 'blodförtunnande')).data;
    expect(efter.traffar.some(t => t.typ === 'anteckning' && markerat(t).some(m => m === 'waran'))).toBe(true);
  });

  test('spärrade uppgifter: inga träffar, och svaret röjer inte att de finns, inte heller med nödåtkomst', async () => {
    const k = await inloggad('lak-kard');
    // Patient 4 har spärrat psykiatrins uppgifter. Sertralin, depressionen och MADRS finns bara där.
    const sertralin = (await fraga(k, 'p04', 'sertralin')).data;
    const depression = (await fraga(k, 'p04', 'depression')).data;
    const pahittat = (await fraga(k, 'p04', 'zqxw')).data;
    for (const d of [sertralin, depression, pahittat]) expect(d.antal).toBe(0);
    expect(utanFraga(sertralin)).toBe(utanFraga(pahittat));
    expect(utanFraga(depression)).toBe(utanFraga(pahittat));
    expect(JSON.stringify(sertralin)).not.toMatch(/psyk|spärr|dold/i);
    // Med samtycke i stunden syns de.
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect((await fraga(k, 'p04', 'sertralin')).data.antal).toBeGreaterThan(0);
    // Akutläkaren med nödåtkomst får inga träffar i det spärrade.
    const a = await inloggad('lak-akut');
    const db = sandlada(app, a).db;
    db.query("UPDATE vardkontakter SET ger_vardrelation = 0 WHERE patient_id = 'p04' AND enhet_id = 'uso-akut'").run();
    const fore = await fraga(a, 'p04', 'sertralin');
    if (fore.status === 403) await a.post('/api/patient/p04/val', { typ: 'nodatkomst', syfte: 'Medvetslös, behöver läkemedelslistan' });
    const nod = (await fraga(a, 'p04', 'sertralin')).data;
    expect(nod.antal).toBe(0);
  });

  test('andra vårdenheters uppgifter söks först efter ett aktivt val, och svaret nämner dem inte per träff', async () => {
    const k = await inloggad('lak-kard');
    // RETTS står bara i akutmottagningens anteckning om patient 1.
    const fore = (await fraga(k, 'p01', 'RETTS')).data;
    expect(fore.antal).toBe(0);
    expect(utanFraga(fore)).toBe(utanFraga((await fraga(k, 'p01', 'zqxw')).data));
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Läsa akutens bedömning' });
    const efter = (await fraga(k, 'p01', 'RETTS')).data;
    expect(efter.antal).toBe(1);
    expect(efter.traffar[0]).toMatchObject({ typ: 'anteckning', rubrik: 'Akutanteckning', vardenhet: { id: 'uso-akut' } });
    expect(markerat(efter.traffar[0])).toEqual(['retts']);
  });

  test('skyddad identitet: svaret innehåller varken namn eller personnummer', async () => {
    const k = await inloggad('lak-akut');
    const d = (await fraga(k, 'p03', 'smärta')).data;
    expect(JSON.stringify(d)).not.toMatch(/Engberg|Malin|19840416|840416/);
  });

  test('yrkesrollen: undersköterskan hittar omvårdnad men inte läkaranteckningar eller diagnoser, vårdadministratören nekas', async () => {
    const u = await inloggad('usk-kard');
    const d = (await fraga(u, 'p01', 'syremättnad')).data;
    expect(d.traffar.some(t => t.typ === 'anteckning')).toBe(true);
    expect(d.traffar.filter(t => t.typ === 'anteckning').every(t => t.rubrik === 'Omvårdnadsanteckning')).toBe(true);
    expect((await fraga(u, 'p01', 'förmaksflimmer')).data.traffar.some(t => t.typ === 'diagnos')).toBe(false);
    const l = await inloggad('lak-kard');
    expect((await fraga(l, 'p01', 'förmaksflimmer')).data.traffar.some(t => t.typ === 'diagnos')).toBe(true);
    const a = await inloggad('adm-kard');
    expect((await fraga(a, 'p01', 'blodtryck')).status).toBe(403);
    expect((await fraga(l, 'p01', 'x')).status).toBe(400);
  });

  test('sökningen loggas som läsning med söktermen och antalet synliga träffar i syftet', async () => {
    const k = await inloggad('lak-kard');
    const d = (await fraga(k, 'p01', 'Waran')).data;
    const rad = sandlada(app, k).db.query("SELECT * FROM atkomstlogg WHERE resurs = 'journalsok' ORDER BY id DESC").get();
    expect(rad).toMatchObject({ patient_id: 'p01', handling: 'las_oversikt', resultat: 'tillaten' });
    expect(rad.syfte).toBe(`Sökning i journalen: "Waran" (${d.antal} ${d.antal === 1 ? 'träff' : 'träffar'})`);
    // Spärrade träffar räknas inte i loggen heller.
    await fraga(k, 'p04', 'sertralin');
    expect(sandlada(app, k).db.query("SELECT syfte FROM atkomstlogg WHERE resurs = 'journalsok' AND patient_id = 'p04' ORDER BY id DESC").get().syfte).toBe('Sökning i journalen: "sertralin" (0 träffar)');
  });

  test('sökfunktionen prövar varje rad i behörighetsmotorn innan den jämförs med frågan', () => {
    const db = nyDb();
    const a = atk(db, 'lak-kard', 'p04');
    const d = sok(a, 'MADRS');
    expect(d.antal).toBe(0);
    expect(a.doldaSparr).toBe(true);
  });
});
