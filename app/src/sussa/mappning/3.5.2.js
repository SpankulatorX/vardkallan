// Sussa 3.5.2 Process för läkemedelshantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, A, M, S, KV, GK, LK } = TEST;
// Läkemedelsprocessen: administrering, vidimering, utsättning, fördefinierade ordinationer, läkemedelsgenomgång och
// vätskebalans (app/test/administrering.test.js).
const AD = 'Administrering > ';
const AA = 'Administrering via API > ';
const VI = 'Vidimering > ';
const UT = 'Utsättning > ';
const FO = 'Fördefinierade ordinationer > ';
const VB = 'Vätskebalans > ';

export default [
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
    tester: [`${FO}ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts`],
    losning: 'En ordination kan göras till en planerad vårdhändelse som inte har fått en tid, till exempel två timmar före en elkonvertering. Den visas som väntande i administreringslistan tills vårdhändelsen får en tid, och då räknas administrationstiden fram.',
    expert: 'Systemet räknar fram administrationstiden när vårdhändelsen tidsätts, så ingen behöver ändra ordinationen.',
    anmarkning: 'Vårdhändelsen anges med text och tidsätts i läkemedelsprocessen. Koppling till tidbok och operationsplanering saknas, eftersom de inte är byggda.',
  },
  {
    id: '3.5.2.8', kategori: 'system', egna: ['D10', 'L11'], avsedd: 'uppfyllt_demo',
    tester: [
      `${UT}utsättning av betablockerare ger varning och kräver bekräftelse`,
      `${UT}utsättning utan särskilda observationer ger ingen varning, och antikoagulantia ger en observation`,
      `${UT}utsättningsreglerna ligger i en egen modul och är märkta som demoregler`,
      `${GK}Sätta ut ett läkemedel med varning inom budget`,
    ],
    losning: 'Vid utsättning varnar systemet för läkemedel med särskilda observationer: betablockerare, antikoagulantia, trombocythämmare efter PCI, kortison, basinsulin, antiepileptika, antidepressiva, opioider och sömnmedel. Reglerna ligger i en egen modul och är märkta som demoregler.',
    expert: 'Systemet räknar ut hur länge patienten har haft substansen, också över dosändringar, visar varningen med ett förslag på nedtrappning innan något sparas och låter orsaken vara motiveringen.',
    anmarkning: 'Reglerna är demoregler, inte granskade av farmaceut eller läkare. Inget nedtrappningsschema skapas av systemet.',
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
      `${A}helflöde: ordination med varning, kvittens och NLL-timeout med avstämning`,
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
    tester: [`${FO}ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts`],
    losning: 'Ordination till en planerad vårdhändelse som inte är tidsatt, med tid före eller efter händelsen. Administrationstiden anpassas när vårdhändelsen tidsätts.',
    expert: 'Systemet räknar fram när läkemedlet ska ges när vårdhändelsen får sin tid och visar det i administreringslistan.',
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
    ],
    losning: 'Dagens administreringslista per avdelning och patient räknas fram ur ordinationerna. Sjuksköterskan ger, lämnar över eller registrerar att en dos inte gavs med ett klick, också i efterhand. Senast given dos, dygnsdos för vid behov och doser under permission visas. Administreringarna finns i läskopian vid avbrott och i FHIR som MedicationAdministration.',
    expert: 'Systemet kontrollerar varje dos mot ordinationen och tidigare doser och varnar för dubbel dos, för tidig dos, dos utan ordination och högsta dygnsdos med en förklaring på vanlig svenska. Tid, vem som gav dosen och vårdkontakten sätts av systemet.',
    anmarkning: 'Varningarna är demoregler. Patientnära skanning är förberedd med kontrollkoden men ingen streckkodsläsare är ansluten. Tiderna i en ordination ändras genom en ny ordination, inte i administreringslistan.',
  },
  { id: '3.5.2.19', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Automatgenererad administrering från medicinteknisk utrustning är inte byggd.' },
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
