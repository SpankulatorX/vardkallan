// Vidimering av patientens samlade pågående ordinationer (Sussa 3.5.2.9) och läkemedelsgenomgång med läkemedelsberättelse
// (3.5.1.6, 3.5.1.11).
//
// Systemet är experten. Läkaren ser vad som har ändrats sedan den senaste vidimeringen, nya och utsatta ordinationer
// med vem och när, och vidimerar hela listan med ett klick. Läkemedelsgenomgången tas fram av systemet: indikation för
// varje läkemedel, dubbelmedicinering, interaktioner, passerade uppföljningar och läkemedel som är olämpliga för äldre,
// och läkemedelsberättelsen skrivs ur ordinationernas historik under vårdtillfället. Läkaren läser, kompletterar och
// sparar. Kontrollerna är demoregler (lakemedelsregler.js).
//
// Behörighet. Vidimering och läkemedelsgenomgång kräver läkare med vårdrelation på den egna vårdenheten, inte nödåtkomst.
// De omfattar de ordinationer som syns utan samtycke: spärrade enheters ordinationer ingår aldrig, även när patienten
// har samtyckt till att de visas, så att en vidimering inte för vidare spärrade uppgifter.
import { Fel, iso, idag, addDagar } from './db.js';
import { Atkomst, alder } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
// Runda 8, r4: dosändringarna i läkemedelsberättelsen.
import { dosandringarFor } from './dosandring.js';
import { tillaggUt } from './ordinationsmallar.js';
import { kravVardande, kanVarda, synligaAdministreringar } from './administrering.js';
import { genomgangsfynd, DEMOREGLER_PROCESS } from './lakemedelsregler.js';
import { datumI } from './lakemedelsprocess.js';

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
// Samma användare och val, men utan samtycke till spärrade uppgifter.
const utanSamtycke = (atk) => new Atkomst(atk.db, atk.personal, atk.patientId, { ...atk.val, samtycke_sparr: false }, atk.handling);
const pagaende = (atk) => lakemedel.synligaOrdinationer(utanSamtycke(atk)).filter(lakemedel.aktuell);
// Runda 8, r4: produkten, dosen och tiderna ingår, så att en dosändring i en pågående ordination syns som ändrad också
// när doseringstexten är densamma (en annan styrka med samma antal tabletter).
const avtryck = (o) => ({ id: o.id, dosering: o.dosering, status: o.status, lakemedelId: o.lakemedel_id, dos: o.dos, tider: o.tider });
const andrad = (fore, o) => fore.dosering !== o.dosering || ('lakemedelId' in fore && (fore.lakemedelId !== o.lakemedel_id || (fore.dos ?? null) !== (o.dos ?? null) || (fore.tider ?? null) !== (o.tider ?? null)));
const kort = (db, o) => { const u = lakemedel.ordinationUt(db, o, { historik: false }); return { id: u.id, lakemedel: u.lakemedel, dosering: u.dosering, typ: u.typ, ordinationsorsak: u.ordinationsorsak, uppfoljningsdatum: u.uppfoljningsdatum, start: u.start, ordineradAv: u.ordineradAv, vardenhet: u.vardenhet, skapad: u.skapad, kalla: u.kalla, kallaEtikett: u.kallaEtikett, ...tillaggUt(db, o.id) }; };

function vidimeringUt(atk, v) {
  const db = atk.db;
  const synliga = new Set(lakemedel.synligaOrdinationer(utanSamtycke(atk)).map(o => o.id));
  return { id: v.id, tid: v.tid, av: { id: v.av, namn: personNamn(db, v.av) }, enhet: enhetKort(db, v.enhet_id), ordinationer: JSON.parse(v.ordinationer).filter(x => synliga.has(x.id)).map(x => x.id) };
}

