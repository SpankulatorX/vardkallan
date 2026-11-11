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
import * as tidbok from '../src/tidbok.js';
import * as op from '../src/operation.js';
import { addDagar } from '../src/db.js';

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

describe('Väntelistan (runda 13, r4, E3-8 och E3-9)', () => {
  const remissPost = (db) => db.query("SELECT * FROM vantelista WHERE patient_id = 'p10' AND remiss_id IS NOT NULL AND status = 'vantar'").get();
  test('vårdgarantin har en egen kolumn, och väntan som patienten väljer eller som har medicinska skäl räknas inte', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const post = remissPost(db);
    const a = () => atk(db, 'adm-kard', 'p10', {}, 'vantelista');
    const fore = tidbok.vantelistaUt(db, post, '2026-11-12').vardgaranti;
    expect(fore).toMatchObject({ galler: true, pagar: null, pausadeDagar: 0 });
    expect(fore.datum).toBe(addDagar(post.fran, 90));
    // Patienten vill vänta: en egen åtgärd, inte en ändrad prioritet.
    expect(() => tidbok.prioritera(a(), post, { prioritet: 'lag', orsak: 'patientvald' })).toThrow('Välj orsaken');
    const ut = tidbok.registreraVantan(a(), post, { typ: 'pvv', steg: 'start', kommentar: 'Reser bort i två veckor.' });
    expect(ut.vantan).toMatchObject({ typ: 'pvv', typText: 'Patientvald väntan', fran: '2026-11-12' });
    expect(ut.vardgaranti.pagar.typ).toBe('pvv');
    expect(ut.vardgaranti.text).toBe('Räknas inte under patientvald väntan sedan 2026-11-12.');
    expect(ut.patientvald).toBe(true);
    expect(() => tidbok.registreraVantan(a(), tidbok.vantelistaRad(db, post.id), { typ: 'mov', steg: 'start' })).toThrow('pågår redan');
    // Tio dagar senare kan patienten få tid igen. Vårdgarantins datum har flyttats tio dagar.
    stallKlockan(KLOCKAN('10:00').getTime() + 10 * 86400_000);
    const efter = tidbok.registreraVantan(a(), tidbok.vantelistaRad(db, post.id), { typ: 'pvv', steg: 'slut' });
    expect(efter.vantan).toBeNull();
    expect(efter.patientvald).toBe(false);
    expect(efter.vardgaranti).toMatchObject({ pausadeDagar: 10, datum: addDagar(post.fran, 100) });
    // Historiken har båda händelserna.
    expect(efter.handelser.map(h => h.typ)).toEqual(expect.arrayContaining(['pvv_start', 'pvv_slut']));
  });

  test('en post tas bort från väntelistan med en orsak, och bara av vårdenheten själv', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const post = remissPost(db);
    expect(() => tidbok.avslutaPost(atk(db, 'adm-kard', 'p10', {}, 'vantelista'), post, { orsak: 'okand' })).toThrow('Välj varför');
    expect(() => tidbok.avslutaPost(atk(db, 'lak-vc', 'p10', {}, 'vantelista'), post, {})).toThrow();
    const ut = tidbok.avslutaPost(atk(db, 'adm-kard', 'p10', {}, 'vantelista'), post, { orsak: 'annan_vard' });
    expect(ut.status).toBe('avslutad');
    expect(ut.handelser.at(-1)).toMatchObject({ typ: 'avslutad', detalj: 'Patienten har fått vård på annat sätt.' });
  });
});

describe('Bokning från väntelistan (runda 13, r4, E3-10 och E3-47)', () => {
  test('en inskriven patient får förslag från en vecka efter i dag, med hans kommande tider på vårdenheten', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const post = db.query("SELECT * FROM vantelista WHERE patient_id = 'p01' AND status = 'vantar' AND enhet_id = 'uso-kard'").get();
    const f = tidbok.forslagForPost(atk(db, 'adm-kard', 'p01', {}, 'boka'), post);
    expect(f.inskriven.text).toContain('Patienten är inskriven (Avd 72');
    expect(f.forslag.length).toBeGreaterThan(0);
    for (const x of f.forslag) expect(Date.parse(x.start)).toBeGreaterThanOrEqual(Date.parse(lokalTid(addDagar('2026-11-12', tidbok.INSKRIVEN_FORSLAG_DAGAR), '00:00')));
    // Elkonverteringen som redan är bokad syns i dialogen.
    expect(f.kommande.map(k => k.orsak)).toContain('Elkonvertering');
    // En patient som inte är inskriven får förslag som förut.
    const p10 = db.query("SELECT * FROM vantelista WHERE patient_id = 'p10' AND status = 'vantar'").get();
    expect(tidbok.forslagForPost(atk(db, 'adm-kard', 'p10', {}, 'boka'), p10).inskriven).toBeNull();
  });

  test('systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const nu = KLOCKAN('10:00').getTime();
    const post = db.query("SELECT * FROM vantelista WHERE patient_id = 'p10' AND status = 'vantar'").get();
    // Karl-Erik Brandt vill få kallelser med brev. Vid normal prioritet ligger förslagen minst tre dagar fram.
    tidbok.prioritera(atk(db, 'adm-kard', 'p10', {}, 'vantelista'), post, { prioritet: post.prioritet === 'normal' ? 'lag' : 'normal', orsak: 'bedomning' });
    const normal = tidbok.vantelistaRad(db, post.id);
    const f = tidbok.forslagForPost(atk(db, 'adm-kard', 'p10', {}, 'boka'), normal);
    expect(f.forslag.length).toBeGreaterThan(0);
    for (const x of f.forslag) expect(Date.parse(x.start) - nu).toBeGreaterThanOrEqual(tidbok.BREV_DAGAR * 86400_000);
    // Bokas en tid i morgon ändå (vid hög prioritet eller fritt) skickas inget brev, och patienten ska få tiden per telefon.
    const imorgon = db.query(`SELECT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = 'uso-kard-mott' AND t.tidstyp = 'nybesok' AND s.yrkesroll = 'lakare'
      AND t.start > ? AND t.start < ? AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id) ORDER BY t.start`).get(new Date(nu).toISOString(), new Date(nu + 2 * 86400_000).toISOString());
    if (imorgon) {
      const { kallelse } = tidbok.bokaPostRad(db, normal, imorgon, { av: 'adm-kard' });
      expect(kallelse).toMatchObject({ kanal: 'brev', status: 'kan_inte', skickad: null });
      expect(kallelse.forklaring).toContain('ett brev hinner inte fram');
    }
  });
});

