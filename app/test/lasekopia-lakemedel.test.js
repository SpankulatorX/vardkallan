// Läskopians läkemedelsdel (Sussa 11.2.1.8): när systemet är otillgängligt ska informationen om ordinerade och
// administrerade läkemedel vara högst 10 minuter gammal. Klockan styrs i testerna med setSystemTime, och en webbläsare
// simuleras som följer serverns schema för förnyelse (fornyas.intervallMs) och tittar var 30:e sekund om det är dags,
// precis som gränssnittet (public/js/avbrott.js).
import { describe, test, expect, beforeAll, afterAll, afterEach, setSystemTime } from 'bun:test';
import { verifiera } from '../src/logg.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterEach(() => setSystemTime());
afterAll(() => app.stopp());

const MIN = 60_000;
const TITTA_MS = 30_000;
const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();

// En webbläsare där ingen gör något. Klockan går fram 30 sekunder i taget, och läskopian förnyas när den är så gammal
// som servern säger. Ger den senaste kopian och tiden då den hämtades.
function webblasare(k, start) {
  const b = { nu: start, kopia: null, hamtad: null, antal: 0 };
  b.hamta = async () => {
    setSystemTime(new Date(b.nu));
    const r = await k.get('/api/lasekopia');
    expect(r.status).toBe(200);
    b.kopia = r.data;
    b.hamtad = b.nu;
    b.antal++;
    return r.data;
  };
  b.ga = async (ms, varje = async () => {}) => {
    const slut = b.nu + ms;
    while (b.nu < slut) {
      b.nu += TITTA_MS;
      setSystemTime(new Date(b.nu));
      if (b.nu - b.hamtad >= b.kopia.fornyas.intervallMs) await b.hamta();
      await varje();
    }
  };
  return b;
}

