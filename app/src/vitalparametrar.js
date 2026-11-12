// Mätvärden över tid (Sussa 3.1.3.9), skalor (3.1.3.5) och basfakta (3.1.6.1 och 3.1.6.2), runda 6, r1.
//
// Systemet räknar: en kurva per mätvärde med referensintervall, NEWS2 ur vitalparametrarna med vad som ska göras och
// när nästa kontroll ska göras, larm i inkorgen när NEWS2 eller ett enskilt värde kräver åtgärd, och basfakta om
// patienten som ett och samma objekt i API:t och i patienthuvudet. Allt byggs av det som användaren redan får se:
// raderna filtreras i behörighetsmotorn (inre sekretess, spärr och aktivt val), så att varken kurvor, poäng, larm
// eller basfakta kan röja något som är dolt. Reglerna står i skalor.js och är demoregler (D10).
// Runda 7, r4: undantag från visning.
import { undantagnaUt } from './undantag.js';
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, harVardrelation, alder } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as vardkontakt from './vardkontakt.js';
import * as uppmarksamhet from './uppmarksamhet.js';
import { registreraAtgard } from './atgarder.js';
import { NEWS2_KOD, SYSTEM } from './kodverk.js';
import { NEWS2_KUNSKAP } from './kunskapsstod.js';
import { CS } from './fhir-definitioner.js';
import { news2, news2Omgangar, news2Galler, referens, utanforReferens, DEMOREGEL, NEWS2_KALLA, NEWS2_ATGARD, tolkaGcs } from './skalor.js';
// Runda 9, r2: bara kvalitetssäkrade värden räknas i NEWS2, larm och basfakta. Värden från utrustning är referens tills de
// är godkända, och patientens egna mätningar visas för sig (mt-klass.js och medicinteknik.js).
import { kvalitetssakrad, OBEDOMDA_KALLOR } from './mt-klass.js';
// Runda 10, r4: SpO2 skala 2 när läkaren har beslutat det (syremattnad-skala.js), och urvalet i listan (matvarde-inmatning.js).
import * as skala2 from './syremattnad-skala.js';
import { lasUrval, tillampa, INMATNINGAR } from './matvarde-inmatning.js';

const idagSv = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const WARFARIN = 'B01AA03';
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

// Värdena i en rad som tal för kurvan. Blodtryck ger systoliskt och diastoliskt.
function talAv(m) {
  if (m.typ === 'blodtryck') return String(m.varde).split('/').map(Number);
  if (m.typ === 'medvetande') return null;
  const v = m.varde_num ?? Number(m.varde);
  return Number.isFinite(v) ? [v] : null;
}

// Står patienten på warfarin enligt det användaren får se i läkemedelslistan? Då är INR:s målintervall 2,0 till 3,0.
function harWarfarin(atk) {
  if (!kanRoll(atk.personal, 'las_lakemedel')) return false;
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_lakemedel');
  return lakemedel.synligaOrdinationer(a).some(o => lakemedel.aktuell(o) && atk.db.query('SELECT atc FROM katalog WHERE id = ?').get(o.lakemedel_id)?.atc === WARFARIN);
}

function synligaDiagnoskoder(atk) {
  if (!kanRoll(atk.personal, 'las_diagnoser')) return [];
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_diagnoser');
  return journal.synligaDiagnoser(a).map(d => d.kod);
}

