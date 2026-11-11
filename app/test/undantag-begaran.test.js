// Runda 13, r3 (beslut från Jonas): undantag av en enskild anteckning börjar med en begäran från vården. Journalen visar
// anteckningens nummer, och den som skrev anteckningen eller patientens ansvariga läkare begär undantaget från
// anteckningens meny med kanal och skäl. Systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som
// begär, men aldrig innehållet, och godkänner som förut med en andra systemförvaltare. Säkerhetsfynd 5 och 6 från
// granskningen av runda 12: förhandsvisningen röjer inget om ett nummer utan begäran, och en undantagen anteckning syns
// varken i händelsekedjan eller i felmeddelandet. Testnamnen används i kravregistret och i Sussa-mappningen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { datumAv } from '../src/db.js';
import * as undantag from '../src/undantag.js';
import * as journal from '../src/journal.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const TEXT = 'Uppgift om en anhörig som inte ska visas';
// En signerad anteckning på en avslutad vårdkontakt, skriven av testet.
function egenAnteckning(db, pers = 'lak-kard', patient = 'p01', text = TEXT) {
  const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = ? AND slut IS NOT NULL AND enhet_id IN (SELECT id FROM enheter WHERE id = 'uso-kard' OR forald_id = 'uso-kard') ORDER BY id LIMIT 1").get(patient);
  const a = journal.skapaAnteckning(atk(db, pers, patient), { typ: 'Daganteckning', ...(vk ? { vardkontaktId: vk.id } : {}), sokord: [{ sokord: 'Aktuellt', text }] });
  journal.signera(atk(db, pers, patient), journal.hamtaAnteckningRad(db, a.id));
  return a.id;
}
const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const BEGARAN = { kanaler: ['visning', 'nationell'], skal: 'Uppgiften är förd i fel patients journal.' };

