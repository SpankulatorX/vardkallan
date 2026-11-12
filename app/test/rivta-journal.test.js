import { describe, test, expect } from 'bun:test';
import { nyDb } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';
import { fhirResurser } from '../src/tjanstekontrakt.js';
import * as systemkonton from '../src/systemkonton.js';

// Runda 14, r2: Vårdkällan som producent för NPÖ, Journalen och sammanhållen journalföring (Sussa 2.2.1.7, 2.2.1.8 och
// 2.2.1.10) mot de pinnade tjänstekontrakten. Svaren byggs och valideras mot schemat i producenten och igen i
// konsumenten, och de innehåller precis det som den anropande organisationens systemkonto får läsa i FHIR-API:t.

const VG = 'SE2321000164-VK0000';
const J = rivta.journal;
const fraga = (pnr, extra = {}) => ({ patientId: { id: pnr, type: '1.2.752.129.2.1.3.1' }, ...extra });
const anropa = (db, def, begaran, hsaId = rivta.konsumenter.NPO) => rivta.anropa(def, { logiskAdress: VG, begaran, db,
  transport: rivta.iProcessen(rivta.vardkallan, { ctx: { db }, avsandare: { hsaId, via: 'direkt' } }) });
const konto = (db, hsaId = rivta.konsumenter.NPO) => rivta.konsumenter.prova(db, { hsaId }, { namn: 'GetDiagnosis' }).konsument.personal;
const fhirAntal = (db, kontrakt, pid, typer) => fhirResurser({ db, personal: konto(db) }, kontrakt, pid, { typer }).length;

