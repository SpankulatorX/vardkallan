// Omorganisation (runda 7, r4, Sussa 12.1.1.1 och 12.1.1.4) enligt HSA:s regler för organisationsförändringar i
// vårdgivarstrukturen (bilaga K6, Inera, version 1.0). Systemförvaltaren förbereder en förändring med ett datum: en ny
// enhet, en sammanslagning, en delning, ett namnbyte eller en nedläggning. Systemet visar i förväg allt som påverkas,
// bara med antal, och flyttar det självt den dag förändringen gäller.
//
// Reglerna ur K6 som systemet följer:
//   2.1  En vårdenhet som stängs tas aldrig bort. Den får ett slutdatum och arkiveras, eftersom spärrar, loggar och
//        journaluppgifter pekar på den.
//   2.3  Uppgifterna hör till den vårdenhet där de upprättades och kodas inte om. För efterföljarens personal är de en
//        annan vårdenhets uppgifter, som visas efter ett aktivt val. Bara vårdrelationen följer med (atkomst.js,
//        foregangare), så att patienter som nyss har vårdats på den gamla enheten kan fortsätta vårdas.
//   2.4  En spärr är patientens beslut och ändras aldrig av en omorganisation. Spärren mot den gamla vårdenhetens
//        uppgifter gäller som förut, också för efterföljarens personal, och sätts inte på någon ny vårdenhet. Vid ett
//        namnbyte är det samma enhet med samma id, så spärren gäller enheten som förut. Systemförvaltaren får veta hur
//        många patienter som behöver tillfrågas om spärren ska gälla också den nya enheten.
//   3.12 En vårdenhet kan inte flyttas till en annan vårdgivare. Mottagaren och de nya enheterna ska höra till samma
//        vårdgivare, annars avvisas förändringen.
// En omorganisation som ändrar vem som har åtkomst (sammanslagning, delning och nedläggning) genomförs först när en
// annan systemförvaltare har godkänt den (fyra ögon, också som en kontroll i databasen).
//   2.5  Personalens behörigheter flyttas till efterföljaren. Uppdrag i läkemedelshanteringen och delegeringar gäller
//        vårdenheten och avslutas, så att verksamhetschefen och den som delegerar beslutar på nytt.
//   3.4  Det som har loggats och dokumenterats före förändringen hör till den gamla enheten, det som görs efter till den
//        nya.
//   3.8  Ett nytt namn får inte vara samma som en annan öppen enhets namn.
//   3.10, 3.11 och 3.3  Sammanslagning och delning ger nya vårdenheter med nya HSA-id, och de gamla stängs. En
//        arbetsplats (avdelning, mottagning) får en ny motsvarighet under den nya vårdenheten.
// Namnbyte behåller HSA-id. Det tidigare namnet sparas, och det som skrevs före bytet visas med det namn enheten hade då.
//
// Det som flyttas på dagen är bara det som pågår eller ligger framåt: pågående vårdkontakter (avslutas på den gamla
// enheten och fortsätter på den nya, som vid en flytt), bokade tider, väntelistan, remisser som inte är avslutade,
// bevakningar, listning, personalen och tidbokens scheman framåt. Varje flytt sparas med värdet före och efter
// (omorganisation_flyttar). Inget som har hänt skrivs om.
import { Fel, iso, addDagar, giltigtDatum, datumAv, lokalTid } from './db.js';
import { kanRoll, vardenhetFor, harVardrelation, glomForegangare, foregangare, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';

export const TYPER = {
  namnbyte: { text: 'Namnbyte', k6: 'Namnbyte inom samma vårdenhet påverkar inte behörigheter, spärrar eller loggar (K6 3.4). HSA-id är detsamma.' },
  ny_enhet: { text: 'Ny enhet', k6: 'En ny vårdenhet eller arbetsplats får ett nytt HSA-id från dagen den börjar gälla.' },
  sammanslagning: { text: 'Sammanslagning', k6: 'De gamla vårdenheterna stängs och arkiveras, och en ny vårdenhet skapas med nytt HSA-id (K6 3.10).' },
  delning: { text: 'Delning', k6: 'Den gamla vårdenheten stängs och arkiveras, och de nya vårdenheterna skapas med nya HSA-id (K6 3.11).' },
  nedlaggning: { text: 'Nedläggning', k6: 'Vårdenheten stängs och arkiveras. Det som pågår tas över av en vårdenhet som finns (K6 3.3).' },
};
const STATUS = { forberedd: 'Förberedd', genomford: 'Genomförd', avbruten: 'Avbruten' };
// Förändringar som ändrar vem som har åtkomst och därför kräver fyra ögon.
export const KRAVER_GODKANNANDE = new Set(['sammanslagning', 'delning', 'nedlaggning']);

const enhet = (db, id) => (id ? db.query('SELECT * FROM enheter WHERE id = ?').get(id) : null);
const period = (db, id) => db.query('SELECT * FROM enhet_perioder WHERE enhet_id = ?').get(id);
// En enhet är stängd från dagen efter sitt slutdatum.
export const arStangd = (db, id, dag = datumAv(new Date())) => {
  try { const p = period(db, id); return Boolean(p?.till && p.till < dag); } catch { return false; }
};
const arbetsplatser = (db, ve) => db.query("SELECT * FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats' ORDER BY rowid").all(ve);
const textFalt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

function kravRoll(personal) {
  if (!kanRoll(personal, 'omorganisera')) throw new Fel(403, 'Bara systemförvaltningen förbereder omorganisationer.', 'nekad');
}

// Namnet får inte krocka med en annan öppen enhet (K6 3.8).
function provaNamn(db, namn, utom = [], dag) {
  if (!namn) throw new Fel(400, 'Skriv det nya namnet.', 'ogiltig', { falt: ['namn'] });
  if (namn.length < 3) throw new Fel(400, 'Namnet är för kort för att gå att känna igen i listor och på remisser.', 'ogiltig', { falt: ['namn'] });
  const krock = db.query('SELECT id, namn FROM enheter WHERE lower(namn) = lower(?)').all(namn).find(e => !utom.includes(e.id) && !arStangd(db, e.id, dag));
  if (krock) throw new Fel(400, `${krock.namn} finns redan. Två öppna enheter med samma namn går inte att skilja åt i listor, remisser och loggar (HSA 3.8).`, 'ogiltig', { falt: ['namn'] });
}

// Vårdgivaren som en enhet hör till.
export function vardgivareFor(db, id) {
  let e = enhet(db, id);
  for (let i = 0; i < 10 && e && e.typ !== 'vardgivare'; i++) e = enhet(db, e.forald_id);
  return e?.typ === 'vardgivare' ? e.id : null;
}
// Alla enheter ska höra till samma vårdgivare (HSA 3.12). Journalen hör till vårdgivaren, och sammanhållen journalföring
// mellan vårdgivare är något annat än en omorganisation.
function sammaVardgivare(db, ids, falt) {
  const vg = ids.map(id => vardgivareFor(db, id));
  const forsta = vg[0];
  const annan = ids.find((id, i) => !vg[i] || vg[i] !== forsta);
  if (annan) {
    throw new Fel(400, `${enhet(db, annan)?.namn ?? annan} hör till en annan vårdgivare än ${enhet(db, ids[0])?.namn ?? ids[0]}. En vårdenhet kan inte tas över av eller slås samman med en annan vårdgivare, eftersom journalen hör till vårdgivaren och spärrar och behörigheter gäller inom den (HSA 3.12). Den nya vårdgivaren skapar en egen vårdenhet.`, 'ogiltig', { falt: [falt] });
  }
}

function oppenVardenhet(db, id, dag, falt) {
  const e = enhet(db, id);
  if (!e || e.typ !== 'vardenhet') throw new Fel(400, 'Välj en vårdenhet.', 'ogiltig', { falt: [falt] });
  if (arStangd(db, e.id, dag)) throw new Fel(400, `${e.namn} är redan stängd.`, 'ogiltig', { falt: [falt] });
  return e;
}

// Tolkar och kontrollerar planen för en typ. Systemet föreslår det som går att räkna ut: typen för en ny enhet ur den
// överordnade, den gemensamma överordnade vid sammanslagning och mottagaren vid nedläggning.
export function tolkaPlan(db, typ, inp = {}, dag = datumAv(new Date())) {
  if (!TYPER[typ]) throw new Fel(400, 'Välj vilken sorts förändring det är.', 'ogiltig', { falt: ['typ'] });
  if (typ === 'namnbyte') {
    const e = enhet(db, inp.enhet);
    if (!e || !['vardenhet', 'arbetsplats', 'sjukhus'].includes(e.typ)) throw new Fel(400, 'Välj enheten som ska byta namn.', 'ogiltig', { falt: ['enhet'] });
    if (arStangd(db, e.id, dag)) throw new Fel(400, `${e.namn} är stängd och kan inte byta namn.`, 'ogiltig', { falt: ['enhet'] });
    const namn = textFalt(inp.namn, 120);
    if (namn === e.namn) throw new Fel(400, `Enheten heter redan ${e.namn}.`, 'ogiltig', { falt: ['namn'] });
    provaNamn(db, namn, [e.id], dag);
    return { enhet: e.id, namn };
  }
  if (typ === 'ny_enhet') {
    const f = enhet(db, inp.forald);
    if (!f || !['vardgivare', 'sjukhus', 'vardenhet'].includes(f.typ) || arStangd(db, f.id, dag)) throw new Fel(400, 'Välj var i organisationen den nya enheten ska ligga.', 'ogiltig', { falt: ['forald'] });
    const namn = textFalt(inp.namn, 120);
    provaNamn(db, namn, [], dag);
    return { forald: f.id, namn, enhetstyp: f.typ === 'vardenhet' ? 'arbetsplats' : 'vardenhet' };
  }
  if (typ === 'sammanslagning') {
    const gamla = [...new Set(Array.isArray(inp.gamla) ? inp.gamla : [])];
    if (gamla.length < 2) throw new Fel(400, 'Välj minst två vårdenheter som ska slås samman.', 'ogiltig', { falt: ['gamla'] });
    const rader = gamla.map(id => oppenVardenhet(db, id, dag, 'gamla'));
    const namn = textFalt(inp.namn, 120);
    provaNamn(db, namn, [], dag);
    const foraldrar = [...new Set(rader.map(r => r.forald_id))];
    const forald = inp.forald && enhet(db, inp.forald) ? inp.forald : foraldrar[0];
    sammaVardgivare(db, [...gamla, forald], 'gamla');
    return { gamla, namn, forald };
  }
  if (typ === 'delning') {
    const g = oppenVardenhet(db, inp.gammal, dag, 'gammal');
    const ap = arbetsplatser(db, g.id).map(a => a.id);
    const nya = (Array.isArray(inp.nya) ? inp.nya : []).map(n => ({ namn: textFalt(n?.namn, 120), arbetsplatser: (Array.isArray(n?.arbetsplatser) ? n.arbetsplatser : []).filter(a => ap.includes(a)) }));
    if (nya.length < 2) throw new Fel(400, 'En delning ger minst två nya vårdenheter. Skriv namnen på dem.', 'ogiltig', { falt: ['nya'] });
    const namn = new Set();
    for (const n of nya) {
      provaNamn(db, n.namn, [], dag);
      if (namn.has(n.namn.toLowerCase())) throw new Fel(400, 'De nya vårdenheterna behöver olika namn.', 'ogiltig', { falt: ['nya'] });
      namn.add(n.namn.toLowerCase());
    }
    const tilldelade = nya.flatMap(n => n.arbetsplatser);
    if (new Set(tilldelade).size !== tilldelade.length) throw new Fel(400, 'En arbetsplats kan bara höra till en av de nya vårdenheterna.', 'ogiltig', { falt: ['nya'] });
    // Arbetsplatser som inte har fått en plats följer med den första nya vårdenheten, som också tar över det som hör
    // till vårdenheten själv.
    for (const a of ap) if (!tilldelade.includes(a)) nya[0].arbetsplatser.push(a);
    return { gammal: g.id, nya };
  }
  // Nedläggning: mottagaren föreslås av systemet, en annan öppen vårdenhet med samma överordnade.
  const g = oppenVardenhet(db, inp.enhet, dag, 'enhet');
  const mottagare = inp.mottagare ?? foreslaMottagare(db, g.id, dag);
  if (!mottagare) throw new Fel(400, 'Välj vilken vårdenhet som tar över det som pågår.', 'ogiltig', { falt: ['mottagare'] });
  const m = oppenVardenhet(db, mottagare, dag, 'mottagare');
  if (m.id === g.id) throw new Fel(400, 'Vårdenheten kan inte ta över från sig själv.', 'ogiltig', { falt: ['mottagare'] });
  sammaVardgivare(db, [g.id, m.id], 'mottagare');
  return { enhet: g.id, mottagare: m.id };
}

export function foreslaMottagare(db, ve, dag = datumAv(new Date())) {
  const e = enhet(db, ve);
  if (!e) return null;
  const vg = vardgivareFor(db, ve);
  return db.query("SELECT id FROM enheter WHERE typ = 'vardenhet' AND forald_id = ? AND id <> ? ORDER BY namn").all(e.forald_id, ve).map(r => r.id).find(id => !arStangd(db, id, dag) && vardgivareFor(db, id) === vg) ?? null;
}

// Strukturen efter förändringen: nya enheter, vilken gammal enhet som blir vilken ny (karta), vilka som stängs,
// efterföljarna och var spärrarna sätts. Id för nya enheter är platshållare i förhandsvisningen.
function struktur(db, typ, plan, prefix) {
  const s = { nya: [], karta: new Map(), stangs: [], efterfoljare: [], chef: [] };
  const ny = (namn, enhetstyp, forald) => { const e = { id: `${prefix}-${s.nya.length + 1}`, namn, typ: enhetstyp, forald }; s.nya.push(e); return e; };
  const kopieraArbetsplatser = (gammal, till) => {
    for (const a of arbetsplatser(db, gammal)) { const k = ny(a.namn, 'arbetsplats', till.id); s.karta.set(a.id, k.id); s.stangs.push(a.id); }
  };
  if (typ === 'ny_enhet') ny(plan.namn, plan.enhetstyp, plan.forald);
  if (typ === 'sammanslagning') {
    const c = ny(plan.namn, 'vardenhet', plan.forald);
    for (const g of plan.gamla) {
      s.karta.set(g, c.id); s.stangs.push(g); s.efterfoljare.push([g, c.id]);
      kopieraArbetsplatser(g, c);
      s.chef.push([c.id, g]);
    }
  }
  if (typ === 'delning') {
    const gammal = enhet(db, plan.gammal);
    const nya = plan.nya.map(n => ny(n.namn, 'vardenhet', gammal.forald_id));
    s.karta.set(gammal.id, nya[0].id); s.stangs.push(gammal.id);
    plan.nya.forEach((n, i) => {
      s.efterfoljare.push([gammal.id, nya[i].id]);
      s.chef.push([nya[i].id, gammal.id]);
      for (const aid of n.arbetsplatser) { const a = enhet(db, aid); const k = ny(a.namn, 'arbetsplats', nya[i].id); s.karta.set(a.id, k.id); s.stangs.push(a.id); }
    });
  }
  if (typ === 'nedlaggning') {
    s.karta.set(plan.enhet, plan.mottagare); s.stangs.push(plan.enhet); s.efterfoljare.push([plan.enhet, plan.mottagare]);
    for (const a of arbetsplatser(db, plan.enhet)) { s.karta.set(a.id, plan.mottagare); s.stangs.push(a.id); }
  }
  return s;
}

const ph = (a) => a.map(() => '?').join(', ');
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const VANTAR_REMISS = "status <> 'svar_kvitterat' AND NOT (status = 'bedomd' AND beslut IN ('avvisad', 'vidarebefordrad'))";

// Allt som påverkas, bara med antal. Ingen patientuppgift lämnas ut.
function paverkas(db, typ, plan, s, datum, nu) {
  const dagStart = [lokalTid(datum, '00:00'), iso(nu)].sort()[1];
  const namnPa = (id) => s.nya.find(n => n.id === id)?.namn ?? enhet(db, id)?.namn ?? id;
  const rader = [];
  const lagg = (id, text, antal, atgard) => rader.push({ id, text, antal, atgard });
  if (typ === 'namnbyte') {
    const e = enhet(db, plan.enhet);
    const ids = e.typ === 'vardenhet' ? [e.id, ...arbetsplatser(db, e.id).map(a => a.id)] : [e.id];
    const raknaNamn = (t, kol = 'enhet_id') => db.query(`SELECT count(*) AS n FROM ${t} WHERE ${kol} IN (${ph(ids)})`).get(...ids).n;
    lagg('personal', 'Personal på enheten', db.query(`SELECT count(*) AS n FROM personal WHERE aktiv = 1 AND enhet_id IN (${ph(ids)})`).get(...ids).n, 'Behörigheterna är oförändrade. Personalen ser det nya namnet.');
    lagg('pagaende', 'Pågående vårdkontakter', db.query(`SELECT count(*) AS n FROM vardkontakter WHERE enhet_id IN (${ph(ids)}) AND slut IS NULL AND coalesce(planerad, 0) = 0 AND coalesce(automatisk, 0) = 0`).get(...ids).n, 'Fortsätter som förut och visas med det nya namnet.');
    lagg('remisser', 'Remisser som inte är avslutade', db.query(`SELECT count(*) AS n FROM remisser WHERE (till_enhet_id IN (${ph(ids)}) OR fran_enhet_id IN (${ph(ids)})) AND ${VANTAR_REMISS}`).get(...ids, ...ids).n, 'Går till samma enhet som förut, med det nya namnet.');
    lagg('historik', 'Anteckningar som redan är skrivna', raknaNamn('anteckningar'), `Visas med namnet ${e.namn}, som enheten hade när de skrevs.`);
    return rader;
  }
  if (typ === 'ny_enhet') {
    lagg('ny', 'Ny enhet', 1, `${plan.namn} börjar gälla ${datum} med ett nytt HSA-id under ${enhet(db, plan.forald).namn}. Inget flyttas.`);
    return rader;
  }
  const gamla = [...new Set([...s.karta.keys()])];
  const gamlaVe = gamla.filter(id => enhet(db, id)?.typ === 'vardenhet');
  // Vårdenheterna som tar över: en ny arbetsplats räknas till sin nya vårdenhet.
  const malVe = [...new Set([...s.karta.values()].map(v => { const n = s.nya.find(x => x.id === v); return n ? (n.typ === 'arbetsplats' ? n.forald : n.id) : vardenhetFor(db, v); }))];
  const mal = malVe.map(namnPa).join(' och ');
  const rakna = (sql, ...arg) => db.query(sql).get(...arg).n;
  lagg('pagaende', 'Pågående vårdkontakter', rakna(`SELECT count(*) AS n FROM vardkontakter WHERE enhet_id IN (${ph(gamla)}) AND slut IS NULL AND coalesce(planerad, 0) = 0 AND coalesce(automatisk, 0) = 0 AND start < ?`, ...gamla, dagStart),
    `Avslutas på den gamla enheten och fortsätter på ${mal} den ${datum}, i samma vårdtillfälle. Det som redan är dokumenterat stannar där det skrevs.`);
  lagg('bokade', 'Bokade tider från och med dagen', rakna(`SELECT count(*) AS n FROM vardkontakter WHERE enhet_id IN (${ph(gamla)}) AND coalesce(planerad, 0) = 1 AND slut IS NULL AND ankomst IS NULL AND start >= ?`, ...gamla, dagStart),
    `Flyttas till ${mal}. Patienten behåller sin tid, och tiden ligger kvar i samma schema hos samma person.`);
  if (harTabell(db, 'vantelista')) lagg('vantelista', 'Väntar på väntelistan', rakna(`SELECT count(*) AS n FROM vantelista WHERE enhet_id IN (${ph(gamla)}) AND status = 'vantar'`, ...gamla), `Flyttas till ${mal} med samma prioritet och väntetid.`);
  lagg('remisser', 'Remisser som inte är avslutade', rakna(`SELECT count(*) AS n FROM remisser WHERE (till_enhet_id IN (${ph(gamla)}) OR fran_enhet_id IN (${ph(gamla)})) AND ${VANTAR_REMISS}`, ...gamla, ...gamla),
    `Mottagare eller avsändare blir ${mal}, så att kvittens, svar och larm kommer fram. Vilken enhet remissen ursprungligen gick till sparas.`);
  // Vårdrelationerna räknas på patienter som har något på de gamla vårdenheterna.
  const patienter = db.query(`SELECT patient_id FROM vardkontakter WHERE enhet_id IN (${ph(gamla)}) UNION SELECT patient_id FROM listningar WHERE enhet_id IN (${ph(gamla)})
    UNION SELECT patient_id FROM remisser WHERE till_enhet_id IN (${ph(gamla)}) OR fran_enhet_id IN (${ph(gamla)})`).all(...gamla, ...gamla, ...gamla, ...gamla).map(r => r.patient_id);
  const relationer = patienter.filter(p => gamlaVe.some(g => harVardrelation(db, p, g, nu))).length;
  lagg('vardrelationer', 'Patienter med vårdrelation', relationer, `Vårdrelationen följer med till ${mal}. De gamla uppgifterna är för personalen där en annan vårdenhets uppgifter, som visas efter ett aktivt val och loggas.`);
  lagg('listning', 'Listade patienter', rakna(`SELECT count(*) AS n FROM listningar WHERE enhet_id IN (${ph(gamla)})`, ...gamla), `Listas också på ${mal} från dagen.`);
  if (harTabell(db, 'bevakningar')) {
    const b = rakna(`SELECT count(*) AS n FROM bevakningar WHERE enhet_id IN (${ph(gamla)}) AND klar IS NULL`, ...gamla)
      + (harTabell(db, 'egna_bevakningar') ? rakna(`SELECT count(*) AS n FROM egna_bevakningar WHERE enhet_id IN (${ph(gamla)}) AND klar IS NULL`, ...gamla) : 0);
    lagg('bevakningar', 'Bevakningar som inte är klara', b, `Flyttas till ${mal}.`);
  }
  lagg('personal', 'Personal (behörigheter)', rakna(`SELECT count(*) AS n FROM personal WHERE aktiv = 1 AND enhet_id IN (${ph(gamla)})`, ...gamla),
    `Flyttas till ${mal}, och en avdelning eller mottagning till sin motsvarighet där. Behörigheterna följer med.`);
  if (harTabell(db, 'scheman')) lagg('scheman', 'Scheman i tidboken', rakna(`SELECT count(*) AS n FROM scheman WHERE enhet_id IN (${ph(gamla)})`, ...gamla), `Tiderna från och med dagen flyttas till ett schema på ${mal}. Tidigare tider stannar.`);
  if (harTabell(db, 'lakemedelsuppdrag')) lagg('uppdrag', 'Uppdrag i läkemedelshanteringen', rakna(`SELECT count(*) AS n FROM lakemedelsuppdrag WHERE enhet_id IN (${ph(gamlaVe)}) AND avslutat IS NULL AND till >= ?`, ...gamlaVe, datum),
    'Avslutas på dagen, eftersom uppdragen gäller vårdenheten. Verksamhetschefen påminns om att utse dem på nytt.');
  if (harTabell(db, 'delegeringar')) lagg('delegeringar', 'Delegeringar att ge läkemedel', rakna(`SELECT count(*) AS n FROM delegeringar WHERE vardenhet_id IN (${ph(gamlaVe)}) AND aterkallad_tid IS NULL AND till >= ?`, ...gamlaVe, datum),
    'Gäller den gamla vårdenheten och upphör på dagen. Den som delegerar behöver registrera dem på nytt (HSLF-FS 2017:37 9 kap.).');
  const sparrar = rakna(`SELECT count(*) AS n FROM sparrar WHERE aktiv = 1 AND enhet_id IN (${ph(gamla)})`, ...gamla);
  lagg('sparrar', 'Spärrar', sparrar,
    `Ligger kvar och gäller som förut mot den gamla vårdenhetens uppgifter, också för personalen på ${mal}, som behöver patientens samtycke för att se dem. Ingen spärr sätts på ${mal}, eftersom en spärr är patientens beslut. Patienterna behöver tillfrågas om spärren ska gälla också där (HSA 2.4).`);
  const stannar = ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer'].reduce((a, t) => a + rakna(`SELECT count(*) AS n FROM ${t} WHERE enhet_id IN (${ph(gamla)})`, ...gamla), 0);
  lagg('historik', 'Dokumenterade uppgifter', stannar, 'Stannar på den vårdenhet där de upprättades och kodas inte om (HSA 3.3 och 3.4).');
  return rader;
}

// Förhandsvisningen: strukturen och allt som påverkas, bara med antal.
export function forhandsvisa(db, personal, inp = {}, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const datum = inp.datum ?? forvalDatum(nu);
  if (!giltigtDatum(datum)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  if (datum < dag) throw new Fel(400, 'En omorganisation kan inte gälla bakåt i tiden. Det som har hänt ska höra till den organisation som gällde då.', 'ogiltig', { falt: ['datum'] });
  const plan = tolkaPlan(db, inp.typ, inp.plan ?? {}, dag);
  krock(db, inp.typ, plan);
  const s = struktur(db, inp.typ, plan, 'ny');
  return {
    typ: inp.typ, typText: TYPER[inp.typ].text, k6: TYPER[inp.typ].k6, datum, plan, beskrivning: beskriv(db, inp.typ, plan, s),
    nya: s.nya.map(n => ({ namn: n.namn, typ: n.typ, under: s.nya.find(x => x.id === n.forald)?.namn ?? enhet(db, n.forald)?.namn ?? null })),
    stangs: s.stangs.map(id => enhet(db, id)?.namn),
    paverkas: paverkas(db, inp.typ, plan, s, datum, nu),
    manuellt: manuellt(inp.typ),
  };
}

// Det som inte går att göra av systemet, och som systemförvaltaren får veta i förväg.
function manuellt(typ) {
  if (typ === 'namnbyte') return ['Namnet ändras också i HSA-katalogen. I demon finns ingen koppling till HSA.'];
  if (typ === 'ny_enhet') return ['Enheten läggs in i HSA-katalogen med samma HSA-id. I demon finns ingen koppling till HSA.'];
  return [
    'En annan systemförvaltare godkänner förändringen innan den genomförs, eftersom den ändrar vem som har åtkomst (fyra ögon).',
    'Verksamhetschefen utser uppdragen i läkemedelshanteringen på nytt, och den som delegerar registrerar delegeringarna på nytt.',
    'Vårdgivaren beslutar vilken verksamhetschef som ansvarar för spärrar och logguppföljning på den stängda vårdenheten (HSA 2.5 och 2.6).',
    'Ändringen görs också i HSA-katalogen. I demon finns ingen koppling till HSA.',
  ];
}

function beskriv(db, typ, plan, s) {
  const n = (id) => enhet(db, id)?.namn ?? id;
  if (typ === 'namnbyte') return `${n(plan.enhet)} byter namn till ${plan.namn}`;
  if (typ === 'ny_enhet') return `Ny ${plan.enhetstyp === 'arbetsplats' ? 'arbetsplats' : 'vårdenhet'} ${plan.namn} under ${n(plan.forald)}`;
  if (typ === 'sammanslagning') return `${plan.gamla.map(n).join(' och ')} slås samman till ${plan.namn}`;
  if (typ === 'delning') return `${n(plan.gammal)} delas i ${plan.nya.map(x => x.namn).join(' och ')}`;
  return `${n(plan.enhet)} läggs ned, och ${n(plan.mottagare)} tar över det som pågår`;
}

// En enhet kan bara ingå i en förberedd förändring åt gången.
function krock(db, typ, plan, utom = null) {
  const berorda = (t, p) => (t === 'namnbyte' ? [p.enhet] : t === 'ny_enhet' ? [] : t === 'sammanslagning' ? p.gamla : t === 'delning' ? [p.gammal] : [p.enhet, p.mottagare]);
  const mina = new Set(berorda(typ, plan));
  for (const o of db.query("SELECT * FROM omorganisationer WHERE status = 'forberedd'").all()) {
    if (o.id === utom) continue;
    const andra = berorda(o.typ, JSON.parse(o.plan));
    const gemensam = andra.find(e => mina.has(e));
    if (gemensam) throw new Fel(409, `${enhet(db, gemensam)?.namn ?? gemensam} ingår redan i en förberedd förändring (${o.beskrivning}, ${o.datum}). Avbryt den eller vänta tills den är genomförd.`, 'ogiltig');
  }
}

// Förvalt datum: den första dagen i nästa månad, som omorganisationer brukar gälla från.
export function forvalDatum(nu = new Date()) {
  const [y, m] = datumAv(nu).split('-').map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
}

const loggaAtgard = (db, personal, id) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'omorganisera', resurs: `omorganisation:${id}`, grund: 'administrativ' });

