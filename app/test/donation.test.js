// Runda 10, r4: dokumentation vid donation och transplantation (Sussa 3.1.12.1). Ett dödsfall på intensivvården ger de
// donationsansvariga ett förslag i inkorgen, checklistan bockas av där systemet kan, donationsanteckningen skrivs av
// systemet, och en transplantation ger bidiagnos och uppmärksamhetsinformation. Testnamnen står i
// src/sussa/mappning/3.1.12.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { testserver, klient, sandlada, somPerson } from './hjalp.js';
import * as donation from '../src/donation.js';
import { ICD10SE, KVA } from '../src/kodverk.js';
import { MALLAR } from '../src/journal.js';
import { SOKORD } from '../src/fackssprak.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const inloggad = async (roll) => { const k = klient(app); await k.logga(roll); return k; };
const db = (k) => sandlada(app, k).db;
const P = donation.DEMO_PATIENT;
// Läkaren på kardiologen med patient 10 på hjärtintensiven.
const pagIva = async (roll = 'lak-kard') => {
  const k = await inloggad(roll);
  expect((await k.post('/api/demo/donation')).status).toBe(200);
  return k;
};
const dod = (k) => k.post(`/api/patient/${P}/dodsfall`, { kriterier: 'direkta', tid: new Date(Date.now() - 3600_000).toISOString() });

