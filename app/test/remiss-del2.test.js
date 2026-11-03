import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import { harVardrelation } from '../src/atkomst.js';

// Remiss, del 2 (runda 6, r4, Sussa 3.3.1.3 till 3.3.1.6) och egen vårdbegäran från invånaren (Sussa 3.3.2.1).
// Systemet är experten: det avgör själv filtypen ur innehållet, fyller i utkastet, kvitterar mottagningen när en remiss
// skickas vidare och räknar ledtiderna. Invånaren behöver inte veta vilken vårdenhet som tar emot besväret.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
const b64 = (s) => Buffer.from(s).toString('base64');
const PDF = b64('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]).toString('base64');
const PATIENTUPPGIFTER = (d) => d.query('SELECT id, efternamn, personnummer FROM patienter').all().flatMap(p => [`"${p.id}"`, p.efternamn, p.personnummer, p.personnummer.slice(0, 8)]);

async function utkastMedBilaga(k) {
  const u = await k.post('/api/patient/p01/remissutkast', { tillEnhetId: 'uso-kard', fragestallning: 'Ställningstagande till ablation.' });
  expect(u.status).toBe(201);
  const b = await k.post(`/api/remissutkast/${u.data.id}/bilagor`, { namn: 'ekg.pdf', data: PDF });
  expect(b.status).toBe(201);
  return { utkast: u.data, bilaga: b.data };
}

describe('Remiss, del 2', () => {
  test('ett utkast fylls i av systemet, kan sparas och ändras av den som skrev det och skickas när det är klart', async () => {
    const k = await inloggad('lak-vc');
    const u = (await k.post('/api/patient/p01/remissutkast', { tillEnhetId: 'uso-kard' })).data;
    // Systemet sätter prioritet och sista svarsdatum, och avsändande enhet.
    expect(u).toMatchObject({ status: 'utkast', prioritet: 'normal', svarSenast: addDagar(idag(), 14), fran: { id: 'vc-tybble' }, till: { id: 'uso-kard' } });
    const andra = await k.put(`/api/remissutkast/${u.id}`, { fragestallning: 'Ställningstagande till ablation.', anamnes: 'Förmaksflimmer sedan 2014.' });
    expect(andra.status).toBe(200);
    expect(andra.data).toMatchObject({ fragestallning: 'Ställningstagande till ablation.', anamnes: 'Förmaksflimmer sedan 2014.' });
    expect((await k.get('/api/patient/p01/remissutkast')).data.utkast.map(x => x.id)).toEqual([u.id]);
    // En annan läkare ser inte utkastet och kan inte ändra det.
    const annan = await inloggad('lak-kard');
    delaSandlada(k, annan);
    expect((await annan.get('/api/patient/p01/remissutkast')).data.utkast).toEqual([]);
    expect((await annan.put(`/api/remissutkast/${u.id}`, { fragestallning: 'Ändrat' })).status).toBe(404);
    // Ett ofullständigt utkast går inte att skicka, och systemet säger vad som saknas.
    const tomt = (await k.post('/api/patient/p01/remissutkast', { tillEnhetId: 'uso-kard' })).data;
    const nej = await k.post(`/api/remissutkast/${tomt.id}/skicka`);
    expect(nej.status).toBe(400);
    expect(nej.data.falt).toContain('fragestallning');
    const s = await k.post(`/api/remissutkast/${u.id}/skicka`);
    expect(s.status).toBe(201);
    expect(s.data).toMatchObject({ status: 'skickad', fragestallning: 'Ställningstagande till ablation.', till: { id: 'uso-kard' } });
    expect(db(k).query('SELECT status, remiss_id FROM remiss_utkast WHERE id = ?').get(u.id)).toMatchObject({ status: 'skickad', remiss_id: s.data.id });
    expect((await k.post(`/api/remissutkast/${u.id}/skicka`)).status).toBe(400);
    // Ett utkast tas bort utan att något raderas.
    expect((await k.post(`/api/remissutkast/${tomt.id}/ta-bort`)).status).toBe(200);
    expect((await k.get('/api/patient/p01/remissutkast')).data.utkast).toEqual([]);
  });

  test('ett utkast kan återanvända en tidigare remiss som användaren får läsa', async () => {
    const k = await inloggad('lak-vc');
    const tidigare = db(k).query("SELECT id, fragestallning, anamnes FROM remisser WHERE patient_id = 'p01' AND fran_enhet_id = 'vc-tybble'").get();
    const u = (await k.post('/api/patient/p01/remissutkast', { franRemissId: tidigare.id })).data;
    expect(u).toMatchObject({ fragestallning: tidigare.fragestallning, anamnes: tidigare.anamnes, till: { id: 'uso-kard' } });
    // En remiss om en annan patient kan inte återanvändas.
    const annan = db(k).query("SELECT id FROM remisser WHERE patient_id = 'p06'").get();
    expect((await k.post('/api/patient/p01/remissutkast', { franRemissId: annan.id })).status).toBe(400);
  });

  test('bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas', async () => {
    const k = await inloggad('lak-vc');
    const { utkast, bilaga } = await utkastMedBilaga(k);
    expect(bilaga).toMatchObject({ namn: 'ekg.pdf', typ: 'application/pdf', typText: 'PDF' });
    // En fil som heter .pdf men är en bild sparas som bild.
    const png = (await k.post(`/api/remissutkast/${utkast.id}/bilagor`, { namn: 'bild.pdf', data: PNG })).data;
    expect(png).toMatchObject({ typ: 'image/png', typText: 'Bild (PNG)' });
    const exe = await k.post(`/api/remissutkast/${utkast.id}/bilagor`, { namn: 'program.pdf', data: b64('MZ\x90\x00\x03\x00binärt') });
    expect(exe.status).toBe(400);
    expect(exe.data.fel).toContain('PDF, PNG, JPEG eller text');
    const stor = await k.post(`/api/remissutkast/${utkast.id}/bilagor`, { namn: 'stor.txt', data: b64('a'.repeat(41 * 1024)) });
    expect(stor.status).toBe(400);
    expect(stor.data.fel).toContain('40 kB');
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p01', handling: 'remittera', resurs: `remissutkast:${utkast.id}:bilaga:${png.id}` });
    const s = (await k.post(`/api/remissutkast/${utkast.id}/skicka`)).data;
    expect(s.bilagor.map(b => b.namn)).toEqual(['ekg.pdf', 'bild.pdf']);
    // Mottagaren läser bilagan. Hämtningen loggas.
    const lak = await inloggad('lak-kard');
    delaSandlada(k, lak);
    const lista = (await lak.get('/api/remisser')).data.remisser.find(r => r.id === s.id);
    expect(lista.bilagor.length).toBe(2);
    const fil = await fetch(`${app.url}/api/bilaga/${bilaga.id}`, { headers: { Cookie: lak.kaka() } });
    expect(fil.status).toBe(200);
    expect(fil.headers.get('content-type')).toBe('application/pdf');
    expect(fil.headers.get('content-disposition')).toContain('attachment');
    expect(fil.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await fil.text()).startsWith('%PDF-1.4')).toBe(true);
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'las_remiss', resurs: `bilaga:${bilaga.id}` });
    // Vårdadministratören ser att det finns bilagor men inte vad de heter, och kan inte hämta dem.
    const adm = await inloggad('adm-kard');
    delaSandlada(k, adm);
    const r = (await adm.get('/api/remisser')).data.remisser.find(x => x.id === s.id);
    expect(r).toMatchObject({ antalBilagor: 2, bilagor: null });
    expect(JSON.stringify(r)).not.toContain('ekg.pdf');
    expect((await adm.get(`/api/bilaga/${bilaga.id}`)).status).toBe(403);
    expect(loggRader(adm).at(-1)).toMatchObject({ personal_id: 'adm-kard', resultat: 'nekad' });
    // En läkare utan vårdrelation till patienten får ingenting.
    const psyk = await inloggad('lak-psyk');
    delaSandlada(k, psyk);
    expect([403, 404]).toContain((await psyk.get(`/api/bilaga/${bilaga.id}`)).status);
  });

  test('avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet', async () => {
    const k = await inloggad('lak-vc');
    const r = db(k).query("SELECT * FROM remisser WHERE patient_id = 'p03' AND fran_enhet_id = 'vc-tybble'").get();
    expect((await k.post(`/api/remiss/${r.id}/bilagor`, { namn: 'ekg.txt', data: b64('Sinusrytm 72.') })).status).toBe(201);
    const besvarad = db(k).query("SELECT * FROM remisser WHERE patient_id = 'p11'").get();
    expect((await k.post(`/api/remiss/${besvarad.id}/bilagor`, { namn: 'sen.txt', data: b64('För sent.') })).status).toBe(400);
    const kard = await inloggad('lak-kard');
    expect((await kard.post(`/api/remiss/${r.id}/bilagor`, { namn: 'x.txt', data: b64('Från mottagaren.') })).status).toBe(403);
  });

  test('vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är', async () => {
    const k = await inloggad('lak-kard');
    const r = db(k).query("SELECT * FROM remisser WHERE patient_id = 'p05'").get();
    expect(r.status).toBe('skickad');
    expect((await k.post(`/api/remiss/${r.id}/vidarebefordra`, { tillEnhetId: 'uso-med' })).status).toBe(400);
    expect((await k.post(`/api/remiss/${r.id}/vidarebefordra`, { tillEnhetId: 'uso-kard', motivering: 'Fel.' })).status).toBe(400);
    expect((await k.post(`/api/remiss/${r.id}/vidarebefordra`, { tillEnhetId: 'vc-kumla', motivering: 'Tillbaka.' })).status).toBe(400);
    const v = await k.post(`/api/remiss/${r.id}/vidarebefordra`, { tillEnhetId: 'uso-med', motivering: 'Arbetsprov görs på medicinkliniken.' });
    expect(v.status).toBe(200);
    expect(v.data.gammal).toMatchObject({ status: 'bedomd', beslut: 'vidarebefordrad', vidarebefordrad: { till: { id: 'uso-med' }, motivering: 'Arbetsprov görs på medicinkliniken.' } });
    expect(v.data.gammal.tider.mottagen).toBeTruthy();
    expect(v.data.ny).toMatchObject({ status: 'skickad', fran: { id: 'vc-kumla' }, till: { id: 'uso-med' }, fragestallning: r.fragestallning, vidarebefordradFran: { fran: { id: 'uso-kard' } } });
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p05', handling: 'bedom_remiss', resurs: `remiss:${r.id}:vidarebefordrad:${v.data.ny.id}` });
    // Kardiologen har inte längre vårdrelation genom remissen, medicinkliniken har den nu.
    expect(harVardrelation(db(k), 'p05', 'uso-kard')).toBe(false);
    expect(harVardrelation(db(k), 'p05', 'uso-med')).toBe(true);
    // Utan vårdrelation kan kardiologen inte heller göra något mer med remissen.
    expect((await k.post(`/api/remiss/${r.id}/vidarebefordra`, { tillEnhetId: 'uso-inf', motivering: 'Igen.' })).status).toBe(403);
    // Vårdadministratören kan inte vidarebefordra.
    const adm = await inloggad('adm-kard');
    const r2 = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p05'").get();
    expect((await adm.post(`/api/remiss/${r2.id}/vidarebefordra`, { tillEnhetId: 'uso-med', motivering: 'Arbetsprov.' })).status).toBe(403);
  });

  test('ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter', async () => {
    const k = await inloggad('lak-kard');
    const s = await k.get('/api/remisser/statistik');
    expect(s.status).toBe(200);
    expect(s.data.vardenhet).toMatchObject({ id: 'uso-kard' });
    const ink = s.data.inkommande;
    expect(ink.antal).toBe(db(k).query("SELECT count(*) AS n FROM remisser WHERE till_enhet_id = 'uso-kard' AND kalla = 'vardkallan'").get().n);
    expect(ink.matpunkter.map(m => m.id)).toEqual(['mottagen', 'bedomd', 'besvarad', 'kvitterat']);
    expect(ink.matpunkter.find(m => m.id === 'mottagen')).toMatchObject({ enhet: 'timmar', forvantat: 2 });
    expect(ink.avvikelser.find(a => a.typ === 'saknar_mottagningskvittens').antal).toBeGreaterThan(0);
    const json = JSON.stringify(s.data);
    for (const u of PATIENTUPPGIFTER(db(k))) expect(json).not.toContain(u);
    expect(json).not.toContain('Arbetsprov och bedömning');
    expect((await k.get('/api/remisser/statistik?niva=region')).status).toBe(403);
    const u = await inloggad('uppf');
    const r = (await u.get('/api/remisser/statistik?niva=region')).data;
    expect(r.vardenheter.find(v => v.vardenhet.id === 'uso-kard').inkommande.antal).toBe(ink.antal);
    const json2 = JSON.stringify(r);
    for (const x of PATIENTUPPGIFTER(db(u))) expect(json2).not.toContain(x);
    for (const v of r.vardenheter) for (const m of v.inkommande.matpunkter) if (m.antal < 3) expect(m.medianText).toBe('För få för att visa');
  });
});

