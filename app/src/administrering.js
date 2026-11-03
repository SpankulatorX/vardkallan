// Iordningsställande, administrering och överlämnande av läkemedel (Sussa 3.5.2.17, 3.5.2.18), registrering i efterhand
// (3.5.2.2), administrering under permission (3.5.2.5) och vätskebalans (3.5.3.1, 3.5.2.21).
//
// Systemet är experten. Dagens doser räknas fram ur ordinationerna: tiderna för stående och tillfälliga ordinationer,
// vid behov med senaste dos och vad som återstår av dygnsdosen, ordinationer utan fasta tider och ordinationer som
// väntar på att en planerad vårdhändelse får sin tid. Sjuksköterskan bekräftar det som ges med ett klick. Innan något
// sparas kontrolleras dosen mot ordinationen och tidigare doser (dubbel dos, för tidig dos, dos utan ordination och
// högsta dygnsdos), och varningen förklaras på vanlig svenska. En allvarlig varning måste kvitteras med motivering.
// Under permission föreslår systemet att doserna lämnas över till patienten i stället för att ges.
//
// Behörighet. Att ge, iordningsställa och lämna över kräver yrkesrollen (ge_lakemedel) och vårdrelation till patienten
// på den egna vårdenheten. Nödåtkomst ger bara läsning, och ett aktivt val ger aldrig skrivrätt. Läkemedelslistan är
// gemensam för vårdgivaren, så administreringarna är det också, men spärrade enheters ordinationer och doser som har
// getts på en spärrad enhet visas inte. Varje läsning och ändring loggas på patienten.
import { Fel, iso, idag } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn, visningsPnr } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import { tillaggUt, ADMINISTRATIONSSATT } from './ordinationsmallar.js';
import { lokalTid, datumI, klocka } from './lakemedelsprocess.js';
import { administreringsvarningar, maxPerDygn, minstaIntervallMs, DEMOREGLER_PROCESS, FONSTER_FORE_MIN, FONSTER_EFTER_MIN } from './lakemedelsregler.js';

export const ATGARDER = { ge: 'Given', overlamna: 'Överlämnad till patienten', ej_given: 'Inte given', iordningstall: 'Iordningsställd' };
const STATUS_FOR = { ge: 'given', overlamna: 'overlamnad', ej_given: 'ej_given', iordningstall: 'iordningstalld' };
export const STATUSTEXT = { iordningstalld: 'Iordningsställd', given: 'Given', overlamnad: 'Överlämnad till patienten', ej_given: 'Inte given' };
// Så långt bakåt kan en dos registreras i efterhand. Senare än en kvart efter dosen räknas registreringen som i efterhand.
export const EFTERHAND_DAGAR = 7;
const EFTERHAND_MS = 15 * 60_000;
const DAG = 86400_000;

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const lmKort = (lm) => (lm ? { id: lm.id, npl: lm.npl, namn: lm.namn, substans: lm.substans, styrka: lm.styrka, form: lm.form, atc: lm.atc } : null);

