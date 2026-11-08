// Flödet på akutmottagningen, en högflödesmottagning (runda 10, r5, Sussa 3.2.3.5).
//
// Systemet är experten. Ankomsten registreras med ett klick: systemet sätter könumret, ankomsttiden och akutbesöket på
// akutmottagningen. Triagen räknar prioriteten ur vitalparametrarna (NEWS2) och kontaktorsaken och förklarar varför.
// Flödestavlan visar varje patients steg (väntar på triage, väntar på läkare, väntar på en aktivitet, bedömd, beslut),
// planerade och utförda aktiviteter med vem och när, och ledtiderna, sorterat på prioritet och väntetid. Systemet räknar
// själv fram steget ur det som är gjort. Vid utregistreringen avslutar systemet besöket, och vid överföring till
// slutenvård skriver systemet in patienten på avdelningen från akutbesöket (vardkontakt.js). En förvarning från
// ambulansen (simulerad prehospital tjänst) blir en ankomst med de prehospitala uppgifterna och ett förslag på
// prioritet. Ledtiderna följs upp per prioritet utan patientuppgifter.
//
// Behörighet. Tavlan med namn, kontaktorsak och aktiviteter visas bara för akutmottagningens personal, och aldrig namn
// eller personnummer för en patient med skyddad identitet. Andra med väntrummet ser bara könummer, prioritet, steg och
// väntetid. Ankomsten ger inte den som registrerade den vårdrelation: akutbesöket ger vårdrelation först när en annan
// person har triagerat eller bedömt patienten, eller när ankomsten kom från ambulansens förvarning, så att ingen kan ge
// sig själv åtkomst till en journal genom att registrera en ankomst. Varje åtgärd loggas på patienten.
//
// Triagen är en demoregel, inte RETTS eller något annat fastställt triagesystem, och ingen MDR-bedömning är gjord.
import { Fel, iso } from './db.js';
import { Atkomst, vardenhetFor, kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { news2 } from './skalor.js';
import * as vardkontakt from './vardkontakt.js';

export const AKUT = 'uso-akut';
export const DEMOREGEL = 'Triagen är en demoregel som räknar prioriteten ur NEWS2 och kontaktorsaken. Den är inte RETTS eller något annat fastställt triagesystem, och ingen MDR-bedömning är gjord.';
export const PREHOSPITAL = 'Ambulansen (simulerad)';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS akutbesok (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER NOT NULL, vantrum_id INTEGER,
  konummer TEXT NOT NULL, ankomst TEXT NOT NULL, ankomstsatt TEXT NOT NULL DEFAULT 'egen', kontaktorsak TEXT NOT NULL,
  registrerad_av TEXT NOT NULL, prioritet TEXT, triage TEXT, triage_tid TEXT, triage_av TEXT, bedomd_tid TEXT, bedomd_av TEXT,
  beslut TEXT, beslut_enhet TEXT, beslut_tid TEXT, beslut_av TEXT, utregistrerad TEXT, utregistrerad_av TEXT, prehospital TEXT,
  CHECK (ankomstsatt IN ('egen', 'ambulans')), CHECK (beslut IS NULL OR beslut IN ('hem', 'inlaggning', 'annan'))
);
CREATE TABLE IF NOT EXISTS akut_aktiviteter (
  id INTEGER PRIMARY KEY, besok_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, text TEXT NOT NULL,
  planerad TEXT NOT NULL, planerad_av TEXT NOT NULL, utford TEXT, utford_av TEXT
);
CREATE TABLE IF NOT EXISTS akut_forvarningar (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, patient_id TEXT, kontaktorsak TEXT NOT NULL, beraknad TEXT NOT NULL,
  vitaler TEXT NOT NULL, forslag TEXT, mottagen TEXT, besok_id INTEGER
);
CREATE TRIGGER IF NOT EXISTS akutbesok_raderas_ej BEFORE DELETE ON akutbesok BEGIN SELECT RAISE(ABORT, 'Ett akutbesök raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS akut_aktivitet_raderas_ej BEFORE DELETE ON akut_aktiviteter BEGIN SELECT RAISE(ABORT, 'En aktivitet raderas inte'); END;
`;

// Prioriteterna i ordning, och stegen som tavlan grupperar på.
export const PRIORITETER = { rod: 'Röd', orange: 'Orange', gul: 'Gul', gron: 'Grön', bla: 'Blå' };
const ORDNING = { rod: 0, orange: 1, gul: 2, gron: 3, bla: 4 };
export const STEG = [
  { id: 'vantar_triage', text: 'Väntar på triage' }, { id: 'vantar_lakare', text: 'Väntar på läkare' },
  { id: 'vantar_aktivitet', text: 'Väntar på prov eller undersökning' }, { id: 'bedomd', text: 'Bedömd' }, { id: 'beslut', text: 'Beslut fattat' },
];
const STEGTEXT = Object.fromEntries([...STEG.map(s => [s.id, s.text]), ['klar', 'Utregistrerad']]);
// Aktiviteterna som kan planeras, med text.
export const AKTIVITETER = {
  lakarbedomning: 'Läkarbedömning', prov: 'Blodprover', ekg: 'EKG', rontgen: 'Lungröntgen', ct: 'Datortomografi', lakemedel: 'Läkemedel', konsult: 'Bedömning av specialist', observation: 'Observation och nya vitalparametrar',
};

// ---- Triage (demoregel) -------------------------------------------------------------------------------------------
// Kontaktorsaker som ger lägst en viss prioritet.
const SYMTOM = [
  { prioritet: 'rod', ord: /medvetslös|andningsstopp|hjärtstopp|livlös/i, text: 'tecken på livshotande tillstånd' },
  { prioritet: 'orange', ord: /bröstsmärta|andnöd|stroke|förlamning|kramp|svår blödning|sepsis/i, text: 'symtom som kan vara tidskritiska' },
  { prioritet: 'gul', ord: /buksmärta|flanksmärta|feber|andningsbesvär|huvudvärk|kräkning/i, text: 'symtom som behöver bedömas inom några timmar' },
];
const strangast = (a, b) => (ORDNING[a] <= ORDNING[b] ? a : b);

// Prioriteten ur vitalparametrarna och kontaktorsaken, med skälen. vitaler: { andningsfrekvens, saturation, syrgas,
// systoliskt, puls, medvetande, temp }.
export function triage({ kontaktorsak = '', vitaler = {} }) {
  const n = news2(vitaler);
  const varfor = [];
  let prioritet = 'gron';
  if (n.komplett) {
    const p = n.poang >= 7 ? 'rod' : n.poang >= 5 || n.rod.length ? 'orange' : n.poang >= 3 ? 'gul' : 'gron';
    prioritet = p;
    varfor.push(`NEWS2 ${n.poang}${n.rod.length ? `, och ${n.rod.join(' och ').toLowerCase()} ger 3 poäng` : ''}: ${PRIORITETER[p].toLowerCase()}.`);
  } else {
    if (n.rod.length) { prioritet = 'orange'; varfor.push(`${n.rod.join(' och ')} ger 3 poäng i NEWS2: orange.`); }
    varfor.push(`Mät också ${n.saknas.map(s => s.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')}, så räknar systemet hela NEWS2.`);
  }
  const s = SYMTOM.find(x => x.ord.test(kontaktorsak));
  if (s) {
    const ny = strangast(prioritet, s.prioritet);
    varfor.push(`Kontaktorsaken (${kontaktorsak}) är ${s.text}: lägst ${PRIORITETER[s.prioritet].toLowerCase()}.`);
    prioritet = ny;
  }
  return { prioritet, prioritetText: PRIORITETER[prioritet], varfor, news2: { poang: n.poang, komplett: n.komplett, text: n.text }, demoregel: DEMOREGEL };
}

// ---- Hjälpare ------------------------------------------------------------------------------------------------------
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const minuter = (fran, till) => (fran && till ? Math.max(0, Math.round((Date.parse(till) - Date.parse(fran)) / 60000)) : null);
const arAkut = (db, pers) => Boolean(pers) && vardenhetFor(db, pers.enhet_id) === AKUT;
const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const logga = (db, pers, patientId, handling, resurs, resultat = 'tillaten') => loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: patientId, handling, resurs, grund: resultat === 'nekad' ? 'nekad' : 'egen_enhet', resultat });

