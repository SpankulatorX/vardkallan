// Konfiguration av regler och parametrar (runda 7, r4, Sussa 12.1.1.3 och 12.1.1.5 till 12.1.1.9). Systemförvaltaren
// ändrar demoreglerna och parametrarna som systemet redan har på ett ställe, med giltighetsdatum, förhandsvisning av
// effekten, fyra ögon och historik. Varje parameter läses av den modul som använder den med varde(db, nyckel, nu), så
// att en godkänd ändring slår igenom i hela systemet från dagen den gäller.
//
// Systemet är experten: det kontrollerar att ett värde är rimligt och förklarar varför det inte är det, räknar fram vad
// ändringen får för effekt i dag och sätter själv giltighetsdatumet om godkännandet kommer efter det föreslagna datumet,
// så att en ändring aldrig gäller bakåt i tiden. Regler som följer av lag eller av behörighetsmodellen går inte att ändra
// här, och sidan säger varför.
//
// Modulen importerar inte modulerna som använder parametrarna, så att de kan importera den. Mallarnas sökord läses från
// journal.js först när de behövs.
import { Fel, iso, idag, addDagar, giltigtDatum, datumAv } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';

export const OMRADEN = {
  administration: { rubrik: 'Administration', sussa: '12.1.1.6' },
  strukturerad: { rubrik: 'Strukturerad information', sussa: '12.1.1.7' },
  lakemedel: { rubrik: 'Läkemedel', sussa: '12.1.1.8' },
  bestallning: { rubrik: 'Beställning och svar', sussa: '12.1.1.9' },
};

const DAG = 86400_000;
const TIMME = 3600_000;
const timmar = (n) => `${n} ${n === 1 ? 'timme' : 'timmar'}`;
const dagar = (n) => `${n} ${n === 1 ? 'dag' : 'dagar'}`;
const minuter = (n) => `${n} ${n === 1 ? 'minut' : 'minuter'}`;
const st = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));

