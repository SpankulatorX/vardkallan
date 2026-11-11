// Runda 12, r3 (Sussa 10.1.1.5): praktiska prov i journalen. Övningarna i utbildning.js är kunskapsfrågor. Ett
// praktiskt prov är en uppgift som personen gör på riktigt i en övningsjournal, till exempel att ordinera, skriva och
// signera en anteckning eller registrera ett mätvärde, och systemet kontrollerar själv i databasen att det blev rätt.
//
// Utbildaren är en behörighet för en befintlig roll, inte en egen inloggningsroll: den som har ett giltigt
// utbildarintyg (utfärdat av verksamhetschefen, utbildning.js) och vårdenhetens verksamhetschef har behörigheten
// utbildare. Med den skapar de prov för vårdenheten och följer upp vem som har klarat vilket prov.
//
// Övningsjournalen är en demopatient med påhittade uppgifter som personen redan har vårdrelation till. Demon är
// Vårdkällans utbildningsmiljö. Systemet väljer patienten själv med personens egen behörighet, så att ingen får se en
// patient som den inte får se, och utbildaren ser aldrig vilken patient provet gjordes på, bara om det är godkänt.
//
// Systemet är experten: utbildaren väljer bara vilket prov, och systemet vet vilka yrkesroller provet gäller, vad som
// ska göras, hur det kontrolleras och hur länge ett godkänt prov gäller. Den som gör provet får en instruktion med en
// länk till rätt flik i journalen, och vid kontrollen säger systemet på vanlig svenska vad som saknas.
import { Fel } from './db.js';
import { prova as provaAtkomst, vardenhetFor, kanRoll, Atkomst } from './atkomst.js';
import { enhetForAndring } from './utbildning.js';
import { GILTIG_DAGAR } from './utbildning-schema.js';

const DAG = 86400_000;

export function sakra(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS praktiska_prov (
    id INTEGER PRIMARY KEY AUTOINCREMENT, vardenhet_id TEXT NOT NULL, typ TEXT NOT NULL, skapad_av TEXT NOT NULL,
    skapad TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1, avslutad TEXT, avslutad_av TEXT
  );
  CREATE TABLE IF NOT EXISTS praktiska_provforsok (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prov_id INTEGER NOT NULL, personal_id TEXT NOT NULL, patient_id TEXT NOT NULL,
    startad TEXT NOT NULL, forsta_id INTEGER NOT NULL, kontrollerad TEXT, godkant INTEGER NOT NULL DEFAULT 0, resultat TEXT
  );`);
  return db;
}
const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'praktiska_prov'").get());

const namnPa = (db, pid) => {
  const p = db.query('SELECT fornamn, efternamn FROM patienter WHERE id = ?').get(pid);
  return p ? `${p.fornamn} ${p.efternamn}` : 'patienten';
};
const maxId = (db, tabell) => db.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${tabell}`).get().m;

// Proven som systemet kan kontrollera. Varje prov vet vilka yrkesroller det gäller, vilken handling som krävs, vilken
// flik i journalen uppgiften görs i och hur resultatet kontrolleras i databasen.
export const PROVTYPER = {
  ordinera_vid_behov: {
    titel: 'Ordinera paracetamol vid behov',
    roller: ['lakare'], handling: 'ordinera', tabell: 'ordinationer', flik: 'lakemedel',
    uppgift: (pat) => `Öppna fliken Läkemedel i journalen för ${pat} och ordinera paracetamol vid behov mot smärta, med orsak och uppföljning. Kontrollera provet när ordinationen är sparad.`,
    kontroll(db, f) {
      const rader = db.query(`SELECT o.*, k.substans FROM ordinationer o LEFT JOIN katalog k ON k.id = o.lakemedel_id
        WHERE o.id > ? AND o.patient_id = ? AND o.ordinerad_av = ?`).all(f.forsta_id, f.patient_id, f.personal_id);
      if (!rader.length) return [false, 'Det finns ingen ordination av dig till patienten sedan du startade provet.'];
      const para = rader.filter(r => /paracetamol/i.test(r.substans ?? ''));
      if (!para.length) return [false, 'Du har ordinerat ett annat läkemedel. Provet gäller paracetamol.'];
      if (!para.some(r => r.vid_behov)) return [false, 'Ordinationen av paracetamol är inte vid behov. Välj vid behov när du ordinerar.'];
      return [true, 'Paracetamol är ordinerat vid behov, med orsak och uppföljning.'];
    },
  },
  signera_anteckning: {
    titel: 'Skriva och signera en journalanteckning',
    roller: ['lakare', 'sjukskoterska', 'fysioterapeut'], handling: 'skriv_omvardnad', tabell: 'anteckningar', flik: 'journal',
    uppgift: (pat) => `Öppna fliken Journal för ${pat}, skriv en anteckning och signera den. Kontrollera provet när anteckningen är signerad.`,
    kontroll(db, f) {
      const rader = db.query('SELECT * FROM anteckningar WHERE id > ? AND patient_id = ? AND forfattare_id = ?').all(f.forsta_id, f.patient_id, f.personal_id);
      if (!rader.length) return [false, 'Det finns ingen anteckning av dig i patientens journal sedan du startade provet.'];
      if (!rader.some(r => r.status === 'signerad' && r.signerad_av === f.personal_id)) return [false, 'Anteckningen är sparad men inte signerad. Signera den, så att den blir en del av journalen.'];
      return [true, 'Anteckningen är skriven och signerad.'];
    },
  },
  registrera_blodtryck: {
    titel: 'Registrera ett blodtryck',
    roller: ['sjukskoterska', 'underskoterska'], handling: 'registrera_matvarde', tabell: 'matvarden', flik: 'matvarden',
    uppgift: (pat) => `Öppna fliken Mätvärden i journalen för ${pat} och registrera ett blodtryck. Kontrollera provet när mätvärdet är sparat.`,
    kontroll(db, f) {
      const rader = db.query('SELECT * FROM matvarden WHERE id > ? AND patient_id = ? AND registrerad_av = ?').all(f.forsta_id, f.patient_id, f.personal_id);
      if (!rader.length) return [false, 'Det finns inget mätvärde registrerat av dig för patienten sedan du startade provet.'];
      if (!rader.some(r => r.typ === 'blodtryck')) return [false, 'Du har registrerat ett annat mätvärde. Provet gäller blodtryck.'];
      return [true, 'Blodtrycket är registrerat.'];
    },
  },
};
const typUt = (typ) => ({ typ, titel: PROVTYPER[typ].titel, roller: PROVTYPER[typ].roller });

