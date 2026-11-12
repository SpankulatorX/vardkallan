// Runda 14, r3: elektronisk remiss och vårdbegäran till och från vårdgivare utanför Vårdkällan (Sussa 2.2.1.12 och
// 3.3.1.2), med tjänstekontrakten i riv.clinicalprocess.activity.request 2.3:
//   ProcessRequest              Vårdkällan är konsument när en remiss skickas ut, och producent när en remiss kommer in.
//   ProcessRequestConfirmation  Mottagarens besked: bekräftelse (BEK), avvisad (AVV), avbruten (AVB), vidareskickad
//                               (VID) eller begäran om komplettering (KOM).
//   ProcessRequestOutcome       Svaret: delsvar (DSV), preliminärt svar (PSV) eller slutsvar (SSV).
//
// Remissen är en vanlig remiss i Vårdkällan med samma statuskedja och larm som inom vårdgivaren (remiss.js). En utgående
// remiss går till den externa enheten (remiss-r8.js EXTERN) och får sin status av de meddelanden som kommer tillbaka. En
// inkommande remiss blir en extern remiss till vårdenheten, som en inskannad pappersremiss, och ger vårdrelation först
// när någon på vårdenheten har tagit emot den. När vårdenheten tar emot, avvisar eller besvarar den skickas beskedet
// tillbaka till avsändaren av systemet, utan att någon behöver tänka på det.
//
// Systemet är experten: läkaren väljer bara mottagare och skriver frågeställningen. Patienten, remittenten, vårdenheten,
// betalningsansvaret och diagnoserna från den egna vårdenheten fylls i av systemet.
//
// Meddelandena byggs, valideras och skickas med den gemensamma grunden i src/rivta/ (rivta-r3.js). Motparterna är
// simulerade (eremiss-simulerad.js) och märkta som simulerade. Inget lämnar demon.
import { randomUUID } from 'node:crypto';
import { Fel, iso, datumAv, addDagar } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import * as r3 from './rivta-r3.js';
import { EXTERN, HSA_KATALOG } from './remiss-r8.js';
import { PRIORITETER } from './remiss.js';

