// Blodprodukter (runda 9, r3, Sussa 4.4.2.12): beställningen till den simulerade blodcentralen kan följas från
// upprättande till avslut. Blodgruppering och bastest beställs och besvaras som andra prover (labb.js, disciplinen
// transfusionsmedicin), blodcentralen gör förenlighetsprövningen och bereder enheterna, och varje enhet följs från
// utlämning till transfunderad eller återlämnad.
//
// Systemet är experten:
//   - Läkaren väljer produkt och antal. Systemet ser om blodgruppering och ett giltigt bastest finns bland det läkaren får
//     se, och beställer dem själv i samma klick när de saknas. Beställningen väntar sedan på svaren.
//   - Blodcentralen (simulerad) förenlighetsprövar och bereder enheter med patientens blodgrupp. Ett positivt bastest
//     stoppar beställningen med en förklaring.
//   - Vid sängen kontrollerar systemet patientens id-band mot beställningen, enhetens nummer mot blodcentralens enhet,
//     blodgruppen mot patientens och att en andra person har kontrollerat. Ett blod som inte har börjat ges inom 30
//     minuter efter utlämningen ska återlämnas, och systemet säger det.
//   - Varje steg sparas med vem och när och kan följas i beställningen.
//
// Blodcentralen, enhetsnumren och reglerna är simulerade demoregler och inget kliniskt beslutsstöd.
import { Fel, datumAv } from './db.js';
import { vardenhetFor, kanRoll } from './atkomst.js';
import * as labb from './labb.js';
import { BASTEST_TIMMAR, ANALYS } from './labb-katalog.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, MIN, TIMME, vardkontaktFor } from './specialist-hjalp.js';