// Behörigheten utbildare: vårdenheten som personen skapar och följer upp prov för, eller null.
export const utbildareFor = (db, personal, nu = new Date()) => (personal ? enhetForAndring(db, personal, nu) : null);

const senasteForsok = (db, provId, personalId) => db.query('SELECT * FROM praktiska_provforsok WHERE prov_id = ? AND personal_id = ? ORDER BY id DESC LIMIT 1').get(provId, personalId);
function status(f, nu) {
  if (!f) return { status: 'ej_paborjat', text: 'Inte påbörjat' };
  if (f.godkant) {
    const till = new Date(new Date(f.kontrollerad).getTime() + GILTIG_DAGAR * DAG);
    if (till < nu) return { status: 'utgatt', text: 'Godkänt prov har gått ut', godkant: f.kontrollerad, giltigtTill: till.toISOString() };
    return { status: 'godkant', text: 'Godkänt', godkant: f.kontrollerad, giltigtTill: till.toISOString() };
  }
  return { status: 'pagar', text: f.kontrollerad ? 'Inte godkänt än' : 'Påbörjat' };
}

// Proven för den inloggade: vårdenhetens aktiva prov för personens yrkesroll, med status. Utbildaren får också
// provtyperna och uppföljningen.
export function oversikt(db, personal, { nu = new Date() } = {}) {
  if (!harTabell(db)) sakra(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  const prov = db.query('SELECT * FROM praktiska_prov WHERE vardenhet_id = ? AND aktiv = 1 ORDER BY id').all(ve)
    .filter(p => PROVTYPER[p.typ]?.roller.includes(personal.yrke) && kanRoll(personal, PROVTYPER[p.typ].handling))
    .map(p => {
      const f = senasteForsok(db, p.id, personal.id);
      const t = PROVTYPER[p.typ];
      const pagar = f && !f.godkant;
      return { id: p.id, ...typUt(p.typ), ...status(f, nu),
        ...(pagar ? { uppgift: t.uppgift(namnPa(db, f.patient_id)), lank: `#/patient/${f.patient_id}/${t.flik}`, resultat: f.resultat } : {}),
        ...(f?.godkant ? { resultat: f.resultat } : {}) };
    });
  const u = utbildareFor(db, personal, nu);
  return { prov, utbildare: Boolean(u), ...(u ? { provtyper: Object.keys(PROVTYPER).map(typUt), uppfoljning: uppfoljning(db, u, nu) } : {}) };
}

// Uppföljningen för utbildaren: varje aktivt prov på vårdenheten och varje person med en yrkesroll som provet gäller,
// med status. Ingen patient visas.
export function uppfoljning(db, ve, nu = new Date()) {
  const personer = db.query('SELECT * FROM personal').all().filter(p => vardenhetFor(db, p.enhet_id) === ve);
  return db.query('SELECT * FROM praktiska_prov WHERE vardenhet_id = ? AND aktiv = 1 ORDER BY id').all(ve).map(p => {
    const t = PROVTYPER[p.typ];
    const rader = personer.filter(x => t.roller.includes(x.yrke)).map(x => ({ id: x.id, namn: x.namn, titel: x.titel, ...status(senasteForsok(db, p.id, x.id), nu) }));
    return { id: p.id, ...typUt(p.typ), skapad: p.skapad, personer: rader, godkanda: rader.filter(r => r.status === 'godkant').length };
  });
}

export function skapa(db, personal, typ, { nu = new Date() } = {}) {
  if (!harTabell(db)) sakra(db);
  const ve = utbildareFor(db, personal, nu);
  if (!ve) throw new Fel(403, 'Bara vårdenhetens verksamhetschef och utbildare på vårdenheten skapar praktiska prov.', 'nekad');
  if (typeof typ !== 'string' || !Object.hasOwn(PROVTYPER, typ)) throw new Fel(400, 'Välj ett av proven som systemet kan kontrollera.', 'ogiltig', { falt: ['typ'] });
  if (db.query('SELECT 1 FROM praktiska_prov WHERE vardenhet_id = ? AND typ = ? AND aktiv = 1').get(ve, typ)) throw new Fel(400, `Vårdenheten har redan provet ${PROVTYPER[typ].titel.toLowerCase()}.`, 'ogiltig', { falt: ['typ'] });
  db.query('INSERT INTO praktiska_prov (vardenhet_id, typ, skapad_av, skapad) VALUES (?, ?, ?, ?)').run(ve, typ, personal.id, nu.toISOString());
  return oversikt(db, personal, { nu });
}

export function avsluta(db, personal, provId, { nu = new Date() } = {}) {
  const ve = utbildareFor(db, personal, nu);
  const p = db.query('SELECT * FROM praktiska_prov WHERE id = ? AND aktiv = 1').get(Number(provId) || 0);
  if (!ve || !p || p.vardenhet_id !== ve) throw new Fel(404, 'Provet finns inte på din vårdenhet.', 'saknas');
  db.query('UPDATE praktiska_prov SET aktiv = 0, avslutad = ?, avslutad_av = ? WHERE id = ?').run(nu.toISOString(), personal.id, p.id);
  return oversikt(db, personal, { nu });
}

function provFor(db, personal, provId) {
  const p = db.query('SELECT * FROM praktiska_prov WHERE id = ? AND aktiv = 1').get(Number(provId) || 0);
  if (!p || p.vardenhet_id !== vardenhetFor(db, personal.enhet_id) || !PROVTYPER[p.typ].roller.includes(personal.yrke)) throw new Fel(404, 'Provet finns inte för dig.', 'saknas');
  return p;
}

// Startar provet. Systemet väljer övningsjournalen: den första demopatienten som personen har vårdrelation till och får
// göra uppgiften för, utan skyddade personuppgifter. Valet görs med personens egen behörighet och loggas.
export function starta(db, personal, provId, { nu = new Date() } = {}) {
  const p = provFor(db, personal, provId);
  const t = PROVTYPER[p.typ];
  const handling = kanRoll(personal, t.handling) ? t.handling : null;
  if (!handling) throw new Fel(403, 'Din yrkesroll kan inte göra provet.', 'nekad');
  const kandidater = db.query('SELECT id FROM patienter WHERE skyddad = 0 ORDER BY id').all();
  const pid = kandidater.map(x => x.id).find(id => {
    const r = provaAtkomst(db, { personal, patient: id, handling, nu });
    return r.tillaten && r.grund === 'vardrelation';
  });
  if (!pid) throw new Fel(400, 'Det finns ingen demopatient på din vårdenhet som provet kan göras på.', 'ogiltig');
  const atk = new Atkomst(db, personal, pid, {}, 'las_oversikt');
  atk.krav('las_oversikt');
  atk.logga('las_oversikt', atk.grund(), 'praktiskt-prov');
  db.query('INSERT INTO praktiska_provforsok (prov_id, personal_id, patient_id, startad, forsta_id) VALUES (?, ?, ?, ?, ?)').run(p.id, personal.id, pid, nu.toISOString(), maxId(db, t.tabell));
  return oversikt(db, personal, { nu });
}

// Kontrollerar resultatet i databasen och sparar utfallet.
export function kontrollera(db, personal, provId, { nu = new Date() } = {}) {
  const p = provFor(db, personal, provId);
  const f = senasteForsok(db, p.id, personal.id);
  if (!f || f.godkant) throw new Fel(400, f ? 'Provet är redan godkänt.' : 'Starta provet först, så att systemet vet vad som ska kontrolleras.', 'ogiltig');
  const [ok, text] = PROVTYPER[p.typ].kontroll(db, f);
  db.query('UPDATE praktiska_provforsok SET kontrollerad = ?, godkant = ?, resultat = ? WHERE id = ?').run(nu.toISOString(), ok ? 1 : 0, text, f.id);
  return { godkant: ok, text, ...oversikt(db, personal, { nu }) };
}
