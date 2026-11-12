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
// Motparterna är simulerade (eremiss-simulerad.js) och märkta som simulerade. Inget lämnar demon.
import { randomUUID } from 'node:crypto';
import { Fel, iso, datumAv, addDagar } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import { e, tolka, text, hitta, xml, XmlFel } from './rivta-r3-xml.js';
import * as transport from './rivta-r3-transport.js';
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
export const sakra = (db) => { db.exec(SCHEMA); transport.sakra(db); };

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
  const rader = atk.db.query('SELECT id, enhet_id, kod, text FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC LIMIT 20').all(atk.patientId)
    .filter(d => vardenhetFor(atk.db, d.enhet_id) === min);
  return atk.filtrera(rader, 'las_diagnoser').slice(0, 5);
}

// ProcessRequest 2.3, i schemats ordning.
export function remissKropp({ requestId, version = 1, skal = 'NR', patient, pid, avsandare, enhet, mottagareHsa, fragestallning, anamnes, diagnoser = [], datum, tid }) {
  const kon = patient.kon === 'kvinna' ? '2' : patient.kon === 'man' ? '1' : '0';
  return e('pr:ProcessRequest', [
    e('core:request', [
      e('core:requestId', null, { extension: requestId }),
      e('core:typeOfRequest', null, { code: '4' }),
      e('core:versionTimeStamp', null, { value: tid }),
      e('core:versionNumber', String(version)),
      e('core:reasonForVersion', [e('core:typeOfReason', null, { code: skal })]),
      e('core:careResponsibilityRemains', 'true'),
      e('core:patient', [
        e('core:personId', null, { extension: pid.extension, root: pid.root }),
        // Namn och adress följer inte med för en patient med skyddade personuppgifter.
        patient.skyddad ? null : e('core:name', kort(`${patient.fornamn} ${patient.efternamn}`, 128)),
        e('core:gender', null, { code: kon }),
        e('core:dateOfBirth', null, { value: datumRiv(patient.fodd) }),
      ]),
      e('core:requestOrganisation', [e('core:careUnitId', null, { extension: enhet.hsa_id }), e('core:careUnitName', kort(enhet.namn, 128))]),
      e('core:author', [
        e('core:date', null, { value: datum }),
        e('core:healthcareProfessional', [e('core:id', null, { extension: avsandare.hsa_id }), e('core:name', kort(avsandare.namn, 64))]),
        e('core:healthcareProfessionalOrganisation', [e('core:careUnitId', null, { extension: enhet.hsa_id })]),
      ]),
      e('core:recipient', [e('core:organisation', [e('core:careUnitId', null, { extension: mottagareHsa })])]),
      e('core:questionFormulation', [
        e('core:text', kort(fragestallning, 8192)),
        anamnes ? e('core:clinicalInformation', [e('core:text', kort(anamnes, 8192))]) : null,
        diagnoser.map(d => e('core:condition', [e('core:text', kort(d.text, 512)),
          e('core:code', [e('core:code', d.kod), e('core:codeSystem', OID.icd10), e('core:codeSystemName', 'ICD-10-SE'), e('core:displayName', kort(d.text, 512))])])),
      ]),
    ]),
  ]);
}

const resultatSvar = (rotNs, rot, kod, t = null, felkod = null) => xml(e(`${rot}:${rot === 'pr' ? 'ProcessRequestResponse' : rot === 'bek' ? 'ProcessRequestConfirmationResponse' : 'ProcessRequestOutcomeResponse'}`, [
  e(`${rot}:result`, [e('core:resultCode', kod), e('core:errorCode', felkod), e('core:message', t)]),
]), { [rot]: rotNs, core: NS.core });

