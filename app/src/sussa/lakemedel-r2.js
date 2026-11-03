// Runda 6, r2: läkemedelsprocessen, del 2. Testnamnen (app/test/lakemedelsstod.test.js och klickbudgeten) och de
// poster i Sussa 3.5.1, 3.5.2 och 3.5.3 som byggdes i rundan. Mappningsfilerna för avsnitten ersätter sina poster med
// dessa, så att ändringen ligger samlad här.
import { TEST } from '../krav.js';

const { GK, M, KV } = TEST;
const MA = 'Mallar med flera ordinationer > ';
const TR = 'Upp- och nedtrappning > ';
const MU = 'Muntlig ordination > ';
const GD = 'Generella direktiv > ';
const SP = 'Spädning och tillsatser > ';
const EF = 'Registrering i efterhand och makulering > ';
const VF = 'Vätskebalans framåt > ';
const LT = 'Läkemedelstyper > ';
const UP = 'Uppföljning av läkemedel > ';
const FG = 'Fördjupad läkemedelsgenomgång > ';
const VY = 'Vyer för läkemedel > ';
const FP = 'Förpackning med NPL-pack-id > ';
const SG = 'Säkerhetsgranskning av läkemedelsprocessen del 2 > ';
const API = 'Läkemedelsprocessen del 2 via API > API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg';

export const T = {
  mall: `${MA}läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har`,
  mallHandelse: `${MA}ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering`,
  mallSakerhet: `${MA}säkerhet: mallen gäller bara sin vårdenhet, sjuksköterskan ordinerar inte ur mallar, bara läkare upprättar en mall och den används först när den är godkänd`,
  nedtrappning: `${TR}systemet föreslår ett nedtrappningsschema för kortison och räknar dosen för varje dag i Läkemedel att ge`,
  upptrappning: `${TR}upptrappning fortsätter med slutdosen, och en dos som inte går att ge med produkten förklaras`,
  muntlig: `${MU}sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar`,
  muntligSakerhet: `${MU}säkerhet: läkaren ska vara på samma vårdenhet, orsaken till omedelbar behandling krävs och undersköterskan och läkaren dokumenterar inte muntligt`,
  direktivRamar: `${GD}sjuksköterskan ser vårdenhetens direktiv prövade mot patienten, och systemet förklarar varför ett direktiv inte ryms`,
  direktivOrdinera: `${GD}sjuksköterskan ordinerar inom direktivet med bedömning, och antalet tillfällen utan läkarkontakt räknas`,
  direktivFaststalla: `${GD}bara verksamhetschefen och den medicinskt ansvariga läkaren fastställer och upphäver ett direktiv för sin vårdenhet, med det som 6 kap. 6 § kräver`,
  spadning: `${SP}systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet`,
  tillsats: `${SP}en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen`,
  makulering: `${EF}en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen`,
  efterhand: `${EF}ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras`,
  makuleringSakerhet: `${EF}säkerhet: en annan vårdenhet, nödåtkomst och en spärrad dos kan inte makuleras, och nekade försök loggas`,
  vatskaFramat: `${VF}beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna`,
  vatskaSekretess: `${VF}inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen`,
  typer: `${LT}extempore, licens, egendefinierade läkemedel, blodprodukter och nutrition finns i katalogen, märkta som demo och utan NPL-id`,
  licens: `${LT}systemet bevakar licensen: varning vid ordination, stopp vid dos efter att den gått ut och en rad i läkarens inkorg`,
  blod: `${LT}en blodprodukt ges bara med kontrollen vid sängen, och skickas inte till NLL`,
  uppfoljning: `${UP}en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning`,
  patientgrupp: `${UP}uppföljningen på vårdenhetens nivå visar antal per läkemedel utan patientuppgifter, och bara för läkaren`,
  fordjupad: `${FG}läkaren startar, farmaceuten föreslår åtgärder, patientens medverkan registreras och läkaren beslutar med det som 11 kap. kräver`,
  fordjupadSakerhet: `${FG}säkerhet: sjuksköterskan startar inte, nödåtkomst ger ingen genomgång och patientens frånvaro ska motiveras`,
  dygn: `${VY}dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag`,
  flaggor: `${VY}läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning`,
  npl: `${FP}katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade`,
  pack: `${FP}systemet väljer förpackningen när förskrivaren inte väljer, och överföringen till NLL har NPL-pack-id`,
  sgMuntlig: `${SG}en muntlig ordination prövas mot när registreringen görs: en bakdaterad dos efter fönstret stoppas`,
  sgIordning: `${SG}ett iordningsställande i efterhand får inte ligga före ordinationen eller i framtiden`,
  sgSamtycke: `${SG}en fördjupad genomgång och en utvärdering sparar aldrig en spärrad vårdenhets läkemedel, inte ens med samtycke`,
  api: API,
  kbMall: `${GK}Ordinera från en mall med flera ordinationer inom budget`,
  kbEfterhand: `${GK}Registrera en dos i efterhand inom budget`,
};

