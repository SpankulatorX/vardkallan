// Läkemedelsprocessen, del 2 (runda 6, r2): läkemedelstyper och licenser (Sussa 3.5.2.4), förpackningar med
// NPL-pack-id (L7), spädning och tillsatser (3.5.1.4, 3.5.2.1), upp- och nedtrappning (3.5.2.12) och makulering av en
// felaktig registrering (3.5.2.2). Här finns också det som administreringen och läkemedelslistan läser om en ordination:
// dagens dos i ett trappschema, om en muntlig ordination är signerad och hur många tillfällen ett generellt direktiv
// har kvar.
//
// Systemet är experten. Det räknar ut koncentration, volym och hastighet ur ordinationen och säger hur mycket som ska
// dras upp, föreslår trappschemat och räknar dosen för varje dag, väljer förpackningen när förskrivaren inte väljer,
// bevakar licensen och förklarar på vanlig svenska varför något inte går. Reglerna är demoregler.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { datumI } from './lakemedelsprocess.js';
import { vardenhetFor } from './atkomst.js';

export const DEMO_STOD = 'Reglerna för spädning, tillsatser, upp- och nedtrappning och licenser är demoregler för att visa flödet. De är inte doseringsstöd och inte granskade av farmaceut eller läkare.';
export const TYPTEXT = { godkand: 'Godkänt läkemedel', extempore: 'Extempore', licens: 'Licensläkemedel', egendefinierad: 'Egendefinierat läkemedel', blodprodukt: 'Blodprodukt', nutrition: 'Nutrition' };
// Läkemedelstyper som inte skickas till NLL: blodprodukter och nutrition förskrivs inte som läkemedel, och ett
// egendefinierat läkemedel finns inte i NPL.
export const UTAN_NLL = new Set(['blodprodukt', 'nutrition', 'egendefinierad']);

const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const tal = (x) => String(Math.round(x * 100) / 100).replace('.', ',');

// Läkemedelstyperna och förpackningarna ändras inte i en sandlåda, så de läses en gång per sandlåda.
const cache = new WeakMap();
const cacheFor = (db) => {
  let c = cache.get(db);
  if (!c) {
    c = { typer: new Map(db.query('SELECT * FROM produkttyper').all().map(p => [p.lakemedel_id, p])), forval: new Map(),
      packs: new Map(db.query('SELECT * FROM forpackningar').all().map(f => [f.nplpackid, f])) };
    cache.set(db, c);
  }
  return c;
};

// Läkemedelstypen. En produkt med NPL-id är ett godkänt läkemedel.
export function produkttyp(db, lakemedelId) {
  const p = cacheFor(db).typer.get(lakemedelId);
  if (!p) return { typ: 'godkand', typText: TYPTEXT.godkand, demo: false };
  return { typ: p.typ, typText: TYPTEXT[p.typ], beskrivning: p.beskrivning, ...(p.kcal_per_ml ? { kcalPerMl: p.kcal_per_ml } : {}), demo: true };
}

// Licensen som gäller för patienten på vårdenheten en viss dag: en licens för patienten eller en generell licens för
// vårdenheten. Ger { giltig, licens, varfor }.
export function licensFor(db, lakemedelId, patientId, enhetId, dag = idag()) {
  const ve = vardenhetFor(db, enhetId);
  const alla = db.query('SELECT * FROM licenser WHERE lakemedel_id = ? ORDER BY giltig_till DESC').all(lakemedelId)
    .filter(l => (l.patient_id ? l.patient_id === patientId : true) && vardenhetFor(db, l.enhet_id) === ve);
  const giltig = alla.find(l => l.giltig_fran <= dag && l.giltig_till >= dag);
  const ut = (l) => ({ id: l.id, licensnummer: l.licensnummer, giltigFran: l.giltig_fran, giltigTill: l.giltig_till, generell: !l.patient_id });
  if (giltig) return { giltig: true, licens: ut(giltig), varfor: null };
  const senaste = alla[0];
  return { giltig: false, licens: senaste ? ut(senaste) : null,
    varfor: senaste ? `Licensen ${senaste.licensnummer} gällde till och med ${senaste.giltig_till}. Ansök om en ny licens hos Läkemedelsverket innan läkemedlet ordineras eller ges.`
      : 'Det finns ingen beviljad licens för läkemedlet på vårdenheten. Ett licensläkemedel får ordineras först när licensen är beviljad.' };
}

