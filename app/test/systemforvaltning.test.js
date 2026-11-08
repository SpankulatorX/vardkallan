// Systemförvaltningen (runda 7, r4, Sussa 12.1 och KD1.1.3.3 till KD1.1.3.6): konfiguration av regler och parametrar
// med fyra ögon, omorganisation enligt HSA:s regler (bilaga K6), undantag från visning och publicering, och lagring med
// uttag per huvudman och provåterläsning av säkerhetskopian. Tiderna skickas in som fasta värden (nu), och testerna
// räknar bara de rader de själva har skapat.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSeed, datumAv, addDagar, lokalTid } from '../src/db.js';
import { prova, harVardrelation, kanRoll } from '../src/atkomst.js';
import * as konfiguration from '../src/konfiguration.js';
import * as undantag from '../src/undantag.js';
import * as omorganisation from '../src/omorganisation.js';
import * as lagring from '../src/lagring.js';
import * as journal from '../src/journal.js';
import * as remiss from '../src/remiss.js';
import * as tidbok from '../src/tidbok.js';
import * as delegering from '../src/delegering.js';
import * as logguppfoljning from '../src/logguppfoljning.js';
import * as arkiv from '../src/arkiv.js';
import * as halsoarende from '../src/halsoarende.js';
import { FONSTER_FORE_MIN, FONSTER_EFTER_MIN, administreringsvarningar } from '../src/lakemedelsregler.js';
import { verifiera } from '../src/logg.js';
import * as sakerhetslogg from '../src/sakerhetslogg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const DAG = 86400_000;
const imorgon = (nu) => addDagar(datumAv(nu), 1);
// Patientuppgifter som aldrig får finnas i systemförvaltningens svar: id, namn och personnummer för varje patient.
const utanPatientuppgifter = (db, svar) => {
  const text = JSON.stringify(svar);
  for (const p of db.query('SELECT id, fornamn, efternamn, personnummer FROM patienter').all()) {
    expect(text.includes(`${p.fornamn} ${p.efternamn}`)).toBe(false);
    expect(text.includes(p.personnummer)).toBe(false);
    expect(new RegExp(`(^|[^a-z0-9-])${p.id}([^a-z0-9-]|$)`).test(text)).toBe(false);
  }
};
const sysf = (db) => personal(db, 'sysf');
const sysf2 = (db) => personal(db, 'sysf-2');
// En ändring föreslås av den ena systemförvaltaren och godkänns av den andra, så att den gäller från dagen.
const andra = (db, nyckel, varde, nu, giltigFran = datumAv(nu)) => {
  const { andring } = konfiguration.foresla(db, sysf(db), { nyckel, varde, giltigFran, motivering: 'Prov.' }, nu);
  konfiguration.godkann(db, sysf2(db), andring.id, {}, nu);
  return andring.id;
};

describe('Systemförvaltning', () => {
  test(`roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista`, async () => {
    const k = klient(app);
    await k.logga('sysf');
    const s = (await k.get('/api/session')).data;
    expect(s.personal).toMatchObject({ namn: 'Tomas Lindh', yrke: 'systemforvaltare', yrkeText: 'Systemförvaltare' });
    expect(s.behorigheter).toEqual(['konfigurera', 'omorganisera', 'undanta', 'lagring']);
    expect((await k.get('/api/patient/p01')).status).toBe(403);
    expect((await k.get('/api/arbetslista')).data).toEqual([]);
    // Den andra systemförvaltaren finns för fyra ögon men är ingen demoroll.
    expect((await k.get('/api/demo/personal')).data.filter(p => p.yrke === 'systemforvaltare').map(p => p.id)).toEqual(['sysf']);
    // Andra roller får inte systemförvaltningens API.
    const l = klient(app);
    await l.logga('lak-kard');
    for (const v of ['/api/konfiguration', '/api/omorganisation', '/api/undantag', '/api/lagring']) expect((await l.get(v)).status).toBe(403);
    expect((await l.post('/api/konfiguration', { nyckel: 'logg.stickprov_antal', varde: 20, motivering: 'x' })).status).toBe(403);
  });
});

