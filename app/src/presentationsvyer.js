// Runda 10, r2: standardiserade och anpassningsbara vyer (Sussa 3.1.2.1 till 3.1.2.4).
//
//  1. Översiktens anpassning. Patientöversikten har delar som visas i en ordning och ett tidsurval för tidslinjen.
//     Förvalet beror på situationen (mottagningsbesök, akut eller rond), som systemet väljer själv ur patientens läge på
//     användarens vårdenhet. Vårdenhetens förval, som systemförvaltningen eller verksamhetschefen sätter, går före
//     systemets, och användarens eget val för situationen går före vårdenhetens. Anpassningen visar aldrig mer än
//     behörigheten: en del som rollen inte får läsa går inte att välja, och servern lämnar inte ut den.
//  2. Uppföljningsvyn: vårdplanernas mål och avvikelser, avvikande provsvar, passerade uppföljningsdatum för läkemedel,
//     remisser med larm och samordnad planering med kommunen, med var i vårdprocessen patienten är, när, var och av vem.
//  3. Vyer utan personuppgifter: beläggningsöversikten per avdelning och utbildningsläget, som visar en journal
//     pseudonymiserad och säger vilka uppgifter som aldrig visas.
import { Fel, iso, idag, addDagar } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, alder } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';
import * as vardplan from './vardplan.js';
import * as samordnad from './samordnad.js';
import * as vitalparametrar from './vitalparametrar.js';
import { aktuelltUppfoljningsdatum } from './lakemedelsuppfoljning.js';

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const enhetKort = (db, id) => ({ id, namn: enhetsnamn(db, id) });
const personKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, titel: p.titel } : null;
};

// ---------------------------------------------------------------------------------------------------------------
// 1. Översiktens anpassning

// Delarna i översikten, med de läshandlingar som krävs. En del utan handlingar visas för alla som ser översikten.
export const OVERSIKT_DELAR = [
  { id: 'uppfoljning', text: 'Uppföljning och avvikelser', handlingar: ['las_oversikt'] },
  { id: 'r3', text: 'Tvångsvård, vårdplaner och samordnad planering', handlingar: ['las_vardplan', 'las_tvangsvard'] },
  { id: 'lakemedel', text: 'Aktuella läkemedel', handlingar: ['las_lakemedel'] },
  { id: 'diagnoser', text: 'Diagnoser', handlingar: ['las_diagnoser'] },
  { id: 'matvarden', text: 'Senaste mätvärden', handlingar: ['las_matvarden'] },
  { id: 'anteckningar', text: 'Senaste anteckningar', handlingar: ['las_journal', 'las_omvardnad'] },
  { id: 'remisser', text: 'Pågående remisser', handlingar: ['las_remiss', 'las_remiss_status'] },
  { id: 'tobak', text: 'Tobak och nikotin', handlingar: ['las_omvardnad'] },
  { id: 'levnadsvanor', text: 'Levnadsvanor', handlingar: ['las_omvardnad'] },
  { id: 'tider', text: 'Bokade tider', handlingar: null },
  { id: 'vardkontakt', text: 'Vårdkontakter och vårdtillfällen', handlingar: null },
  { id: 'ekonomi', text: 'Kostnader och avgifter', handlingar: null },
  { id: 'kontakt', text: 'Kontaktuppgifter', handlingar: null },
  { id: 'tidslinje', text: 'Tidslinje', handlingar: null },
];
const DEL = new Map(OVERSIKT_DELAR.map(d => [d.id, d]));
export const TIDSURVAL = [null, 7, 30, 90, 365];
const tidsurvalText = (n) => (n == null ? 'Hela tiden' : n === 365 ? 'Det senaste året' : `De senaste ${n} dagarna`);