export function forbered(db, personal, inp = {}, nu = new Date()) {
  const f = forhandsvisa(db, personal, inp, nu);
  const r = db.query('INSERT INTO omorganisationer (typ, datum, beskrivning, plan, forberedd_av, forberedd) VALUES (?, ?, ?, ?, ?, ?)')
    .run(f.typ, f.datum, f.beskrivning, JSON.stringify(f.plan), personal.id, iso(nu));
  const id = Number(r.lastInsertRowid);
  loggaAtgard(db, personal, id);
  // En förändring som gäller i dag och inte behöver godkännas genomförs direkt.
  genomforForfallna(db, nu);
  return { omorganisation: omorganisationUt(db, db.query('SELECT * FROM omorganisationer WHERE id = ?').get(id), nu, personal) };
}

// Godkänner en förberedd förändring som en annan systemförvaltare har förberett. Planen prövas igen, eftersom
// organisationen kan ha ändrats sedan den förbereddes. En förändring vars datum har passerat genomförs direkt.
export function godkann(db, personal, id, nu = new Date()) {
  kravRoll(personal);
  const o = db.query('SELECT * FROM omorganisationer WHERE id = ?').get(Number(id));
  if (!o) throw new Fel(404, 'Förändringen finns inte.', 'saknas');
  if (o.status !== 'forberedd') throw new Fel(409, `Förändringen är redan ${STATUS[o.status].toLowerCase()}.`, 'ogiltig');
  if (!KRAVER_GODKANNANDE.has(o.typ)) throw new Fel(400, 'Förändringen ändrar inte vem som har åtkomst och behöver inget godkännande.', 'ogiltig');
  if (o.godkand_av) throw new Fel(409, 'Förändringen är redan godkänd.', 'ogiltig');
  if (o.forberedd_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som förberedde förändringen måste godkänna den.', 'nekad');
  const plan = tolkaPlan(db, o.typ, JSON.parse(o.plan), datumAv(nu));
  krock(db, o.typ, plan, o.id);
  db.query('UPDATE omorganisationer SET godkand_av = ?, godkand = ? WHERE id = ?').run(personal.id, iso(nu), o.id);
  loggaAtgard(db, personal, o.id);
  genomforForfallna(db, nu);
  return { omorganisation: omorganisationUt(db, db.query('SELECT * FROM omorganisationer WHERE id = ?').get(o.id), nu, personal) };
}

export function avbryt(db, personal, id, nu = new Date()) {
  kravRoll(personal);
  const o = db.query('SELECT * FROM omorganisationer WHERE id = ?').get(Number(id));
  if (!o) throw new Fel(404, 'Förändringen finns inte.', 'saknas');
  if (o.status !== 'forberedd') throw new Fel(409, `Förändringen är redan ${STATUS[o.status].toLowerCase()}.`, 'ogiltig');
  db.query("UPDATE omorganisationer SET status = 'avbruten', avbruten_av = ?, avbruten = ? WHERE id = ?").run(personal.id, iso(nu), o.id);
  loggaAtgard(db, personal, o.id);
  return { omorganisation: omorganisationUt(db, db.query('SELECT * FROM omorganisationer WHERE id = ?').get(o.id), nu, personal) };
}

// Nästa lediga HSA-id i den påhittade serien.
function nyttHsaId(db) {
  const max = db.query("SELECT hsa_id FROM enheter WHERE hsa_id LIKE 'SE2321000164-VK%'").all()
    .map(r => Number(r.hsa_id.match(/VK(\d{4})$/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0);
  return `SE2321000164-VK${String(max + 1).padStart(4, '0')}`;
}

// Genomför de förberedda förändringar som gäller i dag eller tidigare. Anropas av servern vid varje anrop, eftersom demon
// inte har någon schemalagd körning.
export function genomforForfallna(db, nu = new Date()) {
  let rader;
  try {
    rader = db.query(`SELECT id FROM omorganisationer WHERE status = 'forberedd' AND datum <= ?
      AND (typ NOT IN ('sammanslagning', 'delning', 'nedlaggning') OR godkand_av IS NOT NULL) ORDER BY datum, id`).all(datumAv(nu));
  } catch { return []; }
  return rader.map(r => genomfor(db, r.id, nu));
}

function genomfor(db, id, nu) {
  const o = db.query('SELECT * FROM omorganisationer WHERE id = ?').get(id);
  const plan = JSON.parse(o.plan);
  const datum = o.datum;
  const t = iso(nu);
  // Skiftet: dagens början, eller nu om förändringen genomförs senare på dagen. Det som började före skiftet hör till den
  // gamla enheten.
  const dagStart = [lokalTid(datum, '00:00'), t].sort()[1];
  const resultat = {};
  const raknat = (k, n = 1) => { resultat[k] = (resultat[k] ?? 0) + n; };
  const flytt = db.query('INSERT INTO omorganisation_flyttar (omorganisation_id, kategori, tabell, rad_id, kolumn, fran, till, patient_id, tid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    const s = struktur(db, o.typ, plan, `o${o.id}`);
    // Nya enheter med nya HSA-id.
    for (const n of s.nya) {
      db.query('INSERT INTO enheter (id, hsa_id, namn, kortnamn, typ, forald_id) VALUES (?, ?, ?, NULL, ?, ?)').run(n.id, nyttHsaId(db), n.namn, n.typ, n.forald);
      db.query('INSERT OR REPLACE INTO enhet_perioder (enhet_id, fran, till, arkiverad, omorganisation_id) VALUES (?, ?, NULL, 0, ?)').run(n.id, datum, o.id);
      raknat('nyaEnheter');
    }
    if (o.typ === 'namnbyte') {
      const e = enhet(db, plan.enhet);
      db.query('INSERT INTO enhetsnamn (enhet_id, namn, till, omorganisation_id) VALUES (?, ?, ?, ?)').run(e.id, e.namn, dagStart, o.id);
      db.query('UPDATE enheter SET namn = ? WHERE id = ?').run(plan.namn, e.id);
      raknat('namnbyte');
    }
    const karta = s.karta;
    const gamla = [...karta.keys()];
    if (gamla.length) {
      const nyttFor = (id) => karta.get(id);
      const veFor = (id) => vardenhetFor(db, nyttFor(id));
      // Personalen och deras scheman. Tider från och med dagen flyttas till ett nytt schema på den nya enheten.
      for (const p of db.query(`SELECT id, enhet_id FROM personal WHERE enhet_id IN (${ph(gamla)})`).all(...gamla)) {
        db.query('UPDATE personal SET enhet_id = ? WHERE id = ?').run(nyttFor(p.enhet_id), p.id);
        flytt.run(o.id, 'personal', 'personal', p.id, 'enhet_id', p.enhet_id, nyttFor(p.enhet_id), null, t);
        raknat('personal');
      }
      if (harTabell(db, 'scheman')) {
        for (const sc of db.query(`SELECT * FROM scheman WHERE enhet_id IN (${ph(gamla)})`).all(...gamla)) {
          const nyId = `${sc.id}-o${o.id}`;
          db.query('INSERT INTO scheman (id, enhet_id, personal_id, yrkesroll) VALUES (?, ?, ?, ?)').run(nyId, nyttFor(sc.enhet_id), sc.personal_id, sc.yrkesroll);
          const n = db.query('UPDATE tider SET schema_id = ? WHERE schema_id = ? AND start >= ?').run(nyId, sc.id, dagStart).changes;
          flytt.run(o.id, 'scheman', 'scheman', sc.id, 'id', sc.id, nyId, null, t);
          raknat('tider', n);
        }
        for (const r of db.query(`SELECT * FROM tidboksregler WHERE enhet_id IN (${ph(gamla)})`).all(...gamla)) {
          db.query('INSERT OR IGNORE INTO tidboksregler (enhet_id, tidstyp, egenbokning) VALUES (?, ?, ?)').run(nyttFor(r.enhet_id), r.tidstyp, r.egenbokning);
        }
      }
      if (harTabell(db, 'resurser')) {
        for (const r of db.query(`SELECT id, enhet_id FROM resurser WHERE enhet_id IN (${ph(gamla)})`).all(...gamla)) {
          db.query('UPDATE resurser SET enhet_id = ? WHERE id = ?').run(nyttFor(r.enhet_id), r.id);
          flytt.run(o.id, 'resurser', 'resurser', r.id, 'enhet_id', r.enhet_id, nyttFor(r.enhet_id), null, t);
        }
      }
      // Bokade tider framåt: den planerade vårdkontakten hör till den nya enheten.
      for (const v of db.query(`SELECT id, enhet_id, patient_id FROM vardkontakter WHERE enhet_id IN (${ph(gamla)}) AND coalesce(planerad, 0) = 1 AND slut IS NULL AND ankomst IS NULL AND start >= ?`).all(...gamla, dagStart)) {
        db.query('UPDATE vardkontakter SET enhet_id = ?, andrad = ? WHERE id = ?').run(nyttFor(v.enhet_id), t, v.id);
        flytt.run(o.id, 'bokade', 'vardkontakter', String(v.id), 'enhet_id', v.enhet_id, nyttFor(v.enhet_id), v.patient_id, t);
        raknat('bokade');
      }
      // Pågående vårdkontakter: avslutas och fortsätter på den nya enheten, som vid en flytt.
      for (const v of db.query(`SELECT * FROM vardkontakter WHERE enhet_id IN (${ph(gamla)}) AND slut IS NULL AND coalesce(planerad, 0) = 0 AND coalesce(automatisk, 0) = 0 AND start < ?`).all(...gamla, dagStart)) {
        const dit = nyttFor(v.enhet_id);
        const gammalNamn = enhet(db, v.enhet_id)?.namn;
        const plats = !v.plats || v.plats === gammalNamn ? enhet(db, dit)?.namn : v.plats;
        db.query('UPDATE vardkontakter SET slut = ?, andrad = ? WHERE id = ?').run(dagStart, t, v.id);
        const ny = Number(db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, kontaktsatt, vardtillfalle_id, halsoarende_id, foregaende_id, remiss_id, skapad, ger_vardrelation)
          VALUES (?, ?, ?, ?, ?, ?, 'vardkallan', ?, ?, ?, ?, ?, ?, ?)`).run(v.patient_id, dit, v.typ, dagStart, plats, v.orsak, v.kontaktsatt ?? null, v.vardtillfalle_id ?? null,
          v.halsoarende_id ?? null, v.id, v.remiss_id ?? null, t, v.ger_vardrelation ?? 1).lastInsertRowid);
        flytt.run(o.id, 'pagaende', 'vardkontakter', String(v.id), 'fortsatter_som', v.enhet_id, `${dit}:${ny}`, v.patient_id, t);
        if (v.vardtillfalle_id) {
          const vt = db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(v.vardtillfalle_id);
          db.query('INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, ?, ?, ?, ?, NULL, ?)')
            .run(vt.id, 'flytt', dagStart, dit, plats, `Omorganisation: från ${gammalNamn} till ${enhet(db, dit)?.namn}`);
          if (vt && karta.has(vt.enhet_id) && !vt.utskriven) {
            db.query('UPDATE vardtillfallen SET enhet_id = ? WHERE id = ?').run(veFor(vt.enhet_id), vt.id);
            db.query('INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, ?, ?, ?, NULL, NULL, ?)')
              .run(vt.id, 'ansvar', dagStart, dit, `Omorganisation: det medicinska ansvaret går över till ${enhet(db, veFor(vt.enhet_id))?.namn}.`);
            flytt.run(o.id, 'pagaende', 'vardtillfallen', String(vt.id), 'enhet_id', vt.enhet_id, veFor(vt.enhet_id), vt.patient_id, t);
          }
        }
        raknat('pagaende');
      }
      if (harTabell(db, 'vantelista')) {
        for (const v of db.query(`SELECT id, enhet_id, patient_id FROM vantelista WHERE enhet_id IN (${ph(gamla)}) AND status = 'vantar'`).all(...gamla)) {
          db.query('UPDATE vantelista SET enhet_id = ? WHERE id = ?').run(veFor(v.enhet_id), v.id);
          flytt.run(o.id, 'vantelista', 'vantelista', String(v.id), 'enhet_id', v.enhet_id, veFor(v.enhet_id), v.patient_id, t);
          raknat('vantelista');
        }
      }
      for (const r of db.query(`SELECT id, till_enhet_id, fran_enhet_id, patient_id FROM remisser WHERE (till_enhet_id IN (${ph(gamla)}) OR fran_enhet_id IN (${ph(gamla)})) AND ${VANTAR_REMISS}`).all(...gamla, ...gamla)) {
        for (const kol of ['till_enhet_id', 'fran_enhet_id']) {
          if (!karta.has(r[kol])) continue;
          db.query(`UPDATE remisser SET ${kol} = ? WHERE id = ?`).run(veFor(r[kol]), r.id);
          flytt.run(o.id, 'remisser', 'remisser', String(r.id), kol, r[kol], veFor(r[kol]), r.patient_id, t);
        }
        raknat('remisser');
      }
      for (const tab of ['bevakningar', 'egna_bevakningar']) {
        if (!harTabell(db, tab)) continue;
        for (const b of db.query(`SELECT id, enhet_id, patient_id FROM ${tab} WHERE enhet_id IN (${ph(gamla)}) AND klar IS NULL`).all(...gamla)) {
          db.query(`UPDATE ${tab} SET enhet_id = ? WHERE id = ?`).run(veFor(b.enhet_id), b.id);
          flytt.run(o.id, 'bevakningar', tab, String(b.id), 'enhet_id', b.enhet_id, veFor(b.enhet_id), b.patient_id ?? null, t);
          raknat('bevakningar');
        }
      }
      for (const l of db.query(`SELECT * FROM listningar WHERE enhet_id IN (${ph(gamla)})`).all(...gamla)) {
        db.query('INSERT OR IGNORE INTO listningar (patient_id, enhet_id, fran) VALUES (?, ?, ?)').run(l.patient_id, veFor(l.enhet_id), datum);
        flytt.run(o.id, 'listning', 'listningar', `${l.patient_id}:${l.enhet_id}`, 'enhet_id', l.enhet_id, veFor(l.enhet_id), l.patient_id, t);
        raknat('listning');
      }
      // Spärrarna ändras inte: de gäller som förut mot den gamla vårdenhetens uppgifter (HSA 2.4).
      const gamlaVe = gamla.filter(g => enhet(db, g)?.typ === 'vardenhet');
      if (gamlaVe.length && harTabell(db, 'lakemedelsuppdrag')) {
        for (const u of db.query(`SELECT id FROM lakemedelsuppdrag WHERE enhet_id IN (${ph(gamlaVe)}) AND avslutat IS NULL AND till >= ?`).all(...gamlaVe, datum)) {
          db.query('UPDATE lakemedelsuppdrag SET avslutat = ?, avslutat_tid = ?, avslutat_orsak = ? WHERE id = ?').run(datum, t, `Vårdenheten stängdes vid omorganisationen: ${o.beskrivning}.`, u.id);
          raknat('uppdrag');
        }
      }
      if (harTabell(db, 'verksamhetschefer')) {
        for (const [ny, gammal] of s.chef) {
          const vc = db.query('SELECT personal_id FROM verksamhetschefer WHERE enhet_id = ?').get(gammal);
          if (vc && !db.query('SELECT 1 FROM verksamhetschefer WHERE enhet_id = ?').get(ny)) db.query('INSERT INTO verksamhetschefer (enhet_id, personal_id) VALUES (?, ?)').run(ny, vc.personal_id);
        }
      }
    }
    // De gamla enheterna stängs och arkiveras (K6 2.1), och efterföljarna sparas.
    const sista = addDagar(datum, -1);
    for (const g of s.stangs) {
      db.query(`INSERT INTO enhet_perioder (enhet_id, fran, till, arkiverad, omorganisation_id) VALUES (?, NULL, ?, 1, ?)
        ON CONFLICT (enhet_id) DO UPDATE SET till = excluded.till, arkiverad = 1, omorganisation_id = excluded.omorganisation_id`).run(g, sista, o.id);
      raknat('stangda');
    }
    for (const [g, n] of s.efterfoljare) db.query('INSERT OR IGNORE INTO enhet_efterfoljare (gammal_id, ny_id, fran, omorganisation_id) VALUES (?, ?, ?, ?)').run(g, n, datum, o.id);
    db.query("UPDATE omorganisationer SET status = 'genomford', genomford = ?, resultat = ? WHERE id = ?").run(t, JSON.stringify(resultat), o.id);
    sakerhetslogg.logga(db, { typ: 'andrad_behorighet', personal_id: null, enhet_id: null,
      beskrivning: `Omorganisationen ${o.beskrivning} genomfördes ${datum} av systemet. ${resultat.personal ?? 0} personer fick sin behörighet flyttad, förberett av ${personnamn(db, o.forberedd_av)}${o.godkand_av ? ` och godkänt av ${personnamn(db, o.godkand_av)}` : ''}.` });
  })();
  glomForegangare(db);
  return { id: o.id, resultat };
}

const RESULTATTEXT = {
  nyaEnheter: 'nya enheter', namnbyte: 'namnbyte', personal: 'personer flyttade', tider: 'tider flyttade i tidboken', bokade: 'bokade tider flyttade',
  pagaende: 'pågående vårdkontakter fortsätter på den nya enheten', vantelista: 'på väntelistan flyttade', remisser: 'remisser med ny mottagare eller avsändare',
  bevakningar: 'bevakningar flyttade', listning: 'listningar', sparrar: 'nya spärrar på de nya vårdenheterna', uppdrag: 'uppdrag i läkemedelshanteringen avslutade', stangda: 'enheter stängda och arkiverade',
};

export function omorganisationUt(db, o, nu = new Date(), personal = null) {
  const r = o.resultat ? JSON.parse(o.resultat) : null;
  const kraver = KRAVER_GODKANNANDE.has(o.typ);
  return {
    kraverGodkannande: kraver, godkandAv: personnamn(db, o.godkand_av), godkand: o.godkand ?? null,
    kanGodkanna: Boolean(personal && kraver && o.status === 'forberedd' && !o.godkand_av && o.forberedd_av !== personal.id),
    vantarPaGodkannande: kraver && o.status === 'forberedd' && !o.godkand_av,
    id: o.id, typ: o.typ, typText: TYPER[o.typ].text, datum: o.datum, beskrivning: o.beskrivning, status: o.status, statusText: STATUS[o.status],
    forberedd: o.forberedd, forbereddAv: personnamn(db, o.forberedd_av), genomford: o.genomford, avbruten: o.avbruten, avbrutenAv: personnamn(db, o.avbruten_av),
    resultat: r ? Object.entries(r).map(([k, n]) => ({ id: k, antal: n, text: `${n} ${RESULTATTEXT[k] ?? k}` })) : null,
    dagarKvar: o.status === 'forberedd' ? Math.round((Date.parse(o.datum + 'T12:00:00Z') - Date.parse(datumAv(nu) + 'T12:00:00Z')) / 86400_000) : null,
  };
}

// Sidan för omorganisation: förberedda, genomförda och avbrutna förändringar, och organisationen med de enheter som kan
// väljas. Inga patientuppgifter.
export function oversikt(db, personal, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const alla = db.query("SELECT * FROM enheter WHERE typ IN ('vardgivare', 'sjukhus', 'vardenhet', 'arbetsplats') ORDER BY rowid").all();
  const oppna = alla.filter(e => !arStangd(db, e.id, dag));
  const nod = (e) => ({
    id: e.id, namn: e.namn, hsaId: e.hsa_id, typ: e.typ,
    personal: db.query('SELECT count(*) AS n FROM personal WHERE aktiv = 1 AND enhet_id = ?').get(e.id).n,
    barn: oppna.filter(b => b.forald_id === e.id).map(nod),
  });
  return {
    organisation: oppna.filter(e => e.typ === 'vardgivare').map(nod),
    stangda: alla.filter(e => arStangd(db, e.id, dag)).map(e => {
      const p = period(db, e.id);
      const eft = db.query('SELECT e.namn FROM enhet_efterfoljare f JOIN enheter e ON e.id = f.ny_id WHERE f.gammal_id = ?').all(e.id).map(x => x.namn);
      return { id: e.id, namn: e.namn, hsaId: e.hsa_id, till: p.till, efterfoljare: eft };
    }),
    forandringar: db.query('SELECT * FROM omorganisationer ORDER BY CASE status WHEN \'forberedd\' THEN 0 ELSE 1 END, datum DESC, id DESC').all().map(o => omorganisationUt(db, o, nu, personal)),
    typer: TYPER, forvalDatum: forvalDatum(nu),
    mottagare: Object.fromEntries(oppna.filter(e => e.typ === 'vardenhet').map(e => [e.id, foreslaMottagare(db, e.id, dag)])),
    anmarkning: 'Följer HSA:s regler för organisationsförändringar i vårdgivarstrukturen (Inera, version 1.0). Kopplingen till HSA-katalogen är inte byggd i demon, och HSA-id för nya enheter är påhittade.',
  };
}

// Namnet en enhet hade vid en viss tid. Det som skrevs före ett namnbyte visas med det tidigare namnet.
export function namnVid(db, enhetId, tid) {
  try {
    const r = tid && db.query('SELECT namn FROM enhetsnamn WHERE enhet_id = ? AND till > ? ORDER BY till LIMIT 1').get(enhetId, tid);
    if (r) return r.namn;
  } catch { /* äldre sandlåda */ }
  return db.query('SELECT namn FROM enheter WHERE id = ?').get(enhetId)?.namn ?? enhetId;
}

// Efter en omorganisation: patienter med en spärr mot en stängd vårdenhet som har gått upp i min vårdenhet, och som kan
// tillfrågas om spärren också ska gälla min vårdenhet (HSA 2.4). Visas bara för den som registrerar spärrar
// (vårdadministratören), bara för patienter med vårdrelation hit, och utan att nämna den spärrade enheten. Ingen spärr
// sätts av sig själv.
export function sparrFragor(db, personal, nu = new Date()) {
  if (!kanRoll(personal, 'registrera_sparr')) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const gamla = [...foregangare(db, ve)];
  if (!gamla.length) return [];
  const namn = enhet(db, ve)?.namn ?? ve;
  const rader = db.query(`SELECT DISTINCT patient_id FROM sparrar WHERE aktiv = 1 AND enhet_id IN (${ph(gamla)})
    AND patient_id NOT IN (SELECT patient_id FROM sparrar WHERE aktiv = 1 AND enhet_id = ?) ORDER BY patient_id`).all(...gamla, ve);
  return rader.map(r => db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id)).filter(p => p && harVardrelation(db, p.id, ve, nu)).map(p => ({
    patientId: p.id, patient: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad), vardenhet: { id: ve, namn },
    text: `Patienten har en spärr mot en vårdenhet som har gått upp i ${namn} och kan tillfrågas om spärren också ska gälla ${namn}. Ingen spärr sätts utan patientens eget beslut.`,
  }));
}

// Registrerar patientens beslut som en vanlig spärr mot min vårdenhet.
export function registreraSparr(db, personal, patientId, { patientensBeslut } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'registrera_sparr')) throw new Fel(403, 'Din yrkesroll registrerar inte spärrar.', 'nekad');
  if (patientensBeslut !== true) throw new Fel(400, 'En spärr registreras bara när patienten själv har beslutat att den ska gälla, i samtal eller på blankett.', 'ogiltig', { falt: ['patientensBeslut'] });
  const fraga = sparrFragor(db, personal, nu).find(f => f.patientId === patientId);
  if (!fraga) throw new Fel(400, 'Patienten har ingen spärr från en omorganisation som kan gälla din vårdenhet.', 'ogiltig');
  db.query('INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, ?, ?)').run(patientId, fraga.vardenhet.id, datumAv(nu));
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: patientId, handling: 'registrera_sparr', resurs: `sparr:${fraga.vardenhet.id}`, grund: 'administrativ', syfte: 'Patientens eget beslut efter en omorganisation' });
  return { ok: true, vardenhet: fraga.vardenhet };
}
