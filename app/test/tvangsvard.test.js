import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada } from './hjalp.js';
import { idag, addDagar, lokalTid } from '../src/db.js';
import { lage, sistaDag, provaIntagning } from '../src/tvangsvard-regler.js';

// Psykiatrisk tvångsvård och rättspsykiatrisk vård (Sussa 3.2.3.1 till 3.2.3.4). Fristerna räknas ur LPT och LRV,
// systemet föreslår nästa steg, och uppgifterna har inre sekretess och spärr som psykiatrins övriga information.

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const TIMME = 3600_000;
const DYGN = 24 * TIMME;
let n = 0;
const h = (typ, tid, detalj = {}, av = 'lak-psyk') => ({ id: ++n, typ, tid: new Date(tid).toISOString(), av, detalj });

describe('Tvångsvård', () => {
  test('fristerna räknas ur lagen: intagning inom 24 timmar, vårdintyg högst fyra dagar, ansökan före fyra veckor och vård i högst fyra månader', () => {
    const t0 = Date.parse(lokalTid('2026-03-02', '10:00'));
    const fore = lage([h('ankomst', t0), h('vardintyg', t0 + TIMME, {}, 'lak-akut')], { nu: t0 + 2 * TIMME });
    expect(fore.status).toBe('vantar');
    expect(fore.frister.find(f => f.id === 'intagning')).toMatchObject({ paragraf: '6 b §', senast: new Date(t0 + DYGN).toISOString(), status: 'kommande' });
    expect(fore.frister.find(f => f.id === 'vardintyg')).toMatchObject({ paragraf: '6 b §', senast: new Date(t0 + TIMME + 4 * DYGN).toISOString() });
    expect(lage([h('ankomst', t0), h('vardintyg', t0)], { nu: t0 + 20 * TIMME }).frister.find(f => f.id === 'intagning').status).toBe('snart');
    // Intagen måndag 2 mars: fyra veckor från dagen är till och med söndag 29 mars, och fyra månader till och med 1 juli.
    const efter = lage([h('ankomst', t0), h('vardintyg', t0, {}, 'lak-akut'), h('intagning', t0 + 2 * TIMME)], { nu: t0 + 3 * TIMME });
    expect(efter).toMatchObject({ lag: 'LPT', status: 'sluten', grund: '6 b §' });
    const ans = efter.frister.find(f => f.id === 'ansokan');
    expect(ans).toMatchObject({ paragraf: '7 §', senast: lokalTid('2026-03-29', '23:59') });
    expect(ans.konsekvens).toContain('28 §');
    const med = lage([h('vardintyg', t0), h('intagning', t0), h('ansokan', t0 + 20 * DYGN), h('medgivande', t0 + 25 * DYGN, { form: 'sluten', beslutsdatum: '2026-03-27' })], { nu: t0 + 26 * DYGN });
    expect(med).toMatchObject({ giltigTill: lokalTid('2026-07-01', '23:59'), giltigParagraf: '8 §' });
    // Därefter sex månader åt gången från förvaltningsrättens beslut (9 §).
    const nio = lage([h('vardintyg', t0), h('intagning', t0), h('ansokan', t0 + 20 * DYGN), h('medgivande', t0 + 25 * DYGN, { beslutsdatum: '2026-03-27' }), h('ansokan', t0 + 100 * DYGN), h('medgivande', t0 + 110 * DYGN, { form: 'oppen', beslutsdatum: '2026-06-20' })], { nu: t0 + 111 * DYGN });
    expect(nio).toMatchObject({ status: 'oppen', form: 'oppen', giltigTill: lokalTid('2026-12-19', '23:59'), giltigParagraf: '9 §' });
    expect(sistaDag(lokalTid('2026-01-31', '12:00'), { manader: 1 })).toBe('2026-02-27');
  });

  test('övergång från frivillig vård: beslut inom 24 timmar, underställning dagen efter och ansökan inom fyra dagar (11 och 12 §§)', () => {
    const t0 = Date.parse(lokalTid('2026-04-06', '14:00'));
    const v = lage([h('vardintyg', t0, { frivillig: true }, 'lak-akut')], { nu: t0 + TIMME });
    expect(v.frister.find(f => f.id === 'beslut11')).toMatchObject({ paragraf: '11 §', senast: new Date(t0 + DYGN).toISOString() });
    expect(v.frister.some(f => f.id === 'intagning')).toBe(false);
    const l = lage([h('vardintyg', t0, { frivillig: true }, 'lak-akut'), h('overgang11', t0 + 2 * TIMME)], { nu: t0 + 3 * TIMME });
    expect(l.grund).toBe('11 §');
    expect(l.frister.find(f => f.id === 'understallning')).toMatchObject({ paragraf: '12 § första stycket', senast: lokalTid('2026-04-07', '23:59') });
    expect(l.frister.find(f => f.id === 'ansokan')).toMatchObject({ paragraf: '12 § andra stycket', senast: lokalTid('2026-04-09', '23:59') });
  });

  test('utan ansökan i tid upphör tvångsvården av sig själv (28 §), och 26 a § låter den öppna vården kvarstå', () => {
    const t0 = Date.parse(lokalTid('2026-03-02', '10:00'));
    const l = lage([h('vardintyg', t0), h('intagning', t0)], { nu: t0 + 30 * DYGN });
    expect(l).toMatchObject({ status: 'upphord', upphordAvSigSjalv: true });
    expect(l.slutOrsak).toContain('28 §');
    // En ansökan som kommer in för sent räddar inte vården.
    expect(lage([h('vardintyg', t0), h('intagning', t0), h('ansokan', t0 + 29 * DYGN)], { nu: t0 + 30 * DYGN }).status).toBe('upphord');
    const oppen = [h('vardintyg', t0), h('intagning', t0), h('ansokan', t0 + 20 * DYGN), h('medgivande', t0 + 25 * DYGN, { form: 'oppen', beslutsdatum: '2026-03-27' }), h('ater_sluten', t0 + 40 * DYGN)];
    const ater = lage(oppen, { nu: t0 + 41 * DYGN });
    expect(ater).toMatchObject({ form: 'sluten' });
    expect(ater.frister.find(f => f.id === 'ansokan').paragraf).toBe('26 a §');
    expect(lage(oppen, { nu: t0 + 50 * DYGN })).toMatchObject({ status: 'oppen', aterOppen: true });
    // Förvaltningsrätten avslår: vården upphör omedelbart (10 §).
    expect(lage([h('vardintyg', t0), h('intagning', t0), h('ansokan', t0 + 20 * DYGN), h('avslag', t0 + 25 * DYGN)], { nu: t0 + 26 * DYGN }).slutOrsak).toContain('10 §');
  });

  test('tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO', () => {
    const t0 = Date.parse(lokalTid('2026-03-02', '10:00'));
    const bas = [h('vardintyg', t0), h('intagning', t0)];
    const fs = h('fastspanning', t0 + DYGN, { efterIntagning: true });
    const vuxen = lage([...bas, fs], { nu: t0 + DYGN + 30 * 60_000, fodd: '1990-01-01' });
    const a = vuxen.atgarder[0];
    expect(a).toMatchObject({ paragraf: '19 §', giltigTill: null, status: 'pagar' });
    // Lagen anger ingen gräns i timmar för en vuxen, och systemet påstår ingen.
    expect(a.krav).toContain('Lagen anger ingen gräns i timmar');
    const barn = lage([...bas, h('fastspanning', t0 + DYGN, { efterIntagning: true })], { nu: t0 + DYGN + 30 * 60_000, fodd: '2010-05-01' }).atgarder[0];
    expect(barn).toMatchObject({ paragraf: '19 a §', giltigTill: new Date(t0 + DYGN + TIMME).toISOString() });
    const avsk = h('avskiljande', t0 + DYGN, { efterIntagning: true });
    const l = lage([...bas, avsk], { nu: t0 + DYGN + 9 * TIMME, fodd: '1990-01-01' });
    expect(l.atgarder[0]).toMatchObject({ paragraf: '20 §', giltigTill: new Date(t0 + DYGN + 8 * TIMME).toISOString(), status: 'utgangen' });
    expect(l.uppgifter.find(u => u.id === `ivo:${avsk.id}`)).toMatchObject({ typ: 'ivo', paragraf: '20 § tredje stycket' });
    expect(lage([...bas, h('avskiljande', t0 + DYGN, { efterIntagning: true })], { nu: t0 + DYGN + TIMME, fodd: '2010-05-01' }).atgarder[0].giltigTill).toBe(new Date(t0 + DYGN + 2 * TIMME).toISOString());
    // Synnerliga skäl för en vuxen: IVO ska underrättas (19 § tredje stycket).
    const syn = h('fastspanning', t0 + DYGN, { efterIntagning: true, synnerliga: true });
    expect(lage([...bas, syn], { nu: t0 + DYGN + TIMME, fodd: '1990-01-01' }).uppgifter.find(u => u.id === `ivo:${syn.id}`).paragraf).toBe('19 § tredje stycket');
    // Efter en avslutad åtgärd ska ett uppföljningssamtal erbjudas (18 a §), och IVO-uppgiften försvinner när den är gjord.
    const slut = h('atgard_slut', t0 + DYGN + 2 * TIMME, { avser: avsk.id });
    const efter = lage([...bas, avsk, slut, h('ivo', t0 + DYGN + 9 * TIMME, { avser: `ivo:${avsk.id}` })], { nu: t0 + 2 * DYGN, fodd: '1990-01-01' });
    expect(efter.uppgifter.find(u => u.typ === 'uppfoljningssamtal')).toMatchObject({ paragraf: '18 a §', avser: avsk.id });
    expect(efter.uppgifter.some(u => u.typ === 'ivo')).toBe(false);
    // Tre åtgärder för en patient under 18 år: IVO (22 c §).
    const tre = [1, 2, 3].map(i => h('avskiljande', t0 + i * DYGN, { efterIntagning: true }));
    expect(lage([...bas, ...tre], { nu: t0 + 5 * DYGN, fodd: '2010-05-01' }).uppgifter.some(u => u.id === 'ivo:22c')).toBe(true);
  });

  test('rättspsykiatrisk vård: fyra månader utan särskild utskrivningsprövning och anmälan inom fyra månader med', () => {
    const t0 = Date.parse(lokalTid('2026-02-10', '10:00'));
    const utan = lage([h('lrv', t0, { sup: false, verkstallbar: '2026-02-10' })], { nu: t0 + DYGN });
    expect(utan).toMatchObject({ lag: 'LRV', giltigTill: lokalTid('2026-06-09', '23:59'), giltigParagraf: 'LRV 12 §' });
    expect(utan.frister.find(f => f.id === 'ansokan').paragraf).toBe('LRV 12 a §');
    const med = lage([h('lrv', t0, { sup: true, verkstallbar: '2026-02-10' })], { nu: t0 + DYGN });
    expect(med.frister.find(f => f.id === 'anmalan')).toMatchObject({ paragraf: 'LRV 16 a §', senast: lokalTid('2026-06-09', '23:59') });
    expect(med.giltigTill).toBeNull();
    // En sen anmälan avslutar inte vården: lagen säger inte att den upphör.
    expect(lage([h('lrv', t0, { sup: true, verkstallbar: '2026-02-10' })], { nu: t0 + 200 * DYGN }).status).toBe('sluten');
  });

  test('kontrollerna före intagningen: vårdintygets ålder, vem som utfärdade det och chefsöverläkarens uppdrag (6 b och 39 §§)', () => {
    const t0 = Date.now();
    const l = lage([h('ankomst', t0 - TIMME), h('vardintyg', t0 - TIMME, {}, 'lak-akut')], { nu: t0 });
    expect(provaIntagning(l, { nu: t0, beslutare: 'lak-psyk', harUppdrag: true }).ok).toBe(true);
    expect(provaIntagning(l, { nu: t0, beslutare: 'lak-akut', harUppdrag: true }).kontroller.find(k => !k.ok).text).toContain('Du har utfärdat vårdintyget själv');
    expect(provaIntagning(l, { nu: t0, beslutare: 'x', harUppdrag: false }).ok).toBe(false);
    const gammal = lage([h('vardintyg', t0 - 5 * DYGN, {}, 'lak-akut')], { nu: t0 });
    expect(provaIntagning(gammal, { nu: t0, beslutare: 'lak-psyk', harUppdrag: true }).kontroller[0]).toMatchObject({ ok: false });
  });

  test('läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten', async () => {
    const k = await inloggad('lak-psyk');
    const d = (await k.get('/api/patient/p21/tvangsvard')).data;
    const p = d.perioder[0];
    expect(p).toMatchObject({ status: 'vantar', enhet: { id: 'uso-psyk' } });
    expect(p.frister.find(f => f.id === 'intagning').status).toMatch(/kommande|snart/);
    const steg = p.nasta.find(s => s.typ === 'intagning');
    expect(steg).toMatchObject({ primar: true, kan: true, paragraf: '6 b §' });
    expect(steg.kontroller.every(x => x.ok)).toBe(true);
    // Utan bekräftelse sparas inget.
    expect((await k.post('/api/patient/p21/tvangsvard', { typ: 'intagning', period: p.id })).status).toBe(400);
    const r = await k.post('/api/patient/p21/tvangsvard', { typ: 'intagning', period: p.id, bekraftelse: true });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ status: 'sluten', lag: 'LPT' });
    expect(r.data.frister.find(f => f.id === 'ansokan')).toMatchObject({ paragraf: '7 §', senast: lokalTid(addDagar(idag(), 27), '23:59') });
    expect(r.data.uppgifter.map(u => u.id)).toEqual(expect.arrayContaining(['vardplan', 'socialtjanst', 'stodperson']));
    expect(db(k).query("SELECT enhet_id FROM vardtillfallen WHERE patient_id = 'p21' AND utskriven IS NULL").get()).toEqual({ enhet_id: 'uso-psyk' });
    expect(db(k).query('SELECT * FROM atkomstlogg ORDER BY id DESC LIMIT 1').get()).toMatchObject({ personal_id: 'lak-psyk', patient_id: 'p21', handling: 'tvangsvard', resultat: 'tillaten' });
    // Beslutsjournalen visar vem, var och när.
    expect(r.data.beslutsjournal[0]).toMatchObject({ typ: 'intagning', av: { id: 'lak-psyk' }, registreradPa: { id: 'uso-psyk' } });
    expect(r.data.beslutsjournal.find(x => x.typ === 'vardintyg')).toMatchObject({ av: { id: 'lak-akut' } });
  });

  test('beslutet nekas för den som saknar chefsöverläkarens uppdrag, och tvångsåtgärder kräver uppdraget utom under kvarhållningen', async () => {
    const k = await inloggad('lak-akut');
    const p = (await k.get('/api/patient/p21/tvangsvard')).data.perioder;
    // Akutmottagningen ser inte psykiatrins period utan aktivt val.
    expect(p).toEqual([]);
    const id = db(k).query("SELECT id FROM tvangsvard_perioder WHERE patient_id = 'p21'").get().id;
    const r = await k.post('/api/patient/p21/tvangsvard', { typ: 'intagning', period: id, bekraftelse: true });
    expect(r.status).toBe(404);
    // Lena Ström utan uppdraget (simulerat): uppdraget tas bort i den här sandlådan genom en annan läkare på enheten.
    const s = sandlada(app, k);
    s.db.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES ('lak-psyk2', 'Test Läkare', 'lakare', 'Underläkare', 'uso-psyk', 'X', 0)").run();
    s.personalId = 'lak-psyk2';
    const r2 = await k.post('/api/patient/p21/tvangsvard', { typ: 'intagning', period: id, bekraftelse: true });
    expect(r2.status).toBe(403);
    expect(r2.data.fel ?? r2.data.text ?? JSON.stringify(r2.data)).toContain('39 §');
    // Under kvarhållningen före intagningen beslutar legitimerad läkare om fastspänning (6 a §).
    const r3 = await k.post('/api/patient/p21/tvangsvard', { typ: 'atgard', period: id, atgard: 'fastspanning' });
    expect(r3.status).toBe(201);
    expect(r3.data.atgarder[0]).toMatchObject({ typ: 'fastspanning', kvarhallen: true });
    expect(r3.data.atgarder[0].krav).toContain('6 a §');
    expect(db(k).query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'lak-psyk2' AND handling = 'tvangsvard' ORDER BY id").all().map(x => x.resultat)).toEqual(['nekad', 'tillaten']);
  });

  test('vårdintyget skickas av systemet till den psykiatriska vårdenheten och svaret röjer inget om andra uppgifter där', async () => {
    const k = await inloggad('lak-akut');
    // p13 har en pågående kontakt på akuten. Utan redogörelse sparas inget (5 §).
    expect((await k.post('/api/patient/p13/tvangsvard', { typ: 'vardintyg' })).status).toBe(400);
    const r = await k.post('/api/patient/p13/tvangsvard', { typ: 'vardintyg', redogorelse: 'Akut psykos med farlighet.' });
    expect(r.status).toBe(201);
    expect(Object.keys(r.data).sort()).toEqual(['mottagare', 'ok', 'text', 'typ']);
    expect(r.data.mottagare).toEqual({ id: 'uso-psyk', namn: 'Allmänpsykiatriska kliniken USÖ' });
    const rad = db(k).query("SELECT * FROM tvangsvard_handelser WHERE patient_id = 'p13' AND typ = 'vardintyg'").get();
    expect(rad).toMatchObject({ enhet_id: 'uso-psyk', av: 'lak-akut', registrerad_pa: 'uso-akut' });
    // Ankomsten räknas från när patienten kom till akutmottagningen på samma sjukhus.
    const ank = db(k).query("SELECT * FROM tvangsvard_handelser WHERE patient_id = 'p13' AND typ = 'ankomst'").get();
    const akut = db(k).query("SELECT start FROM vardkontakter WHERE patient_id = 'p13' AND enhet_id = 'uso-akut' AND slut IS NULL").get();
    expect(ank.tid).toBe(akut.start);
    // En vårdadministratör och en sjuksköterska kan inte utfärda vårdintyg.
    for (const roll of ['adm-kard', 'ssk-kard']) {
      const k2 = await inloggad(roll);
      expect((await k2.post('/api/patient/p01/tvangsvard', { typ: 'vardintyg', redogorelse: 'x' })).status).toBe(403);
    }
  });

  test('inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt', async () => {
    const k = await inloggad('lak-kard');
    // p22 vårdas på hjärtintensiven under pågående LPT.
    expect((await k.get('/api/patient/p22/tvangsvard')).data.perioder).toEqual([]);
    expect((await k.get('/api/patient/p22/oversikt')).data.r3.tvangsvard).toBeNull();
    expect((await k.post('/api/patient/p22/val', { typ: 'andra_enheter', syfte: 'Behandling av förmaksflimmer' })).status).toBe(200);
    const d = (await k.get('/api/patient/p22/tvangsvard')).data;
    expect(d.perioder.find(p => p.status === 'sluten')).toMatchObject({ lag: 'LPT' });
    // Kardiologen får läsa men inte registrera i psykiatrins tvångsvård.
    expect(d.perioder.every(p => p.nasta.length === 0)).toBe(true);
    // Spärr: Elin Sandberg (p04) har spärrat Allmänpsykiatriska kliniken. En period där syns inte, inte ens med aktivt val.
    const s = sandlada(app, k).db;
    const per = Number(s.query("INSERT INTO tvangsvard_perioder (patient_id, enhet_id, skapad, skapad_av) VALUES ('p04', 'uso-psyk', ?, 'lak-psyk')").run(new Date().toISOString()).lastInsertRowid);
    s.query("INSERT INTO tvangsvard_handelser (period_id, patient_id, enhet_id, typ, tid, registrerad, av, registrerad_pa, detalj) VALUES (?, 'p04', 'uso-psyk', 'vardintyg', ?, ?, 'lak-psyk', 'uso-psyk', '{}')").run(per, new Date().toISOString(), new Date().toISOString());
    await k.post('/api/patient/p04/val', { typ: 'andra_enheter', syfte: 'Genomgång av läkemedel' });
    const sp = await k.get('/api/patient/p04/tvangsvard');
    expect(sp.data.perioder).toEqual([]);
    expect(JSON.stringify((await k.get('/api/patient/p04/oversikt')).data.r3)).not.toContain('tvångsvård');
    expect(JSON.stringify((await k.get('/api/inkorg')).data.tvangsvard)).not.toContain('p04');
    // Med patientens samtycke syns perioden.
    await k.post('/api/patient/p04/val', { typ: 'samtycke_sparr', syfte: 'Patienten samtycker muntligt' });
    expect((await k.get('/api/patient/p04/tvangsvard')).data.perioder.length).toBe(1);
  });

  test('parallella processer: den somatiska vården visas medan tvångsvården fortsätter', async () => {
    const k = await inloggad('lak-psyk');
    const d = (await k.get('/api/patient/p22/tvangsvard')).data;
    const p = d.perioder.find(x => x.status === 'sluten');
    // Hjärtintensiven är en annan vårdenhet och syns först efter aktivt val.
    expect(p.parallellt).toEqual([]);
    await k.post('/api/patient/p22/val', { typ: 'andra_enheter', syfte: 'Samordning med kardiologen' });
    const p2 = (await k.get('/api/patient/p22/tvangsvard')).data.perioder.find(x => x.status === 'sluten');
    expect(p2.parallellt[0]).toMatchObject({ vardform: 'slutenvard', vardenhet: { id: 'uso-kard' } });
    // Fristen löper som vanligt: ansökan senast i morgon, fyra veckor från intagningsdagen.
    expect(p2.frister.find(f => f.id === 'ansokan')).toMatchObject({ status: 'snart', senast: lokalTid(addDagar(idag(), 1), '23:59') });
    // En tidigare period finns kvar i samma journal med sin beslutsjournal.
    expect(d.perioder.find(x => x.status === 'upphord').beslutsjournal.map(x => x.typ)).toContain('upphor');
  });

  test('bevakningen på enhetsnivå sorterar på fristen och uppföljningen innehåller inga personuppgifter', async () => {
    const k = await inloggad('lak-psyk');
    const b = (await k.get('/api/tvangsvard/bevakning')).data;
    expect(b.vardenhet.id).toBe('uso-psyk');
    expect(b.rader.map(r => r.patientId)).toEqual(['p22', 'p21']);
    expect(b.rader[0].frist).toMatchObject({ id: 'ansokan', status: 'snart' });
    const u = (await k.get('/api/uppfoljning/planer')).data;
    const text = JSON.stringify(u);
    for (const x of ['p21', 'p22', 'Sofia', 'Hedlund', 'Emil', 'Sjölund', '199604052382', '199604062399', 'patientId']) expect(text).not.toContain(x);
    expect(u.tvangsvard[0].vardenhet.id).toBe('uso-psyk');
    expect(u.tvangsvard[0].atgarder.fastspanning.antal).toBe('färre än 3');
    // Uppföljningsrollen ser alla vårdenheter, andra roller nekas och försöket loggas.
    const up = await inloggad('uppf');
    expect((await up.get('/api/uppfoljning/planer')).status).toBe(200);
    const adm = await inloggad('logg');
    expect((await adm.get('/api/uppfoljning/planer')).status).toBe(403);
    // Bevakningen finns bara på de psykiatriska vårdenheterna.
    const kard = await inloggad('lak-kard');
    expect((await kard.get('/api/tvangsvard/bevakning')).status).toBe(403);
    expect(db(kard).query("SELECT resultat FROM atkomstlogg WHERE personal_id = 'lak-kard' ORDER BY id DESC LIMIT 1").get().resultat).toBe('nekad');
  });

  test('skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning', async () => {
    const k = await inloggad('lak-psyk');
    db(k).query("UPDATE patienter SET skyddad = 1 WHERE id = 'p21'").run();
    const b = (await k.get('/api/tvangsvard/bevakning')).data;
    const r = b.rader.find(x => x.patientId === 'p21');
    expect(r).toMatchObject({ namn: 'Skyddad identitet', skyddad: true });
    expect(JSON.stringify(b)).not.toContain('Hedlund');
    // Nödåtkomst: Per Holm på vårdcentralen har ingen vårdrelation med p21.
    const vc = await inloggad('lak-vc');
    await vc.post('/api/patient/p21/val', { typ: 'nodatkomst', syfte: 'Patienten är medvetslös och kan inte samtycka' });
    const per = db(vc).query("SELECT id FROM tvangsvard_perioder WHERE patient_id = 'p21'").get().id;
    expect((await vc.post('/api/patient/p21/tvangsvard', { typ: 'kvarhallning', period: per })).status).toBe(403);
  });

  test('beslutsjournalen kan inte ändras eller raderas (trigger)', async () => {
    const k = await inloggad('lak-psyk');
    const d = db(k);
    expect(() => d.query("UPDATE tvangsvard_handelser SET av = 'x' WHERE patient_id = 'p22'").run()).toThrow('Beslutsjournalen ändras inte');
    expect(() => d.query("DELETE FROM tvangsvard_handelser WHERE patient_id = 'p22'").run()).toThrow('Beslutsjournalen raderas inte');
    expect(() => d.query('DELETE FROM tvangsvard_perioder').run()).toThrow('En tvångsvårdsperiod raderas inte');
  });

  test('inkorgen visar fristen för ansökan och uppgifterna för läkaren på den psykiatriska vårdenheten', async () => {
    const k = await inloggad('lak-psyk');
    const i = (await k.get('/api/inkorg')).data.tvangsvard;
    const r = i.find(x => x.patientId === 'p22');
    expect(r.frister[0]).toMatchObject({ id: 'ansokan', status: 'snart' });
    expect(r.uppgifter.map(u => u.id)).toEqual(expect.arrayContaining(['vardplan', 'socialtjanst']));
    expect(r.uppgifter.some(u => u.id.startsWith('samtal:'))).toBe(true);
    expect(r.patient.namn).toBe('Emil Sjölund');
    // Raden loggas på patienten en gång per session.
    await k.get('/api/inkorg');
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs = ?").get(`inkorg:tvangsvard:${r.periodId}`).n).toBe(1);
    // Läkare på andra vårdenheter får inga rader.
    const kard = await inloggad('lak-kard');
    expect((await kard.get('/api/inkorg')).data.tvangsvard).toEqual([]);
  });
});
