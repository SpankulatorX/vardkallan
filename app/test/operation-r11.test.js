// Operationsplanering och anestesi, version 1.1 (runda 11, r2, Sussa 4.5.1.1 till 4.5.1.5 och 4.6.1.4): salsblock över
// flera vårdenheter och sjukhus, teamet med anestesi, utrustning och instrumentgaller, vårdhändelser som påverkar ett
// planerat ingrepp, identitetskontroll och WHO:s checklista i full omfattning. Varje test bygger en sandlåda vid en fast
// tidpunkt (måndag 2026-11-09 klockan 08.00 svensk tid) och lägger in sina egna patienter.
import { describe, test, expect } from 'bun:test';
import { datumAv, addDagar, lokalTid } from '../src/db.js';
import * as op from '../src/operation.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';

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
    const db = sandlada();
    nyPatient(db, { id: 'op7', enhet: 'uso-kard-72', ar: 1950 });
    const a = op.anmal(atk(db, 'lak-kard', 'op7', 'operation_anmala'), { kva: 'JKA21' }, BAS);
    const p = pl(db, 'op7', 'lak-kard');
    expect(op.planeringsforslag(p, rad(db, a.id), BAS)).toMatchObject({ sal: { id: 'uso-sal-1' }, start: lokalTid(MORGON, '07:30') });
    expect(() => op.planera(p, rad(db, a.id), { sal: 'uso-sal-1', start: lokalTid(DAG(3), '07:30') }, BAS)).toThrow('tilldelad Ortopediska kliniken USÖ');
    expect(op.blockFor(db, 'uso-sal-1', MORGON, BAS)).toMatchObject({ vardenhet: 'uso-ort', frislappt: true });
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
    const a = anmal(db);
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
    expect(u.paverkar.find(x => x.typ === 'antikoagulantia').niva).toBe('varning');
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
