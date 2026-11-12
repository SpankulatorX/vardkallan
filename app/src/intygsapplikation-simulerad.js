// Runda 14, r3: en simulerad intygsapplikation i integrerat läge, för demon (Sussa 2.2.1.9). Den står för den del som
// Webcert och Intygstjänsten har i verkligheten: den tar emot CreateDraftCertificate, låter läkaren skriva och signera
// intyget, skickar det till mottagaren (simulerat, inget lämnar demon) och meddelar journalen varje händelse med
// CertificateStatusUpdateForCare. Den svarar också på ListCertificatesForCareWithQA.
//
// Den är inte Webcert och inte Ineras tjänst. Den kör i samma process och sandlåda som Vårdkällan och tar bara emot
// meddelanden som XML genom samma kontrakt som en riktig intygsapplikation. Reglerna för vilka intyg som får skrivas
// följer de regler som Webcert tillämpar för skyddade personuppgifter och avlidna, så att journalen kan visa samma sak.
// Personuppgifterna slås upp i sandlådans patienter, som en intygsapplikation slår upp dem i PU-tjänsten.
import { randomUUID } from 'node:crypto';
import { Fel, iso } from './db.js';
import { vardenhetFor, prova, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { avlidenFor } from './avliden.js';
import { e, xml, tolka, text, hitta, XmlFel } from './rivta-r3-xml.js';
import * as transport from './rivta-r3-transport.js';
import { NS, KV, INTYGSTYPER, LOGISK_ADRESS_INTYGSAPPLIKATION, KONTRAKT, taEmotStatus, personId } from './lakarintyg.js';

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

const svaraSkapa = (kod, t = null, err = null, intygsId = null, rot = null) => xml(e('skapa:CreateDraftCertificateResponse', [
  intygsId ? e('skapa:intygs-id', [e('types:root', rot), e('types:extension', intygsId)]) : null,
  e('skapa:result', [e('core:resultCode', kod), e('core:resultText', t), e('core:errorId', err)]),
]), { skapa: NS.skapa, core: NS.core, types: NS.types });

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
export function skapaUtkast(db, kroppXml, { logiskAdress } = {}) {
  let m;
  try { m = tolka(kroppXml); } catch (x) { return svaraSkapa('ERROR', x instanceof XmlFel ? x.message : 'Meddelandet gick inte att tolka.', 'VALIDATION_ERROR'); }
  if (m.n !== 'CreateDraftCertificate' || m.ns !== NS.skapa) return svaraSkapa('ERROR', 'Meddelandet är inte CreateDraftCertificate version 3.', 'VALIDATION_ERROR');
  if (logiskAdress !== LOGISK_ADRESS_INTYGSAPPLIKATION) return svaraSkapa('ERROR', 'Fel logisk adress.', 'VALIDATION_ERROR');
  const i = hitta(m, 'intyg');
  const typ = text(i, 'typAvIntyg/code');
  const pnr = text(i, 'patient/person-id/extension');
  const enhetHsa = text(i, 'skapadAv/enhet/enhets-id/extension');
  const personalHsa = text(i, 'skapadAv/personal-id/extension');
  const personalNamn = text(i, 'skapadAv/fullstandigtNamn');
  if (!TYP.has(typ ?? '') || text(i, 'typAvIntyg/codeSystem') !== KV.intygstyp) return svaraSkapa('ERROR', `Intygstypen ${typ ?? ''} stöds inte.`, 'VALIDATION_ERROR');
  if (!text(i, 'patient/fornamn') || !text(i, 'patient/efternamn')) return svaraSkapa('ERROR', 'Patientens förnamn och efternamn krävs.', 'VALIDATION_ERROR');
  if (!/^\d{12}$/.test(pnr ?? '')) return svaraSkapa('ERROR', 'Patientens personnummer saknas eller är fel.', 'VALIDATION_ERROR');
  if (!personalHsa || !personalNamn) return svaraSkapa('ERROR', 'Läkarens HSA-id och namn krävs.', 'VALIDATION_ERROR');
  const enhet = enhetHsa ? enhetPaHsa(db, enhetHsa) : null;
  if (!enhet) return svaraSkapa('ERROR', 'Vårdenheten finns inte.', 'VALIDATION_ERROR');
  // Läkaren ska ha ett uppdrag på vårdenheten, som medarbetaruppdraget i en intygsapplikation.
  const pers = db.query('SELECT id, enhet_id FROM personal WHERE hsa_id = ? AND aktiv = 1').get(personalHsa);
  if (!pers || vardenhetFor(db, pers.enhet_id) !== enhet.id) return svaraSkapa('ERROR', 'Personen har inget uppdrag på vårdenheten.', 'VALIDATION_ERROR');
  // Personuppgifterna, som en intygsapplikation hämtar dem ur PU-tjänsten.
  const p = db.query('SELECT * FROM patienter WHERE personnummer = ?').get(pnr) ?? db.query('SELECT * FROM patienter WHERE replace(personnummer, \'-\', \'\') = ?').get(pnr);
  if (!p) return svaraSkapa('ERROR', 'Personuppgiftstjänsten känner inte till personen.', 'APPLICATION_ERROR');
  const t = TYP.get(typ);
  if (p.skyddad && !t.sekretess) return svaraSkapa('ERROR', 'Intygstypen kan inte skrivas för en patient med skyddade personuppgifter.', 'APPLICATION_ERROR');
  const avliden = Boolean(avlidenFor(db, p.id));
  if (avliden !== t.avliden) return svaraSkapa('ERROR', avliden ? 'Patienten är avliden. Bara dödsbevis och dödsorsaksintyg kan skrivas.' : 'Intygstypen gäller bara en avliden patient.', 'APPLICATION_ERROR');
  const intygsId = randomUUID();
  // Förifyllnaden: de svar som går att använda följer med till utkastet.
  const svar = {};
  const f = hitta(i, 'forifyllnad');
  for (const s of (f?.b ?? []).filter(x => x.n === 'svar')) {
    for (const d of s.b.filter(x => x.n === 'delsvar')) {
      if (d.a.id === '6.1') svar.diagnosText = d.text?.slice(0, 200) ?? null;
      if (d.a.id === '6.2') svar.diagnosKod = text(d, 'cv/code')?.slice(0, 10) ?? null;
    }
  }
  const tid = iso();
  db.query("INSERT INTO sim_intygsapplikation (intygs_id, patient_id, enhet_id, typ, personnummer, personal_hsa, personal_namn, ref, status, skapad, svar, handelser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'utkast', ?, ?, '[]')")
    .run(intygsId, p.id, enhet.id, typ, pnr, personalHsa, personalNamn, text(i, 'ref'), tid, JSON.stringify(svar));
  // Statusuppdateringen om det nya utkastet skickas efter svaret, som från en riktig intygsapplikation.
  transport.ko(db, () => handelse(db, intygsId, 'SKAPAT'));
  return svaraSkapa('OK', null, null, intygsId, enhet.hsa_id);
}

const ms = (d = new Date()) => d.toISOString().slice(0, 23);
const sek = (s) => (s ? s.slice(0, 19) : null);

function intygElement(db, r, { med } = {}) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patient_id);
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(r.enhet_id);
  const vg = vardgivare(db, r.enhet_id);
  const t = TYP.get(r.typ);
  const svar = JSON.parse(r.svar);
  const statusar = [];
  if (r.signerad) statusar.push(e('core:status', [e('core:part', [e('types:code', 'HSVARD'), e('types:codeSystem', KV.part)]), e('core:status', [e('types:code', 'RECEIV'), e('types:codeSystem', KV.status)]), e('core:tidpunkt', sek(r.signerad))]));
  if (r.skickad) statusar.push(e('core:status', [e('core:part', [e('types:code', t.part), e('types:codeSystem', KV.part)]), e('core:status', [e('types:code', 'SENTTO'), e('types:codeSystem', KV.status)]), e('core:tidpunkt', sek(r.skickad))]));
  if (r.makulerad) statusar.push(e('core:status', [e('core:part', [e('types:code', 'HSVARD'), e('types:codeSystem', KV.part)]), e('core:status', [e('types:code', 'CANCEL'), e('types:codeSystem', KV.status)]), e('core:tidpunkt', sek(r.makulerad))]));
  const svarEl = med && svar.diagnosKod ? [e('core:svar', [e('core:delsvar', svar.diagnosText ?? '', { id: '6.1' }), e('core:delsvar', [e('types:cv', [e('types:code', svar.diagnosKod), e('types:codeSystem', KV.icd10), e('types:displayName', svar.diagnosText ?? svar.diagnosKod)])], { id: '6.2' })], { id: '6' })] : [];
  const pid = personId(p);
  return [
    e('core:intygs-id', [e('types:root', enhet.hsa_id), e('types:extension', r.intygs_id)]),
    r.skickad ? e('core:mottagare', [e('types:code', t.part), e('types:codeSystem', KV.part)]) : null,
    e('core:typ', [e('types:code', t.kod), e('types:codeSystem', KV.intygstyp), e('types:displayName', t.text)]),
    e('core:version', '1.0'),
    r.signerad ? e('core:signeringstidpunkt', sek(r.signerad)) : null,
    r.skickad ? e('core:skickatTidpunkt', sek(r.skickad)) : null,
    e('core:patient', [
      e('core:person-id', [e('types:root', pid.root), e('types:extension', pid.extension)]),
      e('core:fornamn', p.fornamn), e('core:efternamn', p.efternamn),
      e('core:postadress', p.skyddad ? '' : (p.adress ?? '')), e('core:postnummer', p.skyddad ? '' : (p.postnr ?? '')), e('core:postort', p.skyddad ? '' : (p.ort ?? '')),
    ]),
    e('core:skapadAv', [
      e('core:personal-id', [e('types:root', KV.hsa), e('types:extension', r.personal_hsa)]),
      e('core:fullstandigtNamn', r.personal_namn),
      e('core:enhet', [
        e('core:enhets-id', [e('types:root', KV.hsa), e('types:extension', enhet.hsa_id)]),
        e('core:arbetsplatskod', [e('types:root', '1.2.752.29.4.71'), e('types:extension', ARBETSPLATSKOD)]),
        e('core:enhetsnamn', enhet.namn), e('core:postadress', ''), e('core:postnummer', ''), e('core:postort', ''), e('core:telefonnummer', TELEFON),
        e('core:vardgivare', [e('core:vardgivare-id', [e('types:root', KV.hsa), e('types:extension', vg?.hsa_id ?? enhet.hsa_id)]), e('core:vardgivarnamn', vg?.namn ?? enhet.namn)]),
      ]),
    ]),
    ...statusar,
    ...svarEl,
  ];
}

