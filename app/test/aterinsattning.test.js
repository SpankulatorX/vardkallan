// Återinsättning efter ett uppehåll med antikoagulantia (runda 5, beslut 2026-11-03, Sussa 3.5.2.8). Systemet bevakar
// datumet för återinsättning: dagen före och på dagen får den ordinerande läkaren, den läkare som beslutade om uppehållet
// och vårdenhetens läkare en rad i inkorgen med läkemedlet, planen och en knapp till läkemedelslistan. Raden finns kvar
// tills läkemedlet är insatt igen eller ordinationen ändras.
import { describe, test, expect, beforeAll, afterAll, afterEach, setSystemTime } from 'bun:test';
import { aterstallKlockan } from './falsk-klocka.js';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as lakemedel from '../src/lakemedel.js';
import * as aterinsattning from '../src/aterinsattning.js';
import * as fhir from '../src/fhir.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => aterstallKlockan());
const waran = (db, pid = 'p01') => db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND k.namn = 'Waran' AND o.status = 'aktiv'").get(pid);
const uppehall = (db, vem, pid, o, dagar) => lakemedel.utsatt(atk(db, vem, pid, {}, 'ordinera'), o, { plan: { typ: 'uppehall', aterinsattning: addDagar(idag(), dagar) } });
const rader = (db, vem) => aterinsattning.inkorg(db, personal(db, vem));
// En ny ordination av samma läkemedel. Varningar kvitteras, eftersom testet gäller återinsättningen.
function ordinera(db, vem, pid, lm, extra = {}) {
  const a = atk(db, vem, pid, {}, 'ordinera');
  const bas = { lakemedelId: lm, dosering: 'Enligt doseringsschema, styrs av INR', typ: 'staende', ordinationsorsak: 'Förmaksflimmer, strokeprofylax', uppfoljningsdatum: addDagar(idag(), 30), ...extra };
  try { return lakemedel.spara(a, bas).ordination; } catch (e) {
    if (!e.extra?.kraverKvittens) throw e;
    return lakemedel.spara(a, { ...bas, kvitteradeVarningar: e.extra.kraverKvittens.map(regel => ({ regel, motivering: 'Bedömt i testet' })) }).ordination;
  }
}

