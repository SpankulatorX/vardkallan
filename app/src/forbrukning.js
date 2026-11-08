// Förbrukningsartiklar (runda 9, r1, Sussa 3.5.4.1 till 3.5.4.4): förskrivning, förnyelse, ändring, utsättning och
// återinsättning av artiklar för egenkontroll av medicinering, för att tillföra kroppen läkemedel och vid stomi, med
// överföring till den simulerade Nationella läkemedelslistan (NLL).
//
// Systemet är experten. Ur patientens läkemedelslista och diagnoser föreslår systemet de artiklar som patienten behöver,
// som en mall med en eller flera förskrivningar: pennkanyler, teststickor och lansetter till den som tar insulin med
// penna, påsar, plattor och hudskydd vid stomi. Mängden per uttag räknar systemet ur behandlingen (till exempel antalet
// injektioner per dygn) för tre månader, och bruksanvisningen skrivs av systemet. Förskrivaren väljer bara artikeln
// eller mallen. Systemet stoppar en dubbelförskrivning och föreslår förnyelse i stället, varnar för en mängd som är mer
// än behovet och för en artikel som inte passar läkemedelslistan, och förklarar på vanlig svenska.
//
// Behörighet. Läsa kräver las_lakemedel: förskrivningarna är en del av läkemedelslistan, gemensam för vårdgivaren,
// men en spärrad vårdenhets förskrivningar visas inte och räknas inte. Förskriva kräver forskriva_forbrukning
// (läkare och sjuksköterska i demon) med vårdrelation på den egna vårdenheten. Nödåtkomst och aktivt val ger bara
// läsning. En förskrivning ändras bara på den vårdenhet där den gjordes. Allt loggas på patienten.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import * as lakemedel from './lakemedel.js';

export const DEMOREGLER_FORBRUKNING = 'Artiklarna och varunumren är påhittade demoposter, och mängderna och mallarna är demoregler. I demon har alla sjuksköterskor förskrivningsrätt för förbrukningsartiklar. NLL är simulerad.';
const DAGAR_PER_UTTAG = 90;
export const GRUPPER = { egenkontroll: 'Egenkontroll av medicinering', tillforsel: 'Tillförsel av läkemedel', stomi: 'Stomi' };

// Artiklarna i demon. perDygn räknar behovet per dygn ur patienten (antal injektioner, om insulin finns), och
// forpackning är antal per förpackning. Varunumren är påhittade och märkta som demo.
const A = (nr, grupp, namn, forpackning, enhet, anvisning, extra = {}) => ({ id: `VK-FA-${String(nr).padStart(4, '0')}`, varunummer: `DEMO-${String(900000 + nr)}`, grupp, namn, forpackning, enhet, anvisning, ...extra });
export const ARTIKLAR = [
  A(1, 'egenkontroll', 'Teststickor för blodsocker', 50, 'st', 'Till egenkontroll av blodsockret enligt överenskommelse med diabetesmottagningen.'),
  A(2, 'egenkontroll', 'Lansetter', 100, 'st', 'Till provtagning i fingret vid egenkontroll av blodsockret.'),
  A(3, 'egenkontroll', 'Teststickor för keton', 10, 'st', 'Till kontroll av keton vid högt blodsocker eller sjukdom.'),
  A(4, 'tillforsel', 'Pennkanyler 4 mm', 100, 'st', 'En ny kanyl till varje injektion med insulinpennan.', { kraverAtc: 'A10A', kraverForm: /injektionspenna/i }),
  A(5, 'tillforsel', 'Insulinsprutor 0,5 ml', 100, 'st', 'Till injektion av insulin när pennan inte används.', { kraverAtc: 'A10A' }),
  A(6, 'tillforsel', 'Kanylburk 1,5 liter', 1, 'st', 'Till använda kanyler, lämnas till apoteket när den är full.'),
  A(7, 'stomi', 'Stomipåse, sluten', 30, 'st', 'Byts en till två gånger per dygn.', { kraverDiagnos: /^Z93/ }),
  A(8, 'stomi', 'Stomiplatta', 10, 'st', 'Byts var tredje dag eller vid läckage.', { kraverDiagnos: /^Z93/ }),
  A(9, 'stomi', 'Hudskyddsfilm', 30, 'st', 'Skyddar huden runt stomin vid varje byte av platta.', { kraverDiagnos: /^Z93/ }),
];
const artikel = (id) => ARTIKLAR.find(a => a.id === id) ?? null;

