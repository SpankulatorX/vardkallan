// Min journal: invånarens egen e-tjänst i Vårdkällan. Invånaren loggar in med simulerad e-legitimation och läser sin
// egen journal, eller journalen för ett barn under 13 år som invånaren är vårdnadshavare för, och ser vem som har läst
// den. Behörigheten prövas med provaInvanare (atkomst.js) i varje anrop. Varje läsning loggas som invånarens egen
// åtkomst i samma åtkomstlogg som personalens, men flaggas inte i logguppföljningen.
//
// Vad som visas är vårdgivarens val (patientdatalagen 5 kap. 5 §):
//   anteckningar   bara signerade, och enligt visningsreglerna per vårdenhet och anteckningstyp (seed/invanare.js)
//   provsvar       labbvärden när de är vidimerade, dock senast 14 dagar efter provtagningen
//   mätvärden      vitalparametrar direkt
//   övrigt         diagnoser, läkemedel, överkänslighet, remisser och vårdkontakter direkt
// Det som inte visas redovisas för invånaren (HSLF-FS 2016:40 4 kap. 12 §).
//
// Svaren innehåller inga id, HSA-id eller interna anteckningar för personalen, inga larm och inga NLL-meddelanden.
// Namnet på den som skrev en anteckning finns med, eftersom det är en del av journalen. Logglistan har vårdenhet,
// yrkesroll, tid och typ av åtkomst men inte namnet på den som läste (se docs/design.md, Min journal).
import { Fel, iso, datumAv } from './db.js';
import { provaInvanare, vardenhetFor, alder, formateraPnr, maskeraPnr, SKYDDAD_NAMN, EGEN_FRAN_ALDER, HANDLINGAR as HANDLINGAR_TEXT } from './atkomst.js';
import { loggaRad, verifiera } from './logg.js';
import { anteckningUt, kallaEtikett, MATTYPER } from './journal.js';
import { ordinationUt } from './lakemedel.js';
import { forInvanare as uppmarksamhetForInvanare } from './uppmarksamhet.js';
import { MATKOD } from './kodverk.js';
import { YRKEN } from './seed/personal.js';
import { kvalitetssakrad } from './mt-klass.js';
// Runda 10, r7: ombud med fullmakt (ombud.js).
import { fullmaktFor, ombudFor, forfragningar } from './ombud.js';

export const PROVSVAR_SENAST_DAGAR = 14;
export const BEGARANTYPER = ['sparr', 'hava_sparr', 'loggutdrag'];
const MAX_BEGARAN = 20;
// Så många nekade försök får en invånare göra i en sandlåda. Därefter stoppas försöken utan att loggas, så att ingen
// kan fylla en annan patients logglista eller logguppföljningen med nekade försök.
export const MAX_NEKADE = 20;
const DAG = 86400_000;
// Samma svar oavsett om journalen finns eller inte, så att det inte går att pröva sig fram till andras patient-id.
const SAKNAS = 'Journalen finns inte, eller så har du inte tillgång till den.';

