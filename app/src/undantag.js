// Undantag från visning och publicering (runda 7, r4, Sussa 12.1.1.10). Systemförvaltaren kan undanta en sorts uppgift
// (en anteckningstyp eller ett mätvärde) eller en vårdenhet från visning i systemet, från FHIR för externa tillämpningar
// och från publicering till nationella tjänster (simulerade i demon). Ett undantag beslutas med fyra ögon och
// giltighetsdatum som andra ändringar av konfigurationen (konfiguration.js), och det syns alltid vad som är undantaget:
// på systemförvaltningens sida, och för personalen som en rad i journalen med antal, typ och motivering.
//
// Två saker gör ett undantag aldrig. Det gäller inte Min journal, där patienten läser efter vårdgivarens visningsregler
// (patientvy.js), så att det inte kan användas för att gömma uppgifter för patienten. Och det ändrar inga spärrar:
// det prövas först efter behörighetsmotorn, på det som personen redan får se, så att en spärrad uppgift varken visas
// eller räknas.
import { Fel, iso, addDagar, giltigtDatum, datumAv } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { andringUt, godkann as godkannAndring, avsluta as avslutaAndring } from './konfiguration.js';

export const KANALER = {
  visning: 'Visning i systemet',
  fhir: 'FHIR för externa tillämpningar',
  nationell: 'Publicering till nationella tjänster (simulerad)',
};
// Runda 12, r1: också en enskild anteckning (Sussa 12.1.1.10). Undantaget gäller alla versioner av anteckningen.
export const OMFANG = { anteckningstyp: 'Anteckningstyp', matvarde: 'Mätvärde', enhet: 'Vårdenhet', anteckning: 'En enskild anteckning' };
const nyckelFor = (omfang, varde) => `${omfang}:${varde}`;

let jm = null;
const journal = () => (jm ??= require('./journal.js'));

// Vad som kan undantas, med namnen. Läkemedel, överkänslighet, uppmärksamhetsinformation och diagnoser finns inte med:
// de behövs för patientsäkerheten, och läkemedlen ska till Nationella läkemedelslistan enligt lag.
export function valbara(db) {
  return {
    anteckningstyp: journal().MALLAR.map(m => ({ varde: m.typ, namn: m.typ })),
    matvarde: Object.entries(journal().MATTYPER).map(([k, m]) => ({ varde: k, namn: m.namn })),
    enhet: db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all().map(e => ({ varde: e.id, namn: e.namn })),
    // Runda 12, r1: en enskild anteckning väljs med sitt nummer, inte ur en lista.
    anteckning: [],
  };
}
const ALDRIG = 'Läkemedel, överkänslighet, uppmärksamhetsinformation och diagnoser kan inte undantas. De behövs för patientsäkerheten, och läkemedlen ska rapporteras till Nationella läkemedelslistan.';
const MIN_JOURNAL = 'Undantaget gäller aldrig Min journal, där patienten läser sin journal efter vårdgivarens visningsregler. Det ändrar inga spärrar.';

