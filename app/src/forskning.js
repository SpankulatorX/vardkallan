// Runda 9, r7: beställningar av datauttag till forskare (Sussa 6.3.3.1, H i figur 1 i kravspecifikationen).
//
// Ett ärende per beställning: forskaren, studien, diarienumret för etikprövningen, urvalet av tabeller och fält ur
// datauttaget (datauttag.js), perioden och om uttaget är en gång eller återkommande i en löpande studie. Systemet ger
// ärendet ett diarienummer, kontrollerar diarienumret för etikprövningen, tar själv med patientens pseudonym när en
// tabell har den (så att tabellerna går att koppla ihop) och lägger aldrig till något som inte finns i datauttaget:
// inga namn, personnummer, adresser eller fritext.
//
// Godkännande av två personer: arkivarien gör sekretessprövningen och verksamhetschefen godkänner för den verksamhet som
// ansvarar för uppgifterna. Beställningen anger vilka vårdenheter den omfattar, en verksamhetschef godkänner bara för
// sin egen vårdenhet, och uttaget får bara med uppgifter från de vårdenheter vars verksamhetschef har godkänt. Den som registrerade beställningen kan inte godkänna den, och ingen godkänner två gånger.
// Först med två godkännanden kan uttaget lämnas ut. Varje utlämnande sparas med tid, vem, antal rader och en
// kontrollsumma över innehållet, loggas och kan inte ändras eller raderas. Pseudonymerna räknas med en nyckel för
// beställningen, så att de inte går att koppla till uppföljningens uttag eller till en annan studie, men är desamma i
// varje utlämnande av samma beställning, så att en löpande studie kan följa samma patient.
//
// Det som saknas: patientens medgivande per uttag och en allmän hantering av medgivanden, leverans till forskaren på
// annat sätt än som fil, och aggregeringar.
import { createHash, randomBytes } from 'node:crypto';
import { Fel, iso, idag } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as datauttag from './datauttag.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS forskningsbestallningar (
  id INTEGER PRIMARY KEY, diarienummer TEXT NOT NULL UNIQUE, titel TEXT NOT NULL, forskare TEXT NOT NULL, organisation TEXT NOT NULL,
  etikprovning TEXT NOT NULL, urval TEXT NOT NULL, vardenheter TEXT NOT NULL, period_fran TEXT, period_till TEXT, aterkommande INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'registrerad', registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, enhet_id TEXT NOT NULL, nyckel TEXT NOT NULL,
  CHECK (status IN ('registrerad', 'godkand', 'avslagen', 'utlamnad'))
);
-- Innehållet i en beställning ändras inte efter registreringen. Bara statusen ändras, och bara framåt.
CREATE TRIGGER IF NOT EXISTS forskningsbestallning_innehall BEFORE UPDATE OF diarienummer, titel, forskare, organisation, etikprovning, urval, vardenheter, period_fran, period_till, aterkommande, registrerad, registrerad_av, nyckel ON forskningsbestallningar
  BEGIN SELECT RAISE(ABORT, 'En beställning av forskningsuttag ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS forskningsbestallning_raderas_ej BEFORE DELETE ON forskningsbestallningar BEGIN SELECT RAISE(ABORT, 'En beställning av forskningsuttag raderas inte'); END;
CREATE TABLE IF NOT EXISTS forskningsbeslut (
  id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, personal_id TEXT NOT NULL, roll TEXT NOT NULL, vardenhet TEXT, beslut TEXT NOT NULL, motivering TEXT, tid TEXT NOT NULL,
  UNIQUE (bestallning_id, personal_id), CHECK (beslut IN ('godkand', 'avslagen'))
);
CREATE TRIGGER IF NOT EXISTS forskningsbeslut_andras_ej BEFORE UPDATE ON forskningsbeslut BEGIN SELECT RAISE(ABORT, 'Ett beslut ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS forskningsbeslut_raderas_ej BEFORE DELETE ON forskningsbeslut BEGIN SELECT RAISE(ABORT, 'Ett beslut raderas inte'); END;
CREATE TABLE IF NOT EXISTS forskningsutlamnanden (
  id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, enhet_id TEXT NOT NULL, antal TEXT NOT NULL, sha256 TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS forskningsutlamnande_andras_ej BEFORE UPDATE ON forskningsutlamnanden BEGIN SELECT RAISE(ABORT, 'Ett utlämnande ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS forskningsutlamnande_raderas_ej BEFORE DELETE ON forskningsutlamnanden BEGIN SELECT RAISE(ABORT, 'Ett utlämnande raderas inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }

const MAX_OPPNA = 50;
const ROLL = { arkivarie: 'Sekretessprövning', verksamhetschef: 'Godkännande för verksamheten' };

function krav(db, personal, handling, resurs) {
  if (kanRoll(personal, handling)) return;
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling, resurs, grund: 'nekad', resultat: 'nekad' });
  throw new Fel(403, 'Yrkesrollen får inte hantera forskningsuttag.', 'nekad');
}
const kanSe = (p) => kanRoll(p, 'forskning_bestall') || kanRoll(p, 'forskning_godkann');

// Urvalet: tabeller och fält ur datauttaget. Systemet tar med radnyckeln och patientens pseudonym när tabellen har dem.
export function provaUrval(urval) {
  if (!urval || typeof urval !== 'object' || Array.isArray(urval) || !Object.keys(urval).length) throw new Fel(400, 'Välj minst en tabell ur datauttaget.', 'ogiltig', { falt: ['urval'] });
  const ut = {};
  for (const [t, falt] of Object.entries(urval)) {
    if (!Object.hasOwn(datauttag.SCHEMA, t)) throw new Fel(400, `Tabellen ${t} finns inte i datauttaget. Välj bland ${datauttag.TYPER.join(', ')}.`, 'ogiltig', { falt: ['urval'] });
    if (!Array.isArray(falt) || !falt.length) throw new Fel(400, `Välj minst ett fält i tabellen ${t}.`, 'ogiltig', { falt: ['urval'] });
    const finns = datauttag.SCHEMA[t].falt;
    for (const f of falt) if (!Object.hasOwn(finns, f)) throw new Fel(400, `Fältet ${f} finns inte i tabellen ${t}.`, 'ogiltig', { falt: ['urval'] });
    ut[t] = [...new Set([...['rad', 'patient'].filter(f => Object.hasOwn(finns, f)), ...falt])];
  }
  return ut;
}

const text = (s, max, namn) => {
  const t = typeof s === 'string' ? s.trim() : '';
  if (t.length < 2) throw new Fel(400, `Ange ${namn}.`, 'ogiltig', { falt: [namn] });
  if (t.length > max) throw new Fel(400, `${namn[0].toUpperCase()}${namn.slice(1)} får vara högst ${max} tecken.`, 'ogiltig', { falt: [namn] });
  return t;
};

function rad(db, id) {
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM forskningsbestallningar WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Beställningen finns inte.', 'saknas');
  return r;
}
const namnPa = (db, id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null;
function ut(db, r) {
  const beslut = db.query('SELECT * FROM forskningsbeslut WHERE bestallning_id = ? ORDER BY tid, id').all(r.id);
  const utl = db.query('SELECT * FROM forskningsutlamnanden WHERE bestallning_id = ? ORDER BY tid, id').all(r.id);
  const godk = beslut.filter(b => b.beslut === 'godkand');
  const saknas = Object.keys(ROLL).filter(roll => !godk.some(b => b.roll === roll));
  const enhetNamn = (id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
  return {
    id: r.id, diarienummer: r.diarienummer, titel: r.titel, forskare: r.forskare, organisation: r.organisation, etikprovning: r.etikprovning,
    urval: JSON.parse(r.urval), vardenheter: JSON.parse(r.vardenheter).map(enhetNamn),
    godkandaVardenheter: godk.filter(b => b.roll === 'verksamhetschef').map(b => enhetNamn(b.vardenhet)), period: r.period_fran ? { fran: r.period_fran, till: r.period_till } : null, aterkommande: Boolean(r.aterkommande), status: r.status,
    registrerad: r.registrerad, registreradAv: namnPa(db, r.registrerad_av),
    beslut: beslut.map(b => ({ av: namnPa(db, b.personal_id), roll: ROLL[b.roll] ?? b.roll, beslut: b.beslut, motivering: b.motivering, tid: b.tid })),
    vantarPa: r.status === 'registrerad' ? saknas.map(x => ROLL[x]) : [],
    utlamnanden: utl.map(u => ({ id: u.id, tid: u.tid, av: namnPa(db, u.av), antal: JSON.parse(u.antal), sha256: u.sha256 })),
    nastaSteg: r.status === 'registrerad' ? `Väntar på ${saknas.map(x => ROLL[x].toLowerCase()).join(' och ')}.` : r.status === 'godkand' ? 'Godkänd av två personer. Uttaget kan lämnas ut.'
      : r.status === 'utlamnad' ? (r.aterkommande ? 'Utlämnad. En återkommande beställning kan lämnas ut igen med samma pseudonymer.' : 'Utlämnad.') : 'Avslagen.',
  };
}

// GET /api/forskning.
export function lista(db, personal) {
  if (!kanSe(personal)) krav(db, personal, 'forskning_bestall', 'forskning');
  return {
    bestallningar: db.query('SELECT * FROM forskningsbestallningar ORDER BY id DESC').all().map(r => ut(db, r)),
    tabeller: Object.fromEntries(Object.entries(datauttag.SCHEMA).map(([t, s]) => [t, { beskrivning: s.beskrivning, falt: s.falt }])),
    kanRegistrera: kanRoll(personal, 'forskning_bestall'), kanBesluta: kanRoll(personal, 'forskning_godkann'),
  };
}

export function hamta(db, personal, id) {
  if (!kanSe(personal)) krav(db, personal, 'forskning_bestall', `forskning:${id}`);
  return ut(db, rad(db, id));
}

// POST /api/forskning { titel, forskare, organisation, etikprovning, urval, period?, aterkommande? }.
export function registrera(db, personal, inp = {}) {
  krav(db, personal, 'forskning_bestall', 'forskning');
  const etik = typeof inp.etikprovning === 'string' ? inp.etikprovning.trim() : '';
  if (!/^\d{4}-\d{4,5}(-\d{2})?$/.test(etik)) throw new Fel(400, 'Skriv diarienumret för etikprövningen som Etikprövningsmyndigheten anger det, till exempel 2026-01234-01. Ett uttag till forskning kräver ett godkännande från etikprövningen.', 'ogiltig', { falt: ['etikprovning'] });
  const urval = provaUrval(inp.urval);
  const ve = Array.isArray(inp.vardenheter) ? [...new Set(inp.vardenheter.map(String))] : [];
  if (!ve.length || ve.length > 30) throw new Fel(400, 'Välj vilka vårdenheter uttaget gäller. Varje vårdenhets verksamhetschef godkänner för sin vårdenhet.', 'ogiltig', { falt: ['vardenheter'] });
  for (const id of ve) if (!db.query("SELECT 1 FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(id)) throw new Fel(400, 'Vårdenheten finns inte.', 'ogiltig', { falt: ['vardenheter'] });
  let fran = null, till = null;
  if (inp.period) {
    const g = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
    if (!g(inp.period.fran) || !g(inp.period.till) || inp.period.fran > inp.period.till) throw new Fel(400, 'Perioden anges med början och slut som ÅÅÅÅ-MM-DD, och början före slutet.', 'ogiltig', { falt: ['period'] });
    fran = inp.period.fran; till = inp.period.till;
  }
  if (db.query("SELECT count(*) AS n FROM forskningsbestallningar WHERE status IN ('registrerad', 'godkand')").get().n >= MAX_OPPNA) throw new Fel(400, `Det finns redan ${MAX_OPPNA} beställningar som väntar.`, 'ogiltig');
  const ar = idag().slice(0, 4);
  const lopnr = db.query('SELECT count(*) AS n FROM forskningsbestallningar WHERE diarienummer LIKE ?').get(`FU-${ar}-%`).n + 1;
  const r = db.query(`INSERT INTO forskningsbestallningar (diarienummer, titel, forskare, organisation, etikprovning, urval, vardenheter, period_fran, period_till, aterkommande, registrerad, registrerad_av, enhet_id, nyckel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`FU-${ar}-${String(lopnr).padStart(4, '0')}`, text(inp.titel, 200, 'studiens titel'), text(inp.forskare, 100, 'forskaren'), text(inp.organisation, 100, 'organisationen'),
    etik, JSON.stringify(urval), JSON.stringify(ve), fran, till, inp.aterkommande ? 1 : 0, iso(), personal.id, personal.enhet_id, randomBytes(32).toString('base64url'));
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'forskning_bestall', resurs: `forskning:${r.lastInsertRowid}:registrerad`, grund: 'uppfoljning', resultat: 'tillaten' });
  return ut(db, rad(db, r.lastInsertRowid));
}

// POST /api/forskning/:id/beslut { beslut: godkand | avslagen, motivering }.
export function besluta(db, personal, id, inp = {}) {
  krav(db, personal, 'forskning_godkann', `forskning:${id}`);
  const r = rad(db, id);
  if (r.status !== 'registrerad') throw new Fel(409, 'Beställningen är redan beslutad.', 'ogiltig');
  if (r.registrerad_av === personal.id) throw new Fel(403, 'Den som registrerade beställningen kan inte godkänna den.', 'nekad');
  if (db.query('SELECT 1 FROM forskningsbeslut WHERE bestallning_id = ? AND personal_id = ?').get(r.id, personal.id)) throw new Fel(409, 'Du har redan beslutat om beställningen. Två andra personer behöver godkänna den.', 'ogiltig');
  // Verksamhetschefen godkänner bara för sin egen vårdenhet, och bara om den ingår i beställningen.
  const egen = personal.yrke === 'verksamhetschef' ? vardenhetFor(db, personal.enhet_id) : null;
  if (egen && !JSON.parse(r.vardenheter).includes(egen)) throw new Fel(403, 'Din vårdenhet ingår inte i beställningen. Bara verksamhetschefen för en vårdenhet som uttaget gäller kan godkänna det.', 'nekad');
  if (personal.yrke === 'arkivarie' && db.query("SELECT 1 FROM forskningsbeslut WHERE bestallning_id = ? AND roll = 'arkivarie'").get(r.id)) throw new Fel(409, `${ROLL.arkivarie} är redan gjord. Nästa godkännande görs av verksamhetschefen.`, 'ogiltig');
  if (egen && db.query("SELECT 1 FROM forskningsbeslut WHERE bestallning_id = ? AND roll = 'verksamhetschef' AND vardenhet = ?").get(r.id, egen)) throw new Fel(409, 'Vårdenheten har redan godkänt beställningen.', 'ogiltig');
  const beslut = inp.beslut === 'avslagen' ? 'avslagen' : inp.beslut === 'godkand' ? 'godkand' : null;
  if (!beslut) throw new Fel(400, 'Välj godkänn eller avslå.', 'ogiltig', { falt: ['beslut'] });
  const motivering = typeof inp.motivering === 'string' ? inp.motivering.trim().slice(0, 500) : '';
  if (beslut === 'avslagen' && motivering.length < 3) throw new Fel(400, 'Skriv varför beställningen avslås.', 'ogiltig', { falt: ['motivering'] });
  db.transaction(() => {
    db.query('INSERT INTO forskningsbeslut (bestallning_id, personal_id, roll, vardenhet, beslut, motivering, tid) VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, personal.id, personal.yrke, egen, beslut, motivering || null, iso());
    const godk = db.query("SELECT count(DISTINCT roll) AS n FROM forskningsbeslut WHERE bestallning_id = ? AND beslut = 'godkand'").get(r.id).n;
    if (beslut === 'avslagen') db.query("UPDATE forskningsbestallningar SET status = 'avslagen' WHERE id = ?").run(r.id);
    else if (godk >= 2) db.query("UPDATE forskningsbestallningar SET status = 'godkand' WHERE id = ?").run(r.id);
  })();
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'forskning_godkann', resurs: `forskning:${r.id}:${beslut}`, grund: 'arkivbeslut', resultat: 'tillaten' });
  return ut(db, rad(db, r.id));
}

// POST /api/forskning/:id/utlamna: uttaget som NDJSON per tabell, med manifest och kontrollsumma.
export function utlamna(db, personal, id) {
  krav(db, personal, 'forskning_bestall', `forskning:${id}`);
  const r = rad(db, id);
  if (!['godkand', 'utlamnad'].includes(r.status)) throw new Fel(409, 'Beställningen kan lämnas ut först när två personer har godkänt den.', 'ogiltig');
  if (r.status === 'utlamnad' && !r.aterkommande) throw new Fel(409, 'Beställningen är redan utlämnad. En ny leverans kräver en ny beställning, eller en beställning som är återkommande.', 'ogiltig');
  const { data, utelamnat } = datauttag.bygg(db, { pseudonymnyckel: r.nyckel });
  const urval = JSON.parse(r.urval);
  // Bara uppgifter från vårdenheter vars verksamhetschef har godkänt. En remiss kommer med när båda vårdenheterna har det.
  const godkanda = new Set(db.query("SELECT vardenhet FROM forskningsbeslut WHERE bestallning_id = ? AND roll = 'verksamhetschef' AND beslut = 'godkand'").all(r.id)
    .map(b => db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(b.vardenhet)?.hsa_id).filter(Boolean));
  const fran = (x) => (Object.hasOwn(x, 'vardenhet') ? godkanda.has(x.vardenhet) : godkanda.has(x.franVardenhet) && godkanda.has(x.tillVardenhet));
  const iPeriod = (x) => {
    if (!r.period_fran) return true;
    const d = x.startdatum ?? x.datum ?? x.inskrivenDatum ?? x.skickadDatum ?? null;
    return !d || (d >= r.period_fran && d <= r.period_till);
  };
  const filer = {};
  const antal = {};
  for (const [t, falt] of Object.entries(urval)) {
    const rader = (data[t] ?? []).filter(x => iPeriod(x) && fran(x)).map(x => Object.fromEntries(falt.map(f => [f, x[f] ?? null])));
    filer[`${t}.ndjson`] = rader.map(x => JSON.stringify(x)).join('\n') + (rader.length ? '\n' : '');
    antal[t] = rader.length;
  }
  const sha256 = createHash('sha256').update(JSON.stringify(filer)).digest('hex');
  const tid = iso();
  db.transaction(() => {
    db.query('INSERT INTO forskningsutlamnanden (bestallning_id, tid, av, enhet_id, antal, sha256) VALUES (?, ?, ?, ?, ?, ?)').run(r.id, tid, personal.id, personal.enhet_id, JSON.stringify(antal), sha256);
    db.query("UPDATE forskningsbestallningar SET status = 'utlamnad' WHERE id = ?").run(r.id);
  })();
  loggaRad(db, { tid, personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'forskning_bestall', resurs: `forskning:${r.id}:utlamnad`, grund: 'uppfoljning', resultat: 'tillaten', syfte: `Utlämnande till ${r.forskare}, ${r.organisation}, etikprövning ${r.etikprovning}` });
  return {
    diarienummer: r.diarienummer, tid, sha256, antal, filer,
    utelamnat: { ...utelamnat, text: 'Uppgifter från en vårdenhet som patienten har spärrat, och alla uppgifter om patienter med skyddade personuppgifter, finns inte med.' },
    anmarkning: 'Pseudonymerna gäller bara den här beställningen och går inte att koppla till andra uttag.',
  };
}
