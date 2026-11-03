// Läkemedel: ordination, utsättning, varningar och simulerad överföring till Nationella läkemedelslistan (NLL).
// Varningarna är demoregler, inte kliniskt beslutsstöd (D10).
import { Fel, iso, idag, giltigtDatum, installning } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { kallaEtikett } from './journal.js';
import { tillaggUt } from './ordinationsmallar.js';
import { utsattningsvarningar, DEMOREGLER_PROCESS } from './lakemedelsregler.js';

export const DEMOREGLER = 'Varningarna är demoregler för att visa flödet. De är inte kliniskt beslutsstöd och inte CE-märkta.';
export const TYPER = ['staende', 'vid_behov', 'tillfallig'];
// ATC-prefix och koder för reglerna, kontrollerade mot WHO:s ATC-register (src/kodverk.js).
export const ANTIKOAGULANTIA = ['B01AA', 'B01AB', 'B01AE', 'B01AF'];
export const NSAID = 'M01A';
export const WARFARIN = 'B01AA03';
export const METFORMIN = 'A10BA02';

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

export function sokKatalog(db, q = '') {
  const s = `%${String(q).trim().toLowerCase().slice(0, 60)}%`;
  return db.query('SELECT * FROM katalog WHERE lower(namn) LIKE ? OR lower(substans) LIKE ? OR lower(atc) LIKE ? ORDER BY namn LIMIT 50').all(s, s, s);
}
const lakemedelRad = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);

export function ordinationUt(db, o, { historik = true } = {}) {
  const lm = lakemedelRad(db, o.lakemedel_id);
  const ut = {
    id: o.id, patientId: o.patient_id, lakemedel: lm ? { id: lm.id, npl: lm.npl, namn: lm.namn, substans: lm.substans, styrka: lm.styrka, form: lm.form, atc: lm.atc } : null,
    dosering: o.dosering, dos: o.dos, dosEnhet: o.dos_enhet, tider: o.tider ? JSON.parse(o.tider) : [], vidBehov: Boolean(o.vid_behov),
    typ: o.typ, ordinationsorsak: o.orsak, uppfoljningsdatum: o.uppfoljning, start: o.start, slut: o.slut,
    status: o.status, aktuell: o.status === 'aktiv' && (!o.slut || o.slut >= idag()),
    utsatt: o.status === 'utsatt' ? { tid: o.utsatt_tid, av: personNamn(db, o.utsatt_av), orsak: o.utsatt_orsak } : null,
    ordineradAv: { id: o.ordinerad_av, namn: personNamn(db, o.ordinerad_av) }, skapad: o.skapad,
    vardenhet: { id: o.enhet_id, namn: enhetsnamn(db, o.enhet_id) }, nll_status: o.nll_status,
    kvitteradeVarningar: o.kvitterade_varningar ? JSON.parse(o.kvitterade_varningar) : [],
    kalla: o.kalla, kallaEtikett: kallaEtikett(o.kalla, o.start),
    // Administrationssätt, fördefinierad mall och planerad vårdhändelse (ordinationsmallar.js).
    ...tillaggUt(db, o.id),
  };
  if (historik) {
    ut.historik = db.query('SELECT * FROM ordination_historik WHERE ordination_id = ? ORDER BY tid, id').all(o.id)
      .map(h => ({ tid: h.tid, handelse: h.handelse, detalj: h.detalj, av: personNamn(db, h.personal_id) }));
    ut.nll = db.query('SELECT * FROM nll_meddelanden WHERE ordination_id = ? ORDER BY id').all(o.id)
      .map(m => ({ id: m.id, typ: m.typ, skickad: m.skickad, status: m.status, svarTid: m.svar_tid, kvittens: m.kvittens }));
  }
  return ut;
}

