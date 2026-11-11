// Runda 12, r1: undantag för en enskild anteckning (undantag.js, Sussa 12.1.1.10). Samma prövning för visning, FHIR,
// publiceringen och producenten för tjänstekontrakt, prövad efter behörighetsmotorn. Testerna lägger in sina egna
// anteckningar och räknar bara dem.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, datumAv } from '../src/db.js';
import * as undantag from '../src/undantag.js';
import * as journal from '../src/journal.js';
import * as journalsok from '../src/journalsok.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const sysf = (db) => personal(db, 'sysf');
const sysf2 = (db) => personal(db, 'sysf-2');
const TEXT = 'Uppgift om en anhörigs sjukdom som inte ska visas';
const undanta = (db, nu, inp) => {
  const { andring } = undantag.foresla(db, sysf(db), { giltigFran: datumAv(nu), motivering: 'Felaktigt förd uppgift om en anhörig.', ...inp }, nu);
  return undantag.godkann(db, sysf2(db), andring.id, {}, nu).andring;
};
// En signerad anteckning utan pågående vårdkontakt, skriven av testet.
const egenAnteckning = (db, pers = 'lak-kard', patient = 'p01', text = TEXT) => {
  const a = journal.skapaAnteckning(atk(db, pers, patient), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text }] });
  journal.signera(atk(db, pers, patient), journal.hamtaAnteckningRad(db, a.id));
  return a.id;
};
const fraga = (pnr) => ({ patientId: { id: pnr, type: '1.2.752.129.2.1.3.1' } });

