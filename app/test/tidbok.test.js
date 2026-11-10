import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, nyDb } from './hjalp.js';
import { lasSandlada, byggSeed, idag, addDagar, datumAv, lokalTid, inomDagen } from '../src/db.js';
import * as tidbok from '../src/tidbok.js';
import { harVardrelation, prova } from '../src/atkomst.js';

// Tidbok, väntelista, kallelser, incheckning och betalning (Sussa 3.4.1 till 3.4.4). Systemet är experten:
// vårdadministratören letar aldrig i en kalender, systemet föreslår tiderna, skriver kallelserna och räknar avgiften.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const invanare = async (id) => { const k = klient(app); const r = await k.post('/api/login/invanare', { invanareId: id }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return k; };
const db = (k) => sandlada(app, k).db;
const loggRader = (k) => db(k).query('SELECT * FROM atkomstlogg ORDER BY id').all();
const post = (k, pid) => db(k).query("SELECT * FROM vantelista WHERE patient_id = ? AND status = 'vantar'").get(pid);
const bokning = (k, pid, status = 'bokad') => db(k).query('SELECT * FROM bokningar WHERE patient_id = ? AND status = ? ORDER BY id DESC').get(pid, status);
const kontakt = (k, id) => db(k).query('SELECT * FROM vardkontakter WHERE id = ?').get(id);
const kallelser = (k, bid) => db(k).query('SELECT * FROM kallelser WHERE bokning_id = ? ORDER BY id').all(bid);

