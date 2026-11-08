// Runda 10, r7: kapacitet och prognos, ombud med fullmakt, kassan och avgifterna för tjänster, meddelanden mellan
// invånare och vård, vårdplanen i Min journal och kontorsstödet. Testnamnen (app/test/runda10-r7.test.js, klickbudgeten)
// och de poster i Sussa 3.4.1, 3.4.2, 3.4.4, 3.7.1 och 5.1.1 som byggdes i rundan. Mappningsfilerna ersätter sina
// poster med dessa sist, så att ändringen ligger samlad här.
import { klickbudgetTest, TEST } from '../krav.js';
import { FLODEN } from '../klickbudget.js';
import { T } from './tidbok-tester.js';
import { T4 } from './planering-r4.js';
import { T8 } from './bokning-r8.js';
import { testfall, testfallTest } from '../sussa-testfall.js';

const { MJ } = TEST;
const VK = 'Vårdkontakt > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
const tf = (nr) => { const x = testfall(nr); return x.korningar.map(k => testfallTest(x, k)); };

const O = 'Ombud > ';
const M = 'Meddelanden från invånare > ';
const V = 'Vårdplanen i Min journal > ';
const K = 'Kassan > ';
const C = 'Kapacitet och prognos > ';
const D = 'Kontorsstöd > ';
export const T10 = {
  ombudBoka: `${O}patienten ger fullmakt i Min journal, och ombudet bokar, bokar om och avbokar patientens tider med loggning på patienten`,
  ombudJournal: `${O}ombudet når aldrig journalen, och en återkallad eller utgången fullmakt ger ingen åtkomst`,
  ombudVard: `${O}vårdadministratören registrerar en skriftlig fullmakt, och fullmakten prövas mot ålder, dubbletter och tak`,
  ombudLogg: `${O}patientens logglista visar ombudets åtgärder som ombud, och vården ser vem som bokade`,
  ombudUppslag: `${O}en fullmakt i Min journal röjer aldrig vem ett personnummer tillhör, skyddad identitet registreras bara av personal, och försöken har ett tak`,
  ombudInnehall: `${O}meddelanden för ett ombud visar och tar aldrig emot läkemedel, vårdplaner eller vad en tråd gäller ur journalen`,
  ombudTradar: `${O}trådar som gäller en ordination eller en vårdplan finns inte för ombudet, inte heller i räknare, läsmarkering och svar`,
  skriva: `${M}patienten skriver till vårdenheten, och systemet väljer vårdenhet och yrkesroll`,
  vard: `${M}vården läser i sin egen inloggning med vårdrelation, svarar och avslutar, och allt loggas på patienten`,
  recept: `${M}läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten`,
  sakerhet: `${M}listan visar ingen text, en annan vårdenhet och fel roll når inte meddelandet, och ord som tyder på något akut ger rådet att ringa 112`,
  andra: `${M}ombudet skriver för patienten och vårdnadshavaren för barnet, och vården ser vem som skrev`,
  begaran: `${M}en begäran om spärr, om att häva en spärr och om loggutdrag handläggs av rätt roll och patienten får beskedet`,
  planSe: `${V}patienten ser mål, åtgärder och uppföljningar och kommenterar, och kommentaren går till vårdenheten som har planen`,
  planOmbud: `${V}ombudet ser inte vårdplanen, och vårdnadshavaren ser barnets`,
  avgift: `${K}avgiften för receptförnyelse och intyg räknas av systemet ur ålder, LMA-kort, frikort och intygstyp`,
  betala: `${K}betalning i den simulerade terminalen och återbetalning med kvitto samma väg, en gång`,
  avslut: `${K}kassaredovisning per kassör och betalsätt och dagsavslut som inte kan ändras, med avstämning mot terminalen`,
  kassaSakerhet: `${K}fel roll, en annan vårdenhet och en patient utan vårdrelation nekas, och redovisningen har inga patientuppgifter`,
  minBetala: `${K}patienten betalar en avgift för en tjänst i Min journal, och ett ombud ser den inte`,
  prognos: `${C}veckor med lediga tider, väntelistan och inkomna remisser ger en prognos för när kön är borta`,
  risk: `${C}patienter som riskerar att passera gränsen ger förslag på fler tider, och lokaler och utrustning visas per vecka`,
  kapSakerhet: `${C}översikten har inga patientuppgifter och är bara för vårdadministratören`,
  docx: `${D}journaltexten som Word-dokument efter samma prövning som journalen, loggad på patienten`,
  rapporter: `${D}rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter`,
  kalender: `${D}kalenderprenumerationen med hemlig länk visar tid och typ men aldrig patienten, och kan återkallas`,
  bokning: `${D}möteslänk för videobesök, uppringning vid telefontid och inbjudan som kalenderfil och e-post`,
  arkitektur: `${D}arkitekturen beskriver ordbehandling, rapporter, kalender, SharePoint, e-post, telefoni och video`,
};

