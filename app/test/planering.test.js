import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { stallKlockan, aterstallKlockan } from './falsk-klocka.js';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { idag, addDagar, datumAv, lokalTid } from '../src/db.js';
import { harVardrelation } from '../src/atkomst.js';

// Planering och tidbok, del 2 (runda 6, r4, Sussa 3.4.1.2 till 3.4.1.8, 3.4.2.2, 3.4.3.3 och 3.4.4.5). Systemet är
// experten: den som bokar ser aldrig vilket rum eller vilken utrustning ett ingrepp kräver, och behöver inte räkna ut
// när provtagningen ska vara. Systemet föreslår bara tider där allt är ledigt och bokar allt med ett klick.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const postMed = (k, villkor) => db(k).query(`SELECT v.* FROM vantelista v JOIN vantelista_behov b ON b.vantelista_id = v.id WHERE ${villkor} AND v.status = 'vantar'`).get();
const elkonvertering = (k) => postMed(k, "b.ingrepp = 'elkonvertering'");
const kedjepost = (k) => postMed(k, "b.mall = 'provtagning-fore'");
const resurserFor = (k, bid) => db(k).query('SELECT rb.*, r.kategori, r.namn FROM resursbokningar rb JOIN resurser r ON r.id = rb.resurs_id WHERE rb.bokning_id = ? ORDER BY rb.id').all(bid);
const kallelser = (k, bid) => db(k).query('SELECT * FROM kallelser WHERE bokning_id = ? ORDER BY id').all(bid);
const MIN = 60_000;
// Två klienter i samma sandlåda, till exempel patienten i Min journal och vårdadministratören.
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
// Uppgifter om patienterna som aldrig får finnas i ett svar utan patientuppgifter.
const PATIENTUPPGIFTER = (d) => d.query('SELECT id, fornamn, efternamn, personnummer FROM patienter').all().flatMap(p => [`"${p.id}"`, p.efternamn, p.personnummer, p.personnummer.slice(0, 8)]);

afterEach(() => aterstallKlockan());

