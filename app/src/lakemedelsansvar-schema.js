// Ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar (runda 6, r6): schema och seed. Modulen beror inte
// på db.js, så att db.js kan använda den både när mallen byggs och när en äldre sandlåda läses in. Allt är IF NOT EXISTS.
//
// Underlag: Region Örebro läns Ordination och hantering av läkemedel, riktlinjer och rutiner (Gröna häftet),
// dokument 688488 R5, giltigt från 2026-06-08, avsnitt 1.3 till 1.4.5, och HSLF-FS 2017:37 4 kap. 2 § (vårdgivaren
// fastställer rutiner för ordination och hantering av läkemedel).
import { createHash } from 'node:crypto';
import { PERSONAL } from './seed/personal.js';
import { MALLAR } from './seed/substansmallar.js';

// Rader som bara läggs till.
const bestaende = (t, text) => `
CREATE TRIGGER IF NOT EXISTS ${t}_raderas_ej BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_andras_ej BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, '${text} ändras inte'); END;`;

export const SCHEMA_LAKEMEDELSANSVAR = `
-- Vårdenhetens verksamhetschef. Verksamhetschefens samlade ledningsansvar för ordination och hantering av läkemedel kan
-- inte överlåtas (Gröna häftet 1.3), och är därför inget uppdrag.
CREATE TABLE IF NOT EXISTS verksamhetschefer (enhet_id TEXT PRIMARY KEY, personal_id TEXT NOT NULL);

-- Uppdrag i läkemedelshanteringen för en vårdenhet, med start och slut. omfattning är JSON med uppgifterna ur
-- ansvarsdokumentet. Ett uppdrag ändras aldrig och raderas aldrig: det avslutas, med vem, när och orsak. avslutat är
-- den dag från vilken uppdraget inte längre gäller.
CREATE TABLE IF NOT EXISTS lakemedelsuppdrag (
  id INTEGER PRIMARY KEY, typ TEXT NOT NULL, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, reserv INTEGER NOT NULL DEFAULT 0,
  omfattning TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL, satt_av TEXT, satt TEXT NOT NULL,
  avslutat TEXT, avslutat_av TEXT, avslutat_tid TEXT, avslutat_orsak TEXT,
  CHECK (typ IN ('medicinskt_ansvarig', 'mallansvarig', 'lakemedelsansvarig_ssk', 'narkotikakontroll')), CHECK (till >= fran)
);
CREATE TRIGGER IF NOT EXISTS lakemedelsuppdrag_raderas_ej BEFORE DELETE ON lakemedelsuppdrag
  BEGIN SELECT RAISE(ABORT, 'Ett uppdrag raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS lakemedelsuppdrag_andras_ej BEFORE UPDATE ON lakemedelsuppdrag
  WHEN OLD.avslutat IS NOT NULL OR NEW.id IS NOT OLD.id OR NEW.typ IS NOT OLD.typ OR NEW.enhet_id IS NOT OLD.enhet_id
    OR NEW.personal_id IS NOT OLD.personal_id OR NEW.reserv IS NOT OLD.reserv OR NEW.omfattning IS NOT OLD.omfattning
    OR NEW.fran IS NOT OLD.fran OR NEW.till IS NOT OLD.till OR NEW.satt_av IS NOT OLD.satt_av OR NEW.satt IS NOT OLD.satt
  BEGIN SELECT RAISE(ABORT, 'Ett uppdrag ändras inte, det avslutas'); END;

-- Verksamhetschefens genomgång av ansvarsdokumentet (Gröna häftet 1.3: revidering minst en gång per år).
CREATE TABLE IF NOT EXISTS ansvarsdokument_oversyn (id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, tid TEXT NOT NULL, anteckning TEXT);
${bestaende('ansvarsdokument_oversyn', 'En genomgång av ansvarsdokumentet')}

-- Läkemedelsmallar per substans med versioner. En ändrad mall är en ny version, och den gamla finns kvar.
CREATE TABLE IF NOT EXISTS substansmallar (
  id INTEGER PRIMARY KEY, atc TEXT NOT NULL, namn TEXT NOT NULL, innehall TEXT NOT NULL, version INTEGER NOT NULL,
  upprattad_av TEXT, upprattad TEXT NOT NULL, andring TEXT, UNIQUE (atc, version)
);
${bestaende('substansmallar', 'En version av en läkemedelsmall')}

-- En ny version av en mall med flera ordinationer ersätter en tidigare (ordinationspaket i lakemedelsstod-schema.js).
CREATE TABLE IF NOT EXISTS paketversioner (paket_id TEXT PRIMARY KEY, ersatter TEXT NOT NULL, andring TEXT NOT NULL);
${bestaende('paketversioner', 'En version av en mall')}

-- Godkännanden av det medicinska innehållet i en mall, av mallansvarig läkare på vårdenheten (Gröna häftet 1.4.3).
-- innehall är mallens innehåll när den godkändes, så att historiken visar exakt vad som godkändes.
CREATE TABLE IF NOT EXISTS mallgodkannanden (
  id INTEGER PRIMARY KEY, mall_typ TEXT NOT NULL, mall_id TEXT NOT NULL, enhet_id TEXT NOT NULL, godkand_av TEXT NOT NULL,
  godkand TEXT NOT NULL, uppdrag_id INTEGER, innehall TEXT NOT NULL, CHECK (mall_typ IN ('substans', 'paket'))
);
${bestaende('mallgodkannanden', 'Ett godkännande av en mall')}
`;

