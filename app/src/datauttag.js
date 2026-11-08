// Accesspunkt för datauttag till uppföljning (Sussa 6.3.1). En utdatakälla som byggs om av sig själv varje natt klockan
// 02.00 svensk tid, och när den hämtas om den senaste uppdateringen är äldre än det. Den innehåller inga namn, inga
// personnummer, inga adresser och ingen fritext. Patienten finns med som en pseudonym, ålder i femårsgrupper och kön,
// bara i de tabeller där uppföljningen behöver följa samma patient. Raderna har en stabil nyckel, så att uttaget kan
// läsas inkrementellt: vad som är nytt, ändrat och borttaget sedan föregående uppdatering.
//
// Formatet följer manifestet i FHIR Bulk Data Access (transactionTime, output med type, url och count) och raderna är
// NDJSON, en JSON-rad per post. Raderna är egna tabeller och inte FHIR-resurser, eftersom de är pseudonymiserade och
// saknar fritext. Fälten beskrivs i SCHEMA nedan och i docs/design.md.
//
// Det som inte kommer med: uppgifter från en vårdenhet som patienten har spärrat (patienten har motsatt sig att de görs
// tillgängliga), och alla uppgifter om patienter med skyddade personuppgifter. Hur många rader som utelämnades och
// varför står i manifestet, men inte vilka.
import { createHmac, randomBytes } from 'node:crypto';
import { vardenhetFor, aktivaSparrar } from './atkomst.js';

const TZ = 'Europe/Stockholm';
export const UPPDATERAS_KLOCKAN = 2;
// Runda 9, r7: en veckas uppdateringar sparas, så att den som har missat en uppdatering kan läsa ändringarna sedan den
// uppdatering den senast läste (Sussa 6.3.1.5).
export const BEHALL = 7;

const datumI = (iso) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }) : null);
const arAv = (fodd, datum) => {
  const [y, m, d] = fodd.split('-').map(Number);
  const [ty, tm, td] = datum.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};
const aldersgrupp = (fodd, datum) => {
  const a = Math.max(0, arAv(fodd, datum));
  if (a >= 90) return '90-';
  const f = Math.floor(a / 5) * 5;
  return `${f}-${f + 4}`;
};