describe('Återinsättning efter uppehåll', () => {
  test('dagen före och på dagen får läkaren en rad i inkorgen med läkemedlet, planen och en knapp till läkemedelslistan', () => {
    const db = sandladaKl('13:30');
    const o = waran(db);
    uppehall(db, 'lak-kard', 'p01', o, 2);
    // Två dagar före: ingen rad än.
    expect(rader(db, 'lak-kard')).toEqual([]);
    // Dagen före.
    setSystemTime(new Date(kl('08:00', addDagar(idag(), 1))));
    const r = rader(db, 'lak-kard');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ordinationId: o.id, patientId: 'p01', lakemedel: 'Waran 2,5 mg', aterinsattning: addDagar(idag(), 1), dagarKvar: 1, plan: `Uppehåll inför ingrepp, återinsätts ${addDagar(idag(), 1)}`, href: `#/patient/p01/lakemedel/aterinsatt-${o.id}` });
    expect(r[0].text).toContain('i morgon');
    expect(r[0].text).toContain('Enligt doseringsschema');
    // På dagen.
    setSystemTime(new Date(kl('08:00', addDagar(idag(), 1))));
    expect(rader(db, 'lak-kard')[0]).toMatchObject({ dagarKvar: 0 });
    expect(rader(db, 'lak-kard')[0].text).toContain('i dag');
    // Inkorgen släpper inget som inte är åtgärdat: raden står kvar efter dagen och säger det.
    setSystemTime(new Date(kl('08:00', addDagar(idag(), 2))));
    expect(rader(db, 'lak-kard')[0].dagarKvar).toBe(-2);
    expect(rader(db, 'lak-kard')[0].text).toContain('skulle sättas in igen');
  });

  test('raden går till den ordinerande läkaren, den som beslutade om uppehållet och vårdenhetens läkare, aldrig till andra roller', () => {
    const db = sandladaKl('13:30');
    // Gunnars Waran är ordinerat på medicinkliniken av en läkare som har slutat. Uppehållet beslutas av Sara Lindqvist
    // på kardiologen.
    uppehall(db, 'lak-kard', 'p01', waran(db), 1);
    expect(rader(db, 'lak-kard')).toHaveLength(1);
    // Kardiologens andra läkare (vårdenheten där uppehållet beslutades).
    expect(rader(db, 'ol-kard')).toHaveLength(1);
    // Inte sjuksköterskan, vårdadministratören eller en läkare på en annan vårdenhet.
    for (const id of ['ssk-kard', 'adm-kard', 'usk-kard', 'lak-akut', 'lak-vc']) expect({ id, n: rader(db, id).length }).toEqual({ id, n: 0 });
    // Vårdcentralens egen ordination: den ordinerande läkaren får raden.
    const eliquis = db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p10' AND k.namn = 'Eliquis'").get();
    uppehall(db, 'lak-vc', 'p10', eliquis, 0);
    expect(rader(db, 'lak-vc').map(x => x.patientId)).toEqual(['p10']);
  });

  test('raden försvinner när läkemedlet är insatt igen eller ordinationen ändras, men inte av en bryggbehandling', () => {
    const db = sandladaKl('13:30');
    uppehall(db, 'lak-kard', 'p01', waran(db), 1);
    // Fragmin som bryggbehandling under uppehållet är inte en återinsättning.
    ordinera(db, 'lak-kard', 'p01', 'VK-NPL-0004', { dosering: '1 injektion subkutant kl 18', dos: 5000, dosEnhet: 'IE', tider: ['18'], typ: 'tillfallig', ordinationsorsak: 'Bryggbehandling' });
    expect(rader(db, 'lak-kard')).toHaveLength(1);
    // Waran insatt igen: raden försvinner för alla mottagare.
    ordinera(db, 'lak-kard', 'p01', 'VK-NPL-0001');
    expect(rader(db, 'lak-kard')).toEqual([]);
    expect(rader(db, 'ol-kard')).toEqual([]);
    // En ändrad ordination (en ny ordination av samma substans som sedan sätts ut) räknas också.
    const db2 = sandladaKl('13:30');
    uppehall(db2, 'lak-kard', 'p01', waran(db2), 1);
    const ny = ordinera(db2, 'lak-kard', 'p01', 'VK-NPL-0001', { dosering: '1 tablett på kvällen enligt nytt schema' });
    lakemedel.utsatt(atk(db2, 'lak-kard', 'p01', {}, 'ordinera'), db2.query('SELECT * FROM ordinationer WHERE id = ?').get(ny.id), { plan: { typ: 'avslutad' } });
    expect(rader(db2, 'lak-kard')).toEqual([]);
  });

  test('säkerhet: bara patienter som användaren får se, och aldrig uppgifter från en spärrad vårdenhet', () => {
    const db = sandladaKl('13:30');
    const t = new Date().toISOString();
    const ny = (pid, enhet, av) => Number(db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, utsatt_tid, utsatt_av, utsatt_orsak, ordinerad_av, skapad, nll_status, kalla)
      VALUES (?, ?, 'VK-NPL-0002', '1 tablett morgon och kväll', 'staende', 'Förmaksflimmer', ?, ?, 'utsatt', ?, ?, 'Uppehåll inför ingrepp', ?, ?, 'kvitterad', 'vardkallan')`)
      .run(pid, enhet, addDagar(idag(), 30), addDagar(idag(), -30), t, av, av, t).lastInsertRowid);
    const plan = (id, av) => db.query("INSERT INTO utsattningsplaner (ordination_id, typ, aterinsattning, registrerad, av) VALUES (?, 'uppehall', ?, ?, ?)").run(id, addDagar(idag(), 1), t, av);
    // Elin Sandberg har spärrat psykiatrins uppgifter. En ordination från psykiatrin syns inte för kardiologen, inte ens
    // för den läkare som står som ordinerande, men för psykiatrins egen läkare.
    const psyk = ny('p04', 'uso-psyk', 'lak-psyk');
    db.query("UPDATE ordinationer SET ordinerad_av = 'lak-kard' WHERE id = ?").run(psyk);
    plan(psyk, 'lak-psyk');
    expect(rader(db, 'lak-kard').some(r => r.ordinationId === psyk)).toBe(false);
    expect(rader(db, 'lak-psyk').some(r => r.ordinationId === psyk)).toBe(true);
    // En patient utan vårdrelation till kardiologen syns inte, fast läkaren på kardiologen är mottagare.
    const utan = ny('p12', 'uso-kard', 'lak-kard');
    plan(utan, 'lak-kard');
    expect(rader(db, 'lak-kard').some(r => r.patientId === 'p12')).toBe(false);
    // En återinsättning på en spärrad vårdenhet tar inte bort raden, så att spärren inte röjs.
    const w = ordinera(db, 'lak-kard', 'p04', 'VK-NPL-0001');
    uppehall(db, 'lak-kard', 'p04', db.query('SELECT * FROM ordinationer WHERE id = ?').get(w.id), 1);
    expect(rader(db, 'lak-kard').some(r => r.ordinationId === w.id)).toBe(true);
    db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, ordinerad_av, skapad, nll_status, kalla)
      VALUES ('p04', 'uso-psyk', 'VK-NPL-0001', 'Enligt doseringsschema', 'staende', 'Ordinerat på psykiatrin', ?, ?, 'aktiv', 'lak-psyk', ?, 'kvitterad', 'vardkallan')`).run(addDagar(idag(), 30), idag(), new Date(Date.now() + 60_000).toISOString());
    expect(rader(db, 'lak-kard').some(r => r.ordinationId === w.id)).toBe(true);
    expect(rader(db, 'lak-psyk').some(r => r.ordinationId === w.id)).toBe(false);
    for (const r of rader(db, 'lak-kard')) expect(JSON.stringify(r)).not.toMatch(/psyk|Ström/i);
  });
});

