import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, personal } from './hjalp.js';
import { addDagar } from '../src/db.js';
import { verifiera } from '../src/logg.js';
import * as mr from '../src/myndighetsrapport.js';
import { yttreOrsak, tolkaYttreOrsak, ENHETER } from '../src/rapportkoder.js';

// Rapportering till myndigheter och register (runda 7, r5, Sussa 6.3.2 och avtalets tillägg 2020). Testerna med
// databasen direkt använder en fast tid långt efter seedens datum, så att bara testets egna rader finns i perioden.
const NU = new Date('2035-03-10T10:00:00Z');
const T = (datum, klocka = '08:00') => new Date(`${datum}T${klocka}:00+01:00`).toISOString();

function vardtillfalle(db, { pid, enhet = 'uso-kard', plats = 'uso-kard-72', inskr = '2035-01-10', utskr = '2035-01-14', planerad = 0 }) {
  const vt = Number(db.query('INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, utskriven) VALUES (?, ?, ?, ?)').run(pid, enhet, T(inskr, '10:00'), utskr ? T(utskr, '11:00') : null).lastInsertRowid);
  const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, vardtillfalle_id, planerad) VALUES (?, ?, 'slutenvard', ?, ?, ?, ?)")
    .run(pid, plats, T(inskr, '10:00'), utskr ? T(utskr, '11:00') : null, vt, planerad).lastInsertRowid);
  return { vt, vk };
}
function besok(db, { pid, enhet = 'uso-kard-mott', datum = '2035-01-20', typ = 'oppenvard', kontaktsatt = 'besok', forfattare = 'lak-kard', slut = true }) {
  const vk = Number(db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut) VALUES (?, ?, ?, ?, ?, ?)')
    .run(pid, enhet, typ, kontaktsatt, T(datum, '09:00'), slut ? T(datum, '09:45') : null).lastInsertRowid);
  if (forfattare) db.query("INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status) VALUES (?, ?, ?, 'Besöksanteckning', 'lakare', '[]', ?, ?, 'signerad')")
    .run(pid, enhet, vk, forfattare, T(datum, '09:20'));
  return vk;
}
const diagnos = (db, { pid, enhet = 'uso-kard', vk, kod, typ = 'huvud', datum = '2035-01-10', text = 'Testdiagnos' }) =>
  Number(db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum) VALUES (?, ?, ?, ?, ?, ?, ?)").run(pid, enhet, vk, kod, text, typ, datum).lastInsertRowid);
const fil = (s, kod) => s.filer.find(f => f.kod === kod);
// En databas där seedens pågående vårdtillfällen, tvångsvård och väntande är avslutade före testets period, så att
// bara testets egna rader finns med. Seedens rader ändras inte i övrigt.
function rensad() {
  const db = nyDb();
  db.query("UPDATE vardtillfallen SET utskriven = inskriven WHERE utskriven IS NULL").run();
  for (const p of db.query('SELECT * FROM tvangsvard_perioder').all()) {
    db.query("INSERT INTO tvangsvard_handelser (period_id, patient_id, enhet_id, typ, tid, registrerad, av) VALUES (?, ?, ?, 'upphor', '2027-01-01T10:00:00.000Z', '2027-01-01T10:00:00.000Z', 'lak-psyk')").run(p.id, p.patient_id, p.enhet_id);
  }
  db.query("UPDATE vantelista SET status = 'avslutad'").run();
  return db;
}
const rader = (s, kod) => fil(s, kod).text.split('\n').filter(Boolean);

