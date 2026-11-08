// Ekonomi (runda 7, r3, Sussa 7.1): schema, demopriser, demoreglerna för DRG och seed. Modulen beror inte på db.js, så
// att db.js kan använda den både när mallen byggs och när en äldre sandlåda läses in.
//
// Alla priser är demopriser och inga verkliga regionpriser. DRG-grupperna är en demoregel: NordDRG är licensierad och
// används inte. Folkbokföringen och den nationella tjänsten för utomlänsvård är simulerade.
import { KATALOG } from './seed/lakemedel-katalog.js';
import { PERSONAL } from './seed/personal.js';

const TZ = 'Europe/Stockholm';
const datumI = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
const plusDagar = (datum, n) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// prislistor: en rad per version och vårdenhet. Den version som gäller en dag är den med senast giltig_fran som inte har
// passerat dagen, och vid samma datum den högsta versionen. En version ändras och raderas aldrig, så att ett underlag
// som redan har exporterats alltid går att räkna om med samma priser.
// fakturaexporter: varje export av faktureringsunderlag, utan patientuppgifter.
// fardigbehandlad: läkarens registrering av att patienten är medicinskt färdigbehandlad, när det inte görs genom
// underrättelsen om utskrivningsklar i en samordnad planering. hjalpmedel_utlamnade och lma_kort är det som har hänt och
// det patienten har visat upp. Raderna med patient_id ändras bara när journaler slås samman (identitet.js).
export const SCHEMA_EKONOMI = `
CREATE TABLE IF NOT EXISTS prislistor (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, version INTEGER NOT NULL, giltig_fran TEXT NOT NULL, poster TEXT NOT NULL,
  skapad TEXT NOT NULL, skapad_av TEXT, orsak TEXT NOT NULL, UNIQUE (enhet_id, version)
);
CREATE TRIGGER IF NOT EXISTS prislista_andras_ej BEFORE UPDATE ON prislistor BEGIN SELECT RAISE(ABORT, 'En prislista ändras inte. Gör en ny version.'); END;
CREATE TRIGGER IF NOT EXISTS prislista_raderas_ej BEFORE DELETE ON prislistor BEGIN SELECT RAISE(ABORT, 'En prislista raderas inte'); END;
CREATE TABLE IF NOT EXISTS fakturaexporter (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, av TEXT NOT NULL, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL,
  format TEXT NOT NULL, antal INTEGER NOT NULL, summa INTEGER NOT NULL, debiteras INTEGER NOT NULL, sha256 TEXT NOT NULL,
  CHECK (format IN ('csv', 'json'))
);
CREATE TRIGGER IF NOT EXISTS fakturaexport_andras_ej BEFORE UPDATE ON fakturaexporter BEGIN SELECT RAISE(ABORT, 'En export ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS fakturaexport_raderas_ej BEFORE DELETE ON fakturaexporter BEGIN SELECT RAISE(ABORT, 'En export raderas inte'); END;
CREATE TABLE IF NOT EXISTS fardigbehandlad (
  id INTEGER PRIMARY KEY, vardtillfalle_id INTEGER NOT NULL, patient_id TEXT NOT NULL, datum TEXT NOT NULL, tid TEXT NOT NULL,
  av TEXT NOT NULL, enhet_id TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS fardigbehandlad_andras_ej BEFORE UPDATE OF vardtillfalle_id, datum, tid, av, enhet_id ON fardigbehandlad
  BEGIN SELECT RAISE(ABORT, 'Registreringen ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS fardigbehandlad_raderas_ej BEFORE DELETE ON fardigbehandlad BEGIN SELECT RAISE(ABORT, 'Registreringen raderas inte'); END;
CREATE TABLE IF NOT EXISTS hjalpmedel_utlamnade (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, artikel TEXT NOT NULL,
  antal INTEGER NOT NULL DEFAULT 1, tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS hjalpmedel_andras_ej BEFORE UPDATE OF enhet_id, vardkontakt_id, artikel, antal, tid, av ON hjalpmedel_utlamnade
  BEGIN SELECT RAISE(ABORT, 'Ett utlämnat hjälpmedel ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS hjalpmedel_raderas_ej BEFORE DELETE ON hjalpmedel_utlamnade BEGIN SELECT RAISE(ABORT, 'Ett utlämnat hjälpmedel raderas inte'); END;
CREATE TABLE IF NOT EXISTS lma_kort (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, nummer TEXT NOT NULL, giltig_till TEXT NOT NULL, registrerad TEXT NOT NULL, av TEXT
);
`;

