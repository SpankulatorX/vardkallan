// Runda 13, r3: rättelser från det utforskande testet som inte har en egen testfil. Fyndets nummer står i testnamnet
// (E1, E2 och E3 är testarnas rapporter). Testnamnen används i kravregistret.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { byggSeed } from '../src/db.js';
import * as journal from '../src/journal.js';
import * as tidbok from '../src/tidbok.js';
import * as vardkontakt from '../src/vardkontakt.js';
import * as mt from '../src/medicinteknik.js';
import { atk, testserver, klient, sandlada } from './hjalp.js';
import * as logguppfoljning from '../src/logguppfoljning.js';

const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Fynd från det utforskande testet', () => {
  test('E1-23: bara den som skrev en signerad anteckning kan rätta den, och andra får veta att de skriver en ny anteckning', () => {
    const db = byggSeed();
    const a = journal.skapaAnteckning(atk(db, 'lak-kard', 'p01'), { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Mår bra.' }] });
    journal.signera(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id));
    const rattelse = { orsak: 'Fel dag', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre.' }] };
    // Överläkaren på samma klinik kan inte rätta kollegans anteckning.
    const e = fel(() => journal.ratta(atk(db, 'ol-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse));
    expect(e.status).toBe(403);
    expect(e.message).toContain('Bara Sara Lindqvist kan rätta anteckningen');
    expect(e.message).toContain('ny anteckning');
    // Den som skrev den kan.
    expect(journal.ratta(atk(db, 'lak-kard', 'p01'), journal.hamtaAnteckningRad(db, a.id), rattelse).version).toBe(2);
  });

  test('E1-26: hjälptexten i Sök patient visar inte personnumret för någon patient i demon', () => {
    const db = byggSeed();
    const text = readFileSync(new URL('../public/js/vyer/sok.js', import.meta.url), 'utf8');
    for (const p of db.query('SELECT personnummer FROM patienter').all()) {
      const pnr = p.personnummer;
      expect(text).not.toContain(pnr);
      expect(text).not.toContain(`${pnr.slice(0, 8)}-${pnr.slice(8)}`);
    }
  });

  test('E3-16: kallelsen har mottagningens telefonnummer och ingen intern rad om hur avgiften räknas', () => {
    const db = byggSeed();
    const t = db.query('SELECT id FROM tider ORDER BY start LIMIT 1').get();
    const mall = tidbok.kallelseText(db, { tid_id: t.id, patient_id: null, vantelista_id: null, vardkontakt_id: null }, 'kallelse');
    expect(mall).not.toContain('systemet räknar');
    expect(mall).toMatch(/ring mottagningen på 070-174 06 \d\d \(påhittat nummer i demon\)/);
    const b = db.query("SELECT * FROM bokningar WHERE status = 'bokad' AND patient_id IS NOT NULL LIMIT 1").get();
    expect(tidbok.kallelseText(db, b, 'kallelse')).toMatch(/070-174 06 \d\d/);
    expect(tidbok.kallelseText(db, b, 'paminnelse')).toMatch(/070-174 06 \d\d/);
  });

  test('E1-16: dokumentation utan besök blir en administrativ kontakt utan avgift, och den som dokumenterar ett besök väljer det', () => {
    const db = byggSeed();
    const a = atk(db, 'lak-vc', 'p11', {}, 'las_admin');
    // Anna Viklund har ingen pågående kontakt på vårdcentralen i dag.
    db.query("UPDATE vardkontakter SET slut = coalesce(slut, start) WHERE patient_id = 'p11'").run();
    const f = vardkontakt.aktuell(a);
    expect(f.vardkontakt).toBeNull();
    expect(f.ny).toMatchObject({ kontaktsatt: 'administrativ', plats: 'Administrativ kontakt' });
    const p = db.query("SELECT * FROM patienter WHERE id = 'p11'").get();
    const v = { id: 0, typ: 'oppenvard', kontaktsatt: 'administrativ', start: new Date().toISOString(), kalla: 'vardkallan' };
    expect(vardkontakt.avgiftFor(db, p, v).belopp).toBe(0);
    expect(vardkontakt.avgiftFor(db, p, { ...v, kontaktsatt: 'besok' }).belopp).toBeGreaterThan(0);
  });

  test('E3-38: ett blodtryck som inte är möjligt tas inte emot, och ett farligt värde ger råd om 1177 och 112', () => {
    expect(mt.radFor('blodtryck', '190/100', null)).toMatchObject({ niva: 'radgivning' });
    expect(mt.radFor('blodtryck', '190/100', null).text).toContain('1177');
    expect(mt.radFor('blodtryck', '190/100', null).text).toContain('112');
    expect(mt.radFor('saturation', '85', 85).niva).toBe('akut');
    expect(mt.radFor('blodtryck', '130/80', null)).toBeNull();
  });
});

describe('Läskopian i loggen (E3-28, E3-30, E3-36)', () => {
  let app;
  beforeAll(() => { app = testserver(); });
  afterAll(() => app.stopp());

  test('E3-28, E3-30, E3-36: läskopians automatiska rader skiljs från människors åtkomster, dras inte i stickprov och visas för patienten i klartext', async () => {
    const k = klient(app);
    await k.logga('adm-kard');
    // Läskopian lämnas ut när webbläsaren hämtar den efter inloggningen.
    expect((await k.get('/api/lasekopia')).status).toBe(200);
    const db = sandlada(app, k).db;
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE resurs IN ('lasekopia', 'lasekopia:slut')").get().n).toBeGreaterThan(0);
    await k.logga('logg');
    const l = (await k.get('/api/logg')).data;
    expect(l.automatiska).toBeGreaterThan(0);
    expect(l.rader.some(r => ['lasekopia', 'lasekopia:slut'].includes(r.resurs))).toBe(false);
    const alla = (await k.get('/api/logg?automatiska=visa')).data;
    expect(alla.rader.filter(r => r.automatisk).every(r => r.flaggad === false)).toBe(true);
    // Stickprovet drar bara åtkomster som en människa har gjort.
    const sp = logguppfoljning.dra(db, db.query("SELECT * FROM personal WHERE id = 'logg'").get(), { antal: 100 });
    const ids = db.query('SELECT logg_id FROM stickprov_rader WHERE stickprov_id = ?').all(sp.id ?? sp.stickprov?.id).map(r => r.logg_id);
    expect(ids.length).toBeGreaterThan(0);
    const ph = ids.map(() => '?').join(', ');
    expect(db.query(`SELECT count(*) AS n FROM atkomstlogg WHERE id IN (${ph}) AND resurs IN ('lasekopia', 'lasekopia:slut')`).get(...ids).n).toBe(0);
    // Patienten ser klartext, aldrig en intern kod, och läskopian märkt som automatisk.
    const m = klient(app);
    await m.post('/api/login/invanare', { invanareId: 'inv-p01' });
    sandlada(app, m).db = db;
    const rader = (await m.get('/api/min/journal/p01/logglista')).data.rader;
    for (const r of rader) expect(r.handlingText).not.toMatch(/^[a-z_]+$/);
    expect(rader.filter(r => r.via === 'laskopia').every(r => r.automatisk === true)).toBe(true);
  }, 30_000);
});

