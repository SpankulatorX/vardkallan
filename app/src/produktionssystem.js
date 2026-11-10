// Integration med produktionssystem för beställning och svar (runda 10, r6, Sussa 5.1.4.5). Laboratoriernas egna system
// (producentsystemen) ansluts genom Vårdkällans öppna gränssnitt, där beställaren är integrationsansvarig (ansvarskategori
// B). Alla discipliner använder samma fyra flöden i HL7 FHIR R4:
//   (1) beställning ut: när proverna skickas läggs en Bundle med Patient, ServiceRequest och Specimen i laboratoriets
//       utkorg. Producentsystemet hämtar den med GET /ps/bestallningar och kvitterar den. En makulering går samma väg.
//   (2) status in: POST /ps/Task med status received, in-progress eller rejected för en analys.
//   (3) svar in: POST /ps/DiagnosticReport med Observation (NPU-kod) i contained, eller ett utlåtande i conclusion.
//   (4) katalog in: PUT /ps/katalog med en Bundle av ActivityDefinition. Analyser som laboratoriet inte erbjuder kan inte
//       beställas, och systemet säger varför.
//
// Systemet är experten:
//   - Systemförvaltaren väljer bara laboratoriet. Standarden, adresserna och nyckeln ger systemet, och nyckeln visas en
//     gång och sparas bara som HMAC.
//   - Ett meddelande som inte går att ta emot får svar på vanlig svenska i en OperationOutcome, med vad som är fel och
//     hur det rättas. Inget sparas förrän hela meddelandet är kontrollerat.
//   - Systemet avgör själv vilket laboratorium som är anslutet: beställningarna går dit genom gränssnittet, och det
//     simulerade laboratoriet svarar inte i dess ställe. Ett kritiskt värde larmar som vanligt, eftersom Vårdkällan räknar
//     det ur sina egna gränser och inte litar på avsändarens markering.
//
// Producentsystemen i demon är simulerade (simuleraProducent), men går genom samma funktioner som ett riktigt
// producentsystem, med samma kontroller.
import { createHmac, randomBytes } from 'node:crypto';
import { Fel, iso, datumAv, MATTYPER_ENHET } from './db.js';
import { kanRoll, alder } from './atkomst.js';
import { ckdEpi2021 } from './skalor.js';
import { loggaRad } from './logg.js';
import * as labb from './labb.js';
import * as labbFhir from './labb-fhir.js';
import { LAB, LABORATORIER, ANALYS, DISCIPLINER, FYND, SVARSVARDEN, ROR, finns as iKatalog } from './labb-katalog.js';
import { MATKOD } from './kodverk.js';
import { CS } from './fhir-definitioner.js';
import { FHIR_SYSTEM as ID_SYSTEM } from './identitet.js';
// Transfusionsmedicin: blodkomponenter till blodcentralen (blod.js).
import * as blod from './blod.js';
// Runda 11, r6: rättade svar, koder och underlag i svaret (labb-svarsversioner.js och labb-underlag.js).
import * as versioner from './labb-svarsversioner.js';
import * as underlag from './labb-underlag.js';
import { SYSTEM as KODSYSTEM_URI } from './kodverk.js';

