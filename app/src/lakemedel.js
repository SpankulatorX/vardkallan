// Läkemedel: ordination, utsättning, varningar och simulerad överföring till Nationella läkemedelslistan (NLL).
// Varningarna är demoregler, inte kliniskt beslutsstöd (D10).
// Runda 9, r5: signerade överföringar till läkemedelslistan (Sussa 5.3.1.5).
import * as signering from './signering.js';
import { Fel, iso, idag, giltigtDatum, installning, addDagar } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { kallaEtikett } from './journal.js';
import { tillaggUt } from './ordinationsmallar.js';
import { utsattningsvarningar, UTSATTNINGSREGLER, DEMOREGLER_PROCESS, UTSATTNINGSPLANER, UPPEHALL_DAGAR, planText, maxPerDygn } from './lakemedelsregler.js';
// Avslutad behandling efter ett uppehåll (runda 5, r4).
import { avslutFor } from './aterinsattning.js';
// Läkemedelsprocessen, del 2 (runda 6, r2): läkemedelstyper, licenser, förpackning och listans flaggor.
import * as stod from './lakemedelsstod.js';
// Runda 9, r1: klinisk läkemedelsprövning (kliniskprovning.js).
import * as provning from './kliniskprovning.js';
// Runda 8, r4: dosändring i en pågående ordination, med ny dosering från ett datum.
import { tillampaDosandringar, planerade as planeradeDosandringar } from './dosandring.js';
// Runda 10, r5: kunskapsstödet vid varningarna.
import * as kunskapsstod from './kunskapsstod.js';
import * as utfallsstod from './utfallsstod.js';

export const DEMOREGLER = 'Varningarna är demoregler för att visa flödet. De är inte kliniskt beslutsstöd och inte CE-märkta.';
export const TYPER = ['staende', 'vid_behov', 'tillfallig'];
// ATC-prefix och koder för reglerna, kontrollerade mot WHO:s ATC-register (src/kodverk.js).
export const ANTIKOAGULANTIA = ['B01AA', 'B01AB', 'B01AE', 'B01AF'];
export const NSAID = 'M01A';
export const WARFARIN = 'B01AA03';
export const METFORMIN = 'A10BA02';

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

// Runda 13, r4: vanliga handelsnamn som sökord, så att den som skriver Ipren eller Voltaren hittar substansen i
// katalogen. Namnen är sökord och påverkar inte vilket läkemedel som ordineras.
export const HANDELSNAMN = {
  ipren: 'ibuprofen', brufen: 'ibuprofen', ibumetin: 'ibuprofen', voltaren: 'diklofenak', eeze: 'diklofenak',
  alvedon: 'paracetamol', panodil: 'paracetamol', pamol: 'paracetamol', trombyl: 'acetylsalicylsyra', magnecyl: 'acetylsalicylsyra',
  brilique: 'tikagrelor', eliquis: 'apixaban', xarelto: 'rivaroxaban', pradaxa: 'dabigatran', waran: 'warfarin',
  seloken: 'metoprolol', furix: 'furosemid', aldactone: 'spironolakton', levaxin: 'levotyroxin', losec: 'omeprazol',
  zoloft: 'sertralin', lipitor: 'atorvastatin', imovane: 'zopiklon', stesolid: 'diazepam', oxynorm: 'oxikodon',
  nitrolingual: 'glyceryltrinitrat', glytrin: 'glyceryltrinitrat', cordarone: 'amiodaron', klacid: 'klaritromycin',
  diflucan: 'flukonazol', fragmin: 'dalteparin', klexane: 'enoxaparin', glucophage: 'metformin', norvasc: 'amlodipin',
  renitec: 'enalapril', atacand: 'kandesartan', betapred: 'betametason', zofran: 'ondansetron', heracillin: 'flukloxacillin',
};
export function sokKatalog(db, q = '') {
  const ord = String(q).trim().toLowerCase().slice(0, 60);
  const s = `%${ord}%`;
  const substanser = ord.length >= 3 ? [...new Set(Object.entries(HANDELSNAMN).filter(([namn]) => namn.startsWith(ord)).map(([, sub]) => sub))] : [];
  const extra = substanser.length ? ` OR lower(substans) IN (${substanser.map(() => '?').join(', ')})` : '';
  return db.query(`SELECT * FROM katalog WHERE lower(namn) LIKE ? OR lower(substans) LIKE ? OR lower(atc) LIKE ?${extra} ORDER BY namn LIMIT 50`).all(s, s, s, ...substanser);
}
const lakemedelRad = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);

