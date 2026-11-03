// Vem som får ge läkemedel och säkrare utsättning och dos (runda 5, Sussa 3.5.2.8 och 3.5.2.18): läkaren ger med samma
// kontroller som sjuksköterskan, undersköterskan ger bara med en giltig delegering (HSLF-FS 2017:37 9 kap.), en dos som
// avviker från ordinationen kvitteras med motivering, och antikoagulantia sätts bara ut med en plan.
import { describe, test, expect, beforeAll, afterAll, afterEach, setSystemTime } from 'bun:test';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as administrering from '../src/administrering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as delegering from '../src/delegering.js';
import * as fhir from '../src/fhir.js';
import * as mallar from '../src/ordinationsmallar.js';
import { kanRoll } from '../src/atkomst.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => setSystemTime());
const ordFor = (db, pid, namn) => db.query('SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND k.namn LIKE ? AND o.status = \'aktiv\' ORDER BY o.id DESC').get(pid, `${namn}%`);
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const regler = (v) => v.map(x => `${x.niva}:${x.regel}`);
// En ordination av Fragmin (injektion under huden) på avdelning 72, som delegeringen inte omfattar.
function fragmin(db) {
  return lakemedel.spara(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), {
    lakemedelId: 'VK-NPL-0004', dosering: '1 injektion subkutant kl 18', dos: 5000, dosEnhet: 'IE', tider: ['18'], typ: 'tillfallig',
    ordinationsorsak: 'Tromboprofylax', uppfoljningsdatum: addDagar(idag(), 3), kvitteradeVarningar: [{ regel: 'dubbel_antikoagulantia', motivering: 'Bryggbehandling inför uppehåll med Waran' }],
  }).ordination;
}