describe('Begäran om undantag av en anteckning', () => {
  test('journalen visar anteckningens nummer, och den som skrev anteckningen begär undantag med kanal och skäl', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const id = egenAnteckning(db);
    const a = (await k.get(`/api/anteckning/${id}`)).data;
    expect(a.nummer).toBe(id);
    expect(a.undantagBegaran).toMatchObject({ kan: true, begaran: null });
    expect((await k.post(`/api/anteckning/${id}/undantag`, { kanaler: [], skal: BEGARAN.skal })).status).toBe(400);
    expect((await k.post(`/api/anteckning/${id}/undantag`, { kanaler: ['visning'], skal: 'kort' })).status).toBe(400);
    const r = await k.post(`/api/anteckning/${id}/undantag`, BEGARAN);
    expect(r.status).toBe(201);
    expect(r.data.begaran).toMatchObject({ status: 'vantar', kanaler: ['nationell', 'visning'] });
    // En begäran räcker. Nästa svar säger att den väntar.
    expect((await k.post(`/api/anteckning/${id}/undantag`, BEGARAN)).status).toBe(409);
    expect((await k.get(`/api/anteckning/${id}`)).data.undantagBegaran.begaran.status).toBe('vantar');
    // Begäran loggas i åtkomstloggen med anteckningens patient.
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = 'p01' AND resurs = ?").get(`undantag_begaran:anteckning:${id}`).n).toBe(1);
  });

  test('bara den som skrev anteckningen eller en läkare på dess vårdenhet kan begära undantag', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const id = egenAnteckning(db);
    // Sjuksköterskan på samma klinik som inte skrev anteckningen.
    await k.logga('ssk-kard');
    const ssk = await k.get(`/api/anteckning/${id}`);
    expect(ssk.data.undantagBegaran?.kan).toBe(false);
    const nej = await k.post(`/api/anteckning/${id}/undantag`, BEGARAN);
    expect(nej.status).toBe(403);
    expect(nej.data.fel).toContain('den som skrev anteckningen');
    // En läkare på en annan vårdenhet, som inte får läsa anteckningen, får samma svar som för en anteckning som inte finns.
    await k.logga('lak-vc');
    const vc = await k.post(`/api/anteckning/${id}/undantag`, BEGARAN);
    expect([403, 404]).toContain(vc.status);
    expect(JSON.stringify(vc.data)).not.toContain(TEXT);
    // Systemförvaltaren kan inte begära, eftersom den inte läser journalen.
    await k.logga('sysf');
    expect((await k.post(`/api/anteckning/${id}/undantag`, BEGARAN)).status).toBe(403);
  });

  test('systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men inte innehållet, och godkänner med en andra systemförvaltare', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const id = egenAnteckning(db);
    expect((await k.post(`/api/anteckning/${id}/undantag`, BEGARAN)).status).toBe(201);
    await k.logga('sysf');
    const o = (await k.get('/api/undantag')).data;
    const b = o.begaranden.find(x => x.nummer === id);
    expect(b).toMatchObject({ nummer: id, typ: 'Daganteckning', vardenhet: 'Kardiologiska kliniken USÖ', begardAv: { namn: 'Sara Lindqvist', titel: 'Läkare' }, kanaler: ['nationell', 'visning'], skal: BEGARAN.skal, status: 'vantar' });
    expect(b.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const text = JSON.stringify(o);
    expect(text).not.toContain(TEXT);
    expect(text).not.toContain('Gunnar');
    expect(text).not.toContain('194502024732');
    expect(text).not.toContain('"p01"');
    // Förhandsvisningen av numret med en begäran beskriver anteckningen utan innehåll.
    const f = (await k.post('/api/undantag/forhandsvisa', { omfang: 'anteckning', varde: String(id), kanaler: BEGARAN.kanaler })).data;
    expect(f.ok).toBe(true);
    expect(JSON.stringify(f)).not.toContain(TEXT);
    const ny = await k.post('/api/undantag', { omfang: 'anteckning', varde: String(id), kanaler: BEGARAN.kanaler, motivering: BEGARAN.skal, giltigFran: datumAv(new Date()) });
    expect(ny.status).toBe(201);
    expect((await k.get('/api/undantag')).data.begaranden.find(x => x.nummer === id).status).toBe('foreslagen');
    // Samma systemförvaltare kan inte godkänna. En andra gör det.
    expect((await k.post(`/api/undantag/${ny.data.andring.id}/godkann`, {})).status).toBe(403);
    await k.logga('sysf-2');
    expect((await k.post(`/api/undantag/${ny.data.andring.id}/godkann`, {})).status).toBe(200);
    expect((await k.get('/api/undantag')).data.begaranden.find(x => x.nummer === id)?.status ?? 'beslutad').toBe('beslutad');
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01/anteckningar')).data.anteckningar.some(a => a.id === id)).toBe(false);
  });

  test('systemförvaltaren kan avslå en begäran med en kommentar, och den som begärde ser det', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const id = egenAnteckning(db);
    await k.post(`/api/anteckning/${id}/undantag`, BEGARAN);
    await k.logga('sysf');
    const b = (await k.get('/api/undantag')).data.begaranden.find(x => x.nummer === id);
    expect((await k.post(`/api/undantag/begaran/${b.id}/avsla`, {})).status).toBe(400);
    expect((await k.post(`/api/undantag/begaran/${b.id}/avsla`, { kommentar: 'Rättas i stället av den som skrev anteckningen.' })).status).toBe(200);
    await k.logga('lak-kard');
    expect((await k.get(`/api/anteckning/${id}`)).data.undantagBegaran.begaran).toMatchObject({ status: 'avslagen', kommentar: 'Rättas i stället av den som skrev anteckningen.' });
  });

  test('förhandsvisningen av ett nummer utan begäran ger samma svar för en befintlig, en spärrad, en skyddad och en obefintlig anteckning', () => {
    const db = require('../src/db.js').byggSeed();
    const sysf = personal(db, 'sysf');
    const vanlig = egenAnteckning(db);
    const enhet = db.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get().enhet_id;
    const sparrad = Number(db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
      VALUES ('p04', ?, 'Mottagningsanteckning', 'lakare', '[]', 'lak-med', '2026-01-01T10:00:00Z', 'signerad', '2026-01-01T10:05:00Z', 'lak-med')`).run(enhet).lastInsertRowid);
    const skyddad = Number(db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
      VALUES ('p03', 'uso-kard', 'Epikris', 'lakare', '[]', 'lak-kard', '2026-01-01T10:00:00Z', 'signerad', '2026-01-01T10:05:00Z', 'lak-kard')`).run().lastInsertRowid);
    const pagaende = db.query("SELECT a.id FROM anteckningar a JOIN vardkontakter v ON v.id = a.vardkontakt_id WHERE v.slut IS NULL AND a.status = 'signerad' LIMIT 1").get().id;
    const svar = (n) => JSON.stringify(undantag.forhandsvisa(db, sysf, { omfang: 'anteckning', varde: String(n), kanaler: ['visning'] }));
    const forsta = svar(vanlig);
    for (const n of [sparrad, skyddad, pagaende, 999999, 'constructor']) expect(svar(n)).toBe(forsta);
    expect(JSON.parse(forsta).ok).toBe(false);
    expect(forsta).not.toMatch(/Daganteckning|Epikris|Mottagningsanteckning|pågående/);
    // Ett förslag utan begäran stoppas med samma svar.
    expect(() => undantag.foresla(db, sysf, { omfang: 'anteckning', varde: String(vanlig), kanaler: ['visning'], motivering: 'Prov.', giltigFran: datumAv(new Date()) })).toThrow(JSON.parse(forsta).varfor);
  });

  test('en undantagen anteckning syns inte i händelsekedjan, och direkt öppning ger samma svar som en anteckning som inte finns', async () => {
    const k = await inloggad('lak-kard');
    const db = sandlada(app, k).db;
    const id = egenAnteckning(db);
    const vk = db.query('SELECT vardkontakt_id FROM anteckningar WHERE id = ?').get(id).vardkontakt_id;
    expect(vk).not.toBeNull();
    const fore = (await k.get(`/api/vardkontakt/${vk}/handelser`)).data;
    expect(JSON.stringify(fore)).toContain(`anteckning:${id}`);
    await k.post(`/api/anteckning/${id}/undantag`, { kanaler: ['visning'], skal: BEGARAN.skal });
    await k.logga('sysf');
    const ny = await k.post('/api/undantag', { omfang: 'anteckning', varde: String(id), kanaler: ['visning'], motivering: BEGARAN.skal, giltigFran: datumAv(new Date()) });
    await k.logga('sysf-2');
    await k.post(`/api/undantag/${ny.data.andring.id}/godkann`, {});
    await k.logga('lak-kard');
    const efter = JSON.stringify((await k.get(`/api/vardkontakt/${vk}/handelser`)).data);
    expect(efter).not.toContain(`anteckning:${id}`);
    const oppnad = await k.get(`/api/anteckning/${id}`);
    const saknas = await k.get('/api/anteckning/999999');
    expect(oppnad.status).toBe(saknas.status);
    expect(oppnad.data).toEqual(saknas.data);
    // Journalens rad om att något inte visas har kvar motiveringen.
    expect(JSON.stringify((await k.get('/api/patient/p01/anteckningar')).data.dolda)).toContain(BEGARAN.skal);
  });
});
