// Runda 7, r2: nyheter vid ny version (Sussa 10.1.1.4), övningar med intyg (Sussa 10.1.1.5) och
// tillgänglighetsredogörelsen (Sussa 8.4.1.3, bilaga K2). Testnamnen står i src/sussa/runda7-r2.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSeed } from '../src/db.js';
import * as nyheter from '../src/nyheter.js';
import * as utbildning from '../src/utbildning.js';
import { KRAV, TILLAGG, ANPASSNING, STATUS, BEDOMNING, redogorelse, tillganglighetTester, markdown } from '../src/tillganglighet.js';
import { YRKEN } from '../src/seed/personal.js';
import { prova } from './sprakkontroll.js';
import { personal, testserver, klient } from './hjalp.js';

const APP = join(import.meta.dir, '..');
let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const pers = (d, id) => ({ personal: personal(d, id), invanare: null });
const NU = new Date('2026-11-08T10:00:00Z');
const DAG = 86400_000;
// Patientuppgifter som aldrig får finnas i nyheter eller övningar. Demopatienternas påhittade namn får förekomma.
const PATIENT = /p0[1-9]\b|p1[0-9]\b|19[0-9]{6}-?[0-9]{4}|20[0-9]{6}-?[0-9]{4}|Birgitta|Nyman|Engberg/;