export const SCHEMA = {
  Vardkontakt: {
    beskrivning: 'En rad per vårdkontakt.',
    falt: {
      rad: 'Radens stabila nyckel (pseudonym). Samma post har samma nyckel i varje uppdatering.',
      patient: 'Patientens pseudonym, samma i alla tabeller och uppdateringar. Går inte att föra tillbaka till personnummer utan nyckeln, som bara finns i systemet.',
      aldersgrupp: 'Patientens ålder vid kontaktens början i femårsgrupper, 90- för 90 år och äldre.',
      kon: '"kvinna" eller "man".',
      vardenhet: 'Vårdenhetens HSA-id (påhittat i demon).', vardenhetNamn: 'Vårdenhetens namn.',
      vardform: '"oppenvard", "akut", "slutenvard", "hemsjukvard" eller "dagkirurgi".', kontaktsatt: '"besok", "telefon", "video", "hembesok", eller tomt i slutenvård.',
      startdatum: 'Datum i svensk tid.', slutdatum: 'Datum i svensk tid, eller tomt om kontakten pågår.',
      vardtidDagar: 'Antal vårddygn för slutenvård, annars tomt.', kalla: '"vardkallan", "migrerad:VAS" eller "migrerad:Cosmic".',
      besoksMinuter: 'Den faktiska besökstiden i minuter, från ankomsten till att besöket slutade, eller tomt.',
    },
  },
  Diagnos: {
    beskrivning: 'En rad per registrerad diagnos.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid diagnosdatumet i femårsgrupper.', kon: '"kvinna" eller "man".',
      vardenhet: 'Vårdenhetens HSA-id.', kod: 'ICD-10-SE.', kodKategori: 'De tre första tecknen i koden.', typ: '"huvud" eller "bi".', datum: 'Diagnosdatum.',
    },
  },
  Ordination: {
    beskrivning: 'En rad per läkemedelsordination, utan dosering och ordinationsorsak.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid start i femårsgrupper.', kon: '"kvinna" eller "man".',
      vardenhet: 'Vårdenhetens HSA-id.', atc: 'ATC-kod.', typ: '"staende", "vid_behov" eller "tillfallig".', startdatum: 'Startdatum.',
      status: '"aktiv" eller "utsatt".', utsattDatum: 'Datum för utsättning, eller tomt.',
    },
  },
  Remiss: {
    beskrivning: 'En rad per remiss, utan patient, frågeställning och svar. Ledtiderna räknas i hela dagar.',
    falt: {
      rad: 'Radens stabila nyckel.', franVardenhet: 'Remitterande vårdenhets HSA-id.', tillVardenhet: 'Mottagande vårdenhets HSA-id.',
      prioritet: '"akut", "skyndsam" eller "normal".', status: '"skickad", "mottagen", "bedomd", "besvarad" eller "svar_kvitterat".', beslut: '"accepterad", "avvisad" eller tomt.',
      skickadDatum: 'Datum.', dagarTillMottagen: 'Dagar från skickad till mottagningskvittens.', dagarTillSvar: 'Dagar från skickad till svar.',
    },
  },
  // Runda 9, r7: mätvärden, anteckningar utan fritext, vårdtillfällen och patientavgifter (Sussa 6.3.1.3).
  Matvarde: {
    beskrivning: 'En rad per mätvärde och provsvar, utan kommentarer.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid mätningen i femårsgrupper.', kon: '"kvinna" eller "man".',
      vardenhet: 'Vårdenhetens HSA-id.', vardkontakt: 'Vårdkontaktens radnyckel i tabellen Vardkontakt, eller tomt.', typ: 'Mätvärdets typ, till exempel "blodtryck" eller "hba1c".',
      varde: 'Värdet som tal, eller som text för blodtryck (systoliskt/diastoliskt) och medvetandegrad.', enhet: 'Måttenheten.', datum: 'Datum för mätningen.',
    },
  },
  Anteckning: {
    beskrivning: 'En rad per journalanteckning i den gällande versionen, utan text: bara typ, kategori, vårdenhet och tid.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', vardenhet: 'Vårdenhetens HSA-id.', vardkontakt: 'Vårdkontaktens radnyckel, eller tomt.',
      typ: 'Anteckningstypen, till exempel "Daganteckning".', kategori: '"lakare" eller "omvardnad".', status: '"signerad" eller "utkast".', datum: 'Datum när anteckningen skrevs.',
      signeradDatum: 'Datum för signeringen, eller tomt.', version: 'Versionsnumret. Över 1 betyder att anteckningen har rättats.', kalla: '"vardkallan", "migrerad:VAS" eller "migrerad:Cosmic".',
    },
  },
  Vardtillfalle: {
    beskrivning: 'En rad per vårdtillfälle i slutenvård, från inskrivning till utskrivning.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid inskrivningen i femårsgrupper.', kon: '"kvinna" eller "man".',
      vardenhet: 'HSA-id för vårdenheten med det medicinska ansvaret.', inskrivenDatum: 'Datum för inskrivningen.', utskrivenDatum: 'Datum för utskrivningen, eller tomt om patienten är inskriven.',
      vardtidDagar: 'Antal vårddygn, eller tomt om patienten är inskriven.', vistelser: 'Antal vistelser på avdelningar under vårdtillfället.',
    },
  },
  Patientavgift: {
    beskrivning: 'En rad per vårdkontakt med patientavgiften enligt demoreglerna.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', vardenhet: 'Vårdenhetens HSA-id.', vardkontakt: 'Vårdkontaktens radnyckel.',
      vardform: 'Vårdformen.', datum: 'Kontaktens datum.', belopp: 'Avgiften i kronor.', avgiftsfri: 'true när kontakten är avgiftsfri.',
    },
  },
};
export const TYPER = Object.keys(SCHEMA);

