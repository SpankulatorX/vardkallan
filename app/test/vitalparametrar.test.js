// Mätvärden över tid med kurvor och NEWS2 (Sussa 3.1.3.9 och 3.1.3.5), larm i inkorgen, basfakta (3.1.6.1 och
// 3.1.6.2), uppmärksamhetssymbolen i sök och inkorg (3.1.5.2) och åtgärder med KVÅ (D9, 5.1.3.5). Runda 6, r1.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { KVA, SYSTEM } from '../src/kodverk.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const db = (k) => sandlada(app, k).db;
const NEWS2_OK = { andningsfrekvens: 18, saturation: 96, syrgas: 0, blodtryck: '124/78', puls: 76, medvetande: 'A', temp: 37.1 };

describe('Mätvärden och NEWS2', () => {
  test('kurvorna har referensintervall och markerar värden utanför', async () => {
    const k = await inloggad('lak-kard');
    const d = (await k.get('/api/patient/p01/matvarden')).data;
    expect(d.matvarden.length).toBeGreaterThan(10);
    const puls = d.kurvor.find(x => x.typ === 'puls');
    expect(puls.referens).toMatchObject({ lag: 51, hog: 90 });
    expect(puls.punkter.find(p => p.varden[0] === 118).utanfor).toBe(true);
    expect(puls.punkter.at(-1)).toMatchObject({ varden: [84], utanfor: false });
    const bt = d.kurvor.find(x => x.typ === 'blodtryck');
    expect(bt.serier).toEqual(['Systoliskt', 'Diastoliskt']);
    expect(bt.punkter.every(p => p.varden.length === 2)).toBe(true);
    // Patient 1 står på Waran, så INR har målintervallet för warfarin.
    expect(d.kurvor.find(x => x.typ === 'inr').referens).toMatchObject({ lag: 2.0, hog: 3.0 });
  });

  test('NEWS2 räknas av systemet ur vitalparametrarna, med serie, vad som ska göras och nästa kontroll', async () => {
    const k = await inloggad('lak-kard');
    const n = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(n).toMatchObject({ galler: true, demoregel: expect.stringContaining('Demoregel') });
    expect(n.kalla).toContain('Royal College of Physicians');
    // Akutens omgång (8 poäng) är en annan vårdenhet och kräver ett aktivt val.
    expect(n.serie.map(s => s.poang)).toEqual([6, 2, 0]);
    expect(n.aktuell).toMatchObject({ poang: 0, risk: 'lag', komplett: true, kontinuerlig: false });
    expect(Date.parse(n.aktuell.nastaKontroll) - Date.parse(n.aktuell.tid)).toBe(12 * 3600_000);
    expect(n.larm).toBe(false);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Följa förloppet sedan akuten' });
    const efter = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(efter.serie.map(s => s.poang)).toEqual([8, 6, 2, 0]);
    expect(efter.serie[0]).toMatchObject({ risk: 'hog', rod: ['Andningsfrekvens', 'Syremättnad'] });
  });

  test('NEWS2 räknas inte för barn, och en omgång för ett barn avvisas', async () => {
    const k = await inloggad('lak-vc');
    const n = (await k.get('/api/patient/p09/matvarden')).data.news2;
    expect(n).toMatchObject({ galler: false, serie: [], aktuell: null, larm: false });
    expect(n.text).toContain('barn under 16 år');
    const s = await inloggad('ssk-kard');
    expect((await s.post('/api/patient/p01/news2', NEWS2_OK)).status).toBe(201);
  });

  test('en hel NEWS2-omgång registreras på en gång, med samma tid och vårdkontakt och åtgärden QD008', async () => {
    const k = await inloggad('ssk-kard');
    const r = await k.post('/api/patient/p01/news2', { ...NEWS2_OK, andningsfrekvens: 23, puls: 112, saturation: 95 });
    expect(r.status).toBe(201);
    expect(r.data.matvarden.map(m => m.typ)).toEqual(['andningsfrekvens', 'saturation', 'syrgas', 'blodtryck', 'puls', 'medvetande', 'temp']);
    expect(r.data.news2).toMatchObject({ komplett: true, poang: 5, risk: 'medel', larm: true });
    expect(r.data.atgard).toMatchObject({ kod: 'QD008', text: 'Övervakning av vitala tecken', system: 'KVÅ' });
    const rader = db(k).query(`SELECT * FROM matvarden WHERE id IN (${r.data.matvarden.map(m => m.id).join(', ')})`).all();
    expect(new Set(rader.map(m => m.tid)).size).toBe(1);
    expect(new Set(rader.map(m => m.vardkontakt_id)).size).toBe(1);
    expect(rader[0].vardkontakt_id).not.toBeNull();
    expect(rader.every(m => m.registrerad_av === 'ssk-kard' && m.enhet_id === 'uso-kard-72')).toBe(true);
    // Larmet hamnar i inkorgen för sjuksköterskan och läkaren på vårdenheten.
    const ik = (await k.get('/api/inkorg')).data.news2Larm.find(x => x.patientId === 'p01');
    expect(ik).toMatchObject({ poang: 5, risk: 'medel', rubrik: 'NEWS2 5, medelhög risk', href: '#/patient/p01/matvarden' });
  });

  test('NEWS2-omgången sparas inte alls när ett värde saknas eller är fel', async () => {
    const k = await inloggad('ssk-kard');
    const antal = () => db(k).query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p01'").get().n;
    const fore = antal();
    const utan = await k.post('/api/patient/p01/news2', { ...NEWS2_OK, medvetande: '' });
    expect(utan.status).toBe(400);
    expect(utan.data.fel).toBe('NEWS2 behöver alla sju värdena. Fyll i medvetandegrad.');
    const fel = await k.post('/api/patient/p01/news2', { ...NEWS2_OK, medvetande: 'X' });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('A, C, V, P eller U');
    expect(antal()).toBe(fore);
    const u = await inloggad('adm-kard');
    expect((await u.post('/api/patient/p01/news2', NEWS2_OK)).status).toBe(403);
  });

  test('förhandsvisningen räknar NEWS2 utan att spara eller läsa patientuppgifter', async () => {
    const k = await inloggad('ssk-kard');
    const fore = db(k).query('SELECT count(*) AS n FROM atkomstlogg').get().n;
    const r = await k.post('/api/news2/berakna', { ...NEWS2_OK, puls: '134' });
    expect(r.data).toMatchObject({ komplett: true, poang: 3, risk: 'lag_medel', larm: true });
    expect(db(k).query('SELECT count(*) AS n FROM atkomstlogg').get().n).toBe(fore);
    expect((await (await inloggad('logg')).post('/api/news2/berakna', NEWS2_OK)).status).toBe(403);
  });

  test('medvetandegrad, GCS, smärta och syrgas registreras, valideras och får text av systemet', async () => {
    const k = await inloggad('ssk-kard');
    const reg = (typ, varde) => k.post('/api/patient/p01/matvarden', { typ, varde });
    expect((await reg('medvetande', 'v')).data).toMatchObject({ varde: 'V', beskrivning: 'V, reagerar på tilltal' });
    expect((await reg('gcs', 'E3V4M6')).data).toMatchObject({ varde: 13, beskrivning: expect.stringContaining('GCS 13 (E3 V4 M6)') });
    expect((await reg('smarta', 6)).data.beskrivning).toBe('Smärta 6 av 10 (NRS), måttlig smärta.');
    expect((await reg('syrgas', 2)).data.beskrivning).toBe('Syrgas 2 L/min');
    expect((await reg('smarta', 4.5)).status).toBe(400);
    expect((await reg('gcs', 'E5V4M6')).status).toBe(400);
    expect((await reg('medvetande', 'X')).status).toBe(400);
    // GCS ger åtgärden bedömning av medvetandefunktioner i FHIR.
    await k.logga('lak-kard');
    const fhir = (await k.get('/fhir/Observation?patient=p01')).data;
    const gcs = fhir.entry.map(e => e.resource).find(o => o.code.text === 'GCS');
    expect(gcs.valueQuantity).toMatchObject({ value: 13, system: 'http://unitsofmeasure.org', code: '{score}' });
    expect(gcs.component.map(c => [c.code.coding[0].code, c.valueQuantity.value])).toEqual([['9267-6', 3], ['9270-0', 4], ['9268-4', 6]]);
    const medv = fhir.entry.map(e => e.resource).find(o => o.code.text === 'Medvetandegrad');
    expect(medv.valueCodeableConcept.coding[0]).toMatchObject({ system: 'http://loinc.org' });
  });

  test('FHIR: NEWS2 som härledd Observation med samma behörighet som mätvärdena', async () => {
    const k = await inloggad('lak-kard');
    const alla = (await k.get('/fhir/Observation?patient=p01')).data.entry.map(e => e.resource);
    const news = alla.filter(o => o.id.startsWith('news2-'));
    expect(news.map(o => o.valueQuantity.value)).toEqual([6, 2, 0]);
    expect(news[0]).toMatchObject({ code: { coding: [{ system: 'http://loinc.org', code: '115635-5' }], text: 'NEWS2' }, category: [{ coding: [{ code: 'survey' }] }] });
    expect(news[0].derivedFrom.length).toBe(7);
    expect(news[0].encounter.reference).toStartWith('Encounter/');
    const en = await k.get(`/fhir/Observation/${news[2].id}`);
    expect(en.status).toBe(200);
    expect(en.data.valueQuantity.value).toBe(0);
    // Akutens omgång kräver aktivt val, också när den läses direkt.
    const akut = db(k).query("SELECT max(id) AS id FROM matvarden WHERE patient_id = 'p01' AND enhet_id = 'uso-akut' AND typ = 'temp'").get().id;
    expect((await k.get(`/fhir/Observation/news2-${akut}`)).status).toBe(403);
    expect((await k.get('/fhir/Observation/news2-999999')).status).toBe(404);
  });
});

