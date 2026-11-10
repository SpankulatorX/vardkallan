// Blodprodukter i version 1.1 (runda 11, r4, Sussa 4.4.2.12): transfusionen som ordination och administrering i
// läkemedelslistan, den gemensamma transfusionskontrollen också vid sängen, rapporterna om transfusionsreaktioner
// (hemovigilans) och blodcentralens vy från den egna vårdenheten.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as blod from '../src/blod.js';
import * as labb from '../src/labb.js';
import * as lakemedel from '../src/lakemedel.js';
import * as administrering from '../src/administrering.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';
import { testserver, klient, sandlada as serverSandlada } from './hjalp.js';

const ny = (db, id = 'bl1', extra = {}) => nyPatient(db, { id, enhet: 'kkoga-ort', ar: 1952, kon: 'M', ...extra });
const lak = (db, pid = 'bl1', h = 'bestalla_prov', val = {}) => atk(db, 'lak-kkoga', pid, h, val);
const ssk = (db, pid = 'bl1', h = 'ge_lakemedel') => atk(db, 'ssk-kkoga', pid, h);
const pnr = (db, pid = 'bl1') => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;
const fel = (f) => { try { f(); } catch (e) { return e; } throw new Error('inget fel'); };
function taOchSvara(db, labbId, pid, nu) {
  const b = labb.bestallningRad(db, labbId);
  for (const p of labb.bestallningUt(db, b).prov) labb.taProv(atk(db, 'ssk-kkoga', pid, 'ta_prov'), labb.provRad(db, p.id), nu);
  labb.forfallnaSvar(db, new Date(nu.getTime() + 25 * 60_000));
}
function berett(db, pid = 'bl1', body = { produkt: 'erytrocyter', antal: 2, indikation: 'Postoperativ anemi, Hb 72' }) {
  const b = blod.bestall(lak(db, pid), body, BAS);
  taOchSvara(db, blod.bestallningRad(db, b.id).labb_bestallning_id, pid, efter(10));
  return blod.forPatient(lak(db, pid, 'las_prover'), efter(40)).bestallningar.find(x => x.id === b.id);
}
function kontrollerad(db, e, nu, pid = 'bl1') {
  const las = { armband: pnr(db, pid), enhetsnummer: e.enhetsnummer };
  blod.forbered(ssk(db, pid), blod.enhetRad(db, e.id), las, nu);
  return blod.kontrollera(lak(db, pid, 'ge_lakemedel'), blod.enhetRad(db, e.id), las, new Date(nu.getTime() + 60_000));
}

