// Medicinteknisk utrustning (runda 9, r2, Sussa 3.6.1.1, 3.6.1.2, 3.6.1.4 till 3.6.1.7 och 3.5.2.19): mottagning i
// FHIR och HL7 v2 med utrustningens nyckel, koppling till patienten, klassning och godkännande, egenmätning i Min journal
// och pumpens rapporter som givna doser.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import * as mt from '../src/medicinteknik.js';
import { MATTYPER } from '../src/journal.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const MIN = 60_000;
const nu = (min = 0) => new Date(Date.now() - min * MIN).toISOString();
// Runda 11, r1: seedens senaste kompletta NEWS2-omgång för patienten läggs minst två timmar bakåt, så att ett nytt värde
// blir en egen omgång också strax efter midnatt, när seeden har lagt morgonens värden under den senaste timmen.
const aldreOmgang = (d, pid = 'p01') => {
  const grans = Date.now() - 2 * 60 * MIN;
  for (const r of d.query('SELECT id, tid FROM matvarden WHERE patient_id = ?').all(pid)) {
    if (Date.parse(r.tid) > grans) d.query('UPDATE matvarden SET tid = ? WHERE id = ?').run(new Date(Date.parse(r.tid) - 2 * 60 * MIN).toISOString(), r.id);
  }
};
const UCUM = 'http://unitsofmeasure.org';
const MDC = 'urn:iso:std:iso:11073:10101';
const LOINC = 'http://loinc.org';
// En riktig utrustning: den simulerade monitorn stängs av i testet, så att bara testets värden kommer.
const riktig = (k, id) => db(k).query('UPDATE mt_utrustning SET simulerad = 0 WHERE id = ?').run(id);
const obs = (kod, system, v, tid = nu()) => ({ resourceType: 'Observation', status: 'final', code: { coding: [{ system, code: kod }] }, effectiveDateTime: tid, device: { reference: 'Device/mt-mon-hia-1' }, ...v });
const q = (value, code) => ({ value, unit: code, system: UCUM, code });
const bundle = (resurser, enhet = 'mt-mon-hia-1') => ({ resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Device', id: enhet, identifier: [{ system: mt.SYS_UTRUSTNING, value: enhet }] } }, ...resurser.map(resource => ({ resource }))] });
const skicka = (nyckel, kropp, { format = 'fhir', typ } = {}) => fetch(`${app.url}/mt/${format}`, {
  method: 'POST', headers: { ...(nyckel ? { Authorization: `Bearer ${nyckel}` } : {}), 'Content-Type': typ ?? (format === 'fhir' ? 'application/fhir+json' : 'application/hl7-v2') },
  body: typeof kropp === 'string' ? kropp : JSON.stringify(kropp),
}).then(async r => ({ status: r.status, text: await r.text() }));
const diag = (r) => JSON.parse(r.text).issue[0].diagnostics;
// Kopplar en monitor till patienten och skapar en nyckel.
async function kopplad(k, pid = 'p01', id = 'mt-mon-hia-1', streckkod = 'MT-MON-0001') {
  riktig(k, id);
  const r = await k.post(`/api/patient/${pid}/mt/koppla`, { streckkod });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  const n = await k.post(`/api/mt/utrustning/${id}/nyckel`);
  return { koppling: r.data.koppling, nyckel: n.data.nyckel };
}

describe('Medicinteknik', () => {
  test('en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten', async () => {
    const k = await inloggad('ssk-kard');
    const { koppling, nyckel } = await kopplad(k);
    expect(koppling).toMatchObject({ aktiv: true, utrustning: { id: 'mt-mon-hia-1', typ: 'monitor' }, arbetsplats: 'Hjärtintensivvårdsavdelningen (HIA)' });
    const t = nu();
    const r = await skicka(nyckel, bundle([
      obs('8867-4', LOINC, { valueQuantity: q(92, '/min') }, t), obs('150456', MDC, { valueQuantity: q(95, '%') }, t),
      obs('150020', MDC, { component: [{ code: { coding: [{ system: MDC, code: '150021' }] }, valueQuantity: q(118, 'mm[Hg]') }, { code: { coding: [{ system: MDC, code: '150022' }] }, valueQuantity: q(72, 'mm[Hg]') }] }, t),
    ]));
    expect(r.status).toBe(200);
    expect(diag(r)).toContain('3 värden togs emot');
    const rader = db(k).query("SELECT m.*, v.utrustning_id, v.koppling_id FROM matvarden m JOIN mt_varden v ON v.matvarde_id = m.id WHERE m.patient_id = 'p01' ORDER BY m.typ").all();
    expect(rader.map(m => [m.typ, m.varde])).toEqual([['blodtryck', '118/72'], ['puls', '92'], ['saturation', '95']]);
    expect(rader.every(m => m.kalla === 'utrustning' && m.registrerad_av === null && m.enhet_id === 'uso-kard-hia' && m.vidimerad === null && m.koppling_id === koppling.id)).toBe(true);
    expect(rader[0].vardkontakt_id).not.toBeNull();
    // Ingen annan patient fick värden.
    expect(db(k).query("SELECT count(*) AS n FROM matvarden WHERE kalla = 'utrustning' AND patient_id <> 'p01'").get().n).toBe(0);
    // Samma meddelande en gång till dubblerar inte värdena.
    await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(92, '/min') }, t)]));
    expect(db(k).query("SELECT count(*) AS n FROM matvarden WHERE kalla = 'utrustning' AND typ = 'puls'").get().n).toBe(1);
  });

  test('utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    const b = bundle([obs('8867-4', LOINC, { valueQuantity: q(80, '/min') })]);
    expect((await skicka(null, b)).status).toBe(401);
    expect((await skicka('vkmt_fel', b)).status).toBe(401);
    expect(diag(await skicka('vkmt_fel', b))).toContain('nyckel');
    const u = db(k).query("SELECT * FROM mt_utrustning WHERE id = 'mt-mon-hia-1'").get();
    expect(u.nyckel_hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(db(k).query('SELECT * FROM mt_utrustning').all())).not.toContain(nyckel.slice(5));
    const ny = (await k.post('/api/mt/utrustning/mt-mon-hia-1/nyckel')).data.nyckel;
    expect((await skicka(nyckel, b)).status).toBe(401);
    expect((await skicka(ny, b)).status).toBe(200);
    // En nyckel skapas bara av personal på utrustningens vårdenhet.
    const vc = await inloggad('lak-vc');
    expect((await vc.post('/api/mt/utrustning/mt-mon-hia-1/nyckel')).status).toBe(403);
  });

  test('HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    const tid = new Date(Date.now() + 1000).toISOString().replace(/\D/g, '').slice(0, 14);
    const hl7 = ['MSH|^~\\&|MONITOR|HIA|VARDKALLAN|USO|' + tid + '||ORU^R01^ORU_R01|K123|P|2.6', 'PID|||197701182383',
      'OBR|1|||182777000^monitoring of patient^SCT', `OBX|1|NM|150456^MDC_PULS_OXIM_SAT_O2^MDC||93|262688^MDC_DIM_PERCENT^MDC|||||F|||${tid}||||mt-mon-hia-1`,
      `OBX|2|NM|150021^MDC_PRESS_BLD_NONINV_SYS^MDC||110|266016^MDC_DIM_MMHG^MDC|||||F|||${tid}||||mt-mon-hia-1`,
      `OBX|3|NM|150022^MDC_PRESS_BLD_NONINV_DIA^MDC||64|266016^MDC_DIM_MMHG^MDC|||||F|||${tid}||||mt-mon-hia-1`].join('\r');
    // Armbandet (PID-3) hör till en annan patient än kopplingen, så meddelandet avvisas med AE.
    const fel = await skicka(nyckel, hl7, { format: 'hl7v2' });
    expect(fel.status).toBe(422);
    expect(fel.text).toContain('MSA|AE|K123|Patienten i meddelandet är inte den som utrustningen är kopplad till');
    const r = await skicka(nyckel, hl7.replace('PID|||197701182383', 'PID|||194502024732'), { format: 'hl7v2' });
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/^MSH\|\^~\\&\|VARDKALLAN/);
    expect(r.text).toContain('MSA|AA|K123|2 värden togs emot');
    const rader = db(k).query("SELECT typ, varde FROM matvarden WHERE kalla = 'utrustning' AND patient_id = 'p01' ORDER BY typ").all();
    expect(rader).toEqual([{ typ: 'blodtryck', varde: '110/64' }, { typ: 'saturation', varde: '93' }]);
  });

  test('ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    expect((await skicka(nyckel, '{}', { typ: 'text/plain' })).status).toBe(415);
    const ingenBundle = await skicka(nyckel, { resourceType: 'Observation' });
    expect(ingenBundle.status).toBe(422);
    expect(diag(ingenBundle)).toBe('Meddelandet ska vara en FHIR Bundle (resourceType Bundle).');
    const okandKod = await skicka(nyckel, bundle([obs('12345-6', LOINC, { valueQuantity: q(5, '/min') })]));
    expect(diag(okandKod)).toContain('har koden LOINC 12345-6, som Vårdkällan inte tar emot från utrustning');
    const felEnhet = await skicka(nyckel, bundle([obs('8310-5', LOINC, { valueQuantity: q(99, '[degF]') })]));
    expect(diag(felEnhet)).toContain('temperatur ska anges som valueQuantity i UCUM med enheten Cel');
    const orimligt = await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(400, '/min') })]));
    expect(diag(orimligt)).toContain('Puls 400 ligger utanför det som går att mäta');
    const framtid = await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(80, '/min') }, new Date(Date.now() + 3600_000).toISOString())]));
    expect(diag(framtid)).toContain('ligger i framtiden');
    const adt = await skicka(nyckel, 'MSH|^~\\&|X|Y|||20261108||ADT^A01|K9|P|2.6\rPID|||1', { format: 'hl7v2' });
    expect(adt.text).toContain('MSA|AE');
    expect(adt.text).toContain('Bara ORU^R01 tas emot');
    const avvisade = db(k).query("SELECT orsak FROM mt_meddelanden WHERE status = 'avvisat' ORDER BY id").all().map(r => r.orsak);
    expect(avvisade.length).toBeGreaterThanOrEqual(6);
    expect(avvisade.some(o => o.includes('ORU^R01'))).toBe(true);
    // Inget av de felaktiga meddelandena gav ett mätvärde.
    expect(db(k).query("SELECT count(*) AS n FROM matvarden WHERE kalla = 'utrustning'").get().n).toBe(0);
  });

  test('formaten och profilerna står i CapabilityStatement och på sidan Öppet API', async () => {
    const k = await inloggad('lak-kard');
    const cap = (await k.get('/fhir/metadata')).data;
    expect(cap.rest[0].documentation).toContain('/mt/fhir');
    expect(cap.rest[0].documentation).toContain('HL7 v2.6 ORU^R01 (IHE PCD-01)');
    expect(cap.rest[0].documentation).toContain('vitalparameterprofil');
    const f = await fetch(`${app.url}/mt/format`).then(r => r.json());
    expect(Object.keys(f.format)).toEqual(['fhir', 'hl7v2']);
    expect(f.koder.saturation).toMatchObject({ loinc: ['2708-6', '59408-5'], mdc: ['150456'] });
    expect(f.demo).toContain('simulerad');
  });

  test('värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot', async () => {
    const k = await inloggad('ssk-kard');
    riktig(k, 'mt-mon-hia-1');
    const nyckel = (await k.post('/api/mt/utrustning/mt-mon-hia-1/nyckel')).data.nyckel;
    const b = () => bundle([obs('8867-4', LOINC, { valueQuantity: q(77, '/min') }, nu(0))]);
    const utan = await skicka(nyckel, b());
    expect(utan.status).toBe(422);
    expect(diag(utan)).toContain('Utrustningen var inte kopplad till någon patient');
    const r = await k.post('/api/patient/p01/mt/koppla', { streckkod: 'mt-mon-0001' });
    expect(r.status).toBe(201);
    // Ett värde från före kopplingen avvisas också.
    expect((await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(77, '/min') }, nu(30))]))).status).toBe(422);
    expect((await skicka(nyckel, b())).status).toBe(200);
    const slut = await k.post(`/api/mt/koppling/${r.data.koppling.id}/avsluta`, {});
    expect(slut.status).toBe(200);
    expect(slut.data.koppling).toMatchObject({ aktiv: false, avslutad: { av: 'Johan Ek' } });
    await new Promise(x => setTimeout(x, 5));
    expect((await skicka(nyckel, b())).status).toBe(422);
    expect(db(k).query("SELECT count(*) AS n FROM matvarden WHERE kalla = 'utrustning'").get().n).toBe(1);
    // En avslutad koppling ändras inte och raderas inte.
    expect(() => db(k).query('UPDATE mt_kopplingar SET slut = ? WHERE id = ?').run(new Date().toISOString(), r.data.koppling.id)).toThrow();
    expect(() => db(k).query('DELETE FROM mt_kopplingar').run()).toThrow();
  });

  test('kopplingen görs genom att skanna utrustningens streckkod, armbandet kontrolleras mot patienten och varje koppling loggas', async () => {
    const k = await inloggad('ssk-kard');
    riktig(k, 'mt-mon-hia-1');
    const okand = await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-XXX-9' });
    expect(okand.status).toBe(400);
    expect(okand.data.fel).toContain('Streckkoden hör inte till någon utrustning');
    const felArmband = await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001', armband: '19770118-2383' });
    expect(felArmband.status).toBe(400);
    expect(felArmband.data.fel).toContain('Armbandet hör inte till den här patienten');
    // Runda 13, r3 (säkerhetsgranskningen): personnumret räcker inte, bara patientens utskrivna armband.
    expect((await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001', armband: '194502024732' })).status).toBe(400);
    const band = (await k.post('/api/patient/p01/armband')).data.kod;
    const r = await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001', armband: band });
    expect(r.status).toBe(201);
    expect(r.data.koppling).toMatchObject({ armbandKontrollerat: true, kopplad: { av: 'Johan Ek' } });
    expect(r.data.text).toContain('Värdena kommer som referens tills de godkänns');
    const logg = db(k).query("SELECT * FROM atkomstlogg WHERE handling = 'koppla_utrustning' AND patient_id = 'p01' ORDER BY id").all();
    // Runda 13, r3: två nekade försök, ett annat personnummer och patientens eget personnummer i stället för armbandet.
    expect(logg.map(l => [l.resultat, l.resurs])).toEqual([['nekad', 'mt:koppla:mt-mon-hia-1:armband'], ['nekad', 'mt:koppla:mt-mon-hia-1:armband'], ['tillaten', `mt:koppling:${r.data.koppling.id}`]]);
    // Utrustningsdelen i fliken Mätvärden visar kopplingen och utrustningen som går att koppla.
    const v = (await k.get('/api/patient/p01/matvarden')).data.mt;
    expect(v.aktiva.map(x => x.id)).toEqual([r.data.koppling.id]);
    expect(v.utrustning.map(u => u.id)).not.toContain('mt-mon-hia-1');
    expect(v.utrustning.map(u => u.id)).toContain('mt-pump-hia-1');
    expect(v.kanKoppla).toBe(true);
  });

  test('när utrustningen flyttas till en annan patient avslutas den förra kopplingen utan att den patienten röjs', async () => {
    const k = await inloggad('ssk-kard');
    riktig(k, 'mt-mon-hia-1');
    const a = (await k.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001' })).data.koppling;
    const b = await k.post('/api/patient/p04/mt/koppla', { streckkod: 'MT-MON-0001' });
    expect(b.status).toBe(201);
    expect(b.data.text).toContain('Kopplingen till den förra patienten avslutades samtidigt');
    for (const x of ['Gunnar', 'Åkesson', '19450202', 'p01']) expect(JSON.stringify(b.data)).not.toContain(x);
    const forra = db(k).query('SELECT * FROM mt_kopplingar WHERE id = ?').get(a.id);
    expect(forra.slut).not.toBeNull();
    expect(forra.avslutad_orsak).toBe('Utrustningen flyttades till en annan patient');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = ?").get(`mt:koppling:${a.id}:avslutad`).n).toBe(1);
  });

  test('ett meddelande som anger en annan patient än kopplingen avvisas', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    const r = await skicka(nyckel, bundle([{ ...obs('8867-4', LOINC, { valueQuantity: q(70, '/min') }), subject: { reference: 'Patient/p04' } }]));
    expect(r.status).toBe(422);
    expect(diag(r)).toContain('Patienten i meddelandet är inte den som utrustningen är kopplad till');
    expect((await skicka(nyckel, bundle([{ ...obs('8867-4', LOINC, { valueQuantity: q(70, '/min') }), subject: { reference: 'Patient/p01' } }]))).status).toBe(200);
  });

  test('fel roll och fel vårdenhet får inte koppla utrustning, och logggranskaren når inte utrustningen', async () => {
    const vc = await inloggad('lak-vc');
    const r = await vc.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001' });
    expect(r.status).toBe(403);
    const logg = await inloggad('logg');
    expect((await logg.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0001' })).status).toBe(403);
    expect((await logg.get('/api/mt/utrustning')).data.utrustning).toEqual([]);
    const ssk = await inloggad('ssk-kard');
    expect((await ssk.get('/api/mt/utrustning')).data.utrustning.map(u => u.id)).toEqual(['mt-mon-72-1', 'mt-mon-hia-1', 'mt-mon-hia-2', 'mt-mon-hia-3', 'mt-pump-72-1', 'mt-pump-hia-1', 'mt-pump-hia-2']);
  });

  test('värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    aldreOmgang(db(k));
    const fore = (await k.get('/api/patient/p01/matvarden')).data;
    expect(fore.news2.larm).toBe(false);
    expect((await skicka(nyckel, bundle([obs('150456', MDC, { valueQuantity: q(88, '%') }, nu(0))]))).status).toBe(200);
    const d = (await k.get('/api/patient/p01/matvarden')).data;
    const v = d.matvarden.find(m => m.klass?.kalla === 'utrustning');
    expect(v.klass).toMatchObject({ klass: 'referens', klassText: 'Referens, inte godkänt för diagnostiskt bruk', kvalitetssakrad: false, utrustning: { serienummer: 'DEMO-MON-0001' } });
    expect(d.news2).toEqual(fore.news2);
    expect(d.mt.vantar).toEqual({ utrustning: 1, patient: 0 });
    expect(d.kurvor.find(x => x.typ === 'saturation').punkter.at(-1)).toMatchObject({ varden: [88], kalla: 'utrustning', godkand: false });
    // FHIR: preliminary och med utrustningen tills värdet är godkänt.
    const fh = (await k.get(`/fhir/Observation/${v.id}`)).data;
    expect(fh).toMatchObject({ status: 'preliminary', device: { identifier: { value: 'mt-mon-hia-1' } } });
    const g = await k.post('/api/patient/p01/mt/godkann', {});
    expect(g.status).toBe(200);
    expect(g.data.text).toBe('1 värde är godkänt för diagnostiskt bruk och räknas nu i NEWS2 och beslutsstödet.');
    const efter = (await k.get('/api/patient/p01/matvarden')).data;
    expect(efter.matvarden.find(m => m.id === v.id).klass).toMatchObject({ klass: 'diagnostisk', kvalitetssakrad: true, bedomd: { beslut: 'godkand', av: 'Johan Ek' } });
    expect(efter.news2.larm).toBe(true);
    expect(efter.news2.nyareRoda.map(x => x.namn)).toEqual(['Syremättnad']);
    expect((await k.get(`/fhir/Observation/${v.id}`)).data.status).toBe('final');
    expect((await k.get('/api/inkorg')).data.news2Larm.find(x => x.patientId === 'p01')).toBeTruthy();
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'godkanna_matvarde' AND resurs = 'mt:godkand:1'").get().n).toBe(1);
  });

  test('bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras', async () => {
    const k = await inloggad('ssk-kard');
    const { nyckel } = await kopplad(k);
    await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(81, '/min') }, nu(0)), obs('150456', MDC, { valueQuantity: q(97, '%') }, nu(0))]));
    const usk = await inloggad('usk-kard');
    expect((await usk.post('/api/patient/p01/mt/godkann', {})).status).toBe(403);
    const ids = db(k).query("SELECT id FROM matvarden WHERE kalla = 'utrustning' ORDER BY id").all().map(r => r.id);
    expect((await k.post('/api/patient/p01/mt/godkann', { ids: [ids[0], 999999] })).status).toBe(400);
    const ref = await k.post('/api/patient/p01/mt/godkann', { ids: [ids[0]], beslut: 'referens' });
    expect(ref.data.text).toContain('bedömt som referens');
    expect((await k.post('/api/patient/p01/mt/godkann', { ids: [ids[0]] })).status).toBe(400);
    expect((await k.post('/api/patient/p01/mt/godkann', {})).data.antal).toBe(1);
    expect((await k.post('/api/patient/p01/mt/godkann', {})).data.fel).toBe('Det finns inga värden som väntar på bedömning.');
    expect(() => db(k).query("UPDATE matvarde_bedomningar SET beslut = 'godkand'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM matvarde_bedomningar').run()).toThrow();
    // Läkaren på en annan vårdenhet godkänner inte värden härifrån.
    await skicka(nyckel, bundle([obs('8867-4', LOINC, { valueQuantity: q(83, '/min') }, nu(0))]));
    await k.post('/api/logout');
    await k.logga('lak-akut');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Följa förloppet' });
    const akut = await k.post('/api/patient/p01/mt/godkann', {});
    expect(akut.status).toBe(400);
    expect(akut.data.fel).toBe('Det finns inga värden som väntar på bedömning.');
  });

  test('ett värde från utrustning på en spärrad vårdenhet syns inte och röjs inte i svaret', async () => {
    const k = await inloggad('ssk-kard');
    const svar = async () => { const d = (await k.get('/api/patient/p04/matvarden')).data; return JSON.stringify(d); };
    const fore = await svar();
    // Ett värde från en monitor på den spärrade psykiatriska kliniken (läggs in direkt, som om utrustningen fanns där).
    const id = Number(db(k).query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES ('p04', 'uso-psyk', 'puls', '140', 140, 'slag/min', ?, 'utrustning')").run(nu(3)).lastInsertRowid);
    db(k).query("INSERT INTO mt_varden (matvarde_id, utrustning_id, koppling_id, meddelande_id, patient_id, enhet_id) VALUES (?, 'mt-mon-akut-1', 0, 0, 'p04', 'uso-psyk')").run(id);
    expect(await svar()).toBe(fore);
    const g = await k.post('/api/patient/p04/mt/godkann', { ids: [id] });
    expect(g.status).toBe(400);
    expect(JSON.stringify(g.data)).not.toContain('psyk');
  });

  test('patienten registrerar egna mätningar i Min journal, och de skickas till vårdenheten som vårdar patienten märkta som inte kvalitetssäkrade', async () => {
    const inv = await invanare('inv-p01');
    const r = await inv.post('/api/min/journal/p01/egenmatning', { typ: 'blodtryck', varde: '182/104' });
    expect(r.status).toBe(201);
    expect(r.data.text).toBe('Mätningen är skickad till Kardiologiska kliniken USÖ. Vården bedömer den, och tills dess räknas den inte som ett kvalitetssäkrat värde.');
    expect(r.data.matvarde).toMatchObject({ namn: 'Blodtryck', varde: '182/104', status: 'Inte bedömd ännu', mottagare: 'Kardiologiska kliniken USÖ' });
    // Runda 13, r3 (E3-38): ett mycket högt blodtryck ger råd om 1177 och 112, och ett omöjligt värde tas inte emot.
    expect(r.data.rad).toMatchObject({ niva: 'radgivning' });
    expect(r.data.rad.text).toContain('1177');
    const omojligt = await inv.post('/api/min/journal/p01/egenmatning', { typ: 'blodtryck', varde: '300/20' });
    expect(omojligt.status).toBe(400);
    expect(omojligt.data.fel).toContain('inte ett blodtryck som går att mäta');
    const rad = db(inv).query("SELECT * FROM matvarden WHERE kalla = 'patient'").get();
    expect(rad).toMatchObject({ patient_id: 'p01', enhet_id: 'uso-kard-72', registrerad_av: null, vidimerad: null });
    expect(db(inv).query('SELECT invanare_id FROM egenmatningar WHERE matvarde_id = ?').get(rad.id).invanare_id).toBe('inv-p01');
    const lista = (await inv.get('/api/min/journal/p01/egenmatning')).data;
    expect(lista.matningar.map(m => m.status)).toEqual(['Inte bedömd ännu']);
    expect(lista.typer.map(t => t.typ)).toEqual(mt.EGNA_TYPER);
    expect(lista.mottagare).toBe('Kardiologiska kliniken USÖ');
    // Den egna mätningen står inte bland vårdens mätvärden i Min journal.
    expect((await inv.get('/api/min/journal/p01/provsvar')).data.matvarden.some(m => m.varde === '182/104')).toBe(false);
    expect(db(inv).query("SELECT count(*) AS n FROM atkomstlogg WHERE invanare_id = 'inv-p01' AND handling = 'invanare_registrera'").get().n).toBe(1);
  });

  test('patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda', async () => {
    // Patienten och personalen i samma sandlåda: patienten loggar in, mäter och loggar ut, och sedan loggar personalen in.
    const s = await invanare('inv-p01');
    aldreOmgang(db(s));
    expect((await s.post('/api/min/journal/p01/egenmatning', { typ: 'saturation', varde: 86, tid: nu(1) })).status).toBe(201);
    expect((await s.post('/api/min/journal/p01/egenmatning', { typ: 'vikt', varde: '70,5', tid: nu(1) })).status).toBe(201);
    await s.post('/api/logout');
    await s.logga('ssk-kard');
    const d = (await s.get('/api/patient/p01/matvarden')).data;
    expect(d.egna.map(m => [m.typ, m.klass.klass])).toEqual([['vikt', 'egen'], ['saturation', 'egen']]);
    expect(d.egna[0].klass.klassText).toBe('Patientens egen mätning, inte kvalitetssäkrad');
    expect(d.matvarden.some(m => m.klass?.kalla === 'patient')).toBe(false);
    expect(d.kurvor.find(x => x.typ === 'saturation').punkter.some(p => p.varden[0] === 86)).toBe(false);
    expect(d.news2.larm).toBe(false);
    expect(d.mt.vantar.patient).toBe(2);
    expect((await s.get('/api/patient/p01/basfakta')).data.vikt.varde).toBe(81.6);
    // Runda 13, r3: en försenad kontroll enligt NEWS2 kan larma, men aldrig ett larm som bygger på patientens egna värden.
    expect((await s.get('/api/inkorg')).data.news2Larm.some(x => x.patientId === 'p01' && !x.forsenad)).toBe(false);
    // Bedömd och godkänd: räknas som andra värden.
    expect((await s.post('/api/patient/p01/mt/godkann', { kalla: 'patient' })).data.antal).toBe(2);
    const e = (await s.get('/api/patient/p01/matvarden')).data;
    expect(e.egna.map(m => m.klass.klass)).toEqual(['egen_godkand', 'egen_godkand']);
    expect((await s.get('/api/patient/p01/basfakta')).data.vikt.varde).toBe(70.5);
    expect(e.news2.nyareRoda.map(x => x.namn)).toContain('Syremättnad');
  });

  test('egna mätningar har ett tak per dygn, och fel typ eller värde förklaras', async () => {
    const inv = await invanare('inv-p01');
    const fel = await inv.post('/api/min/journal/p01/egenmatning', { typ: 'crp', varde: 5 });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('Välj vad du har mätt');
    expect((await inv.post('/api/min/journal/p01/egenmatning', { typ: 'blodtryck', varde: '80/120' })).data.fel).toContain('övertryck/undertryck');
    expect((await inv.post('/api/min/journal/p01/egenmatning', { typ: 'puls', varde: 900 })).status).toBe(400);
    expect((await inv.post('/api/min/journal/p02/egenmatning', { typ: 'puls', varde: 70 })).status).toBe(404);
    for (let i = 0; i < mt.TAK.dygnEgna; i++) expect((await inv.post('/api/min/journal/p01/egenmatning', { typ: 'puls', varde: 60 + (i % 20) })).status).toBe(201);
    const tak = await inv.post('/api/min/journal/p01/egenmatning', { typ: 'puls', varde: 70 });
    expect(tak.status).toBe(429);
    expect(tak.data.fel).toContain(`högst ${mt.TAK.dygnEgna} mätningar per dygn`);
  });
});