describe('Donation och transplantation', () => {
  test('ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen att pröva donation', async () => {
    const k = await pagIva();
    // På intensivvården föreslår systemet en utredning redan innan dödsfallet.
    const fore = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(fore).toMatchObject({ dodsfall: null, kanRegistreraDodsfall: true });
    expect(fore.forslag.text).toContain('intensivvårdsavdelningen');
    const r = await dod(k);
    expect(r.status).toBe(201);
    expect(r.data.text).toContain('donationsansvariga');
    expect((await dod(k)).status).toBe(409);
    const ik = (await k.get('/api/inkorg')).data.donationsforslag;
    expect(ik).toEqual([expect.objectContaining({ patientId: P, rubrik: 'Möjlig donator', href: `#/patient/${P}/donation` })]);
    expect(ik[0].patient.namn).toBe('Karl-Erik Brandt');
    // Sjuksköterskan som är donationsansvarig får samma förslag, men inte en annan sjuksköterska eller läkare.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag.length).toBe(1);
    somPerson(sandlada(app, k), 'ul-kard');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([]);
    somPerson(sandlada(app, k), 'lak-akut');
    expect((await k.get('/api/inkorg')).data.donationsforslag).toEqual([]);
    // Ett dödsfall registreras bara av läkaren och bara på intensivvården.
    const s = await inloggad('ssk-kard');
    await s.post('/api/demo/donation');
    expect((await s.post(`/api/patient/${P}/dodsfall`, { kriterier: 'direkta' })).status).toBe(403);
    const l = await inloggad('lak-kard');
    const ej = await l.post('/api/patient/p01/dodsfall', { kriterier: 'direkta' });
    expect(ej.status).toBe(409);
    expect(ej.data.fel).toContain('intensivvårdsavdelning');
  });

  test('checklistan bockas av där systemet kan, och den medicinska bedömningen får sitt underlag ur journalen', async () => {
    const k = await pagIva();
    await dod(k);
    const d = await k.post(`/api/patient/${P}/donation`);
    expect(d.status).toBe(201);
    const p = Object.fromEntries(d.data.checklista.map(x => [x.id, x]));
    expect(p.identifierad.status).toBe('klar');
    expect(p.dodsdiagnos).toMatchObject({ status: 'klar', av: 'system' });
    expect(p.dodsdiagnos.detalj).toContain('total hjärninfarkt');
    expect(p.registret.status).toBe('klar');
    expect(p.registret.detalj).toContain('Donationsregistret (simulerat)');
    expect(['klar', 'kvar']).toContain(p.installning.status);
    expect(p.narstaende.status).toBe('kvar');
    expect(p.kvalitetsregister.status).toBe('kvar');
    // Referensmaterialet står vid varje punkt.
    expect(p.dodsdiagnos.referens).toBe('Lag (1987:269) om kriterier för bestämmande av människans död');
    expect(p.narstaende.referens).toBe('Lag (1995:831) om transplantation m.m.');
    // Underlaget för bedömningen: åldern, och här ingen smitta eller tumörsjukdom.
    expect(d.data.underlag.map(x => x.typ)).toEqual(['alder']);
    // Slagningen i Donationsregistret loggas på patienten.
    expect(db(k).query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = ? AND resurs = ?").get(P, `donationsregistret:${P}`).n).toBe(1);
    // Samma svar från det simulerade registret varje gång.
    expect(donation.donationsregistret({ id: P })).toEqual(donation.donationsregistret({ id: P }));
    expect((await k.post(`/api/patient/${P}/donation`)).status).toBe(409);
    // Punkter som systemet bockar av själv kan inte bockas för hand, och inte aktuell kräver en orsak.
    expect((await k.post(`/api/donation/${d.data.id}/punkt`, { punkt: 'registret', status: 'klar' })).status).toBe(400);
    expect((await k.post(`/api/donation/${d.data.id}/punkt`, { punkt: 'koordinator', status: 'ej_aktuell' })).status).toBe(400);
  });

  test('närståendes uppgift om inställningen, checklistan klar, KVÅ för bedömningen och underlag till kvalitetsregistret', async () => {
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    expect((await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja_utom' })).status).toBe(400);
    const v = await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja_utom', undantag: 'hornhinnor', kalla: 'narstaende' });
    expect(v.status).toBe(201);
    expect((await k.post(`/api/patient/${P}/donationsvilja`, { vilja: 'ja', kalla: 'donationsregistret' })).status).toBe(400);
    for (const punkt of ['narstaende', 'lamplighet', 'koordinator']) {
      const r = await k.post(`/api/donation/${d.id}/punkt`, { punkt, status: 'klar', kommentar: punkt === 'lamplighet' ? 'Inga hinder.' : undefined });
      expect(r.status).toBe(200);
    }
    const u = (await k.get(`/api/patient/${P}/donation`)).data.donationer[0];
    const p = Object.fromEntries(u.checklista.map(x => [x.id, x]));
    expect(p.installning.detalj).toContain('utom hornhinnor');
    expect(p.lamplighet).toMatchObject({ status: 'klar', detalj: 'Inga hinder.', av: 'Sara Lindqvist', text: 'Medicinsk bedömning av lämpligheten' });
    expect(u.klar).toBe(true);
    expect(p.kvalitetsregister.status).toBe('klar');
    expect(u.kvalitetsregister).toMatchObject({ klar: true, falt: { donation: d.id, kon: 'man', utfall: 'Utredning pågår' } });
    expect(JSON.stringify(u.kvalitetsregister)).not.toMatch(/Karl-Erik|Brandt|194601136098|601136098/);
    expect(db(k).query("SELECT kod FROM atgarder WHERE patient_id = ? AND kod = 'AV124'").all(P).length).toBe(1);
    expect(KVA.AV124).toBe('Undersökning av potentiell donator');
    // Genomförd donation med organen, och utredningen ändras sedan inte.
    expect((await k.post(`/api/donation/${d.id}/avsluta`, { status: 'genomford' })).status).toBe(400);
    const a = await k.post(`/api/donation/${d.id}/avsluta`, { status: 'genomford', organ: ['njure', 'lever'] });
    expect(a.status).toBe(200);
    expect(a.data.kvalitetsregister.falt).toMatchObject({ utfall: 'Donation genomförd', organ: ['Njure', 'Lever'] });
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(409);
    expect(() => db(k).query('DELETE FROM donation_punkter').run()).toThrow();
    expect(() => db(k).query("UPDATE donationer SET status = 'pagar'").run()).toThrow();
    expect(() => db(k).query('DELETE FROM dodsfall').run()).toThrow();
  });

  test('donationsanteckningen skrivs av systemet ur checklistan, och läkaren signerar den', async () => {
    expect(MALLAR.find(m => m.typ === 'Donationsanteckning').sokord).toEqual(donation.MALL.sokord);
    for (const s of donation.MALL.sokord) expect(Object.hasOwn(SOKORD, s)).toBe(true);
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    const a = await k.post(`/api/donation/${d.id}/anteckning`);
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ typ: 'Donationsanteckning', status: 'utkast', kategori: 'lakare' });
    const s = Object.fromEntries(a.data.sokord.map(x => [x.sokord, x.text]));
    expect(s.Aktuellt).toContain('total hjärninfarkt');
    expect(s.Bedömning).toContain('Den medicinska bedömningen är inte gjord.');
    expect(s.Åtgärd).toBe('Kvar i checklistan: närstående informerade om dödsfallet och om donationen, medicinsk bedömning av lämpligheten, transplantationskoordinatorn kontaktad.');
    expect((await k.post(`/api/anteckning/${a.data.id}/signera`)).status).toBe(200);
    // Sjuksköterskan dokumenterar checklistan men skriver inte läkarens anteckning.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(200);
    expect((await k.post(`/api/donation/${d.id}/anteckning`)).status).toBe(403);
  });

  test('en transplantation ger bidiagnos ur ICD-10-SE och uppmärksamhetsinformationen föreslår transplantat', async () => {
    const k = await inloggad('lak-kard');
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'njure', datum: '2099-01-01' })).status).toBe(400);
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'constructor', datum: '2019-04-02' })).status).toBe(400);
    const t = await k.post('/api/patient/p01/transplantationer', { organ: 'njure', datum: '2019-04-02', centrum: 'Transplantationscentrum (demo)' });
    expect(t.status).toBe(201);
    expect(t.data.diagnos).toEqual({ kod: 'Z94.0', text: 'Njurtransplanterad' });
    expect(ICD10SE['Z94.0']).toBe('Njurtransplanterad');
    for (const o of Object.values(donation.ORGAN)) expect(ICD10SE[o.icd]).toBeTruthy();
    const h = (await k.get('/api/patient/p01')).data;
    expect(h.uppmarksamhet.forslag.some(f => f.undergrupp === 'transplantat')).toBe(true);
    const ov = (await k.get('/api/patient/p01/donation')).data;
    expect(ov.transplantationer[0]).toMatchObject({ organ: 'Njure', datum: '2019-04-02', diagnos: { kod: 'Z94.0' }, registreradAv: 'Sara Lindqvist' });
    // Sjuksköterskan registrerar ingen transplantation.
    somPerson(sandlada(app, k), 'ssk-kard');
    expect((await k.post('/api/patient/p01/transplantationer', { organ: 'lever', datum: '2019-04-02' })).status).toBe(403);
  });

  test('nyheterna om in- och utfarter, restjournaler, donation, mätvärden och uppmärksamhetsinformation gäller rätt roller', async () => {
    const nyheter = await import('../src/nyheter.js');
    const { nyDb, personal } = await import('./hjalp.js');
    const d = nyDb();
    const ids = (id) => { const p = personal(d, id); return nyheter.nyheter(d, { personal: p, invanare: null }).alla.flatMap(v => v.nyheter.map(n => n.id)); };
    expect(ids('lak-kard')).toEqual(expect.arrayContaining(['r10r4-infarter', 'r10r4-restjournaler', 'r10r4-donation', 'r10r4-matvarden', 'r10r4-uppmarksamhet']));
    expect(ids('ssk-kard')).toEqual(expect.arrayContaining(['r10r4-infarter', 'r10r4-restjournaler', 'r10r4-donation']));
    expect(ids('ssk-kard')).not.toContain('r10r4-uppmarksamhet');
    expect(ids('usk-kard')).not.toContain('r10r4-donation');
    expect(ids('adm-kard')).toEqual(expect.arrayContaining(['r10r4-restjournaler']));
    expect(ids('adm-kard')).not.toContain('r10r4-infarter');
    const versioner = nyheter.NYHETER.filter(v => v.nyheter.some(n => n.id.startsWith('r10r4-')));
    expect(versioner.map(v => v.version)).toEqual([nyheter.AKTUELL]);
  });

  test('behörighet: fel roll, fel vårdenhet och spärr, och tidslinjen visar bara det som får ses', async () => {
    const k = await pagIva();
    await dod(k);
    const d = (await k.post(`/api/patient/${P}/donation`)).data;
    const ov = (await k.get(`/api/patient/${P}/oversikt`)).data;
    const tl = ov.tidslinje.filter(t => ['dodsfall', 'donation'].includes(t.typ)).map(t => t.rubrik);
    expect(tl.length).toBe(2);
    expect(tl).toEqual(expect.arrayContaining(['Dödsfall', 'Donationsutredning startad']));
    // Vårdadministratören läser inte donationen.
    somPerson(sandlada(app, k), 'adm-kard');
    expect((await k.get(`/api/patient/${P}/donation`)).status).toBe(403);
    // Utan vårdrelation är svaret detsamma som för en utredning som inte finns.
    somPerson(sandlada(app, k), 'lak-psyk');
    const nej = await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' });
    expect(nej.status).toBe(404);
    expect(nej.data).toEqual((await k.post('/api/donation/99999/punkt', { punkt: 'narstaende', status: 'klar' })).data);
    // Läkaren på vårdcentralen har vårdrelation men ser inte hjärtintensivens donation utan aktivt val, och ändrar den aldrig.
    somPerson(sandlada(app, k), 'lak-vc');
    const vc = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(vc.donationer).toEqual([]);
    expect(vc.dodsfall).toBeNull();
    expect(vc.dolda.kraverVal).toBeGreaterThan(0);
    expect(vc.forslag).toBeNull();
    expect(JSON.stringify((await k.get(`/api/patient/${P}/oversikt`)).data.tidslinje)).not.toContain('Dödsfall');
    await k.post(`/api/patient/${P}/val`, { typ: 'andra_enheter', syfte: 'Vården av patienten' });
    expect((await k.get(`/api/patient/${P}/donation`)).data.donationer.length).toBe(1);
    expect((await k.post(`/api/donation/${d.id}/punkt`, { punkt: 'narstaende', status: 'klar' })).status).toBe(403);
    // Med en spärr för kardiologen syns varken dödsfallet eller utredningen, inte heller efter aktivt val.
    db(k).query(`INSERT INTO sparrar (patient_id, enhet_id, registrerad, aktiv) VALUES ('${P}', 'uso-kard', ?, 1)`).run(new Date().toISOString());
    const sp = (await k.get(`/api/patient/${P}/donation`)).data;
    expect(sp.donationer).toEqual([]);
    expect(sp.dodsfall).toBeNull();
    expect(sp).toMatchObject({ forslag: null, kanRegistreraDodsfall: false, vilja: [] });
    // Svaret är detsamma som för en patient som aldrig har vårdats på intensivvården.
    const { dolda: _d1, ...utan } = sp;
    const { dolda: _d2, ...annan } = (await k.get('/api/patient/p01/donation')).data;
    expect(JSON.stringify(utan)).toBe(JSON.stringify(annan));
    expect(JSON.stringify((await k.get(`/api/patient/${P}/oversikt`)).data.tidslinje)).not.toMatch(/Dödsfall|Donationsutredning/);
  });
});
