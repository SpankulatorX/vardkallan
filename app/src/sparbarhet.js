// Runda 9, r7: spårbarhet mot kringsystem (Sussa 6.1.1.3) och uppföljning av subprocesser (Sussa 6.1.1.4), figur 3 i
// kravspecifikationen.
//
// Händelsekedjan per vårdkontakt håller samman det som hände i Vårdkällan och anropen till kringsystemen som gjordes från
// kontakten: beställningarna till det simulerade laboratoriet, överföringarna till den simulerade Nationella
// läkemedelslistan och notiserna till prenumeranterna i det öppna API:t. Vårdkontakten har ett process-id, och varje
// anrop har ett korrelations-id som kringsystemet får och skickar tillbaka: beställningsnumret för laboratoriet och
// meddelandets id för NLL. Kedjan visar när anropet gjordes, vad som kom tillbaka och när, så att data i kärnsystemet
// och kringsystemet går att para ihop.
//
// Varje del lämnas ut med sin egen behörighet: provsvaren med rätten att läsa prover, överföringarna med rätten att
// läsa läkemedelslistan och anteckningarna med rätten att läsa dem, och bara från de vårdenheter som anroparen får se.
//
// Subprocesserna remiss, provtagning och läkemedelsöverföring följs upp med tidpunkt för varje steg, ledtiden per steg och
// totalt, och andelen inom målvärdet som systemförvaltaren sätter på sidan Regler och parametrar (konfiguration.js).
// Uppföljningen är antal och tider utan personuppgifter, för den egna vårdenheten eller för hela vårdgivaren.
import { Fel } from './db.js';
import { kanRoll, vardenhetFor, aktivaSparrar } from './atkomst.js';
import { loggaRad } from './logg.js';
import { varde } from './konfiguration.js';
import * as vardformer from './vardformer.js';
import { lasHandling } from './journal.js';
// Runda 13, r3: undantagen från visning.
import { provare as undantagProvare } from './undantag.js';

export const MAL_STANDARD = { remissSvarDagar: 14, labbSvarTimmar: 24, nllKvittensMinuter: 5 };
export const processId = (v) => `urn:vardkallan:vardkontakt:${v.id}`;
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const minuter = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60_000) : null);