// Kurvorna: en per mätvärdestyp med punkterna i tidsordning, referensintervallet och om värdet ligger utanför.
export function kurvor(atk, p, rader) {
  const warfarin = rader.some(m => m.typ === 'inr') && harWarfarin(atk);
  const perTyp = new Map();
  for (const m of [...rader].sort((a, b) => a.tid.localeCompare(b.tid) || a.id - b.id)) {
    const v = talAv(m);
    if (!v || v.some(x => !Number.isFinite(x))) continue;
    if (!perTyp.has(m.typ)) perTyp.set(m.typ, []);
    perTyp.get(m.typ).push({ m, v });
  }
  return [...perTyp].map(([typ, punkter]) => {
    const r = referens(typ, { kon: p.kon, warfarin });
    const sista = punkter.at(-1);
    return {
      typ, namn: journal.MATTYPER[typ]?.namn ?? typ, enhet: sista.m.matt_enhet ?? '', referens: r,
      serier: typ === 'blodtryck' ? ['Systoliskt', 'Diastoliskt'] : [journal.MATTYPER[typ]?.namn ?? typ],
      punkter: punkter.map(({ m, v }) => ({ id: m.id, tid: m.tid, varden: v, utanfor: utanforReferens(v[0], r), vardenhet: enhetsnamn(atk.db, m.enhet_id),
        ...(m.typ === 'gcs' ? { text: tolkaGcs(m.varde)?.text } : {}),
        // Runda 9, r2: ett värde från utrustning visas med källan och om det är godkänt.
        ...(OBEDOMDA_KALLOR.has(m.kalla) ? { kalla: m.kalla, godkand: m.vidimerad != null } : {}) })),
      senaste: { tid: sista.m.tid, varde: sista.m.varde_num ?? sista.m.varde, utanfor: utanforReferens(sista.v[0], r) },
    };
  }).sort((a, b) => b.senaste.tid.localeCompare(a.senaste.tid));
}

// NEWS2 för patienten ur de synliga raderna: om NEWS2 gäller, serien med de kompletta omgångarna, den aktuella
// omgången med vad som ska göras och när nästa kontroll ska göras, och om det finns ett larm.
export function news2For(atk, p, alla, nu = Date.now()) {
  const rader = alla.filter(kvalitetssakrad);
  const galler = news2Galler({ alder: alder(p.fodd, idagSv()), diagnosKoder: synligaDiagnoskoder(atk) });
  // Runda 10, r5: kunskapsstödet om vad poängen betyder (kunskapsstod.js).
  const bas = { galler: galler.galler, text: galler.text, demoregel: DEMOREGEL, kalla: NEWS2_KALLA, kunskap: NEWS2_KUNSKAP };
  if (!galler.galler) return { ...bas, serie: [], aktuell: null, nyareRoda: [], larm: false };
  const sk = skala2.skalaUt(atk, synligaDiagnoskoder(atk));
  return { ...bas, ...news2Lage(rader, nu, { skala: sk.skala }), skala: sk };
}

export function news2Lage(rader, nu = Date.now(), { skala = 1 } = {}) {
  const omgangar = news2Omgangar(rader, { skala });
  const kompletta = omgangar.filter(o => o.resultat.komplett);
  const senaste = kompletta.at(-1) ?? null;
  // Enskilda värden med 3 poäng som togs efter den senaste kompletta omgången kräver åtgärd i sig.
  const efter = omgangar.filter(o => !senaste || Date.parse(o.tid) > Date.parse(senaste.tid)).at(-1);
  const nyareRoda = efter && !efter.resultat.komplett ? efter.resultat.delar.filter(d => d.poang === 3) : [];
  let aktuell = null;
  if (senaste) {
    const h = senaste.resultat.kontrollInomTimmar;
    const nasta = h ? new Date(Date.parse(senaste.tid) + h * 3600_000).toISOString() : null;
    aktuell = { tid: senaste.tid, ankareId: senaste.ankareId, matvarden: senaste.anvanda, ...senaste.resultat, nastaKontroll: nasta, kontinuerlig: h === 0, forsenad: Boolean(nasta && Date.parse(nasta) < nu) };
  } else if (efter) {
    aktuell = { tid: efter.tid, ankareId: efter.ankareId, matvarden: efter.anvanda, ...efter.resultat, nastaKontroll: null, kontinuerlig: false, forsenad: false };
  }
  return {
    serie: kompletta.map(o => ({ tid: o.tid, ankareId: o.ankareId, poang: o.resultat.poang, risk: o.resultat.risk, rod: o.resultat.rod })),
    aktuell, nyareRoda, larm: Boolean((senaste && senaste.resultat.larm) || nyareRoda.length || (!senaste && aktuell?.larm)),
  };
}

