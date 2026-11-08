// Runda 10, r5, del 2: överföringen av läkemedelsberättelsen till nästa vårdgivare (Sussa 3.5.1.1). Testnamnen finns i
// src/sussa/runda10-r5-tester.js. Testerna räknar bara de rader de själva skapar.
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { idag, addDagar, iso } from '../src/db.js';
import { T } from '../src/sussa/runda10-r5-tester.js';
import { verifiera } from '../src/logg.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Läkemedelsöverföring', () => {
  // Ett signerat epikris på patientens pågående vårdtillfälle på kardiologen.
  function epikris(db, pid = 'p01') {
    const vt = db.query('SELECT id FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(pid);
    const vk = db.query('SELECT id FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY id DESC').get(vt.id);
    db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
      VALUES (?, 'uso-kard-72', ?, 'Epikris', 'lakare', ?, 'lak-kard', ?, 'signerad', ?, 'lak-kard')`)
      .run(pid, vk.id, JSON.stringify([{ sokord: 'Orsak till vård', text: 'Förmaksflimmer med hjärtsvikt.' }, { sokord: 'Uppföljning', text: 'Återbesök på vårdcentralen om två veckor.' }]), iso(), iso());
  }

  test(T.loForslag.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    const r = await k.get('/api/patient/p01/lakemedelsoverforing');
    expect(r.status).toBe(200);
    // Gunnar Åkesson är listad på Vårdcentralen Tybble, och en samordnad planering vid utskrivningen pågår med kommunen.
    expect(r.data.forslag.mottagare).toEqual([
      { id: 'vc-tybble', namn: 'Vårdcentralen Tybble', typ: 'vardenhet', varfor: 'Patienten är listad här.' },
      { id: 'kommun-demo', namn: 'Kommunen, socialtjänst och kommunal hälso- och sjukvård (simulerad)', typ: 'kommun', varfor: 'Kommunen deltar i den samordnade planeringen vid utskrivningen.' },
    ]);
    expect(r.data.forslag.berattelse).toContain('Läkemedelsberättelse för');
    expect(r.data.forslag.lista.map(o => o.lakemedel)).toContain('Waran');
    expect(r.data.forslag.lista[0]).toMatchObject({ dosering: expect.any(String), ordinationsorsak: expect.any(String), vardenhet: expect.any(String) });
    expect(r.data.forslag.epikris).toBeNull();
    expect(r.data.forslag.kan.skicka).toBe(true);
    // Elin Sandberg (p04) har ingen samordnad planering. När hon listas på vårdcentralen är den den enda mottagaren.
    expect((await k.get('/api/patient/p04/lakemedelsoverforing')).data.forslag.mottagare).toEqual([]);
    s.db.query("INSERT INTO listningar (patient_id, enhet_id, fran) VALUES ('p04', 'vc-kumla', '2020-01-01')").run();
    expect((await k.get('/api/patient/p04/lakemedelsoverforing')).data.forslag.mottagare).toEqual([{ id: 'vc-kumla', namn: 'Vårdcentralen Kumla', typ: 'vardenhet', varfor: 'Patienten är listad här.' }]);
  });

  test(T.loSkicka.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    epikris(s.db);
    const f = (await k.get('/api/patient/p01/lakemedelsoverforing')).data.forslag;
    expect(f.epikris.text).toContain('Återbesök på vårdcentralen');
    // Ett klick: systemet skickar till mottagarna det har valt.
    const r = await k.post('/api/patient/p01/lakemedelsoverforing', {});
    expect(r.status).toBe(201);
    expect(r.data.overforingar).toHaveLength(2);
    expect(r.data.overforingar[0]).toMatchObject({ mottagare: { id: 'vc-tybble' }, skickadAv: { id: 'lak-kard' }, status: 'skickad', kvitterad: null });
    expect(r.data.text).toBe('Läkemedelsberättelsen, läkemedelslistan och epikrisen är skickade till Vårdcentralen Tybble och Kommunen, socialtjänst och kommunal hälso- och sjukvård (simulerad).');
    // Mottagaren ser överföringen i inkorgen och i patientens läkemedel, och kvitterar.
    await k.logga('lak-vc');
    const ink = (await k.get('/api/inkorg')).data.lakemedelsoverforingar;
    expect(ink).toHaveLength(1);
    expect(ink[0]).toMatchObject({ patientId: 'p01', fran: 'Kardiologiska kliniken USÖ' });
    const l = (await k.get('/api/patient/p01/lakemedelsoverforing')).data;
    expect(l.forslag).toBeNull();
    const o = l.overforingar.find(x => x.mottagare.id === 'vc-tybble');
    expect(o.berattelse).toContain('Läkemedelsberättelse');
    expect(o.epikris.text).toContain('Förmaksflimmer med hjärtsvikt');
    expect(o.lista.length).toBeGreaterThan(2);
    const kv = await k.post(`/api/lakemedelsoverforing/${o.id}/kvittera`, {});
    expect(kv.status).toBe(200);
    expect(kv.data).toMatchObject({ status: 'kvitterad', kvitteradAv: { id: 'lak-vc' } });
    expect((await k.get('/api/inkorg')).data.lakemedelsoverforingar).toEqual([]);
    // Det som skickades ändras eller raderas aldrig.
    expect(() => s.db.query("UPDATE lakemedelsoverforingar SET berattelse = 'x'").run()).toThrow(/ändras inte/);
    expect(() => s.db.query('DELETE FROM lakemedelsoverforingar').run()).toThrow(/raderas inte/);
    // Avsändaren ser att den är kvitterad.
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01/lakemedelsoverforing')).data.overforingar.find(x => x.mottagare.id === 'vc-tybble')).toMatchObject({ status: 'kvitterad', kvitteradAv: { id: 'lak-vc' } });
    expect(verifiera(s.db).hel).toBe(true);
  });

  test(T.loSparr.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    // Elin Sandberg (p04) har en spärr på psykiatrin. En ordination därifrån följer aldrig med.
    s.db.query("INSERT INTO listningar (patient_id, enhet_id, fran) VALUES ('p04', 'vc-tybble', '2020-01-01')").run();
    s.db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES ('p04', 'uso-psyk', 'VK-NPL-0042', '1 tablett på morgonen', 'staende', 'Depression', ?, ?, 'lak-psyk', ?)").run(addDagar(idag(), 30), addDagar(idag(), -60), iso());
    const f = (await k.get('/api/patient/p04/lakemedelsoverforing')).data.forslag;
    expect(JSON.stringify(f)).not.toMatch(/Escitalopram|Depression|psykiatri/i);
    const r = await k.post('/api/patient/p04/lakemedelsoverforing', {});
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.data)).not.toMatch(/Escitalopram/);
    // En spärr på kardiologen: ingenting skickas utan patientens samtycke.
    s.db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p01', 'uso-kard', ?)").run(idag());
    const f1 = (await k.get('/api/patient/p01/lakemedelsoverforing')).data.forslag;
    expect(f1.kraverSamtycke).toBe(true);
    expect(f1.varfor).toContain('spärrat');
    const nej = await k.post('/api/patient/p01/lakemedelsoverforing', {});
    expect(nej.status).toBe(400);
    expect(nej.data.falt).toEqual(['samtycke']);
    expect((await k.post('/api/patient/p01/lakemedelsoverforing', { samtycke: true })).status).toBe(201);
  });

  test(T.loBehorighet.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    // Sjuksköterskan ser förslaget men skickar inte.
    expect((await k.get('/api/patient/p01/lakemedelsoverforing')).status).toBe(200);
    expect((await k.post('/api/patient/p01/lakemedelsoverforing', {})).status).toBe(403);
    await k.logga('lak-kard');
    const s = sandlada(app, k);
    // Utan vårdrelation, också med nödåtkomst, skickas ingenting.
    expect((await k.post('/api/patient/p13/lakemedelsoverforing', {})).status).toBe(403);
    await k.post('/api/patient/p13/val', { nodatkomst: true });
    expect((await k.post('/api/patient/p13/lakemedelsoverforing', {})).status).toBe(403);
    expect((await k.post('/api/patient/p01/lakemedelsoverforing', {})).status).toBe(201);
    // En tredje vårdenhet, akuten, ser inte överföringen, inte ens med aktivt val.
    await k.logga('lak-akut');
    await k.post('/api/patient/p01/val', { andra_enheter: true });
    const a = (await k.get('/api/patient/p01/lakemedelsoverforing')).data;
    expect(a.overforingar).toEqual([]);
    // Ett id i anropet ger ingen åtkomst: en annan vårdenhet kan inte kvittera.
    const id = s.db.query('SELECT id FROM lakemedelsoverforingar ORDER BY id DESC').get().id;
    expect((await k.post(`/api/lakemedelsoverforing/${id}/kvittera`, {})).status).toBe(404);
    // Nekade försök loggas.
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs LIKE 'lakemedelsoverforing%' AND resultat = 'nekad'").get().n).toBeGreaterThanOrEqual(1);
  });

  test(T.loKommun.split(' > ')[1], async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    // Seedens samordnade planering vid utskrivning för Gunnar Åkesson, med kommunen som mottagare.
    const sam = db.query("SELECT id FROM samordningar WHERE patient_id = 'p01' AND typ = 'spu'").get();
    epikris(db);
    expect((await k.post('/api/patient/p01/lakemedelsoverforing', {})).status).toBe(201);
    await k.logga('kom-bist');
    const r = await k.get(`/api/samverkan/${sam.id}/lakemedel`);
    expect(r.status).toBe(200);
    expect(r.data.overforingar).toHaveLength(1);
    const o = r.data.overforingar[0];
    expect(o.mottagare).toMatchObject({ id: 'kommun-demo', typ: 'kommun' });
    expect(o.lista.length).toBeGreaterThan(2);
    expect(o.berattelse).toContain('Läkemedelsberättelse');
    // Kommunen får läkemedlen men inte epikrisen, som är den regionala vårdens journal.
    expect(o.epikris).toBeNull();
    expect((await k.post(`/api/lakemedelsoverforing/${o.id}/kvittera`, {})).data.status).toBe('kvitterad');
    // Kommunen når ingen journal och ingen annan planerings överföring.
    expect((await k.get('/api/patient/p01/lakemedelsoverforing')).status).toBe(403);
    expect((await k.get('/api/samverkan/999999/lakemedel')).status).toBe(404);
  });
});
