// Runda 14, r4 (Sussa 5.4.2.2): integrerad åtkomst till uppgifter om en patient som har förts över till mellanarkivet.
//
// Mellanarkivet är lokalt i demon. Det tar emot samma slags FGS-paket som exporten till e-arkivet (FGS Paketstruktur 2.0,
// arkiv.js), gör samma mottagningskontroll som e-arkivet (earkiv.js) och sparar paketet och de journalhandlingar som det
// läser ur paketet. Uppgifterna i mellanarkivet ändras aldrig: tabellerna skyddas av triggrar, och varje handling har
// SHA-256 av sitt innehåll som kontrolleras när den läses.
//
// Överföringen. Arkivarien registrerar ett beslut om överföring till mellanarkivet. Systemet tar själv fram underlaget:
// signerade anteckningar som aldrig har rättats och mätvärden som är äldre än fem år, och som inget annat i journalen
// pekar på (en kontrasignering, ett provsvar, ett formulär eller en bild). Systemet bygger ett paket per journal,
// mellanarkivet kontrollerar och tar emot det, och först då tas handlingarna bort ur den aktiva journalen, allt i en
// transaktion. Avvisar mellanarkivet ett paket förs ingenting över.
//
// Åtkomsten. Den som arbetar i journalen behöver inte veta att mellanarkivet finns: anteckningarna står i journalens lista
// och i översiktens tidslinje bland de andra, märkta Ur mellanarkivet, mätvärdena i tidslinjen, och texten är sökbar i
// journalens sökfält. Allt prövas av behörighetsmotorn som journalen i övrigt, på vårdenheten där handlingen skrevs:
// yrkesroll och kategori (inre sekretess för omvårdnad och journal), vårdrelation, aktivt val för andra vårdenheter,
// patientens spärrar som de gäller i dag, skyddad identitet och systemförvaltningens undantag från visning. Varje
// läsning loggas i åtkomstloggen.
import { createHash, randomUUID } from 'node:crypto';
import { Fel, iso, addDagar, idag } from './db.js';
import { kanRoll, vardenhetFor, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { packaUpp } from './zip.js';
import * as fhir from './fhir.js';
import * as earkiv from './earkiv.js';
import * as identitet from './identitet.js';
import { lasHandling } from './journal.js';
import { filtreraVisning, undantagnaUt } from './undantag.js';
import { BESLUTSTYPER, MELLANARKIV_AR, beslutUt, hamtaBeslut, byggFgsPaket, slappTriggrar, logiskTyp } from './arkiv.js';

export const MOTTAGARE = 'Mellanarkivet (lokalt i demon)';
export const ETIKETT = 'Ur mellanarkivet';
export const TAGG_KATEGORI = 'urn:vardkallan:anteckningskategori';
export const TAGG_MATTYP = 'urn:vardkallan:matvardestyp';
// Högst så många handlingar per journal och överföring, så att ett paket inte blir orimligt stort i demon.
export const MAX_PER_JOURNAL = 500;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS mellanarkiv_paket (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, beslut_id INTEGER, kalla TEXT NOT NULL, mottaget TEXT NOT NULL, overfort_av TEXT,
  storlek INTEGER NOT NULL, sha256 TEXT NOT NULL, handlingar INTEGER NOT NULL, data BLOB NOT NULL, kontroll TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mellanarkiv_paket_patient ON mellanarkiv_paket (patient_id);
CREATE TABLE IF NOT EXISTS mellanarkiv_handlingar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id TEXT NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, slag TEXT NOT NULL,
  kategori TEXT, typ TEXT NOT NULL, referens TEXT NOT NULL, datum TEXT NOT NULL, rubrik TEXT NOT NULL, forfattare TEXT, text TEXT NOT NULL,
  resurs TEXT NOT NULL, sha256 TEXT NOT NULL,
  CHECK (slag IN ('anteckning', 'matvarde'))
);
CREATE INDEX IF NOT EXISTS ix_mellanarkiv_handlingar_patient ON mellanarkiv_handlingar (patient_id);
CREATE TRIGGER IF NOT EXISTS mellanarkiv_paket_andras_ej BEFORE UPDATE ON mellanarkiv_paket
  BEGIN SELECT RAISE(ABORT, 'Ett paket i mellanarkivet ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS mellanarkiv_paket_raderas_ej BEFORE DELETE ON mellanarkiv_paket
  BEGIN SELECT RAISE(ABORT, 'Ett paket i mellanarkivet raderas inte.'); END;
CREATE TRIGGER IF NOT EXISTS mellanarkiv_handlingar_andras_ej BEFORE UPDATE ON mellanarkiv_handlingar
  BEGIN SELECT RAISE(ABORT, 'En handling i mellanarkivet ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS mellanarkiv_handlingar_raderas_ej BEFORE DELETE ON mellanarkiv_handlingar
  BEGIN SELECT RAISE(ABORT, 'En handling i mellanarkivet raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }
export const finnsTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mellanarkiv_handlingar'").get());

const sha = (s) => createHash('sha256').update(s).digest('hex');
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const enhetKort = (db, id) => ({ id, namn: enhetsnamn(db, id) });
const patientKort = (p) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) });
const finnsT = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const tabellerMedKolumn = (db, kolumn) => db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name)
  .filter(t => !t.startsWith('mellanarkiv_') && db.query(`PRAGMA table_info(${t})`).all().some(k => k.name === kolumn));