describe('Egen vårdbegäran', () => {
  test('invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten', async () => {
    const inv = await invanare('inv-p01');
    const f = (await inv.post('/api/min/journal/p01/vardbegaran/forslag', { besvar: 'Hjärtklappning till och från sedan en vecka.' })).data;
    expect(f.akut).toBeNull();
    const ids = f.forslag.map(x => x.enhet.id);
    expect(ids).toEqual(expect.arrayContaining(['vc-tybble', 'uso-kard']));
    expect(f.forslag[0].skal).toBeTruthy();
    expect(f.forslag.find(x => x.enhet.id === 'uso-kard').rekommenderad).toBe(true);
    const ny = await inv.post('/api/min/journal/p01/vardbegaran', { besvar: 'Hjärtklappning till och från sedan en vecka.', enhetId: 'uso-kard', bilaga: { namn: 'puls.txt', data: b64('Puls 130 i går kväll.') } });
    expect(ny.status).toBe(201);
    expect(ny.data).toMatchObject({ till: 'Kardiologiska kliniken USÖ', egen: true, status: 'skickad' });
    const r = db(inv).query('SELECT * FROM remisser WHERE id = ?').get(ny.data.id);
    expect(r).toMatchObject({ patient_id: 'p01', till_enhet_id: 'uso-kard', fran_enhet_id: 'min-journal', status: 'skickad', fragestallning: 'Hjärtklappning till och från sedan en vecka.' });
    expect(loggRader(inv).at(-1)).toMatchObject({ invanare_id: 'inv-p01', patient_id: 'p01', resurs: `min:vardbegaran:${r.id}` });
    // En vårdenhet som systemet inte föreslår går inte att välja.
    expect((await inv.post('/api/min/journal/p01/vardbegaran', { besvar: 'Ont i knät.', enhetId: 'uso-psyk' })).status).toBe(400);
    // Vårdenheten tar emot, bedömer och svarar. Vårdadministratören kvitterar, läkaren bedömer.
    const adm = await inloggad('adm-kard');
    delaSandlada(inv, adm);
    const lista = (await adm.get('/api/remisser')).data.remisser.find(x => x.id === r.id);
    expect(lista).toMatchObject({ egen: true, fran: { namn: 'Egen vårdbegäran via Min journal' }, avsandare: { namn: 'Patienten själv' }, antalBilagor: 1 });
    expect((await adm.post(`/api/remiss/${r.id}/mottag`)).status).toBe(200);
    const lak = await inloggad('lak-kard');
    delaSandlada(inv, lak);
    const kort = (await lak.get('/api/remisser')).data.remisser.find(x => x.id === r.id);
    expect(kort.bilagor.map(b => b.namn)).toEqual(['puls.txt']);
    expect((await lak.post(`/api/remiss/${r.id}/bedom`, { beslut: 'accepterad' })).status).toBe(200);
    expect(db(lak).query('SELECT orsak FROM vantelista WHERE remiss_id = ?').get(r.id).orsak).toBe('Nybesök enligt egen vårdbegäran');
    expect((await lak.post(`/api/remiss/${r.id}/svara`, { svar: 'Du får en tid för EKG och läkarbesök.' })).status).toBe(200);
    // Patienten ser svaret i Min journal.
    const m = (await inv.get('/api/min/journal/p01/remisser')).data.remisser.find(x => x.id === r.id);
    expect(m).toMatchObject({ egen: true, fran: 'Egen vårdbegäran via Min journal', svar: 'Du får en tid för EKG och läkarbesök.' });
    // FHIR: avsändaren är patienten.
    const sr = (await lak.get(`/fhir/ServiceRequest/${r.id}`)).data;
    expect(sr.requester).toMatchObject({ reference: 'Patient/p01' });
  });

  test('vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden', async () => {
    const inv = await invanare('inv-p14');
    const a = (await inv.post('/api/min/journal/p14/vardbegaran/forslag', { besvar: 'Jag har ont i bröstet och svårt att andas.' })).data;
    expect(a.akut).toContain('112');
    expect((await inv.post('/api/min/journal/p14/vardbegaran/forslag', { besvar: 'kort' })).status).toBe(400);
    const f = (await inv.post('/api/min/journal/p14/vardbegaran/forslag', { besvar: 'Värk i ryggen sedan en månad.' })).data;
    const enhet = f.forslag[0].enhet.id;
    for (let i = 0; i < 3; i++) expect((await inv.post('/api/min/journal/p14/vardbegaran', { besvar: `Värk i ryggen sedan en månad, ${i}.`, enhetId: enhet })).status).toBe(201);
    const nej = await inv.post('/api/min/journal/p14/vardbegaran', { besvar: 'Värk i ryggen igen.', enhetId: enhet });
    expect(nej.status).toBe(400);
    expect(nej.data.fel).toContain('tre');
    // Personal kan inte skicka en egen vårdbegäran.
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/min/journal/p14/vardbegaran', { besvar: 'Värk i ryggen.', enhetId: enhet })).status).toBe(401);
  });
});
