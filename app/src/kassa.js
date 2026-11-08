// Kassan och avgifterna för tjänster (runda 10, r7, Sussa 3.4.4.1 och 3.4.4.4).
//
// Avgifterna för tjänster (förnyat recept och intyg) uppstår när läkaren förnyar ett recept eller utfärdar ett intyg som
// patienten har bett om i Min journal (invanarmeddelanden.js). De räknas och sparas alltid med det riktiga beloppet, på
// alla patientens besök och avgifter, och patienten betalar dem i Min journal eller med en simulerad faktura som skickas
// till patienten. De betalas aldrig i personalens kassa. Personalen ser bara att tjänsten är avgiftsbelagd enligt
// patientavgiftsreglerna, utan belopp, status eller frikort, så att inget i personalens svar beror på besök som
// personalen inte får se. Ekonomen ser en summa per dag och vårdenhet, utan uppgifter per patient.
//
// Kassan på vårdenheten har patientavgifterna vid besöken (tidbok.js), med återbetalning med kvitto, kassaredovisning
// per kassör och betalsätt och dagsavslut som inte kan ändras. Avgifterna för besök räknas som i ekonomi.js.
//
// Systemet är experten:
//   - Avgiften för en tjänst räknas av systemet ur patientens ålder, LMA-kort, frikort och intygstyp och skapas av sig
//     själv, så ingen behöver kunna reglerna eller räkna.
//   - Återbetalningen går samma väg som betalningen, och den som återbetalar väljer bara orsaken.
//   - Dagsavslutet räknar kassan själv per betalsätt och stämmer av kortsumman mot terminalens dagsrapport. Bara när
//     kassören har räknat något annat behövs en förklaring.
//
// Beloppen och reglerna är demoregler, inte någon regions avgifter, och betalterminalen och fakturan är simulerade.
import { Fel, iso, idag, datumAv } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, alder } from './atkomst.js';
import { hogkostnadsskyddet, AVGIFT_DEMO } from './vardkontakt.js';
import { lmaFor } from './ekonomi-schema.js';
import * as konfiguration from './konfiguration.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS tjanstavgifter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tjanst TEXT NOT NULL, intygstyp TEXT, belopp INTEGER NOT NULL,
  grund TEXT NOT NULL, text TEXT NOT NULL, skapad TEXT NOT NULL, skapad_av TEXT, kalla TEXT NOT NULL, kalla_id INTEGER,
  CHECK (tjanst IN ('receptfornyelse', 'intyg')), CHECK (belopp >= 0)
);
CREATE TRIGGER IF NOT EXISTS tjanstavgift_andras_ej BEFORE UPDATE OF tjanst, intygstyp, belopp, grund, text, skapad, skapad_av, kalla, kalla_id ON tjanstavgifter
  BEGIN SELECT RAISE(ABORT, 'En avgift ändras inte. Den återbetalas om den var fel.'); END;
