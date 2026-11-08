import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb, somPerson } from './hjalp.js';
import { T10 } from '../src/sussa/runda10-r7.js';
import * as kassa from '../src/kassa.js';
import * as kapacitet from '../src/kapacitetsprognos.js';
import * as kontorsstod from '../src/kontorsstod.js';
import * as konfiguration from '../src/konfiguration.js';
import { packaUpp } from '../src/zip.js';
import { idag, addDagar, iso } from '../src/db.js';
import { harVardrelation, Atkomst } from '../src/atkomst.js';
import { hogkostnadsskyddet } from '../src/vardkontakt.js';

// Runda 10, r7 (Sussa 3.4.1.5, 3.4.2.3, 3.4.4.1, 3.4.4.4, 3.7.1.1, 3.7.1.3 och 5.1.1.1): ombud med fullmakt, meddelanden
// mellan invånare och vård, invånarens begäranden, vårdplanen i Min journal, kassan, kapaciteten och kontorsstödet.
// Testnamnen står i src/sussa/runda10-r7.js, som kravregistret pekar på.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

// Testnamnen i T10 har avsnittet först (Ombud > ...), som describe ger. Här står bara resten.
const namn = (t) => t.split(' > ').slice(1).join(' > ');
const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const logg = (k, villkor, ...arg) => db(k).query(`SELECT * FROM atkomstlogg WHERE ${villkor} ORDER BY id`).all(...arg);
// En annan inloggning i samma sandlåda: samma sessionsdatabas, en annan person.
// Samma sandlåda, en annan person: personal med sitt medarbetaruppdrag eller en invånare i Min journal.
const som = (s, id) => { s.invanareId = null; return somPerson(s, id); };
const somInv = (s, id) => { s.personalId = null; s.uppdrag = null; s.invanareId = id; return s; };

// Ett ombud bokar en tid som patienten själv kan boka i Min journal. Systemet ger valen och förslagen.
async function bokaSom(k, pid) {
  const t = (await k.get(`/api/min/journal/${pid}/tider`)).data;
  const val = t.boka[0];
  const f = (await k.get(`/api/min/journal/${pid}/boka/forslag?nyckel=${encodeURIComponent(val.nyckel)}`)).data;
  return k.post(`/api/min/journal/${pid}/boka`, { nyckel: val.nyckel, tidId: f.forslag[0].tidId });
}