// ---- Underlaget ------------------------------------------------------------------------------------------------------

// Rader som något annat i journalen pekar på stannar i journalen, så att inget pekar på en handling som inte finns.
// Kolumnerna läses ur databasen, så att en tabell som läggs till senare också räknas.
function pekasPa(db, slag) {
  const kolumn = slag === 'anteckning' ? 'anteckning_id' : 'matvarde_id';
  const ids = new Set();
  for (const t of tabellerMedKolumn(db, kolumn)) for (const r of db.query(`SELECT DISTINCT ${kolumn} AS id FROM ${t} WHERE ${kolumn} IS NOT NULL`).all()) ids.add(Number(r.id));
  if (finnsT(db, 'kontrasigneringar')) for (const r of db.query('SELECT post_id AS id FROM kontrasigneringar WHERE typ = ?').all(slag)) ids.add(Number(r.id));
  if (slag === 'anteckning' && finnsT(db, 'undantag')) {
    try { for (const r of db.query("SELECT varde FROM undantag WHERE omfang = 'anteckning'").all()) ids.add(Number(r.varde)); } catch { /* äldre schema */ }
  }
  return ids;
}

// Handlingarna som regeln tar med, per journal: signerade anteckningar som aldrig har rättats och mätvärden, äldre än
// gränsen, i journaler som inte är gallrade, förstörda eller sammanslagna.
export function kandidater(db, fore) {
  const ut = new Map();
  const lagg = (pid, slag, rad) => {
    if (!ut.has(pid)) ut.set(pid, { anteckningar: [], matvarden: [] });
    const l = ut.get(pid)[slag];
    if (l.length < MAX_PER_JOURNAL) l.push(rad);
  };
  const ant = pekasPa(db, 'anteckning');
  const mv = pekasPa(db, 'matvarde');
  const aktiv = "p.journal_forstord IS NULL AND p.sammanslagen_till IS NULL";
  for (const a of db.query(`SELECT a.* FROM anteckningar a JOIN patienter p ON p.id = a.patient_id WHERE ${aktiv} AND a.status = 'signerad' AND a.ersatter_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id) AND coalesce(a.signerad_tid, a.skapad) < ? ORDER BY a.patient_id, a.id`).all(fore)) {
    if (!ant.has(a.id)) lagg(a.patient_id, 'anteckningar', a);
  }
  for (const m of db.query(`SELECT m.* FROM matvarden m JOIN patienter p ON p.id = m.patient_id WHERE ${aktiv} AND m.tid < ? ORDER BY m.patient_id, m.id`).all(fore)) {
    if (!mv.has(m.id)) lagg(m.patient_id, 'matvarden', m);
  }
  return ut;
}

const periodText = (rader) => {
  const d = rader.map(r => String(r).slice(0, 10)).sort();
  return d.length ? (d[0].slice(0, 4) === d.at(-1).slice(0, 4) ? d[0].slice(0, 4) : `${d[0].slice(0, 4)} till ${d.at(-1).slice(0, 4)}`) : null;
};

