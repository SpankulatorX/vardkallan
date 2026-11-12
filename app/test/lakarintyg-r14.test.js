// Runda 14, r3: intyg genom den integrerade intygsapplikationen (Sussa 2.2.1.9). Journalen skapar utkastet med
// CreateDraftCertificate, tar emot händelserna med CertificateStatusUpdateForCare och stämmer av med
// ListCertificatesForCareWithQA. Intygsapplikationen är simulerad.
import { describe, test, expect } from 'bun:test';
import { iso } from '../src/db.js';
import * as intyg from '../src/lakarintyg.js';
import * as app from '../src/intygsapplikation-simulerad.js';
import { xml, tolka, text } from '../src/rivta-r3-xml.js';
import { atk, nyDb, personal } from './hjalp.js';

const T = 'Intyg > ';
const DAG = '2026-11-12';
const lisjp = (db, pid = 'p11', pers = 'lak-vc') => intyg.skapa(atk(db, pers, pid, {}, 'skriv_intyg'), db.query('SELECT * FROM patienter WHERE id = ?').get(pid), { typ: 'LISJP' }, DAG);
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const diagnos = (db, pid, enhet = 'vc-tybble', kod = 'J06.9', textD = 'Akut övre luftvägsinfektion') =>
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES (?, ?, ?, ?, 'huvud', ?)").run(pid, enhet, kod, textD, DAG);

