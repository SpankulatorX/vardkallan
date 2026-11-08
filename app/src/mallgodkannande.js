// Godkännande av läkemedelsmallar (runda 6, r6, Sussa 3.5.1.3 och eget krav D11). Läkemedelsmallarna per substans
// (ordinationsmallar.js) och mallarna med flera ordinationer (ordinationsvagar.js) godkänns av den läkare som
// verksamhetschefen har utsett som ansvarig för vårdenhetens läkemedelsmallar, innan de kan användas (Gröna häftet
// 688488 R5 avsnitt 1.4.3: granska och godkänna det medicinska innehållet). En ändrad mall är en ny version som kräver
// ett nytt godkännande. Den tidigare godkända versionen används tills den nya är godkänd, och då ersätts den. Varje
// version och varje godkännande sparas med innehållet, och ändras eller raderas aldrig.
//
// Systemet är experten. Det skriver själv vad som ändrats mot den förra versionen, lägger mallen i den mallansvariga
// läkarens inkorg, visar innehållet och ändringen på vanlig svenska och förklarar varför en mall inte går att använda
// eller godkänna. Den som ordinerar ser bara godkända mallar och behöver aldrig veta vilken version som gäller.
import { Fel, iso, idag } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { gallande, uppdragFor } from './lakemedelsansvar.js';
// Runda 8, r4: beredningsformerna för mallens varianter.
import { FORMGRUPPER } from './ordinationsmallar.js';

const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mallgodkannanden'").get());
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const lmText = (db, id) => { const lm = katalog(db, id); return lm ? `${lm.namn} ${lm.styrka}` : id; };
const loggaUtan = (db, personal, resurs, resultat = 'tillaten') =>
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'godkanna_mall', resurs, grund: resultat === 'nekad' ? 'nekad' : 'administrativ', resultat });
const giltigt = (p, dag = idag()) => !p.upphavt && p.giltigt_till >= dag;

// Det senaste godkännandet av just det innehållet på vårdenheten.
function godkannande(db, typ, id, ve, innehall) {
  if (!harTabell(db)) return null;
  const g = db.query('SELECT * FROM mallgodkannanden WHERE mall_typ = ? AND mall_id = ? AND enhet_id = ? ORDER BY id DESC LIMIT 1').get(typ, String(id), ve);
  return g && g.innehall === innehall ? g : null;
}
const godkannandeUt = (db, g) => (g ? { av: personNamn(db, g.godkand_av), tid: g.godkand } : null);

// Läkemedelsmallar per substans -------------------------------------------------------------------------------------

// Den mall för substansen som används på vårdenheten: den senaste godkända versionen. { mall, id, version, godkand }
// när en version är godkänd, { mall: null, namn } när mallen finns men ingen version är godkänd, annars null.
export function substansmall(db, atc, ve) {
  if (!harTabell(db) || !atc) return null;
  const rader = db.query('SELECT * FROM substansmallar WHERE atc = ? ORDER BY version DESC').all(atc);
  if (!rader.length) return null;
  for (const r of rader) {
    const g = godkannande(db, 'substans', r.id, ve, r.innehall);
    if (g) return { mall: JSON.parse(r.innehall), id: r.id, version: r.version, namn: r.namn, godkand: godkannandeUt(db, g) };
  }
  return { mall: null, namn: rader[0].namn };
}

const TYPTEXT = { staende: 'stående', vid_behov: 'vid behov', tillfallig: 'tillfällig' };
function substansRader(m) {
  return [
    `${m.dosering}${m.typ ? `, ${TYPTEXT[m.typ] ?? m.typ}` : ''}${m.tider?.length ? `, kl. ${m.tider.join(', ')}` : ''}, uppföljning efter ${m.uppfoljning ?? 30} dagar.`,
    ...(m.aldre ? [`Från 75 år: ${m.aldre.dosering}.`] : []),
    ...(m.egfr ? [`Vid eGFR under 30: ${m.egfr.dosering}.`] : []),
    // Runda 8, r4: varianterna för andra beredningsformer och styrkor.
    ...(m.varianter ?? []).map(v => `${v.styrka ? `För ${v.styrka}` : `För ${FORMGRUPPER[v.form] ?? v.form}`}: ${v.dosering || 'dosering ur infusionen'}${v.typ ? `, ${TYPTEXT[v.typ] ?? v.typ}` : ''}.`),
  ];
}

