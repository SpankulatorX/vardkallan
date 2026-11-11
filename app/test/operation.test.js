// Operationsplanering (runda 9, r3, Sussa 4.5.1.1 till 4.5.1.5): anmälan, förberedelser, väntelista, planering av sal,
// team och tid, förloppet med WHO:s checklista, uppvakningen och uppföljningen. Varje test bygger en sandlåda vid en fast
// tidpunkt och lägger in sina egna patienter.
import { describe, test, expect } from 'bun:test';
import { datumAv, addDagar, lokalTid } from '../src/db.js';
import * as op from '../src/operation.js';
import * as labb from '../src/labb.js';
import { BAS, sandlada, nyPatient, atk, pers, sparr, efter } from './specialist.js';

const MORGON = addDagar(datumAv(BAS), 1);
const ny = (db, id = 'op1', enhet = 'kkoga-ort', extra = {}) => nyPatient(db, { id, enhet, ar: 1958, ...extra });
const anmal = (db, pid = 'op1', body = { kva: 'NFB49', sida: 'hoger' }, roll = 'lak-kkoga', nu = BAS) => op.anmal(atk(db, roll, pid, 'operation_anmala'), body, nu);
const rad = (db, id) => op.anmalanRad(db, id);
const ALLA = (del) => Object.keys(op.CHECKLISTA[del].punkter);

// Runda 11, r2: ASA-klassen sätts och bekräftas av läkaren på operationsdagen före anestesistart.
function asaIdag(db, id, nu, pid = 'op1') {
  op.anestesibedomning(atk(db, 'lak-kkoga', pid, 'operation_anmala'), rad(db, id), { asa: 2 }, nu);
  op.bekraftaAsa(atk(db, 'lak-kkoga', pid, 'anestesibedomning'), rad(db, id), {}, nu);
}

// En operation som är planerad och genomförd fram till uppvakningen.
function tillUppvak(db, pid = 'op1') {
  const a = anmal(db, pid);
  const s = atk(db, 'ssk-kkoga', pid, 'operation_registrera');
  op.planera(atk(db, 'ssk-kkoga', pid, 'operation_planera'), rad(db, a.id), {}, BAS);
  const t0 = Date.parse(rad(db, a.id) && op.anmalanUt(s, rad(db, a.id)).planering.start);
  const vid = (m) => new Date(t0 + m * 60_000);
  op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0));
  op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, vid(5));
  asaIdag(db, a.id, vid(8), pid);
  op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(10));
  op.checklista(s, rad(db, a.id), { del: 'fore_snitt', bekraftade: ALLA('fore_snitt') }, vid(25));
  op.registrera(s, rad(db, a.id), { handelse: 'knivtid' }, vid(30));
  op.implantat(s, rad(db, a.id), { artikel: 'Höftprotes, cementerad stam (demo)', tillverkare: 'Demotillverkaren', lot: 'LOT-2026-114' }, vid(60));
  op.registrera(s, rad(db, a.id), { handelse: 'op_slut' }, vid(125));
  op.checklista(s, rad(db, a.id), { del: 'fore_utflyttning', bekraftade: ALLA('fore_utflyttning') }, vid(130));
  op.registrera(s, rad(db, a.id), { handelse: 'ut_sal' }, vid(135));
  return { id: a.id, vid, s };
}

