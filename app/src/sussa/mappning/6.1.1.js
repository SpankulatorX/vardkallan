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
    ],
    losning: 'Varje anteckning, diagnos, mätvärde, ordination och remiss hör till en vårdkontakt, också den migrerade historiken. En vårdkontakt kan öppnas med allt som hör till den, och översikten och tidslinjen kan visas per vårdkontakt och vårdtillfälle. I FHIR pekar resurserna på sitt Encounter.',
    expert: 'Den som dokumenterar väljer aldrig en vårdkontakt. Systemet knyter uppgiften till den pågående kontakten, och finns ingen skapar det en med typ och enhet ur sammanhanget och visar den med möjlighet att ändra.',
    anmarkning: 'Överkänslighet är uppmärksamhetsinformation om patienten och hör inte till en enskild vårdkontakt. Historik som saknade vårdkontakt i källan har fått en kontakt per vårdenhet och dag, märkt som skapad av systemet. Den räknas inte som överförd i migreringsavstämningen.',
  },
  {
    id: '6.1.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      `${VK}hälsoärende föreslås ur samma diagnos och bekräftas med ett klick`,
      `${VK}hälsoärende föreslås ur en remisskedja`,
      `${VK}förslagen bygger bara på kontakter som användaren får se, och ett förslag kan avvisas`,
      `${VK}seedens hälsoärende håller samman remisskedjan för patient 11`,
      flode('halsoarende'),
    ],
    losning: 'Hälsoärenden håller samman vårdkontakter över tid och vårdenheter. Systemet föreslår ärenden ur samma diagnos, en remisskedja och övergångar mellan vårdformer, och användaren bekräftar med ett klick eller avvisar förslaget. Nya kontakter i samma vårdtillfälle och efter ett akutbesök följer med ärendet. I FHIR är hälsoärendet EpisodeOfCare.',
    expert: 'Systemet ser vilka kontakter som hör ihop och föreslår ärendet med skälet utskrivet. Användaren behöver aldrig själv leta upp och koppla ihop kontakter.',
    anmarkning: 'Ett ärende kan inte avslutas, delas eller slås ihop med ett annat, och en kontakt kan inte flyttas mellan ärenden. Figur 2 och 3 i kravspecifikationen ingår inte i utdraget.',
  },
  {
    id: '6.1.1.3', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [`${VK}ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt`],
    losning: 'Vårdkontakten är det gemensamma id:t mot andra system: i FHIR pekar Observation, MedicationRequest, ServiceRequest och Composition på sitt Encounter, och vårdkontakterna pekar på vårdtillfälle och hälsoärende. Överföringen till den simulerade NLL hör till ordinationen och därmed till vårdkontakten.',
    expert: 'Kopplingen sätts av systemet när uppgiften sparas, så ett kringsystem kan para ihop sina data med journalen utan att någon anger ett process-id.',
    anmarkning: 'Inga riktiga kringsystem är anslutna, och händelser i kringsystem kan inte läsas tillbaka och följas i Vårdkällan.',
  },
  {
    id: '6.1.1.4', kategori: 'system', egna: ['D1'], avsedd: 'delvis',
    tester: [
      `${R}statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat`,
      `${VK}hälsoärende föreslås ur en remisskedja`,
    ],
    losning: 'Remissen är en subprocess med tidpunkt för varje steg, från skickad till kvitterat svar, och den är knuten till kontakten som skickade den och till kontakten hos mottagaren som var svaret på den.',
    expert: 'Systemet bevakar stegen och larmar när ett steg uteblir, och knyter mottagarens nya kontakt till remissen utan att någon gör det själv.',
    anmarkning: 'Målvärden för ledtider och uppföljning per subprocess är inte byggda. Provhantering finns inte.',
  },
  {
    id: '6.1.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VK}vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om`,
      `${VK}medicinskt ansvar följer med vid flytt till en annan klinik, eller stannar kvar`,
      `${VK}inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket`,
      `${VK}utskrivningen avslutar vårdtillfället och påminner om osignerade anteckningar och epikris`,
      `${VK}FHIR: Encounter med vårdtillfälle, kontaktsätt och hälsoärende, och EpisodeOfCare med samma behörighet`,
      flode('inskrivning'), flode('flytta'), flode('utskrivning'),
    ],
    losning: 'Ett vårdtillfälle håller samman vistelserna på de avdelningar patienten ligger på, med inskrivning, sektions-, avdelnings- och klinikbyten, sängbyten, permission och utskrivning som händelser som inte kan ändras. Medicinskt ansvar och produktionsansvar hålls isär, så att en patient kan ligga på en annan klinik medan den egna behåller ansvaret. I FHIR är vårdtillfället ett Encounter med varje plats och tid.',
    expert: 'Vid flytt följer vårdtillfället och allt dokumenterat med, och nästa uppgift hamnar på den nya avdelningens kontakt. Systemet föreslår avdelning och orsak vid inskrivning och påminner om det som återstår vid utskrivning.',
    anmarkning: 'Vårdplatser och sängar är fritext. Det finns ingen beläggningsöversikt och ingen planerad flytt.',
  },
  {
    id: '6.1.1.6', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      `${VK}inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket`,
      `${VK}planerad kontakt på distans, och ankomsten registreras på den planerade`,
      `${VK}all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient`,
    ],
    losning: 'Öppenvård, akutbesök och slutenvård är samma slags vårdkontakt. Ett akutbesök som leder till inskrivning blir den föregående kontakten i vårdtillfället, och för en planerad kontakt registreras den faktiska ankomsttiden.',
    expert: 'Systemet avslutar akutbesöket och knyter det till inskrivningen, och registrerar ankomsten på den planerade kontakten när patienten kommer, så att ingen behöver registrera samma sak två gånger.',
    anmarkning: 'Figur 4 i kravspecifikationen ingår inte i utdraget. Övergångar från slutenvård till öppenvård, som hemsjukvård och dagkirurgi, är inte byggda, och den faktiska sluttiden för ett besök registreras bara när kontakten avslutas.',
  },
];
