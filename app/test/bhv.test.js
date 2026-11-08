// Barnhälsovård och tillväxt (Sussa 4.1 och avtalets patientflöde för barnhälsovård, runda 7, r6). Logiken prövas på en
// sandlåda byggd vid en fast tidpunkt, så att barnets ålder och programmet inte beror på dagens datum. API:t prövas
// för behörighet och flöde, utan antaganden om barnets ålder i dag.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, lokalTid } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as T from '../src/tillvaxt.js';
import * as P from '../src/bhv-program.js';
import * as bhv from '../src/bhv.js';
import * as bhvq from '../src/bhvq.js';
import * as vardkontakt from '../src/vardkontakt.js';
import * as fhir from '../src/fhir.js';
import { K11, MATKOD, ATC } from '../src/kodverk.js';
import { testserver, klient, sandlada } from './hjalp.js';

const BAS = new Date('2026-11-08T09:00:00Z');
const NU = BAS.getTime();
const fast = () => byggSeed(BAS);
const pers = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const pat = (db) => db.query("SELECT * FROM patienter WHERE id = 'p61'").get();
const atk = (db, id, val = {}, handling = 'las_matvarden') => new Atkomst(db, pers(db, id), 'p61', val, handling);

describe('Tillväxt', () => {
  test('z-värden och referenslinjer räknas enligt WHO:s tabeller', () => {
    expect(T.zVarde('vikt', 'kvinna', 12, 8.9481)).toBeCloseTo(0, 3);
    expect(T.vardeVidZ(T.lms('vikt', 'kvinna', 12), 2)).toBeCloseTo(11.5, 1);
    expect(T.vardeVidZ(T.lms('langd', 'kvinna', 24), -2)).toBeCloseTo(80.0, 1);
    expect(T.vardeVidZ(T.lms('huvudomfang', 'man', 6), 0)).toBeCloseTo(43.3, 1);
    expect(T.vardeVidZ(T.lms('bmi', 'kvinna', 36), 1)).toBeCloseTo(16.8, 1);
    expect(T.lms('vikt', 'man', 61)).toBeNull();
    const linjer = T.referenslinjer('langd', 'man', 0, 12);
    expect(linjer.map(l => l.sd)).toEqual([-2, -1, 0, 1, 2]);
    expect(linjer[2].punkter[0]).toEqual([0, 49.884]);
    expect(T.REFERENS.licens).toContain('CC BY-NC-SA 3.0 IGO');
  });

  test('korrigerad ålder för för tidigt födda till två år, och målängd ur föräldrarnas längd', () => {
    expect(T.korrigeradAlder(6, 32)).toBeCloseTo(6 - 56 / 30.4375, 3);
    expect(T.korrigeradAlder(6, 39)).toBe(6);
    expect(T.korrigeradAlder(25, 30)).toBe(25);
    expect(T.malangd(166, 181, 'kvinna')).toMatchObject({ varde: 167, fran: 158.5, till: 175.5 });
    expect(T.malangd(166, 181, 'man').varde).toBe(180);
    expect(T.malangd(null, 181, 'man')).toBeNull();
  });

  test('larmar när kurvor korsas, när huvudomfånget växer för snabbt, utanför två SD och för nyfödda', () => {
    const fodd = '2025-01-01';
    const punkt = (matt, manad, z) => ({ tid: new Date(Date.parse(`${fodd}T00:00:00Z`) + manad * 30.4375 * 86400_000).toISOString(), varde: T.vardeVidZ(T.lms(matt, 'man', manad), z) });
    const k = (matt, rader) => T.berika(matt, 'man', fodd, 40, rader);
    const ned = T.larm({ vikt: k('vikt', [punkt('vikt', 6, 0.4), punkt('vikt', 9, -0.7)]) });
    expect(ned).toMatchObject([{ regel: 'korsar_nedat', matt: 'vikt', allvar: 'varning', atgard: 'lakarbesok' }]);
    expect(ned[0].nastaSteg).toContain('BVC-läkaren');
    expect(ned[0].demoregel).toContain('Demoregler');
    const huvud = T.larm({ huvudomfang: k('huvudomfang', [punkt('huvudomfang', 2, 0), punkt('huvudomfang', 4, 1.2)]) });
    expect(huvud[0]).toMatchObject({ regel: 'korsar_uppat', allvar: 'hog', rubrik: 'Huvudomfånget växer för snabbt' });
    expect(T.larm({ langd: k('langd', [punkt('langd', 10, -2.3)]) })[0]).toMatchObject({ regel: 'utanfor', rubrik: 'Längd under två standardavvikelser' });
    // En liten ändring ger inget larm, och en hemmätning som väntar räknas inte.
    expect(T.larm({ vikt: k('vikt', [punkt('vikt', 6, 0.4), punkt('vikt', 9, -0.2)]) })).toEqual([]);
    expect(T.larm({ vikt: k('vikt', [punkt('vikt', 6, 0.4), { ...punkt('vikt', 9, -1.5), vantar: true }]) })).toEqual([]);
    const nyfodd = T.larm({ vikt: k('vikt', [{ tid: `${fodd}T08:00:00Z`, varde: 3.5 }, { tid: '2025-01-06T08:00:00Z', varde: 3.1 }]) }, { fodelsevikt: 3.5 });
    expect(nyfodd[0]).toMatchObject({ regel: 'nyfodd', allvar: 'hog', rubrik: 'Mer än 10 procent under födelsevikten' });
  });

  test('kurvorna, analysen och larmet för barnet byggs av det användaren får se', () => {
    const db = fast();
    const v = bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU });
    expect(v.referens.namn).toBe('WHO:s tillväxtstandard 0 till 5 år');
    expect(v.kurvor.map(k => k.matt)).toEqual(['vikt', 'langd', 'huvudomfang', 'bmi']);
    const vikt = v.kurvor[0];
    expect(vikt.punkter[0]).toMatchObject({ kalla: 'fodsel', varde: 3.42 });
    expect(vikt.punkter[0].alder).toBeLessThan(0.01);
    expect(vikt.punkter.find(p => p.vantar)).toMatchObject({ kalla: 'hemma' });
    expect(vikt.linjer).toHaveLength(5);
    expect(v.larm).toMatchObject([{ regel: 'korsar_nedat', matt: 'vikt' }]);
    expect(v.foraldrar.malangd.varde).toBe(167);
    expect(v.analys.find(a => a.matt === 'langd').text).toContain('ökade');
    const period = bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU, fran: '2026-01-01', till: '2026-12-31' }).analys.find(a => a.matt === 'vikt');
    expect(period.antal).toBe(3);
    expect(period.zAndring).toBeLessThan(-1);
    expect(v.handelser[0].text).toContain('Magsjuk');
  });

  test('ett värde från en annan vårdenhet visas först efter ett aktivt val och ger aldrig larm i inkorgen', () => {
    const db = fast();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p61', 'uso-akut', 'vikt', '6.1', 6.1, 'kg', ?)").run(lokalTid('2026-10-01', '10:00'));
    const utan = bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU });
    expect(utan.kurvor[0].punkter.some(p => p.varde === 6.1)).toBe(false);
    expect(utan.dolda.kraverVal).toBe(1);
    const med = bhv.vy(atk(db, 'lak-vc', { andra_enheter: true }), pat(db), { nu: NU });
    expect(med.kurvor[0].punkter.some(p => p.varde === 6.1)).toBe(true);
    expect(med.larm.some(l => l.regel === 'utanfor')).toBe(true);
    const ik = bhv.inkorg(db, pers(db, 'lak-vc'), () => ({ andra_enheter: true }), NU);
    expect(ik.tillvaxtLarm.some(l => l.regel === 'utanfor')).toBe(false);
  });

  test('mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort', () => {
    const db = fast();
    const [status, ut] = bhv.registrera(atk(db, 'lak-vc', {}, 'registrera_matvarde'), pat(db), { vikt: '9,4', langd: 81.2, huvudomfang: 46.1 }, vardkontakt.knyt);
    expect(status).toBe(201);
    expect(ut.matvarden.map(m => m.typ)).toEqual(['vikt', 'langd', 'huvudomfang']);
    const vk = db.query("SELECT DISTINCT vardkontakt_id FROM matvarden WHERE id IN (?, ?, ?)").all(...ut.matvarden.map(m => m.id));
    expect(vk).toHaveLength(1);
    expect(vk[0].vardkontakt_id).toBeGreaterThan(0);
    expect(ut.text).toContain('Vikt 9,4 kg');
    expect(() => bhv.registrera(atk(db, 'lak-vc', {}, 'registrera_matvarde'), pat(db), {}, vardkontakt.knyt)).toThrow('Skriv vikt, längd eller huvudomfång.');
    expect(() => bhv.registrera(atk(db, 'lak-vc', {}, 'registrera_matvarde'), pat(db), { huvudomfang: 5 }, vardkontakt.knyt)).toThrow('Huvudomfång måste vara ett tal');
  });

  test('födelseuppgifter, föräldrarnas längd och händelser kontrolleras, och en ny uppgift ersätter den förra', () => {
    const db = fast();
    const a = atk(db, 'lak-vc', {}, 'registrera_matvarde');
    expect(() => bhv.registreraUppgift(a, pat(db), { typ: 'langd_mor', varde: 1.66 })).toThrow('Längd, biologisk mor ska vara ett heltal mellan 120 och 220.');
    bhv.registreraUppgift(a, pat(db), { typ: 'langd_mor', varde: 170 });
    expect(bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU }).foraldrar.mor).toBe(170);
    expect(db.query("SELECT count(*) AS n FROM tillvaxt_uppgifter WHERE patient_id = 'p61' AND typ = 'langd_mor'").get().n).toBe(2);
    expect(() => db.query("UPDATE tillvaxt_uppgifter SET varde = 1 WHERE patient_id = 'p61'").run()).toThrow('En tillväxtuppgift ändras inte');
    expect(() => bhv.registreraHandelse(a, pat(db), { text: 'Feber', datum: '2020-01-01' })).toThrow('Datumet ska ligga mellan födelsen och i dag.');
  });
});