describe('Läkare ger läkemedel', () => {
  test('läkare får ge en dos med samma kontroller och loggning som sjuksköterskan', () => {
    const db = sandladaKl('13:30');
    expect(kanRoll(personal(db, 'lak-kard'), 'ge_lakemedel')).toBe(true);
    const a = atk(db, 'lak-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    expect(administrering.lista(atk(db, 'lak-kard', 'p01')).kan.kan).toBe(true);
    // Dubbel dos varnar på samma sätt.
    expect(regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('08:00') }).varningar)).toContain('allvarlig:dubbel_dos');
    const ut = administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00') });
    expect(ut.administrering).toMatchObject({ status: 'given', utfordAv: { id: 'lak-kard' }, delegering: null });
    a.logga('ge_lakemedel', a.grund(), `ordination:${furo.id}`);
    expect(db.query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'lak-kard' AND handling = 'ge_lakemedel' ORDER BY id DESC").get().resultat).toBe('tillaten');
    // Utan vårdrelation på den egna vårdenheten nekas läkaren som sjuksköterskan.
    expect(fel(() => administrering.spara(atk(db, 'lak-lind', 'p01', { nodatkomst: true }, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00') })).status).toBe(403);
  });
});

describe('Delegering', () => {
  test('undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel');
    const l = administrering.lista(atk(db, 'usk-kard', 'p01'));
    expect(l.kan.kan).toBe(true);
    const dos = l.doser.find(d => d.lakemedel.namn.startsWith('Furosemid') && d.planerad === kl('14:00'));
    expect(dos.delegering).toMatchObject({ omfattas: true });
    expect(l.vidBehov.find(v => v.lakemedel.namn === 'Alvedon').delegering.omfattas).toBe(true);
    const ut = administrering.spara(a, { ordinationId: dos.ordinationId, planerad: dos.planerad });
    expect(ut.administrering.utfordAv.id).toBe('usk-kard');
    expect(ut.administrering.delegering).toMatchObject({ utfardadAv: 'Johan Ek', till: addDagar(idag(), 25) });
    expect(ut.administrering.delegering.omfattningText).toContain('Tabletter och kapslar som sväljs');
    const rad = db.query('SELECT * FROM administreringar WHERE id = ?').get(ut.id);
    expect(rad.delegering_id).toBeGreaterThan(0);
    const r = fhir.medicationAdministration(db, rad);
    expect(r.performer[0].actor.display).toBe('Amira Haddad');
    expect(r.performer[0].function.text).toContain('delegering');
    expect(r.note.map(n => n.text).join(' ')).toContain('HSLF-FS 2017:37');
    // Delegeringen ändras inte efter att dosen är given.
    expect(() => db.query('UPDATE administreringar SET delegering_id = NULL WHERE id = ?').run(ut.id)).toThrow(/ändras inte/);
  });

  test('undersköterska: en dos som delegeringen inte omfattar nekas och förklaras, och knappen visas inte', () => {
    const db = sandladaKl('13:30');
    const f = fragmin(db);
    const l = administrering.lista(atk(db, 'usk-kard', 'p01'));
    const dos = l.doser.find(d => d.ordinationId === f.id);
    expect(dos.delegering.omfattas).toBe(false);
    expect(dos.delegering.varfor).toContain('Fragmin');
    expect(dos.delegering.varfor).toContain('under huden');
    expect(dos.delegering.varfor).toContain('sjuksköterska');
    const a = atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel');
    const e = fel(() => administrering.spara(a, { ordinationId: f.id, planerad: dos.planerad, kvitteradeVarningar: [{ regel: 'for_tidig', motivering: 'test' }] }));
    expect(e).toMatchObject({ status: 403, kod: 'nekad' });
    expect(e.message).toContain('omfattar');
    expect(db.query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'usk-kard' AND handling = 'ge_lakemedel' ORDER BY id DESC").get().resultat).toBe('nekad');
    expect(db.query("SELECT count(*) AS n FROM administreringar WHERE utford_av = 'usk-kard'").get().n).toBe(0);
    // En dos utan ordination ges aldrig med delegering.
    const u = fel(() => administrering.spara(a, { lakemedelId: 'VK-NPL-0027', kvitteradeVarningar: [{ regel: 'utan_ordination', motivering: 'muntlig' }] }));
    expect(u.status).toBe(403);
    expect(u.message).toContain('utan ordination');
    // Sjuksköterskan ger Fragmin utan delegering.
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => d.ordinationId === f.id).delegering).toBeUndefined();
  });

  test('sjuksköterskan registrerar en dos som undersköterskan gav: delegeringen prövas för den som gav dosen', () => {
    const db = sandladaKl('14:30');
    const ssk = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const ut = administrering.spara(ssk, { ordinationId: furo.id, planerad: kl('14:00'), tid: kl('14:05'), utfordAv: 'usk-kard' });
    expect(ut.administrering).toMatchObject({ utfordAv: { id: 'usk-kard' }, registreradAv: { id: 'ssk-kard' } });
    expect(ut.administrering.delegering.utfardadAv).toBe('Johan Ek');
    const f = fragmin(db);
    setSystemTime(new Date(kl('18:10')));
    const e = fel(() => administrering.spara(ssk, { ordinationId: f.id, planerad: kl('18:00'), tid: kl('18:05'), utfordAv: 'usk-kard' }));
    expect(e).toMatchObject({ status: 400 });
    expect(e.extra.falt).toEqual(['utfordAv']);
    expect(e.message).toContain('Delegeringen för Amira Haddad omfattar');
    // Undersköterskan registrerar bara sina egna doser.
    const usk = atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel');
    expect(fel(() => administrering.spara(usk, { ordinationId: furo.id, planerad: kl('08:00'), utfordAv: 'ssk-kard', kvitteradeVarningar: [{ regel: 'dubbel_dos', motivering: 'test' }] })).extra.falt).toEqual(['utfordAv']);
  });

  test('undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    // 26 dagar senare har delegeringen gått ut.
    const sen = addDagar(idag(), 26);
    setSystemTime(new Date(kl('13:30', sen)));
    const l = administrering.lista(atk(db, 'usk-kard', 'p01'), { dag: sen });
    expect(l.kan.kan).toBe(false);
    expect(l.kan.varfor).toContain(`gällde till och med ${addDagar(sen, -1)}`);
    const e = fel(() => administrering.spara(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00', sen) }));
    expect(e.status).toBe(403);
    expect(e.message).toContain('gällde till och med');
    setSystemTime(new Date(kl('13:30')));
    // Registrering i efterhand prövas mot delegeringen den dag dosen gavs.
    const p = personal(db, 'usk-kard');
    expect(delegering.prova(db, p, { lm: { namn: 'Furosemid Teva', form: 'tablett', atc: 'C03CA01' }, ms: Date.parse(kl('10:00', addDagar(idag(), -400))), ordination: furo }).omfattas).toBe(false);
    // Utan något delegeringsbeslut alls.
    db.exec('DROP TRIGGER delegering_raderas_ej');
    db.exec("DELETE FROM delegeringar WHERE personal_id = 'usk-kard'");
    const l2 = administrering.lista(atk(db, 'usk-kard', 'p01'));
    expect(l2.kan).toMatchObject({ kan: false });
    expect(l2.kan.varfor).toContain('ingen delegering');
  });

  test('undersköterska: delegeringen gäller bara den vårdenhet den är utfärdad för', () => {
    const db = sandladaKl('13:30');
    const p = personal(db, 'usk-kard');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const lm = { namn: 'Furosemid Teva', form: 'tablett', atc: 'C03CA01' };
    expect(delegering.prova(db, p, { lm, ms: Date.now(), ordination: furo }).omfattas).toBe(true);
    // Samma person inloggad på en annan vårdenhet.
    const annan = { ...p, enhet_id: 'lind-med' };
    const r = delegering.prova(db, annan, { lm, ms: Date.now(), ordination: furo });
    expect(r.omfattas).toBe(false);
    expect(r.varfor).toContain('Kardiologiska kliniken USÖ');
  });

  test('undersköterska: spärr och skyddad identitet gäller som för sjuksköterskan, också med delegering', () => {
    const db = sandladaKl('13:30');
    const sert = db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p04' AND k.namn LIKE 'Sertralin%'").get();
    // Ordinationen kommer från en spärrad vårdenhet: syns inte och kan inte ges utan samtycke.
    expect(administrering.lista(atk(db, 'usk-kard', 'p04')).doser.some(d => d.ordinationId === sert.id)).toBe(false);
    expect(fel(() => administrering.spara(atk(db, 'usk-kard', 'p04', {}, 'ge_lakemedel'), { ordinationId: sert.id, planerad: kl('08:00') })).status).toBe(403);
    // Avdelningens lista maskerar skyddad identitet också för undersköterskan.
    const avd = administrering.avdelning(db, personal(db, 'usk-kard'), () => ({}));
    for (const x of avd.patienter) if (x.patient.skyddad) expect(x.patient.namn).toBe('Skyddad identitet');
    // Ingen nödåtkomst för undersköterskan.
    expect(kanRoll(personal(db, 'usk-kard'), 'nodatkomst')).toBe(false);
  });

  test('registrera delegering: sjuksköterska på samma vårdenhet, tidsbegränsad till högst ett år, med kontroll av kunskaperna', () => {
    const db = sandladaKl('13:30');
    const ssk = personal(db, 'ssk-kard');
    const f = delegering.oversikt(db, ssk);
    expect(f.vardenhet.id).toBe('uso-kard');
    const amira = f.personal.find(x => x.id === 'usk-kard');
    expect(amira.giltig.till).toBe(addDagar(idag(), 25));
    expect(amira.forslag).toMatchObject({ omfattning: ['tabletter_peroralt', 'insulin_subkutant'], fran: idag(), till: addDagar(idag(), 365) });
    expect(f.personal.every(x => x.yrke === 'underskoterska')).toBe(true);
    // Kunskaperna måste vara kontrollerade (9 kap. 4 §).
    expect(fel(() => delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'] })).extra.falt).toContain('kunskapKontrollerad');
    // Längre än ett år går inte.
    const lang = fel(() => delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], till: addDagar(idag(), 400), kunskapKontrollerad: true }));
    expect(lang.extra.falt).toContain('till');
    expect(lang.message).toContain('högst ett år');
    expect(fel(() => delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['intravenost'], kunskapKontrollerad: true })).extra.falt).toContain('omfattning');
    // Systemet fyller i giltighet och uppföljning.
    const d = delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt', 'injektion_subkutant'], kunskapKontrollerad: true });
    expect(d).toMatchObject({ personal: { id: 'usk-kard' }, fran: idag(), till: addDagar(idag(), 365), uppfoljning: addDagar(idag(), 365), utfardadAv: { id: 'ssk-kard' }, vardenhet: { id: 'uso-kard' } });
    expect(db.query("SELECT resultat, grund, handling FROM atkomstlogg WHERE personal_id = 'ssk-kard' ORDER BY id DESC").get()).toEqual({ resultat: 'tillaten', grund: 'administrativ', handling: 'delegera' });
    // Nu omfattas Fragmin.
    const fr = fragmin(db);
    expect(administrering.lista(atk(db, 'usk-kard', 'p01')).doser.find(x => x.ordinationId === fr.id).delegering.omfattas).toBe(true);
    // Beslutet ändras och raderas aldrig.
    expect(() => db.query('UPDATE delegeringar SET till = ? WHERE id = ?').run(addDagar(idag(), 900), d.id)).toThrow(/ändras inte/);
    expect(() => db.query('DELETE FROM delegeringar WHERE id = ?').run(d.id)).toThrow(/raderas inte/);
  });

  test('registrera delegering: fel roll och fel vårdenhet nekas och loggas', () => {
    const db = sandladaKl('13:30');
    for (const id of ['usk-kard', 'adm-kard', 'logg']) {
      const e = fel(() => delegering.registrera(db, personal(db, id), { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true }));
      expect({ id, status: e?.status }).toEqual({ id, status: 403 });
      expect(db.query('SELECT resultat FROM atkomstlogg WHERE personal_id = ? ORDER BY id DESC').get(id).resultat).toBe('nekad');
    }
    // En sjuksköterska i Lindesberg kan inte delegera till en undersköterska på kardiologen, och ser inte henne.
    const lind = personal(db, 'ssk-lind');
    const e = fel(() => delegering.registrera(db, lind, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true }));
    expect(e.status).toBe(400);
    expect(e.message).toContain('samma vårdenhet');
    expect(delegering.oversikt(db, lind).personal.some(x => x.id === 'usk-kard')).toBe(false);
    // Bara undersköterskor tar emot delegering i demon.
    expect(fel(() => delegering.registrera(db, personal(db, 'ssk-kard'), { personalId: 'lak-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true })).status).toBe(400);
  });

  test('återkallad delegering ger ingen rätt, och återkallas bara en gång med orsak', () => {
    const db = sandladaKl('13:30');
    const ssk = personal(db, 'ssk-kard');
    const id = db.query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' ORDER BY till DESC").get().id;
    expect(fel(() => delegering.aterkalla(db, ssk, id, {})).status).toBe(400);
    expect(delegering.aterkalla(db, ssk, id, { orsak: 'Uppföljningen visade att utbildningen behöver göras om' }).aterkallad.av).toBe('Johan Ek');
    expect(fel(() => delegering.aterkalla(db, ssk, id, { orsak: 'igen' })).status).toBe(400);
    const l = administrering.lista(atk(db, 'usk-kard', 'p01'));
    expect(l.kan.kan).toBe(false);
    expect(l.kan.varfor).toContain('återkallades');
    expect(fel(() => delegering.aterkalla(db, personal(db, 'ssk-lind'), id, { orsak: 'test' })).status).toBe(403);
  });

  test('påminnelse i inkorgen när en delegering går ut inom 30 dagar, bara på samma vårdenhet och borta efter förnyelse', () => {
    const db = sandladaKl('13:30');
    const ssk = personal(db, 'ssk-kard');
    const p = delegering.paminnelser(db, ssk);
    expect(p).toEqual([expect.objectContaining({ personalId: 'usk-kard', namn: 'Amira Haddad', till: addDagar(idag(), 25), dagarKvar: 25 })]);
    expect(p[0].text).toContain('25 dagar');
    expect(delegering.paminnelser(db, personal(db, 'ssk-lind'))).toEqual([]);
    expect(delegering.paminnelser(db, personal(db, 'usk-kard'))).toEqual([]);
    expect(delegering.paminnelser(db, personal(db, 'lak-kard'))).toEqual([]);
    delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt', 'insulin_subkutant'], kunskapKontrollerad: true });
    expect(delegering.paminnelser(db, ssk)).toEqual([]);
  });
});

// Runda 5, beslut 2026-11-03: läkare får också delegera (9 kap. 2 § HSLF-FS 2017:37), på samma villkor som sjuksköterskan.
describe('Delegering av läkare', () => {
  test('läkaren registrerar och återkallar delegering på samma villkor som sjuksköterskan: samma vårdenhet, inte för sig själv och samma gränser för giltighet', () => {
    const db = sandladaKl('13:30');
    const lak = personal(db, 'lak-kard');
    expect(kanRoll(lak, 'delegera')).toBe(true);
    // Samma översikt och samma förslag som sjuksköterskan får.
    const f = delegering.oversikt(db, lak);
    expect(f.kan).toBe(true);
    const fSsk = delegering.oversikt(db, personal(db, 'ssk-kard'));
    expect(f.personal.map(p => [p.id, p.forslag])).toEqual(fSsk.personal.map(p => [p.id, p.forslag]));
    // Samma krav: kontrollerade kunskaper, högst ett år och start högst 30 dagar fram.
    expect(fel(() => delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'] })).extra.falt).toContain('kunskapKontrollerad');
    expect(fel(() => delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], till: addDagar(idag(), 400), kunskapKontrollerad: true })).extra.falt).toContain('till');
    expect(fel(() => delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], fran: addDagar(idag(), 31), kunskapKontrollerad: true })).extra.falt).toContain('fran');
    // Inte för sig själv.
    const sjalv = fel(() => delegering.registrera(db, lak, { personalId: 'lak-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true }));
    expect(sjalv.status).toBe(400);
    expect(sjalv.message).toContain('dig själv');
    // Inte för en undersköterska på en annan vårdenhet, som läkaren inte heller ser.
    const akut = personal(db, 'lak-akut');
    expect(fel(() => delegering.registrera(db, akut, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true })).message).toContain('samma vårdenhet');
    expect(delegering.oversikt(db, akut).personal.some(x => x.id === 'usk-kard')).toBe(false);
    // Registreringen sparas med läkaren som den som delegerat, och loggas.
    const d = delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt', 'injektion_subkutant'], kunskapKontrollerad: true });
    expect(d).toMatchObject({ personal: { id: 'usk-kard' }, fran: idag(), till: addDagar(idag(), 365), uppfoljning: addDagar(idag(), 365), utfardadAv: { id: 'lak-kard', namn: 'Sara Lindqvist' }, vardenhet: { id: 'uso-kard' } });
    expect(db.query("SELECT resultat, grund, handling FROM atkomstlogg WHERE personal_id = 'lak-kard' ORDER BY id DESC").get()).toEqual({ resultat: 'tillaten', grund: 'administrativ', handling: 'delegera' });
    // Undersköterskan ger Fragmin med läkarens delegering, och dosen visar vem som delegerat.
    const fr = fragmin(db);
    const dos = administrering.lista(atk(db, 'usk-kard', 'p01')).doser.find(x => x.ordinationId === fr.id);
    expect(dos.delegering.omfattas).toBe(true);
    const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(fr.lakemedel.id);
    expect(delegering.prova(db, personal(db, 'usk-kard'), { lm, ordination: fr }).delegering).toMatchObject({ id: d.id, utfardadAv: 'Sara Lindqvist' });
    // Läkaren på en annan vårdenhet kan inte återkalla, och nekandet loggas. Läkaren på samma vårdenhet kan.
    expect(fel(() => delegering.aterkalla(db, akut, d.id, { orsak: 'Försök från akuten' })).status).toBe(403);
    expect(db.query("SELECT resultat, handling FROM atkomstlogg WHERE personal_id = 'lak-akut' ORDER BY id DESC").get()).toEqual({ resultat: 'nekad', handling: 'delegera' });
    expect(delegering.aterkalla(db, lak, d.id, { orsak: 'Uppföljningen visade att utbildningen behöver göras om' }).aterkallad.av).toBe('Sara Lindqvist');
    // Texten till undersköterskan säger att en sjuksköterska eller läkare registrerar en ny delegering.
    for (const x of db.query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' AND aterkallad_tid IS NULL").all()) delegering.aterkalla(db, lak, x.id, { orsak: 'Test utan delegering' });
    expect(administrering.lista(atk(db, 'usk-kard', 'p01')).kan.varfor).toContain('sjuksköterska eller läkare');
  });

  test('läkaren påminns bara om de delegeringar som läkaren själv har utfärdat, sjuksköterskan som förut', () => {
    const db = sandladaKl('13:30');
    const lak = personal(db, 'lak-kard');
    // Seedens delegeringar är utfärdade av Johan Ek, så läkaren får ingen påminnelse om dem.
    expect(delegering.paminnelser(db, lak)).toEqual([]);
    expect(delegering.paminnelser(db, personal(db, 'ssk-kard')).map(p => p.personalId)).toEqual(['usk-kard']);
    // Läkarens beslut tar vid efter Johan Eks utan glapp och gäller längre, så ingen påminnelse.
    delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], till: addDagar(idag(), 200), kunskapKontrollerad: true });
    expect(delegering.paminnelser(db, lak)).toEqual([]);
    expect(delegering.paminnelser(db, personal(db, 'ssk-kard'))).toEqual([]);
    // Ett beslut från läkaren som är det sista i kedjan och går ut om tio dagar ger läkaren en påminnelse.
    for (const x of db.query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' AND aterkallad_tid IS NULL").all()) delegering.aterkalla(db, lak, x.id, { orsak: 'Test av påminnelsen' });
    delegering.registrera(db, lak, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], till: addDagar(idag(), 10), kunskapKontrollerad: true });
    expect(delegering.paminnelser(db, lak).map(x => [x.personalId, x.dagarKvar])).toEqual([['usk-kard', 10]]);
    expect(delegering.paminnelser(db, personal(db, 'ssk-kard')).map(x => [x.personalId, x.dagarKvar])).toEqual([['usk-kard', 10]]);
    // En läkare på en annan vårdenhet påminns aldrig.
    expect(delegering.paminnelser(db, personal(db, 'lak-akut'))).toEqual([]);
  });
});

