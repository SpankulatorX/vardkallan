// Inläsning av en migreringsfil (runda 9, r4, Sussa 5.1.1.2). Ett uttag ur ett annat journalsystem, till exempel VAS
// eller Cosmic, läses in som en FHIR R4 Bundle av typen collection med vårdkontakter (Encounter), diagnoser
// (Condition), mätvärden (Observation) och journalanteckningar (Composition). Ett Parameters-element först i filen kan
// ange källsystemet och hur många poster av varje typ källsystemet räknade, så att avstämningen kan visa poster som
// saknas i filen. Patienten anges med personnummer i subject.identifier, och vårdenheten med HSA-id i meta.tag.
//
// Systemet är experten: filen valideras innan något skrivs, varje post som går att läsa förs in med källan märkt, och
// varje post som inte går att läsa blir en avvikelse med orsaken på vanlig svenska. Avstämningen räknas av systemet:
// antalet i källan, antalet som fördes över och antalet som går att läsa tillbaka. Samma fil två gånger läses inte in
// igen. En migrerad vårdkontakt ger ingen vårdrelation, eftersom vårdrelation uppstår av vården och inte av en
// migrering.
import { createHash } from 'node:crypto';
import { Fel, iso, MATTYPER_ENHET } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import { SYSTEM, MATKOD } from './kodverk.js';
import { FHIR_SYSTEM, OID_PERSONNUMMER } from './identitet.js';
import * as kodverksforvaltning from './kodverksforvaltning.js';

export const HSA_SYSTEM = 'urn:oid:1.2.752.129.2.1.4.1';
const PNR_SYSTEM = [FHIR_SYSTEM.personnummer, `urn:oid:${OID_PERSONNUMMER}`];
const MAX_POSTER = 500;
// Datatyp i avstämningen (tabellen migrering) per resurstyp.
export const DATATYP = { Encounter: 'vardkontakter', Condition: 'diagnoser', Observation: 'matvarden', Composition: 'anteckningar' };
const KONTAKTTYP = { AMB: 'besok', IMP: 'slutenvard', EMER: 'akut', HH: 'hembesok', VR: 'video' };

// Mätvärdestypen för en kod i NPU eller LOINC, ur kodverk.js.
const MATTYP = new Map(Object.entries(MATKOD).flatMap(([typ, k]) => k.coding.map(c => [`${c.system}|${c.code}`, typ])));