describe('Systemförvaltning', () => {
  test(`konfiguration: varje parameter har samma standardvärde som modulen som använder den`, () => {
    const p = konfiguration.parametrar();
    expect(p['remiss.mottagningskvittens_timmar'].standard).toBe(remiss.LARMGRANS.mottagningskvittensTimmar);
    expect(p['remiss.svarskvittens_dagar'].standard).toBe(remiss.LARMGRANS.svarKvittensDagar);
    expect(p['lakemedel.dosfonster_fore_min'].standard).toBe(FONSTER_FORE_MIN);
    expect(p['lakemedel.dosfonster_efter_min'].standard).toBe(FONSTER_EFTER_MIN);
    expect(p['lakemedel.delegering_paminn_dagar'].standard).toBe(delegering.PAMINN_DAGAR);
    expect(p['tidbok.paminnelse_timmar'].standard).toBe(tidbok.DEMOREGLER.paminnelseTimmar);
    expect(p['logg.stickprov_antal'].standard).toBe(logguppfoljning.STICKPROV_ANTAL);
    expect(p['arkiv.gallring_ar'].standard).toBe(arkiv.GALLRING_AR);
    expect(p['halsoarende.avsluta_dagar'].standard).toBe(halsoarende.DEMOREGEL_AVSLUTA_DAGAR);
    for (const m of journal.MALLAR) expect(p[`journal.sokord.${m.typ}`].standard).toEqual(m.sokord);
    // Varje parameter hör till ett av områdena i Sussa 12.1.1.6 till 12.1.1.9 och har en beskrivning.
    for (const d of Object.values(p)) { expect(Object.keys(konfiguration.OMRADEN)).toContain(d.omrade); expect(d.beskrivning.length).toBeGreaterThan(20); }
    const db = byggSeed();
    for (const k of Object.keys(p)) expect(konfiguration.varde(db, k)).toEqual(p[k].standard);
  });

  test(`konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det`, () => {
    expect(konfiguration.prova('arkiv.gallring_ar', 5)).toMatchObject({ ok: false });
    expect(konfiguration.prova('arkiv.gallring_ar', 5).varfor).toContain('patientdatalagen 3 kap. 17 §');
    expect(konfiguration.prova('remiss.mottagningskvittens_timmar', 0).varfor).toContain('Lägsta värde är 1 timmar');
    expect(konfiguration.prova('remiss.mottagningskvittens_timmar', 72).varfor).toContain('två dygn');
    expect(konfiguration.prova('logg.stickprov_antal', '2,5').varfor).toBe('Skriv ett heltal i åtkomster.');
    expect(konfiguration.prova('logg.stickprov_antal', '20')).toEqual({ ok: true, varde: 20 });
    expect(konfiguration.prova('journal.sokord.Daganteckning', 'Aktuellt, Status, aktuellt').varfor).toContain('finns två gånger');
    expect(konfiguration.prova('journal.sokord.Daganteckning', '').varfor).toContain('minst ett sökord');
    const db = byggSeed();
    const nu = new Date();
    const f = konfiguration.forhandsvisa(db, sysf(db), { nyckel: 'remiss.svarskvittens_dagar', varde: 3 }, nu);
    expect(f).toMatchObject({ ok: false, varfor: 'Värdet är redan 3 dagar.' });
    const e = fel(() => konfiguration.foresla(db, sysf(db), { nyckel: 'arkiv.gallring_ar', varde: 8, motivering: 'Kortare.' }, nu));
    expect(e.status).toBe(400);
    expect(e.message).toContain('minst tio år');
    expect(fel(() => konfiguration.foresla(db, sysf(db), { nyckel: 'arkiv.gallring_ar', varde: 12 }, nu)).message).toContain('Skriv varför ändringen behövs');
  });

  test(`konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet`, () => {
    const db = byggSeed();
    const nu = new Date();
    const { andring } = konfiguration.foresla(db, sysf(db), { nyckel: 'remiss.svarskvittens_dagar', varde: 6, giltigFran: imorgon(nu), motivering: 'Färre larm.' }, nu);
    expect(andring).toMatchObject({ status: 'vantar', egen: true, kanGodkanna: false, forraText: '3 dagar', vardeText: '6 dagar' });
    // Två ändringar av samma parameter kan inte vänta samtidigt: seeden har redan en för mottagningskvittensen.
    expect(fel(() => konfiguration.foresla(db, sysf(db), { nyckel: 'remiss.mottagningskvittens_timmar', varde: 6, motivering: 'x' }, nu)).status).toBe(409);
    const e = fel(() => konfiguration.godkann(db, sysf(db), andring.id, {}, nu));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Fyra ögon');
    // Databasen stoppar också ett godkännande av samma person.
    expect(fel(() => db.query("UPDATE konfig_andringar SET status = 'godkand', beslutad_av = foreslagen_av, galler_fran = giltig_fran WHERE id = ?").run(andring.id))).not.toBeNull();
    konfiguration.godkann(db, sysf2(db), andring.id, {}, nu);
    expect(konfiguration.varde(db, 'remiss.svarskvittens_dagar', nu)).toBe(3);
    expect(konfiguration.varde(db, 'remiss.svarskvittens_dagar', new Date(nu.getTime() + DAG))).toBe(6);
    const o = konfiguration.oversikt(db, sysf(db), nu);
    const p = o.grupper.flatMap(g => g.parametrar).find(x => x.nyckel === 'remiss.svarskvittens_dagar');
    expect(p).toMatchObject({ vardeText: '3 dagar', kommande: { gallerFran: imorgon(nu), vardeText: '6 dagar' } });
  });

  test(`konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen`, () => {
    const db = byggSeed();
    const nu = new Date();
    const igar = addDagar(datumAv(nu), -1);
    expect(fel(() => konfiguration.foresla(db, sysf(db), { nyckel: 'logg.stickprov_antal', varde: 20, giltigFran: igar, motivering: 'x' }, nu)).message).toContain('bakåt i tiden');
    const { andring } = konfiguration.foresla(db, sysf(db), { nyckel: 'logg.stickprov_antal', varde: 20, giltigFran: datumAv(nu), motivering: 'Större urval.' }, nu);
    const senare = new Date(nu.getTime() + 2 * DAG);
    const g = konfiguration.godkann(db, sysf2(db), andring.id, {}, senare).andring;
    expect(g.gallerFran).toBe(datumAv(senare));
    expect(konfiguration.varde(db, 'logg.stickprov_antal', new Date(nu.getTime() + DAG))).toBe(10);
    expect(konfiguration.varde(db, 'logg.stickprov_antal', senare)).toBe(20);
  });

  test(`konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter`, () => {
    const db = byggSeed();
    const nu = new Date();
    for (const [nyckel, varde] of [['remiss.mottagningskvittens_timmar', 1], ['remiss.svarskvittens_dagar', 1], ['lakemedel.delegering_paminn_dagar', 60], ['tidbok.paminnelse_timmar', 120], ['halsoarende.avsluta_dagar', 30], ['journal.sokord.Daganteckning', 'Aktuellt, Status, Bedömning, Åtgärd, Planering']]) {
      const f = konfiguration.forhandsvisa(db, sysf(db), { nyckel, varde }, nu);
      expect(f.ok).toBe(true);
      expect(f.effekt.length).toBeGreaterThan(1);
      utanPatientuppgifter(db, f);
    }
    const s = konfiguration.forhandsvisa(db, sysf(db), { nyckel: 'journal.sokord.Daganteckning', varde: 'Aktuellt, Status, Bedömning, Åtgärd, Planering' }, nu);
    expect(s.effekt).toContain('Nya sökord: Planering.');
    expect(s.effekt).toContain('Anteckningar som redan är skrivna ändras inte. De visar sina sökord som när de skrevs.');
    utanPatientuppgifter(db, konfiguration.oversikt(db, sysf(db), nu));
  });

  test(`konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade`, () => {
    const db = byggSeed();
    const nu = new Date();
    const fore = db.query("SELECT id, sokord FROM anteckningar WHERE typ = 'Daganteckning'").all();
    andra(db, 'journal.sokord.Daganteckning', ['Aktuellt', 'Status', 'Bedömning', 'Åtgärd', 'Planering'], nu);
    expect(konfiguration.mallar(db, nu).find(m => m.typ === 'Daganteckning').sokord).toEqual(['Aktuellt', 'Status', 'Bedömning', 'Åtgärd', 'Planering']);
    expect(konfiguration.mallar(db, nu).find(m => m.typ === 'Epikris').sokord).toEqual(journal.MALLAR.find(m => m.typ === 'Epikris').sokord);
    expect(db.query("SELECT id, sokord FROM anteckningar WHERE typ = 'Daganteckning'").all()).toEqual(fore);
  });

  test(`konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet`, () => {
    const db = byggSeed();
    const nu = new Date();
    // Remissen skickades för tre timmar sedan och är inte kvitterad: larm med två timmar, inte med fyra.
    const r = { status: 'skickad', skickad_tid: new Date(nu.getTime() - 3 * 3600_000).toISOString(), svar_senast: addDagar(datumAv(nu), 10) };
    expect(remiss.larmFor(r, nu, remiss.larmgranser(db, nu)).map(l => l.typ)).toEqual(['saknar_mottagningskvittens']);
    // Den andra systemförvaltarens förslag i seeden (fyra timmar) godkänns.
    konfiguration.godkann(db, sysf(db), db.query("SELECT id FROM konfig_andringar WHERE nyckel = 'remiss.mottagningskvittens_timmar' AND status = 'vantar'").get().id, {}, nu);
    expect(remiss.larmFor(r, nu, remiss.larmgranser(db, nu))).toEqual([]);
    andra(db, 'remiss.svarskvittens_dagar', 1, nu);
    const b = { status: 'besvarad', besvarad_tid: new Date(nu.getTime() - 2 * DAG).toISOString(), svar_senast: addDagar(datumAv(nu), 10) };
    expect(remiss.larmFor(b, nu, remiss.larmgranser(db, nu))[0].text).toBe('Remissvaret har inte kvitterats av avsändaren efter 1 dag.');
    // Dosfönstret: en dos 45 minuter före dostiden är för tidig med 30 minuter.
    const planerad = new Date(nu.getTime() + 45 * 60_000).toISOString();
    const varn = (fonsterForeMin) => administreringsvarningar({ ordination: { id: 1, dosering: '1 tablett', dos: 1, dos_enhet: 'st' }, aktivVid: { aktiv: true }, lakemedel: { namn: 'Prov', substans: 'prov' }, planerad, tid: nu.getTime(), nu: nu.getTime(), fonsterForeMin }).map(v => v.regel);
    expect(varn(konfiguration.varde(db, 'lakemedel.dosfonster_fore_min', nu))).not.toContain('for_tidig');
    andra(db, 'lakemedel.dosfonster_fore_min', 30, nu);
    expect(varn(konfiguration.varde(db, 'lakemedel.dosfonster_fore_min', nu))).toContain('for_tidig');
    // Stickprovet drar det antal som gäller.
    andra(db, 'logg.stickprov_antal', 5, nu);
    expect(logguppfoljning.oversikt(db, { nu }).antal).toBe(5);
    const sp = logguppfoljning.dra(db, personal(db, 'logg'), { nu });
    expect(sp.rader.length).toBeLessThanOrEqual(5);
    // Gallringsförslaget räknar med de år som gäller.
    andra(db, 'arkiv.gallring_ar', 12, nu);
    expect(konfiguration.varde(db, 'arkiv.gallring_ar', nu)).toBe(12);
    // Påminnelsen före en tid och delegeringen läser värdet utan att någon modul behöver ändras.
    andra(db, 'tidbok.paminnelse_timmar', 24, nu);
    expect(konfiguration.varde(db, 'tidbok.paminnelse_timmar', nu)).toBe(24);
    andra(db, 'halsoarende.avsluta_dagar', 30, nu);
    expect(konfiguration.varde(db, 'halsoarende.avsluta_dagar', nu)).toBe(30);
  });

  test(`konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas`, () => {
    const db = byggSeed();
    const nu = new Date();
    const id = andra(db, 'remiss.svarskvittens_dagar', 5, nu);
    const o = konfiguration.oversikt(db, sysf(db), nu);
    expect(o.historik[0]).toMatchObject({ id, status: 'godkand', foreslagenAv: 'Tomas Lindh', beslutadAv: 'Nora Ekholm', forraText: '3 dagar', vardeText: '5 dagar', motivering: 'Prov.' });
    // Den seedade ändringen väntar på att Tomas Lindh godkänner den.
    expect(o.attGodkanna.map(a => a.foreslagenAv)).toEqual(['Nora Ekholm']);
    expect(o.lasta.map(l => l.rubrik)).toContain('Åtkomstloggen och säkerhetsloggen');
    expect(fel(() => db.query('UPDATE konfig_andringar SET varde = ? WHERE id = ?').run('9', id))).not.toBeNull();
    expect(fel(() => db.query('DELETE FROM konfig_andringar WHERE id = ?').run(id))).not.toBeNull();
    // Avslag kräver en kommentar, återkallelse görs av den som föreslog.
    const { andring } = konfiguration.foresla(db, sysf(db), { nyckel: 'logg.stickprov_antal', varde: 15, motivering: 'Prov.' }, nu);
    expect(fel(() => konfiguration.avsluta(db, sysf2(db), andring.id, {}, nu)).message).toContain('Skriv varför');
    expect(konfiguration.avsluta(db, sysf(db), andring.id, {}, nu).andring.status).toBe('aterkallad');
    expect(sakerhetslogg.lista(db, { typ: 'andrad_installning' })[0].beskrivning).toContain('remiss.svarskvittens_dagar');
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE handling = 'konfigurera' AND patient_id IS NULL").get().n).toBe(4);
    expect(verifiera(db).hel).toBe(true);
  });

  test(`konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med`, async () => {
    const k = klient(app);
    await k.logga('sysf');
    const o = (await k.get('/api/konfiguration')).data;
    const v = o.attGodkanna[0];
    expect(v).toMatchObject({ rubrik: 'Larm när mottagningskvittensen dröjer', vardeText: '4 timmar', foreslagenAv: 'Nora Ekholm' });
    expect((await k.post(`/api/konfiguration/${v.id}/godkann`, {})).data.andring.status).toBe('godkand');
    const f = await k.post('/api/konfiguration/forhandsvisa', { nyckel: 'arkiv.gallring_ar', varde: 7 });
    expect(f.data).toMatchObject({ ok: false });
    expect((await k.post('/api/konfiguration', { nyckel: 'journal.sokord.Epikris', varde: 'Orsak till vård, Förlopp, Läkemedelsförändringar, Uppföljning, Kontakt', motivering: 'Kontaktuppgifter efter utskrivning.' })).status).toBe(201);
    expect((await k.get('/api/mallar')).data.find(m => m.typ === 'Epikris').sokord).not.toContain('Kontakt');
    utanPatientuppgifter(sandlada(app, k).db, o);
  });
});

