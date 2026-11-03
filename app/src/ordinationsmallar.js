// Fördefinierade ordinationer (Sussa 3.5.1.3) och ordination kopplad till en planerad vårdhändelse (3.5.2.7).
// Systemet föreslår dos, administrationssätt, tider, typ och uppföljning ur produkten och patienten, så att förskrivaren
// bara ändrar det som avviker. Förslagen är demoregler, inte doseringsstöd, och märks så.
//
// Ordinationens tillägg (administrationssätt, mallen den kom från, volym för vätskebalansen och vårdhändelsen) sparas
// i ordination_tillagg, så att ordinationstabellen och NLL-överföringen är oförändrade.
import { Fel, iso, idag, addDagar } from './db.js';
import { alder as alderAv, vardenhetFor } from './atkomst.js';
import { egfrForSakerhet } from './lakemedel.js';
// Planerad vårdhändelse i tidboken (vardhandelse.js): om tiden följer tidboken och systemets förklaring.
import { kopplingUt } from './vardhandelse.js';
// Runda 6, r2: läkemedelstyp, förpackningar, spädning och trappschema i förslaget.
import { forslagTillagg } from './lakemedelsstod.js';
// Runda 6, r6: läkemedelsmallen används bara när vårdenhetens mallansvariga läkare har godkänt den.
import { substansmall } from './mallgodkannande.js';

export const DEMO_MALLAR = 'Förslagen är demoregler för att visa flödet. De är inte doseringsstöd och inte granskade av farmaceut eller läkare.';
export const ADMINISTRATIONSSATT = {
  peroralt: 'Peroralt', subkutant: 'Subkutant', intravenost: 'Intravenöst', inhalation: 'Inhalation', sublingualt: 'Under tungan', intramuskulart: 'Intramuskulärt',
  // Runda 6, r2: nutrition kan ges via sond.
  sond: 'Via sond',
};

// Administrationssättet ur läkemedelsformen i NPL.
export function administrationssatt(form = '') {
  // Runda 6, r2: blodkomponenter ges intravenöst och sondnäring via sond.
  if (/blodkomponent/i.test(form)) return 'intravenost';
  if (/sondnäring/i.test(form)) return 'sond';
  if (/sublingual/i.test(form)) return 'sublingualt';
  if (/inhalation/i.test(form)) return 'inhalation';
  if (/infusion/i.test(form) || /pulver till injektion/i.test(form)) return 'intravenost';
  if (/injektionspenna|förfylld spruta/i.test(form)) return 'subkutant';
  if (/injektion/i.test(form)) return 'intravenost';
  return 'peroralt';
}

// De administrationssätt som passar läkemedelsformen (säkerhetsgranskningen av runda 5). Förskrivaren kan välja bland
// dem, men inte till exempel ge en injektionsvätska under tungan eller en tablett som injektion. Det förslagna sättet
// (administrationssatt) står först.
export function tillatnaSatt(form = '') {
  if (/blodkomponent/i.test(form)) return ['intravenost'];
  if (/sondnäring/i.test(form)) return ['sond'];
  if (/^dryck$/i.test(form)) return ['peroralt', 'sond'];
  if (/sublingual/i.test(form)) return ['sublingualt'];
  if (/inhalation/i.test(form)) return ['inhalation'];
  if (/infusion/i.test(form) || /pulver till injektion/i.test(form)) return ['intravenost'];
  if (/injektionspenna|förfylld spruta/i.test(form)) return ['subkutant', 'intramuskulart', 'intravenost'];
  if (/injektion/i.test(form)) return ['intravenost', 'intramuskulart', 'subkutant'];
  return ['peroralt'];
}

// Mallarna per substans finns i tabellen substansmallar med versioner och godkännanden (runda 6, r6: mallgodkannande.js),
// och grunddatan i seed/substansmallar.js.

// Grundförslag ur produkten när det inte finns en mall: en dos om dagen på morgonen, med styrkan som dos.
function grund(lm) {
  const m = /^([\d,]+)\s*(\S+)/.exec(lm.styrka ?? '');
  return { namn: null, dosering: '', dos: m ? Number(m[1].replace(',', '.')) : null, dosEnhet: m ? m[2] : null, tider: [], typ: 'staende', uppfoljning: 30 };
}

