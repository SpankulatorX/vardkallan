// Kapacitet och prognos över längre tid (runda 10, r7, Sussa 3.4.1.5). Vårdenhetens scheman ställs mot väntelistan och
// de inkomna remisserna vecka för vecka, och systemet räknar fram när kön är borta, hur många som riskerar att passera
// sin gräns och hur många fler tider som behövs. Lokaler, utrustning och sjukresor visas med bokade timmar per vecka.
//
// Systemet är experten: ingen behöver jämföra scheman med köer för hand. Systemet räknar lediga tider per tidstyp och
// yrkesroll ur tidboken, inflödet ur väntelistans senaste åtta veckor, och lägger patienterna i tur och ordning (hög
// prioritet och närmast gränsen först) på de lediga tiderna. Efter de veckor som har tider i tidboken räknas
// kapaciteten med schemats veckomönster. Förslagen säger på vanlig svenska vad som behöver göras och varför.
//
// Översikten innehåller inga patientuppgifter, bara antal per grupp. Den som vill boka går till väntelistan, där varje
// patient prövas i behörighetsmotorn som vanligt.
import { Fel, idag, addDagar, datumAv } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import { TIDSTYPER, YRKESROLL, gransFor, PRIORITET } from './tidbok.js';

export const VECKOR = 12;
const INFLODE_VECKOR = 8;
const DAG = 86400_000;
// Demoregler: en inkommen remiss som inte är bedömd blir ett nybesök hos läkare, och en resurs är bokningsbar 40 timmar
// i veckan.
export const DEMOREGLER = 'Demoregler: en inkommen remiss som inte är bedömd räknas som ett nybesök hos läkare. Inflödet är snittet av nya poster på väntelistan de senaste åtta veckorna. Efter de veckor som har tider i tidboken räknas kapaciteten med schemats veckomönster. Lokaler, utrustning och sjukresor räknas som bokningsbara 40 timmar i veckan.';

// Måndagen i veckan för ett datum.
function mandag(datum) {
  const d = new Date(`${datum}T12:00:00Z`);
  const v = (d.getUTCDay() + 6) % 7;
  return addDagar(datum, -v);
}
function veckonummer(datum) {
  const d = new Date(`${datum}T12:00:00Z`);
  const tor = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAG);
  const forsta = new Date(Date.UTC(tor.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((tor - forsta) / DAG - 3 + ((forsta.getUTCDay() + 6) % 7)) / 7);
}
const nyckel = (tidstyp, yrkesroll) => `${tidstyp}:${yrkesroll}`;
const PRIO = { hog: 0, normal: 1, lag: 2 };

