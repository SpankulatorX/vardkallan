// Utskrifter, utlämnanden, kontrasignering, arkivbeslut och datauttag i databasen (Sussa 3.1.9, 3.1.11.3, 5.4.2,
// 5.3.1.7 och 6.3.1): schemat, triggrarna och seeden. Modulen beror inte på db.js, så att db.js kan använda den både när
// mallen byggs och när en äldre sandlåda läses in.
//
// Allt här är spårbarhet och kan inte ändras i efterhand. En utskrift ändras och raderas aldrig. Ett utlämnande får
// bara fyllas i med återlämnandet, en gång. En begäran om kontrasignering får bara gå från begärd till kontrasignerad.
// Ett arkivbeslut får bara fyllas i med verkställandet, en gång. Raderingen av journalhandlingar efter ett beslut
// (arkiv.js) är det enda sätt som journalens triggrar släpps på, och den rör aldrig åtkomstloggen.

// Kolumnerna per tabell, för triggrarna. En kolumn som inte får ändras ska ha samma värde före och efter.
const KOLUMNER = {
  utskrifter: ['id', 'patient_id', 'personal_id', 'enhet_id', 'tid', 'syfte', 'delar', 'utelamnat', 'avidentifierad', 'poster', 'innehall_hash', 'grund'],
  utlamnanden: ['id', 'patient_id', 'enhet_id', 'utskrift_id', 'mottagare', 'beskrivning', 'menprovning', 'utlamnad', 'utlamnad_av', 'aterlamnas_senast', 'aterlamnad', 'aterlamnad_av'],
  kontrasigneringar: ['id', 'patient_id', 'typ', 'post_id', 'enhet_id', 'begard_av', 'begard', 'mottagare_id', 'kommentar', 'status', 'kontrasignerad'],
  arkivbeslut: ['id', 'typ', 'beslutsfattare', 'diarienummer', 'beslutsdatum', 'lagrum', 'patient_id', 'omfattning', 'motivering', 'registrerad', 'registrerad_av', 'verkstallt', 'verkstallt_av', 'resultat'],
};
const lika = (tabell, utom = []) => KOLUMNER[tabell].filter(k => !utom.includes(k)).map(k => `NEW.${k} IS OLD.${k}`).join(' AND ');
// En sammanslagning av två journaler (identitet.js) flyttar raderna till den gällande journalen. Bara patient_id ändras,
// och bara medan sammanslagningen av just de två journalerna pågår.
const flytt = (tabell) => `(NEW.patient_id IS NOT OLD.patient_id AND ${lika(tabell, ['patient_id'])}
    AND EXISTS (SELECT 1 FROM installningar WHERE nyckel = 'sammanslagning_pagar' AND varde = OLD.patient_id || '>' || NEW.patient_id))`;
const ingenRadering = (tabell) => `CREATE TRIGGER IF NOT EXISTS ${tabell}_raderas_ej BEFORE DELETE ON ${tabell} BEGIN SELECT RAISE(ABORT, 'Raden kan inte raderas'); END;`;
const andras = (tabell, tillatet, text) => `CREATE TRIGGER IF NOT EXISTS ${tabell}_andras_ej BEFORE UPDATE ON ${tabell} WHEN NOT (${tillatet}) AND NOT ${flytt(tabell)}
  BEGIN SELECT RAISE(ABORT, '${text}'); END;`;

