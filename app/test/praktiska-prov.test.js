// Runda 12, r3 (Sussa 10.1.1.5): praktiska prov i journalen. Testnamnen används i mappningen (sussa/mappning/10.1.js).
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, personal } from './hjalp.js';
import * as prov from '../src/praktiska-prov.js';
import { idag, addDagar } from '../src/db.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

// En session där Johan Ek (utbildare på kardiologen) skapar provet och Sara Lindqvist gör det.
async function medProv(typ) {
  const k = klient(app);
  await k.logga('ssk-kard');
  const r = await k.post('/api/utbildning/prov', { typ });
  expect(r.status).toBe(201);
  return k;
}
const provId = (o, typ) => o.prov.find(p => p.typ === typ)?.id;

describe('Praktiska prov', () => {
  test('utbildaren och verksamhetschefen skapar praktiska prov för vårdenheten, och den som inte är utbildare får inte', async () => {
    const k = await medProv('ordinera_vid_behov');
    const o = (await k.get('/api/utbildning/prov')).data;
    expect(o.utbildare).toBe(true);
    expect(o.provtyper.map(t => t.typ)).toEqual(['ordinera_vid_behov', 'signera_anteckning', 'registrera_blodtryck']);
    expect(o.uppfoljning.map(u => u.typ)).toEqual(['ordinera_vid_behov']);
    // Samma prov två gånger och en okänd typ godtas inte.
    expect((await k.post('/api/utbildning/prov', { typ: 'ordinera_vid_behov' })).status).toBe(400);
    expect((await k.post('/api/utbildning/prov', { typ: 'constructor' })).status).toBe(400);
    await k.logga('lak-kard');
    expect((await k.get('/api/utbildning/prov')).data.utbildare).toBe(false);
    expect((await k.post('/api/utbildning/prov', { typ: 'signera_anteckning' })).status).toBe(403);
    await k.logga('vch-kard');
    expect((await k.post('/api/utbildning/prov', { typ: 'signera_anteckning' })).status).toBe(201);
  });

  test('läkaren gör provet i en övningsjournal som systemet väljer, och systemet kontrollerar ordinationen i journalen', async () => {
    const k = await medProv('ordinera_vid_behov');
    await k.logga('lak-kard');
    let o = (await k.get('/api/utbildning/prov')).data;
    const id = provId(o, 'ordinera_vid_behov');
    expect(o.prov.find(p => p.id === id).status).toBe('ej_paborjat');
    o = (await k.post(`/api/utbildning/prov/${id}/starta`)).data;
    const p = o.prov.find(x => x.id === id);
    expect(p.status).toBe('pagar');
    expect(p.uppgift).toContain('paracetamol vid behov');
    const [, pid] = p.lank.match(/^#\/patient\/([\w-]+)\/lakemedel$/);
    // Ingenting gjort än: systemet säger vad som saknas.
    let r = (await k.post(`/api/utbildning/prov/${id}/kontrollera`)).data;
    expect(r.godkant).toBe(false);
    expect(r.text).toContain('ingen ordination');
    // Ett annat läkemedel godkänns inte.
    const kat = (await k.get('/api/lakemedel/katalog?q=alvedon')).data;
    const para = kat.find(x => /paracetamol/i.test(x.substans ?? x.namn));
    const ord = { lakemedelId: para.id, dosering: '1 g vid behov, högst 4 g per dygn', typ: 'vid_behov', vidBehov: true, ordinationsorsak: 'Smärta', uppfoljningsdatum: addDagar(idag(), 7) };
    const sparad = await k.post(`/api/patient/${pid}/lakemedel`, ord);
    const kv = sparad.status === 400 && sparad.data.kraverKvittens ? await k.post(`/api/patient/${pid}/lakemedel`, { ...ord, kvitteradeVarningar: sparad.data.kraverKvittens.map(regel => ({ regel, motivering: 'Prövat i det praktiska provet.' })) }) : sparad;
    expect(kv.status).toBe(201);
    r = (await k.post(`/api/utbildning/prov/${id}/kontrollera`)).data;
    expect(r.godkant).toBe(true);
    expect(r.prov.find(x => x.id === id)).toMatchObject({ status: 'godkant' });
    expect(r.prov.find(x => x.id === id).giltigtTill).toBeTruthy();
    // Valet av övningsjournal loggas som en åtkomst med vårdrelation.
    const logg = sandlada(app, k).db.query("SELECT * FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = ? AND resurs = 'praktiskt-prov'").all(pid);
    expect(logg.length).toBe(1);
    expect(logg[0].grund).toBe('vardrelation');
  });

  test('en anteckning som inte är signerad godkänns inte, och en signerad anteckning godkänns', async () => {
    const k = await medProv('signera_anteckning');
    await k.logga('lak-kard');
    const id = provId((await k.get('/api/utbildning/prov')).data, 'signera_anteckning');
    const p = (await k.post(`/api/utbildning/prov/${id}/starta`)).data.prov.find(x => x.id === id);
    const pid = p.lank.split('/')[2];
    const ny = await k.post(`/api/patient/${pid}/anteckningar`, { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Praktiskt prov.' }] });
    expect(ny.status).toBe(201);
    let r = (await k.post(`/api/utbildning/prov/${id}/kontrollera`)).data;
    expect(r.godkant).toBe(false);
    expect(r.text).toContain('inte signerad');
    expect((await k.post(`/api/anteckning/${ny.data.id}/signera`)).status).toBe(200);
    r = (await k.post(`/api/utbildning/prov/${id}/kontrollera`)).data;
    expect(r.godkant).toBe(true);
    // Ett godkänt prov kontrolleras inte igen.
    expect((await k.post(`/api/utbildning/prov/${id}/kontrollera`)).status).toBe(400);
  });

  test('utbildaren följer upp vem som har klarat provet utan att se vilken patient provet gjordes på', async () => {
    const k = await medProv('registrera_blodtryck');
    await k.logga('usk-kard');
    const id = provId((await k.get('/api/utbildning/prov')).data, 'registrera_blodtryck');
    const p = (await k.post(`/api/utbildning/prov/${id}/starta`)).data.prov.find(x => x.id === id);
    const pid = p.lank.split('/')[2];
    expect((await k.post(`/api/patient/${pid}/matvarden`, { typ: 'blodtryck', varde: '128/82' })).status).toBe(201);
    expect((await k.post(`/api/utbildning/prov/${id}/kontrollera`)).data.godkant).toBe(true);
    await k.logga('ssk-kard');
    const o = (await k.get('/api/utbildning/prov')).data;
    const u = o.uppfoljning.find(x => x.id === id);
    expect(u.personer.find(x => x.id === 'usk-kard').status).toBe('godkant');
    expect(u.godkanda).toBe(1);
    expect(u.personer.some(x => x.id === 'lak-kard')).toBe(false);
    const text = JSON.stringify(o.uppfoljning);
    const pat = sandlada(app, k).db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
    expect(text).not.toContain(pid);
    expect(text).not.toContain(pat.efternamn);
    // Ett prov för en annan yrkesroll syns inte, och en annan vårdenhets utbildare ser inte uppföljningen.
    await k.logga('lak-kard');
    expect((await k.get('/api/utbildning/prov')).data.prov.some(x => x.id === id)).toBe(false);
    expect((await k.post(`/api/utbildning/prov/${id}/starta`)).status).toBe(404);
    expect((await k.post(`/api/utbildning/prov/${id}/avsluta`)).status).toBe(404);
  });

  test('systemet väljer en övningsjournal som personen har vårdrelation till, aldrig en skyddad patient, och ett godkänt prov gäller i ett år', () => {
    const db = nyDb();
    const nu = new Date('2026-11-12T10:00:00Z');
    prov.skapa(db, personal(db, 'ssk-kard'), 'registrera_blodtryck', { nu });
    const usk = personal(db, 'usk-kard');
    const id = prov.oversikt(db, usk, { nu }).prov[0].id;
    const startad = prov.starta(db, usk, id, { nu });
    const pid = startad.prov[0].lank.split('/')[2];
    expect(db.query('SELECT skyddad FROM patienter WHERE id = ?').get(pid).skyddad).toBe(0);
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, tid, registrerad_av) VALUES (?, 'uso-kard-72', 'blodtryck', '120/80', ?, 'usk-kard')").run(pid, nu.toISOString());
    expect(prov.kontrollera(db, usk, id, { nu }).godkant).toBe(true);
    const omEttAr = new Date(nu.getTime() + 366 * 86400_000);
    expect(prov.oversikt(db, usk, { nu: omEttAr }).prov[0].status).toBe('utgatt');
    expect(prov.oversikt(db, usk, { nu: new Date(nu.getTime() + 300 * 86400_000) }).prov[0].status).toBe('godkant');
  });
});
