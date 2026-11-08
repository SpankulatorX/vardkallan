// Ombud med fullmakt i Min journal (runda 10, r7, Sussa 3.4.2.3 och 3.7.1.1). Patienten ger en annan person fullmakt
// i Min journal, eller vården registrerar en skriftlig fullmakt som patienten har lämnat. Ombudet loggar in med sin egen
// simulerade e-legitimation och kan då boka, boka om och avboka patientens tider och skriva meddelanden till vården för
// patienten, men aldrig läsa journalen. Varje anrop prövas mot en giltig fullmakt och loggas på patienten med grunden
// ombud, så att patienten ser vad ombudet har gjort i sin logglista.
//
// Systemet är experten: fullmakten gäller det som ett ombud brukar behöva (tider och meddelanden) i tolv månader
// (demoregel), patienten skriver bara ombudets personnummer, och systemet säger på vanlig svenska varför något inte går.
import { Fel, iso, idag, addDagar, datumAv } from './db.js';
import { alder, kanRoll, formateraPnr, vardenhetFor, maskeraPnr, SKYDDAD_NAMN } from './atkomst.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS fullmakter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, ombud_id TEXT NOT NULL, omfattning TEXT NOT NULL, giltig_till TEXT NOT NULL,
  registrerad TEXT NOT NULL, registrerad_av TEXT, registrerad_av_invanare TEXT, registrerad_enhet TEXT, kalla TEXT NOT NULL,
  aterkallad TEXT, aterkallad_av TEXT, aterkallad_av_invanare TEXT,
  CHECK (kalla IN ('min_journal', 'vard'))
);
CREATE INDEX IF NOT EXISTS ix_fullmakter_ombud ON fullmakter (ombud_id);
CREATE TRIGGER IF NOT EXISTS fullmakt_andras_ej BEFORE UPDATE OF ombud_id, omfattning, giltig_till, registrerad, registrerad_av, registrerad_av_invanare, kalla ON fullmakter
  BEGIN SELECT RAISE(ABORT, 'En fullmakt ändras inte. Den återkallas och en ny ges.'); END;
