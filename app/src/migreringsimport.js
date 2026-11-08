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

// migrering_filer har varje fil som har lagts fram: själva filen, förhandsvisningen eller rapporten, och vem som lade
// fram och godkände den. migrering_metadata har uppgifterna om källan för varje migrerad anteckning, som vem som skrev
// och signerade den i källsystemet. De pekar aldrig på en nuvarande personal i Vårdkällan.
export function sakerstall(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS migrering_filer (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, kalla TEXT NOT NULL, fil TEXT NOT NULL,
    status TEXT NOT NULL, foreslagen_av TEXT NOT NULL, foreslagen TEXT NOT NULL, beslutad_av TEXT, beslutad TEXT, kommentar TEXT, rapport TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS migrering_metadata (tabell TEXT NOT NULL, rad_id INTEGER NOT NULL, fil_id INTEGER NOT NULL, kalla TEXT NOT NULL,
    forfattare TEXT, forfattare_hsa TEXT, signerad TEXT, PRIMARY KEY (tabell, rad_id))`);
}

// Författaren till en migrerad anteckning är källsystemet, aldrig en nuvarande personal. Identiteten har ingen rad i
// personal, och journal.js visar uppgifterna om källan i stället.
export const migreringsidentitet = (kalla) => `migrering:${kalla}`;

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
    // Författaren i källsystemet sparas som en uppgift om källan, med namn och HSA-id som de står i filen. Den kopplas
    // aldrig till en nuvarande personal med samma HSA-id, eftersom den som läser in filen då kunde få en anteckning att
    // se ut som signerad av en kollega.
    const forf = (r.author ?? []).find(a => a?.identifier?.system === HSA_SYSTEM || typeof a?.display === 'string');
    const forfattare = typeof forf?.display === 'string' && forf.display.trim() ? forf.display.trim().slice(0, 120) : null;
    const forfattareHsa = forf?.identifier?.system === HSA_SYSTEM && /^[A-Z0-9-]{6,40}$/.test(String(forf.identifier.value ?? '')) ? String(forf.identifier.value) : null;
    const sokord = (r.section ?? []).map(s => ({ sokord: String(s?.title ?? '').trim().slice(0, 80), text: String(s?.text?.div ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 8000) })).filter(s => s.sokord && s.text);
    if (!sokord.length) return { fel: 'Anteckningen har inga sökord med text.' };
    const typ = (typeof r.title === 'string' && r.title.trim().slice(0, 60)) || 'Anteckning';
    return { rad: { patient_id: p.id, enhet_id: e.id, typ, kategori: /omvårdnad/i.test(typ) ? 'omvardnad' : 'lakare', sokord: JSON.stringify(sokord), skapad: t, status: 'signerad', signerad_tid: t, forfattare, forfattareHsa } };
  }
  return { fel: `Resurstypen ${r.resourceType} migreras inte.` };
}

const TABELL = {
  Encounter: (db, r, kalla) => db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, orsak, kalla, ger_vardrelation) VALUES (?, ?, ?, ?, ?, ?, ?, 0) RETURNING id').get(r.patient_id, r.enhet_id, r.typ, r.start, r.slut, r.orsak, kalla).id,
  Condition: (db, r, kalla) => db.query('INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id').get(r.patient_id, r.enhet_id, r.kod, r.text, r.typ, r.datum, kalla).id,
  Observation: (db, r, kalla) => db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').get(r.patient_id, r.enhet_id, r.typ, r.varde, r.varde_num, r.matt_enhet, r.tid, kalla).id,
  Composition: (db, r, kalla) => db.query(`INSERT INTO anteckningar (patient_id, enhet_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?) RETURNING id`).get(r.patient_id, r.enhet_id, r.typ, r.kategori, r.sokord, migreringsidentitet(kalla.slice(9)), r.skapad, r.status, r.signerad_tid, kalla).id,
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
const forhand = (p) => ({ kalla: p.kalla, perTyp: Object.values(p.perTyp), avvikelser: avvikelserUt(p).slice(0, 50), antalAvvikelser: avvikelserUt(p).length });
const STATUS = { vantar: 'Väntar på godkännande', inlast: 'Inläst', avslagen: 'Avslagen', aterkallad: 'Återkallad' };
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const loggaAtgard = (db, personal, id) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs: `migrering:${id}`, grund: 'administrativ' });
const redan = (db, h) => db.query("SELECT status, foreslagen, beslutad FROM migrering_filer WHERE hash = ? AND status IN ('vantar', 'inlast') ORDER BY id DESC LIMIT 1").get(h);

// Förhandsvisningen: vad som skulle föras över och vad som blir avvikelser. Inga patientuppgifter i svaret.
export function forhandsvisa(db, personal, fil) {
  kravRoll(personal);
  const p = prova(db, fil);
  sakerstall(db);
  const f = redan(db, hash(fil));
  return { ...forhand(p), redanInlast: f?.status === 'inlast' ? f.beslutad : null, vantar: f?.status === 'vantar' };
}

export function filUt(db, f, personal = null) {
  return {
    ...JSON.parse(f.rapport),
    id: f.id, kalla: f.kalla, status: f.status, statusText: STATUS[f.status], tid: f.beslutad ?? f.foreslagen,
    foreslagenAv: personnamn(db, f.foreslagen_av), foreslagen: f.foreslagen, beslutadAv: personnamn(db, f.beslutad_av), beslutad: f.beslutad, kommentar: f.kommentar,
    egen: Boolean(personal && f.foreslagen_av === personal.id), kanGodkanna: Boolean(personal && f.status === 'vantar' && f.foreslagen_av !== personal.id),
  };
}
function hamta(db, id) {
  sakerstall(db);
  const f = db.query('SELECT * FROM migrering_filer WHERE id = ?').get(Number(id));
  if (!f) throw new Fel(404, 'Filen finns inte.', 'saknas');
  return f;
}

// Lägger fram en förhandsvisad fil. Ingenting skrivs i journalerna förrän en annan systemförvaltare har godkänt den.
export function foresla(db, personal, fil, nu = new Date()) {
  kravRoll(personal);
  const p = prova(db, fil);
  sakerstall(db);
  const h = hash(fil);
  const f = redan(db, h);
  if (f?.status === 'inlast') throw new Fel(409, `Filen lästes redan in ${f.beslutad.slice(0, 16).replace('T', ' ')}. Samma uttag läses inte in två gånger, så att inget blir dubbelt i journalen.`, 'ogiltig');
  if (f) throw new Fel(409, 'Samma fil väntar redan på godkännande.', 'ogiltig');
  const id = Number(db.query("INSERT INTO migrering_filer (hash, kalla, fil, status, foreslagen_av, foreslagen, rapport) VALUES (?, ?, ?, 'vantar', ?, ?, ?)")
    .run(h, p.kalla, JSON.stringify(fil), personal.id, iso(nu), JSON.stringify(forhand(p))).lastInsertRowid);
  loggaAtgard(db, personal, id);
  return { fil: filUt(db, hamta(db, id), personal) };
}

// Godkänner en framlagd fil och läser in den i en transaktion. Fyra ögon: den som lade fram filen kan inte godkänna den.
// Filen prövas igen, eftersom journalerna kan ha ändrats sedan förhandsvisningen. Ger rapporten.
export function godkann(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const rad = hamta(db, id);
  if (rad.status !== 'vantar') throw new Fel(409, 'Filen är redan beslutad.', 'ogiltig');
  if (rad.foreslagen_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som lade fram filen måste godkänna den innan något skrivs i journalerna.', 'nekad');
  const p = prova(db, JSON.parse(rad.fil));
  const kalla = `migrerad:${p.kalla}`;
  const rapport = { fil: rad.id, kalla: p.kalla, tid: iso(nu), perTyp: [], avvikelser: 0 };
  db.exec('BEGIN');
  try {
    const patienter = new Set();
    for (const [typ, t] of Object.entries(p.perTyp)) {
      const ids = p.tolkade.filter(x => x.typ === typ && x.rad).map(x => {
        patienter.add(x.rad.patient_id);
        const radId = TABELL[typ](db, x.rad, kalla);
        if (typ === 'Composition') {
          db.query('INSERT INTO migrering_metadata (tabell, rad_id, fil_id, kalla, forfattare, forfattare_hsa, signerad) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run('anteckningar', radId, rad.id, p.kalla, x.rad.forfattare, x.rad.forfattareHsa, x.rad.signerad_tid);
        }
        return radId;
      });
      // Verifieringen läser tillbaka det som fördes in.
      const tabell = DATATYP[typ];
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
    // Varje patient som fick migrerade uppgifter loggas, med systemförvaltaren som godkände och grunden administrativ.
    for (const pid of patienter) loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'konfigurera', resurs: `migrering:${rad.id}`, grund: 'administrativ' });
    db.query("UPDATE migrering_filer SET status = 'inlast', beslutad_av = ?, beslutad = ?, kommentar = ?, rapport = ? WHERE id = ?")
      .run(personal.id, iso(nu), typeof kommentar === 'string' && kommentar.trim() ? kommentar.trim().slice(0, 500) : null, JSON.stringify(rapport), rad.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return rapport;
}

// Avslår en framlagd fil (en annan systemförvaltare, med kommentar) eller återkallar den (den som lade fram den).
export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date()) {
  kravRoll(personal);
  const rad = hamta(db, id);
  if (rad.status !== 'vantar') throw new Fel(409, 'Filen är redan beslutad.', 'ogiltig');
  const egen = rad.foreslagen_av === personal.id;
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (!egen && !k) throw new Fel(400, 'Skriv varför filen avslås, så att den som lade fram den vet vad som behöver rättas.', 'ogiltig', { falt: ['kommentar'] });
  db.query('UPDATE migrering_filer SET status = ?, beslutad_av = ?, beslutad = ?, kommentar = ? WHERE id = ?').run(egen ? 'aterkallad' : 'avslagen', personal.id, iso(nu), k || null, rad.id);
  loggaAtgard(db, personal, rad.id);
  return { fil: filUt(db, hamta(db, rad.id), personal) };
}

// Filerna som har lagts fram, för migreringssidan: de som väntar och de som är beslutade. Inga patientuppgifter.
export function filer(db, personal = null) {
  const har = db.query("SELECT 1 FROM sqlite_master WHERE name = 'migrering_filer'").get();
  return har ? db.query('SELECT * FROM migrering_filer ORDER BY id DESC LIMIT 20').all().map(f => filUt(db, f, personal)) : [];
}

// Uppgifterna om källan för en migrerad anteckning, eller null (journal.js).
export function kallaUppgifter(db, radId) {
  const har = db.query("SELECT 1 FROM sqlite_master WHERE name = 'migrering_metadata'").get();
  const m = har ? db.query("SELECT * FROM migrering_metadata WHERE tabell = 'anteckningar' AND rad_id = ?").get(radId) : null;
  return m ? { kalla: m.kalla, forfattare: m.forfattare, forfattareHsa: m.forfattare_hsa, signerad: m.signerad } : null;
}

