// Graviditet, förlossning och BB i runda 11, r3 (Sussa 4.7.1.1 till 4.7.1.4). Hanna Lilja (ssk-vc) är barnmorskan på
// mödrahälsovården i Vårdcentralen Tybble och Sofia Ekdahl (bm-uso) barnmorskan på förlossningen och BB, USÖ. Testnamnen
// står i src/sussa/runda11-r3.js. Varje test lägger in sina egna patienter och räknar bara på dem.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { datumAv, addDagar } from '../src/db.js';
import * as obs from '../src/obstetrik.js';
import * as forl from '../src/forlossning.js';
import * as gr from '../src/graviditetsregistret.js';
import * as datauttag from '../src/datauttag.js';
import * as seed from '../src/obstetrik-seed.js';
import { GRAVIDITET_R11 as T } from '../src/sussa/runda11-r3.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';
import { testserver, klient, sandlada as serverSandlada } from './hjalp.js';
import testpnr from '../src/seed/testpersonnummer.json' with { type: 'json' };

const IDAG = datumAv(BAS);
const mvc = (db, pid, h = 'graviditet', val = {}) => atk(db, 'ssk-vc', pid, h, val);
const bm = (db, pid, h = 'graviditet') => atk(db, 'bm-uso', pid, h, { andra_enheter: true });
const ny = (db, id, extra = {}) => nyPatient(db, { id, enhet: 'vc-tybble', listning: true, ar: 1993, kon: 'K', fornamn: 'Moa', efternamn: 'Graviddotter', ...extra });
const rad = (db, id) => obs.graviditetRad(db, id);
const frad = (db, id) => obs.forlossningRad(db, id);
const LV = { alkohol: { glasPerVecka: 0, berusning: 'aldrig' }, fysisk: { traningMinuter: 60, vardagMinuter: 150 } };
const SAMTAL = { tobak: { rokning: 'aldrig', snus: 'aldrig' }, vald: { ensam: true, svar: { tidigare: 'nej', nu: 'nej', radd: 'nej' } }, levnadsvanor: LV };
function forlossningsrum(db, id) {
  db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES (?, 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen', 'Förlossning')").run(id, BAS.toISOString());
}
function tillForlossning(db, { antalFoster = 1, id = 'r1', extra = {} } = {}) {
  ny(db, id, extra);
  forlossningsrum(db, id);
  const g = obs.registrera(mvc(db, id), { sistaMens: addDagar(IDAG, -39 * 7), antalFoster }, BAS);
  return obs.startaForlossning(bm(db, id), rad(db, g.id), { oppning: 4, fosterljud: 140, varkor: 3 }, BAS);
}
const barn = (db, f, ordning, min, extra = {}) => obs.fodelse(bm(db, 'r1'), frad(db, f.id), { kon: ordning === 1 ? 'kvinna' : 'man', vikt: 3000, langd: 49, huvudomfang: 34, apgar: [8, 9, 10], ...extra }, efter(min));
const fel = (fn) => { try { fn(); } catch (e) { return e; } throw new Error('inget fel'); };

describe('Graviditet, förlossning och BB', () => {
  test(T.ivf.replace(/^.*> /, ''), () => {
    const db = sandlada();
    ny(db, 'r1');
    const ivf = addDagar(IDAG, -60);
    const g = obs.registrera(mvc(db, 'r1'), { ivf: { overforing: ivf, embryoDagar: 5 } }, BAS);
    expect(g).toMatchObject({ bpd: addDagar(ivf, 261), bpdKalla: 'ivf', ivf: { overforing: ivf, embryoDagar: 5 }, graviditetslangd: { text: 'v 11+2' } });
    expect(g.risk.faktorer.map(f => f.id)).toContain('ivf');
    const u = obs.ultraljud(mvc(db, 'r1'), rad(db, g.id), { typ: 'kub', veckor: 12, dagar: 0 }, BAS);
    expect(u.bpd).toBe(g.bpd);
    expect(u.bpdText).toContain('IVF-graviditeten dateras från embryoöverföringen');
    expect(fel(() => obs.registrera(mvc(db, 'r1'), { ivf: { overforing: ivf, embryoDagar: 4 } }, BAS)).status).toBe(409);
    ny(db, 'r2');
    expect(fel(() => obs.registrera(mvc(db, 'r2'), { ivf: { overforing: ivf, embryoDagar: 4 } }, BAS)).message).toContain('Embryots ålder');
  });

  test(T.ultraljud.replace(/^.*> /, ''), () => {
    const db = sandlada();
    ny(db, 'r1');
    const g = obs.registrera(mvc(db, 'r1'), { sistaMens: addDagar(IDAG, -140) }, BAS);
    // Rutinultraljudet i vecka 18+0 när sista mens säger 20+0: beräknad partus flyttas 14 dagar.
    const r = obs.ultraljud(mvc(db, 'r1'), rad(db, g.id), { typ: 'rutin', veckor: 18, dagar: 0, placenta: 'bakvagg', fostervatten: 'normalt' }, BAS);
    expect(r).toMatchObject({ bpd: addDagar(IDAG, 154), bpdKalla: 'ultraljud', varningar: [] });
    expect(r.ultraljud).toEqual([expect.objectContaining({ typ: 'rutin', typText: 'Rutinultraljud', vecka: 'v 18+0', placenta: 'Bakväggen', datering: true, av: 'Hanna Lilja' })]);
    expect(r.program.besok.find(b => b.vecka === 18).gjort).toBe(true);
    // Ett senare ultraljud daterar inte om.
    const sen = obs.ultraljud(mvc(db, 'r1'), rad(db, g.id), { typ: 'ovrigt', veckor: 23, dagar: 0 }, efter(60));
    expect(sen.bpd).toBe(r.bpd);
    expect(sen.bpdText).toContain('ändrar inte beräknad partus');
    // Tillväxtultraljud i vecka 32: systemet räknar veckan och jämför vikten.
    const g2db = sandlada();
    ny(g2db, 'r2');
    const g2 = obs.registrera(mvc(g2db, 'r2'), { sistaMens: addDagar(IDAG, -32 * 7), antalFoster: 2 }, BAS);
    expect(obs.forvantadVikt(32 * 7)).toBe(1860);
    expect(fel(() => obs.ultraljud(mvc(g2db, 'r2'), rad(g2db, g2.id), { typ: 'tillvaxt', foster: [{ skattadVikt: 1800 }] }, BAS)).message).toContain('foster 2');
    const t = obs.ultraljud(mvc(g2db, 'r2'), rad(g2db, g2.id), { typ: 'tillvaxt', foster: [{ skattadVikt: 1850 }, { skattadVikt: 1350 }], fostervatten: 'lite' }, BAS);
    expect(t.bpd).toBe(g2.bpd);
    expect(t.ultraljud[0]).toMatchObject({ vecka: 'v 32+0', foster: [{ ordning: 1, avvikelse: -1 }, { ordning: 2, skattadVikt: 1350, avvikelse: -27 }] });
    expect(t.varningar).toEqual([
      'Foster 2: skattad vikt 1350 g är 27 procent under den förväntade i vecka 32 (liten för tiden). Läkaren planerar tätare tillväxtkontroller och flödesmätning.',
      'Viktskillnaden mellan fostren är mer än 20 procent. Läkaren bedömer om det kan vara tvillingtransfusion eller tillväxthämning hos ett foster.',
      'Lite fostervatten. Läkaren bedömer fostrets tillväxt och flöden samma vecka.',
    ]);
    expect(fel(() => obs.ultraljud(mvc(g2db, 'r2'), rad(g2db, g2.id), { typ: 'constructor', veckor: 30 }, BAS)).status).toBe(400);
  });

  test(T.samtal.replace(/^.*> /, ''), () => {
    const db = sandlada();
    ny(db, 'r1');
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('r1', 'vc-tybble', 'vikt', '88', 88, ?), ('r1', 'vc-tybble', 'langd', '165', 165, ?)").run(BAS.toISOString(), BAS.toISOString());
    const g = obs.registrera(mvc(db, 'r1'), { sistaMens: addDagar(IDAG, -63), paritet: 0 }, BAS);
    expect(fel(() => obs.samtal(mvc(db, 'r1'), rad(db, g.id), { ...SAMTAL, tobak: { rokning: 'ja' } }, BAS)).message).toContain('snus');
    const s = obs.samtal(mvc(db, 'r1'), rad(db, g.id), {
      ...SAMTAL, tobak: { rokning: 'ja', snus: 'aldrig' }, levnadsvanor: { ...LV, alkohol: { glasPerVecka: 2, berusning: 'aldrig' } },
      anamnes: { tidigarePreeklampsi: true, arftlighetDiabetes: true }, onskemal: { text: 'Vill helst föda i vatten.', smartlindring: ['lustgas', 'bad', 'finns-inte'] },
    }, BAS);
    expect(s.varningar.slice(0, 2)).toEqual([
      'Hon röker. Erbjud stöd att sluta. Rökning under graviditeten ökar risken för tillväxthämning, för tidig förlossning och plötslig spädbarnsdöd.',
      'Hon dricker alkohol. Under graviditeten är rådet att inte dricka alls. Systemet föreslår ett rådgivande samtal om alkohol.',
    ]);
    expect(s.inskrivningssamtal).toMatchObject({ tobak: { rokningText: 'Använder nu' }, valdfragan: { stalld: true, orsak: null, kanLasaSvar: true },
      onskemal: { text: 'Vill helst föda i vatten.', smartlindring: [{ id: 'lustgas', text: 'Lustgas' }, { id: 'bad', text: 'Varmt bad' }] } });
    // Levnadsvanorna är en signerad anteckning av typen Levnadsvanor.
    const a = db.query('SELECT * FROM anteckningar WHERE id = ?').get(s.inskrivningssamtal.anteckningId);
    expect([a.typ, a.status, a.forfattare_id]).toEqual(['Levnadsvanor', 'signerad', 'ssk-vc']);
    // Beslutsstödet: BMI 32,3 och diabetes hos förälder ger förhöjd risk för graviditetsdiabetes och en tidig
    // glukosbelastning, och tidigare havandeskapsförgiftning hög risk.
    expect(s.risk.niva).toBe('hog');
    expect(s.risk.gdm).toMatchObject({ forhojd: true });
    expect(s.risk.gdm.text).toContain('BMI 30 eller mer, diabetes hos förälder eller syskon');
    expect(s.program.besok.find(b => b.vecka === 13)).toMatchObject({ typ: 'Tidig glukosbelastning (förhöjd risk för graviditetsdiabetes)' });
    expect(s.risk.preeklampsi).toMatchObject({ hog: true, skal: ['havandeskapsförgiftning tidigare', 'första förlossningen'] });
    expect(s.attGora).toContain('Hög risk för havandeskapsförgiftning: läkaren bedömer lågdos acetylsalicylsyra.');
    expect(s.program.besok.find(b => b.vecka === 8).gjort).toBe(true);
  });

  test(T.vald.replace(/^.*> /, ''), () => {
    const db = sandlada();
    ny(db, 'r1');
    forlossningsrum(db, 'r1');
    const g = obs.registrera(mvc(db, 'r1'), { sistaMens: addDagar(IDAG, -63) }, BAS);
    const utan = JSON.stringify(obs.graviditetUt(mvc(db, 'r1', 'las_graviditet'), rad(db, g.id), BAS));
    const s = obs.samtal(mvc(db, 'r1'), rad(db, g.id), { ...SAMTAL, vald: { ensam: true, svar: { tidigare: 'ja', nu: 'ja', radd: 'vill_ej' } } }, BAS);
    expect(s.varningar.at(-1)).toContain('Hon är utsatt eller rädd nu.');
    // Graviditetsjournalen är densamma, utom samtalet, oavsett vad som svarades.
    const db2 = sandlada();
    ny(db2, 'r1');
    const g2 = obs.registrera(mvc(db2, 'r1'), { sistaMens: addDagar(IDAG, -63) }, BAS);
    obs.samtal(mvc(db2, 'r1'), rad(db2, g2.id), SAMTAL, BAS);
    const ut1 = obs.graviditetUt(mvc(db, 'r1', 'las_graviditet'), rad(db, g.id), BAS), ut2 = obs.graviditetUt(mvc(db2, 'r1', 'las_graviditet'), rad(db2, g2.id), BAS);
    expect(ut1.inskrivningssamtal.valdfragan).toEqual(ut2.inskrivningssamtal.valdfragan);
    expect(JSON.stringify(ut1)).not.toContain('kansligt');
    expect(utan).not.toContain('valdfragan');
    // Svaren läses bara på mödrahälsovården och läsningen loggas.
    const v = obs.valdsvar(mvc(db, 'r1'), rad(db, g.id));
    expect(v.svar.map(x => x.svar)).toEqual(['Ja', 'Ja', 'Vill inte svara']);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'r1' AND resurs = ?").get(`graviditet:${g.id}:valdfragor`).n).toBe(1);
    const f = fel(() => obs.valdsvar(bm(db, 'r1'), rad(db, g.id)));
    expect([f.status, f.message]).toEqual([403, 'Svaren på frågorna om våld syns bara för mödrahälsovården på den vårdenhet som ställde dem.']);
    expect(obs.graviditetUt(bm(db, 'r1', 'las_graviditet'), rad(db, g.id), BAS).inskrivningssamtal.valdfragan.kanLasaSvar).toBe(false);
    expect(fel(() => obs.valdsvar(atk(db, 'usk-kard', 'r1', 'graviditet'), rad(db, g.id))).status).toBe(403);
    // Uppföljningen och registret är desamma oavsett svaren.
    const u1 = forl.uppfoljning(db, pers(db, 'ssk-vc'), {}, BAS), u2 = forl.uppfoljning(db2, pers(db2, 'ssk-vc'), {}, BAS);
    expect(u1.inskrivning).toEqual(u2.inskrivning);
    const p1 = gr.sammanstall(db, pers(db, 'ssk-vc'), () => ({}), BAS).poster.find(p => p.patient.id === 'r1');
    expect(JSON.stringify(p1.post)).not.toMatch(/"(ja|vill_ej)"/);
    expect(p1.post.valdfraganStalld).toBe(true);
  });

  test(T.valdEj.replace(/^.*> /, ''), () => {
    const db = sandlada();
    ny(db, 'r1');
    const g = obs.registrera(mvc(db, 'r1'), { sistaMens: addDagar(IDAG, -63) }, BAS);
    expect(obs.graviditetUt(mvc(db, 'r1', 'las_graviditet'), rad(db, g.id), BAS).attGora[0]).toContain('Registrera inskrivningssamtalet');
    expect(fel(() => obs.samtal(mvc(db, 'r1'), rad(db, g.id), { ...SAMTAL, vald: { ensam: false } }, BAS)).message).toContain('bara när kvinnan är ensam');
    const s = obs.samtal(mvc(db, 'r1'), rad(db, g.id), { ...SAMTAL, vald: { ensam: false, orsak: 'inte_ensam' } }, BAS);
    expect(s.text).toBe('Inskrivningssamtalet är registrerat. Systemet påminner om frågorna om våld vid nästa besök.');
    expect(s.inskrivningssamtal.valdfragan).toMatchObject({ stalld: false, orsak: 'Kvinnan var inte ensam vid besöket' });
    expect(s.attGora[0]).toBe('Ställ frågorna om våld vid nästa besök, när hon är ensam.');
    expect(fel(() => obs.valdsvar(mvc(db, 'r1'), rad(db, g.id))).status).toBe(404);
  });

  test(T.ctg.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    expect(fel(() => forl.ctgBedomning(bm(db, 'r1'), frad(db, f.id), {}, efter(30))).message).toContain('Koppla CTG först');
    forl.ctgKoppla(bm(db, 'r1'), frad(db, f.id), {}, BAS);
    expect(fel(() => forl.ctgKoppla(bm(db, 'r1'), frad(db, f.id), {}, BAS)).status).toBe(409);
    const c = forl.ctgUt(db, frad(db, f.id), efter(30));
    expect(c.punkter.length).toBe(121);
    expect(c).toMatchObject({ kopplad: true, utrustning: 'CTG-monitor CTG-SIM-1 (simulerad)', klass: 'normal' });
    expect(c.analys[0]).toMatchObject({ basal: expect.any(Number), decelerationer: 0 });
    expect(c.analys[0].accelerationer).toBeGreaterThan(0);
    expect(c.forsenad).toBe(true);
    const b = forl.ctgBedomning(bm(db, 'r1'), frad(db, f.id), {}, efter(30));
    expect(b.bedomningar[0]).toMatchObject({ klass: 'normal', forslag: 'normal', avvekFranForslag: false, av: 'Sofia Ekdahl', atgard: forl.CTG_GORA.normal });
    expect(b.nastaBedomning).toBe(efter(60).toISOString());
    expect(fel(() => forl.ctgBedomning(bm(db, 'r1'), frad(db, f.id), { klass: 'avvikande' }, efter(31))).message).toContain('Skriv varför');
    expect(forl.ctgBedomning(bm(db, 'r1'), frad(db, f.id), { klass: 'avvikande', motivering: 'Svårtolkad signal, ny elektrod.' }, efter(31)).bedomningar[0].avvekFranForslag).toBe(true);
    // Förloppen i den simulerade monitorn.
    for (const [forlopp, klass] of [['avvikande', 'avvikande'], ['patologiskt', 'patologiskt']]) {
      const d = sandlada();
      const ff = tillForlossning(d);
      forl.ctgKoppla(bm(d, 'r1'), frad(d, ff.id), { forlopp }, BAS);
      const u = forl.ctgUt(d, frad(d, ff.id), efter(30));
      expect(u.klass).toBe(klass);
      if (klass === 'patologiskt') {
        expect(u.analys[0].sena).toBeGreaterThanOrEqual(2);
        expect(forl.ctgBedomning(bm(d, 'r1'), frad(d, ff.id), {}, efter(30)).varning).toBe('Patologiskt CTG. Tillkalla förlossningsläkaren nu.');
      }
    }
    const d2 = sandlada();
    const f2 = tillForlossning(d2);
    expect(fel(() => forl.ctgKoppla(bm(d2, 'r1'), frad(d2, f2.id), { forlopp: '__proto__' }, BAS)).status).toBe(400);
  });

  test(T.ctgTvilling.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db, { antalFoster: 2 });
    forl.ctgKoppla(bm(db, 'r1'), frad(db, f.id), { forlopp: 'patologiskt' }, BAS);
    const c = forl.ctgUt(db, frad(db, f.id), efter(30));
    expect(c.punkter[0].fhr.length).toBe(2);
    expect(c.analys.map(a => [a.foster, a.klass])).toEqual([[1, 'patologiskt'], [2, 'normal']]);
    expect(c.klass).toBe('patologiskt');
  });

  test(T.smart.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const tpk = (enhet, v, min) => db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('r1', ?, 'tpk', ?, ?, ?)").run(enhet, String(v), v, efter(min).toISOString());
    // Trombocyter från en annan vårdenhet syns inte utan aktivt val.
    tpk('uso-kard-72', 210, -120);
    const utanVal = atk(db, 'bm-uso', 'r1', 'graviditet');
    expect(forl.foreRegional(utanVal).hinder).toEqual(['Trombocyterna är inte tagna. Ta blodstatus innan EDA eller spinal läggs.']);
    tpk('uso-kk-forl', 62, -60);
    const e = fel(() => forl.smartlindring(bm(db, 'r1'), frad(db, f.id), { metod: 'eda' }, efter(10)));
    expect([e.status, e.message]).toEqual([409, 'Trombocyterna är 62, under 80. Anestesiläkaren bedömer om bedövningen kan läggas. Registrera bedövningen när anestesiläkaren har bedömt patienten.']);
    const ok = forl.smartlindring(bm(db, 'r1'), frad(db, f.id), { metod: 'eda', anestesiBedomd: true }, efter(10));
    expect(ok.varningar[0]).toContain('Anestesiläkaren har bedömt patienten trots');
    const l = forl.smartlindring(bm(db, 'r1'), frad(db, f.id), { metod: 'lustgas' }, efter(11));
    expect(l.smartlindring.map(s => s.text)).toEqual(['Epiduralbedövning (EDA)', 'Lustgas']);
    expect(fel(() => forl.smartlindring(bm(db, 'r1'), frad(db, f.id), { metod: 'hasOwnProperty' }, efter(12))).status).toBe(400);
  });

  test(T.anmalan.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db, { antalFoster: 2 });
    const b1 = barn(db, f, 1, 300), b2 = barn(db, f, 2, 312);
    const fore = db.query('SELECT * FROM patienter WHERE id = ?').get(b1.barnId);
    const a = forl.fodelseanmalan(bm(db, 'r1'), frad(db, f.id), { ordning: 1 }, efter(320));
    expect(a.anmalan.kvittens).toMatch(/^SKV-SIM-\d{6}$/);
    expect(a.anmalan).toMatchObject({ status: 'kvitterad', mottagare: 'Skatteverket (simulerad mottagare)' });
    const efterA = db.query('SELECT * FROM patienter WHERE id = ?').get(b1.barnId);
    expect(efterA.id_typ).toBe('personnummer');
    expect(testpnr).toContain(efterA.personnummer);
    expect(Number(efterA.personnummer[10]) % 2).toBe(0);
    expect(efterA.fodd).toBe(fore.fodd);
    expect(db.query("SELECT status FROM identiteter WHERE patient_id = ? AND typ = 'reservnummer'").get(b1.barnId).status).toBe('tidigare');
    const a2 = forl.fodelseanmalan(bm(db, 'r1'), frad(db, f.id), { ordning: 2 }, efter(321));
    expect(Number(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(b2.barnId).personnummer[10]) % 2).toBe(1);
    expect(a2.anmalan.personnummer).not.toBe(a.anmalan.personnummer);
    expect(fel(() => forl.fodelseanmalan(bm(db, 'r1'), frad(db, f.id), { ordning: 1 }, efter(322))).status).toBe(409);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = ? AND resurs = ?").get(b1.barnId, `fodelseanmalan:${a.anmalan.kvittens}`).n).toBe(1);
    // En mor med reservnummer är inte folkbokförd.
    const d = sandlada();
    const g = tillForlossning(d);
    d.query("UPDATE patienter SET id_typ = 'reservnummer' WHERE id = 'r1'").run();
    const bb = barn(d, g, 1, 300);
    const x = forl.fodelseanmalan(bm(d, 'r1'), frad(d, g.id), { ordning: 1 }, efter(320));
    expect(x.anmalan.status).toBe('ej_folkbokford');
    expect(x.text).toContain('barnet behåller reservnumret');
    expect(d.query('SELECT id_typ FROM patienter WHERE id = ?').get(bb.barnId).id_typ).toBe('reservnummer');
  });

  test(T.bb.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const b = barn(db, f, 1, 300, { vikt: 3500 });
    const mor = (min, body) => forl.bbKontroll(bm(db, 'r1'), body, efter(min));
    const bk = (min, body) => forl.bbKontroll(bm(db, b.barnId), body, efter(min));
    const m1 = mor(360, { temp: 38.4, blodning: 'riklig', urinerat: false, blodtryck: '118/72' });
    expect(m1.varningar).toEqual([
      'Feber 38,4 grader efter förlossningen. Kontakta läkare: risk för infektion i livmodern, brösten eller urinvägarna.',
      'Risk för blödning: massera livmodern, mät blödningen och tillkalla läkare.',
    ]);
    expect(mor(700, { urinerat: false }).varningar).toEqual(['Hon har inte kissat på sex timmar sedan förlossningen. Mät blåsan med ultraljud.']);
    expect(db.query("SELECT varde FROM matvarden WHERE patient_id = 'r1' AND typ = 'temp'").get().varde).toBe('38.4');
    const k1 = bk(1500, { vikt: 3200, temp: 36.2, hudfarg: 'gulaktig', maltider: 6 });
    expect(k1.barn.senasteVikt).toMatchObject({ vikt: 3200, viktnedgang: 8.6 });
    expect(k1.varningar).toEqual([
      'Barnet har gått ner 8,6 procent. Stöd amningen och väg igen i morgon.',
      'Temperaturen 36,2 ligger utanför 36,5 till 37,5. Hud mot hud och mät igen om en timme.',
      'Barnet är gulaktigt. Mät bilirubinet i huden och kontakta barnläkaren om värdet ligger över gränsen för åldern i timmar.',
      'Färre än åtta måltider det senaste dygnet. Väck barnet för mat och stöd amningen.',
    ]);
    expect(bk(1510, { vikt: 3140 }).varningar[0]).toContain('Barnet har gått ner 10,3 procent från födelsevikten 3500 g.');
    // PKU tas från 48 timmar.
    const pku = fel(() => forl.bbScreening(bm(db, b.barnId), { typ: 'pku' }, efter(1520)));
    expect([pku.status, pku.extra.tidigast]).toEqual([409, efter(300 + 48 * 60).toISOString()]);
    // Utskrivningen prövas.
    const u = fel(() => forl.utskrivning(bm(db, 'r1'), {}, efter(1530)));
    expect(u.status).toBe(409);
    expect(u.extra.saknas).toEqual(expect.arrayContaining(['Moderns senaste kontroll har inga varningar.', 'Modern har kissat efter förlossningen.', 'Flicka: k-vitamin är gjord.']));
    for (const typ of ['kvitamin', 'pulsoximetri', 'barnlakare', 'horsel']) forl.bbScreening(bm(db, b.barnId), { typ }, efter(1540));
    expect(fel(() => forl.bbScreening(bm(db, b.barnId), { typ: 'horsel' }, efter(1541))).status).toBe(409);
    mor(1550, { temp: 37.0, blodning: 'normal', livmoder: 'fast', urinerat: true });
    bk(1555, { vikt: 3260 });
    expect(fel(() => forl.utskrivning(bm(db, 'r1'), {}, efter(1560))).extra.saknas).toEqual(['Flicka: PKU-provet är taget eller bokat som återbesök.']);
    expect(fel(() => forl.utskrivning(bm(db, b.barnId), {}, efter(1560))).message).toContain('moderns journal');
    const ut = forl.utskrivning(bm(db, 'r1'), { pkuAterbesok: true }, efter(1560));
    expect(ut.text).toBe('Mor och barn är utskrivna från BB. Mödrahälsovården bokar efterkontrollen och barnavårdscentralen hembesöket.');
    expect(db.query("SELECT count(*) AS n FROM vardkontakter WHERE patient_id IN ('r1', ?) AND enhet_id = 'uso-kk-forl' AND slut IS NULL").get(b.barnId).n).toBe(0);
    expect(fel(() => mor(1570, { temp: 37 })).status).toBe(409);
  });

  test(T.efterkontroll.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const gid = frad(db, f.id).graviditet_id;
    expect(fel(() => obs.efterkontroll(mvc(db, 'r1'), rad(db, gid), { epds: 4, amning: 'helt' }, efter(60))).status).toBe(409);
    barn(db, f, 1, 300);
    expect(obs.mhvOversikt(db, pers(db, 'ssk-vc'), () => ({}), efter(400)).graviditeter.find(x => x.patientId === 'r1').attGora).toEqual(['Boka efterkontrollen 6 till 12 veckor efter förlossningen.']);
    expect(fel(() => obs.efterkontroll(bm(db, 'r1'), rad(db, gid), { epds: 4, amning: 'helt' }, efter(400))).status).toBe(403);
    const e = obs.efterkontroll(mvc(db, 'r1'), rad(db, gid), { epds: 13, epdsFraga10: 0, amning: 'delvis', blodning: 'mycket', bristningLakt: false }, efter(60 * 24 * 50));
    expect(e.varningar).toEqual([
      'EPDS 13 poäng tyder på nedstämdhet efter förlossningen (12 poäng eller mer). Erbjud stödsamtal och kontakta läkare.',
      'Riklig blödning efter förlossningen. Kontakta läkare samma dag.',
      'Bristningen har inte läkt. Remittera till kvinnokliniken.',
    ]);
    expect(obs.efterkontroll(mvc(db, 'r1'), rad(db, gid), { epds: 6, epdsFraga10: 1, amning: 'helt' }, efter(60 * 24 * 51)).varningar).toEqual(['Hon har haft tankar på att skada sig själv. Kontakta läkare i dag och stanna kvar tills hon har fått hjälp.']);
    expect(e.efterkontroll[0]).toMatchObject({ epds: 13, amning: 'Delvis amning', av: 'Hanna Lilja' });
    expect(obs.mhvOversikt(db, pers(db, 'ssk-vc'), () => ({}), efter(60 * 24 * 52)).graviditeter.find(x => x.patientId === 'r1')).toBeUndefined();
  });

  test(T.register.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const gid = frad(db, f.id).graviditet_id;
    obs.samtal(mvc(db, 'r1'), rad(db, gid), SAMTAL, BAS);
    const egna = (roll, nu = BAS) => gr.sammanstall(db, pers(db, roll), () => ({}), nu).poster.filter(p => p.patient.id === 'r1');
    expect(egna('ssk-vc')).toEqual([expect.objectContaining({ typ: 'inskrivning', fel: [{ text: 'Längd och vikt vid inskrivningen saknas. Registret behöver BMI.', href: '#/patient/r1/matvarden' }] })]);
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('r1', 'vc-tybble', 'vikt', '70', 70, ?), ('r1', 'vc-tybble', 'langd', '168', 168, ?)").run(BAS.toISOString(), BAS.toISOString());
    expect(egna('ssk-vc')[0]).toMatchObject({ fel: [], post: { typ: 'inskrivning', bmi: 24.8, rokning: 'aldrig', valdfraganStalld: true, paritet: 0 } });
    // Förlossningen rapporteras av förlossningen, när barnet har personnummer och smärtlindringen är registrerad.
    const b = barn(db, f, 1, 300);
    expect(egna('bm-uso', efter(310))[0].fel.map(x => x.text)).toEqual(['Smärtlindringen är inte registrerad. Registrera vad som gavs, eller Ingen smärtlindring.', 'Barnets personnummer har inte kommit från Skatteverket. Skicka födelseanmälan.']);
    db.query("INSERT INTO smartlindring (forlossning_id, patient_id, enhet_id, tid, metod, av) VALUES (?, 'r1', 'uso-kk-forl', ?, 'lustgas', 'bm-uso')").run(f.id, efter(200).toISOString());
    forl.fodelseanmalan(bm(db, 'r1'), frad(db, f.id), { ordning: 1 }, efter(320));
    const fp = egna('bm-uso', efter(330))[0];
    expect(fp).toMatchObject({ typ: 'forlossning', fel: [], post: { smartlindring: ['lustgas'], graviditetsvecka: 39, barn: [{ ordning: 1, vikt: 3000 }] } });
    expect(fp.post.barn[0].person).toBe(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(b.barnId).personnummer);
    // Utskicket: kvittens, en logg per patient och inget skickas två gånger. Utskicket sparar inga personuppgifter.
    const [st, s] = gr.skicka(db, pers(db, 'bm-uso'), () => ({}), efter(340));
    expect(st).toBe(201);
    expect(s.kvittens).toMatch(/^GR-SIM-\d{6}$/);
    expect(egna('bm-uso', efter(341))).toEqual([]);
    const inn = db.query('SELECT innehall FROM graviditetsregister_utskick WHERE id = ?').get(s.id).innehall;
    expect(inn).not.toContain(db.query("SELECT personnummer FROM patienter WHERE id = 'r1'").get().personnummer);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'r1' AND resurs = ?").get(`graviditetsregistret:utskick:${s.id}`).n).toBe(1);
    // Patienten motsätter sig: inskrivningen hålls inte kvar utan räknas som undantagen.
    const foreUndantag = gr.sammanstall(db, pers(db, 'ssk-vc'), () => ({}), BAS).undantagna.motsatt;
    expect(gr.motsatt(mvc(db, 'r1'), rad(db, gid), { motsatt: true }).registerMotsatt).toBe(true);
    const m = gr.sammanstall(db, pers(db, 'ssk-vc'), () => ({}), BAS);
    expect(m.poster.filter(p => p.patient.id === 'r1')).toEqual([]);
    expect(m.undantagna.motsatt).toBe(foreUndantag + 1);
    expect(fel(() => gr.motsatt(bm(db, 'r1'), rad(db, gid), { motsatt: false })).status).toBe(403);
    expect(fel(() => gr.sammanstall(db, pers(db, 'lak-kard'))).status).toBe(403);
    expect(fel(() => gr.sammanstall(db, pers(db, 'usk-kard'))).status).toBe(403);
  });

  test(T.uppfoljning.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const fore = forl.uppfoljning(db, pers(db, 'bm-uso'), {}, efter(600));
    const f = tillForlossning(db, { extra: { fornamn: 'Unika', efternamn: 'Namnsson' } });
    forl.ctgKoppla(bm(db, 'r1'), frad(db, f.id), { forlopp: 'patologiskt' }, BAS);
    forl.ctgBedomning(bm(db, 'r1'), frad(db, f.id), {}, efter(30));
    forl.smartlindring(bm(db, 'r1'), frad(db, f.id), { metod: 'lustgas' }, efter(40));
    barn(db, f, 1, 300);
    const u = forl.uppfoljning(db, pers(db, 'bm-uso'), {}, efter(600));
    expect(u.forlossningar.antal).toBe(fore.forlossningar.antal + 1);
    expect(u.fodelseanmalan.barn).toBe(fore.fodelseanmalan.barn + 1);
    expect(u.smartlindring.find(s => s.id === 'lustgas').andel).toBeGreaterThan(0);
    expect(u.ctg.patologisktAndel).toBeGreaterThan(0);
    const text = JSON.stringify(u);
    for (const x of ['r1', 'Unika', 'Namnsson']) expect(text).not.toContain(x);
    expect(fel(() => forl.uppfoljning(db, pers(db, 'usk-kard'), {}, BAS)).message).toContain('uppföljningen');
  });

  test(T.oversikt.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    forl.ctgKoppla(bm(db, 'r1'), frad(db, f.id), {}, BAS);
    const o = forl.oversikt(db, pers(db, 'bm-uso'), () => ({}), efter(30)).pagaende.find(x => x.patientId === 'r1');
    expect(o).toMatchObject({ namn: 'Moa Graviddotter', vecka: 'v 39+0', oppning: 4, ctg: { klass: 'normal', forsenad: true } });
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'r1' AND resurs = 'forlossning:oversikt'").get().n).toBe(1);
    expect(fel(() => forl.oversikt(db, pers(db, 'ssk-vc'))).status).toBe(403);
    expect(fel(() => obs.mhvOversikt(db, pers(db, 'bm-uso'))).status).toBe(403);
    expect(obs.mhvOversikt(db, pers(db, 'ssk-vc'), () => ({}), BAS).graviditeter.find(x => x.patientId === 'r1')).toMatchObject({ vecka: 'v 39+0', risk: { niva: 'normal' } });
    // En spärr mot mödrahälsovården: graviditeten syns inte i förlossningsjournalen ens med aktivt val.
    const d = sandlada();
    const g = tillForlossning(d);
    sparr(d, 'r1', 'vc-tybble');
    expect(forl.forlossningFor(bm(d, 'r1', 'las_graviditet'), efter(30)).graviditet).toBeNull();
    expect(forl.forlossningFor(bm(d, 'r1', 'las_graviditet'), efter(30)).forlossning.id).toBe(g.id);
  });

  test(T.sakerhet.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const b = barn(db, f, 1, 300);
    ny(db, 'r9');
    forlossningsrum(db, 'r9');
    const A = atk(db, 'bm-uso', 'r9', 'graviditet');
    for (const x of [() => forl.ctgKoppla(A, frad(db, f.id), {}, BAS), () => forl.ctgBedomning(A, frad(db, f.id), {}, BAS), () => forl.smartlindring(A, frad(db, f.id), { metod: 'lustgas' }, BAS),
      () => forl.fodelseanmalan(A, frad(db, f.id), { ordning: 1 }, BAS), () => obs.samtal(A, rad(db, frad(db, f.id).graviditet_id), SAMTAL, BAS),
      () => obs.valdsvar(A, rad(db, frad(db, f.id).graviditet_id)), () => gr.motsatt(A, rad(db, frad(db, f.id).graviditet_id), {})]) {
      const e = fel(x);
      expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']);
    }
    // En annan vårdenhet ändrar inte förlossningen eller BB ens med aktivt val.
    const ssk = atk(db, 'ssk-kard', 'r1', 'graviditet', { andra_enheter: true });
    expect(fel(() => forl.ctgKoppla(ssk, frad(db, f.id), {}, BAS)).status).toBe(403);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES (?, 'uso-kard-72', 'slutenvard', ?, 'Avdelning', 'Test')").run(b.barnId, BAS.toISOString());
    expect(fel(() => forl.bbKontroll(atk(db, 'ssk-kard', b.barnId, 'graviditet', { andra_enheter: true }), { vikt: 3000 }, efter(400))).status).toBe(403);
    expect(fel(() => forl.bbKontroll(atk(db, 'usk-kard', b.barnId, 'graviditet', { andra_enheter: true }), { vikt: 3000 }, efter(400))).status).toBe(403);
  });

  test(T.datauttag.replace(/^.*> /, ''), () => {
    const db = sandlada();
    const f = tillForlossning(db, { extra: { fornamn: 'Unika', efternamn: 'Namnsson' } });
    obs.samtal(mvc(db, 'r1'), rad(db, frad(db, f.id).graviditet_id), { ...SAMTAL, vald: { ensam: true, svar: { tidigare: 'ja', nu: 'ja', radd: 'ja' } } }, BAS);
    barn(db, f, 1, 300);
    const { data } = datauttag.bygg(db);
    for (const t of ['Graviditet', 'Forlossning']) {
      expect(data[t].length).toBeGreaterThan(0);
      for (const r of data[t]) expect(Object.keys(r).sort()).toEqual(Object.keys(datauttag.SCHEMA[t].falt).sort());
    }
    const json = JSON.stringify({ g: data.Graviditet, f: data.Forlossning });
    for (const x of ['Unika', 'Namnsson', '"r1"', db.query("SELECT personnummer FROM patienter WHERE id = 'r1'").get().personnummer]) expect(json).not.toContain(x);
    expect(data.Graviditet.some(r => r.valdfraganStalld === true)).toBe(true);
    expect(json).not.toMatch(/"(tidigare|nu|radd)":|kansligt|vill_ej/);
  });
});

