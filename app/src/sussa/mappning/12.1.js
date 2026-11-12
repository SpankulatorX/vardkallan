// Sussa 12.1 Applikationskonfiguration: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r4: systemförvaltningen (konfiguration.js, omorganisation.js, undantag.js och systemforvaltning-rutter.js).
// Runda 13, r4 (sussa/runda13-r4.js).
import { medR13r4 } from '../runda13-r4.js';
import { TEST } from '../../krav.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';
// Runda 8, r1: beställning och svar.
import { T as LABB_T } from '../labb-r8.js';
// Runda 11, r6: vad som förs över, etikettskrivarna och anvisningarna (konfiguration.js).
import { R6 } from '../runda11-r6.js';
// Runda 12, r1: konfiguration utan programmerare (journalstruktur.js och konfiguration.js).
import { TESTER_STRUKTUR, TESTER_RAMAR, TESTER_LAKEMEDELSMALLAR, TESTER_LAKEMEDELSREGLER, TESTER_ADMINISTRATION, TESTER_UNDANTAG_ENSKILD } from '../runda12-r1.js';
import { T as KV } from '../runda9-r4.js';

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
    // Runda 12, r1: avgifterna, tidbokens regler och vårdgarantin som parametrar (konfiguration.js, tidbok.js och vardkontakt.js).
    id: '12.1.1.6', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...KONFIG, GENOMSLAG, ...TESTER_ADMINISTRATION],
    losning: `${KONFIG_LOSNING} Inom administration finns patientavgifterna för besök, akutbesök och vårddygn, högkostnadsskyddet och åldersgränserna för avgiftsfrihet, vårdgarantin för ett nybesök efter remiss, när en patient på väntelistan lyfts fram, hur sent patienten själv kan boka om och avboka, när incheckningen öppnar och stänger, påminnelsen före en bokad tid, antalet åtkomster i ett stickprov och åren innan gallring föreslås. Avgiften, högkostnadsskyddet, väntelistan, planeringen, kapacitetsprognosen, Min journal och incheckningen läser det godkända värdet.`,
    expert: KONFIG_EXPERT,
    anmarkning: `${KONFIG_ANM} Sedan runda 12 är också avgifterna, högkostnadsskyddet, tidbokens regler och vårdgarantin parametrar. Avgifterna och gränserna är demoregler och inte någon regions avgifter. Vårdgarantin kan inte sättas längre än de 90 dagar som hälso- och sjukvårdslagen ger, och avgiftsfriheten från 85 år kan inte flyttas uppåt, och systemet säger varför. Det som inte går att ändra står på sidan med skälet: behörigheten, loggarna, ordinationsorsaken vid förskrivning och reglerna för Min journal.`,
  },
  {
    // Runda 12, r1: mallar, anteckningstyper, sökord, mätvärdestyper och kodverk från gränssnittet (journalstruktur.js).
    id: '12.1.1.7', kategori: 'system', egna: ['D11'], avsedd: 'uppfyllt_demo',
    tester: [...KONFIG, SOKORD, GENOMSLAG, ...TESTER_STRUKTUR, ...TESTER_RAMAR, KV.kvLokalt, KV.kvFyraOgon, KV.kvJamfor],
    losning: 'Sidan Mallar och mätvärdestyper samlar journalens struktur på ett ställe. Systemförvaltaren skapar en ny mall, som också är en ny anteckningstyp, med sökord och kategori (läkarnas dokumentation eller omvårdnad), lägger till nya sökord med kod i Snomed CT, skapar nya mätvärdestyper med kod i NPU eller LOINC, enhet i UCUM och rimliga värden, och sätter vårdgivarens ram för en mall och en vårdenhets lokala anpassning. Varje ändring är en ny version som en annan systemförvaltare godkänner i sin egen inloggning, och den gäller i hela systemet direkt efter godkännandet: mallen blir valbar i anteckningsformuläret, mätvärdestypen när ett värde registreras, och FHIR lämnar ut anteckningstypen, sökorden och mätvärdena med sina koder. Lokala kodverk skapas och får nya utgåvor under Kodverk och masterdata på samma sätt, och sökorden i de inbyggda mallarna ändras under Regler och parametrar.',
    expert: 'Systemet sätter själv koden för ett sökord som redan finns i delmängden, kontrollerar kontrollsiffran i Snomed CT och LOINC, formen på NPU och enheten mot UCUM, stoppar en kod som redan används och säger vilket sökord eller vilken mätvärdestyp som har den, räknar fram mätvärdestypens id, kategori och hur enheten visas, och visar medan man skriver vad som påverkas: var mallen blir valbar, hur många anteckningar som redan är skrivna och står kvar som de skrevs, och vilka vårdenheters anpassningar som slutar gälla. Ett godkännande prövas igen mot det som gäller då.',
    anmarkning: 'Det som inte går att ändra står på sidan med skälet: skrivna anteckningar och registrerade värden, koden och enheten för en mätvärdestyp som har värden (en ny kod blir en ny mätvärdestyp), namnet och kategorin för journalens inbyggda mallar, och sökorden i de strukturerade mallarna för tobak, levnadsvanor och donation, som systemet skriver ur svaren. Kontrollen av UCUM är en demoregel som omfattar de vanliga enheterna i vården, och de engelska termerna för nya koder kontrolleras inte mot en terminologitjänst i demon.',
  },
  {
    // Runda 12, r1: läkemedelsvarningarnas regler, maxdoserna och ordinationsorsaken som parametrar (konfiguration.js och lakemedel.js).
    id: '12.1.1.8', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...KONFIG, GENOMSLAG, ...TESTER_LAKEMEDELSREGLER, ...TESTER_LAKEMEDELSMALLAR],
    losning: 'Under Regler och parametrar, området Läkemedel, ändrar systemförvaltaren med fyra ögon och giltighetsdatum: interaktionerna som ger en allvarlig varning (par av ATC-koder eller ATC-grupper), högsta dygnsdos per substans, gränserna för metformin vid nedsatt njurfunktion, dosfönstret före och efter dostiden, påminnelsen innan en delegering går ut, kollegakontrollen av högriskläkemedel och om ordinationsorsak och uppföljningsdatum är frivilliga för ordinationer som inte förs över till Nationella läkemedelslistan. Ordinationen och läkemedelsgenomgången läser det godkända värdet, så ändringen slår igenom i hela systemet från dagen den gäller, och historiken visar varje version. Läkemedelsmallarna byggs och ändras av läkaren under Direktiv och uppföljning och godkänns av den mallansvariga läkaren.',
    expert: 'Systemet prövar varje ATC-kod mot registret och förklarar en kod som inte finns, räknar dygnsdosen ur dosen och tiderna eller ur högsta antal per dygn i doseringen, visar medan man skriver vilka interaktioner och maxdoser som läggs till och tas bort, och säger i ordinationen om ordinationsorsaken är frivillig och varför den annars krävs. En tom frivillig ordinationsorsak får systemets text och uppföljningsdatumet sätts 30 dagar efter start.',
    anmarkning: 'Reglerna är demoregler och inte kliniskt beslutsstöd. Ordinationsorsak och uppföljningsdatum krävs alltid när ordinationen förs över till Nationella läkemedelslistan, eftersom listan inte tar emot den utan dem, och sidan säger det. I demon förs alla läkemedel över till listan utom blodprodukter, nutrition och egendefinierade läkemedel. Dubbelordination av samma substans och samma grupp, två antikoagulantia samtidigt och överkänslighet är fasta regler, eftersom de följer av patientens egna uppgifter.',
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
    // Runda 12, r1: undantag för en enskild anteckning, med samma prövning för visning, FHIR, publiceringen och producenten.
    id: '12.1.1.10', kategori: 'system', egna: ['D8'], avsedd: 'uppfyllt_demo',
    // Runda 13, r3: begäran från vården och säkerhetsfynd 5 och 6 (undantag-begaran.test.js).
    tester: [...UNDANTAG, ROLL, ...TESTER_UNDANTAG_ENSKILD, ...[
      'journalen visar anteckningens nummer, och den som skrev anteckningen begär undantag med kanal och skäl',
      'bara den som skrev anteckningen eller en läkare på dess vårdenhet kan begära undantag',
      'systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men inte innehållet, och godkänner med en andra systemförvaltare',
      'systemförvaltaren kan avslå en begäran med en kommentar, och den som begärde ser det',
      'förhandsvisningen av ett nummer utan begäran ger samma svar för en befintlig, en spärrad, en skyddad och en obefintlig anteckning',
      'en undantagen anteckning syns inte i händelsekedjan, och direkt öppning ger samma svar som en anteckning som inte finns',
    ].map(t => `Begäran om undantag av en anteckning > ${t}`)],
    losning: 'Systemförvaltaren undantar en anteckningstyp, ett mätvärde, en vårdenhet eller en enskild anteckning från visning i systemet, från FHIR för externa tillämpningar eller från publicering till nationella tjänster, med fyra ögon och giltighetsdatum. En enskild anteckning undantas efter en begäran från den som skrev den eller patientens ansvariga läkare, gjord i anteckningens meny med kanal och skäl, och undantaget gäller alla dess versioner. Systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men aldrig innehållet, och fyller i förslaget med ett klick. Sidan Undantag från visning visar vad som är undantaget, från vad, sedan när, av vem och varför, och personalen ser i journalen hur många uppgifter som inte visas och motiveringen. Ett undantag gäller aldrig Min journal och ändrar inga spärrar.',
    expert: 'Systemet stoppar ett undantag från visning för en vårdenhet med pågående vårdkontakter eller en anteckning i en pågående vårdkontakt och förklarar varför, tillåter aldrig att läkemedel, överkänslighet, uppmärksamhetsinformation eller diagnoser undantas och prövar undantaget efter behörighetsmotorn, så att en spärrad uppgift varken visas eller räknas. För en enskild anteckning ser systemförvaltaren bara typ, vårdenhet och datum, journalen säger bara att en anteckning inte visas, och journalen, sökningen, FHIR, publiceringen och producenten för tjänstekontrakt prövar samma funktion.',
    anmarkning: 'Publiceringen till nationella tjänster är simulerad: sidan visar vad som skulle publiceras och vad som är undantaget, och den simulerade producenten för tjänstekontrakt prövar både undantagen från FHIR och från nationella tjänster. Enskilda mätvärden undantas genom sin typ, inte ett och ett.',
  },
];
// Runda 13, r4: den samlade listan att godkänna (sussa/runda13-r4.js).
export default medR13r4(medR8r5(POSTERNA));
