// Runda 9, r4: informationsstrukturen (NI, Sussa 5.1.3.1 och 5.1.3.3), nationellt fackspråk (5.1.3.2 och 5.1.3.4),
// förvaltningen av kodverk (5.1.3.5), masterdatan (5.1.2.1 till 5.1.2.3) och migreringen (5.1.1.2). Testnamnen står
// i src/sussa/runda9-r4.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, personal, atk } from './hjalp.js';
import { T } from '../src/sussa/runda9-r4.js';
import * as ni from '../src/informationsmodell.js';
import * as nf from '../src/fackssprak.js';
import * as kv from '../src/kodverksforvaltning.js';
import * as masterdata from '../src/masterdata.js';
import * as konfiguration from '../src/konfiguration.js';
import * as migrering from '../src/migreringsimport.js';
import * as mr from '../src/myndighetsrapport.js';
import { fhirTyper } from '../src/arkitektur-rutter.js';
import { MALLAR } from '../src/journal.js';
import * as journal from '../src/journal.js';
import { harVardrelation } from '../src/atkomst.js';
import { KVA, ICD10SE, SYSTEM } from '../src/kodverk.js';
import { addDagar, datumAv } from '../src/db.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const namn = (t) => t.split(' > ').slice(1).join(' > ');
const fel = (fn) => { try { fn(); } catch (e) { return e; } throw new Error('inget fel'); };
const NU = new Date('2026-11-08T09:00:00Z');
const sysf = (db) => personal(db, 'sysf');
const sysf2 = (db) => personal(db, 'sysf-2');

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Informationsstruktur', () => {
  test(namn(T.niKlasser), () => {
    expect(ni.NI).toMatchObject({ version: '2023:2', utgivare: 'Socialstyrelsen' });
    expect(Object.keys(ni.KLASSER).length).toBe(24);
    for (const [k, d] of Object.entries(ni.KLASSER)) expect(d.toLocaleLowerCase('sv')).toContain(`klassen ${k.toLocaleLowerCase('sv')}`);
    const anvanda = [...Object.values(ni.TABELLER).map(t => t.klass), ...Object.values(ni.FHIR), ...Object.values(ni.BEGREPP).map(b => b.klass), ni.ALLMAN];
    for (const k of anvanda) expect(Object.keys(ni.KLASSER)).toContain(k);
    for (const t of Object.values(ni.TABELLER)) if (t.begrepp) expect(Object.keys(ni.BEGREPP)).toContain(t.begrepp);
    expect(ni.BEGREPP.vardkontakt.definition).toBe('kontakt mellan patient och hälso- och sjukvårdspersonal då hälso- och sjukvård utförs');
  });

  test(namn(T.niTabeller), () => {
    const db = nyDb();
    const k = ni.klassaTabeller(db);
    const tabeller = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
    for (const t of tabeller) {
      const patient = db.query(`PRAGMA table_info("${t}")`).all().some(c => /patient_id$/.test(c.name));
      if (patient) expect(k.find(x => x.tabell === t)?.klass).toBeDefined();
    }
    // Varje uttryckligt klassad tabell finns, och journalens kärna har sin egen klass.
    for (const t of Object.keys(ni.TABELLER)) expect(tabeller).toContain(t);
    const klass = (t) => k.find(x => x.tabell === t);
    expect([klass('diagnoser').klass, klass('vardkontakter').klass, klass('remisser').klass, klass('ordinationer').klass, klass('anteckningar').klass]).toEqual(['Observation', 'Vårdkontakt', 'Remiss', 'Beslut', 'Dokument']);
    // En ny tabell med patientuppgifter som ingen har klassat får den allmänna klassen och visas.
    db.exec('CREATE TABLE ny_journaldel (id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL)');
    const m = ni.modell(db, fhirTyper());
    expect(m.tabeller.find(t => t.tabell === 'ny_journaldel')).toMatchObject({ klass: 'Uppgift i patientjournal', allman: true });
    expect(m.sammanfattning.allmantKlassade).toContain('ny_journaldel');
  });

  test(namn(T.niFhir), () => {
    const typer = fhirTyper();
    expect(typer).toEqual(expect.arrayContaining(['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'Composition', 'ServiceRequest', 'DiagnosticReport']));
    const f = ni.klassaFhir(typer);
    for (const r of f) expect(Object.keys(ni.KLASSER)).toContain(r.klass);
    expect(f.filter(r => r.allman).map(r => r.typ)).toEqual([]);
    expect(f.find(r => r.typ === 'Encounter').klass).toBe('Vårdkontakt');
    // NI:s attribut pekar på kolumner som finns i tabellen.
    const db = nyDb();
    for (const [t, d] of Object.entries(ni.TABELLER)) {
      if (!d.falt) continue;
      const kol = db.query(`PRAGMA table_info("${t}")`).all().map(c => c.name);
      for (const c of Object.values(d.falt).flat()) expect(kol).toContain(c);
    }
  });

  test(namn(T.niApi), async () => {
    const k = klient(app);
    expect((await k.get('/api/informationsmodell')).status).toBe(401);
    await k.logga('ssk-kard');
    const r = await k.get('/api/informationsmodell');
    expect(r.status).toBe(200);
    expect(r.data.ni.version).toBe('2023:2');
    expect(r.data.klasser.find(x => x.namn === 'Vårdkontakt')).toMatchObject({ tabeller: expect.arrayContaining(['vardkontakter']), fhir: expect.arrayContaining(['Encounter']) });
    const text = JSON.stringify(r.data);
    for (const s of ['194502024732', 'Gunnar', 'Åkesson']) expect(text).not.toContain(s);
  });
});

describe('Nationellt fackspråk', () => {
  test(namn(T.nfKoder), () => {
    expect(nf.verhoeffGiltig('271649006')).toBe(true);
    expect(nf.verhoeffGiltig('271649007')).toBe(false);
    expect(nf.provaBegrepp('271649007').varfor).toContain('Kontrollsiffran');
    expect(nf.provaBegrepp('53851000052106')).toEqual({ ok: true, utgava: 'nationell', namnrymd: '1000052' });
    const d = nf.delmangd();
    expect(d.length).toBeGreaterThan(20);
    for (const k of d) {
      expect(nf.provaBegrepp(k.code)).toMatchObject({ ok: true, utgava: 'internationell' });
      expect(k.display).toMatch(/^[A-Z][A-Za-z ,-]+$/);
      expect(k.text).toMatch(/\S/);
    }
    for (const k of nf.svenskaKoder()) expect(nf.provaBegrepp(k.code).ok).toBe(true);
    expect(SYSTEM.snomed).toBe('http://snomed.info/sct');
    expect(nf.KONTROLLERAD_MOT).toContain('900000000000207008/version/20250201');
  });

  test(namn(T.nfSokord), async () => {
    const alla = [...new Set(MALLAR.flatMap(m => m.sokord ?? []))];
    for (const s of alla) {
      expect(Object.hasOwn(nf.SOKORD, s)).toBe(true);
      const k = nf.SOKORD[s];
      if (!k.code) expect(k.ingen.length).toBeGreaterThan(30);
    }
    expect(nf.sokordKod('Bedömning')).toEqual({ system: 'http://snomed.info/sct', code: '424836000', display: 'Assessment section' });
    expect(nf.sokordKod('Andning/cirkulation')).toBeNull();
    const k = klient(app);
    await k.logga('lak-kard');
    const b = (await k.get('/fhir/Composition?patient=p01')).data;
    const sektioner = b.entry.flatMap(e => e.resource.section ?? []);
    const bed = sektioner.find(s => s.title === 'Bedömning');
    expect(bed.code).toEqual({ coding: [{ system: 'http://snomed.info/sct', code: '424836000', display: 'Assessment section' }], text: 'Bedömning' });
    for (const s of sektioner) if (!nf.sokordKod(s.title)) expect(s.code).toBeUndefined();
  });

  test(namn(T.nfDelar), async () => {
    const o = nf.oversikt();
    expect(o.delar.map(d => [d.del, d.slag])).toEqual([['Snomed CT', 'begreppssystem'], ['ICD-10-SE', 'klassifikation'], ['KVÅ', 'klassifikation'], ['Socialstyrelsens termbank', 'termer']]);
    expect(o.delar.find(d => d.del === 'ICD-10-SE').antal).toBe(Object.keys(ICD10SE).length);
    expect(o.termer.find(t => t.term === 'remiss').definition).toContain('vårdbegäran från hälso- och sjukvårdspersonal');
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.get('/api/fackssprak');
    expect(r.status).toBe(200);
    expect(r.data.sokordUtanKod.map(s => s.sokord)).toEqual(['Stöd', 'Kommentar', 'Andning/cirkulation', 'Hud/vävnad', 'Närstående']);
  });

  test(namn(T.nfAtgard), () => {
    for (const kod of Object.keys(nf.ATGARDER)) expect(Object.keys(KVA)).toContain(kod);
    const d = nf.delmangd();
    expect(d.find(x => x.grupp === 'åtgärd' && x.kva === 'QD008').code).toBe('304495004');
    expect(d.filter(x => x.grupp === 'fynd').map(x => x.code)).toEqual(expect.arrayContaining(['264868006', '112283007']));
    expect(d.filter(x => x.grupp === 'provtyp').map(x => x.code)).toEqual(expect.arrayContaining(['119297000', '122575003']));
  });
});

const ICD_2027 = Object.entries(ICD10SE).filter(([k]) => k !== 'H66.9').map(([k, t]) => `${k};${k === 'E03.9' ? 'Hypotyreos, ospecificerad (ny text)' : t}`).concat(['U07.1;Covid-19, virus identifierat']).join('\n');

describe('Förvaltning av kodverk', () => {
  test(namn(T.kvRegister), () => {
    const db = nyDb();
    const o = kv.oversikt(db, sysf(db), NU);
    const icd = o.kodverk.find(k => k.id === 'icd10se');
    expect(icd).toMatchObject({ namn: 'ICD-10-SE', version: '2026', giltigFran: '2026-01-01', utgivare: 'Socialstyrelsen', nf: true, kalla: 'Inbyggd i Vårdkällan', antal: Object.keys(ICD10SE).length });
    for (const id of ['kva', 'snomed', 'atc', 'npu', 'loinc']) expect(o.kodverk.find(k => k.id === id)).toMatchObject({ version: expect.any(String), giltigFran: expect.stringMatching(/^\d{4}-\d\d-\d\d$/) });
    expect(o.kodverk.find(k => k.id === 'npu').antal).toBeGreaterThan(5);
    const lokala = o.kodverk.filter(k => k.slag === 'lokalt');
    expect(lokala.map(k => k.id)).toEqual(expect.arrayContaining(['vk:kalla', 'vk:remisstatus', 'vk:uppmarksamhet']));
    expect(lokala.every(k => k.inbyggd && k.antal > 0)).toBe(true);
    // Ett inbyggt lokalt kodverk ändras med en ny version av systemet, inte här.
    expect(fel(() => kv.forhandsvisa(db, sysf(db), { kodverk: 'vk:kalla', version: '2', koder: 'x;y' }, NU)).message).toContain('Vårdkällans egen kod');
  });

  test(namn(T.kvJamfor), () => {
    const db = nyDb();
    const n = db.query("SELECT count(*) AS n FROM diagnoser WHERE kod = 'H66.9'").get().n;
    expect(n).toBeGreaterThan(0);
    const f = kv.forhandsvisa(db, sysf(db), { kodverk: 'icd10se', version: '2027', giltigFran: '2027-01-01', koder: ICD_2027 }, NU);
    expect(f.ok).toBe(true);
    expect(f.jamforelse.nya).toEqual([{ kod: 'U07.1', text: 'Covid-19, virus identifierat' }]);
    expect(f.jamforelse.andrade).toEqual([{ kod: 'E03.9', fore: 'Hypotyreos, ospecificerad', efter: 'Hypotyreos, ospecificerad (ny text)' }]);
    expect(f.jamforelse.borttagna.map(b => b.kod)).toEqual(['H66.9']);
    // Antalet räknas bara inom systemförvaltarens egen vårdgivare, och ett antal under 5 visas som färre än 5.
    expect(n).toBeLessThan(5);
    expect(f.effekt.join(' ')).toContain('Färre än 5 diagnoser hos den egna vårdgivaren har en sådan kod. De står kvar som de dokumenterades.');
    const ins = db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', ?, 'H66.9', 'Mellanöreinflammation', 'bi', '2026-01-01')");
    for (let i = 0; i < 6; i++) ins.run('kommun-demo');
    const k = (x) => kv.forhandsvisa(db, sysf(db), { kodverk: 'icd10se', version: '2027', giltigFran: '2027-01-01', koder: ICD_2027 }, NU).effekt.join(' ').includes(x);
    expect(k('Färre än 5 diagnoser hos den egna vårdgivaren')).toBe(true);
    for (let i = 0; i < 6; i++) ins.run('uso-kard');
    expect(k(`${n + 6} diagnoser hos den egna vårdgivaren har en sådan kod`)).toBe(true);
    // Spärren gäller varje kod för sig. Annars går det att jämföra två förhandsvisningar, med och utan en kod, och
    // räkna ut hur många diagnoser en ovanlig kod har.
    const db2 = nyDb();
    const ins2 = db2.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', 'uso-kard', ?, 'Demo', 'bi', '2026-01-01')");
    for (let i = 0; i < 7; i++) ins2.run('X99.7');
    for (let i = 0; i < 2; i++) ins2.run('X99.8');
    for (let i = 0; i < 3; i++) ins2.run('X99.9');
    const anv = (koder) => kv.anvandning(db2, 'icd10se', koder, sysf(db2));
    expect(anv(['X99.7'])).toMatchObject({ antal: 7, text: '7 diagnoser hos den egna vårdgivaren har en sådan kod.' });
    const med = anv(['X99.7', 'X99.8']);
    expect(med.antal).toBe(7);
    expect(med.text).toBe('Minst 7 diagnoser hos den egna vårdgivaren har en sådan kod. Koder med färre än 5 räknas inte med, så att antalet inte pekar ut enskilda patienter.');
    expect(anv(['X99.8'])).toMatchObject({ antal: null, text: 'Färre än 5 diagnoser hos den egna vårdgivaren har en sådan kod.' });
    // Två ovanliga koder tillsammans har 5, men summan visas inte.
    expect(anv(['X99.8', 'X99.9'])).toMatchObject({ antal: null, text: 'Färre än 5 diagnoser per kod hos den egna vårdgivaren har en sådan kod.' });
    const p = kv.forhandsvisa(db, sysf(db), { kodverk: 'icd10se', version: '2027', koder: 'I10.9;Hypertoni\nI10.9;Hypertoni igen\nhej;Fel form\nE11.9;' }, NU);
    expect(p.ok).toBe(false);
    expect(p.fel).toEqual([
      'Rad 2: I10.9 finns två gånger. En kod får bara ha en text.',
      'Rad 3: hej har inte formen för ICD-10-SE, som är en bokstav, två siffror och en decimaldel, till exempel I10.9.',
      'Rad 4: E11.9 saknar text. Texten är det användaren ser, så den behövs.',
    ]);
    expect(kv.forhandsvisa(db, sysf(db), { kodverk: 'snomed', version: '20260301', koder: '424836001;Assessment section' }, NU).fel[0]).toContain('kontrollsiffra');
    // Förhandsvisningen ger bara koder och antal, inga patientuppgifter.
    expect(JSON.stringify(f)).not.toContain('p0');
  });

  test(namn(T.kvFyraOgon), () => {
    const db = nyDb();
    const { utgava } = kv.foresla(db, sysf(db), { kodverk: 'icd10se', version: '2027', giltigFran: '2026-11-10', koder: ICD_2027, motivering: 'Socialstyrelsen har gett ut ICD-10-SE 2027.' }, NU);
    expect(utgava).toMatchObject({ status: 'vantar', egen: true, kanGodkanna: false, jamforelse: { nya: 1, andrade: 1, borttagna: 1 } });
    expect(fel(() => kv.godkann(db, sysf(db), utgava.id, {}, NU)).message).toContain('Fyra ögon');
    expect(fel(() => kv.foresla(db, sysf(db), { kodverk: 'icd10se', version: '2028', koder: ICD_2027, motivering: 'x' }, NU)).status).toBe(409);
    expect(fel(() => kv.foresla(db, sysf2(db), { kodverk: 'kva', version: '2027', giltigFran: '2026-01-01', koder: 'QD008;x', motivering: 'x' }, NU)).message).toContain('bakåt i tiden');
    expect(fel(() => kv.foresla(db, sysf2(db), { kodverk: 'kva', version: '2027', koder: 'QD008;x' }, NU)).message).toContain('Skriv varför');
    // Godkänns den efter det föreslagna datumet gäller den från godkännandet.
    const sent = new Date('2026-11-12T08:00:00Z');
    const g = kv.godkann(db, sysf2(db), utgava.id, {}, sent).utgava;
    expect(g).toMatchObject({ status: 'godkand', gallerFran: '2026-11-12' });
    expect(kv.gallande(db, 'icd10se', NU).version).toBe('2026');
    expect(kv.gallande(db, 'icd10se', sent).version).toBe('2027');
    expect(kv.text(db, 'icd10se', 'U07.1', sent)).toBe('Covid-19, virus identifierat');
    expect(kv.text(db, 'icd10se', 'U07.1', NU)).toBeNull();
    expect(db.query("SELECT beskrivning FROM sakerhetslogg WHERE typ = 'andrad_installning' ORDER BY id DESC LIMIT 1").get().beskrivning).toContain('ICD-10-SE 2027 gäller från 2026-11-12');
  });

  test(namn(T.kvDiagnos), async () => {
    const k = klient(app);
    await k.logga('sysf');
    const f = await k.post('/api/kodverk/utgavor', { kodverk: 'icd10se', version: '2027', giltigFran: datumAv(new Date()), koder: ICD_2027, motivering: 'Ny utgåva.' });
    expect(f.status).toBe(201);
    await k.logga('sysf-2');
    expect((await k.post(`/api/kodverk/utgavor/${f.data.utgava.id}/godkann`, {})).status).toBe(200);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id LIKE 'uso-kard%' ORDER BY id DESC LIMIT 1").get().id;
    const borta = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'H66.9' });
    expect(borta.status).toBe(400);
    expect(borta.data.fel).toContain('Koden H66.9 finns inte bland de koder i ICD-10-SE 2027 som gäller sedan');
    expect(borta.data.fel).toContain('står kvar som de dokumenterades');
    const ny = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'U07.1' });
    expect(ny.status).toBe(201);
    expect(ny.data.text).toBe('Covid-19, virus identifierat');
    const val = (await k.get('/api/rapportering/rattning/val')).data.diagnoser.map(d => d.kod);
    expect(val).toContain('U07.1');
    expect(val).not.toContain('H66.9');
    // Diagnoserna som redan hade den borttagna koden står kvar.
    expect(db.query("SELECT count(*) AS n FROM diagnoser WHERE kod = 'H66.9'").get().n).toBeGreaterThan(0);
    expect(mr.diagnoslista(nyDb()).map(d => d.kod)).toContain('H66.9');
  });

  test(namn(T.kvLokalt), async () => {
    const db = nyDb();
    const f = kv.forhandsvisa(db, sysf(db), { kodverk: 'nytt', namn: 'Besöksorsaker på akuten', version: '1', koder: 'BRO;Bröstsmärta\nFAL;Fall\nAND;Andningsbesvär' }, NU);
    expect(f).toMatchObject({ kodverk: 'lokal:besoksorsaker-pa-akuten', ok: true, antal: 3 });
    const { utgava } = kv.foresla(db, sysf(db), { kodverk: 'nytt', namn: 'Besöksorsaker på akuten', version: '1', koder: 'BRO;Bröstsmärta\nFAL;Fall\nAND;Andningsbesvär', motivering: 'Akutens triage.' }, NU);
    expect(fel(() => kv.foresla(db, sysf(db), { kodverk: 'nytt', namn: 'Besöksorsaker på akuten', version: '2', koder: 'X;y', motivering: 'x' }, NU)).status).toBe(409);
    kv.godkann(db, sysf2(db), utgava.id, {}, NU);
    const dagen = new Date(`${addDagar(datumAv(NU), 1)}T09:00:00Z`);
    expect(kv.koderUt(db, 'lokal:besoksorsaker-pa-akuten', dagen)).toMatchObject({ namn: 'Besöksorsaker på akuten', version: '1', koder: [{ kod: 'BRO', text: 'Bröstsmärta' }, { kod: 'FAL', text: 'Fall' }, { kod: 'AND', text: 'Andningsbesvär' }] });
    expect(kv.oversikt(db, sysf(db), dagen).kodverk.find(k => k.id === 'lokal:besoksorsaker-pa-akuten')).toMatchObject({ slag: 'lokalt', version: '1', antal: 3 });
    // En ny utgåva av det lokala kodverket jämförs med den som gäller.
    const v2 = kv.forhandsvisa(db, sysf(db), { kodverk: 'lokal:besoksorsaker-pa-akuten', version: '2', giltigFran: addDagar(datumAv(NU), 2), koder: 'BRO;Bröstsmärta\nFAL;Fall' }, dagen);
    expect(v2.jamforelse.borttagna).toEqual([{ kod: 'AND', text: 'Andningsbesvär' }]);
  });

  test(namn(T.kvApi), async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.get('/api/kodverk')).status).toBe(403);
    expect((await k.post('/api/kodverk/forhandsvisa', { kodverk: 'kva', version: '2027', koder: 'QD008;x' })).status).toBe(403);
    expect((await k.get('/api/kodverk/icd10se/koder')).data.koder.length).toBe(Object.keys(ICD10SE).length);
    await k.logga('sysf');
    const f = await k.post('/api/kodverk/utgavor', { kodverk: 'kva', version: '2027', koder: Object.entries(KVA).map(([a, b]) => `${a};${b}`).join('\n') + '\nQD009;Övervakning, demo', motivering: 'Ny utgåva.' });
    expect(f.status).toBe(201);
    expect((await k.post(`/api/kodverk/utgavor/${f.data.utgava.id}/avsluta`, {})).data.utgava.status).toBe('aterkallad');
    const o = (await k.get('/api/kodverk')).data;
    expect(o.historik[0]).toMatchObject({ kodverk: 'kva', version: '2027', status: 'aterkallad', foreslagenAv: 'Tomas Lindh', beslutadAv: 'Tomas Lindh' });
    expect(sandlada(app, k).db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ?").get(`kodverk:${f.data.utgava.id}`).n).toBe(2);
  });
});