// Situationerna och systemets förval för var och en.
// Systemets förval visar alla delar som rollen får läsa, i den ordning som situationen behöver, så att inget försvinner
// för den som inte har valt själv. Tvångsvården står alltid först, eftersom fristerna räknas i timmar. Användaren och vårdenheten väljer bort delar och sätter tidsurvalet.
export const SITUATIONER = {
  mottagning: { text: 'Mottagningsbesök', delar: ['r3', 'uppfoljning', 'tider', 'diagnoser', 'lakemedel', 'anteckningar', 'matvarden', 'remisser', 'tobak', 'levnadsvanor', 'vardkontakt', 'ekonomi', 'kontakt', 'tidslinje'], tidslinjeDagar: null },
  akut: { text: 'Akut', delar: ['r3', 'lakemedel', 'diagnoser', 'matvarden', 'anteckningar', 'vardkontakt', 'remisser', 'uppfoljning', 'kontakt', 'tider', 'tobak', 'levnadsvanor', 'ekonomi', 'tidslinje'], tidslinjeDagar: null },
  rond: { text: 'Rond', delar: ['r3', 'matvarden', 'lakemedel', 'uppfoljning', 'anteckningar', 'diagnoser', 'vardkontakt', 'remisser', 'tider', 'tobak', 'levnadsvanor', 'ekonomi', 'kontakt', 'tidslinje'], tidslinjeDagar: null },
};
const vyNyckel = (situation) => `oversikt.${situation}`;
export const tillgangligaDelar = (personal) => OVERSIKT_DELAR.filter(d => !d.handlingar || d.handlingar.some(h => kanRoll(personal, h)));