// Underlaget för ett beslut om överföring, för arkivarien: journalerna med antal handlingar och period, utan innehåll.
export function underlag(db, personal, b) {
  if (logiskTyp(b) !== 'mellanarkiv') throw new Fel(400, 'Beslutet gäller inte mellanarkivet.', 'ogiltig');
  const omf = JSON.parse(b.omfattning);
  const patienter = [];
  for (const [pid, k] of kandidater(db, omf.fore)) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
    const tider = [...k.anteckningar.map(a => a.signerad_tid ?? a.skapad), ...k.matvarden.map(m => m.tid)];
    patienter.push({ ...patientKort(p), anteckningar: k.anteckningar.length, matvarden: k.matvarden.length, period: periodText(tider) });
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: null, handling: 'registrera_arkivbeslut', resurs: `beslut:${b.id}:underlag`,
    grund: 'arkivbeslut', syfte: `Underlag för överföring till mellanarkivet, ${patienter.length} journaler`, resultat: 'tillaten' });
  return { beslut: beslutUt(db, b), patienter, delar: [], mottagare: MOTTAGARE,
    regel: `Signerade anteckningar som inte har rättats och mätvärden från före ${omf.fore}, som inget annat i journalen pekar på.` };
}

// ---- Paketet ---------------------------------------------------------------------------------------------------------

const medTagg = (r, system, code) => ({ ...r, meta: { ...(r.meta ?? {}), tag: [...(r.meta?.tag ?? []), { system, code }] } });

// En Bundle av typen collection med patienten, handlingarna som förs över och de vårdenheter och den personal som de
// hänvisar till. Kategorin för en anteckning och typen för ett mätvärde följer med som taggar, så att mellanarkivet kan
// pröva inre sekretess och undantag på samma sätt som journalen.
function bundleFor(db, pid, { anteckningar, matvarden }) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
  const res = [fhir.patient(db, p, true)];
  for (const a of anteckningar) res.push(medTagg(fhir.composition(db, a), TAGG_KATEGORI, a.kategori));
  for (const m of matvarden) res.push(medTagg(fhir.observation(db, m), TAGG_MATTYP, m.typ));
  const json = JSON.stringify(res);
  for (const id of new Set([...json.matchAll(/"Organization\/([\w-]+)"/g)].map(x => x[1]))) { const e = db.query('SELECT * FROM enheter WHERE id = ?').get(id); if (e) res.push(fhir.organization(db, e)); }
  for (const id of new Set([...json.matchAll(/"Practitioner\/([\w-]+)"/g)].map(x => x[1]))) { const x = db.query('SELECT * FROM personal WHERE id = ?').get(id); if (x) res.push(fhir.practitioner(db, x)); }
  return { resourceType: 'Bundle', type: 'collection', timestamp: iso(), entry: res.map(r => ({ fullUrl: `urn:vardkallan:${r.resourceType}/${r.id}`, resource: r })) };
}

const beskrivning = (objid, kalla, antal) => `# Paket till mellanarkivet ur Vårdkällan

Paket: ${objid}
Källa: ${kalla}
Antal journalhandlingar: ${antal}

Paketet är skapat i en demo med påhittade patienter och testpersonnummer från Skatteverket. Det följer FGS Paketstruktur 2.0 som exportpaketet till e-arkivet. Journalhandlingarna ligger i representations/rep_1/data/journal/ som HL7 FHIR R4 (Bundle av typen collection), och metadata/descriptive/earkiv-index.xml har en post per handling med samma dataelement som för e-arkivet.

Taggen ${TAGG_KATEGORI} anger anteckningens kategori (journal eller omvårdnad) och taggen ${TAGG_MATTYP} mätvärdets typ, så att mottagaren kan tillämpa inre sekretess och undantag som i journalen.
`;

