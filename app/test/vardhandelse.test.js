import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import * as tidbok from '../src/tidbok.js';

// Planerad vårdhändelse i tidboken (Sussa 3.5.2.7 och 3.5.2.14). Systemet är experten: läkaren väljer en bokning med ett
// klick eller låter systemet sätta upp vårdhändelsen på väntelistan, och när tiden bokas, bokas om eller avbokas räknar
// systemet om när läkemedlet ska ges utan att någon gör något.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const elkonvertering = (k) => db(k).query("SELECT * FROM bokningar WHERE patient_id = 'p01' AND orsak = 'Elkonvertering' AND status = 'bokad'").get();
const start = (k, b) => db(k).query('SELECT start FROM tider WHERE id = ?').get(b.tid_id).start;
const timmar = (iso, h) => new Date(Date.parse(iso) + h * 3600_000).toISOString();
const antalOrdinationer = (k) => db(k).query('SELECT count(*) AS n FROM ordinationer').get().n;

// Omeprazol utan fasta tider. Allvarliga varningar kvitteras, eftersom testet gäller vårdhändelsen.
async function ordinera(k, pid, vardhandelse, extra = {}) {
  const bas = { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel före ingreppet', dos: 20, dosEnhet: 'mg', typ: 'tillfallig', tider: [], ordinationsorsak: 'Inför elkonvertering', uppfoljningsdatum: addDagar(idag(), 30), vardhandelse, ...extra };
  let r = await k.post(`/api/patient/${pid}/lakemedel`, bas);
  if (r.status === 400 && r.data.varningar) r = await k.post(`/api/patient/${pid}/lakemedel`, { ...bas, kvitteradeVarningar: r.data.kraverKvittens.map(regel => ({ regel, motivering: 'Bedömt i samband med ingreppet' })) });
  return r;
}

describe('Vårdhändelse i tidboken', () => {
  test('systemet föreslår patientens bokningar på den egna vårdenheten och den som passar ordinationen först', async () => {
    const k = await inloggad('lak-kard');
    const b = elkonvertering(k);
    expect(b).toBeTruthy();
    const r = await k.get('/api/patient/p01/vardhandelse/forslag?text=Inför%20elkonvertering');
    expect(r.status).toBe(200);
    expect(r.data.bokningar[0]).toMatchObject({ id: b.id, text: 'Elkonvertering', start: start(k, b), rekommenderad: true });
    // Gruppträffar är inga vårdhändelser, och väntande poster på väntelistan föreslås också.
    expect(r.data.bokningar.some(x => x.tidstyp === 'grupp')).toBe(false);
    expect(r.data.vantelista.map(v => v.text)).toContain('Återbesök efter vårdtillfället');
    expect(r.data.ny).toMatchObject({ mojlig: true });
    // Bara en bokning är rekommenderad.
    expect([...r.data.bokningar, ...r.data.vantelista].filter(x => x.rekommenderad).length).toBe(1);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p01', handling: 'ordinera', resultat: 'tillaten' });
  });

  test('ordinationen får sin tid från bokningen med ett klick, och sjuksköterskan ser när läkemedlet ges', async () => {
    const k = await inloggad('lak-kard');
    const b = elkonvertering(k);
    const r = await ordinera(k, 'p01', { bokningId: b.id, forskjutningTimmar: -2, text: 'Något annat som klienten skickar' });
    expect(r.status).toBe(201);
    // Texten kommer från bokningen, inte från klienten, och tiden räknas av systemet.
    expect(r.data.ordination.vardhandelse).toMatchObject({ text: 'Elkonvertering', forskjutningMin: -120, tid: start(k, b), administreras: timmar(start(k, b), -2), foljerTidbok: true, lage: 'bokad' });
    expect(r.data.ordination.vardhandelse.forklaring).toContain('Tiden kommer från tidboken');
    const id = r.data.ordination.id;
    const historik = db(k).query('SELECT handelse FROM ordination_historik WHERE ordination_id = ? ORDER BY id').all(id).map(h => h.handelse);
    expect(historik).toEqual(expect.arrayContaining(['Vårdhändelsen knöts till tidboken', 'Vårdhändelsen fick en tid i tidboken']));
    await k.logga('ssk-kard');
    const l = (await k.get('/api/patient/p01/administreringar')).data;
    expect(l.vantarPaHandelse.some(x => x.ordinationId === id)).toBe(false);
    expect(l.kommandeHandelser.find(x => x.ordinationId === id)).toMatchObject({ administreras: timmar(start(k, b), -2), vardhandelse: { text: 'Elkonvertering', foljerTidbok: true } });
    const dag = (await k.get(`/api/patient/p01/administreringar?dag=${new Date(timmar(start(k, b), -2)).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })}`)).data;
    expect(dag.doser.find(d => d.ordinationId === id)).toMatchObject({ planerad: timmar(start(k, b), -2) });
  });

  test('ombokning och avbokning räknar om dosen utan att någon gör något, och sjuksköterskan får en förklaring', async () => {
    const k = await inloggad('lak-kard');
    const b = elkonvertering(k);
    const id = (await ordinera(k, 'p01', { bokningId: b.id, forskjutningTimmar: -1 })).data.ordination.id;
    await k.logga('adm-kard');
    // Bokningsdialogen säger att tiden styr en läkemedelsdos, men aldrig vilket läkemedel.
    const f = await k.get(`/api/bokning/${b.id}/forslag`);
    expect(f.data.bokning.styrLakemedel).toBe(tidbok.STYR_LAKEMEDEL);
    expect(JSON.stringify(f.data)).not.toContain('Omeprazol');
    const ny = f.data.forslag[0];
    const om = await k.post(`/api/bokning/${b.id}/omboka`, { tidId: ny.tidId });
    expect(om.status).toBe(200);
    expect(om.data.styrLakemedel).toBe(tidbok.STYR_LAKEMEDEL);
    await k.logga('ssk-kard');
    let o = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(x => x.id === id);
    expect(o.vardhandelse).toMatchObject({ tid: ny.start, administreras: timmar(ny.start, -1), lage: 'bokad' });
    expect(o.vardhandelse.forklaring).toContain('bokades om');
    expect(o.historik.map(h => h.handelse)).toContain('Vårdhändelsen bokades om');
    expect(db(k).query("SELECT personal_id FROM ordination_historik WHERE ordination_id = ? AND handelse = 'Vårdhändelsen bokades om'").get(id).personal_id).toBe('adm-kard');
    await k.logga('adm-kard');
    const nyBokning = db(k).query("SELECT * FROM bokningar WHERE ersatter_id = ? AND status = 'bokad'").get(b.id);
    expect((await k.post(`/api/bokning/${nyBokning.id}/avboka`, { orsak: 'Patienten är förkyld' })).status).toBe(200);
    await k.logga('ssk-kard');
    const l = (await k.get('/api/patient/p01/administreringar')).data;
    const v = l.vantarPaHandelse.find(x => x.ordinationId === id);
    expect(v.vardhandelse).toMatchObject({ tid: null, administreras: null, lage: 'avbokad' });
    expect(v.vardhandelse.forklaring).toContain('avbokades');
    expect(v.vardhandelse.forklaring).toContain('Ge inte dosen');
    o = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(x => x.id === id);
    expect(o.historik.map(h => h.handelse)).toContain('Vårdhändelsen avbokades');
  });

  test('utan bokning hamnar vårdhändelsen på väntelistan, och vårdadministratören bokar den som vanligt i Dagens arbete', async () => {
    const k = await inloggad('lak-kard');
    const kontakter = db(k).query("SELECT count(*) AS n FROM vardkontakter WHERE patient_id = 'p04'").get().n;
    const r = await ordinera(k, 'p04', { text: 'Elkonvertering', forskjutningTimmar: -2 });
    expect(r.status).toBe(201);
    const id = r.data.ordination.id;
    expect(r.data.ordination.vardhandelse).toMatchObject({ text: 'Elkonvertering', tid: null, foljerTidbok: true, lage: 'vantar' });
    expect(r.data.ordination.vardhandelse.forklaring).toContain('väntelistan');
    // Posten ger ingen ny vårdkontakt och ingen vårdrelation.
    expect(db(k).query("SELECT count(*) AS n FROM vardkontakter WHERE patient_id = 'p04'").get().n).toBe(kontakter);
    const post = db(k).query("SELECT * FROM vantelista WHERE patient_id = 'p04' AND orsak = 'Elkonvertering'").get();
    expect(post).toMatchObject({ enhet_id: 'uso-kard', tidstyp: 'aterbesok', yrkesroll: 'lakare', status: 'vantar', skapad_av: 'lak-kard' });
    await k.logga('adm-kard');
    const s = (await k.get('/api/idag')).data;
    const rad = s.vantelista.find(p => p.id === post.id);
    expect(rad).toMatchObject({ orsak: 'Elkonvertering', styrLakemedel: tidbok.STYR_LAKEMEDEL, atgard: { typ: 'boka' } });
    expect(JSON.stringify(rad)).not.toContain('Omeprazol');
    const f = (await k.get(`/api/vantelista/${post.id}/forslag`)).data;
    expect(f.post.styrLakemedel).toBe(tidbok.STYR_LAKEMEDEL);
    const bok = await k.post(`/api/vantelista/${post.id}/boka`, { tidId: f.forslag[0].tidId });
    expect(bok.status).toBe(201);
    await k.logga('ssk-kard');
    const o = (await k.get('/api/patient/p04/lakemedel')).data.ordinationer.find(x => x.id === id);
    expect(o.vardhandelse).toMatchObject({ tid: f.forslag[0].start, administreras: timmar(f.forslag[0].start, -2), lage: 'bokad' });
    // Avbokas tiden står vårdhändelsen på väntelistan igen, och dosen väntar.
    await k.logga('adm-kard');
    const b = db(k).query("SELECT * FROM bokningar WHERE vantelista_id = ? AND status = 'bokad'").get(post.id);
    expect((await k.post(`/api/bokning/${b.id}/avboka`, { orsak: 'Ny bedömning' })).status).toBe(200);
    await k.logga('ssk-kard');
    const v = (await k.get('/api/patient/p04/administreringar')).data.vantarPaHandelse.find(x => x.ordinationId === id);
    expect(v.vardhandelse).toMatchObject({ tid: null, lage: 'vantar' });
    expect(v.vardhandelse.forklaring).toContain('väntelistan igen');
  });

  test('den manuella tidsättningen finns kvar som reserv, slutar följa tidboken och sparas i historiken', async () => {
    const k = await inloggad('lak-kard');
    const r = await ordinera(k, 'p04', { text: 'Elkonvertering', forskjutningTimmar: 0 });
    const id = r.data.ordination.id;
    const post = db(k).query("SELECT * FROM vantelista WHERE patient_id = 'p04' AND orsak = 'Elkonvertering' AND status = 'vantar' ORDER BY id DESC").get();
    await k.logga('ssk-kard');
    const tid = new Date(Date.parse(`${addDagar(idag(), 1)}T09:00:00Z`)).toISOString();
    const t = await k.post(`/api/ordination/${id}/vardhandelse`, { tid });
    expect(t.status).toBe(200);
    expect(t.data.vardhandelse).toMatchObject({ tid, foljerTidbok: false, lage: 'manuell' });
    expect(db(k).query("SELECT personal_id FROM ordination_historik WHERE ordination_id = ? AND handelse = 'vardhandelse_tid'").all(id)).toEqual([{ personal_id: 'ssk-kard' }]);
    // Posten som systemet satte upp för ordinationen avslutas, så att vårdhändelsen inte bokas två gånger.
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).toBe('avslutad');
    expect(db(k).query("SELECT detalj FROM vantelista_handelser WHERE vantelista_id = ? AND typ = 'avslutad'").get(post.id).detalj).toContain('för hand');
  });

  test('säkerhet: ordinera och vårdrelation på egen vårdenhet krävs, och inget sparas när kopplingen nekas', async () => {
    const k = await inloggad('lak-kard');
    const b = elkonvertering(k);
    // Fel roll.
    await k.logga('ssk-kard');
    expect((await k.get('/api/patient/p01/vardhandelse/forslag')).status).toBe(403);
    await k.logga('adm-kard');
    expect((await k.get('/api/patient/p01/vardhandelse/forslag')).status).toBe(403);
    // En annan vårdenhets bokning: nekas och loggas, och ordinationen sparas inte.
    await k.logga('lak-akut');
    const fore = antalOrdinationer(k);
    const nek = await ordinera(k, 'p01', { bokningId: b.id, forskjutningTimmar: -1 });
    expect(nek.status).toBe(403);
    expect(antalOrdinationer(k)).toBe(fore);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-akut', patient_id: 'p01', resultat: 'nekad' });
    // Förslagen tar bara med den egna vårdenhetens bokningar, också efter ett aktivt val.
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Bedömning på akuten' });
    const f = (await k.get('/api/patient/p01/vardhandelse/forslag')).data;
    expect(f.bokningar).toEqual([]);
    expect(f.vantelista).toEqual([]);
    // Akutmottagningen har ingen tidbok, så vårdhändelsen tidsätts för hand.
    expect(f.ny.mojlig).toBe(false);
    const utan = await ordinera(k, 'p01', { text: 'Gastroskopi', forskjutningTimmar: -1 });
    expect(utan.status).toBe(201);
    expect(utan.data.ordination.vardhandelse).toMatchObject({ foljerTidbok: false, lage: 'utan_tidbok' });
    expect(db(k).query("SELECT 1 FROM vantelista WHERE orsak = 'Gastroskopi'").get()).toBeNull();
    // Nödåtkomst ger ingen rätt att knyta en ordination till tidboken.
    const p02 = await inloggad('lak-kard');
    await p02.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös patient, behöver läkemedel' });
    const n = db(p02).query('SELECT count(*) AS n FROM ordinationer').get().n;
    expect((await p02.get('/api/patient/p02/vardhandelse/forslag')).status).toBe(403);
    expect((await ordinera(p02, 'p02', { text: 'Elkonvertering', forskjutningTimmar: -1 })).status).toBe(403);
    expect(db(p02).query('SELECT count(*) AS n FROM ordinationer').get().n).toBe(n);
    expect(db(p02).query("SELECT 1 FROM vantelista WHERE patient_id = 'p02'").get()).toBeNull();
    // En annan patients bokning finns inte.
    expect((await ordinera(await inloggad('lak-kard'), 'p04', { bokningId: b.id, forskjutningTimmar: -1 })).status).toBe(404);
  });

  test('säkerhet: spärrad vårdenhet och skyddad identitet läcker inte via förslagen eller väntelistan', async () => {
    const k = await inloggad('lak-psyk');
    const d = db(k);
    // En påhittad tidbok på psykiatrin med en bokning för Elin Sandberg, som har spärrat psykiatrins uppgifter.
    d.query("INSERT INTO scheman VALUES ('sch-psyk-test', 'uso-psyk', 'lak-psyk', 'lakare')").run();
    const t = d.query("SELECT * FROM tider WHERE schema_id = 'sch-kard-sara' AND tidstyp = 'aterbesok' AND start > ? ORDER BY start LIMIT 1 OFFSET 30").get(new Date().toISOString());
    const tidId = Number(d.query("INSERT INTO tider (schema_id, start, slut, tidstyp) VALUES ('sch-psyk-test', ?, ?, 'aterbesok')").run(t.start, t.slut).lastInsertRowid);
    d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad, orsak) VALUES ('p04', ?, 'bokad', ?, 'Samtal på psykiatrin')").run(tidId, new Date().toISOString());
    expect((await k.get('/api/patient/p04/vardhandelse/forslag')).data.bokningar.map(b => b.text)).toEqual(['Samtal på psykiatrin']);
    // Kardiologen ser inte psykiatrins bokning, inte ens med samtycke till spärren.
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p04/vardhandelse/forslag')).data.bokningar.some(b => b.text === 'Samtal på psykiatrin')).toBe(false);
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker till genomgång' });
    expect((await k.get('/api/patient/p04/vardhandelse/forslag')).data.bokningar.some(b => b.text === 'Samtal på psykiatrin')).toBe(false);
    // Skyddad identitet: förslagen innehåller inga personuppgifter, och väntelistan maskerar namnet.
    const vc = await inloggad('lak-vc');
    const f = await vc.get('/api/patient/p03/vardhandelse/forslag');
    expect(f.status).toBe(200);
    expect(JSON.stringify(f.data)).not.toMatch(/Malin|Engberg|198404162383/);
    expect((await ordinera(vc, 'p03', { text: 'Ultraljud av buken', forskjutningTimmar: -1 })).status).toBe(201);
    const v = tidbok.vantelista(db(vc), db(vc).query("SELECT * FROM personal WHERE id = 'adm-kard'").get());
    expect(JSON.stringify(v)).not.toMatch(/Malin|Engberg/);
  });

  test('säkerhetsgranskning: en annan vårdenhet kan inte sätta tiden för hand eller avsluta den egna vårdenhetens post', async () => {
    const k = await inloggad('lak-kard');
    const id = (await ordinera(k, 'p01', { text: 'Elkonvertering', forskjutningTimmar: -1 })).data.ordination.id;
    const post = db(k).query("SELECT * FROM vantelista WHERE patient_id = 'p01' AND orsak = 'Elkonvertering' AND status = 'vantar'").get();
    expect(post).toBeTruthy();
    await k.logga('lak-akut');
    const tid = new Date(Date.parse(`${addDagar(idag(), 1)}T09:00:00Z`)).toISOString();
    expect((await k.post(`/api/ordination/${id}/vardhandelse`, { tid })).status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-akut', patient_id: 'p01', resultat: 'nekad' });
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).toBe('vantar');
    expect(db(k).query('SELECT foljer, lage FROM vardhandelse_kopplingar WHERE ordination_id = ?').get(id)).toEqual({ foljer: 1, lage: 'vantar' });
    expect(db(k).query('SELECT handelse_tid FROM ordination_tillagg WHERE ordination_id = ?').get(id).handelse_tid).toBeNull();
    // Den egna vårdenheten sätter tiden för hand, och avslutningen av posten loggas på patienten.
    await k.logga('ssk-kard');
    expect((await k.post(`/api/ordination/${id}/vardhandelse`, { tid })).status).toBe(200);
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(post.id).status).toBe('avslutad');
    expect(loggRader(k).some(r => r.personal_id === 'ssk-kard' && r.resurs === `vantelista:${post.id}:avslutad` && r.resultat === 'tillaten')).toBe(true);
  });

  test('säkerhetsgranskning: en annan vårdenhet ser inte bokningens orsak eller tid i den gemensamma läkemedelslistan utan aktivt val', async () => {
    const k = await inloggad('lak-kard');
    const b = elkonvertering(k);
    const tidBokning = start(k, b);
    const id = (await ordinera(k, 'p01', { bokningId: b.id, forskjutningTimmar: -2 }, { ordinationsorsak: 'Förberedelse inför ingrepp' })).data.ordination.id;
    // Samma läkemedel i Läkemedel att ge på en annan vårdenhet visar bara när läkemedlet ges.
    await k.logga('lak-akut');
    const l = (await k.get('/api/patient/p01/lakemedel')).data;
    const o = l.ordinationer.find(x => x.id === id);
    expect(o.vardhandelse).toMatchObject({ text: 'Planerad vårdhändelse', tid: null, administreras: timmar(tidBokning, -2) });
    const adm = (await k.get('/api/patient/p01/administreringar')).data;
    for (const x of [JSON.stringify(l), JSON.stringify(adm)]) {
      expect(x).not.toContain('Elkonvertering');
      expect(x).not.toContain(tidBokning);
    }
    expect(JSON.stringify(o.historik)).not.toContain('Elkonvertering');
    // Med aktivt val visas vårdhändelsen som för den egna vårdenheten.
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Bedömning på akuten' });
    expect((await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(x => x.id === id).vardhandelse).toMatchObject({ text: 'Elkonvertering', tid: tidBokning });
    // Den text som läkaren själv skrev visas för alla som ser ordinationen.
    await k.logga('lak-kard');
    const egen = (await ordinera(k, 'p01', { text: 'Gastroskopi', forskjutningTimmar: -1 })).data.ordination.id;
    await k.logga('lak-akut');
    expect((await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(x => x.id === egen).vardhandelse.text).toBe('Gastroskopi');
  });

  test('en tid som styr en läkemedelsdos kan patienten inte boka om själv i Min journal', async () => {
    const k = await inloggad('lak-vc');
    const b = db(k).query("SELECT * FROM bokningar WHERE patient_id = 'p03' AND status = 'bokad'").get();
    // Utan kopplingen kan patienten boka om återbesöket på vårdcentralen själv.
    await k.post('/api/login/invanare', { invanareId: 'inv-p03' });
    expect((await k.get('/api/min/journal/p03/tider')).data.kommande.find(x => x.id === b.id).kan.omboka).toBe(true);
    await k.logga('lak-vc');
    expect((await ordinera(k, 'p03', { bokningId: b.id, forskjutningTimmar: -1 })).status).toBe(201);
    // Samma sandlåda: patienten loggar in i Min journal.
    await k.post('/api/login/invanare', { invanareId: 'inv-p03' });
    const t = (await k.get('/api/min/journal/p03/tider')).data;
    const min = t.kommande.find(x => x.id === b.id);
    expect(min.kan).toMatchObject({ omboka: false, avboka: false });
    expect(min.varforInte).toContain('behandling');
    expect(JSON.stringify(min)).not.toContain('Omeprazol');
  });
});
