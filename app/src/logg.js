// Åtkomstloggen. Varje rad kedjas till föregående med sha256, och databastriggrar stoppar ändring och radering.
import { createHash } from 'node:crypto';

// egen_atkomst och vardnadshavare är invånarens läsning i Min journal. De är inte vårdens åtkomst och flaggas inte.
export const GRUNDER = ['egen_enhet', 'vardrelation', 'aktivt_val', 'samtycke_sparr', 'nodatkomst', 'administrativ', 'logggranskning', 'nekad', 'egen_atkomst', 'vardnadshavare'];
export const INVANARGRUNDER = ['egen_atkomst', 'vardnadshavare'];
const NOLL = '0'.repeat(64);
const FALT = ['id', 'tid', 'personal_id', 'enhet_id', 'patient_id', 'handling', 'resurs', 'grund', 'syfte', 'resultat'];

// Kanonisk JSON: fälten i fast ordning, saknade värden som null. invanare_id kom till med Min journal och tas bara med
// när den finns, så att hashen för en rad från vårdens personal blir densamma som förut.
export function kanonisk(rad) {
  const o = Object.fromEntries(FALT.map(f => [f, rad[f] ?? null]));
  if (rad.invanare_id) o.invanare_id = rad.invanare_id;
  return JSON.stringify(o);
}
export const hashFor = (prev, rad) => createHash('sha256').update(prev + kanonisk(rad)).digest('hex');

export function loggaRad(db, rad) {
  if (!GRUNDER.includes(rad.grund)) throw new Error(`Okänd grund i loggen: ${rad.grund}`);
  const forra = db.query('SELECT id, hash FROM atkomstlogg ORDER BY id DESC LIMIT 1').get();
  const r = {
    id: (forra?.id ?? 0) + 1,
    tid: rad.tid ?? new Date().toISOString(),
    personal_id: rad.personal_id ?? null,
    enhet_id: rad.enhet_id ?? null,
    patient_id: rad.patient_id ?? null,
    handling: rad.handling,
    resurs: rad.resurs ?? null,
    grund: rad.grund,
    syfte: rad.syfte ?? null,
    resultat: rad.resultat ?? (rad.grund === 'nekad' ? 'nekad' : 'tillaten'),
    invanare_id: rad.invanare_id ?? null,
  };
  const prev = forra?.hash ?? NOLL;
  const hash = hashFor(prev, r);
  db.query(`INSERT INTO atkomstlogg (id, tid, personal_id, enhet_id, patient_id, handling, resurs, grund, syfte, resultat, prev_hash, hash, invanare_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.id, r.tid, r.personal_id, r.enhet_id, r.patient_id, r.handling, r.resurs, r.grund, r.syfte, r.resultat, prev, hash, r.invanare_id);
  return { ...r, prev_hash: prev, hash };
}

// Kontrollerar hela kedjan. Returnerar första rad som inte stämmer.
export function verifiera(db) {
  let prev = NOLL;
  let forvantatId = 1;
  let antal = 0;
  for (const rad of db.query('SELECT * FROM atkomstlogg ORDER BY id').iterate()) {
    antal++;
    if (rad.id !== forvantatId) return { hel: false, antal, felRad: rad.id, orsak: 'En eller flera rader saknas' };
    if (rad.prev_hash !== prev) return { hel: false, antal, felRad: rad.id, orsak: 'Kedjan är bruten' };
    if (hashFor(prev, rad) !== rad.hash) return { hel: false, antal, felRad: rad.id, orsak: 'Raden har ändrats' };
    prev = rad.hash;
    forvantatId++;
  }
  return { hel: true, antal, felRad: null, orsak: null };
}

const FLAGGOR = {
  alla: '1 = 1',
  nodatkomst: "l.grund = 'nodatkomst'",
  nekad: "l.resultat = 'nekad'",
  samtycke: "l.grund = 'samtycke_sparr'",
  // Vårdens åtkomster, utan invånarnas läsningar i Min journal.
  vard: 'l.invanare_id IS NULL',
};

export function lista(db, { patientId = null, flagga = 'alla', fran = null, till = null, max = 500 } = {}) {
  const villkor = [FLAGGOR[flagga] ?? FLAGGOR.alla];
  const arg = [];
  // patientId kan vara en lista: en patient och journalerna som har slagits samman med den (Sussa 3.1.1.2).
  if (patientId) { const ids = [patientId].flat(); villkor.push(`l.patient_id IN (${ids.map(() => '?').join(', ')})`); arg.push(...ids); }
  if (fran) { villkor.push('l.tid >= ?'); arg.push(fran); }
  if (till) { villkor.push('l.tid <= ?'); arg.push(till); }
  arg.push(max);
  // En rad från Min journal har invånaren i stället för personal. Patientens egen läsning visas utan namn (namnet är
  // patientens, som kan ha skyddad identitet), en vårdnadshavare med sitt namn.
  return db.query(`SELECT l.*, p.namn AS personal_namn, p.yrke AS personal_yrke, e.namn AS enhet_namn,
      i.fornamn AS inv_fornamn, i.efternamn AS inv_efternamn, i.patient_id AS inv_patient
    FROM atkomstlogg l LEFT JOIN personal p ON p.id = l.personal_id LEFT JOIN enheter e ON e.id = l.enhet_id
      LEFT JOIN invanare i ON i.id = l.invanare_id
    WHERE ${villkor.join(' AND ')} ORDER BY l.id DESC LIMIT ?`).all(...arg).map(r => ({
    id: r.id, tid: r.tid, personal: r.personal_id ? { id: r.personal_id, namn: r.personal_namn, yrke: r.personal_yrke } : null,
    invanare: r.invanare_id ? invanareKort(r) : null,
    enhet: r.enhet_id ? { id: r.enhet_id, namn: r.enhet_namn } : null, patientId: r.patient_id, handling: r.handling,
    resurs: r.resurs, grund: r.grund, syfte: r.syfte, resultat: r.resultat,
    flaggad: r.grund === 'nodatkomst' || r.grund === 'samtycke_sparr' || r.resultat === 'nekad', hash: r.hash,
  }));
}

function invanareKort(r) {
  const egen = r.inv_patient != null && r.inv_patient === r.patient_id;
  const relation = egen ? 'egen' : r.grund === 'vardnadshavare' ? 'vardnadshavare' : 'annan';
  return { id: r.invanare_id, relation, namn: egen || r.inv_fornamn == null ? null : `${r.inv_fornamn} ${r.inv_efternamn}` };
}
