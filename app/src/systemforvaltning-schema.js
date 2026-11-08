// Systemförvaltningen (runda 7, r4, Sussa 12.1 och KD1.1.3): schema och seed. Modulen beror inte på db.js, så att db.js
// kan använda den både när mallen byggs och när en äldre sandlåda läses in. Allt är IF NOT EXISTS.
import { PERSONAL } from './seed/personal.js';

// Rader som bara läggs till.
const bestaende = (t, text) => `
CREATE TRIGGER IF NOT EXISTS ${t}_raderas_ej BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_andras_ej BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} ändras inte'); END;`;

export const SCHEMA_SYSTEMFORVALTNING = `
-- Ändringar av regler och parametrar (slag parameter) och undantag från visning och publicering (slag undantag), med
-- fyra ögon: den som föreslår en ändring kan inte godkänna den. varde och forra är JSON. galler_fran sätts när ändringen
-- godkänns och är giltig_fran eller beslutsdagen om den är senare, så att en ändring aldrig gäller bakåt i tiden.
-- En ändring raderas aldrig, och när den är beslutad ändras den inte.
CREATE TABLE IF NOT EXISTS konfig_andringar (
  id INTEGER PRIMARY KEY, slag TEXT NOT NULL, nyckel TEXT NOT NULL, varde TEXT NOT NULL, forra TEXT,
  giltig_fran TEXT NOT NULL, motivering TEXT NOT NULL, foreslagen_av TEXT NOT NULL, foreslagen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vantar', beslutad_av TEXT, beslutad TEXT, beslut_kommentar TEXT, galler_fran TEXT,
  CHECK (slag IN ('parameter', 'undantag')), CHECK (status IN ('vantar', 'godkand', 'avslagen', 'aterkallad')),
  CHECK (status <> 'godkand' OR (beslutad_av IS NOT NULL AND beslutad_av <> foreslagen_av AND galler_fran IS NOT NULL)),
  CHECK (length(trim(motivering)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_konfig_nyckel ON konfig_andringar (nyckel, status);
CREATE TRIGGER IF NOT EXISTS konfig_andring_raderas_ej BEFORE DELETE ON konfig_andringar
  BEGIN SELECT RAISE(ABORT, 'En ändring av konfigurationen raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS konfig_andring_andras_ej BEFORE UPDATE ON konfig_andringar
  WHEN OLD.status <> 'vantar' OR NEW.id IS NOT OLD.id OR NEW.slag IS NOT OLD.slag OR NEW.nyckel IS NOT OLD.nyckel
    OR NEW.varde IS NOT OLD.varde OR NEW.forra IS NOT OLD.forra OR NEW.giltig_fran IS NOT OLD.giltig_fran
    OR NEW.motivering IS NOT OLD.motivering OR NEW.foreslagen_av IS NOT OLD.foreslagen_av OR NEW.foreslagen IS NOT OLD.foreslagen
  BEGIN SELECT RAISE(ABORT, 'En beslutad ändring av konfigurationen ändras inte'); END;

-- Omorganisationer enligt HSA:s regler för organisationsförändringar (bilaga K6). plan och resultat är JSON. En
-- förberedd förändring genomförs av systemet den dag den gäller. En sammanslagning, delning eller nedläggning ändrar vem
-- som har åtkomst och genomförs först när en annan systemförvaltare har godkänt den (godkand_av, fyra ögon). En
-- genomförd eller avbruten förändring ändras inte.
CREATE TABLE IF NOT EXISTS omorganisationer (
  id INTEGER PRIMARY KEY, typ TEXT NOT NULL, datum TEXT NOT NULL, beskrivning TEXT NOT NULL, plan TEXT NOT NULL,
  forberedd_av TEXT NOT NULL, forberedd TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'forberedd',
  genomford TEXT, resultat TEXT, avbruten_av TEXT, avbruten TEXT, godkand_av TEXT, godkand TEXT,
  CHECK (typ IN ('ny_enhet', 'sammanslagning', 'delning', 'namnbyte', 'nedlaggning')), CHECK (status IN ('forberedd', 'genomford', 'avbruten')),
  CHECK (godkand_av IS NULL OR godkand_av <> forberedd_av),
  CHECK (status <> 'genomford' OR typ NOT IN ('sammanslagning', 'delning', 'nedlaggning') OR godkand_av IS NOT NULL)
);
CREATE TRIGGER IF NOT EXISTS omorganisation_raderas_ej BEFORE DELETE ON omorganisationer
  BEGIN SELECT RAISE(ABORT, 'En omorganisation raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS omorganisation_andras_ej BEFORE UPDATE ON omorganisationer WHEN OLD.status <> 'forberedd'
  BEGIN SELECT RAISE(ABORT, 'En genomförd eller avbruten omorganisation ändras inte'); END;

-- Allt som systemet flyttade när en omorganisation genomfördes, med värdet före och efter. Det som har hänt skrivs aldrig
-- om: bara det som pågår eller ligger framåt flyttas, och varje flytt finns kvar här.
CREATE TABLE IF NOT EXISTS omorganisation_flyttar (
  id INTEGER PRIMARY KEY, omorganisation_id INTEGER NOT NULL, kategori TEXT NOT NULL, tabell TEXT NOT NULL, rad_id TEXT NOT NULL,
  kolumn TEXT NOT NULL, fran TEXT, till TEXT, patient_id TEXT, tid TEXT NOT NULL
);
${bestaende('omorganisation_flyttar', 'En flytt vid omorganisation')}

-- En stängd vårdenhets efterföljare (sammanslagning, delning och nedläggning med mottagare).
CREATE TABLE IF NOT EXISTS enhet_efterfoljare (
  gammal_id TEXT NOT NULL, ny_id TEXT NOT NULL, fran TEXT NOT NULL, omorganisation_id INTEGER NOT NULL, PRIMARY KEY (gammal_id, ny_id)
);
${bestaende('enhet_efterfoljare', 'En efterföljare')}

-- Start- och slutdatum per enhet som HSA (K6 2.1). En stängd vårdenhet tas aldrig bort, eftersom uppgifter, spärrar och
-- loggar pekar på den. till är den sista dagen enheten gällde.
CREATE TABLE IF NOT EXISTS enhet_perioder (
  enhet_id TEXT PRIMARY KEY, fran TEXT, till TEXT, arkiverad INTEGER NOT NULL DEFAULT 0, omorganisation_id INTEGER
);

-- Tidigare namn på en enhet vid namnbyte. Namnet gällde till dagen före till.
CREATE TABLE IF NOT EXISTS enhetsnamn (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, namn TEXT NOT NULL, till TEXT NOT NULL, omorganisation_id INTEGER NOT NULL
);
${bestaende('enhetsnamn', 'Ett tidigare namn')}

-- Mätningar av lagringen och provåterläsningarna (KD1.1.3.5 och KD1.1.3.6). resultat är JSON utan patientuppgifter.
CREATE TABLE IF NOT EXISTS lagringsmatningar (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, byte INTEGER NOT NULL, rader INTEGER NOT NULL, tabeller INTEGER NOT NULL,
  aterlasning TEXT NOT NULL, resultat TEXT NOT NULL, av TEXT, CHECK (aterlasning IN ('godkand', 'underkand'))
);
${bestaende('lagringsmatningar', 'En mätning av lagringen')}
`;