// fullVardhandelse: användaren får se den ordinerande vårdenhetens vårdhändelse ur tidboken (ordinationsmallar.tillaggUt).
export function ordinationUt(db, o, { historik = true, fullVardhandelse = false } = {}) {
  const lm = lakemedelRad(db, o.lakemedel_id);
  const ut = {
    id: o.id, patientId: o.patient_id, lakemedel: lm ? { id: lm.id, npl: lm.npl, namn: lm.namn, substans: lm.substans, styrka: lm.styrka, form: lm.form, atc: lm.atc } : null,
    dosering: o.dosering, dos: o.dos, dosEnhet: o.dos_enhet, tider: o.tider ? JSON.parse(o.tider) : [], vidBehov: Boolean(o.vid_behov),
    typ: o.typ, ordinationsorsak: o.orsak, uppfoljningsdatum: o.uppfoljning, start: o.start, slut: o.slut,
    status: o.status, aktuell: o.status === 'aktiv' && (!o.slut || o.slut >= idag()),
    utsatt: o.status === 'utsatt' ? { tid: o.utsatt_tid, av: personNamn(db, o.utsatt_av), orsak: o.utsatt_orsak, plan: utsattningsplan(db, o.id) } : null,
    ordineradAv: { id: o.ordinerad_av, namn: personNamn(db, o.ordinerad_av) }, skapad: o.skapad,
    vardenhet: { id: o.enhet_id, namn: enhetsnamn(db, o.enhet_id) }, nll_status: o.nll_status,
    kvitteradeVarningar: o.kvitterade_varningar ? JSON.parse(o.kvitterade_varningar) : [],
    kalla: o.kalla, kallaEtikett: kallaEtikett(o.kalla, o.start),
    // Administrationssätt, fördefinierad mall och planerad vårdhändelse (ordinationsmallar.js).
    ...tillaggUt(db, o.id, { full: fullVardhandelse }),
    // Runda 6, r2: läkemedelstyp, förpackning, spädning, trappschema, muntlig ordination, generellt direktiv och mall.
    ...stod.tillaggUt(db, o),
  };
  // Runda 8, r4: en dosändring som gäller från ett senare datum.
  const planerade = o.status === 'aktiv' ? planeradeDosandringar(db, o.id) : [];
  if (planerade.length) ut.planeradeDosandringar = planerade;
  if (historik) {
    // Vårdhändelsens rader (tidsättningen för hand och tidboken) visas bara för den som får se hela vårdhändelsen. Andra
    // ser bara att tiden för läkemedlet ändrades, utan tider och utan vem (säkerhetsgranskning runda 5).
    const handelseRad = (h) => h.handelse === 'vardhandelse_tid' || h.handelse.startsWith('Vårdhändelsen');
    ut.historik = db.query('SELECT * FROM ordination_historik WHERE ordination_id = ? ORDER BY tid, id').all(o.id)
      .map(h => (!fullVardhandelse && handelseRad(h) ? { tid: h.tid, handelse: 'Tiden för läkemedlet ändrades', detalj: null, av: null }
        : { tid: h.tid, handelse: h.handelse, detalj: h.detalj, av: personNamn(db, h.personal_id) }));
    // Runda 9, r5: om överföringen är signerad och kvitterad med signatur (signering.js).
    ut.nll = db.query('SELECT * FROM nll_meddelanden WHERE ordination_id = ? ORDER BY id').all(o.id)
      .map(m => ({ id: m.id, typ: m.typ, skickad: m.skickad, status: m.status, svarTid: m.svar_tid, kvittens: m.kvittens,
        signerad: signering.forKalla(db, nllKalla(o.id, m.typ, m.skickad))[0]?.status ?? null }));
  }
  return ut;
}

// Planen som bekräftades när antikoagulantia sattes ut (runda 5), eller null.
export function utsattningsplan(db, ordinationId) {
  const p = db.query('SELECT * FROM utsattningsplaner WHERE ordination_id = ?').get(ordinationId);
  if (!p) return null;
  const ut = { typ: p.typ, ersattMed: p.ersatt_med, aterinsattning: p.aterinsattning, registrerad: p.registrerad, av: personNamn(db, p.av) };
  // Avslutad behandling efter uppehållet (runda 5, r4): läkemedlet sätts inte in igen.
  const avslutad = p.typ === 'uppehall' ? avslutFor(db, ordinationId) : null;
  return { ...ut, text: `${planText(ut)}${avslutad ? `, behandlingen avslutad ${avslutad.tid.slice(0, 10)}: ${avslutad.orsak}` : ''}`, ...(avslutad ? { avslutad } : {}) };
}

