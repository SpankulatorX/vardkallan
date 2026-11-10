// Runda 10, r3: formulärmotorn (Sussa 3.1.3.1, 3.1.3.5, 3.1.7.1 och 5.1.1.3). Formulär som data med datatyper och
// validering, fasta svar med poäng och kod, skalor, regler, kroppsbild med markeringar, förifyllnad ur journalen,
// versioner med fyra ögon, behörighet per formulär och svaren i journalen. Testnamnen står i src/sussa/runda10-r3.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, idag } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as journal from '../src/journal.js';
import * as fm from '../src/formularmotor.js';
import * as R from '../public/js/formularmotor-regler.js';
import { personal, testserver, klient } from './hjalp.js';

const NU = new Date('2026-11-08T10:00:00Z');
// Runda 11, r1: Gunnar Åkessons (p01, född 1945-02-02) ålder i dag, så att testet inte går ut när han fyller år.
const alderP01 = () => { const [y, m, d] = idag().split('-').map(Number); return y - 1945 - (m < 2 || (m === 2 && d < 2) ? 1 : 0); };
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const atk = (db, pid, patient, handling = 'skriv_omvardnad', val = {}) => new Atkomst(db, personal(db, pid), patient, val, handling);
const P = 'Formulär > ';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const FALL = { fall: 'ja', lakemedel: 'tva', syn: 'nej', gang: 'hjalpmedel', forvirring: 'nej' };
const ENKEL = (extra = {}) => ({
  namn: 'Nutritionskontroll', kategori: 'omvardnad', falt: [
    { id: 'aptit', typ: 'val', fraga: 'Hur är aptiten?', obligatoriskt: true, sokord: 'Nutrition', alternativ: [{ varde: 'god', text: 'God', poang: 0 }, { varde: 'nedsatt', text: 'Nedsatt', poang: 2 }] },
    { id: 'viktfall', typ: 'ja_nej', fraga: 'Ofrivillig viktförlust?', sokord: 'Nutrition', poang: { ja: 2 } },
  ],
  skala: { namn: 'Nutritionsrisk', tolkning: [{ fran: 0, till: 1, text: 'Ingen risk' }, { fran: 2, till: 4, text: 'Risk för undernäring', varning: true }] },
  ...extra,
});

