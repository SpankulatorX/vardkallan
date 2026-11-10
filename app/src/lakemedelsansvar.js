// Ansvarsuppdrag för läkemedel på vårdenheten (runda 6, r6, beslut av projektägaren 2026-11-03).
//
// Underlag: Region Örebro läns Ordination och hantering av läkemedel, riktlinjer och rutiner (Gröna häftet),
// dokument 688488 R5, giltigt från 2026-06-08. Verksamhetschefen har det samlade ledningsansvaret för ordination och
// hantering av läkemedel, och det kan inte överlåtas (1.3). Verksamhetschefen uppdrar åt namngivna personer att
// fullgöra enskilda ledningsuppgifter, och av uppdraget ska det framgå omfattningen och hur länge det gäller (1.3).
// Uppdragen är medicinskt ansvarig läkare (1.4.2), läkare ansvarig för läkemedelsmallar (1.4.3), läkemedelsansvarig
// sjuksköterska (1.4.4) och sjuksköterska med ansvar för kontroll av narkotikaförbrukningen, minst en ordinarie och en
// reserv, som inte får ha behörighet att beställa narkotiska läkemedel (1.4.5). Ansvarsdokumentet revideras vid
// förändringar och minst en gång per år (1.3). HSLF-FS 2017:37 4 kap. 2 §: vårdgivaren fastställer rutiner för
// ordination och hantering av läkemedel.
//
// Häftet säger att läkemedelsansvarig sjuksköterska och kontrollanterna utses av enhetschefen. Demon har ingen
// enhetschef, så verksamhetschefen utser alla uppdrag.
//
// Systemet är experten. Det vet vilka uppdrag vårdenheten ska ha, föreslår vem som ska få uppdraget (den som hade det
// senast, annars en överläkare), fyller i omfattningen ur häftet och perioden, prövar att personen arbetar på
// vårdenheten och har rätt yrke och att ingen får beställa och kontrollera narkotika samtidigt, och påminner
// verksamhetschefen när ett uppdrag saknas eller går ut och när ansvarsdokumentet inte har setts över på ett år.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { vardenhetFor, enheterUnder, kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import { OMFATTNING } from './lakemedelsansvar-schema.js';
import { YRKEN } from './seed/personal.js';

export const DEMO_ANSVAR = 'Uppdragen och påminnelserna följer Region Örebro läns Gröna häftet (688488 R5). Demon har en verksamhetschef bara på Kardiologiska kliniken, och där utser verksamhetschefen också de uppdrag som enligt häftet utses av enhetschefen.';
export const LEDNINGSANSVAR = 'Verksamhetschefens samlade ledningsansvar för ordination och hantering av läkemedel kan inte överlåtas till någon annan (Gröna häftet 1.3, HSL 4 kap. 2 §). Verksamhetschefen kan uppdra åt andra att fullgöra enskilda ledningsuppgifter, och det är de uppdragen som finns här.';

