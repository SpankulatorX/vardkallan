// Sussa 6.1.1 Spårbarhet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { R } = TEST;
const VK = 'Vårdkontakt > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

export default [
  {
    id: '6.1.1.1', kategori: 'system', egna: ['D2'], avsedd: 'uppfyllt_demo',
    tester: [
      `${VK}all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient`,
      `${VK}migrerad historik får vårdkontakter med samma källa, märkta som skapade av systemet`,
      `${VK}anteckningen knyts till den pågående vårdkontakten utan att någon väljer den`,
      `${VK}finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag`,
      `${VK}vårdkontakten visar allt som hör till den, med samma behörighet och loggning`,
      `${VK}översikten och tidslinjen visar informationen per vårdkontakt och per vårdtillfälle`,
      `${VK}ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt`,
      `${VK}nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras`,
      `${VK}en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades`,
    ],
    losning: 'Varje anteckning, diagnos, mätvärde, ordination och remiss hör till en vårdkontakt, också den migrerade historiken. En vårdkontakt kan öppnas med allt som hör till den, och översikten och tidslinjen kan visas per vårdkontakt och vårdtillfälle. I FHIR pekar resurserna på sitt Encounter.',
    expert: 'Den som dokumenterar väljer aldrig en vårdkontakt. Systemet knyter uppgiften till den pågående kontakten, och finns ingen skapar det en med typ och enhet ur sammanhanget och visar den med möjlighet att ändra.',
    anmarkning: 'Överkänslighet är uppmärksamhetsinformation om patienten och hör inte till en enskild vårdkontakt. Historik som saknade vårdkontakt i källan har fått en kontakt per vårdenhet och dag, märkt som skapad av systemet. Den räknas inte som överförd i migreringsavstämningen. En kontakt som systemet skapar under nödåtkomst ger ingen vårdrelation, så att systemets hjälp aldrig ger mer behörighet än användaren hade.',
  },
  {
    id: '6.1.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      // Runda 6, r3: ärendet avslutas, delas och slås ihop, och en kontakt flyttas mellan ärenden.
      'Hälsoärende > ett hälsoärende kan avslutas och öppnas igen, med historik',
      'Hälsoärende > ett hälsoärende delas, och kontakterna följer med till det nya ärendet',
      'Hälsoärende > två ärenden slås ihop, och det sammanslagna visas inte längre',
      'Hälsoärende > en vårdkontakt flyttas mellan ärenden, med historik i båda',
      'Hälsoärende > kontakter och ärenden som användaren inte får se rörs inte, och nödåtkomst ger bara läsning',
      'Hälsoärende > historiken kan inte ändras eller raderas (trigger)',
      `${VK}hälsoärende föreslås ur samma diagnos och bekräftas med ett klick`,
      `${VK}hälsoärende föreslås ur en remisskedja`,
      `${VK}förslagen bygger bara på kontakter som användaren får se, och ett förslag kan avvisas`,
      `${VK}hälsoärendet visar bara de vårdkontakter som användaren får se`,
      `${VK}seedens hälsoärende håller samman remisskedjan för patient 11`,
      flode('halsoarende'),
    ],
    losning: 'Hälsoärenden håller samman vårdkontakter över tid och vårdenheter. Systemet föreslår ärenden ur samma diagnos, en remisskedja och övergångar mellan vårdformer, och användaren bekräftar med ett klick eller avvisar förslaget. Nya kontakter i samma vårdtillfälle och efter ett akutbesök följer med ärendet. Ett ärende kan avslutas och öppnas igen, delas och slås ihop med ett annat, och en kontakt kan flyttas mellan ärenden, med en historik som inte kan ändras. I FHIR är hälsoärendet EpisodeOfCare.',
    expert: 'Systemet ser vilka kontakter som hör ihop och föreslår ärendet med skälet utskrivet, och föreslår också att ärenden med samma diagnoskategori slås ihop och att ett ärende utan kontakter på ett halvår avslutas. Användaren behöver aldrig själv leta upp och koppla ihop kontakter.',
    anmarkning: 'Regeln för att föreslå avslut är en demoregel. Den som inte ser alla kontakter i ett ärende kan inte avsluta eller slå ihop det. Figur 2 och 3 i kravspecifikationen ingår inte i utdraget.',
  },
  {
    id: '6.1.1.3', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [`${VK}ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt`,
      // Runda 9, r7: händelsekedjan per vårdkontakt med kringsystemen (sparbarhet.js).
      'Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id',
      'Spårbarhet > överföringen till NLL och svaret från NLL syns i händelsekedjan, och varje del följer sin behörighet',
      'Spårbarhet > en ordination eller kontakt på en spärrad vårdenhet röjs aldrig, inte heller genom en prenumerationsnotis'],
    losning: 'Vårdkontakten har ett process-id och är det gemensamma id:t mot andra system: i FHIR pekar Observation, MedicationRequest, ServiceRequest och Composition på sitt Encounter. Händelsekedjan för en vårdkontakt håller samman det som hände i Vårdkällan och anropen till kringsystemen: beställningarna till laboratoriet med beställningsnumret som korrelations-id och svaren som kom tillbaka, överföringarna till NLL med meddelandets id och kvittensen, och notiserna till prenumeranterna i det öppna API:t, med tid för anrop och svar och ledtiden.',
    expert: 'Systemet sätter process-id och korrelations-id själv när uppgiften sparas och skickas och ställer samman kedjan, så att ingen behöver ange eller leta upp ett id för att para ihop data mellan kärnsystemet och kringsystemen.',
    anmarkning: 'Laboratoriet, NLL och prenumeranterna är simulerade. Rapporterna till myndigheter och register är sammanställningar per period och hör inte till en enskild kontakt.',
  },
  {
    id: '6.1.1.4', kategori: 'system', egna: ['D1'], avsedd: 'uppfyllt_demo',
    tester: [
      `${R}statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat`,
      `${VK}hälsoärende föreslås ur en remisskedja`,
      // Runda 9, r7: målvärden och uppföljning av subprocesserna (sparbarhet.js och konfiguration.js).
      'Subprocesser > målvärdena för ledtiderna är parametrar som systemförvaltaren sätter, med samma standard som modulen',
      'Subprocesser > remiss, provtagning och läkemedelsöverföring följs upp per steg mot målvärdena, utan personuppgifter',
      'Beställning och svar > uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter',
      'Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id',
    ],
    losning: 'Remiss, provtagning och läkemedelsöverföring till NLL är subprocesser med tidpunkt för varje steg, knutna till vårdkontakten. Uppföljningen av subprocesserna visar medianen per steg och totalt, andelen inom målvärdet och de långsammaste med korrelations-id, för den egna vårdenheten eller hela vårdgivaren. Målvärdena sätter systemförvaltaren på sidan Regler och parametrar, med fyra ögon och giltighetsdatum.',
    expert: 'Systemet bevakar stegen och larmar när ett steg uteblir, räknar ledtiderna själv och jämför dem med målet, och förhandsvisar hur många som hamnar inom ett nytt mål innan det godkänns.',
    anmarkning: 'Målvärdena i demon är Vårdkällans förslag, inte regionens mål. Medianer och andelar som bygger på färre än fem visas inte.',
  },
  {
    id: '6.1.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VK}vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om`,
      `${VK}medicinskt ansvar följer med vid flytt till en annan klinik, eller stannar kvar`,
      `${VK}inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket`,
      `${VK}utskrivningen avslutar vårdtillfället och påminner om osignerade anteckningar och epikris`,
      `${VK}FHIR: Encounter med vårdtillfälle, kontaktsätt och hälsoärende, och EpisodeOfCare med samma behörighet`,
      `${VK}inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får`,
      `${VK}vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se`,
      `${VK}FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se`,
      flode('inskrivning'), flode('flytta'), flode('utskrivning'),
    ],
    losning: 'Ett vårdtillfälle håller samman vistelserna på de avdelningar patienten ligger på, med inskrivning, sektions-, avdelnings- och klinikbyten, sängbyten, permission och utskrivning som händelser som inte kan ändras. Medicinskt ansvar och produktionsansvar hålls isär, så att en patient kan ligga på en annan klinik medan den egna behåller ansvaret. I FHIR är vårdtillfället ett Encounter med varje plats och tid.',
    expert: 'Vid flytt följer vårdtillfället och allt dokumenterat med, och nästa uppgift hamnar på den nya avdelningens kontakt. Systemet föreslår avdelning och orsak vid inskrivning och påminner om det som återstår vid utskrivning.',
    anmarkning: 'Vårdplatser och sängar är fritext. Det finns ingen beläggningsöversikt och ingen planerad flytt. Vistelser, händelser och platser på andra vårdenheter visas bara efter aktivt val, också för kliniken med det medicinska ansvaret.',
  },
  {
    id: '6.1.1.6', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VK}inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket`,
      `${VK}planerad kontakt på distans, och ankomsten registreras på den planerade`,
      `${VK}all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient`,
      // Runda 9, r7: hemsjukvård, dagkirurgi och faktisk besökstid (vardformer.js).
      'Vårdformer > utskrivning till hemsjukvård görs i ett steg, med föregående kontakt och samma hälsoärende',
      'Vårdformer > en dagkirurgisk kontakt där patienten blir kvar skrivs in i samma hälsoärende',
      'Vårdformer > den faktiska besökstiden registreras utan att kontakten avslutas',
      'Vårdformer > en dagkirurgisk kontakt eller uppföljning kan inte bakdateras eller läggas mer än ett år fram',
    ],
    losning: 'Öppenvård, akutbesök, slutenvård, hemsjukvård och dagkirurgi är samma slags vårdkontakt. Ett akutbesök eller en dagkirurgisk kontakt som leder till inskrivning blir den föregående kontakten, och utskrivningen till hemsjukvård eller öppenvård görs i ett steg med den nya kontakten i samma hälsoärende. För öppenvård, akutbesök, hemsjukvård och dagkirurgi registreras ankomsten och när besöket slutade, utan att kontakten avslutas, och systemet räknar besökstiden. Händelsekedjan för kontakten visar övergångarna mellan vårdformerna.',
    expert: 'Den som skriver ut väljer bara vårdformen som följer. Systemet fyller i typ, enhet, plats, orsak, föregående kontakt och hälsoärende, skapar ett hälsoärende om det saknas och föreslår första hembesöket till nästa vardag.',
    anmarkning: 'Figur 4 i kravspecifikationen ingår inte i textutdraget, så lösningen bygger på texten om vårdformsövergångar och faktisk besökstid. Hemsjukvården ligger på den vårdenhet som skrev ut patienten, och kommunal hemsjukvård är inte byggd.',
  },
];
