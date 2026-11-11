// Runda 8, r5: mallen för tobaksvanor (Sussa testfall 4.1), epikrisens förslag och flera mätvärden på en gång (4.2 och
// 4.3), vårdenheternas egna övningar, utloggningen och undantaget i barnhälsovårdsregistret som parametrar, och
// villkoren för version 1.0. Testnamnen står i src/sussa/runda8-r5.js.
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSeed, idag } from '../src/db.js';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { Atkomst } from '../src/atkomst.js';
import * as journal from '../src/journal.js';
import * as tobak from '../src/tobak.js';
import * as R from '../public/js/tobak-regler.js';
import * as strukturerad from '../src/strukturerad.js';
import * as utbildning from '../src/utbildning.js';
import * as konfiguration from '../src/konfiguration.js';
import * as bhvq from '../src/bhvq.js';
import { KVA } from '../src/kodverk.js';
import { villkor10, PRINCIP, INTE_VARDEN, lasFynd } from '../src/version.js';
import { laddaTestdata } from '../src/sussa-demo.js';
import { personal, testserver, klient, sandlada } from './hjalp.js';

const APP = join(import.meta.dir, '..');
let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const atk = (db, pid, patient, handling = 'las_oversikt', val = {}) => new Atkomst(db, personal(db, pid), patient, val, handling);
const NU = new Date('2026-11-08T10:00:00Z');
// Runda 11, r1: Gunnar Åkessons (p01, född 1945-02-02) ålder i dag, så att testet inte går ut när han fyller år.
const alderP01 = () => { const [y, m, d] = idag().split('-').map(Number); return y - 1945 - (m < 2 || (m === 2 && d < 2) ? 1 : 0); };
afterEach(() => aterstallKlockan());
const ROKARE = { produkter: { cigaretter: { bruk: 'dagligen', antal: '25' } }, stod: 'accepterat', kommentar: 'Hon röker endast varannan vecka, när hennes barn är hos sin pappa.' };

