// Vårdkällan. Varje besökare får en egen sandlåda i minnet, en kopia av den seedade mallen.
// Sandlådorna sparas till SESSION_FIL vid SIGTERM och läses in vid start.
import { join, normalize } from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { Fel, nySessionsDb, lasSandlada, idag, installning } from './db.js';
import { Atkomst, ROLLER, kanRoll, vardenhetFor, harVardrelation, aktivaSparrar, visningsnamn, visningsPnr, alder, starkasteGrund } from './atkomst.js';
import * as logg from './logg.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';
import * as fhir from './fhir.js';
import * as minJournal from './patientvy.js';
import * as uppmarksamhet from './uppmarksamhet.js';
import * as identitet from './identitet.js';
import * as vardkontakt from './vardkontakt.js';
import * as administrering from './administrering.js';
// Delegering av läkemedelshantering (runda 5).
import * as delegering from './delegering.js';
import * as vidimering from './vidimering.js';
import * as ordinationsmallar from './ordinationsmallar.js';
import * as tidbok from './tidbok.js';
// Runda 5, r1: planerad vårdhändelse i tidboken och läkarens återbesök.
import * as vardhandelse from './vardhandelse.js';
import * as aterbesok from './aterbesok.js';
// Återinsättning efter ett uppehåll med antikoagulantia i läkarens inkorg (runda 5, r4).
import * as aterinsattning from './aterinsattning.js';
import { kravregister, lasTestresultat } from './krav.js';
import { sussaRegister } from './sussa/index.js';
import { lasKlientresultat, gransnittHash } from './klientresultat.js';
import { YRKEN } from './seed/personal.js';
// Utskrift, kontrasignering, arkiv och datauttag (Sussa 3.1.9, 3.1.11.3, 5.4.2, 5.3.1.7 och 6.3.1).
import { registreraRutter as utdataRutter, tillagg as utdata } from './utdata-rutter.js';