describe('Graviditet, förlossning och BB', () => {
  test(T.barnSkydd.replace(/^.*> /, ''), () => {
    const forbered = () => {
      const db = sandlada();
      const f = tillForlossning(db);
      db.query("INSERT INTO smartlindring (forlossning_id, patient_id, enhet_id, tid, metod, av) VALUES (?, 'r1', 'uso-kk-forl', ?, 'lustgas', 'bm-uso')").run(f.id, efter(200).toISOString());
      const b = barn(db, f, 1, 300);
      forl.fodelseanmalan(bm(db, 'r1'), frad(db, f.id), { ordning: 1 }, efter(320));
      return { db, f, barnId: b.barnId, pnr: db.query('SELECT personnummer FROM patienter WHERE id = ?').get(b.barnId).personnummer };
    };
    const egna = (db) => gr.sammanstall(db, pers(db, 'bm-uso'), () => ({}), efter(330));
    // Barnet har skyddade personuppgifter: raden och posten lämnas inte ut, och räknas som utelämnade.
    for (const skydd of ['skyddad', 'sparr']) {
      const { db, barnId, pnr } = forbered();
      const fore = datauttag.bygg(db);
      const foreReg = egna(db);
      expect(foreReg.poster.some(p => p.patient.id === 'r1' && p.typ === 'forlossning')).toBe(true);
      if (skydd === 'skyddad') db.query('UPDATE patienter SET skyddad = 1 WHERE id = ?').run(barnId);
      else sparr(db, barnId, 'uso-kk');
      const efterSkydd = datauttag.bygg(db);
      expect(efterSkydd.data.Forlossning.length).toBe(fore.data.Forlossning.length - 1);
      expect(efterSkydd.utelamnat.skyddadeUppgifter + efterSkydd.utelamnat.sparrade).toBeGreaterThan(fore.utelamnat.skyddadeUppgifter + fore.utelamnat.sparrade);
      if (skydd !== "skyddad") continue;
      const reg = egna(db);
      expect(reg.poster.some(p => p.patient.id === 'r1' && p.typ === 'forlossning')).toBe(false);
      expect(JSON.stringify(reg)).not.toContain(pnr);
      expect(reg.undantagna.skyddad).toBe(foreReg.undantagna.skyddad + 1);
    }
  });

  test(T.seed.replace(/^.*> /, ''), () => {
    // Samma seed oavsett tid på dygnet, också mellan 23 och 01 svensk tid.
    for (const bas of [BAS, new Date('2026-11-12T22:30:00Z'), new Date('2026-11-12T23:30:00Z')]) {
      const db = sandlada(bas);
      expect(seed.seeda(db, bas).laddad).toBe(true);
      expect(seed.seeda(db, bas).laddad).toBe(false);
      const m = (pid) => atk(db, 'ssk-vc', pid, 'las_graviditet');
      const g1 = obs.forPatient(m('obs1'), bas).graviditeter[0];
      expect(g1).toMatchObject({ status: 'pagaende', graviditetslangd: { text: 'v 30+2' }, inskrivningssamtal: { valdfragan: { stalld: true } } });
      expect([g1.ultraljud.length, g1.besok.length, g1.sfKurva.length]).toEqual([1, 2, 2]);
      expect(obs.forPatient(m('obs2'), bas).graviditeter[0].attGora[0]).toContain('Registrera inskrivningssamtalet');
      const o = forl.oversikt(db, pers(db, 'bm-uso'), () => ({}), bas);
      expect(o.pagaende.map(x => [x.patientId, x.oppning, x.ctg?.klass, x.ctg?.forsenad])).toEqual([['obs3', 7, 'normal', false]]);
      expect(o.bb.map(x => [x.patientId, x.antalFoster, x.barn.map(b => b.anmalan)])).toEqual([['obs4', 2, ['kvitterad', null]]]);
      expect(o.bb[0].barn.map(b => b.timmar)).toEqual([20, 19]);
      expect(obs.mhvOversikt(db, pers(db, 'ssk-vc'), () => ({}), bas).graviditeter.map(x => x.patientId)).toEqual(expect.arrayContaining(['obs1', 'obs2', 'obs3']));
    }
  });
});

