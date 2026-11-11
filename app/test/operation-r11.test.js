// Operationsplanering och anestesi, version 1.1 (runda 11, r2, Sussa 4.5.1.1 till 4.5.1.5 och 4.6.1.4): salsblock över
// flera vårdenheter och sjukhus, teamet med anestesi, utrustning och instrumentgaller, vårdhändelser som påverkar ett
// planerat ingrepp, identitetskontroll och WHO:s checklista i full omfattning. Varje test bygger en sandlåda vid en fast
// tidpunkt (måndag 2026-11-09 klockan 08.00 svensk tid) och lägger in sina egna patienter.
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { stallKlockan, aterstallKlockan } from './falsk-klocka.js';
import { testserver, klient, sandlada as serverSandlada } from './hjalp.js';
import { datumAv, addDagar, lokalTid } from '../src/db.js';
import * as op from '../src/operation.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';
import * as iva from '../src/iva.js';
import * as aj from '../src/anestesijournal.js';
import * as sg from '../src/sterilgods.js';
import * as datauttag from '../src/datauttag.js';
import * as opSeed from '../src/operation-seed.js';
import { harVardrelation } from '../src/atkomst.js';

const MORGON = addDagar(datumAv(BAS), 1);
const DAG = (n) => addDagar(datumAv(BAS), n);
const ny = (db, id = 'op1', enhet = 'kkoga-ort', extra = {}) => nyPatient(db, { id, enhet, ar: 1958, ...extra });
const anmal = (db, pid = 'op1', body = { kva: 'NFB49', sida: 'hoger' }, roll = 'lak-kkoga', nu = BAS) => op.anmal(atk(db, roll, pid, 'operation_anmala'), body, nu);
const rad = (db, id) => op.anmalanRad(db, id);
const pl = (db, pid, roll = 'ssk-kkoga') => atk(db, roll, pid, 'operation_planera');
const ALLA = (del) => Object.keys(op.CHECKLISTA[del].punkter);
const pnr = (db, pid) => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;

