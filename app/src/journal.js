// Journalanteckningar med signering och rättelse, diagnoser, mätvärden, vårdkontakter och översikt.
import { Fel, iso, idag, giltigtDatum, MATTYPER_ENHET } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';

// Mallar per anteckningstyp. Omvårdnadsanteckningen följer VIPS-sökorden.
export const MALLAR = [
  { typ: 'Inskrivningsanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Anamnes', 'Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Daganteckning', kategori: 'lakare', sokord: ['Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Mottagningsanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Anamnes', 'Aktuellt', 'Status', 'Bedömning', 'Åtgärd'] },
  { typ: 'Omvårdnadsanteckning', kategori: 'omvardnad', sokord: ['Kommunikation', 'Andning/cirkulation', 'Nutrition', 'Elimination', 'Hud/vävnad', 'Aktivitet', 'Sömn', 'Smärta', 'Psykosocialt', 'Planering'] },
  { typ: 'Epikris', kategori: 'lakare', sokord: ['Orsak till vård', 'Förlopp', 'Läkemedelsförändringar', 'Uppföljning'] },
  { typ: 'Akutanteckning', kategori: 'lakare', sokord: ['Kontaktorsak', 'Prioritet', 'Anamnes', 'Status', 'Bedömning', 'Åtgärd'] },
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
    enhet: { id: a.enhet_id, namn: enhetsnamn(db, a.enhet_id) }, vardkontaktId: a.vardkontakt_id,
    forfattare: personalKort(db, a.forfattare_id), skapad: a.skapad, andrad: a.andrad, status: a.status,
    signerad: a.signerad_tid ? { tid: a.signerad_tid, av: personalKort(db, a.signerad_av) } : null,
    version: a.version, ersatterId: a.ersatter_id, rattelseOrsak: a.rattelse_orsak, ersattAvId: ersatt, ersatt: ersatt != null,
    kalla: a.kalla, kallaEtikett: kallaEtikett(a.kalla, a.skapad),
  };
  if (full) ut.sokord = sokord;
  else ut.sammanfattning = sokord.map(s => `${s.sokord}: ${s.text}`).join(' ').slice(0, 200);
  return ut;
}