// Händelsen sparas en gång per meddelande.
function handelse(db, rad, kontrakt, kod, meddelandeId, t = null) {
  return db.query('INSERT OR IGNORE INTO eremiss_handelser (remiss_id, patient_id, enhet_id, kontrakt, kod, meddelande_id, tid, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(rad.remiss_id, rad.patient_id, rad.enhet_id, kontrakt, kod, meddelandeId, iso(), t ? kort(t, 2000) : null).changes > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Utgående remiss
// ---------------------------------------------------------------------------------------------------------------
export function mottagare() { return mottagareRader().map(m => ({ hsaId: m.hsaId, namn: m.namn, vardgivare: m.vardgivare })); }

export function skicka(atk, p, body = {}, nu = new Date()) {
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
  const kropp = remissKropp({ requestId, patient: p, pid, avsandare, enhet, mottagareHsa: m.hsaId, fragestallning, anamnes, diagnoser: diagnoserForRemiss(atk), datum: datumRiv(datumAv(nu)), tid: tidRiv(nu) });
  const r = transport.anropa(db, { kontrakt: KONTRAKT.remiss, logiskAdress: m.hsaId, kropp, ns: { pr: NS.pr, core: NS.core }, patientId: p.id, enhetId: enhet.id });
  const kod = r.svar ? text(r.svar, 'result/resultCode') : null;
  atk.logga('remittera', atk.grund(), `remiss:${remissId}:eremiss`);
  if (r.fel || kod !== 'OK') {
    // Remissen står kvar som skickad med larm, så att den inte glöms. Mottagaren nås inte, och felet förklaras.
    const orsak = r.fel ?? (r.svar ? text(r.svar, 'result/message') : null) ?? 'okänt fel';
    transport.logga(db, { kontrakt: KONTRAKT.remiss, riktning: 'ut', logiskAdress: m.hsaId, motpart: MOTPART, patientId: p.id, enhetId: enhet.id, resultat: 'fel', text: kort(orsak, 200), kropp: r.xml });
    throw new Fel(502, `${m.namn} tog inte emot e-remissen. ${orsak} Remissen finns kvar som skickad och larmar om den inte kvitteras.`, 'motpart');
  }
  transport.logga(db, { kontrakt: KONTRAKT.remiss, riktning: 'ut', logiskAdress: m.hsaId, motpart: MOTPART, patientId: p.id, enhetId: enhet.id, resultat: 'ok', kropp: r.xml });
  transport.leverera(db);
  return { remissId, mottagare: m.namn, text: `E-remissen är skickad till ${m.namn}. Statusen uppdateras av sig själv när mottagaren svarar.` };
}

// Mottagarens besked på en utgående remiss (producent för ProcessRequestConfirmation).
export function taEmotBesked(db, kroppXml, { logiskAdress } = {}) {
  const svara = (kod, t = null, f = null) => resultatSvar(NS.bek, 'bek', kod, t, f);
  const avvisa = (t, rad = null) => {
    transport.logga(db, { kontrakt: KONTRAKT.besked, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: rad?.patient_id, enhetId: rad?.enhet_id, resultat: 'avvisad', text: t, kropp: kroppXml });
    return svara('ERROR', t, 'VALIDATION_ERROR');
  };
  let m;
  try { m = tolka(kroppXml); } catch (x) { return avvisa(x instanceof XmlFel ? x.message : 'Meddelandet gick inte att tolka.'); }
  if (m.n !== 'ProcessRequestConfirmation' || m.ns !== NS.bek) return avvisa('Meddelandet är inte ProcessRequestConfirmation version 2.');
  const b = hitta(m, 'requestConfirmation');
  const requestId = hitta(b, 'requestId')?.a.extension;
  const beskedId = hitta(b, 'requestConfirmationId')?.a.extension;
  const kod = hitta(b, 'typeOfRequestConfirmation')?.a.code;
  const avsandare = hitta(b, 'confirmingOrganisation/careUnitId')?.a.extension;
  const rad = requestId ? db.query("SELECT * FROM eremisser WHERE request_id = ? AND riktning = 'ut'").get(requestId) : null;
  if (!rad) return avvisa('Remissen finns inte i Vårdkällan.');
  if (!beskedId || !Object.hasOwn(BESKED, kod ?? '')) return avvisa('Beskedet har ingen giltig typ eller identitet.', rad);
  const agare = ve(db, rad.enhet_id);
  if (logiskAdress && logiskAdress !== agare.hsa_id) return avvisa('Den logiska adressen är inte den vårdenhet som skickade remissen.', rad);
  if (avsandare !== rad.motpart_hsa) return avvisa('Beskedet kommer inte från den enhet som remissen skickades till.', rad);
  if (hitta(b, 'patient/personId')?.a.extension !== personId(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(rad.patient_id)).extension) return avvisa('Patienten i beskedet är inte remissens patient.', rad);
  const textB = text(b, 'outcome/outcomeText');
  if (handelse(db, rad, KONTRAKT.besked, kod, beskedId, textB)) {
    const r = db.query('SELECT * FROM remisser WHERE id = ?').get(rad.remiss_id);
    const t = iso();
    if (kod === 'BEK' && r.status === 'skickad') db.query("UPDATE remisser SET status = 'mottagen', mottagen_tid = ? WHERE id = ?").run(t, r.id);
    if (['AVV', 'AVB'].includes(kod) && ['skickad', 'mottagen'].includes(r.status)) {
      db.query("UPDATE remisser SET status = 'bedomd', mottagen_tid = coalesce(mottagen_tid, ?), bedomd_tid = ?, beslut = 'avvisad', motivering = ? WHERE id = ?")
        .run(t, t, kort(`${BESKED[kod]} av ${rad.motpart_namn}. ${textB ?? ''}`.trim(), 2000), r.id);
    }
  }
  transport.logga(db, { kontrakt: KONTRAKT.besked, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: rad.patient_id, enhetId: rad.enhet_id, resultat: 'ok', text: kod, kropp: kroppXml });
  return svara('OK');
}

// Svaret på en utgående remiss (producent för ProcessRequestOutcome). Ett slutsvar gör remissen besvarad, och den som
// skickade den kvitterar svaret som vanligt.
export function taEmotSvar(db, kroppXml, { logiskAdress } = {}) {
  const svara = (kod, t = null, f = null) => resultatSvar(NS.svar, 'svar', kod, t, f);
  const avvisa = (t, rad = null) => {
    transport.logga(db, { kontrakt: KONTRAKT.svar, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: rad?.patient_id, enhetId: rad?.enhet_id, resultat: 'avvisad', text: t, kropp: kroppXml });
    return svara('ERROR', t, 'VALIDATION_ERROR');
  };
  let m;
  try { m = tolka(kroppXml); } catch (x) { return avvisa(x instanceof XmlFel ? x.message : 'Meddelandet gick inte att tolka.'); }
  if (m.n !== 'ProcessRequestOutcome' || m.ns !== NS.svar) return avvisa('Meddelandet är inte ProcessRequestOutcome version 2.');
  const o = hitta(m, 'requestOutcome');
  const requestId = hitta(o, 'requestId')?.a.extension;
  const svarId = hitta(o, 'requestOutcomeId')?.a.extension;
  const kod = hitta(o, 'typeOfRequestOutcome')?.a.code;
  const avsandare = hitta(o, 'respondingOrganisation/careUnitId')?.a.extension;
  const rad = requestId ? db.query("SELECT * FROM eremisser WHERE request_id = ? AND riktning = 'ut'").get(requestId) : null;
  if (!rad) return avvisa('Remissen finns inte i Vårdkällan.');
  if (!svarId || !Object.hasOwn(SVARSTYP, kod ?? '')) return avvisa('Svaret har ingen giltig typ eller identitet.', rad);
  const agare = ve(db, rad.enhet_id);
  if (logiskAdress && logiskAdress !== agare.hsa_id) return avvisa('Den logiska adressen är inte den vårdenhet som skickade remissen.', rad);
  if (avsandare !== rad.motpart_hsa) return avvisa('Svaret kommer inte från den enhet som remissen skickades till.', rad);
  if (hitta(o, 'patient/personId')?.a.extension !== personId(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(rad.patient_id)).extension) return avvisa('Patienten i svaret är inte remissens patient.', rad);
  const textS = text(o, 'outcome/outcomeText') ?? '';
  const r = db.query('SELECT * FROM remisser WHERE id = ?').get(rad.remiss_id);
  if (kod === 'SSV' && (r.status === 'bedomd' && r.beslut === 'avvisad')) return avvisa('Remissen är avvisad och kan inte besvaras.', rad);
  if (handelse(db, rad, KONTRAKT.svar, kod, svarId, textS) && kod === 'SSV' && ['skickad', 'mottagen', 'bedomd'].includes(r.status)) {
    const t = iso();
    db.query(`UPDATE remisser SET status = 'besvarad', mottagen_tid = coalesce(mottagen_tid, ?), bedomd_tid = coalesce(bedomd_tid, ?), beslut = coalesce(beslut, 'accepterad'),
      besvarad_tid = ?, svar = ? WHERE id = ?`).run(t, t, t, kort(`${textS}\n\nSvar från ${rad.motpart_namn} via e-remiss.`, 8000), r.id);
  }
  transport.logga(db, { kontrakt: KONTRAKT.svar, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: rad.patient_id, enhetId: rad.enhet_id, resultat: 'ok', text: kod, kropp: kroppXml });
  return svara('OK');
}

// ---------------------------------------------------------------------------------------------------------------
// Inkommande remiss: producent för ProcessRequest. Den logiska adressen är den mottagande vårdenhetens HSA-id.
// ---------------------------------------------------------------------------------------------------------------
export const AVSANDARE_SYSTEM = 'e-remiss';
export function taEmotRemiss(db, kroppXml, { logiskAdress } = {}) {
  const svara = (kod, t = null, f = null) => resultatSvar(NS.pr, 'pr', kod, t, f);
  const avvisa = (t, f = 'VALIDATION_ERROR') => {
    transport.logga(db, { kontrakt: KONTRAKT.remiss, riktning: 'in', logiskAdress, motpart: MOTPART, resultat: 'avvisad', text: t, kropp: kroppXml });
    return svara('ERROR', t, f);
  };
  let m;
  try { m = tolka(kroppXml); } catch (x) { return avvisa(x instanceof XmlFel ? x.message : 'Meddelandet gick inte att tolka.'); }
  if (m.n !== 'ProcessRequest' || m.ns !== NS.pr) return avvisa('Meddelandet är inte ProcessRequest version 2.');
  const q = hitta(m, 'request');
  const requestId = hitta(q, 'requestId')?.a.extension;
  if (!requestId || !/^.+#.+$/.test(requestId) || requestId.length > 256) return avvisa('Remissens identitet saknas eller har fel form.');
  if (hitta(q, 'typeOfRequest')?.a.code !== '4') return avvisa('Bara allmänremiss tas emot.');
  const tillHsa = hitta(q, 'recipient/organisation/careUnitId')?.a.extension;
  if (!logiskAdress || tillHsa !== logiskAdress) return avvisa('Mottagaren i remissen är inte den logiska adressen.');
  const till = db.query("SELECT id, hsa_id, namn FROM enheter WHERE hsa_id = ? AND typ = 'vardenhet'").get(tillHsa);
  if (!till) return avvisa('Den mottagande vårdenheten finns inte i Vårdkällan.', 'APPLICATION_ERROR');
  if (db.query('SELECT 1 FROM eremisser WHERE request_id = ?').get(requestId)) return svara('INFO', 'Remissen är redan mottagen.');
  const pnr = hitta(q, 'patient/personId')?.a.extension;
  const p = /^\d{12}$/.test(pnr ?? '') ? db.query('SELECT * FROM patienter WHERE personnummer = ?').get(pnr) : null;
  // Samma svar för en patient som inte finns och ett fel personnummer, så att avsändaren inte kan pröva vilka som finns.
  if (!p) return avvisa('Patienten kan inte tas emot på vårdenheten. Kontakta vårdenheten.', 'APPLICATION_ERROR');
  const franHsa = hitta(q, 'requestOrganisation/careUnitId')?.a.extension ?? '';
  const franNamn = text(q, 'requestOrganisation/careUnitName') || franHsa;
  const fragestallning = text(q, 'questionFormulation/text') ?? '';
  if (fragestallning.length < 3) return avvisa('Frågeställningen saknas.');
  const anamnes = text(q, 'questionFormulation/clinicalInformation/text') ?? '';
  const diagnoser = (hitta(q, 'questionFormulation')?.b ?? []).filter(x => x.n === 'condition').map(c => [text(c, 'code/code'), text(c, 'text') ?? text(c, 'code/displayName')].filter(Boolean).join(' ')).filter(Boolean);
  const remittent = text(q, 'author/healthcareProfessional/name') || null;
  const datum = hitta(q, 'author/date')?.a.value ?? '';
  const remissdatum = /^\d{8}$/.test(datum) ? `${datum.slice(0, 4)}-${datum.slice(4, 6)}-${datum.slice(6, 8)}` : datumAv();
  const t = iso();
  const katalog = HSA_KATALOG.find(x => x.hsaId === franHsa);
  const id = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, 'skickad', ?)`).run(p.id, EXTERN, till.id, EXTERN, kort(fragestallning, 2000), kort([anamnes, diagnoser.length ? `Diagnoser enligt remittenten: ${diagnoser.join(', ')}.` : ''].filter(Boolean).join('\n\n'), 8000) || null, addDagar(datumAv(), 14), t).lastInsertRowid);
  db.query('INSERT INTO remiss_extern (remiss_id, enhet, vardgivare, hsa_id, remittent, remissdatum, registrerad_av, registrerad_tid, skanning_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run(id, kort(franNamn, 120), katalog?.vardgivare ?? null, franHsa || null, remittent ? kort(remittent, 120) : null, remissdatum, AVSANDARE_SYSTEM, t);
  db.query('INSERT INTO eremisser (remiss_id, patient_id, enhet_id, riktning, request_id, motpart_hsa, motpart_namn, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, p.id, till.id, 'in', requestId, franHsa, kort(franNamn, 120), t);
  transport.logga(db, { kontrakt: KONTRAKT.remiss, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: p.id, enhetId: till.id, resultat: 'ok', kropp: kroppXml });
  return svara('OK');
}

// När vårdenheten tar emot, avvisar eller besvarar en inkommande e-remiss skickar systemet beskedet till avsändaren.
// Anropas från remiss.js efter att statusen är sparad. Ett fel hos avsändaren ändrar inte remissen i Vårdkällan, men
// syns i meddelandeloggen.
export function efterHandling(db, personal, remissId, handling) {
  const rad = db.query("SELECT * FROM eremisser WHERE remiss_id = ? AND riktning = 'in'").get(remissId);
  if (!rad) return null;
  const r = db.query('SELECT * FROM remisser WHERE id = ?').get(remissId);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(rad.patient_id);
  const pid = personId(p);
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(rad.enhet_id);
  const pers = db.query('SELECT namn, hsa_id FROM personal WHERE id = ?').get(personal.id);
  const gemensamt = (prefix) => [
    e('core:requestId', null, { extension: rad.request_id }),
    e(`core:${prefix}Id`, null, { extension: reqId(enhet.hsa_id, randomUUID()) }),
  ];
  const resten = (orgNamn) => [
    e('core:patient', [e('core:personId', null, { extension: pid.extension, root: pid.root })]),
    e(`core:${orgNamn}`, [e('core:careUnitId', null, { extension: enhet.hsa_id }), e('core:careUnitName', kort(enhet.namn, 128))]),
    e('core:author', [e('core:healthcareProfessional', [e('core:id', null, { extension: pers.hsa_id }), e('core:name', kort(pers.namn, 64))]),
      e('core:healthcareProfessionalOrganisation', [e('core:careUnitId', null, { extension: enhet.hsa_id })])]),
    e('core:recipient', [e('core:organisation', [e('core:careUnitId', null, { extension: rad.motpart_hsa })])]),
  ];
  let kropp; let kontrakt; let ns;
  if (handling === 'mottag' || (handling === 'bedom' && r.beslut === 'avvisad')) {
    const kod = handling === 'mottag' ? 'BEK' : 'AVV';
    kontrakt = KONTRAKT.besked; ns = { bek: NS.bek, core: NS.core };
    kropp = e('bek:ProcessRequestConfirmation', [e('core:requestConfirmation', [
      ...gemensamt('requestConfirmation'), e('core:typeOfRequestConfirmation', null, { code: kod }), e('core:requestVersionNumber', '1'),
      e('core:requestConfirmationTime', null, { value: tidRiv() }), ...resten('confirmingOrganisation'),
      e('core:outcome', [e('core:outcomeText', kod === 'BEK' ? `Remissen är mottagen av ${enhet.namn}.` : kort(r.motivering ?? 'Remissen är avvisad.', 8192))]),
    ])]);
  } else if (handling === 'svara') {
    kontrakt = KONTRAKT.svar; ns = { svar: NS.svar, core: NS.core };
    kropp = e('svar:ProcessRequestOutcome', [e('core:requestOutcome', [
      ...gemensamt('requestOutcome'), e('core:typeOfRequestOutcome', null, { code: 'SSV' }), e('core:requestVersionNumber', '1'),
      e('core:requestOutcomeTime', null, { value: tidRiv() }), ...resten('respondingOrganisation'),
      e('core:outcome', [e('core:outcomeText', kort(r.svar ?? '', 65000))]),
    ])]);
  } else return null;
  const svar = transport.anropa(db, { kontrakt, logiskAdress: rad.motpart_hsa, kropp, ns, patientId: rad.patient_id, enhetId: rad.enhet_id });
  const ok = svar.svar && text(svar.svar, 'result/resultCode') === 'OK';
  transport.logga(db, { kontrakt, riktning: 'ut', logiskAdress: rad.motpart_hsa, motpart: MOTPART, patientId: rad.patient_id, enhetId: rad.enhet_id, resultat: ok ? 'ok' : 'fel', text: ok ? null : kort(svar.fel ?? text(svar.svar, 'result/message') ?? 'okänt fel', 200), kropp: svar.xml });
  handelse(db, rad, kontrakt, handling === 'svara' ? 'SSV' : handling === 'mottag' ? 'BEK' : 'AVV', `ut-${handling}-${remissId}`, null);
  return ok;
}

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
