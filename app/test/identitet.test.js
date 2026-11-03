// Identiteter (Sussa 3.1.1): typbestämning, kontrollsiffror, reservnummer, sammanslagning och behörighet.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  tolka, kontrollsiffra, demoKontroll, nyttReservnummer, samordningsnummerAv, dubbletterFor, slaSamman, hittaPaIdentitet,
  OID_ROT, OID_RESERVNUMMER, FHIR_SYSTEM, gallandeId,
} from '../src/identitet.js';
import { verifiera } from '../src/logg.js';
import { nyDb, personal, testserver, klient, sandlada } from './hjalp.js';

const IDAG = '2026-11-03';
const TESTPNR = new Set(JSON.parse(readFileSync(join(import.meta.dir, 'data', 'testpersonnummer.json'), 'utf8')));

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const loggRader = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();

describe('Identitet', () => {
  test('typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt', () => {
    for (const s of ['19650509-2962', '196505092962', '650509-2962', '6505092962', ' 19650509 2962 ', '19650509\u20132962',
      'urn:oid:1.2.752.129.2.1.3.1|196505092962', '1.2.752.129.2.1.3.1 19650509-2962', 'http://electronichealth.se/identifier/personnummer|196505092962']) {
      expect({ s, ...tolka(s, { idag: IDAG }) }).toMatchObject({ s, ok: true, typ: 'personnummer', varde: '196505092962', fodd: '1965-05-09', kon: 'kvinna', visning: '19650509-2962' });
    }
    for (const s of ['19930866-2395', '930866-2395', '1.2.752.129.2.1.3.3 199308662395']) {
      expect(tolka(s, { idag: IDAG })).toMatchObject({ ok: true, typ: 'samordningsnummer', varde: '199308662395', fodd: '1993-08-06', kon: 'man', visning: '19930866-2395' });
    }
    for (const s of ['VK19650509-0023', 'vk196505090023', 'VK 19650509 0023', `${OID_RESERVNUMMER} VK196505090023`]) {
      expect(tolka(s, { idag: IDAG })).toMatchObject({ ok: true, typ: 'reservnummer', varde: 'VK196505090023', fodd: '1965-05-09', kon: 'kvinna', visning: 'VK19650509-0023' });
    }
    for (const s of ['1.3.6.1.4.1.32473.1.2 UT-4471-0921', 'urn:oid:1.3.6.1.4.1.32473.1.2|UT-4471-0921', '1.3.6.1.4.1.32473.1.2:UT-4471-0921']) {
      expect(tolka(s, { idag: IDAG })).toMatchObject({ ok: true, typ: 'oid', varde: 'urn:oid:1.3.6.1.4.1.32473.1.2|UT-4471-0921', rot: '1.3.6.1.4.1.32473.1.2', nummer: 'UT-4471-0921' });
    }
    // Ett namn är inget nummer, och då söker systemet på namn.
    for (const s of ['Annika', 'Holmgren', 'Karl-Erik']) expect(tolka(s, { idag: IDAG })).toEqual({ ok: false, arIdentitet: false });
    // Beskrivningen är vanlig svenska.
    expect(tolka('930866-2395', { idag: IDAG }).beskrivning).toBe('Samordningsnummer (dagen i födelsedatumet är plus 60). Man, född 6 augusti 1993.');
  });

  test('tio siffror och plustecken ger rätt sekel', () => {
    expect(tolka('171211-2398', { idag: IDAG })).toMatchObject({ ok: true, varde: '201712112398' });
    expect(tolka('450202-4732', { idag: IDAG })).toMatchObject({ ok: true, varde: '194502024732' });
    // Plustecknet betyder att personen har fyllt 100 år.
    expect(tolka('100530+9818', { idag: IDAG })).toMatchObject({ ok: true, varde: '191005309818', fodd: '1910-05-30' });
    expect(tolka('100530-9818', { idag: IDAG })).toMatchObject({ ok: true, varde: '201005309818' });
    expect(tolka('19100530+9818', { idag: IDAG })).toMatchObject({ ok: false, fel: expect.stringContaining('Plustecknet används bara med tio siffror') });
  });

  test('kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska', () => {
    expect(kontrollsiffra('650509296')).toBe('2');
    expect(kontrollsiffra('19650509002')).toBe('3');
    const fel = (s) => tolka(s, { idag: IDAG });
    expect(fel('19650509-2963')).toMatchObject({ ok: false, arIdentitet: true, typ: 'personnummer', fel: expect.stringContaining('Kontrollsiffran stämmer inte') });
    expect(fel('19930866-2396')).toMatchObject({ ok: false, typ: 'samordningsnummer', fel: expect.stringContaining('samordningsnumret') });
    expect(fel('VK19650509-0024')).toMatchObject({ ok: false, typ: 'reservnummer', fel: expect.stringContaining('Kontrollsiffran i reservnumret') });
    expect(fel('19651309-2962').fel).toBe('Månaden i personnumret är 13. Den ska vara 01 till 12.');
    expect(fel('19650230-2962').fel).toContain('Den dagen finns inte i februari');
    expect(fel('19930892-2395').fel).toContain('dag 32 när 60 dras av');
    expect(fel('2096050929').fel ?? '').not.toBe('');
    expect(fel('20990509-2962').fel).toContain('ligger i framtiden');
    expect(fel('19650509-296').fel).toBe('Ett personnummer eller samordningsnummer har 10 eller 12 siffror. Numret har 11 siffror.');
    expect(fel('VK1965').fel).toContain('VK följt av födelsedatumet');
    expect(fel('1.3.6.1.4.1.32473.1.2').fel).toContain('Det saknas ett nummer efter OID:n');
    expect(fel('http://electronichealth.se/identifier/samordningsnummer|196505092962').fel).toContain('inte plus 60');
    // Inga tankstreck eller ellipser i texterna.
    for (const s of ['19650509-2963', '19651309-2962', 'VK1965', '1.2.3', '19650509-296']) expect(fel(s).fel).not.toMatch(/[\u2013\u2014\u2026]/);
  });

  test('demon tar bara testpersonnummer och samordningsnummer byggda på dem', () => {
    expect(demoKontroll(tolka('196505092962'))).toBeNull();
    // 19121212-1212 är ett giltigt personnummer men inget testpersonnummer.
    expect(tolka('19121212-1212').ok).toBe(true);
    expect(demoKontroll(tolka('19121212-1212'))).toContain('Skatteverkets testpersonnummer');
    expect(samordningsnummerAv('199308062398')).toBe('199308662395');
    expect(TESTPNR.has('199308062398')).toBe(true);
    expect(demoKontroll(tolka('199308662395'))).toBeNull();
    expect(demoKontroll(tolka(samordningsnummerAv('191212121212')))).toContain('påhittade samordningsnummer');
  });

  test('reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra', () => {
    const db = nyDb();
    // IANA:s nummer för dokumentation (RFC 5612), inte en verklig organisations OID.
    expect(OID_ROT).toBe('1.3.6.1.4.1.32473.1');
    expect(FHIR_SYSTEM.reservnummer).toBe(`urn:oid:${OID_ROT}.1`);
    const kvinna = nyttReservnummer(db, { fodd: '1965-05-09', kon: 'kvinna' });
    const man = nyttReservnummer(db, { fodd: '1965-05-09', kon: 'man' });
    // VK196505090023 finns redan i seeden (patient 17), så nästa lediga för en kvinna är löpnummer 004.
    expect(kvinna).toBe('VK196505090049');
    expect(man).toBe('VK196505090015');
    expect(tolka(kvinna)).toMatchObject({ ok: true, typ: 'reservnummer', kon: 'kvinna', fodd: '1965-05-09' });
    expect(tolka(man)).toMatchObject({ ok: true, typ: 'reservnummer', kon: 'man' });
  });

  test('seed: samordningsnummer, reservnummer, OID och en dubblett', () => {
    const db = nyDb();
    const typ = (id) => db.query('SELECT id_typ, personnummer FROM patienter WHERE id = ?').get(id);
    expect(typ('p16')).toEqual({ id_typ: 'personnummer', personnummer: '196505092962' });
    expect(TESTPNR.has('196505092962')).toBe(true);
    expect(typ('p17')).toEqual({ id_typ: 'reservnummer', personnummer: 'VK196505090023' });
    expect(typ('p18')).toEqual({ id_typ: 'samordningsnummer', personnummer: '199308662395' });
    expect(typ('p19').id_typ).toBe('oid');
    // Alla seedens identiteter går att tolka och är tillåtna i demon, och varje patient har en gällande identitet.
    for (const r of db.query('SELECT * FROM identiteter').all()) {
      const t = tolka(r.typ === 'oid' ? r.varde.replace('|', ' ') : r.varde);
      expect({ v: r.varde, ok: t.ok, typ: t.typ }).toEqual({ v: r.varde, ok: true, typ: r.typ });
      expect(demoKontroll(t)).toBeNull();
    }
    for (const { id } of db.query('SELECT id FROM patienter').all()) {
      expect(db.query("SELECT count(*) AS n FROM identiteter WHERE patient_id = ? AND status = 'gallande'").get(id).n).toBe(1);
    }
    // Patient 18 hade ett reservnummer innan samordningsnumret fanns.
    expect(db.query("SELECT typ, varde FROM identiteter WHERE patient_id = 'p18' AND status = 'tidigare'").all()).toEqual([{ typ: 'reservnummer', varde: 'VK199308060110' }]);
    expect(dubbletterFor(db, 'p17')).toEqual([{ annan: 'p16', fran: 'p17', till: 'p16', grund: 'samma_namn_fodd', forslagId: null }]);
  });

  test('systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer', () => {
    const db = nyDb();
    expect(dubbletterFor(db, 'p16').map(d => d.annan)).toEqual(['p17']);
    // Två journaler med olika personnummer är två personer.
    db.query("UPDATE patienter SET fornamn = 'Annika', efternamn = 'Holmgren', fodd = '1965-05-09', kon = 'kvinna' WHERE id = 'p02'").run();
    expect(dubbletterFor(db, 'p16').map(d => d.annan)).toEqual(['p17']);
    // Skyddad identitet föreslås aldrig på namn.
    const db2 = nyDb();
    db2.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p16'").run();
    expect(dubbletterFor(db2, 'p17')).toEqual([]);
    expect(dubbletterFor(db2, 'p16')).toEqual([]);
  });

  test('sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande', () => {
    const db = nyDb();
    const n = (t, id) => db.query(`SELECT count(*) AS n FROM ${t} WHERE patient_id = ?`).get(id).n;
    db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES ('p17', 'uso-akut', '2026-11-02')").run();
    db.query("UPDATE patienter SET skyddad = 1 WHERE id = 'p17'").run();
    const fore = Object.fromEntries(['anteckningar', 'vardkontakter', 'diagnoser', 'matvarden', 'ordinationer', 'sparrar'].map(t => [t, n(t, 'p16') + n(t, 'p17')]));
    const loggFore = db.query('SELECT count(*) AS n FROM atkomstlogg').get().n;
    const r = slaSamman(db, { fran: 'p17', till: 'p16', personal: personal(db, 'adm-kard'), grund: 'samma_namn_fodd' });
    expect(r.till).toBe('p16');
    for (const [t, antal] of Object.entries(fore)) { expect({ t, n: n(t, 'p16') }).toEqual({ t, n: antal }); expect(n(t, 'p17')).toBe(0); }
    // Signerade anteckningar flyttas men ändras inte, och triggern stoppar fortfarande en ändring av texten.
    expect(() => db.query("UPDATE anteckningar SET sokord = '[]' WHERE patient_id = 'p16' AND status = 'signerad'").run()).toThrow('En signerad anteckning kan inte ändras');
    const p16 = db.query("SELECT * FROM patienter WHERE id = 'p16'").get();
    expect(p16.skyddad).toBe(1);
    expect(db.query("SELECT sammanslagen_till FROM patienter WHERE id = 'p17'").get().sammanslagen_till).toBe('p16');
    expect(gallandeId(db, 'p17')).toBe('p16');
    // Den gamla identiteten finns kvar som tidigare identitet och går att söka på.
    expect(hittaPaIdentitet(db, tolka('VK196505090023'))).toMatchObject({ patientId: 'p16', identitet: { status: 'tidigare', orsak: 'sammanslagen', ursprung: 'p17' } });
    // Vårdrelationen följer med: kardiologen har nu relation till p16.
    expect(n('vardkontakter', 'p16')).toBeGreaterThan(2);
    // Loggen ändras inte, men sammanslagningen loggas på båda journalerna.
    const nya = db.query('SELECT * FROM atkomstlogg WHERE id > ?').all(loggFore);
    expect(nya.map(x => [x.patient_id, x.handling])).toEqual([['p17', 'sla_samman'], ['p16', 'sla_samman']]);
    expect(verifiera(db).hel).toBe(true);
    expect(() => db.query("UPDATE sammanslagningar SET grund = 'x'").run()).toThrow('En sammanslagning ändras inte');
    expect(dubbletterFor(db, 'p16')).toEqual([]);
  });

  test('API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    for (const [q, id, typ] of [['6505092962', 'p16', 'personnummer'], ['930866-2395', 'p18', 'samordningsnummer'], ['VK 19650509 0023', 'p17', 'reservnummer'],
      ['1.3.6.1.4.1.32473.1.2 UT-4471-0921', 'p19', 'oid']]) {
      const r = await k.get(`/api/sok?q=${encodeURIComponent(q)}`);
      expect(r.status).toBe(200);
      expect(r.data.map(p => [p.id, p.identitetstyp])).toEqual([[id, typ]]);
    }
    const r = await k.get(`/api/sok?q=${encodeURIComponent('VK19930806-0110')}`);
    expect(r.data.map(p => p.id)).toEqual(['p18']);
    expect(r.data[0]).toMatchObject({ personnummer: '19930866-2395', typText: 'Samordningsnummer', traffPa: { typText: 'Reservnummer', status: 'tidigare' } });
    // På namn hittas båda journalerna för Annika Holmgren, en med personnummer och en med reservnummer.
    const namn = await k.get('/api/sok?q=Holmgren');
    expect(namn.data.map(p => [p.id, p.personnummer]).sort()).toEqual([['p16', '19650509-2962'], ['p17', 'VK19650509-0023']]);
  });

  test('API: sök förklarar ett felskrivet nummer', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const r = await k.get('/api/sok?q=19650509-2963');
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('Kontrollsiffran stämmer inte');
    const t = await k.get(`/api/identitet/tolka?q=${encodeURIComponent('19121212-1212')}`);
    expect(t.data).toMatchObject({ ok: true, typ: 'personnummer', demoFel: expect.stringContaining('testpersonnummer') });
    expect((await klient(app).get('/api/identitet/tolka?q=1')).status).toBe(401);
  });

  test('API: registrera patient utan känd identitet ger reservnummer och vårdkontakt', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    const r = await k.post('/api/patienter', { kon: 'man', alder: 40 });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ skapatReservnummer: true, patient: { identitetstyp: 'reservnummer', namn: 'Okänd man', fodd: `${Number(IDAG.slice(0, 4)) - 40}-01-01` } });
    expect(tolka(r.data.patient.personnummer)).toMatchObject({ ok: true, typ: 'reservnummer', kon: 'man' });
    const id = r.data.patient.id;
    // Vårdkontakten på akuten ger vårdrelation, så journalen öppnas direkt.
    const h = await k.get(`/api/patient/${id}`);
    expect(h.status).toBe(200);
    expect(h.data).toMatchObject({ grund: 'vardrelation', identitet: { typ: 'reservnummer', typText: 'Reservnummer' } });
    expect(loggRader(k).find(x => x.handling === 'registrera_patient' && x.patient_id === id)).toBeDefined();
    // Utan kön kan systemet inte skapa reservnumret, och ett känt nummer som redan finns ger patienten.
    expect((await k.post('/api/patienter', { alder: 40 })).data).toMatchObject({ kod: 'ogiltig', falt: ['kon'] });
    const finns = await k.post('/api/patienter', { identitet: '19650509-2962', fornamn: 'A', efternamn: 'B' });
    expect(finns.status).toBe(409);
    expect(finns.data).toMatchObject({ kod: 'finns', patient: { id: 'p16' } });
    const riktigt = await k.post('/api/patienter', { identitet: '19121212-1212', fornamn: 'A', efternamn: 'B' });
    expect(riktigt.status).toBe(400);
    expect(riktigt.data.fel).toContain('testpersonnummer');
  });

  test('API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet', async () => {
    const k = klient(app);
    await k.logga('lak-akut');
    const ny = await k.post('/api/patienter', { kon: 'kvinna', fodd: '1965-06-23' });
    const id = ny.data.patient.id;
    const reserv = ny.data.patient.personnummer;
    const r = await k.post(`/api/patient/${id}/identitet`, { identitet: '196506232880' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ utfall: 'bytt', identitet: { typ: 'personnummer', visning: '19650623-2880' } });
    const i = await k.get(`/api/patient/${id}/identiteter`);
    expect(i.data.identiteter.map(x => [x.typ, x.status, x.visning])).toEqual([['personnummer', 'gallande', '19650623-2880'], ['reservnummer', 'tidigare', reserv]]);
    const s = await k.get(`/api/sok?q=${encodeURIComponent(reserv)}`);
    expect(s.data.map(p => [p.id, p.identitetstyp, p.traffPa?.status])).toEqual([[id, 'personnummer', 'tidigare']]);
    // En OID-identitet bredvid personnumret blir en extra identitet, inte den gällande.
    const oid = await k.post(`/api/patient/${id}/identitet`, { identitet: '1.3.6.1.4.1.32473.1.2 UT-0001-0001' });
    expect(oid.data.utfall).toBe('tillagd');
    expect(loggRader(k).filter(x => x.patient_id === id && x.handling === 'andra_identitet').map(x => x.resurs)).toEqual(['identitet:personnummer:bytt', 'identitet:oid:tillagd']);
  });

  test('API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const r = await k.post('/api/patient/p17/identitet', { identitet: '650509-2962' });
    expect(r.status).toBe(409);
    expect(r.data).toMatchObject({ kod: 'dubblett', annan: { id: 'p16', identitetstyp: 'personnummer' }, kanSlaSamman: false });
    const db = sandlada(app, k).db;
    expect(db.query("SELECT fran_patient_id, till_patient_id, grund, status FROM dubblettforslag").all()).toEqual([{ fran_patient_id: 'p17', till_patient_id: 'p16', grund: 'samma_nummer', status: 'oppen' }]);
    // Läkaren kan inte slå samman. Vårdadministratören ser förslaget i inkorgen och i journalen.
    expect((await k.post('/api/patient/p17/sammanslagning', { med: 'p16' })).status).toBe(403);
    await k.logga('adm-kard');
    expect((await k.get('/api/inkorg')).data.dubbletter).toEqual([expect.objectContaining({ patientId: 'p17', antal: 1 })]);
    const i = await k.get('/api/patient/p17/identiteter');
    expect(i.data.dubbletter).toEqual([expect.objectContaining({ annan: expect.objectContaining({ id: 'p16' }), kvar: 'p16', grund: 'samma_nummer' })]);
    expect(i.data.kan).toEqual({ andraIdentitet: true, slaSamman: true });
  });

  test('API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    await k.get('/api/patient/p17/oversikt');
    await k.logga('adm-kard');
    const h = await k.get('/api/patient/p17');
    expect(h.data).toMatchObject({ dubbletter: 1, identitet: { typ: 'reservnummer' } });
    const r = await k.post('/api/patient/p17/sammanslagning', { med: 'p16' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ fran: 'p17', till: 'p16', patient: { id: 'p16' } });
    expect(r.data.antal).toBeGreaterThan(8);
    // Den gamla adressen leder till den gällande journalen.
    expect((await k.get('/api/patient/p17')).data).toMatchObject({ id: 'p16', identitet: { typ: 'personnummer' }, tidigareIdentiteter: 1, dubbletter: 0 });
    const s = await k.get(`/api/sok?q=${encodeURIComponent('VK19650509-0023')}`);
    expect(s.data.map(p => p.id)).toEqual(['p16']);
    const namn = await k.get('/api/sok?q=Holmgren');
    expect(namn.data.map(p => p.id)).toEqual(['p16']);
    const i = await k.get('/api/patient/p16/identiteter');
    expect(i.data.sammanslagningar).toEqual([expect.objectContaining({ fran: 'p17', till: 'p16', grund: 'samma_namn_fodd', av: 'Karin Berg' })]);
    expect(i.data.identiteter.map(x => [x.typ, x.status, x.franAnnanJournal])).toEqual([['personnummer', 'gallande', false], ['reservnummer', 'tidigare', true]]);
    // Logglistan visar åtkomsterna till båda journalerna, och kedjan är hel.
    await k.logga('logg');
    const ll = await k.get('/api/patient/p16/logglista');
    const pids = new Set(ll.data.rader.map(x => x.patientId));
    expect(pids.has('p17') && pids.has('p16')).toBe(true);
    expect(ll.data.rader.filter(x => x.handling === 'sla_samman').map(x => x.patientId).sort()).toEqual(['p16', 'p17']);
    expect(ll.data.kedjaHel).toBe(true);
    // Ett nytt förslag kan inte göras om samma journaler.
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p16/sammanslagning', { med: 'p17' })).status).toBe(400);
  });

  test('behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit', async () => {
    const k = klient(app);
    for (const roll of ['lak-kard', 'ssk-kard', 'usk-kard', 'logg']) {
      await k.logga(roll);
      expect({ roll, s: (await k.post('/api/patient/p17/sammanslagning', { med: 'p16' })).status }).toEqual({ roll, s: 403 });
    }
    await k.logga('adm-kard');
    // Inget förslag om att p01 och p02 är samma person.
    const r = await k.post('/api/patient/p01/sammanslagning', { med: 'p02' });
    expect(r.status).toBe(400);
    expect(r.data.fel).toContain('Systemet har inget förslag');
    // Utan vårdrelation till journalen nekas sammanslagningen, och försöket loggas som nekat.
    const nekad = await k.post('/api/patient/p16/sammanslagning', { med: 'p17' });
    expect(nekad.status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p16', handling: 'sla_samman', resultat: 'nekad' });
    // Ett förslag som avfärdas kommer inte tillbaka.
    expect((await k.post('/api/patient/p17/dubblett/avfarda', { med: 'p16' })).status).toBe(200);
    expect((await k.get('/api/patient/p17/identiteter')).data.dubbletter).toEqual([]);
    expect((await k.post('/api/patient/p17/sammanslagning', { med: 'p16' })).status).toBe(400);
  });

  test('behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas', async () => {
    const k = klient(app);
    for (const roll of ['usk-kard', 'logg']) {
      await k.logga(roll);
      expect({ roll, s: (await k.post('/api/patienter', { kon: 'man', alder: 30 })).status }).toEqual({ roll, s: 403 });
      expect({ roll, s: (await k.post('/api/patient/p17/identitet', { identitet: '196506232880' })).status }).toEqual({ roll, s: 403 });
    }
    // Läkaren på vårdcentralen har ingen vårdrelation till patient 17.
    await k.logga('lak-vc');
    const r = await k.post('/api/patient/p17/identitet', { identitet: '196506232880' });
    expect(r.status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p17', handling: 'andra_identitet', resultat: 'nekad' });
    expect(sandlada(app, k).db.query("SELECT id_typ FROM patienter WHERE id = 'p17'").get().id_typ).toBe('reservnummer');
  });

  test('FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler', async () => {
    const k = klient(app);
    await k.logga('lak-vc');
    const p18 = (await k.get('/fhir/Patient/p18')).data;
    expect(p18.identifier).toEqual([
      { use: 'official', system: 'http://electronichealth.se/identifier/samordningsnummer', value: '199308662395' },
      { use: 'old', system: `urn:oid:${OID_RESERVNUMMER}`, value: 'VK199308060110' },
    ]);
    const sok = (await k.get(`/fhir/Patient?identifier=${encodeURIComponent(`urn:oid:${OID_RESERVNUMMER}|VK199308060110`)}`)).data;
    expect(sok.entry.map(e => e.resource.id)).toEqual(['p18']);
    const sam = (await k.get(`/fhir/Patient?identifier=${encodeURIComponent('http://electronichealth.se/identifier/samordningsnummer|199308662395')}`)).data;
    expect(sam.entry.map(e => e.resource.id)).toEqual(['p18']);
    await k.logga('lak-akut');
    expect((await k.get('/fhir/Patient/p19')).data.identifier).toEqual([{ use: 'official', system: 'urn:oid:1.3.6.1.4.1.32473.1.2', value: 'UT-4471-0921' }]);
    await k.logga('adm-kard');
    expect((await k.post('/api/patient/p17/sammanslagning', { med: 'p16' })).status).toBe(200);
    await k.logga('lak-kard');
    const p16 = (await k.get('/fhir/Patient/p16')).data;
    expect(p16.identifier).toEqual([
      { use: 'official', system: 'http://electronichealth.se/identifier/personnummer', value: '196505092962' },
      { use: 'old', system: `urn:oid:${OID_RESERVNUMMER}`, value: 'VK196505090023' },
    ]);
    expect(p16.link).toEqual([{ other: { reference: 'Patient/p17' }, type: 'replaces' }]);
    const p17 = (await k.get('/fhir/Patient/p17')).data;
    expect(p17).toMatchObject({ id: 'p17', active: false, link: [{ other: { reference: 'Patient/p16' }, type: 'replaced-by' }] });
    expect(p17.identifier).toEqual([{ use: 'old', system: `urn:oid:${OID_RESERVNUMMER}`, value: 'VK196505090023' }]);
    const gammal = (await k.get(`/fhir/Patient?identifier=${encodeURIComponent('VK196505090023')}`)).data;
    expect(gammal.entry.map(e => e.resource.id)).toEqual(['p16']);
  });
});