// Fliken Mätvärden: listan, kurvorna och NEWS2 i ett anrop, så att läsningen loggas en gång.
export function matvardesvy(atk, p, urvalQ = new URLSearchParams()) {
  atk.krav('las_matvarden');
  const rader = journal.synligaMatvarden(atk);
  // Runda 7, r4: mätvärden som är undantagna från visning står med antal och motivering (undantag.js).
  const dolda = { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr, undantagna: undantagnaUt(atk) };
  // Runda 9, r2: patientens egna mätningar visas skilda från vårdens värden. I NEWS2 räknas de först när de är bedömda
  // och godkända (news2For tar bara kvalitetssäkrade värden).
  const vardens = rader.filter(m => m.kalla !== 'patient');
  // Runda 10, r4: urvalet i listan efter typ, hur värdet kom in och period. Kurvorna och NEWS2 bygger på alla värden.
  const alla = vardens.map(m => journal.matvardeUt(atk.db, m));
  const urval = lasUrval(urvalQ, journal.MATTYPER);
  const valda = tillampa(alla, urval);
  return {
    matvarden: valda, dolda,
    urval: { ...urval, antal: valda.length, totalt: alla.length, inmatningar: [...new Set(alla.map(m => m.inmatning.typ))].map(id => ({ id, text: INMATNINGAR[id] })),
      typer: [...new Set(alla.map(m => m.typ))].map(id => ({ id, text: journal.MATTYPER[id]?.namn ?? id })) },
    kurvor: kurvor(atk, p, vardens), news2: news2For(atk, p, rader),
    egna: rader.filter(m => m.kalla === 'patient').map(m => journal.matvardeUt(atk.db, m)),
  };
}

// Registrering av en hel NEWS2-omgång: sju värden med samma tid och samma vårdkontakt, en åtgärd med KVÅ QD008
// (övervakning av vitala tecken) och NEWS2 räknat av systemet. Allt eller inget sparas.
export const NEWS2_FALT = ['andningsfrekvens', 'saturation', 'syrgas', 'blodtryck', 'puls', 'medvetande', 'temp'];
export function registreraNews2(atk, p, body = {}) {
  atk.krav('registrera_matvarde');
  const galler = news2Galler({ alder: alder(p.fodd, idagSv()), diagnosKoder: synligaDiagnoskoder(atk) });
  if (!galler.galler) throw new Fel(400, galler.text, 'ogiltig');
  const saknas = NEWS2_FALT.filter(f => body[f] == null || body[f] === '');
  if (saknas.length) throw new Fel(400, `NEWS2 behöver alla sju värdena. Fyll i ${saknas.map(f => journal.MATTYPER[f].namn.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')}.`, 'ogiltig', { falt: saknas });
  const tid = body.tid != null ? body.tid : iso();
  const db = atk.db;
  const ut = db.transaction(() => {
    const sparade = NEWS2_FALT.map(f => journal.registreraMatvarde(atk, { typ: f, varde: body[f], tid }));
    const forsta = vardkontakt.knyt(atk, 'matvarden', sparade[0], body);
    const vk = db.query('SELECT vardkontakt_id FROM matvarden WHERE id = ?').get(sparade[0].id).vardkontakt_id;
    for (const m of sparade.slice(1)) db.query('UPDATE matvarden SET vardkontakt_id = ? WHERE id = ?').run(vk, m.id);
    const atgard = registreraAtgard(atk, { kod: 'QD008', tid: sparade[0].tid, vardkontaktId: vk, underlag: { matvarden: sparade.map(m => m.id) } });
    const rader = sparade.map(m => db.query('SELECT * FROM matvarden WHERE id = ?').get(m.id));
    return { matvarden: sparade, vardkontakt: forsta.vardkontakt, atgard, news2: news2Omgangar(rader, { skala: skala2.skalaFor(atk) }).at(-1).resultat };
  })();
  return ut;
}

