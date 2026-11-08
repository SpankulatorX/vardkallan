// Ordination av kontroller och mätvärden till avdelningen och de planerade uppgifterna per vårdenhet och dag (runda 8,
// r1, Sussas testfall 3.5). Logiken prövas på en sandlåda byggd vid en fast tidpunkt med fasta tider.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, lokalTid, addDagar, datumAv } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as kontroller from '../src/kontroller.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { INGA_3_5 } from '../src/seed/sussa-testdata.js';
import { testserver, klient, sandlada } from './hjalp.js';

const BAS = new Date('2026-11-08T09:00:00Z');
const IMORGON = addDagar(datumAv(BAS), 1);
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const atk = (db, roll, pid, val = {}, handling = 'ordinera_kontroll') => new Atkomst(db, pers(db, roll), pid, val, handling);
const sussa = () => { const db = byggSeed(BAS); laddaTestdata(db, pers(db, 'lak-kard'), { nu: BAS }); return db; };
const mv = (db, pid, enhet, typ, varde, tid, av = 'ssk-kard') => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(pid, enhet, typ, String(varde), typeof varde === 'number' ? varde : null, tid, av);

describe('Kontroller till avdelningen', () => {
  test('läkaren ordinerar puls, blodtryck, SR, temperatur, vikt och vätskebalans till i morgon klockan 7, och systemet lägger dem på avdelningen där patienten ligger', () => {
    const db = sussa();
    const f = kontroller.forPatient(atk(db, 'lak-kard', 'sus14', {}, 'las_prover'), BAS).forslag;
    expect(f.start).toBe(lokalTid(IMORGON, '07:00'));
    expect(f.enhet.id).toBe('uso-kard-72');
    const r = kontroller.ordinera(atk(db, 'lak-kard', 'sus14'), { kontroller: INGA_3_5.kontroller }, BAS);
    expect(r.kontroller.map(k => k.namn)).toEqual(['Puls', 'Blodtryck', 'SR', 'Temperatur', 'Vikt', 'Vätskebalans']);
    expect(r.kontroller.every(k => k.start === lokalTid(IMORGON, '07:00') && k.enhet.id === 'uso-kard-72')).toBe(true);
    expect(r.kontroller.find(k => k.kontroll === 'vatskebalans')).toMatchObject({ frekvens: 'dygnet', slut: lokalTid(addDagar(IMORGON, 1), '07:00') });
    expect(r.kontroller.find(k => k.kontroll === 'sr')).toMatchObject({ intern: true, matvarde: 'sr' });
    expect(r.text).toContain('i morgon kl. 07:00 på Avdelning 72');
    expect(db.query('SELECT count(DISTINCT vardkontakt_id) AS n FROM kontrollordinationer WHERE patient_id = ?').get('sus14').n).toBe(1);
    // Läkaren i öppenvården ordinerar till vårdcentralen, där patienten har sitt besök.
    const vc = kontroller.ordinera(atk(db, 'lak-vc', 'sus14'), { kontroller: ['blodtryck'] }, BAS);
    expect(vc.kontroller[0].enhet.id).toBe('vc-tybble');
  });

  test('kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer', () => {
    const db = sussa();
    kontroller.ordinera(atk(db, 'lak-kard', 'sus14'), { kontroller: ['puls', 'blodtryck', 'vatskebalans'] }, BAS);
    const plan = (nu) => kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), { datum: IMORGON }, nu);
    const fore = plan(BAS).uppgifter.filter(u => u.patient.id === 'sus14');
    expect(fore.map(u => u.rubrik)).toEqual(['Puls', 'Blodtryck', 'Följ vätskebalansen']);
    expect(fore.every(u => u.status === 'planerad' && u.tid === lokalTid(IMORGON, '07:00'))).toBe(true);
    mv(db, 'sus14', 'uso-kard-72', 'blodtryck', '128/82', lokalTid(IMORGON, '07:10'));
    const sen = new Date(Date.parse(lokalTid(IMORGON, '09:00')));
    const efter = plan(sen).uppgifter.filter(u => u.patient.id === 'sus14');
    expect(efter.find(u => u.rubrik === 'Blodtryck')).toMatchObject({ status: 'utford', utford: { varde: '128/82', av: 'Johan Ek' } });
    expect(efter.find(u => u.rubrik === 'Puls').status).toBe('forsenad');
    expect(efter.find(u => u.rubrik === 'Följ vätskebalansen').status).toBe('pagar');
    // Ett värde på en annan vårdenhet bockar inte av avdelningens kontroll.
    mv(db, 'sus14', 'vc-tybble', 'puls', 72, lokalTid(IMORGON, '07:05'), 'lak-vc');
    expect(plan(sen).uppgifter.find(u => u.patient.id === 'sus14' && u.rubrik === 'Puls').status).toBe('forsenad');
  });

  test('frekvenserna: en gång, var fjärde timme, morgon och kväll och före måltid ger rätt tider', () => {
    const k = (frekvens, start, slut = null) => ({ frekvens, start, slut, avslutad_tid: null });
    const dag = '2026-11-09';
    const fran = lokalTid(dag, '00:00'), till = lokalTid(addDagar(dag, 1), '00:00');
    const kl = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
    expect(kontroller.tiderFor(k('en_gang', lokalTid(dag, '07:00')), fran, till).map(kl)).toEqual(['07:00']);
    expect(kontroller.tiderFor(k('var_4', lokalTid(dag, '06:00'), lokalTid(addDagar(dag, 2), '06:00')), fran, till).map(kl)).toEqual(['06:00', '10:00', '14:00', '18:00', '22:00']);
    expect(kontroller.tiderFor(k('morgon_kvall', lokalTid(dag, '07:00'), lokalTid(addDagar(dag, 1), '07:00')), fran, till).map(kl)).toEqual(['07:00', '19:00']);
    expect(kontroller.tiderFor(k('fore_maltid', lokalTid(dag, '07:00'), lokalTid(addDagar(dag, 1), '07:00')), fran, till).map(kl)).toEqual(['07:30', '11:30', '16:30']);
    // En avslutad kontroll har inga tider efter avslutet.
    expect(kontroller.tiderFor({ ...k('var_4', lokalTid(dag, '06:00'), lokalTid(addDagar(dag, 2), '06:00')), avslutad_tid: lokalTid(dag, '12:00') }, fran, till).map(kl)).toEqual(['06:00', '10:00']);
  });

  test('de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se', () => {
    const db = byggSeed(BAS);
    const ut = kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), { enhetId: 'uso-kard-72', datum: datumAv(BAS) }, BAS);
    expect(Object.keys(ut).sort()).toEqual(['datum', 'demoregel', 'enhet', 'patientIdn', 'uppgifter']);
    const u = ut.uppgifter.find(x => x.typ === 'kontroll');
    expect(Object.keys(u).sort()).toEqual(['enhet', 'href', 'id', 'kalla', 'kontrollId', 'matvarde', 'patient', 'plats', 'rubrik', 'slut', 'status', 'statusText', 'text', 'tid', 'typ', 'utford', 'yrkesroll'].sort());
    const p = ut.uppgifter.find(x => x.typ === 'provtagning' && x.status !== 'utford');
    expect(p).toMatchObject({ kalla: 'labb', patient: { id: 'p04' }, href: '#/patient/p04/prover' });
    expect(p.rubrik).toContain('B-Blodstatus');
    expect(ut.uppgifter.find(x => x.typ === 'provtagning' && x.status === 'utford').utford.av).toBe('Johan Ek');
    // Vårdenheten i stället för avdelningen ger samma uppgifter, och en annan vårdenhet nekas.
    expect(kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), { enhetId: 'uso-kard', datum: datumAv(BAS) }, BAS).uppgifter.length).toBeGreaterThanOrEqual(ut.uppgifter.length);
    expect(() => kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), { enhetId: 'vc-tybble' }, BAS)).toThrow(/egen vårdenhet/);
    expect(() => kontroller.planerat(db, pers(db, 'fys-kard'), () => ({}), {}, BAS)).toThrow();
    // En patient med skyddade personuppgifter visas som skyddad identitet.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p03', 'uso-kard-72', 'slutenvard', ?, 'Avd 72, sal 1', 'Hjärtklappning')").run(new Date(BAS.getTime() - 3600_000).toISOString());
    kontroller.ordinera(atk(db, 'lak-kard', 'p03'), { kontroller: ['temp'], start: lokalTid(datumAv(BAS), '14:00') }, BAS);
    const skyddad = kontroller.planerat(db, pers(db, 'ssk-kard'), () => ({}), {}, BAS).uppgifter.find(x => x.patient.id === 'p03');
    expect(skyddad.patient.namn).toBe('Skyddad identitet');
    expect(JSON.stringify(skyddad)).not.toContain(db.query("SELECT efternamn FROM patienter WHERE id = 'p03'").get().efternamn);
  });

  test('en kontroll ordineras bara av läkaren, inte bakåt i tiden, och avslutas av en läkare på vårdenheten', () => {
    const db = byggSeed(BAS);
    expect(() => kontroller.ordinera(atk(db, 'ssk-kard', 'p04'), { kontroller: ['puls'] }, BAS)).toThrow();
    expect(() => kontroller.ordinera(atk(db, 'lak-kard', 'p04'), { kontroller: ['puls'], start: new Date(BAS.getTime() - 5 * 3600_000).toISOString() }, BAS)).toThrow(/bakåt i tiden/);
    expect(() => kontroller.ordinera(atk(db, 'lak-kard', 'p04'), { kontroller: [] }, BAS)).toThrow(/minst en kontroll/);
    expect(() => kontroller.ordinera(atk(db, 'lak-kard', 'p04'), { kontroller: ['puls'], frekvens: 'var_4', dygn: 30 }, BAS)).toThrow(/1 till 14 dygn/);
    const k = kontroller.ordinera(atk(db, 'lak-kard', 'p04'), { kontroller: ['glukos'], frekvens: 'fore_maltid', dygn: 3 }, BAS).kontroller[0];
    expect(k.frekvensText).toBe('Före måltid');
    expect(() => kontroller.avsluta(atk(db, 'lak-vc', 'p04'), kontroller.kontrollRad(db, k.id), {}, BAS)).toThrow();
    expect(kontroller.avsluta(atk(db, 'lak-kard', 'p04'), kontroller.kontrollRad(db, k.id), { orsak: 'Stabila värden' }, BAS).kontroll.aktiv).toBe(false);
  });
});

