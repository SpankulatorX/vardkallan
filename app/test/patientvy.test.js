import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { lasSandlada, addDagar, idag, datumAv } from '../src/db.js';
import { verifiera } from '../src/logg.js';
import { aktivaSparrar } from '../src/atkomst.js';
import * as minJournal from '../src/patientvy.js';
import { PERSONAL } from '../src/seed/personal.js';
import { PATIENTER } from '../src/seed/patienter.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const DAG = 86400_000;
const som = async (invanareId) => {
  const k = klient(app);
  const r = await k.post('/api/login/invanare', { invanareId });
  if (r.status !== 200) throw new Error(JSON.stringify(r.data));
  return k;
};
const db = (k) => sandlada(app, k).db;
const loggrader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
// Alla nycklar i ett svar, rekursivt.
const nycklar = (v, ut = new Set()) => {
  if (Array.isArray(v)) v.forEach(x => nycklar(x, ut));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { ut.add(k); nycklar(x, ut); }
  return ut;
};
const DELAR = ['oversikt', 'anteckningar', 'diagnoser', 'lakemedel', 'provsvar', 'remisser', 'vardkontakter', 'logglista', 'sparrar'];

describe('Min journal', () => {
  test('inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter', async () => {
    const k = klient(app);
    expect((await k.post('/api/login/invanare', { invanareId: 'finns-inte' })).status).toBe(400);
    expect((await k.post('/api/login/invanare', { personalId: 'lak-kard' })).status).toBe(400);
    const r = await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/^vk_sid=/);
    expect(r.data).toMatchObject({
      inloggad: true, roll: 'invanare', invanare: { id: 'inv-p01', namn: 'Gunnar Åkesson', personnummer: '19450202-4732' },
      journaler: [{ patientId: 'p01', relation: 'egen', atkomst: true }],
    });
    for (const nyckel of ['personal', 'enhet', 'behorigheter', 'lasnyckel']) expect(r.data[nyckel]).toBeUndefined();
    expect((await k.get('/api/session')).data).toMatchObject({ inloggad: true, roll: 'invanare' });
    // Personalens session säger vilken roll den har.
    const p = klient(app);
    expect((await p.logga('lak-kard')).data.roll).toBe('personal');
  });

  test('patienten når sin egen journal men inte någon annans, oavsett id i adressen', async () => {
    const k = await som('inv-p01');
    const egen = await k.get('/api/min/journal/p01');
    expect(egen.status).toBe(200);
    expect(egen.data.patient).toMatchObject({ id: 'p01', namn: 'Gunnar Åkesson' });
    const finnsInte = await k.get('/api/min/journal/p99');
    expect(finnsInte.status).toBe(404);
    // En annan patient som finns ger exakt samma svar som en som inte finns.
    for (const pid of ['p02', 'p03', 'p09', 'p12']) {
      for (const del of ['', ...DELAR.map(d => `/${d}`)]) {
        const r = await k.get(`/api/min/journal/${pid}${del}`);
        expect({ pid, del, status: r.status, data: r.data }).toEqual({ pid, del, status: 404, data: finnsInte.data });
      }
      expect((await k.post(`/api/min/journal/${pid}/begaran`, { typ: 'loggutdrag' })).status).toBe(404);
    }
    // En anteckning i en annan patients journal går inte att läsa genom den egna journalens adress.
    const annan = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p02' AND status = 'signerad'").get().id;
    expect((await k.get(`/api/min/journal/p01/anteckning/${annan}`)).status).toBe(404);
    expect((await k.get(`/api/min/journal/p02/anteckning/${annan}`)).status).toBe(404);
    for (const v of ['%2E%2E%2Fp02', 'p01%2F..%2Fp02', '__proto__', 'p01/constructor', 'p01/anteckning/abc']) {
      expect((await k.get(`/api/min/journal/${v}`)).status).toBe(404);
    }
    // Försöken mot en journal som finns loggas som nekade på den journalen, med invånaren.
    const nekade = loggrader(k).filter(r => r.invanare_id === 'inv-p01' && r.resultat === 'nekad');
    expect(nekade.length).toBeGreaterThan(0);
    expect(nekade.every(r => r.patient_id !== 'p01' && r.personal_id === null && r.grund === 'nekad')).toBe(true);
  });

  test('patientsessionen når inga av personalens API:er', async () => {
    const k = await som('inv-p01');
    const fore = loggrader(k).length;
    const get = ['/api/arbetslista', '/api/sok?q=Åkesson', '/api/vantrum', '/api/lasekopia', '/api/patient/p01', '/api/patient/p01/oversikt',
      '/api/patient/p01/anteckningar', '/api/anteckning/1', '/api/patient/p01/lakemedel', '/api/lakemedel/katalog?q=a', '/api/patient/p01/matvarden',
      '/api/patient/p01/remisser', '/api/remisser', '/api/inkorg', '/api/patient/p01/logglista', '/api/logg', '/api/migrering'];
    for (const v of get) {
      const r = await k.get(v);
      expect({ v, status: r.status, kod: r.data.kod }).toEqual({ v, status: 401, kod: 'ej_inloggad' });
    }
    const post = [['/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Prövar' }], ['/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'x' }] }],
      ['/api/lasekopia/logg', { rader: [] }], ['/api/patient/p01/lakemedel/kontroll', {}], ['/api/patient/p01/lakemedel', {}], ['/api/patient/p01/matvarden', { typ: 'puls', varde: 70 }],
      ['/api/patient/p01/remisser', {}], ['/api/remiss/1/mottag', {}], ['/api/remiss/1/kvittera-svar', {}], ['/api/demo/nll-timeout', {}], ['/api/ordination/1/utsatt', { orsak: 'x' }],
      ['/api/anteckning/1/signera', {}]];
    for (const [v, kropp] of post) {
      const r = await k.post(v, kropp);
      expect({ v, status: r.status }).toEqual({ v, status: 401 });
    }
    expect((await k.put('/api/anteckning/1', { sokord: [] })).status).toBe(401);
    // Inget av försöken lämnade ut något eller loggades som en åtkomst.
    expect(loggrader(k).length).toBe(fore);
    // Det som är öppet för alla är öppet också för invånaren.
    for (const v of ['/api/krav', '/api/drift', '/api/health', '/api/mallar']) expect((await k.get(v)).status).toBe(200);
  });

  test('personalens session når inte Min journal', async () => {
    const k = klient(app);
    expect((await k.get('/api/min/journal/p01')).status).toBe(401);
    await k.logga('lak-kard');
    for (const del of ['', ...DELAR.map(d => `/${d}`)]) {
      const r = await k.get(`/api/min/journal/p01${del}`);
      expect({ del, status: r.status, kod: r.data.kod }).toEqual({ del, status: 401, kod: 'ej_inloggad' });
    }
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'loggutdrag' })).status).toBe(401);
    expect((await k.get('/api/demo/invanare')).status).toBe(200);
  });

  test('utloggning och byte av roll i samma webbläsare nollställer sessionen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Inskrivning' });
    expect((await k.get('/api/patient/p01')).data.andraEnheterVisade).toBe(true);
    const personalKaka = k.kaka();
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    // Ny sessionskaka: den gamla kakan är inte längre inloggad, varken som personal eller invånare.
    expect(k.kaka()).not.toBe(personalKaka);
    const gammal = await fetch(`${app.url}/api/session`, { headers: { Cookie: personalKaka } }).then(r => r.json());
    expect(gammal.inloggad).toBe(false);
    expect((await k.get('/api/patient/p01')).status).toBe(401);
    expect((await k.get('/api/min/journal/p01')).status).toBe(200);
    const s = sandlada(app, k);
    expect([s.personalId, s.invanareId, Object.keys(s.val).length, s.lasnyckel]).toEqual([null, 'inv-p01', 0, null]);
    // Personalen loggar in igen i samma webbläsare: invånaren är utloggad och de tidigare valen är borta.
    await k.logga('lak-kard');
    expect((await k.get('/api/min/journal/p01')).status).toBe(401);
    expect((await k.get('/api/patient/p01')).data.andraEnheterVisade).toBe(false);
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const ut = await k.post('/api/logout', {});
    expect(ut.data).toMatchObject({ inloggad: false });
    expect(ut.data.roll).toBeUndefined();
    expect((await k.get('/api/min/journal/p01')).status).toBe(401);
    expect(sandlada(app, k).invanareId).toBeNull();
  });

  test('patientvyn får ingen läskopia', async () => {
    const k = await som('inv-p01');
    expect((await k.get('/api/session')).data.lasnyckel).toBeUndefined();
    expect((await k.get('/api/lasekopia')).status).toBe(401);
    const rad = { id: 'rad-invanare-1', tid: new Date().toISOString(), patientId: 'p01', handling: 'las_oversikt', resurs: '/patient/p01' };
    expect((await k.post('/api/lasekopia/logg', { rader: [rad] })).status).toBe(401);
    const fore = loggrader(k).length;
    const ut = await k.post('/api/logout', { rader: [rad] });
    expect(ut.status).toBe(200);
    expect(ut.data.lasloggen).toBeUndefined();
    expect(loggrader(k).length).toBe(fore);
    const s = sandlada(app, k);
    expect([s.kopia.size, s.oppnade.size, s.lasnyckel]).toEqual([0, 0, null]);
  });

  test('bara signerade anteckningar visas', async () => {
    const p = klient(app);
    await p.logga('lak-kard');
    const utkast = (await p.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Utkast som inte är klart.' }] })).data;
    // Samma sandlåda: invånaren loggar in i samma webbläsare.
    const k = p;
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const seedUtkast = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND status = 'utkast' AND id <> ?").get(utkast.id).id;
    const lista = (await k.get('/api/min/journal/p01/anteckningar')).data;
    const ids = lista.anteckningar.map(a => a.id);
    expect(ids).not.toContain(utkast.id);
    expect(ids).not.toContain(seedUtkast);
    expect(JSON.stringify(lista)).not.toContain('Utkast som inte är klart');
    expect((await k.get(`/api/min/journal/p01/anteckning/${utkast.id}`)).status).toBe(404);
    // Signerade anteckningar visas, och en rättad anteckning visas i sin senaste version med den gamla kvar.
    const signerade = db(k).query("SELECT count(*) AS n FROM anteckningar a WHERE patient_id = 'p01' AND status = 'signerad' AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id)").get().n;
    expect(lista.anteckningar.length).toBe(signerade);
    const rattad = lista.anteckningar.find(a => a.rattad);
    const full = (await k.get(`/api/min/journal/p01/anteckning/${rattad.id}`)).data;
    expect(full.versioner.length).toBe(2);
    expect(full.versioner[0].ersatt).toBe(true);
    expect(full.rattelseOrsak).toBe('Fel värde för NT-proBNP i första versionen.');
    // Personalen signerar utkastet: då visas det.
    await p.post('/api/login', { personalId: 'lak-kard' });
    expect((await p.post(`/api/anteckning/${utkast.id}/signera`, {})).status).toBe(200);
    await p.post('/api/login/invanare', { invanareId: 'inv-p01' });
    expect((await p.get('/api/min/journal/p01/anteckningar')).data.anteckningar.map(a => a.id)).toContain(utkast.id);
  });

  test('anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas', async () => {
    const k = await som('inv-p04');
    const d = db(k);
    const dold = d.query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' AND typ = 'Omvårdnadsanteckning'").get().id;
    const lista = (await k.get('/api/min/journal/p04/anteckningar')).data;
    expect(lista.anteckningar.map(a => a.id)).not.toContain(dold);
    expect(lista.ejVisade).toEqual([{ typ: 'Omvårdnadsanteckning', vardenhet: 'Allmänpsykiatriska kliniken USÖ', antal: 1, motivering: expect.stringContaining('visar inte sina omvårdnadsanteckningar') }]);
    expect((await k.get(`/api/min/journal/p04/anteckning/${dold}`)).status).toBe(404);
    // Kardiologins omvårdnadsanteckningar omfattas inte av regeln.
    expect(lista.anteckningar.some(a => a.typ === 'Omvårdnadsanteckning' && a.vardenhet === 'Kardiologiska kliniken USÖ')).toBe(true);
    // Reglerna redovisas i huvudet, och de kommer från seeden, inte från koden.
    expect((await k.get('/api/min/journal/p04')).data.begransningar.regler.map(r => r.visning)).toEqual(['fordrojd', 'visas_inte']);
    d.query("UPDATE visningsregler SET visning = 'direkt' WHERE anteckningstyp = 'Omvårdnadsanteckning'").run();
    expect((await k.get('/api/min/journal/p04/anteckningar')).data.anteckningar.map(a => a.id)).toContain(dold);
  });

  test('fördröjd anteckningstyp visas först efter fördröjningen', async () => {
    const k = await som('inv-p15');
    const d = db(k);
    const ny = d.query("SELECT * FROM anteckningar WHERE patient_id = 'p15' AND typ = 'Mottagningsanteckning' ORDER BY skapad DESC LIMIT 1").get();
    const lista = (await k.get('/api/min/journal/p15/anteckningar')).data;
    expect(lista.anteckningar.map(a => a.id)).not.toContain(ny.id);
    expect(lista.senare).toEqual([{ typ: 'Mottagningsanteckning', vardenhet: 'Allmänpsykiatriska kliniken USÖ', arbetsplats: null, signerad: ny.signerad_tid, visasFran: new Date(Date.parse(ny.signerad_tid) + 14 * DAG).toISOString() }]);
    expect(JSON.stringify(lista)).not.toContain('I remission');
    expect((await k.get(`/api/min/journal/p15/anteckning/${ny.id}`)).status).toBe(404);
    // De äldre mottagningsanteckningarna har passerat fördröjningen och visas.
    expect(lista.anteckningar.filter(a => a.typ === 'Mottagningsanteckning').length).toBe(3);
    // Fjorton dagar efter signeringen visas den.
    const atk = new minJournal.InvanareAtkomst(d, minJournal.invanareRad(d, 'inv-p15'), 'p15');
    atk.krav();
    const fore = minJournal.anteckningar(atk, new Date(Date.parse(ny.signerad_tid) + 14 * DAG - 60_000));
    const efter = minJournal.anteckningar(atk, new Date(Date.parse(ny.signerad_tid) + 14 * DAG));
    expect(fore.anteckningar.map(a => a.id)).not.toContain(ny.id);
    expect(efter.anteckningar.map(a => a.id)).toContain(ny.id);
    expect(efter.senare).toEqual([]);
    // Personalen ser anteckningen direkt.
    await k.logga('lak-psyk');
    expect((await k.get('/api/patient/p15/anteckningar')).data.anteckningar.map(a => a.id)).toContain(ny.id);
  });

  test('provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt', async () => {
    const k = await som('inv-p01');
    const d = db(k);
    const inr = d.query("SELECT * FROM matvarden WHERE patient_id = 'p01' AND typ = 'inr' ORDER BY tid DESC LIMIT 1").get();
    expect(inr.vidimerad).toBeNull();
    const ps = (await k.get('/api/min/journal/p01/provsvar')).data;
    expect(ps.provsvar.map(m => m.id)).not.toContain(inr.id);
    expect(ps.vantar).toEqual([{ namn: 'PK (INR)', provtagen: inr.tid, visasSenast: datumAv(new Date(Date.parse(inr.tid) + 14 * DAG)) }]);
    // Gårdagens INR är vidimerat och visas, och vitalparametrarna visas direkt utan vidimering.
    expect(ps.provsvar.some(m => m.typ === 'inr' && m.varde === 2.6 && m.vidimerad === true)).toBe(true);
    expect(ps.matvarden.some(m => m.typ === 'puls')).toBe(true);
    expect(ps.matvarden.every(m => m.vidimerad === null && m.provsvar === false)).toBe(true);
    // Personalen registrerar ett nytt mätvärde och ett nytt provsvar.
    await k.logga('lak-kard');
    const puls = (await k.post('/api/patient/p01/matvarden', { typ: 'puls', varde: 77 })).data;
    const crp = (await k.post('/api/patient/p01/matvarden', { typ: 'crp', varde: 31 })).data;
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const ps2 = (await k.get('/api/min/journal/p01/provsvar')).data;
    expect(ps2.matvarden.map(m => m.id)).toContain(puls.id);
    expect(ps2.provsvar.map(m => m.id)).not.toContain(crp.id);
    // Vidimerat visas det direkt. Utan vidimering visas det 14 dagar efter provtagningen.
    const atk = new minJournal.InvanareAtkomst(d, minJournal.invanareRad(d, 'inv-p01'), 'p01');
    atk.krav();
    const t = Date.parse(crp.tid);
    expect(minJournal.provsvar(atk, new Date(t + 14 * DAG - 60_000)).provsvar.map(m => m.id)).not.toContain(crp.id);
    expect(minJournal.provsvar(atk, new Date(t + 14 * DAG)).provsvar.map(m => m.id)).toContain(crp.id);
    d.query('UPDATE matvarden SET vidimerad = ? WHERE id = ?').run(new Date().toISOString(), crp.id);
    expect((await k.get('/api/min/journal/p01/provsvar')).data.provsvar.map(m => m.id)).toContain(crp.id);
  });

  test('spärrade uppgifter visas för patienten själv och spärren redovisas', async () => {
    const k = await som('inv-p04');
    const h = (await k.get('/api/min/journal/p04')).data;
    expect(h.sparrar).toEqual([{ vardenhetId: 'uso-psyk', vardenhet: 'Allmänpsykiatriska kliniken USÖ', sedan: addDagar(idag(), -365) }]);
    const ant = (await k.get('/api/min/journal/p04/anteckningar')).data.anteckningar;
    expect(ant.some(a => a.vardenhet === 'Allmänpsykiatriska kliniken USÖ' && a.typ === 'Mottagningsanteckning')).toBe(true);
    expect((await k.get('/api/min/journal/p04/diagnoser')).data.diagnoser.map(d => d.kod)).toContain('F33.1');
    expect((await k.get('/api/min/journal/p04/lakemedel')).data.aktuella.some(o => o.vardenhet === 'Allmänpsykiatriska kliniken USÖ')).toBe(true);
    const sp = (await k.get('/api/min/journal/p04/sparrar')).data;
    expect(sp.vardenheter.find(e => e.id === 'uso-psyk')).toMatchObject({ sparrad: true });
    expect(sp.kanBegaraSparr).toBe(true);
    // Spärren gäller fortfarande för andra vårdenheter.
    await k.logga('lak-kard');
    expect(JSON.stringify((await k.get('/api/patient/p04/anteckningar')).data)).not.toContain('Allmänpsykiatriska');
  });

  test('logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    await k.get('/api/patient/p01');
    await k.get('/api/patient/p01/anteckningar');
    await k.logga('logg');
    await k.get('/api/patient/p01/logglista');
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const l = (await k.get('/api/min/journal/p01/logglista')).data;
    expect(l.kedjaHel).toBe(true);
    const ssk = l.rader.find(r => r.handling === 'las_journal' && r.yrkesroll === 'Sjuksköterska');
    expect(ssk).toMatchObject({ vem: 'personal', vardgivare: 'Region Örebro län', vardenhet: 'Kardiologiska kliniken USÖ', arbetsplats: 'Avdelning 72, kardiologi', resultat: 'tillaten', egenAtkomst: false });
    expect(['egen_enhet', 'vardrelation']).toContain(ssk.grund);
    expect(Date.now() - Date.parse(ssk.tid)).toBeLessThan(60_000);
    expect(l.rader.find(r => r.handling === 'las_logg')).toMatchObject({ vardenhet: 'Regionkansliet', yrkesroll: 'Logggranskare', grund: 'logggranskning' });
    // Seedens tidigare åtkomster finns med, till exempel akutläkarens.
    expect(l.rader.some(r => r.vardenhet === 'Akutmottagningen USÖ' && r.yrkesroll === 'Läkare')).toBe(true);
    // Inga namn, id eller hashar för personalen.
    const text = JSON.stringify(l);
    for (const p of PERSONAL) { expect(text).not.toContain(p.namn); expect(text).not.toContain(`"${p.id}"`); }
    expect(text).not.toContain('SE2321000164');
    for (const n of ['personal', 'hash', 'syfte', 'resurs', 'personalId', 'namn']) expect(nycklar(l).has(n)).toBe(false);
  });

  test('nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista', async () => {
    const k = await som('inv-p02');
    const nod = (await k.get('/api/min/journal/p02/logglista')).data.rader.filter(r => r.grund === 'nodatkomst');
    expect(nod.length).toBeGreaterThan(0);
    expect(nod[0]).toMatchObject({ vardenhet: 'Akutmottagningen USÖ', yrkesroll: 'Läkare', vem: 'personal' });
    const k4 = await som('inv-p04');
    const sam = (await k4.get('/api/min/journal/p04/logglista')).data.rader.filter(r => r.grund === 'samtycke_sparr');
    expect(sam.length).toBeGreaterThan(0);
    expect(sam[0]).toMatchObject({ vardenhet: 'Kardiologiska kliniken USÖ', yrkesroll: 'Läkare' });
    // Ett nekat försök syns också.
    const k12 = klient(app);
    await k12.logga('adm-kard');
    await k12.get('/api/patient/p12');
    await k12.post('/api/login/invanare', { invanareId: 'inv-p12' });
    expect((await k12.get('/api/min/journal/p12/logglista')).data.rader.some(r => r.resultat === 'nekad' && r.yrkesroll === 'Vårdadministratör')).toBe(true);
  });

  test('patientens egen läsning loggas som egen åtkomst och flaggas inte i logguppföljningen', async () => {
    const k = await som('inv-p01');
    await k.get('/api/min/journal/p01');
    await k.get('/api/min/journal/p01/anteckningar');
    const egna = loggrader(k).filter(r => r.invanare_id === 'inv-p01');
    expect(egna.map(r => [r.patient_id, r.personal_id, r.enhet_id, r.handling, r.grund, r.resultat])).toEqual([
      ['p01', null, null, 'invanare_las', 'egen_atkomst', 'tillaten'], ['p01', null, null, 'invanare_las', 'egen_atkomst', 'tillaten']]);
    expect(egna.map(r => r.resurs)).toEqual(['min:journal', 'min:anteckningar']);
    expect(verifiera(db(k)).hel).toBe(true);
    // I patientens logglista: märkta som egen åtkomst.
    const l = (await k.get('/api/min/journal/p01/logglista')).data;
    expect(l.rader.filter(r => r.egenAtkomst).every(r => r.vem === 'du' && r.grund === 'egen_atkomst' && r.via === 'min_journal')).toBe(true);
    // I logguppföljningen: med, utan namn, och inte flaggade.
    await k.logga('logg');
    const alla = (await k.get('/api/logg?flagga=alla')).data.rader.filter(r => r.invanare);
    expect(alla.length).toBeGreaterThanOrEqual(3);
    expect(alla.every(r => !r.flaggad && r.personal === null && r.invanare.relation === 'egen' && r.invanare.namn === null)).toBe(true);
    for (const f of ['nekad', 'nodatkomst', 'samtycke']) expect((await k.get(`/api/logg?flagga=${f}`)).data.rader.some(r => r.invanare)).toBe(false);
  });

  test('vårdnadshavare läser barnets journal under 13 år men inte från 13 år eller för ett barn med skyddad identitet', async () => {
    const k = await som('inv-vh01');
    const s = (await k.get('/api/session')).data;
    expect(s.journaler).toEqual([{ patientId: 'p09', namn: 'Leo Bergström', personnummer: '20171211-2398', alder: expect.any(Number), relation: 'vardnadshavare', atkomst: true, skal: null }]);
    const h = await k.get('/api/min/journal/p09');
    expect(h.status).toBe(200);
    expect(h.data).toMatchObject({ relation: 'vardnadshavare', kanBegaraSparr: false });
    expect(loggrader(k).at(-1)).toMatchObject({ invanare_id: 'inv-vh01', patient_id: 'p09', grund: 'vardnadshavare', personal_id: null });
    // Logglistan visar vårdnadshavarens egna läsningar som dina.
    expect((await k.get('/api/min/journal/p09/logglista')).data.rader.filter(r => r.egenAtkomst).every(r => r.vem === 'du')).toBe(true);
    // Barnet fyller 13: vårdnadshavaren får skälet, inte journalen.
    const d = db(k);
    d.query('UPDATE patienter SET fodd = ? WHERE id = ?').run(addDagar(idag(), -13 * 366), 'p09');
    const tretton = await k.get('/api/min/journal/p09');
    expect(tretton.status).toBe(403);
    expect(tretton.data.fel).toContain('13 år');
    expect((await k.get('/api/min/journal/p09/anteckningar')).status).toBe(403);
    expect((await k.get('/api/session')).data.journaler[0]).toMatchObject({ atkomst: false });
    // Skyddad identitet: aldrig för vårdnadshavaren, och barnets namn visas inte.
    d.query('UPDATE patienter SET fodd = ?, skyddad = 1 WHERE id = ?').run('2019-05-05', 'p09');
    expect((await k.get('/api/min/journal/p09')).status).toBe(403);
    expect((await k.get('/api/session')).data.journaler[0]).toMatchObject({ namn: 'Skyddad identitet', personnummer: '20171211-****', atkomst: false });
    // Ingen annans journal.
    expect((await k.get('/api/min/journal/p01')).status).toBe(404);
  });

  test('barn under 16 år kan inte logga in själva', async () => {
    const k = klient(app);
    const r = await k.post('/api/login/invanare', { invanareId: 'inv-p09' });
    expect(r.status).toBe(403);
    expect(r.data.fel).toContain('16');
    expect((await k.get('/api/session')).data.inloggad).toBe(false);
    const lista = (await k.get('/api/demo/invanare')).data;
    expect(lista.map(i => i.id)).not.toContain('inv-p09');
    expect(lista.find(i => i.id === 'inv-vh01')).toMatchObject({ namn: 'Johanna Bergström', egenJournal: false, barn: [{ namn: 'Leo Bergström', alder: expect.any(Number) }] });
  });

  test('skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter', async () => {
    const k = klient(app);
    const lista = (await k.get('/api/demo/invanare')).data;
    expect(lista.find(i => i.id === 'inv-p03')).toMatchObject({ namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    const listtext = JSON.stringify(lista);
    expect(listtext).not.toContain('Engberg');
    expect(listtext).not.toContain('198404162383');
    expect(listtext).not.toContain('19840416-2383');
    await k.post('/api/login/invanare', { invanareId: 'inv-p03' });
    const h = (await k.get('/api/min/journal/p03')).data;
    expect(h.patient).toMatchObject({ namn: 'Malin Engberg', personnummer: '19840416-2383', skyddad: true });
    const allt = {};
    for (const del of DELAR) allt[del] = (await k.get(`/api/min/journal/p03/${del}`)).data;
    const text = JSON.stringify(allt);
    // Remissen till kardiologen finns, men inga andra patienter och inga kontaktuppgifter.
    expect(allt.remisser.remisser.map(r => r.till)).toContain('Kardiologiska kliniken USÖ');
    for (const p of PATIENTER.filter(x => x.id !== 'p03')) expect(text).not.toContain(`${p.fornamn} ${p.efternamn}`);
    for (const n of ['adress', 'telefon', 'kontaktperson', 'postnr']) expect(nycklar(allt).has(n)).toBe(false);
  });

  test('svaren innehåller inga id, interna anteckningar eller uppgifter om andra patienter', async () => {
    const k = await som('inv-p01');
    const svar = { huvud: (await k.get('/api/min/journal/p01')).data };
    for (const del of DELAR) svar[del] = (await k.get(`/api/min/journal/p01/${del}`)).data;
    const forsta = svar.anteckningar.anteckningar[0];
    svar.anteckning = (await k.get(`/api/min/journal/p01/anteckning/${forsta.id}`)).data;
    const text = JSON.stringify(svar);
    const n = nycklar(svar);
    for (const f of ['nll', 'nll_status', 'kvitteradeVarningar', 'larm', 'syfte', 'hash', 'historik', 'hsaId', 'personalId', 'avsandare', 'av', 'registreradAv', 'patientId'])
      expect({ f, finns: n.has(f) }).toEqual({ f, finns: false });
    for (const p of PERSONAL) expect(text).not.toContain(`"${p.id}"`);
    expect(text).not.toContain('SE2321000164');
    for (const p of PATIENTER.filter(x => x.id !== 'p01')) {
      expect(text).not.toContain(`${p.fornamn} ${p.efternamn}`);
      expect(text).not.toContain(p.pnr.slice(0, 8));
    }
    // Den som skrev anteckningen står med namn och titel, eftersom det är en del av journalen.
    expect(svar.anteckning.forfattare).toEqual({ namn: expect.any(String), titel: expect.any(String) });
  });

  test('begäran om spärr ändrar inte spärren och registreras som begäran till vården', async () => {
    const k = await som('inv-p01');
    const d = db(k);
    const sparrarFore = d.query('SELECT * FROM sparrar').all();
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'nagot' })).status).toBe(400);
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'sparr', enhetId: 'uso-psyk' })).status).toBe(400);
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'sparr', enhetId: 'uso-akut', meddelande: 'x'.repeat(501) })).status).toBe(400);
    const r = await k.post('/api/min/journal/p01/begaran', { typ: 'sparr', enhetId: 'uso-akut', meddelande: 'Jag vill att akutens anteckningar spärras.' });
    expect(r.status).toBe(201);
    expect(r.data.begaran).toMatchObject({ typ: 'sparr', vardenhet: 'Akutmottagningen USÖ', status: 'skickad', egen: true });
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'sparr', enhetId: 'uso-akut' })).status).toBe(400);
    expect(d.query('SELECT * FROM sparrar').all()).toEqual(sparrarFore);
    expect(aktivaSparrar(d, 'p01')).toEqual([]);
    expect((await k.post('/api/min/journal/p01/begaran', { typ: 'loggutdrag' })).status).toBe(201);
    const sp = (await k.get('/api/min/journal/p01/sparrar')).data;
    expect(sp.begaran.map(b => b.typ)).toEqual(['loggutdrag', 'sparr']);
    expect(loggrader(k).filter(x => x.handling === 'invanare_begaran').map(x => x.resurs)).toEqual(['begaran:sparr', 'begaran:loggutdrag']);
    expect(() => d.query('DELETE FROM begaran').run()).toThrow();
    // Att häva en spärr är också en begäran. Spärren står kvar tills vården har hävt den.
    const k4 = await som('inv-p04');
    expect((await k4.post('/api/min/journal/p04/begaran', { typ: 'hava_sparr', enhetId: 'uso-kard' })).status).toBe(400);
    expect((await k4.post('/api/min/journal/p04/begaran', { typ: 'hava_sparr', enhetId: 'uso-psyk' })).status).toBe(201);
    expect(aktivaSparrar(db(k4), 'p04')).toEqual(['uso-psyk']);
  });

  test('vårdnadshavare kan inte begära spärr för barnet', async () => {
    const k = await som('inv-vh01');
    const r = await k.post('/api/min/journal/p09/begaran', { typ: 'sparr', enhetId: 'vc-tybble' });
    expect(r.status).toBe(403);
    expect(r.data.fel).toContain('4 kap. 4 §');
    expect((await k.post('/api/min/journal/p09/begaran', { typ: 'hava_sparr', enhetId: 'vc-tybble' })).status).toBe(403);
    expect((await k.post('/api/min/journal/p09/begaran', { typ: 'loggutdrag' })).status).toBe(201);
    expect((await k.get('/api/min/journal/p09/sparrar')).data.kanBegaraSparr).toBe(false);
  });

  test('FHIR med patientens session: egna resurser och $everything, inget annat', async () => {
    const k = await som('inv-p01');
    const d = db(k);
    const fhir = async (v) => { const r = await k.get(`/fhir/${v}`); return { status: r.status, data: r.data }; };
    expect((await fhir('Patient/p01')).data).toMatchObject({ resourceType: 'Patient', id: 'p01' });
    const finnsInte = await fhir('Patient/p99');
    expect(finnsInte.status).toBe(404);
    for (const v of ['Patient/p02', 'Patient/p02/$everything', 'Condition?patient=p02', 'Composition?subject=Patient/p03', 'Observation?patient=p12']) {
      const r = await fhir(v);
      expect({ v, status: r.status, typ: r.data.resourceType }).toEqual({ v, status: 404, typ: 'OperationOutcome' });
    }
    for (const v of ['Patient?_id=p02', 'Patient?identifier=196603193373', 'Patient?identifier=http://electronichealth.se/identifier/personnummer|198404162383']) {
      expect((await fhir(v)).data).toMatchObject({ resourceType: 'Bundle', total: 0 });
    }
    expect((await fhir('Patient')).data.entry.map(e => e.resource.id)).toEqual(['p01']);
    for (const v of ['Practitioner', 'Practitioner/lak-kard', 'AuditEvent?patient=p01']) expect((await fhir(v)).status).toBe(403);
    // En resurs i en annan journal finns inte för invånaren.
    const annanAnt = d.query("SELECT id FROM anteckningar WHERE patient_id = 'p02'").get().id;
    const annanDia = d.query("SELECT id FROM diagnoser WHERE patient_id = 'p04'").get().id;
    expect((await fhir(`Composition/${annanAnt}`)).status).toBe(404);
    expect((await fhir(`Condition/${annanDia}`)).status).toBe(404);
    // Samma visningsregler som i Min journal.
    const utkast = d.query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND status = 'utkast'").get().id;
    const inr = d.query("SELECT id FROM matvarden WHERE patient_id = 'p01' AND typ = 'inr' AND vidimerad IS NULL").get().id;
    const comp = (await fhir('Composition?patient=p01')).data.entry.map(e => e.resource);
    expect(comp.map(c => c.id)).not.toContain(String(utkast));
    expect(comp.every(c => c.status !== 'preliminary')).toBe(true);
    expect((await fhir(`Composition/${utkast}`)).status).toBe(404);
    expect((await fhir('Observation?patient=p01')).data.entry.map(e => e.resource.id)).not.toContain(String(inr));
    expect((await fhir(`Observation/${inr}`)).status).toBe(404);
    // $everything: patienten och alla synliga resurser i journalen, inga andra.
    const allt = (await fhir('Patient/p01/$everything')).data;
    expect(allt.resourceType).toBe('Bundle');
    const typer = new Set(allt.entry.map(e => e.resource.resourceType));
    for (const t of ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'ServiceRequest', 'Composition']) expect(typer.has(t)).toBe(true);
    for (const e of allt.entry.filter(x => x.resource.resourceType !== 'Patient')) {
      const r = e.resource;
      expect((r.subject ?? r.patient).reference).toBe('Patient/p01');
    }
    expect(allt.entry.map(e => `${e.resource.resourceType}/${e.resource.id}`)).not.toContain(`Observation/${inr}`);
    // Personalens id lämnas inte ut, bara namnet på den som skrev eller ordinerade.
    const alltText = JSON.stringify(allt);
    expect(alltText).not.toContain('Practitioner/');
    for (const p of PERSONAL) expect(alltText).not.toContain(`"${p.id}"`);
    expect(allt.entry.find(e => e.resource.resourceType === 'Composition').resource.author[0]).toEqual({ display: expect.any(String) });
    // Med p04: psykiatrins omvårdnadsanteckning visas inte heller i FHIR.
    const k4 = await som('inv-p04');
    const dold = db(k4).query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' AND typ = 'Omvårdnadsanteckning'").get().id;
    expect((await k4.get('/fhir/Composition?patient=p04')).data.entry.map(e => e.resource.id)).not.toContain(String(dold));
    // Anropen loggas som invånarens egen åtkomst.
    expect(loggrader(k).filter(r => r.invanare_id === 'inv-p01' && r.resurs?.startsWith('fhir/') && r.resultat === 'tillaten').length).toBeGreaterThanOrEqual(5);
  });
});