// Förhandsvisning av NEWS2 medan värdena skrivs. Inga patientuppgifter läses och inget sparas.
export function berakna(body = {}) {
  // Runda 10, r4: förhandsvisningen räknar med skala 2 när formuläret är för en patient med det beslutet.
  const skala = body.skala === 2 ? 2 : 1;
  const sys = typeof body.blodtryck === 'string' ? Number(body.blodtryck.split('/')[0]) : Number(body.systoliskt);
  const tal = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  return news2({
    andningsfrekvens: tal(body.andningsfrekvens), saturation: tal(body.saturation), syrgas: tal(body.syrgas), systoliskt: Number.isFinite(sys) && sys > 0 ? sys : null,
    puls: tal(body.puls), medvetande: typeof body.medvetande === 'string' ? body.medvetande.toUpperCase() : null, temp: tal(body.temp),
  }, { skala });
}

// Larm i inkorgen för sjuksköterskan och läkaren: patienter med en pågående vårdkontakt på den egna vårdenheten där
// NEWS2 eller ett enskilt värde kräver åtgärd. Bara värden som togs på den egna vårdenheten under den pågående
// kontakten räknas, så att larmet aldrig bygger på uppgifter från en annan vårdenhet eller en spärrad vårdenhet.
// Runda 13, r3: dag och klockslag i svensk tid för larmtexten.
const klockText = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function larmForInkorg(db, personal, valFor = () => ({})) {
  if (!['lakare', 'sjukskoterska'].includes(personal?.yrke) || !kanRoll(personal, 'las_matvarden')) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const kontakter = db.query(`SELECT patient_id, min(start) AS start, max(typ = 'slutenvard') AS sluten FROM vardkontakter WHERE enhet_id IN (${ph}) AND slut IS NULL
    AND NOT (coalesce(planerad, 0) = 1 AND ankomst IS NULL AND start > ?) GROUP BY patient_id`).all(...enheter, iso());
  const ut = [];
  for (const k of kontakter) {
    if (!harVardrelation(db, k.patient_id, ve)) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ? AND sammanslagen_till IS NULL').get(k.patient_id);
    if (!p) continue;
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_matvarden');
    if (!atk.prova('las_matvarden').tillaten) continue;
    const rader = atk.filtrera(db.query(`SELECT * FROM matvarden WHERE patient_id = ? AND enhet_id IN (${ph}) AND tid >= ? ORDER BY tid, id`).all(p.id, ...enheter, k.start), 'las_matvarden')
      .filter(kvalitetssakrad);
    const egnaDiagnoser = kanRoll(personal, 'las_diagnoser') ? db.query(`SELECT kod FROM diagnoser WHERE patient_id = ? AND enhet_id IN (${ph})`).all(p.id, ...enheter).map(d => d.kod) : [];
    if (!news2Galler({ alder: alder(p.fodd, idagSv()), diagnosKoder: egnaDiagnoser }).galler) continue;
    // Runda 10, r4: bara ett beslut om skala 2 från den egna vårdenheten räknas i larmet, som värdena.
    const beslut = skala2.beslutFor(atk);
    const lage = news2Lage(rader, Date.now(), { skala: beslut && vardenhetFor(db, beslut.enhet_id) === ve ? 2 : 1 });
    // Runda 13, r3 (E2-13): en inneliggande patient vars kontroll enligt NEWS2:s intervall har uteblivit larmar också.
    const forsenad = Boolean(k.sluten && lage.aktuell?.forsenad);
    if (!lage.larm && !forsenad) continue;
    const a = lage.aktuell;
    if (!lage.larm) {
      ut.push({
        patientId: p.id, ankareId: a.ankareId, tid: a.tid, poang: a.poang, komplett: a.komplett, risk: a.risk,
        rubrik: 'Kontrollen enligt NEWS2 är försenad',
        text: `Senaste NEWS2 är ${a.poang} från ${klockText(a.tid)}. Nästa kontroll skulle ha gjorts ${klockText(a.nastaKontroll)}.`,
        atgard: 'Ta en ny kontroll av vitalparametrarna nu.', frekvens: a.frekvens, nastaKontroll: a.nastaKontroll, forsenad: true,
        href: `#/patient/${encodeURIComponent(p.id)}/matvarden`, demoregel: DEMOREGEL,
      });
      continue;
    }
    const roda = lage.nyareRoda.length ? lage.nyareRoda : a.delar.filter(d => d.poang === 3);
    // Ett nyare enskilt värde med 3 poäng väger tyngre än en lägre poäng i den senaste hela omgången.
    const nyRod = lage.nyareRoda.length > 0 && !['hog', 'medel'].includes(a.risk);
    const g = nyRod ? NEWS2_ATGARD.rod : a;
    ut.push({
      patientId: p.id, ankareId: a.ankareId, tid: a.tid, poang: a.poang, komplett: a.komplett, risk: nyRod ? 'lag_medel' : a.risk,
      rubrik: a.komplett ? `NEWS2 ${a.poang}, ${a.riskText.toLowerCase()}` : 'Ett värde ger 3 poäng i NEWS2',
      text: [a.komplett ? a.text : '', ...roda.map(d => `${d.namn} ${d.visning} ger 3 poäng.`)].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      atgard: g.atgard, frekvens: g.frekvens, nastaKontroll: a.nastaKontroll, forsenad: a.forsenad,
      href: `#/patient/${encodeURIComponent(p.id)}/matvarden`, demoregel: DEMOREGEL,
    });
  }
  return ut.sort((x, y) => (y.poang ?? 0) - (x.poang ?? 0) || y.tid.localeCompare(x.tid));
}

