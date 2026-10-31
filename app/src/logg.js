// Åtkomstloggen. Varje rad kedjas till föregående med sha256, och databastriggrar stoppar ändring och radering.
import { createHash } from 'node:crypto';

export const GRUNDER = ['egen_enhet', 'vardrelation', 'aktivt_val', 'samtycke_sparr', 'nodatkomst', 'administrativ', 'logggranskning', 'nekad'];
const NOLL = '0'.repeat(64);
const FALT = ['id', 'tid', 'personal_id', 'enhet_id', 'patient_id', 'handling', 'resurs', 'grund', 'syfte', 'resultat'];

// Kanonisk JSON: fälten i fast ordning, saknade värden som null.
export function kanonisk(rad) {
  return JSON.stringify(Object.fromEntries(FALT.map(f => [f, rad[f] ?? null])));
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
  };
  const prev = forra?.hash ?? NOLL;
  const hash = hashFor(prev, r);
  db.query(`INSERT INTO atkomstlogg (id, tid, personal_id, enhet_id, patient_id, handling, resurs, grund, syfte, resultat, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.id, r.tid, r.personal_id, r.enhet_id, r.patient_id, r.handling, r.resurs, r.grund, r.syfte, r.resultat, prev, hash);
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
};

export function lista(db, { patientId = null, flagga = 'alla', fran = null, till = null, max = 500 } = {}) {
  const villkor = [FLAGGOR[flagga] ?? FLAGGOR.alla];
  const arg = [];
  if (patientId) { villkor.push('l.patient_id = ?'); arg.push(patientId); }
  if (fran) { villkor.push('l.tid >= ?'); arg.push(fran); }
  if (till) { villkor.push('l.tid <= ?'); arg.push(till); }
  arg.push(max);
  return db.query(`SELECT l.*, p.namn AS personal_namn, p.yrke AS personal_yrke, e.namn AS enhet_namn
    FROM atkomstlogg l LEFT JOIN personal p ON p.id = l.personal_id LEFT JOIN enheter e ON e.id = l.enhet_id
    WHERE ${villkor.join(' AND ')} ORDER BY l.id DESC LIMIT ?`).all(...arg).map(r => ({
    id: r.id, tid: r.tid, personal: r.personal_id ? { id: r.personal_id, namn: r.personal_namn, yrke: r.personal_yrke } : null,
    enhet: r.enhet_id ? { id: r.enhet_id, namn: r.enhet_namn } : null, patientId: r.patient_id, handling: r.handling,
    resurs: r.resurs, grund: r.grund, syfte: r.syfte, resultat: r.resultat,
    flaggad: r.grund === 'nodatkomst' || r.grund === 'samtycke_sparr' || r.resultat === 'nekad', hash: r.hash,
  }));
}
