import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';

// Runda 10, r2: urval i utskriften (datumintervall, en enskild anteckning och valda poster) och strukturerad
// menprövning med sökning på mottagare över alla patienter (Sussa 3.1.9.4 och 3.1.9.5).

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const ALLA = ['lakemedel', 'diagnoser', 'anteckningar', 'matvarden', 'remisser', 'vardkontakter'];
const skrivUt = (k, pid, extra = {}) => k.post(`/api/patient/${pid}/utskrift`, { syfte: 'Underlag till patienten på begäran', delar: ALLA, ...extra });
const sektion = (u, id) => u.sektioner.find(s => s.id === id);
const dag = (t) => String(t).slice(0, 10);

describe('Utskrift, urval', () => {
  test('ett datumintervall tar bara med poster från intervallet, och urvalet står i utskriften', async () => {
    const k = await inloggad('lak-kard');
    const hela = (await skrivUt(k, 'p01')).data;
    const tider = sektion(hela, 'anteckningar').rader.map(r => dag(r.tid)).sort();
    expect(tider.length).toBeGreaterThan(2);
    const fran = tider[1];
    const till = tider[tider.length - 1];
    const r = await skrivUt(k, 'p01', { delar: ['anteckningar', 'diagnoser', 'matvarden'], fran, till });
    expect(r.status).toBe(201);
    const u = r.data;
    expect(u.urval).toMatchObject({ fran, till, poster: null });
    for (const s of u.sektioner) for (const rad of s.rader) { expect(dag(rad.tid) >= fran).toBe(true); expect(dag(rad.tid) <= till).toBe(true); }
    expect(sektion(u, 'anteckningar').rader.length).toBe(tider.filter(t => t >= fran && t <= till).length);
    expect(u.utelamnat.join(' ')).toContain(`från ${fran} till ${till}`);
    // Ett intervall som slutar före det börjar, eller ett datum som inte finns, avvisas.
    expect((await skrivUt(k, 'p01', { fran: till, till: fran, delar: ['anteckningar'] })).status).toBe(fran === till ? 201 : 400);
    expect((await skrivUt(k, 'p01', { fran: '2026-02-30', delar: ['anteckningar'] })).status).toBe(400);
  });

  test('en enskild anteckning skrivs ut för sig, och loggen, posterna och kontrollsumman gäller just urvalet', async () => {
    const k = await inloggad('lak-kard');
    const lista = (await k.get('/api/patient/p01/anteckningar')).data.anteckningar.filter(a => a.status === 'signerad');
    const en = lista[0];
    const r = await k.post(`/api/patient/p01/utskrift`, { syfte: 'Kopia av anteckningen till patienten', anteckningId: en.id });
    expect(r.status).toBe(201);
    const u = r.data;
    expect(u.sektioner.map(s => s.id)).toEqual(['anteckningar']);
    expect(sektion(u, 'anteckningar').rader).toHaveLength(1);
    expect(u.urval.poster).toEqual([{ typ: 'anteckning', id: en.id }]);
    const sparad = db(k).query('SELECT * FROM utskrifter WHERE id = ?').get(u.id);
    expect(JSON.parse(sparad.poster)).toEqual([{ typ: 'anteckning', id: en.id, version: expect.any(Number) }]);
    expect(JSON.parse(sparad.urval)).toEqual(u.urval);
    // Kontrollsumman räknas på det som skrevs ut, och samma innehåll ger samma summa.
    const hash = createHash('sha256').update(JSON.stringify({ patient: u.patient, sektioner: u.sektioner, utelamnat: u.utelamnat })).digest('hex');
    expect(u.kontrollsumma).toBe(hash);
    expect(sparad.innehall_hash).toBe(hash);
    const rad = loggRader(k).find(x => x.resurs === `utskrift:${u.id}`);
    expect(rad).toMatchObject({ handling: 'skriv_ut', patient_id: 'p01', resultat: 'tillaten' });
    // Eftersökningen visar urvalet.
    await k.logga('logg');
    expect((await k.get(`/api/utskrift/${u.id}`)).data).toMatchObject({ id: u.id, antalPoster: 1, urval: u.urval });
  });

  test('valda poster ur flera delar skrivs ut, och en post som inte syns för den inloggade avvisas utan att röja den', async () => {
    const k = await inloggad('lak-kard');
    const hela = (await skrivUt(k, 'p01')).data;
    const poster = JSON.parse(db(k).query('SELECT poster FROM utskrifter WHERE id = ?').get(hela.id).poster);
    const ant = poster.find(p => p.typ === 'anteckning');
    const ord = poster.find(p => p.typ === 'ordination');
    const valda = [{ typ: 'anteckning', id: ant.id }, { typ: 'ordination', id: ord.id }];
    const u = (await skrivUt(k, 'p01', { poster: valda })).data;
    expect(u.sektioner.map(s => [s.id, s.rader.length])).toEqual([['lakemedel', 1], ['anteckningar', 1]]);
    expect(JSON.parse(db(k).query('SELECT poster FROM utskrifter WHERE id = ?').get(u.id).poster).map(p => `${p.typ}:${p.id}`).sort()).toEqual(['anteckning:' + ant.id, 'ordination:' + ord.id].sort());
    // En spärrad anteckning för p04 och en post som inte finns ger samma svar.
    const sparrad = db(k).query("SELECT a.id FROM anteckningar a WHERE a.patient_id = 'p04' AND a.enhet_id = 'uso-psyk'").get();
    expect(sparrad).toBeTruthy();
    const a = await skrivUt(k, 'p04', { poster: [{ typ: 'anteckning', id: sparrad.id }] });
    const b = await skrivUt(k, 'p04', { poster: [{ typ: 'anteckning', id: 999999 }] });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(a.data).toEqual(b.data);
    expect(JSON.stringify(a.data)).not.toContain('psyk');
  });

  test('förslaget erbjuder datumintervall och de poster som går att välja, och bara de som rollen får läsa', async () => {
    const k = await inloggad('usk-kard');
    const f = (await k.get('/api/patient/p01/utskrift/forslag')).data;
    expect(f.urval).toMatchObject({ fran: expect.any(String), till: expect.any(String) });
    expect(f.urval.poster.every(p => p.typ !== 'diagnos')).toBe(true);
    expect(f.urval.poster.filter(p => p.typ === 'anteckning').every(p => p.rubrik === 'Omvårdnadsanteckning')).toBe(true);
  });
});