export const versionAv = (innehall) => createHash('sha256').update(typeof innehall === 'string' ? innehall : JSON.stringify(innehall)).digest('hex').slice(0, 12);

const dagPlus = (bas, n) => new Date(bas.getTime() + n * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const tidPlus = (bas, n) => new Date(bas.getTime() + n * 86400_000).toISOString();

// Uppgifterna i ansvarsdokumentet, ur Gröna häftet. Systemet skriver in dem när uppdraget utses, så att ingen behöver
// skriva dem själv. Hör här, så att seeden och lakemedelsansvar.js använder samma text.
export const OMFATTNING = {
  medicinskt_ansvarig: [
    'Initiera framtagande och revidering av lokala rutiner för ordination av läkemedel.',
    'Upprätta, revidera och fastställa bassortimentet tillsammans med läkemedelsansvarig sjuksköterska och farmaceut.',
    'Utarbeta medicinska anvisningar om läkemedelsbehandling och spädningsinstruktioner.',
    'Lokalanpassa och fastställa generella direktiv och se till att de uppdateras minst en gång om året.',
    'Fastställa vilka läkemedel som får bytas ut mot likvärdiga vid iordningställande och administrering.',
    'Introducera nyanställda läkare och informera enhetens läkare om riktlinjer, rutiner, nya behandlingsrutiner och kliniska prövningar.',
    'Följa utvecklingen och bedriva systematiskt kvalitetsarbete tillsammans med enhetschefen, och vid behov delta i extern kvalitetsgranskning.',
    'Besluta om läkemedel som väntar på en avbokad vårdhändelse när den läkare som ordinerade inte längre finns på vårdenheten.',
  ],
  mallansvarig: [
    'Granska och godkänna det medicinska innehållet i vårdenhetens läkemedelsmallar och mallar med flera ordinationer, också varje ändrad version.',
    'Samarbeta med farmaceut som står för förvaltningen och den farmaceutiska kvalitetskontrollen av mallarna.',
  ],
  lakemedelsansvarig_ssk: [
    'Medverka till att utarbeta lokala rutiner för den praktiska läkemedelshanteringen.',
    'Upprätta och revidera bassortimentet tillsammans med medicinskt ansvarig läkare och farmaceut.',
    'Ha huvudansvaret för rekvisition (beställning) av läkemedel på vårdenheten.',
    'Förmedla information om läkemedelshantering till berörd personal och delta i extern kvalitetsgranskning.',
    'Säkerställa ordningen i läkemedelsförrådet, att indragningar, restnoteringar och leveranser tas om hand, att narkotiska läkemedel hanteras enligt enhetens rutiner och att kassation sker på rätt sätt.',
  ],
  narkotikakontroll: [
    'Utföra och dokumentera kontrollerna av förbrukningen av narkotiska läkemedel enligt enhetens rutiner.',
    'Säkerställa att avvikelser och svinn av narkotiska läkemedel hanteras och rapporteras enligt enhetens rutiner.',
    'Får inte ha behörighet att beställa narkotiska läkemedel.',
  ],
};

// Version 2 av mallen Inför elkonvertering, som väntar på godkännande i seeden: paracetamol två timmar före ingreppet i
// stället för en, så att effekten hinner komma.
const ELKONVERTERING_V2 = {
  id: 'elkonvertering-v2', ersatter: 'elkonvertering', av: 'ol-kard',
  andring: 'Alvedon ges 2 timmar före elkonverteringen i stället för 1 timme, så att den smärtlindrande effekten hinner komma.',
};

export function sakraLakemedelsansvar(db) {
  db.exec(SCHEMA_LAKEMEDELSANSVAR);
  // Personal som tillkom med runda 6, r6 (verksamhetschefen) läggs in i en äldre sandlåda med samma HSA-id som i mallen.
  const ins = db.query('INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  PERSONAL.forEach((p, i) => { if (p.r6) ins.run(p.id, p.namn, p.yrke, p.titel, p.enhet, `SE2321000164-VKP${String(i + 1).padStart(3, '0')}`, p.demo ? 1 : 0, 1); });
}

// Seed. Kardiologen har en verksamhetschef (demorollen vch-kard). Uppdraget som medicinskt ansvarig läkare för Göran
// Malm gick ut för fem dagar sedan, så att påminnelsen syns. Sara Lindqvist är mallansvarig, Johan Ek
// läkemedelsansvarig sjuksköterska och Lina Persson kontrollant av narkotiska läkemedel, utan reserv. Ansvarsdokumentet
// gicks senast igenom för 400 dagar sedan. Andra vårdenheter har en mallansvarig och en medicinskt ansvarig läkare ur
// demons grunddata, utan verksamhetschef. Varje läkemedelsmall är godkänd på varje vårdenhet med läkare, och en ändrad
// version av mallen Inför elkonvertering väntar på godkännande.
export function seedaLakemedelsansvar(db, bas = new Date()) {
  sakraLakemedelsansvar(db);
  const finns = (sql, ...p) => Boolean(db.query(sql).get(...p));
  if (!finns('SELECT 1 FROM verksamhetschefer')) db.query("INSERT INTO verksamhetschefer VALUES ('uso-kard', 'vch-kard')").run();
  const insM = db.query('INSERT OR IGNORE INTO substansmallar (atc, namn, innehall, version, upprattad_av, upprattad, andring) VALUES (?, ?, ?, 1, NULL, ?, NULL)');
  for (const [atc, m] of Object.entries(MALLAR)) insM.run(atc, m.namn, JSON.stringify(m), tidPlus(bas, -400));
  if (finns('SELECT 1 FROM lakemedelsuppdrag')) return;

  const insU = db.query('INSERT INTO lakemedelsuppdrag (typ, enhet_id, personal_id, reserv, omfattning, fran, till, satt_av, satt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const uppdrag = (typ, enhet, person, fran, till, av, reserv = 0) => Number(insU.run(typ, enhet, person, reserv, JSON.stringify(OMFATTNING[typ]), dagPlus(bas, fran), dagPlus(bas, till), av, tidPlus(bas, fran)).lastInsertRowid);
  const godkannare = new Map();
  uppdrag('medicinskt_ansvarig', 'uso-kard', 'ol-kard', -400, -6, 'vch-kard');
  godkannare.set('uso-kard', { av: 'lak-kard', uppdrag: uppdrag('mallansvarig', 'uso-kard', 'lak-kard', -400, 330, 'vch-kard') });
  uppdrag('lakemedelsansvarig_ssk', 'uso-kard', 'ssk-kard', -400, 330, 'vch-kard');
  if (finns("SELECT 1 FROM personal WHERE id = 'ssk-kardmott'")) uppdrag('narkotikakontroll', 'uso-kard', 'ssk-kardmott', -400, 330, 'vch-kard');
  db.query('INSERT INTO ansvarsdokument_oversyn (enhet_id, personal_id, tid, anteckning) VALUES (?, ?, ?, ?)').run('uso-kard', 'vch-kard', tidPlus(bas, -400), 'Ansvarsdokumentet fastställt.');

  // Andra vårdenheter med läkare: den första läkaren som inte är underläkare får båda läkaruppdragen ur grunddatan.
  const vardenheter = db.query("SELECT id FROM enheter WHERE typ = 'vardenhet' AND id <> 'uso-kard' ORDER BY rowid").all().map(r => r.id);
  for (const ve of vardenheter) {
    const l = db.query(`SELECT p.id FROM personal p JOIN enheter e ON e.id = p.enhet_id WHERE p.yrke = 'lakare' AND p.aktiv = 1 AND coalesce(p.titel, '') NOT LIKE 'Underläkare%'
      AND (e.id = ? OR (e.typ = 'arbetsplats' AND e.forald_id = ?)) ORDER BY p.rowid LIMIT 1`).get(ve, ve);
    if (!l) continue;
    uppdrag('medicinskt_ansvarig', ve, l.id, -400, 330, null);
    godkannare.set(ve, { av: l.id, uppdrag: uppdrag('mallansvarig', ve, l.id, -400, 330, null) });
  }

  // Godkännandena: varje läkemedelsmall per substans på varje vårdenhet med mallansvarig, och varje mall med flera
  // ordinationer på sin vårdenhet.
  const insG = db.query('INSERT INTO mallgodkannanden (mall_typ, mall_id, enhet_id, godkand_av, godkand, uppdrag_id, innehall) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const t = tidPlus(bas, -399);
  for (const m of db.query('SELECT * FROM substansmallar WHERE version = 1').all()) {
    for (const [ve, g] of godkannare) insG.run('substans', String(m.id), ve, g.av, t, g.uppdrag, m.innehall);
  }
  for (const p of db.query('SELECT * FROM ordinationspaket').all()) {
    const ve = db.query("SELECT CASE WHEN typ = 'arbetsplats' THEN forald_id ELSE id END AS ve FROM enheter WHERE id = ?").get(p.enhet_id)?.ve ?? p.enhet_id;
    const g = godkannare.get(ve);
    if (g) insG.run('paket', p.id, ve, g.av, tidPlus(bas, -39), g.uppdrag, p.innehall);
  }

  // Den ändrade versionen av Inför elkonvertering, upprättad av Göran Malm för två dagar sedan.
  const v1 = db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(ELKONVERTERING_V2.ersatter);
  if (v1 && !finns('SELECT 1 FROM ordinationspaket WHERE id = ?', ELKONVERTERING_V2.id)) {
    const poster = JSON.parse(v1.innehall).map(x => (x.lakemedelId === 'VK-NPL-0026' ? { ...x, dosering: '2 tabletter 2 timmar före elkonverteringen', vidHandelse: 2 } : x));
    db.query(`INSERT INTO ordinationspaket (id, namn, enhet_id, vardhandelse, beskrivning, innehall, faststallt_av, faststallt, giltigt_till) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ELKONVERTERING_V2.id, v1.namn, v1.enhet_id, v1.vardhandelse, v1.beskrivning, JSON.stringify(poster), ELKONVERTERING_V2.av, tidPlus(bas, -2), dagPlus(bas, 363));
    db.query('INSERT INTO paketversioner (paket_id, ersatter, andring) VALUES (?, ?, ?)').run(ELKONVERTERING_V2.id, ELKONVERTERING_V2.ersatter, ELKONVERTERING_V2.andring);
  }
}