// Varningar vid ordination för läkemedel som inte är godkända i NPL. enhetId är den ordinerande vårdenheten.
export function ordinationsvarningar(db, { lm, patientId, enhetId }) {
  const t = produkttyp(db, lm.id);
  const ut = [];
  if (t.typ === 'licens') {
    const l = licensFor(db, lm.id, patientId, enhetId);
    if (!l.giltig) ut.push({ niva: 'allvarlig', regel: 'licens', text: `${lm.namn} är ett licensläkemedel. ${l.varfor}` });
    else if (l.licens.giltigTill <= addDagar(idag(), 30)) ut.push({ niva: 'observera', regel: 'licens', text: `Licensen för ${lm.namn} går ut ${l.licens.giltigTill}. Ansök om förlängning i god tid.` });
  }
  if (t.typ === 'extempore') ut.push({ niva: 'observera', regel: 'extempore', text: `${lm.namn} tillverkas av apoteket för patienten. Beställ i god tid och kontrollera hållbarheten på etiketten.` });
  if (t.typ === 'blodprodukt') ut.push({ niva: 'observera', regel: 'blodprodukt', text: `${lm.namn} beställs från blodcentralen med blodgruppering och bastest. Vid transfusionen kontrolleras patientens identitet och blodgrupp vid sängen.` });
  return ut;
}

// Varningar när en dos ges. Licensen ska gälla dagen då dosen ges, och en blodprodukt ges bara efter kontrollen vid
// sängen, som bekräftas med vem som kontrollerade.
// Licensen prövas både för dosens dag och för dagen då registreringen görs (säkerhetsgranskning).
export function administreringsvarningar(db, { lm, patientId, enhetId, ms, nu = Date.now() }) {
  const t = produkttyp(db, lm.id);
  const ut = [];
  if (t.typ === 'licens') {
    const l = [ms, nu].map(x => licensFor(db, lm.id, patientId, enhetId, datumI(x))).find(x => !x.giltig) ?? { giltig: true };
    if (!l.giltig) ut.push({ niva: 'allvarlig', regel: 'licens', text: `${lm.namn} är ett licensläkemedel utan giltig licens den dagen. ${l.varfor}` });
  }
  if (t.typ === 'blodprodukt') ut.push({ niva: 'allvarlig', regel: 'blodkontroll', text: `${lm.namn} ges först när patientens identitet och blodgrupp är kontrollerade vid sängen mot blodpåsens etikett. Skriv vem som kontrollerade.` });
  return ut;
}

// Förpackningar för produkten i NPL, med förvalet först.
export function forpackningarFor(db, lakemedelId) {
  return db.query('SELECT * FROM forpackningar WHERE lakemedel_id = ? ORDER BY forval DESC, rowid').all(lakemedelId)
    .map(f => ({ nplpackid: f.nplpackid, text: f.text, forval: Boolean(f.forval) }));
}
// Förpackningen som ordinationen gäller: den som valdes, annars förvalet. vald säger om förskrivaren valde den.
export function forpackningUt(db, ordinationId, lakemedelId, vald = undefined) {
  const c = cacheFor(db);
  const id = vald === undefined ? db.query('SELECT nplpackid FROM ordination_forpackning WHERE ordination_id = ?').get(ordinationId)?.nplpackid : vald;
  const v = id ? c.packs.get(id) : null;
  if (v) return { nplpackid: v.nplpackid, text: v.text, vald: true };
  if (!c.forval.has(lakemedelId)) c.forval.set(lakemedelId, forpackningarFor(db, lakemedelId)[0] ?? null);
  const f = c.forval.get(lakemedelId);
  return f ? { nplpackid: f.nplpackid, text: f.text, vald: false } : null;
}

// Spädning och tillsatser (demoregler). losningar är vad läkemedlet får spädas i, och volymMl och tidMin systemets
// förslag. koncentration är målkoncentrationen när läkemedlet späds från en stamlösning. basvatska betyder att
// läkemedlet själv är infusionsvätskan och att dosen är volymen. maxKoncentration är högsta koncentration i mg/ml.
export const SPADNINGSREGLER = {
  J01CE01: { losningar: ['natriumklorid 9 mg/ml', 'glukos 50 mg/ml'], volymMl: 100, tidMin: 30, maxKoncentration: 60 },
  N02AA01: { losningar: ['natriumklorid 9 mg/ml'], koncentration: 1, tidMin: null, maxKoncentration: 10 },
  A11DA01: { losningar: ['natriumklorid 9 mg/ml', 'glukos 50 mg/ml'], volymMl: 100, tidMin: 30, maxKoncentration: 5 },
  B05XA03: { basvatska: true, tidMin: 480 },
};
// Tillsatser som kan sättas till en infusion, med koncentration per ml och demogränser per liter och per timme.
export const TILLSATSER = {
  'VK-EGEN-0001': { namn: 'kaliumklorid', enhet: 'mmol', perMl: 1, maxPerLiter: 40, maxPerTimme: 10 },
};
const mgPer = (dos, enhet) => (enhet === 'g' ? dos * 1000 : enhet === 'mg' ? dos : null);
const stamlosning = (lm) => { const m = /^([\d,]+)\s*mg\/ml$/.exec(lm?.styrka ?? ''); return m ? Number(m[1].replace(',', '.')) : null; };

