// Sussa 3.5.2 Process för läkemedelshantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 6, r2.
import { medR2 } from '../lakemedel-r2.js';
// Runda 6, r6: godkännande av läkemedelsmallar, vem som fastställer direktiv och vem som beslutar efter en avbokning.
import { medR6 } from '../lakemedelsansvar-r6.js';
// Runda 8, r4: produktmallar, tillsatser, administrationssätt och dosändring.
import { medR8r4 } from '../lakemedel-r8.js';
import { TEST } from '../../krav.js';
// Runda 9, r1.
import { medR9r1 } from '../lakemedel-r9.js';
// Runda 5, r1: vårdhändelsen i tidboken (app/test/vardhandelse.test.js).
import { T as TB } from '../tidbok-tester.js';
// Runda 9, r2: medicinteknisk utrustning.
import { T as MT9 } from '../medicinteknik-r9.js';

const { B, A, M, S, KV, GK, LK } = TEST;
// Läkemedelsprocessen: administrering, vidimering, utsättning, fördefinierade ordinationer, läkemedelsgenomgång och
// vätskebalans (app/test/administrering.test.js).
const AD = 'Administrering > ';
const AA = 'Administrering via API > ';
const VI = 'Vidimering > ';
const UT = 'Utsättning > ';
const FO = 'Fördefinierade ordinationer > ';
const VB = 'Vätskebalans > ';
// Vem som får ge läkemedel och säkrare utsättning och dos (runda 5, app/test/delegering.test.js).
const LG = 'Läkare ger läkemedel > ';
const DE = 'Delegering > ';
const DA = 'Delegering via API > ';
const DO = 'Dos som avviker från ordinationen > ';
const PL = 'Utsättning av antikoagulantia > ';
const SG = 'Säkerhetsgranskning av delegering och dos > ';
// Runda 5, r4: läkaren delegerar, vårdhändelsen sätts upp igen vid avbokning och återinsättningen bevakas
// (app/test/delegering.test.js, vardhandelse.test.js och aterinsattning.test.js).
const DL = 'Delegering av läkare > ';
const VH = 'Vårdhändelse i tidboken > ';
const AT = 'Återinsättning efter uppehåll > ';
const ATA = 'Återinsättning i inkorgen via API > ';
const VH_IGEN = [
  `${VH}när tiden avbokas sätter systemet upp vårdhändelsen på den ordinerande vårdenhetens väntelista igen, utan ny vårdrelation`,
  `${VH}när ordinationen är utsatt eller tiden är satt för hand sätter avbokningen inte upp vårdhändelsen igen`,
  `${VH}när en remiss avvisas och tiden avbokas sätts vårdhändelsen inte upp igen, dosen säger varför och den ordinerande läkaren får en rad i inkorgen`,
  `${VH}raden om den avbokade vårdhändelsen försvinner när ordinationen sätts ut, och visar inte spärrade uppgifter`,
];
const AV = 'Avslutad behandling efter uppehåll > ';
// Avvisad remiss med vårdhändelse: beslutet fattas i samma ögonblick (runda 5, r4, app/test/remissavvisning.test.js).
const RA = 'Avvisad remiss med vårdhändelse > ';
const RA_TESTER = [
  `${RA}avvisningen som tar bort den sista vårdrelationen kräver ett beslut innan den sparas, och inget sparas utan det`,
  `${RA}Sätt ut: ordinationen sätts ut med orsaken som systemet föreslår, remissen avvisas och ingen rad hamnar i inkorgen`,
  `${RA}Behåll finns bara när den ordinerande läkaren eller en annan vårdenhet har grund, och sätter då upp vårdhändelsen igen`,
  `${RA}säkerhet: ett läkemedel som den som avvisar inte får se sätts inte ut, och vårdenhetens läkare får besked utan patientuppgifter`,
  `${RA}säkerhet: bara vårdenhetens läkare som remissen är ställd till kan förhandsvisa och avvisa, och nekade försök loggas`,
];

