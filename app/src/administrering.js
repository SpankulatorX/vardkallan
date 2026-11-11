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
import { Fel, iso, idag, addDagar } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn, visningsPnr } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import { tillaggUt, ADMINISTRATIONSSATT } from './ordinationsmallar.js';
import { lokalTid, datumI, klocka } from './lakemedelsprocess.js';
import { administreringsvarningar, maxPerDygn, minstaIntervallMs, DEMOREGLER_PROCESS, FONSTER_FORE_MIN, FONSTER_EFTER_MIN } from './lakemedelsregler.js';
// Runda 7, r4: parametrar som systemförvaltningen kan ändra.
import * as konfiguration from './konfiguration.js';
// Delegering för undersköterskan (runda 5, HSLF-FS 2017:37 9 kap.).
import * as delegering from './delegering.js';
// Läkemedelsprocessen, del 2 (runda 6, r2): trappschema, muntlig ordination, generellt direktiv, läkemedelstyper,
// spädning och makulering.
import * as stod from './lakemedelsstod.js';
// Runda 9, r1: beredning med kontroll och etikett, patientnära skanning och doser i flytande form och gasform.
import * as beredning from './beredning.js';
// Runda 10, r5: kollegakontroll av högriskläkemedel.
import * as hogrisk from './hogriskkontroll.js';
import * as kunskapsstod from './kunskapsstod.js';
import * as egenadm from './egenadministrering.js';

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
  // Undersköterskan ger läkemedel bara med en giltig delegering på vårdenheten (runda 5).
  if (handling === 'ge_lakemedel' && atk.personal.yrke === 'underskoterska') {
    const g = delegering.giltigNu(atk.db, atk.personal);
    if (!g.giltig) return { kan: false, varfor: g.varfor };
  }
  return { kan: true, varfor: null };
}

