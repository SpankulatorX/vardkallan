// Export till e-arkiv, återföring, gallring och radering (Sussa 5.4.2.1, 5.4.2.3, 5.4.2.4 och 5.3.1.7). Allt kräver
// rollen arkivarie och ett registrerat beslut, och allt loggas med grunden arkivbeslut.
//
// Exportpaketet följer Riksarkivets förvaltningsgemensamma specifikation FGS Paketstruktur 2.0, som är E-ARK CSIP 2.1.0
// och E-ARK SIP 2.1.0 i Riksarkivets tillämpning (version 1.0, 2023-03-30): en rotmapp IP_<id> med METS.xml, mapparna
// metadata/descriptive, metadata/preservation, metadata/other, representations/rep_1/data, schemas och documentation,
// SHA-256 för varje fil, och ZIP som förpackning. Journalen ligger som HL7 FHIR R4 (JSON), ett öppet och dokumenterat
// format, med samma mappning som FHIR-API:t. Paketet innehåller allt, också spärrade uppgifter och uppgifter om patienter
// med skyddade personuppgifter, eftersom ett arkiv ska vara fullständigt. Spärrar och skyddad identitet följer med som
// uppgifter i paketet. Samma paket med alla patienter är återföringen av all data när avtalet upphör.
//
// Gallring och radering släpper journalens triggrar bara för de rader som beslutet gäller, inom en transaktion, och
// lägger tillbaka dem direkt. Åtkomstloggen rörs aldrig: dess rader om patienten finns kvar oförändrade, eftersom de visar
// vem som har tagit del av uppgifterna, och kedjan är hel efteråt. Raderingen loggas som en ny rad med beslutets id och
// hur många poster av varje slag som togs bort, aldrig med innehåll. Patientens identitet finns kvar med en markering om
// beslutet, så att loggen och beslutet går att följa upp. Utskrifter, utlämnanden, spärrar, begäranden från patienten och
// sammanslagningar finns också kvar, eftersom de är uppgifter om hanteringen och inte journalens innehåll.
import { createHash, randomUUID } from 'node:crypto';
import { Fel, iso, idag, giltigtDatum, addDagar } from './db.js';
import { vardenhetFor, aktivaSparrar, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as fhir from './fhir.js';
import * as identitet from './identitet.js';
import { zip } from './zip.js';
// Runda 9, r5: mappningen mot e-arkivets dataelement och leveransen med kvittens (Sussa 5.4.2.3).
import * as earkiv from './earkiv.js';
// Runda 7, r4: parametrar som systemförvaltningen kan ändra.
import * as konfiguration from './konfiguration.js';

export const GALLRING_AR = 10;
// Runda 9, r5 (Sussa 5.4.2.4): gallring av delar av journalen per informationsmängd. Antalet år är parametrar som
// systemförvaltaren ändrar på sidan Regler och parametrar (konfiguration.js), och beslutet tar med reglerna som de
// gäller när det registreras. Konstanterna är standardvärdena.
export const GALLRING_MATVARDEN_AR = 100;
export const GALLRING_KALLELSER_AR = 2;
export const INFORMATIONSMANGDER = {
  matvarden: { text: 'Mätvärden', parameter: 'arkiv.gallring_matvarden_ar', tabell: 'matvarden', datum: 'tid', radtext: ['mätvärde', 'mätvärden'] },
  kallelser: { text: 'Kallelser och påminnelser', parameter: 'arkiv.gallring_kallelser_ar', tabell: 'kallelser', datum: 'coalesce(skickad, skapad)', radtext: ['kallelse', 'kallelser'] },
};
// Reglerna som de gäller i dag, för arkivariens sida och för ett nytt beslut.
export const gallringsregler = (db) => [
  { mangd: 'journal', text: 'Hela journalen', ar: konfiguration.varde(db, 'arkiv.gallring_ar'), parameter: 'arkiv.gallring_ar', villkor: 'Efter den sista uppgiften, när ingen kontakt pågår' },
  ...Object.entries(INFORMATIONSMANGDER).map(([mangd, m]) => ({ mangd, text: m.text, ar: konfiguration.varde(db, m.parameter), parameter: m.parameter, villkor: mangd === 'kallelser' ? 'Efter att den skickades' : 'Efter mätningen, också när journalen finns kvar' })),
];
export const BESLUTSTYPER = {
  leverans: {
    text: 'Leverans till e-arkiv', beslutsfattare: 'Vårdgivarens arkivansvarige',
    lagrum: 'Arkivlagen (1990:782) och vårdgivarens dokumenthanteringsplan',
    forklaring: 'Exportpaketet skapas av systemet med alla uppgifter, metadata och kontrollsummor. Samma paket med alla patienter är återföringen av all data i ett standardiserat arkiveringsformat.',
  },
  gallring: {
    text: 'Gallring', beslutsfattare: 'Vårdgivarens gallringsbeslut',
    lagrum: `Patientdatalagen (2008:355) 3 kap. 17 §: en journalhandling bevaras minst tio år efter den sista uppgiften`,
    forklaring: `Systemet tar själv fram vilka journaler som har haft sin sista uppgift för mer än ${GALLRING_AR} år sedan och inte har någon pågående kontakt.`,
  },
  radering: {
    text: 'Förstöring av journal', beslutsfattare: 'Inspektionen för vård och omsorg',
    lagrum: 'Patientdatalagen (2008:355) 8 kap. 4 §',
    forklaring: 'Inspektionen för vård och omsorg kan på ansökan av patienten besluta att journalen helt eller delvis ska förstöras. Bara det som beslutet gäller raderas.',
  },
};
const LOGGHANDLING = { leverans: 'arkivera', gallring: 'gallra', radering: 'radera' };
// Uppgifter om hanteringen, inte journalens innehåll. De finns kvar efter gallring och radering.
const BEVARAS = new Set(['atkomstlogg', 'patienter', 'identiteter', 'utskrifter', 'utlamnanden', 'arkivbeslut', 'sammanslagningar', 'begaran', 'invanare', 'sparrar', 'listningar', 'dubblettforslag']);
// Poster som kan pekas ut i ett beslut om förstöring av en del av journalen.
const POSTTYPER = {
  anteckning: { tabell: 'anteckningar', text: 'Anteckning' },
  diagnos: { tabell: 'diagnoser', text: 'Diagnos' },
  matvarde: { tabell: 'matvarden', text: 'Mätvärde' },
  ordination: { tabell: 'ordinationer', text: 'Ordination' },
};

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personNamn = (db, id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null;
const patientKort = (p) => (p ? { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad), forstord: Boolean(p.journal_forstord) } : null);
const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const loggArkiv = (db, personal, patientId, handling, resurs, syfte, grund = 'arkivbeslut') =>
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: patientId, handling, resurs, grund, syfte, resultat: 'tillaten' });