export function sakerstall(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS migrering_filer (id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, kalla TEXT NOT NULL, tid TEXT NOT NULL,
    av TEXT NOT NULL, rapport TEXT NOT NULL)`);
}

const datum = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const tid = (s) => (typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s).toISOString() : null);
const kallnamn = (s) => (typeof s === 'string' && /^[A-Za-zÅÄÖåäö0-9 .-]{2,30}$/.test(s.trim()) ? s.trim() : null);

// Läser manifestet: källsystemet och antalet per resurstyp enligt källsystemet.
function manifest(entry) {
  const p = entry.find(e => e?.resource?.resourceType === 'Parameters')?.resource;
  const ut = { kalla: null, antal: {} };
  for (const x of p?.parameter ?? []) {
    if (x?.name === 'kalla') ut.kalla = kallnamn(x.valueString);
    const m = /^antal\.(Encounter|Condition|Observation|Composition)$/.exec(x?.name ?? '');
    if (m && Number.isInteger(x.valueInteger) && x.valueInteger >= 0) ut.antal[m[1]] = x.valueInteger;
  }
  return ut;
}

const patientFor = (db, r) => {
  const i = r.subject?.identifier;
  if (!i || !PNR_SYSTEM.includes(i.system) || !/^\d{12}$/.test(String(i.value ?? ''))) return { fel: 'Posten saknar patientens personnummer i subject.identifier.' };
  const p = db.query('SELECT id, sammanslagen_till FROM patienter WHERE personnummer = ?').get(i.value);
  if (!p) return { fel: 'Patienten finns inte i Vårdkällan. Posten förs in när patienten är registrerad.' };
  return { id: p.sammanslagen_till ?? p.id };
};
const enhetFor = (db, r) => {
  const t = (r.meta?.tag ?? []).find(x => x?.system === HSA_SYSTEM);
  const e = t ? db.query('SELECT id FROM enheter WHERE hsa_id = ?').get(String(t.code ?? '')) : null;
  return e ? { id: e.id } : { fel: 'Vårdenheten saknas eller har ett HSA-id som inte finns i Vårdkällan.' };
};

// Tolkar en post till en rad i Vårdkällans tabell, eller ett fel.
function tolkaPost(db, r) {
  const p = patientFor(db, r);
  if (p.fel) return p;
  const e = enhetFor(db, r);
  if (e.fel) return e;
  if (r.resourceType === 'Encounter') {
    const start = tid(r.period?.start);
    if (!start) return { fel: 'Vårdkontakten saknar starttid i period.start.' };
    return { rad: { patient_id: p.id, enhet_id: e.id, typ: KONTAKTTYP[r.class?.code] ?? 'besok', start, slut: tid(r.period?.end), orsak: typeof r.reasonCode?.[0]?.text === 'string' ? r.reasonCode[0].text.slice(0, 300) : null } };
  }
  if (r.resourceType === 'Condition') {
    const c = (r.code?.coding ?? []).find(x => x?.system === SYSTEM.icd10se);
    const kod = String(c?.code ?? '').toUpperCase();
    if (!kodverksforvaltning.KODVERK.icd10se.form(kod)) return { fel: 'Diagnosen saknar en kod i ICD-10-SE.' };
    // En migrerad diagnos behåller texten den hade i källan, också om koden inte finns i den utgåva som gäller i dag.
    const text = (typeof c.display === 'string' && c.display.trim()) || kodverksforvaltning.text(db, 'icd10se', kod);
    if (!text) return { fel: `Diagnosen ${kod} saknar text, och koden finns inte i ICD-10-SE som gäller i dag.` };
    const d = datum(r.recordedDate) ?? datum(r.onsetDateTime);
    if (!d) return { fel: 'Diagnosen saknar datum i recordedDate.' };
    return { rad: { patient_id: p.id, enhet_id: e.id, kod, text: text.slice(0, 300), typ: r.category?.[0]?.text === 'huvuddiagnos' ? 'huvud' : 'bi', datum: d } };
  }
  if (r.resourceType === 'Observation') {
    const typ = (r.code?.coding ?? []).map(c => MATTYP.get(`${c?.system}|${c?.code}`)).find(Boolean);
    if (!typ) return { fel: 'Mätvärdet har en kod i NPU eller LOINC som Vårdkällan inte känner till.' };
    const v = r.valueQuantity?.value;
    if (typeof v !== 'number' || !Number.isFinite(v)) return { fel: 'Mätvärdet saknar ett värde i valueQuantity.' };
    const t = tid(r.effectiveDateTime);
    if (!t) return { fel: 'Mätvärdet saknar tid i effectiveDateTime.' };
    return { rad: { patient_id: p.id, enhet_id: e.id, typ, varde: String(v).replace('.', ','), varde_num: v, matt_enhet: MATTYPER_ENHET[typ] ?? null, tid: t } };
  }
  if (r.resourceType === 'Composition') {
    const t = tid(r.date);
    if (!t) return { fel: 'Anteckningen saknar datum.' };
    const forf = (r.author ?? []).map(a => a?.identifier).find(i => i?.system === HSA_SYSTEM);
    const pers = forf ? db.query('SELECT id FROM personal WHERE hsa_id = ?').get(String(forf.value ?? '')) : null;
    if (!pers) return { fel: 'Anteckningens författare saknas eller finns inte i personalkatalogen med HSA-id.' };
    const sokord = (r.section ?? []).map(s => ({ sokord: String(s?.title ?? '').trim().slice(0, 80), text: String(s?.text?.div ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 8000) })).filter(s => s.sokord && s.text);
    if (!sokord.length) return { fel: 'Anteckningen har inga sökord med text.' };
    const typ = (typeof r.title === 'string' && r.title.trim().slice(0, 60)) || 'Anteckning';
    return { rad: { patient_id: p.id, enhet_id: e.id, typ, kategori: /omvårdnad/i.test(typ) ? 'omvardnad' : 'lakare', sokord: JSON.stringify(sokord), forfattare_id: pers.id, skapad: t, status: 'signerad', signerad_tid: t, signerad_av: pers.id } };
  }
  return { fel: `Resurstypen ${r.resourceType} migreras inte.` };
}

const TABELL = {
  Encounter: (db, r, kalla) => db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, orsak, kalla, ger_vardrelation) VALUES (?, ?, ?, ?, ?, ?, ?, 0) RETURNING id').get(r.patient_id, r.enhet_id, r.typ, r.start, r.slut, r.orsak, kalla).id,
  Condition: (db, r, kalla) => db.query('INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id').get(r.patient_id, r.enhet_id, r.kod, r.text, r.typ, r.datum, kalla).id,
  Observation: (db, r, kalla) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').get(r.patient_id, r.enhet_id, r.typ, r.varde, r.varde_num, r.matt_enhet, r.tid, kalla).id,
  Composition: (db, r, kalla) => db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(r.patient_id, r.enhet_id, r.typ, r.kategori, r.sokord, r.forfattare_id, r.skapad, r.status, r.signerad_tid, r.signerad_av, kalla).id,
};

// Prövar filen utan att skriva något: källan, antalet per typ och avvikelserna. Används av förhandsvisningen och inläsningen.
function prova(db, fil) {
  if (fil?.resourceType !== 'Bundle' || fil.type !== 'collection' || !Array.isArray(fil.entry)) throw new Fel(400, 'Filen är inte en FHIR Bundle av typen collection. Ett uttag ur källsystemet behöver ha den formen.', 'ogiltig', { falt: ['fil'] });
  const m = manifest(fil.entry);
  const kalla = m.kalla ?? kallnamn(fil.meta?.source ?? '');
  if (!kalla) throw new Fel(400, 'Filen anger inte källsystemet. Skriv det i manifestets första parameter eller i meta.source, till exempel VAS.', 'ogiltig', { falt: ['fil'] });
  if (kalla.toLocaleLowerCase('sv') === 'vårdkällan') throw new Fel(400, 'Källsystemet kan inte vara Vårdkällan själv.', 'ogiltig', { falt: ['fil'] });
  const poster = fil.entry.map(e => e?.resource).filter(r => r && r.resourceType !== 'Parameters');
  if (poster.length > MAX_POSTER) throw new Fel(400, `En fil kan ha högst ${MAX_POSTER} poster i demon. Dela uttaget i flera filer.`, 'ogiltig', { falt: ['fil'] });
  const tolkade = poster.map((r, index) => ({ index, typ: r.resourceType, patientId: patientFor(db, r).id ?? '', ...tolkaPost(db, r) }));
  const perTyp = {};
  for (const typ of Object.keys(DATATYP)) {
    const iFilen = tolkade.filter(t => t.typ === typ).length;
    const ok = tolkade.filter(t => t.typ === typ && t.rad).length;
    const kallan = Object.hasOwn(m.antal, typ) ? m.antal[typ] : iFilen;
    if (iFilen || kallan) perTyp[typ] = { datatyp: DATATYP[typ], iKallan: kallan, iFilen, kanForasOver: ok, saknasIFilen: Math.max(0, kallan - iFilen) };
  }
  return { kalla, tolkade, perTyp, okanda: tolkade.filter(t => !DATATYP[t.typ]) };
}

const kravRoll = (personal) => { if (!kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen läser in migreringsfiler.', 'nekad'); };
const hash = (fil) => createHash('sha256').update(JSON.stringify(fil)).digest('hex');
const avvikelserUt = (p) => p.tolkade.filter(t => t.fel).map(t => ({ post: t.index + 1, typ: t.typ, orsak: t.fel }));

// Förhandsvisningen: vad som skulle föras över och vad som blir avvikelser. Inga patientuppgifter i svaret.
export function forhandsvisa(db, personal, fil) {
  kravRoll(personal);
  const p = prova(db, fil);
  sakerstall(db);
  const fanns = db.query('SELECT tid FROM migrering_filer WHERE hash = ?').get(hash(fil));
  return { kalla: p.kalla, perTyp: Object.values(p.perTyp), avvikelser: avvikelserUt(p).slice(0, 50), antalAvvikelser: avvikelserUt(p).length, redanInlast: fanns ? fanns.tid : null };
}

// Läser in filen i en transaktion och stämmer av. Ger rapporten.
export function lasIn(db, personal, fil, nu = new Date()) {
  kravRoll(personal);
  const p = prova(db, fil);
  sakerstall(db);
  const h = hash(fil);
  const fanns = db.query('SELECT tid FROM migrering_filer WHERE hash = ?').get(h);
  if (fanns) throw new Fel(409, `Filen lästes redan in ${fanns.tid.slice(0, 16).replace('T', ' ')}. Samma uttag läses inte in två gånger, så att inget blir dubbelt i journalen.`, 'ogiltig');
  const kalla = `migrerad:${p.kalla}`;
  let rapport;
  db.exec('BEGIN');
  try {
    const filId = Number(db.query('INSERT INTO migrering_filer (hash, kalla, tid, av, rapport) VALUES (?, ?, ?, ?, ?)').run(h, p.kalla, iso(nu), personal.id, '{}').lastInsertRowid);
    rapport = { fil: filId, kalla: p.kalla, tid: iso(nu), perTyp: [], avvikelser: 0 };
    const patienter = new Set();
    for (const [typ, t] of Object.entries(p.perTyp)) {
      const ids = p.tolkade.filter(x => x.typ === typ && x.rad).map(x => { patienter.add(x.rad.patient_id); return TABELL[typ](db, x.rad, kalla); });
      // Verifieringen läser tillbaka det som fördes in.
      const tabell = { Encounter: 'vardkontakter', Condition: 'diagnoser', Observation: 'matvarden', Composition: 'anteckningar' }[typ];
      const verifierade = ids.length ? db.query(`SELECT count(*) AS n FROM ${tabell} WHERE kalla = ? AND id IN (${ids.map(() => '?').join(', ')})`).get(kalla, ...ids).n : 0;
      db.query(`INSERT INTO migrering (datatyp, kalla, antal_kalla, antal_overforda, antal_verifierade) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (datatyp, kalla) DO UPDATE SET antal_kalla = antal_kalla + excluded.antal_kalla, antal_overforda = antal_overforda + excluded.antal_overforda,
        antal_verifierade = antal_verifierade + excluded.antal_verifierade`).run(t.datatyp, kalla, t.iKallan, ids.length, verifierade);
      rapport.perTyp.push({ ...t, overforda: ids.length, verifierade });
      if (t.saknasIFilen) {
        db.query('INSERT INTO migrering_avvikelser (patient_id, datatyp, kalla, beskrivning, atgard) VALUES (?, ?, ?, ?, ?)').run('', t.datatyp, kalla,
          `${t.saknasIFilen} av ${t.iKallan} poster som källsystemet räknade finns inte i filen.`, 'Gör ett nytt uttag ur källsystemet för de poster som saknas.');
        rapport.avvikelser++;
      }
    }
    for (const x of p.tolkade.filter(t => t.fel)) {
      db.query('INSERT INTO migrering_avvikelser (patient_id, datatyp, kalla, beskrivning, atgard) VALUES (?, ?, ?, ?, ?)').run(x.patientId, DATATYP[x.typ] ?? 'okand', kalla,
        `Post ${x.index + 1} i filen: ${x.fel}`, 'Rätta posten i källsystemet och läs in den i en ny fil.');
      rapport.avvikelser++;
    }
    // Varje patient som fick migrerade uppgifter loggas, med systemförvaltaren och grunden administrativ.
    for (const pid of patienter) loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'konfigurera', resurs: `migrering:${rapport.fil}`, grund: 'administrativ' });
    db.query('UPDATE migrering_filer SET rapport = ? WHERE id = ?').run(JSON.stringify(rapport), rapport.fil);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return rapport;
}

// Filerna som har lästs in, för migreringssidan. Inga patientuppgifter.
export function filer(db) {
  const har = db.query("SELECT 1 FROM sqlite_master WHERE name = 'migrering_filer'").get();
  return har ? db.query('SELECT id, kalla, tid, rapport FROM migrering_filer ORDER BY id DESC LIMIT 20').all().map(f => ({ id: f.id, kalla: f.kalla, tid: f.tid, ...JSON.parse(f.rapport) })) : [];
}
