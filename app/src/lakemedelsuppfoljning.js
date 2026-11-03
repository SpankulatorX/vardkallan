// Läkemedelsprocessen, del 2 (runda 6, r2): uppföljning av behandlingen (Sussa 3.5.2.10, 3.5.2.20) och fördjupad
// läkemedelsgenomgång (3.5.1.6, HSLF-FS 2017:37 11 kap.).
//
// Systemet är experten. Uppföljningsdatumet bevakas: när det har passerat hamnar ordinationen i läkarens inkorg, och
// utvärderingen görs med tre val (effekt, biverkan och beslut) där systemet föreslår nästa uppföljningsdatum och
// påminner om att rapportera en biverkan. På vårdenhetens nivå räknar systemet samman utvärderingarna per läkemedel,
// utan patientuppgifter. Den fördjupade genomgången tas fram av systemet för varje läkemedel enligt 11 kap. 11 §:
// indikation, effekt, dos mot njurfunktion och ålder, biverkningar, interaktioner och nytta. Farmaceuten föreslår
// åtgärder, patientens egen bild tas med, och läkaren beslutar. Systemet kontrollerar att det som 11 kap. 14 § kräver
// finns med innan genomgången avslutas.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { Atkomst, vardenhetFor, enheterUnder, kanRoll, alder } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as lakemedel from './lakemedel.js';
import * as vidimering from './vidimering.js';
import { kravVardande } from './administrering.js';
import { datumI } from './lakemedelsprocess.js';

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Samma användare och val, men utan samtycke till spärrade uppgifter (som vidimering.js). Det som sparas får aldrig
// bygga på ett samtycke, som bara gäller för stunden.
const utanSamtycke = (atk) => new Atkomst(atk.db, atk.personal, atk.patientId, { ...atk.val, samtycke_sparr: false }, atk.handling);

export const EFFEKT = { god: 'God effekt', delvis: 'Delvis effekt', ingen: 'Ingen effekt', for_tidigt: 'För tidigt att bedöma' };
export const BIVERKAN = { ingen: 'Ingen biverkan', misstankt: 'Misstänkt biverkan', bekraftad: 'Bekräftad biverkan' };
export const BESLUT = { fortsatt: 'Fortsätt', andra: 'Ändra dos eller läkemedel', satt_ut: 'Sätt ut', observation: 'Observation, läkaren beslutar' };
export const BIVERKNINGSRAPPORT = 'Misstänkta biverkningar rapporteras till Läkemedelsverket, särskilt allvarliga och okända biverkningar och biverkningar av nya läkemedel.';

// Utvärderingar --------------------------------------------------------------------------------------------------------

export function utvarderingarFor(db, ordinationId) {
  return db.query('SELECT * FROM lakemedelsutvarderingar WHERE ordination_id = ? ORDER BY tid DESC, id DESC').all(ordinationId).map(u => ({
    id: u.id, tid: u.tid, av: personNamn(db, u.av), effekt: u.effekt, effektText: EFFEKT[u.effekt], biverkan: u.biverkan, biverkanText: BIVERKAN[u.biverkan],
    biverkanBeskrivning: u.biverkan_text, beslut: u.beslut, beslutText: BESLUT[u.beslut], nyttUppfoljningsdatum: u.nytt_uppfoljningsdatum, kommentar: u.kommentar,
  }));
}
// Uppföljningens datum just nu: det senaste nya datumet ur en utvärdering, annars ordinationens.
export const aktuelltUppfoljningsdatum = (db, o) => db.query('SELECT nytt_uppfoljningsdatum AS d FROM lakemedelsutvarderingar WHERE ordination_id = ? AND nytt_uppfoljningsdatum IS NOT NULL ORDER BY tid DESC, id DESC').get(o.id)?.d ?? o.uppfoljning;

// Förslaget för nästa uppföljning: samma intervall som ordinationen hade, minst en vecka och högst tre månader.
export function forslagUppfoljning(o) {
  const dagar = Math.round((Date.parse(o.uppfoljning) - Date.parse(o.start)) / 86400_000);
  return addDagar(idag(), Math.min(90, Math.max(7, Number.isFinite(dagar) ? dagar : 30)));
}