describe('Blodprodukter i version 1.1', () => {
  test('transfusionen blir en ordination och en administrering i läkemedelslistan, med enhetsnumret och de två som kontrollerade', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    expect(b.ordinationId).toBeGreaterThan(0);
    const o = lakemedel.synligaOrdinationer(atk(db, 'lak-kkoga', 'bl1', 'las_lakemedel')).find(x => x.id === b.ordinationId);
    expect(o).toMatchObject({ lakemedel_id: 'VK-BLOD-0001', typ: 'tillfallig', dos: 2, dos_enhet: 'enhet', orsak: 'Postoperativ anemi, Hb 72', nll_status: 'ej_aktuell' });
    expect(o.dosering).toContain(`enligt blodbeställning ${b.nummer}`);
    blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(45));
    const e = b.enheter[0];
    kontrollerad(db, e, efter(50));
    blod.starta(ssk(db), blod.enhetRad(db, e.id), efter(52));
    const adm = administrering.synligaAdministreringar(atk(db, 'ssk-kkoga', 'bl1', 'las_lakemedel')).filter(a => a.ordination_id === b.ordinationId);
    expect(adm).toHaveLength(1);
    expect(adm[0]).toMatchObject({ status: 'given', lakemedel_id: 'VK-BLOD-0001', dos: 1, kontrollkod: e.enhetsnummer, utford_av: 'ssk-kkoga', tid: efter(52).toISOString() });
    expect(JSON.parse(adm[0].kvitterade_varningar)[0].motivering).toBe(`Kontrollerad vid sängen av Tove Ahlström och Ingrid Moberg, enhet ${e.enhetsnummer}, blodgrupp ${e.blodgrupp}.`);
    // Trombocyter och plasma har också en produkt i katalogen.
    expect(blod.KATALOG_ID.trombocyter).toBe('VK-BLOD-0003');
    expect(db.query("SELECT atc FROM katalog WHERE id = 'VK-BLOD-0003'").get().atc).toBe('B05AX02');
  });

  test('en blodprodukt i läkemedelslistan ges bara från blodbeställningen, aldrig med en vanlig administrering', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    const e = fel(() => administrering.spara(ssk(db), { ordinationId: b.ordinationId, kvitteradeVarningar: [{ regel: 'blodkontroll', motivering: 'Kontrollerad av två' }] }));
    expect([e.status, e.kod]).toEqual([409, 'blod']);
    expect(e.message).toBe('Erytrocytkoncentrat ges från blodbeställningen i fliken Blod. Där kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och bastestet, och en andra person kontrollerar i sin egen inloggning.');
    expect(fel(() => administrering.spara(ssk(db), { ordinationId: b.ordinationId, atgard: 'iordningstall' })).kod).toBe('blod');
  });

  test('kontrollen vid sängen går genom den gemensamma transfusionskontrollen: ett bastest som har gått ut sedan blodet bereddes stoppar transfusionen', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(45));
    // Bastestet blir äldre än tre dygn, som när blodet har legat reserverat länge innan det lämnas ut.
    db.query("UPDATE labb_prov SET provtagen_tid = ? WHERE patient_id = 'bl1'").run(efter(-4 * 24 * 60).toISOString());
    const e = fel(() => blod.forbered(ssk(db), blod.enhetRad(db, b.enheter[0].id), { armband: pnr(db), enhetsnummer: b.enheter[0].enhetsnummer }, efter(50)));
    expect([e.kod, e.message]).toEqual(['transfusionskontroll', 'Det finns inget giltigt bastest. Ett bastest gäller i 72 timmar efter provtagningen. Beställ ett nytt bastest. Ge inte blodet.']);
  });

  test('hemovigilans: en transfusionsreaktion är en egen rapport som systemet klassar, transfusionen stoppas och proverna beställs med ett klick', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(45));
    const [e1, e2] = b.enheter;
    expect(fel(() => blod.reaktion(ssk(db), blod.enhetRad(db, e1.id), { symtom: ['feber'] }, efter(46))).message).toContain('under transfusionen');
    kontrollerad(db, e1, efter(50));
    blod.starta(ssk(db), blod.enhetRad(db, e1.id), efter(52));
    expect(fel(() => blod.reaktion(ssk(db), blod.enhetRad(db, e1.id), { symtom: ['toString'] }, efter(60))).message).toBe('Välj patientens symtom.');
    expect(blod.klassaReaktion(['urtikaria'], null)).toBe('allergisk');
    expect(blod.klassaReaktion(['frossa'], 38.9)).toBe('febril');
    expect(blod.klassaReaktion(['urtikaria', 'andnod'], null)).toBe('anafylaktisk');
    expect(blod.klassaReaktion(['andnod'], null)).toBe('andning');
    const r = blod.reaktion(ssk(db), blod.enhetRad(db, e1.id), { symtom: ['blodtrycksfall', 'ryggsmarta'], temp: '38,9' }, efter(60));
    expect(r.reaktion).toMatchObject({ typ: 'hemolytisk', typText: 'Misstänkt hemolytisk transfusionsreaktion', allvarlighet: 'allvarlig', av: 'Tove Ahlström', status: 'mottagen',
      enhetsnummer: e1.enhetsnummer, proverBestallda: false });
    expect(r.reaktion.atgarder.slice(0, 2)).toEqual(['Stoppa transfusionen och låt infarten sitta.', 'Larma läkaren nu.']);
    expect(r.enheter[0]).toMatchObject({ status: 'avbruten', statusText: 'Avbruten vid reaktion' });
    expect(r.avvikelser.at(-1).orsak).toBe(`Transfusionsreaktion rapporterad för enhet ${e1.enhetsnummer}: misstänkt hemolytisk transfusionsreaktion.`);
    // Den andra enheten återlämnas, och beställningen är avslutad.
    expect(blod.aterlamna(ssk(db), blod.enhetRad(db, e2.id), { orsak: 'Reaktion på den första enheten' }, efter(61)).status).toBe('avslutad');
    // Proverna efter reaktionen beställs med ett klick, en gång.
    const p = blod.reaktionProver(lak(db), r.reaktion.id, efter(62));
    expect(p.bestallning.analyser.map(a => a.analys)).toEqual(expect.arrayContaining(['bastest', 'blododling', 'blodgruppering', 'blodstatus']));
    expect(p.reaktion.proverBestallda).toBe(true);
    expect(fel(() => blod.reaktionProver(lak(db), r.reaktion.id, efter(63))).message).toContain('redan beställda');
    expect(() => db.query('UPDATE blod_reaktioner SET typ = ?').run('annan')).toThrow('ändras inte');
  });

  test('säkerhet: en reaktion eller dess prover för en annan patient eller vårdenhet ges inte, och en spärrad reaktion syns inte i blodcentralens vy', () => {
    const db = sandlada();
    ny(db); ny(db, 'bl2');
    const b = berett(db);
    blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(45));
    kontrollerad(db, b.enheter[0], efter(50));
    blod.starta(ssk(db), blod.enhetRad(db, b.enheter[0].id), efter(52));
    const r = blod.reaktion(ssk(db), blod.enhetRad(db, b.enheter[0].id), { symtom: ['urtikaria'] }, efter(55)).reaktion;
    expect(fel(() => blod.reaktion(ssk(db, 'bl2'), blod.enhetRad(db, b.enheter[1].id), { symtom: ['feber'] }, efter(56))).status).toBe(404);
    expect(fel(() => blod.reaktionProver(lak(db, 'bl2'), r.id, efter(56))).status).toBe(404);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bl1', 'lind-med', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(fel(() => blod.reaktionProver(atk(db, 'lak-lind', 'bl1', 'bestalla_prov', { andra_enheter: true }), r.id, efter(56))).status).toBe(403);
    // Blodcentralens vy för en annan vårdenhet visar inte beställningen.
    const annan = blod.blodcentralVy(db, pers(db, 'lak-lind'), () => ({}), efter(57));
    expect(annan.bestallningar).toEqual([]);
    const egen = blod.blodcentralVy(db, pers(db, 'ssk-kkoga'), () => ({}), efter(57));
    expect(egen.bestallningar.map(x => [x.nummer, x.reaktioner.length])).toEqual([[b.nummer, 1]]);
    // Undersköterskan följer inte blodbeställningarna.
    expect(fel(() => blod.blodcentralVy(db, pers(db, 'usk-kard'), () => ({}), efter(57))).status).toBe(403);
  });

  test('blodcentralens vy visar vårdenhetens beställningar i kedjan, enheterna på avdelningen och lagret per blodgrupp, och varje patient loggas', () => {
    const db = sandlada();
    ny(db); ny(db, 'bl3');
    const b = berett(db);
    blod.bestall(lak(db, 'bl3'), { produkt: 'erytrocyter', antal: 1, indikation: 'Anemi' }, efter(41));
    blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(45));
    const v = blod.blodcentralVy(db, pers(db, 'lak-kkoga'), () => ({}), efter(80));
    expect(v.steg.map(s => s.namn)).toEqual(['Upprättad', 'Blodgruppering och bastest', 'Förenlighetsprövad', 'Utlämnad', 'Avslutad']);
    expect(v.bestallningar.map(x => [x.patient.id, x.steg, x.statusText])).toEqual([['bl3', 1, 'Väntar på blodgruppering och bastest'], ['bl1', 3, 'Utlämnad till avdelningen']]);
    // Mer än 30 minuter efter utlämningen säger systemet att enheten ska återlämnas.
    expect(v.bestallningar[1].enheter.every(e => e.forSent)).toBe(true);
    const grupp = b.enheter[0].blodgrupp;
    expect(v.lager.find(l => l.blodgrupp === grupp)).toMatchObject({ reserverade: 2 });
    expect(JSON.stringify(v.lager)).not.toContain('bl1');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'lak-kkoga' AND resurs = '/api/blodcentral'").get().n).toBe(2);
    // En patient med skyddade personuppgifter visas utan namn.
    db.query("UPDATE patienter SET skyddad = 1 WHERE id = 'bl3'").run();
    expect(blod.blodcentralVy(db, pers(db, 'lak-kkoga'), () => ({}), efter(81)).bestallningar[0].patient.namn).toBe('Skyddad identitet');
    // En spärr mot den beställande vårdenheten döljer inte beställningen för den egna vårdenheten, men för en annan.
    sparr(db, 'bl1', 'kkoga-ort');
    expect(blod.blodcentralVy(db, pers(db, 'lak-kkoga'), () => ({}), efter(82)).bestallningar).toHaveLength(2);
  });
});

describe('Blodprodukter i version 1.1 via API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('API: blodcentralens vy, journalens markering och reaktionen rapporteras med proverna i två anrop', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = serverSandlada(app, k).db;
    nyPatient(db, { id: 'ba1', enhet: 'uso-kard-72', ar: 1950, kon: 'M', start: new Date() });
    expect((await k.get('/api/patient/ba1')).data.specialistR11r4).toEqual({ cytostatika: false, blod: false });
    const b = await k.post('/api/patient/ba1/blod', { produkt: 'plasma', antal: 1, indikation: 'Blödning' });
    expect(b.status).toBe(201);
    expect((await k.get('/api/patient/ba1')).data.specialistR11r4.blod).toBe(true);
    expect((await k.get('/api/blodcentral')).data.bestallningar.some(x => x.id === b.data.id)).toBe(true);
    expect((await k.post('/api/blod/reaktion/999999/prover', {})).status).toBe(404);
    expect((await k.post('/api/blodenhet/999999/reaktion', { symtom: ['feber'] })).status).toBe(404);
    await k.logga('usk-kard');
    expect((await k.get('/api/blodcentral')).status).toBe(403);
  });
});
