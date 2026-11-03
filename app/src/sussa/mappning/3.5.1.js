// Sussa 3.5.1 Stöd för läkemedelshantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, A, M } = TEST;
// Läkemedelsprocessen (app/test/administrering.test.js).
const AD = 'Administrering > ';
const UT = 'Utsättning > ';
const FO = 'Fördefinierade ordinationer > ';
const LG = 'Läkemedelsgenomgång > ';

export default [
  {
    id: '3.5.1.1', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${A}helflöde: ordination med varning, kvittens och NLL-timeout med avstämning`,
      `${AD}ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt`,
      `${AD}permission: doser under permission lämnas över till patienten`,
    ],
    losning: 'En gemensam läkemedelslista för patienten med ordination, utsättning, varningar, överföring till NLL, iordningsställande, administrering, vidimering och läkemedelsgenomgång, knuten till vårdkontakt och vårdtillfälle.',
    expert: 'Läkemedelslistan visar alla enheters ordinationer utan aktivt val men aldrig spärrade uppgifter, och dagens doser räknas fram ur den, så användaren ser helheten utan att behöva välja.',
    anmarkning: 'Överföringar mellan vårdprocesser, till exempel läkemedelsberättelsen till nästa vårdgivare, skickas inte. NLL är simulerad.',
  },
  {
    id: '3.5.1.2', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}spärrade enheters ordinationer visas inte i läkemedelslistan`,
      `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`,
    ],
    losning: 'Läkemedelslistan visar aktuella och utsatta ordinationer med orsak, dos, administrationssätt, uppföljningsdatum och NLL-status, och dagens administreringar med status per dos.',
    expert: 'Systemet visar aktuella ordinationer först, dagens doser i tidsordning och de utsatta med orsak, så användaren behöver inte filtrera själv.',
    anmarkning: 'Vyer för dosering över flera dygn och egen sortering och filtrering saknas.',
  },
  {
    id: '3.5.1.3', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${FO}fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient`,
      `${FO}API: ordination med förslag sparar administrationssätt och volym, och förslaget kräver ordinationsrätt`,
    ],
    losning: 'Fördefinierade ordinationer för vanliga läkemedel. När förskrivaren väljer produkten fyller systemet i dosering, dos, administrationssätt, tider, typ och uppföljningsdatum, anpassat efter patientens ålder och njurfunktion.',
    expert: 'Systemet föreslår ordinationen ur produkten och patienten och förklarar varje anpassning, till exempel lägre högsta dygnsdos av paracetamol från 75 år, så förskrivaren bara ändrar det som avviker.',
    anmarkning: 'Mallarna är demoregler, fasta i koden och gäller en ordination i taget. Mallar med flera ordinationer och lokal anpassning saknas. Förskrivning av e-recept har inga mallar.',
  },
  { id: '3.5.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Stöd för spädning och tillsatser är inte byggt.' },
  {
    id: '3.5.1.5', kategori: 'system', egna: ['D10', 'L11'], avsedd: 'delvis',
    tester: [
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      `${M}varning: dubbelordination av samma substans`,
      `${M}varning: samma ATC-grupp ger observera`,
      `${M}varning: warfarin och NSAID`,
      `${M}varning: två antikoagulantia`,
      `${M}varning: metformin vid lågt eGFR`,
      `${M}allvarlig varning måste kvitteras med motivering`,
      `${M}varningarna är märkta som demoregler`,
      `${AD}varning: dubbel dos`,
      `${AD}varning: given dos utan ordination`,
      `${UT}utsättningsreglerna ligger i en egen modul och är märkta som demoregler`,
    ],
    losning: 'Varningar vid ordination (överkänslighet, dubbelordination, samma ATC-grupp, interaktioner och metformin vid lågt eGFR), vid administrering (dubbel dos, för tidig dos, dos utan ordination och högsta dygnsdos) och vid utsättning av läkemedel med särskilda observationer. En allvarlig varning måste kvitteras med motivering.',
    expert: 'Systemet kontrollerar varje ordination, dos och utsättning mot journalen innan den sparas och förklarar varningen på vanlig svenska, så användaren inte behöver kunna reglerna själv.',
    anmarkning: 'Varningarna är demoregler och inte kliniskt beslutsstöd. Ingen anslutning till Sil eller Janusmed, och ingen MDR-bedömning är gjord.',
  },
  {
    id: '3.5.1.6', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [`${LG}läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken`],
    losning: 'Enkel läkemedelsgenomgång: systemet tar fram pågående läkemedel med indikation, dubbelmedicinering, interaktioner, överkänslighet, passerade uppföljningar och läkemedel som är olämpliga för äldre, och läkaren sparar genomgången med bedömning.',
    expert: 'Systemet gör kontrollerna själv och visar bara det som behöver bedömas, så läkaren inte behöver gå igenom varje läkemedel mot reglerna.',
    anmarkning: 'Kontrollerna är demoregler. Fördjupad läkemedelsgenomgång, patientens egen medverkan och farmaceutens roll är inte byggda.',
  },
  { id: '3.5.1.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Stöd för nationella vaccinationsprogram är inte byggt.' },
  {
    id: '3.5.1.8', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}spärrade enheters ordinationer visas inte i läkemedelslistan`,
      `${M}NLL: normal överföring kvitteras`,
      `${AD}dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider`,
      `${AD}per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda`,
      `${UT}utsättning av betablockerare ger varning och kräver bekräftelse`,
    ],
    losning: 'Ordinationer och förskrivningar visas i läkemedelslistan med NLL-status, och administreringarna per dos med vem och när. Läkemedel med särskilda observationer vid utsättning visas med varning.',
    expert: 'Systemet visar själv om överföringen till NLL är kvitterad, vem som gav varje dos och när nästa dos av ett vid behovsläkemedel tidigast får ges.',
    anmarkning: 'Filtrering och sortering är begränsade, och en oidentifierad patients läkemedel samlas först när journalerna slås samman.',
  },
  {
    id: '3.5.1.9', kategori: 'nationell', egna: ['L7', 'D1'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`,
      `${M}NLL: felsvar syns och avstämning skickar igen`,
    ],
    losning: 'Överföring av ordinationer till Nationella läkemedelslistan med kvittens, och avstämning efter timeout eller felsvar. NLL är simulerad i demon.',
    expert: 'Systemet döljer aldrig en registrerad ordination vid timeout, utan stämmer av mot NLL själv och visar resultatet.',
    anmarkning: 'NLL är simulerad. Sil, Infektionsverktyget, Pascal och makulering av e-recept är inte anslutna.',
  },
  { id: '3.5.1.10', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Rapportering av biverkningar till Läkemedelsverket och av vaccinationer till Folkhälsomyndigheten är inte byggd.' },
  {
    id: '3.5.1.11', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [`${LG}läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken`],
    losning: 'Läkemedelsberättelsen skrivs av systemet ur ordinationernas historik under vårdtillfället: ändrade doser, insatta och utsatta läkemedel med orsak, oförändrade läkemedel, givna vid behovsdoser och kommande uppföljningar. Läkaren kan ändra den innan genomgången sparas.',
    expert: 'Systemet förifyller hela läkemedelsberättelsen och känner själv igen en dosändring när en ordination ersätts av en ny med samma substans.',
    anmarkning: 'Läkemedelsberättelsen följer inte med epikrisen eller till nästa vårdgivare. Fynden är demoregler.',
  },
];
