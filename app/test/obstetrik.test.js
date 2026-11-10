// Mödrahälsovård, graviditet och förlossning (runda 9, r3, Sussa 4.7.1.1 till 4.7.1.4). Barnmorskan på vårdcentralen
// (Hanna Lilja) för graviditetsjournalen och barnmorskan på förlossningen (Sofia Ekdahl) förlossningsjournalen.
import { describe, test, expect } from 'bun:test';
import { datumAv, addDagar } from '../src/db.js';
import * as obs from '../src/obstetrik.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter, utanObstetrikseed } from './specialist.js';

const IDAG = datumAv(BAS);
const mvc = (db, pid = 'gr1', h = 'graviditet', val = {}) => atk(db, 'ssk-vc', pid, h, val);
// Förlossningen läser graviditetsjournalen från vårdcentralen efter ett aktivt val.
const bm = (db, pid = 'gr1', h = 'graviditet') => atk(db, 'bm-uso', pid, h, { andra_enheter: true });
const ny = (db, id = 'gr1', extra = {}) => nyPatient(db, { id, enhet: 'vc-tybble', listning: true, ar: 1993, kon: 'K', fornamn: 'Moa', efternamn: 'Graviddotter', ...extra });
const grav = (db, body, pid = 'gr1', nu = BAS) => obs.registrera(mvc(db, pid), body, nu);
const rad = (db, id) => obs.graviditetRad(db, id);
// En graviditet i vecka 39 med förlossning på kvinnokliniken.
function tillForlossning(db, { antalFoster = 1, id = 'gr1' } = {}) {
  ny(db, id);
  db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES (?, 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen', 'Förlossning')").run(id, BAS.toISOString());
  const g = grav(db, { sistaMens: addDagar(IDAG, -39 * 7), antalFoster }, id);
  return obs.startaForlossning(bm(db, id), rad(db, g.id), { oppning: 4, fosterljud: 140, varkor: 3 }, BAS);
}

describe('Graviditet och förlossning', () => {
  test('graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar', () => {
    const db = sandlada();
    ny(db);
    const g = grav(db, { sistaMens: addDagar(IDAG, -70) });
    expect(g).toMatchObject({ bpd: addDagar(IDAG, 210), bpdKalla: 'sista_mens', graviditetslangd: { dagar: 70, text: 'v 10+0' }, antalFoster: 1, status: 'pagaende' });
    expect(g.bpdText).toBe('Beräknad från sista mens.');
    expect(() => grav(db, { sistaMens: addDagar(IDAG, -70) })).toThrow('redan en pågående graviditet');
    // Ultraljudet i vecka 12+0 i dag, två veckor efter sista mens: BPD räknas från ultraljudet.
    const u = obs.ultraljud(mvc(db), rad(db, g.id), { veckor: 12, dagar: 0 }, BAS);
    expect(u).toMatchObject({ bpd: addDagar(IDAG, 196), bpdKalla: 'ultraljud', graviditetslangd: { text: 'v 12+0' } });
    expect(u.bpdText).toBe('Ultraljudet skiljer 14 dagar från sista mens, så systemet räknar från ultraljudet.');
    const nara = obs.ultraljud(mvc(db), rad(db, g.id), { veckor: 10, dagar: 4 }, BAS);
    expect(nara).toMatchObject({ bpd: addDagar(IDAG, 210), bpdKalla: 'sista_mens' });
    nyPatient(db, { id: 'man1', enhet: 'vc-tybble', listning: true, kon: 'M' });
    expect(() => grav(db, { sistaMens: addDagar(IDAG, -70) }, 'man1')).toThrow('för en kvinna');
  });

  test('besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök', () => {
    const db = sandlada();
    ny(db);
    const g = grav(db, { sistaMens: addDagar(IDAG, -55) });
    expect(g.program.besok.map(b => b.vecka)).toEqual([8, 12, 18, 25, 28, 31, 33, 35, 37, 39, 40, 41]);
    expect(g.program.nasta).toMatchObject({ vecka: 8, typ: 'Inskrivning hos barnmorska', datum: addDagar(IDAG, 1) });
    expect(g.program.nasta.prover.map(p => p.analys)).toEqual(['blodstatus', 'blodgruppering', 'bastest', 'urinodling']);
    const b = obs.bestallProver(atk(db, 'ssk-vc', 'gr1', 'bestalla_prov_uppdrag'), rad(db, g.id), BAS);
    expect(b.bestallning.analyser.map(a => a.analys).sort()).toEqual(['bastest', 'blodgruppering', 'blodstatus', 'urinodling']);
    expect(b.text).toContain('Per Holm signerar i inkorgen');
    expect(() => obs.bestallProver(atk(db, 'ssk-vc', 'gr1', 'bestalla_prov_uppdrag'), rad(db, g.id), efter(5))).toThrow('redan beställda');
    obs.besok(mvc(db), rad(db, g.id), { blodtryck: '112/70', vikt: 64 }, efter(24 * 60));
    expect(obs.graviditetUt(mvc(db, 'gr1', 'las_graviditet'), rad(db, g.id), efter(24 * 60)).program.nasta.vecka).toBe(12);
  });

  test('riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök', () => {
    const db = sandlada();
    ny(db, 'gr2', { ar: 1984 });
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('gr2', 'vc-tybble', 'E11.9', 'Typ 2-diabetes', 'huvud', '2024-01-01')").run();
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES ('gr2', 'vc-tybble', 'vikt', '96', 96, ?), ('gr2', 'vc-tybble', 'langd', '168', 168, ?)").run(BAS.toISOString(), BAS.toISOString());
    const g = grav(db, { sistaMens: addDagar(IDAG, -60), antalFoster: 2, paritet: 1, tidigareKejsarsnitt: 1 }, 'gr2');
    expect(g.risk.niva).toBe('hog');
    expect(g.risk.faktorer.map(f => f.id)).toEqual(['alder', 'flerbord', 'kejsarsnitt', 'bmi', 'diabetes']);
    expect(g.risk.faktorer.find(f => f.id === 'bmi').text).toBe('BMI 34,0.');
    expect(g.program.besok.map(b => b.vecka)).toEqual([8, 12, 12, 18, 24, 25, 28, 28, 31, 32, 32, 33, 35, 36, 37, 39, 40, 41]);
    ny(db, 'gr3', { ar: 1996 });
    expect(grav(db, { sistaMens: addDagar(IDAG, -60) }, 'gr3').risk).toMatchObject({ niva: 'normal', faktorer: [] });
    expect(() => grav(db, { sistaMens: addDagar(IDAG, -60), paritet: 0, tidigareKejsarsnitt: 1 }, 'gr3')).toThrow();
  });

  test('vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde', () => {
    const db = sandlada();
    ny(db);
    const g = grav(db, { sistaMens: addDagar(IDAG, -30 * 7) });
    const b = obs.besok(mvc(db), rad(db, g.id), { blodtryck: '152/96', urinProtein: 2, sfMatt: 25, fosterljud: 172, vikt: 78 }, BAS);
    expect(b.varningar).toEqual([
      'Förhöjt blodtryck och protein i urinen kan vara havandeskapsförgiftning (preeklampsi). Kontakta läkare och förlossningen nu.',
      'Symfys-fundusmåttet 25 cm avviker från det förväntade i vecka 30. Boka ett tillväxtultraljud.',
      'Fosterljuden 172 slag per minut ligger utanför 110 till 160. Kontakta förlossningen.',
    ]);
    expect(b.besok[0]).toMatchObject({ vecka: 'v 30+0', blodtryck: '152/96', av: 'Hanna Lilja' });
    expect(db.query("SELECT typ, varde FROM matvarden WHERE patient_id = 'gr1' ORDER BY typ").all()).toEqual([{ typ: 'blodtryck', varde: '152/96' }, { typ: 'vikt', varde: '78' }]);
    expect(obs.besok(mvc(db), rad(db, g.id), { blodtryck: '146/92' }, efter(60)).varningar).toEqual(['Blodtrycket är förhöjt. Kontrollera urinen för protein och kontakta läkare samma dag.']);
    expect(obs.besok(mvc(db), rad(db, g.id), { blodtryck: '118/74', sfMatt: 30, fosterljud: 140 }, efter(120)).varningar).toEqual([]);
  });

  test('partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt', () => {
    const db = sandlada();
    const f = tillForlossning(db);
    expect(f.lage).toMatchObject({ id: 'normal' });
    const p = (o, min, fl = 140) => obs.partogram(bm(db), obs.forlossningRad(db, f.id), { oppning: o, fosterljud: fl, varkor: 4, tid: efter(min).toISOString() }, efter(min));
    expect(p(5, 60).lage.id).toBe('normal');
    expect(p(6, 180).lage).toEqual({ id: 'over_varningslinje', text: 'Förloppet är långsammare än varningslinjen. Bedöm värkarna och överväg att ta hål på hinnorna eller ge värkstimulering.' });
    const r = p(7, 480, 100);
    expect(r.partogram.at(-1)).toMatchObject({ oppning: 7, varningslinje: 10, atgardslinje: 8, lage: 'over_atgardslinje' });
    expect(r.lage.text).toBe('Förloppet har passerat åtgärdslinjen. Tillkalla förlossningsläkaren nu.');
    expect(r.fosterljudVarning).toContain('Fosterljuden 100');
    expect(() => p(6, 490)).toThrow('Öppningen var 7 cm');
    expect(p(10, 600).lage.id).toBe('fullt_vidgad');
  });

  test('vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården', () => {
    const db = sandlada();
    const f = tillForlossning(db, { antalFoster: 2 });
    expect(() => obs.fodelse(bm(db), obs.forlossningRad(db, f.id), { kon: 'kvinna', vikt: 2900, langd: 48, huvudomfang: 34 }, efter(300))).toThrow('Apgarpoäng');
    const b1 = obs.fodelse(bm(db), obs.forlossningRad(db, f.id), { kon: 'kvinna', vikt: 2650, langd: 47, huvudomfang: 33, apgar: [8, 9, 10] }, efter(300));
    expect(b1).toMatchObject({ status: 'pagaende', kvar: 1 });
    const b2 = obs.fodelse(bm(db), obs.forlossningRad(db, f.id), { kon: 'man', vikt: 2480, langd: 46, huvudomfang: 32.5, apgar: [6, 8, 9], satt: 'kejsarsnitt' }, efter(318));
    expect(b2).toMatchObject({ status: 'avslutad', kvar: 0 });
    expect(b2.barn.map(b => [b.ordning, b.satt, b.vikt, b.graviditetslangd])).toEqual([[1, 'Vaginal förlossning', 2650, 'v 39+0'], [2, 'Kejsarsnitt', 2480, 'v 39+0']]);
    const barn = db.query('SELECT * FROM patienter WHERE id IN (?, ?) ORDER BY id').all(b1.barnId, b2.barnId);
    expect(barn.map(b => [b.fornamn, b.efternamn, b.kon, b.id_typ, b.fodd])).toEqual([['Flicka 1', 'Graviddotter', 'kvinna', 'reservnummer', IDAG], ['Pojke 2', 'Graviddotter', 'man', 'reservnummer', IDAG]]);
    expect(barn.every(b => /^VK\d{12}$/.test(b.personnummer))).toBe(true);
    expect(db.query('SELECT typ, varde FROM tillvaxt_uppgifter WHERE patient_id = ? ORDER BY typ').all(b2.barnId)).toEqual([
      { typ: 'fodelse_huvudomfang', varde: 32.5 }, { typ: 'fodelselangd', varde: 46 }, { typ: 'fodelsevikt', varde: 2.48 }, { typ: 'graviditetslangd', varde: 39 }]);
    expect(obs.graviditetRad(db, obs.forlossningRad(db, f.id).graviditet_id).status).toBe('forlost');
    // Barnets journal visar kopplingen till förlossningen, och barnmorskan har vårdrelation till barnet på BB.
    expect(obs.forPatient(atk(db, 'bm-uso', b1.barnId, 'las_graviditet'), efter(320)).moder).toEqual({ forlossningId: f.id, ordning: 1 });
    expect(() => obs.fodelse(bm(db), obs.forlossningRad(db, f.id), { kon: 'man', vikt: 2400, langd: 46, huvudomfang: 32, apgar: [9, 9, 10] }, efter(330))).toThrow('avslutad');
  });

  test('planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter', () => {
    const db = utanObstetrikseed(sandlada());
    ny(db, 'gr4', { fornamn: 'Unika', efternamn: 'Namnsson' }); ny(db, 'gr5'); ny(db, 'gr6');
    grav(db, { sistaMens: addDagar(IDAG, -38 * 7) }, 'gr4');
    grav(db, { sistaMens: addDagar(IDAG, -37 * 7), antalFoster: 2 }, 'gr5');
    grav(db, { sistaMens: addDagar(IDAG, -10 * 7) }, 'gr6');
    const u = obs.uppfoljning(db, pers(db, 'ssk-vc'), {}, BAS);
    expect(u.graviditeter).toMatchObject({ pagaende: 3, flerbord: 1, overBpd: 0 });
    expect(u.vantadeForlossningar.slice(0, 4).map(v => v.antal)).toEqual([0, 0, 1, 1]);
    const text = JSON.stringify(u);
    for (const x of ['gr4', 'Unika', 'Namnsson']) expect(text).not.toContain(x);
    const db2 = utanObstetrikseed(sandlada());
    const f = tillForlossning(db2);
    obs.partogram(bm(db2), obs.forlossningRad(db2, f.id), { oppning: 5, tid: efter(500).toISOString() }, efter(500));
    obs.fodelse(bm(db2), obs.forlossningRad(db2, f.id), { kon: 'kvinna', vikt: 3500, langd: 50, huvudomfang: 35, apgar: [5, 6, 9], satt: 'kejsarsnitt' }, efter(560));
    const u2 = obs.uppfoljning(db2, pers(db2, 'bm-uso'), {}, efter(600));
    expect(u2.forlossningar).toEqual({ antal: 1, barn: 1, flerbord: 0, kejsarsnitt: 100, apgarUnder7: 100, medelvikt: 3500, overAtgardslinjen: 100 });
    expect(() => obs.uppfoljning(db2, pers(db2, 'usk-kard'), {}, BAS)).toThrow('uppföljningen');
  });

  test('behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen', () => {
    const db = sandlada();
    ny(db);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('gr1', 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen', 'Förlossning')").run(BAS.toISOString());
    expect(() => obs.registrera(atk(db, 'usk-kard', 'gr1', 'graviditet'), { sistaMens: addDagar(IDAG, -70) }, BAS)).toThrow('Yrkesrollen får inte');
    grav(db, { sistaMens: addDagar(IDAG, -70) });
    const las = (val) => obs.forPatient(atk(db, 'bm-uso', 'gr1', 'las_graviditet', val), BAS);
    expect(las({ andra_enheter: true }).graviditeter.length).toBe(1);
    expect(las({}).graviditeter).toEqual([]);
    const utan = JSON.stringify(las({}));
    sparr(db, 'gr1', 'vc-tybble');
    const r = las({ andra_enheter: true });
    expect(r.graviditeter).toEqual([]);
    expect(JSON.stringify(r)).toBe(utan);
  });

  test('säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val', () => {
    const db = sandlada();
    const f = tillForlossning(db);
    const g = rad(db, obs.forlossningRad(db, f.id).graviditet_id);
    ny(db, 'gr9');
    const A = (roll) => atk(db, roll, 'gr9', 'graviditet');
    for (const x of [() => obs.ultraljud(A('ssk-vc'), g, { veckor: 12 }, BAS), () => obs.besok(A('ssk-vc'), g, {}, BAS), () => obs.bestallProver(A('ssk-vc'), g, BAS),
      () => obs.graviditetUt(A('ssk-vc'), g, BAS), () => obs.startaForlossning(A('bm-uso'), g, {}, BAS), () => obs.partogram(A('bm-uso'), obs.forlossningRad(db, f.id), { oppning: 5 }, BAS),
      () => obs.fodelse(A('bm-uso'), obs.forlossningRad(db, f.id), {}, BAS)]) {
      try { x(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
    ny(db, 'gr8');
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('gr8', 'uso-kk-forl', 'slutenvard', ?, 'Förlossningen', 'Förlossning')").run(BAS.toISOString());
    const g8 = rad(db, grav(db, { sistaMens: addDagar(IDAG, -39 * 7) }, 'gr8').id);
    expect(() => obs.startaForlossning(atk(db, 'bm-uso', 'gr8', 'graviditet'), g8, {}, BAS)).toThrow('aktivt val');
    expect(() => obs.besok(atk(db, 'bm-uso', 'gr8', 'graviditet', { andra_enheter: true }), g8, { blodtryck: '120/80' }, BAS)).toThrow('vårdenhet som skrev in graviditeten');
    expect(obs.startaForlossning(atk(db, 'bm-uso', 'gr8', 'graviditet', { andra_enheter: true }), g8, {}, BAS).status).toBe('pagaende');
  });
});