describe('Operation 1.1', () => {
  test('salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op9', 'uso-ort');
    const v = op.veckoblock(db, pers(db, 'ssk-kkoga'), { fran: datumAv(BAS) }, BAS);
    const cell = (sal, datum) => v.salar.find(s => s.id === sal).dagar.find(d => d.datum === datum);
    expect(cell('lind-sal-1', DAG(2))).toMatchObject({ vardenhet: { id: 'kkoga-ort' }, egen: true });
    expect(cell('kkoga-sal-2', DAG(4))).toMatchObject({ vardenhet: { id: 'uso-ort', namn: 'Ortopediska kliniken USÖ' }, egen: false });
    // Ortopeden på USÖ opererar i Karlskoga på fredagen, i sitt eget block.
    const b = anmal(db, 'op9', { kva: 'NGB49', sida: 'hoger' }, 'lak-ort');
    expect(() => op.planera(pl(db, 'op9', 'lak-ort'), rad(db, b.id), { sal: 'kkoga-sal-1', start: lokalTid(DAG(4), '07:30') }, BAS)).toThrow('tilldelad Ortopediska kliniken Karlskoga lasarett');
    const p = op.planera(pl(db, 'op9', 'lak-ort'), rad(db, b.id), { sal: 'kkoga-sal-2', start: lokalTid(DAG(4), '07:30') }, BAS);
    expect(p.planering.sal).toMatchObject({ id: 'kkoga-sal-2', namn: 'Operationssal 2, Karlskoga' });
    expect(() => op.slappBlock(db, pers(db, 'lak-ort'), { sal: 'kkoga-sal-2', datum: DAG(4) }, BAS)).toThrow('planerade operationer');
    // Karlskoga kan inte planera i USÖ:s block nästa fredag förrän blocket är släppt.
    const a = anmal(db, 'op1', { kva: 'NGB49', sida: 'vanster' });
    expect(() => op.planera(pl(db, 'op1'), rad(db, a.id), { sal: 'kkoga-sal-2', start: lokalTid(DAG(11), '07:30') }, BAS)).toThrow('tilldelad Ortopediska kliniken USÖ');
    expect(() => op.taBlock(db, pers(db, 'ssk-kkoga'), { sal: 'kkoga-sal-2', datum: DAG(11) }, BAS)).toThrow('tilldelat');
    expect(() => op.slappBlock(db, pers(db, 'ssk-kkoga'), { sal: 'kkoga-sal-2', datum: DAG(11) }, BAS)).toThrow('egna vårdenhetens');
    op.slappBlock(db, pers(db, 'lak-ort'), { sal: 'kkoga-sal-2', datum: DAG(11) }, BAS);
    expect(op.blockFor(db, 'kkoga-sal-2', DAG(11)).vardenhet).toBe(null);
    op.taBlock(db, pers(db, 'ssk-kkoga'), { sal: 'kkoga-sal-2', datum: DAG(11) }, efter(5));
    expect(op.planera(pl(db, 'op1'), rad(db, a.id), { sal: 'kkoga-sal-2', start: lokalTid(DAG(11), '07:30') }, efter(6)).status).toBe('planerad');
    // Undersköterskan och en vårdenhet utan operationer ändrar inte blocken.
    expect(() => op.slappBlock(db, pers(db, 'usk-kard'), { sal: 'uso-sal-2', datum: DAG(2) }, BAS)).toThrow('planera');
    expect(() => op.taBlock(db, pers(db, 'lak-kard'), { sal: 'uso-sal-2', datum: DAG(1) }, BAS)).toThrow('ingen operationsverksamhet');
  });

  test('ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före', () => {
    // Onsdag: sal 2 i Karlskoga är USÖ:s block på fredagar. Fredagen om två dagar är släppt för Karlskoga, nästa fredag inte.
    const ONS = new Date('2026-11-11T07:00:00Z');
    const db = sandlada(ONS);
    ny(db, 'op1');
    const a = op.anmal(atk(db, 'lak-kkoga', 'op1', 'operation_anmala'), { kva: 'NGB49', sida: 'hoger' }, ONS);
    const p = pl(db, 'op1');
    expect(op.blockFor(db, 'kkoga-sal-2', '2026-11-13', ONS)).toMatchObject({ vardenhet: 'uso-ort', frislappt: true });
    expect(op.blockFor(db, 'kkoga-sal-2', '2026-11-20', ONS)).toMatchObject({ vardenhet: 'uso-ort', frislappt: false });
    expect(() => op.planera(p, rad(db, a.id), { sal: 'kkoga-sal-2', start: lokalTid('2026-11-20', '07:30') }, ONS)).toThrow('tilldelad Ortopediska kliniken USÖ');
    expect(op.planera(p, rad(db, a.id), { sal: 'kkoga-sal-2', start: lokalTid('2026-11-13', '07:30') }, ONS).planering.sal.id).toBe('kkoga-sal-2');
    // Blocken gäller bara de vårdenheter som opererar, som behörighetsmotorn räknar anestesirelationen ur.
    expect(Object.values(op.BLOCKSCHEMA).flatMap(d => Object.values(d)).filter(Boolean).every(op.opererar)).toBe(true);
  });

  test('teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    const a = anmal(db, 'op1', { kva: 'NGB49', sida: 'hoger' });
    const f = op.planeringsforslag(pl(db, 'op1'), rad(db, a.id), BAS);
    expect(f).toMatchObject({ operator: { id: 'lak-kkoga' }, opssk: { id: 'ssk-kkoga' }, anestesilakare: { id: 'lak-ane-kkoga', namn: 'Martin Ödman' }, anestesissk: { id: 'ssk-ane-kkoga', namn: 'Kajsa Strand' } });
    expect(f.utrustning.map(u => u.id)).toEqual(['kna-galler']);
    const p = op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    expect(p.planering.team).toMatchObject({ operator: 'Ingrid Moberg', opssk: 'Tove Ahlström', anestesilakare: 'Martin Ödman', anestesissk: 'Kajsa Strand' });
    expect(p.planering.utrustning).toEqual([{ id: 'kna-galler', namn: 'Instrumentgaller för knäprotes', typ: 'sterilgods' }]);
    const b = anmal(db, 'op2', { kva: 'NGB49', sida: 'vanster' });
    // Karlskoga har ett galler för knäprotes, så den andra knäplastiken kan inte göras samtidigt i sal 2.
    expect(() => op.planera(pl(db, 'op2'), rad(db, b.id), { sal: 'kkoga-sal-2', start: lokalTid(MORGON, '07:30') }, BAS)).toThrow('Instrumentgaller för knäprotes är upptaget');
    expect(op.planeringsforslag(pl(db, 'op2'), rad(db, b.id), BAS).start).toBe(lokalTid(MORGON, '09:30'));
    expect(() => op.planera(pl(db, 'op2'), rad(db, b.id), { anestesilakare: 'lak-kkoga' }, BAS)).toThrow('anestesiläkare');
  });

  test('vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas', () => {
    const db = sandlada();
    ny(db, 'op1');
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op1', 'uso-kard', 'oppenvard', ?, 'Mottagning', 'Kontroll')").run(efter(-60 * 24).toISOString());
    // Anmälan gjordes för tre dagar sedan, och en diagnos från anmälningsdagen räknas inte som ny.
    const a = anmal(db, 'op1', { kva: 'NFB49', sida: 'hoger' }, 'lak-kkoga', efter(-3 * 24 * 60));
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('op1', 'kkoga-ort', 'M16.1', 'Primär koxartros, ensidig eller UNS', 'huvud', ?)").run(addDagar(datumAv(BAS), -3));
    const utan = JSON.stringify(op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(10)));
    // Ett läkemedel från en spärrad vårdenhet räknas inte.
    db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, ordinerad_av, skapad) VALUES ('op1', 'uso-kard', 'VK-NPL-0002', '1 x 2', 'staende', 'Förmaksflimmer', ?, ?, 'aktiv', 'lak-kard', ?)").run(DAG(60), datumAv(BAS), BAS.toISOString());
    sparr(db, 'op1', 'uso-kard');
    expect(JSON.stringify(op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(10)))).toBe(utan);
    db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, ordinerad_av, skapad) VALUES ('op1', 'kkoga-ort', 'VK-NPL-0001', '1 tablett', 'staende', 'Förmaksflimmer', ?, ?, 'aktiv', 'lak-kkoga', ?)").run(DAG(60), datumAv(BAS), BAS.toISOString());
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('op1', 'kkoga-ort', 'temp', '38.6', 38.6, ?)").run(efter(5).toISOString());
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('op1', 'kkoga-ort', 'J18.9', 'Pneumoni, ospecificerad', 'bi', ?)").run(datumAv(BAS));
    const u = op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(10));
    const t = u.paverkar.map(x => x.text).join(' ');
    expect(t).toContain('Waran');
    expect(t).toContain('38,6');
    expect(t).toContain('Pneumoni');
    expect(t).not.toContain('Eliquis');
    expect(t).not.toContain('koxartros');
    expect(u.paverkar.find(x => x.typ === 'antikoagulantia').niva).toBe('varning');
    // Säkerhetsgranskningen: läkemedlen, mätvärdena och diagnoserna som systemet läser loggas med sin egen grund.
    const logg = db.query("SELECT handling, grund, resurs FROM atkomstlogg WHERE patient_id = 'op1' AND resurs = ?").all(`operation:${a.id}:paverkar`);
    expect(logg.map(r => r.handling).sort()).toEqual(expect.arrayContaining(['las_diagnoser', 'las_lakemedel', 'las_matvarden']));
    expect(logg.every(r => ['vardrelation', 'egen_enhet'].includes(r.grund))).toBe(true);
  });

  test('identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt', () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum) VALUES ('op1', 'kkoga-ort', 'Penicillin', 'J01C', 'Urtikaria', 'mattlig', ?)").run(datumAv(BAS));
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    const antal = Object.values(op.CHECKLISTA).reduce((s, d) => s + Object.keys(d.punkter).length, 0);
    expect(antal).toBeGreaterThanOrEqual(22);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    const t0 = new Date(lokalTid(MORGON, '07:30'));
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'in_sal', armband: '191212121212' }, t0)).toThrow('Armbandet hör inte till');
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal', armband: pnr(db, 'op1') }, t0);
    const u = op.checklistaUnderlag(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), t0);
    const punkt = (del, id) => u.delar.find(d => d.id === del).punkter.find(p => p.id === id);
    expect(punkt('fore_anestesi', 'identitet')).toMatchObject({ forifylld: true });
    expect(punkt('fore_anestesi', 'identitet').text).toContain('Armbandet är skannat');
    expect(punkt('fore_anestesi', 'allergi').text).toContain('Penicillin');
    expect(punkt('fore_anestesi', 'markering').forifylld).toBe(false);
    expect(punkt('fore_snitt', 'antibiotika').text).toContain('Klindamycin');
    // Ett ingrepp utan sida behöver ingen markering, och systemet säger det.
    ny(db, 'op2');
    const b = anmal(db, 'op2', { kva: 'JKA21' });
    op.planera(pl(db, 'op2'), rad(db, b.id), {}, BAS);
    const u2 = op.checklistaUnderlag(atk(db, 'ssk-kkoga', 'op2', 'las_operation'), rad(db, b.id), t0);
    expect(u2.delar[0].punkter.find(p => p.id === 'markering')).toMatchObject({ forifylld: true, ejAktuell: true });
    // En del av checklistan kan inte sparas utan punkterna som bara teamet kan bekräfta.
    expect(() => op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ['identitet'] }, efter(1, t0))).toThrow('bekräfta');
    expect(op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, efter(2, t0)).forlopp.checklista[0].klar).toBe(true);
  });

  test('sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden', () => {
    const db = sandlada();
    expect(op.session(db, pers(db, 'opk-kkoga'))).toMatchObject({ vardenhet: { id: 'kkoga-ort' }, sjukhus: 'kkoga' });
    expect(op.session(db, pers(db, 'lak-kard'))).toBe(null);
    ny(db, 'op1'); ny(db, 'op2');
    const a = anmal(db, 'op1', { kva: 'NGB49', sida: 'hoger' });
    const b = anmal(db, 'op2', { kva: 'NFB49', sida: 'hoger' });
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    op.planera(pl(db, 'op2'), rad(db, b.id), { sal: 'kkoga-sal-1', start: lokalTid(MORGON, '09:30') }, BAS);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    const t0 = Date.parse(lokalTid(MORGON, '07:30'));
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, new Date(t0 + 20 * 60_000));
    const o = op.oversikt(db, pers(db, 'ssk-kkoga'), () => ({}), { datum: MORGON }, new Date(t0 + 140 * 60_000));
    const [forsta, andra] = o.salar.find(x => x.id === 'kkoga-sal-1').operationer;
    expect(forsta).toMatchObject({ status: 'pagar', forsenad: true });
    expect(andra.beraknadStart > andra.start).toBe(true);
    expect(andra.avvikelse).toContain('försenad');
  });
});

