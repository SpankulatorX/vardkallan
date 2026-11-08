// Kollegakontroll av högriskläkemedel (runda 10, r5, Sussa 3.5.1.1 och 3.5.1.5, beslut 2026-11-08).
//
// Systemet är experten. Ur ordinationen avgör systemet om en dos hör till ett högriskläkemedel som en kollega ska
// kontrollera innan dosen ges: koncentrerade elektrolyter (också tillsatser som Addex), opioider, insulininfusion,
// heparininfusion och cytostatika. Den som iordningsställer behöver inte kunna listan. Systemet säger varför dosen
// kontrolleras, stoppar en dos som inte är kontrollerad med en förklaring på vanlig svenska och visar dosen för
// kollegorna på vårdenheten.
//
// Vilka grupper som kontrolleras är parametrar som systemförvaltaren styr (konfiguration.js, fyra ögon och historik).
// Alla grupper är påslagna från början.
//
// Behörighet. Kontrollen görs av en annan sjuksköterska eller läkare med vårdrelation på samma vårdenhet, i sin egen
// inloggning: den som iordningsställde kan aldrig kontrollera sin egen dos, och ett id i anropet räcker inte, eftersom
// kontrollanten är den som är inloggad i sessionen. En dos som ska beredas kontrolleras i beredningen (beredning.js),
// och då med samma regler.
import { Fel, iso } from './db.js';
import { vardenhetFor } from './atkomst.js';
import * as konfiguration from './konfiguration.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kollegakontroller (
  id INTEGER PRIMARY KEY, administrering_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL,
  kategorier TEXT NOT NULL, varfor TEXT NOT NULL, iordningstalld_av TEXT NOT NULL, iordningstalld_tid TEXT NOT NULL,
  kontrollerad_av TEXT, kontrollerad_tid TEXT
);
CREATE TRIGGER IF NOT EXISTS kollegakontroll_raderas_ej BEFORE DELETE ON kollegakontroller BEGIN SELECT RAISE(ABORT, 'En kollegakontroll raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS kollegakontroll_andras_ej BEFORE UPDATE ON kollegakontroller WHEN OLD.kontrollerad_tid IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'En gjord kollegakontroll ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

const ADDEX = /^Addex/i;
const arInfusion = ({ spadning, satt }) => Boolean(spadning) || satt === 'intravenost';
// Grupperna. match får läkemedlet, tillsatserna (katalograder), beredningen och administrationssättet.
export const KATEGORIER = {
  elektrolyter: {
    rubrik: 'Koncentrerade elektrolyter, också tillsatser som Addex', parameter: 'lakemedel.kollegakontroll.elektrolyter',
    varfor: 'Koncentrerade elektrolyter kan ge livshotande hjärtrytmrubbningar vid fel mängd eller för snabb infusion.',
    // Ett koncentrat (till exempel kaliumklorid eller magnesiumsulfat) som läkemedel eller tillsats, och tillsatser som
    // Addex. En isoton basvätska som natriumklorid 9 mg/ml är ingen koncentrerad elektrolyt.
    match: ({ lm, tillsatser }) => [lm, ...tillsatser].filter(Boolean).some(x => (x.atc?.startsWith('B05XA') && /koncentrat/i.test(x.form ?? '')) || ADDEX.test(x.namn ?? '')),
  },
  opioider: {
    rubrik: 'Opioider', parameter: 'lakemedel.kollegakontroll.opioider',
    varfor: 'Opioider är narkotika, och en för hög dos kan ge andningsdepression.',
    match: ({ lm }) => Boolean(lm?.atc?.startsWith('N02A') || lm?.atc?.startsWith('N01AH')),
  },
  insulininfusion: {
    rubrik: 'Insulininfusion', parameter: 'lakemedel.kollegakontroll.insulininfusion',
    varfor: 'Ett räknefel i en insulininfusion kan ge livshotande lågt blodsocker.',
    match: (x) => Boolean(x.lm?.atc?.startsWith('A10A') && arInfusion(x)),
  },
  heparininfusion: {
    rubrik: 'Heparininfusion', parameter: 'lakemedel.kollegakontroll.heparininfusion',
    varfor: 'Ett räknefel i en heparininfusion kan ge allvarlig blödning eller blodpropp.',
    match: (x) => Boolean(x.lm?.atc?.startsWith('B01AB') && arInfusion(x)),
  },
  cytostatika: {
    rubrik: 'Cytostatika', parameter: 'lakemedel.kollegakontroll.cytostatika',
    varfor: 'Cytostatika har ett smalt terapeutiskt fönster, och en felaktig dos kan ge allvarliga skador.',
    match: ({ lm }) => Boolean(lm?.atc?.startsWith('L01')),
  },
};

const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);

