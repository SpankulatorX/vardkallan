// Runda 11, r7: utökat stöd för vätskebalans i intensivvården (Sussa 4.6.1.6): perspiratio och förlust via
// andningen, andningsstödet, vätskebalansen framåt till dygnsbrytningen och behandlingsmål för vätska, energi, vikt och
// elektrolyter med aktuellt underskott och rekommendationer.
//
// Systemet räknar perspiratio själv ur den godkända vikten, temperaturen och andningsstödet, så att ingen behöver
// uppskatta den. Prognosen räknar de pågående infusionerna i ml/h och förlusterna i samma takt som de senaste sex
// timmarna fram till dygnsbrytningen. Läkaren sätter målen, och systemet säger på vanlig svenska hur långt patienten är
// från dem och vad som kan göras. Allt räknas bara på det användaren får se. Reglerna är demoregler, inte kliniskt
// beslutsstöd.
import { Fel } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import { kravVardande } from './administrering.js';
import { kvalitetssakrad } from './mt-klass.js';
import * as iva from './iva.js';
import * as journal from './journal.js';
import { lasTal } from './iva-patientregler.js';

const TIMME = 3600_000;
const talSv = (v, d = 0) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
const plus = (v) => `${v > 0 ? '+' : ''}${talSv(v, 0)}`;
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);

export const DEMOREGEL = 'Perspiratio, prognosen och rekommendationerna är demoregler, inte kliniskt beslutsstöd.';
// Perspiratio insensibilis i ml per kilo och timme: genom huden och genom andningen (demoregel, omkring 12 ml/kg och
// dygn), med tio procent mer per grad över 37 °C.
export const PERSPIRATIO = { hud: 0.33, andning: 0.17, perGradFeber: 0.1, normaltemp: 37 };
export const ANDNINGSSTOD = { invasiv: 'Invasiv ventilation i respirator', niv: 'Icke-invasiv ventilation (NIV)', hogflode: 'Högflödesbehandling', syrgas: 'Syrgas på grimma eller mask' };
// Hur mycket av andningens förlust som finns kvar med befuktningen (demoregel): aktiv befuktning tar bort den,
// fuktvärmeväxlaren hälften, och torr gas utan befuktning ökar den.
export const BEFUKTNING = { aktiv: ['Aktiv befuktning', 0], fvv: ['Fuktvärmeväxlare (HME)', 0.5], ingen: ['Ingen befuktning', 1.5] };
export const DYGNSBRYTNING = 6;
export const MAL = {
  vatskebalans: { namn: 'Vätskebalans per dygn', enhet: 'ml', min: -3000, max: 3000 },
  energi: { namn: 'Energi per dygn', enhet: 'kcal/kg', min: 5, max: 50 },
  vikt: { namn: 'Målvikt', enhet: 'kg', min: 1, max: 300 },
};
// Elektrolyterna som systemet följer, med målintervall (demoregel) och mätvärdestypen.
export const ELEKTROLYTER = { kalium: { namn: 'Kalium', lag: 3.5, hog: 5.0, enhet: 'mmol/L' }, natrium: { namn: 'Natrium', lag: 135, hog: 145, enhet: 'mmol/L' } };

