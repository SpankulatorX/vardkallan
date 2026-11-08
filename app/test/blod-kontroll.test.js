import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { BASTEST_TIMMAR } from '../src/labb-katalog.js';

// Transfusionskontrollen (runda 10, r6, säkerhetsgranskningen av 59e98d4): samma kontroll gäller när den inbyggda
// simulerade blodcentralen bereder blod och när blodcentralens producentsystem svarar att enheterna är beredda.
// Blodgruppering och bastest räknas bara ur beställningar och analyser som inte är makulerade eller borttagna, bastestet
// ska vara inom giltighetstiden, och ett positivt bastest stoppar om beställningen inte utreds. Ett svar som inte klarar
// kontrollen reserverar inget, och beställningen får en avvikelse i inkorgen hos den som beställde.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const delaSandlada = (fran, till) => { sandlada(app, till).db = sandlada(app, fran).db; };
const ps = async (metod, vag, nyckel, kropp) => {
  const res = await fetch(app.url + vag, { method: metod, headers: { Authorization: `Bearer ${nyckel}`, ...(kropp !== undefined ? { 'Content-Type': 'application/fhir+json' } : {}) }, body: kropp !== undefined ? JSON.stringify(kropp) : undefined });
  return { status: res.status, data: await res.json() };
};
const based = (ref) => [{ reference: ref }];
const SN = 'http://snomed.info/sct';

// Beställer erytrocyter, så att systemet beställer blodgruppering och bastest, och besvarar proverna: genom den
// simulerade labbet på den inbyggda vägen och genom producentsystemet på den externa.
async function forbered(extern) {
  const lak = await inloggad('lak-kard');
  let nyckel = null;
  if (extern) {
    const sysf = await inloggad('sysf');
    delaSandlada(lak, sysf);
    nyckel = (await sysf.post('/api/produktionssystem/lab-blod-uso/anslut', {})).data.nyckel;
  }
  const blod = (await lak.post('/api/patient/p04/blod', { produkt: 'erytrocyter', antal: 2, indikation: 'Hb 70.' })).data;
  const labbId = db(lak).query('SELECT labb_bestallning_id AS id FROM blod_bestallningar WHERE id = ?').get(blod.id).id;
  const best = (await lak.get('/api/patient/p04/prover')).data.bestallningar.find(x => x.id === labbId);
  for (const p of best.prov) await lak.post(`/api/labb/prov/${p.id}/tagen`, {});
  const gr = best.analyser.find(a => a.analys === 'blodgruppering');
  const bt = best.analyser.find(a => a.analys === 'bastest');
  const svara = async ({ bastest = true } = {}) => {
    if (!extern) {
      await lak.post(`/api/labb/${labbId}/simulera-svar`, {});
      db(lak).query("UPDATE labb_analyser SET svar_text = 'Blodgrupp A RhD positiv.' WHERE id = ?").run(gr.id);
      if (!bastest) db(lak).query("UPDATE labb_analyser SET status = 'mottagen', besvarad_tid = NULL, svar_text = NULL WHERE id = ?").run(bt.id);
      return;
    }
    expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: based(`ServiceRequest/labb-${gr.id}`), conclusion: 'Blodgrupp A RhD positiv.' })).status).toBe(201);
    if (bastest) expect((await ps('POST', '/ps/DiagnosticReport', nyckel, { resourceType: 'DiagnosticReport', status: 'final', basedOn: based(`ServiceRequest/labb-${bt.id}`), conclusionCode: [{ coding: [{ system: SN, code: '260385009' }] }] })).status).toBe(201);
  };
  return { lak, nyckel, blod, labbId, gr, bt, svara };
}

// Det blodcentralen gör: den inbyggda bereder när beställningen läses, producentsystemet svarar completed.
async function bered(x, grupp = 'A+') {
  if (!x.nyckel) return (await x.lak.get('/api/patient/p04/blod')).data.bestallningar.find(b => b.id === x.blod.id);
  const output = [{ type: { text: 'blodgrupp' }, valueString: grupp }, { type: { text: 'blodenhet' }, valueIdentifier: { value: 'E10000001' } }, { type: { text: 'blodenhet' }, valueIdentifier: { value: 'E10000002' } }];
  return ps('POST', '/ps/Task', x.nyckel, { resourceType: 'Task', status: 'completed', basedOn: based(`ServiceRequest/blod-${x.blod.id}`), output });
}

async function ingetReserverat(x, svar, orsak, { avvikelse = true } = {}) {
  if (x.nyckel) {
    expect(svar.status).toBe(400);
    expect(svar.data.issue[0].diagnostics).toContain(orsak);
  }
  const b = (await x.lak.get('/api/patient/p04/blod')).data.bestallningar.find(y => y.id === x.blod.id);
  expect(b.enheter).toEqual([]);
  expect(b.status).not.toBe('beredd');
  expect(db(x.lak).query('SELECT count(*) AS n FROM blod_enheter WHERE bestallning_id = ?').get(x.blod.id).n).toBe(0);
  const ik = (await x.lak.get('/api/inkorg')).data.blodAvvikelser;
  if (avvikelse) {
    expect(b.avvikelser.map(a => a.orsak).join(' ')).toContain(orsak);
    expect(ik.find(a => a.bestallningId === x.blod.id)).toMatchObject({ patient: { id: 'p04' } });
    expect(ik.find(a => a.bestallningId === x.blod.id).orsak).toContain(orsak);
  } else expect(ik.some(a => a.bestallningId === x.blod.id)).toBe(false);
}

