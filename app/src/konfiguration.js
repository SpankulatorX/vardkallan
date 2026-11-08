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
  // Runda 8, r5: utloggningen efter en tid utan aktivitet, som kunden själv konfigurerar (Sussa 12.1.1.5).
  sakerhet: { rubrik: 'Säkerhet', sussa: '12.1.1.5' },
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
  // Runda 8, r5: utloggningen efter en tid utan aktivitet, skild för personal och invånare (K2 1.6.1, justerbar
  // tidsgräns). Servern läser värdet för sessionens sandlåda vid varje anrop (server.js), och varningen kommer alltid
  // fem minuter före utloggningen.
  'sakerhet.utloggning_personal_min': {
    omrade: 'sakerhet', rubrik: 'Utloggning efter tid utan aktivitet, personal', enhet: 'minuter', standard: 30, min: 5, max: 120, anvands: 'server.js och tidsgrans.js',
    beskrivning: 'Så många minuter utan aktivitet loggas personalen ut. Fem minuter före visas en varning med knappen Fortsätt arbeta, och text i en anteckning eller remiss sparas som utkast.',
    minVarfor: 'Med mindre än fem minuter kommer varningen, som visas fem minuter före, direkt efter varje klick, och den som läser journalen under ett samtal med patienten loggas ut mitt i samtalet.',
    maxVarfor: 'Med mer än två timmar står en dator som lämnas i ett behandlingsrum eller en korridor öppen med patientuppgifter alldeles för länge.',
    effekt: (db, nytt, forra) => [`Personalen loggas ut efter ${minuter(nytt)} utan aktivitet i stället för ${minuter(forra)}. Varningen kommer ${minuter(Math.max(0, nytt - 5))} efter den senaste aktiviteten. Invånarna i Min journal har en egen gräns.`],
  },
  'sakerhet.utloggning_invanare_min': {
    omrade: 'sakerhet', rubrik: 'Utloggning efter tid utan aktivitet, Min journal', enhet: 'minuter', standard: 30, min: 5, max: 60, anvands: 'server.js och tidsgrans.js',
    beskrivning: 'Så många minuter utan aktivitet loggas en invånare ut ur Min journal. Fem minuter före visas samma varning som för personalen.',
    minVarfor: 'Med mindre än fem minuter hinner en invånare inte läsa en längre anteckning innan varningen kommer.',
    maxVarfor: 'En invånare loggar ofta in från en dator som andra också använder, till exempel på ett bibliotek eller hemma. Med mer än en timme kan nästa person läsa journalen.',
    effekt: (db, nytt, forra) => [`Invånarna loggas ut ur Min journal efter ${minuter(nytt)} utan aktivitet i stället för ${minuter(forra)}. Personalens gräns ändras inte.`],
  },
};

// Runda 8, r5: parametrar med svaret ja eller nej. text är vad värdet betyder, för sidan och historiken.
const JANEJ = {
  'rapportering.bhvq_undanta_skyddad': {
    omrade: 'administration', rubrik: 'Barn med skyddade personuppgifter i barnhälsovårdsregistret', typ: 'janej', standard: true, anvands: 'bhvq.js',
    text: { true: 'Rapporteras inte till registret', false: 'Rapporteras som andra barn' },
    beskrivning: 'Om uppgifter om barn med skyddade personuppgifter ska undantas från rapporteringen till Svenska barnhälsovårdsregistret. Det är vårdgivarens beslut, inte en regel i patientdatalagen. Barn vars vårdnadshavare har motsatt sig registreringen rapporteras aldrig, oavsett värdet.',
    effekt: (db, nytt) => {
      const n = harTabell(db, 'bhv_inskrivning') ? db.query('SELECT count(*) AS n FROM bhv_inskrivning i JOIN patienter p ON p.id = i.patient_id WHERE p.skyddad = 1 AND p.sammanslagen_till IS NULL').get().n : 0;
      return [nytt ? `Barn med skyddade personuppgifter undantas från nästa utskick. I dag gäller det ${st(n, 'inskrivet barn', 'inskrivna barn')}.` : `Barn med skyddade personuppgifter rapporteras från nästa utskick, med personnumret men utan namn. I dag gäller det ${st(n, 'inskrivet barn', 'inskrivna barn')}.`,
        'Det som redan har skickats ändras inte.'];
    },
  },
};