describe('NEWS2-larm i inkorgen', () => {
  test('larmet syns för sjuksköterskan och läkaren på vårdenheten, med vad som ska göras, men inte för andra roller eller vårdenheter', async () => {
    for (const roll of ['ssk-kard', 'lak-kard']) {
      const k = await inloggad(roll);
      const r = (await k.get('/api/inkorg')).data.news2Larm.find(x => x.patientId === 'p17');
      expect(r).toMatchObject({ poang: 7, risk: 'hog', komplett: true, frekvens: 'Kontinuerlig övervakning av vitalparametrarna' });
      expect(r.text).toContain('Puls 134 slag/min ger 3 poäng.');
      expect(r.atgard.join(' ')).toContain('intensivvård');
      expect(r.demoregel).toContain('Demoregel');
      expect(r.patient.id).toBe('p17');
    }
    for (const roll of ['usk-kard', 'adm-kard', 'lak-akut', 'logg']) {
      const k = await inloggad(roll);
      const i = (await k.get('/api/inkorg')).data;
      expect({ roll, n: (i.news2Larm ?? []).length }).toEqual({ roll, n: 0 });
    }
  });

  test('larmet bygger bara på den egna vårdenhetens värden: en spärrad vårdenhets värden larmar inte och nämns inte', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const nu = new Date(Date.now() - 60_000).toISOString();
    // Patient 4 är inlagd på kardiologen och har spärrat psykiatrins uppgifter.
    for (const [typ, v] of [['puls', 141], ['andningsfrekvens', 28], ['saturation', 88]]) {
      d.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('p04', 'uso-psyk', ?, ?, ?, ?, 'lak-psyk')").run(typ, String(v), v, nu);
    }
    const fore = (await k.get('/api/inkorg')).data;
    expect(fore.news2Larm.some(x => x.patientId === 'p04')).toBe(false);
    expect(JSON.stringify(fore)).not.toMatch(/141|uso-psyk|Allmänpsykiatriska/);
    d.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('p04', 'uso-kard-72', 'puls', '133', 133, ?, 'ssk-kard')").run(nu);
    const efter = (await k.get('/api/inkorg')).data.news2Larm.find(x => x.patientId === 'p04');
    expect(efter).toMatchObject({ risk: 'lag_medel', komplett: false, rubrik: 'Ett värde ger 3 poäng i NEWS2' });
    expect(efter.text).toContain('Puls 133 slag/min ger 3 poäng.');
    expect(JSON.stringify(efter)).not.toMatch(/141|uso-psyk/);
  });

  test('larmet loggas på patienten en gång per session och mätomgång', async () => {
    const k = await inloggad('ssk-kard');
    await k.get('/api/inkorg');
    await k.get('/api/inkorg');
    const rader = db(k).query("SELECT * FROM atkomstlogg WHERE resurs LIKE 'inkorg:news2:%' AND patient_id = 'p17' AND personal_id = 'ssk-kard'").all();
    expect(rader.length).toBe(1);
    expect(rader[0]).toMatchObject({ handling: 'las_matvarden', resultat: 'tillaten' });
  });
});