export const DOMAN = 'riv.clinicalprocess.activity.request';
export const DOMANVERSION = '2.3';
export const NS = {
  core: 'urn:riv:clinicalprocess:activity:request:2',
  pr: 'urn:riv:clinicalprocess:activity:request:ProcessRequestResponder:2',
  bek: 'urn:riv:clinicalprocess:activity:request:ProcessRequestConfirmationResponder:2',
  svar: 'urn:riv:clinicalprocess:activity:request:ProcessRequestOutcomeResponder:2',
};
export const KONTRAKT = { remiss: 'ProcessRequest', besked: 'ProcessRequestConfirmation', svar: 'ProcessRequestOutcome' };
const OID = { personnummer: '1.2.752.129.2.1.3.1', samordningsnummer: '1.2.752.129.2.1.3.3', icd10: '1.2.752.116.1.1.1' };
export const MOTPART = 'Extern vårdgivares e-remiss (simulerad)';
// Mottagarna utanför Vårdkällan som tar emot e-remiss i demon. Påhittade och märkta som demo.
// Läses när den behövs, eftersom remiss.js och remiss-r8.js importerar den här modulen.
const MOTTAGARE_HSA = ['SE-DEMO-HSA-0002', 'SE-DEMO-HSA-0004'];
export const mottagareRader = () => HSA_KATALOG.filter(x => MOTTAGARE_HSA.includes(x.hsaId));

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS eremisser (
  remiss_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, riktning TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE,
  motpart_hsa TEXT NOT NULL, motpart_namn TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, skapad TEXT NOT NULL,
  CHECK (riktning IN ('ut', 'in'))
);
CREATE TABLE IF NOT EXISTS eremiss_handelser (
  id INTEGER PRIMARY KEY, remiss_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kontrakt TEXT NOT NULL,
  kod TEXT NOT NULL, meddelande_id TEXT NOT NULL, tid TEXT NOT NULL, text TEXT, UNIQUE (kontrakt, meddelande_id)
);
CREATE TRIGGER IF NOT EXISTS eremiss_handelse_andras_ej BEFORE UPDATE ON eremiss_handelser BEGIN SELECT RAISE(ABORT, 'En händelse i e-remissen ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS eremiss_handelse_raderas_ej BEFORE DELETE ON eremiss_handelser BEGIN SELECT RAISE(ABORT, 'En händelse i e-remissen raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
export const DEF = {
  remiss: () => r3.def(DOMAN, 'ProcessRequest', '2.3'),
  besked: () => r3.def(DOMAN, 'ProcessRequestConfirmation', '2.3'),
  svar: () => r3.def(DOMAN, 'ProcessRequestOutcome', '2.3'),
};

export const BESKED = { BEK: 'Mottagningsbekräftelse', AVV: 'Avvisad', AVB: 'Avbruten', VID: 'Vidareskickad', KOM: 'Begäran om komplettering' };
export const SVARSTYP = { DSV: 'Delsvar', PSV: 'Preliminärt svar', SSV: 'Slutsvar' };

const ve = (db, enhetId) => db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, enhetId));
// Tidpunkter i kontraktet: ÅÅÅÅMMDDttmmss i svensk tid.
export const tidRiv = (d = new Date()) => new Date(d).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(/[- :]/g, '').slice(0, 14);
const datumRiv = (d) => String(d).slice(0, 10).replace(/-/g, '');
const kort = (s, n) => String(s ?? '').slice(0, n);
export function personId(p) {
  const nr = String(p.personnummer ?? '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(nr) || /^vk/i.test(String(p.personnummer))) return null;
  return { root: Number(nr.slice(6, 8)) > 60 ? OID.samordningsnummer : OID.personnummer, extension: nr };
}
const reqId = (hsa, id) => `${hsa}#${id}`;

// Diagnoserna i remissen: de som finns på den egna vårdenheten och som läkaren får se. Aldrig något från en annan eller
// spärrad vårdenhet.
export function diagnoserForRemiss(atk) {
  if (!kanRoll(atk.personal, 'las_diagnoser')) return [];
  const min = vardenhetFor(atk.db, atk.personal.enhet_id);
  // Säkerhetsgranskningen vid sammanslagningen av runda 14: urvalet av den egna vårdenheten görs före taket, så att
  // diagnoser på en annan eller spärrad vårdenhet aldrig kan tränga undan den egna och därmed röja att de finns.
  const rader = atk.db.query('SELECT id, enhet_id, kod, text FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(atk.patientId)
    .filter(d => vardenhetFor(atk.db, d.enhet_id) === min).slice(0, 20);
  return atk.filtrera(rader, 'las_diagnoser').slice(0, 5);
}

// Begäran ProcessRequest 2.3 i schemats form.
const hsaAttr = (x) => ({ '@extension': x });
export function remissBegaran({ requestId, version = 1, skal = 'NR', patient, pid, avsandare, enhet, mottagareHsa, fragestallning, anamnes, diagnoser = [], datum, tid }) {
  const kon = patient.kon === 'kvinna' ? '2' : patient.kon === 'man' ? '1' : '0';
  return {
    request: {
      requestId: { '@extension': requestId }, typeOfRequest: { '@code': '4' }, versionTimeStamp: { '@value': tid }, versionNumber: String(version),
      reasonForVersion: { typeOfReason: { '@code': skal } }, careResponsibilityRemains: true,
      patient: {
        personId: { '@extension': pid.extension, '@root': pid.root },
        // Namnet följer inte med för en patient med skyddade personuppgifter.
        name: patient.skyddad ? null : kort(`${patient.fornamn} ${patient.efternamn}`, 128),
        gender: { '@code': kon }, dateOfBirth: { '@value': datumRiv(patient.fodd) },
      },
      requestOrganisation: { careUnitId: hsaAttr(enhet.hsa_id), careUnitName: kort(enhet.namn, 128) },
      author: { date: { '@value': datum }, healthcareProfessional: { id: hsaAttr(avsandare.hsa_id), name: kort(avsandare.namn, 64) }, healthcareProfessionalOrganisation: { careUnitId: hsaAttr(enhet.hsa_id) } },
      recipient: { organisation: { careUnitId: hsaAttr(mottagareHsa) } },
      questionFormulation: {
        text: kort(fragestallning, 8192),
        clinicalInformation: anamnes ? { text: kort(anamnes, 8192) } : null,
        condition: diagnoser.length ? diagnoser.map(d => ({ text: kort(d.text, 512), code: { code: d.kod, codeSystem: OID.icd10, codeSystemName: 'ICD-10-SE', displayName: kort(d.text, 512) } })) : null,
      },
    },
  };
}

const resultat = (kod, message = null, errorCode = null) => ({ result: { resultCode: kod, errorCode, message } });

// Händelsen sparas en gång per meddelande.
function handelse(db, rad, kontrakt, kod, meddelandeId, t = null) {
  return db.query('INSERT OR IGNORE INTO eremiss_handelser (remiss_id, patient_id, enhet_id, kontrakt, kod, meddelande_id, tid, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(rad.remiss_id, rad.patient_id, rad.enhet_id, kontrakt, kod, meddelandeId, iso(), t ? kort(t, 2000) : null).changes > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Utgående remiss
// ---------------------------------------------------------------------------------------------------------------
export function mottagare() { return mottagareRader().map(m => ({ hsaId: m.hsaId, namn: m.namn, vardgivare: m.vardgivare })); }

export async function skicka(atk, p, body = {}, nu = new Date()) {
  atk.krav('remittera');
  const m = mottagareRader().find(x => x.hsaId === body.mottagare);
  const falt = [];
  if (!m) falt.push('mottagare');
  const fragestallning = typeof body.fragestallning === 'string' ? body.fragestallning.trim() : '';
  if (fragestallning.length < 3 || fragestallning.length > 8000) falt.push('fragestallning');
  const anamnes = typeof body.anamnes === 'string' ? body.anamnes.trim().slice(0, 8000) : '';
  const prioritet = body.prioritet ?? 'normal';
  if (!PRIORITETER.includes(prioritet)) falt.push('prioritet');
  if (falt.length) throw new Fel(400, 'Välj en mottagare och skriv en frågeställning.', 'ogiltig', { falt });
  const pid = personId(p);
  if (!pid) throw new Fel(400, 'Patienten har inget personnummer eller samordningsnummer. En e-remiss kräver ett av dem. Skicka remissen på papper eller registrera patientens identitet först.', 'ogiltig');
  const db = atk.db;
  const enhet = ve(db, atk.personal.enhet_id);
  const avsandare = db.query('SELECT id, namn, hsa_id FROM personal WHERE id = ?').get(atk.personal.id);
  const t = iso(nu);
  const remissId = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skickad', ?)`).run(p.id, enhet.id, EXTERN, avsandare.id, fragestallning, anamnes || null, prioritet, addDagar(datumAv(nu), prioritet === 'akut' ? 1 : prioritet === 'skyndsam' ? 7 : 30), t).lastInsertRowid);
  const requestId = reqId(enhet.hsa_id, randomUUID());
  db.query('INSERT INTO eremisser (remiss_id, patient_id, enhet_id, riktning, request_id, motpart_hsa, motpart_namn, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(remissId, p.id, enhet.id, 'ut', requestId, m.hsaId, m.namn, t);
  const begaran = remissBegaran({ requestId, patient: p, pid, avsandare, enhet, mottagareHsa: m.hsaId, fragestallning, anamnes, diagnoser: diagnoserForRemiss(atk), datum: datumRiv(datumAv(nu)), tid: tidRiv(nu) });
  atk.logga('remittera', atk.grund(), `remiss:${remissId}:eremiss`);
  let svar = null;
  let orsak = null;
  try { svar = await r3.anropa(db, DEF.remiss(), { logiskAdress: m.hsaId, begaran, transport: transportTill(db) }); } catch (x) { if (!(x instanceof r3.RivtaFel)) throw x; orsak = x.message; }
  if (!svar || svar.result?.resultCode !== 'OK') {
    // Remissen står kvar som skickad med larm, så att den inte glöms. Mottagaren nås inte, och felet förklaras.
    throw new Fel(502, `${m.namn} tog inte emot e-remissen. ${orsak ?? svar?.result?.message ?? 'Okänt fel.'} Remissen finns kvar som skickad och larmar om den inte kvitteras.`, 'motpart');
  }
  await r3.leverera(db);
  return { remissId, mottagare: m.namn, text: `E-remissen är skickad till ${m.namn}. Statusen uppdateras av sig själv när mottagaren svarar.` };
}

// Mottagarens besked på en utgående remiss (producent för ProcessRequestConfirmation). Grunden har redan prövat kuvertet,
// schemat, att adressen är en vårdenhet och att avsändaren är ansluten.
const pnrFor = (db, patientId) => personId(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(patientId) ?? {})?.extension ?? null;
export function taEmotBesked(ctx, { begaran: m, logiskAdress, konsument }) {
  const { db } = ctx;
  const b = m.requestConfirmation;
  const requestId = b.requestId?.['@extension'];
  const beskedId = b.requestConfirmationId?.['@extension'];
  const kod = b.typeOfRequestConfirmation?.['@code'];
  const rad = requestId ? db.query("SELECT * FROM eremisser WHERE request_id = ? AND riktning = 'ut'").get(requestId) : null;
  if (!rad) return resultat('ERROR', 'Remissen finns inte i Vårdkällan.', 'APPLICATION_ERROR');
  if (logiskAdress !== ve(db, rad.enhet_id).hsa_id) return resultat('ERROR', 'Den logiska adressen är inte den vårdenhet som skickade remissen.', 'VALIDATION_ERROR');
  if (b.confirmingOrganisation?.careUnitId?.['@extension'] !== rad.motpart_hsa || konsument?.hsaId !== rad.motpart_hsa) return resultat('ERROR', 'Beskedet kommer inte från den enhet som remissen skickades till.', 'APPLICATION_ERROR');
  if (b.patient?.personId?.['@extension'] !== pnrFor(db, rad.patient_id)) return resultat('ERROR', 'Patienten i beskedet är inte remissens patient.', 'APPLICATION_ERROR');
  const textB = b.outcome?.outcomeText ?? null;
  if (handelse(db, rad, KONTRAKT.besked, kod, beskedId, textB)) {
    const r = db.query('SELECT * FROM remisser WHERE id = ?').get(rad.remiss_id);
    const t = iso();
    if (kod === 'BEK' && r.status === 'skickad') db.query("UPDATE remisser SET status = 'mottagen', mottagen_tid = ? WHERE id = ?").run(t, r.id);
    if (['AVV', 'AVB'].includes(kod) && ['skickad', 'mottagen'].includes(r.status)) {
      db.query("UPDATE remisser SET status = 'bedomd', mottagen_tid = coalesce(mottagen_tid, ?), bedomd_tid = ?, beslut = 'avvisad', motivering = ? WHERE id = ?")
        .run(t, t, kort(`${BESKED[kod]} av ${rad.motpart_namn}. ${textB ?? ''}`.trim(), 2000), r.id);
    }
  }
  return resultat('OK');
}

// Svaret på en utgående remiss (producent för ProcessRequestOutcome). Ett slutsvar gör remissen besvarad, och den som
// skickade den kvitterar svaret som vanligt.
export function taEmotSvar(ctx, { begaran: m, logiskAdress, konsument }) {
  const { db } = ctx;
  const o = m.requestOutcome;
  const requestId = o.requestId?.['@extension'];
  const svarId = o.requestOutcomeId?.['@extension'];
  const kod = o.typeOfRequestOutcome?.['@code'];
  const rad = requestId ? db.query("SELECT * FROM eremisser WHERE request_id = ? AND riktning = 'ut'").get(requestId) : null;
  if (!rad) return resultat('ERROR', 'Remissen finns inte i Vårdkällan.', 'APPLICATION_ERROR');
  if (logiskAdress !== ve(db, rad.enhet_id).hsa_id) return resultat('ERROR', 'Den logiska adressen är inte den vårdenhet som skickade remissen.', 'VALIDATION_ERROR');
  if (o.respondingOrganisation?.careUnitId?.['@extension'] !== rad.motpart_hsa || konsument?.hsaId !== rad.motpart_hsa) return resultat('ERROR', 'Svaret kommer inte från den enhet som remissen skickades till.', 'APPLICATION_ERROR');
  if (o.patient?.personId?.['@extension'] !== pnrFor(db, rad.patient_id)) return resultat('ERROR', 'Patienten i svaret är inte remissens patient.', 'APPLICATION_ERROR');
  const textS = o.outcome?.outcomeText ?? '';
  const r = db.query('SELECT * FROM remisser WHERE id = ?').get(rad.remiss_id);
  if (kod === 'SSV' && r.status === 'bedomd' && r.beslut === 'avvisad') return resultat('ERROR', 'Remissen är avvisad och kan inte besvaras.', 'APPLICATION_ERROR');
  if (handelse(db, rad, KONTRAKT.svar, kod, svarId, textS) && kod === 'SSV' && ['skickad', 'mottagen', 'bedomd'].includes(r.status)) {
    const t = iso();
    db.query(`UPDATE remisser SET status = 'besvarad', mottagen_tid = coalesce(mottagen_tid, ?), bedomd_tid = coalesce(bedomd_tid, ?), beslut = coalesce(beslut, 'accepterad'),
      besvarad_tid = ?, svar = ? WHERE id = ?`).run(t, t, t, kort(`${textS}\n\nSvar från ${rad.motpart_namn} via e-remiss.`, 8000), r.id);
  }
  return resultat('OK');
}

// ---------------------------------------------------------------------------------------------------------------
// Inkommande remiss: producent för ProcessRequest. Den logiska adressen är den mottagande vårdenhetens HSA-id.
// ---------------------------------------------------------------------------------------------------------------
export const AVSANDARE_SYSTEM = 'e-remiss';
export function taEmotRemiss(ctx, { begaran: m, logiskAdress, konsument }) {
  const { db } = ctx;
  const q = m.request;
  const requestId = q.requestId['@extension'];
  if (q.recipient?.organisation?.careUnitId?.['@extension'] !== logiskAdress) return resultat('ERROR', 'Mottagaren i remissen är inte den logiska adressen.', 'VALIDATION_ERROR');
  const franHsa = q.requestOrganisation?.careUnitId?.['@extension'] ?? '';
  if (konsument?.hsaId !== franHsa) return resultat('ERROR', 'Den remitterande enheten är inte den organisation som skickar remissen.', 'VALIDATION_ERROR');
  const till = db.query("SELECT id, hsa_id, namn FROM enheter WHERE hsa_id = ? AND typ = 'vardenhet'").get(logiskAdress);
  if (!till) return resultat('ERROR', 'Den mottagande vårdenheten finns inte i Vårdkällan.', 'APPLICATION_ERROR');
  if (db.query('SELECT 1 FROM eremisser WHERE request_id = ?').get(requestId)) return resultat('INFO', 'Remissen är redan mottagen.');
  const pnr = q.patient?.personId?.['@extension'];
  const p = /^\d{12}$/.test(pnr ?? '') ? db.query('SELECT * FROM patienter WHERE personnummer = ?').get(pnr) : null;
  // Samma svar för en patient som inte finns och ett fel personnummer, så att avsändaren inte kan pröva vilka som finns.
  if (!p) return resultat('ERROR', 'Patienten kan inte tas emot på vårdenheten. Kontakta vårdenheten.', 'APPLICATION_ERROR');
  const franNamn = q.requestOrganisation?.careUnitName || franHsa;
  const fragestallning = q.questionFormulation?.text ?? '';
  if (fragestallning.trim().length < 3) return resultat('ERROR', 'Frågeställningen saknas.', 'VALIDATION_ERROR');
  const anamnes = q.questionFormulation?.clinicalInformation?.text ?? '';
  const diagnoser = (q.questionFormulation?.condition ?? []).map(c => [c.code?.code, c.text ?? c.code?.displayName].filter(Boolean).join(' ')).filter(Boolean);
  const remittent = q.author?.healthcareProfessional?.name || null;
  const datum = q.author?.date?.['@value'] ?? '';
  const remissdatum = /^\d{8}$/.test(datum) ? `${datum.slice(0, 4)}-${datum.slice(4, 6)}-${datum.slice(6, 8)}` : datumAv();
  const t = iso();
  const katalog = HSA_KATALOG.find(x => x.hsaId === franHsa);
  const id = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, 'skickad', ?)`).run(p.id, EXTERN, till.id, EXTERN, kort(fragestallning.trim(), 2000), kort([anamnes, diagnoser.length ? `Diagnoser enligt remittenten: ${diagnoser.join(', ')}.` : ''].filter(Boolean).join('\n\n'), 8000) || null, addDagar(datumAv(), 14), t).lastInsertRowid);
  db.query('INSERT INTO remiss_extern (remiss_id, enhet, vardgivare, hsa_id, remittent, remissdatum, registrerad_av, registrerad_tid, skanning_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run(id, kort(franNamn, 120), katalog?.vardgivare ?? null, franHsa || null, remittent ? kort(remittent, 120) : null, remissdatum, AVSANDARE_SYSTEM, t);
  db.query('INSERT INTO eremisser (remiss_id, patient_id, enhet_id, riktning, request_id, motpart_hsa, motpart_namn, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, p.id, till.id, 'in', requestId, franHsa, kort(franNamn, 120), t);
  return resultat('OK');
}

// När vårdenheten tar emot, avvisar eller besvarar en inkommande e-remiss skickar systemet beskedet till avsändaren.
// Anropas från remiss.js efter att statusen är sparad. Ett fel hos avsändaren ändrar inte remissen i Vårdkällan, men
// syns i meddelandeloggen.
export async function efterHandling(db, personal, remissId, handling) {
  let rad;
  try { rad = db.query("SELECT * FROM eremisser WHERE remiss_id = ? AND riktning = 'in'").get(remissId); } catch { return null; }
  if (!rad) return null;
  const r = db.query('SELECT * FROM remisser WHERE id = ?').get(remissId);
  const pid = personId(db.query('SELECT * FROM patienter WHERE id = ?').get(rad.patient_id));
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(rad.enhet_id);
  const pers = db.query('SELECT namn, hsa_id FROM personal WHERE id = ?').get(personal.id);
  const resten = (orgNamn) => ({
    patient: { personId: { '@extension': pid.extension, '@root': pid.root } },
    [orgNamn]: { careUnitId: hsaAttr(enhet.hsa_id), careUnitName: kort(enhet.namn, 128) },
    author: { healthcareProfessional: { id: hsaAttr(pers.hsa_id), name: kort(pers.namn, 64) }, healthcareProfessionalOrganisation: { careUnitId: hsaAttr(enhet.hsa_id) } },
    recipient: { organisation: { careUnitId: hsaAttr(rad.motpart_hsa) } },
  });
  let d; let begaran; let kod;
  if (handling === 'mottag' || (handling === 'bedom' && r.beslut === 'avvisad')) {
    kod = handling === 'mottag' ? 'BEK' : 'AVV';
    d = DEF.besked();
    begaran = { requestConfirmation: {
      requestId: { '@extension': rad.request_id }, requestConfirmationId: { '@extension': reqId(enhet.hsa_id, randomUUID()) }, typeOfRequestConfirmation: { '@code': kod },
      requestVersionNumber: '1', requestConfirmationTime: { '@value': tidRiv() }, ...resten('confirmingOrganisation'),
      outcome: { outcomeText: kod === 'BEK' ? `Remissen är mottagen av ${enhet.namn}.` : kort(r.motivering ?? 'Remissen är avvisad.', 8192) },
    } };
  } else if (handling === 'svara') {
    kod = 'SSV';
    d = DEF.svar();
    begaran = { requestOutcome: {
      requestId: { '@extension': rad.request_id }, requestOutcomeId: { '@extension': reqId(enhet.hsa_id, randomUUID()) }, typeOfRequestOutcome: { '@code': 'SSV' },
      requestVersionNumber: '1', requestOutcomeTime: { '@value': tidRiv() }, ...resten('respondingOrganisation'),
      outcome: { outcomeText: kort(r.svar ?? '', 65000) },
    } };
  } else return null;
  let ok = false;
  try { ok = (await r3.anropa(db, d, { logiskAdress: rad.motpart_hsa, begaran, transport: transportTill(db) })).result?.resultCode === 'OK'; } catch (x) { if (!(x instanceof r3.RivtaFel)) throw x; }
  handelse(db, rad, d.namn, kod, `ut-${handling}-${remissId}`, ok ? null : 'Beskedet kom inte fram till avsändaren. Det syns i anropsloggen.');
  return ok;
}

// Transporten till de externa vårdgivarna. I demon är den simulerad i samma process och sätts av eremiss-simulerad.js.
let transportTill = () => { throw new r3.RivtaFel('transport', 'Ingen extern vårdgivare är ansluten.'); };
export const sattTransport = (fn) => { transportTill = fn; };

// Vårdkällans producenter för e-remiss, adresserade till vårdenheterna. Bara anslutna externa vårdgivare får anropa.
r3.vardenheter.registrera(DEF.remiss(), taEmotRemiss);
r3.vardenheter.registrera(DEF.besked(), taEmotBesked);
r3.vardenheter.registrera(DEF.svar(), taEmotSvar);
export const anslut = (hsaId, namn) => { for (const k of Object.values(KONTRAKT)) r3.tillat(k, hsaId, namn); };

// Det som remissvyn visar om en e-remiss: mottagaren eller avsändaren, och händelserna. Bara för den som redan ser
// remissen (remissUt i remiss.js), utan fritext för den som inte läser kliniska uppgifter.
export function tillagg(db, r, klinisk) {
  let rad;
  try { rad = db.query('SELECT * FROM eremisser WHERE remiss_id = ?').get(r.id); } catch { return {}; }
  if (!rad) return {};
  const h = db.query('SELECT kontrakt, kod, tid, text FROM eremiss_handelser WHERE remiss_id = ? ORDER BY tid, id').all(r.id);
  const ut = {
    eremiss: {
      riktning: rad.riktning, motpart: rad.motpart_namn, simulerad: true,
      handelser: h.map(x => ({ text: x.kontrakt === KONTRAKT.svar ? SVARSTYP[x.kod] : BESKED[x.kod], tid: x.tid, ...(klinisk && x.text && x.kod !== 'SSV' ? { meddelande: x.text } : {}) })),
      kanSvaraSimulerat: rad.riktning === 'ut' && ['skickad', 'mottagen'].includes(r.status),
    },
  };
  if (rad.riktning === 'ut') ut.till = { id: EXTERN, namn: rad.motpart_namn };
  return ut;
}
