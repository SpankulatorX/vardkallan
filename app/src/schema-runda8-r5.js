// Runda 8, r5: tabellerna för tobaksvanorna (tobak.js) och vårdenheternas egna övningar (utbildning.js), och seedens
// egna övningar på Kardiologiska kliniken. Allt är IF NOT EXISTS, så att en äldre sandlåda får tabellerna när den läses
// in. Modulen beror inte på db.js.
export const SCHEMA_TOBAK = `
-- Svaren i en anteckning av typen Tobaksvanor, en rad per version av anteckningen. svar är JSON (tobak-regler.js),
-- forslag den KVÅ-kod som systemet föreslog och alder patientens ålder när svaren sparades. En rad ändras bara medan
-- anteckningen är ett utkast och raderas aldrig.
CREATE TABLE IF NOT EXISTS tobaksvanor (
  anteckning_id INTEGER PRIMARY KEY, svar TEXT NOT NULL, forslag TEXT, alder INTEGER, sparad TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS tobaksvanor_raderas_ej BEFORE DELETE ON tobaksvanor
  BEGIN SELECT RAISE(ABORT, 'Svaren om tobaksvanor raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS tobaksvanor_andras_ej BEFORE UPDATE ON tobaksvanor
  WHEN (SELECT status FROM anteckningar WHERE id = OLD.anteckning_id) = 'signerad'
  BEGIN SELECT RAISE(ABORT, 'Svaren i en signerad anteckning ändras inte'); END;
`;


export const SCHEMA_ENHETSOVNINGAR = `
-- Vårdenhetens egna övningar, utöver vårdgivarens (ovningsversioner). innehall är JSON med alla egna övningar i
-- versionen. En version ändras och raderas aldrig, och historiken är per vårdenhet.
CREATE TABLE IF NOT EXISTS enhetsovningar (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, version INTEGER NOT NULL, innehall TEXT NOT NULL, andring TEXT NOT NULL, av TEXT,
  tid TEXT NOT NULL, UNIQUE (enhet_id, version)
);
CREATE TRIGGER IF NOT EXISTS enhetsovningar_raderas_ej BEFORE DELETE ON enhetsovningar
  BEGIN SELECT RAISE(ABORT, 'En version av vårdenhetens övningar raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS enhetsovningar_andras_ej BEFORE UPDATE ON enhetsovningar
  BEGIN SELECT RAISE(ABORT, 'En version av vårdenhetens övningar ändras inte'); END;
`;

// Kardiologiska klinikens egna övningar i första versionen. Alternativ b är rätt, som i vårdgivarens övningar.
export const SEED_ENHETSOVNINGAR = {
  enhet: 'uso-kard', av: 'vch-kard', andring: 'Kardiologiska klinikens första egna övning.',
  ovningar: [{
    id: 'tobak-hjarta', roller: ['sjukskoterska', 'fysioterapeut'],
    fraga: 'På Kardiologiska kliniken dokumenteras tobaksvanorna för varje patient med hjärtsjukdom. Hur gör du i Vårdkällan?',
    alternativ: [
      { id: 'a', text: 'Skriver det med egna ord under sökordet Aktuellt i en daganteckning.' },
      { id: 'b', text: 'Väljer Dokumentera tobaksvanor i översikten och svarar på frågorna. Systemet föreslår stödet och KVÅ-koden.' },
      { id: 'c', text: 'Tobaksvanor dokumenteras inte i journalen.' },
    ],
    ratt: 'b',
    forklaring: 'Mallen för tobaksvanor har fasta svarsalternativ enligt den nationella vägledningen. Systemet räknar ut vilket stöd Socialstyrelsens riktlinjer rekommenderar och sätter KVÅ-koden när samtalet har hållits.',
    prova: '#/patient/p01',
  }],
};

const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));

// Lägger till tabellerna. Seedens egna övningar läggs in en gång, när tabellen inte fanns.
export function sakraR5(db, bas = new Date()) {
  const fanns = harTabell(db, 'enhetsovningar');
  db.exec(SCHEMA_TOBAK);
  db.exec(SCHEMA_ENHETSOVNINGAR);
  if (fanns || !db.query('SELECT 1 FROM enheter WHERE id = ?').get(SEED_ENHETSOVNINGAR.enhet)) return;
  const s = SEED_ENHETSOVNINGAR;
  db.query('INSERT INTO enhetsovningar (enhet_id, version, innehall, andring, av, tid) VALUES (?, 1, ?, ?, ?, ?)')
    .run(s.enhet, JSON.stringify(s.ovningar), s.andring, db.query('SELECT 1 FROM personal WHERE id = ?').get(s.av) ? s.av : null, new Date(bas.getTime() - 30 * 86400_000).toISOString());
}