describe('Myndighetsrapportering', () => {
  test('patientregistrets filer följer HSLF-FS 2023:33 med semikolon, rätt antal fält och filnamn med länskod och period', () => {
    const db = rensad();
    const { vt, vk } = vardtillfalle(db, { pid: 'p01', planerad: 1 });
    diagnos(db, { pid: 'p01', vk, kod: 'I50.1' });
    const ov = besok(db, { pid: 'p05' });
    diagnos(db, { pid: 'p05', vk: ov, kod: 'I48.0', datum: '2035-01-20' });
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(s.period).toMatchObject({ fran: '2034-12-01', till: '2035-02-28', manad: '2035-02', rapporteringsmanad: '2035-03', sistaInlamning: '2035-03-31' });
    expect(s.filer.map(f => f.kod)).toEqual(['SV_AD', 'SV_DI', 'SV_YO', 'SV_AT', 'SV_LT', 'OV_AD', 'OV_DI', 'OV_YO', 'OV_AT', 'OV_LT', 'OV_YK', 'TV']);
    expect(fil(s, 'SV_AD').namn).toBe('SV_AD_18_203502_20350310T1100.txt');
    expect(rader(s, 'SV_AD')).toEqual([`VT${vt};194502024732;1;1945;55010;231;20350110;20350114;1;3;3`]);
    expect(rader(s, 'OV_AD')).toEqual([`VK${ov};196503143254;1;1965;55010;231;20350120;0;;;;;2;0`]);
    expect(s.format).toEqual({ ok: true, fel: [] });
    // Alla filer skickas, också de tomma.
    expect(fil(s, 'SV_YO')).toMatchObject({ antal: 0, text: '' });
    expect(s.fel).toEqual([]);
  });

  test('diagnoser rapporteras utan punkt, yttre orsaker i egen fil och åtgärder och givna läkemedel med datum', () => {
    const db = rensad();
    const { vt, vk } = vardtillfalle(db, { pid: 'p07', enhet: 'kkoga-ort', plats: 'kkoga-ort' });
    diagnos(db, { pid: 'p07', enhet: 'kkoga-ort', vk, kod: 'S72.00' });
    diagnos(db, { pid: 'p07', enhet: 'kkoga-ort', vk, kod: 'I10.9', typ: 'bi' });
    diagnos(db, { pid: 'p07', enhet: 'kkoga-ort', vk, kod: 'W01.09', typ: 'bi' });
    db.query("INSERT INTO atgarder (patient_id, enhet_id, vardkontakt_id, kod, tid) VALUES ('p07', 'kkoga-ort', ?, 'QD008', ?)").run(vk, T('2035-01-11'));
    const lm = db.query("SELECT id FROM katalog WHERE atc IS NOT NULL LIMIT 1").get().id;
    const atc = db.query('SELECT atc FROM katalog WHERE id = ?').get(lm).atc;
    for (const dag of ['2035-01-11', '2035-01-12']) db.query("INSERT INTO administreringar (patient_id, enhet_id, lakemedel_id, status, tid, utford_av, registrerad, registrerad_av) VALUES ('p07', 'kkoga-ort', ?, 'given', ?, 'ssk-kkoga', ?, 'ssk-kkoga')").run(lm, T(dag), T(dag));
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(rader(s, 'SV_AD')[0]).toContain(';55011;311;');
    expect(rader(s, 'SV_DI')).toEqual([`VT${vt};S7200;1`, `VT${vt};I109;0`]);
    expect(rader(s, 'SV_YO')).toEqual([`VT${vt};W0109`]);
    expect(rader(s, 'SV_AT')).toEqual([`VT${vt};QD008;20350111`]);
    expect(rader(s, 'SV_LT')).toEqual([`VT${vt};${atc};20350111`]);
    expect(s.fel).toEqual([]);
  });

  test('en vårdkontakt med fel hålls kvar, och felet beskrivs på svenska med vem som rättar', () => {
    const db = rensad();
    const utan = vardtillfalle(db, { pid: 'p01' });
    const skada = vardtillfalle(db, { pid: 'p12', enhet: 'uso-ort', plats: 'uso-ort' });
    diagnos(db, { pid: 'p12', enhet: 'uso-ort', vk: skada.vk, kod: 'S83.5' });
    const reserv = vardtillfalle(db, { pid: 'p17' });
    diagnos(db, { pid: 'p17', vk: reserv.vk, kod: 'I48.0' });
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(s.fel.map(f => [f.regel, f.radNyckel, f.atgard, f.enhet.id])).toEqual([
      ['huvuddiagnos', `VT${utan.vt}`, 'diagnos', 'uso-kard'],
      ['yttre_orsak', `VT${skada.vt}`, 'yttre_orsak', 'uso-ort'],
      ['identitet', `VT${reserv.vt}`, 'identitet', 'uso-kard'],
    ]);
    expect(s.fel[0].text).toContain('Huvuddiagnos saknas');
    expect(s.fel[1].text).toContain('minst en yttre orsak');
    expect(s.fel[2].text).toContain('reservnummer har inte tolv siffror');
    expect(fil(s, 'SV_AD').antal).toBe(0);
    expect(s.kvarhallna).toBe(3);
  });

  test('primärvård och kontakter utan läkare rapporteras inte till patientregistret och räknas med bestämmelse', () => {
    const db = rensad();
    const vc = besok(db, { pid: 'p05', enhet: 'vc-tybble', forfattare: 'lak-vc' });
    diagnos(db, { pid: 'p05', enhet: 'vc-tybble', vk: vc, kod: 'I10.9' });
    besok(db, { pid: 'p06', forfattare: 'ssk-kardmott' });
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(fil(s, 'OV_AD').antal).toBe(0);
    const u = Object.fromEntries(s.undantag.map(x => [x.nyckel, x]));
    expect(u.primarvard).toMatchObject({ antal: 1, ingar: false });
    expect(u.primarvard.bestammelse).toContain('HSLF-FS 2023:33 2 § 2');
    expect(u.annan_personal.antal).toBe(1);
  });

  test('skyddade personuppgifter och spärrade uppgifter rapporteras till patientregistret enligt lag och redovisas som antal', () => {
    const db = rensad();
    const skyddad = vardtillfalle(db, { pid: 'p03' });
    diagnos(db, { pid: 'p03', vk: skyddad.vk, kod: 'I48.0' });
    const sparrad = vardtillfalle(db, { pid: 'p04', enhet: 'uso-psyk', plats: 'uso-psyk' });
    diagnos(db, { pid: 'p04', enhet: 'uso-psyk', vk: sparrad.vk, kod: 'F32.1' });
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(rader(s, 'SV_AD').map(r => r.split(';')[1]).sort()).toEqual(['197701182383', '198404162383']);
    const u = Object.fromEntries(s.undantag.map(x => [x.nyckel, x]));
    expect(u.skyddade).toMatchObject({ antal: 1, ingar: true });
    expect(u.skyddade.bestammelse).toContain('offentlighets- och sekretesslagen 10 kap. 28 §');
    expect(u.sparrade).toMatchObject({ antal: 1, ingar: true });
    expect(u.sparrade.bestammelse).toContain('patientdatalagen 4 kap. 4 §');
    // Filerna har inga adressfält.
    expect(Object.values(mr.FILER).flatMap(f => f.falt.map(x => x[0])).some(n => /adress/i.test(n))).toBe(false);
  });

  test('psykiatrisk vårdform enligt LPT räknas fram ur beslutsjournalen', () => {
    const db = rensad();
    const per = Number(db.query("INSERT INTO tvangsvard_perioder (patient_id, enhet_id, skapad) VALUES ('p08', 'uso-psyk', ?)").run(T('2035-01-05')).lastInsertRowid);
    const h = db.query("INSERT INTO tvangsvard_handelser (period_id, patient_id, enhet_id, typ, tid, registrerad, av) VALUES (?, 'p08', 'uso-psyk', ?, ?, ?, 'lak-psyk')");
    h.run(per, 'kvarhallning', T('2035-01-05', '10:00'), T('2035-01-05', '10:00'));
    h.run(per, 'intagning', T('2035-01-06', '09:00'), T('2035-01-06', '09:00'));
    h.run(per, 'upphor', T('2035-01-20', '12:00'), T('2035-01-20', '12:00'));
    const s = mr.sammanstall(db, 'par', { nu: NU });
    expect(rader(s, 'TV')).toEqual(['199011172476;1;1990;55010;901;K;20350105;20350106', '199011172476;1;1990;55010;901;D;20350106;20350120']);
  });

  test('väntande i specialiserad vård följer filspecifikationen med fas, aktivitet, remiss och måldatum', () => {
    const db = rensad();
    const ins = db.query("INSERT INTO vantelista (patient_id, enhet_id, remiss_id, tidstyp, yrkesroll, prioritet, orsak, fran, mal, skapad) VALUES (?, 'uso-kard', ?, ?, 'lakare', 'normal', ?, ?, ?, ?)");
    const elk = Number(ins.run('p14', null, 'ingrepp', 'Elkonvertering vid förmaksflimmer', '2035-02-03', '2035-03-20', T('2035-02-03')).lastInsertRowid);
    const okand = Number(ins.run('p05', null, 'ingrepp', 'Ingrepp som saknas i förteckningen', '2035-02-04', null, T('2035-02-04')).lastInsertRowid);
    const ater = Number(ins.run('p06', null, 'aterbesok', 'Återbesök', '2035-02-05', null, T('2035-02-05')).lastInsertRowid);
    ins.run('p01', null, 'nybesok', 'Väntar inte än', '2035-03-02', null, T('2035-03-02'));
    const s = mr.sammanstall(db, 'viv', { nu: NU });
    expect(s.period).toMatchObject({ fran: '2035-02-01', till: '2035-02-28', sistaInlamning: '2035-03-25' });
    expect(fil(s, 'VTID_SVV_AD').namn).toBe('VTID_SVV_AD_18_203502_20350310T1100.txt');
    const r = rader(s, 'VTID_SVV_AD');
    expect(r.length).toBe(1);
    const f = r[0].split(';');
    expect(f.length).toBe(29);
    expect(f.slice(0, 6)).toEqual(['2035-02-01', `VL${elk}-2035-02`, '1', '2', '231', '23102']);
    expect(f.slice(15, 21)).toEqual(['1977', '1', '1880', '4', '0', 'XS915']);
    expect(f[24]).toBe('2035-03-20T00:00:00');
    expect(s.fel.map(x => [x.regel, x.radNyckel, x.atgard])).toEqual([['aktivitet', `VL${okand}`, 'aktivitet'], ['maldatum', `VL${ater}`, 'vantelista']]);
    // Felets text innehåller ingen fritext ur journalen. Väntelistans orsak finns bara i detaljen, som visas efter prövningen.
    expect(s.fel[0].text).not.toContain('saknas i förteckningen');
    expect(s.fel[0].detalj).toBe('Ingrepp som saknas i förteckningen');
    expect(s.format.ok).toBe(true);
  });

  test('medicinska födelseregistret tar förlossningar ur diagnoserna, och utan utfall är det ett fel', () => {
    const db = rensad();
    const med = vardtillfalle(db, { pid: 'p11', enhet: 'uso-med', plats: 'uso-med', inskr: '2035-02-02', utskr: '2035-02-04' });
    diagnos(db, { pid: 'p11', enhet: 'uso-med', vk: med.vk, kod: 'O80.0', datum: '2035-02-02' });
    diagnos(db, { pid: 'p11', enhet: 'uso-med', vk: med.vk, kod: 'Z37.0', typ: 'bi', datum: '2035-02-02' });
    const utan = vardtillfalle(db, { pid: 'p13', enhet: 'uso-med', plats: 'uso-med', inskr: '2035-02-10', utskr: '2035-02-12' });
    diagnos(db, { pid: 'p13', enhet: 'uso-med', vk: utan.vk, kod: 'O80.0', datum: '2035-02-10' });
    const s = mr.sammanstall(db, 'mfr', { nu: NU });
    const fv1 = rader(s, 'MFR_FV1');
    expect(fv1.length).toBe(1);
    const f = fv1[0].split(';');
    expect(f.length).toBe(66);
    expect(f.slice(0, 9)).toEqual([`F-VT${med.vt}`, 'SE2321000164-VK0130', '', '1', '198004262385', '1', '19800426', '2', '20350202T1000']);
    expect(f[12]).toBe('1');
    expect(rader(s, 'MFR_FV4')).toEqual([`F-VT${med.vt};1;O800`]);
    expect(s.fel.map(x => [x.regel, x.radNyckel])).toEqual([['utfall', `F-VT${utan.vt}`]]);
    expect(s.varningar.some(v => v.text.includes('inte har någon förlossningsjournal'))).toBe(true);
  });

  test('Vårdtillfällesdatabasen har ett antaget format som är märkt som antagande', () => {
    const db = rensad();
    const { vt, vk } = vardtillfalle(db, { pid: 'p01', inskr: '2035-02-10', utskr: '2035-02-15' });
    diagnos(db, { pid: 'p01', vk, kod: 'I50.1' });
    const s = mr.sammanstall(db, 'vtd', { nu: NU });
    expect(s.rapport.antagande).toBe(true);
    expect(s.rapport.bestammelse).toContain('Ingen gällande teknisk beskrivning');
    expect(rader(s, 'VTD')).toEqual([`VT${vt};194502024732;1;1945;55010;231;20350210;20350215;5;I501;3;3`]);
  });

  test('kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter', () => {
    const db = rensad();
    for (const [pid, enhet] of [['p01', 'uso-kard-mott'], ['p06', 'uso-kard-mott'], ['p03', 'uso-kard-mott'], ['p04', 'uso-psyk']]) {
      const v = besok(db, { pid, enhet });
      diagnos(db, { pid, enhet: enhet === 'uso-psyk' ? 'uso-psyk' : 'uso-kard', vk: v, kod: 'I50.9', datum: '2035-01-20' });
    }
    mr.motsatt(db, personal(db, 'lak-kard'), 'p06');
    const s = mr.sammanstall(db, 'kvalitetsregister', { nu: NU });
    expect(rader(s, 'KR').map(r => r.split(';')[0])).toEqual(['194502024732']);
    const u = Object.fromEntries(s.undantag.map(x => [x.nyckel, x]));
    expect(u.motsatt).toMatchObject({ antal: 1, ingar: false });
    expect(u.motsatt.bestammelse).toContain('patientdatalagen 7 kap. 2 §');
    expect(u.skyddade_kr.antal).toBe(1);
    expect(u.sparrade_kr.antal).toBe(1);
  });

  test('en yttre orsak sätts ihop ur tre frågor och kontrolleras mot ICD-10-SE', () => {
    expect(yttreOrsak('W01', '4', '9')).toEqual({ kod: 'W01.49', text: 'Fall i samma plan genom halkning, snavning eller snubbling - gata och väg - aktivitet, ospecificerad' });
    expect(yttreOrsak('W01', '4', '5')).toBeNull();
    expect(tolkaYttreOrsak('X59.99').text).toBe('Exponering för ospecificerad faktor - plats, ospecificerad - aktivitet, ospecificerad');
    // Varje vårdenhet i demon har en kod eller är primärvård.
    const db = rensad();
    expect(mr.mappning(db).filter(e => e.saknas).map(e => e.id)).toEqual([]);
    expect(Object.keys(ENHETER).length).toBe(10);
  });
});

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const sdb = (k) => sandlada(app, k).db;