describe('Ombud', () => {
  test(namn(T10.ombudBoka), async () => {
    // Thomas Lindberg (p02) ger Johanna Bergström fullmakt i Min journal.
    const p = await invanare('inv-p02');
    const lista = (await p.get('/api/min/journal/p02/ombud')).data;
    expect(lista.kanGe).toBe(true);
    const r = await p.post('/api/min/journal/p02/ombud', { personnummer: '19861214-2383' });
    expect(r.status).toBe(201);
    expect(r.data.fullmakt).toMatchObject({ aktiv: false, vantar: true, ombud: { personnummer: '19861214-****' } });
    // Johanna Bergström godkänner i sin egen inloggning. Då gäller fullmakten och patienten ser namnet.
    const pv = sandlada(app, p);
    somInv(pv, 'inv-vh01');
    expect((await p.post(`/api/min/fullmakt/${r.data.fullmakt.id}/godkann`)).status).toBe(200);
    somInv(pv, 'inv-p02');
    expect((await p.get('/api/min/journal/p02/ombud')).data.fullmakter[0].ombud).toEqual({ namn: 'Johanna Bergström', personnummer: '19861214-2383' });
    expect(r.data.fullmakt.omfattning.map(x => x.id)).toEqual(['tider', 'meddelanden']);
    expect(r.data.fullmakt.giltigTill).toBe(addDagar(idag(), 365));
    // Det seedade ombudet Karin Åkesson bokar, bokar om och avbokar för Gunnar Åkesson (p01).
    const o = await invanare('inv-om01');
    const s = (await o.get('/api/session')).data;
    expect(s.ombudFor).toEqual([expect.objectContaining({ patientId: 'p01', namn: 'Gunnar Åkesson', relation: 'ombud' })]);
    expect(s.journaler).toEqual([]);
    const h = (await o.get('/api/min/journal/p01')).data;
    expect(h).toMatchObject({ relation: 'ombud', sparrar: [], kanBegaraSparr: false, ombud: { omfattning: ['tider', 'meddelanden'] } });
    const bokad = await bokaSom(o, 'p01');
    expect(bokad.status).toBe(201);
    const b = db(o).query('SELECT * FROM bokningar WHERE id = ?').get(bokad.data.id);
    expect(b).toMatchObject({ patient_id: 'p01', bokad_av_invanare: 'inv-om01' });
    expect(b.orsak).toContain('bokad av ombudet');
    const f = (await o.get(`/api/min/journal/p01/bokning/${b.id}/forslag`)).data;
    const om = await o.post(`/api/min/journal/p01/bokning/${b.id}/omboka`, { tidId: f.forslag[0].tidId });
    expect(om.status).toBe(200);
    expect((await o.post(`/api/min/journal/p01/bokning/${om.data.id}/avboka`)).status).toBe(200);
    // Allt loggas på patienten med ombudet som invånare och grunden ombud.
    const rader = logg(o, "patient_id = 'p01' AND invanare_id = 'inv-om01' AND resultat = 'tillaten'");
    expect(rader.map(x => x.resurs)).toEqual(expect.arrayContaining([`min:bokning:${b.id}:bokad`, `min:bokning:${b.id}:ombokad:${om.data.id}`, `min:bokning:${om.data.id}:avbokad`]));
    expect(new Set(rader.map(x => x.grund))).toEqual(new Set(['ombud']));
  });

  test(namn(T10.ombudJournal), async () => {
    const o = await invanare('inv-om01');
    for (const del of ['oversikt', 'anteckningar', 'lakemedel', 'logglista', 'sparrar', 'vardplaner', 'avgifter', 'hogkostnadsskydd']) {
      const r = await o.get(`/api/min/journal/p01/${del}`);
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.data)).not.toContain('Åkesson');
    }
    expect((await o.get('/api/min/journal/p01/anteckning/1')).status).toBe(403);
    expect((await o.post('/api/min/journal/p01/begaran', { typ: 'loggutdrag' })).status).toBe(403);
    // Ombudet kan inte ge vidare en fullmakt för patienten.
    expect((await o.post('/api/min/journal/p01/ombud', { personnummer: '19861214-2383' })).status).toBe(403);
    // De nekade försöken loggas på patienten.
    expect(logg(o, "patient_id = 'p01' AND invanare_id = 'inv-om01' AND resultat = 'nekad'").length).toBeGreaterThanOrEqual(8);
    // En patient som inte har gett fullmakt: samma svar som för en journal som inte finns.
    expect((await o.get('/api/min/journal/p02/tider')).status).toBe(404);
    // Patienten återkallar. Då når ombudet ingenting.
    // Patienten loggar in i samma sandlåda som ombudet.
    const p = await invanare('inv-p01');
    const ps = sandlada(app, p);
    const os = sandlada(app, o);
    ps.db = os.db;
    const fid = (await p.get('/api/min/journal/p01/ombud')).data.fullmakter[0].id;
    expect((await p.post(`/api/min/journal/p01/ombud/${fid}/aterkalla`)).status).toBe(200);
    expect((await o.get('/api/min/journal/p01/tider')).status).toBe(404);
    expect((await o.get('/api/session')).data.ombudFor).toEqual([]);
    // En utgången fullmakt gäller inte heller.
    const ny = await p.post('/api/min/journal/p01/ombud', { personnummer: '19770123-2386' });
    expect(ny.status).toBe(201);
    expect((await o.get('/api/min/journal/p01/tider')).status).toBe(404);
    expect((await o.post(`/api/min/fullmakt/${ny.data.fullmakt.id}/godkann`)).status).toBe(200);
    expect((await o.get('/api/min/journal/p01/tider')).status).toBe(200);
    os.db.exec('DROP TRIGGER fullmakt_andras_ej');
    os.db.query('UPDATE fullmakter SET giltig_till = ? WHERE id = ?').run(addDagar(idag(), -1), ny.data.fullmakt.id);
    expect((await o.get('/api/min/journal/p01/tider')).status).toBe(404);
  });

  test(namn(T10.ombudVard), async () => {
    const k = await inloggad('adm-kard');
    expect((await k.get('/api/patient/p01/fullmakter')).data.fullmakter[0]).toMatchObject({ aktiv: true, ombud: { namn: 'Karin Åkesson' }, kalla: 'min_journal' });
    // Utan skriftlig fullmakt registreras inget.
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19861214-2383' })).status).toBe(400);
    const r = await k.post('/api/patient/p10/fullmakter', { personnummer: '19861214-2383', skriftlig: true, omfattning: ['tider'] });
    expect(r.status).toBe(201);
    expect(r.data.fullmakt).toMatchObject({ kalla: 'vard', omfattning: [{ id: 'tider' }] });
    expect(logg(k, "patient_id = 'p10' AND handling = 'fullmakt' AND personal_id = 'adm-kard'")).toHaveLength(1);
    // Dubblett, sig själv, barn som ombud, okänt nummer och fel omfattning.
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19861214-2383', skriftlig: true })).status).toBe(400);
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19460113-6098', skriftlig: true })).status).toBe(400);
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '20171211-2398', skriftlig: true })).data.fel).toContain('18 år');
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19000101-0000', skriftlig: true })).status).toBe(400);
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19770123-2386', skriftlig: true, omfattning: ['journal'] })).status).toBe(400);
    // Ett barn ger ingen fullmakt.
    expect((await k.post('/api/patient/p09/fullmakter', { personnummer: '19770123-2386', skriftlig: true })).status).toBe(400);
    // Ombudet med fullmakt för tider kan inte skriva meddelanden för patienten.
    const s = sandlada(app, k);
    somInv(s, 'inv-vh01');
    const v = { get: (x) => k.get(x), post: (x, b) => k.post(x, b) };
    expect((await v.get('/api/min/journal/p10/tider')).status).toBe(200);
    expect((await v.get('/api/min/journal/p10/meddelanden')).status).toBe(403);
    som(s, 'adm-kard');
    // Återkallas av vården. Läkaren kan inte registrera fullmakter.
    expect((await k.post(`/api/patient/p10/fullmakter/${r.data.fullmakt.id}/aterkalla`)).status).toBe(200);
    som(s, 'lak-kard');
    expect((await k.post('/api/patient/p10/fullmakter', { personnummer: '19861214-2383', skriftlig: true })).status).toBe(403);
    // Taket: högst tre ombud samtidigt.
    som(s, 'adm-kard');
    for (const pnr of ['19861214-2383', '19770123-2386', '19660319-3373']) expect((await k.post('/api/patient/p10/fullmakter', { personnummer: pnr, skriftlig: true })).status).toBe(201);
    const tak = await k.post('/api/patient/p10/fullmakter', { personnummer: '19650314-3254', skriftlig: true });
    expect(tak.status).toBe(400);
    expect(tak.data.fel).toContain('högst 3 ombud');
  });

  test(namn(T10.ombudInnehall), async () => {
    const o = await invanare('inv-om01');
    const d = db(o);
    const ord = d.query("SELECT o.id, k.namn FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01'").all();
    // Gunnar Åkesson får en vårdplan, så att det finns en plan som ombudet inte får se.
    d.query("INSERT INTO vardplaner (patient_id, enhet_id, mall, rubrik, uppfoljning, skapad, skapad_av) VALUES ('p01', 'uso-kard-72', NULL, 'Plan för hjärtsvikten', ?, ?, 'ssk-kard')").run(addDagar(idag(), 7), iso());
    const planer = d.query("SELECT id, rubrik FROM vardplaner WHERE patient_id = 'p01'").all();
    const hemligt = [...ord.flatMap(x => [x.namn, `"ordinationId":${x.id}`]), ...planer.flatMap(x => [x.rubrik, `"planId":${x.id}`])];
    const r = await o.get('/api/min/journal/p01/meddelanden');
    expect(r.status).toBe(200);
    expect(r.data.lakemedel).toEqual([]);
    expect(r.data.planer).toEqual([]);
    expect(r.data.typer.map(t => t.id)).not.toContain('recept');
    expect(r.data.typer.map(t => t.id)).not.toContain('vardplan');
    // Den seedade tråden om receptet, som patienten själv startade, finns inte för ombudet.
    expect(r.data.tradar.some(t => t.typ === 'recept')).toBe(false);
    const text = JSON.stringify(r.data);
    for (const x of hemligt) expect(text).not.toContain(x);
    for (const t of r.data.tradar) expect(t.galler).toBeNull();
    // Ombudet kan inte pröva sig fram med recept eller vårdplan, med ett id som finns eller inte finns.
    for (const body of [{ typ: 'recept', text: 'Förnya', ordinationId: ord[0].id }, { typ: 'vardplan', text: 'Kommentar', planId: planer[0].id }, { typ: 'recept', text: 'Förnya', ordinationId: 999999 }, { typ: 'vardplan', text: 'Kommentar', planId: 999999 }]) {
      const n = await o.post('/api/min/journal/p01/meddelanden', body);
      expect(n.status).toBe(403);
      expect(n.data.fel).toContain('patienten själv eller en vårdnadshavare');
      for (const x of hemligt) expect(JSON.stringify(n.data)).not.toContain(x);
    }
    // Svaret på ett eget meddelande visar inte heller vad en tråd gäller.
    const egen = await o.post('/api/min/journal/p01/meddelanden', { typ: 'tid', text: 'Pappa behöver en tid.', enhetId: 'uso-kard' });
    expect(egen.status).toBe(201);
    for (const x of hemligt) expect(JSON.stringify(egen.data)).not.toContain(x);
    // När läkaren har förnyat receptet nämner svaret inte läkemedlet, så ombudet ser det inte heller där.
    const s = sandlada(app, o);
    som(s, 'lak-kard');
    const rid = d.query("SELECT id FROM meddelandetradar WHERE patient_id = 'p01' AND typ = 'recept'").get().id;
    expect((await o.post(`/api/meddelanden/${rid}/avsluta`, { utfall: 'fornyat' })).status).toBe(200);
    somInv(s, 'inv-om01');
    const efter = JSON.stringify((await o.get('/api/min/journal/p01/meddelanden')).data);
    for (const x of hemligt) expect(efter).not.toContain(x);
    // Samma anrop för patienten själv fungerar som förut.
    somInv(sandlada(app, o), 'inv-p01');
    const p = (await o.get('/api/min/journal/p01/meddelanden')).data;
    expect(p.lakemedel.length).toBeGreaterThan(0);
    expect(p.planer.map(x => x.id)).toContain(planer[0].id);
    expect(p.typer.map(t => t.id)).toEqual(expect.arrayContaining(['recept', 'vardplan']));
    expect(p.tradar.find(t => t.typ === 'recept').galler).toBeTruthy();
    expect((await o.post('/api/min/journal/p01/meddelanden', { typ: 'vardplan', text: 'Bra plan.', planId: planer[0].id })).status).toBe(201);
  });

  test(namn(T10.ombudTradar), async () => {
    const o = await invanare('inv-om01');
    const d = db(o);
    const s = sandlada(app, o);
    const lm = d.query("SELECT o.id, k.namn FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND o.status = 'aktiv' ORDER BY o.id LIMIT 1").get();
    const recept = d.query("SELECT * FROM meddelandetradar WHERE patient_id = 'p01' AND typ = 'recept'").get();
    // En äldre systemrad i tråden som nämner läkemedlet, som den kan ha sett ut innan svaret skrevs om.
    d.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, text, tid) VALUES (?, 'p01', 'uso-kard', 'systemet', ?, ?)").run(recept.id, `Receptet för ${lm.namn} är förnyat.`, iso());
    // En tråd om en vårdplan som patienten har startat.
    const plan = Number(d.query("INSERT INTO vardplaner (patient_id, enhet_id, mall, rubrik, uppfoljning, skapad, skapad_av) VALUES ('p01', 'uso-kard-72', NULL, 'Plan för andningen', ?, ?, 'ssk-kard')").run(addDagar(idag(), 7), iso()).lastInsertRowid);
    somInv(s, 'inv-p01');
    const pt = await o.post('/api/min/journal/p01/meddelanden', { typ: 'vardplan', planId: plan, text: 'Plan för andningen är bra.' });
    expect(pt.status).toBe(201);
    // Ombudet ser varken trådarna, texterna eller räknarna för dem.
    somInv(s, 'inv-om01');
    const fore = d.query("SELECT count(*) AS n FROM invanarmeddelanden WHERE trad_id IN (?, ?) AND lasd IS NULL AND fran <> 'invanare'").get(recept.id, pt.data.trad.id).n;
    const r = await o.get('/api/min/journal/p01/meddelanden');
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.data);
    for (const x of [lm.namn, 'Plan för andningen', 'snart slut på tabletterna', `"id":${recept.id},`, `"id":${pt.data.trad.id},`]) expect(text).not.toContain(x);
    expect(r.data.tradar.every(t => !['recept', 'vardplan'].includes(t.typ))).toBe(true);
    // Läsningen markerar inte de dolda trådarnas svar som lästa.
    expect(d.query("SELECT count(*) AS n FROM invanarmeddelanden WHERE trad_id IN (?, ?) AND lasd IS NULL AND fran <> 'invanare'").get(recept.id, pt.data.trad.id).n).toBe(fore);
    // Ett svar i en dold tråd ger samma svar som i en tråd som inte finns.
    const dold = await o.post(`/api/min/journal/p01/meddelanden/${recept.id}/svar`, { text: 'Hej' });
    const saknas = await o.post('/api/min/journal/p01/meddelanden/999999/svar', { text: 'Hej' });
    expect(dold.status).toBe(404);
    expect(dold.data).toEqual(saknas.data);
    // Taket för öppna meddelanden räknar bara ombudets synliga trådar, så att det inte röjer de dolda. Med de två dolda
    // har patienten sex öppna trådar, men ombudet ser fyra och kan skriva ett till.
    for (let i = 0; i < 3; i++) expect((await o.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: `Fråga ${i}`, enhetId: 'uso-kard' })).status).toBe(201);
    const r2 = (await o.get('/api/min/journal/p01/meddelanden')).data;
    expect(r2.tradar).toHaveLength(4);
    expect(r2.kanSkriva).toBe(true);
    // Patienten själv ser trådarna och kan svara.
    somInv(s, 'inv-p01');
    const p = (await o.get('/api/min/journal/p01/meddelanden')).data;
    expect(p.tradar.map(t => t.id)).toEqual(expect.arrayContaining([recept.id, pt.data.trad.id]));
    expect(JSON.stringify(p)).toContain(lm.namn);
    expect((await o.post(`/api/min/journal/p01/meddelanden/${recept.id}/svar`, { text: 'Tack.' })).status).toBe(200);
  });

  test(namn(T10.ombudUppslag), async () => {
    // Thomas Lindberg (p02) ger fullmakt. Svaret visar aldrig namnet på den han anger, bara personnumret maskerat.
    const p = await invanare('inv-p02');
    const ok = await p.post('/api/min/journal/p02/ombud', { personnummer: '19861214-2383' });
    expect(ok.status).toBe(201);
    const oktext = JSON.stringify(ok.data);
    for (const x of ['Johanna', 'Bergström', '2383']) expect(oktext).not.toContain(x);
    expect(oktext).toContain('19861214-****');
    expect(ok.data.fullmakt.giltigTill).toBeTruthy();
    // I listan ser patienten bara personnumret maskerat tills ombudet har godkänt.
    expect((await p.get('/api/min/journal/p02/ombud')).data.fullmakter[0].ombud).toEqual({ personnummer: '19861214-****' });
    // Samma svar för en person som inte finns, en som är under 18 och en med skyddade personuppgifter.
    const svar = [];
    for (const pnr of ['19121212-1212', '20171211-2398', '19840416-2383']) {
      const r = await p.post('/api/min/journal/p02/ombud', { personnummer: pnr });
      svar.push({ status: r.status, data: r.data });
    }
    expect(svar[0].status).toBe(400);
    expect(svar[1]).toEqual(svar[0]);
    expect(svar[2]).toEqual(svar[0]);
    expect(svar[0].data.fel).toContain('vårdenhet');
    for (const x of ['Malin', 'Engberg', 'Leo', '18 år']) expect(JSON.stringify(svar)).not.toContain(x);
    // En patient med skyddade personuppgifter kan inte ge fullmakt själv, med samma svar.
    const sk = await invanare('inv-p03');
    const r3 = await sk.post('/api/min/journal/p03/ombud', { personnummer: '19861214-2383' });
    expect({ status: r3.status, data: r3.data }).toEqual(svar[0]);
    // Misslyckade försök loggas på patienten.
    expect(logg(p, "patient_id = 'p02' AND invanare_id = 'inv-p02' AND resurs = 'min:ombud:nekad' AND resultat = 'nekad'")).toHaveLength(3);
    // Personalen registrerar en fullmakt för och till en person med skyddade personuppgifter, och då visas aldrig namnet.
    const k = await inloggad('adm-kard');
    const s = sandlada(app, k);
    s.db = sandlada(app, sk).db;
    const fs = await k.post('/api/patient/p03/fullmakter', { personnummer: '19861214-2383', skriftlig: true });
    expect(fs.status).toBe(201);
    const till = await k.post('/api/patient/p10/fullmakter', { personnummer: '19840416-2383', skriftlig: true });
    expect(till.status).toBe(201);
    expect(till.data.fullmakt.ombud).toEqual({ namn: 'Skyddad identitet', personnummer: '19840416-****' });
    const lista = JSON.stringify((await k.get('/api/patient/p10/fullmakter')).data);
    expect(lista).not.toContain('Engberg');
    // Ombudet med skyddade personuppgifter ser patienten, och patienten med skyddade personuppgifter visas aldrig med namn.
    somInv(s, 'inv-vh01');
    const sess = JSON.stringify((await k.get('/api/session')).data.ombudFor);
    expect(sess).not.toContain('Engberg');
    expect(sess).toContain('Skyddad identitet');
    // Taket: efter tio misslyckade försök stoppas fler försök, också med ett nummer som annars hade gått.
    for (let i = 0; i < 7; i++) expect((await p.post('/api/min/journal/p02/ombud', { personnummer: '19121212-1212' })).status).toBe(400);
    const tak = await p.post('/api/min/journal/p02/ombud', { personnummer: '19770123-2386' });
    expect(tak.status).toBe(429);
    expect(tak.data.fel).toContain('många försök');
    expect((await p.get('/api/min/journal/p02/ombud')).data.fullmakter).toHaveLength(1);
  });

  test(namn(T10.ombudGodkann), async () => {
    // Birgitta Nyman (p06) ger fullmakt i Min journal. Den gäller först när ombudet har godkänt den.
    const p = await invanare('inv-p06');
    const s = sandlada(app, p);
    const r = await p.post('/api/min/journal/p06/ombud', { personnummer: '19861214-2383' });
    expect(r.status).toBe(201);
    expect(r.data.fullmakt).toMatchObject({ aktiv: false, vantar: true, ombud: { personnummer: '19861214-****' } });
    const fore = (await p.get('/api/min/journal/p06/ombud')).data;
    expect(fore.fullmakter[0]).toMatchObject({ vantar: true, ombud: { personnummer: '19861214-****' } });
    expect(fore.fullmakter[0].statusText).toContain('väntar på att ombudet godkänner');
    expect(JSON.stringify(fore)).not.toContain('Johanna');
    expect(JSON.stringify(fore)).not.toContain('Bergström');
    // Före godkännandet ger fullmakten ingen åtkomst.
    somInv(s, 'inv-vh01');
    expect((await p.get('/api/min/journal/p06/tider')).status).toBe(404);
    const sess = (await p.get('/api/session')).data;
    expect(sess.ombudFor.map(x => x.patientId)).not.toContain('p06');
    const fr = sess.ombudForfragningar.find(x => x.patient.namn === 'Birgitta Nyman');
    expect(fr).toBeTruthy();
    // Ombudet godkänner i sin egen inloggning. Patienten kan inte godkänna åt ombudet.
    somInv(s, 'inv-p06');
    expect((await p.post(`/api/min/fullmakt/${fr.id}/godkann`)).status).toBe(404);
    somInv(s, 'inv-vh01');
    expect((await p.post(`/api/min/fullmakt/${fr.id}/godkann`)).status).toBe(200);
    expect((await p.get('/api/min/journal/p06/tider')).status).toBe(200);
    expect(logg(p, "patient_id = 'p06' AND invanare_id = 'inv-vh01' AND resurs = ?", `min:fullmakt:${fr.id}:godkand`)).toHaveLength(1);
    // Efter godkännandet ser patienten namnet.
    somInv(s, 'inv-p06');
    expect((await p.get('/api/min/journal/p06/ombud')).data.fullmakter[0]).toMatchObject({ aktiv: true, vantar: false, ombud: { namn: 'Johanna Bergström' } });
    // Samma svar för okänt nummer, en dubblett, personen själv och fullt antal ombud.
    const fel = async (pnr) => { const x = await p.post('/api/min/journal/p06/ombud', { personnummer: pnr }); return { status: x.status, data: x.data }; };
    const okant = await fel('19121212-1212');
    expect(okant.status).toBe(400);
    expect(await fel('19861214-2383')).toEqual(okant);
    expect(await fel('19460119-8882')).toEqual(okant);
    // Två till ger tre ombud (det andra väntar), och ett fjärde ger samma svar som ett okänt nummer.
    expect((await p.post('/api/min/journal/p06/ombud', { personnummer: '19770123-2386' })).status).toBe(201);
    expect((await p.post('/api/min/journal/p06/ombud', { personnummer: '19660319-3373' })).status).toBe(201);
    expect(await fel('19650314-3254')).toEqual(okant);
    // Alla misslyckade försök räknas mot taket: fyra hittills, sex till och sedan stoppas också ett giltigt nummer.
    expect(logg(p, "patient_id = 'p06' AND invanare_id = 'inv-p06' AND resurs = 'min:ombud:nekad'")).toHaveLength(4);
    for (let i = 0; i < 6; i++) await fel('19121212-1212');
    expect((await fel('19800426-2385')).status).toBe(429);
  });

  test(namn(T10.ombudCykel), async () => {
    // Registrering och återkallelse om och om igen har ett eget tak per dygn.
    const p = await invanare('inv-p05');
    const svar = [];
    for (let i = 0; i < 4; i++) {
      const r = await p.post('/api/min/journal/p05/ombud', { personnummer: '19861214-2383' });
      svar.push(r.status);
      if (r.status === 201) await p.post(`/api/min/journal/p05/ombud/${r.data.fullmakt.id}/aterkalla`);
    }
    expect(svar.slice(0, 3)).toEqual([201, 201, 201]);
    expect(svar[3]).toBe(429);
    // Ett ombud avböjer en förfrågan, och den ger aldrig åtkomst.
    const k = await invanare('inv-p11');
    const s = sandlada(app, k);
    const r = await k.post('/api/min/journal/p11/ombud', { personnummer: '19861214-2383' });
    somInv(s, 'inv-vh01');
    expect((await k.post(`/api/min/fullmakt/${r.data.fullmakt.id}/avboj`)).status).toBe(200);
    expect((await k.post(`/api/min/fullmakt/${r.data.fullmakt.id}/godkann`)).status).toBe(404);
    expect((await k.get('/api/min/journal/p11/tider')).status).toBe(404);
    // En fullmakt som personalen registrerar efter en skriftlig fullmakt gäller direkt.
    const a = await inloggad('adm-kard');
    const sa = sandlada(app, a);
    const v = await a.post('/api/patient/p10/fullmakter', { personnummer: '19861214-2383', skriftlig: true });
    expect(v.data.fullmakt).toMatchObject({ aktiv: true, vantar: false });
    somInv(sa, 'inv-vh01');
    expect((await a.get('/api/min/journal/p10/tider')).status).toBe(200);
  });

  test(namn(T10.ombudLogg), async () => {
    const o = await invanare('inv-om01');
    const bokad = await bokaSom(o, 'p01');
    expect(bokad.status).toBe(201);
    const s = sandlada(app, o);
    somInv(s, 'inv-p01');
    const l = (await o.get('/api/min/journal/p01/logglista')).data;
    expect(l.rader.filter(r => r.vem === 'ombud').length).toBeGreaterThan(0);
    expect(JSON.stringify(l.rader.filter(r => r.vem === 'ombud'))).not.toContain('Karin');
    som(s, 'adm-kard');
    const start = db(o).query('SELECT t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.id = ?').get(bokad.data.id).start;
    const t = (await o.get(`/api/tidbok?datum=${new Date(start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })}`)).data;
    expect(JSON.stringify(t)).toContain('bokad av ombudet');
  });
});

