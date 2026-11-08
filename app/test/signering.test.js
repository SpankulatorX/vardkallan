// Runda 9, r7: signering med simulerat SITHS-kort och vårdenhetens signeringslista (Sussa 3.1.11.2). Testnamnen står i
// src/sussa/mappning/3.1.11.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Signering', () => {
  test('en signering sparar en signatur över anteckningens innehåll med det simulerade SITHS-kortet, och den går att kontrollera', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const a = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre i dag.' }] });
    await k.post(`/api/anteckning/${a.data.id}/signera`);
    const s = await k.get(`/api/anteckning/${a.data.id}/signatur`);
    expect(s.status).toBe(200);
    expect(s.data).toMatchObject({ giltig: true, av: 'Sara Lindqvist', certifikat: expect.stringContaining('Simulerat SITHS-kort') });
    expect(s.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Signaturen kan inte ändras, och ett ändrat innehåll syns som ogiltigt.
    const db = sandlada(app, k).db;
    expect(() => db.query('UPDATE signaturer SET sha256 = ? WHERE anteckning_id = ?').run('0'.repeat(64), a.data.id)).toThrow();
    expect(() => db.query('DELETE FROM signaturer').run()).toThrow();
    // En rättelse signeras med en egen signatur.
    const r = await k.post(`/api/anteckning/${a.data.id}/ratta`, { orsak: 'Fel dag', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre.' }] });
    const s2 = await k.get(`/api/anteckning/${r.data.id}/signatur`);
    expect(s2.data.giltig).toBe(true);
    expect(s2.data.sha256).not.toBe(s.data.sha256);
    // Signaturen lämnas bara ut till den som får läsa anteckningen.
    await k.logga('uppf');
    const nekad = await k.get(`/api/anteckning/${a.data.id}/signatur`);
    const saknas = await k.get('/api/anteckning/999999/signatur');
    expect(nekad.status).toBe(404);
    expect(JSON.stringify(nekad.data)).toBe(JSON.stringify(saknas.data));
  });

  test('signaturen går inte att läsa för en anteckning på en spärrad vårdenhet eller som är undantagen från visning, och svaret är detsamma som för ett id som inte finns', async () => {
    const k = klient(app);
    await k.logga('lak-psyk');
    const db = sandlada(app, k).db;
    // En signerad anteckning på den spärrade psykiatrin för Elin Sandberg (p04).
    const a = await k.post('/api/patient/p04/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Samtal.' }] });
    await k.post(`/api/anteckning/${a.data.id}/signera`);
    expect((await k.get(`/api/anteckning/${a.data.id}/signatur`)).data.giltig).toBe(true);
    await k.logga('lak-kard');
    const sparrad = await k.get(`/api/anteckning/${a.data.id}/signatur`);
    const saknas = await k.get('/api/anteckning/999999/signatur');
    expect(sparrad.status).toBe(404);
    expect(JSON.stringify(sparrad.data)).toBe(JSON.stringify(saknas.data));
    // En anteckning på kardiologen vars typ systemförvaltningen har undantagit från visning.
    const b = await k.post('/api/patient/p01/anteckningar', { typ: 'Mottagningsanteckning', sokord: [{ sokord: 'Aktuellt', text: 'Undantas.' }] });
    await k.post(`/api/anteckning/${b.data.id}/signera`);
    expect((await k.get(`/api/anteckning/${b.data.id}/signatur`)).status).toBe(200);
    db.query("INSERT INTO konfig_andringar (slag, nyckel, varde, giltig_fran, galler_fran, motivering, foreslagen_av, foreslagen, status, beslutad_av, beslutad) VALUES ('undantag', 'anteckningstyp:Mottagningsanteckning', '{\"kanaler\":[\"visning\"]}', '2020-01-01', '2020-01-01', 'Test av undantag', 'sysf', '2020-01-01', 'godkand', 'sysf-2', '2020-01-01')").run();
    const undantagen = await k.get(`/api/anteckning/${b.data.id}/signatur`);
    expect(undantagen.status).toBe(404);
    expect(JSON.stringify(undantagen.data)).toBe(JSON.stringify(saknas.data));
  });

  test('ingen privat signeringsnyckel finns i databasen, och kontrollen behöver bara den publika nyckeln', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const a = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Nyckeltest.' }] });
    await k.post(`/api/anteckning/${a.data.id}/signera`);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT count(*) AS n FROM installningar WHERE nyckel LIKE 'signering%'").get().n).toBe(0);
    const rad = db.query('SELECT * FROM signaturer WHERE anteckning_id = ?').get(a.data.id);
    expect(rad.publik).toBeTruthy();
    // Ingen tabell har en kolumn med en privat nyckel, och databasen som sparas eller kopieras innehåller ingen.
    for (const t of db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
      for (const c of db.query(`PRAGMA table_info("${t.name}")`).all()) expect(c.name).not.toMatch(/privat|private/i);
    }
    const kopia = Buffer.from(db.serialize()).toString('latin1');
    expect(kopia).not.toContain('PRIVATE KEY');
    expect(kopia).not.toContain('signeringsnyckel');
    // Kontrollen med bara den publika nyckeln.
    const { verify } = require('node:crypto');
    expect(verify(null, Buffer.from(`${rad.sha256}|${rad.hsa_id}|${rad.tid}`), { key: Buffer.from(rad.publik, 'base64'), format: 'der', type: 'spki' }, Buffer.from(rad.signatur, 'base64url'))).toBe(true);
  });

  test('signeringslistan visar vårdenhetens osignerade poster per författare utan patientuppgifter', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Utkast som väntar.' }] });
    await k.logga('vch-kard');
    const l = await k.get('/api/signeringslista');
    expect(l.status).toBe(200);
    expect(l.data.vardenhet).toBe('Kardiologiska kliniken USÖ');
    const sara = l.data.forfattare.find(f => f.namn === 'Sara Lindqvist');
    expect(sara.antal).toBeGreaterThan(0);
    expect(sara.typer.Daganteckning).toBeGreaterThan(0);
    expect(JSON.stringify(l.data)).not.toMatch(/Gunnar|p01|194502024732|Utkast som väntar/);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT patient_id, grund FROM atkomstlogg WHERE personal_id = 'vch-kard' AND resurs = 'signeringslista' ORDER BY id DESC").get()).toEqual({ patient_id: null, grund: 'administrativ' });
    await k.logga('ssk-kard');
    expect((await k.get('/api/signeringslista')).status).toBe(403);
  });
});