const p = (id, avsedd, egna, tester, losning, expert, anmarkning) => ({ id, kategori: 'system', egna, avsedd, tester, losning, expert, anmarkning });
const B = 'Behörighetsmotorn > ';
const AD = 'Administrering > ';
const LG = 'Läkemedelsgenomgång > ';

export const POSTER = Object.fromEntries([
  p('3.5.1.2', 'uppfyllt_demo', ['L7'], [`${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`, `${M}spärrade enheters ordinationer visas inte i läkemedelslistan`, `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`, T.dygn, T.flaggor],
    'Läkemedelslistan med aktuella och utsatta ordinationer, dagens administreringar, dosering över flera dygn med status för varje dos och trappschemats dos per dag, och filtrering och sortering av listan.',
    'Systemet räknar fram doserna för flera dygn ur ordinationerna och märker själv läkemedel med särskild observation vid utsättning och uppföljningar som har passerat, så användaren kan filtrera på det som behöver göras.',
    'Vyn för flera dygn visar högst sju dygn. Valen för filtrering och sortering sparas i webbläsaren för sessionen.'),
  p('3.5.1.3', 'uppfyllt_demo', ['D10'], ['Fördefinierade ordinationer > fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient', T.mall, T.mallHandelse, T.mallSakerhet, T.kbMall],
    'Fördefinierade ordinationer för en produkt i taget och mallar med flera ordinationer, till exempel inför elkonvertering, som en läkare på vårdenheten fastställer. Läkaren väljer mallen och ordinerar alla med ett klick.',
    'Systemet fyller i varje ordination i mallen ur produkten och patientens ålder och njurfunktion, varnar per ordination, tar själv bort ett läkemedel som patienten redan har och förklarar varför, och kräver motivering bara för en annan allvarlig varning.',
    'Mallarna och förslagen är demoregler. En mall fastställs av en läkare (Gröna häftet 688488 R5 avsnitt 1.4.3), i demon med API:t, och det finns inget eget gränssnitt för att bygga en mall. Förskrivning av e-recept har inga mallar.'),
  p('3.5.1.4', 'delvis', [], [T.spadning, T.tillsats, T.vatskaFramat],
    'Spädning och tillsatser i ordinationen för läkemedel som späds: lösning, volym och infusionstid, och en tillsats av kaliumklorid i en basvätska.',
    'Systemet föreslår spädningen ur produkten, räknar koncentration, total volym och hastighet och hur mycket som dras upp ur en stamlösning, visar det vid iordningsställandet och stoppar en för hög koncentration eller tillsats per liter och per timme med en förklaring.',
    'Spädningsreglerna är demoregler för fyra substanser och en tillsats, inte granskade av farmaceut. Beredning med etikett och kontroll av den som späder finns inte.'),
  p('3.5.1.6', 'uppfyllt_demo', ['D10'], [`${LG}läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken`, T.fordjupad, T.fordjupadSakerhet, T.sgSamtycke],
    'Enkel läkemedelsgenomgång med läkemedelsberättelse och fördjupad läkemedelsgenomgång enligt HSLF-FS 2017:37 11 kap.: läkaren startar, farmaceuten föreslår åtgärder, patientens medverkan och besvär registreras och läkaren beslutar med mål, uppföljning och ansvarig.',
    'Systemet tar fram det underlag för varje läkemedel som föreskriften kräver, föreslår en åtgärd ur fynden, kontrollerar att det som ska dokumenteras finns med innan genomgången avslutas och skriver sammanfattningen.',
    'Kontrollerna är demoregler. Patientens frågor om besvär är inte ett validerat formulär. Besluten ändrar inte ordinationerna av sig själva, utan läkaren gör det i läkemedelslistan. Farmaceuten är en demoroll på kardiologen.'),
  p('3.5.1.8', 'delvis', ['L7'], [`${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`, `${M}NLL: normal överföring kvitteras`, `${AD}per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda`, 'Utsättning > utsättning av betablockerare ger varning och kräver bekräftelse', T.dygn, T.flaggor, T.uppfoljning],
    'Ordinationer och förskrivningar med NLL-status, förpackning, läkemedelstyp, spädning och trappschema, administreringarna per dos med vem och när, dosering över flera dygn och filtrering och sortering.',
    'Systemet märker själv läkemedel med särskild observation vid utsättning, passerade uppföljningar och muntliga ordinationer som väntar på signering, och visar vem som ska följa upp.',
    'En oidentifierad patients läkemedel samlas först när journalerna slås samman.'),
  p('3.5.2.1', 'uppfyllt_demo', ['L7'], [`${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`, `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`, 'Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick', T.spadning, T.tillsats],
    'En gemensam läkemedelsfunktion där ordination, mall, muntlig ordination, generella direktiv, spädning, iordningsställande, administrering, vidimering, utvärdering och läkemedelsgenomgång görs på samma läkemedelslista och knyts till vårdkontakten.',
    'Systemet räknar fram dagens doser, spädningen och vätskebalansen ur ordinationerna och knyter varje steg till vårdtillfället, så att processen hänger ihop utan att någon behöver föra över något mellan stegen.',
    'Slutenvårdsdos (3.5.2.16) och automatiska doser från medicinteknisk utrustning (3.5.2.19) finns inte.'),
  p('3.5.2.2', 'uppfyllt_demo', ['L7'], [`${AD}registrering i efterhand med tidpunkt och den som utförde det`, T.efterhand, T.makulering, T.makuleringSakerhet, T.sgMuntlig, T.sgIordning, T.kbEfterhand],
    'Administrering, överlämnande, dos som inte gavs, iordningsställande och vätskebalans registreras i efterhand med tiden då det gjordes, och en muntlig ordination dokumenteras i efterhand av sjuksköterskan. En felaktig registrering makuleras med orsak och visas överstruken, och raderas aldrig.',
    'Systemet föreslår tiden, aldrig i framtiden, prövar delegering, licens och muntlig ordination både mot den angivna tiden och mot när registreringen görs, visar själv att registreringen gjordes i efterhand och räknar bort en makulerad dos ur dagens doser och vätskebalansen.',
    'Vidimering och läkemedelsgenomgång registreras med aktuell tid, eftersom de är handlingar som görs när de registreras.'),
  p('3.5.2.3', 'uppfyllt_demo', [], ['Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv', T.vatskaFramat, T.tillsats, T.vatskaSekretess],
    'Vätskebalansen omfattar hela läkemedelsprocessen: beredd volym som är iordningsställd men inte given, given volym inklusive spädning och tillsatser, och förväntad volym ur ordinationerna.',
    'Systemet räknar volymen ur ordinationen, spädningen och dosen och för in den när dosen ges, så ingen registrerar samma sak två gånger.',
    'Förlusterna framåt räknas som samma mängd som det senaste dygnet.'),
  p('3.5.2.4', 'delvis', ['L7', 'D9'], [`${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`, T.typer, T.licens, T.blod, T.vatskaFramat],
    'Godkända läkemedel ur NPL och, märkta som demo, extempore, licensläkemedel med licens som systemet bevakar, egendefinierade läkemedel, blodprodukter och nutrition med kalorier, genom ordination, administrering och vätskebalans.',
    'Systemet bevakar licensens giltighet vid ordination och dos och i läkarens inkorg, kräver kontrollen vid sängen för en blodprodukt, räknar kalorierna ur nutritionen och skickar inte blodprodukter, nutrition och egendefinierade läkemedel till NLL.',
    'Produkterna utanför NPL är påhittade demoposter. Beställning av extempore från apotek, licensansökan till Läkemedelsverket och anslutning till blodcentralen finns inte.'),
  p('3.5.2.10', 'delvis', ['L7'], [`${M}utsättning kräver orsak och inget raderas`, `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`, `${AD}administreringar raderas inte och en given dos ändras inte (trigger)`, `${GK}Ge en dos inom budget`, T.uppfoljning, T.makulering, T.dygn, T.flaggor],
    'Ordination, mall, muntlig ordination, direktiv, iordningsställande, administrering, vidimering, utvärdering och utsättning, med historik där varje steg finns kvar med vem, var och när, och en strukturerad utvärdering av effekt och biverkan.',
    'Systemet raderar aldrig en ordination, en dos eller en utvärdering, sparar varje steg med orsak, tid och vårdkontakt och föreslår nästa uppföljning när en behandling utvärderas.',
    'Urvalet av historiken görs med listans filter och vyn över flera dygn.'),
  p('3.5.2.12', 'delvis', ['L7'], [`${M}ordinationsorsak är obligatorisk`, `${M}uppföljningsdatum är obligatoriskt`, `${M}sjuksköterska kan inte ordinera`, `${GK}Ordinera ett läkemedel utan varning inom budget`, T.mall, T.nedtrappning, T.upptrappning, T.muntlig, T.muntligSakerhet, T.spadning],
    'Ordination av stående läkemedel, vid behov och tillfälliga, med förslag ur mallar, mallar med flera ordinationer, upp- och nedtrappning med dos per dag, spädning och tillsatser och muntlig ordination som sjuksköterskan dokumenterar och läkaren signerar.',
    'Systemet föreslår trappschemat och kontrollerar att varje dos går att ge med produkten, räknar dosen för varje dag, stoppar en dos av en muntlig ordination som inte är signerad efter två timmar och förklarar varför.',
    'Förslagen och trappmallarna är demoregler. Doseringsstöd och kliniskt beslutsstöd från en extern källa, stöd när patienten sköter sin medicinering själv och elektronisk beställning till extern part finns inte.'),
  p('3.5.2.14', 'delvis', [], ['Fördefinierade ordinationer > ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts', T.mallHandelse, T.kbMall],
    'Ordination till en planerad vårdhändelse som inte är tidsatt, ensam eller ur en mall med flera ordinationer som hänger på samma vårdhändelse, med tiden från tidboken.',
    'Systemet hittar patientens bokning eller post på väntelistan som passar mallens vårdhändelse, knyter alla ordinationer till den och räknar fram administrationstiderna när vårdhändelsen får sin tid.',
    'Operationsplanering finns inte.'),
  p('3.5.2.15', 'delvis', [], [T.direktivRamar, T.direktivOrdinera, T.direktivFaststalla, T.api],
    'Generella direktiv som en läkare fastställer skriftligt för vårdenheten eller en avdelning, med läkemedel, dosering, maxdos, administreringssätt, indikation, kontraindikationer, antal tillfällen utan läkarkontakt och spädning. Sjuksköterskan ordinerar inom direktivet efter sin bedömning.',
    'Systemet visar bara de direktiv som gäller där sjuksköterskan arbetar, prövar ålder, njurfunktion, blodtryck, överkänslighet och andra läkemedel, förklarar varför ett direktiv inte ryms, låter sjuksköterskan bekräfta det som systemet inte kan kontrollera och räknar antalet tillfällen.',
    'Demons direktiv är påhittade. Vem som får fastställa följer HSLF-FS 2017:37 6 kap. 6 och 17 §§ och Gröna häftet, i demon alla läkare på vårdenheten. Vårdgivarens nivå och en egen roll för läkemedelsansvarig finns inte.'),
  p('3.5.2.20', 'delvis', ['L7'], [`${M}uppföljningsdatum är obligatoriskt`, T.uppfoljning, T.patientgrupp, T.api],
    'Uppföljningsdatum på varje ordination, bevakning i läkarens inkorg när datumet har passerat, strukturerad utvärdering av effekt, biverkan och beslut, och uppföljning per läkemedel på vårdenhetens nivå.',
    'Systemet bevakar uppföljningsdatumet, föreslår nästa uppföljning ur ordinationens intervall, påminner om att rapportera en biverkan och räknar samman utvärderingarna per läkemedel utan patientuppgifter.',
    'Uppföljningen gäller den egna vårdenheten. Behandlingsresultat på vårdgivarens nivå och rapportering av biverkningar till Läkemedelsverket finns inte.'),
  p('3.5.3.1', 'uppfyllt_demo', [], ['Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv', T.vatskaFramat, T.vatskaSekretess],
    'Samlad vätskebalans per patient och dygn: intag och förluster, administrerade läkemedel, beredd volym, kalorier, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna.',
    'Systemet för in volymen från läkemedelsadministreringen själv, räknar summorna och kalorierna och räknar fram det som väntas ur ordinationerna.',
    'Läsningen följer inre sekretess som mätvärdena.'),
  p('3.5.3.2', 'uppfyllt_demo', [], [T.vatskaFramat, T.efterhand],
    'Vätskebalansen per dygn med valbar dygnsbrytning, filter för intag eller förluster, sortering på tid eller volym, kalorier och makulerade poster överstrukna.',
    'Systemet sorterar och summerar själv, märker posterna från administreringen och räknar bort en makulerad post.',
    'Dygnsbrytningen kan väljas mellan kl. 00, 06, 07 och 08.'),
  p('3.5.3.3', 'delvis', [], [T.vatskaFramat],
    'Förväntad vätskebalans de närmaste 24 timmarna: summa in ur ordinationerna, summa ut och balans, med varje förväntad post och ackumulerad balans för dygnet.',
    'Systemet räknar fram den förväntade tillförseln ur ordinationernas tider och volymer, också det som är iordningsställt, så ingen behöver räkna själv.',
    'Förväntade förluster räknas som samma mängd som det senaste dygnet, och prognosen gäller 24 timmar framåt.'),
].map(x => [x.id, x]));

// Ersätter avsnittets poster med rundans.
export const medR2 = (poster) => poster.map(x => POSTER[x.id] ?? x);