const ingenSynk = (db) => db.query('SELECT count(*) AS n FROM masterdata_synk').get().n;
describe('Masterdata', () => {
  test(namn(T.mdKodverk), () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    // Filadaptern ger samma utgåvor som är inbyggda, så ingenting läses in.
    expect(masterdata.synkronisera(db, 'kodverk', f, NU)).toMatchObject({ nya: [], fel: [] });
    const kalla = { id: 'utgivare', namn: 'Utgivarnas filer (simulerade)', kodverk: () => [...f.kodverk().filter(u => u.kodverk !== 'icd10se'), { kodverk: 'icd10se', version: '2027', giltigFran: '2027-01-01', koder: kv.tolka(ICD_2027) }] };
    const r = masterdata.synkronisera(db, 'kodverk', kalla, NU);
    expect(r.nya).toEqual(['icd10se 2027']);
    const o = kv.oversikt(db, sysf(db), NU);
    expect(o.attGodkanna[0]).toMatchObject({ kodverk: 'icd10se', version: '2027', foreslagenAv: 'Utgivarnas filer (simulerade)', kanGodkanna: true, jamforelse: { nya: 1, andrade: 1, borttagna: 1 } });
    expect(kv.godkann(db, sysf(db), o.attGodkanna[0].id, {}, NU).utgava.gallerFran).toBe('2027-01-01');
    // Samma utgåva igen ändrar ingenting.
    expect(masterdata.synkronisera(db, 'kodverk', kalla, NU).nya).toEqual([]);
  });

  test(namn(T.mdLakemedel), () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    const fore = masterdata.synkronisera(db, 'lakemedel', f, NU);
    expect(fore).toMatchObject({ nya: [], andrade: [], fel: [] });
    expect(fore.oforandrade).toBe(f.lakemedel().length);
    const npl = { id: 'npl', namn: 'NPL (simulerad)', lakemedel: () => [...f.lakemedel().filter(l => l.id !== 'VK-NPL-0003').map(l => (l.id === 'VK-NPL-0001' ? { ...l, namn: 'Waran (nytt namn)' } : l)),
      { id: 'VK-NPL-9001', npl: '20260101000017', namn: 'Demoprodukt', substans: 'paracetamol', styrka: '500 mg', form: 'tablett', atc: 'N02BE01' }] };
    const r = masterdata.synkronisera(db, 'lakemedel', npl, NU);
    expect(r).toMatchObject({ nya: ['VK-NPL-9001'], andrade: ['VK-NPL-0001'], saknasIKallan: ['VK-NPL-0003'] });
    expect(db.query("SELECT namn FROM katalog WHERE id = 'VK-NPL-0001'").get().namn).toBe('Waran (nytt namn)');
    expect(db.query("SELECT 1 FROM katalog WHERE id = 'VK-NPL-0003'").get()).toBeTruthy();
    expect(masterdata.synkronisera(db, 'lakemedel', { ...npl, lakemedel: () => [{ id: 'x', npl: '123', namn: 'a', substans: 'b', form: 'c', atc: 'N02BE01' }] }, NU).fel[0]).toContain('NPL-id 123 har fel form');
  });

  test(namn(T.mdListning), () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    expect(masterdata.synkronisera(db, 'listning', f, NU)).toMatchObject({ nya: [], andrade: [], fel: [] });
    expect(harVardrelation(db, 'p01', 'vc-kumla', NU)).toBe(false);
    const ltj = { id: 'lt', namn: 'Listningstjänsten (simulerad)', listning: () => f.listning().map(l => (l.identitet === '194502024732' ? { ...l, enhetId: 'vc-kumla', fran: '2026-11-01' } : l)) };
    expect(masterdata.synkronisera(db, 'listning', ltj, NU).andrade).toEqual(['p01']);
    expect(harVardrelation(db, 'p01', 'vc-kumla', NU)).toBe(true);
    expect(db.query("SELECT enhet_id, fran FROM listningar WHERE patient_id = 'p01'").all()).toEqual([{ enhet_id: 'vc-kumla', fran: '2026-11-01' }]);
  });

  test(namn(T.mdScheman), () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    for (const del of ['scheman', 'prislistor']) expect(masterdata.synkronisera(db, del, f, NU)).toMatchObject({ nya: [], andrade: [], fel: [] });
    const b = masterdata.synkronisera(db, 'bestallare', f, NU);
    expect(b.nya.length).toBe(f.bestallare().length);
    expect(db.query("SELECT kundnummer FROM bestallarregister WHERE enhet_id = 'uso-kard'").get().kundnummer).toMatch(/^DEMO-K\d{3}$/);
    const ff = masterdata.synkronisera(db, 'forrad', f, NU);
    expect(ff.nya).toContain('HM-KRYCK|uso-ort');
    const ny = {
      id: 'sys', namn: 'Regionens system (simulerade)',
      scheman: () => [...f.scheman(), { id: 'sch-ny', enhetId: 'uso-kard-mott', personalId: 'lak-kard', yrkesroll: 'lakare' }],
      prislistor: () => [...f.prislistor(), { enhetId: 'uso-kard', version: 99, giltigFran: '2027-01-01', poster: { vardkontakt: { besok: { text: 'Besök', pris: 2000 } } } }],
      bestallare: () => f.bestallare().filter(x => x.enhetId !== 'uso-kard'),
      forrad: () => f.forrad().map(x => (x.artikel === 'HM-KRYCK' ? { ...x, saldo: 2 } : x)),
    };
    expect(masterdata.synkronisera(db, 'scheman', ny, NU).nya).toEqual(['sch-ny']);
    expect(masterdata.synkronisera(db, 'prislistor', ny, NU).nya).toEqual(['uso-kard 99']);
    expect(db.query("SELECT orsak FROM prislistor WHERE enhet_id = 'uso-kard' AND version = 99").get().orsak).toBe('Inläst från Regionens system (simulerade)');
    expect(masterdata.synkronisera(db, 'bestallare', ny, NU).inaktiverade).toEqual(['best-uso-kard']);
    expect(db.query("SELECT aktiv FROM bestallarregister WHERE id = 'best-uso-kard'").get().aktiv).toBe(0);
    expect(masterdata.synkronisera(db, 'forrad', ny, NU).andrade).toEqual(['HM-KRYCK|uso-ort']);
    expect(db.query("SELECT saldo FROM forradstillgang WHERE artikel = 'HM-KRYCK'").get().saldo).toBe(2);
    // En version av en prislista ändras aldrig.
    const andrad = { ...ny, prislistor: () => [{ enhetId: 'uso-kard', version: 99, giltigFran: '2027-01-01', poster: { vardkontakt: { besok: { text: 'Besök', pris: 1 } } } }] };
    expect(masterdata.synkronisera(db, 'prislistor', andrad, NU).fel[0]).toContain('En version ändras aldrig');
    expect(masterdata.synkronisera(db, 'forrad', { ...ny, forrad: () => [{ artikel: 'A', enhetId: 'uso-ort', saldo: -1 }] }, NU).fel[0]).toContain('saldot -1');
    for (const del of Object.keys(masterdata.KONTRAKT)) expect(masterdata.validera(del, f[del]()).fel).toEqual([]);
  });

  test(namn(T.mdSchema), () => {
    const db = nyDb();
    const r0 = masterdata.synkOmDags(db, NU);
    // En ny sandlåda: seeden är den första inläsningen, och beställarregistret och förrådet läses in direkt.
    expect(r0.map(r => r.del).sort()).toEqual(['bestallare', 'forrad']);
    expect(masterdata.synkOmDags(db, new Date(NU.getTime() + 23 * 3600_000))).toEqual([]);
    const dygn = masterdata.synkOmDags(db, new Date(NU.getTime() + 24 * 3600_000 + 1000));
    expect(dygn.length).toBe(Object.keys(masterdata.KONTRAKT).length);
    // Systemförvaltningen ändrar intervallet med fyra ögon.
    const { andring } = konfiguration.foresla(db, sysf(db), { nyckel: 'masterdata.synk_timmar', varde: 6, giltigFran: datumAv(NU), motivering: 'Personalen ska följa med snabbare.' }, NU);
    konfiguration.godkann(db, sysf2(db), andring.id, {}, NU);
    expect(konfiguration.varde(db, 'masterdata.synk_timmar', NU)).toBe(6);
    expect(masterdata.synkOmDags(db, new Date(NU.getTime() + 30 * 3600_000 + 2000)).length).toBe(Object.keys(masterdata.KONTRAKT).length);
    expect(Object.keys(konfiguration.MASTERDATA_DELAR)).toEqual(Object.keys(masterdata.KONTRAKT));
    expect(konfiguration.parametrar()['masterdata.synk_timmar']).toMatchObject({ standard: 24, omrade: 'masterdata' });
  });

  test(namn(T.mdParameter), () => {
    const db = nyDb();
    masterdata.synkOmDags(db, NU);
    const { andring } = konfiguration.foresla(db, sysf(db), { nyckel: 'masterdata.extern.prislistor', varde: 'nej', giltigFran: datumAv(NU), motivering: 'Prislistorna förvaltas av ekonomen i Vårdkällan.' }, NU);
    expect(andring.vardeText).toBe('Förvaltas i Vårdkällan');
    konfiguration.godkann(db, sysf2(db), andring.id, {}, NU);
    expect(masterdata.extern(db, 'prislistor', NU)).toBe(false);
    const dygn = masterdata.synkOmDags(db, new Date(NU.getTime() + 25 * 3600_000));
    expect(dygn.map(r => r.del)).not.toContain('prislistor');
    expect(dygn.length).toBe(Object.keys(masterdata.KONTRAKT).length - 1);
    expect(masterdata.oversikt(db, NU).find(d => d.del === 'prislistor')).toMatchObject({ extern: false, forvaltning: 'Förvaltas i Vårdkällan' });
  });

  test(namn(T.mdTillganglig), () => {
    const db = nyDb();
    const f = masterdata.filadapter();
    masterdata.synkronisera(db, 'personal', f, NU);
    const fore = db.query('SELECT * FROM personal ORDER BY id').all();
    const nere = { id: 'hsa', namn: 'HSA-katalogen (simulerad)', personal: () => { throw new Error('anslutningen bröts'); } };
    const sen = new Date(NU.getTime() + 3600_000);
    const r = masterdata.synkronisera(db, 'personal', nere, sen);
    expect(r).toMatchObject({ tillganglig: false, fel: ['Källan svarade inte: anslutningen bröts'] });
    expect(db.query('SELECT * FROM personal ORDER BY id').all()).toEqual(fore);
    const forra = masterdata.bytKalla('personal', nere);
    try {
      const o = masterdata.oversikt(db, sen).find(d => d.del === 'personal');
      expect(o.avvikelse).toContain('HSA-katalogen (simulerad) svarade inte vid inläsningen');
      expect(o.avvikelse).toContain(`Uppgifterna från ${NU.toISOString().slice(0, 16).replace('T', ' ')} används tills källan svarar`);
      expect(o.antal).toBeNull();
      // Efter ett misslyckat försök försöker schemat igen efter en timme, inte efter ett dygn.
      expect(masterdata.synkOmDags(db, new Date(sen.getTime() + 3600_000 + 1000)).map(x => x.del)).toContain('personal');
    } finally { masterdata.bytKalla('personal', forra); }
    // Inloggningen och journalen fungerar med de senast giltiga uppgifterna.
    expect(personal(db, 'lak-kard').aktiv).toBe(1);
  });

  test(namn(T.mdApi), async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/masterdata/forrad/synkronisera', {})).status).toBe(403);
    await k.logga('sysf');
    const r = await k.post('/api/masterdata/forrad/synkronisera', {});
    expect(r.status).toBe(200);
    expect(r.data.delar.find(d => d.del === 'forrad')).toMatchObject({ extern: true, senaste: { tillganglig: true } });
    expect((await k.post('/api/masterdata/constructor/synkronisera', {})).status).toBe(404);
    expect(ingenSynk(sandlada(app, k).db)).toBeGreaterThan(2);
  });
});