// GET /api/ordination/:id/utvardering: systemets förslag och tidigare utvärderingar.
export function utvarderingsunderlag(atk, o) {
  atk.krav('las_lakemedel', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  const db = atk.db;
  return {
    ordinationId: o.id, lakemedel: katalog(db, o.lakemedel_id)?.namn, ordinationsorsak: o.orsak, uppfoljningsdatum: aktuelltUppfoljningsdatum(db, o),
    forslag: { effekt: 'god', biverkan: 'ingen', beslut: atk.personal.yrke === 'lakare' ? 'fortsatt' : 'observation', nyttUppfoljningsdatum: forslagUppfoljning(o) },
    tidigare: utvarderingarFor(db, o.id), val: { effekt: EFFEKT, biverkan: BIVERKAN, beslut: atk.personal.yrke === 'lakare' ? { fortsatt: BESLUT.fortsatt, andra: BESLUT.andra, satt_ut: BESLUT.satt_ut } : { observation: BESLUT.observation } },
    biverkningsrapport: BIVERKNINGSRAPPORT,
  };
}

// POST /api/ordination/:id/utvardering { effekt, biverkan, biverkanText?, beslut, nyttUppfoljningsdatum?, kommentar? }.
// Läkaren beslutar. Sjuksköterskan registrerar effekt och biverkan som en observation, och läkaren beslutar sedan.
export function utvardera(atk, o, inp = {}) {
  const db = atk.db;
  kravVardande(atk, 'utvardera_lakemedel', { enhet_id: o.enhet_id, gemensam: true }, `utvardering:${o.id}`);
  // Säkerhetsgranskning: utvärderingen sparas och syns utan samtycke, så en ordination från en spärrad vårdenhet
  // utvärderas inte, inte ens med samtycke.
  if (!utanSamtycke(atk).prova('las_lakemedel', { enhet_id: o.enhet_id, gemensam: true }).tillaten) {
    atk.logga('utvardera_lakemedel', 'nekad', `utvardering:${o.id}`, 'nekad');
    throw new Fel(403, 'Ordinationen kommer från en spärrad vårdenhet och utvärderas där. En utvärdering sparas i journalen och kan inte bygga på ett samtycke som bara gäller för stunden.', 'nekad');
  }
  if (o.status !== 'aktiv') throw new Fel(400, 'Ordinationen är utsatt och följs inte upp längre.', 'ogiltig');
  const lakare = atk.personal.yrke === 'lakare';
  const falt = [];
  if (!Object.hasOwn(EFFEKT, inp.effekt ?? '')) falt.push('effekt');
  if (!Object.hasOwn(BIVERKAN, inp.biverkan ?? '')) falt.push('biverkan');
  const beslut = lakare ? inp.beslut : 'observation';
  if (lakare && !['fortsatt', 'andra', 'satt_ut'].includes(beslut)) falt.push('beslut');
  const bt = text(inp.biverkanText, 500);
  if (inp.biverkan && inp.biverkan !== 'ingen' && bt.length < 3) falt.push('biverkanText');
  let nytt = null;
  if (beslut === 'fortsatt') {
    nytt = inp.nyttUppfoljningsdatum ?? forslagUppfoljning(o);
    if (!giltigtDatum(nytt) || nytt <= idag() || nytt > addDagar(idag(), 365)) falt.push('nyttUppfoljningsdatum');
  }
  if (falt.length) {
    throw new Fel(400, `Kontrollera ${falt.map(f => ({ effekt: 'effekten', biverkan: 'biverkan', beslut: 'beslutet', biverkanText: 'vilken biverkan det gäller', nyttUppfoljningsdatum: 'nästa uppföljning (efter i dag och inom ett år)' }[f])).join(', ')}.`, 'ogiltig', { falt });
  }
  const r = db.query(`INSERT INTO lakemedelsutvarderingar (ordination_id, patient_id, enhet_id, tid, av, effekt, biverkan, biverkan_text, beslut, nytt_uppfoljningsdatum, kommentar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(o.id, atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id, inp.effekt, inp.biverkan, bt || null, beslut, nytt, text(inp.kommentar, 1000) || null);
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)')
    .run(o.id, iso(), atk.personal.id, 'Utvärderad', `${EFFEKT[inp.effekt]}, ${BIVERKAN[inp.biverkan].toLowerCase()}${bt ? ` (${bt})` : ''}. ${BESLUT[beslut]}${nytt ? `, nästa uppföljning ${nytt}` : ''}.`);
  const nasta = beslut === 'satt_ut' ? { atgard: 'satt_ut', text: 'Sätt ut ordinationen i läkemedelslistan. Orsaken är förifylld ur utvärderingen.', orsak: `${EFFEKT[inp.effekt]}${inp.biverkan !== 'ingen' ? `, ${BIVERKAN[inp.biverkan].toLowerCase()}: ${bt}` : ''}` }
    : beslut === 'andra' ? { atgard: 'andra', text: 'Ordinera den nya dosen eller det nya läkemedlet och sätt ut den gamla ordinationen.' } : null;
  return { id: Number(r.lastInsertRowid), utvarderingar: utvarderingarFor(db, o.id), uppfoljningsdatum: aktuelltUppfoljningsdatum(db, o), nasta,
    ...(inp.biverkan !== 'ingen' ? { biverkningsrapport: BIVERKNINGSRAPPORT } : {}) };
}

// Läkarens inkorg: aktiva ordinationer vars uppföljning har passerat. Mottagare är läkaren som ordinerade, och när den
// läkaren inte längre är i tjänst läkarna på ordinationens vårdenhet. Bara patienter och ordinationer som läkaren får
// se utan aktiva val, aldrig från en spärrad vårdenhet.
export function passeradeUppfoljningar(db, personal) {
  if (personal.yrke !== 'lakare') return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const aktiva = new Set(db.query("SELECT id FROM personal WHERE aktiv = 1 AND yrke = 'lakare'").all().map(p => p.id));
  const ut = [];
  for (const o of db.query("SELECT * FROM ordinationer WHERE status = 'aktiv' ORDER BY uppfoljning, id").all()) {
    if (o.slut && o.slut < idag()) continue;
    const datum = aktuelltUppfoljningsdatum(db, o);
    if (datum >= idag()) continue;
    const mottagare = aktiva.has(o.ordinerad_av) ? o.ordinerad_av === personal.id : vardenhetFor(db, o.enhet_id) === ve;
    if (!mottagare) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(o.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const atk = new Atkomst(db, personal, o.patient_id, {}, 'las_lakemedel');
    if (!atk.prova('las_lakemedel', { enhet_id: o.enhet_id, gemensam: true }).tillaten) continue;
    const dagar = Math.round((Date.parse(idag()) - Date.parse(datum)) / 86400_000);
    ut.push({ ordinationId: o.id, patientId: o.patient_id, lakemedel: katalog(db, o.lakemedel_id)?.namn, dosering: o.dosering, ordinationsorsak: o.orsak, uppfoljningsdatum: datum, dagarSedan: dagar,
      text: `Uppföljningen skulle ha gjorts ${datum}, för ${dagar} ${dagar === 1 ? 'dag' : 'dagar'} sedan.` });
  }
  return ut;
}

// Uppföljning på vårdenhetens nivå (patientgrupp): per läkemedel antal pågående ordinationer, utvärderade, effekt och
// biverkningar och passerade uppföljningar. Bara antal, inga patientuppgifter. Loggas utan patient.
export function patientgrupp(db, personal) {
  if (personal.yrke !== 'lakare') {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'utvardera_lakemedel', resurs: 'lakemedelsuppfoljning:patientgrupp', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Uppföljningen på vårdenhetens nivå är för läkare.', 'nekad');
  }
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = new Set(enheterUnder(db, ve));
  const ord = db.query('SELECT * FROM ordinationer').all().filter(o => enheter.has(o.enhet_id));
  const per = new Map();
  for (const o of ord) {
    const lm = katalog(db, o.lakemedel_id);
    const k = lm?.substans ?? o.lakemedel_id;
    const r = per.get(k) ?? { substans: k, atc: lm?.atc, ordinationer: 0, pagaende: 0, patienter: new Set(), utvarderade: 0, effekt: { god: 0, delvis: 0, ingen: 0, for_tidigt: 0 }, biverkningar: 0, passerade: 0 };
    r.ordinationer++;
    r.patienter.add(o.patient_id);
    const aktiv = o.status === 'aktiv' && (!o.slut || o.slut >= idag());
    if (aktiv) r.pagaende++;
    if (aktiv && aktuelltUppfoljningsdatum(db, o) < idag()) r.passerade++;
    const u = db.query('SELECT * FROM lakemedelsutvarderingar WHERE ordination_id = ? ORDER BY tid DESC, id DESC').get(o.id);
    if (u) { r.utvarderade++; r.effekt[u.effekt]++; if (u.biverkan !== 'ingen') r.biverkningar++; }
    per.set(k, r);
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'utvardera_lakemedel', resurs: 'lakemedelsuppfoljning:patientgrupp', grund: 'administrativ', resultat: 'tillaten' });
  const rader = [...per.values()].map(r => ({ ...r, patienter: r.patienter.size, andelGodEffekt: r.utvarderade ? Math.round(r.effekt.god / r.utvarderade * 100) : null }))
    .sort((a, b) => b.passerade - a.passerade || b.pagaende - a.pagaende || a.substans.localeCompare(b.substans, 'sv'));
  return { vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn, rader, summa: { pagaende: rader.reduce((s, r) => s + r.pagaende, 0), passerade: rader.reduce((s, r) => s + r.passerade, 0), utvarderade: rader.reduce((s, r) => s + r.utvarderade, 0) },
    anmarkning: 'Antalen räknas på den egna vårdenhetens ordinationer, utan patientuppgifter. Effekten är den senaste utvärderingen av varje ordination.' };
}

// Fördjupad läkemedelsgenomgång ------------------------------------------------------------------------------------

export const ATGARDER = { fortsatt: 'Fortsätt oförändrat', satt_ut: 'Sätt ut', minska_dos: 'Minska dosen', byt: 'Byt läkemedel', folj_upp: 'Följ upp effekt eller prover' };
// Frågorna till patienten om läkemedelsrelaterade besvär. Demoversion, inte ett validerat formulär.
export const BESVAR = { yrsel: 'Yrsel eller ostadighet', fall: 'Fall det senaste halvåret', trotthet: 'Trötthet eller dåsighet', muntorrhet: 'Muntorrhet', forstoppning: 'Förstoppning', aptit: 'Dålig aptit eller illamående', minne: 'Glömska eller förvirring', svart_ta: 'Svårt att ta läkemedlen, till exempel att svälja eller komma ihåg' };

// Systemets underlag för varje läkemedel enligt 11 kap. 11 §, och dess förslag på åtgärd ur fynden.
function underlagPerLakemedel(atk, g) {
  const db = atk.db;
  const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const ar = pat ? alder(pat.fodd, idag()) : null;
  const egfr = lakemedel.egfrForSakerhet(atk);
  return g.ordinationer.map(o => {
    const fynd = g.fynd.filter(f => f.ordinationer.includes(o.id));
    const senast = utvarderingarFor(db, o.id)[0] ?? null;
    const forslag = fynd.some(f => f.typ === 'dubbelmedicinering' || f.typ === 'aldre') ? 'satt_ut' : fynd.some(f => f.typ === 'interaktion' && f.niva === 'allvarlig') ? 'byt'
      : fynd.some(f => f.typ === 'uppfoljning') || !senast ? 'folj_upp' : senast?.effekt === 'ingen' ? 'satt_ut' : 'fortsatt';
    return {
      ordinationId: o.id, lakemedel: o.lakemedel, dosering: o.dosering,
      kontroller: [
        { punkt: 'Indikation', text: o.ordinationsorsak ? `Ordinationsorsak: ${o.ordinationsorsak}.` : 'Ordinationsorsak saknas.' },
        { punkt: 'Effekt', text: senast ? `${senast.effektText}, utvärderad ${datumI(Date.parse(senast.tid))} av ${senast.av}.` : 'Ingen utvärdering registrerad. Fråga patienten och bedöm effekten.' },
        { punkt: 'Dos mot njurfunktion och ålder', text: `${egfr != null ? `eGFR ${egfr}` : 'eGFR saknas'}${ar != null ? `, ${ar} år` : ''}.${fynd.some(f => f.typ === 'aldre') ? ' Olämpligt för äldre enligt demoreglerna.' : ''}` },
        { punkt: 'Biverkningar', text: senast && senast.biverkan !== 'ingen' ? `${senast.biverkanText}: ${senast.biverkanBeskrivning ?? ''}` : 'Ingen biverkan registrerad. Jämför med patientens besvär.' },
        { punkt: 'Interaktioner och dubbelmedicinering', text: fynd.filter(f => f.typ === 'interaktion' || f.typ === 'dubbelmedicinering').map(f => f.text).join(' ') || 'Inga fynd enligt demoreglerna.' },
      ],
      fynd, forslag, forslagText: ATGARDER[forslag],
    };
  });
}

function genomgangUt(atk, r) {
  const db = atk.db;
  const steg = Object.fromEntries(db.query('SELECT * FROM fordjupade_steg WHERE genomgang_id = ? ORDER BY id').all(r.id).map(s => [s.typ, { av: personNamn(db, s.av), tid: s.tid, ...JSON.parse(s.innehall) }]));
  const status = steg.lakare ? 'avslutad' : steg.farmaceut ? 'vantar_lakare' : 'vantar_farmaceut';
  return { id: r.id, startad: r.startad, startadAv: personNamn(db, r.startad_av), fynd: JSON.parse(r.fynd), steg, status,
    statusText: { avslutad: 'Avslutad', vantar_lakare: 'Väntar på läkarens beslut', vantar_farmaceut: 'Väntar på farmaceutens bedömning' }[status] };
}

const kravGenomgang = (atk, beskrivning) => kravVardande(atk, 'lakemedelsgenomgang', null, beskrivning);

// GET /api/patient/:id/fordjupad-genomgang: den pågående genomgången och systemets underlag, och tidigare genomgångar.
export function fordjupad(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const g = vidimering.genomgang(atk);
  const rader = atk.filtrera(db.query('SELECT * FROM fordjupade_genomgangar WHERE patient_id = ? ORDER BY startad DESC, id DESC').all(atk.patientId), 'las_lakemedel', { gemensam: true });
  const alla = rader.map(r => genomgangUt(atk, r));
  const pagar = alla.find(x => x.status !== 'avslutad') ?? null;
  const kan = kanRoll(atk.personal, 'lakemedelsgenomgang') && atk.prova('lakemedelsgenomgang').tillaten && atk.prova('lakemedelsgenomgang').grund !== 'nodatkomst';
  return {
    pagar, tidigare: alla.filter(x => x.status === 'avslutad'), underlag: underlagPerLakemedel(atk, g), berattelse: g.berattelse, besvar: BESVAR, atgarder: ATGARDER,
    roll: atk.personal.yrke, kan: { starta: kan && !pagar, farmaceut: kan && atk.personal.yrke === 'farmaceut' && pagar?.status === 'vantar_farmaceut', lakare: kan && atk.personal.yrke === 'lakare' && Boolean(pagar), patient: kan && Boolean(pagar) && !pagar.steg.patient },
    dolda: { sparrade: atk.doldaSparr }, demoregler: true, anmarkning: g.anmarkning,
  };
}

// POST /api/patient/:id/fordjupad-genomgang. Läkaren eller farmaceuten startar, och systemet sparar fynden.
export function startaFordjupad(atk) {
  const db = atk.db;
  kravGenomgang(atk, 'fordjupad_genomgang');
  if (db.query('SELECT 1 FROM fordjupade_genomgangar g WHERE patient_id = ? AND NOT EXISTS (SELECT 1 FROM fordjupade_steg s WHERE s.genomgang_id = g.id AND s.typ = \'lakare\')').get(atk.patientId)) {
    throw new Fel(400, 'Det finns redan en fördjupad läkemedelsgenomgång som pågår för patienten.', 'ogiltig');
  }
  const g = vidimering.genomgang(atk);
  const vt = db.query('SELECT id FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL ORDER BY inskriven DESC').get(atk.patientId);
  const r = db.query('INSERT INTO fordjupade_genomgangar (patient_id, enhet_id, startad, startad_av, fynd, vardtillfalle_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id, JSON.stringify(g.fynd), vt?.id ?? null);
  atk.logga('lakemedelsgenomgang', atk.grund(), `fordjupad_genomgang:${r.lastInsertRowid}`);
  return fordjupad(atk);
}

function hamtaGenomgang(atk, gid) {
  const r = atk.db.query('SELECT * FROM fordjupade_genomgangar WHERE id = ? AND patient_id = ?').get(Number(gid), atk.patientId);
  if (!r || !atk.prova('las_lakemedel', { enhet_id: r.enhet_id, gemensam: true }).tillaten) throw new Fel(404, 'Genomgången finns inte.', 'saknas');
  return genomgangUt(atk, r);
}

// POST /api/patient/:id/fordjupad-genomgang/:gid/steg { typ, ... }.
//   patient    { deltog, varforInte?, besvar: [nyckel], synpunkter? }: patientens medverkan (11 kap. 2 §)
//   farmaceut  { forslag: [{ ordinationId, atgard, motivering }], bedomning }: bara farmaceuten
//   lakare     { beslut: [{ ordinationId, atgard, motivering }], mal, uppfoljningsdatum, uppfoljningAnsvarig?, patientInformerad }
export function sparaSteg(atk, gid, inp = {}) {
  const db = atk.db;
  kravGenomgang(atk, `fordjupad_genomgang:${gid}`);
  const g = hamtaGenomgang(atk, gid);
  if (g.status === 'avslutad') throw new Fel(400, 'Genomgången är avslutad och ändras inte.', 'ogiltig');
  const typ = inp.typ;
  if (!['patient', 'farmaceut', 'lakare'].includes(typ)) throw new Fel(400, 'Okänt steg i genomgången.', 'ogiltig', { falt: ['typ'] });
  if (g.steg[typ]) throw new Fel(400, 'Det steget är redan gjort.', 'ogiltig');
  const roll = atk.personal.yrke;
  if ((typ === 'farmaceut' && roll !== 'farmaceut') || (typ === 'lakare' && roll !== 'lakare')) {
    atk.logga('lakemedelsgenomgang', 'nekad', `fordjupad_genomgang:${gid}:${typ}`, 'nekad');
    throw new Fel(403, typ === 'farmaceut' ? 'Farmaceutens bedömning görs av en farmaceut.' : 'Besluten i en fördjupad läkemedelsgenomgång fattas av läkaren, som ansvarar för den (11 kap. 1 §).', 'nekad');
  }
  // Säkerhetsgranskning: stegen sparas och syns utan samtycke, så bara ordinationer som syns utan samtycke till spärrade
  // uppgifter får ingå. En ordination från en spärrad vårdenhet avvisas, eftersom ett samtycke bara gäller för stunden.
  const pagaende = new Map(lakemedel.synligaOrdinationer(utanSamtycke(atk)).filter(lakemedel.aktuell).map(o => [o.id, o]));
  const rader = (lista, namn) => {
    const alla = Array.isArray(lista) ? lista : [];
    if (alla.some(x => !pagaende.has(Number(x?.ordinationId)))) throw new Fel(400, 'Genomgången omfattar bara pågående läkemedel som syns utan samtycke. Läkemedel från en spärrad vårdenhet kan inte tas med.', 'ogiltig', { falt: [namn] });
    const ut = alla.filter(x => pagaende.has(Number(x?.ordinationId)) && Object.hasOwn(ATGARDER, x?.atgard ?? ''))
      .map(x => ({ ordinationId: Number(x.ordinationId), lakemedel: katalog(db, pagaende.get(Number(x.ordinationId)).lakemedel_id)?.namn, atgard: x.atgard, atgardText: ATGARDER[x.atgard], motivering: text(x.motivering, 500) }));
    if (!ut.length) throw new Fel(400, `Ange ${namn} för minst ett läkemedel.`, 'ogiltig', { falt: [namn] });
    const utan = ut.find(x => x.atgard !== 'fortsatt' && x.motivering.length < 3);
    if (utan) throw new Fel(400, `Motivera åtgärden för ${utan.lakemedel}.`, 'ogiltig', { falt: [namn] });
    return ut;
  };
  let innehall;
  if (typ === 'patient') {
    const deltog = Boolean(inp.deltog);
    if (!deltog && text(inp.varforInte).length < 3) throw new Fel(400, 'Genomgången görs så långt det går i samråd med patienten. Skriv varför patienten inte deltog.', 'ogiltig', { falt: ['varforInte'] });
    innehall = { deltog, varforInte: deltog ? null : text(inp.varforInte), besvar: (Array.isArray(inp.besvar) ? inp.besvar : []).filter(b => Object.hasOwn(BESVAR, b)).map(b => ({ nyckel: b, text: BESVAR[b] })), synpunkter: text(inp.synpunkter, 1000) || null };
  } else if (typ === 'farmaceut') {
    innehall = { forslag: rader(inp.forslag, 'forslag'), bedomning: text(inp.bedomning, 2000) || null };
  } else {
    const falt = [];
    const mal = text(inp.mal, 1000);
    if (mal.length < 3) falt.push('mal');
    if (!giltigtDatum(inp.uppfoljningsdatum) || inp.uppfoljningsdatum <= idag()) falt.push('uppfoljningsdatum');
    if (!inp.patientInformerad) falt.push('patientInformerad');
    if (falt.length) throw new Fel(400, 'Läkaren dokumenterar målen med behandlingen, när uppföljningen görs och vem som ansvarar för den, och att patienten har fått information om åtgärderna och en uppdaterad läkemedelslista (11 kap. 12 till 14 §§).', 'ogiltig', { falt });
    const beslut = rader(inp.beslut, 'beslut');
    const ansvarig = text(inp.uppfoljningAnsvarig, 200) || db.query('SELECT namn FROM enheter WHERE id = ?').get(vardenhetFor(db, atk.personal.enhet_id))?.namn;
    const deltagare = [g.steg.farmaceut && `${g.steg.farmaceut.av} (farmaceut)`, `${atk.personal.namn} (läkare)`, g.steg.patient?.deltog && 'patienten'].filter(Boolean);
    innehall = { beslut, mal, uppfoljningsdatum: inp.uppfoljningsdatum, uppfoljningAnsvarig: ansvarig, patientInformerad: true, deltagare,
      sammanfattning: [`Fördjupad läkemedelsgenomgång ${idag()}. Deltog: ${deltagare.join(', ')}.`,
        ...beslut.map(b => `${b.lakemedel}: ${b.atgardText}${b.motivering ? `. ${b.motivering}` : ''}.`),
        `Mål: ${mal}`, `Uppföljning senast ${inp.uppfoljningsdatum}, ansvarig ${ansvarig}.`, 'Patienten har fått information om åtgärderna och en uppdaterad läkemedelslista.'].join('\n') };
  }
  db.query('INSERT INTO fordjupade_steg (genomgang_id, typ, av, tid, innehall) VALUES (?, ?, ?, ?, ?)').run(g.id, typ, atk.personal.id, iso(), JSON.stringify(innehall));
  atk.logga('lakemedelsgenomgang', atk.grund(), `fordjupad_genomgang:${g.id}:${typ}`);
  const ut = fordjupad(atk);
  // Nästa steg som systemet föreslår: de åtgärder läkaren beslutade som görs i läkemedelslistan.
  if (typ === 'lakare') ut.nasta = innehall.beslut.filter(b => b.atgard !== 'fortsatt' && b.atgard !== 'folj_upp').map(b => ({ ordinationId: b.ordinationId, lakemedel: b.lakemedel, atgard: b.atgard, text: `${b.atgardText}: ${b.lakemedel}` }));
  return ut;
}

// Inkorgen: genomgångar på den egna vårdenheten som väntar på farmaceuten eller läkaren, för patienter som användaren
// får se utan aktiva val.
export function genomgangarIInkorg(db, personal) {
  if (!['farmaceut', 'lakare'].includes(personal.yrke)) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM fordjupade_genomgangar ORDER BY startad').all().filter(r => vardenhetFor(db, r.enhet_id) === ve).flatMap(r => {
    const atk = new Atkomst(db, personal, r.patient_id, {}, 'las_lakemedel');
    if (!atk.prova('las_lakemedel', { enhet_id: r.enhet_id, gemensam: true }).tillaten) return [];
    const g = genomgangUt(atk, r);
    if (personal.yrke === 'farmaceut' ? g.status !== 'vantar_farmaceut' : g.status === 'avslutad') return [];
    return [{ genomgangId: r.id, patientId: r.patient_id, startad: r.startad, startadAv: personNamn(db, r.startad_av), status: g.status, statusText: g.statusText }];
  });
}
