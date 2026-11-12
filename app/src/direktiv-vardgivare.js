// Generella direktiv på vårdgivarens nivå (runda 9, r1, Sussa 3.5.2.15): ett direktiv som gäller alla vårdenheter hos
// vårdgivaren, fastställt av den läkare som vårdgivaren har utsett. Direktiv för en vårdenhet eller avdelning fastställs
// av den medicinskt ansvariga läkaren (ordinationsvagar.js, lakemedelsansvar.js). Runda 13, r3: inte av verksamhetschefen.
//
// Systemet är experten. Systemet vet vem vårdgivaren har utsett och säger det till den som försöker fastställa ett
// direktiv för hela vårdgivaren utan uppdraget. Sjuksköterskan ser vårdgivarens direktiv bland de egna, prövade mot
// patienten på samma sätt, utan att behöva veta på vilken nivå de är fastställda. En kommun hör inte till vårdgivaren och
// får inte dess direktiv.
import { idag } from './db.js';

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

// Vårdgivaren som enheten hör till, eller null (till exempel en kommun).
export function vardgivareFor(db, enhetId) {
  let e = enhetId ? db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(enhetId) : null;
  for (let i = 0; e && i < 10; i++) {
    if (e.typ === 'vardgivare') return e.id;
    e = e.forald_id ? db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(e.forald_id) : null;
  }
  return null;
}

// Den som vårdgivaren har utsett att fastställa direktiv för hela vårdgivaren, i dag.
export function utsedd(db, vardgivare, dag = idag()) {
  const r = db.query('SELECT * FROM vardgivarens_lakemedelsuppdrag WHERE enhet_id = ? AND fran <= ? AND till >= ? ORDER BY fran DESC').get(vardgivare, dag, dag);
  return r ? { id: r.personal_id, namn: personNamn(db, r.personal_id), till: r.till } : null;
}

// Får personen fastställa direktiv för hela vårdgivaren? Ger { kan, varfor, vardgivare }.
export function kanFaststalla(db, personal) {
  const vg = vardgivareFor(db, personal.enhet_id);
  if (!vg) return { kan: false, varfor: 'Din enhet hör inte till någon vårdgivare med gemensamma direktiv.', vardgivare: null };
  const u = utsedd(db, vg);
  if (personal.yrke === 'lakare' && u?.id === personal.id) return { kan: true, varfor: null, vardgivare: vg };
  const namn = db.query('SELECT namn FROM enheter WHERE id = ?').get(vg)?.namn ?? vg;
  return { kan: false, vardgivare: vg, varfor: `Ett generellt direktiv för hela ${namn} fastställs av den läkare som vårdgivaren har utsett. ${u ? `Det är ${u.namn}, till och med ${u.till}.` : 'Vårdgivaren har inte utsett någon just nu.'}` };
}