export const STANDARD = 'HL7 FHIR R4';
export const ANALYS_SYSTEM = `${CS}/labbanalys`;
export const TAK = { perMinut: 120, katalogPoster: 500 };
export const SIMULERAD = 'Producentsystemet är simulerat i demon. Det går genom samma gränssnitt och samma kontroller som ett riktigt.';
export const FLODEN = [
  { id: 'bestallning', text: 'Beställning ut', metod: 'GET', vag: '/ps/bestallningar', resurs: 'Bundle med Patient, ServiceRequest och Specimen', kvittens: '/ps/bestallningar/{id}/kvittens' },
  { id: 'status', text: 'Status in', metod: 'POST', vag: '/ps/Task', resurs: 'Task med basedOn ServiceRequest/labb-{analys} och status received, in-progress eller rejected' },
  { id: 'svar', text: 'Svar in', metod: 'POST', vag: '/ps/DiagnosticReport', resurs: 'DiagnosticReport med basedOn ServiceRequest/labb-{analys} och Observation i contained, eller conclusion för ett utlåtande' },
  { id: 'katalog', text: 'Katalog in', metod: 'PUT', vag: '/ps/katalog', resurs: 'Bundle med ActivityDefinition per analys' },
];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS ps_anslutningar (
  lab_id TEXT PRIMARY KEY, standard TEXT NOT NULL, nyckel_hmac TEXT, skapad TEXT NOT NULL, skapad_av TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1,
  avslutad TEXT, avslutad_av TEXT, katalog_tid TEXT
);
CREATE TABLE IF NOT EXISTS ps_meddelanden (
  id INTEGER PRIMARY KEY AUTOINCREMENT, riktning TEXT NOT NULL, lab_id TEXT NOT NULL, typ TEXT NOT NULL, bestallning_id INTEGER, patient_id TEXT, enhet_id TEXT,
  innehall TEXT, tid TEXT NOT NULL, hamtad_tid TEXT, kvitterad_tid TEXT, resultat TEXT NOT NULL, orsak TEXT,
  CHECK (riktning IN ('ut', 'in')), CHECK (typ IN ('bestallning', 'makulering', 'blodbestallning', 'status', 'svar', 'katalog')), CHECK (resultat IN ('vantar', 'mottaget', 'avvisat'))
);
CREATE INDEX IF NOT EXISTS ix_ps_meddelanden_lab ON ps_meddelanden (lab_id, riktning);
CREATE TRIGGER IF NOT EXISTS ps_meddelande_andras_ej BEFORE UPDATE OF riktning, lab_id, typ, bestallning_id, innehall, tid ON ps_meddelanden
  BEGIN SELECT RAISE(ABORT, 'Ett meddelande ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS ps_meddelande_raderas_ej BEFORE DELETE ON ps_meddelanden BEGIN SELECT RAISE(ABORT, 'Ett meddelande raderas inte'); END;
CREATE TABLE IF NOT EXISTS ps_katalog (
  lab_id TEXT NOT NULL, kod TEXT NOT NULL, namn TEXT NOT NULL, analys_id TEXT, svarstid_minuter INTEGER, aktiv INTEGER NOT NULL, uppdaterad TEXT NOT NULL,
  PRIMARY KEY (lab_id, kod)
);
`;

export function sakra(db) { db.exec(SCHEMA); }
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ps_anslutningar'").get());

export const arAnsluten = (db, labId) => harTabell(db) && Boolean(db.query('SELECT 1 FROM ps_anslutningar WHERE lab_id = ? AND aktiv = 1').get(labId));

// Varför en analys inte kan beställas från laboratoriet enligt dess egen katalog, eller null. Utan katalog gäller
// Vårdkällans katalog.
export function ejTillganglig(db, labId, analysId) {
  if (!arAnsluten(db, labId)) return null;
  const a = db.query('SELECT katalog_tid FROM ps_anslutningar WHERE lab_id = ?').get(labId);
  if (!a?.katalog_tid) return null;
  const rad = db.query('SELECT * FROM ps_katalog WHERE lab_id = ? AND analys_id = ? ORDER BY aktiv DESC LIMIT 1').get(labId, analysId);
  if (rad?.aktiv) return null;
  const namn = ANALYS[analysId]?.namn ?? analysId;
  return `${LAB[labId]?.kort ?? labId} erbjuder inte ${namn} just nu enligt laboratoriets egen katalog${rad ? '' : ', där analysen inte finns'}. Välj en annan analys eller kontakta laboratoriet.`;
}

const ogiltig = (text) => new Fel(400, text, 'ogiltig');
const meddelandeIn = (db, labId, typ, { bestallning = null, resultat, orsak = null, nu }) => {
  db.query('INSERT INTO ps_meddelanden (riktning, lab_id, typ, bestallning_id, patient_id, enhet_id, innehall, tid, resultat, orsak) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
    .run('in', labId, typ, bestallning?.id ?? null, bestallning?.patient_id ?? null, bestallning?.enhet_id ?? null, iso(nu), resultat, orsak);
};

// ---------------------------------------------------------------------------------------------------------------
// Anslutningen

export function skapaNyckellager({ hemlighet = process.env.PS_NYCKEL || randomBytes(32).toString('hex'), nu = () => Date.now() } = {}) {
  const nycklar = new Map();
  const hmac = (t) => createHmac('sha256', hemlighet).update(`ps:${t}`).digest('hex');
  function utfarda(s, personal, labId) {
    kravForvaltning(personal);
    if (!iKatalog(LAB, labId)) throw new Fel(404, 'Laboratoriet finns inte.', 'saknas');
    const db = s.db;
    sakra(db);
    for (const [h, k] of nycklar) if (k.s === s && k.labId === labId) nycklar.delete(h);
    const nyckel = `vkps_${randomBytes(24).toString('base64url')}`;
    const h = hmac(nyckel);
    nycklar.set(h, { s, labId, anrop: [] });
    db.query(`INSERT INTO ps_anslutningar (lab_id, standard, nyckel_hmac, skapad, skapad_av, aktiv) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT (lab_id) DO UPDATE SET nyckel_hmac = excluded.nyckel_hmac, skapad = excluded.skapad, skapad_av = excluded.skapad_av, aktiv = 1, avslutad = NULL, avslutad_av = NULL`)
      .run(labId, STANDARD, h, iso(), personal.id);
    return {
      nyckel, lab: labKort(labId), standard: STANDARD, floden: FLODEN,
      text: 'Nyckeln visas bara nu. Lägg in den i producentsystemet som Bearer-nyckel. En tidigare nyckel för laboratoriet gäller inte längre. Från och med nu går beställningarna till laboratoriet genom gränssnittet, och svaren kommer därifrån.',
    };
  }
  function hitta(nyckel, finnsSandlada) {
    if (typeof nyckel !== 'string' || !nyckel.startsWith('vkps_') || nyckel.length > 100) return null;
    const h = hmac(nyckel);
    const k = nycklar.get(h);
    if (!k) return null;
    if (!finnsSandlada(k.s)) { nycklar.delete(h); return null; }
    const a = harTabell(k.s.db) ? k.s.db.query('SELECT * FROM ps_anslutningar WHERE lab_id = ?').get(k.labId) : null;
    if (!a || a.nyckel_hmac !== h || !a.aktiv) { nycklar.delete(h); return null; }
    return k;
  }
  function taktak(k) {
    const t = nu();
    k.anrop = k.anrop.filter(x => x > t - 60_000);
    if (k.anrop.length >= TAK.perMinut) return false;
    k.anrop.push(t);
    return true;
  }
  return { utfarda, hitta, taktak };
}

function kravForvaltning(personal) {
  if (!kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Anslutningen av producentsystem görs av systemförvaltningen.', 'nekad');
}
const labKort = (id) => { const l = LAB[id]; return l ? { id: l.id, namn: l.namn, kort: l.kort, hsa: l.hsa, disciplin: l.disciplin, disciplinNamn: DISCIPLINER[l.disciplin]?.namn } : null; };

export function kopplaFran(db, personal, labId) {
  kravForvaltning(personal);
  if (!arAnsluten(db, labId)) throw ogiltig('Laboratoriet har inget anslutet producentsystem.');
  db.query('UPDATE ps_anslutningar SET aktiv = 0, nyckel_hmac = NULL, avslutad = ?, avslutad_av = ? WHERE lab_id = ?').run(iso(), personal.id, labId);
  return { lab: labKort(labId), text: 'Anslutningen är avslutad och nyckeln gäller inte längre. Nya beställningar går till det simulerade laboratoriet.' };
}

// Översikten för systemförvaltningen: laboratorierna per disciplin, anslutningen, katalogen och antalet meddelanden.
// Inga patientuppgifter.
export function oversikt(db, personal) {
  kravForvaltning(personal);
  const ansl = harTabell(db) ? new Map(db.query('SELECT * FROM ps_anslutningar').all().map(a => [a.lab_id, a])) : new Map();
  const antal = (labId, riktning, resultat) => (harTabell(db) ? db.query(`SELECT count(*) AS n FROM ps_meddelanden WHERE lab_id = ? AND riktning = ?${resultat ? ' AND resultat = ?' : ''}`).get(labId, riktning, ...(resultat ? [resultat] : [])).n : 0);
  return {
    standard: STANDARD, floden: FLODEN, simulerad: SIMULERAD,
    laboratorier: LABORATORIER.map(l => {
      const a = ansl.get(l.id);
      const kat = a?.katalog_tid ? db.query('SELECT count(*) AS n, sum(aktiv) AS aktiva, sum(analys_id IS NULL) AS okopplade FROM ps_katalog WHERE lab_id = ?').get(l.id) : null;
      return {
        ...labKort(l.id), ansluten: Boolean(a?.aktiv), sedan: a?.aktiv ? a.skapad : null,
        utkorg: { vantar: antal(l.id, 'ut', 'vantar'), totalt: antal(l.id, 'ut') }, inkommande: { mottagna: antal(l.id, 'in', 'mottaget'), avvisade: antal(l.id, 'in', 'avvisat') },
        katalog: kat ? { tid: a.katalog_tid, analyser: kat.n, erbjuds: kat.aktiva ?? 0, attKoppla: kat.okopplade ?? 0 } : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// (1) Beställning ut

// Patienten som laboratoriet behöver för att identifiera provet. Skyddad identitet skickas utan namn och med en
// säkerhetsmärkning, så att laboratoriet kan hantera den.
function patientResurs(db, pid) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
  const skyddad = Boolean(p.skyddad);
  return {
    resourceType: 'Patient', id: p.id,
    ...(skyddad ? { meta: { security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R', display: 'restricted' }] } } : {}),
    identifier: [{ system: ID_SYSTEM[p.id_typ ?? 'personnummer'] ?? ID_SYSTEM.personnummer, value: p.personnummer }],
    ...(skyddad ? {} : { name: [{ family: p.efternamn, given: [p.fornamn] }] }),
    gender: p.kon === 'K' ? 'female' : p.kon === 'M' ? 'male' : 'unknown', birthDate: p.fodd,
  };
}

export function laggIUtkorg(db, b, labId, typ, nu = new Date()) {
  sakra(db);
  const analyser = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND lab_id = ? AND status <> 'borttagen' ORDER BY id").all(b.id, labId);
  const provIds = [...new Set(analyser.map(a => a.prov_id))];
  const prov = provIds.map(id => db.query('SELECT * FROM labb_prov WHERE id = ?').get(id)).filter(p => p?.skickad_tid && !ROR[p.ror]?.utanProv);
  const entry = [
    { fullUrl: `Patient/${b.patient_id}`, resource: patientResurs(db, b.patient_id) },
    // Runda 11, r6: parametrarna för vad som förs över till det mottagande systemet gäller (konfiguration.js).
    ...analyser.map(a => ({ fullUrl: `ServiceRequest/labb-${a.id}`, resource: labbFhir.serviceRequest(db, b, a, { mottagare: true }) })),
    ...prov.map(p => ({ fullUrl: `Specimen/labb-${p.id}`, resource: labbFhir.specimen(db, b, p) })),
  ];
  db.query('INSERT INTO ps_meddelanden (riktning, lab_id, typ, bestallning_id, patient_id, enhet_id, innehall, tid, resultat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('ut', labId, typ, b.id, b.patient_id, b.enhet_id, JSON.stringify(entry), iso(nu), 'vantar');
}

// Transfusionsmedicin: en beställning av blodkomponenter till blodcentralen som en ServiceRequest med produkten, antalet
// och indikationen. Blodgruppering och bastest går som andra analyser.
export const BLODKOMPONENT_SYSTEM = `${CS}/blodkomponent`;
export function laggBlodIUtkorg(db, b, nu = new Date()) {
  sakra(db);
  const p = blod.PRODUKTER[b.produkt];
  const sr = {
    resourceType: 'ServiceRequest', id: `blod-${b.id}`, identifier: [{ system: `${labbFhir.BESTALLNING_SYSTEM}/blod`, value: b.nummer }],
    status: 'active', intent: 'order', category: [{ text: 'Blodkomponent' }],
    code: { coding: [{ system: BLODKOMPONENT_SYSTEM, code: b.produkt, display: p.namn }], text: p.namn },
    quantityQuantity: { value: b.antal, unit: 'enheter' }, subject: { reference: `Patient/${b.patient_id}` }, authoredOn: b.skapad, occurrenceDateTime: b.planerad,
    requester: { reference: `Practitioner/${b.bestalld_av}` }, performer: [{ identifier: { system: 'urn:oid:1.2.752.29.4.19', value: LAB[blod.BLOD_LAB].hsa }, display: LAB[blod.BLOD_LAB].namn }],
    reasonCode: [{ text: b.indikation }],
  };
  db.query('INSERT INTO ps_meddelanden (riktning, lab_id, typ, bestallning_id, patient_id, enhet_id, innehall, tid, resultat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('ut', blod.BLOD_LAB, 'blodbestallning', b.id, b.patient_id, b.enhet_id, JSON.stringify([{ fullUrl: `Patient/${b.patient_id}`, resource: patientResurs(db, b.patient_id) }, { fullUrl: `ServiceRequest/blod-${b.id}`, resource: sr }]), iso(nu), 'vantar');
}

// Blodcentralens besked om en blodbeställning: Task med basedOn ServiceRequest/blod-{id}. completed har en output per
// enhet med enhetsnumret och en output med enheternas blodgrupp, som Vårdkällan prövar mot patientens.
function blodStatus(db, labId, task, id, nu) {
  if (labId !== blod.BLOD_LAB) throw new Fel(404, 'Blodbeställningen finns inte för det här laboratoriet.', 'saknas');
  const b = db.query('SELECT * FROM blod_bestallningar WHERE id = ?').get(Number(id));
  if (!b) throw new Fel(404, 'Blodbeställningen finns inte för det här laboratoriet.', 'saknas');
  const typ = (o) => (o?.type?.coding ?? []).map(c => c?.code).find(Boolean) ?? o?.type?.text;
  const output = Array.isArray(task.output) ? task.output : [];
  const enheter = output.filter(o => typ(o) === 'blodenhet').map(o => o.valueIdentifier?.value ?? o.valueString);
  const blodgrupp = output.find(o => typ(o) === 'blodgrupp')?.valueString ?? null;
  const orsak = typeof task.statusReason?.text === 'string' ? task.statusReason.text.trim().slice(0, 300) : '';
  const ref = { id: b.bestallning_id ?? null, patient_id: b.patient_id, enhet_id: b.enhet_id };
  try {
    const text = blod.franProducent(db, b, { status: task.status, orsak, enheter, blodgrupp }, nu);
    meddelandeIn(db, labId, 'status', { bestallning: ref, resultat: 'mottaget', nu });
    return { text };
  } catch (e) {
    if (e instanceof Fel) meddelandeIn(db, labId, 'status', { bestallning: ref, resultat: 'avvisat', orsak: e.message, nu });
    throw e;
  }
}

// Meddelandena som väntar på laboratoriet, som en Bundle av typen searchset. Varje hämtning loggas på patienten, med
// producentsystemet som mottagare, eftersom patientuppgifter lämnas ut.
export function hamta(db, labId, nu = new Date()) {
  sakra(db);
  const rader = db.query("SELECT * FROM ps_meddelanden WHERE lab_id = ? AND riktning = 'ut' AND kvitterad_tid IS NULL ORDER BY id LIMIT 50").all(labId);
  for (const r of rader) {
    if (!r.hamtad_tid) db.query('UPDATE ps_meddelanden SET hamtad_tid = ? WHERE id = ?').run(iso(nu), r.id);
    loggaRad(db, { personal_id: null, enhet_id: r.enhet_id, patient_id: r.patient_id, handling: 'labb_integration', resurs: `ps:${labId}:${r.typ}:${r.id}`, grund: 'administrativ', syfte: `Hämtat av producentsystemet för ${LAB[labId]?.kort ?? labId}` });
  }
  return {
    resourceType: 'Bundle', type: 'searchset', total: rader.length,
    entry: rader.map(r => ({ resource: { resourceType: 'Bundle', id: `ps-${r.id}`, type: 'collection', timestamp: r.tid, meta: { tag: [{ system: `${CS}/ps-meddelande`, code: r.typ }] }, entry: JSON.parse(r.innehall) } })),
  };
}

export function kvittera(db, labId, id, nu = new Date()) {
  sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query("SELECT * FROM ps_meddelanden WHERE id = ? AND lab_id = ? AND riktning = 'ut'").get(Number(id), labId) : null;
  if (!r) throw new Fel(404, 'Meddelandet finns inte för det här laboratoriet.', 'saknas');
  if (r.kvitterad_tid) return { text: 'Meddelandet var redan kvitterat.' };
  db.query("UPDATE ps_meddelanden SET kvitterad_tid = ?, resultat = 'mottaget' WHERE id = ?").run(iso(nu), r.id);
  return { text: 'Meddelandet är kvitterat.' };
}

// ---------------------------------------------------------------------------------------------------------------
// (2) och (3): status och svar in

// Analysen som en resurs gäller, ur basedOn ServiceRequest/labb-<id>. Den ska vara beställd från det här laboratoriet.
function analysFor(db, labId, resurs) {
  const refs = (resurs?.basedOn ?? []).map(x => x?.reference).filter(x => typeof x === 'string');
  if (refs.length !== 1) throw ogiltig('Ange exakt en analys i basedOn som ServiceRequest/labb-{id}, som i beställningen.');
  const m = /^ServiceRequest\/labb-(\d{1,9})$/.exec(refs[0]);
  const a = m ? db.query('SELECT * FROM labb_analyser WHERE id = ?').get(Number(m[1])) : null;
  // Samma svar när analysen inte finns som när den hör till ett annat laboratorium, så att inget röjs.
  if (!a || a.lab_id !== labId) throw new Fel(404, 'Analysen finns inte bland laboratoriets beställningar.', 'saknas');
  const b = labb.bestallningRad(db, a.bestallning_id);
  return { a, b };
}

export function taEmotStatus(db, labId, task, nu = new Date()) {
  sakra(db);
  if (task?.resourceType !== 'Task') throw ogiltig('Skicka en Task.');
  // Transfusionsmedicin: en blodbeställning har ServiceRequest/blod-{id}.
  const blodRef = (task.basedOn ?? []).map(x => x?.reference).filter(x => typeof x === 'string').map(x => /^ServiceRequest\/blod-(\d{1,9})$/.exec(x)).find(Boolean);
  if (blodRef && (task.basedOn ?? []).length === 1) return blodStatus(db, labId, task, blodRef[1], nu);
  const { a, b } = analysFor(db, labId, task);
  const avvisa = (text) => { meddelandeIn(db, labId, 'status', { bestallning: b, resultat: 'avvisat', orsak: text, nu }); return ogiltig(text); };
  if (b.makulerad_tid || a.status === 'makulerad') throw avvisa('Beställningen är makulerad. Laboratoriet har fått makuleringen i utkorgen.');
  if (a.status === 'besvarad') throw avvisa('Analysen är redan besvarad.');
  if (!['skickad', 'mottagen'].includes(a.status)) throw avvisa('Provet är inte skickat till laboratoriet ännu.');
  const lab = LAB[labId]?.kort ?? labId;
  const namn = ANALYS[a.analys]?.namn ?? a.analys;
  if (task.status === 'received') {
    if (a.status === 'skickad') db.query("UPDATE labb_analyser SET status = 'mottagen', mottagen_tid = ? WHERE id = ?").run(iso(nu), a.id);
    labb.historikRad(db, b, null, 'Mottagen av laboratoriet', `${lab} har kvitterat att provet för ${namn} har kommit.`, iso(nu));
  } else if (task.status === 'in-progress') {
    if (a.status === 'skickad') db.query("UPDATE labb_analyser SET status = 'mottagen', mottagen_tid = ? WHERE id = ?").run(iso(nu), a.id);
    labb.historikRad(db, b, null, 'Analys pågår', `${lab} analyserar ${namn}.`, iso(nu));
  } else if (task.status === 'rejected') {
    const orsak = typeof task.statusReason?.text === 'string' ? task.statusReason.text.trim().slice(0, 300) : '';
    if (orsak.length < 3) throw avvisa('Ange varför provet inte kan analyseras i statusReason.text, till exempel hemolys. Läkaren behöver orsaken för att ta om provet.');
    // Laboratoriets besked blir ett svar utan värden, som den ansvariga läkaren vidimerar och kan ta om provet efter.
    labb.registreraSvar(db, b, a, { varden: [], provtagen: null, text: `Inte analyserat: ${orsak} Ta om provet om analysen behövs.`, fynd: null, avvikande: 'fynd', kritisk: 0 }, nu);
    labb.historikRad(db, b, null, 'Inte analyserat', `${lab}: ${orsak}`, iso(nu));
  } else throw avvisa('Status ska vara received, in-progress eller rejected.');
  meddelandeIn(db, labId, 'status', { bestallning: b, resultat: 'mottaget', nu });
  return { text: 'Statusen är mottagen.' };
}

const MATTYP_FOR_KOD = (() => {
  const m = new Map();
  for (const [typ, k] of Object.entries(MATKOD)) for (const c of k.coding ?? []) m.set(c.code, typ);
  return m;
})();
const FYND_FOR_KOD = new Map(Object.entries(FYND).map(([id, f]) => [f.snomed, id]));

// Svaret kontrolleras helt innan något sparas: analysen, att varje värde är ett av analysens mätvärden med rätt enhet,
// att inget värde saknas och att ett utlåtande har text. Vårdkällan räknar själv om ett värde är kritiskt.
export function taEmotSvar(db, labId, dr, nu = new Date()) {
  sakra(db);
  if (dr?.resourceType !== 'DiagnosticReport') throw ogiltig('Skicka en DiagnosticReport.');
  const { a, b } = analysFor(db, labId, dr);
  const avvisa = (text) => { meddelandeIn(db, labId, 'svar', { bestallning: b, resultat: 'avvisat', orsak: text, nu }); return ogiltig(text); };
  if (b.makulerad_tid || a.status === 'makulerad') throw avvisa('Beställningen är makulerad. Svaret tas inte emot.');
  // Runda 11, r6: ett rättat svar har status corrected eller amended och ersätter det tidigare (labb-svarsversioner.js).
  const rattat = ['corrected', 'amended'].includes(dr.status);
  if (a.status === 'besvarad' && !rattat) throw avvisa('Analysen är redan besvarad. Skicka ett rättat svar med status corrected och orsaken i extension eller note.');
  if (rattat && a.status !== 'besvarad') throw avvisa('Analysen är inte besvarad än. Skicka svaret med status final.');
  if (!rattat && !['skickad', 'mottagen'].includes(a.status)) throw avvisa('Provet är inte skickat till laboratoriet ännu.');
  if (!rattat && dr.status !== 'final') throw avvisa('Vårdkällan tar emot slutsvar med status final och rättade svar med status corrected. Skicka status received eller in-progress med en Task medan analysen pågår.');
  // Runda 11, r6: ett patientnära instrument anger provets etikett i specimen, och den ska vara analysens.
  const etikett = (dr.specimen ?? []).map(x => x?.identifier?.value).find(x => typeof x === 'string');
  if (etikett != null && etikett !== db.query('SELECT etikett FROM labb_prov WHERE id = ?').get(a.prov_id)?.etikett) throw avvisa('Etiketten i specimen hör inte till analysen. Läs av etiketten på provet igen.');
  let koder, filer;
  try {
    const koding = [...(dr.code?.coding ?? []), ...(dr.conclusionCode ?? []).flatMap(c => c?.coding ?? [])].filter(c => c?.system === KODSYSTEM_URI.kva || (c?.system === 'http://snomed.info/sct' && !FYND_FOR_KOD.has(c.code) && !['10828004', '260385009'].includes(c.code)));
    koder = koding.length ? versioner.provaKoder(koding.map(c => ({ system: c.system === KODSYSTEM_URI.kva ? (/^V[A-Z]\d{3}$/.test(c.code ?? '') ? 'svf' : 'kva') : 'snomed', kod: c.code, text: c.display }))) : null;
    filer = underlag.provaAlla(db, (dr.presentedForm ?? []).map(f => ({ namn: f?.title ?? 'underlag', data: f?.data })), b.id);
  } catch (e) { if (e instanceof Fel) throw avvisa(e.message); throw e; }
  const def = ANALYS[a.analys];
  const prov = db.query('SELECT provtagen_tid FROM labb_prov WHERE id = ?').get(a.prov_id);
  const svar = { varden: [], provtagen: prov?.provtagen_tid ?? b.planerad, text: null, fynd: null, avvikande: null, kritisk: 0 };
  if (def.matvarden) {
    const contained = new Map((dr.contained ?? []).filter(r => r?.resourceType === 'Observation' && typeof r.id === 'string').map(r => [r.id, r]));
    const obs = (dr.result ?? []).map(x => (typeof x?.reference === 'string' && x.reference.startsWith('#') ? contained.get(x.reference.slice(1)) : null));
    if (!obs.length || obs.some(o => !o)) throw avvisa('Lägg varje värde som en Observation i "contained" och hänvisa till den med #id i "result".');
    for (const o of obs) {
      const kod = (o.code?.coding ?? []).map(c => c?.code).find(c => MATTYP_FOR_KOD.has(c));
      const typ = kod ? MATTYP_FOR_KOD.get(kod) : null;
      if (!typ || !def.matvarden.includes(typ)) throw avvisa(`Värdet med koden ${(o.code?.coding ?? [])[0]?.code ?? 'utan kod'} hör inte till ${def.namn}. Ange analysens NPU-kod.`);
      const v = o.valueQuantity?.value;
      if (typeof v !== 'number' || !Number.isFinite(v)) throw avvisa(`Värdet för ${typ} ska vara ett tal i "valueQuantity.value".`);
      const enhet = MATTYPER_ENHET[typ] ?? null;
      const angiven = o.valueQuantity?.unit ?? o.valueQuantity?.code;
      if (enhet && angiven && angiven !== enhet && angiven !== MATKOD[typ]?.ucum) throw avvisa(`Enheten för ${typ} ska vara ${enhet}.`);
      if (svar.varden.some(x => x.typ === typ)) throw avvisa(`Värdet för ${typ} finns två gånger.`);
      svar.varden.push({ typ, varde: v, enhet });
      const g = SVARSVARDEN[typ];
      if (g && ((g.kritiskLag != null && v < g.kritiskLag) || (g.kritiskHog != null && v > g.kritiskHog))) svar.kritisk = 1;
    }
    // eGFR räknar Vårdkällan själv ur kreatininet om laboratoriet inte skickar det.
    const saknas = def.matvarden.filter(t => t !== 'egfr' && !svar.varden.some(x => x.typ === t));
    if (saknas.length) throw avvisa(`Svaret saknar ${saknas.join(' och ')}. Skicka alla värden för ${def.namn} i samma DiagnosticReport.`);
    const krea = svar.varden.find(x => x.typ === 'kreatinin');
    if (def.matvarden.includes('egfr') && krea && !svar.varden.some(x => x.typ === 'egfr')) {
      const p = db.query('SELECT fodd, kon FROM patienter WHERE id = ?').get(b.patient_id);
      svar.varden.push({ typ: 'egfr', varde: ckdEpi2021(krea.varde, alder(p.fodd, datumAv(new Date(svar.provtagen))), p.kon), enhet: MATTYPER_ENHET.egfr ?? null });
    }
  } else {
    const text = typeof dr.conclusion === 'string' ? dr.conclusion.trim().slice(0, 4000) : '';
    if (def.odling) {
      const kod = (dr.conclusionCode ?? []).flatMap(c => c?.coding ?? []).map(c => c?.code).find(c => FYND_FOR_KOD.has(c));
      if (!kod) throw avvisa('Ange fyndet i conclusionCode med Snomed CT, till exempel 264868006 för ingen växt.');
      svar.fynd = FYND_FOR_KOD.get(kod);
      svar.text = text || `${FYND[svar.fynd].text}.`;
      if (svar.fynd !== 'ingen_vaxt') { svar.avvikande = 'fynd'; if (a.analys === 'blododling') svar.kritisk = 1; }
    } else if (a.analys === 'bastest') {
      // Transfusionsmedicin: bastestet är positivt eller negativt i Snomed CT, och ett positivt stoppar blodbeställningen.
      const kod = (dr.conclusionCode ?? []).flatMap(c => c?.coding ?? []).map(c => c?.code).find(c => ['10828004', '260385009'].includes(c));
      if (!kod) throw avvisa('Ange bastestets utfall i conclusionCode med Snomed CT: 10828004 för positivt eller 260385009 för negativt.');
      svar.text = text || (kod === '10828004' ? 'Antikroppsscreening positiv. Blodcentralen utreder antikroppen innan blod kan lämnas ut.' : 'Antikroppsscreening negativ.');
      if (kod === '10828004') svar.avvikande = 'fynd';
    } else {
      if (text.length < 3) throw avvisa('Skriv utlåtandet i conclusion.');
      // Blodgrupperingen läses av systemet, så den ska stå på samma sätt som från blodcentralen.
      if (a.analys === 'blodgruppering' && !blod.tolkaBlodgrupp(text)) throw avvisa('Skriv blodgruppen i conclusion som "Blodgrupp A RhD positiv".');
      svar.text = text;
    }
  }
  if (koder) svar.koder = koder;
  if (filer.length) svar.underlag = filer;
  const instrument = (dr.performer ?? []).map(x => x?.identifier?.value).find(x => typeof x === 'string');
  if (instrument && LAB[labId]?.instrument) svar.instrument = instrument.slice(0, 60);
  if (rattat) {
    const orsak = (dr.extension ?? []).find(x => /rattelse|correction/.test(x?.url ?? ''))?.valueString ?? dr.presentedForm?.[0]?.title ?? (typeof dr.note?.[0]?.text === 'string' ? dr.note[0].text : '');
    let r;
    try { r = versioner.ratta(db, b, a, svar, { orsak, kalla: `ps:${labId}` }, nu); } catch (e) { if (e instanceof Fel) throw avvisa(e.message); throw e; }
    if (filer.length) underlag.spara(db, b, filer, { riktning: 'svar', analysId: a.id, kalla: LAB[labId]?.kort ?? labId, nu });
    meddelandeIn(db, labId, 'svar', { bestallning: b, resultat: 'mottaget', nu });
    return { text: r.text };
  }
  if (a.status === 'skickad') db.query("UPDATE labb_analyser SET status = 'mottagen', mottagen_tid = ? WHERE id = ?").run(iso(nu), a.id);
  labb.registreraSvar(db, b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(a.id), svar, nu);
  labb.historikRad(db, b, null, 'Svar från laboratoriet', `${LAB[labId]?.kort ?? labId} genom producentsystemet. Svaret väntar på vidimering.`, iso(nu));
  meddelandeIn(db, labId, 'svar', { bestallning: b, resultat: 'mottaget', nu });
  return { text: `Svaret på ${def.namn} är mottaget och väntar på vidimering.${svar.kritisk ? ' Värdet är kritiskt, och den ansvariga läkaren och sjuksköterskan får ett larm.' : ''}` };
}

// ---------------------------------------------------------------------------------------------------------------
// (4) Katalog in

// Laboratoriets katalog ersätter den tidigare. En analys kopplas till Vårdkällans katalog med koden i ANALYS_SYSTEM
// eller med en NPU-kod som hör till en av laboratoriets analyser. Det som inte går att koppla sparas och visas för
// systemförvaltningen, men kan inte beställas förrän det finns i Vårdkällans katalog.
export function taEmotKatalog(db, labId, bundle, nu = new Date()) {
  sakra(db);
  if (bundle?.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) throw ogiltig('Skicka katalogen som en Bundle med en ActivityDefinition per analys.');
  if (bundle.entry.length > TAK.katalogPoster) throw ogiltig(`Katalogen får ha högst ${TAK.katalogPoster} analyser.`);
  const disciplin = LAB[labId].disciplin;
  const egna = Object.values(ANALYS).filter(x => x.disciplin === disciplin);
  const rader = [];
  for (const [i, e] of bundle.entry.entries()) {
    const r = e?.resource;
    if (r?.resourceType !== 'ActivityDefinition') throw ogiltig(`Post ${i + 1} är inte en ActivityDefinition.`);
    const kodning = (r.code?.coding ?? []).filter(c => typeof c?.code === 'string');
    const kod = kodning[0]?.code?.slice(0, 60);
    const namn = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : '';
    if (!kod || !namn) throw ogiltig(`Post ${i + 1} behöver en kod i code.coding och ett namn i title.`);
    if (!['active', 'retired', 'draft'].includes(r.status)) throw ogiltig(`Post ${i + 1}: status ska vara "active", "retired" eller "draft".`);
    const egen = kodning.find(c => c.system === ANALYS_SYSTEM)?.code;
    const analys = egen && iKatalog(ANALYS, egen) && ANALYS[egen].disciplin === disciplin ? egen
      : egna.find(x => x.matvarden && kodning.some(c => MATKOD[x.matvarden[0]]?.coding?.some(m => m.code === c.code)))?.id ?? null;
    const d = r.timingDuration;
    const minuter = typeof d?.value === 'number' && d.value > 0 ? Math.round(d.value * ({ min: 1, h: 60, d: 1440 }[d.unit ?? d.code] ?? NaN)) : null;
    rader.push({ kod, namn, analys, minuter: Number.isFinite(minuter) ? minuter : null, aktiv: r.status === 'active' ? 1 : 0 });
  }
  const t = iso(nu);
  db.transaction(() => {
    db.query('DELETE FROM ps_katalog WHERE lab_id = ?').run(labId);
    const ins = db.query('INSERT OR REPLACE INTO ps_katalog (lab_id, kod, namn, analys_id, svarstid_minuter, aktiv, uppdaterad) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of rader) ins.run(labId, r.kod, r.namn, r.analys, r.minuter, r.aktiv, t);
    db.query('UPDATE ps_anslutningar SET katalog_tid = ? WHERE lab_id = ?').run(t, labId);
  })();
  meddelandeIn(db, labId, 'katalog', { resultat: 'mottaget', nu });
  const ejErbjudna = egna.filter(x => !rader.some(r => r.analys === x.id && r.aktiv)).map(x => x.namn);
  return {
    text: `Katalogen med ${rader.length} ${rader.length === 1 ? 'analys' : 'analyser'} är mottagen.`,
    analyser: rader.length, kopplade: rader.filter(r => r.analys).length,
    attKoppla: rader.filter(r => !r.analys).map(r => ({ kod: r.kod, namn: r.namn })), ejErbjudna,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Det simulerade producentsystemet

// Hämtar laboratoriets meddelanden, kvitterar dem och svarar genom samma funktioner som ett riktigt producentsystem:
// status received för varje analys och sedan ett svar med det simulerade laboratoriets värden.
export function simuleraProducent(db, personal, labId, nu = new Date()) {
  kravForvaltning(personal);
  if (!arAnsluten(db, labId)) throw ogiltig('Anslut laboratoriets producentsystem först.');
  const paket = hamta(db, labId, nu);
  let svar = 0;
  const blodMeddelanden = [];
  for (const m of paket.entry) {
    const id = m.resource.id.replace('ps-', '');
    // Blodbeställningar besvaras efter proverna, när blodgrupperingen är klar.
    if (m.resource.meta.tag[0].code === 'blodbestallning') { blodMeddelanden.push({ id, m }); continue; }
    kvittera(db, labId, id, nu);
    if (m.resource.meta.tag[0].code !== 'bestallning') continue;
    for (const e of m.resource.entry.filter(x => x.resource.resourceType === 'ServiceRequest')) {
      const basedOn = [{ reference: `ServiceRequest/${e.resource.id}` }];
      const a = db.query('SELECT * FROM labb_analyser WHERE id = ?').get(Number(e.resource.id.replace('labb-', '')));
      if (!a || !['skickad', 'mottagen'].includes(a.status)) continue;
      taEmotStatus(db, labId, { resourceType: 'Task', status: 'received', intent: 'order', basedOn }, nu);
      const b = labb.bestallningRad(db, a.bestallning_id);
      taEmotSvar(db, labId, diagnosticReportFor(labb.simuleratSvar(db, b, a), basedOn, ANALYS[a.analys]), nu);
      svar++;
    }
  }
  // Den simulerade blodcentralen bereder enheter med patientens blodgrupp när blodgruppering och bastest är besvarade.
  // Annars ligger blodbeställningen kvar i utkorgen till nästa körning.
  for (const { id, m } of blodMeddelanden) {
    const sr = m.resource.entry.find(e => e.resource.resourceType === 'ServiceRequest').resource;
    const b = db.query('SELECT * FROM blod_bestallningar WHERE id = ?').get(Number(sr.id.replace('blod-', '')));
    if (!b || b.status !== 'vantar_prov') { kvittera(db, labId, id, nu); continue; }
    const grupp = blod.patientensBlodgrupp(db, b.patient_id);
    const bas = db.query("SELECT avvikande FROM labb_analyser WHERE patient_id = ? AND analys = 'bastest' AND status = 'besvarad' ORDER BY besvarad_tid DESC LIMIT 1").get(b.patient_id);
    if (!grupp || (blod.PRODUKTER[b.produkt].bastest && !bas)) continue;
    kvittera(db, labId, id, nu);
    const basedOn = [{ reference: `ServiceRequest/${sr.id}` }];
    if (bas?.avvikande === 'fynd') { taEmotStatus(db, labId, { resourceType: 'Task', status: 'in-progress', basedOn, statusReason: { text: 'Bastestet är positivt. Antikroppen utreds.' } }, nu); continue; }
    const output = [{ type: { text: 'blodgrupp' }, valueString: grupp }, ...Array.from({ length: b.antal }, (_, i) => ({ type: { text: 'blodenhet' }, valueIdentifier: { value: `SIM${String(b.id).padStart(6, '0')}${i + 1}` } }))];
    taEmotStatus(db, labId, { resourceType: 'Task', status: 'completed', basedOn, output }, nu);
    svar++;
  }
  return { meddelanden: paket.entry.length, svar, text: `Det simulerade producentsystemet hämtade ${paket.entry.length} ${paket.entry.length === 1 ? 'meddelande' : 'meddelanden'} och svarade på ${svar} ${svar === 1 ? 'analys' : 'analyser'}.`, simulerad: SIMULERAD };
}

// Ett svar från det simulerade laboratoriet som DiagnosticReport, så som ett producentsystem skickar det.
export function diagnosticReportFor(s, basedOn, def) {
  const obs = s.varden.filter(v => v.typ !== 'egfr').map((v, i) => ({
    resourceType: 'Observation', id: `v${i + 1}`, status: 'final', code: { coding: MATKOD[v.typ].coding.map(c => ({ ...c })) },
    valueQuantity: { value: v.varde, unit: v.enhet ?? undefined },
  }));
  return {
    resourceType: 'DiagnosticReport', status: 'final', basedOn, code: { text: def.namn },
    ...(obs.length ? { contained: obs, result: obs.map(o => ({ reference: `#${o.id}` })) } : {}),
    ...(s.fynd ? { conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: FYND[s.fynd].snomed }] }] } : {}),
    ...(def.id === 'bastest' ? { conclusionCode: [{ coding: [{ system: 'http://snomed.info/sct', code: s.avvikande === 'fynd' ? '10828004' : '260385009' }] }] } : {}),
    ...(s.text ? { conclusion: s.text } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Gränssnittet mot producentsystemen (/ps) och API:t för systemförvaltningen

const ooSvar = (status, text, ok = false) => new Response(JSON.stringify({
  resourceType: 'OperationOutcome', issue: [{ severity: ok ? 'information' : 'error', code: ok ? 'informational' : status === 401 ? 'login' : status === 404 ? 'not-found' : status === 429 ? 'throttled' : 'invalid', diagnostics: text }],
}), { status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });

export function skapaProducentApi({ nycklar, finns, maxKropp }) {
  return async function producent(req, url) {
    const vag = url.pathname.replace(/\/+$/, '');
    if (vag === '/ps') return new Response(JSON.stringify({ standard: STANDARD, floden: FLODEN, tak: TAK, simulerad: SIMULERAD }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    const auth = req.headers.get('authorization') ?? '';
    const k = auth.startsWith('Bearer ') ? nycklar.hitta(auth.slice(7).trim(), finns) : null;
    if (!k) return ooSvar(401, 'Producentsystemets nyckel saknas eller gäller inte. Systemförvaltningen skapar en ny nyckel i Vårdkällan.');
    if (!nycklar.taktak(k)) return ooSvar(429, `Producentsystemet har skickat mer än ${TAK.perMinut} anrop den senaste minuten. Vänta en stund.`);
    const db = k.s.db;
    let kropp = null;
    if (req.method !== 'GET') {
      if (!/^application\/(fhir\+)?json/.test(req.headers.get('content-type') ?? '')) return ooSvar(415, 'Skicka meddelandet som application/fhir+json.');
      const text = await req.text();
      if (text.length > maxKropp) return ooSvar(413, 'Meddelandet är för stort.');
      try { kropp = text ? JSON.parse(text) : {}; } catch { return ooSvar(400, 'Meddelandet är inte giltig JSON.'); }
    }
    try {
      const m = /^\/ps\/bestallningar\/(\d{1,9})\/kvittens$/.exec(vag);
      if (vag === '/ps/bestallningar' && req.method === 'GET') return new Response(JSON.stringify(hamta(db, k.labId)), { headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
      if (m && req.method === 'POST') return ooSvar(200, kvittera(db, k.labId, m[1]).text, true);
      if (vag === '/ps/Task' && req.method === 'POST') return ooSvar(200, taEmotStatus(db, k.labId, kropp).text, true);
      if (vag === '/ps/DiagnosticReport' && req.method === 'POST') return ooSvar(201, taEmotSvar(db, k.labId, kropp).text, true);
      if (vag === '/ps/katalog' && req.method === 'PUT') {
        const r = taEmotKatalog(db, k.labId, kropp);
        return new Response(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: r.text }], vardkallan: r }), { headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      return ooSvar(404, 'Okänd adress. Se GET /ps för gränssnittets adresser.');
    } catch (e) {
      if (e instanceof Fel) return ooSvar(e.status, e.message);
      console.error('Producentsystemets meddelande kunde inte tas emot:', e.message);
      return ooSvar(500, 'Meddelandet kunde inte tas emot.');
    }
  };
}

export function registreraRutter({ rutt, kravInloggad, nycklar }) {
  rutt('GET', '/api/produktionssystem', (c) => oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/produktionssystem/:lab/anslut', (c, lab) => [201, nycklar.utfarda(c.s, kravInloggad(c), lab)]);
  rutt('POST', '/api/produktionssystem/:lab/koppla-fran', (c, lab) => kopplaFran(c.db, kravInloggad(c), lab));
  rutt('POST', '/api/produktionssystem/:lab/simulera', (c, lab) => simuleraProducent(c.db, kravInloggad(c), lab));
}
