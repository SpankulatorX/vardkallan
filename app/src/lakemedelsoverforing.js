// Överföring av läkemedelsberättelsen och läkemedelslistan till nästa vårdgivare (runda 10, r5, Sussa 3.5.1.1).
//
// Systemet är experten. När patienten ska vidare efter ett vårdtillfälle tar systemet fram det som ska följa med:
// läkemedelsberättelsen ur ordinationernas historik (vidimering.js), den aktuella läkemedelslistan och den signerade
// epikrisen. Systemet väljer själv mottagarna: vårdcentralen där patienten är listad, och kommunen när en samordnad
// planering vid utskrivning pågår med kommunen. Läkaren skickar med ett klick, och mottagaren ser överföringen i
// inkorgen och kvitterar den. Avsändaren ser när den är kvitterad.
//
// Behörighet. Bara en läkare med vårdrelation på den vårdenhet som hade vårdtillfället skickar, aldrig under
// nödåtkomst. Innehållet tas fram utan samtycke till spärrade uppgifter, så att ordinationer från en spärrad vårdenhet
// aldrig följer med. Har patienten spärrat uppgifterna på den egna vårdenheten skickas ingenting utan patientens
// samtycke, som registreras med överföringen. En överföring ses bara av avsändarens och mottagarens vårdenheter,
// aldrig av en tredje vårdenhet, inte ens efter ett aktivt val. Kommunen är en simulerad part i demon: den får
// läkemedelslistan och berättelsen men inte epikrisen, och ser bara överföringar i planeringar den deltar i. Det som
// har skickats ändras och raderas aldrig.
import { Fel, iso, idag, addDagar } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, aktivaSparrar, harVardrelation, enheterUnder } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import * as vidimering from './vidimering.js';
import * as samordnad from './samordnad.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS lakemedelsoverforingar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardtillfalle_id INTEGER, mottagare TEXT NOT NULL,
  mottagare_typ TEXT NOT NULL, samordning_id INTEGER, skickad TEXT NOT NULL, skickad_av TEXT NOT NULL, berattelse TEXT NOT NULL,
  lista TEXT NOT NULL, epikris TEXT, samtycke INTEGER NOT NULL DEFAULT 0, kvitterad TEXT, kvitterad_av TEXT,
  CHECK (mottagare_typ IN ('vardenhet', 'kommun'))
);
CREATE TRIGGER IF NOT EXISTS lmoverforing_andras_ej BEFORE UPDATE OF patient_id, enhet_id, vardtillfalle_id, mottagare, mottagare_typ, samordning_id, skickad, skickad_av, berattelse, lista, epikris, samtycke ON lakemedelsoverforingar
  BEGIN SELECT RAISE(ABORT, 'En läkemedelsöverföring ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS lmoverforing_kvittens_andras_ej BEFORE UPDATE OF kvitterad, kvitterad_av ON lakemedelsoverforingar WHEN OLD.kvitterad IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'En kvitterad läkemedelsöverföring ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS lmoverforing_raderas_ej BEFORE DELETE ON lakemedelsoverforingar BEGIN SELECT RAISE(ABORT, 'En läkemedelsöverföring raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

const DAGAR = 30;
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
// Samma användare och val, men utan samtycke till spärrade uppgifter (som vidimeringen).
const utanSamtycke = (atk) => new Atkomst(atk.db, atk.personal, atk.patientId, { ...atk.val, samtycke_sparr: false }, atk.handling);

// Det senaste vårdtillfället på användarens vårdenhet, pågående eller avslutat de senaste 30 dagarna.
function vardtillfalle(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const grans = new Date(Date.now() - DAGAR * 86400_000).toISOString();
  return db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND (utskriven IS NULL OR utskriven >= ?) ORDER BY inskriven DESC').all(patientId, grans)
    .find(vt => vardenhetFor(db, vt.enhet_id) === ve) ?? null;
}

// Mottagarna som systemet väljer: vårdcentralen där patienten är listad, och kommunen i en samordnad planering vid
// utskrivning för vårdtillfället där kommunen är mottagare.
function mottagare(db, personal, patientId, vt) {
  const ut = [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const listad = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(patientId)?.enhet_id;
  if (listad && vardenhetFor(db, listad) !== ve) ut.push({ ...enhetKort(db, vardenhetFor(db, listad)), typ: 'vardenhet', varfor: 'Patienten är listad här.' });
  const spu = vt ? db.query("SELECT * FROM samordningar WHERE vardtillfalle_id = ? AND typ = 'spu' ORDER BY id DESC").all(vt.id)
    .find(s => (samordnad.lage(db, s).mottagare ?? []).includes(samordnad.KOMMUN)) : null;
  if (spu) ut.push({ ...enhetKort(db, samordnad.KOMMUN), typ: 'kommun', varfor: 'Kommunen deltar i den samordnade planeringen vid utskrivningen.', samordningId: spu.id });
  return ut;
}

// Den signerade epikrisen för vårdtillfället på vårdenheten, som text.
function epikrisFor(db, vt, ve) {
  if (!vt) return null;
  const en = enheterUnder(db, ve);
  const kontakter = db.query('SELECT id FROM vardkontakter WHERE vardtillfalle_id = ?').all(vt.id).map(r => r.id);
  if (!kontakter.length) return null;
  const a = db.query(`SELECT * FROM anteckningar WHERE typ = 'Epikris' AND status = 'signerad' AND vardkontakt_id IN (${kontakter.map(() => '?').join(', ')})
    AND enhet_id IN (${en.map(() => '?').join(', ')}) AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = anteckningar.id) ORDER BY signerad_tid DESC`).get(...kontakter, ...en);
  if (!a) return null;
  return { id: a.id, signerad: a.signerad_tid, av: personKort(db, a.signerad_av)?.namn ?? null, text: JSON.parse(a.sokord).filter(s => s.text).map(s => `${s.sokord}: ${s.text}`).join('\n') };
}

// Innehållet: berättelsen, listan och epikrisen, utan spärrade uppgifter.
function innehall(atk, vt) {
  const db = atk.db;
  const u = utanSamtycke(atk);
  const pagaende = lakemedel.synligaOrdinationer(u).filter(lakemedel.aktuell);
  const lista = pagaende.map(o => {
    const x = lakemedel.ordinationUt(db, o, { historik: false });
    return { lakemedel: x.lakemedel?.namn ?? null, styrka: x.lakemedel?.styrka ?? null, dosering: x.dosering, ordinationsorsak: x.ordinationsorsak, start: x.start, uppfoljningsdatum: x.uppfoljningsdatum, vardenhet: x.vardenhet?.namn ?? null };
  });
  return { berattelse: vidimering.berattelse(u, { pagaendeOrd: pagaende }).text, lista, epikris: epikrisFor(db, vt, vardenhetFor(db, atk.personal.enhet_id)) };
}

const STATUS = { skickad: 'Skickad, inte kvitterad', kvitterad: 'Kvitterad av mottagaren' };
export function overforingUt(db, r, { forKommun = false } = {}) {
  return {
    id: r.id, fran: enhetKort(db, r.enhet_id), mottagare: { ...enhetKort(db, r.mottagare), typ: r.mottagare_typ }, skickad: r.skickad, skickadAv: personKort(db, r.skickad_av),
    status: r.kvitterad ? 'kvitterad' : 'skickad', statusText: STATUS[r.kvitterad ? 'kvitterad' : 'skickad'], kvitterad: r.kvitterad, kvitteradAv: personKort(db, r.kvitterad_av),
    berattelse: r.berattelse, lista: JSON.parse(r.lista), epikris: forKommun || !r.epikris ? null : JSON.parse(r.epikris), samtycke: Boolean(r.samtycke),
  };
}

// Raderna som användarens vårdenhet får se: de den har skickat och de som är ställda till den.
function synliga(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM lakemedelsoverforingar WHERE patient_id = ? ORDER BY skickad DESC, id DESC').all(patientId)
    .filter(r => vardenhetFor(db, r.enhet_id) === ve || (r.mottagare_typ === 'vardenhet' && vardenhetFor(db, r.mottagare) === ve));
}

const kanSkicka = (atk) => atk.personal.yrke === 'lakare' && kanRoll(atk.personal, 'ordinera') && atk.prova('ordinera').tillaten && atk.prova('ordinera').grund !== 'nodatkomst';

// GET: förslaget (för den vårdenhet som hade vårdtillfället) och överföringarna som vårdenheten får se.
export function forPatient(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const vt = vardtillfalle(db, atk.personal, atk.patientId);
  let forslag = null;
  if (vt && ['lakare', 'sjukskoterska'].includes(atk.personal.yrke)) {
    const m = mottagare(db, atk.personal, atk.patientId, vt);
    const ve = vardenhetFor(db, atk.personal.enhet_id);
    const sparr = aktivaSparrar(db, atk.patientId).includes(ve);
    forslag = {
      vardtillfalle: { id: vt.id, inskriven: vt.inskriven, utskriven: vt.utskriven }, mottagare: m.map(({ samordningId, ...x }) => x), ...innehall(atk, vt),
      kraverSamtycke: sparr, varfor: sparr ? `Patienten har spärrat uppgifterna på ${enhetKort(db, ve).namn}. Läkemedelsberättelsen skickas bara om patienten samtycker nu.` : null,
      kan: { skicka: kanSkicka(atk) && m.length > 0 },
      text: m.length ? `Systemet skickar till ${m.map(x => x.namn).join(' och ')}.` : 'Patienten är inte listad på någon annan vårdenhet och har ingen samordnad planering med kommunen. Det finns ingen mottagare att skicka till.',
    };
  }
  return { forslag, overforingar: synliga(db, atk.personal, atk.patientId).map(r => overforingUt(db, r)) };
}

// POST: skickar till mottagarna som systemet har valt. body.samtycke när patienten har spärrat den egna vårdenheten.
export function skicka(atk, body = {}) {
  const db = atk.db;
  const r = atk.krav('ordinera', { beskrivning: 'lakemedelsoverforing' });
  if (r.grund === 'nodatkomst' || atk.personal.yrke !== 'lakare') {
    atk.logga('ordinera', 'nekad', 'lakemedelsoverforing', 'nekad');
    throw new Fel(403, 'Läkemedelsberättelsen skickas av en läkare med vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
  const vt = vardtillfalle(db, atk.personal, atk.patientId);
  if (!vt) throw new Fel(400, `Patienten har inget vårdtillfälle på din vårdenhet de senaste ${DAGAR} dagarna. Läkemedelsberättelsen skickas från den vårdenhet som hade vårdtillfället.`, 'ogiltig');
  const m = mottagare(db, atk.personal, atk.patientId, vt);
  if (!m.length) throw new Fel(400, 'Det finns ingen mottagare: patienten är inte listad på någon annan vårdenhet och har ingen samordnad planering med kommunen.', 'ogiltig');
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const samtycke = body.samtycke === true;
  if (aktivaSparrar(db, atk.patientId).includes(ve) && !samtycke) {
    throw new Fel(400, `Patienten har spärrat uppgifterna på ${enhetKort(db, ve).namn}. Fråga patienten om samtycke att skicka läkemedelsberättelsen, och registrera samtycket.`, 'ogiltig', { falt: ['samtycke'] });
  }
  const inn = innehall(atk, vt);
  const t = iso();
  const ids = [];
  for (const x of m) {
    const id = Number(db.query(`INSERT INTO lakemedelsoverforingar (patient_id, enhet_id, vardtillfalle_id, mottagare, mottagare_typ, samordning_id, skickad, skickad_av, berattelse, lista, epikris, samtycke)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, vt.id, x.id, x.typ, x.samordningId ?? null, t, atk.personal.id, inn.berattelse,
      JSON.stringify(inn.lista), x.typ === 'vardenhet' && inn.epikris ? JSON.stringify(inn.epikris) : null, samtycke ? 1 : 0).lastInsertRowid);
    ids.push(id);
    atk.logga('ordinera', atk.grund(), `lakemedelsoverforing:${id}`, 'tillaten', samtycke ? 'Skickad efter patientens samtycke trots spärr på vårdenheten.' : null);
  }
  const delar = inn.epikris ? 'Läkemedelsberättelsen, läkemedelslistan och epikrisen' : 'Läkemedelsberättelsen och läkemedelslistan';
  return [201, { overforingar: ids.map(id => overforingUt(db, db.query('SELECT * FROM lakemedelsoverforingar WHERE id = ?').get(id))), text: `${delar} är skickade till ${m.map(x => x.namn).join(' och ')}.` }];
}

export const hamta = (db, id) => db.query('SELECT * FROM lakemedelsoverforingar WHERE id = ?').get(Number(id)) ?? null;

// Kvittensen från en mottagande vårdenhet: en läkare eller sjuksköterska på vårdenheten som får läsa läkemedel.
export function kvittera(atk, rad) {
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  if (!rad || rad.mottagare_typ !== 'vardenhet' || vardenhetFor(db, rad.mottagare) !== ve) {
    atk.logga('las_lakemedel', 'nekad', `lakemedelsoverforing:${rad?.id ?? 'okand'}:kvittens`, 'nekad');
    throw new Fel(404, 'Överföringen finns inte.', 'saknas');
  }
  atk.krav('las_lakemedel');
  if (!['lakare', 'sjukskoterska'].includes(atk.personal.yrke)) throw new Fel(403, 'En läkare eller sjuksköterska på vårdenheten kvitterar överföringen.', 'nekad');
  return kvitteraRad(db, rad, atk.personal, () => atk.logga('las_lakemedel', atk.grund(), `lakemedelsoverforing:${rad.id}:kvittens`));
}
function kvitteraRad(db, rad, pers, logga) {
  if (rad.kvitterad) throw new Fel(400, `Överföringen är redan kvitterad av ${personKort(db, rad.kvitterad_av)?.namn ?? 'någon annan'}.`, 'ogiltig');
  db.query('UPDATE lakemedelsoverforingar SET kvitterad = ?, kvitterad_av = ? WHERE id = ?').run(iso(), pers.id, rad.id);
  logga();
  return overforingUt(db, hamta(db, rad.id), { forKommun: rad.mottagare_typ === 'kommun' });
}

// Kommunen (simulerad part): överföringarna i en samordnad planering som kommunen deltar i. kommunDetalj prövar att
// planeringen är kommunens och loggar åtkomsten på patienten.
export function forKommun(db, pers, samordningId) {
  const s = samordnad.kommunDetalj(db, pers, samordningId);
  const rad = db.query('SELECT patient_id FROM samordningar WHERE id = ?').get(s.id);
  const rader = db.query("SELECT * FROM lakemedelsoverforingar WHERE patient_id = ? AND mottagare_typ = 'kommun' AND samordning_id = ? ORDER BY skickad DESC").all(rad.patient_id, s.id);
  return { samordning: { id: s.id, typText: s.typText }, patient: s.patient, overforingar: rader.map(r => overforingUt(db, r, { forKommun: true })) };
}
export function kommunKvittera(db, pers, rad) {
  if (!rad || rad.mottagare_typ !== 'kommun' || !rad.samordning_id) throw new Fel(404, 'Överföringen finns inte.', 'saknas');
  samordnad.kommunDetalj(db, pers, rad.samordning_id);
  return kvitteraRad(db, rad, pers, () => {});
}

// Inkorgen: överföringar till användarens vårdenhet som inte är kvitterade, för patienter med vårdrelation.
export function inkorg(db, personal, patientKort) {
  if (!['lakare', 'sjukskoterska'].includes(personal?.yrke)) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query("SELECT * FROM lakemedelsoverforingar WHERE kvitterad IS NULL AND mottagare_typ = 'vardenhet' ORDER BY skickad").all()
    .filter(r => vardenhetFor(db, r.mottagare) === ve && harVardrelation(db, r.patient_id, ve))
    .map(r => ({ id: r.id, patientId: r.patient_id, patient: patientKort(db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id)), fran: enhetKort(db, vardenhetFor(db, r.enhet_id))?.namn ?? null, skickad: r.skickad,
      text: 'Läkemedelsberättelse och läkemedelslista att kvittera.', lank: `#/patient/${encodeURIComponent(r.patient_id)}/lakemedel` }));
}