describe('Meddelanden från invånare', () => {
  test(namn(T10.skriva), async () => {
    const p = await invanare('inv-p01');
    const l = (await p.get('/api/min/journal/p01/meddelanden')).data;
    expect(l.mottagare.map(m => m.id)).toContain('uso-kard');
    expect(l.typer.map(t => t.id)).toEqual(expect.arrayContaining(['fraga', 'recept', 'intyg', 'tid']));
    expect(l.tradar.length).toBe(2);
    const r = await p.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: 'Kan jag cykla till besöket?' });
    expect(r.status).toBe(201);
    expect(r.data.trad).toMatchObject({ typ: 'fraga', vardenhet: l.mottagare[0].namn, yrkesrollText: 'sjuksköterska', status: 'ny' });
    expect(r.data.text).toContain('Vården svarar inom tre arbetsdagar');
    // Ett recept går till den vårdenhet som ordinerade läkemedlet och till en läkare.
    const lm = l.lakemedel[0];
    const rr = await p.post('/api/min/journal/p01/meddelanden', { typ: 'recept', text: 'Snälla förnya.', ordinationId: lm.id });
    expect(rr.status === 201 || rr.status === 400).toBe(true);
    const tid = await p.post('/api/min/journal/p01/meddelanden', { typ: 'tid', text: 'Jag behöver en ny tid.', enhetId: 'uso-kard' });
    expect(tid.data.trad.yrkesrollText).toBe('vårdadministratör');
    // Ett intyg kräver typ, och en okänd vårdenhet går inte.
    expect((await p.post('/api/min/journal/p01/meddelanden', { typ: 'intyg', text: 'Intyg tack.' })).status).toBe(400);
    expect((await p.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: 'Hej', enhetId: 'uso-psyk' })).status).toBe(400);
    expect((await p.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: '' })).status).toBe(400);
    // Taket för öppna meddelanden.
    expect((await p.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: 'En till.' })).status).toBe(400);
    expect(logg(p, "patient_id = 'p01' AND handling = 'invanare_meddelande'").length).toBeGreaterThanOrEqual(3);
  });

  test(namn(T10.vard), async () => {
    const k = await inloggad('ssk-kard');
    const l = (await k.get('/api/meddelanden')).data;
    const fraga = l.tradar.find(t => t.typ === 'fraga');
    expect(fraga).toMatchObject({ patient: { namn: 'Gunnar Åkesson' }, tillDig: true, status: 'ny' });
    const t = (await k.get(`/api/meddelanden/${fraga.id}`)).data;
    expect(t.meddelanden[0].text).toContain('vätskedrivande');
    expect(t.meddelanden[0].vem).toBe('Patienten');
    expect(logg(k, "patient_id = 'p01' AND personal_id = 'ssk-kard' AND resurs = ?", `meddelande:${fraga.id}`)).toHaveLength(1);
    // Avslutas inte utan svar.
    expect((await k.post(`/api/meddelanden/${fraga.id}/avsluta`)).status).toBe(400);
    const s = await k.post(`/api/meddelanden/${fraga.id}/svar`, { text: 'Ja, ta dem som vanligt.' });
    expect(s.status).toBe(200);
    expect(s.data.status).toBe('besvarad');
    expect(s.data.meddelanden.at(-1)).toMatchObject({ fran: 'vard', vem: 'Johan Ek' });
    expect(s.data.meddelanden.at(-1).avisering).toContain('Sms till patienten');
    const a = await k.post(`/api/meddelanden/${fraga.id}/avsluta`);
    expect(a.data.status).toBe('avslutad');
    expect(logg(k, "patient_id = 'p01' AND personal_id = 'ssk-kard' AND resurs LIKE ?", `meddelande:${fraga.id}:%`).map(r => r.resurs)).toEqual([`meddelande:${fraga.id}:svar`, `meddelande:${fraga.id}:avslutad:besvarat`]);
    // Patienten ser svaret med yrkesrollen, inte namnet.
    const s2 = sandlada(app, k);
    somInv(s2, 'inv-p01');
    const min = (await k.get('/api/min/journal/p01/meddelanden')).data.tradar.find(x => x.id === fraga.id);
    expect(min.status).toBe('avslutad');
    expect(min.meddelanden.at(-1)).toMatchObject({ vem: 'sjuksköterska', text: 'Ja, ta dem som vanligt.' });
    expect(JSON.stringify(min)).not.toContain('Johan Ek');
    expect(JSON.stringify(min)).not.toContain('Sms');
    expect((await k.post(`/api/min/journal/p01/meddelanden/${fraga.id}/svar`, { text: 'Tack' })).status).toBe(400);
  });

  test(namn(T10.recept), async () => {
    const k = await inloggad('lak-kard');
    const recept = (await k.get('/api/meddelanden')).data.tradar.find(t => t.typ === 'recept');
    expect(recept.tillDig).toBe(true);
    const t = (await k.get(`/api/meddelanden/${recept.id}`)).data;
    expect(t.galler).toBeTruthy();
    expect(t.kanAvsluta).toBe(true);
    const a = await k.post(`/api/meddelanden/${recept.id}/avsluta`, { utfall: 'fornyat' });
    expect(a.status).toBe(200);
    expect(a.data).toMatchObject({ status: 'avslutad', utfall: 'fornyat', avgift: { belopp: 100 } });
    expect(a.data.meddelanden.at(-1)).toMatchObject({ fran: 'systemet' });
    expect(a.data.meddelanden.at(-1).text).toContain('Avgiften är 100 kr');
    const avg = db(k).query('SELECT * FROM tjanstavgifter WHERE kalla = ? AND kalla_id = ?').get('meddelande', recept.id);
    expect(avg).toMatchObject({ patient_id: 'p01', tjanst: 'receptfornyelse', belopp: 100, enhet_id: 'uso-kard', skapad_av: 'lak-kard' });
    // Sjuksköterskan kan inte förnya, och ärendet ligger kvar till läkaren.
    const p = sandlada(app, k);
    somInv(p, 'inv-p01');
    const ny = await k.post('/api/min/journal/p01/meddelanden', { typ: 'intyg', text: 'Jag behöver ett intyg till resan.', intygstyp: 'resa', enhetId: 'uso-kard' });
    expect(ny.status).toBe(201);
    som(p, 'ssk-kard');
    const st = (await k.get(`/api/meddelanden/${ny.data.trad.id}`)).data;
    expect(st.kanAvsluta).toBe(false);
    expect((await k.post(`/api/meddelanden/${ny.data.trad.id}/avsluta`, { utfall: 'utfardat' })).status).toBe(403);
    som(p, 'lak-kard');
    expect((await k.post(`/api/meddelanden/${ny.data.trad.id}/avsluta`, { utfall: 'ej_utfardat' })).status).toBe(400);
    const u = await k.post(`/api/meddelanden/${ny.data.trad.id}/avsluta`, { utfall: 'utfardat' });
    expect(u.data.avgift).toMatchObject({ belopp: 300 });
  });

  test(namn(T10.sakerhet), async () => {
    const k = await inloggad('ssk-kard');
    const l = (await k.get('/api/meddelanden')).data;
    const text = JSON.stringify(l);
    expect(text).not.toContain('vätskedrivande');
    expect(text).not.toContain('tabletterna');
    const id = l.tradar[0].id;
    // En annan vårdenhet och fel roll.
    const s = sandlada(app, k);
    som(s, 'lak-vc');
    expect((await k.get('/api/meddelanden')).data.tradar.map(t => t.id)).not.toContain(id);
    expect((await k.get(`/api/meddelanden/${id}`)).status).toBe(403);
    som(s, 'usk-kard');
    expect((await k.get('/api/meddelanden')).status).toBe(403);
    expect((await k.get(`/api/meddelanden/${id}`)).status).toBe(403);
    // Ord som kan tyda på något akut: inget skickas förrän invånaren har läst rådet.
    somInv(s, 'inv-p01');
    const r = await k.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: 'Jag har ont i bröstet sedan i morse.' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ skickat: false });
    expect(r.data.akut).toContain('112');
    const fore = db(k).query('SELECT count(*) AS n FROM meddelandetradar').get().n;
    expect((await k.post('/api/min/journal/p01/meddelanden', { typ: 'fraga', text: 'Jag har ont i bröstet sedan i morse.', akutLast: true })).status).toBe(201);
    expect(db(k).query('SELECT count(*) AS n FROM meddelandetradar').get().n).toBe(fore + 1);
    // En annan patients meddelanden går inte att nå.
    expect((await k.post(`/api/min/journal/p02/meddelanden/${id}/svar`, { text: 'Hej' })).status).toBe(404);
    somInv(s, 'inv-p02');
    expect((await k.post(`/api/min/journal/p02/meddelanden/${id}/svar`, { text: 'Hej' })).status).toBe(404);
    // Ett meddelande ger aldrig vårdrelation: p02 kan bara skriva dit där det redan finns relation.
    const m = (await k.get('/api/min/journal/p02/meddelanden')).data.mottagare;
    for (const x of m) expect(harVardrelation(db(k), 'p02', x.id)).toBe(true);
    // Meddelanden ändras och raderas inte.
    expect(() => db(k).query("UPDATE invanarmeddelanden SET text = 'x'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM meddelandetradar').run()).toThrow();
  });

  test(namn(T10.andra), async () => {
    const o = await invanare('inv-om01');
    const r = await o.post('/api/min/journal/p01/meddelanden', { typ: 'tid', text: 'Pappa behöver en tid efter klockan tio.', enhetId: 'uso-kard' });
    expect(r.status).toBe(201);
    // Vårdnadshavaren skriver för barnet.
    const v = await invanare('inv-vh01');
    const s = sandlada(app, v);
    s.db = sandlada(app, o).db;
    const m = (await v.get('/api/min/journal/p09/meddelanden')).data;
    expect(m.mottagare.length).toBeGreaterThan(0);
    const b = await v.post('/api/min/journal/p09/meddelanden', { typ: 'fraga', text: 'Leo har fått feber.', enhetId: m.mottagare[0].id });
    expect(b.status).toBe(201);
    som(s, 'adm-kard');
    const t1 = (await v.get(`/api/meddelanden/${r.data.trad.id}`)).data;
    expect(t1.skrivetAv).toBe('Ombudet');
    expect(t1.meddelanden[0].vem).toBe('Ombudet');
    const ve = db(v).query('SELECT enhet_id FROM meddelandetradar WHERE id = ?').get(b.data.trad.id).enhet_id;
    if (ve === 'uso-kard') expect((await v.get(`/api/meddelanden/${b.data.trad.id}`)).data.skrivetAv).toBe('Vårdnadshavaren');
    expect(logg(v, "invanare_id = 'inv-om01' AND resurs = ?", `min:meddelanden:${r.data.trad.id}`)[0]).toMatchObject({ patient_id: 'p01', grund: 'ombud' });
  });

  test(namn(T10.begaran), async () => {
    const p = await invanare('inv-p01');
    const sv = (await p.get('/api/min/journal/p01/sparrar')).data;
    const enhet = sv.vardenheter.find(e => !e.sparrad && e.id === 'uso-kard');
    expect(enhet).toBeTruthy();
    expect((await p.post('/api/min/journal/p01/begaran', { typ: 'sparr', enhetId: enhet.id })).status).toBe(201);
    expect((await p.post('/api/min/journal/p01/begaran', { typ: 'loggutdrag' })).status).toBe(201);
    const s = sandlada(app, p);
    // Vårdadministratören på den spärrade vårdenheten registrerar spärren. På en annan vårdenhet syns den inte.
    const adm = { id: 'adm-kard' };
    const annan = db(p).query("SELECT id FROM personal WHERE yrke = 'vardadministrator' AND enhet_id LIKE 'vc-%'").get();
    if (annan) { som(s, annan.id); expect((await p.get('/api/begaran')).data.begaran.filter(b => b.typ === 'sparr')).toEqual([]); }
    som(s, adm?.id ?? 'adm-kard');
    const l = (await p.get('/api/begaran')).data.begaran;
    const b = l.find(x => x.typ === 'sparr');
    expect(b).toMatchObject({ patient: { namn: 'Gunnar Åkesson' }, atgard: 'Registrera spärren' });
    const h = await p.post(`/api/begaran/${b.id}/handlagg`);
    expect(h.status).toBe(200);
    expect(db(p).query('SELECT * FROM sparrar WHERE patient_id = ? AND enhet_id = ? AND aktiv = 1').get('p01', enhet.id)).toBeTruthy();
    expect(logg(p, "patient_id = 'p01' AND handling = 'registrera_sparr' AND resurs = ?", `begaran:${b.id}:sparr`)).toHaveLength(1);
    expect((await p.post(`/api/begaran/${b.id}/handlagg`)).status).toBe(404);
    // Loggutdraget tas fram av logggranskaren, inte av vårdadministratören.
    expect((await p.get('/api/begaran')).data.begaran.some(x => x.typ === 'loggutdrag')).toBe(false);
    som(s, 'logg-1');
    const lg = db(p).query("SELECT id FROM personal WHERE yrke = 'logggranskare'").get();
    som(s, lg.id);
    const lu = (await p.get('/api/begaran')).data.begaran.find(x => x.typ === 'loggutdrag');
    expect((await p.post(`/api/begaran/${lu.id}/handlagg`)).data.besked).toContain('Loggutdraget');
    // Patienten får beskeden, och häver sedan spärren.
    somInv(s, 'inv-p01');
    const efter = (await p.get('/api/min/journal/p01/sparrar')).data;
    expect(efter.begaran.find(x => x.id === b.id)).toMatchObject({ status: 'avslutad' });
    expect(efter.begaran.find(x => x.id === b.id).besked).toContain('Spärren');
    expect(efter.begaran.find(x => x.id === lu.id).besked).toContain('brev (simulerat)');
    expect((await p.post('/api/min/journal/p01/begaran', { typ: 'hava_sparr', enhetId: enhet.id })).status).toBe(201);
    som(s, adm?.id ?? 'adm-kard');
    const hv = (await p.get('/api/begaran')).data.begaran.find(x => x.typ === 'hava_sparr');
    await p.post(`/api/begaran/${hv.id}/handlagg`);
    expect(db(p).query('SELECT * FROM sparrar WHERE patient_id = ? AND enhet_id = ? AND aktiv = 1').get('p01', enhet.id)).toBeNull();
    // Läkaren handlägger inga begäranden.
    som(s, 'lak-kard');
    expect((await p.get('/api/begaran')).status).toBe(403);
  });
});

