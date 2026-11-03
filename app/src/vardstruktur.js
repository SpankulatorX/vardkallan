// Vårdkontakt, vårdtillfälle och hälsoärende i databasen (Sussa 6.1.1 och 3.1.7): schemat och knytningen av den
// historik som redan finns. Allt som dokumenteras hör till en vårdkontakt. Ett vårdtillfälle i slutenvård håller samman
// vårdkontakterna på de avdelningar patienten ligger på, och ett hälsoärende håller samman vårdkontakter över tid.
// Modulen beror inte på db.js, så att db.js kan använda den både när mallen byggs och när en äldre sandlåda läses in.

const TZ = 'Europe/Stockholm';
const datumI = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ });
const TIMME = 3600_000;

// Vårdtillfället: inskrivning och utskrivning, och vårdenheten som har det medicinska ansvaret (enhet_id). Avdelningen
// där patienten ligger (produktionsansvaret) är vårdkontaktens enhet. Händelserna (inskrivning, sängbyte, flytt,
// ändrat ansvar, permission, åter från permission och utskrivning) ändras och raderas aldrig.
export const SCHEMA_VARDSTRUKTUR = `
CREATE TABLE IF NOT EXISTS vardtillfallen (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, inskriven TEXT NOT NULL, utskriven TEXT,
  orsak TEXT, inskriven_av TEXT, utskriven_av TEXT, permission_till TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE IF NOT EXISTS vardtillfalle_handelser (
  id INTEGER PRIMARY KEY, vardtillfalle_id INTEGER NOT NULL, typ TEXT NOT NULL, tid TEXT NOT NULL, enhet_id TEXT,
  plats TEXT, av TEXT, detalj TEXT,
  CHECK (typ IN ('inskrivning', 'sangbyte', 'flytt', 'ansvar', 'permission', 'ater', 'utskrivning'))
);
CREATE TRIGGER IF NOT EXISTS vt_handelse_andras_ej BEFORE UPDATE ON vardtillfalle_handelser
  BEGIN SELECT RAISE(ABORT, 'Händelser i ett vårdtillfälle ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vt_handelse_raderas_ej BEFORE DELETE ON vardtillfalle_handelser
  BEGIN SELECT RAISE(ABORT, 'Händelser i ett vårdtillfälle raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS vardtillfalle_raderas_ej BEFORE DELETE ON vardtillfallen
  BEGIN SELECT RAISE(ABORT, 'Vårdtillfällen raderas inte'); END;
CREATE TABLE IF NOT EXISTS halsoarenden (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, rubrik TEXT NOT NULL, kod TEXT,
  grund TEXT, skapad TEXT NOT NULL, skapad_av TEXT, status TEXT NOT NULL DEFAULT 'aktivt', kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE IF NOT EXISTS halsoarende_avvisningar (
  patient_id TEXT NOT NULL, nyckel TEXT NOT NULL, personal_id TEXT, tid TEXT NOT NULL, PRIMARY KEY (patient_id, nyckel)
);
CREATE INDEX IF NOT EXISTS ix_vk_patient ON vardkontakter (patient_id);
`;

// Kolumner som vårdkontakten har fått. kontaktsatt: besok, telefon, video eller hembesok (null i slutenvård).
// ankomst är den faktiska tiden när patienten kom till en planerad kontakt. automatisk betyder att systemet skapade
// kontakten när någon dokumenterade, eller när historik utan vårdkontakt fördes över.
const VK_KOLUMNER = [
  ['kontaktsatt', 'TEXT'], ['planerad', 'INTEGER NOT NULL DEFAULT 0'], ['ankomst', 'TEXT'], ['vardtillfalle_id', 'INTEGER'],
  ['halsoarende_id', 'INTEGER'], ['foregaende_id', 'INTEGER'], ['remiss_id', 'INTEGER'], ['skapad', 'TEXT'], ['skapad_av', 'TEXT'],
  ['automatisk', 'INTEGER NOT NULL DEFAULT 0'], ['andrad', 'TEXT'], ['andrad_av', 'TEXT'],
];
const MED_VARDKONTAKT = ['matvarden', 'ordinationer', 'remisser'];

// Lägger till det som saknas. Returnerar true om något saknades, alltså om historiken behöver knytas.
export function utokaSchema(db) {
  const kolumner = (t) => db.query(`PRAGMA table_info(${t})`).all().map(k => k.name);
  let saknades = false;
  const vk = kolumner('vardkontakter');
  for (const [namn, typ] of VK_KOLUMNER) if (!vk.includes(namn)) { db.exec(`ALTER TABLE vardkontakter ADD COLUMN ${namn} ${typ}`); saknades = true; }
  for (const t of MED_VARDKONTAKT) if (!kolumner(t).includes('vardkontakt_id')) { db.exec(`ALTER TABLE ${t} ADD COLUMN vardkontakt_id INTEGER`); saknades = true; }
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardtillfallen'").get()) saknades = true;
  db.exec(SCHEMA_VARDSTRUKTUR);
  return saknades;
}

const LABB = new Set(['crp', 'egfr', 'kreatinin', 'hba1c', 'inr', 'ntprobnp', 'hb', 'glukos', 'kalium', 'troponin', 'tsh']);

