// Runda 13, r1: guidade uppdrag i testinbjudan. Uppdragen följer Sussas 34 testfall, systemet bockar av ett uppdrag på
// servern när rollens demoperson har gjort det i sandlådan, och efter varje uppdrag sparas jämförelsen med testarens
// journalsystem i den gemensamma databasen för synpunkter.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar } from '../src/db.js';
import * as ti from '../src/testinbjudan.js';
import * as sp from '../src/synpunkter.js';
import { TESTFALL } from '../src/sussa-testfall.js';

let app;
beforeAll(() => { app = testserver({ synpunktFil: ':memory:' }); });
afterAll(() => app.stopp());

async function borja(testroll, profil = {}) {
  const k = klient(app);
  const r = ti.TESTROLLER.find(x => x.id === testroll);
  if (r.invanare) await k.post('/api/login/invanare', { invanareId: r.invanare }); else await k.logga(r.demoroll);
  const s = await k.post('/api/testare/starta', { testroll, profil });
  expect(s.status).toBe(200);
  return { k, s: s.data };
}
const status = (t, id) => t.uppdrag.find(u => u.id === id)?.status;

describe('Testinbjudan', () => {
  test(`varje yrkesroll har 6 till 12 uppdrag, och tillsammans täcker uppdragen alla Sussas 34 testfall`, async () => {
    const r = await klient(app).get('/api/testare/roller');
    expect(r.status).toBe(200);
    expect(r.data.roller.map(x => x.knapp)).toEqual(['Läkare på sjukhus', 'Läkare i primärvården', 'Sjuksköterska', 'Undersköterska', 'Barnmorska', 'Vårdadministratör eller medicinsk sekreterare', 'Fysioterapeut och andra yrken', 'Systemförvaltare', 'Patient i Min journal']);
    for (const x of ti.TESTROLLER) {
      expect(x.uppdrag.length).toBeGreaterThanOrEqual(6);
      expect(x.uppdrag.length).toBeLessThanOrEqual(12);
      for (const u of x.uppdrag) {
        expect(Boolean(u.klar) !== Boolean(u.fraga)).toBe(true);
        const ut = ti.uppdragUt(u);
        expect(ut.titel.length).toBeGreaterThan(3);
        expect(ut.text.length).toBeGreaterThan(0);
        // Rätt svar lämnas aldrig ut till testaren.
        expect(JSON.stringify(ut)).not.toContain(u.rattText ?? '§§');
      }
    }
    const tackta = new Set(ti.TESTROLLER.flatMap(x => x.uppdrag.map(u => u.sussa).filter(Boolean)));
    expect(TESTFALL.filter(t => !tackta.has(t.nr)).map(t => t.nr)).toEqual([]);
    expect(TESTFALL).toHaveLength(34);
  });

  test(`inget uppdrag är avbockat när det startar, för någon roll, så att seedens och Sussas testdata aldrig räknas`, async () => {
    for (const x of ti.TESTROLLER) {
      const { s } = await borja(x.id);
      expect(s.aktiv).toBe(true);
      expect(s.uppdrag.filter(u => u.status !== 'kvar').map(u => u.id)).toEqual([]);
      expect(s.aktuellt).toBe(x.uppdrag[0].id);
    }
  }, 60_000);

  test(`ett uppdrag bockas av när rollen gör det på riktigt, och tiden till uppdraget räknas`, async () => {
    const { k } = await borja('lakare-sjukhus');
    const ord = { lakemedelId: 'VK-NPL-0027', dosering: '1 tablett vid behov', typ: 'vid_behov', vidBehov: true, ordinationsorsak: 'Ledvärk', uppfoljningsdatum: addDagar(idag(), 7) };
    expect((await k.post('/api/patient/p01/lakemedel', { ...ord, kvitteradeVarningar: [{ regel: 'warfarin_nsaid', motivering: 'Kort kur, INR kontrolleras' }] })).status).toBe(201);
    const t = (await k.get('/api/testare')).data;
    expect(status(t, 'varning')).toBe('klar');
    // Sussas testfall 1.2 kräver två ordinationer.
    expect(status(t, '1.2')).toBe('kvar');
    expect(t.attBesvara).toEqual(['varning']);
    const rad = sandlada(app, k).db.query("SELECT * FROM testare_uppdrag WHERE uppdrag = 'varning'").get();
    expect(Number.isInteger(rad.tid_s)).toBe(true);
    // Att öppna en patient bockar av det första uppdraget.
    await k.get('/api/patient/p04');
    expect(status((await k.get('/api/testare')).data, 'forsta-patient')).toBe('klar');
  });

  test(`bara rollens egen demoperson räknas: samma sak gjord av en annan roll i sandlådan bockar inte av uppdraget`, async () => {
    const { k } = await borja('sjukskoterska');
    // Läkaren registrerar mätvärden i samma sandlåda.
    await k.logga('lak-kard');
    for (const v of ['131/84', '128/80']) await k.post('/api/patient/p01/matvarden', { typ: 'blodtryck', varde: v });
    expect(status((await k.get('/api/testare')).data, '4.2')).toBe('kvar');
    await k.logga('ssk-kard');
    for (const v of ['131/84', '128/80']) expect((await k.post('/api/patient/p01/matvarden', { typ: 'blodtryck', varde: v })).status).toBe(201);
    expect(status((await k.get('/api/testare')).data, '4.2')).toBe('klar');
    // En annan sandlåda påverkas inte.
    const { k: k2 } = await borja('sjukskoterska');
    expect(status((await k2.get('/api/testare')).data, '4.2')).toBe('kvar');
  });

  test(`vårdadministratören, systemförvaltaren och patienten i Min journal får sina uppdrag avbockade`, async () => {
    const { k } = await borja('vardadministrator');
    const b = sandlada(app, k).db.query("SELECT * FROM bokningar WHERE patient_id = 'p08'").get();
    expect((await k.post(`/api/bokning/${b.id}/checka-in`)).status).toBe(200);
    expect(status((await k.get('/api/testare')).data, '5.5')).toBe('klar');

    const { k: s } = await borja('systemforvaltare');
    expect((await s.post('/api/konfiguration', { nyckel: 'logg.stickprov_antal', varde: 20, motivering: 'Större urval.' })).status).toBe(201);
    expect(status((await s.get('/api/testare')).data, 'regel')).toBe('klar');

    const { k: p } = await borja('patient');
    expect((await p.post('/api/min/journal/p01/egenmatning', { typ: 'blodtryck', varde: '142/88' })).status).toBe(201);
    await p.get('/api/min/journal/p01/logglista');
    const t = (await p.get('/api/testare')).data;
    expect(status(t, 'egenmatning')).toBe('klar');
    expect(status(t, 'logglista')).toBe('klar');
  });

  test(`ett uppdrag som går ut på att hitta något prövas mot Sussas rätta svar på servern`, async () => {
    const { k } = await borja('lakare-sjukhus');
    const fel = await k.post('/api/testare/uppdrag/3.4/svar', { svar: '1,2' });
    expect(fel.data.ratt).toBe(false);
    expect(status(fel.data.tillstand, '3.4')).toBe('kvar');
    expect((await k.post('/api/testare/uppdrag/3.4/svar', { svar: '' })).status).toBe(400);
    const ratt = await k.post('/api/testare/uppdrag/3.4/svar', { svar: 'PK 0,9' });
    expect(ratt.data.ratt).toBe(true);
    expect(status(ratt.data.tillstand, '3.4')).toBe('klar');
    // Ett uppdrag utan fråga kan inte bockas av med ett svar.
    expect((await k.post('/api/testare/uppdrag/1.2/svar', { svar: 'klart' })).status).toBe(400);
    expect((await k.post('/api/testare/uppdrag/finns-inte/svar', { svar: 'x' })).status).toBe(404);
  });

  test(`jämförelsen efter ett uppdrag sparas en gång, med testarens profil, och syns per uppdrag och journalsystem hos testledaren`, async () => {
    const t = testserver({ synpunktFil: ':memory:' });
    try {
      const k = klient(t);
      await k.logga('usk-kard');
      expect((await k.post('/api/testare/starta', { testroll: 'underskoterska', profil: { system: 'cosmic', yrke: 'underskoterska', vardform: 'region', ar: '3-10' } })).status).toBe(200);
      // Inte gjort än: ingen jämförelse.
      expect((await k.post('/api/testare/uppdrag/vatskebalans/jamforelse', { jamforelse: 'lika' })).status).toBe(409);
      expect((await k.post('/api/patient/p01/vatskebalans', { riktning: 'ut', typ: 'urin', volymMl: 120 })).status).toBe(201);
      expect((await k.post('/api/testare/uppdrag/vatskebalans/jamforelse', { jamforelse: 'kanske' })).status).toBe(400);
      const j = await k.post('/api/testare/uppdrag/vatskebalans/jamforelse', { jamforelse: 'lattare', text: 'Färre steg än i Cosmic.', mittSystem: 'ungefär sex klick', bredd: 1440 });
      expect(j.status).toBe(201);
      expect(j.data.nummer).toMatch(/^J-/);
      expect(j.data.tillstand.attBesvara).toEqual([]);
      expect((await k.post('/api/testare/uppdrag/vatskebalans/jamforelse', { jamforelse: 'lika' })).status).toBe(409);
      // Ett överhoppat uppdrag kan också jämföras.
      await k.post('/api/testare/uppdrag/7.2/hoppa');
      expect((await k.post('/api/testare/uppdrag/7.2/jamforelse', { jamforelse: 'kan_inte', system: 'takecare' })).status).toBe(201);
      // Den som inte vill svara slipper frågan, och inget sparas.
      await k.post('/api/testare/uppdrag/3.2/hoppa');
      const inget = await k.post('/api/testare/uppdrag/3.2/jamforelse', { hoppa: true });
      expect(inget.data.nummer).toBeNull();
      expect(inget.data.tillstand.attBesvara).toEqual([]);
      const kod = sp.skapaLaskod(t.synpunkter.db, { namn: 'x' }).kod;
      const l = (await klient(t).post('/api/testledare/synpunkter', { laskod: kod })).data;
      const v = l.jamforelser.find(x => x.uppdrag === 'vatskebalans');
      expect(v).toMatchObject({ testroll: 'underskoterska', status: 'klar', jamforelse: 'lattare', system: 'cosmic', yrke: 'underskoterska', vardform: 'region', ar: '3-10', mittSystem: 'ungefär sex klick', bredd: 1440 });
      expect(l.jamforelser.find(x => x.uppdrag === '7.2')).toMatchObject({ status: 'hoppade_over', jamforelse: 'kan_inte', system: 'takecare' });
      const g = l.perUppdrag.find(x => x.uppdrag === 'vatskebalans' && x.system === 'cosmic');
      expect(g).toMatchObject({ antal: 1, lattare: 1, andelLattare: 100, titel: 'Registrera vätskebalansen' });
      expect(l.perUppdrag.find(x => x.uppdrag === 'vatskebalans' && x.system === 'alla').texter[0].text).toBe('Färre steg än i Cosmic.');
      const md = await klient(t).post('/api/testledare/export', { laskod: kod, format: 'md' });
      expect(md.data).toContain('Registrera vätskebalansen');
      expect(md.data).toContain('Färre steg än i Cosmic.');
      const csv = await klient(t).post('/api/testledare/export', { laskod: kod, format: 'csv-uppdrag' });
      expect(csv.data.split('\n')[0]).toContain('jamforelse');
      expect(csv.data).toContain('vatskebalans');
    } finally { t.stopp(); }
  });

  test(`profilen är frivillig, prövas mot listorna och följer med synpunkter från samma sandlåda`, async () => {
    const t = testserver({ synpunktFil: ':memory:' });
    try {
      const k = klient(t);
      expect((await k.post('/api/testare/profil', { system: 'cosmic' })).status).toBe(409);
      expect((await k.post('/api/testare/starta', { testroll: 'astronaut' })).status).toBe(400);
      expect((await k.post('/api/testare/starta', { testroll: 'systemforvaltare', profil: { system: 'okänt' } })).status).toBe(400);
      expect((await k.post('/api/testare/starta', { testroll: 'systemforvaltare' })).status).toBe(200);
      expect((await k.post('/api/testare/profil', { system: 'melior', vardform: 'kommun' })).data.profil).toMatchObject({ system: 'melior', vardform: 'kommun' });
      const r = await k.post('/api/synpunkter', { typ: 'saknas', allvar: 'liten', text: 'Saknar en sak.', vy: '#/regler', bredd: 800 });
      const kod = sp.skapaLaskod(t.synpunkter.db, { namn: 'x' }).kod;
      const s = (await klient(t).post('/api/testledare/synpunkter', { laskod: kod })).data.synpunkter.find(x => x.nummer === r.data.nummer);
      expect(s).toMatchObject({ system: 'melior', vardform: 'kommun', testroll: 'systemforvaltare', uppdrag: 'godkann' });
      expect((await k.post('/api/testare/avsluta')).data.aktiv).toBe(false);
      expect((await k.get('/api/testare')).data.aktiv).toBe(false);
    } finally { t.stopp(); }
  });

  test(`panelens svar innehåller inga personnummer eller andra uppgifter ur sandlådans journaler`, async () => {
    const { k } = await borja('lakare-sjukhus');
    await k.get('/api/patient/p01');
    const svar = JSON.stringify((await k.get('/api/testare')).data);
    const db = sandlada(app, k).db;
    for (const p of db.query('SELECT personnummer FROM patienter').all()) expect(svar).not.toContain(p.personnummer);
    for (const a of db.query("SELECT DISTINCT substr(sokord, 1, 40) AS t FROM anteckningar WHERE length(sokord) > 60 LIMIT 50").all()) expect(svar).not.toContain(a.t);
  });

  test(`tabellerna i sandlådan klassas som systemets egna och följer inte med i ett uttag`, async () => {
    const { klassa } = await import('../src/lagring.js');
    const { k } = await borja('patient');
    const db = sandlada(app, k).db;
    const kl = klassa(db);
    expect(kl.testare.typ).toBe('system');
    expect(kl.testare_uppdrag.typ).toBe('system');
  });
});
