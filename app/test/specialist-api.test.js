// API för specialistområdena i runda 9, r3: operation, blodprodukter, graviditet, cytostatika och bilder. Flödena görs
// med demorollerna i samma sandlåda, och dubbelkontrollerna med en ny inloggning som den andra personen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { nyPatient } from './specialist.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
async function start(roll = 'lak-kard', patienter = [{ id: 'sp1', enhet: 'uso-kard-72' }]) {
  const k = klient(app);
  await k.logga(roll);
  const db = sandlada(app, k).db;
  for (const p of patienter) nyPatient(db, { ar: 1960, kon: 'K', start: new Date(), ...p });
  return { k, db };
}
const mv = (db, pid, typ, varde) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES (?, 'uso-kard-72', ?, ?, ?, ?)").run(pid, typ, String(varde), varde, new Date(Date.now() - 3600_000).toISOString());
const pnr = (db, pid) => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;

describe('API för specialistområdena', () => {
  test('operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient', async () => {
    const { k, db } = await start('lak-kard', [{ id: 'sp1', enhet: 'uso-kard-72' }, { id: 'sp2', enhet: 'uso-kard-72' }]);
    expect((await k.get('/api/patient/sp1/operation/forslag')).data.ingrepp.length).toBe(4);
    const a = await k.post('/api/patient/sp1/operation', { kva: 'JKA21', prioritet: 'inom_2_veckor' });
    expect(a.status).toBe(201);
    await k.logga('ssk-kard');
    expect((await k.get('/api/operation/vantelista')).data.vantande.map(x => x.patient.id)).toEqual(['sp1']);
    const f = await k.get(`/api/operation/${a.data.id}/planeringsforslag`);
    expect(f.data.sal.id).toBe('uso-sal-1');
    expect((await k.post(`/api/operation/${a.data.id}/planera`, {})).data.status).toBe('planerad');
    expect((await k.post(`/api/operation/${a.data.id}/okand`, {})).status).toBe(404);
    expect((await k.post(`/api/patient/sp1/operation`, { kva: 'JKA21' })).status).toBe(403);
    const datum = f.data.start.slice(0, 10);
    const o = await k.get(`/api/operation/oversikt?datum=${datum}`);
    expect(o.data.salar[0].operationer.length).toBeGreaterThanOrEqual(1);
    expect((await k.get(`/api/patient/sp1/operation`)).data.operationer[0].planering.sal.id).toBe('uso-sal-1');
    // Raden prövas på sin egen patient, så ett försök via en annan patients adress finns inte.
    const fore = db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'sp2'").get().n;
    expect((await k.get('/api/patient/sp2/operation')).data.operationer).toEqual([]);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'sp2'").get().n).toBe(fore + 1);
    expect((await k.get('/api/operation/uppfoljning')).data.vantande.antal).toBe(1);
  });

  test('blod: läkaren beställer, proverna besvaras och sjuksköterskan och läkaren kontrollerar vid sängen i var sin inloggning', async () => {
    const { k, db } = await start();
    const b = await k.post('/api/patient/sp1/blod', { produkt: 'erytrocyter', antal: 1, indikation: 'Anemi' });
    expect(b.data.status).toBe('vantar_prov');
    const labbId = db.query('SELECT labb_bestallning_id AS id FROM blod_bestallningar WHERE id = ?').get(b.data.id).id;
    for (const p of db.query('SELECT id FROM labb_prov WHERE bestallning_id = ?').all(labbId)) expect((await k.post(`/api/labb/prov/${p.id}/tagen`, {})).status).toBe(200);
    expect((await k.post(`/api/labb/${labbId}/simulera-svar`, {})).status).toBe(200);
    expect((await k.get('/api/patient/sp1/blod')).data.bestallningar[0].status).toBe('beredd');
    await k.logga('ssk-kard');
    const u = await k.post(`/api/blod/${b.data.id}/utlamna`, {});
    const e = u.data.enheter[0];
    const las = { armband: pnr(db, 'sp1'), enhetsnummer: e.enhetsnummer };
    expect((await k.post(`/api/blodenhet/${e.id}/forbered`, las)).data.kontroll.kandidater.map(x => x.id)).toContain('lak-kard');
    expect((await k.post(`/api/blodenhet/${e.id}/kontrollera`, las)).status).toBe(409);
    expect((await k.post(`/api/blodenhet/${e.id}/starta`, { kontrollant: 'lak-kard' })).status).toBe(409);
    await k.logga('lak-kard');
    expect((await k.get('/api/blod/kontroller')).data.kontroller.length).toBe(1);
    expect((await k.post(`/api/blodenhet/${e.id}/kontrollera`, las)).status).toBe(200);
    expect((await k.post(`/api/blodenhet/${e.id}/starta`, {})).data.enheter[0].status).toBe('pagar');
  });

  test('graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den', async () => {
    const { k } = await start('ssk-vc', [{ id: 'sp3', enhet: 'vc-tybble', listning: true, ar: 1994 }]);
    const sm = new Date(Date.now() - 100 * 86400_000).toISOString().slice(0, 10);
    const g = await k.post('/api/patient/sp3/graviditet', { sistaMens: sm });
    expect(g.status).toBe(201);
    expect(g.data.graviditetslangd.text).toMatch(/^v 14\+\d$/);
    const b = await k.post(`/api/graviditet/${g.data.id}/besok`, { blodtryck: '150/95', urinProtein: 1 });
    expect(b.data.varningar[0]).toContain('preeklampsi');
    expect((await k.get('/api/patient/sp3/graviditet')).data.graviditeter[0].besok.length).toBe(1);
    expect((await k.get('/api/graviditet/uppfoljning')).data.graviditeter.pagaende).toBe(1);
  });

  test('cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar', async () => {
    const { k, db } = await start();
    for (const [t, v] of [['langd', 168], ['vikt', 70], ['lpk', 6], ['tpk', 250]]) mv(db, 'sp1', t, v);
    const b = await k.post('/api/patient/sp1/cytostatika', { regim: 'ec' });
    expect(b.status).toBe(201);
    const cid = b.data.kurer[0].id;
    expect((await k.get(`/api/cytostatika/cykel/${cid}/provkontroll`)).data.ok).toBe(true);
    expect((await k.post(`/api/cytostatika/cykel/${cid}/godkann`, {})).data.kurer[0].status).toBe('godkand');
    await k.logga('ssk-kard');
    const o = await k.post(`/api/cytostatika/cykel/${cid}/bered`, {});
    const d = o.data.doser[0];
    expect((await k.get(`/api/cytostatika/cykel/${cid}/beredningsorder`)).data.doser[0].etikett).toBe(d.etikett);
    await k.post(`/api/cytostatika/dos/${d.id}/ta-emot`, { streckkod: d.etikett });
    const las = { armband: pnr(db, 'sp1'), streckkod: d.etikett };
    expect((await k.post(`/api/cytostatika/dos/${d.id}/iordningstall`, las)).data.kontroll.status).toBe('vantar_kontroll');
    expect((await k.post(`/api/cytostatika/dos/${d.id}/kontrollera`, las)).status).toBe(409);
    await k.logga('lak-kard');
    expect((await k.get('/api/cytostatika/kontroller')).data.kontroller.map(x => x.etikett)).toEqual([d.etikett]);
    expect((await k.post(`/api/cytostatika/dos/${d.id}/kontrollera`, las)).status).toBe(200);
    expect((await k.post(`/api/cytostatika/dos/${d.id}/ge`, {})).data.kurer[0].doser[0].status).toBe('given');
    expect((await k.get('/api/cytostatika/uppfoljning')).data.beredningar).toBe(2);
  });

  test('nyheten om specialistområdena visas för läkare och sjuksköterskor i den aktuella versionen, men inte för undersköterskan', async () => {
    const ids = async (roll) => {
      const k = klient(app);
      await k.logga(roll);
      const n = (await k.get('/api/nyheter')).data;
      return (n.alla.find(v => v.version === n.version)?.nyheter ?? []).map(x => x.id);
    };
    expect(await ids('lak-kard')).toEqual(expect.arrayContaining(['specialistomraden-api']));
    expect(await ids('ssk-kard')).toEqual(expect.arrayContaining(['specialistomraden-api']));
    expect(await ids('usk-kard')).not.toContain('specialistomraden-api');
  });

  test('bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning', async () => {
    const { k, db } = await start();
    const m = await k.post('/api/patient/sp1/media', { bild: { namn: 'sar.png', data: PNG }, kalla: 'kamera', kroppsstalle: 'höger häl' });
    expect(m.status).toBe(201);
    const f = await k.get(`/api/media/${m.data.id}/fil`);
    expect(f.headers.get('content-type')).toBe('image/png');
    expect(db.query('SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = ? AND resurs = ?').get('sp1', `media:${m.data.id}`).n).toBe(1);
    expect((await k.get('/api/patient/sp1/media/jamforelse?kroppsstalle=h%C3%B6ger%20h%C3%A4l')).data.bilder.length).toBe(1);
    const s = await k.post('/api/patient/sp1/media/studie', { undersokning: 'lungrontgen', fragestallning: 'Infiltrat?' });
    expect(s.data.status).toBe('bestalld');
    const p = db.query("SELECT * FROM patienter WHERE id = 'sp1'").get();
    db.query("INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES ('inv-sp1', ?, ?, ?, ?, 'sp1')").run(p.personnummer, p.fornamn, p.efternamn, p.fodd);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-sp1' })).status).toBe(200);
    const mott = await k.get('/api/min/journal/sp1/bild/mottagare');
    expect(mott.data.mottagare.map(x => x.id)).toEqual(['uso-kard']);
    const u = await k.post('/api/min/journal/sp1/bild', { enhetId: 'uso-kard', bild: { namn: 'egen.png', data: PNG } });
    expect(u.status).toBe(201);
    await k.logga('lak-kard');
    expect((await k.get('/api/media/vantande')).data.bilder.map(b => b.id)).toEqual([u.data.id]);
    expect((await k.post(`/api/media/${u.data.id}/granska`, {})).data.status).toBe('journal');
  });
});