// Förslaget för produkten och patienten. Varje ändring mot mallen förklaras i varfor.
// eGFR räknas med samma regel som varningarna vid ordination (lakemedel.egfrForSakerhet): från alla vårdenheter, men
// aldrig från en spärrad vårdenhet utan samtycke.
export function forslag(atk, lm) {
  const db = atk.db;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const ar = p ? alderAv(p.fodd, idag()) : null;
  const egfr = egfrForSakerhet(atk);
  // Runda 6, r6: den senaste versionen av läkemedelsmallen som är godkänd på användarens vårdenhet.
  const sm = substansmall(db, lm.atc, vardenhetFor(db, atk.personal.enhet_id));
  const mall = sm?.mall ?? null;
  const f = { ...(mall ?? grund(lm)) };
  const varfor = [];
  if (mall) varfor.push(`Mallen ${mall.namn}.`);
  else if (sm) varfor.push(`Läkemedelsmallen ${sm.namn} är inte godkänd på din vårdenhet av den läkare som ansvarar för läkemedelsmallarna, så systemet föreslår bara dosen ur produktens styrka.`);
  if (mall?.aldre && ar != null && ar >= 75) { Object.assign(f, mall.aldre); varfor.push(mall.aldre.varfor); }
  if (mall?.egfr && egfr != null && egfr < 30) { Object.assign(f, mall.egfr); varfor.push(mall.egfr.varfor); }
  const satt = administrationssatt(lm.form);
  return {
    mall: mall ? lm.atc : null, mallnamn: mall?.namn ?? null, mallversion: sm?.mall ? { version: sm.version, godkand: sm.godkand } : null, dosering: f.dosering, dos: f.dos ?? null, dosEnhet: f.dosEnhet ?? null, tider: f.tider ?? [], typ: f.typ,
    vidBehov: f.typ === 'vid_behov', administrationssatt: satt, administrationssattText: ADMINISTRATIONSSATT[satt], tillatnaAdministrationssatt: tillatnaSatt(lm.form),
    uppfoljningsdatum: addDagar(idag(), f.uppfoljning ?? 30), volymMl: f.volym ?? null, vatskebalans: Boolean(f.volym), varfor, demoregler: true, anmarkning: DEMO_MALLAR,
    // Runda 6, r2: läkemedelstyp, förpackningar i NPL, spädning och trappschema.
    ...forslagTillagg(db, lm, { dos: f.dos ?? null, dosEnhet: f.dosEnhet ?? null }),
  };
}

// Tillägget till en ordination, valideras innan ordinationen sparas så att ett fel inte lämnar en halv ordination.
//   administrationssatt  ett av ADMINISTRATIONSSATT, annars förslaget ur produktens form
//   vardhandelse         { text, forskjutningTimmar } för en planerad men inte tidsatt vårdhändelse (3.5.2.7)
//   volymMl, vatskebalans  volym per dos som räknas in i vätskebalansen (3.5.2.21)
export function valideraTillagg(db, inp = {}) {
  const lm = typeof inp.lakemedelId === 'string' ? db.query('SELECT * FROM katalog WHERE id = ?').get(inp.lakemedelId) : null;
  const falt = [];
  const satt = inp.administrationssatt ?? (lm ? administrationssatt(lm.form) : null);
  if (satt != null && (!Object.hasOwn(ADMINISTRATIONSSATT, satt) || (lm && !tillatnaSatt(lm.form).includes(satt)))) falt.push('administrationssatt');
  let handelse = null;
  if (inp.vardhandelse != null) {
    const text = typeof inp.vardhandelse.text === 'string' ? inp.vardhandelse.text.trim().slice(0, 120) : '';
    const h = Number(inp.vardhandelse.forskjutningTimmar ?? 0);
    if (text.length < 3 || !Number.isFinite(h) || h < -72 || h > 72) falt.push('vardhandelse');
    else handelse = { text, forskjutningMin: Math.round(h * 60) };
  }
  const volym = inp.volymMl == null || inp.volymMl === '' ? null : Number(inp.volymMl);
  if (volym != null && (!Number.isFinite(volym) || volym <= 0 || volym > 5000)) falt.push('volymMl');
  if (handelse && Array.isArray(inp.tider) && inp.tider.length) falt.push('tider');
  if (falt.length) {
    throw new Fel(400, falt.includes('tider') ? 'En ordination till en vårdhändelse som inte är tidsatt får inga fasta tider. Tiden räknas fram när vårdhändelsen får sin tid.'
      : `Kontrollera ${falt.map(f => ({ administrationssatt: lm ? `administrationssättet, som ska passa läkemedelsformen (${lm.form}): ${tillatnaSatt(lm.form).map(s => ADMINISTRATIONSSATT[s].toLowerCase()).join(', ')}` : 'administrationssätt', vardhandelse: 'vårdhändelsen (minst tre tecken, högst 72 timmar före eller efter)', volymMl: 'volymen' }[f])).join(', ')}.`, 'ogiltig', { falt });
  }
  return { administrationssatt: satt, mall: typeof inp.mall === 'string' ? inp.mall.slice(0, 20) : null, volymMl: volym, vatskebalans: inp.vatskebalans === false ? false : volym != null, vardhandelse: handelse };
}

