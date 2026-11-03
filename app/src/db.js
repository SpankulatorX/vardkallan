// Schema, triggrar, seedad mall och sandlådor. Varje besökare får en egen kopia av mallen i minnet.
import { Database } from 'bun:sqlite';
import { ENHETER } from './seed/enheter.js';
import { PERSONAL } from './seed/personal.js';
import { KATALOG } from './seed/lakemedel-katalog.js';
import { PATIENTER, REMISSER, VANTRUM, LOGG, MIGRERING_AVVIKELSER } from './seed/patienter.js';
import { VARDNADSHAVARE, VISNINGSREGLER } from './seed/invanare.js';
import { loggaRad } from './logg.js';
import { MATKOD } from './kodverk.js';
import { SCHEMA_UPPMARKSAMHET, seedaUppmarksamhet } from './seed/uppmarksamhet.js';
import { IDENTITETSPATIENTER } from './seed/identiteter.js';
import { sakraIdentitetsschema, seedIdentitet } from './identitet.js';
import { utokaSchema, knytHistorik } from './vardstruktur.js';
import { SANGBYTEN, HALSOARENDEN } from './seed/vardstruktur.js';

// Fel som API:t svarar med. kod: nekad | saknas | ogiltig | kraver_val | kraver_samtycke
export class Fel extends Error {
  constructor(status, text, kod, extra = {}) {
    super(text);
    this.status = status;
    this.kod = kod ?? (status === 404 ? 'saknas' : status === 403 ? 'nekad' : 'ogiltig');
    this.extra = extra;
  }
}