describe('Operationsplanering', () => {
  test('läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten', () => {
    const db = sandlada();
    ny(db);
    const f = op.anmalForslag(atk(db, 'lak-kkoga', 'op1', 'operation_anmala'), BAS);
    expect(f.prioritet).toBe('inom_3_manader');
    expect(f.ingrepp.map(i => i.kva)).toContain('NFB49');
    expect(() => anmal(db, 'op1', { kva: 'NFB49' })).toThrow('Ange sidan');
    expect(() => anmal(db, 'op1', { kva: 'constructor' })).toThrow('Välj ingreppet');
    const a = anmal(db);
    expect(a).toMatchObject({ kva: 'NFB49', ingrepp: 'Primär total höftledsplastik med cement', sida: 'höger', minuter: 100, anestesi: 'Regional anestesi (spinal)',
      status: 'vantar', malDatum: addDagar(datumAv(BAS), 90), prioritet: { id: 'inom_3_manader' } });
    expect(a.anmald.av).toBe('Ingrid Moberg');
    const akut = anmal(db, 'op1', { kva: 'JEA01', prioritet: 'akut' });
    expect(akut).toMatchObject({ sida: null, anestesi: 'Generell anestesi', malDatum: addDagar(datumAv(BAS), 1) });
  });

  test('förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    expect(a.forberedelser.prover.map(p => p.analys)).toEqual(['blodstatus', 'kreatinin', 'natrium', 'kalium', 'blodgruppering', 'bastest']);
    expect(a.forberedelser.punkter.find(p => p.id === 'prover')).toMatchObject({ klar: false });
    expect(a.forberedelser.punkter.find(p => p.id === 'anestesi').text).toContain('anestesiläkaren');
    const b = op.bestallProver(atk(db, 'lak-kkoga', 'op1', 'bestalla_prov'), rad(db, a.id), efter(5));
    expect(b.bestallning.analyser.map(x => x.analys).sort()).toEqual(['bastest', 'blodgruppering', 'blodstatus', 'kalium', 'kreatinin', 'natrium']);
    const u = op.anmalanUt(atk(db, 'lak-kkoga', 'op1', 'las_operation'), rad(db, a.id));
    expect(u.forberedelser.prover.every(p => p.status === 'bestalld')).toBe(true);
    expect(() => op.bestallProver(atk(db, 'lak-kkoga', 'op1', 'bestalla_prov'), rad(db, a.id), efter(6))).toThrow('redan beställda');
    const as = op.anestesibedomning(atk(db, 'lak-kkoga', 'op1', 'operation_anmala'), rad(db, a.id), { asa: 2 }, efter(7));
    expect(as.forberedelser.punkter.find(p => p.id === 'anestesi')).toMatchObject({ klar: true, text: 'ASA 2.' });
    // Ett ingrepp utan risk för blödning behöver inget blod.
    expect(anmal(db, 'op1', { kva: 'JKA21' }).forberedelser.prover.map(p => p.analys)).not.toContain('bastest');
  });

  test('väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2'); ny(db, 'op3', 'kkoga-ort', { skyddad: 1 });
    anmal(db, 'op1', { kva: 'NGB49', sida: 'vanster' });
    anmal(db, 'op2', { kva: 'JEA01', prioritet: 'akut' });
    anmal(db, 'op3', { kva: 'JKA21', prioritet: 'inom_2_veckor' });
    const v = op.vantelista(db, pers(db, 'ssk-kkoga'), () => ({}), BAS);
    expect(v.vantande.map(x => x.patient.id)).toEqual(['op2', 'op3', 'op1']);
    expect(v.vantande[1].patient.namn).toBe('Skyddad identitet');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = '/api/operation/vantelista'").get().n).toBe(3);
    // En annan vårdenhet ser inte vårdenhetens väntelista.
    expect(op.vantelista(db, pers(db, 'lak-ort'), () => ({}), BAS).vantande).toEqual([]);
  });

  test('systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    const a = anmal(db, 'op1');
    const pl = atk(db, 'ssk-kkoga', 'op1', 'operation_planera');
    const f = op.planeringsforslag(pl, rad(db, a.id), BAS);
    expect(f).toMatchObject({ sal: { id: 'kkoga-sal-1' }, start: lokalTid(MORGON, '07:30'), operator: { id: 'lak-kkoga' }, opssk: { id: 'ssk-kkoga' }, inomMal: true });
    const p = op.planera(pl, rad(db, a.id), {}, BAS);
    expect(p.status).toBe('planerad');
    expect(p.planering).toMatchObject({ sal: { id: 'kkoga-sal-1' }, start: lokalTid(MORGON, '07:30'), team: { operator: 'Ingrid Moberg', opssk: 'Tove Ahlström' } });
    const b = anmal(db, 'op2', { kva: 'JKA21' });
    const pl2 = atk(db, 'ssk-kkoga', 'op2', 'operation_planera');
    // Teamet är upptaget till 09:40, så systemet föreslår tiden efter det i stället för den lediga sal 2 samtidigt.
    expect(op.planeringsforslag(pl2, rad(db, b.id), BAS)).toMatchObject({ start: lokalTid(MORGON, '09:45') });
    expect(() => op.planera(pl2, rad(db, b.id), { sal: 'kkoga-sal-1', start: lokalTid(MORGON, '08:00') }, BAS)).toThrow('är upptagen');
    expect(() => op.planera(pl2, rad(db, b.id), { sal: 'kkoga-sal-2', start: lokalTid(MORGON, '08:00') }, BAS)).toThrow('opererar redan');
    expect(() => op.planera(pl2, rad(db, b.id), { sal: 'uso-sal-1' }, BAS)).toThrow('Salen finns inte på sjukhuset');
    expect(() => op.planera(pl2, rad(db, b.id), { start: lokalTid(MORGON, '15:30') }, BAS)).toThrow('salstiden');
  });

  test('planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    const pl = atk(db, 'ssk-kkoga', 'op1', 'operation_planera');
    const p = op.planera(pl, rad(db, a.id), {}, BAS);
    expect(p.planering.kallelse).toContain('Kom klockan 06:00');
    expect(p.planering.kallelse).toContain('Ät inte efter midnatt');
    expect(p.forberedelser.punkter.find(x => x.id === 'kallelse').klar).toBe(true);
    expect(() => op.stryk(pl, rad(db, a.id), { orsak: 'toString' }, BAS)).toThrow('Välj orsaken');
    const s = op.stryk(pl, rad(db, a.id), { orsak: 'akut_gick_fore' }, efter(60));
    expect(s).toMatchObject({ status: 'vantar', planering: null, malDatum: a.malDatum });
    expect(s.historik.map(h => h.handelse)).toEqual(['anmald', 'planerad', 'struken']);
    expect(op.vantelista(db, pers(db, 'ssk-kkoga'), () => ({}), BAS).vantande.map(x => x.id)).toEqual([a.id]);
  });

  test('under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, BAS)).toThrow('inte planerad');
    op.planera(atk(db, 'ssk-kkoga', 'op1', 'operation_planera'), rad(db, a.id), {}, BAS);
    const t0 = new Date(lokalTid(MORGON, '07:30'));
    const vid = (m) => new Date(t0.getTime() + m * 60_000);
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'knivtid' }, vid(0))).toThrow('Registrera in på sal först');
    expect(op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0)).status).toBe('pagar');
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(5))).toThrow('Checklistan före anestesi är inte klar');
    expect(() => op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ['identitet'] }, vid(5))).toThrow('Ingrepp och operationsställe är bekräftade med patienten');
    const u = op.checklistaUnderlag(atk(db, 'ssk-kkoga', 'op1', 'las_operation'), rad(db, a.id));
    expect(u).toMatchObject({ allergier: 'Ingen registrerad överkänslighet.', blod: 'Blodgruppering och bastest är inte klara. Beställ dem innan anestesin.' });
    op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, vid(5));
    asaIdag(db, a.id, vid(8));
    const x = op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(10));
    expect(x.forlopp.tider.find(t => t.id === 'anestesistart').tid).toBe(vid(10).toISOString());
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'knivtid' }, vid(20))).toThrow('före snitt är inte klar');
    op.checklista(s, rad(db, a.id), { del: 'fore_snitt', bekraftade: ALLA('fore_snitt') }, vid(25));
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'knivtid', tid: vid(8).toISOString() }, vid(30))).toThrow('kan inte vara före anestesistart');
    expect(() => op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(30))).toThrow('redan registrerad');
  });

  test('ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db);
    const s = atk(db, 'ssk-kkoga', 'op1', 'operation_registrera');
    op.planera(atk(db, 'ssk-kkoga', 'op1', 'operation_planera'), rad(db, a.id), {}, BAS);
    const vid = (m) => new Date(Date.parse(lokalTid(MORGON, '07:30')) + m * 60_000);
    op.registrera(s, rad(db, a.id), { handelse: 'in_sal' }, vid(0));
    op.checklista(s, rad(db, a.id), { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, vid(5));
    asaIdag(db, a.id, vid(8));
    op.registrera(s, rad(db, a.id), { handelse: 'anestesistart' }, vid(10));
    op.checklista(s, rad(db, a.id), { del: 'fore_snitt', bekraftade: ALLA('fore_snitt') }, vid(25));
    op.registrera(s, rad(db, a.id), { handelse: 'knivtid' }, vid(30));
    const slut = op.registrera(s, rad(db, a.id), { handelse: 'op_slut' }, vid(125));
    expect(slut.forlopp.atgarder).toEqual([{ kod: 'NFB49', text: 'Primär total höftledsplastik med cement', system: 'KVÅ' }]);
    expect(slut.forlopp.operationsminuter).toBe(95);
    expect(db.query("SELECT kod FROM atgarder WHERE patient_id = 'op1'").all().map(r => r.kod)).toEqual(['NFB49']);
    expect(() => op.checklista(s, rad(db, a.id), { del: 'fore_utflyttning', bekraftade: ALLA('fore_utflyttning') }, vid(130))).toThrow('Registrera implantatet');
    expect(() => op.implantat(s, rad(db, a.id), { artikel: 'Höftprotes', tillverkare: 'Demo', lot: 'x' }, vid(126))).toThrow('lot- eller serienummer');
    op.implantat(s, rad(db, a.id), { artikel: 'Höftprotes (demo)', tillverkare: 'Demotillverkaren', lot: 'LOT-2026-114' }, vid(126));
    op.checklista(s, rad(db, a.id), { del: 'fore_utflyttning', bekraftade: ALLA('fore_utflyttning') }, vid(130));
    const ut = op.registrera(s, rad(db, a.id), { handelse: 'ut_sal' }, vid(135));
    expect(ut.status).toBe('uppvak');
    expect(ut.forlopp.implantat[0]).toMatchObject({ artikel: 'Höftprotes (demo)', lot: 'LOT-2026-114', av: 'Tove Ahlström' });
    expect(ut.forlopp.checklista.every(c => c.klar)).toBe(true);
  });

  test('uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas', () => {
    const db = sandlada();
    ny(db);
    const { id, vid, s } = tillUppvak(db);
    const u0 = op.uppvakning(s, rad(db, id), vid(140));
    expect(u0.kanSkrivasUt).toBe(false);
    expect(u0.text).toContain('minst 30 minuter');
    op.kontroll(s, rad(db, id), { varden: { medvetande: 'A', saturation: 91, andningsfrekvens: 14, puls: 88, blodtryck: '128/76', smarta: 5 } }, vid(150));
    const u1 = op.uppvakning(s, rad(db, id), vid(170));
    expect(u1.text).toBe('Inte klar: syremättnad, smärta.');
    expect(u1.kriterier.find(k => k.typ === 'saturation').text).toBe('Syremättnad 91. Krav: minst 94 procent.');
    expect(() => op.skrivUt(s, rad(db, id), {}, vid(170))).toThrow('Inte klar: syremättnad, smärta.');
    op.kontroll(s, rad(db, id), { varden: { saturation: 96, smarta: 2 } }, vid(175));
    expect(op.uppvakning(s, rad(db, id), vid(176))).toMatchObject({ kanSkrivasUt: true, text: 'Alla kriterier är uppfyllda. Patienten kan skrivas ut från uppvakningen.' });
    expect(() => op.kontroll(s, rad(db, id), { varden: { saturation: 140 } }, vid(177))).toThrow('Syremättnad måste vara ett tal');
  });

  test('utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen', () => {
    const db = sandlada();
    ny(db);
    const { id, vid, s } = tillUppvak(db);
    op.kontroll(s, rad(db, id), { varden: { medvetande: 'A', saturation: 97, andningsfrekvens: 14, puls: 76, blodtryck: '132/78', smarta: 2 } }, vid(170));
    // Sjuksköterskan skriver ut men ordinerar inte: systemet föreslår kontrollerna till läkaren.
    const r = op.skrivUt(s, rad(db, id), {}, vid(175));
    expect(r.status).toBe('klar');
    expect(r.overrapport).toContain('Situation: Primär total höftledsplastik med cement höger sida i regional anestesi (spinal), klar klockan');
    expect(r.overrapport).toContain('Implantat: Höftprotes, cementerad stam (demo) (lot LOT-2026-114).');
    expect(r.overrapport).toContain('syremättnad 97');
    expect(r.postopForslag.kontroller).toEqual(op.POSTOP_KONTROLLER);
    expect(r.forlopp.uppvakning).toMatchObject({ av: 'Tove Ahlström' });
    // Läkaren skriver ut en annan patient och kontrollerna ordineras till avdelningen.
    ny(db, 'op2');
    const b = tillUppvak(db, 'op2');
    const l = atk(db, 'lak-kkoga', 'op2', 'operation_registrera');
    op.kontroll(l, rad(db, b.id), { varden: { medvetande: 'A', saturation: 97, andningsfrekvens: 14, puls: 76, blodtryck: '132/78', smarta: 2 } }, b.vid(170));
    const r2 = op.skrivUt(l, rad(db, b.id), {}, b.vid(175));
    expect(r2.kontroller.map(k => k.kontroll)).toEqual(op.POSTOP_KONTROLLER);
    expect(r2.kontroller.every(k => k.frekvens === 'var_4')).toBe(true);
  });

  test('dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid', () => {
    const db = sandlada();
    nyPatient(db, { id: 'op9', enhet: 'uso-ort', ar: 1960, fornamn: 'Hemlig', efternamn: 'Ortopedsson' });
    const a = op.anmal(atk(db, 'lak-ort', 'op9', 'operation_anmala'), { kva: 'NGB49', sida: 'hoger' }, BAS);
    op.planera(atk(db, 'lak-ort', 'op9', 'operation_planera'), op.anmalanRad(db, a.id), {}, BAS);
    const egen = op.oversikt(db, pers(db, 'lak-ort'), () => ({}), { datum: MORGON }, BAS);
    expect(egen.salar[0].operationer[0]).toMatchObject({ anmalanId: a.id, ingrepp: 'Primär totalprotes i knäled med cement', status: 'planerad', patient: { id: 'op9' } });
    expect(egen.salar[0].belaggning).toBe(24);
    const annan = op.oversikt(db, pers(db, 'lak-kard'), () => ({}), { datum: MORGON }, BAS);
    expect(annan.salar[0].operationer).toEqual([{ start: lokalTid(MORGON, '07:30'), slut: lokalTid(MORGON, '09:30'), upptagen: true }]);
    const text = JSON.stringify(annan);
    for (const x of ['op9', 'Hemlig', 'Ortopedsson', 'knäled', 'Henrik', 'uso-ort']) expect(text).not.toContain(x);
  });

  test('uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter', () => {
    const db = sandlada();
    ny(db, 'op1', 'kkoga-ort', { fornamn: 'Signe', efternamn: 'Statistiksson' }); ny(db, 'op2'); ny(db, 'op3');
    tillUppvak(db, 'op1');
    const b = anmal(db, 'op2', { kva: 'JKA21' });
    const pl = atk(db, 'ssk-kkoga', 'op2', 'operation_planera');
    op.planera(pl, rad(db, b.id), {}, BAS);
    op.stryk(pl, rad(db, b.id), { orsak: 'patient_sjuk' }, efter(30));
    anmal(db, 'op3', { kva: 'JEA01', prioritet: 'akut' });
    const u = op.uppfoljning(db, pers(db, 'lak-kkoga'), { fran: datumAv(BAS), till: addDagar(datumAv(BAS), 6) }, efter(3 * 24 * 60));
    expect(u.vantande).toMatchObject({ antal: 2, overMal: 1 });
    expect(u.vantetid).toEqual({ genomforda: 1, medianDagar: 0, inomMal: 1 });
    expect(u.strukna).toEqual({ antal: 1, andel: 50, perOrsak: [{ orsak: 'Patienten är sjuk', antal: 1 }] });
    expect(u.salar.find(s => s.id === 'kkoga-sal-1')).toMatchObject({ planeradeMinuter: 130, tillgangligaMinuter: 5 * 510 });
    expect(u.perIngrepp).toEqual([{ kva: 'NFB49', namn: 'Primär total höftledsplastik med cement', antal: 1, medelMinuter: 95, beraknadeMinuter: 100 }]);
    const text = JSON.stringify(u);
    for (const x of ['op1', 'op2', 'Signe', 'Statistiksson', 'personnummer', 'anmalanId']) expect(text).not.toContain(x);
    expect(() => op.uppfoljning(db, pers(db, 'usk-kard'), {}, BAS)).toThrow('uppföljningen');
  });

  test('behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen', () => {
    const db = sandlada();
    nyPatient(db, { id: 'op5', enhet: 'kkoga-ort', ar: 1970 });
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op5', 'uso-ort', 'slutenvard', ?, 'Avdelning', 'Planerad vård')").run(BAS.toISOString());
    expect(() => op.anmal(atk(db, 'ssk-kkoga', 'op5', 'operation_anmala'), { kva: 'JKA21' }, BAS)).toThrow('Yrkesrollen får inte anmäla patienter till operation');
    anmal(db, 'op5', { kva: 'JKA21' });
    const las = () => op.forPatient(atk(db, 'lak-ort', 'op5', 'las_operation', { andra_enheter: true }), BAS);
    expect(las().operationer.map(o => o.kva)).toEqual(['JKA21']);
    const utan = JSON.stringify(op.forPatient(atk(db, 'lak-ort', 'op5', 'las_operation'), BAS));
    sparr(db, 'op5', 'kkoga-ort');
    const a = atk(db, 'lak-ort', 'op5', 'las_operation', { andra_enheter: true });
    const r = op.forPatient(a, BAS);
    expect(r.operationer).toEqual([]);
    expect(a.doldaSparr).toBe(true);
    expect(JSON.stringify(r)).toBe(utan);
  });

  test('säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val', () => {
    const db = sandlada();
    ny(db, 'op1'); ny(db, 'op2');
    const a = anmal(db);
    const an = rad(db, a.id);
    const A = (h) => atk(db, 'lak-kkoga', 'op2', h);
    for (const f of [() => op.bestallProver(A('bestalla_prov'), an, BAS), () => op.planeringsforslag(A('operation_planera'), an, BAS), () => op.planera(A('operation_planera'), an, {}, BAS),
      () => op.stryk(A('operation_planera'), an, { orsak: 'tidsbrist' }, BAS), () => op.anestesibedomning(A('operation_anmala'), an, { asa: 2 }, BAS), () => op.checklistaUnderlag(A('las_operation'), an),
      () => op.checklista(A('operation_registrera'), an, { del: 'fore_anestesi', bekraftade: ALLA('fore_anestesi') }, BAS), () => op.registrera(A('operation_registrera'), an, { handelse: 'in_sal' }, BAS),
      () => op.implantat(A('operation_registrera'), an, {}, BAS), () => op.kontroll(A('operation_registrera'), an, {}, BAS), () => op.uppvakning(A('las_operation'), an, BAS), () => op.skrivUt(A('operation_registrera'), an, {}, BAS)]) {
      try { f(); throw new Error('ingen 404'); } catch (e) { expect([e.status, e.message]).toEqual([404, 'Uppgiften finns inte.']); }
    }
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('op1', 'uso-ort', 'slutenvard', ?, 'Avdelning', 'Vård')").run(BAS.toISOString());
    expect(() => op.planera(atk(db, 'lak-ort', 'op1', 'operation_planera'), an, {}, BAS)).toThrow('aktivt val');
    expect(() => op.planera(atk(db, 'lak-ort', 'op1', 'operation_planera', { andra_enheter: true }), an, {}, BAS)).toThrow('anmälande vårdenheten');
    expect(op.checklistaUnderlag(atk(db, 'lak-ort', 'op1', 'las_operation', { andra_enheter: true }), an).allergier).toBe('Ingen registrerad överkänslighet.');
    sparr(db, 'op1', 'kkoga-ort');
    expect(() => op.checklistaUnderlag(atk(db, 'lak-ort', 'op1', 'las_operation', { andra_enheter: true }), an)).toThrow('spärrade');
  });
});