export function sparaTillagg(db, ordinationId, t) {
  db.query(`INSERT INTO ordination_tillagg (ordination_id, administrationssatt, mall, volym_ml, vatskebalans, vardhandelse, forskjutning_min) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (ordination_id) DO NOTHING`).run(ordinationId, t.administrationssatt, t.mall, t.volymMl, t.vatskebalans ? 1 : 0, t.vardhandelse?.text ?? null, t.vardhandelse?.forskjutningMin ?? null);
}

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
// Tillägget för läkemedelslistan, FHIR och administreringslistan. Tom när ordinationen saknar tillägg.
// full: användaren får se den ordinerande vårdenhetens uppgifter, och då visas vårdhändelsen ur tidboken med namn och
// tid. Annars bara läkarens egen text och när läkemedlet ges (vardhandelse.kopplingUt, säkerhetsgranskning runda 5).
export function tillaggUt(db, ordinationId, { full = false } = {}) {
  const t = db.query('SELECT * FROM ordination_tillagg WHERE ordination_id = ?').get(ordinationId);
  if (!t) return {};
  const ut = {};
  if (t.administrationssatt) Object.assign(ut, { administrationssatt: t.administrationssatt, administrationssattText: ADMINISTRATIONSSATT[t.administrationssatt] ?? t.administrationssatt });
  if (t.volym_ml) Object.assign(ut, { volymMl: t.volym_ml, vatskebalans: Boolean(t.vatskebalans) });
  if (t.vardhandelse) {
    const k = kopplingUt(db, ordinationId, { full });
    const { skyddad, egenText, ...koppling } = k;
    ut.vardhandelse = {
      text: t.vardhandelse, forskjutningMin: t.forskjutning_min ?? 0, tid: t.handelse_tid ?? null,
      administreras: t.handelse_tid ? new Date(Date.parse(t.handelse_tid) + (t.forskjutning_min ?? 0) * 60_000).toISOString() : null,
      sattAv: personNamn(db, t.handelse_satt_av), satt: t.handelse_satt ?? null,
      ...koppling,
    };
    // En annan vårdenhet utan aktivt val: bara texten och när läkemedlet ges. Förskjutningen, ändringstiden och vem som
    // satte tiden lämnas inte ut, eftersom bokningens tid annars går att räkna fram (säkerhetsgranskning runda 5).
    if (skyddad) {
      const { administreras, foljerTidbok, lage, forklaring } = ut.vardhandelse;
      ut.vardhandelse = { text: egenText ? t.vardhandelse : 'Planerad vårdhändelse', administreras, foljerTidbok, lage, forklaring, skyddad: true };
    }
  }
  return ut;
}

// Vårdhändelsen får sin tid (3.5.2.14: administrationstiden anpassas när vårdhändelsen tidsätts).
export function tidsattHandelse(db, ordinationId, tid, personalId) {
  const t = db.query('SELECT * FROM ordination_tillagg WHERE ordination_id = ?').get(ordinationId);
  if (!t?.vardhandelse) throw new Fel(400, 'Ordinationen är inte kopplad till en planerad vårdhändelse.', 'ogiltig');
  const o = db.query('SELECT status FROM ordinationer WHERE id = ?').get(ordinationId);
  if (o?.status !== 'aktiv') throw new Fel(400, 'Ordinationen är utsatt, så vårdhändelsen kan inte längre få en tid.', 'ogiltig');
  const ms = typeof tid === 'string' ? Date.parse(tid) : NaN;
  if (!Number.isFinite(ms) || ms < Date.now() - 86400_000 || ms > Date.now() + 60 * 86400_000) {
    throw new Fel(400, 'Ange när vårdhändelsen blir av, från i går och högst 60 dagar fram.', 'ogiltig', { falt: ['tid'] });
  }
  db.query('UPDATE ordination_tillagg SET handelse_tid = ?, handelse_satt_av = ?, handelse_satt = ? WHERE ordination_id = ?').run(new Date(ms).toISOString(), personalId, iso(), ordinationId);
  // Varje tidsättning och ändring sparas i ordinationens historik.
  db.query("INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, 'vardhandelse_tid', ?)")
    .run(ordinationId, iso(), personalId, JSON.stringify({ fran: t.handelse_tid ?? null, till: new Date(ms).toISOString() }));
  return tillaggUt(db, ordinationId);
}
