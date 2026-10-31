import { describe, test, expect } from 'bun:test';
import * as lakemedel from '../src/lakemedel.js';
import { idag, addDagar, installning } from '../src/db.js';
import { nyDb, atk } from './hjalp.js';

const ord = (lm, extra = {}) => ({ lakemedelId: lm, dosering: '1 tablett dagligen', typ: 'staende', ordinationsorsak: 'Test', uppfoljningsdatum: addDagar(idag(), 30), ...extra });
const kontroll = (db, personalId, pid, lm) => lakemedel.kontroll(atk(db, personalId, pid), { lakemedelId: lm }).varningar;
const regler = (v) => v.map(x => `${x.niva}:${x.regel}`);

describe('Läkemedel', () => {
  test('ordinationsorsak är obligatorisk', () => {
    const db = nyDb();
    let fel;
    try { lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015', { ordinationsorsak: '' })); } catch (e) { fel = e; }
    expect(fel.status).toBe(400);
    expect(fel.kod).toBe('ogiltig');
    expect(fel.extra.falt).toContain('ordinationsorsak');
    expect(() => lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015', { ordinationsorsak: '   ' }))).toThrow(/Ordinationsorsak/);
  });

  test('uppföljningsdatum är obligatoriskt', () => {
    const db = nyDb();
    for (const u of [undefined, '', '2026-02-30', addDagar(idag(), -1), 'imorgon']) {
      let fel;
      try { lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015', { uppfoljningsdatum: u })); } catch (e) { fel = e; }
      expect(fel?.extra?.falt).toContain('uppfoljningsdatum');
    }
    const ok = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015'));
    expect(ok.ordination.uppfoljningsdatum).toBe(addDagar(idag(), 30));
    expect(ok.ordination.ordinationsorsak).toBe('Test');
  });

  test('databasen vägrar ordination utan orsak (CHECK)', () => {
    const db = nyDb();
    const ins = (orsak, uppf) => db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      VALUES ('p01', 'uso-kard', 'VK-NPL-0015', 'x', 'staende', ?, ?, ?, 'lak-kard', ?)`).run(orsak, uppf, idag(), new Date().toISOString());
    expect(() => ins('', addDagar(idag(), 3))).toThrow();
    expect(() => ins(null, addDagar(idag(), 3))).toThrow();
    expect(() => ins('Orsak', null)).toThrow();
    expect(() => ins('Orsak', '')).toThrow();
  });

  test('varning: överkänslighet med matchande ATC-prefix', () => {
    const db = nyDb();
    // p01 har penicillinöverkänslighet (J01C). Amoxicillin är J01CA04.
    const v = kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0034');
    expect(regler(v)).toContain('allvarlig:overkanslighet');
    expect(v.find(x => x.regel === 'overkanslighet').text).toContain('J01C');
    // Doxycyklin (J01AA) matchar inte.
    expect(regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0036'))).not.toContain('allvarlig:overkanslighet');
  });

  test('varning: dubbelordination av samma substans', () => {
    const db = nyDb();
    expect(regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0010'))).toContain('allvarlig:dubbel_substans');
  });

  test('varning: samma ATC-grupp ger observera', () => {
    const db = nyDb();
    // p01 har metoprolol (C07AB02). Bisoprolol är C07AB07.
    expect(regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0009'))).toContain('observera:dubbel_grupp');
  });

  test('varning: warfarin och NSAID', () => {
    const db = nyDb();
    expect(regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0027'))).toContain('allvarlig:warfarin_nsaid');
    expect(regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0028'))).toContain('allvarlig:warfarin_nsaid');
  });

  test('varning: två antikoagulantia', () => {
    const db = nyDb();
    const v = regler(kontroll(db, 'lak-kard', 'p01', 'VK-NPL-0002'));
    expect(v).toContain('allvarlig:dubbel_antikoagulantia');
    expect(v).not.toContain('observera:dubbel_grupp');
    expect(regler(kontroll(db, 'lak-vc', 'p10', 'VK-NPL-0004'))).toContain('allvarlig:dubbel_antikoagulantia');
  });

  test('varning: metformin vid lågt eGFR', () => {
    const db = nyDb();
    // p06 har eGFR 27 och redan metformin.
    const v = kontroll(db, 'lak-vc', 'p06', 'VK-NPL-0020');
    expect(regler(v)).toContain('allvarlig:metformin_egfr');
    expect(regler(v)).toContain('allvarlig:dubbel_substans');
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('p06', 'vc-tybble', 'egfr', '38', 38, ?)").run(new Date().toISOString());
    expect(regler(kontroll(db, 'lak-vc', 'p06', 'VK-NPL-0020'))).toContain('observera:metformin_egfr');
    // Patient utan eGFR får ingen metforminvarning.
    expect(regler(kontroll(db, 'lak-vc', 'p11', 'VK-NPL-0020'))).toEqual([]);
  });

  test('allvarlig varning måste kvitteras med motivering', () => {
    const db = nyDb();
    let fel;
    try { lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0027')); } catch (e) { fel = e; }
    expect(fel.status).toBe(400);
    expect(fel.extra.kraverKvittens).toEqual(['warfarin_nsaid']);
    expect(() => lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0027', { kvitteradeVarningar: [{ regel: 'warfarin_nsaid', motivering: '' }] }))).toThrow(/kvitteras/);
    const ok = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0027', { kvitteradeVarningar: [{ regel: 'warfarin_nsaid', motivering: 'Kort kur, INR följs' }] }));
    expect(ok.ordination.kvitteradeVarningar).toEqual([{ regel: 'warfarin_nsaid', motivering: 'Kort kur, INR följs' }]);
    expect(ok.ordination.historik.some(h => h.handelse === 'Varning kvitterad')).toBe(true);
  });

  test('varningarna är märkta som demoregler', () => {
    const db = nyDb();
    const r = lakemedel.kontroll(atk(db, 'lak-kard', 'p01'), { lakemedelId: 'VK-NPL-0034' });
    expect(r.demoregler).toBe(true);
    expect(r.anmarkning).toContain('inte kliniskt beslutsstöd');
  });

  test('NLL: normal överföring kvitteras', () => {
    const db = nyDb();
    const r = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015'));
    expect(r.nll.status).toBe('kvitterad');
    expect(r.ordination.nll_status).toBe('kvitterad');
    expect(r.ordination.nll[0]).toMatchObject({ typ: 'ny', status: 'kvitterad' });
    expect(r.ordination.nll[0].kvittens).toMatch(/^NLL-\d{6}$/);
  });

  test('NLL: timeout döljer inte ordinationen och avstämning hittar registreringen', () => {
    const db = nyDb();
    installning(db, 'nll_nasta', 'timeout');
    const r = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015'));
    expect(r.nll.status).toBe('timeout');
    expect(r.ordination.nll_status).toBe('okand_kontrolleras');
    // Ordinationen syns i listan hela tiden.
    const lista = lakemedel.lista(atk(db, 'lak-kard', 'p01')).ordinationer;
    expect(lista.find(o => o.id === r.ordination.id)).toMatchObject({ status: 'aktiv', aktuell: true, nll_status: 'okand_kontrolleras' });
    expect(lakemedel.nllAvvikelser(db, atk(db, 'lak-kard', 'p01').personal).some(a => a.ordinationId === r.ordination.id)).toBe(true);
    // Bara nästa överföring får timeout.
    expect(lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0013')).nll.status).toBe('kvitterad');
    const a = lakemedel.avstam(atk(db, 'lak-kard', 'p01'), lakemedel.hamtaRad(db, r.ordination.id));
    expect(a.resultat).toBe('fanns_registrerad');
    expect(a.ordination.nll_status).toBe('kvitterad');
    expect(a.ordination.historik.map(h => h.handelse)).toContain('Avstämning mot NLL: ordinationen finns registrerad');
    expect(() => lakemedel.avstam(atk(db, 'lak-kard', 'p01'), lakemedel.hamtaRad(db, r.ordination.id))).toThrow(/redan kvitterad/);
  });

  test('NLL: felsvar syns och avstämning skickar igen', () => {
    const db = nyDb();
    installning(db, 'nll_nasta', 'fel');
    const r = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015'));
    expect(r.nll.status).toBe('fel');
    expect(r.ordination.nll_status).toBe('fel');
    expect(lakemedel.lista(atk(db, 'lak-kard', 'p01')).ordinationer.find(o => o.id === r.ordination.id).aktuell).toBe(true);
    const a = lakemedel.avstam(atk(db, 'lak-kard', 'p01'), lakemedel.hamtaRad(db, r.ordination.id));
    expect(a.resultat).toBe('skickad_igen');
    expect(a.ordination.nll_status).toBe('kvitterad');
    expect(a.ordination.nll.map(m => m.status)).toEqual(['fel', 'kvitterad']);
  });

  test('NLL: seedad timeout väntar på avstämning', () => {
    const db = nyDb();
    const o = db.query("SELECT * FROM ordinationer WHERE nll_status = 'okand_kontrolleras'").all();
    expect(o.length).toBe(1);
    expect(o[0].patient_id).toBe('p10');
    const avv = lakemedel.nllAvvikelser(db, atk(db, 'lak-vc', 'p10').personal);
    expect(avv.map(a => a.ordinationId)).toContain(o[0].id);
  });

  test('utsättning kräver orsak och inget raderas', () => {
    const db = nyDb();
    const r = lakemedel.spara(atk(db, 'lak-kard', 'p01'), ord('VK-NPL-0015'));
    const rad = lakemedel.hamtaRad(db, r.ordination.id);
    expect(() => lakemedel.utsatt(atk(db, 'lak-kard', 'p01'), rad, { orsak: '' })).toThrow(/orsak/);
    const u = lakemedel.utsatt(atk(db, 'lak-kard', 'p01'), rad, { orsak: 'Biverkan, yrsel' });
    expect(u.ordination.status).toBe('utsatt');
    expect(u.ordination.utsatt.orsak).toBe('Biverkan, yrsel');
    expect(u.nll.status).toBe('kvitterad');
    expect(() => lakemedel.utsatt(atk(db, 'lak-kard', 'p01'), lakemedel.hamtaRad(db, rad.id), { orsak: 'Igen' })).toThrow(/redan utsatt/);
    expect(() => db.query('DELETE FROM ordinationer WHERE id = ?').run(rad.id)).toThrow(/raderas inte/);
    expect(lakemedel.lista(atk(db, 'lak-kard', 'p01')).ordinationer.some(o => o.id === rad.id && o.status === 'utsatt')).toBe(true);
  });

  test('sjuksköterska kan inte ordinera', () => {
    const db = nyDb();
    let fel;
    try { lakemedel.spara(atk(db, 'ssk-kard', 'p01'), ord('VK-NPL-0015')); } catch (e) { fel = e; }
    expect(fel.status).toBe(403);
    expect(fel.kod).toBe('nekad');
    expect(() => lakemedel.lista(atk(db, 'adm-kard', 'p01'))).toThrow();
    expect(lakemedel.lista(atk(db, 'usk-kard', 'p01')).ordinationer.length).toBeGreaterThan(0);
  });

  test('spärrade enheters ordinationer visas inte i läkemedelslistan', () => {
    const db = nyDb();
    const utan = lakemedel.lista(atk(db, 'lak-kard', 'p04'));
    expect(utan.ordinationer.some(o => o.lakemedel.substans === 'sertralin')).toBe(false);
    expect(utan.dolda.sparrade).toBe(true);
    const med = lakemedel.lista(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }));
    expect(med.ordinationer.some(o => o.lakemedel.substans === 'sertralin')).toBe(true);
  });
});