describe('Basfakta', () => {
  test('basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem', async () => {
    const k = await inloggad('lak-kard');
    const h = (await k.get('/api/patient/p01')).data.basfakta;
    const b = (await k.get('/api/patient/p01/basfakta')).data;
    expect(b).toEqual(h);
    expect(b).toMatchObject({ kon: 'man', vardas: { vardenhet: { id: 'uso-kard' }, typ: 'slutenvard', plats: 'Avd 72, sal 4' }, listning: { vardenhet: { id: 'vc-tybble' } } });
    expect(b.alder).toBeGreaterThan(80);
    expect(b.vikt).toMatchObject({ varde: 81.6, enhet: 'kg', vardenhet: { id: 'uso-kard-72' } });
    expect(b.overkanslighet[0]).toMatchObject({ amne: 'Penicilliner', atc: 'J01C', registrerad: { datum: '2014-03-12' } });
    expect(b.uppmarksamhet).toMatchObject({ overkanslighet: 'skadlig' });
    // Hänvisningen sparas före jämförelsen, eftersom toMatchObject i Bun skriver över fälten med sina jämförare.
    const viktRef = b.fhir.vikt;
    expect(b.fhir).toMatchObject({ patient: 'Patient/p01', vikt: expect.stringMatching(/^Observation\/\d+$/), overkanslighet: [expect.stringMatching(/^AllergyIntolerance\/\d+$/)] });
    // Hänvisningarna går att läsa i FHIR.
    expect((await k.get(`/fhir/${viktRef}`)).data.valueQuantity.value).toBe(81.6);
    expect(b.bmi).toBeNull();
    await k.post('/api/patient/p01/matvarden', { typ: 'langd', varde: 178 });
    expect((await k.get('/api/patient/p01/basfakta')).data.bmi).toMatchObject({ varde: 25.8, text: expect.stringContaining('räknat av systemet') });
  });

  test('basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet', async () => {
    const a = await inloggad('adm-kard');
    const adm = (await a.get('/api/patient/p01/basfakta')).data;
    expect(adm).toMatchObject({ overkanslighet: null, uppmarksamhet: null, vikt: null, langd: null, bmi: null });
    expect(adm.vardas).not.toBeNull();
    // Patient 4:s vikt finns bara hos psykiatrin, som är spärrad.
    const k = await inloggad('lak-kard');
    expect((await k.get('/api/patient/p04/basfakta')).data.vikt).toBeNull();
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect((await k.get('/api/patient/p04/basfakta')).data.vikt).toMatchObject({ varde: 68.2 });
    const s = await inloggad('lak-akut');
    expect(JSON.stringify((await s.get('/api/patient/p03/basfakta')).data)).not.toMatch(/Engberg|Malin|19840416/);
    expect((await (await inloggad('logg')).get('/api/patient/p01/basfakta')).status).toBe(403);
  });
});