// Runda 8, r1: beställning och svar (labb.js, Sussa 12.1.1.9). Svarstiden för det simulerade laboratoriet, larmet för
// prov som inte är tagna och paketens innehåll, som systemförvaltningen ändrar på ett ställe och som slår igenom i
// förslagen, i beställningarna och i inkorgen. Katalogen importeras som data, inte modulen som använder parametrarna.
import { PAKET as LABB_PAKET, ANALYSER as LABB_ANALYSER } from './labb-katalog.js';
Object.assign(HELTAL, {
  'labb.svar_minuter': {
    omrade: 'bestallning', rubrik: 'Svarstid för det simulerade laboratoriet', enhet: 'minuter', standard: 20, min: 1, max: 1440, anvands: 'labb.js',
    beskrivning: 'Så lång tid efter att proverna har kommit till laboratoriet svarar det simulerade laboratoriet. Ett riktigt laboratorium svarar när analysen är klar.',
    minVarfor: 'Kortare än en minut går inte att skilja från att svaret kommer direkt.',
    maxVarfor: 'Längre än ett dygn gör att demon ser ut att ha tappat proverna.',
    effekt: (db, nytt, forra, nu) => {
      if (!harTabell(db, 'labb_analyser')) return [];
      const n = (m) => db.query("SELECT count(*) AS n FROM labb_analyser WHERE status = 'mottagen' AND mottagen_tid <= ?").get(new Date(nu.getTime() - m * 60_000).toISOString()).n;
      return [`Med ${minuter(nytt)} skulle laboratoriet svara på ${st(n(nytt), 'analys', 'analyser')} nu, mot ${n(forra)} med ${minuter(forra)}.`];
    },
  },
  'labb.provtagning_larm_timmar': {
    omrade: 'bestallning', rubrik: 'Prov som inte är tagna visas som försenade', enhet: 'timmar', standard: 4, min: 1, max: 72, anvands: 'labb.js och provtagningslistan',
    beskrivning: 'Så många timmar efter den planerade provtagningstiden visas ett prov som inte är taget som försenat i provtagningslistan och i beställningen.',
    minVarfor: 'Kortare än en timme gör att en vanlig provtagningsrunda visar nästan alla prov som försenade.',
    maxVarfor: 'Längre än tre dygn gör att ett glömt prov syns för sent för att svaret ska vara till nytta.',
    effekt: (db, nytt, forra, nu) => {
      if (!harTabell(db, 'labb_prov')) return [];
      const n = (h) => db.query('SELECT count(*) AS n FROM labb_prov p JOIN labb_bestallningar b ON b.id = p.bestallning_id WHERE p.provtagen_tid IS NULL AND p.borttagen = 0 AND b.makulerad_tid IS NULL AND p.planerad < ?').get(new Date(nu.getTime() - h * TIMME).toISOString()).n;
      return [`I dag visas ${st(n(nytt), 'rör', 'rör')} som försenade med ${timmar(nytt)}, mot ${n(forra)} med ${timmar(forra)}.`];
    },
  },
});
// Runda 9, r7: målvärden för ledtiderna i subprocesserna (sparbarhet.js, Sussa 6.1.1.4). Systemförvaltaren sätter målen,
// och uppföljningen av remiss, provtagning och läkemedelsöverföring visar andelen inom målet. Standardvärdena är
// Vårdkällans demoförslag, inte regionens mål.
OMRADEN.uppfoljning = { rubrik: 'Uppföljning och ledtider', sussa: '6.1.1.4' };
const andelInom = (rader, grans) => (rader.length ? Math.round(rader.filter(x => x <= grans).length / rader.length * 100) : null);
Object.assign(HELTAL, {
  'ledtid.remiss_svar_dagar': {
    omrade: 'uppfoljning', rubrik: 'Mål för ledtiden från remiss till svar', enhet: 'dagar', standard: 14, min: 1, max: 180, anvands: 'sparbarhet.js och uppföljningen av subprocesser',
    beskrivning: 'Så många dagar får det ta från att en remiss skickas till att den är besvarad. Uppföljningen visar andelen remisser inom målet.',
    minVarfor: 'Kortare än ett dygn är inget rimligt mål för en remiss som ska bedömas och besvaras.',
    maxVarfor: 'Längre än ett halvår är inget mål som går att följa upp.',
    effekt: (db, nytt, forra) => {
      const d = db.query('SELECT skickad_tid, besvarad_tid FROM remisser WHERE besvarad_tid IS NOT NULL').all().map(r => (Date.parse(r.besvarad_tid) - Date.parse(r.skickad_tid)) / DAG);
      return [`Med ${dagar(nytt)} är ${andelInom(d, nytt) ?? 0} procent av de besvarade remisserna inom målet, mot ${andelInom(d, forra) ?? 0} procent med ${dagar(forra)}.`];
    },
  },
  'ledtid.labb_svar_timmar': {
    omrade: 'uppfoljning', rubrik: 'Mål för ledtiden från provtagning till svar', enhet: 'timmar', standard: 24, min: 1, max: 336, anvands: 'sparbarhet.js och uppföljningen av subprocesser',
    beskrivning: 'Så många timmar får det ta från att provet tas till att svaret kommer från laboratoriet.',
    minVarfor: 'Kortare än en timme hinner inget laboratorium svara på.',
    maxVarfor: 'Längre än två veckor är inget mål som går att följa upp för vanliga prover.',
    effekt: (db, nytt, forra) => {
      if (!harTabell(db, 'labb_analyser')) return [];
      const t = db.query('SELECT a.besvarad_tid, p.provtagen_tid FROM labb_analyser a JOIN labb_prov p ON p.id = a.prov_id WHERE a.besvarad_tid IS NOT NULL AND p.provtagen_tid IS NOT NULL').all().map(r => (Date.parse(r.besvarad_tid) - Date.parse(r.provtagen_tid)) / TIMME);
      return [`Med ${timmar(nytt)} är ${andelInom(t, nytt) ?? 0} procent av svaren inom målet, mot ${andelInom(t, forra) ?? 0} procent med ${timmar(forra)}.`];
    },
  },
  'ledtid.nll_kvittens_minuter': {
    omrade: 'uppfoljning', rubrik: 'Mål för ledtiden från överföring till kvittens från NLL', enhet: 'minuter', standard: 5, min: 1, max: 120, anvands: 'sparbarhet.js och uppföljningen av subprocesser',
    beskrivning: 'Så många minuter får det ta från att en ordination skickas till Nationella läkemedelslistan till att kvittensen kommer.',
    minVarfor: 'Kortare än en minut går inte att skilja från att kvittensen kommer direkt.',
    maxVarfor: 'Längre än två timmar betyder att apoteket kan sakna ordinationen när patienten kommer.',
    effekt: (db, nytt, forra) => {
      const m = db.query("SELECT skickad, svar_tid FROM nll_meddelanden WHERE svar_tid IS NOT NULL AND status = 'kvitterad'").all().map(r => (Date.parse(r.svar_tid) - Date.parse(r.skickad)) / 60_000);
      return [`Med ${minuter(nytt)} är ${andelInom(m, nytt) ?? 0} procent av överföringarna inom målet, mot ${andelInom(m, forra) ?? 0} procent med ${minuter(forra)}.`];
    },
  },
});
// Paketens innehåll: en lista med analysernas namn ur katalogen. Varje namn prövas mot katalogen, så att ett paket aldrig
// innehåller en analys som laboratoriet inte kan ta emot.
const labbAnalysNamn = new Map(LABB_ANALYSER.map(a => [a.namn.toLocaleLowerCase('sv'), a]));
const labbPaketparameter = (pk) => ({
  omrade: 'bestallning', rubrik: `Paketet ${pk.namn}`, enhet: 'analyser', typ: 'lista', standard: pk.analyser.map(id => LABB_ANALYSER.find(a => a.id === id).namn), anvands: 'labb.js och beställningsformuläret',
  beskrivning: `Analyserna i paketet ${pk.namn}, som systemet föreslår vid beställning. Skriv analysernas namn som i katalogen, åtskilda med kommatecken.`,
  provaLista: (lista) => {
    if (!lista.length) return 'Ett paket behöver minst en analys.';
    if (lista.length > 20) return 'Ett paket kan ha högst 20 analyser. Ett större paket går inte att överblicka och ger prover som inte behövs.';
    const sedda = new Set();
    for (const s of lista) {
      const a = labbAnalysNamn.get(s.toLocaleLowerCase('sv'));
      if (!a) return `${s} finns inte i analyskatalogen. Skriv namnet som i katalogen, till exempel ${LABB_ANALYSER[0].namn} eller ${LABB_ANALYSER[1].namn}.`;
      if (sedda.has(a.id)) return `${a.namn} står två gånger i paketet.`;
      sedda.add(a.id);
    }
    return null;
  },
  effekt: (db, nytt, forra) => {
    const nya = nytt.filter(s => !forra.includes(s));
    const borta = forra.filter(s => !nytt.includes(s));
    return [nya.length ? `Läggs till: ${nya.join(', ')}.` : '', borta.length ? `Tas bort: ${borta.join(', ')}.` : '', 'Beställningar som redan är gjorda ändras inte.'].filter(Boolean);
  },
});

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
    alla = { ...Object.fromEntries(Object.entries(HELTAL).map(([k, d]) => [k, { typ: 'heltal', ...d }])), ...JANEJ };
    // Runda 8, r5: en strukturerad mall (tobaksvanor) har inga sökord att ändra.
    for (const m of journalMallar().filter(x => !x.strukturerad)) alla[`journal.sokord.${m.typ}`] = sokordsparameter(m);
    // Runda 8, r1: paketen i beställning och svar.
    for (const pk of LABB_PAKET) alla[`labb.paket.${pk.id}`] = labbPaketparameter(pk);
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
  // Runda 8, r5: ja eller nej.
  if (def.typ === 'janej') {
    const v = typeof inmatat === 'boolean' ? inmatat : { ja: true, true: true, nej: false, false: false }[String(inmatat ?? '').trim().toLowerCase()];
    return typeof v === 'boolean' ? { ok: true, varde: v } : { ok: false, varfor: 'Välj ja eller nej.' };
  }
  if (def.typ === 'lista') {
    const lista = (Array.isArray(inmatat) ? inmatat : String(inmatat ?? '').split(/[,\n]/)).map(s => String(s).trim()).filter(Boolean);
    // Runda 8, r1: en lista med egen prövning, som paketen i beställning och svar.
    if (def.provaLista) {
      const fel = def.provaLista(lista);
      if (fel) return { ok: false, varfor: fel };
      return { ok: true, varde: lista.map(s => labbAnalysNamn.get(s.toLocaleLowerCase('sv'))?.namn ?? s) };
    }
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

// Runda 8, r5: ett ja eller nej som redan gäller beskrivs med regelns text.
const redan = (def, v) => (def.typ === 'janej' ? `Det gäller redan: ${visa(def, v).toLowerCase()}.` : `Värdet är redan ${visa(def, v)}.`);
const visa = (def, v) => (def.typ === 'lista' ? v.join(', ') : def.typ === 'janej' ? def.text[String(v)] : `${v} ${def.enhet}`);
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
  if (lika(p.varde, forra)) { ut.ok = false; ut.varfor = redan(def, forra); return ut; }
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
  if (lika(p.varde, forra)) throw new Fel(400, redan(def, forra), 'ogiltig', { falt: ['varde'] });
  if (db.query("SELECT 1 FROM konfig_andringar WHERE nyckel = ? AND status = 'vantar'").get(nyckel)) {
    throw new Fel(409, 'Det finns redan en ändring av parametern som väntar på godkännande. Godkänn, avslå eller återkalla den först, så att två ändringar inte gäller samtidigt.', 'ogiltig');
  }
  const r = db.query(`INSERT INTO konfig_andringar (slag, nyckel, varde, forra, giltig_fran, motivering, foreslagen_av, foreslagen)
    VALUES ('parameter', ?, ?, ?, ?, ?, ?, ?)`).run(nyckel, JSON.stringify(p.varde), JSON.stringify(forra), datum, m, personal.id, iso(nu));
  const id = Number(r.lastInsertRowid);
  loggaAtgard(db, personal, `konfiguration:${id}`);
  return { andring: andringUt(db, hamta(db, id), personal) };
}

