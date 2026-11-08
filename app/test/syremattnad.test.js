// Runda 10, r4: mätvärden (Sussa 3.1.3.9). SpO2 skala 2 i NEWS2 efter läkarens beslut, hur varje värde kom in
// (manuellt, maskinellt, räknat eller från patienten) och urvalet i listan. Testnamnen står i src/sussa/mappning/3.1.3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';
import { news2, saturationSkala2 } from '../src/skalor.js';
import { inmatning } from '../src/matvarde-inmatning.js';
import { ICD10SE } from '../src/kodverk.js';
import { HYPERKAPNI } from '../src/syremattnad-skala.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const OMGANG = { andningsfrekvens: '18', saturation: '90', syrgas: '0', blodtryck: '130/80', puls: '80', medvetande: 'A', temp: '37,0' };
const hyperkapni = (d, enhet = 'uso-kard') => d.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p01', ?, 'J96.11', ?, 'bi', '2026-01-10')")
  .run(enhet, ICD10SE['J96.11']);

describe('Mätvärden, skala 2 och inmatning', () => {
  test('SpO2 skala 2: poängen följer Chart 1, och utan uppgift om luft eller syrgas räknas syremättnaden inte', () => {
    // Skala 2 enligt RCP 2017: 83 eller lägre 3, 84 till 85 2, 86 till 87 1, 88 till 92 0 och 93 eller mer på luft 0,
    // och med syrgas 93 till 94 1, 95 till 96 2 och 97 eller mer 3.
    const fall = [[83, 0, 3], [84, 0, 2], [85, 2, 2], [86, 0, 1], [87, 0, 1], [88, 0, 0], [92, 2, 0], [93, 0, 0], [99, 0, 0], [93, 2, 1], [94, 2, 1], [95, 2, 2], [96, 2, 2], [97, 2, 3], [100, 4, 3]];
    for (const [v, o2, p] of fall) expect(saturationSkala2(v, o2)).toBe(p);
    const v = { andningsfrekvens: 18, saturation: 90, syrgas: 0, systoliskt: 130, puls: 80, medvetande: 'A', temp: 37 };
    expect(news2(v).poang).toBe(3);
    const s2 = news2(v, { skala: 2 });
    expect(s2).toMatchObject({ poang: 0, skala: 2 });
    expect(s2.delar.find(d => d.parameter === 'saturation').namn).toBe('Syremättnad, skala 2');
    const utan = news2({ ...v, syrgas: null }, { skala: 2 });
    expect(utan.komplett).toBe(false);
    expect(utan.saknas).toEqual(expect.arrayContaining(['Syremättnad', 'Luft eller syrgas']));
    for (const k of HYPERKAPNI) expect(ICD10SE[k]).toContain('hyperkapné');
  });

  test('systemet föreslår skala 2 vid andningssvikt med hyperkapné, läkaren beslutar med ett klick och NEWS2 räknas med skala 2', async () => {
    const k = await inloggad('lak-kard');
    const d = db(k);
    // En hel NEWS2-kontroll med syremättnaden 90 procent på luft ger 3 poäng med skala 1.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post('/api/patient/p01/news2', OMGANG)).status).toBe(201);
    somPerson(sandlada(app, k), 'lak-kard');
    const fore = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(fore.aktuell.poang).toBe(3);
    expect(fore.skala).toMatchObject({ skala: 1, forslag: null, kanBesluta: true });
    hyperkapni(d);
    const forslag = (await k.get('/api/patient/p01/matvarden')).data.news2.skala;
    expect(forslag.forslag.text).toContain('J96.11');
    expect(forslag.forslag.text).toContain('88 till 92 procent');
    const b = await k.post('/api/patient/p01/news2-skala', { skala: 2 });
    expect(b.status).toBe(200);
    const efter = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(efter.skala).toMatchObject({ skala: 2, forslag: null, beslut: { av: 'Sara Lindqvist' } });
    expect(efter.skala.text).toContain('88 till 92 procent');
    expect(efter.aktuell.poang).toBe(0);
    expect(efter.aktuell.delar.find(x => x.parameter === 'saturation')).toMatchObject({ namn: 'Syremättnad, skala 2', poang: 0 });
    // FHIR och förhandsvisningen räknar på samma sätt.
    const obs = (await k.get('/fhir/Observation?patient=p01')).data.entry.map(e => e.resource).filter(r => r.id.startsWith('news2-'))
      .sort((a, b) => a.effectiveDateTime.localeCompare(b.effectiveDateTime));
    expect(obs.at(-1).valueQuantity.value).toBe(0);
    expect((await k.post('/api/news2/berakna', { ...OMGANG, skala: 2 })).data.poang).toBe(0);
    // Sjuksköterskan ser skalan men beslutar inte.
    somPerson(sandlada(app, k), 'ssk-kard');
    const ssk = (await k.get('/api/patient/p01/matvarden')).data.news2.skala;
    expect(ssk).toMatchObject({ skala: 2, kanBesluta: false });
    expect((await k.post('/api/patient/p01/news2-skala', { skala: 1 })).status).toBe(403);
    // Läkaren avslutar beslutet, och skala 1 gäller igen.
    somPerson(sandlada(app, k), 'lak-kard');
    expect((await k.post('/api/patient/p01/news2-skala', { skala: 2 })).status).toBe(409);
    expect((await k.post('/api/patient/p01/news2-skala', { skala: 1 })).status).toBe(200);
    expect((await k.get('/api/patient/p01/matvarden')).data.news2.aktuell.poang).toBe(3);
    expect(() => d.query('DELETE FROM news2_skalor').run()).toThrow();
  });

  test('skala 2 gäller bara där beslutet syns: en spärrad vårdenhets beslut räknas inte och röjs inte', async () => {
    const k = await inloggad('lak-akut');
    const d = db(k);
    hyperkapni(d, 'uso-akut');
    expect((await k.post('/api/patient/p01/news2-skala', { skala: 2 })).status).toBe(200);
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post('/api/patient/p01/news2', OMGANG)).status).toBe(201);
    somPerson(sandlada(app, k), 'lak-kard');
    // Utan aktivt val gäller skala 1 på kardiologen, och akutens beslut nämns inte.
    const utan = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(utan.skala).toMatchObject({ skala: 1, beslut: null, forslag: null });
    expect(utan.aktuell.poang).toBe(3);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    expect((await k.get('/api/patient/p01/matvarden')).data.news2.skala.skala).toBe(2);
    // Larmet i inkorgen bygger bara på den egna vårdenhetens beslut, som värdena.
    const larm = (await k.get('/api/inkorg')).data.news2Larm.find(x => x.patientId === 'p01');
    expect(larm?.poang ?? 3).toBe(3);
    // Med en spärr för akuten räknas beslutet inte, inte heller efter aktivt val, och svaret säger inget om det.
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'uso-akut', ?, 1)").run(new Date().toISOString());
    const sp = (await k.get('/api/patient/p01/matvarden')).data.news2;
    expect(sp.skala).toMatchObject({ skala: 1, beslut: null });
    expect(sp.aktuell.poang).toBe(3);
    expect(JSON.stringify(sp.skala)).not.toMatch(/akut|J96/i);
  });

  test('varje mätvärde visar om det är manuellt eller maskinellt inmatat, och listan kan väljas ut efter typ, inmatning och period', async () => {
    expect(inmatning({ typ: 'puls', kalla: 'vardkallan', registrerad_av: 'ssk-kard' }, { vem: 'Johan Ek' })).toEqual({ typ: 'manuell', text: 'Manuellt inmatat av Johan Ek', maskinell: false });
    expect(inmatning({ typ: 'puls', kalla: 'utrustning' })).toMatchObject({ typ: 'utrustning', maskinell: true });
    expect(inmatning({ typ: 'egfr', kalla: 'vardkallan' })).toMatchObject({ typ: 'raknad', maskinell: true, text: 'Räknat av systemet ur kreatininet (CKD-EPI 2021)' });
    expect(inmatning({ typ: 'crp', kalla: 'vardkallan', registrerad_av: null })).toMatchObject({ typ: 'laboratorium', maskinell: true });
    expect(inmatning({ typ: 'vikt', kalla: 'patient' })).toMatchObject({ typ: 'patient', maskinell: false });
    expect(inmatning({ typ: 'vikt', kalla: 'migrerad:VAS' })).toMatchObject({ typ: 'migrerad' });
    const k = await inloggad('ssk-kard');
    expect((await k.post('/api/patient/p01/matvarden', { typ: 'puls', varde: '72' })).status).toBe(201);
    const alla = (await k.get('/api/patient/p01/matvarden')).data;
    expect(alla.matvarden.every(m => m.inmatning?.typ && m.inmatning.text)).toBe(true);
    const egen = alla.matvarden.find(m => m.typ === 'puls' && m.varde === 72);
    expect(egen.inmatning).toMatchObject({ typ: 'manuell', text: 'Manuellt inmatat av Johan Ek' });
    expect(alla.urval).toMatchObject({ typ: null, inmatning: null, dagar: null, totalt: alla.matvarden.length });
    expect(alla.urval.inmatningar.map(x => x.id)).toEqual(expect.arrayContaining(['manuell', 'migrerad']));
    const puls = (await k.get('/api/patient/p01/matvarden?typ=puls&inmatning=manuell&dagar=1')).data;
    expect(puls.matvarden.length).toBeGreaterThan(0);
    expect(puls.matvarden.every(m => m.typ === 'puls' && m.inmatning.typ === 'manuell' && Date.parse(m.tid) > Date.now() - 86400_000)).toBe(true);
    expect(puls.urval).toMatchObject({ typ: 'puls', inmatning: 'manuell', dagar: 1, antal: puls.matvarden.length, totalt: alla.matvarden.length });
    // Kurvorna och NEWS2 bygger på alla värden, oavsett urval, och ett okänt urval ignoreras.
    expect(puls.kurvor.length).toBe(alla.kurvor.length);
    expect((await k.get('/api/patient/p01/matvarden?typ=constructor&inmatning=__proto__&dagar=-3')).data.urval).toMatchObject({ typ: null, inmatning: null, dagar: null });
    // Ett värde från medicinteknisk utrustning är maskinellt och skiljs från de manuella.
    const mt = (await k.get('/api/patient/p01/matvarden?inmatning=utrustning')).data.matvarden;
    expect(mt.every(m => m.inmatning.maskinell)).toBe(true);
  });
});
