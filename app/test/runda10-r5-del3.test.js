// Runda 10, r5, del 3: de nationella vaccinationsprogrammen för barn och vuxna och rapporteringen till det simulerade
// vaccinationsregistret (Sussa 3.5.1.7). Testnamnen finns i src/sussa/runda10-r5-tester.js. Programmets regler prövas
// med fasta datum, och API-testerna räknar bara de rader testet själv skapar.
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { idag, addDagar, iso } from '../src/db.js';
import { T } from '../src/sussa/runda10-r5-tester.js';
import * as vp from '../src/vaccinationsprogram.js';
import * as register from '../src/vaccinationsregister.js';
import { ATC } from '../src/kodverk.js';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const ms = (d) => Date.parse(`${d}T12:00:00Z`);
const DASH = /[–—…]/;
async function inloggad(id) { const k = klient(app); await k.logga(id); return k; }

describe('Vaccinationsprogram', () => {
  test(T.vpProgram.split(' > ')[1], () => {
    // Ett barn på 7 år med MPR dos 1: dos 2 ges nu, HPV och dTp senare.
    const barn = vp.program({ fodd: '2019-03-01', nu: ms('2026-11-10'), givna: [{ vaccinId: 'mpr1', tid: '2020-03-15T10:00:00Z' }, { vaccinId: 'dtp4', tid: '2024-03-10T10:00:00Z' }] });
    expect(barn.attGe.map(v => v.id)).toEqual(['mpr2']);
    const rad = (id) => barn.rader.find(r => r.id === id);
    expect(rad('mpr2')).toMatchObject({ program: 'barn', status: 'nu', nar: 'Årskurs 1 till 2' });
    expect(rad('hpv1').status).toBe('kommande');
    expect(rad('hpv1').skal).toContain('ges tidigast');
    expect(rad('dtp5').status).toBe('kommande');
    // Vattkoppor gäller bara barn födda 1 juli 2025 eller senare, och åldern är inte fastställd.
    expect(rad('vzv1')).toBeUndefined();
    const spad = vp.program({ fodd: '2025-09-01', nu: ms('2026-11-10'), givna: [] });
    expect(spad.rader.find(r => r.id === 'vzv1')).toMatchObject({ status: 'ej_faststalld' });
    expect(spad.rader.find(r => r.id === 'vzv1').skal).toContain('1 januari 2027');
    expect(spad.attGe.map(v => v.id)).not.toContain('vzv1');
    // HPV dos 2 tidigast sex månader efter dos 1.
    const elva = vp.program({ fodd: '2015-02-01', nu: ms('2026-11-10'), givna: [{ vaccinId: 'hpv1', tid: '2026-09-01T10:00:00Z' }, { vaccinId: 'mpr1', tid: '2016-03-01T10:00:00Z' }, { vaccinId: 'mpr2', tid: '2022-03-01T10:00:00Z' }] });
    expect(elva.rader.find(r => r.id === 'hpv2').skal).toContain('2027-02-28');
    // En vuxen på 81 år: influensa i säsongen och pneumokocker, med skälet ålder.
    const aldre = vp.program({ fodd: '1945-02-02', nu: ms('2026-11-10'), givna: [] });
    expect(aldre.attGe.map(v => v.id)).toEqual(['influensa', 'pneumokocker']);
    expect(aldre.rader.find(r => r.id === 'influensa')).toMatchObject({ program: 'riskgrupper', varfor: 'Patienten är 81 år.' });
    // Utanför säsongen ges ingen influensados, och systemet säger när säsongen börjar.
    const sommar = vp.program({ fodd: '1945-02-02', nu: ms('2026-06-10'), givna: [] });
    expect(sommar.attGe.map(v => v.id)).toEqual(['pneumokocker']);
    expect(sommar.rader.find(r => r.id === 'influensa').skal).toContain('2026-10-01');
    // En influensados per säsong: en dos förra säsongen räknas inte.
    const igen = vp.program({ fodd: '1945-02-02', nu: ms('2026-11-10'), givna: [{ vaccinId: 'influensa', tid: '2025-11-02T10:00:00Z' }, { vaccinId: 'pneumokocker', tid: '2024-11-02T10:00:00Z' }] });
    expect(igen.attGe.map(v => v.id)).toEqual(['influensa']);
    // En vuxen på 50 år utan riskgrupp föreslås inget.
    expect(vp.program({ fodd: '1976-05-01', nu: ms('2026-11-10'), givna: [] }).attGe).toEqual([]);
    // Vaccinerna har ATC-kod ur WHO:s index och texterna har inga tankstreck.
    for (const v of vp.VACCINER) expect(ATC[v.atc]).toBeTruthy();
    expect(JSON.stringify(vp.VACCINER)).not.toMatch(DASH);
    expect(vp.KALLOR.program).toContain('Folkhälsomyndigheten');
  });

  test(T.vpRiskgrupp.split(' > ')[1], async () => {
    // Elin Sandberg (p04) är 49 år och har en spärr på psykiatrin.
    const k = await inloggad('lak-kard');
    const s = sandlada(app, k);
    const fore = (await k.get('/api/patient/p04/vaccinationsprogram')).data;
    expect(fore.riskgrupper).toEqual([]);
    const ins = s.db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum, kalla) VALUES ('p04', ?, ?, ?, 'bi', ?, 'vardkallan')");
    ins.run('uso-psyk', 'E11.9', 'Typ 2-diabetes utan komplikationer', idag());
    const sparr = (await k.get('/api/patient/p04/vaccinationsprogram')).data;
    // En diagnos bakom en spärr gör ingen riskgrupp och röjs inte.
    expect(JSON.stringify(sparr)).toBe(JSON.stringify(fore));
    ins.run('uso-kard-72', 'J44.9', 'Kroniskt obstruktiv lungsjukdom, ospecificerad', idag());
    const efter = (await k.get('/api/patient/p04/vaccinationsprogram')).data;
    expect(efter.riskgrupper).toEqual([{ id: 'lunga', text: 'Kronisk lungsjukdom (J44.9)' }]);
    expect(efter.program.rader.find(r => r.id === 'pneumokocker')).toMatchObject({ varfor: 'Patienten har kronisk lungsjukdom (J44.9).' });
    expect(efter.program.attGe.map(v => v.id)).toContain('pneumokocker');
  });

  test(T.vpRegistrera.split(' > ')[1], async () => {
    const k = await inloggad('ssk-kard');
    const s = sandlada(app, k);
    // Före dosen frågar systemet alltid om vaccinationer som har getts någon annanstans.
    const fraga = await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker' });
    expect(fraga.status).toBe(400);
    expect(fraga.data.kod).toBe('kraver_fraga');
    const r = await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker', andraVaccinationer: 'nej', batch: 'PN2611' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ vaccinId: 'pneumokocker', atc: 'J07AL02', dos: 1, batch: 'PN2611', vardenhet: { id: 'uso-kard-72' }, program: 'Särskilt vaccinationsprogram för riskgrupper' });
    expect(r.data.text).toBe('Pneumokocker är registrerad och rapporterad till vaccinationsregistret (simulerat).');
    // En dos till prövas mot programmet och stoppas med en förklaring.
    const igen = await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker', andraVaccinationer: 'nej' });
    expect(igen.status).toBe(400);
    expect(igen.data.fel).toContain('är redan given');
    // En dos som barnhälsovården ger hör inte hit.
    expect((await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'hexa1', andraVaccinationer: 'nej' })).data.fel).toContain('barnavårdscentralen');
    // En dos som har getts någon annanstans registreras med källan och rapporteras inte av Vårdkällan.
    const t = await k.post('/api/patient/p01/vaccinationsprogram/tidigare', { vaccinId: 'influensa', datum: addDagar(idag(), -3), kalla: 'annan', text: 'Vaccinationsmottagning i Stockholm' });
    expect(t.status).toBe(201);
    expect(t.data).toMatchObject({ vaccinId: 'influensa', kalla: { typ: 'annan', text: 'Vaccinationsmottagning i Stockholm' }, givetAv: null, rapport: null });
    expect((await k.get('/api/patient/p01/vaccinationsprogram')).data.program.attGe.map(v => v.id)).not.toContain('influensa');
    expect((await k.post('/api/patient/p01/vaccinationsprogram/tidigare', { vaccinId: 'influensa', datum: addDagar(idag(), 3), kalla: 'annan' })).status).toBe(400);
    // Inga ändringar eller raderingar.
    expect(() => s.db.query("UPDATE vaccinationer SET batch = 'X' WHERE vaccin_id = 'pneumokocker'").run()).toThrow(/ändras inte/);
  });

  test(T.vpRegister.split(' > ')[1], async () => {
    const k = await inloggad('ssk-kard');
    const s = sandlada(app, k);
    const r = await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker', andraVaccinationer: 'nej' });
    const rap = s.db.query('SELECT * FROM vaccinationsrapporter WHERE vaccination_id = ?').get(r.data.id);
    expect(rap).toMatchObject({ status: 'kvitterad', patient_id: 'p01' });
    expect(rap.kvittens).toMatch(/^VR-SIM-\d{6}$/);
    // Meddelandet har det registret behöver: personnummer, vaccin, dos, datum, vårdgivare och vårdenhet.
    const m = JSON.parse(rap.meddelande);
    expect(m).toMatchObject({ personnummer: '194502024732', atc: 'J07AL02', dos: 1, vardgivare: 'SE2321000164-VK0000', vardenhet: expect.stringMatching(/^SE2321000164-VK/) });
    expect(register.MOTTAGARE).toContain('simulerat');
    const l = (await k.get('/api/patient/p01/vaccinationsprogram')).data.vaccinationer.find(v => v.id === r.data.id);
    expect(l.rapport).toMatchObject({ status: 'kvitterad', statusText: 'Rapporterad och kvitterad av vaccinationsregistret (simulerat)', kvittens: rap.kvittens });
    // En vaccination i barnhälsovården rapporteras också.
    const bvc = await inloggad('ssk-vc');
    const bs = sandlada(app, bvc);
    const fore = bs.db.query('SELECT count(*) AS n FROM vaccinationsrapporter').get().n;
    const prog = (await bvc.get('/api/patient/p61/bhv')).data;
    const ge = prog.program?.attGe?.[0];
    if (ge) {
      const v = await bvc.post('/api/patient/p61/vaccination', { vaccinId: ge.id, andraVaccinationer: 'nej' });
      expect(v.status).toBe(201);
      expect(bs.db.query('SELECT count(*) AS n FROM vaccinationsrapporter').get().n).toBe(fore + 1);
    }
    // Rapporterna ändras och raderas aldrig.
    expect(() => s.db.query("UPDATE vaccinationsrapporter SET kvittens = 'x'").run()).toThrow(/ändras inte/);
    expect(() => s.db.query('DELETE FROM vaccinationsrapporter').run()).toThrow(/raderas inte/);
  });

  test(T.vpBehorighet.split(' > ')[1], async () => {
    // Vårdadministratören ger inga vaccinationer.
    const adm = await inloggad('adm-kard');
    expect((await adm.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker', andraVaccinationer: 'nej' })).status).toBe(403);
    // Läkaren på kardiologen har ingen vårdrelation till Emma Karlsson (p13). Nödåtkomst ger bara läsning.
    const k = await inloggad('lak-kard');
    expect((await k.get('/api/patient/p13/vaccinationsprogram')).status).toBe(403);
    expect((await k.post('/api/patient/p13/val', { typ: 'nodatkomst', syfte: 'Patienten är medvetslös' })).status).toBe(200);
    expect((await k.get('/api/patient/p13/vaccinationsprogram')).status).toBe(200);
    expect((await k.post('/api/patient/p13/vaccinationsprogram/vaccination', { vaccinId: 'influensa', andraVaccinationer: 'nej' })).status).toBe(403);
    // Läsningen loggas på patienten.
    const s = sandlada(app, k);
    expect(s.db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p13' AND resurs = '/api/patient/p13/vaccinationsprogram' AND grund = 'nodatkomst'").get().n).toBe(1);
  });

  test(T.vpFhir.split(' > ')[1], async () => {
    const k = await inloggad('ssk-kard');
    const r = await k.post('/api/patient/p01/vaccinationsprogram/vaccination', { vaccinId: 'pneumokocker', andraVaccinationer: 'nej' });
    const im = (await k.get(`/fhir/Immunization/${r.data.id}`)).data;
    expect(im).toMatchObject({ resourceType: 'Immunization', vaccineCode: { coding: [{ code: 'J07AL02' }], text: 'Pneumokocker' }, protocolApplied: [{ series: 'Särskilt vaccinationsprogram för riskgrupper', doseNumberPositiveInt: 1 }] });
    // En dos som har getts någon annanstans är inte från primärkällan.
    const t = await k.post('/api/patient/p01/vaccinationsprogram/tidigare', { vaccinId: 'influensa', datum: addDagar(idag(), -3), kalla: 'annan', text: 'Utomlands' });
    const it = (await k.get(`/fhir/Immunization/${t.data.id}`)).data;
    expect(it).toMatchObject({ primarySource: false, reportOrigin: { text: 'Utomlands' } });
    await k.logga('adm-kard');
    expect((await k.get(`/fhir/Immunization/${r.data.id}`)).status).toBe(403);
  });
});