// En omorganisation som ändrar vem som har åtkomst förbereds av den ena systemförvaltaren och godkänns av den andra.
const forberedOchGodkann = (db, inp, nu) => {
  const { omorganisation: f } = omorganisation.forbered(db, sysf(db), inp, nu);
  return omorganisation.godkann(db, sysf2(db), f.id, nu).omorganisation;
};
// En spärr och en anteckning för en patient på en vårdenhet, inlagda direkt för provet.
const sparrMedAnteckning = (db, patient, enhet) => {
  db.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, ?, '2026-01-01')").run(patient, enhet);
  db.query("INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av) VALUES (?, ?, 'Mottagningsanteckning', 'lakare', '[]', 'lak-med', '2026-01-01T10:00:00Z', 'signerad', '2026-01-01T10:05:00Z', 'lak-med')").run(patient, enhet);
};
const samtycke = { samtycke_sparr: { syfte: 'Prov' } };
const lasa = (db, pers, patient, enhet, val = {}) => prova(db, { personal: personal(db, pers), patient, handling: 'las_journal', resurs: { enhet_id: enhet }, val });

describe('Systemförvaltning', () => {
  test(`omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet`, () => {
    const db = byggSeed();
    const nu = new Date();
    const plan = { typ: 'namnbyte', datum: imorgon(nu), plan: { enhet: 'uso-kard-72', namn: 'Avdelning 72, hjärtsjukvård' } };
    const f = omorganisation.forhandsvisa(db, sysf(db), plan, nu);
    expect(f.beskrivning).toBe('Avdelning 72, kardiologi byter namn till Avdelning 72, hjärtsjukvård');
    expect(f.paverkas.find(p => p.id === 'historik').atgard).toContain('Avdelning 72, kardiologi');
    utanPatientuppgifter(db, f);
    const { omorganisation: o } = omorganisation.forbered(db, sysf(db), plan, nu);
    expect(o).toMatchObject({ status: 'forberedd', dagarKvar: 1 });
    const hsa = db.query("SELECT hsa_id FROM enheter WHERE id = 'uso-kard-72'").get().hsa_id;
    expect(db.query("SELECT namn FROM enheter WHERE id = 'uso-kard-72'").get().namn).toBe('Avdelning 72, kardiologi');
    omorganisation.genomforForfallna(db, new Date(nu.getTime() + DAG));
    expect(db.query("SELECT namn, hsa_id FROM enheter WHERE id = 'uso-kard-72'").get()).toEqual({ namn: 'Avdelning 72, hjärtsjukvård', hsa_id: hsa });
    const gammal = db.query("SELECT * FROM anteckningar WHERE enhet_id = 'uso-kard-72' ORDER BY skapad LIMIT 1").get();
    expect(journal.anteckningUt(db, gammal).enhet.namn).toBe('Avdelning 72, kardiologi');
    expect(journal.anteckningUt(db, { ...gammal, skapad: new Date(nu.getTime() + 2 * DAG).toISOString() }).enhet.namn).toBe('Avdelning 72, hjärtsjukvård');
    expect(omorganisation.oversikt(db, sysf(db), nu).forandringar[0]).toMatchObject({ status: 'genomford', resultat: [{ id: 'namnbyte', antal: 1 }] });
  });

  test(`omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut`, () => {
    const db = byggSeed();
    const nu = new Date();
    const sparrar = db.query('SELECT * FROM sparrar').all();
    // Ett namnbyte ändrar inte vem som har åtkomst och genomförs utan godkännande.
    omorganisation.forbered(db, sysf(db), { typ: 'namnbyte', datum: datumAv(nu), plan: { enhet: 'uso-psyk', namn: 'Psykiatriska kliniken USÖ' } }, nu);
    expect(db.query("SELECT namn FROM enheter WHERE id = 'uso-psyk'").get().namn).toBe('Psykiatriska kliniken USÖ');
    expect(db.query('SELECT * FROM sparrar').all()).toEqual(sparrar);
    expect(lasa(db, 'lak-psyk', 'p04', 'uso-psyk')).toMatchObject({ tillaten: true, grund: 'egen_enhet' });
    expect(lasa(db, 'lak-kard', 'p04', 'uso-psyk')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
  });

  test(`omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter`, () => {
    const db = byggSeed();
    const nu = new Date();
    const f = omorganisation.forhandsvisa(db, sysf(db), { typ: 'sammanslagning', datum: imorgon(nu), plan: { gamla: ['uso-kard', 'uso-med'], namn: 'Hjärt- och medicinkliniken USÖ' } }, nu);
    const per = Object.fromEntries(f.paverkas.map(p => [p.id, p]));
    expect(per.pagaende.antal).toBe(4);
    expect(per.vantelista.antal).toBe(5);
    expect(per.personal.antal).toBe(db.query("SELECT count(*) AS n FROM personal WHERE aktiv = 1 AND enhet_id IN ('uso-kard', 'uso-kard-72', 'uso-kard-mott', 'uso-kard-hia', 'uso-med', 'uso-kard-lab')").get().n);
    expect(per.vardrelationer.antal).toBeGreaterThan(0);
    expect(per.historik.atgard).toContain('kodas inte om');
    expect(per.sparrar.atgard).toContain('HSA 2.4');
    expect(f.nya.map(n => n.namn)).toEqual(['Hjärt- och medicinkliniken USÖ', 'Avdelning 72, kardiologi', 'Kardiologiska mottagningen', 'Hjärtintensivvårdsavdelningen (HIA)']);
    expect(f.stangs).toContain('Kardiologiska kliniken USÖ');
    expect(f.manuellt.length).toBeGreaterThan(0);
    utanPatientuppgifter(db, f);
    // Förhandsvisningen ändrar ingenting.
    expect(db.query("SELECT count(*) AS n FROM omorganisationer").get().n).toBe(0);
  });

  test(`omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten`, () => {
    const db = byggSeed();
    const nu = new Date();
    const fore = {
      anteckningar: db.query("SELECT id, enhet_id FROM anteckningar ORDER BY id").all(),
      pagaende: db.query("SELECT id, patient_id, enhet_id, vardtillfalle_id FROM vardkontakter WHERE enhet_id IN ('uso-kard-72', 'uso-kard-hia') AND slut IS NULL AND coalesce(planerad, 0) = 0 AND coalesce(automatisk, 0) = 0").all(),
      vantelista: db.query("SELECT id FROM vantelista WHERE enhet_id = 'uso-kard' AND status = 'vantar'").all().map(r => r.id),
      logg: db.query('SELECT count(*) AS n FROM atkomstlogg').get().n,
    };
    const o = forberedOchGodkann(db, { typ: 'sammanslagning', datum: datumAv(nu), plan: { gamla: ['uso-kard', 'uso-med'], namn: 'Hjärt- och medicinkliniken USÖ' } }, nu);
    expect(o.status).toBe('genomford');
    const ny = db.query("SELECT * FROM enheter WHERE namn = 'Hjärt- och medicinkliniken USÖ'").get();
    expect(ny).toMatchObject({ typ: 'vardenhet', forald_id: 'uso' });
    expect(ny.hsa_id).toMatch(/^SE2321000164-VK\d{4}$/);
    expect(db.query('SELECT count(*) AS n FROM enheter WHERE hsa_id = ?').get(ny.hsa_id).n).toBe(1);
    const ap72 = db.query("SELECT id FROM enheter WHERE forald_id = ? AND namn = 'Avdelning 72, kardiologi'").get(ny.id).id;
    // Personalen: läkaren till den nya vårdenheten, sjuksköterskan till den nya avdelningen.
    expect(personal(db, 'lak-kard').enhet_id).toBe(ny.id);
    expect(personal(db, 'ssk-kard').enhet_id).toBe(ap72);
    // Pågående vårdkontakter avslutas och fortsätter i samma vårdtillfälle.
    expect(fore.pagaende.length).toBe(4);
    for (const v of fore.pagaende) {
      const slut = db.query('SELECT slut FROM vardkontakter WHERE id = ?').get(v.id).slut;
      expect(slut >= lokalTid(datumAv(nu), '00:00')).toBe(true);
      const f = db.query('SELECT * FROM vardkontakter WHERE foregaende_id = ?').get(v.id);
      expect(f).toMatchObject({ patient_id: v.patient_id, vardtillfalle_id: v.vardtillfalle_id, slut: null, start: slut });
      expect(f.enhet_id).not.toBe(v.enhet_id);
      if (v.vardtillfalle_id) expect(db.query('SELECT enhet_id FROM vardtillfallen WHERE id = ?').get(v.vardtillfalle_id).enhet_id).toBe(ny.id);
    }
    expect(db.query(`SELECT count(*) AS n FROM vantelista WHERE id IN (${fore.vantelista.join(',')}) AND enhet_id = ?`).get(ny.id).n).toBe(fore.vantelista.length);
    expect(db.query("SELECT count(*) AS n FROM remisser WHERE till_enhet_id IN ('uso-kard', 'uso-med') AND status <> 'svar_kvitterat' AND NOT (status = 'bedomd' AND beslut IN ('avvisad', 'vidarebefordrad'))").get().n).toBe(0);
    // Inget som har hänt skrivs om: anteckningarna har kvar sina enheter, och loggen är hel.
    expect(db.query('SELECT id, enhet_id FROM anteckningar WHERE id <= ? ORDER BY id').all(fore.anteckningar.at(-1).id)).toEqual(fore.anteckningar);
    expect(verifiera(db).hel).toBe(true);
    // De gamla enheterna är stängda och arkiverade men finns kvar.
    for (const g of ['uso-kard', 'uso-med', 'uso-kard-72']) {
      expect(omorganisation.arStangd(db, g, datumAv(nu))).toBe(true);
      expect(db.query('SELECT 1 FROM enheter WHERE id = ?').get(g)).not.toBeNull();
    }
    // Varje flytt finns kvar med värdet före och efter.
    const flyttar = db.query('SELECT kategori, count(*) AS n FROM omorganisation_flyttar WHERE omorganisation_id = ? GROUP BY kategori').all(o.id);
    expect(Object.fromEntries(flyttar.map(f => [f.kategori, f.n]))).toMatchObject({ pagaende: expect.any(Number), vantelista: fore.vantelista.length, personal: expect.any(Number) });
    expect(fel(() => db.query('DELETE FROM omorganisation_flyttar').run())).not.toBeNull();
    utanPatientuppgifter(db, o);
  });

  test(`omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val`, () => {
    const db = byggSeed();
    const nu = new Date();
    const sparrar = db.query('SELECT * FROM sparrar').all();
    forberedOchGodkann(db, { typ: 'sammanslagning', datum: datumAv(nu), plan: { gamla: ['uso-psyk', 'uso-inf'], namn: 'Psykiatri- och infektionskliniken USÖ' } }, nu);
    const ny = db.query("SELECT id FROM enheter WHERE namn = 'Psykiatri- och infektionskliniken USÖ'").get().id;
    expect(personal(db, 'lak-psyk').enhet_id).toBe(ny);
    // Spärren ändras inte och sätts inte på den nya vårdenheten: det är patientens beslut.
    expect(db.query('SELECT * FROM sparrar').all()).toEqual(sparrar);
    // Vårdrelationen följer med, men psykiatrins spärrade uppgifter kräver samtycke också för den som nu sitter på den nya enheten.
    expect(harVardrelation(db, 'p04', ny, nu)).toBe(true);
    expect(lasa(db, 'lak-psyk', 'p04', 'uso-psyk')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
    expect(lasa(db, 'lak-psyk', 'p04', 'uso-psyk', samtycke)).toMatchObject({ tillaten: true, grund: 'samtycke_sparr' });
    expect(lasa(db, 'lak-kard', 'p04', 'uso-psyk')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
    // Utan spärr är den gamla vårdenhetens uppgifter en annan vårdenhets: de kräver ett aktivt val, som förut.
    expect(lasa(db, 'lak-psyk', 'p15', 'uso-psyk')).toMatchObject({ tillaten: false, krav: 'kraver_val' });
    expect(lasa(db, 'lak-psyk', 'p15', 'uso-psyk', { andra_enheter: { syfte: 'Prov' } })).toMatchObject({ tillaten: true, grund: 'aktivt_val' });
    expect(lasa(db, 'lak-psyk', 'p04', ny)).toMatchObject({ tillaten: true, grund: 'egen_enhet' });
  });

  test(`omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser`, () => {
    const db = byggSeed();
    const nu = new Date();
    expect(omorganisation.foreslaMottagare(db, 'vc-kumla')).toBe('vc-tybble');
    const listade = db.query("SELECT patient_id FROM listningar WHERE enhet_id = 'vc-kumla'").all().map(r => r.patient_id);
    const f = omorganisation.forhandsvisa(db, sysf(db), { typ: 'nedlaggning', datum: datumAv(nu), plan: { enhet: 'vc-kumla' } }, nu);
    expect(f.plan.mottagare).toBe('vc-tybble');
    expect(f.paverkas.find(p => p.id === 'sparrar').atgard).toContain('behöver tillfrågas');
    const listad = listade[0];
    sparrMedAnteckning(db, listad, 'vc-kumla');
    const sparrar = db.query('SELECT * FROM sparrar').all();
    forberedOchGodkann(db, { typ: 'nedlaggning', datum: datumAv(nu), plan: { enhet: 'vc-kumla' } }, nu);
    expect(personal(db, 'lak-kumla').enhet_id).toBe('vc-tybble');
    // Spärren mot den nedlagda vårdenheten gäller som förut, också för personalen på den mottagande vårdenheten.
    expect(db.query('SELECT * FROM sparrar').all()).toEqual(sparrar);
    expect(lasa(db, 'lak-kumla', listad, 'vc-kumla')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
    expect(lasa(db, 'lak-vc', listad, 'vc-kumla')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
    expect(lasa(db, 'lak-kumla', listad, 'vc-kumla', samtycke)).toMatchObject({ tillaten: true, grund: 'samtycke_sparr' });
    for (const p of listade) expect(db.query("SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id = 'vc-tybble'").get(p)).not.toBeNull();
    expect(db.query("SELECT count(*) AS n FROM listningar WHERE enhet_id = 'vc-kumla'").get().n).toBe(listade.length);
    const e = fel(() => remiss.skapa(atk(db, 'lak-kard', 'p01'), { tillEnhetId: 'vc-kumla', fragestallning: 'Uppföljning i primärvården.', prioritet: 'normal', svarSenast: addDagar(datumAv(nu), 14) }));
    expect(e.message).toBe('Vårdcentralen Kumla är stängd sedan en omorganisation. Verksamheten finns nu på Vårdcentralen Tybble.');
  });

  test(`omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt`, () => {
    const db = byggSeed();
    const nu = new Date();
    const dagStart = lokalTid(imorgon(nu), '00:00');
    const tiderFram = db.query("SELECT count(*) AS n FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = 'uso-kard-mott' AND t.start >= ?").get(dagStart).n;
    const tiderFore = db.query("SELECT count(*) AS n FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = 'uso-kard-mott' AND t.start < ?").get(dagStart).n;
    sparrMedAnteckning(db, 'p01', 'uso-kard');
    const { omorganisation: f } = omorganisation.forbered(db, sysf(db), { typ: 'delning', datum: imorgon(nu), plan: { gammal: 'uso-kard', nya: [
      { namn: 'Kardiologiska kliniken, slutenvård', arbetsplatser: ['uso-kard-72', 'uso-kard-hia'] },
      { namn: 'Kardiologiska kliniken, mottagning', arbetsplatser: ['uso-kard-mott'] },
    ] } }, nu);
    omorganisation.godkann(db, sysf2(db), f.id, nu);
    // Systemet genomför förändringen vid dagens början.
    omorganisation.genomforForfallna(db, new Date(dagStart));
    const c1 = db.query("SELECT id FROM enheter WHERE namn = 'Kardiologiska kliniken, slutenvård'").get().id;
    const c2 = db.query("SELECT id FROM enheter WHERE namn = 'Kardiologiska kliniken, mottagning'").get().id;
    expect(personal(db, 'lak-kard').enhet_id).toBe(c1);
    const mott = db.query("SELECT id FROM enheter WHERE forald_id = ? AND namn = 'Kardiologiska mottagningen'").get(c2).id;
    expect(personal(db, 'ssk-kardmott').enhet_id).toBe(mott);
    expect(db.query('SELECT ny_id FROM enhet_efterfoljare WHERE gammal_id = ? ORDER BY ny_id').all('uso-kard').map(r => r.ny_id).sort()).toEqual([c1, c2].sort());
    // Tiderna från och med dagen ligger i ett schema på den nya mottagningen, och tidigare tider stannar.
    expect(db.query('SELECT count(*) AS n FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = ? AND t.start >= ?').get(mott, dagStart).n).toBe(tiderFram);
    expect(db.query("SELECT count(*) AS n FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.enhet_id = 'uso-kard-mott'").get().n).toBe(tiderFore);
    // Spärren mot den delade vårdenheten gäller för personalen på båda de nya, utan och med samtycke.
    for (const p of ['lak-kard', 'ssk-kardmott']) expect(lasa(db, p, 'p01', 'uso-kard')).toMatchObject({ tillaten: false, krav: 'kraver_samtycke' });
    expect(lasa(db, 'lak-kard', 'p01', 'uso-kard', samtycke)).toMatchObject({ tillaten: true, grund: 'samtycke_sparr' });
    expect(db.query("SELECT enhet_id FROM sparrar WHERE patient_id = 'p01'").all().map(r => r.enhet_id)).toEqual(['uso-kard']);
  });

  test(`omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den`, () => {
    const db = byggSeed();
    const nu = new Date();
    const { omorganisation: f } = omorganisation.forbered(db, sysf(db), { typ: 'nedlaggning', datum: datumAv(nu), plan: { enhet: 'vc-kumla' } }, nu);
    expect(f).toMatchObject({ status: 'forberedd', kraverGodkannande: true, godkandAv: null });
    omorganisation.genomforForfallna(db, nu);
    expect(personal(db, 'lak-kumla').enhet_id).toBe('vc-kumla');
    const e = fel(() => omorganisation.godkann(db, sysf(db), f.id, nu));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Fyra ögon');
    expect(fel(() => db.query('UPDATE omorganisationer SET godkand_av = forberedd_av WHERE id = ?').run(f.id))).not.toBeNull();
    const g = omorganisation.godkann(db, sysf2(db), f.id, nu).omorganisation;
    expect(g).toMatchObject({ status: 'genomford', godkandAv: 'Nora Ekholm' });
    expect(personal(db, 'lak-kumla').enhet_id).toBe('vc-tybble');
    expect(sakerhetslogg.lista(db, { typ: 'andrad_behorighet' })[0].beskrivning).toContain('godkänt av Nora Ekholm');
  });

  test(`omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring`, () => {
    const db = byggSeed();
    const nu = new Date();
    db.query("INSERT INTO enheter VALUES ('rv', 'DEMO-RV-0000', 'Region Demoland (demo)', NULL, 'vardgivare', NULL)").run();
    db.query("INSERT INTO enheter VALUES ('rv-med', 'DEMO-RV-0001', 'Medicinkliniken Demoland (demo)', NULL, 'vardenhet', 'rv')").run();
    const f = (inp) => fel(() => omorganisation.forhandsvisa(db, sysf(db), inp, nu));
    const n = f({ typ: 'nedlaggning', datum: imorgon(nu), plan: { enhet: 'vc-kumla', mottagare: 'rv-med' } });
    expect(n.status).toBe(400);
    expect(n.message).toContain('en annan vårdgivare');
    expect(f({ typ: 'sammanslagning', datum: imorgon(nu), plan: { gamla: ['uso-med', 'rv-med'], namn: 'Gemensam medicinklinik' } }).message).toContain('en annan vårdgivare');
    expect(f({ typ: 'sammanslagning', datum: imorgon(nu), plan: { gamla: ['uso-med', 'uso-inf'], namn: 'Gemensam klinik', forald: 'rv' } }).message).toContain('en annan vårdgivare');
    expect(omorganisation.foreslaMottagare(db, 'rv-med')).toBeNull();
  });

  test(`omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring`, () => {
    const db = byggSeed();
    const nu = new Date();
    const f = (inp) => fel(() => omorganisation.forhandsvisa(db, sysf(db), inp, nu));
    expect(f({ typ: 'namnbyte', datum: imorgon(nu), plan: { enhet: 'uso-kard', namn: 'Akutmottagningen USÖ' } }).message).toContain('finns redan');
    expect(f({ typ: 'namnbyte', datum: addDagar(datumAv(nu), -1), plan: { enhet: 'uso-kard', namn: 'Hjärtkliniken USÖ' } }).message).toContain('bakåt i tiden');
    expect(f({ typ: 'sammanslagning', datum: imorgon(nu), plan: { gamla: ['uso-kard'], namn: 'Ny klinik USÖ' } }).message).toContain('minst två');
    omorganisation.forbered(db, sysf(db), { typ: 'namnbyte', datum: imorgon(nu), plan: { enhet: 'uso-kard', namn: 'Hjärtkliniken USÖ' } }, nu);
    const k = f({ typ: 'sammanslagning', datum: imorgon(nu), plan: { gamla: ['uso-kard', 'uso-med'], namn: 'Ny klinik USÖ' } });
    expect(k.status).toBe(409);
    expect(k.message).toContain('ingår redan i en förberedd förändring');
    expect(fel(() => omorganisation.forbered(db, personal(db, 'adm-kard'), { typ: 'namnbyte', datum: imorgon(nu), plan: { enhet: 'uso-med', namn: 'Medicin USÖ' } }, nu)).status).toBe(403);
  });

  test(`omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop`, async () => {
    const k = klient(app);
    await k.logga('sysf');
    const o = (await k.get('/api/omorganisation')).data;
    expect(o.organisation[0].namn).toBe('Region Örebro län');
    expect(o.mottagare['vc-kumla']).toBe('vc-tybble');
    const f = await k.post('/api/omorganisation/forhandsvisa', { typ: 'namnbyte', plan: { enhet: 'uso-kard-mott', namn: 'Hjärtmottagningen' } });
    expect(f.data).toMatchObject({ ok: true, datum: o.forvalDatum });
    // Förhandsvisningen svarar med förklaringen i stället för ett fel, så att den kan visas medan man skriver.
    const dubbel = await k.post('/api/omorganisation/forhandsvisa', { typ: 'namnbyte', plan: { enhet: 'uso-kard-mott', namn: 'Akutmottagningen USÖ' } });
    expect(dubbel.status).toBe(200);
    expect(dubbel.data).toMatchObject({ ok: false });
    expect(dubbel.data.varfor).toContain('finns redan');
    const r = await k.post('/api/omorganisation', { typ: 'namnbyte', plan: { enhet: 'uso-kard-mott', namn: 'Hjärtmottagningen' } });
    expect(r.status).toBe(201);
    expect((await k.post(`/api/omorganisation/${r.data.omorganisation.id}/avbryt`)).data.omorganisation.status).toBe('avbruten');
    const db = sandlada(app, k).db;
    // En förberedd förändring som gäller i dag (inlagd direkt, som om dagen har kommit) genomförs vid nästa anrop.
    db.query("INSERT INTO omorganisationer (typ, datum, beskrivning, plan, forberedd_av, forberedd) VALUES ('namnbyte', ?, 'Prov', ?, 'sysf', ?)")
      .run(datumAv(new Date()), JSON.stringify({ enhet: 'uso-kard-hia', namn: 'Hjärtintensiven USÖ' }), new Date().toISOString());
    await k.get('/api/session');
    expect(db.query("SELECT namn FROM enheter WHERE id = 'uso-kard-hia'").get().namn).toBe('Hjärtintensiven USÖ');
    utanPatientuppgifter(db, (await k.get('/api/omorganisation')).data);
    utanPatientuppgifter(db, f.data);
  });
});

describe('Systemförvaltning', () => {
  const undanta = (db, nu, inp) => {
    const { andring } = undantag.foresla(db, sysf(db), { giltigFran: datumAv(nu), motivering: 'Mallen används i ett demoprojekt och ska inte visas.', ...inp }, nu);
    return undantag.godkann(db, sysf2(db), andring.id, {}, nu).andring;
  };

  test(`undantag: en anteckningstyp undantas från visning med fyra ögon, och journalen säger hur många som inte visas och varför`, () => {
    const db = byggSeed();
    const nu = new Date();
    const fore = journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).anteckningar.filter(a => a.typ === 'Daganteckning').length;
    expect(fore).toBeGreaterThan(0);
    const { andring } = undantag.foresla(db, sysf(db), { omfang: 'anteckningstyp', varde: 'Daganteckning', kanaler: ['visning'], giltigFran: datumAv(nu), motivering: 'Prov.' }, nu);
    expect(fel(() => undantag.godkann(db, sysf(db), andring.id, {}, nu)).message).toContain('Fyra ögon');
    // Före godkännandet visas allt.
    expect(journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).dolda.undantagna).toEqual([]);
    undantag.godkann(db, sysf2(db), andring.id, {}, nu);
    const l = journal.listaAnteckningar(atk(db, 'lak-kard', 'p01'));
    expect(l.anteckningar.filter(a => a.typ === 'Daganteckning')).toEqual([]);
    expect(l.dolda.undantagna).toEqual([{ antal: fore, sort: 'anteckning', text: `${fore} ${fore === 1 ? 'anteckning' : 'anteckningar'} av typen Daganteckning visas inte. Systemförvaltningen har undantagit typen från visning från ${datumAv(nu)}: Prov.` }]);
    // Den som öppnar anteckningen direkt får samma förklaring.
    const a = db.query("SELECT * FROM anteckningar WHERE patient_id = 'p01' AND typ = 'Daganteckning' AND status = 'signerad' LIMIT 1").get();
    expect(fel(() => journal.hamtaAnteckning(atk(db, 'lak-kard', 'p01'), a)).message).toContain('undantagit den från visning');
  });

  test(`undantag: undantaget gäller aldrig Min journal`, async () => {
    const k = klient(app);
    await k.post('/api/login/invanare', { invanareId: 'inv-p01' });
    const fore = (await k.get('/api/min/journal/p01/anteckningar')).data;
    const db = sandlada(app, k).db;
    undanta(db, new Date(), { omfang: 'anteckningstyp', varde: 'Daganteckning', kanaler: ['visning', 'fhir', 'nationell'] });
    const efter = (await k.get('/api/min/journal/p01/anteckningar')).data;
    expect(efter).toEqual(fore);
    expect(JSON.stringify(fore)).toContain('Daganteckning');
  });

  test(`undantag: undantaget ändrar inte spärrar, och en spärrad uppgift varken visas eller räknas`, () => {
    const db = byggSeed();
    const nu = new Date();
    const sparrar = db.query('SELECT * FROM sparrar').all();
    const synliga = journal.listaAnteckningar(atk(db, 'lak-kard', 'p04')).anteckningar.filter(a => a.typ === 'Mottagningsanteckning').length;
    undanta(db, nu, { omfang: 'anteckningstyp', varde: 'Mottagningsanteckning', kanaler: ['visning'] });
    const l = journal.listaAnteckningar(atk(db, 'lak-kard', 'p04'));
    // Psykiatrins mottagningsanteckningar är spärrade och räknas inte bland de undantagna.
    expect(l.dolda.sparrade).toBe(true);
    expect(l.dolda.undantagna.reduce((s, u) => s + u.antal, 0)).toBe(synliga);
    expect(JSON.stringify(l)).not.toContain('Allmänpsykiatriska');
    expect(db.query('SELECT * FROM sparrar').all()).toEqual(sparrar);
    // Med patientens samtycke till att spärren hävs prövas undantaget på samma sätt för psykiatrins anteckningar.
    const s = journal.listaAnteckningar(atk(db, 'lak-kard', 'p04', { samtycke_sparr: { syfte: 'Prov' }, andra_enheter: { syfte: 'Prov' } }));
    expect(s.anteckningar.filter(a => a.typ === 'Mottagningsanteckning')).toEqual([]);
  });

  test(`undantag: FHIR för externa tillämpningar får inte undantagna uppgifter`, async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const fore = (await k.get('/fhir/Observation?patient=p01')).data.entry.map(e => e.resource);
    const db = sandlada(app, k).db;
    // Ett mätvärde som läkaren ser genom FHIR i dag.
    const typ = db.query('SELECT typ FROM matvarden WHERE id = ?').get(Number(fore.find(o => /^\d+$/.test(o.id)).id)).typ;
    const crp = db.query("SELECT id FROM matvarden WHERE patient_id = 'p01' AND typ = ?").all(typ).map(r => String(r.id));
    expect(fore.some(o => crp.includes(o.id))).toBe(true);
    undanta(db, new Date(), { omfang: 'matvarde', varde: typ, kanaler: ['fhir'] });
    const efter = (await k.get('/fhir/Observation?patient=p01')).data.entry.map(e => e.resource);
    expect(efter.some(o => crp.includes(o.id))).toBe(false);
    expect(efter.length).toBe(fore.length - fore.filter(o => crp.includes(o.id)).length);
    expect((await k.get(`/fhir/Observation/${crp[0]}`)).status).toBe(404);
    // I systemet visas mätvärdet som förut, eftersom bara FHIR är undantaget.
    expect((await k.get('/api/patient/p01/matvarden')).data.matvarden.some(m => m.typ === typ)).toBe(true);
  });

  test(`undantag: publiceringen till nationella tjänster (simulerad) räknar bort det undantagna`, () => {
    const db = byggSeed();
    const nu = new Date();
    const fore = undantag.publicering(db, nu);
    const epikriser = db.query("SELECT count(*) AS n FROM anteckningar WHERE typ = 'Epikris' AND status = 'signerad'").get().n;
    undanta(db, nu, { omfang: 'anteckningstyp', varde: 'Epikris', kanaler: ['nationell'] });
    const efter = undantag.publicering(db, nu);
    expect(efter[0]).toEqual({ id: 'anteckningar', text: 'Journalanteckningar', antal: fore[0].antal - epikriser, undantagna: epikriser });
    expect(efter[1]).toEqual(fore[1]);
    // Undantaget från nationella tjänster påverkar inte visningen.
    expect(journal.listaAnteckningar(atk(db, 'lak-kard', 'p01')).dolda.undantagna).toEqual([]);
  });

  test(`undantag: systemet stoppar ett undantag som skulle dölja uppgifter i pågående vård och förklarar varför`, () => {
    const db = byggSeed();
    const nu = new Date();
    const p = undantag.forhandsvisa(db, sysf(db), { omfang: 'enhet', varde: 'uso-kard', kanaler: ['visning'] }, nu);
    expect(p.ok).toBe(false);
    expect(p.varfor).toContain('pågående vårdkontakter. Uppgifter som behövs i pågående vård kan inte döljas');
    expect(undantag.forhandsvisa(db, sysf(db), { omfang: 'enhet', varde: 'uso-kard', kanaler: ['fhir', 'nationell'] }, nu).ok).toBe(true);
    expect(undantag.forhandsvisa(db, sysf(db), { omfang: 'lakemedel', varde: 'x', kanaler: ['visning'] }, nu).varfor).toContain('Läkemedel, överkänslighet');
    const e = fel(() => undantag.foresla(db, sysf(db), { omfang: 'enhet', varde: 'uso-kard', kanaler: ['visning'], motivering: 'Prov.' }, nu));
    expect(e.status).toBe(400);
    for (const x of [undantag.forhandsvisa(db, sysf(db), { omfang: 'enhet', varde: 'uso-kard', kanaler: ['fhir'] }, nu), undantag.oversikt(db, sysf(db), nu)]) utanPatientuppgifter(db, x);
    expect(fel(() => undantag.oversikt(db, personal(db, 'lak-kard'), nu)).status).toBe(403);
  });

  test(`undantag: översikten visar tydligt vad som är undantaget, och ett undantag kan avslutas`, () => {
    const db = byggSeed();
    const nu = new Date();
    undanta(db, nu, { omfang: 'matvarde', varde: 'pef', kanaler: ['fhir', 'nationell'] });
    const o = undantag.oversikt(db, sysf(db), nu);
    expect(o.aktiva).toEqual([expect.objectContaining({ omfangText: 'Mätvärde', namn: 'PEF', kanalText: 'fhir för externa tillämpningar, publicering till nationella tjänster (simulerad)', beslutadAv: 'Nora Ekholm' })]);
    expect(o.regler.join(' ')).toContain('gäller aldrig Min journal');
    undanta(db, nu, { omfang: 'matvarde', varde: 'pef', kanaler: [], motivering: 'Studien är avslutad.' });
    expect(undantag.aktiva(db, nu)).toEqual([]);
    expect(undantag.oversikt(db, sysf(db), nu).historik.map(h => h.vardeText)).toEqual(['inget (undantaget avslutas)', 'fhir för externa tillämpningar, publicering till nationella tjänster (simulerad)']);
  });
});

describe('Systemförvaltning', () => {
  // En andra huvudman med en vårdenhet, en egen patient och en vårdkontakt för en patient som båda huvudmännen har.
  const andraHuvudman = (db) => {
    const anvanda = new Set(db.query('SELECT personnummer FROM patienter').all().map(r => r.personnummer));
    const lista = JSON.parse(readFileSync(join(import.meta.dir, '..', 'src', 'seed', 'testpersonnummer.json'), 'utf8'));
    const pnr = (Array.isArray(lista) ? lista : lista.personnummer ?? Object.values(lista).flat()).map(String).find(x => !anvanda.has(x));
    db.query("INSERT INTO enheter VALUES ('rv', 'DEMO-RV-0000', 'Region Demoland (demo)', NULL, 'vardgivare', NULL)").run();
    db.query("INSERT INTO enheter VALUES ('rv-med', 'DEMO-RV-0001', 'Medicinkliniken Demoland (demo)', NULL, 'vardenhet', 'rv')").run();
    db.query("INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd) VALUES ('px1', ?, 'Demo', 'Demoland', 'K', '1890-01-01')").run(pnr);
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, orsak) VALUES ('px1', 'rv-med', 'oppenvard', '2026-01-01T10:00:00Z', 'Prov')").run();
    db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, orsak) VALUES ('p01', 'rv-med', 'oppenvard', '2026-01-02T10:00:00Z', 'Prov')").run();
    db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status) VALUES ('px1', 'rv-med', 'Mottagningsanteckning', 'lakare', '[]', 'lak-med', '2026-01-01T10:00:00Z', 'utkast')`).run();
  };

  test(`lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad`, () => {
    const db = byggSeed();
    const k = lagring.klassa(db);
    expect(Object.entries(k).filter(([, v]) => v.typ === 'oklassad').map(([t]) => t)).toEqual([]);
    expect(k.anteckningar).toMatchObject({ typ: 'enhet', kolumner: ['enhet_id'] });
    expect(k.remisser).toMatchObject({ typ: 'enhet', kolumner: ['fran_enhet_id', 'till_enhet_id'] });
    expect(k.ordination_historik).toEqual({ typ: 'via', kolumn: 'ordination_id', tabell: 'ordinationer' });
    expect(k.identiteter).toMatchObject({ typ: 'patient' });
    expect(lagring.huvudman_lista(db).map(h => h.id).sort()).toEqual(['kommun-demo', 'rol']);
  });

  test(`lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med`, () => {
    const db = byggSeed();
    andraHuvudman(db);
    const rol = lagring.uttag(db, 'rol');
    const rv = lagring.uttag(db, 'rv');
    try {
      expect(rol.db.query("SELECT count(*) AS n FROM vardkontakter WHERE enhet_id = 'rv-med'").get().n).toBe(0);
      expect(rol.db.query("SELECT 1 FROM patienter WHERE id = 'px1'").get()).toBeNull();
      expect(rol.db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get()).not.toBeNull();
      expect(rv.db.query('SELECT id FROM patienter ORDER BY id').all().map(r => r.id)).toEqual(['p01', 'px1']);
      expect(rv.db.query('SELECT DISTINCT enhet_id FROM vardkontakter').all().map(r => r.enhet_id)).toEqual(['rv-med']);
      expect(rv.db.query('SELECT count(*) AS n FROM anteckningar').get().n).toBe(1);
      expect(rv.db.query('SELECT id FROM enheter ORDER BY id').all().map(r => r.id)).toEqual(['rv', 'rv-med']);
      // Region Örebro läns anteckningar för patient 1 finns inte i den andra huvudmannens uttag.
      expect(rv.db.query("SELECT count(*) AS n FROM anteckningar WHERE patient_id = 'p01'").get().n).toBe(0);
      expect(lagring.kontrolleraUttag(db, rol.db, 'rol').ok).toBe(true);
      expect(lagring.kontrolleraUttag(db, rv.db, 'rv').ok).toBe(true);
      // Varje rad med enhet finns i precis ett uttag, eller i båda när den gäller båda (en remiss mellan huvudmännen).
      for (const t of ['anteckningar', 'vardkontakter', 'matvarden', 'ordinationer']) {
        expect(rol.antal[t] + rv.antal[t]).toBe(db.query(`SELECT count(*) AS n FROM ${t} WHERE enhet_id IS NOT NULL AND enhet_id NOT IN ('kommun-demo', 'min-journal')`).get().n);
      }
    } finally { rol.db.close(); rv.db.close(); }
  });

  test(`lagring: uttaget har samma tabeller, index och triggrar som originalet`, () => {
    const db = byggSeed();
    const u = lagring.uttag(db, 'rol');
    try {
      const schema = (d, typ) => d.query("SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name").all(typ).map(r => r.name);
      for (const typ of ['table', 'index', 'trigger']) expect(schema(u.db, typ)).toEqual(schema(db, typ));
      expect(fel(() => u.db.query('DELETE FROM atkomstlogg').run())).not.toBeNull();
      expect(u.db.query('PRAGMA integrity_check').get().integrity_check).toBe('ok');
    } finally { u.db.close(); }
  });

  test(`lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar`, () => {
    const db = byggSeed();
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-lagring-'));
    try {
      const fil = join(dir, 'kopia.sqlite');
      db.exec(`VACUUM INTO '${fil}'`);
      const kopia = new Database(fil);
      try {
        const r = lagring.jamfor(db, kopia);
        expect(r.kontroller.filter(k => !k.ok)).toEqual([]);
        expect(r.ok).toBe(true);
        expect(r.kontroller.map(k => k.id)).toEqual(['tabeller', 'rader', 'triggrar', 'index', 'skydd', 'integritet', 'atkomstlogg', 'sakerhetslogg']);
      } finally { kopia.close(); }
      // Samma med ögonblicksbilden i minnet.
      const m = lagring.aterlas(lagring.sakerhetskopiera(db));
      try { expect(lagring.jamfor(db, m).ok).toBe(true); } finally { m.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test(`lagring: en kopia som skiljer sig från originalet underkänns`, () => {
    const db = byggSeed();
    const m = lagring.aterlas(lagring.sakerhetskopiera(db));
    try {
      m.query("UPDATE installningar SET varde = 'ändrad' WHERE nyckel = 'seed_datum'").run();
      m.exec('DROP TRIGGER konfig_andring_raderas_ej');
      const r = lagring.jamfor(db, m);
      expect(r.ok).toBe(false);
      expect(r.kontroller.filter(k => !k.ok).map(k => k.id)).toEqual(['rader', 'triggrar']);
      expect(r.kontroller.find(k => k.id === 'rader').detalj).toBe('installningar');
    } finally { m.close(); }
  });

  test(`lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter`, async () => {
    const k = klient(app);
    await k.logga('sysf');
    const r = (await k.post('/api/lagring/prov', {})).data;
    expect(r.ok).toBe(true);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    const o = (await k.get('/api/lagring')).data;
    expect(o.matningar[0]).toMatchObject({ godkand: true, av: 'Tomas Lindh' });
    expect(o.oklassade).toEqual([]);
    expect(o.huvudman.find(h => h.id === 'rol')).toMatchObject({ namn: 'Region Örebro län', kontroll: { ok: true } });
    const db = sandlada(app, k).db;
    utanPatientuppgifter(db, o);
    utanPatientuppgifter(db, r);
    expect(fel(() => db.query('DELETE FROM lagringsmatningar').run())).not.toBeNull();
    expect(kanRoll(personal(db, 'lak-kard'), 'lagring')).toBe(false);
  });
});
