// Runda 14, r4 (Sussa 11.2.1.8): vårdenhetens reservdator för läkemedel, den andra källan när kärnsystemet inte går att
// nå och den egna datorn också är nere. Testnamnen står i src/sussa/mappning/11.2.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, personal } from './hjalp.js';
import * as reserv from '../src/reservlakemedel.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;

describe('Reservdator för läkemedel', () => {
  test('listan har alla inskrivna patienter på vårdenheten med aktuella ordinationer och dagens doser, ur samma svar som de vanliga anropen', async () => {
    const k = await inloggad('ssk-kard');
    const r = await k.get('/api/reservlista');
    expect(r.status).toBe(200);
    expect(r.data.vardenhet.id).toBe('uso-kard');
    // Listan förnyas så ofta att den aldrig är äldre än tio minuter när ett avbrott börjar, också om ett försök misslyckas.
    expect(r.data.fornyas.intervallMs * 2).toBeLessThanOrEqual(r.data.fornyas.maxAlderMs);
    const ids = r.data.patienter.map(p => p.id).sort();
    expect(ids).toEqual(reserv.inskrivna(db(k), 'uso-kard').map(x => x.patient_id).filter((v, i, a) => a.indexOf(v) === i).sort());
    expect(ids).toContain('p01');
    const p01 = r.data.patienter.find(p => p.id === 'p01');
    expect(p01.plats).toBe('Avd 72, sal 4');
    const lm = await k.get('/api/patient/p01/lakemedel');
    expect(p01.ordinationer.map(o => o.id)).toEqual(lm.data.ordinationer.filter(o => o.aktuell).map(o => o.id));
    expect(p01.ordinationer.map(o => o.dosering)).toEqual(lm.data.ordinationer.filter(o => o.aktuell).map(o => o.dosering));
    const adm = await k.get('/api/patient/p01/administreringar');
    expect(p01.doser.map(d => `${d.ordinationId}@${d.planerad}:${d.status}`)).toEqual(adm.data.doser.map(d => `${d.ordinationId}@${d.planerad}:${d.status}`));
    expect(Date.parse(p01.tid)).toBeGreaterThan(Date.now() - 60_000);
  });

  test('bara sjuksköterskor och läkare använder reservdatorn, och bara för den egna vårdenhetens inskrivna patienter', async () => {
    const adm = await inloggad('adm-kard');
    const r = await adm.get('/api/reservlista');
    expect(r.status).toBe(403);
    expect(db(adm).query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'adm-kard' AND resurs = 'reservlista' AND resultat = 'nekad'").get().n).toBe(1);
    const vc = await inloggad('ssk-vc');
    const v = await vc.get('/api/reservlista');
    expect(v.status).toBe(200);
    expect(v.data.patienter.map(p => p.id)).not.toContain('p01');
    expect(JSON.stringify(v.data)).not.toContain('Åkesson');
  });

  test('en spärrad vårdenhets ordinationer finns inte med, och skyddad identitet är maskerad', async () => {
    const k = await inloggad('ssk-kard');
    const d = db(k);
    const fore = (await k.get('/api/reservlista')).data.patienter.find(p => p.id === 'p01');
    expect(fore.ordinationer.map(o => o.vardenhet)).toContain('Medicinska kliniken USÖ');
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'uso-med', ?, 1)").run(new Date().toISOString());
    d.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p01'").run();
    const efter = (await k.get('/api/reservlista')).data;
    const p01 = efter.patienter.find(p => p.id === 'p01');
    expect(p01.ordinationer.map(o => o.vardenhet)).not.toContain('Medicinska kliniken USÖ');
    expect(JSON.stringify(efter)).not.toContain('Medicinska kliniken');
    expect(p01.namn).toBe('Skyddad identitet');
    expect(p01.personnummer).toMatch(/\*{4}$/);
    expect(JSON.stringify(efter)).not.toContain('Åkesson');
  });

  test('utlämnandet till reservdatorn loggas som en period: en rad när patienten kommer med och en när det slutar', () => {
    const d = nyDb();
    const ssk = personal(d, 'ssk-kard');
    const rader = () => d.query("SELECT resurs, syfte, tid FROM atkomstlogg WHERE personal_id = 'ssk-kard' AND patient_id = 'p01' AND resurs LIKE 'reservlista%' ORDER BY id").all();
    const t0 = new Date('2026-11-12T09:00:00Z');
    reserv.lista(d, ssk, () => ({}), t0);
    expect(rader().map(r => r.resurs)).toEqual(['reservlista']);
    // Förnyelsen efter fyra minuter loggas inte för sig.
    reserv.lista(d, ssk, () => ({}), new Date(t0.getTime() + 4 * 60_000));
    reserv.lista(d, ssk, () => ({}), new Date(t0.getTime() + 8 * 60_000));
    expect(rader().map(r => r.resurs)).toEqual(['reservlista']);
    // Efter ett uppehåll längre än tio minuter har utlämnandet slutat vid den senaste förnyelsen, och en ny period börjar.
    reserv.lista(d, ssk, () => ({}), new Date(t0.getTime() + 30 * 60_000));
    const r = rader();
    expect(r.map(x => x.resurs)).toEqual(['reservlista', 'reservlista:slut', 'reservlista']);
    expect(r[1].tid).toBe(new Date(t0.getTime() + 8 * 60_000).toISOString());
    expect(r[1].syfte).toContain('förnyades 3 gånger');
    // När patienten skrivs ut slutar utlämnandet.
    d.query("UPDATE vardkontakter SET slut = ? WHERE patient_id = 'p01' AND slut IS NULL AND typ = 'slutenvard'").run('2026-11-12T09:31:00Z');
    reserv.lista(d, ssk, () => ({}), new Date(t0.getTime() + 34 * 60_000));
    expect(rader().at(-1)).toMatchObject({ resurs: 'reservlista:slut' });
    expect(rader().at(-1).syfte).toContain('finns inte längre på listan');
  });
});