const SCHEMA = `
CREATE TABLE enheter (
  id TEXT PRIMARY KEY, hsa_id TEXT NOT NULL, namn TEXT NOT NULL, kortnamn TEXT,
  typ TEXT NOT NULL, forald_id TEXT
);
CREATE TABLE personal (
  id TEXT PRIMARY KEY, namn TEXT NOT NULL, yrke TEXT NOT NULL, titel TEXT, enhet_id TEXT NOT NULL,
  hsa_id TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0, aktiv INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE patienter (
  id TEXT PRIMARY KEY, personnummer TEXT NOT NULL UNIQUE, fornamn TEXT NOT NULL, efternamn TEXT NOT NULL,
  kon TEXT NOT NULL, fodd TEXT NOT NULL, adress TEXT, postnr TEXT, ort TEXT, telefon TEXT,
  kontaktperson TEXT, skyddad INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE listningar (patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, PRIMARY KEY (patient_id, enhet_id));
CREATE TABLE sparrar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, registrerad TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE vardkontakter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL,
  start TEXT NOT NULL, slut TEXT, plats TEXT, orsak TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE anteckningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER,
  typ TEXT NOT NULL, kategori TEXT NOT NULL, sokord TEXT NOT NULL, forfattare_id TEXT NOT NULL,
  skapad TEXT NOT NULL, andrad TEXT, status TEXT NOT NULL, signerad_tid TEXT, signerad_av TEXT,
  ersatter_id INTEGER, rattelse_orsak TEXT, version INTEGER NOT NULL DEFAULT 1,
  kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE diagnoser (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER,
  kod TEXT NOT NULL, text TEXT NOT NULL, typ TEXT NOT NULL, datum TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE matvarden (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL,
  varde TEXT NOT NULL, varde_num REAL, matt_enhet TEXT, tid TEXT NOT NULL, registrerad_av TEXT,
  kalla TEXT NOT NULL DEFAULT 'vardkallan', vidimerad TEXT
);
CREATE TABLE overkanslighet (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, amne TEXT NOT NULL, atc TEXT,
  reaktion TEXT, allvarlighet TEXT NOT NULL, datum TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE katalog (
  id TEXT PRIMARY KEY, namn TEXT NOT NULL, substans TEXT NOT NULL, styrka TEXT, form TEXT, atc TEXT NOT NULL, npl TEXT
);
CREATE TABLE ordinationer (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lakemedel_id TEXT NOT NULL,
  dosering TEXT NOT NULL, dos REAL, dos_enhet TEXT, tider TEXT, vid_behov INTEGER NOT NULL DEFAULT 0,
  typ TEXT NOT NULL, orsak TEXT NOT NULL, uppfoljning TEXT NOT NULL, start TEXT NOT NULL, slut TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv', utsatt_tid TEXT, utsatt_av TEXT, utsatt_orsak TEXT,
  ordinerad_av TEXT NOT NULL, skapad TEXT NOT NULL, nll_status TEXT NOT NULL DEFAULT 'kvitterad',
  kvitterade_varningar TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (length(trim(orsak)) > 0), CHECK (length(uppfoljning) = 10)
);
CREATE TABLE ordination_historik (
  id INTEGER PRIMARY KEY, ordination_id INTEGER NOT NULL, tid TEXT NOT NULL, personal_id TEXT,
  handelse TEXT NOT NULL, detalj TEXT
);
CREATE TABLE nll_meddelanden (
  id INTEGER PRIMARY KEY, ordination_id INTEGER NOT NULL, typ TEXT NOT NULL, skickad TEXT NOT NULL,
  status TEXT NOT NULL, svar_tid TEXT, kvittens TEXT, nll_registrerad INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE remisser (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, fran_enhet_id TEXT NOT NULL, till_enhet_id TEXT NOT NULL,
  avsandare_id TEXT NOT NULL, fragestallning TEXT NOT NULL, anamnes TEXT, prioritet TEXT NOT NULL,
  svar_senast TEXT NOT NULL, status TEXT NOT NULL, skickad_tid TEXT NOT NULL,
  mottagen_tid TEXT, mottagen_av TEXT, bedomd_tid TEXT, bedomd_av TEXT, beslut TEXT, motivering TEXT,
  besvarad_tid TEXT, besvarad_av TEXT, svar TEXT, svar_kvitterat_tid TEXT, svar_kvitterat_av TEXT,
  kalla TEXT NOT NULL DEFAULT 'vardkallan'
);
CREATE TABLE vantrum (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, konummer TEXT NOT NULL,
  ankomst TEXT NOT NULL, prioritet TEXT NOT NULL, orsak TEXT, status TEXT NOT NULL DEFAULT 'vantar'
);
CREATE TABLE migrering (
  datatyp TEXT NOT NULL, kalla TEXT NOT NULL, antal_kalla INTEGER NOT NULL, antal_overforda INTEGER NOT NULL,
  antal_verifierade INTEGER NOT NULL, PRIMARY KEY (datatyp, kalla)
);
CREATE TABLE migrering_avvikelser (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, datatyp TEXT NOT NULL, kalla TEXT NOT NULL,
  beskrivning TEXT NOT NULL, atgard TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'oppen'
);
CREATE TABLE installningar (nyckel TEXT PRIMARY KEY, varde TEXT);
CREATE TABLE atkomstlogg (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, personal_id TEXT, enhet_id TEXT, patient_id TEXT,
  handling TEXT NOT NULL, resurs TEXT, grund TEXT NOT NULL, syfte TEXT, resultat TEXT NOT NULL,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL, invanare_id TEXT
);
CREATE INDEX ix_logg_patient ON atkomstlogg (patient_id);
CREATE INDEX ix_ant_patient ON anteckningar (patient_id);
CREATE INDEX ix_ord_patient ON ordinationer (patient_id);
CREATE INDEX ix_mv_patient ON matvarden (patient_id);

-- Loggen går inte att ändra eller radera.
CREATE TRIGGER atkomstlogg_ingen_andring BEFORE UPDATE ON atkomstlogg
  BEGIN SELECT RAISE(ABORT, 'Åtkomstloggen kan inte ändras'); END;
CREATE TRIGGER atkomstlogg_ingen_radering BEFORE DELETE ON atkomstlogg
  BEGIN SELECT RAISE(ABORT, 'Åtkomstloggen kan inte raderas'); END;

-- En signerad anteckning ändras aldrig och raderas aldrig. Rättelse skapar en ny version.
CREATE TRIGGER anteckning_signerad_andras_ej BEFORE UPDATE ON anteckningar WHEN OLD.status = 'signerad'
  BEGIN SELECT RAISE(ABORT, 'En signerad anteckning kan inte ändras'); END;
CREATE TRIGGER anteckning_signerad_raderas_ej BEFORE DELETE ON anteckningar WHEN OLD.status = 'signerad'
  BEGIN SELECT RAISE(ABORT, 'En signerad anteckning kan inte raderas'); END;

-- Ordinationer och remisser raderas aldrig, de sätts ut eller avslutas.
CREATE TRIGGER ordination_raderas_ej BEFORE DELETE ON ordinationer
  BEGIN SELECT RAISE(ABORT, 'Ordinationer raderas inte, de sätts ut'); END;
CREATE TRIGGER remiss_raderas_ej BEFORE DELETE ON remisser
  BEGIN SELECT RAISE(ABORT, 'Remisser raderas inte'); END;
`;