// Paketet för en journal och de handlingar som förs över, byggt som exporten till e-arkivet.
export function paketFor(db, pid, valda, { version = null, kalla = 'Överföring ur Vårdkällan' } = {}) {
  const refs = new Set([...valda.anteckningar.map(a => `urn:vardkallan:Composition/${a.id}`), ...valda.matvarden.map(m => `urn:vardkallan:Observation/${m.id}`)]);
  const index = earkiv.index(db, pid).filter(x => refs.has(x.Referens));
  const objid = `IP_${randomUUID()}`;
  return byggFgsPaket(db, { objid, version, filer: [
    { relativ: `representations/rep_1/data/journal/${pid}.json`, data: JSON.stringify(bundleFor(db, pid, valda), null, 1), mime: 'application/fhir+json', grupp: 'Representations' },
    { relativ: 'metadata/descriptive/earkiv-index.xml', data: earkiv.indexXml(index), mime: 'text/xml', grupp: 'Descriptive' },
    { relativ: 'documentation/beskrivning.md', data: beskrivning(objid, kalla, refs.size), mime: 'text/markdown', grupp: 'Documentation' },
  ] });
}

// ---- Mottagningen ----------------------------------------------------------------------------------------------------

const avHtml = (div) => String(div ?? '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const idUr = (ref, typ) => { const m = String(ref ?? '').match(new RegExp(`^${typ}/([\\w-]+)$`)); return m ? m[1] : null; };
const tagg = (r, system) => (r.meta?.tag ?? []).find(t => t.system === system)?.code ?? null;
function vardeText(o) {
  if (o.component?.length) return `${o.component.map(c => c.valueQuantity?.value).join('/')} ${o.component[0]?.valueQuantity?.unit ?? ''}`.trim();
  if (o.valueQuantity) return `${String(o.valueQuantity.value).replace('.', ',')} ${o.valueQuantity.unit ?? ''}`.trim();
  return o.valueCodeableConcept?.text ?? o.valueString ?? '';
}

// En handling ur paketet, i den form som mellanarkivet sparar och visar. Ger null för resurser som inte är handlingar.
function handlingUr(r) {
  if (r.resourceType === 'Composition') {
    const delar = (r.section ?? []).map(s => ({ sokord: String(s.title ?? ''), text: avHtml(s.text?.div) }));
    return { slag: 'anteckning', kategori: tagg(r, TAGG_KATEGORI) ?? 'journal', typ: String(r.title ?? r.type?.text ?? 'Anteckning'), enhet: idUr(r.custodian?.reference, 'Organization'),
      patient: idUr(r.subject?.reference, 'Patient'), datum: r.date, rubrik: String(r.title ?? r.type?.text ?? 'Anteckning'), forfattare: r.author?.[0]?.display ?? null,
      text: delar.map(d => `${d.sokord}: ${d.text}`).join('\n') };
  }
  if (r.resourceType === 'Observation') {
    return { slag: 'matvarde', kategori: null, typ: tagg(r, TAGG_MATTYP) ?? String(r.code?.text ?? ''), enhet: idUr(r.performer?.[0]?.reference, 'Organization'),
      patient: idUr(r.subject?.reference, 'Patient'), datum: r.effectiveDateTime, rubrik: String(r.code?.text ?? 'Mätvärde'), forfattare: null, text: vardeText(r) };
  }
  return null;
}

// Mellanarkivet tar emot ett paket: samma mottagningskontroll som e-arkivet, och därefter läses handlingarna ur paketet.
// Ett paket med fel tas inte emot, och inget sparas. Ger paketets id och antalet handlingar.
export function taEmot(db, paket, { kalla, beslutId = null, av = null, tid = iso(), forvantadPatient = null } = {}) {
  sakra(db);
  const kontroll = earkiv.mottagningskontroll(paket);
  const fel = [...kontroll.fel];
  const filer = fel.length ? new Map() : packaUpp(paket);
  const rot = [...filer.keys()].find(n => /^IP_[^/]+\/$/.test(n)) ?? '';
  const handlingar = [];
  let patient = null;
  for (const [namn, f] of filer) {
    if (!namn.startsWith(`${rot}representations/rep_1/data/journal/`) || !namn.endsWith('.json')) continue;
    let b;
    try { b = JSON.parse(f.data.toString('utf8')); } catch { fel.push('En fil med journalhandlingar går inte att läsa.'); continue; }
    if (b?.resourceType !== 'Bundle') continue;
    for (const e of b.entry ?? []) {
      const r = e.resource;
      if (r?.resourceType === 'Patient') { patient = patient ?? r.id; if (patient !== r.id) fel.push('Paketet har handlingar för flera patienter.'); continue; }
      const h = r && handlingUr(r);
      if (h) handlingar.push({ ...h, referens: e.fullUrl, resurs: JSON.stringify(r) });
    }
  }
  const pid = patient ? identitet.gallandeId(db, patient) : null;
  if (!fel.length) {
    if (!pid || !db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) fel.push('Patienten i paketet finns inte i journalen.');
    else if (forvantadPatient && pid !== forvantadPatient) fel.push('Paketet gäller en annan patient.');
    if (!handlingar.length) fel.push('Paketet har inga journalhandlingar.');
    for (const h of handlingar) {
      if (h.patient !== patient) { fel.push('En handling i paketet gäller en annan patient.'); break; }
      if (!h.enhet || !db.query('SELECT 1 FROM enheter WHERE id = ?').get(h.enhet)) { fel.push('En handling i paketet saknar en känd vårdenhet.'); break; }
      if (!h.datum || Number.isNaN(Date.parse(h.datum))) { fel.push('En handling i paketet saknar datum.'); break; }
    }
  }
  if (fel.length) throw new Fel(422, `${MOTTAGARE} tog inte emot paketet: ${fel.slice(0, 5).join(' ')}`, 'ogiltig', { fel });
  const objid = rot.slice(0, -1);
  const kv = { fel: [], filer: kontroll.filer, handlingar: handlingar.length };
  db.query('INSERT INTO mellanarkiv_paket (id, patient_id, beslut_id, kalla, mottaget, overfort_av, storlek, sha256, handlingar, data, kontroll) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(objid, pid, beslutId, kalla, tid, av, paket.length, sha(paket).toUpperCase(), handlingar.length, paket, JSON.stringify(kv));
  const ins = db.query('INSERT INTO mellanarkiv_handlingar (paket_id, patient_id, enhet_id, slag, kategori, typ, referens, datum, rubrik, forfattare, text, resurs, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const h of handlingar) ins.run(objid, pid, h.enhet, h.slag, h.kategori, h.typ, h.referens, h.datum, h.rubrik, h.forfattare, h.text, h.resurs, sha(h.resurs));
  return { paket: objid, patient: pid, handlingar: handlingar.length, kontroll: kv };
}

// ---- Överföringen ----------------------------------------------------------------------------------------------------

// Verkställer ett beslut om överföring: ett paket per journal till mellanarkivet, och när mellanarkivet har tagit emot
// det tas handlingarna bort ur den aktiva journalen. Allt i en transaktion. Beslutet verkställs en gång.
export function overfor(db, personal, b, { version = null } = {}) {
  sakra(db);
  if (logiskTyp(b) !== 'mellanarkiv') throw new Fel(400, 'Beslutet gäller inte mellanarkivet.', 'ogiltig');
  if (b.verkstallt) throw new Fel(409, 'Beslutet är redan verkställt.', 'ogiltig');
  const omf = JSON.parse(b.omfattning);
  const tid = iso();
  const resultat = { patienter: 0, anteckningar: 0, matvarden: 0, paket: [] };
  db.transaction(() => {
    for (const [pid, valda] of kandidater(db, omf.fore)) {
      const { paket } = paketFor(db, pid, valda, { version, kalla: `Beslut ${b.diarienummer}` });
      const mot = taEmot(db, paket, { kalla: `Beslut ${b.diarienummer}`, beslutId: b.id, av: personal.id, tid, forvantadPatient: pid });
      slappTriggrar(db, ['anteckningar', 'matvarden'], () => {
        for (const a of valda.anteckningar) db.query('DELETE FROM anteckningar WHERE id = ? AND patient_id = ?').run(a.id, pid);
        for (const m of valda.matvarden) db.query('DELETE FROM matvarden WHERE id = ? AND patient_id = ?').run(m.id, pid);
      });
      resultat.patienter++;
      resultat.anteckningar += valda.anteckningar.length;
      resultat.matvarden += valda.matvarden.length;
      resultat.paket.push(mot.paket);
      loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'arkivera', resurs: `beslut:${b.id}:mellanarkiv:${mot.paket}`, grund: 'arkivbeslut',
        syfte: `Överföring till mellanarkivet enligt ${b.diarienummer}: ${valda.anteckningar.length} anteckningar och ${valda.matvarden.length} mätvärden. Uppgifterna finns kvar i journalen.`, resultat: 'tillaten' });
    }
    db.query('UPDATE arkivbeslut SET verkstallt = ?, verkstallt_av = ?, resultat = ? WHERE id = ?').run(tid, personal.id, JSON.stringify(resultat), b.id);
  })();
  return beslutUt(db, hamtaBeslut(db, b.id));
}

// ---- Åtkomsten -------------------------------------------------------------------------------------------------------

const handlingFor = (r) => (r.slag === 'anteckning' ? lasHandling(r.kategori) : 'las_matvarden');
export const kanLasaNagot = (personal) => ['las_journal', 'las_omvardnad', 'las_matvarden'].some(h => kanRoll(personal, h));
export const listHandling = (personal) => ['las_journal', 'las_omvardnad', 'las_matvarden'].find(h => kanRoll(personal, h)) ?? 'las_journal';

// Handlingarna som anroparen får se, med samma prövning som journalens egna anteckningar och mätvärden.
export function synliga(atk) {
  if (!finnsTabell(atk.db) || !kanLasaNagot(atk.personal)) return [];
  const rader = atk.db.query('SELECT * FROM mellanarkiv_handlingar WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(atk.patientId);
  const tillatna = atk.filtrera(rader, handlingFor);
  return [...filtreraVisning(atk, tillatna.filter(r => r.slag === 'anteckning'), 'anteckning'), ...filtreraVisning(atk, tillatna.filter(r => r.slag === 'matvarde'), 'matvarde')]
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || b.id - a.id);
}

const kort = (db, r) => ({
  id: r.id, slag: r.slag, typ: r.rubrik, datum: r.datum, enhet: enhetKort(db, r.enhet_id), kategori: r.kategori, forfattare: r.forfattare ? { namn: r.forfattare } : null,
  sammanfattning: r.slag === 'matvarde' ? r.text : r.text.replace(/\s+/g, ' ').slice(0, 200), kalla: 'mellanarkiv', kallaEtikett: ETIKETT,
});

// GET /api/patient/:id/mellanarkiv: handlingarna som anroparen får se, och perioden de gäller.
export function lista(atk) {
  sakra(atk.db);
  if (!kanLasaNagot(atk.personal)) atk.krav('las_journal');
  atk.krav(listHandling(atk.personal));
  const rader = synliga(atk);
  if (rader.length) atk.logga(listHandling(atk.personal), atk.grund(), 'mellanarkiv');
  return { handlingar: rader.map(r => kort(atk.db, r)), period: periodText(rader.map(r => r.datum)), etikett: ETIKETT,
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr, undantagna: undantagnaUt(atk) } };
}

