// Runda 10, r1: skrivkön för arbete utan uppkoppling (skrivko.js, Sussa 2.3.1.4). Webbläsaren krypterar en given dos eller
// ett mätvärde med läskopians nyckel medan servern inte svarar, och skickar raden när förbindelsen är tillbaka. Här görs
// webbläsarens del med node:crypto, med samma format som public/js/lasekopia.js.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());
const logg = (k) => sandlada(app, k).db.query('SELECT * FROM atkomstlogg ORDER BY id').all();
const MIN = 60_000;

// Inloggning och läskopia, som när gränssnittet startar. Ger nyckeln och läskopians id.
async function medKopia(k, id = 'lak-kard') {
  await k.logga(id);
  const s = (await k.get('/api/session')).data;
  const kopia = (await k.get('/api/lasekopia')).data;
  return { nyckel: Buffer.from(s.lasnyckel.nyckel, 'base64url'), kopiaId: kopia.kopiaId, personalId: s.personal.id, kopia };
}
function krypterad(n, rad, { aadId = rad.id, personalId = n.personalId } = {}) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', n.nyckel, iv);
  c.setAAD(Buffer.from(`vardkallan-skrivko|${n.kopiaId}|${personalId}|${aadId}`));
  const data = Buffer.concat([c.update(JSON.stringify(rad), 'utf8'), c.final(), c.getAuthTag()]);
  return { id: rad.id, iv: iv.toString('base64url'), data: data.toString('base64url') };
}
const rad = (typ, data, { patientId = 'p01', gjord = new Date(Date.now() - 20 * MIN).toISOString() } = {}) => ({ id: randomUUID(), typ, patientId, gjord, data });
const skicka = (k, n, rader, extra = {}) => k.post('/api/skrivko', { kopiaId: n.kopiaId, rader, ...extra });
// En ordination vid behov som testet själv lägger in, så att testet inte beror på vilka dostider som har passerat i dag.
function vidBehov(db, pid = 'p01') {
  const lm = db.query("SELECT id FROM katalog WHERE atc = 'N02BE01' ORDER BY id LIMIT 1").get();
  const start = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  return Number(db.query("INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad) VALUES (?, 'uso-kard', ?, '1 g vid behov, högst 4 gånger per dygn', 1, 'vid_behov', 'Smärta', '2026-12-31', ?, 'lak-kard', ?) RETURNING id")
    .get(pid, lm.id, start, new Date(Date.now() - 2 * 86400_000).toISOString()).id);
}