// Pumpens rapporter (Sussa 3.5.2.19). Infusionen ordineras med protokollet för morfin (iva.js).
describe('Medicinteknik, infusionspump', () => {
  const adm = (o, fran, till, extra) => ({ resourceType: 'MedicationAdministration', status: 'in-progress', request: { reference: `MedicationRequest/${o}` }, effectivePeriod: { start: fran, end: till }, ...extra });
  const pbundle = (r) => bundle([r], 'mt-pump-hia-1');

  test('en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen', async () => {
    // Läkaren och sjuksköterskan i samma sandlåda: läkaren ordinerar och sjuksköterskan kopplar pumpen.
    const s = await inloggad('lak-kard');
    const o = await s.post('/api/patient/p01/iva/infusion', { protokoll: 'morfin', ordinationsorsak: 'Smärtlindring efter ingrepp' });
    expect(o.status).toBe(201);
    await s.post('/api/logout');
    await s.logga('ssk-kard');
    riktig(s, 'mt-pump-hia-1');
    const kp = await s.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-PMP-0001' });
    expect(kp.status).toBe(201);
    expect(kp.data.koppling.ordination.id).toBe(o.data.ordination.id);
    const nyckel = (await s.post('/api/mt/utrustning/mt-pump-hia-1/nyckel')).data.nyckel;
    const oid = o.data.ordination.id;
    // 1,6 ml/h i 30 minuter av morfin 1 mg/ml ger 0,8 ml och 0,8 mg.
    const r = await skicka(nyckel, pbundle(adm(oid, nu(30), nu(0), { dosage: { rateQuantity: q(1.6, 'mL/h') } })));
    expect(r.status).toBe(200);
    const a = db(s).query("SELECT * FROM administreringar WHERE kalla = 'utrustning'").get();
    expect(a).toMatchObject({ ordination_id: oid, status: 'given', dos: 0.8, dos_enhet: 'mg', volym_ml: 0.8, utford_av: 'ssk-kard', enhet_id: 'uso-kard-hia' });
    expect(db(s).query('SELECT * FROM vatskebalans WHERE administrering_id = ?').get(a.id)).toMatchObject({ riktning: 'in', volym_ml: 0.8, kalla: 'utrustning' });
    const h = db(s).query('SELECT * FROM mt_pumphandelser').get();
    expect(h).toMatchObject({ typ: 'pagar', hastighet_ml_h: 1.6, varningar: null, administrering_id: a.id });
    // För hög hastighet (6 ml/h är 0,074 mg/kg/h vid 81,6 kg, över 0,04) ger en allvarlig varning som syns i Läkemedel att ge.
    await skicka(nyckel, pbundle(adm(oid, nu(1), nu(0), { dosage: { rateQuantity: q(6, 'mL/h') } })));
    const p = (await s.get('/api/mt/pumpar')).data.pumpar.find(x => x.patient.id === 'p01');
    expect(p.okvitterade[0].varningar[0]).toMatchObject({ niva: 'allvarlig', regel: 'utanfor_intervall' });
    expect(p.okvitterade[0].varningar[0].text).toContain('utanför det ordinerade intervallet 0,01 till 0,04 mg/kg/h');
    expect(p.senaste).toMatchObject({ hastighetMlH: 6 });
    expect(p.dygn.dosEnhet).toBe('mg');
    // Kvitteringen kräver vad som gjordes.
    expect((await s.post(`/api/mt/pumphandelse/${p.okvitterade[0].id}/kvittera`, {})).status).toBe(400);
    expect((await s.post(`/api/mt/pumphandelse/${p.okvitterade[0].id}/kvittera`, { motivering: 'Pumpen ställd om till 1,6 ml/h' })).status).toBe(200);
    expect((await s.get('/api/mt/pumpar')).data.pumpar.find(x => x.patient.id === 'p01').okvitterade).toEqual([]);
    // En bolus större än den ordinerade bolusdosen (2 mg) och en dygnsdos över 100 mg.
    await skicka(nyckel, pbundle(adm(oid, nu(0), nu(0), { category: { coding: [{ code: 'bolus' }] }, dosage: { dose: q(3, 'mL') } })));
    const bol = db(s).query("SELECT varningar FROM mt_pumphandelser WHERE typ = 'bolus'").get();
    expect(JSON.parse(bol.varningar).map(v => v.regel)).toEqual(['bolus_for_stor']);
    await skicka(nyckel, pbundle(adm(oid, nu(100), nu(0), { dosage: { dose: q(99, 'mL') } })));
    const sista = db(s).query('SELECT varningar FROM mt_pumphandelser ORDER BY id DESC').get();
    expect(JSON.parse(sista.varningar).map(v => v.regel)).toContain('dygnsdos');
    // En pump som rapporterar en annan ordination avvisas.
    const annan = await skicka(nyckel, pbundle(adm(oid + 999, nu(5), nu(0), { dosage: { rateQuantity: q(1, 'mL/h') } })));
    expect(annan.status).toBe(422);
    expect(diag(annan)).toContain('en annan ordination');
  });

  test('pumparna i Läkemedel att ge visas bara för vårdenheten, och en pump kopplas bara till en aktiv infusion', async () => {
    const s = await inloggad('ssk-kard');
    riktig(s, 'mt-pump-hia-2');
    const utan = await s.post('/api/patient/p04/mt/koppla', { streckkod: 'MT-PMP-0002' });
    expect(utan.status).toBe(400);
    expect(utan.data.fel).toContain('ingen aktiv infusion');
    const vc = await inloggad('lak-vc');
    expect((await vc.get('/api/mt/pumpar')).data.pumpar).toEqual([]);
  });

  test('den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen', async () => {
    const s = await inloggad('ssk-kard');
    const d = db(s);
    const k = (await s.post('/api/patient/p01/mt/koppla', { streckkod: 'MT-MON-0002' })).data.koppling;
    // Den första mätningen kommer direkt när monitorn kopplas.
    const start = Date.parse(k.start);
    const n = mt.efterTid(d, MATTYPER, new Date(start + 30 * MIN + 1000));
    expect(n).toBeGreaterThanOrEqual(6);
    const m = d.query("SELECT DISTINCT tid FROM matvarden m JOIN mt_varden v ON v.matvarde_id = m.id WHERE v.koppling_id = ? ORDER BY tid").all(k.id);
    expect(m.length).toBeGreaterThanOrEqual(6);
    expect(Date.parse(m[1].tid) - Date.parse(m[0].tid)).toBeLessThanOrEqual(5 * MIN);
    const typer = d.query('SELECT DISTINCT m.typ FROM matvarden m JOIN mt_varden v ON v.matvarde_id = m.id WHERE v.koppling_id = ? ORDER BY m.typ').all(k.id).map(r => r.typ);
    expect(typer).toEqual(['andningsfrekvens', 'blodtryck', 'puls', 'saturation', 'temp']);
    expect(d.query("SELECT count(*) AS n FROM mt_meddelanden WHERE koppling_id = ? AND simulerat = 1 AND status = 'mottaget' AND format = 'fhir'").get(k.id).n).toBe(n);
    // Samma tid igen ger inga nya meddelanden.
    expect(mt.efterTid(d, MATTYPER, new Date(start + 30 * MIN + 1000))).toBe(0);
  });
});