// Parametrarna med heltal. standard är värdet i koden när inget är ändrat, samma som modulens egen konstant (testat).
// min och max har en förklaring på vanlig svenska. effekt räknar fram vad ändringen betyder i dag, bara med antal.
const HELTAL = {
  'remiss.mottagningskvittens_timmar': {
    omrade: 'bestallning', rubrik: 'Larm när mottagningskvittensen dröjer', enhet: 'timmar', standard: 2, min: 1, max: 48, anvands: 'remiss.js',
    beskrivning: 'Så länge efter att en remiss skickades får det dröja innan mottagaren har kvitterat den. Därefter larmar systemet både avsändaren och mottagaren.',
    minVarfor: 'Kortare än en timme ger larm innan mottagningen har haft en rimlig chans att se remissen.',
    maxVarfor: 'Längre än två dygn gör att en remiss som inte har kommit fram kan bli liggande utan att någon märker det.',
    effekt: (db, nytt, forra, nu) => {
      const n = (h) => db.query("SELECT count(*) AS n FROM remisser WHERE status = 'skickad' AND skickad_tid < ?").get(new Date(nu.getTime() - h * TIMME).toISOString()).n;
      return [`I dag larmar ${st(n(nytt), 'remiss', 'remisser')} för utebliven mottagningskvittens med ${timmar(nytt)}, mot ${n(forra)} med ${timmar(forra)}.`];
    },
  },
  'remiss.svarskvittens_dagar': {
    omrade: 'bestallning', rubrik: 'Larm när remissvaret inte har kvitterats', enhet: 'dagar', standard: 3, min: 1, max: 30, anvands: 'remiss.js',
    beskrivning: 'Så många dagar efter svaret ska avsändaren ha kvitterat att svaret är läst. Därefter larmar systemet.',
    minVarfor: 'Ett svar som kommer på fredagen ska kunna kvitteras på måndagen utan larm, och ett dygn är för kort för det.',
    maxVarfor: 'Ett svar som ingen har läst på en månad kan innehålla något som borde ha följts upp. Gränsen får inte vara längre än 30 dagar.',
    effekt: (db, nytt, forra, nu) => {
      const n = (d) => db.query("SELECT count(*) AS n FROM remisser WHERE status = 'besvarad' AND besvarad_tid < ?").get(new Date(nu.getTime() - d * DAG).toISOString()).n;
      return [`I dag larmar ${st(n(nytt), 'remissvar', 'remissvar')} för att svaret inte har kvitterats med ${dagar(nytt)}, mot ${n(forra)} med ${dagar(forra)}.`];
    },
  },
  'lakemedel.dosfonster_fore_min': {
    omrade: 'lakemedel', rubrik: 'Så tidigt före dostiden en dos får ges', enhet: 'minuter', standard: 60, min: 15, max: 120, anvands: 'administrering.js och lakemedelsregler.js',
    beskrivning: 'En dos visas som att ge och kan ges utan varning för tidig dos från så här många minuter före den ordinerade tiden.',
    minVarfor: 'Med mindre än en kvart blir varningen för tidig dos vanlig vid vanliga läkemedelsrundor, och varningar som alltid syns slutar läsas.',
    maxVarfor: 'Mer än två timmar före dostiden kan ge för kort tid till nästa dos för läkemedel som ges flera gånger per dygn.',
    effekt: (db, nytt, forra) => [`Doser visas som att ge ${minuter(nytt)} före dostiden i stället för ${minuter(forra)}, och varningen för tidig dos kommer först om dosen ges tidigare än så.`],
  },
  'lakemedel.dosfonster_efter_min': {
    omrade: 'lakemedel', rubrik: 'Så länge efter dostiden en dos räknas som i tid', enhet: 'minuter', standard: 60, min: 15, max: 180, anvands: 'administrering.js',
    beskrivning: 'Efter så här många minuter efter den ordinerade tiden visas en dos som inte är given som försenad.',
    minVarfor: 'Med mindre än en kvart blir nästan varje dos under en läkemedelsrunda försenad, och det som verkligen är försenat syns inte.',
    maxVarfor: 'Mer än tre timmar gör att en glömd dos syns för sent.',
    effekt: (db, nytt, forra) => [`En dos som inte är given visas som försenad ${minuter(nytt)} efter dostiden i stället för ${minuter(forra)}.`],
  },
  'lakemedel.delegering_paminn_dagar': {
    omrade: 'lakemedel', rubrik: 'Påminnelse innan en delegering går ut', enhet: 'dagar', standard: 30, min: 7, max: 90, anvands: 'delegering.js',
    beskrivning: 'Så många dagar innan en delegering att ge läkemedel går ut påminns den som delegerade i inkorgen.',
    minVarfor: 'En ny delegering kräver att kunskapen kontrolleras, och det hinns inte med på mindre än en vecka.',
    maxVarfor: 'En delegering gäller högst ett år. En påminnelse mer än tre månader före gör att den ligger i inkorgen en fjärdedel av tiden.',
    effekt: (db, nytt, forra, nu) => {
      if (!harTabell(db, 'delegeringar')) return [];
      const dag = datumAv(nu);
      const n = (d) => db.query('SELECT count(DISTINCT personal_id) AS n FROM delegeringar WHERE aterkallad_tid IS NULL AND fran <= ? AND till >= ? AND till <= ?').get(dag, dag, addDagar(dag, d)).n;
      return [`I dag påminns det om ${st(n(nytt), 'delegering', 'delegeringar')} med ${dagar(nytt)}, mot ${n(forra)} med ${dagar(forra)}.`];
    },
  },
  'tidbok.paminnelse_timmar': {
    omrade: 'administration', rubrik: 'Påminnelse före en bokad tid', enhet: 'timmar', standard: 48, min: 12, max: 168, anvands: 'tidbok.js',
    beskrivning: 'Så många timmar före tiden skickar systemet en påminnelse till patienten, i den kanal patienten har.',
    minVarfor: 'Med mindre än tolv timmar hinner patienten inte boka om, och tiden kan inte ges till någon annan.',
    maxVarfor: 'En påminnelse mer än en vecka före glöms bort och fyller inte sin uppgift.',
    effekt: (db, nytt, forra, nu) => {
      if (!harTabell(db, 'bokningar')) return [];
      const n = (h) => db.query("SELECT count(*) AS n FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.status = 'bokad' AND t.start > ? AND t.start <= ?").get(nu.toISOString(), new Date(nu.getTime() + h * TIMME).toISOString()).n;
      return [`Med ${timmar(nytt)} ligger ${st(n(nytt), 'bokad tid', 'bokade tider')} inom påminnelsefönstret just nu, mot ${n(forra)} med ${timmar(forra)}.`];
    },
  },
  'logg.stickprov_antal': {
    omrade: 'administration', rubrik: 'Åtkomster i varje stickprov', enhet: 'åtkomster', standard: 10, min: 5, max: 100, anvands: 'logguppfoljning.js',
    beskrivning: 'Så många åtkomster drar systemet slumpvis i varje stickprov av loggen (HSLF-FS 2016:40 4 kap. 9 b §).',
    minVarfor: 'Färre än fem åtkomster ger för litet underlag för att en systematisk kontroll ska upptäcka obehörig åtkomst.',
    maxVarfor: 'Fler än hundra åtkomster hinner en granskare inte gå igenom ordentligt, och då blir kontrollen bara en formalitet.',
    effekt: (db, nytt, forra) => [`Nästa stickprov drar ${nytt} åtkomster i stället för ${forra}.`],
  },
  'arkiv.gallring_ar': {
    omrade: 'administration', rubrik: 'År innan en journal föreslås för gallring', enhet: 'år', standard: 10, min: 10, max: 100, anvands: 'arkiv.js',
    beskrivning: 'Så många år efter den senaste uppgiften föreslår systemet att en journal kan gallras, om det inte finns någon pågående kontakt. Gallring görs alltid efter ett registrerat beslut.',
    minVarfor: 'En journal ska bevaras i minst tio år efter den senaste uppgiften (patientdatalagen 3 kap. 17 §). Ett kortare värde skulle få systemet att föreslå gallring som inte är tillåten.',
    maxVarfor: 'Mer än hundra år är längre än någon journal behöver bevaras.',
    effekt: (db, nytt, forra) => [`Gallringsförslaget omfattar journaler vars senaste uppgift är äldre än ${nytt} år i stället för ${forra} år. Inget gallras utan ett nytt beslut.`],
  },
  'halsoarende.avsluta_dagar': {
    omrade: 'strukturerad', rubrik: 'Förslag att avsluta ett hälsoärende', enhet: 'dagar', standard: 180, min: 30, max: 730, anvands: 'halsoarende.js',
    beskrivning: 'När ett hälsoärende inte har haft någon vårdkontakt på så här många dagar föreslår systemet att det avslutas.',
    minVarfor: 'Kortare än en månad skulle föreslå att ärenden med vanliga återbesök avslutas mellan besöken.',
    maxVarfor: 'Mer än två år gör att avslutade ärenden blir stående och skymmer de pågående.',
    effekt: (db, nytt, forra, nu) => {
      if (!harTabell(db, 'halsoarenden')) return [];
      const n = (d) => db.query(`SELECT count(*) AS n FROM halsoarenden h WHERE h.status = 'aktivt'
          AND EXISTS (SELECT 1 FROM vardkontakter v WHERE v.halsoarende_id = h.id)
          AND NOT EXISTS (SELECT 1 FROM vardkontakter v WHERE v.halsoarende_id = h.id AND (v.slut IS NULL OR v.slut >= ?))`).get(new Date(nu.getTime() - d * DAG).toISOString()).n;
      return [`Systemet föreslår att ${st(n(nytt), 'hälsoärende', 'hälsoärenden')} avslutas med ${dagar(nytt)}, mot ${n(forra)} med ${dagar(forra)}.`];
    },
  },
};

