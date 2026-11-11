// Blodprodukter (runda 9, r3, Sussa 4.4.2.12): blodgruppering och bastest via beställning och svar, beställningen till
// den simulerade blodcentralen och statuskedjan från upprättad till transfunderad eller återlämnad.
import { describe, test, expect } from 'bun:test';
import * as blod from '../src/blod.js';
import * as labb from '../src/labb.js';
import { blodgruppFor } from '../src/labb-katalog.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';

const ny = (db, id = 'bl1', extra = {}) => nyPatient(db, { id, enhet: 'kkoga-ort', ar: 1952, kon: 'M', ...extra });
const lak = (db, pid = 'bl1', h = 'bestalla_prov') => atk(db, 'lak-kkoga', pid, h);
const ssk = (db, pid = 'bl1', h = 'ge_lakemedel') => atk(db, 'ssk-kkoga', pid, h);
// Tar rören för en provbeställning och låter laboratoriet svara.
function taOchSvara(db, labbId, pid, nu) {
  const b = labb.bestallningRad(db, labbId);
  for (const p of labb.bestallningUt(db, b).prov) labb.taProv(atk(db, 'ssk-kkoga', pid, 'ta_prov'), labb.provRad(db, p.id), nu);
  labb.forfallnaSvar(db, new Date(nu.getTime() + 25 * 60_000));
}
// Dubbelkontrollen: sjuksköterskan förbereder vid sängen, läkaren kontrollerar i sin egen session och transfusionen startar.
function startaMedKontroll(db, e, pnr, nu) {
  const las = { armband: pnr, enhetsnummer: e.enhetsnummer };
  blod.forbered(ssk(db), blod.enhetRad(db, e.id), las, nu);
  blod.kontrollera(lak(db, 'bl1', 'ge_lakemedel'), blod.enhetRad(db, e.id), las, new Date(nu.getTime() + 60_000));
  return blod.starta(ssk(db), blod.enhetRad(db, e.id), new Date(nu.getTime() + 120_000));
}
function berett(db, pid = 'bl1', body = { produkt: 'erytrocyter', antal: 2, indikation: 'Postoperativ anemi, Hb 72' }, demo = null) {
  const b = blod.bestall(lak(db, pid), body, BAS);
  const labbId = blod.bestallningRad(db, b.id).labb_bestallning_id;
  if (demo) db.query('UPDATE labb_bestallningar SET demo = ? WHERE id = ?').run(JSON.stringify(demo), labbId);
  taOchSvara(db, labbId, pid, efter(10));
  return blod.forPatient(lak(db, pid, 'las_prover'), efter(40)).bestallningar.find(x => x.id === b.id);
}

