// Runda 14, r4 (Sussa 11.2.1.8): vårdenhetens reservdator för läkemedel, den andra källan när kärnsystemet inte går att nå.
//
// Läskopian i varje persons webbläsare (D4, docs/design.md) har läkemedelsuppgifterna för de patienter personen arbetar
// med, högst fyra minuter gamla när servern slutar svara. Den hjälper inte den vars egen dator också är nere, eller den
// som kommer till arbetet under avbrottet och inte var inloggad när det började. Därför finns en andra källa: en dator på
// vårdenheten, till exempel i läkemedelsrummet, där en sjuksköterska eller läkare öppnar Reservdator för läkemedel och
// låter den vara öppen. Den hämtar själv listan över alla inskrivna patienter på vårdenheten med deras ordinationer och
// dagens doser var fjärde minut, så att den aldrig är äldre än tio minuter när ett avbrott börjar, och visar och skriver
// ut listan också när kärnsystemet inte svarar.
//
// Systemet är experten: ingen behöver komma ihåg att ta ut en reservlista. Listan förnyas av sig själv, säger hur gammal
// den är per patient, och varnar på vanlig svenska när den är äldre än tio minuter.
//
// Behörighet och loggning. Listan byggs med samma funktioner och samma behörighetsprövning som läkemedelslistan och
// administreringen, för den inloggade på reservdatorn och bara för patienter som är inskrivna på personens vårdenhet:
// spärrade vårdenheters ordinationer finns inte med, och skyddad identitet är maskerad som i journalen. Utlämnandet till
// reservdatorn loggas som en period per patient, som läskopian: en rad när patienten kommer med på listan och en rad när
// utlämnandet slutar, med hur många gånger listan förnyades.
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as lakemedel from './lakemedel.js';
import * as administrering from './administrering.js';

export const HANDLING = 'las_lakemedel';
export const INTERVALL_MS = 4 * 60_000;
export const MAX_ALDER_MS = 10 * 60_000;
// Ett utlämnande räknas som slutat när listan inte har förnyats på så lång tid.
export const UPPEHALL_MS = MAX_ALDER_MS;
export const SIMULERAT = 'I demon är reservdatorn en flik i samma webbläsare. I vården är det en egen dator på vårdenheten med egen ström och nätanslutning.';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS reservlista_utlamnanden (
  id INTEGER PRIMARY KEY AUTOINCREMENT, personal_id TEXT NOT NULL, enhet_id TEXT NOT NULL, patient_id TEXT NOT NULL,
  borjade TEXT NOT NULL, senast TEXT NOT NULL, antal INTEGER NOT NULL, slutade TEXT
);
CREATE INDEX IF NOT EXISTS ix_reservlista_oppna ON reservlista_utlamnanden (personal_id, slutade);
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

export const far = (personal) => kanRoll(personal, HANDLING) && (kanRoll(personal, 'ge_lakemedel') || kanRoll(personal, 'ordinera'));

// Patienterna som är inskrivna i slutenvård på vårdenheten eller en av dess arbetsplatser, med platsen.
export function inskrivna(db, vardenhet) {
  const enheter = db.query("SELECT id FROM enheter WHERE id = ? OR (forald_id = ? AND typ = 'arbetsplats')").all(vardenhet, vardenhet).map(r => r.id);
  const ph = enheter.map(() => '?').join(', ');
  return db.query(`SELECT v.patient_id, v.plats, v.start FROM vardkontakter v JOIN patienter p ON p.id = v.patient_id
    WHERE v.enhet_id IN (${ph}) AND v.typ = 'slutenvard' AND v.slut IS NULL AND p.sammanslagen_till IS NULL AND p.journal_forstord IS NULL ORDER BY v.plats, v.patient_id`).all(...enheter);
}

const lmNamn = (l) => (l ? [l.namn, l.styrka].filter(Boolean).join(' ') : 'Läkemedel');