// Grupperna som gäller för dosen, bland dem som systemförvaltaren har slagit på i dag. o är ordinationen med tillägg
// (spadning och administrationssatt), eller null för en dos utan ordination.
export function kategorierFor(db, { lm, o = null, nu = Date.now() }) {
  const tillsatser = (o?.spadning?.tillsatser ?? []).map(t => katalog(db, t.lakemedelId) ?? { namn: t.namn, atc: null }).filter(Boolean);
  const x = { lm, tillsatser, spadning: o?.spadning ?? null, satt: o?.administrationssatt ?? null };
  return Object.entries(KATEGORIER)
    .filter(([, k]) => k.match(x) && konfiguration.varde(db, k.parameter, new Date(nu)) === true)
    .map(([id, k]) => ({ id, rubrik: k.rubrik, varfor: k.varfor }));
}

export const aktiv = (db, id, nu = Date.now()) => konfiguration.varde(db, KATEGORIER[id].parameter, new Date(nu)) === true;

export const varforText = (kat) => `${kat.map(k => k.varfor).join(' ')} En annan sjuksköterska eller läkare kontrollerar dosen i sin egen inloggning innan den ges.`;

// Före sparandet i administrering.js. Vid iordningsställande ger den kontrollen som ska sparas, och en beredning får
// kontrollen i sin egen post (beredning.js). Vid given dos stoppas en dos som inte är kontrollerad.
// Säkerhetsgranskningen av runda 10 (beslut 2026-11-08): den sparade raden avgör. En iordningsställd dos med en
// kollegakontroll som inte är gjord ges aldrig, oavsett vilka grupper som gäller i dag och vad anropet anger. Dosens
// läkemedel och ordination tas från den iordningsställda raden på servern, och ett anrop vars läkemedel eller
// ordination inte stämmer med dosen avvisas. En avstängd grupp gäller bara doser som iordningsställs efter ändringen.
export function provaAdministrering(db, { atgard, lm, o, ior, beredning: ber, efterhand, nu = Date.now() }) {
  if ((atgard === 'ge' || atgard === 'overlamna' || atgard === 'ej_given') && ior) {
    if (ior.lakemedel_id !== lm?.id || (ior.ordination_id ?? null) !== (o?.id ?? null)) {
      throw new Fel(400, 'Etiketten hör inte till det läkemedel och den ordination som anges. Kontrollera patienten och läkemedlet innan något ges.', 'ogiltig', { falt: ['kontrollkod'] });
    }
    if (atgard === 'ej_given') return null;
    const k = db.query('SELECT * FROM kollegakontroller WHERE administrering_id = ?').get(ior.id);
    const namn = db.query('SELECT namn FROM katalog WHERE id = ?').get(ior.lakemedel_id)?.namn ?? lm.namn;
    if (k && !k.kontrollerad_tid) throw new Fel(400, `${namn} väntar på kollegakontroll. ${k.varfor} Be en kollega välja Kontrollera dosen.`, 'ogiltig', { kollegakontroll: true });
    return null;
  }
  const kat = kategorierFor(db, { lm, o, nu });
  if (!kat.length) return null;
  if (atgard === 'iordningstall') {
    if (ber) {
      // Beredningen kontrolleras av en kollega: skälet läggs till beredningens egna skäl.
      const extra = kat.map(k => k.varfor).filter(t => !(ber.kontroll.varfor ?? '').includes(t));
      ber.kontroll = { kravs: true, varfor: ber.kontroll.kravs ? `${extra.length ? `${extra.join(' ')} ` : ''}${ber.kontroll.varfor}` : varforText(kat) };
      return null;
    }
    return { kategorier: kat, varfor: varforText(kat) };
  }
  if (atgard !== 'ge' && atgard !== 'overlamna') return null;
  if (efterhand) return null;
  throw new Fel(400, `${lm.namn} är ett högriskläkemedel (${kat.map(k => k.rubrik.toLowerCase()).join(', ')}). ${varforText(kat)} Välj Iordningsställ, så kan en kollega kontrollera dosen.`, 'ogiltig', { kollegakontroll: true, iordningstall: true });
}

