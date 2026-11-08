// Runda 7, r2: tabellerna för nyhetsrutan (Sussa 10.1.1.4), intygen från övningarna i utbildningsmiljön, övningarnas
// versioner och utbildarintygen (Sussa 10.1.1.5), och seedens intyg. Modulen beror inte på db.js, så att db.js kan använda den både när mallen byggs och när
// en äldre sandlåda läses in. Allt är IF NOT EXISTS.

import { OVNINGAR_V1 } from './seed/ovningar.js';

const DAG = 86400_000;

export const SCHEMA_UTBILDNING = `
-- Nyheter som en användare har stängt, per version. anvandare är personal:<id> eller invanare:<id>.
CREATE TABLE IF NOT EXISTS nyheter_stangda (
  anvandare TEXT NOT NULL, version TEXT NOT NULL, tid TEXT NOT NULL, PRIMARY KEY (anvandare, version)
);

-- Intyg från övningarna. Ett intyg ändras och raderas aldrig: ett nytt intyg ersätter det förra från sitt datum.
-- vardenhet är vårdenheten där personen arbetade när intyget utfärdades, och roll är yrket som övningarna gällde.
CREATE TABLE IF NOT EXISTS utbildningsintyg (
  id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, vardenhet TEXT NOT NULL, roll TEXT NOT NULL, kurs TEXT NOT NULL,
  utfardat TEXT NOT NULL, giltigt_till TEXT NOT NULL, antal_ovningar INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  CHECK (giltigt_till > utfardat)
);
CREATE INDEX IF NOT EXISTS ix_intyg_personal ON utbildningsintyg (personal_id);
CREATE TRIGGER IF NOT EXISTS utbildningsintyg_raderas_ej BEFORE DELETE ON utbildningsintyg
  BEGIN SELECT RAISE(ABORT, 'Ett intyg raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS utbildningsintyg_andras_ej BEFORE UPDATE ON utbildningsintyg
  BEGIN SELECT RAISE(ABORT, 'Ett intyg ändras inte'); END;

-- Övningarna med versioner. innehall är JSON med alla övningar i versionen. En version ändras och raderas aldrig.
CREATE TABLE IF NOT EXISTS ovningsversioner (
  id INTEGER PRIMARY KEY, version INTEGER NOT NULL UNIQUE, innehall TEXT NOT NULL, andring TEXT NOT NULL, av TEXT, tid TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS ovningsversioner_raderas_ej BEFORE DELETE ON ovningsversioner
  BEGIN SELECT RAISE(ABORT, 'En version av övningarna raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ovningsversioner_andras_ej BEFORE UPDATE ON ovningsversioner
  BEGIN SELECT RAISE(ABORT, 'En version av övningarna ändras inte'); END;

-- Utbildarintyg, utfärdade av vårdenhetens verksamhetschef. Den som har ett giltigt utbildarintyg ändrar övningarna.
CREATE TABLE IF NOT EXISTS utbildarintyg (
  id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, vardenhet TEXT NOT NULL, utfardat_av TEXT NOT NULL, utfardat TEXT NOT NULL,
  giltigt_till TEXT NOT NULL, CHECK (giltigt_till > utfardat)
);
CREATE TRIGGER IF NOT EXISTS utbildarintyg_raderas_ej BEFORE DELETE ON utbildarintyg
  BEGIN SELECT RAISE(ABORT, 'Ett utbildarintyg raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS utbildarintyg_andras_ej BEFORE UPDATE ON utbildarintyg
  BEGIN SELECT RAISE(ABORT, 'Ett utbildarintyg ändras inte'); END;
`;

// Seedens intyg på Kardiologiska kliniken, så att verksamhetschefen ser alla lägen: giltigt, går snart ut, har gått ut
// och saknas. Sara Lindqvist (lak-kard) och Amira Haddad (usk-kard) har inget intyg, så att den som provar demon själv kan
// göra övningarna. Dagarna är räknade från när sandlådan skapas.
export const SEED_INTYG = [
  { personal: 'ssk-kard', roll: 'sjukskoterska', utfardat: -100 },
  { personal: 'adm-kard', roll: 'vardadministrator', utfardat: -350 },
  { personal: 'ol-kard', roll: 'lakare', utfardat: -420 },
  { personal: 'far-kard', roll: 'farmaceut', utfardat: -30 },
];
export const KURS = 'Grundkurs i Vårdkällan';
export const GILTIG_DAGAR = 365;

const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));

// Lägger till tabellerna. Ger true när intygstabellen inte fanns, så att seeden läggs in en gång.
export function sakraUtbildning(db) {
  const fanns = harTabell(db, 'utbildningsintyg');
  db.exec(SCHEMA_UTBILDNING);
  return !fanns;
}

export function seedaUtbildning(db, bas = new Date()) {
  // Samma regel som vardenhetFor i atkomst.js: en arbetsplats hör till enheten ovanför.
  const vardenhet = (enhet) => {
    let id = enhet;
    for (let i = 0; i < 6 && id; i++) {
      const e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(id);
      if (!e) return enhet;
      if (e.typ !== 'arbetsplats') return e.id;
      id = e.forald_id;
    }
    return enhet;
  };
  const ins = db.query('INSERT INTO utbildningsintyg (personal_id, vardenhet, roll, kurs, utfardat, giltigt_till, antal_ovningar) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const s of SEED_INTYG) {
    const p = db.query('SELECT enhet_id FROM personal WHERE id = ?').get(s.personal);
    if (!p) continue;
    const fran = new Date(bas.getTime() + s.utfardat * DAG);
    const till = new Date(fran.getTime() + GILTIG_DAGAR * DAG);
    ins.run(s.personal, vardenhet(p.enhet_id), s.roll, KURS, fran.toISOString(), till.toISOString(), 0);
  }
  // Övningarna i version 1, och Johan Ek (ssk-kard) som utbildare på Kardiologiska kliniken, utsedd av verksamhetschefen.
  db.query('INSERT INTO ovningsversioner (version, innehall, andring, av, tid) VALUES (1, ?, ?, NULL, ?)')
    .run(JSON.stringify(OVNINGAR_V1), 'Första versionen av övningarna.', new Date(bas.getTime() - 120 * DAG).toISOString());
  if (db.query("SELECT 1 FROM personal WHERE id = 'ssk-kard'").get()) {
    const fran = new Date(bas.getTime() - 90 * DAG);
    db.query('INSERT INTO utbildarintyg (personal_id, vardenhet, utfardat_av, utfardat, giltigt_till) VALUES (?, ?, ?, ?, ?)')
      .run('ssk-kard', vardenhet('uso-kard-72'), 'vch-kard', fran.toISOString(), new Date(fran.getTime() + GILTIG_DAGAR * DAG).toISOString());
  }
}
