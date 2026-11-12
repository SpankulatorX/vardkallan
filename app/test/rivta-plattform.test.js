import { describe, test, expect } from 'bun:test';
import { nyDb } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';
import * as plattform from '../src/rivta/plattform.js';

// Runda 14, r2: ett anrop från början till slut genom en lokal tjänsteplattform som följer profilen (plattform.js):
// konsumenten anropar plattformen med ömsesidig TLS, plattformen prövar anropsbehörigheten och vägvalet i en lokal
// TAK-tabell och skickar anropet vidare till Vårdkällans producent med sitt eget certifikat och den ursprungliga
// konsumenten i huvudet. Allt med testcertifikat från en test-CA, aldrig SITHS.

const VG = 'SE2321000164-VK0000';
const DIA = rivta.journal.GET_DIAGNOSIS;
const DOK = rivta.journal.GET_CARE_DOCUMENTATION;
const fraga = { patientId: { id: '194502024732', type: '1.2.752.129.2.1.3.1' } };

describe('Tjänstekontrakt i RIVTA, tjänsteplattform', () => {
  test('ett anrop går från konsumenten genom den lokala tjänsteplattformen till producenten med anropsbehörighet och vägval', async () => {
    const db = nyDb();
    const ca = rivta.testCa();
    const producentCert = ca.utfarda({ hsaId: 'SE0000000000-VKPRODUCENT', cn: 'Vårdkällan producent' });
    const vpCert = ca.utfarda({ hsaId: 'SE0000000000-LOKALVP', cn: 'Lokal tjänsteplattform' });
    const npo = ca.utfarda({ hsaId: rivta.konsumenter.NPO, cn: 'Simulerad NPÖ' });
    const okand = ca.utfarda({ hsaId: 'SE0000000000-OKAND', cn: 'Okänd konsument' });
    const producent = await rivta.tls.starta({ cert: producentCert.cert, key: producentCert.key, ca: ca.cert, plattformar: [vpCert.fingeravtryck], hantera: rivta.tls.tjanstHanterare(rivta.vardkallan, { db }) });
    const tak = {
      anropsbehorigheter: [{ konsument: rivta.konsumenter.NPO, kontrakt: DIA.begaran.ns, logiskAdress: VG }, { konsument: 'SE0000000000-OKAND', kontrakt: DIA.begaran.ns, logiskAdress: VG }],
      vagval: [{ kontrakt: DIA.begaran.ns, logiskAdress: VG, adress: `https://127.0.0.1:${producent.port}` }],
    };
    const vp = await plattform.starta({ cert: vpCert.cert, key: vpCert.key, ca: ca.cert, tak });
    try {
      const via = (c) => rivta.https({ bas: `https://127.0.0.1:${vp.port}`, cert: c.cert, key: c.key, ca: ca.cert });
      const svar = await rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga, transport: via(npo) });
      expect(svar.result.resultCode).toBe('OK');
      expect(svar.diagnosis.length).toBeGreaterThan(0);
      // Producenten såg den ursprungliga konsumenten bakom plattformen.
      expect(rivta.anropslogg(db).find(r => r.riktning === 'in' && r.resultat === 'ok')).toMatchObject({ organisation: rivta.konsumenter.NPO, via: 'tjänsteplattform', kontrakt: 'GetDiagnosis' });
      // Ingen anropsbehörighet i TAK: VP007. Inget vägval: VP004. Behörighet i TAK men inte hos producenten: producentens fel.
      await expect(rivta.anropa(DOK, { logiskAdress: VG, begaran: fraga, transport: via(npo) })).rejects.toThrow('VP007');
      tak.anropsbehorigheter.push({ konsument: rivta.konsumenter.NPO, kontrakt: DOK.begaran.ns, logiskAdress: VG });
      await expect(rivta.anropa(DOK, { logiskAdress: VG, begaran: fraga, transport: via(npo) })).rejects.toThrow('VP004');
      await expect(rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga, transport: via(okand) })).rejects.toThrow('ingen anropsbehörighet');
    } finally { await vp.stopp(); await producent.stopp(); }
  });

  test('alla producenter och konsumenter i Vårdkällan går genom den lokala tjänsteplattformen', async () => {
    const db = nyDb();
    const ca = rivta.testCa();
    const c = (hsaId, cn) => ca.utfarda({ hsaId, cn });
    const vkCert = c(VG, 'Vårdkällan');
    const simCert = c('SE0000000000-SIMNATIONELL', 'Simulerade nationella tjänster');
    const vpCert = c('SE0000000000-LOKALVP', 'Lokal tjänsteplattform');
    const sjf = c(rivta.konsumenter.SJF, 'Simulerad aggregerande tjänst');
    const vk = await rivta.tls.starta({ cert: vkCert.cert, key: vkCert.key, ca: ca.cert, plattformar: [vpCert.fingeravtryck], hantera: rivta.tls.tjanstHanterare(rivta.vardkallan, { db }) });
    const sim = await rivta.tls.starta({ cert: simCert.cert, key: simCert.key, ca: ca.cert, plattformar: [vpCert.fingeravtryck], hantera: rivta.tls.tjanstHanterare(rivta.nationella.tjanst, { db }) });
    const N = rivta.nationella.NATIONELL;
    const producenter = rivta.vardkallan.producenter();
    const konsument = Object.values({ ...rivta.nationella.K, HSA: rivta.register.HSA, PU: rivta.register.PU, EI: rivta.register.EI });
    const tak = {
      anropsbehorigheter: [...producenter.map(d => ({ konsument: rivta.konsumenter.SJF, kontrakt: d.begaran.ns, logiskAdress: VG })), ...konsument.map(d => ({ konsument: VG, kontrakt: d.begaran.ns, logiskAdress: N }))],
      vagval: [...producenter.map(d => ({ kontrakt: d.begaran.ns, logiskAdress: VG, adress: `https://127.0.0.1:${vk.port}` })), ...konsument.map(d => ({ kontrakt: d.begaran.ns, logiskAdress: N, adress: `https://127.0.0.1:${sim.port}` }))],
    };
    const vp = await plattform.starta({ cert: vpCert.cert, key: vpCert.key, ca: ca.cert, tak });
    try {
      const via = (cert) => rivta.https({ bas: `https://127.0.0.1:${vp.port}`, cert: cert.cert, key: cert.key, ca: ca.cert });
      // Vårdkällans producenter, anropade av den simulerade aggregerande tjänsten.
      const J = rivta.journal;
      for (const d of [J.GET_DIAGNOSIS, J.GET_CARE_DOCUMENTATION, J.GET_ALERT_INFORMATION, J.GET_CARE_CONTACTS]) {
        const svar = await rivta.anropa(d, { logiskAdress: VG, begaran: fraga, transport: via(sjf) });
        expect([d.namn, Object.keys(svar).length > 0]).toEqual([d.namn, true]);
      }
      const tgp = await rivta.anropa(J.ASSERT_CARE_ENGAGEMENT, { logiskAdress: VG, transport: via(sjf), begaran: { performer: db.query("SELECT hsa_id FROM personal WHERE id = 'lak-kard'").get().hsa_id, subjectOfCareId: '194502024732', careUnitHsaIdentity: 'SE2321000164-VK0120', careGiverHsaIdentity: VG } });
      expect(tgp.HasCareEngagement).toBe(true);
      // Vårdkällan som konsument av de simulerade nationella tjänsterna.
      const K = rivta.nationella.K;
      const ut = (d, begaran) => rivta.anropa(d, { logiskAdress: N, begaran, transport: via(vkCert), db });
      expect((await ut(K.GetCareDocumentation, fraga)).careDocumentation.length).toBeGreaterThan(0);
      expect((await ut(K.GetAllBlocksForPatient, { PatientId: '194502024732' })).BlockHeaderType.Blocks.length).toBeGreaterThan(0);
      expect((await ut(K.CheckConsent, { AccessingActor: { EmployeeId: 'X', CareProviderId: VG, CareUnitId: 'SE2321000164-VK0120' }, PatientId: '194502024732' })).CheckResultType.HasConsent).toBe(false);
      expect((await ut(rivta.register.HSA, { personHsaId: db.query("SELECT hsa_id FROM personal WHERE id = 'lak-kard'").get().hsa_id })).personInformation.length).toBe(1);
      expect((await ut(rivta.register.PU, { personId: ['194502024732'], lookUpSpecification: {} })).resident.length).toBe(1);
    } finally { await vp.stopp(); await vk.stopp(); await sim.stopp(); }
  });
});