export const SCHEMA_UTDATA = `
CREATE TABLE IF NOT EXISTS utskrifter (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, personal_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  syfte TEXT NOT NULL, delar TEXT NOT NULL, utelamnat TEXT NOT NULL, avidentifierad INTEGER NOT NULL DEFAULT 0,
  poster TEXT NOT NULL, innehall_hash TEXT NOT NULL, grund TEXT NOT NULL
);
${andras('utskrifter', '0', 'En utskrift kan inte ändras')}
${ingenRadering('utskrifter')}
CREATE TABLE IF NOT EXISTS utlamnanden (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, utskrift_id TEXT, mottagare TEXT NOT NULL,
  beskrivning TEXT NOT NULL, menprovning TEXT, utlamnad TEXT NOT NULL, utlamnad_av TEXT NOT NULL,
  aterlamnas_senast TEXT, aterlamnad TEXT, aterlamnad_av TEXT
);
${andras('utlamnanden', `OLD.aterlamnad IS NULL AND NEW.aterlamnad IS NOT NULL AND NEW.aterlamnad_av IS NOT NULL AND ${lika('utlamnanden', ['aterlamnad', 'aterlamnad_av'])}`, 'Ett utlämnande kan bara kompletteras med återlämnandet')}
${ingenRadering('utlamnanden')}
CREATE TABLE IF NOT EXISTS kontrasigneringar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, typ TEXT NOT NULL, post_id INTEGER NOT NULL, enhet_id TEXT NOT NULL,
  begard_av TEXT NOT NULL, begard TEXT NOT NULL, mottagare_id TEXT NOT NULL, kommentar TEXT,
  status TEXT NOT NULL DEFAULT 'begard', kontrasignerad TEXT,
  CHECK (typ IN ('anteckning', 'matvarde')), CHECK (status IN ('begard', 'kontrasignerad'))
);
${andras('kontrasigneringar', `OLD.status = 'begard' AND NEW.status = 'kontrasignerad' AND NEW.kontrasignerad IS NOT NULL AND ${lika('kontrasigneringar', ['status', 'kontrasignerad'])}`, 'En kontrasignering kan inte ändras')}
${ingenRadering('kontrasigneringar')}
CREATE INDEX IF NOT EXISTS ix_ks_mottagare ON kontrasigneringar (mottagare_id, status);
CREATE TABLE IF NOT EXISTS arkivbeslut (
  id INTEGER PRIMARY KEY, typ TEXT NOT NULL, beslutsfattare TEXT NOT NULL, diarienummer TEXT NOT NULL, beslutsdatum TEXT NOT NULL,
  lagrum TEXT NOT NULL, patient_id TEXT, omfattning TEXT NOT NULL, motivering TEXT, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL,
  verkstallt TEXT, verkstallt_av TEXT, resultat TEXT,
  CHECK (typ IN ('leverans', 'gallring', 'radering'))
);
${andras('arkivbeslut', `OLD.verkstallt IS NULL AND NEW.verkstallt IS NOT NULL AND NEW.verkstallt_av IS NOT NULL AND ${lika('arkivbeslut', ['verkstallt', 'verkstallt_av', 'resultat'])}`, 'Ett arkivbeslut kan bara kompletteras med verkställandet, en gång')}
${ingenRadering('arkivbeslut')}
CREATE TABLE IF NOT EXISTS arkivexporter (
  id TEXT PRIMARY KEY, beslut_id INTEGER NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, patienter INTEGER NOT NULL,
  filer INTEGER NOT NULL, storlek INTEGER NOT NULL, sha256 TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS arkivexporter_andras_ej BEFORE UPDATE ON arkivexporter BEGIN SELECT RAISE(ABORT, 'Raden kan inte ändras'); END;
${ingenRadering('arkivexporter')}
CREATE TABLE IF NOT EXISTS datauttag (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, data TEXT NOT NULL, antal TEXT NOT NULL, andringar TEXT NOT NULL, utelamnat TEXT NOT NULL
);
`;

// Lägger till det som saknas, också i en sandlåda som sparades före den här delen.
export function sakraUtdataschema(db) {
  db.exec(SCHEMA_UTDATA);
  const kol = db.query('PRAGMA table_info(patienter)').all().map(k => k.name);
  // Beslutet som journalen gallrades eller förstördes enligt. Patientens identitet finns kvar, så att loggen och beslutet
  // går att följa upp.
  if (!kol.includes('journal_forstord')) db.exec('ALTER TABLE patienter ADD COLUMN journal_forstord INTEGER');
}