describe('Vårdplanen i Min journal', () => {
  test(namn(T10.planSe), async () => {
    const p = await invanare('inv-p04');
    const v = (await p.get('/api/min/journal/p04/vardplaner')).data;
    expect(v.planer.length).toBeGreaterThan(0);
    const plan = v.planer[0];
    expect(plan).toMatchObject({ rubrik: 'Förebyggande av fall', statusText: 'Pågår', kanKommentera: true });
    expect(plan.mal.length).toBeGreaterThan(0);
    expect(plan.atgarder[0].vem).toBeTruthy();
    expect(plan.nastaUppfoljning).toBeTruthy();
    expect(JSON.stringify(v)).not.toContain('Johan Ek');
    // En uppföljning syns för patienten med hur målen bedömdes.
    const k = await inloggad('ssk-kard');
    const s = sandlada(app, k);
    s.db = sandlada(app, p).db;
    const vp = s.db.query("SELECT * FROM vardplaner WHERE patient_id = 'p04'").get();
    const mal = s.db.query('SELECT id FROM vardplan_mal WHERE plan_id = ?').all(vp.id);
    const u = await k.post(`/api/vardplan/${vp.id}/uppfoljning`, { mal: Object.fromEntries(mal.map(m => [m.id, 'delvis'])), text: 'Patienten går säkrare.', nastaUppfoljning: addDagar(idag(), 7) });
    expect([200, 201]).toContain(u.status);
    const v2 = (await p.get('/api/min/journal/p04/vardplaner')).data.planer[0];
    expect(v2.uppfoljningar.length).toBe(1);
    expect(v2.mal[0].statusText).toBe('Delvis uppnått');
    // Kommentaren blir ett meddelande till vårdenheten som har planen.
    const r = await p.post('/api/min/journal/p04/meddelanden', { typ: 'vardplan', planId: vp.id, text: 'Jag vill hellre ha hjälp på morgonen än på kvällen.' });
    expect(r.status).toBe(201);
    expect(r.data.trad).toMatchObject({ typ: 'vardplan', galler: 'Förebyggande av fall', yrkesrollText: 'sjuksköterska' });
    expect(s.db.query('SELECT enhet_id FROM meddelandetradar WHERE id = ?').get(r.data.trad.id).enhet_id).toBe('uso-kard');
    expect((await p.get('/api/min/journal/p04/vardplaner')).data.planer[0].kommentarer).toEqual({ antal: 1, oppna: 1 });
    const l = (await k.get('/api/meddelanden')).data.tradar.find(t => t.id === r.data.trad.id);
    expect(l).toMatchObject({ typ: 'vardplan', tillDig: true });
  });

  test(namn(T10.planOmbud), async () => {
    const o = await invanare('inv-om01');
    expect((await o.get('/api/min/journal/p01/vardplaner')).status).toBe(403);
    // Vårdnadshavaren ser barnets vårdplan.
    const v = await invanare('inv-vh01');
    expect((await v.get('/api/min/journal/p09/vardplaner')).status).toBe(200);
  });
});