describe('Barnhälsovårdens program', () => {
  test('besöken och vaccinationerna följer barnets ålder, och systemet säger varför en dos inte kan ges', () => {
    const p = P.program({ fodd: '2025-05-06', nu: NU, besok: [{ besokId: '12m', status: 'genomfort', tid: '2026-05-06' }], givna: [] });
    expect(p.nasta).toMatchObject({ id: '18m', status: 'nu', yrkesroll: 'sjukskoterska' });
    expect(p.nasta.vacciner.map(v => v.id)).toEqual(['mpr1']);
    expect(p.missade.map(b => b.id)).toContain('6v');
    const rota = P.provaVaccin(P.vaccinRad('rota1'), { fodd: '2025-05-06', nu: NU });
    expect(rota).toMatchObject({ ok: false });
    expect(rota.skal).toContain('påbörjas inte efter 12 veckors ålder');
    expect(P.provaVaccin(P.vaccinRad('hexa2'), { fodd: '2025-05-06', nu: NU }).skal).toBe('Sexvalent vaccin, dos 1 är inte given än.');
    expect(P.provaVaccin(P.vaccinRad('bcg'), { fodd: '2025-05-06', nu: NU }).skal).toContain('ökad risk för tuberkulos');
    const tidig = P.provaVaccin(P.vaccinRad('hexa2'), { fodd: '2025-05-06', nu: Date.parse('2025-10-06T10:00:00Z'), givna: [{ vaccinId: 'hexa1', tid: '2025-09-01T10:00:00Z' }] });
    expect(tidig.skal).toContain('minst 56 dagar');
    expect(P.KALLOR.vaccin).toContain('Folkhälsomyndigheten');
  });

  test('vaccinationen prövas mot programmet och får ATC och dos av systemet', () => {
    const db = fast();
    const a = atk(db, 'lak-vc', {}, 'vaccinera');
    const [s, v] = bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU);
    expect(s).toBe(201);
    expect(v).toMatchObject({ vaccinId: 'mpr1', atc: 'J07BD52', dos: 1, atcText: ATC.J07BD52 });
    expect(db.query('SELECT vardkontakt_id FROM vaccinationer WHERE id = ?').get(v.id).vardkontakt_id).toBeGreaterThan(0);
    expect(() => bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)).toThrow('är redan given');
    expect(() => bhv.vaccinera(a, pat(db), { vaccinId: 'bcg', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)).toThrow('ökad risk för tuberkulos');
    expect(() => db.query('UPDATE vaccinationer SET dos = 2 WHERE id = ?').run(v.id)).toThrow('En registrerad vaccination ändras inte');
  });

  test('hälsobesöket bokas i tidboken från systemets förslag, med kallelse och väntelista', () => {
    const db = fast();
    const v = bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU });
    expect(v.bhv.program.nasta.id).toBe('18m');
    expect(v.bhv.forslag.length).toBeGreaterThan(0);
    expect(v.bhv.forslag[0].vardgivare.namn).toBe('Maja Lindholm');
    const [s, ut] = bhv.boka(atk(db, 'lak-vc', {}, 'boka_bhv'), pat(db), { besokId: '18m', tidId: v.bhv.forslag[0].tidId }, NU);
    expect(s).toBe(201);
    expect(ut.text).toContain('Besök vid 18 månader är bokat');
    expect(ut.text).toContain('Mässling');
    expect(v.bhv.forslag.every(f => f.mottagning.id === 'vc-tybble-bvc')).toBe(true);
    const b = db.query('SELECT * FROM bokningar WHERE id = ?').get(ut.bokningId);
    expect(b).toMatchObject({ patient_id: 'p61', status: 'bokad' });
    expect(db.query('SELECT status FROM vantelista WHERE bokning_id = ?').get(b.id).status).toBe('bokad');
    expect(db.query('SELECT count(*) AS n FROM kallelser WHERE bokning_id = ?').get(b.id).n).toBe(1);
    expect(bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU }).bhv.program.besok.find(x => x.id === '18m').status).toBe('bokat');
    expect(() => bhv.boka(atk(db, 'lak-vc', {}, 'boka_bhv'), pat(db), { besokId: '18m', tidId: v.bhv.forslag[1].tidId }, NU)).toThrow('är redan bokat');
    // Utan tid hamnar besöket på väntelistan, och vid ett larm föreslår systemet ett läkarbesök.
    const [, vl] = bhv.boka(atk(db, 'lak-vc', {}, 'boka_bhv'), pat(db), { besokId: '30m' }, NU);
    expect(vl.text).toContain('står på väntelistan');
    expect(bhv.lakarbesok(atk(db, 'lak-vc', {}, 'boka_bhv'), pat(db), {})[1].text).toContain('BVC-läkaren');
  });

  test('före varje dos frågar systemet alltid om vaccinationer som har getts någon annanstans', () => {
    const db = fast();
    const a = atk(db, 'lak-vc', {}, 'vaccinera');
    let fel;
    try { bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1' }, vardkontakt.knyt, NU); } catch (e) { fel = e; }
    expect(fel).toMatchObject({ status: 400, kod: 'kraver_fraga', message: bhv.FRAGA_ANDRA });
    expect(() => bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'ja' }, vardkontakt.knyt, NU)).toThrow('Registrera inte dosen förrän');
    expect(bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)[0]).toBe(201);
  });

  test('en vaccination som kräver aktivt val ger en varning utan vårdenhet, vaccin eller datum, och dosen kan ges efter en bekräftelse som loggas', () => {
    const db = fast();
    db.query("INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, registrerad) VALUES ('p61', 'uso-akut', 'mpr1', 'J07BD52', 1, ?, ?)").run('2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z');
    const v = bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU });
    expect(v.bhv.vaccinationer.some(x => x.vaccinId === 'mpr1')).toBe(false);
    expect(v.bhv.doldaVaccinationer).toEqual({ kraverVal: true, text: bhv.VARNING_DOLDA });
    for (const s of ['Akutmottagningen', 'uso-akut', '2026-11-01']) expect(JSON.stringify(v)).not.toContain(s);
    const a = atk(db, 'lak-vc', {}, 'vaccinera');
    let fel;
    try { bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU); } catch (e) { fel = e; }
    expect(fel).toMatchObject({ status: 409, kod: 'kraver_bekraftelse', message: 'Barnet har vaccinationer registrerade på en annan vårdenhet. Gör ett aktivt val för att se dem innan du ger dosen.' });
    for (const s of ['Akutmottagningen', 'uso-akut', '2026-11-01', 'J07BD52', 'Mässling', 'mpr1']) expect(JSON.stringify({ m: fel.message, e: fel.extra })).not.toContain(s);
    const [st] = bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej', bekraftaDolda: true }, vardkontakt.knyt, NU);
    expect(st).toBe(201);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND handling = 'vaccinera' AND syfte LIKE 'Dosen gavs utan aktivt val%'").get().n).toBe(1);
    // Med ett aktivt val syns vaccinationen, och skälet säger att dosen redan är given.
    expect(() => bhv.vaccinera(atk(db, 'lak-vc', { andra_enheter: true }, 'vaccinera'), pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)).toThrow('är redan given');
  });

  test('en vaccination bakom en spärr röjs aldrig: ingen varning, bara den vanliga frågan som alla barn får', () => {
    const db = fast();
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p61', 'uso-psyk', '2026-10-01')").run();
    db.query("INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, registrerad) VALUES ('p61', 'uso-psyk', 'mpr1', 'J07BD52', 1, ?, ?)").run('2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z');
    const v = bhv.vy(atk(db, 'lak-vc', { andra_enheter: true }), pat(db), { nu: NU });
    expect(v.bhv.doldaVaccinationer).toEqual({ kraverVal: false, text: null });
    const a = atk(db, 'lak-vc', { andra_enheter: true }, 'vaccinera');
    let fel;
    try { bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1' }, vardkontakt.knyt, NU); } catch (e) { fel = e; }
    expect(fel).toMatchObject({ status: 400, kod: 'kraver_fraga', message: bhv.FRAGA_ANDRA });
    expect(bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)[0]).toBe(201);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND syfte LIKE 'Dosen gavs utan aktivt val%'").get().n).toBe(0);
  });

  test('sjuksköterskor gör barnhälsovårdens flöde med ett uppdrag på barnavårdscentralen, och utan uppdrag nekas det', () => {
    const db = fast();
    expect(bhv.uppdrag(db, pers(db, 'ssk-vc'))).toMatchObject({ enhet: 'vc-tybble-bvc' });
    expect(bhv.session(db, pers(db, 'ssk-vc'))).toMatchObject({ enhet: 'vc-tybble', uppdrag: true });
    expect(bhv.vaccinera(atk(db, 'ssk-vc', {}, 'vaccinera'), pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)[0]).toBe(201);
    db.query("UPDATE bhv_uppdrag SET till = '2026-01-01' WHERE personal_id = 'ssk-vc'").run();
    expect(bhv.session(db, pers(db, 'ssk-vc'))).toBeNull();
    expect(() => bhv.boka(atk(db, 'ssk-vc', {}, 'boka_bhv'), pat(db), { besokId: '30m' }, NU)).toThrow('uppdrag på barnavårdscentralen');
  });

  test('bara barnavårdscentralen där barnet är inskrivet bokar och vaccinerar', () => {
    const db = fast();
    const a = new Atkomst(db, pers(db, 'lak-kard'), 'p61', { nodatkomst: true }, 'vaccinera');
    expect(() => bhv.vaccinera(a, pat(db), { vaccinId: 'mpr1', andraVaccinationer: 'nej' }, vardkontakt.knyt, NU)).toThrow('Barnet är inskrivet i barnhälsovården på en annan vårdenhet');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND handling = 'vaccinera' AND resultat = 'nekad'").get().n).toBe(1);
    const adm = new Atkomst(db, pers(db, 'adm-kard'), 'p61', {}, 'boka_bhv');
    expect(() => bhv.boka(adm, pat(db), { besokId: '18m' }, NU)).toThrow('Yrkesrollen får inte boka hälsobesök');
  });
});