const p = (id, avsedd, egna, tester, losning, expert, anmarkning) => ({ id, kategori: 'system', egna, avsedd, tester, losning, expert, anmarkning });

let cache;
const POSTER = () => Object.fromEntries([
  p('3.4.1.5', 'uppfyllt_demo', [], [T.tidbok, T.forslag, T4.ingrepp, T4.arbetslista, T4.resurser, T8.team, T8.grupp, T8.gruppVantelista, T8.patientResurs, T10.prognos, T10.risk, T10.kapSakerhet, T10.rapporter, flode('kapacitetsprognos')],
    'Tidboken visar beläggningen per vårdgivare och dag och en arbetslista per lokal, utrustning och sjukresa. Teambesök tar alla i teamet ur deras scheman, och gruppträffar har platser och väntelista. Sidan Kapacitet visar för vårdenheten tolv veckor framåt de lediga tiderna per tidstyp och yrkesroll mot väntelistan, de inkomna remisserna och inflödet, när kön är borta, hur många som riskerar att passera sin gräns och hur många fler tider som behövs, och lokaler, utrustning och sjukresor med bokade timmar per vecka. Prognosen kan tas ut som Word-dokument.',
    'Systemet räknar kapaciteten ur scheman och bokningar, lägger patienterna i tur och ordning på de lediga tiderna och säger på vanlig svenska vad som behöver göras, till exempel hur många fler återbesök som behövs i veckan för att ingen ska passera gränsen. Ingen behöver jämföra scheman med köer för hand.',
    'Prognosen är en demoregel: inflödet är snittet av de senaste åtta veckorna, en obedömd remiss räknas som ett nybesök hos läkare, och efter de veckor som har tider räknas schemats veckomönster. Sjukresan är simulerad.'),
  p('3.4.2.3', 'uppfyllt_demo', ['L5'], [T.egenbokning, T.egenRegler, T.egenIncheckning, flode('egen-ombokning'), T.egenTidstyper, T.vhMinJournal, T10.ombudBoka, T10.ombudJournal, T10.ombudVard, T10.ombudLogg, T10.ombudInnehall, T10.ombudTradar, T10.ombudUppslag, flode('ombud-boka')],
    'Patienten bokar, bokar om och avbokar i Min journal på de tidstyper som mottagningen öppnar för det, och bara där patienten redan har vårdrelation. Egenbokningen gäller bara återbesök, telefon och video, aldrig nybesök eller gruppträff (beslut 2026-11-03). Vårdnadshavare gör det för barn under 13 år, och ett ombud gör det för patienten med en fullmakt som patienten har gett i Min journal eller som vården har registrerat efter en skriftlig fullmakt. Ombudet loggar in med sin egen e-legitimation och ser bara patientens tider och meddelanden, aldrig journalen. Varje åtgärd loggas på patienten, och patienten ser ombudets åtgärder i sin logglista.',
    'Patienten och ombudet får samma förslag på lämpliga tider som vårdadministratören. Systemet stänger egenbokningen 24 timmar före tiden och säger varför, stänger den för en tid som styr när en läkemedelsdos ska ges, skapar en bevakning när någon avbokar och sätter fullmaktens omfattning och giltighet själv.',
    'Min journal är Vårdkällans egen e-tjänst, och inloggningen med e-legitimation är simulerad. Publicering av tider till 1177 Vårdguidens e-tjänster kräver anslutning till 1177 och är inte byggd. Fullmaktens regler (tolv månader, minst 18 år, högst tre ombud) är demoregler.'),
  p('3.4.4.1', 'uppfyllt_demo', ['D6'], [`${VK}vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget`, `${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`,
    flode('registrera-besok'), T.incheckning, T.betalning, flode('checka-in'), T10.betala, T10.avslut, T10.kassaSakerhet, T10.rapporter, flode('kassa-avgift'), flode('dagsavslut')],
    'Vårdkontakter registreras från patientens översikt, eller genom incheckningen på en bokad tid. Patientavgiften räknas fram för varje kontakt, och betalningen registreras med kort i den simulerade betalterminalen eller med faktura, med kvittonummer. Kassan visar dagens betalningar och återbetalningar per kassör och betalsätt, och kassören gör dagsavslut, som stäms av mot terminalens dagsrapport och sedan inte kan ändras. Redovisningen kan tas ut som Word-dokument.',
    'Systemet fyller i kontaktsätt, tid, mottagning och kontaktorsak, räknar ut avgiften och registrerar själv när patienten inte ska betala något. Dagsavslutet räknar kassan själv och fyller i terminalens belopp, så kassören bekräftar med ett klick och skriver något bara när det inte stämmer.',
    'Betalterminalen och fakturan är simulerade och märkta så: inga pengar dras och ingen faktura skickas. Avgifterna är demoregler, inte någon regions avgifter.'),
  p('3.4.4.4', 'uppfyllt_demo', [], [`${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`, T.betalning, T.incheckning, T.egenIncheckning,
    'Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren',
    'Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas',
    'Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region',
    'Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras',
    'Ekonomi: avgiften visas som e-frikortet > i vårdkontaktslistan och tidbokens betalning skiljer sig svaret med och utan dolda besök bara i beloppet och frikortsstatusen',
    'Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det',
    T10.avgift, T10.betala, T10.recept, T10.minBetala, T10.kassaSakerhet, flode('kassa-avgift'), flode('fornya-recept')],
    'Patientavgiften räknas fram ur kontakttyp och kontaktsätt, ålder, LMA-kort och högkostnadsskyddet, och hjälpmedel har en hjälpmedelsavgift. Förnyelse av recept och intyg har egna avgifter: när läkaren förnyar ett recept eller utfärdar ett intyg som patienten har bett om i Min journal skapar systemet avgiften, och i kassan väljer vårdadministratören tjänsten när patienten står där. Betalningen sker med kort i den simulerade terminalen eller med faktura, av vårdadministratören eller av patienten i Min journal, med kvitto. En betalning kan återbetalas en gång, samma väg som den betalades, med orsak och eget kvitto. Vem, när och var syns på varje betalning och återbetalning, och inget av det kan ändras i efterhand.',
    'Systemet räknar avgiften och säger varför den blir som den blir, till exempel att frikort gäller eller att intyget till Försäkringskassan är avgiftsfritt. När patienten inte ska betala registrerar systemet det självt, och vid återbetalning väljer den som återbetalar bara orsaken, så att ingen behöver kunna reglerna eller räkna.',
    'Beloppen och reglerna är demoregler, och betalterminalen är simulerad. Receptförnyelsens avgift räknas inte in i högkostnadsskyddet i demon (demoregel). Avgiften visas som e-frikortet: frikort till ett datum eller avgiften att betala, aldrig betalda belopp. Patienter från andra län betalar samma avgift, och vården faktureras hemregionen.'),
  p('3.7.1.1', 'uppfyllt_demo', ['L4', 'L5'], [
    `${MJ}inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter`, `${MJ}patienten når sin egen journal men inte någon annans, oavsett id i adressen`,
    `${MJ}anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas`, `${MJ}begäran om spärr ändrar inte spärren och registreras som begäran till vården`,
    `${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`,
    T10.skriva, T10.vard, T10.recept, T10.sakerhet, T10.andra, T10.begaran, T10.ombudBoka, T10.ombudJournal, T10.ombudLogg, T10.ombudInnehall, T10.ombudTradar, T10.ombudUppslag, flode('skicka-meddelande'), flode('svara-meddelande')],
    'Min journal, Vårdkällans egen e-tjänst för invånare: patienten läser sin journal, ser vem som har läst den, bokar tider och skriver meddelanden till vården, och vårdnadshavaren och ett ombud med fullmakt gör det för patienten. Vården läser och besvarar meddelandena på sidan Meddelanden, och patienten får ett sms om att det finns ett svar (simulerat). Kallelser går ut i Min journal, med sms eller med brev. En begäran om spärr, om att häva en spärr eller om loggutdrag handläggs av vårdadministratören eller logggranskaren, och patienten får beskedet i Min journal.',
    'Systemet skickar meddelandet till rätt vårdenhet och yrkesroll ur vad det gäller, varnar och ber invånaren ringa 112 vid ord som kan tyda på något akut, och utför patientens begäran om spärr med ett klick, eftersom patienten själv bestämmer. Min journal visar bara det vårdgivaren har valt att visa och säger varför.',
    'Inloggningen med e-legitimation och sms-aviseringen är simulerade. Kommunikation via 1177 Vårdguidens e-tjänster kräver anslutning till 1177 och redovisas i 3.7.1.2.'),
  p('3.7.1.3', 'uppfyllt_demo', ['L4', 'L5'], [
    `${MJ}spärrade uppgifter visas för patienten själv och spärren redovisas`, `${MJ}begäran om spärr ändrar inte spärren och registreras som begäran till vården`,
    `${MJ}vårdnadshavare läser barnets journal under 13 år men inte från 13 år eller för ett barn med skyddad identitet`, `${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`,
    T.egenbokning, flode('egen-ombokning'), T4.vardbegaran, T4.vardbegaranAkut, T10.planSe, T10.planOmbud, T10.skriva, T10.vard, T10.recept, T10.begaran, flode('skicka-meddelande')],
    'I Min journal deltar patienten i planeringen, genomförandet och uppföljningen: patienten bokar och bokar om tider, skickar en egen vårdbegäran, skriver meddelanden, ber om förnyade recept och intyg, lämnar egna mätningar och ser sin vårdplan med mål, åtgärder, uppföljningar och nästa uppföljningsdatum och kan kommentera den. Patienten ser spärrar och vem som har läst journalen och kan begära spärr och loggutdrag, och vårdnadshavare gör det för barn under 13 år.',
    'Systemet avgör självt vad patienten och vårdnadshavaren får se, skickar det som kommer in till rätt vårdenhet och yrkesroll och skapar avgiften och svaret när ett recept förnyas, så att det som patienten lämnar hanteras i vårdens vanliga arbete utan att någon för över det för hand.',
    'Ett meddelande blir inte en journalanteckning av sig själv. Den som besvarar skriver en anteckning när innehållet behövs i journalen.'),
  p('5.1.1.1', 'uppfyllt_demo', [], [T10.docx, T10.rapporter, T10.kalender, T10.bokning, T10.arkitektur, flode('kalenderprenumeration')],
    'Vårdkällans arkitektur mot kontorsstödet (sidan Kontorsstöd): journaltext och rapporter tas ut som Word-dokument, personalens tidbok är en kalenderprenumeration med en hemlig länk per person som går att återkalla, en enskild tid kan läggas in som inbjudan i kalendern eller som e-post, en telefontid har en länk som regionens telefoni ringer upp med, och varje videobesök får en möteslänk. SharePoint nås genom dokumenten och en beskriven integration mot Microsoft Graph. Allt går i öppna standardformat, så att det inte beror på en viss version av Office.',
    'Systemet skapar möteslänken och inbjudan av sig själv, och kalendern hämtar om sig själv varje timme, så att ingen behöver föra över tider för hand. Kalendern visar aldrig vem patienten är, och "Upptagen" för det personen inte ska se, och dokument med patientuppgifter lämnas ut efter samma prövning och logg som journalen.',
    'Microsofts tjänster simuleras: ingen e-post skickas, inga möten skapas i Teams och inget sparas i SharePoint, där integrationen är beskriven men inte byggd. Kalenderlänken gäller så länge sandlådan finns.'),
].map(x => [x.id, x]));

export const medR10r7 = (poster) => { cache ??= POSTER(); return poster.map(x => cache[x.id] ?? x); };
