// Runda 13, r4: fynden på nivå 2 från det utforskande testet (E2-17, E2-10, E1-7, E1-28, E1-22 och E3-27). Varje test
// ställer klockan på en torsdag, så att resultatet inte beror på när sviten körs.
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { lokalTid, nySessionsDb } from '../src/db.js';
import { stallKlockan, aterstallKlockan } from './falsk-klocka.js';
import { testserver, klient, atk, personal } from './hjalp.js';
import * as mt from '../src/medicinteknik.js';
import * as lakemedel from '../src/lakemedel.js';
import * as presentationsvyer from '../src/presentationsvyer.js';
import * as struktur from '../src/journalstruktur.js';
import { allaAttGodkanna } from '../src/systemforvaltning-rutter.js';

const KLOCKAN = (k) => new Date(lokalTid('2026-11-12', k));
afterEach(() => aterstallKlockan());

describe('Nivå 2 (runda 13, r4)', () => {
  test('E2-17: monitorn hittas på serienumret som står i listan, och en monitor från en annan sal ger en varning', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const p = db.query("SELECT * FROM patienter WHERE id = 'p22'").get();
    const r = mt.koppla(atk(db, 'ssk-hia', 'p22', {}, 'koppla_utrustning'), p, { streckkod: 'demo-mon-0001' });
    expect(r.koppling.utrustning).toMatchObject({ serienummer: 'DEMO-MON-0001', streckkod: 'MT-MON-0001' });
    expect(r.varning).toBe('Patientmonitor DEMO-MON-0001 hör till sal 1, och patienten ligger i sal 3. Kontrollera att det är rätt utrustning.');
    // Monitorn i hans egen sal ger ingen varning.
    const egen = mt.koppla(atk(db, 'ssk-hia', 'p22', {}, 'koppla_utrustning'), p, { streckkod: 'MT-MON-0005' });
    expect(egen.varning).toBeNull();
    // Ett nummer som inte finns stoppas som förut.
    expect(() => mt.koppla(atk(db, 'ssk-hia', 'p22', {}, 'koppla_utrustning'), p, { streckkod: 'DEMO-MON-9999' })).toThrow('Streckkoden hör inte till någon utrustning');
  });

  test('E2-10: mätvärden som personalen har skrivit in har den som registrerade dem, men provsvar och migrerade värden har det inte', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const rad = (typ) => db.query("SELECT registrerad_av FROM matvarden WHERE patient_id = 'p01' AND typ = ? AND kalla = 'vardkallan' AND enhet_id = 'uso-kard-72' ORDER BY tid LIMIT 1").get(typ);
    expect(rad('puls').registrerad_av).toBe('ssk-kard');
    expect(rad('blodtryck').registrerad_av).toBeTruthy();
    expect(db.query("SELECT count(*) AS n FROM matvarden WHERE kalla LIKE 'migrerad:%' AND registrerad_av IS NOT NULL").get().n).toBe(0);
    expect(db.query("SELECT registrerad_av FROM matvarden WHERE patient_id = 'p01' AND typ = 'kreatinin' LIMIT 1").get()?.registrerad_av ?? null).toBeNull();
  });

  test('E1-7 och E1-28: förvald anteckningsmall och översikt följer patientens läge och vårdenheten', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    // Distriktsläkaren med en listad patient som bor hemma: mottagningsanteckning.
    expect(presentationsvyer.anteckningsmallar(atk(db, 'lak-vc', 'p11'))[0]).toBe('Mottagningsanteckning');
    // Kardiologen med en inskriven patient: daganteckning.
    expect(presentationsvyer.anteckningsmallar(atk(db, 'lak-kard', 'p04'))[0]).toBe('Daganteckning');
    // Akutläkaren med en patient utan pågående kontakt på akuten (efter nödåtkomst): akut och akutanteckning.
    const a = atk(db, 'lak-akut', 'p02', { nodatkomst: true });
    expect(presentationsvyer.valjSituation(a).id).toBe('akut');
    expect(presentationsvyer.anteckningsmallar(a)[0]).toBe('Akutanteckning');
  });

  test('E1-22: handelsnamn som Ipren och Voltaren hittar substansen i katalogen', () => {
    const db = nySessionsDb();
    const subst = (q) => [...new Set(lakemedel.sokKatalog(db, q).map(l => l.substans))];
    expect(subst('Ipren')).toContain('ibuprofen');
    expect(subst('voltaren')).toContain('diklofenak');
    expect(subst('Alvedon')).toContain('paracetamol');
    // Två bokstäver räcker inte för ett handelsnamn, och ett okänt namn ger inget.
    expect(subst('ip').includes('ibuprofen')).toBe(false);
    expect(lakemedel.sokKatalog(db, 'Ingenting-sådant')).toEqual([]);
  });

  test('E3-27: allt som väntar på godkännande står samlat, och bara det någon annan har föreslagit räknas som att godkänna', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const fore = allaAttGodkanna(db, personal(db, 'sysf-2')).find(r => r.id === 'struktur');
    struktur.foresla(db, personal(db, 'sysf'), { slag: 'mattyp', definition: { namn: 'Midjemått', kodverk: 'loinc', kod: '8280-0', ucum: 'cm', min: 30, max: 250 }, motivering: 'Behövs för levnadsvanorna.' });
    const tomas = allaAttGodkanna(db, personal(db, 'sysf')).find(r => r.id === 'struktur');
    const nora = allaAttGodkanna(db, personal(db, 'sysf-2')).find(r => r.id === 'struktur');
    expect(tomas).toMatchObject({ rubrik: 'Mallar och mätvärdestyper', href: '#/struktur', antal: (fore?.antal ?? 0) + 1 });
    expect(nora.kan).toBe(tomas.kan + 1);
    // Ingen rad har patientuppgifter.
    expect(JSON.stringify(allaAttGodkanna(db, personal(db, 'sysf-2')))).not.toMatch(/p\d\d|Gunnar|Åkesson/);
  });
});

describe('Nivå 2 via API (runda 13, r4)', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('E3-27: regelsidans svar har den samlade listan, och patientens huvud har den förvalda mallen', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const o = (await k.get('/api/konfiguration')).data;
    expect(Array.isArray(o.allaAttGodkanna)).toBe(true);
    const l = klient(app);
    await l.logga('lak-akut');
    expect((await l.get('/api/patient/p14')).data.anteckningsmallar[0]).toBe('Akutanteckning');
  });
});
