import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';
import { idag, addDagar, datumAv } from '../src/db.js';
import * as fhir from '../src/fhir.js';
import { urval, REMISSTYPER } from '../src/remiss-r10.js';
import { CS } from '../src/fhir-definitioner.js';
import * as konfiguration from '../src/konfiguration.js';
import { MAX_BILAGA, MAX_BILAGOR } from '../src/remiss-r4.js';

// Remiss, del 4 (runda 10, r6, Sussa 3.3.1.3 till 3.3.1.5): konsultation skild från remiss, urval i remissöversikten och
// läkarens kvittens av beslut som har registrerats på uppdrag. Systemet är experten: det frågar på vanlig svenska om
// vårdansvaret ska lämnas över, fyller i mottagning och bedömning när en konsultation besvaras, räknar antalet per val i
// översikten och lägger beslut på uppdrag i den ansvariga läkarens inkorg.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const som = async (roll, personalId) => { const k = await inloggad(roll); somPerson(sandlada(app, k), personalId); return k; };
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const KONS = { tillEnhetId: 'uso-kard', fragestallning: 'Blåsljud, behöver hon följas upp?', anamnes: 'Nyupptäckt blåsljud utan symtom.', prioritet: 'normal', svarSenast: addDagar(idag(), 20), typ: 'konsultation' };

