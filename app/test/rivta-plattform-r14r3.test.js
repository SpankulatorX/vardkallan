// Runda 14, r3: del r3:s tjänstekontrakt genom den lokala tjänsteplattformen (rivta/plattform.js), med ömsesidig TLS och
// testcertifikat från en test-CA, aldrig SITHS. Plattformen prövar anropsbehörigheten och vägvalet i en lokal TAK-tabell
// och skickar anropet vidare med den ursprungliga konsumenten i huvudet. Varje kontrakt anropas en gång åt varje håll
// som Vårdkällan har en roll i, också profil 2.0 med wsa:To.
import { describe, test, expect } from 'bun:test';
import { nyDb, atk, personal } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';
import * as plattform from '../src/rivta/plattform.js';
import * as r3 from '../src/rivta-r3.js';
import * as intyg from '../src/lakarintyg.js';
import * as intygsapp from '../src/intygsapplikation-simulerad.js';
import * as eremiss from '../src/eremiss.js';
import * as eremissSim from '../src/eremiss-simulerad.js';
import * as et from '../src/rivta-etjanster.js';
import * as etSim from '../src/rivta-etjanster-simulerade.js';
import * as dos from '../src/rivta-dos.js';
import * as dosSim from '../src/rivta-dos-simulerad.js';
import * as inf from '../src/rivta-infektion.js';
import * as infSim from '../src/rivta-infektion-simulerad.js';
import * as vacc from '../src/rivta-vaccination.js';

const VG = 'SE2321000164-VK0000';