describe('Mätningar hemma och Min journal', () => {
  const inv = (db, id) => {
    const i = db.query('SELECT * FROM invanare WHERE id = ?').get(id);
    return { db, invanare: i, patient: pat(db), relation: id.startsWith('inv-vh') ? 'vardnadshavare' : 'egen', logga() { this.loggad = true; } };
  };

  test('vårdnadshavaren registrerar en mätning som väntar tills barnavårdscentralen bekräftar den', () => {
    const db = fast();
    const [s, ut] = bhv.minRegistrera(inv(db, 'inv-vh02'), { vikt: '9,3', datum: '2026-11-07' }, NU);
    expect(s).toBe(201);
    expect(ut.text).toContain('Barnavårdscentralen bekräftar');
    expect(() => bhv.minRegistrera(inv(db, 'inv-vh02'), { vikt: 9.3, datum: '2026-12-01' }, NU)).toThrow('Datumet ska vara i dag');
    expect(() => bhv.minRegistrera(inv(db, 'inv-vh02'), { vikt: 900 }, NU)).toThrow('Vikt ska vara ett tal');
    const ik = bhv.inkorg(db, pers(db, 'lak-vc'), () => ({}), NU);
    expect(ik.hemmatningarAttBekrafta).toHaveLength(2);
    const h = db.query("SELECT * FROM hemmatningar WHERE varde = 9.3").get();
    expect(bhv.vy(atk(db, 'lak-vc'), pat(db), { nu: NU }).larm.every(l => !l.text.includes('9,3'))).toBe(true);
    // En annan barnavårdscentral kan inte bekräfta, och ett avvisande kräver en orsak.
    expect(() => bhv.bekrafta(new Atkomst(db, pers(db, 'lak-kard'), 'p61', { nodatkomst: true }, 'registrera_matvarde'), h)).toThrow('en annan barnavårdscentral');
    expect(() => bhv.bekrafta(atk(db, 'lak-vc', {}, 'registrera_matvarde'), h, { avvisa: true })).toThrow('Skriv varför');
    const b = bhv.bekrafta(atk(db, 'lak-vc', {}, 'registrera_matvarde'), h);
    expect(b.status).toBe('bekraftad');
    expect(db.query('SELECT kalla, tid FROM matvarden WHERE id = ?').get(b.matvardeId)).toMatchObject({ kalla: 'hemmatning', tid: h.tid });
    expect(() => bhv.bekrafta(atk(db, 'lak-vc', {}, 'registrera_matvarde'), db.query('SELECT * FROM hemmatningar WHERE id = ?').get(h.id))).toThrow('redan bekräftad');
  });

  test('Min journal visar kurvorna och vaccinationerna utan larm, id eller personal', () => {
    const db = fast();
    const m = bhv.minTillvaxt(inv(db, 'inv-vh02'), NU);
    expect(m.kurvor[0].punkter.length).toBeGreaterThan(10);
    expect(m.vaccinationer.map(v => v.vaccinId)).toContain('hexa3');
    expect(m.hemmatningar).toHaveLength(1);
    expect(m.kanRegistrera).toBe(true);
    expect(m.larm).toBeUndefined();
    const json = JSON.stringify(m);
    for (const s of ['ssk-bvc', 'lak-vc', 'Maja Lindholm', 'registreradAv', 'givetAv']) expect(json).not.toContain(s);
    expect(() => bhv.minRegistrera({ ...inv(db, 'inv-p61'), relation: 'egen' }, { vikt: 9 }, NU)).toThrow('registreras av vårdnadshavaren');
  });
});