export const UPPDRAG = {
  medicinskt_ansvarig: { namn: 'Medicinskt ansvarig läkare', yrke: 'lakare', kalla: 'Gröna häftet 1.4.2', utsesAv: 'Verksamhetschefen', ensam: true, erfaren: true,
    utan: 'Utan medicinskt ansvarig läkare fastställer bara verksamhetschefen generella direktiv, och beslut om läkemedel som väntar på en avbokad vårdhändelse går till alla läkare på vårdenheten.' },
  mallansvarig: { namn: 'Läkare ansvarig för läkemedelsmallar', yrke: 'lakare', kalla: 'Gröna häftet 1.4.3', utsesAv: 'Verksamhetschefen', erfaren: true,
    utan: 'Utan mallansvarig läkare kan ingen ny eller ändrad läkemedelsmall godkännas, och den kan därför inte användas.' },
  lakemedelsansvarig_ssk: { namn: 'Läkemedelsansvarig sjuksköterska', yrke: 'sjukskoterska', kalla: 'Gröna häftet 1.4.4', utsesAv: 'Enhetschefen, i demon verksamhetschefen',
    utan: 'Vårdenheten ska ha en sjuksköterska med huvudansvar för beställning och förvaring av läkemedel.' },
  narkotikakontroll: { namn: 'Sjuksköterska med ansvar för kontroll av narkotikaförbrukningen', yrke: 'sjukskoterska', kalla: 'Gröna häftet 1.4.5', utsesAv: 'Enhetschefen, i demon verksamhetschefen', reserv: true,
    utan: 'Gröna häftet 1.4.5 kräver minst en ordinarie och en reservkontrollant på en vårdenhet som hanterar narkotiska läkemedel.' },
};
// Runda 10, r4: de donationsansvariga på en vårdenhet med intensivvårdsavdelning (donation.js, Sussa 3.1.12.1). De får
// förslaget att pröva donation när en patient avlider på intensivvården. Samma mekanism som läkemedelsuppdragen:
// verksamhetschefen utser per vårdenhet, med period och omfattning. bara avgör vilka vårdenheter som ska ha uppdraget.
const harIva = (db, ve) => { const { IVA_ENHETER } = require('./iva.js'); return enheterUnder(db, ve).some(e => Object.hasOwn(IVA_ENHETER, e)); };
Object.assign(UPPDRAG, {
  donationsansvarig_lakare: { namn: 'Donationsansvarig läkare', yrke: 'lakare', kalla: 'Lag (1995:831) om transplantation m.m. och vårdgivarens rutin för donation', utsesAv: 'Verksamhetschefen', ensam: true, bara: harIva,
    utan: 'Utan donationsansvarig läkare går förslaget att pröva donation efter ett dödsfall på intensivvårdsavdelningen inte till någon.' },
  donationsansvarig_ssk: { namn: 'Donationsansvarig sjuksköterska', yrke: 'sjukskoterska', kalla: 'Lag (1995:831) om transplantation m.m. och vårdgivarens rutin för donation', utsesAv: 'Verksamhetschefen', ensam: true, bara: harIva,
    utan: 'Utan donationsansvarig sjuksköterska går förslaget att pröva donation efter ett dödsfall på intensivvårdsavdelningen bara till läkaren.' },
});
// Runda 11, r4: regimansvarig läkare för cytostatika, på en onkologisk enhet (cytostatika.js). Den regimansvariga
// godkänner nya versioner av regimerna i sin egen inloggning, och uppdraget prövas vid varje godkännande.
Object.assign(UPPDRAG, {
  regimansvarig: { namn: 'Regimansvarig läkare för cytostatika', yrke: 'lakare', kalla: 'Vårdgivarens rutin för cytostatikabehandling', utsesAv: 'Verksamhetschefen',
    bara: (db, ve) => require('./cytostatika.js').ONKOLOGISKA.has(ve),
    utan: 'Utan regimansvarig läkare kan ingen ny eller ändrad cytostatikaregim godkännas, och den gällande versionen används.' },
});
const forEnhet = (db, ve, typ) => !UPPDRAG[typ].bara || UPPDRAG[typ].bara(db, ve);

// Namnet på uppdraget, med reservkontrollanten för sig.
const namnFor = (typ, reserv) => (reserv ? 'Reservkontrollant för narkotikaförbrukningen' : UPPDRAG[typ].namn);
export const TYPER = Object.keys(UPPDRAG);
const ARS_DAGAR = 365;
const GAR_UT_DAGAR = 30;

