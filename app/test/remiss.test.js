import { describe, test, expect } from 'bun:test';
import * as remiss from '../src/remiss.js';
import { idag, addDagar } from '../src/db.js';
import { nyDb, atk } from './hjalp.js';

const ny = (db, extra = {}) => remiss.skapa(atk(db, 'lak-vc', 'p09'), { tillEnhetId: 'uso-kard', fragestallning: 'Blåsljud, bedömning?', anamnes: 'Nyupptäckt blåsljud.', prioritet: 'normal', svarSenast: addDagar(idag(), 20), ...extra });
const rad = (db, id) => remiss.hamtaRad(db, id);
const larmTyper = (r, nu) => remiss.larmFor(r, nu).map(l => l.typ);

describe('Remiss', () => {
  test('statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat', () => {
    const db = nyDb();
    const r = ny(db);
    expect(r.status).toBe('skickad');
    expect(remiss.mottag(atk(db, 'adm-kard', 'p09'), rad(db, r.id)).status).toBe('mottagen');
    const b = remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' });
    expect(b).toMatchObject({ status: 'bedomd', beslut: 'accepterad' });
    const s = remiss.svara(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { svar: 'Ekokardiografi normal.' });
    expect(s.status).toBe('besvarad');
    expect(s.svar).toBe('Ekokardiografi normal.');
    const k = remiss.kvitteraSvar(atk(db, 'lak-vc', 'p09'), rad(db, r.id));
    expect(k.status).toBe('svar_kvitterat');
    expect(Object.values(k.tider).every(Boolean)).toBe(true);
    expect(k.av.mottagen.id).toBe('adm-kard');
    expect(k.av.svarKvitterat.id).toBe('lak-vc');
  });

  test('steg kan inte hoppas över', () => {
    const db = nyDb();
    const r = ny(db);
    expect(() => remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' })).toThrow(/mottagen/);
    expect(() => remiss.svara(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { svar: 'Svar' })).toThrow(/accepterad/);
    expect(() => remiss.kvitteraSvar(atk(db, 'lak-vc', 'p09'), rad(db, r.id))).toThrow(/remissvar/);
    remiss.mottag(atk(db, 'adm-kard', 'p09'), rad(db, r.id));
    expect(() => remiss.mottag(atk(db, 'adm-kard', 'p09'), rad(db, r.id))).toThrow(/redan mottagen/);
  });

  test('avvisning kräver motivering och avslutar kedjan', () => {
    const db = nyDb();
    const r = ny(db);
    remiss.mottag(atk(db, 'lak-kard', 'p09'), rad(db, r.id));
    expect(() => remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'avvisad' })).toThrow(/motivering/);
    expect(() => remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'kanske' })).toThrow();
    const a = remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'avvisad', motivering: 'Handläggs i primärvården.' });
    expect(a).toMatchObject({ status: 'bedomd', beslut: 'avvisad', motivering: 'Handläggs i primärvården.' });
    expect(() => remiss.svara(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { svar: 'Svar' })).toThrow();
  });

  test('bara mottagande enhet kan kvittera, bedöma och svara', () => {
    const db = nyDb();
    const r = ny(db);
    expect(() => remiss.mottag(atk(db, 'lak-vc', 'p09'), rad(db, r.id))).toThrow(/inte ställd till din vårdenhet/);
    expect(() => remiss.mottag(atk(db, 'lak-akut', 'p09', { nodatkomst: true }), rad(db, r.id))).toThrow(/vårdenhet/);
    expect(() => remiss.mottag(atk(db, 'usk-kard', 'p09'), rad(db, r.id))).toThrow();
    remiss.mottag(atk(db, 'adm-kard', 'p09'), rad(db, r.id));
    expect(() => remiss.bedom(atk(db, 'adm-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' })).toThrow();
    expect(() => remiss.bedom(atk(db, 'ssk-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' })).toThrow();
  });

  test('bara avsändaren kan kvittera svaret', () => {
    const db = nyDb();
    const r = db.query("SELECT * FROM remisser WHERE patient_id = 'p11'").get();
    expect(r.status).toBe('besvarad');
    expect(() => remiss.kvitteraSvar(atk(db, 'lak-kard', 'p11'), r)).toThrow(/remitterande/);
    expect(remiss.kvitteraSvar(atk(db, 'lak-vc', 'p11'), r).status).toBe('svar_kvitterat');
  });

  test('larm: mottagningskvittens saknas efter 2 timmar', () => {
    const db = nyDb();
    const r = rad(db, ny(db).id);
    expect(larmTyper(r, new Date())).toEqual([]);
    expect(larmTyper(r, new Date(Date.now() + 2 * 3600_000 + 60_000))).toEqual(['saknar_mottagningskvittens']);
    remiss.mottag(atk(db, 'adm-kard', 'p09'), r);
    expect(larmTyper(rad(db, r.id), new Date(Date.now() + 3 * 3600_000))).toEqual([]);
  });

  test('larm: svar saknas efter sista svarsdatum', () => {
    const db = nyDb();
    const r = rad(db, ny(db, { svarSenast: addDagar(idag(), 1) }).id);
    remiss.mottag(atk(db, 'adm-kard', 'p09'), r);
    remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' });
    const r2 = rad(db, r.id);
    expect(larmTyper(r2, new Date())).toEqual([]);
    expect(larmTyper(r2, new Date(Date.now() + 3 * 86400_000))).toEqual(['svar_forsenat']);
  });

  test('larm: svar inte kvitterat efter 3 dagar', () => {
    const db = nyDb();
    const r = ny(db);
    remiss.mottag(atk(db, 'adm-kard', 'p09'), rad(db, r.id));
    remiss.bedom(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { beslut: 'accepterad' });
    remiss.svara(atk(db, 'lak-kard', 'p09'), rad(db, r.id), { svar: 'Normalt.' });
    const r2 = rad(db, r.id);
    expect(larmTyper(r2, new Date(Date.now() + 2 * 86400_000))).toEqual([]);
    expect(larmTyper(r2, new Date(Date.now() + 3 * 86400_000 + 60_000))).toEqual(['svar_ej_kvitterat']);
    remiss.kvitteraSvar(atk(db, 'lak-vc', 'p09'), r2);
    expect(larmTyper(rad(db, r.id), new Date(Date.now() + 10 * 86400_000))).toEqual([]);
  });

  test('seeden har remisser i varje läge och larm', () => {
    const db = nyDb();
    const alla = db.query('SELECT * FROM remisser').all();
    const lagen = new Set(alla.map(r => r.status === 'bedomd' ? `bedomd:${r.beslut}` : r.status));
    for (const l of ['skickad', 'mottagen', 'bedomd:accepterad', 'bedomd:avvisad', 'besvarad', 'svar_kvitterat']) expect(lagen.has(l)).toBe(true);
    const larm = alla.flatMap(r => remiss.larmFor(r).map(l => `${r.patient_id}:${l.typ}`));
    expect(larm).toContain('p05:saknar_mottagningskvittens');
    expect(larm).toContain('p06:svar_forsenat');
    expect(larm).toContain('p11:svar_ej_kvitterat');
    expect(larm.some(l => l.startsWith('p03:'))).toBe(false);
    // Kardiologen ser larmet för den okvitterade remissen, vårdcentralen sina två.
    expect(remiss.larmForEnhet(db, atk(db, 'lak-kard', 'p05').personal).map(l => l.patientId)).toContain('p05');
    expect(remiss.larmForEnhet(db, atk(db, 'lak-vc', 'p11').personal).map(l => `${l.patientId}:${l.typ}`).sort()).toEqual(['p06:svar_forsenat', 'p11:svar_ej_kvitterat']);
  });

  test('vårdadministratör ser status men inte klinisk text', () => {
    const db = nyDb();
    const adm = atk(db, 'adm-kard', 'p05');
    const lista = remiss.lista(db, adm.personal, 'inkommande');
    const r = lista.find(x => x.patientId === 'p05');
    expect(r.status).toBe('skickad');
    expect(r.fragestallning).toBeNull();
    expect(r.anamnes).toBeNull();
    const lak = remiss.lista(db, atk(db, 'lak-kard', 'p05').personal, 'inkommande').find(x => x.patientId === 'p05');
    expect(lak.fragestallning).toContain('kärlkramp');
    // Skyddad patient maskeras i remisslistan.
    expect(lista.find(x => x.patientId === 'p03').patient).toMatchObject({ namn: 'Skyddad identitet', personnummer: '19840416-****' });
  });

  test('ny remiss valideras', () => {
    const db = nyDb();
    expect(() => ny(db, { tillEnhetId: 'vc-tybble' })).toThrow();
    expect(() => ny(db, { tillEnhetId: 'uso-kard-72' })).toThrow();
    expect(() => ny(db, { svarSenast: addDagar(idag(), -1) })).toThrow();
    expect(() => ny(db, { prioritet: 'bråttom' })).toThrow();
    expect(() => ny(db, { fragestallning: '' })).toThrow();
    expect(() => remiss.skapa(atk(db, 'ssk-kard', 'p01'), { tillEnhetId: 'uso-med', fragestallning: 'Test', svarSenast: addDagar(idag(), 5) })).toThrow();
  });
});