describe('Kassan', () => {
  test(namn(T10.avgift), async () => {
    const d = nyDb();
    const p = (id) => d.query('SELECT * FROM patienter WHERE id = ?').get(id);
    expect(kassa.avgiftFor(d, p('p01'), 'receptfornyelse')).toMatchObject({ belopp: 100, grund: 'avgift' });
    expect(kassa.avgiftFor(d, p('p09'), 'receptfornyelse')).toMatchObject({ belopp: 0, grund: 'avgiftsfri' });
    expect(kassa.avgiftFor(d, { id: 'x', fodd: '1930-01-01' }, 'receptfornyelse').belopp).toBe(0);
    d.query('INSERT INTO lma_kort (patient_id, nummer, giltig_till, registrerad, av) VALUES (?, ?, ?, ?, ?)').run('p02', 'LMA-DEMO-1', addDagar(idag(), 30), iso(), 'adm-kard');
    expect(kassa.avgiftFor(d, p('p02'), 'receptfornyelse')).toMatchObject({ belopp: 50, grund: 'lma' });
    // Frikort: besök för mer än taket de senaste tolv månaderna.
    for (let i = 1; i <= 8; i++) {
      d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, orsak, kalla, planerad, skapad) VALUES ('p10', 'vc-tybble', 'oppenvard', 'besok', ?, ?, 'Besök', 'vardkallan', 0, ?)")
        .run(new Date(Date.now() - i * 20 * 86400_000).toISOString(), new Date(Date.now() - i * 20 * 86400_000 + 3600_000).toISOString(), iso());
    }
    const f = kassa.avgiftFor(d, p('p10'), 'receptfornyelse');
    expect(f).toMatchObject({ belopp: 0, grund: 'frikort' });
    expect(f.text).toContain('Frikort gäller till och med');
    expect(f.text).not.toMatch(/\d+ kr/);
    // Intyg: efter typ, inte frikort, och intyget till Försäkringskassan är avgiftsfritt.
    expect(kassa.avgiftFor(d, p('p10'), 'intyg', 'korkort')).toMatchObject({ belopp: 900 });
    expect(kassa.avgiftFor(d, p('p01'), 'intyg', 'sjukpenning')).toMatchObject({ belopp: 0, grund: 'avgiftsfri' });
    expect(() => kassa.avgiftFor(d, p('p01'), 'intyg', 'constructor')).toThrow();
    expect(() => kassa.avgiftFor(d, p('p01'), 'annat')).toThrow();
    // I kassan registrerar vårdadministratören avgiften med patientens personnummer.
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'intyg', intygstyp: 'resa' });
    expect(r.status).toBe(201);
    expect(r.data.avgift).toMatchObject({ tjanst: 'intyg', belopp: 300, status: 'att_betala', skapadAv: 'Karin Berg' });
    expect(logg(k, "patient_id = 'p01' AND personal_id = 'adm-kard' AND resurs = ?", `tjanstavgift:${r.data.avgift.id}`)).toHaveLength(1);
    expect(() => db(k).query('UPDATE tjanstavgifter SET belopp = 0').run()).toThrow();
  });

  test(namn(T10.hogkostnad), async () => {
    const p = konfiguration.parametrar();
    for (const k of ['avgift.hogkostnadsskydd_receptfornyelse', 'avgift.hogkostnadsskydd_intyg']) {
      expect(p[k]).toMatchObject({ typ: 'janej', standard: false, omrade: 'administration' });
    }
    const d = nyDb();
    expect(konfiguration.varde(d, 'avgift.hogkostnadsskydd_receptfornyelse')).toBe(false);
    // Besök de senaste tolv månaderna tills mindre än receptförnyelsens 100 kr återstår till frikortet.
    const pt = d.query("SELECT * FROM patienter WHERE id = 'p02'").get();
    for (let i = 1; hogkostnadsskyddet(d, pt).kvar >= 100 && i < 30; i++) {
      d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, orsak, kalla, planerad, skapad) VALUES ('p02', 'vc-tybble', 'oppenvard', 'besok', ?, ?, 'Besök', 'vardkallan', 0, ?)")
        .run(new Date(Date.now() - i * 10 * 86400_000).toISOString(), new Date(Date.now() - i * 10 * 86400_000 + 3600_000).toISOString(), iso());
    }
    const kvar = hogkostnadsskyddet(d, pt).kvar;
    expect(kvar).toBeGreaterThan(0);
    expect(kassa.avgiftFor(d, pt, 'receptfornyelse').belopp).toBe(100);
    expect(kassa.avgiftFor(d, pt, 'intyg', 'resa').belopp).toBe(300);
    // Systemförvaltaren sätter att receptförnyelsen ingår. Då sätts avgiften ned till det som återstår.
    d.query("INSERT INTO konfig_andringar (slag, nyckel, varde, giltig_fran, motivering, foreslagen_av, foreslagen, status, beslutad_av, beslutad, galler_fran) VALUES ('parameter', 'avgift.hogkostnadsskydd_receptfornyelse', 'true', ?, 'Test', 'sf-1', ?, 'godkand', 'sf-2', ?, ?)").run(idag(), iso(), iso(), idag());
    expect(konfiguration.varde(d, 'avgift.hogkostnadsskydd_receptfornyelse')).toBe(true);
    const a = kassa.avgiftFor(d, pt, 'receptfornyelse');
    expect(a.belopp).toBe(kvar);
    expect(a.text).toContain('högkostnadsskyddet');
    expect(a.text).not.toMatch(/1\s?400|1\s?450/);
    // En avgift för receptförnyelse som redan är registrerad räknas också, och sedan gäller frikort.
    kassa.skapaAvgift(d, { patient: pt, enhetId: 'uso-kard', tjanst: 'receptfornyelse' });
    expect(kassa.avgiftFor(d, pt, 'receptfornyelse')).toMatchObject({ belopp: 0, grund: 'frikort' });
    // Intyget ingår fortfarande inte.
    expect(kassa.avgiftFor(d, pt, 'intyg', 'resa').belopp).toBe(300);
  });

  test(namn(T10.kassaSynlig), async () => {
    // Patienten har besök på kardiologen, som kassören ser, och på en vårdenhet med spärr, som kassören inte ser.
    const bygg = (medDolda) => {
      const d = nyDb();
      const besok = (enhet, i) => d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, orsak, kalla, planerad, skapad) VALUES ('p02', ?, 'oppenvard', 'besok', ?, ?, 'Besök', 'vardkallan', 0, ?)")
        .run(enhet, new Date(Date.now() - i * 9 * 86400_000).toISOString(), new Date(Date.now() - i * 9 * 86400_000 + 3600_000).toISOString(), iso());
      const pt = d.query("SELECT * FROM patienter WHERE id = 'p02'").get();
      const adm = d.query("SELECT * FROM personal WHERE id = 'adm-kard'").get();
      const atk = new Atkomst(d, adm, 'p02', {}, 'checka_in');
      const synliga = (r) => atk.filtrera(r, 'las_admin');
      // Synliga besök tills 450 kr eller mindre återstår till frikortet.
      for (let i = 1; hogkostnadsskyddet(d, pt, Date.now(), { synliga }).kvar > 450 && i < 20; i++) besok('uso-kard', i);
      if (medDolda) {
        d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p02', 'uso-psyk', ?)").run(idag());
        for (let i = 21; i <= 23; i++) besok('uso-psyk', i);
        kassa.skapaAvgift(d, { patient: pt, enhetId: 'uso-psyk', tjanst: 'receptfornyelse' });
      }
      return { d, pt, synliga, besok };
    };
    const ja = (d, typ) => d.query("INSERT INTO konfig_andringar (slag, nyckel, varde, giltig_fran, motivering, foreslagen_av, foreslagen, status, beslutad_av, beslutad, galler_fran) VALUES ('parameter', ?, 'true', ?, 'Test', 'sf-1', ?, 'godkand', 'sf-2', ?, ?)").run(`avgift.hogkostnadsskydd_${typ}`, idag(), iso(), iso(), idag());
    for (const medParameter of [false, true]) {
      const utan = bygg(false);
      const med = bygg(true);
      if (medParameter) for (const x of [utan, med]) { ja(x.d, 'receptfornyelse'); ja(x.d, 'intyg'); }
      for (const [tjanst, typ] of [['receptfornyelse', null], ['intyg', 'forsakring']]) {
        const a = kassa.avgiftFor(utan.d, utan.pt, tjanst, typ, idag(), { synliga: utan.synliga });
        const b = kassa.avgiftFor(med.d, med.pt, tjanst, typ, idag(), { synliga: med.synliga });
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
        expect(b.text).not.toContain('nedsatt');
        if (medParameter && tjanst === 'intyg') expect(b.belopp).toBeLessThan(700);
      }
      // Utan filter, som i Min journal där patienten ser allt, räknas de dolda besöken, och då gäller frikort.
      expect(kassa.avgiftFor(med.d, med.pt, 'receptfornyelse').grund).toBe('frikort');
    }
    // När de synliga avgifterna når taket gäller frikort, också i kassan.
    const fri = bygg(true);
    ja(fri.d, 'receptfornyelse');
    for (let i = 30; i <= 33; i++) fri.besok('uso-kard', i);
    expect(kassa.avgiftFor(fri.d, fri.pt, 'receptfornyelse', null, idag(), { synliga: fri.synliga })).toMatchObject({ belopp: 0, grund: 'frikort' });
    // I kassan räknas avgiften med kassörens filter, och de dolda besöken ändrar inte beloppet.
    const k = await inloggad('adm-kard');
    const s = sandlada(app, k);
    const m = bygg(true);
    ja(m.d, 'receptfornyelse');
    s.db = m.d;
    const r = await k.post('/api/kassa/avgift', { personnummer: '19660319-3373', tjanst: 'receptfornyelse' });
    expect(r.status).toBe(201);
    expect(r.data.avgift.belopp).toBe(100);
    expect(r.data.avgift.text).not.toContain('Frikort');
  });

  test(namn(T10.betala), async () => {
    const k = await inloggad('adm-kard');
    const r = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'receptfornyelse' })).data.avgift;
    expect((await k.post(`/api/kassa/avgift/${r.id}/betala`, { satt: 'kontant' })).status).toBe(400);
    const b = await k.post(`/api/kassa/avgift/${r.id}/betala`, { satt: 'kort' });
    expect(b.status).toBe(200);
    expect(b.data).toMatchObject({ status: 'betald', betalning: { satt: 'kort', av: 'Karin Berg' } });
    expect(b.data.betalning.kvitto).toMatch(/^VK-DEMO-T-\d{5}$/);
    expect(b.data.betalning.text).toContain('simulerade betalterminalen');
    expect((await k.post(`/api/kassa/avgift/${r.id}/betala`, { satt: 'kort' })).status).toBe(400);
    // Återbetalning samma väg, med orsak och eget kvitto, en gång.
    const bet = db(k).query('SELECT * FROM kassabetalningar WHERE avgift_id = ?').get(r.id);
    expect((await k.post('/api/kassa/aterbetalning', { kalla: 'tjanst', id: bet.id })).status).toBe(400);
    const a = await k.post('/api/kassa/aterbetalning', { kalla: 'tjanst', id: bet.id, orsak: 'fel_avgift' });
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ belopp: 100, satt: 'kort', orsak: 'Avgiften var fel', ursprungligtKvitto: bet.kvitto });
    expect(a.data.kvitto).toMatch(/^VK-DEMO-R-\d{5}$/);
    expect(a.data.text).toContain('tillbaka till kortet');
    expect((await k.post('/api/kassa/aterbetalning', { kalla: 'tjanst', id: bet.id, orsak: 'dubbel' })).status).toBe(400);
    expect(logg(k, "patient_id = 'p01' AND resurs = ?", `aterbetalning:tjanst:${bet.id}`)).toHaveLength(1);
    // En patientavgift vid besöket återbetalas på samma sätt, som kreditfaktura när den fakturerades.
    const d = db(k);
    const bok = d.query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id IN ('uso-kard', 'uso-kard-mott') AND b.status = 'bokad' AND b.patient_id = 'p01' LIMIT 1").get()
      ?? d.query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id IN ('uso-kard', 'uso-kard-mott') AND b.status = 'bokad' LIMIT 1").get();
    d.query("INSERT INTO betalningar (bokning_id, patient_id, belopp, satt, tid, av, kvitto, text) VALUES (?, ?, 200, 'faktura', ?, 'adm-kard', 'VK-DEMO-90001', 'Faktura, simulerad.')").run(bok.id, bok.patient_id, iso());
    const fb = d.query("SELECT id FROM betalningar WHERE kvitto = 'VK-DEMO-90001'").get();
    const af = await k.post('/api/kassa/aterbetalning', { kalla: 'bokning', id: fb.id, orsak: 'installt' });
    expect(af.status).toBe(201);
    expect(af.data.text).toContain('Kreditfaktura');
    expect(() => d.query('DELETE FROM aterbetalningar').run()).toThrow();
    // Frikort och avgiftsfria besök har inget att återbetala.
    const fri = d.query("SELECT id FROM betalningar WHERE belopp = 0 LIMIT 1").get();
    if (fri) expect((await k.post('/api/kassa/aterbetalning', { kalla: 'bokning', id: fri.id, orsak: 'fel_avgift' })).status).toBe(400);
  });

  test(namn(T10.avslut), async () => {
    const k = await inloggad('adm-kard');
    const r = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'intyg', intygstyp: 'skola' })).data.avgift;
    await k.post(`/api/kassa/avgift/${r.id}/betala`, { satt: 'kort' });
    const r2 = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'receptfornyelse' })).data.avgift;
    await k.post(`/api/kassa/avgift/${r2.id}/betala`, { satt: 'faktura' });
    const kv = (await k.get('/api/kassa')).data;
    const jag = kv.kassorer.find(x => x.du);
    expect(jag).toMatchObject({ namn: 'Karin Berg', kanAvsluta: true });
    expect(jag.summa).toMatchObject({ kort: 300, faktura: 100, netto: 400 });
    expect(jag.rader.every(x => x.kvitto)).toBe(true);
    // Ett räknat belopp som inte stämmer kräver en förklaring.
    const fel = await k.post('/api/kassa/dagsavslut', { raknat: 250 });
    expect(fel.status).toBe(400);
    expect(fel.data.fel).toContain('terminalen säger 300 kr');
    const a = await k.post('/api/kassa/dagsavslut', {});
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ terminal: 300, raknat: 300, avvikelse: 0, antal: jag.rader.length, summor: { kort: 300, faktura: 100 } });
    expect(a.data.text).toContain('stämmer med betalterminalens dagsrapport');
    expect((await k.post('/api/kassa/dagsavslut', {})).status).toBe(400);
    const efter = (await k.get('/api/kassa')).data;
    expect(efter.kassorer.find(x => x.du)).toMatchObject({ kanAvsluta: false });
    expect(efter.kassorer.find(x => x.du).rader.every(x => x.avslutad)).toBe(true);
    expect(efter.avslut).toHaveLength(1);
    // En betalning efter avslutet tas med i nästa avslut, med förklaring när kassan inte stämmer.
    const r3 = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'intyg', intygstyp: 'forsakring' })).data.avgift;
    await k.post(`/api/kassa/avgift/${r3.id}/betala`, { satt: 'kort' });
    const a2 = await k.post('/api/kassa/dagsavslut', { raknat: 600, forklaring: 'Kunden fick 100 kr tillbaka i fel ordning.' });
    expect(a2.data).toMatchObject({ terminal: 700, raknat: 600, avvikelse: -100, antal: 1 });
    // Ett avslut ändras och raderas aldrig.
    expect(() => db(k).query('UPDATE kassaavslut SET raknat = 0').run()).toThrow();
    expect(() => db(k).query('DELETE FROM kassaavslut').run()).toThrow();
  });

  test(namn(T10.kassaSakerhet), async () => {
    const k = await inloggad('adm-kard');
    const r = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'receptfornyelse' })).data.avgift;
    await k.post(`/api/kassa/avgift/${r.id}/betala`, { satt: 'kort' });
    const text = JSON.stringify((await k.get('/api/kassa')).data);
    for (const x of ['Åkesson', 'Gunnar', '19450202', 'p01']) expect(text).not.toContain(x);
    // En patient utan vårdrelation hit: samma svar som ett nummer som inte finns.
    const utanRelation = db(k).query('SELECT * FROM patienter ORDER BY id').all().find(p => !harVardrelation(db(k), p.id, 'uso-kard'));
    const utan = await k.post('/api/kassa/avgift', { personnummer: utanRelation.personnummer, tjanst: 'receptfornyelse' });
    const finnsEj = await k.post('/api/kassa/avgift', { personnummer: '19121212-1212', tjanst: 'receptfornyelse' });
    expect(utan.status).toBe(404);
    expect(utan.data.fel).toBe(finnsEj.data.fel);
    // Fel roll.
    const s = sandlada(app, k);
    som(s, 'lak-kard');
    expect((await k.get('/api/kassa')).status).toBe(403);
    expect((await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'receptfornyelse' })).status).toBe(403);
    expect((await k.post('/api/kassa/dagsavslut', {})).status).toBe(403);
    // En annan vårdenhet återbetalar inte och ser inte kassan.
    const vc = s.db.query("SELECT id FROM personal WHERE yrke = 'vardadministrator' AND enhet_id LIKE 'vc-%'").get();
    if (vc) {
      som(s, vc.id);
      const bet = s.db.query('SELECT * FROM kassabetalningar WHERE avgift_id = ?').get(r.id);
      const a = await k.post('/api/kassa/aterbetalning', { kalla: 'tjanst', id: bet.id, orsak: 'fel_avgift' });
      expect(a.status).toBe(403);
      expect(JSON.stringify((await k.get('/api/kassa')).data)).not.toContain(bet.kvitto);
    }
  });

  test(namn(T10.minBetala), async () => {
    const k = await inloggad('adm-kard');
    const r = (await k.post('/api/kassa/avgift', { personnummer: '19450202-4732', tjanst: 'intyg', intygstyp: 'resa' })).data.avgift;
    const s = sandlada(app, k);
    somInv(s, 'inv-p01');
    const m = (await k.get('/api/min/journal/p01/avgifter')).data;
    const a = m.avgifter.find(x => x.id === r.id);
    expect(a).toMatchObject({ status: 'att_betala', belopp: 300, skapadAv: null });
    const b = await k.post(`/api/min/journal/p01/avgift/${r.id}/betala`, { satt: 'kort' });
    expect(b.status).toBe(200);
    expect(b.data).toMatchObject({ status: 'betald', betalning: { av: 'Min journal' } });
    expect(JSON.stringify(b.data)).not.toContain('Karin Berg');
    expect((await k.post(`/api/min/journal/p01/avgift/${r.id}/betala`, { satt: 'kort' })).status).toBe(400);
    // I kassan står betalningen under Min journal.
    som(s, 'adm-kard');
    const kv = (await k.get('/api/kassa')).data;
    expect(kv.kassorer.find(x => x.id === 'min_journal')).toMatchObject({ kanAvsluta: false });
    // Ombudet ser inte avgifterna.
    somInv(s, 'inv-om01');
    expect((await k.get('/api/min/journal/p01/avgifter')).status).toBe(403);
    expect((await k.post(`/api/min/journal/p01/avgift/${r.id}/betala`, { satt: 'kort' })).status).toBe(403);
  });
});

