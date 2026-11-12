// Runda 14, r3: Infektionsverktyget med riv.processdevelopment.infections 1.0.2 (Sussa 2.2.1.13), RIVTA Basic Profile 2.0
// och openEHR-kompositioner med xsi:type, mot ett simulerat Infektionsverktyg.
import { describe, test, expect } from 'bun:test';
import * as inf from '../src/rivta-infektion.js';
import * as rivta from '../src/rivta/index.js';
import { nyDbSomStangs } from './r14r3-hjalp.js';

const nyDb = nyDbSomStangs();

const ut = (db) => rivta.anropslogg(db).filter(x => x.riktning === 'ut');

describe('Infektionsverktyget med tjänstekontrakt i RIVTA', () => {
  test('Infektion > vårdtillfällen, infektionsdiagnoser och antibiotika med orsak och smittväg överförs av systemet, en gång', async () => {
    const db = nyDb();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'J18.9', 'Pneumoni, ospecificerad', 'huvud', '2026-11-10')").run();
    const lm = db.query("SELECT id FROM katalog WHERE atc LIKE 'J01%' LIMIT 1").get();
    if (lm) db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES ('p11', 'vc-tybble', ?, '1 x 3', 'tillfallig', 'Pneumoni', '2026-11-20', '2026-11-10T10:00:00Z', 'lak-vc', '2026-11-10T10:00:00Z')").run(lm.id);
    const r = await inf.overfor(db);
    expect(r.tillstand).toBeGreaterThan(0);
    if (lm) expect(r.orsaker).toBeGreaterThan(0);
    expect(ut(db).every(x => x.resultat === 'ok')).toBe(true);
    expect(ut(db).some(x => x.kontrakt === 'ProcessCondition')).toBe(true);
    // En andra överföring skickar inget nytt.
    const fore = ut(db).length;
    await inf.overfor(db);
    expect(ut(db).length).toBe(fore);
  });

  test('Infektion > en patient med skyddade personuppgifter överförs inte, och en borttagen diagnos tas bort med DeleteCondition', async () => {
    const db = nyDb();
    const skyddad = Number(db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p03', 'vc-tybble', 'N30.0', 'Akut cystit', 'huvud', '2026-11-10')").run().lastInsertRowid);
    const d = Number(db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'N30.0', 'Akut cystit', 'huvud', '2026-11-10')").run().lastInsertRowid);
    const r = await inf.overfor(db, { patientId: 'p03' });
    expect(r.tillstand).toBe(0);
    expect(r.utelamnade).toBeGreaterThan(0);
    expect(db.query("SELECT count(*) AS n FROM infektion_overforingar WHERE kalla_id = ?").get(String(skyddad)).n).toBe(0);
    await inf.overfor(db, { patientId: 'p11' });
    db.exec('DROP TRIGGER IF EXISTS diagnos_raderas_ej');
    db.query('DELETE FROM diagnoser WHERE id = ?').run(d);
    const r2 = await inf.overfor(db, { patientId: 'p11' });
    expect(r2.borttagna).toBe(1);
    expect(ut(db).some(x => x.kontrakt === 'DeleteCondition' && x.resultat === 'ok')).toBe(true);
  });

  test('Infektion > en diagnos från en vårdenhet som patienten har spärrat överförs inte', async () => {
    const db = nyDb();
    const d = Number(db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'N30.0', 'Akut cystit', 'huvud', '2026-11-10')").run().lastInsertRowid);
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p11', 'vc-tybble', '2026-11-01T00:00:00Z', 1)").run();
    await inf.overfor(db, { patientId: 'p11' });
    expect(db.query('SELECT count(*) AS n FROM infektion_overforingar WHERE kalla_id = ?').get(String(d)).n).toBe(0);
  });

  test('Infektion > en infektionsdiagnos som läkaren registrerar överförs av systemet i bakgrunden, och en annan diagnos inte', async () => {
    const db = nyDb();
    const mr = await import('../src/myndighetsrapport.js');
    const r3 = await import('../src/rivta-r3.js');
    const { atk } = await import('./hjalp.js');
    const vk = db.query("SELECT * FROM vardkontakter WHERE patient_id = 'p11' AND enhet_id LIKE 'vc-tybble%' ORDER BY id DESC LIMIT 1").get();
    const a = atk(db, 'lak-vc', 'p11', {}, 'registrera_diagnos');
    mr.registreraDiagnos(a, vk, { kod: 'I10.9' });
    await r3.klart(db);
    expect(ut(db).filter(x => x.kontrakt === 'ProcessCondition').length).toBe(0);
    mr.registreraDiagnos(atk(db, 'lak-vc', 'p11', {}, 'registrera_diagnos'), vk, { kod: 'N30.0' });
    await r3.klart(db);
    expect(ut(db).filter(x => x.kontrakt === 'ProcessCondition' && x.resultat === 'ok').length).toBeGreaterThan(0);
  });

  test('Infektion > meddelandena följer schemat med xsi:type, och ett element med en abstrakt typ utan xsi:type avvisas', () => {
    const d = inf.DEF.tillstand();
    const el = inf.bygg('tillstand', { logical_address: 'X', personid: '198004262385', 'person-id': '198004262385', oid_personid: '1.2.752.129.2.1.3.1', issuer_personid: 'Skatteverket',
      assigner_personid: 'Folkbokföringen', födelsetidpunkt: '1980-04-26T00:00:00', kön: '2', vårdgivare: 'V', 'registrerande enhet': 'E', tillståndsid: 'D-1', tillståndskod: 'N300', tillståndstid: '2026-11-10T00:00:00' });
    expect(d.schema.validera(el)).toEqual([]);
    expect(d.profil).toBe('RIVTABP20');
    // Utan xsi:type på composer, som har en abstrakt typ, följer meddelandet inte schemat.
    const utan = JSON.parse(JSON.stringify(el), (k, v) => (Array.isArray(v) && k === 'attr' ? v.filter(a => a.lokal !== 'type') : v));
    expect(d.schema.validera(utan).join(' ')).toContain('abstrakt');
  });
});