CREATE TRIGGER IF NOT EXISTS tjanstavgift_raderas_ej BEFORE DELETE ON tjanstavgifter BEGIN SELECT RAISE(ABORT, 'En avgift raderas inte'); END;
CREATE TABLE IF NOT EXISTS kassabetalningar (
  id INTEGER PRIMARY KEY, avgift_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, belopp INTEGER NOT NULL, satt TEXT NOT NULL,
  tid TEXT NOT NULL, av TEXT, av_invanare TEXT, kvitto TEXT NOT NULL, terminal TEXT, text TEXT NOT NULL,
  CHECK (satt IN ('kort', 'faktura'))
);
CREATE TRIGGER IF NOT EXISTS kassabetalning_andras_ej BEFORE UPDATE OF avgift_id, belopp, satt, tid, av, av_invanare, kvitto, terminal, text ON kassabetalningar
  BEGIN SELECT RAISE(ABORT, 'En betalning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS kassabetalning_raderas_ej BEFORE DELETE ON kassabetalningar BEGIN SELECT RAISE(ABORT, 'En betalning raderas inte'); END;
CREATE TABLE IF NOT EXISTS aterbetalningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kalla TEXT NOT NULL, kalla_id INTEGER NOT NULL, belopp INTEGER NOT NULL,
  satt TEXT NOT NULL, orsak TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, kvitto TEXT NOT NULL, terminal TEXT, text TEXT NOT NULL,
  CHECK (kalla IN ('bokning')), CHECK (satt IN ('kort', 'faktura'))
);
CREATE TRIGGER IF NOT EXISTS aterbetalning_andras_ej BEFORE UPDATE OF kalla, kalla_id, belopp, satt, orsak, tid, av, kvitto, terminal, text ON aterbetalningar
  BEGIN SELECT RAISE(ABORT, 'En återbetalning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS aterbetalning_raderas_ej BEFORE DELETE ON aterbetalningar BEGIN SELECT RAISE(ABORT, 'En återbetalning raderas inte'); END;
CREATE TABLE IF NOT EXISTS kassaavslut (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, kassor TEXT NOT NULL, datum TEXT NOT NULL, tid TEXT NOT NULL, transaktioner TEXT NOT NULL,
  summor TEXT NOT NULL, terminal INTEGER NOT NULL, raknat INTEGER NOT NULL, avvikelse INTEGER NOT NULL, forklaring TEXT
);
CREATE TRIGGER IF NOT EXISTS kassaavslut_andras_ej BEFORE UPDATE ON kassaavslut BEGIN SELECT RAISE(ABORT, 'Ett dagsavslut ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS kassaavslut_raderas_ej BEFORE DELETE ON kassaavslut BEGIN SELECT RAISE(ABORT, 'Ett dagsavslut raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tjanstavgifter'").get());

// Demoregler, märkta så i gränssnittet.
export const RECEPTFORNYELSE = 100;
export const INTYGSTYPER = {
  sjukpenning: { text: 'Läkarintyg för sjukpenning till Försäkringskassan', belopp: 0, fri: 'Intyget till Försäkringskassan ingår i vården och är avgiftsfritt.' },
  resa: { text: 'Intyg för att ta med läkemedel på en resa', belopp: 300 },
  skola: { text: 'Intyg till skola, förskola eller arbetsgivare', belopp: 300 },
  forsakring: { text: 'Läkarintyg till ett försäkringsbolag', belopp: 700 },
  korkort: { text: 'Läkarintyg för körkort', belopp: 900 },
};
export const TJANSTER = { receptfornyelse: 'Förnyelse av recept', intyg: 'Intyg' };
export const ORSAKER = {
  fel_avgift: 'Avgiften var fel', dubbel: 'Patienten betalade två gånger', installt: 'Besöket blev inställt', frikort: 'Patienten hade frikort',
};
export const BETALSATT = { kort: 'Kort', faktura: 'Faktura' };
export const DEMOREGLER = `Demoregler: förnyelse av recept kostar ${RECEPTFORNYELSE} kr och är avgiftsfri för barn och unga under ${AVGIFT_DEMO.friUnder} år, från ${AVGIFT_DEMO.friFran} år och med frikort. Asylsökande med LMA-kort betalar 50 kr. Intyg kostar efter typ och omfattas inte av frikortet. Om receptförnyelsen och intyg ingår i högkostnadsskyddet sätter systemförvaltaren under Regler och parametrar, och förvalet är nej. Avgifterna för tjänster betalas i Min journal eller med faktura. Betalterminalen och fakturan är simulerade: inga pengar dras och ingen faktura skickas.`;

// --- Avgiften ------------------------------------------------------------------------------------------------------
// Avgiften för en tjänst räknas av systemet på alla patientens besök och avgifter, så att beloppet aldrig beror på vem
// som registrerar den och frikortet gäller oavsett var besöken gjordes. Svaret säger bara att frikort gäller och till
// när, som e-frikortet. Om avgiften ingår i högkostnadsskyddet är en parameter per avgiftstyp (konfiguration.js). Ingår
// den sätts avgiften ned till det som återstår, räknat på besöken och på de avgifter för tjänster som ingår.
const ingar = (db, tjanst) => { try { return konfiguration.varde(db, `avgift.hogkostnadsskydd_${tjanst}`) === true; } catch { return false; } };
function inomSkyddet(db, patient, tjanst, belopp, text) {
  const hk = hogkostnadsskyddet(db, patient);
  if (hk.frikort) return { belopp: 0, grund: 'frikort', text: `Frikort gäller till och med ${hk.frikortTill}.` };
  const fran = new Date(Date.now() - 365 * 86400_000).toISOString();
  const typer = ['receptfornyelse', 'intyg'].filter(t => ingar(db, t));
  const tjanster = finns(db) && typer.length ? db.query(`SELECT coalesce(sum(belopp), 0) AS n FROM tjanstavgifter WHERE patient_id = ? AND skapad >= ? AND tjanst IN (${typer.map(() => '?').join(', ')})`)
    .get(patient.id, fran, ...typer).n : 0;
  const kvar = Math.max(0, hk.kvar - tjanster);
  if (kvar === 0) return { belopp: 0, grund: 'frikort', text: 'Frikort gäller, eftersom högkostnadsskyddet är nått.' };
  return { belopp: Math.min(kvar, belopp), grund: 'avgift', text: `${text} Avgiften ingår i högkostnadsskyddet.` };
}

export function avgiftFor(db, patient, tjanst, intygstyp = null, dag = idag()) {
  const ar = alder(patient.fodd, dag);
  if (tjanst === 'intyg') {
    const t = Object.hasOwn(INTYGSTYPER, intygstyp ?? '') ? INTYGSTYPER[intygstyp] : null;
    if (!t) throw new Fel(400, 'Välj vilket intyg det gäller.', 'ogiltig', { falt: ['intygstyp'] });
    if (t.belopp === 0) return { belopp: 0, grund: 'avgiftsfri', text: t.fri };
    if (ingar(db, 'intyg') && !lmaFor(db, patient.id, dag)) return inomSkyddet(db, patient, 'intyg', t.belopp, `${t.text}.`);
    return { belopp: t.belopp, grund: 'avgift', text: `${t.text}: ${t.belopp} kr. Intyg omfattas inte av frikortet.` };
  }
  if (tjanst !== 'receptfornyelse') throw new Fel(400, 'Välj förnyelse av recept eller intyg.', 'ogiltig', { falt: ['tjanst'] });
  if (ar < AVGIFT_DEMO.friUnder || ar >= AVGIFT_DEMO.friFran) return { belopp: 0, grund: 'avgiftsfri', text: `Avgiftsfritt för patienter under ${AVGIFT_DEMO.friUnder} år och från ${AVGIFT_DEMO.friFran} år.` };
  if (lmaFor(db, patient.id, dag)) return { belopp: 50, grund: 'lma', text: 'Asylsökande med LMA-kort betalar 50 kr.' };
  if (ingar(db, 'receptfornyelse')) return inomSkyddet(db, patient, 'receptfornyelse', RECEPTFORNYELSE, 'Förnyelse av recept.');
  const hk = hogkostnadsskyddet(db, patient);
  if (hk.frikort) return { belopp: 0, grund: 'frikort', text: `Frikort gäller till och med ${hk.frikortTill}.` };
  return { belopp: RECEPTFORNYELSE, grund: 'avgift', text: `Förnyelse av recept: ${RECEPTFORNYELSE} kr.` };
}

const kvittoFor = (db, prefix, tabell) => `${prefix}${String(db.query(`SELECT count(*) AS n FROM ${tabell}`).get().n + 1).padStart(5, '0')}`;
// Den simulerade betalterminalen. Den godkänner alltid och svarar med en referens. Inga pengar dras.
const terminalRef = (db, slag) => `TERMINAL-DEMO-${slag}-${String(db.query('SELECT (SELECT count(*) FROM kassabetalningar) + (SELECT count(*) FROM aterbetalningar) AS n').get().n + 1).padStart(5, '0')}`;

// Skapar avgiften med det riktiga beloppet, räknat på alla patientens besök och avgifter utan filter, så att beloppet
// aldrig beror på vem som registrerar den. Patientens rätt till frikort gäller oavsett var besöken gjordes.
export function skapaAvgift(db, { patient, enhetId, tjanst, intygstyp = null, av = null, kalla = 'kassa', kallaId = null }) {
  sakra(db);
  const a = avgiftFor(db, patient, tjanst, intygstyp, idag());
  const id = Number(db.query(`INSERT INTO tjanstavgifter (patient_id, enhet_id, tjanst, intygstyp, belopp, grund, text, skapad, skapad_av, kalla, kalla_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(patient.id, vardenhetFor(db, enhetId), tjanst, tjanst === 'intyg' ? intygstyp : null, a.belopp, a.grund, a.text, iso(), av, kalla, kallaId).lastInsertRowid);
  return db.query('SELECT * FROM tjanstavgifter WHERE id = ?').get(id);
}

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const betalningFor = (db, avgiftId) => db.query('SELECT * FROM kassabetalningar WHERE avgift_id = ?').get(avgiftId) ?? null;
const aterFor = (db, kalla, id) => db.query('SELECT * FROM aterbetalningar WHERE kalla = ? AND kalla_id = ?').get(kalla, id) ?? null;

// Det personalen ser om en avgift för en tjänst: att den finns enligt reglerna, aldrig belopp, status eller frikort.
export const PERSONALENS_TEXT = 'Tjänsten är avgiftsbelagd enligt patientavgiftsreglerna. Patienten betalar i Min journal eller med faktura.';
export const forPersonal = () => ({ text: PERSONALENS_TEXT });

// --- Vårdadministratörens kassa --------------------------------------------------------------------------------------
const kravKassa = (personal) => { if (!kanRoll(personal, 'kassa')) throw new Fel(403, 'Din yrkesroll har ingen kassa.', 'nekad'); };
const minVe = (db, personal) => vardenhetFor(db, personal.enhet_id);

// En betalning i kassan: en patientavgift vid besöket (betalningar i tidbok.js).
export function hamtaBetalning(db, kalla, id) {
  const n = Number(id) || 0;
  if (kalla === 'bokning') {
    const b = db.query('SELECT x.*, s.enhet_id AS schema_enhet FROM betalningar x JOIN bokningar k ON k.id = x.bokning_id JOIN tider t ON t.id = k.tid_id JOIN scheman s ON s.id = t.schema_id WHERE x.id = ?').get(n);
    return b ? { kalla, id: b.id, patient_id: b.patient_id, enhet_id: vardenhetFor(db, b.schema_enhet), belopp: b.belopp, satt: b.satt, tid: b.tid, kvitto: b.kvitto, av: b.av, av_invanare: b.av_invanare } : null;
  }
  return null;
}

// POST /api/kassa/aterbetalning { kalla, id, orsak }. atk gäller betalningens patient med handlingen checka_in.
export function aterbetala(atk, bet, body = {}) {
  kravKassa(atk.personal);
  atk.krav('checka_in');
  const db = atk.db;
  if (bet.enhet_id !== minVe(db, atk.personal)) throw new Fel(403, 'Betalningen gjordes på en annan vårdenhet. Den återbetalas där.', 'nekad');
  if (!['kort', 'faktura'].includes(bet.satt) || bet.belopp <= 0) throw new Fel(400, 'Det finns inget betalt belopp att återbetala. Frikort och avgiftsfria besök betalas inte.', 'ogiltig');
  if (!Object.hasOwn(ORSAKER, body.orsak ?? '')) throw new Fel(400, 'Välj varför avgiften ska återbetalas.', 'ogiltig', { falt: ['orsak'] });
  if (aterFor(db, bet.kalla, bet.id)) throw new Fel(400, 'Betalningen är redan återbetald.', 'ogiltig');
  const terminal = bet.satt === 'kort' ? terminalRef(db, 'RETUR') : null;
  const text = bet.satt === 'kort' ? `${bet.belopp} kr tillbaka till kortet i den simulerade betalterminalen, referens ${terminal}. Inga pengar flyttas.` : `Kreditfaktura på ${bet.belopp} kr, simulerad. Ingen faktura skickas.`;
  const kvitto = kvittoFor(db, 'VK-DEMO-R-', 'aterbetalningar');
  db.query('INSERT INTO aterbetalningar (patient_id, enhet_id, kalla, kalla_id, belopp, satt, orsak, tid, av, kvitto, terminal, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(bet.patient_id, bet.enhet_id, bet.kalla, bet.id, bet.belopp, bet.satt, body.orsak, iso(), atk.personal.id, kvitto, terminal, text);
  atk.logga('checka_in', atk.grund(), `aterbetalning:${bet.kalla}:${bet.id}`);
  return [201, { kvitto, belopp: bet.belopp, satt: bet.satt, sattText: BETALSATT[bet.satt], orsak: ORSAKER[body.orsak], text, ursprungligtKvitto: bet.kvitto }];
}

// Kassans rader för vårdenheten en dag, utan patientuppgifter: tid, kvitto, slag, betalsätt, belopp och kassör. Avgifter för
// tjänster finns inte i kassan.
function transaktioner(db, ve, datum) {
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const ut = [];
  const pa = (t) => datumAv(new Date(t)) === datum;
  for (const b of db.query(`SELECT x.* FROM betalningar x JOIN bokningar k ON k.id = x.bokning_id JOIN tider t ON t.id = k.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE s.enhet_id IN (${ph}) ORDER BY x.id`).all(...enheter).filter(x => pa(x.tid))) {
    ut.push({ nyckel: `bokning:${b.id}`, kalla: 'bokning', id: b.id, tid: b.tid, kvitto: b.kvitto, slag: 'Patientavgift vid besöket', satt: b.satt, belopp: b.belopp, av: b.av, avInvanare: Boolean(b.av_invanare) });
  }
  if (finns(db)) {
    for (const r of db.query('SELECT * FROM aterbetalningar WHERE enhet_id = ? ORDER BY id').all(ve).filter(x => pa(x.tid))) {
      ut.push({ nyckel: `aterbetalning:${r.id}`, kalla: 'aterbetalning', id: r.id, tid: r.tid, kvitto: r.kvitto, slag: `Återbetalning (${ORSAKER[r.orsak].toLowerCase()})`, satt: r.satt, belopp: -r.belopp, av: r.av, avInvanare: false, avser: `${r.kalla}:${r.kalla_id}` });
    }
  }
  return ut.sort((a, b) => a.tid.localeCompare(b.tid));
}

const summor = (rader) => {
  const s = { kort: 0, faktura: 0, frikort: 0, avgiftsfri: 0, aterbetalt: 0, netto: 0, antal: rader.length };
  for (const r of rader) {
    if (r.belopp < 0) s.aterbetalt += -r.belopp;
    if (Object.hasOwn(s, r.satt) && ['kort', 'faktura'].includes(r.satt)) s[r.satt] += r.belopp;
    else if (['frikort', 'avgiftsfri'].includes(r.satt)) s[r.satt] += 1;
    if (['kort', 'faktura'].includes(r.satt)) s.netto += r.belopp;
  }
  return s;
};

// GET /api/kassa?datum=: dagens kassa per kassör och betalsätt, med dagsavsluten. Inga patientuppgifter.
export function kassa(db, personal, { datum = idag() } = {}) {
  kravKassa(personal);
  sakra(db);
  const ve = minVe(db, personal);
  const alla = transaktioner(db, ve, datum);
  const avslut = db.query('SELECT * FROM kassaavslut WHERE enhet_id = ? AND datum = ? ORDER BY id').all(ve, datum);
  const avslutade = new Set(avslut.flatMap(a => JSON.parse(a.transaktioner)));
  const aterbetalda = new Set(db.query('SELECT kalla, kalla_id FROM aterbetalningar WHERE enhet_id = ?').all(ve).map(r => `${r.kalla}:${r.kalla_id}`));
  const kassorer = new Map();
  for (const r of alla) {
    const k = r.avInvanare ? 'min_journal' : r.av ?? 'systemet';
    if (!kassorer.has(k)) kassorer.set(k, []);
    kassorer.get(k).push(r);
  }
  const rad = (r) => ({
    nyckel: r.nyckel, kalla: r.kalla, id: r.id, tid: r.tid, kvitto: r.kvitto, slag: r.slag, satt: r.satt, sattText: { kort: 'Kort', faktura: 'Faktura', frikort: 'Frikort', avgiftsfri: 'Avgiftsfritt' }[r.satt],
    belopp: r.belopp, avslutad: avslutade.has(r.nyckel),
    kanAterbetalas: r.kalla !== 'aterbetalning' && ['kort', 'faktura'].includes(r.satt) && r.belopp > 0 && !aterbetalda.has(`${r.kalla}:${r.id}`),
  });
  return {
    datum, vardenhet: { id: ve, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? ve }, idag: datum === idag(),
    kassorer: [...kassorer.entries()].map(([k, rader]) => {
      const oppna = rader.filter(r => !avslutade.has(r.nyckel));
      return {
        id: k, namn: k === 'min_journal' ? 'Min journal (e-tjänsten)' : k === 'systemet' ? 'Systemet' : personNamn(db, k) ?? k, du: k === personal.id,
        summa: summor(rader), oppna: summor(oppna), rader: rader.map(rad),
        kanAvsluta: k === personal.id && datum === idag() && oppna.length > 0,
        forklaring: k === 'min_journal' ? 'Betalningar i Min journal stäms av mot betalningsleverantören (simulerat), inte i en kassa på vårdenheten.' : null,
      };
    }),
    summa: summor(alla),
    avslut: avslut.map(a => avslutUt(db, a)),
    orsaker: Object.entries(ORSAKER).map(([id, text]) => ({ id, text })),
    demoregler: DEMOREGLER,
  };
}

const avslutUt = (db, a) => ({
  id: a.id, kassor: { id: a.kassor, namn: personNamn(db, a.kassor) }, datum: a.datum, tid: a.tid, summor: JSON.parse(a.summor), antal: JSON.parse(a.transaktioner).length,
  terminal: a.terminal, raknat: a.raknat, avvikelse: a.avvikelse, forklaring: a.forklaring,
  text: a.avvikelse === 0 ? 'Kortsumman stämmer med betalterminalens dagsrapport.' : `Kassören räknade ${a.raknat} kr mot terminalens ${a.terminal} kr, en skillnad på ${a.avvikelse} kr.`,
});

// POST /api/kassa/dagsavslut { raknat?, forklaring? }: kassörens egna öppna rader i dag stängs. Kortsumman jämförs med
// betalterminalens dagsrapport, som är summan av kortrader i terminalen (simulerad). Har kassören räknat något annat
// krävs en förklaring. Ett avslut ändras aldrig. Rader som kommer efter avslutet tas med i nästa avslut samma dag.
export function dagsavslut(db, personal, body = {}) {
  kravKassa(personal);
  sakra(db);
  const ve = minVe(db, personal);
  const datum = idag();
  const avslutade = new Set(db.query('SELECT transaktioner FROM kassaavslut WHERE enhet_id = ? AND datum = ?').all(ve, datum).flatMap(a => JSON.parse(a.transaktioner)));
  const oppna = transaktioner(db, ve, datum).filter(r => !r.avInvanare && r.av === personal.id && !avslutade.has(r.nyckel));
  if (!oppna.length) throw new Fel(400, 'Du har inga betalningar i dag som inte redan är avslutade.', 'ogiltig');
  const s = summor(oppna);
  const terminal = s.kort;
  const raknat = body.raknat == null || body.raknat === '' ? terminal : Number(body.raknat);
  if (!Number.isInteger(raknat) || raknat < 0 || raknat > 10_000_000) throw new Fel(400, 'Skriv det räknade beloppet i hela kronor.', 'ogiltig', { falt: ['raknat'] });
  const avvikelse = raknat - terminal;
  const forklaring = typeof body.forklaring === 'string' ? body.forklaring.trim().slice(0, 500) : '';
  if (avvikelse !== 0 && !forklaring) throw new Fel(400, `Du har räknat ${raknat} kr, men terminalen säger ${terminal} kr. Skriv vad skillnaden beror på.`, 'ogiltig', { falt: ['forklaring'] });
  const id = Number(db.query('INSERT INTO kassaavslut (enhet_id, kassor, datum, tid, transaktioner, summor, terminal, raknat, avvikelse, forklaring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ve, personal.id, datum, iso(), JSON.stringify(oppna.map(r => r.nyckel)), JSON.stringify(s), terminal, raknat, avvikelse, forklaring || null).lastInsertRowid);
  return [201, avslutUt(db, db.query('SELECT * FROM kassaavslut WHERE id = ?').get(id))];
}

// Demoläget: tider i dag på kassörens vårdenhet som inte är incheckade eller betalda.
export function demoBokningar(db, personal) {
  kravKassa(personal);
  const enheter = enheterUnder(db, minVe(db, personal));
  return db.query(`SELECT b.* FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE b.status = 'bokad' AND NOT EXISTS (SELECT 1 FROM betalningar x WHERE x.bokning_id = b.id) AND s.enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY t.start`).all(...enheter)
    .filter(b => datumAv(new Date(db.query('SELECT start FROM tider WHERE id = ?').get(b.tid_id).start)) === idag());
}

// --- Ekonomen ------------------------------------------------------------------------------------------------------
// GET /api/ekonomi/tjanstavgifter?datum=: det som patienterna har betalat för tjänster en dag, per vårdenhet och
// betalsätt. Inga uppgifter per patient.
export function tjanstRedovisning(db, personal, { datum = idag() } = {}) {
  if (!kanRoll(personal, 'faktureringsunderlag')) throw new Fel(403, 'Din yrkesroll har inte redovisningen av avgifter för tjänster.', 'nekad');
  sakra(db);
  const per = new Map();
  for (const b of db.query('SELECT * FROM kassabetalningar ORDER BY id').all().filter(x => datumAv(new Date(x.tid)) === datum)) {
    const r = per.get(b.enhet_id) ?? { vardenhet: { id: b.enhet_id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(b.enhet_id)?.namn ?? b.enhet_id }, kort: 0, faktura: 0, summa: 0 };
    r[b.satt] += b.belopp;
    r.summa += b.belopp;
    per.set(b.enhet_id, r);
  }
  return { datum, vardenheter: [...per.values()].sort((a, b) => a.vardenhet.namn.localeCompare(b.vardenhet.namn)), demoregler: DEMOREGLER };
}

// --- Min journal ---------------------------------------------------------------------------------------------------
// Patientens egna avgifter för tjänster med det riktiga beloppet. Patienten betalar med kort i Min journal eller får en
// faktura (simulerat). Ett ombud ser dem inte.
function minAvgiftUt(db, a) {
  const b = betalningFor(db, a.id);
  const status = b ? 'betald' : a.belopp === 0 ? a.grund : 'att_betala';
  return {
    id: a.id, tjanst: a.tjanst, tjanstText: a.tjanst === 'intyg' ? INTYGSTYPER[a.intygstyp]?.text ?? 'Intyg' : TJANSTER[a.tjanst], belopp: a.belopp, grund: a.grund, text: a.text, status,
    statusText: { betald: b?.satt === 'faktura' ? 'Faktura skickad' : 'Betald', att_betala: 'Att betala', avgiftsfri: 'Avgiftsfri', frikort: 'Frikort', lma: 'Att betala' }[status] ?? 'Att betala',
    skapad: a.skapad, vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(a.enhet_id)?.namn ?? null,
    betalning: b ? { satt: b.satt, sattText: BETALSATT[b.satt], tid: b.tid, kvitto: b.kvitto, text: b.text, belopp: b.belopp } : null,
  };
}
export function minaAvgifter(atk) {
  const db = atk.db;
  if (!finns(db)) return { avgifter: [], demoregler: DEMOREGLER };
  return { avgifter: db.query('SELECT * FROM tjanstavgifter WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId).map(a => minAvgiftUt(db, a)), demoregler: DEMOREGLER };
}
export function minBetala(atk, aid, body = {}) {
  const db = atk.db;
  const a = finns(db) ? db.query('SELECT * FROM tjanstavgifter WHERE id = ? AND patient_id = ?').get(Number(aid) || 0, atk.patientId) : null;
  if (!a) throw new Fel(404, 'Avgiften finns inte.', 'saknas');
  if (a.belopp === 0) throw new Fel(400, 'Det finns ingen avgift att betala.', 'ogiltig');
  if (betalningFor(db, a.id)) throw new Fel(400, 'Avgiften är redan betald.', 'ogiltig');
  if (!Object.hasOwn(BETALSATT, body.satt ?? '')) throw new Fel(400, 'Välj kort eller faktura.', 'ogiltig', { falt: ['satt'] });
  const text = body.satt === 'kort' ? 'Kortbetalning i Min journal, simulerad. Inga pengar dras.' : `Faktura på ${a.belopp} kr till dig, simulerad. Ingen faktura skickas.`;
  db.query('INSERT INTO kassabetalningar (avgift_id, patient_id, enhet_id, belopp, satt, tid, av, av_invanare, kvitto, terminal, text) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?)')
    .run(a.id, a.patient_id, a.enhet_id, a.belopp, body.satt, iso(), atk.invanare.id, kvittoFor(db, 'VK-DEMO-T-', 'kassabetalningar'), text);
  atk.logga(`min:avgift:${a.id}:betald:${body.satt}`, { handling: 'checka_in' });
  return minAvgiftUt(db, a);
}
