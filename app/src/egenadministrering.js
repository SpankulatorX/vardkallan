// Egenadministrering i slutenvården (runda 9, r1, Sussa 3.5.2.12): när patienten själv sköter en del av sin
// medicinering. Läkaren markerar ordinationen, och systemet tar då bort dess doser från sjuksköterskans lista över doser
// att ge. I stället visas de under Patienten tar själv, där sjuksköterskan kvitterar patientens intag per dostid eller
// registrerar att det inte togs, med orsak.
//
// Systemet är experten. Systemet avgör vilka ordinationer som får skötas av patienten själv (inte blodprodukter, inte
// intravenöst och inte narkotika i demons regler) och förklarar varför när det inte går. Dostiderna räknas fram ur
// ordinationen som för andra doser, och en dos som har passerat utan kvittens markeras, så att sjuksköterskan frågar
// patienten.
//
// Behörighet. Att markera kräver ordinationsrätt, som ordinationen. Att kvittera kräver handlingen ge_lakemedel med
// vårdrelation på den egna vårdenheten (administrering.kravVardande). En ordination som användaren inte får se
// behandlas som om den inte finns. Allt loggas på patienten.
import { Fel, iso } from './db.js';
import { produkttyp } from './lakemedelsstod.js';

export const DEMOREGEL_EGEN = 'Vilka läkemedel patienten får sköta själv är demoregler: inte blodprodukter, inte intravenöst och inte narkotika (opioider och bensodiazepiner).';
const NARKOTIKA = ['N02A', 'N05BA', 'N05CD'];

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

// Kan ordinationen skötas av patienten själv? Ger null eller varför inte.
export function hinder(db, lm, satt) {
  if (!lm) return 'Välj läkemedlet först.';
  if (produkttyp(db, lm.id).typ === 'blodprodukt') return `${lm.namn} är en blodprodukt och ges alltid av personalen med kontrollen vid sängen.`;
  if (satt === 'intravenost' || /infusion/i.test(lm.form ?? '')) return `${lm.namn} ges intravenöst, och det sköter personalen.`;
  if (NARKOTIKA.some(p => lm.atc?.startsWith(p))) return `${lm.namn} är narkotika, och personalen ger varje dos så att den kan räknas och kvitteras.`;
  return null;
}

// Kontrollen när ordinationen sparas. Ger { egen: true } eller null, eller kastar Fel med förklaringen.
export function forbered(db, lm, kropp, inp = {}) {
  if (!inp.egenadministrering) return null;
  const h = hinder(db, lm, kropp.administrationssatt ?? null);
  if (h) throw new Fel(400, `${h} Ordinationen kan därför inte skötas av patienten själv.`, 'ogiltig', { falt: ['egenadministrering'] });
  return { egen: true };
}
export function spara(db, ordinationId, personalId) {
  db.query('INSERT OR IGNORE INTO egenadministreringar (ordination_id, beslutad, beslutad_av) VALUES (?, ?, ?)').run(ordinationId, iso(), personalId);
}
export function egenFor(db, ordinationId) {
  const r = db.query('SELECT * FROM egenadministreringar WHERE ordination_id = ?').get(ordinationId);
  return r ? { beslutad: r.beslutad, av: personNamn(db, r.beslutad_av) } : null;
}

// Intagen för ordinationen, för listan.
export function intagFor(db, ordinationId) {
  return db.query('SELECT * FROM egenintag WHERE ordination_id = ? ORDER BY tid DESC, id DESC').all(ordinationId).map(intagUt.bind(null, db));
}
const intagUt = (db, r) => ({ id: r.id, ordinationId: r.ordination_id, planerad: r.planerad, tagen: Boolean(r.tagen), orsak: r.orsak, tid: r.tid, kvitteradAv: personNamn(db, r.kvitterad_av) });

// POST /api/patient/:id/egenintag: { ordinationId, planerad, tagen, orsak }. Sjuksköterskan kvitterar att patienten
// tog dosen, eller att den inte togs med orsak. En dostid kvitteras en gång.
export function kvittera(atk, inp = {}, { kravVardande, synligaOrdinationer, dostider, tillaggUt }) {
  const db = atk.db;
  const o = synligaOrdinationer(atk).find(x => x.id === Number(inp.ordinationId));
  if (!o || !egenFor(db, o.id)) throw new Fel(404, 'Ordinationen finns inte bland det som patienten sköter själv.', 'saknas');
  kravVardande(atk, 'ge_lakemedel', { enhet_id: o.enhet_id, gemensam: true }, `egenintag:${o.id}`);
  const tagen = inp.tagen !== false;
  const orsak = typeof inp.orsak === 'string' ? inp.orsak.trim().slice(0, 300) : '';
  if (!tagen && orsak.length < 3) throw new Fel(400, 'Ange varför patienten inte tog dosen, med minst tre tecken.', 'ogiltig', { falt: ['orsak'] });
  let planerad = null;
  if (inp.planerad != null) {
    const ms = Date.parse(inp.planerad);
    const dag = new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    if (!Number.isFinite(ms) || !dostider(o, dag, tillaggUt(db, o.id)).some(t => Date.parse(t) === ms)) throw new Fel(400, 'Dostiden finns inte i ordinationen.', 'ogiltig', { falt: ['planerad'] });
    planerad = new Date(ms).toISOString();
    if (db.query('SELECT 1 FROM egenintag WHERE ordination_id = ? AND planerad = ?').get(o.id, planerad)) throw new Fel(400, 'Intaget för den dostiden är redan kvitterat.', 'ogiltig');
  } else if (!o.vid_behov) throw new Fel(400, 'Välj dostiden som kvitteras.', 'ogiltig', { falt: ['planerad'] });
  const nu = iso();
  const r = db.query('INSERT INTO egenintag (patient_id, enhet_id, ordination_id, planerad, tagen, orsak, tid, kvitterad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, o.id, planerad, tagen ? 1 : 0, orsak || null, nu, atk.personal.id, nu);
  atk.logga('ge_lakemedel', atk.grund(), `egenintag:${o.id}`);
  return { intag: intagUt(db, db.query('SELECT * FROM egenintag WHERE id = ?').get(Number(r.lastInsertRowid))) };
}
