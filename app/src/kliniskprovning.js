// Klinisk läkemedelsprövning (runda 9, r1, Sussa 3.5.5.1): prövningar med studienummer, ansvarig prövare och
// prövningsläkemedel, studiedeltagande som uppmärksamhetsinformation, varningar vid ordination och en lista per studie
// för prövaren.
//
// Systemet är experten. När en prövare inkluderar en patient registrerar systemet själv uppmärksamhetsinformationen
// (medicinsk behandling), så att alla som öppnar journalen ser att patienten deltar, med studienummer och ansvarig
// prövare. Vid varje ordination prövar systemet om läkemedlet är ett prövningsläkemedel som bara får ges till studiens
// deltagare, och om ett annat läkemedel inte får ges samtidigt enligt studieprotokollet, och förklarar vem som ska
// kontaktas. Prövningsläkemedlet ordineras, iordningsställs och ges med samma kontroller och historik som andra
// läkemedel. Prövaren ser studiens deltagare med ordinationer och givna doser utan att leta.
//
// Behörighet. Bara en prövare i studien, på den prövande vårdenheten och med vårdrelation, inkluderar och avslutar.
// Deltagandet visas för den som läser patientens översikt, men inte när det är registrerat på en spärrad vårdenhet, och
// en dold registrering ger ingen varning som röjer den. Prövarens lista loggas per patient.
import { Fel, iso, idag } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, visningsnamn, visningsPnr } from './atkomst.js';

export const DEMOREGEL_PROVNING = 'Studien, studieprotokollets förbjudna läkemedel och prövningsläkemedlet är påhittade demoposter.';
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

export function provningUt(db, p) {
  const lm = katalog(db, p.lakemedel_id);
  return {
    id: p.id, studienummer: p.studienummer, titel: p.titel, sponsor: p.sponsor, vardenhet: { id: p.enhet_id, namn: enhetsnamn(db, p.enhet_id) },
    ansvarig: { id: p.ansvarig, namn: personNamn(db, p.ansvarig) }, provare: JSON.parse(p.provare).map(id => ({ id, namn: personNamn(db, id) })),
    lakemedel: lm ? { id: lm.id, namn: lm.namn, styrka: lm.styrka } : null, forbjudna: JSON.parse(p.forbjudna), start: p.start, slut: p.slut,
  };
}
const provningRad = (db, id) => db.query('SELECT * FROM kliniska_provningar WHERE id = ?').get(id);

// Patientens deltaganden som användaren får se: inte från en spärrad vårdenhet.
export function synligaDeltaganden(atk) {
  if (!kanRoll(atk.personal, 'las_oversikt')) return [];
  const rader = atk.db.query('SELECT * FROM studiedeltagande WHERE patient_id = ? ORDER BY inkluderad DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_oversikt', { gemensam: true });
}
function deltagandeUt(db, d) {
  return { id: d.id, provning: provningUt(db, provningRad(db, d.provning_id)), inkluderad: d.inkluderad, inkluderadAv: personNamn(db, d.inkluderad_av),
    randomiseringskod: d.randomiseringskod, aktiv: !d.avslutad, avslutad: d.avslutad ? { tid: d.avslutad, av: personNamn(db, d.avslutad_av), orsak: d.avslutad_orsak } : null };
}

// Varningar vid ordination ur det som användaren får se. studier är synligaDeltaganden(atk).
export function varningar(db, lm, studier) {
  const ut = [];
  const aktiva = studier.filter(d => !d.avslutad).map(d => ({ d, p: provningRad(db, d.provning_id) }));
  const provning = db.query('SELECT * FROM kliniska_provningar WHERE lakemedel_id = ?').get(lm.id);
  if (provning && !aktiva.some(x => x.p.id === provning.id)) {
    ut.push({ niva: 'allvarlig', regel: 'utanfor_studie', text: `${lm.namn} är prövningsläkemedel i klinisk prövning ${provning.studienummer} och får bara ordineras till studiens deltagare. Kontakta ansvarig prövare ${personNamn(db, provning.ansvarig)}.` });
  }
  for (const { p } of aktiva) {
    const f = JSON.parse(p.forbjudna).find(x => lm.atc?.startsWith(x.atc));
    if (f && p.lakemedel_id !== lm.id) ut.push({ niva: 'allvarlig', regel: 'studie_interaktion', text: `Patienten deltar i klinisk prövning ${p.studienummer}. Enligt studieprotokollet ges inte ${f.text} (${f.atc}) samtidigt med prövningsläkemedlet. Kontakta ansvarig prövare ${personNamn(db, p.ansvarig)} innan ${lm.namn} ordineras.` });
  }
  return ut;
}