describe('Transfusionskontroll', () => {
  for (const extern of [false, true]) {
    const vag = extern ? 'producentsystemet' : 'den inbyggda blodcentralen';

    test(`${vag}: giltig blodgruppering och färskt negativt bastest ger reserverade enheter`, async () => {
      const x = await forbered(extern);
      await x.svara();
      const r = await bered(x);
      if (extern) expect(r.status).toBe(200);
      const b = (await x.lak.get('/api/patient/p04/blod')).data.bestallningar.find(y => y.id === x.blod.id);
      expect(b.status).toBe('beredd');
      expect(b.enheter).toHaveLength(2);
      expect(b.avvikelser).toEqual([]);
    });

    test(`${vag}: bastest saknas`, async () => {
      const x = await forbered(extern);
      await x.svara({ bastest: false });
      // Den inbyggda blodcentralen väntar på bastestet som systemet redan har beställt. Producentsystemet får ett nej.
      await ingetReserverat(x, await bered(x), 'Bastestet väntar på svar', { avvikelse: extern });
    });

    test(`${vag}: bastestet är äldre än giltighetstiden`, async () => {
      const x = await forbered(extern);
      await x.svara();
      const gammal = new Date(Date.now() - (BASTEST_TIMMAR + 2) * 3600_000).toISOString();
      db(x.lak).query('UPDATE labb_prov SET provtagen_tid = ? WHERE id = (SELECT prov_id FROM labb_analyser WHERE id = ?)').run(gammal, x.bt.id);
      await ingetReserverat(x, await bered(x), 'inget giltigt bastest');
    });

    test(`${vag}: ett positivt bastest stoppar när beställningen inte utreds`, async () => {
      const x = await forbered(extern);
      await x.svara();
      db(x.lak).query("UPDATE labb_analyser SET avvikande = 'fynd', svar_text = 'Antikroppsscreening positiv.' WHERE id = ?").run(x.bt.id);
      await ingetReserverat(x, await bered(x), 'positivt');
      if (extern) {
        // När blodcentralen har utrett antikroppen kan den lämna ut förenligt blod.
        expect((await ps('POST', '/ps/Task', x.nyckel, { resourceType: 'Task', status: 'in-progress', basedOn: based(`ServiceRequest/blod-${x.blod.id}`), statusReason: { text: 'Antikropp utreds.' } })).status).toBe(200);
        expect((await bered(x)).status).toBe(200);
      } else {
        expect((await x.lak.get('/api/patient/p04/blod')).data.bestallningar.find(y => y.id === x.blod.id).status).toBe('utreds');
      }
    });

    test(`${vag}: en makulerad beställning med blodgruppering räknas inte`, async () => {
      const x = await forbered(extern);
      await x.svara();
      db(x.lak).query("UPDATE labb_bestallningar SET makulerad_tid = ?, makulerad_orsak = 'Fel patient.' WHERE id = ?").run(new Date().toISOString(), x.labbId);
      await ingetReserverat(x, await bered(x), 'blodgruppering');
    });

    test(`${vag}: en borttagen blodgruppering räknas inte`, async () => {
      const x = await forbered(extern);
      await x.svara();
      db(x.lak).query("UPDATE labb_analyser SET status = 'borttagen', borttagen_tid = ? WHERE id = ?").run(new Date().toISOString(), x.gr.id);
      await ingetReserverat(x, await bered(x), 'blodgruppering');
    });

    test(`${vag}: fel blodgrupp`, async () => {
      const x = await forbered(extern);
      await x.svara();
      if (extern) {
        // Enheterna har en blodgrupp som inte är förenlig med patientens.
        await ingetReserverat(x, await bered(x, 'B+'), 'inte förenlig');
      } else {
        // Två blodgrupperingar som inte stämmer överens: blod lämnas inte ut förrän det är utrett.
        const a = db(x.lak).query('SELECT * FROM labb_analyser WHERE id = ?').get(x.gr.id);
        db(x.lak).query("INSERT INTO labb_analyser (bestallning_id, patient_id, enhet_id, analys, lab_id, prov_id, status, mottagen_tid, besvarad_tid, svar_text) VALUES (?, ?, ?, 'blodgruppering', ?, ?, 'besvarad', ?, ?, 'Blodgrupp B RhD positiv.')")
          .run(a.bestallning_id, a.patient_id, a.enhet_id, a.lab_id, a.prov_id, a.mottagen_tid, new Date().toISOString());
        await ingetReserverat(x, await bered(x), 'stämmer inte');
      }
    });
  }

  test('avvikelsen kvitteras av den som beställde, och en annan läkare ser den inte', async () => {
    const x = await forbered(true);
    await x.svara({ bastest: false });
    await bered(x);
    const id = (await x.lak.get('/api/inkorg')).data.blodAvvikelser.find(a => a.bestallningId === x.blod.id).id;
    const annan = await inloggad('lak-vc');
    delaSandlada(x.lak, annan);
    expect((await annan.get('/api/inkorg')).data.blodAvvikelser).toEqual([]);
    expect((await annan.post(`/api/blod/avvikelse/${id}/kvittera`, {})).status).toBe(403);
    expect((await x.lak.post(`/api/blod/avvikelse/${id}/kvittera`, {})).status).toBe(200);
    expect((await x.lak.get('/api/inkorg')).data.blodAvvikelser).toEqual([]);
  });
});