describe('Intyg genom intygsapplikationen', () => {
  test(`${T}läkaren skapar ett utkast med CreateDraftCertificate, och patient, läkare, vårdenhet och diagnos fylls i av systemet`, () => {
    const db = nyDb();
    diagnos(db, 'p11');
    const r = lisjp(db);
    expect(r.intyg.status).toBe('utkast');
    expect(r.forifyllt[0]).toContain('J06.9');
    expect(r.oppna).toMatch(/^#\/intygsapplikation\/[0-9a-f-]{36}$/);
    const sim = db.query('SELECT * FROM sim_intygsapplikation').get();
    expect(sim.personnummer).toBe(db.query("SELECT personnummer FROM patienter WHERE id = 'p11'").get().personnummer);
    expect(sim.personal_hsa).toBe(personal(db, 'lak-vc').hsa_id);
    expect(JSON.parse(sim.svar).diagnosKod).toBe('J069');
    // Händelsen SKAPAT kom tillbaka med CertificateStatusUpdateForCare.
    expect(r.intyg.handelser.map(h => h.kod)).toEqual(['SKAPAT']);
    const h = db.query('SELECT kod FROM lakarintyg_handelser').all().map(x => x.kod);
    expect(h).toEqual(['SKAPAT']);
    const logg = db.query('SELECT kontrakt, riktning, resultat FROM rivta_r3_meddelanden ORDER BY id').all();
    expect(logg).toEqual(expect.arrayContaining([{ kontrakt: 'CreateDraftCertificate', riktning: 'ut', resultat: 'ok' }, { kontrakt: 'CertificateStatusUpdateForCare', riktning: 'in', resultat: 'ok' }]));
  });

  test(`${T}signerat och skickat i intygsapplikationen syns i journalen utan att någon gör något`, () => {
    const db = nyDb();
    diagnos(db, 'p11');
    const r = lisjp(db);
    const id = r.oppna.split('/').pop();
    const lak = personal(db, 'lak-vc');
    expect(fel(() => app.atgard(db, lak, id, 'signera')).message).toContain('Fyll i');
    app.spara(db, lak, id, { sysselsattning: 'nuvarande_arbete', nedsattning: 'halften', fran: DAG, till: '2026-11-26' });
    app.atgard(db, lak, id, 'signera');
    app.atgard(db, lak, id, 'skicka');
    const u = intyg.forPatient(atk(db, 'lak-vc', 'p11', {}, 'las_intyg'), db.query("SELECT * FROM patienter WHERE id = 'p11'").get(), DAG);
    expect(u.intyg[0].status).toBe('skickat');
    expect(u.intyg[0].signerad).toBeTruthy();
    expect(u.intyg[0].handelser.map(h => h.kod)).toEqual(['SKAPAT', 'ANDRAT', 'SIGNAT', 'SKICKA']);
  });

  test(`${T}en händelse som inte kom fram läggs in av avstämningen med ListCertificatesForCareWithQA`, () => {
    const db = nyDb();
    const r = lisjp(db);
    const id = r.oppna.split('/').pop();
    // Statusuppdateringen om SIGNAT går förlorad på vägen: journalen ser bara utkastet.
    const rad = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(id);
    const h = JSON.parse(rad.handelser);
    h.push({ kod: 'SIGNAT', tid: '2026-11-12T10:00:00.000' });
    db.query("UPDATE sim_intygsapplikation SET status = 'signerat', signerad = ?, handelser = ? WHERE intygs_id = ?").run('2026-11-12T10:00:00.000Z', JSON.stringify(h), id);
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const a = intyg.avstam(atk(db, 'lak-vc', 'p11', {}, 'las_intyg'), p);
    expect(a.avstamt).toBe(1);
    expect(intyg.forPatient(atk(db, 'lak-vc', 'p11', {}, 'las_intyg'), p, DAG).intyg[0].status).toBe('signerat');
    // En andra avstämning hittar inget nytt.
    expect(intyg.avstam(atk(db, 'lak-vc', 'p11', {}, 'las_intyg'), p).avstamt).toBe(0);
  });

  test(`${T}bara de intyg som får skrivas för patienten visas, och förslaget följer patienten`, () => {
    const db = nyDb();
    diagnos(db, 'p11');
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const t = intyg.typerFor(db, p, DAG);
    expect(t.find(x => x.kod === 'LISJP').mojlig).toBe(true);
    expect(t.find(x => x.kod === 'DB').mojlig).toBe(false);
    expect(intyg.forslag(atk(db, 'lak-vc', 'p11', {}, 'skriv_intyg'), p, DAG).kod).toBe('LISJP');
    // En patient med skyddade personuppgifter: intyg till Transportstyrelsen kan inte skrivas.
    const s = db.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    expect(intyg.typerFor(db, s, DAG).find(x => x.kod === 'TSTRK1007').mojlig).toBe(false);
    const f = fel(() => intyg.skapa(atk(db, 'lak-vc', 'p03', {}, 'skriv_intyg'), s, { typ: 'TSTRK1007' }, DAG));
    expect(f.status).toBe(400);
    expect(f.message).toContain('skyddade personuppgifter');
    // Ett val som inte finns ger ett fel på svenska.
    expect(fel(() => intyg.skapa(atk(db, 'lak-vc', 'p11', {}, 'skriv_intyg'), p, { typ: 'XYZ' }, DAG)).message).toContain('Välj');
  });

  test(`${T}för en patient med skyddade personuppgifter skickas ingen adress till intygsapplikationen`, () => {
    const db = nyDb();
    const s = db.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    const k = intyg.skapaUtkastKropp({ typ: 'LISJP', patient: { ...s, adress: 'Gatan 1', postnr: '70000', ort: 'Örebro' }, pid: intyg.personId(s), personal: personal(db, 'lak-vc'), enhet: { hsa_id: 'X', namn: 'Y' }, ref: 'r' });
    const x = xml(k, { skapa: intyg.NS.skapa, core: intyg.NS.core, types: intyg.NS.types, m3: intyg.NS.m3 });
    expect(x).not.toContain('Gatan 1');
    expect(x).not.toContain('Örebro');
    expect(text(tolka(x), 'intyg/patient/postadress')).toBe('');
  });

  test(`${T}sjuksköterskan ser intygen men skapar inga, och en annan vårdenhet ser dem bara efter ett aktivt val`, () => {
    const db = nyDb();
    lisjp(db, 'p11', 'lak-vc');
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const kard = atk(db, 'lak-kard', 'p11', {}, 'las_intyg');
    const u = intyg.forPatient(kard, p, DAG);
    expect(u.intyg).toEqual([]);
    expect(u.dolda?.kraverVal).toBe(true);
    expect(intyg.forPatient(atk(db, 'lak-kard', 'p11', { andra_enheter: true }, 'las_intyg'), p, DAG).intyg.length).toBe(1);
    const ssk = db.query("SELECT id FROM personal WHERE yrke = 'sjukskoterska' AND enhet_id LIKE 'vc-tybble%' LIMIT 1").get()?.id;
    if (ssk) {
      expect(intyg.forPatient(atk(db, ssk, 'p11', {}, 'las_intyg'), p, DAG).kanSkriva).toBe(false);
      expect(fel(() => intyg.skapa(atk(db, ssk, 'p11', {}, 'skriv_intyg'), p, { typ: 'LISJP' }, DAG)).status).toBe(403);
    }
  });

  test(`${T}ett intyg på en spärrad vårdenhet syns inte och röjs inte, utan samtycke`, () => {
    const db = nyDb();
    const tom = nyDb();
    lisjp(db, 'p11', 'lak-vc');
    for (const d of [db, tom]) d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p11', 'vc-tybble', ?, 1)").run(iso());
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const utan = intyg.forPatient(atk(db, 'lak-kard', 'p11', { andra_enheter: true }, 'las_intyg'), p, DAG);
    expect(utan.intyg).toEqual([]);
    // Hela svaret är detsamma som för en patient utan intyg på den spärrade vårdenheten.
    expect(JSON.stringify(utan)).toBe(JSON.stringify(intyg.forPatient(atk(tom, 'lak-kard', 'p11', { andra_enheter: true }, 'las_intyg'), p, DAG)));
    const med = intyg.forPatient(atk(db, 'lak-kard', 'p11', { andra_enheter: true, samtycke_sparr: true }, 'las_intyg'), p, DAG);
    expect(med.intyg.length).toBe(1);
  });

  test(`${T}producenten avvisar en statusuppdatering för ett intyg som journalen inte har skapat, och ändrar ingenting`, () => {
    const db = nyDb();
    const r = lisjp(db);
    const fore = db.query('SELECT count(*) AS n FROM lakarintyg_handelser').get().n;
    const svar = (x, adress) => tolka(intyg.taEmotStatus(db, x, { logiskAdress: adress }));
    const hsa = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    const stomme = (id, kod = 'SIGNAT') => `<s:CertificateStatusUpdateForCare xmlns:s="${intyg.NS.status}" xmlns:c="${intyg.NS.core}" xmlns:t="${intyg.NS.types}"><s:intyg><c:intygs-id><t:root>x</t:root><t:extension>${id}</t:extension></c:intygs-id></s:intyg><s:handelse><c:handelsekod><t:code>${kod}</t:code><t:codeSystem>${intyg.KV.handelse}</t:codeSystem></c:handelsekod><c:tidpunkt>2026-11-12T10:00:00.000</c:tidpunkt></s:handelse></s:CertificateStatusUpdateForCare>`;
    expect(text(svar(stomme('00000000-0000-0000-0000-000000000000'), hsa), 'result/resultCode')).toBe('ERROR');
    const id = r.oppna.split('/').pop();
    // Fel logisk adress, okänd händelse, en entitet och en dokumenttyp.
    expect(text(svar(stomme(id), 'SE-ANNAN-ENHET'), 'result/resultCode')).toBe('ERROR');
    expect(text(svar(stomme(id, 'HITTEPA'), hsa), 'result/resultCode')).toBe('ERROR');
    expect(text(svar(`<!DOCTYPE x [<!ENTITY a "b">]>${stomme(id)}`, hsa), 'result/resultText')).toContain('dokumenttyp');
    expect(db.query('SELECT count(*) AS n FROM lakarintyg_handelser').get().n).toBe(fore);
    expect(db.query('SELECT status FROM lakarintyg').get().status).toBe('utkast');
    // Ett korrekt meddelande tas emot, och samma händelse en gång till läggs inte in igen.
    expect(text(svar(stomme(id), hsa), 'result/resultCode')).toBe('OK');
    expect(text(svar(stomme(id), hsa), 'result/resultCode')).toBe('OK');
    expect(db.query("SELECT count(*) AS n FROM lakarintyg_handelser WHERE kod = 'SIGNAT'").get().n).toBe(1);
    // En sen händelse flyttar aldrig tillbaka statusen.
    svar(stomme(id, 'ANDRAT'), hsa);
    expect(db.query('SELECT status FROM lakarintyg').get().status).toBe('signerat');
  });

  test(`${T}intygsapplikationen nekar den som inte har uppdrag på vårdenheten, och loggar försöket`, () => {
    const db = nyDb();
    const r = lisjp(db);
    const id = r.oppna.split('/').pop();
    expect(fel(() => app.visa(db, personal(db, 'lak-kard'), id)).status).toBe(404);
    const v = app.visa(db, personal(db, 'lak-vc'), id);
    expect(v.patient.namn).toBeTruthy();
    expect(v.simulerad).toContain('inte Webcert');
    const logg = db.query("SELECT personal_id, resultat FROM atkomstlogg WHERE resurs LIKE 'intygsapplikation%' ORDER BY id").all();
    expect(logg).toEqual(expect.arrayContaining([{ personal_id: 'lak-kard', resultat: 'nekad' }, { personal_id: 'lak-vc', resultat: 'tillaten' }]));
  });

  test(`${T}meddelandena tolkas med tak och utan externa entiteter`, () => {
    expect(fel(() => tolka('<a>&xxe;</a>')).message).toContain('entitet');
    expect(fel(() => tolka('<a>x</b>')).message).toContain('Sluttaggen');
    expect(fel(() => tolka('<a>&</a>')).message).toContain('&');
    expect(text(tolka('<a><b>&amp;&lt;Ö</b></a>'), 'b')).toBe('&<Ö');
    expect(fel(() => tolka('<a>' + '<b>'.repeat(100) + '</b>'.repeat(100) + '</a>')).message).toContain('djupt');
  });
});