export const invanareRad = (db, id) => (typeof id === 'string' ? db.query('SELECT * FROM invanare WHERE id = ?').get(id) ?? null : null);
const patientRad = (db, id) => (typeof id === 'string' ? db.query('SELECT * FROM patienter WHERE id = ?').get(id) ?? null : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? null;
const vardgivare = (db) => db.query("SELECT namn FROM enheter WHERE typ = 'vardgivare'").get()?.namn ?? null;
const namnAv = (x) => `${x.fornamn} ${x.efternamn}`;
const aldersdag = (nu) => datumAv(nu);

// Vårdenheten och, för en avdelning eller mottagning, arbetsplatsen. Inga id.
function enhetUt(db, enhetId) {
  const ve = vardenhetFor(db, enhetId);
  return { vardenhet: enhetsnamn(db, ve), arbetsplats: ve !== enhetId ? enhetsnamn(db, enhetId) : null };
}

// Journalerna invånaren har en koppling till: den egna och barnens. atkomst säger om de får läsas nu.
export function journaler(db, inv, nu = new Date()) {
  if (!inv) return [];
  const barn = db.query('SELECT barn_id FROM vardnadshavare WHERE invanare_id = ? ORDER BY barn_id').all(inv.id).map(r => r.barn_id);
  return [...(inv.patient_id ? [inv.patient_id] : []), ...barn].map(id => patientRad(db, id)).filter(Boolean).map(p => {
    const r = provaInvanare(db, { invanare: inv, patient: p, nu });
    const egen = inv.patient_id === p.id;
    // Ett barn med skyddade personuppgifter visas inte med namn, eftersom journalen inte kan läsas av vårdnadshavaren.
    const dold = !egen && Boolean(p.skyddad);
    return {
      patientId: p.id, namn: dold ? SKYDDAD_NAMN : namnAv(p), personnummer: dold ? maskeraPnr(p.personnummer) : formateraPnr(p.personnummer),
      alder: alder(p.fodd, aldersdag(nu)), relation: egen ? 'egen' : 'vardnadshavare', atkomst: r.tillaten, skal: r.skal || null,
    };
  });
}

export function sessionDel(db, inv, nu = new Date()) {
  return {
    invanare: { id: inv.id, namn: namnAv(inv), personnummer: formateraPnr(inv.personnummer), alder: alder(inv.fodd, aldersdag(nu)) },
    journaler: journaler(db, inv, nu),
    // Runda 10, r7: patienterna som invånaren är ombud för (ombud.js).
    ombudFor: ombudFor(db, inv),
    ombudForfragningar: forfragningar(db, inv),
  };
}

// De påhittade personerna för den simulerade e-legitimationen. Listan visas före inloggning, så en patient med skyddade
// personuppgifter visas utan namn och med maskerat personnummer. Personer under 16 år kan inte logga in själva.
export function demoInvanare(db, nu = new Date()) {
  return db.query('SELECT * FROM invanare ORDER BY patient_id IS NULL, id').all()
    .filter(i => alder(i.fodd, aldersdag(nu)) >= EGEN_FRAN_ALDER)
    .map(i => {
      const p = patientRad(db, i.patient_id);
      const skyddad = Boolean(p?.skyddad);
      const barn = db.query('SELECT p.* FROM vardnadshavare v JOIN patienter p ON p.id = v.barn_id WHERE v.invanare_id = ? ORDER BY p.id').all(i.id);
      return {
        id: i.id, namn: skyddad ? SKYDDAD_NAMN : namnAv(i), personnummer: skyddad ? maskeraPnr(i.personnummer) : formateraPnr(i.personnummer),
        alder: alder(i.fodd, aldersdag(nu)), skyddad, egenJournal: Boolean(p),
        barn: barn.map(b => ({ namn: b.skyddad ? SKYDDAD_NAMN : namnAv(b), alder: alder(b.fodd, aldersdag(nu)) })),
      };
    });
}

export function provaInloggning(db, id, nu = new Date()) {
  const inv = invanareRad(db, id);
  if (!inv) throw new Fel(400, 'Välj en av de påhittade personerna.', 'ogiltig', { falt: ['invanareId'] });
  if (alder(inv.fodd, aldersdag(nu)) < EGEN_FRAN_ALDER) {
    throw new Fel(403, `Min journal är öppen från ${EGEN_FRAN_ALDER} års ålder. Vårdnadshavare loggar in med sin egen e-legitimation.`, 'nekad');
  }
  return inv;
}

// Kontext för ett anrop från invånaren: vem, vilken journal och på vilken grund. Nekade försök till en journal som
// finns loggas på den journalen, så att de syns i logguppföljningen och i patientens logglista.
export class InvanareAtkomst {
  // nekade: { antal } för invånaren i sessionen, delas mellan anropen.
  constructor(db, invanare, patientId, nekade = null) {
    this.db = db;
    this.invanare = invanare;
    this.patientId = patientId;
    this.nekade = nekade;
    this.patient = null;
    this.grund = null;
    this.relation = null;
    this.loggad = false;
  }

  // En journal som invånaren har en koppling till men inte får läsa nu (ett barn som fyllt 13) ger 403 med skälet.
  // Annars 404, oavsett om journalen finns.
  krav(resurs = null) {
    const p = patientRad(this.db, this.patientId);
    const r = provaInvanare(this.db, { invanare: this.invanare, patient: p });
    // Runda 10, r7: ett ombud med giltig fullmakt når patientens tider och meddelanden, aldrig journalen (ombud.js).
    const om = !r.tillaten && p && !r.relation ? fullmaktFor(this.db, this.invanare, p.id, resurs) : null;
    if (om) {
      if (!om.tillaten) {
        // Samma tak för nekade försök som annars, så att ett ombud inte kan fylla patientens logglista.
        if (this.nekade && this.nekade.antal >= MAX_NEKADE) throw new Fel(403, 'Du har gjort många försök att öppna delar som du inte har tillgång till. Fler försök stoppas.', 'nekad');
        if (this.nekade) this.nekade.antal++;
        this.patient = p;
        this.logga(resurs, { grund: 'ombud', resultat: 'nekad' });
        throw new Fel(403, 'Fullmakten gäller inte den här delen. Som ombud ser du bara det som fullmakten gäller, aldrig journalen.', 'nekad');
      }
      this.patient = p;
      this.grund = 'ombud';
      this.relation = 'ombud';
      this.fullmakt = om.fullmakt;
      return { tillaten: true, grund: 'ombud', relation: 'ombud', skal: '' };
    }
    if (!r.tillaten) {
      if (this.nekade && this.nekade.antal >= MAX_NEKADE) {
        throw new Fel(403, 'Du har gjort många försök att öppna journaler som du inte har tillgång till. Fler försök stoppas.', 'nekad');
      }
      if (this.nekade) this.nekade.antal++;
      if (p) this.logga(resurs, { grund: 'nekad', resultat: 'nekad' });
      if (r.relation) throw new Fel(403, r.skal, 'nekad');
      throw new Fel(404, SAKNAS, 'saknas');
    }
    this.patient = p;
    this.grund = r.grund;
    this.relation = r.relation;
    return r;
  }

  logga(resurs = null, { handling = 'invanare_las', grund = this.grund, resultat = 'tillaten' } = {}) {
    this.loggad = true;
    return loggaRad(this.db, {
      personal_id: null, enhet_id: null, invanare_id: this.invanare.id, patient_id: this.patient?.id ?? this.patientId,
      handling, resurs, grund, resultat,
    });
  }
}

// Provsvar och mätvärden. Vitalparametrar visas direkt, labbvärden när de är vidimerade eller 14 dagar efter provtagningen.
export const arProvsvar = (typ) => MATKOD[typ]?.kategori === 'laboratory';
export function provsvarVisas(m, nu = new Date()) {
  if (!arProvsvar(m.typ) || m.vidimerad) return true;
  return Date.parse(m.tid) + PROVSVAR_SENAST_DAGAR * DAG <= nu.getTime();
}
const visasSenast = (m) => datumAv(new Date(Date.parse(m.tid) + PROVSVAR_SENAST_DAGAR * DAG));

// Visningsregeln för en anteckning. Den mest specifika gäller: vårdenhet och typ före vårdenhet före typ.
export function regelFor(db, a) {
  const ve = vardenhetFor(db, a.enhet_id);
  const vikt = (r) => (r.enhet_id ? 2 : 0) + (r.anteckningstyp ? 1 : 0);
  return db.query('SELECT * FROM visningsregler').all()
    .filter(r => (!r.enhet_id || r.enhet_id === ve) && (!r.anteckningstyp || r.anteckningstyp === a.typ))
    .sort((x, y) => vikt(y) - vikt(x) || x.id - y.id)[0] ?? null;
}

// { visas, regel, visasFran }. Ett utkast visas aldrig.
export function anteckningVisning(db, a, nu = new Date()) {
  if (a.status !== 'signerad' || !a.signerad_tid) return { visas: false, regel: null, visasFran: null };
  const regel = regelFor(db, a);
  if (!regel || regel.visning === 'direkt') return { visas: true, regel, visasFran: null };
  if (regel.visning === 'visas_inte') return { visas: false, regel, visasFran: null };
  const fran = Date.parse(a.signerad_tid) + regel.dagar * DAG;
  return { visas: fran <= nu.getTime(), regel, visasFran: new Date(fran).toISOString() };
}

const ersattAv = (db, id) => db.query('SELECT id FROM anteckningar WHERE ersatter_id = ?').get(id)?.id ?? null;
function versionskedja(db, id) {
  let rot = db.query('SELECT * FROM anteckningar WHERE id = ?').get(id);
  while (rot?.ersatter_id) rot = db.query('SELECT * FROM anteckningar WHERE id = ?').get(rot.ersatter_id);
  const kedja = [];
  for (let a = rot; a; a = db.query('SELECT * FROM anteckningar WHERE ersatter_id = ?').get(a.id)) kedja.push(a);
  return kedja;
}

// Signerade anteckningar i sin senaste version, efter visningsreglerna. Det som inte visas räknas, men innehållet
// lämnas inte ut.
function anteckningsurval(db, pid, nu) {
  const rader = db.query("SELECT * FROM anteckningar WHERE patient_id = ? AND status = 'signerad' ORDER BY signerad_tid DESC, id DESC").all(pid)
    .filter(a => ersattAv(db, a.id) == null);
  const visade = [];
  const senare = [];
  const ejVisade = new Map();
  for (const a of rader) {
    const v = anteckningVisning(db, a, nu);
    if (v.visas) visade.push(a);
    else if (v.regel?.visning === 'fordrojd') senare.push({ typ: a.typ, ...enhetUt(db, a.enhet_id), signerad: a.signerad_tid, visasFran: v.visasFran });
    else if (v.regel) {
      const x = ejVisade.get(v.regel.id) ?? { typ: v.regel.anteckningstyp, vardenhet: v.regel.enhet_id ? enhetsnamn(db, v.regel.enhet_id) : null, antal: 0, motivering: v.regel.motivering };
      x.antal++;
      ejVisade.set(v.regel.id, x);
    }
  }
  return { visade, senare, ejVisade: [...ejVisade.values()] };
}

const forfattare = (f) => (f ? { namn: f.namn, titel: f.titel } : null);
function anteckningKort(db, a) {
  const u = anteckningUt(db, a, { full: false });
  return {
    id: a.id, typ: a.typ, datum: a.signerad_tid, ...enhetUt(db, a.enhet_id), forfattare: forfattare(u.forfattare),
    rattad: a.ersatter_id != null, sammanfattning: u.sammanfattning, kallaEtikett: u.kallaEtikett,
  };
}
function anteckningFull(db, a) {
  const u = anteckningUt(db, a);
  return {
    id: a.id, typ: a.typ, datum: a.signerad_tid, ...enhetUt(db, a.enhet_id), forfattare: forfattare(u.forfattare),
    signeradAv: forfattare(u.signerad?.av), version: a.version, rattelseOrsak: a.rattelse_orsak, ersatt: u.ersatt,
    sokord: u.sokord, kallaEtikett: u.kallaEtikett,
  };
}

const diagnosUt = (db, d) => ({ id: d.id, kod: d.kod, text: d.text, typ: d.typ, datum: d.datum, ...enhetUt(db, d.enhet_id), kallaEtikett: kallaEtikett(d.kalla, d.datum) });
const overkanslighetUt = (db, o) => ({ id: o.id, amne: o.amne, reaktion: o.reaktion, allvarlighet: o.allvarlighet, datum: o.datum, ...enhetUt(db, o.enhet_id), kallaEtikett: kallaEtikett(o.kalla, o.datum) });
const vardkontaktUt = (db, v) => ({
  id: v.id, typ: v.typ, start: v.start, slut: v.slut, pagaende: v.slut == null, plats: v.plats, orsak: v.orsak, ...enhetUt(db, v.enhet_id),
  kallaEtikett: kallaEtikett(v.kalla, v.start),
});
function matvardeUt(db, m) {
  const labb = arProvsvar(m.typ);
  return {
    id: m.id, typ: m.typ, namn: MATTYPER[m.typ]?.namn ?? m.typ, varde: m.varde_num ?? m.varde, enhet: m.matt_enhet, tid: m.tid,
    ...enhetUt(db, m.enhet_id), provsvar: labb, vidimerad: labb ? Boolean(m.vidimerad) : null, kallaEtikett: kallaEtikett(m.kalla, m.tid),
  };
}
function ordinationInvanare(db, o) {
  const u = ordinationUt(db, o, { historik: false });
  return {
    id: o.id, lakemedel: u.lakemedel ? { namn: u.lakemedel.namn, substans: u.lakemedel.substans, styrka: u.lakemedel.styrka, form: u.lakemedel.form, atc: u.lakemedel.atc } : null,
    dosering: u.dosering, typ: u.typ, vidBehov: u.vidBehov, ordinationsorsak: u.ordinationsorsak, start: u.start, slut: u.slut,
    uppfoljningsdatum: u.uppfoljningsdatum, aktuell: u.aktuell, utsatt: u.utsatt ? { tid: u.utsatt.tid, orsak: u.utsatt.orsak } : null,
    ordineradAv: u.ordineradAv?.namn ?? null, ...enhetUt(db, o.enhet_id), kallaEtikett: u.kallaEtikett,
  };
}
const remissUt = (db, r) => ({
  id: r.id, fran: enhetsnamn(db, r.fran_enhet_id), till: enhetsnamn(db, r.till_enhet_id), prioritet: r.prioritet, svarSenast: r.svar_senast,
  status: r.status, beslut: r.beslut,
  tider: { skickad: r.skickad_tid, mottagen: r.mottagen_tid, bedomd: r.bedomd_tid, besvarad: r.besvarad_tid, svarKvitterat: r.svar_kvitterat_tid },
  fragestallning: r.fragestallning, motivering: r.motivering, svar: r.svar, kallaEtikett: kallaEtikett(r.kalla, r.skickad_tid),
  // Runda 6, r4: en egen vårdbegäran som invånaren skickade i Min journal.
  egen: r.fran_enhet_id === 'min-journal',
});

const sparrarFor = (db, pid) => db.query('SELECT * FROM sparrar WHERE patient_id = ? AND aktiv = 1 ORDER BY registrerad, id').all(pid)
  .map(s => { const ve = vardenhetFor(db, s.enhet_id); return { vardenhetId: ve, vardenhet: enhetsnamn(db, ve), sedan: s.registrerad }; });

// Vårdenheter som har uppgifter om patienten, de som en spärr kan gälla.
function enheterMedUppgifter(db, pid) {
  const rader = db.query(`SELECT enhet_id FROM anteckningar WHERE patient_id = ?1 UNION SELECT enhet_id FROM diagnoser WHERE patient_id = ?1
    UNION SELECT enhet_id FROM matvarden WHERE patient_id = ?1 UNION SELECT enhet_id FROM vardkontakter WHERE patient_id = ?1
    UNION SELECT enhet_id FROM ordinationer WHERE patient_id = ?1 UNION SELECT enhet_id FROM overkanslighet WHERE patient_id = ?1`).all(pid);
  return [...new Set(rader.map(r => vardenhetFor(db, r.enhet_id)))].map(id => ({ id, namn: enhetsnamn(db, id) }))
    .sort((a, b) => String(a.namn).localeCompare(String(b.namn), 'sv'));
}

// Huvudet för en journal: vem den gäller, relationen, spärrarna och vad som inte visas i Min journal.
export function huvud(atk) {
  const { db, patient: p } = atk;
  return {
    patient: { id: p.id, namn: namnAv(p), personnummer: formateraPnr(p.personnummer), alder: alder(p.fodd, aldersdag(new Date())), kon: p.kon, skyddad: Boolean(p.skyddad) },
    // Runda 10, r7: ett ombud ser inte patientens spärrar.
    relation: atk.relation, vardgivare: vardgivare(db), sparrar: atk.relation === 'ombud' ? [] : sparrarFor(db, p.id),
    ...(atk.relation === 'ombud' ? { ombud: { omfattning: JSON.parse(atk.fullmakt.omfattning), giltigTill: atk.fullmakt.giltig_till } } : {}),
    begransningar: {
      baraSignerade: true, provsvarSenastDagar: PROVSVAR_SENAST_DAGAR,
      regler: db.query("SELECT * FROM visningsregler WHERE visning <> 'direkt' ORDER BY id").all().map(r => ({
        vardenhet: r.enhet_id ? enhetsnamn(db, r.enhet_id) : null, typ: r.anteckningstyp, visning: r.visning, dagar: r.dagar, motivering: r.motivering,
      })),
    },
    kanBegaraSparr: atk.relation === 'egen',
  };
}

export function anteckningar(atk, nu = new Date()) {
  const u = anteckningsurval(atk.db, atk.patientId, nu);
  return { anteckningar: u.visade.map(a => anteckningKort(atk.db, a)), senare: u.senare, ejVisade: u.ejVisade };
}

// En version av en anteckning visas bara om hela versionskedjan är signerad och den senaste versionen visas. Då visas
// de äldre versionerna med den, överstrukna. Samma regel gäller i FHIR (fhir.js), så att en äldre version av en
// anteckning som senare har dolts eller ersatts inte går att nå där.
export function synligKedja(db, a, nu = new Date()) {
  const kedja = versionskedja(db, a.id);
  const senaste = kedja[kedja.length - 1];
  const synlig = kedja.length > 0 && kedja.every(v => v.status === 'signerad') && anteckningVisning(db, senaste, nu).visas;
  return { synlig, kedja, senaste };
}

export function anteckning(atk, id, nu = new Date()) {
  const db = atk.db;
  const a = db.query('SELECT * FROM anteckningar WHERE id = ? AND patient_id = ?').get(Number(id), atk.patientId);
  if (!a) throw new Fel(404, 'Anteckningen finns inte i din journal.', 'saknas');
  const { synlig, kedja, senaste } = synligKedja(db, a, nu);
  if (!synlig) throw new Fel(404, 'Anteckningen finns inte i din journal.', 'saknas');
  return { ...anteckningFull(db, senaste), versioner: kedja.map(v => anteckningFull(db, v)) };
}

export const diagnoser = (atk) => ({
  diagnoser: atk.db.query('SELECT * FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(atk.patientId).map(d => diagnosUt(atk.db, d)),
});

export function lakemedel(atk) {
  const db = atk.db;
  const ord = db.query('SELECT * FROM ordinationer WHERE patient_id = ? ORDER BY start DESC, id DESC').all(atk.patientId).map(o => ordinationInvanare(db, o));
  return {
    aktuella: ord.filter(o => o.aktuell), tidigare: ord.filter(o => !o.aktuell),
    overkanslighet: db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv' ORDER BY datum DESC, id DESC").all(atk.patientId).map(o => overkanslighetUt(db, o)),
  };
}

export function provsvar(atk, nu = new Date()) {
  const db = atk.db;
  // Runda 9, r2: patientens egna mätningar står under Egna mätningar, och värden från utrustning visas när vården har
  // godkänt dem (mt-klass.js).
  const rader = db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId).filter(m => m.kalla !== 'patient' && kvalitetssakrad(m));
  const visade = rader.filter(m => provsvarVisas(m, nu));
  return {
    provsvar: visade.filter(m => arProvsvar(m.typ)).map(m => matvardeUt(db, m)),
    matvarden: visade.filter(m => !arProvsvar(m.typ)).map(m => matvardeUt(db, m)),
    vantar: rader.filter(m => !provsvarVisas(m, nu)).map(m => ({ namn: MATTYPER[m.typ]?.namn ?? m.typ, provtagen: m.tid, visasSenast: visasSenast(m) })),
    senastDagar: PROVSVAR_SENAST_DAGAR,
  };
}

export const remisser = (atk) => ({
  remisser: atk.db.query('SELECT * FROM remisser WHERE patient_id = ? ORDER BY skickad_tid DESC, id DESC').all(atk.patientId).map(r => remissUt(atk.db, r)),
});

export const vardkontakter = (atk) => ({
  vardkontakter: atk.db.query('SELECT * FROM vardkontakter WHERE patient_id = ? ORDER BY start DESC, id DESC').all(atk.patientId).map(v => vardkontaktUt(atk.db, v)),
});

export function oversikt(atk, nu = new Date()) {
  const u = anteckningsurval(atk.db, atk.patientId, nu);
  const lm = lakemedel(atk);
  const ps = provsvar(atk, nu);
  const sett = new Set();
  return {
    anteckningar: u.visade.slice(0, 3).map(a => anteckningKort(atk.db, a)), antalAnteckningar: u.visade.length,
    lakemedel: lm.aktuella, overkanslighet: lm.overkanslighet,
    // Uppmärksamhetsinformation (Sussa 3.1.5): bekräftade uppgifter och överkänsligheter, utan förslag och personal.
    uppmarksamhet: uppmarksamhetForInvanare(atk.db, atk.patientId),
    diagnoser: diagnoser(atk).diagnoser.slice(0, 5),
    provsvar: [...ps.provsvar, ...ps.matvarden].sort((a, b) => b.tid.localeCompare(a.tid)).filter(m => !sett.has(m.typ) && sett.add(m.typ)),
    remisser: remisser(atk).remisser.filter(r => r.status !== 'svar_kvitterat' && r.beslut !== 'avvisad'),
    vardkontakter: vardkontakter(atk).vardkontakter.slice(0, 5),
    vantar: { anteckningar: u.senare.length, provsvar: ps.vantar.length },
  };
}

// Vem har läst journalen: vårdenhet, yrkesroll, tid och typ av åtkomst, inte personalens namn (HSLF-FS 2016:40 4 kap.
// 10 § kräver vårdenhet och tidpunkt). Invånarnas egna läsningar är med och märkta, och kan döljas i gränssnittet.
const VIA = (resurs) => {
  if (!resurs) return null;
  if (resurs.startsWith('fhir/')) return 'fhir';
  if (resurs === 'lasekopia' || resurs === 'lasekopia:slut') return 'laskopia';
  if (resurs.startsWith('laslage:')) return 'laslage';
  if (resurs.startsWith('min:') || resurs.startsWith('begaran:')) return 'min_journal';
  return null;
};
// Vårdens rader, invånarens egna och andra invånares hämtas var för sig med var sin gräns, så att många läsningar i Min
// journal aldrig tränger undan vårdens åtkomster eller någon annans försök ur listan. Loggens löpnummer lämnas inte ut, eftersom luckorna i det visar hur många
// åtkomster som har gjorts i andra journaler.
export const LOGGLISTA_MAX = { vard: 500, egna: 200, andra: 200 };
// Runda 13, r3 (E3-36): läskopians rutinrader sammanfattas per dag, vårdenhet och yrkesroll, med antalet, så att
// patienten ser att det har skett och var. En nekad rad eller en rad med nödåtkomst eller samtycke står för sig.
function sammanfattaKopior(ut, r) {
  const rutin = r.automatisk && r.resultat === 'tillaten' && !['nodatkomst', 'samtycke_sparr'].includes(r.grund);
  const dag = String(r.tid).slice(0, 10);
  const forra = rutin ? ut.find(x => x.automatisk && x.sammanfattad && x.tid.slice(0, 10) === dag && x.vardenhet === r.vardenhet && x.yrkesroll === r.yrkesroll) : null;
  if (forra) { forra.antal++; return ut; }
  ut.push(rutin ? { ...r, sammanfattad: true, antal: 1 } : r);
  return ut;
}
// Runda 13, r3 (E3-36): åtgärden med behörighetsmotorns beskrivning, med stor bokstav, och en allmän text för en okänd kod.
const handlingText = (h) => { const t = HANDLINGAR_TEXT[h]; return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Annan åtgärd i journalen'; };
export function logglista(atk) {
  const db = atk.db;
  const jag = atk.invanare.id;
  const vg = vardgivare(db);
  const fraga = (villkor, max) => db.query(`SELECT l.id, l.tid, l.enhet_id, l.handling, l.resurs, l.grund, l.resultat, l.invanare_id, p.yrke, i.patient_id AS inv_patient
    FROM atkomstlogg l LEFT JOIN personal p ON p.id = l.personal_id LEFT JOIN invanare i ON i.id = l.invanare_id
    WHERE (l.patient_id = ?1 OR l.patient_id IN (SELECT id FROM patienter WHERE sammanslagen_till = ?1)) AND ${villkor} ORDER BY l.id DESC LIMIT ?3`).all(atk.patientId, jag, max);
  const delar = {
    vard: fraga('l.invanare_id IS NULL', LOGGLISTA_MAX.vard),
    egna: fraga('l.invanare_id = ?2', LOGGLISTA_MAX.egna),
    andra: fraga('l.invanare_id IS NOT NULL AND l.invanare_id <> ?2', LOGGLISTA_MAX.andra),
  };
  const rader = [...delar.vard, ...delar.egna, ...delar.andra].sort((a, b) => b.id - a.id);
  return {
    rader: rader.map(r => {
      const inv = r.invanare_id != null;
      const vem = !inv ? 'personal' : r.invanare_id === jag ? 'du' : r.inv_patient === atk.patientId ? 'patienten' : r.grund === 'vardnadshavare' ? 'vardnadshavare' : r.grund === 'ombud' ? 'ombud' : 'invanare';
      const e = r.enhet_id ? enhetUt(db, r.enhet_id) : { vardenhet: null, arbetsplats: null };
      return {
        tid: r.tid, vem, vardgivare: inv ? null : vg, vardenhet: e.vardenhet, arbetsplats: e.arbetsplats,
        yrkesroll: r.yrke ? YRKEN[r.yrke] ?? null : null, handling: r.handling, grund: r.grund, resultat: r.resultat, via: VIA(r.resurs),
        // Runda 13, r3 (E3-36, säkerhetsgranskningen): åtgärden i klartext, aldrig en intern kod. Läskopian för avbrott
        // beskrivs som det den är, ett utlämnande till en dator på vårdenheten.
        handlingText: VIA(r.resurs) === 'laskopia' ? `Uppgifter ur journalen kopierades till en dator på ${e.vardenhet ?? 'vårdenheten'} för läsning vid avbrott` : handlingText(r.handling),
        ...(VIA(r.resurs) === 'laskopia' ? { automatisk: true } : {}),
        egenAtkomst: r.invanare_id === jag,
      };
    }).reduce(sammanfattaKopior, []),
    max: LOGGLISTA_MAX, avskurna: Object.fromEntries(Object.entries(delar).map(([k, v]) => [k, v.length >= LOGGLISTA_MAX[k]])),
    kedjaHel: verifiera(db).hel,
  };
}

// Spärrar och begäranden. Patienten kan begära att uppgifter spärras eller att en spärr hävs, och begära ett loggutdrag
// med namn. En begäran ändrar ingenting i journalen: den registreras och behandlas av vården, som prövar den.
const begaranUt = (db, b, jag) => ({
  id: b.id, typ: b.typ, vardenhet: b.enhet_id ? enhetsnamn(db, b.enhet_id) : null, meddelande: b.meddelande, skapad: b.skapad, status: b.status,
  egen: b.invanare_id === jag,
  // Runda 10, r7: beskedet när vården har handlagt begäran (invanarmeddelanden.js).
  besked: db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'begaran_beslut'").get() ? db.query('SELECT besked FROM begaran_beslut WHERE begaran_id = ?').get(b.id)?.besked ?? null : null,
});
export function sparrvy(atk) {
  const db = atk.db;
  const sparrar = sparrarFor(db, atk.patientId);
  const sparrade = new Set(sparrar.map(s => s.vardenhetId));
  return {
    sparrar, kanBegaraSparr: atk.relation === 'egen',
    vardenheter: enheterMedUppgifter(db, atk.patientId).map(e => ({ ...e, sparrad: sparrade.has(e.id) })),
    begaran: db.query('SELECT * FROM begaran WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId).map(b => begaranUt(db, b, atk.invanare.id)),
  };
}

export function skapaBegaran(atk, { typ, enhetId, meddelande } = {}) {
  const db = atk.db;
  const pid = atk.patientId;
  if (!BEGARANTYPER.includes(typ)) throw new Fel(400, 'Välj vad du vill begära.', 'ogiltig', { falt: ['typ'] });
  if (typ !== 'loggutdrag' && atk.relation !== 'egen') {
    throw new Fel(403, 'En vårdnadshavare kan inte spärra barnets uppgifter eller begära att en spärr hävs (patientdatalagen 4 kap. 4 och 5 §§).', 'nekad');
  }
  const text = meddelande == null ? '' : typeof meddelande === 'string' ? meddelande.trim() : null;
  if (text === null || text.length > 500) throw new Fel(400, 'Meddelandet får vara högst 500 tecken.', 'ogiltig', { falt: ['meddelande'] });
  let enhet = null;
  if (typ !== 'loggutdrag') {
    const sparrade = new Set(sparrarFor(db, pid).map(s => s.vardenhetId));
    const kandidater = typ === 'sparr' ? enheterMedUppgifter(db, pid).map(e => e.id).filter(id => !sparrade.has(id)) : [...sparrade];
    if (typeof enhetId !== 'string' || !kandidater.includes(enhetId)) {
      throw new Fel(400, typ === 'sparr' ? 'Välj en vårdenhet som har uppgifter om dig och som inte redan är spärrad.' : 'Välj en av dina spärrar.', 'ogiltig', { falt: ['enhetId'] });
    }
    enhet = enhetId;
  }
  const oppna = db.query("SELECT * FROM begaran WHERE patient_id = ? AND status = 'skickad'").all(pid);
  if (oppna.some(b => b.typ === typ && (b.enhet_id ?? null) === enhet)) throw new Fel(400, 'Du har redan skickat den begäran. Vården behandlar den.', 'ogiltig');
  if (db.query('SELECT count(*) AS n FROM begaran WHERE patient_id = ?').get(pid).n >= MAX_BEGARAN) {
    throw new Fel(400, 'Du har skickat många begäranden. Vänta tills vården har behandlat dem.', 'ogiltig');
  }
  const r = db.query('INSERT INTO begaran (patient_id, invanare_id, typ, enhet_id, meddelande, skapad) VALUES (?, ?, ?, ?, ?, ?)')
    .run(pid, atk.invanare.id, typ, enhet, text || null, iso());
  atk.logga(`begaran:${typ}`, { handling: 'invanare_begaran' });
  return { begaran: begaranUt(db, db.query('SELECT * FROM begaran WHERE id = ?').get(r.lastInsertRowid), atk.invanare.id) };
}