const AVSNITT = [
  {
    id: '3.5.2.1', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`,
      `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`,
      `${VI}vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick`,
    ],
    losning: 'En gemensam läkemedelsfunktion där ordination, utsättning, iordningsställande, administrering och överlämnande, vidimering och läkemedelsgenomgång görs på samma läkemedelslista och knyts till vårdkontakten.',
    expert: 'Systemet räknar fram dagens doser ur ordinationerna och knyter varje steg till vårdtillfället, så att processen hänger ihop utan att någon behöver föra över något mellan stegen.',
    anmarkning: 'Spädning och tillsatser, slutenvårdsdos och automatiska doser från medicinteknisk utrustning saknas.',
  },
  {
    id: '3.5.2.2', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${AD}registrering i efterhand med tidpunkt och den som utförde det`,
      `${AD}vid behov: varnar när högsta dygnsdosen är nådd och när doserna kommer för tätt`,
    ],
    losning: 'Administrering, överlämnande och dos som inte gavs kan registreras i efterhand, upp till sju dagar bakåt, med när dosen gavs, vem som gav den och när och av vem den registrerades. Vätskebalansen kan också registreras i efterhand.',
    expert: 'Systemet förväljer dostiden, kontrollerar den registrerade tiden mot ordinationen och tidigare doser och visar själv att registreringen gjordes i efterhand.',
    anmarkning: 'Iordningsställande, vidimering och läkemedelsgenomgång registreras med aktuell tid. En felaktig registrering kan inte makuleras i demon.',
  },
  {
    id: '3.5.2.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${VB}vätskebalansen räknar in administrerad volym av sig själv`],
    losning: 'Vätskebalans med intag och förluster per dygn, där volymen av läkemedel som ges intravenöst eller i en infusion räknas in när dosen ges.',
    expert: 'Systemet räknar fram volymen ur ordinationen eller ur dosen och koncentrationen, så ingen behöver föra in läkemedlets volym för hand.',
    anmarkning: 'Vätskebalansen omfattar administrering, inte iordningsställande och beredning. Förväntad vätskebalans framåt i tiden saknas.',
  },
  {
    id: '3.5.2.4', kategori: 'system', egna: ['L7', 'D9'], avsedd: 'delvis',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${KV}ingen ordination i seeden börjar före produktens godkännande i NPL`,
    ],
    losning: 'Godkända läkemedel ur en katalog med 50 produkter, kontrollerade mot Läkemedelsverkets NPL.',
    expert: 'Systemet låter förskrivaren välja produkt ur katalogen med rätt namn, styrka och form, så ingen behöver skriva in läkemedlet.',
    anmarkning: 'Icke godkända läkemedel (extempore och licens), egendefinierade läkemedel, blodprodukter och nutrition saknas.',
  },
  {
    id: '3.5.2.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${AD}permission: doser under permission lämnas över till patienten`,
      `${AD}iordningsställande med kontrollkod och sedan administrering av samma dos`,
    ],
    losning: 'När vårdtillfället har permission märks doserna under permissionen, och de iordningsställs och lämnas över till patienten i stället för att ges. Överlämnandet registreras med vem och när.',
    expert: 'Systemet läser permissionen ur vårdtillfället och föreslår själv Lämna över för doserna under permissionen, utan varning för för tidig dos.',
    anmarkning: 'Om patienten tog doserna under permissionen registreras som en vanlig dos i efterhand.',
  },
  {
    id: '3.5.2.6', kategori: 'system', egna: ['L7'], avsedd: 'uppfyllt_demo',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}databasen vägrar ordination utan orsak (CHECK)`,
      `${S}alla ordinationer har orsak och uppföljningsdatum`,
      `${GK}Ordinera ett läkemedel utan varning inom budget`,
    ],
    losning: 'Ordinationsorsak är obligatorisk vid ordination och kan inte saknas ens i databasen.',
    expert: 'Systemet säger på vanlig svenska vad som saknas innan ordinationen kan sparas och föreslår uppföljningsdatum, så förskrivaren inte behöver kunna NLL:s krav.',
    anmarkning: 'Orsaken är fritext. Strukturerad ordinationsorsak med kod saknas.',
  },
  {
    id: '3.5.2.7', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [`${FO}ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts`, TB.vhForslag, TB.vhBokning, TB.vhOmboka, TB.vhVantelista, TB.vhManuell, TB.vhSakerhet, TB.vhSparr, ...VH_IGEN, ...RA_TESTER, `${GK}Avvisa en remiss och sätta ut läkemedlet inom budget`],
    losning: 'En ordination kan knytas till en planerad vårdhändelse, till exempel två timmar före en elkonvertering. Vårdhändelsen är en bokning i tidboken på den egna vårdenheten, eller en post på väntelistan som vårdadministratören bokar. Dosen väntar i administreringslistan tills vårdhändelsen har fått en tid, och tiden följer bokningen när den bokas, bokas om eller avbokas. Avbokas tiden sätts vårdhändelsen upp på den ordinerande vårdenhetens väntelista igen.',
    expert: 'Systemet föreslår patientens bokningar med den som passar ordinationen först, eller sätter upp vårdhändelsen på väntelistan, så läkaren väljer med ett klick. När tiden ändras i tidboken räknar systemet om dosen utan att någon gör något, sätter vid en avbokning själv upp vårdhändelsen på väntelistan igen och förklarar för sjuksköterskan varför dosen flyttades eller väntar.',
    anmarkning: 'Tidboken har bara personal som resurs, så en vårdhändelse bokas som ett återbesök hos läkare. Operationsplanering och bokning av lokal och utrustning saknas. En vårdenhet utan tidbok i demon tidsätter vårdhändelsen för hand.',
  },
  {
    id: '3.5.2.8', kategori: 'system', egna: ['D10', 'L11'], avsedd: 'uppfyllt_demo',
    tester: [
      `${UT}utsättning av betablockerare ger varning och kräver bekräftelse`,
      `${UT}utsättning utan särskilda observationer ger ingen varning, och antikoagulantia kräver en plan`,
      `${UT}utsättningsreglerna ligger i en egen modul och är märkta som demoregler`,
      `${GK}Sätta ut ett läkemedel med varning inom budget`,
      // Antikoagulantia sätts bara ut med en plan (runda 5).
      `${PL}utsättning av Waran kräver en plan, som sparas med utsättningen och syns i listan och i FHIR`,
      `${PL}vid byte föreslår systemet det nya antikoagulantia som redan är ordinerat`,
      `${PL}plan via API, och läkemedel utan antikoagulantia sätts ut utan plan`,
      `${GK}Sätta ut Waran med plan inom budget`,
      // Datumet för återinsättning bevakas i läkarens inkorg (runda 5, r4).
      `${AT}dagen före och på dagen får läkaren en rad i inkorgen med läkemedlet, planen och en knapp till läkemedelslistan`,
      `${AT}raden går till den ordinerande läkaren, den som beslutade om uppehållet och vårdenhetens läkare, aldrig till andra roller`,
      `${AT}raden försvinner när läkemedlet är insatt igen eller ordinationen ändras, men inte av en bryggbehandling`,
      `${AT}säkerhet: bara patienter som användaren får se, och aldrig uppgifter från en spärrad vårdenhet`,
      `${ATA}API: inkorgen visar raden med skyddad identitet maskerad, loggar åtkomsten och leder till läkemedelslistan`,
      `${GK}Sätta in Waran igen efter ett uppehåll inom budget`,
      `${AV}läkaren avslutar behandlingen med en orsak som systemet föreslår, sparat i historiken och i FHIR, och raden försvinner för alla mottagare`,
      `${AV}säkerhet: bara en läkare som är mottagare och får se patienten, aldrig från en spärrad vårdenhet, och nekade försök loggas`,
      `${GK}Avsluta behandlingen efter ett uppehåll inom budget`,
    ],
    losning: 'Vid utsättning varnar systemet för läkemedel med särskilda observationer: betablockerare, antikoagulantia, trombocythämmare efter PCI, kortison, basinsulin, antiepileptika, antidepressiva, opioider och sömnmedel. Antikoagulantia (ATC B01AA, B01AB, B01AE och B01AF) sätts bara ut med en bekräftad plan: byte till annat medel, uppehåll inför ingrepp med datum för återinsättning, eller avslutad behandling. Planen sparas med utsättningen och syns i läkemedelslistan, i historiken och i FHIR. Datumet för återinsättning bevakas: från dagen före får den ordinerande läkaren, den som beslutade om uppehållet och läkarna på de vårdenheterna en rad i inkorgen, och knappen Sätt in igen öppnar läkemedelslistan med ordinationen ifylld. Raden står kvar tills läkemedlet är insatt igen eller läkaren avslutar behandlingen med Avslutad behandling och en orsak, som sparas i historiken och i FHIR. Reglerna ligger i en egen modul och är märkta som demoregler.',
    expert: 'Systemet räknar ut hur länge patienten har haft substansen, också över dosändringar, visar varningen med ett förslag på nedtrappning innan något sparas och låter orsaken vara motiveringen. För antikoagulantia förklarar systemet risken för blodpropp och stroke, föreslår planerna med det nya medlet och datumet för återinsättning ifyllda och skriver orsaken ur planen, och påminner läkaren i inkorgen dagen före återinsättningen med ordinationen ifylld ur den tidigare.',
    anmarkning: 'Reglerna är demoregler, inte granskade av farmaceut eller läkare. Inget nedtrappningsschema skapas av systemet. Systemet skapar ingen ordination själv på datumet för återinsättning: läkaren sparar den ifyllda ordinationen eller avslutar behandlingen med en orsak. Planen kan inte ändras i efterhand.',
  },
  {
    id: '3.5.2.9', kategori: 'system', egna: ['L7', 'D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${VI}vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick`,
      `${VI}vidimering kräver läkare med vårdrelation och omfattar inte spärrade ordinationer, inte ens med samtycke`,
      `${AA}FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen`,
      `${GK}Vidimera pågående ordinationer inom budget`,
    ],
    losning: 'Läkaren vidimerar patientens samlade pågående ordinationer med ett klick. Systemet visar nya och utsatta ordinationer sedan den senaste vidimeringen med vem och när. Vidimeringen sparas som en ögonblicksbild, i FHIR som List.',
    expert: 'Systemet jämför själv listan med den senaste vidimeringen och visar bara det som har ändrats.',
    anmarkning: 'Ordinationer från enheter som patienten har spärrat ingår inte i vidimeringen.',
  },
  {
    id: '3.5.2.10', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}utsättning kräver orsak och inget raderas`,
      `${A}helflöde: ordination med varning, kvittens och NLL som inte svarar i tid, med avstämning`,
      `${GK}Sätta ut ett läkemedel inom budget`,
      `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`,
      `${AD}administreringar raderas inte och en given dos ändras inte (trigger)`,
      `${GK}Ge en dos inom budget`,
    ],
    losning: 'Ordination, varning, kvittens, överföring till NLL, iordningsställande, administrering, vidimering och utsättning, med historik där utsatta ordinationer och givna doser finns kvar med vem, var och när.',
    expert: 'Systemet raderar aldrig en ordination eller en dos utan sparar varje steg med orsak, tid och vårdkontakt, så historiken finns kvar utan att någon behöver spara den.',
    anmarkning: 'Utvärdering av behandlingen är fritext i journalen. Urval och filtrering av historiken är begränsade.',
  },
  { id: '3.5.2.11', kategori: 'nationell', egna: ['L7'], tester: [], avsedd: 'planerat',
    anmarkning: 'Förskrivning enligt NEF med justering och makulering av e-recept är inte byggd. Överföringen till NLL är simulerad.' },
  {
    id: '3.5.2.12', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}uppföljningsdatum är obligatoriskt`,
      `${M}sjuksköterska kan inte ordinera`,
      `${GK}Ordinera ett läkemedel utan varning inom budget`,
      `${FO}fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient`,
      `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`,
    ],
    losning: 'Ordination av stående läkemedel, vid behov och tillfälliga, med dos, administrationssätt, tider, orsak, uppföljningsdatum och start och slut, och med förslag ur fördefinierade mallar. I slutenvården blir ordinationerna dagens administreringslista.',
    expert: 'Systemet föreslår dos, administrationssätt, tider och uppföljning ur produkten och patientens ålder och njurfunktion och kontrollerar ordinationen mot journalen, så förskrivaren fyller bara i det som inte går att räkna ut.',
    anmarkning: 'Mallar med flera ordinationer, upp- och nedtrappningsschema, spädning och muntlig ordination saknas. Förslagen är demoregler.',
  },
  {
    id: '3.5.2.13', kategori: 'system', egna: ['L7'], avsedd: 'uppfyllt_demo',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}databasen vägrar ordination utan orsak (CHECK)`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${GK}Sätta ut ett läkemedel inom budget`,
    ],
    losning: 'Insättningsorsak och utsättningsorsak är obligatoriska och sparas med ordinationen.',
    expert: 'Systemet kräver orsaken i samma steg som åtgärden och förklarar varför, så ingen behöver komma ihåg att dokumentera den efteråt.',
    anmarkning: 'Orsakerna är fritext utan kodverk.',
  },
  {
    id: '3.5.2.14', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${FO}ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts`, TB.vhBokning, TB.vhOmboka, TB.vhVantelista, TB.vhManuell, TB.vhMinJournal, ...VH_IGEN],
    losning: 'Ordination till en planerad vårdhändelse som inte är tidsatt, med tid före eller efter händelsen. Vårdhändelsen får sin tid från tidboken, och administrationstiden räknas om när tiden bokas, bokas om eller avbokas. Den manuella tidsättningen finns kvar som reserv. Vårdadministratören ser att tiden styr en läkemedelsdos, men aldrig läkemedlet, och patienten kan inte själv boka om en sådan tid.',
    expert: 'Systemet räknar fram när läkemedlet ska ges när vårdhändelsen får sin tid, visar det i Läkemedel att ge och skriver varje ändring i ordinationens historik. Vid avbokning går dosen tillbaka till att vänta, med en förklaring på vanlig svenska, och systemet sätter upp vårdhändelsen på den ordinerande vårdenhetens väntelista igen.',
    anmarkning: 'Fördefinierade mallar för en vårdhändelse med flera ordinationer saknas.',
  },
  { id: '3.5.2.15', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ordination enligt generella direktiv är inte byggd.' },
  { id: '3.5.2.16', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Beställning av slutenvårdsdos kräver en extern dosleverantör och är inte byggd.' },
  {
    id: '3.5.2.17', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      `${AD}iordningsställande med kontrollkod och sedan administrering av samma dos`,
      `${AD}varning: för tidig dos`,
    ],
    losning: 'En dos iordningsställs med ett klick och får en kontrollkod för etiketten, som binder dosen till patienten och ordinationen. När dosen ges kontrollerar systemet koden mot patienten.',
    expert: 'Systemet kontrollerar dosen redan när den iordningsställs och stoppar en etikett som hör till en annan patient eller ett annat läkemedel.',
    anmarkning: 'Etikettutskrift, streckkodsläsare, beredning med spädning och tillsatser och flytande och gasformiga doser är inte byggda. Kontrollkoden är förberedd för patientnära skanning.',
  },
  {
    id: '3.5.2.18', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`,
      `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`,
      `${AD}varning: dubbel dos`,
      `${AD}varning: för tidig dos`,
      `${AD}varning: given dos utan ordination`,
      `${AD}vid behov: varnar när högsta dygnsdosen är nådd och när doserna kommer för tätt`,
      `${AD}registrering i efterhand med tidpunkt och den som utförde det`,
      `${AD}permission: doser under permission lämnas över till patienten`,
      `${AD}nekas: nödåtkomst och aktivt val ger inte rätt att ge läkemedel`,
      `${AD}per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda`,
      `${AA}Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet`,
      `${GK}Ge en dos inom budget`,
      // Vem som får ge läkemedel och dos som avviker från ordinationen (runda 5).
      `${LG}läkare får ge en dos med samma kontroller och loggning som sjuksköterskan`,
      `${DE}undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR`,
      `${DE}undersköterska: en dos som delegeringen inte omfattar nekas och förklaras, och knappen visas inte`,
      `${DE}sjuksköterskan registrerar en dos som undersköterskan gav: delegeringen prövas för den som gav dosen`,
      `${DE}undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras`,
      `${DE}undersköterska: delegeringen gäller bara den vårdenhet den är utfärdad för`,
      `${DE}undersköterska: spärr och skyddad identitet gäller som för sjuksköterskan, också med delegering`,
      `${DE}registrera delegering: sjuksköterska på samma vårdenhet, tidsbegränsad till högst ett år, med kontroll av kunskaperna`,
      `${DE}registrera delegering: fel roll och fel vårdenhet nekas och loggas`,
      `${DE}återkallad delegering ger ingen rätt, och återkallas bara en gång med orsak`,
      `${DE}påminnelse i inkorgen när en delegering går ut inom 30 dagar, bara på samma vårdenhet och borta efter förnyelse`,
      `${DA}API: sjuksköterskan registrerar en delegering och ser påminnelsen i inkorgen, undersköterskan ger med den`,
      `${DA}API: undersköterska utan giltig delegering har inte behörigheten att ge läkemedel i sessionen`,
      `${DO}en annan dos än ordinationens varnar och måste kvitteras med motivering, allvarlig vid mer än dubbelt eller mindre än hälften`,
      `${DO}en dos inom ordinationens intervall ("1 till 2 tabletter") varnar inte`,
      // Rättningar efter säkerhetsgranskningen av runda 5.
      `${SG}en delegering kan inte registreras flera år fram: från högst 30 dagar fram och till högst ett år efter beslutsdagen`,
      `${SG}påminnelsen räknas från beslutet som gäller i dag, och ett senare beslut tystar den bara om det tar vid utan glapp`,
      `${SG}avvikande dos räknas som dos gånger antal, så antal kringgår inte varningen`,
      `${SG}administrationssättet ska passa läkemedelsformen, och delegeringens kategori bestäms av formen`,
      `${SG}en delegering ska gälla både när en dos iordningsställs och för dostiden`,
      `${GK}Ge en dos med delegering inom budget`,
      `${GK}Registrera en delegering inom budget`,
      // Läkaren delegerar på samma villkor som sjuksköterskan (runda 5, r4, 9 kap. 2 §).
      `${DL}läkaren registrerar och återkallar delegering på samma villkor som sjuksköterskan: samma vårdenhet, inte för sig själv och samma gränser för giltighet`,
      `${DL}läkaren påminns bara om de delegeringar som läkaren själv har utfärdat, sjuksköterskan som förut`,
      `${DA}API: läkaren registrerar en delegering under Delegeringar, och undersköterskan ger med den`,
    ],
    losning: 'Dagens administreringslista per avdelning och patient räknas fram ur ordinationerna. Sjuksköterskan och läkaren ger, lämnar över eller registrerar att en dos inte gavs med ett klick, också i efterhand, med samma kontroller och loggning. En undersköterska ger läkemedel bara med en giltig delegering enligt HSLF-FS 2017:37 9 kap., som en sjuksköterska eller läkare på samma vårdenhet registrerar med omfattning, giltighet på högst ett år, uppföljning och vem som utfärdade den. Delegeringen sparas med dosen och syns i dosens historik och i FHIR. En dos som avviker från ordinationen ger en varning som kvitteras med motivering. Senast given dos, dygnsdos för vid behov och doser under permission visas. Administreringarna finns i läskopian vid avbrott och i FHIR som MedicationAdministration.',
    expert: 'Systemet kontrollerar varje dos mot ordinationen och tidigare doser och förklarar på vanlig svenska när det varnar för dubbel dos, för tidig dos, dos utan ordination, högsta dygnsdos eller en annan dos än ordinationens, och sätter själv tid, vem som gav dosen och vårdkontakten. För undersköterskan prövar systemet att delegeringen gäller just dosens läkemedelsform, administrationssätt, datum och vårdenhet, visar knappen Ge bara för de doserna, föreslår nästa delegering och påminner sjuksköterskan, och läkaren om läkarens egna beslut, i inkorgen 30 dagar innan den går ut.',
    anmarkning: 'Varningarna är demoregler. Patientnära skanning är förberedd med kontrollkoden men ingen streckkodsläsare är ansluten. Tiderna i en ordination ändras genom en ny ordination, inte i administreringslistan. Vilka läkemedelsformer som kan delegeras och gränsen på ett år är demoregler, inte en vårdgivares rutin efter riskanalys (9 kap. 8 och 9 §§). Bara undersköterskor kan få delegering i demon. Delegeringen registreras av en sjuksköterska eller läkare, men inte av en tandläkare, som också får delegera enligt 9 kap. 2 §, eftersom demon inte har någon tandvård.',
  },
  // Runda 9, r2: infusionspumpens rapporter som givna doser (medicinteknik.js).
  {
    id: '3.5.2.19', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [MT9.pumpDos, MT9.pumpEnhet, MT9.simulerad, MT9.infusion, MT9.gemensam],
    losning: 'En infusionspump som är kopplad till patienten och till en infusion rapporterar pågående hastighet, justeringar, bolusar och stopp. Systemet registrerar given volym och dos som administreringar med källan utrustning, räknar dosen ur koncentrationen, lägger volymen i vätskebalansen och kontrollerar varje rapport mot det ordinerade intervallet per kilo och timme, bolusdosen och den högsta dygnsdosen. Pumparna och varningarna visas i Läkemedel att ge och i patientens mätvärden, där sjuksköterskan kvitterar en varning med vad som gjordes.',
    expert: 'Systemet registrerar doserna själv medan pumpen går och säger på vanlig svenska när pumpen ger mer än det ordinerade, så sjuksköterskan inte behöver räkna om ml per timme till dos per kilo.',
    anmarkning: 'Pumparna är simulerade i demon. Pumpen rapporterar men styrs inte från Vårdkällan, och ordinationen skickas inte till pumpen.',
  },
  {
    id: '3.5.2.20', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}uppföljningsdatum är obligatoriskt`,
      `${S}alla ordinationer har orsak och uppföljningsdatum`,
      'Läkemedelsgenomgång > läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken',
    ],
    losning: 'Varje ordination har ett obligatoriskt uppföljningsdatum, och läkemedelsgenomgången visar passerade uppföljningar.',
    expert: 'Systemet kräver uppföljningsdatum och föreslår ett, så uppföljningen planeras när ordinationen görs.',
    anmarkning: 'Utvärdering av behandlingen och uppföljning på patientgruppsnivå saknas, och passerade uppföljningsdatum bevakas inte i inkorgen.',
  },
  {
    id: '3.5.2.21', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VB}vätskebalansen räknar in administrerad volym av sig själv`,
      `${FO}fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient`,
    ],
    losning: 'En ordination kan markeras för vätskebalansen med volym per dos, och mallen för intravenösa läkemedel gör det själv. Administrerade doser räknas in i vätskebalansen automatiskt, och ett läkemedel ordinerat i mg ger volymen ur koncentrationen.',
    expert: 'Systemet räknar fram volymen och för in den i vätskebalansen när dosen ges, så ingen registrerar samma sak två gånger.',
    anmarkning: 'Kaloriberäkning och förväntad vätskebalans saknas.',
  },
];
// Runda 6, r2: posterna som byggdes i läkemedelsprocessen, del 2, ersätts ur sussa/lakemedel-r2.js.
// Runda 9, r1: beredning, etikett, skanning och resten av läkemedelsprocessen (sussa/lakemedel-r9.js).
export default medR9r1(medR8r4(medR6(medR2(AVSNITT))));