// Det som en patient har på listan: aktuella ordinationer och dagens doser, ur samma svar som de vanliga anropen.
function patientDel(atk, p, plats, nu) {
  const lm = lakemedel.lista(atk);
  const adm = administrering.lista(atk);
  return {
    id: p.id, namn: visningsnamn(p, atk.val.visa_identitet), personnummer: visningsPnr(p, atk.val.visa_identitet), skyddad: Boolean(p.skyddad), plats, tid: iso(nu),
    ordinationer: lm.ordinationer.filter(o => o.aktuell).map(o => ({ id: o.id, lakemedel: lmNamn(o.lakemedel), dosering: o.dosering, tider: o.tider, vidBehov: o.vidBehov,
      orsak: o.ordinationsorsak, vardenhet: o.vardenhet?.namn ?? null })),
    doser: adm.doser.map(d => ({ ordinationId: d.ordinationId ?? null, lakemedel: lmNamn(d.lakemedel), planerad: d.planerad, status: d.status,
      given: d.administrering && d.administrering.status !== 'iordningstalld' ? { tid: d.administrering.tid ?? null, status: d.administrering.status } : null })),
    senaste: adm.senaste.slice(0, 10).map(a => ({ lakemedel: lmNamn(a.lakemedel), tid: a.tid ?? a.registrerad, status: a.status })),
    ejInskriven: Boolean(adm.ejInskriven),
  };
}

// Perioden för utlämnandet till reservdatorn, per person och patient. Loggar början och slut, och räknar förnyelserna.
function loggaPerioder(db, personal, ve, pids, nu) {
  sakra(db);
  const t = iso(nu);
  const oppna = new Map(db.query('SELECT * FROM reservlista_utlamnanden WHERE personal_id = ? AND slutade IS NULL').all(personal.id).map(r => [r.patient_id, r]));
  const slut = (r, orsak) => {
    db.query('UPDATE reservlista_utlamnanden SET slutade = ? WHERE id = ?').run(r.senast, r.id);
    loggaRad(db, { tid: r.senast, personal_id: personal.id, enhet_id: r.enhet_id, patient_id: r.patient_id, handling: HANDLING, resurs: 'reservlista:slut', grund: 'vardrelation',
      syfte: `Utlämnandet till vårdenhetens reservdator slutade (${orsak}). Listan förnyades ${r.antal} ${r.antal === 1 ? 'gång' : 'gånger'}.`, resultat: 'tillaten' });
  };
  for (const [pid, r] of oppna) {
    if (!pids.has(pid)) { slut(r, 'patienten finns inte längre på listan'); oppna.delete(pid); }
    else if (nu.getTime() - Date.parse(r.senast) > UPPEHALL_MS) { slut(r, 'reservdatorn slutade förnya listan'); oppna.delete(pid); }
  }
  for (const pid of pids) {
    const r = oppna.get(pid);
    if (r) { db.query('UPDATE reservlista_utlamnanden SET senast = ?, antal = antal + 1 WHERE id = ?').run(t, r.id); continue; }
    db.query('INSERT INTO reservlista_utlamnanden (personal_id, enhet_id, patient_id, borjade, senast, antal) VALUES (?, ?, ?, ?, ?, 1)').run(personal.id, ve, pid, t, t);
    loggaRad(db, { tid: t, personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: HANDLING, resurs: 'reservlista', grund: 'vardrelation',
      syfte: 'Läkemedelsuppgifterna lämnades ut till vårdenhetens reservdator, som förnyar listan var fjärde minut medan den är öppen.', resultat: 'tillaten' });
  }
}

// GET /api/reservlista: listan för reservdatorn på den inloggades vårdenhet.
export function lista(db, personal, valFor, nu = new Date()) {
  if (!far(personal)) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: HANDLING, resurs: 'reservlista', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Reservdatorn för läkemedel används av sjuksköterskor och läkare på vårdenheten.', 'nekad');
  }
  const ve = vardenhetFor(db, personal.enhet_id);
  const patienter = [];
  for (const r of inskrivna(db, ve)) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
    const atk = new Atkomst(db, personal, p.id, valFor(p.id), HANDLING);
    if (!atk.prova(HANDLING).tillaten) continue;
    patienter.push(patientDel(atk, p, r.plats, nu));
  }
  loggaPerioder(db, personal, ve, new Set(patienter.map(p => p.id)), nu);
  const enhet = db.query('SELECT id, namn FROM enheter WHERE id = ?').get(ve);
  return {
    vardenhet: enhet, skapad: iso(nu), fornyas: { intervallMs: INTERVALL_MS, maxAlderMs: MAX_ALDER_MS }, patienter, simulerat: SIMULERAT,
    text: 'Listan förnyas av sig själv var fjärde minut medan sidan är öppen. Svarar inte kärnsystemet visas den senaste listan med sin ålder, och den kan skrivas ut.',
  };
}