describe('Tobaksvanor', () => {
  test('systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer', () => {
    const p = R.prova({ produkter: { cigaretter: { bruk: 'dagligen', antal: 25 } }, stod: 'accepterat' }, { alder: 86 });
    expect(p).toMatchObject({ ok: true, varde: { anvander: 'ja', produkter: { cigaretter: { bruk: 'dagligen', antal: 25 } }, stod: 'accepterat', givet: false } });
    expect(R.forslag(p.varde, { alder: 86 })).toMatchObject({ kod: 'DV113', atgard: 'Kvalificerat rådgivande samtal om tobaks- och nikotinbruk' });
    expect(R.forslag({ anvander: 'ja', produkter: { tobakssnus: { bruk: 'dagligen' } } }, { alder: 40 }).kod).toBe('DV112');
    // Unga under 18 år får kvalificerat rådgivande samtal oavsett mängd.
    expect(R.forslag({ anvander: 'ja', produkter: { nikotinsnus: { bruk: 'ibland' } } }, { alder: 16 }).kod).toBe('DV113');
    expect(R.forslag({ anvander: 'ja', produkter: { cigaretter: { bruk: 'ibland' } } }, { alder: 40 })).toMatchObject({ kod: 'DV111', demoregel: true });
    expect(R.forslag({ anvander: 'ja', produkter: { ecigaretter: { bruk: 'dagligen' } } }, { alder: 40 }).kod).toBeNull();
    expect(R.forslag({ anvander: 'ja', produkter: { cigaretter: { bruk: 'slutat' } } }, { alder: 40 }).kod).toBeNull();
    expect(R.forslag({ anvander: 'nej', produkter: {} }).kod).toBeNull();
    // Koderna och titlarna är desamma som i kodverket, och källan står med.
    for (const [kod, text] of Object.entries(R.KVA_TOBAK)) expect(KVA[kod]).toBe(text);
    expect(R.KALLA.riktlinjer).toContain('2024-11-9272');
    expect(R.PRODUKT.cigaretter.snomed).toBe('66562002');
  });

  test('systemet förklarar på vanlig svenska när svaren inte går ihop', () => {
    expect(R.prova({ anvander: 'ja' }).varfor).toContain('Fyll i vilken produkt');
    expect(R.prova({ anvander: 'nej', produkter: { cigaretter: { bruk: 'dagligen' } } }).varfor).toContain('inte använder');
    expect(R.prova({ produkter: { cigaretter: { bruk: 'dagligen' } } }, { alder: 50 })).toMatchObject({ ok: false, falt: 'stod' });
    expect(R.prova({ produkter: { cigaretter: { bruk: 'dagligen', antal: '2,5' } }, stod: 'accepterat' }).falt).toBe('produkter.cigaretter.antal');
    expect(R.prova({ produkter: { cigaretter: { bruk: 'dagligen' } }, stod: 'avbojt', givet: true }).falt).toBe('givet');
    expect(R.prova({ produkter: { andra: { bruk: 'ibland' } } }).varfor).toContain('vilken produkt');
    expect(R.prova({ anvander: 'nej', stod: 'accepterat' }).falt).toBe('stod');
    expect(R.prova({ produkter: { tobakssnus: { bruk: 'slutat', slutdatum: '2099-01-01' } } }, { idag: '2026-11-08' }).varfor).toContain('framtiden');
    expect(R.prova({ anvander: 'slutat' })).toMatchObject({ ok: true, varde: { anvander: 'slutat', stod: null } });
  });

  test('anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'lak-kard', 'p01', 'skriv_omvardnad');
    const ny = journal.skapaAnteckning(a, { typ: tobak.TYP, tobak: ROKARE, sokord: [{ sokord: 'Aktuellt', text: 'Ska inte sparas' }] });
    expect(ny).toMatchObject({ typ: 'Tobaksvanor', kategori: 'omvardnad', status: 'utkast' });
    const text = JSON.stringify(ny.sokord);
    expect(text).toContain('Cigaretter dagligen, 25 per dag');
    expect(text).toContain('Kvalificerat rådgivande samtal om tobaks- och nikotinbruk (KVÅ DV113): erbjudet och accepterat');
    expect(text).toContain('varannan vecka');
    expect(text).not.toContain('Ska inte sparas');
    expect(ny.tobak).toMatchObject({ svar: { anvander: 'ja', stod: 'accepterat' }, forslag: { kod: 'DV113' } });
    expect(db.query('SELECT forslag, alder FROM tobaksvanor WHERE anteckning_id = ?').get(ny.id)).toEqual({ forslag: 'DV113', alder: alderP01() });
    // Ett utkast ändras med svaren, aldrig med sökorden.
    expect(fel(() => journal.andraUtkast(a, journal.hamtaAnteckningRad(db, ny.id), { sokord: [{ sokord: 'Stöd', text: 'Eget' }] }))).toMatchObject({ status: 400 });
    const andrad = journal.andraUtkast(a, journal.hamtaAnteckningRad(db, ny.id), { tobak: { ...ROKARE, givet: true } });
    expect(JSON.stringify(andrad.sokord)).toContain('Samtalet hölls vid besöket');
    // Fel svar sparas inte.
    expect(fel(() => journal.skapaAnteckning(a, { typ: tobak.TYP, tobak: { anvander: 'ja' } }))).toMatchObject({ status: 400, extra: { falt: ['produkter'] } });
  });

  test('hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01', 'skriv_omvardnad');
    const ny = journal.skapaAnteckning(a, { typ: tobak.TYP, tobak: { ...ROKARE, givet: true } });
    expect(db.query("SELECT count(*) AS n FROM atgarder WHERE kod = 'DV113'").get().n).toBe(0);
    const s = journal.signera(a, journal.hamtaAnteckningRad(db, ny.id));
    expect(s.status).toBe('signerad');
    const at = db.query("SELECT * FROM atgarder WHERE kod = 'DV113'").all();
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ patient_id: 'p01', av: 'ssk-kard', vardkontakt_id: s.vardkontaktId });
    expect(JSON.parse(at[0].underlag)).toEqual({ anteckning: ny.id });
    expect(fel(() => db.query('UPDATE tobaksvanor SET forslag = NULL WHERE anteckning_id = ?').run(ny.id))?.message).toContain('ändras inte');
    expect(fel(() => db.query('DELETE FROM tobaksvanor WHERE anteckning_id = ?').run(ny.id))?.message).toContain('raderas inte');
    // Utan samtal vid besöket registreras ingen åtgärd.
    const utan = journal.skapaAnteckning(a, { typ: tobak.TYP, tobak: ROKARE });
    journal.signera(a, journal.hamtaAnteckningRad(db, utan.id));
    expect(db.query("SELECT count(*) AS n FROM atgarder WHERE kod = 'DV113'").get().n).toBe(1);
    // En rättelse görs med svaren och får egna strukturerade svar.
    const r = journal.ratta(a, journal.hamtaAnteckningRad(db, utan.id), { orsak: 'Fel antal cigaretter', tobak: { ...ROKARE, produkter: { cigaretter: { bruk: 'dagligen', antal: 15 } } } });
    expect(r.version).toBe(2);
    expect(JSON.stringify(r.sokord)).toContain('15 per dag');
    expect(JSON.parse(db.query('SELECT svar FROM tobaksvanor WHERE anteckning_id = ?').get(utan.id).svar).produkter.cigaretter.antal).toBe(25);
    // Mallen har inga sökord som systemförvaltningen kan ändra.
    expect(konfiguration.parametrar()['journal.sokord.Tobaksvanor']).toBeUndefined();
    expect(konfiguration.mallar(db).find(m => m.typ === 'Tobaksvanor')).toMatchObject({ strukturerad: true, kategori: 'omvardnad' });
  });

  test('API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const ny = await k.post('/api/patient/p01/anteckningar', { typ: 'Tobaksvanor', tobak: ROKARE });
    expect(ny.status).toBe(201);
    expect(ny.data.vardkontakt).toBeTruthy();
    expect((await k.post(`/api/anteckning/${ny.data.id}/signera`, {})).status).toBe(200);
    const las = await k.get(`/api/anteckning/${ny.data.id}`);
    expect(las.data.tobak.forslag.kod).toBe('DV113');
    const ov = await k.get('/api/patient/p01/oversikt');
    expect(ov.data.tobak.senaste).toMatchObject({ anteckningId: ny.data.id, text: 'Cigaretter dagligen, 25 per dag.' });
    // Undersköterskan läser men skriver inte anteckningar, och vårdadministratören ser inga levnadsvanor.
    await k.logga('usk-kard');
    expect((await k.post('/api/patient/p01/anteckningar', { typ: 'Tobaksvanor', tobak: ROKARE })).status).toBe(403);
    expect((await k.get('/api/patient/p01/oversikt')).data.tobak.senaste.text).toContain('Cigaretter');
    await k.logga('adm-kard');
    expect((await k.get('/api/patient/p01/oversikt')).data.tobak).toBeNull();
    expect((await k.post('/api/patient/p01/anteckningar', { typ: 'Tobaksvanor', tobak: ROKARE })).status).toBe(403);
  });

  test('en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten', async () => {
    const svar = async (medSparrad) => {
      const k = klient(app);
      if (medSparrad) {
        await k.logga('lak-psyk');
        const a = await k.post('/api/patient/p04/anteckningar', { typ: 'Tobaksvanor', tobak: { produkter: { tobakssnus: { bruk: 'dagligen', antal: 10 } }, stod: 'avbojt' } });
        expect(a.status).toBe(201);
        expect((await k.post(`/api/anteckning/${a.data.id}/signera`, {})).status).toBe(200);
      }
      await k.logga('lak-kard');
      const ov = await k.get('/api/patient/p04/oversikt');
      expect(ov.status).toBe(200);
      return ov.data.tobak;
    };
    const utan = await svar(false);
    const med = await svar(true);
    expect(utan).toEqual({ senaste: null });
    expect(JSON.stringify(med)).toBe(JSON.stringify(utan));
  });
});

