// Uppmärksamhetsinformation (Sussa 3.1.5.1 till 3.1.5.3).
//
// Strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens informationsspecifikation för
// uppmärksamhetsinformation, så som de står i tabell 1 i Socialstyrelsens Instruktion för ändringsförslag gällande
// Uppmärksamhetsinformation (2025-09-30, dnr 1015/2025). Överkänslighet har tre grader: livshotande, skadlig och
// besvärande. Runda 10, r4: termerna, koderna och motiveringarna är kodverkslistan till informationsspecifikationen
// version 6.1.2 (umi-kodverk.js), med Snomed CT, ICD-10-SE och ATC. Se docs/design.md.
//
// Systemet är experten: överkänsligheter som redan är registrerade ingår direkt, och förslagsreglerna i
// uppmarksamhet-regler.js (demoregler) föreslår uppmärksamhetsinformation ur läkemedelslistan och diagnoserna. Läkaren
// bekräftar eller avfärdar med ett klick. Det som systemet inte kan räkna ut registreras ur en kort lista, aldrig som
// fritext.
//
// Behörighet: att läsa kräver las_oversikt (läkare, sjuksköterska och undersköterska), att bekräfta, registrera och
// avsluta kräver skriv_journal (läkare). Uppmärksamhetsinformation är gemensam som läkemedelslistan och överkänsligheten:
// den kräver inget aktivt val mellan vårdenheter, men spärrar gäller. Servern loggar varje anrop som vanligt.
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { synligaOrdinationer, aktuell as ordinationAktuell } from './lakemedel.js';
import { synligaDiagnoser, kallaEtikett } from './journal.js';
import { foresla, foreslagenGrad, REGLER } from './uppmarksamhet-regler.js';
// Runda 10, r4: Socialstyrelsens kodverkslista för uppmärksamhetsinformation.
import { TERMER as KODVERK_TERMER, termMedId, termFor, nationell, reaktionFor } from './umi-kodverk.js';

export const KATEGORIER = {
  medicinskt: { namn: 'Medicinska tillstånd och behandlingar', kort: 'Medicinskt', undergrupper: {
    annat_tillstand: 'Annat medicinskt tillstånd', behandling: 'Behandling', implantat: 'Förekomst av implantat', transplantat: 'Förekomst av transplantat',
  } },
  smitta: { namn: 'Smitta', kort: 'Smitta', undergrupper: { smittamne: 'Förekomst av smittämne', smittsam_sjukdom: 'Förekomst av smittsam sjukdom' } },
  overkanslighet: { namn: 'Överkänslighet', kort: 'Överkänslighet', undergrupper: {
    kemikalie: 'Kemikalie', aktiv_substans: 'Aktiv substans', hjalpamne: 'Hjälpämne läkemedel', lakemedelsprodukt: 'Läkemedelsprodukt',
    ovrigt: 'Övrig överkänslighet, utanför undergrupperna i tabellen',
  } },
  vardrutin: { namn: 'Särskild vårdrutin', kort: 'Särskild vårdrutin', undergrupper: {
    information: 'Information som kan leda till särskild vårdrutin', beslut: 'Beslut som kan leda till särskild vårdrutin',
  } },
};
export const GRADER = { livshotande: 'Livshotande överkänslighet', skadlig: 'Skadlig överkänslighet', besvarande: 'Besvärande överkänslighet' };
const GRADORDNING = ['livshotande', 'skadlig', 'besvarande'];

// Det som systemet inte kan räkna ut ur journalen registreras ur den här listan, som är Socialstyrelsens kodverkslista
// (runda 10, r4, umi-kodverk.js) utom överkänsligheterna, som registreras som överkänslighet med reaktion och grad.
export const TERMER = KODVERK_TERMER.filter(t => t.kategori !== 'overkanslighet').map(t => ({ id: t.id, kategori: t.kategori, undergrupp: t.undergrupp, term: t.term, motivering: t.motivering ?? '', kalla: 'socialstyrelsen' }));

const ATKOMST_LAS = 'las_oversikt';
const ATKOMST_SKRIV = 'skriv_journal';
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? null;
const personRad = (db, id) => db.query('SELECT namn, titel FROM personal WHERE id = ?').get(id);

