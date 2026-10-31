import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { join, relative } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { verifiera } from '../src/logg.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const nu = () => new Date().toISOString();
const rad = (patientId, handling = 'las_oversikt', extra = {}) => ({ id: crypto.randomUUID(), tid: nu(), patientId, handling, resurs: `/api/patient/${patientId}`, ...extra });

describe('Läskopia', () => {
  test('nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning', async () => {
    const k = klient(app);
    const fore = await k.get('/api/session');
    expect(fore.data.lasnyckel).toBeUndefined();
    const a = (await k.logga('lak-kard')).data.lasnyckel;
    expect(a.nyckel).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a.nyckel, 'base64url').length).toBe(32);
    const giltig = Date.parse(a.giltigTill) - Date.now();
    expect(giltig).toBeGreaterThan(8 * 3600_000 - 60_000);
    expect(giltig).toBeLessThanOrEqual(8 * 3600_000);
    expect((await k.get('/api/session')).data.lasnyckel).toEqual(a);
    // Läskopian innehåller inte nyckeln.
    const kopia = await k.get('/api/lasekopia');
    expect(JSON.stringify(kopia.data)).not.toContain(a.nyckel);
    expect(kopia.data.session.lasnyckel).toBeUndefined();
    const b = (await k.logga('lak-kard')).data.lasnyckel;
    expect(b.nyckel).not.toBe(a.nyckel);
    await k.post('/api/logout');
    expect(sandlada(app, k).lasnyckel).toBeNull();
    expect((await k.get('/api/session')).data.lasnyckel).toBeUndefined();
  });

  test('innehåller bara det servern redan lämnar ut till den inloggade', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const kopia = (await k.get('/api/lasekopia')).data;
    const lista = (await k.get('/api/arbetslista')).data;
    expect(kopia.arbetslista).toEqual(lista);
    expect(Object.keys(kopia.patienter).sort()).toEqual(lista.map(p => p.id).sort());
    expect(Date.parse(kopia.giltigTill)).toBeGreaterThan(Date.now());
    // Varje del är identisk med vad det vanliga anropet ger.
    for (const [id, post] of Object.entries(kopia.patienter)) {
      expect(post.huvud).toEqual((await k.get(`/api/patient/${id}`)).data);
      expect(post.oversikt).toEqual((await k.get(`/api/patient/${id}/oversikt`)).data);
      expect(post.lakemedel).toEqual((await k.get(`/api/patient/${id}/lakemedel`)).data);
      const ant = (await k.get(`/api/patient/${id}/anteckningar`)).data;
      expect(post.anteckningar.anteckningar).toEqual(ant.anteckningar.slice(0, 5));
      expect(post.anteckningar.totalt).toBe(ant.anteckningar.length);
      expect(Object.keys(post.anteckning).length).toBe(Math.min(5, ant.anteckningar.length));
      for (const [aid, a] of Object.entries(post.anteckning)) expect(a).toEqual((await k.get(`/api/anteckning/${aid}`)).data);
    }
    // En patient utan vårdrelation kommer inte med, inte heller efter ett nekat försök att öppna journalen.
    expect((await k.get('/api/patient/p12')).status).toBe(403);
    expect((await k.get('/api/lasekopia')).data.patienter.p12).toBeUndefined();
    // Uppgifter från andra vårdenheter kommer med först efter det aktiva valet, precis som i journalen.
    const fore = kopia.patienter.p01.oversikt.dolda.kraverVal;
    expect(fore).toBeGreaterThan(0);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Läkemedelsgenomgång' });
    const efter = (await k.get('/api/lasekopia')).data.patienter.p01;
    expect(efter.oversikt.dolda.kraverVal).toBe(0);
    expect(efter.oversikt).toEqual((await k.get('/api/patient/p01/oversikt')).data);
  });

  test('spärrade uppgifter och skyddad identitet följer samma regler i läskopian', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const kopia = (await k.get('/api/lasekopia')).data;
    const p04 = kopia.patienter.p04;
    expect(p04.huvud.sparrmarkering).toBe(true);
    expect(JSON.stringify(p04)).not.toContain('Allmänpsykiatriska');
    // Den skyddade patienten finns på arbetslistan och följer med maskerad.
    const p03 = kopia.patienter.p03;
    expect(p03.huvud.namn).toBe('Skyddad identitet');
    expect(p03.huvud.personnummer).toBe('19840416-****');
    expect(p03.oversikt.kontakt).toEqual({ adress: null, postnr: null, ort: null, telefon: null, kontaktperson: null });
    expect(JSON.stringify(kopia)).not.toContain('Engberg');
    // Samtycke i stunden visar de spärrade uppgifterna i journalen, och då också i läskopian.
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker muntligt' });
    const med = (await k.get('/api/lasekopia')).data.patienter.p04;
    expect(JSON.stringify(med)).toContain('Allmänpsykiatriska');
    expect(med.anteckningar.anteckningar).toEqual((await k.get('/api/patient/p04/anteckningar')).data.anteckningar.slice(0, 5));
  });

  test('yrkesrollen styr vad läskopian innehåller', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    const usk = (await k.get('/api/lasekopia')).data;
    const p01 = usk.patienter.p01;
    expect(p01.oversikt.diagnoser).toBeNull();
    expect(p01.lakemedel.ordinationer.length).toBeGreaterThan(0);
    expect(p01.anteckningar.anteckningar.every(a => a.kategori === 'omvardnad')).toBe(true);
    expect(Object.values(p01.anteckning).every(a => a.kategori === 'omvardnad')).toBe(true);
    await k.logga('adm-kard');
    const adm = (await k.get('/api/lasekopia')).data;
    for (const post of Object.values(adm.patienter)) {
      expect(post.handling).toBe('las_admin');
      expect(post.lakemedel).toBeNull();
      expect(post.anteckningar).toBeNull();
      expect(post.oversikt.lakemedel).toBeNull();
      expect(post.huvud.overkanslighet).toBeNull();
    }
    await k.logga('logg');
    const lg = (await k.get('/api/lasekopia')).data;
    expect(lg.patienter).toEqual({});
    expect(lg.arbetslista).toEqual([]);
  });

  test('utan inloggning lämnas ingen läskopia ut', async () => {
    const k = klient(app);
    const r = await k.get('/api/lasekopia');
    expect(r.status).toBe(401);
    expect(r.data.kod).toBe('ej_inloggad');
    expect((await k.post('/api/lasekopia/logg', { rader: [rad('p01')] })).status).toBe(401);
  });

  test('utloggning med åtkomster från läsläget loggar dem innan sessionen avslutas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.get('/api/lasekopia');
    const db = sandlada(app, k).db;
    const fore = loggRader(k).length;
    const r = await k.post('/api/logout', { rader: [rad('p01'), rad('p12')] });
    expect(r.status).toBe(200);
    expect(r.data.inloggad).toBe(false);
    expect(r.data.lasloggen.mottagna).toBe(1);
    expect(r.data.lasloggen.avvisade.length).toBe(1);
    const nya = db.query('SELECT * FROM atkomstlogg ORDER BY id').all().slice(fore);
    expect(nya.some(x => x.patient_id === 'p01' && x.resurs.startsWith('laslage:') && x.personal_id === 'lak-kard')).toBe(true);
    expect(verifiera(db).hel).toBe(true);
    // Efter utloggningen går raderna inte längre att skicka.
    expect((await k.post('/api/lasekopia/logg', { rader: [rad('p01')] })).status).toBe(401);
  });

  test('att uppgifterna lämnas ut till läskopian loggas en gång per patient och grund', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const fore = loggRader(k).length;
    const kopia = (await k.get('/api/lasekopia')).data;
    const antal = Object.keys(kopia.patienter).length;
    const nya = loggRader(k).slice(fore);
    expect(nya.length).toBe(antal);
    expect(nya.every(r => r.resurs === 'lasekopia' && r.personal_id === 'lak-kard' && r.resultat === 'tillaten')).toBe(true);
    expect(new Set(nya.map(r => r.patient_id)).size).toBe(antal);
    // Samma kopia igen loggas inte en gång till.
    await k.get('/api/lasekopia');
    expect(loggRader(k).length).toBe(fore + antal);
    // Ett aktivt val ändrar grunden, och då loggas utlämnandet igen för den patienten.
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Läkemedelsgenomgång' });
    const mitt = loggRader(k).length;
    await k.get('/api/lasekopia');
    const igen = loggRader(k).slice(mitt);
    expect(igen.map(r => [r.patient_id, r.grund, r.resurs])).toEqual([['p01', 'aktivt_val', 'lasekopia']]);
    // En patient som öppnas med nödåtkomst kommer med i läskopian och loggas med nödåtkomst som grund.
    await k.logga('lak-akut');
    await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös vid ankomst' });
    expect((await k.get('/api/patient/p02')).status).toBe(200);
    const akut = (await k.get('/api/lasekopia')).data;
    expect(akut.patienter.p02.huvud.nodatkomst).toBe(true);
    expect(loggRader(k).filter(r => r.resurs === 'lasekopia' && r.patient_id === 'p02').at(-1).grund).toBe('nodatkomst');
    expect(verifiera(sandlada(app, k).db).hel).toBe(true);
  });

  test('åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const forst = loggRader(k).length;
    await k.get('/api/lasekopia');
    // Grunden är den som gällde när uppgifterna lämnades ut till läskopian.
    const grund = Object.fromEntries(loggRader(k).slice(forst).map(x => [x.patient_id, x.grund]));
    const fore = loggRader(k).length;
    const tid = new Date(Date.now() - 60_000).toISOString();
    const rader = [rad('p01', 'las_oversikt', { tid }), rad('p01', 'las_lakemedel', { resurs: '/api/patient/p01/lakemedel' }), rad('p04', 'las_journal', { resurs: '/api/patient/p04/anteckningar' })];
    const r = await k.post('/api/lasekopia/logg', { rader });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ mottagna: 3, avvisade: [] });
    const nya = loggRader(k).slice(fore);
    expect(nya.map(x => [x.patient_id, x.handling, x.grund, x.resultat])).toEqual([
      ['p01', 'las_oversikt', grund.p01, 'tillaten'], ['p01', 'las_lakemedel', grund.p01, 'tillaten'], ['p04', 'las_journal', grund.p04, 'tillaten'],
    ]);
    expect(grund.p01).toBe('egen_enhet');
    expect(nya[0].tid).toBe(tid);
    expect(nya[1].resurs).toBe('laslage:/api/patient/p01/lakemedel');
    expect(nya.every(x => x.personal_id === 'lak-kard' && x.syfte.startsWith('Läsläge vid avbrott'))).toBe(true);
    expect(verifiera(sandlada(app, k).db).hel).toBe(true);
    // Logggranskaren ser raderna i patientens logglista.
    await k.logga('logg');
    const ll = (await k.get('/api/patient/p01/logglista')).data;
    expect(ll.rader.filter(x => x.resurs?.startsWith('laslage:')).length).toBe(2);
    expect(ll.kedjaHel).toBe(true);
  });

  test('åtkomster utanför läskopian, med fel handling eller fel tid avvisas', async () => {
    const k = klient(app);
    await k.logga('usk-kard');
    await k.get('/api/lasekopia');
    const fore = loggRader(k).length;
    const r = await k.post('/api/lasekopia/logg', { rader: [
      rad('p12'),
      rad('p01', 'las_journal'),
      rad('p01', 'ordinera'),
      rad('p01', 'las_oversikt', { tid: new Date(Date.now() - 9 * 3600_000).toISOString() }),
      rad('p01', 'las_oversikt', { tid: new Date(Date.now() + 3600_000).toISOString() }),
      rad('p01', 'las_oversikt', { id: 'x' }),
      rad('p01', 'las_omvardnad'),
    ] });
    expect(r.status).toBe(200);
    expect(r.data.mottagna).toBe(1);
    expect(r.data.avvisade.map(a => a.orsak)).toEqual([
      'Patienten fanns inte i din läskopia.', 'Handlingen är inte en läsning som din yrkesroll får göra.', 'Handlingen är inte en läsning som din yrkesroll får göra.',
      'Tidpunkten ligger utanför läskopians giltighet.', 'Tidpunkten ligger utanför läskopians giltighet.', 'Raden saknar giltigt id.',
    ]);
    expect(loggRader(k).slice(fore).map(x => [x.patient_id, x.handling])).toEqual([['p01', 'las_omvardnad']]);
    // En ny inloggning nollställer läskopian, och då tas inga åtkomster emot förrän en ny kopia har lämnats ut.
    await k.logga('usk-kard');
    expect((await k.post('/api/lasekopia/logg', { rader: [rad('p01')] })).data.avvisade.length).toBe(1);
    expect((await k.post('/api/lasekopia/logg', { rader: 'fel' })).status).toBe(400);
    expect((await k.post('/api/lasekopia/logg', { rader: Array.from({ length: 501 }, (_, i) => ({ id: `rad-${i}-abcdefgh` })) })).status).toBe(400);
  });

  test('en rad som skickas två gånger loggas en gång', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.get('/api/lasekopia');
    const fore = loggRader(k).length;
    const r = rad('p01');
    expect((await k.post('/api/lasekopia/logg', { rader: [r] })).data.mottagna).toBe(1);
    expect((await k.post('/api/lasekopia/logg', { rader: [r, r] })).data.mottagna).toBe(2);
    expect(loggRader(k).length).toBe(fore + 1);
  });

  test('läskopians nyckel och kopplingar överlever omstart av servern', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-laskopia-'));
    const fil = join(dir, 'sessioner.json');
    const a = testserver({ sessionFil: fil });
    const k = klient(a);
    const nyckel = (await k.logga('lak-kard')).data.lasnyckel;
    await (await fetch(`${a.url}/api/lasekopia`, { headers: { Cookie: k.kaka() } })).json();
    const r1 = rad('p01');
    await fetch(`${a.url}/api/lasekopia/logg`, { method: 'POST', headers: { Cookie: k.kaka(), 'Content-Type': 'application/json' }, body: JSON.stringify({ rader: [r1] }) });
    a.spara();
    a.stopp();
    const b = testserver({ sessionFil: fil });
    try {
      const s = await fetch(`${b.url}/api/session`, { headers: { Cookie: k.kaka() } }).then(x => x.json());
      expect(s.lasnyckel).toEqual(nyckel);
      // Åtkomster från ett avbrott som pågick under omstarten tas emot, och en rad som redan togs emot loggas inte igen.
      const svar = await fetch(`${b.url}/api/lasekopia/logg`, { method: 'POST', headers: { Cookie: k.kaka(), 'Content-Type': 'application/json' }, body: JSON.stringify({ rader: [r1, rad('p01')] }) }).then(x => x.json());
      expect(svar).toEqual({ mottagna: 2, avvisade: [] });
      const db = [...b.sessioner.values()][0].db;
      expect(db.query("SELECT COUNT(*) AS n FROM atkomstlogg WHERE resurs LIKE 'laslage:%'").get().n).toBe(2);
    } finally { b.stopp(); rmSync(dir, { recursive: true }); }
  });

  test('service workern cachar alla statiska filer', () => {
    const rot = join(import.meta.dir, '..', 'public');
    const filer = [];
    const ga = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) ga(f); else filer.push(`/${relative(rot, f)}`); } };
    ga(rot);
    const sw = readFileSync(join(rot, 'sw.js'), 'utf8');
    const lista = JSON.parse(sw.match(/const FILER = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
    expect([...lista].sort()).toEqual(filer.filter(f => f !== '/sw.js').sort());
    // API och FHIR går aldrig via cachen, så patientuppgifter hamnar inte där.
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain("url.pathname.startsWith('/fhir/')");
    expect(lista.some(f => f.startsWith('/api') || f.startsWith('/fhir'))).toBe(false);
  });
});