export function spadningsforslag(lm, dos, dosEnhet) {
  const r = SPADNINGSREGLER[lm?.atc];
  if (!r) return null;
  if (r.basvatska) return { losning: null, volymMl: dosEnhet === 'ml' && dos ? dos : 1000, tidMin: r.tidMin, tillsatser: [], losningar: [], basvatska: true };
  const mg = mgPer(dos, dosEnhet);
  const volymMl = r.koncentration && mg ? Math.round(mg / r.koncentration * 100) / 100 : r.volymMl;
  return { losning: r.losningar[0], volymMl, tidMin: r.tidMin, tillsatser: [], losningar: r.losningar };
}

// Det systemet räknar fram ur ordinationen och spädningen: total volym, koncentration, hastighet, hur mycket som dras
// upp ur en stamlösning och tillsatsernas koncentration. text är vad som visas vid iordningsställandet.
export function beraknaSpadning(db, lm, dos, dosEnhet, sp) {
  const r = SPADNINGSREGLER[lm.atc] ?? {};
  const tillsatser = (sp.tillsatser ?? []).map(t => {
    const def = TILLSATSER[t.lakemedelId];
    return { ...t, namn: def?.namn ?? katalog(db, t.lakemedelId)?.namn ?? t.lakemedelId, volymMl: t.volymMl ?? (def ? t.mangd / def.perMl : 0), def };
  });
  const total = Math.round((sp.volymMl + tillsatser.reduce((s, t) => s + t.volymMl, 0)) * 100) / 100;
  const mg = mgPer(dos, dosEnhet);
  const konc = mg != null && !r.basvatska ? Math.round(mg / total * 100) / 100 : null;
  const hastighet = sp.tidMin ? Math.round(total / (sp.tidMin / 60) * 10) / 10 : null;
  const stam = stamlosning(lm);
  const uppdragning = stam && mg != null ? Math.round(mg / stam * 100) / 100 : null;
  const delar = [];
  if (r.basvatska) delar.push(`${tal(sp.volymMl)} ml ${lm.namn.toLowerCase()}`);
  else if (uppdragning != null) delar.push(`Dra upp ${tal(uppdragning)} ml ${lm.namn} ${lm.styrka} och späd med ${sp.losning} till ${tal(total)} ml`);
  else delar.push(`Lös ${tal(dos)} ${dosEnhet} ${lm.namn} i ${tal(sp.volymMl)} ml ${sp.losning}`);
  for (const t of tillsatser) delar.push(`tillsätt ${tal(t.mangd)} ${t.def?.enhet ?? t.enhet ?? ''} ${t.namn} (${tal(t.volymMl)} ml)`);
  const ut = [`${delar.join(', ')}.`];
  if (konc != null) ut.push(`Koncentration ${tal(konc)} mg/ml.`);
  for (const t of tillsatser.filter(x => x.def)) ut.push(`${t.namn[0].toUpperCase()}${t.namn.slice(1)} ${tal(t.mangd / (total / 1000))} ${t.def.enhet}/l${sp.tidMin ? `, ${tal(t.mangd / (sp.tidMin / 60))} ${t.def.enhet} per timme` : ''}.`);
  ut.push(hastighet != null ? `Ges under ${sp.tidMin >= 120 ? `${tal(sp.tidMin / 60)} timmar` : `${tal(sp.tidMin)} minuter`}, ${tal(hastighet)} ml per timme.` : 'Ges långsamt intravenöst under 3 till 5 minuter.');
  return {
    losning: sp.losning ?? null, volymMl: sp.volymMl, tidMin: sp.tidMin ?? null, totalVolymMl: total, koncentrationMgMl: konc, hastighetMlH: hastighet,
    uppdragningMl: uppdragning, tillsatser: tillsatser.map(t => ({ lakemedelId: t.lakemedelId, namn: t.namn, mangd: t.mangd, enhet: t.def?.enhet ?? t.enhet ?? null, volymMl: t.volymMl,
      ...(t.def ? { perLiter: Math.round(t.mangd / (total / 1000) * 10) / 10, perTimme: sp.tidMin ? Math.round(t.mangd / (sp.tidMin / 60) * 10) / 10 : null } : {}) })),
    text: ut.join(' '), demoregler: true,
  };
}

