import { describe, test, expect } from 'bun:test';
import { prova, harVardrelation, vardenhetFor, maskeraPnr, visningsnamn, visningsPnr } from '../src/atkomst.js';
import { nyDb, personal } from './hjalp.js';

const db = nyDb();
const P = (id) => personal(db, id);
const fraga = (personalId, patient, handling, resurs = null, val = {}) => prova(db, { personal: P(personalId), patient, handling, resurs, val });

describe('Behörighetsmotorn', () => {
  test('yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte', () => {
    expect(fraga('lak-kard', 'p01', 'ordinera').tillaten).toBe(true);
    const ssk = fraga('ssk-kard', 'p01', 'ordinera');
    expect(ssk.tillaten).toBe(false);
    expect(ssk.krav).toBeNull();
    expect(fraga('usk-kard', 'p01', 'ordinera').tillaten).toBe(false);
    expect(fraga('ssk-kard', 'p01', 'skriv_omvardnad').tillaten).toBe(true);
    expect(fraga('ssk-kard', 'p01', 'skriv_journal').tillaten).toBe(false);
    expect(fraga('usk-kard', 'p01', 'registrera_matvarde').tillaten).toBe(true);
  });

  test('yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar', () => {
    expect(fraga('usk-kard', 'p01', 'las_omvardnad', { enhet_id: 'uso-kard-72' }).tillaten).toBe(true);
    expect(fraga('usk-kard', 'p01', 'las_journal', { enhet_id: 'uso-kard-72' }).tillaten).toBe(false);
    expect(fraga('usk-kard', 'p01', 'las_lakemedel').tillaten).toBe(true);
    expect(fraga('usk-kard', 'p01', 'las_matvarden').tillaten).toBe(true);
    expect(fraga('usk-kard', 'p01', 'las_diagnoser').tillaten).toBe(false);
  });

  test('yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel', () => {
    const r = fraga('adm-kard', 'p01', 'las_admin');
    expect(r.tillaten).toBe(true);
    expect(r.grund).toBe('administrativ');
    for (const h of ['las_journal', 'las_omvardnad', 'las_lakemedel', 'las_oversikt', 'las_diagnoser', 'nodatkomst']) expect(fraga('adm-kard', 'p01', h).tillaten).toBe(false);
    expect(fraga('adm-kard', 'p05', 'mottag_remiss').tillaten).toBe(true);
  });

  test('yrkesroll: logggranskare får läsa loggen men inte journalen', () => {
    const r = fraga('logg', 'p01', 'las_logg');
    expect(r.tillaten).toBe(true);
    expect(r.grund).toBe('logggranskning');
    expect(fraga('logg', 'p01', 'las_journal').tillaten).toBe(false);
    expect(fraga('logg', 'p01', 'las_oversikt').tillaten).toBe(false);
  });

  test('vårdrelation: inskriven patient ger åtkomst på egen enhet', () => {
    const r = fraga('lak-kard', 'p01', 'las_journal', { enhet_id: 'uso-kard-72' });
    expect(r).toMatchObject({ tillaten: true, grund: 'egen_enhet' });
    expect(fraga('lak-kard', 'p01', 'las_oversikt')).toMatchObject({ tillaten: true, grund: 'vardrelation' });
  });

  test('vårdrelation: listning och remiss till enheten ger vårdrelation', () => {
    expect(harVardrelation(db, 'p06', 'vc-tybble')).toBe(true);
    expect(harVardrelation(db, 'p05', 'uso-kard')).toBe(true);
    expect(harVardrelation(db, 'p05', 'vc-tybble')).toBe(false);
  });

  test('vårdrelation: kontakt avslutad för mer än 90 dagar sedan ger ingen vårdrelation', () => {
    // p02 var på akuten för 700 dagar sedan.
    expect(harVardrelation(db, 'p02', 'uso-akut')).toBe(false);
    // p08 var på akuten för 5 dagar sedan.
    expect(harVardrelation(db, 'p08', 'uso-akut')).toBe(true);
    const om100 = new Date(Date.now() + 100 * 86400_000);
    expect(harVardrelation(db, 'p08', 'uso-akut', om100)).toBe(false);
  });

  test('vårdrelation: avvisad remiss ger ingen vårdrelation', () => {
    const d = nyDb();
    const id = d.query("SELECT id FROM remisser WHERE patient_id = 'p06' AND till_enhet_id = 'uso-kard'").get().id;
    expect(d.query('SELECT beslut FROM remisser WHERE id = ?').get(id).beslut).toBe('avvisad');
    expect(harVardrelation(d, 'p06', 'uso-kard')).toBe(false);
    d.query("UPDATE remisser SET beslut = 'accepterad' WHERE id = ?").run(id);
    expect(harVardrelation(d, 'p06', 'uso-kard')).toBe(true);
  });

  test('inre sekretess: andra enheters uppgifter kräver aktivt val', () => {
    const r = fraga('lak-kard', 'p01', 'las_journal', { enhet_id: 'uso-akut' });
    expect(r).toMatchObject({ tillaten: false, grund: 'nekad', krav: 'kraver_val' });
    expect(fraga('lak-vc', 'p07', 'las_omvardnad', { enhet_id: 'kkoga-ort' }).krav).toBe('kraver_val');
  });

  test('inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val', () => {
    const r = fraga('lak-kard', 'p01', 'las_journal', { enhet_id: 'uso-akut' }, { andra_enheter: true });
    expect(r).toMatchObject({ tillaten: true, grund: 'aktivt_val' });
  });

  test('inre sekretess: arbetsplats räknas till sin vårdenhet', () => {
    expect(vardenhetFor(db, 'uso-kard-72')).toBe('uso-kard');
    expect(vardenhetFor(db, 'uso-kard-mott')).toBe('uso-kard');
    // Sjuksköterskan på avdelning 72 ser mottagningens anteckning utan aktivt val.
    expect(fraga('ssk-kard', 'p01', 'las_journal', { enhet_id: 'uso-kard-mott' })).toMatchObject({ tillaten: true, grund: 'egen_enhet' });
  });

  test('spärr: spärrmarkering syns men innehållet döljs', () => {
    const huvud = fraga('lak-kard', 'p04', 'las_oversikt');
    expect(huvud.tillaten).toBe(true);
    expect(huvud.spärrade).toBe(true);
    const r = fraga('lak-kard', 'p04', 'las_journal', { enhet_id: 'uso-psyk' });
    expect(r).toMatchObject({ tillaten: false, krav: 'kraver_samtycke', spärrade: true });
    expect(r.skal).not.toContain('psykiatri');
  });

  test('spärr: aktivt val häver inte spärren', () => {
    const r = fraga('lak-kard', 'p04', 'las_journal', { enhet_id: 'uso-psyk' }, { andra_enheter: true });
    expect(r.tillaten).toBe(false);
    expect(r.krav).toBe('kraver_samtycke');
    // Inte heller för den gemensamma läkemedelslistan.
    expect(fraga('lak-kard', 'p04', 'las_lakemedel', { enhet_id: 'uso-psyk', gemensam: true }, { andra_enheter: true }).tillaten).toBe(false);
  });

  test('spärr: samtycke i stunden visar spärrade uppgifter', () => {
    const r = fraga('lak-kard', 'p04', 'las_journal', { enhet_id: 'uso-psyk' }, { samtycke_sparr: true });
    expect(r).toMatchObject({ tillaten: true, grund: 'samtycke_sparr', spärrade: false });
    expect(fraga('lak-kard', 'p04', 'las_oversikt', null, { samtycke_sparr: true }).spärrade).toBe(false);
  });

  test('spärr: den spärrade enheten ser sina egna uppgifter', () => {
    const r = fraga('lak-psyk', 'p04', 'las_journal', { enhet_id: 'uso-psyk' });
    expect(r).toMatchObject({ tillaten: true, grund: 'egen_enhet', spärrade: false });
  });

  test('nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst', () => {
    const utan = fraga('lak-akut', 'p02', 'las_oversikt');
    expect(utan).toMatchObject({ tillaten: false, grund: 'nekad', krav: 'kraver_val' });
    const med = fraga('lak-akut', 'p02', 'las_journal', { enhet_id: 'lind-med' }, { nodatkomst: true });
    expect(med).toMatchObject({ tillaten: true, grund: 'nodatkomst' });
    expect(fraga('lak-akut', 'p02', 'las_journal', { enhet_id: 'uso-akut' }, { nodatkomst: true }).grund).toBe('nodatkomst');
    expect(fraga('ssk-kard', 'p12', 'las_oversikt', null, { nodatkomst: true }).tillaten).toBe(true);
  });

  test('nödåtkomst: häver aldrig en spärr', () => {
    const d = nyDb();
    // Spärrad patient utan vårdrelation till akuten: nödåtkomst ger journalen men aldrig de spärrade uppgifterna.
    d.query("DELETE FROM vardkontakter WHERE patient_id = 'p04' AND enhet_id = 'uso-akut'").run();
    const lak = personal(d, 'lak-akut');
    expect(prova(d, { personal: lak, patient: 'p04', handling: 'las_oversikt' }).krav).toBe('kraver_val');
    const r = prova(d, { personal: lak, patient: 'p04', handling: 'las_journal', resurs: { enhet_id: 'uso-psyk' }, val: { nodatkomst: true } });
    expect(r).toMatchObject({ tillaten: false, krav: 'kraver_samtycke', spärrade: true });
    const kard = prova(d, { personal: lak, patient: 'p04', handling: 'las_journal', resurs: { enhet_id: 'uso-kard-72' }, val: { nodatkomst: true, andra_enheter: true } });
    expect(kard).toMatchObject({ tillaten: true, grund: 'nodatkomst' });
  });

  test('nödåtkomst: undersköterska och vårdadministratör kan inte använda nödåtkomst', () => {
    const usk = fraga('usk-kard', 'p12', 'las_oversikt', null, { nodatkomst: true });
    expect(usk).toMatchObject({ tillaten: false, krav: null });
    const adm = fraga('adm-kard', 'p12', 'las_admin', null, { nodatkomst: true });
    expect(adm).toMatchObject({ tillaten: false, krav: null });
  });

  test('nekad: utan grund nekas åtkomst utan erbjudande om val', () => {
    for (const id of ['lak-kard', 'ssk-kard', 'lak-akut', 'lak-vc', 'lak-psyk']) {
      const r = fraga(id, 'p12', 'las_oversikt');
      expect(r.tillaten).toBe(false);
      expect(r.grund).toBe('nekad');
    }
    expect(fraga('adm-kard', 'p12', 'las_admin')).toMatchObject({ tillaten: false, grund: 'nekad', krav: null });
    expect(fraga('lak-kard', 'p12', 'okand_handling').tillaten).toBe(false);
    expect(prova(db, { personal: null, patient: 'p01', handling: 'las_oversikt' }).tillaten).toBe(false);
  });

  test('gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade', () => {
    expect(fraga('lak-kard', 'p01', 'las_lakemedel', { enhet_id: 'uso-med', gemensam: true }).tillaten).toBe(true);
    expect(fraga('lak-kard', 'p01', 'las_lakemedel', { enhet_id: 'uso-med' }).krav).toBe('kraver_val');
    expect(fraga('lak-kard', 'p04', 'las_lakemedel', { enhet_id: 'uso-psyk', gemensam: true }).krav).toBe('kraver_samtycke');
  });

  test('skyddad identitet: namn och personnummer maskeras', () => {
    const p = db.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    expect(p.skyddad).toBe(1);
    expect(visningsnamn(p)).toBe('Skyddad identitet');
    expect(visningsPnr(p)).toBe('19840416-****');
    expect(maskeraPnr('198004262385')).toBe('19800426-****');
    expect(visningsnamn(p, true)).toBe('Malin Engberg');
    expect(visningsPnr(p, true)).toBe('19840416-2383');
    const vanlig = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
    expect(visningsnamn(vanlig)).toBe('Gunnar Åkesson');
  });
});