// Mallar med en eller flera förskrivningar (demoregler). villkor säger när systemet föreslår mallen.
export const MALLAR = [
  { id: 'insulin-penna', namn: 'Insulin med penna', artiklar: ['VK-FA-0004', 'VK-FA-0001', 'VK-FA-0002', 'VK-FA-0006'], villkor: 'insulin',
    varfor: 'Patienten tar insulin med penna enligt läkemedelslistan.' },
  { id: 'egenkontroll', namn: 'Egenkontroll av blodsocker', artiklar: ['VK-FA-0001', 'VK-FA-0002'], villkor: 'diabetes',
    varfor: 'Patienten har diabetes och kontrollerar blodsockret själv.' },
  { id: 'stomi', namn: 'Stomi', artiklar: ['VK-FA-0007', 'VK-FA-0008', 'VK-FA-0009'], villkor: 'stomi',
    varfor: 'Patienten har en stomi enligt diagnoserna.' },
];

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Det som systemet vet om patienten: insulin med penna och antal injektioner per dygn, diabetes och stomi. Bara ur
// ordinationer och diagnoser som användaren får se, så att en spärrad vårdenhets uppgifter aldrig styr ett förslag.
export function underlag(atk) {
  const db = atk.db;
  const ord = lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell);
  const insulin = ord.map(o => ({ o, lm: katalog(db, o.lakemedel_id) })).filter(x => x.lm?.atc?.startsWith('A10A'));
  const penna = insulin.filter(x => /injektionspenna/i.test(x.lm.form));
  const injektioner = insulin.reduce((s, x) => s + (x.o.vid_behov ? 3 : Math.max(1, (x.o.tider ? JSON.parse(x.o.tider).length : 0) || (/måltid/i.test(x.o.dosering) ? 3 : 1))), 0);
  const diagnoser = atk.filtrera(db.query('SELECT * FROM diagnoser WHERE patient_id = ?').all(atk.patientId), 'las_diagnoser');
  const diabetes = insulin.length > 0 || ord.some(o => katalog(db, o.lakemedel_id)?.atc?.startsWith('A10')) || diagnoser.some(d => /^E1[0-4]/.test(d.kod));
  const stomi = diagnoser.some(d => /^Z93/.test(d.kod));
  return { insulin: insulin.length > 0, penna: penna.length > 0, injektioner, diabetes, stomi, atc: ord.map(o => katalog(db, o.lakemedel_id)?.atc).filter(Boolean), diagnoser: diagnoser.map(d => d.kod) };
}

// Behovet per dygn och mängden per uttag för tre månader, med varför.
export function mangdForslag(a, u) {
  let perDygn;
  let varfor;
  switch (a.id) {
    case 'VK-FA-0004': case 'VK-FA-0005': perDygn = Math.max(1, u.injektioner); varfor = `${perDygn} ${perDygn === 1 ? 'injektion' : 'injektioner'} per dygn enligt läkemedelslistan`; break;
    case 'VK-FA-0001': case 'VK-FA-0002': perDygn = u.insulin ? 4 : 1; varfor = u.insulin ? 'fyra kontroller per dygn vid insulinbehandling' : 'en kontroll per dygn utan insulin'; break;
    case 'VK-FA-0003': perDygn = 0.1; varfor = 'kontroll vid högt blodsocker eller sjukdom'; break;
    case 'VK-FA-0006': perDygn = 1 / 30; varfor = 'en burk per månad'; break;
    case 'VK-FA-0007': perDygn = 1.5; varfor = 'en till två påsar per dygn'; break;
    case 'VK-FA-0008': perDygn = 1 / 3; varfor = 'en platta var tredje dag'; break;
    case 'VK-FA-0009': perDygn = 1 / 3; varfor = 'vid varje byte av platta'; break;
    default: perDygn = 1; varfor = 'en per dygn';
  }
  const antal = Math.max(1, Math.ceil(perDygn * DAGAR_PER_UTTAG / a.forpackning));
  return { forpackningar: antal, perDygn: Math.round(perDygn * 100) / 100, varfor: `${varfor}, för ${DAGAR_PER_UTTAG} dagar: ${antal} ${antal === 1 ? 'förpackning' : 'förpackningar'} om ${a.forpackning} ${a.enhet}` };
}