export const DEMO = 'Demopriser och demoregler, inte några verkliga regionpriser. DRG-grupperna är en egen demogruppering: NordDRG är licensierad och används inte.';

// Kategorierna i prislistan, i den ordning de visas.
export const KATEGORIER = {
  vardkontakt: 'Vårdkontakter', vardtillfalle: 'Vårdtillfällen och DRG', atgard: 'Åtgärder (KVÅ)', material: 'Material (schablon)',
  hjalpmedel: 'Hjälpmedel', lakemedel: 'Läkemedel som ges på enheten',
};

// Läkemedel som ges på enheten: pris per given dos efter beredningsform (demopris).
function dosPris(form) {
  if (/injektion|infusion/.test(form)) return 90;
  if (/inhalation|spray/.test(form)) return 15;
  if (/depot/.test(form)) return 6;
  return 4;
}

// Grunden för varje vårdenhets prislista. Material är schabloner: systemet räknar materialet ur det som har hänt, per
// vårddygn, per akutbesök, per given injektion och per övervakning av vitala tecken, så att ingen registrerar material.
export const BASPRISER = {
  vardkontakt: {
    besok: { text: 'Besök i öppenvård', pris: 1900 }, telefon: { text: 'Telefonkontakt', pris: 450 }, video: { text: 'Videobesök', pris: 900 },
    hembesok: { text: 'Hembesök', pris: 2600 }, akut: { text: 'Besök på akutmottagningen', pris: 3400 },
  },
  vardtillfalle: {
    varddygn: { text: 'Vårddygn i slutenvård', pris: 6800 }, kommunDygn: { text: 'Vårddygn med kommunens betalningsansvar', pris: 7200 },
    drgPoang: { text: 'Pris per DRG-poäng', pris: 64000 }, ytterfallDygn: { text: 'Vårddygn utöver DRG-gruppens trimgräns', pris: 5200 },
  },
  atgard: {
    QD008: { text: 'Övervakning av vitala tecken', pris: 150 }, PA001: { text: 'Bedömning av medvetandefunktioner', pris: 120 },
    XV015: { text: 'Läkemedelsgenomgång, enkel', pris: 600 },
  },
  material: {
    'MAT-DYGN': { text: 'Basmaterial per vårddygn', pris: 180, schablon: 'varddygn' },
    'MAT-AKUT': { text: 'Basmaterial vid akutbesök', pris: 250, schablon: 'akut' },
    'MAT-INJ': { text: 'Injektionsmaterial', pris: 35, schablon: 'injektion' },
    'MAT-OVERV': { text: 'Engångsmaterial vid övervakning', pris: 40, schablon: 'QD008' },
  },
  // avgift är hjälpmedelsavgiften som patienten betalar (demoregel).
  hjalpmedel: {
    'HM-KRYCK': { text: 'Kryckkäppar, ett par', pris: 450, avgift: 0 }, 'HM-ORTOS-KNA': { text: 'Knäortos', pris: 1800, avgift: 300 },
    'HM-SPACER': { text: 'Andningsbehållare för inhalation', pris: 260, avgift: 0 }, 'HM-ROLLATOR': { text: 'Rollator', pris: 2900, avgift: 0 },
  },
  lakemedel: Object.fromEntries(KATALOG.map(k => [k.id, { text: `${k.namn} ${k.styrka}, per dos`, pris: dosPris(k.form) }])),
};

// Demopriserna skiljer sig något mellan sjukhusen och primärvården.
const FAKTOR = { lind: 0.92, kkoga: 0.92, primarvard: 0.85 };
function prisForEnhet(faktor) {
  const ut = JSON.parse(JSON.stringify(BASPRISER));
  for (const kat of ['vardkontakt', 'vardtillfalle', 'atgard']) for (const p of Object.values(ut[kat])) p.pris = Math.round(p.pris * faktor / 10) * 10;
  return ut;
}

