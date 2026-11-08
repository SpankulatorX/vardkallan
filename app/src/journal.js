// Journalanteckningar med signering och rättelse, diagnoser, mätvärden, vårdkontakter och översikt.
import { Fel, iso, idag, giltigtDatum, MATTYPER_ENHET } from './db.js';
// Runda 9, r2: klassen för värden från utrustning och patientens egna mätningar.
import { klassFor } from './mt-klass.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
// Skalor och poängmodeller (runda 6, r1): systemet räknar GCS och skriver texten för de kodade mätvärdena.
import { ACVPU, tolkaGcs, gcsText, nrsText } from './skalor.js';
// Runda 7, r4: undantag från visning (undantag.js) och enhetens namn när anteckningen skrevs (omorganisation.js).
import { filtreraVisning, undantagnaUt, provare as undantagProvare } from './undantag.js';
import { namnVid } from './omorganisation.js';
// Runda 8, r5: mallen för tobaks- och nikotinvanor med fasta svarsalternativ (tobak.js).
import * as tobak from './tobak.js';
// Runda 9, r7: mallen för levnadsvanorna alkohol, fysisk aktivitet och matvanor (levnadsvanor.js).
import * as levnadsvanor from './levnadsvanor.js';
// Runda 9, r7: signaturen med det simulerade SITHS-kortet (anteckningssignatur.js).
import * as signering from './anteckningssignatur.js';

// Mallar per anteckningstyp. Omvårdnadsanteckningen följer VIPS-sökorden.
export const MALLAR = [
  { typ: 'Inskrivningsanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Anamnes', 'Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Daganteckning', kategori: 'lakare', sokord: ['Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Mottagningsanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Anamnes', 'Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Omvårdnadsanteckning', kategori: 'omvardnad', sokord: ['Kommunikation', 'Andning/cirkulation', 'Nutrition', 'Elimination', 'Hud/vävnad', 'Aktivitet', 'Sömn', 'Smärta', 'Psykosocialt', 'Planering'] },
  { typ: 'Epikris', kategori: 'lakare', sokord: ['Orsak till vård', 'Förlopp', 'Läkemedelsförändringar', 'Uppföljning'] },
  { typ: 'Akutanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Prioritet', 'Anamnes', 'Status', 'Bedömning', 'Åtgärd'] },
  // Runda 8, r5: en strukturerad mall. Sökorden skriver systemet ur svaren (tobak.js), så de går inte att ändra.
  tobak.MALL,
  // Runda 9, r7: en strukturerad mall på samma sätt som tobaksvanorna.
  levnadsvanor.MALL,
];
const MALL = Object.fromEntries(MALLAR.map(m => [m.typ, m]));

export const lasHandling = (kategori) => (kategori === 'omvardnad' ? 'las_omvardnad' : 'las_journal');
export const skrivHandling = (kategori) => (kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal');

export function kallaEtikett(kalla, tid) {
  if (!kalla?.startsWith('migrerad:')) return null;
  return `Migrerad från ${kalla.slice(9)} ${String(tid ?? '').slice(0, 4)}`.trim();
}

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personalKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, yrke, titel FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, yrke: p.yrke, titel: p.titel } : null;
};

function ersattAv(db, id) {
  return db.query('SELECT id FROM anteckningar WHERE ersatter_id = ?').get(id)?.id ?? null;
}

