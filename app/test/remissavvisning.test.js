// Avvisad remiss med en vårdhändelse som ett läkemedel väntar på (runda 5, r4, beslut 2026-11-03). Tar avvisningen bort
// den sista vårdrelationen till patienten på vårdenheten fattas beslutet om läkemedlet i samma ögonblick: sätt ut,
// behåll och sätt upp vårdhändelsen igen, eller avbryt. Den som avvisar har fortfarande åtkomst då.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { harVardrelation } from '../src/atkomst.js';
import * as remissavvisning from '../src/remissavvisning.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const db = (k) => sandlada(app, k).db;
const logg = (k, resurs) => db(k).query('SELECT * FROM atkomstlogg WHERE resurs = ? ORDER BY id').all(resurs);
const MOTIVERING = 'Handläggs i primärvården.';

// Demoläget: Birgitta Nyman är remitterad från Vårdcentralen Tybble till kardiologen, har en tid för elkonvertering på
// remissen och Omeprazol som ska ges två timmar före. Kardiologen har ingen annan vårdrelation till henne.
async function scenario() {
  const k = klient(app);
  await k.logga('lak-kard');
  const s = await k.post('/api/demo/remiss-vardhandelse');
  expect(s.status).toBe(200);
  return { k, ...s.data };
}