// DRG-liknande demogrupper. kod och vikt är påhittade. Trimgränsen är antalet vårddygn som ingår i gruppen, och dygn
// utöver den ersätts per dygn. En bidiagnos ger 0,1 i högre vikt.
export const DRG_DEMO = [
  { kod: 'VK-DRG-05A', text: 'Akut hjärtinfarkt (demogrupp)', icd: /^I2[12]/, vikt: 1.35, trimgrans: 8 },
  { kod: 'VK-DRG-05B', text: 'Hjärtsvikt (demogrupp)', icd: /^I50/, vikt: 1.05, trimgrans: 10 },
  { kod: 'VK-DRG-05C', text: 'Förmaksflimmer och andra arytmier (demogrupp)', icd: /^I4[6-9]/, vikt: 0.62, trimgrans: 5 },
  { kod: 'VK-DRG-04A', text: 'Lunginflammation (demogrupp)', icd: /^J1[2-8]/, vikt: 0.85, trimgrans: 9 },
  { kod: 'VK-DRG-08A', text: 'Höftfraktur (demogrupp)', icd: /^S72/, vikt: 1.9, trimgrans: 14 },
  { kod: 'VK-DRG-08B', text: 'Knäskada och korsbandsoperation (demogrupp)', icd: /^S8[23]/, vikt: 1.1, trimgrans: 3 },
  { kod: 'VK-DRG-19A', text: 'Depression och andra förstämningssyndrom (demogrupp)', icd: /^F3/, vikt: 1.2, trimgrans: 30 },
  { kod: 'VK-DRG-99', text: 'Övriga sjukdomar (demogrupp)', icd: /^[A-Z]/, vikt: 0.8, trimgrans: 7 },
];
export const DRG_OGRUPPERAD = { kod: 'VK-DRG-00', text: 'Kan inte grupperas (demogrupp)', vikt: 0, trimgrans: 0 };

// Patientavgift för asylsökande med LMA-kort (demoregel): 50 kronor för besök och akutbesök för vuxna, inget för barn och
// telefon. De omfattas inte av högkostnadsskyddet i demon.
export const AVGIFT_LMA = { besok: 50, video: 50, hembesok: 50, akut: 50, telefon: 0, slutenvard: 0, friUnder: 18 };

export function lmaFor(db, patientId, datum) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'lma_kort'").get()) return null;
  return db.query('SELECT * FROM lma_kort WHERE patient_id = ? AND giltig_till >= ? AND substr(registrerad, 1, 10) <= ? ORDER BY id DESC').get(patientId, datum, datum) ?? null;
}

// Den simulerade folkbokföringen (i verkligheten Skatteverkets Navet). Län och kommun räknas ur postnumret, utom för de
// patienter som står här. Patient 12 studerar i Örebro men är folkbokförd hemma i Karlstad.
export const EGEN_REGION = { lanKod: '18', lan: 'Örebro län', region: 'Region Örebro län' };
export const FOLKBOKFORING_DEMO = {
  p12: { lanKod: '17', lan: 'Värmlands län', region: 'Region Värmland', kommun: 'Karlstad' },
};
export function folkbokforing(patient) {
  if (!patient) return null;
  const f = FOLKBOKFORING_DEMO[patient.id];
  if (f) return { ...f, simulerad: true };
  const nr = (patient.postnr ?? '').replace(/\s/g, '');
  if (/^(69[1-6]|70\d|71[1-9])\d{2}$/.test(nr)) return { ...EGEN_REGION, kommun: patient.ort ?? null, simulerad: true };
  return null;
}