export function anteckningUt(db, a, { full = true } = {}) {
  const sokord = JSON.parse(a.sokord);
  const ersatt = ersattAv(db, a.id);
  const ut = {
    id: a.id, patientId: a.patient_id, typ: a.typ, kategori: a.kategori,
    enhet: { id: a.enhet_id, namn: namnVid(db, a.enhet_id, a.skapad) }, vardkontaktId: a.vardkontakt_id,
    forfattare: personalKort(db, a.forfattare_id), skapad: a.skapad, andrad: a.andrad, status: a.status,
    signerad: a.signerad_tid ? { tid: a.signerad_tid, av: personalKort(db, a.signerad_av) } : null,
    version: a.version, ersatterId: a.ersatter_id, rattelseOrsak: a.rattelse_orsak, ersattAvId: ersatt, ersatt: ersatt != null,
    kalla: a.kalla, kallaEtikett: kallaEtikett(a.kalla, a.skapad),
  };
  if (full) ut.sokord = sokord;
  // Runda 8, r5: svaren i mallen för tobaksvanor lämnas ut tillsammans med anteckningen.
  if (full && a.typ === tobak.TYP) ut.tobak = tobak.ut(db, a.id);
  // Runda 9, r7.
  if (full && a.typ === levnadsvanor.TYP) ut.levnadsvanor = levnadsvanor.ut(db, a.id);
  if (!full) ut.sammanfattning = sokord.map(s => `${s.sokord}: ${s.text}`).join(' ').slice(0, 200);
  return ut;
}

// Anteckningar som får visas: utkast bara för författaren, rätt kategori för rollen och rätt enhet.
function synligaAnteckningar(atk, { baraAktuella = true } = {}) {
  const db = atk.db;
  let rader = db.query('SELECT * FROM anteckningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  rader = rader.filter(a => a.status === 'signerad' || a.forfattare_id === atk.personal.id);
  if (baraAktuella) rader = rader.filter(a => ersattAv(db, a.id) == null);
  // Runda 7, r4: undantagen prövas efter behörighetsmotorn, så att en spärrad anteckning varken visas eller räknas.
  return filtreraVisning(atk, atk.filtrera(rader, a => lasHandling(a.kategori)), 'anteckning');
}

export function listaAnteckningar(atk) {
  atk.krav(kanRoll(atk.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');
  const rader = synligaAnteckningar(atk);
  return {
    anteckningar: rader.map(a => anteckningUt(atk.db, a, { full: false })),
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr, undantagna: undantagnaUt(atk) },
  };
}

// Hela versionskedjan för en anteckning. Äldre versioner visas överstrukna men läsbara.
function versionskedja(db, id) {
  let rot = db.query('SELECT * FROM anteckningar WHERE id = ?').get(id);
  while (rot?.ersatter_id) rot = db.query('SELECT * FROM anteckningar WHERE id = ?').get(rot.ersatter_id);
  const kedja = [];
  let a = rot;
  while (a) { kedja.push(a); a = db.query('SELECT * FROM anteckningar WHERE ersatter_id = ?').get(a.id); }
  return kedja;
}

export function hamtaAnteckningRad(db, id) {
  const a = db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(id));
  if (!a) throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
  return a;
}

export function hamtaAnteckning(atk, a) {
  if (a.status !== 'signerad' && a.forfattare_id !== atk.personal.id) throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
  atk.krav(lasHandling(a.kategori), { resurs: { enhet_id: a.enhet_id }, beskrivning: `anteckning:${a.id}` });
  // Runda 7, r4: en anteckning som är undantagen från visning visas inte heller när den öppnas direkt.
  const u = undantagProvare(atk.db, 'visning')(a, 'anteckning');
  if (u) throw new Fel(404, `Anteckningen visas inte. Systemförvaltningen har undantagit den från visning från ${u.gallerFran}: ${u.motivering}`, 'saknas');
  const ut = anteckningUt(atk.db, a);
  ut.versioner = versionskedja(atk.db, a.id).map(v => anteckningUt(atk.db, v));
  return ut;
}

function valideraSokord(sokord) {
  if (!Array.isArray(sokord) || sokord.length === 0 || sokord.length > 30) throw new Fel(400, 'Anteckningen behöver minst ett sökord.', 'ogiltig', { falt: ['sokord'] });
  return sokord.map((s, i) => {
    const sk = typeof s?.sokord === 'string' ? s.sokord.trim() : '';
    const text = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!sk || sk.length > 80) throw new Fel(400, `Sökord ${i + 1} saknar namn.`, 'ogiltig', { falt: ['sokord'] });
    if (text.length > 8000) throw new Fel(400, `Texten under ${sk} är för lång.`, 'ogiltig', { falt: ['sokord'] });
    return { sokord: sk, text };
  });
}

