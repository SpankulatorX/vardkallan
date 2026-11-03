// Säkrare läkemedelshantering (runda 5): delegering av iordningställande, administrering och överlämnande av läkemedel
// (HSLF-FS 2017:37 9 kap.) och planen som sparas när antikoagulantia sätts ut. Schemat och seeden ligger här, utan
// beroende till db.js, så att db.js kan använda modulen både när mallen byggs och när en äldre sandlåda läses in.
// Logiken finns i delegering.js och lakemedel.js.

// delegeringar: ett delegeringsbeslut per rad. Innehållet följer 9 kap. 7 §: vad som delegeras (omfattning, en JSON-lista
// med nycklar i delegering.OMFATTNING), för vilken verksamhet (vardenhet_id), vem som delegerat (utfardad_av), till vem
// (personal_id), när beslutet ska följas upp (uppfoljning), giltighetstid (fran och till) och datum då beslutet fattades
// (beslutad). Beslutet är tidsbegränsat (9 kap. 5 §) och i demon högst ett år. Ett beslut ändras och raderas aldrig: det
// kan bara återkallas (9 kap. 6 §), med vem, när och varför.
//
// utsattningsplaner: planen som läkaren bekräftade när antikoagulantia sattes ut. En rad per utsatt ordination, så att
// ordinationstabellen och NLL-överföringen är oförändrade.
export const SCHEMA_LAKEMEDELSSAKERHET = `
CREATE TABLE IF NOT EXISTS delegeringar (
  id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, vardenhet_id TEXT NOT NULL, omfattning TEXT NOT NULL,
  fran TEXT NOT NULL, till TEXT NOT NULL, uppfoljning TEXT NOT NULL, utfardad_av TEXT NOT NULL, beslutad TEXT NOT NULL,
  kunskap_kontrollerad INTEGER NOT NULL DEFAULT 1, aterkallad_tid TEXT, aterkallad_av TEXT, aterkallad_orsak TEXT,
  kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (till >= fran), CHECK (julianday(till) - julianday(fran) <= 366), CHECK (kunskap_kontrollerad = 1)
);
CREATE INDEX IF NOT EXISTS ix_delegering_personal ON delegeringar (personal_id);
CREATE TRIGGER IF NOT EXISTS delegering_raderas_ej BEFORE DELETE ON delegeringar
  BEGIN SELECT RAISE(ABORT, 'Ett delegeringsbeslut raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS delegering_andras_ej BEFORE UPDATE OF personal_id, vardenhet_id, omfattning, fran, till, uppfoljning, utfardad_av, beslutad, kunskap_kontrollerad
  ON delegeringar BEGIN SELECT RAISE(ABORT, 'Ett delegeringsbeslut ändras inte. Återkalla det och registrera ett nytt.'); END;
CREATE TRIGGER IF NOT EXISTS delegering_aterkallas_en_gang BEFORE UPDATE OF aterkallad_tid, aterkallad_av, aterkallad_orsak
  ON delegeringar WHEN OLD.aterkallad_tid IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Delegeringen är redan återkallad'); END;

CREATE TABLE IF NOT EXISTS utsattningsplaner (
  ordination_id INTEGER PRIMARY KEY, typ TEXT NOT NULL, ersatt_med TEXT, aterinsattning TEXT, registrerad TEXT NOT NULL, av TEXT NOT NULL,
  CHECK (typ IN ('byte', 'uppehall', 'avslutad')), CHECK (typ <> 'uppehall' OR aterinsattning IS NOT NULL)
);
CREATE TRIGGER IF NOT EXISTS utsattningsplan_andras_ej BEFORE UPDATE ON utsattningsplaner
  BEGIN SELECT RAISE(ABORT, 'En plan vid utsättning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS utsattningsplan_raderas_ej BEFORE DELETE ON utsattningsplaner
  BEGIN SELECT RAISE(ABORT, 'En plan vid utsättning raderas inte'); END;
`;

// Schemat, och kolumnen för delegeringen i administreringar (den dos som en undersköterska gav med delegering).
// Kolumnen ändras inte när dosen är given, överlämnad eller inte given, som resten av raden.
export function sakraLakemedelssakerhet(db) {
  db.exec(SCHEMA_LAKEMEDELSSAKERHET);
  const kolumner = db.query('PRAGMA table_info(administreringar)').all().map(k => k.name);
  if (!kolumner.length) return;
  if (!kolumner.includes('delegering_id')) db.exec('ALTER TABLE administreringar ADD COLUMN delegering_id INTEGER');
  db.exec(`CREATE TRIGGER IF NOT EXISTS administrering_delegering_andras_ej BEFORE UPDATE OF delegering_id ON administreringar
    WHEN OLD.status <> 'iordningstalld' BEGIN SELECT RAISE(ABORT, 'En given, överlämnad eller inte given dos ändras inte'); END;`);
}

const addDag = (datum, n) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const datumI = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

// Seedens delegeringar, påhittade och relativa till sandlådans datum. Amira Haddad, undersköterska på avdelning 72, har
// en delegering från sjuksköterskan Johan Ek att ge tabletter och kapslar som sväljs och insulin under huden. Den går
// ut om 25 dagar, så att påminnelsen syns i sjuksköterskans inkorg. En äldre delegering för inhalationer har gått ut.
export const SEED_DELEGERINGAR = [
  { personal: 'usk-kard', vardenhet: 'uso-kard', omfattning: ['tabletter_peroralt', 'insulin_subkutant'], fran: -340, till: 25, av: 'ssk-kard' },
  { personal: 'usk-kard', vardenhet: 'uso-kard', omfattning: ['inhalation'], fran: -720, till: -356, av: 'ssk-kard' },
];
export function seedaDelegeringar(db, bas = new Date()) {
  const idag = datumI(bas);
  const ins = db.query(`INSERT INTO delegeringar (personal_id, vardenhet_id, omfattning, fran, till, uppfoljning, utfardad_av, beslutad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const d of SEED_DELEGERINGAR) {
    const fran = addDag(idag, d.fran);
    const till = addDag(idag, d.till);
    ins.run(d.personal, d.vardenhet, JSON.stringify(d.omfattning), fran, till, till, d.av, `${fran}T08:30:00.000Z`);
  }
}