test('Min journal > sandlåda sparad före Min journal får tabellerna när den läses in', () => {
  const d = nyDb();
  d.exec('DROP TABLE invanare; DROP TABLE vardnadshavare; DROP TABLE visningsregler; DROP TABLE begaran');
  d.exec('ALTER TABLE matvarden DROP COLUMN vidimerad');
  d.exec('ALTER TABLE atkomstlogg DROP COLUMN invanare_id');
  expect(verifiera(d).hel).toBe(true);
  const gammal = Buffer.from(d.serialize()).toString('base64');
  const ny = lasSandlada(gammal);
  expect(ny.query('SELECT count(*) AS n FROM invanare').get().n).toBe(PATIENTER.length + 1);
  expect(ny.query('SELECT count(*) AS n FROM visningsregler').get().n).toBe(2);
  // Provsvar från före vidimeringen räknas som vidimerade när de togs. Mätvärden har ingen vidimering.
  expect(ny.query("SELECT count(*) AS n FROM matvarden WHERE typ = 'inr' AND vidimerad = tid").get().n).toBe(ny.query("SELECT count(*) AS n FROM matvarden WHERE typ = 'inr'").get().n);
  expect(ny.query("SELECT count(*) AS n FROM matvarden WHERE typ = 'puls' AND vidimerad IS NOT NULL").get().n).toBe(0);
  // Loggkedjan är fortfarande hel, och en invånares rad kan läggas till.
  expect(verifiera(ny).hel).toBe(true);
  const atk = new minJournal.InvanareAtkomst(ny, minJournal.invanareRad(ny, 'inv-p01'), 'p01');
  atk.krav();
  atk.logga('min:journal');
  expect(verifiera(ny).hel).toBe(true);
  // En sandlåda med Min journal läses in oförändrad.
  const ren = nyDb();
  const igen = lasSandlada(Buffer.from(ren.serialize()).toString('base64'));
  expect(igen.query('SELECT count(*) AS n FROM invanare').get().n).toBe(PATIENTER.length + 1);
  expect(Database.deserialize(ren.serialize()).query('SELECT count(*) AS n FROM visningsregler').get().n).toBe(2);
});