describe('Myndighetsrapportering i API:t', () => {
  test('bara uppföljningsrollen granskar och skickar, och nekade försök loggas', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.get('/api/rapportering')).status).toBe(403);
    expect((await k.post('/api/rapportering/par/skicka')).status).toBe(403);
    expect(sdb(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE resultat = 'nekad' AND handling = 'myndighetsrapport'").get().n).toBe(2);
    const u = await inloggad('uppf');
    const r = await u.get('/api/rapportering');
    expect(r.status).toBe(200);
    expect(r.data.rapporter.map(x => x.id)).toEqual(['par', 'viv', 'vtd', 'mfr', 'kvalitetsregister']);
    expect(r.data.rapporter.every(x => x.mottagare.includes('simulera'))).toBe(true);
    expect((await u.get('/api/rapportering/okand')).status).toBe(404);
  });

  test('granskningen visar fel och fältens ifyllnad utan patientuppgifter', async () => {
    const u = await inloggad('uppf');
    const db = sdb(u);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 10);
    const { vt } = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 2) });
    const ok = vardtillfalle(db, { pid: 'p05', inskr: addDagar(datum, 1), utskr: addDagar(datum, 3) });
    diagnos(db, { pid: 'p05', vk: ok.vk, kod: 'I48.0' });
    const r = (await u.get('/api/rapportering/par')).data;
    // Inga rader ur filerna, inga id, födelsedatum eller tider för vårdkontakterna (säkerhetsgranskningen efter r5).
    const uppgifter = ['p01', 'p05', '194502024732', '196503143254', '19450202', '19650314', `VT${vt}`, `VT${ok.vt}`, datum, datum.replaceAll('-', ''), addDagar(datum, 3).replaceAll('-', ''), 'Kardiologiska kliniken USÖ;'];
    for (const x of uppgifter) expect({ x, finns: JSON.stringify(r).includes(x) }).toEqual({ x, finns: false });
    expect(r.filer.find(f => f.kod === 'SV_AD').exempel).toBeUndefined();
    expect(r.filer.find(f => f.kod === 'SV_AD').ifyllda.length).toBe(11);
    const fel = r.felLista.filter(f => f.regel === 'huvuddiagnos' && f.enhet.id === 'uso-kard');
    expect(fel.length).toBeGreaterThan(0);
    expect(fel[0]).toMatchObject({ vem: 'Läkare på vårdenheten', iInkorgen: true, lank: null });
    const text = JSON.stringify(r);
    for (const x of ['p01', '194502024732', '19450202', 'Gunnar', 'Åkesson', 'patientId', 'vardkontaktId']) expect(text).not.toContain(x);
    expect(r.undantag.length).toBeGreaterThan(0);
  });

  test('att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient', async () => {
    const u = await inloggad('uppf');
    const db = sdb(u);
    const forv = mr.sammanstall(db, 'par');
    const r = await u.post('/api/rapportering/par/skicka');
    expect(r.status).toBe(201);
    expect(r.data.kvittens).toMatchObject({ mottagare: 'Socialstyrelsen, patientregistret (simulerad mottagare)' });
    expect(r.data.kvittens.text).toContain('Inget har lämnat Vårdkällan');
    const loggade = db.query("SELECT patient_id, grund FROM atkomstlogg WHERE handling = 'myndighetsrapport' AND patient_id IS NOT NULL AND resurs LIKE ?").all(`rapport:par:%:${r.data.id}`);
    expect(loggade.map(x => x.patient_id).sort()).toEqual([...forv.patienter].sort());
    expect(loggade.every(x => x.grund === 'uppgiftsskyldighet')).toBe(true);
    expect(verifiera(db).hel).toBe(true);
    const h = (await u.get('/api/rapportering/historik')).data.skickade;
    expect(h[0]).toMatchObject({ id: r.data.id, rapport: 'par' });
    expect(() => db.query('DELETE FROM myndighetsrapporter').run()).toThrow();
  });

  test('läkaren får felet i inkorgen bara för sin vårdenhet och rättar det med systemets förslag, och vårdkontakten följer med i nästa rapport', async () => {
    const k = await inloggad('lak-kard');
    const db = sdb(k);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 12);
    const { vt, vk } = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 3) });
    const sk = vardtillfalle(db, { pid: 'p04', enhet: 'uso-psyk', plats: 'uso-psyk', inskr: datum, utskr: addDagar(datum, 3) });
    const i = (await k.get('/api/inkorg')).data;
    const rad = i.rapportfel.find(x => x.vardkontaktId === vk);
    expect(rad).toMatchObject({ regel: 'huvuddiagnos', atgard: 'diagnos', patient: { id: 'p01' } });
    expect(rad.forslag.length).toBeGreaterThan(0);
    expect(i.rapportfel.some(x => x.vardkontaktId === sk.vk)).toBe(false);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p01' AND resurs LIKE 'inkorg:rapportfel:%'").get().n).toBe(1);
    const r = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: rad.forslag[0].kod });
    expect(r.status).toBe(201);
    expect(r.data.typ).toBe('huvud');
    const s = mr.sammanstall(db, 'par');
    expect(s.fel.some(f => f.radNyckel === `VT${vt}`)).toBe(false);
    expect(s.filer.find(f => f.kod === 'SV_AD').text).toContain(`VT${vt};194502024732`);
    // Psykiatrins läkare ser felet på sin vårdenhet, men inte kardiologins.
    // En läkare på en annan vårdenhet kan inte registrera diagnosen på psykiatrin, och inte en sjuksköterska heller.
    expect((await k.post(`/api/vardkontakt/${sk.vk}/diagnos`, { kod: 'F32.1' })).status).toBe(403);
    await k.logga('ssk-kard');
    expect((await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'I10.9' })).status).toBe(403);
    expect((await k.get('/api/inkorg')).data.rapportfel).toEqual([]);
    await k.logga('lak-psyk');
    const ip = (await k.get('/api/inkorg')).data.rapportfel;
    expect(ip.some(x => x.vardkontaktId === vk)).toBe(false);
    expect(ip.some(x => x.vardkontaktId === sk.vk)).toBe(true);
  });

  test('en yttre orsak registreras i inkorgen ur svaren, och en kod som systemet inte känner till nekas', async () => {
    const k = await inloggad('lak-kard');
    const db = sdb(k);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 14);
    const { vk } = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 1) });
    diagnos(db, { pid: 'p01', vk, kod: 'S72.00' });
    const i = (await k.get('/api/inkorg')).data;
    expect(i.rapportfel.find(x => x.vardkontaktId === vk)).toMatchObject({ regel: 'yttre_orsak', atgard: 'yttre_orsak' });
    const val = (await k.get('/api/rapportering/rattning/val')).data;
    expect(val.yttreOrsak.forval).toEqual({ mekanism: 'W19', plats: '9', aktivitet: '9' });
    const r = await k.post(`/api/vardkontakt/${vk}/diagnos`, { mekanism: 'W01', plats: '0', aktivitet: '4' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ kod: 'W01.04', typ: 'bi' });
    expect(mr.sammanstall(db, 'par').filer.find(f => f.kod === 'SV_YO').text).toContain(';W0104');
    const fel = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'Q99.9' });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('finns inte bland de koder');
  });

  test('demoläget ger ett fel på kardiologen och ett på akutmottagningen i rätt inkorg', async () => {
    const k = await inloggad('lak-kard');
    const d = (await k.post('/api/demo/rapportfel')).data;
    const kard = (await k.get('/api/inkorg')).data.rapportfel;
    expect(kard.find(x => x.vardkontaktId === d.vardkontaktId)).toMatchObject({ regel: 'huvuddiagnos', patient: { id: 'p01' } });
    expect(kard.some(x => x.vardkontaktId === d.akutId)).toBe(false);
    await k.logga('lak-akut');
    const akut = (await k.get('/api/inkorg')).data.rapportfel;
    expect(akut.find(x => x.vardkontaktId === d.akutId)).toMatchObject({ regel: 'yttre_orsak', atgard: 'yttre_orsak' });
    expect(akut.some(x => x.vardkontaktId === d.vardkontaktId)).toBe(false);
    await k.logga('ssk-kard');
    expect((await k.post('/api/demo/rapportfel')).status).toBe(403);
  });

  test('väntelistans fritext visas inte för uppföljningsrollen, bara för vårdadministratören efter prövningen', async () => {
    const k = await inloggad('uppf');
    const db = sdb(k);
    const per = mr.period('viv', new Date());
    db.query("INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, fran, skapad) VALUES ('p01', 'uso-kard', 'ingrepp', 'lakare', 'normal', 'Hemlig orsak ur journalen', ?, ?)").run(per.fran, new Date(per.fran).toISOString());
    const r = (await k.get('/api/rapportering/viv')).data;
    expect(r.felLista.some(f => f.regel === 'aktivitet')).toBe(true);
    expect(JSON.stringify(r)).not.toContain('Hemlig orsak');
    await k.logga('adm-kard');
    const rad = (await k.get('/api/inkorg')).data.rapportfel.find(x => x.regel === 'aktivitet');
    expect(rad.detalj).toBe('Hemlig orsak ur journalen');
    await k.logga('lak-psyk');
    expect(JSON.stringify((await k.get('/api/inkorg')).data.rapportfel)).not.toContain('Hemlig orsak');
  });

  test('inkorgen följer det aktuella läget när en vårdkontakt flyttas eller personalen byter enhet efter att sammanställningen har sparats', async () => {
    const k = await inloggad('lak-kard');
    const db = sdb(k);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 9);
    const { vk } = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 2) });
    expect((await k.get('/api/inkorg')).data.rapportfel.some(x => x.vardkontaktId === vk)).toBe(true);
    // Vårdkontakten flyttas till ortopedin utan att något annat ändras. Kardiologen ser inte längre felet.
    db.query("UPDATE vardkontakter SET enhet_id = 'uso-ort' WHERE id = ?").run(vk);
    expect((await k.get('/api/inkorg')).data.rapportfel.some(x => x.vardkontaktId === vk)).toBe(false);
    db.query("UPDATE vardkontakter SET enhet_id = 'uso-kard-72' WHERE id = ?").run(vk);
    expect((await k.get('/api/inkorg')).data.rapportfel.some(x => x.vardkontaktId === vk)).toBe(true);
    // Läkaren byter enhet. Felet på kardiologen syns inte längre för henne.
    db.query("UPDATE personal SET enhet_id = 'uso-ort' WHERE id = 'lak-kard'").run();
    // Runda 9, r5: med en ny vårdenhet gäller ett nytt medarbetaruppdrag, så läkaren loggar in igen.
    await k.logga('lak-kard');
    expect((await k.get('/api/inkorg')).data.rapportfel.some(x => x.vardkontaktId === vk)).toBe(false);
    db.query("UPDATE personal SET enhet_id = 'uso-kard' WHERE id = 'lak-kard'").run();
  });

  test('ett fel för ett vårdtillfälle syns bara när behörigheten gäller vårdtillfällets och varje kontakts vårdenhet, utan och med samtycke', async () => {
    const k = await inloggad('lak-kard');
    const db = sdb(k);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 11);
    // Patient 4 har spärrat Allmänpsykiatriska kliniken. Vårdtillfället har kardiologen som ansvarig vårdenhet, men
    // diagnosen med en kod som inte går att rapportera är registrerad på en kontakt på psykiatrin.
    const sparrad = vardtillfalle(db, { pid: 'p04', inskr: datum, utskr: addDagar(datum, 2) });
    const psyk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, vardtillfalle_id) VALUES ('p04', 'uso-psyk', 'slutenvard', ?, ?, ?)").run(new Date(`${datum}T12:00:00Z`).toISOString(), new Date(`${addDagar(datum, 1)}T12:00:00Z`).toISOString(), sparrad.vt).lastInsertRowid);
    diagnos(db, { pid: 'p04', enhet: 'uso-psyk', vk: psyk, kod: 'Q99.9', datum });
    // Samma sak på kardiologens egen kontakt, för patient 1 utan spärr, som kontroll.
    const egen = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 2) });
    diagnos(db, { pid: 'p01', vk: egen.vk, kod: 'Q99.9', datum });
    expect(mr.sammanstall(db, 'par').fel.filter(f => f.regel === 'kod').map(f => f.radNyckel).sort()).toEqual([`VT${egen.vt}`, `VT${sparrad.vt}`].sort());
    const rader = (await k.get('/api/inkorg')).data.rapportfel.filter(x => x.regel === 'kod');
    expect(rader.map(x => x.patientId)).toEqual(['p01']);
    expect(rader[0].detalj).toBe('Q99.9');
    // Med patientens samtycke till de spärrade uppgifterna och ett aktivt val för andra vårdenheter syns felet.
    expect((await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Rätta rapporten till patientregistret' })).status).toBe(200);
    expect((await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Rätta rapporten till patientregistret' })).status).toBe(200);
    const med = (await k.get('/api/inkorg')).data.rapportfel.filter(x => x.regel === 'kod');
    expect(med.map(x => x.patientId).sort()).toEqual(['p01', 'p04']);
    // Loggen har den starkaste grunden, den som psykiatrins spärrade kontakt krävde, inte kardiologens vårdrelation.
    const rad = db.query("SELECT grund FROM atkomstlogg WHERE patient_id = 'p04' AND resurs = ?").get(`inkorg:rapportfel:kod:VT${sparrad.vt}`);
    expect(rad.grund).toBe('samtycke_sparr');
  });

  test('den sparade sammanställningen görs om när en spärr eller en vårdenhet ändras', () => {
    const db = rensad();
    const { vk } = vardtillfalle(db, { pid: 'p05', enhet: 'uso-med', plats: 'uso-med' });
    diagnos(db, { pid: 'p05', enhet: 'uso-med', vk, kod: 'I48.0' });
    const forsta = mr.sammanstallCachad(db, 'par', { nu: NU });
    expect(forsta.undantag.some(u => u.nyckel === 'sparrade')).toBe(false);
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p05', 'uso-med', '2035-01-01')").run();
    expect(mr.sammanstallCachad(db, 'par', { nu: NU }).undantag.find(u => u.nyckel === 'sparrade')?.antal).toBe(1);
    db.query("UPDATE enheter SET namn = 'Medicinska kliniken USÖ, ny' WHERE id = 'uso-med'").run();
    db.query("UPDATE vardtillfallen SET enhet_id = 'kkoga-ort'").run();
    expect(mr.sammanstallCachad(db, 'par', { nu: NU }).filer.find(f => f.kod === 'SV_AD').text).toContain(';55011;311;');
  });

  test('kvalitetsregistrets återkoppling sparas och kan läsas', async () => {
    const u = await inloggad('uppf');
    const r = await u.post('/api/rapportering/kvalitetsregister/skicka');
    expect(r.status).toBe(201);
    const a = (await u.get('/api/rapportering/aterkoppling')).data.aterkoppling;
    expect(a.rapportId).toBe(r.data.id);
    expect(a.text).toContain('påhittade');
    expect(sdb(u).query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'myndighetsrapport' AND grund = 'kvalitetsregister' AND patient_id IS NOT NULL").get().n).toBe(r.data.antal.patienter);
    await u.logga('ssk-kard');
    expect((await u.post('/api/patient/p01/kvalitetsregister/motsatt')).status).toBe(201);
    expect((await u.post('/api/patient/p20/kvalitetsregister/motsatt')).status).toBe(403);
  });

  test('läkaren och sjuksköterskan registrerar och ångrar patientens invändning mot kvalitetsregistret, och det loggas', async () => {
    const k = await inloggad('ssk-kard');
    const db = sdb(k);
    expect((await k.get('/api/patient/p01/kvalitetsregister')).data).toMatchObject({ motsatt: false, register: 'Demoregister för hjärtsvikt' });
    const r = await k.post('/api/patient/p01/kvalitetsregister/motsatt');
    expect(r.status).toBe(201);
    expect((await k.get('/api/patient/p01/kvalitetsregister')).data).toMatchObject({ motsatt: true, av: 'vården' });
    expect((await k.post('/api/patient/p01/kvalitetsregister/aterkalla')).status).toBe(200);
    expect((await k.get('/api/patient/p01/kvalitetsregister')).data.motsatt).toBe(false);
    const logg = db.query("SELECT resurs FROM atkomstlogg WHERE patient_id = 'p01' AND handling = 'kvalitetsregister' AND resultat = 'tillaten' ORDER BY id").all().map(x => x.resurs);
    expect(logg).toEqual(expect.arrayContaining(['kvalitetsregister:motsatt', 'kvalitetsregister:aterkalla']));
    // Raden finns kvar med tiden för ångrandet, och ingen rad raderas.
    expect(db.query("SELECT count(*) AS n FROM kvalitetsregister_motsatt WHERE patient_id = 'p01' AND aterkallad IS NOT NULL").get().n).toBe(1);
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p01/kvalitetsregister/motsatt')).status).toBe(403);
    await k.logga('ssk-kard');
    expect((await k.post('/api/patient/p20/kvalitetsregister/motsatt')).status).toBe(403);
  });

  test('patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den', async () => {
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'inv-p10' })).status).toBe(200);
    const db = sdb(k);
    expect((await k.get('/api/min/journal/p10/kvalitetsregister/status')).data.motsatt).toBe(false);
    expect((await k.post('/api/min/journal/p10/kvalitetsregister/motsatt')).status).toBe(201);
    expect((await k.get('/api/min/journal/p10/kvalitetsregister/status')).data).toMatchObject({ motsatt: true, av: 'patienten' });
    expect(db.query("SELECT invanare_id FROM kvalitetsregister_motsatt WHERE patient_id = 'p10' AND aterkallad IS NULL").get().invanare_id).toBe('inv-p10');
    // Patienten kommer inte med i registret.
    expect(mr.sammanstall(db, 'kvalitetsregister').filer[0].text).not.toContain('194601136098');
    expect((await k.post('/api/min/journal/p10/kvalitetsregister/aterkalla')).status).toBe(200);
    expect((await k.get('/api/min/journal/p10/kvalitetsregister/status')).data.motsatt).toBe(false);
    // En annan patients journal svarar som en som inte finns, som i resten av Min journal.
    expect((await k.post('/api/min/journal/p01/kvalitetsregister/motsatt')).status).toBe(404);
    // En vårdnadshavare anmäler inte för barnet.
    const v = klient(app);
    await v.post('/api/login/invanare', { invanareId: 'inv-vh01' });
    expect((await v.post('/api/min/journal/p09/kvalitetsregister/motsatt')).status).toBe(403);
  });

  test('en diagnos som registreras via rapportfelet röjer inte dolda diagnoser, och två huvuddiagnoser rättas av den som får se båda', async () => {
    const k = await inloggad('lak-kard');
    const db = sdb(k);
    const per = mr.period('par', new Date());
    const datum = addDagar(per.fran, 13);
    // Patient 4 har spärrat Allmänpsykiatriska kliniken. Vårdtillfället har en kontakt där med en dold huvuddiagnos (F32.1)
    // och en dold bidiagnos med samma kod som läkaren sedan registrerar (I48.0).
    const { vt, vk } = vardtillfalle(db, { pid: 'p04', inskr: datum, utskr: addDagar(datum, 2) });
    const psyk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, vardtillfalle_id) VALUES ('p04', 'uso-psyk', 'slutenvard', ?, ?, ?)").run(new Date(`${datum}T12:00:00Z`).toISOString(), new Date(`${addDagar(datum, 1)}T12:00:00Z`).toISOString(), vt).lastInsertRowid);
    const dold = diagnos(db, { pid: 'p04', enhet: 'uso-psyk', vk: psyk, kod: 'F32.1', text: 'Medelsvår depressiv episod', datum });
    const doldDubblett = diagnos(db, { pid: 'p04', enhet: 'uso-psyk', vk: psyk, kod: 'I48.0', typ: 'bi', text: 'Paroxysmalt förmaksflimmer', datum });
    // Kontroll: samma registrering på ett vårdtillfälle utan dolda diagnoser.
    const kontroll = vardtillfalle(db, { pid: 'p01', inskr: datum, utskr: addDagar(datum, 2) });
    const r0 = await k.post(`/api/vardkontakt/${kontroll.vk}/diagnos`, { kod: 'I48.0' });
    const r = await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'I48.0' });
    expect(r.status).toBe(201);
    // Svaret har samma form som kontrollens och nämner inte de dolda raderna.
    expect(Object.keys(r.data).sort()).toEqual(Object.keys(r0.data).sort());
    expect(r.data).toMatchObject({ kod: 'I48.0', typ: 'huvud' });
    expect(r.data.fanns).toBeUndefined();
    expect([dold, doldDubblett]).not.toContain(r.data.id);
    const text = JSON.stringify(r.data);
    for (const x of ['F32.1', 'Medelsvår', String(dold), String(doldDubblett), 'psyk']) expect({ x, finns: text.includes(x) }).toEqual({ x, finns: false });
    // Nu har vårdtillfället två huvuddiagnoser. Rapportkontrollen fångar det.
    const fel = mr.sammanstall(db, 'par').fel.find(f => f.radNyckel === `VT${vt}`);
    expect(fel).toMatchObject({ regel: 'flera_huvud', atgard: 'huvuddiagnos' });
    expect(fel.text).not.toContain('F32');
    // Läkaren utan samtycke ser inte felet, och inkorgen nämner inte den dolda diagnosen.
    const utan = (await k.get('/api/inkorg')).data;
    expect(utan.rapportfel.some(x => x.regel === 'flera_huvud' && x.patientId === 'p04')).toBe(false);
    expect(JSON.stringify(utan.rapportfel)).not.toContain('F32.1');
    expect((await k.post(`/api/vardkontakt/${vk}/huvuddiagnos`, { diagnosId: r.data.id })).status).toBe(403);
    // Med samtycke och aktivt val ser hon båda och väljer huvuddiagnos.
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Rätta rapporten till patientregistret' });
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Rätta rapporten till patientregistret' });
    const rad = (await k.get('/api/inkorg')).data.rapportfel.find(x => x.regel === 'flera_huvud' && x.patientId === 'p04');
    expect(rad.forslag.map(f => f.kod).sort()).toEqual(['F32.1', 'I48.0']);
    expect((await k.post(`/api/vardkontakt/${vk}/huvuddiagnos`, { diagnosId: dold })).status).toBe(200);
    expect(mr.sammanstall(db, 'par').fel.some(f => f.radNyckel === `VT${vt}`)).toBe(false);
    expect(db.query('SELECT typ FROM diagnoser WHERE id = ?').get(r.data.id).typ).toBe('bi');
    // Med samtycke är den dolda dubbletten synlig och registreras inte igen.
    expect((await k.post(`/api/vardkontakt/${vk}/diagnos`, { kod: 'I48.0' })).data.fanns).toBe(true);
  });
});