export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. Blodcentralen och enhetsnumren är simulerade.';
export const BLODCENTRAL = 'Blodcentralen USÖ (simulerad)';
// Produkterna. bastest betyder att ett giltigt bastest krävs före utlämning, som för erytrocyter.
export const PRODUKTER = tabell({
  erytrocyter: { namn: 'Erytrocytkoncentrat', bastest: true, hallbarDagar: 35 },
  plasma: { namn: 'Plasma', bastest: false, hallbarDagar: 365 },
  trombocyter: { namn: 'Trombocytkoncentrat', bastest: false, hallbarDagar: 7 },
});
export const STARTA_INOM_MINUTER = 30;
export const STATUS = tabell({
  vantar_prov: 'Väntar på blodgruppering och bastest', utreds: 'Blodcentralen utreder', beredd: 'Förenlighetsprövad och beredd',
  utlamnad: 'Utlämnad till avdelningen', avslutad: 'Avslutad', makulerad: 'Makulerad',
});
export const ENHETSSTATUS = tabell({ reserverad: 'Reserverad på blodcentralen', utlamnad: 'Utlämnad', pagar: 'Transfusion pågår', transfunderad: 'Transfunderad', aterlamnad: 'Återlämnad' });

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS blod_bestallningar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nummer TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER,
  bestalld_av TEXT NOT NULL, skapad TEXT NOT NULL, produkt TEXT NOT NULL, antal INTEGER NOT NULL, indikation TEXT NOT NULL, planerad TEXT NOT NULL,
  labb_bestallning_id INTEGER, status TEXT NOT NULL, makulerad_orsak TEXT
);
CREATE INDEX IF NOT EXISTS ix_blod_best_patient ON blod_bestallningar (patient_id);
CREATE TABLE IF NOT EXISTS blod_enheter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, enhetsnummer TEXT NOT NULL UNIQUE,
  blodgrupp TEXT NOT NULL, hallbar TEXT NOT NULL, status TEXT NOT NULL, utlamnad_tid TEXT, start_tid TEXT, slut_tid TEXT, given_av TEXT, kontrollerad_av TEXT,
  reaktion TEXT, aterlamnad_tid TEXT, aterlamnad_orsak TEXT
);
CREATE TABLE IF NOT EXISTS blod_historik (
  id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, personal_id TEXT,
  handelse TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS blod_historik_andras_ej BEFORE UPDATE OF bestallning_id, tid, personal_id, handelse, detalj ON blod_historik
  BEGIN SELECT RAISE(ABORT, 'Historiken för en blodbeställning ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS blod_historik_raderas_ej BEFORE DELETE ON blod_historik BEGIN SELECT RAISE(ABORT, 'Historiken för en blodbeställning raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

const historik = (db, b, personalId, handelse, detalj, t) => db.query('INSERT INTO blod_historik (bestallning_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(b.id, b.patient_id, b.enhet_id, t, personalId, handelse, detalj);
export function bestallningRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM blod_bestallningar WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Blodbeställningen finns inte.', 'saknas');
  return r;
}
export function enhetRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM blod_enheter WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Blodenheten finns inte.', 'saknas');
  return r;
}

// ---- Blodgruppen och förenligheten -----------------------------------------------------------------------------------

export const tolkaBlodgrupp = (text) => {
  const m = typeof text === 'string' && text.match(/Blodgrupp (AB|A|B|O) RhD (positiv|negativ)/);
  return m ? `${m[1]}${m[2] === 'positiv' ? '+' : '-'}` : null;
};
// Förenlighet för erytrocyter: givarens AB0-antigen måste saknas hos mottagaren, och en RhD-negativ patient får
// RhD-negativt blod. Plasma går åt andra hållet: AB-plasma passar alla. Trombocyter ges AB0-lika i demon.
export function forenlig(produkt, givare, mottagare) {
  const abo = (g) => g.replace(/[+-]$/, ''), rh = (g) => g.endsWith('+');
  const antigen = (g) => new Set(abo(g) === 'O' ? [] : abo(g).split(''));
  if (produkt === 'plasma') return [...antigen(mottagare)].every(x => antigen(givare).has(x));
  if (produkt === 'trombocyter') return abo(givare) === abo(mottagare);
  return [...antigen(givare)].every(x => antigen(mottagare).has(x)) && (rh(mottagare) || !rh(givare));
}

// Svaren på blodgruppering och bastest för patienten, bland det den inloggade får se.
export function transfusionsprover(atk, nu = new Date()) {
  labb.forfallnaSvar(atk.db, nu);
  const synliga = labb.synligaBestallningar(atk).filter(b => !b.makulerad_tid);
  const rader = synliga.flatMap(b => atk.db.query("SELECT a.*, p.provtagen_tid FROM labb_analyser a LEFT JOIN labb_prov p ON p.id = a.prov_id WHERE a.bestallning_id = ? AND a.analys IN ('blodgruppering', 'bastest') AND a.status <> 'borttagen'").all(b.id));
  const grupp = rader.filter(a => a.analys === 'blodgruppering' && a.status === 'besvarad').sort((a, b) => b.besvarad_tid.localeCompare(a.besvarad_tid))[0];
  const gransMs = nu.getTime() - BASTEST_TIMMAR * TIMME;
  const bas = rader.filter(a => a.analys === 'bastest' && a.status === 'besvarad' && Date.parse(a.provtagen_tid ?? a.besvarad_tid) >= gransMs).sort((a, b) => b.besvarad_tid.localeCompare(a.besvarad_tid))[0];
  return {
    blodgrupp: grupp ? tolkaBlodgrupp(grupp.svar_text) : null, bastest: bas ? { positivt: bas.avvikande === 'fynd', tid: bas.provtagen_tid ?? bas.besvarad_tid, text: bas.svar_text } : null,
    vantar: rader.filter(a => a.status !== 'besvarad').map(a => a.analys),
  };
}

// Det som behövs innan blodcentralen kan bereda produkten, och vad systemet beställer själv.
export function forslag(atk, { produkt = 'erytrocyter' } = {}, nu = new Date()) {
  atk.krav('las_prover');
  if (!finns(PRODUKTER, produkt)) throw new Fel(400, 'Produkten finns inte.', 'ogiltig', { falt: ['produkt'] });
  const t = transfusionsprover(atk, nu);
  const saknas = [...(t.blodgrupp || t.vantar.includes('blodgruppering') ? [] : ['blodgruppering']),
    ...(PRODUKTER[produkt].bastest && !t.bastest && !t.vantar.includes('bastest') ? ['bastest'] : [])];
  return {
    produkter: Object.entries(PRODUKTER).map(([id, p]) => ({ id, namn: p.namn })), produkt, antal: 2, blodgrupp: t.blodgrupp, bastest: t.bastest, saknas,
    text: saknas.length ? `${saknas.map(a => ANALYS[a].namn).join(' och ')} saknas. Systemet beställer det med blodet.` : t.vantar.length ? 'Blodgruppering eller bastest är beställt och väntar på svar.' : `Blodgrupp ${t.blodgrupp} och giltigt bastest finns.`,
    demoregel: DEMOREGEL,
  };
}

// ---- Beställning och blodcentralen -----------------------------------------------------------------------------------

export function bestall(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('bestalla_prov');
  const produkt = body.produkt ?? 'erytrocyter';
  if (!finns(PRODUKTER, produkt)) throw new Fel(400, 'Välj produkt.', 'ogiltig', { falt: ['produkt'] });
  const antal = body.antal == null ? 2 : Number(body.antal);
  if (!Number.isInteger(antal) || antal < 1 || antal > 6) throw new Fel(400, 'Beställ 1 till 6 enheter. Behövs fler kontaktar du blodcentralen.', 'ogiltig', { falt: ['antal'] });
  const indikation = textFalt(body.indikation, 300);
  if (!indikation) throw new Fel(400, 'Skriv indikationen för transfusionen.', 'ogiltig', { falt: ['indikation'] });
  const planerad = body.planerad ? new Date(Date.parse(body.planerad)) : nu;
  if (!Number.isFinite(planerad.getTime())) throw new Fel(400, 'Tiden är inte en giltig tidpunkt.', 'ogiltig', { falt: ['planerad'] });
  const f = forslag(atk, { produkt }, nu);
  let labbId = null;
  db.transaction(() => {
    if (f.saknas.length) labbId = labb.bestall(atk, { analyser: f.saknas, kvitteraDubbletter: true, kommentar: `Inför transfusion av ${PRODUKTER[produkt].namn.toLocaleLowerCase('sv')}` }, nu).bestallning.id;
    const r = db.query(`INSERT INTO blod_bestallningar (nummer, patient_id, enhet_id, vardkontakt_id, bestalld_av, skapad, produkt, antal, indikation, planerad, labb_bestallning_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vantar_prov')`).run(`tmp-${Math.random()}`, atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), atk.personal.id, iso(nu), produkt, antal, indikation, iso(planerad), labbId);
    const id = Number(r.lastInsertRowid);
    db.query('UPDATE blod_bestallningar SET nummer = ? WHERE id = ?').run(`VKBL-${String(iso(nu)).slice(0, 4)}-${String(id).padStart(6, '0')}`, id);
    const b = bestallningRad(db, id);
    historik(db, b, atk.personal.id, 'upprattad', `${antal} ${PRODUKTER[produkt].namn.toLocaleLowerCase('sv')} till ${BLODCENTRAL}.${f.saknas.length ? ` ${f.saknas.map(a => ANALYS[a].namn).join(' och ')} beställt.` : ''}`, iso(nu));
  })();
  const b = db.query('SELECT * FROM blod_bestallningar WHERE patient_id = ? ORDER BY id DESC LIMIT 1').get(atk.patientId);
  blodcentralen(atk, b, nu);
  return bestallningUt(atk, bestallningRad(db, b.id), nu);
}

