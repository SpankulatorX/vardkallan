// Runda 10, r5, del 5: flödet på akutmottagningen, en högflödesmottagning (Sussa 3.2.3.5). Testnamnen finns i
// src/sussa/runda10-r5-tester.js. Testerna räknar bara de besök de själva skapar.
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { T } from '../src/sussa/runda10-r5-tester.js';
import * as akut from '../src/akutflode.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
async function inloggad(id) { const k = klient(app); await k.logga(id); return k; }
const STABIL = { andningsfrekvens: 16, saturation: 97, syrgas: 0, systoliskt: 128, diastoliskt: 80, puls: 78, medvetande: 'A', temp: 37.0 };

describe('Akutmottagningen', () => {
  test(T.akAnkomst.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const r = await k.post('/api/akut/ankomst', { patientId: 'p02', kontaktorsak: 'Bröstsmärta sedan en timme' });
    expect(r.status).toBe(201);
    // Systemet sätter könumret, ankomsttiden, akutbesöket på akutmottagningen och första steget.
    expect(r.data.konummer).toMatch(/^A\d{2}$/);
    expect(r.data).toMatchObject({ steg: 'vantar_triage', prioritet: null, kontaktorsak: 'Bröstsmärta sedan en timme' });
    const besok = s.db.query('SELECT * FROM akutbesok WHERE id = ?').get(r.data.id);
    const vk = s.db.query('SELECT * FROM vardkontakter WHERE id = ?').get(besok.vardkontakt_id);
    expect(vk).toMatchObject({ patient_id: 'p02', enhet_id: 'uso-akut', typ: 'akut', orsak: 'Bröstsmärta sedan en timme', slut: null });
    // Könumret är nästa lediga och syns i väntrummet.
    const vr = (await k.get('/api/vantrum')).data;
    expect(vr.map(v => v.konummer)).toContain(r.data.konummer);
    // En patient med ett pågående akutbesök registreras inte två gånger.
    expect((await k.post('/api/akut/ankomst', { patientId: 'p02', kontaktorsak: 'Igen' })).status).toBe(400);
    // Registreringen ger inte den som registrerade vårdrelation: det gör triagen eller bedömningen av en annan person.
    expect(vk.ger_vardrelation).toBe(0);
    // Bara akutmottagningens personal registrerar ankomster.
    const kard = await inloggad('lak-kard');
    expect((await kard.post('/api/akut/ankomst', { patientId: 'p06', kontaktorsak: 'Yrsel' })).status).toBe(403);
    expect(r.data.kontaktorsak).toBe('Bröstsmärta sedan en timme');
  });

  test(T.akTriage.split(' > ')[1], async () => {
    // Vitalparametrarna och kontaktorsaken ger prioriteten, och det strängaste vinner.
    expect(akut.triage({ kontaktorsak: 'Fotledsskada', vitaler: STABIL })).toMatchObject({ prioritet: 'gron' });
    const brost = akut.triage({ kontaktorsak: 'Bröstsmärta', vitaler: STABIL });
    expect(brost.prioritet).toBe('orange');
    expect(brost.varfor.join(' ')).toContain('Bröstsmärta');
    const sjuk = akut.triage({ kontaktorsak: 'Feber', vitaler: { ...STABIL, andningsfrekvens: 26, saturation: 90, puls: 125, systoliskt: 95 } });
    expect(sjuk.prioritet).toBe('rod');
    expect(sjuk.news2.poang).toBeGreaterThanOrEqual(7);
    // Saknas värden säger systemet vilka, och en parameter med 3 poäng räcker för orange.
    const del = akut.triage({ kontaktorsak: 'Yrsel', vitaler: { saturation: 88 } });
    expect(del.prioritet).toBe('orange');
    expect(del.varfor.join(' ')).toContain('Mät också');
    expect(akut.DEMOREGEL).toContain('inte RETTS');
    // Triagen via API:t sparar vitalparametrarna på akutbesöket och ger vårdrelation till den andra personen.
    const ssk = await inloggad('lak-akut');
    const s = sandlada(app, ssk);
    const besok = akut.registreraAnkomst(s.db, s.db.query("SELECT * FROM personal WHERE id = 'ssk-akut'").get(), { patientId: 'p06', kontaktorsak: 'Bröstsmärta' });
    const r = await ssk.post(`/api/akut/${besok.id}/triage`, { vitaler: STABIL });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ prioritet: 'orange', steg: 'vantar_lakare', triage: { av: { id: 'lak-akut' } } });
    const rad = s.db.query('SELECT * FROM akutbesok WHERE id = ?').get(besok.id);
    expect(s.db.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p06' AND enhet_id = 'uso-akut' AND vardkontakt_id = ?").get(rad.vardkontakt_id).n).toBe(5);
    expect(s.db.query('SELECT ger_vardrelation FROM vardkontakter WHERE id = ?').get(rad.vardkontakt_id).ger_vardrelation).toBe(1);
    expect((await ssk.get('/api/patient/p06/oversikt')).status).toBe(200);
  });

  test(T.akTavla.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const d = (await k.get('/api/akut')).data;
    // Seedens väntande patienter finns på tavlan med steg och prioritet, högst prioritet först.
    expect(d.tavla.length).toBeGreaterThanOrEqual(3);
    const ordning = { rod: 0, orange: 1, gul: 2, gron: 3, bla: 4 };
    const p = d.tavla.map(x => ordning[x.prioritet] ?? 9);
    expect(p).toEqual([...p].sort((a, b) => a - b));
    for (const x of d.tavla) {
      expect(typeof x.konummer).toBe('string');
      expect(typeof x.stegText).toBe('string');
      expect(Array.isArray(x.aktiviteter)).toBe(true);
      expect(typeof x.ledtider.vantatMin).toBe('number');
    }
    // Gruppering och urval: bara en prioritet, eller bara ett steg.
    const gula = (await k.get('/api/akut?prioritet=gul')).data.tavla;
    expect(gula.every(x => x.prioritet === 'gul')).toBe(true);
    expect(d.steg.map(x => x.id)).toEqual(['vantar_triage', 'vantar_lakare', 'vantar_aktivitet', 'bedomd', 'beslut']);
  });

  test(T.akAktivitet.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const besok = akut.registreraAnkomst(s.db, s.db.query("SELECT * FROM personal WHERE id = 'ssk-akut'").get(), { patientId: 'p07', kontaktorsak: 'Andningsbesvär' });
    await k.post(`/api/akut/${besok.id}/triage`, { vitaler: STABIL });
    expect((await k.post(`/api/akut/${besok.id}/bedomning`, {})).data.steg).toBe('bedomd');
    const a = await k.post(`/api/akut/${besok.id}/aktivitet`, { typ: 'rontgen' });
    expect(a.status).toBe(201);
    expect(a.data.steg).toBe('vantar_aktivitet');
    const akt = a.data.aktiviteter.find(x => x.typ === 'rontgen');
    expect(akt).toMatchObject({ text: 'Lungröntgen', planeradAv: { id: 'lak-akut' }, utford: null });
    const u = await k.post(`/api/akut/${besok.id}/aktivitet/${akt.id}/utford`, {});
    expect(u.data.aktiviteter.find(x => x.id === akt.id)).toMatchObject({ utfordAv: { id: 'lak-akut' } });
    expect(typeof u.data.aktiviteter.find(x => x.id === akt.id).utford).toBe('string');
    expect(u.data.steg).toBe('bedomd');
    // En okänd aktivitet förklaras.
    expect((await k.post(`/api/akut/${besok.id}/aktivitet`, { typ: 'okand' })).status).toBe(400);
  });

  test(T.akUt.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const ssk = s.db.query("SELECT * FROM personal WHERE id = 'ssk-akut'").get();
    const hem = akut.registreraAnkomst(s.db, ssk, { patientId: 'p12', kontaktorsak: 'Skärsår i handen' });
    await k.post(`/api/akut/${hem.id}/triage`, { vitaler: STABIL });
    const ut = await k.post(`/api/akut/${hem.id}/utregistrera`, { beslut: 'hem' });
    expect(ut.status).toBe(200);
    expect(ut.data).toMatchObject({ steg: 'klar', beslut: 'hem' });
    const rad = s.db.query('SELECT * FROM akutbesok WHERE id = ?').get(hem.id);
    expect(s.db.query('SELECT slut FROM vardkontakter WHERE id = ?').get(rad.vardkontakt_id).slut).toBeTruthy();
    expect((await k.get('/api/akut')).data.tavla.some(x => x.id === hem.id)).toBe(false);
    // Överföring till slutenvård: systemet skriver in patienten på avdelningen, från akutbesöket.
    const inl = akut.registreraAnkomst(s.db, ssk, { patientId: 'p18', kontaktorsak: 'Hjärtsvikt med andnöd' });
    await k.post(`/api/akut/${inl.id}/triage`, { vitaler: STABIL });
    const lagg = await k.post(`/api/akut/${inl.id}/utregistrera`, { beslut: 'inlaggning', enhetId: 'uso-kard-72' });
    expect(lagg.status).toBe(200);
    expect(lagg.data).toMatchObject({ steg: 'klar', beslut: 'inlaggning', vardtillfalle: { enhet: { id: 'uso-kard' } } });
    const vt = s.db.query("SELECT * FROM vardtillfallen WHERE patient_id = 'p18' AND utskriven IS NULL").get();
    expect(vt).toBeTruthy();
    // Utan beslut eller med en okänd avdelning stoppas utregistreringen med en förklaring.
    const tredje = akut.registreraAnkomst(s.db, ssk, { patientId: 'p19', kontaktorsak: 'Yrsel' });
    expect((await k.post(`/api/akut/${tredje.id}/utregistrera`, {})).status).toBe(400);
    expect((await k.post(`/api/akut/${tredje.id}/utregistrera`, { beslut: 'inlaggning', enhetId: 'finns-inte' })).status).toBe(400);
  });

  test(T.akSkyddad.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const d = (await k.get('/api/akut')).data;
    // Malin Engberg (p03) har skyddad identitet: tavlan har inget namn eller personnummer för henne.
    const skyddad = d.tavla.find(x => x.patientId === 'p03');
    expect(skyddad).toMatchObject({ skyddad: true, namn: null });
    expect(JSON.stringify(skyddad)).not.toMatch(/Malin|Engberg|198404162383/);
    // Utanför akutmottagningen syns bara könummer, prioritet och väntetid.
    const kard = await inloggad('lak-kard');
    const r = await kard.get('/api/akut');
    expect(r.status).toBe(200);
    for (const x of r.data.tavla) expect(Object.keys(x).sort()).toEqual(['konummer', 'ledtider', 'prioritet', 'steg', 'stegText']);
    expect(JSON.stringify(r.data)).not.toMatch(/p03|p13|Fotledsskada/);
    // En administratör utan väntrum, till exempel arkivarien, når inte tavlan.
    const ark = await inloggad('ark');
    expect((await ark.get('/api/akut')).status).toBe(403);
  });

  test(T.akLedtider.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const ssk = s.db.query("SELECT * FROM personal WHERE id = 'ssk-akut'").get();
    for (const pid of ['p02', 'p06', 'p07', 'p12', 'p18']) {
      const b = akut.registreraAnkomst(s.db, ssk, { patientId: pid, kontaktorsak: 'Skärsår' });
      await k.post(`/api/akut/${b.id}/triage`, { vitaler: STABIL });
      await k.post(`/api/akut/${b.id}/bedomning`, {});
      await k.post(`/api/akut/${b.id}/utregistrera`, { beslut: 'hem' });
    }
    const l = (await k.get('/api/akut/ledtider')).data;
    const gron = l.perPrioritet.find(x => x.prioritet === 'gron');
    expect(gron).toMatchObject({ visas: true, antal: 5 });
    expect(typeof gron.medianTillTriageMin).toBe('number');
    expect(typeof gron.medianTillLakareMin).toBe('number');
    expect(typeof gron.medianVistelseMin).toBe('number');
    // Färre än fem visas inte, och svaret har inga patientuppgifter.
    expect(l.perPrioritet.filter(x => x.prioritet !== 'gron').every(x => x.visas === false || x.antal >= 5)).toBe(true);
    expect(JSON.stringify(l)).not.toMatch(/p0\d|p1\d|personnummer|namn/);
  });

  test(T.akPrehospital.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    // Förvarningen kommer från den simulerade ambulansen, en egen avsändare.
    const f = await k.post('/api/demo/ambulans/forvarning', { personnummer: '194601198882', kontaktorsak: 'Misstänkt stroke', minuter: 10, vitaler: { ...STABIL, systoliskt: 185 } });
    expect(f.status).toBe(201);
    expect(f.data).toMatchObject({ kontaktorsak: 'Misstänkt stroke', forslagPrioritet: 'orange', identifierad: true });
    const d = (await k.get('/api/akut')).data;
    expect(d.forvarningar.some(x => x.id === f.data.id)).toBe(true);
    // När ambulansen kommer blir förvarningen en ankomst med de prehospitala uppgifterna. Triagen görs i sitt eget steg.
    const a = await k.post('/api/akut/ankomst', { forvarningId: f.data.id });
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ ankomstsatt: 'ambulans', kontaktorsak: 'Misstänkt stroke', prioritet: null, triage: null, prehospital: { fran: 'Ambulansen (simulerad)', forslagPrioritet: 'orange' } });
    expect((await k.get('/api/akut')).data.forvarningar.some(x => x.id === f.data.id)).toBe(false);
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p06' AND resurs = ?").get(`akut:forvarning:${f.data.id}:mottagen`).n).toBe(1);
    // Ett personnummer som inte finns ger ingen patient, och mottagningen tar aldrig patienten från anropet.
    const okand = await k.post('/api/demo/ambulans/forvarning', { personnummer: '191212121212', kontaktorsak: 'Trafikolycka', minuter: 5, vitaler: STABIL });
    expect(okand.data.identifierad).toBe(false);
    const nej = await k.post('/api/akut/ankomst', { forvarningId: okand.data.id, patientId: 'p07' });
    expect(nej.status).toBe(400);
    expect(nej.data.fel).toContain('reservnummer');
    expect((await k.post('/api/akut/ankomst', { forvarningId: okand.data.id, patientId: 'p999' })).status).toBe(400);
    expect(s.db.query("SELECT count(*) AS n FROM akutbesok WHERE patient_id IN ('p07', 'p999')").get().n).toBe(0);
    // Ett tak per sandlåda för förvarningar som inte är mottagna.
    const oppna = s.db.query('SELECT count(*) AS n FROM akut_forvarningar WHERE mottagen IS NULL').get().n;
    for (let i = oppna; i < akut.MAX_FORVARNINGAR; i++) akut.forvarning(s.db, { kontaktorsak: 'Fall', vitaler: STABIL });
    expect((await k.post('/api/demo/ambulans/forvarning', { kontaktorsak: 'Fall', vitaler: STABIL })).status).toBe(429);
  });

  test(T.akAmbulansSvar.split(' > ')[1], async () => {
    // En session i demon, utan inloggning, som sidan har.
    const k = klient(app);
    await k.get('/api/session');
    const s = sandlada(app, k);
    // Malin Engberg (p03) har skyddad identitet. Svaret säger bara att patienten är identifierad.
    for (const pnr of ['198404162383', '194601198882', '191212121212']) {
      const r = await k.post('/api/demo/ambulans/forvarning', { personnummer: pnr, kontaktorsak: 'Fall', minuter: 5, vitaler: STABIL });
      expect(r.status).toBe(201);
      expect(Object.keys(r.data).sort()).toEqual(['beraknad', 'forslagPrioritet', 'id', 'identifierad', 'kontaktorsak', 'tid']);
      expect(JSON.stringify(r.data)).not.toMatch(/p03|p06|Malin|Engberg|Birgitta|Nyman|skyddad|198404|194601|patientId|namn/);
    }
    // Identiteten syns bara på akutens tavla, och aldrig namnet för en patient med skyddad identitet.
    await k.logga('lak-akut');
    const fv = (await k.get('/api/akut')).data.forvarningar;
    const malin = fv.find(f => f.patientId === 'p03');
    expect(malin).toMatchObject({ skyddad: true, namn: null });
    await k.logga('lak-kard');
    expect((await k.get('/api/akut')).data.forvarningar).toEqual([]);
    // Utan session nekas anropet.
    const utan = klient(app);
    expect((await utan.post('/api/demo/ambulans/forvarning', { kontaktorsak: 'Fall', vitaler: STABIL })).status).toBe(401);
    // Taket per session och timme.
    let senast = null;
    for (let i = 0; i < akut.MAX_FORVARNINGAR_PER_TIMME; i++) senast = await k.post('/api/demo/ambulans/forvarning', { kontaktorsak: 'Fall', vitaler: STABIL });
    expect(senast.status).toBe(429);
    void s;
  });

  test(T.akDirekt.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const r = await k.post('/api/akut/ankomst', { patientId: 'p20', kontaktorsak: 'Yrsel', ankomstsatt: 'ambulans', prioritet: 'rod', triageData: { varfor: ['Påhittad'] }, prehospital: { fran: 'Ambulansen (simulerad)' } });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ ankomstsatt: 'egen', prioritet: null, triage: null, prehospital: null, steg: 'vantar_triage' });
    const b = s.db.query('SELECT * FROM akutbesok WHERE id = ?').get(r.data.id);
    expect(b.triage_av).toBeNull();
    expect(s.db.query('SELECT ger_vardrelation FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id).ger_vardrelation).toBe(0);
    // Triagen räknas av systemet: en prioritet i anropet godtas inte.
    const t = await k.post(`/api/akut/${r.data.id}/triage`, { vitaler: STABIL, prioritet: 'rod' });
    expect(t.data.prioritet).toBe('gron');
  });

  test(T.akRelation.split(' > ')[1], async () => {
    const k = await inloggad('lak-akut');
    const s = sandlada(app, k);
    const rel = (id) => s.db.query('SELECT v.ger_vardrelation AS g FROM akutbesok b JOIN vardkontakter v ON v.id = b.vardkontakt_id WHERE b.id = ?').get(id).g;
    // Samma person registrerar och triagerar: ingen vårdrelation.
    const egen = (await k.post('/api/akut/ankomst', { patientId: 'p21', kontaktorsak: 'Hosta' })).data;
    await k.post(`/api/akut/${egen.id}/triage`, { vitaler: STABIL });
    await k.post(`/api/akut/${egen.id}/bedomning`, {});
    expect(rel(egen.id)).toBe(0);
    // En förvarning som personalen själv skickar och tar emot ger inte heller någon vårdrelation.
    const f = (await k.post('/api/demo/ambulans/forvarning', { personnummer: '194601198882', kontaktorsak: 'Bröstsmärta', minuter: 3, vitaler: STABIL })).data;
    const a = (await k.post('/api/akut/ankomst', { forvarningId: f.id })).data;
    await k.post(`/api/akut/${a.id}/triage`, { vitaler: STABIL });
    expect(rel(a.id)).toBe(0);
    // När en annan person triagerar eller bedömer patienten bekräftas relationen, och det loggas.
    const b = akut.registreraAnkomst(s.db, s.db.query("SELECT * FROM personal WHERE id = 'ssk-akut'").get(), { patientId: 'p61', kontaktorsak: 'Feber' });
    expect(rel(b.id)).toBe(0);
    await k.post(`/api/akut/${b.id}/triage`, { vitaler: STABIL });
    expect(rel(b.id)).toBe(1);
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND resurs = ? AND personal_id = 'lak-akut'").get(`akut:${b.id}:vardrelation`).n).toBe(1);
  });
});