CREATE TRIGGER IF NOT EXISTS fullmakt_raderas_ej BEFORE DELETE ON fullmakter BEGIN SELECT RAISE(ABORT, 'En fullmakt raderas inte'); END;
`;

// Vad en fullmakt kan gälla. Journalen ingår aldrig: ett ombud läser inte patientens journal i Min journal.
export const OMFATTNING = { tider: 'Boka, boka om och avboka tider', meddelanden: 'Skriva meddelanden till vården och läsa svaren' };
export const DEMOREGLER = { giltigManader: 12, ombudFranAlder: 18, geFranAlder: 18, maxPerPatient: 3,
  text: 'Demoregler: en fullmakt gäller i tolv månader och kan återkallas när som helst. Ombudet ska vara minst 18 år, och den som ger fullmakten också. En patient kan ha högst tre ombud samtidigt.' };

// Resurserna i Min journal som ett ombud når, och vilken del av fullmakten som krävs. null betyder att alla
// fullmakter räcker (huvudet med patientens namn och ombudets egna fullmakter).
const RESURSER = [
  [/^min:journal$/, null],
  [/^min:ombud(:\d+)?$/, null],
  [/^min:(tider|boka|boka:forslag|bokning:\d+|bokning:\d+:forslag|kallelse-ram:\d+|kallelse-ram:\d+:forslag|kallelse:\d+(:\w+)?)$/, 'tider'],
  [/^min:meddelanden(:\d+)?(:svar)?$/, 'meddelanden'],
];
export const kravsFor = (resurs) => { const r = RESURSER.find(([re]) => re.test(String(resurs ?? ''))); return r ? { del: r[1] } : null; };

export const sakra = (db) => db.exec(SCHEMA);
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'fullmakter'").get());
const omfattningAv = (f) => JSON.parse(f.omfattning);
const namnAv = (x) => `${x.fornamn} ${x.efternamn}`;
const invanareRad = (db, id) => (typeof id === 'string' ? db.query('SELECT * FROM invanare WHERE id = ?').get(id) ?? null : null);
const patientRad = (db, id) => (typeof id === 'string' ? db.query('SELECT * FROM patienter WHERE id = ?').get(id) ?? null : null);

export function aktiv(f, dag = idag()) { return Boolean(f) && !f.aterkallad && f.giltig_till >= dag; }

// Den giltiga fullmakten som ger invånaren rätt att göra resursen för patienten, eller null.
export function fullmaktFor(db, invanare, patientId, resurs, dag = idag()) {
  if (!finns(db) || !invanare || typeof patientId !== 'string') return null;
  const k = kravsFor(resurs);
  const rader = db.query('SELECT * FROM fullmakter WHERE ombud_id = ? AND patient_id = ? AND aterkallad IS NULL ORDER BY id DESC').all(invanare.id, patientId).filter(f => aktiv(f, dag));
  const f = rader[0] ?? null;
  if (!f) return null;
  return { fullmakt: f, tillaten: Boolean(k) && (k.del === null || omfattningAv(f).includes(k.del)) };
}

// Runda 10, r7 (säkerhetsgranskningen): en person med skyddade personuppgifter, eller som är kopplad till en sådan
// patient, visas aldrig med namn eller fullt personnummer, varken som ombud eller som patient.
function skyddadInvanare(db, inv) {
  if (!inv) return false;
  if (inv.patient_id && patientRad(db, inv.patient_id)?.skyddad) return true;
  return Boolean(db.query('SELECT 1 FROM vardnadshavare v JOIN patienter p ON p.id = v.barn_id WHERE v.invanare_id = ? AND p.skyddad = 1').get(inv.id));
}
const personUt = (db, inv) => (skyddadInvanare(db, inv) ? { namn: SKYDDAD_NAMN, personnummer: maskeraPnr(inv.personnummer) } : { namn: namnAv(inv), personnummer: formateraPnr(inv.personnummer) });

const fullmaktUt = (db, f, { forPatient = false } = {}) => {
  const o = invanareRad(db, f.ombud_id);
  const p = patientRad(db, f.patient_id);
  return {
    id: f.id, omfattning: omfattningAv(f).map(x => ({ id: x, text: OMFATTNING[x] })), giltigTill: f.giltig_till, registrerad: f.registrerad,
    kalla: f.kalla, kallaText: f.kalla === 'vard' ? 'Registrerad av vården efter en skriftlig fullmakt' : 'Given i Min journal',
    aktiv: aktiv(f), aterkallad: f.aterkallad,
    ...(forPatient ? { ombud: o ? personUt(db, o) : null } : { patient: p ? { id: p.id, namn: p.skyddad ? SKYDDAD_NAMN : namnAv(p) } : null }),
  };
};

// För invånarens session: patienterna som invånaren är ombud för just nu.
export function ombudFor(db, inv, dag = idag()) {
  if (!finns(db) || !inv) return [];
  return db.query('SELECT * FROM fullmakter WHERE ombud_id = ? AND aterkallad IS NULL ORDER BY id').all(inv.id).filter(f => aktiv(f, dag)).map(f => {
    const p = patientRad(db, f.patient_id);
    return p ? { patientId: p.id, namn: p.skyddad ? SKYDDAD_NAMN : namnAv(p), alder: alder(p.fodd, dag), relation: 'ombud', omfattning: omfattningAv(f), giltigTill: f.giltig_till } : null;
  }).filter(Boolean);
}

// GET /api/min/journal/:id/ombud: fullmakterna som patienten har gett, och för ett ombud den egna fullmakten.
export function minLista(atk) {
  const db = atk.db;
  if (atk.relation === 'ombud') return { relation: 'ombud', egen: fullmaktUt(db, atk.fullmakt, { forPatient: false }), demoregler: DEMOREGLER.text };
  const rader = db.query('SELECT * FROM fullmakter WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId);
  return {
    relation: atk.relation, kanGe: atk.relation === 'egen' && alder(atk.patient.fodd, idag()) >= DEMOREGLER.geFranAlder,
    varforInte: atk.relation !== 'egen' ? 'Bara patienten själv kan ge en fullmakt.' : alder(atk.patient.fodd, idag()) < DEMOREGLER.geFranAlder ? `Du kan ge en fullmakt från ${DEMOREGLER.geFranAlder} års ålder.` : null,
    fullmakter: rader.map(f => fullmaktUt(db, f, { forPatient: true })), omfattning: Object.entries(OMFATTNING).map(([id, text]) => ({ id, text })),
    demoregler: DEMOREGLER.text,
  };
}

const siffror = (s) => String(s ?? '').replace(/\D/g, '');
// Samma svar för invånaren i alla fall där fullmakten inte kan registreras i Min journal, så att funktionen inte blir ett
// uppslag från personnummer till person: personen finns inte, är för ung, har eller är kopplad till skyddade
// personuppgifter, eller patienten själv har skyddade personuppgifter. Personalen får det exakta skälet.
export const KAN_INTE = 'Fullmakten kan inte registreras här. Kontrollera personnumret. Går det ändå inte kan din vårdenhet hjälpa dig att registrera fullmakten.';
export const MAX_FORSOK = 10;
export const MAX_FORSOK_SESSION = 30;
class KanInte extends Fel { constructor() { super(400, KAN_INTE, 'ogiltig', { falt: ['personnummer'] }); } }

function kontrolleraOmbud(db, patient, personnummer, { invanare = false } = {}) {
  const pnr = siffror(personnummer);
  if (pnr.length !== 12) throw new Fel(400, 'Skriv ombudets personnummer med tolv siffror, till exempel 19770123-2386.', 'ogiltig', { falt: ['personnummer'] });
  const o = db.query('SELECT * FROM invanare WHERE personnummer = ?').get(pnr);
  if (invanare && (!o || patient.skyddad || skyddadInvanare(db, o) || alder(o.fodd, idag()) < DEMOREGLER.ombudFranAlder)) throw new KanInte();
  if (!o) throw new Fel(400, 'Vi hittar ingen person med det personnumret bland demons påhittade personer. I demon kan bara de vara ombud.', 'ogiltig', { falt: ['personnummer'] });
  if (o.patient_id === patient.id) throw new Fel(400, 'Du kan inte ge fullmakt till dig själv.', 'ogiltig', { falt: ['personnummer'] });
  if (alder(o.fodd, idag()) < DEMOREGLER.ombudFranAlder) throw new Fel(400, `Ett ombud ska vara minst ${DEMOREGLER.ombudFranAlder} år.`, 'ogiltig', { falt: ['personnummer'] });
  const aktiva = db.query('SELECT * FROM fullmakter WHERE patient_id = ? AND aterkallad IS NULL').all(patient.id).filter(f => aktiv(f));
  if (aktiva.some(f => f.ombud_id === o.id)) throw new Fel(400, 'Personen har redan en giltig fullmakt för dig.', 'ogiltig');
  if (aktiva.length >= DEMOREGLER.maxPerPatient) throw new Fel(400, `Du kan ha högst ${DEMOREGLER.maxPerPatient} ombud samtidigt. Återkalla en fullmakt först.`, 'ogiltig');
  return o;
}
function omfattningIn(v) {
  if (v == null) return Object.keys(OMFATTNING);
  if (!Array.isArray(v) || !v.length || v.some(x => !Object.hasOwn(OMFATTNING, x))) throw new Fel(400, 'Välj vad fullmakten ska gälla.', 'ogiltig', { falt: ['omfattning'] });
  return Object.keys(OMFATTNING).filter(x => v.includes(x));
}
function infoga(db, { patient, ombud, omfattning, kalla, av = null, avInvanare = null, enhet = null, nu = new Date() }) {
  const giltig = addDagar(datumAv(nu), 365);
  const id = Number(db.query(`INSERT INTO fullmakter (patient_id, ombud_id, omfattning, giltig_till, registrerad, registrerad_av, registrerad_av_invanare, registrerad_enhet, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(patient.id, ombud.id, JSON.stringify(omfattning), giltig, iso(nu), av, avInvanare, enhet, kalla).lastInsertRowid);
  return db.query('SELECT * FROM fullmakter WHERE id = ?').get(id);
}