// Vad som ändrats mellan två versioner av en substansmall, på vanlig svenska.
const FALT = { dosering: 'doseringen', dos: 'dosen', dosEnhet: 'enheten', tider: 'tiderna', typ: 'typen', uppfoljning: 'uppföljningen', volym: 'volymen',
  vidHandelse: 'tiden före vårdhändelsen', orsak: 'ordinationsorsaken', aldre: 'anpassningen från 75 år', egfr: 'anpassningen vid nedsatt njurfunktion' };
const varde = (k, v) => (v == null ? 'inget' : k === 'tider' ? (v.length ? `kl. ${v.join(', ')}` : 'inga fasta tider') : k === 'aldre' || k === 'egfr' ? `"${v.dosering}"`
  : k === 'uppfoljning' ? `${v} dagar` : k === 'vidHandelse' ? `${v} ${v === 1 ? 'timme' : 'timmar'}` : k === 'typ' ? (TYPTEXT[v] ?? v) : `"${v}"`);
function skillnad(a = {}, b = {}) {
  return Object.keys(FALT).filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)).map(k => `${FALT[k][0].toUpperCase()}${FALT[k].slice(1)} ändras från ${varde(k, a[k])} till ${varde(k, b[k])}.`);
}

// POST /api/substansmallar/:atc { dosering?, dos?, dosEnhet?, tider?, typ?, uppfoljning?, volym?, andring? }. En läkare
// på vårdenheten ändrar en läkemedelsmall. Ändringen blir en ny version som väntar på godkännande.
export function andraSubstansmall(db, personal, atc, inp = {}) {
  if (personal.yrke !== 'lakare') {
    loggaUtan(db, personal, `mall:substans:${atc}:ny`, 'nekad');
    throw new Fel(403, 'En läkemedelsmall ändras av en läkare, och godkänns sedan av den mallansvariga läkaren.', 'nekad');
  }
  const forra = db.query('SELECT * FROM substansmallar WHERE atc = ? ORDER BY version DESC LIMIT 1').get(String(atc));
  if (!forra) throw new Fel(404, 'Det finns ingen läkemedelsmall för substansen.', 'saknas');
  const gammal = JSON.parse(forra.innehall);
  const ny = { ...gammal };
  for (const k of ['dosering', 'dosEnhet']) if (typeof inp[k] === 'string' && inp[k].trim()) ny[k] = inp[k].trim().slice(0, 200);
  if (inp.typ != null) { if (!TYPTEXT[inp.typ]) throw new Fel(400, 'Typen ska vara stående, vid behov eller tillfällig.', 'ogiltig', { falt: ['typ'] }); ny.typ = inp.typ; }
  for (const k of ['dos', 'uppfoljning', 'volym']) {
    if (inp[k] == null || inp[k] === '') continue;
    const v = Number(inp[k]);
    if (!Number.isFinite(v) || v <= 0 || v > 10000) throw new Fel(400, `Kontrollera ${FALT[k]}.`, 'ogiltig', { falt: [k] });
    ny[k] = v;
  }
  if (Array.isArray(inp.tider)) ny.tider = inp.tider.map(String).filter(t => /^\d{2}$/.test(t)).slice(0, 8);
  const andringar = skillnad(gammal, ny);
  if (!andringar.length) throw new Fel(400, 'Mallen är oförändrad. Ändra något innan den sparas som en ny version.', 'ogiltig');
  const egen = typeof inp.andring === 'string' ? inp.andring.trim().slice(0, 300) : '';
  const r = db.query('INSERT INTO substansmallar (atc, namn, innehall, version, upprattad_av, upprattad, andring) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(forra.atc, forra.namn, JSON.stringify(ny), forra.version + 1, personal.id, iso(), [...andringar, egen].filter(Boolean).join(' '));
  loggaUtan(db, personal, `mall:substans:${r.lastInsertRowid}:ny`);
  return { id: Number(r.lastInsertRowid), atc: forra.atc, namn: forra.namn, version: forra.version + 1, andring: andringar, status: 'vantar' };
}

// Mallar med flera ordinationer --------------------------------------------------------------------------------------

export function paketGodkannande(db, p) {
  return godkannande(db, 'paket', p.id, vardenhetFor(db, p.enhet_id), p.innehall);
}
export const paketGodkand = (db, p) => !harTabell(db) || Boolean(paketGodkannande(db, p));

function paketVersion(db, p) {
  if (!harTabell(db)) return { version: 1, ersatter: null, andring: null };
  const v = db.query('SELECT * FROM paketversioner WHERE paket_id = ?').get(p.id);
  let n = 1;
  for (let id = v?.ersatter, i = 0; id && i < 50; i++) { n++; id = db.query('SELECT ersatter FROM paketversioner WHERE paket_id = ?').get(id)?.ersatter; }
  return { version: n, ersatter: v?.ersatter ?? null, andring: v?.andring ?? null };
}

// Status, version och godkännande för paketUt i ordinationsvagar.js.
export function paketInfo(db, p) {
  const g = paketGodkannande(db, p);
  const v = paketVersion(db, p);
  const status = p.upphavt ? (/^Ersatt/.test(p.upphavt_orsak ?? '') ? 'ersatt' : 'upphavd') : !giltigt(p) ? 'utgangen' : g || !harTabell(db) ? 'godkand' : 'vantar';
  return { version: v.version, ersatter: v.ersatter, andring: v.andring, status, godkand: godkannandeUt(db, g) };
}

function paketRader(db, p) {
  return JSON.parse(p.innehall).map(x => `${lmText(db, x.lakemedelId)}: ${x.dosering ?? 'dosering enligt läkemedelsmallen'}${x.vidHandelse != null && !/före/.test(x.dosering ?? '') ? `, ${x.vidHandelse} ${x.vidHandelse === 1 ? 'timme' : 'timmar'} före ${String(p.vardhandelse ?? 'vårdhändelsen').toLowerCase()}` : ''}. ${x.orsak}.`);
}

// Vad som ändrats mellan två versioner av en mall med flera ordinationer, per läkemedel.
export function paketSkillnad(db, gamla, nya) {
  const a = new Map(gamla.map(x => [x.lakemedelId, x]));
  const b = new Map(nya.map(x => [x.lakemedelId, x]));
  const ut = [];
  for (const [id, x] of b) {
    if (!a.has(id)) { ut.push(`${lmText(db, id)} läggs till.`); continue; }
    for (const t of skillnad(a.get(id), x)) ut.push(`${lmText(db, id)}: ${t[0].toLowerCase()}${t.slice(1)}`);
  }
  for (const id of a.keys()) if (!b.has(id)) ut.push(`${lmText(db, id)} tas bort.`);
  return ut;
}

// Inkorgen och listan -------------------------------------------------------------------------------------------------

// Mallar på vårdenheten som väntar på godkännande, för den mallansvariga läkaren. Inga patientuppgifter.
export function attGodkanna(db, personal) {
  if (!harTabell(db) || personal?.yrke !== 'lakare') return [];
  const u = uppdragFor(db, personal, 'mallansvarig');
  if (!u) return [];
  return vantande(db, u.enhet_id);
}

function vantande(db, ve) {
  const ut = [];
  for (const p of db.query('SELECT * FROM ordinationspaket ORDER BY namn, faststallt').all()) {
    if (vardenhetFor(db, p.enhet_id) !== ve || !giltigt(p) || paketGodkannande(db, p)) continue;
    const v = paketVersion(db, p);
    const forra = v.ersatter ? db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(v.ersatter) : null;
    ut.push({ typ: 'paket', id: p.id, namn: p.namn, version: v.version, upprattadAv: personNamn(db, p.faststallt_av), upprattad: p.faststallt,
      andring: v.andring, andringar: forra ? paketSkillnad(db, JSON.parse(forra.innehall), JSON.parse(p.innehall)) : [],
      innehall: paketRader(db, p), vardenhet: { id: vardenhetFor(db, p.enhet_id), namn: enhetsnamn(db, p.enhet_id) },
      text: v.version > 1 ? `Mallen ${p.namn} är ändrad och väntar på ditt godkännande. Version ${v.version - 1} används tills du har godkänt den.` : `Den nya mallen ${p.namn} väntar på ditt godkännande och kan inte användas förrän du har godkänt den.` });
  }
  for (const { atc } of db.query('SELECT DISTINCT atc FROM substansmallar ORDER BY atc').all()) {
    const r = db.query('SELECT * FROM substansmallar WHERE atc = ? ORDER BY version DESC LIMIT 1').get(atc);
    if (godkannande(db, 'substans', r.id, ve, r.innehall)) continue;
    const forra = db.query('SELECT * FROM substansmallar WHERE atc = ? AND version < ? ORDER BY version DESC LIMIT 1').get(atc, r.version);
    const anvands = substansmall(db, atc, ve);
    ut.push({ typ: 'substans', id: String(r.id), namn: r.namn, version: r.version, upprattadAv: personNamn(db, r.upprattad_av) ?? 'Demons grunddata', upprattad: r.upprattad,
      andring: r.andring, andringar: forra ? skillnad(JSON.parse(forra.innehall), JSON.parse(r.innehall)) : [], innehall: substansRader(JSON.parse(r.innehall)),
      vardenhet: { id: ve, namn: enhetsnamn(db, ve) },
      text: anvands?.mall ? `Läkemedelsmallen ${r.namn} är ändrad och väntar på ditt godkännande. Version ${anvands.version} används tills du har godkänt den.` : `Läkemedelsmallen ${r.namn} väntar på ditt godkännande och används inte förrän du har godkänt den.` });
  }
  return ut;
}

// GET /api/lakemedelsmallar: vårdenhetens läkemedelsmallar med version och status, för läkare. Den mallansvariga ser också vad
// som väntar på godkännande.
export function mallLista(db, personal) {
  if (personal.yrke !== 'lakare') {
    loggaUtan(db, personal, 'mallar', 'nekad');
    throw new Fel(403, 'Läkemedelsmallarna är för läkare.', 'nekad');
  }
  const ve = vardenhetFor(db, personal.enhet_id);
  const ansvariga = gallande(db, ve, 'mallansvarig').map(u => personNamn(db, u.personal_id));
  const kan = Boolean(uppdragFor(db, personal, 'mallansvarig'));
  loggaUtan(db, personal, 'mallar');
  return {
    vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, mallansvariga: ansvariga, kanGodkanna: kan,
    substans: db.query('SELECT DISTINCT atc FROM substansmallar ORDER BY atc').all().map(({ atc }) => {
      const s = substansmall(db, atc, ve);
      const senaste = db.query('SELECT * FROM substansmallar WHERE atc = ? ORDER BY version DESC LIMIT 1').get(atc);
      return { atc, namn: senaste.namn, version: s?.version ?? null, godkand: s?.godkand ?? null, vantarVersion: s?.version === senaste.version ? null : senaste.version, innehall: s?.mall ? substansRader(s.mall) : [] };
    }),
    paket: db.query('SELECT * FROM ordinationspaket ORDER BY namn, faststallt').all().filter(p => vardenhetFor(db, p.enhet_id) === ve).map(p => ({ id: p.id, namn: p.namn, ...paketInfo(db, p), innehall: paketRader(db, p) })),
    vantar: kan ? vantande(db, ve) : [],
    text: ansvariga.length ? `Läkemedelsmallarna på ${enhetsnamn(db, ve)} godkänns av ${ansvariga.join(' och ')}.` : `${enhetsnamn(db, ve)} har ingen läkare ansvarig för läkemedelsmallar, så ingen ny eller ändrad mall kan godkännas. Verksamhetschefen utser en.`,
  };
}

// POST /api/lakemedelsmallar/godkann { typ: 'substans' | 'paket', id }. Den mallansvariga läkaren godkänner det medicinska
// innehållet. En ny version av en mall med flera ordinationer ersätter då den förra.
export function godkann(db, personal, inp = {}) {
  const typ = inp.typ;
  const id = String(inp.id ?? '');
  const resurs = `mall:${typ}:${id}`;
  let rad, ve;
  if (typ === 'paket') {
    rad = db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(id);
    ve = rad ? vardenhetFor(db, rad.enhet_id) : null;
  } else if (typ === 'substans') {
    rad = db.query('SELECT * FROM substansmallar WHERE id = ?').get(Number(id));
    ve = vardenhetFor(db, personal.enhet_id);
  } else throw new Fel(400, 'Ange om det är en läkemedelsmall eller en mall med flera ordinationer.', 'ogiltig', { falt: ['typ'] });
  if (!rad) throw new Fel(404, 'Mallen finns inte.', 'saknas');
  const u = personal.yrke === 'lakare' ? uppdragFor(db, personal, 'mallansvarig') : null;
  if (!u || u.enhet_id !== ve) {
    loggaUtan(db, personal, resurs, 'nekad');
    const ansvariga = gallande(db, ve, 'mallansvarig').map(x => personNamn(db, x.personal_id));
    throw new Fel(403, `Läkemedelsmallar godkänns av den läkare som verksamhetschefen har utsett som ansvarig för vårdenhetens läkemedelsmallar (Gröna häftet 1.4.3). ${ansvariga.length ? `På ${enhetsnamn(db, ve)} är det ${ansvariga.join(' och ')}.` : `${enhetsnamn(db, ve)} har ingen sådan läkare just nu, och verksamhetschefen kan utse en.`}`, 'nekad');
  }
  if (typ === 'paket' && !giltigt(rad)) throw new Fel(400, 'Mallen är upphävd eller har gått ut och kan inte godkännas.', 'ogiltig');
  if (typ === 'substans') {
    const senaste = db.query('SELECT MAX(version) AS v FROM substansmallar WHERE atc = ?').get(rad.atc).v;
    if (rad.version !== senaste) throw new Fel(400, `Det finns en senare version av mallen ${rad.namn}. Granska och godkänn den i stället.`, 'ogiltig');
  }
  if (godkannande(db, typ, id, ve, rad.innehall)) throw new Fel(400, 'Mallen är redan godkänd.', 'ogiltig');
  const v = typ === 'paket' ? paketVersion(db, rad) : { version: rad.version, ersatter: null };
  let ersatt = null;
  db.transaction(() => {
    db.query('INSERT INTO mallgodkannanden (mall_typ, mall_id, enhet_id, godkand_av, godkand, uppdrag_id, innehall) VALUES (?, ?, ?, ?, ?, ?, ?)').run(typ, id, ve, personal.id, iso(), u.id, rad.innehall);
    loggaUtan(db, personal, resurs);
    if (typ === 'paket' && v.ersatter) {
      const f = db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(v.ersatter);
      if (f && !f.upphavt) {
        db.query('UPDATE ordinationspaket SET upphavt = ?, upphavt_av = ?, upphavt_orsak = ? WHERE id = ?').run(iso(), personal.id, `Ersatt av version ${v.version}, godkänd av ${personal.namn}.`, f.id);
        loggaUtan(db, personal, `mall:paket:${f.id}:ersatt`);
        ersatt = f.id;
      }
    }
  })();
  return { typ, id, namn: rad.namn, version: v.version, godkandAv: personal.namn, ersatt, text: `Mallen ${rad.namn} är godkänd${v.version > 1 ? ` i version ${v.version}` : ''} och används från och med nu på ${enhetsnamn(db, ve)}.` };
}
