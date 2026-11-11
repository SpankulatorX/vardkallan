// Ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar (runda 6, r6, beslut 2026-11-03). Underlag: Region
// Örebro läns Gröna häftet 688488 R5 avsnitt 1.3 till 1.4.5 och HSLF-FS 2017:37 4 kap.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { byggSeed, idag, addDagar } from '../src/db.js';
import * as ansvar from '../src/lakemedelsansvar.js';
import * as godkannande from '../src/mallgodkannande.js';
import * as mallar from '../src/ordinationsmallar.js';
import * as vagar from '../src/ordinationsvagar.js';
import * as vardhandelse from '../src/vardhandelse.js';
import { verifiera } from '../src/logg.js';
import { atk, personal, testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const db = (k) => sandlada(app, k).db;
const loggad = (d, villkor) => d.query(`SELECT * FROM atkomstlogg WHERE ${villkor} ORDER BY id`).all();
// Patientuppgifter som aldrig får finnas i uppdragen, påminnelserna eller raderna utan grund.
const PATIENT = /p0[1-9]|p1[0-9]|Gunnar|Åkesson|Birgitta|Nyman|Elin|Sandberg|19[0-9]{6}-?[0-9]{4}|Omeprazol|Elkonvertering/;

describe('Ansvarsuppdrag för läkemedel', () => {
  test('verksamhetschefen ser vårdenhetens uppdrag, och systemet påminner om det som saknas och föreslår vem som ska få uppdraget', () => {
    const d = byggSeed();
    const o = ansvar.oversikt(d, personal(d, 'vch-kard'));
    expect(o).toMatchObject({ vardenhet: { id: 'uso-kard' }, verksamhetschef: { namn: 'Ulrika Sandell' }, kanAndra: true });
    expect(o.ledningsansvar).toContain('kan inte överlåtas');
    const per = Object.fromEntries(o.uppdrag.map(u => [u.typ, u]));
    expect(per.medicinskt_ansvarig.gallande).toEqual([]);
    expect(per.medicinskt_ansvarig.forslag[0]).toMatchObject({ personalId: 'ol-kard', till: addDagar(idag(), 365), fran: idag() });
    expect(per.medicinskt_ansvarig.forslag[0].varfor).toContain('Göran Malm hade uppdraget till');
    // Underläkaren och den läkare som inte längre är i tjänst föreslås inte.
    expect(per.medicinskt_ansvarig.forslag[0].kandidater.map(k => k.id)).toEqual(['ol-kard', 'lak-kard', 'lak-kard2']);
    expect(per.mallansvarig.gallande.map(u => u.personal.namn)).toEqual(['Sara Lindqvist']);
    // Tidigare uppdrag är bara de som inte gäller längre.
    expect(per.mallansvarig.tidigare).toEqual([]);
    expect(per.medicinskt_ansvarig.tidigare.map(u => u.personal.namn)).toEqual(['Göran Malm']);
    expect(per.lakemedelsansvarig_ssk.gallande.map(u => u.personal.namn)).toEqual(['Johan Ek']);
    expect(per.narkotikakontroll.saknas).toEqual([true]);
    // Reserven föreslås bland dem som varken är ordinarie kontrollant eller läkemedelsansvarig sjuksköterska.
    expect(per.narkotikakontroll.forslag[1]).toMatchObject({ reserv: true, personalId: 'ssk-hia' });
    expect(o.paminnelser.map(p => p.typ)).toEqual(['saknas', 'saknas', 'oversyn']);
    expect(o.paminnelser[0].text).toContain('Medicinskt ansvarig läkare saknas på Kardiologiska kliniken USÖ');
    expect(o.paminnelser[1].text).toContain('minst en ordinarie och en reservkontrollant');
    expect(o.paminnelser[2].text).toContain('minst en gång per år');
    expect(JSON.stringify(o)).not.toMatch(PATIENT);
    // Sjuksköterskan på vårdenheten ser vem som har uppdragen, men inga förslag, påminnelser eller tidigare uppdrag.
    const s = ansvar.oversikt(d, personal(d, 'ssk-kard'));
    expect(s).toMatchObject({ kanAndra: false, paminnelser: [] });
    expect(s.uppdrag.every(u => !u.forslag.length && !u.tidigare.length)).toBe(true);
    // Den som inte arbetar på en vårdenhet har inga uppdrag att se.
    expect(fel(() => ansvar.oversikt(d, personal(d, 'logg'))).status).toBe(403);
  });

  test('verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen', async () => {
    const k = klient(app);
    await k.logga('vch-kard');
    // Runda 7, r2: all personal gör övningar, och verksamhetschefen ser vårdenhetens intyg.
    // Runda 13, r3: inte faststalla_direktiv (HSLF-FS 2017:37 6 kap. 6 §).
    expect((await k.get('/api/session')).data.behorigheter).toEqual(['lakemedelsansvar', 'utbildning', 'intyg_enhet',
      // Runda 9, r7: godkännande av forskningsuttag och vårdenhetens signeringslista, utan journalåtkomst.
      'forskning_godkann', 'signeringslista',
      // Runda 13, r3 (E3-35): godkännande av gallring och radering för vårdenheten.
      'godkanna_gallring',
      // Runda 10, r2: vårdenhetens förval för vyerna.
      'vyforval']);
    const f = (await k.get('/api/lakemedelsansvar')).data.uppdrag.find(u => u.typ === 'medicinskt_ansvarig').forslag[0];
    const r = await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'medicinskt_ansvarig', personalId: f.personalId });
    expect(r.status).toBe(201);
    expect(r.data.uppdrag).toMatchObject({ namn: 'Medicinskt ansvarig läkare', personal: { namn: 'Göran Malm' }, fran: idag(), till: addDagar(idag(), 365), sattAv: 'Ulrika Sandell', galler: true });
    expect(r.data.uppdrag.omfattning).toContain('Lokalanpassa och fastställa generella direktiv och se till att de uppdateras minst en gång om året.');
    const o = (await k.get('/api/lakemedelsansvar')).data;
    // Ett ändrat uppdrag är en revidering av ansvarsdokumentet, så båda påminnelserna försvinner.
    expect(o.paminnelser.map(p => p.typ)).toEqual(['saknas']);
    expect(o.ansvarsdokument).toMatchObject({ forfallet: false, senast: { av: 'Ulrika Sandell', hur: 'ändrat uppdrag' } });
    const d = db(k);
    expect(loggad(d, `handling = 'lakemedelsansvar' AND resurs = 'lakemedelsuppdrag:${r.data.uppdrag.id}' AND personal_id = 'vch-kard' AND grund = 'administrativ'`)).toHaveLength(1);
    expect(d.query("SELECT * FROM sakerhetslogg WHERE typ = 'andrad_behorighet' AND vag = '/api/lakemedelsansvar/uppdrag'").all()).toHaveLength(1);
    // Göran Malm fastställer nu generella direktiv.
    expect(ansvar.faststallaDirektiv(d, personal(d, 'ol-kard'))).toMatchObject({ kan: true, som: 'medicinskt_ansvarig' });
    expect(ansvar.faststallaDirektiv(d, personal(d, 'lak-kard')).varfor).toContain('På Kardiologiska kliniken USÖ är det Göran Malm.');
    expect(verifiera(d).hel).toBe(true);
  });

  test('säkerhet: bara vårdenhetens verksamhetschef utser och avslutar uppdrag, och nekade försök loggas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    expect((await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'medicinskt_ansvarig', personalId: 'lak-kard' })).status).toBe(403);
    const id = db(k).query("SELECT id FROM lakemedelsuppdrag WHERE typ = 'mallansvarig' AND enhet_id = 'uso-kard'").get().id;
    expect((await k.post(`/api/lakemedelsansvar/uppdrag/${id}/avsluta`, { orsak: 'Prov' })).status).toBe(403);
    expect((await k.post('/api/lakemedelsansvar/oversyn', {})).status).toBe(403);
    expect(loggad(db(k), "handling = 'lakemedelsansvar' AND resultat = 'nekad' AND personal_id = 'lak-kard'")).toHaveLength(3);
    await k.logga('ssk-kard');
    expect((await k.post('/api/lakemedelsansvar/uppdrag', { typ: 'lakemedelsansvarig_ssk', personalId: 'ssk-kard' })).status).toBe(403);
    // En verksamhetschef som inte är registrerad för vårdenheten utser inget.
    const d = byggSeed();
    d.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES ('vch-akut', 'Test Chef', 'verksamhetschef', 'Verksamhetschef', 'uso-akut', 'X', 0)").run();
    expect(fel(() => ansvar.utse(d, personal(d, 'vch-akut'), { typ: 'medicinskt_ansvarig', personalId: 'lak-akut' })).status).toBe(403);
    // Kardiologens verksamhetschef utser bara kardiologens personal och avslutar bara kardiologens uppdrag.
    const annan = fel(() => ansvar.utse(d, personal(d, 'vch-kard'), { typ: 'medicinskt_ansvarig', personalId: 'lak-akut' }));
    expect(annan.status).toBe(400);
    expect(annan.message).toContain('arbetar inte på Kardiologiska kliniken USÖ');
    const akutens = d.query("SELECT id FROM lakemedelsuppdrag WHERE enhet_id = 'uso-akut'").get().id;
    expect(fel(() => ansvar.avsluta(d, personal(d, 'vch-kard'), akutens, { orsak: 'Prov' })).status).toBe(404);
    expect(loggad(d, `resurs = 'lakemedelsuppdrag:${akutens}:avsluta' AND resultat = 'nekad'`)).toHaveLength(1);
  });

  test('verksamhetschefens eget ansvar går inte att lämna över, och systemet förklarar varför en person inte kan få uppdraget', () => {
    const d = byggSeed();
    const vc = personal(d, 'vch-kard');
    const e = fel(() => ansvar.utse(d, vc, { typ: 'verksamhetschef', personalId: 'ol-kard' }));
    expect(e.status).toBe(400);
    expect(e.message).toBe(ansvar.LEDNINGSANSVAR);
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'vch-kard' })).message).toBe(ansvar.LEDNINGSANSVAR);
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ssk-kard' })).message).toContain('ges till en läkare');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ul-kard' })).message).toContain('tillräcklig kompetens och erfarenhet');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'lak-cosmic' })).message).toContain('inte längre i tjänst');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'mallansvarig', personalId: 'lak-kard' })).message).toContain('har redan uppdraget');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ol-kard', fran: addDagar(idag(), -1) })).extra.falt).toEqual(['fran']);
    expect(fel(() => ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ol-kard', till: addDagar(idag(), 4 * 365) })).extra.falt).toEqual(['till']);
    expect(fel(() => ansvar.utse(d, vc, { typ: 'enhetschef', personalId: 'ol-kard' })).extra.falt).toEqual(['typ']);
  });

  test('samma sjuksköterska beställer inte och kontrollerar narkotika, och reserven är en annan än den ordinarie', () => {
    const d = byggSeed();
    const vc = personal(d, 'vch-kard');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'narkotikakontroll', reserv: true, personalId: 'ssk-kard' })).message).toContain('får inte ha behörighet att beställa');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'lakemedelsansvarig_ssk', personalId: 'ssk-kardmott' })).message).toContain('kontrollerar förbrukningen av narkotiska läkemedel');
    expect(fel(() => ansvar.utse(d, vc, { typ: 'narkotikakontroll', reserv: true, personalId: 'ssk-kardmott' })).message).toContain('Ordinarie och reserv ska vara två olika');
    const r = ansvar.utse(d, vc, { typ: 'narkotikakontroll', reserv: true, personalId: 'ssk-hia' });
    expect(r.uppdrag).toMatchObject({ namn: 'Reservkontrollant för narkotikaförbrukningen', reserv: true, personal: { namn: 'Petra Nyberg' } });
    expect(r.uppdrag.omfattning).toContain('Får inte ha behörighet att beställa narkotiska läkemedel.');
    expect(ansvar.paminnelser(d, 'uso-kard').map(p => p.typ)).toEqual(['saknas']);
  });

  test('ett nytt uppdrag som medicinskt ansvarig läkare avslutar det förra, och ett uppdrag ändras och raderas aldrig', () => {
    const d = byggSeed();
    const vc = personal(d, 'vch-kard');
    const a = ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'lak-kard' }).uppdrag;
    const b = ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ol-kard' });
    expect(b.ersatta).toEqual([a.id]);
    expect(ansvar.medicinsktAnsvarig(d, 'uso-kard').id).toBe('ol-kard');
    const forra = d.query('SELECT * FROM lakemedelsuppdrag WHERE id = ?').get(a.id);
    expect(forra).toMatchObject({ avslutat: idag(), avslutat_av: 'vch-kard', avslutat_orsak: `Ersattes av Göran Malm från ${idag()}.` });
    expect(() => d.query("UPDATE lakemedelsuppdrag SET till = '2099-01-01' WHERE id = ?").run(b.uppdrag.id)).toThrow();
    expect(() => d.query("UPDATE lakemedelsuppdrag SET avslutat_orsak = 'Annat' WHERE id = ?").run(a.id)).toThrow();
    expect(() => d.query('DELETE FROM lakemedelsuppdrag WHERE id = ?').run(a.id)).toThrow();
    // Verksamhetschefen avslutar ett uppdrag med en orsak, och raden finns kvar.
    expect(fel(() => ansvar.avsluta(d, vc, b.uppdrag.id, {})).extra.falt).toEqual(['orsak']);
    expect(ansvar.avsluta(d, vc, b.uppdrag.id, { orsak: 'Byter arbetsuppgifter' }).uppdrag).toMatchObject({ galler: false, avslutat: { fran: idag(), av: 'Ulrika Sandell', orsak: 'Byter arbetsuppgifter' } });
    expect(fel(() => ansvar.avsluta(d, vc, b.uppdrag.id, { orsak: 'Igen' })).message).toContain('redan avslutat');
    expect(ansvar.medicinsktAnsvarig(d, 'uso-kard')).toBeNull();
  });

  test('påminnelsen kommer när ett uppdrag går ut inom 30 dagar, uppdraget upphör när personen slutar och genomgången av ansvarsdokumentet sparas', () => {
    const d = byggSeed();
    const vc = personal(d, 'vch-kard');
    ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ol-kard', till: addDagar(idag(), 10) });
    const p = ansvar.paminnelser(d, 'uso-kard').find(x => x.typ === 'gar_ut');
    expect(p.text).toContain('för Göran Malm går ut om 10 dagar');
    expect(p.forslag).toMatchObject({ personalId: 'ol-kard', fran: addDagar(idag(), 11) });
    // Ett nytt uppdrag för samma person som tar vid räcker.
    ansvar.utse(d, vc, { typ: 'medicinskt_ansvarig', personalId: 'ol-kard', fran: p.forslag.fran });
    expect(ansvar.paminnelser(d, 'uso-kard').some(x => x.typ === 'gar_ut')).toBe(false);
    // Sara slutar: uppdraget som mallansvarig gäller inte längre, och systemet påminner.
    d.query("UPDATE personal SET aktiv = 0 WHERE id = 'lak-kard'").run();
    expect(ansvar.gallande(d, 'uso-kard', 'mallansvarig')).toEqual([]);
    expect(ansvar.paminnelser(d, 'uso-kard').find(x => x.uppdragTyp === 'mallansvarig').text).toContain('kan ingen ny eller ändrad läkemedelsmall godkännas');
    // Genomgången.
    const d2 = byggSeed();
    expect(ansvar.paminnelser(d2, 'uso-kard').some(x => x.typ === 'oversyn')).toBe(true);
    const g = ansvar.oversyn(d2, personal(d2, 'vch-kard'), { anteckning: 'Genomgånget med enhetschefen.' });
    expect(g.ansvarsdokument).toMatchObject({ forfallet: false, nasta: addDagar(idag(), 365), senast: { hur: 'genomgång', av: 'Ulrika Sandell' } });
    expect(ansvar.paminnelser(d2, 'uso-kard').some(x => x.typ === 'oversyn')).toBe(false);
    expect(() => d2.query('DELETE FROM ansvarsdokument_oversyn').run()).toThrow();
  });

  test('säkerhet: verksamhetschefen läser inte journalen och har ingen arbetslista', async () => {
    const k = klient(app);
    await k.logga('vch-kard');
    expect((await k.get('/api/arbetslista')).data).toEqual([]);
    expect((await k.get('/api/patient/p01')).status).toBe(403);
    expect((await k.get('/api/patient/p01/lakemedel')).status).toBe(403);
    expect((await k.get('/api/lakemedelsmallar')).status).toBe(403);
  });
});