export function handlingRad(db, id) {
  sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM mellanarkiv_handlingar WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  return r;
}

// GET /api/mellanarkiv/:id: en handling, med samma prövning som raden i listan. Loggas. Kontrollsumman visar att
// handlingen är oförändrad sedan mellanarkivet tog emot den.
export function las(atk, r) {
  if (r.patient_id !== atk.patientId) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  atk.krav(handlingFor(r), { resurs: { enhet_id: r.enhet_id }, beskrivning: `mellanarkiv:${r.id}` });
  if (!filtreraVisning(atk, [r], r.slag).length) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  atk.logga(handlingFor(r), atk.grund(), `mellanarkiv:${r.id}`);
  const p = atk.db.query('SELECT id, mottaget, kalla, sha256 FROM mellanarkiv_paket WHERE id = ?').get(r.paket_id);
  const resurs = JSON.parse(r.resurs);
  return {
    ...kort(atk.db, r),
    sokord: r.slag === 'anteckning' ? (resurs.section ?? []).map(s => ({ sokord: String(s.title ?? ''), text: avHtml(s.text?.div) })) : [],
    varde: r.slag === 'matvarde' ? r.text : null,
    mellanarkiv: { mottagare: MOTTAGARE, paket: p?.id ?? null, mottaget: p?.mottaget ?? null, kalla: p?.kalla ?? null, oforandrad: sha(r.resurs) === r.sha256 },
  };
}