// POST /api/min/journal/:id/ombud { personnummer, omfattning? }: patienten ger fullmakt i Min journal.
export function minGe(atk, body = {}) {
  const db = atk.db;
  if (atk.relation !== 'egen') throw new Fel(403, 'Bara patienten själv kan ge en fullmakt.', 'nekad');
  if (alder(atk.patient.fodd, idag()) < DEMOREGLER.geFranAlder) throw new Fel(403, `Du kan ge en fullmakt från ${DEMOREGLER.geFranAlder} års ålder.`, 'nekad');
  // Tak för misslyckade försök per invånare och per sandlåda. Försöken räknas ur loggen, så de gäller också efter en
  // ny inloggning.
  const misslyckade = (villkor, ...arg) => db.query(`SELECT count(*) AS n FROM atkomstlogg WHERE resurs = 'min:ombud:nekad' AND resultat = 'nekad' ${villkor}`).get(...arg).n;
  if (misslyckade('AND invanare_id = ?', atk.invanare.id) >= MAX_FORSOK || misslyckade('') >= MAX_FORSOK_SESSION) {
    throw new Fel(429, 'Du har gjort många försök att registrera en fullmakt. Fler försök stoppas. Din vårdenhet kan hjälpa dig.', 'for_manga');
  }
  let ombud;
  try { ombud = kontrolleraOmbud(db, atk.patient, body.personnummer, { invanare: true }); } catch (e) {
    if (e instanceof KanInte) atk.logga('min:ombud:nekad', { handling: 'invanare_fullmakt', resultat: 'nekad' });
    throw e;
  }
  const f = infoga(db, { patient: atk.patient, ombud, omfattning: omfattningIn(body.omfattning), kalla: 'min_journal', avInvanare: atk.invanare.id });
  atk.logga(`min:ombud:${f.id}`, { handling: 'invanare_fullmakt' });
  // Svaret visar inte namnet på den som patienten angav, bara personnumret maskerat. Namnet står i listan över fullmakter.
  const maskerat = maskeraPnr(ombud.personnummer);
  return [201, { fullmakt: { ...fullmaktUt(db, f, { forPatient: true }), ombud: { personnummer: maskerat } }, text: `Fullmakten till ${maskerat} gäller till och med ${f.giltig_till}. Ombudet kan logga in med sin e-legitimation och se dina tider och meddelanden, men inte läsa din journal.` }];
}