describe('Uppmärksamhetssymbolen i sök och inkorg', () => {
  test('patientsök visar symbolen med samma regler som i patienthuvudet', async () => {
    const k = await inloggad('lak-kard');
    const p01 = (await k.get('/api/sok?q=Åkesson')).data.find(p => p.id === 'p01');
    const huvud = (await k.get('/api/patient/p01')).data.uppmarksamhet.symbol;
    expect(p01.uppmarksamhet).toEqual(huvud);
    // Utan vårdrelation visas ingen symbol, och logggranskaren ser aldrig någon.
    const p02 = (await k.get('/api/sok?q=Lindberg')).data.find(p => p.id === 'p02');
    expect(p02.uppmarksamhet).toBeNull();
    const l = await inloggad('logg');
    expect((await l.get('/api/sok?q=Åkesson')).data.every(p => p.uppmarksamhet === null)).toBe(true);
  });

  test('inkorgen visar symbolen på raderna med patient, bara när översikten får läsas', async () => {
    const k = await inloggad('lak-kard');
    const i = (await k.get('/api/inkorg')).data;
    const p17 = i.news2Larm.find(x => x.patientId === 'p17');
    expect(p17.patient).toHaveProperty('uppmarksamhet');
    const v = await inloggad('adm-kard');
    const adm = (await v.get('/api/inkorg')).data;
    for (const lista of Object.values(adm)) if (Array.isArray(lista)) for (const r of lista) expect(r?.patient?.uppmarksamhet).toBeUndefined();
  });
});

