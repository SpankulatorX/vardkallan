// Svaren från riktiga användartester av Vårdkällan (runda 7, r1): SUS efter ett testfall (mätning 3) och
// expertgranskning mot ISO 9241-110 (mätning 4) enligt Sussas modell i Bilaga F1:2. Svaren sparas på servern i en egen
// tabell, i en egen databas som alla sandlådor delar och som inte återställs med demon. Inga patientuppgifter och inget
// namn sparas: bara testpersonens roll i testet, en pseudonym som testledaren sätter, datum, testfall och svaren. En
// pseudonym eller kommentar som liknar ett personnummer eller ett datum tas inte emot, och andra fält i anropet sparas
// inte. Poängen räknar servern. Bara testledaren, uppföljningsrollen, läser och exporterar svaren (anvandartest_las).
import { Database } from 'bun:sqlite';
import { Fel } from './db.js';
import { TESTFALL } from './sussa-testfall.js';
import { susPoang, expertpoang, utvarderingspoang, DIALOGPRINCIPER, PRINCIPPOANG, kodGiltig, kommentarGiltig, SPARAS, TESTROLLER as ROLLER } from '../public/js/sussa-formular.js';

// Det som sparas och rollerna i testet står i public/js/sussa-formular.js, så att sidan visar samma sak innan någon svarar.
export { SPARAS, TESTROLLER as ROLLER } from '../public/js/sussa-formular.js';
export const MAX_SVAR = 10000;

const SCHEMA = `CREATE TABLE IF NOT EXISTS anvandartest_svar (
  id INTEGER PRIMARY KEY, typ TEXT NOT NULL CHECK (typ IN ('sus', 'expert')), roll TEXT NOT NULL, pseudonym TEXT NOT NULL,
  datum TEXT NOT NULL, testfall TEXT NOT NULL, svar TEXT NOT NULL, poang REAL NOT NULL, utvarderingspoang INTEGER NOT NULL
)`;

export function oppna(fil = ':memory:') {
  const db = new Database(fil, { create: true });
  db.exec(SCHEMA);
  return db;
}

const datumSv = (nu) => nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const ut = (r) => ({ id: r.id, typ: r.typ, roll: r.roll, pseudonym: r.pseudonym, datum: r.datum, testfall: r.testfall, svar: JSON.parse(r.svar), poang: r.poang, utvarderingspoang: r.utvarderingspoang });
const fel = (text, falt) => new Fel(400, text, 'ogiltig', { falt });

// Sparar ett svar. Bara fälten typ, roll, pseudonym, testfall och svar läses ur anropet.
export function spara(db, body = {}, { nu = new Date() } = {}) {
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
  if (db.query('SELECT count(*) AS n FROM anvandartest_svar').get().n >= MAX_SVAR) throw new Fel(400, 'Lagringen för användartester är full. Exportera svaren och rensa lagringen först.', 'ogiltig');
  const id = Number(db.query('INSERT INTO anvandartest_svar (typ, roll, pseudonym, datum, testfall, svar, poang, utvarderingspoang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(typ, roll, pseudonym, datumSv(nu), testfall, JSON.stringify(svar), p.poang, p.utvarderingspoang).lastInsertRowid);
  return ut(db.query('SELECT * FROM anvandartest_svar WHERE id = ?').get(id));
}

export function lista(db) {
  const svar = db.query('SELECT * FROM anvandartest_svar ORDER BY id').all().map(ut);
  const sus = svar.filter(s => s.typ === 'sus');
  const medel = sus.length ? Math.round((sus.reduce((a, s) => a + s.poang, 0) / sus.length) * 10) / 10 : null;
  const expert = svar.filter(s => s.typ === 'expert');
  const perRoll = {};
  for (const s of sus) perRoll[s.roll] = (perRoll[s.roll] ?? 0) + 1;
  return {
    sparas: SPARAS, svar,
    sammanstallning: {
      sus: { antal: sus.length, medel, utvarderingspoang: utvarderingspoang('tillfredsstallelse', medel), perRoll },
      expert: { antal: expert.length, senaste: expert.at(-1) ? { pseudonym: expert.at(-1).pseudonym, datum: expert.at(-1).datum, summa: expert.at(-1).poang, utvarderingspoang: expert.at(-1).utvarderingspoang } : null },
    },
  };
}

// Exporten som fil: JSON med allt eller CSV med en rad per svar.
export function exportera(db, format = 'json') {
  const l = lista(db);
  const dag = datumSv(new Date());
  if (format === 'csv') {
    const cell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rader = ['id;typ;roll;pseudonym;datum;testfall;poäng;utvärderingspoäng;svar', ...l.svar.map(s => [s.id, s.typ, s.roll, s.pseudonym, s.datum, s.testfall, s.poang, s.utvarderingspoang, JSON.stringify(s.svar)].map(cell).join(';'))];
    return { text: `${rader.join('\n')}\n`, contentType: 'text/csv; charset=utf-8', namn: `anvandartester-${dag}.csv` };
  }
  return { text: `${JSON.stringify({ format: 'vardkallan-anvandartester', exporterad: new Date().toISOString(), ...l }, null, 2)}\n`, contentType: 'application/json; charset=utf-8', namn: `anvandartester-${dag}.json` };
}