describe('Remiss, del 4', () => {
  test('konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran', async () => {
    const vc = await inloggad('lak-vc');
    // Utan typ blir det en remiss, och en okänd typ avvisas med en förklaring på vanlig svenska.
    const r = await vc.post('/api/patient/p09/remisser', { ...KONS, typ: undefined });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ typ: 'remiss', typText: 'Remiss', konsultation: false });
    for (const fel of ['constructor', 'toString', 'okand', 7]) {
      const x = await vc.post('/api/patient/p09/remisser', { ...KONS, typ: fel });
      expect(x.status).toBe(400);
      expect(x.data.falt).toEqual(['typ']);
    }
    const k = await vc.post('/api/patient/p09/remisser', KONS);
    expect(k.status).toBe(201);
    expect(k.data).toMatchObject({ typ: 'konsultation', typText: 'Konsultation', konsultation: true, vardansvar: REMISSTYPER.konsultation.vardansvar });
    expect(db(vc).query('SELECT typ FROM remisser WHERE id = ?').get(k.data.id).typ).toBe('konsultation');
    // Utkastet sparar typen, och en återanvänd konsultation blir en konsultation igen.
    const u = await vc.post('/api/patient/p09/remissutkast', { typ: 'konsultation', tillEnhetId: 'uso-kard', fragestallning: 'Fråga om råd.' });
    expect(u.data.typ).toBe('konsultation');
    expect((await vc.put(`/api/remissutkast/${u.data.id}`, { typ: 'remiss' })).data.typ).toBe('remiss');
    expect((await vc.put(`/api/remissutkast/${u.data.id}`, { typ: 'konsultation' })).data.typ).toBe('konsultation');
    expect((await vc.put(`/api/remissutkast/${u.data.id}`, { typ: 'constructor' })).status).toBe(400);
    expect((await vc.post(`/api/remissutkast/${u.data.id}/skicka`, {})).data.typ).toBe('konsultation');
    expect((await vc.post('/api/patient/p09/remissutkast', { franRemissId: k.data.id })).data.typ).toBe('konsultation');
    // En konsultation på uppdrag: läkaren signerar, och typen följer med.
    const adm = await inloggad('adm-kard');
    const pu = await adm.post('/api/patient/p01/remiss-pa-uppdrag', { tillEnhetId: 'uso-ort', fragestallning: 'Behöver knät opereras?', uppdragsgivareId: 'lak-kard', typ: 'konsultation' });
    expect(pu.status).toBe(201);
    expect(pu.data.typ).toBe('konsultation');
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    expect((await lak.post(`/api/remiss-pa-uppdrag/${pu.data.id}/signera`, {})).data).toMatchObject({ typ: 'konsultation', paUppdrag: { skrivenAv: { id: 'adm-kard' } } });
    // Vidarebefordran behåller typen.
    delaSandlada(vc, lak);
    const vb = await lak.post(`/api/remiss/${k.data.id}/vidarebefordra`, { tillEnhetId: 'uso-med', motivering: 'Bedöms av medicinkliniken.' });
    expect(vb.status).toBe(200);
    expect(vb.data.ny).toMatchObject({ typ: 'konsultation', till: { id: 'uso-med' } });
    // FHIR: konsultationen har en egen kategori, och en ServiceRequest med kategorin skapar en konsultation.
    const sr = fhir.serviceRequest(db(vc), db(vc).query('SELECT * FROM remisser WHERE id = ?').get(k.data.id));
    expect(sr.category[0].coding[0]).toMatchObject({ code: 'konsultation', display: 'Konsultation' });
    expect(fhir.serviceRequest(db(vc), db(vc).query('SELECT * FROM remisser WHERE id = ?').get(r.data.id)).category[0].coding[0].code).toBe('remiss');
  });

  test('konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten', async () => {
    const vc = await inloggad('lak-vc');
    const k = (await vc.post('/api/patient/p09/remisser', KONS)).data;
    const lak = await inloggad('lak-kard');
    delaSandlada(vc, lak);
    // Läkaren svarar på en ännu inte kvitterad konsultation. Systemet registrerar mottagningen och bedömningen.
    const s = await lak.post(`/api/remiss/${k.id}/svara`, { svar: 'Ofarligt flödesblåsljud. Ingen uppföljning behövs.' });
    expect(s.status).toBe(200);
    expect(s.data).toMatchObject({ status: 'besvarad', beslut: 'accepterad', typ: 'konsultation', svarTyp: 'Konsultationssvar', av: { mottagen: { id: 'lak-kard' }, bedomd: { id: 'lak-kard' }, besvarad: { id: 'lak-kard' } } });
    expect(Object.values(s.data.tider).filter(Boolean).length).toBe(4);
    // Patienten sätts inte på väntelistan, eftersom vårdansvaret stannar hos remittenten.
    expect(db(lak).query('SELECT count(*) AS n FROM vantelista WHERE remiss_id = ?').get(k.id).n).toBe(0);
    expect(loggRader(lak).filter(x => x.resurs === `remiss:${k.id}:konsultationssvar`)).toHaveLength(1);
    // Remittenten kvitterar svaret som vanligt.
    expect((await vc.post(`/api/remiss/${k.id}/kvittera-svar`, {})).data.status).toBe('svar_kvitterat');
    // En accepterad konsultation ger ingen post på väntelistan, inte heller när den bedöms först.
    const k2 = (await vc.post('/api/patient/p09/remisser', KONS)).data;
    expect((await lak.post(`/api/remiss/${k2.id}/mottag`, {})).status).toBe(200);
    const b = await lak.post(`/api/remiss/${k2.id}/bedom`, { beslut: 'accepterad', besokInomDagar: 30 });
    expect(b.data.vantelista ?? null).toBeNull();
    expect(db(lak).query('SELECT count(*) AS n FROM vantelista WHERE remiss_id = ?').get(k2.id).n).toBe(0);
    // Ett beslut på uppdrag om att acceptera en konsultation ger ingen post på väntelistan och avbokar inget.
    const adm = await inloggad('adm-kard');
    delaSandlada(vc, adm);
    const k4 = (await vc.post('/api/patient/p09/remisser', KONS)).data;
    const bu = await adm.post(`/api/remiss/${k4.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' });
    expect(bu.status).toBe(200);
    expect(bu.data.vantelista ?? null).toBeNull();
    expect(bu.data.avbokade ?? null).toBeNull();
    // En vanlig remiss besvaras inte utan bedömning, och sjuksköterskan svarar inte på en konsultation.
    const r = (await vc.post('/api/patient/p09/remisser', { ...KONS, typ: 'remiss' })).data;
    expect((await lak.post(`/api/remiss/${r.id}/svara`, { svar: 'Svar utan bedömning.' })).status).toBe(400);
    const k3 = (await vc.post('/api/patient/p09/remisser', KONS)).data;
    const ssk = await inloggad('ssk-kard');
    delaSandlada(vc, ssk);
    expect((await ssk.post(`/api/remiss/${k3.id}/svara`, { svar: 'Svar från fel roll.' })).status).toBe(403);
    expect(db(ssk).query('SELECT status FROM remisser WHERE id = ?').get(k3.id).status).toBe('skickad');
    // En annan vårdenhet svarar inte.
    expect((await vc.post(`/api/remiss/${k3.id}/svara`, { svar: 'Svar från avsändaren.' })).status).toBe(403);
    // Vårdadministratören ser att det är en konsultation, men ingen klinisk text.
    const lista = (await adm.get('/api/remisser?riktning=inkommande')).data.remisser.find(x => x.id === k3.id);
    expect(lista).toMatchObject({ typ: 'konsultation', typText: 'Konsultation', fragestallning: null });
    expect(JSON.stringify(lista)).not.toContain(KONS.fragestallning);
  });

  test('konsultation: en ServiceRequest med kategorin konsultation skapar en konsultation genom FHIR, och utan kategori blir det en remiss', async () => {
    const vc = await inloggad('lak-vc');
    const sr = { resourceType: 'ServiceRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/p09' }, performer: [{ reference: 'Organization/uso-kard' }], reasonCode: [{ text: 'Behöver hon följas upp?' }] };
    const k = await vc.raw('POST', '/fhir/ServiceRequest', { ...sr, category: [{ coding: [{ system: `${CS}/remisstyp`, code: 'konsultation' }] }] });
    expect(k.status).toBe(201);
    expect(k.data.category[0].coding[0].code).toBe('konsultation');
    expect(db(vc).query('SELECT typ FROM remisser WHERE id = ?').get(Number(k.data.id)).typ).toBe('konsultation');
    const r = await vc.raw('POST', '/fhir/ServiceRequest', sr);
    expect(db(vc).query('SELECT typ FROM remisser WHERE id = ?').get(Number(r.data.id)).typ).toBe('remiss');
    const fel = await vc.raw('POST', '/fhir/ServiceRequest', { ...sr, category: [{ coding: [{ system: `${CS}/remisstyp`, code: 'constructor' }] }] });
    expect(fel.status).toBe(400);
  });

  test('bilagor: storleken och antalet är parametrar som systemförvaltaren sätter, med demons gränser som förval', async () => {
    const p = konfiguration.parametrar();
    expect(p['remiss.bilaga_max_kb'].standard).toBe(MAX_BILAGA / 1024);
    expect(p['remiss.bilagor_max'].standard).toBe(MAX_BILAGOR);
    expect(konfiguration.prova('remiss.bilaga_max_kb', 60).varfor).toContain('64 kB');
    const vc = await inloggad('lak-vc');
    const d = db(vc);
    const u = (await vc.post('/api/patient/p09/remissutkast', { tillEnhetId: 'uso-kard', fragestallning: 'Fråga med bilagor.' })).data;
    const fil = (kb) => ({ namn: 'anteckning.txt', data: Buffer.from('a'.repeat(kb * 1024)).toString('base64') });
    expect((await vc.post(`/api/remissutkast/${u.id}/bilagor`, fil(30))).status).toBe(201);
    // Systemförvaltaren sänker gränserna, och en annan systemförvaltare godkänner (fyra ögon).
    const pers = (id) => d.query('SELECT * FROM personal WHERE id = ?').get(id);
    const nu = new Date();
    for (const [nyckel, varde] of [['remiss.bilaga_max_kb', 20], ['remiss.bilagor_max', 2]]) {
      const a = konfiguration.foresla(d, pers('sysf'), { nyckel, varde, giltigFran: datumAv(nu), motivering: 'Mindre bilagor i demon.' }, nu);
      konfiguration.godkann(d, pers('sysf-2'), (a.andring ?? a).id, {}, nu);
      expect(konfiguration.varde(d, nyckel, nu)).toBe(varde);
    }
    const stor = await vc.post(`/api/remissutkast/${u.id}/bilagor`, fil(25));
    expect(stor.status).toBe(400);
    expect(stor.data.fel).toContain('högst 20 kB');
    expect((await vc.post(`/api/remissutkast/${u.id}/bilagor`, fil(10))).status).toBe(201);
    const tredje = await vc.post(`/api/remissutkast/${u.id}/bilagor`, fil(1));
    expect(tredje.status).toBe(400);
    expect(tredje.data.fel).toContain('högst 2 bilagor');
  });

  test('översikt: remisserna filtreras på typ, status, prioritet och tid, och antalet per val räknar bara det som visas för den egna vårdenheten', async () => {
    const vc = await inloggad('lak-vc');
    const k = (await vc.post('/api/patient/p09/remisser', { ...KONS, prioritet: 'akut' })).data;
    const lak = await inloggad('lak-kard');
    delaSandlada(vc, lak);
    const alla = (await lak.get('/api/remisser?riktning=inkommande')).data;
    expect(alla.antal.visade).toBe(alla.antal.totalt);
    expect(alla.remisser.length).toBe(alla.antal.totalt);
    const typ = (await lak.get('/api/remisser?riktning=inkommande&typ=konsultation')).data;
    // Seeden har en besvarad konsultation från vårdcentralen, och testet har lagt till en.
    expect(typ.remisser.map(x => x.id)).toContain(k.id);
    expect(typ.remisser.every(x => x.typ === 'konsultation')).toBe(true);
    expect(typ.filter).toEqual({ typ: 'konsultation' });
    const nKons = alla.remisser.filter(x => x.konsultation).length;
    expect(typ.remisser.length).toBe(nKons);
    expect(typ.val.typ.find(v => v.id === 'konsultation').antal).toBe(nKons);
    expect(typ.val.typ.find(v => v.id === 'remiss').antal).toBe(alla.antal.totalt - nKons);
    const prio = (await lak.get('/api/remisser?riktning=inkommande&prioritet=akut')).data;
    expect(prio.remisser.map(x => x.id)).toEqual([k.id]);
    // Status: väntar på mottagningskvittens, och remisser med larm.
    const vantar = (await lak.get('/api/remisser?riktning=inkommande&status=vantar_mottagning')).data.remisser;
    expect(vantar.length).toBeGreaterThan(0);
    expect(vantar.every(x => x.status === 'skickad')).toBe(true);
    const larm = (await lak.get('/api/remisser?riktning=inkommande&status=larm')).data.remisser;
    expect(larm.length).toBeGreaterThan(0);
    expect(larm.every(x => x.larm.length > 0)).toBe(true);
    const avslutade = (await lak.get('/api/remisser?riktning=inkommande&status=avslutad')).data.remisser;
    expect(avslutade.every(x => x.status === 'svar_kvitterat' || ['avvisad', 'vidarebefordrad'].includes(x.beslut))).toBe(true);
    // Tid: skickade inom ett datumintervall. Okända värden ignoreras och syns inte i filtret.
    const tid = (await lak.get(`/api/remisser?riktning=inkommande&fran=${idag()}&till=${idag()}`)).data;
    expect(tid.remisser.map(x => x.id)).toContain(k.id);
    expect(tid.remisser.every(x => x.tider.skickad.slice(0, 10) >= addDagar(idag(), -1))).toBe(true);
    const okand = (await lak.get('/api/remisser?riktning=inkommande&status=constructor&typ=__proto__&prioritet=x&fran=igar')).data;
    expect(okand.filter).toEqual({});
    expect(okand.antal.visade).toBe(alla.antal.totalt);
    // Antalet per val räknas på den egna vårdenhetens remisser, inte på andras.
    const vcLista = (await vc.get('/api/remisser?riktning=inkommande&typ=konsultation')).data;
    expect(vcLista.remisser).toEqual([]);
    expect(vcLista.val.typ.find(v => v.id === 'konsultation').antal).toBe(0);
    expect((await vc.get('/api/remisser?riktning=utgaende&typ=konsultation')).data.remisser.map(x => x.id)).toContain(k.id);
  });

  test('översikt: perioden räknas från en fast tid och intervallet följer svensk tid', () => {
    const nu = new Date('2026-11-08T12:00:00Z');
    const r = (id, skickad, extra = {}) => ({ id, typ: 'remiss', status: 'skickad', beslut: null, prioritet: 'normal', larm: [], tider: { skickad }, ...extra });
    const rader = [r(1, '2026-11-07T23:30:00Z'), r(2, '2026-11-01T10:00:00Z'), r(3, '2026-10-01T10:00:00Z', { typ: 'konsultation' }), r(4, '2025-01-01T10:00:00Z')];
    expect(urval(rader, new URLSearchParams('period=vecka'), nu).remisser.map(x => x.id)).toEqual([1, 2]);
    expect(urval(rader, new URLSearchParams('period=kvartal'), nu).remisser.map(x => x.id)).toEqual([1, 2, 3]);
    // 23.30 UTC den 7 november är den 8 november i Stockholm.
    expect(urval(rader, new URLSearchParams('fran=2026-11-08&till=2026-11-08'), nu).remisser.map(x => x.id)).toEqual([1]);
    expect(urval(rader, new URLSearchParams('period=vecka&typ=konsultation'), nu).val.typ.find(v => v.id === 'konsultation').antal).toBe(0);
    expect(urval(rader, new URLSearchParams('period=ar'), nu).antal).toEqual({ visade: 3, totalt: 4 });
  });

  test('beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning', async () => {
    const adm = await inloggad('adm-kard');
    const r = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    const b = await adm.post(`/api/remiss/${r.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' });
    expect(b.status).toBe(200);
    // Beslutet gäller direkt, så att patienten kommer upp på väntelistan, men väntar på läkarens kvittens.
    expect(b.data.beslutPaUppdrag).toMatchObject({ ansvarig: { id: 'lak-kard' }, kvittens: { status: 'vantar' } });
    expect(db(adm).query('SELECT count(*) AS n FROM vantelista WHERE remiss_id = ?').get(r.id).n).toBe(1);
    // Vårdadministratören kan inte kvittera beslutet själv, inte heller i läkarens namn.
    expect((await adm.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer' })).status).toBe(403);
    // En annan läkare har det inte i inkorgen och kan inte kvittera det.
    const ol = await som('lak-kard', 'ol-kard');
    delaSandlada(adm, ol);
    expect((await ol.get('/api/inkorg')).data.beslutAttKvittera).toEqual([]);
    expect((await ol.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer' })).status).toBe(403);
    expect(loggRader(ol).at(-1)).toMatchObject({ personal_id: 'ol-kard', resultat: 'nekad' });
    // Den ansvariga läkaren har beslutet i inkorgen och kvitterar det.
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    const ik = (await lak.get('/api/inkorg')).data.beslutAttKvittera;
    expect(ik).toMatchObject([{ id: r.id, beslut: 'accepterad', registreradAv: { id: 'adm-kard' }, patient: { id: 'p03' } }]);
    expect((await lak.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'kanske' })).status).toBe(400);
    const kv = await lak.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer' });
    expect(kv.status).toBe(200);
    expect(kv.data.beslutPaUppdrag.kvittens).toMatchObject({ status: 'kvitterat', av: { id: 'lak-kard' } });
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p03', handling: 'bedom_remiss', resurs: `remiss:${r.id}:beslut_pa_uppdrag:kvitterat` });
    expect((await lak.get('/api/inkorg')).data.beslutAttKvittera).toEqual([]);
    expect((await lak.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer' })).status).toBe(400);
    // En remiss som läkaren själv bedömde har inget att kvittera.
    const egen = db(lak).query("SELECT * FROM remisser WHERE patient_id = 'p16' AND till_enhet_id = 'uso-kard'").get();
    await lak.post(`/api/remiss/${egen.id}/bedom`, { beslut: 'accepterad' });
    expect((await lak.post(`/api/remiss/${egen.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer' })).status).toBe(400);
  });

  test('beslut på uppdrag: läkaren som inte håller med öppnar remissen igen för egen bedömning, och väntelistans post avslutas', async () => {
    const adm = await inloggad('adm-kard');
    const r = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    await adm.post(`/api/remiss/${r.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' });
    const lak = await inloggad('lak-kard');
    delaSandlada(adm, lak);
    // En kommentar krävs, så att det syns varför beslutet ändrades.
    expect((await lak.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer_inte' })).status).toBe(400);
    const u = await lak.post(`/api/remiss/${r.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer_inte', kommentar: 'Jag hade bett om remisskonferens först.' });
    expect(u.status).toBe(200);
    expect(u.data).toMatchObject({ status: 'mottagen', beslut: null, fordelad: { lakare: { id: 'lak-kard' } }, beslutPaUppdrag: { kvittens: { status: 'underkant', kommentar: 'Jag hade bett om remisskonferens först.' } } });
    expect(db(lak).query("SELECT status FROM vantelista WHERE remiss_id = ?").get(r.id).status).toBe('avslutad');
    // Remissen ligger nu bland läkarens remisser att bedöma, och läkaren bedömer själv.
    const ik = (await lak.get('/api/inkorg')).data;
    expect(ik.beslutAttKvittera).toEqual([]);
    expect(ik.remisserAttBedoma.map(x => x.id)).toContain(r.id);
    expect((await lak.post(`/api/remiss/${r.id}/bedom`, { beslut: 'avvisad', motivering: 'Handläggs i primärvården.' })).status).toBe(200);
    // Ett nytt beslut på uppdrag om samma remiss väntar på en ny kvittens.
    const r2 = db(adm).query("SELECT * FROM remisser WHERE patient_id = 'p16' AND till_enhet_id = 'uso-kard'").get();
    await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' });
    await lak.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer_inte', kommentar: 'Ska bedömas på nytt.' });
    const ny = await adm.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag`, { beslut: 'accepterad', ansvarigId: 'lak-kard' });
    expect(ny.data.beslutPaUppdrag.kvittens.status).toBe('vantar');
    expect((await lak.get('/api/inkorg')).data.beslutAttKvittera.map(x => x.id)).toEqual([r2.id]);
    // När patienten redan har fått en tid på remissen öppnas den inte igen, och systemet säger varför.
    const bokning = db(adm).query('SELECT id FROM vantelista WHERE remiss_id = ? AND status = ?').get(r2.id, 'vantar');
    expect(bokning).toBeTruthy();
    const tid = db(adm).query("SELECT t.id FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id IN ('uso-kard', 'uso-kard-mott') AND t.start > ? AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id AND b.status = 'bokad') ORDER BY t.start LIMIT 1").get(new Date().toISOString());
    db(adm).query("INSERT INTO bokningar (tid_id, patient_id, status, remiss_id, vantelista_id, bokad) VALUES (?, 'p16', 'bokad', ?, ?, ?)").run(tid.id, r2.id, bokning.id, new Date().toISOString());
    const nej = await lak.post(`/api/remiss/${r2.id}/beslut-pa-uppdrag/kvittera`, { utfall: 'stammer_inte', kommentar: 'Fel.' });
    expect(nej.status).toBe(400);
    expect(nej.data.fel).toContain('tid');
  });
});
