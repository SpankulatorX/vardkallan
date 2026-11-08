// Schemat för dosändringar i pågående ordinationer (runda 8, r4, dosandring.js). Modulen beror inte på db.js, så att
// db.js kan använda den både när mallen byggs och när en äldre sandlåda läses in. Varje dosändring sparas och raderas
// eller ändras aldrig. Bara den tid då ändringen började gälla (tillampad) fylls i efteråt, en gång.
export const SCHEMA_DOSANDRING = `
CREATE TABLE IF NOT EXISTS dosandringar (
  id INTEGER PRIMARY KEY, ordination_id INTEGER NOT NULL, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, fore TEXT NOT NULL, efter TEXT NOT NULL,
  orsak TEXT, av TEXT NOT NULL, tid TEXT NOT NULL, tillampad TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE INDEX IF NOT EXISTS ix_dosandring_ordination ON dosandringar (ordination_id);
CREATE TRIGGER IF NOT EXISTS dosandring_raderas_ej BEFORE DELETE ON dosandringar BEGIN SELECT RAISE(ABORT, 'En dosändring raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS dosandring_andras_ej BEFORE UPDATE ON dosandringar
  WHEN OLD.tillampad IS NOT NULL OR NEW.id IS NOT OLD.id OR NEW.ordination_id IS NOT OLD.ordination_id OR NEW.enhet_id IS NOT OLD.enhet_id OR NEW.fran IS NOT OLD.fran
    OR NEW.fore IS NOT OLD.fore OR NEW.efter IS NOT OLD.efter OR NEW.orsak IS NOT OLD.orsak OR NEW.av IS NOT OLD.av OR NEW.tid IS NOT OLD.tid
  BEGIN SELECT RAISE(ABORT, 'En dosändring ändras inte'); END;
`;
const sakrade = new WeakSet();
export function sakraDosandring(db) {
  if (sakrade.has(db)) return;
  db.exec(SCHEMA_DOSANDRING);
  sakrade.add(db);
}
// En sandlåda från före runda 8 kan sakna tabellen. Ett ja sparas, så att listorna inte frågar varje gång.
export const harTabell = (db) => {
  if (sakrade.has(db)) return true;
  const finns = Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'dosandringar'").get());
  if (finns) sakrade.add(db);
  return finns;
};