const PUBLIC = join(import.meta.dir, '..', 'public');
const MAX_SESSIONER = 400;
const SESSION_TTL = 8 * 3600_000;
const MAX_KROPP = 64 * 1024;
const SPARVERSION = 1;
// Appens version och en hash av gränssnittet. /api/health visar dem, och användartestet märker resultatet med dem.
const APPVERSION = (() => { try { return JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')).version; } catch { return null; } })();
let gransnitt;
const gransnittVersion = () => { if (gransnitt === undefined) { try { gransnitt = gransnittHash(PUBLIC); } catch { gransnitt = null; } } return gransnitt; };
const VAL_TYPER = ['andra_enheter', 'nodatkomst', 'samtycke_sparr', 'visa_identitet'];
// Läskopian för avbrott (D4): så många av de senaste anteckningarna per patient följer med.
const LASKOPIA_ANTECKNINGAR = 5;
// Läskopians läkemedelsdel (Sussa 11.2.1.8): uppgifterna om ordinerade och administrerade läkemedel får vara högst 10
// minuter gamla när servern inte svarar. Webbläsaren förnyar kopian var fjärde minut av sig själv. Med en minuts
// fördröjning för en flik i bakgrunden och ett misslyckat försök som görs om efter 30 sekunder håller det.
const LASKOPIA_FORNYA_MS = 4 * 60_000;
const LASKOPIA_LAKEMEDEL_MAX_MS = 10 * 60_000;
// Delarna i läkemedelsdelen: namnet i kopian och i läsläget (GET /api/patient/:id/<namn>), läshandlingen och funktionen
// som ger samma svar som det vanliga anropet. Läsläget svarar på /api/patient/:id/<namn> ur kopian och loggar läsningen
// med handlingen.
const LASKOPIA_LAKEMEDEL = {
  lakemedel: { handling: 'las_lakemedel', hamta: (atk) => lakemedel.lista(atk) },
  // Dagens administreringar med givna doser (administrering.js).
  administreringar: { handling: 'las_lakemedel', hamta: (atk) => administrering.lista(atk) },
};
// Varför utlämnandet till läskopian slutade, i loggen.
const LASKOPIA_SLUT = {
  utloggning: 'Förnyelsen slutade när personen loggade ut.',
  inloggning: 'Förnyelsen slutade vid en ny inloggning i samma webbläsare.',
  invanare: 'Förnyelsen slutade när någon loggade in i Min journal i samma webbläsare.',
  utgangen: 'Förnyelsen slutade när läskopian gick ut.',
  utanfor: 'Förnyelsen slutade eftersom patienten inte längre hör till läskopian.',
};
// Läshandlingar som får rapporteras från läsläget i efterhand.
const LASLAGE_HANDLINGAR = ['las_oversikt', 'las_admin', 'las_lakemedel', 'las_journal', 'las_omvardnad'];
const KLOCKMARGINAL = 5 * 60_000;
// Så många rader från läsläget tas emot per läskopia. Fler avvisas, så att ett id aldrig glöms och kan loggas igen.
const MAX_LASLOGG_ID = 5000;
// Så många läskopior per sandlåda håller servern reda på för att kunna ta emot loggen från läsläget i efterhand.
const MAX_KOPIOR = 10;

// Svarstider: senaste mätningarna per endpoint.
export class Matning {
  constructor(max = 500, maxNycklar = 150) { this.max = max; this.maxNycklar = maxNycklar; this.data = new Map(); }
  lagg(nyckel, ms) {
    if (!this.data.has(nyckel) && this.data.size >= this.maxNycklar) nyckel = 'övrigt';
    let a = this.data.get(nyckel);
    if (!a) { a = []; this.data.set(nyckel, a); }
    a.push(ms);
    if (a.length > this.max) a.shift();
  }
  sammanstall() {
    const p = (s, q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
    return [...this.data].map(([endpoint, a]) => {
      const s = [...a].sort((x, y) => x - y);
      return { endpoint, antal: a.length, p50: Math.round(p(s, 0.5) * 10) / 10, p95: Math.round(p(s, 0.95) * 10) / 10 };
    }).sort((x, y) => x.endpoint.localeCompare(y.endpoint));
  }
}

export function normaliseraVag(metod, vag) {
  if (vag.startsWith('/fhir/')) {
    const d = vag.split('/');
    if (d.length > 3 && d[3]) d[3] = ':id';
    return `${metod} ${d.join('/')}`;
  }
  if (!vag.startsWith('/api/')) return `${metod} statisk`;
  return `${metod} ${vag.split('/').map(s => (/^p\d+$/.test(s) || /^\d+$/.test(s) ? ':id' : s)).join('/')}`;
}

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const SAKERHET = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

async function statisk(path) {
  if (path === '/' || path === '') path = '/index.html';
  let avkodad;
  try { avkodad = decodeURIComponent(path); } catch { return null; }
  let fil = normalize(join(PUBLIC, avkodad));
  if (!fil.startsWith(PUBLIC + '/')) return null;
  let f = Bun.file(fil);
  if (!(await f.exists())) {
    // Okända sökvägar utan filändelse får index.html, så att gränssnittet kan ha egna adresser.
    if (/\.[a-z0-9]+$/i.test(path)) return null;
    fil = join(PUBLIC, 'index.html');
    f = Bun.file(fil);
    if (!(await f.exists())) return null;
  }
  const ext = fil.slice(fil.lastIndexOf('.'));
  return new Response(f, { headers: { 'Content-Type': TYPER[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...SAKERHET } });
}

export function starta({ port = Number(process.env.PORT || 8080), hostname = '0.0.0.0', origin = process.env.ORIGIN || '',
  sessionFil = process.env.SESSION_FIL || '', testresultat = process.env.TESTRESULTAT || join(import.meta.dir, '..', 'test-resultat.json'),
  klientresultat = { klickbudget: process.env.KLICKBUDGET || join(import.meta.dir, '..', 'klickbudget.json'), klienttester: process.env.KLIENTTESTER || join(import.meta.dir, '..', 'klienttest-resultat.json') },
  nyaPerTimme = Number(process.env.NYA_PER_TIMME || 60) } = {}) {
  const sessioner = new Map();
  const nyaPerIp = new Map();
  const serverMatning = new Matning(1000);
  const startad = new Date().toISOString();

  const slumpId = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const slumpNyckel = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const kakSid = (req) => (req.headers.get('cookie') || '').match(/(?:^|;\s*)vk_sid=([A-Za-z0-9_-]{32})(?:;|$)/)?.[1];
  const kaka = (sid) => `vk_sid=${sid}; Path=/; HttpOnly; SameSite=Lax${origin.startsWith('https') ? '; Secure' : ''}`;
  // Cloudflare skriver över cf-connecting-ip vid kanten. Rubriken gäller bara när LITA_PA_PROXY=1,
  // alltså när enda vägen in är tunneln och Caddy. Annars räknas socketens adress.
  const litaPaProxy = process.env.LITA_PA_PROXY === '1';
  const klientIp = (req, server) => (litaPaProxy && req.headers.get('cf-connecting-ip')) || server.requestIP(req)?.address || 'okänd';

  // Läskopian (D4): lasnyckel är nyckeln som webbläsaren krypterar sin läskopia och loggen från läsläget med. Den har ett
  // id, läskopians id. kopior håller för varje läskopia som sandlådan har lämnat ut reda på vem den gäller, nyckeln,
  // hur länge den gäller, vilka patienter som lämnades ut på vilken grund och när, och vilka rader från läsläget som
  // redan har tagits emot. En läskopia finns kvar efter utloggning och ny inloggning tills den går ut, så att loggen
  // från läsläget kan tas emot även när den kommer efter ett avbrott, från en ny flik eller efter en omstart av
  // webbläsaren. Nyckeln lämnas bara ut till den inloggade medan inloggningen pågår, aldrig senare.
  const nyLasnyckel = () => ({ id: slumpId(), nyckel: slumpNyckel(), giltigTill: new Date(Date.now() + SESSION_TTL).toISOString() });
  const aktuellKopia = (s) => (s.lasnyckel ? s.kopior.get(s.lasnyckel.id) ?? null : null);
  function rensaKopior(s, nu = Date.now()) {
    for (const [id, k] of s.kopior) if (Date.parse(k.giltigTill) + KLOCKMARGINAL < nu) { avslutaKopia(s, k, 'utgangen'); s.kopior.delete(id); }
    while (s.kopior.size > MAX_KOPIOR) { const id = s.kopior.keys().next().value; avslutaKopia(s, s.kopior.get(id), 'utgangen'); s.kopior.delete(id); }
  }
  // Läskopian förnyas av sig själv medan personen är inloggad (Sussa 11.2.1.8), men varje förnyelse loggas inte för
  // sig. Loggen visar när utlämnandet av en patient började (resurs lasekopia, när servern lämnade ut patienten första
  // gången och igen om grunden ändras) och när uppgifterna lämnades ut senast (resurs lasekopia:slut, med tiden för den
  // senaste förnyelsen och antalet förnyelser). Den sista raden skrivs när utlämnandet slutar: vid utloggning, ny
  // inloggning, när läskopian går ut eller när patienten inte längre hör till kopian.
  function avslutaUtlamnande(s, kopia, pid, orsak) {
    const u = kopia.patienter.get(pid);
    if (!u || u.slut) return;
    u.slut = true;
    const pers = s.db.query('SELECT * FROM personal WHERE id = ?').get(kopia.personalId);
    if (!pers) return;
    const fornyad = u.fornyad ?? 0;
    logg.loggaRad(s.db, {
      tid: u.senast ?? u.tid, personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: pid, handling: u.handling, resurs: 'lasekopia:slut', grund: u.grund,
      syfte: `Senaste utlämnandet till läskopian för avbrott. Uppgifterna förnyades ${fornyad} ${fornyad === 1 ? 'gång' : 'gånger'} efter att de lämnades ut. ${LASKOPIA_SLUT[orsak]}`,
      resultat: 'tillaten',
    });
  }
  function avslutaKopia(s, kopia, orsak) {
    if (!kopia) return;
    for (const pid of kopia.patienter.keys()) avslutaUtlamnande(s, kopia, pid, orsak);
  }
  // Ser till att den inloggade har en nyckel och en läskopia att föra loggen mot.
  function sakraKopia(s) {
    if (!s.personalId) return null;
    if (!aktuellKopia(s)) {
      s.lasnyckel = nyLasnyckel();
      s.kopior.set(s.lasnyckel.id, { personalId: s.personalId, nyckel: s.lasnyckel.nyckel, giltigTill: s.lasnyckel.giltigTill, patienter: new Map(), loggIds: new Set() });
      rensaKopior(s);
    }
    return aktuellKopia(s);
  }
  // personalId och invanareId är aldrig satta samtidigt: personalens och invånarens inloggning utesluter varandra.
  const nySession = () => ({ db: nySessionsDb(), personalId: null, invanareId: null, val: {}, sist: Date.now(), matning: new Matning(200), lasnyckel: null, oppnade: new Set(), kopior: new Map() });
  // Läskopian som id:t gäller, i den sandlåda som lämnade ut den. Kräver ingen session: loggen från läsläget visar
  // själv att den kommer från den som hade läskopian, eftersom den är krypterad med läskopians nyckel.
  function hittaKopia(id) {
    const nu = Date.now();
    for (const s of sessioner.values()) {
      const k = s.kopior.get(id);
      if (k && Date.parse(k.giltigTill) + KLOCKMARGINAL >= nu) return { s, kopia: k };
    }
    return null;
  }

  function hamtaSession(req) {
    const sid = kakSid(req);
    const s = sid && sessioner.get(sid);
    if (!s) return null;
    s.sist = Date.now();
    sessioner.delete(sid); sessioner.set(sid, s);
    return { sid, s };
  }
  function skapaSession(req, server) {
    const k = `${klientIp(req, server)}:${Math.floor(Date.now() / 3600_000)}`;
    const n = (nyaPerIp.get(k) ?? 0) + 1;
    nyaPerIp.set(k, n);
    if (n > nyaPerTimme) throw new Fel(429, 'För många nya besök från din adress. Försök igen om en stund.', 'nekad');
    while (sessioner.size >= MAX_SESSIONER) {
      const aldsta = sessioner.keys().next().value;
      sessioner.get(aldsta).db.close();
      sessioner.delete(aldsta);
    }
    const sid = slumpId();
    const s = nySession();
    sessioner.set(sid, s);
    return { sid, s, ny: true };
  }

  const stadning = setInterval(() => {
    const grans = Date.now() - SESSION_TTL;
    for (const [sid, s] of sessioner) { if (s.sist < grans) { s.db.close(); sessioner.delete(sid); } else { rensaKopior(s); utdata.stadning(s.db); } }
    const timme = Math.floor(Date.now() / 3600_000);
    for (const k of nyaPerIp.keys()) if (!k.endsWith(`:${timme}`)) nyaPerIp.delete(k);
  }, 10 * 60_000);

  function lasSparade() {
    if (!sessionFil || !existsSync(sessionFil)) return;
    try {
      const grans = Date.now() - SESSION_TTL;
      for (const x of JSON.parse(readFileSync(sessionFil, 'utf8'))) {
        if (x.v !== SPARVERSION || x.sist < grans || !/^[A-Za-z0-9_-]{32}$/.test(x.sid)) continue;
        const s = {
          db: lasSandlada(x.db), personalId: x.personalId, invanareId: x.personalId ? null : x.invanareId ?? null, val: x.val ?? {}, sist: x.sist, matning: new Matning(200),
          lasnyckel: x.lasnyckel ?? null, oppnade: new Set(x.oppnade ?? []),
          kopior: new Map((x.kopior ?? []).map(([id, k]) => [id, { ...k, patienter: new Map(k.patienter), loggIds: new Set(k.loggIds) }])),
        };
        // Sparat av en äldre version, med en nyckel utan id och en enda läskopia per session.
        if (s.lasnyckel && !s.lasnyckel.id && s.personalId) {
          s.lasnyckel = { id: slumpId(), ...s.lasnyckel };
          s.kopior.set(s.lasnyckel.id, { personalId: s.personalId, nyckel: s.lasnyckel.nyckel, giltigTill: s.lasnyckel.giltigTill, patienter: new Map(x.kopia ?? []), loggIds: new Set(x.kopiaLoggIds ?? []) });
        }
        rensaKopior(s);
        sessioner.set(x.sid, s);
      }
      console.log(`Läste in ${sessioner.size} sparade sandlådor`);
    } catch (e) { console.error('Kunde inte läsa sparade sandlådor:', e.message); }
    try { unlinkSync(sessionFil); } catch { /* redan borta */ }
  }
  function spara() {
    if (!sessionFil) return 0;
    const lista = [...sessioner].map(([sid, x]) => ({
      v: SPARVERSION, sid, personalId: x.personalId, invanareId: x.invanareId, val: x.val, sist: x.sist, db: Buffer.from(x.db.serialize()).toString('base64'),
      lasnyckel: x.lasnyckel, oppnade: [...x.oppnade],
      kopior: [...x.kopior].map(([id, k]) => [id, { ...k, patienter: [...k.patienter], loggIds: [...k.loggIds] }]),
    }));
    writeFileSync(sessionFil + '.tmp', JSON.stringify(lista), { mode: 0o600 });
    renameSync(sessionFil + '.tmp', sessionFil);
    return lista.length;
  }
  lasSparade();

  function kontrolleraOrigin(req) {
    if (!origin) return;
    const o = req.headers.get('origin');
    if (o) { if (o !== origin) throw new Fel(403, 'Förfrågan kom från fel ursprung.', 'nekad'); return; }
    const ref = req.headers.get('referer');
    if (!ref || !(ref === origin || ref.startsWith(origin + '/'))) throw new Fel(403, 'Förfrågan saknar ursprung.', 'nekad');
  }

  async function lasKropp(req) {
    const langd = Number(req.headers.get('content-length') || 0);
    if (langd > MAX_KROPP) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    const txt = await req.text();
    if (txt.length > MAX_KROPP) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    if (!txt.trim()) return {};
    if (!(req.headers.get('content-type') || '').startsWith('application/json')) throw new Fel(415, 'Förväntade JSON.', 'ogiltig');
    let v;
    try { v = JSON.parse(txt); } catch { throw new Fel(400, 'Ogiltig JSON.', 'ogiltig'); }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Fel(400, 'Förväntade ett JSON-objekt.', 'ogiltig');
    return v;
  }

  const valFor = (s, pid) => {
    const v = s.val[pid] ?? {};
    return Object.fromEntries(VAL_TYPER.map(t => [t, Boolean(v[t])]));
  };
  const personalRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
  const enhetKort = (db, id) => {
    const e = db.query('SELECT * FROM enheter WHERE id = ?').get(id);
    return e ? { id: e.id, namn: e.namn, hsaId: e.hsa_id } : null;
  };
  // En journal som har slagits samman med en annan leder till den gällande journalen (Sussa 3.1.1.2).
  const patientRad = (db, id) => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(identitet.gallandeId(db, id));
    if (!p) throw new Fel(404, 'Patienten finns inte.', 'saknas');
    return p;
  };

  // Patientens namn och personnummer, maskerade för skyddad identitet, för listor utanför journalen.
  const patientKort = (p) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) });

  // roll är personal (simulerat SITHS-kort) eller invanare (simulerad e-legitimation, Min journal). Invånaren får
  // ingen nyckel till läskopian och inga behörigheter för personalens handlingar.
  function sessionUt(s) {
    const p = personalRad(s.db, s.personalId);
    const inv = p ? null : minJournal.invanareRad(s.db, s.invanareId);
    const ut = { inloggad: Boolean(p || inv), demoDatum: installning(s.db, 'seed_datum') ?? idag() };
    if (inv) Object.assign(ut, { roll: 'invanare' }, minJournal.sessionDel(s.db, inv));
    if (p) {
      const ve = vardenhetFor(s.db, p.enhet_id);
      ut.roll = 'personal';
      ut.personal = { id: p.id, namn: p.namn, yrke: p.yrke, yrkeText: YRKEN[p.yrke], titel: p.titel, hsaId: p.hsa_id };
      ut.enhet = { ...enhetKort(s.db, p.enhet_id), vardenhet: enhetKort(s.db, ve) };
      ut.behorigheter = ROLLER[p.yrke] ?? [];
      // Undersköterskan har behörigheten att ge läkemedel bara med en giltig delegering i dag (runda 5).
      if (p.yrke === 'underskoterska' && !delegering.giltigNu(s.db, p).giltig) ut.behorigheter = ut.behorigheter.filter(h => h !== 'ge_lakemedel');
      sakraKopia(s);
      ut.lasnyckel = s.lasnyckel;
    }
    return ut;
  }

  // Kontext och loggning för en patient. Fel kastas vidare; nekade försök loggas i Atkomst.krav.
  function medPatient(c, pid, handling, fn) {
    const p = patientRad(c.db, pid);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), handling);
    const ut = fn(atk, p);
    if (!atk.loggad) atk.logga(handling, atk.grund(), c.url.pathname);
    return ut;
  }

  function patientHuvud(c, atk, p) {
    const db = c.db;
    const val = valFor(c.s, p.id);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    const r = atk.krav(handling);
    const min = vardenhetFor(db, c.personal.enhet_id);
    const sparrar = aktivaSparrar(db, p.id);
    const enheter = new Set(db.query(`SELECT enhet_id FROM anteckningar WHERE patient_id = ?1 UNION SELECT enhet_id FROM diagnoser WHERE patient_id = ?1
      UNION SELECT enhet_id FROM matvarden WHERE patient_id = ?1 UNION SELECT enhet_id FROM vardkontakter WHERE patient_id = ?1`).all(p.id).map(x => vardenhetFor(db, x.enhet_id)));
    const andra = [...enheter].filter(e => e !== min && !sparrar.includes(e));
    const visad = p.skyddad ? val.visa_identitet : true;
    const listning = db.query('SELECT * FROM listningar WHERE patient_id = ?').get(p.id);
    return {
      id: p.id, namn: visningsnamn(p, val.visa_identitet), personnummer: visningsPnr(p, val.visa_identitet), alder: alder(p.fodd, idag()),
      kon: p.kon, skyddad: Boolean(p.skyddad), identitetVisad: Boolean(p.skyddad && val.visa_identitet),
      overkanslighet: journal.synligOverkanslighet(atk), sparrmarkering: r.spärrade, grund: r.grund,
      harAndraEnheter: andra.length > 0, andraEnheterVisade: Boolean(val.andra_enheter || r.grund === 'nodatkomst'),
      nodatkomst: Boolean(val.nodatkomst), samtyckeSparr: Boolean(val.samtycke_sparr), visad,
      listning: listning ? { enhet: enhetKort(db, listning.enhet_id), fran: listning.fran } : null,
      uppmarksamhet: uppmarksamhet.forHuvud(atk),
      ...identitetIHuvud(c, p),
      ...utdata.huvud(db, p),
    };
  }

  // Identiteten (Sussa 3.1.1): typ, antal tidigare identiteter och, för den som kan slå samman journaler, hur många
  // troliga dubbletter systemet har hittat.
  function identitetIHuvud(c, p) {
    const typ = p.id_typ ?? 'personnummer';
    return {
      identitet: { typ, typText: identitet.TYPER[typ].text },
      tidigareIdentiteter: c.db.query("SELECT count(*) AS n FROM identiteter WHERE patient_id = ? AND status = 'tidigare'").get(p.id).n,
      dubbletter: kanRoll(c.personal, 'sla_samman') ? identitet.dubbletterFor(c.db, p.id).length : 0,
    };
  }

  function oversikt(c, atk, p) {
    const db = c.db;
    const pers = c.personal;
    atk.krav(kanRoll(pers, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
    const ord = kanRoll(pers, 'las_lakemedel') ? lakemedel.synligaOrdinationer(atk) : null;
    const dia = kanRoll(pers, 'las_diagnoser') ? journal.synligaDiagnoser(atk) : null;
    const mv = kanRoll(pers, 'las_matvarden') ? journal.synligaMatvarden(atk) : null;
    const kanAnt = kanRoll(pers, 'las_journal') || kanRoll(pers, 'las_omvardnad');
    const ant = kanAnt ? journal.listaAnteckningar(atk).anteckningar : null;
    const rem = (kanRoll(pers, 'las_remiss') || kanRoll(pers, 'las_remiss_status')) ? remiss.forPatient(atk).remisser : null;
    const vk = journal.synligaVardkontakter(atk);
    const tidslinje = [
      ...vk.map(v => ({ tid: v.start, typ: 'vardkontakt', rubrik: v.orsak, text: v.plats, enhet: enhetKort(db, v.enhet_id), kalla: v.kalla, kallaEtikett: journal.kallaEtikett(v.kalla, v.start), ref: { typ: 'vardkontakt', id: v.id } })),
      ...(ant ?? []).map(a => ({ tid: a.signerad?.tid ?? a.skapad, typ: 'anteckning', rubrik: a.typ, text: a.sammanfattning, enhet: a.enhet, kalla: a.kalla, kallaEtikett: a.kallaEtikett, ref: { typ: 'anteckning', id: a.id } })),
      ...(ord ?? []).flatMap(o => {
        const u = lakemedel.ordinationUt(db, o, { historik: false });
        const h = [{ tid: o.skapad, typ: 'ordination', rubrik: `Ordinerat: ${u.lakemedel?.namn}`, text: `${u.dosering}. ${u.ordinationsorsak}`, enhet: u.vardenhet, kalla: o.kalla, kallaEtikett: u.kallaEtikett, ref: { typ: 'ordination', id: o.id } }];
        if (o.utsatt_tid) h.push({ tid: o.utsatt_tid, typ: 'ordination', rubrik: `Utsatt: ${u.lakemedel?.namn}`, text: o.utsatt_orsak, enhet: u.vardenhet, kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'ordination', id: o.id } });
        return h;
      }),
      ...(rem ?? []).map(r => ({ tid: r.tider.skickad, typ: 'remiss', rubrik: `Remiss till ${r.till.namn}`, text: r.fragestallning ?? r.status, enhet: r.fran, kalla: r.kalla, kallaEtikett: r.kallaEtikett, ref: { typ: 'remiss', id: r.id } })),
    ].sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
    // Vårdkontakter, vårdtillfällen och hälsoärenden (vardkontakt.js), byggt av det som redan är filtrerat ovan.
    const vardstruktur = vardkontakt.oversiktDel(atk, { vk, ant, dia, mv, ord, rem });
    return {
      lakemedel: ord ? ord.filter(lakemedel.aktuell).map(o => lakemedel.ordinationUt(db, o, { historik: false })) : null,
      diagnoser: dia ? dia.map(d => journal.diagnosUt(db, d)) : null,
      matvarden: mv ? journal.senastePerTyp(mv).map(m => journal.matvardeUt(db, m)) : null,
      anteckningar: ant ? ant.slice(0, 5) : null,
      remisser: rem ? rem.filter(r => r.status !== 'svar_kvitterat' && r.beslut !== 'avvisad') : null,
      tidslinje: vardkontakt.berikaTidslinje(db, tidslinje, vardstruktur, vk),
      vardkontakter: vk.map(v => vardkontakt.kontaktUt(db, v, pers)),
      vardstruktur,
      kontakt: { adress: p.skyddad ? null : p.adress, postnr: p.skyddad ? null : p.postnr, ort: p.skyddad ? null : p.ort, telefon: p.skyddad ? null : p.telefon, kontaktperson: p.skyddad ? null : p.kontaktperson },
      dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
    };
  }

  function arbetslista(c) {
    const db = c.db;
    const p = c.personal;
    if (p.yrke === 'logggranskare') return [];
    const ve = vardenhetFor(db, p.enhet_id);
    const enheter = db.query("SELECT id FROM enheter WHERE id = ? OR (forald_id = ? AND typ = 'arbetsplats')").all(ve, ve).map(r => r.id);
    const ph = enheter.map(() => '?').join(', ');
    const ids = new Set([
      ...db.query(`SELECT patient_id FROM vardkontakter WHERE enhet_id IN (${ph})`).all(...enheter),
      ...db.query(`SELECT patient_id FROM listningar WHERE enhet_id IN (${ph})`).all(...enheter),
      ...db.query('SELECT patient_id FROM remisser WHERE till_enhet_id = ? OR fran_enhet_id = ?').all(ve, ve),
    ].map(r => r.patient_id));
    const larm = remiss.larmForEnhet(db, p);
    const nll = lakemedel.nllAvvikelser(db, p);
    const ut = [];
    for (const id of ids) {
      if (!harVardrelation(db, id, ve)) continue;
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(id);
      // En planerad kontakt längre fram (en bokning i tidboken) är inte pågående.
      const vk = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL
        AND NOT (coalesce(planerad, 0) = 1 AND ankomst IS NULL AND start > ?) ORDER BY start DESC`).get(id, ...enheter, new Date(Date.now() + 3600_000).toISOString());
      const inkRemiss = db.query("SELECT * FROM remisser WHERE patient_id = ? AND till_enhet_id = ? AND status <> 'svar_kvitterat' ORDER BY skickad_tid DESC").get(id, ve);
      const list = db.query(`SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id IN (${ph})`).get(id, ...enheter);
      ut.push({
        id, namn: visningsnamn(pat), personnummer: visningsPnr(pat), alder: alder(pat.fodd, idag()), kon: pat.kon,
        plats: vk ? vk.plats : inkRemiss ? 'Inkommande remiss' : list ? 'Listad' : 'Nyligen avslutad kontakt',
        orsak: vk?.orsak ?? (inkRemiss && kanRoll(p, 'las_remiss') ? inkRemiss.fragestallning : null),
        skyddad: Boolean(pat.skyddad), larm: larm.filter(l => l.patientId === id).length + nll.filter(n => n.patientId === id).length,
        pagaende: Boolean(vk), vardform: vk?.typ ?? null,
        uppmarksamhet: uppmarksamhet.symbolFor(db, p, id, valFor(c.s, id)),
      });
    }
    const ordning = { slutenvard: 0, akut: 1, oppenvard: 2 };
    return ut.sort((a, b) => (ordning[a.vardform] ?? 3) - (ordning[b.vardform] ?? 3) || a.namn.localeCompare(b.namn, 'sv'));
  }

  function sok(c, q) {
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'sok');
    atk.krav('sok');
    const fraga = String(q ?? '').trim().slice(0, 60);
    if (fraga.length < 2) throw new Fel(400, 'Skriv minst två tecken.', 'ogiltig', { falt: ['q'] });
    const siffror = fraga.replace(/[-\s]/g, '');
    // Systemet avgör självt om frågan är ett nummer (personnummer, samordningsnummer, reservnummer eller OID) eller ett
    // namn, och hittar patienten också på en tidigare identitet (Sussa 3.1.1).
    const t = identitet.tolka(fraga);
    const traffar = new Map();
    let rader;
    if (/^\d{6,9}$/.test(siffror)) {
      // Början av ett nummer. Skyddade patienter hittas bara på fullständigt nummer.
      rader = db.query('SELECT * FROM patienter WHERE sammanslagen_till IS NULL AND (personnummer LIKE ? OR substr(personnummer, 3) LIKE ?) AND skyddad = 0 ORDER BY personnummer LIMIT 20').all(`${siffror}%`, `${siffror}%`);
    } else if (t.arIdentitet) {
      if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['q'] });
      const h = identitet.hittaPaIdentitet(db, t);
      rader = h ? [patientRad(db, h.patientId)] : [];
      if (h && h.identitet.status !== 'gallande') traffar.set(h.patientId, { typText: identitet.TYPER[t.typ].text, status: h.identitet.status });
    } else {
      // SQLite:s lower() hanterar bara ASCII, så namnen jämförs här med svensk gemenisering.
      const sv = (s) => s.toLocaleLowerCase('sv-SE');
      const m = sv(fraga);
      rader = db.query('SELECT * FROM patienter WHERE skyddad = 0 AND sammanslagen_till IS NULL').all()
        .filter(p => sv(`${p.fornamn} ${p.efternamn}`).includes(m))
        .sort((a, b) => a.efternamn.localeCompare(b.efternamn, 'sv') || a.fornamn.localeCompare(b.fornamn, 'sv'))
        .slice(0, 20);
    }
    const ve = vardenhetFor(db, c.personal.enhet_id);
    atk.logga('sok', atk.grund(), `sok:${fraga} (${rader.length} träffar)`);
    return rader.map(p => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), alder: alder(p.fodd, idag()), kon: p.kon, skyddad: Boolean(p.skyddad), vardrelation: harVardrelation(db, p.id, ve),
      identitetstyp: p.id_typ ?? 'personnummer', typText: identitet.TYPER[p.id_typ ?? 'personnummer'].text, traffPa: traffar.get(p.id) ?? null }));
  }

  function vantrum(c) {
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'vantrum');
    atk.krav('vantrum');
    const akut = vardenhetFor(db, c.personal.enhet_id) === 'uso-akut';
    const nu = Date.now();
    return db.query("SELECT * FROM vantrum WHERE status = 'vantar' ORDER BY ankomst").all().map(v => {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(v.patient_id);
      const rad = { konummer: v.konummer, ankomst: v.ankomst, prioritet: v.prioritet, status: v.status, vantetidMin: Math.max(0, Math.round((nu - Date.parse(v.ankomst)) / 60000)), uppropning: `Nummer ${v.konummer}` };
      if (akut) Object.assign(rad, { patientId: p.id, skyddad: Boolean(p.skyddad), namn: p.skyddad ? null : visningsnamn(p), orsak: v.orsak, uppmarksamhet: uppmarksamhet.symbolFor(db, c.personal, p.id, valFor(c.s, p.id)) });
      return rad;
    });
  }

  // Läskopian för avbrott (D4). Den byggs med exakt samma funktioner och samma behörighetskontroll som de vanliga
  // anropen, en Atkomst per del precis som när gränssnittet hämtar dem, så den innehåller aldrig mer än servern redan
  // lämnar ut till den inloggade. Patienter som den inloggade inte får öppna hoppas över utan att något loggas som nekat.
  // Med kommer patienterna på arbetslistan och de patienter personen har öppnat under sessionen. Att en patient lämnas
  // ut till läskopian loggas en gång per inloggning, och igen om grunden ändras (till exempel efter ett aktivt val).
  function lasekopia(c) {
    const db = c.db;
    const pers = c.personal;
    const s = c.s;
    const kopia = sakraKopia(s);
    const { lasnyckel: _, ...session } = sessionUt(s);
    const alla = db.query('SELECT * FROM enheter').all();
    const nod = (e) => ({ id: e.id, hsaId: e.hsa_id, namn: e.namn, kortnamn: e.kortnamn, typ: e.typ, barn: alla.filter(b => b.forald_id === e.id).map(nod) });
    const ut = {
      kopiaId: s.lasnyckel.id, skapad: new Date().toISOString(), giltigTill: s.lasnyckel.giltigTill, session,
      fornyas: { intervallMs: LASKOPIA_FORNYA_MS, lakemedelMaxMs: LASKOPIA_LAKEMEDEL_MAX_MS },
      enheter: alla.filter(e => !e.forald_id).map(nod), mallar: journal.MALLAR, arbetslista: [], patienter: {},
    };
    if (pers.yrke === 'logggranskare') return ut;
    ut.arbetslista = arbetslista(c);
    const ids = [...new Set([...ut.arbetslista.map(x => x.id), ...s.oppnade])];
    for (const pid of ids) {
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
      if (!pat) continue;
      const handling = kanRoll(pers, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
      const val = valFor(s, pid);
      const delar = [];
      const ny = (h = handling) => { const a = new Atkomst(db, pers, pid, val, h); delar.push(a); return a; };
      if (!ny().prova(handling).tillaten) continue;
      const post = { handling, huvud: patientHuvud(c, ny(), pat), oversikt: oversikt(c, ny(), pat), lakemedel: null, lakemedelsdel: null, anteckningar: null, anteckning: {} };
      // Läkemedelsdelen har en egen tid per patient, så att läsläget kan visa hur gammal den är.
      const lmTid = new Date().toISOString();
      const lmDelar = Object.entries(LASKOPIA_LAKEMEDEL).filter(([, d]) => kanRoll(pers, d.handling));
      for (const [namn, d] of lmDelar) post[namn] = d.hamta(ny(d.handling));
      if (lmDelar.length) post.lakemedelsdel = { tid: lmTid, delar: Object.fromEntries(lmDelar.map(([namn, d]) => [namn, d.handling])) };
      if (kanRoll(pers, 'las_journal') || kanRoll(pers, 'las_omvardnad')) {
        const l = journal.listaAnteckningar(ny('las_journal'));
        const senaste = l.anteckningar.slice(0, LASKOPIA_ANTECKNINGAR);
        post.anteckningar = { anteckningar: senaste, dolda: l.dolda, iLaskopian: senaste.length, totalt: l.anteckningar.length };
        for (const a of senaste) post.anteckning[a.id] = utdata.anteckning(db, pers, journal.hamtaAnteckning(ny(journal.lasHandling(a.kategori)), journal.hamtaAnteckningRad(db, a.id)));
      }
      const grunder = new Set(delar.flatMap(a => [...a.grunder]));
      const grund = starkasteGrund(grunder, pers.yrke === 'vardadministrator' ? 'administrativ' : 'vardrelation');
      const forra = kopia.patienter.get(pid);
      const borjar = !forra || forra.slut;
      if (borjar || forra.grund !== grund) delar[0].logga(handling, grund, 'lasekopia', 'tillaten', 'Läskopia för avbrott, krypterad i webbläsaren. Den förnyas automatiskt medan inloggningen pågår, och när förnyelsen slutar loggas när uppgifterna lämnades ut senast.');
      kopia.patienter.set(pid, { grund, handling, tid: forra?.tid ?? ut.skapad, senast: ut.skapad, fornyad: borjar ? 0 : (forra.fornyad ?? 0) + 1 });
      ut.patienter[pid] = post;
    }
    // Patienter som inte längre hör till läskopian finns inte i den nya kopian, och utlämnandet av dem har slutat.
    for (const pid of kopia.patienter.keys()) if (!ut.patienter[pid]) avslutaUtlamnande(s, kopia, pid, 'utanfor');
    return ut;
  }

  // Åtkomster som gjordes i läsläget, när servern inte svarade, tas emot i efterhand. Bara åtkomster till patienter som
  // servern har lämnat ut till läskopian, bara läshandlingar som rollen har och bara tider inom läskopians giltighet.
  // Raden loggas på den person som läskopian lämnades ut till, aldrig på den som råkar vara inloggad när den kommer.
  // Läsningar efter att personen loggade ut tas inte emot. Varje rad har ett id från webbläsaren, så att en rad som
  // skickas två gånger loggas en gång. skillnad är hur många millisekunder webbläsarens klocka gick fel när raderna
  // skickades; tiden rättas med den, och det står i syftet.
  function taEmotRader(db, pers, kopia, rader, skillnad = 0) {
    const nu = Date.now();
    const syfte = skillnad
      ? `Läsläge vid avbrott, läskopia i webbläsaren. Tiden är rättad, eftersom webbläsarens klocka gick fel med ${Math.round(Math.abs(skillnad) / 60_000)} minuter.`
      : 'Läsläge vid avbrott, läskopia i webbläsaren';
    let mottagna = 0;
    const avvisade = [];
    for (const r of rader) {
      const id = typeof r?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(r.id) ? r.id : null;
      if (!id) { avvisade.push({ id: null, orsak: 'Raden saknar giltigt id.' }); continue; }
      if (kopia?.loggIds.has(id)) { mottagna++; continue; }
      const utlamnad = kopia && pers && typeof r.patientId === 'string' ? kopia.patienter.get(r.patientId) : null;
      if (!utlamnad) { avvisade.push({ id, orsak: 'Patienten fanns inte i din läskopia.' }); continue; }
      if (!LASLAGE_HANDLINGAR.includes(r.handling) || !kanRoll(pers, r.handling)) { avvisade.push({ id, orsak: 'Handlingen är inte en läsning som din yrkesroll får göra.' }); continue; }
      const t = (typeof r.tid === 'string' ? Date.parse(r.tid) : NaN) + skillnad;
      if (!Number.isFinite(t) || t < Date.parse(utlamnad.tid) - KLOCKMARGINAL || t > nu + KLOCKMARGINAL || t < nu - SESSION_TTL || t > Date.parse(kopia.giltigTill) + KLOCKMARGINAL) {
        avvisade.push({ id, orsak: 'Tidpunkten ligger utanför läskopians giltighet.' }); continue;
      }
      if (kopia.stangd && t > Date.parse(kopia.stangd) + KLOCKMARGINAL) { avvisade.push({ id, orsak: 'Läsningen gjordes efter utloggningen.' }); continue; }
      if (kopia.loggIds.size >= MAX_LASLOGG_ID) { avvisade.push({ id, orsak: 'Läskopian har redan tagit emot så många rader som går.' }); continue; }
      const resurs = typeof r.resurs === 'string' ? r.resurs.slice(0, 200) : '';
      logg.loggaRad(db, {
        tid: new Date(t).toISOString(), personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: r.patientId, handling: r.handling,
        resurs: `laslage:${resurs}`, grund: utlamnad.grund, syfte, resultat: 'tillaten',
      });
      kopia.loggIds.add(id);
      mottagna++;
    }
    return { mottagna, avvisade };
  }

  // Den inloggade rapporterar åtkomster i läsläget mot sin pågående läskopia, med raderna i klartext.
  function lasekopiaLogg(c) {
    const rader = c.body.rader;
    if (!Array.isArray(rader) || rader.length > 500) throw new Fel(400, 'Skicka högst 500 rader i en lista.', 'ogiltig', { falt: ['rader'] });
    return taEmotRader(c.db, c.personal, aktuellKopia(c.s), rader);
  }

  // Loggen från läsläget som webbläsaren har sparat krypterad. Varje rad är krypterad för sig med läskopians nyckel
  // (AES-GCM), med läskopians id, personen och radens id som additional data. Bara den som hade läskopian och dess
  // nyckel kan skapa en rad som går att dekryptera, så raderna kan tas emot utan inloggning: från en ny flik, efter en
  // omstart av webbläsaren eller när någon annan har loggat in. En rad som inte går att dekryptera, eller som ändrats,
  // avvisas. Raderna loggas i sandlådan som lämnade ut läskopian, på personen som den lämnades ut till.
  const loggAad = (kopiaId, personalId, id) => Buffer.from(`vardkallan-laslogg|${kopiaId}|${personalId}|${id}`);
  function dekrypteraRad(nyckel, aad, iv, data) {
    if (typeof iv !== 'string' || typeof data !== 'string' || iv.length > 32 || data.length > 4096) return null;
    try {
      const ivB = Buffer.from(iv, 'base64url');
      const d = Buffer.from(data, 'base64url');
      if (ivB.length !== 12 || d.length < 17) return null;
      const dc = createDecipheriv('aes-256-gcm', nyckel, ivB);
      dc.setAAD(aad);
      dc.setAuthTag(d.subarray(d.length - 16));
      const v = JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString('utf8'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch { return null; }
  }
  function krypteradLogg(c) {
    const { kopiaId, rader, klocka } = c.body;
    if (typeof kopiaId !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(kopiaId)) throw new Fel(400, 'Ange läskopians id.', 'ogiltig', { falt: ['kopiaId'] });
    if (!Array.isArray(rader) || rader.length > 500) throw new Fel(400, 'Skicka högst 500 rader i en lista.', 'ogiltig', { falt: ['rader'] });
    const hittad = hittaKopia(kopiaId);
    if (!hittad) throw new Fel(404, 'Läskopian finns inte längre på servern, så åtkomsterna kan inte föras över.', 'saknas');
    const { s, kopia } = hittad;
    const pers = personalRad(s.db, kopia.personalId);
    const nyckel = Buffer.from(kopia.nyckel, 'base64url');
    const klara = [];
    const ogiltiga = [];
    for (const r of rader) {
      const id = typeof r?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(r.id) ? r.id : null;
      if (!id) { ogiltiga.push({ id: null, orsak: 'Raden saknar giltigt id.' }); continue; }
      const rad = dekrypteraRad(nyckel, loggAad(kopiaId, kopia.personalId, id), r.iv, r.data);
      if (!rad || rad.id !== id) { ogiltiga.push({ id, orsak: 'Raden kunde inte verifieras med läskopians nyckel.' }); continue; }
      klara.push(rad);
    }
    // Webbläsarens klocka när raderna skickades. Går den fel med mer än marginalen rättas radernas tider med skillnaden,
    // eftersom de är mätta med samma klocka. Mer än ett dygn fel räknas inte som en klocka som går fel.
    const k = typeof klocka === 'string' ? Date.parse(klocka) : NaN;
    const skillnad = Number.isFinite(k) && Math.abs(Date.now() - k) > KLOCKMARGINAL && Math.abs(Date.now() - k) < 24 * 3600_000 ? Date.now() - k : 0;
    const ut = taEmotRader(s.db, pers, kopia, klara, skillnad);
    return { mottagna: ut.mottagna, avvisade: [...ogiltiga, ...ut.avvisade] };
  }

  function registreraVal(c, p, { typ, syfte }) {
    const db = c.db;
    if (!VAL_TYPER.includes(typ)) throw new Fel(400, 'Okänt val.', 'ogiltig', { falt: ['typ'] });
    const s = typeof syfte === 'string' ? syfte.trim() : '';
    if (s.length < 3 || s.length > 300) throw new Fel(400, 'Ange syftet med valet.', 'ogiltig', { falt: ['syfte'] });
    const nuvarande = valFor(c.s, p.id);
    const atk = new Atkomst(db, c.personal, p.id, nuvarande, typ);
    if (!kanRoll(c.personal, typ)) { atk.logga(typ, 'nekad', null, 'nekad', s); throw new Fel(403, 'Din yrkesroll kan inte göra det valet.', 'nekad'); }
    const ve = vardenhetFor(db, c.personal.enhet_id);
    let grund;
    if (typ === 'nodatkomst') {
      if (harVardrelation(db, p.id, ve)) throw new Fel(400, 'Det finns redan en vårdrelation. Nödåtkomst behövs inte.', 'ogiltig');
      grund = 'nodatkomst';
    } else {
      const r = atk.krav(kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
      if (typ === 'samtycke_sparr') {
        if (!aktivaSparrar(db, p.id).some(e => e !== ve)) throw new Fel(400, 'Patienten har inga spärrade uppgifter.', 'ogiltig');
        grund = 'samtycke_sparr';
      } else if (typ === 'visa_identitet') {
        if (!p.skyddad) throw new Fel(400, 'Patienten har inte skyddad identitet.', 'ogiltig');
        grund = r.grund;
      } else grund = r.grund === 'nodatkomst' ? 'nodatkomst' : 'aktivt_val';
    }
    c.s.val[p.id] = { ...(c.s.val[p.id] ?? {}), [typ]: { syfte: s, tid: new Date().toISOString() } };
    atk.logga(typ, grund, null, 'tillaten', s);
    return { ok: true, val: valFor(c.s, p.id) };
  }

  // Personalens API:er kräver personalens inloggning. En invånare som är inloggad i Min journal får samma svar som den
  // som inte är inloggad alls, och omvänt för Min journal.
  const kravInloggad = (c) => {
    if (!c.personal) throw new Fel(401, c.invanare ? 'Den här delen är för vårdens personal. Logga in med SITHS-kort.' : 'Logga in först.', 'ej_inloggad');
    return c.personal;
  };
  const kravInvanare = (c) => {
    if (!c.invanare) throw new Fel(401, 'Logga in med e-legitimation för att läsa din journal.', 'ej_inloggad');
    return c.invanare;
  };
  const kravRoll = (c, handling) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, handling)) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
  };

  // Routningstabell: metod, mönster, hanterare(c, ...parametrar).
  const R = [];
  const rutt = (metod, monster, fn) => R.push([metod, new RegExp(`^${monster.replace(/:\w+/g, '([^/]+)')}$`), fn]);

  rutt('GET', '/api/session', (c) => sessionUt(c.s));
  rutt('GET', '/api/demo/personal', (c) => c.db.query('SELECT * FROM personal WHERE demo = 1 ORDER BY rowid').all().map(p => ({
    id: p.id, namn: p.namn, yrke: p.yrke, yrkeText: YRKEN[p.yrke], titel: p.titel, enhet: enhetKort(c.db, p.enhet_id),
  })));
  rutt('POST', '/api/login', (c) => {
    const p = typeof c.body.personalId === 'string' ? c.db.query('SELECT * FROM personal WHERE id = ? AND demo = 1').get(c.body.personalId) : null;
    if (!p) throw new Fel(400, 'Välj en av demorollerna.', 'ogiltig', { falt: ['personalId'] });
    avslutaKopia(c.s, aktuellKopia(c.s), 'inloggning');
    c.s.personalId = p.id;
    c.s.invanareId = null;
    c.s.val = {};
    // Ny nyckel och ny läskopia vid varje inloggning, så att en tidigare persons kopia inte går att läsa. Den förra
    // läskopian finns kvar på servern tills den går ut, bara för att kunna ta emot loggen från läsläget.
    c.s.lasnyckel = null;
    c.s.oppnade = new Set();
    sakraKopia(c.s);
    c.rotera = true;
    return sessionUt(c.s);
  });
  // Utloggning efter ett avbrott kan ha med sig åtkomsterna från läsläget. De loggas innan sessionen avslutas,
  // eftersom de annars aldrig går att föra över.
  // Sessionen avslutas alltid, även om raderna inte går att ta emot.
  rutt('POST', '/api/logout', (c) => {
    let lasloggen;
    try {
      if (c.personal && Array.isArray(c.body?.rader)) lasloggen = lasekopiaLogg(c);
      // Bara personalen har läskopia. Rader från läsläget i en session där ingen personal är inloggad tas inte emot,
      // och det står i svaret så att klienten kan säga det.
      else if (Array.isArray(c.body?.rader) && c.body.rader.length) {
        lasloggen = { mottagna: 0, avvisade: [], fel: 'Åtkomsterna från läsläget kunde inte tas emot, eftersom ingen personal är inloggad i sessionen.' };
      }
    } catch (e) {
      lasloggen = { mottagna: 0, avvisade: [], fel: e instanceof Fel ? e.message : 'Raderna kunde inte tas emot.' };
    } finally {
      // Läskopian stängs: rader från läsningar före utloggningen tas fortfarande emot, senare läsningar inte.
      const akt = aktuellKopia(c.s);
      if (akt) akt.stangd = new Date().toISOString();
      avslutaKopia(c.s, akt, 'utloggning');
      c.s.personalId = null; c.s.invanareId = null; c.s.val = {}; c.s.lasnyckel = null; c.s.oppnade = new Set();
    }
    return { ...sessionUt(c.s), ...(lasloggen ? { lasloggen } : {}) };
  });
  // Inloggning i Min journal med simulerad e-legitimation. Personalens inloggning, val och läskopia nollställs, och
  // sessionskakan byts som vid personalens inloggning.
  rutt('GET', '/api/demo/invanare', (c) => minJournal.demoInvanare(c.db));
  rutt('POST', '/api/login/invanare', (c) => {
    const inv = minJournal.provaInloggning(c.db, c.body.invanareId);
    c.s.invanareId = inv.id;
    c.s.personalId = null;
    c.s.val = {};
    // Personalens läskopia stängs som vid utloggning.
    const akt = aktuellKopia(c.s);
    if (akt) akt.stangd = new Date().toISOString();
    avslutaKopia(c.s, akt, 'invanare');
    c.s.lasnyckel = null;
    c.s.oppnade = new Set();
    c.rotera = true;
    return sessionUt(c.s);
  });
  rutt('POST', '/api/reset', (c) => {
    c.s.db.close();
    c.s.db = nySessionsDb();
    c.s.val = {};
    c.s.oppnade = new Set();
    // Den nya sandlådan har en ny logg, så läskopian lämnas ut och loggas på nytt där. Läskopior från tidigare
    // inloggningar hör till den gamla sandlådan och glöms.
    const akt = aktuellKopia(c.s);
    c.s.kopior = new Map(akt ? [[c.s.lasnyckel.id, { ...akt, patienter: new Map() }]] : []);
    return { ok: true, ...sessionUt(c.s) };
  });
  rutt('GET', '/api/enheter', (c) => {
    const alla = c.db.query('SELECT * FROM enheter').all();
    const nod = (e) => ({ id: e.id, hsaId: e.hsa_id, namn: e.namn, kortnamn: e.kortnamn, typ: e.typ, barn: alla.filter(b => b.forald_id === e.id).map(nod) });
    return alla.filter(e => !e.forald_id).map(nod);
  });
  rutt('GET', '/api/arbetslista', (c) => { kravInloggad(c); return arbetslista(c); });
  rutt('GET', '/api/sok', (c) => { kravInloggad(c); return sok(c, c.url.searchParams.get('q')); });
  rutt('GET', '/api/vantrum', (c) => { kravInloggad(c); return vantrum(c); });
  rutt('GET', '/api/lasekopia', (c) => { kravInloggad(c); return lasekopia(c); });
  rutt('POST', '/api/lasekopia/logg', (c) => { kravInloggad(c); return lasekopiaLogg(c); });
  rutt('POST', '/api/lasekopia/krypterad-logg', (c) => krypteradLogg(c));

  rutt('GET', '/api/patient/:id', (c, id) => {
    kravInloggad(c);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    const ut = medPatient(c, id, handling, (atk, p) => patientHuvud(c, atk, p));
    c.s.oppnade.add(ut.id);
    return ut;
  });
  rutt('POST', '/api/patient/:id/val', (c, id) => { kravInloggad(c); return registreraVal(c, patientRad(c.db, id), c.body); });
  rutt('GET', '/api/patient/:id/oversikt', (c, id) => {
    kravInloggad(c);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    return medPatient(c, id, handling, (atk, p) => oversikt(c, atk, p));
  });
  rutt('GET', '/api/patient/:id/anteckningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => journal.listaAnteckningar(atk)); });
  rutt('POST', '/api/patient/:id/anteckningar', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, journal.skrivHandling(journal.MALLAR.find(m => m.typ === c.body.typ)?.kategori), (atk) => vardkontakt.knyt(atk, 'anteckningar', journal.skapaAnteckning(atk, c.body), c.body))];
  });
  const medAnteckning = (c, id, handling, fn) => {
    kravInloggad(c);
    const a = journal.hamtaAnteckningRad(c.db, id);
    return medPatient(c, a.patient_id, handling(a), (atk) => fn(atk, a));
  };
  rutt('GET', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.lasHandling(a.kategori), (atk, a) => utdata.anteckning(c.db, c.personal, journal.hamtaAnteckning(atk, a))));
  rutt('PUT', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.andraUtkast(atk, a, c.body)));
  rutt('POST', '/api/anteckning/:id/signera', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.signera(atk, a)));
  rutt('POST', '/api/anteckning/:id/ratta', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => [201, journal.ratta(atk, a, c.body)]));
  rutt('GET', '/api/mallar', () => journal.MALLAR);

  rutt('GET', '/api/patient/:id/lakemedel', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => lakemedel.lista(atk)); });
  rutt('GET', '/api/lakemedel/katalog', (c) => { kravInloggad(c); return lakemedel.sokKatalog(c.db, c.url.searchParams.get('q') ?? ''); });
  rutt('POST', '/api/patient/:id/lakemedel/kontroll', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => lakemedel.kontroll(atk, c.body)); });
  rutt('POST', '/api/patient/:id/lakemedel', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'ordinera', (atk) => {
      // Tillägget (administrationssätt, mall, vårdhändelse och volym) kontrolleras innan ordinationen sparas.
      // Vårdhändelsen i tidboken (vardhandelse.js) prövas först, så att en nekad koppling inte lämnar en ordination.
      // Väljs en bokning eller en post på väntelistan bestämmer servern vårdhändelsens text.
      const koppling = vardhandelse.forbered(atk, c.body);
      const kropp = koppling ? { ...c.body, vardhandelse: { ...c.body.vardhandelse, text: koppling.text } } : c.body;
      const tillagg = ordinationsmallar.valideraTillagg(c.db, kropp);
      const ut = lakemedel.spara(atk, kropp);
      ordinationsmallar.sparaTillagg(c.db, ut.ordination.id, tillagg);
      vardhandelse.knyt(atk, ut.ordination.id, koppling);
      Object.assign(ut.ordination, ordinationsmallar.tillaggUt(c.db, ut.ordination.id, { full: true }));
      return vardkontakt.knyt(atk, 'ordinationer', ut, c.body);
    })];
  });
  const medOrdination = (c, id, fn) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    return medPatient(c, o.patient_id, 'ordinera', (atk) => fn(atk, o));
  };
  rutt('POST', '/api/ordination/:id/utsatt', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.utsatt(atk, o, c.body)));
  rutt('POST', '/api/ordination/:id/nll-avstam', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.avstam(atk, o)));
  rutt('GET', '/api/ordination/:id/utsattning', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.utsattningskontroll(atk, o)));

  // Läkemedelsprocessen (Sussa 3.5): administrering, vidimering, läkemedelsgenomgång, fördefinierade ordinationer,
  // planerad vårdhändelse och vätskebalans. Behörigheten prövas i administrering.js och vidimering.js, och varje
  // anrop loggas på patienten som de andra anropen.
  const dagParam = (c) => { const d = c.url.searchParams.get('dag'); return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : idag(); };
  rutt('GET', '/api/administreringar', (c) => { kravInloggad(c); return administrering.avdelning(c.db, c.personal, (pid) => valFor(c.s, pid), { dag: dagParam(c) }); });
  rutt('GET', '/api/patient/:id/administreringar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => administrering.lista(atk, { dag: dagParam(c) })); });
  rutt('POST', '/api/patient/:id/administreringar/kontroll', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ge_lakemedel', (atk) => administrering.kontroll(atk, c.body)); });
  rutt('POST', '/api/patient/:id/administreringar', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ge_lakemedel', (atk) => vardkontakt.knyt(atk, 'administreringar', administrering.spara(atk, c.body), c.body))]; });
  rutt('GET', '/api/patient/:id/vidimering', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => vidimering.underlag(atk)); });
  rutt('POST', '/api/patient/:id/vidimering', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => vidimering.vidimera(atk))]; });
  rutt('GET', '/api/patient/:id/lakemedelsgenomgang', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => vidimering.genomgang(atk)); });
  rutt('POST', '/api/patient/:id/lakemedelsgenomgang', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => vidimering.sparaGenomgang(atk, c.body))]; });
  rutt('GET', '/api/patient/:id/lakemedel/forslag', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'ordinera', (atk) => {
      atk.krav('ordinera');
      const lm = c.db.query('SELECT * FROM katalog WHERE id = ?').get(c.url.searchParams.get('lakemedelId') ?? '');
      if (!lm) throw new Fel(400, 'Välj ett läkemedel i katalogen.', 'ogiltig', { falt: ['lakemedelId'] });
      return ordinationsmallar.forslag(atk, lm);
    });
  });
  rutt('POST', '/api/ordination/:id/vardhandelse', (c, id) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    const handling = kanRoll(c.personal, 'ordinera') ? 'ordinera' : 'ge_lakemedel';
    return medPatient(c, o.patient_id, handling, (atk) => {
      // Delegeringen omfattar doser, inte tiden för en vårdhändelse (runda 5).
      if (c.personal.yrke === 'underskoterska') {
        atk.logga(handling, 'nekad', `ordination:${o.id}`, 'nekad');
        throw new Fel(403, 'Tiden för en planerad vårdhändelse sätts av en sjuksköterska eller läkare.', 'nekad');
      }
      administrering.kravVardande(atk, handling, { enhet_id: o.enhet_id, gemensam: true }, `ordination:${o.id}`);
      // Säkerhetsgranskning runda 5: vårdhändelsens tid är den ordinerande vårdenhetens planering. Bara den vårdenheten
      // sätter den för hand, och ett försök från en annan vårdenhet nekas och loggas innan något ändras.
      if (vardenhetFor(c.db, o.enhet_id) !== vardenhetFor(c.db, c.personal.enhet_id)) {
        atk.logga(handling, 'nekad', `ordination:${o.id}:vardhandelse`, 'nekad');
        throw new Fel(403, 'Vårdhändelsens tid sätts av den vårdenhet som ordinerade läkemedlet.', 'nekad');
      }
      ordinationsmallar.tidsattHandelse(c.db, o.id, c.body.tid, c.personal.id);
      atk.logga(handling, atk.grund(), `ordination:${o.id}:vardhandelse`);
      // Tiden satt för hand är reserven: vårdhändelsen följer inte längre tidboken (vardhandelse.js).
      vardhandelse.efterHandTid(atk, o.id);
      return { ordinationId: o.id, ...ordinationsmallar.tillaggUt(c.db, o.id, { full: true }) };
    });
  });
  // Runda 5, r1: förslag på vårdhändelse ur tidboken när läkaren ordinerar (vardhandelse.js).
  rutt('GET', '/api/patient/:id/vardhandelse/forslag', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'ordinera', (atk) => vardhandelse.forslag(atk, { text: (c.url.searchParams.get('text') ?? '').slice(0, 300) }));
  });
  rutt('GET', '/api/patient/:id/vatskebalans', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_matvarden', (atk) => administrering.vatskebalans(atk, { dag: dagParam(c), brytning: c.url.searchParams.get('brytning') ?? '00' }));
  });
  rutt('POST', '/api/patient/:id/vatskebalans', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => vardkontakt.knyt(atk, 'vatskebalans', administrering.registreraVatska(atk, c.body), c.body))]; });
  // Delegering av läkemedelshantering (runda 5, HSLF-FS 2017:37 9 kap., delegering.js). Sjuksköterskan registrerar och
  // återkallar delegeringar för undersköterskorna på sin vårdenhet, och undersköterskan ser sina egna. Varje
  // registrering och varje nekat försök loggas.
  rutt('GET', '/api/delegeringar', (c) => delegering.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/delegeringar', (c) => [201, delegering.registrera(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/delegering/:id/aterkalla', (c, id) => delegering.aterkalla(c.db, kravInloggad(c), id, c.body));
  // Nästa överföring till NLL får timeout. Med { lage: 'fel' } får den i stället ett felsvar.
  rutt('POST', '/api/demo/nll-timeout', (c) => {
    kravInloggad(c);
    const lage = c.body.lage === 'fel' ? 'fel' : 'timeout';
    installning(c.db, 'nll_nasta', lage);
    return { ok: true, nastaOverforing: lage };
  });

  // Uppmärksamhetsinformation (Sussa 3.1.5): bekräfta ett förslag eller registrera ur listan, avfärda ett förslag och
  // avsluta en uppgift. Behörigheten prövas i uppmarksamhet.js och anropet loggas som skriv_journal.
  rutt('GET', '/api/uppmarksamhet/termer', (c) => { kravInloggad(c); return uppmarksamhet.termer(); });
  rutt('POST', '/api/patient/:id/uppmarksamhet', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'skriv_journal', (atk) => uppmarksamhet.registrera(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/uppmarksamhet/avfard', (c, id) => { kravInloggad(c); return medPatient(c, id, 'skriv_journal', (atk) => uppmarksamhet.avfarda(atk, c.body)); });
  rutt('POST', '/api/uppmarksamhet/:id/avsluta', (c, id) => {
    kravInloggad(c);
    const r = uppmarksamhet.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, 'skriv_journal', (atk) => uppmarksamhet.avsluta(atk, r, c.body));
  });

  rutt('GET', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk) => journal.listaMatvarden(atk)); });
  rutt('POST', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => vardkontakt.knyt(atk, 'matvarden', journal.registreraMatvarde(atk, c.body), c.body))]; });

  rutt('GET', '/api/patient/:id/remisser', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, kanRoll(c.personal, 'las_remiss') ? 'las_remiss' : 'las_remiss_status', (atk) => remiss.forPatient(atk));
  });
  rutt('POST', '/api/patient/:id/remisser', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'remittera', (atk) => vardkontakt.knyt(atk, 'remisser', remiss.skapa(atk, c.body), c.body))]; });
  rutt('GET', '/api/remisser', (c) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, 'las_remiss') && !kanRoll(c.personal, 'las_remiss_status')) throw new Fel(403, 'Din yrkesroll har inte tillgång till remisser.', 'nekad');
    const riktning = c.url.searchParams.get('riktning') === 'utgaende' ? 'utgaende' : 'inkommande';
    return { riktning, remisser: remiss.lista(c.db, c.personal, riktning) };
  });
  const medRemiss = (c, id, handling, fn) => {
    kravInloggad(c);
    const r = remiss.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, handling, (atk) => fn(atk, r));
  };
  rutt('POST', '/api/remiss/:id/mottag', (c, id) => medRemiss(c, id, 'mottag_remiss', (atk, r) => remiss.mottag(atk, r)));
  // En accepterad remiss hamnar på väntelistan av sig själv (tidbok.js). Läkaren kan ange tidstyp och yrkesroll.
  rutt('POST', '/api/remiss/:id/bedom', (c, id) => medRemiss(c, id, 'bedom_remiss', (atk, r) => {
    const ut = remiss.bedom(atk, r, c.body);
    if (c.body.beslut === 'accepterad') ut.vantelista = tidbok.efterBedomning(c.db, remiss.hamtaRad(c.db, r.id), c.body);
    // En avvisad remiss är inte längre grund för de tider som bokades på den.
    if (c.body.beslut === 'avvisad') ut.avbokade = tidbok.efterAvvisning(c.db, remiss.hamtaRad(c.db, r.id), c.personal);
    return ut;
  }));
  rutt('POST', '/api/remiss/:id/svara', (c, id) => medRemiss(c, id, 'svara_remiss', (atk, r) => remiss.svara(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/kvittera-svar', (c, id) => medRemiss(c, id, 'kvittera_svar', (atk, r) => remiss.kvitteraSvar(atk, r)));

  // Vårdkontakt, vårdtillfälle och hälsoärende (vardkontakt.js). All prövning sker i behörighetsmotorn och varje
  // anrop loggas på patienten, som de andra anropen.
  const synligt = (atk) => ({ kontakter: journal.synligaVardkontakter(atk), diagnoser: kanRoll(atk.personal, 'las_diagnoser') ? journal.synligaDiagnoser(atk) : [] });
  const medKontakt = (c, id, handling, fn) => {
    kravInloggad(c);
    const v = vardkontakt.hamtaKontakt(c.db, id);
    return medPatient(c, v.patient_id, handling, (atk) => fn(atk, v));
  };
  const medVardtillfalle = (c, id, handling, fn) => {
    kravInloggad(c);
    const vt = vardkontakt.hamtaVardtillfalle(c.db, id);
    return medPatient(c, vt.patient_id, handling, (atk) => fn(atk, vt));
  };
  const lasning = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  // Avdelningarna som tar emot inneliggande patienter, för inskrivning och flytt. Inga patientuppgifter.
  rutt('GET', '/api/avdelningar', (c) => { kravInloggad(c); return vardkontakt.avdelningar(c.db); });
  rutt('GET', '/api/patient/:id/vardkontakt/aktuell', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => vardkontakt.aktuell(atk)); });
  rutt('POST', '/api/patient/:id/vardkontakter', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_vardkontakt', (atk) => vardkontakt.registrera(atk, c.body)); });
  rutt('GET', '/api/vardkontakt/:id', (c, id) => medKontakt(c, id, lasning(c), (atk, v) => vardkontakt.kontaktMedInnehall(atk, v)));
  rutt('PATCH', '/api/vardkontakt/:id', (c, id) => medKontakt(c, id, 'registrera_vardkontakt', (atk, v) => vardkontakt.andra(atk, v, c.body)));
  rutt('POST', '/api/vardkontakt/:id/avsluta', (c, id) => medKontakt(c, id, 'registrera_vardkontakt', (atk, v) => vardkontakt.avsluta(atk, v)));
  rutt('POST', '/api/patient/:id/vardtillfallen', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vardtillfalle', (atk) => vardkontakt.skrivIn(atk, c.body)); });
  rutt('GET', '/api/vardtillfalle/:id', (c, id) => medVardtillfalle(c, id, 'las_admin', (atk, vt) => vardkontakt.lasVardtillfalle(atk, vt)));
  rutt('POST', '/api/vardtillfalle/:id/flytta', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.flytta(atk, vt, c.body)));
  rutt('POST', '/api/vardtillfalle/:id/permission', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.permission(atk, vt, c.body)));
  rutt('POST', '/api/vardtillfalle/:id/permission/avsluta', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.aterFranPermission(atk, vt)));
  rutt('POST', '/api/vardtillfalle/:id/skriv-ut', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.skrivUt(atk, vt)));
  rutt('POST', '/api/patient/:id/halsoarenden', (c, id) => { kravInloggad(c); return medPatient(c, id, 'halsoarende', (atk) => { const x = synligt(atk); return vardkontakt.bekrafta(atk, c.body, x.kontakter, x.diagnoser); }); });
  rutt('POST', '/api/patient/:id/halsoarenden/avvisa', (c, id) => { kravInloggad(c); return medPatient(c, id, 'halsoarende', (atk) => { const x = synligt(atk); return vardkontakt.avvisa(atk, c.body, x.kontakter, x.diagnoser); }); });

  // Tidbok, väntelista, kallelser, incheckning och betalning (tidbok.js, Sussa 3.4.1 till 3.4.4). Varje åtgärd prövas i
  // behörighetsmotorn med handlingarna boka, kalla, checka_in och vantelista, och loggas på patienten. Listorna
  // (startsidan, tidboken och väntelistan) visar bara patienter med vårdrelation på vårdenheten, som arbetslistan.
  const medPost = (c, id, handling, fn) => { kravInloggad(c); const v = tidbok.vantelistaRad(c.db, id); return medPatient(c, v.patient_id, handling, (atk) => fn(atk, v)); };
  const medBokning = (c, id, handling, fn) => { kravInloggad(c); const b = tidbok.bokningRad(c.db, id); return medPatient(c, b.patient_id, handling, (atk) => fn(atk, b)); };
  rutt('GET', '/api/idag', (c) => { kravRoll(c, 'boka'); return tidbok.startsida(c.db, c.personal); });
  rutt('GET', '/api/tidbok', (c) => {
    kravRoll(c, 'boka');
    const d = c.url.searchParams.get('datum');
    return tidbok.tidbok(c.db, c.personal, { datum: /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d : idag(), avidentifierad: c.url.searchParams.get('avidentifierad') === '1' });
  });
  rutt('GET', '/api/vantelista', (c) => { kravRoll(c, 'vantelista'); return { poster: tidbok.vantelista(c.db, c.personal), prioriteringsorsaker: tidbok.OMPRIORITERING, demoregler: tidbok.DEMOREGLER.text }; });
  rutt('GET', '/api/vantelista/:id/forslag', (c, id) => medPost(c, id, 'boka', (atk, v) => tidbok.forslagForPost(atk, v)));
  rutt('POST', '/api/vantelista/:id/boka', (c, id) => medPost(c, id, 'boka', (atk, v) => tidbok.boka(atk, v, c.body)));
  rutt('POST', '/api/vantelista/:id/prioritet', (c, id) => medPost(c, id, 'vantelista', (atk, v) => tidbok.prioritera(atk, v, c.body)));
  rutt('POST', '/api/patient/:id/vantelista', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vantelista', (atk) => tidbok.nyPost(atk, c.body)); });
  rutt('GET', '/api/patient/:id/bokningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => tidbok.patientensBokningar(atk)); });
  // Runda 5, r1: läkaren sätter upp ett återbesök som systemet föreslår (aterbesok.js).
  rutt('GET', '/api/patient/:id/aterbesok/forslag', (c, id) => {
    kravInloggad(c);
    const a = c.url.searchParams.get('anteckningId');
    return medPatient(c, id, 'skriv_journal', (atk) => aterbesok.forslag(atk, { anteckningId: a ? Number(a) : null }));
  });
  rutt('POST', '/api/patient/:id/aterbesok', (c, id) => { kravInloggad(c); return medPatient(c, id, 'skriv_journal', (atk) => aterbesok.skapa(atk, c.body)); });
  rutt('GET', '/api/bokning/:id/forslag', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.forslagForBokning(atk, b)));
  rutt('POST', '/api/bokning/:id/omboka', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.omboka(atk, b, c.body)));
  rutt('POST', '/api/bokning/:id/avboka', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.avboka(atk, b, c.body)));
  rutt('POST', '/api/bokning/:id/checka-in', (c, id) => medBokning(c, id, 'checka_in', (atk, b) => tidbok.checkaIn(atk, b)));
  rutt('POST', '/api/bokning/:id/betala', (c, id) => medBokning(c, id, 'checka_in', (atk, b) => tidbok.betala(atk, b, c.body)));
  rutt('POST', '/api/kallelse/:id/klar', (c, id) => {
    kravInloggad(c);
    const k = c.db.query('SELECT * FROM kallelser WHERE id = ?').get(Number(id));
    if (!k) throw new Fel(404, 'Kallelsen finns inte.', 'saknas');
    return medPatient(c, k.patient_id, 'kalla', (atk) => tidbok.kallelseKlar(atk, k));
  });
  rutt('POST', '/api/tid/:id/kalla', (c, id) => { kravRoll(c, 'kalla'); return tidbok.kallaGrupp(c.db, c.personal, tidbok.tidRad(c.db, id), { valFor: (pid) => valFor(c.s, pid), Atkomst }); });
  rutt('POST', '/api/bevakning/:id/klar', (c, id) => { kravInloggad(c); const b = tidbok.bevakningRad(c.db, id); return medPatient(c, b.patient_id, 'vantelista', (atk) => tidbok.bevakningKlar(atk, b)); });
  // Incheckningsskärmen i väntrummet (simulerad). Skärmen öppnas av vårdadministratören och visar aldrig namn.
  // Högst 10 misslyckade försök per session på 15 minuter, så att skärmen inte kan användas för att pröva personnummer.
  const SKARM_FORSOK = 10;
  rutt('POST', '/api/incheckning/skarm', (c) => {
    kravRoll(c, 'checka_in');
    const forsok = (c.s.skarmForsok ?? []).filter(t => t > Date.now() - 15 * 60_000);
    c.s.skarmForsok = forsok;
    if (forsok.length >= SKARM_FORSOK) throw new Fel(403, 'För många försök på skärmen. Be personalen i receptionen om hjälp.', 'nekad');
    const far = (pid) => new Atkomst(c.db, c.personal, pid, {}, 'checka_in').prova('checka_in').tillaten;
    const { patientId, bokningId, ...ut } = tidbok.skarmIncheckning(c.db, c.personal, c.body.personnummer, { far });
    if (!ut.ok) forsok.push(Date.now());
    if (ut.ok) {
      new Atkomst(c.db, c.personal, patientId, {}, 'checka_in').logga('checka_in', 'administrativ', `incheckning:skarm:bokning:${bokningId}`, 'tillaten',
        'Patienten checkade in på incheckningsskärmen i väntrummet.');
    }
    return ut;
  });

  rutt('GET', '/api/inkorg', (c) => {
    const p = kravInloggad(c);
    const med = (x) => ({ ...x, patient: patientKort(patientRad(c.db, x.patientId)) });
    return {
      osigneradeAnteckningar: journal.osigneradeFor(c.db, p.id).map(med),
      okvitteradeSvar: kanRoll(p, 'kvittera_svar') ? remiss.okvitteradeSvar(c.db, p) : [],
      larm: p.yrke === 'logggranskare' ? [] : remiss.larmForEnhet(c.db, p),
      nllAvvikelser: kanRoll(p, 'las_lakemedel') ? lakemedel.nllAvvikelser(c.db, p).map(med) : [],
      dubbletter: kanRoll(p, 'sla_samman') ? dubbletterIInkorg(c) : [],
      ...utdata.inkorg(c.db, p),
      // Delegeringar som går ut inom 30 dagar, för sjuksköterskan på samma vårdenhet (runda 5).
      delegeringarSomGarUt: delegering.paminnelser(c.db, p),
      // Återinsättning efter uppehåll med antikoagulantia, för läkaren (runda 5, r4).
      aterinsattningar: aterinsattningIInkorg(c),
    };
  });
  // Återinsättning efter uppehåll (runda 5, r4). Behörigheten prövas i aterinsattning.js. Varje rad visar läkemedlet
  // för en patient och loggas därför på patienten, en gång per session och ordination, så att inkorgens uppdateringar
  // inte fyller loggen.
  function aterinsattningIInkorg(c) {
    const loggade = (c.s.aterinsattningLoggad ??= new Set());
    return aterinsattning.inkorg(c.db, c.personal).map(r => {
      if (!loggade.has(r.ordinationId)) {
        loggade.add(r.ordinationId);
        const a = new Atkomst(c.db, c.personal, r.patientId, {}, 'las_lakemedel');
        a.logga('las_lakemedel', a.prova('las_lakemedel').grund, `inkorg:aterinsattning:${r.ordinationId}`);
      }
      return { ...r, patient: patientKort(patientRad(c.db, r.patientId)) };
    });
  }

  // Identiteter (Sussa 3.1.1). Systemet tolkar numret, skapar reservnummer, byter identitet när ett personnummer blir
  // känt och föreslår själv sammanslagning av dubbletter, som en vårdadministratör bekräftar. Allt prövas i
  // behörighetsmotorn och loggas.
  const identitetKort = (p, visad = false) => ({
    ...patientKort(p), namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad), identitetstyp: p.id_typ, typText: identitet.TYPER[p.id_typ].text,
    fodd: p.skyddad && !visad ? null : p.fodd, kon: p.kon,
  });
  const lasHandling = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  // Patienterna med en trolig dubblett, för vårdadministratörens inkorg. Bara patienter med vårdrelation på den egna
  // vårdenheten, och inga uppgifter om den andra journalen: de visas och loggas när förslaget öppnas.
  function dubbletterIInkorg(c) {
    const ut = [];
    for (const rad of arbetslista(c)) {
      const n = identitet.dubbletterFor(c.db, rad.id).length;
      if (n) ut.push({ patientId: rad.id, patient: patientKort(patientRad(c.db, rad.id)), antal: n });
    }
    return ut;
  }
  rutt('GET', '/api/identitet/tolka', (c) => {
    kravInloggad(c);
    const t = identitet.tolka(String(c.url.searchParams.get('q') ?? '').slice(0, 80));
    return { ...t, demoFel: identitet.demoKontroll(t) };
  });
  rutt('POST', '/api/patienter', (c) => {
    kravRoll(c, 'registrera_patient');
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'registrera_patient');
    atk.krav('registrera_patient');
    let r;
    try { r = identitet.registrera(db, c.body, { idag: idag(), av: c.personal.id }); } catch (e) {
      if (e.kod === 'finns') e.extra = { patient: patientKort(patientRad(db, e.extra.patientId)) };
      throw e;
    }
    // Den nya patienten får en pågående vårdkontakt på den enhet som registrerade, så att vården kan dokumentera direkt.
    const enhet = db.query('SELECT namn FROM enheter WHERE id = ?').get(vardenhetFor(db, c.personal.enhet_id));
    const typ = /akut/i.test(enhet?.namn ?? '') ? 'akut' : 'oppenvard';
    db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, orsak) VALUES (?, ?, ?, ?, ?)').run(r.id, c.personal.enhet_id, typ, new Date().toISOString(), 'Registrerad som ny patient');
    atk.patientId = r.id;
    atk.logga('registrera_patient', c.personal.yrke === 'vardadministrator' ? 'administrativ' : 'vardrelation', `registrering:${r.typ}`);
    const p = patientRad(db, r.id);
    return [201, { patient: identitetKort(p, true), skapatReservnummer: r.skapatReservnummer }];
  });
  rutt('GET', '/api/patient/:id/identiteter', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, lasHandling(c), (atk, p) => {
      atk.krav(lasHandling(c));
      const db = c.db;
      const val = valFor(c.s, p.id);
      const visad = !p.skyddad || val.visa_identitet;
      const slaSamman = kanRoll(c.personal, 'sla_samman');
      const dubbletter = slaSamman ? identitet.dubbletterFor(db, p.id).map(d => {
        const annan = db.query('SELECT * FROM patienter WHERE id = ?').get(d.annan);
        // Att förslaget visas loggas på den andra journalen, som en sökträff.
        loggaRadFor(c, annan.id, 'dubblettkontroll', `dubblett:${p.id}`);
        return { annan: identitetKort(annan), kvar: d.till, grund: d.grund, grundText: identitet.GRUNDTEXT[d.grund] };
      }) : [];
      return {
        patientId: p.id, patient: identitetKort(p, visad), identiteter: identitet.identiteterUt(db, p.id, visad),
        sammanslagningar: identitet.sammanslagningarFor(db, p.id).map(s => ({ ...s, franPatient: identitetKort(db.query('SELECT * FROM patienter WHERE id = ?').get(s.fran), visad) })),
        dubbletter, kan: { andraIdentitet: kanRoll(c.personal, 'andra_identitet'), slaSamman },
      };
    });
  });
  rutt('POST', '/api/patient/:id/identitet', (c, id) => {
    kravRoll(c, 'andra_identitet');
    return medPatient(c, id, 'andra_identitet', (atk, p) => {
      atk.krav('andra_identitet');
      const text = typeof c.body.identitet === 'string' ? c.body.identitet : '';
      const t = identitet.tolka(text);
      if (!t.arIdentitet) throw new Fel(400, 'Det går inte att tolka som ett nummer. Skriv personnummer, samordningsnummer eller OID och nummer.', 'ogiltig', { falt: ['identitet'] });
      if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['identitet'] });
      const demo = identitet.demoKontroll(t);
      if (demo) throw new Fel(400, demo, 'ogiltig', { falt: ['identitet'] });
      let r;
      try { r = identitet.nyIdentitet(c.db, p, t, { personal: c.personal }); } catch (e) {
        if (e.kod === 'dubblett') {
          atk.logga('andra_identitet', atk.grund(), `identitet:${t.typ}:dubblett`);
          const annan = c.db.query('SELECT * FROM patienter WHERE id = ?').get(e.extra.annanId);
          loggaRadFor(c, annan.id, 'dubblettkontroll', `dubblett:${p.id}`);
          e.extra = { annan: identitetKort(annan), kanSlaSamman: kanRoll(c.personal, 'sla_samman') };
        }
        throw e;
      }
      atk.logga('andra_identitet', atk.grund(), `identitet:${t.typ}:${r.utfall}`);
      return { utfall: r.utfall, identitet: { typ: t.typ, typText: t.typText, visning: t.visning, beskrivning: t.beskrivning } };
    });
  });
  rutt('POST', '/api/patient/:id/sammanslagning', (c, id) => {
    kravRoll(c, 'sla_samman');
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), 'sla_samman');
    atk.krav('sla_samman');
    const med = typeof c.body.med === 'string' ? identitet.gallandeId(c.db, c.body.med) : null;
    const forslag = identitet.dubbletterFor(c.db, p.id).find(d => d.annan === med);
    if (!forslag) throw new Fel(400, 'Systemet har inget förslag om att slå samman de här journalerna. Två journaler slås bara samman när systemet har hittat att de troligen gäller samma person.', 'ogiltig', { falt: ['med'] });
    // Behörigheten prövas mot båda journalerna. Ett förslag om att två journaler gäller samma person är ingen behörighet:
    // annars kunde den som skriver in en annan patients nummer få tillgång till den patientens journal genom sammanslagningen.
    const annan = forslag.fran === p.id ? forslag.till : forslag.fran;
    const atkAnnan = new Atkomst(c.db, c.personal, annan, valFor(c.s, annan), 'sla_samman');
    atkAnnan.krav('sla_samman');
    const r = identitet.slaSamman(c.db, { fran: forslag.fran, till: forslag.till, personal: c.personal, grund: forslag.grund, loggGrund: atk.grund() });
    if (c.s.oppnade.delete(forslag.fran)) c.s.oppnade.add(forslag.till);
    return { till: r.till, fran: r.fran, antal: r.antal, patient: identitetKort(patientRad(c.db, r.till)) };
  });
  rutt('POST', '/api/patient/:id/dubblett/avfarda', (c, id) => {
    kravRoll(c, 'sla_samman');
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), 'sla_samman');
    atk.krav('sla_samman');
    const med = typeof c.body.med === 'string' ? c.body.med : null;
    const forslag = identitet.dubbletterFor(c.db, p.id).find(d => d.annan === med);
    if (!forslag) throw new Fel(400, 'Det finns inget sådant förslag.', 'ogiltig', { falt: ['med'] });
    const nu = new Date().toISOString();
    c.db.query("UPDATE dubblettforslag SET status = 'avfardad', avgjord = ?, avgjord_av = ? WHERE status = 'oppen' AND ((fran_patient_id = ?3 AND till_patient_id = ?4) OR (fran_patient_id = ?4 AND till_patient_id = ?3))")
      .run(nu, c.personal.id, forslag.fran, forslag.till);
    c.db.query("INSERT INTO dubblettforslag (fran_patient_id, till_patient_id, grund, skapad, av, status, avgjord, avgjord_av) VALUES (?, ?, ?, ?, ?, 'avfardad', ?, ?)")
      .run(forslag.fran, forslag.till, forslag.grund, nu, c.personal.id, nu, c.personal.id);
    atk.logga('dubblett_avfardad', atk.grund(), `dubblett:${forslag.fran}>${forslag.till}`);
    return { ok: true };
  });
  // En loggrad om en annan journal än den som öppnades, till exempel när ett förslag om sammanslagning visar den.
  function loggaRadFor(c, patientId, handling, resurs) {
    new Atkomst(c.db, c.personal, patientId, {}, handling).logga(handling, 'administrativ', resurs);
  }

  // Loggraderna får patientens namn och personnummer, maskerade för skyddad identitet, så att granskaren ser vem raden gäller.
  const medPatientKort = (db, rader) => {
    const cache = new Map();
    return rader.map(r => {
      if (!r.patientId) return { ...r, patient: null };
      if (!cache.has(r.patientId)) {
        const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patientId);
        cache.set(r.patientId, p ? patientKort(p) : null);
      }
      return { ...r, patient: cache.get(r.patientId) };
    });
  };
  rutt('GET', '/api/patient/:id/logglista', (c, id) => {
    kravInloggad(c);
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, {}, 'las_logg');
    atk.krav('las_logg');
    atk.logga('las_logg', 'logggranskning', 'logglista');
    return { patientId: p.id, patient: patientKort(p), rader: medPatientKort(c.db, logg.lista(c.db, { patientId: identitet.allaPatientIdn(c.db, p.id) })), kedjaHel: logg.verifiera(c.db).hel };
  });
  rutt('GET', '/api/logg', (c) => {
    kravInloggad(c);
    const atk = new Atkomst(c.db, c.personal, null, {}, 'las_logg');
    atk.krav('las_logg');
    const q = c.url.searchParams;
    const flagga = ['nodatkomst', 'nekad', 'samtycke', 'vard', 'arkiv', 'alla'].includes(q.get('flagga')) ? q.get('flagga') : 'alla';
    const datum = (v, slut) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}${slut ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : v || null);
    const rader = medPatientKort(c.db, logg.lista(c.db, { flagga, fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) }));
    atk.logga('las_logg', 'logggranskning', `logg:${flagga}`);
    const v = logg.verifiera(c.db);
    return { flagga, rader, kedjaHel: v.hel, verifiering: v };
  });

  // Min journal. Varje anrop prövar att invånaren får läsa just den journalen och loggar läsningen.
  // Nekade försök räknas per invånare och sandlåda, också över ut- och inloggningar.
  const nekadeFor = (c) => ((c.s.nekadeInvanare ??= {})[c.invanare.id] ??= { antal: 0 });
  const medMinJournal = (c, pid, resurs, fn) => {
    kravInvanare(c);
    const atk = new minJournal.InvanareAtkomst(c.db, c.invanare, pid, nekadeFor(c));
    atk.krav(resurs);
    const ut = fn(atk);
    if (!atk.loggad) atk.logga(resurs);
    return ut;
  };
  const MIN_DELAR = {
    oversikt: minJournal.oversikt, anteckningar: minJournal.anteckningar, diagnoser: minJournal.diagnoser, lakemedel: minJournal.lakemedel,
    provsvar: minJournal.provsvar, remisser: minJournal.remisser, vardkontakter: minJournal.vardkontakter, logglista: minJournal.logglista,
    sparrar: minJournal.sparrvy, tider: tidbok.minaTider,
  };
  rutt('GET', '/api/min/journal/:id', (c, id) => medMinJournal(c, id, 'min:journal', (atk) => minJournal.huvud(atk)));
  rutt('GET', '/api/min/journal/:id/:del', (c, id, del) => {
    if (!Object.hasOwn(MIN_DELAR, del)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return medMinJournal(c, id, `min:${del}`, (atk) => MIN_DELAR[del](atk));
  });
  rutt('GET', '/api/min/journal/:id/anteckning/:aid', (c, id, aid) => medMinJournal(c, id, `min:anteckning:${Number(aid) || 0}`, (atk) => minJournal.anteckning(atk, aid)));
  rutt('POST', '/api/min/journal/:id/begaran', (c, id) => [201, medMinJournal(c, id, 'min:begaran', (atk) => minJournal.skapaBegaran(atk, c.body))]);
  // Patientens egna tider i Min journal: incheckning, ombokning, avbokning, bekräftelse, betalning och egen bokning.
  rutt('GET', '/api/min/journal/:id/bokning/:bid/forslag', (c, id, bid) => medMinJournal(c, id, `min:bokning:${Number(bid) || 0}:forslag`, (atk) => tidbok.minForslag(atk, bid)));
  const MIN_BOKNING = { 'checka-in': tidbok.minCheckaIn, omboka: tidbok.minOmboka, avboka: tidbok.minAvboka, bekrafta: tidbok.minBekrafta, betala: tidbok.minBetala };
  rutt('POST', '/api/min/journal/:id/bokning/:bid/:atgard', (c, id, bid, atgard) => {
    if (!Object.hasOwn(MIN_BOKNING, atgard)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return medMinJournal(c, id, `min:bokning:${Number(bid) || 0}`, (atk) => MIN_BOKNING[atgard](atk, bid, c.body));
  });
  rutt('GET', '/api/min/journal/:id/boka/forslag', (c, id) => medMinJournal(c, id, 'min:boka:forslag', (atk) => tidbok.minNyaForslag(atk, c.url.searchParams.get('nyckel'))));
  rutt('POST', '/api/min/journal/:id/boka', (c, id) => medMinJournal(c, id, 'min:boka', (atk) => tidbok.minBoka(atk, c.body)));

  rutt('GET', '/api/migrering', (c) => {
    kravInloggad(c);
    const datatyper = c.db.query('SELECT * FROM migrering ORDER BY datatyp, kalla').all().map(m => ({
      datatyp: m.datatyp, kalla: m.kalla, antalKalla: m.antal_kalla, antalOverforda: m.antal_overforda, antalVerifierade: m.antal_verifierade,
      avvikelse: m.antal_kalla !== m.antal_overforda || m.antal_overforda !== m.antal_verifierade,
    }));
    const avvikelser = c.db.query('SELECT * FROM migrering_avvikelser ORDER BY id').all().map(a => ({
      id: a.id, patientId: a.patient_id, datatyp: a.datatyp, kalla: a.kalla, beskrivning: a.beskrivning, atgard: a.atgard, status: a.status,
    }));
    return { datatyper, avvikelser, summa: { antalKalla: datatyper.reduce((s, d) => s + d.antalKalla, 0), antalOverforda: datatyper.reduce((s, d) => s + d.antalOverforda, 0), antalVerifierade: datatyper.reduce((s, d) => s + d.antalVerifierade, 0) } };
  });
  rutt('GET', '/api/krav', () => kravregister(lasTestresultat(testresultat), undefined, lasKlientresultat(klientresultat)));
  // Sussas kravspecifikation med originalnummer, mappad till Vårdkällan och till de egna kraven (K1).
  rutt('GET', '/api/krav/sussa', () => {
    const resultat = lasTestresultat(testresultat);
    const klient = lasKlientresultat(klientresultat);
    return sussaRegister(resultat, klient, { egna: kravregister(resultat, undefined, klient) });
  });
  // Svarstidsmål (D5): p95 under 200 ms per endpoint.
  const MAL_P95 = 200;
  const medMal = (rader) => rader.map(r => ({ ...r, inomMal: r.p95 <= MAL_P95 }));
  rutt('GET', '/api/drift', (c) => ({ startad, sandladar: sessioner.size, mal: { p95Ms: MAL_P95 }, server: medMal(serverMatning.sammanstall()), sandlada: c.s ? medMal(c.s.matning.sammanstall()) : [], ...utdata.drift(c.db) }));
  utdataRutter({ rutt, kravInloggad, medPatient, valFor, version: APPVERSION });

  // Endpoints som inte behöver en sandlåda.
  const UTAN_SESSION = new Set(['/api/health', '/api/krav', '/api/krav/sussa', '/api/drift', '/api/lasekopia/krypterad-logg']);

  async function api(req, server, url, c) {
    if (url.pathname === '/api/health') return json({ ok: true, sandladar: sessioner.size, version: APPVERSION, gransnitt: gransnittVersion() });
    const metod = req.method;
    if (metod !== 'GET' && metod !== 'HEAD') kontrolleraOrigin(req);
    let traff = null;
    for (const [m, re, fn] of R) {
      const x = url.pathname.match(re);
      if (x && m === metod) { traff = [fn, x.slice(1).map(decodeURIComponent)]; break; }
      if (x) traff = traff ?? 'metod';
    }
    if (!traff) throw new Fel(404, 'Okänd adress.', 'saknas');
    if (traff === 'metod') throw new Fel(405, 'Metoden stöds inte.', 'ogiltig');
    let sess = hamtaSession(req);
    if (!sess && !UTAN_SESSION.has(url.pathname)) sess = skapaSession(req, server);
    if (sess) Object.assign(c, { s: sess.s, sid: sess.sid, ny: sess.ny, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare && url.pathname.startsWith('/api/min/')) avvisaFranAnnanWebbplats(req);
    c.body = metod === 'GET' ? {} : await lasKropp(req);
    c.url = url;
    let ut = traff[0](c, ...traff[1]);
    // En fil, till exempel exportpaketet eller datauttaget, går ut som den är.
    if (ut instanceof Response) return ut;
    let status = 200;
    if (Array.isArray(ut) && typeof ut[0] === 'number') [status, ut] = ut;
    // Ny sessionsnyckel vid inloggning, samma sandlåda.
    if (c.rotera && c.sid) {
      sessioner.delete(c.sid);
      c.sid = slumpId();
      sessioner.set(c.sid, c.s);
      c.ny = true;
    }
    return json(ut, status, c.ny ? { 'Set-Cookie': kaka(c.sid) } : {});
  }

  // Sessionskakan är SameSite=Lax, så en länk från en annan webbplats skickar med den. Invånarens läsningar loggas, och
  // ett anrop som webbläsaren märker som en navigering från en annan webbplats avvisas, så att ingen annan sida kan få
  // invånaren att göra åtkomster i sitt namn. Klienter utanför webbläsaren skickar inte rubriken.
  function avvisaFranAnnanWebbplats(req) {
    if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Fel(403, 'Anropet kom från en annan webbplats.', 'nekad');
  }

  // Den inloggade personalen eller invånaren, aldrig båda. Skulle båda vara satta räknas ingen som inloggad.
  function inloggade(s) {
    const personal = personalRad(s.db, s.personalId);
    const invanare = minJournal.invanareRad(s.db, s.invanareId);
    if (personal && invanare) return { personal: null, invanare: null };
    return { personal: personal ?? null, invanare };
  }

  function fhirSvar(req, url, c) {
    const sess = hamtaSession(req);
    if (sess) Object.assign(c, { s: sess.s, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare) avvisaFranAnnanWebbplats(req);
    const base = origin || `${url.protocol}//${url.host}`;
    if (req.method !== 'GET') throw new Fel(405, 'Bara läsning stöds i FHIR-API:t.', 'ogiltig');
    const db = c.db;
    if (!db && !fhir.oppenSokvag(url.pathname.replace(/\/+$/, ''))) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    const nekade = c.invanare ? ((c.s.nekadeInvanare ??= {})[c.invanare.id] ??= { antal: 0 }) : null;
    const r = fhir.hantera({ db, personal: c.personal, invanare: c.invanare ?? null, nekade, valFor: (pid) => valFor(c.s, pid), url, base });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const server = Bun.serve({
    port, hostname,
    // Ingen förfrågan behöver mer än 64 kB. Taket gäller också kroppar utan Content-Length.
    maxRequestBodySize: MAX_KROPP * 2,
    async fetch(req, srv) {
      const t0 = performance.now();
      const url = new URL(req.url);
      const c = {};
      let svar;
      try {
        if (url.pathname.startsWith('/api/')) svar = await api(req, srv, url, c);
        else if (url.pathname === '/fhir' || url.pathname.startsWith('/fhir/')) svar = fhirSvar(req, url, c);
        else if (req.method !== 'GET' && req.method !== 'HEAD') svar = new Response('Metoden stöds inte.', { status: 405 });
        else svar = (await statisk(url.pathname)) ?? new Response('Sidan finns inte.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (e) {
        const arFhir = url.pathname.startsWith('/fhir');
        if (e instanceof Fel) {
          svar = arFhir
            ? new Response(JSON.stringify(fhir.utfall(e.status, e.kod, e.message)), { status: e.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } })
            : json({ fel: e.message, kod: e.kod, ...e.extra }, e.status, c.ny ? { 'Set-Cookie': kaka(c.sid) } : {});
        } else if (e?.code?.startsWith?.('SQLITE_CONSTRAINT')) {
          svar = json({ fel: 'Ändringen är inte tillåten.', kod: 'ogiltig' }, 400);
        } else {
          console.error(new Date().toISOString(), url.pathname, e);
          svar = json({ fel: 'Något gick fel på servern. Försök igen.', kod: 'fel' }, 500);
        }
      }
      const ms = performance.now() - t0;
      svar.headers.set('Server-Timing', `app;dur=${ms.toFixed(1)}`);
      // Okända sökvägar samlas i en nyckel så att mätningen inte växer med vad besökare hittar på.
      const nyckel = [404, 405].includes(svar.status) ? `${req.method} okänd` : normaliseraVag(req.method, url.pathname);
      serverMatning.lagg(nyckel, ms);
      if (c.s) c.s.matning.lagg(nyckel, ms);
      return svar;
    },
  });

  return {
    server, sessioner, port: server.port, url: `http://127.0.0.1:${server.port}`, spara,
    stopp() { clearInterval(stadning); server.stop(true); for (const s of sessioner.values()) s.db.close(); sessioner.clear(); },
  };
}

if (import.meta.main) {
  const app = starta();
  const avsluta = () => {
    try { const n = app.spara(); if (n) console.log(`Sparade ${n} sandlådor`); } catch (e) { console.error('Kunde inte spara sandlådorna:', e.message); }
    process.exit(0);
  };
  process.on('SIGTERM', avsluta);
  process.on('SIGINT', avsluta);
  console.log(`Vårdkällan lyssnar på ${app.port}${process.env.ORIGIN ? ` (${process.env.ORIGIN})` : ''}`);
}