describe('Planering', () => {
  test('seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver', async () => {
    const d = nyDb();
    const r = d.query('SELECT * FROM resurser ORDER BY id').all();
    expect(r.map(x => x.kategori).sort()).toEqual(['behandlingsrum', 'behandlingsrum', 'defibrillator', 'transport']);
    expect(r.find(x => x.kategori === 'transport')).toMatchObject({ demo: 1, namn: 'Sjukresa (simulerad)' });
    expect(d.query("SELECT count(*) AS n FROM tider WHERE tidstyp = 'ingrepp'").get().n).toBeGreaterThan(20);
    expect(d.query("SELECT count(*) AS n FROM tider WHERE tidstyp = 'provtagning'").get().n).toBeGreaterThan(100);
    const k = await inloggad('adm-kard');
    const m = (await k.get('/api/bokningsmallar')).data;
    expect(m.ingrepp.find(i => i.id === 'elkonvertering')).toMatchObject({ text: 'Elkonvertering', tidstypText: 'Ingrepp', yrkesrollText: 'läkare', krav: ['Behandlingsrum', 'Defibrillator'] });
    expect(m.mallar.find(x => x.id === 'provtagning-fore')).toMatchObject({ namn: 'Provtagning före läkarbesök' });
    expect(m.resurser.map(x => x.namn)).toContain('Defibrillator, mobil');
    expect(m.resurser.find(x => x.kategori === 'transport')).toMatchObject({ demo: true });
  });

  test('systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt', async () => {
    const k = await inloggad('adm-kard');
    const post = elkonvertering(k);
    expect(post).toMatchObject({ patient_id: 'p14', tidstyp: 'ingrepp' });
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    expect(f.post.ingrepp).toMatchObject({ id: 'elkonvertering', text: 'Elkonvertering' });
    expect(f.forslag.length).toBe(3);
    // Defibrillatorn är på service en dag (seeden). Ingen tid den dagen föreslås, fast läkarna har ingreppstider då.
    const service = db(k).query("SELECT * FROM resursbokningar WHERE bokning_id IS NULL AND resurs_id = 'res-kard-defib'").get();
    expect(db(k).query("SELECT count(*) AS n FROM tider WHERE tidstyp = 'ingrepp' AND start >= ? AND start < ?").get(service.start, service.slut).n).toBeGreaterThan(0);
    for (const x of f.forslag) {
      expect(x.tidstyp).toBe('ingrepp');
      expect(x.start >= service.slut || x.slut <= service.start).toBe(true);
      expect(x.resurser.map(r => r.kategori)).toEqual(['behandlingsrum', 'defibrillator', 'transport']);
      expect(x.skal.join(' ')).toContain('Behandlingsrum och defibrillator är lediga hela tiden.');
    }
    const forsta = f.forslag[0];
    const bok = await k.post(`/api/vantelista/${post.id}/boka`, { tidId: forsta.tidId });
    expect(bok.status).toBe(201);
    expect(bok.data.resurser.map(r => r.namn)).toEqual(['Behandlingsrum 1', 'Defibrillator, mobil', 'Sjukresa (simulerad)']);
    const res = resurserFor(k, bok.data.id);
    expect(res.map(r => r.kategori)).toEqual(['behandlingsrum', 'defibrillator', 'transport']);
    // Sjukresan hämtar en timme före och kör hem en timme efter (demoregel).
    expect(Date.parse(res[2].start)).toBe(Date.parse(forsta.start) - 60 * MIN);
    expect(Date.parse(res[2].slut)).toBe(Date.parse(forsta.slut) + 60 * MIN);
    const k1 = kallelser(k, bok.data.id)[0];
    expect(k1.text).toContain('Elkonvertering hos läkare');
    expect(k1.text).toContain('Plats: Behandlingsrum 1, Kardiologiska mottagningen');
    expect(k1.text).toContain('Ät och drick inget');
    expect(k1.text).toContain('En sjukresa är bokad åt dig. Den är simulerad i demon.');
    expect(k1.text).not.toContain('förmaksflimmer');
    // Nu är defibrillatorn upptagen: ett nytt ingrepp föreslås aldrig samtidigt, inte heller hos den andra läkaren.
    const ny = await k.post('/api/patient/p01/vantelista', { ingrepp: 'elkonvertering', inomDagar: 60 });
    expect(ny.status).toBe(201);
    expect(ny.data).toMatchObject({ tidstyp: 'ingrepp', yrkesroll: 'lakare', ingrepp: { id: 'elkonvertering' } });
    const f2 = (await k.get(`/api/vantelista/${ny.data.id}/forslag`)).data;
    expect(f2.forslag.length).toBeGreaterThan(0);
    for (const x of f2.forslag) expect(x.start < forsta.slut && x.slut > forsta.start).toBe(false);
    // En samtidig ingreppstid hos den andra läkaren finns, men kan inte bokas, eftersom defibrillatorn saknas.
    const samtidig = db(k).query("SELECT t.id FROM tider t WHERE t.tidstyp = 'ingrepp' AND t.start = ? AND t.id <> ?").get(forsta.start, forsta.tidId);
    if (samtidig) {
      const r = await k.post(`/api/vantelista/${ny.data.id}/boka`, { tidId: samtidig.id });
      expect(r.status).toBe(400);
      expect(r.data.fel).toContain('Rummet eller utrustningen');
    }
  });

  test('ombokning flyttar rum, utrustning och sjukresa, och avbokning släpper dem', async () => {
    const k = await inloggad('adm-kard');
    const post = elkonvertering(k);
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    const bok = (await k.post(`/api/vantelista/${post.id}/boka`, { tidId: f.forslag[0].tidId })).data;
    const fo = (await k.get(`/api/bokning/${bok.id}/forslag`)).data;
    expect(fo.forslag.length).toBeGreaterThan(0);
    for (const x of fo.forslag) expect(x.resurser.length).toBe(3);
    const om = await k.post(`/api/bokning/${bok.id}/omboka`, { tidId: fo.forslag[0].tidId });
    expect(om.status).toBe(200);
    expect(resurserFor(k, om.data.id).length).toBe(3);
    expect(om.data.resurser.length).toBe(3);
    // Den gamla tiden är fri igen: ett nytt ingrepp kan få den.
    const ny = (await k.post('/api/patient/p01/vantelista', { ingrepp: 'elkonvertering', inomDagar: 60 })).data;
    const f3 = (await k.get(`/api/vantelista/${ny.id}/forslag`)).data;
    expect(f3.forslag.some(x => x.start === bok.tid.start)).toBe(true);
    const av = await k.post(`/api/bokning/${om.data.id}/avboka`, { orsak: 'Patienten är förkyld' });
    expect(av.status).toBe(200);
    const f4 = (await k.get(`/api/vantelista/${ny.id}/forslag`)).data;
    expect(f4.forslag.some(x => x.start === om.data.tid.start)).toBe(true);
  });

  test('provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick', async () => {
    const k = await inloggad('adm-kard');
    const post = kedjepost(k);
    expect(post).toMatchObject({ patient_id: 'p01', tidstyp: 'aterbesok' });
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    expect(f.post.mall).toMatchObject({ id: 'provtagning-fore', namn: 'Provtagning före läkarbesök' });
    expect(f.forslag.length).toBe(3);
    for (const x of f.forslag) {
      expect(x.fore).toBeTruthy();
      expect(datumAv(new Date(x.fore.start))).toBe(datumAv(new Date(x.start)));
      const mellan = (Date.parse(x.start) - Date.parse(x.fore.slut)) / MIN;
      expect(mellan).toBeGreaterThanOrEqual(60);
      expect(mellan).toBeLessThanOrEqual(150);
      expect(x.skal.join(' ')).toContain('Provtagning klockan');
    }
    const bok = await k.post(`/api/vantelista/${post.id}/boka`, { tidId: f.forslag[0].tidId });
    expect(bok.status).toBe(201);
    expect(bok.data.kedja).toMatchObject({ roll: 'huvud', fore: { tid: { tidstyp: 'provtagning', start: f.forslag[0].fore.start } } });
    const fore = db(k).query('SELECT b.* FROM bokningskedjor k JOIN bokningar b ON b.id = k.bokning_id WHERE k.huvud_id = ?').get(bok.data.id);
    expect(fore).toMatchObject({ patient_id: 'p01', status: 'bokad' });
    expect(db(k).query('SELECT tidstyp FROM tider WHERE id = ?').get(fore.tid_id).tidstyp).toBe('provtagning');
    // En kallelse för båda tiderna, inte två.
    expect(kallelser(k, fore.id).length).toBe(0);
    const k1 = kallelser(k, bok.data.id);
    expect(k1.length).toBe(1);
    expect(k1[0].text).toContain('Före besöket: provtagning klockan');
    expect(db(k).query("SELECT status FROM vantelista WHERE id = ?").get(post.id).status).toBe('bokad');
    // Ett förslag som systemet inte kan para ihop med en provtagning går inte att boka.
    const utan = db(k).query("SELECT t.id FROM tider t WHERE t.schema_id = 'sch-kard-sara' AND t.tidstyp = 'nybesok' AND t.start > ? AND substr(t.start, 12, 5) IN ('07:00', '06:00') ORDER BY t.start").get(new Date(Date.now() + 3 * 86400_000).toISOString());
    expect(utan).toBeTruthy();
    const p2 = (await k.post('/api/patient/p01/vantelista', { tidstyp: 'nybesok', mall: 'provtagning-fore', inomDagar: 60 })).data;
    expect(p2.mall).toMatchObject({ id: 'provtagning-fore' });
    const nej = await k.post(`/api/vantelista/${p2.id}/boka`, { tidId: utan.id });
    expect(nej.status).toBe(400);
    expect(nej.data.fel).toContain('provtagning');
  });

  test('tider i följd: ombokning flyttar provtagningen med, och avbokning avbokar båda', async () => {
    const k = await inloggad('adm-kard');
    const post = kedjepost(k);
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    const bok = (await k.post(`/api/vantelista/${post.id}/boka`, { tidId: f.forslag[0].tidId })).data;
    const gammalFore = bok.kedja.fore.id;
    const fo = (await k.get(`/api/bokning/${bok.id}/forslag`)).data;
    for (const x of fo.forslag) expect(x.fore).toBeTruthy();
    const om = (await k.post(`/api/bokning/${bok.id}/omboka`, { tidId: fo.forslag[0].tidId })).data;
    expect(om.kedja.fore.tid.start).toBe(fo.forslag[0].fore.start);
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(gammalFore).status).toBe('ombokad');
    // Bara huvudbokningen får beskedet om den nya tiden, och det säger när provtagningen är.
    expect(kallelser(k, om.kedja.fore.id).length).toBe(0);
    expect(kallelser(k, om.id).at(-1).text).toContain('Före besöket: provtagning klockan');
    // Provtagningen bokas inte om för sig.
    expect((await k.get(`/api/bokning/${om.kedja.fore.id}/forslag`)).status).toBe(400);
    const av = await k.post(`/api/bokning/${om.id}/avboka`, { orsak: 'Patienten är inlagd' });
    expect(av.status).toBe(200);
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(om.kedja.fore.id).status).toBe('avbokad');
    expect(kallelser(k, om.id).at(-1).text).toContain('Provtagningen före besöket är också avbokad.');
  });

  test('tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter', async () => {
    const k = await inloggad('adm-kard');
    const post = elkonvertering(k);
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    const bok = (await k.post(`/api/vantelista/${post.id}/boka`, { tidId: f.forslag[0].tidId })).data;
    const datum = datumAv(new Date(bok.tid.start));
    const t = (await k.get(`/api/tidbok?datum=${datum}`)).data;
    const defib = t.resurser.find(r => r.namn === 'Defibrillator, mobil');
    expect(defib).toMatchObject({ typText: 'Utrustning' });
    expect(defib.bokningar.find(b => b.start === bok.tid.start)).toMatchObject({ text: 'Elkonvertering', patient: { id: 'p14' } });
    expect(t.mallar.map(m => m.namn)).toEqual(expect.arrayContaining(['Elkonvertering', 'Provtagning före läkarbesök']));
    const anon = (await k.get(`/api/tidbok?datum=${datum}&avidentifierad=1`)).data;
    const json = JSON.stringify(anon);
    for (const u of PATIENTUPPGIFTER(db(k))) expect(json).not.toContain(u);
    expect(anon.resurser.find(r => r.namn === 'Defibrillator, mobil').bokningar.find(b => b.start === bok.tid.start)).toMatchObject({ text: 'Upptagen' });
  });

  test('egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen', async () => {
    const lak = await inloggad('lak-kard');
    const fo = (await lak.get('/api/bevakningar/forslag?patientId=p01')).data;
    expect(fo.datum).toBe(addDagar(idag(), 7));
    expect(fo.ansvarig.id).toBe('lak-kard');
    expect(fo.ansvariga.map(a => a.id)).toEqual(expect.arrayContaining(['lak-kard', 'adm-kard', 'enheten']));
    expect(fo.texter.length).toBeGreaterThan(2);
    const r = await lak.post('/api/bevakningar', { patientId: 'p01', text: 'Ring patienten om provsvaren.', datum: idag(), ansvarigId: 'adm-kard' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ text: 'Ring patienten om provsvaren.', datum: idag(), ansvarig: { id: 'adm-kard' }, patient: { id: 'p01' } });
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'bevaka', resultat: 'tillaten' });
    // Utan ansvarig blir det den som lägger upp den. Enhetsnivå utan patient.
    const egen = await lak.post('/api/bevakningar', { text: 'Följ upp provsvaren på hela listan.', datum: idag() });
    expect(egen.status).toBe(201);
    expect(egen.data).toMatchObject({ ansvarig: { id: 'lak-kard' }, patient: null });
    const enh = await lak.post('/api/bevakningar', { text: 'Beställ elektroder till defibrillatorn.', datum: idag(), ansvarigId: 'enheten' });
    expect(enh.data).toMatchObject({ ansvarig: null, enhetsniva: true });
    const ink = (await lak.get('/api/inkorg')).data;
    const texter = ink.egnaBevakningar.map(b => b.text);
    expect(texter).toEqual(expect.arrayContaining(['Följ upp provsvaren på hela listan.', 'Beställ elektroder till defibrillatorn.']));
    expect(texter).not.toContain('Ring patienten om provsvaren.');
    // Samma sandlåda, vårdadministratören: sin egen och enhetens, i Dagens arbete.
    await lak.logga('adm-kard');
    const s = (await lak.get('/api/idag')).data;
    const t2 = s.bevakningar.map(b => b.text);
    expect(t2).toEqual(expect.arrayContaining(['Ring patienten om provsvaren.', 'Beställ elektroder till defibrillatorn.', 'Gå igenom väntelistan inför nästa månad.']));
    expect(t2).not.toContain('Följ upp provsvaren på hela listan.');
    const b = s.bevakningar.find(x => x.text === 'Ring patienten om provsvaren.');
    expect(b).toMatchObject({ egen: true, skapadAv: { id: 'lak-kard' }, atgard: { typ: 'egen_bevakning_klar' } });
    expect((await lak.post(`/api/egen-bevakning/${b.id}/klar`)).status).toBe(200);
    expect((await lak.get('/api/idag')).data.bevakningar.some(x => x.text === 'Ring patienten om provsvaren.')).toBe(false);
  });

  test('egna bevakningar: utan vårdrelation, med fel ansvarig eller på en annan vårdenhet nekas, och skyddad identitet maskeras', async () => {
    const lak = await inloggad('lak-kard');
    const nej = await lak.post('/api/bevakningar', { patientId: 'p12', text: 'Ring patienten.', datum: idag() });
    expect(nej.status).toBe(403);
    expect(loggRader(lak).at(-1)).toMatchObject({ patient_id: 'p12', handling: 'bevaka', resultat: 'nekad' });
    expect(db(lak).query("SELECT count(*) AS n FROM egna_bevakningar WHERE patient_id = 'p12'").get().n).toBe(0);
    expect((await lak.post('/api/bevakningar', { patientId: 'p01', text: 'Ring patienten.', datum: idag(), ansvarigId: 'lak-vc' })).status).toBe(400);
    expect((await lak.post('/api/bevakningar', { patientId: 'p01', text: '', datum: idag() })).status).toBe(400);
    expect((await lak.post('/api/bevakningar', { patientId: 'p01', text: 'Ring.', datum: '2020-01-01' })).status).toBe(400);
    // En bevakning på psykiatrin om en patient med spärr syns aldrig på kardiologen, inte ens att den finns.
    const psyk = await inloggad('lak-psyk');
    expect((await psyk.post('/api/bevakningar', { patientId: 'p04', text: 'Hemlig uppföljning på psykiatrin.', datum: idag(), ansvarigId: 'enheten' })).status).toBe(201);
    const id = db(psyk).query("SELECT id FROM egna_bevakningar WHERE text = 'Hemlig uppföljning på psykiatrin.'").get().id;
    await psyk.logga('adm-kard');
    expect(JSON.stringify((await psyk.get('/api/idag')).data)).not.toContain('Hemlig uppföljning');
    expect((await psyk.post(`/api/egen-bevakning/${id}/klar`)).status).toBe(403);
    await psyk.logga('lak-kard');
    expect(JSON.stringify((await psyk.get('/api/inkorg')).data)).not.toContain('Hemlig uppföljning');
    // Skyddad identitet på vårdcentralen.
    const vc = await inloggad('lak-vc');
    expect((await vc.post('/api/bevakningar', { patientId: 'p03', text: 'Ring om provsvaren.', datum: idag() })).status).toBe(201);
    const rad = (await vc.get('/api/inkorg')).data.egnaBevakningar.find(b => b.text === 'Ring om provsvaren.');
    expect(rad.patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    expect(JSON.stringify(rad)).not.toContain('Engberg');
  });

  test('Dagens arbete visar en fritt vald tidsperiod', async () => {
    const k = await inloggad('adm-kard');
    const s = (await k.get(`/api/idag?fran=${idag()}&till=${addDagar(idag(), 9)}`)).data;
    expect(s.period).toMatchObject({ fran: idag(), till: addDagar(idag(), 9) });
    // Mikael Svenssons telefontid om sex dagar finns med, men bara dagens patienter checkas in.
    expect(s.dagens.some(d => d.patient.id === 'p14')).toBe(true);
    for (const d of s.dagens.filter(x => x.datum !== idag())) expect(d.rad.atgard?.typ === 'checka_in').toBe(false);
    expect(s.dagens.every(d => d.datum >= idag() && d.datum <= addDagar(idag(), 9))).toBe(true);
    const bara = (await k.get('/api/idag')).data;
    expect(bara.period).toMatchObject({ fran: idag(), till: idag() });
    expect(bara.dagens.every(d => d.datum === idag())).toBe(true);
    expect((await k.get(`/api/idag?fran=${idag()}&till=${addDagar(idag(), 40)}`)).status).toBe(400);
    expect((await k.get(`/api/idag?fran=${addDagar(idag(), 3)}&till=${idag()}`)).status).toBe(400);
  });

  test('anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen', async () => {
    const adm = await inloggad('adm-kard');
    const v = (await adm.get('/api/vy/tidbok')).data;
    expect(v).toMatchObject({ vy: 'tidbok', sparad: false, installning: { vardgivare: 'alla', resurser: true } });
    expect(v.alternativ.vardgivare.map(x => x.id)).toEqual(expect.arrayContaining(['sch-kard-sara', 'sch-kard-lina']));
    // Läkaren ser sitt eget schema som förval.
    const lak = await inloggad('lak-kard');
    expect((await lak.get('/api/vy/tidbok')).data.installning).toMatchObject({ vardgivare: 'mina', resurser: false });
    const t = (await lak.get('/api/tidbok')).data;
    expect(t.scheman.map(s => s.id)).toEqual(['sch-kard-sara']);
    expect(t.vy).toMatchObject({ vardgivare: 'mina' });
    // Läkaren kan inte boka om från tidboken.
    const b = db(lak).query("SELECT id FROM bokningar WHERE status = 'bokad' AND patient_id = 'p14'").get();
    expect((await lak.post(`/api/bokning/${b.id}/omboka`, { tidId: 1 })).status).toBe(403);
    const spara = await lak.put('/api/vy/tidbok', { installning: { vardgivare: ['sch-kard-sara', 'sch-kard-lina'], resurser: true } });
    expect(spara.status).toBe(200);
    expect(spara.data).toMatchObject({ sparad: true });
    expect((await lak.get('/api/tidbok')).data.scheman.map(s => s.id).sort()).toEqual(['sch-kard-lina', 'sch-kard-sara']);
    expect((await lak.put('/api/vy/tidbok', { installning: { vardgivare: ['sch-vc-per'] } })).status).toBe(400);
    expect((await lak.put('/api/vy/okand', { installning: {} })).status).toBe(404);
    // Dagens arbete: vårdadministratören väljer vilka delar som visas.
    expect((await adm.get('/api/vy/idag')).data.installning.sektioner).toEqual(['dagens', 'remisser', 'vantelista', 'kallelser', 'bevakningar']);
    expect((await adm.put('/api/vy/idag', { installning: { sektioner: ['dagens', 'bevakningar'] } })).status).toBe(200);
    expect((await adm.get('/api/idag')).data.vy).toMatchObject({ sektioner: ['dagens', 'bevakningar'] });
    expect((await adm.put('/api/vy/idag', { installning: { sektioner: ['okand'] } })).status).toBe(400);
    expect((await adm.post('/api/vy/idag/aterstall')).data).toMatchObject({ sparad: false });
    // Inställningen är personlig: den finns på servern för den som sparade den.
    expect(db(lak).query("SELECT personal_id FROM vyinstallningar WHERE vy = 'tidbok'").all().map(r => r.personal_id)).toEqual(['lak-kard']);
  });

  test('väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel', async () => {
    const k = await inloggad('adm-kard');
    const s = await k.get('/api/vantelista/statistik');
    expect(s.status).toBe(200);
    expect(s.data.vardenhet).toMatchObject({ namn: 'Kardiologiska kliniken USÖ' });
    const vantar = db(k).query("SELECT count(*) AS n FROM vantelista WHERE enhet_id = 'uso-kard' AND status = 'vantar'").get().n;
    expect(s.data.totalt.vantar).toBe(vantar);
    expect(s.data.grupper.reduce((a, g) => a + g.vantar, 0)).toBe(vantar);
    const g = s.data.grupper.find(x => x.tidstyp === 'ingrepp');
    expect(g).toMatchObject({ tidstypText: 'Ingrepp', yrkesrollText: 'läkare', vantar: 1 });
    expect(s.data.demoregler).toContain('vårdgarantin');
    const json = JSON.stringify(s.data);
    for (const u of PATIENTUPPGIFTER(db(k))) expect(json).not.toContain(u);
    expect(json).not.toContain('Elkonvertering vid förmaksflimmer');
    // Regionnivå för uppföljningen, inte för vårdadministratören.
    expect((await k.get('/api/vantelista/statistik?niva=region')).status).toBe(403);
    const u = await inloggad('uppf');
    const r = (await u.get('/api/vantelista/statistik?niva=region')).data;
    expect(r.vardenheter.map(v => v.vardenhet.namn)).toEqual(expect.arrayContaining(['Kardiologiska kliniken USÖ', 'Vårdcentralen Tybble']));
    const json2 = JSON.stringify(r);
    for (const x of PATIENTUPPGIFTER(db(u))) expect(json2).not.toContain(x);
    // Få patienter visas bara som antal, utan väntetider.
    for (const v of r.vardenheter) for (const gr of v.grupper) if (gr.vantar < 3) expect(gr.medianDagar).toBeNull();
  });
});

