// Runda 11, r7: tillväxten i version 1.1 (Sussa 4.1.1.2 till 4.1.1.4 och 4.1.1.6 till 4.1.1.8): WHO:s referens 5 till 19
// år och byte av referens, sitthöjd och kontrollen av K11:s koder, pubertet, import från fil och från ett simulerat
// journalsystem, tjänstekontrakten GetObservations och GetActivities, och valbara indikatorer för vårdenheten och
// regionen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';
import * as T from '../src/tillvaxt.js';
import * as R from '../src/tillvaxt-r11.js';
import { K11, MATKOD } from '../src/kodverk.js';
import { verhoeffGiltig } from '../src/fackssprak.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const LEO = '201712112398';
const datum = (dagarSedan) => new Date(Date.now() - dagarSedan * 86400_000).toISOString().slice(0, 10);
const fhirFil = (pnr, rader) => JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: rader.map(([kod, system, v, enhet, d]) => ({ resource: { resourceType: 'Observation', status: 'final',
  code: { coding: [{ system, code: kod }] }, subject: { identifier: { system: 'http://electronichealth.se/identifier/personnummer', value: pnr } }, effectiveDateTime: `${d}T10:00:00Z`,
  valueQuantity: { value: v, unit: enhet, code: enhet }, performer: [{ reference: 'Organization/x', display: 'BVC Exempelby (påhittad)' }] } })) });

