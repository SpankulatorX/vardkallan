// Läkemedelsprocessen (Sussa 3.5.1, 3.5.2 och 3.5.3): iordningsställande, administrering och överlämnande, registrering
// i efterhand, permission, vidimering, varning vid utsättning, fördefinierade ordinationer, planerad vårdhändelse,
// läkemedelsgenomgång och vätskebalans. Klockan styrs med setSystemTime och sandlådan byggs vid den tiden, så att
// dagens doser och seedens givna doser blir desamma varje gång.
import { describe, test, expect, beforeAll, afterAll, afterEach, setSystemTime } from 'bun:test';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as administrering from '../src/administrering.js';
import * as vidimering from '../src/vidimering.js';
import * as lakemedel from '../src/lakemedel.js';
import * as mallar from '../src/ordinationsmallar.js';
import { UTSATTNINGSREGLER, DEMOREGLER_PROCESS } from '../src/lakemedelsregler.js';
import { knyt } from '../src/vardkontakt.js';
import * as fhir from '../src/fhir.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
// En sandlåda byggd vid en viss tid i dag, med klockan stående där.
function sandladaKl(k = '13:30') {
  setSystemTime(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => setSystemTime());
const ordFor = (db, pid, namn) => db.query('SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND k.namn LIKE ? AND o.status = \'aktiv\' ORDER BY o.id DESC').get(pid, `${namn}%`);
// Förslag som en läkare med nödåtkomst och aktivt val får, så att alla vårdenheters uppgifter räknas.
const fa = (db, pid) => atk(db, 'lak-kard', pid, { nodatkomst: true, andra_enheter: true }, 'ordinera');
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const regler = (v) => v.map(x => `${x.niva}:${x.regel}`);

describe('Administrering', () => {
  test('dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider', () => {
    const db = sandladaKl('13:30');
    const l = administrering.lista(atk(db, 'ssk-kard', 'p01'));
    const rad = (namn, k) => l.doser.find(d => d.lakemedel.namn.startsWith(namn) && d.planerad === kl(k));
    expect(rad('Metoprolol', '08:00')).toMatchObject({ status: 'given', forslag: null, dosering: '2 tabletter på morgonen' });
    expect(rad('Metoprolol', '08:00').administrering.utfordAv.namn).toBe('Johan Ek');
    expect(rad('Furosemid', '08:00').status).toBe('given');
    expect(rad('Furosemid', '14:00')).toMatchObject({ status: 'att_ge', forslag: 'ge' });
    // Ordinationerna som sattes ut vid dosökningen ger inga doser.
    expect(l.doser.filter(d => d.lakemedel.namn.startsWith('Metoprolol')).length).toBe(1);
    const alvedon = l.vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    expect(alvedon).toMatchObject({ kanGesNu: true, senasteDygnet: 1, max: { antal: 8, enhet: 'enheter' } });
    expect(alvedon.senaste.tid).toBe(new Date(Date.parse(kl('13:30')) - 14 * 3600_000).toISOString());
    expect(l.utanTider.map(u => u.lakemedel.namn)).toEqual(['Waran']);
    expect(l.sammanfattning).toMatchObject({ attGe: 1, forsenade: 0, givna: 2, totalt: 3 });
    expect(l.kan.kan).toBe(true);
    // Vid 16 är dosen kl 14 försenad.
    setSystemTime(new Date(kl('16:00')));
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => d.planerad === kl('14:00')).status).toBe('forsenad');
  });

  test('ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    expect(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00') }).varningar).toEqual([]);
    const ut = knyt(a, 'administreringar', administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00') }), {});
    expect(ut.administrering).toMatchObject({ status: 'given', tid: kl('13:30'), utfordAv: { id: 'ssk-kard' }, registreradAv: { id: 'ssk-kard' }, efterhand: false, dos: 40, dosEnhet: 'mg' });
    const vk = db.query("SELECT * FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL").get();
    expect(ut.vardkontakt.id).toBe(vk.id);
    expect(db.query('SELECT vardkontakt_id FROM administreringar WHERE id = ?').get(ut.id).vardkontakt_id).toBe(vk.id);
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => d.planerad === kl('14:00')).status).toBe('given');
  });

  test('varning: dubbel dos', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const v = administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('08:00') }).varningar;
    expect(regler(v)).toContain('allvarlig:dubbel_dos');
    expect(v.find(x => x.regel === 'dubbel_dos').text).toContain('redan given kl. 08.05 av Johan Ek');
    const e = fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('08:00') }));
    expect(e).toMatchObject({ status: 400 });
    expect(e.extra).toMatchObject({ kraverKvittens: ['dubbel_dos'], demoregler: true });
    const ok = administrering.spara(a, { ordinationId: furo.id, planerad: kl('08:00'), kvitteradeVarningar: [{ regel: 'dubbel_dos', motivering: 'Patienten kräktes upp tabletten' }] });
    expect(ok.administrering.kvitteradeVarningar).toEqual([{ regel: 'dubbel_dos', motivering: 'Patienten kräktes upp tabletten' }]);
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => d.lakemedel.namn.startsWith('Furosemid') && d.planerad === kl('08:00')).antalRegistreringar).toBe(2);
    // Samma substans för tätt inpå: dosen kl 14 en timme efter en extra dos.
    setSystemTime(new Date(kl('14:00')));
    expect(regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00') }).varningar)).toContain('allvarlig:dubbel_dos');
  });

  test('varning: för tidig dos', () => {
    const db = sandladaKl('11:00');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const v = administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00') }).varningar;
    expect(regler(v)).toContain('allvarlig:for_tidig');
    expect(v.find(x => x.regel === 'for_tidig').text).toContain('kl. 14.00, om 3 timmar');
    // En timme före går bra, och att iordningsställa dosen i förväg är ingen för tidig dos.
    setSystemTime(new Date(kl('13:05')));
    expect(regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00') }).varningar)).not.toContain('allvarlig:for_tidig');
    setSystemTime(new Date(kl('11:00')));
    expect(regler(administrering.kontroll(a, { ordinationId: furo.id, planerad: kl('14:00'), atgard: 'iordningstall' }).varningar)).toEqual([]);
  });

  test('varning: given dos utan ordination', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const v = administrering.kontroll(a, { lakemedelId: 'VK-NPL-0027' }).varningar;
    expect(regler(v)).toEqual(['allvarlig:utan_ordination']);
    expect(v[0].text).toContain('ingen ordination av Ibuprofen Orifarm');
    const ut = administrering.spara(a, { lakemedelId: 'VK-NPL-0027', dos: 400, kvitteradeVarningar: [{ regel: 'utan_ordination', motivering: 'Muntlig ordination av Sara Lindqvist' }] });
    expect(ut.administrering).toMatchObject({ ordinationId: null, status: 'given' });
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).utanOrdination.map(x => x.id)).toEqual([ut.id]);
    // En utsatt ordination: dosen gäller inte längre, och systemet säger varför.
    const alvedon = ordFor(db, 'p01', 'Alvedon');
    lakemedel.utsatt(atk(db, 'lak-kard', 'p01'), alvedon, { orsak: 'Smärtfri' });
    const v2 = administrering.kontroll(a, { ordinationId: alvedon.id }).varningar;
    expect(regler(v2)).toContain('allvarlig:utan_ordination');
    expect(v2.find(x => x.regel === 'utan_ordination').text).toContain('sattes ut');
  });

  test('vid behov: varnar när högsta dygnsdosen är nådd och när doserna kommer för tätt', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const alvedon = ordFor(db, 'p01', 'Alvedon');
    // I går 23.30 en tablett (seeden), sedan två tabletter vid 03.30, 07.30 och 11.30, registrerade i efterhand.
    for (const k of ['03:30', '07:30', '11:30']) administrering.spara(a, { ordinationId: alvedon.id, antal: 2, dos: 500, tid: kl(k) });
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, antal: 1 }).varningar)).toContain('allvarlig:dubbel_dos');
    const l = administrering.lista(atk(db, 'ssk-kard', 'p01')).vidBehov.find(v => v.ordinationId === alvedon.id);
    expect(l).toMatchObject({ kanGesNu: false, senasteDygnet: 7 });
    expect(l.varfor).toContain('Nästa dos tidigast');
    setSystemTime(new Date(kl('15:40')));
    const v = administrering.kontroll(a, { ordinationId: alvedon.id, antal: 2 }).varningar;
    expect(regler(v)).toEqual(['allvarlig:max_per_dygn']);
    expect(v[0].text).toContain('högst 8 tabletter per dygn');
    expect(regler(administrering.kontroll(a, { ordinationId: alvedon.id, antal: 1 }).varningar)).toEqual([]);
  });

  test('registrering i efterhand med tidpunkt och den som utförde det', () => {
    const db = sandladaKl('14:30');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    // Läkaren får ge läkemedel sedan runda 5, vårdadministratören aldrig.
    for (const utfordAv of ['ssk-akut', 'adm-kard', 'finns-inte']) {
      expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), tid: kl('14:10'), utfordAv })).extra.falt).toEqual(['utfordAv']);
    }
    expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), tid: kl('15:00') })).extra.falt).toEqual(['tid']);
    expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), tid: addDagar(idag(), -9) + 'T10:00:00Z' })).extra.falt).toEqual(['tid']);
    expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('15:00') })).extra.falt).toEqual(['planerad']);
    const ut = administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), tid: kl('14:10'), utfordAv: 'ssk-kard' });
    expect(ut.administrering).toMatchObject({ tid: kl('14:10'), registrerad: kl('14:30'), efterhand: true, utfordAv: { id: 'ssk-kard' } });
    expect(ut.varningar).toEqual([]);
    // En dos som inte gavs kräver orsak och registreras också.
    setSystemTime(new Date(kl('20:30')));
    const meto = ordFor(db, 'p01', 'Metoprolol');
    expect(fel(() => administrering.spara(a, { ordinationId: meto.id, planerad: kl('08:00', addDagar(idag(), 1)), atgard: 'ej_given' })).extra.falt).toEqual(['orsak']);
    expect(administrering.spara(a, { ordinationId: meto.id, planerad: kl('08:00', addDagar(idag(), 1)), atgard: 'ej_given', orsak: 'Puls 48, läkare kontaktad' }).administrering).toMatchObject({ status: 'ej_given', orsak: 'Puls 48, läkare kontaktad' });
  });

  test('iordningsställande med kontrollkod och sedan administrering av samma dos', () => {
    const db = sandladaKl('13:00');
    const a = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    const furo = ordFor(db, 'p01', 'Furosemid');
    const ior = administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), atgard: 'iordningstall' });
    expect(ior.administrering).toMatchObject({ status: 'iordningstalld', tid: null, iordningstalld: { av: 'Johan Ek' } });
    expect(ior.administrering.iordningstalld.kontrollkod).toBe(`VK-ADM-${String(ior.id).padStart(6, '0')}-P01`);
    expect(administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => d.planerad === kl('14:00')).status).toBe('iordningstalld');
    expect(fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00'), atgard: 'iordningstall' })).message).toContain('redan iordningsställd');
    // En etikett för en annan patient eller ett annat läkemedel stoppas.
    const a4 = atk(db, 'ssk-kard', 'p04', {}, 'ge_lakemedel');
    expect(fel(() => administrering.spara(a4, { ordinationId: ordFor(db, 'p04', 'Trombyl').id, kontrollkod: ior.administrering.iordningstalld.kontrollkod })).extra.falt).toEqual(['kontrollkod']);
    setSystemTime(new Date(kl('14:02')));
    const ut = administrering.spara(a, { ordinationId: furo.id, kontrollkod: ior.administrering.iordningstalld.kontrollkod });
    expect(ut.id).toBe(ior.id);
    expect(ut.administrering).toMatchObject({ status: 'given', tid: kl('14:02'), planerad: kl('14:00'), iordningstalld: { av: 'Johan Ek' } });
  });

  test('administreringar raderas inte och en given dos ändras inte (trigger)', () => {
    const db = sandladaKl('13:30');
    const id = db.query("SELECT id FROM administreringar WHERE status = 'given' LIMIT 1").get().id;
    expect(() => db.query("UPDATE administreringar SET status = 'ej_given', orsak = 'x' WHERE id = ?").run(id)).toThrow(/ändras inte/);
    expect(() => db.query('UPDATE administreringar SET tid = ? WHERE id = ?').run(new Date().toISOString(), id)).toThrow(/ändras inte/);
    expect(() => db.query('DELETE FROM administreringar WHERE id = ?').run(id)).toThrow(/raderas inte/);
    expect(() => db.query("INSERT INTO administreringar (patient_id, enhet_id, lakemedel_id, status, registrerad, registrerad_av) VALUES ('p01', 'uso-kard-72', 'VK-NPL-0026', 'ej_given', 'x', 'ssk-kard')").run()).toThrow();
  });

  test('nekas: vårdadministratör och undersköterska utan delegering får inte ge läkemedel, men undersköterskan och läkaren ser listan', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    // Utan giltig delegering (runda 5): undersköterskans delegering är återkallad.
    for (const d of db.query("SELECT id FROM delegeringar WHERE personal_id = 'usk-kard' AND aterkallad_tid IS NULL").all()) {
      db.query("UPDATE delegeringar SET aterkallad_tid = ?, aterkallad_av = 'ssk-kard', aterkallad_orsak = 'Test' WHERE id = ?").run(new Date().toISOString(), d.id);
    }
    for (const p of ['usk-kard', 'adm-kard']) {
      const e = fel(() => administrering.spara(atk(db, p, 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00') }));
      expect({ p, status: e?.status }).toEqual({ p, status: 403 });
    }
    expect(administrering.lista(atk(db, 'usk-kard', 'p01')).kan.kan).toBe(false);
    expect(administrering.lista(atk(db, 'lak-kard', 'p01')).doser.length).toBe(3);
    expect(fel(() => administrering.lista(atk(db, 'adm-kard', 'p01'))).status).toBe(403);
    expect(fel(() => administrering.avdelning(db, personal(db, 'adm-kard'), () => ({}))).status).toBe(403);
  });

  test('nekas: nödåtkomst och aktivt val ger inte rätt att ge läkemedel', () => {
    const db = sandladaKl('13:30');
    const furo = ordFor(db, 'p01', 'Furosemid');
    // Sjuksköterskan i Lindesberg har ingen vårdrelation till patienten på kardiologen.
    const utan = fel(() => administrering.spara(atk(db, 'ssk-lind', 'p01', {}, 'ge_lakemedel'), { ordinationId: furo.id, planerad: kl('14:00') }));
    expect(utan).toMatchObject({ status: 403, kod: 'kraver_val' });
    const a = atk(db, 'ssk-lind', 'p01', { nodatkomst: true, andra_enheter: true }, 'ge_lakemedel');
    // Med nödåtkomst syns listan men inget kan ges.
    const l = administrering.lista(a);
    expect(l.doser.length).toBe(3);
    expect(l.kan).toMatchObject({ kan: false });
    const e = fel(() => administrering.spara(a, { ordinationId: furo.id, planerad: kl('14:00') }));
    expect(e).toMatchObject({ status: 403, kod: 'nekad' });
    expect(e.message).toContain('Nödåtkomst ger bara läsning');
    expect(db.query("SELECT count(*) AS n FROM administreringar WHERE utford_av = 'ssk-lind'").get().n).toBe(0);
    expect(db.query("SELECT resultat, grund FROM atkomstlogg WHERE personal_id = 'ssk-lind' AND handling = 'ge_lakemedel' ORDER BY id DESC").get()).toEqual({ resultat: 'nekad', grund: 'nekad' });
    // Ingen kontakt skapades av försöket.
    expect(db.query("SELECT count(*) AS n FROM vardkontakter WHERE skapad_av = 'ssk-lind'").get().n).toBe(0);
    // Vätskebalans och vidimering följer samma regel.
    expect(fel(() => administrering.registreraVatska(atk(db, 'ssk-lind', 'p01', { nodatkomst: true }, 'registrera_matvarde'), { riktning: 'ut', typ: 'urin', volymMl: 300 })).status).toBe(403);
    expect(fel(() => vidimering.vidimera(atk(db, 'lak-lind', 'p01', { nodatkomst: true }, 'ordinera'))).status).toBe(403);
  });

  test('per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda', () => {
    const db = sandladaKl('13:30');
    const t = new Date().toISOString();
    // En patient som kardiologen inte har vårdrelation till (kontakt skapad under nödåtkomst) och en skyddad patient.
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, ger_vardrelation) VALUES ('p02', 'uso-kard-72', 'slutenvard', ?, 'Avd 72, sal 9', 'Test', 0)").run(t);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak) VALUES ('p03', 'uso-kard-72', 'slutenvard', ?, 'Avd 72, sal 8', 'Test')").run(t);
    const val = {};
    const l = administrering.avdelning(db, personal(db, 'ssk-kard'), (pid) => val[pid] ?? {});
    const ids = l.patienter.map(x => x.patient.id);
    expect(ids).toEqual(expect.arrayContaining(['p01', 'p03', 'p04']));
    expect(ids).not.toContain('p02');
    const p03 = l.patienter.find(x => x.patient.id === 'p03');
    expect(p03.patient).toMatchObject({ namn: 'Skyddad identitet', personnummer: '19840416-****', skyddad: true });
    expect(JSON.stringify(p03)).not.toContain('Engberg');
    // Patient 4 har spärrat psykiatrin: sertralinet syns inte, men att det finns spärrade uppgifter gör det.
    const p04 = l.patienter.find(x => x.patient.id === 'p04');
    expect(JSON.stringify(p04)).not.toContain('Sertralin');
    expect(p04.dolda.sparrade).toBe(true);
    // Varje patient i listan loggas.
    expect(db.query("SELECT DISTINCT patient_id FROM atkomstlogg WHERE resurs = 'administreringslista' AND personal_id = 'ssk-kard' ORDER BY patient_id").all().map(r => r.patient_id)).toEqual(ids.sort());
    // En sjuksköterska på en annan vårdenhet ser inte kardiologens patienter.
    expect(administrering.avdelning(db, personal(db, 'ssk-inf'), () => ({})).patienter.map(x => x.patient.id)).not.toContain('p01');
  });

  test('spärrade ordinationer kan inte administreras utan samtycke', () => {
    const db = sandladaKl('13:30');
    const sert = db.query("SELECT o.* FROM ordinationer o WHERE o.patient_id = 'p04' AND o.enhet_id = 'uso-psyk'").get();
    const e = fel(() => administrering.spara(atk(db, 'ssk-kard', 'p04', {}, 'ge_lakemedel'), { ordinationId: sert.id, planerad: kl('08:00') }));
    expect(e).toMatchObject({ status: 403, kod: 'kraver_samtycke' });
    const med = atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'ge_lakemedel');
    expect(administrering.lista(med).doser.some(d => d.ordinationId === sert.id)).toBe(true);
    const ut = administrering.spara(med, { ordinationId: sert.id, planerad: kl('08:00'), tid: kl('08:10') });
    // Dosen syns sedan inte för den som inte har samtycke.
    expect(administrering.lista(atk(db, 'ssk-kard', 'p04')).senaste.some(x => x.id === ut.id)).toBe(false);
  });

  test('en dos av en spärrad enhets ordination röjs inte i varningarna, varken tid eller vem som gav den', () => {
    const db = sandladaKl('13:30');
    const sert = db.query("SELECT o.* FROM ordinationer o WHERE o.patient_id = 'p04' AND o.enhet_id = 'uso-psyk'").get();
    administrering.spara(atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'ge_lakemedel'), { ordinationId: sert.id, planerad: kl('08:00'), tid: kl('12:00') });
    // Kardiologen ordinerar samma substans. Utan samtycke får kontrollen inte bygga på psykiatrins dos.
    const ny = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      SELECT patient_id, 'uso-kard', lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, 'lak-kard', skapad FROM ordinationer WHERE id = ? RETURNING id`).get(sert.id).id;
    const utan = administrering.kontroll(atk(db, 'ssk-kard', 'p04', {}, 'ge_lakemedel'), { ordinationId: ny }).varningar;
    expect(utan.some(v => v.regel === 'dubbel_dos')).toBe(false);
    expect(utan.map(v => v.text).join(' ')).not.toContain('Johan Ek');
    // Spärren nämns som i resten av journalen, utan att röja vad den innehåller.
    expect(utan.find(v => v.regel === 'sparrade_uppgifter')).toMatchObject({ niva: 'observation' });
    // Med samtycke räknas dosen in.
    const med = administrering.kontroll(atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'ge_lakemedel'), { ordinationId: ny }).varningar;
    expect(med.some(v => v.regel === 'dubbel_dos')).toBe(true);
  });

  test('en iordningsställd dos på en spärrad vårdenhet röjs inte, och den som ger dosen dokumenterar på sin egen vårdenhet', () => {
    const db = sandladaKl('13:30');
    const l = administrering.lista(atk(db, 'ssk-kard', 'p04'));
    const dos = l.doser.find(d => d.status === 'att_ge' || (!d.administrering && Date.parse(d.planerad) > Date.now()));
    expect(dos).toBeTruthy();
    const psyk = atk(db, 'ssk-psyk', 'p04', {}, 'ge_lakemedel');
    const ior = administrering.spara(psyk, { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'iordningstall' });
    expect(db.query('SELECT enhet_id FROM administreringar WHERE id = ?').get(ior.id).enhet_id).toBe('uso-psyk');
    // Kardiologen, utan samtycke, ser inte psykiatrins iordningsställande och kan iordningsställa och ge själv.
    const kard = () => atk(db, 'ssk-kard', 'p04', {}, 'ge_lakemedel');
    const ut = administrering.spara(kard(), { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'ge', kvitteradeVarningar: [{ regel: 'for_tidig', motivering: 'enligt plan' }] });
    expect(JSON.stringify(ut)).not.toContain('Robin Axelsson');
    expect(JSON.stringify(ut)).not.toContain('uso-psyk');
    expect(ut.id).not.toBe(ior.id);
    expect(db.query('SELECT enhet_id FROM administreringar WHERE id = ?').get(ut.id).enhet_id).toBe(personal(db, 'ssk-kard').enhet_id);
    expect(administrering.lista(kard()).doser.find(d => d.ordinationId === dos.ordinationId && d.planerad === dos.planerad).status).toBe('given');
    // En etikett från den spärrade enheten känns inte igen.
    const kod = db.query('SELECT kontrollkod FROM administreringar WHERE id = ?').get(ior.id).kontrollkod;
    const e = fel(() => administrering.spara(kard(), { ordinationId: dos.ordinationId, planerad: dos.planerad, kontrollkod: kod }));
    expect(e).toMatchObject({ status: 400 });
    expect(e.message).not.toContain('Robin');
  });

  test('en synlig iordningsställd dos från en annan vårdenhet dokumenteras på den vårdenhet som ger den', () => {
    const db = sandladaKl('13:30');
    const l = administrering.lista(atk(db, 'ssk-kard', 'p01'));
    const dos = l.doser.find(d => !d.administrering && Date.parse(d.planerad) > Date.now());
    // Iordningsställt på vårdcentralen (ingen spärr): läkemedel är gemensamma, så kardiologen ser det.
    const ior = administrering.spara(atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'iordningstall' });
    db.query("UPDATE administreringar SET enhet_id = 'vc-tybble' WHERE id = ?").run(ior.id);
    const ut = administrering.spara(atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'ge', kvitteradeVarningar: [{ regel: 'for_tidig', motivering: 'enligt plan' }] });
    expect(ut.id).toBe(ior.id);
    expect(db.query('SELECT enhet_id FROM administreringar WHERE id = ?').get(ut.id).enhet_id).toBe(personal(db, 'ssk-kard').enhet_id);
  });

  test('överlämnande märks som permission bara när patienten har permission, inte för att klienten säger det', () => {
    const db = sandladaKl('13:30');
    const dos = administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => !d.administrering && Date.parse(d.planerad) > Date.now());
    const ut = administrering.spara(atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'overlamna', permission: true });
    expect(ut.administrering.permission).toBe(false);
  });

  test('vätskebalansen visar inte volymen från en dos av en spärrad ordination', () => {
    const db = sandladaKl('13:30');
    const vatska = db.query("SELECT o.* FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = 'p01' AND o.status = 'aktiv'").all();
    // En spärrad infusion: en ordination på psykiatrin för patient 4, given med samtycke, med volym.
    const sert = db.query("SELECT o.* FROM ordinationer o WHERE o.patient_id = 'p04' AND o.enhet_id = 'uso-psyk'").get();
    const med = atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'ge_lakemedel');
    const ut = administrering.spara(med, { ordinationId: sert.id, planerad: kl('08:00'), tid: kl('12:00') });
    db.query("INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av, administrering_id) VALUES ('p04', 'uso-kard', 'in', 'lakemedel', 100, ?, ?, 'ssk-kard', ?)").run(kl('12:00'), kl('12:00'), ut.id);
    const utan = administrering.vatskebalans(atk(db, 'ssk-kard', 'p04', {}, 'las_matvarden'));
    expect(utan.poster.some(x => x.administreringId === ut.id)).toBe(false);
    expect(administrering.vatskebalans(atk(db, 'ssk-kard', 'p04', { samtycke_sparr: true }, 'las_matvarden')).poster.some(x => x.administreringId === ut.id)).toBe(true);
    expect(vatska.length).toBeGreaterThan(0);
  });

  test('läkemedelsberättelsen tar aldrig med doser från en spärrad vårdenhet, inte ens med samtycke', () => {
    const db = sandladaKl('13:30');
    // En vid behov-ordination från kardiologen som psykiatrins sjuksköterska ger: dosen dokumenteras på psykiatrin.
    const sert = db.query("SELECT o.* FROM ordinationer o WHERE o.patient_id = 'p04' AND o.enhet_id <> 'uso-psyk' AND o.status = 'aktiv'").get();
    const vb = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad)
      SELECT patient_id, enhet_id, lakemedel_id, '1 tablett vid behov', dos, dos_enhet, NULL, 1, 'vid_behov', orsak, uppfoljning, start, ordinerad_av, skapad FROM ordinationer WHERE id = ? RETURNING id`).get(sert.id).id;
    administrering.spara(atk(db, 'ssk-psyk', 'p04', {}, 'ge_lakemedel'), { ordinationId: vb, kvitteradeVarningar: ['dubbel_dos', 'max_per_dygn'].map(regel => ({ regel, motivering: 'enligt plan' })) });
    const namn = db.query('SELECT namn FROM katalog WHERE id = ?').get(sert.lakemedel_id).namn;
    const text = vidimering.genomgang(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'las_lakemedel')).berattelse.text;
    expect(text.split('\n').filter(r => r.startsWith('Vid behov')).join(' ')).not.toContain(namn);
  });

  test('när någon annan registrerar en dos än den som gav den syns båda, också i FHIR', () => {
    const db = sandladaKl('13:30');
    const dos = administrering.lista(atk(db, 'ssk-kard', 'p01')).doser.find(d => !d.administrering && Date.parse(d.planerad) > Date.now());
    // En andra sjuksköterska på avdelningen, som gav dosen medan Johan Ek registrerar den.
    const kol = db.query('PRAGMA table_info(personal)').all().map(c => c.name).filter(c => c !== 'id' && c !== 'namn');
    db.query(`INSERT INTO personal (id, namn, ${kol.join(', ')}) SELECT 'ssk-kard-2', 'Sofia Lund', ${kol.join(', ')} FROM personal WHERE id = 'ssk-kard'`).run();
    const annan = 'ssk-kard-2';
    const ut = administrering.spara(atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel'), { ordinationId: dos.ordinationId, planerad: dos.planerad, atgard: 'ge', utfordAv: annan, kvitteradeVarningar: [{ regel: 'for_tidig', motivering: 'enligt plan' }] });
    expect(ut.administrering).toMatchObject({ utfordAv: { id: annan }, registreradAv: { id: 'ssk-kard' } });
    const r = fhir.medicationAdministration(db, db.query('SELECT * FROM administreringar WHERE id = ?').get(ut.id));
    expect(r.performer.map(p => p.actor.reference)).toEqual([`Practitioner/${annan}`, 'Practitioner/ssk-kard']);
    expect(r.performer[1].function.text).toBe('Registrerade dosen');
  });

  test('permission: doser under permission lämnas över till patienten', async () => {
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('ssk-kard');
      const vt = sandlada(app, k).db.query("SELECT vardtillfalle_id FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL").get().vardtillfalle_id;
      expect((await k.post(`/api/vardtillfalle/${vt}/permission`, { till: addDagar(idag(), 1) })).status).toBe(200);
      const l = (await k.get('/api/patient/p01/administreringar')).data;
      expect(l.permission.till).toBe(addDagar(idag(), 1));
      const kommande = l.doser.filter(d => Date.parse(d.planerad) > Date.now() && !d.administrering);
      for (const d of kommande) expect(d).toMatchObject({ underPermission: true, forslag: 'overlamna' });
      const d = (await k.get(`/api/patient/p01/administreringar?dag=${addDagar(idag(), 1)}`)).data.doser.find(x => x.lakemedel.namn.startsWith('Metoprolol'));
      expect(d).toMatchObject({ underPermission: true, forslag: 'overlamna' });
      // Att lämna över morgondagens dos inför permissionen är ingen för tidig dos.
      expect((await k.post('/api/patient/p01/administreringar/kontroll', { ordinationId: d.ordinationId, planerad: d.planerad, atgard: 'overlamna' })).data.varningar).toEqual([]);
      const r = await k.post('/api/patient/p01/administreringar', { ordinationId: d.ordinationId, planerad: d.planerad, atgard: 'overlamna' });
      expect(r.status).toBe(201);
      expect(r.data.administrering).toMatchObject({ status: 'overlamnad', permission: true, statusText: 'Överlämnad till patienten' });
    } finally { app.stopp(); }
  });
});