// Patient 20: en journal som bara har historik från VAS, med den sista uppgiften för mer än tio år sedan. Den kan
// gallras enligt demons gallringsregel (patientdatalagen 3 kap. 17 §: minst tio år efter den sista uppgiften). Läggs in
// före migreringsavstämningen i db.js, så att avstämningen räknar med den. Testpersonnummer från Skatteverket.
export const ARKIVPATIENT = {
  id: 'p20', pnr: '194505124752', fornamn: 'Harald', efternamn: 'Strand', kon: 'man', fodd: '1945-05-12',
  adress: 'Västra Nobelgatan 4', postnr: '702 11', ort: 'Örebro', telefon: '070-174 06 20',
};
export function seedaArkivpatient(db, { tid, datum }) {
  const p = ARKIVPATIENT;
  db.query(`INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, adress, postnr, ort, telefon, kontaktperson, skyddad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`).run(p.id, p.pnr, p.fornamn, p.efternamn, p.kon, p.fodd, p.adress, p.postnr, p.ort, p.telefon);
  const vk = (start, slut, typ, plats, orsak) => Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla) VALUES (?, 'uso-med', ?, ?, ?, ?, ?, 'migrerad:VAS')")
    .run(p.id, typ, tid(start), tid(slut), plats, orsak).lastInsertRowid);
  const inl = vk(['2013-01-14', '16:20'], ['2013-01-21', '11:00'], 'slutenvard', 'Avd 41, sal 3', 'Pneumoni');
  const mott = vk(['2014-02-04', '09:30'], ['2014-02-04', '10:15'], 'oppenvard', 'Medicinmottagningen', 'Uppföljning efter pneumoni');
  const ant = (vkId, typ, t, sokord) => {
    const s = JSON.stringify(Object.entries(sokord).map(([sokord, text]) => ({ sokord, text })));
    const sk = tid(t);
    db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
      VALUES (?, 'uso-med', ?, ?, 'lakare', ?, 'lak-vas', ?, 'signerad', ?, 'lak-vas', 1, 'migrerad:VAS')`).run(p.id, vkId, typ, s, sk, sk);
  };
  ant(inl, 'Inskrivningsanteckning', ['2013-01-14', '17:00'], { Kontaktorsak: 'Feber och hosta sedan fyra dagar.', Status: 'Temp 39,1. Rassel basalt höger.', Bedömning: 'Pneumoni.', Åtgärd: 'Bensylpenicillin intravenöst.' });
  ant(inl, 'Epikris', ['2013-01-21', '10:30'], { 'Orsak till vård': 'Pneumoni.', Förlopp: 'Snabbt bättre på antibiotika.', Uppföljning: 'Lungröntgen och återbesök om sex veckor.' });
  ant(mott, 'Mottagningsanteckning', ['2014-02-04', '10:00'], { Aktuellt: 'Besvärsfri.', Bedömning: 'Utläkt pneumoni. Ingen fortsatt uppföljning.' });
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, 'uso-med', ?, 'J18.9', 'Pneumoni, ospecificerad', 'huvud', ?, 'migrerad:VAS')").run(p.id, inl, datum('2013-01-14'));
  const ord = Number(db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, slut, status, utsatt_tid, utsatt_av, utsatt_orsak, ordinerad_av, skapad, nll_status, kalla)
    VALUES (?, 'uso-med', 'VK-NPL-0033', '1 tablett 3 gånger dagligen i 7 dagar', 1, 'g', '["08","14","20"]', 0, 'tillfallig', 'Pneumoni', ?, ?, ?, 'utsatt', ?, 'lak-vas', 'Kuren avslutad', 'lak-vas', ?, 'kvitterad', 'migrerad:VAS')`)
    .run(p.id, datum('2013-01-28'), datum('2013-01-21'), datum('2013-01-28'), tid(['2013-01-28', '12:00']), tid(['2013-01-21', '10:40'])).lastInsertRowid);
  db.query("INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, 'lak-vas', 'Migrerad från VAS', '1 tablett 3 gånger dagligen i 7 dagar')").run(ord, tid(['2013-01-21', '10:40']));
  for (const [t, v] of [[['2013-01-14', '16:40'], 182], [['2013-01-17', '07:00'], 64], [['2013-01-20', '07:00'], 12]]) {
    db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, kalla, vidimerad) VALUES (?, 'uso-med', 'crp', ?, ?, 'mg/L', ?, 'migrerad:VAS', ?)")
      .run(p.id, String(v), v, tid(t), tid(t));
  }
}

// Seeden för kontrasignering: underläkaren Alva Berglund har skrivit och signerat en daganteckning för patient 4 på
// avdelning 72 och bett Sara Lindqvist kontrasignera den. Den ligger i Saras inkorg.
export function seedaUtdata(db, { tid }) {
  sakraUtdataschema(db);
  const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p04' AND enhet_id = 'uso-kard-72' AND slut IS NULL ORDER BY start DESC").get();
  const t = tid([0, '08:40']);
  const sokord = JSON.stringify([
    { sokord: 'Aktuellt', text: 'Ronden. Inga bröstsmärtor i natt. Har gått i trappan med sjukgymnasten.' },
    { sokord: 'Bedömning', text: 'Stabil efter PCI. Kan skrivas ut i morgon om ekokardiografin är normal.' },
    { sokord: 'Åtgärd', text: 'Ekokardiografi i dag. Recept på tikagrelor i tolv månader.' },
  ]);
  const r = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
    VALUES ('p04', 'uso-kard-72', ?, 'Daganteckning', 'lakare', ?, 'ul-kard', ?, 'signerad', ?, 'ul-kard', 1, 'vardkallan')`).run(vk?.id ?? null, sokord, t, t);
  db.query(`INSERT INTO kontrasigneringar (patient_id, typ, post_id, enhet_id, begard_av, begard, mottagare_id, kommentar)
    VALUES ('p04', 'anteckning', ?, 'uso-kard-72', 'ul-kard', ?, 'lak-kard', 'Bedömningen inför utskrivning, tack.')`).run(Number(r.lastInsertRowid), tid([0, '08:45']));
}