// Basfakta (Sussa 3.1.6.1 och 3.1.6.2): ålder, kön, var patienten vårdas, listning, överkänslighet,
// uppmärksamhetsinformation, vikt och längd med BMI som systemet räknar. Samma objekt i patienthuvudet, i
// GET /api/patient/:id/basfakta och, med hänvisningarna i fhir, i FHIR. Varje uppgift säger när, var och av vem den
// registrerades, och bara det användaren får se finns med.
const NYLIGEN_DAGAR = 30;
export function basfakta(atk, p) {
  const db = atk.db;
  const pers = atk.personal;
  const ut = { alder: alder(p.fodd, idagSv()), kon: p.kon, fhir: { patient: `Patient/${p.id}` } };
  const kontakter = journal.synligaVardkontakter(new Atkomst(db, pers, p.id, atk.val, 'las_admin'))
    .filter(v => v.slut == null && !(v.planerad && !v.ankomst && Date.parse(v.start) > Date.now() + 3600_000));
  const vk = kontakter.find(v => v.typ === 'slutenvard') ?? kontakter[0] ?? null;
  ut.vardas = vk ? { vardenhet: { id: vardenhetFor(db, vk.enhet_id), namn: enhetsnamn(db, vardenhetFor(db, vk.enhet_id)) }, enhet: { id: vk.enhet_id, namn: enhetsnamn(db, vk.enhet_id) }, plats: vk.plats, typ: vk.typ, sedan: vk.start } : null;
  const l = db.query('SELECT * FROM listningar WHERE patient_id = ?').get(p.id);
  ut.listning = l ? { vardenhet: { id: l.enhet_id, namn: enhetsnamn(db, l.enhet_id) }, fran: l.fran } : null;
  if (kanRoll(pers, 'las_oversikt')) {
    const ok = journal.synligOverkanslighet(new Atkomst(db, pers, p.id, atk.val, 'las_oversikt')) ?? [];
    // Runda 10, r2: id, version och vem, så att uppgiften kan ändras och avslutas i sitt eget flöde (overkanslighet.js).
    ut.overkanslighet = ok.map(o => ({ id: o.id, amne: o.amne, atc: o.atc, allvarlighet: o.allvarlighet, reaktion: o.reaktion, version: o.version,
      registrerad: { datum: o.datum, vardenhet: o.vardenhet, av: o.registreradAv?.namn ?? null }, kallaEtikett: o.kallaEtikett }));
    ut.fhir.overkanslighet = ok.map(o => `AllergyIntolerance/${o.id}`);
    ut.uppmarksamhet = uppmarksamhet.symbolFor(db, pers, p.id, atk.val);
  } else { ut.overkanslighet = null; ut.uppmarksamhet = null; }
  if (kanRoll(pers, 'las_matvarden')) {
    const rader = journal.synligaMatvarden(new Atkomst(db, pers, p.id, atk.val, 'las_matvarden')).filter(kvalitetssakrad);
    const sist = (typ) => rader.find(m => m.typ === typ) ?? null;
    const fakta = (m) => (m ? { varde: m.varde_num, enhet: m.matt_enhet, tid: m.tid, vardenhet: { id: m.enhet_id, namn: enhetsnamn(db, m.enhet_id) }, registreradAv: m.registrerad_av ? db.query('SELECT namn FROM personal WHERE id = ?').get(m.registrerad_av)?.namn ?? null : null } : null);
    const vikt = sist('vikt');
    const langd = sist('langd');
    ut.vikt = fakta(vikt);
    ut.langd = fakta(langd);
    if (vikt) ut.fhir.vikt = `Observation/${vikt.id}`;
    if (langd) ut.fhir.langd = `Observation/${langd.id}`;
    // BMI räknas av systemet när det finns en längd och en vikt från de senaste 30 dagarna, och bara för vuxna.
    const ny = vikt && Date.parse(vikt.tid) > Date.now() - NYLIGEN_DAGAR * 86400_000;
    if (vikt && langd && ny && ut.alder >= 18) {
      const bmi = Math.round((vikt.varde_num / (langd.varde_num / 100) ** 2) * 10) / 10;
      ut.bmi = { varde: bmi, text: `BMI ${String(bmi).replace('.', ',')}, räknat av systemet ur vikten och längden` };
    } else ut.bmi = null;
  } else { ut.vikt = null; ut.langd = null; ut.bmi = null; }
  return ut;
}