// Delegeringen för en dos i listan, bara för undersköterskan: om dosen omfattas och annars varför inte.
function delegeringFor(atk, o, lm, tillagg, ms) {
  if (atk.personal.yrke !== 'underskoterska') return undefined;
  const r = delegering.prova(atk.db, atk.personal, { lm, satt: tillagg.administrationssatt ?? null, ms, ordination: o });
  return { omfattas: r.omfattas, varfor: r.varfor };
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
    // Delegeringen som en undersköterska gav dosen med (runda 5).
    delegering: delegering.delegeringKort(db, a.delegering_id),
    // Runda 6, r2: en makulerad registrering finns kvar och visas överstruken med orsak.
    makulerad: stod.makuleringFor(db, 'administrering', a.id),
    // Runda 9, r1: beredningen och skanningen finns bara för en dos som har iordningsställts med etikett.
    ...(a.kontrollkod ? { beredning: beredning.forAdministrering(db, a.id), skannad: beredning.skanningFor(db, a.id), kollegakontroll: hogrisk.forAdministrering(db, a.id) } : {}),
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
  // Runda 7, r4: dosfönstret kan ändras av systemförvaltningen (konfiguration.js).
  const fonster = { fore: konfiguration.varde(db, 'lakemedel.dosfonster_fore_min', new Date(nu)), efter: konfiguration.varde(db, 'lakemedel.dosfonster_efter_min', new Date(nu)) };
  const ordRader = lakemedel.synligaOrdinationer(atk);
  const allaAdm = synligaAdministreringar(atk, { ordinationer: ordRader }).map(a => administreringUt(db, a));
  // Runda 6, r2: en makulerad registrering räknas inte. Dosen blir att ge igen, och den syns bland de senaste.
  const adm = allaAdm.filter(a => !a.makulerad);
  const perm = permissionFor(db, atk.patientId);
  const doser = [];
  const vidBehov = [];
  const utanTider = [];
  const vantar = [];
  // Runda 5, r1: doser inför en vårdhändelse som har fått en tid en senare dag, så att sjuksköterskan ser när läkemedlet
  // ska ges redan nu (vardhandelse.js).
  const kommandeHandelser = [];
  // Runda 9, r1: ordinationer som patienten sköter själv.
  const egenLista = [];
  for (const o of ordRader) {
    // Vårdhändelsen ur tidboken med namn och tid bara för den ordinerande vårdenheten eller efter aktivt val (runda 5).
    const t = tillaggUt(db, o.id, { full: atk.prova('las_lakemedel', { enhet_id: o.enhet_id }).tillaten });
    const u = { ...lakemedel.ordinationUt(db, o, { historik: false }), ...t };
    const bas = { ordinationId: o.id, lakemedel: u.lakemedel, dosering: u.dosering, dos: u.dos, dosEnhet: u.dosEnhet, typ: u.typ, administrationssatt: t.administrationssattText ?? null,
      // Runda 6, r2: dagens dos i trappschemat, spädningen att iordningsställa, och muntlig ordination och direktiv.
      ...dagensTillagg(db, o, u, dag) };
    const lmRad = katalog(db, o.lakemedel_id);
    const deleg = (ms) => delegeringFor(atk, o, lmRad, t, ms);
    const egna = adm.filter(a => a.ordinationId === o.id);
    // Runda 9, r1: en ordination som patienten sköter själv kommer inte med bland doserna att ge. Sjuksköterskan
    // kvitterar patientens intag per dostid under Patienten tar själv.
    if (u.egenadministrering) {
      if (lakemedel.aktuell(o)) egenLista.push(egenRad(db, o, t, bas, dag, nu, fonster));
      continue;
    }
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
      vidBehov.push({ ...bas, senaste, senasteDygnet: hittills, max, kanGesNu: !varfor, varfor, nastaTidigast: nasta && nasta > nu ? new Date(nasta).toISOString() : null, givna: givna.slice(0, 5), delegering: deleg(nu) });
      continue;
    }
    if (t.vardhandelse && !t.vardhandelse.administreras) {
      if (lakemedel.aktuell(o)) vantar.push({ ...bas, vardhandelse: t.vardhandelse });
      continue;
    }
    if (t.vardhandelse && datumI(Date.parse(t.vardhandelse.administreras)) > dag) {
      if (lakemedel.aktuell(o)) kommandeHandelser.push({ ...bas, administreras: t.vardhandelse.administreras, vardhandelse: t.vardhandelse });
      continue;
    }
    const tider = dostider(o, dag, t);
    if (!tider.length && !t.vardhandelse) {
      if (lakemedel.aktuell(o) && !(o.tider && JSON.parse(o.tider).length)) utanTider.push({ ...bas, givnaIdag: egna.filter(a => a.tid && datumI(Date.parse(a.tid)) === dag), delegering: deleg(nu) });
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
      else if (nu < ms - fonster.fore * 60_000) status = 'kommande';
      else if (nu <= ms + fonster.efter * 60_000) status = 'att_ge';
      else status = 'forsenad';
      const perm_ = underPermission(perm, ms);
      doser.push({
        ...bas, nyckel: `${o.id}@${p}`, planerad: p, status, underPermission: perm_,
        forslag: slutlig ? null : perm_ ? 'overlamna' : 'ge', administrering: slutlig ?? ior, antalRegistreringar: rader.filter(a => a.status !== 'iordningstalld').length,
        vardhandelse: t.vardhandelse ?? null, delegering: deleg(ms),
      });
    }
  }
  doser.sort((a, b) => a.planerad.localeCompare(b.planerad) || a.lakemedel.namn.localeCompare(b.lakemedel.namn, 'sv'));
  const igar = nu - DAG;
  return {
    dag, permission: perm ? { fran: perm.fran, till: perm.till } : null, doser, vidBehov, utanTider, vantarPaHandelse: vantar,
    kommandeHandelser: kommandeHandelser.sort((a, b) => a.administreras.localeCompare(b.administreras)),
    egenadministrering: egenLista,
    utanOrdination: adm.filter(a => a.ordinationId == null && Date.parse(a.tid ?? a.registrerad) >= igar),
    senaste: allaAdm.filter(a => Date.parse(a.tid ?? a.iordningstalld?.tid ?? a.registrerad) >= igar).slice(0, 30),
    sammanfattning: { attGe: doser.filter(d => d.status === 'att_ge').length, forsenade: doser.filter(d => d.status === 'forsenad').length, givna: doser.filter(d => ['given', 'overlamnad'].includes(d.status)).length, totalt: doser.length },
    kan: kanVarda(atk, 'ge_lakemedel'), dolda: { sparrade: atk.doldaSparr }, demoregler: true, anmarkning: DEMOREGLER_PROCESS,
  };
}

