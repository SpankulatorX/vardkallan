// Sussa 12.1 Applikationskonfiguration: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r4: systemförvaltningen (konfiguration.js, omorganisation.js, undantag.js och systemforvaltning-rutter.js).
import { TEST } from '../../krav.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';
// Runda 8, r1: beställning och svar.
import { T as LABB_T } from '../labb-r8.js';
// Runda 11, r6: vad som förs över, etikettskrivarna och anvisningarna (konfiguration.js).
import { R6 } from '../runda11-r6.js';

const { GK } = TEST;
const S = 'Systemförvaltning > ';

const ROLL = `${S}roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista`;
const OMORG = [
  `${S}omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet`,
  `${S}omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter`,
  `${S}omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten`,
  `${S}omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val`,
  `${S}omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut`,
  `${S}omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den`,
  `${S}omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring`,
  `${S}omorganisation: ett namnbyte kräver inte fyra ögon, loggas och kan ångras fram till datumet`,
  `${S}omorganisation: personalen som registrerar spärrar ser att patienten kan tillfrågas om spärren ska gälla den nya vårdenheten, utan att något röjs för andra, och ingen spärr sätts automatiskt`,
  `${S}omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser`,
  `${S}omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt`,
  `${S}omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring`,
  `${S}omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop`,
  `${GK}Förbereda ett namnbyte för en enhet inom budget`,
];
const KONFIG = [
  `${S}konfiguration: varje parameter har samma standardvärde som modulen som använder den`,
  `${S}konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det`,
  `${S}konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet`,
  `${S}konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen`,
  `${S}konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter`,
  `${S}konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas`,
  `${S}konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med`,
  `${GK}Ändra en demoregel inom budget`,
];
const GENOMSLAG = `${S}konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet`;
const SOKORD = `${S}konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade`;
const UNDANTAG = [
  `${S}undantag: en anteckningstyp undantas från visning med fyra ögon, och journalen säger hur många som inte visas och varför`,
  `${S}undantag: undantaget gäller aldrig Min journal`,
  `${S}undantag: undantaget ändrar inte spärrar, och en spärrad uppgift varken visas eller räknas`,
  `${S}undantag: FHIR för externa tillämpningar får inte undantagna uppgifter`,
  `${S}undantag: publiceringen till nationella tjänster (simulerad) räknar bort det undantagna`,
  `${S}undantag: systemet stoppar ett undantag som skulle dölja uppgifter i pågående vård och förklarar varför`,
  `${S}undantag: översikten visar tydligt vad som är undantaget, och ett undantag kan avslutas`,
  `${S}undantag: ett undantag som inte längre är tillåtet kan varken godkännas eller avslutas via konfigurationens väg, och varje väg prövar samma sak`,
];

const KONFIG_LOSNING = 'Sidan Regler och parametrar samlar demoreglerna och parametrarna som systemet använder, per område, med gällande värde, kommande värde och ändringar som väntar. En ändring föreslås med giltighetsdatum och motivering, godkänns av en annan systemförvaltare (fyra ögon, också som en kontroll i databasen) och läses sedan av den modul som använder parametern, så att den slår igenom i hela systemet från dagen den gäller. Historiken visar varje ändring med vem som föreslog och godkände, och beslutade ändringar kan inte ändras eller raderas.';
const KONFIG_EXPERT = 'Systemet kontrollerar att värdet är rimligt och säger varför på vanlig svenska (till exempel att en journal ska bevaras i minst tio år enligt patientdatalagen 3 kap. 17 §), visar medan man skriver vad ändringen får för effekt i dag med antal, föreslår att den gäller från i morgon och flyttar själv giltighetsdatumet om godkännandet kommer senare, så att en ändring aldrig gäller bakåt i tiden.';
const KONFIG_ANM = 'Parametrarna är demoregler. I demon finns femton parametrar: larmgränserna för mottagningskvittens och kvittens av remissvar, dosfönstret före och efter dostiden, påminnelsen innan en delegering går ut, påminnelsen före en bokad tid, antalet åtkomster i ett stickprov, åren innan gallring föreslås, förslaget att avsluta ett hälsoärende och sökorden i journalens sex mallar. Behörighetsreglerna, loggarna, NLL-kraven och reglerna för Min journal går inte att ändra som parametrar, och sidan säger varför. Den andra systemförvaltaren (Nora Ekholm) är en egen demoroll, så fyra ögon går att visa i demon. Seeden har ett förslag från henne som Tomas Lindh kan godkänna.';

