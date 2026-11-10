// Bilder och media, version 1.1 (runda 11, r5, Sussa 4.2.1.1 till 4.2.1.4): uppladdning i delar, miniatyrer som servern
// gör, EXIF, film och ljud, annoteringar, import från apparat och annan vårdgivare, DICOMweb och FHIR.
import { describe, test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import * as bilder from '../src/bilder.js';
import * as bm from '../src/bildmedia.js';
import * as fhir from '../src/fhir.js';
import { bildStorlek } from '../src/bildkodek.js';
import { BAS, sandlada, nyPatient, atk, sparr, efter } from './specialist.js';
import { sarPng, jpeg, mp4, webm, wav, bombPng } from './media-filer.js';

const ny = (db, id = 'bm1', extra = {}) => nyPatient(db, { id, enhet: 'kkoga-ort', ar: 1975, kon: 'K', fornamn: 'Bilda', efternamn: 'Fotosson', ...extra });
const A = (db, roll = 'lak-kkoga', pid = 'bm1', h = 'skriv_journal', val = {}) => atk(db, roll, pid, h, val);
const svar = async (r) => Buffer.from(await r.arrayBuffer());

// Skickar en fil i delar, som gränssnittet gör.
async function iDelar(db, buf, body = {}, roll = 'lak-kkoga', pid = 'bm1', nu = BAS) {
  const s = bm.starta(A(db, roll, pid), { namn: 'fil.bin', storlek: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), ...body }, nu);
  for (let i = 0; i < s.delar; i++) bm.del(A(db, roll, pid), bm.uppladdningRad(db, s.id), { nr: i, data: buf.subarray(i * s.delstorlek, (i + 1) * s.delstorlek).toString('base64') });
  return bm.avsluta(A(db, roll, pid), bm.uppladdningRad(db, s.id), nu);
}