// Kontrollerar spädningen mot reglerna och förklarar vad som inte stämmer. Ger { losning, volymMl, tidMin, tillsatser }.
export function valideraSpadning(db, lm, dos, dosEnhet, sp) {
  const r = SPADNINGSREGLER[lm.atc];
  if (!r) throw new Fel(400, `${lm.namn} har ingen spädning i demons regler. Ta bort spädningen eller välj ett läkemedel som späds.`, 'ogiltig', { falt: ['spadning'] });
  const volymMl = Number(sp.volymMl);
  const tidMin = sp.tidMin == null || sp.tidMin === '' ? null : Number(sp.tidMin);
  const losning = r.basvatska ? null : typeof sp.losning === 'string' ? sp.losning : r.losningar[0];
  if (!r.basvatska && !r.losningar.includes(losning)) throw new Fel(400, `${lm.namn} späds i ${r.losningar.join(' eller ')} enligt demoreglerna.`, 'ogiltig', { falt: ['spadning'] });
  if (!Number.isFinite(volymMl) || volymMl <= 0 || volymMl > 5000) throw new Fel(400, 'Ange spädningens volym, mer än 0 och högst 5 000 ml.', 'ogiltig', { falt: ['spadning'] });
  if (tidMin != null && (!Number.isFinite(tidMin) || tidMin < 1 || tidMin > 1440)) throw new Fel(400, 'Ange tiden för infusionen i minuter, från 1 minut till ett dygn.', 'ogiltig', { falt: ['spadning'] });
  const tillsatser = [];
  for (const t of Array.isArray(sp.tillsatser) ? sp.tillsatser.slice(0, 5) : []) {
    const def = TILLSATSER[t?.lakemedelId];
    const mangd = Number(t?.mangd);
    if (!def || !Number.isFinite(mangd) || mangd <= 0) throw new Fel(400, 'Tillsatsen finns inte i demons regler, eller mängden saknas.', 'ogiltig', { falt: ['spadning'] });
    tillsatser.push({ lakemedelId: t.lakemedelId, mangd, enhet: def.enhet, volymMl: mangd / def.perMl });
  }
  const b = beraknaSpadning(db, lm, dos, dosEnhet, { losning, volymMl, tidMin, tillsatser });
  if (r.maxKoncentration && b.koncentrationMgMl != null && b.koncentrationMgMl > r.maxKoncentration) {
    throw new Fel(400, `Koncentrationen blir ${tal(b.koncentrationMgMl)} mg/ml, men ${lm.namn} får spädas till högst ${tal(r.maxKoncentration)} mg/ml enligt demoreglerna. Öka volymen till minst ${tal(Math.ceil(mgPer(dos, dosEnhet) / r.maxKoncentration))} ml.`, 'ogiltig', { falt: ['spadning'] });
  }
  for (const t of b.tillsatser) {
    const def = TILLSATSER[t.lakemedelId];
    if (t.perLiter > def.maxPerLiter) throw new Fel(400, `${t.namn[0].toUpperCase()}${t.namn.slice(1)} blir ${tal(t.perLiter)} ${def.enhet}/l. Högst ${def.maxPerLiter} ${def.enhet}/l i en perifer infusion enligt demoreglerna.`, 'ogiltig', { falt: ['spadning'] });
    if (t.perTimme != null && t.perTimme > def.maxPerTimme) throw new Fel(400, `${t.namn[0].toUpperCase()}${t.namn.slice(1)} ges då med ${tal(t.perTimme)} ${def.enhet} per timme. Högst ${def.maxPerTimme} ${def.enhet} per timme enligt demoreglerna, så förläng infusionstiden.`, 'ogiltig', { falt: ['spadning'] });
    if (t.perTimme == null) throw new Fel(400, `En infusion med ${t.namn} måste ha en infusionstid, så att systemet kan kontrollera hur mycket som ges per timme.`, 'ogiltig', { falt: ['spadning'] });
  }
  return { losning, volymMl, tidMin, tillsatser };
}