describe('Administrering via API', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('API: administreringslistan och en given dos loggas, och fel roll nekas och loggas', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const avd = (await k.get('/api/administreringar')).data;
    expect(avd.vardenhet.id).toBe('uso-kard');
    const alvedon = avd.patienter.find(x => x.patient.id === 'p01').vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    const r = await k.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId });
    expect(r.status).toBe(201);
    expect(r.data.vardkontakt.typ).toBe('slutenvard');
    const db = sandlada(app, k).db;
    const rad = db.query("SELECT * FROM atkomstlogg WHERE personal_id = 'ssk-kard' AND handling = 'ge_lakemedel' ORDER BY id DESC").get();
    // Ordinationen är gjord på den egna vårdenheten.
    expect(rad).toMatchObject({ patient_id: 'p01', resultat: 'tillaten', grund: 'egen_enhet' });
    // En läkare utan vårdrelation på sin vårdenhet nekas och loggas (läkare får ge läkemedel sedan runda 5).
    const lak = klient(app);
    await lak.logga('lak-psyk');
    const nekad = await lak.post('/api/patient/p01/administreringar', { ordinationId: alvedon.ordinationId });
    expect(nekad.status).toBe(403);
    expect(sandlada(app, lak).db.query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'lak-psyk' AND handling = 'ge_lakemedel' ORDER BY id DESC").get().resultat).toBe('nekad');
    expect((await lak.post('/api/patient/p01/administreringar/kontroll', { ordinationId: alvedon.ordinationId })).status).toBe(403);
    const adm = klient(app);
    await adm.logga('adm-kard');
    expect((await adm.get('/api/administreringar')).status).toBe(403);
    expect((await adm.get('/api/patient/p01/administreringar')).status).toBe(403);
    expect(verifiera(db).hel).toBe(true);
  });

  test('Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const pid = 'p01';
    const alvedon = (await k.get(`/api/patient/${pid}/administreringar`)).data.vidBehov.find(v => v.lakemedel.namn === 'Alvedon');
    const r = await k.post(`/api/patient/${pid}/administreringar`, { ordinationId: alvedon.ordinationId });
    expect(r.status).toBe(201);
    const kopia = (await k.get('/api/lasekopia')).data;
    const post = kopia.patienter[pid];
    expect(post.lakemedelsdel.delar).toEqual({ lakemedel: 'las_lakemedel', administreringar: 'las_lakemedel' });
    expect(post.administreringar.senaste.some(a => a.id === r.data.id)).toBe(true);
    expect(post.administreringar).toEqual((await k.get(`/api/patient/${pid}/administreringar`)).data);
  });

  test('FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/patient/p01/vidimering')).status).toBe(201);
    const db = sandlada(app, k).db;
    const fraga = (pid, vag, val = {}) => fhir.hantera({ db, personal: personal(db, pid), valFor: (p) => val[p] ?? {}, url: new URL(`http://test.local${vag}`), base: 'http://test.local' });
    const b = fraga('lak-kard', '/fhir/MedicationAdministration?patient=p01').body;
    expect(b.entry.length).toBeGreaterThan(2);
    const r = b.entry[0].resource;
    expect(r).toMatchObject({ resourceType: 'MedicationAdministration', status: 'completed', subject: { reference: 'Patient/p01' } });
    expect(r.performer[0].actor.reference).toMatch(/^Practitioner\//);
    expect(b.entry.some(e => e.resource.request?.reference?.startsWith('MedicationRequest/'))).toBe(true);
    // Doser av psykiatrins ordinationer till patient 4 syns inte utan samtycke, varken i sökningen eller med id.
    const sert = db.query("SELECT id FROM ordinationer WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk'").get().id;
    const dos = db.query("INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, tid, utford_av, registrerad, registrerad_av) VALUES ('p04', 'uso-kard-72', ?, 'VK-NPL-0041', NULL, 'given', ?, 'ssk-kard', ?, 'ssk-kard')").run(sert, new Date().toISOString(), new Date().toISOString()).lastInsertRowid;
    expect(fraga('lak-kard', '/fhir/MedicationAdministration?patient=p04').body.entry?.some(e => e.resource.id === String(dos)) ?? false).toBe(false);
    expect(() => fraga('lak-kard', `/fhir/MedicationAdministration/${dos}`)).toThrow();
    expect(fraga('lak-kard', `/fhir/MedicationAdministration/${dos}`, { p04: { samtycke_sparr: true } }).body.id).toBe(String(dos));
    // Vårdadministratören når inte läkemedel.
    expect(() => fraga('adm-kard', '/fhir/MedicationAdministration?patient=p01')).toThrow();
    const listor = fraga('lak-kard', '/fhir/List?patient=p01').body.entry.map(e => e.resource);
    // Vidimeringen vid inskrivningen är ersatt av den nya.
    expect(listor.map(l => l.status)).toEqual(['retired', 'current']);
    const lista = listor[1];
    expect(lista).toMatchObject({ resourceType: 'List', status: 'current', mode: 'snapshot', source: { reference: 'Practitioner/lak-kard' } });
    expect(lista.entry.length).toBe(db.query("SELECT count(*) AS n FROM ordinationer WHERE patient_id = 'p01' AND status = 'aktiv'").get().n);
  });
});

