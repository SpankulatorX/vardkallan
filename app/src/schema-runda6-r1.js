// Runda 6, r1: tabellerna för åtgärder med KVÅ (atgarder.js), säkerhetsloggen (sakerhetslogg.js) och stickproven i
// logguppföljningen (logguppfoljning.js), och seedens delar som systemet räknar fram: eGFR ur kreatinin, summan för GCS
// och åtgärderna för de NEWS2-omgångar och GCS-bedömningar som finns i seeden. Modulen beror inte på db.js, så att
// db.js kan använda den både när mallen byggs och när en äldre sandlåda läses in.
import { ckdEpi2021, tolkaGcs, news2Omgangar } from './skalor.js';

export const SCHEMA_R1 = `
CREATE TABLE IF NOT EXISTS atgarder (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, kod TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT, underlag TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE INDEX IF NOT EXISTS ix_atgard_patient ON atgarder (patient_id);
CREATE TRIGGER IF NOT EXISTS atgard_raderas_ej BEFORE DELETE ON atgarder
  BEGIN SELECT RAISE(ABORT, 'En registrerad åtgärd raderas inte'); END;
-- patient_id ändras bara när journaler slås samman (identitet.js flyttar alla rader med patient_id).
CREATE TRIGGER IF NOT EXISTS atgard_andras_ej BEFORE UPDATE OF enhet_id, kod, tid, av, underlag ON atgarder
  BEGIN SELECT RAISE(ABORT, 'En registrerad åtgärd ändras inte'); END;

CREATE TABLE IF NOT EXISTS sakerhetslogg (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, typ TEXT NOT NULL, personal_id TEXT, invanare_id TEXT, enhet_id TEXT,
  metod TEXT, vag TEXT, status INTEGER, beskrivning TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS sakerhetslogg_ingen_andring BEFORE UPDATE ON sakerhetslogg
  BEGIN SELECT RAISE(ABORT, 'Säkerhetsloggen kan inte ändras'); END;
CREATE TRIGGER IF NOT EXISTS sakerhetslogg_ingen_radering BEFORE DELETE ON sakerhetslogg
  BEGIN SELECT RAISE(ABORT, 'Säkerhetsloggen kan inte raderas'); END;

CREATE TABLE IF NOT EXISTS stickprov (
  id INTEGER PRIMARY KEY, skapad TEXT NOT NULL, av TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL, antal INTEGER NOT NULL,
  urval INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stickprov_rader (
  stickprov_id INTEGER NOT NULL, logg_id INTEGER NOT NULL, ordning INTEGER NOT NULL, granskad TEXT, granskad_av TEXT,
  bedomning TEXT, kommentar TEXT, PRIMARY KEY (stickprov_id, logg_id),
  CHECK (bedomning IS NULL OR bedomning IN ('befogad', 'utreds'))
);
CREATE TRIGGER IF NOT EXISTS stickprov_raderas_ej BEFORE DELETE ON stickprov
  BEGIN SELECT RAISE(ABORT, 'Ett stickprov raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS stickprov_andras_ej BEFORE UPDATE ON stickprov
  BEGIN SELECT RAISE(ABORT, 'Ett stickprov ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS stickprovsrad_raderas_ej BEFORE DELETE ON stickprov_rader
  BEGIN SELECT RAISE(ABORT, 'En rad i ett stickprov raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS stickprovsrad_granskas_en_gang BEFORE UPDATE ON stickprov_rader
  WHEN OLD.granskad IS NOT NULL OR NEW.stickprov_id <> OLD.stickprov_id OR NEW.logg_id <> OLD.logg_id OR NEW.ordning <> OLD.ordning
  BEGIN SELECT RAISE(ABORT, 'En granskad rad i ett stickprov ändras inte'); END;
`;

export function sakraR1Schema(db) {
  db.exec(SCHEMA_R1);
}

const datumI = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
function alderVid(fodd, datum) {
  const [y, m, d] = fodd.split('-').map(Number);
  const [ty, tm, td] = datum.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function seedaR1(db) {
  // eGFR i seeden räknas ur kreatininet vid samma provtagning, med patientens ålder då och kön (CKD-EPI 2021).
  for (const e of db.query("SELECT m.id, m.patient_id, m.tid, p.fodd, p.kon FROM matvarden m JOIN patienter p ON p.id = m.patient_id WHERE m.typ = 'egfr' AND m.varde = 'ckd-epi'").all()) {
    const k = db.query("SELECT varde_num FROM matvarden WHERE patient_id = ? AND typ = 'kreatinin' AND tid = ?").get(e.patient_id, e.tid);
    if (!k) throw new Error(`eGFR utan kreatinin för ${e.patient_id} ${e.tid}`);
    const v = ckdEpi2021(k.varde_num, alderVid(e.fodd, datumI(e.tid)), e.kon);
    db.query('UPDATE matvarden SET varde = ?, varde_num = ? WHERE id = ?').run(String(v), v, e.id);
  }
  // GCS i seeden får summan som tal.
  for (const g of db.query("SELECT id, varde FROM matvarden WHERE typ = 'gcs' AND varde_num IS NULL").all()) {
    db.query('UPDATE matvarden SET varde_num = ? WHERE id = ?').run(tolkaGcs(g.varde).summa, g.id);
  }
  // Åtgärderna: en hel NEWS2-omgång är övervakning av vitala tecken (KVÅ QD008) och en GCS-bedömning bedömning av
  // medvetandefunktioner (KVÅ PA001), på den vårdenhet och den vårdkontakt där värdena togs.
  const ins = db.query('INSERT INTO atgarder (patient_id, enhet_id, vardkontakt_id, kod, tid, av, underlag, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const { patient_id: pid } of db.query('SELECT DISTINCT patient_id FROM matvarden').all()) {
    const rader = db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY tid, id').all(pid);
    const perId = new Map(rader.map(r => [r.id, r]));
    for (const o of news2Omgangar(rader)) {
      const anvanda = o.anvanda.map(id => perId.get(id));
      // En omgång räknas när alla sju värdena togs vid samma tillfälle och på samma vårdenhet.
      if (!o.resultat.komplett || anvanda.some(r => r.tid !== o.tid || r.enhet_id !== anvanda[0].enhet_id)) continue;
      const a = perId.get(o.ankareId);
      ins.run(pid, a.enhet_id, a.vardkontakt_id, 'QD008', o.tid, a.registrerad_av, JSON.stringify({ matvarden: o.anvanda }), a.kalla);
    }
    for (const g of rader.filter(r => r.typ === 'gcs')) ins.run(pid, g.enhet_id, g.vardkontakt_id, 'PA001', g.tid, g.registrerad_av, JSON.stringify({ matvarden: [g.id] }), g.kalla);
  }
}