// Varningar för en ny förskrivning eller en ändring: en artikel som inte passar läkemedelslistan eller diagnoserna, och
// en mängd som är mer än en och en halv gång behovet för tre månader, som kvitteras med motivering.
export function varningar(a, u, forpackningar) {
  const ut = [];
  if (a.kraverAtc && !u.atc.some(x => x.startsWith(a.kraverAtc))) ut.push({ niva: 'observation', regel: 'passar_inte_listan', text: `${a.namn} används till insulin, och patienten har inget insulin i läkemedelslistan som du får se.` });
  if (a.kraverForm && u.insulin && !u.penna) ut.push({ niva: 'observation', regel: 'ingen_penna', text: `${a.namn} passar insulinpennor, och patienten har inget insulin med penna i läkemedelslistan.` });
  if (a.kraverDiagnos && !u.stomi) ut.push({ niva: 'observation', regel: 'ingen_stomi', text: `${a.namn} används vid stomi, och patienten har ingen diagnos för stomi som du får se.` });
  const f = mangdForslag(a, u);
  if (forpackningar > f.forpackningar * 1.5) ut.push({ niva: 'varning', regel: 'stor_mangd', kraverKvittens: true, text: `${forpackningar} förpackningar är mer än behovet för tre månader, som systemet räknar till ${f.forpackningar} (${f.varfor.split(',')[0]}). Motivera den större mängden.` });
  return ut;
}

// ---- Läsning ---------------------------------------------------------------------------------------------------

const status = (r, dag = idag()) => (r.status === 'utsatt' ? 'utsatt' : r.giltig_till < dag ? 'utgangen' : 'giltig');
export const STATUSTEXT = { giltig: 'Giltig', utgangen: 'Utgången', utsatt: 'Utsatt' };
const HISTORIK = { forskriven: 'Förskriven', andrad: 'Ändrad', fornyad: 'Förnyad', utsatt: 'Utsatt', atersatt: 'Insatt igen', registrerad_extern: 'Registrerad från annan förskrivare' };