// En migreringsfil: ett simulerat uttag ur VAS som FHIR Bundle.
const PNR = 'http://electronichealth.se/identifier/personnummer';
const tag = (hsa) => ({ tag: [{ system: migrering.HSA_SYSTEM, code: hsa }] });
const uttag = ({ antal = {}, extra = [] } = {}) => ({
  resourceType: 'Bundle', type: 'collection',
  entry: [
    { resource: { resourceType: 'Parameters', parameter: [{ name: 'kalla', valueString: 'VAS' }, ...Object.entries(antal).map(([t, n]) => ({ name: `antal.${t}`, valueInteger: n }))] } },
    { resource: { resourceType: 'Encounter', meta: tag('SE2321000164-VK0120'), status: 'finished', class: { code: 'AMB' }, subject: { identifier: { system: PNR, value: '194502024732' } }, period: { start: '2012-05-02T08:00:00Z', end: '2012-05-02T08:30:00Z' }, reasonCode: [{ text: 'Uppföljning av hjärtsvikt' }] } },
    { resource: { resourceType: 'Condition', meta: tag('SE2321000164-VK0120'), subject: { identifier: { system: PNR, value: '194502024732' } }, code: { coding: [{ system: 'urn:oid:1.2.752.116.1.1.1', code: 'I50.9', display: 'Hjärtsvikt, ospecificerad' }] }, recordedDate: '2012-05-02' } },
    { resource: { resourceType: 'Observation', meta: tag('SE2321000164-VK0120'), status: 'final', subject: { identifier: { system: PNR, value: '194502024732' } }, code: { coding: [{ system: 'http://npu-terminology.org', code: 'NPU19748' }] }, valueQuantity: { value: 12 }, effectiveDateTime: '2012-05-02T07:40:00Z' } },
    { resource: { resourceType: 'Condition', meta: tag('SE2321000164-VK0120'), subject: { identifier: { system: PNR, value: '191212121212' } }, code: { coding: [{ system: 'urn:oid:1.2.752.116.1.1.1', code: 'I10.9' }] }, recordedDate: '2012-05-02' } },
    ...extra,
  ],
});