describe('Rapportering till Svenska barnhälsovårdsregistret', () => {
  test('systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren', () => {
    const db = fast();
    const s = bhvq.sammanstall(db, pers(db, 'lak-vc'));
    expect(s.mottagare).toContain('simulerad');
    expect(s.barn).toHaveLength(1);
    const post = s.barn[0].post;
    expect(post.person.id).toEqual({ root: K11.oid.personnummer, extension: '202505062386' });
    expect(post.tillvaxt.find(o => o.typ.code === '27113001')).toMatchObject({ typ: { codeSystem: '1.2.752.116.2.1.1', displayName: 'kroppsvikt' }, varde: { unit: 'kg' } });
    expect(post.tillvaxt.find(o => o.typ.code === '364589006').varde.value).toBe('3,420');
    expect(post.tillvaxt.find(o => o.typ.code === '53851000052106').varde.value).toBe('166');
    expect(post.besok.find(b => b.typ.code === '3').typ.displayName).toBe('hembesök');
    expect(post.besok.find(b => b.typ.code === '2').personal.befattning.code).toMatch(/^20601[18]|201011$/);
    expect(post.tillvaxt[0].tid).toMatch(/^\d{8}$/);
    const [st, ut] = bhvq.skicka(db, pers(db, 'lak-vc'));
    expect(st).toBe(201);
    expect(ut.kvittens).toBe('BHVQ-SIM-000001');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND handling = 'rapportera_bhvq'").get().n).toBe(1);
    expect(bhvq.sammanstall(db, pers(db, 'lak-vc')).text).toBe('Det finns inget nytt att rapportera sedan förra utskicket.');
    expect(() => bhvq.skicka(db, pers(db, 'lak-vc'))).toThrow('Det finns inget nytt att rapportera.');
    expect(() => db.query('DELETE FROM bhvq_utskick').run()).toThrow('Ett utskick raderas inte');
  });

  test('ett orimligt värde hålls kvar med en förklaring och en länk, och undantagen räknas', () => {
    const db = fast();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid) VALUES ('p61', 'vc-tybble-bvc', 'vikt', '91.8', 91.8, 'kg', ?)").run(lokalTid('2026-11-05', '10:00'));
    const s = bhvq.sammanstall(db, pers(db, 'lak-vc'));
    expect(s.antal).toMatchObject({ barn: 0, medFel: 1 });
    expect(s.barn[0].fel[0]).toMatchObject({ href: '#/patient/p61/tillvaxt' });
    expect(s.barn[0].fel[0].text).toContain('orimligt för barnets ålder');
    expect(() => bhvq.skicka(db, pers(db, 'lak-vc'))).toThrow('har fel som behöver rättas först');
    db.query("UPDATE bhv_inskrivning SET bhvq_motsatt = 1 WHERE patient_id = 'p61'").run();
    const m = bhvq.sammanstall(db, pers(db, 'lak-vc'));
    expect(m.undantagna).toEqual({ motsatt: 1, skyddad: 0 });
    expect(JSON.stringify(m)).not.toContain('Holmqvist');
  });

  test('en annan vårdenhet ser inget och en roll utan behörighet nekas', () => {
    const db = fast();
    expect(bhvq.sammanstall(db, pers(db, 'lak-kard')).barn).toEqual([]);
    expect(() => bhvq.sammanstall(db, pers(db, 'adm-kard'))).toThrow('behörighet');
    const u = bhv.uppfoljning(db, pers(db, 'lak-vc'), NU);
    expect(u.antalBarn).toBe(1);
    expect(u.besok.find(b => b.id === '12m')).toMatchObject({ barn: 1, iTid: 1, medAllaMatt: 1 });
    expect(JSON.stringify(u)).not.toMatch(/p61|Holmqvist|202505062386/);
  });
});

