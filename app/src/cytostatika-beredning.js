// Beredningsenheten för cytostatika (runda 11, r4, Sussa 4.8.1.2 och 4.8.1.5): arbetslistan med de godkända kurerna,
// beredningen som farmaceuten signerar i sin egen inloggning med batch och kontrollmätt volym, lagret med batcher och
// utgångsdatum, spårbarheten från en batch till varje patient som har fått den, kapaciteten per dag och uppföljningen.
//
// Systemet är experten:
//   - Arbetslistan visar varje dos med beräkningen ur beredningsordern: volym läkemedel ur stamlösningen, bärarlösning,
//     total volym, infusionstid och hållbarhet. Systemet föreslår den batch som går ut först och som räcker.
//   - Batchen skannas eller väljs ur förslaget, så att inget behöver skrivas. Systemet nekar fel substans, en utgången
//     eller kasserad batch och en batch som inte räcker, och prövar den kontrollmätta volymen mot beräkningen (demoregel:
//     högst 5 procents avvikelse). För tabletter räknar systemet antalet ur dosen och tar dem ur lagret.
//   - Lagret säger vilka batcher som har gått ut eller snart går ut, och om lagret räcker till de kurer som är
//     planerade de kommande två veckorna.
//   - Beredningsenheten styr hur många kurer den tar emot per dag. Läkaren får veta när en dag är full och vilken dag
//     som har plats (cytostatika.js).
//
// Behörighet: handlingen bereda_cytostatika och att personen arbetar på beredningsenheten. Beredningsenheten ser bara
// beredningsordern (namn, personnummer för etiketten, vårdenhet och doser), aldrig journalen. Beställningen är skickad
// till beredningsenheten av vårdenheten, så varje patient som visas loggas med grunden beställning. En patient med
// skyddade personuppgifter visas som skyddad, och etiketten bär då bara kontrollkoden.
//
// Lagret, batcherna och gränserna är demoregler. Beredningsenheten finns bara i demon.
import { Fel, datumAv, addDagar, lokalTid } from './db.js';
import { kanRoll, vardenhetFor, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { tabell, finns, personNamn, enhetsnamn, textFalt, iso, DAG } from './specialist-hjalp.js';
import * as cyto from './cytostatika.js';

export const DEMOREGEL = 'Demoregler: lagret, batcherna, gränsen för kontrollmätningen och kapaciteten. Beredningsenheten finns bara i demon.';
export const KONTROLL_PROCENT = 5;
export const GAR_UT_DAGAR = 30;
// Förpackningarna i lagret (demoregel). ml för lösningar och tabletter för kapecitabin.
export const VAROR = tabell({
  epirubicin: { namn: 'Epirubicin 2 mg/ml', lakemedel: 'epirubicin', enhet: 'ml', perForpackning: 100 },
  cyklofosfamid: { namn: 'Cyklofosfamid 20 mg/ml', lakemedel: 'cyklofosfamid', enhet: 'ml', perForpackning: 100 },
  karboplatin: { namn: 'Karboplatin 10 mg/ml', lakemedel: 'karboplatin', enhet: 'ml', perForpackning: 100 },
  'kapecitabin-500': { namn: 'Kapecitabin 500 mg', lakemedel: 'kapecitabin', styrka: 500, enhet: 'tabletter', perForpackning: 120 },
  'kapecitabin-150': { namn: 'Kapecitabin 150 mg', lakemedel: 'kapecitabin', styrka: 150, enhet: 'tabletter', perForpackning: 60 },
});

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS cyto_lager (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vara TEXT NOT NULL, batch TEXT NOT NULL, utgang TEXT NOT NULL, mottaget REAL NOT NULL, kvar REAL NOT NULL,
  mottagen TEXT NOT NULL, mottagen_av TEXT, kasserad TEXT, kasserad_av TEXT, kasserad_orsak TEXT, kasserad_mangd REAL, UNIQUE (vara, batch)
);
CREATE TABLE IF NOT EXISTS cyto_beredningar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dos_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, beredd_av TEXT NOT NULL,
  batcher TEXT NOT NULL, berakning_ml REAL, uppmatt_ml REAL, avvikelse_procent REAL, godkand_tid TEXT
);
CREATE TRIGGER IF NOT EXISTS cyto_beredning_andras_ej BEFORE UPDATE ON cyto_beredningar BEGIN SELECT RAISE(ABORT, 'En signerad beredning ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS cyto_beredning_raderas_ej BEFORE DELETE ON cyto_beredningar BEGIN SELECT RAISE(ABORT, 'En signerad beredning raderas inte.'); END;
CREATE TABLE IF NOT EXISTS cyto_kontrollmatningar (
  id INTEGER PRIMARY KEY, dos_id INTEGER NOT NULL, tid TEXT NOT NULL, personal_id TEXT NOT NULL, berakning_ml REAL NOT NULL, uppmatt_ml REAL NOT NULL, avvikelse_procent REAL NOT NULL
);
`;
const har = new WeakSet();
export function sakra(db) {
  cyto.sakra(db);
  if (!har.has(db)) { db.exec(SCHEMA); har.add(db); }
}

// Lagret byggs första gången beredningsenheten används, med datum räknade från då: två batcher av varje vara, där den
// ena går ut först, och en utgången batch av epirubicin som ska kasseras.
function sakraLager(db, nu) {
  sakra(db);
  if (db.query('SELECT 1 FROM cyto_lager LIMIT 1').get()) return;
  const d = datumAv(nu);
  const ins = db.query('INSERT INTO cyto_lager (vara, batch, utgang, mottaget, kvar, mottagen) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 1;
  for (const [id, v] of Object.entries(VAROR)) {
    const kod = id.replace('-', '').slice(0, 4).toUpperCase();
    ins.run(id, `${kod}${String(n++).padStart(4, '0')}`, addDagar(d, 20), v.perForpackning * 2, v.perForpackning * 2, iso(nu.getTime() - 40 * DAG));
    ins.run(id, `${kod}${String(n++).padStart(4, '0')}`, addDagar(d, 200), v.perForpackning * 10, v.perForpackning * 10, iso(nu.getTime() - 10 * DAG));
  }
  ins.run('epirubicin', 'EPIR0099', addDagar(d, -3), 100, 60, iso(nu.getTime() - 200 * DAG));
}

const logga = (db, personal, resurs, { patientId = null, resultat = 'tillaten' } = {}) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: patientId, handling: 'bereda_cytostatika', resurs,
  grund: resultat === 'nekad' ? 'nekad' : patientId ? 'bestallning' : 'administrativ', resultat });

// Bara den som har handlingen och arbetar på beredningsenheten. Ett nekat försök loggas.
export function kravBeredare(db, personal, resurs = 'cyto_beredning') {
  if (!kanRoll(personal, 'bereda_cytostatika') || vardenhetFor(db, personal.enhet_id) !== cyto.BEREDNINGSENHET_ID) {
    logga(db, personal, resurs, { resultat: 'nekad' });
    throw new Fel(403, `Beredningen görs av farmaceuterna på ${enhetsnamn(db, cyto.BEREDNINGSENHET_ID)}.`, 'nekad');
  }
}

const lagerRader = (db, vara) => db.query('SELECT * FROM cyto_lager WHERE vara = ? ORDER BY utgang, id').all(vara);
const anvandbar = (l, dag) => !l.kasserad && l.utgang >= dag && l.kvar > 0;
// Batchen som går ut först och som räcker till mängden (först ut, först in efter utgångsdatum).
export const forslagBatch = (db, vara, mangd, dag) => lagerRader(db, vara).find(l => anvandbar(l, dag) && l.kvar >= mangd) ?? null;

const varaFor = (lakemedel, styrka = null) => Object.keys(VAROR).find(k => VAROR[k].lakemedel === lakemedel && (styrka == null || VAROR[k].styrka === styrka));
// Det som en dos tar ur lagret: ml för en lösning, tabletter per styrka för en hel cykel med tabletter.
function behovFor(o) {
  if (o.peroral) return (o.tabletterTotalt ?? []).map(t => ({ vara: varaFor(o.lakemedelId, t.styrka), mangd: t.antal }));
  return [{ vara: varaFor(o.lakemedelId), mangd: o.volymLakemedel }];
}

// Doser till beredningsenheten: godkända kurer från vårdenheterna på USÖ.
function internaDoser(db, statusar) {
  return db.query(`SELECT d.*, c.dag1, c.nummer AS cykel, c.behandling_id FROM cyto_doser d JOIN cyto_cykler c ON c.id = d.cykel_id WHERE d.status IN (${statusar.map(() => '?').join(', ')}) ORDER BY c.dag1, d.id`)
    .all(...statusar).filter(d => cyto.beredsInternt(db, d.enhet_id));
}
const patientFor = (db, pid) => {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
  return { namn: visningsnamn(p, false), personnummer: visningsPnr(p, false), skyddad: Boolean(p.skyddad) };
};

function dosRadUt(db, d, dag) {
  const b = cyto.behandlingRad(db, d.behandling_id);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id);
  const o = cyto.dosOrder(db, d, b, p);
  // En patient med skyddade personuppgifter får en etikett med bara kontrollkoden.
  if (p.skyddad && o.etikettText) o.etikettText = `Skyddad identitet. Kontrollkod ${d.etikett}. ${o.etikettText.split('. ').slice(1).join('. ')}`;
  const ber = db.query('SELECT * FROM cyto_beredningar WHERE dos_id = ?').get(d.id);
  return { dosId: d.id, dag1: d.dag1, cykel: d.cykel, regim: cyto.regimFor(db, b).namn, vardenhet: enhetsnamn(db, vardenhetFor(db, d.enhet_id)), patient: patientFor(db, d.patient_id), ...o,
    hallbarTimmar: o.peroral ? null : cyto.HALLBAR_TIMMAR,
    forslag: d.status === 'att_bereda' ? behovFor(o).map(x => { const f = forslagBatch(db, x.vara, x.mangd, dag); return { vara: x.vara, namn: VAROR[x.vara].namn, mangd: x.mangd, enhet: VAROR[x.vara].enhet, batch: f?.batch ?? null, utgang: f?.utgang ?? null }; }) : [],
    beredning: ber ? { tid: ber.tid, av: personNamn(db, ber.beredd_av), batcher: JSON.parse(ber.batcher), uppmattMl: ber.uppmatt_ml, avvikelseProcent: ber.avvikelse_procent } : null };
}

// GET /api/beredning/arbetslista. Doserna som ska beredas, dag för dag, och de som är beredda i dag. Varje patient som
// visas loggas med grunden beställning.
export function arbetslista(db, personal, nu = new Date()) {
  kravBeredare(db, personal, '/api/beredning/arbetslista');
  sakraLager(db, nu);
  const dag = datumAv(nu);
  const start = lokalTid(dag, '00:00');
  const att = internaDoser(db, ['att_bereda']);
  const beredda = internaDoser(db, ['beredd', 'mottagen', 'vantar_kontroll', 'kontrollerad', 'pagar', 'pausad', 'given', 'avbruten', 'overlamnad']).filter(d => d.beredd_tid && d.beredd_tid >= start);
  const loggade = new Set();
  for (const d of [...att, ...beredda]) if (!loggade.has(d.patient_id)) { loggade.add(d.patient_id); logga(db, personal, '/api/beredning/arbetslista', { patientId: d.patient_id }); }
  const dagar = [...new Set(att.map(d => d.dag1))];
  return {
    enhet: { id: cyto.BEREDNINGSENHET_ID, namn: enhetsnamn(db, cyto.BEREDNINGSENHET_ID) },
    attBereda: dagar.map(x => ({ datum: x, kapacitet: cyto.kapacitetFor(db, x), doser: att.filter(d => d.dag1 === x).map(d => dosRadUt(db, d, dag)) })),
    bereddaIdag: beredda.map(d => dosRadUt(db, d, dag)),
    kapacitet: Array.from({ length: 14 }, (_, i) => cyto.kapacitetFor(db, addDagar(dag, i))),
    text: `Systemet föreslår den batch som går ut först. Skanna förpackningen eller välj förslaget, kontrollmät volymen och signera. Den uppmätta volymen får avvika högst ${KONTROLL_PROCENT} procent från beräkningen.`,
    demoregel: DEMOREGEL,
  };
}

const batchUt = (l) => ({ id: l.id, batch: l.batch, utgang: l.utgang, kvar: l.kvar });
// POST /api/beredning/dos/:id/bered. { batch } skannad eller vald för en lösning och { uppmattMl } kontrollmätt volym.
// För tabletter väljer systemet batcherna själv, eller tar { batcher: { vara: batch } }.
export function bered(db, personal, dosId, body = {}, nu = new Date()) {
  kravBeredare(db, personal, `cyto_dos:${Number(dosId) || 0}`);
  sakraLager(db, nu);
  const d = cyto.dosRad(db, dosId);
  if (!cyto.beredsInternt(db, d.enhet_id)) throw new Fel(404, 'Dosen finns inte.', 'saknas');
  const c = cyto.cykelRad(db, d.cykel_id);
  const b = cyto.behandlingRad(db, c.behandling_id);
  if (c.status !== 'godkand' || d.status !== 'att_bereda') throw new Fel(409, d.status === 'ordinerad' ? 'Kuren är inte godkänd av läkaren, så den bereds inte.' : 'Dosen är redan beredd.', 'ogiltig');
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id);
  const o = cyto.dosOrder(db, d, b, p);
  const dag = datumAv(nu);
  const uttag = [];
  for (const x of behovFor(o)) {
    const valt = o.peroral ? (body.batcher && typeof body.batcher === 'object' ? body.batcher[x.vara] : null) : body.batch;
    let l;
    if (valt == null || valt === '') {
      if (!o.peroral) throw new Fel(400, 'Skanna förpackningen eller välj batchen som systemet föreslår.', 'ogiltig', { falt: ['batch'] });
      l = forslagBatch(db, x.vara, x.mangd, dag);
      if (!l) throw new Fel(409, `Det finns ingen batch av ${VAROR[x.vara].namn} som räcker till ${x.mangd} ${VAROR[x.vara].enhet}. Ta emot en ny leverans.`, 'lager');
    } else {
      const kod = String(valt).trim().toUpperCase();
      l = db.query('SELECT * FROM cyto_lager WHERE batch = ?').get(kod);
      if (!l || l.vara !== x.vara) throw new Fel(409, `Batchen ${kod} är inte ${VAROR[x.vara].namn}. Ta rätt förpackning.`, 'fel_batch');
      if (l.kasserad) throw new Fel(409, `Batchen ${kod} är kasserad och får inte användas.`, 'fel_batch');
      if (l.utgang < dag) throw new Fel(409, `Batchen ${kod} gick ut ${l.utgang}. Kassera den och ta en annan.`, 'utgangen');
      if (l.kvar < x.mangd) throw new Fel(409, `Det finns ${l.kvar} ${VAROR[x.vara].enhet} kvar i batchen ${kod}, och dosen behöver ${x.mangd}. Ta en annan batch.`, 'lager');
    }
    uttag.push({ lagerId: l.id, vara: x.vara, batch: l.batch, utgang: l.utgang, mangd: x.mangd, enhet: VAROR[x.vara].enhet });
  }
  let uppmatt = null, avvikelse = null;
  if (!o.peroral) {
    uppmatt = Number(String(body.uppmattMl ?? '').replace(',', '.'));
    if (!Number.isFinite(uppmatt) || uppmatt <= 0 || uppmatt > 2000) throw new Fel(400, 'Skriv den kontrollmätta volymen läkemedel i ml.', 'ogiltig', { falt: ['uppmattMl'] });
    avvikelse = Number(((Math.abs(uppmatt - o.volymLakemedel) / o.volymLakemedel) * 100).toFixed(1));
    db.query('INSERT INTO cyto_kontrollmatningar (dos_id, tid, personal_id, berakning_ml, uppmatt_ml, avvikelse_procent) VALUES (?, ?, ?, ?, ?, ?)').run(d.id, iso(nu), personal.id, o.volymLakemedel, uppmatt, avvikelse);
    if (avvikelse > KONTROLL_PROCENT) {
      logga(db, personal, `cyto_dos:${d.id}:kontrollmatning`, { patientId: d.patient_id });
      throw new Fel(409, `Den uppmätta volymen ${String(uppmatt).replace('.', ',')} ml avviker ${String(avvikelse).replace('.', ',')} procent från beräkningen ${String(o.volymLakemedel).replace('.', ',')} ml. Gränsen är ${KONTROLL_PROCENT} procent. Dra upp på nytt.`, 'kontroll');
    }
  }
  db.transaction(() => {
    for (const u of uttag) db.query('UPDATE cyto_lager SET kvar = kvar - ? WHERE id = ?').run(u.mangd, u.lagerId);
    db.query('INSERT INTO cyto_beredningar (dos_id, patient_id, enhet_id, tid, beredd_av, batcher, berakning_ml, uppmatt_ml, avvikelse_procent, godkand_tid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(d.id, d.patient_id, d.enhet_id, iso(nu), personal.id, JSON.stringify(uttag.map(({ lagerId, ...u }) => u)), o.peroral ? null : o.volymLakemedel, uppmatt, avvikelse, c.godkand_tid);
    db.query("UPDATE cyto_doser SET status = 'beredd', beredd_tid = ?, volym_ml = ? WHERE id = ?").run(iso(nu), o.peroral ? null : o.totalVolym, d.id);
    db.query('INSERT INTO cyto_historik (behandling_id, patient_id, enhet_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)').run(b.id, b.patient_id, b.enhet_id, iso(nu), personal.id, 'beredd',
      `${o.lakemedel} ${o.dos} mg beredd och signerad på ${enhetsnamn(db, cyto.BEREDNINGSENHET_ID)}, batch ${uttag.map(u => u.batch).join(' och ')}${uppmatt != null ? `, kontrollmätt ${String(uppmatt).replace('.', ',')} ml` : ''}.`);
  })();
  logga(db, personal, `cyto_dos:${d.id}:beredd`, { patientId: d.patient_id });
  return { dos: dosRadUt(db, { ...cyto.dosRad(db, d.id), dag1: c.dag1, cykel: c.nummer, behandling_id: b.id }, dag), text: `${o.lakemedel} ${o.dos} mg är beredd och signerad. Avdelningen ser att den är klar.` };
}

// GET /api/beredning/lager. Varje vara med batcherna, vad som går ut och om lagret räcker till de planerade kurerna.
export function lager(db, personal, nu = new Date()) {
  kravBeredare(db, personal, '/api/beredning/lager');
  sakraLager(db, nu);
  const dag = datumAv(nu);
  const om14 = addDagar(dag, 14);
  // Behovet: doser till beredningsenheten som inte är beredda, för kurer de kommande två veckorna.
  const behov = {};
  for (const d of internaDoser(db, ['ordinerad', 'att_bereda']).filter(x => x.dag1 <= om14)) {
    const b = cyto.behandlingRad(db, d.behandling_id);
    for (const x of behovFor(cyto.dosOrder(db, d, b, db.query('SELECT * FROM patienter WHERE id = ?').get(d.patient_id)))) behov[x.vara] = (behov[x.vara] ?? 0) + x.mangd;
  }
  return {
    varor: Object.entries(VAROR).map(([id, v]) => {
      const rader = lagerRader(db, id);
      const kvar = rader.filter(l => anvandbar(l, dag)).reduce((s, l) => s + l.kvar, 0);
      const b = Number((behov[id] ?? 0).toFixed(1));
      return { id, namn: v.namn, enhet: v.enhet, perForpackning: v.perForpackning, kvar: Number(kvar.toFixed(1)), behov14: b, racker: kvar >= b,
        text: kvar >= b ? `Räcker till de kurer som är planerade de kommande två veckorna.` : `Räcker inte: kurerna de kommande två veckorna behöver ${b} ${v.enhet}. Beställ ${Math.ceil((b - kvar) / v.perForpackning)} ${Math.ceil((b - kvar) / v.perForpackning) === 1 ? 'förpackning' : 'förpackningar'}.`,
        batcher: rader.map(l => ({ ...batchUt(l), status: l.kasserad ? 'kasserad' : l.utgang < dag ? 'utgangen' : addDagar(dag, GAR_UT_DAGAR) >= l.utgang ? 'gar_ut' : l.kvar <= 0 ? 'slut' : 'ok',
          mottagen: l.mottagen, kasserad: l.kasserad ? { tid: l.kasserad, av: personNamn(db, l.kasserad_av), orsak: l.kasserad_orsak, mangd: l.kasserad_mangd } : null })) };
    }),
    demoregel: DEMOREGEL,
  };
}

// POST /api/beredning/lager. En leverans tas emot: vara, batch, utgångsdatum och antal förpackningar.
export function taEmotBatch(db, personal, body = {}, nu = new Date()) {
  kravBeredare(db, personal, 'cyto_lager');
  sakraLager(db, nu);
  if (!finns(VAROR, body.vara)) throw new Fel(400, 'Välj vara.', 'ogiltig', { falt: ['vara'] });
  const batch = String(body.batch ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(batch)) throw new Fel(400, 'Batchnumret har 4 till 20 versaler, siffror eller bindestreck. Skanna förpackningen.', 'ogiltig', { falt: ['batch'] });
  if (db.query('SELECT 1 FROM cyto_lager WHERE batch = ?').get(batch)) throw new Fel(409, `Batchen ${batch} finns redan i lagret.`, 'ogiltig', { falt: ['batch'] });
  const utgang = body.utgang;
  if (typeof utgang !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(utgang) || utgang <= datumAv(nu)) throw new Fel(400, 'Utgångsdatumet ska vara efter i dag, ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['utgang'] });
  const antal = Number(body.antal ?? 1);
  if (!Number.isInteger(antal) || antal < 1 || antal > 50) throw new Fel(400, 'Ta emot 1 till 50 förpackningar.', 'ogiltig', { falt: ['antal'] });
  const mangd = antal * VAROR[body.vara].perForpackning;
  db.query('INSERT INTO cyto_lager (vara, batch, utgang, mottaget, kvar, mottagen, mottagen_av) VALUES (?, ?, ?, ?, ?, ?, ?)').run(body.vara, batch, utgang, mangd, mangd, iso(nu), personal.id);
  logga(db, personal, `cyto_lager:${batch}`);
  return { text: `${antal} ${antal === 1 ? 'förpackning' : 'förpackningar'} ${VAROR[body.vara].namn}, batch ${batch}, är mottagna.`, lager: lager(db, personal, nu) };
}

export function kassera(db, personal, id, body = {}, nu = new Date()) {
  kravBeredare(db, personal, 'cyto_lager');
  sakraLager(db, nu);
  const l = db.query('SELECT * FROM cyto_lager WHERE id = ?').get(Number(id));
  if (!l) throw new Fel(404, 'Batchen finns inte.', 'saknas');
  if (l.kasserad) throw new Fel(409, 'Batchen är redan kasserad.', 'ogiltig');
  const orsak = textFalt(body.orsak, 200) || (l.utgang < datumAv(nu) ? 'Utgången' : '');
  if (!orsak) throw new Fel(400, 'Skriv varför batchen kasseras.', 'ogiltig', { falt: ['orsak'] });
  db.query('UPDATE cyto_lager SET kasserad = ?, kasserad_av = ?, kasserad_orsak = ?, kasserad_mangd = kvar, kvar = 0 WHERE id = ?').run(iso(nu), personal.id, orsak, l.id);
  logga(db, personal, `cyto_lager:${l.batch}:kasserad`);
  return { text: `Batchen ${l.batch} är kasserad, ${l.kvar} ${VAROR[l.vara].enhet}.`, lager: lager(db, personal, nu) };
}

// GET /api/beredning/sparbarhet?batch=X. Varje dos som är beredd ur batchen, med patienten, vårdenheten och om dosen
// är given. Varje patient som visas loggas.
export function sparbarhet(db, personal, batch, nu = new Date()) {
  kravBeredare(db, personal, '/api/beredning/sparbarhet');
  sakraLager(db, nu);
  const kod = String(batch ?? '').trim().toUpperCase();
  const l = db.query('SELECT * FROM cyto_lager WHERE batch = ?').get(kod);
  if (!l) throw new Fel(404, 'Batchen finns inte i lagret.', 'saknas');
  const rader = db.query('SELECT * FROM cyto_beredningar ORDER BY tid').all().filter(r => JSON.parse(r.batcher).some(x => x.batch === kod));
  const loggade = new Set();
  return {
    batch: { ...batchUt(l), vara: VAROR[l.vara].namn, mottaget: l.mottaget, kasserad: Boolean(l.kasserad) },
    doser: rader.map(r => {
      if (!loggade.has(r.patient_id)) { loggade.add(r.patient_id); logga(db, personal, `cyto_batch:${kod}`, { patientId: r.patient_id }); }
      const d = cyto.dosRad(db, r.dos_id);
      const u = JSON.parse(r.batcher).find(x => x.batch === kod);
      return { etikett: d.etikett, lakemedel: VAROR[l.vara].namn, mangd: u.mangd, enhet: u.enhet, bereddTid: r.tid, bereddAv: personNamn(db, r.beredd_av), patient: patientFor(db, r.patient_id),
        vardenhet: enhetsnamn(db, vardenhetFor(db, r.enhet_id)), status: d.status, givenTid: d.given_tid };
    }),
    text: 'Alla doser som är beredda ur batchen, så att de patienter som har fått den kan nås om batchen dras tillbaka.',
  };
}

// POST /api/beredning/kapacitet { datum, platser }. Hur många kurer beredningsenheten tar emot den dagen.
export function sattKapacitet(db, personal, body = {}, nu = new Date()) {
  kravBeredare(db, personal, 'cyto_kapacitet');
  const datum = body.datum;
  if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < datumAv(nu)) throw new Fel(400, 'Välj en dag från i dag och framåt.', 'ogiltig', { falt: ['datum'] });
  const platser = Number(body.platser);
  if (!Number.isInteger(platser) || platser < 0 || platser > 40) throw new Fel(400, 'Ange 0 till 40 kurer.', 'ogiltig', { falt: ['platser'] });
  const k = cyto.kapacitetFor(db, datum);
  if (platser < k.bokade) throw new Fel(409, `${k.bokade} kurer är redan godkända den dagen. Kapaciteten kan inte vara lägre.`, 'ogiltig', { falt: ['platser'] });
  db.query('INSERT INTO cyto_kapacitet (datum, platser, andrad, andrad_av) VALUES (?, ?, ?, ?) ON CONFLICT (datum) DO UPDATE SET platser = excluded.platser, andrad = excluded.andrad, andrad_av = excluded.andrad_av')
    .run(datum, platser, iso(nu), personal.id);
  logga(db, personal, `cyto_kapacitet:${datum}`);
  return { kapacitet: cyto.kapacitetFor(db, datum), text: `Beredningsenheten tar emot ${platser} ${platser === 1 ? 'kur' : 'kurer'} ${datum}.` };
}

// GET /api/beredning/uppfoljning. Produktion och kvalitet på beredningsenheten under perioden, utan personuppgifter.
export function uppfoljning(db, personal, { fran = null, till = null } = {}, nu = new Date()) {
  kravBeredare(db, personal, '/api/beredning/uppfoljning');
  sakraLager(db, nu);
  const t = till ?? datumAv(nu), f = fran ?? addDagar(t, -30);
  if (![f, t].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) || f > t) throw new Fel(400, 'Ange perioden som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const start = lokalTid(f, '00:00'), slut = lokalTid(addDagar(t, 1), '00:00');
  const i = (x) => x && x >= start && x < slut;
  const ber = db.query('SELECT * FROM cyto_beredningar').all().filter(r => i(r.tid));
  const matn = db.query('SELECT * FROM cyto_kontrollmatningar').all().filter(r => i(r.tid));
  const kass = db.query('SELECT * FROM cyto_lager WHERE kasserad IS NOT NULL').all().filter(r => i(r.kasserad));
  const ledtider = ber.filter(r => r.godkand_tid).map(r => (Date.parse(r.tid) - Date.parse(r.godkand_tid)) / 60_000);
  const perVara = {};
  for (const r of ber) for (const u of JSON.parse(r.batcher)) perVara[u.vara] = (perVara[u.vara] ?? 0) + 1;
  return {
    fran: f, till: t, beredningar: ber.length,
    perVara: Object.entries(perVara).map(([id, antal]) => ({ id, namn: VAROR[id].namn, antal })),
    kontrollmatningar: matn.length, overGransen: matn.filter(m => m.avvikelse_procent > KONTROLL_PROCENT).length,
    kassationer: kass.length, kasseradMangd: kass.map(k => ({ namn: VAROR[k.vara].namn, mangd: k.kasserad_mangd, enhet: VAROR[k.vara].enhet })),
    ledtidMinuter: ledtider.length ? Math.round(ledtider.reduce((a, b) => a + b, 0) / ledtider.length) : null,
    text: 'Räknat av systemet ur beredningarna, kontrollmätningarna och lagret. Uppföljningen innehåller inga personuppgifter.',
  };
}
