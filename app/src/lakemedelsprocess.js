// Läkemedelsprocessen i databasen (Sussa 3.5.1, 3.5.2 och 3.5.3): schemat för iordningsställande, administrering och
// överlämnande, vidimering, läkemedelsgenomgång, ordinationernas tillägg (administrationssätt, fördefinierad mall och
// planerad vårdhändelse) och vätskebalans, och seedens givna doser. Modulen beror inte på db.js, så att db.js kan
// använda den både när mallen byggs och när en äldre sandlåda läses in.

// administreringar: en rad per dos. status är iordningstalld, given, overlamnad (till patienten, till exempel för
// permission) eller ej_given. planerad är dostiden i ordinationen (null för vid behov och för en dos utan ordination).
// tid är när dosen gavs, lämnades över eller inte gavs, och utford_av den som gjorde det. registrerad och registrerad_av
// är när och av vem det skrevs in, så att registrering i efterhand syns. En rad raderas aldrig, och när dosen är given,
// överlämnad eller inte given ändras den inte. Bara ett iordningsställande går vidare till nästa steg.
export const SCHEMA_LAKEMEDELSPROCESS = `
CREATE TABLE IF NOT EXISTS administreringar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, ordination_id INTEGER, lakemedel_id TEXT NOT NULL,
  planerad TEXT, status TEXT NOT NULL, dos REAL, dos_enhet TEXT, antal REAL, tid TEXT, utford_av TEXT,
  registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, efterhand INTEGER NOT NULL DEFAULT 0,
  iordningstalld_tid TEXT, iordningstalld_av TEXT, kontrollkod TEXT, orsak TEXT, kvitterade_varningar TEXT,
  permission INTEGER NOT NULL DEFAULT 0, volym_ml REAL, vardkontakt_id INTEGER, kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (status IN ('iordningstalld', 'given', 'overlamnad', 'ej_given')),
  CHECK (status = 'iordningstalld' OR (tid IS NOT NULL AND utford_av IS NOT NULL)),
  CHECK (status <> 'ej_given' OR length(trim(coalesce(orsak, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS ix_adm_patient ON administreringar (patient_id);
CREATE TRIGGER IF NOT EXISTS administrering_raderas_ej BEFORE DELETE ON administreringar
  BEGIN SELECT RAISE(ABORT, 'Administreringar raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS administrering_andras_ej BEFORE UPDATE OF patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av, registrerad, registrerad_av, orsak, kvitterade_varningar
  ON administreringar WHEN OLD.status <> 'iordningstalld'
  BEGIN SELECT RAISE(ABORT, 'En given, överlämnad eller inte given dos ändras inte'); END;

CREATE TABLE IF NOT EXISTS vidimeringar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  ordinationer TEXT NOT NULL, andringar TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TRIGGER IF NOT EXISTS vidimering_andras_ej BEFORE UPDATE ON vidimeringar
  BEGIN SELECT RAISE(ABORT, 'En vidimering ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vidimering_raderas_ej BEFORE DELETE ON vidimeringar
  BEGIN SELECT RAISE(ABORT, 'En vidimering raderas inte'); END;

CREATE TABLE IF NOT EXISTS lakemedelsgenomgangar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  fynd TEXT NOT NULL, berattelse TEXT NOT NULL, bedomning TEXT, vardtillfalle_id INTEGER, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TRIGGER IF NOT EXISTS genomgang_andras_ej BEFORE UPDATE ON lakemedelsgenomgangar
  BEGIN SELECT RAISE(ABORT, 'En läkemedelsgenomgång ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS genomgang_raderas_ej BEFORE DELETE ON lakemedelsgenomgangar
  BEGIN SELECT RAISE(ABORT, 'En läkemedelsgenomgång raderas inte'); END;

CREATE TABLE IF NOT EXISTS ordination_tillagg (
  ordination_id INTEGER PRIMARY KEY, administrationssatt TEXT, mall TEXT, volym_ml REAL, vatskebalans INTEGER NOT NULL DEFAULT 0,
  vardhandelse TEXT, forskjutning_min INTEGER, handelse_tid TEXT, handelse_satt_av TEXT, handelse_satt TEXT
);

CREATE TABLE IF NOT EXISTS vatskebalans (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, riktning TEXT NOT NULL, typ TEXT NOT NULL,
  volym_ml REAL NOT NULL, tid TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, administrering_id INTEGER,
  vardkontakt_id INTEGER, kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (riktning IN ('in', 'ut')), CHECK (volym_ml > 0)
);
CREATE INDEX IF NOT EXISTS ix_vb_patient ON vatskebalans (patient_id);
CREATE TRIGGER IF NOT EXISTS vatskebalans_raderas_ej BEFORE DELETE ON vatskebalans
  BEGIN SELECT RAISE(ABORT, 'Vätskebalansen raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS vatskebalans_andras_ej BEFORE UPDATE OF patient_id, enhet_id, riktning, typ, volym_ml, tid ON vatskebalans
  BEGIN SELECT RAISE(ABORT, 'Vätskebalansen ändras inte'); END;
`;

export function sakraSchema(db) {
  db.exec(SCHEMA_LAKEMEDELSPROCESS);
}

// Svensk lokaltid till ISO i UTC, samma räkning som i db.js.
const TZ = 'Europe/Stockholm';
const forskjutning = (ms) => Date.parse(new Date(ms).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + 'Z') - ms;
export function lokalTid(datum, klocka) {
  const [y, m, d] = datum.split('-').map(Number);
  const [h, mi] = klocka.split(':').map(Number);
  const g = Date.UTC(y, m - 1, d, h, mi);
  return new Date(g - forskjutning(g - forskjutning(g))).toISOString();
}
export const datumI = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: TZ });
export const addDag = (datum, n) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// "08" eller "8:30" till "08:00" och "08:30".
export function klocka(t) {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(t).trim());
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
}