describe('Dos som avviker från ordinationen', () => {
  test('en annan dos än ordinationens varnar och måste kvitteras med motivering, allvarlig vid mer än dubbelt eller mindre än hälften', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const k = (dos) => regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00'), dos }).varningar);
    expect(k(40)).toEqual([]);
    expect(k(60)).toEqual(['observera:avvikande_dos']);
    expect(k(80)).toEqual(['observera:avvikande_dos']);
    expect(k(120)).toEqual(['allvarlig:avvikande_dos']);
    expect(k(10)).toEqual(['allvarlig:avvikande_dos']);
    const v = administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00'), dos: 120 }).varningar[0];
    expect(v.text).toContain('120 mg');
    expect(v.text).toContain('40 mg');
    expect(v.text).toContain('mer än dubbelt');
    // Också en observation måste kvitteras.
    const e = fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), dos: 60 }));
    expect(e.extra.kraverKvittens).toEqual(['avvikande_dos']);
    const ok = administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), dos: 60, kvitteradeVarningar: [{ regel: 'avvikande_dos', motivering: 'Läkaren ökade dosen muntligt på ronden' }] });
    expect(ok.administrering).toMatchObject({ dos: 60, kvitteradeVarningar: [{ regel: 'avvikande_dos', motivering: 'Läkaren ökade dosen muntligt på ronden' }] });
  });

  test('en dos inom ordinationens intervall ("1 till 2 tabletter") varnar inte', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const alvedon = ordFor(db, 'p01', 'Alvedon');
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, dos: 500, antal: 2 }).varningar)).toEqual([]);
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, dos: 500, antal: 3 }).varningar)).toEqual(['observera:avvikande_dos']);
    // Utan dos i ordinationen (Waran enligt doseringsschema) finns inget att jämföra med.
    const waran = ordFor(db, 'p01', 'Waran');
    expect(regler(administrering.kontroll(a, { ordinationId: waran.id, dos: 5 }).varningar)).not.toContain('observera:avvikande_dos');
  });
});

