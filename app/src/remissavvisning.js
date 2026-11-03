// Avvisad remiss med en vårdhändelse som ett läkemedel väntar på (runda 5, r4, beslut 2026-11-03).
//
// När läkaren avvisar en remiss avbokar systemet tiderna som hör till den (tidbok.efterAvvisning). Hänger en
// vårdhändelse på en sådan tid, och avvisningen tar bort den sista vårdrelationen till patienten på vårdenheten, fattas
// beslutet om läkemedlet i samma ögonblick, eftersom ingen på vårdenheten får se patienten efteråt. Den som avvisar har
// fortfarande åtkomst då, så inget undantag från inkorgens regler behövs. Läkaren väljer för varje läkemedel:
//   satt_ut   läkemedlet sätts ut med en orsak som systemet föreslår,
//   behall    vårdhändelsen sätts upp på väntelistan igen. Det kräver att den ordinerande läkaren eller någon annan
//             vårdenhet fortfarande har vårdrelation, annars visas inte valet och systemet förklarar varför,
// eller avbryter, och då avvisas inte remissen.
//
// Systemet är experten: dialogen frågar redan när läkaren väljer Avvisa, med Sätt ut förvalt och orsaken ifylld. Finns
// vårdrelationen kvar efter avvisningen visas samma fråga, men ett beslut krävs inte: utan beslut får den ordinerande
// vårdenheten raden i inkorgen (vardhandelse.avbokadeIInkorg).
//
// Behörighet. Bara läkemedel som den som avvisar får se visas och kan sättas ut (spärr och inre sekretess som vanligt).
// Andra sätts aldrig ut av avvisningen. Systemet säger då bara att det finns läkemedel som den som avvisar inte kan se,
// och den ordinerande vårdenhetens läkare får raden i inkorgen, med patientuppgifter om de har grund och annars utan,
// med en länk som kräver aktivt val eller nödåtkomst. Konsekvenserna räknas fram i en transaktion som rullas tillbaka,
// så att förhandsvisningen aldrig ändrar något. Varje beslut, utsättning och nekat försök loggas.
import { Fel, idag, addDagar } from './db.js';
import { Atkomst, vardenhetFor, harVardrelation, kanRoll } from './atkomst.js';
import * as remiss from './remiss.js';
import * as tidbok from './tidbok.js';
import * as lakemedel from './lakemedel.js';
import * as vardhandelse from './vardhandelse.js';
import * as ordinationsmallar from './ordinationsmallar.js';

export const SATT_UT_ORSAK = 'Remissen avvisades, vårdhändelsen blir inte av';
export const DOLDA_TEXT = 'Det finns läkemedel som väntar på vårdhändelsen som du inte kan se. Den ordinerande vårdenheten får besked.';
const INTE_BEHALLA = 'Behåll går inte. Efter avvisningen har varken den läkare som ordinerade läkemedlet eller någon annan vårdenhet vårdrelation till patienten, så ingen kan följa upp vårdhändelsen.';
const ROLLBACK = Symbol('rollback');
const forstaLiten = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const personalRad = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);

function kravMottagare(atk, r) {
  atk.krav('bedom_remiss');
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== r.till_enhet_id) {
    atk.logga('bedom_remiss', 'nekad', `remiss:${r.id}`, 'nekad');
    throw new Fel(403, 'Remissen är inte ställd till din vårdenhet.', 'nekad');
  }
}

// Har den ordinerande läkaren eller en annan vårdenhet än ve vårdrelation till patienten (i läget efter avvisningen)?
function grundKvar(db, o, ve) {
  const od = personalRad(db, o.ordinerad_av);
  if (od && od.aktiv !== 0 && vardenhetFor(db, od.enhet_id) !== ve && harVardrelation(db, o.patient_id, vardenhetFor(db, od.enhet_id))) return true;
  return db.query("SELECT id FROM enheter WHERE typ = 'vardenhet' AND id <> ?").all(ve).some(e => harVardrelation(db, o.patient_id, e.id));
}