// En händelse: statusen sparas hos intygsapplikationen och CertificateStatusUpdateForCare skickas till den vårdenhet som
// äger intyget. Ger journalens svar.
export function handelse(db, intygsId, kod, nu = new Date()) {
  const r = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(intygsId);
  if (!r) return null;
  const h = JSON.parse(r.handelser);
  const tid = ms(nu);
  h.push({ kod, tid });
  db.query('UPDATE sim_intygsapplikation SET handelser = ? WHERE intygs_id = ?').run(JSON.stringify(h), intygsId);
  const enhet = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(r.enhet_id);
  const rad = db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(intygsId);
  const kropp = e('status:CertificateStatusUpdateForCare', [
    e('status:intyg', intygElement(db, rad, { med: true })),
    e('status:handelse', [e('core:handelsekod', [e('types:code', kod), e('types:codeSystem', KV.handelse)]), e('core:tidpunkt', tid)]),
    e('status:skickadeFragor', [e('core:totalt', 0), e('core:ejBesvarade', 0), e('core:besvarade', 0), e('core:hanterade', 0)]),
    e('status:mottagnaFragor', [e('core:totalt', 0), e('core:ejBesvarade', 0), e('core:besvarade', 0), e('core:hanterade', 0)]),
    e('status:ref', r.ref),
  ]);
  return transport.anropa(db, { kontrakt: KONTRAKT.status.namn, logiskAdress: enhet.hsa_id, kropp, ns: { status: NS.status, core: NS.core, types: NS.types }, patientId: r.patient_id, enhetId: r.enhet_id });
}