// Läkemedelslistan är gemensam för vårdgivaren. Spärrade enheters ordinationer visas inte.
export function synligaOrdinationer(atk) {
  // Runda 8, r4: en dosändring vars datum har kommit börjar gälla innan listan läses.
  tillampaDosandringar(atk.db, atk.patientId);
  const rader = atk.db.query('SELECT * FROM ordinationer WHERE patient_id = ? ORDER BY status, start DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
}

export function lista(atk) {
  atk.krav('las_lakemedel');
  const rader = synligaOrdinationer(atk);
  // Vårdhändelsen ur tidboken visas med namn och tid bara för den ordinerande vårdenheten eller efter aktivt val.
  // Runda 6, r2: flaggorna för filtrering och sortering (särskild observation vid utsättning och passerad uppföljning).
  // Runda 6, r2: ATC-koden läses en gång per ordination, eftersom flaggorna jämför ordinationerna med varandra.
  const kat = new Map(atk.db.query('SELECT * FROM katalog').all().map(k => [k.id, k]));
  const dag = idag();
  const medAtc = rader.map(o => ({ ...o, atc: kat.get(o.lakemedel_id)?.atc }));
  const nya = new Map(atk.db.query('SELECT ordination_id, nytt_uppfoljningsdatum AS d FROM lakemedelsutvarderingar WHERE patient_id = ? AND nytt_uppfoljningsdatum IS NOT NULL ORDER BY tid, id').all(atk.patientId).map(r => [r.ordination_id, r.d]));
  return { ordinationer: rader.map(o => ({ ...ordinationUt(atk.db, o, { fullVardhandelse: atk.prova('las_lakemedel', { enhet_id: o.enhet_id }).tillaten }), ...listflaggor(atk, o, medAtc, nya, kat, dag) })), dolda: { sparrade: atk.doldaSparr } };
}

// Runda 6, r2: läkemedel med särskild observation vid utsättning (Sussa 3.5.1.8) och uppföljningens datum, där en
// senare utvärdering kan ha satt ett nytt (lakemedelsuppfoljning.js).
function listflaggor(atk, o, synliga, nya, kat, dag) {
  const lm = kat.get(o.lakemedel_id);
  // Behandlingstiden räknas bara för läkemedel som har en regel vid utsättning, eftersom den läser hela listan.
  const regel = lm && UTSATTNINGSREGLER.some(r => r.atc.some(x => lm.atc.startsWith(x)));
  const obs = o.status === 'aktiv' && regel ? utsattningsvarningar({ lakemedel: lm, behandlingDagar: behandlingsdagar(atk, { ...o, atc: lm.atc }, synliga) }) : [];
  const datum = nya.get(o.id) ?? o.uppfoljning;
  return { sarskildObservation: obs.length ? obs[0].text : null, aktuelltUppfoljningsdatum: datum, uppfoljningPasserad: o.status === 'aktiv' && (!o.slut || o.slut >= dag) && datum < dag };
}

const arAktuell = (o) => o.status === 'aktiv' && (!o.slut || o.slut >= idag());

// Kontroll av obligatoriska fält. Ordinationsorsak och uppföljningsdatum krävs alltid (NLL).
export function validera(db, inp, { full = true, frivilligOrsak = false } = {}) {
  const falt = [];
  const lm = typeof inp?.lakemedelId === 'string' ? lakemedelRad(db, inp.lakemedelId) : null;
  if (!lm) falt.push('lakemedelId');
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const o = {
    lm, dosering: text(inp?.dosering), dos: inp?.dos == null || inp.dos === '' ? null : Number(inp.dos), dosEnhet: text(inp?.dosEnhet) || null,
    tider: Array.isArray(inp?.tider) ? inp.tider.map(String).slice(0, 12) : [], vidBehov: Boolean(inp?.vidBehov),
    typ: inp?.typ ?? (inp?.vidBehov ? 'vid_behov' : 'staende'), ordinationsorsak: text(inp?.ordinationsorsak),
    uppfoljningsdatum: inp?.uppfoljningsdatum, start: inp?.start ?? idag(), slut: inp?.slut || null,
  };
  if (full) {
    if (!o.dosering || o.dosering.length > 300) falt.push('dosering');
    if (o.dos != null && (!Number.isFinite(o.dos) || o.dos <= 0)) falt.push('dos');
    if (!TYPER.includes(o.typ)) falt.push('typ');
    // Runda 12, r1: en frivillig uppgift som är tom får systemets text och ett uppföljningsdatum 30 dagar efter start.
    if (frivilligOrsak && !o.ordinationsorsak) o.ordinationsorsak = 'Inte angiven. Ordinationen förs inte över till Nationella läkemedelslistan.';
    if (frivilligOrsak && (o.uppfoljningsdatum == null || o.uppfoljningsdatum === '') && giltigtDatum(o.start)) o.uppfoljningsdatum = addDagar(o.start, 30);
    if (!o.ordinationsorsak || o.ordinationsorsak.length > 300) falt.push('ordinationsorsak');
    if (!giltigtDatum(o.start)) falt.push('start');
    if (!giltigtDatum(o.uppfoljningsdatum) || (giltigtDatum(o.start) && o.uppfoljningsdatum < o.start)) falt.push('uppfoljningsdatum');
    if (o.slut != null && (!giltigtDatum(o.slut) || o.slut < o.start)) falt.push('slut');
  }
  if (falt.length) {
    const namn = { lakemedelId: 'läkemedel', dosering: 'dosering', dos: 'dos', typ: 'typ', ordinationsorsak: 'ordinationsorsak', start: 'startdatum', uppfoljningsdatum: 'uppföljningsdatum', slut: 'slutdatum' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.${falt.includes('ordinationsorsak') || falt.includes('uppfoljningsdatum') ? ' Ordinationsorsak och uppföljningsdatum är obligatoriska. Nationella läkemedelslistan tar inte emot en ordination utan dem.' : ''}`, 'ogiltig', { falt });
  }
  return o;
}

// Demoregler för varningar före sparande.
// Runda 12, r1: dygnsdosen mot vårdgivarens högsta dygnsdos för substansen (konfiguration.js, lakemedel.maxdoser).
// Dygnsdosen är dosen gånger tiderna, eller vid behov dosen gånger högsta antal per dygn i doseringen. Demoregel.
function maxdosVarningar(lm, o, lista) {
  if (o.dos == null || !Number.isFinite(o.dos)) return [];
  const rad = lista.map(x => x.split(' ')).find(([atc, , enhet]) => lm.atc.startsWith(atc) && (o.dosEnhet ?? '').toLowerCase() === enhet.toLowerCase());
  if (!rad) return [];
  const max = Number(rad[1]);
  const vb = o.vidBehov || o.typ === 'vid_behov';
  const antal = vb ? maxPerDygn(o.dosering ?? '')?.antal ?? null : (o.tider?.length || null);
  if (!antal) return [];
  const dygn = Math.round(o.dos * antal * 1000) / 1000;
  if (dygn <= max) return [];
  return [{ niva: 'allvarlig', regel: 'maxdos', text: `Dygnsdosen blir ${String(dygn).replace('.', ',')} ${rad[2]}, högre än högsta dygnsdosen ${String(max).replace('.', ',')} ${rad[2]} för ${lm.substans.toLowerCase()} (vårdgivarens regel, demoregel).` }];
}

export function varningar(db, patientId, lm, aktiva, { overkanslighet = [], egfr = null, enhetId = null, studier = null, ordination = null } = {}) {
  const ut = [];
  // Runda 12, r1: interaktionerna, maxdoserna och gränserna för metformin är parametrar som systemförvaltningen
  // ändrar med fyra ögon (konfiguration.js, Sussa 12.1.1.8). Demoregler.
  const konfig = (k) => require('./konfiguration.js').varde(db, k);
  const interaktioner = konfig('lakemedel.interaktioner').map(x => x.split(' + '));
  if (ordination) ut.push(...maxdosVarningar(lm, ordination, konfig('lakemedel.maxdoser')));
  // Runda 9, r1: klinisk prövning, bara ur de deltaganden som användaren får se (kliniskprovning.js).
  if (studier) ut.push(...provning.varningar(db, lm, studier));
  // Runda 6, r2: licensläkemedel, extempore och blodprodukter, prövat för den ordinerande vårdenheten.
  if (enhetId) ut.push(...stod.ordinationsvarningar(db, { lm, patientId, enhetId }));
  const lmFor = (o) => lakemedelRad(db, o.lakemedel_id);
  for (const ok of overkanslighet) {
    if (ok.atc && lm.atc.startsWith(ok.atc)) {
      ut.push({ niva: 'allvarlig', regel: 'overkanslighet', text: `Patienten har registrerad överkänslighet mot ${ok.amne.toLowerCase()} (${ok.atc}). ${lm.namn} har ATC-kod ${lm.atc}.` });
    }
  }
  let antikoag = false;
  for (const o of aktiva) {
    const a = lmFor(o);
    if (!a) continue;
    if (a.atc === lm.atc) {
      ut.push({ niva: 'allvarlig', regel: 'dubbel_substans', text: `Patienten har redan en aktiv ordination av ${a.substans} (${a.namn}).` });
      continue;
    }
    const kNy = ANTIKOAGULANTIA.some(k => lm.atc.startsWith(k));
    const kGammal = ANTIKOAGULANTIA.some(k => a.atc.startsWith(k));
    if (kNy && kGammal) {
      antikoag = true;
      ut.push({ niva: 'allvarlig', regel: 'dubbel_antikoagulantia', text: `Två antikoagulantia samtidigt: ${lm.namn} och ${a.namn}. Ökad blödningsrisk.` });
      continue;
    }
    // Runda 12, r1: interaktionerna i vårdgivarens lista. Warfarin och NSAID har sin egen text och regel som förut.
    const par = interaktioner.find(([x, y]) => (lm.atc.startsWith(x) && a.atc.startsWith(y)) || (lm.atc.startsWith(y) && a.atc.startsWith(x)));
    if (par) {
      const [x, y] = par;
      if (x === WARFARIN && y === NSAID) ut.push({ niva: 'allvarlig', regel: 'warfarin_nsaid', text: `Warfarin och NSAID (${lm.atc === WARFARIN ? a.namn : lm.namn}) ökar risken för allvarlig blödning.` });
      else ut.push({ niva: 'allvarlig', regel: `interaktion_${x}_${y}`, text: `${lm.namn} och ${a.namn} kan påverka varandra och ska bara ges samtidigt efter en bedömning (vårdgivarens regel ${x} + ${y}, demoregel).` });
      continue;
    }
    if (a.atc.slice(0, 5) === lm.atc.slice(0, 5) && !antikoag) {
      ut.push({ niva: 'observera', regel: 'dubbel_grupp', text: `Patienten har redan ett läkemedel i samma grupp (${lm.atc.slice(0, 5)}): ${a.namn}.` });
    }
  }
  if (lm.atc === METFORMIN && egfr != null) {
    // Runda 12, r1: gränserna är parametrar.
    const stopp = konfig('lakemedel.metformin_egfr_stopp');
    const grans = Math.max(stopp, konfig('lakemedel.metformin_egfr_varning'));
    if (egfr < stopp) ut.push({ niva: 'allvarlig', regel: 'metformin_egfr', text: `Metformin vid eGFR ${egfr}. Under ${stopp} ska metformin inte användas.` });
    else if (egfr < grans) ut.push({ niva: 'observera', regel: 'metformin_egfr', text: `Metformin vid eGFR ${egfr}. Dosen bör begränsas när eGFR är ${stopp} till ${grans - 1}.` });
  }
  // Runda 10, r5: varför systemet varnar, vad användaren kan göra och källan (kunskapsstod.js).
  return kunskapsstod.berika(ut);
}

// Senaste eGFR för säkerhetskontrollerna (varningar vid ordination, ordinationsförslag och läkemedelsgenomgång). Ett
// lågt eGFR är en säkerhetsuppgift som läkemedelslistan och överkänsligheten: det räknas från alla vårdenheter utan
// aktivt val, men aldrig från en spärrad vårdenhet utan samtycke. Samma regel överallt.
export function egfrForSakerhet(atk) {
  return atk.db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'egfr' ORDER BY tid DESC").all(atk.patientId)
    .find(m => atk.prova('las_lakemedel', { enhet_id: m.enhet_id, gemensam: true }).tillaten)?.varde_num ?? null;
}

export function underlag(atk) {
  const db = atk.db;
  const aktiva = synligaOrdinationer(atk).filter(arAktuell);
  const ok = atk.filtrera(db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv'").all(atk.patientId), 'las_oversikt', { gemensam: true });
  return { aktiva, overkanslighet: ok, egfr: egfrForSakerhet(atk), enhetId: atk.personal.enhet_id,
    // Runda 9, r1: patientens deltagande i kliniska prövningar som användaren får se.
    studier: provning.synligaDeltaganden(atk) };
}

export function kontroll(atk, inp) {
  atk.krav('ordinera');
  const o = validera(atk.db, inp, { full: false });
  const u = underlag(atk);
  // Runda 10, r5: vid varje varning hur ofta den har kvitterats på vårdenheten (utfallsstod.js, Sussa 3.2.1.3).
  return { varningar: utfallsstod.vidVarningar(atk.db, atk.personal, varningar(atk.db, atk.patientId, o.lm, u.aktiva, { ...u, ordination: o })), demoregler: true, anmarkning: DEMOREGLER };
}

function historik(db, ordId, personalId, handelse, detalj = null) {
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(ordId, iso(), personalId, handelse, detalj);
}

let kvittensNr = Math.floor(Math.random() * 90000) + 10000;
const nyKvittens = () => `NLL-${String(++kvittensNr).padStart(6, '0')}`;

// Runda 9, r5: innehållet i en överföring till läkemedelslistan, som det signeras och som det kontrolleras i efterhand.
// Bara uppgifter som inte ändras efter överföringen är med, och utsättningen för en utsättning.
export const nllKalla = (ordId, typ, skickad) => `nll:${ordId}:${typ}:${skickad}`;
export function nllInnehall(db, ordId, typ, skickad) {
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(ordId);
  if (!o) return undefined;
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(o.patient_id);
  const hsa = (tabell, id) => db.query(`SELECT hsa_id FROM ${tabell} WHERE id = ?`).get(id)?.hsa_id ?? null;
  return {
    typ, skickad, ordination: o.id, patient: p?.personnummer ?? null, lakemedel: o.lakemedel_id, npl: lakemedelRad(db, o.lakemedel_id)?.npl ?? null,
    dosering: o.dosering, start: o.start, forskrivare: hsa('personal', o.ordinerad_av), vardenhet: hsa('enheter', o.enhet_id),
    ...(typ === 'utsattning' ? { utsatt: o.utsatt_tid, orsak: o.utsatt_orsak } : {}),
  };
}

// Simulerad överföring. Vid timeout är ordinationen ändå registrerad i NLL, vilket avstämningen visar.
export function overfor(db, ordId, typ) {
  const lage = installning(db, 'nll_nasta');
  const t = iso();
  if (lage === 'timeout') {
    installning(db, 'nll_nasta', '');
    const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, nll_registrerad) VALUES (?, ?, ?, 'timeout', 1)").run(ordId, typ, t);
    db.query("UPDATE ordinationer SET nll_status = 'okand_kontrolleras' WHERE id = ?").run(ordId);
    historik(db, ordId, null, 'NLL svarade inte i tid på överföringen', 'Status okänd, kontrolleras genom avstämning. Ordinationen gäller och visas i listan.');
    return { id: Number(r.lastInsertRowid), status: 'timeout' };
  }
  if (lage === 'fel') {
    installning(db, 'nll_nasta', '');
    const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, nll_registrerad) VALUES (?, ?, ?, 'fel', ?, 0)").run(ordId, typ, t, iso());
    db.query("UPDATE ordinationer SET nll_status = 'fel' WHERE id = ?").run(ordId);
    historik(db, ordId, null, 'NLL svarade med fel', 'Ordinationen är inte registrerad i NLL. Avstämning skickar den igen.');
    return { id: Number(r.lastInsertRowid), status: 'fel' };
  }
  // Runda 9, r5 (Sussa 5.3.1.5): överföringen signeras med Vårdkällans certifikat, och läkemedelslistan svarar med en
  // signerad kvittens. Går kvittensen inte att kontrollera räknas överföringen som misslyckad, och avstämningen skickar
  // ordinationen igen.
  const ord = db.query('SELECT enhet_id FROM ordinationer WHERE id = ?').get(ordId);
  const bevis = signering.skicka(db, { typ: 'nll', kalla: nllKalla(ordId, typ, t), enhetId: ord?.enhet_id ?? 'rol', innehall: nllInnehall(db, ordId, typ, t), nu: new Date(t) });
  if (bevis.status !== 'kvitterat') {
    const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, nll_registrerad) VALUES (?, ?, ?, 'fel', ?, 0)").run(ordId, typ, t, iso());
    db.query("UPDATE ordinationer SET nll_status = 'fel' WHERE id = ?").run(ordId);
    historik(db, ordId, null, 'Kvittensen från NLL godtogs inte', `${bevis.orsak} Ordinationen räknas inte som registrerad i NLL. Avstämning skickar den igen.`);
    return { id: Number(r.lastInsertRowid), status: 'fel' };
  }
  const k = nyKvittens();
  const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, ?, ?, 'kvitterad', ?, ?, 1)").run(ordId, typ, t, iso(), k);
  db.query("UPDATE ordinationer SET nll_status = 'kvitterad' WHERE id = ?").run(ordId);
  historik(db, ordId, null, 'Kvitterad av NLL', k);
  return { id: Number(r.lastInsertRowid), status: 'kvitterad', kvittens: k };
}

// Runda 6, r2: en muntlig ordination registreras av sjuksköterskan med läkaren som ordinatör och skickas till NLL först
// när läkaren har signerat, och en ordination enligt generellt direktiv görs av sjuksköterskan (ordinationsvagar.js).
// Blodprodukter, nutrition och egendefinierade läkemedel skickas inte till NLL.
export function spara(atk, inp, { handling = 'ordinera', ordineradAv = null, nll: skickaNll = true, nllStatus = 'ej_aktuell', historikText = 'Ordinerad' } = {}) {
  atk.krav(handling);
  const db = atk.db;
  // Runda 12, r1: ordinationsorsak och uppföljningsdatum kan vara frivilliga när ordinationen inte förs över till NLL,
  // om vårdgivaren har valt det (konfiguration.js, lakemedel.orsak_frivillig_utan_nll).
  const utanNll = typeof inp?.lakemedelId === 'string' && stod.UTAN_NLL.has(stod.produkttyp(db, inp.lakemedelId).typ);
  const o = validera(db, inp, { frivilligOrsak: utanNll && require('./konfiguration.js').varde(db, 'lakemedel.orsak_frivillig_utan_nll') });
  const u = underlag(atk);
  const v = varningar(db, atk.patientId, o.lm, u.aktiva, { ...u, ordination: o });
  const skickas = skickaNll && !stod.UTAN_NLL.has(stod.produkttyp(db, o.lm.id).typ);
  const kvitterade = Array.isArray(inp.kvitteradeVarningar) ? inp.kvitteradeVarningar : [];
  const saknas = [...new Set(v.filter(x => x.niva === 'allvarlig').map(x => x.regel))]
    .filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) {
    throw new Fel(400, 'Allvarliga varningar måste kvitteras med motivering innan ordinationen sparas.', 'ogiltig', { varningar: v, kraverKvittens: saknas, demoregler: true });
  }
  const kv = kvitterade.filter(k => v.some(x => x.regel === k.regel)).map(k => ({ regel: k.regel, motivering: k.motivering.trim().slice(0, 500) }));
  const r = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, slut,
    ordinerad_av, skapad, nll_status, kvitterade_varningar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(atk.patientId, atk.personal.enhet_id, o.lm.id, o.dosering, o.dos, o.dosEnhet, JSON.stringify(o.tider), o.vidBehov ? 1 : 0, o.typ,
      o.ordinationsorsak, o.uppfoljningsdatum, o.start, o.slut, ordineradAv ?? atk.personal.id, iso(), skickas ? 'skickad' : nllStatus, kv.length ? JSON.stringify(kv) : null);
  const id = Number(r.lastInsertRowid);
  historik(db, id, atk.personal.id, historikText, o.dosering);
  for (const k of kv) historik(db, id, atk.personal.id, 'Varning kvitterad', `${k.regel}: ${k.motivering}`);
  const nll = skickas ? overfor(db, id, 'ny') : { status: nllStatus };
  return { ordination: ordinationUt(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(id)), varningar: v, nll };
}

export function hamtaRad(db, id) {
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(id));
  if (!o) throw new Fel(404, 'Ordinationen finns inte.', 'saknas');
  // Runda 8, r4: en dosändring vars datum har kommit gäller innan ordinationen används.
  tillampaDosandringar(db, o.patient_id);
  return db.query('SELECT * FROM ordinationer WHERE id = ?').get(o.id);
}

// Hur många dagar patienten har haft substansen utan uppehåll: från den tidigaste av de synliga ordinationerna av samma
// substans som följer på varandra med högst ett dygns uppehåll.
export function behandlingsdagar(atk, o, synliga = null) {
  const db = atk.db;
  const atc = o.atc ?? lakemedelRad(db, o.lakemedel_id)?.atc;
  const samma = (synliga ?? synligaOrdinationer(atk)).filter(x => (x.atc ?? lakemedelRad(db, x.lakemedel_id)?.atc) === atc).sort((a, b) => a.start.localeCompare(b.start));
  const slutDag = (x) => (x.status === 'utsatt' ? x.utsatt_tid.slice(0, 10) : x.slut ?? idag());
  let start = o.start;
  for (let i = samma.length - 1; i >= 0; i--) {
    const x = samma[i];
    if (x.id === o.id || x.start >= start) continue;
    if (Date.parse(slutDag(x)) >= Date.parse(start) - 86400_000) start = x.start;
  }
  return Math.max(0, Math.round((Date.parse(idag()) - Date.parse(start)) / 86400_000));
}

// Varning vid utsättning av läkemedel med särskilda observationer (Sussa 3.5.2.8). Demoregler i lakemedelsregler.js.
export function utsattningskontroll(atk, o) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  const lm = lakemedelRad(atk.db, o.lakemedel_id);
  // Runda 10, r5: med kunskapsstödets förklaring (kunskapsstod.js).
  const varningar = o.status === 'aktiv' && lm ? kunskapsstod.berika(utsattningsvarningar({ lakemedel: lm, behandlingDagar: behandlingsdagar(atk, o) })) : [];
  return { varningar, ...(varningar.some(v => v.plan) ? { planer: planforslag(atk, o) } : {}), demoregler: true, anmarkning: DEMOREGLER_PROCESS };
}

// Planerna som systemet föreslår vid utsättning av antikoagulantia (runda 5). Vid byte föreslås det antikoagulantia som
// patienten redan har fått ordinerat, bland de ordinationer som användaren får se. Vid uppehåll föreslås ett datum för
// återinsättning som läkaren kan ändra.
function planforslag(atk, o) {
  const db = atk.db;
  const annat = synligaOrdinationer(atk).filter(arAktuell).filter(x => x.id !== o.id && x.lakemedel_id !== o.lakemedel_id)
    .map(x => lakemedelRad(db, x.lakemedel_id)).find(lm => lm && ANTIKOAGULANTIA.some(k => lm.atc.startsWith(k)));
  return Object.entries(UTSATTNINGSPLANER).map(([typ, p]) => ({
    typ, text: p.text, beskrivning: p.beskrivning, orsak: p.orsak,
    ...(typ === 'byte' ? { ersattMed: annat?.namn ?? null } : {}),
    ...(typ === 'uppehall' ? { aterinsattning: addDagar(idag(), UPPEHALL_DAGAR) } : {}),
  }));
}

// Kontrollerar planen. Ger { typ, ersattMed, aterinsattning } eller kastar Fel som förklarar vad som saknas.
function valideraPlan(plan, v, planer) {
  const typ = plan?.typ;
  if (!Object.hasOwn(UTSATTNINGSPLANER, typ ?? '')) {
    throw new Fel(400, 'Antikoagulantia sätts bara ut med en plan. Välj planen: byte till ett annat medel, uppehåll inför ett ingrepp eller avslutad behandling.', 'ogiltig', { varningar: v, kraverPlan: true, planer, falt: ['plan'], demoregler: true });
  }
  const ersattMed = typeof plan.ersattMed === 'string' && plan.ersattMed.trim() ? plan.ersattMed.trim().slice(0, 100) : null;
  let aterinsattning = null;
  if (typ === 'uppehall') {
    aterinsattning = plan.aterinsattning;
    if (!giltigtDatum(aterinsattning) || aterinsattning < idag() || aterinsattning > addDagar(idag(), 365)) {
      throw new Fel(400, 'Ange när behandlingen ska sättas in igen, i dag eller senare och inom ett år.', 'ogiltig', { varningar: v, kraverPlan: true, planer, falt: ['aterinsattning'], demoregler: true });
    }
  }
  return { typ, ersattMed: typ === 'byte' ? ersattMed : null, aterinsattning };
}

export function utsatt(atk, o, { orsak, kvitteradeVarningar, plan } = {}) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  if (o.status !== 'aktiv') throw new Fel(400, 'Ordinationen är redan utsatt.', 'ogiltig');
  const db = atk.db;
  const k = utsattningskontroll(atk, o);
  const v = k.varningar;
  // Antikoagulantia (runda 5): planen är bekräftelsen, och orsaken fylls i ur planen när läkaren inte skriver en egen.
  const p = v.some(x => x.plan) ? valideraPlan(plan, v, k.planer) : null;
  if (p && (typeof orsak !== 'string' || orsak.trim().length < 3)) orsak = `${UTSATTNINGSPLANER[p.typ].orsak}${p.ersattMed ? `: ${p.ersattMed}` : ''}`;
  if (typeof orsak !== 'string' || orsak.trim().length < 3) throw new Fel(400, 'Ange orsak till utsättningen.', 'ogiltig', { falt: ['orsak'] });
  // En allvarlig varning kvitteras i samma steg: orsaken till utsättningen är motiveringen.
  const kv = Array.isArray(kvitteradeVarningar) ? kvitteradeVarningar : [];
  const saknas = [...new Set(v.filter(x => x.niva === 'allvarlig' && !x.plan).map(x => x.regel))].filter(r => !kv.some(k => k?.regel === r));
  if (saknas.length) throw new Fel(400, 'Läkemedlet har särskilda observationer vid utsättning. Läs varningen och bekräfta utsättningen.', 'ogiltig', { varningar: v, kraverKvittens: saknas, demoregler: true });
  db.query("UPDATE ordinationer SET status = 'utsatt', utsatt_tid = ?, utsatt_av = ?, utsatt_orsak = ? WHERE id = ?").run(iso(), atk.personal.id, orsak.trim(), o.id);
  historik(db, o.id, atk.personal.id, 'Utsatt', orsak.trim());
  if (p) {
    db.query('INSERT INTO utsattningsplaner (ordination_id, typ, ersatt_med, aterinsattning, registrerad, av) VALUES (?, ?, ?, ?, ?, ?)').run(o.id, p.typ, p.ersattMed, p.aterinsattning, iso(), atk.personal.id);
    historik(db, o.id, atk.personal.id, 'Plan vid utsättning', planText(p));
  }
  for (const x of v.filter(y => y.niva === 'allvarlig')) historik(db, o.id, atk.personal.id, 'Varning vid utsättning kvitterad', `${x.regel}: ${x.plan ? planText(p) : orsak.trim()}`);
  const nll = overfor(db, o.id, 'utsattning');
  return { ordination: ordinationUt(db, hamtaRad(db, o.id)), nll, varningar: v };
}

// Avstämning: frågar NLL igen om en överföring med okänd status.
export function avstam(atk, o) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  const db = atk.db;
  if (o.nll_status === 'kvitterad') throw new Fel(400, 'Ordinationen är redan kvitterad av NLL.', 'ogiltig');
  const senaste = db.query("SELECT * FROM nll_meddelanden WHERE ordination_id = ? AND status IN ('timeout', 'fel') ORDER BY id DESC").get(o.id);
  const k = nyKvittens();
  if (senaste?.nll_registrerad) {
    db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, 'avstamning', ?, 'kvitterad', ?, ?, 1)").run(o.id, iso(), iso(), k);
    db.query("UPDATE ordinationer SET nll_status = 'kvitterad' WHERE id = ?").run(o.id);
    historik(db, o.id, atk.personal.id, 'Avstämning mot NLL: ordinationen finns registrerad', k);
    return { ordination: ordinationUt(db, hamtaRad(db, o.id)), resultat: 'fanns_registrerad', kvittens: k };
  }
  historik(db, o.id, atk.personal.id, 'Avstämning mot NLL: ordinationen saknades och skickas igen');
  const nll = overfor(db, o.id, 'ny');
  return { ordination: ordinationUt(db, hamtaRad(db, o.id)), resultat: 'skickad_igen', nll };
}

// Ordinationer från min vårdenhet där NLL-status är okänd eller fel.
export function nllAvvikelser(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query("SELECT * FROM ordinationer WHERE nll_status IN ('okand_kontrolleras', 'fel') ORDER BY skapad DESC").all()
    .filter(o => vardenhetFor(db, o.enhet_id) === ve)
    .map(o => ({ ordinationId: o.id, patientId: o.patient_id, lakemedel: lakemedelRad(db, o.lakemedel_id)?.namn, nll_status: o.nll_status, skapad: o.skapad }));
}

export const aktuell = arAktuell;