// Knyter all befintlig information till vårdkontakter. Används när mallen byggs och när en sandlåda från en äldre
// version läses in. bas är tidpunkten då sandlådan skapades; tid tolkar seedens relativa tider (bara när mallen byggs).
//   1. Varje slutenvårdskontakt blir ett vårdtillfälle med inskrivning och, om den är avslutad, utskrivning. Ett
//      akutbesök som slutar strax före inskrivningen är den föregående kontakten (övergång mellan vårdformer).
//   2. Anteckningar, diagnoser, ordinationer, remisser och mätvärden utan vårdkontakt knyts till kontakten på samma
//      vårdenhet och från samma källa vid samma tid. Finns ingen skapas en, en per vårdenhet och dag, märkt som skapad
//      av systemet och med uppgiftens källa, så att migrerad historik förblir märkt som migrerad.
//   3. En remiss knyts till den kontakt hos mottagaren som var svaret på den.
export function knytHistorik(db, { bas = new Date(), tid = null, sangbyten = [], halsoarenden = [] } = {}) {
  const basMs = bas.getTime();
  const enheter = new Map(db.query('SELECT * FROM enheter').all().map(e => [e.id, e]));
  const vardenhet = (id) => {
    let e = enheter.get(id);
    for (let i = 0; i < 6 && e?.typ === 'arbetsplats'; i++) e = enheter.get(e.forald_id);
    return e?.id ?? id;
  };
  db.exec("UPDATE vardkontakter SET kontaktsatt = 'besok' WHERE kontaktsatt IS NULL AND typ <> 'slutenvard'");
  db.exec('UPDATE vardkontakter SET skapad = start WHERE skapad IS NULL');

  // 1. Vårdtillfällen.
  const forstaPlats = new Map();
  const byten = [];
  for (const s of sangbyten) {
    const v = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id = ? AND typ = 'slutenvard' AND slut IS NULL").get(s.patient, s.enhet);
    if (!v || !tid) continue;
    forstaPlats.set(v.id, s.fran);
    byten.push({ v, fran: s.fran, tid: tid(s.tid) });
  }
  const insVt = db.query('INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, utskriven, orsak, kalla) VALUES (?, ?, ?, ?, ?, ?)');
  const insH = db.query('INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const v of db.query("SELECT * FROM vardkontakter WHERE typ = 'slutenvard' AND vardtillfalle_id IS NULL ORDER BY start").all()) {
    const vt = Number(insVt.run(v.patient_id, vardenhet(v.enhet_id), v.start, v.slut, v.orsak, v.kalla).lastInsertRowid);
    insH.run(vt, 'inskrivning', v.start, v.enhet_id, forstaPlats.get(v.id) ?? v.plats, null, null);
    const akut = db.query(`SELECT id FROM vardkontakter WHERE patient_id = ? AND typ = 'akut' AND slut IS NOT NULL AND slut BETWEEN ? AND ? ORDER BY slut DESC`)
      .get(v.patient_id, new Date(Date.parse(v.start) - 2 * TIMME).toISOString(), new Date(Date.parse(v.start) + TIMME / 2).toISOString());
    db.query('UPDATE vardkontakter SET vardtillfalle_id = ?, foregaende_id = coalesce(foregaende_id, ?) WHERE id = ?').run(vt, akut?.id ?? null, v.id);
    for (const b of byten.filter(x => x.v.id === v.id)) insH.run(vt, 'sangbyte', b.tid, v.enhet_id, v.plats, null, `Från ${b.fran} till ${v.plats}`);
    if (v.slut) insH.run(vt, 'utskrivning', v.slut, v.enhet_id, v.plats, null, null);
  }

  // 2. Uppgifter utan vårdkontakt. Signerade anteckningar ändras aldrig, så spärren lyfts bara under knytningen.
  const kontakter = new Map();
  const forPatient = (pid) => {
    if (!kontakter.has(pid)) kontakter.set(pid, db.query('SELECT * FROM vardkontakter WHERE patient_id = ? ORDER BY start').all(pid));
    return kontakter.get(pid);
  };
  const insVk = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, kontaktsatt, skapad, automatisk)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'besok', ?, 1)`);
  const nya = new Map();
  const hitta = (pid, enhetId, t, kalla, orsak) => {
    const ve = vardenhet(enhetId);
    const kand = forPatient(pid).filter(k => vardenhet(k.enhet_id) === ve && k.kalla === kalla);
    const ms = Date.parse(t);
    const traff = kand.filter(k => Date.parse(k.start) - TIMME <= ms && ms <= (k.slut ? Date.parse(k.slut) : basMs) + TIMME)
      .sort((a, b) => (b.typ === 'slutenvard') - (a.typ === 'slutenvard') || b.start.localeCompare(a.start))[0];
    if (traff) return traff.id;
    const dag = datumI(t);
    const samma = kand.find(k => datumI(k.start) <= dag && dag <= datumI(k.slut ?? bas.toISOString()) && k.typ !== 'slutenvard');
    if (samma) return samma.id;
    const nyckel = `${pid}|${ve}|${dag}|${kalla}`;
    const finns = nya.get(nyckel);
    if (finns) {
      if (ms > Date.parse(finns.slut)) { finns.slut = new Date(ms + 15 * 60_000).toISOString(); db.query('UPDATE vardkontakter SET slut = ? WHERE id = ?').run(finns.slut, finns.id); }
      return finns.id;
    }
    const e = enheter.get(enhetId);
    const typ = ve === 'uso-akut' ? 'akut' : 'oppenvard';
    const slut = new Date(ms + 20 * 60_000).toISOString();
    const plats = e?.typ === 'arbetsplats' ? e.namn : typ === 'akut' ? 'Akutmottagningen' : 'Mottagning';
    const id = Number(insVk.run(pid, enhetId, typ, t, slut, plats, orsak, kalla, t).lastInsertRowid);
    const rad = { id, patient_id: pid, enhet_id: enhetId, typ, start: t, slut, kalla };
    nya.set(nyckel, rad);
    forPatient(pid).push(rad);
    return id;
  };
  // Datum utan klockslag (diagnoser) räknas som förmiddag samma dag.
  const pafm = (datum) => `${datum}T09:00:00.000Z`;
  const kontaktorsak = (sokord) => { try { return JSON.parse(sokord).find(s => s.sokord === 'Kontaktorsak')?.text?.replace(/\.$/, '') ?? null; } catch { return null; } };
  const trigger = db.query("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'anteckning_signerad_andras_ej'").get()?.sql;
  const knyt = db.transaction(() => {
    if (trigger) db.exec('DROP TRIGGER anteckning_signerad_andras_ej');
    const satt = new Map();
    for (const a of db.query('SELECT id, patient_id, enhet_id, skapad, kalla, typ, sokord, ersatter_id, vardkontakt_id FROM anteckningar ORDER BY id').all()) {
      if (a.vardkontakt_id) { satt.set(a.id, a.vardkontakt_id); continue; }
      const vk = (a.ersatter_id && satt.get(a.ersatter_id)) || hitta(a.patient_id, a.enhet_id, a.skapad, a.kalla, kontaktorsak(a.sokord) ?? a.typ);
      db.query('UPDATE anteckningar SET vardkontakt_id = ? WHERE id = ?').run(vk, a.id);
      satt.set(a.id, vk);
    }
    if (trigger) db.exec(trigger);
    for (const d of db.query('SELECT * FROM diagnoser WHERE vardkontakt_id IS NULL').all()) {
      db.query('UPDATE diagnoser SET vardkontakt_id = ? WHERE id = ?').run(hitta(d.patient_id, d.enhet_id, pafm(d.datum), d.kalla, d.text), d.id);
    }
    for (const o of db.query('SELECT * FROM ordinationer WHERE vardkontakt_id IS NULL').all()) {
      db.query('UPDATE ordinationer SET vardkontakt_id = ? WHERE id = ?').run(hitta(o.patient_id, o.enhet_id, o.skapad, o.kalla, 'Läkemedelsordination'), o.id);
    }
    for (const r of db.query('SELECT * FROM remisser WHERE vardkontakt_id IS NULL').all()) {
      db.query('UPDATE remisser SET vardkontakt_id = ? WHERE id = ?').run(hitta(r.patient_id, r.fran_enhet_id, r.skickad_tid, r.kalla, 'Remittering'), r.id);
    }
    for (const m of db.query('SELECT * FROM matvarden WHERE vardkontakt_id IS NULL').all()) {
      db.query('UPDATE matvarden SET vardkontakt_id = ? WHERE id = ?').run(hitta(m.patient_id, m.enhet_id, m.tid, m.kalla, LABB.has(m.typ) ? 'Provtagning' : 'Mätning'), m.id);
    }
    // 3. Kontakten hos mottagaren som var svaret på remissen: den första efter att remissen skickades och före svaret.
    for (const r of db.query("SELECT * FROM remisser WHERE NOT (status = 'bedomd' AND beslut = 'avvisad')").all()) {
      if (db.query('SELECT 1 FROM vardkontakter WHERE remiss_id = ?').get(r.id)) continue;
      const grans = new Date(Date.parse(r.besvarad_tid ?? bas.toISOString()) + 24 * TIMME).toISOString();
      const svar = forPatient(r.patient_id).filter(k => vardenhet(k.enhet_id) === r.till_enhet_id && k.start >= r.skickad_tid && k.start <= grans)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      if (svar) db.query('UPDATE vardkontakter SET remiss_id = ? WHERE id = ? AND remiss_id IS NULL').run(r.id, svar.id);
    }
    // Bekräftade hälsoärenden i seeden.
    for (const h of halsoarenden) {
      const ha = Number(db.query("INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, grund, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?)")
        .run(h.patient, h.enhet, h.rubrik, h.grund, tid ? tid(h.tid) : bas.toISOString(), h.av).lastInsertRowid);
      for (const [enhet, orsak] of h.kontakter) db.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE patient_id = ? AND enhet_id = ? AND orsak = ?').run(ha, h.patient, enhet, orsak);
    }
  });
  knyt();
}