// Pseudonymerna räknas med HMAC-SHA256 och en nyckel som bara finns i sandlådan.
function nyckel(db) {
  let k = db.query("SELECT varde FROM installningar WHERE nyckel = 'datauttag_nyckel'").get()?.varde;
  if (!k) {
    k = randomBytes(32).toString('base64url');
    db.query("INSERT INTO installningar VALUES ('datauttag_nyckel', ?) ON CONFLICT (nyckel) DO UPDATE SET varde = excluded.varde").run(k);
  }
  return k;
}
const pseudonym = (k, varde) => createHmac('sha256', k).update(varde).digest('hex').slice(0, 20);

// Nästa schemalagda uppdatering efter tiden t: klockan 02.00 svensk tid, också när sommartiden börjar eller slutar.
const pad = (n) => String(n).padStart(2, '0');
function lokalMs(dag, timme) {
  const gissning = Date.parse(`${dag}T${pad(timme)}:00:00Z`);
  const off = (ms) => Date.parse(new Date(ms).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + 'Z') - ms;
  return gissning - off(gissning - off(gissning));
}
export function nastaUppdatering(t) {
  const ms = Date.parse(t);
  for (let dagar = 0; dagar <= 2; dagar++) {
    const kandidat = lokalMs(new Date(ms + dagar * 86400_000).toLocaleDateString('sv-SE', { timeZone: TZ }), UPPDATERAS_KLOCKAN);
    if (kandidat > ms) return new Date(kandidat).toISOString();
  }
  return new Date(ms + 86400_000).toISOString();
}