// Seedens givna doser: för varje inneliggande patient med en sjuksköterska på vårdenheten är de schemalagda doserna
// sedan inskrivningen (högst två dygn bakåt) givna fem minuter efter dostiden, fram till en timme före sandlådans
// tid. En vid behovsdos är given 14 timmar före sandlådans tid. Ordinationer från en vårdenhet som patienten har spärrat tas inte med.
export function seedaAdministreringar(db, bas = new Date()) {
  const basMs = bas.getTime();
  const sjukskoterska = (ve) => db.query("SELECT p.id FROM personal p JOIN enheter e ON e.id = p.enhet_id WHERE p.yrke = 'sjukskoterska' AND (e.id = ? OR e.forald_id = ?) ORDER BY p.demo DESC, p.id").get(ve, ve)?.id;
  const vardenhet = (id) => { const e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(id); return e?.typ === 'arbetsplats' ? e.forald_id : id; };
  const ins = db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av,
    registrerad, registrerad_av, vardkontakt_id) VALUES (?, ?, ?, ?, ?, 'given', ?, ?, ?, ?, ?, ?, ?, ?)`);
  const kontakter = db.query("SELECT * FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL AND vardtillfalle_id IS NOT NULL").all();
  for (const v of kontakter) {
    const ssk = sjukskoterska(vardenhet(v.enhet_id));
    if (!ssk) continue;
    const inskriven = Date.parse(db.query('SELECT inskriven FROM vardtillfallen WHERE id = ?').get(v.vardtillfalle_id)?.inskriven ?? v.start);
    const fran = Math.max(inskriven, basMs - 2 * 86400_000);
    const sparrade = db.query('SELECT enhet_id FROM sparrar WHERE patient_id = ? AND aktiv = 1').all(v.patient_id).map(r => vardenhet(r.enhet_id));
    const ordinationer = db.query("SELECT * FROM ordinationer WHERE patient_id = ? AND status = 'aktiv' ORDER BY id").all(v.patient_id)
      .filter(o => !sparrade.includes(vardenhet(o.enhet_id)) && (!o.slut || o.slut >= datumI(basMs)));
    for (const o of ordinationer) {
      const tider = (o.tider ? JSON.parse(o.tider) : []).map(klocka).filter(Boolean);
      const plus = (iso, min) => new Date(Date.parse(iso) + min * 60_000).toISOString();
      // Runda 13, r4: en ordination utan fasta tider vars dosering säger klockslaget (Waran enligt doseringsschema) har
      // fått de senaste dagarnas doser på det klockslaget. Dagens dos ges av sjuksköterskan.
      const utanTiderKlocka = !o.vid_behov && !tider.length && String(o.dosering ?? '').match(/klockan (\d{1,2})\b/);
      if (utanTiderKlocka) {
        for (const d of [-2, -1]) {
          const t = lokalTid(addDag(datumI(basMs), d), `${utanTiderKlocka[1].padStart(2, '0')}:05`);
          if (Date.parse(t) < fran || Date.parse(t) < Date.parse(o.skapad)) continue;
          ins.run(o.patient_id, v.enhet_id, o.id, o.lakemedel_id, null, o.dos, o.dos_enhet, 1, t, ssk, new Date(Date.parse(t) + 60_000).toISOString(), ssk, v.id);
        }
        continue;
      }
      if (o.vid_behov) {
        const t = new Date(Math.floor((basMs - 14 * 3600_000) / 300_000) * 300_000).toISOString();
        if (Date.parse(t) > Date.parse(o.skapad) && Date.parse(t) < basMs) ins.run(o.patient_id, v.enhet_id, o.id, o.lakemedel_id, null, o.dos, o.dos_enhet, 1, t, ssk, plus(t, 2), ssk, v.id);
        continue;
      }
      for (let d = -2; d <= 0; d++) {
        const dag = addDag(datumI(basMs), d);
        for (const k of tider) {
          const slot = lokalTid(dag, k);
          const ms = Date.parse(slot);
          if (ms < fran || ms < Date.parse(o.skapad) || ms > basMs - 3600_000 || dag < o.start) continue;
          const t = plus(slot, 5);
          ins.run(o.patient_id, v.enhet_id, o.id, o.lakemedel_id, slot, o.dos, o.dos_enhet, 1, t, ssk, plus(t, 1), ssk, v.id);
        }
      }
    }
  }
}

// Seedens vidimering: läkaren på kardiologen vidimerade patient 1:s läkemedelslista en kvart efter inskrivningen,
// före dosökningarna. Därför finns det ändringar att vidimera i demon.
export function seedaVidimeringar(db) {
  const vt = db.query("SELECT * FROM vardtillfallen WHERE patient_id = 'p01' AND utskriven IS NULL").get();
  if (!vt) return;
  const t = new Date(Date.parse(vt.inskriven) + 15 * 60_000).toISOString();
  const ms = Date.parse(t);
  const aktiva = db.query("SELECT * FROM ordinationer WHERE patient_id = 'p01' ORDER BY id").all()
    .filter(o => Date.parse(o.skapad) <= ms && (o.status !== 'utsatt' || Date.parse(o.utsatt_tid) > ms) && (!o.slut || o.slut >= t.slice(0, 10)));
  db.query("INSERT INTO vidimeringar (patient_id, enhet_id, tid, av, ordinationer, andringar) VALUES ('p01', 'uso-kard', ?, 'lak-kard', ?, ?)")
    .run(t, JSON.stringify(aktiva.map(o => ({ id: o.id, dosering: o.dosering, status: 'aktiv' }))), JSON.stringify({ nya: aktiva.map(o => o.id), utsatta: [] }));
}