describe('Tidbok', () => {
  test('seeden har scheman per mottagning och vårdgivare med tidstyper, och dagens patienter på kardiologiska mottagningen', () => {
    const d = nyDb();
    const scheman = d.query('SELECT * FROM scheman').all();
    // Runda 6, r4: provtagningen på mottagningen har ett eget schema (seed/planering.js).
    expect(scheman.filter(s => s.enhet_id === 'uso-kard-mott').map(s => s.personal_id).sort()).toEqual(['lak-kard', 'lak-kard2', 'ssk-kardlab', 'ssk-kardmott']);
    const typer = new Set(d.query('SELECT DISTINCT tidstyp FROM tider').all().map(r => r.tidstyp));
    for (const t of ['nybesok', 'aterbesok', 'telefon', 'video', 'grupp']) expect(typer.has(t)).toBe(true);
    // Varje bokning är en planerad vårdkontakt på mottagningen.
    for (const b of d.query("SELECT * FROM bokningar WHERE status IN ('bokad', 'incheckad')").all()) {
      const v = d.query('SELECT * FROM vardkontakter WHERE id = ?').get(b.vardkontakt_id);
      const t = d.query('SELECT * FROM tider WHERE id = ?').get(b.tid_id);
      expect(v).toMatchObject({ patient_id: b.patient_id, planerad: 1, start: t.start, kalla: 'vardkallan' });
    }
    // Dagens patienter ligger kring nu: någon har kommit, någon är sen och någon väntas.
    const idagBokade = d.query('SELECT b.*, t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE t.relativ = 1').all();
    expect(idagBokade.map(b => b.patient_id).sort()).toEqual(['p08', 'p09', 'p15']);
    expect(idagBokade.some(b => b.status === 'incheckad')).toBe(true);
    // Runda 11, r1: tiderna ligger på hela fem minuter i dag, så efter 23.55 ryms ingen tid efter nu före midnatt.
    if (Date.now() < Date.parse(lokalTid(addDagar(idag(), 1), '00:00')) - 5 * 60_000) expect(idagBokade.some(b => Date.parse(b.start) > Date.now())).toBe(true);
    for (const b of idagBokade) expect(datumAv(new Date(b.start))).toBe(idag());
  });

  test('dagens seedade tider flyttas till tider kring nu när sandlådan skapas, och kallelserna stämmer med tiden', () => {
    // Mallen byggdes för tre timmar sedan.
    const bas = new Date(Date.now() - 3 * 3600_000);
    const d = byggSeed(bas);
    const fore = d.query("SELECT t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get().start;
    expect(tidbok.anpassaTillNu(d)).toBeGreaterThan(0);
    const efter = d.query("SELECT t.start, b.id, b.vardkontakt_id FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p08' AND t.relativ = 1").get();
    // Runda 11, r1: en tid som skulle flyttas över midnatt stannar på dagens sista tid (fem minuter före midnatt).
    const sista = Date.parse(lokalTid(addDagar(idag(), 1), '00:00')) - 5 * 60_000;
    expect(Date.parse(efter.start)).toBe(Math.min(Date.parse(fore) + 3 * 3600_000, sista));
    expect(d.query('SELECT start FROM vardkontakter WHERE id = ?').get(efter.vardkontakt_id).start).toBe(efter.start);
    // Kallelsen skrivs efter flytten, med den nya tiden.
    expect(d.query("SELECT text FROM kallelser WHERE bokning_id = ? AND typ = 'kallelse'").get(efter.id).text).toContain(`Tid: ${tidbok.tidText(efter.start)}.`);
    // Görs en gång per sandlåda.
    expect(tidbok.anpassaTillNu(d)).toBe(0);
  });

  test('en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel', async () => {
    const vc = await inloggad('lak-vc');
    const ny = await vc.post('/api/patient/p01/remisser', { tillEnhetId: 'uso-kard', fragestallning: 'Ställningstagande till elkonvertering.', anamnes: 'Förmaksflimmer.', prioritet: 'skyndsam', svarSenast: addDagar(idag(), 14) });
    expect(ny.status).toBe(201);
    const id = ny.data.id;
    await vc.logga('adm-kard');
    expect((await vc.post(`/api/remiss/${id}/mottag`)).status).toBe(200);
    await vc.logga('lak-kard');
    expect((await vc.post(`/api/remiss/${id}/bedom`, { beslut: 'accepterad' })).status).toBe(200);
    const v = db(vc).query('SELECT * FROM vantelista WHERE remiss_id = ?').get(id);
    expect(v).toMatchObject({ patient_id: 'p01', enhet_id: 'uso-kard', tidstyp: 'nybesok', yrkesroll: 'lakare', prioritet: 'hog', status: 'vantar' });
    expect(v.orsak).toBe('Nybesök enligt remiss från Vårdcentralen Tybble');
    expect(v.orsak).not.toContain('elkonvertering');
    const g = tidbok.gransFor(v);
    // Remissens sista svarsdatum kommer före vårdgarantins 90 dagar, så det är gränsen.
    expect(g).toMatchObject({ typ: 'mal', datum: addDagar(idag(), 14), dagarKvar: 14, risk: 'risk' });
    expect(tidbok.gransFor({ ...v, mal: null })).toMatchObject({ typ: 'vardgaranti', datum: addDagar(v.fran, 90), text: 'vårdgarantin (demoregel)' });
    // Patientvald väntan: vårdgarantin räknas inte.
    expect(tidbok.gransFor({ ...v, mal: null, patientvald: 1 })).toBeNull();
  });

  test('systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid', async () => {
    const k = await inloggad('adm-kard');
    const p = post(k, 'p01');
    const r = await k.get(`/api/vantelista/${p.id}/forslag`);
    expect(r.status).toBe(200);
    expect(r.data.forslag.length).toBe(3);
    for (const f of r.data.forslag) {
      expect(f).toMatchObject({ tidstyp: 'aterbesok', mottagning: { id: 'uso-kard-mott' } });
      const t = db(k).query('SELECT s.yrkesroll FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE t.id = ?').get(f.tidId);
      expect(t.yrkesroll).toBe('lakare');
      expect(Date.parse(f.start)).toBeGreaterThan(Date.now());
      expect(f.skal.length).toBeGreaterThan(0);
    }
    // Hög prioritet: den tidigaste tiden först, och Sara Lindqvist som patienten har träffat bland förslagen.
    expect(r.data.forslag.some(f => f.vardgivare.id === 'lak-kard' && f.skal.some(s => s.includes('träffat förut')))).toBe(true);
    expect(r.data.forslag[0].skal).toContain('Den tidigaste lediga tiden.');
    expect(r.data.forslag.every(f => datumAv(new Date(f.start)) <= p.mal)).toBe(true);
    // Hjärtskolan är patientens andra tid. Den dagen föreslås inte.
    const grupp = db(k).query("SELECT t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.patient_id = 'p01' AND t.tidstyp = 'grupp'").get().start;
    expect(r.data.forslag.some(f => datumAv(new Date(f.start)) === datumAv(new Date(grupp)))).toBe(false);
    // Tre förslag på olika dagar.
    expect(new Set(r.data.forslag.map(f => datumAv(new Date(f.start)))).size).toBe(3);
    expect(loggRader(k).at(-1)).toMatchObject({ personal_id: 'adm-kard', patient_id: 'p01', handling: 'boka', grund: 'administrativ', resurs: `vantelista:${p.id}:forslag` });
  });

  test('en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv', async () => {
    const k = await inloggad('adm-kard');
    const p = post(k, 'p10');
    const f = (await k.get(`/api/vantelista/${p.id}/forslag`)).data.forslag[0];
    const r = await k.post(`/api/vantelista/${p.id}/boka`, { tidId: f.tidId });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ status: 'bokad', tid: { id: f.tidId, tidstyp: 'nybesok' }, patient: { id: 'p10' } });
    const b = bokning(k, 'p10');
    const v = kontakt(k, b.vardkontakt_id);
    expect(v).toMatchObject({ patient_id: 'p10', enhet_id: 'uso-kard-mott', planerad: 1, kontaktsatt: 'besok', start: f.start, skapad_av: 'adm-kard', remiss_id: p.remiss_id, ger_vardrelation: 1 });
    expect(v.orsak).toBe('Nybesök enligt remiss från Medicinkliniken Lindesbergs lasarett');
    expect(db(k).query('SELECT status, bokning_id FROM vantelista WHERE id = ?').get(p.id)).toEqual({ status: 'bokad', bokning_id: b.id });
    const kl = kallelser(k, b.id);
    expect(kl.length).toBe(1);
    expect(kl[0]).toMatchObject({ typ: 'kallelse', kanal: 'min_journal', status: 'skickad', skapad_av: 'adm-kard' });
    expect(r.data.kallelse.text).toContain('Nybesök hos läkare');
    // Tiden är inte längre ledig och föreslås inte igen.
    const p2 = post(k, 'p01');
    expect((await k.get(`/api/vantelista/${p2.id}/forslag`)).data.forslag.some(x => x.tidId === f.tidId)).toBe(false);
    expect((await k.post(`/api/vantelista/${p.id}/boka`, { tidId: f.tidId })).status).toBe(400);
    expect(loggRader(k).filter(x => x.resurs === `bokning:${b.id}`)).toEqual([expect.objectContaining({ handling: 'boka', patient_id: 'p10', grund: 'administrativ' })]);
  });

  test('kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext', () => {
    const d = nyDb();
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p08'").get();
    const text = tidbok.kallelseText(d, b, 'kallelse');
    expect(text).toContain('Hej Ahmed');
    expect(text).toContain('Nybesök hos läkare Magnus Öberg');
    expect(text).toContain('Kardiologiska mottagningen');
    expect(text).toContain('Ta med en lista över de läkemedel du tar');
    expect(text).toContain('Avgift: 200 kronor');
    expect(text).toContain('Checka in i Min journal eller på skärmen i väntrummet');
    expect(text).not.toMatch(/[—–…]/);
    // Ingen diagnos, frågeställning eller anteckning.
    for (const d2 of d.query("SELECT text FROM diagnoser WHERE patient_id = 'p08'").all()) expect(text).not.toContain(d2.text);
    // Patienten vill ha brev. Brev och sms är simulerade och märkta så.
    const k = d.query("SELECT * FROM kallelser WHERE bokning_id = ? AND typ = 'kallelse'").get(b.id);
    expect(k).toMatchObject({ kanal: 'brev', status: 'skickad', mottagare: 'Vivallagatan 22, 703 42 Örebro' });
    expect(k.forklaring).toContain('Brev är simulerat i demon');
    // En påminnelse går inte med brev.
    expect(d.query("SELECT kanal FROM kallelser WHERE bokning_id = ? AND typ = 'paminnelse'").get(b.id).kanal).toBe('min_journal');
    expect(tidbok.kanalFor(d, d.query("SELECT * FROM patienter WHERE id = 'p14'").get())).toMatchObject({ kanal: 'min_journal' });
    // Utan Min journal och val: sms om det finns ett telefonnummer.
    const barn = d.query("SELECT * FROM patienter WHERE id = 'p09'").get();
    expect(tidbok.kanalFor(d, barn)).toMatchObject({ kanal: 'min_journal', mottagare: 'Min journal, vårdnadshavare' });
    expect(tidbok.kanalFor(d, { ...d.query("SELECT * FROM patienter WHERE id = 'p14'").get(), id: 'x' })).toMatchObject({ kanal: 'sms' });
  });

  test('påminnelsen skickas automatiskt två dagar före tiden', () => {
    const d = nyDb();
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p14'").get();
    expect(d.query("SELECT count(*) AS n FROM kallelser WHERE bokning_id = ? AND typ = 'paminnelse'").get(b.id).n).toBe(0);
    const start = Date.parse(d.query('SELECT start FROM tider WHERE id = ?').get(b.tid_id).start);
    // Räkna bara den här bokningens påminnelser: andra tider i demoläget kan ligga i samma fönster beroende på dagens datum.
    const paminnelser = () => d.query("SELECT count(*) AS n FROM kallelser WHERE bokning_id = ? AND typ = 'paminnelse'").get(b.id).n;
    tidbok.skickaPaminnelser(d, start - 3 * 86400_000);
    expect(paminnelser()).toBe(0);
    expect(tidbok.skickaPaminnelser(d, start - 47 * 3600_000)).toBeGreaterThanOrEqual(1);
    expect(paminnelser()).toBe(1);
    const p = d.query("SELECT * FROM kallelser WHERE bokning_id = ? AND typ = 'paminnelse'").get(b.id);
    expect(p).toMatchObject({ kanal: 'min_journal', status: 'skickad', skapad_av: null });
    expect(p.text).toContain('Påminnelse');
    // Bara en påminnelse per bokning.
    tidbok.skickaPaminnelser(d, start - 46 * 3600_000);
    expect(paminnelser()).toBe(1);
  });

  test('väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas', async () => {
    const k = await inloggad('adm-kard');
    const lista = (await k.get('/api/vantelista')).data;
    expect(lista.poster[0]).toMatchObject({ patient: { id: 'p01' }, grans: { risk: 'risk' }, prioritet: 'hog' });
    expect(lista.demoregler).toContain('Demoregler');
    const p = lista.poster.find(x => x.patient.id === 'p04');
    expect(p.vantatDagar).toBe(1);
    expect((await k.post(`/api/vantelista/${p.id}/prioritet`, { prioritet: 'hog' })).status).toBe(400);
    const r = await k.post(`/api/vantelista/${p.id}/prioritet`, { prioritet: 'hog', orsak: 'tillstand' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ prioritet: 'hog' });
    expect(r.data.handelser.at(-1)).toMatchObject({ typ: 'omprioriterad', av: { id: 'adm-kard' }, detalj: 'Normal till hög. Patientens tillstånd har ändrats.' });
    expect(loggRader(k).at(-1)).toMatchObject({ handling: 'vantelista', patient_id: 'p04', resurs: `vantelista:${p.id}:prioritet` });
    // Händelserna kan inte ändras eller raderas.
    expect(() => db(k).query('DELETE FROM vantelista_handelser').run()).toThrow();
  });

  test('ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse', async () => {
    const k = await inloggad('adm-kard');
    const b = bokning(k, 'p15');
    const fs = (await k.get(`/api/bokning/${b.id}/forslag`)).data.forslag;
    expect(fs.length).toBeGreaterThan(0);
    // Samma tidstyp och samma vårdgivare först.
    expect(fs[0]).toMatchObject({ tidstyp: 'aterbesok', vardgivare: { id: 'ssk-kardmott' } });
    const r = await k.post(`/api/bokning/${b.id}/omboka`, { tidId: fs[0].tidId });
    expect(r.status).toBe(200);
    expect(db(k).query('SELECT status FROM bokningar WHERE id = ?').get(b.id).status).toBe('ombokad');
    const ny = bokning(k, 'p15');
    expect(ny).toMatchObject({ ersatter_id: b.id, vardkontakt_id: b.vardkontakt_id, tid_id: fs[0].tidId });
    expect(kontakt(k, b.vardkontakt_id)).toMatchObject({ start: fs[0].start, andrad_av: 'adm-kard' });
    expect(kallelser(k, ny.id)).toEqual([expect.objectContaining({ typ: 'ombokning', kanal: 'sms', status: 'skickad' })]);
    expect(r.data.kallelse.text).toContain('Din tid är ändrad');
  });

  test('avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten', async () => {
    const k = await inloggad('adm-kard');
    const p = post(k, 'p01');
    const f = (await k.get(`/api/vantelista/${p.id}/forslag`)).data.forslag[0];
    await k.post(`/api/vantelista/${p.id}/boka`, { tidId: f.tidId });
    const b = db(k).query("SELECT * FROM bokningar WHERE vantelista_id = ? AND status = 'bokad'").get(p.id);
    expect((await k.post(`/api/bokning/${b.id}/avboka`, {})).status).toBe(400);
    const r = await k.post(`/api/bokning/${b.id}/avboka`, { orsak: 'Patienten ringde, är bortrest' });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('avbokad');
    expect(kontakt(k, b.vardkontakt_id)).toBeNull();
    expect(db(k).query('SELECT status FROM vantelista WHERE id = ?').get(p.id).status).toBe('vantar');
    expect(kallelser(k, b.id).at(-1)).toMatchObject({ typ: 'avbokning', status: 'skickad' });
    expect(r.data.kallelse.text).toContain('Du står kvar i kön');
  });

  test('incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften', async () => {
    const k = await inloggad('adm-kard');
    const b = bokning(k, 'p08');
    const r = await k.post(`/api/bokning/${b.id}/checka-in`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'incheckad', incheckadVia: 'personal', avgift: { belopp: 200, demoregler: true } });
    expect(r.data.konummer).toMatch(/^K\d{2}$/);
    const v = kontakt(k, b.vardkontakt_id);
    expect(v.ankomst).toBeTruthy();
    expect(v.andrad_av).toBe('adm-kard');
    expect(loggRader(k).at(-1)).toMatchObject({ handling: 'checka_in', patient_id: 'p08', resurs: `bokning:${b.id}:incheckad` });
    expect((await k.post(`/api/bokning/${b.id}/checka-in`)).status).toBe(400);
    // Kontakten är inte längre planerad utan pågående, och dokumentation hamnar på den.
    const vk = (await k.get(`/api/vardkontakt/${b.vardkontakt_id}`)).data.vardkontakt;
    expect(vk.status).toBe('pagaende');
  });

  test('betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    // Leo Bergström är ett barn och har checkat in. Systemet har registrerat att besöket är avgiftsfritt.
    const leo = d.query("SELECT * FROM bokningar WHERE patient_id = 'p09' AND status = 'incheckad'").get();
    expect(d.query('SELECT * FROM betalningar WHERE bokning_id = ?').get(leo.id)).toMatchObject({ belopp: 0, satt: 'avgiftsfri' });
    expect((await k.post(`/api/bokning/${leo.id}/betala`, { satt: 'kort' })).status).toBe(400);
    // Ahmed Hassan checkar in och har 200 kronor att betala.
    const b = bokning(k, 'p08');
    expect((await k.post(`/api/bokning/${b.id}/betala`, { satt: 'kort' })).status).toBe(400);
    await k.post(`/api/bokning/${b.id}/checka-in`);
    expect((await k.post(`/api/bokning/${b.id}/betala`, { satt: 'kontant' })).status).toBe(400);
    const r = await k.post(`/api/bokning/${b.id}/betala`, { satt: 'kort' });
    expect(r.status).toBe(200);
    expect(r.data.betalning).toMatchObject({ belopp: 200, satt: 'kort', sattText: 'Kort' });
    expect(r.data.betalning.text).toContain('simulerad');
    expect(r.data.betalning.kvitto).toMatch(/^VK-DEMO-\d{5}$/);
    expect((await k.post(`/api/bokning/${b.id}/betala`, { satt: 'faktura' })).status).toBe(400);
    expect(() => d.query('UPDATE betalningar SET belopp = 0').run()).toThrow();
    // Telefontid: avgiftsfritt, och det registreras utan att någon gör något. Ett barn betalar inget.
    const telefon = d.query("SELECT * FROM bokningar WHERE patient_id = 'p14'").get();
    expect(tidbok.avgiftForBokning(d, telefon)).toMatchObject({ belopp: 0, satt: 'avgiftsfri' });
    // Högkostnadsskyddet nått: frikort.
    d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, kalla, planerad) VALUES ('p15', 'uso-psyk', 'oppenvard', 'besok', ?, ?, 'vardkallan', 0)")
      .run(new Date(Date.now() - 20 * 86400_000).toISOString(), new Date(Date.now() - 20 * 86400_000 + 1800_000).toISOString());
    for (let i = 0; i < 7; i++) {
      d.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, kalla, planerad) VALUES ('p15', 'uso-psyk', 'oppenvard', 'besok', ?, ?, 'vardkallan', 0)")
        .run(new Date(Date.now() - (30 + i) * 86400_000).toISOString(), new Date(Date.now() - (30 + i) * 86400_000 + 1800_000).toISOString());
    }
    const sen = bokning(k, 'p15');
    expect(tidbok.avgiftForBokning(d, sen)).toMatchObject({ belopp: 0, satt: 'frikort' });
    const inc = await k.post(`/api/bokning/${sen.id}/checka-in`);
    expect(inc.data.betalning).toMatchObject({ belopp: 0, satt: 'frikort', sattText: 'Frikort' });
  });

  test('startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad', async () => {
    const k = await inloggad('adm-kard');
    const s = (await k.get('/api/idag')).data;
    expect(s.vardenhet).toMatchObject({ id: 'uso-kard' });
    expect(s.dagens.map(d => d.patient.id)).toEqual(['p09', 'p15', 'p08']);
    const rad = (pid) => s.dagens.find(d => d.patient.id === pid).rad;
    expect(rad('p09')).toMatchObject({ atgard: null });
    expect(rad('p09').status).toMatch(/^Incheckad \d{2}\.\d{2}, nummer K01\. Avgiftsfritt$/);
    // Runda 11, r1: dagens tider stannar på dagens datum, så under den första halvtimmen efter midnatt hinner ingen bli sen.
    if (Date.now() - Date.parse(lokalTid(idag(), '00:00')) >= 30 * 60_000) {
      expect(rad('p15')).toMatchObject({ atgard: { typ: 'checka_in' }, sen: true });
      expect(rad('p15').status).toContain('minuter sen');
    } else expect(rad('p15')).toMatchObject({ atgard: { typ: 'checka_in' } });
    expect(rad('p08')).toMatchObject({ atgard: { typ: 'checka_in', text: 'Checka in' }, status: 'Väntas' });
    // Efter incheckningen är nästa åtgärd att ta betalt.
    await k.post(`/api/bokning/${s.dagens.find(d => d.patient.id === 'p08').id}/checka-in`);
    const efter = (await k.get('/api/idag')).data.dagens.find(d => d.patient.id === 'p08').rad;
    expect(efter.atgard).toEqual({ typ: 'betala', text: 'Ta betalt' });
    expect(efter.status).toContain('Att betala 200 kr');
    expect(s.remisser.map(r => r.patient.id)).toEqual(['p10']);
    expect(s.remisser[0].atgard).toEqual({ typ: 'boka', text: 'Boka tid' });
    // Runda 6, r4: posterna som behöver ett ingrepp eller tider i följd prövas i planering.test.js.
    expect(s.vantelista.filter(r => !r.ingrepp && !r.mall).map(r => r.patient.id)).toEqual(['p01', 'p04']);
    expect(s.kallelser).toEqual([expect.objectContaining({ typ: 'grupp', antal: 3, atgard: { typ: 'kalla_grupp', text: 'Skicka kallelser' } })]);
    // Runda 6, r4: egna bevakningar (egen: true) prövas i planering.test.js.
    expect(s.bevakningar.filter(b => !b.egen)).toEqual([expect.objectContaining({ patient: expect.objectContaining({ id: 'p10' }), atgard: { typ: 'bevakning_klar', text: 'Klar' } })]);
    for (const lista of [s.dagens.map(d => d.rad), s.remisser, s.vantelista, s.kallelser, s.bevakningar]) {
      for (const x of lista) expect(x.atgard === null || typeof x.atgard.typ === 'string').toBe(true);
    }
    // Ingen journaltext på startsidan.
    expect(JSON.stringify(s)).not.toContain('Ekokardiografi och bedömning av hjärtsvikt');
    // Bevakningen markeras som klar.
    expect((await k.post(`/api/bevakning/${s.bevakningar[0].id}/klar`)).status).toBe(200);
    expect((await k.get('/api/idag')).data.bevakningar.filter(b => !b.egen).length).toBe(0);
  });

  test('exemplet på gruppkallelsen skrivs ur en mall och aldrig ur en sparad kallelse till en patient', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    // Sparade kallelser till deltagarna får en text som inte får synas i exemplet.
    d.query("UPDATE kallelser SET text = 'Hej Gunnar, HEMLIG RAD' WHERE status = 'vantar'").run();
    const g = (await k.get('/api/idag')).data.kallelser.find(x => x.typ === 'grupp');
    expect(g.exempel).not.toContain('HEMLIG');
    for (const n of ['Gunnar', 'Elin', 'Karl-Erik']) expect(g.exempel).not.toContain(n);
    expect(g.exempel).toContain('Hej (patientens förnamn),');
    expect(g.exempel).toContain('Hjärtskola');
  });

  test('gruppkallelse skickar en kallelse till varje deltagare och loggas per patient', async () => {
    const k = await inloggad('adm-kard');
    const g = (await k.get('/api/idag')).data.kallelser[0];
    const r = await k.post(`/api/tid/${g.tid.id}/kalla`);
    expect(r.status).toBe(200);
    expect(r.data.skickade.map(x => x.patient.id).sort()).toEqual(['p01', 'p04', 'p10']);
    for (const x of r.data.skickade) {
      expect(x.kallelse).toMatchObject({ typ: 'kallelse', status: 'skickad' });
      expect(x.kallelse.text).toContain('Hjärtskola');
      expect(loggRader(k).some(l => l.patient_id === x.patient.id && l.handling === 'kalla' && l.resurs.startsWith(`bokning:${x.bokningId}:kallelse:`))).toBe(true);
    }
    // En gång: nästa gång finns inget kvar att skicka, och startsidan har inga kallelser kvar.
    expect((await k.post(`/api/tid/${g.tid.id}/kalla`)).data.skickade.length).toBe(0);
    expect((await k.get('/api/idag')).data.kallelser.length).toBe(0);
  });

  test('skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen', async () => {
    const vc = await inloggad('adm-kard');
    const d = db(vc);
    // Remissen för patient 3 tas emot och accepteras, och vårdadministratören bokar.
    const r = d.query("SELECT * FROM remisser WHERE patient_id = 'p03' AND till_enhet_id = 'uso-kard'").get();
    expect((await vc.post(`/api/remiss/${r.id}/mottag`)).status).toBe(200);
    await vc.logga('lak-kard');
    expect((await vc.post(`/api/remiss/${r.id}/bedom`, { beslut: 'accepterad' })).status).toBe(200);
    await vc.logga('adm-kard');
    const p = post(vc, 'p03');
    const s = (await vc.get('/api/idag')).data;
    expect(s.remisser.find(x => x.id === p.id).patient).toEqual({ id: 'p03', namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    const f = (await vc.get(`/api/vantelista/${p.id}/forslag`)).data.forslag[0];
    const bok = await vc.post(`/api/vantelista/${p.id}/boka`, { tidId: f.tidId });
    expect(bok.data.kallelse).toMatchObject({ kanal: 'min_journal', simulerad: false });
    expect(bok.data.kallelse.forklaring).toContain('skyddade personuppgifter');
    expect(bok.data.kallelse.mottagare).toBe('Min journal');
    expect(JSON.stringify(bok.data)).not.toContain('Engberg');
    // Utan Min journal går kallelsen inte ut alls, och systemet säger varför.
    const p3 = d.query("SELECT * FROM patienter WHERE id = 'p03'").get();
    d.query("UPDATE invanare SET patient_id = NULL WHERE patient_id = 'p03'").run();
    expect(tidbok.kanalFor(d, p3)).toMatchObject({ kanal: null });
    expect(tidbok.kanalFor(d, p3).forklaring).toContain('kan inte skickas med brev eller sms');
    d.query("UPDATE invanare SET patient_id = 'p03' WHERE id = 'inv-p03'").run();
    // Incheckningsskärmen: tiden flyttas till nu och patienten checkar in med sitt personnummer.
    const b = bokning(vc, 'p03');
    // Runda 11, r1: tiden ligger om tio minuter, men stannar i dag strax före midnatt (inomDagen).
    const start = inomDagen(new Date(), 10);
    const nu = new Date(start).toISOString();
    d.query('UPDATE tider SET start = ?, slut = ? WHERE id = ?').run(nu, new Date(start + 60 * 60_000).toISOString(), b.tid_id);
    const skarm = await vc.post('/api/incheckning/skarm', { personnummer: '198404162383' });
    expect(skarm.data).toMatchObject({ ok: true });
    expect(skarm.data.text).toMatch(/Du är incheckad till klockan \d{2}\.\d{2}\. Sätt dig i väntrummet\. Vi ropar upp dig med nummer K\d{2}\./);
    const json = JSON.stringify(skarm.data);
    for (const x of ['Malin', 'Engberg', 'p03', '19840416']) expect(json).not.toContain(x);
    expect(loggRader(vc).at(-1)).toMatchObject({ patient_id: 'p03', handling: 'checka_in', resurs: `incheckning:skarm:bokning:${b.id}` });
    // Ett nummer utan tid och ett nummer som inte finns får samma svar.
    const utan = await vc.post('/api/incheckning/skarm', { personnummer: '196503143254' });
    const okant = await vc.post('/api/incheckning/skarm', { personnummer: '191212121212' });
    expect(utan.data).toEqual(okant.data);
    expect(utan.data.ok).toBe(false);
  });

  test('behörighet: bara vårdadministratören bokar, kallar, checkar in och hanterar väntelistan', async () => {
    const d = nyDb();
    const pers = (id) => d.query('SELECT * FROM personal WHERE id = ?').get(id);
    for (const h of ['boka', 'kalla', 'checka_in', 'vantelista']) {
      expect(prova(d, { personal: pers('adm-kard'), patient: 'p10', handling: h })).toMatchObject({ tillaten: true, grund: 'administrativ' });
      for (const roll of ['lak-kard', 'ssk-kard', 'usk-kard', 'logg']) expect(prova(d, { personal: pers(roll), patient: 'p10', handling: h }).tillaten).toBe(false);
    }
    const lak = await inloggad('lak-kard');
    const p = post(lak, 'p10');
    expect((await lak.get('/api/idag')).status).toBe(403);
    // Runda 6, r4: läkaren läser tidboken, med sitt eget schema som förval, men bokar inte.
    expect((await lak.get('/api/tidbok')).status).toBe(200);
    expect((await lak.get(`/api/vantelista/${p.id}/forslag`)).status).toBe(403);
    expect(loggRader(lak).at(-1)).toMatchObject({ personal_id: 'lak-kard', patient_id: 'p10', handling: 'boka', resultat: 'nekad' });
    // Läkaren ser patientens bokade tider men kan inte boka om dem.
    const b = (await lak.get('/api/patient/p08/bokningar')).data;
    expect(b.kommande.length).toBeGreaterThan(0);
    expect(b.kommande.every(x => x.kanOmbokas === false)).toBe(true);
  });

  test('utan vårdrelation eller remiss nekas bokningen, och en annan vårdenhets tidbok går inte att använda', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    // Patient 12 har ingen vårdrelation till kardiologen.
    expect(harVardrelation(d, 'p12', 'uso-kard')).toBe(false);
    const id = Number(d.query("INSERT INTO vantelista (patient_id, enhet_id, tidstyp, yrkesroll, prioritet, orsak, fran, skapad) VALUES ('p12', 'uso-kard', 'aterbesok', 'lakare', 'normal', 'Test', ?, ?)").run(idag(), new Date().toISOString()).lastInsertRowid);
    const r = await k.get(`/api/vantelista/${id}/forslag`);
    expect(r.status).toBe(403);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p12', handling: 'boka', grund: 'nekad', resultat: 'nekad' });
    // Väntelistan och startsidan visar inte patienten.
    expect((await k.get('/api/vantelista')).data.poster.some(x => x.patient.id === 'p12')).toBe(false);
    // Vårdcentralen Tybbles bokning av patient 3 kan inte bokas om från kardiologen, även med vårdrelation.
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p03'").get();
    expect((await k.get(`/api/bokning/${b.id}/forslag`)).status).toBe(403);
  });

  test('tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn', async () => {
    const k = await inloggad('adm-kard');
    const t = (await k.get('/api/tidbok')).data;
    expect(t.scheman.map(s => s.vardgivare.namn).sort()).toEqual(['Eva Lindgren', 'Lina Persson', 'Magnus Öberg', 'Sara Lindqvist']);
    const lina = t.scheman.find(s => s.vardgivare.namn === 'Lina Persson');
    expect(lina.tider.flatMap(x => x.bokningar).map(b => b.patient.id)).toContain('p15');
    expect(lina.belaggning.tider).toBeGreaterThan(0);
    expect(t.regler.find(r => r.tidstyp === 'telefon')).toMatchObject({ egenbokning: true });
    const anon = (await k.get('/api/tidbok?avidentifierad=1')).data;
    const json = JSON.stringify(anon);
    for (const n of ['Bergström', 'Nordin', 'Hassan', '20171211']) expect(json).not.toContain(n);
    // Den avidentifierade vyn visar bara att tiden är upptagen: tid, tidstyp och vårdgivare. Inget om patienten,
    // kontakten, avgiften eller betalningen.
    const tider = anon.scheman.flatMap(s => s.tider);
    expect(tider.some(x => x.bokade > 0)).toBe(true);
    expect(tider.every(x => x.bokningar.length === 0)).toBe(true);
    for (const nyckel of ['orsak', 'vardkontaktId', 'betalning', 'avgift', 'kallelser', 'patient', 'konummer']) expect(json).not.toContain(`"${nyckel}"`);
  });

  test('en kallelse på en annan vårdenhet kan inte markeras som lämnad, och försöket loggas', async () => {
    const k = await inloggad('adm-kard');
    const d = db(k);
    // Patient 3 har vårdrelation till kardiologen genom remissen, men bokningen hör till Vårdcentralen Tybble.
    const b = d.query("SELECT * FROM bokningar WHERE patient_id = 'p03'").get();
    const id = Number(d.query("INSERT INTO kallelser (bokning_id, patient_id, typ, text, status, skapad) VALUES (?, 'p03', 'kallelse', 'Test', 'kan_inte', ?)").run(b.id, new Date().toISOString()).lastInsertRowid);
    const r = await k.post(`/api/kallelse/${id}/klar`);
    expect(r.status).toBe(403);
    expect(d.query('SELECT status FROM kallelser WHERE id = ?').get(id).status).toBe('kan_inte');
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p03', handling: 'kalla', resultat: 'nekad' });
  });

  test('patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten', async () => {
    const k = await invanare('inv-p08');
    const t = (await k.get('/api/min/journal/p08/tider')).data;
    const b = t.kommande.find(x => x.tidstyp === 'nybesok');
    expect(b.kan.checkaIn).toBe(true);
    expect(b.kallelser.map(x => x.typ)).toEqual(['kallelse', 'paminnelse']);
    const r = await k.post(`/api/min/journal/p08/bokning/${b.id}/checka-in`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'incheckad', kan: { betala: true } });
    const rad = db(k).query('SELECT * FROM bokningar WHERE id = ?').get(b.id);
    expect(rad).toMatchObject({ status: 'incheckad', incheckad_via: 'min_journal' });
    expect(kontakt(k, rad.vardkontakt_id).ankomst).toBeTruthy();
    expect(loggRader(k).at(-1)).toMatchObject({ invanare_id: 'inv-p08', patient_id: 'p08', handling: 'checka_in', grund: 'egen_atkomst' });
    const bet = await k.post(`/api/min/journal/p08/bokning/${b.id}/betala`, { satt: 'faktura' });
    expect(bet.data.betalning).toMatchObject({ belopp: 200, sattText: 'Faktura' });
    // En annan patients bokning finns inte för invånaren.
    const annan = db(k).query("SELECT id FROM bokningar WHERE patient_id = 'p09'").get().id;
    expect((await k.post(`/api/min/journal/p08/bokning/${annan}/checka-in`)).status).toBe(404);
  });

  test('patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag', async () => {
    const k = await invanare('inv-p14');
    const t = (await k.get('/api/min/journal/p14/tider')).data;
    const b = t.kommande.find(x => x.tidstyp === 'telefon');
    expect(b.kan).toMatchObject({ omboka: true, avboka: true });
    const fs = (await k.get(`/api/min/journal/p14/bokning/${b.id}/forslag`)).data.forslag;
    expect(fs.length).toBeGreaterThan(0);
    expect(fs.every(f => f.tidstyp === 'telefon' && Date.parse(f.start) - Date.now() >= 24 * 3600_000)).toBe(true);
    expect(fs[0].vardgivare.namn).toBe('Lina Persson');
    const r = await k.post(`/api/min/journal/p14/bokning/${b.id}/omboka`, { tidId: fs[0].tidId });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'bokad', start: fs[0].start });
    const ny = db(k).query('SELECT * FROM bokningar WHERE id = ?').get(r.data.id);
    expect(ny).toMatchObject({ bokad_av_invanare: 'inv-p14', ersatter_id: b.id });
    expect(r.data.kallelser.map(x => x.typ)).toEqual(['ombokning']);
    expect(loggRader(k).at(-1)).toMatchObject({ invanare_id: 'inv-p14', handling: 'boka', patient_id: 'p14' });
    // Avbokning: systemet skapar en bevakning så att vårdadministratören erbjuder en ny tid.
    expect((await k.post(`/api/min/journal/p14/bokning/${ny.id}/avboka`)).status).toBe(200);
    expect(db(k).query("SELECT * FROM bevakningar WHERE patient_id = 'p14' AND klar IS NULL").get()).toMatchObject({ enhet_id: 'uso-kard', skapad_av: null });
    // Patienten kan själv boka en telefontid där hen har vårdrelation, på vårdcentralen där hen är listad.
    const val = (await k.get('/api/min/journal/p14/tider')).data.boka.find(v => v.vardenhet.id === 'vc-tybble' && v.tidstyp === 'telefon');
    expect((await k.get('/api/min/journal/p14/tider')).data.boka.some(v => v.vardenhet.id === 'uso-kard')).toBe(false);
    expect(val).toBeTruthy();
    const nya = (await k.get(`/api/min/journal/p14/boka/forslag?nyckel=${encodeURIComponent(val.nyckel)}`)).data.forslag;
    const bokad = await k.post('/api/min/journal/p14/boka', { nyckel: val.nyckel, tidId: nya[0].tidId });
    expect(bokad.status).toBe(201);
    expect(bokad.data.kallelser.map(x => x.typ)).toEqual(['kallelse']);
  });

  test('egenbokning stängs 24 timmar före tiden och för tidstyper som mottagningen inte öppnar', async () => {
    const k = await invanare('inv-p08');
    const t = (await k.get('/api/min/journal/p08/tider')).data;
    const b = t.kommande.find(x => x.tidstyp === 'nybesok');
    expect(b.kan).toMatchObject({ omboka: false, avboka: false });
    expect(b.varforInte).toContain('Mottagningen bokar om den här typen av tid själv');
    expect((await k.post(`/api/min/journal/p08/bokning/${b.id}/avboka`)).status).toBe(400);
    const p14 = await invanare('inv-p14');
    const d = db(p14);
    const tel = d.query("SELECT * FROM bokningar WHERE patient_id = 'p14'").get();
    d.query('UPDATE tider SET start = ? WHERE id = ?').run(new Date(Date.now() + 5 * 3600_000).toISOString(), tel.tid_id);
    const u = (await p14.get('/api/min/journal/p14/tider')).data.kommande.find(x => x.id === tel.id);
    expect(u.kan.omboka).toBe(false);
    expect(u.varforInte).toContain('mindre än 24 timmar');
  });

  test('FHIR: Schedule, Slot och Appointment med status för incheckning och samma behörighet och loggning', async () => {
    const k = await inloggad('adm-kard');
    const sch = (await k.get('/fhir/Schedule')).data;
    expect(sch.resourceType).toBe('Bundle');
    const lina = sch.entry.map(e => e.resource).find(s => s.id === 'sch-kard-lina');
    expect(lina).toMatchObject({ resourceType: 'Schedule', active: true, actor: [{ reference: 'Practitioner/ssk-kardmott', display: 'Lina Persson' }], comment: 'Kardiologiska mottagningen' });
    const slots = (await k.get('/fhir/Slot?schedule=Schedule/sch-kard-lina')).data;
    expect(slots.entry.length).toBeGreaterThan(10);
    for (const e of slots.entry) expect(e.resource).toMatchObject({ resourceType: 'Slot', schedule: { reference: 'Schedule/sch-kard-lina' }, status: expect.stringMatching(/^(free|busy)$/) });
    const app_ = (await k.get('/fhir/Appointment?patient=p09')).data;
    const a = app_.entry.map(e => e.resource).find(x => x.status === 'arrived');
    expect(a).toMatchObject({ resourceType: 'Appointment', participant: expect.arrayContaining([expect.objectContaining({ actor: { reference: 'Patient/p09' }, status: 'accepted' })]) });
    expect(a.slot[0].reference).toMatch(/^Slot\/\d+$/);
    expect(loggRader(k).at(-1)).toMatchObject({ patient_id: 'p09', handling: 'las_admin', resurs: 'fhir/Appointment?patient=p09' });
    const en = (await k.get(`/fhir/Appointment/${a.id}`)).data;
    expect(en.id).toBe(a.id);
    // Incheckning och avbokning syns i Appointment.status.
    const b = bokning(k, 'p08');
    expect((await k.get(`/fhir/Appointment/${b.id}`)).data.status).toBe('booked');
    await k.post(`/api/bokning/${b.id}/checka-in`);
    expect((await k.get(`/fhir/Appointment/${b.id}`)).data.status).toBe('arrived');
    // Utan vårdrelation: nekad och loggad.
    const psyk = await inloggad('lak-psyk');
    expect((await psyk.get('/fhir/Appointment?patient=p09')).status).toBe(403);
    expect((await klient(app).get('/fhir/Schedule')).status).toBe(401);
  });

  test('FHIR: invånaren ser bara sina egna Appointment', async () => {
    const k = await invanare('inv-p14');
    const egna = (await k.get('/fhir/Appointment?patient=p14')).data;
    expect(egna.entry.length).toBeGreaterThan(0);
    expect(egna.entry.every(e => e.resource.participant.some(p => p.actor.reference === 'Patient/p14'))).toBe(true);
    expect((await k.get('/fhir/Appointment?patient=p09')).status).toBe(404);
    const annan = db(k).query("SELECT id FROM bokningar WHERE patient_id = 'p09'").get().id;
    expect((await k.get(`/fhir/Appointment/${annan}`)).status).toBe(404);
    expect((await k.get('/fhir/Schedule')).status).toBe(403);
  });

  test('en äldre sandlåda får tidboken när den läses in', () => {
    const d = nyDb();
    for (const t of ['tidboksregler', 'scheman', 'tider', 'bokningar', 'betalningar', 'vantelista', 'vantelista_handelser', 'kallelser', 'kanalval', 'bevakningar']) d.exec(`DROP TABLE ${t}`);
    const gammal = lasSandlada(Buffer.from(d.serialize()).toString('base64'));
    expect(gammal.query('SELECT count(*) AS n FROM tider').get().n).toBeGreaterThan(100);
    expect(gammal.query("SELECT count(*) AS n FROM vantelista WHERE patient_id = 'p10'").get().n).toBe(1);
  });
});
