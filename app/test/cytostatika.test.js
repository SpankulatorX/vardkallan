// Cytostatika (runda 9, r3, Sussa 4.8.1.1 till 4.8.1.7): ordination ur regim med dos efter kroppsyta och njurfunktion,
// provkontroll före kur, dosjustering och uppskjuten cykel, beredningsorder med etikett, administrering med
// dubbelkontroll i regimens ordning, överlämnande av peroral behandling och uppföljningen. Medicinkliniken i Lindesberg.
import { describe, test, expect } from 'bun:test';
import { datumAv, addDagar } from '../src/db.js';
import * as cyto from '../src/cytostatika.js';
import { alder as alderFor } from '../src/atkomst.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';

const IMORGON = addDagar(datumAv(BAS), 1);
const lak = (db, pid = 'cy1', h = 'ordinera_cytostatika') => atk(db, 'lak-lind', pid, h);
const ssk = (db, pid = 'cy1', h = 'ge_cytostatika') => atk(db, 'ssk-lind', pid, h);
const mv = (db, pid, typ, varde, min = -60) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid) VALUES (?, ?, ?, ?, ?, ?)').run(pid, 'lind-med', typ, String(varde), varde, efter(min).toISOString());
function ny(db, id = 'cy1', { prover = true, kreatinin = 70 } = {}) {
  nyPatient(db, { id, enhet: 'lind-med', ar: 1966, kon: 'K', fornamn: 'Kerstin', efternamn: 'Kursdotter' });
  mv(db, id, 'langd', 165, -2 * 24 * 60); mv(db, id, 'vikt', 62, -24 * 60);
  if (prover) { mv(db, id, 'lpk', 5.2); mv(db, id, 'tpk', 210); mv(db, id, 'kreatinin', kreatinin); }
}
const kur = (b, n = 0) => b.kurer[n];
// Dubbelkontrollen: sjuksköterskan iordningställer vid sängen, läkaren kontrollerar i sin egen session och dosen ges.
function geMedKontroll(db, d, nu, pid = 'cy1') {
  const las = { armband: pnr(db, pid), streckkod: d.etikett };
  cyto.iordningstall(ssk(db, pid), cyto.dosRad(db, d.id), las, nu);
  cyto.kontrollera(lak(db, pid, 'ge_cytostatika'), cyto.dosRad(db, d.id), las, new Date(nu.getTime() + 60_000));
  // Runda 11, r4: en infusion startas och avslutas, så att start, slut och takt registreras. Tabletter överlämnas.
  if (d.peroral) return cyto.ge(ssk(db, pid), cyto.dosRad(db, d.id), new Date(nu.getTime() + 120_000));
  cyto.startaInfusion(ssk(db, pid), cyto.dosRad(db, d.id), new Date(nu.getTime() + 120_000));
  return cyto.avslutaInfusion(ssk(db, pid), cyto.dosRad(db, d.id), new Date(nu.getTime() + 180_000));
}
// Runda 11, r4: premedicineringen ges före den första cytostatikadosen.
const gePremed = (db, pid = 'cy1', nu = efter(95)) => { for (const p of db.query("SELECT id FROM cyto_premed WHERE patient_id = ? AND status = 'ordinerad'").all(pid)) cyto.gePremed(ssk(db, pid), cyto.premedRad(db, p.id), { armband: pnr(db, pid) }, nu); };
const pnr = (db, pid = 'cy1') => db.query('SELECT personnummer FROM patienter WHERE id = ?').get(pid).personnummer;
// En godkänd och beredd EC-kur, mottagen på avdelningen.
function berett(db) {
  ny(db);
  const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
  cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
  const o = cyto.bered(ssk(db), cyto.cykelRad(db, kur(b).id), efter(60));
  for (const d of o.doser) cyto.taEmot(ssk(db), cyto.dosRad(db, d.id), { streckkod: d.etikett }, efter(90));
  gePremed(db);
  return { b, o };
}

