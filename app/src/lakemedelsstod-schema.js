// Läkemedelsprocessen, del 2 (runda 6, r2): schema och seed för mallar med flera ordinationer, upp- och nedtrappning,
// muntlig ordination, generella direktiv, spädning och tillsatser, makulering, fler läkemedelstyper med licens,
// förpackningar med NPL-pack-id, utvärdering av behandlingen, fördjupad läkemedelsgenomgång och kalorier i
// vätskebalansen. Modulen beror inte på db.js, så att db.js kan använda den både när mallen byggs och när en äldre
// sandlåda läses in. Allt är IF NOT EXISTS.
import { FORPACKNINGAR } from './seed/forpackningar.js';
import { PRODUKTER } from './seed/produkttyper.js';

// Ett beslut (mall eller direktiv) ändras aldrig. Det kan bara upphävas, med vem, när och orsak.
const upphavbar = (t) => `
CREATE TRIGGER IF NOT EXISTS ${t}_raderas_ej BEFORE DELETE ON ${t}
  BEGIN SELECT RAISE(ABORT, 'Ett fastställt beslut raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_andras_ej BEFORE UPDATE ON ${t}
  WHEN OLD.upphavt IS NOT NULL OR NEW.id IS NOT OLD.id OR NEW.faststallt IS NOT OLD.faststallt OR NEW.faststallt_av IS NOT OLD.faststallt_av
    OR NEW.innehall IS NOT OLD.innehall OR NEW.enhet_id IS NOT OLD.enhet_id OR NEW.giltigt_till IS NOT OLD.giltigt_till
  BEGIN SELECT RAISE(ABORT, 'Ett fastställt beslut ändras inte, det upphävs'); END;`;
// Rader som bara läggs till.
const bestaende = (t, text) => `
CREATE TRIGGER IF NOT EXISTS ${t}_raderas_ej BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_andras_ej BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} ändras inte'); END;`;

