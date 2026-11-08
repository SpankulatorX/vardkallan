// Rapporteringen till det nationella vaccinationsregistret (runda 10, r5, Sussa 3.5.1.7). Registret är simulerat i
// demon och märkt som simulerat. Varje vaccination i ett nationellt program som ges i Vårdkällan rapporteras av
// systemet när den registreras, utan att någon behöver göra något: personnummer, vaccin med ATC-kod, dos, datum, batch
// och vårdgivarens och vårdenhetens HSA-id. Det simulerade registret kvitterar direkt. En dos som har getts någon
// annanstans rapporteras av den som gav den och inte av Vårdkällan.
//
// Rapporterna ändras och raderas aldrig. Modulen importerar inga andra moduler med patientuppgifter, så att både
// barnhälsovården (bhv.js) och vaccinationsprogrammen (vaccinationsprogram.js) kan använda den.
import { iso } from './db.js';

export const MOTTAGARE = 'Nationellt vaccinationsregister (simulerat)';
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS vaccinationsrapporter (
  id INTEGER PRIMARY KEY, vaccination_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  tid TEXT NOT NULL, meddelande TEXT NOT NULL, status TEXT NOT NULL, kvittens TEXT
);
CREATE TRIGGER IF NOT EXISTS vaccinationsrapport_andras_ej BEFORE UPDATE ON vaccinationsrapporter BEGIN SELECT RAISE(ABORT, 'En rapport till vaccinationsregistret ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vaccinationsrapport_raderas_ej BEFORE DELETE ON vaccinationsrapporter BEGIN SELECT RAISE(ABORT, 'En rapport till vaccinationsregistret raderas inte'); END;
`;
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vaccinationsrapporter'").get());
const vardgivareFor = (db, enhetId) => {
  let id = enhetId;
  for (let i = 0; i < 6 && id; i++) {
    const e = db.query('SELECT id, hsa_id, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!e) return null;
    if (e.typ === 'vardgivare') return e.hsa_id;
    id = e.forald_id;
  }
  return null;
};

let nr = Math.floor(Math.random() * 400000) + 100000;
// Rapporterar en vaccination. Ger raden, eller null för en dos som har getts någon annanstans eller redan rapporteras.
export function rapportera(db, vaccinationId) {
  if (!harTabell(db)) return null;
  const v = db.query('SELECT * FROM vaccinationer WHERE id = ?').get(vaccinationId);
  if (!v || (v.kalla ?? 'vardkallan') !== 'vardkallan') return null;
  if (db.query('SELECT 1 FROM vaccinationsrapporter WHERE vaccination_id = ?').get(v.id)) return null;
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(v.patient_id);
  const enhet = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(v.enhet_id);
  const meddelande = { personnummer: p?.personnummer ?? null, atc: v.atc, vaccin: v.vaccin_id, dos: v.dos, datum: v.tid.slice(0, 10), batch: v.batch ?? null, vardgivare: vardgivareFor(db, v.enhet_id), vardenhet: enhet?.hsa_id ?? null };
  // Det simulerade registret tar emot meddelandet och kvitterar det direkt. Kvittensen har alltid sex siffror.
  nr = nr >= 999999 ? 100000 : nr + 1;
  db.query("INSERT INTO vaccinationsrapporter (vaccination_id, patient_id, enhet_id, tid, meddelande, status, kvittens) VALUES (?, ?, ?, ?, ?, 'kvitterad', ?)")
    .run(v.id, v.patient_id, v.enhet_id, iso(), JSON.stringify(meddelande), `VR-SIM-${nr}`);
  return db.query('SELECT * FROM vaccinationsrapporter WHERE vaccination_id = ?').get(v.id);
}

const STATUSTEXT = { kvitterad: `Rapporterad och kvitterad av vaccinationsregistret (simulerat)` };
export function rapportFor(db, vaccinationId) {
  if (!harTabell(db)) return null;
  const r = db.query('SELECT * FROM vaccinationsrapporter WHERE vaccination_id = ?').get(vaccinationId);
  return r ? { status: r.status, statusText: STATUSTEXT[r.status] ?? r.status, tid: r.tid, kvittens: r.kvittens, mottagare: MOTTAGARE } : null;
}

// Schemat. När tabellen är ny rapporteras seedens vaccinationer, som om de hade rapporterats när de gavs.
export function sakra(db) {
  const fanns = harTabell(db);
  db.exec(SCHEMA);
  if (!fanns && db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vaccinationer'").get()) {
    for (const v of db.query("SELECT id FROM vaccinationer WHERE coalesce(kalla, 'vardkallan') = 'vardkallan'").all()) rapportera(db, v.id);
  }
}
