// Runda 10, r2: tabellerna för basfakta (överkänslighetens versioner och händelser) och för anpassade vyer på
// vårdenhetsnivå. Allt är IF NOT EXISTS, så att en äldre sandlåda får tabellerna när den läses in. Modulen beror inte på
// db.js.
const flytt = `(NEW.patient_id IS NOT OLD.patient_id
    AND EXISTS (SELECT 1 FROM installningar WHERE nyckel = 'sammanslagning_pagar' AND varde = OLD.patient_id || '>' || NEW.patient_id))`;

export const SCHEMA_R10R2 = `
-- Varje händelse för en överkänslighet (Sussa 3.1.6.2): registrerad, ändrad (en ny version) och avslutad, med uppgifterna
-- som de var efter händelsen, när, var, av vem och varför. Tabellen overkanslighet har de gällande uppgifterna med
-- status, och historiken här ändras och raderas aldrig. Bara en sammanslagning av två journaler (identitet.js) får flytta raderna.
CREATE TABLE IF NOT EXISTS overkanslighet_handelser (
  id INTEGER PRIMARY KEY, overkanslighet_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, version INTEGER NOT NULL,
  handelse TEXT NOT NULL, amne TEXT NOT NULL, atc TEXT, reaktion TEXT, allvarlighet TEXT NOT NULL, orsak TEXT,
  tid TEXT NOT NULL, av TEXT NOT NULL, av_enhet TEXT NOT NULL,
  CHECK (handelse IN ('registrerad', 'andrad', 'avslutad')),
  CHECK (handelse = 'registrerad' OR length(trim(coalesce(orsak, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS ix_ok_handelser_patient ON overkanslighet_handelser (patient_id);
CREATE TRIGGER IF NOT EXISTS overkanslighet_handelser_raderas_ej BEFORE DELETE ON overkanslighet_handelser
  BEGIN SELECT RAISE(ABORT, 'En händelse för en överkänslighet raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS overkanslighet_handelser_andras_ej BEFORE UPDATE ON overkanslighet_handelser
  WHEN NOT (${flytt} AND NEW.id IS OLD.id AND NEW.overkanslighet_id IS OLD.overkanslighet_id AND NEW.enhet_id IS OLD.enhet_id
    AND NEW.version IS OLD.version AND NEW.handelse IS OLD.handelse AND NEW.amne IS OLD.amne AND NEW.atc IS OLD.atc AND NEW.reaktion IS OLD.reaktion
    AND NEW.allvarlighet IS OLD.allvarlighet AND NEW.orsak IS OLD.orsak AND NEW.tid IS OLD.tid AND NEW.av IS OLD.av AND NEW.av_enhet IS OLD.av_enhet)
  BEGIN SELECT RAISE(ABORT, 'En händelse för en överkänslighet ändras inte'); END;

-- En överkänslighet raderas aldrig: den avslutas med status och orsak. Bara gallring och radering efter beslut (arkiv.js)
-- släpper triggern, som för andra journaltabeller.
CREATE TRIGGER IF NOT EXISTS overkanslighet_raderas_ej BEFORE DELETE ON overkanslighet
  BEGIN SELECT RAISE(ABORT, 'En överkänslighet raderas inte, den avslutas'); END;

-- Förval för vyerna på vårdenhetsnivå (Sussa 3.1.2.1 och 3.1.2.3). Systemförvaltningen sätter förvalet för en vårdenhet
-- och en vy, till exempel vilka delar av översikten som visas och i vilken ordning. Användarens egna val går före.
CREATE TABLE IF NOT EXISTS vyforval_vardenhet (
  vardenhet_id TEXT NOT NULL, vy TEXT NOT NULL, data TEXT NOT NULL, andrad TEXT NOT NULL, andrad_av TEXT NOT NULL,
  PRIMARY KEY (vardenhet_id, vy)
);
`;

export function sakraR10r2(db) {
  const kol = db.query('PRAGMA table_info(overkanslighet)').all().map(k => k.name);
  if (kol.length) {
    // Den gällande versionen och vem som registrerade den. Seedens och de migrerade raderna har version 1 utan person.
    if (!kol.includes('version')) db.exec('ALTER TABLE overkanslighet ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
    if (!kol.includes('registrerad')) db.exec('ALTER TABLE overkanslighet ADD COLUMN registrerad TEXT');
    if (!kol.includes('registrerad_av')) db.exec('ALTER TABLE overkanslighet ADD COLUMN registrerad_av TEXT');
    // En avslutad överkänslighet ligger kvar med status, vem, när och varför. Den raderas aldrig.
    if (!kol.includes('status')) db.exec("ALTER TABLE overkanslighet ADD COLUMN status TEXT NOT NULL DEFAULT 'aktiv'");
    for (const k of ['avslutad', 'avslutad_av', 'avslut_orsak']) if (!kol.includes(k)) db.exec(`ALTER TABLE overkanslighet ADD COLUMN ${k} TEXT`);
  }
  db.exec(SCHEMA_R10R2);
}