// Konsekvenserna av avvisningen, räknade i en transaktion som rullas tillbaka. Ger { kravs, synliga, dolda }.
function analysera(atk, r, body) {
  const db = atk.db;
  const ve = vardenhetFor(db, r.till_enhet_id);
  const fore = vardhandelse.vantande(db, r.patient_id);
  // Vad den som avvisar får se, prövat innan avvisningen tar bort vårdrelationen.
  const ser = new Map(fore.map(k => {
    const o = lakemedel.hamtaRad(db, k.ordination_id);
    return [k.ordination_id, atk.prova('las_lakemedel', { enhet_id: o.enhet_id, gemensam: true }).tillaten];
  }));
  let ut = null;
  try {
    db.transaction(() => {
      const prov = new Atkomst(db, atk.personal, atk.patientId, atk.val, atk.handling);
      remiss.bedom(prov, r, { ...body, beslut: 'avvisad' });
      tidbok.efterAvvisning(db, remiss.hamtaRad(db, r.id), atk.personal);
      const kravs = !harVardrelation(db, r.patient_id, ve);
      const drabbade = fore.filter(k => vardhandelse.remissAvvisad(db, k.ordination_id));
      const synliga = drabbade.filter(k => ser.get(k.ordination_id)).map(k => {
        const o = lakemedel.hamtaRad(db, k.ordination_id);
        const lm = db.query('SELECT namn, styrka FROM katalog WHERE id = ?').get(o.lakemedel_id);
        const vh = db.query('SELECT vardhandelse FROM ordination_tillagg WHERE ordination_id = ?').get(o.id)?.vardhandelse || 'Planerad vårdhändelse';
        const namn = `${lm.namn} ${lm.styrka}`;
        const kanBehalla = !kravs || grundKvar(db, o, ve);
        return {
          ordinationId: o.id, lakemedel: namn, vardhandelse: vh, kravs,
          fraga: `Avvisningen avbokar tiden för ${forstaLiten(vh)}, och ${namn} väntar på den. Sätt ut eller behåll?`,
          orsak: SATT_UT_ORSAK, kanBehalla, varforInteBehalla: kanBehalla ? null : INTE_BEHALLA,
        };
      });
      ut = { kravs, synliga, dolda: drabbade.length > synliga.length ? DOLDA_TEXT : null };
      throw ROLLBACK;
    })();
  } catch (e) { if (e !== ROLLBACK) throw e; }
  return ut;
}

