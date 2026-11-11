import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import { verifiera } from '../src/logg.js';
import { packaUpp } from '../src/zip.js';
import * as datauttag from '../src/datauttag.js';

// Utskrifter, kontrasignering, export till e-arkiv, gallring, radering och datauttag (Sussa 3.1.9, 3.1.11.3, 5.4.2,
// 5.3.1.7 och 6.3.1). En utskrift, ett exportpaket eller ett datauttag lämnar ut journalen och får aldrig ge mer än
// behörighetsmotorn ger den som hämtar det.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const ALLA = ['lakemedel', 'diagnoser', 'anteckningar', 'matvarden', 'remisser', 'vardkontakter'];
const skrivUt = (k, pid, extra = {}) => k.post(`/api/patient/${pid}/utskrift`, { syfte: 'Kopia av journalen till patienten på begäran', delar: ALLA, ...extra });
const sektion = (u, id) => u.sektioner.find(s => s.id === id);
const antInSektion = (u) => JSON.stringify(sektion(u, 'anteckningar')?.rader ?? []);
const raw = async (k, metod, vag, kropp) => {
  const res = await fetch(app.url + vag, { method: metod, headers: { Cookie: k.kaka(), ...(kropp ? { 'Content-Type': 'application/json' } : {}) }, body: kropp ? JSON.stringify(kropp) : undefined });
  return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
};

