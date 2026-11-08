import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, atk } from './hjalp.js';
import * as lakemedel from '../src/lakemedel.js';

// Runda 10, r2: basfakta, nyregistrering, ändring och avslut av överkänslighet i ett eget flöde (Sussa 3.1.6.2).
// Systemet slår upp ATC-koden ur ämnet och föreslår allvarlighetsgraden ur reaktionen, och varje händelse sparas med
// när, var och av vem. Basfakta, uppmärksamhetssymbolen och varningarna vid ordination följer med direkt.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const ny = (k, pid, data) => k.post(`/api/patient/${pid}/overkanslighet`, data);

describe('Basfakta, överkänslighet', () => {
  test('systemet slår upp ATC-koden och föreslår allvarlighetsgraden ur ämnet och reaktionen', async () => {
    const k = await inloggad('lak-kard');
    const f = (await k.post('/api/overkanslighet/forslag', { amne: 'ibuprofen', reaktion: 'Andningsbesvär och svullnad i svalget' })).data;
    expect(f).toMatchObject({ amne: 'Ibuprofen', atc: 'M01AE01', allvarlighet: 'allvarlig', lakemedel: true });
    expect(f.varfor.join(' ')).toContain('ATC-kod M01AE01');
    const g = (await k.post('/api/overkanslighet/forslag', { amne: 'nsaid', reaktion: 'Klåda' })).data;
    expect(g).toMatchObject({ atc: 'M01A', allvarlighet: 'lindrig' });
    const h = (await k.post('/api/overkanslighet/forslag', { amne: 'Latex', reaktion: 'Utslag' })).data;
    expect(h).toMatchObject({ amne: 'Latex', atc: null, lakemedel: false, allvarlighet: 'mattlig' });
    const okand = (await k.post('/api/overkanslighet/forslag', { amne: 'Blåbärsextrakt', reaktion: 'Utslag' })).data;
    expect(okand.atc).toBeNull();
    expect(okand.varfor.join(' ')).toContain('ingen ATC-kod');
    // Förslagen till ämnet kommer ur systemets lista och läkemedelskatalogen.
    expect((await k.get('/api/overkanslighet/amnen')).data.amnen.map(a => a.amne)).toEqual(expect.arrayContaining(['Penicilliner', 'Latex', 'Ibuprofen']));
  });

  test('nyregistrering: basfakta, uppmärksamhetssymbolen och varningen vid ordination uppdateras, med när, var och av vem', async () => {
    const k = await inloggad('lak-kard');
    const fore = (await k.get('/api/patient/p01/basfakta')).data;
    expect(fore.overkanslighet.some(o => o.amne === 'Ibuprofen')).toBe(false);
    const r = await ny(k, 'p01', { amne: 'ibuprofen', reaktion: 'Andningsbesvär och svullnad i svalget' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ amne: 'Ibuprofen', atc: 'M01AE01', allvarlighet: 'allvarlig', version: 1, vardenhet: { id: 'uso-kard' }, registreradAv: { namn: 'Sara Lindqvist' } });
    const efter = (await k.get('/api/patient/p01/basfakta')).data;
    const rad = efter.overkanslighet.find(o => o.amne === 'Ibuprofen');
    expect(rad).toMatchObject({ atc: 'M01AE01', allvarlighet: 'allvarlig', registrerad: { vardenhet: { id: 'uso-kard' }, av: 'Sara Lindqvist' } });
    expect(efter.fhir.overkanslighet).toContain(`AllergyIntolerance/${r.data.id}`);
    const h = (await k.get('/api/patient/p01')).data;
    expect(h.uppmarksamhet.poster.some(p => p.kategori === 'overkanslighet' && p.term === 'Ibuprofen' && p.grad === 'skadlig')).toBe(true);
    expect(['livshotande', 'skadlig']).toContain(h.uppmarksamhet.symbol.overkanslighet);
    expect(h.uppmarksamhet.kanAndraOverkanslighet).toBe(true);
    // Varningen vid ordination bygger på samma rad.
    const u = lakemedel.underlag(atk(db(k), 'lak-kard', 'p01', {}, 'ordinera'));
    const lm = db(k).query("SELECT * FROM katalog WHERE atc = 'M01AE01'").get();
    expect(lakemedel.varningar(db(k), 'p01', lm, u.aktiva, u).some(x => x.regel === 'overkanslighet' && x.text.includes('ibuprofen'))).toBe(true);
    // Händelsen loggas som en skrivning i journalen.
    expect(loggRader(k).some(x => x.handling === 'registrera_overkanslighet' && x.patient_id === 'p01' && x.resurs === `overkanslighet:${r.data.id}` && x.resultat === 'tillaten')).toBe(true);
    // Och den syns i FHIR.
    const fhir = (await k.get('/fhir/AllergyIntolerance?patient=p01')).data;
    expect(JSON.stringify(fhir)).toContain('M01AE01');
  });

  test('ändring blir en ny version med orsak, och den tidigare versionen finns kvar i historiken', async () => {
    const k = await inloggad('lak-kard');
    const id = (await ny(k, 'p01', { amne: 'Penicillin V', reaktion: 'Klåda' })).data.id;
    const andrad = await k.post(`/api/overkanslighet/${id}/andra`, { reaktion: 'Anafylaxi', orsak: 'Ny uppgift från patienten om tidigare reaktion.' });
    expect(andrad.status).toBe(200);
    expect(andrad.data).toMatchObject({ id, version: 2, reaktion: 'Anafylaxi', allvarlighet: 'allvarlig' });
    const hist = (await k.get('/api/patient/p01/overkanslighet')).data;
    const h = hist.historik.filter(x => x.overkanslighetId === id);
    expect(h.map(x => [x.handelse, x.version])).toEqual([['andrad', 2], ['registrerad', 1]]);
    expect(h[0]).toMatchObject({ orsak: 'Ny uppgift från patienten om tidigare reaktion.', av: { namn: 'Sara Lindqvist' }, vardenhet: { id: 'uso-kard' }, reaktion: 'Anafylaxi' });
    expect(h[1]).toMatchObject({ reaktion: 'Klåda', allvarlighet: 'lindrig' });
    // En ändring utan orsak, eller utan något som ändras, avvisas med en förklaring.
    expect((await k.post(`/api/overkanslighet/${id}/andra`, { reaktion: 'Utslag' })).status).toBe(400);
    const same = await k.post(`/api/overkanslighet/${id}/andra`, { reaktion: 'Anafylaxi', orsak: 'Ingen ändring' });
    expect(same.status).toBe(400);
    expect(same.data.fel).toContain('ingenting');
    // Historiken går inte att ändra eller radera.
    expect(() => db(k).query("UPDATE overkanslighet_handelser SET orsak = 'x' WHERE overkanslighet_id = ?").run(id)).toThrow();
    expect(() => db(k).query('DELETE FROM overkanslighet_handelser WHERE overkanslighet_id = ?').run(id)).toThrow();
  });

  test('avslut med orsak tar bort överkänsligheten ur basfakta och symbolen, men historiken visar den med vem och varför', async () => {
    const k = await inloggad('lak-vc');
    const p = 'p09';
    const fore = (await k.get(`/api/patient/${p}`)).data.uppmarksamhet.symbol.overkanslighet;
    expect(fore).toBe('livshotande');
    const jordnot = (await k.get(`/api/patient/${p}/basfakta`)).data.overkanslighet.find(o => o.amne === 'Jordnöt');
    const utanOrsak = await k.post(`/api/overkanslighet/${jordnot.id}/avsluta`, {});
    expect(utanOrsak.status).toBe(400);
    const r = await k.post(`/api/overkanslighet/${jordnot.id}/avsluta`, { orsak: 'Provokation utan reaktion på allergimottagningen.' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ handelse: 'avslutad', orsak: 'Provokation utan reaktion på allergimottagningen.' });
    expect((await k.get(`/api/patient/${p}/basfakta`)).data.overkanslighet.some(o => o.amne === 'Jordnöt')).toBe(false);
    expect((await k.get(`/api/patient/${p}`)).data.uppmarksamhet.symbol.overkanslighet).toBeNull();
    const hist = (await k.get(`/api/patient/${p}/overkanslighet`)).data;
    expect(hist.aktuella.some(o => o.amne === 'Jordnöt')).toBe(false);
    expect(hist.historik.find(x => x.handelse === 'avslutad')).toMatchObject({ amne: 'Jordnöt', av: { id: 'lak-vc' }, orsak: 'Provokation utan reaktion på allergimottagningen.' });
    // En avslutad överkänslighet kan inte avslutas eller ändras igen.
    expect((await k.post(`/api/overkanslighet/${jordnot.id}/avsluta`, { orsak: 'Igen' })).status).toBe(404);
  });

  test('fel roll, en spärrad vårdenhets rad och en rad som inte finns nekas, utan att något röjs', async () => {
    const lak = await inloggad('lak-kard');
    const d = db(lak);
    // En överkänslighet som har registrerats på den spärrade psykiatrin för p04.
    const dold = Number(d.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum, kalla) VALUES ('p04', 'uso-psyk', 'Sertralin', 'N06AB06', 'Utslag', 'mattlig', '2025-01-01', 'vardkallan')").run().lastInsertRowid);
    const finnsInte = await lak.post('/api/overkanslighet/999999/avsluta', { orsak: 'Test av något som inte finns' });
    const sparrad = await lak.post(`/api/overkanslighet/${dold}/avsluta`, { orsak: 'Test av något som inte finns' });
    expect(sparrad.status).toBe(404);
    expect(finnsInte.status).toBe(404);
    expect(sparrad.data).toEqual(finnsInte.data);
    const hist = await lak.get('/api/patient/p04/overkanslighet');
    expect(JSON.stringify(hist.data)).not.toContain('Sertralin');
    expect(JSON.stringify(hist.data)).not.toContain('psyk');
    // Med patientens samtycke syns raden och kan avslutas.
    await lak.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect(JSON.stringify((await lak.get('/api/patient/p04/overkanslighet')).data)).toContain('Sertralin');
    // Undersköterskan och vårdadministratören registrerar inte överkänslighet.
    const usk = await inloggad('usk-kard');
    expect((await ny(usk, 'p01', { amne: 'Latex', reaktion: 'Utslag' })).status).toBe(403);
    const adm = await inloggad('adm-kard');
    expect((await ny(adm, 'p01', { amne: 'Latex', reaktion: 'Utslag' })).status).toBe(403);
    expect((await adm.get('/api/patient/p01/overkanslighet')).status).toBe(403);
    // Utan vårdrelation nekas registreringen.
    const psyk = await inloggad('lak-psyk');
    expect((await ny(psyk, 'p01', { amne: 'Latex', reaktion: 'Utslag' })).status).toBe(403);
    // Sjuksköterskan registrerar.
    const ssk = await inloggad('ssk-kard');
    expect((await ny(ssk, 'p01', { amne: 'Latex', reaktion: 'Utslag' })).status).toBe(201);
  });

  test('skyddad identitet: svaret innehåller varken namn eller personnummer', async () => {
    const k = await inloggad('lak-vc');
    const r = await ny(k, 'p03', { amne: 'Latex', reaktion: 'Utslag' });
    expect(r.status).toBe(201);
    const pat = db(k).query("SELECT * FROM patienter WHERE id = 'p03'").get();
    const hist = (await k.get('/api/patient/p03/overkanslighet')).data;
    for (const t of [JSON.stringify(r.data), JSON.stringify(hist)]) {
      expect(t).not.toContain(pat.fornamn);
      expect(t).not.toContain(pat.personnummer.slice(0, 8));
    }
  });

  // Säkerhetsgranskningen av runda 10, r2: ändring och avslut prövas mot radens egen vårdenhet och vårdgivare, och en
  // överkänslighet raderas aldrig.
  test('en annan vårdenhets rad hos samma vårdgivare får ändras och avslutas, och avslutet lämnar raden kvar med historiken', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const pc = d.query("SELECT * FROM overkanslighet WHERE patient_id = 'p01' AND amne = 'Penicilliner'").get();
    expect(pc.enhet_id).toBe('uso-med');
    const a = await k.post(`/api/overkanslighet/${pc.id}/andra`, { reaktion: 'Urtikaria, svullnad i ansiktet och andningsbesvär', orsak: 'Kompletterat efter samtal med patienten.' });
    expect(a.status).toBe(200);
    expect(a.data).toMatchObject({ version: 2, vardenhet: { id: 'uso-med' } });
    const r = await k.post(`/api/overkanslighet/${pc.id}/avsluta`, { orsak: 'Negativ provokation med penicillin V.' });
    expect(r.status).toBe(200);
    const kvar = d.query('SELECT * FROM overkanslighet WHERE id = ?').get(pc.id);
    expect(kvar).toMatchObject({ status: 'avslutad', avslutad_av: 'lak-kard', avslut_orsak: 'Negativ provokation med penicillin V.' });
    expect(kvar.avslutad).toBeTruthy();
    expect((await k.get('/api/patient/p01/basfakta')).data.overkanslighet.some(o => o.id === pc.id)).toBe(false);
    const hist = (await k.get('/api/patient/p01/overkanslighet')).data;
    expect(hist.aktuella.some(o => o.id === pc.id)).toBe(false);
    expect(hist.historik.filter(h => h.overkanslighetId === pc.id).map(h => h.handelse)).toEqual(['avslutad', 'andrad']);
    // FHIR visar den avslutade som inaktiv, så att historiken går att följa.
    const fhir = JSON.stringify((await k.get('/fhir/AllergyIntolerance?patient=p01')).data);
    expect(fhir).toContain('"code":"inactive"');
    // Raden raderas aldrig, och en avslutad rad kan inte ändras igen.
    expect(() => d.query('DELETE FROM overkanslighet WHERE id = ?').run(pc.id)).toThrow();
    expect((await k.post(`/api/overkanslighet/${pc.id}/andra`, { reaktion: 'Utslag', orsak: 'Försök efter avslut' })).status).toBe(404);
  });

  test('en rad hos en annan vårdgivare och en spärrad vårdenhets rad kan inte ändras eller avslutas, och felet röjer inget', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const kommun = Number(d.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum, kalla) VALUES ('p01', 'kommun-demo', 'Plåster och tejp', NULL, 'Rodnad', 'lindrig', '2025-02-01', 'vardkallan')").run().lastInsertRowid);
    const ka = await k.post(`/api/overkanslighet/${kommun}/andra`, { reaktion: 'Utslag', orsak: 'Försök från regionen' });
    const kb = await k.post(`/api/overkanslighet/${kommun}/avsluta`, { orsak: 'Försök från regionen' });
    expect([403, 404]).toContain(ka.status);
    expect(kb.status).toBe(ka.status);
    expect(d.query('SELECT * FROM overkanslighet WHERE id = ?').get(kommun)).toMatchObject({ reaktion: 'Rodnad', version: 1 });
    // En spärrad vårdenhets rad: samma 404 som en rad som inte finns.
    const dold = Number(d.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum, kalla) VALUES ('p04', 'uso-psyk', 'Escitalopram', 'N06AB10', 'Utslag', 'mattlig', '2025-01-01', 'vardkallan')").run().lastInsertRowid);
    const finns = await k.post('/api/overkanslighet/999998/andra', { reaktion: 'Utslag', orsak: 'Försök på en rad som inte finns' });
    const sparr = await k.post(`/api/overkanslighet/${dold}/andra`, { reaktion: 'Utslag', orsak: 'Försök på en rad som inte finns' });
    expect(sparr.status).toBe(404);
    expect(sparr.data).toEqual(finns.data);
    // Inte heller med patientens samtycke till att visa den spärrade raden.
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect((await k.post(`/api/overkanslighet/${dold}/avsluta`, { orsak: 'Försök med samtycke' })).status).toBe(403);
    expect(d.query('SELECT status FROM overkanslighet WHERE id = ?').get(dold).status).toBe('aktiv');
    // Fel roll.
    const usk = await inloggad('usk-kard');
    const pc = db(usk).query("SELECT id FROM overkanslighet WHERE patient_id = 'p01' AND amne = 'Penicilliner'").get().id;
    expect((await usk.post(`/api/overkanslighet/${pc}/avsluta`, { orsak: 'Försök av undersköterskan' })).status).toBe(403);
  });
});