describe('Cytostatika', () => {
  test('ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna', () => {
    const db = sandlada();
    ny(db);
    expect(cyto.regimer().map(r => r.id)).toEqual(['ec', 'karboplatin', 'kapecitabin']);
    expect(() => cyto.ordinera(lak(db), { regim: 'toString' }, BAS)).toThrow('Välj behandlingsregim');
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
    expect(b).toMatchObject({ regim: { id: 'ec', intervall: 21 }, cykler: 4, status: 'pagaende', ordinerad: { av: 'Olof Granberg' } });
    expect(kur(b)).toMatchObject({ nummer: 1, dag1: IMORGON, kroppsyta: 1.69, langd: 165, vikt: 62, dosandel: 100, status: 'planerad' });
    expect(kur(b).doser.map(d => [d.ordning, d.lakemedel, d.dos, d.berakning])).toEqual([
      [1, 'Epirubicin', 152, '90 mg/m² × 1,69 m² = 152 mg'], [2, 'Cyklofosfamid', 1010, '600 mg/m² × 1,69 m² = 1014 mg']]);
    expect(() => cyto.ordinera(lak(db), { regim: 'ec', tidigareBehandling: { svar: 'nej' } }, BAS)).toThrow('redan en pågående');
    nyPatient(db, { id: 'cy2', enhet: 'lind-med', ar: 1970 });
    expect(() => cyto.ordinera(lak(db, 'cy2'), { regim: 'ec', tidigareBehandling: { svar: 'nej' } }, BAS)).toThrow('Längd saknas');
  });

  test('karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault', () => {
    const db = sandlada();
    ny(db, 'cy1', { kreatinin: 80 });
    const b = cyto.ordinera(lak(db), { regim: 'karboplatin', start: IMORGON }, BAS);
    const p = db.query("SELECT fodd FROM patienter WHERE id = 'cy1'").get();
    const gfr = Math.round(cyto.cockcroftGault({ alder: alderFor(p.fodd, datumAv(BAS)), vikt: 62, kreatinin: 80, kon: 'kvinna' }));
    expect(kur(b).gfr).toBe(gfr);
    expect(kur(b).doser[0]).toMatchObject({ lakemedel: 'Karboplatin', dos: cyto.avrunda(5 * (gfr + 25), 10), berakning: `AUC 5 × (GFR ${gfr} + 25) = ${5 * (gfr + 25)} mg` });
    nyPatient(db, { id: 'cy3', enhet: 'lind-med', ar: 1960 });
    mv(db, 'cy3', 'langd', 170, -60); mv(db, 'cy3', 'vikt', 70, -60);
    expect(() => cyto.ordinera(lak(db, 'cy3'), { regim: 'karboplatin' }, BAS)).toThrow('Kreatinin från de senaste tre dygnen saknas');
    expect(cyto.cockcroftGault({ alder: 40, vikt: 100, kreatinin: 50, kon: 'man' })).toBeGreaterThan(cyto.GFR_TAK);
  });

  test('före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln', () => {
    const db = sandlada();
    ny(db, 'cy1', { prover: false });
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
    const c = () => cyto.cykelRad(db, kur(b).id);
    const p0 = cyto.provkontroll(lak(db), c(), BAS);
    expect(p0).toMatchObject({ ok: false, saknasAnalyser: ['blodstatus'] });
    expect(cyto.bestallProver(lak(db, 'cy1', 'bestalla_prov'), c(), BAS).bestallning.analyser.map(a => a.analys)).toEqual(['blodstatus']);
    mv(db, 'cy1', 'lpk', 4.1); mv(db, 'cy1', 'tpk', 78);
    expect(() => cyto.godkann(lak(db), c(), BAS)).toThrow('Trombocyter 78 ×10⁹/L är under gränsen 100. Skjut upp kuren.');
    const u = cyto.skjutUpp(lak(db), c(), {}, BAS);
    expect(kur(u)).toMatchObject({ dag1: addDagar(IMORGON, 7), uppskjuten: 1, uppskjutenOrsak: 'Trombocyter 78 ×10⁹/L är under gränsen 100. Skjut upp kuren.' });
    mv(db, 'cy1', 'tpk', 160, 5);
    expect(cyto.provkontroll(lak(db), c(), efter(10)).ok).toBe(true);
    expect(cyto.godkann(lak(db), c(), efter(10)).kurer[0].status).toBe('godkand');
    // Proverna gäller i tre dygn.
    expect(cyto.provkontroll(lak(db), c(), efter(4 * 24 * 60)).ok).toBe(false);
  });

  test('dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna', () => {
    const db = sandlada();
    ny(db);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
    expect(() => cyto.dosjustera(lak(db), cyto.cykelRad(db, kur(b).id), { dosandel: 75 }, BAS)).toThrow('Skriv orsaken');
    expect(() => cyto.dosjustera(lak(db), cyto.cykelRad(db, kur(b).id), { dosandel: 70, orsak: 'x' }, BAS)).toThrow('Välj andel');
    const j = cyto.dosjustera(lak(db), cyto.cykelRad(db, kur(b).id), { dosandel: 75, orsak: 'Neutropen feber efter förra kuren' }, BAS);
    expect(kur(j)).toMatchObject({ dosandel: 75, dosandelOrsak: 'Neutropen feber efter förra kuren' });
    expect(kur(j).doser.map(d => d.dos)).toEqual([114, 760]);
    expect(kur(j).doser[0].berakning).toBe('90 mg/m² × 1,69 m² = 152 mg, 75 procent');
    expect(j.historik.at(-1).detalj).toBe('Cykel 1: 75 procent av full dos. Neutropen feber efter förra kuren.');
  });

  test('beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod', () => {
    const db = sandlada();
    ny(db);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
    expect(() => cyto.bered(ssk(db), cyto.cykelRad(db, kur(b).id), BAS)).toThrow('inte godkänd');
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    const o = cyto.bered(ssk(db), cyto.cykelRad(db, kur(b).id), efter(60));
    expect(o.beredningsenhet).toBe('Cytostatikaberedningen (simulerad)');
    expect(o.doser.map(d => [d.lakemedel, d.dos, d.volymLakemedel, d.barare, d.bararVolym, d.totalVolym, d.infusionMinuter, d.status])).toEqual([
      ['Epirubicin', 152, 76, 'Natriumklorid 9 mg/ml', 100, 176, 15, 'beredd'], ['Cyklofosfamid', 1010, 50.5, 'Natriumklorid 9 mg/ml', 250, 300.5, 30, 'beredd']]);
    expect(o.doser[0].etikett).toMatch(/^VKC\d{8}$/);
    expect(o.doser[0].streckkod).toContain('<svg');
    expect(o.doser[0].etikettText).toContain('Epirubicin 152 mg i Natriumklorid 9 mg/ml 100 ml, totalt 176 ml. Infunderas på 15 minuter.');
  });

  test('vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten', () => {
    const db = sandlada();
    const { o, b } = berett(db);
    const [epi, cyk] = o.doser;
    const k = { armband: pnr(db) };
    expect(() => cyto.taEmot(ssk(db), cyto.dosRad(db, epi.id), { streckkod: epi.etikett }, efter(91))).toThrow('redan mottagen');
    expect(() => cyto.iordningstall(ssk(db), cyto.dosRad(db, cyk.id), { ...k, streckkod: cyk.etikett }, efter(100))).toThrow('Ge epirubicin först');
    expect(() => cyto.iordningstall(ssk(db), cyto.dosRad(db, epi.id), { ...k, streckkod: cyk.etikett }, efter(100))).toThrow('Etiketten stämmer inte');
    expect(() => cyto.iordningstall(ssk(db), cyto.dosRad(db, epi.id), { armband: '191212121212', streckkod: epi.etikett }, efter(100))).toThrow('Id-bandet');
    geMedKontroll(db, epi, efter(100));
    const r = geMedKontroll(db, cyk, efter(130));
    expect(kur(r).status).toBe('klar');
    expect(kur(r).doser.map(d => [d.status, d.given.av, d.given.kontrolleradAv])).toEqual([['given', 'Sanna Björk', 'Olof Granberg'], ['given', 'Sanna Björk', 'Olof Granberg']]);
    mv(db, 'cy1', 'vikt', 56, 140);
    const n = cyto.nastaCykel(lak(db), cyto.behandlingRad(db, b.id), efter(150));
    expect(kur(n, 1)).toMatchObject({ nummer: 2, dag1: addDagar(IMORGON, 21), vikt: 56, kroppsyta: 1.6 });
    expect(n.historik.at(-1).detalj).toContain('Vikten har ändrats från 62 till 56 kg, så doserna är omräknade.');
    expect(() => cyto.nastaCykel(lak(db), cyto.behandlingRad(db, b.id), efter(151))).toThrow('inte klar');
  });

  test('dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte', () => {
    const db = sandlada();
    const { o } = berett(db);
    const epi = o.doser[0];
    const las = { armband: pnr(db), streckkod: epi.etikett };
    // Ett id för en kollega i anropet gör ingenting: dosen kan inte ges utan kontrollen.
    expect(() => cyto.ge(ssk(db), cyto.dosRad(db, epi.id), efter(99), { kontrollant: 'lak-lind' })).toThrow('Dosen är inte dubbelkontrollerad');
    const v = cyto.iordningstall(ssk(db), cyto.dosRad(db, epi.id), las, efter(100));
    expect(v.kontroll).toMatchObject({ status: 'vantar_kontroll', iordningstalldAv: 'Sanna Björk', kandidater: [{ id: 'lak-lind', namn: 'Olof Granberg' }] });
    expect(() => cyto.ge(ssk(db), cyto.dosRad(db, epi.id), efter(101))).toThrow('Dosen är inte dubbelkontrollerad');
    expect(() => cyto.kontrollera(ssk(db), cyto.dosRad(db, epi.id), las, efter(101))).toThrow('Den som iordningställde dosen kan inte kontrollera den själv');
    expect(cyto.vantandeKontroller(db, pers(db, 'lak-lind'), () => ({})).kontroller.map(x => x.etikett)).toEqual([epi.etikett]);
    expect(cyto.vantandeKontroller(db, pers(db, 'ssk-lind'), () => ({})).kontroller).toEqual([]);
    expect(cyto.vantandeKontroller(db, pers(db, 'lak-kard'), () => ({})).kontroller).toEqual([]);
    expect(() => cyto.kontrollera(lak(db, 'cy1', 'ge_cytostatika'), cyto.dosRad(db, epi.id), { ...las, streckkod: 'VKC00000999' }, efter(101))).toThrow('Etiketten stämmer inte');
    cyto.kontrollera(lak(db, 'cy1', 'ge_cytostatika'), cyto.dosRad(db, epi.id), las, efter(102));
    expect(cyto.dosRad(db, epi.id)).toMatchObject({ status: 'kontrollerad', kontrollerad_av: 'lak-lind' });
    cyto.startaInfusion(ssk(db), cyto.dosRad(db, epi.id), efter(103));
    expect(cyto.avslutaInfusion(ssk(db), cyto.dosRad(db, epi.id), efter(120)).kurer[0].doser[0].status).toBe('given');
  });

  test('säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd', () => {
    const db = sandlada();
    const { o, b } = berett(db);
    ny(db, 'cy5');
    const c = cyto.cykelRad(db, kur(b).id), d = cyto.dosRad(db, o.doser[0].id), be = cyto.behandlingRad(db, b.id);
    const A = (h) => atk(db, 'lak-lind', 'cy5', h);
    const las = { armband: pnr(db), streckkod: d.etikett };
    for (const f of [() => cyto.provkontroll(A('las_cytostatika'), c, BAS), () => cyto.bestallProver(A('bestalla_prov'), c, BAS), () => cyto.godkann(A('ordinera_cytostatika'), c, BAS),
      () => cyto.dosjustera(A('ordinera_cytostatika'), c, { dosandel: 75, orsak: 'x' }, BAS), () => cyto.skjutUpp(A('ordinera_cytostatika'), c, {}, BAS),
      () => cyto.beredningsorder(A('las_cytostatika'), c), () => cyto.bered(A('ge_cytostatika'), c, BAS), () => cyto.nastaCykel(A('ordinera_cytostatika'), be, BAS),
      () => cyto.taEmot(A('ge_cytostatika'), d, { streckkod: d.etikett }, BAS), () => cyto.iordningstall(A('ge_cytostatika'), d, las, BAS),
      () => cyto.kontrollera(A('ge_cytostatika'), d, las, BAS), () => cyto.ge(A('ge_cytostatika'), d, BAS)]) {
      try { f(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
  });

  test('säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke', () => {
    const db = sandlada();
    ny(db);
    const b = cyto.ordinera(lak(db), { regim: 'ec', start: IMORGON, tidigareBehandling: { svar: 'nej' } }, BAS);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('cy1', 'kkoga-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    const c = () => cyto.cykelRad(db, kur(b).id);
    const annan = (h, val = {}) => atk(db, 'lak-kkoga', 'cy1', h, val);
    expect(() => cyto.provkontroll(annan('las_cytostatika'), c(), BAS)).toThrow('aktivt val');
    expect(() => cyto.beredningsorder(annan('las_cytostatika'), c())).toThrow('aktivt val');
    expect(cyto.provkontroll(annan('las_cytostatika', { andra_enheter: true }), c(), BAS).ok).toBe(true);
    // Att läsa med aktivt val ger aldrig rätt att ändra en annan vårdenhets behandling.
    for (const f of [() => cyto.godkann(annan('ordinera_cytostatika', { andra_enheter: true }), c(), BAS), () => cyto.dosjustera(annan('ordinera_cytostatika', { andra_enheter: true }), c(), { dosandel: 75, orsak: 'x' }, BAS),
      () => cyto.skjutUpp(annan('ordinera_cytostatika', { andra_enheter: true }), c(), {}, BAS), () => cyto.bered(annan('ge_cytostatika', { andra_enheter: true }), c(), BAS)]) {
      expect(f).toThrow('ordinerande vårdenheten');
    }
    sparr(db, 'cy1', 'lind-med');
    expect(() => cyto.provkontroll(annan('las_cytostatika', { andra_enheter: true }), c(), BAS)).toThrow('spärrade');
    expect(() => cyto.beredningsorder(annan('las_cytostatika', { andra_enheter: true }), c())).toThrow('spärrade');
    expect(cyto.beredningsorder(annan('las_cytostatika', { andra_enheter: true, samtycke_sparr: true }), c()).doser.length).toBe(2);
    expect(() => cyto.godkann(annan('ordinera_cytostatika', { andra_enheter: true, samtycke_sparr: true }), c(), BAS)).toThrow('ordinerande vårdenheten');
    // En roll utan cytostatikahandlingarna får inte beredningsordern med patientens uppgifter.
    expect(() => cyto.beredningsorder(atk(db, 'adm-kard', 'cy1', 'las_admin'), c())).toThrow('Yrkesrollen får inte');
  });

  test('peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten', () => {
    const db = sandlada();
    ny(db);
    expect(cyto.tabletter(600, [500, 150])).toEqual([{ styrka: 150, antal: 4 }]);
    const b = cyto.ordinera(lak(db), { regim: 'kapecitabin', start: IMORGON }, BAS);
    expect(kur(b).doser[0]).toMatchObject({ lakemedel: 'Kapecitabin', dos: 1650, peroral: true, berakning: '1000 mg/m² × 1,69 m² = 1690 mg per tillfälle' });
    cyto.godkann(lak(db), cyto.cykelRad(db, kur(b).id), BAS);
    const o = cyto.bered(ssk(db), cyto.cykelRad(db, kur(b).id), efter(30));
    expect(o.doser[0]).toMatchObject({ tabletterPerTillfalle: [{ styrka: 500, antal: 3 }, { styrka: 150, antal: 1 }], tabletterTotalt: [{ styrka: 500, antal: 84 }, { styrka: 150, antal: 28 }] });
    const r = geMedKontroll(db, o.doser[0], efter(40));
    expect(r.instruktion).toBe(`Ta 3 tabletter à 500 mg och 1 tablett à 150 mg morgon och kväll, inom en halvtimme efter måltid, dag 1 till 14 från ${IMORGON}. Kontakta mottagningen vid feber över 38 grader, diarré eller ömhet i händer och fötter.`);
    expect(kur(r).doser[0].status).toBe('overlamnad');
    expect(r.historik.at(-1).detalj).toBe('Kapecitabin 1650 mg per tillfälle överlämnat till patienten, dubbelkontrollerad med Olof Granberg.');
  });

  test('uppföljningen per vårdenhet räknar behandlingar, planerade och givna kurer, beredningar, dosjusteringar och uppskjutna cykler utan personuppgifter', () => {
    const db = sandlada();
    const { o } = berett(db);
    for (const d of o.doser) geMedKontroll(db, d, efter(100 + 5 * d.ordning));
    ny(db, 'cy4');
    const b2 = cyto.ordinera(lak(db, 'cy4'), { regim: 'kapecitabin', start: IMORGON }, BAS);
    cyto.dosjustera(lak(db, 'cy4'), cyto.cykelRad(db, kur(b2).id), { dosandel: 80, orsak: 'Nedsatt njurfunktion' }, BAS);
    cyto.skjutUpp(lak(db, 'cy4'), cyto.cykelRad(db, kur(b2).id), { dagar: 7, orsak: 'Patienten är förkyld' }, BAS);
    const u = cyto.uppfoljning(db, pers(db, 'ssk-lind'), { fran: datumAv(BAS), till: addDagar(datumAv(BAS), 30) }, efter(200));
    expect(u).toMatchObject({ pagaende: [{ id: 'ec', antal: 1 }, { id: 'kapecitabin', antal: 1 }], planeradeKurer: 1, givnaKurer: 1, beredningar: 2, dosjusteringar: 1, uppskjutna: 1 });
    const text = JSON.stringify(u);
    for (const x of ['cy1', 'cy4', 'Kerstin', 'Kursdotter']) expect(text).not.toContain(x);
  });

  test('behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte', () => {
    const db = sandlada();
    const { o } = berett(db);
    expect(() => cyto.ordinera(ssk(db, 'cy1', 'ordinera_cytostatika'), { regim: 'ec', tidigareBehandling: { svar: 'nej' } }, BAS)).toThrow('Yrkesrollen får inte ordinera cytostatika');
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('cy1', 'kkoga-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(() => cyto.iordningstall(atk(db, 'ssk-kkoga', 'cy1', 'ge_cytostatika', { andra_enheter: true }), cyto.dosRad(db, o.doser[0].id), { armband: pnr(db), streckkod: o.doser[0].etikett }, efter(100))).toThrow('ordinerande vårdenheten');
    // En beredning som är äldre än ett dygn iordningställs inte.
    expect(() => cyto.iordningstall(ssk(db), cyto.dosRad(db, o.doser[0].id), { armband: pnr(db), streckkod: o.doser[0].etikett }, efter(60 + 25 * 60))).toThrow('äldre än 24 timmar');
    const las = (val) => cyto.forPatient(atk(db, 'lak-kkoga', 'cy1', 'las_cytostatika', val), efter(100));
    expect(las({ andra_enheter: true }).behandlingar.length).toBe(1);
    // Runda 11, r4: svaret om tidigare behandling följer läkemedelslistan och syns utan aktivt val men inte efter en spärr,
    // så det jämförs för sig. Behandlingen själv röjs inte.
    const utanSvar = (x) => { const { tidigareBehandling: _, ...rest } = x; return JSON.stringify(rest); };
    const utan = utanSvar(las({}));
    sparr(db, 'cy1', 'lind-med');
    const r = las({ andra_enheter: true });
    expect(r.behandlingar).toEqual([]);
    expect(utanSvar(r)).toBe(utan);
    expect(r.tidigareBehandling).toBe(null);
  });
});