describe('Utsättning av antikoagulantia', () => {
  test('utsättning av Waran kräver en plan, som sparas med utsättningen och syns i listan och i FHIR', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    const waran = ordFor(db, 'p01', 'Waran');
    const k = lakemedel.utsattningskontroll(a, waran);
    expect(regler(k.varningar)).toEqual(['allvarlig:antikoagulantia']);
    expect(k.varningar[0].text).toContain('blodpropp och stroke');
    expect(k.varningar[0].plan).toBe(true);
    expect(k.planer.map(p => p.typ)).toEqual(['byte', 'uppehall', 'avslutad']);
    expect(k.planer.find(p => p.typ === 'uppehall').aterinsattning).toBe(addDagar(idag(), 5));
    // Utan plan går det inte, inte ens med en orsak.
    const e = fel(() => lakemedel.utsatt(a, waran, { orsak: 'Byte till apixaban' }));
    expect(e).toMatchObject({ status: 400 });
    expect(e.extra.kraverPlan).toBe(true);
    // Uppehåll kräver datum för återinsättning.
    expect(fel(() => lakemedel.utsatt(a, waran, { plan: { typ: 'uppehall' } })).extra.falt).toContain('aterinsattning');
    const ater = addDagar(idag(), 6);
    const u = lakemedel.utsatt(a, waran, { plan: { typ: 'uppehall', aterinsattning: ater } });
    expect(u.ordination.utsatt.orsak).toBe('Uppehåll inför ingrepp');
    expect(u.ordination.utsatt.plan).toMatchObject({ typ: 'uppehall', aterinsattning: ater, text: `Uppehåll inför ingrepp, återinsätts ${ater}` });
    expect(u.ordination.historik.map(h => h.handelse)).toContain('Plan vid utsättning');
    const r = fhir.medicationRequest(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(waran.id));
    expect(r.status).toBe('stopped');
    expect(r.extension.find(x => x.url.endsWith('/utsattningsplan')).valueCode).toBe('uppehall');
    expect(r.extension.find(x => x.url.endsWith('/aterinsattningsdatum')).valueDate).toBe(ater);
    expect(r.note[0].text).toContain('Plan vid utsättning');
    expect(() => db.query("UPDATE utsattningsplaner SET typ = 'avslutad'").run()).toThrow(/ändras inte/);
  });

  test('vid byte föreslår systemet det nya antikoagulantia som redan är ordinerat', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    lakemedel.spara(a, { lakemedelId: 'VK-NPL-0002', dosering: '1 tablett morgon och kväll', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], ordinationsorsak: 'Förmaksflimmer, byte från warfarin', uppfoljningsdatum: addDagar(idag(), 30),
      kvitteradeVarningar: [{ regel: 'dubbel_antikoagulantia', motivering: 'Waran sätts ut i dag' }] });
    const waran = ordFor(db, 'p01', 'Waran');
    const byte = lakemedel.utsattningskontroll(a, waran).planer.find(p => p.typ === 'byte');
    expect(byte.ersattMed).toBe('Eliquis');
    const u = lakemedel.utsatt(a, waran, { plan: { typ: 'byte', ersattMed: byte.ersattMed } });
    expect(u.ordination.utsatt).toMatchObject({ orsak: 'Byte till annat antikoagulantia: Eliquis', plan: { typ: 'byte', text: 'Byte till annat medel: Eliquis' } });
  });

  test('plan via API, och läkemedel utan antikoagulantia sätts ut utan plan', async () => {
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('lak-kard');
      const lista = (await k.get('/api/patient/p01/lakemedel')).data;
      const waran = lista.ordinationer.find(o => o.aktuell && o.lakemedel.namn === 'Waran');
      const utan = await k.post(`/api/ordination/${waran.id}/utsatt`, { orsak: 'Byte' });
      expect(utan.status).toBe(400);
      expect(utan.data.kraverPlan).toBe(true);
      const ok = await k.post(`/api/ordination/${waran.id}/utsatt`, { plan: { typ: 'avslutad' } });
      expect(ok.status).toBe(200);
      expect(ok.data.ordination.utsatt.plan.text).toBe('Avslutad behandling');
      const efter = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(o => o.id === waran.id);
      expect(efter.utsatt.plan.typ).toBe('avslutad');
      const alvedon = lista.ordinationer.find(o => o.aktuell && o.lakemedel.namn === 'Alvedon');
      expect((await k.post(`/api/ordination/${alvedon.id}/utsatt`, { orsak: 'Smärtfri' })).status).toBe(200);
      expect(verifiera(sandlada(app, k).db).hel).toBe(true);
    } finally { app.stopp(); }
  });
});

