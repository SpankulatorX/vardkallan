// Hur ett mätvärde kom in i journalen (runda 10, r4, Sussa 3.1.3.9): manuellt av personalen, maskinellt från
// medicinteknisk utrustning eller laboratoriet, räknat av systemet, migrerat eller som patientens egen mätning. Systemet
// avgör det själv ur raden, så att ingen behöver ange källan, och listan kan väljas ut efter den. Modulen har inga
// importer, så att journal.js kan läsa den.

export const INMATNINGAR = Object.freeze(Object.assign(Object.create(null), {
  manuell: 'Manuellt inmatat', utrustning: 'Maskinellt från medicinteknisk utrustning', laboratorium: 'Maskinellt från laboratoriet',
  raknad: 'Räknat av systemet', patient: 'Patientens egen mätning', migrerad: 'Migrerat från ett tidigare journalsystem',
  // Runda 11, r7: tillväxtdata som har lästs in från en fil eller ett annat journalsystem (tillvaxt-r11.js).
  importerad: 'Inläst från en fil eller ett annat journalsystem',
}));
export const MASKINELLA = new Set(['utrustning', 'laboratorium', 'raknad']);
const LABB = new Set(['crp', 'kreatinin', 'hba1c', 'inr', 'ntprobnp', 'hb', 'kalium', 'troponin', 'tsh', 'lpk', 'tpk', 'natrium', 'kobalamin', 'folat', 'sr']);

// m är raden i matvarden, labb är true när värdet är ett svar från laboratoriet och vem är namnet på den som
// registrerade värdet.
export function inmatning(m, { labb = false, vem = null } = {}) {
  let typ;
  if (String(m.kalla ?? '').startsWith('migrerad:')) typ = 'migrerad';
  else if (m.kalla === 'utrustning') typ = 'utrustning';
  else if (m.kalla === 'patient') typ = 'patient';
  else if (m.kalla === 'import') typ = 'importerad';
  else if (m.typ === 'egfr') typ = 'raknad';
  else if (labb || (LABB.has(m.typ) && !m.registrerad_av)) typ = 'laboratorium';
  else typ = 'manuell';
  const text = typ === 'raknad' ? 'Räknat av systemet ur kreatininet (CKD-EPI 2021)'
    : typ === 'manuell' && vem ? `Manuellt inmatat av ${vem}` : INMATNINGAR[typ];
  return { typ, text, maskinell: MASKINELLA.has(typ) };
}

// Urvalet i listan: typ av mätvärde, hur det kom in och hur många dagar bakåt. Okända värden ignoreras.
export function lasUrval(q, typer) {
  const typ = q.get?.('typ') ?? null;
  const inm = q.get?.('inmatning') ?? null;
  const dagar = Number(q.get?.('dagar'));
  return {
    typ: typ && Object.hasOwn(typer, typ) ? typ : null,
    inmatning: inm && Object.hasOwn(INMATNINGAR, inm) ? inm : null,
    dagar: Number.isInteger(dagar) && dagar > 0 && dagar <= 3650 ? dagar : null,
  };
}
export function tillampa(lista, urval, nu = Date.now()) {
  return lista.filter(m => (!urval.typ || m.typ === urval.typ) && (!urval.inmatning || m.inmatning?.typ === urval.inmatning)
    && (!urval.dagar || Date.parse(m.tid) >= nu - urval.dagar * 86400_000));
}