// Min journal: invånare som loggar in med simulerad e-legitimation, vårdnadshavare, vårdgivarens visningsregler och
// invånarnas begäranden till vården. IF NOT EXISTS, så att samma schema också kan läggas till i en äldre sandlåda.
const SCHEMA_INVANARE = `
CREATE TABLE IF NOT EXISTS invanare (
  id TEXT PRIMARY KEY, personnummer TEXT NOT NULL UNIQUE, fornamn TEXT NOT NULL, efternamn TEXT NOT NULL,
  fodd TEXT NOT NULL, patient_id TEXT
);
CREATE TABLE IF NOT EXISTS vardnadshavare (invanare_id TEXT NOT NULL, barn_id TEXT NOT NULL, PRIMARY KEY (invanare_id, barn_id));
CREATE TABLE IF NOT EXISTS visningsregler (
  id INTEGER PRIMARY KEY, enhet_id TEXT, anteckningstyp TEXT, visning TEXT NOT NULL, dagar INTEGER, motivering TEXT NOT NULL,
  CHECK (visning IN ('direkt', 'fordrojd', 'visas_inte')), CHECK (visning <> 'fordrojd' OR dagar > 0)
);
CREATE TABLE IF NOT EXISTS begaran (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, invanare_id TEXT NOT NULL, typ TEXT NOT NULL, enhet_id TEXT,
  meddelande TEXT, skapad TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'skickad'
);
CREATE TRIGGER IF NOT EXISTS begaran_raderas_ej BEFORE DELETE ON begaran
  BEGIN SELECT RAISE(ABORT, 'En begäran raderas inte'); END;
`;