describe('Tillväxt, version 1.1', () => {
  test('WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern', () => {
    expect(T.lms('vikt', 'man', 61)).toEqual([-0.2026, 18.5057, 0.12988]);
    expect(T.lms('vikt', 'man', 121)).toBeNull();
    expect(T.lms('huvudomfang', 'man', 61)).toBeNull();
    expect(T.lms('bmi', 'kvinna', 228)).not.toBeNull();
    expect(T.lms('bmi', 'kvinna', 229)).toBeNull();
    // Övergången mellan WHO:s två tabeller räknas mellan 60 och 61 månader.
    const mellan = T.lms('langd', 'man', 60.5);
    expect(mellan[1]).toBeGreaterThan(T.lms('langd', 'man', 60)[1]);
    expect(mellan[1]).toBeLessThan(T.lms('langd', 'man', 61)[1]);
    expect(T.zVarde('langd', 'man', 100, T.lms('langd', 'man', 100)[1])).toBeCloseTo(0, 6);
    expect(T.lms('langd', 'man', 100, 'who2006')).toBeNull();
    expect(T.referensFor('constructor').id).toBe('auto');
    expect(T.REFERENSER.who2007.licens).toContain('CC BY-NC-SA 3.0 IGO');
  });

  test('referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna', async () => {
    const k = await inloggad('lak-vc');
    const d = (await k.get('/api/patient/p09/tillvaxt')).data;
    expect(d.referens).toMatchObject({ id: 'who2007', vald: 'auto' });
    expect(d.barn.inomReferens).toBe(true);
    expect(d.kurvor.find(x => x.matt === 'langd').linjer[2].punkter.length).toBeGreaterThan(20);
    expect(d.referenser.map(r => r.id)).toEqual(['auto', 'who2006', 'who2007']);
    expect(d.ejTillgangliga.map(r => r.id)).toEqual(['svensk', 'prematur', 'down', 'turner']);
    expect(d.ejTillgangliga.find(r => r.id === 'prematur').skal).toContain('korrigerad ålder');
    const bytt = (await k.get('/api/patient/p09/tillvaxt?referens=who2006')).data;
    expect(bytt.referens).toMatchObject({ id: 'who2006', vald: 'who2006' });
    expect(bytt.barn.inomReferens).toBe(false);
    // Ett barn under fem år får WHO:s standard, och huvudomfånget har referens bara där.
    const ida = (await k.get('/api/patient/p61/tillvaxt')).data;
    expect(ida.referens.id).toBe('who2006');
    // Idas personnummer har ett fast födelsedatum, så sitthöjden kommer till när hon blir äldre.
    expect(ida.kurvor.map(x => x.matt).slice(0, 4)).toEqual(['vikt', 'langd', 'huvudomfang', 'bmi']);
    expect(d.kurvor.find(x => x.matt === 'huvudomfang').utanReferens).toBe(true);
  });

  test('sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT', async () => {
    const k = await inloggad('lak-vc');
    const r = await k.post('/api/patient/p09/tillvaxt', { langd: '131,5', sitthojd: '70,2' });
    expect(r.status).toBe(201);
    expect(r.data.text).toContain('Sitthöjd 70,2 cm');
    const d = (await k.get('/api/patient/p09/tillvaxt')).data;
    const s = d.kurvor.find(x => x.matt === 'sitthojd');
    expect(s).toMatchObject({ namn: 'Sitthöjd', utanReferens: true });
    expect(s.senaste.varde).toBe(70.2);
    expect(K11.tillvaxt.sitthojd.kod).toBe('248335006');
    expect(MATKOD.sitthojd.coding[0]).toMatchObject({ system: 'http://snomed.info/sct', code: '248335006' });
    const obs = (await k.get('/fhir/Observation?patient=p09')).data.entry.map(e => e.resource).find(o => o.code.coding.some(c => c.code === '248335006'));
    expect(obs.valueQuantity.value).toBe(70.2);
    // Kontrollen: varje kod har rätt kontrollsiffra, kroppslängdens kod är märkt som inaktiv med de aktiva begreppen, och
    // de svenska koderna är märkta som svenska utgåvan.
    for (const x of Object.values(K11.tillvaxt)) expect(verhoeffGiltig(x.kod)).toBe(true);
    expect(R.K11_KONTROLL.inaktiva['248334005'].aktiva).toEqual(['1153637007', '1149101003']);
    expect(R.K11_KONTROLL.svenska).toEqual(['53851000052106', '53861000052109']);
    expect(Object.values(K11.tillvaxt).map(x => x.kod).every(kod => R.K11_KONTROLL.aktiva.includes(kod) || R.K11_KONTROLL.inaktiva[kod] || R.K11_KONTROLL.svenska.includes(kod))).toBe(true);
  });

  test('pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet', async () => {
    const k = await inloggad('lak-vc');
    const fore = (await k.get('/api/patient/p09/tillvaxt')).data.pubertet;
    expect(fore.visas).toBe(true);
    expect(fore.matt.map(x => x.id)).toEqual(['genitalia', 'pubes']);
    expect(fore.testikelvolym).toBe(true);
    expect((await k.post('/api/patient/p09/tillvaxt/pubertet', { brost: 2 })).data.fel).toContain('Bröst (B) registreras inte för det här barnet.');
    expect((await k.post('/api/patient/p09/tillvaxt/pubertet', { genitalia: 7 })).status).toBe(400);
    expect((await k.post('/api/patient/p09/tillvaxt/pubertet', { genitalia: '2' })).status).toBe(400);
    expect((await k.post('/api/patient/p09/tillvaxt/pubertet', {})).data.fel).toBe('Fyll i minst ett stadium.');
    const r = await k.post('/api/patient/p09/tillvaxt/pubertet', { genitalia: 2, pubes: 1, testikelvolym: '4' });
    expect(r.status).toBe(201);
    expect(r.data.pubertet.start.text).toContain('G2');
    // Leo fyller nio år den 11 december 2026, och bedömningen räknas från åldern när puberteten började. Före nio år är
    // den tidig (demoregel). Efter det har den varken kommit för tidigt eller för sent.
    if (r.data.pubertet.start.alderAr < R.PUBERTET_REGLER.man.tidig) expect(r.data.pubertet.bedomning.text).toContain('tidig pubertet');
    else expect(r.data.pubertet.bedomning).toBeNull();
    expect(() => db(k).query('UPDATE tillvaxt_pubertet SET genitalia = 1').run()).toThrow();
    // Regeln prövas också oberoende av dagens datum, med en registrering från när Leo var åtta och ett halvt år.
    db(k).query("INSERT INTO tillvaxt_pubertet (patient_id, enhet_id, tid, genitalia, registrerad_av, registrerad) SELECT patient_id, enhet_id, '2026-06-11T09:00:00.000Z', 2, registrerad_av, registrerad FROM tillvaxt_pubertet WHERE patient_id = 'p09' LIMIT 1").run();
    const tidig = (await k.get('/api/patient/p09/tillvaxt')).data.pubertet;
    expect(tidig.start.alderAr).toBe(8.5);
    expect(tidig.bedomning.text).toContain('tidig pubertet');
    // Ett barn under sju år utan registreringar får inget pubertetsavsnitt.
    expect((await k.get('/api/patient/p61/tillvaxt')).data.pubertet.visas).toBe(false);
  });

  test('en fil förhandsgranskas innan något sparas, och en fil för en annan patient, orimliga värden och för stora filer avvisas', async () => {
    const k = await inloggad('lak-vc');
    const innehall = fhirFil(LEO, [['29463-7', 'http://loinc.org', 18.4, 'kg', datum(1500)], ['8302-2', 'http://loinc.org', 1.08, 'm', datum(1500)], ['29463-7', 'http://loinc.org', 400, 'g', datum(1400)], ['9843-4', 'http://loinc.org', 51, 'cm', datum(-5)]]);
    const fore = db(k).query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p09'").get().n;
    const g = (await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'fhir', innehall })).data;
    expect(g.antal).toEqual({ ny: 2, finns: 0, fel: 2 });
    expect(g.rader[1]).toMatchObject({ typ: 'langd', varde: 108, status: 'ny', ursprungEnhet: 'BVC Exempelby (påhittad)' });
    expect(g.rader[2].orsak).toContain('går inte att mäta');
    expect(g.rader[3].orsak).toContain('framtiden');
    expect(db(k).query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p09'").get().n).toBe(fore);
    // En annan patients fil avvisas helt, med samma svar som en fil utan personnummer.
    const annan = await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'fhir', innehall: fhirFil('194502024732', [['29463-7', 'http://loinc.org', 18, 'kg', datum(100)]]) });
    expect(annan.status).toBe(400);
    expect(annan.data.fel).toContain('Filen gäller inte den här patienten');
    expect((await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'fhir', innehall: fhirFil('', [['29463-7', 'http://loinc.org', 18, 'kg', datum(100)]]) })).data.fel).toBe(annan.data.fel);
    expect((await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'fhir', innehall: 'x'.repeat(R.MAX_TECKEN + 1) })).data.fel).toContain('för stor');
    expect((await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'fhir', innehall: '{nej' })).data.fel).toContain('JSON');
    expect((await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'toString', innehall })).status).toBe(400);
    // Ett värde mer än fem standardavvikelser från referensen är troligen fel.
    const orimligt = (await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'csv', innehall: `personnummer;datum;mått;värde\n${LEO};${datum(800)};vikt;95` })).data;
    expect(orimligt.rader[0].orsak).toContain('fem standardavvikelser');
  });

  test('inläsningen sparar ursprunget som det var, och den som läser in står aldrig som den som mätte', async () => {
    const k = await inloggad('lak-vc');
    const innehall = `personnummer;datum;mått;värde;enhet;vårdenhet\n${LEO};${datum(1600)};vikt;17,1;kg;BVC Exempelby (påhittad)\n${LEO};${datum(1600)};längd;104;cm;BVC Exempelby (påhittad)`;
    const g = (await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'csv', innehall })).data;
    expect(g.antal.ny).toBe(2);
    expect((await k.post('/api/patient/p09/tillvaxt/import', { format: 'csv', innehall, hash: 'fel' })).data.fel).toContain('har ändrats');
    const r = await k.post('/api/patient/p09/tillvaxt/import', { format: 'csv', innehall, hash: g.hash });
    expect(r.status).toBe(201);
    expect(r.data.antal).toBe(2);
    const rad = db(k).query("SELECT m.*, i.kallsystem, i.ursprung_enhet, i.importerad_av FROM matvarden m JOIN tillvaxt_import i ON i.matvarde_id = m.id WHERE m.patient_id = 'p09' AND m.typ = 'vikt'").get();
    expect(rad).toMatchObject({ registrerad_av: null, kalla: 'import', kallsystem: 'Fil', ursprung_enhet: 'BVC Exempelby (påhittad)', importerad_av: 'lak-vc' });
    // Samma fil igen läses inte in, och samma mått samma dag visas som det som redan finns.
    expect((await k.post('/api/patient/p09/tillvaxt/import', { format: 'csv', innehall, hash: g.hash })).data.fel).toBe('Filen är redan inläst.');
    const igen = (await k.post('/api/patient/p09/tillvaxt/import/granska', { format: 'csv', innehall: `${innehall}\n` })).data;
    expect(igen.antal).toEqual({ ny: 0, finns: 2, fel: 0 });
    // Kurvan visar ursprunget, och mätvärdet är märkt som inläst.
    const d = (await k.get('/api/patient/p09/tillvaxt')).data;
    expect(d.kurvor.find(x => x.matt === 'vikt').punkter.find(x => x.importerad).vardenhet).toBe('BVC Exempelby (påhittad), inläst');
    const mv = (await k.get('/api/patient/p09/matvarden')).data;
    const lista = Array.isArray(mv) ? mv : mv.matvarden ?? mv.poster ?? [];
    const inlast = lista.find(x => x.id === rad.id);
    if (inlast) expect(inlast.inmatning.typ).toBe('importerad');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p09' AND resurs = 'tillvaxt:import:2'").get().n).toBe(1);
  });

  test('det simulerade journalsystemet svarar på GetObservations, och svaret granskas och läses in som en fil', async () => {
    const k = await inloggad('lak-vc');
    const g = (await k.post('/api/patient/p09/tillvaxt/import/journalsystem', {})).data;
    expect(g.kallsystem).toBe(R.SIMULERAT_SYSTEM);
    expect(g.antal.ny).toBeGreaterThanOrEqual(10);
    expect(g.antal.fel).toBe(0);
    expect(JSON.parse(g.innehall).result.message).toContain('Simulerat journalsystem');
    const r = await k.post('/api/patient/p09/tillvaxt/import', { format: 'riv', innehall: g.innehall, hash: g.hash });
    expect(r.status).toBe(201);
    expect(r.data.text).toContain(R.SIMULERAT_SYSTEM);
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p09' AND resurs = 'riv/GetObservations:simulerat'").get().n).toBe(1);
    // Logggranskaren och vårdadministratören läser inte in.
    expect((await (await inloggad('logg')).post('/api/patient/p09/tillvaxt/import/journalsystem', {})).status).toBe(403);
    expect((await (await inloggad('adm-kard')).post('/api/patient/p09/tillvaxt/import/journalsystem', {})).status).toBe(403);
  });

  test('GetObservations och GetActivities svarar med samma behörighet som FHIR', async () => {
    const k = await inloggad('lak-kard');
    const fraga = { patientId: { id: '194502024732', type: '1.2.752.129.2.1.3.1' } };
    const o = (await k.post('/api/riv/GetObservations', fraga)).data;
    const fhir = (await k.get('/fhir/Observation?patient=p01')).data;
    expect(o.observation.length).toBe(fhir.entry.length);
    expect(o.observation.find(x => x.body.observationCode.code === '29463-7').body.value.pq.unit).toBe('kg');
    const a = (await k.post('/api/riv/GetActivities', fraga));
    expect(a.status).toBe(200);
    expect(a.data.activityGroup.length).toBe((await k.get('/fhir/Procedure?patient=p01')).data.entry?.length ?? 0);
    expect((await (await inloggad('logg')).post('/api/riv/GetObservations', fraga)).status).toBe(403);
  });

  test('barnavårdscentralen väljer sina indikatorer, och regionen ser dem med varje liten cell spärrad för sig', async () => {
    const k = await inloggad('lak-vc');
    const d = (await k.get('/api/bhv/indikatorer')).data;
    expect(d.valda).toEqual(R.STANDARDVAL);
    expect(d.katalog.length).toBe(R.INDIKATORER.length);
    const v = (await k.post('/api/bhv/indikatorer', { indikatorer: ['fodelsedata', 'malangd', 'tb_risk'] })).data;
    expect(v.valda).toEqual(['fodelsedata', 'malangd', 'tb_risk']);
    expect(v.resultat.find(x => x.id === 'fodelsedata')).toMatchObject({ namnare: expect.any(Number) });
    expect((await k.post('/api/bhv/indikatorer', { indikatorer: ['__proto__'] })).status).toBe(400);
    expect((await k.post('/api/bhv/indikatorer', { indikatorer: [] })).status).toBe(400);
    expect((await k.get('/api/bhv/indikatorer/region')).status).toBe(403);
    expect((await (await inloggad('logg')).get('/api/bhv/indikatorer')).status).toBe(403);
    // Cellerna: färre än fem i nämnaren, täljaren eller resten ger inget tal.
    expect(R.cell([3, 4]).text).toBe('Färre än 5');
    expect(R.cell([2, 20]).taljare).toBeNull();
    expect(R.cell([18, 20]).taljare).toBeNull();
    expect(R.cell([0, 20])).toMatchObject({ taljare: 0, namnare: 20, procent: 0 });
    expect(R.cell([10, 20])).toMatchObject({ taljare: 10, namnare: 20, procent: 50 });
    const u = await inloggad('uppf');
    const reg = (await u.get('/api/bhv/indikatorer/region')).data;
    expect(reg.indikatorer.map(x => x.id)).toEqual(R.INDIKATORER.map(x => x.id));
    expect(reg.antalEnheter).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(reg);
    for (const x of ['p61', '202505062386', 'Holmqvist']) expect(text).not.toContain(x);
    // Regionens summa räknas bara på vårdenheter vars värden visas.
    for (const i of reg.indikatorer) if (i.enheter.every(e => e.varde.taljare == null)) expect(i.region.taljare).toBeNull();
    // Uppgifter på en annan vårdenhet ändrar inte barnavårdscentralens tal: en vaccination och en födelseuppgift på
    // psykiatrin räknas inte.
    await k.post('/api/bhv/indikatorer', { indikatorer: R.INDIKATORER.map(i => i.id) });
    const fore = JSON.stringify((await k.get('/api/bhv/indikatorer')).data.resultat);
    db(k).query("INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, registrerad) VALUES ('p61', 'uso-psyk', 'mpr1', 'J07BD52', 1, ?, ?)").run(new Date().toISOString(), new Date().toISOString());
    db(k).query("INSERT INTO tillvaxt_uppgifter (patient_id, enhet_id, typ, varde, tid, registrerad) VALUES ('p61', 'uso-psyk', 'tb_risk', 0, ?, ?)").run(new Date().toISOString(), new Date().toISOString());
    expect(JSON.stringify((await k.get('/api/bhv/indikatorer')).data.resultat)).toBe(fore);
  });

  test('en pubertetsregistrering på en spärrad vårdenhet syns inte och ändrar inte bedömningen', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const sparrad = d.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get().enhet_id;
    const fore = JSON.stringify((await k.get('/api/patient/p04/tillvaxt')).data.pubertet);
    d.query("INSERT INTO tillvaxt_pubertet (patient_id, enhet_id, tid, genitalia, registrerad_av, registrerad) VALUES ('p04', ?, ?, 3, 'lak-psyk', ?)").run(sparrad, new Date().toISOString(), new Date().toISOString());
    expect(JSON.stringify((await k.get('/api/patient/p04/tillvaxt')).data.pubertet)).toBe(fore);
    somPerson(sandlada(app, k), 'lak-kard');
  });
});