// Den senaste vidimeringen som användaren får se, och vad som har ändrats sedan dess.
export function underlag(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const rader = atk.filtrera(db.query('SELECT * FROM vidimeringar WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId), 'las_lakemedel', { gemensam: true });
  const senaste = rader[0] ?? null;
  const nu = pagaende(atk);
  const fore = senaste ? JSON.parse(senaste.ordinationer) : [];
  const foreIds = new Map(fore.map(x => [x.id, x]));
  const nuIds = new Set(nu.map(o => o.id));
  const alla = new Map(lakemedel.synligaOrdinationer(utanSamtycke(atk)).map(o => [o.id, o]));
  const nya = nu.filter(o => !foreIds.has(o.id) || andrad(foreIds.get(o.id), o)).map(o => ({ ...kort(db, o), andring: foreIds.has(o.id) ? 'andrad' : 'ny' }));
  const utsatta = fore.filter(x => !nuIds.has(x.id) && alla.has(x.id)).map(x => {
    const o = alla.get(x.id);
    return { ...kort(db, o), andring: 'utsatt', utsatt: o.status === 'utsatt' ? { tid: o.utsatt_tid, av: personNamn(db, o.utsatt_av), orsak: o.utsatt_orsak } : { tid: null, av: null, orsak: `Slutdatum ${o.slut}` } };
  });
  return {
    senaste: senaste ? vidimeringUt(atk, senaste) : null,
    pagaende: nu.map(o => kort(db, o)), andringar: { nya, utsatta, antal: nya.length + utsatta.length },
    behovs: !senaste || nya.length + utsatta.length > 0,
    text: !senaste ? `Listan är inte vidimerad. ${nu.length} pågående ${nu.length === 1 ? 'ordination' : 'ordinationer'} vidimeras.`
      : nya.length + utsatta.length ? `${nya.length + utsatta.length} ${nya.length + utsatta.length === 1 ? 'ändring' : 'ändringar'} sedan vidimeringen ${datumI(Date.parse(senaste.tid))} av ${personNamn(db, senaste.av)}.`
        : `Vidimerad ${datumI(Date.parse(senaste.tid))} av ${personNamn(db, senaste.av)}. Inget har ändrats sedan dess.`,
    kan: atk.personal.yrke === 'lakare' ? kanVarda(atk, 'ordinera') : { kan: false, varfor: null },
    dolda: { sparrade: atk.doldaSparr },
  };
}

// POST /api/patient/:id/vidimering. Hela listan vidimeras med ett klick.
export function vidimera(atk) {
  kravVardande(atk, 'ordinera', null, 'vidimering');
  const db = atk.db;
  const u = underlag(atk);
  if (!u.behovs) throw new Fel(400, 'Inget har ändrats sedan den senaste vidimeringen.', 'ogiltig');
  const nu = pagaende(atk);
  const andringar = { nya: u.andringar.nya.map(o => o.id), utsatta: u.andringar.utsatta.map(o => o.id) };
  const r = db.query('INSERT INTO vidimeringar (patient_id, enhet_id, tid, av, ordinationer, andringar) VALUES (?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id, JSON.stringify(nu.map(avtryck)), JSON.stringify(andringar));
  for (const o of nu) db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(o.id, iso(), atk.personal.id, 'Vidimerad', null);
  return { id: Number(r.lastInsertRowid), ...underlag(atk) };
}

// Läkemedelsgenomgången. Perioden är det pågående vårdtillfället, annars de senaste 30 dagarna.
function period(atk) {
  const vt = atk.db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL ORDER BY inskriven DESC').get(atk.patientId);
  return vt ? { fran: vt.inskriven, text: `vårdtillfället sedan ${datumI(Date.parse(vt.inskriven))}`, vardtillfalleId: vt.id } : { fran: new Date(Date.now() - 30 * 86400_000).toISOString(), text: 'de senaste 30 dagarna', vardtillfalleId: null };
}

// Läkemedelsberättelsen ur ordinationernas historik: insatta, utsatta och ändrade läkemedel med orsak, oförändrade
// läkemedel, vid behovsläkemedel som har getts och uppföljningen.
export function berattelse(atk, { pagaendeOrd = pagaende(atk) } = {}) {
  const db = atk.db;
  const p = period(atk);
  const fran = Date.parse(p.fran);
  const alla = lakemedel.synligaOrdinationer(utanSamtycke(atk));
  const namn = (o) => lakemedel.ordinationUt(db, o, { historik: false }).lakemedel?.namn;
  const substans = (o) => db.query('SELECT substans FROM katalog WHERE id = ?').get(o.lakemedel_id)?.substans;
  const insatta = alla.filter(o => Date.parse(o.skapad) >= fran);
  const utsatta = alla.filter(o => o.status === 'utsatt' && Date.parse(o.utsatt_tid) >= fran);
  const andrade = [];
  for (const u of utsatta) {
    const ny = insatta.find(n => substans(n) === substans(u) && Math.abs(Date.parse(n.skapad) - Date.parse(u.utsatt_tid)) < 3600_000);
    if (ny) andrade.push({ fran: u, till: ny });
  }
  const iAndrade = new Set(andrade.flatMap(a => [a.fran.id, a.till.id]));
  const rader = [`Läkemedelsberättelse för ${p.text}, framtagen av systemet ${datumI(Date.now())}.`];
  for (const a of andrade) rader.push(`Ändrad dos: ${namn(a.till)} från ${a.fran.dosering.toLowerCase()} till ${a.till.dosering.toLowerCase()}. Orsak: ${a.till.orsak}.`);
  // Runda 8, r4: dosändringar i pågående ordinationer under perioden, bara i ordinationer som syns i berättelsen.
  const synliga = new Set(alla.map(o => o.id));
  const dosandrade = new Set();
  for (const o of pagaendeOrd.filter(x => synliga.has(x.id))) {
    for (const d of dosandringarFor(db, o.id).filter(x => Date.parse(x.tid) >= fran)) {
      dosandrade.add(o.id);
      rader.push(`Ändrad dos: ${namn(o)}${d.galler ? '' : ` från ${d.fran}`}. ${d.text}${d.orsak ? ` Orsak: ${d.orsak}.` : ''}`);
    }
  }
  for (const o of insatta.filter(x => !iAndrade.has(x.id))) rader.push(`Insatt: ${namn(o)}, ${o.dosering.toLowerCase()}. Orsak: ${o.orsak}.`);
  for (const o of utsatta.filter(x => !iAndrade.has(x.id))) rader.push(`Utsatt: ${namn(o)}. Orsak: ${o.utsatt_orsak}.`);
  const ofor = pagaendeOrd.filter(o => Date.parse(o.skapad) < fran && !iAndrade.has(o.id) && !dosandrade.has(o.id));
  if (ofor.length) rader.push(`Oförändrade: ${ofor.map(o => namn(o)).join(', ')}.`);
  // Berättelsen sparas och syns utan samtycke, så doser från en spärrad vårdenhet tas aldrig med, inte ens med samtycke.
  const vb = synligaAdministreringar(utanSamtycke(atk)).filter(a => a.status === 'given' && Date.parse(a.tid) >= fran)
    .filter(a => alla.find(o => o.id === a.ordination_id)?.vid_behov);
  const perLm = new Map();
  for (const a of vb) { const n = db.query('SELECT namn FROM katalog WHERE id = ?').get(a.lakemedel_id)?.namn; perLm.set(n, (perLm.get(n) ?? 0) + 1); }
  for (const [n, antal] of perLm) rader.push(`Vid behov: ${n} har getts ${antal} ${antal === 1 ? 'gång' : 'gånger'}.`);
  const upp = pagaendeOrd.filter(o => o.uppfoljning >= idag() && o.uppfoljning <= addDagar(idag(), 14)).sort((a, b) => a.uppfoljning.localeCompare(b.uppfoljning));
  for (const o of upp) rader.push(`Uppföljning: ${namn(o)} följs upp senast ${o.uppfoljning}.`);
  return { text: rader.join('\n'), period: p };
}

export function genomgang(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const nu = pagaende(atk);
  const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const ok = utanSamtycke(atk).filtrera(db.query('SELECT * FROM overkanslighet WHERE patient_id = ?').all(atk.patientId), 'las_oversikt', { gemensam: true });
  // Interaktioner och överkänslighet med samma demoregler som ordinationskontrollen, för varje ordination mot de andra.
  const par = [];
  const lm = (o) => db.query('SELECT * FROM katalog WHERE id = ?').get(o.lakemedel_id);
  // Genomgången kan sparas och syns då utan samtycke, så eGFR räknas utan samtycke till spärrade uppgifter.
  const egfr = lakemedel.egfrForSakerhet(utanSamtycke(atk));
  for (let i = 0; i < nu.length; i++) {
    for (const andra of nu.slice(i + 1)) {
      for (const v of lakemedel.varningar(db, atk.patientId, lm(nu[i]), [andra])) {
        if (['dubbel_antikoagulantia', 'warfarin_nsaid', 'dubbel_substans'].includes(v.regel)) par.push({ ...v, ordinationer: [nu[i].id, andra.id] });
      }
    }
    for (const v of lakemedel.varningar(db, atk.patientId, lm(nu[i]), [], { overkanslighet: ok, egfr })) par.push({ ...v, ordinationer: [nu[i].id] });
  }
  const fynd = genomgangsfynd({ ordinationer: nu.map(o => kort(db, o)), par, alder: pat ? alder(pat.fodd, idag()) : null, idag: idag() });
  const genomgangar = atk.filtrera(db.query('SELECT * FROM lakemedelsgenomgangar WHERE patient_id = ? ORDER BY tid DESC').all(atk.patientId), 'las_lakemedel', { gemensam: true })
    .map(g => ({ id: g.id, tid: g.tid, av: personNamn(db, g.av), enhet: enhetKort(db, g.enhet_id), antalFynd: JSON.parse(g.fynd).length, berattelse: g.berattelse, bedomning: g.bedomning }));
  return {
    ordinationer: nu.map(o => kort(db, o)), fynd, berattelse: berattelse(atk, { pagaendeOrd: nu }), genomgangar,
    kan: atk.personal.yrke === 'lakare' ? kanVarda(atk, 'ordinera') : { kan: false, varfor: null },
    dolda: { sparrade: atk.doldaSparr }, demoregler: true, anmarkning: DEMOREGLER_PROCESS,
  };
}

// POST /api/patient/:id/lakemedelsgenomgang { bedomning?, berattelse? }. Berättelsen är systemets om läkaren inte har
// ändrat den. Fynden sparas som de var när genomgången gjordes.
export function sparaGenomgang(atk, inp = {}) {
  kravVardande(atk, 'ordinera', null, 'lakemedelsgenomgang');
  const db = atk.db;
  const g = genomgang(atk);
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const ber = text(inp.berattelse, 4000) || g.berattelse.text;
  const bed = text(inp.bedomning, 2000) || null;
  const r = db.query('INSERT INTO lakemedelsgenomgangar (patient_id, enhet_id, tid, av, fynd, berattelse, bedomning, vardtillfalle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id, JSON.stringify(g.fynd), ber, bed, g.berattelse.period.vardtillfalleId);
  return { id: Number(r.lastInsertRowid), ...genomgang(atk) };
}
