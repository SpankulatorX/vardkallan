// Vårdkällan. Varje besökare får en egen sandlåda i minnet, en kopia av den seedade mallen.
// Sandlådorna sparas till SESSION_FIL vid SIGTERM och läses in vid start.
import { join, normalize } from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { Fel, nySessionsDb, lasSandlada, idag, installning } from './db.js';
import { Atkomst, ROLLER, kanRoll, vardenhetFor, harVardrelation, aktivaSparrar, visningsnamn, visningsPnr, alder } from './atkomst.js';
import * as logg from './logg.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';
import * as fhir from './fhir.js';
import { kravregister, lasTestresultat } from './krav.js';
import { YRKEN } from './seed/personal.js';

const PUBLIC = join(import.meta.dir, '..', 'public');
const MAX_SESSIONER = 400;
const SESSION_TTL = 8 * 3600_000;
const MAX_KROPP = 64 * 1024;
const SPARVERSION = 1;
const VAL_TYPER = ['andra_enheter', 'nodatkomst', 'samtycke_sparr', 'visa_identitet'];

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
  nyaPerTimme = Number(process.env.NYA_PER_TIMME || 60) } = {}) {
  const sessioner = new Map();
  const nyaPerIp = new Map();
  const serverMatning = new Matning(1000);
  const startad = new Date().toISOString();

  const slumpId = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const kakSid = (req) => (req.headers.get('cookie') || '').match(/(?:^|;\s*)vk_sid=([A-Za-z0-9_-]{32})(?:;|$)/)?.[1];
  const kaka = (sid) => `vk_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${origin.startsWith('https') ? '; Secure' : ''}`;
  // Cloudflare skriver över cf-connecting-ip vid kanten. Rubriken gäller bara när LITA_PA_PROXY=1,
  // alltså när enda vägen in är tunneln och Caddy. Annars räknas socketens adress.
  const litaPaProxy = process.env.LITA_PA_PROXY === '1';
  const klientIp = (req, server) => (litaPaProxy && req.headers.get('cf-connecting-ip')) || server.requestIP(req)?.address || 'okänd';

  const nySession = () => ({ db: nySessionsDb(), personalId: null, val: {}, sist: Date.now(), matning: new Matning(200) });

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
    for (const [sid, s] of sessioner) if (s.sist < grans) { s.db.close(); sessioner.delete(sid); }
    const timme = Math.floor(Date.now() / 3600_000);
    for (const k of nyaPerIp.keys()) if (!k.endsWith(`:${timme}`)) nyaPerIp.delete(k);
  }, 10 * 60_000);

  function lasSparade() {
    if (!sessionFil || !existsSync(sessionFil)) return;
    try {
      const grans = Date.now() - SESSION_TTL;
      for (const x of JSON.parse(readFileSync(sessionFil, 'utf8'))) {
        if (x.v !== SPARVERSION || x.sist < grans || !/^[A-Za-z0-9_-]{32}$/.test(x.sid)) continue;
        sessioner.set(x.sid, { db: lasSandlada(x.db), personalId: x.personalId, val: x.val ?? {}, sist: x.sist, matning: new Matning(200) });
      }
      console.log(`Läste in ${sessioner.size} sparade sandlådor`);
    } catch (e) { console.error('Kunde inte läsa sparade sandlådor:', e.message); }
    try { unlinkSync(sessionFil); } catch { /* redan borta */ }
  }
  function spara() {
    if (!sessionFil) return 0;
    const lista = [...sessioner].map(([sid, x]) => ({ v: SPARVERSION, sid, personalId: x.personalId, val: x.val, sist: x.sist, db: Buffer.from(x.db.serialize()).toString('base64') }));
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
  const patientRad = (db, id) => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(id);
    if (!p) throw new Fel(404, 'Patienten finns inte.', 'saknas');
    return p;
  };

  // Patientens namn och personnummer, maskerade för skyddad identitet, för listor utanför journalen.
  const patientKort = (p) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) });

  function sessionUt(s) {
    const p = personalRad(s.db, s.personalId);
    const ut = { inloggad: Boolean(p), demoDatum: installning(s.db, 'seed_datum') ?? idag() };
    if (p) {
      const ve = vardenhetFor(s.db, p.enhet_id);
      ut.personal = { id: p.id, namn: p.namn, yrke: p.yrke, yrkeText: YRKEN[p.yrke], titel: p.titel, hsaId: p.hsa_id };
      ut.enhet = { ...enhetKort(s.db, p.enhet_id), vardenhet: enhetKort(s.db, ve) };
      ut.behorigheter = ROLLER[p.yrke] ?? [];
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
    return {
      lakemedel: ord ? ord.filter(lakemedel.aktuell).map(o => lakemedel.ordinationUt(db, o, { historik: false })) : null,
      diagnoser: dia ? dia.map(d => journal.diagnosUt(db, d)) : null,
      matvarden: mv ? journal.senastePerTyp(mv).map(m => journal.matvardeUt(db, m)) : null,
      anteckningar: ant ? ant.slice(0, 5) : null,
      remisser: rem ? rem.filter(r => r.status !== 'svar_kvitterat' && r.beslut !== 'avvisad') : null,
      tidslinje,
      vardkontakter: vk.map(v => journal.vardkontaktUt(db, v)),
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
      const vk = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL ORDER BY start DESC`).get(id, ...enheter);
      const inkRemiss = db.query("SELECT * FROM remisser WHERE patient_id = ? AND till_enhet_id = ? AND status <> 'svar_kvitterat' ORDER BY skickad_tid DESC").get(id, ve);
      const list = db.query(`SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id IN (${ph})`).get(id, ...enheter);
      ut.push({
        id, namn: visningsnamn(pat), personnummer: visningsPnr(pat), alder: alder(pat.fodd, idag()), kon: pat.kon,
        plats: vk ? vk.plats : inkRemiss ? 'Inkommande remiss' : list ? 'Listad' : 'Nyligen avslutad kontakt',
        orsak: vk?.orsak ?? (inkRemiss && kanRoll(p, 'las_remiss') ? inkRemiss.fragestallning : null),
        skyddad: Boolean(pat.skyddad), larm: larm.filter(l => l.patientId === id).length + nll.filter(n => n.patientId === id).length,
        pagaende: Boolean(vk), vardform: vk?.typ ?? null,
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
    let rader;
    if (/^\d{6,12}$/.test(siffror)) {
      // Skyddade patienter hittas bara på fullständigt personnummer.
      rader = db.query('SELECT * FROM patienter WHERE personnummer LIKE ? OR substr(personnummer, 3) LIKE ? ORDER BY personnummer LIMIT 20').all(`${siffror}%`, `${siffror}%`)
        .filter(p => !p.skyddad || p.personnummer === siffror || p.personnummer.slice(2) === siffror);
    } else {
      // SQLite:s lower() hanterar bara ASCII, så namnen jämförs här med svensk gemenisering.
      const sv = (s) => s.toLocaleLowerCase('sv-SE');
      const m = sv(fraga);
      rader = db.query('SELECT * FROM patienter WHERE skyddad = 0').all()
        .filter(p => sv(`${p.fornamn} ${p.efternamn}`).includes(m))
        .sort((a, b) => a.efternamn.localeCompare(b.efternamn, 'sv') || a.fornamn.localeCompare(b.fornamn, 'sv'))
        .slice(0, 20);
    }
    const ve = vardenhetFor(db, c.personal.enhet_id);
    atk.logga('sok', atk.grund(), `sok:${fraga} (${rader.length} träffar)`);
    return rader.map(p => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), alder: alder(p.fodd, idag()), kon: p.kon, skyddad: Boolean(p.skyddad), vardrelation: harVardrelation(db, p.id, ve) }));
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
      if (akut) Object.assign(rad, { patientId: p.id, skyddad: Boolean(p.skyddad), namn: p.skyddad ? null : visningsnamn(p), orsak: v.orsak });
      return rad;
    });
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

  const kravInloggad = (c) => {
    if (!c.personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    return c.personal;
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
    c.s.personalId = p.id;
    c.s.val = {};
    c.rotera = true;
    return sessionUt(c.s);
  });
  rutt('POST', '/api/logout', (c) => { c.s.personalId = null; c.s.val = {}; return sessionUt(c.s); });
  rutt('POST', '/api/reset', (c) => {
    c.s.db.close();
    c.s.db = nySessionsDb();
    c.s.val = {};
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

  rutt('GET', '/api/patient/:id', (c, id) => {
    kravInloggad(c);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    return medPatient(c, id, handling, (atk, p) => patientHuvud(c, atk, p));
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
    return [201, medPatient(c, id, journal.skrivHandling(journal.MALLAR.find(m => m.typ === c.body.typ)?.kategori), (atk) => journal.skapaAnteckning(atk, c.body))];
  });
  const medAnteckning = (c, id, handling, fn) => {
    kravInloggad(c);
    const a = journal.hamtaAnteckningRad(c.db, id);
    return medPatient(c, a.patient_id, handling(a), (atk) => fn(atk, a));
  };
  rutt('GET', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.lasHandling(a.kategori), (atk, a) => journal.hamtaAnteckning(atk, a)));
  rutt('PUT', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.andraUtkast(atk, a, c.body)));
  rutt('POST', '/api/anteckning/:id/signera', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.signera(atk, a)));
  rutt('POST', '/api/anteckning/:id/ratta', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => [201, journal.ratta(atk, a, c.body)]));
  rutt('GET', '/api/mallar', () => journal.MALLAR);

  rutt('GET', '/api/patient/:id/lakemedel', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => lakemedel.lista(atk)); });
  rutt('GET', '/api/lakemedel/katalog', (c) => { kravInloggad(c); return lakemedel.sokKatalog(c.db, c.url.searchParams.get('q') ?? ''); });
  rutt('POST', '/api/patient/:id/lakemedel/kontroll', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => lakemedel.kontroll(atk, c.body)); });
  rutt('POST', '/api/patient/:id/lakemedel', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => lakemedel.spara(atk, c.body))]; });
  const medOrdination = (c, id, fn) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    return medPatient(c, o.patient_id, 'ordinera', (atk) => fn(atk, o));
  };
  rutt('POST', '/api/ordination/:id/utsatt', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.utsatt(atk, o, c.body)));
  rutt('POST', '/api/ordination/:id/nll-avstam', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.avstam(atk, o)));
  // Nästa överföring till NLL får timeout. Med { lage: 'fel' } får den i stället ett felsvar.
  rutt('POST', '/api/demo/nll-timeout', (c) => {
    kravInloggad(c);
    const lage = c.body.lage === 'fel' ? 'fel' : 'timeout';
    installning(c.db, 'nll_nasta', lage);
    return { ok: true, nastaOverforing: lage };
  });

  rutt('GET', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk) => journal.listaMatvarden(atk)); });
  rutt('POST', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => journal.registreraMatvarde(atk, c.body))]; });

  rutt('GET', '/api/patient/:id/remisser', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, kanRoll(c.personal, 'las_remiss') ? 'las_remiss' : 'las_remiss_status', (atk) => remiss.forPatient(atk));
  });
  rutt('POST', '/api/patient/:id/remisser', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'remittera', (atk) => remiss.skapa(atk, c.body))]; });
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
  rutt('POST', '/api/remiss/:id/bedom', (c, id) => medRemiss(c, id, 'bedom_remiss', (atk, r) => remiss.bedom(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/svara', (c, id) => medRemiss(c, id, 'svara_remiss', (atk, r) => remiss.svara(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/kvittera-svar', (c, id) => medRemiss(c, id, 'kvittera_svar', (atk, r) => remiss.kvitteraSvar(atk, r)));

  rutt('GET', '/api/inkorg', (c) => {
    const p = kravInloggad(c);
    const med = (x) => ({ ...x, patient: patientKort(patientRad(c.db, x.patientId)) });
    return {
      osigneradeAnteckningar: journal.osigneradeFor(c.db, p.id).map(med),
      okvitteradeSvar: kanRoll(p, 'kvittera_svar') ? remiss.okvitteradeSvar(c.db, p) : [],
      larm: p.yrke === 'logggranskare' ? [] : remiss.larmForEnhet(c.db, p),
      nllAvvikelser: kanRoll(p, 'las_lakemedel') ? lakemedel.nllAvvikelser(c.db, p).map(med) : [],
    };
  });

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
    return { patientId: p.id, patient: patientKort(p), rader: medPatientKort(c.db, logg.lista(c.db, { patientId: p.id })), kedjaHel: logg.verifiera(c.db).hel };
  });
  rutt('GET', '/api/logg', (c) => {
    kravInloggad(c);
    const atk = new Atkomst(c.db, c.personal, null, {}, 'las_logg');
    atk.krav('las_logg');
    const q = c.url.searchParams;
    const flagga = ['nodatkomst', 'nekad', 'samtycke', 'alla'].includes(q.get('flagga')) ? q.get('flagga') : 'alla';
    const datum = (v, slut) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}${slut ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : v || null);
    const rader = medPatientKort(c.db, logg.lista(c.db, { flagga, fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) }));
    atk.logga('las_logg', 'logggranskning', `logg:${flagga}`);
    const v = logg.verifiera(c.db);
    return { flagga, rader, kedjaHel: v.hel, verifiering: v };
  });

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
  rutt('GET', '/api/krav', () => kravregister(lasTestresultat(testresultat)));
  // Svarstidsmål (D5): p95 under 200 ms per endpoint.
  const MAL_P95 = 200;
  const medMal = (rader) => rader.map(r => ({ ...r, inomMal: r.p95 <= MAL_P95 }));
  rutt('GET', '/api/drift', (c) => ({ startad, sandladar: sessioner.size, mal: { p95Ms: MAL_P95 }, server: medMal(serverMatning.sammanstall()), sandlada: c.s ? medMal(c.s.matning.sammanstall()) : [] }));

  // Endpoints som inte behöver en sandlåda.
  const UTAN_SESSION = new Set(['/api/health', '/api/krav', '/api/drift']);

  async function api(req, server, url, c) {
    if (url.pathname === '/api/health') return json({ ok: true, sandladar: sessioner.size });
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
    if (sess) Object.assign(c, { s: sess.s, sid: sess.sid, ny: sess.ny, db: sess.s.db, personal: personalRad(sess.s.db, sess.s.personalId) });
    c.body = metod === 'GET' ? {} : await lasKropp(req);
    c.url = url;
    let ut = traff[0](c, ...traff[1]);
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

  function fhirSvar(req, url, c) {
    const sess = hamtaSession(req);
    if (sess) Object.assign(c, { s: sess.s, db: sess.s.db, personal: personalRad(sess.s.db, sess.s.personalId) });
    const base = origin || `${url.protocol}//${url.host}`;
    if (req.method !== 'GET') throw new Fel(405, 'Bara läsning stöds i FHIR-API:t.', 'ogiltig');
    const db = c.db;
    if (!db && !fhir.oppenSokvag(url.pathname.replace(/\/+$/, ''))) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    const r = fhir.hantera({ db, personal: c.personal, valFor: (pid) => valFor(c.s, pid), url, base });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const server = Bun.serve({
    port, hostname,
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

