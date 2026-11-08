// Runda 9, r1: tabellerna för beredning med kontroll och etikett, patientnära skanning och gas som läkemedel
// (beredning.js). Allt är IF NOT EXISTS, så att en äldre sandlåda får tabellerna när den läses in. Modulen beror inte på
// db.js.
export const SCHEMA_BEREDNING = `
-- Beredningen av en iordningsställd dos (Sussa 3.5.1.4 och 3.5.2.17): den som späder registrerar beredningen, och när
-- systemet kräver det kontrollerar en annan sjuksköterska eller läkare den innan dosen ges. underlag är JSON med det
-- som systemet räknade fram ur ordinationen (lösning, volym, koncentration, tillsatser och hastighet). Bara kontrollen
-- fylls i efteråt, en gång. En beredning raderas aldrig.
CREATE TABLE IF NOT EXISTS beredningar (
  id INTEGER PRIMARY KEY, administrering_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, ordination_id INTEGER NOT NULL,
  underlag TEXT NOT NULL, batch TEXT NOT NULL, utgang TEXT, hallbar_till TEXT NOT NULL, beredd_av TEXT NOT NULL, beredd_tid TEXT NOT NULL,
  kontroll_kravs INTEGER NOT NULL, kontroll_varfor TEXT, kontrollerad_av TEXT, kontrollerad_tid TEXT,
  CHECK (kontrollerad_av IS NULL OR kontrollerad_av <> beredd_av)
);
CREATE INDEX IF NOT EXISTS ix_beredningar_patient ON beredningar (patient_id);
CREATE TRIGGER IF NOT EXISTS beredningar_raderas_ej BEFORE DELETE ON beredningar
  BEGIN SELECT RAISE(ABORT, 'En beredning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS beredningar_andras_ej BEFORE UPDATE ON beredningar
  WHEN OLD.kontrollerad_tid IS NOT NULL OR NEW.administrering_id IS NOT OLD.administrering_id OR NEW.patient_id IS NOT OLD.patient_id
    OR NEW.enhet_id IS NOT OLD.enhet_id OR NEW.ordination_id IS NOT OLD.ordination_id OR NEW.underlag IS NOT OLD.underlag OR NEW.batch IS NOT OLD.batch
    OR NEW.utgang IS NOT OLD.utgang OR NEW.hallbar_till IS NOT OLD.hallbar_till OR NEW.beredd_av IS NOT OLD.beredd_av OR NEW.beredd_tid IS NOT OLD.beredd_tid
    OR NEW.kontroll_kravs IS NOT OLD.kontroll_kravs
  BEGIN SELECT RAISE(ABORT, 'En beredning ändras inte, den kontrolleras en gång'); END;

-- Patientnära skanning (3.5.2.18): etiketten och patientens armband som skannades när dosen gavs.
CREATE TABLE IF NOT EXISTS administrering_skanning (
  administrering_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, etikett TEXT NOT NULL, armband TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS administrering_skanning_raderas_ej BEFORE DELETE ON administrering_skanning
  BEGIN SELECT RAISE(ABORT, 'En skanning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS administrering_skanning_andras_ej BEFORE UPDATE OF etikett, armband, tid, av, administrering_id ON administrering_skanning
  BEGIN SELECT RAISE(ABORT, 'En skanning ändras inte'); END;

-- Gas som läkemedel (3.5.2.17): utrustningen och målet för saturationen i en ordination av syrgas. Flödet är dosen i
-- liter per minut.
CREATE TABLE IF NOT EXISTS ordination_gas (
  ordination_id INTEGER PRIMARY KEY, utrustning TEXT NOT NULL, mal_min INTEGER NOT NULL, mal_max INTEGER NOT NULL,
  CHECK (mal_min < mal_max)
);
CREATE TRIGGER IF NOT EXISTS ordination_gas_raderas_ej BEFORE DELETE ON ordination_gas
  BEGIN SELECT RAISE(ABORT, 'Gasens utrustning i en ordination raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS ordination_gas_andras_ej BEFORE UPDATE OF utrustning, mal_min, mal_max ON ordination_gas
  BEGIN SELECT RAISE(ABORT, 'Gasens utrustning i en ordination ändras inte'); END;
`;