// prognos(db, personal, { veckor, dag }). dag är dagens datum, så att testerna kan ge en fast tid.
export function prognos(db, personal, { veckor = VECKOR, dag = idag() } = {}) {
  if (!kanRoll(personal, 'kapacitet')) throw new Fel(403, 'Din yrkesroll ser inte vårdenhetens kapacitet.', 'nekad');
  const n = Math.min(26, Math.max(4, Number(veckor) || VECKOR));
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const forsta = mandag(dag);
  const veckorna = Array.from({ length: n }, (_, i) => { const fran = addDagar(forsta, 7 * i); return { fran, till: addDagar(fran, 7), nummer: veckonummer(fran) }; });
  const slut = veckorna[n - 1].till;

  // Kapaciteten: tider från i dag i veckorna, med hur många platser som är bokade. Tider som redan har passerat i dag
  // räknas inte som lediga.
  const scheman = db.query(`SELECT * FROM scheman WHERE enhet_id IN (${ph})`).all(...enheter);
  const schemaMap = new Map(scheman.map(s => [s.id, s]));
  const bokade = new Map(db.query("SELECT tid_id, count(*) AS n FROM bokningar WHERE status IN ('bokad', 'incheckad') GROUP BY tid_id").all().map(r => [r.tid_id, r.n]));
  const tider = scheman.length ? db.query(`SELECT * FROM tider WHERE schema_id IN (${scheman.map(() => '?').join(', ')}) AND start >= ? AND start < ? AND tidstyp NOT IN ('team')`)
    .all(...scheman.map(s => s.id), new Date(`${forsta}T00:00:00Z`).toISOString(), new Date(`${slut}T00:00:00Z`).toISOString()) : [];
  const nuTid = new Date().toISOString();
  const grupper = new Map();
  const grupp = (tt, yr) => {
    const k = nyckel(tt, yr);
    if (!grupper.has(k)) grupper.set(k, { tidstyp: tt, yrkesroll: yr, veckor: veckorna.map(() => ({ tider: 0, bokade: 0, lediga: 0, beraknad: false })), vantar: [], inflode: 0, remisser: 0, platser: [] });
    return grupper.get(k);
  };
  let sistaMedTider = -1;
  for (const t of tider) {
    const s = schemaMap.get(t.schema_id);
    const d = datumAv(new Date(t.start));
    const i = veckorna.findIndex(v => d >= v.fran && d < v.till);
    if (i < 0) continue;
    const g = grupp(t.tidstyp, s.yrkesroll).veckor[i];
    const b = Math.min(t.platser, bokade.get(t.id) ?? 0);
    g.tider += t.platser;
    g.bokade += b;
    if (t.start >= nuTid) {
      g.lediga += t.platser - b;
      // Dagarna med lediga platser, så att varje patient i kön får en verklig dag.
      for (let x = b; x < t.platser; x++) grupp(t.tidstyp, s.yrkesroll).platser.push(d);
    }
    sistaMedTider = Math.max(sistaMedTider, i);
  }
  // Efterfrågan: väntelistan och inkomna remisser som inte är bedömda.
  const vantande = db.query(`SELECT * FROM vantelista WHERE enhet_id IN (${ph}) AND status = 'vantar'`).all(...enheter);
  for (const v of vantande) grupp(v.tidstyp, v.yrkesroll).vantar.push({ prioritet: v.prioritet, grans: gransFor(v, dag, db)?.datum ?? null, patientvald: Boolean(v.patientvald) });
  const remisser = db.query(`SELECT * FROM remisser WHERE till_enhet_id IN (${ph}) AND status IN ('skickad', 'mottagen')`).all(...enheter);
  for (const r of remisser) {
    const g = grupp('nybesok', 'lakare');
    g.remisser++;
    g.vantar.push({ prioritet: r.prioritet === 'akut' || r.prioritet === 'hog' ? 'hog' : 'normal', grans: r.svar_senast ?? addDagar(datumAv(new Date(r.skickad_tid ?? Date.now())), 90), patientvald: false, remiss: true });
  }
  // Inflödet: nya poster på väntelistan per vecka de senaste åtta veckorna.
  const franInflode = addDagar(forsta, -7 * INFLODE_VECKOR);
  for (const v of db.query(`SELECT tidstyp, yrkesroll, fran FROM vantelista WHERE enhet_id IN (${ph}) AND fran >= ? AND fran < ?`).all(...enheter, franInflode, forsta)) {
    grupp(v.tidstyp, v.yrkesroll).inflode += 1 / INFLODE_VECKOR;
  }

  // Veckor efter den sista med tider i tidboken räknas med snittet av de fulla veckorna i schemat (veckomönstret).
  const fulla = veckorna.map((_, i) => i).filter(i => i > 0 && i <= sistaMedTider);
  const ut = [];
  for (const g of grupper.values()) {
    const snitt = fulla.length ? fulla.reduce((s, i) => s + g.veckor[i].tider, 0) / fulla.length : 0;
    for (let i = sistaMedTider + 1; i < n; i++) {
      Object.assign(g.veckor[i], { tider: Math.round(snitt), bokade: 0, lediga: Math.round(snitt), beraknad: true });
      // I de beräknade veckorna räknas platserna till veckans onsdag.
      for (let x = 0; x < Math.round(snitt); x++) g.platser.push(addDagar(veckorna[i].fran, 2));
    }
    g.platser.sort();
    // Kön i tur och ordning: hög prioritet först, sedan närmast gränsen. Patientvald väntan räknas sist.
    const ko = [...g.vantar].sort((a, b) => Number(a.patientvald) - Number(b.patientvald) || PRIO[a.prioritet] - PRIO[b.prioritet] || (a.grans ?? '9999').localeCompare(b.grans ?? '9999'));
    let kvar = ko.length;
    let borta = kvar === 0 ? 0 : null;
    const forloppet = [];
    // Den dag varje patient i kön får en tid: patienterna i tur och ordning på de lediga platserna i tidsordning.
    const far = ko.map((_, i) => g.platser[i] ?? null);
    let inflodeAck = 0;
    for (let i = 0; i < n; i++) {
      const w = g.veckor[i];
      inflodeAck += g.inflode;
      const nya = Math.floor(inflodeAck);
      inflodeAck -= nya;
      kvar += nya;
      const tagna = Math.min(kvar, w.lediga);
      kvar -= tagna;
      if (borta === null && kvar === 0) borta = i;
      forloppet.push({ vecka: veckorna[i].nummer, fran: veckorna[i].fran, ...w, efterfragan: nya, koEfter: kvar });
    }
    const risker = ko.map((p, i) => ({ p, far: far[i] ?? null })).filter(x => !x.p.patientvald && x.p.grans && (x.far === null || x.far > x.p.grans));
    const lediga = g.veckor.reduce((s, w) => s + w.lediga, 0);
    // Fler tider per vecka som behövs: de som riskerar, fördelade på veckorna fram till den närmaste gränsen.
    const narmast = risker.map(x => x.p.grans).sort()[0];
    const veckorTill = narmast ? Math.max(1, Math.min(n, Math.ceil((Date.parse(`${narmast}T12:00:00Z`) - Date.parse(`${dag}T12:00:00Z`)) / (7 * DAG)))) : 1;
    const behov = risker.length ? Math.ceil(risker.length / veckorTill) : 0;
    const text = YRKESROLL[g.yrkesroll] ?? g.yrkesroll;
    const tt = TIDSTYPER[g.tidstyp]?.text ?? g.tidstyp;
    const forslag = [];
    if (risker.length) forslag.push({ typ: 'risk', text: `${risker.length} ${risker.length === 1 ? 'patient riskerar' : 'patienter riskerar'} att passera sin gräns. Öppna ungefär ${behov} fler ${tt.toLowerCase()} hos ${text} i veckan till dess, eller boka från väntelistan där systemet föreslår tider.` });
    else if (borta === null && ko.length) forslag.push({ typ: 'vaxer', text: `Kön för ${tt.toLowerCase()} hos ${text} är inte borta inom ${n} veckor. Inflödet är ungefär ${Math.round(g.inflode * 10) / 10} i veckan och de lediga tiderna räcker inte.` });
    if (!ko.length && lediga > 0 && g.inflode < 1) forslag.push({ typ: 'ledig', text: `${lediga} lediga ${tt.toLowerCase()} hos ${text} har ingen som väntar. De kan öppnas för egenbokning eller göras om till en tidstyp som har kö.` });
    ut.push({
      tidstyp: g.tidstyp, tidstypText: tt, yrkesroll: g.yrkesroll, yrkesrollText: text, vantar: ko.length, remisser: g.remisser,
      inflodePerVecka: Math.round(g.inflode * 10) / 10, ledigaTotalt: lediga,
      kontBorta: borta === null ? null : { vecka: veckorna[borta].nummer, fran: veckorna[borta].fran },
      riskerarGransen: risker.length, forslag, veckor: forloppet,
    });
  }
  ut.sort((a, b) => b.riskerarGransen - a.riskerarGransen || b.vantar - a.vantar || a.tidstypText.localeCompare(b.tidstypText));

  // Lokaler, utrustning och sjukresor: bokade timmar per vecka mot 40 bokningsbara timmar (demoregel).
  const resurser = db.query(`SELECT * FROM resurser WHERE enhet_id IN (${ph}) AND aktiv = 1 ORDER BY kategori, namn`).all(...enheter).map(r => {
    const rader = db.query(`SELECT x.start, x.slut FROM resursbokningar x LEFT JOIN bokningar b ON b.id = x.bokning_id WHERE x.resurs_id = ? AND x.start < ? AND x.slut > ?
      AND (x.bokning_id IS NULL OR b.status IN ('bokad', 'incheckad'))`).all(r.id, new Date(`${slut}T00:00:00Z`).toISOString(), new Date(`${forsta}T00:00:00Z`).toISOString());
    const perVecka = veckorna.map(v => {
      const a = Date.parse(`${v.fran}T00:00:00Z`);
      const b = Date.parse(`${v.till}T00:00:00Z`);
      const ms = rader.reduce((s, x) => s + Math.max(0, Math.min(b, Date.parse(x.slut)) - Math.max(a, Date.parse(x.start))), 0);
      const timmar = Math.round(ms / 3600_000 * 10) / 10;
      return { vecka: v.nummer, fran: v.fran, timmar, belaggning: Math.round(timmar / 40 * 100) };
    });
    return { id: r.id, namn: r.namn, kategori: r.kategori, veckor: perVecka, hogst: Math.max(0, ...perVecka.map(x => x.belaggning)) };
  });

  const summa = {
    vantar: ut.reduce((s, g) => s + g.vantar, 0), riskerarGransen: ut.reduce((s, g) => s + g.riskerarGransen, 0),
    ledigaTotalt: ut.reduce((s, g) => s + g.ledigaTotalt, 0), remisser: remisser.length,
  };
  return {
    vardenhet: { id: ve, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? ve }, dag, veckor: veckorna.map(v => ({ ...v, beraknad: veckorna.indexOf(v) > sistaMedTider })),
    sistaVeckaMedTider: sistaMedTider >= 0 ? veckorna[sistaMedTider].nummer : null, grupper: ut, resurser, summa, prioriteter: PRIORITET, demoregler: DEMOREGLER,
  };
}