describe('Tjänstekontrakt i RIVTA, journalen', () => {
  test('GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med det som organisationens systemkonto får läsa i FHIR', async () => {
    const db = nyDb();
    const dok = await anropa(db, J.GET_CARE_DOCUMENTATION, fraga('194502024732'));
    expect(dok.result.resultCode).toBe('OK');
    expect(dok.careDocumentation.length).toBe(fhirAntal(db, 'GetCareDocumentation', 'p01', ['Composition']));
    expect(dok.careDocumentation.every(x => typeof x.careDocumentationBody.clinicalDocumentNote.clinicalDocumentNoteText === 'string')).toBe(true);
    expect(dok.careDocumentation[0].careDocumentationHeader).toMatchObject({ sourceSystemHSAid: VG, patientId: { id: '194502024732' } });
    const upp = await anropa(db, J.GET_ALERT_INFORMATION, fraga('194502024732'));
    expect(upp.alertInformation.length).toBe(fhirAntal(db, 'GetAlertInformation', 'p01', ['Flag', 'AllergyIntolerance']));
    expect(upp.alertInformation.some(x => x.alertInformationBody.hypersensitivity)).toBe(true);
    const kon = await anropa(db, J.GET_CARE_CONTACTS, fraga('194502024732'));
    expect(kon.careContact.length).toBeGreaterThan(0);
    expect(kon.careContact.length).toBeLessThanOrEqual(fhirAntal(db, 'GetCareContacts', 'p01', ['Encounter']));
    expect(kon.careContact.some(x => x.careContactBody.careContactCode === '3' && x.careContactBody.careContactOrgUnit.orgUnitHSAId === 'SE2321000164-VK0120')).toBe(true);
    // Filter på vårdenhet och period.
    const enhet = await anropa(db, J.GET_CARE_CONTACTS, fraga('194502024732', { careUnitHSAId: ['SE2321000164-VK0110'] }));
    expect((enhet.careContact ?? []).every(x => x.careContactBody.careContactOrgUnit.orgUnitHSAId === 'SE2321000164-VK0110')).toBe(true);
    expect((await anropa(db, J.GET_CARE_CONTACTS, fraga('194502024732', { timePeriod: { start: '20990101', end: '20991231' } }))).careContact).toBeUndefined();
    // Varje anrop ut och in finns i anropsloggen.
    expect(rivta.anropslogg(db).filter(r => r.kontrakt === 'GetCareContacts' && r.resultat === 'ok').length).toBe(6);
  });

  test('journalens producenter lämnar aldrig ut skyddade personuppgifter eller spärrade uppgifter', async () => {
    const db = nyDb();
    for (const def of [J.GET_CARE_DOCUMENTATION, J.GET_ALERT_INFORMATION, J.GET_CARE_CONTACTS, J.GET_DIAGNOSIS]) {
      const skyddad = JSON.stringify(await anropa(db, def, fraga('198404162383'))).replace(/"logId":"\w+"/, '');
      const finnsInte = JSON.stringify(await anropa(db, def, fraga('191212121212'))).replace(/"logId":"\w+"/, '');
      expect([def.namn, skyddad]).toEqual([def.namn, finnsInte]);
      const sparr = JSON.stringify(await anropa(db, def, fraga('197701182383')));
      expect([def.namn, sparr.includes('SE2321000164-VK0160')]).toEqual([def.namn, false]);
    }
    // Journalanteckningar och åtgärder kan bara en anslutning via tjänstekontrakt få, aldrig ett konto för det öppna API:t.
    for (const m of ['anteckningar', 'atgarder']) expect(() => systemkonton.forslag(db, { mangder: [m], vardenheter: ['uso-kard'] })).toThrow('finns inte för systemkonton');
    expect(systemkonton.forslag(db, { mangder: ['anteckningar'], vardenheter: ['uso-kard'] }, { tjanstekontrakt: true }).omfang).toContain('system/Composition.rs');
    // En organisation som inte är ansluten får ett fel och ingen uppgift.
    await expect(anropa(db, J.GET_CARE_DOCUMENTATION, fraga('194502024732'), 'SE0000000000-OKAND')).rejects.toThrow('ingen anropsbehörighet');
  });

  test('AssertCareEngagement svarar om personen har vårdrelation till patienten, med behörighetsmotorns regel', async () => {
    const db = nyDb();
    const hsa = (id) => db.query('SELECT hsa_id FROM personal WHERE id = ?').get(id).hsa_id;
    const fraga = (pnr, person, enhet, vg = VG) => anropa(db, J.ASSERT_CARE_ENGAGEMENT, { performer: hsa(person), subjectOfCareId: pnr, careUnitHsaIdentity: enhet, careGiverHsaIdentity: vg }, rivta.konsumenter.SJF);
    const loggen = () => db.query("SELECT grund, resultat FROM atkomstlogg WHERE resurs LIKE 'rivta/AssertCareEngagement%' ORDER BY id DESC LIMIT 1").get();
    const antal = () => db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs LIKE 'rivta/AssertCareEngagement%'").get().n;
    expect((await fraga('194502024732', 'lak-kard', 'SE2321000164-VK0120')).HasCareEngagement).toBe(true);
    expect(loggen()).toEqual({ grund: 'systemkonto', resultat: 'tillaten' });
    // Fel vårdenhet för personen ger nej, men frågan är tillåten.
    expect((await fraga('194502024732', 'lak-kard', 'SE2321000164-VK0150')).HasCareEngagement).toBe(false);
    expect(loggen()).toEqual({ grund: 'systemkonto', resultat: 'tillaten' });
    // Fel vårdgivare och skyddade personuppgifter: nej, och nekat i loggen.
    expect((await fraga('194502024732', 'lak-kard', 'SE2321000164-VK0120', 'SE0000000000-ANNAN')).HasCareEngagement).toBe(false);
    expect(loggen()).toEqual({ grund: 'nekad', resultat: 'nekad' });
    expect((await fraga('198404162383', 'lak-kard', 'SE2321000164-VK0120')).HasCareEngagement).toBe(false);
    expect(loggen()).toEqual({ grund: 'nekad', resultat: 'nekad' });
    // En identitet som inte är ett personnummer eller samordningsnummer med tolv siffror ger nej utan uppslag. En form
    // som schemat inte tillåter ger ett fel redan i valideringen.
    const fore = antal();
    expect((await fraga('19450202T732', 'lak-kard', 'SE2321000164-VK0120')).HasCareEngagement).toBe(false);
    expect((await fraga('191212121212', 'lak-kard', 'SE2321000164-VK0120')).HasCareEngagement).toBe(false);
    expect(antal()).toBe(fore);
    await expect(fraga('19450202-4732', 'lak-kard', 'SE2321000164-VK0120')).rejects.toThrow('följer inte schemat');
    await expect(fraga('urn:oid:1.2.752.129.2.1.3.1|194502024732', 'lak-kard', 'SE2321000164-VK0120')).rejects.toThrow('följer inte schemat');
    // En spärrad vårdenhet ger nej, också när patienten har samtyckt till sammanhållen journalföring på enheten.
    db.query("INSERT INTO sammanhallen_samtycken (patient_id, enhet_id, registrerat, registrerat_av) VALUES ('p01', 'uso-kard', ?, 'lak-kard')").run(new Date().toISOString());
    db.query("INSERT INTO sparrar (patient_id, enhet_id, aktiv, registrerad) VALUES ('p01', 'uso-kard', 1, ?)").run(new Date().toISOString());
    expect((await fraga('194502024732', 'lak-kard', 'SE2321000164-VK0120')).HasCareEngagement).toBe(false);
    expect(loggen()).toEqual({ grund: 'nekad', resultat: 'nekad' });
    // En vårdenhet som kontot inte omfattar ger nej.
    const db2 = nyDb();
    rivta.konsumenter.sakraDemo(db2);
    const kontoId = db2.query('SELECT systemkonto_id FROM rivta_konsumenter WHERE hsa_id = ?').get(rivta.konsumenter.SJF).systemkonto_id;
    db2.query("UPDATE api_systemkonton SET vardenheter = '[\"uso-ort\"]' WHERE id = ?").run(kontoId);
    const svar = await anropa(db2, J.ASSERT_CARE_ENGAGEMENT, { performer: db2.query("SELECT hsa_id FROM personal WHERE id = 'lak-kard'").get().hsa_id, subjectOfCareId: '194502024732', careUnitHsaIdentity: 'SE2321000164-VK0120', careGiverHsaIdentity: VG }, rivta.konsumenter.SJF);
    expect(svar.HasCareEngagement).toBe(false);
    expect(db2.query("SELECT resultat FROM atkomstlogg WHERE resurs LIKE 'rivta/AssertCareEngagement%'").get().resultat).toBe('nekad');
    // Journalen har ingen anropsbehörighet till kontraktet.
    await expect(anropa(db, J.ASSERT_CARE_ENGAGEMENT, { performer: hsa('lak-kard'), subjectOfCareId: '194502024732', careUnitHsaIdentity: 'SE2321000164-VK0120', careGiverHsaIdentity: VG }, rivta.konsumenter.JOURNALEN)).rejects.toThrow('ingen anropsbehörighet');
  });

  test('journalens producenter slår bara upp exakt tolv siffror som personnummer eller samordningsnummer', async () => {
    const db = nyDb();
    for (const id of ['19450202-4732', '4502024732', '194502024732 ']) {
      const svar = await anropa(db, J.GET_DIAGNOSIS, { patientId: { id, type: '1.2.752.129.2.1.3.1' } });
      expect([id, svar.result.resultCode]).toEqual([id, 'ERROR']);
    }
    // Rätt nummer med fel typ ger ingen patient.
    expect((await anropa(db, J.GET_DIAGNOSIS, { patientId: { id: '194502024732', type: '1.2.752.129.2.1.3.3' } })).diagnosis).toBeUndefined();
    expect((await anropa(db, J.GET_DIAGNOSIS, fraga('194502024732'))).diagnosis.length).toBeGreaterThan(0);
  });
});