// API: rutterna med demorollerna och gränssnittets anrop.
let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

describe('Graviditet, förlossning och BB', () => {
  test(T.api.replace(/^.*> /, ''), async () => {
    const k = klient(app);
    await k.logga('bm-uso');
    expect((await k.get('/api/session')).data.obstetrik).toEqual({ mhv: false, forlossning: true });
    const db = serverSandlada(app, k).db;
    const nu = new Date();
    nyPatient(db, { id: 'ar1', enhet: 'vc-tybble', listning: true, ar: 1991, kon: 'K', start: nu });
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('ar1', 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen', 'Förlossning')").run(nu.toISOString());
    const sm = new Date(nu.getTime() - 39 * 7 * 86400_000).toISOString().slice(0, 10);
    db.query("INSERT INTO graviditeter (patient_id, enhet_id, registrerad_av, skapad, sista_mens, bpd, bpd_kalla, antal_foster, paritet, status) VALUES ('ar1', 'uso-kk', 'bm-uso', ?, ?, ?, 'sista_mens', 1, 0, 'pagaende')")
      .run(nu.toISOString(), sm, new Date(nu.getTime() + 7 * 86400_000).toISOString().slice(0, 10));
    const gid = db.query("SELECT id FROM graviditeter WHERE patient_id = 'ar1'").get().id;
    const f = await k.post(`/api/graviditet/${gid}/forlossning`, { oppning: 5 });
    expect(f.status).toBe(200);
    expect((await k.post(`/api/forlossning/${f.data.id}/ctg`, {})).data.kopplad).toBe(true);
    expect((await k.post(`/api/forlossning/${f.data.id}/smartlindring`, { metod: 'lustgas' })).data.smartlindring.length).toBe(1);
    const d = await k.get('/api/patient/ar1/forlossning');
    expect(d.data).toMatchObject({ forlossning: { id: f.data.id }, ctg: { kopplad: true }, kanRegistrera: true });
    expect((await k.get('/api/forlossning')).data.pagaende.map(x => x.patientId)).toContain('ar1');
    const b = await k.post(`/api/forlossning/${f.data.id}/fodelse`, { kon: 'kvinna', vikt: 3400, langd: 50, huvudomfang: 35, apgar: [9, 10, 10] });
    expect(b.data.status).toBe('avslutad');
    expect((await k.post(`/api/forlossning/${f.data.id}/fodelseanmalan`, { ordning: 1 })).data.anmalan.status).toBe('kvitterad');
    expect((await k.post(`/api/patient/${b.data.barnId}/bb`, { vikt: 3350 })).status).toBe(201);
    expect((await k.get(`/api/patient/${b.data.barnId}/bb`)).data.barn.senasteVikt.vikt).toBe(3350);
    expect((await k.get('/api/graviditetsregistret')).status).toBe(200);
    expect((await k.get('/api/modrahalsovard')).status).toBe(403);
    // Demodata i den egna sandlådan, en gång.
    expect((await k.post('/api/demo/obstetrik', {})).data.laddad).toBe(true);
    expect((await k.post('/api/demo/obstetrik', {})).data.laddad).toBe(false);
    expect((await k.get('/api/forlossning')).data.pagaende.map(x => x.patientId)).toContain('obs3');
    expect((await k.post(`/api/forlossning/${f.data.id}/constructor`, {})).status).toBe(404);
    // Hanna Lilja har mödrahälsovården.
    await k.logga('ssk-vc');
    expect((await k.get('/api/session')).data.obstetrik).toEqual({ mhv: true, forlossning: false });
    expect((await k.get('/api/modrahalsovard')).status).toBe(200);
    expect((await k.get('/api/forlossning')).status).toBe(403);
  });
});