// Upp- och nedtrappning (demoregler). Systemet föreslår ett schema för substansen: startdos, hur mycket dosen ändras,
// hur många dagar varje steg varar och slutdosen. En nedtrappning slutar efter sista steget. En upptrappning fortsätter
// med slutdosen.
export const TRAPPMALLAR = {
  H02AB06: { riktning: 'ned', startdos: 40, steg: 5, dagar: 3, slutdos: 5, varfor: 'Kortison som har getts i flera veckor trappas ned, så att binjurarna hinner börja producera kortisol igen.' },
  N06AB06: { riktning: 'upp', startdos: 25, steg: 25, dagar: 7, slutdos: 50, varfor: 'Sertralin börjar med en lägre dos den första veckan, så att biverkningarna blir mindre.' },
  C07AB07: { riktning: 'ned', startdos: 5, steg: 2.5, dagar: 7, slutdos: 2.5, varfor: 'Betablockerare trappas ned under ett par veckor, så att pulsen och blodtrycket inte stiger snabbt.' },
};
const styrkaMg = (lm) => { const m = /^([\d,]+)\s*mg$/.exec(lm?.styrka ?? ''); return m ? Number(m[1].replace(',', '.')) : null; };
// Den minsta delen av en tablett som går att ge: en halv tablett, men hela för depottabletter, enterotabletter och
// kapslar, som inte delas.
const minstaDel = (lm) => { const s = styrkaMg(lm); if (!s) return null; return /depot|kapsel|entero/.test(lm.form) ? s : s / 2; };
const enhetText = (lm, dos) => {
  const s = styrkaMg(lm);
  if (!s || !/tablett|kapsel/.test(lm.form)) return '';
  const n = dos / s;
  const ord = /kapsel/.test(lm.form) ? (n === 1 ? 'kapsel' : 'kapslar') : n === 1 ? 'tablett' : 'tabletter';
  return ` (${n === 0.5 ? 'en halv' : tal(n)} ${n === 0.5 ? (/kapsel/.test(lm.form) ? 'kapsel' : 'tablett') : ord})`;
};

export function trappforslag(lm, inp = {}) {
  const m = TRAPPMALLAR[lm.atc];
  const g = { riktning: inp.riktning ?? m?.riktning ?? 'ned', startdos: Number(inp.startdos ?? m?.startdos ?? styrkaMg(lm) ?? 0), steg: Number(inp.steg ?? m?.steg ?? 0),
    dagar: Number(inp.dagar ?? m?.dagar ?? 7), slutdos: Number(inp.slutdos ?? m?.slutdos ?? 0), start: inp.start ?? idag() };
  return { ...beraknaTrappning(lm, g), varfor: m?.varfor ?? null, mall: Boolean(m), demoregler: true, anmarkning: DEMO_STOD };
}

// Räknar stegen och kontrollerar att varje dos går att ge med produkten. Ger { riktning, steg: [{ fran, dos, dosering }],
// slut, dosering } eller kastar Fel som förklarar vad som inte går.
export function beraknaTrappning(lm, { riktning, startdos, steg, dagar, slutdos, start = idag() }) {
  const fel = (text) => { throw new Fel(400, text, 'ogiltig', { falt: ['trappning'] }); };
  if (!['upp', 'ned'].includes(riktning)) fel('Välj upptrappning eller nedtrappning.');
  if (![startdos, steg, dagar, slutdos].every(Number.isFinite) || startdos <= 0 || steg <= 0 || dagar < 1 || dagar > 28 || slutdos <= 0) fel('Ange startdos, hur mycket dosen ändras, hur många dagar varje steg varar (1 till 28) och slutdos.');
  if (riktning === 'ned' ? slutdos > startdos : slutdos < startdos) fel(riktning === 'ned' ? 'Vid nedtrappning ska slutdosen vara lägre än startdosen.' : 'Vid upptrappning ska slutdosen vara högre än startdosen.');
  if (!giltigtDatum(start)) fel('Ange startdatum.');
  const del = minstaDel(lm);
  const doser = [];
  for (let d = startdos; riktning === 'ned' ? d >= slutdos - 1e-9 : d <= slutdos + 1e-9; d = riktning === 'ned' ? d - steg : d + steg) {
    doser.push(Math.round(d * 1000) / 1000);
    if (doser.length > 20) fel('Schemat blir längre än 20 steg. Ändra dosen i större steg.');
  }
  if (del) {
    const fel_ = doser.find(d => Math.abs(d / del - Math.round(d / del)) > 1e-6);
    if (fel_ != null) fel(`Dosen ${tal(fel_)} mg går inte att ge med ${lm.namn} ${lm.styrka} ${lm.form}. ${del === styrkaMg(lm) ? 'Tabletten eller kapseln delas inte, så varje dos ska vara hela' : 'Varje dos ska vara hela eller halva'} ${lm.styrka}.`);
  }
  const rader = doser.map((dos, i) => ({ fran: addDagar(start, i * dagar), dos, dosering: `${tal(dos)} mg${enhetText(lm, dos)} på morgonen` }));
  const slut = riktning === 'ned' ? addDagar(start, doser.length * dagar - 1) : null;
  const dagText = dagar === 1 ? 'varje dag' : `var ${['', '', 'andra', 'tredje', 'fjärde', 'femte', 'sjätte', 'sjunde'][dagar] ?? `${dagar}:e`} dag`;
  const dosering = riktning === 'ned'
    ? `Nedtrappning: ${tal(startdos)} mg på morgonen, sedan ${tal(steg)} mg mindre ${dagText} till ${tal(slutdos)} mg. Sista dosen ${slut}.`
    : `Upptrappning: ${tal(startdos)} mg på morgonen, sedan ${tal(steg)} mg mer ${dagText} till ${tal(slutdos)} mg, som fortsätter.`;
  return { riktning, steg: rader, slut, dosering, dosEnhet: 'mg', tider: ['08'] };
}