// Fel som säkerhetsgranskningen av runda 5 hittade. Varje test visade felet innan det rättades.
describe('Säkerhetsgranskning av delegering och dos', () => {
  test('en delegering kan inte registreras flera år fram: från högst 30 dagar fram och till högst ett år efter beslutsdagen', () => {
    const db = sandladaKl('13:30');
    const ssk = personal(db, 'ssk-kard');
    const reg = (inp) => fel(() => delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true, ...inp }));
    expect(reg({ fran: '2035-01-01', till: '2035-12-31' }).extra.falt).toContain('fran');
    expect(reg({ fran: addDagar(idag(), 31) }).extra.falt).toContain('fran');
    // Till räknas från beslutsdagen, inte från startdagen.
    expect(reg({ fran: addDagar(idag(), 20), till: addDagar(idag(), 380) }).extra.falt).toContain('till');
    const d = delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true, fran: addDagar(idag(), 30) });
    expect(d).toMatchObject({ fran: addDagar(idag(), 30), till: addDagar(idag(), 365), uppfoljning: addDagar(idag(), 365) });
  });

  test('påminnelsen räknas från beslutet som gäller i dag, och ett senare beslut tystar den bara om det tar vid utan glapp', () => {
    const db = sandladaKl('13:30');
    const ssk = personal(db, 'ssk-kard');
    const ny = (fran) => delegering.registrera(db, ssk, { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true, fran });
    // Nuvarande delegering går ut om 25 dagar. Ett beslut som börjar om 28 dagar lämnar två dagar utan delegering.
    ny(addDagar(idag(), 28));
    expect(delegering.paminnelser(db, ssk).map(p => [p.personalId, p.till])).toEqual([['usk-kard', addDagar(idag(), 25)]]);
    // Ett beslut som börjar dagen efter tar vid utan glapp.
    ny(addDagar(idag(), 26));
    expect(delegering.paminnelser(db, ssk)).toEqual([]);
  });

  test('avvikande dos räknas som dos gånger antal, så antal kringgår inte varningen', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const k = (inp) => regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00'), ...inp }).varningar);
    expect(k({ dos: 400 })).toEqual(['allvarlig:avvikande_dos']);
    expect(k({ antal: 20 })).toEqual(['allvarlig:avvikande_dos']);
    expect(k({ dos: 40, antal: 2 })).toEqual(['observera:avvikande_dos']);
    expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), antal: 20 })).extra.kraverKvittens).toEqual(['avvikande_dos']);
    // Alvedon 500 mg, "1 till 2 tabletter": två tabletter ger ingen varning, tre gör det.
    const alvedon = ordFor(db, 'p01', 'Alvedon');
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, antal: 2 }).varningar)).toEqual([]);
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, antal: 3 }).varningar)).toEqual(['observera:avvikande_dos']);
  });

  test('administrationssättet ska passa läkemedelsformen, och delegeringens kategori bestäms av formen', () => {
    const db = sandladaKl('13:30');
    // En injektionsvätska kan inte ordineras under tungan.
    expect(fel(() => mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0004', administrationssatt: 'sublingualt' })).extra.falt).toEqual(['administrationssatt']);
    expect(fel(() => mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0010', administrationssatt: 'subkutant' })).extra.falt).toEqual(['administrationssatt']);
    expect(mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0004', administrationssatt: 'subkutant' }).administrationssatt).toBe('subkutant');
    expect(mallar.forslag(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0004'").get()).tillatnaAdministrationssatt).toContain('subkutant');
    // Också med en ordination som redan har fel administrationssätt räknas kategorin ur formen.
    delegering.registrera(db, personal(db, 'ssk-kard'), { personalId: 'usk-kard', omfattning: ['tabletter_peroralt', 'sublingualt'], kunskapKontrollerad: true });
    const f = fragmin(db);
    db.query("INSERT INTO ordination_tillagg (ordination_id, administrationssatt) VALUES (?, 'sublingualt') ON CONFLICT (ordination_id) DO UPDATE SET administrationssatt = 'sublingualt'").run(f.id);
    expect(delegering.kategoriFor({ form: 'injektionsvätska, lösning i förfylld spruta', atc: 'B01AB04' }, 'sublingualt')).toBe('injektion_subkutant');
    expect(administrering.lista(atk(db, 'usk-kard', 'p01')).doser.find(d => d.ordinationId === f.id).delegering.omfattas).toBe(false);
  });

  test('en delegering ska gälla både när en dos iordningsställs och för dostiden', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const d0 = idag();
    // Dagen efter att delegeringen gick ut försöker undersköterskan iordningsställa en dos från dess sista dag.
    const sista = addDagar(d0, 25);
    setSystemTime(new Date(kl('09:00', addDagar(d0, 26))));
    const e = fel(() => administrering.spara(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00', sista), atgard: 'iordningstall' }));
    expect(e).toMatchObject({ status: 403 });
    expect(e.message).toContain('gällde till och med');
    // En giltig delegering i dag räcker inte för en dostid efter att den har gått ut.
    setSystemTime(new Date(kl('13:30', d0)));
    const e2 = fel(() => administrering.spara(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('08:00', addDagar(d0, 26)), atgard: 'iordningstall' }));
    expect(e2).toMatchObject({ status: 403 });
    // Inom delegeringen går det.
    expect(administrering.spara(atk(db, 'usk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00', d0), atgard: 'iordningstall' }).administrering.status).toBe('iordningstalld');
  });
});

describe('Delegering via API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('API: sjuksköterskan registrerar en delegering och ser påminnelsen i inkorgen, undersköterskan ger med den', async () => {
    const ssk = klient(app);
    await ssk.logga('ssk-kard');
    const ik = (await ssk.get('/api/inkorg')).data;
    expect(ik.delegeringarSomGarUt.map(x => x.personalId)).toEqual(['usk-kard']);
    const ov = (await ssk.get('/api/delegeringar')).data;
    expect(ov.personal.map(x => x.id)).toEqual(['usk-kard']);
    expect(ov.omfattningar.map(x => x.id)).toContain('tabletter_peroralt');
    expect(ov.foreskrift).toContain('HSLF-FS 2017:37');
    const ny = await ssk.post('/api/delegeringar', { personalId: 'usk-kard', omfattning: ov.personal[0].forslag.omfattning, kunskapKontrollerad: true });
    expect(ny.status).toBe(201);
    expect((await ssk.get('/api/inkorg')).data.delegeringarSomGarUt).toEqual([]);

    const usk = klient(app);
    await usk.logga('usk-kard');
    expect((await usk.get('/api/session')).data.behorigheter).toContain('ge_lakemedel');
    expect((await usk.post('/api/delegeringar', { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true })).status).toBe(403);
    const egna = (await usk.get('/api/delegeringar')).data;
    expect(egna.egna.length).toBeGreaterThan(0);
    expect(egna.personal).toBeUndefined();
    const avd = (await usk.get('/api/administreringar')).data;
    const alvedon = avd.patienter.find(x => x.patient.id === 'p01').vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    expect(alvedon.delegering.omfattas).toBe(true);
    const r = await usk.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId });
    expect(r.status).toBe(201);
    expect(r.data.administrering.delegering.utfardadAv).toBe('Johan Ek');
    const db = sandlada(app, usk).db;
    expect(db.query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'usk-kard' AND handling = 'ge_lakemedel' ORDER BY id DESC").get().resultat).toBe('tillaten');
    // Undersköterskan sätter inte tiden för en planerad vårdhändelse.
    expect((await usk.post(`/api/ordination/${alvedon.ordinationId}/vardhandelse`, { tid: new Date(Date.now() + 86400_000).toISOString() })).status).toBe(403);
    // FHIR visar delegeringen i performer.
    const ma = (await usk.get(`/fhir/MedicationAdministration/${r.data.id}`)).data;
    expect(ma.performer[0].function.text).toContain('delegering');
    expect(verifiera(db).hel).toBe(true);
  });

  test('API: läkaren registrerar en delegering under Delegeringar, och undersköterskan ger med den', async () => {
    const lak = klient(app);
    await lak.logga('lak-kard');
    expect((await lak.get('/api/session')).data.behorigheter).toContain('delegera');
    const ov = (await lak.get('/api/delegeringar')).data;
    expect(ov.kan).toBe(true);
    expect(ov.personal.map(x => x.id)).toEqual(['usk-kard']);
    const ny = await lak.post('/api/delegeringar', { personalId: 'usk-kard', omfattning: ['tabletter_peroralt', 'inhalation'], kunskapKontrollerad: true });
    expect(ny.status).toBe(201);
    expect(ny.data.utfardadAv.namn).toBe('Sara Lindqvist');
    expect((await lak.post('/api/delegeringar', { personalId: 'lak-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true })).status).toBe(400);
    // Vårdadministratören kan fortfarande inte delegera.
    const adm = klient(app);
    await adm.logga('adm-kard');
    expect((await adm.post('/api/delegeringar', { personalId: 'usk-kard', omfattning: ['tabletter_peroralt'], kunskapKontrollerad: true })).status).toBe(403);
    expect((await adm.get('/api/delegeringar')).status).toBe(403);
  });

  test('API: undersköterska utan giltig delegering har inte behörigheten att ge läkemedel i sessionen', async () => {
    const usk = klient(app);
    await usk.logga('usk-kard');
    const db = sandlada(app, usk).db;
    const ssk = { id: 'ssk-kard', enhet_id: 'uso-kard-72', yrke: 'sjukskoterska' };
    for (const d of db.query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' AND aterkallad_tid IS NULL").all()) delegering.aterkalla(db, ssk, d.id, { orsak: 'Test utan delegering' });
    expect((await usk.get('/api/session')).data.behorigheter).not.toContain('ge_lakemedel');
    const lista = (await usk.get('/api/patient/p01/administreringar')).data;
    expect(lista.kan.kan).toBe(false);
  });
});