// Bygger raderna ur databasen. Spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med.
export function bygg(db) {
  const k = nyckel(db);
  const hsa = new Map(db.query('SELECT id, hsa_id, namn FROM enheter').all().map(e => [e.id, e]));
  const ve = (id) => hsa.get(vardenhetFor(db, id));
  const patienter = new Map(db.query('SELECT id, fodd, kon, skyddad, sammanslagen_till FROM patienter').all().map(p => [p.id, p]));
  const sparrar = new Map();
  const sparrad = (pid, enhetId) => {
    if (!sparrar.has(pid)) sparrar.set(pid, aktivaSparrar(db, pid));
    return sparrar.get(pid).includes(vardenhetFor(db, enhetId));
  };
  const utelamnat = { sparrade: 0, skyddadeUppgifter: 0 };
  const data = Object.fromEntries(TYPER.map(t => [t, []]));
  // Släpper igenom en rad om den får komma med, och räknar den annars.
  const far = (pid, enhetId) => {
    const p = patienter.get(pid);
    if (!p) return null;
    if (p.skyddad) { utelamnat.skyddadeUppgifter++; return null; }
    if (sparrad(pid, enhetId)) { utelamnat.sparrade++; return null; }
    return p;
  };
  const person = (p, datum) => ({ patient: pseudonym(k, `patient:${p.id}`), aldersgrupp: aldersgrupp(p.fodd, datum ?? p.fodd), kon: p.kon });
  for (const v of db.query('SELECT * FROM vardkontakter ORDER BY id').all()) {
    const p = far(v.patient_id, v.enhet_id);
    if (!p) continue;
    const start = datumI(v.start);
    const slut = datumI(v.slut);
    const e = ve(v.enhet_id);
    data.Vardkontakt.push({
      rad: pseudonym(k, `vardkontakt:${v.id}`), ...person(p, start), vardenhet: e?.hsa_id ?? null, vardenhetNamn: e?.namn ?? null,
      vardform: v.typ, kontaktsatt: v.kontaktsatt ?? null, startdatum: start, slutdatum: slut,
      vardtidDagar: v.typ === 'slutenvard' && v.slut ? Math.max(1, Math.round((Date.parse(v.slut) - Date.parse(v.start)) / 86400_000)) : null, kalla: v.kalla,
      besoksMinuter: v.besok_slut ? Math.max(0, Math.round((Date.parse(v.besok_slut) - Date.parse(v.ankomst ?? v.start)) / 60_000)) : null,
    });
  }
  for (const d of db.query('SELECT * FROM diagnoser ORDER BY id').all()) {
    const p = far(d.patient_id, d.enhet_id);
    if (!p) continue;
    data.Diagnos.push({ rad: pseudonym(k, `diagnos:${d.id}`), ...person(p, d.datum), vardenhet: ve(d.enhet_id)?.hsa_id ?? null, kod: d.kod, kodKategori: d.kod.slice(0, 3), typ: d.typ, datum: d.datum });
  }
  const atc = new Map(db.query('SELECT id, atc FROM katalog').all().map(x => [x.id, x.atc]));
  for (const o of db.query('SELECT * FROM ordinationer ORDER BY id').all()) {
    const p = far(o.patient_id, o.enhet_id);
    if (!p) continue;
    data.Ordination.push({ rad: pseudonym(k, `ordination:${o.id}`), ...person(p, o.start), vardenhet: ve(o.enhet_id)?.hsa_id ?? null, atc: atc.get(o.lakemedel_id) ?? null, typ: o.typ, startdatum: o.start, status: o.status, utsattDatum: datumI(o.utsatt_tid) });
  }
  const dagar = (fran, till) => (fran && till ? Math.max(0, Math.floor((Date.parse(till) - Date.parse(fran)) / 86400_000)) : null);
  for (const r of db.query('SELECT * FROM remisser ORDER BY id').all()) {
    // Remissen saknar patient i uttaget, men en remiss från eller till en spärrad vårdenhet kommer inte med.
    if (!far(r.patient_id, r.fran_enhet_id) || sparrad(r.patient_id, r.till_enhet_id)) continue;
    data.Remiss.push({
      rad: pseudonym(k, `remiss:${r.id}`), franVardenhet: ve(r.fran_enhet_id)?.hsa_id ?? null, tillVardenhet: ve(r.till_enhet_id)?.hsa_id ?? null,
      prioritet: r.prioritet, status: r.status, beslut: r.beslut ?? null, skickadDatum: datumI(r.skickad_tid),
      dagarTillMottagen: dagar(r.skickad_tid, r.mottagen_tid), dagarTillSvar: dagar(r.skickad_tid, r.besvarad_tid),
    });
  }
  // Runda 9, r7: mätvärden, anteckningar, vårdtillfällen och patientavgifter, med samma regler som de andra tabellerna.
  const vk = (id) => (id ? pseudonym(k, `vardkontakt:${id}`) : null);
  for (const m of db.query('SELECT * FROM matvarden ORDER BY id').all()) {
    const p = far(m.patient_id, m.enhet_id);
    if (!p) continue;
    const d = datumI(m.tid);
    data.Matvarde.push({ rad: pseudonym(k, `matvarde:${m.id}`), ...person(p, d), vardenhet: ve(m.enhet_id)?.hsa_id ?? null, vardkontakt: vk(m.vardkontakt_id), typ: m.typ, varde: m.varde_num ?? m.varde, enhet: m.matt_enhet || null, datum: d });
  }
  for (const a of db.query('SELECT * FROM anteckningar WHERE id NOT IN (SELECT ersatter_id FROM anteckningar WHERE ersatter_id IS NOT NULL) ORDER BY id').all()) {
    const p = far(a.patient_id, a.enhet_id);
    if (!p) continue;
    data.Anteckning.push({ rad: pseudonym(k, `anteckning:${a.id}`), patient: pseudonym(k, `patient:${p.id}`), vardenhet: ve(a.enhet_id)?.hsa_id ?? null, vardkontakt: vk(a.vardkontakt_id),
      typ: a.typ, kategori: a.kategori, status: a.status, datum: datumI(a.skapad), signeradDatum: datumI(a.signerad_tid), version: a.version, kalla: a.kalla });
  }
  for (const t of db.query('SELECT * FROM vardtillfallen ORDER BY id').all()) {
    const p = far(t.patient_id, t.enhet_id);
    if (!p) continue;
    const vistelser = db.query("SELECT enhet_id FROM vardkontakter WHERE vardtillfalle_id = ? AND typ = 'slutenvard'").all(t.id);
    if (vistelser.some(x => sparrad(t.patient_id, x.enhet_id))) { utelamnat.sparrade++; continue; }
    const inn = datumI(t.inskriven);
    data.Vardtillfalle.push({ rad: pseudonym(k, `vardtillfalle:${t.id}`), ...person(p, inn), vardenhet: ve(t.enhet_id)?.hsa_id ?? null, inskrivenDatum: inn, utskrivenDatum: datumI(t.utskriven),
      vardtidDagar: t.utskriven ? Math.max(1, Math.round((Date.parse(t.utskriven) - Date.parse(t.inskriven)) / 86400_000)) : null, vistelser: vistelser.length });
  }
  const { avgiftFor } = require('./vardkontakt.js');
  for (const v of db.query("SELECT * FROM vardkontakter WHERE kalla = 'vardkallan' AND typ <> 'slutenvard' ORDER BY id").all()) {
    const p = far(v.patient_id, v.enhet_id);
    if (!p) continue;
    let a = null;
    try { a = avgiftFor(db, db.query('SELECT * FROM patienter WHERE id = ?').get(v.patient_id), v); } catch { a = null; }
    if (!a) continue;
    data.Patientavgift.push({ rad: pseudonym(k, `avgift:${v.id}`), patient: pseudonym(k, `patient:${p.id}`), vardenhet: ve(v.enhet_id)?.hsa_id ?? null, vardkontakt: vk(v.id),
      vardform: v.typ, datum: datumI(v.start), belopp: a.belopp ?? 0, avgiftsfri: !(a.belopp > 0) });
  }
  return { data, utelamnat };
}

