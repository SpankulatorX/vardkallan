// Runda 14, r3: Vårdkällan som producent av vaccinationer med GetVaccinationHistory 2.0 (Sussa 2.2.1.11). Svaret
// byggs och valideras mot schemat i producenten och igen i konsumenten, och det innehåller precis det som den
// anropande organisationens systemkonto får läsa som Immunization i FHIR-API:t.
import { describe, test, expect } from 'bun:test';
import { nyDb } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';
import * as vacc from '../src/rivta-vaccination.js';
import { fhirResurser } from '../src/tjanstekontrakt.js';

const VG = 'SE2321000164-VK0000';
const fraga = (pnr, extra = {}) => ({ patientId: { id: pnr, type: '1.2.752.129.2.1.3.1' }, ...extra });
const anropa = (db, begaran, hsaId = rivta.konsumenter.NPO) => rivta.anropa(vacc.DEF(), { logiskAdress: VG, begaran, db,
  transport: rivta.iProcessen(rivta.vardkallan, { ctx: { db }, avsandare: { hsaId, via: 'direkt' } }) });
const konto = (db) => rivta.konsumenter.prova(db, { hsaId: rivta.konsumenter.NPO }, { namn: 'GetVaccinationHistory' }).konsument.personal;

describe('Tjänstekontrakt i RIVTA, vaccinationer', () => {
  test('Vaccination > GetVaccinationHistory svarar med de vaccinationer som organisationens systemkonto får läsa i FHIR', async () => {
    const db = nyDb();
    // En patient med vaccinationer och en vårdkontakt på en av kontots vårdenheter.
    const rader = db.query("SELECT v.patient_id, p.personnummer, count(*) AS n FROM vaccinationer v JOIN patienter p ON p.id = v.patient_id WHERE p.skyddad = 0 GROUP BY v.patient_id ORDER BY n DESC").all();
    const r = rader.find(x => fhirResurser({ db, personal: konto(db) }, 'GetVaccinationHistory', x.patient_id, { typer: ['Immunization'] }).length > 0);
    expect(r).toBeTruthy();
    const svar = await anropa(db, fraga(r.personnummer));
    expect(svar.result.resultCode).toBe('OK');
    const antal = fhirResurser({ db, personal: konto(db) }, 'GetVaccinationHistory', r.patient_id, { typer: ['Immunization'] }).length;
    expect(svar.vaccinationMedicalRecord.length).toBe(antal);
    const p = svar.vaccinationMedicalRecord[0];
    expect(p.vaccinationMedicalRecordHeader).toMatchObject({ sourceSystemHSAId: VG, patientId: { id: r.personnummer } });
    expect(p.vaccinationMedicalRecordBody.administrationRecord[0].vaccineName.codeSystemName).toBe('ATC');
    // Filter på period i framtiden ger inga poster.
    expect((await anropa(db, fraga(r.personnummer, { timePeriod: { start: '20990101', end: '20991231' } }))).vaccinationMedicalRecord).toBeUndefined();
    expect(rivta.anropslogg(db).some(x => x.kontrakt === 'GetVaccinationHistory' && x.resultat === 'ok')).toBe(true);
    // Läsningen är loggad på patienten med kontraktet och organisationen.
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = ? AND resurs LIKE '%GetVaccinationHistory%'").get(r.patient_id).n).toBeGreaterThan(0);
  });

  test('Vaccination > GetVaccinationHistory lämnar aldrig ut skyddade personuppgifter eller spärrade vaccinationer, och en okänd organisation nekas', async () => {
    const db = nyDb();
    const v = db.query("SELECT v.id, v.patient_id, v.enhet_id, p.personnummer FROM vaccinationer v JOIN patienter p ON p.id = v.patient_id WHERE p.skyddad = 0 LIMIT 1").get();
    // Patienten blir skyddad: svaret är detsamma som för en patient som inte finns.
    db.query('UPDATE patienter SET skyddad = 1 WHERE id = ?').run(v.patient_id);
    const skyddad = JSON.stringify(await anropa(db, fraga(v.personnummer))).replace(/"logId":"\w+"/, '');
    const finnsInte = JSON.stringify(await anropa(db, fraga('191212121212'))).replace(/"logId":"\w+"/, '');
    expect(skyddad).toBe(finnsInte);
    db.query('UPDATE patienter SET skyddad = 0 WHERE id = ?').run(v.patient_id);
    // En spärr på vårdenheten döljer vaccinationen.
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES (?, ?, '2026-11-01T00:00:00Z', 1)").run(v.patient_id, v.enhet_id);
    const sparr = await anropa(db, fraga(v.personnummer));
    expect((sparr.vaccinationMedicalRecord ?? []).some(x => x.vaccinationMedicalRecordHeader.documentId === `Immunization/${v.id}`)).toBe(false);
    await expect(anropa(db, fraga(v.personnummer), 'SE0000000000-OKAND')).rejects.toThrow('ingen anropsbehörighet');
    // Ett fel personnummer ger INVALID_REQUEST enligt kontraktet.
    expect((await anropa(db, { patientId: { id: '12', type: '1.2.752.129.2.1.3.1' } })).result.errorCode).toBe('INVALID_REQUEST');
  });
});