// Runda 12, r1: en enskild anteckning beskrivs med typ, vårdenhet och datum, aldrig med patienten eller texten.
function anteckningRad(db, varde) {
  return /^\d{1,12}$/.test(String(varde ?? '')) ? db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(varde)) : null;
}
const anteckningNamn = (db, a) => `${a.typ} från ${db.query('SELECT namn FROM enheter WHERE id = ?').get(a.enhet_id)?.namn ?? a.enhet_id}, ${String(a.signerad_tid ?? a.skapad).slice(0, 10)} (nummer ${a.id})`;
// Alla versioner av en anteckning: rättelserna bakåt och framåt i kedjan.
function versionsId(db, id) {
  const ut = new Set();
  let rot = db.query('SELECT id, ersatter_id FROM anteckningar WHERE id = ?').get(id);
  for (let i = 0; rot?.ersatter_id && i < 50; i++) rot = db.query('SELECT id, ersatter_id FROM anteckningar WHERE id = ?').get(rot.ersatter_id);
  let nu = rot;
  for (let i = 0; nu && i < 50; i++) { ut.add(nu.id); nu = db.query('SELECT id, ersatter_id FROM anteckningar WHERE ersatter_id = ?').get(nu.id); }
  return ut;
}
// Runda 13, r3 (beslut från Jonas, säkerhetsfynd 5): en enskild anteckning undantas efter en begäran från vården. Den
// som skrev anteckningen eller patientens ansvariga läkare begär undantaget från anteckningens meny med kanal och skäl.
// Systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men aldrig innehållet eller
// patienten, och föreslår undantaget som en andra systemförvaltare godkänner. Ett nummer utan begäran ger samma svar
// vare sig anteckningen finns eller inte, så att förhandsvisningen inte går att använda för att slå upp anteckningar.
// Patientens ansvariga läkare är i demon en läkare på den vårdenhet som skrev anteckningen, eftersom Vårdkällan inte
// har en fast läkare per patient (demoregel).
export function sakraBegaran(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS undantag_begaranden (
    id INTEGER PRIMARY KEY AUTOINCREMENT, anteckning_id INTEGER NOT NULL, enhet_id TEXT NOT NULL, begard_av TEXT NOT NULL,
    begard_tid TEXT NOT NULL, kanaler TEXT NOT NULL, skal TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'vantar'
      CHECK (status IN ('vantar', 'foreslagen', 'beslutad', 'avslagen')),
    andring_id INTEGER, beslutad_av TEXT, beslutad TEXT, kommentar TEXT)`);
  db.exec('CREATE INDEX IF NOT EXISTS ix_undantag_begaranden_anteckning ON undantag_begaranden (anteckning_id)');
  return db;
}
export const BEGARAN_STATUS = { vantar: 'Väntar på systemförvaltningen', foreslagen: 'Föreslagen, väntar på en andra systemförvaltare', beslutad: 'Beslutad', avslagen: 'Avslagen' };
export const INGEN_BEGARAN = 'Det finns ingen begäran från vården om att undanta en anteckning med det numret. En enskild anteckning undantas efter en begäran från den som skrev den eller patientens ansvariga läkare, och begäran står under Begäranden från vården.';
const PAGAENDE = 'Anteckningen hör till en pågående vårdkontakt, och uppgifter som behövs i pågående vård kan inte döljas i systemet. Undanta den bara från FHIR och nationella tjänster, eller vänta tills kontakten är avslutad.';
const OPPNA_STATUS = ['vantar', 'foreslagen'];
const OPPNA = `(${OPPNA_STATUS.map(x => `'${x}'`).join(', ')})`;
// Begäran för en anteckning: den öppna, annars den senaste. Alla versioner i kedjan räknas som samma anteckning.
function begaranRad(db, anteckningId, { oppen = false } = {}) {
  sakraBegaran(db);
  const ids = [...versionsId(db, Number(anteckningId))];
  if (!ids.length) return null;
  const ph = ids.map(() => '?').join(', ');
  return db.query(`SELECT * FROM undantag_begaranden WHERE anteckning_id IN (${ph})${oppen ? ` AND status IN ${OPPNA}` : ''} ORDER BY (status IN ${OPPNA}) DESC, id DESC LIMIT 1`).get(...ids);
}
const arPagaende = (db, a) => Boolean(a.vardkontakt_id && db.query('SELECT 1 FROM vardkontakter WHERE id = ? AND slut IS NULL').get(a.vardkontakt_id));
const begaranUt = (db, b) => (b ? { id: b.id, status: b.status, statusText: BEGARAN_STATUS[b.status], kanaler: JSON.parse(b.kanaler), skal: b.skal, begard: b.begard_tid,
  begardAv: db.query('SELECT namn, titel FROM personal WHERE id = ?').get(b.begard_av) ?? null, kommentar: b.kommentar ?? null } : null);

// Om den inloggade får begära undantag för anteckningen. atk är redan prövad för att läsa anteckningen.
export function kanBegara(atk, a) {
  const p = atk.personal;
  if (a.status !== 'signerad') return false;
  if (a.forfattare_id === p.id || a.signerad_av === p.id) return true;
  return p.yrke === 'lakare' && vardenhetFor(atk.db, p.enhet_id) === vardenhetFor(atk.db, a.enhet_id);
}
// Det journalen visar om begäran för den som läser anteckningen.
export function begaranForLasare(atk, a) {
  return { kan: kanBegara(atk, a), begaran: begaranUt(atk.db, begaranRad(atk.db, a.id)), pagaende: arPagaende(atk.db, a) };
}

export function begar(atk, a, body = {}, nu = new Date()) {
  const db = atk.db;
  sakraBegaran(db);
  if (a.status !== 'signerad') throw new Fel(400, 'Bara en signerad anteckning kan undantas. Ett utkast ändrar du själv.', 'ogiltig');
  if (!kanBegara(atk, a)) {
    atk.logga('undanta', atk.grund(), `undantag_begaran:anteckning:${a.id}`, 'nekad');
    throw new Fel(403, 'Bara den som skrev anteckningen eller patientens ansvariga läkare kan begära att den undantas. Kontakta någon av dem.', 'nekad');
  }
  const kanaler = Array.isArray(body.kanaler) ? [...new Set(body.kanaler)].filter(x => typeof x === 'string').sort() : [];
  if (!kanaler.length || kanaler.some(x => !Object.hasOwn(KANALER, x))) throw new Fel(400, 'Välj var anteckningen inte ska visas eller lämnas ut: i systemet, genom FHIR eller till nationella tjänster.', 'ogiltig', { falt: ['kanaler'] });
  const skal = typeof body.skal === 'string' ? body.skal.trim().split(/\s+/).join(' ') : '';
  if (skal.length < 10) throw new Fel(400, 'Skriv varför anteckningen ska undantas, med minst tio tecken. Skälet blir motiveringen som personalen ser i journalen, så skriv det utan patientuppgifter.', 'ogiltig', { falt: ['skal'] });
  if (skal.length > 500) throw new Fel(400, 'Skälet får vara högst 500 tecken.', 'ogiltig', { falt: ['skal'] });
  if (kanaler.includes('visning') && arPagaende(db, a)) throw new Fel(400, PAGAENDE, 'ogiltig', { falt: ['kanaler'] });
  if (begaranRad(db, a.id, { oppen: true })) throw new Fel(409, 'Det finns redan en begäran för anteckningen som väntar på systemförvaltningen.', 'ogiltig');
  const id = Number(db.query('INSERT INTO undantag_begaranden (anteckning_id, enhet_id, begard_av, begard_tid, kanaler, skal) VALUES (?, ?, ?, ?, ?, ?)')
    .run(a.id, vardenhetFor(db, a.enhet_id) ?? a.enhet_id, atk.personal.id, iso(nu), JSON.stringify(kanaler), skal).lastInsertRowid);
  atk.logga('undanta', atk.grund(), `undantag_begaran:anteckning:${a.id}`);
  return { begaran: begaranUt(db, db.query('SELECT * FROM undantag_begaranden WHERE id = ?').get(id)) };
}

// Systemförvaltarens lista: nummer, typ, datum, vårdenhet och den som begär. Aldrig patienten eller innehållet.
function begarandenUt(db) {
  sakraBegaran(db);
  return db.query(`SELECT * FROM undantag_begaranden WHERE status IN ${OPPNA} ORDER BY id`).all().map(b => {
    const a = db.query('SELECT id, typ, signerad_tid, skapad FROM anteckningar WHERE id = ?').get(b.anteckning_id);
    return { nummer: b.anteckning_id, typ: a?.typ ?? null, datum: String(a?.signerad_tid ?? a?.skapad ?? '').slice(0, 10),
      vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(b.enhet_id)?.namn ?? b.enhet_id, ...begaranUt(db, b) };
  });
}

export function avslaBegaran(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  sakraBegaran(db);
  const b = db.query('SELECT * FROM undantag_begaranden WHERE id = ?').get(Number(id) || 0);
  if (!b) throw new Fel(404, 'Begäran finns inte.', 'saknas');
  if (b.status !== 'vantar') throw new Fel(409, 'Begäran är redan hanterad.', 'ogiltig');
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (!k) throw new Fel(400, 'Skriv varför begäran avslås, så att den som begärde vet vad som behöver göras.', 'ogiltig', { falt: ['kommentar'] });
  db.query("UPDATE undantag_begaranden SET status = 'avslagen', beslutad_av = ?, beslutad = ?, kommentar = ? WHERE id = ?").run(personal.id, iso(nu), k, b.id);
  loggaAtgard(db, personal, `undantag_begaran:${b.id}`);
  return { begaranden: begarandenUt(db) };
}

// När ett förslag om en enskild anteckning föreslås eller beslutas följer begäran med.
function uppdateraBegaran(db, andring) {
  if (!andring?.nyckel?.startsWith('anteckning:')) return;
  sakraBegaran(db);
  const status = andring.status === 'godkand' ? 'beslutad' : andring.status === 'vantar' ? 'foreslagen' : 'vantar';
  db.query(`UPDATE undantag_begaranden SET status = ?, andring_id = ?, beslutad = ? WHERE id = (SELECT id FROM undantag_begaranden WHERE anteckning_id = ? AND status IN ${OPPNA} ORDER BY id DESC LIMIT 1)`)
    .run(status, andring.id, iso(), Number(andring.nyckel.split(':')[1]));
}

const namnFor = (db, omfang, varde) => {
  if (omfang === 'anteckning') { const a = anteckningRad(db, varde); return a ? anteckningNamn(db, a) : `anteckning ${varde}`; }
  return valbara(db)[omfang]?.find(x => x.varde === varde)?.namn ?? varde;
};

// Undantagen som gäller en dag: det senast godkända värdet per nyckel. Ett värde utan kanaler avslutar undantaget.
export function aktiva(db, nu = new Date()) {
  let rader = [];
  try {
    rader = db.query(`SELECT * FROM konfig_andringar WHERE slag = 'undantag' AND status = 'godkand' AND galler_fran <= ?
      ORDER BY galler_fran DESC, beslutad DESC, id DESC`).all(datumAv(nu));
  } catch { return []; }
  const sedda = new Set();
  const ut = [];
  for (const r of rader) {
    if (sedda.has(r.nyckel)) continue;
    sedda.add(r.nyckel);
    const v = JSON.parse(r.varde);
    if (!v.kanaler?.length) continue;
    const [omfang, ...rest] = r.nyckel.split(':');
    ut.push({ id: r.id, nyckel: r.nyckel, omfang, varde: rest.join(':'), kanaler: v.kanaler, motivering: r.motivering, gallerFran: r.galler_fran, beslutadAv: r.beslutad_av });
  }
  return ut;
}

// En prövning för en kanal: funktion(rad, sort) som ger undantaget som träffar raden, eller null. sort är anteckning
// eller matvarde. Byggs en gång per anrop.
export function provare(db, kanal, nu = new Date()) {
  const lista = aktiva(db, nu).filter(u => u.kanaler.includes(kanal));
  if (!lista.length) return () => null;
  const enheter = new Map(lista.filter(u => u.omfang === 'enhet').map(u => [u.varde, u]));
  const typer = new Map(lista.filter(u => u.omfang === 'anteckningstyp').map(u => [u.varde, u]));
  const mat = new Map(lista.filter(u => u.omfang === 'matvarde').map(u => [u.varde, u]));
  // Runda 12, r1: enskilda anteckningar, med alla versioner i kedjan.
  const enskilda = new Map();
  for (const u of lista.filter(x => x.omfang === 'anteckning')) for (const id of versionsId(db, Number(u.varde))) enskilda.set(id, u);
  return (rad, sort) => {
    const e = rad.enhet_id ?? rad.fran_enhet_id;
    if (e && enheter.size) { const u = enheter.get(vardenhetFor(db, e)); if (u) return u; }
    if (sort === 'anteckning' && enskilda.size && rad.id != null) { const u = enskilda.get(Number(rad.id)); if (u) return u; }
    if (sort === 'anteckning') return typer.get(rad.typ) ?? null;
    if (sort === 'matvarde') return mat.get(rad.typ) ?? null;
    return null;
  };
}

// Visning i systemet: tar bort undantagna rader ur det som personen redan får se, och räknar dem på atk, så att journalen
// kan säga vad som inte visas och varför.
export function filtreraVisning(atk, rader, sort) {
  const prova = provare(atk.db, 'visning');
  const ut = [];
  for (const r of rader) {
    const u = prova(r, sort);
    if (!u) { ut.push(r); continue; }
    atk.undantagna ??= new Map();
    const k = `${u.nyckel}|${sort}`;
    const f = atk.undantagna.get(k) ?? { sort, nyckel: u.nyckel, omfang: u.omfang, namn: namnFor(atk.db, u.omfang, u.varde), motivering: u.motivering, gallerFran: u.gallerFran, antal: 0 };
    f.antal++;
    atk.undantagna.set(k, f);
  }
  return ut;
}

// Raderna i journalens svar: en per undantag, med antal och motivering, utan något om uppgifternas innehåll.
export function undantagnaUt(atk) {
  return [...(atk.undantagna?.values() ?? [])].map(u => ({
    antal: u.antal, sort: u.sort, text: u.omfang === 'anteckning'
      // Runda 12, r1: en enskild anteckning beskrivs utan typ, vårdenhet och datum, eftersom de kan säga vad den handlar om.
      ? `1 anteckning visas inte. Systemförvaltningen har undantagit den från visning från ${u.gallerFran}: ${u.motivering}`
      : `${u.antal} ${u.sort === 'anteckning' ? (u.antal === 1 ? 'anteckning' : 'anteckningar') : (u.antal === 1 ? 'mätvärde' : 'mätvärden')} ${u.omfang === 'enhet' ? `från ${u.namn}` : `av typen ${u.namn}`} visas inte. Systemförvaltningen har undantagit ${u.omfang === 'enhet' ? 'vårdenhetens uppgifter' : 'typen'} från visning från ${u.gallerFran}: ${u.motivering}`,
  }));
}

// FHIR för externa tillämpningar: om en resurs är undantagen. Composition är en anteckning och Observation ett mätvärde.
// Runda 12, r1: producenten för tjänstekontrakt publicerar till nationella tjänster och prövar därför också kanalen
// nationell (nationell: true). Det gör aldrig att något som är undantaget från FHIR lämnas ut.
export function fhirProvare(db, typ, { nationell = false } = {}) {
  const prova = provare(db, 'fhir');
  const provaNat = nationell ? provare(db, 'nationell') : () => null;
  const sort = typ === 'Composition' ? 'anteckning' : typ === 'Observation' ? 'matvarde' : null;
  return (rad) => Boolean(prova(rad, sort) || provaNat(rad, sort));
}

// Publiceringen till nationella tjänster (simulerad): vad som skulle publiceras och vad som är undantaget, i antal.
// En producent av ett nationellt tjänstekontrakt prövar varje rad med provare(db, 'nationell').
export function publicering(db, nu = new Date()) {
  const prova = provare(db, 'nationell', nu);
  const rakna = (tabell, sort, villkor = '1 = 1') => {
    const rader = db.query(`SELECT id, typ, enhet_id FROM ${tabell} WHERE ${villkor}`).all();
    const undantagna = rader.filter(r => prova(r, sort)).length;
    return { antal: rader.length - undantagna, undantagna };
  };
  return [
    { id: 'anteckningar', text: 'Journalanteckningar', ...rakna('anteckningar', 'anteckning', "status = 'signerad'") },
    { id: 'matvarden', text: 'Mätvärden och provsvar', ...rakna('matvarden', 'matvarde') },
  ];
}

const kravRoll = (personal) => { if (!kanRoll(personal, 'undanta')) throw new Fel(403, 'Bara systemförvaltningen beslutar om undantag.', 'nekad'); };

// Kontrollerar ett undantag och räknar fram vad det gäller, bara med antal. Returnerar { ok, varfor, effekt }.
export function prova(db, { omfang, varde, kanaler } = {}, nu = new Date()) {
  if (!Object.hasOwn(OMFANG, omfang)) return { ok: false, varfor: `Välj vad som ska undantas: en anteckningstyp, ett mätvärde, en vårdenhet eller en enskild anteckning. ${ALDRIG}` };
  const k = Array.isArray(kanaler) ? [...new Set(kanaler)] : [];
  if (k.some(x => !Object.hasOwn(KANALER, x))) return { ok: false, varfor: 'Okänd kanal.' };
  // Runda 12, r1: en enskild anteckning. Bara en signerad anteckning kan undantas, och aldrig en som hör till en pågående
  // vårdkontakt om den ska döljas i systemet. Svaret säger bara typ, vårdenhet och datum, aldrig patienten eller texten.
  if (omfang === 'anteckning') {
    const a = anteckningRad(db, varde);
    // Runda 13, r3 (säkerhetsfynd 5): utan en begäran från vården är svaret detsamma vare sig anteckningen finns eller
    // inte. Ett befintligt undantag kan alltid ändras eller avslutas, eftersom numret redan har kommit från vården.
    const harUndantag = a && aktiva(db, nu).some(u => u.nyckel === nyckelFor('anteckning', String(a.id)));
    if (!a || a.status !== 'signerad' || (!begaranRad(db, a.id, { oppen: true }) && !harUndantag)) return { ok: false, varfor: INGEN_BEGARAN };
    const pagaende = arPagaende(db, a);
    if (k.includes('visning') && pagaende) return { ok: false, varfor: PAGAENDE };
    const versioner = versionsId(db, a.id).size;
    const effekt = [`Gäller ${anteckningNamn(db, a)}${versioner > 1 ? ` med alla ${versioner} versioner` : ''}.`];
    if (k.includes('visning')) effekt.push('Personalen ser en rad i journalen om att en anteckning inte visas, med motiveringen, men inte vilken.');
    if (k.includes('fhir')) effekt.push('Externa tillämpningar får inte anteckningen genom FHIR-API:t.');
    if (k.includes('nationell')) effekt.push('Anteckningen publiceras inte till nationella tjänster och lämnas inte ut av producenten för tjänstekontrakt.');
    if (!k.length) effekt.push('Undantaget avslutas, och anteckningen visas och publiceras som förut.');
    effekt.push(MIN_JOURNAL);
    return { ok: true, namn: anteckningNamn(db, a), effekt };
  }
  if (!valbara(db)[omfang].some(x => x.varde === varde)) return { ok: false, varfor: `Det går inte att undanta det valda. ${ALDRIG}` };
  const namn = namnFor(db, omfang, varde);
  const effekt = [];
  if (omfang === 'enhet') {
    const pagaende = db.query("SELECT count(*) AS n FROM vardkontakter WHERE enhet_id IN (SELECT id FROM enheter WHERE id = ?1 OR forald_id = ?1) AND slut IS NULL AND coalesce(planerad, 0) = 0 AND coalesce(automatisk, 0) = 0").get(varde).n;
    if (k.includes('visning') && pagaende) {
      return { ok: false, varfor: `${namn} har ${pagaende} pågående ${pagaende === 1 ? 'vårdkontakt' : 'vårdkontakter'}. Uppgifter som behövs i pågående vård kan inte döljas i systemet. Undanta bara från FHIR och nationella tjänster, eller vänta tills kontakterna är avslutade.` };
    }
    const n = db.query('SELECT count(*) AS n FROM anteckningar WHERE enhet_id IN (SELECT id FROM enheter WHERE id = ?1 OR forald_id = ?1)').get(varde).n;
    const m = db.query('SELECT count(*) AS n FROM matvarden WHERE enhet_id IN (SELECT id FROM enheter WHERE id = ?1 OR forald_id = ?1)').get(varde).n;
    effekt.push(`Gäller ${n} ${n === 1 ? 'anteckning' : 'anteckningar'} och ${m} ${m === 1 ? 'mätvärde' : 'mätvärden'} från ${namn}.`);
  } else {
    const n = omfang === 'anteckningstyp'
      ? db.query('SELECT count(*) AS n FROM anteckningar WHERE typ = ?').get(varde).n
      : db.query('SELECT count(*) AS n FROM matvarden WHERE typ = ?').get(varde).n;
    effekt.push(`Gäller ${n} ${omfang === 'anteckningstyp' ? (n === 1 ? 'anteckning' : 'anteckningar') : (n === 1 ? 'mätvärde' : 'mätvärden')} av typen ${namn}.`);
  }
  if (k.includes('visning')) effekt.push('Personalen ser en rad i journalen om att uppgifterna inte visas, med motiveringen.');
  if (k.includes('fhir')) effekt.push('Externa tillämpningar får inte uppgifterna genom FHIR-API:t.');
  if (k.includes('nationell')) effekt.push('Uppgifterna publiceras inte till nationella tjänster.');
  if (!k.length) effekt.push('Undantaget avslutas, och uppgifterna visas och publiceras som förut.');
  effekt.push(MIN_JOURNAL);
  return { ok: true, namn, effekt };
}

export function forhandsvisa(db, personal, inp = {}, nu = new Date()) {
  kravRoll(personal);
  return prova(db, inp, nu);
}

const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'undanta', resurs, grund: 'administrativ' });

// Föreslår ett undantag, en ändring av ett undantag eller att ett undantag avslutas (kanaler tom).
export function foresla(db, personal, { omfang, varde, kanaler, giltigFran, motivering } = {}, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const datum = giltigFran ?? addDagar(dag, 1);
  if (!giltigtDatum(datum)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['giltigFran'] });
  if (datum < dag) throw new Fel(400, 'Ett undantag kan inte gälla bakåt i tiden.', 'ogiltig', { falt: ['giltigFran'] });
  const m = typeof motivering === 'string' ? motivering.trim() : '';
  if (!m) throw new Fel(400, 'Skriv varför uppgifterna ska undantas. Motiveringen visas för personalen i journalen.', 'ogiltig', { falt: ['motivering'] });
  if (m.length > 500) throw new Fel(400, 'Motiveringen får vara högst 500 tecken.', 'ogiltig', { falt: ['motivering'] });
  const p = prova(db, { omfang, varde, kanaler }, nu);
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: ['omfang', 'varde', 'kanaler'] });
  const nyckel = nyckelFor(omfang, varde);
  const nu_ = aktiva(db, nu).find(u => u.nyckel === nyckel);
  const k = [...new Set(kanaler ?? [])].sort();
  if (!nu_ && !k.length) throw new Fel(400, 'Välj minst en kanal att undanta från.', 'ogiltig', { falt: ['kanaler'] });
  if (nu_ && JSON.stringify([...nu_.kanaler].sort()) === JSON.stringify(k)) throw new Fel(400, 'Undantaget gäller redan just så.', 'ogiltig');
  if (db.query("SELECT 1 FROM konfig_andringar WHERE nyckel = ? AND status = 'vantar'").get(nyckel)) {
    throw new Fel(409, 'Det finns redan en ändring av det här undantaget som väntar på godkännande.', 'ogiltig');
  }
  const r = db.query(`INSERT INTO konfig_andringar (slag, nyckel, varde, forra, giltig_fran, motivering, foreslagen_av, foreslagen)
    VALUES ('undantag', ?, ?, ?, ?, ?, ?, ?)`).run(nyckel, JSON.stringify({ kanaler: k }), JSON.stringify({ kanaler: nu_?.kanaler ?? [] }), datum, m, personal.id, iso(nu));
  loggaAtgard(db, personal, `undantag:${r.lastInsertRowid}`);
  // Runda 13, r3: begäran från vården följer med förslaget.
  uppdateraBegaran(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(r.lastInsertRowid));
  return { andring: undantagAndringUt(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(r.lastInsertRowid), personal) };
}

// Godkänner ett undantag. Den gemensamma godkännandefunktionen prövar det igen (konfiguration.js), eftersom läget kan ha
// ändrats sedan det föreslogs, till exempel en ny pågående vårdkontakt på vårdenheten.
export function godkann(db, personal, id, inp, nu = new Date()) {
  kravRoll(personal);
  godkannAndring(db, personal, id, inp, nu, { slag: 'undantag' });
  uppdateraBegaran(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id)));
  return { andring: undantagAndringUt(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id)), personal) };
}
export function avsluta(db, personal, id, inp, nu = new Date()) {
  kravRoll(personal);
  avslutaAndring(db, personal, id, inp, nu, { slag: 'undantag' });
  uppdateraBegaran(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id)));
  return { andring: undantagAndringUt(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id)), personal) };
}

const kanalText = (k) => (k.length ? k.map(x => KANALER[x].toLowerCase()).join(', ') : 'inget (undantaget avslutas)');

function undantagAndringUt(db, a, personal) {
  const bas = andringUt(db, a, personal);
  const [omfang, ...rest] = a.nyckel.split(':');
  const varde = rest.join(':');
  return { ...bas, omfang, omfangText: OMFANG[omfang], namn: namnFor(db, omfang, varde), rubrik: `${OMFANG[omfang]}: ${namnFor(db, omfang, varde)}`, vardeText: kanalText(bas.varde.kanaler), forraText: kanalText(bas.forra?.kanaler ?? []) };
}

// Sidan för undantag: det som är undantaget nu och framåt, ändringar som väntar, historiken och publiceringen.
export function oversikt(db, personal, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const andringar = db.query("SELECT * FROM konfig_andringar WHERE slag = 'undantag' ORDER BY id DESC").all();
  const vantande = andringar.filter(a => a.status === 'vantar').map(a => undantagAndringUt(db, a, personal));
  return {
    aktiva: aktiva(db, nu).map(u => ({ ...u, omfangText: OMFANG[u.omfang], namn: namnFor(db, u.omfang, u.varde), kanalText: kanalText(u.kanaler), beslutadAv: db.query('SELECT namn FROM personal WHERE id = ?').get(u.beslutadAv)?.namn ?? null })),
    kommande: andringar.filter(a => a.status === 'godkand' && a.galler_fran > dag).map(a => undantagAndringUt(db, a, personal)),
    attGodkanna: vantande.filter(a => a.kanGodkanna), mina: vantande.filter(a => a.egen),
    historik: andringar.filter(a => a.status !== 'vantar').slice(0, 50).map(a => undantagAndringUt(db, a, personal)),
    valbara: valbara(db), kanaler: KANALER, omfang: OMFANG, publicering: publicering(db, nu), forvalDatum: addDagar(dag, 1),
    // Runda 13, r3: begäranden från vården om att undanta en enskild anteckning.
    begaranden: begarandenUt(db),
    regler: [ALDRIG, MIN_JOURNAL],
    anmarkning: 'Publiceringen till nationella tjänster är simulerad i demon. Inget skickas.',
  };
}