// Sökorden i journalens mallar (strukturerad information). Läses från journal.js när de behövs.
let journalModul = null;
const journalMallar = () => {
  journalModul ??= require('./journal.js');
  return journalModul.MALLAR;
};
const SOKORD_MAX = 30;
const sokordsparameter = (m) => ({
  omrade: 'strukturerad', rubrik: `Sökord i mallen ${m.typ}`, enhet: 'sökord', typ: 'lista', standard: [...m.sokord], anvands: 'journal.js och anteckningsformuläret',
  beskrivning: `Sökorden som mallen ${m.typ} föreslår, i den ordning de visas. Den som skriver kan alltid lägga till fler sökord i en anteckning.`,
  effekt: (db, nytt, forra) => {
    const nya = nytt.filter(s => !forra.includes(s));
    const borta = forra.filter(s => !nytt.includes(s));
    const ut = [];
    if (nya.length) ut.push(`Nya sökord: ${nya.join(', ')}.`);
    if (borta.length) ut.push(`Tas bort ur mallen: ${borta.join(', ')}.`);
    if (!nya.length && !borta.length) ut.push('Samma sökord i en annan ordning.');
    ut.push('Anteckningar som redan är skrivna ändras inte. De visar sina sökord som när de skrevs.');
    return ut;
  },
});

