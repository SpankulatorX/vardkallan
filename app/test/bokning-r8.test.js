import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { arLedig, tidRad } from '../src/tidbok.js';

// Bokning, del 3 (runda 8, r3, Sussa 3.4.1 och 3.4.2, testfall 5.1 till 5.3): fri bokning, teambesök och gruppträffar.
// Systemet väljer besökstyp, vårdgivare, team, rum och tider, och den som bokar väljer bara bland förslagen.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const sussa = async (roll = 'adm-kard') => { const k = await inloggad(roll); expect((await k.post('/api/demo/sussa-testfall')).status).toBe(200); return k; };
const loggRader = (k, resurs) => db(k).query('SELECT * FROM atkomstlogg WHERE resurs LIKE ? ORDER BY id').all(resurs);
const B = '';

// Testnamnen står också i src/sussa/bokning-r8.js, som kravregistret pekar på.
const TESTER_R8 = {
  fri: `${B}fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen`,
  friSakerhet: `${B}fri bokning: utan vårdrelation, fel roll, en annan vårdenhets tid och en gruppträff nekas`,
  team: `${B}teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna`,
  teamSakerhet: `${B}teambesök: färre än två vårdgivare eller en vårdgivare från en annan vårdenhet nekas`,
  grupp: `${B}gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt`,
  gruppVantelista: `${B}gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst`,
};