// En ändring med id. Med slag (parameter eller undantag) ger en ändring av ett annat slag 404, så att varje rutt bara
// når sina egna ändringar.
function hamta(db, id, slag = null) {
  const a = db.query('SELECT * FROM konfig_andringar WHERE id = ?').get(Number(id));
  if (!a || (slag && a.slag !== slag)) throw new Fel(404, 'Ändringen finns inte.', 'saknas');
  return a;
}

// Prövar ändringen igen före godkännandet, eftersom reglerna eller läget kan ha ändrats sedan den föreslogs. Samma prövning
// för parametrar och undantag, vilken väg godkännandet än kommer.
function proverIgen(db, a, nu) {
  if (a.slag === 'parameter') {
    const p = prova(a.nyckel, JSON.parse(a.varde));
    if (!p.ok) throw new Fel(400, `Ändringen kan inte godkännas: ${p.varfor}`, 'ogiltig');
    return;
  }
  const [omfang, ...rest] = a.nyckel.split(':');
  const p = require('./undantag.js').prova(db, { omfang, varde: rest.join(':'), kanaler: JSON.parse(a.varde).kanaler }, nu);
  if (!p.ok) throw new Fel(400, `Undantaget kan inte godkännas: ${p.varfor}`, 'ogiltig');
}

// Godkänner en ändring som någon annan har föreslagit. Värdet kontrolleras igen, eftersom reglerna kan ha ändrats.
export function godkann(db, personal, id, { kommentar } = {}, nu = new Date(), { slag = null } = {}) {
  const a = hamta(db, id, slag);
  kravRoll(personal, a.slag === 'undantag' ? 'undanta' : 'konfigurera');
  if (a.status !== 'vantar') throw new Fel(409, 'Ändringen är redan beslutad.', 'ogiltig');
  if (a.foreslagen_av === personal.id) {
    throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som föreslog ändringen måste godkänna den.', 'nekad');
  }
  proverIgen(db, a, nu);
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
export function avsluta(db, personal, id, { kommentar } = {}, nu = new Date(), { slag = null } = {}) {
  const a = hamta(db, id, slag);
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
        nyckel, rubrik: d.rubrik, beskrivning: d.beskrivning, typ: d.typ, enhet: d.enhet ?? null, min: d.min ?? null, max: d.max ?? null, text: d.text ?? null,
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
  return journalMallar().map(m => (m.strukturerad ? { ...m } : { ...m, sokord: varde(db, `journal.sokord.${m.typ}`, nu) }));
}