// Kvalitetssäkring av uttaget (Sussa 6.3.1.5): kontrollregler per rad, på samma sätt som rapporterna till myndigheter
// kontrolleras före sändning (myndighetsrapport.js). En rad som inte klarar en regel kommer ändå med, men räknas och
// pekas ut med sin radnyckel i manifestet, så att mottagaren kan välja att lägga den åt sidan.
const DATUMFORMAT = /^\d{4}-\d{2}-\d{2}$/;
export const KVALITETSREGLER = {
  obligatoriska: 'Obligatoriska fält har ett värde.',
  koder: 'Koderna är giltiga: ICD-10-SE för diagnoser, ATC för läkemedel och kända typer för mätvärden och vårdformer.',
  datum: 'Datumen är giltiga och står i ordning: början före slut, inskrivning före utskrivning och skrivning före signering.',
  referenser: 'En hänvisning till en vårdkontakt pekar på en rad i tabellen Vardkontakt.',
};
const OBLIGATORISKA = {
  Vardkontakt: ['rad', 'patient', 'vardenhet', 'vardform', 'startdatum'], Diagnos: ['rad', 'patient', 'vardenhet', 'kod', 'datum'], Ordination: ['rad', 'patient', 'vardenhet', 'atc', 'startdatum', 'status'],
  Remiss: ['rad', 'franVardenhet', 'tillVardenhet', 'prioritet', 'status', 'skickadDatum'], Matvarde: ['rad', 'patient', 'vardenhet', 'typ', 'varde', 'datum'],
  Anteckning: ['rad', 'patient', 'vardenhet', 'typ', 'kategori', 'status', 'datum'], Vardtillfalle: ['rad', 'patient', 'vardenhet', 'inskrivenDatum'], Patientavgift: ['rad', 'patient', 'vardenhet', 'vardkontakt', 'datum'],
};
const KANDA_VARDFORMER = ['oppenvard', 'akut', 'slutenvard', 'hemsjukvard', 'dagkirurgi'];
export function kvalitet(data) {
  const vardkontakter = new Set((data.Vardkontakt ?? []).map(r => r.rad));
  const { MATTYPER } = require('./journal.js');
  const ut = {};
  for (const t of TYPER) {
    const avvikelser = Object.fromEntries(Object.keys(KVALITETSREGLER).map(r => [r, []]));
    for (const r of data[t] ?? []) {
      if (OBLIGATORISKA[t].some(f => r[f] == null || r[f] === '')) avvikelser.obligatoriska.push(r.rad);
      const felKod = (t === 'Diagnos' && r.kod && !/^[A-Z]\d{2}(\.\d{1,2})?$/.test(r.kod)) || (t === 'Ordination' && r.atc && !/^[A-Z]\d{2}[A-Z]{0,2}\d{0,2}$/.test(r.atc))
        || (t === 'Matvarde' && !Object.hasOwn(MATTYPER, r.typ)) || (['Vardkontakt', 'Patientavgift'].includes(t) && !KANDA_VARDFORMER.includes(r.vardform));
      if (felKod) avvikelser.koder.push(r.rad);
      const datum = Object.entries(r).filter(([f, v]) => /[dD]atum$/.test(f) && v != null);
      const fore = (a, b) => r[a] && r[b] && r[a] > r[b];
      if (datum.some(([, v]) => !DATUMFORMAT.test(v) || Number.isNaN(Date.parse(v))) || fore('startdatum', 'slutdatum') || fore('inskrivenDatum', 'utskrivenDatum') || fore('datum', 'signeradDatum')) avvikelser.datum.push(r.rad);
      if (Object.hasOwn(r, 'vardkontakt') && r.vardkontakt && !vardkontakter.has(r.vardkontakt)) avvikelser.referenser.push(r.rad);
    }
    const felaktiga = new Set(Object.values(avvikelser).flat());
    ut[t] = { kontrollerade: (data[t] ?? []).length, godkanda: (data[t] ?? []).length - felaktiga.size,
      avvikelser: Object.fromEntries(Object.entries(avvikelser).map(([r, l]) => [r, { antal: l.length, rader: l.slice(0, 20) }])) };
  }
  return ut;
}

