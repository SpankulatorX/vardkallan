import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import { harVardrelation } from '../src/atkomst.js';
import { nastaKonferens, HSA_KATALOG, laggTillSkanning } from '../src/remiss-r8.js';
import * as fhir from '../src/fhir.js';

// Remiss, del 3 (runda 8, r2, Sussa 3.3.1.2 till 3.3.1.5 och Sussas testfall 2.2 till 2.5): remiss på uppdrag,
// fördelning till en namngiven läkare, remisskonferens och extern pappersremiss. Systemet är experten: det föreslår
// uppdragsgivaren och den läkare som ska bedöma, väljer nästa remisskonferens, kvitterar mottagningen och fyller i det
// det kan. Den som skriver eller registrerar på uppdrag ser aldrig mer än sin roll får se.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
// Läkare som inte är demoroller (överläkaren som är bakjour) loggas in genom att sessionen byter person.
const som = async (roll, personalId) => { const k = await inloggad(roll); sandlada(app, k).personalId = personalId; return k; };
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
const b64 = (s) => Buffer.from(s).toString('base64');
const PDF = b64('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const REMISS = { tillEnhetId: 'uso-ort', fragestallning: 'Hudförändring, malignt?', anamnes: 'Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?' };
const TEXTER = [REMISS.fragestallning, REMISS.anamnes, 'hudförändring'];

describe('Remiss, del 3', () => {
  test('på uppdrag: vårdadministratören skriver remissen med en läkare som remittent, systemet föreslår läkaren och remissen skickas när läkaren har signerat i inkorgen', async () => {
    const adm = await inloggad('adm-kard');
    // Systemet föreslår den läkare som patienten har en tid hos på vårdenheten, och bara läkare på vårdenheten.
    const f = (await adm.get('/api/patient/p01/remiss-pa-uppdrag/forslag')).data;
    expect(f.uppdragsgivare.every(l => ['lak-kard', 'ul-kard', 'ol-kard', 'lak-kard2'].includes(l.id))).toBe(true);
    const forvald = f.uppdragsgivare.find(l => l.forvald);
    expect(forvald).toBeTruthy();
    expect(forvald.skal).toBeTruthy();
    expect(f).toMatchObject({ prioritet: 'normal', svarSenast: addDagar(idag(), 14) });
    const u = await adm.post('/api/patient/p01/remiss-pa-uppdrag', { ...REMISS, uppdragsgivareId: 'lak-kard' });
    expect(u.status).toBe(201);
    expect(u.data).toMatchObject({ status: 'vantar_signering', uppdragsgivare: { id: 'lak-kard' }, skrivenAv: { id: 'adm-kard' }, till: { id: 'uso-ort' } });
    // Ingen remiss är skickad förrän läkaren har signerat.
    expect(db(adm).query("SELECT count(*) AS n FROM remisser WHERE patient_id = 'p01' AND till_enhet_id = 'uso-ort'").get().n).toBe(0);
    expect(loggRader(adm).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: 'p01', handling: 'remittera_pa_uppdrag', resurs: `remiss_pa_uppdrag:${u.data.id}` });
    // Läkaren har remissen i inkorgen och signerar den. Avsändaren är läkaren, och det syns vem som skrev den.
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    const ik = (await lak.get('/api/inkorg')).data.remisserAttSignera;
    expect(ik.map(x => x.id)).toEqual([u.data.id]);
    expect(ik[0]).toMatchObject({ fragestallning: REMISS.fragestallning, skrivenAv: { namn: 'Karin Berg' }, patient: { id: 'p01' } });
    const s = await lak.post(`/api/remiss-pa-uppdrag/${u.data.id}/signera`, {});
    expect(s.status).toBe(201);
    expect(s.data).toMatchObject({ status: 'skickad', avsandare: { id: 'lak-kard' }, fran: { id: 'uso-kard' }, till: { id: 'uso-ort' }, paUppdrag: { skrivenAv: { id: 'adm-kard' } }, fragestallning: REMISS.fragestallning });
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'remittera', resurs: `remiss_pa_uppdrag:${u.data.id}:signerad:${s.data.id}` });
    expect((await lak.get('/api/inkorg')).data.remisserAttSignera).toEqual([]);
    expect((await lak.post(`/api/remiss-pa-uppdrag/${u.data.id}/signera`, {})).status).toBe(400);
  });

  test('på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar', async () => {
    const adm = await inloggad('adm-kard');
    // Bara en aktiv läkare på den egna vårdenheten kan vara uppdragsgivare.
    for (const fel of ['lak-vc', 'ssk-kard', 'lak-cosmic', 'finns-inte']) {
      expect((await adm.post('/api/patient/p01/remiss-pa-uppdrag', { ...REMISS, uppdragsgivareId: fel })).status).toBe(400);
    }
    // Läkaren och sjuksköterskan skriver egna remisser, inte på uppdrag.
    const ssk = await inloggad('ssk-kard');
    expect((await ssk.post('/api/patient/p01/remiss-pa-uppdrag', { ...REMISS, uppdragsgivareId: 'lak-kard' })).status).toBe(403);
    const u = (await adm.post('/api/patient/p01/remiss-pa-uppdrag', { ...REMISS, uppdragsgivareId: 'lak-kard' })).data;
    // Läkaren har en anteckning om patienten, som systemet föreslår att lägga till när läkaren signerar.
    db(adm).query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
      VALUES ('p01', 'uso-kard-mott', 'Mottagningsanteckning', 'lakare', ?, 'lak-kard', ?, 'signerad', ?, 'lak-kard', 1, 'vardkallan')`)
      .run(JSON.stringify([{ sokord: 'Bedömning', text: 'Snabbt växande pigmenterad förändring.' }]), new Date().toISOString(), new Date().toISOString());
    // Den som skrev ser status och uppdragsgivare, men ingen text, varken sin egen eller läkarens.
    const egen = await adm.get(`/api/remiss-pa-uppdrag/${u.id}`);
    expect(egen.status).toBe(200);
    expect(egen.data).toMatchObject({ status: 'vantar_signering', fragestallning: null, anamnes: null, forslag: null });
    const lista = (await adm.get('/api/patient/p01/remiss-pa-uppdrag')).data;
    for (const t of [...TEXTER, 'pigmenterad']) expect(JSON.stringify([egen.data, lista])).not.toContain(t);
    // En annan läkare ser inte remissen och kan inte signera den.
    const annan = await som('lak-kard', 'ol-kard');
    delaSandlada(adm, annan);
    expect((await annan.get(`/api/remiss-pa-uppdrag/${u.id}`)).status).toBe(404);
    expect((await annan.post(`/api/remiss-pa-uppdrag/${u.id}/signera`, {})).status).toBe(404);
    expect((await annan.get('/api/inkorg')).data.remisserAttSignera).toEqual([]);
    // Uppdragsgivaren ser texten och systemets förslag ur den egna anteckningen, och lägger till det med signeringen.
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    const d = (await lak.get(`/api/remiss-pa-uppdrag/${u.id}`)).data;
    expect(d).toMatchObject({ fragestallning: REMISS.fragestallning, forslag: { text: 'Bedömning: Snabbt växande pigmenterad förändring.' } });
    const s = (await lak.post(`/api/remiss-pa-uppdrag/${u.id}/signera`, { medAnteckning: true })).data;
    expect(s.anamnes).toContain('Snabbt växande pigmenterad förändring.');
    // Efter signeringen ser vårdadministratören remissens status, men inte texten.
    const r = (await adm.get('/api/patient/p01/remisser')).data.remisser.find(x => x.id === s.id);
    expect(r).toMatchObject({ status: 'skickad', fragestallning: null, anamnes: null, paUppdrag: { skrivenAv: { id: 'adm-kard' } } });
    for (const t of [...TEXTER, 'pigmenterad']) expect(JSON.stringify(r)).not.toContain(t);
    // Den som skrev kan ta tillbaka en remiss som inte är signerad, och läkaren kan avböja den.
    const t = (await adm.post('/api/patient/p01/remiss-pa-uppdrag', { ...REMISS, uppdragsgivareId: 'lak-kard' })).data;
    expect((await annan.post(`/api/remiss-pa-uppdrag/${t.id}/ta-tillbaka`, {})).status).toBe(404);
    expect((await adm.post(`/api/remiss-pa-uppdrag/${t.id}/ta-tillbaka`, {})).data).toMatchObject({ status: 'aterkallad' });
    expect((await lak.post(`/api/remiss-pa-uppdrag/${t.id}/signera`, {})).status).toBe(400);
  });

  test('fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen', async () => {
    const adm = await inloggad('adm-kard');
    const r = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    expect(r.status).toBe('skickad');
    const f = (await adm.get(`/api/remiss/${r.id}/fordelning`)).data;
    // Bara aktiva läkare på den mottagande vårdenheten, och bakjouren (överläkaren i demon) föreslås först.
    expect(f.lakare.map(l => l.id).sort()).toEqual(['lak-kard', 'lak-kard2', 'ol-kard', 'ul-kard']);
    expect(f.lakare[0]).toMatchObject({ id: 'ol-kard', forvald: true });
    expect(f.lakare[0].skal).toContain('Bakjour');
    expect(JSON.stringify(f)).not.toContain(r.fragestallning);
    expect((await adm.post(`/api/remiss/${r.id}/fordela`, { lakareId: 'lak-vc' })).status).toBe(400);
    const ut = await adm.post(`/api/remiss/${r.id}/fordela`, { lakareId: 'ol-kard' });
    expect(ut.status).toBe(200);
    expect(ut.data).toMatchObject({ status: 'mottagen', fordelad: { lakare: { id: 'ol-kard' }, av: { id: 'adm-kard' } }, fragestallning: null });
    expect(ut.data.av.mottagen).toMatchObject({ id: 'adm-kard' });
    expect(loggRader(adm).at(-1)).toMatchObject({ patient_id: 'p03', handling: 'fordela_remiss', resurs: `remiss:${r.id}:fordelad:ol-kard` });
    const ol = await som('lak-kard', 'ol-kard');
    delaSandlada(adm, ol);
    expect((await ol.get('/api/inkorg')).data.remisserAttBedoma).toMatchObject([{ id: r.id, patient: { id: 'p03' }, fordelad: { av: { namn: 'Karin Berg' } } }]);
    // Läkaren bedömer, och raden försvinner ur inkorgen.
    expect((await ol.post(`/api/remiss/${r.id}/bedom`, { beslut: 'accepterad' })).status).toBe(200);
    expect((await ol.get('/api/inkorg')).data.remisserAttBedoma).toEqual([]);
    // En bedömd remiss fördelas inte, och en remiss till en annan vårdenhet inte heller.
    expect((await adm.post(`/api/remiss/${r.id}/fordela`, { lakareId: 'lak-kard' })).status).toBe(400);
    const vc = await inloggad('lak-vc');
    delaSandlada(adm, vc);
    expect((await vc.post(`/api/remiss/${r.id}/fordela`, { lakareId: 'lak-kard' })).status).toBe(403);
  });

  test('besök inom: en accepterad remiss hamnar på väntelistan med den tidsram som läkaren väljer', async () => {
    const lak = await inloggad('lak-kard');
    const r = db(lak).query("SELECT * FROM remisser WHERE patient_id = 'p16' AND till_enhet_id = 'uso-kard'").get();
    expect(r.status).toBe('mottagen');
    const ut = (await lak.post(`/api/remiss/${r.id}/bedom`, { beslut: 'accepterad', besokInomDagar: 60 })).data;
    expect(ut.vantelista.text).toContain('inom två månader');
    expect(db(lak).query('SELECT mal FROM vantelista WHERE remiss_id = ?').get(r.id).mal).toBe(addDagar(idag(), 60));
  });

  test('remisskonferens: nästa konferens är tisdag eller torsdag klockan 8 och räknas från en fast tid', () => {
    // Måndag 2026-11-09 klockan 12 i Stockholm: tisdag 2026-11-10 klockan 8.
    expect(nastaKonferens(new Date('2026-11-09T11:00:00Z'))).toBe('2026-11-10T07:00:00.000Z');
    // Tisdag klockan 7.30: samma dag. Tisdag klockan 9: torsdag.
    expect(nastaKonferens(new Date('2026-11-10T06:30:00Z'))).toBe('2026-11-10T07:00:00.000Z');
    expect(nastaKonferens(new Date('2026-11-10T08:00:00Z'))).toBe('2026-11-12T07:00:00.000Z');
    // Fredag: tisdagen veckan efter.
    expect(nastaKonferens(new Date('2026-11-13T10:00:00Z'))).toBe('2026-11-17T07:00:00.000Z');
  });

  test('remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig', async () => {
    const adm = await inloggad('adm-kard');
    const r1 = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    const r2 = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p16' AND till_enhet_id = 'uso-kard'").get();
    const k1 = await adm.post(`/api/remiss/${r1.id}/remisskonferens`, {});
    expect(k1.status).toBe(200);
    expect(k1.data).toMatchObject({ status: 'mottagen', konferens: { tid: nastaKonferens(new Date()) } });
    expect((await adm.post(`/api/remiss/${r2.id}/remisskonferens`, {})).data.konferens.id).toBe(k1.data.konferens.id);
    expect((await adm.post(`/api/remiss/${r2.id}/remisskonferens`, {})).status).toBe(400);
    expect(loggRader(adm).at(-1)).toMatchObject({ patient_id: 'p16', handling: 'remisskonferens', resultat: 'tillaten' });
    // Vårdadministratören ser konferensen utan journaltext. Läkaren ser frågeställningarna.
    const lista = (await adm.get('/api/remisskonferens')).data;
    expect(lista.remisser.map(x => x.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(lista.remisser.every(x => x.fragestallning === null)).toBe(true);
    expect(JSON.stringify(lista)).not.toContain(r1.fragestallning);
    expect(lista.lakare.map(l => l.id)).toContain('lak-kard');
    // En patient med skyddad identitet visas maskerad på konferensen.
    db(adm).query("UPDATE patienter SET skyddad = 1 WHERE id = 'p16'").run();
    const skyddad = (await adm.get('/api/remisskonferens')).data.remisser.find(x => x.id === r2.id);
    expect(skyddad.patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    const p16 = db(adm).query("SELECT fornamn, efternamn, personnummer FROM patienter WHERE id = 'p16'").get();
    for (const t of [p16.fornamn, p16.efternamn, p16.personnummer]) expect(JSON.stringify(skyddad)).not.toContain(t);
    db(adm).query("UPDATE patienter SET skyddad = 0 WHERE id = 'p16'").run();
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    expect((await lak.get('/api/remisskonferens')).data.remisser.find(x => x.id === r1.id).fragestallning).toBe(r1.fragestallning);
    // Läkaren accepterar med ett klick, med tidsramen som systemet föreslår.
    const a = await lak.post(`/api/remiss/${r1.id}/bedom`, { beslut: 'accepterad' });
    expect(a.data).toMatchObject({ status: 'bedomd', beslut: 'accepterad', konferens: null });
    // Vårdadministratören registrerar det beslut som läkaren har fattat. Utan en ansvarig läkare går det inte.
    expect((await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'avvisad', motivering: 'Fel vårdnivå.' })).status).toBe(400);
    expect((await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'avvisad', motivering: 'Fel vårdnivå.', ansvarigId: 'lak-vc' })).status).toBe(400);
    expect((await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'avvisad', ansvarigId: 'lak-kard' })).status).toBe(400);
    const b = await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'avvisad', motivering: 'Fel vårdnivå.', ansvarigId: 'lak-kard' });
    expect(b.status).toBe(200);
    expect(b.data).toMatchObject({ status: 'bedomd', beslut: 'avvisad', av: { bedomd: { id: 'lak-kard' } }, beslutPaUppdrag: { registreradAv: { id: 'adm-kard' }, ansvarig: { id: 'lak-kard' } }, motivering: null });
    expect(loggRader(adm).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: 'p16', handling: 'registrera_beslut_pa_uppdrag', resurs: `remiss:${r2.id}:avvisad:pa_uppdrag:lak-kard` });
    expect((await adm.get('/api/remisskonferens')).data.remisser).toEqual([]);
    // Läkaren och sjuksköterskan registrerar inte på uppdrag.
    expect((await lak.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'ol-kard' })).status).toBe(403);
  });

  test('extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde', async () => {
    const adm = await inloggad('adm-kard');
    const skann = (await adm.get('/api/skannade-remisser')).data.dokument;
    expect(skann.length).toBeGreaterThan(0);
    const fil = await fetch(`${app.url}/api/skannad-remiss/${skann[0].id}`, { headers: { Cookie: adm.kaka() } });
    expect(fil.status).toBe(200);
    expect(fil.headers.get('content-type')).toBe('application/pdf');
    // Den simulerade HSA-katalogen är märkt som simulerad.
    const hsa = (await adm.get('/api/hsa-katalog?q=löparen')).data;
    expect(hsa.simulerad).toBe(true);
    expect(hsa.enheter[0]).toMatchObject({ namn: 'Behandlingshemmet Löparen' });
    expect(HSA_KATALOG.every(e => e.hsaId.includes('DEMO'))).toBe(true);
    const inp = { skanningId: skann[0].id, patientId: 'p03', enhet: 'Behandlingshemmet Löparen', remittent: 'Läkare på behandlingshemmet', remissdatum: '2017-12-07', fragestallning: 'Psykossjukdom', anamnes: 'Har bott här två år. Behandlingen har varit framgångsrik.' };
    // Remissdatum i framtiden, och utan avsändare eller frågeställning, går inte.
    expect((await adm.post('/api/extern-remiss', { ...inp, remissdatum: addDagar(idag(), 1) })).data.falt).toContain('remissdatum');
    expect((await adm.post('/api/extern-remiss', { ...inp, enhet: '' })).data.falt).toContain('enhet');
    expect((await adm.post('/api/extern-remiss', { ...inp, fragestallning: '' })).data.falt).toContain('fragestallning');
    const r = await adm.post('/api/extern-remiss', inp);
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ status: 'skickad', till: { id: 'uso-kard' }, fran: { id: 'extern', namn: 'Behandlingshemmet Löparen' }, avsandare: { namn: 'Läkare på behandlingshemmet' },
      extern: { enhet: 'Behandlingshemmet Löparen', hsaId: HSA_KATALOG.find(e => e.namn === 'Behandlingshemmet Löparen').hsaId, remissdatum: '2017-12-07', registreradAv: { id: 'adm-kard' } }, antalBilagor: 1 });
    expect(loggRader(adm).at(-1)).toMatchObject({ patient_id: 'p03', handling: 'registrera_extern_remiss', resurs: `remiss:${r.data.id}:extern` });
    // Den inskannade remissen är nu bilaga, och den lämnar listan.
    expect((await adm.get('/api/skannade-remisser')).data.dokument.map(d => d.id)).not.toContain(skann[0].id);
    expect((await adm.post('/api/extern-remiss', inp)).status).toBe(400);
    // Fritext utan HSA-id. Utan en inskannad remiss går det inte, inte heller med en egen fil.
    const utan = await adm.post('/api/extern-remiss', { ...inp, skanningId: undefined, bilaga: { namn: 'remiss.pdf', data: PDF } });
    expect(utan.status).toBe(400);
    expect(utan.data.falt).toContain('skanningId');
    const s2 = laggTillSkanning(db(adm), 'uso-kard', 'Andra.pdf', ['Andra pappersremissen']);
    const fri = (await adm.post('/api/extern-remiss', { ...inp, skanningId: s2, enhet: 'Privat mottagning i demon' })).data;
    expect(fri.extern).toMatchObject({ enhet: 'Privat mottagning i demon', hsaId: null });
    // Läkaren ser remissen bland de inkommande och tar emot, bedömer och svarar som vanligt. Svaret går med post.
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    expect((await lak.get('/api/remisser')).data.remisser.some(x => x.id === r.data.id && x.fragestallning === 'Psykossjukdom')).toBe(true);
    expect((await lak.post(`/api/remiss/${r.data.id}/mottag`)).status).toBe(200);
    expect((await lak.post(`/api/remiss/${r.data.id}/bedom`, { beslut: 'accepterad' })).status).toBe(200);
    const svar = (await lak.post(`/api/remiss/${r.data.id}/svara`, { svar: 'Tack för remissen. Han följs upp här.' })).data;
    expect(svar).toMatchObject({ status: 'svar_kvitterat' });
    expect(svar.extern.svarText).toContain('post');
    // I FHIR är remittenten och den externa enheten avsändare, inte den som registrerade remissen.
    const pers = db(lak).query("SELECT * FROM personal WHERE id = 'lak-kard'").get();
    const sr = fhir.hantera({ db: db(lak), personal: pers, valFor: () => ({}), url: new URL(`http://test.local/fhir/ServiceRequest/${r.data.id}`), base: 'http://test.local' }).body;
    expect(sr.requester).toMatchObject({ display: 'Läkare på behandlingshemmet, Behandlingshemmet Löparen', identifier: { value: 'SE-DEMO-HSA-0001' } });
    expect(JSON.stringify(sr)).not.toContain('adm-kard');
  });

  test('extern pappersremiss: registreringen ger ingen läsrätt, den som registrerade tar inte emot och bedömer inte, och vårdrelationen uppstår när någon annan tar emot', async () => {
    const adm = await inloggad('adm-kard');
    const d = db(adm);
    const pid = d.query('SELECT id FROM patienter WHERE skyddad = 0 AND sammanslagen_till IS NULL ORDER BY id').all().map(p => p.id).find(id => !harVardrelation(d, id, 'uso-kard'));
    expect(pid).toBeTruthy();
    const skann = (await adm.get('/api/skannade-remisser')).data.dokument[0];
    const r = await adm.post('/api/extern-remiss', { skanningId: skann.id, patientId: pid, enhet: 'Behandlingshemmet Löparen', remissdatum: idag(), fragestallning: 'Uppföljning', anamnes: 'Påhittad.' });
    expect(r.status).toBe(201);
    // Registreringen loggas som åtkomst till patienten, men ger varken vårdrelation eller läsrätt till journalen.
    expect(loggRader(adm).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: pid, handling: 'registrera_extern_remiss', grund: 'administrativ' });
    expect(harVardrelation(d, pid, 'uso-kard')).toBe(false);
    expect(JSON.stringify(r.data)).not.toContain('Påhittad.');
    expect((await adm.get(`/api/patient/${pid}`)).status).toBe(403);
    expect((await adm.get(`/api/patient/${pid}/remisser`)).status).toBe(403);
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    expect((await lak.get(`/api/patient/${pid}`)).status).toBe(403);
    // Den som registrerade remissen tar inte emot den, fördelar den inte, sätter den inte på konferens och registrerar inget beslut.
    expect((await adm.post(`/api/remiss/${r.data.id}/mottag`)).status).toBe(403);
    expect(loggRader(adm).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: pid, resultat: 'nekad' });
    expect((await adm.post(`/api/remiss/${r.data.id}/fordela`, { lakareId: 'lak-kard' })).status).toBe(403);
    expect((await adm.post(`/api/remiss/${r.data.id}/remisskonferens`, {})).status).toBe(403);
    expect((await adm.post(`/api/remiss/${r.data.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' })).status).toBe(403);
    expect(harVardrelation(d, pid, 'uso-kard')).toBe(false);
    // Någon annan på den mottagande vårdenheten tar emot remissen. Då uppstår vårdrelationen.
    expect((await lak.post(`/api/remiss/${r.data.id}/mottag`)).status).toBe(200);
    expect(harVardrelation(d, pid, 'uso-kard')).toBe(true);
    expect((await lak.get(`/api/patient/${pid}`)).status).toBe(200);
    // Den som registrerade bedömer eller registrerar inte heller ett beslut efter mottagningen.
    expect((await adm.post(`/api/remiss/${r.data.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' })).status).toBe(403);
    // Läkaren och sjuksköterskan registrerar inte pappersremisser, och en annan vårdenhets skanning går inte att använda.
    expect((await lak.get('/api/skannade-remisser')).status).toBe(403);
    expect((await lak.post('/api/extern-remiss', { skanningId: skann.id, patientId: pid, enhet: 'X', remissdatum: idag(), fragestallning: 'Uppföljning' })).status).toBe(403);
    const annan = d.query("INSERT INTO skannade_remisser (enhet_id, namn, typ, storlek, sha256, data, inskannad) VALUES ('uso-ort', 'ort.pdf', 'application/pdf', 3, 'x', X'255044', ?) RETURNING id").get(new Date().toISOString()).id;
    expect((await adm.get(`/api/skannad-remiss/${annan}`)).status).toBe(404);
    expect((await adm.post('/api/extern-remiss', { skanningId: annan, patientId: pid, enhet: 'X', remissdatum: idag(), fragestallning: 'Uppföljning' })).status).toBe(404);
  });

  test('extern pappersremiss: skyddad identitet maskeras och en spärr röjs inte, och registreringen ger ingen åtkomst till de spärrade uppgifterna', async () => {
    const adm = await inloggad('adm-kard');
    const d = db(adm);
    const fria = d.query('SELECT id FROM patienter WHERE skyddad = 0 AND sammanslagen_till IS NULL ORDER BY id').all().map(p => p.id).filter(id => !harVardrelation(d, id, 'uso-kard') && !d.query('SELECT 1 FROM sparrar WHERE patient_id = ?').get(id));
    const [skyddad, medSparr, utanSparr] = fria;
    d.query('UPDATE patienter SET skyddad = 1 WHERE id = ?').run(skyddad);
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, 'vc-tybble', ?)").run(medSparr, idag());
    const reg = async (pid, namn) => adm.post('/api/extern-remiss', { skanningId: laggTillSkanning(d, 'uso-kard', namn, ['Pappersremiss']), patientId: pid, enhet: 'Behandlingshemmet Löparen', remissdatum: idag(), fragestallning: 'Uppföljning' });
    // Skyddad identitet: svaret har varken namn eller personnummer.
    const s = await reg(skyddad, 'S.pdf');
    expect(s.status).toBe(201);
    expect(s.data.patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    const p = d.query('SELECT fornamn, efternamn, personnummer FROM patienter WHERE id = ?').get(skyddad);
    for (const t of [p.fornamn, p.efternamn, p.personnummer]) expect(JSON.stringify(s.data)).not.toContain(t);
    // Spärr: svaret ser likadant ut med och utan en spärr på en annan vårdenhet, och journalen är fortfarande stängd.
    const a = (await reg(medSparr, 'A.pdf')).data;
    const b = (await reg(utanSparr, 'B.pdf')).data;
    const jamfor = (x) => JSON.stringify({ ...x, id: 0, patientId: 0, patient: { ...x.patient, id: 0, namn: 0, personnummer: 0 }, bilagor: null, tider: { ...x.tider, skickad: 0 }, extern: { ...x.extern, registrerad: 0 } });
    expect(jamfor(a)).toBe(jamfor(b));
    expect(JSON.stringify(a)).not.toContain('vc-tybble');
    expect((await adm.get(`/api/patient/${medSparr}`)).status).toBe(403);
  });
});