// Prövningarna där användaren är prövare, på den egna vårdenheten.
const egnaProvningar = (db, personal) => db.query('SELECT * FROM kliniska_provningar ORDER BY studienummer').all()
  .filter(p => JSON.parse(p.provare).includes(personal.id) && vardenhetFor(db, p.enhet_id) === vardenhetFor(db, personal.enhet_id) && p.slut >= idag());

// GET /api/patient/:id/provningar: deltagandena och vilka prövningar användaren kan inkludera patienten i.
export function forPatient(atk) {
  atk.krav('las_oversikt');
  const db = atk.db;
  const delt = synligaDeltaganden(atk);
  const kan = kanRoll(atk.personal, 'ordinera') && atk.prova('ordinera').tillaten && atk.prova('ordinera').grund !== 'nodatkomst';
  const aktiva = new Set(delt.filter(d => !d.avslutad).map(d => d.provning_id));
  return { deltaganden: delt.map(d => deltagandeUt(db, d)), kanInkludera: kan ? egnaProvningar(db, atk.personal).filter(p => !aktiva.has(p.id)).map(p => provningUt(db, p)) : [], demoregel: DEMOREGEL_PROVNING };
}

function kravProvare(atk, p, beskrivning) {
  const r = atk.krav('ordinera', { beskrivning });
  if (r.grund === 'nodatkomst' || r.grund === 'aktivt_val' || !JSON.parse(p.provare).includes(atk.personal.id) || vardenhetFor(atk.db, p.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga('ordinera', 'nekad', beskrivning, 'nekad');
    throw new Fel(403, `Bara en prövare i ${p.studienummer} på ${enhetsnamn(atk.db, p.enhet_id)} inkluderar och avslutar deltagare. Ansvarig prövare är ${personNamn(atk.db, p.ansvarig)}.`, 'nekad');
  }
}

// POST /api/patient/:id/provningar { provningId, randomiseringskod? }. Systemet registrerar uppmärksamhetsinformationen.
export function inkludera(atk, inp = {}) {
  const db = atk.db;
  const p = provningRad(db, Number(inp.provningId));
  if (!p) throw new Fel(404, 'Prövningen finns inte.', 'saknas');
  kravProvare(atk, p, `provning:${p.id}:inkludera`);
  if (p.slut < idag()) throw new Fel(400, `Prövningen ${p.studienummer} avslutades ${p.slut}.`, 'ogiltig');
  if (db.query('SELECT 1 FROM studiedeltagande WHERE provning_id = ? AND patient_id = ? AND avslutad IS NULL').get(p.id, atk.patientId)) throw new Fel(400, `Patienten deltar redan i ${p.studienummer}.`, 'ogiltig');
  const kod = typeof inp.randomiseringskod === 'string' ? inp.randomiseringskod.trim().slice(0, 30) : '';
  const nu = iso();
  const id = Number(db.query('INSERT INTO studiedeltagande (provning_id, patient_id, enhet_id, inkluderad, inkluderad_av, randomiseringskod) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.patientId, atk.personal.enhet_id, nu, atk.personal.id, kod || null).lastInsertRowid);
  // Uppmärksamhetsinformationen: medicinsk behandling, med studien som källa.
  db.query(`INSERT INTO uppmarksamhet (patient_id, enhet_id, kategori, undergrupp, term, motivering, kalla_typ, kalla_id, regel, status, registrerad, registrerad_av, registrerad_enhet)
    VALUES (?, ?, 'medicinskt', 'behandling', ?, ?, 'provning', ?, 'klinisk-provning', 'aktiv', ?, ?, ?)`)
    .run(atk.patientId, atk.personal.enhet_id, `Deltar i klinisk prövning ${p.studienummer}`, `${p.titel}. Ansvarig prövare ${personNamn(db, p.ansvarig)}, ${enhetsnamn(db, p.enhet_id)}.`, id, nu, atk.personal.id, atk.personal.enhet_id);
  atk.logga('ordinera', atk.grund(), `provning:${p.id}:inkludera`);
  return { deltagande: deltagandeUt(db, db.query('SELECT * FROM studiedeltagande WHERE id = ?').get(id)) };
}

export function hamtaDeltagande(db, id) {
  const d = db.query('SELECT * FROM studiedeltagande WHERE id = ?').get(Number(id));
  if (!d) throw new Fel(404, 'Deltagandet finns inte.', 'saknas');
  return d;
}
// POST /api/studiedeltagande/:id/avsluta { orsak }. Uppmärksamhetsinformationen avslutas med samma orsak.
export function avsluta(atk, d, inp = {}) {
  const db = atk.db;
  if (!synligaDeltaganden(atk).some(x => x.id === d.id)) throw new Fel(404, 'Deltagandet finns inte.', 'saknas');
  const p = provningRad(db, d.provning_id);
  kravProvare(atk, p, `provning:${p.id}:avsluta`);
  if (d.avslutad) throw new Fel(400, 'Deltagandet är redan avslutat.', 'ogiltig');
  const orsak = typeof inp.orsak === 'string' ? inp.orsak.trim().slice(0, 300) : '';
  if (orsak.length < 3) throw new Fel(400, 'Ange varför deltagandet avslutas, med minst tre tecken.', 'ogiltig', { falt: ['orsak'] });
  const nu = iso();
  db.query('UPDATE studiedeltagande SET avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ?').run(nu, atk.personal.id, orsak, d.id);
  db.query("UPDATE uppmarksamhet SET status = 'avslutad', avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE kalla_typ = 'provning' AND kalla_id = ? AND status = 'aktiv'").run(nu, atk.personal.id, orsak, d.id);
  atk.logga('ordinera', atk.grund(), `provning:${p.id}:avsluta`);
  return { deltagande: deltagandeUt(db, db.query('SELECT * FROM studiedeltagande WHERE id = ?').get(d.id)) };
}

// GET /api/provningar: prövarens studier med deltagare, ordinationer av prövningsläkemedlet och givna doser. Varje
// patient som visas loggas, och bara patienter som prövaren får se tas med.
export function forProvare(db, personal, valFor = () => ({})) {
  if (!kanRoll(personal, 'ordinera')) throw new Fel(403, 'Listan över kliniska prövningar är för prövarna.', 'nekad');
  return {
    provningar: egnaProvningar(db, personal).map(p => {
      const deltagare = [];
      for (const d of db.query('SELECT * FROM studiedeltagande WHERE provning_id = ? ORDER BY inkluderad').all(p.id)) {
        const atk = new Atkomst(db, personal, d.patient_id, valFor(d.patient_id), 'las_oversikt');
        if (!atk.prova('las_oversikt').tillaten || !synligaDeltaganden(atk).some(x => x.id === d.id)) continue;
        const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id);
        const ord = db.query('SELECT * FROM ordinationer WHERE patient_id = ? AND lakemedel_id = ?').all(d.patient_id, p.lakemedel_id);
        const doser = db.query("SELECT tid FROM administreringar WHERE patient_id = ? AND lakemedel_id = ? AND status = 'given' ORDER BY tid DESC").all(d.patient_id, p.lakemedel_id);
        atk.logga('las_oversikt', atk.grund(), `provning:${p.id}:deltagare`);
        deltagare.push({ deltagandeId: d.id, patient: { id: pat.id, namn: visningsnamn(pat, Boolean(valFor(pat.id)?.visa_identitet)), personnummer: visningsPnr(pat, Boolean(valFor(pat.id)?.visa_identitet)) },
          inkluderad: d.inkluderad, randomiseringskod: d.randomiseringskod, aktiv: !d.avslutad, ordinationer: ord.filter(o => o.status === 'aktiv').length, givnaDoser: doser.length, senasteDos: doser[0]?.tid ?? null });
      }
      return { ...provningUt(db, p), deltagare };
    }),
    demoregel: DEMOREGEL_PROVNING,
  };
}