function valideraVardkontakt(db, patientId, vardkontaktId) {
  if (vardkontaktId == null) return null;
  const vk = db.query('SELECT id FROM vardkontakter WHERE id = ? AND patient_id = ?').get(Number(vardkontaktId), patientId);
  if (!vk) throw new Fel(400, 'Vårdkontakten hör inte till patienten.', 'ogiltig', { falt: ['vardkontaktId'] });
  return vk.id;
}

export function skapaAnteckning(atk, { typ, vardkontaktId, sokord, tobak: tobakSvar, levnadsvanor: lvSvar }) {
  const mall = MALL[typ];
  if (!mall) throw new Fel(400, 'Okänd anteckningstyp.', 'ogiltig', { falt: ['typ'] });
  atk.krav(skrivHandling(mall.kategori));
  // Runda 8, r5: i mallen för tobaksvanor skriver systemet sökorden ur svaren.
  const t = typ === tobak.TYP ? tobak.forbered(atk, tobakSvar) : null;
  // Runda 9, r7: i mallen för levnadsvanor skriver systemet sökorden ur svaren.
  const lv = typ === levnadsvanor.TYP ? levnadsvanor.forbered(atk, lvSvar) : null;
  const s = t ? t.sokord : lv ? lv.sokord : valideraSokord(sokord);
  const vk = valideraVardkontakt(atk.db, atk.patientId, vardkontaktId);
  const r = atk.db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'utkast')`).run(atk.patientId, atk.personal.enhet_id, vk, typ, mall.kategori, JSON.stringify(s), atk.personal.id, iso());
  if (t) tobak.spara(atk.db, Number(r.lastInsertRowid), t);
  if (lv) levnadsvanor.spara(atk.db, Number(r.lastInsertRowid), lv);
  return anteckningUt(atk.db, hamtaAnteckningRad(atk.db, r.lastInsertRowid));
}

export function andraUtkast(atk, a, { sokord, vardkontaktId, tobak: tobakSvar, levnadsvanor: lvSvar }) {
  if (a.status === 'signerad') throw new Fel(400, 'En signerad anteckning kan inte ändras. Gör en rättelse i stället.', 'ogiltig');
  if (a.forfattare_id !== atk.personal.id) throw new Fel(403, 'Bara författaren kan ändra ett utkast.', 'nekad');
  atk.krav(skrivHandling(a.kategori));
  // Runda 8, r5: ett utkast om tobaksvanor ändras med svaren, aldrig med sökorden.
  const t = a.typ === tobak.TYP && tobakSvar !== undefined ? tobak.forbered(atk, tobakSvar) : null;
  if (a.typ === tobak.TYP && sokord !== undefined) throw new Fel(400, 'Texten i en anteckning om tobaksvanor skrivs av systemet ur svaren. Ändra svaren i stället.', 'ogiltig', { falt: ['sokord'] });
  if (t) tobak.spara(atk.db, a.id, t);
  // Runda 9, r7: ett utkast om levnadsvanor ändras med svaren, aldrig med sökorden.
  const lv = a.typ === levnadsvanor.TYP && lvSvar !== undefined ? levnadsvanor.forbered(atk, lvSvar) : null;
  if (a.typ === levnadsvanor.TYP && sokord !== undefined) throw new Fel(400, 'Texten i en anteckning om levnadsvanor skrivs av systemet ur svaren. Ändra svaren i stället.', 'ogiltig', { falt: ['sokord'] });
  if (lv) levnadsvanor.spara(atk.db, a.id, lv);
  const s = t ? t.sokord : lv ? lv.sokord : sokord === undefined ? JSON.parse(a.sokord) : valideraSokord(sokord);
  const vk = vardkontaktId === undefined ? a.vardkontakt_id : valideraVardkontakt(atk.db, atk.patientId, vardkontaktId);
  atk.db.query('UPDATE anteckningar SET sokord = ?, vardkontakt_id = ?, andrad = ? WHERE id = ?').run(JSON.stringify(s), vk, iso(), a.id);
  return anteckningUt(atk.db, hamtaAnteckningRad(atk.db, a.id));
}

export function signera(atk, a) {
  if (a.status === 'signerad') throw new Fel(400, 'Anteckningen är redan signerad.', 'ogiltig');
  if (a.forfattare_id !== atk.personal.id) throw new Fel(403, 'Bara författaren kan signera anteckningen.', 'nekad');
  atk.krav(skrivHandling(a.kategori));
  if (!JSON.parse(a.sokord).some(s => s.text)) throw new Fel(400, 'Anteckningen är tom.', 'ogiltig', { falt: ['sokord'] });
  const t = iso();
  atk.db.transaction(() => {
    atk.db.query("UPDATE anteckningar SET status = 'signerad', signerad_tid = ?, signerad_av = ? WHERE id = ?").run(t, atk.personal.id, a.id);
    // Runda 8, r5: hölls samtalet om tobak vid besöket registreras åtgärden med KVÅ-koden.
    tobak.vidSignering(atk, a, t);
    // Runda 9, r7: samtalen om levnadsvanor registreras som åtgärder med KVÅ-koden.
    levnadsvanor.vidSignering(atk, a, t);
    // Runda 9, r7: signaturen över innehållet.
    signering.vidSignering(atk.db, a.id);
  })();
  return anteckningUt(atk.db, hamtaAnteckningRad(atk.db, a.id));
}

// Rättelse enligt HSLF-FS 2016:40 6 kap.: den signerade versionen står kvar och en ny version ersätter den.
export function ratta(atk, a, { orsak, sokord, tobak: tobakSvar, levnadsvanor: lvSvar }) {
  if (a.status !== 'signerad') throw new Fel(400, 'Bara signerade anteckningar rättas. Ett utkast ändras direkt.', 'ogiltig');
  if (ersattAv(atk.db, a.id) != null) throw new Fel(400, 'Anteckningen har redan rättats. Rätta den senaste versionen.', 'ogiltig');
  if (typeof orsak !== 'string' || orsak.trim().length < 3) throw new Fel(400, 'Ange orsak till rättelsen.', 'ogiltig', { falt: ['orsak'] });
  atk.krav(skrivHandling(a.kategori), { resurs: { enhet_id: a.enhet_id } });
  if (vardenhetFor(atk.db, a.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    throw new Fel(403, 'Anteckningen kan bara rättas av den vårdenhet som skrev den.', 'nekad');
  }
  // Runda 8, r5: en rättelse av tobaksvanorna görs med svaren, och den nya versionen får egna svar.
  const tb = a.typ === tobak.TYP ? tobak.forbered(atk, tobakSvar) : null;
  // Runda 9, r7.
  const lv = a.typ === levnadsvanor.TYP ? levnadsvanor.forbered(atk, lvSvar) : null;
  const s = tb ? tb.sokord : lv ? lv.sokord : valideraSokord(sokord);
  const t = iso();
  const r = atk.db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status,
    signerad_tid, signerad_av, ersatter_id, rattelse_orsak, version, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'signerad', ?, ?, ?, ?, ?, 'vardkallan')`)
    .run(a.patient_id, a.enhet_id, a.vardkontakt_id, a.typ, a.kategori, JSON.stringify(s), atk.personal.id, t, t, atk.personal.id, a.id, orsak.trim(), a.version + 1);
  if (tb) tobak.spara(atk.db, Number(r.lastInsertRowid), tb);
  if (lv) levnadsvanor.spara(atk.db, Number(r.lastInsertRowid), lv);
  // Runda 9, r7: rättelsen signeras med en egen signatur.
  signering.vidSignering(atk.db, Number(r.lastInsertRowid));
  const ny = hamtaAnteckningRad(atk.db, r.lastInsertRowid);
  const ut = anteckningUt(atk.db, ny);
  ut.versioner = versionskedja(atk.db, ny.id).map(v => anteckningUt(atk.db, v));
  return ut;
}