describe('Licens för tillväxtreferensen', () => {
  test('WHO-tabellen har en egen licensfil och omfattas inte av EUPL', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const kod = readFileSync(new URL('../src/seed/who-tillvaxt.js', import.meta.url), 'utf8');
    expect(kod).toContain('CC BY-NC-SA 3.0 IGO');
    expect(kod).toContain('LICENS-who-tillvaxt.txt');
    const fil = new URL('../src/seed/LICENS-who-tillvaxt.txt', import.meta.url);
    expect(existsSync(fil)).toBe(true);
    const licens = readFileSync(fil, 'utf8');
    for (const s of ['CC BY-NC-SA 3.0 IGO', 'World Health Organization', 'https://creativecommons.org/licenses/by-nc-sa/3.0/igo/', 'omfattas inte av EUPL', 'who-tillvaxt.js']) expect(licens).toContain(s);
  });

  test('barn med skyddade personuppgifter undantas från registret enligt en konstant', () => {
    expect(bhvq.UNDANTA_SKYDDAD).toBe(true);
    const db = fast();
    db.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p61'").run();
    expect(bhvq.sammanstall(db, pers(db, 'lak-vc')).undantagna).toEqual({ motsatt: 0, skyddad: 1 });
  });
});

describe('Plan för införande av tillväxt', () => {
  test('planen har alla delar som Sussa 11.3.1.1 kräver och visas på barnavårdscentralens sida', async () => {
    const { PLAN, DELAR_11_3_1_1 } = await import('../src/bhv-plan.js');
    expect(PLAN.delar.map(d => d.rubrik)).toEqual(DELAR_11_3_1_1);
    for (const d of PLAN.delar) expect(d.text.length).toBeGreaterThan(80);
    expect(PLAN.status).toContain('Inte överenskommet');
  });
});