describe('Avvisad remiss med vårdhändelse', () => {
  test('avvisningen som tar bort den sista vårdrelationen kräver ett beslut innan den sparas, och inget sparas utan det', async () => {
    const { k, remissId, ordinationId, bokningId } = await scenario();
    // Förhandsvisningen i dialogen ändrar inget.
    const f = await k.get(`/api/remiss/${remissId}/avvisning`);
    expect(f.status).toBe(200);
    expect(f.data.vardhandelser).toEqual([expect.objectContaining({
      ordinationId, lakemedel: 'Omeprazol Sandoz 20 mg', fraga: 'Avvisningen avbokar tiden för elkonvertering, och Omeprazol Sandoz 20 mg väntar på den. Sätt ut eller behåll?',
      orsak: remissavvisning.SATT_UT_ORSAK, kravs: true,
    })]);
    expect(f.data.dolda).toBeNull();
    const r = await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING });
    expect(r.status).toBe(409);
    expect(r.data.kod).toBe('kraver_beslut');
    expect(r.data.vardhandelser.map(v => v.ordinationId)).toEqual([ordinationId]);
    // Inget sparades: remissen är mottagen, tiden bokad och ordinationen aktiv.
    expect(db(k).query('SELECT status FROM remisser WHERE id = ?').get(remissId).status).toBe('mottagen');
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(bokningId).status).toBe('bokad');
    expect(db(k).query('SELECT status FROM ordinationer WHERE id = ?').get(ordinationId).status).toBe('aktiv');
    expect(logg(k, `remiss:${remissId}:kraver_beslut`)).toHaveLength(1);
    // Ett okänt val godtas inte.
    expect((await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING, vardhandelser: [{ ordinationId, val: 'nagot' }] })).status).toBe(409);
  });

  test('Sätt ut: ordinationen sätts ut med orsaken som systemet föreslår, remissen avvisas och ingen rad hamnar i inkorgen', async () => {
    const { k, remissId, ordinationId } = await scenario();
    const r = await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING, vardhandelser: [{ ordinationId, val: 'satt_ut', orsak: remissavvisning.SATT_UT_ORSAK }] });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ beslut: 'avvisad', avbokade: 1 });
    expect(r.data.vardhandelser).toEqual([{ ordinationId, val: 'satt_ut' }]);
    expect(db(k).query('SELECT status, utsatt_orsak, utsatt_av FROM ordinationer WHERE id = ?').get(ordinationId)).toEqual({ status: 'utsatt', utsatt_orsak: remissavvisning.SATT_UT_ORSAK, utsatt_av: 'lak-kard' });
    expect(logg(k, `ordination:${ordinationId}:utsatt:remiss_avvisad`)).toHaveLength(1);
    expect(harVardrelation(db(k), 'p06', 'uso-kard')).toBe(false);
    expect((await k.get('/api/inkorg')).data.avbokadeVardhandelser).toEqual([]);
  });

  test('Behåll finns bara när den ordinerande läkaren eller en annan vårdenhet har grund, och sätter då upp vårdhändelsen igen', async () => {
    // Birgitta är listad på vårdcentralen, som har grund även efter avvisningen.
    const { k, remissId, ordinationId } = await scenario();
    const f = (await k.get(`/api/remiss/${remissId}/avvisning`)).data.vardhandelser[0];
    expect(f).toMatchObject({ kanBehalla: true, varforInteBehalla: null });
    const r = await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING, vardhandelser: [{ ordinationId, val: 'behall' }] });
    expect(r.status).toBe(200);
    expect(db(k).query('SELECT status FROM ordinationer WHERE id = ?').get(ordinationId).status).toBe('aktiv');
    expect(db(k).query('SELECT remiss_avvisad, lage FROM vardhandelse_kopplingar WHERE ordination_id = ?').get(ordinationId)).toEqual({ remiss_avvisad: 0, lage: 'vantar' });
    expect(db(k).query("SELECT enhet_id, remiss_id FROM vantelista WHERE patient_id = 'p06' AND status = 'vantar' AND orsak = 'Elkonvertering'").get()).toEqual({ enhet_id: 'uso-kard', remiss_id: null });
    expect(logg(k, `ordination:${ordinationId}:vardhandelse_igen`)).toHaveLength(1);

    // Utan någon annan grund visas inte valet, och systemet förklarar varför.
    const b = await scenario();
    db(b.k).query("DELETE FROM listningar WHERE patient_id = 'p06'").run();
    db(b.k).query("UPDATE vardkontakter SET start = '2020-01-01T08:00:00.000Z', slut = '2020-01-01T09:00:00.000Z' WHERE patient_id = 'p06' AND coalesce(planerad, 0) = 0").run();
    db(b.k).query("UPDATE remisser SET status = 'svar_kvitterat', svar_kvitterat_tid = '2020-01-01T09:00:00.000Z' WHERE patient_id = 'p06' AND id <> ?").run(b.remissId);
    const g = (await b.k.get(`/api/remiss/${b.remissId}/avvisning`)).data.vardhandelser[0];
    expect(g.kanBehalla).toBe(false);
    expect(g.varforInteBehalla).toContain('vårdrelation');
    expect((await b.k.post(`/api/remiss/${b.remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING, vardhandelser: [{ ordinationId: b.ordinationId, val: 'behall' }] })).status).toBe(409);
    expect(db(b.k).query('SELECT status FROM remisser WHERE id = ?').get(b.remissId).status).toBe('mottagen');
  });

  test('säkerhet: ett läkemedel som den som avvisar inte får se sätts inte ut, och vårdenhetens läkare får besked utan patientuppgifter', async () => {
    const { k, remissId, ordinationId } = await scenario();
    // Ordinationen hör till psykiatrin, som Birgitta har spärrat i det här testet.
    db(k).query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p06', 'uso-psyk', ?, 1)").run(new Date().toISOString());
    db(k).query("UPDATE ordinationer SET enhet_id = 'uso-psyk' WHERE id = ?").run(ordinationId);
    const f = (await k.get(`/api/remiss/${remissId}/avvisning`)).data;
    expect(f.vardhandelser).toEqual([]);
    expect(f.dolda).toBe(remissavvisning.DOLDA_TEXT);
    expect(JSON.stringify(f)).not.toMatch(/Omeprazol|psyk/i);
    // Avvisningen går igenom, och ordinationen sätts inte ut.
    const r = await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING });
    expect(r.status).toBe(200);
    expect(r.data.dolda).toBe(remissavvisning.DOLDA_TEXT);
    expect(db(k).query('SELECT status FROM ordinationer WHERE id = ?').get(ordinationId).status).toBe('aktiv');
    // Kardiologens läkare får en rad utan patientuppgifter med en länk som kräver aktivt val eller nödåtkomst.
    const rad = (await k.get('/api/inkorg')).data.avbokadeVardhandelser.find(x => x.ordinationId === ordinationId);
    expect(rad).toMatchObject({ utanPatient: true, href: '#/patient/p06/lakemedel' });
    expect(JSON.stringify(rad)).not.toMatch(/Birgitta|Nyman|194601198882|Omeprazol|Elkonvertering|psyk/i);
    expect(logg(k, `inkorg:vardhandelse_avbokad_utan_grund:${ordinationId}`)).toHaveLength(1);
    // Sjuksköterskan får ingen rad.
    await k.logga('ssk-kard');
    expect((await k.get('/api/inkorg')).data.avbokadeVardhandelser).toEqual([]);
  });

  test('säkerhet: bara vårdenhetens läkare som remissen är ställd till kan förhandsvisa och avvisa, och nekade försök loggas', async () => {
    const { k, remissId } = await scenario();
    await k.logga('lak-akut');
    expect((await k.get(`/api/remiss/${remissId}/avvisning`)).status).toBe(403);
    expect((await k.post(`/api/remiss/${remissId}/bedom`, { beslut: 'avvisad', motivering: MOTIVERING })).status).toBe(403);
    expect(db(k).query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'lak-akut' ORDER BY id DESC").get().resultat).toBe('nekad');
    expect(db(k).query('SELECT status FROM remisser WHERE id = ?').get(remissId).status).toBe('mottagen');
    await k.logga('adm-kard');
    expect((await k.post('/api/demo/remiss-vardhandelse')).status).toBe(403);
  });
});