let alla = null;
export function parametrar() {
  if (!alla) {
    alla = { ...Object.fromEntries(Object.entries(HELTAL).map(([k, d]) => [k, { typ: 'heltal', ...d }])) };
    for (const m of journalMallar()) alla[`journal.sokord.${m.typ}`] = sokordsparameter(m);
  }
  return alla;
}

// Regler som inte går att ändra som parametrar, och varför.
export const LASTA = [
  { rubrik: 'Vårdrelation, inre sekretess, spärr och nödåtkomst', varfor: 'Behörighetsreglerna följer patientdatalagen 4 kap. och HSLF-FS 2016:40 och finns i behörighetsmotorn, inte som parametrar, så att ingen kan vidga åtkomsten till journaler med en inställning. En spärr sätts och hävs bara på patientens begäran.' },
  { rubrik: 'Åtkomstloggen och säkerhetsloggen', varfor: 'Loggarna går inte att stänga av, ändra eller radera (HSLF-FS 2016:40 4 kap. 9 §). Det skyddas av databasens triggrar.' },
  { rubrik: 'Ordinationsorsak och uppföljningsdatum i en ordination', varfor: 'Uppgifterna krävs för Nationella läkemedelslistan och kan inte göras frivilliga.' },
  { rubrik: 'Vem som får läsa journalen i Min journal', varfor: 'Åldersgränserna för egen läsning och för vårdnadshavare följer villkoren för invånartjänsten. Undantag från visning gäller aldrig Min journal.' },
  { rubrik: 'Signerade anteckningar och rättelser', varfor: 'En signerad anteckning ändras aldrig. Rättelser görs som en ny version (HSLF-FS 2016:40 6 kap.).' },
];

// Gällande värde för en parameter en viss dag. En sandlåda utan tabellen, eller en parameter utan godkänd ändring, har
// standardvärdet.
export function varde(db, nyckel, nu = new Date()) {
  const def = parametrar()[nyckel];
  if (!def) throw new Error(`Okänd parameter: ${nyckel}`);
  let rad = null;
  try {
    rad = db.query(`SELECT varde FROM konfig_andringar WHERE slag = 'parameter' AND nyckel = ? AND status = 'godkand' AND galler_fran <= ?
      ORDER BY galler_fran DESC, beslutad DESC, id DESC LIMIT 1`).get(nyckel, datumAv(nu));
  } catch { /* äldre sandlåda */ }
  return rad ? JSON.parse(rad.varde) : (Array.isArray(def.standard) ? [...def.standard] : def.standard);
}