describe('Utskrift', () => {
  test('utskriften har samma innehåll som gränssnittet, med utskrifts-id, syfte, vem och när', async () => {
    const k = await inloggad('lak-kard');
    const r = await skrivUt(k, 'p01');
    expect(r.status).toBe(201);
    const u = r.data;
    expect(u.id).toMatch(/^U-[A-Z0-9]{8}$/);
    expect(u.av).toMatchObject({ namn: 'Sara Lindqvist', enhet: 'Kardiologiska kliniken USÖ' });
    expect(u.patient).toMatchObject({ namn: 'Gunnar Åkesson', personnummer: '19450202-4732' });
    expect(u.syfte).toBe('Kopia av journalen till patienten på begäran');
    const lista = (await k.get('/api/patient/p01/anteckningar')).data.anteckningar.filter(a => a.status === 'signerad');
    expect(sektion(u, 'anteckningar').rader.length).toBe(lista.length);
    const lm = (await k.get('/api/patient/p01/oversikt')).data.lakemedel.map(o => o.lakemedel.namn).sort();
    expect(sektion(u, 'lakemedel').rader.map(x => x.rubrik.split(' ')[0]).sort()).toEqual(lm.map(n => n.split(' ')[0]).sort());
    expect(u.kontrollsumma).toMatch(/^[0-9a-f]{64}$/);
  });

  test('varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra', async () => {
    const k = await inloggad('lak-kard');
    const u = (await skrivUt(k, 'p01', { delar: ['lakemedel'], syfte: 'Läkemedelslista till patienten vid utskrivning' })).data;
    const rad = loggRader(k).find(x => x.resurs === `utskrift:${u.id}`);
    expect(rad).toMatchObject({ handling: 'skriv_ut', patient_id: 'p01', personal_id: 'lak-kard', syfte: 'Läkemedelslista till patienten vid utskrivning', resultat: 'tillaten' });
    const sparad = db(k).query('SELECT * FROM utskrifter WHERE id = ?').get(u.id);
    expect(JSON.parse(sparad.delar)).toEqual(['lakemedel']);
    expect(JSON.parse(sparad.poster).every(p => p.typ === 'ordination')).toBe(true);
    expect(() => db(k).query("UPDATE utskrifter SET syfte = 'annat' WHERE id = ?").run(u.id)).toThrow();
    expect(() => db(k).query('DELETE FROM utskrifter WHERE id = ?').run(u.id)).toThrow();
    // Eftersökning med id:t på papperet.
    // Logggranskaren i samma sandlåda.
    const lg = k;
    await lg.logga('logg');
    const s = await lg.get(`/api/utskrift/${u.id}`);
    expect(s.status).toBe(200);
    expect(s.data).toMatchObject({ id: u.id, syfte: 'Läkemedelslista till patienten vid utskrivning', av: { namn: 'Sara Lindqvist' }, patientId: 'p01' });
    expect((await lg.get('/api/utskrift/U-FINNSINT')).status).toBe(404);
  });

  test('spärrade uppgifter och andra vårdenheters uppgifter kommer inte med utan aktivt val eller samtycke, och utelämnandet sägs men röjs inte', async () => {
    const k = await inloggad('lak-kard');
    const fore = (await skrivUt(k, 'p04')).data;
    const text = JSON.stringify(fore);
    expect(text).not.toContain('sertralin');
    expect(text).not.toContain('Allmänpsykiatriska');
    expect(text).not.toContain('Tryckande bröstsmärta');
    expect(fore.utelamnat.join(' ')).toContain('spärrade uppgifter');
    expect(fore.utelamnat.join(' ')).toContain('andra vårdenheter');
    expect(antInSektion(fore)).toContain('Okomplicerat förlopp');
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Kopia till patienten' });
    const val = (await skrivUt(k, 'p04')).data;
    expect(antInSektion(val)).toContain('Tryckande bröstsmärta');
    expect(JSON.stringify(val)).not.toContain('sertralin');
    expect(val.utelamnat.join(' ')).toContain('spärrade uppgifter');
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    const samtycke = (await skrivUt(k, 'p04')).data;
    expect(antInSektion(samtycke)).toContain('sertralin');
    expect(samtycke.utelamnat.join(' ')).not.toContain('spärrade');
  });

  test('en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med', async () => {
    const lg = await inloggad('logg');
    const n = await skrivUt(lg, 'p01');
    expect(n.status).toBe(403);
    const psyk = await inloggad('lak-psyk');
    const r = await skrivUt(psyk, 'p01');
    expect(r.status).toBe(403);
    expect(loggRader(psyk).some(x => x.personal_id === 'lak-psyk' && x.patient_id === 'p01' && x.handling === 'skriv_ut' && x.resultat === 'nekad')).toBe(true);
    const usk = await inloggad('usk-kard');
    const u = (await skrivUt(usk, 'p01')).data;
    expect(antInSektion(u)).not.toContain('Daganteckning');
    // Runda 10, r3: fallriskbedömningen i seeden är ett formulär i omvårdnaden.
    expect(sektion(u, 'anteckningar').rader.every(a => ['Omvårdnadsanteckning', 'Fallriskbedömning'].includes(a.rubrik))).toBe(true);
    expect(sektion(u, 'diagnoser')).toBeUndefined();
    expect(u.utelamnat.join(' ')).toContain('Diagnoser');
    const adm = await inloggad('adm-kard');
    const a = (await skrivUt(adm, 'p01')).data;
    expect(a.sektioner.map(s => s.id)).toEqual(['remisser', 'vardkontakter']);
    expect(JSON.stringify(a)).not.toContain('Frågeställning');
  });

  test('skyddad identitet maskeras i utskriften och en avidentifierad utskrift saknar namn och personnummer', async () => {
    const k = await inloggad('lak-vc');
    const u = (await skrivUt(k, 'p03')).data;
    expect(u.patient.namn).toBe('Skyddad identitet');
    expect(u.patient.personnummer).toMatch(/\*\*\*\*$/);
    expect(u.utelamnat.join(' ')).toContain('skyddade personuppgifter');
    const av = (await skrivUt(k, 'p01', { avidentifierad: true, syfte: 'Underlag till kvalitetsgranskning' })).data;
    expect(av.patient).toMatchObject({ namn: 'Avidentifierad', personnummer: null });
    expect((await skrivUt(k, 'p01', { avidentifierad: true, utlamnasTill: 'Patienten' })).status).toBe(400);
  });

  test('syftet och delarna föreslås ur sammanhanget', async () => {
    const k = await inloggad('lak-kard');
    const f = (await k.get('/api/patient/p01/utskrift/forslag')).data;
    expect(f.forslag[0]).toMatchObject({ id: 'utskrivning', delar: ['lakemedel'], utlamnasTill: 'Patienten' });
    expect(f.forslag.some(x => x.id === 'kopia')).toBe(true);
    const adm = await inloggad('adm-kard');
    const a = (await adm.get('/api/patient/p01/utskrift/forslag')).data;
    expect(a.delar.map(d => d.id)).toEqual(['remisser', 'vardkontakter']);
    expect(a.ingarInte).toContain('Journalanteckningar');
  });

  test('utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet', async () => {
    const k = await inloggad('lak-kard');
    const u = (await skrivUt(k, 'p01', { utlamnasTill: 'Patienten' })).data;
    expect(u.utlamnande).toMatchObject({ mottagare: 'Patienten', utskriftId: u.id, menprovning: 'Lämnas ut till patienten själv.' });
    expect(u.utlamnande.beskrivning).toContain(u.id);
    const senast = addDagar(idag(), 14);
    const lan = await k.post('/api/patient/p01/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Journalkopia och EKG-original', aterlamnasSenast: senast, menprovning: 'Prövad, inget men.' });
    expect(lan.status).toBe(201);
    expect(lan.data).toMatchObject({ mottagare: 'Domstol', aterlamnasSenast: senast, aterlamnad: null });
    const lista = (await k.get('/api/patient/p01/utskrifter')).data;
    expect(lista.utskrifter.some(x => x.id === u.id)).toBe(true);
    expect(lista.utlamnanden.map(x => x.mottagare)).toEqual(expect.arrayContaining(['Patienten', 'Domstol']));
    const ater = await k.post(`/api/utlamnande/${lan.data.id}/aterlamna`, {});
    expect(ater.data.aterlamnad).toBeTruthy();
    expect(ater.data.aterlamnadAv.namn).toBe('Sara Lindqvist');
    expect((await k.post(`/api/utlamnande/${lan.data.id}/aterlamna`, {})).status).toBe(400);
    expect(() => db(k).query("UPDATE utlamnanden SET mottagare = 'Annan' WHERE id = ?").run(lan.data.id)).toThrow();
    expect(loggRader(k).some(x => x.handling === 'utlamna' && x.resurs === `aterlamnande:${lan.data.id}`)).toBe(true);
    const usk = await inloggad('usk-kard');
    expect((await usk.post('/api/patient/p01/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Kopia' })).status).toBe(403);
  });

  test('ett utlämnande som inte har kommit tillbaka i tid hamnar i vårdenhetens inkorg', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    d.query(`INSERT INTO utlamnanden (patient_id, enhet_id, mottagare, beskrivning, utlamnad, utlamnad_av, aterlamnas_senast)
      VALUES ('p01', 'uso-kard', 'Domstol', 'Originalhandlingar', ?, 'lak-kard', ?)`).run(new Date().toISOString(), addDagar(idag(), -3));
    const i = (await k.get('/api/inkorg')).data;
    expect(i.aterlamnanden).toEqual([expect.objectContaining({ mottagare: 'Domstol', forsenad: true })]);
    const vc = await inloggad('lak-vc');
    expect((await vc.get('/api/inkorg')).data.aterlamnanden).toEqual([]);
  });
});