// Den simulerade blodcentralen: när blodgruppering och ett giltigt bastest finns förenlighetsprövar den och bereder
// enheter med patientens blodgrupp. Ett positivt bastest gör att beställningen utreds. Körs när beställningen läses.
export function blodcentralen(atk, b, nu = new Date()) {
  const db = atk.db;
  if (b.status !== 'vantar_prov') return;
  const t = transfusionsprover(atk, nu);
  if (!t.blodgrupp || (PRODUKTER[b.produkt].bastest && !t.bastest)) return;
  if (t.bastest?.positivt) {
    db.query("UPDATE blod_bestallningar SET status = 'utreds' WHERE id = ?").run(b.id);
    historik(db, b, null, 'utreds', 'Bastestet är positivt. Blodcentralen utreder antikroppen och hör av sig innan blod kan lämnas ut.', iso(nu));
    return;
  }
  const hallbar = datumAv(new Date(nu.getTime() + PRODUKTER[b.produkt].hallbarDagar * 24 * TIMME));
  db.transaction(() => {
    for (let i = 0; i < b.antal; i++) {
      const r = db.query("INSERT INTO blod_enheter (bestallning_id, patient_id, enhet_id, enhetsnummer, blodgrupp, hallbar, status) VALUES (?, ?, ?, ?, ?, ?, 'reserverad')")
        .run(b.id, b.patient_id, b.enhet_id, `tmp-${Math.random()}`, t.blodgrupp, hallbar);
      db.query('UPDATE blod_enheter SET enhetsnummer = ? WHERE id = ?').run(`DEMO${String(r.lastInsertRowid).padStart(8, '0')}`, Number(r.lastInsertRowid));
    }
    db.query("UPDATE blod_bestallningar SET status = 'beredd' WHERE id = ?").run(b.id);
    historik(db, b, null, 'beredd', `Förenlighetsprövad mot blodgrupp ${t.blodgrupp} och bastest från ${new Date(t.bastest?.tid ?? nu).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).slice(0, 16)}. ${b.antal} enheter är reserverade.`, iso(nu));
  })();
}

