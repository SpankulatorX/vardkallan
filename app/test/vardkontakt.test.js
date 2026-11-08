import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { nyDb } from './hjalp.js';
import { testserver, klient, sandlada } from './hjalp.js';
import { lasSandlada, idag, addDagar } from '../src/db.js';
import { avgiftFor, AVGIFT_DEMO } from '../src/vardkontakt.js';
import { harVardrelation } from '../src/atkomst.js';
import * as fhir from '../src/fhir.js';

// Vårdkontakt och vårdtillfälle som bärande struktur (Sussa 6.1.1, 3.4.4 och 3.1.7). Systemet är experten: den som
// dokumenterar väljer aldrig en vårdkontakt, och ett vårdtillfälle följer med vid flytt utan att något registreras om.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const SOK = [{ sokord: 'Aktuellt', text: 'Mår bättre.' }, { sokord: 'Bedömning', text: 'Stabil.' }];
const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const kontakt = (k, id) => db(k).query('SELECT * FROM vardkontakter WHERE id = ?').get(id);
const kontakter = (k, pid) => db(k).query('SELECT * FROM vardkontakter WHERE patient_id = ? ORDER BY id').all(pid);
const radVk = (k, tabell, id) => db(k).query(`SELECT vardkontakt_id FROM ${tabell} WHERE id = ?`).get(id).vardkontakt_id;
const inl = (d, pid, enhet) => d.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id = ? AND typ = 'slutenvard' AND slut IS NULL").get(pid, enhet);
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const imorgon = () => addDagar(idag(), 1);