describe('Epikris och mätvärden', () => {
  test('epikrisen får Orsak till vård ur vårdtillfället och diagnoserna, och läkaren skriver bara förloppet och uppföljningen', () => {
    // Runda 11, r1: Sussas testdata läggs vid NU, och vårdrelationen prövas mot klockan, så klockan står på NU.
    stallKlockan(NU);
    const db = byggSeed(NU);
    laddaTestdata(db, personal(db, 'lak-kard'), { nu: NU });
    const f = strukturerad.epikrisForslag(atk(db, 'lak-kard', 'sus07', 'skriv_journal'));
    expect(f.vardtillfalle.orsak).toBe('Feber och frossa');
    expect(f.sokord['Orsak till vård']).toContain('Feber och frossa.');
    expect(f.sokord['Orsak till vård']).toContain('Sepsis, ospecificerad (A41.9), huvuddiagnos');
    expect(f.sokord['Förlopp']).toBeUndefined();
    expect(f.text).toContain('förloppet och uppföljningen');
    // Bara läkare skriver epikriser.
    expect(fel(() => strukturerad.epikrisForslag(atk(db, 'ssk-kard', 'sus07', 'skriv_journal')))).toMatchObject({ status: 403 });
  });

  test('epikrisens förslag bygger bara på det läkaren får se: en spärrad eller annan vårdenhets diagnos ändrar inte förslaget', () => {
    const db = byggSeed(NU);
    const fore = JSON.stringify(strukturerad.epikrisForslag(atk(db, 'lak-kard', 'p04', 'skriv_journal')));
    const vt = db.query('SELECT id FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get('p04');
    const vk = db.query('SELECT id FROM vardkontakter WHERE vardtillfalle_id = ?').get(vt.id);
    // En huvuddiagnos från den spärrade psykiatrin och en från ortopeden på samma vårdkontakt.
    const ins = db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES ('p04', ?, ?, ?, ?, 'huvud', '2026-11-07', 'vardkallan')");
    ins.run('uso-psyk', vk.id, 'F32.9', 'Depressiv episod, ospecificerad');
    ins.run('uso-ort', vk.id, 'S72.0', 'Fraktur på lårbenshalsen');
    expect(JSON.stringify(strukturerad.epikrisForslag(atk(db, 'lak-kard', 'p04', 'skriv_journal')))).toBe(fore);
    expect(fore).not.toContain('F32');
  });

  test('längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI', async () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01', 'registrera_matvarde');
    const fore = db.query('SELECT count(*) AS n FROM matvarden').get().n;
    const r = strukturerad.registreraFlera(a, { langd: '165', vikt: '75', blodtryck: '140/90', puls: '83' });
    expect(r.matvarden.map(m => m.typ)).toEqual(['langd', 'vikt', 'blodtryck', 'puls']);
    expect(r.bmi).toBe(27.5);
    expect(r.text).toBe('Längd 165 cm, Vikt 75 kg, Blodtryck 140/90 mmHg, Puls 83 slag/min är registrerat. BMI 27,5.');
    const rader = db.query('SELECT tid, vardkontakt_id FROM matvarden WHERE id IN (?, ?, ?, ?)').all(...r.matvarden.map(m => m.id));
    expect(new Set(rader.map(x => x.tid)).size).toBe(1);
    expect(new Set(rader.map(x => x.vardkontakt_id)).size).toBe(1);
    // Ett fel i ett värde: inget sparas, och felet pekar på fältet.
    expect(fel(() => strukturerad.registreraFlera(a, { langd: '165', puls: '900' }))).toMatchObject({ status: 400, extra: { falt: ['puls'] } });
    expect(fel(() => strukturerad.registreraFlera(a, {}))).toMatchObject({ status: 400 });
    expect(db.query('SELECT count(*) AS n FROM matvarden').get().n).toBe(fore + 4);
    // API:t kräver behörighet att registrera mätvärden.
    const k = klient(app);
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p01/matvarden/flera', { puls: '80' })).status).toBe(403);
    await k.logga('ssk-kard');
    const ok = await k.post('/api/patient/p01/matvarden/flera', { langd: '180', vikt: '81' });
    expect(ok.status).toBe(201);
    expect(ok.data.bmi).toBe(25);
  });
});