// Kontrollerar ett värde. Returnerar { ok, varde, varfor }.
export function prova(nyckel, inmatat) {
  const def = parametrar()[nyckel];
  if (!def) return { ok: false, varfor: 'Parametern finns inte.' };
  if (def.typ === 'lista') {
    const lista = (Array.isArray(inmatat) ? inmatat : String(inmatat ?? '').split(/[,\n]/)).map(s => String(s).trim()).filter(Boolean);
    if (!lista.length) return { ok: false, varfor: 'Mallen behöver minst ett sökord, annars har den som skriver inget att utgå från.' };
    if (lista.length > SOKORD_MAX) return { ok: false, varfor: `En mall kan ha högst ${SOKORD_MAX} sökord. Fler går inte att överblicka, och en anteckning kan alltid få fler sökord när den skrivs.` };
    const lang = lista.find(s => s.length > 80);
    if (lang) return { ok: false, varfor: `Sökordet "${lang.slice(0, 30)}" är längre än 80 tecken. Ett sökord är en rubrik, inte en text.` };
    const sedda = new Set();
    for (const s of lista) {
      const k = s.toLocaleLowerCase('sv');
      if (sedda.has(k)) return { ok: false, varfor: `Sökordet ${s} finns två gånger. Samma sökord två gånger gör att texten hamnar på två ställen.` };
      sedda.add(k);
    }
    return { ok: true, varde: lista };
  }
  const t = typeof inmatat === 'number' ? inmatat : Number(String(inmatat ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(t) || !Number.isInteger(t)) return { ok: false, varfor: `Skriv ett heltal i ${def.enhet}.` };
  if (t < def.min) return { ok: false, varfor: `Lägsta värde är ${def.min} ${def.enhet}. ${def.minVarfor}` };
  if (t > def.max) return { ok: false, varfor: `Högsta värde är ${def.max} ${def.enhet}. ${def.maxVarfor}` };
  return { ok: true, varde: t };
}

const visa = (def, v) => (def.typ === 'lista' ? v.join(', ') : `${v} ${def.enhet}`);
const lika = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const personnamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);

function kravRoll(personal, handling = 'konfigurera') {
  if (!kanRoll(personal, handling)) throw new Fel(403, 'Bara systemförvaltningen ändrar regler och parametrar.', 'nekad');
}

const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs, grund: 'administrativ' });

// Förhandsvisning: om värdet är rimligt, vad som gäller nu och vad ändringen får för effekt i dag. Inga patientuppgifter.
export function forhandsvisa(db, personal, { nyckel, varde: inmatat, giltigFran } = {}, nu = new Date()) {
  kravRoll(personal);
  const def = parametrar()[nyckel];
  if (!def) throw new Fel(404, 'Parametern finns inte.', 'saknas');
  const forra = varde(db, nyckel, nu);
  const p = prova(nyckel, inmatat);
  const datum = giltigFran ?? addDagar(datumAv(nu), 1);
  const ut = { nyckel, rubrik: def.rubrik, forra, forraText: visa(def, forra), ok: p.ok, varfor: p.varfor ?? null, effekt: [], giltigFran: datum };
  if (!p.ok) return ut;
  ut.varde = p.varde;
  ut.vardeText = visa(def, p.varde);
  if (lika(p.varde, forra)) { ut.ok = false; ut.varfor = `Värdet är redan ${visa(def, forra)}.`; return ut; }
  ut.effekt = def.effekt(db, p.varde, forra, nu);
  ut.effekt.push(`Gäller från ${datum}. Det som redan har hänt bedöms efter de regler som gällde då.`);
  return ut;
}