function kravAkut(db, pers, roller = ['lakare', 'sjukskoterska', 'vardadministrator'], patientId = null, resurs = 'akut') {
  if (!arAkut(db, pers) || !kanRoll(pers, 'vantrum') || !roller.includes(pers.yrke)) {
    if (patientId) logga(db, pers, patientId, 'vantrum', resurs, 'nekad');
    throw new Fel(403, roller.length === 1 && roller[0] === 'lakare' ? 'Det här gör en läkare på akutmottagningen.' : 'Det här görs av akutmottagningens personal.', 'nekad');
  }
}

export const hamta = (db, id) => {
  const b = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM akutbesok WHERE id = ?').get(Number(id)) : null;
  if (!b) throw new Fel(404, 'Akutbesöket finns inte.', 'saknas');
  return b;
};

function stegFor(db, b) {
  if (b.utregistrerad) return 'klar';
  if (b.beslut) return 'beslut';
  if (!b.triage_tid) return 'vantar_triage';
  if (db.query('SELECT 1 FROM akut_aktiviteter WHERE besok_id = ? AND utford IS NULL').get(b.id)) return 'vantar_aktivitet';
  if (!b.bedomd_tid) return 'vantar_lakare';
  return 'bedomd';
}
const aktiviteter = (db, b) => db.query('SELECT * FROM akut_aktiviteter WHERE besok_id = ? ORDER BY planerad, id').all(b.id).map(a => ({
  id: a.id, typ: a.typ, text: a.text, planerad: a.planerad, planeradAv: personKort(db, a.planerad_av), utford: a.utford, utfordAv: personKort(db, a.utford_av),
}));
function ledtider(b, nu = Date.now()) {
  const slut = b.utregistrerad ?? new Date(nu).toISOString();
  return { vantatMin: minuter(b.ankomst, slut), tillTriageMin: minuter(b.ankomst, b.triage_tid), tillLakareMin: minuter(b.ankomst, b.bedomd_tid), vistelseMin: b.utregistrerad ? minuter(b.ankomst, b.utregistrerad) : null };
}

