// Runda 14, r4 (Sussa 5.4.2.2): integrerad åtkomst till uppgifter som har förts över till mellanarkivet. Testnamnen står
// i src/sussa/mappning/5.4.2.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, atk, godkannGallring } from './hjalp.js';
import * as mellanarkiv from '../src/mellanarkiv.js';
import { packaUpp, zip } from '../src/zip.js';
import { slaSamman } from '../src/identitet.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const typer = (svar) => svar.handlingar.map(h => `${h.slag}:${h.typ}:${h.enhet.id}`).sort();

describe('Mellanarkiv', () => {
  test('mellanarkivet har tagit emot ett FGS-paket med äldre uppgifter ur VAS, och mottagningskontrollen är utan fel', () => {
    const d = nyDb();
    const p = d.query('SELECT * FROM mellanarkiv_paket').all();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ patient_id: 'p01', handlingar: 4, kalla: 'Migreringen från VAS (demo)' });
    expect(JSON.parse(p[0].kontroll).fel).toEqual([]);
    // Paketet följer FGS Paketstruktur som exporten till e-arkivet.
    const filer = [...packaUpp(Buffer.from(p[0].data)).keys()];
    expect(filer).toContain(`${p[0].id}/METS.xml`);
    expect(filer).toContain(`${p[0].id}/representations/rep_1/data/journal/p01.json`);
    expect(filer).toContain(`${p[0].id}/metadata/descriptive/earkiv-index.xml`);
    const h = d.query('SELECT slag, kategori, enhet_id FROM mellanarkiv_handlingar ORDER BY datum').all();
    expect(h.map(x => `${x.slag}:${x.enhet_id}`)).toEqual(['anteckning:uso-kard', 'matvarde:vc-tybble', 'anteckning:vc-tybble', 'anteckning:uso-med']);
    // Handlingarna finns inte i den aktiva journalen.
    expect(d.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p01' AND skapad < '2013-01-01'").get().n).toBe(0);
  });

  test('journalen visar handlingarna med samma behörighet: egen vårdenhet direkt och andra vårdenheter efter ett aktivt val', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.get('/api/patient/p01/mellanarkiv');
    expect(r.status).toBe(200);
    expect(typer(r.data)).toEqual(['anteckning:Mottagningsanteckning:uso-kard']);
    expect(r.data.dolda.kraverVal).toBe(3);
    expect(r.data.handlingar[0]).toMatchObject({ kallaEtikett: 'Ur mellanarkivet', forfattare: { namn: 'Läkare, VAS (migrerad)' } });
    // Huvudet erbjuder det aktiva valet, eftersom det finns uppgifter på andra vårdenheter.
    expect((await k.get('/api/patient/p01')).data.harAndraEnheter).toBe(true);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const efter = await k.get('/api/patient/p01/mellanarkiv');
    expect(typer(efter.data)).toEqual(['anteckning:Mottagningsanteckning:uso-kard', 'anteckning:Mottagningsanteckning:vc-tybble', 'anteckning:Omvårdnadsanteckning:uso-med', 'matvarde:Blodtryck:vc-tybble']);
    expect(efter.data.dolda.kraverVal).toBe(0);
    expect(efter.data.period).toBe('2010 till 2012');
    const mv = efter.data.handlingar.find(h => h.slag === 'matvarde');
    expect(mv.sammanfattning).toBe('162/96 mm[Hg]');
  });

  test('yrkesrollen styr vad som visas: inre sekretess för journal och omvårdnad som i journalen', () => {
    const d = nyDb();
    const typ = (rader) => rader.map(r => `${r.slag}:${r.kategori ?? '-'}`).sort();
    expect(typ(mellanarkiv.synliga(atk(d, 'usk-kard', 'p01', { andra_enheter: true })))).toEqual(['anteckning:omvardnad', 'matvarde:-']);
    expect(typ(mellanarkiv.synliga(atk(d, 'lak-kard', 'p01', { andra_enheter: true })))).toEqual(['anteckning:journal', 'anteckning:journal', 'anteckning:omvardnad', 'matvarde:-']);
    // Arkivarien läser aldrig journalen.
    expect(mellanarkiv.synliga(atk(d, 'ark', 'p01', { andra_enheter: true }))).toEqual([]);
  });

  test('en spärrad vårdenhet syns inte, svaret är detsamma med och utan den dolda handlingen, och med samtycke syns den', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    db(k).query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'vc-tybble', ?, 1)").run(new Date().toISOString());
    const med = await k.get('/api/patient/p01/mellanarkiv');
    expect(typer(med.data)).toEqual(['anteckning:Mottagningsanteckning:uso-kard', 'anteckning:Omvårdnadsanteckning:uso-med']);
    expect(JSON.stringify(med.data)).not.toContain('vc-tybble');
    expect(JSON.stringify(med.data)).not.toContain('Tybble');
    // Samma sandlåda utan de spärrade handlingarna ger exakt samma svar.
    const k2 = await inloggad('lak-kard');
    await k2.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const d2 = db(k2);
    d2.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'vc-tybble', ?, 1)").run(new Date().toISOString());
    d2.exec('DROP TRIGGER mellanarkiv_handlingar_raderas_ej');
    d2.query("DELETE FROM mellanarkiv_handlingar WHERE enhet_id = 'vc-tybble'").run();
    expect(JSON.stringify((await k2.get('/api/patient/p01/mellanarkiv')).data)).toBe(JSON.stringify(med.data));
    // Tidslinjen och sökningen nämner inte heller den spärrade vårdenheten.
    const ov = await k.get('/api/patient/p01/oversikt');
    expect(ov.data.tidslinje.filter(t => t.typ === 'mellanarkiv').map(t => t.enhet.id).sort()).toEqual(['uso-kard', 'uso-med']);
    expect((await k.get('/api/patient/p01/sok?q=hypertoni')).data.traffar.filter(t => t.typ === 'mellanarkiv')).toEqual([]);
    // En handling på den spärrade vårdenheten hämtad på id är som en som inte finns.
    const id = db(k).query("SELECT id FROM mellanarkiv_handlingar WHERE enhet_id = 'vc-tybble' AND slag = 'anteckning'").get().id;
    const dold = await k.get(`/api/mellanarkiv/${id}`);
    const saknas = await k.get('/api/mellanarkiv/999999');
    expect([dold.status, dold.data.fel]).toEqual([saknas.status, saknas.data.fel]);
    // Med patientens samtycke nu syns den.
    await k.post('/api/patient/p01/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect(typer((await k.get('/api/patient/p01/mellanarkiv')).data)).toContain('anteckning:Mottagningsanteckning:vc-tybble');
    expect((await k.get(`/api/mellanarkiv/${id}`)).status).toBe(200);
  });

  test('utan vårdrelation är en handling som en som inte finns, och det nekade försöket loggas', async () => {
    const k = await inloggad('lak-vc');
    const d = db(k);
    const id = d.query("SELECT id FROM mellanarkiv_handlingar WHERE enhet_id = 'uso-kard'").get().id;
    // Läkaren på vårdcentralen har ingen vårdrelation till en patient som testet lägger in i mellanarkivet.
    d.exec('DROP TRIGGER mellanarkiv_handlingar_andras_ej');
    d.query("UPDATE mellanarkiv_handlingar SET patient_id = 'p20' WHERE id = ?").run(id);
    const r = await k.get(`/api/mellanarkiv/${id}`);
    expect(r.status).toBe(404);
    expect(r.data.fel).toBe('Uppgiften finns inte.');
    expect(d.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p20' AND resultat = 'nekad'").get().n).toBeGreaterThan(0);
  });

  test('varje läsning loggas med handlingens id, innehållet är kontrollerat oförändrat, och handlingarna går inte att ändra eller radera', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const id = d.query("SELECT id FROM mellanarkiv_handlingar WHERE enhet_id = 'uso-kard'").get().id;
    const r = await k.get(`/api/mellanarkiv/${id}`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ slag: 'anteckning', typ: 'Mottagningsanteckning', mellanarkiv: { oforandrad: true, mottagare: mellanarkiv.MOTTAGARE } });
    expect(r.data.sokord.map(s => s.sokord)).toEqual(['Kontaktorsak', 'Status', 'Bedömning', 'Planering']);
    const rad = d.query("SELECT * FROM atkomstlogg WHERE resurs = ? AND patient_id = 'p01'").get(`mellanarkiv:${id}`);
    expect(rad).toMatchObject({ personal_id: 'lak-kard', handling: 'las_journal', resultat: 'tillaten' });
    expect(() => d.query("UPDATE mellanarkiv_handlingar SET text = 'ändrad' WHERE id = ?").run(id)).toThrow(/ändras inte/);
    expect(() => d.query('DELETE FROM mellanarkiv_handlingar WHERE id = ?').run(id)).toThrow(/raderas inte/);
    expect(() => d.query("UPDATE mellanarkiv_paket SET kalla = 'x'").run()).toThrow(/ändras inte/);
    expect(() => d.query('DELETE FROM mellanarkiv_paket').run()).toThrow(/raderas inte/);
  });

  test('arkivarien registrerar ett beslut, systemet tar fram underlaget och för över äldre handlingar, som sedan visas i journalen som förut', async () => {
    const k = await inloggad('ark');
    const d = db(k);
    const fore = d.query("SELECT * FROM anteckningar WHERE patient_id = 'p01' AND typ = 'Epikris' AND skapad < '2015-01-01'").get();
    expect(fore).toBeTruthy();
    const typerSvar = await k.get('/api/arkiv/typer');
    expect(typerSvar.data.typer.mellanarkiv.text).toBe('Överföring till mellanarkiv');
    const b = await k.post('/api/arkiv/beslut', { typ: 'mellanarkiv', diarienummer: 'RS 2026-501' });
    expect(b.status).toBe(201);
    expect(b.data).toMatchObject({ typ: 'mellanarkiv', omfattning: { urval: 'mellanarkiv', ar: 5 } });
    const u = await k.get(`/api/arkiv/beslut/${b.data.id}/underlag`);
    expect(u.status).toBe(200);
    const p01 = u.data.patienter.find(p => p.id === 'p01');
    expect(p01.anteckningar).toBeGreaterThan(0);
    // Underlaget visar inget innehåll.
    expect(JSON.stringify(u.data)).not.toContain('förmaksflimmer');
    // En gallring verkställs inte med samma knapp, och en annan roll får inte föra över.
    expect((await k.post(`/api/arkiv/beslut/${b.data.id}/verkstall`, {})).status).toBe(400);
    const lak = await inloggad('lak-kard');
    expect((await lak.post(`/api/arkiv/beslut/${b.data.id}/overfor`, {})).status).toBe(403);
    const o = await k.post(`/api/arkiv/beslut/${b.data.id}/overfor`, {});
    expect(o.status).toBe(200);
    expect(o.data.verkstallt).toBeTruthy();
    expect(o.data.resultat.anteckningar).toBeGreaterThan(0);
    expect(d.query('SELECT 1 FROM anteckningar WHERE id = ?').get(fore.id)).toBeNull();
    const logg = d.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p01' AND handling = 'arkivera' AND resurs LIKE ?").get(`beslut:${b.data.id}:mellanarkiv:%`);
    expect(logg.syfte).toContain('Överföring till mellanarkivet enligt RS 2026-501');
    // Beslutet verkställs en gång.
    expect((await k.post(`/api/arkiv/beslut/${b.data.id}/overfor`, {})).status).toBe(409);
    // Läkaren hittar epikrisen i journalen, med samma innehåll och samma författare, utan att veta om mellanarkivet.
    sandlada(app, lak).db = d;
    await lak.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const lista = await lak.get('/api/patient/p01/mellanarkiv');
    const epikris = lista.data.handlingar.find(h => h.typ === 'Epikris');
    expect(epikris).toBeTruthy();
    const las = await lak.get(`/api/mellanarkiv/${epikris.id}`);
    expect(las.data.sokord).toEqual(JSON.parse(fore.sokord));
    expect(las.data.datum).toBe(fore.signerad_tid);
    expect(las.data.mellanarkiv.oforandrad).toBe(true);
  }, 30_000);

  test('mellanarkivet avvisar ett paket med fel, och då förs ingenting över', () => {
    const d = nyDb();
    const valda = mellanarkiv.kandidater(d, '2016-01-01').get('p01');
    const { paket } = mellanarkiv.paketFor(d, 'p01', valda);
    // En byte i journalfilen ändras på vägen, så att kontrollsumman inte stämmer.
    const filer = packaUpp(paket);
    const namn = [...filer.keys()].find(n => n.endsWith('/journal/p01.json'));
    const andrad = zip([...filer].map(([n, f]) => ({ namn: n, data: n === namn ? Buffer.from(f.data.toString('utf8').replace('Epikris', 'Epikriz')) : f.data })));
    const fore = d.query('SELECT count(*) AS n FROM mellanarkiv_handlingar').get().n;
    expect(() => mellanarkiv.taEmot(d, andrad, { kalla: 'test' })).toThrow(/tog inte emot paketet.*SHA-256/);
    expect(d.query('SELECT count(*) AS n FROM mellanarkiv_handlingar').get().n).toBe(fore);
    // Det oförändrade paketet tas emot.
    expect(mellanarkiv.taEmot(d, paket, { kalla: 'test' }).handlingar).toBe(valda.anteckningar.length + valda.matvarden.length);
  });

  test('tidslinjen och sökningen i journalen tar med handlingarna, märkta Ur mellanarkivet', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const ov = await k.get('/api/patient/p01/oversikt');
    const t = ov.data.tidslinje.filter(x => x.typ === 'mellanarkiv');
    expect(t).toHaveLength(4);
    expect(t.every(x => x.kallaEtikett === 'Ur mellanarkivet' && x.ref.typ === 'mellanarkiv')).toBe(true);
    const s = await k.get('/api/patient/p01/sok?q=hypertoni');
    const traff = s.data.traffar.find(x => x.typ === 'mellanarkiv');
    expect(traff).toMatchObject({ kallaEtikett: 'Ur mellanarkivet', vardenhet: { id: 'vc-tybble' } });
    expect(traff.ref.sub).toMatch(/^ma-\d+$/);
  });

  test('handlingarna följer journalen vid en sammanslagning och raderas med hela journalen efter ett beslut om förstöring', async () => {
    const d = nyDb();
    const pers = d.query("SELECT * FROM personal WHERE id = 'adm-kard'").get() ?? d.query("SELECT * FROM personal WHERE yrke = 'vardadministrator' LIMIT 1").get();
    slaSamman(d, { fran: 'p01', till: 'p02', personal: pers, grund: 'Test' });
    expect(d.query("SELECT count(*) AS n FROM mellanarkiv_handlingar WHERE patient_id = 'p02'").get().n).toBe(4);
    expect(d.query("SELECT count(*) AS n FROM mellanarkiv_paket WHERE patient_id = 'p02'").get().n).toBe(1);
    // Ett beslut om förstöring av hela journalen tar också bort det som finns i mellanarkivet.
    const k = await inloggad('ark');
    const b = await k.post('/api/arkiv/beslut', { typ: 'radering', diarienummer: 'IVO 2026-77', patientId: 'p01', omfattning: 'hela' });
    expect(b.status).toBe(201);
    await godkannGallring(app, k, b.data.id);
    expect((await k.post(`/api/arkiv/beslut/${b.data.id}/verkstall`, {})).status).toBe(200);
    expect(db(k).query("SELECT count(*) AS n FROM mellanarkiv_handlingar WHERE patient_id = 'p01'").get().n).toBe(0);
    expect(db(k).query("SELECT count(*) AS n FROM mellanarkiv_paket WHERE patient_id = 'p01'").get().n).toBe(0);
    // Triggrarna finns kvar efteråt.
    expect(db(k).query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'mellanarkiv_%'").get().n).toBe(4);
  }, 30_000);
});
