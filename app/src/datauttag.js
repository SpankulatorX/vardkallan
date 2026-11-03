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
const BEHALL = 2;

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
      kon: 'kvinna eller man.',
      vardenhet: 'Vårdenhetens HSA-id (påhittat i demon).', vardenhetNamn: 'Vårdenhetens namn.',
      vardform: 'oppenvard, akut eller slutenvard.', kontaktsatt: 'besok, telefon, video, hembesok eller null i slutenvård.',
      startdatum: 'Datum i svensk tid.', slutdatum: 'Datum i svensk tid, null om kontakten pågår.',
      vardtidDagar: 'Antal vårddygn för slutenvård, annars null.', kalla: 'vardkallan, migrerad:VAS eller migrerad:Cosmic.',
    },
  },
  Diagnos: {
    beskrivning: 'En rad per registrerad diagnos.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid diagnosdatumet i femårsgrupper.', kon: 'kvinna eller man.',
      vardenhet: 'Vårdenhetens HSA-id.', kod: 'ICD-10-SE.', kodKategori: 'De tre första tecknen i koden.', typ: 'huvud eller bi.', datum: 'Diagnosdatum.',
    },
  },
  Ordination: {
    beskrivning: 'En rad per läkemedelsordination, utan dosering och ordinationsorsak.',
    falt: {
      rad: 'Radens stabila nyckel.', patient: 'Patientens pseudonym.', aldersgrupp: 'Ålder vid start i femårsgrupper.', kon: 'kvinna eller man.',
      vardenhet: 'Vårdenhetens HSA-id.', atc: 'ATC-kod.', typ: 'staende, vid_behov eller tillfallig.', startdatum: 'Startdatum.',
      status: 'aktiv eller utsatt.', utsattDatum: 'Datum för utsättning eller null.',
    },
  },
  Remiss: {
    beskrivning: 'En rad per remiss, utan patient, frågeställning och svar. Ledtiderna räknas i hela dagar.',
    falt: {
      rad: 'Radens stabila nyckel.', franVardenhet: 'Remitterande vårdenhets HSA-id.', tillVardenhet: 'Mottagande vårdenhets HSA-id.',
      prioritet: 'akut, skyndsam eller normal.', status: 'skickad, mottagen, bedomd, besvarad eller svar_kvitterat.', beslut: 'accepterad, avvisad eller null.',
      skickadDatum: 'Datum.', dagarTillMottagen: 'Dagar från skickad till mottagningskvittens.', dagarTillSvar: 'Dagar från skickad till svar.',
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
  return { data, utelamnat };
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
  };
}

// Raderna i en tabell som NDJSON. Med andringar: bara det som är nytt eller ändrat sedan föregående uppdatering, och de
// borttagna raderna med bara sin nyckel. Varje rad får då fältet _andring.
export function ndjson(db, typ, { andringar = false } = {}) {
  const s = uppdateraOmDags(db);
  const rader = s.data[typ];
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