const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
export function bestallningUt(atk, b, nu = new Date()) {
  const db = atk.db;
  const enheter = db.query('SELECT * FROM blod_enheter WHERE bestallning_id = ? ORDER BY id').all(b.id);
  return {
    id: b.id, nummer: b.nummer, produkt: { id: b.produkt, namn: PRODUKTER[b.produkt].namn }, antal: b.antal, indikation: b.indikation, planerad: b.planerad,
    status: b.status, statusText: STATUS[b.status], bestalld: { tid: b.skapad, av: personNamn(db, b.bestalld_av) }, vardenhet: enhetKort(db, b.enhet_id), blodcentral: BLODCENTRAL,
    enheter: enheter.map(e => ({ id: e.id, enhetsnummer: e.enhetsnummer, blodgrupp: e.blodgrupp, hallbar: e.hallbar, status: e.status, statusText: ENHETSSTATUS[e.status],
      utlamnad: e.utlamnad_tid, start: e.start_tid, slut: e.slut_tid, givenAv: personNamn(db, e.given_av), kontrolleradAv: personNamn(db, e.kontrollerad_av), reaktion: e.reaktion,
      aterlamnad: e.aterlamnad_tid ? { tid: e.aterlamnad_tid, orsak: e.aterlamnad_orsak } : null,
      startaSenast: e.status === 'utlamnad' ? iso(Date.parse(e.utlamnad_tid) + STARTA_INOM_MINUTER * MIN) : null })),
    historik: db.query('SELECT * FROM blod_historik WHERE bestallning_id = ? ORDER BY id').all(b.id).map(h => ({ tid: h.tid, av: h.personal_id ? personNamn(db, h.personal_id) : BLODCENTRAL, handelse: h.handelse, detalj: h.detalj })),
    demoregel: DEMOREGEL,
  };
}