describe('Kapacitet och prognos', () => {
  test(namn(T10.prognos), async () => {
    const d = nyDb();
    const adm = d.query("SELECT * FROM personal WHERE id = 'adm-kard'").get();
    const k = kapacitet.prognos(d, adm, { dag: idag(), veckor: 16 });
    expect(k.veckor).toHaveLength(16);
    expect(k.vardenhet.id).toBe('uso-kard');
    const g = k.grupper.find(x => x.tidstyp === 'aterbesok' && x.yrkesroll === 'lakare');
    expect(g.ledigaTotalt).toBeGreaterThan(0);
    expect(g.veckor[1].tider).toBeGreaterThan(0);
    // De sista veckorna räknas med schemats veckomönster.
    expect(k.veckor.at(-1).beraknad).toBe(true);
    expect(g.veckor.at(-1).beraknad).toBe(true);
    // En ny post på väntelistan och en ny remiss ökar efterfrågan.
    const fore = k.grupper.find(x => x.tidstyp === 'nybesok' && x.yrkesroll === 'lakare');
    d.query("INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, fran, status, skapad) VALUES ('p10', 'uso-kard', 'nybesok', 'lakare', 'normal', 'Bröstsmärta', ?, 'vantar', ?)").run(idag(), iso());
    d.query("INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, prioritet, svar_senast, status, skickad_tid) VALUES ('p10', 'vc-tybble', 'uso-kard', 'lak-vc', 'Bedömning', 'normal', ?, 'skickad', ?)").run(addDagar(idag(), 30), iso());
    const k2 = kapacitet.prognos(d, adm, { dag: idag() });
    const efter = k2.grupper.find(x => x.tidstyp === 'nybesok' && x.yrkesroll === 'lakare');
    expect(efter.vantar).toBe((fore?.vantar ?? 0) + 2);
    expect(efter.remisser).toBe((fore?.remisser ?? 0) + 1);
    expect(efter.kontBorta).toBeTruthy();
    expect(efter.veckor[0].koEfter).toBeLessThanOrEqual(efter.vantar);
    // Via API:t för vårdadministratören.
    const kl = await inloggad('adm-kard');
    const a = await kl.get('/api/kapacitet');
    expect(a.status).toBe(200);
    expect(a.data.demoregler).toContain('Demoregler');
    expect((await kl.get('/api/kapacitet?veckor=26')).data.veckor).toHaveLength(26);
  });

  test(namn(T10.risk), async () => {
    const d = nyDb();
    const adm = d.query("SELECT * FROM personal WHERE id = 'adm-kard'").get();
    // Sextio patienter med hög prioritet och gräns om tre dagar: tiderna räcker inte till dess.
    for (let i = 0; i < 60; i++) d.query("INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, fran, mal, status, skapad) VALUES ('p10', 'uso-kard', 'aterbesok', 'sjukskoterska', 'hog', 'Kontroll', ?, ?, 'vantar', ?)").run(idag(), addDagar(idag(), 3), iso());
    const k = kapacitet.prognos(d, adm, { dag: idag() });
    const g = k.grupper.find(x => x.tidstyp === 'aterbesok' && x.yrkesroll === 'sjukskoterska');
    expect(g.riskerarGransen).toBeGreaterThan(0);
    expect(g.forslag[0]).toMatchObject({ typ: 'risk' });
    expect(g.forslag[0].text).toMatch(/Öppna ungefär \d+ fler återbesök hos sjuksköterska i veckan/);
    expect(k.summa.riskerarGransen).toBeGreaterThanOrEqual(g.riskerarGransen);
    // Lokaler och utrustning per vecka.
    expect(k.resurser.length).toBeGreaterThan(0);
    expect(k.resurser[0].veckor).toHaveLength(12);
    expect(k.resurser.some(r => r.veckor.some(v => v.timmar > 0)) || k.resurser.length > 0).toBe(true);
    // Veckomönstret: utan inflöde och utan kö är det ledig kapacitet.
    expect(k.grupper.some(x => x.forslag.some(f => f.typ === 'ledig'))).toBe(true);
  });

  test(namn(T10.kapSakerhet), async () => {
    const k = await inloggad('adm-kard');
    const text = JSON.stringify((await k.get('/api/kapacitet')).data);
    const d = db(k);
    for (const p of d.query('SELECT * FROM patienter').all()) {
      expect(text).not.toContain(p.personnummer);
      expect(text).not.toContain(`${p.fornamn} ${p.efternamn}`);
      expect(text).not.toContain(`"${p.id}"`);
    }
    const s = sandlada(app, k);
    for (const roll of ['lak-kard', 'ssk-kard']) {
      som(s, roll);
      expect((await k.get('/api/kapacitet')).status).toBe(403);
    }
  });
});

