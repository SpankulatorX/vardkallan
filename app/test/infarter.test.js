// Runda 10, r4: in- och utfarter (Sussa 3.1.3.3 och 3.1.3.8). Katetrar, sonder och dränage registreras med typ,
// storlek, placering och tid, sköts enligt systemets plan och avvecklas, och kan följas över tid. Testnamnen står i
// src/sussa/mappning/3.1.3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, somPerson } from './hjalp.js';
import * as infarter from '../src/infarter.js';
import { KVA } from '../src/kodverk.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const IF = 'In- och utfarter > ';
const H = 3600_000;

describe('In- och utfarter', () => {
  test('typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten', async () => {
    const k = await inloggad('ssk-kard');
    const l = (await k.get('/api/patient/p01/infarter')).data;
    // Formuläret får typerna med förvald storlek och placeringar.
    const pvk = l.typer.find(t => t.id === 'pvk');
    expect(pvk).toMatchObject({ standard: '20', enhet: 'G' });
    expect(pvk.placeringar).toContain('Höger underarm');
    expect(l.kanRegistrera).toBe(true);
    // Bara typ och placering behövs. Storlek, tid, vårdkontakt och KVÅ sätts av systemet.
    const r = await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Höger underarm' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ typ: 'pvk', storlek: '20', storlekText: '20 G', placering: 'Höger underarm', aktiv: true, grupp: 'infart', gruppText: 'Infart' });
    expect(r.data.lagd.av).toBe('Johan Ek');
    expect(r.data.vardkontaktId).not.toBeNull();
    // Nästa skötsel räknas ur insättningen.
    expect(Date.parse(r.data.nastaSkotsel) - Date.parse(r.data.lagd.tid)).toBe(24 * H);
    expect(r.data.skotselText).toContain('Inspektera insticksstället');
    const at = db(k).query("SELECT * FROM atgarder WHERE patient_id = 'p01' AND kod = 'SP021'").all();
    expect(at.length).toBe(1);
    expect(at[0]).toMatchObject({ av: 'ssk-kard', vardkontakt_id: r.data.vardkontaktId });
    expect(KVA.SP021).toBe('Inläggning av perifer venkateter');
    // Satt tidigare av någon annan: ingen insättning registreras i den inloggades namn.
    const dr = await k.post('/api/patient/p01/infarter', { typ: 'dranage', storlek: '16', placering: 'Buk', lagd: new Date(Date.now() - 20 * H).toISOString() });
    expect(dr.status).toBe(201);
    expect(dr.data.lagd.av).toBeNull();
    expect(dr.data.grupp).toBe('utfart');
    // Varje typ har en giltig standardstorlek och ett intervall för skötsel.
    for (const t of Object.values(infarter.TYPER)) {
      expect(t.storlekar).toContain(t.standard);
      expect(t.skotselTimmar).toBeGreaterThan(0);
      for (const kod of [t.insattning, t.skotsel, t.byte, t.avveckling].filter(Boolean)) expect(KVA[kod]).toBeTruthy();
    }
  });

  test('skötseln står i avdelningens planering, och en försenad skötsel markeras', async () => {
    const k = await inloggad('ssk-kard');
    // Seeden: patient 1 har en venkateter och en urinkateter sedan inskrivningen.
    const l = (await k.get('/api/patient/p01/infarter')).data;
    expect(l.aktiva.map(a => a.typ).sort()).toEqual(['kad', 'pvk']);
    const p = (await k.get('/api/avdelning/planering')).data;
    const rader = p.patienter.find(x => x.patient.id === 'p01').handelser.filter(h => h.kalla === 'infart');
    expect(rader.length).toBeGreaterThanOrEqual(1);
    expect(rader.some(h => h.text.startsWith('Skötsel av kvarliggande urinkateter'))).toBe(true);
    expect(rader[0]).toMatchObject({ typText: 'Skötsel', yrkeText: 'Sjuksköterska' });
    // Med fast tid: en skötsel som skulle ha gjorts för två timmar sedan är försenad och får systemets råd.
    const d = nyDb();
    infarter.sakra(d);
    const nu = new Date('2026-03-10T12:00:00Z');
    d.query("INSERT INTO infarter (patient_id, enhet_id, typ, storlek, placering, lagd, registrerad, registrerad_av) VALUES ('p01', 'uso-kard-72', 'pvk', '18', 'Vänster handrygg', ?, ?, 'ssk-kard')")
      .run('2026-03-06T10:00:00.000Z', '2026-03-06T10:00:00.000Z');
    const rad = d.query('SELECT * FROM infarter ORDER BY id DESC LIMIT 1').get();
    const ut = infarter.infartUt(d, rad, nu);
    expect(ut.forsenad).toBe(true);
    expect(ut.dygn).toBe(4);
    expect(ut.rad.map(x => x.text).join(' ')).toContain('Skötseln är försenad');
    expect(ut.rad.map(x => x.text).join(' ')).toContain('Pröva om den behövs');
  });

  test('en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig', async () => {
    const k = await inloggad('ssk-kard');
    const r = (await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Vänster armveck', storlek: '18' })).data;
    const s = await k.post(`/api/infart/${r.id}/skotsel`, { anteckning: 'Utan rodnad.' });
    expect(s.status).toBe(200);
    expect(s.data.skotsel.at(-1)).toMatchObject({ av: 'Johan Ek', anteckning: 'Utan rodnad.' });
    expect(Date.parse(s.data.nastaSkotsel) - Date.parse(s.data.skotsel.at(-1).tid)).toBe(24 * H);
    // Byte: den gamla avvecklas med orsaken byte, och den nya pekar på den gamla.
    const b = await k.post(`/api/infart/${r.id}/byt`, { placering: 'Höger armveck' });
    expect(b.status).toBe(200);
    expect(b.data).toMatchObject({ ersatterId: r.id, storlek: '18', placering: 'Höger armveck', aktiv: true });
    const l = (await k.get('/api/patient/p01/infarter')).data;
    const gammal = l.avvecklade.find(x => x.id === r.id);
    expect(gammal).toMatchObject({ ersattAvId: b.data.id, aktiv: false });
    expect(gammal.avvecklad.orsak).toBe('Byts mot en ny');
    const a = await k.post(`/api/infart/${b.data.id}/avveckla`, { orsak: 'behovs_inte' });
    expect(a.status).toBe(200);
    expect(a.data.avvecklad).toMatchObject({ av: 'Johan Ek', orsak: 'Behövs inte längre' });
    expect((await k.post(`/api/infart/${b.data.id}/avveckla`, { orsak: 'behovs_inte' })).status).toBe(409);
    expect((await k.post(`/api/infart/${b.data.id}/skotsel`)).status).toBe(409);
    // KVÅ: insättning, skötsel, byte och avveckling.
    const koder = db(k).query("SELECT kod FROM atgarder WHERE patient_id = 'p01' AND underlag LIKE '%infart%' ORDER BY id").all().map(x => x.kod);
    expect(koder.slice(-4)).toEqual(['SP021', 'QD005', 'DP028', 'DP029']);
    // Raderna ändras och raderas inte.
    expect(() => db(k).query("UPDATE infarter SET placering = 'x' WHERE id = ?").run(r.id)).toThrow();
    expect(() => db(k).query('DELETE FROM infarter WHERE id = ?').run(r.id)).toThrow();
    expect(() => db(k).query('DELETE FROM infart_skotsel').run()).toThrow();
    expect(() => db(k).query("UPDATE infarter SET avvecklad = '2026-01-01' WHERE id = ?").run(r.id)).toThrow();
  });

  test('systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska', async () => {
    const k = await inloggad('ssk-kard');
    const andra = await k.post('/api/patient/p01/infarter', { typ: 'kad', placering: 'Uretra' });
    expect(andra.status).toBe(409);
    expect(andra.data.fel).toContain('redan en kvarliggande urinkateter');
    const fel = await k.post('/api/patient/p01/infarter', { typ: 'pvk', storlek: '19', placering: '' });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('för PVK finns 14, 16, 17, 18, 20, 22, 24 G');
    expect(fel.data.falt).toEqual(['storlek', 'placering']);
    expect((await k.post('/api/patient/p01/infarter', { typ: 'constructor', placering: 'x' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'x', lagd: new Date(Date.now() + 3 * H).toISOString() })).status).toBe(400);
  });

  test('vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum', async () => {
    const k = await inloggad('ssk-kard');
    const band = (await k.post('/api/patient/p01/armband')).data.kod;
    const annat = (await k.post('/api/patient/p04/armband')).data.kod;
    const fel = await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Höger handrygg', armband: annat });
    expect(fel.status).toBe(409);
    expect(fel.data.fel).toContain('annan patient');
    const gammal = await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Höger handrygg', armband: band, forpackning: '(01)07350000000016(17)200131(10)LOT7' });
    expect(gammal.status).toBe(409);
    expect(gammal.data.fel).toContain('gick ut 2020-01-31');
    const ok = await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Höger handrygg', armband: band, forpackning: '(01)07350000000016(17)991231(10)LOT7' });
    expect(ok.status).toBe(201);
    expect(ok.data).toMatchObject({ kalla: 'skanning', artikel: { artikel: '07350000000016', batch: 'LOT7', utgang: '2099-12-31' } });
    expect(ok.data.kallaText).toContain('skanning vid sängen');
    // Inget sparades av de stoppade försöken.
    expect(db(k).query("SELECT count(*) AS n FROM infarter WHERE placering = 'Höger handrygg'").get().n).toBe(1);
  });

  test('behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte', async () => {
    const u = await inloggad('usk-kard');
    const l = await u.get('/api/patient/p01/infarter');
    expect(l.status).toBe(200);
    expect(l.data.kanRegistrera).toBe(false);
    expect((await u.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Höger underarm' })).status).toBe(403);
    const id = l.data.aktiva[0].id;
    expect((await u.post(`/api/infart/${id}/skotsel`)).status).toBe(403);
    // Vårdadministratören läser inte omvårdnaden.
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/patient/p01/infarter')).status).toBe(403);
    // En läkare utan vårdrelation får samma svar som för en rad som inte finns.
    const psyk = await inloggad('lak-psyk');
    const nej = await psyk.post(`/api/infart/${id}/skotsel`);
    expect(nej.status).toBe(404);
    expect((await psyk.post('/api/infart/99999/skotsel')).data).toEqual(nej.data);
    // Läkaren på akuten har vårdrelation men ändrar inte en rad från en annan vårdenhet, inte ens efter aktivt val.
    const akut = await inloggad('lak-akut');
    await akut.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const akutSvar = await akut.post(`/api/infart/${id}/avveckla`, { orsak: 'behovs_inte' });
    expect(akutSvar.status).toBe(403);
    expect(akutSvar.data.fel).toContain('den vårdenhet där de registrerades');
    // Försöken loggas på patienten.
    expect(db(psyk).query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'lak-psyk' AND patient_id = 'p01' AND resultat = 'nekad'").get().n).toBeGreaterThan(0);
  });

  test('spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen', async () => {
    const k = await inloggad('ssk-kard');
    const d = db(k);
    // En sond som akutmottagningen satte, med en spärr för akutmottagningen.
    d.query("INSERT INTO infarter (patient_id, enhet_id, typ, storlek, placering, lagd, registrerad, registrerad_av) VALUES ('p01', 'uso-akut', 'sond', '14', 'HEMLIG-PLACERING', ?, ?, 'ssk-akut')")
      .run(new Date(Date.now() - 30 * H).toISOString(), new Date(Date.now() - 30 * H).toISOString());
    const fore = (await k.get('/api/patient/p01/infarter')).data;
    expect(JSON.stringify(fore)).not.toContain('HEMLIG-PLACERING');
    expect(fore.dolda.kraverVal).toBe(1);
    // En andra sond stoppas utan att svaret säger var den första finns.
    const andra = await k.post('/api/patient/p01/infarter', { typ: 'sond', placering: 'Höger näsborre' });
    expect(andra.status).toBe(409);
    expect(JSON.stringify(andra.data)).not.toMatch(/akut|HEMLIG/i);
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'uso-akut', ?, 1)").run(new Date().toISOString());
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const efter = (await k.get('/api/patient/p01/infarter')).data;
    expect(JSON.stringify(efter)).not.toContain('HEMLIG-PLACERING');
    expect(efter.dolda.kraverVal).toBe(0);
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    expect(JSON.stringify(ov.tidslinje)).not.toContain('HEMLIG-PLACERING');
    const plan = (await k.get('/api/avdelning/planering')).data;
    expect(JSON.stringify(plan)).not.toContain('HEMLIG-PLACERING');
    // Med spärren räknas den spärrade sonden inte alls, så svaret är detsamma som om den inte fanns.
    const sond = await k.post('/api/patient/p01/infarter', { typ: 'sond', placering: 'Höger näsborre' });
    expect(sond.status).toBe(201);
    expect(JSON.stringify(sond.data)).not.toMatch(/akut|HEMLIG/i);
    // Raden på den spärrade vårdenheten nås inte heller på id.
    const id = d.query("SELECT id FROM infarter WHERE placering = 'HEMLIG-PLACERING'").get().id;
    expect((await k.post(`/api/infart/${id}/skotsel`)).status).toBe(404);
    // Med patientens samtycke visas den, men ändras inte.
    await k.post('/api/patient/p01/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker' });
    expect(JSON.stringify((await k.get('/api/patient/p01/infarter')).data)).toContain('HEMLIG-PLACERING');
    expect((await k.post(`/api/infart/${id}/skotsel`)).status).toBe(403);
  });

  test('FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet', async () => {
    const k = await inloggad('ssk-kard');
    const r = (await k.post('/api/patient/p01/infarter', { typ: 'pvk', placering: 'Vänster handrygg' })).data;
    await k.post(`/api/infart/${r.id}/skotsel`);
    await k.post(`/api/infart/${r.id}/avveckla`, { orsak: 'behovs_inte' });
    const p = (await k.get('/fhir/Procedure?patient=p01')).data.entry.map(e => e.resource);
    const koder = p.map(x => x.code.coding[0].code);
    for (const kod of ['SP021', 'QD005', 'DP029']) expect(koder).toContain(kod);
    const en = p.find(x => x.code.coding[0].code === 'DP029');
    expect(en.code.coding[0]).toMatchObject({ system: 'urn:oid:1.2.752.116.1.3.2.1.4', display: 'Avlägsnande av perifer venkateter' });
    expect((await k.get(`/fhir/Procedure/${en.id}`)).status).toBe(200);
    // Vårdadministratören i samma sandlåda läser inte omvårdnaden och får inte heller åtgärden.
    somPerson(sandlada(app, k), 'adm-kard');
    expect((await k.get(`/fhir/Procedure/${en.id}`)).status).toBe(403);
    const lista = (await k.get('/fhir/Procedure?patient=p01')).data;
    expect(JSON.stringify(lista)).not.toContain('Avlägsnande av perifer venkateter');
  });

  test('tidslinjen i översikten har insättning och avveckling', async () => {
    const k = await inloggad('lak-kard');
    const r = (await k.post('/api/patient/p01/infarter', { typ: 'dranage', placering: 'Operationssår' })).data;
    await k.post(`/api/infart/${r.id}/avveckla`, { orsak: 'behovs_inte' });
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    const rader = ov.tidslinje.filter(t => t.typ === 'infart' && t.ref.id === r.id);
    expect(rader.map(t => t.rubrik).sort()).toEqual(['Avvecklad: Dränage', 'Satt: Dränage']);
    expect(rader[0].text).toBe('Behövs inte längre');
    expect(rader[1].text).toBe('12 Ch, Operationssår');
  });
});

export { IF };