// Läkemedelslistan är gemensam för vårdgivaren. Spärrade enheters ordinationer visas inte.
export function synligaOrdinationer(atk) {
  const rader = atk.db.query('SELECT * FROM ordinationer WHERE patient_id = ? ORDER BY status, start DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
}

export function lista(atk) {
  atk.krav('las_lakemedel');
  const rader = synligaOrdinationer(atk);
  return { ordinationer: rader.map(o => ordinationUt(atk.db, o)), dolda: { sparrade: atk.doldaSparr } };
}

const arAktuell = (o) => o.status === 'aktiv' && (!o.slut || o.slut >= idag());

// Kontroll av obligatoriska fält. Ordinationsorsak och uppföljningsdatum krävs alltid (NLL).
export function validera(db, inp, { full = true } = {}) {
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
    if (!o.ordinationsorsak || o.ordinationsorsak.length > 300) falt.push('ordinationsorsak');
    if (!giltigtDatum(o.start)) falt.push('start');
    if (!giltigtDatum(o.uppfoljningsdatum) || (giltigtDatum(o.start) && o.uppfoljningsdatum < o.start)) falt.push('uppfoljningsdatum');
    if (o.slut != null && (!giltigtDatum(o.slut) || o.slut < o.start)) falt.push('slut');
  }
  if (falt.length) {
    const namn = { lakemedelId: 'läkemedel', dosering: 'dosering', dos: 'dos', typ: 'typ', ordinationsorsak: 'ordinationsorsak', start: 'startdatum', uppfoljningsdatum: 'uppföljningsdatum', slut: 'slutdatum' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.${falt.includes('ordinationsorsak') || falt.includes('uppfoljningsdatum') ? ' Ordinationsorsak och uppföljningsdatum är obligatoriska.' : ''}`, 'ogiltig', { falt });
  }
  return o;
}

// Demoregler för varningar före sparande.
export function varningar(db, patientId, lm, aktiva, { overkanslighet = [], egfr = null } = {}) {
  const ut = [];
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
    if ((lm.atc === WARFARIN && a.atc.startsWith(NSAID)) || (lm.atc.startsWith(NSAID) && a.atc === WARFARIN)) {
      ut.push({ niva: 'allvarlig', regel: 'warfarin_nsaid', text: `Warfarin och NSAID (${lm.atc === WARFARIN ? a.namn : lm.namn}) ökar risken för allvarlig blödning.` });
      continue;
    }
    if (a.atc.slice(0, 5) === lm.atc.slice(0, 5) && !antikoag) {
      ut.push({ niva: 'observera', regel: 'dubbel_grupp', text: `Patienten har redan ett läkemedel i samma grupp (${lm.atc.slice(0, 5)}): ${a.namn}.` });
    }
  }
  if (lm.atc === METFORMIN && egfr != null) {
    if (egfr < 30) ut.push({ niva: 'allvarlig', regel: 'metformin_egfr', text: `Metformin vid eGFR ${egfr}. Under 30 ska metformin inte användas.` });
    else if (egfr < 45) ut.push({ niva: 'observera', regel: 'metformin_egfr', text: `Metformin vid eGFR ${egfr}. Dosen bör begränsas när eGFR är 30 till 44.` });
  }
  return ut;
}

function underlag(atk) {
  const db = atk.db;
  const aktiva = synligaOrdinationer(atk).filter(arAktuell);
  const ok = atk.filtrera(db.query('SELECT * FROM overkanslighet WHERE patient_id = ?').all(atk.patientId), 'las_oversikt', { gemensam: true });
  // Senaste eGFR oavsett enhet, utom spärrade. Säkerhetskontrollen avslöjar bara att värdet är lågt.
  const egfrRader = db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'egfr' ORDER BY tid DESC").all(atk.patientId)
    .filter(m => atk.prova('las_lakemedel', { enhet_id: m.enhet_id, gemensam: true }).tillaten);
  return { aktiva, overkanslighet: ok, egfr: egfrRader[0]?.varde_num ?? null };
}

export function kontroll(atk, inp) {
  atk.krav('ordinera');
  const o = validera(atk.db, inp, { full: false });
  const u = underlag(atk);
  return { varningar: varningar(atk.db, atk.patientId, o.lm, u.aktiva, u), demoregler: true, anmarkning: DEMOREGLER };
}

function historik(db, ordId, personalId, handelse, detalj = null) {
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(ordId, iso(), personalId, handelse, detalj);
}

let kvittensNr = Math.floor(Math.random() * 90000) + 10000;
const nyKvittens = () => `NLL-${String(++kvittensNr).padStart(6, '0')}`;

// Simulerad överföring. Vid timeout är ordinationen ändå registrerad i NLL, vilket avstämningen visar.
export function overfor(db, ordId, typ) {
  const lage = installning(db, 'nll_nasta');
  const t = iso();
  if (lage === 'timeout') {
    installning(db, 'nll_nasta', '');
    const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, nll_registrerad) VALUES (?, ?, ?, 'timeout', 1)").run(ordId, typ, t);
    db.query("UPDATE ordinationer SET nll_status = 'okand_kontrolleras' WHERE id = ?").run(ordId);
    historik(db, ordId, null, 'Överföring till NLL fick timeout', 'Status okänd, kontrolleras genom avstämning. Ordinationen gäller och visas i listan.');
    return { id: Number(r.lastInsertRowid), status: 'timeout' };
  }
  if (lage === 'fel') {
    installning(db, 'nll_nasta', '');
    const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, nll_registrerad) VALUES (?, ?, ?, 'fel', ?, 0)").run(ordId, typ, t, iso());
    db.query("UPDATE ordinationer SET nll_status = 'fel' WHERE id = ?").run(ordId);
    historik(db, ordId, null, 'NLL svarade med fel', 'Ordinationen är inte registrerad i NLL. Avstämning skickar den igen.');
    return { id: Number(r.lastInsertRowid), status: 'fel' };
  }
  const k = nyKvittens();
  const r = db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, ?, ?, 'kvitterad', ?, ?, 1)").run(ordId, typ, t, iso(), k);
  db.query("UPDATE ordinationer SET nll_status = 'kvitterad' WHERE id = ?").run(ordId);
  historik(db, ordId, null, 'Kvitterad av NLL', k);
  return { id: Number(r.lastInsertRowid), status: 'kvitterad', kvittens: k };
}

export function spara(atk, inp) {
  atk.krav('ordinera');
  const db = atk.db;
  const o = validera(db, inp);
  const u = underlag(atk);
  const v = varningar(db, atk.patientId, o.lm, u.aktiva, u);
  const kvitterade = Array.isArray(inp.kvitteradeVarningar) ? inp.kvitteradeVarningar : [];
  const saknas = [...new Set(v.filter(x => x.niva === 'allvarlig').map(x => x.regel))]
    .filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) {
    throw new Fel(400, 'Allvarliga varningar måste kvitteras med motivering innan ordinationen sparas.', 'ogiltig', { varningar: v, kraverKvittens: saknas, demoregler: true });
  }
  const kv = kvitterade.filter(k => v.some(x => x.regel === k.regel)).map(k => ({ regel: k.regel, motivering: k.motivering.trim().slice(0, 500) }));
  const r = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, slut,
    ordinerad_av, skapad, nll_status, kvitterade_varningar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?)`)
    .run(atk.patientId, atk.personal.enhet_id, o.lm.id, o.dosering, o.dos, o.dosEnhet, JSON.stringify(o.tider), o.vidBehov ? 1 : 0, o.typ,
      o.ordinationsorsak, o.uppfoljningsdatum, o.start, o.slut, atk.personal.id, iso(), kv.length ? JSON.stringify(kv) : null);
  const id = Number(r.lastInsertRowid);
  historik(db, id, atk.personal.id, 'Ordinerad', o.dosering);
  for (const k of kv) historik(db, id, atk.personal.id, 'Varning kvitterad', `${k.regel}: ${k.motivering}`);
  const nll = overfor(db, id, 'ny');
  return { ordination: ordinationUt(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(id)), varningar: v, nll };
}

export function hamtaRad(db, id) {
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(id));
  if (!o) throw new Fel(404, 'Ordinationen finns inte.', 'saknas');
  return o;
}

