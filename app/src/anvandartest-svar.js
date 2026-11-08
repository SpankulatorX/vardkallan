// Svaren från riktiga användartester av Vårdkällan (runda 7, r1): SUS efter ett testfall (mätning 3) och
// expertgranskning mot ISO 9241-110 (mätning 4) enligt Sussas modell i Bilaga F1:2. Svaren sparas på servern i en egen
// databas som alla sandlådor delar och som inte återställs med demon.
//
// Testtillfällen. Testledaren (uppföljningsrollen) skapar ett testtillfälle och får en slumpad kod med 192 bitar, som
// visas en gång och bara sparas som sha256. Ett svar sparas bara med en giltig kod och knyts till tillfället, och
// läsning, export och radering kräver både rollen och koden för just det tillfället. Ingen ser alltså andras tillfällen,
// också i den publika demon där vem som helst kan logga in som uppföljningsrollen.
//
// Gränser. Högst MAX_PER_TILLFALLE svar per tillfälle och MAX_PER_MINUT svar per session och minut. Ett fullt tillfälle
// stoppar bara sig självt. Varje session skapar högst MAX_SKAPA_PER_TIMME tillfällen per timme och varje skapare
// (klientens adress, sparad som en hash) har högst MAX_AKTIVA_PER_SKAPARE aktiva tillfällen, så att ingen ensam kan
// fylla taket på MAX_TILLFALLEN, som bara är en sista säkerhetsgräns. Ett tomt tillfälle utan svar raderas efter
// TOMT_TIMMAR timmar och ett tillfälle utan aktivitet efter GALLRING_DAGAR dagar, med sina svar.
//
// Inga patientuppgifter och inget namn sparas: bara roll i testet, en pseudonym som testledaren sätter, datum, testfall
// och svaren. En pseudonym eller kommentar som liknar ett personnummer eller ett datum tas inte emot, och andra fält i
// anropet sparas inte. Poängen räknar servern.
import { Database } from 'bun:sqlite';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { TESTFALL } from './sussa-testfall.js';
import { susPoang, expertpoang, utvarderingspoang, DIALOGPRINCIPER, PRINCIPPOANG, kodGiltig, kommentarGiltig, SPARAS, TESTROLLER as ROLLER, GALLRING_DAGAR } from '../public/js/sussa-formular.js';

