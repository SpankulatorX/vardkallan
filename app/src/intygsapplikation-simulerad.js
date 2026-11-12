// Runda 14, r3: en simulerad intygsapplikation i integrerat läge, för demon (Sussa 2.2.1.9). Den står för den del som
// Webcert och Intygstjänsten har i verkligheten: den tar emot CreateDraftCertificate, låter läkaren skriva och signera
// intyget, skickar det till mottagaren (simulerat, inget lämnar demon) och meddelar journalen varje händelse med
// CertificateStatusUpdateForCare. Den svarar också på ListCertificatesForCareWithQA.
//
// Den är inte Webcert och inte Ineras tjänst. Den kör i samma process och sandlåda som Vårdkällan och tar bara emot
// meddelanden genom samma kontrakt, kuvert och validering som en riktig intygsapplikation (src/rivta/). Reglerna för vilka intyg som får skrivas
// följer de regler som Webcert tillämpar för skyddade personuppgifter och avlidna, så att journalen kan visa samma sak.
// Personuppgifterna slås upp i sandlådans patienter, som en intygsapplikation slår upp dem i PU-tjänsten.
import { randomUUID } from 'node:crypto';
import { el } from './rivta/xml.js';
import { Fel, iso } from './db.js';
import { vardenhetFor, prova, visningsnamn, visningsPnr, kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import { avlidenFor } from './avliden.js';
import * as r3 from './rivta-r3.js';
import { KV, INTYGSTYPER, LOGISK_ADRESS_INTYGSAPPLIKATION, DEF, personId, sattTransport } from './lakarintyg.js';

export const NAMN = 'Intygsapplikation (simulerad, inte Webcert)';
// Påhittade värden som kontraktet kräver men som demon inte har. Märkta som demo.
const ARBETSPLATSKOD = 'DEMO0000';
const TELEFON = '000-000 00 00 (demo)';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_intygsapplikation (
  intygs_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, personnummer TEXT NOT NULL,
  personal_hsa TEXT NOT NULL, personal_namn TEXT NOT NULL, ref TEXT, status TEXT NOT NULL, skapad TEXT NOT NULL,
  signerad TEXT, signerad_av TEXT, skickad TEXT, makulerad TEXT, svar TEXT NOT NULL, handelser TEXT NOT NULL
);
`;
export const sakra = (db) => db.exec(SCHEMA);
const TYP = new Map(INTYGSTYPER.map(t => [t.kod, t]));

const svaraSkapa = (kod, resultText = null, errorId = null, intygsId = null, rot = null) => ({ 'intygs-id': intygsId ? { root: rot, extension: intygsId } : null, result: { resultCode: kod, resultText, errorId } });

const enhetPaHsa = (db, hsa) => db.query("SELECT id, hsa_id, namn FROM enheter WHERE hsa_id = ?").get(hsa);
const vardgivare = (db, enhetId) => {
  let id = enhetId;
  for (let i = 0; i < 8 && id; i++) {
    const r = db.query('SELECT id, hsa_id, namn, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!r) return null;
    if (r.typ === 'vardgivare') return r;
    id = r.forald_id;
  }
  return null;
};

// CreateDraftCertificate 3.3. Samma kontroller som en intygsapplikation: patient, läkare och vårdenhet ska finnas,
// intygstypen ska stödjas, och reglerna för skyddade personuppgifter och avlidna gäller.
function skapaUtkast(ctx, { begaran: m }) {
  const { db } = ctx;
  const i = m.intyg;
  const typ = i.typAvIntyg?.code;
  const pnr = i.patient?.['person-id']?.extension;
  const enhetHsa = i.skapadAv?.enhet?.['enhets-id']?.extension;
  const personalHsa = i.skapadAv?.['personal-id']?.extension;
  const personalNamn = i.skapadAv?.fullstandigtNamn;
  if (!TYP.has(typ ?? '') || i.typAvIntyg.codeSystem !== KV.intygstyp) return svaraSkapa('ERROR', `Intygstypen ${typ ?? ''} stöds inte.`, 'VALIDATION_ERROR');
  if (!i.patient.fornamn || !i.patient.efternamn) return svaraSkapa('ERROR', 'Patientens förnamn och efternamn krävs.', 'VALIDATION_ERROR');
  if (!personalHsa || !personalNamn) return svaraSkapa('ERROR', 'Läkarens HSA-id och namn krävs.', 'VALIDATION_ERROR');
  const enhet = enhetHsa ? enhetPaHsa(db, enhetHsa) : null;
  if (!enhet) return svaraSkapa('ERROR', 'Vårdenheten finns inte.', 'VALIDATION_ERROR');
  // Läkaren ska ha ett uppdrag på vårdenheten, som medarbetaruppdraget i en intygsapplikation.
  const pers = db.query('SELECT id, enhet_id FROM personal WHERE hsa_id = ? AND aktiv = 1').get(personalHsa);
  if (!pers || vardenhetFor(db, pers.enhet_id) !== enhet.id) return svaraSkapa('ERROR', 'Personen har inget uppdrag på vårdenheten.', 'VALIDATION_ERROR');
  // Personuppgifterna, som en intygsapplikation hämtar dem ur PU-tjänsten.
  const p = db.query('SELECT * FROM patienter WHERE personnummer = ?').get(pnr);
  if (!p) return svaraSkapa('ERROR', 'Personuppgiftstjänsten känner inte till personen.', 'APPLICATION_ERROR');
  const t = TYP.get(typ);
  if (p.skyddad && !t.sekretess) return svaraSkapa('ERROR', 'Intygstypen kan inte skrivas för en patient med skyddade personuppgifter.', 'APPLICATION_ERROR');
  const avliden = Boolean(avlidenFor(db, p.id));
  if (avliden !== t.avliden) return svaraSkapa('ERROR', avliden ? 'Patienten är avliden. Bara dödsbevis och dödsorsaksintyg kan skrivas.' : 'Intygstypen gäller bara en avliden patient.', 'APPLICATION_ERROR');
  const intygsId = randomUUID();
  // Förifyllnaden: de svar som går att använda följer med till utkastet.
  const svar = {};
  for (const sv of i.forifyllnad?.svar ?? []) {
    for (const d of sv.delsvar ?? []) {
      const cv = (d.$any ?? []).find(x => x.lokal === 'cv');
      if (d['@id'] === '6.2' && cv) {
        const v = (n) => cv.barn.find(x => x.lokal === n)?.text ?? null;
        svar.diagnosKod = v('code')?.slice(0, 10) ?? null;
        svar.diagnosText = v('displayName')?.slice(0, 200) ?? null;
      }
    }
  }
  const tid = iso();
  db.query("INSERT INTO sim_intygsapplikation (intygs_id, patient_id, enhet_id, typ, personnummer, personal_hsa, personal_namn, ref, status, skapad, svar, handelser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'utkast', ?, ?, '[]')")
    .run(intygsId, p.id, enhet.id, typ, pnr, personalHsa, personalNamn, i.ref ?? null, tid, JSON.stringify(svar));
  // Statusuppdateringen om det nya utkastet skickas efter svaret, som från en riktig intygsapplikation.
  r3.ko(db, () => handelse(db, intygsId, 'SKAPAT'));
  return svaraSkapa('OK', null, null, intygsId, enhet.hsa_id);
}

const ms = (d = new Date()) => d.toISOString().slice(0, 23);
const sek = (s) => (s ? s.slice(0, 19) : null);

const hsa = (x) => ({ root: KV.hsa, extension: x });
const kv = (code, codeSystem, displayName = null) => ({ code, codeSystem, displayName });
function intygObjekt(db, r, { med } = {}) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(r.enhet_id);
  const vg = vardgivare(db, r.enhet_id);
  const t = TYP.get(r.typ);
  const svar = JSON.parse(r.svar);
  const status = [];
  if (r.signerad) status.push({ part: kv('HSVARD', KV.part), status: kv('RECEIV', KV.status), tidpunkt: sek(r.signerad) });
  if (r.skickad) status.push({ part: kv(t.part, KV.part), status: kv('SENTTO', KV.status), tidpunkt: sek(r.skickad) });
  if (r.makulerad) status.push({ part: kv('HSVARD', KV.part), status: kv('CANCEL', KV.status), tidpunkt: sek(r.makulerad) });
  return {
    'intygs-id': { root: enhet.hsa_id, extension: r.intygs_id },
    mottagare: r.skickad ? [kv(t.part, KV.part)] : null,
    typ: kv(t.kod, KV.intygstyp, t.text), version: '1.0',
    signeringstidpunkt: sek(r.signerad), skickatTidpunkt: sek(r.skickad),
    patient: { 'person-id': personId(p), fornamn: p.fornamn, efternamn: p.efternamn, postadress: p.skyddad ? '' : (p.adress ?? ''), postnummer: p.skyddad ? '' : (p.postnr ?? ''), postort: p.skyddad ? '' : (p.ort ?? '') },
    skapadAv: {
      'personal-id': hsa(r.personal_hsa), fullstandigtNamn: r.personal_namn,
      enhet: {
        'enhets-id': hsa(enhet.hsa_id), arbetsplatskod: { root: '1.2.752.29.4.71', extension: ARBETSPLATSKOD }, enhetsnamn: enhet.namn,
        postadress: '', postnummer: '', postort: '', telefonnummer: TELEFON,
        vardgivare: { 'vardgivare-id': hsa(vg?.hsa_id ?? enhet.hsa_id), vardgivarnamn: vg?.namn ?? enhet.namn },
      },
    },
    status: status.length ? status : null,
    svar: med && svar.diagnosKod ? [{ '@id': '6', delsvar: [{ '@id': '6.2', $any: [el(NS_TYPES, 'cv', [el(NS_TYPES, 'code', svar.diagnosKod), el(NS_TYPES, 'codeSystem', KV.icd10), el(NS_TYPES, 'displayName', svar.diagnosText ?? svar.diagnosKod)])] }] }] : null,
  };
}
const NS_TYPES = 'urn:riv:clinicalprocess:healthcond:certificate:types:3';
const arenden = () => ({ totalt: 0, ejBesvarade: 0, besvarade: 0, hanterade: 0 });

// En händelse: statusen sparas hos intygsapplikationen och CertificateStatusUpdateForCare skickas till den vårdenhet som
// äger intyget. Ger journalens svar.
export async function handelse(db, intygsId, kod, nu = new Date()) {
  const r = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(intygsId);
  if (!r) return null;
  const h = JSON.parse(r.handelser);
  const tid = ms(nu);
  h.push({ kod, tid });
  db.query('UPDATE sim_intygsapplikation SET handelser = ? WHERE intygs_id = ?').run(JSON.stringify(h), intygsId);
  const enhet = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(r.enhet_id);
  const rad = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(intygsId);
  const begaran = { intyg: intygObjekt(db, rad, { med: true }), handelse: { handelsekod: kv(kod, KV.handelse), tidpunkt: tid }, skickadeFragor: arenden(), mottagnaFragor: arenden(), ref: r.ref };
  try {
    return await r3.anropa(db, DEF.status(), { logiskAdress: enhet.hsa_id, begaran, transport: r3.tillVardkallan(db, LOGISK_ADRESS_INTYGSAPPLIKATION) });
  } catch (x) {
    if (x instanceof r3.RivtaFel) return { fel: x.message };
    throw x;
  }
}

// ListCertificatesForCareWithQA 3.3: patientens intyg på de angivna vårdenheterna, med händelserna.
function lista(ctx, { begaran: m }) {
  const { db } = ctx;
  const pnr = m['person-id']?.extension;
  const ids = (m['enhets-id'] ?? []).map(x => enhetPaHsa(db, x.extension)?.id).filter(Boolean);
  if (!ids.length) return { list: { item: [] } };
  const rader = db.query(`SELECT * FROM sim_intygsapplikation WHERE personnummer = ? AND status != 'raderat' AND enhet_id IN (${ids.map(() => '?').join(',')})`).all(pnr, ...ids);
  return { list: { item: rader.map(r => ({
    intyg: intygObjekt(db, r),
    handelser: { handelse: JSON.parse(r.handelser).map(h => ({ handelsekod: kv(h.kod, KV.handelse), tidpunkt: h.tid })) },
    skickadeFragor: arenden(), mottagnaFragor: arenden(), ref: r.ref,
  })) } };
}

// ---------------------------------------------------------------------------------------------------------------
// Gränssnittet för den simulerade intygsapplikationen. Läkaren är inloggad i Vårdkällan, som i integrerat läge där
// inloggningen följer med. Bara personal på den vårdenhet som äger intyget kommer åt det, och varje läsning loggas på
// patienten som i journalen.
// ---------------------------------------------------------------------------------------------------------------
function hamta(db, personal, intygsId, handling = 'las_intyg') {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const r = typeof intygsId === 'string' && /^[0-9a-f-]{36}$/.test(intygsId) ? db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(intygsId) : null;
  const pr = r ? prova(db, { personal, patient: r.patient_id, handling, resurs: { enhet_id: r.enhet_id } }) : null;
  if (!r || !pr.tillaten || vardenhetFor(db, personal.enhet_id) !== r.enhet_id) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r && pr?.tillaten === false ? r.patient_id : null, handling, resurs: 'intygsapplikation', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(404, 'Intyget finns inte, eller så har du inget uppdrag på den vårdenhet som äger det.', 'saknas');
  }
  return { r, grund: pr.grund };
}
const STATUS = { utkast: 'Utkast', signerat: 'Signerat', skickat: 'Signerat och skickat', makulerat: 'Makulerat', raderat: 'Raderat' };
function ut(db, r, personal, visad) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
  const t = TYP.get(r.typ);
  const svar = JSON.parse(r.svar);
  return {
    intygsId: r.intygs_id, typ: r.typ, text: t.text, mottagare: t.mottagare, status: r.status, statusText: STATUS[r.status] ?? r.status,
    patient: { namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad), skyddad: Boolean(p.skyddad) },
    skapadAv: r.personal_namn, skapad: r.skapad, signerad: r.signerad, skickad: r.skickad,
    vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(r.enhet_id)?.namn ?? null,
    svar: { diagnosKod: svar.diagnosKod ?? null, diagnosText: svar.diagnosText ?? null, sysselsattning: svar.sysselsattning ?? null, nedsattning: svar.nedsattning ?? null, fran: svar.fran ?? null, till: svar.till ?? null, ovrigt: svar.ovrigt ?? null },
    patientId: r.patient_id, saknas: r.status === 'utkast' ? saknas(r) : [],
    kan: {
      andra: r.status === 'utkast' && kanRoll(personal, 'skriv_intyg'), signera: r.status === 'utkast' && personal.yrke === 'lakare',
      skicka: r.status === 'signerat' && kanRoll(personal, 'skriv_intyg'), makulera: ['signerat', 'skickat'].includes(r.status) && personal.yrke === 'lakare',
      radera: r.status === 'utkast' && kanRoll(personal, 'skriv_intyg'),
    },
    alternativ: { sysselsattning: SYSSELSATTNING_TEXT, nedsattning: NEDSATTNING_TEXT, period: ['LISJP', 'AG7804'].includes(r.typ) },
    simulerad: 'Simulerad intygsapplikation i demon. Den är inte Webcert, och inget intyg lämnar demon.',
  };
}
export function visa(db, personal, intygsId, val = {}) {
  const { r, grund } = hamta(db, personal, intygsId);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r.patient_id, handling: 'las_intyg', resurs: `intygsapplikation:${r.intygs_id}`, grund, resultat: 'tillaten' });
  return ut(db, r, personal, Boolean(val.visa_identitet));
}
const NEDSATTNING_TEXT = { heltid: 'Helt nedsatt', tre_fjardedelar: 'Nedsatt med tre fjärdedelar', halften: 'Nedsatt till hälften', en_fjardedel: 'Nedsatt med en fjärdedel' };
const SYSSELSATTNING_TEXT = { nuvarande_arbete: 'Nuvarande arbete', arbetssokande: 'Arbetssökande', foraldraledighet: 'Föräldraledighet', studier: 'Studier' };
const NEDSATTNING = Object.keys(NEDSATTNING_TEXT);
const SYSSELSATTNING = Object.keys(SYSSELSATTNING_TEXT);
export async function spara(db, personal, intygsId, body = {}, val = {}) {
  const { r, grund } = hamta(db, personal, intygsId, 'skriv_intyg');
  if (r.status !== 'utkast') throw new Fel(409, 'Ett signerat intyg kan inte ändras. Makulera det och skriv ett nytt.', 'konflikt');
  const s = JSON.parse(r.svar);
  const datum = (v) => (v == null || v === '' ? null : typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : (() => { throw new Fel(400, 'Datum ska skrivas ÅÅÅÅ-MM-DD.', 'ogiltig'); })());
  const val2 = (v, lista) => (v == null || v === '' ? null : lista.includes(v) ? v : (() => { throw new Fel(400, 'Välj ett av alternativen.', 'ogiltig'); })());
  const textv = (v, max) => (v == null ? null : typeof v === 'string' ? v.trim().slice(0, max) || null : (() => { throw new Fel(400, 'Texten ska vara text.', 'ogiltig'); })());
  const ny = { ...s, sysselsattning: val2(body.sysselsattning, SYSSELSATTNING) ?? s.sysselsattning ?? null, nedsattning: val2(body.nedsattning, NEDSATTNING) ?? s.nedsattning ?? null,
    fran: datum(body.fran) ?? s.fran ?? null, till: datum(body.till) ?? s.till ?? null, ovrigt: body.ovrigt !== undefined ? textv(body.ovrigt, 2000) : s.ovrigt ?? null };
  if (ny.fran && ny.till && ny.till < ny.fran) throw new Fel(400, 'Slutdatumet kan inte vara före startdatumet.', 'ogiltig');
  db.query('UPDATE sim_intygsapplikation SET svar = ? WHERE intygs_id = ?').run(JSON.stringify(ny), r.intygs_id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r.patient_id, handling: 'skriv_intyg', resurs: `intygsapplikation:${r.intygs_id}`, grund, resultat: 'tillaten' });
  await handelse(db, r.intygs_id, 'ANDRAT');
  return ut(db, db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(r.intygs_id), personal, Boolean(val.visa_identitet));
}
// Vad som saknas innan intyget kan signeras, på vanlig svenska.
export function saknas(r) {
  const s = JSON.parse(r.svar);
  const fel = [];
  if (['LISJP', 'AG7804'].includes(r.typ)) {
    if (!s.diagnosKod) fel.push('diagnos');
    if (!s.sysselsattning) fel.push('sysselsättning');
    if (!s.nedsattning) fel.push('hur mycket arbetsförmågan är nedsatt');
    if (!s.fran || !s.till) fel.push('period');
  }
  return fel;
}
export async function atgard(db, personal, intygsId, atgardNamn, val = {}) {
  const handlingar = { signera: 'skriv_intyg', skicka: 'skriv_intyg', makulera: 'skriv_intyg', radera: 'skriv_intyg' };
  if (!Object.hasOwn(handlingar, atgardNamn)) throw new Fel(404, 'Åtgärden finns inte.', 'saknas');
  const { r, grund } = hamta(db, personal, intygsId, handlingar[atgardNamn]);
  const tid = iso();
  if (atgardNamn === 'signera') {
    if (r.status !== 'utkast') throw new Fel(409, 'Intyget är redan signerat.', 'konflikt');
    if (personal.yrke !== 'lakare') throw new Fel(403, 'Bara en läkare signerar intyget.', 'nekad');
    const f = saknas(r);
    if (f.length) throw new Fel(400, `Fyll i ${f.join(', ')} innan intyget signeras.`, 'ogiltig');
    db.query("UPDATE sim_intygsapplikation SET status = 'signerat', signerad = ?, signerad_av = ? WHERE intygs_id = ?").run(tid, personal.hsa_id, r.intygs_id);
    await handelse(db, r.intygs_id, 'SIGNAT');
  } else if (atgardNamn === 'skicka') {
    if (r.status !== 'signerat') throw new Fel(409, 'Bara ett signerat intyg som inte är skickat kan skickas.', 'konflikt');
    db.query("UPDATE sim_intygsapplikation SET status = 'skickat', skickad = ? WHERE intygs_id = ?").run(tid, r.intygs_id);
    await handelse(db, r.intygs_id, 'SKICKA');
  } else if (atgardNamn === 'makulera') {
    if (!['signerat', 'skickat'].includes(r.status)) throw new Fel(409, 'Bara ett signerat intyg kan makuleras. Ett utkast raderas.', 'konflikt');
    if (personal.yrke !== 'lakare') throw new Fel(403, 'Bara en läkare makulerar intyget.', 'nekad');
    db.query("UPDATE sim_intygsapplikation SET status = 'makulerat', makulerad = ? WHERE intygs_id = ?").run(tid, r.intygs_id);
    await handelse(db, r.intygs_id, 'MAKULE');
  } else {
    if (r.status !== 'utkast') throw new Fel(409, 'Ett signerat intyg raderas inte. Makulera det i stället.', 'konflikt');
    db.query("UPDATE sim_intygsapplikation SET status = 'raderat' WHERE intygs_id = ?").run(r.intygs_id);
    await handelse(db, r.intygs_id, 'RADERA');
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r.patient_id, handling: 'skriv_intyg', resurs: `intygsapplikation:${r.intygs_id}:${atgardNamn}`, grund, resultat: 'tillaten' });
  return ut(db, db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(r.intygs_id), personal, Boolean(val.visa_identitet));
}

// Den simulerade intygsapplikationen: en egen tjänst med samma kuvert, validering och fel som en riktig, som tar emot
// CreateDraftCertificate och ListCertificatesForCareWithQA från Vårdkällan. Journalen når den genom transporten i samma
// process.
export const tjanst = r3.simuleradTjanst(NAMN, [LOGISK_ADRESS_INTYGSAPPLIKATION]);
tjanst.registrera(DEF.skapa(), skapaUtkast);
tjanst.registrera(DEF.lista(), lista);
sattTransport((db) => r3.tillMotpart(db, tjanst));