describe('Kodverk och FHIR för tillväxt', () => {
  test('huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns', () => {
    expect(MATKOD.huvudomfang.coding[0]).toMatchObject({ code: '9843-4', display: 'Head Occipital-frontal circumference' });
    const db = fast();
    const m = db.query("SELECT * FROM matvarden WHERE patient_id = 'p61' AND typ = 'huvudomfang' LIMIT 1").get();
    const o = fhir.observation(db, m);
    expect(o.meta.profile[0]).toBe('http://hl7.org/fhir/StructureDefinition/headcircum');
    expect(o.valueQuantity).toMatchObject({ unit: 'cm', system: 'http://unitsofmeasure.org', code: 'cm' });
    expect(Object.keys(K11.tillvaxt)).toEqual(['fodelsevikt', 'fodelselangd', 'fodelse_huvudomfang', 'graviditetslangd', 'vikt', 'langd', 'huvudomfang', 'langd_mor', 'langd_far']);
  });
});

describe('API för barnhälsovården', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());
  const inloggad = async (id) => { const k = klient(app); await k.logga(id); return k; };

  test('läkaren på barnavårdscentralen ser tillväxten och registrerar vikt och längd', async () => {
    const k = await inloggad('lak-vc');
    expect((await k.get('/api/session')).data.bhv).toEqual({ enhet: 'vc-tybble', uppdrag: false });
    const d = (await k.get('/api/patient/p61/tillvaxt')).data;
    expect(d.kurvor).toHaveLength(4);
    expect(d.kan).toEqual({ registrera: true, vaccinera: true, boka: true });
    const r = await k.post('/api/patient/p61/tillvaxt', { vikt: 9.5, langd: 81 });
    expect(r.status).toBe(201);
    expect(r.data.matvarden).toHaveLength(2);
    const logg = sandlada(app, k).db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p61' AND resurs LIKE 'tillvaxt:%'").get().n;
    expect(logg).toBeGreaterThan(0);
  });

  test('personal utan vårdrelation nekas, och sjuksköterskan på kardiologen har ingen barnhälsovård', async () => {
    const k = await inloggad('ssk-kard');
    expect((await k.get('/api/session')).data.bhv).toBeNull();
    const r = await k.get('/api/patient/p61/tillvaxt');
    expect(r.status).toBe(403);
    expect((await k.get('/api/bhv/bhvq')).status).toBe(403);
  });

  test('vårdnadshavaren läser kurvorna i Min journal och skickar en mätning, och andra invånare får inget', async () => {
    const k = klient(app);
    await k.post('/api/login/invanare', { invanareId: 'inv-vh02' });
    const m = await k.get('/api/min/journal/p61/tillvaxt');
    expect(m.status).toBe(200);
    expect(m.data.kurvor).toHaveLength(4);
    expect((await k.post('/api/min/journal/p61/tillvaxt', { vikt: 9.4 })).status).toBe(201);
    const annan = klient(app);
    await annan.post('/api/login/invanare', { invanareId: 'inv-vh01' });
    expect((await annan.get('/api/min/journal/p61/tillvaxt')).status).toBe(404);
    expect((await annan.post('/api/min/journal/p61/tillvaxt', { vikt: 9.4 })).status).toBe(404);
  });

  test('FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal', async () => {
    const k = await inloggad('lak-vc');
    const b = (await k.get('/fhir/Immunization?patient=p61')).data;
    expect(b.total).toBe(8);
    const im = b.entry.map(e => e.resource).find(r => r.vaccineCode.coding[0].code === 'J07CA09');
    expect(im).toMatchObject({ resourceType: 'Immunization', status: 'completed', patient: { reference: 'Patient/p61' }, primarySource: true,
      vaccineCode: { coding: [{ system: 'http://www.whocc.no/atc', display: ATC.J07CA09 }] }, protocolApplied: [{ series: 'Barnvaccinationsprogrammet' }] });
    expect((await k.get(`/fhir/Immunization/${im.id}`)).status).toBe(200);
    expect(sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1').get()).toMatchObject({ handling: 'las_oversikt', resurs: `fhir/Immunization/${im.id}` });
    const adm = await inloggad('adm-kard');
    expect((await adm.get(`/fhir/Immunization/${im.id}`)).status).toBe(403);
    const inv = klient(app);
    await inv.post('/api/login/invanare', { invanareId: 'inv-vh02' });
    const ib = (await inv.get('/fhir/Immunization?patient=p61')).data;
    expect(ib.total).toBe(8);
    expect(JSON.stringify(ib)).not.toContain('Practitioner/');
    const allt = (await inv.get('/fhir/Patient/p61/$everything')).data;
    expect(allt.entry.some(e => e.resource.resourceType === 'Immunization')).toBe(true);
  });

  test('inkorgen visar larm, mätningar att bekräfta och besök att boka bara för barnavårdscentralen', async () => {
    const k = await inloggad('lak-vc');
    const ik = (await k.get('/api/inkorg')).data;
    expect(ik.hemmatningarAttBekrafta.length).toBeGreaterThan(0);
    expect(ik.hemmatningarAttBekrafta[0].patient.id).toBe('p61');
    const h = ik.hemmatningarAttBekrafta[0];
    expect((await k.post(`/api/hemmatning/${h.id}/bekrafta`)).data.status).toBe('bekraftad');
    const s = await inloggad('lak-kard');
    const ik2 = (await s.get('/api/inkorg')).data;
    expect(ik2.tillvaxtLarm).toEqual([]);
    expect(ik2.hemmatningarAttBekrafta).toEqual([]);
    expect(ik2.bhvAttBoka).toEqual([]);
  });
});