// Raden på tavlan. full: akutmottagningens personal. Andra ser bara könummer, prioritet, steg och väntetid.
export function besokUt(db, b, { full = true, nu = Date.now() } = {}) {
  const steg = stegFor(db, b);
  const bas = { konummer: b.konummer, prioritet: b.prioritet, steg, stegText: STEGTEXT[steg], ledtider: { vantatMin: ledtider(b, nu).vantatMin } };
  if (!full) return bas;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(b.patient_id);
  const tr = b.triage ? JSON.parse(b.triage) : null;
  return {
    id: b.id, ...bas, patientId: b.patient_id, skyddad: Boolean(p?.skyddad), namn: p?.skyddad ? null : visningsnamn(p), personnummer: p?.skyddad ? null : visningsPnr(p),
    kontaktorsak: b.kontaktorsak, ankomst: b.ankomst, ankomstsatt: b.ankomstsatt, prioritetText: b.prioritet ? PRIORITETER[b.prioritet] : 'Inte triagerad',
    triage: tr ? { ...tr, tid: b.triage_tid, av: personKort(db, b.triage_av) } : null, bedomd: b.bedomd_tid ? { tid: b.bedomd_tid, av: personKort(db, b.bedomd_av) } : null,
    beslut: b.beslut, beslutEnhet: enhetKort(db, b.beslut_enhet), aktiviteter: aktiviteter(db, b), ledtider: ledtider(b, nu), registreradAv: personKort(db, b.registrerad_av),
    prehospital: b.prehospital ? JSON.parse(b.prehospital) : null, uppropning: `Nummer ${b.konummer}`,
  };
}