describe('Vidimering', () => {
  test('vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick', () => {
    const db = sandladaKl('13:30');
    // Patient 4 har ingen vidimering.
    const p04 = vidimering.underlag(atk(db, 'lak-kard', 'p04', {}, 'ordinera'));
    expect(p04).toMatchObject({ senaste: null, behovs: true });
    expect(p04.text).toContain('inte vidimerad');
    // Patient 1 vidimerades vid inskrivningen, före dosökningarna.
    const a = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    const fore = vidimering.underlag(a);
    expect(fore.senaste.av.namn).toBe('Sara Lindqvist');
    expect(fore.andringar.nya.map(o => o.lakemedel.namn).sort()).toEqual(['Alvedon', 'Furosemid Teva', 'Metoprolol Sandoz']);
    expect(fore.andringar.utsatta.map(o => o.utsatt.orsak).sort()).toEqual(['Dosökning vid dekompenserad hjärtsvikt', 'Dosökning, ersätts av ny ordination']);
    expect(fore.text).toContain('5 ändringar sedan vidimeringen');
    const v = vidimering.vidimera(a);
    expect(v).toMatchObject({ behovs: false, senaste: { av: { namn: 'Sara Lindqvist' } } });
    expect(v.senaste.ordinationer.length).toBe(fore.pagaende.length);
    expect(fel(() => vidimering.vidimera(a)).message).toContain('Inget har ändrats');
    // En ny ordination och en utsättning efter vidimeringen.
    setSystemTime(new Date(kl('14:00')));
    const ny = lakemedel.spara(a, { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel på morgonen', typ: 'staende', ordinationsorsak: 'Magskydd', uppfoljningsdatum: addDagar(idag(), 14) });
    lakemedel.utsatt(a, ordFor(db, 'p01', 'Alvedon'), { orsak: 'Smärtfri' });
    const u = vidimering.underlag(a);
    expect(u.andringar.nya.map(o => o.id)).toEqual([ny.ordination.id]);
    expect(u.andringar.utsatta.map(o => o.lakemedel.namn)).toEqual(['Alvedon']);
    expect(u.andringar.utsatta[0].utsatt.orsak).toBe('Smärtfri');
    expect(u.text).toContain('2 ändringar sedan vidimeringen');
    expect(vidimering.vidimera(a).behovs).toBe(false);
    expect(() => db.query('DELETE FROM vidimeringar').run()).toThrow(/raderas inte/);
  });

  test('vidimering kräver läkare med vårdrelation och omfattar inte spärrade ordinationer, inte ens med samtycke', () => {
    const db = sandladaKl('13:30');
    expect(fel(() => vidimering.vidimera(atk(db, 'ssk-kard', 'p01', {}, 'ordinera'))).status).toBe(403);
    expect(fel(() => vidimering.vidimera(atk(db, 'lak-vc', 'p04', {}, 'ordinera'))).status).toBe(403);
    const v = vidimering.vidimera(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'ordinera'));
    const ids = JSON.parse(db.query('SELECT ordinationer FROM vidimeringar WHERE id = ?').get(v.id).ordinationer).map(x => x.id);
    const sert = db.query("SELECT id FROM ordinationer WHERE patient_id = 'p04' AND enhet_id = 'uso-psyk'").get().id;
    expect(ids).not.toContain(sert);
    expect(ids.length).toBe(4);
  });
});

describe('Utsättning', () => {
  test('utsättning av betablockerare ger varning och kräver bekräftelse', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    const meto = ordFor(db, 'p01', 'Metoprolol');
    const k = lakemedel.utsattningskontroll(a, meto);
    expect(regler(k.varningar)).toEqual(['allvarlig:betablockerare']);
    // Behandlingen räknas från den första ordinationen 2014, eftersom dosökningen inte var något uppehåll.
    expect(k.varningar[0].text).toMatch(/Patienten har haft behandlingen i \d+ år/);
    expect(k.varningar[0].forslag).toContain('Trappa ned');
    const e = fel(() => lakemedel.utsatt(a, meto, { orsak: 'Bradykardi' }));
    expect(e.extra).toMatchObject({ kraverKvittens: ['betablockerare'], demoregler: true });
    expect(lakemedel.hamtaRad(db, meto.id).status).toBe('aktiv');
    const u = lakemedel.utsatt(a, meto, { orsak: 'Bradykardi, ersätts av nedtrappning', kvitteradeVarningar: [{ regel: 'betablockerare' }] });
    expect(u.ordination.status).toBe('utsatt');
    expect(u.ordination.historik.map(h => h.handelse)).toContain('Varning vid utsättning kvitterad');
  });

  test('utsättning utan särskilda observationer ger ingen varning, och antikoagulantia kräver en plan', () => {
    const db = sandladaKl('13:30');
    const a = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    expect(lakemedel.utsattningskontroll(a, ordFor(db, 'p01', 'Alvedon')).varningar).toEqual([]);
    const waran = ordFor(db, 'p01', 'Waran');
    expect(regler(lakemedel.utsattningskontroll(a, waran).varningar)).toEqual(['allvarlig:antikoagulantia']);
    // Läkaren bekräftar med planen (runda 5).
    expect(lakemedel.utsatt(a, waran, { orsak: 'Byte till apixaban', plan: { typ: 'byte', ersattMed: 'Eliquis' } }).ordination.status).toBe('utsatt');
  });

  test('utsättningsreglerna ligger i en egen modul och är märkta som demoregler', () => {
    expect(DEMOREGLER_PROCESS).toContain('demoregler');
    expect(DEMOREGLER_PROCESS).toContain('inte kliniskt beslutsstöd');
    for (const r of UTSATTNINGSREGLER) {
      expect(r.atc.length).toBeGreaterThan(0);
      expect(['allvarlig', 'observera']).toContain(r.niva);
      expect(r.text.length).toBeGreaterThan(20);
      expect(r.forslag.length).toBeGreaterThan(5);
    }
    const db = sandladaKl('13:30');
    expect(lakemedel.utsattningskontroll(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), ordFor(db, 'p01', 'Metoprolol')).anmarkning).toBe(DEMOREGLER_PROCESS);
  });
});

