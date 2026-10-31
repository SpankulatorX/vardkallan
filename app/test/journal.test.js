import { describe, test, expect } from 'bun:test';
import * as journal from '../src/journal.js';
import { nyDb, atk } from './hjalp.js';

const SOK = [{ sokord: 'Aktuellt', text: 'Mår bättre.' }, { sokord: 'Bedömning', text: 'Stabil.' }];
const rad = (db, id) => db.query('SELECT * FROM anteckningar WHERE id = ?').get(id);

describe('Journal', () => {
  test('mallar finns för alla anteckningstyper', () => {
    const typer = journal.MALLAR.map(m => m.typ);
    for (const t of ['Inskrivningsanteckning', 'Daganteckning', 'Mottagningsanteckning', 'Omvårdnadsanteckning', 'Epikris', 'Akutanteckning']) expect(typer).toContain(t);
    for (const m of journal.MALLAR) expect(m.sokord.length).toBeGreaterThan(2);
  });

  test('utkast kan ändras av författaren', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK });
    expect(a.status).toBe('utkast');
    const ny = journal.andraUtkast(atk(db, 'lak-kard', 'p01'), rad(db, a.id), { sokord: [{ sokord: 'Aktuellt', text: 'Ändrad.' }] });
    expect(ny.sokord[0].text).toBe('Ändrad.');
    expect(ny.andrad).not.toBeNull();
  });

  test('annan än författaren kan inte ändra eller signera utkast', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK });
    expect(() => journal.andraUtkast(atk(db, 'ssk-kard', 'p01'), rad(db, a.id), { sokord: SOK })).toThrow(/författaren/);
    expect(() => journal.signera(atk(db, 'lak-akut', 'p01'), rad(db, a.id))).toThrow(/författaren/);
  });

  test('utkast syns bara för författaren', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK });
    expect(journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).anteckningar.some(x => x.id === a.id)).toBe(true);
    expect(journal.listaAnteckningar(atk(db, 'ssk-kard', 'p01')).anteckningar.some(x => x.id === a.id)).toBe(false);
    expect(() => journal.hamtaAnteckning(atk(db, 'ssk-kard', 'p01'), rad(db, a.id))).toThrow(/finns inte/);
  });

  test('signerad anteckning kan inte ändras via API-funktionen', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK });
    const s = journal.signera(atk(db, 'lak-kard', 'p01'), rad(db, a.id));
    expect(s.status).toBe('signerad');
    expect(s.signerad.av.id).toBe('lak-kard');
    expect(() => journal.andraUtkast(atk(db, 'lak-kard', 'p01'), rad(db, a.id), { sokord: SOK })).toThrow(/rättelse/);
    expect(() => journal.signera(atk(db, 'lak-kard', 'p01'), rad(db, a.id))).toThrow(/redan signerad/);
  });

  test('signerad anteckning kan inte ändras i databasen (trigger)', () => {
    const db = nyDb();
    const id = db.query("SELECT id FROM anteckningar WHERE status = 'signerad' LIMIT 1").get().id;
    expect(() => db.query("UPDATE anteckningar SET sokord = '[]' WHERE id = ?").run(id)).toThrow(/signerad anteckning kan inte ändras/);
    expect(() => db.query("UPDATE anteckningar SET status = 'utkast' WHERE id = ?").run(id)).toThrow();
  });

  test('signerad anteckning kan inte raderas (trigger)', () => {
    const db = nyDb();
    const id = db.query("SELECT id FROM anteckningar WHERE status = 'signerad' LIMIT 1").get().id;
    expect(() => db.query('DELETE FROM anteckningar WHERE id = ?').run(id)).toThrow(/raderas/);
    expect(rad(db, id)).not.toBeNull();
  });

  test('rättelse skapar ny version och den gamla finns kvar oförändrad', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK });
    journal.signera(atk(db, 'lak-kard', 'p01'), rad(db, a.id));
    const fore = rad(db, a.id);
    const r = journal.ratta(atk(db, 'lak-kard', 'p01'), fore, { orsak: 'Fel dos i bedömningen', sokord: [{ sokord: 'Bedömning', text: 'Rättad text.' }] });
    expect(r.version).toBe(2);
    expect(r.ersatterId).toBe(a.id);
    expect(r.rattelseOrsak).toBe('Fel dos i bedömningen');
    expect(r.status).toBe('signerad');
    expect(r.versioner.map(v => v.id)).toEqual([a.id, r.id]);
    expect(r.versioner[0].ersatt).toBe(true);
    expect(rad(db, a.id)).toEqual(fore);
    // Listan visar den gällande versionen, den gamla går att läsa via versionskedjan.
    const lista = journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).anteckningar;
    expect(lista.some(x => x.id === r.id)).toBe(true);
    expect(lista.some(x => x.id === a.id)).toBe(false);
    const gammal = journal.hamtaAnteckning(atk(db, 'lak-kard', 'p01'), rad(db, a.id));
    expect(gammal.ersatt).toBe(true);
    expect(gammal.sokord).toEqual(SOK);
    // Seeden innehåller också en rättad anteckning.
    expect(nyDb().query("SELECT count(*) AS n FROM anteckningar WHERE ersatter_id IS NOT NULL AND patient_id = 'p01'").get().n).toBe(1);
  });

  test('rättelse kräver orsak', () => {
    const db = nyDb();
    const id = db.query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND forfattare_id = 'lak-kard' AND status = 'signerad' AND ersatter_id IS NULL AND typ = 'Inskrivningsanteckning'").get().id;
    expect(() => journal.ratta(atk(db, 'lak-kard', 'p01'), rad(db, id), { orsak: '', sokord: SOK })).toThrow(/orsak/);
    expect(() => journal.ratta(atk(db, 'lak-kard', 'p01'), rad(db, id), { sokord: SOK })).toThrow(/orsak/);
  });

  test('bara senaste versionen kan rättas', () => {
    const db = nyDb();
    const gammal = db.query("SELECT a.* FROM anteckningar a WHERE EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id)").get();
    expect(() => journal.ratta(atk(db, 'lak-kard', 'p01'), gammal, { orsak: 'Ny rättelse', sokord: SOK })).toThrow(/senaste versionen/);
    // En annan vårdenhet kan inte rätta kardiologens anteckning.
    const akut = db.query("SELECT * FROM anteckningar WHERE patient_id = 'p01' AND enhet_id = 'uso-akut'").get();
    expect(() => journal.ratta(atk(db, 'lak-kard', 'p01', { andra_enheter: true }), akut, { orsak: 'Försök', sokord: SOK })).toThrow(/vårdenhet/);
  });

  test('sjuksköterska kan skriva omvårdnadsanteckning men inte läkaranteckning', () => {
    const db = nyDb();
    const a = journal.skapaAnteckning(atk(db, 'ssk-kard', 'p01'), { typ: 'Omvårdnadsanteckning', sokord: [{ sokord: 'Sömn', text: 'Sov gott.' }] });
    expect(a.kategori).toBe('omvardnad');
    expect(() => journal.skapaAnteckning(atk(db, 'ssk-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK })).toThrow();
    expect(() => journal.skapaAnteckning(atk(db, 'usk-kard', 'p01'), { typ: 'Omvårdnadsanteckning', sokord: SOK })).toThrow();
    expect(() => journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Okänd', sokord: SOK })).toThrow(/Okänd/);
    expect(() => journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [] })).toThrow(/sökord/);
    expect(() => journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: SOK, vardkontaktId: 999999 })).toThrow(/Vårdkontakten/);
  });

  test('mätvärden valideras och registreras', () => {
    const db = nyDb();
    const a = atk(db, 'usk-kard', 'p01');
    const m = journal.registreraMatvarde(a, { typ: 'puls', varde: 78, enhet: 'slag/min' });
    expect(m).toMatchObject({ typ: 'puls', varde: 78, enhet: 'slag/min' });
    expect(journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'blodtryck', varde: '130/80' }).varde).toBe('130/80');
    expect(journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'temp', varde: '37,4' }).varde).toBe(37.4);
    expect(() => journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'puls', varde: 900 })).toThrow();
    expect(() => journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'puls', varde: 70, enhet: 'mmHg' })).toThrow(/enhet/);
    expect(() => journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'blodtryck', varde: '80/120' })).toThrow();
    expect(() => journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'okand', varde: 1 })).toThrow();
    expect(() => journal.registreraMatvarde(atk(db, 'usk-kard', 'p01'), { typ: 'puls', varde: 70, tid: '2020-01-01T10:00:00Z' })).toThrow(/30 dagarna/);
    expect(() => journal.registreraMatvarde(atk(db, 'adm-kard', 'p01'), { typ: 'puls', varde: 70 })).toThrow();
    const lista = journal.listaMatvarden(atk(db, 'usk-kard', 'p01')).matvarden;
    expect(lista[0].registreradAv.id).toBe('usk-kard');
  });
});