// ---- Tavlan --------------------------------------------------------------------------------------------------------
export function tavla(db, pers, { prioritet = null, steg = null, nu = Date.now() } = {}) {
  if (!kanRoll(pers, 'vantrum')) throw new Fel(403, 'Yrkesrollen ser inte akutmottagningens flöde.', 'nekad');
  const full = arAkut(db, pers);
  let rader = db.query('SELECT * FROM akutbesok WHERE utregistrerad IS NULL').all().map(b => besokUt(db, b, { full, nu }));
  if (prioritet && Object.hasOwn(PRIORITETER, prioritet)) rader = rader.filter(r => r.prioritet === prioritet);
  if (steg) rader = rader.filter(r => r.steg === steg);
  rader.sort((a, b) => (ORDNING[a.prioritet] ?? 9) - (ORDNING[b.prioritet] ?? 9) || (b.ledtider.vantatMin - a.ledtider.vantatMin));
  const forvarningar = full ? db.query('SELECT * FROM akut_forvarningar WHERE mottagen IS NULL ORDER BY beraknad').all().map(f => forvarningUt(db, f)) : [];
  return { tavla: rader, steg: STEG, prioriteter: PRIORITETER, aktiviteter: full ? AKTIVITETER : undefined, forvarningar, full, demoregel: DEMOREGEL };
}

// ---- Ankomst, triage, aktiviteter, bedömning och utregistrering ------------------------------------------------------
function nastaKonummer(db) {
  const n = db.query("SELECT konummer FROM vantrum WHERE konummer LIKE 'A%'").all().map(r => Number(r.konummer.slice(1))).filter(Number.isFinite);
  const max = n.length ? Math.max(...n) : 0;
  return `A${String(max >= 99 ? 1 : max + 1).padStart(2, '0')}`;
}

// Registrerar ankomsten. Ger raden. ger_vardrelation är 0 för en ankomst som personalen registrerar, och 1 för en
// ankomst från ambulansens förvarning, som kommer från en annan part.
export function registreraAnkomst(db, pers, { patientId, kontaktorsak, ankomstsatt = 'egen', prehospital = null, prioritet = null, triageData = null } = {}) {
  const p = typeof patientId === 'string' ? db.query('SELECT * FROM patienter WHERE id = ? AND sammanslagen_till IS NULL').get(patientId) : null;
  if (!p) throw new Fel(400, 'Välj patienten. Saknas personnummer, registrera patienten med reservnummer först.', 'ogiltig', { falt: ['patientId'] });
  const orsak = text(kontaktorsak);
  if (orsak.length < 2) throw new Fel(400, 'Skriv kontaktorsaken, till exempel bröstsmärta eller fotledsskada.', 'ogiltig', { falt: ['kontaktorsak'] });
  if (db.query('SELECT 1 FROM akutbesok WHERE patient_id = ? AND utregistrerad IS NULL').get(p.id)) throw new Fel(400, 'Patienten är redan registrerad på akutmottagningen.', 'ogiltig');
  const t = iso();
  const konummer = nastaKonummer(db);
  const relation = ankomstsatt === 'ambulans' ? 1 : 0;
  const vk = Number(db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, skapad, skapad_av, ger_vardrelation)
    VALUES (?, ?, 'akut', ?, 'Akutmottagningen', ?, 'vardkallan', ?, ?, ?)`).run(p.id, AKUT, t, orsak, t, pers.id, relation).lastInsertRowid);
  const vr = Number(db.query("INSERT INTO vantrum (patient_id, enhet_id, konummer, ankomst, prioritet, orsak) VALUES (?, ?, ?, ?, ?, ?)").run(p.id, AKUT, konummer, t, prioritet ?? 'ej_triagerad', orsak).lastInsertRowid);
  const id = Number(db.query(`INSERT INTO akutbesok (patient_id, enhet_id, vardkontakt_id, vantrum_id, konummer, ankomst, ankomstsatt, kontaktorsak, registrerad_av, prioritet, triage, triage_tid, triage_av, prehospital)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, AKUT, vk, vr, konummer, t, ankomstsatt, orsak, pers.id, prioritet, triageData ? JSON.stringify(triageData) : null,
    triageData ? t : null, triageData ? pers.id : null, prehospital ? JSON.stringify(prehospital) : null).lastInsertRowid);
  logga(db, pers, p.id, 'registrera_vardkontakt', `akut:${id}:ankomst`);
  return besokUt(db, hamta(db, id));
}

// Ger vårdrelation till akutbesöket när en annan person än den som registrerade ankomsten möter patienten.
function bekraftaRelation(db, b, pers) {
  if (b.registrerad_av !== pers.id) db.query('UPDATE vardkontakter SET ger_vardrelation = 1 WHERE id = ?').run(b.vardkontakt_id);
}