const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'lakemedelsuppdrag'").get());
const personRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const loggaUtan = (db, personal, resurs, resultat = 'tillaten', handling = 'lakemedelsansvar') =>
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling, resurs, grund: resultat === 'nekad' ? 'nekad' : 'administrativ', resultat });
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const datumText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dagarTill = (d) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${idag()}T12:00:00Z`)) / 86400_000);

// Ett uppdrag gäller en dag när dagen ligger i perioden och uppdraget inte har avslutats före den, och personen
// fortfarande är i tjänst på vårdenheten.
const galler = (u, dag = idag()) => u.fran <= dag && dag <= u.till && (!u.avslutat || dag < u.avslutat);
const kvar = (db, u) => { const p = personRad(db, u.personal_id); return Boolean(p && p.aktiv === 1 && vardenhetFor(db, p.enhet_id) === u.enhet_id); };

export function verksamhetschefFor(db, ve) {
  if (!harTabell(db)) return null;
  const r = db.query('SELECT personal_id FROM verksamhetschefer WHERE enhet_id = ?').get(ve);
  return r ? personRad(db, r.personal_id) : null;
}
// Vårdenheten där personen är verksamhetschef, annars null.
export function chefFor(db, personal) {
  if (personal?.yrke !== 'verksamhetschef' || !kanRoll(personal, 'lakemedelsansvar')) return null;
  const ve = vardenhetFor(db, personal.enhet_id);
  return verksamhetschefFor(db, ve)?.id === personal.id ? ve : null;
}

export function gallande(db, ve, typ, dag = idag()) {
  if (!harTabell(db)) return [];
  return db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? AND typ = ? ORDER BY reserv, fran, id').all(ve, typ).filter(u => galler(u, dag) && kvar(db, u));
}
export function uppdragFor(db, personal, typ, dag = idag()) {
  if (!personal) return null;
  return gallande(db, vardenhetFor(db, personal.enhet_id), typ, dag).find(u => u.personal_id === personal.id) ?? null;
}
export function medicinsktAnsvarig(db, ve) {
  const u = gallande(db, ve, 'medicinskt_ansvarig')[0];
  return u ? personRad(db, u.personal_id) : null;
}

// Vem som får raden i inkorgen om en avbokad vårdhändelse när läkaren saknar grund att se patienten
// (vardhandelse.avbokadeIInkorg): den läkare som ordinerade, och om den läkaren inte längre finns på den ordinerande
// vårdenheten den medicinskt ansvariga läkaren. Saknas uppdraget går raden till alla läkare på vårdenheten, och
// verksamhetschefen får en påminnelse.
export function mottagareUtanGrund(db, o) {
  const ve = vardenhetFor(db, o.enhet_id);
  const ord = personRad(db, o.ordinerad_av);
  if (ord && ord.aktiv === 1 && ord.yrke === 'lakare' && vardenhetFor(db, ord.enhet_id) === ve) return { lage: 'ordinerande', personalId: ord.id };
  const mal = medicinsktAnsvarig(db, ve);
  if (mal) return { lage: 'medicinskt_ansvarig', personalId: mal.id };
  return { lage: 'alla', personalId: null };
}

// Generella direktiv fastställs av verksamhetschefen eller den medicinskt ansvariga läkaren (Gröna häftet 1.4.2 och
// avsnittet om generella direktiv, HSLF-FS 2017:37 6 kap. 6 §).
export function faststallaDirektiv(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  if (ve && chefFor(db, personal) === ve) return { kan: true, som: 'verksamhetschef', varfor: null };
  if (personal.yrke === 'lakare' && uppdragFor(db, personal, 'medicinskt_ansvarig')) return { kan: true, som: 'medicinskt_ansvarig', varfor: null };
  const mal = medicinsktAnsvarig(db, ve);
  return { kan: false, som: null,
    varfor: `Generella direktiv fastställs av verksamhetschefen eller den medicinskt ansvariga läkaren (HSLF-FS 2017:37 6 kap. 6 §, Gröna häftet 1.4.2). ${mal ? `På ${enhetsnamn(db, ve)} är det ${mal.namn}.` : `${enhetsnamn(db, ve)} har ingen medicinskt ansvarig läkare just nu, och verksamhetschefen kan utse en.`}` };
}

function uppdragUt(db, u) {
  const p = personRad(db, u.personal_id);
  const t = UPPDRAG[u.typ];
  return {
    id: u.id, typ: u.typ, namn: namnFor(u.typ, u.reserv), reserv: Boolean(u.reserv), vardenhet: { id: u.enhet_id, namn: enhetsnamn(db, u.enhet_id) },
    personal: p ? { id: p.id, namn: p.namn, titel: p.titel } : null, fran: u.fran, till: u.till, omfattning: JSON.parse(u.omfattning),
    sattAv: u.satt_av ? personRad(db, u.satt_av)?.namn ?? u.satt_av : 'Demons grunddata', satt: u.satt, galler: galler(u) && kvar(db, u),
    avslutat: u.avslutat ? { fran: u.avslutat, av: personRad(db, u.avslutat_av)?.namn ?? u.avslutat_av, tid: u.avslutat_tid, orsak: u.avslutat_orsak } : null,
    garUtOmDagar: galler(u) ? dagarTill(u.till) : null,
  };
}

// Den som hade uppdraget senast och som inte har det nu, för förslaget att förnya.
function senaste(db, ve, typ, reserv) {
  return db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? AND typ = ? AND reserv = ? ORDER BY coalesce(avslutat, till) DESC, id DESC').all(ve, typ, reserv ? 1 : 0)
    .find(u => !galler(u) && (u.avslutat ?? u.till) <= idag()) ?? null;
}

// Varför personen inte kan få uppdraget, eller null. Samma prövning i förslaget och när uppdraget sparas.
// Uppdrag som gäller någon dag i perioden, för personer som fortfarande är i tjänst på vårdenheten.
function overlappande(db, ve, typ, fran, till) {
  return db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? AND typ = ?').all(ve, typ)
    .filter(u => u.fran <= till && (u.avslutat ? u.avslutat > fran && u.avslutat > u.fran : u.till >= fran) && kvar(db, u));
}
function hinder(db, ve, typ, p, reserv, fran = idag(), till = addDagar(fran, ARS_DAGAR)) {
  const t = UPPDRAG[typ];
  if (!p) return 'Välj en person på vårdenheten.';
  if (p.yrke === 'verksamhetschef') return LEDNINGSANSVAR;
  if (p.aktiv !== 1) return `${p.namn} är inte längre i tjänst.`;
  if (vardenhetFor(db, p.enhet_id) !== ve) return `${p.namn} arbetar inte på ${enhetsnamn(db, ve)}. Ett uppdrag ges till vårdenhetens egen personal.`;
  if (p.yrke !== t.yrke) return `Uppdraget som ${t.namn.toLowerCase()} ges till en ${YRKEN[t.yrke].toLowerCase()}, och ${p.namn} är ${(YRKEN[p.yrke] ?? p.yrke).toLowerCase()}.`;
  if (t.erfaren && /^underläkare/i.test(p.titel ?? '')) return `Uppdraget kräver tillräcklig kompetens och erfarenhet (Gröna häftet 1.3), och i demon ges det inte till en underläkare.`;
  const har = (typ2, r = null) => overlappande(db, ve, typ2, fran, till).some(u => u.personal_id === p.id && (r == null || Boolean(u.reserv) === r));
  if (typ === 'narkotikakontroll' && har('lakemedelsansvarig_ssk')) return `${p.namn} är läkemedelsansvarig sjuksköterska och har huvudansvaret för beställningen av läkemedel. Den som kontrollerar förbrukningen av narkotiska läkemedel får inte ha behörighet att beställa dem (Gröna häftet 1.4.5).`;
  if (typ === 'lakemedelsansvarig_ssk' && har('narkotikakontroll')) return `${p.namn} kontrollerar förbrukningen av narkotiska läkemedel och får därför inte ha huvudansvaret för beställningen (Gröna häftet 1.4.5).`;
  if (typ === 'narkotikakontroll' && har('narkotikakontroll', !reserv)) return `${p.namn} är redan ${reserv ? 'ordinarie kontrollant' : 'reservkontrollant'}. Ordinarie och reserv ska vara två olika sjuksköterskor.`;
  if (har(typ, t.reserv ? reserv : null)) return `${p.namn} har redan uppdraget under den perioden.`;
  return null;
}

// Personerna som kan få uppdraget, med den systemet föreslår först och varför.
function kandidater(db, ve, typ, reserv = false) {
  const enheter = new Set(enheterUnder(db, ve));
  const alla = db.query('SELECT * FROM personal WHERE aktiv = 1 ORDER BY rowid').all().filter(p => enheter.has(p.enhet_id) && !hinder(db, ve, typ, p, reserv));
  const forra = senaste(db, ve, typ, reserv);
  const mal = typ === 'mallansvarig' ? medicinsktAnsvarig(db, ve) : null;
  const vikt = (p) => (p.id === forra?.personal_id ? 0 : p.id === mal?.id ? 1 : /överläkare/i.test(p.titel ?? '') ? 2 : 3);
  return alla.sort((a, b) => vikt(a) - vikt(b)).map(p => ({
    id: p.id, namn: p.namn, titel: p.titel,
    varfor: p.id === forra?.personal_id ? `${p.namn} hade uppdraget till ${datumText(forra.avslutat ? addDagar(forra.avslutat, -1) : forra.till)}.`
      : p.id === mal?.id ? `${p.namn} är medicinskt ansvarig läkare.` : /överläkare/i.test(p.titel ?? '') ? `${p.namn} är överläkare på vårdenheten.` : `${p.namn} är ${(p.titel ?? YRKEN[p.yrke]).toLowerCase()} på vårdenheten.`,
  }));
}

function forslag(db, ve, typ, reserv = false) {
  const k = kandidater(db, ve, typ, reserv);
  const fran = idag();
  return { typ, reserv, kandidater: k, personalId: k[0]?.id ?? null, varfor: k[0]?.varfor ?? `Det finns ingen på vårdenheten som kan få uppdraget som ${namnFor(typ, reserv).toLowerCase()}.`,
    fran, till: addDagar(fran, ARS_DAGAR), omfattning: OMFATTNING[typ] };
}

// Ansvarsdokumentet: när det senast reviderades. En ändring av ett uppdrag är en revidering (Gröna häftet 1.3:
// revidering vid förändringar, dock minst en gång per år), liksom verksamhetschefens genomgång.
function ansvarsdokument(db, ve) {
  const ov = db.query('SELECT * FROM ansvarsdokument_oversyn WHERE enhet_id = ? ORDER BY tid DESC, id DESC LIMIT 1').get(ve);
  const andr = db.query(`SELECT CASE WHEN coalesce(avslutat_tid, '') > satt THEN avslutat_tid ELSE satt END AS t, CASE WHEN coalesce(avslutat_tid, '') > satt THEN avslutat_av ELSE satt_av END AS av
    FROM lakemedelsuppdrag WHERE enhet_id = ? AND satt_av IS NOT NULL ORDER BY t DESC LIMIT 1`).get(ve);
  const senast = [ov && { tid: ov.tid, av: ov.personal_id, hur: 'genomgång' }, andr && { tid: andr.t, av: andr.av, hur: 'ändrat uppdrag' }].filter(Boolean).sort((a, b) => b.tid.localeCompare(a.tid))[0] ?? null;
  const dag = senast ? new Date(senast.tid).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) : null;
  const nasta = dag ? addDagar(dag, ARS_DAGAR) : idag();
  return { senast: senast ? { tid: senast.tid, datum: dag, av: personRad(db, senast.av)?.namn ?? senast.av, hur: senast.hur } : null, nasta, forfallet: nasta < idag() };
}

// En vårdenhet som hanterar läkemedel: har ordinationer, generella direktiv eller läkare och sjuksköterskor.
function hanterarLakemedel(db, ve) {
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  return Boolean(db.query(`SELECT 1 FROM ordinationer WHERE enhet_id IN (${ph}) LIMIT 1`).get(...enheter)
    || db.query(`SELECT 1 FROM personal WHERE enhet_id IN (${ph}) AND aktiv = 1 AND yrke IN ('lakare', 'sjukskoterska') LIMIT 1`).get(...enheter));
}

// Avbokade vårdhändelser vars rad gick till alla läkare eftersom uppdraget saknas. Bara ett antal, inga
// patientuppgifter.
function avbokadeTillAlla(db, ve) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardhandelse_kopplingar'").get()) return 0;
  return db.query(`SELECT o.* FROM vardhandelse_kopplingar k JOIN ordinationer o ON o.id = k.ordination_id
    WHERE k.remiss_avvisad = 1 AND k.foljer = 1 AND o.status = 'aktiv'`).all().filter(o => vardenhetFor(db, o.enhet_id) === ve && mottagareUtanGrund(db, o).lage === 'alla').length;
}

// Påminnelserna för verksamhetschefen. Inga patientuppgifter.
export function paminnelser(db, ve) {
  if (!harTabell(db) || !hanterarLakemedel(db, ve)) return [];
  const ut = [];
  const namnVe = enhetsnamn(db, ve);
  for (const typ of TYPER.filter(x => forEnhet(db, ve, x))) {
    const t = UPPDRAG[typ];
    const g = gallande(db, ve, typ);
    const delar = t.reserv ? [false, true] : [false];
    for (const reserv of delar) {
      if (g.some(u => !t.reserv || Boolean(u.reserv) === reserv)) continue;
      const forra = senaste(db, ve, typ, reserv);
      const namn = namnFor(typ, reserv);
      const slut = forra ? (forra.avslutat ? addDagar(forra.avslutat, -1) : forra.till) : null;
      ut.push({ typ: 'saknas', uppdragTyp: typ, reserv, namn,
        text: `${namn} saknas på ${namnVe}.${forra ? ` Uppdraget som ${personRad(db, forra.personal_id)?.namn ?? 'den förra'} hade gällde till ${datumText(slut)}.` : ''} ${t.utan}`, forslag: forslag(db, ve, typ, reserv) });
    }
    for (const u of g) {
      const om = dagarTill(u.till);
      if (om > GAR_UT_DAGAR) continue;
      // Ett nytt uppdrag för samma person som tar vid räcker.
      if (db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? AND typ = ? AND personal_id = ? AND reserv = ? AND fran > ? AND id <> ?').all(ve, typ, u.personal_id, u.reserv, u.fran, u.id).some(x => !x.avslutat)) continue;
      const p = personRad(db, u.personal_id);
      ut.push({ typ: 'gar_ut', uppdragTyp: typ, reserv: Boolean(u.reserv), uppdragId: u.id, namn: namnFor(typ, u.reserv),
        text: `Uppdraget som ${namnFor(typ, u.reserv).toLowerCase()} för ${p?.namn} går ut ${om === 0 ? 'i dag' : `om ${om} ${om === 1 ? 'dag' : 'dagar'}`}, ${datumText(u.till)}. Förnya det eller utse någon annan.`,
        forslag: { ...forslag(db, ve, typ, Boolean(u.reserv)), personalId: u.personal_id, kandidater: [{ id: p.id, namn: p.namn, titel: p.titel, varfor: `${p.namn} har uppdraget till ${datumText(u.till)}.` }], fran: addDagar(u.till, 1), till: addDagar(u.till, 1 + ARS_DAGAR) } });
    }
  }
  const d = ansvarsdokument(db, ve);
  if (d.forfallet) {
    ut.push({ typ: 'oversyn', namn: 'Ansvarsdokumentet', text: `Ansvarsdokumentet för läkemedelshanteringen har inte setts över sedan ${datumText(d.senast?.datum ?? idag())}. Det ska revideras vid förändringar och minst en gång per år (Gröna häftet 1.3).` });
  }
  const alla = avbokadeTillAlla(db, ve);
  if (alla) {
    ut.push({ typ: 'avbokad_till_alla', namn: 'Avbokade vårdhändelser', antal: alla,
      text: `${alla === 1 ? 'En läkemedelsdos väntar' : `${alla} läkemedelsdoser väntar`} på en vårdhändelse som avbokades när en remiss avvisades, och den läkare som ordinerade finns inte längre på vårdenheten. Eftersom ingen medicinskt ansvarig läkare är utsedd har beslutet gått till alla läkare på vårdenheten.` });
  }
  return ut;
}

// GET /api/lakemedelsansvar. Verksamhetschefen ser och ändrar uppdragen och påminnelserna. Personal på vårdenheten ser
// vem som har vilket uppdrag, så att de vet vem de ska vända sig till.
export function oversikt(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const e = db.query('SELECT typ FROM enheter WHERE id = ?').get(ve);
  if (!harTabell(db) || e?.typ !== 'vardenhet' || !['lakare', 'sjukskoterska', 'farmaceut', 'verksamhetschef'].includes(personal.yrke)) {
    loggaUtan(db, personal, 'lakemedelsuppdrag', 'nekad');
    throw new Fel(403, 'Uppdragen i läkemedelshanteringen gäller en vårdenhet, och din roll har ingen sådan.', 'nekad');
  }
  const chef = chefFor(db, personal) === ve;
  const vc = verksamhetschefFor(db, ve);
  const alla = db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? ORDER BY fran DESC, id DESC').all(ve);
  loggaUtan(db, personal, 'lakemedelsuppdrag', 'tillaten', 'lakemedelsansvar');
  return {
    vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, verksamhetschef: vc ? { id: vc.id, namn: vc.namn } : null, kanAndra: chef, ledningsansvar: LEDNINGSANSVAR,
    uppdrag: TYPER.filter(x => forEnhet(db, ve, x)).map(typ => {
      const t = UPPDRAG[typ];
      const g = gallande(db, ve, typ);
      const rader = alla.filter(u => u.typ === typ);
      const kommande = rader.filter(u => u.fran > idag() && !u.avslutat);
      const visade = new Set([...g, ...kommande].map(u => u.id));
      return {
        typ, namn: t.namn, kalla: t.kalla, utsesAv: t.utsesAv, reserv: Boolean(t.reserv), omfattning: OMFATTNING[typ],
        gallande: g.map(u => uppdragUt(db, u)), kommande: kommande.map(u => uppdragUt(db, u)),
        tidigare: chef ? rader.filter(u => !visade.has(u.id)).slice(0, 5).map(u => uppdragUt(db, u)) : [],
        saknas: t.reserv ? [false, true].filter(r => !g.some(u => Boolean(u.reserv) === r)) : (g.length ? [] : [false]),
        forslag: chef ? (t.reserv ? [false, true] : [false]).map(r => forslag(db, ve, typ, r)) : [],
      };
    }),
    ansvarsdokument: ansvarsdokument(db, ve), paminnelser: chef ? paminnelser(db, ve) : [], anmarkning: DEMO_ANSVAR,
  };
}

function kravChef(db, personal, resurs) {
  const ve = chefFor(db, personal);
  if (!ve) {
    loggaUtan(db, personal, resurs, 'nekad');
    throw new Fel(403, 'Uppdragen i läkemedelshanteringen utses och avslutas av vårdenhetens verksamhetschef (Gröna häftet 1.3).', 'nekad');
  }
  return ve;
}

// POST /api/lakemedelsansvar/uppdrag { typ, personalId, reserv?, fran?, till?, tillagg? }. Perioden är förifylld med
// ett år från i dag, och omfattningen skrivs in ur häftet. Ett nytt uppdrag som medicinskt ansvarig läkare avslutar
// det förra från samma dag, eftersom vårdenheten har en sådan läkare.
export function utse(db, personal, inp = {}) {
  const ve = kravChef(db, personal, 'lakemedelsuppdrag:ny');
  if (['verksamhetschef', 'ledningsansvar'].includes(inp.typ)) throw new Fel(400, LEDNINGSANSVAR, 'ogiltig', { falt: ['typ'] });
  const t = Object.hasOwn(UPPDRAG, inp.typ ?? '') && forEnhet(db, ve, inp.typ) ? UPPDRAG[inp.typ] : null;
  if (!t) throw new Fel(400, `Välj ett av uppdragen: ${TYPER.filter(x => forEnhet(db, ve, x)).map(x => UPPDRAG[x].namn.toLowerCase()).join(', ')}.`, 'ogiltig', { falt: ['typ'] });
  const reserv = Boolean(t.reserv && inp.reserv === true);
  const fran = inp.fran == null || inp.fran === '' ? idag() : inp.fran;
  if (!giltigtDatum(fran) || fran < idag() || fran > addDagar(idag(), 90)) throw new Fel(400, 'Uppdraget börjar i dag eller inom 90 dagar.', 'ogiltig', { falt: ['fran'] });
  const till = inp.till == null || inp.till === '' ? addDagar(fran, ARS_DAGAR) : inp.till;
  if (!giltigtDatum(till) || till <= fran || till > addDagar(fran, 3 * ARS_DAGAR)) throw new Fel(400, 'Uppdraget slutar efter att det har börjat och gäller högst tre år. Ett år föreslås, så att det följer genomgången av ansvarsdokumentet.', 'ogiltig', { falt: ['till'] });
  const p = typeof inp.personalId === 'string' ? personRad(db, inp.personalId) : null;
  const h = hinder(db, ve, inp.typ, p, reserv, fran, till);
  if (h) throw new Fel(400, h, 'ogiltig', { falt: ['personalId'] });
  const omfattning = [...OMFATTNING[inp.typ], ...(text(inp.tillagg) ? [`Dessutom: ${text(inp.tillagg)}`] : [])];
  const ersatta = [];
  let id;
  db.transaction(() => {
    if (t.ensam) {
      for (const u of db.query('SELECT * FROM lakemedelsuppdrag WHERE enhet_id = ? AND typ = ? AND avslutat IS NULL AND till >= ?').all(ve, inp.typ, fran)) {
        db.query('UPDATE lakemedelsuppdrag SET avslutat = ?, avslutat_av = ?, avslutat_tid = ?, avslutat_orsak = ? WHERE id = ?')
          .run(u.fran > fran ? u.fran : fran, personal.id, iso(), `Ersattes av ${p.namn} från ${fran}.`, u.id);
        ersatta.push(u.id);
        loggaUtan(db, personal, `lakemedelsuppdrag:${u.id}:avslutat`);
      }
    }
    id = Number(db.query('INSERT INTO lakemedelsuppdrag (typ, enhet_id, personal_id, reserv, omfattning, fran, till, satt_av, satt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(inp.typ, ve, p.id, reserv ? 1 : 0, JSON.stringify(omfattning), fran, till, personal.id, iso()).lastInsertRowid);
    loggaUtan(db, personal, `lakemedelsuppdrag:${id}`);
  })();
  return { uppdrag: uppdragUt(db, db.query('SELECT * FROM lakemedelsuppdrag WHERE id = ?').get(id)), ersatta };
}

// POST /api/lakemedelsansvar/uppdrag/:id/avsluta { orsak }. Uppdraget gäller inte från i dag, och raden finns kvar.
export function avsluta(db, personal, id, inp = {}) {
  const ve = kravChef(db, personal, `lakemedelsuppdrag:${id}:avsluta`);
  const u = db.query('SELECT * FROM lakemedelsuppdrag WHERE id = ?').get(Number(id));
  if (!u || u.enhet_id !== ve) {
    loggaUtan(db, personal, `lakemedelsuppdrag:${id}:avsluta`, 'nekad');
    throw new Fel(404, 'Uppdraget finns inte på din vårdenhet.', 'saknas');
  }
  if (u.avslutat || u.till < idag()) throw new Fel(400, 'Uppdraget är redan avslutat.', 'ogiltig');
  const orsak = text(inp.orsak);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför uppdraget avslutas.', 'ogiltig', { falt: ['orsak'] });
  db.query('UPDATE lakemedelsuppdrag SET avslutat = ?, avslutat_av = ?, avslutat_tid = ?, avslutat_orsak = ? WHERE id = ?').run(u.fran > idag() ? u.fran : idag(), personal.id, iso(), orsak, u.id);
  loggaUtan(db, personal, `lakemedelsuppdrag:${u.id}:avslutat`);
  return { uppdrag: uppdragUt(db, db.query('SELECT * FROM lakemedelsuppdrag WHERE id = ?').get(u.id)) };
}

// POST /api/lakemedelsansvar/oversyn { anteckning? }. Verksamhetschefen har gått igenom ansvarsdokumentet.
export function oversyn(db, personal, inp = {}) {
  const ve = kravChef(db, personal, 'ansvarsdokument:oversyn');
  const r = db.query('INSERT INTO ansvarsdokument_oversyn (enhet_id, personal_id, tid, anteckning) VALUES (?, ?, ?, ?)').run(ve, personal.id, iso(), text(inp.anteckning) || null);
  loggaUtan(db, personal, `ansvarsdokument:${r.lastInsertRowid}`);
  return { ansvarsdokument: ansvarsdokument(db, ve) };
}