// POST /api/min/journal/:id/ombud/:fid/aterkalla: patienten återkallar, eller ombudet avsäger sig fullmakten.
export function minAterkalla(atk, fid) {
  const db = atk.db;
  const f = db.query('SELECT * FROM fullmakter WHERE id = ? AND patient_id = ?').get(Number(fid) || 0, atk.patientId);
  if (!f || (atk.relation === 'ombud' && f.ombud_id !== atk.invanare.id) || !['egen', 'ombud'].includes(atk.relation)) throw new Fel(404, 'Fullmakten finns inte.', 'saknas');
  if (f.aterkallad) throw new Fel(400, 'Fullmakten är redan återkallad.', 'ogiltig');
  db.query('UPDATE fullmakter SET aterkallad = ?, aterkallad_av_invanare = ? WHERE id = ?').run(iso(), atk.invanare.id, f.id);
  atk.logga(`min:ombud:${f.id}:aterkallad`, { handling: 'invanare_fullmakt' });
  return { fullmakt: fullmaktUt(db, db.query('SELECT * FROM fullmakter WHERE id = ?').get(f.id), { forPatient: atk.relation === 'egen' }) };
}

// Vårdens del: patientens fullmakter i översikten, och en skriftlig fullmakt som vårdadministratören registrerar.
export function vardLista(atk) {
  atk.krav(kanRoll(atk.personal, 'fullmakt') ? 'fullmakt' : 'las_admin');
  const db = atk.db;
  const rader = finns(db) ? db.query('SELECT * FROM fullmakter WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId) : [];
  return { fullmakter: rader.map(f => fullmaktUt(db, f, { forPatient: true })), kanRegistrera: kanRoll(atk.personal, 'fullmakt'), omfattning: Object.entries(OMFATTNING).map(([id, text]) => ({ id, text })), demoregler: DEMOREGLER.text };
}

export function vardRegistrera(atk, p, body = {}) {
  atk.krav('fullmakt');
  const db = atk.db;
  if (body.skriftlig !== true) throw new Fel(400, 'En fullmakt registreras bara när patienten har lämnat en skriftlig och undertecknad fullmakt.', 'ogiltig', { falt: ['skriftlig'] });
  if (alder(p.fodd, idag()) < DEMOREGLER.geFranAlder) throw new Fel(400, `Patienten kan ge en fullmakt från ${DEMOREGLER.geFranAlder} års ålder. För ett barn är vårdnadshavaren ombud.`, 'ogiltig');
  const ombud = kontrolleraOmbud(db, p, body.personnummer);
  const f = infoga(db, { patient: p, ombud, omfattning: omfattningIn(body.omfattning), kalla: 'vard', av: atk.personal.id, enhet: vardenhetFor(db, atk.personal.enhet_id) });
  atk.logga('fullmakt', atk.grund(), `fullmakt:${f.id}`);
  return [201, { fullmakt: fullmaktUt(db, f, { forPatient: true }) }];
}

export function vardAterkalla(atk, p, fid) {
  atk.krav('fullmakt');
  const db = atk.db;
  const f = db.query('SELECT * FROM fullmakter WHERE id = ? AND patient_id = ?').get(Number(fid) || 0, p.id);
  if (!f) throw new Fel(404, 'Fullmakten finns inte.', 'saknas');
  if (f.aterkallad) throw new Fel(400, 'Fullmakten är redan återkallad.', 'ogiltig');
  db.query('UPDATE fullmakter SET aterkallad = ?, aterkallad_av = ? WHERE id = ?').run(iso(), atk.personal.id, f.id);
  atk.logga('fullmakt', atk.grund(), `fullmakt:${f.id}:aterkallad`);
  return { fullmakt: fullmaktUt(db, db.query('SELECT * FROM fullmakter WHERE id = ?').get(f.id), { forPatient: true }) };
}

// Seeden: Karin Åkesson (påhittad, testpersonnummer) är ombud för Gunnar Åkesson med en fullmakt som han gav i Min
// journal för en månad sedan.
export const OMBUD_SEED = { id: 'inv-om01', pnr: '197701232386', fornamn: 'Karin', efternamn: 'Åkesson', patient: 'p01' };
export function seeda(db, bas = new Date()) {
  sakra(db);
  const o = OMBUD_SEED;
  if (!db.query('SELECT 1 FROM invanare WHERE id = ?').get(o.id) && !db.query('SELECT 1 FROM invanare WHERE personnummer = ?').get(o.pnr)) {
    db.query('INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES (?, ?, ?, ?, ?, NULL)')
      .run(o.id, o.pnr, o.fornamn, o.efternamn, `${o.pnr.slice(0, 4)}-${o.pnr.slice(4, 6)}-${o.pnr.slice(6, 8)}`);
  }
  const p = patientRad(db, o.patient);
  if (!p || db.query('SELECT 1 FROM fullmakter WHERE ombud_id = ?').get(o.id)) return;
  infoga(db, { patient: p, ombud: invanareRad(db, o.id), omfattning: Object.keys(OMFATTNING), kalla: 'min_journal', avInvanare: `inv-${p.id}`, nu: new Date(bas.getTime() - 30 * 86400_000) });
}