const MATT = [['andningsfrekvens', 'andningsfrekvens', 'andetag/min'], ['saturation', 'saturation', '%'], ['puls', 'puls', 'slag/min'], ['temp', 'temp', '°C']];
export function triagera(db, pers, b, body = {}) {
  kravAkut(db, pers, ['lakare', 'sjukskoterska'], b.patient_id, `akut:${b.id}:triage`);
  if (b.utregistrerad) throw new Fel(400, 'Besöket är utregistrerat.', 'ogiltig');
  const v = body.vitaler && typeof body.vitaler === 'object' ? body.vitaler : {};
  const vitaler = Object.fromEntries(['andningsfrekvens', 'saturation', 'syrgas', 'systoliskt', 'diastoliskt', 'puls', 'temp'].map(k => [k, v[k] == null || v[k] === '' ? null : Number(v[k])]).filter(([, x]) => x != null && Number.isFinite(x)));
  if (typeof v.medvetande === 'string') vitaler.medvetande = v.medvetande;
  if (!Object.keys(vitaler).length) throw new Fel(400, 'Mät vitalparametrarna, så räknar systemet prioriteten.', 'ogiltig', { falt: ['vitaler'] });
  const orsak = text(body.kontaktorsak) || b.kontaktorsak;
  const tr = triage({ kontaktorsak: orsak, vitaler });
  const t = iso();
  // Vitalparametrarna sparas som mätvärden på akutbesöket.
  const ins = db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, vardkontakt_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const [k, typ, enhet] of MATT) if (vitaler[k] != null) ins.run(b.patient_id, AKUT, typ, String(vitaler[k]).replace('.', ','), vitaler[k], enhet, t, pers.id, b.vardkontakt_id);
  if (vitaler.systoliskt != null && vitaler.diastoliskt != null) ins.run(b.patient_id, AKUT, 'blodtryck', `${vitaler.systoliskt}/${vitaler.diastoliskt}`, vitaler.systoliskt, 'mmHg', t, pers.id, b.vardkontakt_id);
  db.query('UPDATE akutbesok SET prioritet = ?, triage = ?, triage_tid = ?, triage_av = ?, kontaktorsak = ? WHERE id = ?').run(tr.prioritet, JSON.stringify({ varfor: tr.varfor, news2: tr.news2, prioritetText: tr.prioritetText }), t, pers.id, orsak, b.id);
  if (b.vantrum_id) db.query('UPDATE vantrum SET prioritet = ?, orsak = ? WHERE id = ?').run(tr.prioritet, orsak, b.vantrum_id);
  bekraftaRelation(db, b, pers);
  logga(db, pers, b.patient_id, 'registrera_matvarde', `akut:${b.id}:triage`);
  return besokUt(db, hamta(db, b.id));
}

export function planera(db, pers, b, body = {}) {
  kravAkut(db, pers, ['lakare', 'sjukskoterska'], b.patient_id, `akut:${b.id}:aktivitet`);
  if (b.utregistrerad) throw new Fel(400, 'Besöket är utregistrerat.', 'ogiltig');
  const typ = typeof body.typ === 'string' && Object.hasOwn(AKTIVITETER, body.typ) ? body.typ : null;
  if (!typ) throw new Fel(400, `Välj aktiviteten: ${Object.values(AKTIVITETER).map(x => x.toLowerCase()).join(', ')}.`, 'ogiltig', { falt: ['typ'] });
  const t = iso();
  db.query('INSERT INTO akut_aktiviteter (besok_id, patient_id, enhet_id, typ, text, planerad, planerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)').run(b.id, b.patient_id, AKUT, typ, text(body.text) || AKTIVITETER[typ], t, pers.id);
  logga(db, pers, b.patient_id, 'registrera_vardkontakt', `akut:${b.id}:aktivitet`);
  return besokUt(db, hamta(db, b.id));
}

