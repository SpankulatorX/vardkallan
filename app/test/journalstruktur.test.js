// Runda 12, r1: journalens struktur utan programmerare (journalstruktur.js, Sussa 12.1.1.7 och vårt D11). Mallar,
// sökord, mätvärdestyper, vårdgivarens ramar och vårdenheternas lokala anpassningar som versionerade förslag med fyra
// ögon. Testerna räknar bara de rader de själva har skapat och beror inte på klockan.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed } from '../src/db.js';
import { vardenhetFor } from '../src/atkomst.js';
import * as struktur from '../src/journalstruktur.js';
import * as journal from '../src/journal.js';
import * as fhir from '../src/fhir.js';
import * as sakerhetslogg from '../src/sakerhetslogg.js';
import { verifiera } from '../src/logg.js';
import { verhoeffGiltig } from '../src/fackssprak.js';
import * as mallbyggare from '../src/lakemedelsmallbyggare.js';
import * as mallgodkannande from '../src/mallgodkannande.js';
import { atk, personal, testserver, klient, sandlada, somPerson } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const sysf = (db) => personal(db, 'sysf');
const sysf2 = (db) => personal(db, 'sysf-2');
// En kod i Snomed CT för ett nytt sökord: Family history with explicit context.
const FAMILJ = { code: '57177007', display: 'Family history with explicit context' };
const MALL = { typ: 'Smärtmottagningens bedömning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Smärta', 'Ärftlighet', 'Bedömning', 'Åtgärd'], nyaSokord: { 'Ärftlighet': FAMILJ } };
const MIDJA = { namn: 'Midjemått', kodverk: 'loinc', kod: '8280-0', ucum: 'cm', min: 30, max: 250 };
const FERRITIN = { namn: 'Ferritin', kodverk: 'npu', kod: 'NPU19763', ucum: 'ug/L', min: 0, max: 100000, heltal: true };
// Föreslås av den ena systemförvaltaren och godkänns av den andra.
const infor = (db, slag, definition, nyckel = null) => {
  const { version } = struktur.foresla(db, sysf(db), { slag, nyckel, definition, motivering: 'Prov.' });
  return struktur.godkann(db, sysf2(db), version.id).version;
};
const patientuppgifter = (db, svar) => {
  const t = JSON.stringify(svar);
  for (const p of db.query('SELECT fornamn, efternamn, personnummer FROM patienter').all()) {
    expect(t.includes(`${p.fornamn} ${p.efternamn}`)).toBe(false);
    expect(t.includes(p.personnummer)).toBe(false);
  }
};