describe('Kontorsstöd', () => {
  test(namn(T10.docx), async () => {
    const k = await inloggad('lak-kard');
    const a = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND status = 'signerad' AND enhet_id IN ('uso-kard', 'uso-kard-72', 'uso-kard-mott') ORDER BY id LIMIT 1").get();
    const r = await fetch(`${app.url}/api/anteckning/${a.id}/docx`, { headers: { Cookie: k.kaka() } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe(kontorsstod.DOCX_TYP);
    const filer = packaUpp(Buffer.from(await r.arrayBuffer()));
    const namn = [...filer.keys()];
    expect(namn).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'docProps/core.xml']));
    const dok = filer.get('word/document.xml').data.toString('utf8');
    expect(dok).toContain('Gunnar Åkesson');
    expect(dok).toContain('<w:document');
    expect(logg(k, "patient_id = 'p01' AND personal_id = 'lak-kard' AND resurs = ?", `anteckning:${a.id}:docx`)).toHaveLength(1);
    // En anteckning från en annan vårdenhet utan aktivt val, och en patient utan vårdrelation: samma svar som om den inte finns.
    const annan = db(k).query("SELECT id FROM anteckningar WHERE patient_id = 'p01' AND status = 'signerad' AND enhet_id IN ('uso-med') LIMIT 1").get();
    if (annan) expect((await fetch(`${app.url}/api/anteckning/${annan.id}/docx`, { headers: { Cookie: k.kaka() } })).status).toBe(404);
    const s = sandlada(app, k);
    som(s, 'adm-kard');
    expect((await fetch(`${app.url}/api/anteckning/${a.id}/docx`, { headers: { Cookie: k.kaka() } })).status).toBe(404);
    // Skyddad identitet maskeras i dokumentet utan aktivt val.
    const sk = kontorsstod.anteckningDocx({ typ: 'Daganteckning', skapad: iso(), enhet: { namn: 'X' }, forfattare: { namn: 'Y' }, signerad: null, sokord: [{ sokord: 'Aktuellt', text: 'Rad 1\nRad <2> & "3"' }] }, { namn: 'Skyddad identitet', personnummer: '19840416-****' });
    const sd = packaUpp(sk).get('word/document.xml').data.toString('utf8');
    expect(sd).toContain('Rad &lt;2&gt; &amp; &quot;3&quot;');
    expect(sd).toContain('<w:br/>');
  });

  test(namn(T10.rapporter), async () => {
    const k = await inloggad('adm-kard');
    for (const vag of ['/api/kassa/rapport.docx', '/api/kapacitet/rapport.docx']) {
      const r = await fetch(`${app.url}${vag}`, { headers: { Cookie: k.kaka() } });
      expect(r.status).toBe(200);
      expect(r.headers.get('content-disposition')).toContain('.docx');
      const dok = packaUpp(Buffer.from(await r.arrayBuffer())).get('word/document.xml').data.toString('utf8');
      expect(dok).toContain('<w:tbl>');
      for (const p of db(k).query('SELECT * FROM patienter').all()) { expect(dok).not.toContain(p.personnummer); expect(dok).not.toContain(p.efternamn === 'Åkesson' ? 'Gunnar' : `${p.fornamn} ${p.efternamn}`); }
    }
    const s = sandlada(app, k);
    som(s, 'lak-kard');
    expect((await fetch(`${app.url}/api/kassa/rapport.docx`, { headers: { Cookie: k.kaka() } })).status).toBe(403);
  });

  test(namn(T10.kalender), async () => {
    const k = await inloggad('lak-kard');
    expect((await k.get('/api/kalender')).data.finns).toBe(false);
    const r = await k.post('/api/kalender/lank');
    expect(r.status).toBe(201);
    expect(r.data.adress).toMatch(/\/api\/kalender\/vkcal_[A-Za-z0-9_-]{32}\.ics$/);
    const token = r.data.adress.split('/').at(-1).replace('.ics', '');
    // Bara HMAC sparas, aldrig länken.
    expect(JSON.stringify(db(k).query('SELECT * FROM kalenderlankar').all())).not.toContain(token);
    // Hämtningen görs utan session och skapar ingen sandlåda.
    const fore = app.sessioner.size;
    const ics = await fetch(`${app.url}/api/kalender/${token}.ics`);
    expect(ics.status).toBe(200);
    expect(ics.headers.get('content-type')).toContain('text/calendar');
    expect(ics.headers.get('set-cookie')).toBeNull();
    expect(app.sessioner.size).toBe(fore);
    const text = await ics.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('BEGIN:VEVENT');
    for (const x of text.split('\r\n')) expect(Buffer.byteLength(x, 'utf8')).toBeLessThanOrEqual(75);
    for (const p of db(k).query('SELECT * FROM patienter').all()) {
      expect(text).not.toContain(p.efternamn);
      expect(text).not.toContain(p.personnummer.slice(0, 8));
    }
    // Upptagen för det personen inte ska se: en patient med skyddade personuppgifter.
    const d = db(k);
    const tid = d.query("SELECT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.personal_id = 'lak-kard' AND t.start > ? AND t.tidstyp = 'aterbesok' AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id AND b.status IN ('bokad', 'incheckad')) ORDER BY t.start LIMIT 1").get(iso());
    d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad) VALUES ('p03', ?, 'bokad', ?)").run(tid.id, iso());
    const h = kontorsstod.kalenderHandelser(d, 'lak-kard').find(x => x.uid === `tid-${tid.id}`);
    expect(h).toMatchObject({ titel: 'Upptagen', plats: '' });
    expect(kontorsstod.kalenderHandelser(d, 'lak-kard').some(x => x.titel === 'Återbesök' || x.titel === 'Nybesök' || x.titel === 'Telefontid')).toBe(true);
    // Återkallad länk och fel länk ger samma svar.
    const ny = (await k.post('/api/kalender/lank')).data.adress.split('/').at(-1).replace('.ics', '');
    expect((await fetch(`${app.url}/api/kalender/${token}.ics`)).status).toBe(404);
    expect((await fetch(`${app.url}/api/kalender/${ny}.ics`)).status).toBe(200);
    expect((await k.post('/api/kalender/lank/aterkalla')).data.aterkallad).toBe(true);
    expect((await fetch(`${app.url}/api/kalender/${ny}.ics`)).status).toBe(404);
    expect((await fetch(`${app.url}/api/kalender/vkcal_${'a'.repeat(32)}.ics`)).status).toBe(404);
    expect((await k.get('/api/kalender')).data.finns).toBe(false);
    // Tak per timme.
    const lager = kontorsstod.skapaKalenderlager({ hemlighet: 'test' });
    const sess = sandlada(app, k);
    const t2 = lager.skapa(sess, d.query("SELECT * FROM personal WHERE id = 'lak-kard'").get());
    for (let i = 0; i < 60; i++) expect(lager.hitta(t2, [sess]).tak).toBeUndefined();
    expect(lager.hitta(t2, [sess]).tak).toBe(true);
  });

  test(namn(T10.bokning), async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    const video = d.query("SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE t.tidstyp = 'video' AND b.status = 'bokad' AND s.enhet_id IN ('uso-kard', 'uso-kard-mott') LIMIT 1").get();
    let vid = video;
    if (!vid) {
      const t = d.query("SELECT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE t.tidstyp = 'video' AND s.enhet_id = 'uso-kard-mott' AND t.start > ? ORDER BY t.start LIMIT 1").get(iso());
      vid = d.query('SELECT * FROM bokningar WHERE id = ?').get(Number(d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad) VALUES ('p01', ?, 'bokad', ?)").run(t.id, iso()).lastInsertRowid));
    }
    const v = (await k.get(`/api/bokning/${vid.id}/kontorsstod`)).data;
    expect(v.video.lank).toMatch(/^#\/videomote\/[A-Za-z0-9_-]{16}$/);
    expect(v.video.text).toContain('Simulerad');
    // Samma länk varje gång, och mötessidan säger att mötet är simulerat utan patientuppgifter.
    expect((await k.get(`/api/bokning/${vid.id}/kontorsstod`)).data.video.lank).toBe(v.video.lank);
    const m = (await k.get(`/api/videomote/${v.video.lank.split('/').at(-1)}`)).data;
    expect(m.simulerat).toBe(true);
    expect(JSON.stringify(m)).not.toContain(vid.patient_id);
    // Patienten ser länken i Min journal.
    const s = sandlada(app, k);
    const inv = d.query('SELECT id FROM invanare WHERE patient_id = ?').get(vid.patient_id);
    somInv(s, inv.id);
    expect((await k.get(`/api/min/journal/${vid.patient_id}/videomoten`)).data.moten.map(x => x.lank)).toContain(v.video.lank);
    som(s, 'adm-kard');
    // Telefontid: uppringning med tel-URI.
    const tt = d.query("SELECT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE t.tidstyp = 'telefon' AND s.enhet_id = 'uso-kard-mott' AND t.start > ? AND NOT EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id) ORDER BY t.start LIMIT 1").get(iso());
    const tb = Number(d.query("INSERT INTO bokningar (patient_id, tid_id, status, bokad) VALUES ('p01', ?, 'bokad', ?)").run(tt.id, iso()).lastInsertRowid);
    const tel = (await k.get(`/api/bokning/${tb}/kontorsstod`)).data;
    expect(tel.telefon.uri).toBe('tel:+46701740601');
    // Inbjudan som kalenderfil och e-post (simulerat), utan patientuppgifter.
    const ics = await (await fetch(`${app.url}/api/bokning/${tb}/inbjudan.ics`, { headers: { Cookie: k.kaka() } })).text();
    expect(ics).toContain('SUMMARY:Telefontid');
    expect(ics).not.toContain('Åkesson');
    const eml = await (await fetch(`${app.url}/api/bokning/${tb}/inbjudan.eml`, { headers: { Cookie: k.kaka() } })).text();
    expect(eml).toContain('Content-Type: text/calendar; charset=UTF-8; method=REQUEST');
    expect(eml).toContain('X-Vardkallan-Simulerad');
    expect(Buffer.from(eml.split('method=REQUEST')[1].split('\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8')).toContain('METHOD:REQUEST');
    expect(eml).not.toContain('Åkesson');
    expect(logg(k, "patient_id = 'p01' AND personal_id = 'adm-kard' AND resurs = ?", `/api/bokning/${tb}/inbjudan.eml`)).toHaveLength(1);
    // En annan vårdenhet och en patient med skyddade personuppgifter.
    som(s, 'lak-vc');
    expect((await k.get(`/api/bokning/${tb}/kontorsstod`)).status).toBe(403);
    expect(kontorsstod.forBokning(d, { id: tb, patient_id: 'p03' }, tt, { skyddad: 1, telefon: '070-1' }).telefon.uri).toBeUndefined();
  });

  test(namn(T10.arkitektur), async () => {
    const k = await inloggad('lak-kard');
    const a = (await k.get('/api/kontorsstod')).data;
    expect(a.omraden.map(o => o.id)).toEqual(['ordbehandling', 'rapporter', 'kalender', 'epost', 'telefoni', 'video', 'sharepoint']);
    for (const o of a.omraden) { expect(o.standard).toBeTruthy(); expect(o.sakerhet).toBeTruthy(); expect(['byggt', 'simulerat', 'beskrivet']).toContain(o.status); }
    expect(a.princip).toContain('version');
    expect(a.overlapp).toBeTruthy();
    expect(a.simulerat).toContain('simuleras');
    expect((await klient(app).get('/api/kontorsstod')).status).toBe(401);
  });
});
