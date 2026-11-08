// Runda 10, r4: skannade restjournaler (Sussa 3.1.10.1 och 3.1.10.2). Pappersjournaler skannas in, systemet läser
// textlagret, föreslår dokumenttyp och period och kontrollerar identiteten, och dokumentet visas i kronologin med den
// övriga journalen och är sökbart. Testnamnen står i src/sussa/mappning/3.1.10.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { deflateSync } from 'node:zlib';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';
import { pdf } from '../src/filformat.js';
import * as restjournal from '../src/restjournal.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const b64 = (buf) => Buffer.from(buf).toString('base64');
// En skannad pappersjournal för Gunnar Åkesson (p01) med textlager, som en skanner med OCR ger.
const journalPdf = (extra = []) => pdf([
  { text: 'Journalanteckning, Medicinkliniken (pappersjournal)', fet: true },
  { text: 'Patient: Gunnar Åkesson 19450202-4732' },
  { text: '1998-03-14 Mottagningsbesök. Förmaksflimmer sedan ett år.' },
  { text: '2004-11-02 Daganteckning. Insatt på warfarin.' }, ...extra.map(text => ({ text })),
], { titel: 'Restjournal' });
// En PNG på en bildpunkt: en skannad bild utan text.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Skannade restjournaler', () => {
  test('systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret', async () => {
    const k = await inloggad('ssk-kard');
    const f = await k.post('/api/patient/p01/restjournaler/tolka', { fil: { namn: 'restjournal-1998.pdf', data: b64(journalPdf()) } });
    expect(f.status).toBe(200);
    expect(f.data).toMatchObject({ harText: true, dokumenttyp: 'journal', periodFran: '1998-03-14', periodTill: '2004-11-02', identitet: 'stammer', redanSkannad: false, typ: 'application/pdf' });
    expect(f.data.text).toBe('Personnumret i dokumentet är patientens.');
    // Ingenting sparas av tolkningen.
    expect(db(k).query('SELECT count(*) AS n FROM restjournaler').get().n).toBe(0);
    // Textlagret läses också när strömmen är komprimerad, som från de flesta skannrar.
    const strom = deflateSync(Buffer.from('BT /F1 11 Tf 50 790 Td (Epikris 2001-05-03) Tj ET', 'latin1'));
    const komp = Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${strom.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), strom, Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1')]);
    expect(restjournal.pdfText(komp)).toBe('Epikris 2001-05-03');
    expect(restjournal.forslag('Epikris 2001-05-03')).toMatchObject({ dokumenttyp: 'epikris', periodFran: '2001-05-03' });
    // Personnummer känns igen med och utan sekel, men ett datum är inget personnummer.
    expect(restjournal.personnummerI('Pat 450202-4732 och 19121212-1212, besök 2004-11-02')).toEqual(['4502024732', '1212121212']);
  });

  test('skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas', async () => {
    const k = await inloggad('ssk-kard');
    const data = b64(journalPdf());
    const r = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'restjournal-1998.pdf', data }, ursprung: 'Pappersjournal, Medicinkliniken USÖ' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ dokumenttyp: 'journal', dokumenttypText: 'Journalanteckningar', period: { fran: '1998-03-14', till: '2004-11-02', text: '1998-03-14 till 2004-11-02' },
      ursprung: 'Pappersjournal, Medicinkliniken USÖ', kallaEtikett: 'Skannad pappersjournal', harText: true, status: 'journal' });
    expect(r.data.skannad.av).toBe('Johan Ek');
    expect(r.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Samma fil en gång till stoppas.
    const igen = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'kopia.pdf', data } });
    expect(igen.status).toBe(409);
    expect(igen.data.fel).toContain('redan inskannad');
    // Dokumentet gäller patient 1 men patient 4 är öppen.
    const fel = await k.post('/api/patient/p04/restjournaler', { fil: { namn: 'restjournal-1998.pdf', data } });
    expect(fel.status).toBe(409);
    expect(fel.data.kod).toBe('annan_patient');
    expect(JSON.stringify(fel.data)).not.toContain('4732');
    expect((await k.post('/api/patient/p04/restjournaler/tolka', { fil: { namn: 'x.pdf', data } })).data.identitet).toBe('annan');
    // En bild utan text kräver att den som skannar bekräftar patienten.
    const bild = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'sida.png', data: b64(PNG) }, dokumenttyp: 'provsvar', periodFran: '1999-01-01', periodTill: '1999-12-31' });
    expect(bild.status).toBe(400);
    expect(bild.data.kod).toBe('bekrafta');
    const bild2 = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'sida.png', data: b64(PNG) }, dokumenttyp: 'provsvar', periodFran: '1999-01-01', periodTill: '1999-12-31', bekraftat: true });
    expect(bild2.status).toBe(201);
    expect(bild2.data).toMatchObject({ bild: true, harText: false, dokumenttypText: 'Provsvar' });
    expect(bild2.data.identitet).toContain('bekräftade');
    // Fel i metadata förklaras.
    const framtid = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'y.pdf', data: b64(journalPdf(['2001-01-01'])) }, periodFran: '2004-01-01', periodTill: '2003-01-01' });
    expect(framtid.status).toBe(400);
    expect(framtid.data.falt).toEqual(['periodFran', 'periodTill']);
    expect((await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'y.pdf', data: b64(journalPdf(['2001-01-01'])) }, dokumenttyp: 'constructor' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'y.txt', data: b64(Buffer.from('bara text')) }, bekraftat: true })).status).toBe(400);
    // Raderna ändras och raderas aldrig.
    expect(() => db(k).query("UPDATE restjournaler SET text = 'x'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM restjournaler').run()).toThrow();
  });

  test('restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas', async () => {
    const k = await inloggad('lak-kard');
    const r = (await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'restjournal.pdf', data: b64(journalPdf()) } })).data;
    const ov = (await k.get('/api/patient/p01/oversikt')).data;
    const rad = ov.tidslinje.find(t => t.typ === 'restjournal');
    expect(rad).toMatchObject({ tid: '2004-11-02', rubrik: 'Restjournal: Journalanteckningar', kallaEtikett: 'Skannad pappersjournal', ref: { typ: 'restjournal', id: r.id } });
    expect(rad.text).toContain('1998-03-14 till 2004-11-02');
    // I samma kronologi som migrerade poster och ny dokumentation.
    expect(ov.tidslinje.some(t => t.kallaEtikett?.startsWith('Migrerad från'))).toBe(true);
    expect(ov.tidslinje.some(t => t.typ === 'anteckning' && !t.kallaEtikett)).toBe(true);
    const i = ov.tidslinje.indexOf(rad);
    expect(ov.tidslinje.slice(0, i).every(t => String(t.tid) >= '2004-11-02')).toBe(true);
    // Listan och filen.
    const l = (await k.get('/api/patient/p01/restjournaler')).data;
    expect(l.dokument.map(d => d.id)).toContain(r.id);
    expect(l.kanLasa).toBe(true);
    const fil = await k.raw('GET', r.url);
    expect(fil.status).toBe(200);
    expect(fil.headers.get('content-type')).toBe('application/pdf');
    expect(fil.headers.get('content-security-policy')).toContain('sandbox');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE personal_id = 'lak-kard' AND patient_id = 'p01' AND resurs = ?").get(`restjournal:${r.id}`).n).toBe(1);
  });

  test('texten i restjournalen är sökbar i sökfältet i journalen', async () => {
    const k = await inloggad('lak-kard');
    await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'restjournal.pdf', data: b64(journalPdf(['2002-02-02 Pacemakerkontroll utan anmärkning.'])) } });
    const s = (await k.get('/api/patient/p01/sok?q=pacemakerkontroll')).data;
    const t = s.traffar.find(x => x.typ === 'restjournal');
    expect(t).toBeTruthy();
    expect(t.delar.some(d => d.markerad && d.text.toLowerCase() === 'pacemakerkontroll')).toBe(true);
    expect(t.ref).toMatchObject({ flik: 'restjournaler' });
  });

  test('vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas', async () => {
    const k = await inloggad('adm-kard');
    const r = await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'restjournal.pdf', data: b64(journalPdf()) } });
    expect(r.status).toBe(201);
    // Kvittot säger att skanningen är gjord, utan innehållet.
    expect(Object.keys(r.data).sort()).toEqual(['id', 'namn', 'sha256', 'skannad', 'status', 'storlek']);
    const l = (await k.get('/api/patient/p01/restjournaler')).data;
    expect(l).toMatchObject({ dokument: [], kanSkanna: true, kanLasa: false });
    expect((await k.raw('GET', `/api/restjournal/${r.data.id}/fil`)).status).toBe(404);
    // Undersköterskan läser inte journalen och skannar inte.
    somPerson(sandlada(app, k), 'usk-kard');
    expect((await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'a.pdf', data: b64(journalPdf(['x'])) } })).status).toBe(403);
    // Läkaren på akuten ser dokumentet efter aktivt val men makulerar det inte.
    somPerson(sandlada(app, k), 'lak-akut');
    expect((await k.get('/api/patient/p01/restjournaler')).data.dokument.length).toBe(0);
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    expect((await k.get('/api/patient/p01/restjournaler')).data.dokument.length).toBe(1);
    const mak = await k.post(`/api/restjournal/${r.data.id}/makulera`, { orsak: 'fel_patient' });
    expect(mak.status).toBe(403);
    // Utan vårdrelation är svaret detsamma som för ett dokument som inte finns.
    somPerson(sandlada(app, k), 'lak-psyk');
    const nej = await k.raw('GET', `/api/restjournal/${r.data.id}/fil`);
    expect(nej.status).toBe(404);
    expect(nej.data).toEqual((await k.raw('GET', '/api/restjournal/99999/fil')).data);
  });

  test('en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen', async () => {
    const k = await inloggad('lak-akut');
    const r = (await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'akut.pdf', data: b64(journalPdf(['HEMLIGTORD i akutens pappersjournal.'])) } })).data;
    db(k).query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p01', 'uso-akut', ?, 1)").run(new Date().toISOString());
    somPerson(sandlada(app, k), 'lak-kard');
    await k.post('/api/patient/p01/val', { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    const l = (await k.get('/api/patient/p01/restjournaler')).data;
    expect(JSON.stringify(l)).not.toContain('akut.pdf');
    expect(l.dolda.kraverVal).toBe(0);
    expect(JSON.stringify((await k.get('/api/patient/p01/oversikt')).data.tidslinje)).not.toMatch(/HEMLIGTORD|restjournal/i);
    const s = (await k.get('/api/patient/p01/sok?q=hemligtord')).data;
    expect(s.antal).toBe(0);
    expect(JSON.stringify(s)).not.toContain('HEMLIGTORD');
    expect((await k.raw('GET', `/api/restjournal/${r.id}/fil`)).status).toBe(404);
    // Samma fil på den spärrade vårdenheten nämns inte vid tolkningen och stoppar inte skanningen.
    const data = b64(journalPdf(['HEMLIGTORD i akutens pappersjournal.']));
    expect((await k.post('/api/patient/p01/restjournaler/tolka', { fil: { namn: 'x.pdf', data } })).data.redanSkannad).toBe(false);
    expect((await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'x.pdf', data } })).status).toBe(201);
  });

  test('ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin', async () => {
    const k = await inloggad('ssk-kard');
    const r = (await k.post('/api/patient/p01/restjournaler', { fil: { namn: 'sida.png', data: b64(PNG) }, bekraftat: true })).data;
    expect((await k.post(`/api/restjournal/${r.id}/makulera`, { orsak: 'okand' })).status).toBe(400);
    const m = await k.post(`/api/restjournal/${r.id}/makulera`, { orsak: 'fel_patient' });
    expect(m.status).toBe(200);
    expect(m.data.makulerad).toMatchObject({ av: 'Johan Ek', orsak: 'Skannad till fel patient' });
    expect((await k.post(`/api/restjournal/${r.id}/makulera`, { orsak: 'fel_patient' })).status).toBe(409);
    expect((await k.get('/api/patient/p01/restjournaler')).data.dokument.map(d => d.id)).not.toContain(r.id);
    expect((await k.get('/api/patient/p01/oversikt')).data.tidslinje.some(t => t.ref?.typ === 'restjournal' && t.ref.id === r.id)).toBe(false);
    expect((await k.raw('GET', `/api/restjournal/${r.id}/fil`)).status).toBe(404);
    expect(db(k).query('SELECT status, data IS NOT NULL AS harData FROM restjournaler WHERE id = ?').get(r.id)).toEqual({ status: 'makulerad', harData: 1 });
  });
});
