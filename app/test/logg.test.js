import { describe, test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { loggaRad, verifiera, kanonisk } from '../src/logg.js';
import { nyDb } from './hjalp.js';

const rad = (db, extra = {}) => loggaRad(db, { personal_id: 'lak-kard', enhet_id: 'uso-kard', patient_id: 'p01', handling: 'las_journal', grund: 'egen_enhet', ...extra });
// En kopia av sandlådan där triggrarna kan släppas utan att röra originalet.
const kopia = (db) => Database.deserialize(db.serialize());

describe('Åtkomstloggen', () => {
  test('varje rad kedjas med sha256 av föregående hash och raden', () => {
    const db = nyDb();
    const forra = db.query('SELECT hash FROM atkomstlogg ORDER BY id DESC LIMIT 1').get().hash;
    const r = rad(db);
    expect(r.prev_hash).toBe(forra);
    const lagrad = db.query('SELECT * FROM atkomstlogg WHERE id = ?').get(r.id);
    const forvantad = createHash('sha256').update(forra + kanonisk(lagrad)).digest('hex');
    expect(lagrad.hash).toBe(forvantad);
    const r2 = rad(db, { handling: 'las_lakemedel' });
    expect(r2.prev_hash).toBe(r.hash);
    expect(db.query('SELECT prev_hash FROM atkomstlogg WHERE id = 1').get().prev_hash).toBe('0'.repeat(64));
  });

  test('UPDATE på loggen avbryts av trigger', () => {
    const db = nyDb();
    rad(db);
    expect(() => db.query("UPDATE atkomstlogg SET grund = 'nodatkomst' WHERE id = 1").run()).toThrow(/kan inte ändras/);
    expect(() => db.query("UPDATE atkomstlogg SET hash = 'x'").run()).toThrow();
  });

  test('DELETE på loggen avbryts av trigger', () => {
    const db = nyDb();
    const fore = db.query('SELECT count(*) AS n FROM atkomstlogg').get().n;
    expect(() => db.query('DELETE FROM atkomstlogg WHERE id = 1').run()).toThrow(/kan inte raderas/);
    expect(() => db.query('DELETE FROM atkomstlogg').run()).toThrow();
    expect(db.query('SELECT count(*) AS n FROM atkomstlogg').get().n).toBe(fore);
  });

  test('verifiera godkänner en hel kedja', () => {
    const db = nyDb();
    for (let i = 0; i < 5; i++) rad(db, { syfte: `test ${i}` });
    const v = verifiera(db);
    expect(v.hel).toBe(true);
    expect(v.antal).toBeGreaterThanOrEqual(11);
  });

  test('verifiera upptäcker ändrad rad när triggern släppts i en kopia', () => {
    const db = nyDb();
    rad(db); rad(db);
    const k = kopia(db);
    k.exec('DROP TRIGGER atkomstlogg_ingen_andring');
    k.query("UPDATE atkomstlogg SET grund = 'egen_enhet', resultat = 'tillaten' WHERE id = 5").run();
    const v = verifiera(k);
    expect(v.hel).toBe(false);
    expect(v.felRad).toBe(5);
    expect(v.orsak).toBe('Raden har ändrats');
    // Originalet är orört.
    expect(verifiera(db).hel).toBe(true);
    // Även om hashen räknas om på den ändrade raden bryts kedjan vid nästa rad.
    const k2 = kopia(db);
    k2.exec('DROP TRIGGER atkomstlogg_ingen_andring');
    const r = k2.query('SELECT * FROM atkomstlogg WHERE id = 5').get();
    const ny = { ...r, syfte: 'förfalskat' };
    const h = createHash('sha256').update(r.prev_hash + kanonisk(ny)).digest('hex');
    k2.query('UPDATE atkomstlogg SET syfte = ?, hash = ? WHERE id = 5').run('förfalskat', h);
    expect(verifiera(k2)).toMatchObject({ hel: false, felRad: 6, orsak: 'Kedjan är bruten' });
  });

  test('verifiera upptäcker raderad rad när triggern släppts i en kopia', () => {
    const db = nyDb();
    rad(db); rad(db);
    const k = kopia(db);
    k.exec('DROP TRIGGER atkomstlogg_ingen_radering');
    k.query('DELETE FROM atkomstlogg WHERE id = 3').run();
    expect(verifiera(k)).toMatchObject({ hel: false, felRad: 4 });
  });

  test('okänd grund vägras', () => {
    const db = nyDb();
    expect(() => rad(db, { grund: 'nyfikenhet' })).toThrow();
  });
});