export function osigneradeFor(db, personalId) {
  return db.query("SELECT * FROM anteckningar WHERE forfattare_id = ? AND status = 'utkast' ORDER BY skapad DESC").all(personalId)
    .map(a => anteckningUt(db, a, { full: false }));
}
// Mätvärden. Koderna för FHIR (NPU för labb, LOINC för vitalparametrar) står i kodverk.js.
// Mätvärden. LOINC-koder används i FHIR.
export const MATTYPER = {
  blodtryck: { namn: 'Blodtryck', format: 'blodtryck' },
  puls: { namn: 'Puls', min: 20, max: 250 },
  temp: { namn: 'Temperatur', min: 30, max: 44 },
  saturation: { namn: 'Syremättnad', min: 50, max: 100 },
  andningsfrekvens: { namn: 'Andningsfrekvens', min: 4, max: 70 },
  vikt: { namn: 'Vikt', min: 0.5, max: 400 },
  langd: { namn: 'Längd', min: 30, max: 250 },
  crp: { namn: 'CRP', min: 0, max: 700 },
  egfr: { namn: 'eGFR', min: 0, max: 200 },
  kreatinin: { namn: 'Kreatinin', min: 5, max: 3000 },
  hba1c: { namn: 'HbA1c', min: 10, max: 200 },
  inr: { namn: 'PK (INR)', min: 0.5, max: 10 },
  ntprobnp: { namn: 'NT-proBNP', min: 0, max: 100000 },
  hb: { namn: 'Hemoglobin', min: 20, max: 250 },
  glukos: { namn: 'Glukos', min: 0, max: 60 },
  kalium: { namn: 'Kalium', min: 1, max: 10 },
  pef: { namn: 'PEF', min: 20, max: 1000 },
  troponin: { namn: 'Troponin T', min: 0, max: 100000 },
  tsh: { namn: 'TSH', min: 0, max: 200 },
  // Runda 6, r1: medvetandegrad, syrgas, smärta och GCS (Sussa 3.1.3.5 och 3.1.3.9). Medvetandegraden anges med ACVPU,
  // syrgas i liter per minut (0 är luft), smärta med NRS 0 till 10 och GCS som E, V och M, där systemet räknar summan.
  medvetande: { namn: 'Medvetandegrad', format: 'acvpu' },
  syrgas: { namn: 'Syrgas', min: 0, max: 15 },
  smarta: { namn: 'Smärta (NRS)', min: 0, max: 10, heltal: true },
  gcs: { namn: 'GCS', format: 'gcs' },
  // Runda 7, r6: huvudomfång i barnhälsovården (Sussa 4.1).
  huvudomfang: { namn: 'Huvudomfång', min: 20, max: 70 },
  // Runda 8, r1: svaren från det simulerade laboratoriet och SR som intern analys på avdelningen (labb.js).
  lpk: { namn: 'Leukocyter (LPK)', min: 0, max: 500 },
  tpk: { namn: 'Trombocyter (TPK)', min: 0, max: 3000 },
  natrium: { namn: 'Natrium', min: 90, max: 200 },
  kobalamin: { namn: 'Kobalamin (B12)', min: 0, max: 10000 },
  folat: { namn: 'Folat', min: 0, max: 200 },
  sr: { namn: 'SR', min: 0, max: 150, heltal: true },
};
for (const [typ, m] of Object.entries(MATTYPER)) m.enhet = MATTYPER_ENHET[typ];