describe('Kontrasignering', () => {
  const egenAnteckning = async (k, pid = 'p01') => {
    const a = (await k.post(`/api/patient/${pid}/anteckningar`, { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Stabil.' }] })).data;
    await k.post(`/api/anteckning/${a.id}/signera`, {});
    return a.id;
  };

  test('systemet föreslår överläkaren och aldrig den som signerade, den som begär eller en underläkare', async () => {
    const k = await inloggad('lak-kard');
    const id = await egenAnteckning(k);
    const f = (await k.get(`/api/kontrasignering/forslag?typ=anteckning&id=${id}`)).data;
    expect(f.forslag[0]).toMatchObject({ id: 'ol-kard', titel: 'Överläkare' });
    expect(f.forslag.map(x => x.id)).not.toContain('lak-kard');
    expect(f.forslag.map(x => x.id)).not.toContain('ul-kard');
    expect(f.skal).toContain('Göran Malm');
    const b = await k.post('/api/kontrasigneringar', { typ: 'anteckning', id });
    expect(b.status).toBe(201);
    expect(b.data).toMatchObject({ status: 'begard', mottagare: { id: 'ol-kard' }, begardAv: { id: 'lak-kard' } });
    expect((await k.post('/api/kontrasigneringar', { typ: 'anteckning', id })).status).toBe(400);
    expect((await k.get(`/api/anteckning/${id}`)).data.kontrasignering.begaranden.length).toBe(1);
  });

  test('begäran hamnar i inkorgen och kontrasigneras med ett klick, och syns i FHIR', async () => {
    const k = await inloggad('lak-kard');
    const ik = (await k.get('/api/inkorg')).data.kontrasigneringar;
    expect(ik).toEqual([expect.objectContaining({ typ: 'anteckning', rubrik: 'Daganteckning', begardAv: expect.objectContaining({ namn: 'Alva Berglund' }), patient: expect.objectContaining({ id: 'p04' }) })]);
    const ant = (await k.get(`/api/anteckning/${ik[0].postId}`)).data;
    expect(ant.kontrasignering).toMatchObject({ minBegaran: ik[0].id, kan: { kontrasignera: true } });
    const r = await k.post(`/api/kontrasignering/${ik[0].id}/kontrasignera`, {});
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('kontrasignerad');
    expect((await k.get('/api/inkorg')).data.kontrasigneringar).toEqual([]);
    expect(loggRader(k).some(x => x.handling === 'kontrasignera' && x.personal_id === 'lak-kard' && x.patient_id === 'p04')).toBe(true);
    const fh = (await k.get(`/fhir/Composition/${ik[0].postId}`)).data;
    expect(fh.attester).toEqual([expect.objectContaining({ mode: 'professional', party: expect.objectContaining({ reference: 'Practitioner/lak-kard' }) })]);
    expect((await k.post(`/api/kontrasignering/${ik[0].id}/kontrasignera`, {})).status).toBe(400);
  });

  test('den som har signerat kan inte kontrasignera själv', async () => {
    const k = await inloggad('lak-kard');
    const id = await egenAnteckning(k);
    const r = await k.post('/api/kontrasigneringar', { typ: 'anteckning', id, mottagareId: 'lak-kard' });
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('signerat');
    const d = db(k);
    const ks = d.query("INSERT INTO kontrasigneringar (patient_id, typ, post_id, enhet_id, begard_av, begard, mottagare_id) VALUES ('p01', 'anteckning', ?, 'uso-kard', 'ol-kard', ?, 'lak-kard')").run(id, new Date().toISOString()).lastInsertRowid;
    const s = await k.post(`/api/kontrasignering/${ks}/kontrasignera`, {});
    expect(s.status).toBe(403);
    expect(s.data.fel).toContain('signerat');
  });

  test('en roll eller enhet utan behörighet nekas, och begäran ger ingen åtkomst utöver posten', async () => {
    const k = await inloggad('lak-kard');
    const id = await egenAnteckning(k);
    expect((await k.post('/api/kontrasigneringar', { typ: 'anteckning', id, mottagareId: 'lak-akut' })).status).toBe(400);
    const b = (await k.post('/api/kontrasigneringar', { typ: 'anteckning', id })).data;
    // Samma sandlåda med andra roller: undersköterskan får inte begära, och en annan vårdenhet når varken begäran eller posten.
    await k.logga('usk-kard');
    expect((await k.post('/api/kontrasigneringar', { typ: 'anteckning', id })).status).toBe(403);
    await k.logga('lak-psyk');
    expect((await k.get(`/api/kontrasignering/${b.id}`)).status).toBe(403);
    expect((await k.post(`/api/kontrasignering/${b.id}/kontrasignera`, {})).status).toBe(403);
    await k.logga('lak-kard');
    // Den som begäran gäller, eller den som begärde, får bara den posten och inga andra uppgifter om patienten.
    const las = await k.get(`/api/kontrasignering/${b.id}`);
    expect(las.status).toBe(200);
    expect(las.data.post.id).toBe(id);
    expect(Object.keys(las.data).sort()).toEqual(['begard', 'begardAv', 'id', 'kommentar', 'kontrasignerad', 'mottagare', 'post', 'postId', 'status', 'typ']);
    const ik = (await k.get('/api/inkorg')).data.kontrasigneringar[0];
    // Runda 6, r1: uppmärksamhetssymbolen visas i inkorgen bara när läkaren ändå får läsa patientens översikt, som här
    // genom vårdrelationen på kardiologen (Sussa 3.1.5.2).
    expect(Object.keys(ik.patient).sort()).toEqual(['id', 'namn', 'personnummer', 'skyddad', 'uppmarksamhet']);
  });

  test('spärrade uppgifter och andra vårdenheters uppgifter kan inte begäras kontrasignerade', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const psykAnt = d.query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' LIMIT 1").get().id;
    const r = await k.post('/api/kontrasigneringar', { typ: 'anteckning', id: psykAnt });
    expect(r.status).toBe(403);
    expect(r.data.kod).toBe('kraver_samtycke');
    const akutAnt = d.query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-akut' LIMIT 1").get().id;
    const a = await k.post('/api/kontrasigneringar', { typ: 'anteckning', id: akutAnt });
    expect(a.status).toBe(403);
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Läser akutens anteckning' });
    const efter = await k.post('/api/kontrasigneringar', { typ: 'anteckning', id: akutAnt });
    expect(efter.status).toBe(403);
    expect(efter.data.fel).toContain('egna vårdenhetens');
  });

  test('ett provsvar kan begäras kontrasignerat, och en kontrasignering kan inte ändras eller raderas', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const mv = d.query("SELECT id FROM matvarden WHERE patient_id = 'p01' AND typ = 'inr' ORDER BY tid DESC LIMIT 1").get();
    const b = await k.post('/api/kontrasigneringar', { typ: 'matvarde', id: mv.id });
    expect(b.status).toBe(201);
    expect(() => d.query("UPDATE kontrasigneringar SET mottagare_id = 'lak-akut' WHERE id = ?").run(b.data.id)).toThrow();
    expect(() => d.query('DELETE FROM kontrasigneringar WHERE id = ?').run(b.data.id)).toThrow();
  });
});

describe('Arkiv', () => {
  const beslut = (k, data) => k.post('/api/arkiv/beslut', { diarienummer: 'DEMO-2026-0042', beslutsdatum: idag(), ...data });

  test('beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas', async () => {
    for (const roll of ['lak-kard', 'logg', 'uppf', 'adm-kard']) {
      const k = await inloggad(roll);
      expect((await beslut(k, { typ: 'leverans', patientId: 'p01' })).status).toBe(403);
      expect((await k.post('/api/arkiv/beslut/1/paket', {})).status).toBe(403);
      expect((await k.post('/api/arkiv/beslut/1/verkstall', {})).status).toBe(403);
      expect((await k.get('/api/arkiv/patient/p04/poster')).status).toBe(403);
      expect(loggRader(k).some(x => x.personal_id === roll && x.handling === 'registrera_arkivbeslut' && x.resultat === 'nekad')).toBe(true);
    }
  });

  test('export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i', async () => {
    const k = await inloggad('ark');
    expect((await k.post('/api/arkiv/beslut/999/paket', {})).status).toBe(404);
    expect((await beslut(k, { typ: 'radering', omfattning: 'hela' })).status).toBe(400);
    expect((await beslut(k, { typ: 'leverans', patientId: 'p01', diarienummer: '' })).status).toBe(400);
    const g = (await beslut(k, { typ: 'gallring' })).data;
    expect(g).toMatchObject({ beslutsfattare: 'Vårdgivarens gallringsbeslut', lagrum: expect.stringContaining('3 kap. 17 §') });
    expect((await k.post(`/api/arkiv/beslut/${g.id}/paket`, {})).status).toBe(400);
    const r = (await beslut(k, { typ: 'radering', patientId: 'p12', omfattning: 'hela' })).data;
    expect(r).toMatchObject({ beslutsfattare: 'Inspektionen för vård och omsorg', lagrum: 'Patientdatalagen (2008:355) 8 kap. 4 §' });
    expect(() => db(k).query("UPDATE arkivbeslut SET diarienummer = 'X' WHERE id = ?").run(r.id)).toThrow();
    expect(() => db(k).query('DELETE FROM arkivbeslut WHERE id = ?').run(r.id)).toThrow();
  });

  test('exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil', async () => {
    const k = await inloggad('ark');
    const b = (await beslut(k, { typ: 'leverans', patientId: 'p01' })).data;
    const r = await raw(k, 'POST', `/api/arkiv/beslut/${b.id}/paket`, {});
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/zip');
    expect(r.headers.get('x-paket-sha256')).toBe(createHash('sha256').update(r.buf).digest('hex').toUpperCase());
    const filer = packaUpp(r.buf);
    const rot = [...filer.keys()][0];
    expect(rot).toMatch(/^IP_[0-9a-f-]{36}\/$/);
    for (const m of ['METS.xml', 'metadata/descriptive/', 'metadata/preservation/', 'metadata/other/', 'representations/rep_1/data/', 'schemas/', 'documentation/']) expect(filer.has(rot + m)).toBe(true);
    const mets = filer.get(`${rot}METS.xml`).data.toString('utf8');
    expect(mets).toContain('PROFILE="https://earksip.dilcis.eu/profile/E-ARK-SIP.xml"');
    expect(mets).toContain(`OBJID="${rot.slice(0, -1)}"`);
    expect(mets).toContain('csip:OAISPACKAGETYPE="SIP"');
    const listade = [...mets.matchAll(/CHECKSUM="([0-9A-F]{64})"[^>]*>\s*<FLocat [^>]*xlink:href="([^"]+)"/g)];
    expect(listade.length).toBeGreaterThan(3);
    for (const [, summa, vag] of listade) expect(createHash('sha256').update(filer.get(rot + vag).data).digest('hex').toUpperCase()).toBe(summa);
    const bundle = JSON.parse(filer.get(`${rot}representations/rep_1/data/journal/p01.json`).data);
    expect(bundle).toMatchObject({ resourceType: 'Bundle', type: 'collection' });
    const ant = db(k).query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p01' AND status = 'signerad'").get().n;
    expect(bundle.entry.filter(e => e.resource.resourceType === 'Composition').length).toBe(ant);
    expect(filer.has(`${rot}representations/rep_1/data/ovrigt/p01-atkomstlogg.ndjson`)).toBe(true);
    expect(db(k).query('SELECT * FROM arkivexporter WHERE beslut_id = ?').get(b.id)).toMatchObject({ patienter: 1, sha256: r.headers.get('x-paket-sha256') });
    expect(loggRader(k).some(x => x.handling === 'arkivera' && x.patient_id === 'p01' && x.grund === 'arkivbeslut')).toBe(true);
  });

  test('exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter', async () => {
    const k = await inloggad('ark');
    const b = (await beslut(k, { typ: 'leverans', omfattning: 'alla' })).data;
    const r = await raw(k, 'POST', `/api/arkiv/beslut/${b.id}/paket`, {});
    const filer = packaUpp(r.buf);
    const rot = [...filer.keys()][0];
    const journaler = [...filer.keys()].filter(f => /journal\/p\d+\.json$/.test(f));
    expect(journaler.length).toBe(db(k).query('SELECT count(*) AS n FROM patienter WHERE sammanslagen_till IS NULL').get().n);
    const p04 = filer.get(`${rot}representations/rep_1/data/journal/p04.json`).data.toString('utf8');
    expect(p04).toContain('sertralin');
    expect(JSON.parse(filer.get(`${rot}representations/rep_1/data/journal/p04-sparr-och-skydd.json`).data).sparrar[0]).toMatchObject({ vardenhet: 'Allmänpsykiatriska kliniken USÖ', aktiv: true });
    expect(JSON.parse(filer.get(`${rot}representations/rep_1/data/journal/p03-sparr-och-skydd.json`).data).skyddadePersonuppgifter).toBe(true);
  });

  test('arkivariens postförteckning visar inget innehåll och nämner inte en spärrad vårdenhet', async () => {
    const k = await inloggad('ark');
    const p = (await k.get('/api/arkiv/patient/p04/poster')).data;
    const text = JSON.stringify(p);
    expect(text).not.toContain('Allmänpsykiatriska');
    expect(text).not.toContain('sertralin');
    expect(text).toContain('Spärrad vårdenhet');
    expect((await k.get(`/api/arkiv/patient?q=${encodeURIComponent('19770118-2383')}`)).data).toMatchObject({ id: 'p04', namn: 'Elin Sandberg' });
  });

  test('gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel', async () => {
    const k = await inloggad('ark');
    const d = db(k);
    const g = (await beslut(k, { typ: 'gallring' })).data;
    const u = (await k.get(`/api/arkiv/beslut/${g.id}/underlag`)).data;
    expect(u.patienter.map(p => p.id)).toEqual(['p20']);
    const loggFore = d.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p20' ORDER BY id").all();
    const v = await k.post(`/api/arkiv/beslut/${g.id}/verkstall`, {});
    expect(v.status).toBe(200);
    expect(v.data.resultat).toMatchObject({ patienter: 1, rader: expect.objectContaining({ anteckningar: 3, diagnoser: 1 }) });
    for (const t of ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'vardkontakter']) expect(d.query(`SELECT count(*) AS n FROM ${t} WHERE patient_id = 'p20'`).get().n).toBe(0);
    expect(d.query("SELECT journal_forstord FROM patienter WHERE id = 'p20'").get().journal_forstord).toBe(g.id);
    const loggEfter = d.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p20' ORDER BY id").all();
    expect(loggEfter.slice(0, loggFore.length)).toEqual(loggFore);
    expect(loggEfter.at(-1)).toMatchObject({ handling: 'gallra', grund: 'arkivbeslut', resurs: `beslut:${g.id}` });
    expect(verifiera(d).hel).toBe(true);
    expect((await k.post(`/api/arkiv/beslut/${g.id}/verkstall`, {})).status).toBe(400);
    // Triggrarna är tillbaka: en signerad anteckning går inte att radera på annat sätt.
    expect(() => d.query("DELETE FROM anteckningar WHERE patient_id = 'p01' AND status = 'signerad'").run()).toThrow();
    expect(() => d.query("DELETE FROM atkomstlogg WHERE patient_id = 'p20'").run()).toThrow();
    await k.logga('lak-kard');
    expect((await k.get('/api/logg?flagga=arkiv')).status).toBe(403);
    await k.logga('logg');
    expect((await k.get('/api/logg?flagga=arkiv')).data.rader.some(x => x.handling === 'gallra' && x.flaggad)).toBe(true);
  });

  test('radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan', async () => {
    const k = await inloggad('ark');
    const d = db(k);
    const rattad = d.query("SELECT id, ersatter_id FROM anteckningar WHERE patient_id = 'p01' AND ersatter_id IS NOT NULL").get();
    const fore = d.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p01'").get().n;
    const b = (await beslut(k, { typ: 'radering', patientId: 'p01', poster: [{ typ: 'anteckning', id: rattad.id }] })).data;
    expect(b.omfattning).toEqual({ poster: [{ typ: 'anteckning', id: rattad.id }] });
    expect((await beslut(k, { typ: 'radering', patientId: 'p01', poster: [{ typ: 'anteckning', id: 999999 }] })).status).toBe(400);
    const v = await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {});
    expect(v.status).toBe(200);
    expect(d.query('SELECT count(*) AS n FROM anteckningar WHERE id IN (?, ?)').get(rattad.id, rattad.ersatter_id).n).toBe(0);
    expect(d.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p01'").get().n).toBe(fore - 2);
    expect(d.query("SELECT journal_forstord FROM patienter WHERE id = 'p01'").get().journal_forstord).toBeNull();
    expect(loggRader(k).at(-1)).toMatchObject({ handling: 'radera', patient_id: 'p01', syfte: expect.stringContaining('2 anteckningar') });
    expect(verifiera(d).hel).toBe(true);
  });

  test('radering av hela journalen behåller identiteten, utskrifterna, utlämnandena och loggen', async () => {
    // Samma sandlåda: läkaren skriver ut, sedan loggar arkivarien in i samma webbläsare.
    const k = await inloggad('lak-kard');
    await skrivUt(k, 'p01', { utlamnasTill: 'Patienten' });
    await k.logga('ark');
    const d = db(k);
    const loggFore = d.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01'").get().n;
    const b = (await k.post('/api/arkiv/beslut', { typ: 'radering', patientId: 'p01', omfattning: 'hela', diarienummer: 'IVO 3.5.1-12345/2026', beslutsdatum: idag() })).data;
    expect((await k.post(`/api/arkiv/beslut/${b.id}/verkstall`, {})).status).toBe(200);
    for (const t of ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'vardkontakter', 'remisser', 'overkanslighet', 'vardtillfallen']) expect(d.query(`SELECT count(*) AS n FROM ${t} WHERE patient_id = 'p01'`).get().n).toBe(0);
    expect(d.query("SELECT personnummer, adress FROM patienter WHERE id = 'p01'").get()).toEqual({ personnummer: '194502024732', adress: null });
    expect(d.query("SELECT count(*) AS n FROM identiteter WHERE patient_id = 'p01'").get().n).toBeGreaterThan(0);
    expect(d.query("SELECT count(*) AS n FROM utskrifter WHERE patient_id = 'p01'").get().n).toBe(1);
    expect(d.query("SELECT count(*) AS n FROM utlamnanden WHERE patient_id = 'p01'").get().n).toBe(1);
    expect(d.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01'").get().n).toBe(loggFore + 2);
    expect(verifiera(d).hel).toBe(true);
    // Journalen säger själv att den är förstörd.
    // Kardiologens vårdrelation fanns i vårdkontakterna, som är förstörda. Listningen på vårdcentralen finns kvar.
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01')).status).toBe(403);
    await k.logga('lak-vc');
    expect((await k.get('/api/patient/p01')).data.journalForstord.text).toContain('IVO 3.5.1-12345/2026');
  });
});