// Anteckningar som får visas: utkast bara för författaren, rätt kategori för rollen och rätt enhet.
function synligaAnteckningar(atk, { baraAktuella = true } = {}) {
  const db = atk.db;
  let rader = db.query('SELECT * FROM anteckningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  rader = rader.filter(a => a.status === 'signerad' || a.forfattare_id === atk.personal.id);
  if (baraAktuella) rader = rader.filter(a => ersattAv(db, a.id) == null);
  return atk.filtrera(rader, a => lasHandling(a.kategori));
}

export function listaAnteckningar(atk) {
  atk.krav(kanRoll(atk.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');
  const rader = synligaAnteckningar(atk);
  return {
    anteckningar: rader.map(a => anteckningUt(atk.db, a, { full: false })),
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
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

export function skapaAnteckning(atk, { typ, vardkontaktId, sokord }) {
  const mall = MALL[typ];
  if (!mall) throw new Fel(400, 'Okänd anteckningstyp.', 'ogiltig', { falt: ['typ'] });
  atk.krav(skrivHandling(mall.kategori));
  const s = valideraSokord(sokord);
  const vk = valideraVardkontakt(atk.db, atk.patientId, vardkontaktId);
  const r = atk.db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'utkast')`).run(atk.patientId, atk.personal.enhet_id, vk, typ, mall.kategori, JSON.stringify(s), atk.personal.id, iso());
  return anteckningUt(atk.db, hamtaAnteckningRad(atk.db, r.lastInsertRowid));
}

export function andraUtkast(atk, a, { sokord, vardkontaktId }) {
  if (a.status === 'signerad') throw new Fel(400, 'En signerad anteckning kan inte ändras. Gör en rättelse i stället.', 'ogiltig');
  if (a.forfattare_id !== atk.personal.id) throw new Fel(403, 'Bara författaren kan ändra ett utkast.', 'nekad');
  atk.krav(skrivHandling(a.kategori));
  const s = sokord === undefined ? JSON.parse(a.sokord) : valideraSokord(sokord);
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
  atk.db.query("UPDATE anteckningar SET status = 'signerad', signerad_tid = ?, signerad_av = ? WHERE id = ?").run(t, atk.personal.id, a.id);
  return anteckningUt(atk.db, hamtaAnteckningRad(atk.db, a.id));
}

// Rättelse enligt HSLF-FS 2016:40 6 kap.: den signerade versionen står kvar och en ny version ersätter den.
export function ratta(atk, a, { orsak, sokord }) {
  if (a.status !== 'signerad') throw new Fel(400, 'Bara signerade anteckningar rättas. Ett utkast ändras direkt.', 'ogiltig');
  if (ersattAv(atk.db, a.id) != null) throw new Fel(400, 'Anteckningen har redan rättats. Rätta den senaste versionen.', 'ogiltig');
  if (typeof orsak !== 'string' || orsak.trim().length < 3) throw new Fel(400, 'Ange orsak till rättelsen.', 'ogiltig', { falt: ['orsak'] });
  atk.krav(skrivHandling(a.kategori), { resurs: { enhet_id: a.enhet_id } });
  if (vardenhetFor(atk.db, a.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    throw new Fel(403, 'Anteckningen kan bara rättas av den vårdenhet som skrev den.', 'nekad');
  }
  const s = valideraSokord(sokord);
  const t = iso();
  const r = atk.db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status,
    signerad_tid, signerad_av, ersatter_id, rattelse_orsak, version, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'signerad', ?, ?, ?, ?, ?, 'vardkallan')`)
    .run(a.patient_id, a.enhet_id, a.vardkontakt_id, a.typ, a.kategori, JSON.stringify(s), atk.personal.id, t, t, atk.personal.id, a.id, orsak.trim(), a.version + 1);
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
};
for (const [typ, m] of Object.entries(MATTYPER)) m.enhet = MATTYPER_ENHET[typ];

export function matvardeUt(db, m) {
  return {
    id: m.id, typ: m.typ, namn: MATTYPER[m.typ]?.namn ?? m.typ, varde: m.varde_num ?? m.varde, enhet: m.matt_enhet, tid: m.tid,
    vardenhet: { id: m.enhet_id, namn: enhetsnamn(db, m.enhet_id) }, registreradAv: personalKort(db, m.registrerad_av),
    kalla: m.kalla, kallaEtikett: kallaEtikett(m.kalla, m.tid),
  };
}

export function synligaMatvarden(atk) {
  const rader = atk.db.query('SELECT * FROM matvarden WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_matvarden');
}

export function listaMatvarden(atk) {
  atk.krav('las_matvarden');
  return { matvarden: synligaMatvarden(atk).map(m => matvardeUt(atk.db, m)), dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr } };
}

export function registreraMatvarde(atk, { typ, varde, enhet, tid }) {
  const def = MATTYPER[typ];
  if (!def) throw new Fel(400, 'Okänd typ av mätvärde.', 'ogiltig', { falt: ['typ'] });
  atk.krav('registrera_matvarde');
  if (enhet != null && enhet !== def.enhet) throw new Fel(400, `Fel enhet. ${def.namn} anges i ${def.enhet}.`, 'ogiltig', { falt: ['enhet'] });
  let text, num = null;
  if (def.format === 'blodtryck') {
    const m = typeof varde === 'string' && varde.trim().match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!m || Number(m[1]) <= Number(m[2]) || Number(m[1]) > 300) throw new Fel(400, 'Blodtryck anges som systoliskt/diastoliskt, till exempel 120/80.', 'ogiltig', { falt: ['varde'] });
    text = `${Number(m[1])}/${Number(m[2])}`;
  } else {
    num = typeof varde === 'string' ? Number(varde.replace(',', '.')) : varde;
    if (typeof num !== 'number' || !Number.isFinite(num) || num < def.min || num > def.max) {
      throw new Fel(400, `${def.namn} måste vara ett tal mellan ${def.min} och ${def.max}.`, 'ogiltig', { falt: ['varde'] });
    }
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
