// Läkemedelsprocessen, del 2 (runda 6, r2): dosering över flera dygn (Sussa 3.5.1.2, 3.5.1.8) och den samlade
// vätskebalansen med beredd volym, kalorier, vikt, förväntad balans framåt och valbar dygnsbrytning (3.5.2.3, 3.5.3.1
// till 3.5.3.3).
//
// Systemet är experten. Doserna för flera dygn räknas fram ur ordinationerna med trappschemat, och vätskebalansen
// räknar in det som är iordningsställt men inte givet, kalorierna ur nutritionen och det som väntas in de närmaste
// timmarna ur ordinationerna, så att ingen behöver räkna själv. Behörigheten är densamma som för läkemedelslistan och
// vätskebalansen: spärrade och dolda ordinationer och doser räknas aldrig in, och vätskebalansen följer inre sekretess
// som mätvärdena.
import { Fel, idag, addDagar, giltigtDatum } from './db.js';
import * as administrering from './administrering.js';
import * as lakemedel from './lakemedel.js';
import { tillaggUt } from './ordinationsmallar.js';
import { lokalTid, klocka, datumI } from './lakemedelsprocess.js';
import * as stod from './lakemedelsstod.js';
import { kvalitetssakrad } from './mt-klass.js';

const DAG = 86400_000;
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const r1 = (x) => Math.round(x * 10) / 10;

