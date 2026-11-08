// Ordination av kontroller och mätvärden till avdelningen (runda 8, r1, Sussas testfall 3.5): läkaren ordinerar till
// exempel blodtryck var fjärde timme eller blodsocker före måltid, och sjuksköterskan ser kontrollerna som uppgifter med
// tid. Systemet bockar själv av en kontroll när ett mätvärde av rätt slag registreras i tid på vårdenheten, så att ingen
// behöver markera den två gånger.
//
// Här finns också de planerade uppgifterna per vårdenhet och dag (GET /api/planerat), som avdelningens vy över dagens
// händelser hämtar: kontrollerna och provtagningarna. Formatet står i docs/design.md.
//
// Systemet är experten: det föreslår starttiden (morgonrundan klockan 7), räknar ut tiderna ur frekvensen, lägger
// kontrollerna på den avdelning där patienten ligger, knyter ordinationen till vårdkontakten och visar en kontroll som
// försenad när tiden har gått utan att något har registrerats. Reglerna är demoregler.
import { Fel, iso, addDagar, datumAv, lokalTid } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn, visningsPnr } from './atkomst.js';
import * as vardkontakt from './vardkontakt.js';
import * as labb from './labb.js';
import { KONTROLLER, KONTROLL, FREKVENSER, DEMOREGEL, finns as iKatalog } from './labb-katalog.js';