describe('Operation 1.1, seeden', () => {
  // Seeden lägger dagens operationer på fasta klockslag på seedens dag, också när sandlådan skapas kring midnatt.
  for (const bas of [BAS, new Date('2026-11-12T22:30:00Z'), new Date('2026-11-12T23:30:00Z')]) {
    test(`seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (${bas.toISOString()})`, () => {
      const db = sandlada(bas);
      opSeed.seeda(db, bas);
      const dag = datumAv(bas);
      const p07 = db.query("SELECT * FROM op_anmalningar WHERE patient_id = 'p07'").get();
      expect(p07).toMatchObject({ status: 'klar', kva: 'NFB49', sida: 'vanster' });
      const u = op.anmalanUt(atk(db, 'opk-kkoga', 'p07', 'las_operation'), p07, bas);
      expect(u.forlopp.checklista.every(c => c.klar)).toBe(true);
      expect(u.forlopp.implantat).toHaveLength(2);
      expect(u.forlopp.uppvakning.overrapport).toContain('Under operationen: Bupivakain spinalt 10 mg');
      expect(aj.journalFor(atk(db, 'opk-kkoga', 'p07', 'las_operation'), p07, bas).varden.length).toBeGreaterThan(20);
      const o = op.oversikt(db, pers(db, 'opk-kkoga'), () => ({}), { datum: dag }, bas);
      expect(o.salar.find(s => s.id === 'kkoga-sal-1').operationer.map(x => x.patient?.id)).toEqual(['p71', 'p72']);
      const v = op.vantelista(db, pers(db, 'opk-kkoga'), () => ({}), bas);
      expect(v.vantande.map(x => x.patient.id)).toEqual(['p75', 'p74']);
      expect(v.vantande[0].overMal).toBe(true);
      expect(op.anmalanUt(atk(db, 'opk-kkoga', 'p71', 'las_operation'), op.anmalanRad(db, o.salar[0].operationer[0].anmalanId), bas).forberedelser.punkter.find(x => x.id === 'anestesi').klar).toBe(true);
    });
  }
});

// ---- Anestesibedömningen, anestesijournalen, sterilgodset och materialet ------------------------------------------------
const pat = (db, pid) => db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
const vikt = (db, pid, kg) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES (?, 'kkoga-ort', 'vikt', ?, ?, ?)").run(pid, String(kg), kg, efter(-60).toISOString());
// En planerad operation där patienten har kommit in på salen.
function paSal(db, pid = 'op1', body = { kva: 'NFB49', sida: 'hoger' }) {
  const a = anmal(db, pid, body);
  op.planera(pl(db, pid), rad(db, a.id), {}, BAS);
  const s = atk(db, 'ssk-kkoga', pid, 'operation_registrera');
  const t0 = Date.parse(op.anmalanUt(s, rad(db, a.id), BAS).planering.start);
  const vid = (m) => new Date(t0 + m * 60_000);
  op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0));
  return { id: a.id, s, vid, t0 };
}
// Från anestesistart till ut från sal, med implantatet och checklistan.
function genomfor(db, { id, s, vid }, { slut = 100, ut = 105, rakna = false } = {}) {
  // Runda 11, r2: läkaren sätter och bekräftar ASA-klassen på operationsdagen före anestesistart.
  op.anestesibedomning(atk(db, 'lak-kkoga', s.patientId, 'operation_anmala'), rad(db, id), { asa: 2 }, vid(7));
  op.bekraftaAsa(atk(db, 'lak-kkoga', s.patientId, 'anestesibedomning'), rad(db, id), {}, vid(8));
  for (const [del, h, m] of [['fore_anestesi', 'anestesistart', 10], ['fore_snitt', 'knivtid', 20]]) {
    op.checklista(s, rad(db, id), { del, bekraftade: ALLA(del) }, vid(m - 1)); op.registrera(s, rad(db, id), { handelse: h }, vid(m));
  }
  op.implantat(s, rad(db, id), { artikel: 'Höftprotes (demo)', tillverkare: 'Demotillverkaren', lot: 'LOT-2026-1' }, vid(60));
  op.registrera(s, rad(db, id), { handelse: 'op_slut' }, vid(slut));
  if (rakna) sg.rakna(s, rad(db, id), { galler: 'KKOGA-HOFT-1', instrument: 64, kompresserOchNalar: true }, vid(slut + 1));
  op.checklista(s, rad(db, id), { del: 'fore_utflyttning', bekraftade: ALLA('fore_utflyttning') }, vid(slut + 2));
  op.registrera(s, rad(db, id), { handelse: 'ut_sal' }, vid(ut));
}

