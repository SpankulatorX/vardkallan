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
    expect((await k.get(`/api/anteckning/${a.data.id}/signatur`)).status).toBe(403);
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