// Runda 5, beslut 2026-11-03: läkaren kan avfärda raden när behandlingen avslutas för gott.
describe('Avslutad behandling efter uppehåll', () => {
  const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
  test('läkaren avslutar behandlingen med en orsak som systemet föreslår, sparat i historiken och i FHIR, och raden försvinner för alla mottagare', () => {
    const db = sandladaKl('13:30');
    const o = waran(db);
    uppehall(db, 'lak-kard', 'p01', o, 1);
    const rad = rader(db, 'lak-kard')[0];
    expect(rad.orsaker).toEqual(['Behandlingen behövs inte längre', 'Byte till annat läkemedel', 'Patienten avböjer']);
    // Orsaken krävs.
    expect(fel(() => aterinsattning.avsluta(db, personal(db, 'lak-kard'), o.id, {})).status).toBe(400);
    const r = aterinsattning.avsluta(db, personal(db, 'lak-kard'), o.id, { orsak: 'Patienten avböjer' });
    expect(r.avslutad).toMatchObject({ orsak: 'Patienten avböjer', av: 'Sara Lindqvist' });
    expect(rader(db, 'lak-kard')).toEqual([]);
    expect(rader(db, 'ol-kard')).toEqual([]);
    // Historiken och planen i läkemedelslistan.
    expect(db.query("SELECT personal_id, detalj FROM ordination_historik WHERE ordination_id = ? AND handelse = 'Återinsättningen avslutades'").get(o.id)).toEqual({ personal_id: 'lak-kard', detalj: 'Patienten avböjer' });
    const ut = lakemedel.lista(atk(db, 'lak-kard', 'p01', {}, 'las_lakemedel')).ordinationer.find(x => x.id === o.id);
    expect(ut.utsatt.plan.avslutad).toMatchObject({ orsak: 'Patienten avböjer', av: 'Sara Lindqvist' });
    expect(ut.utsatt.plan.text).toContain('behandlingen avslutad');
    // FHIR: en note med vem, när och orsak.
    const mr = fhir.medicationRequest(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(o.id));
    expect(mr.note.find(n => n.text.startsWith('Återinsättningen avslutades'))).toMatchObject({ authorString: 'Sara Lindqvist', time: r.avslutad.tid, text: 'Återinsättningen avslutades: Patienten avböjer.' });
    // Loggat på patienten, och bara en gång.
    expect(db.query("SELECT patient_id, handling, resultat FROM atkomstlogg WHERE resurs = ?").get(`ordination:${o.id}:aterinsattning_avslutad`)).toEqual({ patient_id: 'p01', handling: 'ordinera', resultat: 'tillaten' });
    expect(fel(() => aterinsattning.avsluta(db, personal(db, 'ol-kard'), o.id, { orsak: 'Byte till annat läkemedel' })).status).toBe(400);
    // Avslutet ändras och raderas aldrig.
    expect(() => db.query('UPDATE aterinsattning_avslut SET orsak = ?').run('x')).toThrow(/ändras inte/);
    expect(() => db.query('DELETE FROM aterinsattning_avslut').run()).toThrow(/raderas inte/);
  });

  test('säkerhet: bara en läkare som är mottagare och får se patienten, aldrig från en spärrad vårdenhet, och nekade försök loggas', () => {
    const db = sandladaKl('13:30');
    const o = waran(db);
    uppehall(db, 'lak-kard', 'p01', o, 1);
    for (const id of ['ssk-kard', 'adm-kard', 'lak-akut']) {
      const e = fel(() => aterinsattning.avsluta(db, personal(db, id), o.id, { orsak: 'Behandlingen behövs inte längre' }));
      expect({ id, status: e?.status }).toEqual({ id, status: 403 });
      expect(db.query('SELECT resultat FROM atkomstlogg WHERE personal_id = ? ORDER BY id DESC').get(id).resultat).toBe('nekad');
    }
    // En ordination från en spärrad vårdenhet går inte att avsluta, inte ens för den som står som ordinerande.
    const t = new Date().toISOString();
    const psyk = Number(db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, utsatt_tid, utsatt_av, utsatt_orsak, ordinerad_av, skapad, nll_status, kalla)
      VALUES ('p04', 'uso-psyk', 'VK-NPL-0002', '1 tablett', 'staende', 'Förmaksflimmer', ?, ?, 'utsatt', ?, 'lak-psyk', 'Uppehåll inför ingrepp', 'lak-kard', ?, 'kvitterad', 'vardkallan')`).run(addDagar(idag(), 30), addDagar(idag(), -30), t, t).lastInsertRowid);
    db.query("INSERT INTO utsattningsplaner (ordination_id, typ, aterinsattning, registrerad, av) VALUES (?, 'uppehall', ?, ?, 'lak-psyk')").run(psyk, addDagar(idag(), 1), t);
    const e = fel(() => aterinsattning.avsluta(db, personal(db, 'lak-kard'), psyk, { orsak: 'Patienten avböjer' }));
    expect(e.status).toBe(403);
    expect(e.message).not.toMatch(/psyk|Ström|Waran|Eliquis/i);
    expect(db.query('SELECT count(*) AS n FROM aterinsattning_avslut').get().n).toBe(0);
    // En ordination utan uppehåll går inte att avsluta så här.
    const furo = db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND k.namn LIKE 'Furosemid%' AND o.status = 'aktiv'").get();
    expect(fel(() => aterinsattning.avsluta(db, personal(db, 'lak-kard'), furo.id, { orsak: 'Patienten avböjer' })).status).toBe(400);
  });
});

describe('Återinsättning i inkorgen via API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('API: inkorgen visar raden med skyddad identitet maskerad, loggar åtkomsten och leder till läkemedelslistan', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    // Malin Engberg har skyddade personuppgifter. Vårdcentralen ordinerar Eliquis och gör uppehåll.
    const db = sandlada(app, k).db;
    const ny = await k.post('/api/patient/p03/lakemedel', { lakemedelId: 'VK-NPL-0002', dosering: '1 tablett morgon och kväll', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', ordinationsorsak: 'Förmaksflimmer, strokeprofylax', uppfoljningsdatum: addDagar(idag(), 30) });
    expect(ny.status).toBe(201);
    const id = ny.data.ordination.id;
    expect((await k.post(`/api/ordination/${id}/utsatt`, { plan: { typ: 'uppehall', aterinsattning: addDagar(idag(), 1) } })).status).toBe(200);
    const fore = db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p03' AND resurs = ?").get(`inkorg:aterinsattning:${id}`).n;
    const ik = (await k.get('/api/inkorg')).data;
    const rad = ik.aterinsattningar.find(r => r.ordinationId === id);
    expect(rad).toMatchObject({ patientId: 'p03', lakemedel: 'Eliquis 5 mg', href: `#/patient/p03/lakemedel/aterinsatt-${id}`, patient: { skyddad: true } });
    expect(JSON.stringify(rad)).not.toMatch(/Malin|Engberg|198404162383/);
    // Åtkomsten loggas på patienten en gång per session, inte vid varje uppdatering av inkorgen.
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p03' AND resurs = ? AND handling = 'las_lakemedel'").get(`inkorg:aterinsattning:${id}`).n).toBe(fore + 1);
    await k.get('/api/inkorg');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p03' AND resurs = ?").get(`inkorg:aterinsattning:${id}`).n).toBe(fore + 1);
    // Avslutad behandling via API: raden försvinner.
    expect((await k.post(`/api/ordination/${id}/aterinsattning/avsluta`, { orsak: 'Behandlingen behövs inte längre' })).status).toBe(200);
    expect((await k.get('/api/inkorg')).data.aterinsattningar.some(r => r.ordinationId === id)).toBe(false);
    // En sjuksköterska får ingen rad.
    await k.logga('ssk-kard');
    expect((await k.get('/api/inkorg')).data.aterinsattningar).toEqual([]);
  });
});