describe('Del r3:s tjänstekontrakt genom tjänsteplattformen', () => {
  test('Plattform > intyg, e-remiss, formulär, 1177, NKRR, dos, Infektionsverktyget och vaccinationer går genom den lokala tjänsteplattformen', async () => {
    const db = nyDb();
    const ca = rivta.testCa();
    const cert = (hsaId, cn) => ca.utfarda({ hsaId, cn });
    const vpCert = cert('SE0000000000-LOKALVP', 'Lokal tjänsteplattform');
    const vkCert = cert(VG, 'Vårdkällan');
    const pf = [vpCert.fingeravtryck];
    const vc = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    // Tjänsterna: Vårdkällans producenter för vårdgivaren och för vårdenheterna, och de simulerade motparterna.
    const tjanster = [
      ['vk', rivta.vardkallan, vkCert], ['vkenheter', r3.vardenheter, vkCert],
      ['intyg', intygsapp.tjanst, cert(intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, 'Intygsapplikation (simulerad)')],
      ['eremiss', eremissSim.tjanst, cert('SE-DEMO-HSA-0002', 'Extern vårdgivare (simulerad)')],
      ['formular', etSim.formular, cert(et.ADRESS.formular, 'Formulärtjänst (simulerad)')], ['portal', etSim.portal, cert(et.ADRESS.portal, '1177 (simulerad)')],
      ['nkrr', etSim.nkrr, cert(et.ADRESS.nkrr, 'NKRR (simulerad)')], ['dos', dosSim.tjanst, cert('SE0000000000-SIMDOS', 'Dosapotek (simulerat)')],
      ['infektion', infSim.tjanst, cert('SE0000000000-SIMINFEKTION', 'Infektionsverktyget (simulerat)')],
    ];
    const servrar = {};
    for (const [n, t, c] of tjanster) servrar[n] = await rivta.tls.starta({ cert: c.cert, key: c.key, ca: ca.cert, plattformar: pf, hantera: rivta.tls.tjanstHanterare(t, { db }) });
    const adress = (n) => `https://127.0.0.1:${servrar[n].port}`;
    // TAK: [konsumentens HSA-id, kontraktet, logisk adress, tjänst].
    const rader = [
      [VG, intyg.DEF.skapa(), intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, 'intyg'], [VG, intyg.DEF.lista(), intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, 'intyg'],
      [intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, intyg.DEF.status(), vc, 'vkenheter'],
      ['SE-DEMO-HSA-0002', eremiss.DEF.remiss(), vc, 'vkenheter'], [VG, eremiss.DEF.besked(), 'SE-DEMO-HSA-0002', 'eremiss'],
      [VG, et.DEF.skapaFormular(), et.ADRESS.formular, 'formular'], [VG, et.DEF.arAktiv(), et.ADRESS.portal, 'portal'], [VG, et.DEF.registrering(), et.ADRESS.nkrr, 'nkrr'],
      [VG, dos.DEF.hamta(), dos.DOSAPOTEK.gln, 'dos'], [VG, inf.DEF.tillstand(), inf.LOGISK_ADRESS, 'infektion'],
      [rivta.konsumenter.SJF, vacc.DEF(), VG, 'vk'],
    ];
    const tak = {
      anropsbehorigheter: rader.map(([k, d, a]) => ({ konsument: k, kontrakt: d.begaran.ns, logiskAdress: a })),
      vagval: rader.map(([, d, a, n]) => ({ kontrakt: d.begaran.ns, logiskAdress: a, adress: adress(n) })),
    };
    const vp = await plattform.starta({ cert: vpCert.cert, key: vpCert.key, ca: ca.cert, tak });
    const certFor = Object.fromEntries(tjanster.map(([n, , c]) => [n, c]));
    try {
      const via = (c) => rivta.https({ bas: `https://127.0.0.1:${vp.port}`, cert: c.cert, key: c.key, ca: ca.cert });
      const ut = (d, logiskAdress, begaran, c = vkCert) => rivta.anropa(d, { logiskAdress, begaran, transport: via(c), db });
      const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
      const pid = intyg.personId(p);
      // Intyg: utkastet och listan genom plattformen, och en statusuppdatering från intygsapplikationen till vårdenheten.
      const skapat = await ut(intyg.DEF.skapa(), intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, intyg.skapaUtkastBegaran({ typ: 'LISJP', patient: p, pid, personal: personal(db, 'lak-vc'), enhet: { hsa_id: vc, namn: 'Vårdcentralen' }, ref: 'VK-INTYG-plattform' }));
      expect(skapat.result.resultCode).toBe('OK');
      expect((await ut(intyg.DEF.lista(), intyg.LOGISK_ADRESS_INTYGSAPPLIKATION, intyg.listaBegaran({ pid, enhetHsa: vc }))).list).toBeTruthy();
      const rad = await intyg.skapa(atk(db, 'lak-vc', 'p11', {}, 'skriv_intyg'), p, { typ: 'LISJP' }, '2026-11-12');
      const sim = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(rad.oppna.split('/').pop());
      const h = (x) => ({ root: intyg.KV.hsa, extension: x });
      const status = await ut(intyg.DEF.status(), vc, {
        intyg: { 'intygs-id': { root: vc, extension: sim.intygs_id }, typ: { code: 'LISJP', codeSystem: intyg.KV.intygstyp }, version: '1.0',
          patient: { 'person-id': pid, fornamn: 'A', efternamn: 'B', postadress: '', postnummer: '', postort: '' },
          skapadAv: { 'personal-id': h(sim.personal_hsa), fullstandigtNamn: 'C', enhet: { 'enhets-id': h(vc), arbetsplatskod: { root: '1.2.752.29.4.71', extension: 'D' }, enhetsnamn: 'E', postadress: '', postnummer: '', postort: '', telefonnummer: '0', vardgivare: { 'vardgivare-id': h(VG), vardgivarnamn: 'V' } } } },
        handelse: { handelsekod: { code: 'KFSIGN', codeSystem: intyg.KV.handelse }, tidpunkt: '2026-11-12T10:00:00.000' },
        skickadeFragor: { totalt: 0, ejBesvarade: 0, besvarade: 0, hanterade: 0 }, mottagnaFragor: { totalt: 0, ejBesvarade: 0, besvarade: 0, hanterade: 0 }, ref: sim.ref,
      }, certFor.intyg);
      expect(status.result.resultCode).toBe('OK');
      // E-remiss: en remiss från den externa vårdgivaren till vårdenheten, och mottagningsbekräftelsen tillbaka.
      const req = 'SE-DEMO-HSA-0002#plattform';
      db.query("INSERT INTO sim_eremiss (request_id, patient_id, enhet_id, riktning, sim_hsa, vk_hsa, personnummer, status, tid) VALUES (?, 'p11', 'vc-tybble', 'fran_sim', 'SE-DEMO-HSA-0002', ?, ?, 'skickad', '2026-11-12T10:00:00Z')").run(req, vc, pid.extension);
      const remiss = await ut(eremiss.DEF.remiss(), vc, eremiss.remissBegaran({ requestId: req, patient: p, pid, avsandare: { hsa_id: 'L', namn: 'Remittent' }, enhet: { hsa_id: 'SE-DEMO-HSA-0002', namn: 'Läkarhuset Ekbacken' },
        mottagareHsa: vc, fragestallning: 'Bedömning via tjänsteplattformen.', datum: '20261112', tid: '20261112100000' }), certFor.eremiss);
      expect(remiss.result.resultCode).toBe('OK');
      const remissId = db.query('SELECT remiss_id FROM eremisser WHERE request_id = ?').get(req).remiss_id;
      expect(db.query('SELECT status FROM remisser WHERE id = ?').get(remissId).status).toBe('skickad');
      const besked = await ut(eremiss.DEF.besked(), 'SE-DEMO-HSA-0002', { requestConfirmation: {
        requestId: { '@extension': req }, requestConfirmationId: { '@extension': `${vc}#1` }, typeOfRequestConfirmation: { '@code': 'BEK' }, requestVersionNumber: '1', requestConfirmationTime: { '@value': '20261112100000' },
        patient: { personId: { '@extension': pid.extension, '@root': pid.root } }, confirmingOrganisation: { careUnitId: { '@extension': vc } },
        author: { healthcareProfessional: { name: 'N' }, healthcareProfessionalOrganisation: { careUnitId: { '@extension': vc } } }, recipient: { organisation: { careUnitId: { '@extension': 'SE-DEMO-HSA-0002' } } },
        outcome: { outcomeText: 'Mottagen.' } } });
      expect(besked.result.resultCode).toBe('OK');
      // Formulär, 1177, NKRR, dos och Infektionsverktyget som konsument.
      expect((await ut(et.DEF.skapaFormular(), et.ADRESS.formular, { formRequests: [{ expireDate: '2026-11-26', healthcare_facility_CareUnit: vc, keepUntil: '2026-12-26', subjectOfCare: pid.extension, templateId: 'halsodeklaration' }] })).resultCode).toBe('OK');
      expect((await ut(et.DEF.arAktiv(), et.ADRESS.portal, { subjectOfCareId: pid.extension })).resultCode).toBe('OK');
      expect((await ut(et.DEF.registrering(), et.ADRESS.nkrr, { patientId: [{ root: pid.extension }], healthcareProviderId: { root: VG } })).result.resultCode).toBe('OK');
      const pers = personal(db, 'lak-vc');
      expect((await ut(dos.DEF.hamta(), dos.DOSAPOTEK.gln, { glnkod: dos.DOSAPOTEK.gln, Behorighetsinformation: { fornamn: 'A', efternamn: 'B', arbetsplatskod: 'DEMO0000', hsaid: pers.hsa_id }, identitetstyp: 'P', personid: pid.extension })).resultatkod).toBe('1');
      const el = inf.bygg('tillstand', { logical_address: inf.LOGISK_ADRESS, personid: pid.extension, 'person-id': pid.extension, oid_personid: pid.root, issuer_personid: 'Skatteverket', assigner_personid: 'Folkbokföringen',
        födelsetidpunkt: `${p.fodd}T00:00:00`, kön: '2', vårdgivare: VG, 'registrerande enhet': vc, tillståndsid: 'D-plattform', tillståndskod: 'N300', tillståndstid: '2026-11-10T00:00:00' });
      expect((await ut(inf.DEF.tillstand(), inf.LOGISK_ADRESS, el)).ResultCode).toBe('OK');
      // Vaccinationerna, med den aggregerande tjänsten som konsument av Vårdkällan.
      const v = db.query("SELECT p.personnummer FROM vaccinationer x JOIN patienter p ON p.id = x.patient_id WHERE p.skyddad = 0 LIMIT 1").get();
      const sjf = cert(rivta.konsumenter.SJF, 'Simulerad aggregerande tjänst');
      expect((await ut(vacc.DEF(), VG, { patientId: { id: v.personnummer, type: '1.2.752.129.2.1.3.1' } }, sjf)).result.resultCode).toBe('OK');
      // Producenterna såg den ursprungliga konsumenten bakom plattformen.
      const in1 = rivta.anropslogg(db, { max: 500 }).filter(r => r.riktning === 'in' && r.via === 'tjänsteplattform');
      expect(in1.map(r => r.kontrakt)).toEqual(expect.arrayContaining(['CertificateStatusUpdateForCare', 'ProcessRequest', 'ProcessRequestConfirmation', 'CreateDraftCertificate', 'HamtaVardtagareinformation', 'ProcessCondition', 'GetVaccinationHistory']));
      // Ett anrop som inte står i TAK stoppas av plattformen.
      await expect(ut(et.DEF.meddelande(), et.ADRESS.portal, { subjectOfCareId: pid.extension, message: { organisationUnit: { unitId: { root: 'x', extension: vc } } }, notify: true, approve: false, accountableOrganisation: { root: 'x', extension: VG } })).rejects.toThrow('VP007');
    } finally {
      await vp.stopp();
      for (const s of Object.values(servrar)) await s.stopp();
    }
  }, 30_000);
});
