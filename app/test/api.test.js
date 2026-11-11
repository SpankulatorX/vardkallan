import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { idag, addDagar } from '../src/db.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();

describe('API', () => {
  test('hälsa och Server-Timing på alla svar', async () => {
    const k = klient(app);
    const h = await k.get('/api/health');
    expect(h.status).toBe(200);
    expect(h.data).toMatchObject({ ok: true });
    expect(typeof h.data.sandladar).toBe('number');
    // Användartestet märker resultatet med appens version och en hash av gränssnittet.
    expect(h.data.version).toBe(JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')).version);
    expect(h.data.gransnitt).toMatch(/^[0-9a-f]{64}$/);
    for (const v of ['/api/health', '/api/session', '/api/patient/p01', '/fhir/metadata', '/', '/finns-inte.css']) {
      const r = await k.get(v);
      expect(r.headers.get('server-timing')).toMatch(/^app;dur=\d+(\.\d+)?$/);
    }
  });

  test('sessionskakan är HttpOnly och SameSite=Lax', async () => {
    const res = await fetch(app.url + '/api/session');
    const sc = res.headers.get('set-cookie');
    expect(sc).toMatch(/^vk_sid=[A-Za-z0-9_-]{32};/);
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Lax');
    expect(sc).not.toContain('Secure');
    const data = await res.json();
    expect(data).toMatchObject({ inloggad: false, demoDatum: idag() });
  });

  test('sessionskakan får Secure när ORIGIN är https', async () => {
    const app2 = testserver({ origin: 'https://vardkallan.404haven.se' });
    try {
      const res = await fetch(app2.url + '/api/session');
      expect(res.headers.get('set-cookie')).toContain('; Secure');
    } finally { app2.stopp(); }
  });

  test('skrivande anrop med fel Origin avvisas', async () => {
    const app2 = testserver({ origin: 'https://vardkallan.404haven.se' });
    try {
      const fel = klient(app2, { origin: 'https://angripare.example' });
      const r = await fel.post('/api/login', { personalId: 'lak-kard' });
      expect(r.status).toBe(403);
      expect(r.data.kod).toBe('nekad');
      const utan = klient(app2);
      expect((await utan.post('/api/login', { personalId: 'lak-kard' })).status).toBe(403);
      const ratt = klient(app2, { origin: 'https://vardkallan.404haven.se' });
      expect((await ratt.post('/api/login', { personalId: 'lak-kard' })).status).toBe(200);
      const ref = klient(app2);
      expect((await ref.post('/api/login', { personalId: 'lak-kard' }, { Referer: 'https://vardkallan.404haven.se/patient/p01' })).status).toBe(200);
      // Läsning kräver inte Origin.
      expect((await ratt.get('/api/arbetslista')).status).toBe(200);
    } finally { app2.stopp(); }
  });

  test('för stor kropp avvisas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'x'.repeat(70_000) }] });
    expect(r.status).toBe(413);
    const fel = await k.raw('POST', '/api/login', undefined, { 'Content-Type': 'application/json' });
    expect(fel.status).toBe(400);
    const ej = await fetch(app.url + '/api/login', { method: 'POST', headers: { Cookie: k.kaka(), 'Content-Type': 'application/json' }, body: '{inte json' });
    expect(ej.status).toBe(400);
  });

  test('inloggning och demoroller', async () => {
    const k = klient(app);
    const roller = await k.get('/api/demo/personal');
    expect(roller.data.map(r => r.id)).toEqual(['lak-kard', 'ssk-kard', 'usk-kard', 'lak-akut', 'lak-vc', 'lak-psyk', 'adm-kard', 'logg', 'ssk-vc', 'ark', 'uppf', 'kom-bist', 'far-kard', 'vch-kard', 'eko', 'sysf', 'sysf-2', 'fys-kard', 'bm-uso', 'opk-kkoga',
      // Runda 11, r4: farmaceuten på cytostatikaberedningen.
      'far-bered', 'lak-onk', 'ssk-onk']);

    expect(roller.data[0]).toMatchObject({ namn: 'Sara Lindqvist', yrke: 'lakare', enhet: { id: 'uso-kard', namn: 'Kardiologiska kliniken USÖ' } });
    expect((await k.post('/api/login', { personalId: 'lak-ort' })).status).toBe(400);
    expect((await k.get('/api/arbetslista')).data.kod).toBe('ej_inloggad');
    const fore = k.kaka();
    const s = await k.logga('ssk-kard');
    expect(k.kaka()).not.toBe(fore);
    expect((await fetch(app.url + '/api/session', { headers: { Cookie: fore } }).then(r => r.json())).inloggad).toBe(false);
    expect(s.data).toMatchObject({ inloggad: true, personal: { id: 'ssk-kard', yrke: 'sjukskoterska' }, enhet: { id: 'uso-kard-72', vardenhet: { id: 'uso-kard' } } });
    expect((await k.post('/api/logout')).data.inloggad).toBe(false);
    const enheter = await k.get('/api/enheter');
    expect(enheter.data[0].id).toBe('rol');
    expect(enheter.data[0].barn.map(b => b.id)).toContain('uso');
  });

  test('arbetslista maskerar skyddad identitet', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const lista = (await k.get('/api/arbetslista')).data;
    const ids = lista.map(p => p.id);
    for (const id of ['p01', 'p04', 'p05', 'p03', 'p10', 'p11']) expect(ids).toContain(id);
    expect(ids).not.toContain('p12');
    const skyddad = lista.find(p => p.id === 'p03');
    expect(skyddad).toMatchObject({ namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    expect(JSON.stringify(lista)).not.toContain('Engberg');
    expect(lista.find(p => p.id === 'p01')).toMatchObject({ namn: 'Gunnar Åkesson', personnummer: '19450202-4732', plats: 'Avd 72, sal 4', kon: 'man' });
    expect(lista.find(p => p.id === 'p05').larm).toBeGreaterThan(0);
    expect(lista[0].pagaende).toBe(true);
  });

  test('sök maskerar skyddad patient och hittar den bara på fullständigt personnummer', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    expect((await k.get('/api/sok?q=Engberg')).data).toEqual([]);
    expect((await k.get('/api/sok?q=19840416')).data).toEqual([]);
    const hel = (await k.get('/api/sok?q=19840416-2383')).data;
    expect(hel).toEqual([expect.objectContaining({ id: 'p03', namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true })]);
    const namn = (await k.get('/api/sok?q=lindberg')).data;
    expect(namn.map(p => p.id)).toEqual(['p02']);
    expect(namn[0].vardrelation).toBe(false);
    expect((await k.get('/api/sok?q=a')).status).toBe(400);
  });

  test('sök på namn hittar namn med å, ä och ö oavsett skiftläge', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    for (const q of ['Åkesson', 'åkesson', 'ÅKESSON', 'Gunnar Åke']) {
      expect((await k.get(`/api/sok?q=${encodeURIComponent(q)}`)).data.map(p => p.id)).toEqual(['p01']);
    }
    expect((await k.get(`/api/sok?q=${encodeURIComponent('Engberg')}`)).data).toEqual([]);
  });

  test('sökningen loggas', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    await k.get('/api/sok?q=196603193373');
    const sist = loggRader(k).at(-1);
    expect(sist).toMatchObject({ personal_id: 'lak-akut', handling: 'sok', patient_id: null, resultat: 'tillaten' });
    expect(sist.resurs).toContain('196603193373');
  });

  test('väntrummet visar aldrig namn för skyddad patient', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    const v = (await k.get('/api/vantrum')).data;
    expect(v.map(x => x.konummer)).toEqual(['A07', 'A09', 'A11']);
    const skyddad = v.find(x => x.konummer === 'A09');
    expect(skyddad.namn).toBeNull();
    expect(skyddad.skyddad).toBe(true);
    expect(skyddad.uppropning).toBe('Nummer A09');
    expect(JSON.stringify(v)).not.toContain('Malin');
    expect(v.find(x => x.konummer === 'A07').namn).toBe('Emma Karlsson');
    for (const x of v) expect(x.uppropning).toBe(`Nummer ${x.konummer}`);
    // Personal på andra enheter ser bara könummer.
    const k2 = klient(app);
    await k2.logga('lak-kard');
    const v2 = (await k2.get('/api/vantrum')).data;
    for (const x of v2) { expect(x.namn).toBeUndefined(); expect(x.patientId).toBeUndefined(); }
  });

  test('visa identitet kräver syfte och loggas', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const fore = (await k.get('/api/patient/p03')).data;
    expect(fore).toMatchObject({ namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true, identitetVisad: false });
    expect((await k.post('/api/patient/p03/val', { typ: 'visa_identitet' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/val', { typ: 'visa_identitet', syfte: 'Kontroll' })).status).toBe(400);
    const val = await k.post('/api/patient/p03/val', { typ: 'visa_identitet', syfte: 'Identitetskontroll vid besök' });
    expect(val.data.val.visa_identitet).toBe(true);
    const efter = (await k.get('/api/patient/p03')).data;
    expect(efter).toMatchObject({ namn: 'Malin Engberg', personnummer: '19840416-2383', identitetVisad: true });
    const rad = loggRader(k).find(r => r.handling === 'visa_identitet');
    expect(rad).toMatchObject({ patient_id: 'p03', syfte: 'Identitetskontroll vid besök', resultat: 'tillaten' });
    // Adressen visas aldrig.
    const ov = (await k.get('/api/patient/p03/oversikt')).data;
    expect(ov.kontakt.adress).toBeNull();
    // I listor är patienten fortfarande maskerad.
    expect((await k.get('/api/arbetslista')).data.find(p => p.id === 'p03').namn).toBe('Skyddad identitet');
  });

  test('nekad åtkomst ger 403 kraver_val och loggas som nekad', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.get('/api/patient/p12');
    expect(r.status).toBe(403);
    expect(r.data).toMatchObject({ kod: 'kraver_val' });
    expect(r.data.fel).toContain('Nödåtkomst');
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p12', grund: 'nekad', resultat: 'nekad' });
    const u = klient(app);
    await u.logga('usk-kard');
    const ru = await u.get('/api/patient/p12');
    expect(ru.status).toBe(403);
    expect(ru.data.kod).toBe('nekad');
    expect((await u.get('/api/patient/p01/anteckningar')).status).toBe(200);
    expect((await u.get('/api/patient/p99')).status).toBe(404);
    const a = klient(app);
    await a.logga('adm-kard');
    expect((await a.get('/api/patient/p01/lakemedel')).status).toBe(403);
    expect((await a.get('/api/patient/p01/anteckningar')).status).toBe(403);
    const adm = (await a.get('/api/patient/p01/oversikt')).data;
    expect(adm.lakemedel).toBeNull();
    expect(adm.anteckningar).toBeNull();
    expect(adm.diagnoser).toBeNull();
    expect(adm.vardkontakter.length).toBeGreaterThan(0);
    expect(adm.kontakt.telefon).toBe('070-174 06 01');
  });

  test('nödåtkomst via API flaggas i logguppföljningen', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    expect((await k.get('/api/patient/p02')).data.kod).toBe('kraver_val');
    expect((await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: '' })).status).toBe(400);
    const r = await k.post('/api/patient/p02/val', { typ: 'nodatkomst', syfte: 'Medvetslös vid ankomst, behöver diabetesjournal' });
    expect(r.data.val.nodatkomst).toBe(true);
    const h = (await k.get('/api/patient/p02')).data;
    expect(h.grund).toBe('nodatkomst');
    expect(h.andraEnheterVisade).toBe(true);
    const ant = (await k.get('/api/patient/p02/anteckningar')).data.anteckningar;
    expect(ant.some(a => a.enhet.id === 'lind-med')).toBe(true);
    expect((await k.post('/api/patient/p01/val', { typ: 'nodatkomst', syfte: 'Onödigt' })).status).toBe(400);
    // Logggranskaren ser nödåtkomsten flaggad, i samma sandlåda.
    await k.logga('logg');
    const logg = (await k.get('/api/logg?flagga=nodatkomst')).data;
    expect(logg.kedjaHel).toBe(true);
    const rader = logg.rader.filter(x => x.patientId === 'p02' && x.personal.id === 'lak-akut');
    expect(rader.length).toBeGreaterThanOrEqual(3);
    expect(rader.every(x => x.grund === 'nodatkomst' && x.flaggad)).toBe(true);
    expect(rader.some(x => x.syfte === 'Medvetslös vid ankomst, behöver diabetesjournal')).toBe(true);
  });

  test('spärrmarkering och samtycke via API', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const h = (await k.get('/api/patient/p04')).data;
    expect(h.sparrmarkering).toBe(true);
    expect(JSON.stringify(h)).not.toContain('psyk');
    const ant = (await k.get('/api/patient/p04/anteckningar')).data;
    expect(ant.dolda.sparrade).toBe(true);
    expect(ant.anteckningar.some(a => a.enhet.id === 'uso-psyk')).toBe(false);
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Inskrivning' });
    expect((await k.get('/api/patient/p04/anteckningar')).data.anteckningar.some(a => a.enhet.id === 'uso-psyk')).toBe(false);
    const psykId = sandlada(app, k).db.query("SELECT id FROM anteckningar WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk' LIMIT 1").get().id;
    const r = await k.get(`/api/anteckning/${psykId}`);
    expect(r.status).toBe(403);
    expect(r.data.kod).toBe('kraver_samtycke');
    expect((await k.post('/api/patient/p05/val', { typ: 'samtycke_sparr', syfte: 'Test' })).status).toBe(400);
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker muntligt' });
    expect((await k.get(`/api/anteckning/${psykId}`)).status).toBe(200);
    expect(loggRader(k).at(-1)).toMatchObject({ grund: 'samtycke_sparr', patient_id: 'p04', resurs: `/api/anteckning/${psykId}`, resultat: 'tillaten' });
    expect(loggRader(k).some(r => r.handling === 'samtycke_sparr' && r.syfte === 'Patienten samtycker muntligt')).toBe(true);
    expect((await k.get('/api/patient/p04')).data.sparrmarkering).toBe(false);
    // Samtycket gäller bara sessionen.
    await k.post('/api/logout');
    await k.logga('lak-kard');
    expect((await k.get(`/api/anteckning/${psykId}`)).status).toBe(403);
  });

  test('aktivt val för andra enheter via API', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const fore = (await k.get('/api/patient/p07/anteckningar')).data;
    expect(fore.dolda.kraverVal).toBeGreaterThan(0);
    expect(fore.anteckningar.every(a => a.enhet.id === 'vc-tybble')).toBe(true);
    const h = (await k.get('/api/patient/p07')).data;
    expect(h).toMatchObject({ harAndraEnheter: true, andraEnheterVisade: false });
    await k.post('/api/patient/p07/val', { typ: 'andra_enheter', syfte: 'Uppföljning efter höftfraktur' });
    const efter = (await k.get('/api/patient/p07/anteckningar')).data;
    expect(efter.anteckningar.some(a => a.enhet.id === 'kkoga-ort')).toBe(true);
    expect(loggRader(k).at(-1)).toMatchObject({ grund: 'aktivt_val', handling: 'las_journal', patient_id: 'p07' });
    expect((await k.get('/api/patient/p07')).data.andraEnheterVisade).toBe(true);
  });

  test('helflöde: anteckning skapas, signeras och rättas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const mallar = (await k.get('/api/mallar')).data;
    expect(mallar.find(m => m.typ === 'Daganteckning').sokord).toContain('Bedömning');
    const ny = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Pigg.' }] });
    expect(ny.status).toBe(201);
    expect(ny.data.status).toBe('utkast');
    const id = ny.data.id;
    expect((await k.put(`/api/anteckning/${id}`, { sokord: [{ sokord: 'Aktuellt', text: 'Pigg och utan andfåddhet.' }] })).data.sokord[0].text).toBe('Pigg och utan andfåddhet.');
    expect((await k.get('/api/inkorg')).data.osigneradeAnteckningar.some(a => a.id === id)).toBe(true);
    // En annan användare i samma sandlåda kan varken läsa, ändra eller signera utkastet.
    await k.logga('lak-akut');
    expect((await k.get(`/api/anteckning/${id}`)).status).toBe(404);
    expect((await k.put(`/api/anteckning/${id}`, { sokord: [{ sokord: 'Aktuellt', text: 'Försök' }] })).status).toBe(403);
    expect((await k.post(`/api/anteckning/${id}/signera`)).status).toBe(403);
    await k.logga('lak-kard');
    const s = await k.post(`/api/anteckning/${id}/signera`);
    expect(s.data.status).toBe('signerad');
    const put = await k.put(`/api/anteckning/${id}`, { sokord: [{ sokord: 'Aktuellt', text: 'Ändrad' }] });
    expect(put.status).toBe(400);
    expect(put.data.kod).toBe('ogiltig');
    expect((await k.post(`/api/anteckning/${id}/ratta`, { sokord: [{ sokord: 'Aktuellt', text: 'x' }] })).status).toBe(400);
    const r = await k.post(`/api/anteckning/${id}/ratta`, { orsak: 'Skrev fel patients status', sokord: [{ sokord: 'Aktuellt', text: 'Trött i dag.' }] });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ version: 2, ersatterId: id, status: 'signerad' });
    const full = (await k.get(`/api/anteckning/${r.data.id}`)).data;
    expect(full.versioner.map(v => [v.id, v.ersatt])).toEqual([[id, true], [r.data.id, false]]);
    expect(full.versioner[0].sokord[0].text).toBe('Pigg och utan andfåddhet.');
  });

  test('helflöde: ordination med varning, kvittens och NLL som inte svarar i tid, med avstämning', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const kat = (await k.get('/api/lakemedel/katalog?q=ibu')).data;
    expect(kat[0]).toMatchObject({ id: 'VK-NPL-0027', atc: 'M01AE01' });
    const ord = { lakemedelId: 'VK-NPL-0027', dosering: '1 tablett vid behov', typ: 'vid_behov', vidBehov: true, ordinationsorsak: 'Ledvärk', uppfoljningsdatum: addDagar(idag(), 7) };
    const kontroll = (await k.post('/api/patient/p01/lakemedel/kontroll', ord)).data;
    expect(kontroll.varningar.map(v => v.regel)).toContain('warfarin_nsaid');
    expect(kontroll.demoregler).toBe(true);
    const utan = await k.post('/api/patient/p01/lakemedel', { ...ord, ordinationsorsak: '' });
    expect(utan.status).toBe(400);
    expect(utan.data.falt).toContain('ordinationsorsak');
    const ejKv = await k.post('/api/patient/p01/lakemedel', ord);
    expect(ejKv.status).toBe(400);
    expect(ejKv.data.kraverKvittens).toEqual(['warfarin_nsaid']);
    expect((await k.post('/api/demo/nll-timeout')).data.ok).toBe(true);
    const sparad = await k.post('/api/patient/p01/lakemedel', { ...ord, kvitteradeVarningar: [{ regel: 'warfarin_nsaid', motivering: 'Kort kur, INR kontrolleras' }] });
    expect(sparad.status).toBe(201);
    expect(sparad.data.nll.status).toBe('timeout');
    const id = sparad.data.ordination.id;
    const lista = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer;
    expect(lista.find(o => o.id === id)).toMatchObject({ nll_status: 'okand_kontrolleras', aktuell: true });
    expect((await k.get('/api/inkorg')).data.nllAvvikelser.map(a => a.ordinationId)).toContain(id);
    const av = await k.post(`/api/ordination/${id}/nll-avstam`);
    expect(av.data).toMatchObject({ resultat: 'fanns_registrerad', ordination: { nll_status: 'kvitterad' } });
    const ut = await k.post(`/api/ordination/${id}/utsatt`, { orsak: 'Kuren klar' });
    expect(ut.data.ordination.status).toBe('utsatt');
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    expect((await ssk.post('/api/patient/p01/lakemedel', ord)).status).toBe(403);
  });

  test('helflöde: remiss genom hela statuskedjan', async () => {
    const vc = klient(app);
    await vc.logga('lak-vc');
    const ny = await vc.post('/api/patient/p09/remisser', { tillEnhetId: 'uso-kard', fragestallning: 'Blåsljud hos barn, bedömning?', anamnes: 'Upptäckt vid kontroll.', prioritet: 'normal', svarSenast: addDagar(idag(), 30) });
    expect(ny.status).toBe(201);
    const id = ny.data.id;
    // Kardiologin och vårdcentralen delar inte sandlåda, så resten görs i samma session med rollbyte.
    const steg = [
      ['adm-kard', 'mottag', {}, 'mottagen'],
      ['lak-kard', 'bedom', { beslut: 'accepterad' }, 'bedomd'],
      ['lak-kard', 'svara', { svar: 'Funktionellt blåsljud. Ingen uppföljning.' }, 'besvarad'],
      ['lak-vc', 'kvittera-svar', {}, 'svar_kvitterat'],
    ];
    expect((await vc.post(`/api/remiss/${id}/mottag`)).status).toBe(403);
    for (const [roll, vad, kropp, status] of steg) {
      await vc.logga(roll);
      const r = await vc.post(`/api/remiss/${id}/${vad}`, kropp);
      expect(r.status).toBe(200);
      expect(r.data.status).toBe(status);
    }
    await vc.logga('lak-kard');
    const ink = (await vc.get('/api/remisser?riktning=inkommande')).data;
    expect(ink.riktning).toBe('inkommande');
    expect(ink.remisser.find(r => r.id === id).status).toBe('svar_kvitterat');
    await vc.logga('lak-vc');
    expect((await vc.get('/api/remisser?riktning=utgaende')).data.remisser.some(r => r.id === id)).toBe(true);
    expect((await vc.get('/api/patient/p09/remisser')).data.remisser[0].id).toBe(id);
  });

  test('inkorgen visar larm, okvitterade svar och NLL-avvikelser', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const i = (await k.get('/api/inkorg')).data;
    expect(Object.keys(i).sort()).toEqual(['aterinsattningar', 'aterlamnanden', 'avbokadeVardhandelser', 'beredningarAttKontrollera', 'beslutAttKvittera', 'bhvAttBoka', 'blodAvvikelser', 'cytoRapporter', 'cytoRegimversioner', 'delegeringarSomGarUt', 'donationsforslag', 'dubbletter', 'egnaBevakningar', 'fordjupadeGenomgangar', 'hemmatningarAttBekrafta', 'kollegakontrollerAttGora', 'kontrasigneringar', 'labbAttSignera', 'lakemedelsoverforingar', 'lakemedelsuppfoljningar', 'larm', 'licenserSomGarUt', 'mallarAttGodkanna', 'muntligaAttSignera', 'news2Larm', 'nllAvvikelser', 'okvitteradeSvar', 'osigneradeAnteckningar', 'provsvarAttVidimera', 'provsvarKritiska', 'rapportfel', 'remisserAttBedoma', 'remisserAttSignera', 'samordning', 'sparrFragor', 'tillvaxtLarm', 'tvangsvard', 'vardplanerUppfoljning']);
    expect(i.larm.map(l => `${l.patientId}:${l.typ}`).sort()).toEqual(['p06:svar_forsenat', 'p11:svar_ej_kvitterat']);
    expect(i.okvitteradeSvar.map(r => r.patientId)).toEqual(['p11']);
    expect(i.nllAvvikelser.map(a => a.patientId)).toEqual(['p10']);
    await k.logga('lak-kard');
    const kard = (await k.get('/api/inkorg')).data;
    expect(kard.larm.find(l => l.patientId === 'p05').typ).toBe('saknar_mottagningskvittens');
    expect(kard.osigneradeAnteckningar.length).toBe(1);
  });

  test('inkorgens utkast och NLL-avvikelser visar patienten, maskerad för skyddad identitet', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const i = (await k.get('/api/inkorg')).data;
    // Runda 6, r1: raden har också uppmärksamhetssymbolen, med samma regler som i patienthuvudet (Sussa 3.1.5.2).
    expect(i.nllAvvikelser[0].patient).toEqual({ id: 'p10', namn: 'Karl-Erik Brandt', personnummer: '19460113-6098', skyddad: false, uppmarksamhet: expect.any(Object) });
    await k.logga('lak-akut');
    await k.post('/api/patient/p03/anteckningar', { typ: 'Akutanteckning', sokord: [{ sokord: 'Kontaktorsak', text: 'Buksmärta.' }] });
    const akut = (await k.get('/api/inkorg')).data;
    const utkast = akut.osigneradeAnteckningar.find(a => a.patientId === 'p03');
    expect(utkast.patient).toEqual({ id: 'p03', namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true, uppmarksamhet: expect.any(Object) });
    expect(JSON.stringify(akut)).not.toContain('Engberg');
  });

  test('logggranskaren ser logg med hel kedja, andra roller nekas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.get('/api/patient/p01');
    expect((await k.get('/api/logg')).status).toBe(403);
    expect((await k.get('/api/patient/p01/logglista')).status).toBe(403);
    await k.logga('logg');
    const l = (await k.get('/api/patient/p01/logglista')).data;
    expect(l.kedjaHel).toBe(true);
    expect(l.rader.some(r => r.personal?.id === 'lak-kard' && r.handling === 'las_oversikt')).toBe(true);
    const nekade = (await k.get('/api/logg?flagga=nekad')).data;
    expect(nekade.rader.every(r => r.resultat === 'nekad')).toBe(true);
    expect(nekade.rader.some(r => r.patientId === 'p12' && r.personal.id === 'adm-kard')).toBe(true);
    const sam = (await k.get('/api/logg?flagga=samtycke')).data;
    expect(sam.rader.some(r => r.patientId === 'p04')).toBe(true);
    const fran = (await k.get(`/api/logg?flagga=alla&fran=${idag()}`)).data;
    expect(fran.rader.every(r => r.tid >= idag())).toBe(true);
    expect((await k.get('/api/patient/p01')).status).toBe(403);
    expect(loggRader(k).at(-1).grund).toBe('nekad');
  });

  test('loggraderna visar vilken patient de gäller, maskerat för skyddad identitet', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    await k.get('/api/patient/p03');
    await k.logga('logg');
    const alla = (await k.get('/api/logg')).data;
    const rad = alla.rader.find(r => r.patientId === 'p03');
    expect(rad.patient).toEqual({ id: 'p03', namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    expect(alla.rader.find(r => r.patientId === 'p01').patient).toMatchObject({ namn: 'Gunnar Åkesson', personnummer: '19450202-4732' });
    expect(alla.rader.filter(r => !r.patientId).every(r => r.patient === null)).toBe(true);
    const l = (await k.get('/api/patient/p03/logglista')).data;
    expect(l.patient).toEqual({ id: 'p03', namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    expect(JSON.stringify(alla)).not.toContain('Engberg');
  });

  test('migreringsavstämningen visar avvikelsen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const m = (await k.get('/api/migrering')).data;
    const ok = m.datatyper.find(d => d.datatyp === 'overkanslighet' && d.kalla === 'migrerad:VAS');
    expect(ok).toMatchObject({ antalKalla: 2, antalOverforda: 1, antalVerifierade: 1, avvikelse: true });
    expect(m.avvikelser).toEqual([expect.objectContaining({ patientId: 'p01', status: 'oppen', datatyp: 'overkanslighet' })]);
    expect(m.datatyper.filter(d => d.avvikelse).length).toBe(1);
    expect(m.summa.antalKalla).toBe(m.summa.antalOverforda + 1);
  });

  test('översikten har tidslinje med migrerade poster märkta', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Helhetsbild' });
    const o = (await k.get('/api/patient/p01/oversikt')).data;
    for (const f of ['lakemedel', 'diagnoser', 'matvarden', 'anteckningar', 'remisser', 'tidslinje']) expect(o[f]).not.toBeNull();
    expect(o.anteckningar.length).toBeLessThanOrEqual(5);
    const migr = o.tidslinje.filter(t => t.kalla?.startsWith('migrerad'));
    expect(migr.map(t => t.kallaEtikett)).toEqual(expect.arrayContaining(['Migrerad från VAS 2014', 'Migrerad från Cosmic 2023']));
    expect(o.tidslinje.some(t => t.kalla === 'vardkallan')).toBe(true);
    const tider = o.tidslinje.map(t => t.tid);
    expect([...tider].sort().reverse()).toEqual(tider);
    // Migrerade poster ligger i samma kronologi som ny dokumentation, och vårdtillfällets händelser med dem.
    // Runda 10, r4: och de in- och utfarter som patienten har fått under vårdtillfället (seeden i infarter.js).
    expect(new Set(o.tidslinje.map(t => t.typ))).toEqual(new Set(['vardkontakt', 'vardtillfalle', 'anteckning', 'ordination', 'remiss', 'infart']));
    expect(o.matvarden.find(m => m.typ === 'vikt').varde).toBe(81.6);
    expect(o.lakemedel.every(l => l.aktuell)).toBe(true);
    const h = (await k.get('/api/patient/p01')).data;
    expect(h.overkanslighet[0]).toMatchObject({ amne: 'Penicilliner', atc: 'J01C', kallaEtikett: 'Migrerad från VAS 2014' });
  });

  test('drift visar p50 och p95 per adress i API:t', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    for (let i = 0; i < 5; i++) await k.get('/api/patient/p01');
    const d = (await k.get('/api/drift')).data;
    expect(d.mal.p95Ms).toBe(200);
    const rad = d.sandlada.find(r => r.endpoint === 'GET /api/patient/:id');
    expect(rad.antal).toBe(5);
    expect(rad.p50).toBeGreaterThanOrEqual(0);
    expect(rad.p95).toBeGreaterThanOrEqual(rad.p50);
    expect(typeof rad.inomMal).toBe('boolean');
    expect(d.server.find(r => r.endpoint === 'GET /api/patient/:id').antal).toBeGreaterThanOrEqual(5);
  });

  test('krav visar kravregistret', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-krav-'));
    const fil = join(dir, 'test-resultat.json');
    writeFileSync(fil, JSON.stringify({ tid: '2026-10-31T10:00:00Z', bun: '1.3.14', antal: 1, godkanda: 1, misslyckade: 0, tester: [{ namn: 'API > drift visar p50 och p95 per adress i API:t', status: 'grön' }, { namn: 'API > hälsa och Server-Timing på alla svar', status: 'grön' }] }));
    const app2 = testserver({ testresultat: fil });
    try {
      const r = (await klient(app2).get('/api/krav')).data;
      expect(r.testresultat.antal).toBe(1);
      expect(r.krav.find(x => x.id === 'D5').status).toBe('uppfyllt_demo');
      expect(r.krav.find(x => x.id === 'D2').status).toBe('delvis');
      expect(r.krav.find(x => x.id === 'D12').status).toBe('planerat');
      expect(r.krav.length).toBe(43);
    } finally { app2.stopp(); rmSync(dir, { recursive: true }); }
  });

  test('okänd sökväg ger index.html', async () => {
    const r = await fetch(app.url + '/patient/p01/oversikt');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(await r.text()).toContain('Vårdkällan');
    expect((await fetch(app.url + '/saknas.js')).status).toBe(404);
    expect((await fetch(app.url + '/api/finns-inte')).status).toBe(404);
    expect((await fetch(app.url + '/../src/db.js')).status).not.toBe(200);
  });

  test('FHIR via HTTP har application/fhir+json och kräver inloggning', async () => {
    const k = klient(app);
    const m = await k.get('/fhir/metadata');
    expect(m.headers.get('content-type')).toContain('application/fhir+json');
    const ej = await k.get('/fhir/Patient/p01');
    expect(ej.status).toBe(401);
    expect(ej.data.resourceType).toBe('OperationOutcome');
    await k.logga('lak-kard');
    const p = await k.get('/fhir/Patient/p01');
    expect(p.data.resourceType).toBe('Patient');
    const n = await k.get('/fhir/Patient/p12');
    expect(n.status).toBe(403);
    expect(n.data.issue[0].details.coding[0].code).toBe('kraver_val');
  });

  test('alla demoroller och patienter ger inga serverfel', async () => {
    const k = klient(app);
    const roller = (await k.get('/api/demo/personal')).data.map(r => r.id);
    const vagar = ['', '/oversikt', '/anteckningar', '/lakemedel', '/matvarden', '/remisser', '/logglista'];
    const fhirTyper = ['Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'ServiceRequest', 'Composition'];
    let svar = 0;
    for (const roll of roller) {
      await k.logga(roll);
      for (const v of ['/api/arbetslista', '/api/inkorg', '/api/vantrum', '/api/remisser?riktning=inkommande', '/api/remisser?riktning=utgaende', '/api/migrering', '/api/logg']) {
        const r = await k.get(v);
        expect({ roll, v, status: r.status }).toEqual({ roll, v, status: [200, 403].includes(r.status) ? r.status : 200 });
      }
      for (let i = 1; i <= 15; i++) {
        const id = `p${String(i).padStart(2, '0')}`;
        for (const v of vagar) {
          const r = await k.get(`/api/patient/${id}${v}`);
          expect({ roll, id, v, status: r.status }).toEqual({ roll, id, v, status: [200, 403].includes(r.status) ? r.status : 200 });
          if (r.status === 403) expect(['nekad', 'kraver_val', 'kraver_samtycke']).toContain(r.data.kod);
          svar++;
        }
        for (const t of fhirTyper) {
          const r = await k.get(`/fhir/${t}?patient=${id}`);
          expect({ roll, id, t, status: r.status }).toEqual({ roll, id, t, status: [200, 403].includes(r.status) ? r.status : 200 });
        }
      }
    }
    expect(svar).toBe(roller.length * 15 * vagar.length);
    // Runda 7, r6: över tusen anrop tar mer än fem sekunder när datorn har hög last, så testet får längre tid.
  }, 30_000);

  test('reset ger ny sandlåda', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Ny.' }] });
    expect((await k.get('/api/inkorg')).data.osigneradeAnteckningar.length).toBe(2);
    const r = await k.post('/api/reset');
    expect(r.data.ok).toBe(true);
    expect((await k.get('/api/inkorg')).data.osigneradeAnteckningar.length).toBe(1);
  });

  test('sandlådor sparas och läses in igen', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-sess-'));
    const fil = join(dir, 'sessioner.json');
    const a = testserver({ sessionFil: fil });
    const k = klient(a);
    await k.logga('lak-kard');
    const ny = await k.post('/api/patient/p01/anteckningar', { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Sparas.' }] });
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Test' });
    expect(a.spara()).toBe(1);
    a.stopp();
    const b = testserver({ sessionFil: fil });
    try {
      expect(existsSync(fil)).toBe(false);
      const url = b.url;
      const s = await fetch(url + '/api/session', { headers: { Cookie: k.kaka() } }).then(r => r.json());
      expect(s.personal.id).toBe('lak-kard');
      const ant = await fetch(url + `/api/anteckning/${ny.data.id}`, { headers: { Cookie: k.kaka() } }).then(r => r.json());
      expect(ant.sokord[0].text).toBe('Sparas.');
      const h = await fetch(url + '/api/patient/p01', { headers: { Cookie: k.kaka() } }).then(r => r.json());
      expect(h.andraEnheterVisade).toBe(true);
    } finally { b.stopp(); rmSync(dir, { recursive: true }); }
  });
});