// Föreslår en ändring. Den gäller först när en annan systemförvaltare har godkänt den.
export function foresla(db, personal, { nyckel, varde: inmatat, giltigFran, motivering } = {}, nu = new Date()) {
  kravRoll(personal);
  const def = parametrar()[nyckel];
  if (!def) throw new Fel(404, 'Parametern finns inte.', 'saknas');
  const dag = datumAv(nu);
  const datum = giltigFran ?? addDagar(dag, 1);
  if (!giltigtDatum(datum)) throw new Fel(400, 'Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['giltigFran'] });
  if (datum < dag) throw new Fel(400, 'En ändring kan inte gälla bakåt i tiden. Det som redan har hänt ska bedömas efter de regler som gällde då.', 'ogiltig', { falt: ['giltigFran'] });
  const m = typeof motivering === 'string' ? motivering.trim() : '';
  if (!m) throw new Fel(400, 'Skriv varför ändringen behövs. Motiveringen följer med ändringen i historiken.', 'ogiltig', { falt: ['motivering'] });
  if (m.length > 1000) throw new Fel(400, 'Motiveringen får vara högst 1000 tecken.', 'ogiltig', { falt: ['motivering'] });
  const p = prova(nyckel, inmatat);
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: ['varde'] });
  const forra = varde(db, nyckel, nu);
  if (lika(p.varde, forra)) throw new Fel(400, `Värdet är redan ${visa(def, forra)}.`, 'ogiltig', { falt: ['varde'] });
  if (db.query("SELECT 1 FROM konfig_andringar WHERE nyckel = ? AND status = 'vantar'").get(nyckel)) {
    throw new Fel(409, 'Det finns redan en ändring av parametern som väntar på godkännande. Godkänn, avslå eller återkalla den först, så att två ändringar inte gäller samtidigt.', 'ogiltig');
  }
  const r = db.query(`INSERT INTO konfig_andringar (slag, nyckel, varde, forra, giltig_fran, motivering, foreslagen_av, foreslagen)
    VALUES ('parameter', ?, ?, ?, ?, ?, ?, ?)`).run(nyckel, JSON.stringify(p.varde), JSON.stringify(forra), datum, m, personal.id, iso(nu));
  const id = Number(r.lastInsertRowid);
  loggaAtgard(db, personal, `konfiguration:${id}`);
  return { andring: andringUt(db, hamta(db, id), personal) };
}

function hamta(db, id) {
  const a = db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id));
  if (!a) throw new Fel(404, 'Ändringen finns inte.', 'saknas');
  return a;
}

// Godkänner en ändring som någon annan har föreslagit. Värdet kontrolleras igen, eftersom reglerna kan ha ändrats.
export function godkann(db, personal, id, { kommentar } = {}, nu = new Date()) {
  const a = hamta(db, id);
  kravRoll(personal, a.slag === 'undantag' ? 'undanta' : 'konfigurera');
  if (a.status !== 'vantar') throw new Fel(409, 'Ändringen är redan beslutad.', 'ogiltig');
  if (a.foreslagen_av === personal.id) {
    throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som föreslog ändringen måste godkänna den.', 'nekad');
  }
  if (a.slag === 'parameter') {
    const p = prova(a.nyckel, JSON.parse(a.varde));
    if (!p.ok) throw new Fel(400, `Ändringen kan inte godkännas: ${p.varfor}`, 'ogiltig');
  }
  const dag = datumAv(nu);
  const galler = a.giltig_fran < dag ? dag : a.giltig_fran;
  db.query("UPDATE konfig_andringar SET status = 'godkand', beslutad_av = ?, beslutad = ?, beslut_kommentar = ?, galler_fran = ? WHERE id = ?")
    .run(personal.id, iso(nu), typeof kommentar === 'string' && kommentar.trim() ? kommentar.trim().slice(0, 500) : null, galler, a.id);
  loggaAtgard(db, personal, `konfiguration:${a.id}`);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id,
    beskrivning: `${a.slag === 'undantag' ? 'Undantag' : 'Parametern'} ${a.nyckel} ändrad från ${galler}, föreslagen av ${personnamn(db, a.foreslagen_av)} och godkänd av ${personal.namn}.` });
  return { andring: andringUt(db, hamta(db, a.id), personal) };
}

// Avslår en ändring (någon annan än förslagsställaren) eller återkallar den (förslagsställaren själv).
export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date()) {
  const a = hamta(db, id);
  kravRoll(personal, a.slag === 'undantag' ? 'undanta' : 'konfigurera');
  if (a.status !== 'vantar') throw new Fel(409, 'Ändringen är redan beslutad.', 'ogiltig');
  const egen = a.foreslagen_av === personal.id;
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (!egen && !k) throw new Fel(400, 'Skriv varför ändringen avslås, så att den som föreslog den vet vad som behöver göras.', 'ogiltig', { falt: ['kommentar'] });
  db.query('UPDATE konfig_andringar SET status = ?, beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?')
    .run(egen ? 'aterkallad' : 'avslagen', personal.id, iso(nu), k || null, a.id);
  loggaAtgard(db, personal, `konfiguration:${a.id}`);
  return { andring: andringUt(db, hamta(db, a.id), personal) };
}