describe('Avbokad vårdhändelse utan grund', () => {
  // Demoläget med en remiss som en vårdhändelse hänger på (remissavvisning.js). Ordinationen flyttas till psykiatrin,
  // som patienten har spärrat, så att kardiologen inte ser den och avvisningen lämnar den åt psykiatrin. Psykiatrins
  // läkare saknar vårdrelation och får därför raden utan grund.
  async function scenario() {
    const k = klient(app);
    await k.logga('lak-kard');
    const s = (await k.post('/api/demo/remiss-vardhandelse')).data;
    const d = db(k);
    d.query("INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('p06', 'uso-psyk', ?, 1)").run(new Date().toISOString());
    d.query("UPDATE ordinationer SET enhet_id = 'uso-psyk' WHERE id = ?").run(s.ordinationId);
    d.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES ('lak-psyk2', 'Test Läkare', 'lakare', 'Läkare', 'uso-psyk', 'X', 1)").run();
    expect((await k.post(`/api/remiss/${s.remissId}/bedom`, { beslut: 'avvisad', motivering: 'Handläggs i primärvården.' })).status).toBe(200);
    return { k, d, ...s };
  }
  const rader = (d, id) => vardhandelse.avbokadeIInkorg(d, personal(d, id)).filter(r => r.utanPatient);

  test('raden går till den ordinerande läkaren, annars till den medicinskt ansvariga läkaren och annars till alla läkare, och verksamhetschefen påminns', async () => {
    const { k, d, ordinationId } = await scenario();
    // Den som ordinerade (Sara på kardiologen) finns inte på psykiatrin, så raden går till den medicinskt ansvariga
    // läkaren, Lena Ström, och inte till den andra läkaren.
    expect(rader(d, 'lak-psyk')).toEqual([expect.objectContaining({ ordinationId, mottagare: 'medicinskt_ansvarig' })]);
    expect(rader(d, 'lak-psyk')[0].text).toContain('Du får raden som medicinskt ansvarig läkare');
    expect(rader(d, 'lak-psyk2')).toEqual([]);
    // Den ordinerande läkaren finns på vårdenheten: bara den läkaren får raden.
    d.query("UPDATE ordinationer SET ordinerad_av = 'lak-psyk2' WHERE id = ?").run(ordinationId);
    expect(rader(d, 'lak-psyk2')).toEqual([expect.objectContaining({ ordinationId, mottagare: 'ordinerande' })]);
    expect(rader(d, 'lak-psyk')).toEqual([]);
    // Den ordinerande läkaren slutar och uppdraget saknas: alla läkare på vårdenheten får raden.
    d.query("UPDATE personal SET aktiv = 0 WHERE id = 'lak-psyk2'").run();
    d.query("UPDATE lakemedelsuppdrag SET avslutat = ?, avslutat_av = 'vch-kard', avslutat_tid = ?, avslutat_orsak = 'Prov' WHERE enhet_id = 'uso-psyk' AND typ = 'medicinskt_ansvarig'").run(idag(), new Date().toISOString());
    expect(rader(d, 'lak-psyk')).toEqual([expect.objectContaining({ ordinationId, mottagare: 'alla' })]);
    expect(rader(d, 'lak-psyk')[0].text).toContain('vårdenheten har ingen medicinskt ansvarig läkare');
    // Verksamhetschefen på psykiatrin får en påminnelse utan patientuppgifter.
    d.query("INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES ('vch-psyk', 'Test Chef', 'verksamhetschef', 'Verksamhetschef', 'uso-psyk', 'X-VCH-PSYK', 1)").run();
    d.query("INSERT INTO verksamhetschefer VALUES ('uso-psyk', 'vch-psyk')").run();
    await k.logga('vch-psyk');
    const o = (await k.get('/api/lakemedelsansvar')).data;
    const p = o.paminnelser.find(x => x.typ === 'avbokad_till_alla');
    expect(p).toMatchObject({ antal: 1 });
    expect(p.text).toContain('har beslutet gått till alla läkare på vårdenheten');
    expect(JSON.stringify(o)).not.toMatch(PATIENT);
    // Raden i inkorgen bär fortfarande inga patientuppgifter, inte heller i länk eller attribut.
    await k.logga('lak-psyk');
    const rad = (await k.get('/api/inkorg')).data.avbokadeVardhandelser.find(x => x.ordinationId === ordinationId);
    expect(rad).toMatchObject({ utanPatient: true, mottagare: 'alla' });
    expect(JSON.stringify(rad)).not.toMatch(PATIENT);
    expect(JSON.stringify(rad)).not.toMatch(/psyk/i);
  });
});