export const SCHEMA = `
-- Andningsstödet i intensivvården (runda 11, r7, Sussa 4.6.1.6 och 4.6.1.7). Bara slutet sätts i efterhand, en gång.
CREATE TABLE IF NOT EXISTS iva_andningsstod (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, befuktning TEXT NOT NULL, start TEXT NOT NULL, av TEXT NOT NULL,
  slut TEXT, slut_av TEXT, CHECK (typ IN ('invasiv', 'niv', 'hogflode', 'syrgas')), CHECK (befuktning IN ('aktiv', 'fvv', 'ingen'))
);
CREATE TRIGGER IF NOT EXISTS iva_andningsstod_andras_ej BEFORE UPDATE OF enhet_id, typ, befuktning, start, av ON iva_andningsstod
  BEGIN SELECT RAISE(ABORT, 'Andningsstödet ändras inte. Avsluta det och registrera ett nytt.'); END;
CREATE TRIGGER IF NOT EXISTS iva_andningsstod_slut_en_gang BEFORE UPDATE OF slut, slut_av ON iva_andningsstod WHEN OLD.slut IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'Ett avslutat andningsstöd ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS iva_andningsstod_raderas_ej BEFORE DELETE ON iva_andningsstod BEGIN SELECT RAISE(ABORT, 'Andningsstödet raderas inte'); END;
-- Behandlingsmålen för vätska, energi och vikt. En nytt mål av samma typ avslutar det förra.
CREATE TABLE IF NOT EXISTS iva_behandlingsmal (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, varde REAL NOT NULL, skapad TEXT NOT NULL, av TEXT NOT NULL,
  avslutad TEXT, CHECK (typ IN ('vatskebalans', 'energi', 'vikt'))
);
CREATE TRIGGER IF NOT EXISTS iva_behandlingsmal_andras_ej BEFORE UPDATE OF enhet_id, typ, varde, skapad, av ON iva_behandlingsmal
  BEGIN SELECT RAISE(ABORT, 'Ett behandlingsmål ändras inte. Sätt ett nytt mål.'); END;
CREATE TRIGGER IF NOT EXISTS iva_behandlingsmal_avslut_en_gang BEFORE UPDATE OF avslutad ON iva_behandlingsmal WHEN OLD.avslutad IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'Ett avslutat mål ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS iva_behandlingsmal_raderas_ej BEFORE DELETE ON iva_behandlingsmal BEGIN SELECT RAISE(ABORT, 'Ett behandlingsmål raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
const finns = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const synliga = (atk, sql, ...arg) => {
  if (!kanRoll(atk.personal, 'las_matvarden')) return [];
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  return a.filtrera(atk.db.query(sql).all(atk.patientId, ...arg), 'las_matvarden');
};

// Andningsstödet som användaren får se.
export function andningsstodFor(atk) {
  if (!finns(atk.db, 'iva_andningsstod')) return [];
  return synliga(atk, 'SELECT * FROM iva_andningsstod WHERE patient_id = ? ORDER BY start DESC, id DESC').map(r => ({
    id: r.id, typ: r.typ, typText: ANDNINGSSTOD[r.typ], befuktning: r.befuktning, befuktningText: BEFUKTNING[r.befuktning][0], start: r.start, slut: r.slut, av: personNamn(atk.db, r.av), aktiv: !r.slut,
  }));
}

// Perspiratio per timme i ml för vikten, temperaturen och andningsstödet. Ger delarna och texten.
export function perspiratio({ vikt, temp = null, stod = null }) {
  if (!(vikt > 0)) return null;
  const feber = temp != null && temp > PERSPIRATIO.normaltemp ? (temp - PERSPIRATIO.normaltemp) * PERSPIRATIO.perGradFeber : 0;
  const faktor = stod ? BEFUKTNING[stod.befuktning][1] : 1;
  const hud = PERSPIRATIO.hud * vikt * (1 + feber);
  const andning = PERSPIRATIO.andning * vikt * (1 + feber) * faktor;
  const perTimme = Math.round((hud + andning) * 10) / 10;
  const delar = [`huden ${talSv(hud, 0)} ml/h`, `andningen ${talSv(andning, 0)} ml/h${stod ? ` (${BEFUKTNING[stod.befuktning][0].toLowerCase()})` : ''}`];
  return { perTimme, hud: Math.round(hud * 10) / 10, andning: Math.round(andning * 10) / 10, feberProcent: Math.round(feber * 100),
    text: `Perspiratio ${talSv(perTimme, 0)} ml/h: ${delar.join(' och ')}, vid ${talSv(vikt, 1)} kg${feber ? ` och ${talSv(temp, 1)} °C (${Math.round(feber * 100)} procent mer för febern)` : ''}.` };
}

// Nästa dygnsbrytning (kl. 06 svensk tid) efter nu, och den senaste före. Räknas med klockslaget i svensk tid, så att
// omställningen till sommar- och vintertid inte flyttar brytningen.
export function dygnsbrytning(nu) {
  const lokal = (ms) => { const d = new Date(ms); const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return p; };
  // Sök timme för timme bakåt till närmaste kl. 06.00 svensk tid.
  let t = Math.floor(nu.getTime() / TIMME) * TIMME;
  for (let i = 0; i < 30; i++, t -= TIMME) { const p = lokal(t); if (Number(p.hour) === DYGNSBRYTNING && p.minute === '00') break; }
  let n = t + 20 * TIMME;
  for (let i = 0; i < 8; i++, n += TIMME) { const p = lokal(n); if (Number(p.hour) === DYGNSBRYTNING && p.minute === '00') break; }
  return { senaste: new Date(t).toISOString(), nasta: new Date(n).toISOString() };
}

// Målen som användaren får se, aktiva.
export function malFor(atk) {
  if (!finns(atk.db, 'iva_behandlingsmal')) return {};
  const ut = {};
  for (const r of synliga(atk, 'SELECT * FROM iva_behandlingsmal WHERE patient_id = ? AND avslutad IS NULL ORDER BY skapad DESC, id DESC')) {
    if (!ut[r.typ]) ut[r.typ] = { id: r.id, typ: r.typ, varde: r.varde, enhet: MAL[r.typ].enhet, namn: MAL[r.typ].namn, skapad: r.skapad, av: personNamn(atk.db, r.av) };
  }
  return ut;
}

// Den utökade vätskebalansen för en patient: perspiratio per timme, balansen med perspiratio, prognosen till
// dygnsbrytningen, målen och rekommendationerna. infusioner: iva.infusionerFor (de pågående med ml/h). kcal: energin som
// har getts sedan dygnsbrytningen, om den är känd.
export function utokad(atk, { nu = new Date(), infusioner = [], kcal = null } = {}) {
  atk.krav('las_matvarden');
  const bas = iva.vatskaTimvis(atk, { timmar: 24 }, nu);
  const mv = journal.synligaMatvarden(new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden')).filter(kvalitetssakrad).filter(m => m.kalla !== 'patient');
  const senaste = (typ) => mv.filter(m => m.typ === typ && Date.parse(m.tid) <= nu.getTime()).sort((a, b) => b.tid.localeCompare(a.tid))[0] ?? null;
  const temp = senaste('temp');
  const tempNu = temp && Date.parse(temp.tid) > nu.getTime() - 6 * TIMME ? temp.varde_num : null;
  const stod = andningsstodFor(atk);
  const aktivtStod = stod.find(s => s.aktiv) ?? null;
  const per = perspiratio({ vikt: bas.vikt?.kg, temp: tempNu, stod: aktivtStod });
  const pTimme = per?.perTimme ?? 0;
  const timmar = bas.timmar.map(t => ({ ...t, perspiratio: pTimme, balansMedPerspiratio: Math.round((t.balans - pTimme) * 10) / 10 }));
  const balansMedPerspiratio = Math.round((bas.balans - pTimme * 24) * 10) / 10;
  // Prognosen till dygnsbrytningen: pågående infusioner i ml/h, och förluster (urin och dränage) i samma takt som de
  // senaste sex timmarna, och perspiratio.
  const br = dygnsbrytning(nu);
  const kvar = Math.max(0, (Date.parse(br.nasta) - nu.getTime()) / TIMME);
  const infMlH = infusioner.reduce((s, i) => s + (i.mlH ?? 0), 0);
  const sex = bas.timmar.slice(-6);
  const utMlH = sex.reduce((s, t) => s + t.ut, 0) / Math.max(1, sex.length);
  const sedanBrytning = bas.timmar.filter(t => Date.parse(t.fran) >= Date.parse(br.senaste) && Date.parse(t.fran) < nu.getTime());
  const hittills = Math.round(sedanBrytning.reduce((s, t) => s + t.balans, 0) - pTimme * Math.max(0, (nu.getTime() - Date.parse(br.senaste)) / TIMME));
  const prognos = Math.round(hittills + (infMlH - utMlH - pTimme) * kvar);
  const mal = malFor(atk);
  const rekommendationer = [];
  if (mal.vatskebalans) {
    const m = mal.vatskebalans.varde;
    const skillnad = prognos - m;
    const perTimme = kvar > 0 ? Math.abs(skillnad) / kvar : 0;
    rekommendationer.push({ typ: 'vatskebalans', underskott: Math.round(-skillnad), niva: Math.abs(skillnad) > 500 ? 'varning' : 'info',
      text: Math.abs(skillnad) <= 200 ? `Dygnets balans är ${plus(hittills)} ml och beräknas bli ${plus(prognos)} ml kl. 06, inom 200 ml från målet ${plus(m)} ml.`
        : `Dygnets balans är ${plus(hittills)} ml och beräknas bli ${plus(prognos)} ml kl. 06, ${talSv(Math.abs(skillnad), 0)} ml ${skillnad > 0 ? 'över' : 'under'} målet ${plus(m)} ml. För att nå målet behöver balansen ${skillnad > 0 ? 'minska' : 'öka'} med omkring ${talSv(perTimme, 0)} ml per timme.`,
      gora: Math.abs(skillnad) <= 200 ? null : skillnad > 0 ? 'Ta upp med ansvarig läkare om tillförseln ska minskas eller om diuretika ska ges enligt ordination.' : 'Ta upp med ansvarig läkare om mer vätska ska ges.' });
  }
  if (mal.energi && bas.vikt) {
    const behov = Math.round(mal.energi.varde * bas.vikt.kg);
    const givet = kcal ?? 0;
    const andel = (Date.parse(br.nasta) - nu.getTime()) / (24 * TIMME);
    const forvantat = Math.round(behov * (1 - andel));
    const under = forvantat - givet;
    rekommendationer.push({ typ: 'energi', underskott: under, niva: under > behov * 0.25 ? 'varning' : 'info',
      text: `Målet är ${talSv(mal.energi.varde, 0)} kcal/kg, ${talSv(behov, 0)} kcal per dygn. Sedan kl. 06 har patienten fått ${talSv(givet, 0)} kcal${under > 0 ? `, ${talSv(under, 0)} kcal under det som behövs hittills i dygnet` : ', enligt målet'}.`,
      gora: under > behov * 0.25 ? 'Öka nutritionen enligt ordination eller kontakta dietist.' : null });
  }
  if (mal.vikt && bas.vikt) {
    const d = Math.round((bas.vikt.kg - mal.vikt.varde) * 10) / 10;
    rekommendationer.push({ typ: 'vikt', underskott: -d, niva: Math.abs(d) >= 2 ? 'varning' : 'info',
      text: `Vikten ${talSv(bas.vikt.kg, 1)} kg är ${Math.abs(d) < 0.1 ? 'samma som' : `${talSv(Math.abs(d), 1)} kg ${d > 0 ? 'över' : 'under'}`} målvikten ${talSv(mal.vikt.varde, 1)} kg.`,
      gora: Math.abs(d) >= 2 ? (d > 0 ? 'Bedöm vätskeöverskottet vid ronden.' : 'Bedöm nutrition och vätskestatus vid ronden.') : null });
  }
  for (const [typ, e] of Object.entries(ELEKTROLYTER)) {
    const m = senaste(typ);
    if (!m || Date.parse(m.tid) < nu.getTime() - 24 * TIMME) continue;
    const v = m.varde_num;
    if (v < e.lag || v > e.hog) rekommendationer.push({ typ, niva: 'varning', text: `${e.namn} ${talSv(v, typ === 'kalium' ? 1 : 0)} ${e.enhet} kl. ${klocka(m.tid)} är ${v < e.lag ? 'under' : 'över'} målet ${talSv(e.lag, 1)} till ${talSv(e.hog, 1)} ${e.enhet}.`, gora: `Kontakta ansvarig läkare om ${v < e.lag ? 'tillförsel' : 'åtgärd'} enligt ordination.` });
  }
  return {
    timmar, perspiratio: per, balans: bas.balans, balansMedPerspiratio, andningsstod: stod, aktivtStod, mal, rekommendationer,
    prognos: { till: br.nasta, timmar: Math.round(kvar * 10) / 10, hittills, balans: prognos, infusionerMlH: Math.round(infMlH * 10) / 10, forlusterMlH: Math.round(utMlH * 10) / 10,
      text: `Beräknat till kl. 06: ${plus(prognos)} ml, med infusionerna ${talSv(infMlH, 1)} ml/h, förlusterna ${talSv(utMlH, 0)} ml/h som de senaste sex timmarna och perspiratio ${talSv(pTimme, 0)} ml/h.` },
    demoregel: DEMOREGEL,
  };
}

// POST /api/patient/:id/iva/andningsstod { typ, befuktning }: sjuksköterskan eller läkaren registrerar att andningsstödet
// börjar. Ett pågående stöd avslutas samtidigt. POST .../andningsstod/avsluta avslutar det pågående.
export function registreraStod(atk, body = {}, nu = new Date()) {
  kravVardande(atk, 'registrera_matvarde', null, 'iva:andningsstod');
  const typ = typeof body.typ === 'string' && Object.hasOwn(ANDNINGSSTOD, body.typ) ? body.typ : null;
  const bef = typeof body.befuktning === 'string' && Object.hasOwn(BEFUKTNING, body.befuktning) ? body.befuktning : (typ === 'syrgas' ? 'ingen' : null);
  if (!typ || !bef) throw new Fel(400, `Välj ${!typ ? 'andningsstöd' : 'befuktning'}.`, 'ogiltig', { falt: [!typ ? 'typ' : 'befuktning'] });
  const db = atk.db;
  const t = nu.toISOString();
  db.transaction(() => {
    for (const s of andningsstodFor(atk).filter(x => x.aktiv)) db.query('UPDATE iva_andningsstod SET slut = ?, slut_av = ? WHERE id = ? AND slut IS NULL').run(t, atk.personal.id, s.id);
    db.query('INSERT INTO iva_andningsstod (patient_id, enhet_id, typ, befuktning, start, av) VALUES (?, ?, ?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, typ, bef, t, atk.personal.id);
  })();
  atk.logga('registrera_matvarde', atk.grund(), 'iva:andningsstod');
  return { andningsstod: andningsstodFor(atk), text: `${ANDNINGSSTOD[typ]} med ${BEFUKTNING[bef][0].toLowerCase()} från kl. ${klocka(t)}. Systemet räknar perspiratio och vårdtyngd med det.` };
}
export function avslutaStod(atk, nu = new Date()) {
  kravVardande(atk, 'registrera_matvarde', null, 'iva:andningsstod');
  const s = andningsstodFor(atk).find(x => x.aktiv);
  if (!s) throw new Fel(404, 'Inget andningsstöd pågår.', 'saknas');
  atk.db.query('UPDATE iva_andningsstod SET slut = ?, slut_av = ? WHERE id = ? AND slut IS NULL').run(nu.toISOString(), atk.personal.id, s.id);
  atk.logga('registrera_matvarde', atk.grund(), 'iva:andningsstod:avsluta');
  return { andningsstod: andningsstodFor(atk), text: `${s.typText} är avslutad.` };
}

// POST /api/patient/:id/iva/mal { typ, varde }: läkaren sätter ett behandlingsmål. Ett tidigare mål av samma typ avslutas.
export function sattMal(atk, body = {}, nu = new Date()) {
  kravVardande(atk, 'ordinera', null, 'iva:mal');
  const typ = typeof body.typ === 'string' && Object.hasOwn(MAL, body.typ) ? body.typ : null;
  if (!typ) throw new Fel(400, 'Välj vilket mål som ska sättas.', 'ogiltig', { falt: ['typ'] });
  const v = lasTal(body.varde);
  const d = MAL[typ];
  if (v == null || v < d.min || v > d.max) throw new Fel(400, `${d.namn} ska vara ett tal mellan ${d.min} och ${d.max} ${d.enhet}.`, 'ogiltig', { falt: ['varde'] });
  const t = nu.toISOString();
  atk.db.transaction(() => {
    for (const m of Object.values(malFor(atk)).filter(x => x.typ === typ)) atk.db.query('UPDATE iva_behandlingsmal SET avslutad = ? WHERE id = ? AND avslutad IS NULL').run(t, m.id);
    atk.db.query('INSERT INTO iva_behandlingsmal (patient_id, enhet_id, typ, varde, skapad, av) VALUES (?, ?, ?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, typ, v, t, atk.personal.id);
  })();
  atk.logga('ordinera', atk.grund(), `iva:mal:${typ}`);
  return { mal: malFor(atk), text: `${d.namn} är ${typ === 'vatskebalans' ? plus(v) : talSv(v, typ === 'vikt' ? 1 : 0)} ${d.enhet}. Systemet följer målet i vätskebalansen.` };
}