describe(P.slice(0, -3), () => {
  test('definitionen har fördefinierade datatyper med validering, och systemet förklarar varje fel på vanlig svenska', () => {
    const db = byggSeed(NU);
    const ok = fm.forhandsvisa(db, personal(db, 'sysf'), { definition: ENKEL() });
    expect(ok.ok).toBe(true);
    expect(ok.varde.skala).toMatchObject({ min: 0, max: 4 });
    expect(Object.keys(R.DATATYPER)).toEqual(['text', 'heltal', 'decimal', 'datum', 'ja_nej', 'val', 'flerval', 'bild', 'matvarde']);
    const prova = (def) => fm.forhandsvisa(db, personal(db, 'sysf'), { definition: def });
    expect(prova({ ...ENKEL(), namn: 'Daganteckning' }).varfor).toContain('används redan av en mall');
    expect(prova({ ...ENKEL(), kategori: 'annat' }).varfor).toContain('omvårdnaden eller läkarnas');
    expect(prova({ ...ENKEL(), falt: [{ id: 'X', typ: 'text', fraga: 'Hej' }] }).varfor).toContain('små bokstäver');
    expect(prova({ ...ENKEL(), falt: [{ id: 'a', typ: 'heltal', fraga: 'Antal', min: 5, max: 1 }] }).varfor).toContain('lägsta');
    expect(prova({ ...ENKEL(), falt: [{ id: 'a', typ: 'matvarde', fraga: 'Blodtryck', matvarde: 'blodtryck' }] }).varfor).toContain('anges med ett tal');
    expect(prova({ ...ENKEL(), falt: [{ id: 'a', typ: 'text', fraga: 'Text', sokord: 'Påhittat' }] }).varfor).toContain('fackspråket');
    expect(prova({ ...ENKEL(), skala: { namn: 'Risk', tolkning: [{ fran: 0, till: 1, text: 'Låg' }] } }).varfor).toContain('ingen tolkning gäller för 2 poäng');
    expect(prova({ ...ENKEL(), falt: [{ id: 'a', typ: 'heltal', fraga: 'Ålder', min: 0, max: 130, forifyll: 'senaste' }] }).varfor).toContain('kan inte fylla i');
    // Ett mätvärde får mätvärdets gränser och enhet ur journalen, så att den som bygger inte behöver kunna dem.
    const mv = prova({ ...ENKEL(), skala: undefined, falt: [{ id: 'vikt', typ: 'matvarde', fraga: 'Vikt', matvarde: 'vikt', forifyll: 'senaste' }] });
    expect(mv.varde.falt[0]).toMatchObject({ min: 0.5, max: 400, enhet: 'kg', sokord: 'Status' });
    // Svaren valideras per datatyp.
    const def = R.provaDefinition({
      namn: 'Prov', kategori: 'omvardnad', falt: [
        { id: 'antal', typ: 'heltal', fraga: 'Antal', min: 0, max: 10 }, { id: 'mm', typ: 'decimal', fraga: 'Längd', min: 0, max: 50, enhet: 'cm' },
        { id: 'dag', typ: 'datum', fraga: 'Datum' }, { id: 'jn', typ: 'ja_nej', fraga: 'Ja?' }, { id: 'fv', typ: 'flerval', fraga: 'Vilka?', alternativ: [{ varde: 'a', text: 'A' }, { varde: 'b', text: 'B' }] },
        { id: 'fri', typ: 'text', fraga: 'Fritt', maxLangd: 5 },
      ],
    }).varde;
    expect(R.provaSvar(def, { antal: '2,5' }).varfor).toContain('heltal');
    expect(R.provaSvar(def, { antal: 11 }).varfor).toContain('mellan 0 och 10');
    expect(R.provaSvar(def, { mm: '2,55' }).varfor).toContain('en decimal');
    expect(R.provaSvar(def, { dag: '2026-02-30' }).varfor).toContain('ett datum');
    expect(R.provaSvar(def, { dag: '2026-12-01' }, { idag: '2026-11-08' }).varfor).toContain('framtiden');
    expect(R.provaSvar(def, { jn: 'kanske' }).varfor).toContain('ja eller nej');
    expect(R.provaSvar(def, { fv: ['c'] }).varfor).toContain('Välj bland');
    expect(R.provaSvar(def, { fri: 'för lång' }).varfor).toContain('högst 5 tecken');
    expect(R.provaSvar(def, { antal: '3', mm: '2,5', fv: ['b', 'a', 'b'], okand: 'x' })).toEqual({ ok: true, varde: { antal: 3, mm: 2.5, fv: ['a', 'b'] } });
  });

  test('fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01');
    const ny = journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: FALL, sokord: [{ sokord: 'Aktuellt', text: 'Ska inte sparas' }] });
    expect(ny).toMatchObject({ typ: 'Fallriskbedömning', kategori: 'omvardnad', status: 'utkast' });
    const text = ny.sokord.map(s => `${s.sokord}: ${s.text}`).join('\n');
    expect(text).toContain('Har patienten fallit det senaste året: ja.');
    expect(text).toContain('Bedömning: Fallrisk: 5 poäng, hög risk för fall.');
    expect(text).not.toContain('Ska inte sparas');
    expect(ny.formular).toMatchObject({ kod: 'fallrisk', version: 1, svar: FALL, poang: { summa: 5, tolkning: { text: 'Hög risk för fall', varning: true, kod: { system: 'icd10', kod: 'R29.6' } } } });
    // Systemet fyller i åldern ur personnumret och reglerna ger varningen.
    expect(ny.formular.svar.alder).toBe(alderP01());
    expect(text).toContain('Patienten är 80 år eller äldre');
    // Utan fall och med självständig gång är risken låg.
    const lag = journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: { fall: 'nej', lakemedel: 'inga', syn: 'nej', gang: 'sjalvstandig', forvirring: 'nej' } });
    expect(lag.formular.poang).toMatchObject({ summa: 0, tolkning: { text: 'Låg risk för fall', varning: false } });
    // Ett obligatoriskt svar som saknas sparas inte, och felet säger vilken fråga det gäller.
    expect(fel(() => journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: { fall: 'ja' } }))).toMatchObject({ status: 400, extra: { falt: ['lakemedel'] } });
    // Ett utkast ändras med svaren, aldrig med sökorden.
    expect(fel(() => journal.andraUtkast(a, journal.hamtaAnteckningRad(db, ny.id), { sokord: [{ sokord: 'Status', text: 'Eget' }] }))).toMatchObject({ status: 400 });
    const andrad = journal.andraUtkast(a, journal.hamtaAnteckningRad(db, ny.id), { formular: { ...FALL, fall: 'nej' } });
    expect(andrad.formular.poang.summa).toBe(4);
  });

  test('frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska', () => {
    const def = R.provaDefinition({
      namn: 'Smärtkontroll', kategori: 'omvardnad', falt: [
        { id: 'ont', typ: 'ja_nej', fraga: 'Har patienten ont?', obligatoriskt: true },
        { id: 'nrs', typ: 'heltal', fraga: 'Smärta 0 till 10', min: 0, max: 10, visaOm: { falt: 'ont', ar: 'ja' }, kravsOm: { falt: 'ont', ar: 'ja' } },
        { id: 'var', typ: 'text', fraga: 'Var sitter smärtan?', visaOm: { falt: 'nrs', minst: 1 } },
      ],
      regler: [{ om: { falt: 'nrs', minst: 7 }, text: 'Svår smärta. Systemet föreslår att läkaren kontaktas.' }],
    }).varde;
    expect(R.synligaFalt(def, { ont: 'nej' }).map(f => f.id)).toEqual(['ont']);
    expect(R.provaSvar(def, { ont: 'nej', nrs: 8, var: 'Buken' })).toEqual({ ok: true, varde: { ont: 'nej' } });
    expect(R.provaSvar(def, { ont: 'ja' })).toMatchObject({ ok: false, falt: 'nrs', varfor: 'Svara på frågan: Smärta 0 till 10' });
    expect(R.varningar(def, { ont: 'ja', nrs: 8 })).toEqual([{ text: 'Svår smärta. Systemet föreslår att läkaren kontaktas.', varning: true }]);
    expect(R.varningar(def, { ont: 'ja', nrs: 3 })).toEqual([]);
    // Ett villkor kan bara bygga på en fråga som kommer före, så att reglerna aldrig går runt i en ring.
    expect(R.provaDefinition({ namn: 'Ring', kategori: 'omvardnad', falt: [{ id: 'a', typ: 'text', fraga: 'Fråga A', visaOm: { falt: 'b', ifyllt: true } }, { id: 'b', typ: 'text', fraga: 'Fråga B' }] }).varfor).toContain('kommer före');
    expect(R.provaDefinition({ namn: 'Fel', kategori: 'omvardnad', falt: [{ id: 'a', typ: 'text', fraga: 'Fråga A' }], regler: [{ om: { poang: { minst: 1 } }, text: 'X' }] }).varfor).toContain('ingen skala');
  });

  test('kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån', () => {
    // Framifrån ligger patientens högra sida till vänster i bilden, bakifrån till höger.
    expect(R.region('kropp', 'fram', 44, 85)).toEqual({ id: 'fram:underben-h', text: 'höger underben, framsida' });
    expect(R.region('kropp', 'fram', 56, 85)).toEqual({ id: 'fram:underben-v', text: 'vänster underben, framsida' });
    expect(R.region('kropp', 'bak', 44, 95)).toEqual({ id: 'bak:hal-v', text: 'vänster häl' });
    expect(R.region('kropp', 'bak', 56, 95)).toEqual({ id: 'bak:hal-h', text: 'höger häl' });
    expect(R.region('kropp', 'bak', 50, 44)).toEqual({ id: 'bak:korsben', text: 'korsbensregionen' });
    expect(R.region('kropp', 'fram', 5, 5)).toBeNull();
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01');
    const ny = journal.skapaAnteckning(a, { typ: 'Sårdokumentation', formular: { lage: [{ vy: 'bak', x: 56, y: 95, text: 'Rodnad som inte bleknar' }, { vy: 'bak', x: 50, y: 44 }], sartyp: 'trycksar', langd: '2,5', bredd: 2 } });
    const text = ny.sokord.map(s => s.text).join('\n');
    expect(text).toContain('Sårets läge: 1) höger häl: Rodnad som inte bleknar. 2) korsbensregionen.');
    expect(text).toContain('Sårtyp: Trycksår.');
    expect(text).toContain('Sårets längd: 2,5 cm.');
    expect(ny.formular.svar.lage[0]).toMatchObject({ region: 'bak:hal-h', regionText: 'höger häl' });
    // En markering utanför kroppen sparas inte, och systemet förklarar varför.
    expect(fel(() => journal.skapaAnteckning(a, { typ: 'Sårdokumentation', formular: { lage: [{ vy: 'fram', x: 2, y: 2 }], sartyp: 'trycksar' } })).message).toContain('utanför kroppen');
    // Bilden ritas ur samma regioner som systemet räknar med.
    expect(R.BILDER.kropp.vyer.fram.regioner.length).toBeGreaterThan(15);
  });

  test('svarsalternativ och tolkningar kan ha koder i ICD-10-SE, KVÅ och Snomed CT, som systemet kontrollerar och föreslår', () => {
    const db = byggSeed(NU);
    const sysf = personal(db, 'sysf');
    const med = (kod) => ENKEL({ falt: [{ ...ENKEL().falt[0], alternativ: [{ varde: 'god', text: 'God', poang: 0 }, { varde: 'nedsatt', text: 'Nedsatt', poang: 2, kod }] }, ENKEL().falt[1]] });
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'icd10', kod: 'R29.6' }) }).ok).toBe(true);
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'kva', kod: 'DV142' }) }).ok).toBe(true);
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'snomed', kod: '41829006' }) }).ok).toBe(true);
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'icd10', kod: 'X99.9' }) }).varfor).toContain('finns inte i ICD-10-SE');
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'snomed', kod: '41829007' }) }).varfor).toContain('Kontrollsiffran');
    expect(fm.forhandsvisa(db, sysf, { definition: med({ system: 'okant', kod: '1' }) }).varfor).toContain('kodverk');
    // Systemet visar kodens text och föreslår koder ur svarsalternativens text, så att den som bygger inte behöver kunna kodverken.
    const f = fm.forhandsvisa(db, sysf, { definition: ENKEL({ falt: [{ id: 'fall', typ: 'val', fraga: 'Fallbenägenhet?', alternativ: [{ varde: 'ja', text: 'Fallbenägenhet' }, { varde: 'nej', text: 'Nej' }] }], skala: undefined }) });
    expect(f.kodforslag).toContainEqual(expect.objectContaining({ falt: 'fall', varde: 'ja', kod: { system: 'icd10', kod: 'R29.6' }, text: 'Fallbenägenhet, som ej klassificeras på annan plats' }));
    expect(fm.kodText({ system: 'kva', kod: 'DV142' })).toBe('Rådgivande samtal om matvanor (KVÅ DV142)');
  });

  test('ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det', () => {
    const db = byggSeed(NU);
    const sysf = personal(db, 'sysf');
    const sysf2 = personal(db, 'sysf-2');
    // Andra roller bygger inte formulär.
    expect(fel(() => fm.foresla(db, personal(db, 'ssk-kard'), { definition: ENKEL(), motivering: 'Prov' }))).toMatchObject({ status: 403 });
    const f = fm.foresla(db, sysf, { definition: ENKEL(), motivering: 'Avdelningen behöver en kort kontroll av nutritionen.' });
    expect(f).toMatchObject({ kod: 'nutritionskontroll', version: 1, status: 'vantar' });
    // Förslaget syns inte bland mallarna förrän det är godkänt, och den som föreslog kan inte godkänna.
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).map(m => m.typ)).not.toContain('Nutritionskontroll');
    expect(fel(() => fm.godkann(db, sysf, f.id, {}))).toMatchObject({ status: 403 });
    const g = fm.godkann(db, sysf2, f.id, { kommentar: 'Granskad.' });
    expect(g).toMatchObject({ status: 'aktiv', beslutadAv: 'Nora Ekholm' });
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).map(m => m.typ)).toContain('Nutritionskontroll');
    const a = atk(db, 'ssk-kard', 'p01');
    const forsta = journal.skapaAnteckning(a, { typ: 'Nutritionskontroll', formular: { aptit: 'nedsatt' } });
    journal.signera(a, journal.hamtaAnteckningRad(db, forsta.id));
    // En ny version: systemet skriver vad som ändrats, och den gamla gäller tills den nya är godkänd.
    const ny = fm.foresla(db, sysf, { kod: 'nutritionskontroll', definition: ENKEL({ falt: [...ENKEL().falt, { id: 'kommentar', typ: 'text', fraga: 'Kommentar', sokord: 'Kommentar' }] }), motivering: 'En kommentar behövs.' });
    expect(ny).toMatchObject({ version: 2, status: 'vantar' });
    expect(ny.andring).toContain('Ny fråga: Kommentar');
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).find(m => m.typ === 'Nutritionskontroll').formular.version).toBe(1);
    // Namnet är anteckningens typ och följer formuläret i alla versioner.
    expect(fel(() => fm.foresla(db, sysf, { kod: 'nutritionskontroll', definition: { ...ENKEL(), namn: 'Annat namn' }, motivering: 'Byt namn' })).message).toContain('Namnet');
    fm.godkann(db, sysf2, ny.id, {});
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).find(m => m.typ === 'Nutritionskontroll').formular.version).toBe(2);
    expect(db.query('SELECT status FROM formular WHERE id = ?').get(f.id).status).toBe('ersatt');
    // Anteckningen som skrevs med version 1 visas med version 1.
    expect(journal.hamtaAnteckning(atk(db, 'ssk-kard', 'p01', 'las_omvardnad'), journal.hamtaAnteckningRad(db, forsta.id)).formular.version).toBe(1);
    // En godkänd definition ändras och raderas aldrig.
    expect(fel(() => db.query('UPDATE formular SET definition = ? WHERE id = ?').run('{}', f.id))).toBeTruthy();
    expect(fel(() => db.query('DELETE FROM formular WHERE id = ?').run(f.id))).toBeTruthy();
    // Avvecklat formulär används inte för nya anteckningar, men de skrivna finns kvar.
    expect(fel(() => fm.avveckla(db, sysf, ny.id, { motivering: '' }))).toMatchObject({ status: 400 });
    fm.avveckla(db, sysf, ny.id, { motivering: 'Ersätts av det nationella formuläret.' });
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).map(m => m.typ)).not.toContain('Nutritionskontroll');
    expect(fel(() => journal.skapaAnteckning(a, { typ: 'Nutritionskontroll', formular: { aptit: 'god' } }))).toMatchObject({ status: 400 });
    expect(journal.listaAnteckningar(atk(db, 'ssk-kard', 'p01', 'las_omvardnad')).anteckningar.some(x => x.id === forsta.id)).toBe(true);
    const o = fm.oversikt(db, sysf);
    expect(o.formular.find(x => x.kod === 'nutritionskontroll').versioner.map(v => v.status)).toEqual(['avvecklad', 'ersatt']);
  });

  test('förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer', () => {
    const db = byggSeed(NU);
    const f = fm.forifyllnad(atk(db, 'ssk-kard', 'p01'), 'sar');
    expect(f.varden.vikt).toMatchObject({ varde: 81.6 });
    expect(f.varden.vikt.kalla).toContain('Senaste mätvärdet');
    expect(f.varden.vikt.kalla).toContain('2026-11-08');
    const fall = fm.forifyllnad(atk(db, 'ssk-kard', 'p01'), 'fallrisk');
    expect(fall.varden.alder).toMatchObject({ varde: alderP01(), kalla: 'Ur personnumret' });
    // Åldern är förifylld och skrivs i anteckningen med källan.
    const a = atk(db, 'ssk-kard', 'p01');
    const ny = journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: { ...FALL, alder: 81 } });
    expect(ny.sokord.map(s => s.text).join('\n')).toContain('Ålder: 81 år (ur personnumret).');
    // Fel ålder går inte att spara: systemet vet åldern.
    expect(fel(() => journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: { ...FALL, alder: 40 } })).message).toContain('81 år');
  });

  test('förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret', () => {
    const svar = (medDold) => {
      const db = byggSeed(NU);
      if (medDold) journal.registreraMatvarde(atk(db, 'lak-psyk', 'p04', 'registrera_matvarde'), { typ: 'vikt', varde: 61 });
      const a = atk(db, 'ssk-kard', 'p04');
      return JSON.stringify(fm.forifyllnad(a, 'sar'));
    };
    const utan = svar(false);
    expect(utan).not.toContain('68.2');
    expect(svar(true)).toBe(utan);
  });

  test('förifyllnaden använder bara den egna vårdenhetens uppgifter utan aktiva val, texten har ingen vårdenhet, och källan visas bara för den som får se den', () => {
    const db = byggSeed(NU);
    const enhetsnamn = db.query('SELECT namn FROM enheter').all().map(r => r.namn);
    const ny = (pid, enhet, varde) => Number(db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES (?, ?, 'vikt', ?, ?, 'kg', ?, 'lak-akut')")
      .run(pid, enhet, String(varde), varde, new Date(Date.now() - 60_000).toISOString()).lastInsertRowid);
    // Ett nyare mätvärde på en annan vårdenhet förifylls inte, inte heller när författaren har gjort aktiva val och nödåtkomst.
    ny('p01', 'uso-akut', 70.2);
    const medVal = atk(db, 'ssk-kard', 'p01', 'skriv_omvardnad', { andra_enheter: { syfte: 'Prov' }, nodatkomst: { syfte: 'Prov' } });
    expect(fm.forifyllnad(medVal, 'sar').varden.vikt.varde).toBe(81.6);
    // Ett nyare mätvärde på en spärrad vårdenhet förifylls aldrig och nämns inte.
    ny('p04', 'uso-psyk', 59.9);
    const sp = JSON.stringify(fm.forifyllnad(atk(db, 'ssk-kard', 'p04', 'skriv_omvardnad', { samtycke_sparr: { syfte: 'Prov' }, andra_enheter: { syfte: 'Prov' } }), 'sar'));
    expect(sp).not.toContain('59.9');
    expect(sp).not.toContain('psyk');
    // Den sparade texten har ingen vårdenhet. Källan sparas som referens.
    const a = journal.skapaAnteckning(medVal, { typ: 'Sårdokumentation', formular: { lage: [{ vy: 'bak', x: 56, y: 95 }], sartyp: 'trycksar', vikt: 81.6 } });
    const text = JSON.stringify(a.sokord);
    for (const n of enhetsnamn) expect(text).not.toContain(n);
    expect(text).toContain('Vikt: 81,6 kg (förifyllt av systemet).');
    // Författaren får se källan när anteckningen läses, med sin egen behörighet.
    const las = (pid, val = {}) => journal.hamtaAnteckning(atk(db, pid, 'p01', 'las_omvardnad', val), journal.hamtaAnteckningRad(db, a.id));
    expect(las('ssk-kard').formular.kallor.vikt).toContain('Senaste mätvärdet 2026-11-08');
    // Pekar källan på ett mätvärde som läsaren inte når, står bara att systemet fyllde i värdet.
    const dolt = ny('p01', 'uso-psyk', 81.6);
    db.query('UPDATE formular_svar SET kallor = ? WHERE anteckning_id = ?').run(JSON.stringify({ vikt: { typ: 'matvarde', matvardeId: dolt } }), a.id);
    const l = las('ssk-kard');
    expect(l.formular.kallor.vikt).toBe('Förifyllt av systemet');
    const helt = JSON.stringify(l);
    expect(helt).not.toContain('psyk');
    expect(helt).not.toContain('Allmänpsykiatriska');
    expect(helt).not.toContain(`"matvardeId":${dolt}`);
    expect(JSON.stringify(fm.ut(db, a.id))).not.toContain(String(dolt));
  });

  test('ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01');
    const antal = () => db.query("SELECT COUNT(*) n FROM matvarden WHERE patient_id = 'p01' AND typ = 'vikt'").get().n;
    const fore = antal();
    // Samma vikt som det senaste mätvärdet: systemet använder det som redan finns.
    const samma = journal.skapaAnteckning(a, { typ: 'Sårdokumentation', formular: { lage: [{ vy: 'bak', x: 56, y: 95 }], sartyp: 'trycksar', vikt: 81.6 } });
    expect(samma.sokord.map(s => s.text).join('\n')).toContain('Vikt: 81,6 kg (förifyllt av systemet).');
    journal.signera(a, journal.hamtaAnteckningRad(db, samma.id));
    expect(antal()).toBe(fore);
    // En ny vikt: registreras en gång som mätvärde när anteckningen signeras, med anteckningens vårdenhet och den som signerade.
    const ny = journal.skapaAnteckning(a, { typ: 'Sårdokumentation', formular: { lage: [{ vy: 'bak', x: 56, y: 95 }], sartyp: 'trycksar', vikt: '80,4' } });
    expect(ny.sokord.map(s => s.text).join('\n')).toContain('Vikt: 80,4 kg (registreras som mätvärde när anteckningen signeras).');
    expect(antal()).toBe(fore);
    const sign = journal.signera(a, journal.hamtaAnteckningRad(db, ny.id));
    expect(antal()).toBe(fore + 1);
    const m = db.query("SELECT * FROM matvarden WHERE patient_id = 'p01' AND typ = 'vikt' ORDER BY id DESC LIMIT 1").get();
    expect(m).toMatchObject({ varde_num: 80.4, registrerad_av: 'ssk-kard', enhet_id: 'uso-kard-72' });
    expect(sign.formular.registrerat).toEqual([{ falt: 'vikt', matvardeId: m.id }]);
    // Värdet finns sedan i mätvärdena, och nästa formulär fyller i det.
    expect(fm.forifyllnad(a, 'sar').varden.vikt.varde).toBe(80.4);
    // En rättelse ändrar aldrig ett mätvärde som redan är registrerat: det rättas under Mätvärden.
    expect(fel(() => journal.ratta(a, journal.hamtaAnteckningRad(db, ny.id), { orsak: 'Fel sårtyp', formular: { lage: [{ vy: 'bak', x: 56, y: 95 }], sartyp: 'venost', vikt: 79 } })).message).toContain('Mätvärden');
    const r = journal.ratta(a, journal.hamtaAnteckningRad(db, ny.id), { orsak: 'Fel sårtyp', formular: { lage: [{ vy: 'bak', x: 56, y: 95 }], sartyp: 'venost', vikt: 80.4 } });
    expect(r.version).toBe(2);
    expect(antal()).toBe(fore + 1);
  });

  test('behörighet per formulär: kategori, yrken och vårdenheter prövas på servern', () => {
    const db = byggSeed(NU);
    // Fallriskbedömningen fylls i av sjuksköterskor och fysioterapeuter, inte av läkare.
    expect(fm.mallarFor(db, personal(db, 'lak-kard')).map(m => m.typ)).not.toContain('Fallriskbedömning');
    expect(fm.mallarFor(db, personal(db, 'fys-kard')).map(m => m.typ)).toContain('Fallriskbedömning');
    expect(fel(() => journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Fallriskbedömning', formular: FALL }))).toMatchObject({ status: 403 });
    // Systemförvaltaren ser inga formulär att fylla i och läser inte journalen.
    expect(fm.mallarFor(db, personal(db, 'sysf'))).toEqual([]);
    // Ett formulär för en vårdenhet erbjuds bara där.
    const f = fm.foresla(db, personal(db, 'sysf'), { definition: ENKEL({ enheter: ['vc-tybble'] }), motivering: 'Bara vårdcentralen.' });
    fm.godkann(db, personal(db, 'sysf-2'), f.id, {});
    expect(fm.mallarFor(db, personal(db, 'ssk-vc')).map(m => m.typ)).toContain('Nutritionskontroll');
    expect(fm.mallarFor(db, personal(db, 'ssk-kard')).map(m => m.typ)).not.toContain('Nutritionskontroll');
    expect(fel(() => journal.skapaAnteckning(atk(db, 'ssk-kard', 'p01'), { typ: 'Nutritionskontroll', formular: { aptit: 'god' } }))).toMatchObject({ status: 403 });
    // Ett formulär för läkarnas dokumentation fylls bara i av läkare.
    expect(fm.forhandsvisa(db, personal(db, 'sysf'), { definition: ENKEL({ kategori: 'lakare', roller: ['sjukskoterska'] }) }).varfor).toContain('bara i av läkare');
    // Ett yrke som inte skriver anteckningar i kategorin kan inte väljas, och systemet säger varför.
    expect(fm.forhandsvisa(db, personal(db, 'sysf'), { definition: ENKEL({ roller: ['underskoterska'] }) }).varfor).toContain('Undersköterska skriver inte omvårdnadsanteckningar');
  });

  test('svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01');
    const ny = journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: FALL });
    journal.signera(a, journal.hamtaAnteckningRad(db, ny.id));
    expect(fel(() => db.query('UPDATE formular_svar SET svar = ? WHERE anteckning_id = ?').run('{}', ny.id))).toBeTruthy();
    expect(fel(() => db.query('DELETE FROM formular_svar WHERE anteckning_id = ?').run(ny.id))).toBeTruthy();
    const r = journal.ratta(a, journal.hamtaAnteckningRad(db, ny.id), { orsak: 'Patienten har inte fallit', formular: { ...FALL, fall: 'nej' } });
    expect(r).toMatchObject({ version: 2, formular: { poang: { summa: 4 } } });
    expect(r.versioner[0].formular.poang.summa).toBe(5);
  });

  test('API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna', async () => {
    const k = klient(app);
    await k.logga('sysf');
    const b = await k.get('/api/formular/byggstenar');
    expect(b.status).toBe(200);
    expect(b.data.datatyper.map(d => d.id)).toContain('bild');
    expect(b.data.mattyper.map(m => m.id)).toContain('vikt');
    expect(b.data.sokord).toContain('Bedömning');
    const fh = await k.post('/api/formular/forhandsvisa', { definition: { ...ENKEL(), namn: 'X' } });
    expect(fh).toMatchObject({ status: 200, data: { ok: false } });
    expect(fh.data.varfor).toContain('namn');
    const ok = await k.post('/api/formular/forhandsvisa', { definition: ENKEL() });
    expect(ok.data.exempel.length).toBeGreaterThan(0);
    const f = await k.post('/api/formular', { definition: ENKEL(), motivering: 'Prov' });
    expect(f.status).toBe(201);
    expect((await k.post(`/api/formular/${f.data.id}/godkann`, {})).status).toBe(403);
    const o = await k.get('/api/formular');
    expect(o.data.formular.find(x => x.kod === 'fallrisk').versioner.some(v => v.status === 'vantar' && v.kanGodkanna)).toBe(true);
    // Den som dokumenterar får formulären bland mallarna, med definitionen.
    const s = klient(app);
    await s.logga('ssk-kard');
    const m = await s.get('/api/mallar');
    const fall = m.data.find(x => x.typ === 'Fallriskbedömning');
    expect(fall).toMatchObject({ kategori: 'omvardnad', strukturerad: true, formular: { kod: 'fallrisk', version: 1 } });
    expect((await s.get('/api/formular')).status).toBe(403);
    const pf = await s.get('/api/patient/p01/formular/sar/forifyllnad');
    expect(pf.status).toBe(200);
    expect(pf.data.varden.vikt.varde).toBe(81.6);
    const ant = await s.post('/api/patient/p01/anteckningar', { typ: 'Fallriskbedömning', formular: FALL });
    expect(ant.status).toBe(201);
    expect(ant.data.formular.poang.summa).toBe(5);
    // Läkaren får inte fylla i fallriskbedömningen, och servern prövar det.
    const l = klient(app);
    await l.logga('lak-kard');
    expect((await l.post('/api/patient/p01/anteckningar', { typ: 'Fallriskbedömning', formular: FALL })).status).toBe(403);
  });

  test('FHIR: formuläret som Questionnaire och svaren som QuestionnaireResponse med samma behörighet som anteckningen', () => {
    const db = byggSeed(NU);
    const a = atk(db, 'ssk-kard', 'p01');
    const ny = journal.skapaAnteckning(a, { typ: 'Fallriskbedömning', formular: FALL });
    journal.signera(a, journal.hamtaAnteckningRad(db, ny.id));
    const qr = fm.fhirSvar(db, journal.hamtaAnteckning(atk(db, 'ssk-kard', 'p01', 'las_omvardnad'), journal.hamtaAnteckningRad(db, ny.id)));
    expect(qr).toMatchObject({ resourceType: 'QuestionnaireResponse', status: 'completed', subject: { reference: 'Patient/p01' } });
    expect(qr.questionnaire).toContain('Questionnaire/fallrisk|1');
    expect(qr.item.find(i => i.linkId === 'fall').answer[0].valueCoding).toMatchObject({ code: 'ja' });
    const q = fm.fhirFormular(db.query("SELECT * FROM formular WHERE kod = 'fallrisk' AND status = 'aktiv'").get());
    expect(q).toMatchObject({ resourceType: 'Questionnaire', id: 'fallrisk-1', status: 'active', name: 'Fallriskbedomning' });
    expect(q.item.find(i => i.linkId === 'fall').type).toBe('choice');
  });
});