describe('Kallelser, del 2', () => {
  test('kallelsen skrivs på patientens språk, och patienten väljer språk i Min journal', async () => {
    const inv = await invanare('inv-p11');
    const sp = (await inv.get('/api/min/journal/p11/sprak')).data;
    expect(sp).toMatchObject({ sprak: 'en', text: 'Engelska' });
    expect(sp.alternativ.map(a => a.id)).toEqual(['sv', 'en']);
    expect((await inv.post('/api/min/journal/p11/sprak', { sprak: 'fr' })).status).toBe(400);
    // Vårdadministratören sätter upp ett återbesök och bokar, i samma sandlåda. Kallelsen blir på engelska.
    const k = await inloggad('adm-kard');
    delaSandlada(inv, k);
    const p = (await k.post('/api/patient/p11/vantelista', { tidstyp: 'aterbesok', yrkesroll: 'lakare', inomDagar: 30 })).data;
    const f = (await k.get(`/api/vantelista/${p.id}/forslag`)).data;
    const b = (await k.post(`/api/vantelista/${p.id}/boka`, { tidId: f.forslag[0].tidId })).data;
    expect(b.kallelse).toMatchObject({ sprak: 'en', sprakText: 'Engelska' });
    expect(b.kallelse.text).toContain('Dear Anna,');
    expect(b.kallelse.text).toContain('You have an appointment.');
    expect(b.kallelse.text).not.toContain('Hej');
    // Patienten byter till svenska. Nästa besked blir på svenska.
    expect((await inv.post('/api/min/journal/p11/sprak', { sprak: 'sv' })).status).toBe(200);
    expect(loggRader(inv).at(-1)).toMatchObject({ invanare_id: 'inv-p11', patient_id: 'p11', resurs: 'min:sprak' });
    const om = (await k.get(`/api/bokning/${b.id}/forslag`)).data;
    const ny = (await k.post(`/api/bokning/${b.id}/omboka`, { tidId: om.forslag[0].tidId })).data;
    expect(ny.kallelse.text).toContain('Hej Anna,');
    expect(ny.kallelse.sprak).toBe('sv');
  });

  test('kallelsen som PDF och iCalendar för personalen och för patienten i Min journal, och varje hämtning loggas', async () => {
    const k = await inloggad('adm-kard');
    const b = db(k).query("SELECT * FROM bokningar WHERE patient_id = 'p14' AND status = 'bokad'").get();
    const kal = kallelser(k, b.id)[0];
    const pdf = await fetch(`${app.url}/api/kallelse/${kal.id}/pdf`, { headers: { Cookie: k.kaka() } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toContain('attachment');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('%%EOF');
    expect(text).toContain('Kallelse');
    expect(text).toContain('Demo');
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: 'p14', handling: 'kalla', resurs: `kallelse:${kal.id}:pdf` });
    const ics = await fetch(`${app.url}/api/kallelse/${kal.id}/ics`, { headers: { Cookie: k.kaka() } });
    expect(ics.headers.get('content-type')).toContain('text/calendar');
    const cal = await ics.text();
    expect(cal).toContain('BEGIN:VCALENDAR\r\n');
    expect(cal).toContain('BEGIN:VEVENT');
    const start = db(k).query('SELECT start FROM tider WHERE id = ?').get(b.tid_id).start;
    expect(cal).toContain(`DTSTART:${start.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`);
    expect(cal).toContain('SUMMARY:Telefontid');
    for (const rad of cal.split('\r\n')) expect(new TextEncoder().encode(rad).length).toBeLessThanOrEqual(75);
    // En annan vårdenhets kallelse nekas.
    const vc = db(k).query("SELECT k.id FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.patient_id = 'p03'").get();
    expect((await k.get(`/api/kallelse/${vc.id}/pdf`)).status).toBe(403);
    // Patienten hämtar sin egen kallelse, men inte någon annans.
    const inv = await invanare('inv-p14');
    const egen = db(inv).query("SELECT k.id FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.patient_id = 'p14' AND k.status = 'skickad'").get();
    const r = await fetch(`${app.url}/api/min/journal/p14/kallelse/${egen.id}/ics`, { headers: { Cookie: inv.kaka() } });
    expect(r.status).toBe(200);
    expect(loggRader(inv).at(-1)).toMatchObject({ invanare_id: 'inv-p14', patient_id: 'p14', resurs: `min:kallelse:${egen.id}:ics` });
    const annan = db(inv).query("SELECT k.id FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.patient_id = 'p15'").get();
    expect((await fetch(`${app.url}/api/min/journal/p14/kallelse/${annan.id}/pdf`, { headers: { Cookie: inv.kaka() } })).status).toBe(404);
  });

  test('kallelsen som PDF för en patient med skyddade personuppgifter kräver Visa identitet och har aldrig adress', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    d.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES ('adm-vc-test', 'Test Admin', 'vardadministrator', 'Vårdadministratör', 'vc-tybble', 'SE2321000164-VKPT01', 1, 1)").run();
    await k.logga('adm-vc-test');
    const kal = d.query("SELECT k.id FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.patient_id = 'p03'").get();
    const r = await k.get(`/api/kallelse/${kal.id}/pdf`);
    expect(r.status).toBe(403);
    expect(r.data.fel).toContain('Visa identitet');
    expect((await k.post('/api/patient/p03/val', { typ: 'visa_identitet', syfte: 'Skicka kallelsen' })).status).toBe(200);
    const ok = await fetch(`${app.url}/api/kallelse/${kal.id}/pdf`, { headers: { Cookie: k.kaka() } });
    expect(ok.status).toBe(200);
    const text = new TextDecoder('latin1').decode(new Uint8Array(await ok.arrayBuffer()));
    const p = d.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    for (const x of [p.adress, p.telefon, p.postnr].filter(Boolean)) expect(text).not.toContain(x);
  });

  test('kallelse utan förbokad tid: patienten väljer själv en tid i Min journal inom ramen som systemet sätter', async () => {
    const k = await inloggad('adm-kard');
    const post = db(k).query("SELECT * FROM vantelista WHERE patient_id = 'p04' AND status = 'vantar'").get();
    expect(post.tidstyp).toBe('telefon');
    const r = await k.post(`/api/vantelista/${post.id}/kalla-utan-tid`);
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ kanal: 'min_journal', status: 'skickad' });
    expect(r.data.fran).toBe(addDagar(idag(), 1));
    expect(r.data.text).toContain('Välj en tid i Min journal');
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p04', handling: 'kalla', resultat: 'tillaten' });
    expect((await k.post(`/api/vantelista/${post.id}/kalla-utan-tid`)).status).toBe(400);
    expect((await k.get('/api/vantelista')).data.poster.find(p => p.id === post.id).kalladUtanTid).toMatchObject({ till: r.data.till });
    // Ett nybesök bokar mottagningen själv (beslut 2026-11-03).
    const nybesok = db(k).query("SELECT * FROM vantelista WHERE patient_id = 'p10' AND remiss_id IS NOT NULL").get();
    const nej = await k.post(`/api/vantelista/${nybesok.id}/kalla-utan-tid`);
    expect(nej.status).toBe(400);
    expect(nej.data.fel).toContain('nybesök');
    // Patienten i Min journal, i samma sandlåda.
    const inv = await invanare('inv-p04');
    delaSandlada(k, inv);
    const t = (await inv.get('/api/min/journal/p04/tider')).data;
    const ram = t.kallelserUtanTid[0];
    expect(ram).toMatchObject({ id: r.data.id, tidstypText: 'Telefontid' });
    const f = (await inv.get(`/api/min/journal/p04/kallelse-ram/${ram.id}/forslag`)).data;
    expect(f.forslag.length).toBeGreaterThan(0);
    for (const x of f.forslag) {
      expect(datumAv(new Date(x.start)) >= r.data.fran && datumAv(new Date(x.start)) <= r.data.till).toBe(true);
      expect(x.tidstyp).toBe('telefon');
    }
    const fel = db(k).query("SELECT id FROM tider WHERE tidstyp = 'telefon' AND start > ? ORDER BY start DESC").get(new Date().toISOString());
    expect((await inv.post(`/api/min/journal/p04/kallelse-ram/${ram.id}/boka`, { tidId: fel.id })).status).toBe(400);
    const bok = await inv.post(`/api/min/journal/p04/kallelse-ram/${ram.id}/boka`, { tidId: f.forslag[0].tidId });
    expect(bok.status).toBe(201);
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).toBe('bokad');
    expect(db(k).query('SELECT status, bokning_id FROM kallelser_ram WHERE id = ?').get(ram.id)).toMatchObject({ status: 'bokad', bokning_id: bok.data.id });
    expect(loggRader(k).at(-1)).toMatchObject({ invanare_id: 'inv-p04', patient_id: 'p04', handling: 'boka' });
    expect((await inv.get('/api/min/journal/p04/tider')).data.kallelserUtanTid.length).toBe(0);
  });
});