describe('API för kontroller och planerade uppgifter', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('läkaren ordinerar kontroller och sjuksköterskan hämtar avdelningens planerade uppgifter, och varje patient loggas', async () => {
    const lak = klient(app);
    await lak.logga('lak-kard');
    const r = await lak.post('/api/patient/p01/kontroller', { kontroller: ['temp', 'saturation'] });
    expect(r.status).toBe(201);
    expect(r.data.kontroller.length).toBe(2);
    expect((await lak.get('/api/patient/p01/kontroller')).data.kontroller.length).toBeGreaterThanOrEqual(2);
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    const p = await ssk.get(`/api/planerat?enhet=uso-kard-72&datum=${datumAv(new Date())}`);
    expect(p.status).toBe(200);
    expect(p.data.patientIdn).toBeUndefined();
    expect(p.data.uppgifter.some(u => u.patient.id === 'p04' && u.typ === 'kontroll')).toBe(true);
    const db = sandlada(app, ssk).db;
    expect(db.query("SELECT 1 FROM atkomstlogg WHERE personal_id = 'ssk-kard' AND patient_id = 'p04' AND resurs LIKE 'planerat:uso-kard-72:%'").get()).toBeTruthy();
    expect((await ssk.post('/api/patient/p01/kontroller', { kontroller: ['temp'] })).status).toBe(403);
    expect((await ssk.get('/api/planerat?enhet=vc-tybble')).status).toBe(403);
  });
});