// Patientens blodbeställningar, med inre sekretess och spärr prövade på den beställande vårdenheten.
export function forPatient(atk, nu = new Date()) {
  sakra(atk.db);
  atk.krav('las_prover');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM blod_bestallningar WHERE patient_id = ? ORDER BY id DESC').all(atk.patientId), 'las_prover');
  for (const b of rader) blodcentralen(atk, b, nu);
  return { bestallningar: rader.map(b => bestallningUt(atk, bestallningRad(atk.db, b.id), nu)), demoregel: DEMOREGEL };
}

const egenVardenhet = (atk, b) => {
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== vardenhetFor(atk.db, b.enhet_id)) throw new Fel(403, 'Blodet hanteras av den beställande vårdenheten.', 'nekad');
};

// Hämtning från blodcentralen till avdelningen. Transfusionen ska starta inom 30 minuter.
export function utlamna(atk, b, nu = new Date()) {
  const db = atk.db;
  atk.krav('ge_lakemedel');
  egenVardenhet(atk, b);
  blodcentralen(atk, b, nu);
  b = bestallningRad(db, b.id);
  if (b.status !== 'beredd') throw new Fel(409, b.status === 'vantar_prov' ? 'Blodet är inte berett än. Blodcentralen väntar på blodgruppering och bastest.' : `Blodet kan inte lämnas ut: ${STATUS[b.status].toLocaleLowerCase('sv')}.`, 'ogiltig');
  db.transaction(() => {
    db.query("UPDATE blod_enheter SET status = 'utlamnad', utlamnad_tid = ? WHERE bestallning_id = ? AND status = 'reserverad'").run(iso(nu), b.id);
    db.query("UPDATE blod_bestallningar SET status = 'utlamnad' WHERE id = ?").run(b.id);
    historik(db, b, atk.personal.id, 'utlamnad', `Hämtat från blodcentralen klockan ${klocka(nu)}. Starta transfusionen senast klockan ${klocka(nu.getTime() + STARTA_INOM_MINUTER * MIN)}.`, iso(nu));
  })();
  return bestallningUt(atk, bestallningRad(db, b.id), nu);
}