describe('Fördefinierade ordinationer', () => {
  test('fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient', () => {
    const db = sandladaKl('13:30');
    const lm = (id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
    // Patient 1 är 81 år: lägre högsta dygnsdos av paracetamol.
    const alv = mallar.forslag(fa(db, 'p01'), lm('VK-NPL-0026'));
    expect(alv).toMatchObject({ typ: 'vid_behov', vidBehov: true, dos: 500, dosEnhet: 'mg', administrationssatt: 'peroralt', demoregler: true });
    expect(alv.dosering).toContain('högst 6 tabletter per dygn');
    expect(alv.varfor.join(' ')).toContain('Från 75 år');
    expect(mallar.forslag(fa(db, 'p13'), lm('VK-NPL-0026')).dosering).toContain('högst 8 tabletter per dygn');
    expect(mallar.forslag(fa(db, 'p01'), lm('VK-NPL-0025'))).toMatchObject({ dosering: '1 kapsel på morgonen', tider: ['08'], uppfoljningsdatum: addDagar(idag(), 14) });
    expect(mallar.forslag(fa(db, 'p01'), lm('VK-NPL-0004'))).toMatchObject({ administrationssatt: 'subkutant', tider: ['18'] });
    expect(mallar.forslag(fa(db, 'p08'), lm('VK-NPL-0032'))).toMatchObject({ administrationssatt: 'intravenost', volymMl: 100, vatskebalans: true, tider: ['06', '14', '22'] });
    // Patient 6 har eGFR 27: halverad dos enoxaparin.
    const kl6 = mallar.forslag(fa(db, 'p06'), lm('VK-NPL-0005'));
    expect(kl6.dos).toBe(20);
    expect(kl6.varfor.join(' ')).toContain('eGFR under 30');
    // Utan mall: produktens styrka och form.
    expect(mallar.forslag(fa(db, 'p01'), lm('VK-NPL-0024'))).toMatchObject({ mall: null, dos: 100, dosEnhet: 'mikrogram', administrationssatt: 'peroralt' });
  });

  test('förslaget räknar eGFR som säkerhetsuppgift: från en annan vårdenhet utan aktivt val, aldrig från en spärrad utan samtycke', () => {
    const db = sandladaKl('13:30');
    const lm = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0005'").get();
    // Patient 4 har spärrat psykiatrin. Ett lågt eGFR därifrån får inte styra förslaget utan samtycke.
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('p04', 'uso-psyk', 'egfr', '25', 25, ?, 'lak-psyk')").run(kl('09:00'));
    const utan = mallar.forslag(atk(db, 'lak-kard', 'p04', {}, 'ordinera'), lm);
    expect(utan.dos).not.toBe(20);
    expect(utan.varfor.join(' ')).not.toContain('eGFR');
    expect(mallar.forslag(atk(db, 'lak-kard', 'p04', { samtycke_sparr: true }, 'ordinera'), lm).dos).toBe(20);
    // Från vårdcentralen (ingen spärr) räknas det utan aktivt val, som varningarna vid ordination.
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, tid, registrerad_av) VALUES ('p01', 'vc-tybble', 'egfr', '25', 25, ?, 'lak-vc')").run(kl('09:00'));
    expect(mallar.forslag(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), lm).dos).toBe(20);
  });


  test('API: ordination med förslag sparar administrationssätt och volym, och förslaget kräver ordinationsrätt', async () => {
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('lak-kard');
      const f = (await k.get('/api/patient/p01/lakemedel/forslag?lakemedelId=VK-NPL-0032')).data;
      expect(f.administrationssatt).toBe('intravenost');
      const r = await k.post('/api/patient/p01/lakemedel', { lakemedelId: 'VK-NPL-0032', dosering: f.dosering, dos: f.dos, dosEnhet: f.dosEnhet, tider: f.tider, typ: f.typ, ordinationsorsak: 'Erysipelas', uppfoljningsdatum: f.uppfoljningsdatum, administrationssatt: f.administrationssatt, volymMl: f.volymMl, mall: f.mall, kvitteradeVarningar: [{ regel: 'overkanslighet', motivering: 'Tolererat penicillin intravenöst tidigare' }] });
      expect(r.status).toBe(201);
      expect(r.data.ordination).toMatchObject({ administrationssatt: 'intravenost', administrationssattText: 'Intravenöst', volymMl: 100, vatskebalans: true });
      const lista = (await k.get('/api/patient/p01/lakemedel')).data.ordinationer.find(o => o.id === r.data.ordination.id);
      expect(lista.administrationssattText).toBe('Intravenöst');
      expect((await k.post('/api/patient/p01/lakemedel', { lakemedelId: 'VK-NPL-0025', dosering: 'x', typ: 'staende', ordinationsorsak: 'x', uppfoljningsdatum: addDagar(idag(), 3), administrationssatt: 'okant' })).status).toBe(400);
      const ssk = klient(app);
      await ssk.logga('ssk-kard');
      expect((await ssk.get('/api/patient/p01/lakemedel/forslag?lakemedelId=VK-NPL-0032')).status).toBe(403);
    } finally { app.stopp(); }
  });

  test('ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts', async () => {
    const app = testserver();
    try {
      const k = klient(app);
      await k.logga('lak-kard');
      const bas = { lakemedelId: 'VK-NPL-0005', dosering: '40 mg subkutant före ingreppet', dos: 40, dosEnhet: 'mg', typ: 'tillfallig', ordinationsorsak: 'Inför elkonvertering', uppfoljningsdatum: addDagar(idag(), 3) };
      expect((await k.post('/api/patient/p01/lakemedel', { ...bas, tider: ['08'], vardhandelse: { text: 'Elkonvertering', forskjutningTimmar: -2 } })).status).toBe(400);
      const r = await k.post('/api/patient/p01/lakemedel', { ...bas, vardhandelse: { text: 'Elkonvertering', forskjutningTimmar: -2 }, kvitteradeVarningar: [{ regel: 'dubbel_antikoagulantia', motivering: 'Bryggbehandling' }] });
      expect(r.status).toBe(201);
      const id = r.data.ordination.id;
      expect(r.data.ordination.vardhandelse).toMatchObject({ text: 'Elkonvertering', forskjutningMin: -120, tid: null, administreras: null });
      // Samma sandlåda, inloggad som sjuksköterska.
      const ssk = k;
      await ssk.logga('ssk-kard');
      let l = (await ssk.get('/api/patient/p01/administreringar')).data;
      expect(l.vantarPaHandelse.map(x => x.ordinationId)).toEqual([id]);
      expect(l.doser.some(d => d.ordinationId === id)).toBe(false);
      const imorgon = addDagar(idag(), 1);
      const t = await ssk.post(`/api/ordination/${id}/vardhandelse`, { tid: lokalTid(imorgon, '10:00') });
      expect(t.status).toBe(200);
      expect(t.data.vardhandelse.administreras).toBe(lokalTid(imorgon, '08:00'));
      l = (await ssk.get(`/api/patient/p01/administreringar?dag=${imorgon}`)).data;
      expect(l.vantarPaHandelse).toEqual([]);
      expect(l.doser.find(d => d.ordinationId === id)).toMatchObject({ planerad: lokalTid(imorgon, '08:00'), vardhandelse: { text: 'Elkonvertering' } });
      // Tidsättningen sparas i ordinationens historik.
      const db = sandlada(app, ssk).db;
      expect(db.query("SELECT personal_id FROM ordination_historik WHERE ordination_id = ? AND handelse = 'vardhandelse_tid'").all(id)).toEqual([{ personal_id: 'ssk-kard' }]);
      await k.logga('adm-kard');
      expect((await k.post(`/api/ordination/${id}/vardhandelse`, { tid: lokalTid(imorgon, '11:00') })).status).toBe(403);
      // En utsatt ordination får ingen ny tid.
      db.query("UPDATE ordinationer SET status = 'utsatt' WHERE id = ?").run(id);
      await k.logga('ssk-kard');
      expect((await ssk.post(`/api/ordination/${id}/vardhandelse`, { tid: lokalTid(imorgon, '12:00') })).status).toBe(400);
    } finally { app.stopp(); }
  });
});