// Händelserna i översiktens tidslinje, ur det som anroparen får se.
export function tidslinje(atk) {
  return synliga(atk).map(r => ({
    tid: r.datum, typ: 'mellanarkiv', rubrik: r.slag === 'anteckning' ? r.rubrik : `Mätvärde: ${r.rubrik}`, text: r.slag === 'matvarde' ? r.text : r.text.replace(/\s+/g, ' ').slice(0, 160),
    enhet: enhetKort(atk.db, r.enhet_id), kalla: 'mellanarkiv', kallaEtikett: ETIKETT, ref: { typ: 'mellanarkiv', id: r.id },
  }));
}

// Träffarna i journalens sökfält (journalsok.js), med samma prövning som listan.
export function sokTraffar(atk, ord, markera) {
  const ut = [];
  for (const r of synliga(atk)) {
    const text = `${r.rubrik} ${r.text}`.replace(/\s+/g, ' ');
    const lag = text.toLocaleLowerCase('sv-SE');
    const i = ord.map(o => lag.indexOf(o)).filter(x => x >= 0).sort((a, b) => a - b)[0];
    if (i == null) continue;
    const utdrag = text.slice(Math.max(0, i - 60), i + 120);
    ut.push({ typ: 'mellanarkiv', tid: r.datum, rubrik: r.rubrik, delar: markera(utdrag, ord) ?? [{ text: utdrag, markerad: false }], vardenhet: enhetKort(atk.db, r.enhet_id),
      kalla: 'mellanarkiv', kallaEtikett: ETIKETT, ref: { flik: 'journal', sub: `ma-${r.id}` } });
  }
  return ut;
}

