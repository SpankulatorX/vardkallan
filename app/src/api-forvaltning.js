// Förvaltningen av det öppna API:t (runda 9, r6, Sussa 2.5.1.2, 2.5.1.3 och 2.6.1.2). Tre delar:
//
// - Tillämpningar: systemförvaltaren registrerar och återkallar externa tillämpningar för SMART on FHIR med namn,
//   adresser och omfång. Systemet föreslår vilken handling i behörighetsmotorn som personen behöver och skriver själv
//   texten om vad tillämpningen får, ur omfånget. En återkallad tillämpning kan inte startas, och dess biljetter
//   återkallas direkt.
// - Mottagare: systemförvaltaren godkänner de adresser som prenumerationernas meddelanden får skickas till, med samma
//   regler som prenumerationerna prövar (https, port 443, ett namn och ingen inloggning i adressen). När en adress
//   återkallas avslutas varje prenumeration till den.
// - Ärenden mellan kund och utvecklare: begäran om en ny informationsmängd eller ett nytt gränssnitt, frågor och fel i
//   API:t, med svar och en statuskedja. Systemet säger själv om det som begärs redan finns i API:t, och ett ärende kan
//   bara stå som levererat i en version som finns i ändringsloggen. Inga patientuppgifter får skrivas i ett ärende.
//
// Inget här rör en patient, och inget svar innehåller patientuppgifter. Varje ändring loggas med vem som gjorde den.
import { Fel, iso } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as smart from './smart.js';
import { provaMottagare, GODKANDA_MOTTAGARE } from './prenumeration.js';
import { ANDRINGAR } from './api-andringar.js';

export const HANDLING = 'forvalta_api';
// Tak per sandlåda, så att demon inte kan fyllas.
export const TAK = { tillampningar: 20, mottagare: 20, arenden: 100, svar: 50 };