export function matvardeUt(db, m) {
  const ut = {
    id: m.id, typ: m.typ, namn: MATTYPER[m.typ]?.namn ?? m.typ, varde: m.varde_num ?? m.varde, enhet: m.matt_enhet, tid: m.tid,
    vardenhet: { id: m.enhet_id, namn: enhetsnamn(db, m.enhet_id) }, registreradAv: personalKort(db, m.registrerad_av),
    kalla: m.kalla, kallaEtikett: kallaEtikett(m.kalla, m.tid),
  };
  // Runda 6, r1: texten som systemet skriver för de kodade mätvärdena och skalorna.
  const b = beskrivning(m);
  if (b) ut.beskrivning = b;
  // Runda 8, r1: ett svar från laboratoriet visar beställningen och vem som beställde (labb.js).
  const lb = labbKoppling(db, m.id);
  if (lb) ut.bestallning = lb;
  // Runda 9, r2: ett värde från medicinteknisk utrustning eller patientens egen mätning har sin klass (mt-klass.js).
  const kl = klassFor(db, m);
  if (kl) ut.klass = kl;
  return ut;
}
function labbKoppling(db, id) {
  try {
    const r = db.query(`SELECT b.id, b.nummer, p.namn FROM labb_svar s JOIN labb_analyser a ON a.id = s.analys_rad_id JOIN labb_bestallningar b ON b.id = a.bestallning_id
      LEFT JOIN personal p ON p.id = b.ansvarig_id WHERE s.matvarde_id = ?`).get(id);
    return r ? { id: r.id, nummer: r.nummer, bestalldAv: r.namn } : null;
  } catch { return null; }
}