// Tid och datum. Tider lagras som ISO i UTC, datum som YYYY-MM-DD i svensk tid.
const TZ = 'Europe/Stockholm';
export const nu = () => new Date();
export const iso = (d = nu()) => d.toISOString();
export function datumAv(d = nu()) {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}
export const idag = () => datumAv(nu());
export function addDagar(datum, n) {
  const d = new Date(datum.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function tzForskjutning(utcMs) {
  const s = new Date(utcMs).toLocaleString('sv-SE', { timeZone: TZ });
  return Date.parse(s.replace(' ', 'T') + 'Z') - utcMs;
}
// Svensk lokaltid till ISO i UTC.
export function lokalTid(datum, klocka = '10:00') {
  const [y, m, d] = datum.split('-').map(Number);
  const [h, mi] = klocka.split(':').map(Number);
  const gissning = Date.UTC(y, m - 1, d, h, mi);
  let utc = gissning - tzForskjutning(gissning);
  utc = gissning - tzForskjutning(utc);
  return new Date(utc).toISOString();
}
export function giltigtDatum(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'))
    && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
}

// Tolkar seedens relativa tider (se seed/patienter.js) mot tidpunkten då sandlådan skapas.
function tolkare(bas) {
  const basDatum = datumAv(bas);
  const senast = bas.getTime() - 60_000;
  const tid = (spec, klocka = '10:00') => {
    if (spec == null) return null;
    let t;
    if (typeof spec === 'object' && !Array.isArray(spec)) t = bas.getTime() + spec.min * 60_000;
    else if (Array.isArray(spec)) {
      const [d, k] = spec;
      t = Date.parse(lokalTid(typeof d === 'number' ? addDagar(basDatum, d) : d, k));
    } else t = Date.parse(lokalTid(typeof spec === 'number' ? addDagar(basDatum, spec) : spec, klocka));
    // Det som enligt klockslaget skulle ligga i framtiden läggs strax före nu.
    if (t > senast && !(typeof spec === 'number' && spec > 0)) t = Math.min(t, senast);
    return new Date(t).toISOString();
  };
  const datum = (spec) => {
    if (spec == null) return null;
    if (typeof spec === 'number') return addDagar(basDatum, spec);
    if (Array.isArray(spec)) return datum(typeof spec[0] === 'number' ? spec[0] : spec[0]);
    if (typeof spec === 'object') return datumAv(new Date(bas.getTime() + spec.min * 60_000));
    return spec;
  };
  return { tid, datum };
}

const fodelsedatum = (pnr) => `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}`;
const kategoriAv = (typ) => (typ === 'Omvårdnadsanteckning' ? 'omvardnad' : 'lakare');

export function byggSeed(bas = nu()) {
  const { tid, datum } = tolkare(bas);
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  db.exec(SCHEMA_INVANARE);
  utokaSchema(db);
  sakraIdentitetsschema(db);
  const insE = db.query('INSERT INTO enheter VALUES (?, ?, ?, ?, ?, ?)');
  for (const e of ENHETER) insE.run(e.id, e.hsa, e.namn, e.kortnamn ?? null, e.typ, e.forald);
  const insP = db.query('INSERT INTO personal VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  PERSONAL.forEach((p, i) => insP.run(p.id, p.namn, p.yrke, p.titel, p.enhet, `SE2321000164-VKP${String(i + 1).padStart(3, '0')}`, p.demo ? 1 : 0, p.aktiv === false ? 0 : 1));
  const insK = db.query('INSERT INTO katalog VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const k of KATALOG) insK.run(k.id, k.namn, k.substans, k.styrka, k.form, k.atc, k.npl);

  const insPat = db.query(`INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, adress, postnr, ort, telefon, kontaktperson, skyddad, id_typ)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insVk = db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insAnt = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, ersatter_id, rattelse_orsak, version, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insDia = db.query('INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insMv = db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vidimerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insOk = db.query('INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insOrd = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, slut, status, utsatt_tid, utsatt_av, utsatt_orsak, ordinerad_av, skapad, nll_status, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insHist = db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)');
  const insNll = db.query('INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const enhetMatt = Object.fromEntries(Object.entries(MATTYPER_ENHET));
  let kvittensNr = 1000;
  const kvittens = () => `NLL-${String(++kvittensNr).padStart(6, '0')}`;
  const plus = (iso, sek) => new Date(Date.parse(iso) + sek * 1000).toISOString();

  // Patienterna med personnummer och patienterna med andra identiteter (seed/identiteter.js, Sussa 3.1.1).
  for (const p of [...PATIENTER, ...IDENTITETSPATIENTER]) {
    const ident = seedIdentitet(p);
    insPat.run(p.id, ident.varde, p.fornamn, p.efternamn, ident.kon, ident.fodd, p.adress, p.postnr, p.ort, p.telefon, p.kontaktperson, p.skyddad ? 1 : 0, ident.typ);
    if (p.listning) db.query('INSERT INTO listningar VALUES (?, ?, ?)').run(p.id, p.listning.enhet, datum(p.listning.fran));
    for (const s of p.sparr ?? []) db.query('INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, ?, ?)').run(p.id, s.enhet, datum(s.datum));
    const vk = {};
    for (const v of p.vardkontakter) {
      vk[v.ref] = Number(insVk.run(p.id, v.enhet, v.typ, tid(v.start), tid(v.slut), v.plats, v.orsak, v.kalla ?? 'vardkallan').lastInsertRowid);
    }
    for (const o of p.overkanslighet ?? []) insOk.run(p.id, o.enhet, o.amne, o.atc, o.reaktion, o.allvarlighet, datum(o.datum), o.kalla ?? 'vardkallan');
    for (const d of p.diagnoser) insDia.run(p.id, d.enhet, d.vk ? vk[d.vk] : null, d.kod, d.text, d.typ, datum(d.datum), d.kalla ?? 'vardkallan');
    for (const a of p.anteckningar) {
      const skapad = tid(a.tid);
      const status = a.status ?? 'signerad';
      const sok = JSON.stringify(Object.entries(a.sokord).map(([sokord, text]) => ({ sokord, text })));
      const r = insAnt.run(p.id, a.enhet, a.vk ? vk[a.vk] : null, a.typ, kategoriAv(a.typ), sok, a.av, skapad, status,
        status === 'signerad' ? plus(skapad, 300) : null, status === 'signerad' ? a.av : null, null, null, 1, a.kalla ?? 'vardkallan');
      if (a.rattelse) {
        const rt = tid(a.rattelse.tid);
        const sok2 = JSON.stringify(Object.entries(a.rattelse.sokord).map(([sokord, text]) => ({ sokord, text })));
        insAnt.run(p.id, a.enhet, a.vk ? vk[a.vk] : null, a.typ, kategoriAv(a.typ), sok2, a.rattelse.av, rt, 'signerad', rt, a.rattelse.av,
          Number(r.lastInsertRowid), a.rattelse.orsak, 2, 'vardkallan');
      }
    }
    for (const [typ, enhet, punkter, kalla] of p.matvarden) {
      for (const [t, varde, extra] of punkter) {
        const mt = tid(t);
        insMv.run(p.id, enhet, typ, String(varde), typeof varde === 'number' ? varde : null, enhetMatt[typ] ?? null, mt, null, kalla ?? 'vardkallan',
          arLabb(typ) && !extra?.ejVidimerad ? vidimeradTid(mt, bas) : null);
      }
    }
    for (const o of p.ordinationer) {
      const skapad = tid(o.start);
      const start = datum(o.start);
      const uppf = typeof o.uppfoljning === 'number' ? datum(o.uppfoljning) : o.uppfoljning;
      const utsatt = o.utsatt ? tid(o.utsatt.tid) : null;
      const nllStatus = o.nll === 'timeout' ? 'okand_kontrolleras' : 'kvitterad';
      const r = insOrd.run(p.id, o.enhet, o.lm, o.dosering, o.dos ?? null, o.dosEnhet ?? null, o.tider ? JSON.stringify(o.tider) : null, o.vidBehov ? 1 : 0,
        o.typ, o.orsak, uppf < start ? start : uppf, start, o.slut != null ? datum(o.slut) : null, o.utsatt ? 'utsatt' : 'aktiv', utsatt,
        o.utsatt?.av ?? null, o.utsatt?.orsak ?? null, o.av, skapad, nllStatus, o.kalla ?? 'vardkallan');
      const id = Number(r.lastInsertRowid);
      insHist.run(id, skapad, o.av, o.kalla?.startsWith('migrerad') ? `Migrerad från ${o.kalla.slice(9)}` : 'Ordinerad', o.dosering);
      if (!o.kalla?.startsWith('migrerad')) {
        if (o.nll === 'timeout') {
          insNll.run(id, 'ny', plus(skapad, 2), 'timeout', null, null, 1);
          insHist.run(id, plus(skapad, 32), null, 'Överföring till NLL fick timeout', 'Status okänd, kontrolleras genom avstämning');
        } else {
          insNll.run(id, 'ny', plus(skapad, 2), 'kvitterad', plus(skapad, 3), kvittens(), 1);
          insHist.run(id, plus(skapad, 3), null, 'Kvitterad av NLL', null);
        }
      }
      if (o.utsatt) {
        insHist.run(id, utsatt, o.utsatt.av, 'Utsatt', o.utsatt.orsak);
        insNll.run(id, 'utsattning', plus(utsatt, 2), 'kvitterad', plus(utsatt, 3), kvittens(), 1);
      }
    }
  }

  const pers = Object.fromEntries(PERSONAL.map(p => [p.id, p]));
  const insR = db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status,
    skickad_tid, mottagen_tid, mottagen_av, bedomd_tid, bedomd_av, beslut, motivering, besvarad_tid, besvarad_av, svar, svar_kvitterat_tid, svar_kvitterat_av, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const r of REMISSER) {
    const status = r.svarKvitterat ? 'svar_kvitterat' : r.besvarad ? 'besvarad' : r.bedomd ? 'bedomd' : r.mottagen ? 'mottagen' : 'skickad';
    insR.run(r.patient, r.fran, r.till, r.av, r.fragestallning, r.anamnes, r.prioritet, datum(r.svarSenast), status, tid(r.skickad),
      tid(r.mottagen), r.mottagenAv ?? null, tid(r.bedomd), r.bedomdAv ?? null, r.beslut ?? null, r.motivering ?? null,
      tid(r.besvarad), r.besvaradAv ?? null, r.svar ?? null, tid(r.svarKvitterat), r.svarKvitteratAv ?? null, r.kalla ?? 'vardkallan');
  }
  for (const v of VANTRUM) {
    db.query('INSERT INTO vantrum (patient_id, enhet_id, konummer, ankomst, prioritet, orsak) VALUES (?, ?, ?, ?, ?, ?)')
      .run(v.patient, 'uso-akut', v.konummer, tid(v.ankomst), v.prioritet, v.orsak);
  }

  // Migreringsavstämning: räknat på det som faktiskt finns i mallen, plus det som inte gick att föra över.
  const datatyper = { vardkontakter: 'vardkontakter', anteckningar: 'anteckningar', diagnoser: 'diagnoser', matvarden: 'matvarden', ordinationer: 'ordinationer', overkanslighet: 'overkanslighet', remisser: 'remisser' };
  for (const [datatyp, tabell] of Object.entries(datatyper)) {
    for (const kalla of ['migrerad:VAS', 'migrerad:Cosmic']) {
      const n = db.query(`SELECT count(*) AS n FROM ${tabell} WHERE kalla = ?`).get(kalla).n;
      const avv = MIGRERING_AVVIKELSER.filter(a => a.datatyp === datatyp && a.kalla === kalla).length;
      if (n + avv === 0) continue;
      db.query('INSERT INTO migrering VALUES (?, ?, ?, ?, ?)').run(datatyp, kalla, n + avv, n, n);
    }
  }
  for (const a of MIGRERING_AVVIKELSER) {
    db.query('INSERT INTO migrering_avvikelser (patient_id, datatyp, kalla, beskrivning, atgard) VALUES (?, ?, ?, ?, ?)').run(a.patient, a.datatyp, a.kalla, a.beskrivning, a.atgard);
  }

  for (const l of LOGG) {
    loggaRad(db, { tid: tid(l.tid), personal_id: l.av, enhet_id: pers[l.av].enhet, patient_id: l.patient, handling: l.handling,
      resurs: l.resurs ?? null, grund: l.grund, syfte: l.syfte ?? null, resultat: l.resultat });
  }
  // Vårdtillfällen, hälsoärenden och vårdkontakt för allt som dokumenterats (vardstruktur.js). Efter avstämningen, så att
  // kontakter som systemet skapar för historik utan vårdkontakt inte räknas som överförda från källan.
  knytHistorik(db, { bas, tid, sangbyten: SANGBYTEN, halsoarenden: HALSOARENDEN });
  seedaInvanare(db);
  // Uppmärksamhetsinformation (Sussa 3.1.5), se seed/uppmarksamhet.js.
  db.exec(SCHEMA_UPPMARKSAMHET);
  seedaUppmarksamhet(db, { datum: (n) => tid(n), datumTid: (d) => tid(d) });
  seedaIdentiteter(db, tid);
  // Tidbok, väntelista och kallelser (tidbok.js). Laddas när mallen byggs, eftersom tidbok.js bygger på vardkontakt.js.
  require('./tidbok.js').seedaTidbok(db, { bas });
  db.query('INSERT INTO installningar VALUES (?, ?)').run('seed_datum', datumAv(bas));
  db.query('INSERT INTO installningar VALUES (?, ?)').run('seed_tid', bas.toISOString());
  return db;
}

// Provsvar från laboratoriet vidimeras av ansvarig läkare. I seeden är ett provsvar vidimerat två timmar efter
// provtagningen, utom de som är märkta { ejVidimerad: true } och de som är för nya för att ha hunnit vidimeras.
const arLabb = (typ) => MATKOD[typ]?.kategori === 'laboratory';
function vidimeradTid(provtid, bas) {
  const t = Date.parse(provtid) + 2 * 3600_000;
  return t < bas.getTime() ? new Date(t).toISOString() : null;
}

// Identiteterna (Sussa 3.1.1): den gällande för varje patient och de tidigare som seeden anger. En identitet gäller från
// patientens första vårdkontakt, eller från när den tidigare identiteten upphörde.
function seedaIdentiteter(db, tid) {
  sakraIdentitetsschema(db);
  for (const p of [...PATIENTER, ...IDENTITETSPATIENTER]) {
    const forsta = db.query('SELECT min(start) AS t FROM vardkontakter WHERE patient_id = ?').get(p.id).t;
    db.query("UPDATE identiteter SET fran = ? WHERE patient_id = ? AND status = 'gallande'").run(forsta ?? tid({ min: -1 }), p.id);
    for (const t of p.tidigare ?? []) {
      const ident = seedIdentitet(t);
      db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, till, orsak, ursprung) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, ident.typ, ident.varde, 'tidigare', tid(t.fran), tid(t.till), t.orsak, p.id);
      db.query("UPDATE identiteter SET fran = ? WHERE patient_id = ? AND status = 'gallande'").run(tid(t.till), p.id);
    }
  }
}

// Invånarna i Min journal: varje patient, och vårdnadshavare utan egen journal. Visningsreglerna är vårdgivarens.
function seedaInvanare(db) {
  const insI = db.query('INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of PATIENTER) insI.run(`inv-${p.id}`, p.pnr, p.fornamn, p.efternamn, fodelsedatum(p.pnr), p.id);
  for (const v of VARDNADSHAVARE) {
    insI.run(v.id, v.pnr, v.fornamn, v.efternamn, fodelsedatum(v.pnr), null);
    for (const b of v.barn) db.query('INSERT INTO vardnadshavare VALUES (?, ?)').run(v.id, b);
  }
  const insR = db.query('INSERT INTO visningsregler (enhet_id, anteckningstyp, visning, dagar, motivering) VALUES (?, ?, ?, ?, ?)');
  for (const r of VISNINGSREGLER) insR.run(r.enhet ?? null, r.typ ?? null, r.visning, r.dagar ?? null, r.motivering);
}

// En sandlåda som sparades före Min journal saknar dess tabeller och kolumner. De läggs till när sandlådan läses in.
// Provsvar som fanns innan vidimeringen infördes räknas som vidimerade när de togs.
export function migrera(db) {
  const kolumner = (t) => db.query(`PRAGMA table_info(${t})`).all().map(k => k.name);
  if (!kolumner('matvarden').includes('vidimerad')) {
    db.exec('ALTER TABLE matvarden ADD COLUMN vidimerad TEXT');
    const labb = Object.keys(MATKOD).filter(arLabb);
    db.query(`UPDATE matvarden SET vidimerad = tid WHERE typ IN (${labb.map(() => '?').join(', ')})`).run(...labb);
  }
  if (!kolumner('atkomstlogg').includes('invanare_id')) db.exec('ALTER TABLE atkomstlogg ADD COLUMN invanare_id TEXT');
  db.exec(SCHEMA_INVANARE);
  if (!db.query('SELECT 1 FROM invanare LIMIT 1').get()) seedaInvanare(db);
  // Uppmärksamhetsinformation finns inte i sandlådor som sparades före den. Seeden läggs in relativt till i dag.
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'uppmarksamhet'").get()) {
    db.exec(SCHEMA_UPPMARKSAMHET);
    const { tid } = tolkare(nu());
    seedaUppmarksamhet(db, { datum: (n) => tid(n), datumTid: (d) => tid(d) });
  }
  if (!kolumner('uppmarksamhet').includes('registrerad_enhet')) db.exec('ALTER TABLE uppmarksamhet ADD COLUMN registrerad_enhet TEXT');
  sakraIdentitetsschema(db);
  // En sandlåda från före vårdtillfällen och hälsoärenden får dem, och allt som dokumenterats knyts till en vårdkontakt.
  if (utokaSchema(db)) {
    const seedTid = db.query("SELECT varde FROM installningar WHERE nyckel = 'seed_tid'").get()?.varde;
    knytHistorik(db, { bas: seedTid ? new Date(seedTid) : nu() });
  }
  // En sandlåda från före tidboken får den, relativt till i dag.
  require('./tidbok.js').sakraTidbok(db);
  return db;
}

// Måttenheter per mätvärdestyp (används av seeden, typlistan finns i journal.js).
export const MATTYPER_ENHET = {
  blodtryck: 'mmHg', puls: 'slag/min', temp: '°C', saturation: '%', andningsfrekvens: 'andetag/min', vikt: 'kg', langd: 'cm',
  crp: 'mg/L', egfr: 'mL/min/1,73 m²', kreatinin: 'µmol/L', hba1c: 'mmol/mol', inr: 'INR', ntprobnp: 'ng/L', hb: 'g/L',
  glukos: 'mmol/L', kalium: 'mmol/L', pef: 'L/min', troponin: 'ng/L', tsh: 'mIE/L',
};

// Mallen byggs om när dagen byter, så att demon alltid ligger kring dagens datum.
let mall = null;
export function mallen() {
  const d = idag();
  if (!mall || mall.datum !== d) {
    const db = byggSeed();
    mall = { datum: d, data: db.serialize() };
    db.close();
  }
  return mall.data;
}

export function nySessionsDb() {
  const db = Database.deserialize(mallen());
  db.exec('PRAGMA foreign_keys = OFF');
  // Dagens patienter i tidboken flyttas till tider kring nu, så att någon alltid väntas (tidbok.js).
  require('./tidbok.js').anpassaTillNu(db);
  return db;
}

export function lasSandlada(base64) {
  return migrera(Database.deserialize(Buffer.from(base64, 'base64')));
}

export function installning(db, nyckel, varde) {
  if (varde === undefined) return db.query('SELECT varde FROM installningar WHERE nyckel = ?').get(nyckel)?.varde ?? null;
  db.query('INSERT INTO installningar VALUES (?, ?) ON CONFLICT (nyckel) DO UPDATE SET varde = excluded.varde').run(nyckel, varde);
}