// Förskrivningarna som användaren får se: inte från en spärrad vårdenhet.
export function synliga(atk) {
  const rader = atk.db.query('SELECT * FROM forbrukningsforskrivningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
}

export function forskrivningUt(db, r, { historik = true } = {}) {
  const a = artikel(r.artikel_id);
  const s = status(r);
  const ut = {
    id: r.id, artikel: a ? { id: a.id, namn: a.namn, varunummer: a.varunummer, forpackning: a.forpackning, enhet: a.enhet } : { id: r.artikel_id, namn: r.artikel_id },
    grupp: r.grupp, gruppText: GRUPPER[r.grupp] ?? r.grupp, forpackningar: r.forpackningar, uttag: r.uttag, anvisning: r.anvisning, orsak: r.orsak,
    giltigTill: r.giltig_till, uppfoljning: { datum: r.uppfoljning, ansvarig: { id: r.ansvarig, namn: personNamn(db, r.ansvarig) } },
    status: s, statusText: STATUSTEXT[s], nllStatus: r.nll_status, extern: r.kalla === 'extern', externForskrivare: r.extern_forskrivare,
    forskriven: { tid: r.skapad, av: { id: r.forskriven_av, namn: personNamn(db, r.forskriven_av) }, enhet: enhetKort(db, r.enhet_id) },
    utsatt: r.status === 'utsatt' ? { tid: r.utsatt_tid, av: personNamn(db, r.utsatt_av), orsak: r.utsatt_orsak } : null,
    mall: r.mall_id ? MALLAR.find(m => m.id === r.mall_id)?.namn ?? r.mall_id : null,
  };
  if (historik) ut.historik = db.query('SELECT * FROM forbrukning_historik WHERE forskrivning_id = ? ORDER BY tid, id').all(r.id)
    .map(h => ({ handelse: h.handelse, text: HISTORIK[h.handelse] ?? h.handelse, tid: h.tid, av: personNamn(db, h.av), enhet: enhetKort(db, h.enhet_id), detalj: h.detalj }));
  return ut;
}

// GET /api/patient/:id/forbrukning. Giltiga, utgångna och utsatta förskrivningar med historik, mallarna som systemet
// föreslår och artiklarna med föreslagen mängd. Filtrering på grupp och status och sortering görs i svaret.
export function lista(atk, { grupp = null, sortering = 'giltighet' } = {}) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  let alla = synliga(atk).map(r => forskrivningUt(db, r));
  if (grupp && Object.hasOwn(GRUPPER, grupp)) alla = alla.filter(f => f.grupp === grupp);
  const sorterad = (l) => [...l].sort(sortering === 'artikel' ? (a, b) => a.artikel.namn.localeCompare(b.artikel.namn, 'sv') : sortering === 'uppfoljning' ? (a, b) => a.uppfoljning.datum.localeCompare(b.uppfoljning.datum) : (a, b) => a.giltigTill.localeCompare(b.giltigTill));
  const u = underlag(atk);
  const kan = kanForskriva(atk);
  const aktiva = new Set(alla.filter(f => f.status === 'giltig').map(f => f.artikel.id));
  return {
    giltiga: sorterad(alla.filter(f => f.status === 'giltig')), utgangna: sorterad(alla.filter(f => f.status === 'utgangen')), utsatta: sorterad(alla.filter(f => f.status === 'utsatt')),
    filter: { grupp: grupp && Object.hasOwn(GRUPPER, grupp) ? grupp : null, sortering }, grupper: GRUPPER,
    forslag: kan.kan ? mallforslag(u, aktiva) : [],
    artiklar: kan.kan ? ARTIKLAR.map(a => ({ id: a.id, namn: a.namn, grupp: a.grupp, gruppText: GRUPPER[a.grupp], forpackning: a.forpackning, enhet: a.enhet, varunummer: a.varunummer,
      anvisning: a.anvisning, mangd: mangdForslag(a, u), redanForskriven: aktiva.has(a.id) })) : [],
    kan, dolda: { sparrade: atk.doldaSparr }, demoregler: DEMOREGLER_FORBRUKNING,
  };
}
const mallforslag = (u, aktiva) => MALLAR.filter(m => u[m.villkor === 'insulin' ? 'penna' : m.villkor])
  // En mall med insulinpenna ersätter mallen för bara egenkontroll.
  .filter(m => !(m.id === 'egenkontroll' && u.penna))
  .map(m => ({ id: m.id, namn: m.namn, varfor: m.varfor, artiklar: m.artiklar.map(id => ({ id, namn: artikel(id).namn, redanForskriven: aktiva.has(id), mangd: mangdForslag(artikel(id), u) })) }))
  .filter(m => m.artiklar.some(a => !a.redanForskriven));

// ---- Förskrivning ----------------------------------------------------------------------------------------------