// Förbrukningsartiklar (Sussa 3.5.4.1 till 3.5.4.4, forbrukning.js): en rad per förskrivning, som ändras, förnyas, sätts
// ut och sätts in igen i sin egen rad, och en historik där varje händelse finns kvar med vem, var och när. kalla är
// vardkallan eller extern (en förskrivning från en annan förskrivare som registreras). Inget raderas.
export const SCHEMA_FORBRUKNING = `
CREATE TABLE IF NOT EXISTS forbrukningsforskrivningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, artikel_id TEXT NOT NULL, grupp TEXT NOT NULL,
  forpackningar INTEGER NOT NULL, uttag INTEGER NOT NULL, anvisning TEXT NOT NULL, orsak TEXT, giltig_till TEXT NOT NULL, uppfoljning TEXT NOT NULL,
  ansvarig TEXT NOT NULL, status TEXT NOT NULL, nll_status TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'vardkallan', extern_forskrivare TEXT, mall_id TEXT,
  skapad TEXT NOT NULL, forskriven_av TEXT NOT NULL, utsatt_tid TEXT, utsatt_av TEXT, utsatt_orsak TEXT,
  CHECK (status IN ('aktiv', 'utsatt')), CHECK (grupp IN ('egenkontroll', 'tillforsel', 'stomi')),
  CHECK (status <> 'utsatt' OR length(trim(coalesce(utsatt_orsak, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS ix_forbrukning_patient ON forbrukningsforskrivningar (patient_id);
CREATE TRIGGER IF NOT EXISTS forbrukningsforskrivningar_raderas_ej BEFORE DELETE ON forbrukningsforskrivningar
  BEGIN SELECT RAISE(ABORT, 'En förskrivning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS forbrukningsforskrivningar_andras_ej BEFORE UPDATE OF patient_id, enhet_id, artikel_id, grupp, kalla, extern_forskrivare, skapad, forskriven_av ON forbrukningsforskrivningar
  BEGIN SELECT RAISE(ABORT, 'Vem som förskrev vad och var ändras inte'); END;
CREATE TABLE IF NOT EXISTS forbrukning_historik (
  id INTEGER PRIMARY KEY, forskrivning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, handelse TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, detalj TEXT
);
CREATE INDEX IF NOT EXISTS ix_forbrukning_historik ON forbrukning_historik (forskrivning_id);
CREATE TRIGGER IF NOT EXISTS forbrukning_historik_raderas_ej BEFORE DELETE ON forbrukning_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS forbrukning_historik_andras_ej BEFORE UPDATE ON forbrukning_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken ändras inte'); END;
`;

// Egenadministrering i slutenvården (Sussa 3.5.2.12, egenadministrering.js): ordinationer som patienten själv sköter,
// och patientens intag som sjuksköterskan kvitterar per dostid. Inget ändras eller raderas.
export const SCHEMA_EGEN = `
CREATE TABLE IF NOT EXISTS egenadministreringar (ordination_id INTEGER PRIMARY KEY, beslutad TEXT NOT NULL, beslutad_av TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS egenadministreringar_raderas_ej BEFORE DELETE ON egenadministreringar
  BEGIN SELECT RAISE(ABORT, 'Beslutet om egenadministrering raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS egenadministreringar_andras_ej BEFORE UPDATE ON egenadministreringar
  BEGIN SELECT RAISE(ABORT, 'Beslutet om egenadministrering ändras inte'); END;
CREATE TABLE IF NOT EXISTS egenintag (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, ordination_id INTEGER NOT NULL, planerad TEXT, tagen INTEGER NOT NULL,
  orsak TEXT, tid TEXT NOT NULL, kvitterad_av TEXT NOT NULL, registrerad TEXT NOT NULL,
  CHECK (tagen = 1 OR length(trim(coalesce(orsak, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS ix_egenintag_patient ON egenintag (patient_id);
CREATE TRIGGER IF NOT EXISTS egenintag_raderas_ej BEFORE DELETE ON egenintag BEGIN SELECT RAISE(ABORT, 'Ett kvitterat intag raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS egenintag_andras_ej BEFORE UPDATE OF ordination_id, planerad, tagen, orsak, tid, kvitterad_av, registrerad ON egenintag
  BEGIN SELECT RAISE(ABORT, 'Ett kvitterat intag ändras inte'); END;
`;

