// Bilder och media (runda 9, r3, Sussa 4.2.1.1 till 4.2.1.4): uppladdning och visning i journalen, jämförelse över
// tid, import från kamera, Min journal och remissbilaga, och studier i ett simulerat multimediaarkiv.
import { describe, test, expect } from 'bun:test';
import * as bilder from '../src/bilder.js';
import { sparaBilaga } from '../src/remiss-r4.js';
import { InvanareAtkomst } from '../src/patientvy.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]).toString('base64');
const TEXT = Buffer.from('bara text').toString('base64');
const ny = (db, id = 'md1', extra = {}) => nyPatient(db, { id, enhet: 'kkoga-ort', ar: 1975, kon: 'K', fornamn: 'Bilda', efternamn: 'Fotosson', ...extra });
const lak = (db, pid = 'md1', h = 'skriv_journal', val = {}) => atk(db, 'lak-kkoga', pid, h, val);
const ladda = (db, body, nu = BAS, roll = 'lak-kkoga', pid = 'md1') => bilder.ladda(atk(db, roll, pid, 'skriv_journal'), { bild: { namn: 'sar.png', data: PNG }, ...body }, nu);
const svarText = async (r) => Buffer.from(await r.arrayBuffer());

describe('Bilder och media', () => {
  test('en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen', async () => {
    const db = sandlada();
    ny(db);
    expect(() => ladda(db, { bild: { namn: 'a.txt', data: TEXT } })).toThrow('Filtypen stöds inte');
    expect(() => ladda(db, { kalla: 'okand' })).toThrow('Källan är fil eller kamera');
    db.query("INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status) VALUES ('md1', 'kkoga-ort', 'Daganteckning', 'journal', '{}', 'lak-kkoga', ?, 'signerad')").run(BAS.toISOString());
    const aid = db.query("SELECT id FROM anteckningar WHERE patient_id = 'md1'").get().id;
    const m = ladda(db, { kroppsstalle: 'Vänster  Underben', beskrivning: 'Bensår, lateralt', anteckningId: aid });
    expect(m).toMatchObject({ typ: 'image/png', bild: true, kalla: { id: 'fil', text: 'Fil från datorn' }, kroppsstalle: 'vänster underben', anteckningId: aid, registrerad: { av: 'Ingrid Moberg' }, status: 'journal' });
    expect(m.vardkontaktId).toBe(db.query("SELECT id FROM vardkontakter WHERE patient_id = 'md1'").get().id);
    expect(m.sha256).toHaveLength(64);
    const kam = ladda(db, { bild: { namn: 'kamera.jpg', data: JPEG }, kalla: 'kamera', kroppsstalle: 'vänster underben' }, efter(10));
    expect(kam).toMatchObject({ typ: 'image/jpeg', kalla: { text: 'Mobilens kamera' } });
    const f = bilder.fil(lak(db, 'md1', 'las_journal'), bilder.mediaRad(db, m.id));
    expect(f.headers.get('content-type')).toBe('image/png');
    expect(f.headers.get('content-security-policy')).toContain('sandbox');
    expect((await svarText(f)).toString('base64')).toBe(PNG);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ?").get(`media:${m.id}`).n).toBe(1);
  });

  test('jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem', () => {
    const db = sandlada();
    ny(db);
    ladda(db, { kroppsstalle: 'höger fot', tagen: efter(-14 * 24 * 60).toISOString() });
    ladda(db, { kroppsstalle: 'Höger fot', tagen: efter(-7 * 24 * 60).toISOString() });
    ladda(db, { kroppsstalle: 'höger fot' });
    ladda(db, { kroppsstalle: 'rygg' });
    const j = bilder.jamforelse(lak(db, 'md1', 'las_journal'), 'höger fot');
    expect(j.bilder.map(b => b.dagarFranForsta)).toEqual([0, 7, 14]);
    expect(j.text).toBe('3 bilder av höger fot över 14 dagar.');
    expect(bilder.forPatient(lak(db, 'md1', 'las_journal'), BAS).kroppsstallen).toEqual(['höger fot', 'rygg']);
  });

  test('en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen', () => {
    const db = sandlada();
    ny(db);
    const rid = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, prioritet, svar_senast, status, skickad_tid)
      VALUES ('md1', 'vc-tybble', 'kkoga-ort', 'lak-vc', 'Bedömning av höftled', 'normal', '2026-12-01', 'skickad', ?)`).run(BAS.toISOString()).lastInsertRowid);
    const bild = sparaBilaga(db, { remissId: rid, patientId: 'md1', bilaga: { namn: 'rontgen.png', typ: 'image/png', buf: Buffer.from(PNG, 'base64') }, av: 'lak-vc' });
    const text = sparaBilaga(db, { remissId: rid, patientId: 'md1', bilaga: { namn: 'not.txt', typ: 'text/plain', buf: Buffer.from('text') }, av: 'lak-vc' });
    const m = bilder.franRemissbilaga(lak(db), bild.id, { kroppsstalle: 'höger höft' }, BAS);
    expect(m).toMatchObject({ kalla: { id: 'remissbilaga', text: 'Bilaga till remiss' }, beskrivning: `Bilaga till remiss ${rid}`, kroppsstalle: 'höger höft', namn: 'rontgen.png' });
    expect(() => bilder.franRemissbilaga(lak(db), bild.id, {}, BAS)).toThrow('finns redan i journalen');
    expect(() => bilder.franRemissbilaga(lak(db), text.id, {}, BAS)).toThrow('Textbilagor finns kvar i remissen');
    ny(db, 'md2');
    expect(() => bilder.franRemissbilaga(lak(db, 'md2'), bild.id, {}, BAS)).toThrow('Bilagan finns inte');
  });

  test('patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning', () => {
    const db = sandlada();
    const p = ny(db);
    db.query('INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES (?, ?, ?, ?, ?, ?)').run('inv-md1', p.personnummer, p.fornamn, p.efternamn, p.fodd, 'md1');
    const inv = () => { const a = new InvanareAtkomst(db, db.query("SELECT * FROM invanare WHERE id = 'inv-md1'").get(), 'md1'); a.krav('min:bild'); return a; };
    expect(bilder.minMottagare(inv())).toEqual([{ id: 'kkoga-ort', namn: 'Ortopediska kliniken Karlskoga lasarett' }]);
    expect(() => bilder.minLaddaUpp(inv(), { enhetId: 'uso-kard', bild: { namn: 'sar.png', data: PNG } }, BAS)).toThrow('där du har kontakt');
    const u = bilder.minLaddaUpp(inv(), { enhetId: 'kkoga-ort', bild: { namn: 'sar.png', data: PNG }, beskrivning: 'Såret ser rött ut i dag' }, BAS);
    expect(u.text).toBe('Bilden är skickad till Ortopediska kliniken Karlskoga lasarett. Den kommer in i din journal när vården har granskat den.');
    expect(bilder.forPatient(lak(db, 'md1', 'las_journal'), BAS).bilder).toEqual([]);
    const v = bilder.vantande(db, pers(db, 'ssk-kkoga'), () => ({}));
    expect(v.bilder.map(b => [b.patient.id, b.kalla.id, b.registrerad.av])).toEqual([['md1', 'min_journal', 'Patienten via Min journal']]);
    expect(bilder.vantande(db, pers(db, 'lak-kard'), () => ({})).bilder).toEqual([]);
    const g = bilder.granska(lak(db), bilder.mediaRad(db, u.id), { kroppsstalle: 'vänster knä' }, efter(30));
    expect(g).toMatchObject({ status: 'journal', kroppsstalle: 'vänster knä', kalla: { text: 'Patientens uppladdning i Min journal' } });
    expect(bilder.forPatient(lak(db, 'md1', 'las_journal'), BAS).bilder.map(b => b.id)).toEqual([u.id]);
    for (let i = 0; i < bilder.MAX_VANTANDE; i++) bilder.minLaddaUpp(inv(), { enhetId: 'kkoga-ort', bild: { namn: `b${i}.png`, data: PNG } }, BAS);
    expect(() => bilder.minLaddaUpp(inv(), { enhetId: 'kkoga-ort', bild: { namn: 'en till.png', data: PNG } }, BAS)).toThrow('inte har granskat');
  });

  test('multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning', async () => {
    const db = sandlada();
    ny(db);
    expect(() => bilder.bestallUndersokning(lak(db, 'md1', 'remittera'), { undersokning: 'hoftled' }, BAS)).toThrow('frågeställningen');
    const s = bilder.bestallUndersokning(lak(db, 'md1', 'remittera'), { undersokning: 'hoftled', fragestallning: 'Artros i höger höft?' }, BAS);
    expect(s).toMatchObject({ undersokning: 'Röntgen höftled', modalitet: 'DX', status: 'bestalld', bildlank: null, simulerat: true });
    expect(() => bilder.visaStudie(lak(db, 'md1', 'las_journal'), bilder.studieRad(db, s.id), efter(10))).toThrow('inte svarat');
    const r = bilder.forPatient(lak(db, 'md1', 'las_journal'), efter(31)).studier[0];
    expect(r).toMatchObject({ status: 'besvarad', utlatande: 'Simulerat utlåtande: Lätt minskad ledspringa. Ingen fraktur.', antalBilder: 3, bildlank: `/api/media/studie/${s.id}/visa` });
    expect(r.uid).toBe(`1.3.6.1.4.1.32473.1.9.${s.id}`);
    const v = bilder.visaStudie(lak(db, 'md1', 'las_journal'), bilder.studieRad(db, s.id), efter(31));
    expect(v.headers.get('content-type')).toBe('image/svg+xml');
    expect((await svarText(v)).toString()).toContain('Röntgen höftled (simulerad bild)');
    expect(db.query('SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ?').get(`media:studie:${s.id}`).n).toBe(1);
  });

  test('behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder', () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('md1', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Vård')").run(BAS.toISOString());
    const m = ladda(db, { kroppsstalle: 'höger fot' });
    ladda(db, { kroppsstalle: 'höger fot' }, BAS, 'ssk-kkoga');
    const las = (roll, val = {}) => bilder.forPatient(atk(db, roll, 'md1', 'las_journal', val), BAS);
    expect(las('lak-kard').bilder).toEqual([]);
    expect(() => bilder.fil(atk(db, 'lak-kard', 'md1', 'las_journal'), bilder.mediaRad(db, m.id))).toThrow('aktivt val');
    expect(las('lak-kard', { andra_enheter: true }).bilder.length).toBe(2);
    expect(las('usk-kard', { andra_enheter: true }).bilder.map(b => b.registrerad.av)).toEqual(['Tove Ahlström']);
    const utan = JSON.stringify(las('lak-kard'));
    sparr(db, 'md1', 'kkoga-ort');
    const r = las('lak-kard', { andra_enheter: true });
    expect(r.bilder).toEqual([]);
    expect(JSON.stringify(r)).toBe(utan);
    expect(() => bilder.fil(atk(db, 'lak-kard', 'md1', 'las_journal', { andra_enheter: true }), bilder.mediaRad(db, m.id))).toThrow('spärrade');
  });

  test('taket: en patient har högst 40 bilder och en fil högst 200 kB i demon', () => {
    const db = sandlada();
    ny(db);
    const stor = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(bilder.MAX_BYTE)]).toString('base64');
    expect(() => ladda(db, { bild: { namn: 'stor.png', data: stor } })).toThrow('högst 200 kB');
    for (let i = 0; i < bilder.MAX_PER_PATIENT; i++) ladda(db, {});
    expect(() => ladda(db, {})).toThrow('redan 40 bilder');
  });

  test('säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient', () => {
    const db = sandlada();
    ny(db); ny(db, 'md2');
    const m = bilder.mediaRad(db, ladda(db, {}).id);
    const s = bilder.studieRad(db, bilder.bestallUndersokning(lak(db, 'md1', 'remittera'), { undersokning: 'lungrontgen', fragestallning: 'Pneumoni?' }, BAS).id);
    const A = (h) => atk(db, 'lak-kkoga', 'md2', h);
    for (const f of [() => bilder.fil(A('las_journal'), m), () => bilder.granska(A('skriv_journal'), m, {}, BAS), () => bilder.visaStudie(A('las_journal'), s, efter(60))]) {
      try { f(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'md2' AND resurs LIKE 'media:%'").get().n).toBe(0);
  });
});
