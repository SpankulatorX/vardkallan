// Runda 13, r3: rättelser från det utforskande testet (E1-19, E2-13, E2-16 och E2-20). Kritiska värden och hög NEWS2
// ska synas där personalen tittar: arbetslistans larm, översiktens mätvärden och intensivvårdens översikt. Testerna
// lägger in sina egna värden med tider räknade från nu, så att de inte beror på klockan.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, personal } from './hjalp.js';
import { byggSeed } from '../src/db.js';
import * as vitalparametrar from '../src/vitalparametrar.js';
import * as iva from '../src/iva.js';
import * as journal from '../src/journal.js';
import { nyPatient } from './specialist.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const TIMME = 3600_000;
// En hel NEWS2-omgång med 0 poäng för en patient, tagen för så många timmar sedan.
function news2Omgang(db, pid, enhet, timmarSedan) {
  const t = new Date(Date.now() - timmarSedan * TIMME).toISOString();
  const rad = (typ, varde, enh = null) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(pid, enhet, typ, String(varde), typeof varde === 'number' ? varde : null, enh, t, 'ssk-kard');
  rad('andningsfrekvens', 16); rad('saturation', 97, '%'); rad('syrgas', 0); rad('blodtryck', '130/80', 'mmHg'); rad('puls', 72, '/min'); rad('medvetande', 'A'); rad('temp', 37.0, 'Cel');
}

describe('Larm där personalen tittar', () => {
  test('arbetslistan visar hög NEWS2 och kritiska provsvar som larm, med text', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = sandlada(app, k).db;
    const ssk = personal(db, 'ssk-kard');
    const vitala = vitalparametrar.larmForInkorg(db, ssk);
    expect(vitala.length).toBeGreaterThan(0);
    const lista = (await k.get('/api/arbetslista')).data;
    for (const l of vitala) {
      const rad = lista.find(p => p.id === l.patientId);
      expect(rad.larm).toBeGreaterThan(0);
      expect(rad.larmText).toContain(l.rubrik);
    }
    // Ett kritiskt provsvar som inte är vidimerat (kalium 6,4 för p04 i demon).
    const kritisk = db.query("SELECT b.patient_id FROM labb_analyser a JOIN labb_bestallningar b ON b.id = a.bestallning_id WHERE a.kritisk = 1 AND a.vidimerad_tid IS NULL AND a.status = 'besvarad'").get();
    expect(kritisk).not.toBeNull();
    const rad = lista.find(p => p.id === kritisk.patient_id);
    expect(rad.larm).toBeGreaterThan(0);
    expect(rad.larmText.join(' ')).toContain('Kritiskt provsvar');
  });

  test('en inneliggande patient vars kontroll enligt NEWS2 har uteblivit larmar i inkorgen och arbetslistan', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const db = sandlada(app, k).db;
    nyPatient(db, { id: 'larm1', enhet: 'uso-kard-72', ar: 1960, start: new Date(Date.now() - 20 * TIMME) });
    // NEWS2 0 ger kontroll inom tolv timmar. Omgången togs för 14 timmar sedan.
    news2Omgang(db, 'larm1', 'uso-kard-72', 14);
    const l = vitalparametrar.larmForInkorg(db, personal(db, 'ssk-kard')).find(x => x.patientId === 'larm1');
    expect(l).toMatchObject({ forsenad: true, rubrik: 'Kontrollen enligt NEWS2 är försenad' });
    const rad = (await k.get('/api/arbetslista')).data.find(p => p.id === 'larm1');
    expect(rad.larmText).toContain('Kontrollen enligt NEWS2 är försenad');
    // En ny omgång i tid tar bort larmet.
    news2Omgang(db, 'larm1', 'uso-kard-72', 1);
    expect(vitalparametrar.larmForInkorg(db, personal(db, 'ssk-kard')).some(x => x.patientId === 'larm1')).toBe(false);
  });

  test('ett värde utanför referensintervallet och ett kritiskt värde markeras i översiktens mätvärden', () => {
    const db = byggSeed();
    const rad = (varde) => ({ id: 1, patient_id: 'p04', enhet_id: 'uso-kard-72', typ: 'kalium', varde: String(varde), varde_num: varde, matt_enhet: 'mmol/L', tid: new Date().toISOString(), kalla: 'vardkallan' });
    expect(journal.matvardeUt(db, rad(6.4))).toMatchObject({ avvikande: 'kritiskt_hogt', avvikandeText: 'Kritiskt högt' });
    expect(journal.matvardeUt(db, rad(5.2)).avvikande).toBe('hogt');
    expect(journal.matvardeUt(db, rad(4.0)).avvikande).toBeUndefined();
  });

  test('intensivvården larmar för en patient utan godkända värden på mer än två timmar, med det senaste värdet', () => {
    const nu = new Date('2026-11-11T21:00:00Z');
    const m = (typ, varde, timmar) => ({ id: timmar, typ, varde: String(varde), varde_num: varde, tid: new Date(nu.getTime() - timmar * TIMME).toISOString(), kalla: 'vardkallan' });
    const l = iva.kontrollSaknas([m('puls', 132, 10.75)], nu);
    expect(l).toMatchObject({ niva: 'larm', regel: 'kontroll_saknas' });
    expect(l.text).toContain('10 timmar');
    expect(l.text).toContain('132');
    expect(iva.kontrollSaknas([m('puls', 80, 1)], nu)).toBeNull();
    expect(iva.kontrollSaknas([], nu).text).toContain('Inga godkända värden');
  });
});