export function utford(db, pers, b, aktivitetId) {
  kravAkut(db, pers, ['lakare', 'sjukskoterska', 'underskoterska'], b.patient_id, `akut:${b.id}:aktivitet`);
  const a = db.query('SELECT * FROM akut_aktiviteter WHERE id = ? AND besok_id = ?').get(Number(aktivitetId), b.id);
  if (!a) throw new Fel(404, 'Aktiviteten finns inte.', 'saknas');
  if (a.utford) throw new Fel(400, `Aktiviteten är redan utförd av ${personKort(db, a.utford_av)?.namn ?? 'någon annan'}.`, 'ogiltig');
  db.query('UPDATE akut_aktiviteter SET utford = ?, utford_av = ? WHERE id = ?').run(iso(), pers.id, a.id);
  if (a.typ === 'lakarbedomning' && pers.yrke === 'lakare' && !b.bedomd_tid) db.query('UPDATE akutbesok SET bedomd_tid = ?, bedomd_av = ? WHERE id = ?').run(iso(), pers.id, b.id);
  bekraftaRelation(db, b, pers);
  logga(db, pers, b.patient_id, 'registrera_vardkontakt', `akut:${b.id}:aktivitet:${a.id}`);
  return besokUt(db, hamta(db, b.id));
}

export function bedom(db, pers, b) {
  kravAkut(db, pers, ['lakare'], b.patient_id, `akut:${b.id}:bedomning`);
  if (b.utregistrerad) throw new Fel(400, 'Besöket är utregistrerat.', 'ogiltig');
  if (!b.bedomd_tid) db.query('UPDATE akutbesok SET bedomd_tid = ?, bedomd_av = ? WHERE id = ?').run(iso(), pers.id, b.id);
  // Patienten ropas in: väntrummet visar inte längre könumret.
  if (b.vantrum_id) db.query("UPDATE vantrum SET status = 'inne' WHERE id = ?").run(b.vantrum_id);
  bekraftaRelation(db, b, pers);
  logga(db, pers, b.patient_id, 'registrera_vardkontakt', `akut:${b.id}:bedomning`);
  return besokUt(db, hamta(db, b.id));
}

// Beslutet: hem, inläggning på en avdelning eller annan vårdform. Utregistreringen avslutar besöket, och vid inläggning
// skriver systemet in patienten från akutbesöket. Läkaren behöver vårdrelation till patienten för inskrivningen.
function provaBeslut(db, body, b) {
  const beslut = body.beslut ?? b.beslut;
  if (!['hem', 'inlaggning', 'annan'].includes(beslut)) throw new Fel(400, 'Välj beslutet: hem, inläggning eller annan vårdform.', 'ogiltig', { falt: ['beslut'] });
  const enhetId = beslut === 'inlaggning' ? (body.enhetId ?? b.beslut_enhet) : null;
  if (beslut === 'inlaggning') {
    const e = typeof enhetId === 'string' ? db.query("SELECT * FROM enheter WHERE id = ? AND typ = 'arbetsplats'").get(enhetId) : null;
    if (!e) throw new Fel(400, 'Välj avdelningen som patienten ska läggas in på.', 'ogiltig', { falt: ['enhetId'] });
  }
  return { beslut, enhetId };
}
export function besluta(db, pers, b, body = {}) {
  kravAkut(db, pers, ['lakare'], b.patient_id, `akut:${b.id}:beslut`);
  const { beslut, enhetId } = provaBeslut(db, body, b);
  db.query('UPDATE akutbesok SET beslut = ?, beslut_enhet = ?, beslut_tid = ?, beslut_av = ? WHERE id = ?').run(beslut, enhetId, iso(), pers.id, b.id);
  logga(db, pers, b.patient_id, 'registrera_vardkontakt', `akut:${b.id}:beslut`);
  return besokUt(db, hamta(db, b.id));
}
export function utregistrera(db, pers, b, body = {}, valFor = () => ({})) {
  kravAkut(db, pers, ['lakare'], b.patient_id, `akut:${b.id}:utregistrering`);
  if (b.utregistrerad) throw new Fel(400, 'Besöket är redan utregistrerat.', 'ogiltig');
  const { beslut, enhetId } = provaBeslut(db, body, b);
  const t = iso();
  let vt = null;
  if (beslut === 'inlaggning') {
    const atk = new Atkomst(db, pers, b.patient_id, valFor(b.patient_id), 'vardtillfalle');
    const [, ut] = vardkontakt.skrivIn(atk, { enhetId, orsak: b.kontaktorsak });
    vt = ut;
  } else {
    db.query('UPDATE vardkontakter SET slut = ? WHERE id = ? AND slut IS NULL').run(t, b.vardkontakt_id);
  }
  db.query('UPDATE akutbesok SET beslut = ?, beslut_enhet = ?, beslut_tid = coalesce(beslut_tid, ?), beslut_av = coalesce(beslut_av, ?), utregistrerad = ?, utregistrerad_av = ? WHERE id = ?')
    .run(beslut, enhetId, t, pers.id, t, pers.id, b.id);
  if (b.vantrum_id) db.query("UPDATE vantrum SET status = 'klar' WHERE id = ?").run(b.vantrum_id);
  logga(db, pers, b.patient_id, 'registrera_vardkontakt', `akut:${b.id}:utregistrering`);
  return { ...besokUt(db, hamta(db, b.id)), ...(vt ? { vardtillfalle: { id: vt.id, enhet: enhetKort(db, vardenhetFor(db, enhetId)) } } : {}) };
}