const datumI = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

// Tabellerna, personalen och seeden. Seeden lägger in en ändring som den andra systemförvaltaren har föreslagit och som
// väntar på godkännande, så att fyra ögon syns i demon. Den ändrar inget förrän någon godkänner den.
export function sakraSystemforvaltning(db, bas = new Date()) {
  db.exec(SCHEMA_SYSTEMFORVALTNING);
  const insP = db.query('INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
  PERSONAL.forEach((p, i) => {
    if (p.r7) insP.run(p.id, p.namn, p.yrke, p.titel ?? null, p.enhet, `SE2321000164-VKP${String(i + 1).padStart(3, '0')}`, p.demo ? 1 : 0);
  });
  if (!db.query('SELECT 1 FROM konfig_andringar LIMIT 1').get()) {
    db.query(`INSERT INTO konfig_andringar (slag, nyckel, varde, forra, giltig_fran, motivering, foreslagen_av, foreslagen)
      VALUES ('parameter', 'remiss.mottagningskvittens_timmar', '4', '2', ?, ?, 'sysf-2', ?)`)
      .run(datumI(bas), 'Mottagningarna kvitterar inkomna remisser två gånger per dag. Med två timmar larmar systemet i onödan mitt på dagen.', new Date(bas.getTime() - 3600_000).toISOString());
  }
}