// Runda 9, r4: en fil läses in när en annan systemförvaltare har godkänt den förhandsvisade filen (fyra ögon).
const inlast = (db, fil, nu = NU) => migrering.godkann(db, sysf2(db), migrering.foresla(db, sysf(db), fil, nu).fil.id, {}, nu);

describe('Migrering', () => {
  test(namn(T.mgImport), () => {
    const db = nyDb();
    const fore = db.query("SELECT antal_kalla FROM migrering WHERE datatyp = 'diagnoser' AND kalla = 'migrerad:VAS'").get().antal_kalla;
    const n0 = db.query("SELECT count(*) AS n FROM diagnoser WHERE kod = 'I50.9'").get().n;
    const f = migrering.forhandsvisa(db, sysf(db), uttag());
    expect(f).toMatchObject({ kalla: 'VAS', antalAvvikelser: 1, redanInlast: null });
    expect(f.perTyp.find(t => t.datatyp === 'diagnoser')).toMatchObject({ iKallan: 2, iFilen: 2, kanForasOver: 1 });
    expect(db.query("SELECT count(*) AS n FROM diagnoser WHERE kod = 'I50.9'").get().n).toBe(n0);
    const r = inlast(db, uttag());
    expect(db.query("SELECT count(*) AS n FROM diagnoser WHERE kod = 'I50.9'").get().n).toBe(n0 + 1);
    expect(r.perTyp.map(t => [t.datatyp, t.iKallan, t.overforda, t.verifierade])).toEqual([['vardkontakter', 1, 1, 1], ['diagnoser', 2, 1, 1], ['matvarden', 1, 1, 1]]);
    expect(db.query("SELECT kalla, text, typ FROM diagnoser WHERE kod = 'I50.9' AND patient_id = 'p01' AND datum = '2012-05-02'").get()).toEqual({ kalla: 'migrerad:VAS', text: 'Hjärtsvikt, ospecificerad', typ: 'bi' });
    expect(db.query("SELECT varde_num, matt_enhet, kalla FROM matvarden WHERE patient_id = 'p01' AND tid = '2012-05-02T07:40:00.000Z'").get()).toEqual({ varde_num: 12, matt_enhet: 'mg/L', kalla: 'migrerad:VAS' });
    const a = db.query("SELECT * FROM migrering WHERE datatyp = 'diagnoser' AND kalla = 'migrerad:VAS'").get();
    expect(a.antal_kalla).toBe(fore + 2);
    expect(a.antal_kalla - a.antal_overforda).toBeGreaterThan(0);
    // En migrerad vårdkontakt ger ingen vårdrelation.
    expect(db.query("SELECT ger_vardrelation FROM vardkontakter WHERE kalla = 'migrerad:VAS' AND start = '2012-05-02T08:00:00.000Z'").get().ger_vardrelation).toBe(0);
  });

  test(namn(T.mgAvvikelse), () => {
    const db = nyDb();
    const r = inlast(db, uttag({ antal: { Observation: 3 } }));
    expect(r.avvikelser).toBe(2);
    const av = db.query("SELECT patient_id, datatyp, beskrivning FROM migrering_avvikelser WHERE kalla = 'migrerad:VAS' ORDER BY id DESC LIMIT 2").all();
    expect(av.map(x => x.beskrivning)).toEqual(expect.arrayContaining(['2 av 3 poster som källsystemet räknade finns inte i filen.', 'Post 4 i filen: Patienten finns inte i Vårdkällan. Posten förs in när patienten är registrerad.']));
    expect(av.find(x => x.datatyp === 'diagnoser').patient_id).toBe('');
    const e = fel(() => migrering.foresla(db, sysf2(db), uttag({ antal: { Observation: 3 } }), NU));
    expect(e.status).toBe(409);
    expect(e.message).toContain('Samma uttag läses inte in två gånger');
    // Exempeluttaget som systemförvaltaren kan hämta på migreringssidan ger en avvikelse och visar poster som saknas.
    const exempel = JSON.parse(readFileSync(join(import.meta.dir, '..', 'public', 'exempel', 'uttag-vas.json'), 'utf8'));
    const x = migrering.forhandsvisa(nyDb(), sysf(db), exempel);
    expect(x).toMatchObject({ kalla: 'VAS', antalAvvikelser: 1, avvikelser: [{ post: 3, typ: 'Condition', orsak: expect.stringContaining('HSA-id') }] });
    expect(x.perTyp.map(t => [t.datatyp, t.kanForasOver, t.saknasIFilen])).toEqual([['vardkontakter', 1, 0], ['diagnoser', 1, 0], ['matvarden', 1, 1], ['anteckningar', 0, 1]]);
    expect(fel(() => migrering.forhandsvisa(db, sysf(db), { resourceType: 'Bundle', type: 'transaction', entry: [] })).message).toContain('Bundle av typen collection');
    expect(fel(() => migrering.forhandsvisa(db, sysf(db), { ...uttag(), entry: uttag().entry.slice(1) })).message).toContain('källsystemet');
  });

  test(namn(T.mgBehorighet), async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/migrering/forhandsvisa', { fil: uttag() })).status).toBe(403);
    expect((await k.post('/api/migrering/filer', { fil: uttag() })).status).toBe(403);
    await k.logga('sysf');
    const f = await k.post('/api/migrering/filer', { fil: uttag() });
    expect(f.status).toBe(201);
    await k.logga('sysf-2');
    const r = await k.post(`/api/migrering/filer/${f.data.fil.id}/godkann`, {});
    expect(r.status).toBe(200);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT handling, grund FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = ?").get(`migrering:${r.data.fil}`)).toEqual({ handling: 'konfigurera', grund: 'administrativ' });
    expect((await k.get('/api/migrering/filer')).data.filer[0]).toMatchObject({ kalla: 'VAS', status: 'inlast', avvikelser: 1, foreslagenAv: 'Tomas Lindh', beslutadAv: 'Nora Ekholm' });
    // Avstämningen visar den nya avvikelsen, och läkaren ser den migrerade diagnosen märkt i tidslinjen.
    expect((await k.get('/api/migrering')).data.avvikelser.some(a => a.beskrivning.includes('Patienten finns inte i Vårdkällan'))).toBe(true);
    await k.logga('lak-kard');
    const o = (await k.get('/api/patient/p01')).data;
    expect(JSON.stringify(o)).toContain('migrerad:VAS');
  });

  test(namn(T.mgFyraOgon), () => {
    const db = nyDb();
    const n0 = db.query('SELECT count(*) AS n FROM diagnoser').get().n;
    const { fil } = migrering.foresla(db, sysf(db), uttag(), NU);
    expect(fil).toMatchObject({ status: 'vantar', egen: true, kanGodkanna: false, kalla: 'VAS', antalAvvikelser: 1 });
    // Ingenting skrivs i journalerna förrän en annan systemförvaltare har godkänt filen.
    expect(db.query('SELECT count(*) AS n FROM diagnoser').get().n).toBe(n0);
    expect(fel(() => migrering.godkann(db, sysf(db), fil.id, {}, NU)).message).toContain('Fyra ögon');
    expect(fel(() => migrering.foresla(db, sysf2(db), uttag(), NU)).status).toBe(409);
    expect(fel(() => migrering.godkann(db, personal(db, 'lak-kard'), fil.id, {}, NU)).status).toBe(403);
    const r = migrering.godkann(db, sysf2(db), fil.id, {}, NU);
    expect(r.perTyp.find(t => t.datatyp === 'diagnoser').overforda).toBe(1);
    expect(fel(() => migrering.godkann(db, sysf2(db), fil.id, {}, NU)).status).toBe(409);
    // Avslag kräver en kommentar, och den som lade fram filen kan återkalla den.
    const andra = migrering.foresla(db, sysf(db), uttag({ antal: { Encounter: 4 } }), NU).fil;
    expect(fel(() => migrering.avsluta(db, sysf2(db), andra.id, {}, NU)).message).toContain('Skriv varför');
    expect(migrering.avsluta(db, sysf(db), andra.id, {}, NU).fil.status).toBe('aterkallad');
    // Själva filen har patientuppgifter och sparas bara medan den väntar. När filen är beslutad finns bara
    // kontrollsumman (så att samma uttag inte läses in två gånger) och rapporten med antalen kvar.
    const kvar = db.query('SELECT id, status, fil FROM migrering_filer ORDER BY id').all();
    expect(kvar.map(f => [f.status, f.fil])).toEqual([['inlast', ''], ['aterkallad', '']]);
    expect(fel(() => migrering.foresla(db, sysf2(db), uttag(), NU)).status).toBe(409);
    const tredje = migrering.foresla(db, sysf(db), uttag({ antal: { Encounter: 5 } }), NU).fil;
    expect(db.query('SELECT fil FROM migrering_filer WHERE id = ?').get(tredje.id).fil).toContain('Encounter');
    migrering.avsluta(db, sysf2(db), tredje.id, { kommentar: 'Fel antal i uttaget.' }, NU);
    expect(db.query('SELECT fil FROM migrering_filer WHERE id = ?').get(tredje.id).fil).toBe('');
  });

  test(namn(T.mgForfattare), () => {
    const db = nyDb();
    const not = { resource: { resourceType: 'Composition', meta: tag('SE2321000164-VK0120'), status: 'final', title: 'Mottagningsanteckning', date: '2012-05-02T09:00:00Z',
      subject: { identifier: { system: PNR, value: '194502024732' } },
      // Författaren i källsystemet har samma HSA-id som en nuvarande läkare i Vårdkällan.
      author: [{ identifier: { system: migrering.HSA_SYSTEM, value: personal(db, 'lak-kard').hsa_id }, display: 'Läkare i VAS' }],
      section: [{ title: 'Bedömning', text: { div: '<div>Stabil hjärtsvikt.</div>' } }] } };
    inlast(db, uttag({ extra: [not] }));
    const a = db.query("SELECT * FROM anteckningar WHERE kalla = 'migrerad:VAS' AND skapad = '2012-05-02T09:00:00.000Z'").get();
    const nuvarande = new Set(db.query('SELECT id FROM personal').all().map(p => p.id));
    expect(a.signerad_av).toBeNull();
    expect(nuvarande.has(a.forfattare_id)).toBe(false);
    expect(a.forfattare_id).toBe('migrering:VAS');
    expect(db.query("SELECT count(*) AS n FROM anteckningar a JOIN migrering_metadata m ON m.tabell = 'anteckningar' AND m.rad_id = a.id WHERE a.signerad_av IN (SELECT id FROM personal) OR a.forfattare_id IN (SELECT id FROM personal)").get().n).toBe(0);
    // Författaren och signeringen i källsystemet följer med som uppgifter om källan, tydligt märkta i journalen.
    const ut = journal.anteckningUt(db, a);
    expect(ut.forfattare).toMatchObject({ id: null, namn: 'Läkare i VAS', titel: 'Författare i VAS, migrerad' });
    expect(ut.signerad).toMatchObject({ tid: '2012-05-02T09:00:00.000Z', av: { id: null, namn: 'Läkare i VAS' }, iKallan: true });
    expect(ut.kallaEtikett).toContain('Migrerad från VAS');
    expect(ut.kallaUppgifter).toEqual({ kalla: 'VAS', forfattare: 'Läkare i VAS', forfattareHsa: personal(db, 'lak-kard').hsa_id, signerad: '2012-05-02T09:00:00.000Z' });
    // En anteckning utan författare i källan läses ändå in, med källsystemet som författare.
    const utan = { resource: { ...not.resource, date: '2012-05-03T09:00:00Z', author: [] } };
    inlast(db, uttag({ extra: [utan] }));
    const b = db.query("SELECT * FROM anteckningar WHERE skapad = '2012-05-03T09:00:00.000Z'").get();
    expect(journal.anteckningUt(db, b).forfattare.namn).toBe('Okänd författare i VAS');
  });
});