describe('FHIR-incheckning', () => {
  const patch = (k, vag, kropp, typ = 'application/json-patch+json') => fetch(`${app.url}${vag}`, { method: 'PATCH', headers: { Cookie: k.kaka(), 'Content-Type': typ }, body: JSON.stringify(kropp) });
  const arrived = [{ op: 'replace', path: '/status', value: 'arrived' }];

  test('personalen checkar in med PATCH på Appointment med samma behörighet som gränssnittet, och det loggas', async () => {
    const k = await inloggad('adm-kard');
    const b = db(k).query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get();
    const r = await patch(k, `/fhir/Appointment/${b.id}`, arrived);
    expect(r.status).toBe(200);
    const a = await r.json();
    expect(a).toMatchObject({ resourceType: 'Appointment', id: String(b.id), status: 'arrived' });
    expect(db(k).query('SELECT status, incheckad_via, konummer FROM bokningar WHERE id = ?').get(b.id)).toMatchObject({ status: 'incheckad', incheckad_via: 'fhir' });
    expect(db(k).query('SELECT ankomst FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id).ankomst).toBeTruthy();
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: 'p08', handling: 'checka_in', resurs: `fhir/Appointment/${b.id}:ankomst`, resultat: 'tillaten' });
    // Två gånger går inte.
    const igen = await patch(k, `/fhir/Appointment/${b.id}`, arrived);
    expect(igen.status).toBe(400);
    expect((await igen.json()).resourceType).toBe('OperationOutcome');
  });

  // Runda 13, r4: mottagningen är öppen på dagen, så testet körs en torsdag klockan 11 (arbetsdag-r13.test.js).
  test('invånaren checkar in sin egen tid med PATCH, bara när incheckningen är öppen', async () => {
    stallKlockan(new Date(lokalTid('2026-11-12', '11:00')));
    const inv = await invanare('inv-p15');
    const b = db(inv).query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p15' AND t.relativ = 1").get();
    const r = await patch(inv, `/fhir/Appointment/${b.id}`, arrived);
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('arrived');
    expect(loggRader(inv).at(-1)).toMatchObject({ invanare_id: 'inv-p15', patient_id: 'p15', handling: 'checka_in', resurs: `fhir/Appointment/${b.id}:ankomst` });
    // En tid som inte är i dag går inte att checka in, och någon annans tid finns inte.
    const inv14 = await invanare('inv-p14');
    const sen = db(inv14).query("SELECT id FROM bokningar WHERE patient_id = 'p14' AND status = 'bokad'").get();
    expect((await patch(inv14, `/fhir/Appointment/${sen.id}`, arrived)).status).toBe(400);
    const annans = db(inv14).query("SELECT b.id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get();
    expect((await patch(inv14, `/fhir/Appointment/${annans.id}`, arrived)).status).toBe(404);
  });

  test('Encounter-status arrived registrerar ankomsten på den planerade vårdkontakten', async () => {
    const k = await inloggad('adm-kard');
    const b = db(k).query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get();
    const r = await patch(k, `/fhir/Encounter/${b.vardkontakt_id}`, arrived);
    expect(r.status).toBe(200);
    expect((await r.json())).toMatchObject({ resourceType: 'Encounter', id: String(b.vardkontakt_id) });
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(b.id).status).toBe('incheckad');
    // En vårdkontakt utan bokning går inte.
    const annan = db(k).query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL").get();
    expect((await patch(k, `/fhir/Encounter/${annan.id}`, arrived)).status).toBe(400);
  });

  test('fel roll, en annan vårdenhet och andra ändringar än status nekas', async () => {
    const k = await inloggad('lak-kard');
    const b = db(k).query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get();
    const nej = await patch(k, `/fhir/Appointment/${b.id}`, arrived);
    expect(nej.status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p08', handling: 'checka_in', resultat: 'nekad' });
    await k.logga('adm-kard');
    expect((await patch(k, `/fhir/Appointment/${b.id}`, [{ op: 'replace', path: '/start', value: '2030-01-01T10:00:00Z' }])).status).toBe(422);
    expect((await patch(k, `/fhir/Appointment/${b.id}`, [{ op: 'replace', path: '/status', value: 'cancelled' }])).status).toBe(422);
    expect((await patch(k, `/fhir/Appointment/${b.id}`, { status: 'arrived' }, 'application/json')).status).toBe(415);
    const vc = db(k).query("SELECT id FROM bokningar WHERE patient_id = 'p03'").get();
    expect((await patch(k, `/fhir/Appointment/${vc.id}`, arrived)).status).toBe(403);
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(b.id).status).toBe('bokad');
    // Förmågan syns i CapabilityStatement.
    const cap = await (await fetch(`${app.url}/fhir/metadata`)).json();
    const ap = cap.rest[0].resource.find(r => r.type === 'Appointment');
    expect(ap.interaction.map(i => i.code)).toContain('patch');
  });
});

describe('Planering, säkerhet', () => {
  test('förslagen tar inte hänsyn till bokningar och resurser som användaren inte får se, och en annan vårdenhets resurser används aldrig', async () => {
    const k = await inloggad('adm-kard');
    const post = elkonvertering(k);
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    const json = JSON.stringify(f);
    expect(json).not.toContain('sch-vc');
    for (const x of f.forslag) for (const r of x.resurser) expect(r.id.startsWith('res-kard')).toBe(true);
    // En vårdcentral utan behandlingsrum och defibrillator kan inte sätta upp ingreppet, och systemet säger varför.
    db(k).query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES ('adm-vc-test', 'Test Admin', 'vardadministrator', 'Vårdadministratör', 'vc-tybble', 'SE2321000164-VKPT01', 1, 1)").run();
    await k.logga('adm-vc-test');
    const ny = await k.post('/api/patient/p01/vantelista', { ingrepp: 'elkonvertering' });
    expect(ny.status).toBe(400);
    expect(ny.data.fel).toContain('Vårdcentralen Tybble');
    expect(harVardrelation(db(k), 'p01', 'vc-tybble')).toBe(true);
  });
});