const OMORG_LOSNING = 'Systemförvaltaren förbereder ett namnbyte, en ny enhet, en sammanslagning, en delning eller en nedläggning med ett datum. Förhandsvisningen visar med antal allt som påverkas: pågående vårdkontakter, bokade tider, väntelistan, remisser, vårdrelationer, listning, bevakningar, personalens behörigheter, scheman, uppdrag i läkemedelshanteringen, delegeringar, spärrar och de dokumenterade uppgifter som stannar. En sammanslagning, delning eller nedläggning ändrar vem som har åtkomst och godkänns av en annan systemförvaltare (fyra ögon). På dagen genomför systemet förändringen själv: nya enheter får nya HSA-id, de gamla stängs och arkiveras men finns kvar, pågående vårdkontakter avslutas och fortsätter på den nya enheten i samma vårdtillfälle, och det som ligger framåt flyttas. Varje flytt sparas med värdet före och efter. Det som har dokumenterats och loggats stannar på den enhet där det skedde, och efter ett namnbyte visas det med namnet enheten hade då.';
const OMORG_EXPERT = 'Systemet följer HSA:s regler för organisationsförändringar (bilaga K6) utan att systemförvaltaren behöver kunna dem: det föreslår datum, överordnad enhet och mottagare, stoppar ett namn som redan finns, ett datum bakåt i tiden, en enhet i en annan förändring och en mottagare hos en annan vårdgivare, och låter vårdrelationen följa med medan patientens spärr gäller som förut mot den gamla vårdenhetens uppgifter, också för efterföljarens personal. Det som systemet inte kan göra själv (nya uppdrag i läkemedelshanteringen, nya delegeringar och ändringen i HSA-katalogen) står i förhandsvisningen, och en förändring som ändrar åtkomsten godkänns av en andra systemförvaltare.';
const OMORG_ANM = 'Kopplingen till HSA-katalogen är inte byggd, och HSA-id för nya enheter är påhittade. Demon har ingen schemalagd körning, så en förberedd förändring genomförs vid första anropet den dag den gäller. En enhet som har stängts går inte att öppna igen i demon. Vid delning följer personal och uppgifter som hör till vårdenheten själv den första nya vårdenheten. Uppdrag i läkemedelshanteringen avslutas och delegeringar gäller inte längre, så att verksamhetschefen och den som delegerar beslutar på nytt.';