describe('Övningar per vårdenhet', () => {
  test('personalen gör vårdgivarens och den egna vårdenhetens övningar, och de egna har ett eget prefix', () => {
    const db = byggSeed(NU);
    const ssk = personal(db, 'ssk-kard');
    const o = utbildning.oversikt(db, ssk, { nu: NU });
    const egna = o.ovningar.filter(x => x.enhet);
    expect(egna.map(x => x.id)).toEqual(['e.tobak-hjarta']);
    expect(o.vardenhet).toMatchObject({ id: 'uso-kard', namn: 'Kardiologiska kliniken USÖ', version: 1, antalEgna: 1 });
    expect(JSON.stringify(o.ovningar)).not.toContain('"ratt"');
    // En annan vårdenhet har inga egna övningar.
    expect(utbildning.oversikt(db, personal(db, 'ssk-vc'), { nu: NU }).ovningar.some(x => x.enhet)).toBe(false);
    // Rätt svar på alla, också den egna, ger intyget.
    const svar = Object.fromEntries(utbildning.ovningarFor('sjukskoterska').map(x => [x.id, x.ratt]));
    expect(fel(() => utbildning.ratta(db, ssk, svar, { nu: NU }))).toMatchObject({ status: 400, extra: { falt: ['e.tobak-hjarta'] } });
    expect(utbildning.ratta(db, ssk, { ...svar, 'e.tobak-hjarta': 'b' }, { nu: NU })).toMatchObject({ godkand: true, antal: o.ovningar.length });
  });

  test('vårdenhetens verksamhetschef och utbildare ändrar de egna övningarna som en ny version med egen historik', async () => {
    const db = byggSeed(NU);
    const vch = personal(db, 'vch-kard');
    const r = utbildning.redigera(db, vch, { nu: NU, omfang: 'enhet' });
    expect(r).toMatchObject({ omfang: 'enhet', vardenhet: { id: 'uso-kard' }, version: 1 });
    expect(r.historik.map(h => [h.version, h.av])).toEqual([[1, 'Ulrika Sandell']]);
    const ny = [...r.ovningar, { id: 'telemetri', roller: ['sjukskoterska'], fraga: 'Var ser du larmen från telemetrin på avdelningen?', alternativ: [{ id: 'x0', text: 'I inkorgen' }, { id: 'x1', text: 'Ingenstans' }], ratt: 'x0', forklaring: 'Larmen kommer till inkorgen för den som har patienten.' }];
    const v2 = utbildning.sparaVersion(db, personal(db, 'ssk-kard'), { omfang: 'enhet', ovningar: ny, andring: 'Ny övning om telemetrin.' }, { nu: NU });
    expect(v2).toMatchObject({ version: 2, text: expect.stringContaining('Kardiologiska kliniken USÖ') });
    expect(v2.historik[0]).toMatchObject({ version: 2, av: 'Johan Ek', andring: 'Ny övning om telemetrin.', antal: 2 });
    // Vårdgivarens övningar och historik ändras inte.
    expect(utbildning.redigera(db, vch, { nu: NU }).version).toBe(1);
    // De egna övningarna behöver inte täcka alla yrkesroller, och alla kan tas bort.
    expect(utbildning.sparaVersion(db, vch, { omfang: 'enhet', ovningar: [], andring: 'Tar bort de egna övningarna.' }, { nu: NU }).version).toBe(3);
    expect(utbildning.oversikt(db, personal(db, 'ssk-kard'), { nu: NU }).ovningar.some(x => x.enhet)).toBe(false);
    expect(fel(() => db.query('UPDATE enhetsovningar SET andring = ? WHERE version = 1').run('x'))?.message).toContain('ändras inte');
    expect(fel(() => db.query('DELETE FROM enhetsovningar WHERE version = 1').run())?.message).toContain('raderas inte');
    // Ingen annan ändrar dem: en läkare utan utbildarintyg och en utbildare på en annan vårdenhet.
    for (const id of ['lak-kard', 'usk-kard', 'ssk-vc', 'adm-kard']) {
      expect(fel(() => utbildning.redigera(db, personal(db, id), { nu: NU, omfang: 'enhet' }))).toMatchObject({ status: 403 });
      expect(fel(() => utbildning.sparaVersion(db, personal(db, id), { omfang: 'enhet', ovningar: [], andring: 'Försök att ändra' }, { nu: NU }))).toMatchObject({ status: 403 });
    }
    expect(fel(() => utbildning.redigera(db, vch, { nu: NU, omfang: 'annat' }))).toMatchObject({ status: 400 });
    // Samma via API:t.
    const k = klient(app);
    await k.logga('vch-kard');
    const g = await k.get('/api/utbildning/ovningar?omfang=enhet');
    expect(g.status).toBe(200);
    expect(g.data.vardenhet.id).toBe('uso-kard');
    const p = await k.post('/api/utbildning/ovningar', { omfang: 'enhet', ovningar: [], andring: 'Inga egna övningar.' });
    expect(p.status).toBe(201);
    expect(p.data.historik).toHaveLength(2);
    expect((await k.get('/api/utbildning')).data.kanAndraEnhet).toEqual({ id: 'uso-kard', namn: 'Kardiologiska kliniken USÖ' });
  });
});