describe('Blodprodukter', () => {
  test('blodgruppering och bastest beställs till blodcentralen som prover och besvaras med blodgrupp och antikroppsscreening', () => {
    const db = sandlada();
    ny(db);
    const r = labb.bestall(lak(db), { analyser: ['blodgruppering', 'bastest'] }, BAS);
    expect(r.bestallning.labb.map(l => l.kort)).toEqual(['Blodcentralen']);
    taOchSvara(db, r.bestallning.id, 'bl1', efter(5));
    const svar = db.query("SELECT analys, svar_text FROM labb_analyser WHERE patient_id = 'bl1' ORDER BY analys").all();
    const g = blodgruppFor('bl1');
    expect(svar).toEqual([
      { analys: 'bastest', svar_text: 'Antikroppsscreening negativ.' },
      { analys: 'blodgruppering', svar_text: `Blodgrupp ${g.replace(/[+-]$/, '')} RhD ${g.endsWith('+') ? 'positiv' : 'negativ'}.` },
    ]);
    expect(blod.transfusionsprover(lak(db, 'bl1', 'las_prover'), efter(40))).toMatchObject({ blodgrupp: g, bastest: { positivt: false } });
    // Bastestet gäller i tre dygn.
    expect(blod.transfusionsprover(lak(db, 'bl1', 'las_prover'), efter(4 * 24 * 60)).bastest).toBe(null);
  });

  test('beställningen av blod beställer själv blodgruppering och bastest som saknas och väntar på svaren innan blodcentralen bereder', () => {
    const db = sandlada();
    ny(db);
    const f = blod.forslag(lak(db, 'bl1', 'las_prover'), {}, BAS);
    expect(f.saknas).toEqual(['blodgruppering', 'bastest']);
    expect(f.text).toBe('B-Blodgruppering (AB0 och RhD) och B-Bastest (antikroppsscreening) saknas. Systemet beställer det med blodet.');
    expect(() => blod.bestall(lak(db), { produkt: 'erytrocyter' }, BAS)).toThrow('indikationen');
    expect(() => blod.bestall(lak(db), { produkt: '__proto__', indikation: 'x' }, BAS)).toThrow('Välj produkt');
    const b = blod.bestall(lak(db), { produkt: 'erytrocyter', antal: 2, indikation: 'Postoperativ anemi' }, BAS);
    expect(b).toMatchObject({ status: 'vantar_prov', antal: 2, enheter: [] });
    expect(b.historik[0].detalj).toContain('B-Blodgruppering (AB0 och RhD) och B-Bastest (antikroppsscreening) beställt');
    expect(() => blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(5))).toThrow('Blodcentralen väntar på blodgruppering och bastest');
    // En ny beställning när blodgruppen och bastestet finns beställer inga prover.
    taOchSvara(db, blod.bestallningRad(db, b.id).labb_bestallning_id, 'bl1', efter(10));
    expect(blod.forslag(lak(db, 'bl1', 'las_prover'), {}, efter(40))).toMatchObject({ saknas: [], blodgrupp: blodgruppFor('bl1') });
    const b2 = blod.bestall(lak(db), { produkt: 'plasma', antal: 1, indikation: 'Blödning' }, efter(41));
    expect(b2).toMatchObject({ status: 'beredd' });
    expect(blod.bestallningRad(db, b2.id).labb_bestallning_id).toBe(null);
  });

  test('blodcentralen förenlighetsprövar och bereder enheter med patientens blodgrupp, och beställningen kan följas från upprättad till avslutad', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    const g = blodgruppFor('bl1');
    expect(b).toMatchObject({ status: 'beredd', statusText: 'Förenlighetsprövad och beredd' });
    expect(b.enheter.map(e => [e.blodgrupp, e.status])).toEqual([[g, 'reserverad'], [g, 'reserverad']]);
    expect(b.enheter[0].enhetsnummer).toMatch(/^DEMO\d{8}$/);
    const u = blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(50));
    expect(u.enheter.every(e => e.status === 'utlamnad' && e.startaSenast === efter(80).toISOString())).toBe(true);
    const p = db.query("SELECT personnummer FROM patienter WHERE id = 'bl1'").get().personnummer;
    const [e1, e2] = u.enheter;
    startaMedKontroll(db, e1, p, efter(55));
    blod.avsluta(ssk(db), blod.enhetRad(db, e1.id), {}, efter(115));
    const slut = blod.aterlamna(ssk(db), blod.enhetRad(db, e2.id), { orsak: 'Hb stigit, en enhet räckte' }, efter(116));
    expect(slut.status).toBe('avslutad');
    expect(slut.enheter.map(e => e.status)).toEqual(['transfunderad', 'aterlamnad']);
    expect(slut.enheter[0]).toMatchObject({ givenAv: 'Tove Ahlström', kontrolleradAv: 'Ingrid Moberg', reaktion: null });
    expect(slut.historik.map(h => h.handelse)).toEqual(['upprattad', 'beredd', 'utlamnad', 'forberedd', 'kontrollerad', 'start', 'transfunderad', 'aterlamnad', 'avslutad']);
    expect(slut.historik.find(h => h.handelse === 'beredd').av).toBe('Blodcentralen USÖ (simulerad)');
  });

  test('vid sängen kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och den andra personen, och blod som inte startats inom 30 minuter återlämnas', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db, 'bl1', undefined, { blodgrupp: 'A-' });
    expect(b.enheter[0].blodgrupp).toBe('A-');
    const u = blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(50));
    const p = db.query("SELECT personnummer FROM patienter WHERE id = 'bl1'").get().personnummer;
    const e = blod.enhetRad(db, u.enheter[0].id);
    const kontroll = { armband: p, enhetsnummer: e.enhetsnummer };
    expect(() => blod.forbered(ssk(db), e, { ...kontroll, armband: '191212121212' }, efter(52))).toThrow('Id-bandet hör inte till patienten');
    expect(() => blod.forbered(ssk(db), e, { ...kontroll, enhetsnummer: 'DEMO00000999' }, efter(52))).toThrow('Enhetsnumret på påsen stämmer inte');
    // En enhet med en oförenlig blodgrupp stoppas: RhD-positivt blod till en RhD-negativ patient.
    db.query("UPDATE blod_enheter SET blodgrupp = 'A+' WHERE id = ?").run(e.id);
    expect(() => blod.forbered(ssk(db), blod.enhetRad(db, e.id), kontroll, efter(52))).toThrow('Enhetens blodgrupp A+ är inte förenlig med patientens blodgrupp A-');
    db.query("UPDATE blod_enheter SET blodgrupp = 'O-' WHERE id = ?").run(e.id);
    expect(startaMedKontroll(db, blod.enhetRad(db, e.id), p, efter(53)).enheter[0].status).toBe('pagar');
    const e2 = blod.enhetRad(db, u.enheter[1].id);
    expect(() => blod.forbered(ssk(db), e2, { ...kontroll, enhetsnummer: e2.enhetsnummer }, efter(81))).toThrow('mer än 30 minuter');
    expect(blod.aterlamna(ssk(db), e2, {}, efter(82)).enheter[1]).toMatchObject({ status: 'aterlamnad', aterlamnad: { orsak: 'Inte startad inom 30 minuter' } });
  });

  test('dubbelkontrollen vid sängen: den andra personen bekräftar i sin egen session, den som förberedde kan inte kontrollera själv och ett id i anropet räcker inte', () => {
    const db = sandlada();
    ny(db);
    const b = berett(db);
    const u = blod.utlamna(ssk(db), blod.bestallningRad(db, b.id), efter(50));
    const p = db.query("SELECT personnummer FROM patienter WHERE id = 'bl1'").get().personnummer;
    const e = () => blod.enhetRad(db, u.enheter[0].id);
    const las = { armband: p, enhetsnummer: e().enhetsnummer };
    expect(() => blod.starta(ssk(db), e(), efter(51), { kontrollant: 'lak-kkoga' })).toThrow('inte dubbelkontrollerad');
    const f = blod.forbered(ssk(db), e(), las, efter(51));
    expect(f.kontroll).toMatchObject({ forberedd: 'Tove Ahlström', kandidater: expect.arrayContaining([{ id: 'lak-kkoga', namn: 'Ingrid Moberg' }]) });
    expect(() => blod.kontrollera(ssk(db), e(), las, efter(52))).toThrow('Den som förberedde transfusionen kan inte kontrollera den själv');
    expect(blod.vantandeKontroller(db, pers(db, 'lak-kkoga'), () => ({})).kontroller.map(k => k.enhetsnummer)).toEqual([las.enhetsnummer]);
    expect(blod.vantandeKontroller(db, pers(db, 'ssk-kkoga'), () => ({})).kontroller).toEqual([]);
    expect(() => blod.starta(ssk(db), e(), efter(52))).toThrow('inte dubbelkontrollerad');
    blod.kontrollera(lak(db, 'bl1', 'ge_lakemedel'), e(), las, efter(53));
    expect(() => blod.starta(atk(db, 'lak-kkoga', 'bl1', 'ge_lakemedel'), e(), efter(54)).enheter[0].status).not.toThrow();
  });

  test('säkerhet: en blodbeställning eller enhet för en annan patient ger 404 för varje åtgärd', () => {
    const db = sandlada();
    ny(db); ny(db, 'bl2');
    const b = berett(db);
    const best = blod.bestallningRad(db, b.id), e = blod.enhetRad(db, b.enheter[0].id);
    const A = (h) => atk(db, 'ssk-kkoga', 'bl2', h);
    for (const f of [() => blod.utlamna(A('ge_lakemedel'), best, BAS), () => blod.forbered(A('ge_lakemedel'), e, {}, BAS), () => blod.kontrollera(A('ge_lakemedel'), e, {}, BAS),
      () => blod.starta(A('ge_lakemedel'), e, BAS), () => blod.avsluta(A('ge_lakemedel'), e, {}, BAS), () => blod.aterlamna(A('ge_lakemedel'), e, { orsak: 'x' }, BAS)]) {
      try { f(); throw new Error('ingen 404'); } catch (x) { expect([x.status, x.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
  });

  test('förenligheten: erytrocyter efter AB0 och RhD, plasma åt andra hållet och trombocyter AB0-lika', () => {
    expect(blod.forenlig('erytrocyter', 'O-', 'AB+')).toBe(true);
    expect(blod.forenlig('erytrocyter', 'A+', 'O+')).toBe(false);
    expect(blod.forenlig('erytrocyter', 'A+', 'A-')).toBe(false);
    expect(blod.forenlig('erytrocyter', 'B-', 'AB+')).toBe(true);
    expect(blod.forenlig('plasma', 'AB+', 'O+')).toBe(true);
    expect(blod.forenlig('plasma', 'O+', 'A+')).toBe(false);
    expect(blod.forenlig('trombocyter', 'A+', 'A-')).toBe(true);
    expect(blod.forenlig('trombocyter', 'B+', 'A+')).toBe(false);
  });

  test('ett positivt bastest stoppar beställningen hos blodcentralen med en förklaring', () => {
    const db = sandlada();
    ny(db);
    const b = blod.bestall(lak(db), { produkt: 'erytrocyter', antal: 1, indikation: 'Anemi' }, BAS);
    const labbId = blod.bestallningRad(db, b.id).labb_bestallning_id;
    db.query('UPDATE labb_bestallningar SET demo = ? WHERE id = ?').run(JSON.stringify({ bastest: 'positiv' }), labbId);
    taOchSvara(db, labbId, 'bl1', efter(10));
    const r = blod.forPatient(lak(db, 'bl1', 'las_prover'), efter(40)).bestallningar[0];
    expect(r.status).toBe('utreds');
    expect(r.historik.at(-1).detalj).toContain('Bastestet är positivt');
    expect(r.enheter).toEqual([]);
  });

  test('behörighet: sjuksköterskan beställer inte blod, en annan vårdenhet hanterar inte blodet och en spärrad beställning syns inte', () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bl1', 'uso-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(() => blod.bestall(ssk(db, 'bl1', 'bestalla_prov'), { indikation: 'Anemi' }, BAS)).toThrow('Yrkesrollen får inte beställa prover');
    const b = berett(db);
    expect(() => blod.utlamna(atk(db, 'lak-ort', 'bl1', 'ge_lakemedel'), blod.bestallningRad(db, b.id), efter(50))).toThrow('aktivt val');
    expect(() => blod.utlamna(atk(db, 'lak-ort', 'bl1', 'ge_lakemedel', { andra_enheter: true }), blod.bestallningRad(db, b.id), efter(50))).toThrow('beställande vårdenheten');
    const las = (val) => blod.forPatient(atk(db, 'lak-ort', 'bl1', 'las_prover', val), efter(50));
    expect(las({ andra_enheter: true }).bestallningar.length).toBe(1);
    const utan = JSON.stringify(las({}));
    sparr(db, 'bl1', 'kkoga-ort');
    const r = las({ andra_enheter: true });
    expect(r.bestallningar).toEqual([]);
    expect(JSON.stringify(r)).toBe(utan);
  });
});