// ---- Förvarning från ambulansen (simulerad prehospital tjänst) -------------------------------------------------------
function forvarningUt(db, f) {
  const p = f.patient_id ? db.query('SELECT * FROM patienter WHERE id = ?').get(f.patient_id) : null;
  const forslag = f.forslag ? JSON.parse(f.forslag) : null;
  return {
    id: f.id, fran: PREHOSPITAL, tid: f.tid, beraknad: f.beraknad, kontaktorsak: f.kontaktorsak, vitaler: JSON.parse(f.vitaler), patientId: f.patient_id,
    namn: p ? (p.skyddad ? null : visningsnamn(p)) : null, skyddad: Boolean(p?.skyddad), forslagPrioritet: forslag?.prioritet ?? null, forslag,
  };
}
// Den simulerade ambulansen skickar en förvarning. I demon görs det av akutmottagningens personal i gränssnittet, märkt
// som simulering. Personnumret kopplas till patienten om det finns, och annars registreras patienten vid ankomsten.
export function forvarning(db, pers, body = {}) {
  kravAkut(db, pers, ['lakare', 'sjukskoterska']);
  const orsak = text(body.kontaktorsak);
  if (orsak.length < 2) throw new Fel(400, 'Skriv kontaktorsaken från ambulansen.', 'ogiltig', { falt: ['kontaktorsak'] });
  const pnr = typeof body.personnummer === 'string' ? body.personnummer.replace(/\D/g, '') : '';
  const p = pnr ? db.query('SELECT id FROM patienter WHERE personnummer = ? AND sammanslagen_till IS NULL').get(pnr) : null;
  const min = Math.min(120, Math.max(0, Number(body.minuter) || 10));
  const vitaler = body.vitaler && typeof body.vitaler === 'object' ? body.vitaler : {};
  const v = Object.fromEntries(['andningsfrekvens', 'saturation', 'syrgas', 'systoliskt', 'diastoliskt', 'puls', 'temp'].map(k => [k, vitaler[k] == null ? null : Number(vitaler[k])]).filter(([, x]) => x != null && Number.isFinite(x)));
  if (typeof vitaler.medvetande === 'string') v.medvetande = vitaler.medvetande;
  const tr = triage({ kontaktorsak: orsak, vitaler: v });
  const id = Number(db.query('INSERT INTO akut_forvarningar (enhet_id, tid, patient_id, kontaktorsak, beraknad, vitaler, forslag) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(AKUT, iso(), p?.id ?? null, orsak, new Date(Date.now() + min * 60000).toISOString(), JSON.stringify(v), JSON.stringify(tr)).lastInsertRowid);
  if (p) logga(db, pers, p.id, 'vantrum', `akut:forvarning:${id}`);
  return [201, forvarningUt(db, db.query('SELECT * FROM akut_forvarningar WHERE id = ?').get(id))];
}

// Ankomsten via API:t: från en förvarning eller direkt.
export function ankomst(db, pers, body = {}) {
  kravAkut(db, pers);
  if (body.forvarningId != null) {
    const f = db.query('SELECT * FROM akut_forvarningar WHERE id = ? AND mottagen IS NULL').get(Number(body.forvarningId));
    if (!f) throw new Fel(404, 'Förvarningen finns inte eller är redan mottagen.', 'saknas');
    const pid = f.patient_id ?? body.patientId;
    const tr = JSON.parse(f.forslag);
    const b = registreraAnkomst(db, pers, { patientId: pid, kontaktorsak: f.kontaktorsak, ankomstsatt: 'ambulans', prehospital: { fran: PREHOSPITAL, tid: f.tid, vitaler: JSON.parse(f.vitaler) },
      prioritet: tr.prioritet, triageData: { varfor: [...tr.varfor, 'Prioriteten kommer från ambulansens vitalparametrar.'], news2: tr.news2, prioritetText: tr.prioritetText } });
    db.query('UPDATE akut_forvarningar SET mottagen = ?, besok_id = ?, patient_id = ? WHERE id = ?').run(iso(), b.id, pid, f.id);
    return [201, besokUt(db, hamta(db, b.id))];
  }
  return [201, registreraAnkomst(db, pers, body)];
}

// ---- Ledtider per prioritet, utan patientuppgifter -----------------------------------------------------------------
const MINSTA = 5;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
export function ledtiderPerPrioritet(db, pers, { dagar = 30, nu = Date.now() } = {}) {
  if (!kanRoll(pers, 'statistik') && !arAkut(db, pers)) throw new Fel(403, 'Ledtiderna visas för vårdens personal.', 'nekad');
  const fran = new Date(nu - dagar * 86400_000).toISOString();
  const rader = db.query('SELECT * FROM akutbesok WHERE utregistrerad IS NOT NULL AND ankomst >= ?').all(fran);
  return {
    dagar, minsta: MINSTA, text: `Utregistrerade besök de senaste ${dagar} dagarna. Grupper med färre än ${MINSTA} besök visas inte.`,
    perPrioritet: Object.keys(PRIORITETER).map(prio => {
      const g = rader.filter(r => r.prioritet === prio);
      if (g.length < MINSTA) return { prioritet: prio, prioritetText: PRIORITETER[prio], visas: false };
      const l = g.map(b => ledtider(b, nu));
      const m = (k) => median(l.map(x => x[k]).filter(x => x != null));
      return { prioritet: prio, prioritetText: PRIORITETER[prio], visas: true, antal: g.length, medianTillTriageMin: m('tillTriageMin'), medianTillLakareMin: m('tillLakareMin'), medianVistelseMin: m('vistelseMin') };
    }),
  };
}

// ---- Schema och seed -----------------------------------------------------------------------------------------------
// Seedens väntande patienter (seed/patienter.js VANTRUM) blir akutbesök som sjuksköterskan på akuten har registrerat
// och triagerat, så att tavlan visar dem.
export function sakra(db) {
  const fanns = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'akutbesok'").get();
  db.exec(SCHEMA);
  if (fanns || !db.query("SELECT 1 FROM personal WHERE id = 'ssk-akut'").get()) return;
  for (const v of db.query("SELECT * FROM vantrum WHERE status = 'vantar' AND enhet_id = ?").all(AKUT)) {
    let vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = ? AND enhet_id = ? AND typ = 'akut' AND slut IS NULL ORDER BY start DESC").get(v.patient_id, AKUT)?.id;
    if (!vk) vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, skapad, skapad_av, ger_vardrelation) VALUES (?, ?, 'akut', ?, 'Akutmottagningen', ?, 'vardkallan', ?, 'ssk-akut', 1)")
      .run(v.patient_id, AKUT, v.ankomst, v.orsak, v.ankomst).lastInsertRowid);
    const triageTid = new Date(Date.parse(v.ankomst) + 10 * 60000).toISOString();
    const tr = { varfor: [`Triagerad av sjuksköterskan vid ankomsten: ${PRIORITETER[v.prioritet]?.toLowerCase() ?? v.prioritet}.`], news2: null, prioritetText: PRIORITETER[v.prioritet] };
    db.query(`INSERT INTO akutbesok (patient_id, enhet_id, vardkontakt_id, vantrum_id, konummer, ankomst, kontaktorsak, registrerad_av, prioritet, triage, triage_tid, triage_av)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ssk-akut', ?, ?, ?, 'ssk-akut')`).run(v.patient_id, AKUT, vk, v.id, v.konummer, v.ankomst, v.orsak ?? 'Akut besök', v.prioritet, JSON.stringify(tr), triageTid);
  }
}