describe('Utskrift, menprövning', () => {
  test('menprövningen registreras strukturerat med beslut, grund och vem, och systemet föreslår grunden ur mottagaren', async () => {
    const k = await inloggad('lak-kard');
    const f = (await k.get('/api/patient/p01/utskrifter')).data;
    expect(f.menprovning.beslut.map(b => b.id)).toEqual(['inget_men', 'forbehall', 'delvis']);
    expect(f.menprovning.forslag.Patienten).toMatchObject({ beslut: 'inget_men', grund: 'osl_12_1' });
    expect(f.menprovning.forslag['Polis eller åklagare'].grund).toBe('osl_10_23');
    const r = await k.post('/api/patient/p01/utlamnanden', { mottagare: 'Försäkringskassan', beskrivning: 'Journalkopia för sjukpenning', menprovning: { beslut: 'forbehall', kommentar: 'Bara uppgifter om arbetsförmågan.' } });
    expect(r.status).toBe(201);
    expect(r.data.menprovningBeslut).toMatchObject({ beslut: 'forbehall', grund: 'osl_10_28', av: { id: 'lak-kard', namn: 'Sara Lindqvist' }, kommentar: 'Bara uppgifter om arbetsförmågan.' });
    expect(r.data.menprovningBeslut.beslutText).toContain('förbehåll');
    expect(r.data.menprovningBeslut.grundText).toContain('10 kap. 28 §');
    expect(r.data.menprovning).toContain('förbehåll');
    const rad = db(k).query('SELECT * FROM utlamnanden WHERE id = ?').get(r.data.id);
    expect(rad).toMatchObject({ menprovning_beslut: 'forbehall', menprovning_grund: 'osl_10_28', menprovning_av: 'lak-kard' });
    // Menprövningen ändras aldrig i efterhand.
    expect(() => db(k).query("UPDATE utlamnanden SET menprovning_beslut = 'inget_men' WHERE id = ?").run(r.data.id)).toThrow();
    expect(() => db(k).query("UPDATE utlamnanden SET menprovning_av = 'lak-vc' WHERE id = ?").run(r.data.id)).toThrow();
    // Ett okänt beslut, eller patientens egen grund för någon annan, avvisas med en förklaring.
    expect((await k.post('/api/patient/p01/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Kopia', menprovning: { beslut: 'kanske' } })).status).toBe(400);
    const fel = await k.post('/api/patient/p01/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Kopia', menprovning: { beslut: 'inget_men', grund: 'osl_12_1' } });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('patienten själv');
    // En kopia till patienten i samma steg som utskriften får patientens grund.
    const u = (await skrivUt(k, 'p01', { delar: ['lakemedel'], utlamnasTill: 'Patienten' })).data;
    expect(u.utlamnande.menprovningBeslut).toMatchObject({ beslut: 'inget_men', grund: 'osl_12_1', av: { id: 'lak-kard' } });
  });

  test('logggranskaren söker utlämnanden på mottagare över alla patienter, och sökningen loggas', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p01/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Journalkopia, mål T 123-26', menprovning: { beslut: 'inget_men' } });
    await k.post('/api/patient/p04/utlamnanden', { mottagare: 'Domstol', beskrivning: 'Journalkopia, mål T 456-26', menprovning: { beslut: 'delvis', kommentar: 'Uppgifter om tredje man borttagna.' } });
    await k.post('/api/patient/p04/utlamnanden', { mottagare: 'Annan vårdgivare', beskrivning: 'Underlag för fortsatt vård' });
    const nekad = await k.get('/api/logg/utlamnanden?mottagare=domstol');
    expect(nekad.status).toBe(403);
    await k.logga('logg');
    const s = await k.get('/api/logg/utlamnanden?mottagare=domstol');
    expect(s.status).toBe(200);
    expect(s.data.rader.map(r => r.patientId).sort()).toEqual(['p01', 'p04']);
    expect(s.data.rader.every(r => r.mottagare === 'Domstol' && r.patient?.namn)).toBe(true);
    expect(s.data.rader.find(r => r.patientId === 'p04').menprovningBeslut).toMatchObject({ beslut: 'delvis', av: { namn: 'Sara Lindqvist' } });
    expect(loggRader(k).some(x => x.personal_id === 'logg' && x.handling === 'las_logg' && x.resurs === 'utlamnanden:mottagare')).toBe(true);
    // Alla mottagare och ett tidsintervall.
    const alla = (await k.get('/api/logg/utlamnanden')).data;
    expect(alla.rader.length).toBeGreaterThanOrEqual(3);
    expect(alla.mottagare).toEqual(expect.arrayContaining(['Domstol', 'Annan vårdgivare']));
    expect((await k.get('/api/logg/utlamnanden?till=2000-01-01')).data.rader).toEqual([]);
  });

  test('sökningen på mottagare maskerar skyddad identitet', async () => {
    const k = await inloggad('lak-vc');
    expect((await k.post('/api/patient/p03/utlamnanden', { mottagare: 'Inspektionen för vård och omsorg', beskrivning: 'Journalkopia för tillsyn' })).status).toBe(201);
    await k.logga('logg');
    const s = (await k.get(`/api/logg/utlamnanden?mottagare=${encodeURIComponent('Inspektionen')}`)).data;
    const rad = s.rader.find(r => r.patientId === 'p03');
    expect(rad.patient.namn).toBe('Skyddad identitet');
    expect(rad.patient.personnummer).toMatch(/\*\*\*\*$/);
    expect(rad.menprovningBeslut).toMatchObject({ grund: 'osl_10_28' });
  });
});