export const SCHEMA_LAKEMEDELSSTOD = `
-- Mallar med flera ordinationer (Sussa 3.5.1.3, 3.5.2.14). innehall är JSON med posterna.
CREATE TABLE IF NOT EXISTS ordinationspaket (
  id TEXT PRIMARY KEY, namn TEXT NOT NULL, enhet_id TEXT NOT NULL, vardhandelse TEXT, beskrivning TEXT NOT NULL, innehall TEXT NOT NULL,
  faststallt_av TEXT NOT NULL, faststallt TEXT NOT NULL, giltigt_till TEXT NOT NULL, upphavt TEXT, upphavt_av TEXT, upphavt_orsak TEXT
);
${upphavbar('ordinationspaket')}
CREATE TABLE IF NOT EXISTS paketordinationer (ordination_id INTEGER PRIMARY KEY, paket_id TEXT NOT NULL, grupp TEXT NOT NULL, post INTEGER NOT NULL);
${bestaende('paketordinationer', 'Kopplingen till mallen')}

-- Upp- och nedtrappning (3.5.2.12). steg är JSON [{ fran, dos, dosering }].
CREATE TABLE IF NOT EXISTS ordination_trappning (ordination_id INTEGER PRIMARY KEY, riktning TEXT NOT NULL, steg TEXT NOT NULL,
  CHECK (riktning IN ('upp', 'ned')));
${bestaende('ordination_trappning', 'Ett trappschema')}

-- Muntlig ordination (3.5.2.12, HSLF-FS 2017:37 6 kap. 13 till 15 §§ och 8 kap. 3 §). Bara signeringen fylls i efteråt.
CREATE TABLE IF NOT EXISTS muntliga_ordinationer (
  ordination_id INTEGER PRIMARY KEY, lakare_id TEXT NOT NULL, mottagen_av TEXT NOT NULL, mottagen TEXT NOT NULL, satt TEXT NOT NULL,
  omedelbar TEXT NOT NULL, signerad TEXT, signerad_av TEXT, CHECK (satt IN ('muntligt', 'telefon'))
);
CREATE TRIGGER IF NOT EXISTS muntlig_raderas_ej BEFORE DELETE ON muntliga_ordinationer BEGIN SELECT RAISE(ABORT, 'En muntlig ordination raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS muntlig_andras_ej BEFORE UPDATE ON muntliga_ordinationer
  WHEN OLD.signerad IS NOT NULL OR NEW.lakare_id IS NOT OLD.lakare_id OR NEW.mottagen_av IS NOT OLD.mottagen_av OR NEW.mottagen IS NOT OLD.mottagen
    OR NEW.satt IS NOT OLD.satt OR NEW.omedelbar IS NOT OLD.omedelbar
  BEGIN SELECT RAISE(ABORT, 'En muntlig ordination ändras inte, den signeras'); END;

-- Generella direktiv (3.5.2.15, HSLF-FS 2017:37 6 kap. 6 och 7 §§). innehall är JSON med dosering, maxdos,
-- indikation, kontraindikationer, antal tillfällen och spädning.
CREATE TABLE IF NOT EXISTS generella_direktiv (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, lakemedel_id TEXT NOT NULL, innehall TEXT NOT NULL, giltigt_fran TEXT NOT NULL,
  giltigt_till TEXT NOT NULL, faststallt_av TEXT NOT NULL, faststallt TEXT NOT NULL, upphavt TEXT, upphavt_av TEXT, upphavt_orsak TEXT
);
${upphavbar('generella_direktiv')}
CREATE TABLE IF NOT EXISTS direktivordinationer (ordination_id INTEGER PRIMARY KEY, direktiv_id INTEGER NOT NULL, bedomning TEXT NOT NULL, bekraftade TEXT NOT NULL);
${bestaende('direktivordinationer', 'Sjuksköterskans bedömning')}

-- Spädning och tillsatser (3.5.1.4, 3.5.2.1). tillsatser är JSON [{ lakemedelId, mangd, enhet, volymMl }].
CREATE TABLE IF NOT EXISTS ordination_spadning (ordination_id INTEGER PRIMARY KEY, losning TEXT, volym_ml REAL NOT NULL, tid_min REAL, tillsatser TEXT NOT NULL,
  CHECK (volym_ml > 0));
${bestaende('ordination_spadning', 'Spädningen')}

-- Makulering av en felaktig registrering (3.5.2.2). Registreringen finns kvar och visas överstruken med orsak.
CREATE TABLE IF NOT EXISTS makuleringar (
  id INTEGER PRIMARY KEY, typ TEXT NOT NULL, post_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  av TEXT NOT NULL, orsak TEXT NOT NULL, UNIQUE (typ, post_id), CHECK (typ IN ('administrering', 'vatskebalans')), CHECK (length(trim(orsak)) >= 3)
);
${bestaende('makuleringar', 'En makulering')}

-- Läkemedelstyper utöver godkända läkemedel i NPL (3.5.2.4) och licenser som systemet bevakar.
CREATE TABLE IF NOT EXISTS produkttyper (lakemedel_id TEXT PRIMARY KEY, typ TEXT NOT NULL, kcal_per_ml REAL, beskrivning TEXT NOT NULL,
  CHECK (typ IN ('extempore', 'licens', 'egendefinierad', 'blodprodukt', 'nutrition')));
CREATE TABLE IF NOT EXISTS licenser (
  id INTEGER PRIMARY KEY, lakemedel_id TEXT NOT NULL, patient_id TEXT, enhet_id TEXT NOT NULL, licensnummer TEXT NOT NULL,
  giltig_fran TEXT NOT NULL, giltig_till TEXT NOT NULL, registrerad TEXT NOT NULL
);
${bestaende('licenser', 'En licens')}

-- Förpackningar med NPL-pack-id (L7) och den förpackning som ordinationen gäller.
CREATE TABLE IF NOT EXISTS forpackningar (nplpackid TEXT PRIMARY KEY, lakemedel_id TEXT NOT NULL, text TEXT NOT NULL, forval INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ordination_forpackning (ordination_id INTEGER PRIMARY KEY, nplpackid TEXT NOT NULL);
${bestaende('ordination_forpackning', 'Förpackningen')}

-- Utvärdering av effekt och biverkan (3.5.2.10, 3.5.2.20).
CREATE TABLE IF NOT EXISTS lakemedelsutvarderingar (
  id INTEGER PRIMARY KEY, ordination_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  effekt TEXT NOT NULL, biverkan TEXT NOT NULL, biverkan_text TEXT, beslut TEXT NOT NULL, nytt_uppfoljningsdatum TEXT, kommentar TEXT,
  CHECK (effekt IN ('god', 'delvis', 'ingen', 'for_tidigt')), CHECK (biverkan IN ('ingen', 'misstankt', 'bekraftad')),
  CHECK (beslut IN ('fortsatt', 'andra', 'satt_ut', 'observation'))
);
${bestaende('lakemedelsutvarderingar', 'En utvärdering')}

-- Fördjupad läkemedelsgenomgång (3.5.1.6, HSLF-FS 2017:37 11 kap.). Varje steg läggs till och ändras aldrig.
CREATE TABLE IF NOT EXISTS fordjupade_genomgangar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, startad TEXT NOT NULL, startad_av TEXT NOT NULL, fynd TEXT NOT NULL, vardtillfalle_id INTEGER
);
${bestaende('fordjupade_genomgangar', 'En fördjupad läkemedelsgenomgång')}
CREATE TABLE IF NOT EXISTS fordjupade_steg (
  id INTEGER PRIMARY KEY, genomgang_id INTEGER NOT NULL, typ TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL, innehall TEXT NOT NULL,
  UNIQUE (genomgang_id, typ), CHECK (typ IN ('patient', 'farmaceut', 'lakare'))
);
${bestaende('fordjupade_steg', 'Ett steg i genomgången')}

-- Kalorier för ett intag i vätskebalansen (3.5.3.2).
CREATE TABLE IF NOT EXISTS vatskebalans_kcal (vatskebalans_id INTEGER PRIMARY KEY, kcal REAL NOT NULL, CHECK (kcal >= 0));
${bestaende('vatskebalans_kcal', 'Kalorierna')}
`;