// Skillnaden mot föregående uppdatering per tabell: nya, ändrade och borttagna rader.
function skillnad(forra, nya) {
  const ut = {};
  for (const t of TYPER) {
    const fore = new Map((forra?.[t] ?? []).map(r => [r.rad, JSON.stringify(r)]));
    const efter = new Map((nya[t] ?? []).map(r => [r.rad, JSON.stringify(r)]));
    const ny = [], andrad = [], borttagen = [];
    for (const [rad, json] of efter) { if (!fore.has(rad)) ny.push(rad); else if (fore.get(rad) !== json) andrad.push(rad); }
    for (const rad of fore.keys()) if (!efter.has(rad)) borttagen.push(rad);
    ut[t] = { ny, andrad, borttagen, forsta: !forra };
  }
  return ut;
}

// Bygger en ny uppdatering och sparar den. Bara de två senaste behålls, så att skillnaden mot föregående går att läsa.
export function uppdatera(db, nu = new Date()) {
  const forra = db.query('SELECT data FROM datauttag ORDER BY id DESC LIMIT 1').get();
  const { data, utelamnat } = bygg(db);
  const andringar = skillnad(forra ? JSON.parse(forra.data) : null, data);
  const antal = Object.fromEntries(TYPER.map(t => [t, data[t].length]));
  db.query('INSERT INTO datauttag (tid, data, antal, andringar, utelamnat) VALUES (?, ?, ?, ?, ?)')
    .run(nu.toISOString(), JSON.stringify(data), JSON.stringify(antal), JSON.stringify(andringar), JSON.stringify(utelamnat));
  db.query('DELETE FROM datauttag WHERE id NOT IN (SELECT id FROM datauttag ORDER BY id DESC LIMIT ?)').run(BEHALL);
  return senaste(db);
}

// Runda 9, r7: de sparade uppdateringarna, nyast först, utan data.
export function historik(db) {
  return db.query('SELECT id, tid, antal FROM datauttag ORDER BY id DESC').all().map(r => ({ id: r.id, tid: r.tid, antal: JSON.parse(r.antal) }));
}

export function senaste(db) {
  const r = db.query('SELECT * FROM datauttag ORDER BY id DESC LIMIT 1').get();
  if (!r) return null;
  return { id: r.id, tid: r.tid, data: JSON.parse(r.data), antal: JSON.parse(r.antal), andringar: JSON.parse(r.andringar), utelamnat: JSON.parse(r.utelamnat), nasta: nastaUppdatering(r.tid) };
}