export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS api_tillampningar (
    id TEXT PRIMARY KEY, namn TEXT NOT NULL, adress TEXT NOT NULL, omdirigering TEXT NOT NULL, omfang TEXT NOT NULL, kravs TEXT NOT NULL,
    beskrivning TEXT NOT NULL, far TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, aterkallad TEXT, aterkallad_av TEXT, orsak TEXT);
  CREATE TABLE IF NOT EXISTS api_mottagare (
    id INTEGER PRIMARY KEY, adress TEXT NOT NULL, syfte TEXT NOT NULL, godkand TEXT NOT NULL, godkand_av TEXT NOT NULL, aterkallad TEXT, aterkallad_av TEXT, orsak TEXT);
  CREATE TABLE IF NOT EXISTS api_arenden (
    id INTEGER PRIMARY KEY, typ TEXT NOT NULL, rubrik TEXT NOT NULL, text TEXT NOT NULL, resurstyp TEXT, tjanstekontrakt TEXT, status TEXT NOT NULL,
    version TEXT, beslut TEXT, skapad TEXT NOT NULL, skapad_av TEXT NOT NULL, andrad TEXT, andrad_av TEXT);
  CREATE TABLE IF NOT EXISTS api_arende_svar (
    id INTEGER PRIMARY KEY, arende_id INTEGER NOT NULL, text TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL);`);
}

const logga = (db, personal, resurs, syfte) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: HANDLING, resurs, grund: 'administrativ', syfte });
function kravForvaltare(personal) {
  if (!kanRoll(personal, HANDLING)) throw new Fel(403, 'Bara systemförvaltaren registrerar tillämpningar och godkänner mottagare.', 'nekad');
}
const text = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const json = (v) => JSON.parse(v);

// Ett personnummer, samordningsnummer eller reservnummer i en text som ska vara fri från patientuppgifter.
const PERSONNUMMER = /\b(?:\d{2})?\d{6}[-+]?\d{4}\b/;
function utanPatientuppgifter(...texter) {
  if (texter.some(t => PERSONNUMMER.test(t))) {
    throw new Fel(400, 'Texten ser ut att innehålla ett personnummer. Ett ärende om API:t läses av förvaltningen och utvecklare och får inte innehålla patientuppgifter. Beskriv informationen utan att ange en patient.', 'ogiltig', { falt: ['text'] });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Tillämpningar

// Den handling i behörighetsmotorn som en resurstyp kräver, för systemets förslag.
const LASHANDLING = {
  Observation: 'las_matvarden', Condition: 'las_diagnoser', MedicationRequest: 'las_lakemedel', MedicationAdministration: 'las_lakemedel', AllergyIntolerance: 'las_oversikt',
  Flag: 'las_oversikt', Composition: 'las_journal', ServiceRequest: 'las_remiss', Encounter: 'las_admin', Appointment: 'las_admin', Patient: 'las_oversikt', '*': 'las_oversikt',
};
const NAMN = {
  Patient: 'namn', Observation: 'mätvärden', Condition: 'diagnoser', MedicationRequest: 'läkemedel', MedicationAdministration: 'givna doser', AllergyIntolerance: 'överkänsligheter',
  Flag: 'uppmärksamhetsinformation', Composition: 'anteckningar', ServiceRequest: 'remisser', Encounter: 'vårdkontakter', Appointment: 'tider', '*': 'hela journalen',
};
const lista = (ord) => (ord.length < 2 ? ord.join('') : `${ord.slice(0, -1).join(', ')} och ${ord.at(-1)}`);

// Systemets förslag ur omfånget: vilken handling personen behöver för att se tillämpningen och vad tillämpningen får.
export function forslag(omfangText) {
  const omfang = smart.tolkaOmfang(omfangText).filter(o => !o.kontext);
  if (!omfang.length) throw new Fel(400, 'Ange minst ett omfång, till exempel patient/Observation.read.', 'ogiltig', { falt: ['omfang'] });
  const okanda = omfang.filter(o => !Object.hasOwn(LASHANDLING, o.typ));
  if (okanda.length) throw new Fel(400, `Omfånget ${okanda[0].text} gäller en resurstyp som tillämpningar inte får läsa i Vårdkällan.`, 'ogiltig', { falt: ['omfang'] });
  const forsta = omfang.find(o => o.typ !== 'Patient') ?? omfang[0];
  const kravs = LASHANDLING[forsta.typ];
  const las = omfang.filter(o => /[rs]/.test(o.ratt)).map(o => NAMN[o.typ]);
  const skriv = omfang.filter(o => /[cud]/.test(o.ratt)).map(o => NAMN[o.typ]);
  const patient = omfang.every(o => o.niva === 'patient');
  const far = `${las.length ? `Läsa ${patient ? 'patientens ' : ''}${lista([...new Set(las)])}` : ''}${skriv.length ? `${las.length ? ' och skriva ' : 'Skriva '}${lista([...new Set(skriv)])}` : ''}. Inget annat, och bara det du själv får se utan aktiva val.`;
  return { omfang: ['launch', ...(patient ? ['launch/patient'] : []), ...omfang.map(o => o.text)], kravs, far, patient };
}

// En adress för tillämpningen: en sökväg på samma server under /tillampningar/, eller en https-adress med ett namn.
function provaAdress(adress, falt) {
  const a = text(adress, 300);
  if (/^\/tillampningar\/[\w\-./]+$/.test(a) && !a.includes('..')) return a;
  let u;
  try { u = new URL(a); } catch { throw new Fel(400, 'Adressen ska vara en sökväg på samma server i mappen för tillämpningar, eller en https-adress.', 'ogiltig', { falt: [falt] }); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || /^[\d.]+$|^\[/.test(u.hostname) || u.hash) {
    throw new Fel(400, 'Adressen ska börja med https, ha ett namn och ingen IP-adress, använda port 443 och sakna inloggningsuppgifter.', 'ogiltig', { falt: [falt] });
  }
  return u.toString();
}

const tillampningUt = (r) => ({
  id: r.id, namn: r.namn, adress: r.adress, omdirigering: json(r.omdirigering), omfang: json(r.omfang), kravs: r.kravs, beskrivning: r.beskrivning, far: r.far,
  registrerad: r.registrerad, aterkallad: r.aterkallad, orsak: r.orsak, fast: false,
});
const harSchema = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_tillampningar'").get());

// Alla tillämpningar som går att starta: demons fasta och de som systemförvaltaren har registrerat och inte återkallat.
export function aktivaTillampningar(db) {
  const egna = db && harSchema(db) ? db.query('SELECT * FROM api_tillampningar WHERE aterkallad IS NULL ORDER BY registrerad').all().map(tillampningUt) : [];
  return [...smart.TILLAMPNINGAR, ...egna];
}
export const tillampning = (db, id) => aktivaTillampningar(db).find(t => t.id === id) ?? null;

export function registreraTillampning(db, personal, body = {}) {
  kravForvaltare(personal);
  sakraSchema(db);
  const namn = text(body.namn, 80);
  if (namn.length < 3) throw new Fel(400, 'Ange tillämpningens namn.', 'ogiltig', { falt: ['namn'] });
  const beskrivning = text(body.beskrivning, 500);
  if (beskrivning.length < 10) throw new Fel(400, 'Beskriv kort vad tillämpningen gör, så att personalen vet vad de startar.', 'ogiltig', { falt: ['beskrivning'] });
  utanPatientuppgifter(namn, beskrivning);
  const f = forslag(body.omfang);
  const adress = provaAdress(body.adress, 'adress');
  const omdirigering = (Array.isArray(body.omdirigering) && body.omdirigering.length ? body.omdirigering : [adress]).slice(0, 5).map(a => provaAdress(a, 'omdirigering'));
  const id = namn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tillampning';
  if (aktivaTillampningar(db).some(t => t.id === id) || db.query('SELECT 1 FROM api_tillampningar WHERE id = ?').get(id)) {
    throw new Fel(409, 'Det finns redan en tillämpning med det namnet. Välj ett annat namn.', 'ogiltig', { falt: ['namn'] });
  }
  if (db.query('SELECT COUNT(*) n FROM api_tillampningar').get().n >= TAK.tillampningar) throw new Fel(409, `Demon har plats för ${TAK.tillampningar} tillämpningar.`, 'ogiltig');
  db.query('INSERT INTO api_tillampningar (id, namn, adress, omdirigering, omfang, kravs, beskrivning, far, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, namn, adress, JSON.stringify(omdirigering), JSON.stringify(f.omfang), f.kravs, beskrivning, f.far, iso(), personal.id);
  logga(db, personal, `api:tillampning:${id}`, `Tillämpningen ${namn} registrerades med omfånget ${f.omfang.join(' ')}.`);
  return tillampningUt(db.query('SELECT * FROM api_tillampningar WHERE id = ?').get(id));
}

// Återkallar en registrerad tillämpning. aterkallaBiljetter tar bort tillämpningens biljetter i sandlådan.
export function aterkallaTillampning(db, personal, id, body = {}, { aterkallaBiljetter = () => 0 } = {}) {
  kravForvaltare(personal);
  if (smart.tillampning(id)) throw new Fel(400, 'Demons egen tillämpning kan inte återkallas.', 'ogiltig');
  const r = harSchema(db) ? db.query('SELECT * FROM api_tillampningar WHERE id = ?').get(String(id)) : null;
  if (!r) throw new Fel(404, 'Tillämpningen finns inte.', 'saknas');
  if (r.aterkallad) return { ...tillampningUt(r), aterkallade: 0 };
  const orsak = text(body.orsak, 300);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför tillämpningen återkallas.', 'ogiltig', { falt: ['orsak'] });
  db.query('UPDATE api_tillampningar SET aterkallad = ?, aterkallad_av = ?, orsak = ? WHERE id = ?').run(iso(), personal.id, orsak, r.id);
  const n = aterkallaBiljetter(r.id);
  logga(db, personal, `api:tillampning:${r.id}:aterkallad`, `Tillämpningen ${r.namn} återkallades: ${orsak}`);
  return { ...tillampningUt(db.query('SELECT * FROM api_tillampningar WHERE id = ?').get(r.id)), aterkallade: n };
}

// ---------------------------------------------------------------------------------------------------------------
// Mottagare för prenumerationerna

const mottagareUt = (r) => ({ id: r.id, adress: r.adress, syfte: r.syfte, godkand: r.godkand, aterkallad: r.aterkallad, orsak: r.orsak, fast: false });
const harMottagare = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_mottagare'").get());

// Adresserna som får ta emot meddelanden: de fasta i konfigurationen och de som systemförvaltaren har godkänt.
export function godkandaMottagare(db, fasta = GODKANDA_MOTTAGARE) {
  const egna = db && harMottagare(db) ? db.query('SELECT adress FROM api_mottagare WHERE aterkallad IS NULL').all().map(r => r.adress) : [];
  return [...fasta, ...egna];
}

export function godkannMottagare(db, personal, body = {}, fasta = GODKANDA_MOTTAGARE) {
  kravForvaltare(personal);
  sakraSchema(db);
  const syfte = text(body.syfte, 300);
  if (syfte.length < 5) throw new Fel(400, 'Ange vad mottagaren är, till exempel det regionala vårddatalagret.', 'ogiltig', { falt: ['syfte'] });
  utanPatientuppgifter(syfte);
  // Samma regler som när en prenumeration skapas, och adressen sparas utan sökparametrar.
  let u;
  try {
    const angiven = new URL(String(body.adress ?? ''));
    u = provaMottagare(angiven.toString(), [`${angiven.origin}${angiven.pathname}`]);
  } catch (e) { throw new Fel(400, e instanceof Fel ? e.message : 'Mottagaradressen är inte en giltig adress.', 'ogiltig', { falt: ['adress'] }); }
  const adress = `${u.origin}${u.pathname}`;
  if (godkandaMottagare(db, fasta).includes(adress)) throw new Fel(409, 'Adressen är redan godkänd.', 'ogiltig', { falt: ['adress'] });
  if (db.query('SELECT COUNT(*) n FROM api_mottagare').get().n >= TAK.mottagare) throw new Fel(409, `Demon har plats för ${TAK.mottagare} mottagare.`, 'ogiltig');
  const id = Number(db.query('INSERT INTO api_mottagare (adress, syfte, godkand, godkand_av) VALUES (?, ?, ?, ?)').run(adress, syfte, iso(), personal.id).lastInsertRowid);
  logga(db, personal, `api:mottagare:${id}`, `Mottagaren ${u.hostname} godkändes: ${syfte}`);
  return mottagareUt(db.query('SELECT * FROM api_mottagare WHERE id = ?').get(id));
}

// Återkallar en mottagare. Varje aktiv prenumeration till adressen avslutas, med orsaken.
export function aterkallaMottagare(db, personal, id, body = {}) {
  kravForvaltare(personal);
  const r = harMottagare(db) && /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM api_mottagare WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Mottagaren finns inte.', 'saknas');
  if (r.aterkallad) return { ...mottagareUt(r), avslutade: 0 };
  const orsak = text(body.orsak, 300);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför mottagaren återkallas.', 'ogiltig', { falt: ['orsak'] });
  const t = iso();
  db.query('UPDATE api_mottagare SET aterkallad = ?, aterkallad_av = ?, orsak = ? WHERE id = ?').run(t, personal.id, orsak, r.id);
  let avslutade = 0;
  if (db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prenumerationer'").get()) {
    avslutade = db.query("UPDATE prenumerationer SET status = 'avslutad', avslutad = ?, fel = ? WHERE status = 'aktiv' AND mottagare = ?")
      .run(t, `Mottagaren återkallades av systemförvaltaren: ${orsak}`, r.adress).changes;
  }
  logga(db, personal, `api:mottagare:${r.id}:aterkallad`, `Mottagaren ${new URL(r.adress).hostname} återkallades och ${avslutade} prenumerationer avslutades: ${orsak}`);
  return { ...mottagareUt(db.query('SELECT * FROM api_mottagare WHERE id = ?').get(r.id)), avslutade };
}

// ---------------------------------------------------------------------------------------------------------------
// Ärenden mellan kund och utvecklare

export const ARENDETYPER = {
  informationsmangd: 'Begäran om ny information eller ett nytt gränssnitt',
  fraga: 'Fråga om API:t',
  fel: 'Fel i API:t',
};
export const ARENDESTATUS = {
  inkommen: 'Inkommen', bedomd: 'Bedömd', planerad: 'Planerad', levererad: 'Levererad', avslag: 'Avslag', besvarad: 'Besvarad',
};
// Vilka steg som får följa på varandra. En begäran går från inkommen till bedömd, planerad och levererad, eller får avslag.
const NASTA = { inkommen: ['bedomd', 'avslag', 'besvarad'], bedomd: ['planerad', 'avslag'], planerad: ['levererad', 'avslag'], levererad: [], avslag: [], besvarad: [] };

const harArenden = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_arenden'").get());
const namnFor = (db, id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null;
function arendeUt(db, r, personal) {
  const svar = db.query('SELECT * FROM api_arende_svar WHERE arende_id = ? ORDER BY id').all(r.id).map(s => ({ id: s.id, text: s.text, tid: s.tid, av: namnFor(db, s.av) }));
  return {
    id: r.id, typ: r.typ, typText: ARENDETYPER[r.typ], rubrik: r.rubrik, text: r.text, resurstyp: r.resurstyp, tjanstekontrakt: r.tjanstekontrakt,
    status: r.status, statusText: ARENDESTATUS[r.status], version: r.version, beslut: r.beslut, skapad: r.skapad, skapadAv: namnFor(db, r.skapad_av), andrad: r.andrad,
    svar, nasta: kanRoll(personal, HANDLING) ? NASTA[r.status] : [],
  };
}

// Det som finns i API:t för en resurstyp, så att systemet kan säga det direkt när någon begär något som redan finns.
function finnsRedan(resurstyp, kapabilitet) {
  const r = kapabilitet?.rest?.[0]?.resource?.find(x => x.type === resurstyp);
  if (!r) return null;
  const skriv = r.interaction.filter(i => ['create', 'update', 'patch'].includes(i.code)).map(i => i.code);
  return `${resurstyp} finns redan i API:t: läsning med GET /fhir/${resurstyp}${skriv.length ? ` och skrivning (${skriv.join(', ')})` : ''}. Beskriv vilka uppgifter eller attribut som saknas.`;
}

export function arenden(db, personal) {
  return harArenden(db) ? db.query('SELECT * FROM api_arenden ORDER BY id DESC').all().map(r => arendeUt(db, r, personal)) : [];
}

export function nyttArende(db, personal, body = {}, { kapabilitet = null } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakraSchema(db);
  const typ = String(body.typ ?? '');
  if (!Object.hasOwn(ARENDETYPER, typ)) throw new Fel(400, 'Välj om det gäller en begäran om ny information, en fråga eller ett fel.', 'ogiltig', { falt: ['typ'] });
  const rubrik = text(body.rubrik, 120);
  const beskr = text(body.text, 2000);
  if (rubrik.length < 3) throw new Fel(400, 'Skriv en rubrik.', 'ogiltig', { falt: ['rubrik'] });
  if (beskr.length < 10) throw new Fel(400, 'Beskriv vad det gäller med några meningar.', 'ogiltig', { falt: ['text'] });
  utanPatientuppgifter(rubrik, beskr, text(body.tjanstekontrakt, 120));
  const resurstyp = /^[A-Z][A-Za-z]{2,40}$/.test(body.resurstyp ?? '') ? body.resurstyp : null;
  if (db.query('SELECT COUNT(*) n FROM api_arenden').get().n >= TAK.arenden) throw new Fel(409, `Demon har plats för ${TAK.arenden} ärenden.`, 'ogiltig');
  const id = Number(db.query("INSERT INTO api_arenden (typ, rubrik, text, resurstyp, tjanstekontrakt, status, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, 'inkommen', ?, ?)")
    .run(typ, rubrik, beskr, resurstyp, text(body.tjanstekontrakt, 120) || null, iso(), personal.id).lastInsertRowid);
  // Systemet svarar direkt när den begärda resurstypen redan finns.
  const redan = typ === 'informationsmangd' && resurstyp ? finnsRedan(resurstyp, kapabilitet) : null;
  if (redan) db.query("INSERT INTO api_arende_svar (arende_id, text, tid, av) VALUES (?, ?, ?, 'system')").run(id, redan, iso());
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'api_arende', resurs: `api:arende:${id}`, grund: 'administrativ', syfte: `${ARENDETYPER[typ]}: ${rubrik}` });
  return arendeUt(db, db.query('SELECT * FROM api_arenden WHERE id = ?').get(id), personal);
}

function arendeRad(db, id) {
  const r = harArenden(db) && /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM api_arenden WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Ärendet finns inte.', 'saknas');
  return r;
}

export function svara(db, personal, id, body = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const r = arendeRad(db, id);
  const t = text(body.text, 2000);
  if (t.length < 2) throw new Fel(400, 'Skriv ett svar.', 'ogiltig', { falt: ['text'] });
  utanPatientuppgifter(t);
  if (db.query('SELECT COUNT(*) n FROM api_arende_svar WHERE arende_id = ?').get(r.id).n >= TAK.svar) throw new Fel(409, `Ett ärende har plats för ${TAK.svar} svar i demon.`, 'ogiltig');
  db.query('INSERT INTO api_arende_svar (arende_id, text, tid, av) VALUES (?, ?, ?, ?)').run(r.id, t, iso(), personal.id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'api_arende', resurs: `api:arende:${r.id}:svar`, grund: 'administrativ' });
  return arendeUt(db, r, personal);
}

// Systemförvaltaren för ärendet vidare. Planerad kräver en version, och levererad en version som finns i ändringsloggen,
// så att det som står som levererat alltid går att hitta i loggen.
export function andraStatus(db, personal, id, body = {}, { andringar = ANDRINGAR } = {}) {
  kravForvaltare(personal);
  const r = arendeRad(db, id);
  const status = String(body.status ?? '');
  if (!NASTA[r.status]?.includes(status)) {
    throw new Fel(400, `Ett ärende som är ${ARENDESTATUS[r.status].toLowerCase()} kan ${NASTA[r.status].length ? `bli ${NASTA[r.status].map(s => ARENDESTATUS[s].toLowerCase()).join(' eller ')}` : 'inte ändras'}.`, 'ogiltig', { falt: ['status'] });
  }
  const beslut = text(body.beslut, 1000);
  utanPatientuppgifter(beslut);
  if (['avslag', 'bedomd', 'besvarad'].includes(status) && beslut.length < 5) throw new Fel(400, status === 'avslag' ? 'Motivera avslaget.' : 'Skriv bedömningen eller svaret.', 'ogiltig', { falt: ['beslut'] });
  let version = r.version;
  if (status === 'planerad' || status === 'levererad') {
    version = text(body.version, 20) || r.version;
    if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Fel(400, 'Ange versionen som ändringen kommer i, till exempel 1.0.0.', 'ogiltig', { falt: ['version'] });
    if (status === 'levererad' && !andringar.some(a => a.version === version)) {
      throw new Fel(400, `Version ${version} finns inte i ändringsloggen. Ett ärende står som levererat först när ändringen finns i en version.`, 'ogiltig', { falt: ['version'] });
    }
  }
  db.query('UPDATE api_arenden SET status = ?, version = ?, beslut = COALESCE(?, beslut), andrad = ?, andrad_av = ? WHERE id = ?').run(status, version, beslut || null, iso(), personal.id, r.id);
  logga(db, personal, `api:arende:${r.id}:${status}`, `Ärendet ${r.rubrik} blev ${ARENDESTATUS[status].toLowerCase()}.`);
  return arendeUt(db, db.query('SELECT * FROM api_arenden WHERE id = ?').get(r.id), personal);
}

// Översikten för sidan Öppet API. Tillämpningar och mottagare med historik för systemförvaltaren, de aktiva för andra.
export function oversikt(db, personal) {
  const forvaltare = kanRoll(personal, HANDLING);
  const egnaT = harSchema(db) ? db.query('SELECT * FROM api_tillampningar ORDER BY registrerad').all().map(tillampningUt) : [];
  const egnaM = harMottagare(db) ? db.query('SELECT * FROM api_mottagare ORDER BY id').all().map(mottagareUt) : [];
  return {
    forvaltare,
    tillampningar: [...smart.TILLAMPNINGAR.map(t => ({ id: t.id, namn: t.namn, adress: t.adress, omfang: t.omfang, kravs: t.kravs, beskrivning: t.beskrivning, far: t.far, fast: true, aterkallad: null })),
      ...egnaT.filter(t => forvaltare || !t.aterkallad)],
    mottagare: [...GODKANDA_MOTTAGARE.map(a => ({ adress: a, syfte: 'Fast i konfigurationen', fast: true, aterkallad: null })), ...egnaM.filter(m => forvaltare || !m.aterkallad)],
    arenden: arenden(db, personal),
    arendetyper: ARENDETYPER,
  };
}