describe('Bokning, del 3', () => {
  test(TESTER_R8.fri, async () => {
    const k = await sussa();
    const f = (await k.get('/api/patient/sus11/boka-fri/forslag')).data;
    expect(f.val).toMatchObject({ tidstyp: 'aterbesok', personalId: 'lak-kard', yrkesroll: 'lakare' });
    expect(f.skal.join(' ')).toContain('har varit här förut');
    expect(f.forslag.length).toBeGreaterThan(0);
    for (const x of f.forslag) expect(x).toMatchObject({ tidstyp: 'aterbesok', vardgivare: { id: 'lak-kard' } });
    expect(f.alternativ.vardgivare.map(v => v.id)).toContain('ssk-kardmott');
    // Användaren kan välja en annan besökstyp och vårdgivare.
    const g = (await k.get('/api/patient/sus11/boka-fri/forslag?tidstyp=telefon&personalId=ssk-kardmott')).data;
    for (const x of g.forslag) expect(x).toMatchObject({ tidstyp: 'telefon', vardgivare: { id: 'ssk-kardmott' } });
    const r = await k.post('/api/patient/sus11/boka-fri', { tidId: f.forslag[0].tidId });
    expect(r.status).toBe(201);
    expect(r.data.kallelse).toMatchObject({ status: 'skickad', kanal: 'brev' });
    expect(r.data.kallelseBesked).toContain('Kallelsen är skickad');
    const b = db(k).query('SELECT * FROM bokningar WHERE id = ?').get(r.data.id);
    expect(b.vantelista_id).toBeNull();
    expect(db(k).query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id)).toMatchObject({ planerad: 1, enhet_id: 'uso-kard-mott', patient_id: 'sus11' });
    expect(db(k).query("SELECT count(*) AS n FROM vantelista WHERE patient_id = 'sus11'").get().n).toBe(0);
    expect(loggRader(k, `bokning:${b.id}:fri`)).toHaveLength(1);
    // Samma tid går inte att boka två gånger.
    expect((await k.post('/api/patient/sus11/boka-fri', { tidId: f.forslag[0].tidId })).status).toBe(400);
  });

  test(TESTER_R8.friSakerhet, async () => {
    const k = await sussa();
    const f = (await k.get('/api/patient/sus11/boka-fri/forslag')).data;
    // Marianne Hägg har aldrig varit på kardiologen.
    const nekad = await k.get('/api/patient/sus26/boka-fri/forslag');
    expect(nekad.status).toBe(403);
    expect((await k.post('/api/patient/sus26/boka-fri', { tidId: f.forslag[0].tidId })).status).toBe(403);
    const annan = db(k).query("SELECT t.id FROM tider t WHERE t.schema_id = 'sch-vc-per' AND t.start > ? ORDER BY t.start LIMIT 1").get(new Date().toISOString());
    expect((await k.post('/api/patient/sus11/boka-fri', { tidId: annan.id })).status).toBe(400);
    const grupp = db(k).query("SELECT id FROM tider WHERE tidstyp = 'grupp' AND schema_id = 'sch-kard-jenny'").get();
    expect((await k.post('/api/patient/sus11/boka-fri', { tidId: grupp.id })).status).toBe(400);
    const lak = await inloggad('lak-kard');
    expect((await lak.get('/api/patient/p01/boka-fri/forslag')).status).toBe(403);
  });

  test(TESTER_R8.team, async () => {
    const k = await sussa();
    const f = (await k.get('/api/patient/sus10/teambesok/forslag')).data;
    expect(f.forval).toEqual(['lak-kard', 'ssk-kardmott']);
    expect(f.forslag.length).toBeGreaterThan(0);
    const x = f.forslag[0];
    expect(x.deltagare.map(d => d.id)).toEqual(['lak-kard', 'ssk-kardmott']);
    expect(x.resurser.map(r => r.kategori)).toContain('behandlingsrum');
    expect(Date.parse(x.slut) - Date.parse(x.start)).toBe(60 * 60_000);
    const r = await k.post('/api/patient/sus10/teambesok', { personal: f.valda, start: x.start });
    expect(r.status).toBe(201);
    expect(r.data.tid.tidstyp).toBe('team');
    expect(r.data.kallelse.text).toContain('Teambesök med läkare Sara Lindqvist och sjuksköterska Lina Persson');
    expect(r.data.resurser.map(x => x.kategori)).toContain('behandlingsrum');
    // Teamets vanliga tider som överlappar besöket är inte längre lediga.
    const d = db(k);
    const overlapp = d.query("SELECT * FROM tider WHERE schema_id IN ('sch-kard-sara', 'sch-kard-lina') AND tidstyp <> 'team' AND start < ? AND slut > ?").all(x.slut, x.start);
    for (const t of overlapp) expect(arLedig(d, tidRad(d, t.id))).toBe(false);
    // En annan patient får inte samma tid för samma team.
    const g = (await k.get('/api/patient/sus08/teambesok/forslag?personal=lak-kard,ssk-kardmott')).data;
    expect(g.forslag.some(y => y.start === x.start)).toBe(false);
    expect((await k.post('/api/patient/sus08/teambesok', { personal: ['lak-kard', 'ssk-kardmott'], start: x.start })).status).toBe(400);
    // Teambesöket syns i patientens bokningar men kan inte bokas om som en vanlig tid.
    const bok = (await k.get('/api/patient/sus10/bokningar')).data;
    expect(bok.kommande.find(b => b.id === r.data.id)).toMatchObject({ kanOmbokas: false });
  });

  test(TESTER_R8.teamSakerhet, async () => {
    const k = await sussa();
    expect((await k.get('/api/patient/sus10/teambesok/forslag?personal=lak-kard')).status).toBe(400);
    expect((await k.get('/api/patient/sus10/teambesok/forslag?personal=lak-kard,lak-vc')).status).toBe(400);
    expect((await k.post('/api/patient/sus10/teambesok', { personal: ['lak-kard', 'lak-vc'], start: new Date(Date.now() + 86400_000).toISOString() })).status).toBe(400);
    expect((await k.get('/api/patient/sus26/teambesok/forslag')).status).toBe(403);
  });

  test(TESTER_R8.grupp, async () => {
    const k = await sussa();
    const lista = (await k.get('/api/grupptraffar')).data.grupper;
    const g = lista.find(x => x.tid.rubrik === 'Hjärtrehabilitering i grupp');
    expect(g).toMatchObject({ platser: 8, bokade: 0, kvar: 8 });
    for (const pid of ['sus10', 'sus08', 'sus09', 'sus12']) {
      const r = await k.post(`/api/tid/${g.tid.id}/grupp`, { patientId: pid });
      expect(r.status).toBe(201);
      expect(r.data).toMatchObject({ bokad: true, kallelse: { status: 'vantar' } });
    }
    expect((await k.post(`/api/tid/${g.tid.id}/grupp`, { patientId: 'sus10' })).status).toBe(400);
    expect((await k.post(`/api/tid/${g.tid.id}/grupp`, { patientId: 'sus26' })).status).toBe(403);
    const efter = (await k.get('/api/grupptraffar')).data.grupper.find(x => x.tid.id === g.tid.id);
    expect(efter).toMatchObject({ bokade: 4, kvar: 4 });
    expect(efter.deltagare.map(d => d.id).sort()).toEqual(['sus08', 'sus09', 'sus10', 'sus12']);
    // Dagens arbete visar att kallelserna väntar, och de skickas för hela gruppen.
    const idag = (await k.get('/api/idag')).data;
    expect(idag.kallelser.some(x => x.typ === 'grupp' && x.tid.id === g.tid.id)).toBe(true);
    const kalla = await k.post(`/api/tid/${g.tid.id}/kalla`, {});
    expect(kalla.data.skickade).toHaveLength(4);
    // Den som läggs till efteråt får sin kallelse direkt.
    const sen = await k.post(`/api/tid/${g.tid.id}/grupp`, { patientId: 'sus11' });
    expect(sen.data.kallelse).toMatchObject({ status: 'skickad' });
    expect(sen.data.text).toContain('3 platser kvar');
    const lak = await inloggad('lak-kard');
    expect((await lak.get('/api/grupptraffar')).status).toBe(403);
  });

  test(TESTER_R8.gruppVantelista, async () => {
    const k = await sussa();
    const d = db(k);
    const tid = d.query("SELECT * FROM tider WHERE schema_id = 'sch-kard-jenny' AND tidstyp = 'grupp'").get();
    d.query('UPDATE tider SET platser = 2 WHERE id = ?').run(tid.id);
    for (const pid of ['sus10', 'sus08']) expect((await k.post(`/api/tid/${tid.id}/grupp`, { patientId: pid })).status).toBe(201);
    const full = await k.post(`/api/tid/${tid.id}/grupp`, { patientId: 'sus09' });
    expect(full.data).toMatchObject({ vantar: true, plats: 1 });
    expect((await k.post(`/api/tid/${tid.id}/grupp`, { patientId: 'sus12' })).data).toMatchObject({ vantar: true, plats: 2 });
    let g = (await k.get('/api/grupptraffar')).data.grupper.find(x => x.tid.id === tid.id);
    expect(g).toMatchObject({ kvar: 0, full: true, forslag: null });
    expect(g.vantar.map(v => v.id)).toEqual(['sus09', 'sus12']);
    // En avbokning ger en ledig plats, och systemet föreslår den som har väntat längst.
    const bid = d.query("SELECT id FROM bokningar WHERE tid_id = ? AND patient_id = 'sus10'").get(tid.id).id;
    expect((await k.post(`/api/bokning/${bid}/avboka`, { orsak: 'Kan inte komma' })).status).toBe(200);
    g = (await k.get('/api/grupptraffar')).data.grupper.find(x => x.tid.id === tid.id);
    expect(g.forslag.text).toContain('Hanna Korlen har väntat längst');
    const r = await k.post(`/api/gruppvantelista/${g.forslag.vantelistaId}/plats`, {});
    expect(r.status).toBe(201);
    expect((await k.post(`/api/gruppvantelista/${g.forslag.vantelistaId}/plats`, {})).status).toBe(400);
    g = (await k.get('/api/grupptraffar')).data.grupper.find(x => x.tid.id === tid.id);
    expect(g).toMatchObject({ kvar: 0 });
    expect(g.vantar.map(v => v.id)).toEqual(['sus12']);
  });
});