// Beställningar av extempore, licens och blodprodukter (Sussa 3.5.2.4, lakemedelsbestallning.js) från de simulerade
// externa parterna, med status och händelser. Bara status, svar och licensen ändras, och inget raderas.
export const SCHEMA_BESTALLNING = `
CREATE TABLE IF NOT EXISTS lakemedelsbestallningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, lakemedel_id TEXT NOT NULL, ordination_id INTEGER,
  mangd TEXT NOT NULL, motivering TEXT, status TEXT NOT NULL, svar TEXT, licens_id INTEGER, skapad TEXT NOT NULL, av TEXT NOT NULL,
  CHECK (typ IN ('extempore', 'licens', 'blod'))
);
CREATE TRIGGER IF NOT EXISTS lakemedelsbestallningar_raderas_ej BEFORE DELETE ON lakemedelsbestallningar
  BEGIN SELECT RAISE(ABORT, 'En beställning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS lakemedelsbestallningar_andras_ej BEFORE UPDATE OF patient_id, enhet_id, typ, lakemedel_id, ordination_id, mangd, motivering, skapad, av ON lakemedelsbestallningar
  BEGIN SELECT RAISE(ABORT, 'En beställning ändras inte, bara dess status'); END;
CREATE TABLE IF NOT EXISTS lakemedelsbestallning_handelser (id INTEGER PRIMARY KEY, lakemedelsbestallning_id INTEGER NOT NULL, status TEXT NOT NULL, tid TEXT NOT NULL, text TEXT);
CREATE TRIGGER IF NOT EXISTS lakemedelsbestallning_handelser_raderas_ej BEFORE DELETE ON lakemedelsbestallning_handelser
  BEGIN SELECT RAISE(ABORT, 'Händelsen raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS lakemedelsbestallning_handelser_andras_ej BEFORE UPDATE ON lakemedelsbestallning_handelser
  BEGIN SELECT RAISE(ABORT, 'Händelsen ändras inte'); END;
`;

// Klinisk läkemedelsprövning (Sussa 3.5.5.1, kliniskprovning.js): prövningarna med prövare, prövningsläkemedel och
// studieprotokollets förbjudna läkemedel, och patienternas deltagande. Ett deltagande avslutas, raderas aldrig.
export const SCHEMA_PROVNING = `
CREATE TABLE IF NOT EXISTS kliniska_provningar (
  id INTEGER PRIMARY KEY, studienummer TEXT NOT NULL UNIQUE, titel TEXT NOT NULL, sponsor TEXT NOT NULL, enhet_id TEXT NOT NULL, ansvarig TEXT NOT NULL,
  provare TEXT NOT NULL, lakemedel_id TEXT NOT NULL, forbjudna TEXT NOT NULL, start TEXT NOT NULL, slut TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studiedeltagande (
  id INTEGER PRIMARY KEY, provning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, inkluderad TEXT NOT NULL, inkluderad_av TEXT NOT NULL,
  randomiseringskod TEXT, avslutad TEXT, avslutad_av TEXT, avslutad_orsak TEXT,
  CHECK (avslutad IS NULL OR length(trim(coalesce(avslutad_orsak, ''))) > 0)
);
CREATE TRIGGER IF NOT EXISTS studiedeltagande_raderas_ej BEFORE DELETE ON studiedeltagande
  BEGIN SELECT RAISE(ABORT, 'Ett studiedeltagande raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS studiedeltagande_andras_ej BEFORE UPDATE OF provning_id, patient_id, enhet_id, inkluderad, inkluderad_av, randomiseringskod ON studiedeltagande
  BEGIN SELECT RAISE(ABORT, 'Ett studiedeltagande ändras inte, det avslutas'); END;
`;

// Generella direktiv på vårdgivarens nivå (Sussa 3.5.2.15, direktiv-vardgivare.js): vem vårdgivaren har utsett att
// fastställa direktiv för alla vårdenheter. enhet_id är vårdgivaren.
export const SCHEMA_VARDGIVARDIREKTIV = `
CREATE TABLE IF NOT EXISTS vardgivarens_lakemedelsuppdrag (id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, fran TEXT NOT NULL, till TEXT NOT NULL, satt TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS vardgivarens_lakemedelsuppdrag_raderas_ej BEFORE DELETE ON vardgivarens_lakemedelsuppdrag
  BEGIN SELECT RAISE(ABORT, 'Ett uppdrag raderas inte'); END;
`;

export function sakraR9r1(db) {
  db.exec(SCHEMA_VARDGIVARDIREKTIV);
  db.exec(SCHEMA_BEREDNING);
  db.exec(SCHEMA_FORBRUKNING);
  db.exec(SCHEMA_EGEN);
  db.exec(SCHEMA_BESTALLNING);
  db.exec(SCHEMA_PROVNING);
}