// Kontrollen vid sängen och starten av transfusionen. armband är det som läses från patientens id-band, enhetsnummer
// det som läses från påsen och kontrollant den andra personen som har gjort kontrollen.
export function starta(atk, e, body = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('ge_lakemedel');
  const b = bestallningRad(db, e.bestallning_id);
  egenVardenhet(atk, b);
  if (e.status !== 'utlamnad') throw new Fel(409, 'Enheten är inte utlämnad till avdelningen.', 'ogiltig');
  if (nu.getTime() > Date.parse(e.utlamnad_tid) + STARTA_INOM_MINUTER * MIN) throw new Fel(409, `Det har gått mer än ${STARTA_INOM_MINUTER} minuter sedan blodet lämnades ut. Återlämna enheten till blodcentralen.`, 'for_sent');
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(e.patient_id);
  if (String(body.armband ?? '').replace(/\D/g, '') !== p.personnummer) throw new Fel(409, 'Id-bandet hör inte till patienten som blodet är berett för. Ge inte blodet.', 'fel_patient');
  if (body.enhetsnummer !== e.enhetsnummer) throw new Fel(409, 'Enhetsnumret på påsen stämmer inte med den beredda enheten. Ge inte blodet.', 'fel_enhet');
  const t = transfusionsprover(atk, nu);
  if (!t.blodgrupp || !forenlig(b.produkt, e.blodgrupp, t.blodgrupp)) throw new Fel(409, `Enhetens blodgrupp ${e.blodgrupp} är inte förenlig med patientens${t.blodgrupp ? ` blodgrupp ${t.blodgrupp}` : ''}. Ge inte blodet och kontakta blodcentralen.`, 'oforenlig');
  const k = typeof body.kontrollant === 'string' ? db.query('SELECT * FROM personal WHERE id = ? AND aktiv = 1').get(body.kontrollant) : null;
  if (!k || k.id === atk.personal.id || !kanRoll(k, 'ge_lakemedel') || vardenhetFor(db, k.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) {
    throw new Fel(400, 'Kontrollen vid sängen görs av två personer. Välj en annan sjuksköterska eller läkare på vårdenheten som har kontrollerat med dig.', 'ogiltig', { falt: ['kontrollant'] });
  }
  db.query("UPDATE blod_enheter SET status = 'pagar', start_tid = ?, given_av = ?, kontrollerad_av = ? WHERE id = ?").run(iso(nu), atk.personal.id, k.id, e.id);
  historik(db, b, atk.personal.id, 'start', `Enhet ${e.enhetsnummer} (${e.blodgrupp}) startad. Kontrollerad vid sängen med ${k.namn}.`, iso(nu));
  return bestallningUt(atk, bestallningRad(db, b.id), nu);
}

// Avslutad transfusion, med eventuell reaktion. När alla enheter är transfunderade eller återlämnade är beställningen klar.
export function avsluta(atk, e, body = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('ge_lakemedel');
  const b = bestallningRad(db, e.bestallning_id);
  egenVardenhet(atk, b);
  if (e.status !== 'pagar') throw new Fel(409, 'Transfusionen av enheten har inte startat.', 'ogiltig');
  const reaktion = textFalt(body.reaktion, 300) || null;
  db.query("UPDATE blod_enheter SET status = 'transfunderad', slut_tid = ?, reaktion = ? WHERE id = ?").run(iso(nu), reaktion, e.id);
  historik(db, b, atk.personal.id, 'transfunderad', `Enhet ${e.enhetsnummer} transfunderad.${reaktion ? ` Reaktion: ${reaktion} Rapportera till blodcentralen.` : ' Ingen reaktion.'}`, iso(nu));
  klarOm(db, atk, b, nu);
  return bestallningUt(atk, bestallningRad(db, b.id), nu);
}

export function aterlamna(atk, e, body = {}, nu = new Date()) {
  const db = atk.db;
  atk.krav('ge_lakemedel');
  const b = bestallningRad(db, e.bestallning_id);
  egenVardenhet(atk, b);
  if (!['utlamnad', 'reserverad'].includes(e.status)) throw new Fel(409, 'Enheten kan inte återlämnas.', 'ogiltig');
  const orsak = textFalt(body.orsak, 200) || (e.utlamnad_tid && nu.getTime() > Date.parse(e.utlamnad_tid) + STARTA_INOM_MINUTER * MIN ? `Inte startad inom ${STARTA_INOM_MINUTER} minuter` : '');
  if (!orsak) throw new Fel(400, 'Ange varför enheten återlämnas.', 'ogiltig', { falt: ['orsak'] });
  db.query("UPDATE blod_enheter SET status = 'aterlamnad', aterlamnad_tid = ?, aterlamnad_orsak = ? WHERE id = ?").run(iso(nu), orsak, e.id);
  historik(db, b, atk.personal.id, 'aterlamnad', `Enhet ${e.enhetsnummer} återlämnad: ${orsak}.`, iso(nu));
  klarOm(db, atk, b, nu);
  return bestallningUt(atk, bestallningRad(db, b.id), nu);
}

function klarOm(db, atk, b, nu) {
  const kvar = db.query("SELECT count(*) AS n FROM blod_enheter WHERE bestallning_id = ? AND status NOT IN ('transfunderad', 'aterlamnad')").get(b.id).n;
  if (kvar) return;
  db.query("UPDATE blod_bestallningar SET status = 'avslutad' WHERE id = ?").run(b.id);
  historik(db, b, atk.personal.id, 'avslutad', 'Alla enheter är transfunderade eller återlämnade.', iso(nu));
}