export function trappningFor(db, ordinationId) {
  const t = db.query('SELECT * FROM ordination_trappning WHERE ordination_id = ?').get(ordinationId);
  return t ? { riktning: t.riktning, steg: JSON.parse(t.steg) } : null;
}
// Dagens steg i trappschemat, eller null när ordinationen inte har något schema.
export function trappsteg(db, ordinationId, dag) {
  const t = trappningFor(db, ordinationId);
  if (!t) return null;
  let i = -1;
  t.steg.forEach((s, n) => { if (s.fran <= dag) i = n; });
  if (i < 0) return { dos: null, dosering: `Schemat börjar ${t.steg[0].fran}.`, steg: 0, antal: t.steg.length };
  return { dos: t.steg[i].dos, dosering: `Steg ${i + 1} av ${t.steg.length}: ${t.steg[i].dosering}`, steg: i + 1, antal: t.steg.length, fran: t.steg[i].fran };
}

// Muntlig ordination och generellt direktiv: läses här, så att administreringen och listan kan pröva dem utan att bero
// på flödena i ordinationsvagar.js.
// En muntlig ordination får ges före läkarens signering bara när patienten behöver omedelbar behandling (HSLF-FS
// 2017:37 8 kap. 3 §). I demon räknas det som de första två timmarna efter att ordinationen togs emot.
export const MUNTLIG_OMEDELBAR_TIMMAR = 2;
export function muntligFor(db, ordinationId) {
  const m = db.query('SELECT * FROM muntliga_ordinationer WHERE ordination_id = ?').get(ordinationId);
  if (!m) return null;
  return {
    lakare: { id: m.lakare_id, namn: personNamn(db, m.lakare_id) }, mottagenAv: { id: m.mottagen_av, namn: personNamn(db, m.mottagen_av) }, mottagen: m.mottagen,
    satt: m.satt, sattText: m.satt === 'telefon' ? 'Per telefon' : 'Muntligt', omedelbar: m.omedelbar, signerad: m.signerad, signeradAv: m.signerad_av ? personNamn(db, m.signerad_av) : null,
    gesUtanSigneringTill: new Date(Date.parse(m.mottagen) + MUNTLIG_OMEDELBAR_TIMMAR * 3600_000).toISOString(),
  };
}
export function direktivFor(db, ordinationId) {
  const d = db.query('SELECT d.*, g.innehall, g.enhet_id, g.faststallt_av FROM direktivordinationer d JOIN generella_direktiv g ON g.id = d.direktiv_id WHERE d.ordination_id = ?').get(ordinationId);
  if (!d) return null;
  const inn = JSON.parse(d.innehall);
  return { id: d.direktiv_id, indikation: inn.indikation, maxTillfallen: inn.maxTillfallen, bedomning: d.bedomning, bekraftade: JSON.parse(d.bekraftade), faststalltAv: personNamn(db, d.faststallt_av) };
}

// Makulerade registreringar av en typ, som en mängd post-id.
export function makulerade(db, typ, patientId) {
  return new Set(db.query('SELECT post_id FROM makuleringar WHERE typ = ? AND patient_id = ?').all(typ, patientId).map(r => r.post_id));
}
export function makuleringFor(db, typ, postId) {
  const m = db.query('SELECT * FROM makuleringar WHERE typ = ? AND post_id = ?').get(typ, postId);
  return m ? { tid: m.tid, av: personNamn(db, m.av), orsak: m.orsak } : null;
}

// Prövas innan en dos registreras (administrering.js). Kastar Fel som förklarar varför dosen inte får ges.
// ms är en tid eller flera: dostiden, den angivna tiden och när registreringen görs. Alla ska ligga inom fönstret.
export function provaDos(db, orad, ms, { makuleradeIds = new Set() } = {}) {
  if (!orad) return;
  const tider = (Array.isArray(ms) ? ms : [ms]).filter(Number.isFinite);
  const m = muntligFor(db, orad.id);
  if (m && !m.signerad && tider.some(t => t > Date.parse(m.gesUtanSigneringTill))) {
    throw new Fel(400, `Ordinationen är muntlig och inte signerad av ${m.lakare.namn}. Utan signering får läkemedlet bara ges när patienten behöver omedelbar behandling, de första ${MUNTLIG_OMEDELBAR_TIMMAR} timmarna. Be läkaren signera ordinationen.`, 'ogiltig', { muntlig: true });
  }
  const d = direktivFor(db, orad.id);
  if (d) {
    const givna = db.query("SELECT id FROM administreringar WHERE ordination_id = ? AND status IN ('given', 'overlamnad')").all(orad.id).filter(a => !makuleradeIds.has(a.id)).length;
    if (givna >= d.maxTillfallen) throw new Fel(400, `Det generella direktivet tillåter ${d.maxTillfallen} ${d.maxTillfallen === 1 ? 'tillfälle' : 'tillfällen'} utan att läkare kontaktas, och alla är använda. Kontakta läkaren för en ordination.`, 'ogiltig', { direktiv: true });
  }
}

