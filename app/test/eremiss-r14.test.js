// Runda 14, r3: e-remiss och vårdbegäran till och från vårdgivare utanför Vårdkällan (Sussa 2.2.1.12 och 3.3.1.2), med
// ProcessRequest, ProcessRequestConfirmation och ProcessRequestOutcome. Motparten är simulerad.
import { describe, test, expect } from 'bun:test';
import * as eremiss from '../src/eremiss.js';
import * as sim from '../src/eremiss-simulerad.js';
import * as remiss from '../src/remiss.js';
import { tolka, text } from '../src/rivta-r3-xml.js';
import { atk, nyDb, personal } from './hjalp.js';

const T = 'E-remiss > ';
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const ut = (db, pid = 'p11', pers = 'lak-vc', extra = {}) => eremiss.skicka(atk(db, pers, pid, {}, 'remittera'), pat(db, pid), { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning av knäsmärta.', ...extra });
const remissRad = (db, id) => db.query('SELECT * FROM remisser WHERE id = ?').get(id);

describe('E-remiss till och från externa vårdgivare', () => {
  test(`${T}en remiss till en extern vårdgivare skickas med ProcessRequest, och mottagningsbekräftelsen gör den mottagen`, () => {
    const db = nyDb();
    const r = ut(db);
    const rad = remissRad(db, r.remissId);
    expect(rad.till_enhet_id).toBe('extern');
    expect(rad.status).toBe('mottagen');
    const h = db.query('SELECT kontrakt, kod FROM eremiss_handelser WHERE remiss_id = ?').all(r.remissId);
    expect(h).toEqual([{ kontrakt: 'ProcessRequestConfirmation', kod: 'BEK' }]);
    const logg = db.query('SELECT kontrakt, riktning, resultat FROM rivta_r3_meddelanden ORDER BY id').all();
    expect(logg).toEqual(expect.arrayContaining([{ kontrakt: 'ProcessRequest', riktning: 'ut', resultat: 'ok' }, { kontrakt: 'ProcessRequestConfirmation', riktning: 'in', resultat: 'ok' }]));
  });

  test(`${T}slutsvaret med ProcessRequestOutcome gör remissen besvarad, och remittenten kvitterar det som vanligt`, () => {
    const db = nyDb();
    const r = ut(db);
    sim.svaraSimulerat(db, personal(db, 'lak-vc'), r.remissId);
    const rad = remissRad(db, r.remissId);
    expect(rad.status).toBe('besvarad');
    expect(rad.svar).toContain('Simulerat svar');
    const k = remiss.kvitteraSvar(atk(db, 'lak-vc', 'p11', {}, 'kvittera_svar'), rad);
    expect(k.status).toBe('svar_kvitterat');
  });

  test(`${T}remissen fylls i av systemet: patient, remittent, vårdenhet och diagnoser från den egna vårdenheten, aldrig från en annan`, () => {
    const db = nyDb();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'vc-tybble', 'M17.1', 'Primär gonartros', 'huvud', '2026-11-01')").run();
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p11', 'uso-psyk', 'F32.1', 'Medelsvår depressiv episod', 'huvud', '2026-11-02')").run();
    const p = pat(db, 'p11');
    const a = atk(db, 'lak-vc', 'p11', { andra_enheter: true }, 'remittera');
    const kropp = eremiss.remissKropp({ requestId: 'X#1', patient: p, pid: eremiss.personId(p), avsandare: personal(db, 'lak-vc'), enhet: { hsa_id: 'H', namn: 'N' }, mottagareHsa: 'M', fragestallning: 'Fråga', diagnoser: [], datum: '20261112', tid: '20261112100000' });
    expect(kropp.n).toBe('pr:ProcessRequest');
    // Diagnosen från psykiatrin följer inte med, inte heller efter ett aktivt val.
    expect(eremiss.diagnoserForRemiss(a).map(d => d.kod)).toContain('M17.1');
    expect(eremiss.diagnoserForRemiss(a).map(d => d.kod)).not.toContain('F32.1');
    const r =eremiss.skicka(a, p, { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning av knäsmärta.' });
    const sha = db.query("SELECT sha256 FROM rivta_r3_meddelanden WHERE kontrakt = 'ProcessRequest' AND riktning = 'ut'").get().sha256;
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(r.text).toContain('Läkarhuset Ekbacken');
  });

  test(`${T}en remiss från en extern vårdgivare kommer in, ger vårdrelation först när den tas emot, och beskedet går tillbaka`, () => {
    const db = nyDb();
    const r = sim.skickaInkommande(db, personal(db, 'lak-vc'), 'p11');
    const rad = remissRad(db, r.remissId);
    expect(rad.fran_enhet_id).toBe('extern');
    expect(rad.till_enhet_id).toBe('vc-tybble');
    expect(rad.status).toBe('skickad');
    remiss.mottag(atk(db, 'lak-vc', 'p11', {}, 'mottag_remiss'), rad);
    const s = db.query('SELECT status FROM sim_eremiss WHERE request_id = (SELECT request_id FROM eremisser WHERE remiss_id = ?)').get(r.remissId);
    expect(s.status).toBe('mottagen');
    remiss.bedom(atk(db, 'lak-vc', 'p11', {}, 'bedom_remiss'), remissRad(db, r.remissId), { beslut: 'accepterad' });
    remiss.svara(atk(db, 'lak-vc', 'p11', {}, 'svara_remiss'), remissRad(db, r.remissId), { svar: 'Patienten kallas till mottagningen.' });
    expect(db.query('SELECT status FROM sim_eremiss WHERE request_id = (SELECT request_id FROM eremisser WHERE remiss_id = ?)').get(r.remissId).status).toBe('besvarad');
    const logg = db.query("SELECT kontrakt, riktning, resultat FROM rivta_r3_meddelanden WHERE riktning = 'ut' AND kontrakt != 'ProcessRequest' ORDER BY id").all();
    expect(logg).toEqual([{ kontrakt: 'ProcessRequestConfirmation', riktning: 'ut', resultat: 'ok' }, { kontrakt: 'ProcessRequestOutcome', riktning: 'ut', resultat: 'ok' }]);
  });

  test(`${T}demon skickar en extern remiss bara för en patient som vårdenheten redan har vårdrelation till`, () => {
    const db = nyDb();
    expect(fel(() => sim.skickaInkommande(db, personal(db, 'lak-vc'), 'p02')).status).toBe(403);
    expect(db.query('SELECT count(*) AS n FROM eremisser').get().n).toBe(0);
  });

  test(`${T}producenten avvisar en remiss till en okänd vårdenhet, en patient som inte finns och ett meddelande med dokumenttyp`, () => {
    const db = nyDb();
    const p = pat(db, 'p11');
    const kropp = (till, pid = eremiss.personId(p)) => require('../src/rivta-r3-xml.js').xml(eremiss.remissKropp({ requestId: 'SE-DEMO-HSA-0002#1', patient: p, pid, avsandare: { hsa_id: 'A', namn: 'B' }, enhet: { hsa_id: 'SE-DEMO-HSA-0002', namn: 'C' },
      mottagareHsa: till, fragestallning: 'Fråga om bedömning', datum: '20261112', tid: '20261112100000' }), { pr: eremiss.NS.pr, core: eremiss.NS.core });
    const svar = (x, a) => tolka(eremiss.taEmotRemiss(db, x, { logiskAdress: a }));
    expect(text(svar(kropp('SE-OKAND'), 'SE-OKAND'), 'result/resultCode')).toBe('ERROR');
    const vc = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    expect(text(svar(kropp(vc), 'SE-ANNAN'), 'result/resultCode')).toBe('ERROR');
    const okand = text(svar(kropp(vc, { root: '1.2.752.129.2.1.3.1', extension: '191212121212' }), vc), 'result/message');
    expect(okand).toContain('Kontakta vårdenheten');
    expect(text(svar(`<!DOCTYPE a>${kropp(vc)}`, vc), 'result/resultCode')).toBe('ERROR');
    expect(db.query('SELECT count(*) AS n FROM remisser WHERE fran_enhet_id = \'extern\' AND till_enhet_id = \'vc-tybble\' AND fragestallning = \'Fråga om bedömning\'').get().n).toBe(0);
    // Ett korrekt meddelande tas emot en gång, och samma remiss igen ger INFO utan en ny rad.
    expect(text(svar(kropp(vc), vc), 'result/resultCode')).toBe('OK');
    expect(text(svar(kropp(vc), vc), 'result/resultCode')).toBe('INFO');
    expect(db.query("SELECT count(*) AS n FROM eremisser WHERE riktning = 'in'").get().n).toBe(1);
  });

  test(`${T}ett besked från fel avsändare eller för en okänd remiss ändrar ingenting`, () => {
    const db = nyDb();
    const r = ut(db, 'p11', 'lak-vc');
    db.query("UPDATE remisser SET status = 'skickad' WHERE id = ?").run(r.remissId);
    const req = db.query('SELECT request_id FROM eremisser WHERE remiss_id = ?').get(r.remissId).request_id;
    const vc = db.query("SELECT hsa_id FROM enheter WHERE id = 'vc-tybble'").get().hsa_id;
    const bek = (fran, id = req) => `<b:ProcessRequestConfirmation xmlns:b="${eremiss.NS.bek}" xmlns:c="${eremiss.NS.core}"><c:requestConfirmation><c:requestId extension="${id}"/><c:requestConfirmationId extension="X#9"/><c:typeOfRequestConfirmation code="AVV"/><c:requestVersionNumber>1</c:requestVersionNumber><c:requestConfirmationTime value="20261112100000"/><c:patient><c:personId extension="${pat(db, 'p11').personnummer}" root="1.2.752.129.2.1.3.1"/></c:patient><c:confirmingOrganisation><c:careUnitId extension="${fran}"/></c:confirmingOrganisation><c:outcome><c:outcomeText>Nej</c:outcomeText></c:outcome></c:requestConfirmation></b:ProcessRequestConfirmation>`;
    expect(text(tolka(eremiss.taEmotBesked(db, bek('SE-DEMO-HSA-0004'), { logiskAdress: vc })), 'result/resultCode')).toBe('ERROR');
    expect(text(tolka(eremiss.taEmotBesked(db, bek('SE-DEMO-HSA-0002', 'Y#1'), { logiskAdress: vc })), 'result/resultCode')).toBe('ERROR');
    expect(remissRad(db, r.remissId).status).toBe('skickad');
    // Rätt avsändare: remissen är avvisad med mottagarens motivering.
    expect(text(tolka(eremiss.taEmotBesked(db, bek('SE-DEMO-HSA-0002'), { logiskAdress: vc })), 'result/resultCode')).toBe('OK');
    expect(remissRad(db, r.remissId).beslut).toBe('avvisad');
  });

  test(`${T}en patient utan personnummer eller samordningsnummer får ett besked på svenska och ingen remiss skickas`, () => {
    const db = nyDb();
    const p = { ...pat(db, 'p11'), personnummer: 'VK0000000001' };
    const f = fel(() => eremiss.skicka(atk(db, 'lak-vc', 'p11', {}, 'remittera'), p, { mottagare: 'SE-DEMO-HSA-0002', fragestallning: 'Bedömning.' }));
    expect(f.status).toBe(400);
    expect(f.message).toContain('personnummer');
    expect(fel(() => ut(db, 'p11', 'lak-vc', { mottagare: 'SE-HITTEPA' })).status).toBe(400);
  });
});
