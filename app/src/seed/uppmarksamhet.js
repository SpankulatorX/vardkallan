// Uppmärksamhetsinformation (Sussa 3.1.5): tabellen och seeden. Påhittade uppgifter för de påhittade patienterna.
//
// En rad är antingen bekräftad uppmärksamhetsinformation (status aktiv, senare avslutad) eller ett förslag som en läkare
// har avfärdat (status avfard), så att samma förslag inte kommer tillbaka. Raderna raderas aldrig. För en överkänslighet
// finns uppgiften redan i tabellen overkanslighet, och raden här bär bara den bekräftade graden (kalla_typ
// overkanslighet), så att överkänsligheten inte registreras två gånger.
export const SCHEMA_UPPMARKSAMHET = `
CREATE TABLE IF NOT EXISTS uppmarksamhet (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  kategori TEXT NOT NULL, undergrupp TEXT NOT NULL, term TEXT NOT NULL, motivering TEXT,
  kodsystem TEXT, kod TEXT, grad TEXT, kalla_typ TEXT, kalla_id INTEGER, regel TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv', registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL,
  avslutad TEXT, avslutad_av TEXT, avslutad_orsak TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (kategori IN ('medicinskt', 'smitta', 'overkanslighet', 'vardrutin')),
  CHECK (status IN ('aktiv', 'avslutad', 'avfard')),
  CHECK (grad IS NULL OR grad IN ('livshotande', 'skadlig', 'besvarande')),
  CHECK (status <> 'avslutad' OR length(trim(avslutad_orsak)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_um_patient ON uppmarksamhet (patient_id);
CREATE TRIGGER IF NOT EXISTS uppmarksamhet_raderas_ej BEFORE DELETE ON uppmarksamhet
  BEGIN SELECT RAISE(ABORT, 'Uppmärksamhetsinformation raderas inte, den avslutas'); END;
`;

// dagar är relativt till dagen då sandlådan skapas. En överkänslighet får sitt datum från överkänsligheten.
const SEED = [
  { patient: 'p01', overkanslighet: 'Penicilliner', grad: 'skadlig', av: 'lak-vas', kalla: 'migrerad:VAS' },
  { patient: 'p09', overkanslighet: 'Jordnöt', grad: 'livshotande', av: 'lak-vc' },
  { patient: 'p10', regel: 'antikoagulantia', lakemedel: 'VK-NPL-0002', enhet: 'vc-tybble', av: 'lak-vc', dagar: -1490, kategori: 'medicinskt', undergrupp: 'behandling',
    term: 'Antikoagulantiabehandling', motivering: 'Ökad blödningsrisk. Behandlingen behöver beaktas före operation, punktion, injektion och trombolys.' },
  { patient: 'p08', regel: 'smitta-barare', diagnos: 'Z22.3', enhet: 'uso-inf', av: 'lak-inf', dagar: -1, kategori: 'smitta', undergrupp: 'smittamne',
    term: 'Bärare av MRSA', motivering: 'Särskilda hygienrutiner och smittskyddsåtgärder vid vård och provtagning.' },
  { patient: 'p03', enhet: 'vc-tybble', av: 'lak-vc', dagar: -400, kategori: 'vardrutin', undergrupp: 'information', term: 'Avböjer blodtransfusion',
    motivering: 'Patienten har sagt att hon inte vill få blod eller blodprodukter. Planera blodsparande åtgärder och fråga patienten igen vid behov.' },
];

// Lägger in seeden. datum(n) ger ISO-tid n dagar från sandlådans dag, och datumTid(d) gör ett datum till en tid.
export function seedaUppmarksamhet(db, { datum, datumTid }) {
  const ins = db.query(`INSERT INTO uppmarksamhet (patient_id, enhet_id, kategori, undergrupp, term, motivering, kodsystem, kod, grad, kalla_typ, kalla_id, regel,
    status, registrerad, registrerad_av, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, ?)`);
  for (const s of SEED) {
    if (s.overkanslighet) {
      const o = db.query('SELECT * FROM overkanslighet WHERE patient_id = ? AND amne = ?').get(s.patient, s.overkanslighet);
      if (!o) continue;
      ins.run(s.patient, o.enhet_id, 'overkanslighet', o.atc ? 'aktiv_substans' : 'ovrigt', o.amne, o.reaktion, o.atc ? 'atc' : null, o.atc,
        s.grad, 'overkanslighet', o.id, 'overkanslighet-grad', datumTid(o.datum), s.av, s.kalla ?? o.kalla);
      continue;
    }
    let kalla = [null, null, null, null];
    if (s.lakemedel) {
      const o = db.query('SELECT o.id, k.atc FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND o.lakemedel_id = ?').get(s.patient, s.lakemedel);
      if (o) kalla = ['atc', o.atc, 'ordination', o.id];
    } else if (s.diagnos) {
      const d = db.query('SELECT id, kod FROM diagnoser WHERE patient_id = ? AND kod = ?').get(s.patient, s.diagnos);
      if (d) kalla = ['icd10se', d.kod, 'diagnos', d.id];
    }
    ins.run(s.patient, s.enhet, s.kategori, s.undergrupp, s.term, s.motivering, kalla[0], kalla[1], null, kalla[2], kalla[3], s.regel ?? null,
      datum(s.dagar), s.av, 'vardkallan');
  }
}