// GET /api/patient/:id/doseringsoversikt?fran=YYYY-MM-DD&dagar=N. Från i går och tre dygn fram som standard, högst sju.
export function doseringsoversikt(atk, { fran = addDagar(idag(), -1), dagar = 4 } = {}) {
  atk.krav('las_lakemedel');
  if (!giltigtDatum(fran)) throw new Fel(400, 'Ange startdatum som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['fran'] });
  const n = Math.min(7, Math.max(1, Number(dagar) || 4));
  const db = atk.db;
  const dagLista = Array.from({ length: n }, (_, i) => addDagar(fran, i));
  const rader = new Map();
  const adm = administrering.synligaAdministreringar(atk);
  const mak = stod.makulerade(db, 'administrering', atk.patientId);
  const ordn = new Map(lakemedel.synligaOrdinationer(atk).map(o => [o.id, o]));
  const rad = (o) => {
    if (!rader.has(o.id)) {
      const u = lakemedel.ordinationUt(db, o, { historik: false });
      rader.set(o.id, { ordinationId: o.id, lakemedel: u.lakemedel, dosering: u.dosering, typ: u.typ, administrationssatt: u.administrationssattText ?? null, status: o.status,
        trappning: Boolean(u.trappning), vidBehov: Boolean(o.vid_behov), dagar: Object.fromEntries(dagLista.map(d => [d, []])) });
    }
    return rader.get(o.id);
  };
  for (const dag of dagLista) {
    const l = administrering.lista(atk, { dag });
    for (const d of l.doser) rad(ordn.get(d.ordinationId)).dagar[dag].push({ tid: d.planerad, dos: d.dos, dosEnhet: d.dosEnhet, status: d.status });
    for (const v of [...l.vidBehov, ...l.utanTider]) {
      const o = ordn.get(v.ordinationId);
      const givna = adm.filter(a => a.ordination_id === o.id && !mak.has(a.id) && ['given', 'overlamnad'].includes(a.status) && datumI(Date.parse(a.tid)) === dag);
      rad(o).dagar[dag].push({ vidBehov: true, givna: givna.length, text: givna.length ? `Given ${givna.length} ${givna.length === 1 ? 'gång' : 'gånger'}` : (o.vid_behov ? 'Vid behov' : 'Utan fasta tider') });
    }
  }
  return { fran, dagar: dagLista, rader: [...rader.values()].sort((a, b) => a.lakemedel.namn.localeCompare(b.lakemedel.namn, 'sv')), dolda: { sparrade: atk.doldaSparr } };
}

// Volymen och kalorierna för en dos av en ordination.
function dosVolym(db, o, dos) {
  const lm = katalog(db, o.lakemedel_id);
  const t = tillaggUt(db, o.id);
  const volym = administrering.volymFor(lm, t, dos ?? o.dos, o.dos_enhet) ?? (stod.produkttyp(db, o.lakemedel_id).typ === 'nutrition' && o.dos_enhet === 'ml' ? (dos ?? o.dos) : null);
  const kcal = stod.produkttyp(db, o.lakemedel_id).kcalPerMl;
  return { volym, kcal: kcal && volym ? kcal * volym : 0, lm };
}

// GET /api/patient/:id/vatskebalans?dag&brytning&riktning&sortering. Svaret har samma fält som tidigare och dessutom
// kalorier, beredd volym, vikt, ackumulerad balans och förväntad balans för de närmaste 24 timmarna.
export function vatskebalans(atk, { dag = idag(), brytning = '00', riktning = null, sortering = 'tid' } = {}) {
  const db = atk.db;
  const vb = administrering.vatskebalans(atk, { dag, brytning });
  const adm = new Map(administrering.synligaAdministreringar(atk).map(a => [a.id, a]));
  const mak = stod.makulerade(db, 'administrering', atk.patientId);
  const ordn = new Map(lakemedel.synligaOrdinationer(atk).map(o => [o.id, o]));
  // Kalorier: ur nutritionens kalorier per ml när den ges, eller det som registrerades med intaget.
  for (const p of vb.poster) {
    const a = p.administreringId ? adm.get(p.administreringId) : null;
    const kpm = a ? stod.produkttyp(db, a.lakemedel_id).kcalPerMl : null;
    p.kcal = kpm ? r1(kpm * p.volymMl) : db.query('SELECT kcal FROM vatskebalans_kcal WHERE vatskebalans_id = ?').get(p.id)?.kcal ?? null;
  }
  const giltiga = vb.poster.filter(p => !p.makulerad);
  const kcalIn = r1(giltiga.reduce((s, p) => s + (p.kcal ?? 0), 0));
  // Iordningsställt men inte givet: beredd volym som väntar.
  const beredd = [...adm.values()].filter(a => a.status === 'iordningstalld' && !mak.has(a.id) && a.ordination_id && ordn.has(a.ordination_id)).map(a => {
    const o = ordn.get(a.ordination_id);
    const { volym, lm } = dosVolym(db, o, a.dos);
    return volym ? { administreringId: a.id, lakemedel: lm.namn, volymMl: volym, iordningstalld: a.iordningstalld_tid } : null;
  }).filter(Boolean);
  // Förväntat de närmaste 24 timmarna ur ordinationerna: doser med volym som inte är givna. Förlusterna räknas som
  // samma takt som det senaste dygnet, eftersom de inte går att ordinera.
  const nu = Date.now();
  const forvantat = [];
  for (const d of [idag(), addDagar(idag(), 1)]) {
    const l = administrering.lista(atk, { dag: d });
    for (const x of l.doser) {
      const ms = Date.parse(x.planerad);
      if (ms <= nu - 3600_000 || ms > nu + DAG || ['given', 'overlamnad', 'ej_given'].includes(x.status)) continue;
      const o = ordn.get(x.ordinationId);
      const { volym, kcal } = dosVolym(db, o, x.dos);
      if (volym) forvantat.push({ tid: x.planerad, lakemedel: x.lakemedel.namn, volymMl: volym, kcal: r1(kcal), iordningstalld: x.status === 'iordningstalld' });
    }
  }
  forvantat.sort((a, b) => a.tid.localeCompare(b.tid));
  const utDygn = administrering.vatskebalans(atk, { dag: datumI(nu - DAG), brytning: new Date(nu).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }) });
  const utTakt = r1(utDygn.poster.filter(p => p.riktning === 'ut' && !p.makulerad).reduce((s, p) => s + p.volymMl, 0));
  const forvIn = r1(forvantat.reduce((s, x) => s + x.volymMl, 0));
  // Ackumulerad balans genom dygnet, post för post i tidsordning.
  let acc = 0;
  const ackumulerad = [...giltiga].sort((a, b) => a.tid.localeCompare(b.tid)).map(p => { acc += p.riktning === 'in' ? p.volymMl : -p.volymMl; return { tid: p.tid, balans: r1(acc) }; });
  // Vikt: den senaste som användaren får se, och ändringen sedan den första under vårdtillfället.
  // Runda 9, r2: en vikt som patienten själv har mätt räknas först när vården har godkänt den.
  const vikter = atk.filtrera(db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'vikt' ORDER BY tid").all(atk.patientId), 'las_matvarden').filter(kvalitetssakrad);
  const vt = db.query('SELECT inskriven FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL ORDER BY inskriven DESC').get(atk.patientId);
  const senast = vikter.at(-1);
  const forsta = vt ? vikter.find(v => v.tid >= vt.inskriven) : null;
  const vikt = senast ? { kg: senast.varde_num, tid: senast.tid, ...(forsta && forsta.id !== senast.id ? { andringKg: r1(senast.varde_num - forsta.varde_num), sedan: forsta.tid } : {}) } : null;
  // Filtrering och sortering av posterna. Summorna gäller alltid hela dygnet.
  let poster = vb.poster;
  if (riktning === 'in' || riktning === 'ut') poster = poster.filter(p => p.riktning === riktning);
  if (sortering === 'volym') poster = [...poster].sort((a, b) => b.volymMl - a.volymMl);
  return {
    ...vb, poster, filter: { riktning: riktning === 'in' || riktning === 'ut' ? riktning : null, sortering: sortering === 'volym' ? 'volym' : 'tid' }, kcalIn,
    beredd: { poster: beredd, summaMl: r1(beredd.reduce((s, x) => s + x.volymMl, 0)) },
    prognos: { timmar: 24, poster: forvantat, summaIn: forvIn, summaUt: utTakt, balans: r1(forvIn - utTakt), kcal: r1(forvantat.reduce((s, x) => s + x.kcal, 0)),
      text: 'Förväntat in är doser med volym som är ordinerade de närmaste 24 timmarna och inte givna. Förväntat ut räknas som samma mängd som det senaste dygnet.' },
    ackumulerad, vikt, brytningar: ['00', '06', '07', '08'],
  };
}