// Systemet väljer situationen ur patientens läge på användarens vårdenhet: en pågående akut vårdkontakt ger akut, en
// pågående inskrivning rond och annars mottagningsbesök.
export function valjSituation(atk) {
  const db = atk.db;
  const enheter = enheterUnder(db, vardenhetFor(db, atk.personal.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const pagar = (typ) => db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND typ = ? AND slut IS NULL AND start <= ? AND enhet_id IN (${ph})`).get(atk.patientId, typ, iso(), ...enheter);
  if (pagar('akut')) return { id: 'akut', varfor: 'Patienten har en pågående akut vårdkontakt på din vårdenhet.' };
  if (pagar('slutenvard')) return { id: 'rond', varfor: 'Patienten är inskriven på din vårdenhet.' };
  // Runda 13, r4: på akutmottagningen är en patient utan pågående kontakt där en akut patient som just har kommit.
  if (vardenhetFor(db, atk.personal.enhet_id) === AKUTMOTTAGNINGEN) return { id: 'akut', varfor: 'Du arbetar på akutmottagningen, och patienten har ingen pågående vårdkontakt där än.' };
  return { id: 'mottagning', varfor: 'Patienten är inte inskriven och har ingen pågående akut vårdkontakt på din vårdenhet.' };
}

// Runda 13, r4: mallarna som en ny anteckning förväljer, i ordning, efter situationen: akutanteckning på akuten,
// daganteckning för en inskriven patient och mottagningsanteckning annars. Omvårdnadsanteckningen för den som skriver
// omvårdnad. Gränssnittet väljer den första som användaren får skriva.
export const ANTECKNINGSMALLAR = { akut: ['Akutanteckning', 'Omvårdnadsanteckning'], rond: ['Daganteckning', 'Omvårdnadsanteckning'], mottagning: ['Mottagningsanteckning', 'Omvårdnadsanteckning'] };
export const anteckningsmallar = (atk) => ANTECKNINGSMALLAR[valjSituation(atk).id];
const AKUTMOTTAGNINGEN = 'uso-akut';

// Kontrollerar en inställning. Med personal prövas delarna mot rollen; utan (vårdenhetens förval) mot alla delar.
function provaInstallning(inst, personal = null) {
  const lista = inst?.delar;
  const tillatna = new Set((personal ? tillgangligaDelar(personal) : OVERSIKT_DELAR).map(d => d.id));
  if (!Array.isArray(lista) || !lista.length || lista.length > OVERSIKT_DELAR.length || new Set(lista).size !== lista.length || lista.some(x => typeof x !== 'string' || !DEL.has(x))) {
    throw new Fel(400, 'Välj minst en av översiktens delar, varje del en gång.', 'ogiltig', { falt: ['delar'] });
  }
  const ej = lista.filter(x => !tillatna.has(x));
  if (ej.length) throw new Fel(400, `${ej.map(x => DEL.get(x).text).join(', ')} ingår inte i det din yrkesroll får läsa och kan inte väljas.`, 'ogiltig', { falt: ['delar'] });
  const dagar = inst.tidslinjeDagar ?? null;
  if (!TIDSURVAL.includes(dagar)) throw new Fel(400, 'Välj tidsurvalet för tidslinjen: hela tiden, 7, 30, 90 eller 365 dagar.', 'ogiltig', { falt: ['tidslinjeDagar'] });
  return { delar: [...lista], tidslinjeDagar: dagar };
}
const lasSituation = (s) => {
  if (!Object.hasOwn(SITUATIONER, s ?? '')) throw new Fel(400, 'Situationen kan vara mottagningsbesök, akut eller rond.', 'ogiltig', { falt: ['situation'] });
  return s;
};
const vardenhetsForval = (db, ve, vy) => {
  try { const r = db.query('SELECT * FROM vyforval_vardenhet WHERE vardenhet_id = ? AND vy = ?').get(ve, vy); return r ? { ...JSON.parse(r.data), andrad: r.andrad, andradAv: personKort(db, r.andrad_av) } : null; } catch { return null; }
};

// Vyn för en situation: vad som gäller och varifrån det kommer. Delar som rollen inte får läsa tas alltid bort.
export function oversiktsvy(db, personal, situation) {
  const s = lasSituation(situation);
  const tillatna = new Set(tillgangligaDelar(personal).map(d => d.id));
  const rensa = (inst) => ({ delar: inst.delar.filter(x => tillatna.has(x)), tidslinjeDagar: inst.tidslinjeDagar ?? null });
  const sys = rensa(SITUATIONER[s]);
  const ve = vardenhetFor(db, personal.enhet_id);
  const fv = vardenhetsForval(db, ve, vyNyckel(s));
  const egen = db.query('SELECT data FROM vyinstallningar WHERE personal_id = ? AND vy = ?').get(personal.id, vyNyckel(s));
  let installning = fv ? rensa(fv) : sys;
  let kalla = fv ? 'vardenhet' : 'system';
  if (egen) { try { installning = provaInstallning(JSON.parse(egen.data), personal); kalla = 'egen'; } catch { /* en sparad vy som inte längre gäller ersätts av förvalet */ } }
  if (!installning.delar.length) { installning = sys; kalla = 'system'; }
  const forval = fv ? rensa(fv) : sys;
  return {
    situation: s, situationText: SITUATIONER[s].text, installning, kalla,
    kallaText: { egen: 'Ditt eget val för situationen', vardenhet: `Förvalet för ${enhetsnamn(db, ve)}`, system: 'Systemets förval för situationen' }[kalla],
    forval, forvalKalla: fv ? 'vardenhet' : 'system',
    alternativ: { delar: tillgangligaDelar(personal).map(({ id, text }) => ({ id, text })), tidsurval: TIDSURVAL.map(n => ({ dagar: n, text: tidsurvalText(n) })), situationer: Object.entries(SITUATIONER).map(([id, x]) => ({ id, text: x.text })) },
  };
}

// Lägger vyn på översikten. Tidsurvalet gäller tidslinjen på servern, och delar som inte valts lämnas inte ut.
const DELFALT = { lakemedel: 'lakemedel', diagnoser: 'diagnoser', matvarden: 'matvarden', anteckningar: 'anteckningar', remisser: 'remisser', tobak: 'tobak', levnadsvanor: 'levnadsvanor', kontakt: 'kontakt' };
export function medVy(atk, ut, { situation = null, nu = Date.now() } = {}) {
  const val = valjSituation(atk);
  const vy = oversiktsvy(atk.db, atk.personal, situation && Object.hasOwn(SITUATIONER, situation) ? situation : val.id);
  vy.systemetsSituation = val.id;
  vy.varfor = situation && situation !== val.id ? `Du valde ${SITUATIONER[vy.situation].text.toLowerCase()}. ${val.varfor}` : val.varfor;
  const delar = new Set(vy.installning.delar);
  for (const [del, falt] of Object.entries(DELFALT)) if (!delar.has(del) && ut[falt] != null) ut[falt] = falt === 'kontakt' ? {} : null;
  if (!delar.has('tidslinje')) ut.tidslinje = [];
  else if (vy.installning.tidslinjeDagar != null) {
    const grans = new Date(nu - vy.installning.tidslinjeDagar * 86400_000).toISOString();
    const fore = ut.tidslinje.length;
    ut.tidslinje = ut.tidslinje.filter(t => String(t.tid) >= grans);
    vy.tidslinjeUtanfor = fore - ut.tidslinje.length;
  }
  if (delar.has('uppfoljning') && kanRoll(atk.personal, 'las_oversikt')) {
    const u = uppfoljningsvy(atk, {});
    ut.uppfoljning = { antal: u.antal, avvikelser: u.rader.filter(r => r.avvikelse).length, lage: u.lage };
  }
  ut.vy = vy;
  return ut;
}

export function sparaOversiktsvy(db, personal, situation, body = {}) {
  if (!kanRoll(personal, 'las_oversikt') && !kanRoll(personal, 'las_admin')) throw new Fel(403, 'Din yrkesroll ser inte patientöversikten.', 'nekad');
  const s = lasSituation(situation);
  const inst = provaInstallning(body.installning, personal);
  db.query('INSERT OR REPLACE INTO vyinstallningar (personal_id, vy, data, andrad) VALUES (?, ?, ?, ?)').run(personal.id, vyNyckel(s), JSON.stringify(inst), iso());
  return oversiktsvy(db, personal, s);
}
export function aterstallOversiktsvy(db, personal, situation) {
  const s = lasSituation(situation);
  db.query('DELETE FROM vyinstallningar WHERE personal_id = ? AND vy = ?').run(personal.id, vyNyckel(s));
  return oversiktsvy(db, personal, s);
}

// Vårdenhetens förval. Systemförvaltningen sätter det för alla vårdenheter, verksamhetschefen för sin egen. Det gäller
// översikten per situation och Dagens arbete. Förvalet ändrar bara vad som visas och i vilken ordning, aldrig vad någon
// får se, och därför krävs inte fyra ögon som för reglerna i konfiguration.js.
export const FORVALSVYER = { ...Object.fromEntries(Object.keys(SITUATIONER).map(s => [vyNyckel(s), `Översikten vid ${SITUATIONER[s].text.toLowerCase()}`])), idag: 'Dagens arbete' };
const IDAG_SEKTIONER = ['dagens', 'remisser', 'vantelista', 'kallelser', 'bevakningar'];
function kravForval(db, personal, vardenhetId = null) {
  if (!kanRoll(personal, 'vyforval')) throw new Fel(403, 'Bara systemförvaltningen och verksamhetschefen sätter vårdenhetens förval.', 'nekad');
  if (vardenhetId == null) return null;
  const e = db.query("SELECT id FROM enheter WHERE id = ? AND typ = 'vardenhet'").get(String(vardenhetId));
  if (!e) throw new Fel(400, 'Välj en vårdenhet.', 'ogiltig', { falt: ['vardenhetId'] });
  if (personal.yrke === 'verksamhetschef' && vardenhetFor(db, personal.enhet_id) !== e.id) throw new Fel(403, 'Verksamhetschefen sätter förvalet för sin egen vårdenhet.', 'nekad');
  return e.id;
}
export function forvalsLista(db, personal) {
  kravForval(db, personal);
  const egen = personal.yrke === 'verksamhetschef' ? vardenhetFor(db, personal.enhet_id) : null;
  const vardenheter = db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all().filter(e => !egen || e.id === egen);
  const rader = db.query('SELECT * FROM vyforval_vardenhet ORDER BY vardenhet_id, vy').all().filter(r => !egen || r.vardenhet_id === egen)
    .map(r => ({ vardenhet: enhetKort(db, r.vardenhet_id), vy: r.vy, vyText: FORVALSVYER[r.vy] ?? r.vy, installning: JSON.parse(r.data), andrad: r.andrad, andradAv: personKort(db, r.andrad_av) }));
  return { vardenheter, vyer: Object.entries(FORVALSVYER).map(([id, text]) => ({ id, text })), delar: OVERSIKT_DELAR.map(({ id, text }) => ({ id, text })), sektioner: IDAG_SEKTIONER, forval: rader, systemets: SITUATIONER };
}
export function sattForval(db, personal, { vardenhetId, vy, installning } = {}) {
  const ve = kravForval(db, personal, vardenhetId);
  if (!Object.hasOwn(FORVALSVYER, vy ?? '')) throw new Fel(400, 'Välj vyn som förvalet gäller.', 'ogiltig', { falt: ['vy'] });
  let inst;
  if (vy === 'idag') {
    const s = installning?.sektioner;
    if (!Array.isArray(s) || !s.length || s.some(x => !IDAG_SEKTIONER.includes(x)) || new Set(s).size !== s.length) throw new Fel(400, 'Välj minst en av delarna i Dagens arbete.', 'ogiltig', { falt: ['sektioner'] });
    inst = { sektioner: IDAG_SEKTIONER.filter(x => s.includes(x)) };
  } else inst = provaInstallning(installning);
  db.query('INSERT OR REPLACE INTO vyforval_vardenhet (vardenhet_id, vy, data, andrad, andrad_av) VALUES (?, ?, ?, ?, ?)').run(ve, vy, JSON.stringify(inst), iso(), personal.id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'vyforval', resurs: `vyforval:${ve}:${vy}`, grund: 'administrativ', resultat: 'tillaten' });
  return forvalsLista(db, personal);
}
export function taBortForval(db, personal, { vardenhetId, vy } = {}) {
  const ve = kravForval(db, personal, vardenhetId);
  db.query('DELETE FROM vyforval_vardenhet WHERE vardenhet_id = ? AND vy = ?').run(ve, String(vy ?? ''));
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'vyforval', resurs: `vyforval:${ve}:${vy}:borttaget`, grund: 'administrativ', resultat: 'tillaten' });
  return forvalsLista(db, personal);
}
// Vårdenhetens förval för en vy som planering.js har (Dagens arbete), eller null.
export const forvalFor = (db, personal, vy) => vardenhetsForval(db, vardenhetFor(db, personal.enhet_id), vy);

// ---------------------------------------------------------------------------------------------------------------
// 2. Uppföljningsvyn

export const UPPFOLJNING_TYPER = {
  lage: 'Var i vårdprocessen', mal: 'Mål i vårdplaner', avvikelse: 'Avvikelser i vårdplaner', provsvar: 'Avvikande provsvar och mätvärden',
  lakemedel: 'Läkemedelsuppföljning', remiss: 'Remisser', samordning: 'Samordnad planering med kommunen',
};

// Allt byggs av det som användaren redan får se: samma funktioner och samma Atkomst som de vanliga anropen.
export function uppfoljningsvy(atk, { typ = null } = {}) {
  atk.krav('las_oversikt');
  if (typ && !Object.hasOwn(UPPFOLJNING_TYPER, typ)) throw new Fel(400, 'Filtret finns inte.', 'ogiltig', { falt: ['typ'] });
  const db = atk.db;
  const pers = atk.personal;
  const rader = [];
  const rad = (r) => rader.push({ avvikelse: false, av: null, ...r });

  // Var i vårdprocessen: pågående vårdtillfälle eller vårdkontakt, och nästa planerade steg.
  const vk = journal.synligaVardkontakter(atk);
  const pagar = vk.filter(v => v.slut == null && Date.parse(v.start) <= Date.now()).sort((a, b) => (a.typ === 'slutenvard' ? -1 : 0) - (b.typ === 'slutenvard' ? -1 : 0));
  const planerad = vk.filter(v => v.slut == null && Date.parse(v.start) > Date.now()).sort((a, b) => a.start.localeCompare(b.start))[0];
  const lage = pagar[0]
    ? { steg: pagar[0].typ === 'slutenvard' ? 'inskriven' : 'pagaende', text: `${pagar[0].typ === 'slutenvard' ? 'Inskriven' : 'Pågående vårdkontakt'} på ${enhetsnamn(db, pagar[0].enhet_id)} sedan ${pagar[0].start.slice(0, 10)}${pagar[0].orsak ? `: ${pagar[0].orsak}` : ''}.`, enhet: enhetKort(db, pagar[0].enhet_id), tid: pagar[0].start }
    : planerad ? { steg: 'planerad', text: `Nästa planerade vårdkontakt ${planerad.start.slice(0, 10)} på ${enhetsnamn(db, planerad.enhet_id)}.`, enhet: enhetKort(db, planerad.enhet_id), tid: planerad.start }
      : { steg: 'ingen', text: 'Ingen pågående eller planerad vårdkontakt som du ser.', enhet: null, tid: null };
  rad({ typ: 'lage', tid: lage.tid, rubrik: 'Var i vårdprocessen', text: lage.text, enhet: lage.enhet });

  // Vårdplanernas mål och avvikelser.
  if (kanRoll(pers, 'las_vardplan')) {
    for (const p of vardplan.synligaPlaner(atk).filter(x => x.status !== 'avslutad').map(x => vardplan.planUt(atk, x))) {
      for (const m of p.mal) rad({ typ: 'mal', tid: p.skapad, rubrik: `${p.rubrik}: ${m.text}`, text: `${m.statusText}. Uppföljning ${p.uppfoljning}.`, enhet: p.enhet, av: p.skapadAv, avvikelse: m.status === 'ej_uppnatt' });
      for (const a of p.avvikelser) rad({ typ: 'avvikelse', tid: p.uppfoljning, rubrik: p.rubrik, text: a.text, enhet: p.enhet, av: p.skapadAv, avvikelse: true });
    }
  }
  // Avvikande provsvar och mätvärden: de senaste värdena utanför referensintervallet per typ.
  if (kanRoll(pers, 'las_matvarden')) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
    const mv = journal.synligaMatvarden(atk);
    const perId = new Map(mv.map(m => [m.id, m]));
    for (const k of vitalparametrar.kurvor(atk, p, mv)) {
      for (const pt of k.punkter.filter(x => x.utanfor).slice(-3)) {
        const m = perId.get(pt.id);
        rad({ typ: 'provsvar', tid: pt.tid, rubrik: k.namn, text: `${pt.varden.join('/')} ${k.enhet}, ${k.referens?.hog != null && pt.varden[0] > k.referens.hog ? 'över' : 'under'} referensintervallet.`.replace(' ,', ','),
          enhet: enhetKort(db, m.enhet_id), av: personKort(db, m.registrerad_av), avvikelse: true, ref: { flik: 'matvarden', sub: k.typ } });
      }
    }
  }
  // Läkemedel vars uppföljningsdatum har passerat.
  if (kanRoll(pers, 'las_lakemedel')) {
    for (const o of lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell)) {
      const datum = aktuelltUppfoljningsdatum(db, o);
      const namn = db.query('SELECT namn FROM katalog WHERE id = ?').get(o.lakemedel_id)?.namn ?? 'Läkemedel';
      const passerad = datum < idag();
      if (!passerad && datum > addDagar(idag(), 14)) continue;
      rad({ typ: 'lakemedel', tid: datum, rubrik: namn, text: passerad ? `Uppföljningen skulle ha gjorts ${datum}. Orsak: ${o.orsak}.` : `Följs upp ${datum}. Orsak: ${o.orsak}.`,
        enhet: enhetKort(db, o.enhet_id), av: personKort(db, o.ordinerad_av), avvikelse: passerad, ref: { flik: 'lakemedel', sub: null } });
    }
  }
  // Remisser med larm.
  if (kanRoll(pers, 'las_remiss') || kanRoll(pers, 'las_remiss_status')) {
    for (const r of remiss.forPatient(atk).remisser.filter(x => x.status !== 'svar_kvitterat' && x.beslut !== 'avvisad')) {
      rad({ typ: 'remiss', tid: r.tider.skickad, rubrik: `Remiss från ${r.fran.namn} till ${r.till.namn}`, text: r.larm?.length ? r.larm.map(l => l.text).join(' ') : `Status: ${r.status.replace('_', ' ')}. Svar senast ${r.svarSenast}.`,
        enhet: r.fran, av: r.avsandare, avvikelse: Boolean(r.larm?.length), ref: { flik: 'remisser', sub: null } });
    }
  }
  // Samordnad planering med kommunen: vården mellan vårdgivare.
  if (kanRoll(pers, 'samordna') || kanRoll(pers, 'las_vardplan')) {
    for (const s of samordnad.forPatient(atk).samordningar.filter(x => x.status !== 'avslutad')) {
      const frist = s.frister?.find(f => f.status !== 'uppfylld');
      rad({ typ: 'samordning', tid: s.skapad, rubrik: s.typText, text: `${frist ? `Nästa frist: ${frist.rubrik}, senast ${String(frist.senast).slice(0, 10)}.` : 'Alla frister är uppfyllda.'}${s.beraknad ? ` Beräknad utskrivning ${s.beraknad}.` : ''} Kommunen är en simulerad part.`, enhet: s.enhet ?? null, av: s.skapadAv ?? null,
        avvikelse: frist?.status === 'passerad' });
    }
  }
  rader.sort((a, b) => Number(b.avvikelse) - Number(a.avvikelse) || String(b.tid ?? '').localeCompare(String(a.tid ?? '')));
  const filter = Object.entries(UPPFOLJNING_TYPER).map(([id, text]) => ({ id, text, antal: rader.filter(r => r.typ === id).length })).filter(f => f.antal);
  const valda = typ ? rader.filter(r => r.typ === typ) : rader;
  return { lage, antal: valda.length, rader: valda, filter, typer: UPPFOLJNING_TYPER, dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr } };
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Vyer utan personuppgifter

// Vårdplatser per avdelning i demon. Hjärtintensiven har sina platser i iva.js. En demoregel.
export const VARDPLATSER = { 'uso-kard-72': 24, 'uso-kard-hia': 8, 'uso-med': 28, 'uso-inf': 12, 'uso-ort': 20, 'uso-psyk': 16 };
const STANDARD_PLATSER = 20;

// Beläggningsöversikten: per avdelning platser, belagda, lediga, inskrivna och utskrivna i dag och patienter på
// permission. Bara antal, aldrig namn, personnummer, sal eller säng per patient. Vårdenhetens personal ser sina
// avdelningar och uppföljningen alla.
export function belaggning(db, personal, nu = new Date()) {
  const region = kanRoll(personal, 'statistik_region');
  if (!region && !kanRoll(personal, 'las_admin') && !kanRoll(personal, 'statistik')) throw new Fel(403, 'Din yrkesroll ser inte beläggningen.', 'nekad');
  const enheter = region ? null : enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const dagStart = new Date(`${idag()}T00:00:00`).toISOString();
  const rader = db.query("SELECT enhet_id, start, slut, coalesce(planerad, 0) AS planerad FROM vardkontakter WHERE typ = 'slutenvard'").all().filter(r => !enheter || enheter.includes(r.enhet_id));
  const avd = [...new Set(rader.map(r => r.enhet_id))].sort();
  const t = nu.toISOString();
  const lista = avd.map(id => {
    const pa = rader.filter(r => r.enhet_id === id);
    const belagda = pa.filter(r => !r.planerad && r.start <= t && (r.slut == null || r.slut > t)).length;
    const platser = VARDPLATSER[id] ?? STANDARD_PLATSER;
    return {
      avdelning: enhetKort(db, id), vardenhet: enhetKort(db, vardenhetFor(db, id)), platser, belagda, lediga: Math.max(0, platser - belagda), overbelagda: Math.max(0, belagda - platser),
      inskrivnaIdag: pa.filter(r => r.start >= dagStart && r.start <= t).length, utskrivnaIdag: pa.filter(r => r.slut && r.slut >= dagStart && r.slut <= t).length,
      planeradeInskrivningar: pa.filter(r => r.planerad || r.start > t).filter(r => r.slut == null).length,
      belaggningProcent: Math.round(belagda / platser * 1000) / 10,
    };
  });
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: region ? 'statistik_region' : 'las_admin', resurs: 'belaggning', grund: region ? 'uppfoljning' : 'administrativ', resultat: 'tillaten' });
  return {
    tid: t, avdelningar: lista, totalt: { platser: lista.reduce((s, a) => s + a.platser, 0), belagda: lista.reduce((s, a) => s + a.belagda, 0) },
    visasAldrig: ['Namn', 'Personnummer och andra identiteter', 'Sal och säng per patient', 'Diagnoser, orsak till vård och annan journalinformation'],
    demoregel: 'Antalet vårdplatser per avdelning är en demoregel. Beläggningen räknas ur de pågående vårdkontakterna i slutenvård.',
  };
}

// Utbildningsläget: patientens journal pseudonymiserad, för undervisning och handledning. Samma behörighet och samma
// filter som journalen, så att inget visas som användaren inte redan får se, och åtkomsten loggas med syftet
// utbildning. En patient med skyddade personuppgifter visas aldrig i utbildningsläget.
export const UTBILDNING_VISAS_ALDRIG = [
  'Patientens namn, personnummer och andra identiteter', 'Adress, telefon och kontaktperson', 'Exakta datum och klockslag: tiden visas som dag i förhållande till den senaste uppgiften',
  'Personalens namn: yrkesrollen visas i stället', 'Patientens och personalens namn och patientens personnummer i fritext, som byts mot en markering',
];
export const UTBILDNING_BEGRANSNINGAR = 'Fritext kan ändå innehålla uppgifter som pekar ut patienten, till exempel en närståendes namn som inte är registrerat, ett yrke eller en ovanlig händelse. Ålder visas i femårsgrupp och vårdenhetens namn visas. Använd utbildningsläget för undervisning inom vården och lämna inte ut skärmbilder.';
export function utbildningsvy(atk, p) {
  atk.krav('las_oversikt');
  if (p.skyddad) {
    atk.logga('las_oversikt', 'nekad', 'utbildningsvy', 'nekad');
    throw new Fel(403, 'En patient med skyddade personuppgifter visas aldrig i utbildningsläget.', 'nekad');
  }
  const db = atk.db;
  const pers = atk.personal;
  const staff = db.query('SELECT namn FROM personal').all().map(x => x.namn).filter(Boolean);
  const personalOrd = [...new Set(staff.flatMap(n => n.split(/\s+/)).filter(w => w.length >= 3 && /^\p{Lu}/u.test(w)))];
  const pnr = String(p.personnummer ?? '');
  const ord = [p.fornamn, p.efternamn, p.adress, p.telefon, ...(String(p.kontaktperson ?? '').match(/[A-ZÅÄÖ][a-zåäöé]+/g) ?? [])].filter(x => x && x.length >= 2);
  const tvatta = (text) => {
    let s = String(text ?? '');
    for (const n of staff) s = s.split(n).join('[personal]');
    // Också för- och efternamn var för sig, så att ett förnamn i texten inte blir kvar.
    for (const w of personalOrd) s = s.replace(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu'), '[personal]');
    for (const x of [pnr, pnr.length === 12 ? `${pnr.slice(0, 8)}-${pnr.slice(8)}` : null, pnr.length === 12 ? `${pnr.slice(2, 8)}-${pnr.slice(8)}` : null].filter(Boolean)) s = s.split(x).join('[personnummer]');
    for (const w of ord) s = s.replace(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'), '[namn]');
    return s;
  };
  const yrke = (id) => db.query('SELECT titel, yrke FROM personal WHERE id = ?').get(id)?.titel?.replace(/\s*\(.*\)$/, '') ?? null;
  const tider = [];
  const dia = kanRoll(pers, 'las_diagnoser') ? journal.synligaDiagnoser(atk).map(d => ({ tid: d.datum, kod: d.kod, text: d.text, enhet: enhetsnamn(db, d.enhet_id) })) : null;
  const lm = kanRoll(pers, 'las_lakemedel') ? lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell).map(o => { const u = lakemedel.ordinationUt(db, o, { historik: false }); return { tid: o.start, namn: `${u.lakemedel?.namn ?? ''} ${u.lakemedel?.styrka ?? ''}`.trim(), dosering: u.dosering, orsak: tvatta(u.ordinationsorsak), enhet: u.vardenhet.namn }; }) : null;
  const mv = kanRoll(pers, 'las_matvarden') ? journal.senastePerTyp(journal.synligaMatvarden(atk)).map(m => { const u = journal.matvardeUt(db, m); return { tid: m.tid, namn: u.namn, varde: u.beskrivning ?? `${u.varde}${u.enhet ? ` ${u.enhet}` : ''}`, enhet: u.vardenhet.namn }; }) : null;
  const kanAnt = kanRoll(pers, 'las_journal') || kanRoll(pers, 'las_omvardnad');
  const ant = kanAnt ? journal.listaAnteckningar(atk).anteckningar.filter(a => a.status === 'signerad').slice(0, 20).map(a => {
    const r = journal.hamtaAnteckningRad(db, a.id);
    return { tid: a.signerad?.tid ?? a.skapad, typ: a.typ, skrivenAv: yrke(r.forfattare_id), enhet: a.enhet.namn, sokord: JSON.parse(r.sokord).filter(s => s.text).map(s => ({ sokord: s.sokord, text: tvatta(s.text) })) };
  }) : null;
  for (const l of [dia, lm, mv, ant]) for (const x of l ?? []) tider.push(x.tid);
  const sista = tider.filter(Boolean).sort().at(-1) ?? iso();
  const dag = (t) => (t ? Math.round((Date.parse(String(t).length > 10 ? t : `${t}T12:00:00Z`) - Date.parse(String(sista).length > 10 ? sista : `${sista}T12:00:00Z`)) / 86400_000) : null);
  const relativ = (l) => (l ? l.map(({ tid, ...x }) => ({ ...x, dag: dag(tid) })) : null);
  const a = alder(p.fodd, idag());
  atk.logga('las_oversikt', atk.grund(), 'utbildningsvy', 'tillaten', 'Utbildningsläge: journalen visad pseudonymiserad');
  return {
    patient: { pseudonym: 'Patient A', aldersgrupp: `${Math.floor(a / 5) * 5} till ${Math.floor(a / 5) * 5 + 4} år`, kon: p.kon },
    diagnoser: relativ(dia), lakemedel: relativ(lm), matvarden: relativ(mv), anteckningar: relativ(ant),
    visasAldrig: UTBILDNING_VISAS_ALDRIG, begransningar: UTBILDNING_BEGRANSNINGAR,
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}