describe('Parametrar för utloggning och rapportering', () => {
  test('utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut', () => {
    const p = konfiguration.parametrar();
    expect(p['sakerhet.utloggning_personal_min']).toMatchObject({ omrade: 'sakerhet', standard: 30, min: 5, max: 120 });
    expect(p['sakerhet.utloggning_invanare_min']).toMatchObject({ omrade: 'sakerhet', standard: 30, min: 5, max: 60 });
    expect(konfiguration.OMRADEN.sakerhet.sussa).toBe('12.1.1.5');
    expect(konfiguration.prova('sakerhet.utloggning_personal_min', 4)).toMatchObject({ ok: false, varfor: expect.stringContaining('Lägsta värde är 5 minuter') });
    expect(konfiguration.prova('sakerhet.utloggning_personal_min', 121).varfor).toContain('två timmar');
    expect(konfiguration.prova('sakerhet.utloggning_invanare_min', 90).varfor).toContain('bibliotek');
    expect(konfiguration.prova('sakerhet.utloggning_personal_min', '15')).toEqual({ ok: true, varde: 15 });
  });

  test('en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const f = await k.post('/api/konfiguration', { nyckel: 'sakerhet.utloggning_personal_min', varde: 10, giltigFran: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }), motivering: 'Kortare tid på akutens gemensamma datorer.' });
    expect(f.status).toBe(201);
    expect((await k.post(`/api/konfiguration/${f.data.andring.id}/godkann`, {})).status).toBe(403);
    await k.logga('sysf-2');
    expect((await k.post(`/api/konfiguration/${f.data.andring.id}/godkann`, {})).status).toBe(200);
    await k.logga('lak-kard');
    expect((await k.get('/api/session')).data.inloggning.minuter).toBe(10);
    sandlada(app, k).aktiv = Date.now() - 11 * 60_000;
    expect((await k.get('/api/inkorg')).status).toBe(401);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT beskrivning FROM sakerhetslogg WHERE typ = 'utloggning' ORDER BY id DESC LIMIT 1").get().beskrivning).toBe('Utloggning efter 10 minuter utan aktivitet.');
    // Invånaren i samma sandlåda har kvar sin gräns.
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect((await k.get('/api/session')).data.inloggning.minuter).toBe(30);
    sandlada(app, k).aktiv = Date.now() - 11 * 60_000;
    expect((await k.get('/api/min/journal/p01')).status).toBe(200);
  });

  test('undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten', () => {
    const p = konfiguration.parametrar()['rapportering.bhvq_undanta_skyddad'];
    expect(p).toMatchObject({ typ: 'janej', standard: bhvq.UNDANTA_SKYDDAD, omrade: 'administration' });
    expect(konfiguration.prova('rapportering.bhvq_undanta_skyddad', 'nej')).toEqual({ ok: true, varde: false });
    expect(konfiguration.prova('rapportering.bhvq_undanta_skyddad', 'kanske').ok).toBe(false);
    const db = byggSeed(NU);
    db.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p61'").run();
    const lak = personal(db, 'lak-vc');
    expect(bhvq.sammanstall(db, lak).undantagna).toEqual({ motsatt: 0, skyddad: 1 });
    const f = konfiguration.foresla(db, personal(db, 'sysf'), { nyckel: 'rapportering.bhvq_undanta_skyddad', varde: false, giltigFran: '2026-11-08', motivering: 'Vårdgivaren har beslutat att rapportera alla barn.' }, NU);
    expect(f.andring).toMatchObject({ vardeText: 'Rapporteras som andra barn', forraText: 'Rapporteras inte till registret' });
    expect(konfiguration.forhandsvisa(db, personal(db, 'sysf'), { nyckel: 'rapportering.bhvq_undanta_skyddad', varde: 'ja' }, NU)).toMatchObject({ ok: false, varfor: 'Det gäller redan: rapporteras inte till registret.' });
    konfiguration.godkann(db, personal(db, 'sysf-2'), f.andring.id, {}, NU);
    const s = bhvq.sammanstall(db, lak);
    expect(s.undantagna).toEqual({ motsatt: 0, skyddad: 0 });
    expect(s.demoregel).toContain('rapporteras till registret med personnumret men utan namn');
    const barnet = s.barn.find(b => b.patient.id === 'p61');
    expect(barnet.patient.namn).toBe('Skyddad identitet');
  });
});

