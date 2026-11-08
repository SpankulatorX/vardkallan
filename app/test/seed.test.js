import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PATIENTER } from '../src/seed/patienter.js';
import { PERSONAL } from '../src/seed/personal.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';
import { idag, addDagar, byggSeed } from '../src/db.js';
import { harVardrelation, vardenhetFor } from '../src/atkomst.js';
import { nyDb } from './hjalp.js';

// Kopia av research/testpersonnummer.json (Skatteverkets testpersonnummer).
const TESTPNR = new Set(JSON.parse(readFileSync(join(import.meta.dir, 'data', 'testpersonnummer.json'), 'utf8')));
const db = nyDb();

describe('Seed', () => {
  test('personnummer kommer från Skatteverkets testpersonnummer', () => {
    expect(TESTPNR.size).toBeGreaterThan(1000);
    // Patienterna med personnummer. De påhittade samordningsnumren, reservnumren och OID-identiteterna prövas i identitet.test.js.
    for (const p of db.query("SELECT personnummer FROM patienter WHERE id_typ = 'personnummer'").all()) {
      expect(p.personnummer).toMatch(/^\d{12}$/);
      expect(TESTPNR.has(p.personnummer)).toBe(true);
    }
  });

  test('kön stämmer med näst sista siffran', () => {
    for (const p of db.query("SELECT * FROM patienter WHERE id_typ = 'personnummer'").all()) {
      expect(p.kon).toBe(Number(p.personnummer[10]) % 2 === 1 ? 'man' : 'kvinna');
      expect(p.fodd).toBe(`${p.personnummer.slice(0, 4)}-${p.personnummer.slice(4, 6)}-${p.personnummer.slice(6, 8)}`);
    }
    // Barnet är fött på 2010-talet.
    expect(db.query("SELECT fodd FROM patienter WHERE id = 'p09'").get().fodd.slice(0, 3)).toBe('201');
  });

  test('minst tolv patienter med vårdkontakter, tre signerade anteckningar, diagnoser, mätvärden och läkemedel', () => {
    const pat = db.query('SELECT id FROM patienter').all();
    expect(pat.length).toBeGreaterThanOrEqual(12);
    for (const { id } of pat) {
      const n = (sql) => db.query(sql).get(id).n;
      expect(n('SELECT count(*) AS n FROM vardkontakter WHERE patient_id = ?')).toBeGreaterThan(0);
      expect(n("SELECT count(*) AS n FROM anteckningar WHERE patient_id = ? AND status = 'signerad'")).toBeGreaterThanOrEqual(3);
      expect(n('SELECT count(*) AS n FROM diagnoser WHERE patient_id = ?')).toBeGreaterThan(0);
      expect(n('SELECT count(*) AS n FROM matvarden WHERE patient_id = ?')).toBeGreaterThan(0);
      // Runda 7, r6: ett friskt barn i barnhälsovården har inga ordinerade läkemedel.
      if (!db.query('SELECT 1 FROM bhv_inskrivning WHERE patient_id = ?').get(id)) expect(n('SELECT count(*) AS n FROM ordinationer WHERE patient_id = ?')).toBeGreaterThan(0);
    }
    // Mätvärden över tid: minst en patient har en serie av samma typ.
    expect(db.query("SELECT count(*) AS n FROM matvarden WHERE patient_id = 'p08' AND typ = 'crp'").get().n).toBeGreaterThanOrEqual(4);
  });

  test('alla ordinationer har orsak och uppföljningsdatum', () => {
    for (const o of db.query('SELECT * FROM ordinationer').all()) {
      expect(o.orsak.trim().length).toBeGreaterThan(2);
      expect(o.uppfoljning).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.uppfoljning >= o.start).toBe(true);
    }
  });

  test('ICD-10-SE- och ATC-koder har rätt form', () => {
    for (const d of db.query('SELECT kod FROM diagnoser').all()) expect(d.kod).toMatch(/^[A-Z]\d{2}\.\d{1,2}$/);
    for (const k of KATALOG) expect(k.atc).toMatch(/^[A-Z]\d{2}[A-Z]{2}(\d{2})?$/);
    for (const o of db.query('SELECT atc FROM overkanslighet WHERE atc IS NOT NULL').all()) expect(o.atc).toMatch(/^[A-Z]\d{2}[A-Z]{0,2}/);
    expect(KATALOG.length).toBeGreaterThanOrEqual(40);
  });

  test('inga förbjudna tecken i texterna', () => {
    const forbjudna = /[\u2014\u2013\u2026]/;
    const filer = [
      ...readdirSync(join(import.meta.dir, '..', 'src', 'seed')).map(f => join(import.meta.dir, '..', 'src', 'seed', f)),
      ...readdirSync(join(import.meta.dir, '..', 'src')).filter(f => f.endsWith('.js')).map(f => join(import.meta.dir, '..', 'src', f)),
    ];
    for (const f of filer) expect({ fil: f, traff: forbjudna.test(readFileSync(f, 'utf8')) }).toEqual({ fil: f, traff: false });
    const allText = JSON.stringify(db.query('SELECT sokord FROM anteckningar').all());
    expect(forbjudna.test(allText)).toBe(false);
  });

  test('datum är relativa till dagens datum', () => {
    const bas = new Date('2027-03-15T12:00:00Z');
    const d = byggSeed(bas);
    const inl = d.query("SELECT start FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL").get();
    expect(inl.start.slice(0, 10)).toBe('2027-03-12');
    // Migrerad historik har kvar sina absoluta datum.
    expect(d.query("SELECT start FROM vardkontakter WHERE kalla = 'migrerad:VAS' AND patient_id = 'p01'").get().start.slice(0, 10)).toBe('2014-03-11');
    expect(d.query("SELECT varde FROM installningar WHERE nyckel = 'seed_datum'").get().varde).toBe('2027-03-15');
    // Inget i dagens mall ligger i framtiden utom planerade datum.
    const nu = new Date().toISOString();
    for (const t of ['SELECT start AS t FROM vardkontakter WHERE coalesce(planerad, 0) = 0', 'SELECT skapad AS t FROM anteckningar', 'SELECT tid AS t FROM matvarden', 'SELECT skickad_tid AS t FROM remisser']) {
      for (const r of db.query(t).all()) expect(r.t <= nu).toBe(true);
    }
    expect(db.query("SELECT varde FROM installningar WHERE nyckel = 'seed_datum'").get().varde).toBe(idag());
    expect(db.query("SELECT uppfoljning FROM ordinationer WHERE patient_id = 'p01' AND lakemedel_id = 'VK-NPL-0001'").get().uppfoljning).toBe(addDagar(idag(), 4));
    d.close();
  });

  test('demorollerna finns enligt designen', () => {
    const demo = PERSONAL.filter(p => p.demo).map(p => [p.id, p.namn, p.yrke, p.enhet]);
    expect(demo).toEqual([
      ['lak-kard', 'Sara Lindqvist', 'lakare', 'uso-kard'],
      ['ssk-kard', 'Johan Ek', 'sjukskoterska', 'uso-kard-72'],
      ['usk-kard', 'Amira Haddad', 'underskoterska', 'uso-kard-72'],
      ['lak-akut', 'Erik Nyström', 'lakare', 'uso-akut'],
      ['lak-vc', 'Per Holm', 'lakare', 'vc-tybble'],
      ['lak-psyk', 'Lena Ström', 'lakare', 'uso-psyk'],
      ['adm-kard', 'Karin Berg', 'vardadministrator', 'uso-kard'],
      ['logg', 'Mats Wall', 'logggranskare', 'rk'],
      ['ark', 'Ingela Nord', 'arkivarie', 'rk'],
      ['uppf', 'Daniel Sund', 'uppfoljning', 'rk'],
      // Runda 6, r3: kommunens part i samordnad planering, en simulerad kommun.
      ['kom-bist', 'Lisa Ahlgren', 'kommun', 'kommun-demo'],
      // Runda 6, r2: farmaceuten i den fördjupade läkemedelsgenomgången.
      ['far-kard', 'Elsa Nordin', 'farmaceut', 'uso-kard'],
      // Runda 6, r6: verksamhetschefen på kardiologen.
      ['vch-kard', 'Ulrika Sandell', 'verksamhetschef', 'uso-kard'],
    ]);
  });

  test('patient 12 saknar vårdrelation till alla demoroller', () => {
    for (const p of PERSONAL.filter(x => x.demo)) expect(harVardrelation(db, 'p12', vardenhetFor(db, p.enhet))).toBe(false);
    // Patient 2 saknar pågående vårdrelation med akuten.
    expect(harVardrelation(db, 'p02', 'uso-akut')).toBe(false);
  });

  test('migrerad historik från VAS och Cosmic finns för patient 1', () => {
    const k = db.query("SELECT DISTINCT kalla FROM anteckningar WHERE patient_id = 'p01'").all().map(r => r.kalla).sort();
    expect(k).toEqual(['migrerad:Cosmic', 'migrerad:VAS', 'vardkallan']);
    expect(PATIENTER.find(p => p.id === 'p01').overkanslighet[0].atc).toBe('J01C');
  });
});