// Nyheterna i version 0.9.0 för utrustningen, godkännandet, intensivvården och de egna mätningarna.
describe('Medicinteknik, nyheter', () => {
  test('nyheterna om utrustning, godkännande, intensivvård och egna mätningar gäller rätt roller', async () => {
    const nyheter = await import('../src/nyheter.js');
    const { nyDb, personal } = await import('./hjalp.js');
    const d = nyDb();
    const ids = (p) => nyheter.nyheter(d, p.yrke ? { personal: p, invanare: null } : p).alla.flatMap(v => v.nyheter.map(n => n.id));
    expect(ids(personal(d, 'lak-kard'))).toEqual(expect.arrayContaining(['medicinteknisk-utrustning', 'godkanna-matvarden', 'intensivvard', 'anestesibedomning']));
    expect(ids(personal(d, 'ssk-kard'))).toEqual(expect.arrayContaining(['medicinteknisk-utrustning', 'godkanna-matvarden', 'intensivvard']));
    expect(ids(personal(d, 'ssk-kard'))).not.toContain('anestesibedomning');
    expect(ids(personal(d, 'usk-kard'))).not.toContain('godkanna-matvarden');
    expect(ids(personal(d, 'adm-kard'))).not.toContain('medicinteknisk-utrustning');
    const inv = ids({ personal: null, invanare: { id: 'inv-p01' } });
    expect(inv).toContain('egna-matningar');
    expect(inv).not.toContain('intensivvard');
  });
});