// Det som sparas och rollerna i testet står i public/js/sussa-formular.js, så att sidan visar samma sak innan någon svarar.
export { SPARAS, ROLLER, GALLRING_DAGAR };
export const MAX_PER_TILLFALLE = 200;
export const MAX_PER_MINUT = 10;
export const MAX_SKAPA_PER_TIMME = 5;
export const MAX_AKTIVA_PER_SKAPARE = 20;
export const TOMT_TIMMAR = 24;
export const MAX_TILLFALLEN = 2000;
const DAG = 86400_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS anvandartest_tillfallen (
  id TEXT PRIMARY KEY, kod_hash TEXT NOT NULL UNIQUE, skapad TEXT NOT NULL, senast_aktiv TEXT NOT NULL, skapare TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS anvandartest_svar (
  id INTEGER PRIMARY KEY, tillfalle_id TEXT NOT NULL, typ TEXT NOT NULL CHECK (typ IN ('sus', 'expert')), roll TEXT NOT NULL, pseudonym TEXT NOT NULL,
  datum TEXT NOT NULL, testfall TEXT NOT NULL, svar TEXT NOT NULL, poang REAL NOT NULL, utvarderingspoang INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_anvandartest_svar_tillfalle ON anvandartest_svar (tillfalle_id);
`;

export function oppna(fil = ':memory:') {
  const db = new Database(fil, { create: true });
  // En databas från före testtillfällena har svar utan tillfälle, som ingen kan läsa. Tabellen byggs om.
  const kol = db.query("SELECT name FROM pragma_table_info('anvandartest_svar')").all().map(k => k.name);
  if (kol.length && !kol.includes('tillfalle_id')) db.exec('DROP TABLE anvandartest_svar');
  db.exec(SCHEMA);
  // Kolumnen för skaparen kom efter tillfällena.
  if (!db.query("SELECT name FROM pragma_table_info('anvandartest_tillfallen')").all().some(k => k.name === 'skapare')) db.exec("ALTER TABLE anvandartest_tillfallen ADD COLUMN skapare TEXT NOT NULL DEFAULT ''");
  return db;
}

const hash = (kod) => createHash('sha256').update(String(kod)).digest('hex');
// Skaparen sparas som en HMAC med en hemlig nyckel, så att den lagrade adressen inte går att räkna fram ur hashen.
// Nyckeln kommer från ANVANDARTEST_NYCKEL, annars slumpas den när servern startar (taket per skapare börjar då om).
const SKAPARNYCKEL = process.env.ANVANDARTEST_NYCKEL || randomBytes(32).toString('hex');
// En IPv6-adress räknas per /64-nät, eftersom en och samma klient har många adresser i sitt nät.
export function adressGrupp(adress) {
  const a = String(adress ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = a.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (!a.includes(':')) return a;
  const [fore, efter = ''] = a.split('::');
  const f = fore ? fore.split(':') : [];
  const e = a.includes('::') ? (efter ? efter.split(':') : []) : [];
  const delar = a.includes('::') ? [...f, ...Array(Math.max(0, 8 - f.length - e.length)).fill('0'), ...e] : f;
  return `${delar.slice(0, 4).map(x => (x || '0').replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
const skaparId = (adress) => createHmac('sha256', SKAPARNYCKEL).update(`skapare:${adressGrupp(adress)}`).digest('hex');
const datumSv = (nu) => nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const ut = (r) => ({ id: r.id, typ: r.typ, roll: r.roll, pseudonym: r.pseudonym, datum: r.datum, testfall: r.testfall, svar: JSON.parse(r.svar), poang: r.poang, utvarderingspoang: r.utvarderingspoang });
const fel = (text, falt) => new Fel(400, text, 'ogiltig', { falt });
const tillfalleUt = (t) => ({ id: t.id, skapad: t.skapad, senastAktiv: t.senast_aktiv, raderas: datumSv(new Date(Date.parse(t.senast_aktiv) + GALLRING_DAGAR * DAG)) });

// Raderar tillfällen utan aktivitet på GALLRING_DAGAR dagar, med deras svar.
// Raderar också tomma tillfällen utan svar som är äldre än TOMT_TIMMAR timmar.
export function stada(db, { nu = new Date() } = {}) {
  const grans = new Date(nu.getTime() - GALLRING_DAGAR * DAG).toISOString();
  const tomGrans = new Date(nu.getTime() - TOMT_TIMMAR * 3600_000).toISOString();
  const gamla = db.query(`SELECT id FROM anvandartest_tillfallen t WHERE senast_aktiv < ?
    OR (skapad < ? AND NOT EXISTS (SELECT 1 FROM anvandartest_svar s WHERE s.tillfalle_id = t.id))`).all(grans, tomGrans).map(r => r.id);
  let antalSvar = 0;
  db.transaction(() => {
    for (const id of gamla) {
      antalSvar += db.query('DELETE FROM anvandartest_svar WHERE tillfalle_id = ?').run(id).changes;
      db.query('DELETE FROM anvandartest_tillfallen WHERE id = ?').run(id);
    }
  })();
  return { tillfallen: gamla.length, svar: antalSvar };
}

// Ett nytt testtillfälle. Koden lämnas ut här och aldrig igen.
// session är ett objekt per inloggning och skapare klientens adress, som bara sparas som en hash.
export function skapaTillfalle(db, { nu = new Date(), session = {}, skapare = 'okänd' } = {}) {
  stada(db, { nu });
  const ms = nu.getTime();
  session.anvandartestTillfallen = (session.anvandartestTillfallen ?? []).filter(x => x > ms - 3600_000);
  if (session.anvandartestTillfallen.length >= MAX_SKAPA_PER_TIMME) throw new Fel(429, `Högst ${MAX_SKAPA_PER_TIMME} nya testtillfällen per timme. Vänta en stund, eller använd ett tillfälle som du redan har.`, 'for_manga');
  const skaparHash = skaparId(skapare);
  if (db.query('SELECT count(*) AS n FROM anvandartest_tillfallen WHERE skapare = ?').get(skaparHash).n >= MAX_AKTIVA_PER_SKAPARE) throw new Fel(429, `Du har redan ${MAX_AKTIVA_PER_SKAPARE} aktiva testtillfällen. Radera ett som inte används. Tomma tillfällen raderas av sig själva efter ${TOMT_TIMMAR} timmar.`, 'for_manga');
  if (db.query('SELECT count(*) AS n FROM anvandartest_tillfallen').get().n >= MAX_TILLFALLEN) throw new Fel(400, 'Det finns redan för många testtillfällen. Vänta tills gamla tillfällen raderas.', 'ogiltig');
  session.anvandartestTillfallen.push(ms);
  const kod = randomBytes(24).toString('base64url');
  const id = `T-${randomBytes(6).toString('hex')}`;
  const t = nu.toISOString();
  db.query('INSERT INTO anvandartest_tillfallen (id, kod_hash, skapad, senast_aktiv, skapare) VALUES (?, ?, ?, ?, ?)').run(id, hash(kod), t, t, skaparHash);
  return { ...tillfalleUt(db.query('SELECT * FROM anvandartest_tillfallen WHERE id = ?').get(id)), kod };
}

// Tillfället för en kod. En saknad eller felaktig kod ger samma svar som ett raderat tillfälle.
function tillfalleFor(db, kod) {
  const t = typeof kod === 'string' && kod.length >= 22 && kod.length <= 100 ? db.query('SELECT * FROM anvandartest_tillfallen WHERE kod_hash = ?').get(hash(kod)) : null;
  if (!t) throw new Fel(403, 'Koden för testtillfället saknas eller gäller inte. Fråga testledaren efter koden.', 'nekad');
  return t;
}

// Sparar ett svar. Bara fälten kod, typ, roll, pseudonym, testfall och svar läses ur anropet. session är ett objekt per
// inloggning, där tiderna för de senaste svaren hålls för gränsen per minut.
export function spara(db, body = {}, { nu = new Date(), session = {} } = {}) {
  const t = tillfalleFor(db, body.kod);
  const { typ, roll, pseudonym, testfall } = body;
  if (!['sus', 'expert'].includes(typ)) throw fel('Välj SUS eller expertgranskning.', ['typ']);
  if (!ROLLER.includes(roll)) throw fel('Välj rollen i testet ur listan.', ['roll']);
  if (!kodGiltig(pseudonym)) throw fel('Pseudonymen ska vara en kort kod med bokstäver och siffror, till exempel L03. Sex siffror i rad tas inte emot, så att inget personnummer sparas.', ['pseudonym']);
  if (testfall !== 'alla' && !TESTFALL.some(x => x.nr === testfall)) throw fel('Välj ett av Sussas testfall, eller alla testfall.', ['testfall']);
  let svar;
  let p;
  if (typ === 'sus') {
    svar = Array.isArray(body.svar) ? body.svar.map(Number) : null;
    const poang = susPoang(svar);
    if (poang == null) throw fel('Svara på alla tio påståenden med 1 till 5.', ['svar']);
    p = { poang, utvarderingspoang: utvarderingspoang('tillfredsstallelse', poang) };
  } else {
    const rader = Array.isArray(body.svar) ? body.svar : [];
    if (rader.length !== DIALOGPRINCIPER.length || !rader.every((r, i) => r && Number(r.nr) === i + 1 && PRINCIPPOANG.includes(Number(r.poang)))) throw fel('Ge 10, 5, 2 eller 0 poäng för alla sju dialogprinciper.', ['svar']);
    svar = rader.map((r, i) => ({ nr: i + 1, namn: DIALOGPRINCIPER[i].namn, poang: Number(r.poang), kommentar: typeof r.kommentar === 'string' ? r.kommentar.trim() : '' }));
    if (!svar.every(r => kommentarGiltig(r.kommentar))) throw fel('En kommentar ser ut att innehålla ett personnummer eller ett datum. Skriv inga patientuppgifter.', ['svar']);
    const e = expertpoang(svar.map(r => r.poang));
    p = { poang: e.summa, utvarderingspoang: e.poang };
  }
  const ms = nu.getTime();
  session.anvandartestSvar = (session.anvandartestSvar ?? []).filter(x => x > ms - 60_000);
  if (session.anvandartestSvar.length >= MAX_PER_MINUT) throw new Fel(429, `Högst ${MAX_PER_MINUT} svar per minut. Vänta en stund och försök igen.`, 'for_manga');
  if (db.query('SELECT count(*) AS n FROM anvandartest_svar WHERE tillfalle_id = ?').get(t.id).n >= MAX_PER_TILLFALLE) throw new Fel(400, `Testtillfället är fullt med ${MAX_PER_TILLFALLE} svar. Testledaren kan skapa ett nytt tillfälle.`, 'ogiltig');
  session.anvandartestSvar.push(ms);
  const id = Number(db.query('INSERT INTO anvandartest_svar (tillfalle_id, typ, roll, pseudonym, datum, testfall, svar, poang, utvarderingspoang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(t.id, typ, roll, pseudonym, datumSv(nu), testfall, JSON.stringify(svar), p.poang, p.utvarderingspoang).lastInsertRowid);
  db.query('UPDATE anvandartest_tillfallen SET senast_aktiv = ? WHERE id = ?').run(nu.toISOString(), t.id);
  return ut(db.query('SELECT * FROM anvandartest_svar WHERE id = ?').get(id));
}

// Svaren i ett tillfälle, med sammanställningen enligt Bilaga F1:2.
export function lista(db, kod) {
  const t = tillfalleFor(db, kod);
  const svar = db.query('SELECT * FROM anvandartest_svar WHERE tillfalle_id = ? ORDER BY id').all(t.id).map(ut);
  const sus = svar.filter(s => s.typ === 'sus');
  const medel = sus.length ? Math.round((sus.reduce((a, s) => a + s.poang, 0) / sus.length) * 10) / 10 : null;
  const expert = svar.filter(s => s.typ === 'expert');
  const perRoll = {};
  for (const s of sus) perRoll[s.roll] = (perRoll[s.roll] ?? 0) + 1;
  return {
    tillfalle: { ...tillfalleUt(t), antalSvar: svar.length, maxSvar: MAX_PER_TILLFALLE }, sparas: SPARAS, svar,
    sammanstallning: {
      sus: { antal: sus.length, medel, utvarderingspoang: utvarderingspoang('tillfredsstallelse', medel), perRoll },
      expert: { antal: expert.length, senaste: expert.at(-1) ? { pseudonym: expert.at(-1).pseudonym, datum: expert.at(-1).datum, summa: expert.at(-1).poang, utvarderingspoang: expert.at(-1).utvarderingspoang } : null },
    },
  };
}

// Exporten av ett tillfälle som fil: JSON med allt eller CSV med en rad per svar. Koden följer inte med.
export function exportera(db, kod, format = 'json') {
  const l = lista(db, kod);
  const dag = datumSv(new Date());
  if (format === 'csv') {
    const cell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rader = ['id;typ;roll;pseudonym;datum;testfall;poäng;utvärderingspoäng;svar', ...l.svar.map(s => [s.id, s.typ, s.roll, s.pseudonym, s.datum, s.testfall, s.poang, s.utvarderingspoang, JSON.stringify(s.svar)].map(cell).join(';'))];
    return { text: `${rader.join('\n')}\n`, contentType: 'text/csv; charset=utf-8', namn: `anvandartester-${l.tillfalle.id}-${dag}.csv` };
  }
  return { text: `${JSON.stringify({ format: 'vardkallan-anvandartester', exporterad: new Date().toISOString(), ...l }, null, 2)}\n`, contentType: 'application/json; charset=utf-8', namn: `anvandartester-${l.tillfalle.id}-${dag}.json` };
}

// Raderar ett tillfälle med alla dess svar.
export function radera(db, kod) {
  const t = tillfalleFor(db, kod);
  let n = 0;
  db.transaction(() => {
    n = db.query('DELETE FROM anvandartest_svar WHERE tillfalle_id = ?').run(t.id).changes;
    db.query('DELETE FROM anvandartest_tillfallen WHERE id = ?').run(t.id);
  })();
  return { ok: true, raderadeSvar: n };
}