// NEWS2 i FHIR: varje komplett omgång som en härledd Observation med id news2-<id för den senaste raden i omgången>,
// poängen som värde, risken som tolkning och derivedFrom till de sju mätvärdena. Byggs av samma synliga rader som
// sökningen på Observation, så att den aldrig lämnar ut mer än mätvärdena.
export function news2Fhir(atk, p, alla) {
  const rader = alla.filter(kvalitetssakrad);
  if (!news2Galler({ alder: alder(p.fodd, idagSv()), diagnosKoder: synligaDiagnoskoder(atk) }).galler) return [];
  const perId = new Map(rader.map(r => [r.id, r]));
  return news2Omgangar(rader, { skala: skala2.skalaFor(atk) }).filter(o => o.resultat.komplett).map(o => ({
    resourceType: 'Observation', id: `news2-${o.ankareId}`, meta: { tag: [{ system: `${CS}/kalla`, code: 'vardkallan' }] }, status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
    code: { coding: [{ ...NEWS2_KOD }], text: 'NEWS2' }, subject: { reference: `Patient/${p.id}` },
    ...(perId.get(o.ankareId)?.vardkontakt_id ? { encounter: { reference: `Encounter/${perId.get(o.ankareId).vardkontakt_id}` } } : {}), effectiveDateTime: o.tid,
    valueQuantity: { value: o.resultat.poang, unit: 'poäng', system: SYSTEM.ucum, code: '{score}' },
    interpretation: [{ text: o.resultat.riskText }],
    method: { text: 'NEWS2 (Royal College of Physicians 2017), räknat av Vårdkällan ur vitalparametrarna. Demoregel.' },
    derivedFrom: o.anvanda.map(id => ({ reference: `Observation/${id}` })),
  }));
}