describe('Nyheter', () => {
  test('nyheterna har version, datum och roller, och den senaste versionen är den som körs', () => {
    const paket = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
    expect(nyheter.AKTUELL).toBe(paket.version);
    const versioner = nyheter.NYHETER.map(v => v.version);
    // Den senaste först, och varje version en gång.
    expect(new Set(versioner).size).toBe(versioner.length);
    const tal = (v) => v.split('.').map(Number).reduce((s, x) => s * 1000 + x, 0);
    expect([...versioner].sort((a, b) => tal(b) - tal(a))).toEqual(versioner);
    const roller = new Set([...nyheter.ROLLER, ...nyheter.GRUPPER]);
    for (const v of nyheter.NYHETER) {
      expect(v.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.nyheter.length).toBeGreaterThan(0);
      for (const n of v.nyheter) {
        expect(n.id).toMatch(/^[a-z0-9-]+$/);
        expect(n.rubrik.length).toBeGreaterThan(5);
        expect(n.text.length).toBeGreaterThan(20);
        expect(nyheter.OMFATTNING).toContain(n.omfattning);
        expect(n.roller.length).toBeGreaterThan(0);
        for (const r of n.roller) expect(roller.has(r)).toBe(true);
        if (n.var) expect(n.var).toMatch(/^#\/[a-z]/);
      }
    }
    // Varje roll har något nytt i den aktuella versionen.
    for (const r of nyheter.ROLLER) expect(nyheter.forRoll(r)[0].version).toBe(nyheter.AKTUELL);
  });

  test('rutan visar bara den aktuella versionens nyheter för användarens roll, och historiken går att läsa igen', () => {
    const d = byggSeed();
    const lak = nyheter.nyheter(d, pers(d, 'lak-kard'));
    expect(lak.version).toBe(nyheter.AKTUELL);
    expect(lak.ruta.version).toBe(nyheter.AKTUELL);
    expect(lak.ruta.nyheter.map(n => n.id)).toContain('hjalp-och-intyg');
    // Verksamhetschefens nyhet visas inte för läkaren, och den stora förändringen står före den lilla.
    expect(lak.ruta.nyheter.map(n => n.id)).not.toContain('intyg-enhet');
    expect(lak.ruta.nyheter[0].omfattning).toBe('stor');
    // Historiken har också den förra versionens nyheter för läkaren, men inte de som gäller andra roller.
    expect(lak.alla.map(v => v.version)).toEqual(nyheter.NYHETER.map(v => v.version));
    const forra = lak.alla[1].nyheter.map(n => n.id);
    expect(forra).toContain('mallar');
    expect(forra).not.toContain('resurser');
    expect(forra).not.toContain('vardbegaran');
    const vch = nyheter.nyheter(d, pers(d, 'vch-kard'));
    expect(vch.ruta.nyheter.map(n => n.id)).toEqual(expect.arrayContaining(['intyg-enhet', 'hjalp-och-intyg']));
    // Invånaren ser det som gäller alla, men inte personalens nyheter.
    const inv = nyheter.nyheter(d, { personal: null, invanare: { id: 'inv-p01' } });
    expect(inv.roll).toBe('invanare');
    expect(inv.ruta.nyheter.map(n => n.id)).toEqual(['hog-kontrast', 'nyhetsrutan']);
    expect(inv.alla[1].nyheter.map(n => n.id)).toEqual(['vardbegaran']);
  });

  test('rutan stängs per användare och version och kommer tillbaka vid nästa version', () => {
    const d = byggSeed();
    const lak = pers(d, 'lak-kard');
    const efter = nyheter.stang(d, lak, nyheter.AKTUELL, { nu: NU });
    expect(efter.ruta).toBeNull();
    // Historiken finns kvar att läsa igen.
    expect(efter.alla[0].nyheter.length).toBeGreaterThan(0);
    // En annan användare med samma roll ser fortfarande rutan.
    expect(nyheter.nyheter(d, pers(d, 'lak-akut')).ruta).not.toBeNull();
    // Att stänga igen ändrar inget.
    expect(nyheter.stang(d, lak, nyheter.AKTUELL, { nu: NU }).ruta).toBeNull();
    expect(d.query('SELECT COUNT(*) AS n FROM nyheter_stangda').get().n).toBe(1);
    // En ny version med en nyhet för läkaren visar rutan igen.
    const ny = [{ version: '9.9.9', datum: '2027-01-01', nyheter: [{ id: 'ny', roller: ['lakare'], omfattning: 'liten', rubrik: 'Något nytt', text: 'En ny sak för läkaren i nästa version.' }] }, ...nyheter.NYHETER];
    expect(nyheter.nyheter(d, lak, { versioner: ny }).ruta.nyheter.map(n => n.id)).toEqual(['ny']);
    // En version utan något nytt för rollen ger ingen ruta.
    expect(nyheter.nyheter(d, pers(d, 'adm-kard'), { versioner: ny }).ruta).toBeNull();
    // En okänd version går inte att stänga.
    expect(fel(() => nyheter.stang(d, lak, '0.0.1'))).toMatchObject({ status: 400 });
  });

  test('API: nyheter kräver inloggning, och invånaren får sina egna', async () => {
    const k = klient(app);
    expect((await k.get('/api/nyheter')).status).toBe(401);
    await k.logga('ssk-kard');
    const r = await k.get('/api/nyheter');
    expect(r.status).toBe(200);
    expect(r.data.roll).toBe('sjukskoterska');
    expect(r.data.ruta.nyheter.length).toBeGreaterThan(0);
    const s = await k.post('/api/nyheter/stang', { version: r.data.version });
    expect(s.status).toBe(200);
    expect(s.data.ruta).toBeNull();
    expect((await k.get('/api/nyheter')).data.ruta).toBeNull();
    expect((await k.post('/api/nyheter/stang', { version: 'x' })).status).toBe(400);
    // Invånaren i en egen session.
    const i = klient(app);
    expect((await i.post('/api/login/invanare', { invanareId: 'inv-p01' })).status).toBe(200);
    const ri = await i.get('/api/nyheter');
    expect(ri.data.roll).toBe('invanare');
    expect(ri.data.ruta.nyheter.map(n => n.id)).not.toContain('hjalp-och-intyg');
    expect(JSON.stringify(ri.data)).not.toMatch(PATIENT);
  });
});

describe('Övningar och intyg', () => {
  test('varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen', () => {
    const d = byggSeed();
    for (const yrke of Object.keys(YRKEN)) expect(utbildning.ovningarFor(yrke).length).toBeGreaterThanOrEqual(3);
    for (const x of utbildning.OVNINGAR) {
      expect(x.alternativ.some(([id]) => id === x.ratt)).toBe(true);
      expect(x.forklaring.length).toBeGreaterThan(20);
    }
    const o = utbildning.oversikt(d, personal(d, 'lak-kard'), { nu: NU });
    expect(o.ovningar.map(x => x.id)).toEqual(expect.arrayContaining(['logg', 'andra-enheter', 'overkanslighet', 'nodatkomst']));
    expect(o.ovningar.map(x => x.id)).not.toContain('boka');
    const text = JSON.stringify(o.ovningar);
    expect(text).not.toContain('"ratt"');
    expect(text).not.toContain('forklaring');
    expect(o.intyg.status).toBe('saknas');
    // Länken till demon visas bara när rollen når stället: arkivarien får ingen länk till en journal.
    expect(o.ovningar.find(x => x.id === 'andra-enheter').prova).toBe('#/patient/p01');
    const ark = utbildning.oversikt(d, personal(d, 'ark'), { nu: NU });
    expect(ark.ovningar.map(x => x.id)).toEqual(['logg', 'expert', 'gallring']);
    expect(ark.ovningar.find(x => x.id === 'gallring').prova).toBe('#/arkiv');
  });

  test('alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg', async () => {
    const d = byggSeed();
    const lak = personal(d, 'lak-kard');
    const lista = utbildning.ovningarFor('lakare');
    const ratt = Object.fromEntries(lista.map(x => [x.id, x.ratt]));
    // Obesvarade övningar räknas upp.
    expect(fel(() => utbildning.ratta(d, lak, { logg: 'b' }, { nu: NU }))).toMatchObject({ status: 400, extra: { falt: expect.arrayContaining(['expert']) } });
    const ettFel = utbildning.ratta(d, lak, { ...ratt, logg: 'a' }, { nu: NU });
    expect(ettFel).toMatchObject({ godkand: false, antalRatt: lista.length - 1, antal: lista.length });
    expect(ettFel.resultat.find(r => r.id === 'logg')).toMatchObject({ ratt: false, rattSvar: expect.stringContaining('åtkomstloggen'), forklaring: expect.any(String) });
    expect(ettFel.intyg.status).toBe('saknas');
    expect(d.query("SELECT COUNT(*) AS n FROM utbildningsintyg WHERE personal_id = 'lak-kard'").get().n).toBe(0);
    const ok = utbildning.ratta(d, lak, ratt, { nu: NU });
    expect(ok).toMatchObject({ godkand: true, antalRatt: lista.length });
    expect(ok.intyg).toMatchObject({ status: 'giltigt', utfardat: NU.toISOString(), giltigtTill: new Date(NU.getTime() + 365 * DAG).toISOString(), dagarKvar: 365 });
    const rad = d.query("SELECT * FROM utbildningsintyg WHERE personal_id = 'lak-kard'").get();
    expect(rad).toMatchObject({ vardenhet: 'uso-kard', roll: 'lakare', antal_ovningar: lista.length });
    // Samma via API:t, med en egen sandlåda.
    const k = klient(app);
    await k.logga('usk-kard');
    const g = await k.get('/api/utbildning');
    expect(g.status).toBe(200);
    const svar = Object.fromEntries(utbildning.ovningarFor('underskoterska').map(x => [x.id, x.ratt]));
    const r = await k.post('/api/utbildning/ratta', { svar });
    expect(r.status).toBe(200);
    expect(r.data.godkand).toBe(true);
    expect((await k.get('/api/utbildning')).data.intyg.status).toBe('giltigt');
    expect((await k.post('/api/utbildning/ratta', { svar: 'fel' })).status).toBe(400);
  });

  test('intyget går ut efter ett år, och systemet varnar 30 dagar innan', () => {
    const intyg = { utfardat: NU.toISOString(), giltigt_till: new Date(NU.getTime() + 365 * DAG).toISOString(), kurs: 'x', roll: 'lakare' };
    expect(utbildning.intygStatus(intyg, NU).status).toBe('giltigt');
    expect(utbildning.intygStatus(intyg, new Date(NU.getTime() + 334 * DAG)).status).toBe('giltigt');
    const snart = utbildning.intygStatus(intyg, new Date(NU.getTime() + 336 * DAG));
    expect(snart).toMatchObject({ status: 'gar_ut', dagarKvar: 29, text: 'Går ut om 29 dagar' });
    expect(utbildning.intygStatus(intyg, new Date(NU.getTime() + 365 * DAG)).status).toBe('utgatt');
    expect(utbildning.intygStatus(null, NU)).toMatchObject({ status: 'saknas', text: 'Inget intyg' });
  });

  test('verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det', async () => {
    // Seedens intyg räknas från när sandlådan skapas, så testet räknar från samma tid.
    const d = byggSeed(NU);
    const e = utbildning.enhet(d, personal(d, 'vch-kard'), { nu: NU });
    expect(e.vardenhet).toMatchObject({ id: 'uso-kard', namn: expect.stringContaining('Kardiologiska') });
    const per = Object.fromEntries(e.personer.map(p => [p.id, p.status]));
    expect(per).toMatchObject({ 'ssk-kard': 'giltigt', 'far-kard': 'giltigt', 'adm-kard': 'gar_ut', 'ol-kard': 'utgatt', 'lak-kard': 'saknas', 'usk-kard': 'saknas' });
    // Personal på en annan vårdenhet och den som inte längre är i tjänst finns inte med.
    expect(per['lak-akut']).toBeUndefined();
    expect(per['lak-cosmic']).toBeUndefined();
    // De som behöver göra något står först.
    expect(e.personer[0].status).toBe('utgatt');
    expect(e.summa.giltigt + e.summa.gar_ut + e.summa.utgatt + e.summa.saknas).toBe(e.personer.length);
    expect(JSON.stringify(e)).not.toMatch(PATIENT);
    // Ingen annan roll ser vårdenhetens intyg.
    for (const id of ['lak-kard', 'ssk-kard', 'adm-kard', 'logg', 'far-kard']) expect(fel(() => utbildning.enhet(d, personal(d, id), { nu: NU }))).toMatchObject({ status: 403 });
    expect(utbildning.oversikt(d, personal(d, 'vch-kard'), { nu: NU }).enhet).toBe(true);
    expect(utbildning.oversikt(d, personal(d, 'lak-kard'), { nu: NU }).enhet).toBe(false);
    const k = klient(app);
    expect((await k.get('/api/utbildning/enhet')).status).toBe(401);
    await k.logga('lak-kard');
    expect((await k.get('/api/utbildning/enhet')).status).toBe(403);
    await k.logga('vch-kard');
    const r = await k.get('/api/utbildning/enhet');
    expect(r.status).toBe(200);
    expect(r.data.personer.find(p => p.id === 'ssk-kard').status).toBe('giltigt');
    // Invånaren gör inga övningar.
    const i = klient(app);
    await i.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect((await i.get('/api/utbildning')).status).toBe(401);
  });

  test('övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska', () => {
    const texter = [];
    for (const x of utbildning.OVNINGAR) texter.push(x.fraga, x.forklaring, ...x.alternativ.map(a => a[1]));
    for (const v of nyheter.NYHETER) for (const n of v.nyheter) texter.push(n.rubrik, n.text);
    texter.push(utbildning.UTBILDNINGSMILJO);
    const alla = texter.join('\n');
    expect(alla).not.toMatch(PATIENT);
    // Bara demopatienter nämns, och de är märkta som demopatienter.
    for (const m of alla.matchAll(/demopatienten ([A-ZÅÄÖ][a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+)/g)) expect(['Gunnar Åkesson', 'Elin Sandberg']).toContain(m[1]);
    const fel = prova(texter.map((text, i) => ({ fil: 'utbildning', rad: i + 1, text })));
    expect(fel.map(f => `${f.regel}: ${f.ord} i ${f.text}`)).toEqual([]);
  });

  test('ett intyg ändras och raderas aldrig', () => {
    const d = byggSeed();
    expect(fel(() => d.query("UPDATE utbildningsintyg SET giltigt_till = '2099-01-01' WHERE personal_id = 'ssk-kard'").run())?.message).toContain('ändras inte');
    expect(fel(() => d.query("DELETE FROM utbildningsintyg WHERE personal_id = 'ssk-kard'").run())?.message).toContain('raderas inte');
  });
});

describe('Tillgänglighetsredogörelse', () => {
  test('redogörelsen har varje krav i bilaga K2 med status och hur det är testat', () => {
    // Bilaga K2 har 25 krav i WCAG-numrering.
    const id = ['1.1.1', '1.2.1', '1.2.2', '1.2.3', '1.2.5', '1.3.3', '1.4.1', '1.4.2', '1.4.3', '1.4.4', '1.4.5', '2.1.1', '2.1.2', '2.2.1', '2.2.2',
      '2.4.3', '2.4.4', '2.4.6', '2.4.7', '3.2.1', '3.2.2', '3.3.1', '3.3.2', '3.3.3', '3.3.4'];
    expect(KRAV.map(x => x.id)).toEqual(id);
    for (const x of [...KRAV, ...TILLAGG]) {
      expect(STATUS).toContain(x.avsedd);
      expect(BEDOMNING).toContain(x.bedomning);
      expect(x.en).toMatch(/^11\.\d/);
      expect(['A', 'AA']).toContain(x.niva);
      expect(x.hur.length).toBeGreaterThan(20);
    }
    expect(ANPASSNING.map(a => a.id)).toEqual(['syn', 'horsel', 'farg', 'kognition']);
  });

  test('ett krav är uppfyllt bara när alla dess tester är gröna, och det som bara kan bedömas av människor är märkt', () => {
    const grona = tillganglighetTester().map(namn => ({ namn, status: 'grön' }));
    const r = redogorelse(grona);
    expect(r.krav.find(x => x.id === '1.4.3').status).toBe('uppfyllt');
    expect(r.krav.find(x => x.id === '1.2.1').status).toBe('ej_tillampligt');
    const rod = redogorelse(grona.map(t => (t.namn.includes('kontrast') ? { ...t, status: 'röd' } : t)));
    expect(rod.krav.find(x => x.id === '1.4.3').status).toBe('delvis');
    // Utan testresultat är inget automatiskt krav uppfyllt.
    const tom = redogorelse([]);
    expect(tom.krav.filter(x => x.tester.length && x.status === 'uppfyllt')).toEqual([]);
    // Manuella krav har inga tester och är märkta, och ett automatiskt krav har alltid tester.
    for (const x of r.krav) {
      if (x.bedomning === 'manuell') { expect(x.tester).toEqual([]); expect(x.manuell).toBe(true); expect(x.anmarkning).toBeTruthy(); }
      if (x.bedomning === 'automatisk') { expect(x.tester.length).toBeGreaterThan(0); expect(x.manuell).toBe(false); }
      if (x.bedomning === 'bada') expect(x.manuell).toBe(true);
    }
    // Det som inte är uppfyllt sägs rakt ut.
    expect(r.krav.find(x => x.id === '2.2.1').status).toBe('ej');
    expect(r.summa.uppfyllt + r.summa.delvis + r.summa.ej + r.summa.ej_tillampligt).toBe(25);
  });

  test('API: tillganglighet går att läsa utan inloggning', async () => {
    const r = await fetch(`${app.url}/api/tillganglighet`);
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toBeNull();
    const d = await r.json();
    expect(d.krav.length).toBe(25);
    expect(d.kalla).toContain('EN 301 549');
  });

  test('docs/tillganglighet.md skrivs ur samma register som sidan och tar upp varje krav', () => {
    const md = markdown();
    // Dokumentet i docs/ är det som skriptet skriver. I Docker-bygget finns bara app/, och då prövas texten som skrivs.
    const fil = join(APP, '..', 'docs', 'tillganglighet.md');
    if (existsSync(fil)) expect(readFileSync(fil, 'utf8')).toBe(md);
    const STATUSTEXT = { uppfyllt: 'Uppfyllt', delvis: 'Delvis uppfyllt', ej: 'Ej uppfyllt', ej_tillampligt: 'Ej tillämpligt' };
    for (const x of [...KRAV, ...TILLAGG]) {
      const rad = md.split('\n').find(l => l.startsWith(`| ${x.id} `));
      expect(rad, `raden för ${x.id}`).toBeTruthy();
      expect(rad).toContain(x.rubrik);
      expect(rad).toContain(STATUSTEXT[x.avsedd]);
      if (x.bedomning !== 'automatisk') expect(rad).toContain('människa');
    }
    for (const a of ANPASSNING) expect(md).toContain(`### ${a.rubrik}`);
  });
});