// ---- Seeden ----------------------------------------------------------------------------------------------------------

// Demon: vid migreringen från VAS fördes Gunnar Åkessons (p01) äldre uppgifter direkt till mellanarkivet. Handlingarna är
// påhittade. En anteckning är skriven på Kardiologiska kliniken, där kardiologen har vårdrelation, och de andra på
// vårdcentralen och medicinkliniken, som kräver ett aktivt val. Paketet byggs och tas emot på samma sätt som en
// överföring.
const SEED = [
  { slag: 'anteckning', kategori: 'journal', typ: 'Mottagningsanteckning', enhet: 'uso-kard', datum: '2010-06-08T09:40:00.000Z', av: 'Läkare, VAS (migrerad)', sokord: {
    Kontaktorsak: 'Hjärtklappning vid ansträngning sedan några månader.', Status: 'Regelbunden rytm, inga blåsljud. Blodtryck 148/90.',
    Bedömning: 'Troligen extraslag. Långtids-EKG utan förmaksflimmer.', Planering: 'Ingen behandling. Ny kontakt vid försämring.' } },
  { slag: 'anteckning', kategori: 'journal', typ: 'Mottagningsanteckning', enhet: 'vc-tybble', datum: '2011-09-14T08:30:00.000Z', av: 'Distriktsläkare, VAS (migrerad)', sokord: {
    Kontaktorsak: 'Kontroll av blodtryck efter tre förhöjda hemmätningar.', Bedömning: 'Essentiell hypertoni.', Planering: 'Livsstilsråd. Ny kontroll om tre månader.' } },
  { slag: 'anteckning', kategori: 'omvardnad', typ: 'Omvårdnadsanteckning', enhet: 'uso-med', datum: '2012-02-21T14:15:00.000Z', av: 'Sjuksköterska, VAS (migrerad)', sokord: {
    Omvårdnad: 'Lågt vätskeintag under dagen. Uppmanad att dricka. Mobiliseras med stöd.' } },
  { slag: 'matvarde', typ: 'blodtryck', namn: 'Blodtryck', enhet: 'vc-tybble', datum: '2011-09-14T08:20:00.000Z', varde: [162, 96], matt: 'mm[Hg]' },
];
export function seeda(db) {
  sakra(db);
  if (db.query('SELECT 1 FROM mellanarkiv_paket LIMIT 1').get() || !db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get()) return;
  const p = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
  const res = [fhir.patient(db, p, true)];
  SEED.forEach((s, i) => {
    const id = `vas-ma-${i + 1}`;
    if (s.slag === 'anteckning') {
      res.push(medTagg(medTagg({ resourceType: 'Composition', id, status: 'final', type: { text: s.typ }, subject: { reference: 'Patient/p01' }, date: s.datum,
        author: [{ display: s.av }], title: s.typ, custodian: { reference: `Organization/${s.enhet}`, display: enhetsnamn(db, s.enhet) },
        section: Object.entries(s.sokord).map(([t, x]) => ({ title: t, text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${x}</div>` } })) },
      fhir.SYSTEM.kalla, 'migrerad:VAS'), TAGG_KATEGORI, s.kategori));
    } else {
      res.push(medTagg(medTagg({ resourceType: 'Observation', id, status: 'final', code: { text: s.namn }, subject: { reference: 'Patient/p01' }, effectiveDateTime: s.datum,
        performer: [{ reference: `Organization/${s.enhet}`, display: enhetsnamn(db, s.enhet) }],
        component: s.varde.map((v, j) => ({ code: { text: j ? 'Diastoliskt blodtryck' : 'Systoliskt blodtryck' }, valueQuantity: { value: v, unit: s.matt } })) },
      fhir.SYSTEM.kalla, 'migrerad:VAS'), TAGG_MATTYP, s.typ));
    }
  });
  for (const id of new Set(SEED.map(s => s.enhet))) res.push(fhir.organization(db, db.query('SELECT * FROM enheter WHERE id = ?').get(id)));
  const bundle = { resourceType: 'Bundle', type: 'collection', timestamp: '2026-01-15T10:00:00.000Z', entry: res.map(r => ({ fullUrl: `urn:vardkallan:${r.resourceType}/${r.id}`, resource: r })) };
  const index = res.filter(r => ['Composition', 'Observation'].includes(r.resourceType)).map(r => {
    const h = handlingUr(r);
    return { Arkivbildare: `${db.query("SELECT namn FROM enheter WHERE typ = 'vardgivare' ORDER BY rowid LIMIT 1").get()?.namn ?? 'Vårdgivaren'} (demo)`, Informationstyp: earkiv.INFORMATIONSTYP, Patientidentitet: p.personnummer, Patientnamn: `${p.fornamn} ${p.efternamn}`,
      SkyddadePersonuppgifter: p.skyddad ? 'ja' : 'nej', Dokumenttyp: h.slag === 'anteckning' ? h.typ : 'Mätvärde', Dokumentdatum: h.datum.slice(0, 19),
      Vårdenhet: db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(h.enhet)?.hsa_id ?? h.enhet, UpprättadAv: null, Version: '1', Spärr: 'nej',
      Sekretess: 'Offentlighets- och sekretesslagen (2009:400) 25 kap. 1 §', Fil: 'representations/rep_1/data/journal/p01.json', Referens: `urn:vardkallan:${r.resourceType}/${r.id}` };
  });
  const objid = `IP_${randomUUID()}`;
  const { paket } = byggFgsPaket(db, { objid, scheman: false, tid: '2026-01-15T10:00:00.000Z', filer: [
    { relativ: 'representations/rep_1/data/journal/p01.json', data: JSON.stringify(bundle, null, 1), mime: 'application/fhir+json', grupp: 'Representations' },
    { relativ: 'metadata/descriptive/earkiv-index.xml', data: earkiv.indexXml(index), mime: 'text/xml', grupp: 'Descriptive' },
    { relativ: 'documentation/beskrivning.md', data: beskrivning(objid, 'Migreringen från VAS (demo)', index.length), mime: 'text/markdown', grupp: 'Documentation' },
  ] });
  taEmot(db, paket, { kalla: 'Migreringen från VAS (demo)', tid: '2026-01-15T10:00:00.000Z', forvantadPatient: 'p01' });
}

// Gränsen för ett nytt beslut: handlingar äldre än MELLANARKIV_AR år.
export const regelFore = () => addDagar(idag(), -Math.round(MELLANARKIV_AR * 365.25));
export { BESLUTSTYPER };