// En rad med en kontroll eller frekvens som inte finns i katalogen visas inte, så att den aldrig stoppar listningen.
const giltig = (k) => iKatalog(KONTROLL, k.kontroll) && iKatalog(FREKVENSER, k.frekvens);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kontrollordinationer (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, kontroll TEXT NOT NULL, frekvens TEXT NOT NULL,
  start TEXT NOT NULL, slut TEXT, ordinerad_av TEXT NOT NULL, skapad TEXT NOT NULL, kommentar TEXT,
  avslutad_tid TEXT, avslutad_av TEXT, avslutad_orsak TEXT
);
CREATE INDEX IF NOT EXISTS ix_kontroll_patient ON kontrollordinationer (patient_id);
CREATE INDEX IF NOT EXISTS ix_kontroll_enhet ON kontrollordinationer (enhet_id);
`;
const sakrad = new WeakSet();
export function sakraKontroller(db) {
  if (sakrad.has(db)) return;
  db.exec(SCHEMA);
  sakrad.add(db);
}
const finns = (db) => sakrad.has(db) || Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'kontrollordinationer'").get() && sakrad.add(db));

const MIN = 60_000;
const TIMME = 60 * MIN;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

// Starttiden som systemet föreslår: klockan 7 i dag om den inte har passerat, annars klockan 7 i morgon.
export function forslagStart(nu = new Date()) {
  const idag = lokalTid(datumAv(nu), '07:00');
  return Date.parse(idag) > nu.getTime() ? idag : lokalTid(addDagar(datumAv(nu), 1), '07:00');
}

// Avdelningen där kontrollen görs: där patienten ligger på den egna vårdenheten, annars den egna enheten.
function enhetFor(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const v = db.query(`SELECT enhet_id FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND typ = 'slutenvard' AND slut IS NULL ORDER BY start DESC`).get(patientId, ...enheter);
  return v?.enhet_id ?? personal.enhet_id;
}

// De planerade tiderna för en kontroll mellan fran och till (ISO). En kontroll under ett dygn har en tid, starten.
export function tiderFor(k, fran, till) {
  const f = iKatalog(FREKVENSER, k.frekvens) ? FREKVENSER[k.frekvens] : null;
  const start = Date.parse(k.start);
  const slut = k.avslutad_tid ? Math.min(Date.parse(k.avslutad_tid), k.slut ? Date.parse(k.slut) : Infinity) : (k.slut ? Date.parse(k.slut) : Infinity);
  const a = Date.parse(fran), b = Date.parse(till);
  const ut = [];
  if (!f) return ut;
  if (f.tider === 'en' || f.dygn) { if (start >= a && start < b && start <= slut) ut.push(new Date(start).toISOString()); return ut; }
  if (f.intervall) {
    for (let t = start; t < Math.min(b, slut) && ut.length < 50; t += f.intervall * TIMME) if (t >= a) ut.push(new Date(t).toISOString());
    return ut;
  }
  for (let d = datumAv(new Date(Math.max(a, start))); Date.parse(lokalTid(d, '00:00')) < Math.min(b, slut) && ut.length < 50; d = addDagar(d, 1)) {
    for (const kl of f.klockslag) {
      const t = Date.parse(lokalTid(d, kl));
      if (t >= a && t < b && t >= start && t <= slut) ut.push(new Date(t).toISOString());
    }
  }
  return ut;
}

// Ett registrerat värde som bockar av kontrollen vid tiden t: ett mätvärde av rätt slag på samma vårdenhet från en
// timme före till två timmar efter tiden, eller för vätskebalansen en registrering under dygnet.
function utfordVid(db, k, t) {
  const def = KONTROLL[k.kontroll];
  const enheter = enheterUnder(db, vardenhetFor(db, k.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const ms = Date.parse(t);
  if (def.vatskebalans) {
    let n = 0;
    try { n = db.query(`SELECT count(*) AS n FROM vatskebalans WHERE patient_id = ? AND enhet_id IN (${ph}) AND tid >= ? AND tid < ?`).get(k.patient_id, ...enheter, t, new Date(ms + 24 * TIMME).toISOString()).n; } catch { /* sandlåda utan vätskebalans */ }
    return n ? { antal: n } : null;
  }
  const m = db.query(`SELECT * FROM matvarden WHERE patient_id = ? AND typ = ? AND enhet_id IN (${ph}) AND tid >= ? AND tid <= ? ORDER BY tid LIMIT 1`)
    .get(k.patient_id, def.matvarde, ...enheter, new Date(ms - TIMME).toISOString(), new Date(ms + 2 * TIMME).toISOString());
  return m ? { tid: m.tid, av: personNamn(db, m.registrerad_av), varde: m.varde, matvardeId: m.id } : null;
}

function uppgiftStatus(db, k, t, nu) {
  const def = KONTROLL[k.kontroll];
  const u = utfordVid(db, k, t);
  const ms = Date.parse(t);
  if (def.vatskebalans) {
    const slut = ms + 24 * TIMME;
    if (nu.getTime() < ms) return { status: 'planerad', utford: null };
    return { status: nu.getTime() >= slut ? (u ? 'utford' : 'forsenad') : 'pagar', utford: u };
  }
  if (u) return { status: 'utford', utford: u };
  return { status: nu.getTime() > ms + TIMME ? 'forsenad' : 'planerad', utford: null };
}
export const STATUS = { planerad: 'Planerad', utford: 'Utförd', forsenad: 'Försenad', pagar: 'Pågår' };

export function kontrollUt(db, k, nu = new Date()) {
  const def = KONTROLL[k.kontroll];
  const f = FREKVENSER[k.frekvens];
  const nasta = tiderFor(k, new Date(nu.getTime() - TIMME).toISOString(), new Date(nu.getTime() + 8 * 24 * TIMME).toISOString())
    .map(t => ({ tid: t, ...uppgiftStatus(db, k, t, nu) })).find(x => x.status !== 'utford') ?? null;
  return {
    id: k.id, kontroll: k.kontroll, namn: def?.namn ?? k.kontroll, intern: Boolean(def?.intern), frekvens: k.frekvens, frekvensText: f?.namn ?? k.frekvens,
    start: k.start, slut: k.slut, enhet: { id: k.enhet_id, namn: enhetsnamn(db, k.enhet_id) }, ordineradAv: personNamn(db, k.ordinerad_av), skapad: k.skapad,
    kommentar: k.kommentar, aktiv: !k.avslutad_tid && (!k.slut || Date.parse(k.slut) > nu.getTime()),
    avslutad: k.avslutad_tid ? { tid: k.avslutad_tid, av: personNamn(db, k.avslutad_av), orsak: k.avslutad_orsak } : null,
    nasta, matvarde: def?.matvarde ?? null, vatskebalans: Boolean(def?.vatskebalans),
  };
}

// Kontrollerna för patienten som den inloggade får se.
export function synligaKontroller(atk) {
  if (!finns(atk.db) || !kanRoll(atk.personal, 'las_prover')) return [];
  return atk.filtrera(atk.db.query('SELECT * FROM kontrollordinationer WHERE patient_id = ? ORDER BY start, id').all(atk.patientId).filter(giltig), 'las_prover');
}
export function forPatient(atk, nu = new Date()) {
  atk.krav('las_prover');
  const rader = synligaKontroller(atk);
  return {
    kontroller: rader.map(k => kontrollUt(atk.db, k, nu)),
    forslag: kanRoll(atk.personal, 'ordinera_kontroll') ? {
      start: forslagStart(nu), startText: `${Date.parse(forslagStart(nu)) - nu.getTime() < 24 * TIMME && datumAv(new Date(forslagStart(nu))) === datumAv(nu) ? 'i dag' : 'i morgon'} kl. 07.00`,
      kontroller: KONTROLLER.map(k => ({ id: k.id, namn: k.namn, intern: Boolean(k.intern), vatskebalans: Boolean(k.vatskebalans) })),
      frekvenser: Object.entries(FREKVENSER).filter(([id]) => id !== 'dygnet').map(([id, f]) => ({ id, namn: f.namn })),
      enhet: { id: enhetFor(atk.db, atk.personal, atk.patientId), namn: enhetsnamn(atk.db, enhetFor(atk.db, atk.personal, atk.patientId)) },
    } : null,
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
    demoregel: DEMOREGEL,
  };
}

// Ordinerar kontroller. body: { kontroller: [id], frekvens, start, dygn, kommentar }. Vätskebalansen följs alltid
// under ett dygn från starten.
export function ordinera(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakraKontroller(db);
  atk.krav('ordinera_kontroll');
  const lista = Array.isArray(body.kontroller) ? [...new Set(body.kontroller)] : [];
  if (!lista.length) throw new Fel(400, 'Välj minst en kontroll.', 'ogiltig', { falt: ['kontroller'] });
  if (lista.some(id => !iKatalog(KONTROLL, id))) throw new Fel(400, 'Kontrollen finns inte.', 'ogiltig', { falt: ['kontroller'] });
  const frekvens = body.frekvens ?? 'en_gang';
  if (!iKatalog(FREKVENSER, frekvens) || frekvens === 'dygnet') throw new Fel(400, 'Välj hur ofta kontrollen ska göras.', 'ogiltig', { falt: ['frekvens'] });
  const startMs = body.start == null || body.start === '' ? Date.parse(forslagStart(nu)) : Date.parse(body.start);
  if (!Number.isFinite(startMs)) throw new Fel(400, 'Starttiden är inte en giltig tidpunkt.', 'ogiltig', { falt: ['start'] });
  if (startMs < nu.getTime() - 2 * TIMME) throw new Fel(400, 'En kontroll kan inte ordineras bakåt i tiden. Ett värde som redan är taget registreras som mätvärde.', 'ogiltig', { falt: ['start'] });
  if (startMs > nu.getTime() + 30 * 24 * TIMME) throw new Fel(400, 'En kontroll kan ordineras högst 30 dagar framåt.', 'ogiltig', { falt: ['start'] });
  const dygn = body.dygn == null ? 1 : Number(body.dygn);
  if (!Number.isInteger(dygn) || dygn < 1 || dygn > 14) throw new Fel(400, 'En återkommande kontroll ordineras för 1 till 14 dygn. Behövs den längre ordineras den igen.', 'ogiltig', { falt: ['dygn'] });
  const start = new Date(startMs).toISOString();
  const enhet = enhetFor(db, atk.personal, atk.patientId);
  const kommentar = typeof body.kommentar === 'string' ? body.kommentar.trim().slice(0, 300) || null : null;
  const ins = db.query('INSERT INTO kontrollordinationer (patient_id, enhet_id, kontroll, frekvens, start, slut, ordinerad_av, skapad, kommentar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const ids = [];
  db.transaction(() => {
    for (const id of lista) {
      const vb = KONTROLL[id].vatskebalans;
      const f = vb ? 'dygnet' : frekvens;
      const slut = vb ? new Date(startMs + 24 * TIMME).toISOString() : f === 'en_gang' ? null : new Date(startMs + dygn * 24 * TIMME).toISOString();
      ids.push(Number(ins.run(atk.patientId, enhet, id, f, start, slut, atk.personal.id, iso(nu), kommentar).lastInsertRowid));
    }
  })();
  // Alla kontroller i samma ordination hör till samma vårdkontakt.
  const forsta = vardkontakt.knyt(atk, 'kontrollordinationer', { id: ids[0] }, body);
  const vk = db.query('SELECT vardkontakt_id FROM kontrollordinationer WHERE id = ?').get(ids[0])?.vardkontakt_id ?? null;
  if (vk) for (const id of ids.slice(1)) db.query('UPDATE kontrollordinationer SET vardkontakt_id = ? WHERE id = ?').run(vk, id);
  const namn = lista.map(id => KONTROLL[id].namn);
  return {
    kontroller: ids.map(id => kontrollUt(db, db.query('SELECT * FROM kontrollordinationer WHERE id = ?').get(id), nu)),
    vardkontakt: forsta.vardkontakt ?? null,
    text: `${namn.join(', ')} är ordinerat från ${labbDag(start, nu)} på ${enhetsnamn(db, enhet)}.`,
  };
}
const labbDag = (t, nu) => {
  const d = datumAv(new Date(t));
  return `${d === datumAv(nu) ? 'i dag' : d === addDagar(datumAv(nu), 1) ? 'i morgon' : d} kl. ${klocka(t)}`;
};

export function kontrollRad(db, id) {
  const k = finns(db) && /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM kontrollordinationer WHERE id = ?').get(Number(id)) : null;
  if (!k) throw new Fel(404, 'Kontrollen finns inte.', 'saknas');
  return k;
}
export function avsluta(atk, k, { orsak } = {}, nu = new Date()) {
  atk.krav('ordinera_kontroll', { resurs: { enhet_id: k.enhet_id } });
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== vardenhetFor(atk.db, k.enhet_id)) throw new Fel(403, 'En kontroll avslutas av en läkare på vårdenheten där den görs.', 'nekad');
  if (k.avslutad_tid) throw new Fel(409, 'Kontrollen är redan avslutad.', 'ogiltig');
  const o = typeof orsak === 'string' ? orsak.trim().slice(0, 300) : '';
  atk.db.query('UPDATE kontrollordinationer SET avslutad_tid = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ?').run(iso(nu), atk.personal.id, o || null, k.id);
  return { kontroll: kontrollUt(atk.db, kontrollRad(atk.db, k.id), nu), text: `${KONTROLL[k.kontroll]?.namn ?? 'Kontrollen'} är avslutad.` };
}

// De planerade uppgifterna för en vårdenhet eller en avdelning en dag: kontrollerna och provtagningarna. Bara patienter
// som den inloggade får läsa beställningar och kontroller för, och inget om patienter som inte syns. Varje patient loggas
// av anroparen. Returnerar också de patienter som raderna gäller, för loggningen.
export function planerat(db, personal, valFor, { enhetId = null, datum = null } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'las_prover')) throw new Fel(403, 'Yrkesrollen läser inte avdelningens planerade uppgifter.', 'nekad');
  const minVe = vardenhetFor(db, personal.enhet_id);
  const enhet = enhetId ?? personal.enhet_id;
  if (!db.query('SELECT 1 FROM enheter WHERE id = ?').get(enhet)) throw new Fel(404, 'Enheten finns inte.', 'saknas');
  if (vardenhetFor(db, enhet) !== minVe) throw new Fel(403, 'Du ser de planerade uppgifterna för din egen vårdenhet.', 'nekad');
  const dag = datum ?? datumAv(nu);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const fran = lokalTid(dag, '00:00');
  const till = lokalTid(addDagar(dag, 1), '00:00');
  const enheter = enhet === minVe ? enheterUnder(db, minVe) : [enhet];
  const ph = enheter.map(() => '?').join(', ');
  const uppgifter = [];
  const patienter = new Set();
  const far = new Map();
  const tillaten = (pid, enhetRad) => {
    const k = `${pid}|${enhetRad}`;
    if (!far.has(k)) far.set(k, new Atkomst(db, personal, pid, valFor(pid), 'las_prover').prova('las_prover', { enhet_id: enhetRad }).tillaten);
    return far.get(k);
  };
  const patientKort = (pid) => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
    const visad = Boolean(valFor(pid).visa_identitet);
    return { id: p.id, namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad), skyddad: Boolean(p.skyddad) };
  };
  const plats = (pid) => db.query(`SELECT plats FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL ORDER BY start DESC`).get(pid, ...enheter)?.plats ?? null;
  if (finns(db)) {
    for (const k of db.query(`SELECT * FROM kontrollordinationer WHERE enhet_id IN (${ph}) AND start < ? AND (slut IS NULL OR slut >= ?) ORDER BY start, id`).all(...enheter, till, fran)) {
      if (!giltig(k) || !tillaten(k.patient_id, k.enhet_id)) continue;
      for (const t of tiderFor(k, fran, till)) {
        const s = uppgiftStatus(db, k, t, nu);
        const def = KONTROLL[k.kontroll];
        patienter.add(k.patient_id);
        uppgifter.push({
          id: `kontroll:${k.id}:${t}`, typ: 'kontroll', kalla: 'kontroll', tid: t, slut: def.vatskebalans ? new Date(Date.parse(t) + 24 * TIMME).toISOString() : null,
          patient: patientKort(k.patient_id), plats: plats(k.patient_id), enhet: { id: k.enhet_id, namn: enhetsnamn(db, k.enhet_id) },
          rubrik: def.vatskebalans ? 'Följ vätskebalansen' : def.namn, text: `${FREKVENSER[k.frekvens]?.namn ?? ''}. Ordinerat av ${personNamn(db, k.ordinerad_av)}.${k.kommentar ? ` ${k.kommentar}` : ''}`,
          status: s.status, statusText: STATUS[s.status], utford: s.utford, yrkesroll: 'sjukskoterska', matvarde: def.matvarde ?? null,
          href: `#/patient/${encodeURIComponent(k.patient_id)}/${def.vatskebalans ? 'lakemedel' : 'matvarden'}`, kontrollId: k.id,
        });
      }
    }
  }
  // Provtagningarna: varje beställning med rör som ska tas under dagen eller togs under dagen.
  const prov = kanRoll(personal, 'ta_prov') ? labb.provtagningslista(db, personal, valFor, { datum: dag }, nu) : { patienter: [] };
  for (const p of prov.patienter) {
    // På en avdelning: beställningar från avdelningen och prover för patienter som ligger där.
    const harKontakt = Boolean(db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL LIMIT 1`).get(p.patient.id, ...enheter));
    for (const b of p.bestallningar) {
      if (enhet !== minVe && !enheter.includes(b.vardenhet.id) && !harKontakt) continue;
      const tider = [...new Set(b.prov.map(x => x.planerad))];
      for (const t of tider) {
        const ror = b.prov.filter(x => x.planerad === t);
        const tagna = ror.filter(x => x.provtagen);
        if (Date.parse(t) >= Date.parse(till) && !tagna.length) continue;
        patienter.add(p.patient.id);
        uppgifter.push({
          id: `provtagning:${b.id}:${t}`, typ: 'provtagning', kalla: 'labb', tid: t, slut: null, patient: p.patient, plats: p.plats, enhet: b.vardenhet,
          rubrik: `Provtagning, ${[...new Set(ror.flatMap(x => x.analyser))].join(', ')}`,
          text: `${ror.length} ${ror.length === 1 ? 'rör' : 'rör'} till ${[...new Set(ror.map(x => x.lab?.kort))].join(' och ')}. Beställt av ${b.ansvarig?.namn ?? ''} (${b.nummer}).`,
          status: tagna.length === ror.length ? 'utford' : ror.some(x => x.forsenad) ? 'forsenad' : 'planerad',
          statusText: tagna.length === ror.length ? 'Tagen' : ror.some(x => x.forsenad) ? 'Försenad' : tagna.length ? `${tagna.length} av ${ror.length} rör tagna` : 'Planerad',
          utford: tagna.length === ror.length ? { tid: tagna.map(x => x.provtagen.tid).sort().at(-1), av: tagna.at(-1).provtagen.av?.namn ?? null } : null,
          yrkesroll: 'sjukskoterska', bestallningId: b.id, href: `#/patient/${encodeURIComponent(p.patient.id)}/prover`,
        });
      }
    }
  }
  uppgifter.sort((a, b) => a.tid.localeCompare(b.tid) || a.patient.namn.localeCompare(b.patient.namn, 'sv'));
  return {
    enhet: { id: enhet, namn: enhetsnamn(db, enhet) }, datum: dag, uppgifter,
    demoregel: DEMOREGEL, patientIdn: [...patienter],
  };
}