// Den bekräftade graden för varje överkänslighet, ur raderna med kalla_typ overkanslighet.
function graderFor(db, pid) {
  const m = new Map();
  for (const r of db.query("SELECT * FROM uppmarksamhet WHERE patient_id = ? AND kalla_typ = 'overkanslighet' AND status = 'aktiv'").all(pid)) m.set(r.kalla_id, r);
  return m;
}

// Raderna som utgör patientens uppmärksamhetsinformation: aktiva rader och alla registrerade överkänsligheter. Rader och
// överkänsligheter filtreras med behörighetsmotorn om atk ges (personalen), annars alla (patienten själv).
function raderFor(db, pid, atk = null) {
  const filtrera = (rader) => (atk ? atk.filtrera(rader, ATKOMST_LAS, { gemensam: true }) : rader);
  const grader = graderFor(db, pid);
  const ovr = filtrera(db.query("SELECT * FROM uppmarksamhet WHERE patient_id = ? AND status = 'aktiv' AND kategori <> 'overkanslighet' ORDER BY registrerad, id").all(pid));
  const ok = filtrera(db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv' ORDER BY datum, id").all(pid)).map(o => ({ o, bekr: grader.get(o.id) ?? null }));
  return { ovr, ok };
}

function postUt(db, r, { medPersonal = true } = {}) {
  const reg = r.registrerad_enhet ?? r.enhet_id;
  const registrerad = { tid: r.registrerad, vardenhet: { id: vardenhetFor(db, reg), namn: enhetsnamn(db, vardenhetFor(db, reg)) } };
  if (medPersonal) { const p = personRad(db, r.registrerad_av); Object.assign(registrerad, { av: p?.namn ?? null, titel: p?.titel ?? null }); }
  return {
    id: r.id, kategori: r.kategori, kategoriText: KATEGORIER[r.kategori].namn, undergrupp: r.undergrupp, undergruppText: KATEGORIER[r.kategori].undergrupper[r.undergrupp] ?? r.undergrupp,
    term: r.term, motivering: r.motivering, grad: null, bekraftad: true, kod: r.kod ? { system: r.kodsystem, kod: r.kod } : null,
    kalla: r.kalla_typ ? { typ: r.kalla_typ, id: r.kalla_id } : null, registrerad, kallaEtikett: kallaEtikett(r.kalla, r.registrerad), regel: r.regel,
    // Runda 10, r4: termen i Socialstyrelsens kodverkslista med Snomed CT, ICD-10-SE och ATC, eller null för en äldre term.
    nationell: nationell(termFor(r.undergrupp, r.term)),
  };
}

// En överkänslighet som post. Graden är bekräftad när det finns en rad med den, annars föreslagen av systemet.
function overkanslighetPost(db, { o, bekr }, { medPersonal = true } = {}) {
  const undergrupp = o.atc ? 'aktiv_substans' : 'ovrigt';
  const ut = {
    id: bekr?.id ?? null, overkanslighetId: o.id, kategori: 'overkanslighet', kategoriText: KATEGORIER.overkanslighet.namn, undergrupp,
    undergruppText: KATEGORIER.overkanslighet.undergrupper[undergrupp], term: o.amne, motivering: o.reaktion, grad: bekr?.grad ?? foreslagenGrad(o),
    bekraftad: Boolean(bekr), kod: o.atc ? { system: 'atc', kod: o.atc } : null, kalla: { typ: 'overkanslighet', id: o.id },
    registrerad: { tid: o.datum, vardenhet: { id: vardenhetFor(db, o.enhet_id), namn: enhetsnamn(db, vardenhetFor(db, o.enhet_id)) } },
    kallaEtikett: kallaEtikett(o.kalla, o.datum), regel: null,
    // Runda 10, r4: reaktionen som term i kodverkslistan (varningsinformation eller observandum) med Snomed CT.
    nationell: null, reaktion: reaktionFor(o.reaktion),
  };
  if (bekr) {
    ut.gradBekraftad = { tid: bekr.registrerad };
    if (medPersonal) { const p = personRad(db, bekr.registrerad_av); Object.assign(ut.gradBekraftad, { av: p?.namn ?? null, titel: p?.titel ?? null }); }
  }
  return ut;
}

// Symbolen: vilka huvudgrupper som har information och den allvarligaste graden av överkänslighet. Inget innehåll.
export function symbol(poster) {
  const har = (k) => poster.some(p => p.kategori === k);
  const grader = poster.filter(p => p.kategori === 'overkanslighet').map(p => p.grad);
  return { medicinskt: har('medicinskt'), smitta: har('smitta'), overkanslighet: GRADORDNING.find(g => grader.includes(g)) ?? null, vardrutin: har('vardrutin') };
}

const sortera = (poster) => poster.sort((a, b) => Object.keys(KATEGORIER).indexOf(a.kategori) - Object.keys(KATEGORIER).indexOf(b.kategori)
  || GRADORDNING.indexOf(a.grad) - GRADORDNING.indexOf(b.grad) || String(a.term).localeCompare(String(b.term), 'sv'));

function posterFor(atk) {
  const { ovr, ok } = raderFor(atk.db, atk.patientId, atk);
  return sortera([...ok.map(x => overkanslighetPost(atk.db, x)), ...ovr.map(r => postUt(atk.db, r))]);
}

// Förslagen för den inloggade läkaren: nya uppgifter ur det läkaren får se i journalen, och att avsluta en uppgift vars
// behandling har satts ut. Ett förslag som har bekräftats eller avfärdats kommer inte tillbaka.
function forslagFor(atk, poster) {
  const db = atk.db;
  if (!kanRoll(atk.personal, ATKOMST_SKRIV) || !atk.prova(ATKOMST_SKRIV).tillaten) return [];
  const ord = synligaOrdinationer(atk);
  const katalog = (id) => db.query('SELECT namn, atc FROM katalog WHERE id = ?').get(id);
  const ordinationer = ord.map(o => ({ id: o.id, typ: o.typ, aktuell: ordinationAktuell(o), lakemedel: katalog(o.lakemedel_id) }));
  const diagnoser = synligaDiagnoser(atk).map(d => ({ id: d.id, kod: d.kod, text: d.text }));
  const utanGrad = poster.filter(p => p.kategori === 'overkanslighet' && !p.bekraftad).map(p => db.query('SELECT * FROM overkanslighet WHERE id = ?').get(p.overkanslighetId));
  const hanterade = db.query("SELECT regel, term, kalla_typ, kalla_id, status FROM uppmarksamhet WHERE patient_id = ? AND status IN ('aktiv', 'avfard')").all(atk.patientId);
  const aktivaTermer = new Set(poster.map(p => `${p.kategori}:${p.term}`));
  const nya = foresla({ ordinationer, diagnoser, overkanslighet: utanGrad }).filter(f =>
    !aktivaTermer.has(`${f.kategori}:${f.term}`) || f.regel === 'overkanslighet-grad')
    .filter(f => !hanterade.some(h => h.regel === f.regel && (h.term === f.term || (h.kalla_typ === f.kalla.typ && h.kalla_id === f.kalla.id))))
    .map(f => ({ typ: 'ny', ...f, kategoriText: KATEGORIER[f.kategori].namn, undergruppText: KATEGORIER[f.kategori].undergrupper[f.undergrupp] }));
  // Avsluta: uppgifter som kom från en ordination som inte längre är aktuell.
  const avsluta = [];
  for (const p of poster.filter(x => x.kalla?.typ === 'ordination' && x.id)) {
    // Bara ordinationer som läkaren får se: namnet och orsaken till utsättningen röjer annars spärrade uppgifter.
    const o = ord.find(x => x.id === p.kalla.id);
    if (!o || ordinationAktuell(o)) continue;
    const ersatt = ordinationer.find(x => x.aktuell && x.id !== o.id && foresla({ ordinationer: [x], diagnoser: [] }).some(f => f.regel === p.regel));
    if (ersatt) continue;
    const namn = katalog(o.lakemedel_id)?.namn ?? 'Läkemedlet';
    avsluta.push({
      typ: 'avsluta', nyckel: `avsluta:${p.id}`, postId: p.id, regel: p.regel, kategori: p.kategori, term: p.term, demoregel: true,
      varfor: `${namn} är utsatt${o.utsatt_orsak ? ` (${o.utsatt_orsak})` : ''}, och ingen annan ordination i läkemedelslistan ger samma uppmärksamhetsinformation.`,
      orsak: `${namn} är utsatt`,
    });
  }
  return [...avsluta, ...nya];
}

// Uppmärksamhetsinformationen i patienthuvudet. null för roller som inte läser översikten (vårdadministratören).
export function forHuvud(atk) {
  if (!kanRoll(atk.personal, ATKOMST_LAS)) return null;
  const poster = posterFor(atk);
  const kanAndra = kanRoll(atk.personal, ATKOMST_SKRIV) && atk.prova(ATKOMST_SKRIV).tillaten;
  // Runda 10, r2: läkare och sjuksköterskor registrerar, ändrar och avslutar överkänslighet (overkanslighet.js).
  const kanAndraOverkanslighet = kanRoll(atk.personal, 'registrera_overkanslighet') && atk.prova('registrera_overkanslighet', { enhet_id: atk.personal.enhet_id }).tillaten;
  return { symbol: symbol(poster), poster, forslag: forslagFor(atk, poster), kanAndra, kanAndraOverkanslighet };
}

// Symbolen för en rad i arbetslistan eller väntrummet: bara huvudgrupperna, med samma grund som journalen. Loggas inte,
// eftersom innehållet inte lämnas ut; det öppnas med patientens journal, som loggas.
export function symbolFor(db, personal, patientId, val = {}) {
  if (!kanRoll(personal, ATKOMST_LAS)) return null;
  const atk = new Atkomst(db, personal, patientId, val, ATKOMST_LAS);
  if (!atk.prova(ATKOMST_LAS).tillaten) return null;
  const { ovr, ok } = raderFor(db, patientId, atk);
  return symbol([...ok.map(x => ({ kategori: 'overkanslighet', grad: x.bekr?.grad ?? foreslagenGrad(x.o) })), ...ovr]);
}

// Patientens egen uppmärksamhetsinformation i Min journal: utan förslag och utan personalens namn och id.
export function forInvanare(db, pid) {
  const { ovr, ok } = raderFor(db, pid);
  const poster = sortera([...ok.map(x => overkanslighetPost(db, x, { medPersonal: false })), ...ovr.map(r => postUt(db, r, { medPersonal: false }))])
    .map(({ regel: _r, kalla: _k, overkanslighetId: _o, ...p }) => p);
  return { symbol: symbol(poster), poster };
}

// En uppgift som systemet har tagit fram ur en diagnos, en ordination eller en överkänslighet sparas på källans enhet, så
// att källans spärr och inre sekretess följer med. Annars kunde en uppgift som läkaren såg med patientens samtycke bli
// synlig för alla i vårdgivaren.
const KALLTABELL = { diagnos: 'diagnoser', ordination: 'ordinationer', overkanslighet: 'overkanslighet' };
const kallansEnhet = (db, kalla) => (KALLTABELL[kalla?.typ] && kalla.id != null
  ? db.query(`SELECT enhet_id FROM ${KALLTABELL[kalla.typ]} WHERE id = ?`).get(kalla.id)?.enhet_id ?? null : null);
const insert = (db, atk, f, status = 'aktiv') => db.query(`INSERT INTO uppmarksamhet (patient_id, enhet_id, kategori, undergrupp, term, motivering, kodsystem, kod, grad,
    kalla_typ, kalla_id, regel, status, registrerad, registrerad_av, registrerad_enhet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(atk.patientId, kallansEnhet(db, f.kalla) ?? atk.personal.enhet_id, f.kategori, f.undergrupp, f.term, f.motivering ?? null, f.kod?.system ?? null, f.kod?.kod ?? null, f.grad ?? null,
    f.kalla?.typ ?? null, f.kalla?.id ?? null, f.regel ?? null, status, iso(), atk.personal.id, atk.personal.enhet_id);

function hittaForslag(atk, nyckel) {
  if (typeof nyckel !== 'string') throw new Fel(400, 'Välj ett förslag.', 'ogiltig', { falt: ['forslag'] });
  const poster = posterFor(atk);
  const f = forslagFor(atk, poster).find(x => x.nyckel === nyckel && x.typ === 'ny');
  if (!f) throw new Fel(400, 'Förslaget finns inte längre. Uppgiften kan redan vara registrerad eller avfärdad.', 'ogiltig', { falt: ['forslag'] });
  return f;
}

// Bekräftar ett förslag ({ forslag, grad? }) eller registrerar en term ur listan ({ term }). Läkaren kan ändra graden
// på en överkänslighet; annars gäller systemets förslag.
export function registrera(atk, { forslag, term, grad } = {}) {
  atk.krav(ATKOMST_SKRIV, { resurs: { enhet_id: atk.personal.enhet_id } });
  if (forslag !== undefined) {
    const f = hittaForslag(atk, forslag);
    if (f.kategori === 'overkanslighet' && grad !== undefined) {
      if (!GRADER[grad]) throw new Fel(400, 'Välj livshotande, skadlig eller besvärande.', 'ogiltig', { falt: ['grad'] });
      f.grad = grad;
    }
    insert(atk.db, atk, f);
    return forHuvud(atk);
  }
  const nt = termMedId(term);
  const t = nt && TERMER.find(x => x.id === nt.id);
  if (!t) throw new Fel(400, 'Välj en uppgift i listan.', 'ogiltig', { falt: ['term'] });
  if (posterFor(atk).some(p => p.kategori === t.kategori && p.term === t.term)) {
    throw new Fel(400, `${t.term} finns redan som uppmärksamhetsinformation för patienten.`, 'ogiltig', { falt: ['term'] });
  }
  insert(atk.db, atk, { ...t, regel: null });
  return forHuvud(atk);
}

// Avfärdar ett förslag. Det sparas, så att samma förslag inte kommer tillbaka, men blir aldrig uppmärksamhetsinformation.
export function avfarda(atk, { forslag } = {}) {
  atk.krav(ATKOMST_SKRIV, { resurs: { enhet_id: atk.personal.enhet_id } });
  const f = hittaForslag(atk, forslag);
  if (f.kategori === 'overkanslighet') throw new Fel(400, 'En registrerad överkänslighet är alltid uppmärksamhetsinformation. Bekräfta graden i stället.', 'ogiltig');
  insert(atk.db, atk, f, 'avfard');
  return forHuvud(atk);
}

export function hamtaRad(db, id) {
  const r = db.query("SELECT * FROM uppmarksamhet WHERE id = ? AND status <> 'avfard'").get(Number(id));
  if (!r) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  return r;
}

// Avslutar en uppgift med orsak. Raden finns kvar och visar vem som avslutade den, när och varför.
export function avsluta(atk, r, { orsak } = {}) {
  atk.krav(ATKOMST_SKRIV, { resurs: { enhet_id: r.enhet_id, gemensam: true } });
  if (r.status !== 'aktiv') throw new Fel(400, 'Uppgiften är redan avslutad.', 'ogiltig');
  if (r.kategori === 'overkanslighet') throw new Fel(400, 'En överkänslighet avslutas inte här. Den är uppmärksamhetsinformation så länge den är registrerad.', 'ogiltig');
  const o = typeof orsak === 'string' ? orsak.trim() : '';
  if (o.length < 3 || o.length > 300) throw new Fel(400, 'Ange varför uppgiften avslutas.', 'ogiltig', { falt: ['orsak'] });
  atk.db.query("UPDATE uppmarksamhet SET status = 'avslutad', avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ?").run(iso(), atk.personal.id, o, r.id);
  return forHuvud(atk);
}

export const termer = () => ({ termer: TERMER.map(t => ({ ...t, kategoriText: KATEGORIER[t.kategori].namn, undergruppText: KATEGORIER[t.kategori].undergrupper[t.undergrupp] })), grader: GRADER, regler: REGLER.map(r => ({ id: r.id, beskrivning: r.beskrivning })) });

// Runda 10, r1: när läkaren registrerar en överkänslighet (overkanslighet.js registrera) blir den uppmärksamhetsinformation
// med en bekräftad grad och ATC-koden direkt, med samma rad som när ett förslag bekräftas. Graden är den som läkaren
// valde, annars systemets förslag ur reaktionen och allvarlighetsgraden (foreslagenGrad). Kräver skriv_journal, som all
// annan bekräftelse av uppmärksamhetsinformation. Ger graden, eller null när personen inte bekräftar uppmärksamhetsinformation.
export function bekraftaOverkanslighet(atk, o, grad = null) {
  if (!kanRoll(atk.personal, ATKOMST_SKRIV) || !atk.prova(ATKOMST_SKRIV, { enhet_id: atk.personal.enhet_id }).tillaten) return null;
  if (grad != null && !Object.hasOwn(GRADER, grad)) throw new Fel(400, 'Välj livshotande, skadlig eller besvärande.', 'ogiltig', { falt: ['grad'] });
  const g = grad ?? foreslagenGrad(o);
  insert(atk.db, atk, { kategori: 'overkanslighet', undergrupp: o.atc ? 'aktiv_substans' : 'ovrigt', term: o.amne, motivering: o.reaktion ?? '', grad: g,
    kod: o.atc ? { system: 'atc', kod: o.atc } : null, kalla: { typ: 'overkanslighet', id: o.id }, regel: null });
  return g;
}
