import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { iso } from '../src/db.js';

// Hälsoärenden som ändras (Sussa 6.1.1.2): avsluta, dela, slå ihop och flytta en vårdkontakt mellan ärenden, med
// historik. Bara ärenden och kontakter som användaren får se ändras.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;

// Två ärenden för Gunnar Åkesson (p01) på kardiologin, med samma diagnoskategori.
function tvaArenden(s) {
  const vk = s.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id IN ('uso-kard', 'uso-kard-72', 'uso-kard-mott') ORDER BY start").all().map(r => r.id);
  const ny = (rubrik, ids) => {
    const id = Number(s.query("INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, kod, grund, skapad, skapad_av) VALUES ('p01', 'uso-kard', ?, 'I50.1', 'diagnos', ?, 'lak-kard')").run(rubrik, iso()).lastInsertRowid);
    for (const v of ids) s.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE id = ?').run(id, v);
    return id;
  };
  return { a: ny('Hjärtsvikt', vk.slice(0, 2)), b: ny('Hjärtsvikt, uppföljning', vk.slice(2)), vk };
}

describe('Hälsoärende', () => {
  test('ett hälsoärende kan avslutas och öppnas igen, med historik', async () => {
    const k = await inloggad('lak-kard');
    const { a } = tvaArenden(db(k));
    const r = await k.post(`/api/halsoarende/${a}/avsluta`, { orsak: 'Behandlingen är klar.' });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('avslutat');
    expect(r.data.historik[0]).toMatchObject({ typ: 'avslutat', av: { id: 'lak-kard' }, enhet: { id: 'uso-kard' } });
    expect((await k.post(`/api/halsoarende/${a}/oppna`)).data.status).toBe('aktivt');
    expect((await k.get(`/api/halsoarende/${a}`)).data.historik.map(h => h.typ)).toEqual(['oppnat', 'avslutat']);
    expect(db(k).query('SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1').get()).toMatchObject({ patient_id: 'p01', handling: 'las_admin' });
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'halsoarende' AND resurs LIKE ?").get(`halsoarende:${a}:%`).n).toBe(2);
  });

  test('ett hälsoärende delas, och kontakterna följer med till det nya ärendet', async () => {
    const k = await inloggad('lak-kard');
    const { a, vk } = tvaArenden(db(k));
    expect((await k.post(`/api/halsoarende/${a}/dela`, { kontakter: vk.slice(0, 2) })).status).toBe(400);
    const r = await k.post(`/api/halsoarende/${a}/dela`, { kontakter: [vk[1]], rubrik: 'Förmaksflimmer' });
    expect(r.data).toMatchObject({ rubrik: 'Förmaksflimmer', kontakter: [vk[1]] });
    expect(db(k).query('SELECT halsoarende_id FROM vardkontakter WHERE id = ?').get(vk[0]).halsoarende_id).toBe(a);
    expect((await k.get(`/api/halsoarende/${a}`)).data.historik[0].text).toContain('Förmaksflimmer');
  });

  test('två ärenden slås ihop, och det sammanslagna visas inte längre', async () => {
    const k = await inloggad('lak-kard');
    const { a, b, vk } = tvaArenden(db(k));
    // Systemet föreslår sammanslagningen eftersom diagnoskategorin är densamma.
    const f = (await k.get('/api/patient/p01/oversikt')).data.r3.halsoarendeForslag.find(x => x.typ === 'sla_ihop');
    expect(f).toMatchObject({ halsoarendeId: a, med: b });
    const r = await k.post(`/api/halsoarende/${a}/sla-ihop`, { med: b });
    expect(r.data.kontakter.length).toBe(vk.length);
    expect(db(k).query('SELECT status, sammanslaget_med FROM halsoarenden WHERE id = ?').get(b)).toEqual({ status: 'sammanslaget', sammanslaget_med: a });
    const o = (await k.get('/api/patient/p01/oversikt')).data;
    expect(o.vardstruktur.halsoarenden.map(h => h.id)).not.toContain(b);
    expect((await k.get(`/fhir/EpisodeOfCare/${b}`)).data.status).toBe('finished');
  });

  test('en vårdkontakt flyttas mellan ärenden, med historik i båda', async () => {
    const k = await inloggad('ssk-kard');
    const { a, b, vk } = tvaArenden(db(k));
    const r = await k.post(`/api/halsoarende/${a}/flytta`, { kontakt: vk[0], till: b });
    expect(r.status).toBe(200);
    expect(db(k).query('SELECT halsoarende_id FROM vardkontakter WHERE id = ?').get(vk[0]).halsoarende_id).toBe(b);
    expect((await k.get(`/api/halsoarende/${b}`)).data.historik[0]).toMatchObject({ typ: 'kontakt_in', av: { id: 'ssk-kard' } });
    // Utan mål tas kontakten bort ur ärendet.
    expect((await k.post(`/api/halsoarende/${a}/flytta`, { kontakt: vk[1] })).data.kontakter).toEqual([]);
  });

  test('kontakter och ärenden som användaren inte får se rörs inte, och nödåtkomst ger bara läsning', async () => {
    const k = await inloggad('lak-kard');
    const s = db(k);
    const { a, b } = tvaArenden(s);
    // En kontakt från vårdcentralen ligger i ärende a: kardiologin ser den inte utan aktivt val.
    const vc = s.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id = 'vc-tybble' LIMIT 1").get().id;
    s.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE id = ?').run(a, vc);
    expect((await k.post(`/api/halsoarende/${a}/flytta`, { kontakt: vc, till: b })).status).toBe(400);
    expect((await k.post(`/api/halsoarende/${a}/avsluta`)).status).toBe(400);
    expect((await k.post(`/api/halsoarende/${b}/sla-ihop`, { med: a })).status).toBe(400);
    expect((await k.get('/api/patient/p01/oversikt')).data.r3.halsoarendeForslag.some(f => f.halsoarendeId === a || f.med === a)).toBe(false);
    // Ett ärende på en annan vårdenhet finns inte för användaren.
    const annat = Number(s.query("INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, skapad, skapad_av) VALUES ('p01', 'vc-tybble', 'Högt blodtryck', ?, 'lak-vc')").run(iso()).lastInsertRowid);
    expect((await k.post(`/api/halsoarende/${annat}/avsluta`)).status).toBe(404);
    expect((await k.get(`/api/halsoarende/${annat}`)).status).toBe(404);
    // Vårdadministratören och nödåtkomst ändrar inte ärenden.
    await k.logga('adm-kard');
    expect((await k.post(`/api/halsoarende/${b}/avsluta`)).status).toBe(403);
    await k.logga('lak-psyk');
    expect((await k.post('/api/patient/p01/val', { typ: 'nodatkomst', syfte: 'Medvetslös, kan inte samtycka' })).status).toBe(200);
    expect((await k.post(`/api/halsoarende/${b}/avsluta`)).status).toBe(403);
  });

  test('historiken kan inte ändras eller raderas (trigger)', async () => {
    const k = await inloggad('lak-kard');
    const { a } = tvaArenden(db(k));
    await k.post(`/api/halsoarende/${a}/avsluta`);
    expect(() => db(k).query('UPDATE halsoarende_historik SET text = ?').run('x')).toThrow('Hälsoärendets historik ändras inte');
    expect(() => db(k).query('DELETE FROM halsoarende_historik').run()).toThrow('Hälsoärendets historik raderas inte');
  });
});
