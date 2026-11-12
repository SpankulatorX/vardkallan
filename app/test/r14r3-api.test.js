// Runda 14, r3: API:t för intyg och e-remiss genom servern, med inloggning och loggning som i gränssnittet.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import * as r3 from '../src/rivta-r3.js';
import { idag } from '../src/db.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Intyg och e-remiss i API:t', () => {
  test('Intyg > API: läkaren skriver ett intyg, signerar det i intygsapplikationen och journalen visar statusen', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const db = sandlada(app, k).db;
    // Runda 14, sammanslagningen: diagnosen ställs i dag, så att den är den senaste också med falsk klocka (seedens
    // diagnoser ligger dagar före sandlådans dag).
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'J06.9', 'Akut övre luftvägsinfektion', 'huvud', ?)").run(idag());
    const fore = await k.get('/api/patient/p11/intyg');
    expect(fore.status).toBe(200);
    expect(fore.data.forslag.kod).toBe('LISJP');
    const s = await k.post('/api/patient/p11/intyg', { typ: 'LISJP' });
    expect(s.status).toBe(201);
    const iid = s.data.oppna.split('/').pop();
    const v = await k.get(`/api/intygsapplikation/${iid}`);
    expect(v.data.svar.diagnosKod).toBe('J069');
    expect(v.data.saknas.length).toBeGreaterThan(0);
    expect((await k.post(`/api/intygsapplikation/${iid}/signera`)).status).toBe(400);
    expect((await k.post(`/api/intygsapplikation/${iid}`, { sysselsattning: 'nuvarande_arbete', nedsattning: 'halften', fran: '2026-11-12', till: '2026-11-26' })).status).toBe(200);
    expect((await k.post(`/api/intygsapplikation/${iid}/signera`)).data.status).toBe('signerat');
    const efter = await k.get('/api/patient/p11/intyg');
    expect(efter.data.intyg[0].status).toBe('signerat');
    // En annan vårdenhet kommer inte åt intygsapplikationen för intyget.
    const kard = klient(app);
    await kard.logga('lak-kard');
    sandlada(app, kard).db = db;
    expect((await kard.get(`/api/intygsapplikation/${iid}`)).status).toBe(404);
  }, 30_000);

  test('E-remiss > API: läkaren skickar en e-remiss, mottagaren bekräftar och svarar, och en inkommande e-remiss väntar på mottagning', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const m = await k.get('/api/eremiss/mottagare');
    expect(m.data.mottagare.length).toBe(2);
    const s = await k.post('/api/patient/p11/eremiss', { mottagare: m.data.mottagare[0].hsaId, fragestallning: 'Bedömning av knäsmärta.' });
    expect(s.status).toBe(201);
    const lista = await k.get('/api/patient/p11/remisser');
    const r = lista.data.remisser.find(x => x.id === s.data.remissId);
    expect(r.status).toBe('mottagen');
    expect(r.eremiss.motpart).toBe(m.data.mottagare[0].namn);
    expect((await k.post(`/api/eremiss/${s.data.remissId}/svara-simulerat`)).status).toBe(200);
    const in1 = await k.post('/api/patient/p11/eremiss/inkommande-simulerad');
    expect(in1.status).toBe(201);
    const efter = await k.get('/api/patient/p11/remisser');
    expect(efter.data.remisser.find(x => x.id === s.data.remissId).status).toBe('besvarad');
    expect(efter.data.remisser.find(x => x.id === in1.data.remissId).status).toBe('skickad');
    // Fel mottagare ger ett fel på svenska.
    expect((await k.post('/api/patient/p11/eremiss', { mottagare: 'SE-HITTEPA', fragestallning: 'Bedömning.' })).status).toBe(400);
    await r3.klart(sandlada(app, k).db);
  }, 30_000);
});