describe('Bilder och media 1.1', () => {
  test('en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör', async () => {
    const db = sandlada();
    ny(db);
    const stor = sarPng(1800, 1200);
    expect(stor.length).toBeGreaterThan(bm.DELSTORLEK);
    const m = await iDelar(db, stor, { namn: 'sar.png', kroppsstalle: 'Vänster vad', beskrivning: 'Bensår' });
    expect(m).toMatchObject({ typ: 'image/png', slag: 'bild', kroppsstalle: 'vänster vad', storlek: stor.length, egenskaper: { bredd: 1800, hojd: 1200 }, miniatyr: `/api/media/${m.id}/miniatyr` });
    expect(m.sha256).toBe(createHash('sha256').update(stor).digest('hex'));
    expect(db.query('SELECT count(*) AS n FROM media_uppladdning_delar').get().n).toBe(0);
    expect(db.query('SELECT count(*) AS n FROM media_uppladdningar').get().n).toBe(0);
    const min = await bm.visningsfil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, m.id), 'miniatyr');
    expect(min.headers.get('content-type')).toBe('image/jpeg');
    expect(await bildStorlek(await svar(min))).toMatchObject({ bredd: 256, hojd: 171 });
    const vis = await bm.visningsfil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, m.id), 'visning');
    expect(await bildStorlek(await svar(vis))).toMatchObject({ bredd: 1600, hojd: 1067 });
    // Originalet är oförändrat och loggas när det hämtas, och miniatyren loggas för sig.
    expect((await svar(bilder.fil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, m.id), { ladda: true }))).equals(stor)).toBe(true);
    expect(db.query('SELECT resurs FROM atkomstlogg WHERE resurs LIKE ? ORDER BY id').all(`media:${m.id}%`).map(r => r.resurs)).toEqual([`media:${m.id}:miniatyr`, `media:${m.id}:visning`, `media:${m.id}`]);
    expect(() => db.query('UPDATE media SET data = ? WHERE id = ?').run(Buffer.from('x'), m.id)).toThrow('En bild ändras inte');
  });

  test('uppladdningen i delar har tak per person, patient och sandlåda, delar med fel storlek avvisas och en bild som inte går att avkoda kommer inte in', async () => {
    const db = sandlada();
    ny(db);
    expect(() => bm.starta(A(db), { namn: 'stor.mp4', storlek: bilder.MAX_FIL.video + 1 }, BAS)).toThrow('Filen är för stor');
    expect(() => bm.starta(A(db), { namn: 'x', storlek: 10, kalla: 'okand' }, BAS)).toThrow('Källan är fil eller kamera');
    const s1 = bm.starta(A(db), { namn: 'a.png', storlek: 100_000 }, BAS);
    expect(s1.delar).toBe(3);
    bm.starta(A(db), { namn: 'b.png', storlek: 1000 }, BAS);
    expect(() => bm.starta(A(db), { namn: 'c.png', storlek: 1000 }, BAS)).toThrow('2 uppladdningar som inte är klara');
    const u = bm.uppladdningRad(db, s1.id);
    expect(() => bm.del(A(db), u, { nr: 0, data: Buffer.alloc(10).toString('base64') })).toThrow('fel storlek');
    expect(() => bm.del(A(db), u, { nr: 3, data: 'AA==' })).toThrow('nummer');
    expect(() => bm.del(A(db), u, { nr: '0', data: 'AA==' })).toThrow('nummer');
    bm.del(A(db), u, { nr: 0, data: Buffer.alloc(bm.DELSTORLEK).toString('base64') });
    expect(() => bm.del(A(db), u, { nr: 0, data: Buffer.alloc(bm.DELSTORLEK).toString('base64') })).toThrow('redan mottagen');
    expect(() => bm.avsluta(A(db), u, BAS)).toThrow('1 av 3 delar');
    // En annan person och en annan patient kommer inte åt uppladdningen.
    expect(() => bm.del(A(db, 'ssk-kkoga'), u, { nr: 1, data: 'AA==' })).toThrow('Uppgiften finns inte');
    ny(db, 'bm2');
    expect(() => bm.del(A(db, 'lak-kkoga', 'bm2'), u, { nr: 1, data: 'AA==' })).toThrow('Uppgiften finns inte');
    // En uppladdning som har gått ut töms.
    bm.rensa(db, efter(bm.UPPLADDNING_MIN + 1));
    expect(db.query('SELECT count(*) AS n FROM media_uppladdning_delar').get().n).toBe(0);
    // En bomb med för många pixlar kommer inte in, och delarna töms.
    await expect(iDelar(db, bombPng(), { namn: 'bomb.png' })).rejects.toThrow('16 miljoner pixlar');
    expect(db.query("SELECT count(*) AS n FROM media WHERE patient_id = 'bm1'").get().n).toBe(0);
    expect(db.query('SELECT count(*) AS n FROM media_uppladdningar').get().n).toBe(0);
    // En fil som inte blev densamma som den som skickades avvisas.
    const buf = sarPng(200, 100);
    const s = bm.starta(A(db), { namn: 'x.png', storlek: buf.length, sha256: '0'.repeat(64) }, BAS);
    bm.del(A(db), bm.uppladdningRad(db, s.id), { nr: 0, data: buf.toString('base64') });
    expect(() => bm.avsluta(A(db), bm.uppladdningRad(db, s.id), BAS)).toThrow('inte densamma');
    // Uppladdningar som pågår räknas in i sandlådans tak.
    const upptaget = db.query('SELECT coalesce(sum(storlek), 0) AS s FROM media').get().s;
    bm.starta(A(db), { namn: 'a.mp4', storlek: bilder.MAX_FIL.video }, BAS);
    db.query("INSERT INTO media_uppladdningar (id, patient_id, enhet_id, personal_id, namn, storlek, delar, meta, skapad) VALUES ('f'||hex(randomblob(15)), 'bm2', 'kkoga-ort', 'ssk-kkoga', 'b', ?, 1, '{}', ?)")
      .run(bilder.MAX_PER_SANDLADA - upptaget - bilder.MAX_FIL.video, BAS.toISOString());
    expect(() => bm.starta(A(db, 'ssk-kkoga'), { namn: 'c.png', storlek: 1000 }, BAS)).toThrow('Sandlådan har inte plats');
  });

  test('tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren', async () => {
    const db = sandlada();
    ny(db);
    const j = await jpeg({ bredd: 400, hojd: 300, exif: { tagen: '2026-11-08 09:15:00'.replace(' ', ' ').replaceAll('-', ':'), plats: true } });
    const m = await iDelar(db, j, { namn: 'mobil.jpg', kalla: 'kamera' });
    expect(m.tagen).toBe('2026-11-08T08:15:00.000Z');
    expect(m.egenskaper).toMatchObject({ kamera: 'Demokamera X1', plats: true, exifTagen: '2026-11-08T09:15:00' });
    const min = await svar(await bm.visningsfil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, m.id), 'miniatyr'));
    expect(min.includes(Buffer.from('Exif'))).toBe(false);
    // En angiven tid går före EXIF.
    const m2 = await iDelar(db, j, { namn: 'b.jpg', tagen: efter(-60).toISOString() });
    expect(m2.tagen).toBe(efter(-60).toISOString());
  });

  test('film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr', async () => {
    const db = sandlada();
    ny(db);
    const film = await iDelar(db, mp4({ sekunder: 14, fyllnad: 120_000 }), { namn: 'gang.mp4', kalla: 'kamera', kroppsstalle: 'gång' });
    expect(film).toMatchObject({ typ: 'video/mp4', slag: 'video', egenskaper: { langdSek: 14, langdKalla: 'fil', bredd: 320 }, visning: `/api/media/${film.id}/fil` });
    const inspelad = await iDelar(db, webm({ fyllnad: 50_000 }), { namn: 'inspelning.webm', kalla: 'kamera', langdSek: 8.3 });
    expect(inspelad.egenskaper).toMatchObject({ langdSek: 8.3, langdKalla: 'inspelning' });
    const ljud = await iDelar(db, wav(3), { namn: 'hjartljud.wav', kalla: 'mikrofon' });
    expect(ljud).toMatchObject({ typ: 'audio/wav', slag: 'ljud', kalla: { text: 'Inspelning med mikrofonen' }, egenskaper: { langdSek: 3 } });
    const f = bilder.fil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, film.id));
    expect(f.headers.get('content-type')).toBe('video/mp4');
    const min = await bm.visningsfil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, ljud.id), 'miniatyr');
    expect(min.headers.get('content-type')).toBe('image/png');
    expect(() => bm.visningsfil(A(db, 'lak-kkoga', 'bm1', 'las_journal'), bilder.mediaRad(db, ljud.id), 'visning')).toThrow('ingen visningsbild');
    // Jämförelsen över tid gäller bilder, inte filmer.
    expect(bilder.jamforelse(A(db, 'lak-kkoga', 'bm1', 'las_journal'), 'gång').bilder).toEqual([]);
  });

  test('annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den', async () => {
    const db = sandlada();
    ny(db);
    const m = bilder.mediaRad(db, (await iDelar(db, sarPng(300, 200), { namn: 'sar.png' })).id);
    const fore = Buffer.from(m.data);
    expect(() => bm.annotera(A(db), m, { typ: 'pil', punkter: [[0.1, 0.1]] }, BAS)).toThrow('start och ett slut');
    expect(() => bm.annotera(A(db), m, { typ: 'pil', punkter: [[0.1, 0.1], [1.2, 0.5]] }, BAS)).toThrow('start och ett slut');
    expect(() => bm.annotera(A(db), m, { typ: 'text', punkter: [[0.5, 0.5]] }, BAS)).toThrow('Skriv texten');
    expect(() => bm.annotera(A(db), m, { typ: 'constructor', punkter: [] }, BAS)).toThrow('Välj pil');
    const pil = bm.annotera(A(db), m, { typ: 'pil', punkter: [[0.2, 0.3], [0.5, 0.5]], text: 'Fistelgång' }, BAS);
    expect(pil).toMatchObject({ typ: 'pil', typText: 'Pil', text: 'Fistelgång', skapad: { av: 'Ingrid Moberg' }, egen: true });
    const ring = bm.annotera(A(db, 'ssk-kkoga'), m, { typ: 'ring', punkter: [[0.4, 0.4], [0.6, 0.6]] }, BAS);
    expect(bm.forPatient(A(db, 'lak-kkoga', 'bm1', 'las_journal'), BAS).bilder[0].annoteringar.map(a => [a.typ, a.egen])).toEqual([['pil', true], ['ring', false]]);
    expect(() => bm.taBortAnnotering(A(db), bm.annoteringRad(db, ring.id), BAS)).toThrow('Bara den som gjorde annoteringen');
    bm.taBortAnnotering(A(db, 'ssk-kkoga'), bm.annoteringRad(db, ring.id), BAS);
    expect(bm.forPatient(A(db, 'lak-kkoga', 'bm1', 'las_journal'), BAS).bilder[0].annoteringar.map(a => a.id)).toEqual([pil.id]);
    expect(db.query('SELECT borttagen_av FROM media_annoteringar WHERE id = ?').get(ring.id).borttagen_av).toBe('ssk-kkoga');
    expect(() => db.query("UPDATE media_annoteringar SET text = 'annan' WHERE id = ?").run(pil.id)).toThrow('En annotering ändras inte');
    expect(Buffer.from(bilder.mediaRad(db, m.id).data).equals(fore)).toBe(true);
    // En film kan inte annoteras.
    const film = bilder.mediaRad(db, (await iDelar(db, mp4({ fyllnad: 100 }), { namn: 'f.mp4' })).id);
    expect(() => bm.annotera(A(db), film, { typ: 'pil', punkter: [[0, 0], [1, 1]] }, BAS)).toThrow('Bara bilder');
  });

  test('säkerhet: en annotering från en spärrad vårdenhet syns inte, och svaret är detsamma som utan den', async () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bm1', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Vård')").run(BAS.toISOString());
    const m = bilder.mediaRad(db, (await iDelar(db, sarPng(300, 200), { namn: 'sar.png' })).id);
    const las = () => bm.forPatient(A(db, 'lak-kkoga', 'bm1', 'las_journal', { andra_enheter: true }), BAS);
    const utan = JSON.stringify(las());
    bm.annotera(A(db, 'lak-kard', 'bm1', 'skriv_journal', { andra_enheter: true }), m, { typ: 'text', punkter: [[0.5, 0.5]], text: 'Kardiologens fynd' }, BAS);
    expect(las().bilder[0].annoteringar.map(a => a.text)).toEqual(['Kardiologens fynd']);
    sparr(db, 'bm1', 'uso-kard');
    expect(JSON.stringify(las())).toBe(utan);
    // Utan aktivt val syns inte annoteringen från en annan vårdenhet.
    expect(bm.forPatient(A(db, 'lak-kkoga', 'bm1', 'las_journal'), BAS).bilder[0].annoteringar).toEqual([]);
  });

  test('en bild från en medicinteknisk apparat väntar på granskning med apparatens serienummer, och en bild som enligt apparaten gäller en annan patient kan inte föras in', async () => {
    const db = sandlada();
    ny(db);
    await iDelar(db, sarPng(), { namn: 'a.png', kroppsstalle: 'Höger fot' }, 'ssk-kkoga');
    const r = bm.franApparat(A(db, 'ssk-kkoga'), 'dermatoskop', {}, BAS);
    expect(r.text).toBe('2 bilder från Dermatoskop (simulerat). Granska och för in i journalen.');
    expect(r.bilder[0]).toMatchObject({ status: 'vantar', kalla: { id: 'apparat', text: 'Medicinteknisk apparat' }, kroppsstalle: 'höger fot', apparat: { serienummer: 'DEMO-DERM-0001' }, registrerad: { av: 'Tove Ahlström' } });
    expect(() => bm.franApparat(A(db, 'ssk-kkoga'), 'constructor', {}, BAS)).toThrow('Apparaten finns inte');
    const v = bm.forPatient(A(db, 'ssk-kkoga', 'bm1', 'las_journal'), BAS);
    expect(v.attGranska.map(b => b.identitet.stammer)).toEqual([true, true]);
    expect(v.bilder.map(b => b.kalla.id)).toEqual(['fil']);
    // Läkaren på samma vårdenhet granskar, och bilden kommer in i journalen med granskaren.
    const g = bm.granska(A(db, 'lak-kkoga'), bilder.mediaRad(db, r.bilder[0].id), { kroppsstalle: 'Höger häl' }, efter(5));
    expect(g).toMatchObject({ status: 'journal', kroppsstalle: 'höger häl', granskad: { av: 'Ingrid Moberg' } });
    bm.granska(A(db, 'ssk-kkoga'), bilder.mediaRad(db, r.bilder[1].id), { godkann: false }, efter(5));
    expect(bilder.mediaRad(db, r.bilder[1].id).status).toBe('avvisad');
    // En bild där apparaten anger ett annat personnummer stoppas.
    const fel = bm.franApparat(A(db, 'ssk-kkoga'), 'sarkamera', {}, BAS, { pnr: '191212121212' });
    expect(bm.forPatient(A(db, 'ssk-kkoga', 'bm1', 'las_journal'), BAS).attGranska[0].identitet).toMatchObject({ stammer: false });
    expect(() => bm.granska(A(db, 'ssk-kkoga'), bilder.mediaRad(db, fel.bilder[0].id), {}, BAS)).toThrow('annan patient');
    // En annan vårdenhet granskar inte, inte heller med aktivt val.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bm1', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Vård')").run(BAS.toISOString());
    expect(() => bm.granska(A(db, 'lak-kard', 'bm1', 'skriv_journal', { andra_enheter: true }), bilder.mediaRad(db, fel.bilder[0].id), { godkann: false }, BAS)).toThrow('tog emot den');
    expect(bm.forPatient(A(db, 'lak-kard', 'bm1', 'las_journal', { andra_enheter: true }), BAS).attGranska).toEqual([]);
  });

  test('bilder från en annan vårdgivare hämtas bara med patientens samtycke, behåller sitt ursprung och kommer in i journalen efter granskning', () => {
    const db = sandlada();
    const sess = { val: {} };
    const L = (h = 'las_journal') => atk(db, 'lak-kard', 'p01', h);
    expect(bm.externLage(L(), sess)).toMatchObject({ samtycke: false, aktivtVal: false, bilder: [] });
    expect(() => bm.hamtaExtern(L('skriv_journal'), sess, { syfte: 'Tidigare bilder av knät' }, BAS)).toThrow('bara om patienten samtycker');
    const h = bm.hamtaExtern(L('skriv_journal'), sess, { samtycke: true, syfte: 'Tidigare bilder av knät' }, BAS);
    expect(h.bilder.map(b => [b.status, b.kalla.id, b.registrerad.av])).toEqual([
      ['vantar', 'annan_vardgivare', 'Demofysioterapeut Hälsohuset, Hälsohuset ortopedmottagning (simulerad)'],
      ['vantar', 'annan_vardgivare', 'Demoläkare Hälsohuset, Hälsohuset ortopedmottagning (simulerad)']]);
    expect(h.bilder[0].ursprung).toMatchObject({ vardgivare: 'Hälsohuset Vårdgivare AB (simulerad)', simulerad: true });
    expect(bm.hamtaExtern(L('skriv_journal'), sess, {}, BAS).text).toBe('Inga nya bilder att hämta.');
    expect(bm.externLage(L(), sess).bilder.map(b => b.hamtad)).toEqual([true, true]);
    // Varje hämtning loggas med grunden och syftet från det aktiva valet.
    const logg = db.query("SELECT grund, syfte FROM atkomstlogg WHERE patient_id = 'p01' AND resurs = 'media:extern:DEMO-VG-0001'").all();
    expect(logg.length).toBe(3);
    expect(logg.every(r => r.syfte === 'Tidigare bilder av knät')).toBe(true);
    const g = bm.granska(L('skriv_journal'), bilder.mediaRad(db, h.bilder[0].id), {}, BAS);
    expect(g).toMatchObject({ status: 'journal', registrerad: { av: 'Demofysioterapeut Hälsohuset, Hälsohuset ortopedmottagning (simulerad)' }, granskad: { av: 'Sara Lindqvist' } });
    // Ingen nuvarande personal står som den som tog bilden.
    expect(db.query('SELECT registrerad_av FROM media WHERE id = ?').get(h.bilder[0].id).registrerad_av).toBeNull();
  });

  test('säkerhet: bilder från en annan vårdgivare kräver ett aktivt val med syfte i sessionen för samma person och patient, som sammanhållen journalföring', () => {
    const db = sandlada();
    const L = (roll = 'lak-kard', h = 'las_journal') => atk(db, roll, 'p01', h);
    // Ett samtycke utan aktivt val i sessionen räcker inte, och utan syfte görs inget val.
    db.query("INSERT INTO sammanhallen_samtycken (patient_id, enhet_id, registrerat, registrerat_av) VALUES ('p01', 'uso-kard', ?, 'lak-kard')").run(BAS.toISOString());
    const sess = { val: {} };
    expect(bm.externLage(L(), sess)).toMatchObject({ samtycke: true, aktivtVal: false, bilder: [] });
    expect(() => bm.hamtaExtern(L('lak-kard', 'skriv_journal'), sess, {}, BAS)).toThrow('syftet');
    expect(db.query("SELECT count(*) AS n FROM media WHERE patient_id = 'p01' AND kalla = 'annan_vardgivare'").get().n).toBe(0);
    bm.hamtaExtern(L('lak-kard', 'skriv_journal'), sess, { syfte: 'Bedömning av knät' }, BAS);
    // Valet gäller personen som gjorde det: en annan person i samma session får inget.
    expect(bm.externLage(atk(db, 'ssk-kard', 'p01', 'las_journal'), sess).aktivtVal).toBe(false);
    // Bilderna från den andra vårdgivaren hör till journalens kategori, så sjuksköterskan hämtar dem inte.
    expect(() => bm.hamtaExtern(L('ssk-kard', 'skriv_omvardnad'), { val: {} }, { samtycke: true, syfte: 'Sår' }, BAS)).toThrow();
  });

  test('säkerhet: granskningen kräver skrivrätten för bildens kategori, så en roll med bara omvårdnadens skrivrätt för inte in en bild i journalens kategori', () => {
    const db = sandlada();
    ny(db);
    const r = bm.franApparat(A(db, 'lak-kkoga'), 'ultraljud', {}, BAS);
    expect(() => bm.granska(A(db, 'ssk-kkoga', 'bm1', 'skriv_omvardnad'), bilder.mediaRad(db, r.bilder[0].id), {}, BAS)).toThrow();
    expect(bilder.mediaRad(db, r.bilder[0].id).status).toBe('vantar');
    expect(bm.granska(A(db, 'lak-kkoga'), bilder.mediaRad(db, r.bilder[0].id), {}, BAS).status).toBe('journal');
    // En bild i omvårdnadens kategori granskas av sjuksköterskan.
    const o = bm.franApparat(A(db, 'ssk-kkoga', 'bm1', 'skriv_omvardnad'), 'sarkamera', {}, BAS);
    expect(bm.granska(A(db, 'ssk-kkoga', 'bm1', 'skriv_omvardnad'), bilder.mediaRad(db, o.bilder[0].id), {}, BAS).status).toBe('journal');
  });

  test('säkerhet: en sökning i DICOMweb på en patient utan åtkomst ger en tom lista och loggas som nekad', async () => {
    const db = sandlada();
    ny(db);
    bilder.bestallUndersokning(A(db, 'lak-kkoga', 'bm1', 'remittera'), { undersokning: 'lungrontgen', fragestallning: 'Infiltrat?' }, efter(-120));
    expect(JSON.parse(await bm.qidoStudier(atk(db, 'lak-psyk', 'bm1', 'las_journal'), {}).text())).toEqual([]);
    expect(db.query("SELECT resultat, resurs FROM atkomstlogg WHERE patient_id = 'bm1' AND personal_id = 'lak-psyk'").all()).toEqual([{ resultat: 'nekad', resurs: 'dicomweb:studies' }]);
  });

  test('DICOMweb: QIDO-RS söker patientens studier, WADO-RS hämtar instansen som DICOM-fil och den renderade bilden med fönster, med behörighet och loggning', async () => {
    const db = sandlada();
    const p = ny(db);
    const s = bilder.bestallUndersokning(A(db, 'lak-kkoga', 'bm1', 'remittera'), { undersokning: 'dt_hjarna', fragestallning: 'Blödning?' }, efter(-120));
    const L = () => A(db, 'lak-kkoga', 'bm1', 'las_journal');
    const q = JSON.parse(await (bm.qidoStudier(L(), {})).text());
    expect(q).toHaveLength(1);
    const uid = q[0]['0020000D'].Value[0];
    expect(q[0]['00100020'].Value[0].replace('-', '')).toBe(p.personnummer);
    expect(JSON.parse(await bm.qidoStudier(L(), { ModalitiesInStudy: 'DX' }).text())).toEqual([]);
    expect(() => bm.qidoStudier(L(), { StudyDate: 'igår' })).toThrow('StudyDate');
    const st = bm.studieForUid(db, uid);
    expect(st.id).toBe(s.id);
    const ser = JSON.parse(await bm.serier(L(), st).text());
    const serieUid = ser[0]['0020000E'].Value[0];
    const inst = JSON.parse(await bm.instanser(L(), st, serieUid).text());
    expect(inst).toHaveLength(120);
    const r = bm.hamtaInstans(L(), st, serieUid, inst[59]['00080018'].Value[0]);
    expect(r.headers.get('content-type')).toMatch(/^multipart\/related; type="application\/dicom"/);
    const kropp = await svar(r);
    expect(kropp.indexOf(Buffer.from('DICM'))).toBeGreaterThan(128);
    const png = await svar(bm.renderad(L(), st, serieUid, inst[59]['00080018'].Value[0], { fonster: '40,80' }));
    expect(await bildStorlek(png)).toMatchObject({ bredd: 128, format: 'png' });
    expect(() => bm.renderad(L(), st, serieUid, 'fel.uid', {})).toThrow('finns inte i studien');
    expect(() => bm.studieForUid(db, 'x;drop')).toThrow('finns inte i arkivet');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'bm1' AND resurs LIKE 'dicomweb:%'").get().n).toBe(6);
    expect(bm.patientForPid(db, `${p.personnummer.slice(0, 8)}-${p.personnummer.slice(8)}`)).toBe('bm1');
  });

  test('säkerhet: DICOMweb visar inte en studie på en spärrad vårdenhet, en patient utan åtkomst ger en tom lista, och en studie för en annan patient finns inte', async () => {
    const db = sandlada();
    ny(db); ny(db, 'bm2');
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bm1', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Vård')").run(BAS.toISOString());
    bilder.bestallUndersokning(A(db, 'lak-kkoga', 'bm1', 'remittera'), { undersokning: 'lungrontgen', fragestallning: 'Infiltrat?' }, efter(-120));
    const K = (val = {}) => atk(db, 'lak-kard', 'bm1', 'las_journal', val);
    const sok = async (a) => JSON.parse(await bm.qidoStudier(a, {}).text());
    expect(await sok(K())).toEqual([]);
    expect(await sok(K({ andra_enheter: true }))).toHaveLength(1);
    sparr(db, 'bm1', 'kkoga-ort');
    expect(await sok(K({ andra_enheter: true }))).toEqual([]);
    expect(await sok(atk(db, 'lak-psyk', 'bm1', 'las_journal'))).toEqual([]);
    const st = db.query("SELECT * FROM media_studier WHERE patient_id = 'bm1'").get();
    expect(() => bm.serier(A(db, 'lak-kkoga', 'bm2', 'las_journal'), st)).toThrow('Uppgiften finns inte');
    expect(() => bm.serier(K({ andra_enheter: true }), st)).toThrow('spärrade');
  });

  test('FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb', async () => {
    const db = sandlada();
    ny(db);
    const m = await iDelar(db, sarPng(300, 200), { namn: 'sar.png', kroppsstalle: 'rygg', beskrivning: 'Före behandling' });
    await iDelar(db, Buffer.from('%PDF-1.4\n% demo\n'), { namn: 'dok.pdf' });
    const s = bilder.bestallUndersokning(A(db, 'lak-kkoga', 'bm1', 'remittera'), { undersokning: 'hoftled', fragestallning: 'Artros?' }, efter(-120));
    const fraga = (roll, vag, val = {}) => fhir.hantera({ db, personal: db.query('SELECT * FROM personal WHERE id = ?').get(roll), valFor: () => val, url: new URL(`http://x${vag}`), base: 'http://x' });
    const media = fraga('lak-kkoga', '/fhir/Media?patient=bm1').body.entry.map(e => e.resource);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({ resourceType: 'Media', id: String(m.id), status: 'completed', type: { coding: [{ code: 'image' }] }, bodySite: { text: 'rygg' }, width: 300, height: 200,
      content: { contentType: 'image/png', url: `http://x/api/media/${m.id}/fil`, size: m.storlek } });
    expect(media[0].content.hash).toHaveLength(28);
    const is = fraga('lak-kkoga', `/fhir/ImagingStudy/${s.id}`).body;
    expect(is).toMatchObject({ resourceType: 'ImagingStudy', status: 'available', numberOfSeries: 1, numberOfInstances: 3, endpoint: [{ reference: '#dicomweb' }],
      contained: [{ resourceType: 'Endpoint', address: 'http://x/api/dicomweb', connectionType: { code: 'dicom-wado-rs' } }], identifier: [{ value: `urn:oid:1.3.6.1.4.1.32473.1.9.${s.id}` }] });
    expect(is.series[0].instance).toHaveLength(3);
    expect(() => fraga('lak-kard', '/fhir/Media?patient=bm1')).toThrow('vårdrelation');
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('bm1', 'uso-kard-72', 'slutenvard', ?, 'Avd 72', 'Vård')").run(BAS.toISOString());
    expect(fraga('lak-kard', '/fhir/Media?patient=bm1').body.entry ?? []).toEqual([]);
    expect(fraga('lak-kard', '/fhir/Media?patient=bm1', { andra_enheter: true }).body.entry).toHaveLength(1);
    expect(() => fraga('lak-kard', `/fhir/Media/${m.id}`)).toThrow('aktivt val');
    expect(fraga('lak-kard', `/fhir/Patient/bm1/$everything`, { andra_enheter: true }).body.entry.map(e => e.resource.resourceType)).toEqual(expect.arrayContaining(['Media', 'ImagingStudy']));
    expect(fhir.capability('http://x').rest[0].resource.map(r => r.type)).toEqual(expect.arrayContaining(['Media', 'ImagingStudy']));
  });

  test('demons mall har trycksårsbilderna och en besvarad lungröntgen för Gunnar Åkesson, men inte seeden som testerna bygger på', () => {
    const db = sandlada();
    expect(db.query("SELECT count(*) AS n FROM media WHERE patient_id = 'p01'").get().n).toBe(0);
    bm.demo(db, BAS);
    const v = bm.forPatient(atk(db, 'ssk-kard', 'p01', 'las_omvardnad'), BAS);
    expect(v.bilder.map(b => b.kroppsstalle)).toEqual(['korsbenet', 'korsbenet', 'korsbenet']);
    expect(bilder.jamforelse(atk(db, 'ssk-kard', 'p01', 'las_omvardnad'), 'korsbenet').bilder.map(b => b.dagarFranForsta)).toEqual([0, 1, 3]);
    const l = bm.forPatient(atk(db, 'lak-kard', 'p01', 'las_journal'), BAS);
    expect(l.studier[0]).toMatchObject({ undersokning: 'Lungröntgen', status: 'besvarad', arkivet: { forvaltFonster: 'Mjukdelar', pixelavstand: 1.4 } });
    bm.demo(db, BAS);
    expect(db.query("SELECT count(*) AS n FROM media WHERE patient_id = 'p01'").get().n).toBe(3);
  });
});
