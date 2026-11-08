// Klassningen av ett mätvärde efter källan (runda 9, r2, Sussa 3.6.1.6 och 3.6.1.7). Värden från medicinteknisk
// utrustning och patientens egna mätningar är referensvärden tills en behörig person har godkänt dem för diagnostiskt
// bruk (medicinteknik.js). Bara kvalitetssäkrade värden räknas i NEWS2, larm och beslutsstöd. Modulen har inga importer,
// så att journal.js och vitalparametrar.js kan läsa den utan att importera resten av medicintekniken.

export const OBEDOMDA_KALLOR = new Set(['utrustning', 'patient']);
// Ett värde är kvalitetssäkrat när det är registrerat av vården, eller när det kommer från utrustning eller patienten och
// är godkänt (matvarden.vidimerad sätts när värdet godkänns).
export const kvalitetssakrad = (m) => !OBEDOMDA_KALLOR.has(m.kalla) || m.vidimerad != null;
export const KLASSTEXT = {
  diagnostisk: 'Godkänt för diagnostiskt bruk', referens: 'Referens, inte godkänt för diagnostiskt bruk',
  egen: 'Patientens egen mätning, inte kvalitetssäkrad', egen_godkand: 'Patientens egen mätning, bedömd och godkänd', egen_referens: 'Patientens egen mätning, bedömd som referens',
};
const TYPER = { monitor: 'Patientmonitor', pump: 'Infusionspump' };
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);

// Klassen och utrustningen för ett mätvärde, eller null för ett vanligt värde. Läser bara raden och dess kopplingar.
export function klassFor(db, m) {
  if (!OBEDOMDA_KALLOR.has(m.kalla) || !harTabell(db, 'matvarde_bedomningar')) return null;
  const b = db.query('SELECT * FROM matvarde_bedomningar WHERE matvarde_id = ?').get(m.id);
  const bedomd = b ? { beslut: b.beslut, tid: b.tid, av: personNamn(db, b.av) } : null;
  if (m.kalla === 'patient') {
    const klass = !b ? 'egen' : b.beslut === 'godkand' ? 'egen_godkand' : 'egen_referens';
    return { klass, klassText: KLASSTEXT[klass], kalla: 'patient', kallaText: 'Patientens egen mätning', kvalitetssakrad: klass === 'egen_godkand', bedomd };
  }
  const v = db.query('SELECT * FROM mt_varden WHERE matvarde_id = ?').get(m.id);
  const u = v ? db.query('SELECT * FROM mt_utrustning WHERE id = ?').get(v.utrustning_id) : null;
  const klass = b?.beslut === 'godkand' ? 'diagnostisk' : 'referens';
  return {
    klass, klassText: KLASSTEXT[klass], kalla: 'utrustning', kallaText: u ? `${TYPER[u.typ]} ${u.serienummer}` : 'Medicinteknisk utrustning',
    utrustning: u ? { id: u.id, typ: u.typ, typText: TYPER[u.typ], modell: u.modell, serienummer: u.serienummer, simulerad: Boolean(u.simulerad) } : null,
    kvalitetssakrad: klass === 'diagnostisk', bedomd,
  };
}