describe('Läskopia', () => {
  test('en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något', async () => {
    const start = Date.now();
    setSystemTime(new Date(start));
    const k = klient(app);
    await k.logga('lak-kard');
    const b = webblasare(k, start);
    const forsta = await b.hamta();
    // Servern säger hur ofta kopian ska förnyas och hur gammal läkemedelsdelen högst får vara. Med en minuts
    // fördröjning för en flik i bakgrunden och ett misslyckat försök som görs om efter 30 sekunder håller det.
    expect(forsta.fornyas.lakemedelMaxMs).toBe(10 * MIN);
    expect(forsta.fornyas.intervallMs + MIN + TITTA_MS).toBeLessThan(forsta.fornyas.lakemedelMaxMs);
    const waran = forsta.patienter.p01.lakemedel.ordinationer.find(o => o.aktuell && o.lakemedel?.namn.startsWith('Waran'));
    expect(waran).toBeTruthy();
    expect(Date.parse(forsta.patienter.p01.lakemedelsdel.tid)).toBeGreaterThanOrEqual(Date.parse(forsta.skapad));

    // Värsta fallet: ordinationen ändras precis efter en förnyelse, från en annan dator med samma inloggning.
    b.nu += 1000;
    setSystemTime(new Date(b.nu));
    const andrad = b.nu;
    const ut = await k.post(`/api/ordination/${waran.id}/utsatt`, { orsak: 'Byte till annat antikoagulantia' });
    expect(ut.status).toBe(200);

    let syns = null;
    await b.ga(15 * MIN, async () => {
      // Läkemedelsdelen är aldrig äldre än 10 minuter, mätt med klockan i testet.
      expect(b.nu - Date.parse(b.kopia.patienter.p01.lakemedelsdel.tid)).toBeLessThanOrEqual(10 * MIN);
      const o = b.kopia.patienter.p01.lakemedel.ordinationer.find(x => x.id === waran.id);
      if (syns === null && o.status === 'utsatt') syns = b.hamtad;
    });
    expect(syns).not.toBeNull();
    expect(syns - andrad).toBeLessThanOrEqual(10 * MIN);
    const post = b.kopia.patienter.p01;
    expect(Date.parse(post.lakemedelsdel.tid)).toBeGreaterThanOrEqual(andrad);
    expect(post.lakemedel.ordinationer.find(x => x.id === waran.id).utsatt.orsak).toBe('Byte till annat antikoagulantia');
    // Översikten i kopian byggs i samma omgång och visar inte heller längre den utsatta ordinationen som aktuell.
    expect(post.oversikt.lakemedel.some(x => x.id === waran.id)).toBe(false);
  });

  test('varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const kopia = (await k.get('/api/lasekopia')).data;
    const poster = Object.entries(kopia.patienter);
    expect(poster.length).toBeGreaterThan(0);
    for (const [id, post] of poster) {
      // Tiden är när läkemedelsuppgifterna lästes ur journalen, alltså samtidigt som eller strax efter att kopian började byggas.
      expect(Date.parse(post.lakemedelsdel.tid)).toBeGreaterThanOrEqual(Date.parse(kopia.skapad));
      expect(Date.parse(post.lakemedelsdel.tid)).toBeLessThanOrEqual(Date.now());
      expect(Object.keys(post.lakemedelsdel.delar).length).toBeGreaterThan(0);
      // Varje del finns i kopian under sitt namn, med läshandlingen som läsläget loggar när den läses, och är exakt
      // det som GET /api/patient/:id/<namn> ger. Administreringar läggs till som en ny del och prövas då här.
      for (const [namn, handling] of Object.entries(post.lakemedelsdel.delar)) {
        expect(handling).toBe('las_lakemedel');
        expect(post[namn]).toEqual((await k.get(`/api/patient/${id}/${namn}`)).data);
      }
    }
    // Den som inte får läsa läkemedel får ingen läkemedelsdel.
    await k.logga('adm-kard');
    const adm = (await k.get('/api/lasekopia')).data;
    for (const post of Object.values(adm.patienter)) {
      expect(post.lakemedelsdel).toBeNull();
      expect(post.lakemedel).toBeNull();
    }
  });

  test('förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar', async () => {
    const start = Date.now();
    setSystemTime(new Date(start));
    const k = klient(app);
    await k.logga('lak-kard');
    const fore = loggRader(k).length;
    const b = webblasare(k, start);
    const forsta = await b.hamta();
    const antal = Object.keys(forsta.patienter).length;
    const borjan = loggRader(k).slice(fore);
    expect(borjan.length).toBe(antal);
    expect(borjan.every(r => r.resurs === 'lasekopia' && r.syfte.includes('förnyas automatiskt'))).toBe(true);
    // Två timmars arbete utan att någon gör något: läskopian förnyas av sig själv, och loggen växer inte.
    await b.ga(2 * 3600_000);
    expect(b.antal).toBeGreaterThanOrEqual(2 * 3600_000 / forsta.fornyas.intervallMs);
    expect(loggRader(k).length).toBe(fore + antal);
    const senast = b.kopia.skapad;

    // Vid utloggningen loggas en rad per patient med tiden för det senaste utlämnandet och antalet förnyelser.
    b.nu += 3 * MIN;
    setSystemTime(new Date(b.nu));
    await k.post('/api/logout');
    const slut = loggRader(k).slice(fore + antal);
    expect(slut.length).toBe(antal);
    expect(new Set(slut.map(r => r.patient_id))).toEqual(new Set(Object.keys(forsta.patienter)));
    for (const r of slut) {
      const start = borjan.find(x => x.patient_id === r.patient_id);
      expect([r.resurs, r.personal_id, r.enhet_id, r.handling, r.grund, r.resultat]).toEqual(['lasekopia:slut', 'lak-kard', start.enhet_id, start.handling, start.grund, 'tillaten']);
      expect(r.tid).toBe(senast);
      expect(r.syfte).toContain(`förnyades ${b.antal - 1} gånger`);
      expect(r.syfte).toContain('loggade ut');
    }
    expect(verifiera(sandlada(app, k).db).hel).toBe(true);
    // En ny inloggning och en patient som inte längre hör till läskopian avslutar också utlämnandet.
    await k.logga('lak-akut');
    await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös vid ankomst' });
    await k.get('/api/patient/p02');
    await k.get('/api/lasekopia');
    const s = sandlada(app, k);
    const mitt = loggRader(k).length;
    // Patienten har inte öppnats under den här inloggningen längre, och har ingen vårdrelation på enheten.
    s.oppnade.delete('p02');
    const utan = (await k.get('/api/lasekopia')).data;
    expect(utan.patienter.p02).toBeUndefined();
    const ut = loggRader(k).slice(mitt);
    expect(ut.map(r => [r.patient_id, r.resurs, r.grund])).toEqual([['p02', 'lasekopia:slut', 'nodatkomst']]);
    expect(ut[0].syfte).toContain('inte längre');
    const efter = loggRader(k).length;
    await k.logga('lak-kard');
    const nya = loggRader(k).slice(efter);
    expect(nya.length).toBe(Object.keys(utan.patienter).length);
    expect(nya.every(r => r.resurs === 'lasekopia:slut' && r.personal_id === 'lak-akut' && r.syfte.includes('ny inloggning'))).toBe(true);
    expect(verifiera(s.db).hel).toBe(true);
  });
});