// Arkivarien hittar patienten med identiteten i valfritt format, som i sökningen. Svaret är maskerat för skyddad identitet.
export function hittaPatient(db, personal, q) {
  const t = identitet.tolka(String(q ?? '').slice(0, 80));
  if (!t.arIdentitet) throw new Fel(400, 'Skriv patientens personnummer, samordningsnummer, reservnummer eller OID och nummer.', 'ogiltig', { falt: ['q'] });
  if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['q'] });
  const h = identitet.hittaPaIdentitet(db, t);
  if (!h) throw new Fel(404, 'Det finns ingen patient med den identiteten.', 'saknas');
  const p = patientRad(db, identitet.gallandeId(db, h.patientId));
  loggArkiv(db, personal, p.id, 'registrera_arkivbeslut', 'arkiv:patient', 'Arkivarien sökte patienten för ett beslut', 'administrativ');
  return patientKort(p);
}

// Patientens poster, bara med typ, datum och vårdenhet, för att peka ut det som ett beslut om förstöring gäller.
// Innehållet visas aldrig. En spärrad vårdenhet nämns inte vid namn.
export function poster(db, personal, patientId) {
  const p = patientRad(db, patientId);
  if (!p) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const sparrar = aktivaSparrar(db, p.id);
  const enhet = (id) => (sparrar.includes(vardenhetFor(db, id)) ? 'Spärrad vårdenhet' : enhetsnamn(db, vardenhetFor(db, id)));
  const ut = [];
  for (const a of db.query("SELECT * FROM anteckningar WHERE patient_id = ? AND status = 'signerad' AND id NOT IN (SELECT ersatter_id FROM anteckningar WHERE ersatter_id IS NOT NULL) ORDER BY skapad").all(p.id)) {
    ut.push({ typ: 'anteckning', id: a.id, text: a.typ, datum: a.skapad.slice(0, 10), enhet: enhet(a.enhet_id), av: personNamn(db, a.forfattare_id), versioner: a.version });
  }
  for (const d of db.query('SELECT * FROM diagnoser WHERE patient_id = ? ORDER BY datum').all(p.id)) ut.push({ typ: 'diagnos', id: d.id, text: 'Diagnos', datum: d.datum, enhet: enhet(d.enhet_id) });
  for (const m of db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY tid').all(p.id)) ut.push({ typ: 'matvarde', id: m.id, text: 'Mätvärde', datum: m.tid.slice(0, 10), enhet: enhet(m.enhet_id) });
  for (const o of db.query('SELECT * FROM ordinationer WHERE patient_id = ? ORDER BY start').all(p.id)) ut.push({ typ: 'ordination', id: o.id, text: 'Ordination', datum: o.start, enhet: enhet(o.enhet_id) });
  loggArkiv(db, personal, p.id, 'registrera_arkivbeslut', 'arkiv:poster', 'Arkivarien såg postförteckningen, utan innehåll', 'administrativ');
  return { patient: patientKort(p), poster: ut };
}

// Ett beslut registreras med diarienummer och datum. Beslutsfattare och lagrum fyller systemet i efter typen.
export function registreraBeslut(db, personal, inp) {
  const typ = inp?.typ;
  const def = BESLUTSTYPER[typ];
  if (!def) throw new Fel(400, 'Välj vilket slags beslut det är.', 'ogiltig', { falt: ['typ'] });
  const dnr = typeof inp.diarienummer === 'string' ? inp.diarienummer.trim() : '';
  if (dnr.length < 3 || dnr.length > 60) throw new Fel(400, 'Ange beslutets diarienummer.', 'ogiltig', { falt: ['diarienummer'] });
  const datum = inp.beslutsdatum ?? idag();
  if (!giltigtDatum(datum) || datum > idag()) throw new Fel(400, 'Beslutsdatumet ska vara i dag eller tidigare.', 'ogiltig', { falt: ['beslutsdatum'] });
  let patientId = null;
  let omfattning;
  if (typ === 'leverans') {
    if (inp.omfattning === 'alla') omfattning = { urval: 'alla' };
    else {
      patientId = typeof inp.patientId === 'string' ? identitet.gallandeId(db, inp.patientId) : null;
      if (!patientId || !patientRad(db, patientId)) throw new Fel(400, 'Ange patienten, eller att alla journaler ska levereras.', 'ogiltig', { falt: ['patientId'] });
      omfattning = { urval: 'patient' };
    }
  } else if (typ === 'gallring') {
    // Runda 7, r4: åren kan ändras av systemförvaltningen, aldrig under tio (konfiguration.js). GALLRING_AR är standardvärdet.
    const ar = konfiguration.varde(db, 'arkiv.gallring_ar');
    // Runda 9, r5: informationsmängderna som gallras för sig, med reglerna som de gäller i dag.
    const delar = Object.entries(INFORMATIONSMANGDER).map(([mangd, m]) => { const a = konfiguration.varde(db, m.parameter); return { mangd, ar: a, fore: addDagar(idag(), -Math.round(a * 365.25)) }; });
    omfattning = { urval: 'regel', ar, fore: addDagar(idag(), -Math.round(ar * 365.25)), delar };
  } else {
    patientId = typeof inp.patientId === 'string' ? identitet.gallandeId(db, inp.patientId) : null;
    if (!patientId || !patientRad(db, patientId)) throw new Fel(400, 'Ange patienten som beslutet gäller.', 'ogiltig', { falt: ['patientId'] });
    if (inp.omfattning === 'hela') omfattning = { hela: true };
    else {
      const lista = Array.isArray(inp.poster) ? inp.poster : [];
      if (!lista.length || lista.length > 200) throw new Fel(400, 'Välj vilka poster beslutet gäller, eller hela journalen.', 'ogiltig', { falt: ['poster'] });
      const valda = [];
      for (const x of lista) {
        const pt = POSTTYPER[x?.typ];
        const rad = pt && db.query(`SELECT id FROM ${pt.tabell} WHERE id = ? AND patient_id = ?`).get(Number(x.id), patientId);
        if (!rad) throw new Fel(400, 'En av posterna hör inte till patienten.', 'ogiltig', { falt: ['poster'] });
        valda.push({ typ: x.typ, id: rad.id });
      }
      omfattning = { poster: valda };
    }
  }
  const motivering = typeof inp.motivering === 'string' ? inp.motivering.trim().slice(0, 500) || null : null;
  const r = db.query(`INSERT INTO arkivbeslut (typ, beslutsfattare, diarienummer, beslutsdatum, lagrum, patient_id, omfattning, motivering, registrerad, registrerad_av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(typ, def.beslutsfattare, dnr, datum, def.lagrum, patientId, JSON.stringify(omfattning), motivering, iso(), personal.id);
  const id = Number(r.lastInsertRowid);
  loggArkiv(db, personal, patientId, 'registrera_arkivbeslut', `beslut:${id}`, `${def.text}, ${dnr}`);
  return beslutUt(db, hamtaBeslut(db, id));
}

export function hamtaBeslut(db, id) {
  const b = db.query('SELECT * FROM arkivbeslut WHERE id = ?').get(Number(id));
  if (!b) throw new Fel(404, 'Beslutet finns inte.', 'saknas');
  return b;
}

export function beslutUt(db, b) {
  return {
    id: b.id, typ: b.typ, typText: BESLUTSTYPER[b.typ].text, beslutsfattare: b.beslutsfattare, diarienummer: b.diarienummer,
    beslutsdatum: b.beslutsdatum, lagrum: b.lagrum, omfattning: JSON.parse(b.omfattning), motivering: b.motivering,
    patient: b.patient_id ? patientKort(patientRad(db, b.patient_id)) : null,
    registrerad: b.registrerad, registreradAv: personNamn(db, b.registrerad_av),
    verkstallt: b.verkstallt, verkstalltAv: personNamn(db, b.verkstallt_av), resultat: b.resultat ? JSON.parse(b.resultat) : null,
    exporter: db.query('SELECT * FROM arkivexporter WHERE beslut_id = ? ORDER BY tid').all(b.id).map(e => ({ id: e.id, tid: e.tid, av: personNamn(db, e.av), patienter: e.patienter, filer: e.filer, storlek: e.storlek, sha256: e.sha256,
      // Runda 9, r5: leveransen till e-arkivet och kvittensen.
      leverans: earkiv.leveransFor(db, e.id) })),
  };
}
export const listaBeslut = (db) => db.query('SELECT * FROM arkivbeslut ORDER BY id DESC').all().map(b => beslutUt(db, b));

// Den sista uppgiften i journalen, för gallringsregeln.
function sistaUppgift(db, pid) {
  return db.query(`SELECT max(t) AS t FROM (
    SELECT max(coalesce(signerad_tid, skapad)) AS t FROM anteckningar WHERE patient_id = ?1
    UNION ALL SELECT max(coalesce(slut, start)) FROM vardkontakter WHERE patient_id = ?1
    UNION ALL SELECT max(datum) FROM diagnoser WHERE patient_id = ?1
    UNION ALL SELECT max(tid) FROM matvarden WHERE patient_id = ?1
    UNION ALL SELECT max(coalesce(utsatt_tid, skapad)) FROM ordinationer WHERE patient_id = ?1
    UNION ALL SELECT max(coalesce(svar_kvitterat_tid, besvarad_tid, skickad_tid)) FROM remisser WHERE patient_id = ?1)`).get(pid)?.t ?? null;
}

// Vad beslutet gäller, som systemet räknar fram. För gallring: journaler vars sista uppgift är äldre än gränsen, utan
// pågående kontakt och inte redan gallrade. Patienter med skyddade personuppgifter visas maskerade.
export function underlag(db, personal, b) {
  const omf = JSON.parse(b.omfattning);
  let patienter = [];
  if (b.typ === 'gallring') {
    const fore = omf.fore;
    for (const p of db.query('SELECT * FROM patienter WHERE sammanslagen_till IS NULL AND journal_forstord IS NULL').all()) {
      const sista = sistaUppgift(db, p.id);
      if (!sista || sista.slice(0, 10) >= fore) continue;
      if (db.query('SELECT 1 FROM vardkontakter WHERE patient_id = ? AND slut IS NULL').get(p.id)) continue;
      patienter.push({ ...patientKort(p), sistaUppgift: sista.slice(0, 10) });
    }
  } else if (b.typ === 'leverans') {
    const rader = omf.urval === 'alla' ? db.query('SELECT * FROM patienter WHERE sammanslagen_till IS NULL ORDER BY id').all() : [patientRad(db, b.patient_id)];
    patienter = rader.map(p => ({ ...patientKort(p), sistaUppgift: sistaUppgift(db, p.id)?.slice(0, 10) ?? null }));
  } else {
    const p = patientRad(db, b.patient_id);
    patienter = [{ ...patientKort(p), sistaUppgift: sistaUppgift(db, p.id)?.slice(0, 10) ?? null }];
  }
  // Runda 9, r5: delarna av andra journaler som gallras för sig, per informationsmängd, med antal per journal.
  const delar = b.typ === 'gallring' ? gallringsdelar(db, omf, new Set(patienter.map(p => p.id))) : [];
  loggArkiv(db, personal, b.patient_id, 'registrera_arkivbeslut', `beslut:${b.id}:underlag`, `Underlag för ${BESLUTSTYPER[b.typ].text.toLowerCase()}, ${patienter.length} journaler${delar.length ? ` och delar av ${new Set(delar.flatMap(d => d.patienter.map(p => p.id))).size} journaler` : ''}`);
  return { beslut: beslutUt(db, b), patienter, delar, regel: b.typ === 'gallring' ? `Sista uppgiften före ${omf.fore}, ingen pågående kontakt.` : null };
}

// Runda 9, r5: raderna per informationsmängd som är äldre än regelns gräns, i journaler som inte gallras hela.
function gallringsdelar(db, omf, hela) {
  const ut = [];
  for (const d of omf.delar ?? []) {
    const m = INFORMATIONSMANGDER[d.mangd];
    if (!m || !db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(m.tabell)) continue;
    const rader = db.query(`SELECT x.patient_id AS pid, count(*) AS n FROM ${m.tabell} x JOIN patienter p ON p.id = x.patient_id
      WHERE ${m.datum.replace(/(skickad|skapad|tid)/g, 'x.$1')} < ? AND p.journal_forstord IS NULL AND p.sammanslagen_till IS NULL GROUP BY x.patient_id ORDER BY x.patient_id`).all(d.fore)
      .filter(r => !hela.has(r.pid));
    if (!rader.length) continue;
    ut.push({ mangd: d.mangd, text: m.text, ar: d.ar, fore: d.fore, antal: rader.reduce((s, r) => s + r.n, 0),
      patienter: rader.map(r => ({ ...patientKort(patientRad(db, r.pid)), antal: r.n })) });
  }
  return ut;
}

// FHIR R4-bundle av typen collection med hela journalen: alla versioner av signerade anteckningar, alla vårdkontakter
// och vårdtillfällen, och de organisationer och den personal som journalen hänvisar till.
export function fhirJournal(db, pid) {
  const p = patientRad(db, pid);
  const res = [fhir.patient(db, p, true)];
  for (const vt of db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.vardtillfalleEncounter(db, vt));
  for (const v of db.query('SELECT * FROM vardkontakter WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.encounter(db, v));
  for (const h of db.query('SELECT * FROM halsoarenden WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.episodeOfCare(db, h));
  for (const d of db.query('SELECT * FROM diagnoser WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.condition(db, d));
  for (const m of db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.observation(db, m));
  for (const o of db.query('SELECT * FROM ordinationer WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.medicationRequest(db, o));
  for (const o of db.query('SELECT * FROM overkanslighet WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.allergyIntolerance(db, o));
  if (db.query("SELECT 1 FROM sqlite_master WHERE name = 'uppmarksamhet'").get()) {
    for (const u of db.query("SELECT * FROM uppmarksamhet WHERE patient_id = ? AND status <> 'avfard' AND kategori <> 'overkanslighet' ORDER BY id").all(pid)) res.push(fhir.flag(db, u));
  }
  for (const r of db.query('SELECT * FROM remisser WHERE patient_id = ? ORDER BY id').all(pid)) res.push(fhir.serviceRequest(db, r, true));
  for (const a of db.query("SELECT * FROM anteckningar WHERE patient_id = ? AND status = 'signerad' ORDER BY id").all(pid)) res.push(fhir.composition(db, a));
  const json = JSON.stringify(res);
  const orgs = [...new Set([...json.matchAll(/"Organization\/([\w-]+)"/g)].map(m => m[1]))];
  const pers = [...new Set([...json.matchAll(/"Practitioner\/([\w-]+)"/g)].map(m => m[1]))];
  for (const id of orgs) { const e = db.query('SELECT * FROM enheter WHERE id = ?').get(id); if (e) res.push(fhir.organization(db, e)); }
  for (const id of pers) { const x = db.query('SELECT * FROM personal WHERE id = ?').get(id); if (x) res.push(fhir.practitioner(db, x)); }
  return {
    resourceType: 'Bundle', type: 'collection', timestamp: iso(),
    entry: res.map(r => ({ fullUrl: `urn:vardkallan:${r.resourceType}/${r.id}`, resource: r })),
  };
}

const xml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const sha = (b) => createHash('sha256').update(b).digest('hex').toUpperCase();

function beskrivning(db, b, patienter, objid, tid) {
  return `# Exportpaket ur Vårdkällan

Paket: ${objid}
Skapat: ${tid}
Beslut: ${BESLUTSTYPER[b.typ].text}, diarienummer ${b.diarienummer}, ${b.beslutsdatum} (${b.beslutsfattare})
Antal journaler: ${patienter.length}

Paketet är skapat i en demo med påhittade patienter och testpersonnummer från Skatteverket. Det är ingen leverans från en verklig vårdgivare.

## Struktur

Paketet följer FGS Paketstruktur 2.0 (E-ARK CSIP 2.1.0 och E-ARK SIP 2.1.0 i Riksarkivets tillämpning, version 1.0, 2023-03-30). METS.xml beskriver alla filer med storlek och SHA-256.

- representations/rep_1/data/journal/: journalhandlingarna, en fil per patient i HL7 FHIR R4 (4.0.1) som JSON, Bundle av typen collection.
- representations/rep_1/data/journal/<patient>-utlamnanden.json: utlämnade journalhandlingar (patientdatalagen 3 kap. 11 §) och utskrifter.
- representations/rep_1/data/journal/<patient>-sparr-och-skydd.json: spärrar och skyddade personuppgifter, som gäller för den som tar emot paketet.
- representations/rep_1/data/ovrigt/<patient>-atkomstlogg.ndjson: åtkomstloggen för patienten, en rad per åtkomst med hashkedjans värden. Loggen är inte en journalhandling och ligger därför för sig.
- metadata/preservation/premis.xml: händelsen när paketet skapades.
- metadata/descriptive/earkiv-index.xml: en post per journalhandling med e-arkivets dataelement, se mappningen nedan.

## Dataelement

| Vårdkällan | FHIR R4 |
|---|---|
| Patient och identiteter | Patient (personnummer med http://electronichealth.se/identifier/personnummer) |
| Vårdkontakt | Encounter |
| Vårdtillfälle | Encounter med id vt-<nummer>, som vårdkontakterna är partOf |
| Hälsoärende | EpisodeOfCare |
| Diagnos | Condition med ICD-10-SE |
| Mätvärde och provsvar | Observation med NPU och LOINC |
| Ordination | MedicationRequest med ATC och NPL-id |
| Överkänslighet | AllergyIntolerance |
| Uppmärksamhetsinformation | Flag |
| Remiss och svar | ServiceRequest |
| Journalanteckning, alla versioner | Composition med relatesTo för rättelser och attester för kontrasignering |
| Vårdenhet | Organization |
| Personal | Practitioner |

${earkiv.mappningDok()}
## Det som saknas i demon

Mottagaren är ett simulerat e-arkiv, och dess dataelement är en förenklad uppsättning i demon och inte en verklig leveransöverenskommelse. E-arkivet kontrollerar paketet mot METS.xml, kontrollsummorna, mapparna och de obligatoriska dataelementen, men XML-scheman för METS och PREMIS ligger inte i mappen schemas, och paketet valideras inte mot schemana.
`;
}

function premis(objid, tid, filer) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<premis:premis xmlns:premis="http://www.loc.gov/premis/v3" version="3.0">
  <premis:object xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="premis:intellectualEntity">
    <premis:objectIdentifier><premis:objectIdentifierType>OBJID</premis:objectIdentifierType><premis:objectIdentifierValue>${xml(objid)}</premis:objectIdentifierValue></premis:objectIdentifier>
  </premis:object>
  <premis:event>
    <premis:eventIdentifier><premis:eventIdentifierType>UUID</premis:eventIdentifierType><premis:eventIdentifierValue>${randomUUID()}</premis:eventIdentifierValue></premis:eventIdentifier>
    <premis:eventType>creation</premis:eventType>
    <premis:eventDateTime>${tid}</premis:eventDateTime>
    <premis:eventDetailInformation><premis:eventDetail>Paketet skapades av Vårdkällan med ${filer} filer och SHA-256 för varje fil.</premis:eventDetail></premis:eventDetailInformation>
    <premis:linkingAgentIdentifier><premis:linkingAgentIdentifierType>local</premis:linkingAgentIdentifierType><premis:linkingAgentIdentifierValue>Vårdkällan</premis:linkingAgentIdentifierValue></premis:linkingAgentIdentifier>
  </premis:event>
  <premis:agent>
    <premis:agentIdentifier><premis:agentIdentifierType>local</premis:agentIdentifierType><premis:agentIdentifierValue>Vårdkällan</premis:agentIdentifierValue></premis:agentIdentifier>
    <premis:agentName>Vårdkällan</premis:agentName><premis:agentType>software</premis:agentType>
  </premis:agent>
</premis:premis>
`;
}

function mets(db, objid, tid, filer, version, arkivbildare) {
  const grupp = (use, lista) => `    <fileGrp ID="${xml(`fg-${use.replace(/\W/g, '-')}`)}" USE="${xml(use)}">
${lista.map(f => `      <file ID="${xml(f.id)}" MIMETYPE="${xml(f.mime)}" SIZE="${f.data.length}" CREATED="${tid}" CHECKSUM="${f.sha}" CHECKSUMTYPE="SHA-256">
        <FLocat LOCTYPE="URL" xlink:type="simple" xlink:href="${xml(f.relativ)}"/>
      </file>`).join('\n')}
    </fileGrp>`;
  const doc = filer.filter(f => f.grupp === 'Documentation');
  // Runda 9, r5: indexet med e-arkivets dataelement är beskrivande metadata.
  const desc = filer.filter(f => f.grupp === 'Descriptive');
  const rep = filer.filter(f => f.grupp === 'Representations');
  const pres = filer.filter(f => f.grupp === 'Preservation');
  return `<?xml version="1.0" encoding="UTF-8"?>
<mets xmlns="http://www.loc.gov/METS/" xmlns:csip="https://DILCIS.eu/XML/METS/CSIPExtensionMETS" xmlns:sip="https://DILCIS.eu/XML/METS/SIPExtensionMETS"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.loc.gov/METS/ http://www.loc.gov/standards/mets/version112/mets.xsd"
  OBJID="${xml(objid)}" LABEL="Patientjournaler ur Vårdkällan" TYPE="Datasets" csip:CONTENTINFORMATIONTYPE="OTHER"
  csip:OTHERCONTENTINFORMATIONTYPE="HL7 FHIR R4 4.0.1" PROFILE="https://earksip.dilcis.eu/profile/E-ARK-SIP.xml">
  <metsHdr CREATEDATE="${tid}" RECORDSTATUS="NEW" csip:OAISPACKAGETYPE="SIP">
    <agent ROLE="CREATOR" TYPE="OTHER" OTHERTYPE="SOFTWARE"><name>Vårdkällan</name><note csip:NOTETYPE="SOFTWARE VERSION">${xml(version ?? 'okänd')}</note></agent>
    <agent ROLE="ARCHIVIST" TYPE="ORGANIZATION"><name>${xml(arkivbildare)} (demo)</name></agent>
  </metsHdr>
${desc.map(f => `  <dmdSec ID="dmd-${xml(f.id)}" CREATED="${tid}" STATUS="CURRENT"><mdRef LOCTYPE="URL" xlink:type="simple" xlink:href="${xml(f.relativ)}" MDTYPE="OTHER" OTHERMDTYPE="E-arkivindex" MIMETYPE="text/xml" SIZE="${f.data.length}" CREATED="${tid}" CHECKSUM="${f.sha}" CHECKSUMTYPE="SHA-256"/></dmdSec>`).join('\n')}
  <amdSec>
${pres.map(f => `    <digiprovMD ID="dp-${xml(f.id)}" STATUS="CURRENT"><mdRef LOCTYPE="URL" xlink:type="simple" xlink:href="${xml(f.relativ)}" MDTYPE="PREMIS" MIMETYPE="text/xml" SIZE="${f.data.length}" CREATED="${tid}" CHECKSUM="${f.sha}" CHECKSUMTYPE="SHA-256"/></digiprovMD>`).join('\n')}
  </amdSec>
  <fileSec ID="filsektion">
${grupp('Documentation', doc)}
    <fileGrp ID="fg-Schemas" USE="Schemas"/>
${grupp('Representations/rep_1', rep)}
  </fileSec>
  <structMap ID="struktur" TYPE="PHYSICAL" LABEL="CSIP">
    <div ID="rot" LABEL="${xml(objid)}">
      <div ID="metadata" LABEL="Metadata" ADMID="${pres.map(f => `dp-${xml(f.id)}`).join(' ')}"${desc.length ? ` DMDID="${desc.map(f => `dmd-${xml(f.id)}`).join(' ')}"` : ''}/>
      <div ID="dokumentation" LABEL="Documentation"><fptr FILEID="fg-Documentation"/></div>
      <div ID="scheman" LABEL="Schemas"><fptr FILEID="fg-Schemas"/></div>
      <div ID="rep1" LABEL="Representations/rep_1"><fptr FILEID="fg-Representations-rep_1"/></div>
    </div>
  </structMap>
</mets>
`;
}

// Bygger exportpaketet för beslutet. Returnerar ZIP-filen och vad som exporterades.
export function exportera(db, personal, b, { version = null } = {}) {
  if (b.typ !== 'leverans') throw new Fel(400, 'Exportpaket skapas för beslut om leverans till e-arkiv.', 'ogiltig');
  const { patienter } = underlag(db, personal, b);
  const objid = `IP_${randomUUID()}`;
  const tid = iso();
  const filer = [];
  const lagg = (relativ, data, mime, grupp) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    filer.push({ relativ, data: buf, mime, grupp, sha: sha(buf), id: `fil-${filer.length + 1}` });
  };
  for (const pk of patienter) {
    const pid = pk.id;
    lagg(`representations/rep_1/data/journal/${pid}.json`, JSON.stringify(fhirJournal(db, pid), null, 1), 'application/fhir+json', 'Representations');
    const utl = {
      patient: pid,
      utskrifter: db.query('SELECT id, tid, personal_id, enhet_id, syfte, delar, utelamnat, avidentifierad, innehall_hash FROM utskrifter WHERE patient_id = ? ORDER BY tid').all(pid)
        .map(u => ({ ...u, delar: JSON.parse(u.delar), utelamnat: JSON.parse(u.utelamnat), avidentifierad: Boolean(u.avidentifierad) })),
      utlamnanden: db.query('SELECT * FROM utlamnanden WHERE patient_id = ? ORDER BY utlamnad').all(pid),
    };
    lagg(`representations/rep_1/data/journal/${pid}-utlamnanden.json`, JSON.stringify(utl, null, 1), 'application/json', 'Representations');
    const p = patientRad(db, pid);
    const skydd = {
      patient: pid, skyddadePersonuppgifter: Boolean(p.skyddad),
      sparrar: db.query('SELECT enhet_id, registrerad, aktiv FROM sparrar WHERE patient_id = ? ORDER BY id').all(pid).map(s => ({ vardenhet: enhetsnamn(db, vardenhetFor(db, s.enhet_id)), hsaId: db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(vardenhetFor(db, s.enhet_id))?.hsa_id, registrerad: s.registrerad, aktiv: Boolean(s.aktiv) })),
      text: 'Spärrade uppgifter får inte göras tillgängliga för andra vårdenheter utan patientens samtycke (patientdatalagen 4 kap. 4 §). Skyddade personuppgifter ska skyddas hos mottagaren.',
    };
    lagg(`representations/rep_1/data/journal/${pid}-sparr-och-skydd.json`, JSON.stringify(skydd, null, 1), 'application/json', 'Representations');
    const logg = identitet.allaPatientIdn(db, pid).flatMap(id => db.query('SELECT * FROM atkomstlogg WHERE patient_id = ? ORDER BY id').all(id));
    lagg(`representations/rep_1/data/ovrigt/${pid}-atkomstlogg.ndjson`, logg.map(r => JSON.stringify(r)).join('\n') + (logg.length ? '\n' : ''), 'application/x-ndjson', 'Representations');
  }
  lagg('metadata/descriptive/earkiv-index.xml', earkiv.indexXml(patienter.flatMap(pk => earkiv.index(db, pk.id))), 'text/xml', 'Descriptive');
  lagg('documentation/beskrivning.md', beskrivning(db, b, patienter, objid, tid), 'text/markdown', 'Documentation');
  lagg('metadata/preservation/premis.xml', premis(objid, tid, filer.length), 'text/xml', 'Preservation');
  const metsXml = mets(db, objid, tid, filer, version, enhetsnamn(db, 'rol'));
  const kataloger = ['', 'metadata/', 'metadata/descriptive/', 'metadata/preservation/', 'metadata/other/', 'representations/', 'representations/rep_1/', 'representations/rep_1/data/',
    'representations/rep_1/data/journal/', 'representations/rep_1/data/ovrigt/', 'schemas/', 'documentation/'];
  const paket = zip([
    ...kataloger.map(k => ({ namn: `${objid}/${k}` })),
    { namn: `${objid}/METS.xml`, data: metsXml },
    ...filer.map(f => ({ namn: `${objid}/${f.relativ}`, data: f.data })),
  ]);
  const kontroll = sha(paket);
  db.transaction(() => {
    db.query('INSERT INTO arkivexporter (id, beslut_id, tid, av, patienter, filer, storlek, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(objid, b.id, tid, personal.id, patienter.length, filer.length + 1, paket.length, kontroll);
    if (!b.verkstallt) db.query('UPDATE arkivbeslut SET verkstallt = ?, verkstallt_av = ?, resultat = ? WHERE id = ?').run(tid, personal.id, JSON.stringify({ paket: objid, patienter: patienter.length }), b.id);
    // Varje journal i paketet loggas som utlämnad till e-arkivet.
    for (const pk of patienter) loggArkiv(db, personal, pk.id, 'arkivera', `beslut:${b.id}:${objid}`, `Export till e-arkiv enligt ${b.diarienummer}`);
  })();
  return { objid, paket, sha256: kontroll, patienter: patienter.length, filer: filer.length + 1 };
}

// Släpper triggrarna som stoppar radering på tabellerna, kör fn och lägger tillbaka dem, allt i en transaktion.
// Åtkomstloggens triggrar finns aldrig med.
function medSlapptaTriggrar(db, tabeller, fn) {
  const lista = [...tabeller].filter(t => t !== 'atkomstlogg');
  if (!lista.length) return fn();
  const trig = db.query(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (${lista.map(() => '?').join(', ')}) AND sql LIKE '%BEFORE DELETE%'`).all(...lista);
  for (const t of trig) db.exec(`DROP TRIGGER "${t.name}"`);
  try { return fn(); } finally { for (const t of trig) db.exec(t.sql); }
}

const patientTabeller = (db) => db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name)
  .filter(t => !BEVARAS.has(t) && db.query(`PRAGMA table_info(${t})`).all().some(k => k.name === 'patient_id'));

// Raderar journalens innehåll för en patient, eller de utpekade posterna. Returnerar hur många rader av varje slag.
function radera(db, pid, omfattning) {
  const antal = {};
  const del = (tabell, where, ...arg) => {
    const n = db.query(`SELECT count(*) AS n FROM ${tabell} WHERE ${where}`).get(...arg).n;
    if (n) { db.query(`DELETE FROM ${tabell} WHERE ${where}`).run(...arg); antal[tabell] = (antal[tabell] ?? 0) + n; }
  };
  const ordBeroende = (ids) => {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(', ');
    del('ordination_historik', `ordination_id IN (${ph})`, ...ids);
    del('nll_meddelanden', `ordination_id IN (${ph})`, ...ids);
  };
  if (omfattning.hela) {
    const tabeller = patientTabeller(db);
    medSlapptaTriggrar(db, [...tabeller, 'ordination_historik', 'nll_meddelanden', 'vardtillfalle_handelser'], () => {
      ordBeroende(db.query('SELECT id FROM ordinationer WHERE patient_id = ?').all(pid).map(r => r.id));
      const vt = db.query('SELECT id FROM vardtillfallen WHERE patient_id = ?').all(pid).map(r => r.id);
      if (vt.length) del('vardtillfalle_handelser', `vardtillfalle_id IN (${vt.map(() => '?').join(', ')})`, ...vt);
      for (const t of tabeller) del(t, 'patient_id = ?', pid);
    });
    db.query('UPDATE patienter SET adress = NULL, postnr = NULL, ort = NULL, telefon = NULL, kontaktperson = NULL WHERE id = ?').run(pid);
    return antal;
  }
  medSlapptaTriggrar(db, ['anteckningar', 'diagnoser', 'matvarden', 'ordinationer', 'ordination_historik', 'nll_meddelanden', 'kontrasigneringar'], () => {
    for (const x of omfattning.poster) {
      if (x.typ === 'anteckning') {
        // Hela versionskedjan: den utpekade versionen, de tidigare och de senare.
        const kedja = new Set([x.id]);
        let andrad = true;
        while (andrad) {
          andrad = false;
          for (const r of db.query('SELECT id, ersatter_id FROM anteckningar WHERE patient_id = ?').all(pid)) {
            if ((kedja.has(r.id) && r.ersatter_id && !kedja.has(r.ersatter_id)) || (r.ersatter_id && kedja.has(r.ersatter_id) && !kedja.has(r.id))) {
              kedja.add(r.id); if (r.ersatter_id) kedja.add(r.ersatter_id); andrad = true;
            }
          }
        }
        const ids = [...kedja];
        const ph = ids.map(() => '?').join(', ');
        del('kontrasigneringar', `typ = 'anteckning' AND post_id IN (${ph})`, ...ids);
        del('anteckningar', `id IN (${ph}) AND patient_id = ?`, ...ids, pid);
      } else if (x.typ === 'matvarde') {
        del('kontrasigneringar', "typ = 'matvarde' AND post_id = ?", x.id);
        del('matvarden', 'id = ? AND patient_id = ?', x.id, pid);
      } else if (x.typ === 'ordination') {
        ordBeroende([x.id]);
        del('ordinationer', 'id = ? AND patient_id = ?', x.id, pid);
      } else if (x.typ === 'diagnos') del('diagnoser', 'id = ? AND patient_id = ?', x.id, pid);
    }
  });
  return antal;
}

const RADTEXT = { anteckningar: 'anteckningar', diagnoser: 'diagnoser', matvarden: 'mätvärden', ordinationer: 'ordinationer', vardkontakter: 'vårdkontakter', remisser: 'remisser' };

// Runda 9, r5: gallring av delar. Raderna och det som pekar på dem (kontrasignering, svaret från laboratoriet och
// kallelsens språk) tas bort med släppta triggrar, och varje journal får en rad i loggen med antal per mängd, utan
// innehåll. Ger antalet per mängd.
function gallraDelar(db, personal, b, delar) {
  const per = new Map();
  const antal = {};
  const finnsT = (t) => db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  medSlapptaTriggrar(db, ['matvarden', 'kallelser', 'kontrasigneringar', 'labb_svar', 'kallelse_sprak'], () => {
    for (const d of delar) {
      const m = INFORMATIONSMANGDER[d.mangd];
      for (const p of d.patienter) {
        const ids = db.query(`SELECT id FROM ${m.tabell} WHERE patient_id = ? AND ${m.datum} < ?`).all(p.id, d.fore).map(r => r.id);
        if (!ids.length) continue;
        const ph = ids.map(() => '?').join(', ');
        if (d.mangd === 'matvarden') {
          if (finnsT('kontrasigneringar')) db.query(`DELETE FROM kontrasigneringar WHERE typ = 'matvarde' AND post_id IN (${ph})`).run(...ids);
          if (finnsT('labb_svar')) db.query(`DELETE FROM labb_svar WHERE matvarde_id IN (${ph})`).run(...ids);
        }
        if (d.mangd === 'kallelser' && finnsT('kallelse_sprak')) db.query(`DELETE FROM kallelse_sprak WHERE kallelse_id IN (${ph})`).run(...ids);
        db.query(`DELETE FROM ${m.tabell} WHERE id IN (${ph})`).run(...ids);
        antal[d.mangd] = (antal[d.mangd] ?? 0) + ids.length;
        if (!per.has(p.id)) per.set(p.id, []);
        per.get(p.id).push(`${ids.length} ${ids.length === 1 ? m.radtext[0] : m.radtext[1]} äldre än ${d.ar} år`);
      }
    }
  });
  for (const [pid, texter] of per) loggArkiv(db, personal, pid, 'gallra', `beslut:${b.id}:delar`, `Gallring enligt ${b.diarienummer} (${b.beslutsfattare}). Delar av journalen: ${texter.join(', ')}.`);
  return { journaler: per.size, rader: antal };
}

// Verkställer gallring eller radering. Beslutet kan bara verkställas en gång.
export function verkstall(db, personal, b) {
  if (b.typ === 'leverans') throw new Fel(400, 'Ett beslut om leverans verkställs genom att exportpaketet skapas.', 'ogiltig');
  if (b.verkstallt) throw new Fel(400, 'Beslutet är redan verkställt.', 'ogiltig');
  const omf = JSON.parse(b.omfattning);
  const u = b.typ === 'gallring' ? underlag(db, personal, b) : null;
  const patienter = u ? u.patienter.map(p => p.id) : [b.patient_id];
  const tid = iso();
  const resultat = { patienter: 0, rader: {} };
  db.transaction(() => {
    // Runda 9, r5: delarna av andra journaler, per informationsmängd. Bara raderna som är äldre än regelns gräns.
    if (u?.delar.length) resultat.delar = gallraDelar(db, personal, b, u.delar);
    for (const pid of patienter) {
      const omfattning = b.typ === 'gallring' ? { hela: true } : omf;
      const antal = radera(db, pid, omfattning);
      if (omfattning.hela) db.query('UPDATE patienter SET journal_forstord = ? WHERE id = ?').run(b.id, pid);
      for (const [t, n] of Object.entries(antal)) resultat.rader[t] = (resultat.rader[t] ?? 0) + n;
      resultat.patienter++;
      const sammanfattning = Object.entries(antal).filter(([t]) => RADTEXT[t]).map(([t, n]) => `${n} ${RADTEXT[t]}`).join(', ') || 'inga poster';
      loggArkiv(db, personal, pid, LOGGHANDLING[b.typ], `beslut:${b.id}`, `${BESLUTSTYPER[b.typ].text} enligt ${b.diarienummer} (${b.beslutsfattare}). ${omfattning.hela ? 'Hela journalen' : 'Utpekade poster'}: ${sammanfattning}.`);
    }
    db.query('UPDATE arkivbeslut SET verkstallt = ?, verkstallt_av = ?, resultat = ? WHERE id = ?').run(tid, personal.id, JSON.stringify(resultat), b.id);
  })();
  return beslutUt(db, hamtaBeslut(db, b.id));
}

// Det som patienthuvudet säger om en journal som har gallrats eller förstörts.
export function huvudDel(db, p) {
  if (!p.journal_forstord) return null;
  const b = db.query('SELECT * FROM arkivbeslut WHERE id = ?').get(p.journal_forstord);
  return b ? { typ: b.typ, text: `Journalen är ${b.typ === 'gallring' ? 'gallrad' : 'förstörd'} enligt beslut ${b.diarienummer} den ${b.beslutsdatum} (${b.beslutsfattare}).` } : null;
}
