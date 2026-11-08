// Runda 10, r5, del 4: sammanhållen journalföring med en simulerad annan vårdgivare (Sussa 3.2.2.3), patientdatalagen
// (2008:355) 6 kap. Testnamnen finns i src/sussa/runda10-r5-tester.js.
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { T } from '../src/sussa/runda10-r5-tester.js';
import * as sj from '../src/sammanhallen.js';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
async function inloggad(id) { const k = klient(app); await k.logga(id); return k; }
const hamta = (k, pid, body = {}) => k.post(`/api/patient/${pid}/sammanhallen`, { syfte: 'Bedömning av patientens hjärtsvikt', ...body });

describe('Sammanhållen journalföring', () => {
  test(T.sjSamtycke.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    // Utan val visas ingenting från den andra vårdgivaren, och översikten säger bara att uppgifter kan finnas.
    const fore = (await k.get('/api/patient/p01/sammanhallen')).data;
    expect(fore).toMatchObject({ hamtad: false, samtycke: null, vardgivare: [{ namn: sj.VARDGIVARE.namn, simulerad: true }] });
    expect(fore.poster).toEqual([]);
    expect((await k.get('/api/patient/p01/oversikt')).data.tidslinje.some(t => t.typ === 'extern')).toBe(false);
    // Utan samtycke hämtas ingenting.
    const nej = await hamta(k, 'p01');
    expect(nej.status).toBe(400);
    expect(nej.data.falt).toEqual(['samtycke']);
    // Med samtycke och ett aktivt val hämtas uppgifterna och samtycket registreras.
    const ja = await hamta(k, 'p01', { samtycke: true });
    expect(ja.status).toBe(200);
    expect(ja.data).toMatchObject({ hamtad: true, samtycke: { registreratAv: { id: 'lak-kard' } } });
    expect(ja.data.poster.length).toBeGreaterThan(2);
    // Nästa gång räcker det aktiva valet, eftersom samtycket finns.
    const k2 = await inloggad('lak-kard');
    const s2 = sandlada(app, k2);
    s2.db.query("INSERT INTO sammanhallen_samtycken (patient_id, enhet_id, registrerat, registrerat_av) VALUES ('p01', 'uso-kard', ?, 'lak-kard')").run(new Date().toISOString());
    expect((await hamta(k2, 'p01')).status).toBe(200);
    // Utan vårdrelation och utan nödåtkomst: ingenting.
    expect((await hamta(k, 'p13', { samtycke: true })).status).toBe(403);
    // En vårdadministratör tar inte del av andra vårdgivares journaler.
    const adm = await inloggad('adm-kard');
    expect((await hamta(adm, 'p01', { samtycke: true })).status).toBe(403);
  });

  test(T.sjKronologi.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    await hamta(k, 'p01', { samtycke: true });
    const d = (await k.get('/api/patient/p01/sammanhallen')).data;
    expect(d.hamtad).toBe(true);
    for (const p of d.poster) {
      expect(p.vardgivare).toEqual({ namn: sj.VARDGIVARE.namn, hsaId: sj.VARDGIVARE.hsaId });
      for (const f of [p.vardenhet.namn, p.tid, p.typ, p.yrkesroll, p.skapadAv]) expect(typeof f).toBe('string');
      expect(p.kallaEtikett).toContain('simulerad');
    }
    expect(d.poster.find(p => p.id === 'hh-2')).toMatchObject({ typ: 'anteckning', yrkesroll: 'Läkare', skapadAv: 'Demoläkare Hälsohuset', vardenhet: { namn: 'Hälsohuset vårdcentral (simulerad)' } });
    expect(new Set(d.poster.map(p => p.typ))).toEqual(new Set(['vardkontakt', 'anteckning', 'diagnos', 'lakemedel']));
    // Nyast först, och sorterat och valt på begäran.
    const tider = d.poster.map(p => p.tid);
    expect(tider).toEqual([...tider].sort().reverse());
    const aldst = (await k.get('/api/patient/p01/sammanhallen?sortera=aldst&typ=lakemedel')).data.poster;
    expect(aldst.every(p => p.typ === 'lakemedel')).toBe(true);
    expect(aldst.map(p => p.tid)).toEqual(aldst.map(p => p.tid).sort());
    // I översiktens kronologi bland Vårdkällans egna poster, med källan utskriven.
    const t = (await k.get('/api/patient/p01/oversikt')).data.tidslinje;
    const ext = t.filter(x => x.typ === 'extern');
    expect(ext.length).toBe(d.poster.length);
    expect(ext[0].kalla).toBe(`extern:${sj.VARDGIVARE.hsaId}`);
    expect(typeof ext[0].enhet.namn).toBe('string');
    expect(ext[0].kallaEtikett).toContain(sj.VARDGIVARE.namn);
    expect(t.map(x => x.tid)).toEqual([...t.map(x => x.tid)].sort().reverse());
  });

  test(T.sjSparr.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    const d = (await hamta(k, 'p01', { samtycke: true })).data;
    // Seedens spärrade post hos den andra vårdgivaren hämtas aldrig och nämns inte.
    const sparrad = sj.POSTER.p01.filter(p => p.sparrad);
    expect(sparrad.length).toBeGreaterThan(0);
    const txt = JSON.stringify(d);
    for (const p of sparrad) expect(txt).not.toContain(p.rubrik);
    expect(txt).not.toMatch(/spärr/i);
    expect(d.poster.length).toBe(sj.POSTER.p01.length - sparrad.length);
  });

  test(T.sjNod.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    const s = sandlada(app, k);
    // Emma Karlsson (p13) har ingen vårdrelation till kardiologen. Med nödåtkomst behövs inget samtycke.
    expect((await k.post('/api/patient/p13/val', { typ: 'nodatkomst', syfte: 'Patienten är medvetslös' })).status).toBe(200);
    const r = await hamta(k, 'p13');
    expect(r.status).toBe(200);
    expect(r.data.grund).toBe('nodatkomst');
    expect(JSON.stringify(r.data)).not.toContain(sj.POSTER.p13.find(p => p.sparrad).rubrik);
    expect(s.db.query("SELECT grund FROM atkomstlogg WHERE patient_id = 'p13' AND resurs LIKE 'sammanhallen:%' ORDER BY id DESC").get().grund).toBe('nodatkomst');
    // Nödåtkomsten registrerar inget samtycke.
    expect(s.db.query("SELECT count(*) AS n FROM sammanhallen_samtycken WHERE patient_id = 'p13'").get().n).toBe(0);
  });

  test(T.sjBunden.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    expect((await hamta(k, 'p01', { samtycke: true })).data.hamtad).toBe(true);
    // Nästa person som loggar in i samma session får inte valet, fast samtycket finns på vårdenheten.
    await k.logga('ssk-kard');
    expect((await k.get('/api/patient/p01/sammanhallen')).data.hamtad).toBe(false);
    expect((await k.get('/api/patient/p01/oversikt')).data.tidslinje.some(t => t.typ === 'extern')).toBe(false);
    // Samma person som loggar in igen gör ett nytt aktivt val.
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01/sammanhallen')).data.hamtad).toBe(false);
    // Valet är bundet till personen och vårdenheten: byts personen eller uppdraget i sessionen gäller det inte.
    expect((await hamta(k, 'p01')).data.hamtad).toBe(true);
    const s = sandlada(app, k);
    somPerson(s, 'lak-akut');
    const r = await k.get('/api/patient/p01/sammanhallen');
    expect(r.data.hamtad).toBe(false);
    expect(JSON.stringify(r.data.poster)).toBe('[]');
    somPerson(s, 'lak-kard');
    expect((await k.get('/api/patient/p01/sammanhallen')).data.hamtad).toBe(true);
    s.db.query("UPDATE personal SET enhet_id = 'uso-med' WHERE id = 'lak-kard'").run();
    const annan = await k.get('/api/patient/p01/sammanhallen');
    expect(annan.data?.hamtad ?? false).toBe(false);
    s.db.query("UPDATE personal SET enhet_id = 'uso-kard' WHERE id = 'lak-kard'").run();
    // Efter en utloggning finns inget val kvar.
    await k.post('/api/logout', {});
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01/sammanhallen')).data.hamtad).toBe(false);
  });

  test(T.sjLogg.split(' > ')[1], async () => {
    const k = await inloggad('lak-kard');
    const s = sandlada(app, k);
    await hamta(k, 'p01', { samtycke: true });
    const rad = s.db.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = ? ORDER BY id DESC").get(`sammanhallen:${sj.VARDGIVARE.hsaId}`);
    expect(rad).toMatchObject({ handling: 'las_journal', grund: 'samtycke', personal_id: 'lak-kard' });
    expect(rad.syfte).toContain('hjärtsvikt');
    // Samtycket återkallas: det aktiva valet tas bort, och nästa hämtning kräver nytt samtycke.
    const a = await k.post('/api/patient/p01/sammanhallen/aterkalla', {});
    expect(a.status).toBe(200);
    expect(a.data).toMatchObject({ hamtad: false, samtycke: null, poster: [] });
    expect((await hamta(k, 'p01')).status).toBe(400);
    expect(() => s.db.query('DELETE FROM sammanhallen_samtycken').run()).toThrow(/raderas inte/);
  });
});