describe('Datauttag', () => {
  test('bara uppföljningsrollen når datauttaget, och nekade försök loggas', async () => {
    for (const roll of ['lak-kard', 'logg', 'ark', 'adm-kard']) {
      const k = await inloggad(roll);
      expect((await k.get('/api/datauttag')).status).toBe(403);
      expect((await k.get('/api/datauttag/Vardkontakt')).status).toBe(403);
      expect(loggRader(k).some(x => x.personal_id === roll && x.handling === 'datauttag' && x.resultat === 'nekad')).toBe(true);
    }
    const u = await inloggad('uppf');
    expect((await u.get('/api/datauttag')).status).toBe(200);
    expect((await u.get('/api/patient/p01')).status).toBe(403);
    expect((await u.get('/api/arbetslista')).data).toEqual([]);
  });

  test('manifestet följer FHIR Bulk Data och uttaget loggas', async () => {
    const k = await inloggad('uppf');
    const m = (await k.get('/api/datauttag')).data;
    expect(m).toMatchObject({ requiresAccessToken: false, format: 'application/x-ndjson', error: [] });
    // Runda 9, r7: också mätvärden, anteckningar, vårdtillfällen och patientavgifter (Sussa 6.3.1.3).
    // Runda 11, r3: graviditeterna och förlossningarna, som är tomma i seeden tills demodata läggs in.
    const R11R3 = ['Graviditet', 'Forlossning'];
    expect(m.output.map(o => o.type)).toEqual(['Vardkontakt', 'Diagnos', 'Ordination', 'Remiss', 'Matvarde', 'Anteckning', 'Vardtillfalle', 'Patientavgift', ...R11R3,
      // Runda 11, r2: operationerna (Sussa 4.5.1.5).
      'Operation']);
    expect(m.output.every(o => (o.count > 0 || R11R3.includes(o.type)) && o.url.endsWith(`/api/datauttag/${o.type}`))).toBe(true);
    const r = await raw(k, 'GET', '/api/datauttag/Diagnos');
    expect(r.headers.get('content-type')).toContain('application/x-ndjson');
    const rader = r.buf.toString('utf8').trim().split('\n').map(x => JSON.parse(x));
    expect(rader.length).toBe(m.output.find(o => o.type === 'Diagnos').count);
    expect(loggRader(k).filter(x => x.handling === 'datauttag' && x.grund === 'uppfoljning').map(x => x.resurs)).toEqual(['datauttag:manifest', 'datauttag:Diagnos']);
  });

  test('datauttaget innehåller inga namn, personnummer, adresser eller fritext', async () => {
    const k = await inloggad('uppf');
    const d = db(k);
    let text = '';
    for (const t of datauttag.TYPER) text += (await raw(k, 'GET', `/api/datauttag/${t}`)).buf.toString('utf8');
    for (const p of d.query('SELECT * FROM patienter').all()) {
      expect(text).not.toContain(p.efternamn);
      expect(text).not.toContain(p.personnummer);
      expect(text).not.toContain(p.personnummer.slice(2, 8));
      if (p.adress) expect(text).not.toContain(p.adress);
      expect(text).not.toContain(`"${p.id}"`);
    }
    // Runda 9, r7: anteckningstypen står i tabellen Anteckning, och en migrerad kontakt kan ha typen som orsak.
    const typer = new Set(d.query('SELECT DISTINCT typ FROM anteckningar').all().map(x => x.typ));
    for (const v of d.query('SELECT orsak, plats FROM vardkontakter WHERE orsak IS NOT NULL').all()) if (v.orsak.length > 8 && !typer.has(v.orsak)) expect(text).not.toContain(v.orsak);
    for (const a of d.query('SELECT sokord FROM anteckningar').all()) for (const s of JSON.parse(a.sokord)) if (s.text.length > 12) expect(text).not.toContain(s.text);
    for (const o of d.query('SELECT orsak FROM ordinationer').all()) expect(text).not.toContain(o.orsak);
    const forsta = JSON.parse(text.split('\n')[0]);
    expect(Object.keys(forsta).sort()).toEqual(Object.keys(datauttag.SCHEMA.Vardkontakt.falt).sort());
  });

  test('spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet', async () => {
    const k = await inloggad('uppf');
    const d = db(k);
    const m = (await k.get('/api/datauttag')).data;
    const diag = (await raw(k, 'GET', '/api/datauttag/Diagnos')).buf.toString('utf8');
    expect(diag).not.toContain('F33.1');
    expect(diag).not.toContain('F41.1');
    expect(m.utelamnat.sparrade).toBeGreaterThan(0);
    expect(m.utelamnat.skyddadeUppgifter).toBeGreaterThan(0);
    const synliga = d.query("SELECT count(*) AS n FROM vardkontakter v JOIN patienter p ON p.id = v.patient_id WHERE p.skyddad = 0 AND NOT (v.patient_id = 'p04' AND v.enhet_id = 'uso-psyk')").get().n;
    expect(m.output.find(o => o.type === 'Vardkontakt').count).toBe(synliga);
  });

  test('uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt', async () => {
    const d = nyDb();
    const forsta = datauttag.uppdatera(d, new Date('2026-11-03T10:00:00Z'));
    expect(forsta.nasta).toBe('2026-11-04T01:00:00.000Z');
    expect(Date.parse(forsta.nasta) - Date.parse(forsta.tid)).toBeLessThanOrEqual(24 * 3600_000);
    expect(datauttag.uppdateraOmDags(d, new Date('2026-11-03T23:00:00Z')).id).toBe(forsta.id);
    d.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', 'uso-kard', 'I10.9', 'Essentiell hypertoni (högt blodtryck utan känd orsak)', 'bi', '2026-11-03')").run();
    const andra = datauttag.uppdateraOmDags(d, new Date('2026-11-04T01:30:00Z'));
    expect(andra.id).toBeGreaterThan(forsta.id);
    expect(andra.andringar.Diagnos.ny.length).toBe(1);
    const inkr = datauttag.ndjson(d, 'Diagnos', { andringar: true, nu: new Date('2026-11-04T01:31:00Z') }).trim().split('\n').map(x => JSON.parse(x));
    expect(inkr).toEqual([expect.objectContaining({ kod: 'I10.9', _andring: 'ny' })]);
    expect(d.query('SELECT count(*) AS n FROM datauttag').get().n).toBe(2);
  });

  test('drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker', async () => {
    const k = await inloggad('lak-kard');
    const dr = (await k.get('/api/drift')).data;
    expect(dr.datauttag).toMatchObject({ klockan: '02.00' });
    expect(Date.parse(dr.datauttag.nasta)).toBeGreaterThan(Date.parse(dr.datauttag.senast));
    expect(JSON.stringify(dr.datauttag)).not.toContain('p01');
  });
});