// Text för medvetandegrad, syrgas, smärta och GCS, så att ingen behöver tolka koden.
export function beskrivning(m) {
  if (m.typ === 'medvetande') return ACVPU[m.varde] ? `${m.varde}, ${ACVPU[m.varde].text.toLowerCase()}` : null;
  if (m.typ === 'syrgas') return Number(m.varde_num ?? m.varde) > 0 ? `Syrgas ${String(m.varde_num ?? m.varde).replace('.', ',')} L/min` : 'Luft, ingen syrgas';
  if (m.typ === 'smarta') return nrsText(Number(m.varde_num ?? m.varde));
  if (m.typ === 'gcs') return gcsText(tolkaGcs(m.varde));
  return null;
}

export function synligaMatvarden(atk) {
  const rader = atk.db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId);
  // Runda 7, r4: undantag från visning, efter behörighetsmotorn.
  return filtreraVisning(atk, atk.filtrera(rader, 'las_matvarden'), 'matvarde');
}

export function listaMatvarden(atk) {
  atk.krav('las_matvarden');
  return { matvarden: synligaMatvarden(atk).map(m => matvardeUt(atk.db, m)), dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr, undantagna: undantagnaUt(atk) } };
}

export function registreraMatvarde(atk, { typ, varde, enhet, tid }) {
  const def = MATTYPER[typ];
  if (!def) throw new Fel(400, 'Okänd typ av mätvärde.', 'ogiltig', { falt: ['typ'] });
  atk.krav('registrera_matvarde');
  if (enhet != null && enhet !== def.enhet) throw new Fel(400, `Fel enhet. ${def.namn} anges i ${def.enhet}.`, 'ogiltig', { falt: ['enhet'] });
  let text, num = null;
  if (def.format === 'acvpu') {
    const k = typeof varde === 'string' ? varde.trim().toUpperCase() : '';
    if (!ACVPU[k]) throw new Fel(400, 'Medvetandegraden anges med A, C, V, P eller U: vaken, nytillkommen förvirring, reagerar på tilltal, reagerar på smärta eller reagerar inte.', 'ogiltig', { falt: ['varde'] });
    text = k;
  } else if (def.format === 'gcs') {
    const g = tolkaGcs(typeof varde === 'object' && varde ? `E${varde.e}V${varde.v}M${varde.m}` : varde);
    if (!g) throw new Fel(400, 'GCS anges med ögonöppning 1 till 4, verbalt svar 1 till 5 och motoriskt svar 1 till 6, till exempel E4V5M6.', 'ogiltig', { falt: ['varde'] });
    text = `E${g.e}V${g.v}M${g.m}`;
    num = g.summa;
  } else if (def.format === 'blodtryck') {
    const m = typeof varde === 'string' && varde.trim().match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!m || Number(m[1]) <= Number(m[2]) || Number(m[1]) > 300) throw new Fel(400, 'Blodtryck anges som systoliskt/diastoliskt, till exempel 120/80.', 'ogiltig', { falt: ['varde'] });
    text = `${Number(m[1])}/${Number(m[2])}`;
  } else {
    num = typeof varde === 'string' ? Number(varde.replace(',', '.')) : varde;
    if (typeof num !== 'number' || !Number.isFinite(num) || num < def.min || num > def.max) {
      throw new Fel(400, `${def.namn} måste vara ett tal mellan ${def.min} och ${def.max}.`, 'ogiltig', { falt: ['varde'] });
    }
    if (def.heltal && !Number.isInteger(num)) throw new Fel(400, `${def.namn} anges som ett heltal mellan ${def.min} och ${def.max}.`, 'ogiltig', { falt: ['varde'] });
    text = String(num);
  }
  let t = iso();
  if (tid != null) {
    const ms = Date.parse(tid);
    if (Number.isNaN(ms) || ms > Date.now() + 5 * 60_000 || ms < Date.now() - 30 * 86400_000) {
      throw new Fel(400, 'Tiden måste vara en giltig tidpunkt under de senaste 30 dagarna.', 'ogiltig', { falt: ['tid'] });
    }
    t = new Date(ms).toISOString();
  }
  const r = atk.db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, typ, text, num, def.enhet, t, atk.personal.id);
  return matvardeUt(atk.db, atk.db.query('SELECT * FROM matvarden WHERE id = ?').get(r.lastInsertRowid));
}