// Runda 9, r1: en ordination som patienten sköter själv, med dagens dostider och om intaget är kvitterat. En dostid
// som har passerat utan kvittens markeras, så att sjuksköterskan frågar patienten.
function egenRad(db, o, t, bas, dag, nu, fonster) {
  const intag = egenadm.intagFor(db, o.id);
  const doser = (o.vid_behov ? [] : dostider(o, dag, t)).map(p => {
    const ms = Date.parse(p);
    const k = intag.find(i => i.planerad && Date.parse(i.planerad) === ms) ?? null;
    const status = k ? (k.tagen ? 'tagen' : 'inte_tagen') : nu > ms + fonster.efter * 60_000 ? 'ej_kvitterad' : nu < ms - fonster.fore * 60_000 ? 'kommande' : 'att_kvittera';
    return { planerad: p, status, kvittens: k };
  });
  return { ...bas, vidBehov: Boolean(o.vid_behov), egenadministrering: egenadm.egenFor(db, o.id), doser, senaste: intag.slice(0, 5) };
}

// Runda 6, r2: det som dosen i listan behöver ur ordinationens tillägg. Dosen och doseringen följer trappschemat den
// dagen, spädningen visas vid iordningsställandet, och en muntlig ordination eller ett direktiv visas med sitt läge.
function dagensTillagg(db, o, u, dag) {
  const ut = {};
  const steg = stod.trappsteg(db, o.id, dag);
  if (steg) Object.assign(ut, { dos: steg.dos, dosering: steg.dosering, trappning: steg });
  if (u.spadning) ut.spadning = u.spadning;
  if (u.produkttyp && u.produkttyp.typ !== 'godkand') ut.produkttyp = u.produkttyp;
  if (u.muntlig) ut.muntlig = { lakare: u.muntlig.lakare.namn, signerad: Boolean(u.muntlig.signerad), gesUtanSigneringTill: u.muntlig.gesUtanSigneringTill };
  if (u.direktiv) ut.direktiv = { indikation: u.direktiv.indikation, maxTillfallen: u.direktiv.maxTillfallen };
  // Runda 9, r1: om dosen ska beredas och kontrolleras av en annan person, och dosen i ml eller liter per minut.
  const lm = katalog(db, o.lakemedel_id);
  const ber = beredning.beredningsinfo(lm, u.spadning);
  if (ber) ut.beredning = ber;
  // Runda 10, r5: ett högriskläkemedel som en kollega kontrollerar. I en beredning är kontrollen beredningens.
  const kat = hogrisk.kategorierFor(db, { lm, o: u, patientId: o.patient_id });
  if (kat.length) {
    if (ber) Object.assign(ber, { dubbelkontroll: true, varfor: ber.dubbelkontroll ? ber.varfor : hogrisk.varforText(kat) });
    else ut.kollegakontroll = { kravs: true, kategorier: kat.map(k => ({ id: k.id, rubrik: k.rubrik })), varfor: hogrisk.varforText(kat) };
  }
  Object.assign(ut, beredning.dosform(db, o, lm));
  return ut;
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
    // Undersköterskans delegering (runda 5).
    ...(personal.yrke === 'underskoterska' ? { delegering: delegering.sammanfattning(db, personal) } : {}),
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
  // Runda 6, r2: också ett iordningsställande kan registreras i efterhand, med tiden då det gjordes.
  if (inp.tid != null) {
    tid = typeof inp.tid === 'string' ? Date.parse(inp.tid) : NaN;
    if (!Number.isFinite(tid) || tid > nu + 5 * 60_000 || tid < nu - EFTERHAND_DAGAR * DAG) falt.push('tid');
  }
  // Runda 6, r2 (säkerhetsgranskning): en angiven tid får aldrig ligga före ordinationen för ett iordningsställande, en
  // muntlig ordination eller en ordination enligt generellt direktiv. För andra doser varnar systemet som förut för en
  // dos utan ordination, eftersom en dos kan ha getts efter en muntlig ordination som läkaren ordinerade i efterhand.
  if (orad && inp.tid != null && Number.isFinite(tid) && tid < Date.parse(orad.skapad) - 60_000 && (atgard === 'iordningstall' || stod.muntligFor(db, orad.id) || stod.direktivFor(db, orad.id))) {
    throw new Fel(400, `Tiden ligger före ordinationen, som gjordes ${tidText(orad.skapad)}. Ange när det faktiskt gjordes.`, 'ogiltig', { falt: ['tid'] });
  }
  let planerad = null;
  if (inp.planerad != null) {
    const ms = typeof inp.planerad === 'string' ? Date.parse(inp.planerad) : NaN;
    const finns = orad && Number.isFinite(ms) && dostider(orad, datumI(ms), tillagg).some(t => Date.parse(t) === ms);
    if (!finns) falt.push('planerad'); else planerad = new Date(ms).toISOString();
  }
  // Runda 6, r2: utan angiven dos är det dagens dos i ett trappschema, annars ordinationens.
  const stegDos = orad ? stod.trappsteg(db, orad.id, datumI(inp.planerad ? Date.parse(inp.planerad) : (inp.tid ? Date.parse(inp.tid) : nu)))?.dos : null;
  const dos = inp.dos == null || inp.dos === '' ? (stegDos ?? o?.dos ?? null) : Number(inp.dos);
  if (dos != null && (!Number.isFinite(dos) || dos <= 0)) falt.push('dos');
  const antal = inp.antal == null ? 1 : Number(inp.antal);
  if (!Number.isFinite(antal) || antal <= 0 || antal > 20) falt.push('antal');
  let utfordAv = atk.personal.id;
  let utfordRad = atk.personal;
  if (inp.utfordAv != null && inp.utfordAv !== atk.personal.id) {
    const p = typeof inp.utfordAv === 'string' ? db.query('SELECT * FROM personal WHERE id = ? AND aktiv = 1').get(inp.utfordAv) : null;
    // En undersköterska registrerar bara sina egna doser.
    if (!p || !kanRoll(p, 'ge_lakemedel') || vardenhetFor(db, p.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id) || atk.personal.yrke === 'underskoterska') falt.push('utfordAv');
    else { utfordAv = p.id; utfordRad = p; }
  }
  const orsak = textFalt(inp.orsak);
  if (atgard === 'ej_given' && orsak.length < 3) falt.push('orsak');
  if (falt.length) {
    const namn = { tid: `tidpunkten (högst ${EFTERHAND_DAGAR} dagar bakåt och inte i framtiden)`, planerad: 'dostiden, som inte finns i ordinationen', dos: 'dosen', antal: 'antalet', utfordAv: 'vem som gav dosen (någon på din vårdenhet som får ge läkemedel)', orsak: 'orsaken till att dosen inte gavs' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.`, 'ogiltig', { falt });
  }
  // Delegeringen (runda 5): en undersköterska som ger, iordningsställer eller lämnar över dosen ska ha en delegering som
  // gäller just den dosen, den dagen och på vårdenheten. Prövas innan något sparas, och ett nekat försök loggas.
  // Vid iordningsställande ska delegeringen gälla både nu, när åtgärden görs, och för dostiden (säkerhetsgranskningen
  // av runda 5). Annars prövas den för tiden då dosen gavs.
  // Runda 6, r2 (säkerhetsgranskning): delegeringen ska också gälla när registreringen faktiskt görs, inte bara den tid
  // som anges, så att en bakdaterad registrering inte kringgår en delegering som har gått ut.
  const delegTider = [...new Set([tid, nu, ...(planerad && atgard === 'iordningstall' ? [Date.parse(planerad)] : [])])];
  const prova = (p, du) => delegTider.map(ms => delegering.prova(db, p, { lm, satt: tillagg.administrationssatt ?? null, ms, ordination: orad, du }))
    .reduce((forsta, r) => (forsta.omfattas ? r.omfattas ? forsta : r : forsta));
  const egen = prova(atk.personal, true);
  if (!egen.omfattas) {
    atk.logga('ge_lakemedel', 'nekad', orad ? `ordination:${orad.id}` : 'utan_ordination', 'nekad');
    throw new Fel(403, egen.varfor, 'nekad', { delegering: true });
  }
  let delegeringId = egen.delegering?.id ?? null;
  if (utfordRad.id !== atk.personal.id) {
    const annan = prova(utfordRad, false);
    if (!annan.omfattas) throw new Fel(400, annan.varfor, 'ogiltig', { falt: ['utfordAv'] });
    delegeringId = annan.delegering?.id ?? null;
  }
  // Ett iordningsställande som dosen går vidare från, via etikettens kontrollkod eller ordinationen och dostiden. Bara
  // iordningsställanden som användaren får se räknas, så att en spärrad vårdenhets dos aldrig röjs eller används.
  let ior = null;
  const makIor = stod.makulerade(db, 'administrering', atk.patientId);
  const synligaIor = () => synligaAdministreringar(atk).filter(a => a.status === 'iordningstalld' && !makIor.has(a.id));
  if (inp.kontrollkod != null) {
    ior = synligaIor().find(a => a.kontrollkod === String(inp.kontrollkod)) ?? null;
    if (!ior || ior.patient_id !== atk.patientId || ior.ordination_id !== (orad?.id ?? null)) {
      throw new Fel(400, 'Etiketten hör inte till den här patienten och dosen. Kontrollera patienten och läkemedlet innan något ges.', 'ogiltig', { falt: ['kontrollkod'] });
    }
  } else if (orad && planerad) {
    ior = synligaIor().find(a => a.ordination_id === orad.id && a.planerad === planerad) ?? null;
  }
  if (atgard === 'iordningstall' && ior) throw new Fel(400, 'Dosen är redan iordningsställd.', 'ogiltig');
  if (!planerad && ior?.planerad) planerad = ior.planerad;
  // Runda 11, r4: en blodprodukt ges bara från blodbeställningen, där id-band, enhetsnummer, blodgrupp och bastest prövas
  // i den gemensamma transfusionskontrollen och en andra person kontrollerar i sin egen inloggning (blod.js). Ingen
  // vanlig administrering med en kvitterad varning kan ersätta den kontrollen.
  if (atgard !== 'ej_given' && stod.produkttyp(db, lm.id).typ === 'blodprodukt') {
    throw new Fel(409, `${lm.namn} ges från blodbeställningen i fliken Blod. Där kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och bastestet, och en andra person kontrollerar i sin egen inloggning.`, 'blod');
  }
  // Runda 9, r1: en dos som ska beredas registreras med beredningen när den iordningsställs, och ges bara när
  // kontrollen är gjord och beredningen håller. Ett skannat armband prövas mot patienten.
  const ber = atgard === 'iordningstall' ? beredning.forbered(db, { lm, spadning: o?.spadning ?? null, nu }, inp.beredning) : null;
  if (atgard === 'ge' || atgard === 'overlamna') beredning.provaGe(db, { lm, spadning: o?.spadning ?? null, ior, efterhand: inp.tid != null && nu - tid > EFTERHAND_MS, nu });
  // Runda 10, r5: kollegakontroll av högriskläkemedel (hogriskkontroll.js). En beredning får kontrollen i beredningen.
  const kollega = hogrisk.provaAdministrering(db, { atgard, lm, o, ior, beredning: ber, efterhand: inp.tid != null && nu - tid > EFTERHAND_MS, patientId: atk.patientId, nu });
  const armband = atgard === 'ge' ? beredning.provaArmband(atk, inp.armband, ior?.kontrollkod ?? null) : null;
  // Runda 6, r2: en muntlig ordination som inte är signerad och ett generellt direktiv vars tillfällen är använda
  // stoppas med en förklaring. I ett trappschema är dosen den dagens dos.
  // Prövas både mot dosens tid och mot när registreringen görs (säkerhetsgranskning), så att en bakdaterad tid inte
  // kringgår fönstret för en muntlig ordination som inte är signerad.
  if (atgard !== 'ej_given') stod.provaDos(db, orad, [planerad ? Date.parse(planerad) : tid, tid, nu], { makuleradeIds: makIor });
  if (o && orad) {
    const steg = stod.trappsteg(db, orad.id, datumI(planerad ? Date.parse(planerad) : tid));
    if (steg?.dos != null) { o.dos = steg.dos; o.dosering = steg.dosering; }
  }
  // Att iordningsställa en dos före dostiden, eller lämna över den till patienten inför en permission, är ingen för
  // tidig dos: varningarna räknas mot dostiden.
  const tidVarning = (atgard === 'iordningstall' || atgard === 'overlamna') && planerad ? Date.parse(planerad) : tid;
  let varningar = [];
  if (atgard !== 'ej_given') {
    // Bara doser som användaren får se räknas in, så att varningen aldrig röjer en spärrad eller dold vårdenhets dos.
    // Finns spärrade uppgifter sägs det som i resten av journalen, utan att röja vad de innehåller.
    const fran = tidVarning - 2 * DAG;
    const atc = new Map(db.query('SELECT id, atc FROM katalog').all().map(k => [k.id, k.atc]));
    const mak = stod.makulerade(db, 'administrering', atk.patientId);
    const tidigare = synligaAdministreringar(atk)
      .filter(a => !mak.has(a.id))
      .filter(a => atc.get(a.lakemedel_id) === lm.atc && (a.status === 'given' || a.status === 'overlamnad') && a.tid && Date.parse(a.tid) >= fran)
      .map(a => ({ tid: a.tid, planerad: a.planerad, ordinationId: a.ordination_id, antal: a.antal, status: a.status, av: personNamn(db, a.utford_av) }));
    varningar = administreringsvarningar({ ordination: o, aktivVid: orad ? aktivVid(db, orad, tidVarning) : null, lakemedel: lm, planerad, tid: tidVarning, antal, tidigare, nu,
      // Runda 7, r4: dosfönstret kan ändras av systemförvaltningen (konfiguration.js).
      fonsterForeMin: konfiguration.varde(db, 'lakemedel.dosfonster_fore_min', new Date(nu)),
      // Den givna mängden är dosen gånger antalet (säkerhetsgranskningen av runda 5), så att antal inte kringgår
      // varningen för en dos som avviker från ordinationen. Utan angiven dos räknas ordinationens dos per enhet.
      dos: (inp.dos == null || inp.dos === '') && antal === 1 ? null : dos != null ? dos * antal : null });
    // Runda 6, r2: licensens giltighet och kontrollen vid sängen för blodprodukter.
    varningar.push(...stod.administreringsvarningar(db, { lm, patientId: atk.patientId, enhetId: atk.personal.enhet_id, ms: tidVarning, nu }));
    // Runda 9, r1: uppmätt volym för en dos i flytande form, och flöde och saturation för syrgas.
    varningar.push(...beredning.dosvarningar(atk, { orad, lm, dos: inp.dos == null || inp.dos === '' ? null : dos, volymMl: inp.volymMl ?? null }));
    if (atk.prova('las_lakemedel', {}).spärrade) {
      varningar.push({ niva: 'observation', regel: 'sparrade_uppgifter', text: 'Det finns spärrade uppgifter i journalen. Doser från en spärrad vårdenhet räknas inte in i kontrollen. Fråga patienten om samtycke att visa dem om det kan ha betydelse.' });
    }
  }
  // Runda 10, r5: varför systemet varnar och vad användaren kan göra (kunskapsstod.js).
  varningar = kunskapsstod.berika(varningar);
  const perm = permissionFor(db, atk.patientId);
  return { orad, o, lm, tid, planerad, dos, antal, utfordAv, orsak, ior, varningar, tillagg, permission: underPermission(perm, planerad ? Date.parse(planerad) : tid), delegeringId,
    // Runda 9, r1.
    beredning: ber, armband,
    // Runda 10, r5.
    kollega };
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
  // Allvarliga varningar, och en dos som avviker från ordinationen (kraverKvittens), kvitteras med motivering.
  const saknas = [...new Set(u.varningar.filter(v => v.niva === 'allvarlig' || v.kraverKvittens).map(v => v.regel))]
    .filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) {
    throw new Fel(400, 'Varningarna måste kvitteras med motivering innan dosen registreras.', 'ogiltig', { varningar: u.varningar, kraverKvittens: saknas, demoregler: true });
  }
  const kv = kvitterade.filter(k => u.varningar.some(v => v.regel === k.regel)).map(k => ({ regel: k.regel, motivering: k.motivering.trim().slice(0, 500) }));
  const status = STATUS_FOR[atgard];
  const nu = iso();
  const tid = new Date(u.tid).toISOString();
  const efterhand = Date.now() - u.tid > EFTERHAND_MS ? 1 : 0;
  // Permission räknas av servern ur vårdtillfället, aldrig ur det klienten skickar.
  const permission = atgard === 'overlamna' && u.permission ? 1 : 0;
  const volym = status === 'given' ? volymFor(u.lm, u.tillagg, u.dos, u.o?.dosEnhet ?? null) : null;
  let id;
  if (u.ior) {
    // Dosen dokumenteras på den vårdenhet som ger den. Byter den vårdenhet knyts den till en ny vårdkontakt efteråt.
    const nyEnhet = u.ior.enhet_id !== atk.personal.enhet_id;
    db.query(`UPDATE administreringar SET status = ?, tid = ?, utford_av = ?, registrerad = ?, registrerad_av = ?, efterhand = ?, dos = ?, antal = ?, orsak = ?,
      kvitterade_varningar = ?, permission = ?, volym_ml = ?, enhet_id = ?, vardkontakt_id = CASE WHEN ? THEN NULL ELSE vardkontakt_id END, delegering_id = ? WHERE id = ?`)
      .run(status, tid, u.utfordAv, nu, atk.personal.id, efterhand, u.dos, u.antal, u.orsak || null, kv.length ? JSON.stringify(kv) : null, permission, volym,
        atk.personal.enhet_id, nyEnhet ? 1 : 0, u.delegeringId, u.ior.id);
    id = u.ior.id;
    // Runda 9, r1: etiketten och armbandet som skannades vid sängen.
    beredning.sparaSkanning(db, atk.personal, atk.patientId, id, u.ior.kontrollkod, u.armband);
  } else {
    const ior = atgard === 'iordningstall';
    const r = db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av,
      registrerad, registrerad_av, efterhand, iordningstalld_tid, iordningstalld_av, orsak, kvitterade_varningar, permission, volym_ml, delegering_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(atk.patientId, atk.personal.enhet_id, u.orad?.id ?? null, u.lm.id, u.planerad, status, u.dos, u.o?.dosEnhet ?? null, u.antal,
        ior ? null : tid, ior ? null : u.utfordAv, nu, atk.personal.id, efterhand, ior ? tid : null, ior ? atk.personal.id : null, u.orsak || null,
        kv.length ? JSON.stringify(kv) : null, permission, volym, u.delegeringId);
    id = Number(r.lastInsertRowid);
    // Etikettens kontrollkod för patientnära kontroll: dosens nummer och patientens journalnummer.
    if (ior) db.query('UPDATE administreringar SET kontrollkod = ? WHERE id = ?').run(`VK-ADM-${String(id).padStart(6, '0')}-${atk.patientId.toUpperCase()}`, id);
    // Runda 9, r1: beredningen sparas med iordningsställandet.
    if (ior) beredning.spara(db, atk.personal, atk.patientId, id, u.orad?.id ?? null, u.beredning, tid);
    // Runda 10, r5: kollegakontrollen för ett högriskläkemedel som inte bereds.
    if (ior) hogrisk.spara(db, atk.personal, atk.patientId, id, u.kollega, tid);
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
  // Runda 11, r1: till samma klockslag nästa dag, så att dygnet har 23 eller 25 timmar när sommartiden börjar eller slutar.
  const till = Date.parse(lokalTid(addDagar(dag, 1), k));
  // Volymen från en dos syns bara för den som får se dosen, så att en spärrad ordination inte röjs via vätskebalansen.
  const synligaDoser = new Set(synligaAdministreringar(atk).map(a => a.id));
  const rader = atk.filtrera(db.query('SELECT * FROM vatskebalans WHERE patient_id = ? ORDER BY tid, id').all(atk.patientId), 'las_matvarden')
    .filter(r => r.administrering_id == null || synligaDoser.has(r.administrering_id))
    .filter(r => Date.parse(r.tid) >= fran && Date.parse(r.tid) < till);
  // Runda 6, r2: en makulerad post, eller volymen från en makulerad dos, visas överstruken och räknas inte.
  const makDos = stod.makulerade(db, 'administrering', atk.patientId);
  const poster = rader.map(r => ({
    id: r.id, riktning: r.riktning, typ: r.typ, typText: VATSKETYPER[r.riktning][r.typ] ?? r.typ, volymMl: r.volym_ml, tid: r.tid,
    registreradAv: personNamn(db, r.registrerad_av), administreringId: r.administrering_id, automatisk: r.administrering_id != null, enhet: enhetKort(db, r.enhet_id),
    makulerad: stod.makuleringFor(db, 'vatskebalans', r.id) ?? (r.administrering_id != null && makDos.has(r.administrering_id) ? stod.makuleringFor(db, 'administrering', r.administrering_id) : null),
  }));
  const summa = (x) => Math.round(poster.filter(p => p.riktning === x && !p.makulerad).reduce((s, p) => s + p.volymMl, 0) * 10) / 10;
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
  // Runda 6, r2: kalorier för ett intag av mat eller dryck (Sussa 3.5.3.2).
  const kcal = inp.kcal == null || inp.kcal === '' ? null : Number(inp.kcal);
  if (kcal != null && (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000 || riktning !== 'in')) throw new Fel(400, 'Kalorier anges för ett intag, från 0 till 5 000 kcal.', 'ogiltig', { falt: ['kcal'] });
  const r = db.query('INSERT INTO vatskebalans (patient_id, enhet_id, riktning, typ, volym_ml, tid, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, riktning, typ, volym, new Date(tid).toISOString(), iso(), atk.personal.id);
  if (kcal != null) db.query('INSERT INTO vatskebalans_kcal (vatskebalans_id, kcal) VALUES (?, ?)').run(Number(r.lastInsertRowid), kcal);
  return { id: Number(r.lastInsertRowid), riktning, typ, volymMl: volym, tid: new Date(tid).toISOString(), ...(kcal != null ? { kcal } : {}) };
}

export { ADMINISTRATIONSSATT };