// Uppdaterar om den schemalagda tiden har passerat. Anropas när uttaget hämtas och av serverns städning var tionde minut.
export function uppdateraOmDags(db, nu = new Date()) {
  const s = senaste(db);
  if (!s || Date.parse(s.nasta) <= nu.getTime()) return uppdatera(db, nu);
  return s;
}

// Det som drift-vyn visar om accesspunkten. Inga patientuppgifter, bara tider och antal.
export function status(db) {
  const s = senaste(db);
  if (!s) return null;
  return { senast: s.tid, nasta: s.nasta, antal: s.antal, klockan: `${String(UPPDATERAS_KLOCKAN).padStart(2, '0')}.00` };
}

// Manifestet, i samma form som när en $export i FHIR Bulk Data är klar.
export function manifest(db, base) {
  const s = uppdateraOmDags(db);
  return {
    transactionTime: s.tid, request: `${base}/api/datauttag`, requiresAccessToken: false,
    format: 'application/x-ndjson', nastaUppdatering: s.nasta, uppdaterasKlockan: status(db).klockan,
    output: TYPER.map(t => ({ type: t, url: `${base}/api/datauttag/${t}`, count: s.antal[t] })),
    andringar: Object.fromEntries(TYPER.map(t => [t, { url: `${base}/api/datauttag/${t}?andringar=1`, ny: s.andringar[t].ny.length, andrad: s.andringar[t].andrad.length, borttagen: s.andringar[t].borttagen.length, forstaUppdateringen: s.andringar[t].forsta }])),
    utelamnat: {
      sparrade: s.utelamnat.sparrade, skyddadeUppgifter: s.utelamnat.skyddadeUppgifter,
      text: 'Uppgifter från en vårdenhet som patienten har spärrat, och alla uppgifter om patienter med skyddade personuppgifter, finns inte i uttaget. Antalet utelämnade rader står här, men inte vilka.',
    },
    dokumentation: `${base}/api/datauttag/schema`, error: [],
    // Runda 9, r7: kontrollreglerna per rad och de sparade uppdateringarna.
    kvalitet: { regler: KVALITETSREGLER, tabeller: kvalitet(s.data) },
    historik: historik(db).map(h => ({ ...h, url: `${base}/api/datauttag/{typ}?sedan=${h.id}` })),
  };
}

// Raderna i en tabell som NDJSON. Med andringar: bara det som är nytt eller ändrat sedan föregående uppdatering, och de
// borttagna raderna med bara sin nyckel. Varje rad får då fältet _andring.
export function ndjson(db, typ, { andringar = false, sedan = null, nu = new Date() } = {}) {
  const s = uppdateraOmDags(db, nu);
  const rader = s.data[typ];
  // Runda 9, r7: ändringarna sedan en äldre sparad uppdatering än den föregående.
  if (sedan != null) {
    const forr = db.query('SELECT data FROM datauttag WHERE id = ?').get(Number(sedan));
    if (!forr) return null;
    const d = skillnad(JSON.parse(forr.data), s.data)[typ];
    const ny = new Set(d.ny);
    const andrad = new Set(d.andrad);
    const ut = [...rader.filter(r => ny.has(r.rad)).map(r => ({ ...r, _andring: 'ny' })), ...rader.filter(r => andrad.has(r.rad)).map(r => ({ ...r, _andring: 'andrad' })), ...d.borttagen.map(rad => ({ rad, _andring: 'borttagen' }))];
    return ut.map(r => JSON.stringify(r)).join('\n') + (ut.length ? '\n' : '');
  }
  if (!andringar) return rader.map(r => JSON.stringify(r)).join('\n') + (rader.length ? '\n' : '');
  const a = s.andringar[typ];
  const ny = new Set(a.ny);
  const andrad = new Set(a.andrad);
  const ut = [
    ...rader.filter(r => ny.has(r.rad)).map(r => ({ ...r, _andring: 'ny' })),
    ...rader.filter(r => andrad.has(r.rad)).map(r => ({ ...r, _andring: 'andrad' })),
    ...a.borttagen.map(rad => ({ rad, _andring: 'borttagen' })),
  ];
  return ut.map(r => JSON.stringify(r)).join('\n') + (ut.length ? '\n' : '');
}