describe('Operation 1.1, anestesi och material', () => {
  test('anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten', () => {
    const db = sandlada();
    ny(db, 'op1', 'kkoga-ort', { kon: 'K' }); ny(db, 'op2');
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('op1', 'kkoga-ort', 'I50.9', 'Hjärtsvikt, ospecificerad', 'bi', '2025-01-01')").run();
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    const l = atk(db, 'lak-kkoga', 'op1', 'anestesibedomning');
    const f = iva.anestesiForslag(l, pat(db, 'op1'), { anmalanId: a.id }, BAS);
    expect(f.ingrepp).toBe('Primär total höftledsplastik med cement');
    expect(f.planerad).toBe(lokalTid(MORGON, '07:30'));
    expect(f.skalor.rcri).toMatchObject({ poang: 1 });
    expect(f.skalor.rcri.grund).toContain('Hjärtsvikt');
    expect(() => iva.sparaAnestesi(l, pat(db, 'op1'), { anmalanId: a.id, asa: 2, anestesiform: 'regional' }, BAS)).toThrow('samtycke');
    expect(() => iva.sparaAnestesi(atk(db, 'lak-kkoga', 'op2', 'anestesibedomning'), pat(db, 'op2'), { anmalanId: a.id, asa: 2, anestesiform: 'regional', samtycke: 'ja' }, BAS)).toThrow('Uppgiften finns inte');
    // Säkerhetsgranskningen: en läkare på en annan vårdenhet, med vårdrelation och aktivt val, kopplar ingen bedömning till
    // anmälan och ändrar inte ASA-klassen.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op1', 'uso-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(() => iva.sparaAnestesi(atk(db, 'lak-ort', 'op1', 'anestesibedomning', { andra_enheter: true }), pat(db, 'op1'), { anmalanId: a.id, asa: 5, anestesiform: 'generell', samtycke: 'ja' }, efter(4))).toThrow('anmälande vårdenheten');
    expect(rad(db, a.id).asa).toBe(null);
    expect(db.query("SELECT count(*) AS n FROM op_historik WHERE anmalan_id = ? AND handelse = 'anestesibedomning'").get(a.id).n).toBe(0);
    const r = iva.sparaAnestesi(l, pat(db, 'op1'), { anmalanId: a.id, asa: 3, anestesiform: 'regional', samtycke: 'ja', ponvTidigare: true }, efter(5));
    expect(r.bedomning).toMatchObject({ anmalanId: a.id, ingrepp: 'Primär total höftledsplastik med cement', samtycke: 'ja', giltigTill: '2027-11-09' });
    // Apfel: kvinna, icke-rökare, tidigare illamående och opioider efter operationen.
    expect(r.bedomning.skalor.apfel).toMatchObject({ poang: 4 });
    expect(r.bedomning.patientinformation).toContain('Inför din operation');
    expect(r.bedomning.patientinformation).toContain('Ät inte efter klockan');
    const u = op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(6));
    expect(u.forberedelser.punkter.find(p => p.id === 'anestesi')).toMatchObject({ klar: true });
    expect(u.forberedelser.punkter.find(p => p.id === 'anestesi').text).toContain('giltig till 2027-11-09');
    expect(op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(400 * 24 * 60)).forberedelser.punkter.find(p => p.id === 'anestesi')).toMatchObject({ klar: false });
    expect(op.checklistaUnderlag(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(10)).delar[0].punkter.find(p => p.id === 'samtycke').forifylld).toBe(true);
  });

  test('anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser', () => {
    const db = sandlada();
    ny(db); vikt(db, 'op1', 70);
    db.query("INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum) VALUES ('op1', 'kkoga-ort', 'Penicillin', 'J01C', 'Urtikaria', 'mattlig', ?)").run(datumAv(BAS));
    const fall = paSal(db, 'op1', { kva: 'NFB49', sida: 'hoger', anestesi: 'generell' });
    const { id, s, vid } = fall;
    const L = () => atk(db, 'ssk-kkoga', 'op1', 'las_operation');
    const j = aj.journalFor(L(), rad(db, id), vid(30));
    expect(j.varden.length).toBe(7);
    expect(j.varden[0]).toMatchObject({ tid: vid(0).toISOString(), kalla: 'Anestesimonitor (simulerad)' });
    expect(j.forslag.profylax).toMatchObject({ lakemedel: 'klindamycin', dos: 600, given: false });
    expect(j.forslag.lakemedel.find(l => l.kod === 'propofol')).toMatchObject({ dos: 140, enhet: 'mg' });
    expect(() => aj.registreraLakemedel(s, rad(db, id), { lakemedel: 'kloxacillin', dos: 2 }, vid(31))).toThrow('överkänslig mot Penicillin');
    expect(() => aj.registreraLakemedel(s, rad(db, id), { lakemedel: 'propofol', dos: 900 }, vid(31))).toThrow('högst 300');
    aj.registreraLakemedel(s, rad(db, id), { lakemedel: 'klindamycin' }, vid(32));
    aj.registreraLakemedel(s, rad(db, id), { lakemedel: 'propofol' }, vid(33));
    aj.registreraVatska(s, rad(db, id), { slag: 'ringer', volym: 500 }, vid(34));
    aj.registreraVatska(s, rad(db, id), { slag: 'blodning', volym: 300 }, vid(40));
    expect(() => aj.registreraHandelse(s, rad(db, id), { handelse: 'komplikation' }, vid(41))).toThrow('Beskriv');
    aj.registreraHandelse(s, rad(db, id), { handelse: 'intubation' }, vid(35));
    const j2 = aj.journalFor(L(), rad(db, id), vid(45));
    expect(j2.lakemedel.map(l => [l.namn, l.dos, l.enhet])).toEqual([['Klindamycin', 600, 'mg'], ['Propofol', 140, 'mg']]);
    expect(j2.vatskor).toMatchObject({ in: 500, ut: 300, balans: 200 });
    expect(j2.handelser.map(h => h.namn)).toEqual(['Intubation']);
    expect(j2.forslag.profylax.given).toBe(true);
    expect(op.checklistaUnderlag(L(), rad(db, id), vid(46)).delar[1].punkter.find(p => p.id === 'antibiotika').forifylld).toBe(true);
    // Efter att patienten har lämnat salen skickar monitorn inget mer och inget kan registreras.
    genomfor(db, fall);
    expect(aj.journalFor(L(), rad(db, id), vid(200)).varden.length).toBe(22);
    expect(() => aj.registreraVatska(s, rad(db, id), { slag: 'urin', volym: 100 }, vid(201))).toThrow('under operationen');
  });

  test('sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    const L = () => atk(db, 'ssk-kkoga', 'op1', 'las_operation');
    const g0 = sg.sterilgods(L(), rad(db, a.id), BAS);
    expect(g0.galler).toHaveLength(1);
    expect(g0.galler[0]).toMatchObject({ resurs: 'hoft-galler', galler: 'KKOGA-HOFT-1', instrument: 64, status: 'reserverad' });
    expect(g0.galler[0].charge).toMatch(/^CH-\d{8}-\d+$/);
    expect(g0.galler[0].utgang > MORGON).toBe(true);
    expect(() => sg.oppna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-1' }, BAS)).toThrow('kommit in på salen');
    const t0 = Date.parse(lokalTid(MORGON, '07:30'));
    const vid = (m) => new Date(t0 + m * 60_000);
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0));
    expect(() => sg.oppna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-2' }, vid(1))).toThrow('reserverat');
    sg.oppna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-1' }, vid(2));
    expect(() => sg.rakna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-1', instrument: 63, kompresserOchNalar: true }, vid(3))).toThrow('stämmer inte');
    expect(() => sg.rakna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-1', instrument: 64 }, vid(3))).toThrow('kompresser');
    expect(() => genomfor(db, { id: a.id, s, vid })).toThrow('Räkna instrumenten');
    expect(sg.rakna(s, rad(db, a.id), { galler: 'KKOGA-HOFT-1', instrument: 64, kompresserOchNalar: true }, vid(102)).galler[0].status).toBe('raknad');
    expect(op.checklistaUnderlag(L(), rad(db, a.id), vid(103)).delar[2].punkter.find(p => p.id === 'rakning').forifylld).toBe(true);
    op.checklista(s, rad(db, a.id), { del: 'fore_utflyttning', bekraftade: ALLA('fore_utflyttning') }, vid(104));
    op.registrera(s, rad(db, a.id), { handelse: 'ut_sal' }, vid(105));
    expect(sg.sterilgods(L(), rad(db, a.id), vid(106)).galler[0]).toMatchObject({ status: 'retur' });
  });

  test('materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt', () => {
    const db = sandlada();
    ny(db);
    const { id, s, vid } = paSal(db);
    const p = sg.plocklista(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, id), vid(1));
    expect(p.rader.map(r => r.artikel)).toContain('OP-0005');
    expect(p.rader.find(r => r.implantat)).toMatchObject({ artikel: 'OP-0101', tillverkare: 'Demotillverkaren' });
    expect(() => sg.forbruka(s, rad(db, id), {}, vid(2))).toThrow('lot');
    const fore = sg.forrad(db, pers(db, 'ssk-kkoga'), vid(2)).artiklar.find(x => x.artikel === 'OP-0005').saldo;
    const lotter = Object.fromEntries(p.rader.filter(r => r.implantat).map((r, i) => [r.artikel, `LOT-DEMO-${i + 1}`]));
    const f = sg.forbruka(s, rad(db, id), { lotter }, vid(3));
    expect(f.forbrukning.find(x => x.artikel === 'OP-0101').lot).toBe('LOT-DEMO-1');
    expect(op.anmalanUt(s, rad(db, id), vid(4)).forlopp.implantat.map(i => i.lot)).toEqual(Object.values(lotter));
    const fr = sg.forrad(db, pers(db, 'ssk-kkoga'), vid(4));
    expect(fr.artiklar.find(x => x.artikel === 'OP-0005').saldo).toBe(fore - p.rader.find(r => r.artikel === 'OP-0005').antal);
    // Bencementet går under beställningspunkten, och systemet beställer en gång till det simulerade förrådet.
    expect(fr.bestallningar.filter(b => b.artikel === 'OP-0005' && !b.levererad)).toHaveLength(1);
    expect(() => sg.forbruka(s, rad(db, id), { lotter }, vid(5))).toThrow('redan registrerad');
    const leverans = sg.forrad(db, pers(db, 'ssk-kkoga'), vid(25 * 60));
    expect(leverans.bestallningar.find(b => b.artikel === 'OP-0005').levererad).toBeTruthy();
    expect(leverans.artiklar.find(x => x.artikel === 'OP-0005').saldo).toBeGreaterThan(fr.artiklar.find(x => x.artikel === 'OP-0005').saldo);
    expect(JSON.stringify(leverans)).not.toContain('op1');
  });

  test('uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen', () => {
    const db = sandlada();
    ny(db); vikt(db, 'op1', 70);
    const fall = paSal(db);
    const { id, s, vid } = fall;
    aj.registreraLakemedel(s, rad(db, id), { lakemedel: 'kloxacillin' }, vid(2));
    aj.registreraVatska(s, rad(db, id), { slag: 'ringer', volym: 1000 }, vid(3));
    aj.registreraVatska(s, rad(db, id), { slag: 'blodning', volym: 400 }, vid(4));
    genomfor(db, fall, { slut: 140, ut: 145 });
    const lista = op.uppvakningslista(db, pers(db, 'ssk-kkoga'), () => ({}), vid(160));
    expect(lista.patienter).toHaveLength(1);
    expect(lista.patienter[0]).toMatchObject({ anmalanId: id, minuter: 15, kanSkrivasUt: false, patient: { id: 'op1' } });
    expect(op.uppvakningslista(db, pers(db, 'lak-ort'), () => ({}), vid(160)).patienter).toEqual([]);
    const u = op.anmalanUt(s, rad(db, id), vid(160));
    expect(u.forlopp.avvikelse).toMatchObject({ startMinuter: 0, langdMinuter: 45 });
    expect(u.forlopp.avvikelse.text).toContain('45 minuter längre');
    op.kontroll(s, rad(db, id), { varden: { medvetande: 'A', saturation: 97, andningsfrekvens: 14, puls: 76, blodtryck: '132/78', smarta: 2 } }, vid(175));
    const r = op.skrivUt(s, rad(db, id), {}, vid(180));
    expect(r.overrapport).toContain('Under operationen: Kloxacillin 2 g');
    expect(r.overrapport).toContain('vätskor in 1000 ml och ut 400 ml, balans +600 ml');
  });

  test('uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter', () => {
    const db = sandlada();
    ny(db, 'op1', 'kkoga-ort', { fornamn: 'Signe', efternamn: 'Statistiksson' }); ny(db, 'op2'); ny(db, 'op3');
    const fall = paSal(db);
    const { id, s, vid } = fall;
    genomfor(db, fall, { slut: 110, ut: 115 });
    op.kontroll(s, rad(db, id), { varden: { medvetande: 'A', saturation: 97, andningsfrekvens: 14, puls: 76, blodtryck: '132/78', smarta: 2 } }, vid(150));
    op.skrivUt(s, rad(db, id), {}, vid(160));
    anmal(db, 'op2', { kva: 'JKA21' }); anmal(db, 'op3', { kva: 'JEA01', prioritet: 'akut' });
    const u = op.uppfoljning(db, pers(db, 'lak-kkoga'), { fran: datumAv(BAS), till: addDagar(datumAv(BAS), 6) }, efter(3 * 24 * 60));
    expect(u.inflode).toMatchObject({ anmalda: 3 });
    expect(u.utrustning.find(x => x.id === 'hoft-galler')).toMatchObject({ bokningar: 1 });
    expect(u.punktlighet).toMatchObject({ forstaOperationer: 1, iTid: 1 });
    expect(u.uppvakning).toMatchObject({ antal: 1, medianMinuter: 45 });
    const text = JSON.stringify(u);
    for (const x of ['op1', 'Signe', 'Statistiksson', 'anmalanId']) expect(text).not.toContain(x);
    const { data } = datauttag.bygg(db);
    const egna = data.Operation.filter(x => x.vardenhet === 'SE2321000164-VK0310' && x.anmaldDatum === datumAv(BAS));
    expect(egna.length).toBe(3);
    const r = egna.find(x => x.kva === 'NFB49');
    expect(r).toMatchObject({ prioritet: 'inom_3_manader', status: 'klar', anestesiform: 'regional', planeradeMinuter: 130, uppvakningMinuter: 45, inomMal: true, operationsMinuter: 90 });
    expect(datauttag.kvalitet(data).Operation.godkanda).toBe(data.Operation.length);
    sparr(db, 'op2', 'kkoga-ort');
    expect(datauttag.bygg(db).data.Operation.length).toBe(data.Operation.length - 1);
    expect(JSON.stringify(datauttag.bygg(db).data.Operation)).not.toContain('op1');
  });

  test('säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    const { id } = paSal(db);
    const an = rad(db, id);
    const A = (h) => atk(db, 'ssk-kkoga', 'op2', h);
    for (const f of [() => aj.journalFor(A('las_operation'), an, BAS), () => aj.registreraLakemedel(A('operation_registrera'), an, { lakemedel: 'propofol' }, BAS),
      () => aj.registreraVatska(A('operation_registrera'), an, { slag: 'ringer', volym: 100 }, BAS), () => aj.registreraHandelse(A('operation_registrera'), an, { handelse: 'intubation' }, BAS),
      () => sg.sterilgods(A('las_operation'), an, BAS), () => sg.oppna(A('operation_registrera'), an, { galler: 'KKOGA-HOFT-1' }, BAS),
      () => sg.rakna(A('operation_registrera'), an, {}, BAS), () => sg.plocklista(A('las_operation'), an, BAS), () => sg.forbruka(A('operation_registrera'), an, {}, BAS)]) {
      try { f(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op1', 'uso-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(() => aj.registreraLakemedel(atk(db, 'lak-ort', 'op1', 'operation_registrera', { andra_enheter: true }), an, { lakemedel: 'propofol' }, BAS)).toThrow('anmälande vårdenheten');
    expect(Array.isArray(aj.journalFor(atk(db, 'lak-ort', 'op1', 'las_operation', { andra_enheter: true }), an, BAS).varden)).toBe(true);
    expect(() => aj.journalFor(atk(db, 'lak-ort', 'op1', 'las_operation'), an, BAS)).toThrow('aktivt val');
    sparr(db, 'op1', 'kkoga-ort');
    expect(() => aj.journalFor(atk(db, 'lak-ort', 'op1', 'las_operation', { andra_enheter: true }), an, BAS)).toThrow('spärrade');
    expect(() => op.uppvakningslista(db, pers(db, 'eko'), () => ({}), BAS)).toThrow();
    expect(() => sg.forrad(db, pers(db, 'eko'), BAS)).toThrow();
  });
});