describe('Åtgärder med KVÅ', () => {
  test('koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie', () => {
    expect(KVA).toEqual({
      QD008: 'Övervakning av vitala tecken',
      PA001: 'Bedömning av medvetandefunktioner',
      XV015: 'Läkemedelsgenomgång, enkel, enligt Socialstyrelsens föreskrift och allmänna råd',
      // Runda 8, r5: stödet vid tobaksbruk.
      DV111: 'Enkla råd om tobaks- och nikotinbruk',
      DV112: 'Rådgivande samtal om tobaks- och nikotinbruk',
      DV113: 'Kvalificerat rådgivande samtal om tobaks- och nikotinbruk',
      // Runda 9, r3: operationerna i demon.
      JKA21: 'Laparoskopisk kolecystektomi', JEA01: 'Laparoskopisk appendektomi', NFB49: 'Primär total höftledsplastik med cement',
      NGB49: 'Primär totalprotes i knäled med cement',
      // Runda 9, r7: stödet vid alkohol, fysisk aktivitet och matvanor och skötseln av in- och utfarter, ordagrant ur
      // E-hälsomyndighetens fil kva-inkl-beskrivningstexter-2026.xlsx.
      DV121: 'Enkla råd om alkoholvanor', DV122: 'Rådgivande samtal om alkoholvanor', DV123: 'Kvalificerat rådgivande samtal om alkoholvanor',
      DV131: 'Enkla råd om fysisk aktivitet', DV132: 'Rådgivande samtal om fysisk aktivitet', DV133: 'Kvalificerat rådgivande samtal om fysisk aktivitet',
      DV141: 'Enkla råd om matvanor', DV142: 'Rådgivande samtal om matvanor', DV143: 'Kvalificerat rådgivande samtal om matvanor',
      DV200: 'Utfärdande av recept på fysisk aktivitet (FaR)',
      QD004: 'Skötsel av central venkateter', QD005: 'Skötsel av perifer venkateter', DK028: 'Skötsel av urinkateter', DV150: 'Skötsel av dränage', DV065: 'Sondmatning',
      // Runda 10, r4: in- och utfarterna och donationen.
      SP021: 'Inläggning av perifer venkateter', DP028: 'Byte av perifer venkateter', DP029: 'Avlägsnande av perifer venkateter',
      SP105: 'Inläggning av perifert insatt central kateter (PICC)', DF007: 'Avlägsnande av central venkateter (CVK) UNS',
      TKC20: 'Kateterisering av urinblåsa genom urinröret', DK021: 'Avlägsnande av urinkateter inlagd genom urinröret',
      DK010: 'Inläggande av suprapubisk kateter', DK023: 'Avlägsnande av suprapubisk kateter/cystostomikateter',
      TJD00: 'Nasogastrisk eller nasogastroduodenal sond', DV005: 'Avlägsnande av dränage', AV124: 'Undersökning av potentiell donator',
      // Runda 11, r6: undersökningarna i radiologi, klinisk fysiologi och klinisk neurofysiologi och starten av SVF.
      AF053: 'Röntgenundersökning, hjärta och lungor (med eller utan hjärtvolymsbedömning)', AN062: 'Röntgenundersökning, höftled med halvaxial sidobild',
      AN063: 'Röntgenundersökning, knäled', AA014: 'Datortomografi, hjärna, utan intravenös kontrast', AJ004: 'Datortomografi, buk (ospecificerat)',
      AG009: 'Datortomografi, torax', AA045: 'Magnetresonanstomografi, hjärna', AN042: 'Magnetresonanstomografi, knäled',
      AJ084: 'Ultraljudsundersökning, översikt av buken', AK044: 'Ultraljudsundersökning, njurar', AF022: 'Elektrokardiografi (EKG), 12 avledningar, standard',
      AF012: 'Arbets-EKG, standard', AF020: 'Doppler ekokardiografi, transtorakal, enkel', AA024: 'Elektroencefalografi (EEG), vaken',
      AA058: 'Neurografi, motorisk och sensorisk', VC010: 'SVF lungcancer - beslut välgrundad misstanke om cancer',
      VB210: 'SVF tjock- och ändtarmscancer - beslut välgrundad misstanke om cancer', VG910: 'SVF bröstcancer - beslut välgrundad misstanke om cancer',
      VP810: 'SVF cancermisstanke vid allvarliga, ospecifika symtom - beslut välgrundad misstanke om cancer',
    });
    expect(SYSTEM.kva).toBe('urn:oid:1.2.752.116.1.3.2.1.4');
  });

  test('FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p01/lakemedelsgenomgang', {})).status).toBe(201);
    const p = (await k.get('/fhir/Procedure?patient=p01')).data.entry.map(e => e.resource);
    const koder = p.map(x => x.code.coding[0].code);
    expect(koder.filter(c => c === 'QD008').length).toBe(3);
    expect(koder).toContain('XV015');
    expect(p.every(x => x.code.coding[0].system === 'urn:oid:1.2.752.116.1.3.2.1.4' && x.status === 'completed')).toBe(true);
    // Akutens NEWS2-omgång kräver aktivt val, som mätvärdena.
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Följa förloppet' });
    expect((await k.get('/fhir/Procedure?patient=p01')).data.entry.filter(e => e.resource.code.coding[0].code === 'QD008').length).toBe(4);
    const id = p.find(x => x.code.coding[0].code === 'QD008').id;
    expect((await k.get(`/fhir/Procedure/${id}`)).status).toBe(200);
    const s = await inloggad('lak-vc');
    expect((await s.get(`/fhir/Procedure/${id}`)).status).toBe(403);
    expect((await k.get('/fhir/Procedure/a-999999')).status).toBe(404);
    const cap = (await k.get('/fhir/metadata')).data;
    expect(cap.rest[0].resource.some(r => r.type === 'Procedure')).toBe(true);
    const loggad = db(k).query("SELECT * FROM atkomstlogg WHERE resurs LIKE 'fhir/Procedure%' ORDER BY id DESC").get();
    expect(loggad).toMatchObject({ personal_id: 'lak-kard', resultat: 'tillaten' });
  });
});
