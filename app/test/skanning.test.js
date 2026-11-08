// Runda 9, r7: textfri inmatning med streckkodsläsare (Sussa 3.1.3.6). Systemet tolkar koden själv: ett armband öppnar
// patienten, en provetikett bockar av röret vid provtagning och en läkemedelsförpackning kontrolleras mot ordinationen
// vid administrering. Testnamnen står i src/sussa/mappning/3.1.3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed } from '../src/db.js';
import * as skanning from '../src/skanning.js';
import { testserver, klient } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Skanning', () => {
  test('systemet känner själv igen armband, personnummer, provetikett, iordningställd dos och läkemedelsförpackning', () => {
    const kod = skanning.nyArmbandskod();
    expect(kod).toMatch(/^VKA[2-9A-HJ-NP-Z]{11}$/);
    expect(skanning.tolka(kod.toLowerCase())).toMatchObject({ typ: 'armband', kod });
    // En kod med fel kontrolltecken är ingen armbandskod.
    const fel = kod.slice(0, -1) + (kod.endsWith('2') ? '3' : '2');
    expect(skanning.tolka(fel).typ).toBe('okand');
    expect(skanning.tolka(' 19450202-4732\r')).toMatchObject({ typ: 'identitet' });
    expect(skanning.tolka('VKP00000006')).toMatchObject({ typ: 'etikett', kod: 'VKP00000006' });
    expect(skanning.tolka('VK-ADM-000012-P01')).toMatchObject({ typ: 'dos', administreringId: 12, patient: 'p01' });
    // GS1 med tillämpningsidentifierare i klartext och som läsaren skickar dem, med gruppseparator.
    expect(skanning.tolka('(01)10010101105761(17)271231(10)AB12')).toMatchObject({ typ: 'forpackning', gtin: '10010101105761', utgang: '2027-12-31', batch: 'AB12' });
    expect(skanning.tolka(']d201100101011057611727120010AB12\u001d21XYZ')).toMatchObject({ typ: 'forpackning', gtin: '10010101105761', utgang: '2027-12-31', batch: 'AB12', serienummer: 'XYZ' });
    expect(skanning.tolka('10010101105761')).toMatchObject({ typ: 'forpackning', gtin: '10010101105761', batch: null });
    const okand = skanning.tolka('hej hej');
    expect(okand.typ).toBe('okand');
    expect(okand.text).toContain('känner inte igen');
  });

  test('armbandet öppnar patienten, och i en öppen journal kontrollerar systemet att armbandet hör till patienten', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const band = await k.post('/api/patient/p01/armband');
    expect(band.status).toBe(200);
    expect(band.data.kod).toMatch(/^VKA[2-9A-HJ-NP-Z]{11}$/);
    expect(band.data.svg).toContain('<svg');
    // Samma armband när det skrivs ut igen.
    expect((await k.post('/api/patient/p01/armband')).data.kod).toBe(band.data.kod);
    const oppna = await k.post('/api/skanna', { kod: band.data.kod });
    expect(oppna.data).toMatchObject({ typ: 'patient', kalla: 'armband', patient: { id: 'p01' }, oppna: '#/patient/p01' });
    const samma = await k.post('/api/skanna', { kod: band.data.kod, patientId: 'p01' });
    expect(samma.data).toMatchObject({ typ: 'patient', sammaPatient: true });
    const annan = await k.post('/api/skanna', { kod: band.data.kod, patientId: 'p04' });
    expect(annan.data).toMatchObject({ typ: 'patient', sammaPatient: false });
    expect(annan.data.varning).toContain('annan patient');
    // Ett personnummer från ett armband utan Vårdkällans kod tolkas som identitet.
    const pnr = await k.post('/api/skanna', { kod: '194502024732', patientId: 'p01' });
    expect(pnr.data).toMatchObject({ typ: 'patient', kalla: 'identitet', sammaPatient: true });
    // Varje skanning sparas för spårbarheten, utan personnumret.
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    const rader = db.query('SELECT * FROM skanningar ORDER BY id').all();
    expect(rader.length).toBe(4);
    expect(JSON.stringify(rader)).not.toContain('194502024732');
    expect(rader[0]).toMatchObject({ kodtyp: 'armband', patient_id: 'p01', personal_id: 'ssk-kard', resultat: 'oppna' });
  });

  test('provetiketten bockar av röret vid provtagningen, och en etikett för en annan patient stoppas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    // Ett rör som inte är taget, i en beställning som gäller, för en patient på avdelning 72.
    const { etikett, patient_id: pid } = db.query(`SELECT p.etikett, p.patient_id FROM labb_prov p JOIN labb_bestallningar b ON b.id = p.bestallning_id
      WHERE p.provtagen_tid IS NULL AND p.borttagen = 0 AND b.makulerad_tid IS NULL AND p.enhet_id = 'uso-kard' ORDER BY p.id LIMIT 1`).get();
    const annanPatient = pid === 'p01' ? 'p17' : 'p01';
    const fel = await k.post('/api/skanna', { kod: etikett, patientId: annanPatient, sammanhang: 'provtagning' });
    expect(fel.status).toBe(409);
    expect(fel.data.fel).toContain('annan patient');
    // Inget om den andra patienten står i svaret.
    const p = db.query('SELECT fornamn FROM patienter WHERE id = ?').get(pid);
    expect(JSON.stringify(fel.data)).not.toContain(p.fornamn);
    expect(JSON.stringify(fel.data)).not.toContain(`"${pid}"`);
    const tagen = await k.post('/api/skanna', { kod: etikett, patientId: pid, sammanhang: 'provtagning' });
    expect(tagen.status).toBe(200);
    expect(tagen.data).toMatchObject({ typ: 'etikett', tagen: true, etikett });
    expect(db.query('SELECT provtagen_av FROM labb_prov WHERE etikett = ?').get(etikett).provtagen_av).toBe('ssk-kard');
    // Samma rör en gång till förklaras.
    const igen = await k.post('/api/skanna', { kod: etikett, patientId: pid, sammanhang: 'provtagning' });
    expect(igen.status).toBe(409);
    expect(igen.data.fel).toContain('redan taget');
  });

  test('läkemedelsförpackningen kontrolleras mot patientens ordinationer, utgångsdatum och batch', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    const o = db.query("SELECT o.id, o.lakemedel_id, f.nplpackid FROM ordinationer o JOIN forpackningar f ON f.lakemedel_id = o.lakemedel_id WHERE o.patient_id = 'p01' AND o.status = 'aktiv' LIMIT 1").get();
    expect(o).toBeTruthy();
    const ok = await k.post('/api/skanna', { kod: `(01)${o.nplpackid}(17)301231(10)L4711`, patientId: 'p01', sammanhang: 'administrering' });
    expect(ok.status).toBe(200);
    expect(ok.data).toMatchObject({ typ: 'forpackning', batch: 'L4711', utgang: '2030-12-31', varningar: [] });
    expect(ok.data.ordinationer.map(x => x.id)).toContain(o.id);
    const gammal = await k.post('/api/skanna', { kod: `(01)${o.nplpackid}(17)200101(10)L1`, patientId: 'p01', sammanhang: 'administrering' });
    expect(gammal.data.varningar.map(v => v.regel)).toContain('utgangen');
    // En förpackning av ett läkemedel som patienten inte har ordinerat.
    const annan = db.query('SELECT nplpackid FROM forpackningar WHERE lakemedel_id NOT IN (SELECT lakemedel_id FROM ordinationer WHERE patient_id = ?) LIMIT 1').get('p01');
    const ej = await k.post('/api/skanna', { kod: annan.nplpackid, patientId: 'p01', sammanhang: 'administrering' });
    expect(ej.data.varningar.map(v => v.regel)).toContain('ej_ordinerad');
    expect(ej.data.varningar[0].text).toContain('inte ordinerat');
    expect(db.query("SELECT batch FROM skanningar WHERE kodtyp = 'forpackning' ORDER BY id LIMIT 1").get().batch).toBe('L4711');
  });

  test('skanningen ger aldrig mer än behörigheten: utan vårdrelation och utan rätt roll nekas den', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    // Läkaren på vårdcentralen har ingen vårdrelation till patienten på avdelning 72 och kan inte ta röret.
    const prov = await k.post('/api/skanna', { kod: 'VKP00000006', patientId: 'p01', sammanhang: 'provtagning' });
    expect(prov.status).toBe(403);
    const u = klient(app);
    await u.logga('uppf');
    expect((await u.post('/api/skanna', { kod: skanning.nyArmbandskod() })).status).toBe(403);
    // En okänd kod förklaras på vanlig svenska.
    const okand = await k.post('/api/skanna', { kod: 'XYZ-123' });
    expect(okand.status).toBe(400);
    expect(okand.data.fel).toContain('känner inte igen');
  });

  test('armbandskoden är slumpmässig, och utan åtkomst till patienten är svaret detsamma som för en kod som inte finns', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    const koder = db.query('SELECT kod FROM armband ORDER BY id').all().map(r => r.kod);
    expect(koder.length).toBeGreaterThan(1);
    for (const kod of koder) expect(skanning.tolka(kod).typ).toBe('armband');
    // Koderna följer inte varandra.
    expect(koder.some(kod => /VKA0000000/.test(kod))).toBe(false);
    // Läkaren på vårdcentralen har ingen vårdrelation till patienten på hjärtintensiven.
    const hia = db.query("SELECT kod FROM armband WHERE patient_id = 'p22'").get().kod;
    const v = klient(app);
    await v.logga('lak-vc');
    const nekad = await v.post('/api/skanna', { kod: hia });
    const saknas = await v.post('/api/skanna', { kod: skanning.nyArmbandskod() });
    expect(nekad.status).toBe(404);
    expect(JSON.stringify(nekad.data)).toBe(JSON.stringify(saknas.data));
    expect(JSON.stringify(nekad.data)).not.toMatch(/Emil|p22|199604062399/);
  });

  test('misslyckade uppslag har ett tak per session', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    let sista = null;
    for (let i = 0; i < skanning.MAX_MISSAR + 1; i++) sista = await k.post('/api/skanna', { kod: skanning.nyArmbandskod() });
    expect(sista.status).toBe(429);
    expect(sista.data.fel).toContain('För många');
  });

  test('seeden har armband för de inskrivna patienterna', () => {
    const db = byggSeed(new Date('2026-11-08T10:00:00Z'));
    skanning.sakra(db);
    const p = db.query("SELECT DISTINCT patient_id FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL").all().map(r => r.patient_id);
    const band = db.query('SELECT patient_id FROM armband').all().map(r => r.patient_id);
    for (const id of p) expect(band).toContain(id);
  });
});