export function sakraLakemedelsstod(db) {
  db.exec(SCHEMA_LAKEMEDELSSTOD);
}

const dagPlus = (bas, n) => { const d = new Date(bas.getTime() + n * 86400_000); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }); };

// Mallarna med flera ordinationer i demon. Varje post är ett läkemedel ur katalogen med det som avviker från
// produktens mall (ordinationsmallar.js). vidHandelse är antal timmar före vårdhändelsen. Mallarna är fastställda av
// en läkare på vårdenheten (Gröna häftet, avsnitt 1.4.3).
export const PAKET = [
  { id: 'elkonvertering', namn: 'Inför elkonvertering', enhet: 'uso-kard', vardhandelse: 'Elkonvertering', av: 'ol-kard',
    beskrivning: 'Läkemedel inför och efter en planerad elkonvertering: sömnmedel kvällen före, paracetamol före ingreppet och morfin vid smärta efteråt.',
    poster: [
      { lakemedelId: 'VK-NPL-0044', orsak: 'Sömn natten före elkonvertering', uppfoljning: 3 },
      { lakemedelId: 'VK-NPL-0026', dosering: '2 tabletter 1 timme före elkonverteringen', dos: 1000, dosEnhet: 'mg', typ: 'tillfallig', vidHandelse: 1, orsak: 'Smärtlindring inför elkonvertering', uppfoljning: 3 },
      { lakemedelId: 'VK-NPL-0031', orsak: 'Smärta efter elkonvertering', uppfoljning: 3 },
    ] },
  { id: 'postoperativ-ortopedi', namn: 'Efter ortopedisk operation', enhet: 'uso-ort', vardhandelse: 'Operation', av: 'lak-ort',
    beskrivning: 'Tromboprofylax och smärtlindring efter en ortopedisk operation.',
    poster: [
      { lakemedelId: 'VK-NPL-0005', orsak: 'Tromboprofylax efter operation', uppfoljning: 7 },
      { lakemedelId: 'VK-NPL-0026', dosering: '2 tabletter 4 gånger dagligen', dos: 1000, dosEnhet: 'mg', tider: ['08', '14', '20', '02'], typ: 'tillfallig', orsak: 'Smärtlindring efter operation', uppfoljning: 5 },
      { lakemedelId: 'VK-NPL-0030', dosering: '1 kapsel vid behov, minst 4 timmar mellan doserna, högst 4 per dygn', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', orsak: 'Genombrottssmärta efter operation', uppfoljning: 5 },
    ] },
  { id: 'pneumoni', namn: 'Pneumoni, inläggning', enhet: 'uso-inf', vardhandelse: null, av: 'lak-inf',
    beskrivning: 'Intravenöst bensylpenicillin, paracetamol vid feber och tromboprofylax vid inläggning för pneumoni.',
    poster: [
      { lakemedelId: 'VK-NPL-0032', orsak: 'Samhällsförvärvad pneumoni', uppfoljning: 3 },
      { lakemedelId: 'VK-NPL-0026', orsak: 'Feber och smärta', uppfoljning: 5 },
      { lakemedelId: 'VK-NPL-0005', orsak: 'Tromboprofylax vid inläggning', uppfoljning: 7 },
    ] },
];

// De generella direktiven i demon, fastställda av en läkare på vårdenheten (HSLF-FS 2017:37 6 kap. 6 §, Gröna häftet).
// enhet kan vara vårdenheten eller en avdelning under den, så att direktivet kan anpassas på olika nivåer.
export const DIREKTIV = [
  { enhet: 'uso-kard', lakemedelId: 'VK-NPL-0026', av: 'ol-kard', innehall: {
    indikation: 'Feber eller lätt till måttlig smärta', dosering: '2 tabletter vid behov, minst 4 timmar mellan doserna, högst 3 gånger per dygn', dos: 1000, dosEnhet: 'mg',
    administrationssatt: 'peroralt', maxPerDygn: 3, minstaIntervallTimmar: 4, maxTillfallen: 3, maxdosText: 'Högst 3 gram per dygn',
    kontraindikationer: [{ typ: 'alder_under', ar: 18, text: 'Patienten är under 18 år' }, { typ: 'bekrafta', text: 'Känd leversvikt' }] } },
  { enhet: 'uso-kard-72', lakemedelId: 'VK-NPL-0017', av: 'ol-kard', innehall: {
    indikation: 'Bröstsmärta vid känd kärlkramp', dosering: '1 dos under tungan vid bröstsmärta, minst 5 minuter mellan doserna, högst 3 gånger per dygn', dos: 0.4, dosEnhet: 'mg',
    administrationssatt: 'sublingualt', maxPerDygn: 3, minstaIntervallTimmar: 0.08, maxTillfallen: 3, maxdosText: 'Högst 3 doser, kontakta läkare om smärtan kvarstår',
    kontraindikationer: [{ typ: 'systoliskt_under', varde: 90, text: 'Systoliskt blodtryck under 90 mmHg' }, { typ: 'bekrafta', text: 'Potensläkemedel det senaste dygnet' }] } },
  { enhet: 'uso-kard', lakemedelId: 'VK-NPL-0044', av: 'ol-kard', innehall: {
    indikation: 'Tillfälliga sömnsvårigheter under vårdtiden', dosering: '1 tablett till natten vid behov, högst 1 gång per dygn', dos: 5, dosEnhet: 'mg',
    administrationssatt: 'peroralt', maxPerDygn: 1, minstaIntervallTimmar: 20, maxTillfallen: 1, maxdosText: 'Högst 1 tablett per dygn',
    kontraindikationer: [{ typ: 'alder_fran', ar: 75, text: 'Patienten är 75 år eller äldre (ökad risk för fall)' }, { typ: 'bekrafta', text: 'Sömnapné eller svår andningssvikt' }] } },
  { enhet: 'uso-akut', lakemedelId: 'VK-NPL-0031', av: 'lak-akut', innehall: {
    indikation: 'Svår smärta i väntan på läkarbedömning', dosering: '2,5 mg intravenöst vid behov, späds till 1 mg/ml, minst 15 minuter mellan doserna, högst 2 gånger per dygn', dos: 2.5, dosEnhet: 'mg',
    administrationssatt: 'intravenost', maxPerDygn: 2, minstaIntervallTimmar: 0.25, maxTillfallen: 2, maxdosText: 'Högst 5 mg utan läkarkontakt',
    spadning: { losning: 'natriumklorid 9 mg/ml', koncentration: 1 },
    kontraindikationer: [{ typ: 'alder_under', ar: 18, text: 'Patienten är under 18 år' }, { typ: 'bekrafta', text: 'Andningsfrekvens under 10 per minut eller sänkt medvetandegrad' }] } },
];

// Seed: katalogens förpackningar, de andra läkemedelstyperna, mallarna, direktiven och en generell licens för
// tiaminet på kardiologen som går ut om 20 dagar, så att bevakningen syns i inkorgen. När mallen byggs (ny) får
// patient 4 dessutom melatonin vid behov från kardiologen vars uppföljning har passerat, så att bevakningen av
// uppföljningar syns i läkarens inkorg.
export function seedaLakemedelsstod(db, bas = new Date(), { ny = false } = {}) {
  sakraLakemedelsstod(db);
  const finns = (sql, ...p) => Boolean(db.query(sql).get(...p));
  const insF = db.query('INSERT OR IGNORE INTO forpackningar (nplpackid, lakemedel_id, text, forval) VALUES (?, ?, ?, ?)');
  for (const f of FORPACKNINGAR) insF.run(f.nplpackid, f.lakemedelId, f.text, f.forval ? 1 : 0);
  for (const p of PRODUKTER) {
    if (!finns('SELECT 1 FROM katalog WHERE id = ?', p.id)) db.query('INSERT INTO katalog VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, p.namn, p.substans, p.styrka, p.form, p.atc, null);
    db.query('INSERT OR IGNORE INTO produkttyper (lakemedel_id, typ, kcal_per_ml, beskrivning) VALUES (?, ?, ?, ?)').run(p.id, p.typ, p.kcalPerMl ?? null, p.beskrivning);
  }
  const t = new Date(bas.getTime() - 40 * 86400_000).toISOString();
  for (const p of PAKET) {
    db.query(`INSERT OR IGNORE INTO ordinationspaket (id, namn, enhet_id, vardhandelse, beskrivning, innehall, faststallt_av, faststallt, giltigt_till)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, p.namn, p.enhet, p.vardhandelse, p.beskrivning, JSON.stringify(p.poster), p.av, t, dagPlus(bas, 325));
  }
  if (!finns('SELECT 1 FROM generella_direktiv')) {
    for (const d of DIREKTIV) {
      db.query('INSERT INTO generella_direktiv (enhet_id, lakemedel_id, innehall, giltigt_fran, giltigt_till, faststallt_av, faststallt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(d.enhet, d.lakemedelId, JSON.stringify(d.innehall), dagPlus(bas, -40), dagPlus(bas, 325), d.av, t);
    }
  }
  if (ny) {
    // Ordinationen knyts till patientens pågående vårdkontakt på kardiologen, som all annan vårdinformation i seeden.
    const vk = db.query("SELECT id, start FROM vardkontakter WHERE patient_id = 'p04' AND typ = 'slutenvard' AND slut IS NULL ORDER BY start").get();
    const start = vk ? new Date(Math.max(Date.parse(vk.start), bas.getTime() - 20 * 86400_000) + 3600_000).toISOString() : new Date(bas.getTime() - 20 * 86400_000).toISOString();
    const startDag = new Date(start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const r = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, ordinerad_av, skapad, nll_status, vardkontakt_id)
      VALUES ('p04', 'uso-kard-72', 'VK-NPL-0045', '1 tablett 1 timme före sänggåendet vid behov', 2, 'mg', '[]', 1, 'vid_behov', 'Insomningssvårigheter under vårdtiden', ?, ?, 'lak-kard', ?, 'kvitterad', ?)`)
      .run(startDag < dagPlus(bas, -2) ? dagPlus(bas, -2) : startDag, startDag, start, vk?.id ?? null);
    const id = Number(r.lastInsertRowid);
    db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(id, start, 'lak-kard', 'Ordinerad', '1 tablett 1 timme före sänggåendet vid behov');
    db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, 'ny', ?, 'kvitterad', ?, 'NLL-009001', 1)").run(id, start, start);
  }
  if (!finns('SELECT 1 FROM licenser')) {
    db.query('INSERT INTO licenser (lakemedel_id, patient_id, enhet_id, licensnummer, giltig_fran, giltig_till, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('VK-LIC-0001', null, 'uso-kard', 'DEMO-LIC-0001', dagPlus(bas, -345), dagPlus(bas, 20), t);
  }
}