describe('Godkännande av läkemedelsmallar', () => {
  test('mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const i = (await k.get('/api/inkorg')).data.mallarAttGodkanna;
    expect(i).toEqual([expect.objectContaining({ typ: 'paket', id: 'elkonvertering-v2', namn: 'Inför elkonvertering', version: 2, upprattadAv: 'Göran Malm' })]);
    expect(i[0].andringar).toContain('Alvedon 500 mg: tiden före vårdhändelsen ändras från 1 timme till 2 timmar.');
    expect(i[0].text).toContain('Version 1 används tills du har godkänt den');
    expect(JSON.stringify(i)).not.toMatch(/p0[1-9]|Gunnar|Åkesson/);
    // Läkaren som ordinerar ser bara den godkända versionen.
    const fore = (await k.get('/api/patient/p01/ordinationspaket')).data.paket.filter(p => p.namn === 'Inför elkonvertering');
    expect(fore.map(p => [p.id, p.version, p.status])).toEqual([['elkonvertering', 1, 'godkand']]);
    expect(fore[0].godkand.av).toBe('Sara Lindqvist');
    expect((await k.get('/api/patient/p01/ordinationspaket/elkonvertering-v2')).status).toBe(400);
    const g = await k.post('/api/lakemedelsmallar/godkann', { typ: 'paket', id: 'elkonvertering-v2' });
    expect(g.status).toBe(200);
    expect(g.data).toMatchObject({ version: 2, godkandAv: 'Sara Lindqvist', ersatt: 'elkonvertering' });
    const efter = (await k.get('/api/patient/p01/ordinationspaket')).data.paket.filter(p => p.namn === 'Inför elkonvertering');
    expect(efter.map(p => [p.id, p.version, p.status])).toEqual([['elkonvertering-v2', 2, 'godkand']]);
    const f = (await k.get('/api/patient/p01/ordinationspaket/elkonvertering-v2')).data;
    expect(f.poster.find(x => x.lakemedel.namn === 'Alvedon').vidHandelse).toBe(2);
    const d = db(k);
    expect(d.query("SELECT upphavt_av, upphavt_orsak FROM ordinationspaket WHERE id = 'elkonvertering'").get()).toEqual({ upphavt_av: 'lak-kard', upphavt_orsak: 'Ersatt av version 2, godkänd av Sara Lindqvist.' });
    // Godkännandet sparar innehållet som godkändes, och raden ändras och raderas aldrig.
    const rad = d.query("SELECT * FROM mallgodkannanden WHERE mall_id = 'elkonvertering-v2'").get();
    expect(rad).toMatchObject({ godkand_av: 'lak-kard', enhet_id: 'uso-kard', innehall: d.query("SELECT innehall FROM ordinationspaket WHERE id = 'elkonvertering-v2'").get().innehall });
    expect(() => d.query('DELETE FROM mallgodkannanden WHERE id = ?').run(rad.id)).toThrow();
    expect(() => d.query("UPDATE mallgodkannanden SET godkand_av = 'ol-kard' WHERE id = ?").run(rad.id)).toThrow();
    expect(loggad(d, "handling = 'godkanna_mall' AND resurs = 'mall:paket:elkonvertering-v2' AND personal_id = 'lak-kard'")).toHaveLength(1);
    expect((await k.get('/api/inkorg')).data.mallarAttGodkanna).toEqual([]);
    expect((await k.post('/api/lakemedelsmallar/godkann', { typ: 'paket', id: 'elkonvertering-v2' })).status).toBe(400);
  });

  test('säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas', async () => {
    const d = byggSeed();
    const nekad = (id) => fel(() => godkannande.godkann(d, personal(d, id), { typ: 'paket', id: 'elkonvertering-v2' }));
    expect(nekad('ol-kard').status).toBe(403);
    expect(nekad('ol-kard').message).toContain('På Kardiologiska kliniken USÖ är det Sara Lindqvist.');
    expect(nekad('lak-akut').status).toBe(403);
    expect(nekad('ssk-kard').status).toBe(403);
    expect(nekad('far-kard').status).toBe(403);
    expect(nekad('vch-kard').status).toBe(403);
    expect(loggad(d, "handling = 'godkanna_mall' AND resultat = 'nekad'")).toHaveLength(6);
    expect(godkannande.attGodkanna(d, personal(d, 'ol-kard'))).toEqual([]);
    // En ändrad version kan inte läggas till medan en annan väntar, och en oförändrad mall är ingen ny version.
    const v1 = JSON.parse(d.query("SELECT innehall FROM ordinationspaket WHERE id = 'elkonvertering'").get().innehall);
    expect(fel(() => vagar.faststallPaket(d, personal(d, 'lak-kard'), { ersatter: 'elkonvertering', poster: v1 })).message).toContain('väntar på godkännande');
    expect(fel(() => vagar.faststallPaket(d, personal(d, 'lak-kard'), { ersatter: 'pneumoni', poster: v1 })).extra.falt).toEqual(['ersatter']);
    const k = klient(app);
    await k.logga('far-kard');
    expect((await k.post('/api/lakemedelsmallar/godkann', { typ: 'paket', id: 'elkonvertering-v2' })).status).toBe(403);
    expect((await k.get('/api/inkorg')).data.mallarAttGodkanna).toEqual([]);
  });

  test('en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen', () => {
    const d = byggSeed();
    const forslag = (pid, lm, personalId = 'lak-kard') => mallar.forslag(atk(d, personalId, pid, {}, 'ordinera'), d.query('SELECT * FROM katalog WHERE id = ?').get(lm));
    expect(forslag('p01', 'VK-NPL-0010')).toMatchObject({ mall: 'C03CA01', uppfoljningsdatum: addDagar(idag(), 3), mallversion: { version: 1, godkand: { av: 'Sara Lindqvist' } } });
    const ny = godkannande.andraSubstansmall(d, personal(d, 'ol-kard'), 'C03CA01', { uppfoljning: 5, andring: 'Kaliumkontroll efter fem dagar.' });
    expect(ny).toMatchObject({ version: 2, status: 'vantar', andring: ['Uppföljningen ändras från 3 dagar till 5 dagar.'] });
    expect(fel(() => godkannande.andraSubstansmall(d, personal(d, 'ssk-kard'), 'C03CA01', { uppfoljning: 4 })).status).toBe(403);
    expect(fel(() => godkannande.andraSubstansmall(d, personal(d, 'ol-kard'), 'C03CA01', { uppfoljning: 5 })).message).toContain('oförändrad');
    // Version 1 används tills den nya är godkänd.
    expect(forslag('p01', 'VK-NPL-0010').uppfoljningsdatum).toBe(addDagar(idag(), 3));
    const v = godkannande.attGodkanna(d, personal(d, 'lak-kard')).find(x => x.typ === 'substans');
    expect(v).toMatchObject({ namn: 'Furosemid', version: 2, upprattadAv: 'Göran Malm', andringar: ['Uppföljningen ändras från 3 dagar till 5 dagar.'] });
    godkannande.godkann(d, personal(d, 'lak-kard'), { typ: 'substans', id: v.id });
    expect(forslag('p01', 'VK-NPL-0010')).toMatchObject({ uppfoljningsdatum: addDagar(idag(), 5), mallversion: { version: 2 } });
    // Akuten har inte godkänt version 2 och använder fortfarande version 1.
    expect(forslag('p02', 'VK-NPL-0010', 'lak-akut').mallversion).toMatchObject({ version: 1 });
    expect(godkannande.attGodkanna(d, personal(d, 'lak-akut')).map(x => x.namn)).toContain('Furosemid');
    // En mall som ingen har godkänt används inte, och systemet säger varför.
    d.query("INSERT INTO substansmallar (atc, namn, innehall, version, upprattad, andring) VALUES ('C09AA05', 'Ramipril', ?, 1, ?, NULL)").run(JSON.stringify({ namn: 'Ramipril', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 14 }), new Date().toISOString());
    const r = forslag('p01', 'VK-NPL-0013');
    expect(r.mall).toBeNull();
    expect(r.varfor.join(' ')).toContain('Läkemedelsmallen Ramipril är inte godkänd på din vårdenhet');
  });
});