describe('Version 1.0', () => {
  const post = (id, kapitel, kategori, status) => ({ id, kapitel, kategori, status });
  test('villkoren räknas ur registret, testfallen och säkerhetsfynden, och 1.0 nås bara när alla fyra är uppfyllda', () => {
    const testfall = [{ nr: '1.1', tidsklass: 6, korningar: [{}] }, { nr: '1.2', tidsklass: 6, korningar: [{}] }];
    const register = { poster: [post('2.1.1.1', '2', 'system', 'uppfyllt_demo'), post('3.1.1.1', '3', 'system', 'uppfyllt_demo'), post('3.1.1.2', '3', 'nationell', 'planerat'), post('4.1.1.1', '4', 'system', 'delvis')] };
    const st = { aktuell: true, testfall: [{ nr: '1.1', uppnatt: true, uppskattadTidS: 100 }, { nr: '1.2', uppnatt: true, uppskattadTidS: 300 }] };
    const v = villkor10(register, st, { version: '0.8.0', fynd: { oppna: [] }, testfall });
    expect(v.villkor.map(x => x.uppfyllt)).toEqual([true, true, true, true]);
    expect(v).toMatchObject({ uppfyllt: true, version: '0.8.0', princip: PRINCIP, inteVarden: INTE_VARDEN });
    // Ett testfall över den maximala tiden, en planerad systempost, en delvis post i kapitel 5 och ett öppet fynd.
    const v2 = villkor10({ poster: [...register.poster, post('5.1.1.1', '5', 'system', 'delvis'), post('6.1.1.1', '6', 'system', 'planerat')] },
      { aktuell: true, testfall: [st.testfall[0], { ...st.testfall[1], uppskattadTidS: 360 }] }, { fynd: { oppna: [{ id: 'S1' }] }, testfall });
    expect(v2.villkor.map(x => [x.id, x.uppfyllt, x.antal, x.total])).toEqual([['a', false, 4, 5], ['b', false, 2, 4], ['c', false, 1, 2], ['d', false, 1, null]]);
    expect(v2.uppfyllt).toBe(false);
    expect(v2.villkor[0].text).toContain('1 post av 5');
    // Ett inaktuellt resultat av testfallen räknas inte.
    expect(villkor10(register, { ...st, aktuell: false }, { fynd: { oppna: [] }, testfall }).villkor[2]).toMatchObject({ uppfyllt: false, antal: 0 });
    expect(INTE_VARDEN).toContain('CE-märkning');
    for (const t of [PRINCIP, INTE_VARDEN]) expect(t).not.toMatch(/[–—…]/);
  });

  test('API: krav/version ger versionen ur package.json och de fyra villkoren utan inloggning, och listan med säkerhetsfynd är tom', async () => {
    expect(lasFynd()).toMatchObject({ oppna: [] });
    const r = await klient(app).get('/api/krav/version');
    expect(r.status).toBe(200);
    expect(r.data.version).toBe(JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).version);
    expect(r.data.villkor.map(v => v.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.data.villkor[3]).toMatchObject({ uppfyllt: true, antal: 0 });
    expect(r.data.villkor[2].total).toBe(34);
    expect(r.data.uppfyllt).toBe(r.data.villkor.every(v => v.uppfyllt));
  });
});
