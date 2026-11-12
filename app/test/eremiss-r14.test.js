// Runda 14, r3: e-remiss och vårdbegäran till och från vårdgivare utanför Vårdkällan (Sussa 2.2.1.12 och 3.3.1.2), med
// ProcessRequest, ProcessRequestConfirmation och ProcessRequestOutcome. Motparten är simulerad.
import { describe, test, expect } from 'bun:test';
import * as eremiss from '../src/eremiss.js';
import * as sim from '../src/eremiss-simulerad.js';
import * as remiss from '../src/remiss.js';
import * as r3 from '../src/rivta-r3.js';
import * as rivta from '../src/rivta/index.js';
import { atk, personal } from './hjalp.js';
import { nyDbSomStangs } from './r14r3-hjalp.js';

const nyDb = nyDbSomStangs();

const T = 'E-remiss > ';
const fel = async (fn) => { try { await fn(); } catch (e) { return e; } return null; };
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const ut = async (db, pid = 'p11', pers = 'lak-vc', extra = {}) => eremiss.skicka(atk(db, pers, pid, {}, 'remittera'), pat(db, pid), { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning av knäsmärta.', ...extra });
const remissRad = (db, id) => db.query('SELECT * FROM remisser WHERE id = ?').get(id);

describe('E-remiss till och från externa vårdgivare', () => {
  test(`${T}en remiss till en extern vårdgivare skickas med ProcessRequest, och mottagningsbekräftelsen gör den mottagen`, async () => {
    const db = nyDb();
    const r = await ut(db);
    const rad = remissRad(db, r.remissId);
    expect(rad.till_enhet_id).toBe('extern');
    expect(rad.status).toBe('mottagen');
    const h = db.query('SELECT kontrakt, kod FROM eremiss_handelser WHERE remiss_id = ?').all(r.remissId);
    expect(h).toEqual([{ kontrakt: 'ProcessRequestConfirmation', kod: 'BEK' }]);
    const logg = rivta.anropslogg(db).map(x => ({ kontrakt: x.kontrakt, riktning: x.riktning, resultat: x.resultat }));
    expect(logg).toEqual(expect.arrayContaining([{ kontrakt: 'ProcessRequest', riktning: 'ut', resultat: 'ok' }, { kontrakt: 'ProcessRequestConfirmation', riktning: 'in', resultat: 'ok' }]));
  });

  test(`${T}slutsvaret med ProcessRequestOutcome gör remissen besvarad, och remittenten kvitterar det som vanligt`, async () => {
    const db = nyDb();
    const r = await ut(db);
    await sim.svaraSimulerat(db, personal(db, 'lak-vc'), r.remissId);
    const rad = remissRad(db, r.remissId);
    expect(rad.status).toBe('besvarad');
    expect(rad.svar).toContain('Simulerat svar');
    const k = remiss.kvitteraSvar(atk(db, 'lak-vc', 'p11', {}, 'kvittera_svar'), rad);
    expect(k.status).toBe('svar_kvitterat');
  });

  test(`${T}remissen fylls i av systemet: patient, remittent, vårdenhet och diagnoser från den egna vårdenheten, aldrig från en annan`, async () => {
    const db = nyDb();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'M17.1', 'Primär gonartros', 'huvud', '2026-11-01')").run();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'uso-psyk', 'F32.1', 'Medelsvår depressiv episod', 'huvud', '2026-11-02')").run();
    const p = pat(db, 'p11');
    const a = atk(db, 'lak-vc', 'p11', { andra_enheter: true }, 'remittera');
    const b = eremiss.remissBegaran({ requestId: 'X#1', patient: p, pid: eremiss.personId(p), avsandare: personal(db, 'lak-vc'), enhet: { hsa_id: 'H', namn: 'N' }, mottagareHsa: 'M', fragestallning: 'Fråga', diagnoser: eremiss.diagnoserForRemiss(a), datum: '20261112', tid: '20261112100000' });
    const d = eremiss.DEF.remiss();
    expect(d.schema.validera(d.schema.bygg(d.begaran.ns, d.begaran.lokal, b))).toEqual([]);
    // Diagnosen från psykiatrin följer inte med, inte heller efter ett aktivt val.
    expect(eremiss.diagnoserForRemiss(a).map(d => d.kod)).toContain('M17.1');
    expect(eremiss.diagnoserForRemiss(a).map(d => d.kod)).not.toContain('F32.1');
    const r = await eremiss.skicka(a, p, { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning av knäsmärta.' });
    expect(r.text).toContain('Läkarhuset Ekbacken');
  });

  test(`${T}en remiss från en extern vårdgivare kommer in, ger vårdrelation först när den tas emot, och beskedet går tillbaka`, async () => {
    const db = nyDb();
    const r = await sim.skickaInkommande(db, personal(db, 'lak-vc'), 'p11');
    const rad = remissRad(db, r.remissId);
    expect(rad.fran_enhet_id).toBe('extern');
    expect(rad.till_enhet_id).toBe('vc-tybble');
    expect(rad.status).toBe('skickad');
    remiss.mottag(atk(db, 'lak-vc', 'p11', {}, 'mottag_remiss'), rad);
    await r3.klart(db);
    const s = db.query('SELECT status FROM sim_eremiss WHERE request_id = (SELECT request_id FROM eremisser WHERE remiss_id = ?)').get(r.remissId);
    expect(s.status).toBe('mottagen');
    remiss.bedom(atk(db, 'lak-vc', 'p11', {}, 'bedom_remiss'), remissRad(db, r.remissId), { beslut: 'accepterad' });
    remiss.svara(atk(db, 'lak-vc', 'p11', {}, 'svara_remiss'), remissRad(db, r.remissId), { svar: 'Patienten kallas till mottagningen.' });
    await r3.klart(db);
    expect(db.query('SELECT status FROM sim_eremiss WHERE request_id = (SELECT request_id FROM eremisser WHERE remiss_id = ?)').get(r.remissId).status).toBe('besvarad');
    const logg = rivta.anropslogg(db).filter(x => x.riktning === 'ut' && x.kontrakt !== 'ProcessRequest').map(x => ({ kontrakt: x.kontrakt, resultat: x.resultat })).reverse();
    expect(logg).toEqual([{ kontrakt: 'ProcessRequestConfirmation', resultat: 'ok' }, { kontrakt: 'ProcessRequestOutcome', resultat: 'ok' }]);
  });

  test(`${T}demon skickar en extern remiss bara för en patient som vårdenheten redan har vårdrelation till`, async () => {
    const db = nyDb();
    expect((await fel(() => sim.skickaInkommande(db, personal(db, 'lak-vc'), 'p02'))).status).toBe(403);
    expect(db.query('SELECT count(*) AS n FROM eremisser').get().n).toBe(0);
  });

  test(`${T}producenten avvisar en remiss till en okänd vårdenhet, från fel avsändare och för en patient som inte finns`, async () => {
    const db = nyDb();
    const p = pat(db, 'p11');
    const vc = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    const b = (till, pid = eremiss.personId(p)) => eremiss.remissBegaran({ requestId: 'SE-DEMO-HSA-0002#1', patient: p, pid, avsandare: { hsa_id: 'A', namn: 'B' }, enhet: { hsa_id: 'SE-DEMO-HSA-0002', namn: 'C' },
      mottagareHsa: till, fragestallning: 'Fråga om bedömning', datum: '20261112', tid: '20261112100000' });
    const skicka = (x, adress, fran = 'SE-DEMO-HSA-0002') => r3.anropa(db, eremiss.DEF.remiss(), { logiskAdress: adress, begaran: x, transport: r3.tillVardkallan(db, fran) });
    await expect(skicka(b('SE-OKAND'), 'SE-OKAND')).rejects.toThrow('logiska adressen');
    expect((await skicka(b(vc), db.query("SELECT hsa_id FROM enheter WHERE id = 'uso-kard'").get().hsa_id)).result.resultCode).toBe('ERROR');
    await expect(skicka(b(vc), vc, 'SE0000000000-OKAND')).rejects.toThrow('anropsbehörighet');
    expect((await skicka(b(vc), vc, 'SE-DEMO-HSA-0004')).result.resultCode).toBe('ERROR');
    expect((await skicka(b(vc, { root: '1.2.752.129.2.1.3.1', extension: '191212121212' }), vc)).result.message).toContain('Kontakta vårdenheten');
    expect(db.query("SELECT count(*) AS n FROM eremisser WHERE riktning = 'in'").get().n).toBe(0);
    // Ett korrekt meddelande tas emot en gång, och samma remiss igen ger INFO utan en ny rad.
    expect((await skicka(b(vc), vc)).result.resultCode).toBe('OK');
    expect((await skicka(b(vc), vc)).result.resultCode).toBe('INFO');
    expect(db.query("SELECT count(*) AS n FROM eremisser WHERE riktning = 'in'").get().n).toBe(1);
  });

  test(`${T}ett besked från fel avsändare eller för en okänd remiss ändrar ingenting`, async () => {
    const db = nyDb();
    const r = await ut(db, 'p11', 'lak-vc');
    db.query("UPDATE remisser SET status = 'skickad' WHERE id = ?").run(r.remissId);
    const req = db.query('SELECT request_id FROM eremisser WHERE remiss_id = ?').get(r.remissId).request_id;
    const vc = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    const bek = (fran, id = req) => ({ requestConfirmation: { requestId: { '@extension': id }, requestConfirmationId: { '@extension': 'X#9' }, typeOfRequestConfirmation: { '@code': 'AVV' },
      requestVersionNumber: '1', requestConfirmationTime: { '@value': '20261112100000' }, patient: { personId: { '@extension': pat(db, 'p11').personnummer, '@root': '1.2.752.129.2.1.3.1' } },
      confirmingOrganisation: { careUnitId: { '@extension': fran } }, author: { healthcareProfessional: { name: 'N' }, healthcareProfessionalOrganisation: { careUnitId: { '@extension': fran } } },
      recipient: { organisation: { careUnitId: { '@extension': vc } } }, outcome: { outcomeText: 'Nej' } } });
    const skicka = (x, fran) => r3.anropa(db, eremiss.DEF.besked(), { logiskAdress: vc, begaran: x, transport: r3.tillVardkallan(db, fran) });
    expect((await skicka(bek('SE-DEMO-HSA-0004'), 'SE-DEMO-HSA-0004')).result.resultCode).toBe('ERROR');
    expect((await skicka(bek('SE-DEMO-HSA-0002', 'Y#1'), 'SE-DEMO-HSA-0002')).result.resultCode).toBe('ERROR');
    expect(remissRad(db, r.remissId).status).toBe('skickad');
    // Rätt avsändare: remissen är avvisad med mottagarens motivering.
    expect((await skicka(bek('SE-DEMO-HSA-0002'), 'SE-DEMO-HSA-0002')).result.resultCode).toBe('OK');
    expect(remissRad(db, r.remissId).beslut).toBe('avvisad');
  });

  test(`${T}en patient utan personnummer eller samordningsnummer får ett besked på svenska och ingen remiss skickas`, async () => {
    const db = nyDb();
    const p = { ...pat(db, 'p11'), personnummer: 'VK0000000001' };
    const f = await fel(() => eremiss.skicka(atk(db, 'lak-vc', 'p11', {}, 'remittera'), p, { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning.' }));
    expect(f.status).toBe(400);
    expect(f.message).toContain('personnummer');
    expect((await fel(() => ut(db, 'p11', 'lak-vc', { mottagare: 'SE-HITTEPA' }))).status).toBe(400);
  });
});