// Tilläggen som läkemedelslistan, administreringen och FHIR visar för en ordination.
export function tillaggUt(db, o) {
  const lm = katalog(db, o.lakemedel_id);
  const ut = { produkttyp: produkttyp(db, o.lakemedel_id) };
  // En fråga för att se vilka tillägg ordinationen har, eftersom de flesta inte har något.
  const har = db.query(`SELECT (SELECT nplpackid FROM ordination_forpackning WHERE ordination_id = ?1) AS f, EXISTS (SELECT 1 FROM ordination_spadning WHERE ordination_id = ?1) AS s, EXISTS (SELECT 1 FROM ordination_trappning WHERE ordination_id = ?1) AS t,
    EXISTS (SELECT 1 FROM muntliga_ordinationer WHERE ordination_id = ?1) AS m, EXISTS (SELECT 1 FROM direktivordinationer WHERE ordination_id = ?1) AS d,
    EXISTS (SELECT 1 FROM paketordinationer WHERE ordination_id = ?1) AS p`).get(o.id);
  const f = lm?.npl ? forpackningUt(db, o.id, o.lakemedel_id, har.f ?? null) : null;
  if (f) ut.forpackning = f;
  if (!har.s && !har.t && !har.m && !har.d && !har.p) return ut;
  const sp = har.s ? db.query('SELECT * FROM ordination_spadning WHERE ordination_id = ?').get(o.id) : null;
  if (sp && lm) ut.spadning = beraknaSpadning(db, lm, o.dos, o.dos_enhet, { losning: sp.losning, volymMl: sp.volym_ml, tidMin: sp.tid_min, tillsatser: JSON.parse(sp.tillsatser) });
  const t = trappningFor(db, o.id);
  if (t) ut.trappning = { ...t, idag: trappsteg(db, o.id, idag()) };
  const m = muntligFor(db, o.id);
  if (m) ut.muntlig = m;
  const d = direktivFor(db, o.id);
  if (d) ut.direktiv = d;
  const p = db.query('SELECT p.*, k.namn FROM paketordinationer p JOIN ordinationspaket k ON k.id = p.paket_id WHERE p.ordination_id = ?').get(o.id);
  if (p) ut.paket = { id: p.paket_id, namn: p.namn, grupp: p.grupp };
  return ut;
}

// Tillägg som skickas med en ny ordination: spädning, förpackning och trappschema. Kontrolleras innan ordinationen
// sparas, så att ett fel inte lämnar en halv ordination. Ger { kropp, extra }, där kropp är ordinationen med det som
// systemet räknar fram: volymen för vätskebalansen ur spädningen och doseringen, dosen, tiden och slutet ur schemat.
export function forbered(db, inp = {}) {
  const lm = typeof inp.lakemedelId === 'string' ? katalog(db, inp.lakemedelId) : null;
  const kropp = { ...inp };
  const extra = {};
  if (!lm) return { kropp, extra };
  if (inp.trappning != null) {
    const t = beraknaTrappning(lm, { riktning: inp.trappning.riktning, startdos: Number(inp.trappning.startdos), steg: Number(inp.trappning.steg), dagar: Number(inp.trappning.dagar), slutdos: Number(inp.trappning.slutdos), start: inp.start ?? idag() });
    extra.trappning = t;
    Object.assign(kropp, { dosering: t.dosering, dos: t.steg[0].dos, dosEnhet: 'mg', tider: t.tider, typ: 'tillfallig', vidBehov: false, slut: t.slut });
  }
  if (inp.spadning != null) {
    const dos = kropp.dos == null || kropp.dos === '' ? null : Number(kropp.dos);
    extra.spadning = valideraSpadning(db, lm, dos, kropp.dosEnhet ?? null, inp.spadning);
    const b = beraknaSpadning(db, lm, dos, kropp.dosEnhet ?? null, extra.spadning);
    if (kropp.volymMl == null || kropp.volymMl === '') kropp.volymMl = b.totalVolymMl;
  }
  // Nutrition i ml räknas in i vätskebalansen med sin volym.
  if (produkttyp(db, lm.id).typ === 'nutrition' && kropp.dosEnhet === 'ml' && Number(kropp.dos) > 0 && (kropp.volymMl == null || kropp.volymMl === '')) kropp.volymMl = Number(kropp.dos);
  if (inp.forpackning != null) {
    const f = typeof inp.forpackning === 'string' ? db.query('SELECT * FROM forpackningar WHERE nplpackid = ?').get(inp.forpackning) : null;
    if (!f || f.lakemedel_id !== lm.id) throw new Fel(400, `Förpackningen hör inte till ${lm.namn}. Välj en av produktens förpackningar i NPL.`, 'ogiltig', { falt: ['forpackning'] });
    extra.forpackning = f.nplpackid;
  } else if (lm.npl) {
    // Systemet väljer förpackningen när förskrivaren inte väljer, så att överföringen till NLL alltid har ett NPL-pack-id.
    const f = forpackningarFor(db, lm.id)[0];
    if (f) extra.forpackning = f.nplpackid;
  }
  return { kropp, extra };
}