describe('Vårdkontakt', () => {
  test('all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient', () => {
    const d = nyDb();
    for (const t of ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'remisser']) {
      const utan = d.query(`SELECT count(*) AS n FROM ${t} WHERE vardkontakt_id IS NULL`).get().n;
      expect({ tabell: t, utan }).toEqual({ tabell: t, utan: 0 });
      const fel = d.query(`SELECT count(*) AS n FROM ${t} x JOIN vardkontakter v ON v.id = x.vardkontakt_id WHERE v.patient_id <> x.patient_id`).get().n;
      expect({ tabell: t, fel }).toEqual({ tabell: t, fel: 0 });
    }
    // En slutenvårdskontakt hör alltid till ett vårdtillfälle.
    expect(d.query("SELECT count(*) AS n FROM vardkontakter WHERE typ = 'slutenvard' AND vardtillfalle_id IS NULL").get().n).toBe(0);
  });

  test('migrerad historik får vårdkontakter med samma källa, märkta som skapade av systemet', () => {
    const d = nyDb();
    for (const t of ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'remisser']) {
      const blandade = d.query(`SELECT count(*) AS n FROM ${t} x JOIN vardkontakter v ON v.id = x.vardkontakt_id WHERE x.kalla LIKE 'migrerad:%' AND v.kalla <> x.kalla`).get().n;
      expect({ tabell: t, blandade }).toEqual({ tabell: t, blandade: 0 });
    }
    // Remissen från Vårdcentralen Tybble 2023 fanns i Cosmic utan vårdkontakt. Den får en, märkt som skapad av systemet.
    const r = d.query("SELECT * FROM remisser WHERE patient_id = 'p01' AND kalla = 'migrerad:Cosmic'").get();
    const v = d.query('SELECT * FROM vardkontakter WHERE id = ?').get(r.vardkontakt_id);
    expect(v).toMatchObject({ enhet_id: 'vc-tybble', kalla: 'migrerad:Cosmic', automatisk: 1, typ: 'oppenvard' });
    // Mottagningsbesöket på kardiologen samma vår är svaret på remissen.
    expect(d.query("SELECT remiss_id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id = 'uso-kard-mott' AND kalla = 'migrerad:Cosmic'").get().remiss_id).toBe(r.id);
  });

  test('en sandlåda från en äldre version får vårdkontakter när den läses in', () => {
    const d = nyDb();
    for (const t of ['matvarden', 'ordinationer', 'remisser']) d.exec(`ALTER TABLE ${t} DROP COLUMN vardkontakt_id`);
    d.exec('UPDATE diagnoser SET vardkontakt_id = NULL');
    d.exec('DROP TABLE vardtillfalle_handelser; DROP TABLE vardtillfallen; DROP TABLE halsoarenden; DROP TABLE halsoarende_avvisningar');
    for (const k of ['kontaktsatt', 'planerad', 'ankomst', 'vardtillfalle_id', 'halsoarende_id', 'foregaende_id', 'remiss_id', 'skapad', 'skapad_av', 'automatisk']) {
      d.exec(`ALTER TABLE vardkontakter DROP COLUMN ${k}`);
    }
    const gammal = lasSandlada(Buffer.from(d.serialize()).toString('base64'));
    for (const t of ['diagnoser', 'matvarden', 'ordinationer', 'remisser']) {
      expect({ tabell: t, utan: gammal.query(`SELECT count(*) AS n FROM ${t} WHERE vardkontakt_id IS NULL`).get().n }).toEqual({ tabell: t, utan: 0 });
    }
    expect(gammal.query("SELECT count(*) AS n FROM vardkontakter WHERE typ = 'slutenvard' AND vardtillfalle_id IS NULL").get().n).toBe(0);
  });

  test('anteckningen knyts till den pågående vårdkontakten utan att någon väljer den', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: SOK });
    expect(r.status).toBe(201);
    const pagaende = inl(db(k), 'p01', 'uso-kard-72');
    expect(radVk(k, 'anteckningar', r.data.id)).toBe(pagaende.id);
    expect(r.data.vardkontakt).toMatchObject({ id: pagaende.id, ny: false, typ: 'slutenvard' });
    // Gränssnittet får veta i förväg vilken kontakt det blir.
    const akt = (await k.get('/api/patient/p01/vardkontakt/aktuell')).data;
    expect(akt).toMatchObject({ vardkontakt: { id: pagaende.id }, ny: null });
  });

  test('finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag', async () => {
    const k = await inloggad('lak-vc');
    const fore = kontakter(k, 'p06').length;
    const akt = (await k.get('/api/patient/p06/vardkontakt/aktuell')).data;
    expect(akt.vardkontakt).toBeNull();
    expect(akt.ny).toMatchObject({ typ: 'oppenvard', kontaktsatt: 'besok', vardenhet: { id: 'vc-tybble' } });
    const m = await k.post('/api/patient/p06/matvarden', { typ: 'blodtryck', varde: '138/84' });
    expect(m.status).toBe(201);
    expect(m.data.vardkontakt).toMatchObject({ ny: true, typ: 'oppenvard', kontaktsatt: 'besok' });
    const v = kontakt(k, radVk(k, 'matvarden', m.data.id));
    expect(v).toMatchObject({ patient_id: 'p06', enhet_id: 'vc-tybble', typ: 'oppenvard', kontaktsatt: 'besok', automatisk: 1, skapad_av: 'lak-vc', kalla: 'vardkallan' });
    expect(v.skapad).toBeTruthy();
    // Samma dag på samma enhet blir det samma kontakt: ordination, remiss och anteckning.
    const o = await k.post('/api/patient/p06/lakemedel', { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel på morgonen', dos: 1, dosEnhet: 'kapsel', typ: 'staende', ordinationsorsak: 'Magskydd', uppfoljningsdatum: addDagar(idag(), 30) });
    expect(o.status).toBe(201);
    const rem = await k.post('/api/patient/p06/remisser', { tillEnhetId: 'uso-kard', fragestallning: 'Hjärtsviktsutredning?', anamnes: 'Andfåddhet.', prioritet: 'normal', svarSenast: addDagar(idag(), 30) });
    expect(rem.status).toBe(201);
    const a = await k.post('/api/patient/p06/anteckningar', { typ: 'Mottagningsanteckning', sokord: SOK });
    for (const [t, id] of [['ordinationer', o.data.ordination.id], ['remisser', rem.data.id], ['anteckningar', a.data.id]]) expect({ t, vk: radVk(k, t, id) }).toEqual({ t, vk: v.id });
    expect(kontakter(k, 'p06').length).toBe(fore + 1);
  });

  test('på akutmottagningen blir den nya kontakten en akutkontakt', async () => {
    const k = await inloggad('lak-akut');
    await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös vid ankomst' });
    const m = await k.post('/api/patient/p02/matvarden', { typ: 'puls', varde: 112 });
    expect(m.status).toBe(201);
    expect(kontakt(k, radVk(k, 'matvarden', m.data.id))).toMatchObject({ typ: 'akut', enhet_id: 'uso-akut', automatisk: 1 });
  });

  test('en remiss till enheten blir kontaktorsak och kopplas till den nya kontakten', async () => {
    const k = await inloggad('lak-kard');
    const r = await k.post('/api/patient/p05/anteckningar', { typ: 'Mottagningsanteckning', sokord: SOK });
    const v = kontakt(k, radVk(k, 'anteckningar', r.data.id));
    const remiss = db(k).query("SELECT * FROM remisser WHERE patient_id = 'p05' AND till_enhet_id = 'uso-kard'").get();
    expect(v).toMatchObject({ remiss_id: remiss.id, enhet_id: 'uso-kard-mott', typ: 'oppenvard' });
    expect(v.orsak).toContain('Misstänkt kärlkramp');
  });

  test('den som dokumenterar kan ändra kontakten som systemet skapade, men inte en annan enhets', async () => {
    const k = await inloggad('lak-vc');
    const m = await k.post('/api/patient/p09/matvarden', { typ: 'temp', varde: 38.2, nyKontakt: { kontaktsatt: 'telefon' } });
    const id = radVk(k, 'matvarden', m.data.id);
    expect(kontakt(k, id)).toMatchObject({ kontaktsatt: 'telefon', plats: 'Telefonkontakt' });
    const r = await k.raw('PATCH', `/api/vardkontakt/${id}`, { kontaktsatt: 'video', orsak: 'Feber' });
    expect(r.status).toBe(200);
    expect(kontakt(k, id)).toMatchObject({ kontaktsatt: 'video', plats: 'Videobesök', orsak: 'Feber' });
    expect((await k.raw('PATCH', `/api/vardkontakt/${id}`, { kontaktsatt: 'brevduva' })).status).toBe(400);
    const kard = await inloggad('lak-kard');
    const annan = db(kard).query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id = 'uso-akut'").get().id;
    expect((await kard.raw('PATCH', `/api/vardkontakt/${annan}`, { orsak: 'Ändrad' })).status).toBe(403);
  });

  test('vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget', async () => {
    const k = await inloggad('adm-kard');
    const ov = (await k.get('/api/patient/p05/oversikt')).data;
    expect(ov.vardstruktur.forval.registrering).toMatchObject({ kontaktsatt: 'besok', orsak: 'Enligt remiss från Vårdcentralen Kumla', enhet: { id: 'uso-kard-mott' } });
    const r = await k.post('/api/patient/p05/vardkontakter', {});
    expect(r.status).toBe(201);
    expect(kontakt(k, r.data.id)).toMatchObject({ typ: 'oppenvard', kontaktsatt: 'besok', planerad: 0, enhet_id: 'uso-kard-mott', orsak: 'Enligt remiss från Vårdcentralen Kumla', skapad_av: 'adm-kard', automatisk: 0 });
    expect(r.data.avgift).toMatchObject({ belopp: 200, demoregler: true });
    // Samma besök registreras inte två gånger.
    const igen = await k.post('/api/patient/p05/vardkontakter', {});
    expect(igen.status).toBe(400);
    expect(igen.data.fel).toContain('redan');
    expect(igen.data.finns.id).toBe(r.data.id);
    // Ingen journaltext eller frågeställning lämnas ut till vårdadministratören i orsaken.
    expect(kontakt(k, r.data.id).orsak).not.toContain('kärlkramp');
  });

  test('planerad kontakt på distans, och ankomsten registreras på den planerade', async () => {
    const k = await inloggad('adm-kard');
    const start = `${imorgon()}T08:00:00.000Z`;
    const p = await k.post('/api/patient/p11/vardkontakter', { kontaktsatt: 'video', planerad: true, start, orsak: 'Uppföljning av hjärtklappning' });
    expect(p.status).toBe(201);
    expect(kontakt(k, p.data.id)).toMatchObject({ kontaktsatt: 'video', planerad: 1, start, plats: 'Videobesök', ankomst: null });
    expect(p.data.status).toBe('planerad');
    expect((await k.post('/api/patient/p11/vardkontakter', { planerad: true, start: '2001-01-01T08:00:00.000Z', orsak: 'Gammal' })).status).toBe(400);
    // Ett planerat besök om en halvtimme: när patienten kommer registreras ankomsten på det, inte ett nytt besök.
    // Om en halvtimme, men inte efter midnatt i svensk tid: då blir besöket i stället två minuter sedan, vilket systemet
    // godtar för ett planerat besök. Testet blev rött när det kördes efter 23.30.
    const minuter = Number(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(':', '').replace(/^(\d\d)(\d\d)$/, (m, h, mi) => String(Number(h) * 60 + Number(mi))));
    const snart = new Date(Date.now() + (24 * 60 - minuter > 35 ? 30 : -2) * 60_000).toISOString();
    const b = await k.post('/api/patient/p11/vardkontakter', { planerad: true, start: snart, orsak: 'Arbetsprov' });
    const ank = await k.post('/api/patient/p11/vardkontakter', {});
    expect(ank.status).toBe(200);
    expect(ank.data).toMatchObject({ id: b.data.id, ankomstRegistrerad: true });
    expect(kontakt(k, b.data.id).ankomst).toBeTruthy();
  });

  test('kontaktorsak krävs bara när systemet inte kan föreslå den', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/patient/p01/vardkontakter', { kontaktsatt: 'telefon' });
    expect(r.status).toBe(400);
    expect(r.data.falt).toEqual(['orsak']);
    expect((await k.post('/api/patient/p01/vardkontakter', { kontaktsatt: 'telefon', orsak: 'Frågor om Waran' })).status).toBe(201);
  });

  test('yrkesrollen avgör vem som registrerar kontakter och vem som skriver in och ut', async () => {
    const usk = await inloggad('usk-kard');
    expect((await usk.post('/api/patient/p01/vardkontakter', { orsak: 'Test' })).status).toBe(403);
    const adm = await inloggad('adm-kard');
    expect((await adm.post('/api/patient/p11/vardtillfallen', { orsak: 'Test' })).status).toBe(403);
    const vt = db(adm).query("SELECT vardtillfalle_id FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL").get().vardtillfalle_id;
    expect((await adm.post(`/api/vardtillfalle/${vt}/skriv-ut`, {})).status).toBe(403);
    // Försöken loggas som nekade.
    expect(loggRader(adm).some(r => r.personal_id === 'adm-kard' && r.handling === 'vardtillfalle' && r.resultat === 'nekad')).toBe(true);
  });

  test('inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket', async () => {
    const k = await inloggad('lak-akut');
    const akut = db(k).query("SELECT * FROM vardkontakter WHERE patient_id = 'p14' AND enhet_id = 'uso-akut' AND slut IS NULL").get();
    const r = await k.post('/api/patient/p14/vardtillfallen', { enhetId: 'uso-kard-72', plats: 'Avd 72, sal 2' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ status: 'inskriven', ansvarig: { id: 'uso-kard' }, plats: 'Avd 72, sal 2', orsak: akut.orsak });
    const ny = inl(db(k), 'p14', 'uso-kard-72');
    expect(ny).toMatchObject({ vardtillfalle_id: r.data.id, foregaende_id: akut.id, skapad_av: 'lak-akut' });
    expect(kontakt(k, akut.id).slut).toBeTruthy();
    expect(r.data.handelser.map(h => h.typ)).toEqual(['inskrivning']);
    // Redan inskriven: ingen ny inskrivning.
    expect((await k.post('/api/patient/p14/vardtillfallen', { enhetId: 'uso-kard-72' })).status).toBe(400);
  });

  test('sjuksköterskan skriver in på sin egen avdelning med förval', async () => {
    const k = await inloggad('ssk-kard');
    const ov = (await k.get('/api/patient/p11/oversikt')).data;
    expect(ov.vardstruktur.forval.inskrivning).toMatchObject({ enhet: { id: 'uso-kard-72' } });
    const r = await k.post('/api/patient/p11/vardtillfallen', { orsak: 'Elkonvertering', plats: 'Avd 72, sal 5' });
    expect(r.status).toBe(201);
    expect(inl(db(k), 'p11', 'uso-kard-72')).toMatchObject({ orsak: 'Elkonvertering', plats: 'Avd 72, sal 5' });
  });

  test('vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om', async () => {
    const k = await inloggad('ssk-kard');
    const fore = inl(db(k), 'p01', 'uso-kard-72');
    const vt = fore.vardtillfalle_id;
    const anteckningarFore = db(k).query('SELECT id, vardkontakt_id FROM anteckningar WHERE vardkontakt_id = ?').all(fore.id);
    expect(anteckningarFore.length).toBeGreaterThan(0);
    const f = await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-kard-hia', plats: 'HIA, sal 1' });
    expect(f.status).toBe(200);
    const hia = inl(db(k), 'p01', 'uso-kard-hia');
    expect(hia).toMatchObject({ vardtillfalle_id: vt, foregaende_id: fore.id, plats: 'HIA, sal 1' });
    expect(kontakt(k, fore.id).slut).toBeTruthy();
    // Inget av det som dokumenterats har flyttats eller skrivits om, och det hör fortfarande till vårdtillfället.
    expect(db(k).query('SELECT id, vardkontakt_id FROM anteckningar WHERE vardkontakt_id = ?').all(fore.id)).toEqual(anteckningarFore);
    const ut = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(ut.kontakter.map(x => x.id)).toEqual([fore.id, hia.id]);
    // Innehållet räknas på det som användaren får läsa.
    const lasbara = (await k.get('/api/patient/p01/anteckningar')).data.anteckningar.filter(x => x.vardkontaktId === fore.id).length;
    expect(lasbara).toBeGreaterThan(0);
    expect(ut.innehall.anteckningar).toBeGreaterThanOrEqual(lasbara);
    // Nästa mätning hamnar på den nya avdelningens kontakt, i samma vårdtillfälle.
    const m = await k.post('/api/patient/p01/matvarden', { typ: 'puls', varde: 88 });
    expect(radVk(k, 'matvarden', m.data.id)).toBe(hia.id);
    // Sängbyte på samma avdelning ger ingen ny kontakt.
    const s = await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-kard-hia', plats: 'HIA, sal 2' });
    expect(s.status).toBe(200);
    expect(inl(db(k), 'p01', 'uso-kard-hia')).toMatchObject({ id: hia.id, plats: 'HIA, sal 2' });
    expect((await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-kard-hia', plats: 'HIA, sal 2' })).status).toBe(400);
    // Permission och åter.
    const p = await k.post(`/api/vardtillfalle/${vt}/permission`, { till: imorgon() });
    expect(p.data).toMatchObject({ status: 'permission', permissionTill: imorgon() });
    expect((await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-kard-72' })).status).toBe(400);
    const a = await k.post(`/api/vardtillfalle/${vt}/permission/avsluta`, {});
    expect(a.data.status).toBe('inskriven');
    expect(a.data.handelser.map(h => h.typ)).toEqual(['inskrivning', 'sangbyte', 'flytt', 'sangbyte', 'permission', 'ater']);
    // Varje händelse har vem, var och när.
    for (const h of a.data.handelser.slice(2)) expect(h).toMatchObject({ av: { id: 'ssk-kard' }, enhet: { id: expect.any(String) }, tid: expect.any(String) });
  });

  test('medicinskt ansvar följer med vid flytt till en annan klinik, eller stannar kvar', async () => {
    const k = await inloggad('ssk-kard');
    const vt1 = inl(db(k), 'p01', 'uso-kard-72').vardtillfalle_id;
    const a = await k.post(`/api/vardtillfalle/${vt1}/flytta`, { enhetId: 'uso-med', plats: 'Avdelning 51', behallAnsvar: true });
    expect(a.data).toMatchObject({ ansvarig: { id: 'uso-kard' }, produktion: { id: 'uso-med' } });
    const vt2 = inl(db(k), 'p04', 'uso-kard-72').vardtillfalle_id;
    const b = await k.post(`/api/vardtillfalle/${vt2}/flytta`, { enhetId: 'uso-med', plats: 'Avdelning 52' });
    expect(b.data).toMatchObject({ ansvarig: { id: 'uso-med' }, produktion: { id: 'uso-med' } });
    expect(b.data.handelser.at(-1).detalj).toContain('Medicinska kliniken');
    // Till en vårdcentral går det inte att flytta en inskriven patient.
    expect((await k.post(`/api/vardtillfalle/${vt1}/flytta`, { enhetId: 'vc-tybble' })).status).toBe(400);
  });

  test('bara avdelningen där patienten ligger kan flytta och skriva ut', async () => {
    const k = await inloggad('lak-akut');
    const vt = inl(db(k), 'p01', 'uso-kard-72').vardtillfalle_id;
    expect((await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-med' })).status).toBe(403);
    expect((await k.post(`/api/vardtillfalle/${vt}/skriv-ut`, {})).status).toBe(403);
  });

  test('utskrivningen avslutar vårdtillfället och påminner om osignerade anteckningar och epikris', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p04/anteckningar', { typ: 'Daganteckning', sokord: SOK });
    const vt = inl(db(k), 'p04', 'uso-kard-72').vardtillfalle_id;
    const fore = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(fore.utskrivningskontroll.map(x => x.regel).sort()).toEqual(['epikris', 'osignerade']);
    expect(fore.utskrivningskontroll.find(x => x.regel === 'osignerade').text).toContain('1 osignerad anteckning');
    const r = await k.post(`/api/vardtillfalle/${vt}/skriv-ut`, {});
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'utskriven' });
    expect(r.data.utskriven).toBeTruthy();
    expect(inl(db(k), 'p04', 'uso-kard-72')).toBeNull();
    expect((await k.post(`/api/vardtillfalle/${vt}/skriv-ut`, {})).status).toBe(400);
  });

  test('hälsoärende föreslås ur samma diagnos och bekräftas med ett klick', async () => {
    const k = await inloggad('lak-kard');
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    const f = ov.vardstruktur.forslag.find(x => x.grunder.some(g => g.typ === 'diagnos'));
    expect(f).toBeTruthy();
    expect(f).toMatchObject({ typ: 'nytt', rubrik: 'Vänsterhjärtsvikt' });
    const synliga = new Set(ov.vardkontakter.map(v => v.id));
    expect(f.kontakter.every(id => synliga.has(id))).toBe(true);
    const r = await k.post('/api/patient/p01/halsoarenden', { nyckel: f.nyckel });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ rubrik: 'Vänsterhjärtsvikt', kontakter: f.kontakter, skapadAv: { id: 'lak-kard' } });
    for (const id of f.kontakter) expect(kontakt(k, id).halsoarende_id).toBe(r.data.id);
    const efter = (await k.get('/api/patient/p01/oversikt')).data;
    expect(efter.vardstruktur.forslag.some(x => x.nyckel === f.nyckel)).toBe(false);
    expect(efter.vardstruktur.halsoarenden.map(h => h.id)).toContain(r.data.id);
    // Ett förslag som inte längre gäller kan inte bekräftas.
    expect((await k.post('/api/patient/p01/halsoarenden', { nyckel: f.nyckel })).status).toBe(400);
  });

  test('förslagen bygger bara på kontakter som användaren får se, och ett förslag kan avvisas', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    const andra = new Set(d.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id IN ('uso-akut', 'uso-med', 'vc-tybble')").all().map(r => r.id));
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    for (const f of ov.vardstruktur.forslag) expect(f.kontakter.some(id => andra.has(id))).toBe(false);
    const f = ov.vardstruktur.forslag[0];
    expect((await k.post('/api/patient/p01/halsoarenden/avvisa', { nyckel: f.nyckel })).status).toBe(200);
    expect((await k.get('/api/patient/p01/oversikt')).data.vardstruktur.forslag.some(x => x.nyckel === f.nyckel)).toBe(false);
  });

  test('hälsoärende föreslås ur en remisskedja', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p10/anteckningar', { typ: 'Mottagningsanteckning', sokord: SOK });
    await k.post('/api/patient/p10/val', { typ: 'andra_enheter', syfte: 'Remissbedömning' });
    const ov = (await k.get('/api/patient/p10/oversikt')).data;
    const f = ov.vardstruktur.forslag.find(x => x.grunder.some(g => g.typ === 'remiss'));
    expect(f).toBeTruthy();
    const lind = d => d.query("SELECT id FROM vardkontakter WHERE patient_id = 'p10' AND enhet_id = 'lind-med' AND typ = 'slutenvard'").get().id;
    expect(f.kontakter).toContain(lind(db(k)));
    expect(f.grunder.find(g => g.typ === 'remiss').text).toContain('Medicinkliniken Lindesbergs lasarett');
  });

  test('seedens hälsoärende håller samman remisskedjan för patient 11', () => {
    const d = nyDb();
    const h = d.query("SELECT * FROM halsoarenden WHERE patient_id = 'p11'").get();
    expect(h).toMatchObject({ rubrik: 'Hjärtklappning', enhet_id: 'vc-tybble' });
    const enheter = d.query('SELECT enhet_id FROM vardkontakter WHERE halsoarende_id = ? ORDER BY start').all(h.id).map(r => r.enhet_id);
    expect(enheter).toEqual(['vc-tybble', 'uso-kard-mott']);
  });

  test('patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler', () => {
    const d = nyDb();
    const p = (id) => d.query('SELECT * FROM patienter WHERE id = ?').get(id);
    const vk = (typ, kontaktsatt, start = new Date().toISOString(), extra = {}) => ({ id: 0, typ, kontaktsatt, start, slut: null, kalla: 'vardkallan', patient_id: 'p06', ...extra });
    expect(avgiftFor(d, p('p06'), vk('oppenvard', 'besok'))).toMatchObject({ belopp: AVGIFT_DEMO.besok, demoregler: true });
    expect(avgiftFor(d, p('p06'), vk('oppenvard', 'telefon')).belopp).toBe(0);
    expect(avgiftFor(d, p('p06'), vk('akut', 'besok')).belopp).toBe(AVGIFT_DEMO.akut);
    // Barn betalar inget.
    expect(avgiftFor(d, p('p09'), vk('oppenvard', 'besok', undefined, { patient_id: 'p09' }))).toMatchObject({ belopp: 0 });
    expect(avgiftFor(d, p('p09'), vk('oppenvard', 'besok', undefined, { patient_id: 'p09' })).text).toContain('under 20');
    // Slutenvård per påbörjat vårddygn.
    const tre = new Date(Date.now() - 2.5 * 86400_000).toISOString();
    expect(avgiftFor(d, p('p06'), vk('slutenvard', null, tre)).belopp).toBe(3 * AVGIFT_DEMO.slutenvardDygn);
    // Högkostnadsskyddet: när taket är nått blir besöket avgiftsfritt.
    const ins = d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak) VALUES ('p06', 'vc-tybble', 'akut', 'besok', ?, ?, 'Mottagning', 'Test')");
    for (let i = 0; i < 6; i++) { const t = new Date(Date.now() - (i + 2) * 86400_000).toISOString(); ins.run(t, t); }
    const a = avgiftFor(d, p('p06'), vk('oppenvard', 'besok'));
    expect(a.belopp).toBe(0);
    expect(a.text).toContain('Frikort gäller till och med');
  });

  test('översikten och tidslinjen visar informationen per vårdkontakt och per vårdtillfälle', async () => {
    const k = await inloggad('lak-kard');
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    const pagaende = inl(db(k), 'p01', 'uso-kard-72');
    const per = ov.vardstruktur.perKontakt[pagaende.id];
    expect(per.anteckningar).toBeGreaterThan(0);
    expect(per.matvarden).toBeGreaterThan(0);
    expect(per.diagnoser).toEqual(expect.arrayContaining(['I48.1']));
    const vt = ov.vardstruktur.vardtillfallen.find(v => v.id === pagaende.vardtillfalle_id);
    expect(vt).toMatchObject({ status: 'inskriven', plats: 'Avd 72, sal 4', ansvarig: { id: 'uso-kard' } });
    expect(vt.handelser.map(h => h.typ)).toEqual(['inskrivning', 'sangbyte']);
    const ant = ov.tidslinje.filter(t => t.typ === 'anteckning' && t.vardkontaktId === pagaende.id);
    expect(ant.length).toBeGreaterThan(0);
    expect(ant.every(t => t.vardtillfalleId === pagaende.vardtillfalle_id)).toBe(true);
    expect(ov.tidslinje.every(t => 'vardkontaktId' in t)).toBe(true);
    const v = ov.vardkontakter.find(x => x.id === pagaende.id);
    expect(v).toMatchObject({ vardtillfalleId: pagaende.vardtillfalle_id, kontaktsatt: null, status: 'pagaende' });
  });

  test('vårdkontakten visar allt som hör till den, med samma behörighet och loggning', async () => {
    const lak = await inloggad('lak-kard');
    const id = inl(db(lak), 'p01', 'uso-kard-72').id;
    const r = await lak.get(`/api/vardkontakt/${id}`);
    expect(r.status).toBe(200);
    expect(r.data.vardkontakt.id).toBe(id);
    expect(r.data.anteckningar.some(a => a.kategori === 'lakare')).toBe(true);
    expect(r.data.diagnoser.length).toBeGreaterThan(0);
    expect(r.data.ordinationer.length).toBeGreaterThan(0);
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', resurs: `/api/vardkontakt/${id}`, resultat: 'tillaten' });
    // Undersköterskan ser omvårdnaden men inte läkaranteckningarna.
    const usk = await inloggad('usk-kard');
    const u = (await usk.get(`/api/vardkontakt/${id}`)).data;
    expect(u.anteckningar.length).toBeGreaterThan(0);
    expect(u.anteckningar.every(a => a.kategori === 'omvardnad')).toBe(true);
    expect(u.diagnoser).toBeNull();
    // Utan vårdrelation: nekad och loggad.
    const psyk = await inloggad('lak-vc');
    const n = await psyk.get(`/api/vardkontakt/${db(psyk).query("SELECT id FROM vardkontakter WHERE patient_id = 'p12' LIMIT 1").get().id}`);
    expect(n.status).toBe(403);
    expect(loggRader(psyk).at(-1)).toMatchObject({ personal_id: 'lak-vc', patient_id: 'p12', resultat: 'nekad' });
  });

  test('vårdadministratören ser kontakter och avgifter men ingen journaltext per kontakt', async () => {
    const k = await inloggad('adm-kard');
    const id = inl(db(k), 'p01', 'uso-kard-72').id;
    const r = (await k.get(`/api/vardkontakt/${id}`)).data;
    expect(r.vardkontakt.id).toBe(id);
    expect(r.anteckningar).toBeNull();
    expect(r.diagnoser).toBeNull();
    expect(r.ordinationer).toBeNull();
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    expect(ov.vardstruktur.perKontakt[id]).toEqual({ anteckningar: null, diagnoser: null, matvarden: null, ordinationer: null, remisser: expect.any(Number) });
    expect(ov.vardstruktur.forslag).toEqual([]);
  });

  test('FHIR: Encounter med vårdtillfälle, kontaktsätt och hälsoärende, och EpisodeOfCare med samma behörighet', async () => {
    const d = nyDb();
    const pers = (id) => d.query('SELECT * FROM personal WHERE id = ?').get(id);
    const fraga = (roll, vag, val = {}) => fhir.hantera({ db: d, personal: pers(roll), valFor: (pid) => val[pid] ?? {}, url: new URL(`http://test.local${vag}`), base: 'http://test.local' });
    const vk = inl(d, 'p01', 'uso-kard-72');
    const enc = fraga('lak-kard', `/fhir/Encounter/${vk.id}`).body;
    expect(enc.partOf).toEqual({ reference: `Encounter/vt-${vk.vardtillfalle_id}` });
    const vt = fraga('lak-kard', `/fhir/Encounter/vt-${vk.vardtillfalle_id}`).body;
    expect(vt).toMatchObject({ resourceType: 'Encounter', id: `vt-${vk.vardtillfalle_id}`, status: 'in-progress', class: { code: 'IMP' }, serviceProvider: { reference: 'Organization/uso-kard' } });
    expect(vt.location.map(l => l.location.display)).toEqual(['Avd 72, sal 6', 'Avd 72, sal 4']);
    expect(vt.location.map(l => l.status)).toEqual(['completed', 'active']);
    const sok = fraga('lak-kard', '/fhir/Encounter?patient=p01').body;
    expect(sok.entry.some(e => e.resource.id === `vt-${vk.vardtillfalle_id}`)).toBe(true);
    const tel = d.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND kontaktsatt = 'besok' LIMIT 1").get();
    expect(fraga('lak-kard', '/fhir/Encounter?patient=p01').body.entry.find(e => e.resource.id === String(tel?.id))?.resource.type).toBeTruthy();
    // EpisodeOfCare är hälsoärendet. Patient 11:s ärende skapades på Vårdcentralen Tybble.
    const h = d.query("SELECT id FROM halsoarenden WHERE patient_id = 'p11'").get().id;
    const eoc = fraga('lak-vc', `/fhir/EpisodeOfCare/${h}`).body;
    expect(eoc).toMatchObject({ resourceType: 'EpisodeOfCare', id: String(h), status: 'active', patient: { reference: 'Patient/p11' }, managingOrganization: { reference: 'Organization/vc-tybble' } });
    const mott = d.query("SELECT id FROM vardkontakter WHERE patient_id = 'p11' AND enhet_id = 'uso-kard-mott'").get().id;
    expect(fraga('lak-kard', `/fhir/Encounter/${mott}`).body.episodeOfCare).toEqual([{ reference: `EpisodeOfCare/${h}` }]);
    // Inre sekretess: kardiologen ser ärendet först efter ett aktivt val, och läsningen loggas.
    expect(() => fraga('lak-kard', `/fhir/EpisodeOfCare/${h}`)).toThrow();
    expect(fraga('lak-kard', `/fhir/EpisodeOfCare/${h}`, { p11: { andra_enheter: true } }).status).toBe(200);
    expect(d.query("SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1").get()).toMatchObject({ personal_id: 'lak-kard', resurs: `fhir/EpisodeOfCare/${h}`, grund: 'aktivt_val' });
    expect(() => fraga('lak-psyk', `/fhir/EpisodeOfCare?patient=p11`)).toThrow();
    expect(fhir.capability('http://test.local').rest[0].resource.some(r => r.type === 'EpisodeOfCare')).toBe(true);
  });

  test('nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras', async () => {
    const k = await inloggad('lak-vc');
    expect(harVardrelation(db(k), 'p12', 'vc-tybble')).toBe(false);
    expect((await k.post('/api/patient/p12/val', { typ: 'nodatkomst', syfte: 'Medvetslös i väntrummet' })).status).toBe(200);
    const m = await k.post('/api/patient/p12/matvarden', { typ: 'puls', varde: 48 });
    expect(m.status).toBe(201);
    // Användaren väljer fortfarande ingen kontakt: systemet skapar den, och nästa uppgift hamnar på samma kontakt.
    const id = radVk(k, 'matvarden', m.data.id);
    expect(kontakt(k, id)).toMatchObject({ enhet_id: 'vc-tybble', automatisk: 1, ger_vardrelation: 0 });
    expect(m.data.vardkontakt).toMatchObject({ id, ny: true });
    const m2 = await k.post('/api/patient/p12/matvarden', { typ: 'temp', varde: 35.1 });
    expect(radVk(k, 'matvarden', m2.data.id)).toBe(id);
    // Men kontakten ger ingen bestående vårdrelation: utan nödåtkomst nekas journalen igen.
    expect(harVardrelation(db(k), 'p12', 'vc-tybble')).toBe(false);
    await k.logga('lak-vc');
    const ov = await k.get('/api/patient/p12/oversikt');
    expect(ov.status).toBe(403);
    expect(ov.data.kod).toBe('kraver_val');
    // Samma sak när en läkare registrerar en kontakt eller skriver in under nödåtkomst.
    const a = await inloggad('lak-akut');
    await a.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös vid ankomst' });
    expect((await a.post('/api/patient/p02/vardkontakter', { orsak: 'Medvetslös' })).status).toBe(201);
    expect((await a.post('/api/patient/p02/vardtillfallen', { enhetId: 'uso-kard-72', orsak: 'Medvetslöshet' })).status).toBe(201);
    for (const e of ['uso-akut', 'uso-kard']) expect({ e, relation: harVardrelation(db(a), 'p02', e) }).toEqual({ e, relation: false });
    // En kontakt som skapas med vårdrelation ger vårdrelation som förut.
    const vc = await inloggad('lak-vc');
    const ok = await vc.post('/api/patient/p06/matvarden', { typ: 'puls', varde: 70 });
    expect(kontakt(vc, radVk(vc, 'matvarden', ok.data.id)).ger_vardrelation).toBe(1);
  });

  test('en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades', () => {
    const d = nyDb();
    const gammal = new Date(Date.now() - 100 * 86400_000).toISOString();
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla, automatisk) VALUES ('p12', 'vc-tybble', 'oppenvard', 'besok', ?, 'Mottagning', 'Besök', 'vardkallan', 1)").run(gammal);
    expect(harVardrelation(d, 'p12', 'vc-tybble')).toBe(false);
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla, automatisk) VALUES ('p12', 'vc-tybble', 'oppenvard', 'besok', ?, 'Mottagning', 'Besök', 'vardkallan', 1)").run(new Date().toISOString());
    expect(harVardrelation(d, 'p12', 'vc-tybble')).toBe(true);
  });

  test('inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får', async () => {
    // Kardiologen skriver in en patient som också har ett pågående akutbesök: akutmottagningens kontakt lämnas orörd.
    const k = await inloggad('lak-kard');
    const akut = db(k).query("SELECT * FROM vardkontakter WHERE patient_id = 'p03' AND enhet_id = 'uso-akut' AND slut IS NULL").get();
    expect(akut).toBeTruthy();
    const ov = (await k.get('/api/patient/p03/oversikt')).data;
    expect(ov.vardstruktur.forval.inskrivning.fran).toBeNull();
    const r = await k.post('/api/patient/p03/vardtillfallen', { orsak: 'Hjärtsvikt' });
    expect(r.status).toBe(201);
    expect(kontakt(k, akut.id).slut).toBeNull();
    expect(inl(db(k), 'p03', 'uso-kard-72').foregaende_id).toBeNull();
    // Sjuksköterskan på kardiologen kan inte skriva in på en annan kliniks avdelning, och försöket loggas.
    const s = await inloggad('ssk-kard');
    const n = await s.post('/api/patient/p11/vardtillfallen', { enhetId: 'uso-psyk', orsak: 'Test' });
    expect(n.status).toBe(403);
    expect(db(s).query("SELECT count(*) AS n FROM vardtillfallen WHERE patient_id = 'p11' AND utskriven IS NULL").get().n).toBe(0);
    expect(loggRader(s).some(x => x.personal_id === 'ssk-kard' && x.handling === 'vardtillfalle' && x.resultat === 'nekad')).toBe(true);
    // På den egna klinikens avdelningar går det, och från det egna akutbesöket till vilken avdelning som helst.
    expect((await s.post('/api/patient/p11/vardtillfallen', { enhetId: 'uso-kard-hia', orsak: 'Test' })).status).toBe(201);
    const a = await inloggad('lak-akut');
    expect((await a.post('/api/patient/p13/vardtillfallen', { enhetId: 'uso-med', orsak: 'Pneumoni' })).status).toBe(201);
    // Redan inskriven: meddelandet nämner inte en avdelning som användaren inte får se.
    const igen = await a.post('/api/patient/p01/vardtillfallen', { orsak: 'Test' });
    expect(igen.status).toBe(400);
    expect(igen.data.fel).not.toContain('72');
    // Flytt, permission och utskrivning kräver att patienten vårdas på den egna vårdenheten eller har ansvaret där.
    const vt = inl(db(a), 'p01', 'uso-kard-72').vardtillfalle_id;
    for (const [vag, kropp] of [['flytta', { enhetId: 'uso-med' }], ['permission', { till: imorgon() }], ['skriv-ut', {}]]) {
      expect({ vag, status: (await a.post(`/api/vardtillfalle/${vt}/${vag}`, kropp)).status }).toEqual({ vag, status: 403 });
    }
  });

  test('vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se', async () => {
    // Patient 1 flyttas från kardiologen till psykiatriska kliniken, och kardiologen behåller det medicinska ansvaret.
    const k = await inloggad('ssk-kard');
    const kard = inl(db(k), 'p01', 'uso-kard-72');
    const vt = kard.vardtillfalle_id;
    expect((await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-psyk', plats: 'Avdelning P2, sal 3', behallAnsvar: true })).status).toBe(200);
    const med = inl(db(k), 'p01', 'uso-psyk');
    // Psykiatriska kliniken skriver ett utkast på sin vistelse.
    await k.logga('lak-psyk');
    expect((await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: SOK })).data.vardkontakt.id).toBe(med.id);
    // Kardiologen ser sin egen vistelse men inte psykiatriska klinikens utan ett aktivt val.
    await k.logga('lak-kard');
    const ut = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(ut.kontakter.map(x => x.id)).toEqual([kard.id]);
    expect(ut.handelser.map(h => h.typ)).toEqual(['inskrivning', 'sangbyte']);
    expect(ut).toMatchObject({ ansvarig: { id: 'uso-kard' }, avdelning: null, plats: null, produktion: null });
    expect(JSON.stringify(ut)).not.toContain('Avdelning P2');
    // Psykiatrins utkast räknas inte i kardiologens utskrivningskontroll eller innehåll.
    const utkast = db(k).query("SELECT count(*) AS n FROM anteckningar WHERE vardkontakt_id = ? AND status = 'utkast'").get(kard.id).n;
    const osign = ut.utskrivningskontroll.find(x => x.regel === 'osignerade');
    if (utkast) expect(osign.text).toStartWith(`${utkast} `); else expect(osign).toBeUndefined();
    const egna = (await k.get('/api/patient/p01/anteckningar')).data.anteckningar.filter(a => a.vardkontaktId === kard.id).length;
    expect(ut.innehall.anteckningar).toBe(egna);
    // Översikten, tidslinjen och vårdkontakten bygger på samma filter.
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    const s = ov.vardstruktur.vardtillfallen.find(x => x.id === vt);
    expect(s).toMatchObject({ avdelning: null, plats: null, produktion: null });
    expect(s.handelser.map(h => h.typ)).toEqual(['inskrivning', 'sangbyte']);
    expect(ov.tidslinje.filter(t => t.typ === 'vardtillfalle').map(t => t.rubrik)).toEqual(['Sängbyte till Avd 72, sal 4']);
    expect(JSON.stringify(ov.vardstruktur)).not.toContain('Avdelning P2');
    // Kardiologen har ansvaret och dokumenterar på vistelsen, men får inte veta var patienten ligger utan ett aktivt val.
    const akt = (await k.get('/api/patient/p01/vardkontakt/aktuell')).data;
    expect(akt.vardkontakt).toMatchObject({ id: med.id, dold: true, plats: null, vardenhet: null, ansvarig: { id: 'uso-kard' } });
    const vk = (await k.get(`/api/vardkontakt/${kard.id}`)).data;
    expect(vk.vardtillfalle).toMatchObject({ avdelning: null, plats: null, kontakter: [{ id: kard.id }] });
    expect(vk.vardtillfalle.handelser.map(h => h.typ)).toEqual(['inskrivning', 'sangbyte']);
    // Med ett aktivt val syns hela vårdtillfället.
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Följa patienten' });
    const alla = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(alla.kontakter.map(x => x.id)).toEqual([kard.id, med.id]);
    expect(alla).toMatchObject({ avdelning: { id: 'uso-psyk' }, plats: 'Avdelning P2, sal 3' });
    // Psykiatriska kliniken ser flytten men inte från vilken avdelning, och inte kardiologens händelser.
    await k.logga('lak-psyk');
    const m = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(m.kontakter.map(x => x.id)).toEqual([med.id]);
    expect(m.handelser.map(h => h.typ)).toEqual(['flytt', 'ansvar']);
    expect(m.handelser.find(h => h.typ === 'flytt').detalj).toBeNull();
    // Vårdadministratören får inga antal anteckningar och ingen utskrivningskontroll.
    await k.logga('adm-kard');
    const adm = (await k.get(`/api/vardtillfalle/${vt}`)).data;
    expect(adm.innehall.anteckningar).toBeNull();
    expect(adm.utskrivningskontroll).toBeUndefined();
    // Den som inte får se någon vistelse nekas, och det loggas.
    await k.logga('lak-vc');
    expect((await k.get(`/api/vardtillfalle/${vt}`)).status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-vc', resultat: 'nekad' });
  });

  test('hälsoärendet visar bara de vårdkontakter som användaren får se', async () => {
    const k = await inloggad('lak-vc');
    const ov = (await k.get('/api/patient/p11/oversikt')).data;
    const synliga = new Set(ov.vardkontakter.map(v => v.id));
    const h = ov.vardstruktur.halsoarenden[0];
    expect(h.kontakter.length).toBeGreaterThan(0);
    expect(h.kontakter.every(id => synliga.has(id))).toBe(true);
    const egen = h.kontakter[0];
    expect((await k.get(`/api/vardkontakt/${egen}`)).data.halsoarende.kontakter).toEqual(h.kontakter);
    // Kardiologen ser kontakten på sin mottagning men inte ärendet från vårdcentralen utan ett aktivt val.
    const kard = await inloggad('lak-kard');
    const mott = db(kard).query("SELECT id FROM vardkontakter WHERE patient_id = 'p11' AND enhet_id = 'uso-kard-mott'").get().id;
    expect((await kard.get(`/api/vardkontakt/${mott}`)).data.halsoarende).toBeNull();
  });

  test('FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se', async () => {
    const k = await inloggad('ssk-kard');
    const vt = inl(db(k), 'p01', 'uso-kard-72').vardtillfalle_id;
    await k.post(`/api/vardtillfalle/${vt}/flytta`, { enhetId: 'uso-psyk', plats: 'Avdelning P2, sal 3', behallAnsvar: true });
    const d = db(k);
    const pers = (id) => d.query('SELECT * FROM personal WHERE id = ?').get(id);
    const fraga = (roll, vag, val = {}) => fhir.hantera({ db: d, personal: pers(roll), valFor: (pid) => val[pid] ?? {}, url: new URL(`http://test.local${vag}`), base: 'http://test.local' }).body;
    const enc = fraga('lak-kard', `/fhir/Encounter/vt-${vt}`);
    expect(enc.location.map(l => l.location.display)).toEqual(['Avd 72, sal 6', 'Avd 72, sal 4']);
    const sok = fraga('lak-kard', '/fhir/Encounter?patient=p01');
    expect(sok.entry.some(e => e.resource.id === `vt-${vt}`)).toBe(true);
    expect(JSON.stringify(sok)).not.toContain('Avdelning P2');
    expect(fraga('lak-kard', `/fhir/Encounter/vt-${vt}`, { p01: { andra_enheter: true } }).location.map(l => l.location.display)).toContain('Avdelning P2, sal 3');
    // Psykiatriska kliniken ser vårdtillfället genom sin vistelse, men bara sin egen plats.
    expect(fraga('lak-psyk', `/fhir/Encounter/vt-${vt}`).location.map(l => l.location.display)).toEqual(['Avdelning P2, sal 3']);
    expect(() => fraga('lak-vc', `/fhir/Encounter/vt-${vt}`)).toThrow();
    // Hälsoärendets period börjar med den första kontakten som användaren får se, inte med en på en annan vårdenhet.
    const h = d.query("SELECT id FROM halsoarenden WHERE patient_id = 'p11'").get().id;
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, halsoarende_id) VALUES ('p11', 'uso-psyk', 'oppenvard', 'besok', '2001-02-03T08:00:00.000Z', '2001-02-03T09:00:00.000Z', 'Mottagning', 'Besök', ?)").run(h);
    expect(fraga('lak-vc', `/fhir/EpisodeOfCare/${h}`).period.start).not.toBe('2001-02-03T08:00:00.000Z');
  });

  test('ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt', () => {
    const d = nyDb();
    const pers = d.query("SELECT * FROM personal WHERE id = 'lak-kard'").get();
    const fraga = (vag) => fhir.hantera({ db: d, personal: pers, valFor: () => ({}), url: new URL(`http://test.local${vag}`), base: 'http://test.local' }).body;
    for (const t of ['Observation', 'MedicationRequest', 'ServiceRequest']) {
      const b = fraga(`/fhir/${t}?patient=p01`);
      expect({ t, alla: b.entry.every(e => e.resource.encounter?.reference?.startsWith('Encounter/')) }).toEqual({ t, alla: true });
    }
  });
});

// Databasen i seeden är en vanlig SQLite-databas. Kontroll av att testerna inte beror på en viss version.
test('Vårdkontakt > SQLite stöder DROP COLUMN för testet av äldre sandlådor', () => {
  const d = new Database(':memory:');
  d.exec('CREATE TABLE t (a, b); ALTER TABLE t DROP COLUMN b');
  expect(d.query('PRAGMA table_info(t)').all().length).toBe(1);
});
