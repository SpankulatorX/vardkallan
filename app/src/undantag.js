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
export const OMFANG = { anteckningstyp: 'Anteckningstyp', matvarde: 'Mätvärde', enhet: 'Vårdenhet' };
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
  };
}
const ALDRIG = 'Läkemedel, överkänslighet, uppmärksamhetsinformation och diagnoser kan inte undantas. De behövs för patientsäkerheten, och läkemedlen ska rapporteras till Nationella läkemedelslistan.';
const MIN_JOURNAL = 'Undantaget gäller aldrig Min journal, där patienten läser sin journal efter vårdgivarens visningsregler. Det ändrar inga spärrar.';

const namnFor = (db, omfang, varde) => valbara(db)[omfang]?.find(x => x.varde === varde)?.namn ?? varde;

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
  return (rad, sort) => {
    const e = rad.enhet_id ?? rad.fran_enhet_id;
    if (e && enheter.size) { const u = enheter.get(vardenhetFor(db, e)); if (u) return u; }
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
    antal: u.antal, sort: u.sort, text: `${u.antal} ${u.sort === 'anteckning' ? (u.antal === 1 ? 'anteckning' : 'anteckningar') : (u.antal === 1 ? 'mätvärde' : 'mätvärden')} ${u.omfang === 'enhet' ? `från ${u.namn}` : `av typen ${u.namn}`} visas inte. Systemförvaltningen har undantagit ${u.omfang === 'enhet' ? 'vårdenhetens uppgifter' : 'typen'} från visning från ${u.gallerFran}: ${u.motivering}`,
  }));
}

// FHIR för externa tillämpningar: om en resurs är undantagen. Composition är en anteckning och Observation ett mätvärde.
export function fhirProvare(db, typ) {
  const prova = provare(db, 'fhir');
  const sort = typ === 'Composition' ? 'anteckning' : typ === 'Observation' ? 'matvarde' : null;
  return (rad) => Boolean(prova(rad, sort));
}

// Publiceringen till nationella tjänster (simulerad): vad som skulle publiceras och vad som är undantaget, i antal.
// En producent av ett nationellt tjänstekontrakt prövar varje rad med provare(db, 'nationell').
export function publicering(db, nu = new Date()) {
  const prova = provare(db, 'nationell', nu);
  const rakna = (tabell, sort, villkor = '1 = 1') => {
    const rader = db.query(`SELECT typ, enhet_id FROM ${tabell} WHERE ${villkor}`).all();
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
  if (!OMFANG[omfang]) return { ok: false, varfor: `Välj vad som ska undantas: en anteckningstyp, ett mätvärde eller en vårdenhet. ${ALDRIG}` };
  if (!valbara(db)[omfang].some(x => x.varde === varde)) return { ok: false, varfor: `Det går inte att undanta det valda. ${ALDRIG}` };
  const k = Array.isArray(kanaler) ? [...new Set(kanaler)] : [];
  if (k.some(x => !KANALER[x])) return { ok: false, varfor: 'Okänd kanal.' };
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
  return { andring: undantagAndringUt(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(r.lastInsertRowid), personal) };
}

// Godkänner ett undantag. Den gemensamma godkännandefunktionen prövar det igen (konfiguration.js), eftersom läget kan ha
// ändrats sedan det föreslogs, till exempel en ny pågående vårdkontakt på vårdenheten.
export function godkann(db, personal, id, inp, nu = new Date()) {
  kravRoll(personal);
  godkannAndring(db, personal, id, inp, nu, { slag: 'undantag' });
  return { andring: undantagAndringUt(db, db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id)), personal) };
}
export function avsluta(db, personal, id, inp, nu = new Date()) {
  kravRoll(personal);
  avslutaAndring(db, personal, id, inp, nu, { slag: 'undantag' });
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
    regler: [ALDRIG, MIN_JOURNAL],
    anmarkning: 'Publiceringen till nationella tjänster är simulerad i demon. Inget skickas.',
  };
}