// Hur många dagar patienten har haft substansen utan uppehåll: från den tidigaste av de synliga ordinationerna av samma
// substans som följer på varandra med högst ett dygns uppehåll.
export function behandlingsdagar(atk, o) {
  const db = atk.db;
  const atc = lakemedelRad(db, o.lakemedel_id)?.atc;
  const samma = synligaOrdinationer(atk).filter(x => lakemedelRad(db, x.lakemedel_id)?.atc === atc).sort((a, b) => a.start.localeCompare(b.start));
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
  return { varningar: o.status === 'aktiv' && lm ? utsattningsvarningar({ lakemedel: lm, behandlingDagar: behandlingsdagar(atk, o) }) : [], demoregler: true, anmarkning: DEMOREGLER_PROCESS };
}

export function utsatt(atk, o, { orsak, kvitteradeVarningar } = {}) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  if (o.status !== 'aktiv') throw new Fel(400, 'Ordinationen är redan utsatt.', 'ogiltig');
  if (typeof orsak !== 'string' || orsak.trim().length < 3) throw new Fel(400, 'Ange orsak till utsättningen.', 'ogiltig', { falt: ['orsak'] });
  const db = atk.db;
  // En allvarlig varning kvitteras i samma steg: orsaken till utsättningen är motiveringen.
  const v = utsattningskontroll(atk, o).varningar;
  const kv = Array.isArray(kvitteradeVarningar) ? kvitteradeVarningar : [];
  const saknas = [...new Set(v.filter(x => x.niva === 'allvarlig').map(x => x.regel))].filter(r => !kv.some(k => k?.regel === r));
  if (saknas.length) throw new Fel(400, 'Läkemedlet har särskilda observationer vid utsättning. Läs varningen och bekräfta utsättningen.', 'ogiltig', { varningar: v, kraverKvittens: saknas, demoregler: true });
  db.query("UPDATE ordinationer SET status = 'utsatt', utsatt_tid = ?, utsatt_av = ?, utsatt_orsak = ? WHERE id = ?").run(iso(), atk.personal.id, orsak.trim(), o.id);
  historik(db, o.id, atk.personal.id, 'Utsatt', orsak.trim());
  for (const x of v.filter(y => y.niva === 'allvarlig')) historik(db, o.id, atk.personal.id, 'Varning vid utsättning kvitterad', `${x.regel}: ${orsak.trim()}`);
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
