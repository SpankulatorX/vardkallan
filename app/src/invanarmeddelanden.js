// Meddelanden mellan invånaren och vården och handläggningen av invånarens begäranden (runda 10, r7, Sussa 3.7.1.1
// och 3.7.1.3). Patienten, vårdnadshavaren eller ett ombud med fullmakt skriver till en vårdenhet i Min journal, och
// vården läser, svarar och avslutar ärendet. En begäran om spärr, om att häva en spärr eller om ett loggutdrag
// handläggs av den som ansvarar för det och avslutas med ett besked till patienten.
//
// Systemet är experten:
//   - Invånaren väljer vad det gäller (en fråga, förnya ett recept, ett intyg, en tid eller en kommentar till
//     vårdplanen). Systemet skickar meddelandet till rätt vårdenhet och yrkesroll: receptet till den vårdenhet som
//     ordinerade läkemedlet och till en läkare, vårdplanen till den vårdenhet som har planen, och annat till den
//     vårdenhet där patienten senast hade kontakt. Ord som kan tyda på något akut ger rådet att ringa 112 innan något
//     skickas.
//   - När läkaren förnyar receptet eller utfärdar intyget skapar systemet avgiften själv (kassa.js) och skriver svaret
//     till patienten. Patienten får ett sms om att det finns ett svar i Min journal (simulerat), utom vid skyddade
//     personuppgifter.
//   - En begäran om spärr registreras som spärr med ett klick, eftersom patienten själv bestämmer (patientdatalagen
//     4 kap. 4 §), och ett loggutdrag tas fram av systemet ur loggen.
//
// Behörighet. Vården läser ett meddelande bara på den vårdenhet det skickades till och med vårdrelation, prövat i
// behörighetsmotorn och loggat på patienten. Listan över meddelanden visar inte meddelandenas text. Ett meddelande ger
// aldrig vårdrelation: invånaren kan bara skriva till en vårdenhet där patienten redan har vårdrelation.
import { Fel, iso, idag } from './db.js';
import { kanRoll, vardenhetFor, harVardrelation, visningsnamn, visningsPnr, aktivaSparrar } from './atkomst.js';
import { loggaRad, lista as loggLista } from './logg.js';
import { AKUT, AKUT_TEXT } from './vardbegaran.js';
import * as kassa from './kassa.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meddelandetradar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, yrkesroll TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ny', skapad TEXT NOT NULL, skapad_av_invanare TEXT NOT NULL, relation TEXT NOT NULL,
  ordination_id INTEGER, plan_id INTEGER, intygstyp TEXT, avslutad TEXT, avslutad_av TEXT, utfall TEXT, avgift_id INTEGER,
  CHECK (status IN ('ny', 'besvarad', 'avslutad'))
);
CREATE INDEX IF NOT EXISTS ix_meddelandetradar_patient ON meddelandetradar (patient_id);
CREATE TRIGGER IF NOT EXISTS meddelandetrad_raderas_ej BEFORE DELETE ON meddelandetradar BEGIN SELECT RAISE(ABORT, 'Ett meddelande raderas inte'); END;
CREATE TABLE IF NOT EXISTS invanarmeddelanden (
  id INTEGER PRIMARY KEY, trad_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, fran TEXT NOT NULL, invanare_id TEXT,
  personal_id TEXT, text TEXT NOT NULL, tid TEXT NOT NULL, lasd TEXT, avisering TEXT,
  CHECK (fran IN ('invanare', 'vard', 'systemet'))
);
CREATE TRIGGER IF NOT EXISTS invanarmeddelande_andras_ej BEFORE UPDATE OF trad_id, fran, invanare_id, personal_id, text, tid ON invanarmeddelanden
  BEGIN SELECT RAISE(ABORT, 'Ett meddelande ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS invanarmeddelande_raderas_ej BEFORE DELETE ON invanarmeddelanden BEGIN SELECT RAISE(ABORT, 'Ett meddelande raderas inte'); END;
CREATE TABLE IF NOT EXISTS begaran_beslut (
  id INTEGER PRIMARY KEY, begaran_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, beslut TEXT NOT NULL,
  besked TEXT NOT NULL, av TEXT NOT NULL, tid TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS begaran_beslut_andras_ej BEFORE UPDATE OF begaran_id, beslut, besked, av, tid ON begaran_beslut BEGIN SELECT RAISE(ABORT, 'Ett beslut ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS begaran_beslut_raderas_ej BEFORE DELETE ON begaran_beslut BEGIN SELECT RAISE(ABORT, 'Ett beslut raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meddelandetradar'").get());

export const TYPER = {
  fraga: { text: 'En fråga till vården', yrkesroll: 'sjukskoterska' },
  recept: { text: 'Förnya ett recept', yrkesroll: 'lakare' },
  intyg: { text: 'Beställa ett intyg', yrkesroll: 'lakare' },
  tid: { text: 'En fråga om en tid', yrkesroll: 'vardadministrator' },
  vardplan: { text: 'En kommentar till vårdplanen', yrkesroll: 'sjukskoterska' },
};
const YRKE = { lakare: 'läkare', sjukskoterska: 'sjuksköterska', vardadministrator: 'vårdadministratör' };
const STATUS = { ny: 'Nytt', besvarad: 'Besvarat', avslutad: 'Avslutat' };
export const DEMOREGLER = 'Demoregler: vården svarar inom tre arbetsdagar. Ett meddelande läses inte direkt, så vid akuta besvär ska du ringa 112, och vid frågor om vård 1177. Sms-aviseringen är simulerad.';
export const MAX_OPPNA = 5;
export const MAX_PER_PATIENT = 60;
const MAX_TEXT = 2000;

const enhetNamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? null;
const personKort = (db, id) => { const p = id && db.query('SELECT namn, titel, yrke FROM personal WHERE id = ?').get(id); return p ? { namn: p.namn, titel: p.titel } : null; };
const textIn = (t, falt = 'text') => {
  const s = typeof t === 'string' ? t.trim() : '';
  if (!s) throw new Fel(400, 'Skriv ditt meddelande.', 'ogiltig', { falt: [falt] });
  if (s.length > MAX_TEXT) throw new Fel(400, `Meddelandet får vara högst ${MAX_TEXT} tecken.`, 'ogiltig', { falt: [falt] });
  return s;
};

// Vårdenheterna som patienten kan skriva till: de där patienten har vårdrelation nu, med den senaste kontakten först.
export function mottagare(db, pid) {
  const rader = db.query(`SELECT enhet_id, max(start) AS sist FROM vardkontakter WHERE patient_id = ? GROUP BY enhet_id
    UNION ALL SELECT enhet_id, fran AS sist FROM listningar WHERE patient_id = ?`).all(pid, pid);
  const per = new Map();
  for (const r of rader) {
    const ve = vardenhetFor(db, r.enhet_id);
    if (!ve || ve === 'uso-akut') continue;
    if (!per.has(ve) || (r.sist ?? '') > per.get(ve)) per.set(ve, r.sist ?? '');
  }
  return [...per.entries()].filter(([ve]) => harVardrelation(db, pid, ve)).sort((a, b) => b[1].localeCompare(a[1])).map(([ve]) => ({ id: ve, namn: enhetNamn(db, ve) }));
}

// Läkemedlen som kan förnyas: aktuella ordinationer från Vårdkällan, på en vårdenhet där patienten har vårdrelation.
function fornybara(db, pid) {
  return db.query(`SELECT o.*, k.namn, k.styrka FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND o.status = 'aktiv'
    AND (o.slut IS NULL OR o.slut >= ?) AND coalesce(o.kalla, 'vardkallan') = 'vardkallan' ORDER BY k.namn`).all(pid, idag())
    .filter(o => harVardrelation(db, pid, vardenhetFor(db, o.enhet_id)))
    .map(o => ({ id: o.id, text: `${o.namn} ${o.styrka ?? ''}`.trim(), vardenhet: enhetNamn(db, vardenhetFor(db, o.enhet_id)) }));
}
function planer(db, pid) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardplaner'").get()) return [];
  return db.query("SELECT * FROM vardplaner WHERE patient_id = ? AND status <> 'avslutad' ORDER BY id").all(pid).map(p => ({ id: p.id, text: p.rubrik, vardenhet: enhetNamn(db, vardenhetFor(db, p.enhet_id)) }));
}

const tradRad = (db, id) => (finns(db) ? db.query('SELECT * FROM meddelandetradar WHERE id = ?').get(Number(id) || 0) : null);
const meddelandenFor = (db, tid) => db.query('SELECT * FROM invanarmeddelanden WHERE trad_id = ? ORDER BY id').all(tid);

// Vem av invånarna som skrev: patienten, vårdnadshavaren eller ombudet. Inga namn.
function avInvanare(db, t, invanareId) {
  const i = db.query('SELECT patient_id FROM invanare WHERE id = ?').get(invanareId);
  if (i?.patient_id === t.patient_id) return 'Patienten';
  if (db.query('SELECT 1 FROM vardnadshavare WHERE invanare_id = ? AND barn_id = ?').get(invanareId, t.patient_id)) return 'Vårdnadshavaren';
  return 'Ombudet';
}

// Runda 10, r7 (säkerhetsgranskningen): ett ombud ser och refererar aldrig journalinnehåll. Läkemedel och vårdplaner
// listas inte, recept och vårdplan kan inte väljas, och vad en tråd gäller visas inte när det kommer från en ordination
// eller en plan, inte heller i en tråd som patienten själv startade.
const OMBUD_UTAN = ['recept', 'vardplan'];
// En tråd som gäller en ordination eller en plan finns inte för ett ombud: den visas inte, räknas inte, markeras inte
// som läst och ger samma svar som en tråd som inte finns, eftersom texten i den kan nämna läkemedlet eller planen.
export const synligFor = (atk, t) => atk.relation !== 'ombud' || (!t.ordination_id && !t.plan_id);
const synligaTradar = (atk, villkor = '') => atk.db.query(`SELECT * FROM meddelandetradar WHERE patient_id = ? ${villkor} ORDER BY id DESC`).all(atk.patientId).filter(t => synligFor(atk, t));
export const OMBUD_NEJ = 'Som ombud kan du inte be om förnyade recept eller kommentera vårdplanen, eftersom det gäller journalen. Det kan patienten själv eller en vårdnadshavare göra.';

function tradUt(db, t, { forInvanare, ombud = false, synliga = null }) {
  const m = meddelandenFor(db, t.id);
  const ordination = t.ordination_id ? db.query('SELECT k.namn, k.styrka FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.id = ?').get(t.ordination_id) : null;
  const plan = t.plan_id ? db.query('SELECT rubrik FROM vardplaner WHERE id = ?').get(t.plan_id) : null;
  const avgift = t.avgift_id ? db.query('SELECT * FROM tjanstavgifter WHERE id = ?').get(t.avgift_id) : null;
  return {
    id: t.id, typ: t.typ, typText: TYPER[t.typ]?.text, vardenhet: enhetNamn(db, t.enhet_id), yrkesrollText: YRKE[t.yrkesroll], status: t.status, statusText: STATUS[t.status],
    skapad: t.skapad, avslutad: t.avslutad, utfall: t.utfall,
    galler: ombud && (t.ordination_id || t.plan_id) ? null : ordination ? `${ordination.namn} ${ordination.styrka ?? ''}`.trim() : plan ? plan.rubrik : t.intygstyp ? kassa.INTYGSTYPER[t.intygstyp]?.text ?? null : null,
    // Personalen ser avgiften räknad med sitt eget filter, patienten det riktiga beloppet (kassa.js).
    avgift: avgift ? (({ belopp, text }) => ({ belopp, text }))(kassa.visatFor(db, avgift, forInvanare ? null : synliga)) : null,
    skrivetAv: forInvanare ? null : { egen: 'Patienten', vardnadshavare: 'Vårdnadshavaren', ombud: 'Ombudet' }[t.relation],
    meddelanden: m.map(x => ({
      id: x.id, fran: x.fran, tid: x.tid, text: x.text,
      // Invånaren ser vårdenheten och yrkesrollen, inte namnet på den som svarade, som i logglistan.
      vem: x.fran === 'invanare' ? avInvanare(db, t, x.invanare_id) : x.fran === 'systemet' ? 'Systemet'
        : forInvanare ? (YRKE[db.query('SELECT yrke FROM personal WHERE id = ?').get(x.personal_id)?.yrke] ?? 'Vården') : personKort(db, x.personal_id)?.namn ?? null,
      avisering: forInvanare ? null : x.avisering,
    })),
    kanSvara: t.status !== 'avslutad',
  };
}

// --- Invånaren i Min journal ---------------------------------------------------------------------------------------
// GET /api/min/journal/:id/meddelanden
export function minLista(atk) {
  const db = atk.db;
  sakra(db);
  const pid = atk.patientId;
  const ombud = atk.relation === 'ombud';
  const tradar = synligaTradar(atk);
  const ut = tradar.map(t => tradUt(db, t, { forInvanare: true, ombud }));
  // Den som läser markeras som läst på vårdens svar, bara i de trådar som den som läser ser.
  const las = db.query("UPDATE invanarmeddelanden SET lasd = ? WHERE trad_id = ? AND fran <> 'invanare' AND lasd IS NULL");
  for (const t of tradar) las.run(iso(), t.id);
  const typer = Object.entries(TYPER).filter(([k]) => !(ombud && OMBUD_UTAN.includes(k)) && (k !== 'vardplan' || planer(db, pid).length)).map(([id, t]) => ({ id, text: t.text }));
  return {
    tradar: ut, mottagare: mottagare(db, pid), typer, lakemedel: ombud ? [] : fornybara(db, pid), planer: ombud ? [] : planer(db, pid),
    intygstyper: Object.entries(kassa.INTYGSTYPER).map(([id, t]) => ({ id, text: t.text })),
    kanSkriva: tradar.filter(t => t.status !== 'avslutad').length < MAX_OPPNA,
    demoregler: DEMOREGLER,
  };
}

// POST /api/min/journal/:id/meddelanden { typ, text, enhetId?, ordinationId?, planId?, intygstyp?, akutLast? }
export function minSkapa(atk, body = {}) {
  const db = atk.db;
  sakra(db);
  const pid = atk.patientId;
  const typ = Object.hasOwn(TYPER, body.typ ?? '') ? body.typ : null;
  if (!typ) throw new Fel(400, 'Välj vad meddelandet gäller.', 'ogiltig', { falt: ['typ'] });
  // Prövas före allt annat, så att svaret är detsamma oavsett om läkemedlet eller planen finns.
  const ombud = atk.relation === 'ombud';
  if (ombud && OMBUD_UTAN.includes(typ)) throw new Fel(403, OMBUD_NEJ, 'nekad');
  const text = textIn(body.text);
  // Vid ord som kan tyda på något akut skickas inget förrän invånaren har läst rådet.
  if (AKUT.test(text) && body.akutLast !== true) return { skickat: false, akut: AKUT_TEXT };
  // Taken räknar bara de trådar som den som skriver ser, så att de inte röjer trådar som är dolda för ett ombud.
  if (synligaTradar(atk, "AND status <> 'avslutad'").length >= MAX_OPPNA) {
    throw new Fel(400, `Du har ${MAX_OPPNA} meddelanden som vården inte har avslutat. Vänta på svar innan du skriver ett nytt.`, 'ogiltig');
  }
  if (synligaTradar(atk).length >= MAX_PER_PATIENT) throw new Fel(400, 'Du har skickat många meddelanden. Ring vårdenheten.', 'ogiltig');
  let enhet = null;
  let ordinationId = null;
  let planId = null;
  let intygstyp = null;
  if (typ === 'recept') {
    const o = fornybara(db, pid).find(x => x.id === Number(body.ordinationId));
    if (!o) throw new Fel(400, 'Välj vilket läkemedel du vill förnya. Bara läkemedel du har nu kan förnyas.', 'ogiltig', { falt: ['ordinationId'] });
    ordinationId = o.id;
    enhet = vardenhetFor(db, db.query('SELECT enhet_id FROM ordinationer WHERE id = ?').get(o.id).enhet_id);
    if (db.query("SELECT 1 FROM meddelandetradar WHERE patient_id = ? AND ordination_id = ? AND status <> 'avslutad'").get(pid, o.id)) throw new Fel(400, 'Du har redan bett om att få förnya det läkemedlet. Vården behandlar det.', 'ogiltig');
  } else if (typ === 'vardplan') {
    const p = planer(db, pid).find(x => x.id === Number(body.planId));
    if (!p) throw new Fel(400, 'Välj vilken vårdplan du vill kommentera.', 'ogiltig', { falt: ['planId'] });
    planId = p.id;
    enhet = vardenhetFor(db, db.query('SELECT enhet_id FROM vardplaner WHERE id = ?').get(p.id).enhet_id);
  } else {
    const m = mottagare(db, pid);
    if (!m.length) throw new Fel(400, 'Du har ingen pågående kontakt med en vårdenhet som du kan skriva till här. Ring 1177 eller din vårdcentral.', 'ogiltig');
    enhet = body.enhetId == null ? m[0].id : m.find(x => x.id === body.enhetId)?.id;
    if (!enhet) throw new Fel(400, 'Välj en av vårdenheterna som du har kontakt med.', 'ogiltig', { falt: ['enhetId'] });
    if (typ === 'intyg') {
      intygstyp = Object.hasOwn(kassa.INTYGSTYPER, body.intygstyp ?? '') ? body.intygstyp : null;
      if (!intygstyp) throw new Fel(400, 'Välj vilket intyg du behöver.', 'ogiltig', { falt: ['intygstyp'] });
    }
  }
  const t = iso();
  const id = Number(db.query(`INSERT INTO meddelandetradar (patient_id, enhet_id, typ, yrkesroll, skapad, skapad_av_invanare, relation, ordination_id, plan_id, intygstyp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(pid, enhet, typ, TYPER[typ].yrkesroll, t, atk.invanare.id, atk.relation, ordinationId, planId, intygstyp).lastInsertRowid);
  db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, invanare_id, text, tid) VALUES (?, ?, ?, 'invanare', ?, ?, ?)").run(id, pid, enhet, atk.invanare.id, text, t);
  atk.logga(`min:meddelanden:${id}`, { handling: 'invanare_meddelande' });
  const ut = tradUt(db, tradRad(db, id), { forInvanare: true, ombud });
  return [201, { skickat: true, trad: ut, text: `Meddelandet är skickat till ${ut.vardenhet}, och en ${ut.yrkesrollText} läser det. Vården svarar inom tre arbetsdagar (demoregel). Du får svaret här.` }];
}

// POST /api/min/journal/:id/meddelanden/:tid/svar { text }
export function minSvara(atk, tid, body = {}) {
  const db = atk.db;
  const t = tradRad(db, tid);
  if (!t || t.patient_id !== atk.patientId || !synligFor(atk, t)) throw new Fel(404, 'Meddelandet finns inte.', 'saknas');
  if (t.status === 'avslutad') throw new Fel(400, 'Vården har avslutat ärendet. Skriv ett nytt meddelande om du har fler frågor.', 'ogiltig');
  const text = textIn(body.text);
  db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, invanare_id, text, tid) VALUES (?, ?, ?, 'invanare', ?, ?, ?)").run(t.id, t.patient_id, t.enhet_id, atk.invanare.id, text, iso());
  db.query("UPDATE meddelandetradar SET status = 'ny' WHERE id = ?").run(t.id);
  atk.logga(`min:meddelanden:${t.id}:svar`, { handling: 'invanare_meddelande' });
  return tradUt(db, tradRad(db, t.id), { forInvanare: true, ombud: atk.relation === 'ombud' });
}

// --- Vården ------------------------------------------------------------------------------------------------------
const kravRoll = (personal) => { if (!kanRoll(personal, 'meddelande_invanare')) throw new Fel(403, 'Din yrkesroll läser inte meddelanden från invånare.', 'nekad'); };

// GET /api/meddelanden: vårdenhetens meddelanden, utan text. Varje patient prövas med vårdrelation, och skyddad
// identitet maskeras.
export function lista(db, personal, { prova } = {}) {
  kravRoll(personal);
  sakra(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  const rader = db.query('SELECT * FROM meddelandetradar WHERE enhet_id = ? ORDER BY (status = \'avslutad\'), id DESC').all(ve).filter(t => prova(t.patient_id, t.enhet_id));
  return {
    tradar: rader.slice(0, 100).map(t => {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(t.patient_id);
      const sist = db.query('SELECT tid, fran FROM invanarmeddelanden WHERE trad_id = ? ORDER BY id DESC LIMIT 1').get(t.id);
      return {
        id: t.id, patient: { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) }, typ: t.typ, typText: TYPER[t.typ]?.text,
        yrkesroll: t.yrkesroll, yrkesrollText: YRKE[t.yrkesroll], tillDig: t.yrkesroll === personal.yrke, status: t.status, statusText: STATUS[t.status],
        skapad: t.skapad, senast: sist?.tid ?? t.skapad, vantarPaVarden: t.status === 'ny',
      };
    }),
    demoregler: DEMOREGLER,
  };
}

export const hamtaTrad = (db, id) => { const t = tradRad(db, id); if (!t) throw new Fel(404, 'Meddelandet finns inte.', 'saknas'); return t; };
// atk är prövad för patienten med handlingen meddelande_invanare. Meddelandet ska höra till min vårdenhet.
function kravTrad(atk, t) {
  kravRoll(atk.personal);
  atk.krav('meddelande_invanare', { resurs: { enhet_id: t.enhet_id }, beskrivning: `meddelande:${t.id}` });
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== t.enhet_id) throw new Fel(403, 'Meddelandet är skickat till en annan vårdenhet.', 'nekad');
}

const utfallFor = (t) => ({
  recept: [{ id: 'fornyat', text: 'Receptet är förnyat' }, { id: 'ej_fornyat', text: 'Receptet förnyas inte' }],
  intyg: [{ id: 'utfardat', text: 'Intyget är utfärdat' }, { id: 'ej_utfardat', text: 'Intyget utfärdas inte' }],
}[t.typ] ?? [{ id: 'besvarat', text: 'Besvarat' }]);

export function vardTrad(atk, t) {
  kravTrad(atk, t);
  const db = atk.db;
  atk.logga('meddelande_invanare', atk.grund(), `meddelande:${t.id}`);
  const lakare = kanRoll(atk.personal, 'ordinera');
  return {
    ...tradUt(db, t, { forInvanare: false, synliga: kassa.synligaFor(atk) }), utfall: t.utfall, utfallVal: utfallFor(t),
    kanAvsluta: t.status !== 'avslutad' && (!['recept', 'intyg'].includes(t.typ) || lakare),
    varforInte: ['recept', 'intyg'].includes(t.typ) && !lakare ? 'En läkare förnyar recept och utfärdar intyg. Ärendet ligger kvar till läkaren.' : null,
    forslag: t.typ === 'recept' ? 'Systemet skapar avgiften för förnyelsen och skriver svaret till patienten när du väljer Receptet är förnyat.' : t.typ === 'intyg' ? 'Systemet skapar avgiften för intyget och skriver svaret till patienten när du väljer Intyget är utfärdat.' : null,
  };
}

const avisera = (db, t) => {
  const p = db.query('SELECT skyddad FROM patienter WHERE id = ?').get(t.patient_id);
  return p?.skyddad ? 'Ingen avisering: patienten har skyddade personuppgifter och får bara svaret i Min journal.' : 'Sms till patienten om att det finns ett svar i Min journal, utan innehåll (simulerat).';
};

// POST /api/meddelanden/:id/svar { text }
export function vardSvara(atk, t, body = {}) {
  kravTrad(atk, t);
  const db = atk.db;
  if (t.status === 'avslutad') throw new Fel(400, 'Ärendet är avslutat.', 'ogiltig');
  const text = textIn(body.text);
  db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, personal_id, text, tid, avisering) VALUES (?, ?, ?, 'vard', ?, ?, ?, ?)").run(t.id, t.patient_id, t.enhet_id, atk.personal.id, text, iso(), avisera(db, t));
  db.query("UPDATE meddelandetradar SET status = 'besvarad' WHERE id = ?").run(t.id);
  atk.logga('meddelande_invanare', atk.grund(), `meddelande:${t.id}:svar`);
  return vardTrad(atk, tradRad(db, t.id));
}

// POST /api/meddelanden/:id/avsluta { utfall, text? }. Vid förnyat recept och utfärdat intyg skapar systemet avgiften
// och skriver svaret. Vid nej krävs att vården har förklarat varför, i svaret eller i text.
export function vardAvsluta(atk, t, body = {}) {
  kravTrad(atk, t);
  const db = atk.db;
  if (t.status === 'avslutad') throw new Fel(400, 'Ärendet är redan avslutat.', 'ogiltig');
  const val = utfallFor(t);
  const utfall = val.find(x => x.id === body.utfall)?.id ?? (val.length === 1 ? val[0].id : null);
  if (!utfall) throw new Fel(400, 'Välj hur ärendet avslutas.', 'ogiltig', { falt: ['utfall'] });
  if (['recept', 'intyg'].includes(t.typ) && !kanRoll(atk.personal, 'ordinera')) throw new Fel(403, 'En läkare förnyar recept och utfärdar intyg.', 'nekad');
  const egen = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  const harSvar = db.query("SELECT 1 FROM invanarmeddelanden WHERE trad_id = ? AND fran = 'vard'").get(t.id);
  if (['ej_fornyat', 'ej_utfardat'].includes(utfall) && !egen && !harSvar) throw new Fel(400, 'Skriv till patienten varför, innan ärendet avslutas.', 'ogiltig', { falt: ['text'] });
  if (utfall === 'besvarat' && !egen && !harSvar) throw new Fel(400, 'Svara patienten innan ärendet avslutas.', 'ogiltig', { falt: ['text'] });
  const t0 = iso();
  if (egen) db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, personal_id, text, tid, avisering) VALUES (?, ?, ?, 'vard', ?, ?, ?, ?)").run(t.id, t.patient_id, t.enhet_id, atk.personal.id, egen, t0, avisera(db, t));
  let avgift = null;
  if (utfall === 'fornyat' || utfall === 'utfardat') {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(t.patient_id);
    const a = kassa.skapaAvgift(db, { patient: p, enhetId: t.enhet_id, tjanst: utfall === 'fornyat' ? 'receptfornyelse' : 'intyg', intygstyp: t.intygstyp, av: atk.personal.id, kalla: 'meddelande', kallaId: t.id });
    avgift = a;
    // Svaret nämner inte läkemedlet, eftersom ett ombud kan läsa tråden. Vad tråden gäller visas för patienten.
    const vad = utfall === 'fornyat' ? 'Receptet är förnyat och finns på apoteket.' : `Intyget (${kassa.INTYGSTYPER[t.intygstyp]?.text.toLowerCase()}) är utfärdat och skickas till dig.`;
    // Svaret nämner inte beloppet, eftersom personalen kan läsa tråden. Patienten ser avgiften under Tider.
    const om = ' Avgiften, om det finns någon, ser du i Min journal under Tider, och du kan betala den där.';
    db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, personal_id, text, tid, avisering) VALUES (?, ?, ?, 'systemet', NULL, ?, ?, ?)").run(t.id, t.patient_id, t.enhet_id, `${vad}${om}`, iso(), avisera(db, t));
  }
  db.query("UPDATE meddelandetradar SET status = 'avslutad', avslutad = ?, avslutad_av = ?, utfall = ?, avgift_id = ? WHERE id = ?").run(t0, atk.personal.id, utfall, avgift?.id ?? null, t.id);
  atk.logga('meddelande_invanare', atk.grund(), `meddelande:${t.id}:avslutad:${utfall}`);
  return vardTrad(atk, tradRad(db, t.id));
}

// --- Invånarens begäranden hos vården ---------------------------------------------------------------------------
// Vårdadministratören på den vårdenhet som en begäran om spärr gäller registrerar den, och logggranskaren tar fram
// loggutdraget. Patienten får beskedet i Min journal, under Spärrar.
const BEGARANTEXT = { sparr: 'Spärra uppgifter', hava_sparr: 'Häva en spärr', loggutdrag: 'Loggutdrag med namn' };
const begaranFor = (db, personal) => {
  const rader = db.query("SELECT * FROM begaran WHERE status = 'skickad' ORDER BY id").all();
  const ve = vardenhetFor(db, personal.enhet_id);
  return rader.filter(b => (b.typ === 'loggutdrag' ? kanRoll(personal, 'las_logg') : kanRoll(personal, 'registrera_sparr') && b.enhet_id && vardenhetFor(db, b.enhet_id) === ve));
};

export function begaranLista(db, personal) {
  if (!kanRoll(personal, 'registrera_sparr') && !kanRoll(personal, 'las_logg')) throw new Fel(403, 'Din yrkesroll handlägger inte invånarnas begäranden.', 'nekad');
  sakra(db);
  return {
    begaran: begaranFor(db, personal).map(b => {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(b.patient_id);
      return {
        id: b.id, typ: b.typ, typText: BEGARANTEXT[b.typ], skapad: b.skapad, meddelande: b.meddelande, vardenhet: b.enhet_id ? enhetNamn(db, b.enhet_id) : null,
        patient: { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) },
        atgard: b.typ === 'sparr' ? 'Registrera spärren' : b.typ === 'hava_sparr' ? 'Häv spärren' : 'Ta fram och skicka loggutdraget',
        forklaring: b.typ === 'loggutdrag' ? 'Systemet tar fram loggutdraget med namn ur loggen och skickar det till patienten med brev (simulerat).' : 'Patienten bestämmer själv om spärren (patientdatalagen 4 kap. 4 §), så begäran registreras som den är.',
      };
    }),
  };
}

// POST /api/begaran/:id/handlagg. Utför begäran och skriver beskedet. Loggas på patienten.
export function begaranHandlagg(db, personal, id) {
  sakra(db);
  const b = begaranFor(db, personal).find(x => x.id === (Number(id) || 0));
  if (!b) throw new Fel(404, 'Begäran finns inte, eller så handläggs den av någon annan.', 'saknas');
  const t = iso();
  let besked;
  let handling;
  if (b.typ === 'sparr') {
    if (!aktivaSparrar(db, b.patient_id).includes(vardenhetFor(db, b.enhet_id))) db.query('INSERT INTO sparrar (patient_id, enhet_id, registrerad) VALUES (?, ?, ?)').run(b.patient_id, b.enhet_id, idag());
    besked = `Spärren mot ${enhetNamn(db, b.enhet_id)} är registrerad från ${idag()}. Andra vårdenheter ser inte uppgifterna därifrån utan ditt samtycke.`;
    handling = 'registrera_sparr';
  } else if (b.typ === 'hava_sparr') {
    db.query('UPDATE sparrar SET aktiv = 0 WHERE patient_id = ? AND enhet_id = ? AND aktiv = 1').run(b.patient_id, b.enhet_id);
    besked = `Spärren mot ${enhetNamn(db, b.enhet_id)} är hävd från ${idag()}.`;
    handling = 'registrera_sparr';
  } else {
    const antal = loggLista(db, { patientId: [b.patient_id] }).length;
    besked = `Loggutdraget med namn på dem som har läst din journal är framtaget (${antal} rader) och skickat till dig med brev (simulerat).`;
    handling = 'las_logg';
  }
  const ve = vardenhetFor(db, personal.enhet_id);
  db.query('INSERT INTO begaran_beslut (begaran_id, patient_id, enhet_id, beslut, besked, av, tid) VALUES (?, ?, ?, ?, ?, ?, ?)').run(b.id, b.patient_id, ve, 'utford', besked, personal.id, t);
  db.query("UPDATE begaran SET status = 'avslutad' WHERE id = ?").run(b.id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: b.patient_id, handling, resurs: `begaran:${b.id}:${b.typ}`, grund: handling === 'las_logg' ? 'logggranskning' : 'administrativ', syfte: 'Patientens begäran i Min journal' });
  return { id: b.id, status: 'avslutad', besked };
}

// Beskedet till patienten för en avslutad begäran (patientvy.js, sparrvy).
export const beskedFor = (db, begaranId) => (finns(db) ? db.query('SELECT besked, tid FROM begaran_beslut WHERE begaran_id = ?').get(begaranId) ?? null : null);