const STATUS = { vantar: 'Väntar på godkännande', godkand: 'Godkänd', avslagen: 'Avslagen', aterkallad: 'Återkallad' };

export function andringUt(db, a, personal = null) {
  const def = a.slag === 'parameter' ? parametrar()[a.nyckel] : null;
  const v = JSON.parse(a.varde);
  const f = a.forra ? JSON.parse(a.forra) : null;
  return {
    id: a.id, slag: a.slag, nyckel: a.nyckel, rubrik: def?.rubrik ?? a.nyckel, omrade: def?.omrade ?? null,
    varde: v, forra: f, vardeText: def ? visa(def, v) : null, forraText: def && f != null ? visa(def, f) : null,
    giltigFran: a.giltig_fran, gallerFran: a.galler_fran, motivering: a.motivering,
    foreslagenAv: personnamn(db, a.foreslagen_av), foreslagen: a.foreslagen, status: a.status, statusText: STATUS[a.status],
    beslutadAv: personnamn(db, a.beslutad_av), beslutad: a.beslutad, kommentar: a.beslut_kommentar,
    egen: personal ? a.foreslagen_av === personal.id : false,
    kanGodkanna: Boolean(personal && a.status === 'vantar' && a.foreslagen_av !== personal.id),
  };
}

// Sidan för regler och parametrar: varje parameter per område med gällande och kommande värde, ändringar som väntar,
// historiken och det som inte går att ändra här.
export function oversikt(db, personal, nu = new Date()) {
  kravRoll(personal);
  const dag = datumAv(nu);
  const defs = parametrar();
  const andringar = db.query("SELECT * FROM konfig_andringar WHERE slag = 'parameter' ORDER BY id DESC").all();
  const per = (nyckel) => andringar.filter(a => a.nyckel === nyckel);
  const grupper = Object.entries(OMRADEN).map(([id, o]) => ({
    id, rubrik: o.rubrik, sussa: o.sussa,
    parametrar: Object.entries(defs).filter(([, d]) => d.omrade === id).map(([nyckel, d]) => {
      const g = varde(db, nyckel, nu);
      const kommande = per(nyckel).filter(a => a.status === 'godkand' && a.galler_fran > dag).sort((a, b) => a.galler_fran.localeCompare(b.galler_fran))[0];
      const vantar = per(nyckel).find(a => a.status === 'vantar');
      return {
        nyckel, rubrik: d.rubrik, beskrivning: d.beskrivning, typ: d.typ, enhet: d.enhet, min: d.min ?? null, max: d.max ?? null,
        varde: g, vardeText: visa(d, g), standard: d.standard, arStandard: lika(g, d.standard), anvands: d.anvands,
        kommande: kommande ? { gallerFran: kommande.galler_fran, vardeText: visa(d, JSON.parse(kommande.varde)) } : null,
        vantar: vantar ? andringUt(db, vantar, personal) : null,
      };
    }),
  }));
  const vantande = andringar.filter(a => a.status === 'vantar').map(a => andringUt(db, a, personal));
  return {
    grupper, lasta: LASTA,
    attGodkanna: vantande.filter(a => a.kanGodkanna), mina: vantande.filter(a => a.egen),
    historik: andringar.filter(a => a.status !== 'vantar').slice(0, 50).map(a => andringUt(db, a, personal)),
    forvalDatum: addDagar(dag, 1),
    anmarkning: 'Parametrarna är demoregler. En ändring gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden.',
  };
}

// Journalens mallar med de sökord som gäller i dag (GET /api/mallar).
export function mallar(db, nu = new Date()) {
  return journalMallar().map(m => ({ ...m, sokord: varde(db, `journal.sokord.${m.typ}`, nu) }));
}