// ---- Anestesienheten, giltigheten och ASA-bekräftelsen (beslut 2026-11-10) -----------------------------------------------
const asaKlar = (db, pid, id, nu, roll = 'lak-ane-kkoga') => op.bekraftaAsa(atk(db, roll, pid, 'anestesibedomning'), rad(db, id), {}, nu);

describe('Operation 1.1, anestesienheten', () => {
  // Åtkomstkontrollen räknar vårdrelationen från en anmälan mot klockan. Testerna står vid BAS, och operationen är
  // planerad dagen efter, så klockan ställs på BAS: annars har den planerade dagen passerat när sviten körs senare.
  beforeEach(() => stallKlockan(BAS));
  afterEach(() => aterstallKlockan());
  test('anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    expect(harVardrelation(db, 'op1', 'kkoga-ane')).toBe(false);
    expect(() => atk(db, 'lak-ane-kkoga', 'op1', 'las_oversikt').krav()).toThrow('vårdrelation');
    const a = anmal(db);
    expect(harVardrelation(db, 'op1', 'kkoga-ane')).toBe(true);
    expect(harVardrelation(db, 'op2', 'kkoga-ane')).toBe(false);
    expect(harVardrelation(db, 'op1', 'uso-ane')).toBe(false);
    expect(op.session(db, pers(db, 'lak-ane-kkoga'))).toMatchObject({ vardenhet: { id: 'kkoga-ane' }, anestesi: true });
    const lista = op.anestesilista(db, pers(db, 'lak-ane-kkoga'), () => ({}), BAS);
    expect(lista.anmalningar.map(x => [x.patient.id, x.ingrepp])).toEqual([['op1', 'Primär total höftledsplastik med cement']]);
    expect(op.anestesilista(db, pers(db, 'lak-ane-ort'), () => ({}), BAS).anmalningar).toEqual([]);
    // Anmälan går hela vägen till utskrivningen från uppvakningen. Sedan har anestesienheten ingen vårdrelation.
    const fall = paSal(db, 'op2');
    genomfor(db, fall);
    expect(harVardrelation(db, 'op2', 'kkoga-ane')).toBe(true);
    op.kontroll(fall.s, rad(db, fall.id), { varden: { medvetande: 'A', saturation: 97, andningsfrekvens: 14, puls: 76, blodtryck: '132/78', smarta: 2 } }, fall.vid(140));
    op.skrivUt(fall.s, rad(db, fall.id), {}, fall.vid(145));
    expect(harVardrelation(db, 'op2', 'kkoga-ane')).toBe(false);
    expect(harVardrelation(db, 'op1', 'kkoga-ane')).toBe(true);
  });

  test('anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('op1', 'kkoga-ort', 'I50.9', 'Hjärtsvikt, ospecificerad', 'bi', '2025-01-01')").run();
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    const L = (h, val = {}) => atk(db, 'lak-ane-kkoga', 'op1', h, val);
    expect(op.forPatient(L('las_operation'), BAS).operationer.map(o => o.id)).toEqual([a.id]);
    expect(op.aktivtValSyfte(db, pers(db, 'lak-ane-kkoga'), 'op1')).toBe('Anestesibedömning inför operation');
    expect(op.aktivtValSyfte(db, pers(db, 'lak-ane-kkoga'), 'op2')).toBe(null);
    expect(op.aktivtValSyfte(db, pers(db, 'lak-kkoga'), 'op1')).toBe(null);
    // Utan aktivt val ser anestesiläkaren inte den opererande enhetens diagnoser, med valet gör den det.
    expect(iva.anestesiForslag(L('anestesibedomning'), pat(db, 'op1'), { anmalanId: a.id }, BAS).diagnoser).toEqual([]);
    expect(iva.anestesiForslag(L('anestesibedomning', { andra_enheter: true }), pat(db, 'op1'), { anmalanId: a.id }, BAS).diagnoser.map(d => d.kod)).toEqual(['I50.9']);
    const r = iva.sparaAnestesi(L('anestesibedomning', { andra_enheter: true }), pat(db, 'op1'), { anmalanId: a.id, asa: 3, anestesiform: 'regional', samtycke: 'ja' }, efter(5));
    expect(r.bedomning).toMatchObject({ anmalanId: a.id, vardenhet: 'Anestesimottagningen Karlskoga lasarett' });
    expect(rad(db, a.id).asa).toBe(3);
    // Anestesisjuksköterskan för anestesijournalen, men sterilgodset hör till den opererande vårdenheten.
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    const t0 = new Date(lokalTid(MORGON, '07:30'));
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, t0);
    expect(aj.registreraLakemedel(atk(db, 'ssk-ane-kkoga', 'op1', 'operation_registrera'), rad(db, a.id), { lakemedel: 'ondansetron' }, efter(2, t0)).lakemedel).toHaveLength(1);
    expect(() => sg.oppna(atk(db, 'ssk-ane-kkoga', 'op1', 'operation_registrera'), rad(db, a.id), { galler: 'KKOGA-HOFT-1' }, efter(3, t0))).toThrow('anmälande vårdenheten');
    // Anestesienheten når inte en patient utan anmälan, och en anmälan ger ingen åtkomst till andra patienter.
    expect(() => op.forPatient(atk(db, 'lak-ane-kkoga', 'op2', 'las_operation'), BAS)).toThrow('vårdrelation');
  });

  test('giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen', () => {
    const db = sandlada();
    ny(db, 'op1'); nyPatient(db, { id: 'op3', enhet: 'kkoga-ort', ar: 2022 });
    const a = anmal(db);
    const L = (pid) => atk(db, 'lak-ane-kkoga', pid, 'anestesibedomning', { andra_enheter: true });
    expect(iva.sparaAnestesi(L('op1'), pat(db, 'op1'), { anmalanId: a.id, asa: 2, anestesiform: 'regional', samtycke: 'ja' }, BAS).bedomning.giltigTill).toBe('2027-11-09');
    const b = anmal(db, 'op3', { kva: 'JEA01' });
    expect(iva.sparaAnestesi(L('op3'), pat(db, 'op3'), { anmalanId: b.id, asa: 1, anestesiform: 'generell', samtycke: 'ja' }, BAS).bedomning.giltigTill).toBe('2027-04-09');
    expect(iva.GILTIGHET).toMatchObject({ manader: 12, barnManader: 5, barnUnderAr: 7, proverManader: 3 });
    const u0 = op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(60));
    expect(u0.forberedelser.punkter.find(p => p.id === 'anestesi')).toMatchObject({ klar: true, varningar: [] });
    // Ett nytt läkemedel, en ny diagnos och ett nytt vårdtillfälle efter bedömningen ger en varning.
    db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, status, ordinerad_av, skapad) VALUES ('op1', 'kkoga-ort', 'VK-NPL-0001', '1 tablett', 'staende', 'Förmaksflimmer', ?, ?, 'aktiv', 'lak-kkoga', ?)").run(DAG(60), DAG(1), efter(24 * 60).toISOString());
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('op1', 'kkoga-ort', 'I48.9', 'Förmaksflimmer och förmaksfladder, ospecificerat', 'bi', ?)").run(DAG(1));
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op1', 'kkoga-ort', 'slutenvard', ?, 'Avdelning', 'Fall')").run(efter(24 * 60).toISOString());
    const u1 = op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), efter(2 * 24 * 60));
    const an1 = u1.forberedelser.punkter.find(p => p.id === 'anestesi');
    expect(an1.varningar.join(' ')).toContain('Waran');
    expect(an1.varningar.join(' ')).toContain('I48.9');
    expect(an1.varningar.join(' ')).toContain('vårdtillfälle');
    expect(an1.text).toContain('ändrats sedan bedömningen');
    // Provsvar som är äldre än tre månader vid operationen räknas inte.
    op.bestallProver(atk(db, 'lak-kkoga', 'op1', 'bestalla_prov'), rad(db, a.id), efter(5));
    db.query("UPDATE labb_analyser SET status = 'besvarad', besvarad_tid = ? WHERE patient_id = 'op1'").run(efter(60).toISOString());
    const prover = (nu) => op.anmalanUt(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id), nu).forberedelser.punkter.find(p => p.id === 'prover');
    expect(prover(efter(80 * 24 * 60))).toMatchObject({ klar: true });
    expect(prover(efter(100 * 24 * 60))).toMatchObject({ klar: false });
    expect(prover(efter(100 * 24 * 60)).text).toContain('äldre än tre månader');
  });

  test('säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt', () => {
    const db = sandlada();
    ny(db, 'op1');
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    op.registrera(atk(db, 'ssk-kkoga', 'op1', 'operation_registrera'), rad(db, a.id), { handelse: 'in_sal' }, new Date(lokalTid(MORGON, '07:30')));
    sparr(db, 'op1', 'kkoga-ort');
    const L = (h, val = {}) => atk(db, 'lak-ane-kkoga', 'op1', h, val);
    const nu = efter(5, new Date(lokalTid(MORGON, '07:30')));
    const ingen = (f) => { try { f(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); } };
    expect(op.anestesilista(db, pers(db, 'lak-ane-kkoga'), () => ({}), nu).anmalningar).toEqual([]);
    const x = L('las_operation');
    expect(op.forPatient(x, nu).operationer).toEqual([]);
    expect(x.doldaSparr).toBe(true);
    expect(op.aktivtValSyfte(db, pers(db, 'lak-ane-kkoga'), 'op1')).toBe(null);
    ingen(() => aj.journalFor(L('las_operation'), rad(db, a.id), nu));
    ingen(() => aj.registreraLakemedel(atk(db, 'ssk-ane-kkoga', 'op1', 'operation_registrera'), rad(db, a.id), { lakemedel: 'ondansetron' }, nu));
    ingen(() => iva.sparaAnestesi(L('anestesibedomning', { andra_enheter: true }), pat(db, 'op1'), { anmalanId: a.id, asa: 2, anestesiform: 'regional', samtycke: 'ja' }, nu));
    ingen(() => asaKlar(db, 'op1', a.id, nu));
    // Patientens samtycke till att spärren tillfälligt hävs öppnar som vanligt.
    const s = { samtycke_sparr: true };
    expect(op.forPatient(L('las_operation', s), nu).operationer.map(o => o.id)).toEqual([a.id]);
    expect(op.anestesilista(db, pers(db, 'lak-ane-kkoga'), () => s, nu).anmalningar.map(r => r.anmalanId)).toEqual([a.id]);
    expect(Array.isArray(aj.journalFor(L('las_operation', s), rad(db, a.id), nu).varden)).toBe(true);
  });

  test('säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2'); ny(db, 'op8'); nyPatient(db, { id: 'op9', enhet: 'kkoga-ane', ar: 1960 }); nyPatient(db, { id: 'op7', enhet: 'uso-kard-72', ar: 1950 });
    expect(() => op.anmal(atk(db, 'lak-ane-kkoga', 'op9', 'operation_anmala'), { kva: 'JEA01' }, BAS)).toThrow('opererar inte');
    expect(() => op.anmal(atk(db, 'lak-kard', 'op7', 'operation_anmala'), { kva: 'JKA21' }, BAS)).toThrow('opererar inte');
    // En anmälan som en anestesienhet eller en enhet som inte opererar ändå har fått in ger ingen vårdrelation.
    for (const enhet of ['kkoga-ane', 'uso-kard']) {
      db.query("INSERT INTO op_anmalningar (patient_id, enhet_id, anmald_av, anmald_tid, kva, prioritet, mal_datum, anestesi, minuter, status) VALUES ('op8', ?, 'lak-kkoga', ?, 'JEA01', 'akut', ?, 'generell', 45, 'vantar')").run(enhet, BAS.toISOString(), datumAv(BAS));
    }
    expect(harVardrelation(db, 'op8', 'kkoga-ane')).toBe(false);
    expect(harVardrelation(db, 'op8', 'uso-ane')).toBe(false);
    // En avbokad anmälan ger ingen vårdrelation.
    const a = anmal(db, 'op1');
    expect(harVardrelation(db, 'op1', 'kkoga-ane')).toBe(true);
    expect(() => op.avboka(atk(db, 'lak-kkoga', 'op1', 'operation_anmala'), rad(db, a.id), { orsak: 'toString' }, BAS)).toThrow('orsaken');
    expect(op.avboka(atk(db, 'lak-kkoga', 'op1', 'operation_anmala'), rad(db, a.id), { orsak: 'ej_aktuell' }, efter(5)).status).toBe('avbokad');
    expect(harVardrelation(db, 'op1', 'kkoga-ane')).toBe(false);
    expect(op.vantelista(db, pers(db, 'ssk-kkoga'), () => ({}), efter(6)).vantande.map(v => v.patient.id)).not.toContain('op1');
    // En planerad operation vars dag har passerat utan operation ger ingen vårdrelation.
    const b = anmal(db, 'op2');
    op.planera(pl(db, 'op2'), rad(db, b.id), {}, BAS);
    expect(harVardrelation(db, 'op2', 'kkoga-ane', new Date(lokalTid(MORGON, '20:00')))).toBe(true);
    expect(harVardrelation(db, 'op2', 'kkoga-ane', new Date(lokalTid(DAG(2), '09:00')))).toBe(false);
  });

  test('ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    op.planera(pl(db, 'op1'), rad(db, a.id), {}, BAS);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    const t0 = new Date(lokalTid(MORGON, '07:30'));
    const vid = (m) => efter(m, t0);
    expect(() => asaKlar(db, 'op1', a.id, vid(-10))).toThrow('anestesibedömning');
    iva.sparaAnestesi(atk(db, 'lak-ane-kkoga', 'op1', 'anestesibedomning', { andra_enheter: true }), pat(db, 'op1'), { anmalanId: a.id, asa: 2, anestesiform: 'regional', samtycke: 'ja' }, BAS);
    // En bekräftelse dagen före gäller inte på operationsdagen.
    asaKlar(db, 'op1', a.id, BAS);
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0));
    op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, vid(5));
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(10))).toThrow('Bekräfta ASA-klassen');
    expect(() => asaKlar(db, 'op1', a.id, vid(8), 'ssk-kkoga')).toThrow();
    const r = asaKlar(db, 'op1', a.id, vid(8));
    expect(r.historik.at(-1)).toMatchObject({ handelse: 'asa_bekraftad', detalj: 'ASA 2', av: 'Martin Ödman' });
    expect(op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(10)).forlopp.tider.find(t => t.id === 'anestesistart').tid).toBe(vid(10).toISOString());
  });
});

