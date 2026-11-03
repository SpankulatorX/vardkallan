import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar, iso } from '../src/db.js';

// Samordnad individuell plan (SIP) och samordnad planering vid utskrivning (SPU), Sussa 4.3.1.1 till 4.3.1.3, byggt
// från lag (2017:612), 16 kap. 4 § HSL och 10 kap. 8 § SoL. Kommunen är en simulerad part.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k, villkor = '1 = 1') => db(k).query(`SELECT * FROM atkomstlogg WHERE ${villkor} ORDER BY id`).all();

describe('Samordnad planering', () => {
  test('systemet föreslår SPU och skickar inskrivningsmeddelandet med lagens uppgifter till kommunen och vårdcentralen', async () => {
    const k = await inloggad('lak-kard');
    // Margareta Forsberg (p06) är 81 år. Hon skrivs in på avdelning 72 för att visa förslaget.
    const s = db(k);
    const vt = Number(s.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, orsak, inskriven_av) VALUES ('p06', 'uso-kard', ?, 'Hjärtsvikt', 'lak-kard')").run(iso()).lastInsertRowid);
    s.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, vardtillfalle_id) VALUES ('p06', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Hjärtsvikt', ?)").run(iso(), vt);
    const d = (await k.get('/api/patient/p06/samordning')).data;
    const f = d.forslag.spu;
    expect(f.varfor[0]).toContain('år och inneliggande');
    expect(f.mottagare.map(m => m.id)).toEqual(['kommun-demo', 'vc-tybble']);
    expect(f.forklaring).toContain('2 kap. 1 och 3 §§');
    const r = await k.post('/api/patient/p06/samordning', { typ: 'spu', behov: f.behov, beraknad: addDagar(idag(), 4) });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ typ: 'spu', beraknad: addDagar(idag(), 4), mottagare: [{ id: 'kommun-demo' }, { id: 'vc-tybble' }] });
    expect(r.data.frister.find(x => x.id === 'inskrivningsmeddelande')).toMatchObject({ status: 'uppfylld', paragraf: '2 kap. 3 §' });
    // Kommunen får namn, personnummer, folkbokföringsadress och beräknad utskrivning (2 kap. 2 §), inte journalen.
    await k.logga('kom-bist');
    const lista = (await k.get('/api/samverkan')).data;
    const rad = lista.find(x => x.id === r.data.id);
    expect(rad.patient).toMatchObject({ namn: 'Birgitta Nyman', personnummer: '19460119-8882' });
    const detalj = (await k.get(`/api/samverkan/${r.data.id}`)).data;
    expect(detalj.patient.adress).toContain('Örebro');
    const text = JSON.stringify(detalj);
    for (const x of ['Hjärtsvikt', 'I50', 'diagnos', 'anteckning', 'lakemedel']) expect(text).not.toContain(x);
    // En ny beräknad tidpunkt går ut av sig själv (2 kap. 4 §).
    await k.logga('lak-kard');
    const b = await k.post(`/api/samordning/${r.data.id}/beraknad`, { datum: addDagar(idag(), 6) });
    expect(b.data.beraknad).toBe(addDagar(idag(), 6));
    expect(b.data.historik[0]).toMatchObject({ typ: 'beraknad', paragraf: '2 kap. 4 § lag (2017:612)' });
    // Inskrivningsmeddelandet skickas en gång per vårdtillfälle.
    expect((await k.post('/api/patient/p06/samordning', { typ: 'spu', behov: f.behov })).status).toBe(400);
  });

  test('utskrivningsklar: underrättelsen går ut, kallelsen ska ske inom tre dagar och betalningsansvaret räknas med villkoren', async () => {
    const k = await inloggad('lak-kard');
    const d = (await k.get('/api/patient/p01/samordning')).data;
    const spu = d.samordningar.find(x => x.typ === 'spu');
    expect(spu.sipBehovs).toBe(true);
    // En sjuksköterska bedömer inte att patienten är utskrivningsklar (1 kap. 3 § 5).
    await k.logga('ssk-kard');
    expect((await k.post(`/api/samordning/${spu.id}/utskrivningsklar`, {})).status).toBe(403);
    await k.logga('lak-kard');
    const u = await k.post(`/api/samordning/${spu.id}/utskrivningsklar`, { information: 'Behöver hjälp med dusch och inköp.' });
    expect(u.status).toBe(200);
    expect(u.data.status).toBe('utskrivningsklar');
    const kallelse = u.data.frister.find(x => x.id === 'kallelse');
    expect(kallelse).toMatchObject({ paragraf: '4 kap. 3 §', status: 'kommande' });
    expect(u.data.betalning.text).toContain('5 kap. 4 §');
    expect(u.data.betalning.text).toContain('räknas inte i demon');
    // Kallelsen är inte skickad än, så villkoret i 5 kap. 3 § andra stycket är inte uppfyllt.
    expect(u.data.betalning.uppfyllda).toBe(false);
    expect(u.data.uppgifter.map(x => x.id)).toContain('plan');
  });

  test('vårdcentralen utser fast vårdkontakt och kallar till samordnad individuell planering', async () => {
    const k = await inloggad('lak-vc');
    const i = (await k.get('/api/inkorg')).data.samordning;
    const rad = i.find(x => x.patientId === 'p01');
    expect(rad.uppgifter.map(u => u.id)).toEqual(['fast_vardkontakt']);
    expect(rad.forslag.personal.id).toBe('lak-vc');
    expect((await k.post(`/api/samordning/${rad.samordningId}/kallelse`, {})).status).toBe(403);
    const f = await k.post(`/api/samordning/${rad.samordningId}/fast-vardkontakt`, {});
    expect(f.data.fastVardkontakt).toMatchObject({ id: 'lak-vc', namn: 'Per Holm' });
    // Kardiologen kan inte utse vårdcentralens fasta vårdkontakt.
    await k.logga('lak-kard');
    expect((await k.post(`/api/samordning/${rad.samordningId}/fast-vardkontakt`, {})).status).toBe(403);
    await k.post(`/api/samordning/${rad.samordningId}/utskrivningsklar`, {});
    await k.logga('lak-vc');
    const k2 = await k.post(`/api/samordning/${rad.samordningId}/kallelse`, { mote: addDagar(idag(), 1) });
    expect(k2.status).toBe(200);
    expect(k2.data.frister.find(x => x.id === 'kallelse').status).toBe('uppfylld');
    expect(k2.data.betalning.uppfyllda).toBe(true);
  });

  test('SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar', async () => {
    const k = await inloggad('lak-psyk');
    const utan = await k.post('/api/patient/p15/samordning', { typ: 'sip', insatser: [{ text: 'Boendestöd', huvudman: 'kommun' }] });
    expect(utan.status).toBe(400);
    expect(utan.data.fel).toContain('samtycker');
    const r = await k.post('/api/patient/p15/samordning', { typ: 'sip', samtycke: true, insatser: [{ text: 'Läkemedelsuppföljning', huvudman: 'region' }, { text: 'Boendestöd två gånger i veckan', huvudman: 'kommun' }], andra: 'Arbetsförmedlingen planerar arbetsträning.', overgripande: 'kommun', patientDelaktig: true, narstaende: false });
    expect(r.status).toBe(201);
    expect(r.data.plan).toMatchObject({ overgripande: 'kommun', patientDelaktig: true, insatser: [{ huvudman: 'region' }, { huvudman: 'kommun' }] });
    // Kommunen ser planen, och åtkomsten loggas med grunden samverkan.
    await k.logga('kom-bist');
    const d = (await k.get(`/api/samverkan/${r.data.id}`)).data;
    expect(d.plan.insatser.length).toBe(2);
    expect(loggRader(k, "personal_id = 'kom-bist'").at(-1)).toMatchObject({ patient_id: 'p15', handling: 'samverkan', grund: 'samverkan', resurs: `samverkan:${r.data.id}` });
    // Planen vid öppen tvångsvård (7 a § LPT) är upprättad först när kommunen har justerat den.
    await k.logga('lak-psyk');
    const s7 = await k.post('/api/patient/p22/samordning', { typ: 'lpt7a', samtycke: true, insatser: [{ text: 'Depotinjektion varannan vecka', huvudman: 'region' }, { text: 'Boendestöd', huvudman: 'kommun' }] });
    expect(s7.data.uppgifter.map(u => u.id)).toEqual([]);
    await k.logga('kom-bist');
    expect((await k.get(`/api/samverkan/${s7.data.id}`)).data.uppgifter.map(u => u.id)).toEqual(['justera']);
    expect((await k.post(`/api/samverkan/${s7.data.id}/justera`)).data.uppgifter).toEqual([]);
  });

  test('kommunen ser bara det som har skickats till den och når ingen journal', async () => {
    const k = await inloggad('kom-bist');
    for (const v of ['/api/patient/p01', '/api/patient/p01/oversikt', '/api/patient/p01/anteckningar', '/api/patient/p01/samordning', '/fhir/Patient/p01', '/api/arbetslista']) {
      const r = await k.get(v);
      if (v === '/api/arbetslista') expect(r.data).toEqual([]);
      else expect([403, 401]).toContain(r.status);
    }
    expect((await k.get('/api/sok?q=Gunnar')).status).toBe(403);
    const lista = (await k.get('/api/samverkan')).data;
    expect(lista.map(x => x.patient.namn)).toEqual(['Gunnar Åkesson']);
    expect(JSON.stringify(lista)).not.toContain('p01');
    // En planering som inte har skickats till kommunen finns inte för kommunen.
    const s = db(k);
    const id = Number(s.query("INSERT INTO samordningar (patient_id, typ, enhet_id, vardtillfalle_id, skapad, skapad_av) VALUES ('p04', 'spu', 'uso-kard-72', NULL, ?, 'lak-kard')").run(iso()).lastInsertRowid);
    s.query("INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, 'inskrivningsmeddelande', ?, 'lak-kard', 'uso-kard', ?)").run(id, iso(), JSON.stringify({ behov: { oppenvard: true }, mottagare: ['vc-tybble'] }));
    expect((await k.get(`/api/samverkan/${id}`)).status).toBe(404);
    // Personalen i regionen når inte kommunens vy.
    await k.logga('lak-kard');
    expect((await k.get('/api/samverkan')).status).toBe(403);
  });

  test('skyddad identitet: ingen adress skickas och kommunen ser inte namnet', async () => {
    const k = await inloggad('lak-kard');
    const s = db(k);
    s.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p06'").run();
    const vt = Number(s.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, orsak, inskriven_av) VALUES ('p06', 'uso-kard', ?, 'Hjärtsvikt', 'lak-kard')").run(iso()).lastInsertRowid);
    s.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, vardtillfalle_id) VALUES ('p06', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Hjärtsvikt', ?)").run(iso(), vt);
    const f = (await k.get('/api/patient/p06/samordning')).data.forslag.spu;
    expect(f).toMatchObject({ skyddad: true, adress: null });
    const r = await k.post('/api/patient/p06/samordning', { typ: 'spu', behov: f.behov });
    await k.logga('kom-bist');
    const d = (await k.get(`/api/samverkan/${r.data.id}`)).data;
    expect(d.patient).toMatchObject({ namn: 'Skyddad identitet', skyddad: true, adress: null });
    const text = JSON.stringify(d);
    for (const x of ['Nyman', 'Birgitta', '8882', 'Örebro']) expect(text).not.toContain(x);
  });

  test('informationen förs över när patienten skrivs ut, och en spärrad vårdenhets planering syns inte för andra', async () => {
    const k = await inloggad('lak-kard');
    const spu = (await k.get('/api/patient/p01/samordning')).data.samordningar.find(x => x.typ === 'spu');
    const vt = db(k).query("SELECT id FROM vardtillfallen WHERE patient_id = 'p01' AND utskriven IS NULL").get().id;
    expect((await k.post(`/api/vardtillfalle/${vt}/skriv-ut`, {})).status).toBe(200);
    const efter = (await k.get('/api/patient/p01/samordning')).data.samordningar.find(x => x.id === spu.id);
    expect(efter.status).toBe('avslutad');
    expect(efter.historik[0]).toMatchObject({ typ: 'information', paragraf: '3 kap. 2 § lag (2017:612)' });
    // En SIP från psykiatrin för Elin Sandberg, som har spärrat psykiatrin: kardiologin ser den inte, inte ens med aktivt val.
    await k.logga('lak-psyk');
    const sip = await k.post('/api/patient/p04/samordning', { typ: 'sip', samtycke: true, insatser: [{ text: 'Samtalsstöd', huvudman: 'kommun' }] });
    expect(sip.status).toBe(201);
    await k.logga('lak-kard');
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Genomgång' });
    const d = (await k.get('/api/patient/p04/samordning')).data;
    expect(d.samordningar.map(x => x.id)).not.toContain(sip.data.id);
    expect(JSON.stringify((await k.get('/api/patient/p04/oversikt')).data.r3.samordning)).not.toContain('Samtalsstöd');
  });

  test('uppföljningen av SIP och SPU räknar per vårdenhet utan personuppgifter', async () => {
    const k = await inloggad('uppf');
    const u = (await k.get('/api/uppfoljning/planer')).data;
    const kard = u.samordning.find(x => x.vardenhet.id === 'uso-kard');
    expect(kard.spu.antal).toBe('färre än 3');
    expect(kard.anmarkning).toContain('5 kap. 6 §');
    const text = JSON.stringify(u);
    for (const x of ['p01', 'Gunnar', 'Åkesson', '194502024732', 'patientId']) expect(text).not.toContain(x);
  });
});
