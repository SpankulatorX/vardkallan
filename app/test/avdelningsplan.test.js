import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, lokalTid } from '../src/db.js';
import { tolkaTyp, forslag } from '../src/avdelningsplan.js';

// Planerade händelser på avdelningen och en resurs planering (runda 8, r3, Sussa 3.4.1.6, 3.4.1.8 och 3.1.2.2,
// testfall 7.1 till 7.4). Allt som är planerat för patienterna samlas i en vy, och varje patient prövas i
// behörighetsmotorn.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const avdelning = async (roll) => {
  const k = await inloggad(roll);
  expect((await k.post('/api/demo/sussa-testfall')).status).toBe(200);
  expect((await k.post('/api/demo/sussa-avdelning')).status).toBe(200);
  return k;
};
const kl = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const vid = (dag, namn, klocka) => dag.patienter.find(p => p.patient.namn === namn)?.handelser.filter(h => kl(h.tid) === klocka).map(h => h.text) ?? [];
const P = '';

describe('Avdelningens planering', () => {
  test(`${P}dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2)`, async () => {
    const k = await avdelning('ssk-kard');
    const d = (await k.get('/api/avdelning/planering')).data;
    expect(d.avdelning).toMatchObject({ id: 'uso-kard-72' });
    expect(vid(d, 'Bertil Danielsson', '11:00')).toContain('Provtagning, blodprover');
    expect(vid(d, 'Henrik Lundin', '11:00')).toContain('Sjukgymnastik');
    expect(vid(d, 'Gerda Ström', '11:00')).toContain('Dricka kontrast');
    expect(vid(d, 'Elin Arnström', '11:00')).toContain('Börja fasta');
    expect(vid(d, 'Trevis Ljung', '11:00')).toContain('Såromläggning');
    expect(vid(d, 'Berit Strandhall', '11:00')).toContain('Teamrond med onkologen');
    const bertil = d.patienter.find(p => p.patient.id === 'sus01');
    expect(bertil.handelser.some(h => h.typ === 'lakemedel' && h.text.includes('Paracetamol'))).toBe(true);
    const sjg = d.patienter.find(p => p.patient.id === 'sus08').handelser.find(h => h.text === 'Sjukgymnastik');
    expect(sjg).toMatchObject({ typ: 'sjukgymnastik', yrkeText: 'Fysioterapeut', status: 'planerad' });
    // Varje patient som visas loggas.
    const logg = db(k).query("SELECT DISTINCT patient_id FROM atkomstlogg WHERE handling = 'las_planering' AND personal_id = 'ssk-kard'").all().map(r => r.patient_id);
    for (const p of d.patienter) expect(logg).toContain(p.patient.id);
    // Undersköterskan och fysioterapeuten ser samma avdelning.
    for (const roll of ['usk-kard', 'fys-kard', 'lak-kard']) {
      const k2 = await inloggad(roll);
      expect((await k2.post('/api/demo/sussa-avdelning')).status).toBe(200);
      const d2 = (await k2.get('/api/avdelning/planering')).data;
      expect(d2.avdelning.id).toBe('uso-kard-72');
      expect(vid(d2, 'Henrik Lundin', '11:00')).toContain('Sjukgymnastik');
    }
  });

  test(`${P}patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4)`, async () => {
    const k = await avdelning('lak-kard');
    const p = (await k.get('/api/patient/sus01/planering')).data;
    const dag = p.dagar.find(x => x.datum === idag());
    // Runda 9, r3: läkemedelsdoser som seeden lägger relativt till klockan kan också hamna klockan 15, så testet
    // prövar bara att EKG:t finns där (testet blev rött beroende på tiden på dygnet).
    expect(dag.handelser.filter(h => kl(h.tid) === '15:00').map(h => h.text)).toContain('EKG');
    expect(p.dagar.length).toBe(7);
    expect(p.dagar.flatMap(x => x.handelser).some(h => h.text === 'Sutur ut' && h.status === 'utford')).toBe(true);
    const r = (await k.get('/api/resurs/ol-kard/planering')).data;
    expect(r.person.namn).toBe('Göran Malm');
    expect(r.dagar.length).toBe(7);
    const i = r.dagar.find(x => x.datum === idag()).handelser.filter(h => kl(h.tid) === '11:00');
    expect(i.map(h => h.text)).toContain('Infektionskonsult med infektionsläkaren');
    expect(i.find(h => h.text.startsWith('Infektionskonsult')).patient).toMatchObject({ namn: 'Inga Strand' });
    // En person på en annan vårdenhet går inte att visa.
    expect((await k.get('/api/resurs/lak-vc/planering')).status).toBe(404);
    // Läkaren på vårdcentralen har ingen vårdrelation till patienten. Sussas testdata ger vårdcentralen vårdrelation till
    // de flesta av Sussas patienter, men inte till Berit Strandhall (sus16).
    const vc = await inloggad('lak-vc');
    sandlada(app, vc).db = db(k);
    expect((await vc.get('/api/patient/sus16/planering')).status).toBe(403);
    expect((await vc.get('/api/avdelning/planering?enhet=uso-kard-72')).status).toBe(403);
    // Vårdadministratören ser inte avdelningens planering.
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/avdelning/planering')).status).toBe(403);
  });

  test(`${P}i en persons planering visas en uppgift för en patient utan vårdrelation bara som upptagen tid, utan text, enhet eller andra uppgifter`, async () => {
    const k = await avdelning('lak-kard');
    const d = db(k);
    const hamta = async () => (await k.get('/api/resurs/ol-kard/planering')).data;
    const fore = await hamta();
    d.query("INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd) VALUES ('pz9', '189001019802', 'Demo', 'Utanför', 'K', '1890-01-01')").run();
    const start = lokalTid(idag(), '10:10');
    d.query(`INSERT INTO planerade_uppgifter (patient_id, enhet_id, typ, text, start, slut, yrke, ansvarig_id, skapad)
      VALUES ('pz9', 'uso-kard-72', 'samtal', 'Hemligt samtal om diagnosen', ?, ?, 'lakare', 'ol-kard', ?)`).run(start, lokalTid(idag(), '10:40'), start);
    const efter = await hamta();
    const json = JSON.stringify(efter);
    expect(json).not.toContain('Hemligt');
    expect(json).not.toContain('Utanför');
    const rad = efter.dagar.find(x => x.datum === idag()).handelser.find(h => h.tid === start);
    expect(rad).toEqual({ id: expect.any(String), tid: start, slut: lokalTid(idag(), '10:40'), typ: 'upptagen', typText: 'Upptagen', text: 'Upptagen', patient: null });
    // Det enda som skiljer svaret med och utan raden är den upptagna tiden.
    const utan = (x) => JSON.stringify({ ...x, dagar: x.dagar.map(dg => ({ ...dg, handelser: dg.handelser.filter(h => h.typ !== 'upptagen') })) });
    expect(utan(efter)).toBe(utan(fore));
  });

  test(`${P}systemet avgör typ, yrkesroll, längd och tid ur texten när en uppgift planeras, och undersköterskan registrerar att den är utförd`, async () => {
    expect(tolkaTyp('Omläggning av sår')).toBe('omlaggning');
    expect(tolkaTyp('Sjukgymnastik, gångträning')).toBe('sjukgymnastik');
    expect(tolkaTyp('Teamrond med onkologen')).toBe('teamrond');
    expect(tolkaTyp('Infektionskonsult')).toBe('konsult');
    expect(tolkaTyp('EKG')).toBe('undersokning');
    expect(tolkaTyp('Börja fasta')).toBe('forberedelse');
    const f = forslag('Omläggning av sår', new Date('2026-03-02T09:20:00Z'));
    expect(f).toMatchObject({ typ: 'omlaggning', yrke: 'sjukskoterska', minuter: 30, start: '2026-03-02T10:00:00.000Z' });
    const k = await avdelning('ssk-kard');
    const start = lokalTid(idag(), '23:30');
    const r = await k.post('/api/patient/sus04/planering', { text: 'Omläggning av sår på vänster ben', start });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ typ: 'omlaggning', yrkeText: 'Sjuksköterska', status: 'planerad' });
    expect(r.data.besked).toContain('är planerad klockan 23.30');
    expect((await k.post('/api/patient/sus04/planering', { text: '' })).status).toBe(400);
    expect((await k.post('/api/patient/sus04/planering', { text: 'Samtal', ansvarigId: 'lak-vc' })).status).toBe(400);
    // Helene Lund har varit på mottagningen men är inte inskriven, och Marianne Hägg har ingen vårdrelation.
    expect((await k.post('/api/patient/sus11/planering', { text: 'Samtal' })).status).toBe(400);
    expect((await k.post('/api/patient/sus26/planering', { text: 'Samtal' })).status).toBe(403);
    const usk = await inloggad('usk-kard');
    sandlada(app, usk).db = db(k);
    expect((await usk.post('/api/patient/sus04/planering', { text: 'Dusch' })).status).toBe(403);
    const u = await usk.post(`/api/planerad-uppgift/${r.data.uppgiftId}/utford`, {});
    expect(u.status).toBe(200);
    expect(u.data).toMatchObject({ status: 'utford', utfordAv: { id: 'usk-kard' } });
    expect((await k.post(`/api/planerad-uppgift/${r.data.uppgiftId}/stryk`, { orsak: 'Fel' })).status).toBe(400);
    const r2 = await k.post('/api/patient/sus04/planering', { text: 'Sjukgymnastik', start });
    expect((await k.post(`/api/planerad-uppgift/${r2.data.uppgiftId}/stryk`, {})).status).toBe(400);
    expect((await k.post(`/api/planerad-uppgift/${r2.data.uppgiftId}/stryk`, { orsak: 'Patienten är trött' })).data.status).toBe('struken');
    expect(() => db(k).query('DELETE FROM planerade_uppgifter WHERE id = ?').run(r2.data.uppgiftId)).toThrow();
  });

  test(`${P}en bokad tid på en annan vårdenhet syns inte utan aktivt val, och svaret är detsamma med och utan den`, async () => {
    const k = await avdelning('ssk-kard');
    const fore = JSON.stringify((await k.get('/api/avdelning/planering')).data);
    const d = db(k);
    const t = d.query("INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES ('sch-vc-per', ?, ?, 'aterbesok', 1, NULL, 0)").run(lokalTid(idag(), '12:40'), lokalTid(idag(), '13:10')).lastInsertRowid;
    d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad, orsak) VALUES ('sus01', ?, 'bokad', ?, 'Hemligt besök')").run(t, new Date().toISOString());
    const efter = JSON.stringify((await k.get('/api/avdelning/planering')).data);
    expect(efter).toBe(fore);
    expect(efter).not.toContain('Vårdcentralen Tybble');
    // En spärr på vårdcentralen döljer den också efter aktivt val.
    d.query("INSERT INTO sparrar (patient_id, enhet_id, aktiv, registrerad) VALUES ('sus01', 'vc-tybble', 1, ?)").run(new Date().toISOString());
    expect((await k.post('/api/patient/sus01/val', { typ: 'andra_enheter', syfte: 'Planeringen av vården' })).status).toBe(200);
    expect(JSON.stringify((await k.get('/api/avdelning/planering')).data)).not.toContain('Vårdcentralen Tybble');
    const p = JSON.stringify((await k.get('/api/patient/sus01/planering')).data);
    expect(p).not.toContain('Vårdcentralen Tybble');
  });
});