const POSTERNA = [
  {
    id: '12.1.1.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...OMORG, ROLL],
    losning: OMORG_LOSNING, expert: OMORG_EXPERT, anmarkning: OMORG_ANM,
  },
  { id: '12.1.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  {
    id: '12.1.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...KONFIG, GENOMSLAG, SOKORD, ROLL],
    losning: KONFIG_LOSNING, expert: KONFIG_EXPERT, anmarkning: KONFIG_ANM,
  },
  {
    id: '12.1.1.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: OMORG,
    losning: `${OMORG_LOSNING} Inga patientuppgifter visas för systemförvaltaren, bara antal.`,
    expert: OMORG_EXPERT,
    anmarkning: OMORG_ANM,
  },
  {
    id: '12.1.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...KONFIG, ROLL],
    losning: 'Beställaren gör själv konfigurationen på systemförvaltningens sidor: regler och parametrar, omorganisationer och undantag från visning och publicering, med en egen roll som systemförvaltare. Rollen läser inte journalen, och varje ändring loggas med vem som gjorde den.',
    expert: KONFIG_EXPERT,
    anmarkning: KONFIG_ANM,
  },
  {
    id: '12.1.1.6', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [...KONFIG, GENOMSLAG],
    losning: `${KONFIG_LOSNING} Inom administration finns påminnelsen före en bokad tid, antalet åtkomster i ett stickprov och åren innan gallring föreslås.`,
    expert: KONFIG_EXPERT,
    anmarkning: `${KONFIG_ANM} Avgifter, tidboksregler och vårdgarantin är ännu inte parametrar.`,
  },
  {
    id: '12.1.1.7', kategori: 'system', egna: ['D11'], avsedd: 'delvis',
    tester: [...KONFIG, SOKORD, GENOMSLAG],
    losning: 'Sökorden i journalens mallar ändras på ett ställe och används direkt i anteckningsformuläret. Anteckningar som redan är skrivna ändras inte. Förslaget att avsluta ett hälsoärende utan vårdkontakter är en parameter.',
    expert: 'Systemet kontrollerar sökorden (inga dubbletter, minst ett, högst trettio och korta rubriker) och visar vilka som läggs till och tas bort innan ändringen skickas för godkännande.',
    anmarkning: 'Nya mallar, nya anteckningstyper, kodverk och mätvärdestyper går inte att lägga till från gränssnittet än.',
  },
  {
    id: '12.1.1.8', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [...KONFIG, GENOMSLAG],
    losning: 'Dosfönstret före och efter dostiden och påminnelsen innan en delegering att ge läkemedel går ut är parametrar som läses av läkemedelsprocessen. Läkemedelsmallarna har sin egen förvaltning med godkännande av mallansvarig läkare (runda 6).',
    expert: 'Systemet förklarar vad ett för kort eller för långt dosfönster leder till (varningar som slutar läsas, eller för kort tid till nästa dos) och vägrar ett värde utanför ramarna.',
    anmarkning: 'Läkemedelsvarningarnas regler, maxdoser och interaktioner är inte parametrar än. Ordinationsorsak och uppföljningsdatum krävs för NLL och kan inte göras frivilliga.',
  },
  {
    id: '12.1.1.9', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    // Runda 8, r1: paketen, svarstiden och när ett prov som inte är taget visas som försenat (labb.js).
    tester: [...KONFIG, GENOMSLAG, LABB_T.konfig, R6.parametrar, R6.etikett],
    losning: 'Larmgränserna för utebliven mottagningskvittens och för remissvar som inte har kvitterats är parametrar, och sedan runda 8 också analyspaketens innehåll (paket med analyser till flera laboratorier), det simulerade laboratoriets svarstid och när ett prov som inte är taget visas som försenat. Ändringen slår igenom i förslagen, beställningarna, inkorgen och provtagningslistan.',
    expert: 'Systemet prövar varje analys i ett paket mot katalogen och förklarar ett namn som inte finns, och förhandsvisningen visar vad ändringen betyder i dag.',
    anmarkning: 'Sedan runda 11 är också vad som förs över till laboratoriets eller röntgenklinikens system (kommentar, underlag, vårdförlopp och prioritet, diagnoser), vilka arbetsplatser som har etikettskrivare och anvisningarna inför prover och undersökningar parametrar. Patientens identitet, beställnings-id, analyserna och frågeställningen förs alltid över, eftersom laboratoriet inte kan ta emot en beställning utan dem.',
  },
  {
    id: '12.1.1.10', kategori: 'system', egna: ['D8'], avsedd: 'delvis',
    tester: [...UNDANTAG, ROLL],
    losning: 'Systemförvaltaren undantar en anteckningstyp, ett mätvärde eller en vårdenhet från visning i systemet, från FHIR för externa tillämpningar eller från publicering till nationella tjänster, med fyra ögon och giltighetsdatum. Sidan Undantag från visning visar vad som är undantaget, från vad, sedan när, av vem och varför, och personalen ser i journalen hur många uppgifter som inte visas och motiveringen. Ett undantag gäller aldrig Min journal och ändrar inga spärrar.',
    expert: 'Systemet stoppar ett undantag från visning för en vårdenhet med pågående vårdkontakter och förklarar varför, tillåter aldrig att läkemedel, överkänslighet, uppmärksamhetsinformation eller diagnoser undantas och prövar undantaget först efter behörighetsmotorn, så att en spärrad uppgift varken visas eller räknas.',
    anmarkning: 'Publiceringen till nationella tjänster är simulerad: sidan visar vad som skulle publiceras och vad som är undantaget, och en producent av ett tjänstekontrakt prövar varje rad med samma funktion. Undantag på enskilda uppgifter (en viss anteckning) finns inte, bara på typ och vårdenhet.',
  },
];
export default medR8r5(POSTERNA);