// Seedens poster för rundan. Läggs in en gång, så att en äldre sandlåda får dem när den läses in.
// Förbrukningsartiklarna: Birgitta Nyman (p06), som tar insulin, har teststickor förskrivna på vårdcentralen och
// lansetter som har gått ut. Läggs in en gång.
export function seedaR9r1(db, bas = new Date()) {
  seedaProvning(db, bas);
  seedaVardgivardirektiv(db, bas);
  if (db.query('SELECT 1 FROM forbrukningsforskrivningar LIMIT 1').get()) return;
  if (!db.query("SELECT 1 FROM patienter WHERE id = 'p06'").get() || !db.query("SELECT 1 FROM personal WHERE id = 'lak-vc'").get()) return;
  const dag = (n) => new Date(bas.getTime() + n * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const tid = (n) => new Date(bas.getTime() + n * 86400_000).toISOString();
  const ins = db.query(`INSERT INTO forbrukningsforskrivningar (patient_id, enhet_id, artikel_id, grupp, forpackningar, uttag, anvisning, orsak, giltig_till, uppfoljning, ansvarig,
    status, nll_status, skapad, forskriven_av) VALUES ('p06', 'vc-tybble', ?, 'egenkontroll', ?, 4, ?, 'Diabetes typ 2', ?, ?, 'lak-vc', 'aktiv', 'kvitterad', ?, 'lak-vc') RETURNING id`);
  const hist = db.query("INSERT INTO forbrukning_historik (forskrivning_id, patient_id, enhet_id, handelse, tid, av, detalj) VALUES (?, 'p06', 'vc-tybble', ?, ?, 'lak-vc', ?)");
  const a = ins.get('VK-FA-0001', 2, 'Till egenkontroll av blodsockret enligt överenskommelse med diabetesmottagningen.', dag(200), dag(170), tid(-165)).id;
  hist.run(a, 'forskriven', tid(-165), '2 förpackningar, 4 uttag');
  const b = ins.get('VK-FA-0002', 1, 'Till provtagning i fingret vid egenkontroll av blodsockret.', dag(-20), dag(-50), tid(-385)).id;
  hist.run(b, 'forskriven', tid(-385), '1 förpackning, 4 uttag');
}

// En påhittad prövning på Kardiologiska kliniken, med överläkaren som ansvarig prövare och läkaren som prövare. Läggs in
// en gång, och utan deltagare.
function seedaProvning(db, bas) {
  if (db.query('SELECT 1 FROM kliniska_provningar LIMIT 1').get()) return;
  if (!db.query("SELECT 1 FROM enheter WHERE id = 'uso-kard'").get() || !db.query("SELECT 1 FROM katalog WHERE id = 'VK-EGEN-0004'").get()) return;
  const dag = (n) => new Date(bas.getTime() + n * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  db.query(`INSERT INTO kliniska_provningar (studienummer, titel, sponsor, enhet_id, ansvarig, provare, lakemedel_id, forbjudna, start, slut)
    VALUES ('DEMO-HF-01', 'Påhittad studie av ett prövningsläkemedel vid hjärtsvikt', 'Påhittad sponsor (demo)', 'uso-kard', 'ol-kard', ?, 'VK-EGEN-0004', ?, ?, ?)`)
    .run(JSON.stringify(['ol-kard', 'lak-kard']), JSON.stringify([{ atc: 'C03DA', text: 'aldosteronantagonister' }]), dag(-60), dag(300));
}

// Vem vårdgivaren har utsett att fastställa direktiv för hela vårdgivaren (direktiv-vardgivare.js). Läggs in en gång.
function seedaVardgivardirektiv(db, bas) {
  if (db.query('SELECT 1 FROM vardgivarens_lakemedelsuppdrag LIMIT 1').get()) return;
  if (!db.query("SELECT 1 FROM enheter WHERE id = 'rol'").get() || !db.query("SELECT 1 FROM personal WHERE id = 'lak-kard'").get()) return;
  const dag = (n) => new Date(bas.getTime() + n * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  db.query("INSERT INTO vardgivarens_lakemedelsuppdrag (enhet_id, personal_id, fran, till, satt) VALUES ('rol', 'lak-kard', ?, ?, ?)").run(dag(-30), dag(335), bas.toISOString());
}