// ---- API:t med operationskoordinatorn i demons sandlåda ---------------------------------------------------------------
describe('Operation 1.1, API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation', async () => {
    const k = klient(app);
    await k.logga('opk-kkoga');
    expect((await k.get('/api/session')).data.operation).toMatchObject({ vardenhet: { id: 'kkoga-ort' } });
    const db = serverSandlada(app, k).db;
    const idag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const o = (await k.get(`/api/operation/oversikt?datum=${idag}`)).data;
    expect(o.salar.find(s => s.id === 'kkoga-sal-1').operationer.map(x => x.patient?.id)).toEqual(['p71', 'p72']);
    expect((await k.get('/api/operation/block')).data.salar.length).toBe(5);
    expect((await k.get('/api/operation/uppvakning')).status).toBe(200);
    expect((await k.get('/api/operation/forrad')).data.artiklar.length).toBeGreaterThan(5);
    const p07 = db.query("SELECT id FROM op_anmalningar WHERE patient_id = 'p07'").get().id;
    expect((await k.get(`/api/operation/${p07}/anestesijournal`)).data.lakemedel.map(l => l.kod)).toContain('kloxacillin');
    expect((await k.get(`/api/operation/${p07}/sterilgods`)).data.galler[0].status).toBe('retur');
    expect((await k.get(`/api/operation/${p07}/plocklista`)).data.registrerad).toBe(true);
    expect((await k.post('/api/operation/block/okand', {})).status).toBe(404);
    expect((await k.post(`/api/operation/${p07}/anestesi-vatska`, { slag: 'urin', volym: 100 })).status).toBe(409);
    expect((await k.post('/api/operation/block/slapp', { sal: 'kkoga-sal-1', datum: '2020-01-01' })).status).toBe(400);
    // Runda 11, r2: koordinatorn är inte på anestesienheten, får inget förvalt syfte och bekräftar inte ASA-klassen.
    expect((await k.get('/api/operation/anestesi')).data.anmalningar).toEqual([]);
    expect((await k.get('/api/patient/p71')).data.aktivtValSyfte).toBe(null);
    const p71 = db.query("SELECT id FROM op_anmalningar WHERE patient_id = 'p71'").get().id;
    expect((await k.post(`/api/operation/${p71}/bekrafta-asa`, {})).status).toBe(403);
    expect((await k.get(`/api/patient/p71/operation`)).data.operationer[0]).toMatchObject({ anestesienhet: { id: 'kkoga-ane' } });
    await k.logga('usk-kard');
    expect((await k.get('/api/session')).data.operation).toBe(null);
  });
});