// Får användaren förskriva? Yrkesrollen och vårdrelation på den egna vårdenheten, utan nödåtkomst och aktivt val.
export function kanForskriva(atk) {
  if (!kanRoll(atk.personal, 'forskriva_forbrukning')) return { kan: false, varfor: null };
  const r = atk.prova('forskriva_forbrukning');
  if (!r.tillaten || r.grund === 'nodatkomst') return { kan: false, varfor: 'Du har ingen vårdrelation till patienten på din vårdenhet. Med nödåtkomst går det bara att läsa.' };
  return { kan: true, varfor: null };
}
function kravForskriva(atk, resurs = null, beskrivning = null) {
  const r = atk.krav('forskriva_forbrukning', { beskrivning });
  const rr = resurs ? atk.krav('forskriva_forbrukning', { resurs, beskrivning }) : r;
  if (r.grund === 'nodatkomst' || rr.grund === 'nodatkomst' || rr.grund === 'aktivt_val') {
    atk.logga('forskriva_forbrukning', 'nekad', beskrivning, 'nekad');
    throw new Fel(403, 'Det här kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
}

const historik = (db, atk, id, handelse, detalj = null, tid = iso()) => db.query('INSERT INTO forbrukning_historik (forskrivning_id, patient_id, enhet_id, handelse, tid, av, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(id, atk.patientId, atk.personal.enhet_id, handelse, tid, atk.personal.id, detalj);

// Kontrollen av det som förskrivs. Systemet fyller i mängd, uttag, anvisning, giltighet och uppföljning när de inte
// anges. Ger { a, rad, varningar }.
function granska(atk, inp, { bort = null } = {}) {
  const a = typeof inp.artikelId === 'string' ? artikel(inp.artikelId) : null;
  if (!a) throw new Fel(400, 'Välj en förbrukningsartikel ur listan.', 'ogiltig', { falt: ['artikelId'] });
  const u = underlag(atk);
  const f = mangdForslag(a, u);
  const forpackningar = inp.forpackningar == null || inp.forpackningar === '' ? f.forpackningar : Number(inp.forpackningar);
  const uttag = inp.uttag == null || inp.uttag === '' ? 4 : Number(inp.uttag);
  const giltigTill = inp.giltigTill ? String(inp.giltigTill) : addDagar(idag(), 365);
  const uppfoljning = inp.uppfoljning ? String(inp.uppfoljning) : addDagar(giltigTill, -30);
  const falt = [];
  if (!Number.isInteger(forpackningar) || forpackningar < 1 || forpackningar > 100) falt.push('forpackningar');
  if (!Number.isInteger(uttag) || uttag < 1 || uttag > 12) falt.push('uttag');
  if (!giltigtDatum(giltigTill) || giltigTill <= idag() || giltigTill > addDagar(idag(), 366)) falt.push('giltigTill');
  if (!giltigtDatum(uppfoljning) || uppfoljning < idag() || uppfoljning > giltigTill) falt.push('uppfoljning');
  if (falt.length) {
    const namn = { forpackningar: 'antal förpackningar per uttag (1 till 100)', uttag: 'antal uttag (1 till 12)', giltigTill: 'giltighet (högst ett år framåt)', uppfoljning: 'uppföljningsdatum (från i dag till giltighetens slut)' };
    throw new Fel(400, `Kontrollera ${falt.map(x => namn[x]).join(', ')}.`, 'ogiltig', { falt });
  }
  // Samma artikel får bara finnas en gång bland de giltiga, bland det användaren får se.
  const dubbel = synliga(atk).find(r => r.artikel_id === a.id && status(r) === 'giltig' && r.id !== bort);
  if (dubbel) throw new Fel(400, `${a.namn} är redan förskriven och giltig till ${dubbel.giltig_till}. Förnya eller ändra den förskrivningen i stället.`, 'ogiltig', { dubblett: dubbel.id });
  const anvisning = text(inp.anvisning) || a.anvisning;
  return { a, u, rad: { forpackningar, uttag, giltigTill, uppfoljning, anvisning, orsak: text(inp.orsak) || null }, varningar: varningar(a, u, forpackningar), mangd: f };
}
function kvittera(v, inp) {
  const kvitterade = Array.isArray(inp.kvitteradeVarningar) ? inp.kvitteradeVarningar : [];
  const saknas = v.filter(x => x.kraverKvittens).map(x => x.regel).filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) throw new Fel(400, 'Varningen måste kvitteras med motivering innan förskrivningen sparas.', 'ogiltig', { varningar: v, kraverKvittens: saknas });
  return kvitterade.filter(k => saknas.length === 0 && v.some(x => x.regel === k.regel)).map(k => `${k.regel}: ${String(k.motivering).trim().slice(0, 300)}`).join('; ') || null;
}

// POST /api/patient/:id/forbrukning: ny förskrivning, eller en förskrivning från en annan förskrivare som registreras
// (extern: { forskrivare, datum }). Den skickas till NLL, utom den externa som redan finns där.
export function forskriv(atk, inp = {}, { mallId = null } = {}) {
  kravForskriva(atk, null, 'forbrukning');
  const db = atk.db;
  const g = granska(atk, inp);
  const kv = kvittera(g.varningar, inp);
  const extern = inp.extern && typeof inp.extern === 'object' ? { forskrivare: text(inp.extern.forskrivare, 120), datum: String(inp.extern.datum ?? '') } : null;
  if (extern && (extern.forskrivare.length < 3 || !giltigtDatum(extern.datum) || extern.datum > idag())) throw new Fel(400, 'Ange vem som förskrev artikeln och när, högst i dag.', 'ogiltig', { falt: ['extern'] });
  const nu = iso();
  const r = db.query(`INSERT INTO forbrukningsforskrivningar (patient_id, enhet_id, artikel_id, grupp, forpackningar, uttag, anvisning, orsak, giltig_till, uppfoljning, ansvarig,
    status, nll_status, kalla, extern_forskrivare, mall_id, skapad, forskriven_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, ?, ?, ?, ?)`)
    .run(atk.patientId, atk.personal.enhet_id, g.a.id, g.a.grupp, g.rad.forpackningar, g.rad.uttag, g.rad.anvisning, g.rad.orsak, g.rad.giltigTill, g.rad.uppfoljning, atk.personal.id,
      extern ? 'finns_i_nll' : 'kvitterad', extern ? 'extern' : 'vardkallan', extern ? `${extern.forskrivare}, ${extern.datum}` : null, mallId, nu, atk.personal.id);
  const id = Number(r.lastInsertRowid);
  historik(db, atk, id, extern ? 'registrerad_extern' : 'forskriven', [extern ? `Förskriven av ${extern.forskrivare} ${extern.datum}` : null, `${g.rad.forpackningar} förpackningar, ${g.rad.uttag} uttag`, kv].filter(Boolean).join('. '), nu);
  atk.logga('forskriva_forbrukning', atk.grund(), `forbrukning:${id}`);
  return { id, forskrivning: forskrivningUt(db, rad(db, id)), varningar: g.varningar, nll: extern ? null : nllSvar() };
}

// En mall: alla artiklar i den som inte redan är förskrivna, med mängden som systemet räknar. En artikel som redan är
// giltig tas bort av systemet och nämns i svaret.
export function forskrivMall(atk, inp = {}) {
  const m = MALLAR.find(x => x.id === inp.mallId);
  if (!m) throw new Fel(400, 'Mallen finns inte.', 'ogiltig', { falt: ['mallId'] });
  kravForskriva(atk, null, `forbrukning:mall:${m.id}`);
  const aktiva = new Set(synliga(atk).filter(r => status(r) === 'giltig').map(r => r.artikel_id));
  const kvar = m.artiklar.filter(id => !aktiva.has(id));
  if (!kvar.length) throw new Fel(400, `Allt i mallen ${m.namn} är redan förskrivet och giltigt.`, 'ogiltig');
  // Varningarna för hela mallen prövas innan något sparas, så att en kvittens inte lämnar en halv mall.
  const u = underlag(atk);
  const alla = kvar.flatMap(id => varningar(artikel(id), u, mangdForslag(artikel(id), u).forpackningar));
  kvittera(alla, inp);
  const ut = kvar.map(id => forskriv(atk, { artikelId: id, orsak: inp.orsak ?? m.namn, kvitteradeVarningar: inp.kvitteradeVarningar }, { mallId: m.id }));
  return { mall: m.namn, forskrivningar: ut.map(x => x.forskrivning), borttagna: m.artiklar.filter(id => aktiva.has(id)).map(id => ({ id, namn: artikel(id).namn, varfor: 'Redan förskriven och giltig.' })), varningar: alla, nll: nllSvar() };
}

const rad = (db, id) => db.query('SELECT * FROM forbrukningsforskrivningar WHERE id = ?').get(id);
export function hamtaRad(db, id, patientId = null) {
  const r = rad(db, Number(id));
  if (!r || (patientId && r.patient_id !== patientId)) throw new Fel(404, 'Förskrivningen finns inte.', 'saknas');
  return r;
}
// En förskrivning som användaren inte får se behandlas som om den inte finns. Ändringar görs på den egna vårdenheten.
function egen(atk, id, beskrivning) {
  const r = synliga(atk).find(x => x.id === Number(id));
  if (!r) throw new Fel(404, 'Förskrivningen finns inte.', 'saknas');
  kravForskriva(atk, { enhet_id: r.enhet_id, gemensam: true }, `${beskrivning}:${r.id}`);
  if (vardenhetFor(atk.db, r.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga('forskriva_forbrukning', 'nekad', `${beskrivning}:${r.id}`, 'nekad');
    throw new Fel(403, 'En förskrivning ändras på den vårdenhet där den gjordes. Gör en ny förskrivning på din vårdenhet om patienten behöver artikeln.', 'nekad');
  }
  return r;
}

// Ändring: mängd, uttag, anvisning eller uppföljning i den pågående förskrivningen, med historik och ny överföring.
export function andra(atk, id, inp = {}) {
  const r = egen(atk, id, 'forbrukning:andra');
  if (status(r) !== 'giltig') throw new Fel(400, `Förskrivningen är ${STATUSTEXT[status(r)].toLowerCase()}. Förnya eller sätt in den igen i stället.`, 'ogiltig');
  const db = atk.db;
  const g = granska(atk, { artikelId: r.artikel_id, forpackningar: inp.forpackningar ?? r.forpackningar, uttag: inp.uttag ?? r.uttag, anvisning: inp.anvisning ?? r.anvisning,
    giltigTill: r.giltig_till, uppfoljning: inp.uppfoljning ?? r.uppfoljning, orsak: r.orsak }, { bort: r.id });
  const kv = kvittera(g.varningar, inp);
  const fore = `${r.forpackningar} förpackningar, ${r.uttag} uttag`;
  const efter = `${g.rad.forpackningar} förpackningar, ${g.rad.uttag} uttag`;
  if (fore === efter && g.rad.anvisning === r.anvisning && g.rad.uppfoljning === r.uppfoljning) throw new Fel(400, 'Inget är ändrat.', 'ogiltig');
  db.query("UPDATE forbrukningsforskrivningar SET forpackningar = ?, uttag = ?, anvisning = ?, uppfoljning = ?, nll_status = 'kvitterad' WHERE id = ?").run(g.rad.forpackningar, g.rad.uttag, g.rad.anvisning, g.rad.uppfoljning, r.id);
  historik(db, atk, r.id, 'andrad', [`Från ${fore} till ${efter}`, g.rad.anvisning !== r.anvisning ? 'Ny anvisning' : null, g.rad.uppfoljning !== r.uppfoljning ? `Uppföljning ${g.rad.uppfoljning}` : null, kv].filter(Boolean).join('. '));
  atk.logga('forskriva_forbrukning', atk.grund(), `forbrukning:${r.id}:andra`);
  return { forskrivning: forskrivningUt(db, rad(db, r.id)), varningar: g.varningar, nll: nllSvar() };
}

// Förnyelse: samma förskrivning gäller ett år till från i dag, med nya uttag. Också en utgången förskrivning förnyas.
export function fornya(atk, id, inp = {}) {
  const r = egen(atk, id, 'forbrukning:fornya');
  if (r.status === 'utsatt') throw new Fel(400, 'Förskrivningen är utsatt. Sätt in den igen i stället, med orsak.', 'ogiltig');
  const db = atk.db;
  const giltigTill = inp.giltigTill ? String(inp.giltigTill) : addDagar(idag(), 365);
  if (!giltigtDatum(giltigTill) || giltigTill <= idag() || giltigTill > addDagar(idag(), 366)) throw new Fel(400, 'Kontrollera giltigheten, högst ett år från i dag.', 'ogiltig', { falt: ['giltigTill'] });
  const uppf = addDagar(giltigTill, -30);
  db.query("UPDATE forbrukningsforskrivningar SET giltig_till = ?, uppfoljning = ?, nll_status = 'kvitterad' WHERE id = ?").run(giltigTill, uppf, r.id);
  historik(db, atk, r.id, 'fornyad', `Giltig till ${giltigTill}, ${r.uttag} nya uttag`);
  atk.logga('forskriva_forbrukning', atk.grund(), `forbrukning:${r.id}:fornya`);
  return { forskrivning: forskrivningUt(db, rad(db, r.id)), nll: nllSvar() };
}

// Utsättning med orsak. Inget raderas, och utsättningen skickas till NLL.
export function sattUt(atk, id, inp = {}) {
  const r = egen(atk, id, 'forbrukning:utsatt');
  if (r.status === 'utsatt') throw new Fel(400, 'Förskrivningen är redan utsatt.', 'ogiltig');
  const orsak = text(inp.orsak);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför förskrivningen sätts ut, med minst tre tecken.', 'ogiltig', { falt: ['orsak'] });
  const db = atk.db;
  const nu = iso();
  db.query("UPDATE forbrukningsforskrivningar SET status = 'utsatt', utsatt_tid = ?, utsatt_av = ?, utsatt_orsak = ?, nll_status = 'kvitterad' WHERE id = ?").run(nu, atk.personal.id, orsak, r.id);
  historik(db, atk, r.id, 'utsatt', orsak, nu);
  atk.logga('forskriva_forbrukning', atk.grund(), `forbrukning:${r.id}:utsatt`);
  return { forskrivning: forskrivningUt(db, rad(db, r.id)), nll: nllSvar() };
}

// Återinsättning av en utsatt förskrivning, med orsak och ny giltighet. Systemet prövar dubbletten som vid en ny.
export function atersatt(atk, id, inp = {}) {
  const r = egen(atk, id, 'forbrukning:atersatt');
  if (r.status !== 'utsatt') throw new Fel(400, 'Bara en utsatt förskrivning sätts in igen.', 'ogiltig');
  const orsak = text(inp.orsak);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför artikeln sätts in igen, med minst tre tecken.', 'ogiltig', { falt: ['orsak'] });
  const g = granska(atk, { artikelId: r.artikel_id, forpackningar: r.forpackningar, uttag: r.uttag, anvisning: r.anvisning }, { bort: r.id });
  const db = atk.db;
  db.query("UPDATE forbrukningsforskrivningar SET status = 'aktiv', giltig_till = ?, uppfoljning = ?, utsatt_tid = NULL, utsatt_av = NULL, utsatt_orsak = NULL, nll_status = 'kvitterad' WHERE id = ?")
    .run(g.rad.giltigTill, g.rad.uppfoljning, r.id);
  historik(db, atk, r.id, 'atersatt', `${orsak}. Giltig till ${g.rad.giltigTill}`);
  atk.logga('forskriva_forbrukning', atk.grund(), `forbrukning:${r.id}:atersatt`);
  return { forskrivning: forskrivningUt(db, rad(db, r.id)), nll: nllSvar() };
}

// Den simulerade NLL kvitterar direkt. Svaret säger att det är simulerat.
const nllSvar = () => ({ status: 'kvitterad', simulerad: true, text: 'Kvitterad av den simulerade Nationella läkemedelslistan.' });

// För patientöversikten: antal giltiga förskrivningar och de som ska följas upp inom 30 dagar, bara bland det som
// användaren får se.
export function oversikt(atk) {
  if (!atk.prova('las_lakemedel').tillaten) return null;
  const alla = synliga(atk);
  const giltiga = alla.filter(r => status(r) === 'giltig');
  return { giltiga: giltiga.length, uppfoljning: giltiga.filter(r => r.uppfoljning <= addDagar(idag(), 30)).map(r => ({ artikel: artikel(r.artikel_id)?.namn ?? r.artikel_id, datum: r.uppfoljning })) };
}