describe('Undantag av en enskild anteckning', () => {
  test('en enskild anteckning undantas från visning med fyra ögon, och journalen, sökningen och direktläsningen visar den inte', () => {
    const db = byggSeed();
    const nu = new Date();
    const id = egenAnteckning(db);
    const andra = journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).anteckningar.filter(a => a.typ === 'Daganteckning').length;
    const f = undantag.forhandsvisa(db, sysf(db), { omfang: 'anteckning', varde: String(id), kanaler: ['visning'] }, nu);
    expect(f.ok).toBe(true);
    expect(f.effekt[0]).toContain(`Daganteckning från`);
    expect(JSON.stringify(f)).not.toContain(TEXT);
    expect(JSON.stringify(f)).not.toContain('Gunnar');
    const { andring } = undantag.foresla(db, sysf(db), { omfang: 'anteckning', varde: String(id), kanaler: ['visning'], giltigFran: datumAv(nu), motivering: 'Prov.' }, nu);
    expect(fel(() => undantag.godkann(db, sysf(db), andring.id, {}, nu)).message).toContain('Fyra ögon');
    undantag.godkann(db, sysf2(db), andring.id, {}, nu);
    const l = journal.listaAnteckningar(atk(db, 'lak-kard', 'p01'));
    expect(l.anteckningar.some(a => a.id === id)).toBe(false);
    // De andra anteckningarna av samma typ visas som förut.
    expect(l.anteckningar.filter(a => a.typ === 'Daganteckning').length).toBe(andra - 1);
    expect(l.dolda.undantagna).toEqual([{ antal: 1, sort: 'anteckning', text: `1 anteckning visas inte. Systemförvaltningen har undantagit den från visning från ${datumAv(nu)}: Prov.` }]);
    expect(JSON.stringify(l)).not.toContain(TEXT);
    expect(fel(() => journal.hamtaAnteckning(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, id))).message).toContain('undantagit den från visning');
    expect(JSON.stringify(journalsok.sok(atk(db, 'lak-kard', 'p01'), 'anhörigs sjukdom'))).not.toContain(TEXT);
  });

  test('en rättelse av en undantagen anteckning är också undantagen, och ett undantag på en anteckning i pågående vård stoppas', () => {
    const db = byggSeed();
    const nu = new Date();
    const id = egenAnteckning(db);
    undanta(db, nu, { omfang: 'anteckning', varde: String(id), kanaler: ['visning'] });
    // Författaren rättar anteckningen direkt i databasen som en ny version, som rättelsen gör.
    const r = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, ersatter_id, rattelse_orsak, version)
      SELECT patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, id, 'Prov', 2 FROM anteckningar WHERE id = ?`).run(id);
    expect(journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).anteckningar.some(a => a.id === Number(r.lastInsertRowid))).toBe(false);
    // En anteckning i en pågående vårdkontakt kan inte döljas i systemet, men undantas från FHIR och nationella tjänster.
    const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND slut IS NULL LIMIT 1").get();
    expect(vk).not.toBeNull();
    const b = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', vardkontaktId: vk.id, sokord: [{ sokord: 'Aktuellt', text: 'x' }] });
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, b.id));
    expect(undantag.prova(db, { omfang: 'anteckning', varde: String(b.id), kanaler: ['visning'] }).varfor).toContain('pågående vårdkontakt');
    expect(undantag.prova(db, { omfang: 'anteckning', varde: String(b.id), kanaler: ['fhir', 'nationell'] }).ok).toBe(true);
    // Ett utkast, ett nummer som inte finns och text i stället för ett nummer stoppas med samma svar.
    const utkast = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'x' }] });
    for (const v of [String(utkast.id), '999999', 'constructor']) expect(undantag.prova(db, { omfang: 'anteckning', varde: v, kanaler: ['visning'] }).varfor).toBe('Det finns ingen signerad anteckning med det numret. Numret står i ärendet från vården.');
  });

  test('ett undantag på en spärrad vårdenhets anteckning röjer inget: svaret är detsamma med och utan undantaget', () => {
    const db = byggSeed();
    const nu = new Date();
    // p04 har spärrade anteckningar på psykiatrin, som läkaren på kardiologen inte får se.
    // En egen signerad anteckning på den spärrade vårdenheten, utan vårdkontakt.
    const enhet = db.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p04' LIMIT 1").get().enhet_id;
    const sparrad = { id: Number(db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
      VALUES ('p04', ?, 'Mottagningsanteckning', 'lakare', '[]', 'lak-med', '2026-01-01T10:00:00Z', 'signerad', '2026-01-01T10:05:00Z', 'lak-med')`).run(enhet).lastInsertRowid) };
    const fore = JSON.stringify(journal.listaAnteckningar(atk(db, 'lak-kard', 'p04')));
    undanta(db, nu, { omfang: 'anteckning', varde: String(sparrad.id), kanaler: ['visning', 'fhir', 'nationell'] });
    expect(JSON.stringify(journal.listaAnteckningar(atk(db, 'lak-kard', 'p04')))).toBe(fore);
  });

  test('FHIR, publiceringen och producenten för tjänstekontrakt prövar samma undantag, och Min journal visar anteckningen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const nu = new Date();
    const id = egenAnteckning(db);
    const fhirFore = (await k.get('/fhir/Composition?patient=p01')).data.entry.map(e => e.resource.id);
    expect(fhirFore).toContain(String(id));
    const pubFore = undantag.publicering(db, nu)[0];
    // Bara från nationella tjänster: FHIR lämnar ut den, men publiceringen och producenten gör det inte.
    undanta(db, nu, { omfang: 'anteckning', varde: String(id), kanaler: ['nationell'] });
    expect((await k.get('/fhir/Composition?patient=p01')).data.entry.map(e => e.resource.id)).toContain(String(id));
    expect(undantag.publicering(db, nu)[0]).toEqual({ ...pubFore, antal: pubFore.antal - 1, undantagna: pubFore.undantagna + 1 });
    const riv = (await k.post('/api/riv/GetCareDocumentation', fraga('194502024732'))).data.careDocumentation;
    expect(riv.some(x => x.header.documentId === `Composition/${id}`)).toBe(false);
    expect(JSON.stringify(riv)).not.toContain(TEXT);
    // En klient kan inte använda kontraktets parameter för att få ut något som är undantaget från FHIR.
    const id2 = egenAnteckning(db, 'lak-kard', 'p01', 'Andra uppgiften som undantas från FHIR');
    undanta(db, nu, { omfang: 'anteckning', varde: String(id2), kanaler: ['fhir'] });
    expect((await k.get('/fhir/Composition?patient=p01&_kontrakt=GetCareDocumentation')).data.entry.map(e => e.resource.id)).not.toContain(String(id2));
    expect((await k.get(`/fhir/Composition/${id2}`)).status).toBe(404);
    expect((await k.get(`/fhir/Composition/${id2}?_kontrakt=GetCareDocumentation`)).status).toBe(404);
    // I systemet visas båda, eftersom bara FHIR och nationella tjänster är undantagna.
    expect((await k.get('/api/patient/p01/anteckningar')).data.anteckningar.map(a => a.id)).toEqual(expect.arrayContaining([id, id2]));
    // Min journal följer vårdgivarens visningsregler och påverkas aldrig av ett undantag.
    undanta(db, nu, { omfang: 'anteckning', varde: String(id), kanaler: ['visning', 'nationell'] });
    const m = klient(app);
    await m.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const fore = (await m.get('/api/min/journal/p01/anteckningar')).data;
    const db2 = sandlada(app, m).db;
    const egen = egenAnteckning(db2);
    const utan = JSON.stringify((await m.get('/api/min/journal/p01/anteckningar')).data);
    undanta(db2, nu, { omfang: 'anteckning', varde: String(egen), kanaler: ['visning', 'fhir', 'nationell'] });
    expect(JSON.stringify((await m.get('/api/min/journal/p01/anteckningar')).data)).toBe(utan);
    expect(fore).toBeDefined();
  });
});
