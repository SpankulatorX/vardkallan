import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';

// Vårdplaner (Sussa 3.2.2.1 och 3.2.2.2): standardplaner som systemet föreslår ur diagnos och sammanhang, individuella
// planer med mål, åtgärder, ansvarig och uppföljningsdatum, bevakning av uppföljningen och avvikelser.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;

describe('Vårdplan', () => {
  test('systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick', async () => {
    const k = await inloggad('lak-kard');
    const o = (await k.get('/api/patient/p01/oversikt')).data.r3.vardplaner;
    const f = o.forslag.find(x => x.mall === 'hjartsvikt');
    expect(f.varfor).toContain('Vänsterhjärtsvikt (I50.1)');
    // Gunnar är 81 år och inneliggande: förebyggande av trycksår och fall föreslås också, med skälet.
    expect(o.forslag.find(x => x.mall === 'fall').varfor).toContain('81 år');
    const r = await k.post('/api/patient/p01/vardplaner', { mall: 'hjartsvikt' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ rubrik: 'Hjärtsvikt', standard: true, status: 'aktiv', uppfoljning: addDagar(idag(), 7), enhet: { id: 'uso-kard' }, skapadAv: { id: 'lak-kard' } });
    expect(r.data.atgarder.find(a => a.text.startsWith('Daglig vikt'))).toMatchObject({ ansvarig: 'underskoterska', dagligen: true });
    expect(r.data.mal.length).toBe(3);
    // Förslaget visas inte igen när planen finns.
    expect(db(k).query('SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1').get()).toMatchObject({ handling: 'vardplan', patient_id: 'p01', resurs: `vardplan:${r.data.id}:upprattad` });
    expect((await k.get('/api/patient/p01/oversikt')).data.r3.vardplaner.forslag.some(x => x.mall === 'hjartsvikt')).toBe(false);
  });

  test('en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas', async () => {
    const k = await inloggad('ssk-kard');
    expect((await k.post('/api/patient/p01/vardplaner', { rubrik: 'Smärta', mal: [] })).status).toBe(400);
    expect((await k.post('/api/patient/p01/vardplaner', { rubrik: 'Smärta', mal: ['Smärtfri'], atgarder: [{ text: 'Smärtskattning', ansvarig: 'kock' }] })).status).toBe(400);
    const r = await k.post('/api/patient/p01/vardplaner', { rubrik: 'Smärta efter elkonvertering', mal: ['Patienten skattar smärtan högst 3'], atgarder: [{ text: 'Smärtskattning morgon och kväll', ansvarig: 'sjukskoterska', dagligen: true }], uppfoljning: addDagar(idag(), 2) });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ standard: false, uppfoljning: addDagar(idag(), 2) });
    const id = r.data.id;
    const m = await k.post(`/api/vardplan/${id}/mal`, { text: 'Patienten sover hela natten' });
    expect(m.data.mal.length).toBe(2);
    const x = await k.post(`/api/vardplan/${id}/atgard`, { text: 'Lägesändring vid behov', ansvarig: 'underskoterska' });
    expect(x.data.atgarder.map(a => a.ansvarigText)).toEqual(['Sjuksköterska', 'Undersköterska']);
    const t = await k.post(`/api/vardplan/${id}/ta-bort`, { atgard: x.data.atgarder[1].id });
    expect(t.data.atgarder.length).toBe(1);
    expect(t.data.historik.map(h => h.typ)).toEqual(['andrad', 'andrad', 'andrad', 'upprattad']);
  });

  test('åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena', async () => {
    const k = await inloggad('lak-kard');
    const p = (await k.post('/api/patient/p01/vardplaner', { mall: 'hjartsvikt' })).data;
    const vikt = p.atgarder.find(a => a.text.startsWith('Daglig vikt'));
    const vatska = p.atgarder.find(a => a.text.startsWith('Vätskelista'));
    await k.logga('usk-kard');
    const usk = k;
    expect((await usk.post(`/api/vardplan/${p.id}/utfort`, { atgard: vatska.id })).status).toBe(403);
    expect(db(usk).query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'usk-kard' ORDER BY id DESC LIMIT 1").get().resultat).toBe('nekad');
    const ok = await usk.post(`/api/vardplan/${p.id}/utfort`, { atgard: vikt.id });
    expect(ok.status).toBe(200);
    expect(ok.data.atgarder.find(a => a.id === vikt.id)).toMatchObject({ utfordAv: { id: 'usk-kard' }, utfordAvSystemet: false });
    // När vikten registreras som mätvärde ser systemet själv att åtgärden är gjord.
    await usk.post('/api/patient/p01/matvarden', { typ: 'vikt', varde: '79.4' });
    const efter = (await usk.get('/api/patient/p01/vardplaner')).data.planer.find(x => x.id === p.id);
    expect(efter.atgarder.find(a => a.id === vikt.id).utfordAvSystemet).toBe(true);
    expect(efter.kan.utfora).toEqual([vikt.id]);
  });

  test('uppehåll, återupptagning, uppföljning och avslutning sparas i historiken, som inte kan ändras', async () => {
    const k = await inloggad('lak-kard');
    const p = (await k.post('/api/patient/p01/vardplaner', { mall: 'trycksar' })).data;
    expect((await k.post(`/api/vardplan/${p.id}/pausa`, {})).status).toBe(400);
    expect((await k.post(`/api/vardplan/${p.id}/pausa`, { orsak: 'Patienten är på röntgen hela dagen' })).data.status).toBe('pausad');
    expect((await k.post(`/api/vardplan/${p.id}/utfort`, { atgard: p.atgarder[0].id })).status).toBe(400);
    expect((await k.post(`/api/vardplan/${p.id}/ateruppta`)).data.status).toBe('aktiv');
    expect((await k.post(`/api/vardplan/${p.id}/uppfoljning`, { mal: { [p.mal[0].id]: 'uppnatt' } })).status).toBe(400);
    const u = await k.post(`/api/vardplan/${p.id}/uppfoljning`, { mal: { [p.mal[0].id]: 'uppnatt', [p.mal[1].id]: 'ej_uppnatt' }, kommentar: 'Äter dåligt.' });
    expect(u.data.mal.map(m => m.statusText)).toEqual(['Uppnått', 'Inte uppnått']);
    expect(u.data.uppfoljning).toBe(addDagar(idag(), 3));
    expect(u.data.avvikelser.some(a => a.typ === 'mal')).toBe(true);
    const a = await k.post(`/api/vardplan/${p.id}/avsluta`, { kommentar: 'Utskriven.' });
    expect(a.data.status).toBe('avslutad');
    expect(a.data.historik.map(h => h.typ)).toEqual(['avslutad', 'uppfoljning', 'aterupptagen', 'pausad', 'upprattad']);
    expect((await k.post(`/api/vardplan/${p.id}/mal`, { text: 'x' })).status).toBe(400);
    expect(() => db(k).query('UPDATE vardplan_historik SET text = ?').run('x')).toThrow('Vårdplanens historik ändras inte');
    expect(() => db(k).query('DELETE FROM vardplaner').run()).toThrow('En vårdplan raderas inte');
  });

  test('avvikelser från planen visas i översikten och uppföljningen bevakas i inkorgen', async () => {
    const k = await inloggad('ssk-kard');
    // Seeden: Elin Sandbergs plan för förebyggande av fall skulle ha följts upp i går.
    const o = (await k.get('/api/patient/p04/oversikt')).data.r3.vardplaner;
    const plan = o.planer.find(p => p.rubrik === 'Förebyggande av fall');
    expect(plan.avvikelser).toBeGreaterThan(0);
    const i = (await k.get('/api/inkorg')).data.vardplanerUppfoljning;
    expect(i.find(x => x.patientId === 'p04')).toMatchObject({ rubrik: 'Förebyggande av fall', uppfoljning: addDagar(idag(), -1), patient: { namn: 'Elin Sandberg' } });
    const d = (await k.get('/api/patient/p04/vardplaner')).data.planer.find(p => p.id === plan.id);
    expect(d.avvikelser.map(a => a.typ)).toEqual(expect.arrayContaining(['uppfoljning', 'atgard']));
    // En läkare på en annan vårdenhet får ingen rad.
    const vc = await inloggad('lak-vc');
    expect((await vc.get('/api/inkorg')).data.vardplanerUppfoljning).toEqual([]);
  });

  test('inre sekretess, spärr och nödåtkomst gäller vårdplanerna', async () => {
    const k = await inloggad('lak-psyk');
    // Psykiatrin är spärrad för Elin Sandberg på andra vårdenheter, och kardiologins plan syns inte för psykiatrin utan aktivt val.
    const p = (await k.get('/api/patient/p04/vardplaner')).data;
    expect(p.planer).toEqual([]);
    const plan = db(k).query("SELECT id FROM vardplaner WHERE patient_id = 'p04'").get().id;
    expect((await k.post(`/api/vardplan/${plan}/mal`, { text: 'x' })).status).toBe(403);
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Samordning av vården' });
    const efter = (await k.get('/api/patient/p04/vardplaner')).data.planer;
    expect(efter.length).toBe(1);
    // Den som ser planen genom ett aktivt val kan inte ändra den.
    expect(efter[0].kan).toEqual({ andra: false, utfora: [] });
    expect((await k.post(`/api/vardplan/${plan}/mal`, { text: 'x' })).status).toBe(403);
    // En plan på psykiatrin syns inte för kardiologin, inte ens med aktivt val, eftersom psykiatrin är spärrad.
    const egen = await k.post('/api/patient/p04/vardplaner', { rubrik: 'Psykiatrisk plan', mal: ['Stabil sömn'], atgarder: [{ text: 'Sömnregistrering', ansvarig: 'sjukskoterska' }] });
    expect(egen.status).toBe(201);
    const kard = k;
    await kard.logga('lak-kard');
    await kard.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Genomgång' });
    const kv = (await kard.get('/api/patient/p04/vardplaner')).data.planer;
    expect(kv.map(x => x.rubrik)).toEqual(['Förebyggande av fall']);
    // Nödåtkomst ger bara läsning.
    const vc = k;
    await vc.logga('lak-vc');
    await vc.post('/api/patient/p21/val', { typ: 'nodatkomst', syfte: 'Akut läge, kan inte samtycka' });
    expect((await vc.post('/api/patient/p21/vardplaner', { mall: 'fall' })).status).toBe(403);
    // Vårdadministratören ser inga vårdplaner.
    const adm = await inloggad('adm-kard');
    expect((await adm.get('/api/patient/p01/vardplaner')).status).toBe(403);
  });

  test('tvångsvården föreslår vårdplanen enligt 16 § och uppgiften försvinner när planen finns', async () => {
    const k = await inloggad('lak-psyk');
    const f = (await k.get('/api/patient/p22/vardplaner')).data.forslag.find(x => x.mall === 'lpt');
    expect(f.varfor).toContain('16 § LPT');
    const fore = (await k.get('/api/patient/p22/tvangsvard')).data.perioder.find(p => p.status === 'sluten');
    expect(fore.uppgifter.some(u => u.id === 'vardplan')).toBe(true);
    expect((await k.post('/api/patient/p22/vardplaner', { mall: 'lpt' })).status).toBe(201);
    const efter = (await k.get('/api/patient/p22/tvangsvard')).data.perioder.find(p => p.status === 'sluten');
    expect(efter.uppgifter.some(u => u.id === 'vardplan')).toBe(false);
  });
  test('FHIR: vårdplanen är en CarePlan med samma behörighet och loggning, och invånaren får den inte', async () => {
    const k = await inloggad('lak-kard');
    const p = (await k.post('/api/patient/p01/vardplaner', { mall: 'hjartsvikt' })).data;
    const b = (await k.get('/fhir/CarePlan?patient=p01')).data;
    const cp = b.entry.find(e => e.resource.id === String(p.id)).resource;
    expect(cp).toMatchObject({ resourceType: 'CarePlan', status: 'active', intent: 'plan', title: 'Hjärtsvikt', subject: { reference: 'Patient/p01' } });
    expect(cp.activity[0].detail.description).toContain('Ansvarig: undersköterska');
    expect(cp.description).toContain('Mål:');
    expect((await k.get(`/fhir/CarePlan/${p.id}`)).status).toBe(200);
    expect(db(k).query('SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1').get()).toMatchObject({ handling: 'las_vardplan', resurs: `fhir/CarePlan/${p.id}` });
    // Psykiatrins plan för Elin Sandberg syns inte för kardiologin, eftersom psykiatrin är spärrad.
    await k.logga('lak-psyk');
    const psyk = (await k.post('/api/patient/p04/vardplaner', { rubrik: 'Sömn', mal: ['Sover'], atgarder: [{ text: 'Sömnregistrering', ansvarig: 'sjukskoterska' }] })).data;
    await k.logga('lak-kard');
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Genomgång' });
    expect(JSON.stringify((await k.get('/fhir/CarePlan?patient=p04')).data)).not.toContain('Sömn');
    expect((await k.get(`/fhir/CarePlan/${psyk.id}`)).status).toBe(403);
    // Min journal visar inte vårdplaner, så invånaren får dem inte i FHIR.
    const inv = klient(app);
    await inv.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect((await inv.get('/fhir/CarePlan?patient=p01')).status).toBe(404);
  });
});