// Ekonomen på regionkansliet (runda 7, r3). r7: true i seed/personal.js betyder att personen läggs in också i en
// sandlåda från före runda 7, med samma HSA-id som i mallen.
function sakraPersonal(db) {
  const ins = db.query('INSERT OR IGNORE INTO personal VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  PERSONAL.forEach((p, i) => { if (p.r7) ins.run(p.id, p.namn, p.yrke, p.titel, p.enhet, `SE2321000164-VKP${String(i + 1).padStart(3, '0')}`, p.demo ? 1 : 0, 1); });
}

function seedaPrislistor(db, bas) {
  const ins = db.query('INSERT INTO prislistor (enhet_id, version, giltig_fran, poster, skapad, skapad_av, orsak) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const skapad = new Date(Date.parse('2019-12-01T09:00:00Z')).toISOString();
  for (const e of db.query("SELECT id, forald_id FROM enheter WHERE typ = 'vardenhet' ORDER BY id").all()) {
    const poster = prisForEnhet(FAKTOR[e.forald_id] ?? 1);
    ins.run(e.id, 1, '2020-01-01', JSON.stringify(poster), skapad, null, 'Demopriser när Vårdkällan infördes');
    // Kardiologin fick nya demopriser för vårddygn och besök för 45 dagar sedan, så att historiken syns.
    if (e.id === 'uso-kard') {
      const ny = JSON.parse(JSON.stringify(poster));
      ny.vardtillfalle.varddygn.pris = 7100;
      ny.vardkontakt.besok.pris = 1950;
      const fran = plusDagar(datumI(bas), -45);
      ins.run(e.id, 2, fran, JSON.stringify(ny), new Date(Date.parse(`${plusDagar(fran, -14)}T09:00:00Z`)).toISOString(), 'eko', 'Nya demopriser för vårddygn och besök');
    }
  }
}

const tidFor = (bas, dagar, klocka) => {
  const d = plusDagar(datumI(bas), dagar);
  const t = Date.parse(`${d}T${klocka}:00Z`) - 3600_000;
  return new Date(Math.min(t, bas.getTime() - 60_000)).toISOString();
};

// Seeden: utlämnade hjälpmedel, ett LMA-kort och en registrering av medicinskt färdigbehandlad. Allt är påhittat.
function seedaHandelser(db, bas) {
  const kontakt = (pid, enhet, dagar) => db.query('SELECT id FROM vardkontakter WHERE patient_id = ? AND enhet_id = ? ORDER BY abs(julianday(start) - julianday(?)) LIMIT 1')
    .get(pid, enhet, tidFor(bas, dagar, '12:00'))?.id ?? null;
  const insH = db.query('INSERT INTO hjalpmedel_utlamnade (patient_id, enhet_id, vardkontakt_id, artikel, antal, tid, av) VALUES (?, ?, ?, ?, 1, ?, ?)');
  // Ingrid Haugen fick kryckkäppar och en knäortos på ortopedmottagningen, och Marek Zieliński en andningsbehållare på
  // vårdcentralen.
  if (db.query("SELECT 1 FROM patienter WHERE id = 'p19'").get()) {
    insH.run('p19', 'uso-ort', kontakt('p19', 'uso-ort', -1), 'HM-KRYCK', tidFor(bas, -1, '09:25'), 'lak-ort');
    insH.run('p19', 'uso-ort', kontakt('p19', 'uso-ort', -1), 'HM-ORTOS-KNA', tidFor(bas, -1, '09:28'), 'lak-ort');
  }
  if (db.query("SELECT 1 FROM patienter WHERE id = 'p18'").get()) {
    insH.run('p18', 'vc-tybble', kontakt('p18', 'vc-tybble', -60), 'HM-SPACER', tidFor(bas, -60, '10:20'), 'ssk-vc');
    // Marek Zieliński är asylsökande och visade sitt LMA-kort (påhittat nummer) vid besöket på vårdcentralen.
    db.query('INSERT INTO lma_kort (patient_id, nummer, giltig_till, registrerad, av) VALUES (?, ?, ?, ?, ?)')
      .run('p18', 'DEMO-LMA-0471-26', plusDagar(datumI(bas), 180), tidFor(bas, -400, '15:10'), 'ssk-akut');
  }
  // Margareta Forsberg är medicinskt färdigbehandlad sedan i förrgår och väntar på en plats i kommunen.
  const vt = db.query("SELECT * FROM vardtillfallen WHERE patient_id = 'p07' AND utskriven IS NULL").get();
  if (vt) {
    db.query('INSERT INTO fardigbehandlad (vardtillfalle_id, patient_id, datum, tid, av, enhet_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(vt.id, 'p07', plusDagar(datumI(bas), -2), tidFor(bas, -2, '11:00'), 'lak-kkoga', 'kkoga-ort');
  }
}

export function sakraEkonomi(db, bas = new Date()) {
  const fanns = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prislistor'").get();
  const fannsHandelser = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'hjalpmedel_utlamnade'").get();
  db.exec(SCHEMA_EKONOMI);
  sakraPersonal(db);
  if (!fanns) seedaPrislistor(db, bas);
  if (!fannsHandelser) seedaHandelser(db, bas);
}