// Runda 13, r3: behandlingsgarantin. Planerad vård, som en operation, ska ges inom 90 dagar från vårdgivarens beslut
// (6 kap. 1 § hälso- och sjukvårdsförordningen). Beslutet är anmälan till operation.
describe('Behandlingsgarantin', () => {
  test('behandlingsgarantin räknas 90 dagar från anmälan till operation och visas i anmälan och på väntelistan', () => {
    const db = sandlada();
    ny(db);
    const a = anmal(db, 'op1', { kva: 'NFB49', sida: 'hoger', prioritet: 'inom_3_manader' });
    expect(a.behandlingsgaranti).toMatchObject({ datum: addDagar(datumAv(BAS), 90), passerad: false });
    expect(a.behandlingsgaranti.text).toContain('6 kap. 1 § hälso- och sjukvårdsförordningen');
    const v = op.vantelista(db, pers(db, 'lak-kkoga'), () => ({}), BAS).vantande.find(x => x.id === a.id);
    expect(v.behandlingsgaranti).toMatchObject({ datum: addDagar(datumAv(BAS), 90), passerad: false });
    const sent = new Date(BAS.getTime() + 95 * 86400_000);
    expect(op.anmalanUt(atk(db, 'lak-kkoga', 'op1', 'las_operation'), rad(db, a.id), sent).behandlingsgaranti.passerad).toBe(true);
  });
});