describe('Skrivkön efter avbrott', () => {
  test('ett mätvärde och en dos från kön sparas med tiden då de gjordes, och en rad som skickas igen sparas inte två gånger', async () => {
    const k = klient(app);
    const n = await medKopia(k);
    const db = sandlada(app, k).db;
    const fore = db.query("SELECT COUNT(*) n FROM matvarden WHERE patient_id = 'p01'").get().n;
    const m = rad('matvarde', { typ: 'puls', varde: 82 });
    const r = await skicka(k, n, [krypterad(n, m)]);
    expect(r.status).toBe(200);
    expect(r.data.resultat[0]).toMatchObject({ id: m.id, status: 'sparad' });
    const sparad = db.query('SELECT * FROM matvarden WHERE id = ?').get(r.data.resultat[0].resultatId);
    expect(sparad).toMatchObject({ patient_id: 'p01', typ: 'puls', varde: '82', registrerad_av: 'lak-kard' });
    expect(sparad.tid).toBe(m.gjord);
    // Samma rad igen, till exempel när svaret inte kom fram, ger samma svar och ingen ny rad.
    const igen = await skicka(k, n, [krypterad(n, m)]);
    expect(igen.data.resultat[0]).toMatchObject({ status: 'sparad', resultatId: r.data.resultat[0].resultatId });
    expect(db.query("SELECT COUNT(*) n FROM matvarden WHERE patient_id = 'p01'").get().n).toBe(fore + 1);
    // En dos sparas som given vid tiden då den gavs, registrerad i efterhand.
    const oid = vidBehov(db);
    const gjord = new Date(Date.now() - 25 * MIN).toISOString();
    const dos = rad('dos', { ordinationId: oid }, { gjord });
    const g = await skicka(k, n, [krypterad(n, dos)]);
    expect([g.data.resultat[0].status, g.data.resultat[0].text]).toEqual(['sparad', expect.stringContaining('är sparad i journalen')]);
    const a = db.query('SELECT * FROM administreringar WHERE id = ?').get(g.data.resultat[0].resultatId);
    expect(a).toMatchObject({ status: 'given', utford_av: 'lak-kard', ordination_id: oid, efterhand: 1 });
    expect(a.tid).toBe(gjord);
    // Åtkomstloggen säger att registreringen gjordes under ett avbrott.
    const l = logg(k).filter(x => x.resurs?.startsWith('skrivko:'));
    expect(l.map(x => x.handling)).toEqual(['registrera_matvarde', 'ge_lakemedel']);
    expect(l.every(x => x.personal_id === 'lak-kard' && x.patient_id === 'p01' && x.syfte.startsWith('Registrerad under ett avbrott'))).toBe(true);
  });

  test('en dos som någon annan gav under avbrottet blir en konflikt som personen avgör, och ingen dos sparas två gånger', async () => {
    const k = klient(app);
    const n = await medKopia(k);
    const db = sandlada(app, k).db;
    const oid = vidBehov(db);
    // En kollega ger dosen medan läkarens dator inte når servern.
    const gjord = new Date(Date.now() - 3 * MIN).toISOString();
    const forst = rad('dos', { ordinationId: oid }, { gjord });
    expect((await skicka(k, n, [krypterad(n, forst)])).data.resultat[0].status).toBe('sparad');
    const dubbel = rad('dos', { ordinationId: oid }, { gjord: new Date(Date.now() - 2 * MIN).toISOString() });
    const r = await skicka(k, n, [krypterad(n, dubbel)]);
    const k1 = r.data.resultat[0];
    expect(k1).toMatchObject({ id: dubbel.id, status: 'konflikt', typ: 'dos' });
    expect(k1.varningar.map(v => v.regel)).toContain('dubbel_dos');
    expect(k1.kraverKvittens).toContain('dubbel_dos');
    const antal = () => db.query("SELECT COUNT(*) n FROM administreringar WHERE ordination_id = ? AND status = 'given'").get(oid).n;
    expect(antal()).toBe(1);
    // Dosen gavs inte en gång till: den tas bort ur kön, och inget sparas.
    const kastad = await skicka(k, n, [krypterad(n, dubbel)], { kasta: [dubbel.id] });
    expect(kastad.data.resultat[0].status).toBe('kastad');
    expect(antal()).toBe(1);
    // En annan rad för samma dos registreras ändå med motivering, när dosen faktiskt gavs två gånger.
    const tva = rad('dos', { ordinationId: oid }, { gjord: new Date(Date.now() - 1 * MIN).toISOString() });
    expect((await skicka(k, n, [krypterad(n, tva)])).data.resultat[0].status).toBe('konflikt');
    const kv = await skicka(k, n, [krypterad(n, tva)], { kvitteringar: { [tva.id]: [{ regel: 'dubbel_dos', motivering: 'Dosen gavs av två personer under avbrottet. Läkaren är informerad.' }] } });
    expect(kv.data.resultat[0].status).toBe('sparad');
    expect(antal()).toBe(2);
  });

  test('kön tas bara emot från den som gjorde registreringarna, med en rad som är krypterad med läskopians nyckel och inom läskopians giltighet', async () => {
    const k = klient(app);
    const n = await medKopia(k);
    const m = rad('matvarde', { typ: 'puls', varde: 70 });
    // Ändrad rad, fel id i det skyddade fältet, okänd typ, patient utanför läskopian och tider utanför giltigheten.
    const andrad = krypterad(n, m);
    const b = Buffer.from(andrad.data, 'base64url'); b[0] ^= 1;
    const fall = [
      [{ ...andrad, data: b.toString('base64url') }, 'kunde inte verifieras'],
      [krypterad(n, m, { aadId: 'annat-id-123' }), 'kunde inte verifieras'],
      [krypterad(n, rad('anteckning', { text: 'Prov' })), 'Bara givna doser och mätvärden'],
      [krypterad(n, rad('matvarde', { typ: 'puls', varde: 70 }, { patientId: 'p12' })), 'fanns inte i din läskopia'],
      [krypterad(n, rad('matvarde', { typ: 'puls', varde: 70 }, { gjord: new Date(Date.now() + 60 * MIN).toISOString() })), 'utanför läskopians giltighet'],
      [krypterad(n, rad('matvarde', { typ: 'puls', varde: 70 }, { gjord: new Date(Date.now() - 9 * 60 * MIN).toISOString() })), 'utanför läskopians giltighet'],
      [krypterad(n, rad('matvarde', { typ: 'puls', varde: 900 })), 'Puls måste vara ett tal'],
    ];
    expect(Object.keys(n.kopia.patienter)).not.toContain('p12');
    const r = await skicka(k, n, fall.map(f => f[0]));
    r.data.resultat.forEach((x, i) => expect([i, x.status, x.text]).toEqual([i, 'avvisad', expect.stringContaining(fall[i][1])]));
    // En annan person i en annan webbläsare kan inte skicka läkarens kö, och inte heller med läkarens nyckel.
    const s = klient(app);
    await s.logga('ssk-kard');
    const fr = await s.post('/api/skrivko', { kopiaId: n.kopiaId, rader: [krypterad(n, rad('matvarde', { typ: 'puls', varde: 70 }))] });
    expect(fr.status).toBe(404);
    // En ny inloggning som en annan person i samma webbläsare kan inte heller skicka den.
    await k.logga('ssk-kard');
    expect((await skicka(k, n, [krypterad(n, rad('matvarde', { typ: 'puls', varde: 70 }))])).status).toBe(404);
    expect((await k.post('/api/skrivko', { kopiaId: 'x', rader: [] })).status).toBe(400);
  });

  test('läskopian har mätvärdena och remisserna för patienterna, för de roller som får läsa dem', async () => {
    const k = klient(app);
    const n = await medKopia(k);
    const p = n.kopia.patienter.p01;
    expect(p.journaldel.delar).toEqual({ matvarden: 'las_matvarden', remisser: 'las_remiss' });
    expect(p.matvarden.matvarden.length).toBeGreaterThan(0);
    expect(Array.isArray(p.remisser.remisser ?? p.remisser)).toBe(true);
    const adm = await medKopia(klient(app), 'adm-kard');
    const ap = Object.values(adm.kopia.patienter)[0];
    expect(ap?.matvarden ?? null).toBeNull();
  });
});