export function diagnosUt(db, d) {
  return {
    id: d.id, kod: d.kod, text: d.text, typ: d.typ, datum: d.datum, vardkontaktId: d.vardkontakt_id,
    vardenhet: { id: d.enhet_id, namn: enhetsnamn(db, d.enhet_id) }, kalla: d.kalla, kallaEtikett: kallaEtikett(d.kalla, d.datum),
  };
}

export function synligaDiagnoser(atk) {
  const rader = atk.db.query('SELECT * FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_diagnoser');
}

export function vardkontaktUt(db, v) {
  return {
    id: v.id, typ: v.typ, start: v.start, slut: v.slut, plats: v.plats, orsak: v.orsak, pagaende: v.slut == null,
    vardenhet: { id: v.enhet_id, namn: enhetsnamn(db, v.enhet_id) }, kalla: v.kalla, kallaEtikett: kallaEtikett(v.kalla, v.start),
  };
}

export function synligaVardkontakter(atk) {
  const rader = atk.db.query('SELECT * FROM vardkontakter WHERE patient_id = ? ORDER BY start DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_admin');
}

export function overkanslighetUt(db, o) {
  return {
    id: o.id, amne: o.amne, atc: o.atc, reaktion: o.reaktion, allvarlighet: o.allvarlighet, datum: o.datum,
    vardenhet: { id: o.enhet_id, namn: enhetsnamn(db, o.enhet_id) }, kalla: o.kalla, kallaEtikett: kallaEtikett(o.kalla, o.datum),
  };
}

export function synligOverkanslighet(atk) {
  if (!kanRoll(atk.personal, 'las_oversikt')) return null;
  const rader = atk.db.query('SELECT * FROM overkanslighet WHERE patient_id = ? ORDER BY datum DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_oversikt', { gemensam: true }).map(o => overkanslighetUt(atk.db, o));
}

// Senaste värdet per typ.
export function senastePerTyp(matvarden) {
  const sett = new Map();
  for (const m of matvarden) if (!sett.has(m.typ)) sett.set(m.typ, m);
  return [...sett.values()];
}

export { idag, giltigtDatum };