describe('Läkemedelsgenomgång', () => {
  test('läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken', () => {
    const db = sandladaKl('13:30');
    const g = vidimering.genomgang(atk(db, 'lak-kard', 'p01', {}, 'ordinera'));
    expect(g.ordinationer.map(o => o.lakemedel.namn).sort()).toEqual(['Alvedon', 'Furosemid Teva', 'Metoprolol Sandoz', 'Waran']);
    expect(g.berattelse.text).toContain('Ändrad dos: Metoprolol Sandoz från 1 tablett på morgonen till 2 tabletter på morgonen. Orsak: Förmaksflimmer, frekvensreglering.');
    expect(g.berattelse.text).toContain('Ändrad dos: Furosemid Teva');
    expect(g.berattelse.text).toContain('Insatt: Alvedon');
    expect(g.berattelse.text).toContain('Oförändrade: Waran.');
    expect(g.berattelse.text).toContain('Vid behov: Alvedon har getts 1 gång.');
    expect(g.berattelse.period.vardtillfalleId).toBeGreaterThan(0);
    expect(g.demoregler).toBe(true);
    // Patient 10 är 80 år med elva pågående ordinationer. Zopiklon som sattes in för två månader sedan har en passerad uppföljning.
    lakemedel.spara(atk(db, 'lak-vc', 'p10'), { lakemedelId: 'VK-NPL-0044', dosering: '1 tablett till natten vid behov', typ: 'vid_behov', vidBehov: true, ordinationsorsak: 'Sömnsvårigheter', start: addDagar(idag(), -60), uppfoljningsdatum: addDagar(idag(), -30) });
    const g10 = vidimering.genomgang(atk(db, 'lak-vc', 'p10', {}, 'ordinera'));
    const typer = g10.fynd.map(f => f.typ);
    expect(typer).toEqual(expect.arrayContaining(['aldre', 'uppfoljning', 'polyfarmaci']));
    expect(g10.fynd.find(f => f.typ === 'aldre').text).toContain('Zopiklon');
    // Genomgången sparas av läkaren, inte av sjuksköterskan.
    const s = vidimering.sparaGenomgang(atk(db, 'lak-kard', 'p01', {}, 'ordinera'), { bedomning: 'Fortsatt behandling, följ upp kalium.' });
    expect(s.genomgangar[0]).toMatchObject({ av: 'Sara Lindqvist', bedomning: 'Fortsatt behandling, följ upp kalium.' });
    expect(s.genomgangar[0].berattelse).toContain('Läkemedelsberättelse för vårdtillfället');
    expect(fel(() => vidimering.sparaGenomgang(atk(db, 'ssk-kard', 'p01', {}, 'ordinera'), {})).status).toBe(403);
  });
});