describe('Anestesiläkaren (runda 13, r4, E1-32)', () => {
  test('ser de operationer som är beställda till anestesienheten i programmet, och inte andra sjukhus operationer', () => {
    stallKlockan(KLOCKAN('06:00'));
    const db = nySessionsDb();
    const pers = personal(db, 'lak-ane-kkoga');
    const o = op.oversikt(db, pers, () => ({}), { datum: '2026-11-12' }, KLOCKAN('06:00'));
    const ops = o.salar.find(x => x.id === 'kkoga-sal-1').operationer;
    expect(ops.map(x => x.patient?.id)).toEqual(['p71', 'p72']);
    expect(ops.every(x => !x.upptagen && x.ingrepp)).toBe(true);
    // Undersköterskan på kardiologen på ett annat sjukhus ser ingen av dem.
    const usk = JSON.stringify(op.oversikt(db, personal(db, 'usk-kard'), () => ({}), { datum: '2026-11-12' }, KLOCKAN('06:00')));
    for (const t of ['p71', 'p72', 'Göran', 'Barbro']) expect(usk).not.toContain(t);
  });

  test('har patienterna med beställda operationer i arbetslistan', async () => {
    stallKlockan(KLOCKAN('06:00'));
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('lak-ane-kkoga');
      const lista = (await k.get('/api/arbetslista')).data;
      const ids = lista.map(r => r.id);
      for (const pid of ['p71', 'p72', 'p73']) expect(ids).toContain(pid);
      expect(lista.find(r => r.id === 'p71')).toMatchObject({ plats: expect.stringMatching(/^Operation, Planerad /), orsak: 'Primär total höftledsplastik med cement' });
    } finally { app.stopp(); }
  });
});

describe('Anestesiläkaren, säkerhetsgranskningen (runda 13, r4)', () => {
  test('en avslutad operation (klar) visas inte för anestesienheten i programmet, bara som upptagen tid', () => {
    stallKlockan(KLOCKAN('10:00'));
    const db = nySessionsDb();
    const p07 = db.query("SELECT p.start FROM op_anmalningar a JOIN op_planeringar p ON p.anmalan_id = a.id WHERE a.patient_id = 'p07'").get();
    const dag = new Date(p07.start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    // En ny anmälan för samma patient ger anestesienheten relation igen. Den avslutade operationen ska ändå inte visas.
    op.anmal(atk(db, 'lak-kkoga', 'p07', {}, 'operation_anmala'), { kva: 'NGB49', sida: 'hoger' }, KLOCKAN('09:00'));
    const o = op.oversikt(db, personal(db, 'lak-ane-kkoga'), () => ({}), { datum: dag }, KLOCKAN('10:00'));
    const ops = o.salar.flatMap(x => x.operationer);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some(x => x.patient?.id === 'p07')).toBe(false);
    expect(JSON.stringify(o)).not.toContain('Margareta');
  });

  test('arbetslistan tar inte ingreppet från en anmälan som anestesiläkaren inte får se (spärrad vårdenhet)', async () => {
    stallKlockan(KLOCKAN('06:00'));
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('lak-ane-kkoga');
      const db = app.sessioner.get(k.kaka().split('=')[1]).db;
      db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p71', 'kkoga-ort', '2026-11-01')").run();
      const rad = (await k.get('/api/arbetslista')).data.find(r => r.id === 'p71');
      if (rad) {
        expect(rad.orsak).toBeNull();
        expect(JSON.stringify(rad)).not.toMatch(/höftled|Operation, /i);
      }
    } finally { app.stopp(); }
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