export function sparaTillagg(db, ordinationId, extra = {}) {
  if (extra.forpackning) db.query('INSERT OR IGNORE INTO ordination_forpackning (ordination_id, nplpackid) VALUES (?, ?)').run(ordinationId, extra.forpackning);
  if (extra.spadning) {
    db.query('INSERT INTO ordination_spadning (ordination_id, losning, volym_ml, tid_min, tillsatser) VALUES (?, ?, ?, ?, ?)')
      .run(ordinationId, extra.spadning.losning, extra.spadning.volymMl, extra.spadning.tidMin, JSON.stringify(extra.spadning.tillsatser));
  }
  if (extra.trappning) {
    db.query('INSERT INTO ordination_trappning (ordination_id, riktning, steg) VALUES (?, ?, ?)').run(ordinationId, extra.trappning.riktning, JSON.stringify(extra.trappning.steg));
  }
}

// Förslaget som ordinationsformuläret får utöver mallen: läkemedelstyp, förpackningar, spädning och trappschema.
export function forslagTillagg(db, lm, f) {
  return {
    produkttyp: produkttyp(db, lm.id), forpackningar: forpackningarFor(db, lm.id),
    spadning: spadningsforslag(lm, f.dos, f.dosEnhet), trappning: TRAPPMALLAR[lm.atc] ? trappforslag(lm) : null,
  };
}

// Makulering (3.5.2.2): en felaktig registrering makuleras med orsak, och raderas aldrig. Bara på den vårdenhet där
// den registrerades, av den som får ge läkemedel eller registrera mätvärden med vårdrelation där.
export function makulera(atk, typ, postId, { orsak } = {}, { kravVardande, synligaDoser }) {
  const db = atk.db;
  const o = typeof orsak === 'string' ? orsak.trim().slice(0, 300) : '';
  if (!['administrering', 'vatskebalans'].includes(typ)) throw new Fel(400, 'Bara doser och vätskebalans kan makuleras.', 'ogiltig');
  const rad = typ === 'administrering' ? db.query('SELECT * FROM administreringar WHERE id = ? AND patient_id = ?').get(Number(postId), atk.patientId)
    : db.query('SELECT * FROM vatskebalans WHERE id = ? AND patient_id = ?').get(Number(postId), atk.patientId);
  const handling = typ === 'administrering' ? 'ge_lakemedel' : 'registrera_matvarde';
  // En dos som användaren inte får se behandlas som om den inte finns, så att en spärrad uppgift inte röjs.
  if (!rad || (typ === 'administrering' && !synligaDoser().has(rad.id))) throw new Fel(404, 'Registreringen finns inte.', 'saknas');
  kravVardande(atk, handling, { enhet_id: rad.enhet_id }, `makulering:${typ}:${rad.id}`);
  if (vardenhetFor(db, rad.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) {
    atk.logga(handling, 'nekad', `makulering:${typ}:${rad.id}`, 'nekad');
    throw new Fel(403, 'En registrering makuleras på den vårdenhet där den gjordes.', 'nekad');
  }
  if (typ === 'vatskebalans' && rad.administrering_id != null) throw new Fel(400, 'Volymen kommer från en given dos. Makulera dosen, så räknas volymen bort av sig själv.', 'ogiltig');
  if (makuleringFor(db, typ, rad.id)) throw new Fel(400, 'Registreringen är redan makulerad.', 'ogiltig');
  if (o.length < 3) throw new Fel(400, 'Ange varför registreringen makuleras, med minst tre tecken.', 'ogiltig', { falt: ['orsak'] });
  db.query('INSERT INTO makuleringar (typ, post_id, patient_id, enhet_id, tid, av, orsak) VALUES (?, ?, ?, ?, ?, ?, ?)').run(typ, rad.id, atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id, o);
  atk.logga(handling, atk.grund(), `makulering:${typ}:${rad.id}`);
  return { typ, id: rad.id, makulerad: makuleringFor(db, typ, rad.id) };
}