// Ge, iordningsställa, lämna över, vidimera och registrera vätskebalans: yrkesrollen och vårdrelation på den egna
// vårdenheten. Nödåtkomst och aktivt val ger inte den rätten. Nekade försök loggas som nekade.
export function kravVardande(atk, handling, resurs = null, beskrivning = null) {
  const r = atk.krav(handling, { beskrivning });
  const rr = resurs ? atk.krav(handling, { resurs, beskrivning }) : r;
  if (r.grund === 'nodatkomst' || rr.grund === 'nodatkomst' || rr.grund === 'aktivt_val') {
    atk.logga(handling, 'nekad', beskrivning, 'nekad');
    throw new Fel(403, 'Det här kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
  return rr;
}
// Samma prövning utan att något loggas eller kastas, för att gränssnittet ska veta vilka knappar som ska visas.
export function kanVarda(atk, handling) {
  if (!kanRoll(atk.personal, handling)) return { kan: false, varfor: null };
  const r = atk.prova(handling);
  if (!r.tillaten || r.grund === 'nodatkomst') return { kan: false, varfor: 'Du har ingen vårdrelation till patienten på din vårdenhet. Med nödåtkomst går det bara att läsa.' };
  return { kan: true, varfor: null };
}

// Ordinationens dostider ett visst datum, som ISO i UTC. En ordination som gjordes samma dag får inga tider före
// ordinationen, och en utsatt ordination inga tider efter utsättningen. En ordination till en planerad vårdhändelse
// får sin tid när vårdhändelsen är tidsatt.
export function dostider(o, dag, tillagg = {}) {
  if (o.vid_behov) return [];
  if (o.start > dag || (o.slut && o.slut < dag)) return [];
  let tider;
  if (tillagg.vardhandelse) tider = tillagg.vardhandelse.administreras && datumI(Date.parse(tillagg.vardhandelse.administreras)) === dag ? [tillagg.vardhandelse.administreras] : [];
  else tider = (o.tider ? JSON.parse(o.tider) : []).map(klocka).filter(Boolean).map(k => lokalTid(dag, k));
  return tider.filter(t => Date.parse(t) >= Date.parse(o.skapad) - 60_000 && !(o.status === 'utsatt' && Date.parse(t) >= Date.parse(o.utsatt_tid)));
}

// Gällde ordinationen vid tiden? Ger en förklaring när den inte gjorde det.
export function aktivVid(db, o, ms) {
  const lm = katalog(db, o.lakemedel_id);
  const dag = datumI(ms);
  if (ms < Date.parse(o.skapad) - 60_000 && dag <= o.start) return { aktiv: false, varfor: `Ordinationen av ${lm?.namn} gjordes ${tidText(o.skapad)}, efter den tid som dosen gäller.` };
  if (o.status === 'utsatt' && ms >= Date.parse(o.utsatt_tid)) return { aktiv: false, varfor: `Ordinationen av ${lm?.namn} sattes ut ${tidText(o.utsatt_tid)} av ${personNamn(db, o.utsatt_av)}.` };
  if (o.slut && dag > o.slut) return { aktiv: false, varfor: `Ordinationen av ${lm?.namn} slutade gälla ${o.slut}.` };
  if (dag < o.start) return { aktiv: false, varfor: `Ordinationen av ${lm?.namn} börjar gälla ${o.start}.` };
  return { aktiv: true, varfor: null };
}
const tidText = (t) => `${datumI(Date.parse(t))} kl. ${new Date(t).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.')}`;

export function administreringUt(db, a) {
  return {
    id: a.id, patientId: a.patient_id, ordinationId: a.ordination_id, lakemedel: lmKort(katalog(db, a.lakemedel_id)), planerad: a.planerad, status: a.status,
    statusText: STATUSTEXT[a.status], dos: a.dos, dosEnhet: a.dos_enhet, antal: a.antal, tid: a.tid,
    utfordAv: a.utford_av ? { id: a.utford_av, namn: personNamn(db, a.utford_av) } : null,
    registrerad: a.registrerad, registreradAv: { id: a.registrerad_av, namn: personNamn(db, a.registrerad_av) }, efterhand: Boolean(a.efterhand),
    iordningstalld: a.iordningstalld_tid ? { tid: a.iordningstalld_tid, av: personNamn(db, a.iordningstalld_av), kontrollkod: a.kontrollkod } : null,
    orsak: a.orsak, kvitteradeVarningar: a.kvitterade_varningar ? JSON.parse(a.kvitterade_varningar) : [], permission: Boolean(a.permission),
    volymMl: a.volym_ml, enhet: enhetKort(db, a.enhet_id), vardkontaktId: a.vardkontakt_id, kalla: a.kalla,
  };
}

// Patientens administreringar som användaren får se: inte från en spärrad enhet, och inte av en ordination som
// användaren inte får se.
export function synligaAdministreringar(atk, { ordinationer = lakemedel.synligaOrdinationer(atk) } = {}) {
  const ids = new Set(ordinationer.map(o => o.id));
  const rader = atk.db.query('SELECT * FROM administreringar WHERE patient_id = ? ORDER BY coalesce(tid, iordningstalld_tid) DESC, id DESC').all(atk.patientId)
    .filter(a => a.ordination_id == null || ids.has(a.ordination_id));
  return atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
}

// Pågående permission i patientens vårdtillfälle: från permissionen till och med återkomstdagen.
function permissionFor(db, patientId) {
  const vt = db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL AND permission_till IS NOT NULL').get(patientId);
  if (!vt) return null;
  const fran = db.query("SELECT tid FROM vardtillfalle_handelser WHERE vardtillfalle_id = ? AND typ = 'permission' ORDER BY tid DESC, id DESC").get(vt.id)?.tid ?? vt.inskriven;
  return { fran, till: vt.permission_till, slutMs: Date.parse(lokalTid(vt.permission_till, '23:59')) };
}
const underPermission = (p, ms) => Boolean(p && ms >= Date.parse(p.fran) && ms <= p.slutMs);

// Dagens administreringslista för patienten (GET /api/patient/:id/administreringar). Samma svar finns i läskopian.
export function lista(atk, { dag = idag() } = {}) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const nu = Date.now();
  const ordRader = lakemedel.synligaOrdinationer(atk);
  const adm = synligaAdministreringar(atk, { ordinationer: ordRader }).map(a => administreringUt(db, a));
  const perm = permissionFor(db, atk.patientId);
  const doser = [];
  const vidBehov = [];
  const utanTider = [];
  const vantar = [];
  for (const o of ordRader) {
    const t = tillaggUt(db, o.id);
    const u = { ...lakemedel.ordinationUt(db, o, { historik: false }), ...t };
    const bas = { ordinationId: o.id, lakemedel: u.lakemedel, dosering: u.dosering, dos: u.dos, dosEnhet: u.dosEnhet, typ: u.typ, administrationssatt: t.administrationssattText ?? null };
    const egna = adm.filter(a => a.ordinationId === o.id);
    if (o.vid_behov) {
      if (!lakemedel.aktuell(o)) continue;
      const givna = egna.filter(a => a.status === 'given' || a.status === 'overlamnad');
      const senaste = givna[0] ?? null;
      const max = maxPerDygn(o.dosering);
      const dygn = givna.filter(a => nu - Date.parse(a.tid) < DAG);
      const hittills = max?.enhet === 'ganger' ? dygn.length : dygn.reduce((s, a) => s + (a.antal ?? 1), 0);
      const intervall = minstaIntervallMs(u);
      const nasta = senaste ? Date.parse(senaste.tid) + intervall : null;
      let varfor = null;
      if (max && hittills >= max.antal) varfor = `Högsta dygnsdosen är nådd: ${hittills} av ${max.antal} det senaste dygnet.`;
      else if (nasta && nasta > nu) varfor = `Senaste dosen gavs ${tidText(senaste.tid)}. Nästa dos tidigast ${tidText(new Date(nasta).toISOString())}.`;
      vidBehov.push({ ...bas, senaste, senasteDygnet: hittills, max, kanGesNu: !varfor, varfor, nastaTidigast: nasta && nasta > nu ? new Date(nasta).toISOString() : null, givna: givna.slice(0, 5) });
      continue;
    }
    if (t.vardhandelse && !t.vardhandelse.administreras) {
      if (lakemedel.aktuell(o)) vantar.push({ ...bas, vardhandelse: t.vardhandelse });
      continue;
    }
    const tider = dostider(o, dag, t);
    if (!tider.length && !t.vardhandelse) {
      if (lakemedel.aktuell(o) && !(o.tider && JSON.parse(o.tider).length)) utanTider.push({ ...bas, givnaIdag: egna.filter(a => a.tid && datumI(Date.parse(a.tid)) === dag) });
      continue;
    }
    for (const p of tider) {
      const ms = Date.parse(p);
      const rader = egna.filter(a => a.planerad && Date.parse(a.planerad) === ms);
      const slutlig = rader.find(a => a.status !== 'iordningstalld') ?? null;
      const ior = rader.find(a => a.status === 'iordningstalld') ?? null;
      let status;
      if (slutlig) status = slutlig.status;
      else if (ior) status = 'iordningstalld';
      else if (nu < ms - FONSTER_FORE_MIN * 60_000) status = 'kommande';
      else if (nu <= ms + FONSTER_EFTER_MIN * 60_000) status = 'att_ge';
      else status = 'forsenad';
      const perm_ = underPermission(perm, ms);
      doser.push({
        ...bas, nyckel: `${o.id}@${p}`, planerad: p, status, underPermission: perm_,
        forslag: slutlig ? null : perm_ ? 'overlamna' : 'ge', administrering: slutlig ?? ior, antalRegistreringar: rader.filter(a => a.status !== 'iordningstalld').length,
        vardhandelse: t.vardhandelse ?? null,
      });
    }
  }
  doser.sort((a, b) => a.planerad.localeCompare(b.planerad) || a.lakemedel.namn.localeCompare(b.lakemedel.namn, 'sv'));
  const igar = nu - DAG;
  return {
    dag, permission: perm ? { fran: perm.fran, till: perm.till } : null, doser, vidBehov, utanTider, vantarPaHandelse: vantar,
    utanOrdination: adm.filter(a => a.ordinationId == null && Date.parse(a.tid ?? a.registrerad) >= igar),
    senaste: adm.filter(a => Date.parse(a.tid ?? a.iordningstalld?.tid ?? a.registrerad) >= igar).slice(0, 30),
    sammanfattning: { attGe: doser.filter(d => d.status === 'att_ge').length, forsenade: doser.filter(d => d.status === 'forsenad').length, givna: doser.filter(d => ['given', 'overlamnad'].includes(d.status)).length, totalt: doser.length },
    kan: kanVarda(atk, 'ge_lakemedel'), dolda: { sparrade: atk.doldaSparr }, demoregler: true, anmarkning: DEMOREGLER_PROCESS,
  };
}

// Administreringslistan för den egna vårdenheten: inneliggande patienter på dess avdelningar som användaren får se.
// Namn och personnummer är maskerade för skyddad identitet, som i arbetslistan. Varje patient i listan loggas.
export function avdelning(db, personal, valFor, { dag = idag() } = {}) {
  if (!kanRoll(personal, 'las_lakemedel')) throw new Fel(403, 'Din yrkesroll kan inte läsa läkemedel.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const kontakter = db.query(`SELECT * FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL AND enhet_id IN (${ph}) ORDER BY plats, id`).all(...enheter);
  const patienter = [];
  const sedda = new Set();
  for (const v of kontakter) {
    if (sedda.has(v.patient_id)) continue;
    sedda.add(v.patient_id);
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(v.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_lakemedel');
    if (!atk.prova('las_lakemedel').tillaten) continue;
    const l = lista(atk, { dag });
    atk.logga('las_lakemedel', atk.grund(), 'administreringslista');
    patienter.push({ patient: { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) }, plats: v.plats, avdelning: enhetKort(db, v.enhet_id), ...l });
  }
  return {
    dag, vardenhet: enhetKort(db, ve), patienter,
    sammanfattning: { patienter: patienter.length, attGe: patienter.reduce((s, x) => s + x.sammanfattning.attGe, 0), forsenade: patienter.reduce((s, x) => s + x.sammanfattning.forsenade, 0) },
    demoregler: true,
  };
}

const textFalt = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Kontroll och normalisering av en åtgärd. Används av både kontrollen och sparandet, så att samma varningar visas.
function underlag(atk, inp, atgard) {
  const db = atk.db;
  if (!Object.hasOwn(ATGARDER, atgard)) throw new Fel(400, 'Okänd åtgärd. Välj ge, lämna över, inte given eller iordningsställ.', 'ogiltig', { falt: ['atgard'] });
  let orad = null;
  if (inp.ordinationId != null) {
    orad = db.query('SELECT * FROM ordinationer WHERE id = ? AND patient_id = ?').get(Number(inp.ordinationId), atk.patientId);
    if (!orad) throw new Fel(404, 'Ordinationen finns inte.', 'saknas');
  }
  kravVardande(atk, 'ge_lakemedel', orad ? { enhet_id: orad.enhet_id, gemensam: true } : null, orad ? `ordination:${orad.id}` : 'utan_ordination');
  const lm = orad ? katalog(db, orad.lakemedel_id) : (typeof inp.lakemedelId === 'string' ? katalog(db, inp.lakemedelId) : null);
  if (!lm) throw new Fel(400, 'Välj ordinationen, eller läkemedlet om dosen gavs utan ordination.', 'ogiltig', { falt: ['ordinationId'] });
  const tillagg = orad ? tillaggUt(db, orad.id) : {};
  const o = orad ? { ...lakemedel.ordinationUt(db, orad, { historik: false }), ...tillagg } : null;
  const nu = Date.now();
  const falt = [];
  let tid = nu;
  if (inp.tid != null && atgard !== 'iordningstall') {
    tid = typeof inp.tid === 'string' ? Date.parse(inp.tid) : NaN;
    if (!Number.isFinite(tid) || tid > nu + 5 * 60_000 || tid < nu - EFTERHAND_DAGAR * DAG) falt.push('tid');
  }
  let planerad = null;
  if (inp.planerad != null) {
    const ms = typeof inp.planerad === 'string' ? Date.parse(inp.planerad) : NaN;
    const finns = orad && Number.isFinite(ms) && dostider(orad, datumI(ms), tillagg).some(t => Date.parse(t) === ms);
    if (!finns) falt.push('planerad'); else planerad = new Date(ms).toISOString();
  }
  const dos = inp.dos == null || inp.dos === '' ? (o?.dos ?? null) : Number(inp.dos);
  if (dos != null && (!Number.isFinite(dos) || dos <= 0)) falt.push('dos');
  const antal = inp.antal == null ? 1 : Number(inp.antal);
  if (!Number.isFinite(antal) || antal <= 0 || antal > 20) falt.push('antal');
  let utfordAv = atk.personal.id;
  if (inp.utfordAv != null && inp.utfordAv !== atk.personal.id) {
    const p = typeof inp.utfordAv === 'string' ? db.query('SELECT * FROM personal WHERE id = ? AND aktiv = 1').get(inp.utfordAv) : null;
    if (!p || !kanRoll(p, 'ge_lakemedel') || vardenhetFor(db, p.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) falt.push('utfordAv');
    else utfordAv = p.id;
  }
  const orsak = textFalt(inp.orsak);
  if (atgard === 'ej_given' && orsak.length < 3) falt.push('orsak');
  if (falt.length) {
    const namn = { tid: `tidpunkten (högst ${EFTERHAND_DAGAR} dagar bakåt och inte i framtiden)`, planerad: 'dostiden, som inte finns i ordinationen', dos: 'dosen', antal: 'antalet', utfordAv: 'vem som gav dosen (en sjuksköterska på din vårdenhet)', orsak: 'orsaken till att dosen inte gavs' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.`, 'ogiltig', { falt });
  }
  // Ett iordningsställande som dosen går vidare från, via etikettens kontrollkod eller ordinationen och dostiden.
  let ior = null;
  if (inp.kontrollkod != null) {
    ior = db.query("SELECT * FROM administreringar WHERE kontrollkod = ? AND status = 'iordningstalld'").get(String(inp.kontrollkod));
    if (!ior || ior.patient_id !== atk.patientId || ior.ordination_id !== (orad?.id ?? null)) {
      throw new Fel(400, 'Etiketten hör inte till den här patienten och dosen. Kontrollera patienten och läkemedlet innan något ges.', 'ogiltig', { falt: ['kontrollkod'] });
    }
  } else if (orad && planerad) {
    ior = db.query("SELECT * FROM administreringar WHERE ordination_id = ? AND planerad = ? AND status = 'iordningstalld'").get(orad.id, planerad);
  }
  if (atgard === 'iordningstall' && ior) throw new Fel(400, 'Dosen är redan iordningsställd.', 'ogiltig');
  if (!planerad && ior?.planerad) planerad = ior.planerad;
  // Att iordningsställa en dos före dostiden, eller lämna över den till patienten inför en permission, är ingen för
  // tidig dos: varningarna räknas mot dostiden.
  const tidVarning = (atgard === 'iordningstall' || atgard === 'overlamna') && planerad ? Date.parse(planerad) : tid;
  let varningar = [];
  if (atgard !== 'ej_given') {
    // Bara doser som användaren får se räknas in, så att varningen aldrig röjer en spärrad eller dold vårdenhets dos.
    // Finns spärrade uppgifter sägs det som i resten av journalen, utan att röja vad de innehåller.
    const fran = tidVarning - 2 * DAG;
    const atc = new Map(db.query('SELECT id, atc FROM katalog').all().map(k => [k.id, k.atc]));
    const tidigare = synligaAdministreringar(atk)
      .filter(a => atc.get(a.lakemedel_id) === lm.atc && (a.status === 'given' || a.status === 'overlamnad') && a.tid && Date.parse(a.tid) >= fran)
      .map(a => ({ tid: a.tid, planerad: a.planerad, ordinationId: a.ordination_id, antal: a.antal, status: a.status, av: personNamn(db, a.utford_av) }));
    varningar = administreringsvarningar({ ordination: o, aktivVid: orad ? aktivVid(db, orad, tidVarning) : null, lakemedel: lm, planerad, tid: tidVarning, antal, tidigare, nu });
    if (atk.prova('las_lakemedel', {}).spärrade) {
      varningar.push({ niva: 'observation', regel: 'sparrade_uppgifter', text: 'Det finns spärrade uppgifter i journalen. Doser från en spärrad vårdenhet räknas inte in i kontrollen. Fråga patienten om samtycke att visa dem om det kan ha betydelse.' });
    }
  }
  const perm = permissionFor(db, atk.patientId);
  return { orad, o, lm, tid, planerad, dos, antal, utfordAv, orsak, ior, varningar, tillagg, permission: underPermission(perm, planerad ? Date.parse(planerad) : tid) };
}

// POST /api/patient/:id/administreringar/kontroll: varningarna innan något sparas.
export function kontroll(atk, inp = {}) {
  const u = underlag(atk, inp, inp.atgard ?? 'ge');
  return { varningar: u.varningar, permission: u.permission, demoregler: true, anmarkning: DEMOREGLER_PROCESS };
}

// Volymen som räknas in i vätskebalansen: ordinationens volym per dos, annars dosen i mg delad med koncentrationen när
// läkemedlet är en lösning i mg/ml som ges intravenöst eller som injektion.
export function volymFor(lm, tillagg, dos, dosEnhet) {
  if (tillagg.volymMl && tillagg.vatskebalans !== false) return tillagg.volymMl;
  const m = /^([\d,]+)\s*mg\/ml$/.exec(lm.styrka ?? '');
  if (m && dos && dosEnhet === 'mg' && /injektion|infusion/.test(lm.form)) return Math.round(dos / Number(m[1].replace(',', '.')) * 100) / 100;
  return null;
}

// POST /api/patient/:id/administreringar. Svar: { id, administrering, varningar }. Servern knyter dosen till
// vårdkontakten efteråt (vardkontakt.knyt), så att en nekad eller ogiltig åtgärd aldrig skapar en kontakt.
export function spara(atk, inp = {}) {
  const atgard = inp.atgard ?? 'ge';
  const u = underlag(atk, inp, atgard);
  const db = atk.db;
  const kvitterade = Array.isArray(inp.kvitteradeVarningar) ? inp.kvitteradeVarningar : [];
  const saknas = [...new Set(u.varningar.filter(v => v.niva === 'allvarlig').map(v => v.regel))]
    .filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) {
    throw new Fel(400, 'Allvarliga varningar måste kvitteras med motivering innan dosen registreras.', 'ogiltig', { varningar: u.varningar, kraverKvittens: saknas, demoregler: true });
  }
  const kv = kvitterade.filter(k => u.varningar.some(v => v.regel === k.regel)).map(k => ({ regel: k.regel, motivering: k.motivering.trim().slice(0, 500) }));
  const status = STATUS_FOR[atgard];
  const nu = iso();
  const tid = new Date(u.tid).toISOString();
  const efterhand = atgard !== 'iordningstall' && Date.now() - u.tid > EFTERHAND_MS ? 1 : 0;
  const permission = atgard === 'overlamna' && (u.permission || inp.permission === true) ? 1 : 0;
  const volym = status === 'given' ? volymFor(u.lm, u.tillagg, u.dos, u.o?.dosEnhet ?? null) : null;
  let id;
  if (u.ior) {
    db.query(`UPDATE administreringar SET status = ?, tid = ?, utford_av = ?, registrerad = ?, registrerad_av = ?, efterhand = ?, dos = ?, antal = ?, orsak = ?,
      kvitterade_varningar = ?, permission = ?, volym_ml = ? WHERE id = ?`)
      .run(status, tid, u.utfordAv, nu, atk.personal.id, efterhand, u.dos, u.antal, u.orsak || null, kv.length ? JSON.stringify(kv) : null, permission, volym, u.ior.id);
    id = u.ior.id;
  } else {
    const ior = atgard === 'iordningstall';
    const r = db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av,
      registrerad, registrerad_av, efterhand, iordningstalld_tid, iordningstalld_av, orsak, kvitterade_varningar, permission, volym_ml)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(atk.patientId, atk.personal.enhet_id, u.orad?.id ?? null, u.lm.id, u.planerad, status, u.dos, u.o?.dosEnhet ?? null, u.antal,
        ior ? null : tid, ior ? null : u.utfordAv, nu, atk.personal.id, efterhand, ior ? nu : null, ior ? atk.personal.id : null, u.orsak || null,
        kv.length ? JSON.stringify(kv) : null, permission, volym);
    id = Number(r.lastInsertRowid);
    // Etikettens kontrollkod för patientnära kontroll: dosens nummer och patientens journalnummer.
    if (ior) db.query('UPDATE administreringar SET kontrollkod = ? WHERE id = ?').run(`VK-ADM-${String(id).padStart(6, '0')}-${atk.patientId.toUpperCase()}`, id);
  }
  if (volym) {
    db.query("INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av, administrering_id) VALUES (?, ?, 'in', 'lakemedel', ?, ?, ?, ?, ?)")
      .run(atk.patientId, atk.personal.enhet_id, volym, tid, nu, atk.personal.id, id);
  }
  return { id, administrering: administreringUt(db, db.query('SELECT * FROM administreringar WHERE id = ?').get(id)), varningar: u.varningar };
}

// Vätskebalans (3.5.3.1). Intag och förluster per dygn, med valbar dygnsbrytning, och administrerad volym som räknas in
// av sig själv. Läsning följer inre sekretess som mätvärdena.
export const VATSKETYPER = {
  in: { dryck: 'Dryck', mat: 'Mat och sondnäring', infusion: 'Infusion', lakemedel: 'Läkemedel' },
  ut: { urin: 'Urin', dran: 'Dränage', krakning: 'Kräkning', avforing: 'Avföring' },
};
export function vatskebalans(atk, { dag = idag(), brytning = '00' } = {}) {
  atk.krav('las_matvarden');
  const db = atk.db;
  const k = klocka(brytning) ?? '00:00';
  const fran = Date.parse(lokalTid(dag, k));
  const till = fran + DAG;
  const rader = atk.filtrera(db.query('SELECT * FROM vatskebalans WHERE patient_id = ? ORDER BY tid, id').all(atk.patientId), 'las_matvarden')
    .filter(r => Date.parse(r.tid) >= fran && Date.parse(r.tid) < till);
  const poster = rader.map(r => ({
    id: r.id, riktning: r.riktning, typ: r.typ, typText: VATSKETYPER[r.riktning][r.typ] ?? r.typ, volymMl: r.volym_ml, tid: r.tid,
    registreradAv: personNamn(db, r.registrerad_av), administreringId: r.administrering_id, automatisk: r.administrering_id != null, enhet: enhetKort(db, r.enhet_id),
  }));
  const summa = (x) => Math.round(poster.filter(p => p.riktning === x).reduce((s, p) => s + p.volymMl, 0) * 10) / 10;
  return { dag, brytning: k, fran: new Date(fran).toISOString(), till: new Date(till).toISOString(), poster, summaIn: summa('in'), summaUt: summa('ut'), balans: Math.round((summa('in') - summa('ut')) * 10) / 10, typer: VATSKETYPER };
}
export function registreraVatska(atk, inp = {}) {
  kravVardande(atk, 'registrera_matvarde', null, 'vatskebalans');
  const db = atk.db;
  const falt = [];
  const riktning = inp.riktning === 'ut' ? 'ut' : inp.riktning === 'in' ? 'in' : null;
  if (!riktning) falt.push('riktning');
  const typ = riktning && Object.hasOwn(VATSKETYPER[riktning], inp.typ) && inp.typ !== 'lakemedel' ? inp.typ : null;
  if (!typ) falt.push('typ');
  const volym = Number(inp.volymMl);
  if (!Number.isFinite(volym) || volym <= 0 || volym > 5000) falt.push('volymMl');
  const tid = inp.tid == null ? Date.now() : Date.parse(inp.tid);
  if (!Number.isFinite(tid) || tid > Date.now() + 5 * 60_000 || tid < Date.now() - EFTERHAND_DAGAR * DAG) falt.push('tid');
  if (falt.length) throw new Fel(400, 'Kontrollera in eller ut, typ, volym (1 till 5 000 ml) och tid.', 'ogiltig', { falt });
  const r = db.query('INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, riktning, typ, volym, new Date(tid).toISOString(), iso(), atk.personal.id);
  return { id: Number(r.lastInsertRowid), riktning, typ, volymMl: volym, tid: new Date(tid).toISOString() };
}

export { ADMINISTRATIONSSATT };