// GET /api/vardkontakt/:id/handelser. atk är prövad för patienten.
export function handelsekedja(atk, v) {
  const db = atk.db;
  atk.krav(kanRoll(atk.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin', { resurs: { enhet_id: v.enhet_id } });
  const synlig = (enhetId, handling) => kanRoll(atk.personal, handling) && atk.prova(handling, { enhet_id: enhetId }).tillaten;
  const h = [];
  const egen = (tid, handelse, extra = {}) => tid && h.push({ tid, system: 'Vårdkällan', handelse, ...extra });
  egen(v.start, v.planerad ? 'Kontakten planerades att börja' : 'Kontakten började');
  egen(v.ankomst, 'Patienten kom');
  egen(v.besok_slut, 'Besöket slutade');
  egen(v.slut, 'Kontakten avslutades');
  // Runda 13, r3 (säkerhetsfynd 6): en anteckning som är undantagen från visning finns inte i kedjan.
  const undantagen = undantagProvare(db, 'visning');
  for (const a of db.query("SELECT * FROM anteckningar WHERE vardkontakt_id = ? AND status = 'signerad'").all(v.id)) {
    if (undantagen(a, 'anteckning')) continue;
    if (synlig(a.enhet_id, lasHandling(a.kategori))) egen(a.signerad_tid, `${a.typ} signerad`, { objekt: `anteckning:${a.id}` });
  }
  for (const d of db.query('SELECT * FROM diagnoser WHERE vardkontakt_id = ?').all(v.id)) if (synlig(d.enhet_id, 'las_diagnoser')) egen(`${d.datum}T12:00:00.000Z`, `Diagnos ${d.kod} registrerad`);
  for (const r of db.query('SELECT * FROM remisser WHERE vardkontakt_id = ?').all(v.id)) {
    if (!synlig(r.fran_enhet_id, kanRoll(atk.personal, 'las_remiss') ? 'las_remiss' : 'las_remiss_status')) continue;
    egen(r.skickad_tid, 'Remiss skickad', { korrelationId: `remiss:${r.id}` });
    egen(r.mottagen_tid, 'Remissen kvitterades som mottagen', { korrelationId: `remiss:${r.id}` });
    egen(r.besvarad_tid, 'Remissen besvarades', { korrelationId: `remiss:${r.id}` });
  }
  const kringsystem = [];
  // Laboratoriet (simulerat). Korrelations-id är beställningsnumret, som står på etiketterna och kommer tillbaka med svaret.
  if (harTabell(db, 'labb_bestallningar')) {
    for (const b of db.query('SELECT * FROM labb_bestallningar WHERE vardkontakt_id = ? ORDER BY id').all(v.id)) {
      if (!synlig(b.enhet_id, 'las_prover')) continue;
      const hist = db.query('SELECT * FROM labb_historik WHERE bestallning_id = ? ORDER BY tid, id').all(b.id);
      const analyser = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status <> 'borttagen' ORDER BY id").all(b.id);
      const skickad = db.query('SELECT min(skickad_tid) AS t FROM labb_prov WHERE bestallning_id = ? AND borttagen = 0').get(b.id).t;
      for (const x of hist) h.push({ tid: x.tid, system: /svar|laboratori|mottag/i.test(x.handelse) ? 'Laboratoriet (simulerat)' : 'Vårdkällan', handelse: x.handelse, korrelationId: b.nummer });
      const svar = analyser.filter(a => a.besvarad_tid).sort((a, c) => a.besvarad_tid.localeCompare(c.besvarad_tid));
      for (const a of svar) h.push({ tid: a.besvarad_tid, system: 'Laboratoriet (simulerat)', handelse: `Svar ${a.analys}${a.svar_text ? `: ${a.svar_text}` : ''}`, korrelationId: b.nummer });
      kringsystem.push({ system: 'Laboratoriet (simulerat)', korrelationId: b.nummer, objekt: `labb:${b.id}`, anrop: skickad, svar: svar.length ? { tid: svar.at(-1).besvarad_tid, status: svar.length === analyser.length ? 'besvarad' : 'delvis besvarad', antal: svar.length, av: analyser.length } : null,
        ledtidMinuter: svar.length ? minuter(skickad, svar.at(-1).besvarad_tid) : null, status: b.makulerad_tid ? 'makulerad' : svar.length === analyser.length && analyser.length ? 'besvarad' : skickad ? 'skickad' : 'inte skickad' });
    }
  }
  // Nationella läkemedelslistan (simulerad). Korrelations-id är meddelandets id, som kvittensen pekar på.
  // Läkemedelslistan är gemensam, men aldrig från en spärrad vårdenhet.
  const synligOrdination = (o) => kanRoll(atk.personal, 'las_lakemedel') && atk.prova('las_lakemedel', { enhet_id: o.enhet_id, gemensam: true }).tillaten;
  for (const o of db.query('SELECT * FROM ordinationer WHERE vardkontakt_id = ?').all(v.id)) {
    if (!synligOrdination(o)) continue;
    for (const m of db.query('SELECT * FROM nll_meddelanden WHERE ordination_id = ? ORDER BY id').all(o.id)) {
      const id = `NLL-${String(m.id).padStart(6, '0')}`;
      h.push({ tid: m.skickad, system: 'Vårdkällan', handelse: `Ordinationen överförd till NLL (${m.typ})`, korrelationId: id });
      if (m.svar_tid) h.push({ tid: m.svar_tid, system: 'Nationella läkemedelslistan (simulerad)', handelse: m.status === 'kvitterad' ? 'Kvittens från NLL' : `Svar från NLL: ${m.status}`, korrelationId: id });
      kringsystem.push({ system: 'Nationella läkemedelslistan (simulerad)', korrelationId: id, objekt: `ordination:${o.id}`, anrop: m.skickad, svar: m.svar_tid ? { tid: m.svar_tid, status: m.status, kvittens: m.kvittens ?? null } : null,
        ledtidMinuter: minuter(m.skickad, m.svar_tid), status: m.status });
    }
  }
  // Notiser till prenumeranterna i det öppna API:t om resurser från kontakten.
  if (harTabell(db, 'prenumeration_notiser') && kanRoll(atk.personal, 'las_oversikt')) {
    const fokus = new Set([`Encounter/${v.id}`,
      ...db.query('SELECT id, enhet_id FROM matvarden WHERE vardkontakt_id = ?').all(v.id).filter(m => synlig(m.enhet_id, 'las_matvarden')).map(m => `Observation/${m.id}`),
      ...db.query('SELECT id, enhet_id FROM ordinationer WHERE vardkontakt_id = ?').all(v.id).filter(synligOrdination).map(o => `MedicationRequest/${o.id}`)]);
    for (const n of db.query('SELECT * FROM prenumeration_notiser ORDER BY id').all().filter(x => fokus.has(x.fokus))) {
      const id = `notis:${n.prenumeration_id}:${n.nummer}`;
      h.push({ tid: n.tid, system: 'Prenumerant i det öppna API:t', handelse: `Notis om ${n.fokus.split('/')[0]} (${n.handelse}), svar ${n.status}`, korrelationId: id });
      kringsystem.push({ system: 'Prenumerant i det öppna API:t', korrelationId: id, objekt: n.fokus, anrop: n.tid, svar: { tid: n.tid, status: n.status }, ledtidMinuter: 0, status: n.status });
    }
  }
  const synligKontakt = (k) => atk.prova(kanRoll(atk.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin', { enhet_id: k.enhet_id }).tillaten;
  return {
    vardkontakt: { id: v.id, processId: processId(v), vardform: v.typ, vardformText: vardformer.VARDFORMER[v.typ] ?? v.typ, vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(v.enhet_id)?.namn, halsoarendeId: v.halsoarende_id ?? null, ...vardformer.besokUt(v) },
    vardformer: vardformer.kedja(db, v, synligKontakt),
    handelser: h.sort((a, b) => a.tid.localeCompare(b.tid)), kringsystem,
    anmarkning: 'Laboratoriet, Nationella läkemedelslistan och prenumeranterna är simulerade. Rapporterna till myndigheter och register är sammanställningar per period och hör inte till en enskild kontakt.',
  };
}

// Uppföljning av subprocesserna ---------------------------------------------------------------------------------

const MINSTA = 5;
const median = (a) => {
  if (a.length < MINSTA) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

export function mal(db, nu = new Date()) {
  return { remissSvarDagar: varde(db, 'ledtid.remiss_svar_dagar', nu), labbSvarTimmar: varde(db, 'ledtid.labb_svar_timmar', nu), nllKvittensMinuter: varde(db, 'ledtid.nll_kvittens_minuter', nu) };
}

// GET /api/sparbarhet/subprocesser?dagar=90.
export function subprocesser(db, personal, { dagar = 90, nu = new Date() } = {}) {
  const region = kanRoll(personal, 'statistik_region');
  if (!region && !kanRoll(personal, 'statistik')) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik', resurs: 'sparbarhet:subprocesser', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Yrkesrollen får inte se uppföljningen av subprocesser.', 'nekad');
  }
  const min = vardenhetFor(db, personal.enhet_id);
  const fran = new Date(nu.getTime() - dagar * 86400_000).toISOString();
  const sparrCache = new Map();
  const far = (pid, enhetId) => {
    const ve = vardenhetFor(db, enhetId);
    if (!sparrCache.has(pid)) sparrCache.set(pid, aktivaSparrar(db, pid));
    if (sparrCache.get(pid).includes(ve) && ve !== min) return false;
    if (db.query('SELECT skyddad FROM patienter WHERE id = ?').get(pid)?.skyddad && region) return false;
    return region || ve === min;
  };
  const m = mal(db, nu);
  const sammanfatta = (id, namn, enhet, malvarde, malText, steg, totalt) => {
    const inom = totalt.filter(x => x.varde <= malvarde).length;
    return {
      id, namn, enhet, mal: malvarde, malText, antal: totalt.length < MINSTA && totalt.length > 0 ? null : totalt.length,
      median: median(totalt.map(x => x.varde)), andelInomMal: totalt.length >= MINSTA ? Math.round(inom / totalt.length * 100) : null,
      steg: steg.map(s => ({ namn: s.namn, median: median(s.varden), antal: s.varden.length < MINSTA && s.varden.length > 0 ? null : s.varden.length })),
      langsammast: totalt.length >= MINSTA ? [...totalt].sort((a, b) => b.varde - a.varde).slice(0, 3).filter(x => x.varde > malvarde).map(x => ({ korrelationId: x.id, varde: x.varde })) : [],
    };
  };
  // Remiss: skickad, mottagen, bedömd, besvarad. Räknas på den mottagande vårdenheten.
  const rem = db.query('SELECT * FROM remisser WHERE skickad_tid >= ?').all(fran).filter(r => far(r.patient_id, r.till_enhet_id) && (!region || far(r.patient_id, r.fran_enhet_id)));
  const d = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400_000 * 10) / 10 : null);
  const remiss = sammanfatta('remiss', 'Remiss', 'dagar', m.remissSvarDagar, `Besvarad inom ${m.remissSvarDagar} dagar`, [
    { namn: 'Skickad till mottagen', varden: rem.map(r => d(r.skickad_tid, r.mottagen_tid)).filter(x => x != null) },
    { namn: 'Mottagen till bedömd', varden: rem.map(r => d(r.mottagen_tid, r.bedomd_tid)).filter(x => x != null) },
    { namn: 'Bedömd till besvarad', varden: rem.map(r => d(r.bedomd_tid, r.besvarad_tid)).filter(x => x != null) },
  ], rem.filter(r => r.besvarad_tid).map(r => ({ id: `remiss:${r.id}`, varde: d(r.skickad_tid, r.besvarad_tid) })));
  // Provtagning: beställd, provtagen, svar. Räknas på den beställande vårdenheten.
  let prov = [];
  if (harTabell(db, 'labb_analyser')) {
    prov = db.query(`SELECT b.id, b.nummer, b.patient_id, b.enhet_id, b.skapad, min(p.provtagen_tid) AS tagen, max(a.besvarad_tid) AS svar FROM labb_bestallningar b
      JOIN labb_prov p ON p.bestallning_id = b.id AND p.borttagen = 0 LEFT JOIN labb_analyser a ON a.bestallning_id = b.id AND a.status <> 'borttagen'
      WHERE b.makulerad_tid IS NULL AND b.skapad >= ? GROUP BY b.id`).all(fran).filter(b => far(b.patient_id, b.enhet_id));
  }
  const t = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 360_000) / 10 : null);
  const provtagning = sammanfatta('provtagning', 'Provtagning', 'timmar', m.labbSvarTimmar, `Svar inom ${m.labbSvarTimmar} timmar från provtagningen`, [
    { namn: 'Beställd till provtagen', varden: prov.map(b => t(b.skapad, b.tagen)).filter(x => x != null && x >= 0) },
    { namn: 'Provtagen till svar', varden: prov.map(b => t(b.tagen, b.svar)).filter(x => x != null) },
  ], prov.filter(b => b.tagen && b.svar).map(b => ({ id: b.nummer, varde: t(b.tagen, b.svar) })));
  // Läkemedelsöverföring: skickad till NLL, kvittens. Räknas på den ordinerande vårdenheten.
  const nll = db.query('SELECT m.*, o.patient_id, o.enhet_id FROM nll_meddelanden m JOIN ordinationer o ON o.id = m.ordination_id WHERE m.skickad >= ?').all(fran).filter(x => far(x.patient_id, x.enhet_id));
  const mn = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 6_000) / 10 : null);
  const overforing = sammanfatta('lakemedelsoverforing', 'Läkemedelsöverföring till NLL', 'minuter', m.nllKvittensMinuter, `Kvittens inom ${m.nllKvittensMinuter} minuter`, [
    { namn: 'Skickad till kvittens', varden: nll.filter(x => x.status === 'kvitterad').map(x => mn(x.skickad, x.svar_tid)).filter(x => x != null) },
  ], nll.filter(x => x.status === 'kvitterad' && x.svar_tid).map(x => ({ id: `NLL-${String(x.id).padStart(6, '0')}`, varde: mn(x.skickad, x.svar_tid) })));
  overforing.utanSvar = nll.filter(x => x.status !== 'kvitterad').length;
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: region ? 'statistik_region' : 'statistik', resurs: 'sparbarhet:subprocesser', grund: region ? 'uppfoljning' : 'administrativ', resultat: 'tillaten' });
  return {
    niva: region ? 'region' : 'enhet', vardenhet: region ? 'Hela vårdgivaren' : db.query('SELECT namn FROM enheter WHERE id = ?').get(min)?.namn, dagar,
    subprocesser: [remiss, provtagning, overforing],
    anmarkning: `Målvärdena sätts av systemförvaltaren på sidan Regler och parametrar. Medianer och andelar som bygger på färre än ${MINSTA} visas inte. Inga personuppgifter.`,
  };
}