// GET /api/remiss/:id/avvisning. Vad en avvisning skulle göra med läkemedel som väntar på en vårdhändelse.
export function forhandsvisa(atk, r) {
  kravMottagare(atk, r);
  if (r.status !== 'mottagen') return { vardhandelser: [], dolda: null };
  const a = analysera(atk, r, { motivering: 'Förhandsvisning' });
  atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:avvisning:forhandsvisning`);
  return { vardhandelser: a.synliga, dolda: a.dolda };
}

// POST /api/remiss/:id/bedom med beslut avvisad. body.vardhandelser: [{ ordinationId, val: satt_ut|behall, orsak? }].
export function avvisa(atk, r, body = {}) {
  kravMottagare(atk, r);
  const db = atk.db;
  const a = analysera(atk, r, body);
  const val = new Map((Array.isArray(body.vardhandelser) ? body.vardhandelser : []).map(v => [Number(v?.ordinationId), v]));
  const giltigt = (x) => {
    const v = val.get(x.ordinationId);
    return v && (v.val === 'satt_ut' || (v.val === 'behall' && x.kanBehalla));
  };
  const behovs = a.synliga.filter(x => (x.kravs || val.has(x.ordinationId)) && !giltigt(x));
  const krav = (text) => {
    atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:kraver_beslut`);
    return new Fel(409, text, 'kraver_beslut', { vardhandelser: a.synliga, dolda: a.dolda });
  };
  if (behovs.length) throw krav('Avvisningen avbokar tiden för en vårdhändelse som ett läkemedel väntar på. Välj för varje läkemedel om det ska sättas ut eller behållas, eller avbryt.');
  const beslut = a.synliga.filter(x => val.has(x.ordinationId)).map(x => ({ ...x, val: val.get(x.ordinationId).val, orsak: val.get(x.ordinationId).orsak }));
  const resultat = [];
  let ut;
  try {
    db.transaction(() => {
      // Utsättningen görs först, medan den som avvisar har vårdrelation.
      for (const x of beslut.filter(b => b.val === 'satt_ut')) {
        const orsak = typeof x.orsak === 'string' && x.orsak.trim().length >= 3 ? x.orsak.trim() : SATT_UT_ORSAK;
        try { lakemedel.utsatt(atk, lakemedel.hamtaRad(db, x.ordinationId), { orsak }); } catch (e) {
          if (e.status === 400 && e.extra?.varningar) {
            throw new Fel(409, `${x.lakemedel} har särskilda observationer vid utsättning och sätts inte ut här. Avbryt och sätt ut det i läkemedelslistan först, eller behåll det.`, 'kraver_beslut', { vardhandelser: a.synliga, dolda: a.dolda });
          }
          throw e;
        }
        atk.logga('ordinera', atk.grund(), `ordination:${x.ordinationId}:utsatt:remiss_avvisad`);
        resultat.push({ ordinationId: x.ordinationId, val: 'satt_ut' });
      }
      ut = remiss.bedom(atk, r, { ...body, beslut: 'avvisad' });
      ut.avbokade = tidbok.efterAvvisning(db, remiss.hamtaRad(db, r.id), atk.personal);
      for (const x of beslut.filter(b => b.val === 'behall')) {
        if (vardhandelse.remissAvvisad(db, x.ordinationId)) vardhandelse.uppIgen(db, x.ordinationId, atk.personal.id);
        atk.logga('ordinera', atk.grund(), `ordination:${x.ordinationId}:vardhandelse_igen`);
        resultat.push({ ordinationId: x.ordinationId, val: 'behall' });
      }
      atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:avvisad`);
    })();
  } catch (e) {
    if (e.kod === 'kraver_beslut') atk.logga('bedom_remiss', atk.grund(), `remiss:${r.id}:kraver_beslut`);
    throw e;
  }
  return { ...ut, vardhandelser: resultat, dolda: a.dolda };
}

// POST /api/demo/remiss-vardhandelse (simulerat demoläge i den egna sandlådan, för klickbudgeten och användartestet).
// Birgitta Nyman (p06) remitteras från Vårdcentralen Tybble till kardiologen, får en tid för elkonvertering på remissen
// och Omeprazol som ska ges två timmar före. Ordinationen görs utan den vårdkontakt som det vanliga flödet skapar, så
// att kardiologen bara har remissen och tiden som grund, som när ordinationen är äldre än 90 dagar.
export function demo(db, personal) {
  if (!kanRoll(personal, 'ordinera')) throw new Fel(403, 'Demoläget kan bara skapas av en läkare.', 'nekad');
  const vc = new Atkomst(db, personalRad(db, 'lak-vc'), 'p06', {}, 'remittera');
  const r = remiss.skapa(vc, { tillEnhetId: 'uso-kard', fragestallning: 'Förmaksflimmer. Bedömning inför elkonvertering.', anamnes: 'Påhittad demoremiss. Förmaksflimmer sedan en månad.', prioritet: 'normal', svarSenast: addDagar(idag(), 30) });
  const adm = new Atkomst(db, personalRad(db, 'adm-kard'), 'p06', {}, 'boka');
  remiss.mottag(adm, remiss.hamtaRad(db, r.id));
  const post = tidbok.laggPaVantelista(db, { patientId: 'p06', ve: 'uso-kard', tidstyp: 'aterbesok', yrkesroll: 'lakare', orsak: 'Elkonvertering', mal: addDagar(idag(), 30), av: 'adm-kard' });
  db.query('UPDATE vantelista SET remiss_id = ? WHERE id = ?').run(r.id, post.id);
  const p = tidbok.vantelistaRad(db, post.id);
  const tid = tidbok.forslagForPost(adm, p).forslag[0];
  tidbok.boka(adm, p, { tidId: tid.tidId });
  const b = db.query("SELECT * FROM bokningar WHERE vantelista_id = ? AND status = 'bokad'").get(post.id);
  const lak = new Atkomst(db, personalRad(db, 'lak-kard'), 'p06', {}, 'ordinera');
  const bas = { lakemedelId: 'VK-NPL-0025', dosering: '1 kapsel två timmar före ingreppet', dos: 20, dosEnhet: 'mg', typ: 'tillfallig', tider: [], ordinationsorsak: 'Inför elkonvertering', uppfoljningsdatum: addDagar(idag(), 30), vardhandelse: { bokningId: b.id, forskjutningTimmar: -2 } };
  const koppling = vardhandelse.forbered(lak, bas);
  const kropp = { ...bas, vardhandelse: { ...bas.vardhandelse, text: koppling.text } };
  const tillagg = ordinationsmallar.valideraTillagg(db, kropp);
  let o;
  try { o = lakemedel.spara(lak, kropp); } catch (e) {
    if (!e.extra?.kraverKvittens) throw e;
    o = lakemedel.spara(lak, { ...kropp, kvitteradeVarningar: e.extra.kraverKvittens.map(regel => ({ regel, motivering: 'Demoläge' })) });
  }
  ordinationsmallar.sparaTillagg(db, o.ordination.id, tillagg);
  vardhandelse.knyt(lak, o.ordination.id, koppling);
  return { remissId: r.id, ordinationId: o.ordination.id, bokningId: b.id };
}
