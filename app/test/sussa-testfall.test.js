// Sussas användbarhetstester som automatiska tester (runda 7, r1). Registret med de 34 testfallen, poängen och
// tidsmodellen enligt Bilaga F1:2, demoläget med testpatienterna och resultatfilen från test/sussa-testfall.cjs.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nyDb, personal, testserver, klient, sandlada } from './hjalp.js';
import * as R from '../src/sussa-testfall.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { SUSSA_PATIENTER, BERTIL_PK, ANKOMNA_5_6, OSIGNERADE_4_4 } from '../src/seed/sussa-testdata.js';
import { KRAV } from '../src/krav.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';
import { SUS_SUSSA, susPoang, kodGiltig, kommentarGiltig, DIALOGPRINCIPER } from '../public/js/sussa-formular.js';

const T = R.TEST_REGISTER;
const namn = (s) => s.replace(R.TEST, '');
const testpnr = new Set(JSON.parse(readFileSync(join(import.meta.dir, '..', 'src', 'seed', 'testpersonnummer.json'), 'utf8')));

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Sussas testfall', () => {
  test(namn(T[0]), () => {
    expect(R.TESTFALL).toHaveLength(34);
    const perTema = {};
    for (const x of R.TESTFALL) perTema[x.tema] = (perTema[x.tema] ?? 0) + 1;
    // Bilaga F1:2 avsnitt 3: 4, 6, 5, 4, 8, 3 och 4 testfall i de sju temana.
    expect(perTema).toEqual({ 1: 4, 2: 6, 3: 5, 4: 4, 5: 8, 6: 3, 7: 4 });
    expect(new Set(R.TESTFALL.map(x => x.nr)).size).toBe(34);
    for (const x of R.TESTFALL) {
      expect(x.titel.length).toBeGreaterThan(3);
      expect(x.roller.length).toBeGreaterThan(0);
      for (const r of x.roller) expect(Object.keys(R.ROLLER)).toContain(r);
      expect(x.syfte.length).toBeGreaterThan(10);
      expect(x.mal.length).toBeGreaterThan(0);
      expect(x.slut.length).toBeGreaterThan(5);
      expect([6, 9, 15, 18]).toContain(x.tidsklass);
      expect(x.tidsklassSkal.length).toBeGreaterThan(5);
      // Antingen genomförs testfallet med minst en roll och en klickbudget, eller så står det vad som saknas.
      expect(Boolean(x.korningar.length) !== Boolean(x.saknas)).toBe(true);
      expect(new Set(x.korningar.map(k => k.roll)).size).toBe(x.korningar.length);
      for (const k of x.korningar) {
        expect(x.roller).toContain(k.roll);
        expect(k.demoroll).toBe(R.ROLLER[k.roll].demoroll);
        expect(k.budget).toBeGreaterThan(0);
        expect(k.motivering.length).toBeGreaterThan(20);
      }
    }
    // Personalens namn i Sussas testdata står inte i registret, bara deras roller.
    const text = JSON.stringify(R.TESTFALL);
    for (const n of ['Aron Alm', 'Maria Larsson', 'Sven Lind', 'Karl Persson', 'Sara Karlsson', 'Cecilia Libby']) expect(text).not.toContain(n);
    // Varje demoroll som spelar ett testfall finns i demon.
    const db = nyDb();
    for (const { k } of R.KORNINGAR) expect(db.query('SELECT demo FROM personal WHERE id = ?').get(k.demoroll)?.demo).toBe(1);
  });

  test(namn(T[1]), () => {
    // Bilaga F1:2 avsnitt 4.2: 10 poäng under en tredjedel av den maximala tiden, 5 under två tredjedelar, 2 under
    // den maximala tiden och 0 därefter.
    const fall = { 6: [119, 120, 239, 240, 359, 360], 9: [179, 180, 359, 360, 539, 540], 15: [299, 300, 599, 600, 899, 900], 18: [359, 360, 719, 720, 1079, 1080] };
    for (const [klass, sek] of Object.entries(fall)) expect(sek.map(s => R.tidspoang(s, Number(klass)))).toEqual([10, 5, 5, 2, 2, 0]);
    expect(R.tidspoang(30, 7)).toBe(0);
    expect(R.tidspoang(Number.NaN, 6)).toBe(0);
  });

  test(namn(T[2]), () => {
    expect(R.malpoang({ uppnatt: true, steg: 4, budget: 4 })).toBe(10);
    expect(R.malpoang({ uppnatt: true, steg: 6, budget: 4 })).toBe(5);
    expect(R.malpoang({ uppnatt: true, steg: 7, budget: 4 })).toBe(2);
    expect(R.malpoang({ uppnatt: false, steg: 1, budget: 4 })).toBe(0);
    // Brister mot principen om att systemet är experten ger högst 5.
    expect(R.malpoang({ uppnatt: true, steg: 3, budget: 4, brister: ['ett fält som systemet borde ha fyllt i'] })).toBe(5);
  });

  test(namn(T[3]), () => {
    const u = R.utvarderingspoang;
    expect([10, 8, 7.99, 4, 3.99, 1.5, 1.49, 0].map(v => u('malupfyllelse', v))).toEqual([10, 10, 5, 5, 2, 2, 0, 0]);
    expect([8, 7.99, 4, 3.99, 1.5, 1.49].map(v => u('effektivitet', v))).toEqual([10, 5, 5, 2, 2, 0]);
    expect([100, 90, 89.99, 80, 79.99, 50, 49.99, 0].map(v => u('tillfredsstallelse', v))).toEqual([10, 10, 5, 5, 2, 2, 0, 0]);
    expect([70, 60, 59, 30, 29, 12, 11, 0].map(v => u('expert', v))).toEqual([10, 10, 5, 5, 2, 2, 0, 0]);
    expect(u('expert', null)).toBeNull();
    // Sammanställningen: ett testfall som inte genomförs ger 0 i medelvärdet för alla 34.
    const s = R.sammanstall({ testfall: R.KORNINGAR.map(({ x }) => ({ nr: x.nr, uppnatt: true, malpoang: 10, tidspoang: 10 })) });
    expect(s.antal).toBe(34);
    expect(s.genomforda.malupfyllelse).toBe(10);
    expect(s.alla.malupfyllelse).toBe(Math.round((10 * R.GENOMFORBARA.length / 34) * 100) / 100);
  });

  test(namn(T[4]), () => {
    // Card, Moran och Newell 1980: K 0,28, P 1,1, B 0,1, H 0,4 och M 1,35 sekunder.
    expect(R.KLM_STEG.klick).toBeCloseTo(2.65, 5);
    expect(R.KLM_STEG.faltbyte).toBeCloseTo(3.45, 5);
    expect(R.KLM_STEG.listval).toBeCloseTo(3.95, 5);
    expect(R.KLM_STEG.tecken).toBeCloseTo(0.28, 5);
    const t = R.klmTid({ klick: 2, listval: 1, faltbyten: 1, tecken: 10, tangenter: 1, svarstidMs: 1500 });
    expect(t.sekunder).toBe(17.3);
    expect(t.delar).toEqual({ klick: 5.3, listval: 4, faltbyten: 3.5, tecken: 2.8, tangenter: 0.3, svarstid: 1.5 });
    expect(R.KLM.kalla).toBe('Card, Moran och Newell 1980, Communications of the ACM 23(7), s. 396 till 410');
  });

  test(namn(T[5]), () => {
    const st = JSON.parse(readFileSync(join(import.meta.dir, '..', 'sussa-testfall.json'), 'utf8'));
    expect(st.gransnittHash).toMatch(/^[0-9a-f]{64}$/);
    expect(st.testfall.map(t => `${t.nr} ${t.demoroll}`)).toEqual(R.KORNINGAR.map(({ x, k }) => `${x.nr} ${k.demoroll}`));
    for (const { x, k } of R.KORNINGAR) {
      const t = st.testfall.find(y => y.nr === x.nr && y.demoroll === k.demoroll);
      expect({ nr: x.nr, budget: t.budget, tidsklass: t.tidsklass }).toEqual({ nr: x.nr, budget: k.budget, tidsklass: x.tidsklass });
      expect({ nr: x.nr, uppnatt: t.uppnatt, inomBudget: t.inomBudget, fel: t.fel ?? null }).toEqual({ nr: x.nr, uppnatt: true, inomBudget: true, fel: null });
      expect(t.uppmatt).toBe(t.klick + t.faltbyten + t.tangenter);
      expect(t.malpoang).toBe(R.malpoang({ uppnatt: true, steg: t.uppmatt, budget: t.budget, brister: k.brister }));
      expect(t.tidspoang).toBe(R.tidspoang(t.uppskattadTidS, t.tidsklass));
      expect(st.tester.find(y => y.namn === R.testfallTest(x, k))?.status).toBe('grön');
    }
    expect(st.ejGenomforbara.map(x => x.nr)).toEqual(R.TESTFALL.filter(x => !x.korningar.length).map(x => x.nr));
    expect(st.sammanstallning).toEqual(R.sammanstall(st));
    // K4 pekar på registrets tester och på ett test per testfall som genomförs.
    expect(KRAV.find(k => k.id === 'K4').tester).toEqual(expect.arrayContaining([...T, ...R.KORNINGSTESTER]));
  });

  test(namn(T[6]), () => {
    const db = nyDb();
    const andra = new Set(db.query('SELECT personnummer FROM patienter').all().map(p => p.personnummer));
    const ut = laddaTestdata(db, personal(db, 'lak-kard'));
    expect(ut).toEqual({ ok: true, redan: false, patienter: 26 });
    const pat = db.query("SELECT * FROM patienter WHERE id LIKE 'sus%' ORDER BY id").all();
    expect(pat).toHaveLength(26);
    for (const p of SUSSA_PATIENTER) {
      expect(testpnr.has(p.pnr)).toBe(true);
      expect(andra.has(p.pnr)).toBe(false);
      const rad = pat.find(x => x.id === p.id);
      expect([rad.fornamn, rad.efternamn, rad.personnummer]).toEqual([p.fornamn, p.efternamn, p.pnr]);
      expect(db.query("SELECT count(*) AS n FROM identiteter WHERE patient_id = ? AND status = 'gallande'").get(p.id).n).toBe(1);
    }
    expect(new Set(SUSSA_PATIENTER.map(p => p.pnr)).size).toBe(26);
    // Datan som testfallen behöver.
    expect(db.query("SELECT varde_num FROM matvarden WHERE patient_id = 'sus01' AND typ = 'inr' ORDER BY tid").all().map(m => m.varde_num)).toEqual(BERTIL_PK.map(p => p.varde));
    expect(db.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'sus01' AND typ = 'Epikris' AND status = 'signerad'").get().n).toBe(1);
    expect(db.query("SELECT count(*) AS n FROM vardtillfallen WHERE patient_id IN ('sus01', 'sus07', 'sus16') AND utskriven IS NULL").get().n).toBe(3);
    expect(db.query(`SELECT count(*) AS n FROM anteckningar WHERE forfattare_id = 'lak-vc' AND status = 'utkast' AND patient_id IN (${OSIGNERADE_4_4.patienter.map(() => '?').join(', ')})`).get(...OSIGNERADE_4_4.patienter).n).toBe(30);
    expect(db.query("SELECT status, beslut, till_enhet_id FROM remisser WHERE patient_id = 'sus06'").get()).toEqual({ status: 'bedomd', beslut: 'accepterad', till_enhet_id: 'uso-kard' });
    const incheckade = db.query("SELECT b.patient_id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE t.schema_id = 'sch-vc-per' AND b.status = 'incheckad' AND b.patient_id LIKE 'sus%'").all().map(b => b.patient_id);
    expect(incheckade.sort()).toEqual([...ANKOMNA_5_6].sort());
    expect(db.query("SELECT status FROM bokningar WHERE patient_id = 'sus21'").get().status).toBe('bokad');
    expect(db.query("SELECT b.status, v.status AS vl FROM bokningar b JOIN vantelista v ON v.id = b.vantelista_id WHERE b.patient_id = 'sus13'").get()).toEqual({ status: 'bokad', vl: 'bokad' });
    expect(db.query("SELECT status FROM vantelista WHERE patient_id = 'sus20'").get().status).toBe('vantar');
    // En gång per sandlåda.
    expect(laddaTestdata(db, personal(db, 'adm-kard'))).toEqual({ ok: true, redan: true, patienter: 26 });
    expect(db.query("SELECT count(*) AS n FROM patienter WHERE id LIKE 'sus%'").get().n).toBe(26);
  });

  test('demoläget kräver inloggning och lägger bara in testdatan i den egna sandlådan', async () => {
    const k = klient(app);
    expect((await k.post('/api/demo/sussa-testfall')).status).toBe(401);
    await k.logga('adm-kard');
    const r = await k.post('/api/demo/sussa-testfall');
    expect(r.status).toBe(200);
    expect(r.data.redan).toBe(false);
    expect((await k.post('/api/demo/sussa-testfall')).data.redan).toBe(true);
    const annan = klient(app);
    await annan.logga('adm-kard');
    expect(sandlada(app, annan).db.query("SELECT count(*) AS n FROM patienter WHERE id LIKE 'sus%'").get().n).toBe(0);
  });

  test('testpatienterna följer behörigheten: ingen åtkomst utan vårdrelation och provsvar från andra vårdenheter först efter aktivt val', async () => {
    const k = klient(app);
    await k.logga('lak-psyk');
    await k.post('/api/demo/sussa-testfall');
    // Psykiatrin har ingen vårdrelation till Bertil Danielsson.
    const nekad = await k.get('/api/patient/sus01');
    expect(nekad.status).toBe(403);
    const l = await klient(app);
    await l.logga('lak-kard');
    await l.post('/api/demo/sussa-testfall');
    // Provsvaren togs på vårdcentralen och ortopeden. Utan aktivt val syns inget av dem, inte heller i texten.
    const utan = await l.get('/api/patient/sus01/matvarden');
    expect(utan.status).toBe(200);
    const pk = (d) => JSON.stringify(d).match(/"typ":"inr"/g)?.length ?? 0;
    expect(pk(utan.data)).toBe(0);
    expect(JSON.stringify(utan.data)).not.toContain('Vårdcentralen Tybble');
    const val = await l.post('/api/patient/sus01/val', { typ: 'andra_enheter', syfte: 'Bedöma aktuellt vårdbehov' });
    expect(val.status).toBe(200);
    expect(pk((await l.get('/api/patient/sus01/matvarden')).data)).toBeGreaterThanOrEqual(5);
    // Läkaren i öppenvårdens utkast syns inte för kardiologen och kan inte signeras av någon annan.
    const utkast = sandlada(app, l).db.query("SELECT id FROM anteckningar WHERE patient_id = 'sus08' AND status = 'utkast'").get();
    expect((await l.post(`/api/anteckning/${utkast.id}/signera`)).status).toBe(403);
    expect(sandlada(app, l).db.query('SELECT status FROM anteckningar WHERE id = ?').get(utkast.id).status).toBe('utkast');
  });

  test('Granska och signera alla: varje utkast signeras för sig och bara av författaren', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    await k.post('/api/demo/sussa-testfall');
    const ink = await k.get('/api/inkorg');
    const utkast = ink.data.osigneradeAnteckningar.filter(a => OSIGNERADE_4_4.patienter.includes(a.patientId));
    expect(utkast).toHaveLength(30);
    // Inkorgens rad har det som listan visar: typ, patient, tid, vårdenhet och text.
    expect(utkast[0]).toEqual(expect.objectContaining({ typ: 'Mottagningsanteckning', sammanfattning: expect.stringContaining('Aktuellt:') }));
    for (const a of utkast) expect((await k.post(`/api/anteckning/${a.id}/signera`)).status).toBe(200);
    expect((await k.get('/api/inkorg')).data.osigneradeAnteckningar.filter(a => OSIGNERADE_4_4.patienter.includes(a.patientId))).toHaveLength(0);
    // Varje signering loggas på patienten.
    const db = sandlada(app, k).db;
    expect(db.query("SELECT count(*) AS n FROM anteckningar WHERE forfattare_id = 'lak-vc' AND status = 'signerad' AND patient_id LIKE 'sus%'").get().n).toBe(30);
  });

  test('SUS-formuläret har de tio påståendena i Sussas formulering och poängen räknas med standardformeln', () => {
    expect(SUS_SUSSA).toHaveLength(10);
    expect(SUS_SUSSA[0]).toBe('Jag skulle gärna och ofta använda systemet.');
    expect(SUS_SUSSA[9]).toBe('Jag tror att jag behöver lära mig mycket innan jag kan komma igång med systemet.');
    // Bilaga F1:2: 5 på de udda och 1 på de jämna ger 100, och tvärtom 0.
    expect(susPoang([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susPoang([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susPoang([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
    expect(susPoang([4, 2, 4])).toBeNull();
    // Svaren sparas utan patientuppgifter.
    expect(kodGiltig('L03')).toBe(true);
    expect(kodGiltig('194502')).toBe(false);
    expect(kodGiltig('Gerda Ström')).toBe(false);
    expect(kommentarGiltig('Bra flöde, men listan var lång.')).toBe(true);
    expect(kommentarGiltig('Patienten 19450207-3416 syntes')).toBe(false);
  });

  test('tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter', () => {
    expect(KATALOG.length).toBeGreaterThanOrEqual(100);
    const finns = (namn, styrka) => KATALOG.some(l => l.namn === namn && l.styrka === styrka);
    for (const [n, s] of [['Addex-Magnesium', '1 mmol/ml'], ['Alvedon forte', '1 g'], ['Alvedon', '500 mg'], ['Atrovent', '20 mikrogram/dos'], ['Atrovent', '0,25 mg/ml'], ['Atrovent', '0,5 mg/ml'],
      ['Rinivent', '21 mikrogram/dos'], ['Glucos Baxter 25 mg/ml buffrad', ''], ['Kloramfenikol Santen', '5 mg/ml'], ['Kloramfenikol Santen', '10 mg/g'], ['Metformin Sandoz', '500 mg'],
      ['Metformin Teva', '850 mg'], ['Morfin Abcur', '10 mg/ml'], ['Morfin Alternova', '10 mg'], ['Paracetamol Fresenius Kabi', '10 mg/ml'], ['Sertralin Teva', '50 mg'],
      ['Sertralin Teva Pharma', '100 mg'], ['Stesolid', '5 mg'], ['Stesolid', '10 mg'], ['Waran', '2,5 mg'], ['Zopiklon Pilum', '5 mg'], ['Zopiklon Pilum', '7,5 mg']]) {
      expect({ n, s, finns: finns(n, s) }).toEqual({ n, s, finns: true });
    }
    for (const nr of ['1.1', '1.2', '1.3', '1.4']) expect(R.testfall(nr).korningar.length).toBeGreaterThan(0);
  });

  test('expertgranskningen har de sju dialogprinciperna i ISO 9241-110 och summan omvandlas till utvärderingspoäng', () => {
    expect(DIALOGPRINCIPER.map(p => p.namn)).toEqual(['Anpassad till uppgiften', 'Självinstruerande', 'Förutsägbar för användaren', 'Stödjer inlärning', 'Styrbar', 'Tolerant mot fel', 'Möjlig att individualisera']);
    for (const p of DIALOGPRINCIPER) expect(p.fragor.length).toBeGreaterThan(0);
    expect(R.expertpoang([10, 10, 10, 10, 10, 10, 10])).toEqual({ summa: 70, poang: 10 });
    expect(R.expertpoang([10, 5, 5, 5, 5, 0, 0])).toEqual({ summa: 30, poang: 5 });
    expect(R.expertpoang([2, 2, 2, 2, 2, 2, 0])).toEqual({ summa: 12, poang: 2 });
    expect(R.expertpoang([2, 2, 2, 2, 2, 0, 0])).toEqual({ summa: 10, poang: 0 });
    expect(R.expertpoang([10, 10, 10, 10, 10, 10, 7])).toBeNull();
    expect(R.expertpoang([10, 10])).toBeNull();
  });
});