describe('Journalens struktur', () => {
  test('mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen', () => {
    const db = byggSeed();
    expect(verhoeffGiltig(FAMILJ.code)).toBe(true);
    const { version, paverkas } = struktur.foresla(db, sysf(db), { slag: 'mall', definition: MALL, motivering: 'Smärtmottagningen behöver en egen mall.' });
    expect(version).toMatchObject({ slag: 'mall', version: 1, status: 'vantar', foreslagenAv: 'Tomas Lindh' });
    expect(paverkas.join(' ')).toContain('blir valbar i anteckningsformuläret för läkarna');
    expect(paverkas.join(' ')).toContain('Sökordet Ärftlighet läggs till i delmängden med Snomed CT 57177007');
    // Innan godkännandet finns mallen inte i journalen.
    expect(fel(() => journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'NRS 6.' }] })).message).toBe('Okänd anteckningstyp.');
    expect(fel(() => struktur.godkann(db, sysf(db), version.id)).message).toContain('Fyra ögon');
    expect(struktur.godkann(db, sysf2(db), version.id).version).toMatchObject({ status: 'godkand', beslutadAv: 'Nora Ekholm' });
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'NRS 6.' }, { sokord: 'Ärftlighet', text: 'Modern hade migrän.' }] });
    expect(a).toMatchObject({ typ: MALL.typ, kategori: 'lakare', status: 'utkast' });
    expect(journal.kategoriFor(db, MALL.typ)).toBe('lakare');
    // En undersköterska skriver inte i läkarnas dokumentation.
    expect(fel(() => journal.skapaAnteckning(atk(db, 'usk-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'x' }] }))?.status).toBe(403);
    const mallar = struktur.mallarFor(db, personal(db, 'lak-kard'), []);
    expect(mallar.find(m => m.typ === MALL.typ).sokord).toEqual(MALL.sokord);
  });

  test('mall: systemet sätter koden för ett känt sökord, kontrollerar Snomed CT:s kontrollsiffra och stoppar en kod som redan har ett annat namn', () => {
    const db = byggSeed();
    const f = (definition) => struktur.forhandsvisa(db, sysf(db), { slag: 'mall', definition });
    // Bedömning finns i delmängden, så ingen kod behövs.
    expect(f({ ...MALL, sokord: ['bedömning', 'Smärta'], nyaSokord: {} })).toMatchObject({ ok: true, definition: { sokord: ['Bedömning', 'Smärta'] } });
    expect(f({ ...MALL, sokord: ['Ärftlighet'], nyaSokord: {} }).fel[0]).toContain('Ärftlighet finns inte i Vårdkällans delmängd av Snomed CT');
    expect(f({ ...MALL, nyaSokord: { 'Ärftlighet': { code: '57177008', display: 'x y z' } } }).fel.join(' ')).toContain('Kontrollsiffran i 57177008 stämmer inte');
    expect(f({ ...MALL, nyaSokord: { 'Ärftlighet': { code: '424836000', display: 'Assessment section' } } }).fel.join(' ')).toContain('Koden 424836000 används redan för sökordet Bedömning');
    expect(f({ ...MALL, nyaSokord: { 'Ärftlighet': { ingen: 'kort' } } }).fel.join(' ')).toContain('förklara med minst 20 tecken');
    expect(f({ ...MALL, nyaSokord: { 'Ärftlighet': { ingen: 'Sökordet samlar uppgifter om sjukdomar i släkten.' } } }).ok).toBe(true);
    expect(f({ ...MALL, typ: 'Epikris' }).fel[0]).toContain('är en av journalens inbyggda mallar');
    expect(f({ ...MALL, kategori: 'ekonomi' }).fel[0]).toContain('läkarnas dokumentation eller till omvårdnadsdokumentationen');
    expect(f({ ...MALL, sokord: ['Smärta', 'smärta'] }).fel[0]).toContain('finns två gånger');
    expect(f({ ...MALL, typkod: { code: '371530004', display: 'Clinical consultation report' } }).ok).toBe(true);
  });

  test('mall: FHIR lämnar ut anteckningen med anteckningstypens och sökordens koder', () => {
    const db = byggSeed();
    infor(db, 'mall', { ...MALL, typkod: { code: '371530004', display: 'Clinical consultation report' } });
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'NRS 6.' }, { sokord: 'Ärftlighet', text: 'Modern hade migrän.' }] });
    const c = fhir.composition(db, db.query('SELECT * FROM anteckningar WHERE id = ?').get(a.id));
    expect(c.type).toEqual({ coding: [{ system: 'http://snomed.info/sct', code: '371530004', display: 'Clinical consultation report' }], text: MALL.typ });
    expect(c.section[0].code.coding[0]).toMatchObject({ code: '22253000' });
    expect(c.section[1].code.coding[0]).toEqual({ system: 'http://snomed.info/sct', ...FAMILJ });
    // En inbyggd anteckningstyp har som förut bara text.
    const d = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'x' }] });
    expect(fhir.composition(db, db.query('SELECT * FROM anteckningar WHERE id = ?').get(d.id)).type).toEqual({ text: 'Daganteckning' });
  });

  test('mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte', () => {
    const db = byggSeed();
    infor(db, 'mall', MALL);
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'NRS 6.' }] });
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id));
    const ny = { ...MALL, sokord: ['Kontaktorsak', 'Smärta', 'Bedömning', 'Uppföljning'] };
    const f = struktur.forhandsvisa(db, sysf(db), { slag: 'mall', nyckel: MALL.typ, definition: ny });
    expect(f.ok).toBe(true);
    expect(f.paverkas).toEqual(expect.arrayContaining(['Nya sökord i mallen: Uppföljning.', 'Tas bort ur mallen: Ärftlighet, Åtgärd.', '1 signerad anteckning av typen ändras inte. De visar sina sökord som när de skrevs.']));
    expect(struktur.forhandsvisa(db, sysf(db), { slag: 'mall', nyckel: MALL.typ, definition: MALL }).fel[0]).toContain('samma som den version som gäller');
    const v2 = infor(db, 'mall', ny, MALL.typ);
    expect(v2.version).toBe(2);
    expect(struktur.mallFor(db, MALL.typ).sokord).toEqual(ny.sokord);
    expect(JSON.parse(journal.hamtaAnteckningRad(db, a.id).sokord)).toEqual([{ sokord: 'Smärta', text: 'NRS 6.' }]);
    // Sökordet Ärftlighet finns inte längre i någon godkänd mall och har därför ingen kod.
    expect(struktur.sokordKod(db, 'Ärftlighet')).toBeNull();
  });

  test('mattyp: en ny mätvärdestyp kontrolleras mot NPU, LOINC och UCUM, och en kod som redan används stoppas', () => {
    const db = byggSeed();
    const f = (definition) => struktur.forhandsvisa(db, sysf(db), { slag: 'mattyp', definition });
    expect(struktur.loincGiltig('8867-4')).toBe(true);
    expect(struktur.loincGiltig('2708-6')).toBe(true);
    expect(struktur.loincGiltig('8280-1')).toBe(false);
    for (const u of ['cm', 'ug/L', '10*9/L', 'mm[Hg]', '/min', 'mL/min/{1.73_m2}', 'kg/m2', '{score}']) expect(struktur.ucumGiltig(u)).toBe(true);
    for (const u of ['liter', 'mmol/liter', 'cm cm', '', 'kg//m']) expect(struktur.ucumGiltig(u)).toBe(false);
    const m = f(MIDJA);
    expect(m).toMatchObject({ ok: true, nyckel: 'egen_midjematt', definition: { enhet: 'cm', kategori: 'exam', system: 'http://loinc.org' } });
    expect(f(FERRITIN).definition).toMatchObject({ enhet: 'µg/L', kategori: 'laboratory', system: 'http://npu-terminology.org' });
    expect(f({ ...MIDJA, kod: '8280-1' }).fel[0]).toContain('Kontrollsiffran i 8280-1 stämmer inte');
    expect(f({ ...FERRITIN, kod: 'NPU1976' }).fel[0]).toContain('NPU och fem siffror');
    expect(f({ ...FERRITIN, kod: 'NPU19748' }).fel[0]).toBe('Koden NPU19748 används redan för CRP. Använd den mätvärdestypen, så att samma mätning inte får två namn.');
    // Runda 13, r4 (E3-25): koden för det systoliska trycket hör till det inbyggda blodtrycket och kan inte bli en egen typ.
    expect(f({ ...MIDJA, namn: 'Övertryck', kod: '8480-6', ucum: 'mm[Hg]', min: 40, max: 300 }).fel).toContain('Koden 8480-6 används redan för Blodtryck (det systoliska trycket). Använd den mätvärdestypen, så att samma mätning inte får två namn.');
    expect(f({ ...MIDJA, ucum: 'centimeter' }).fel[0]).toContain('är inte en enhet i UCUM');
    expect(f({ ...MIDJA, min: 300 }).fel[0]).toContain('lägsta rimliga värdet måste vara lägre');
    expect(f({ ...MIDJA, min: '' }).fel[0]).toContain('Ange det lägsta och det högsta rimliga värdet');
    expect(f({ ...MIDJA, namn: 'puls' }).fel[0]).toContain('Mätvärdestypen Puls finns redan');
    expect(f({ ...MIDJA, kodverk: 'icd' }).fel[0]).toContain('Välj NPU');
  });

  test('mattyp: efter godkännandet går den att registrera inom de rimliga värdena, och FHIR lämnar ut den med kod och UCUM', () => {
    const db = byggSeed();
    const v = infor(db, 'mattyp', FERRITIN);
    expect(v.nyckel).toBe('egen_ferritin');
    const a = atk(db, 'lak-kard', 'p01');
    expect(fel(() => journal.registreraMatvarde(a, { typ: 'egen_ferritin', varde: 200000 })).message).toBe('Ferritin måste vara ett tal mellan 0 och 100000.');
    expect(fel(() => journal.registreraMatvarde(a, { typ: 'egen_ferritin', varde: '12,5' })).message).toContain('heltal');
    const m = journal.registreraMatvarde(a, { typ: 'egen_ferritin', varde: '85' });
    expect(m).toMatchObject({ typ: 'egen_ferritin', namn: 'Ferritin', varde: 85, enhet: 'µg/L' });
    expect(journal.listaMatvarden(atk(db, 'lak-kard', 'p01')).matvarden.find(x => x.id === m.id).namn).toBe('Ferritin');
    const o = fhir.observation(db, db.query('SELECT * FROM matvarden WHERE id = ?').get(m.id));
    expect(o.code).toEqual({ coding: [{ system: 'http://npu-terminology.org', code: 'NPU19763' }], text: 'Ferritin' });
    expect(o.category[0].coding[0].code).toBe('laboratory');
    expect(o.valueQuantity).toEqual({ value: 85, unit: 'µg/L', system: 'http://unitsofmeasure.org', code: 'ug/L' });
    // En typ som inte är godkänd, eller ett namn som bara liknar ett id, går inte att registrera.
    expect(fel(() => journal.registreraMatvarde(a, { typ: 'egen_midjematt', varde: 90 })).message).toBe('Okänd typ av mätvärde.');
    expect(fel(() => journal.registreraMatvarde(a, { typ: 'constructor', varde: 90 })).message).toBe('Okänd typ av mätvärde.');
  });

  test('mattyp: koden och enheten kan inte ändras när värden finns, men gränserna kan', () => {
    const db = byggSeed();
    infor(db, 'mattyp', MIDJA);
    journal.registreraMatvarde(atk(db, 'lak-kard', 'p01'), { typ: 'egen_midjematt', varde: 92 });
    const f = struktur.forhandsvisa(db, sysf(db), { slag: 'mattyp', nyckel: 'egen_midjematt', definition: { ...MIDJA, ucum: 'm' } });
    expect(f.fel[0]).toContain('Koden och enheten kan inte ändras');
    const g = struktur.forhandsvisa(db, sysf(db), { slag: 'mattyp', nyckel: 'egen_midjematt', definition: { ...MIDJA, max: 200 } });
    expect(g.ok).toBe(true);
    expect(g.paverkas).toContain('1 registrerat värde står kvar som de registrerades.');
  });

  test('fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas', () => {
    const db = byggSeed();
    const v = infor(db, 'mattyp', MIDJA);
    expect(() => db.query("UPDATE struktur_versioner SET definition = '{}' WHERE id = ?").run(v.id)).toThrow('ändras inte');
    expect(() => db.query('DELETE FROM struktur_versioner WHERE id = ?').run(v.id)).toThrow('raderas inte');
    expect(() => db.query(`INSERT INTO struktur_versioner (slag, nyckel, version, definition, motivering, foreslagen_av, foreslagen, status, beslutad_av)
      VALUES ('mattyp', 'egen_x', 1, '{}', 'Prov.', 'sysf', '2026-01-01', 'godkand', 'sysf')`).run()).toThrow();
    // Två förslag på samma mall: det andra stoppas tills det första är beslutat.
    struktur.foresla(db, sysf(db), { slag: 'mall', definition: MALL, motivering: 'Prov.' });
    expect(fel(() => struktur.foresla(db, sysf2(db), { slag: 'mall', definition: { ...MALL, sokord: ['Smärta'] }, motivering: 'Prov.' }))?.message).toContain('väntar på godkännande');
    const vantar = struktur.oversikt(db, sysf2(db)).attGodkanna[0];
    expect(fel(() => struktur.avsluta(db, sysf2(db), vantar.id, {})).message).toContain('Skriv varför');
    expect(struktur.avsluta(db, sysf(db), vantar.id, {}).version.status).toBe('aterkallad');
    // Ett förslag som bygger på något som har ändrats sedan det föreslogs godkänns inte.
    const { version: p } = struktur.foresla(db, sysf(db), { slag: 'mattyp', definition: FERRITIN, motivering: 'Prov.' });
    infor(db, 'mall', { ...MALL, typ: 'Ferritinkontroll', sokord: ['Aktuellt'], nyaSokord: {} });
    expect(struktur.godkann(db, sysf2(db), p.id).version.status).toBe('godkand');
    expect(sakerhetslogg.lista(db, { typ: 'andrad_installning' }).some(r => r.beskrivning.includes('Mätvärdestyp egen_midjematt version 1 godkänd'))).toBe(true);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'konfigurera' AND resurs LIKE 'journalstruktur:%' AND patient_id IS NULL").get().n).toBeGreaterThanOrEqual(8);
    expect(verifiera(db).hel).toBe(true);
  });

  test('behörighet: bara systemförvaltningen ändrar journalens struktur, och svaren innehåller inga patientuppgifter', () => {
    const db = byggSeed();
    for (const p of ['lak-kard', 'vch-kard', 'ssk-kard']) {
      const pers = personal(db, p);
      if (!pers) continue;
      expect(fel(() => struktur.oversikt(db, pers))?.status).toBe(403);
      expect(fel(() => struktur.foresla(db, pers, { slag: 'mall', definition: MALL, motivering: 'x' }))?.status).toBe(403);
    }
    infor(db, 'mall', MALL);
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: MALL.typ, sokord: [{ sokord: 'Smärta', text: 'x' }] }).id));
    const o = struktur.oversikt(db, sysf(db));
    patientuppgifter(db, o);
    patientuppgifter(db, struktur.forhandsvisa(db, sysf(db), { slag: 'mall', nyckel: MALL.typ, definition: { ...MALL, sokord: ['Smärta'] } }));
  });

  test('ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt', () => {
    const db = byggSeed();
    const f = (definition) => struktur.forhandsvisa(db, sysf(db), { slag: 'ram', definition });
    expect(f({ typ: 'Mottagningsanteckning', obligatoriska: ['Bedömning', 'Kontaktorsak'], lokalt: ['Smärta', 'Uppföljning'] })).toMatchObject({ ok: true, nyckel: 'Mottagningsanteckning',
      definition: { obligatoriska: ['Kontaktorsak', 'Bedömning'], lokalt: ['Smärta', 'Uppföljning'] } });
    expect(f({ typ: 'Mottagningsanteckning', obligatoriska: ['Smärta'], lokalt: [] }).fel[0]).toContain('Smärta finns inte i mallen Mottagningsanteckning');
    expect(f({ typ: 'Mottagningsanteckning', obligatoriska: [], lokalt: ['Bedömning'] }).fel[0]).toContain('finns redan i mallen');
    expect(f({ typ: 'Mottagningsanteckning', obligatoriska: [], lokalt: ['Påhittat sökord'] }).fel[0]).toContain('finns inte i delmängden');
    expect(f({ typ: 'Tobaksbruk', obligatoriska: [], lokalt: [] }).ok).toBe(false);
  });

  test('lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas', () => {
    const db = byggSeed();
    const enhet = vardenhetFor(db, personal(db, 'lak-kard').enhet_id);
    infor(db, 'ram', { typ: 'Mottagningsanteckning', obligatoriska: ['Bedömning'], lokalt: ['Smärta'] });
    const f = (sokord) => struktur.forhandsvisa(db, sysf(db), { slag: 'lokal', definition: { typ: 'Mottagningsanteckning', enhet, sokord } });
    expect(f(['Kontaktorsak', 'Status']).fel[0]).toContain('Bedömning måste finnas i mallen Mottagningsanteckning enligt vårdgivarens ram');
    expect(f(['Bedömning', 'Uppföljning']).fel[0]).toContain('Uppföljning får inte läggas till i mallen Mottagningsanteckning lokalt. Vårdgivarens ram tillåter Smärta');
    const ok = f(['Kontaktorsak', 'Smärta', 'Bedömning', 'Åtgärd']);
    expect(ok.ok).toBe(true);
    expect(ok.paverkas).toEqual(expect.arrayContaining(['Läggs till lokalt: Smärta.', 'Tas bort lokalt: Anamnes, Aktuellt, Status.']));
    infor(db, 'lokal', ok.definition);
    const lokala = struktur.mallarFor(db, personal(db, 'lak-kard'), journal.MALLAR).find(m => m.typ === 'Mottagningsanteckning');
    expect(lokala).toMatchObject({ sokord: ['Kontaktorsak', 'Smärta', 'Bedömning', 'Åtgärd'], lokal: { version: 1 } });
    // Vårdcentralen har en annan vårdenhet och får vårdgivarens mall.
    const vc = struktur.mallarFor(db, personal(db, 'lak-vc'), journal.MALLAR).find(m => m.typ === 'Mottagningsanteckning');
    expect(vc.sokord).toEqual(journal.MALLAR.find(m => m.typ === 'Mottagningsanteckning').sokord);
    expect(vc.lokal).toBeUndefined();
    // Runda 13, r3 (säkerhetsfynd 10): nyckeln räknas alltid ur definitionen. En nyckel för en vårdenhet med
    // definitionen för en annan, eller en ram med nyckeln för en annan mall, stoppas.
    const annan = struktur.forhandsvisa(db, sysf(db), { slag: 'lokal', nyckel: `Mottagningsanteckning|${enhet}`, definition: { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', sokord: ['Kontaktorsak', 'Smärta', 'Bedömning', 'Åtgärd'] } });
    expect(annan.ok).toBe(false);
    expect(annan.fel.join(' ')).toContain('stämmer inte med definitionen');
    expect(fel(() => struktur.foresla(db, sysf(db), { slag: 'lokal', nyckel: `Mottagningsanteckning|${enhet}`, definition: { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', sokord: ['Kontaktorsak', 'Bedömning'] }, motivering: 'Prov.' })).status).toBe(400);
    expect(struktur.forhandsvisa(db, sysf(db), { slag: 'ram', nyckel: 'Daganteckning', definition: { typ: 'Mottagningsanteckning', obligatoriska: [], lokalt: [] } }).fel.join(' ')).toContain('stämmer inte med definitionen');
  });

  test('ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns', () => {
    const db = byggSeed();
    const enhet = vardenhetFor(db, personal(db, 'lak-kard').enhet_id);
    infor(db, 'ram', { typ: 'Mottagningsanteckning', obligatoriska: [], lokalt: ['Smärta'] });
    infor(db, 'lokal', { typ: 'Mottagningsanteckning', enhet, sokord: ['Smärta', 'Bedömning'] });
    const f = struktur.forhandsvisa(db, sysf(db), { slag: 'ram', nyckel: 'Mottagningsanteckning', definition: { typ: 'Mottagningsanteckning', obligatoriska: ['Kontaktorsak'], lokalt: ['Smärta'] } });
    expect(f.paverkas.join(' ')).toContain('den lokala anpassningen ryms inte i den nya ramen och slutar gälla. Kontaktorsak måste finnas');
    infor(db, 'ram', f.definition, 'Mottagningsanteckning');
    const m = struktur.mallarFor(db, personal(db, 'lak-kard'), journal.MALLAR).find(x => x.typ === 'Mottagningsanteckning');
    expect(m.lokal).toBeUndefined();
    expect(struktur.oversikt(db, sysf(db)).mallar.find(x => x.typ === 'Mottagningsanteckning').lokala[0]).toMatchObject({ galler: false });
  });

  test('API: systemförvaltaren föreslår en mall och en mätvärdestyp, kollegan godkänner i sin egen inloggning, och konfigurationen stannar i sandlådan', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const f = await k.post('/api/journalstruktur/forhandsvisa', { slag: 'mattyp', definition: { ...MIDJA, kod: '8280-1' } });
    expect(f.status).toBe(200);
    expect(f.data.ok).toBe(false);
    expect((await k.post('/api/journalstruktur', { slag: 'mall', definition: MALL, motivering: 'Smärtmottagningen.' })).status).toBe(201);
    expect((await k.post('/api/journalstruktur', { slag: 'mattyp', definition: MIDJA, motivering: 'Uppföljning av vikt.' })).status).toBe(201);
    const o = (await k.get('/api/journalstruktur')).data;
    expect(o.mina.map(v => v.rubrik)).toEqual(expect.arrayContaining([MALL.typ, 'Midjemått']));
    expect(o.attGodkanna).toEqual([]);
    expect((await k.post(`/api/journalstruktur/${o.mina[0].id}/godkann`, {})).status).toBe(403);
    somPerson(sandlada(app, k), 'sysf-2');
    const o2 = (await k.get('/api/journalstruktur')).data;
    for (const v of o2.attGodkanna) expect((await k.post(`/api/journalstruktur/${v.id}/godkann`, {})).data.version.status).toBe('godkand');
    somPerson(sandlada(app, k), 'lak-kard');
    expect((await k.get('/api/mallar')).data.find(m => m.typ === MALL.typ)).toMatchObject({ kategori: 'lakare', egen: true });
    expect((await k.get('/api/mattyper')).data.mattyper.find(m => m.id === 'egen_midjematt')).toMatchObject({ namn: 'Midjemått', enhet: 'cm', egen: true });
    expect((await k.post('/api/journalstruktur', { slag: 'mall', definition: MALL, motivering: 'x' })).status).toBe(403);
    // En annan sandlåda har inte fått något.
    const k2 = klient(app);
    await k2.logga('lak-kard');
    expect((await k2.get('/api/mallar')).data.find(m => m.typ === MALL.typ)).toBeUndefined();
    expect((await k2.get('/api/mattyper')).data.mattyper.find(m => m.id === 'egen_midjematt')).toBeUndefined();
  });
});

// Runda 12, r1 (D11): läkemedelsmallar som läkaren bygger och ändrar i gränssnittet (lakemedelsmallbyggare.js).
describe('Läkemedelsmallar i gränssnittet', () => {
  test('en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den', () => {
    const db = byggSeed();
    const ul = personal(db, 'ul-kard');
    const s = mallbyggare.byggstenar(db, ul).substanser.find(x => x.forslag.dosEnhet === 'mg' && x.forslag.dosering);
    expect(s).toBeDefined();
    expect(s.harMall).toBe(false);
    const f = mallbyggare.forhandsvisa(db, ul, { atc: s.atc, ...s.forslag });
    expect(f.ok).toBe(true);
    expect(f.andringar.join(' ')).toContain('först när Sara Lindqvist har godkänt den');
    expect(mallbyggare.forhandsvisa(db, ul, { atc: s.atc, ...s.forslag, tider: '8' }).fel[0]).toContain('8 är inget klockslag');
    expect(mallbyggare.forhandsvisa(db, ul, { atc: s.atc, ...s.forslag, uppfoljning: 0 }).fel[0]).toContain('Uppföljningen anges i hela dagar');
    const ny = mallbyggare.skapa(db, ul, { atc: s.atc, ...s.forslag });
    expect(ny).toMatchObject({ version: 1, status: 'vantar' });
    expect(mallbyggare.forhandsvisa(db, ul, { atc: s.atc, dosering: '1 tablett på kvällen' }).andringar[0]).toContain('Doseringen ändras från');
    expect(fel(() => mallbyggare.skapa(db, ul, { atc: s.atc, ...s.forslag })).message).toContain('har redan en läkemedelsmall');
    // Innan godkännandet används mallen inte på vårdenheten.
    expect(mallgodkannande.substansmall(db, s.atc, 'uso-kard').mall).toBeNull();
    expect(mallgodkannande.attGodkanna(db, personal(db, 'lak-kard')).find(x => x.typ === 'substans' && x.id === String(ny.id))).toBeDefined();
    mallgodkannande.godkann(db, personal(db, 'lak-kard'), { typ: 'substans', id: ny.id });
    expect(mallgodkannande.substansmall(db, s.atc, 'uso-kard').mall).toMatchObject({ dosering: s.forslag.dosering, typ: 'staende' });
    // En sjuksköterska och en systemförvaltare bygger inga läkemedelsmallar.
    for (const p of ['ssk-kard', 'sysf']) expect(fel(() => mallbyggare.byggstenar(db, personal(db, p)))?.status).toBe(403);
  });

  test('API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    somPerson(sandlada(app, k), 'ul-kard');
    const lista = (await k.get('/api/lakemedelsmallar')).data;
    const atc = lista.substans[0].atc;
    const f = (await k.post('/api/lakemedelsmallar/forhandsvisa', { atc, uppfoljning: 21 })).data;
    expect(f.ok).toBe(true);
    expect(f.andringar[0]).toContain('Uppföljningen ändras från');
    const r = await k.post(`/api/lakemedelsmallar/${atc}/andra`, { uppfoljning: 21, andring: 'Längre till uppföljningen.' });
    expect(r.status).toBe(201);
    expect(r.data.text).toContain('först när Sara Lindqvist har godkänt den');
    expect((await k.get('/api/lakemedelsmallar')).data.substans.find(x => x.atc === atc).vantarVersion).toBe(r.data.version);
  });
});