// ListCertificatesForCareWithQA 3.3: patientens intyg på de angivna vårdenheterna, med händelserna.
export function lista(db, kroppXml) {
  // Svaret har ingen resultatkod. Ett fel blir ett SOAP-fel, som här är ett undantag som transporten fångar.
  const svara = (items) => xml(e('lista:ListCertificatesForCareWithQAResponse', [e('lista:list', items.length ? items : null) ?? { n: 'lista:list', a: null, b: [] }]),
    { lista: NS.lista, core: NS.core, types: NS.types });
  let m;
  try { m = tolka(kroppXml); } catch (x) { throw new Error('Meddelandet gick inte att tolka.'); }
  const pnr = text(m, 'person-id/extension');
  const enheter = (m.b ?? []).filter(x => x.n === 'enhets-id').map(x => text(x, 'extension'));
  if (!/^\d{12}$/.test(pnr ?? '') || !enheter.length) throw new Error('Personnummer och minst en vårdenhet krävs.');
  const ids = enheter.map(h => enhetPaHsa(db, h)?.id).filter(Boolean);
  const rader = db.query(`SELECT * FROM sim_intygsapplikation WHERE personnummer = ? AND status != 'raderat' AND enhet_id IN (${ids.map(() => '?').join(',') || "''"})`).all(pnr, ...ids);
  const items = rader.map(r => e('lista:item', [
    e('lista:intyg', intygElement(db, r)),
    e('lista:handelser', JSON.parse(r.handelser).map(h => e('core:handelse', [e('core:handelsekod', [e('types:code', h.kod), e('types:codeSystem', KV.handelse)]), e('core:tidpunkt', h.tid)]))),
    e('lista:skickadeFragor', [e('core:totalt', 0), e('core:ejBesvarade', 0), e('core:besvarade', 0), e('core:hanterade', 0)]),
    e('lista:mottagnaFragor', [e('core:totalt', 0), e('core:ejBesvarade', 0), e('core:besvarade', 0), e('core:hanterade', 0)]),
    e('lista:ref', r.ref),
  ]));
  return svara(items);
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
    kan: {
      andra: r.status === 'utkast', signera: r.status === 'utkast' && personal.yrke === 'lakare',
      skicka: r.status === 'signerat', makulera: ['signerat', 'skickat'].includes(r.status) && personal.yrke === 'lakare', radera: r.status === 'utkast',
    },
    simulerad: 'Simulerad intygsapplikation i demon. Den är inte Webcert, och inget intyg lämnar demon.',
  };
}
export function visa(db, personal, intygsId, val = {}) {
  const { r, grund } = hamta(db, personal, intygsId);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r.patient_id, handling: 'las_intyg', resurs: `intygsapplikation:${r.intygs_id}`, grund, resultat: 'tillaten' });
  return ut(db, r, personal, Boolean(val.visa_identitet));
}
const NEDSATTNING = ['heltid', 'tre_fjardedelar', 'halften', 'en_fjardedel'];
const SYSSELSATTNING = ['nuvarande_arbete', 'arbetssokande', 'foraldraledighet', 'studier'];
export function spara(db, personal, intygsId, body = {}, val = {}) {
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
  handelse(db, r.intygs_id, 'ANDRAT');
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
export function atgard(db, personal, intygsId, atgardNamn, val = {}) {
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
    handelse(db, r.intygs_id, 'SIGNAT');
  } else if (atgardNamn === 'skicka') {
    if (r.status !== 'signerat') throw new Fel(409, 'Bara ett signerat intyg som inte är skickat kan skickas.', 'konflikt');
    db.query("UPDATE sim_intygsapplikation SET status = 'skickat', skickad = ? WHERE intygs_id = ?").run(tid, r.intygs_id);
    handelse(db, r.intygs_id, 'SKICKA');
  } else if (atgardNamn === 'makulera') {
    if (!['signerat', 'skickat'].includes(r.status)) throw new Fel(409, 'Bara ett signerat intyg kan makuleras. Ett utkast raderas.', 'konflikt');
    if (personal.yrke !== 'lakare') throw new Fel(403, 'Bara en läkare makulerar intyget.', 'nekad');
    db.query("UPDATE sim_intygsapplikation SET status = 'makulerat', makulerad = ? WHERE intygs_id = ?").run(tid, r.intygs_id);
    handelse(db, r.intygs_id, 'MAKULE');
  } else {
    if (r.status !== 'utkast') throw new Fel(409, 'Ett signerat intyg raderas inte. Makulera det i stället.', 'konflikt');
    db.query("UPDATE sim_intygsapplikation SET status = 'raderat' WHERE intygs_id = ?").run(r.intygs_id);
    handelse(db, r.intygs_id, 'RADERA');
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: r.patient_id, handling: 'skriv_intyg', resurs: `intygsapplikation:${r.intygs_id}:${atgardNamn}`, grund, resultat: 'tillaten' });
  return ut(db, db.query('SELECT * FROM sim_intygsapplikation WHERE intygs_id = ?').get(r.intygs_id), personal, Boolean(val.visa_identitet));
}

// Kontrakten kopplas till motparterna: intygsapplikationen tar emot CreateDraftCertificate och
// ListCertificatesForCareWithQA, och journalen tar emot CertificateStatusUpdateForCare.
transport.registrera(KONTRAKT.skapa.namn, NAMN, skapaUtkast);
transport.registrera(KONTRAKT.lista.namn, NAMN, lista);
transport.registrera(KONTRAKT.status.namn, 'Vårdkällan (producent)', taEmotStatus);