describe('Vätskebalans', () => {
  test('vätskebalansen räknar in administrerad volym av sig själv', () => {
    const db = sandladaKl('13:30');
    const lak = atk(db, 'lak-kard', 'p01', {}, 'ordinera');
    const ord = lakemedel.spara(lak, { lakemedelId: 'VK-NPL-0032', dosering: '3 g intravenöst', dos: 3, dosEnhet: 'g', tider: ['14'], typ: 'tillfallig', ordinationsorsak: 'Erysipelas', uppfoljningsdatum: addDagar(idag(), 3), kvitteradeVarningar: [{ regel: 'overkanslighet', motivering: 'Tolererat penicillin intravenöst tidigare' }] });
    mallar.sparaTillagg(db, ord.ordination.id, mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0032', volymMl: 100 }));
    const morf = lakemedel.spara(lak, { lakemedelId: 'VK-NPL-0031', dosering: '5 mg intravenöst vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, ordinationsorsak: 'Smärta', uppfoljningsdatum: addDagar(idag(), 3) });
    mallar.sparaTillagg(db, morf.ordination.id, mallar.valideraTillagg(db, { lakemedelId: 'VK-NPL-0031' }));
    const ssk = atk(db, 'ssk-kard', 'p01', {}, 'ge_lakemedel');
    expect(administrering.spara(ssk, { ordinationId: ord.ordination.id, planerad: kl('14:00') }).administrering.volymMl).toBe(100);
    // Morfin 10 mg/ml: 5 mg blir 0,5 ml.
    expect(administrering.spara(ssk, { ordinationId: morf.ordination.id }).administrering.volymMl).toBe(0.5);
    administrering.registreraVatska(atk(db, 'ssk-kard', 'p01', {}, 'registrera_matvarde'), { riktning: 'ut', typ: 'urin', volymMl: 300 });
    administrering.registreraVatska(atk(db, 'usk-kard', 'p01', {}, 'registrera_matvarde'), { riktning: 'in', typ: 'dryck', volymMl: 250 });
    const vb = administrering.vatskebalans(atk(db, 'usk-kard', 'p01', {}, 'las_matvarden'));
    expect(vb).toMatchObject({ summaIn: 350.5, summaUt: 300, balans: 50.5, brytning: '00:00' });
    expect(vb.poster.filter(p => p.automatisk).map(p => p.volymMl).sort()).toEqual([0.5, 100]);
    // Dygnsbrytning kl 14: allt registrerat kl 13.30 hör till dygnet som började i går kl 14.
    expect(administrering.vatskebalans(atk(db, 'usk-kard', 'p01', {}, 'las_matvarden'), { dag: addDagar(idag(), -1), brytning: '14' }).poster.length).toBe(4);
    expect(administrering.vatskebalans(atk(db, 'usk-kard', 'p01', {}, 'las_matvarden'), { dag: idag(), brytning: '14' }).poster.length).toBe(0);
    expect(fel(() => administrering.registreraVatska(atk(db, 'ssk-kard', 'p01', {}, 'registrera_matvarde'), { riktning: 'in', typ: 'lakemedel', volymMl: 100 })).status).toBe(400);
    expect(fel(() => administrering.vatskebalans(atk(db, 'adm-kard', 'p01', {}, 'las_matvarden'))).status).toBe(403);
    expect(() => db.query('DELETE FROM vatskebalans').run()).toThrow(/raderas inte/);
  });
});