export function spara(db, personal, patientId, administreringId, k, tid) {
  if (!k) return;
  db.query('INSERT INTO kollegakontroller (administrering_id, patient_id, enhet_id, kategorier, varfor, iordningstalld_av, iordningstalld_tid) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(administreringId, patientId, personal.enhet_id, JSON.stringify(k.kategorier.map(x => x.id)), k.varfor, personal.id, tid);
}

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
export function kontrollUt(db, k) {
  if (!k) return null;
  return {
    id: k.id, kategorier: JSON.parse(k.kategorier).map(id => ({ id, rubrik: KATEGORIER[id]?.rubrik ?? id })), varfor: k.varfor,
    iordningstalldAv: { id: k.iordningstalld_av, namn: personNamn(db, k.iordningstalld_av) }, iordningstalldTid: k.iordningstalld_tid,
    av: k.kontrollerad_av ? { id: k.kontrollerad_av, namn: personNamn(db, k.kontrollerad_av) } : null, tid: k.kontrollerad_tid,
  };
}
export const forAdministrering = (db, administreringId) => kontrollUt(db, db.query('SELECT * FROM kollegakontroller WHERE administrering_id = ?').get(administreringId));

// Kontrollen, i kollegans egen inloggning. synligaAdministreringar är administrering.js funktion, som skickas in så att
// modulerna inte importerar varandra i en ring. kravVardande prövar vårdrelationen och loggar ett nekat försök.
export function kontrollera(atk, kontrollId, { synligaAdministreringar, kravVardande }, inp = {}) {
  const db = atk.db;
  const k = db.query('SELECT * FROM kollegakontroller WHERE id = ? AND patient_id = ?').get(Number(kontrollId), atk.patientId);
  // En kontroll till en dos som användaren inte får se behandlas som om den inte finns.
  if (!k || !synligaAdministreringar(atk).some(a => a.id === k.administrering_id)) throw new Fel(404, 'Kontrollen finns inte.', 'saknas');
  const resurs = `kollegakontroll:${k.id}`;
  kravVardande(atk, 'ge_lakemedel', { enhet_id: k.enhet_id }, resurs);
  const neka = (skal) => { atk.logga('ge_lakemedel', 'nekad', resurs, 'nekad'); throw new Fel(403, skal, 'nekad'); };
  if (!['sjukskoterska', 'lakare'].includes(atk.personal.yrke)) neka('En kollegakontroll görs av en sjuksköterska eller läkare.');
  if (vardenhetFor(db, k.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) neka('Kollegakontrollen görs på den vårdenhet där dosen iordningsställdes.');
  if (k.kontrollerad_tid) throw new Fel(400, `Dosen är redan kontrollerad av ${personNamn(db, k.kontrollerad_av)}.`, 'ogiltig');
  if (k.iordningstalld_av === atk.personal.id) throw new Fel(400, 'Du iordningsställde dosen själv. En annan sjuksköterska eller läkare kontrollerar den i sin egen inloggning.', 'ogiltig');
  const a = db.query('SELECT * FROM administreringar WHERE id = ?').get(k.administrering_id);
  if (a.status !== 'iordningstalld') throw new Fel(400, 'Dosen är inte längre iordningsställd.', 'ogiltig');
  // Kontrollanten kan skriva etikettens kontrollkod, och då ska den stämma med dosen.
  if (inp.kontrollkod != null && String(inp.kontrollkod).trim() !== a.kontrollkod) {
    throw new Fel(400, 'Etiketten stämmer inte med dosen. Ge inte dosen. Makulera iordningsställandet och iordningsställ en ny dos.', 'ogiltig', { falt: ['kontrollkod'] });
  }
  db.query('UPDATE kollegakontroller SET kontrollerad_av = ?, kontrollerad_tid = ? WHERE id = ?').run(atk.personal.id, iso(), k.id);
  atk.logga('ge_lakemedel', atk.grund(), resurs);
  return { kontroll: kontrollUt(db, db.query('SELECT * FROM kollegakontroller WHERE id = ?').get(k.id)), text: 'Dosen är kontrollerad och kan ges.' };
}

// Doser på den egna vårdenheten som väntar på kollegakontroll, för inkorgen: bara antal, utan patientuppgifter, och
// aldrig den inloggades egna.
export function vantarPaKontroll(db, personal) {
  if (!['sjukskoterska', 'lakare'].includes(personal?.yrke)) return 0;
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query(`SELECT k.enhet_id, k.iordningstalld_av FROM kollegakontroller k JOIN administreringar a ON a.id = k.administrering_id
    WHERE k.kontrollerad_tid IS NULL AND a.status = 'iordningstalld'`).all()
    .filter(k => k.iordningstalld_av !== personal.id && vardenhetFor(db, k.enhet_id) === ve).length;
}
