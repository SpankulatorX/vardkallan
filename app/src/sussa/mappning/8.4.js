// Sussa 8.4 Fokus på verksamhets- och patientnytta samt att stödja användarnas behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r2: posten för tillgänglighet (8.4.1.3) ersätts ur sussa/runda7-r2.js.
import { medR7r2 } from '../runda7-r2.js';
// Runda 7, r1: Sussas användbarhetstester (Bilaga F1:2 och F1:4) som automatiska tester (sussa-testfall.js).
import { TEST, TEST_REGISTER, KORNINGSTESTER } from '../../sussa-testfall.js';

const SUS = `${TEST}SUS-formuläret har de tio påståendena i Sussas formulering och poängen räknas med standardformeln`;
const EXPERT = `${TEST}expertgranskningen har de sju dialogprinciperna i ISO 9241-110 och summan omvandlas till utvärderingspoäng`;
const KLICKBUDGET = 'Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden';
const SVAR = 'Användartestens svar > ';
const SVARTESTER = [`${SVAR}sparas på servern med roll, pseudonym, datum, testfall och svar, och poängen räknas av servern`,
  `${SVAR}inga patientuppgifter eller namn: pseudonym med siffror som ett personnummer, kommentar med personnummer och okända fält avvisas`,
  `${SVAR}läsning och export kräver både testledarens roll och koden för just det tillfället, så att ingen ser andras tillfällen`,
  `${SVAR}skrivningen är begränsad per tillfälle och per session och minut, och ett fullt tillfälle stoppar bara sig självt`,
  `${SVAR}tillfällen utan aktivitet på 90 dagar raderas med sina svar`,
  `${SVAR}skapandet är begränsat per session och timme och per skapare, så att ingen kan fylla det globala taket`,
  `${SVAR}tomma tillfällen utan svar raderas efter 24 timmar och räknas då inte längre mot skaparen`];

const AVSNITT = [
  {
    id: '8.4.1.1', kategori: 'system', egna: ['K4', 'D6'], avsedd: 'delvis',
    tester: [...TEST_REGISTER, KLICKBUDGET, ...KORNINGSTESTER],
    losning: 'Varje ändring av gränssnittet mäts mot användarnas uppgifter innan den byggs in. Sussas 34 testfall från användbarhetstesterna av Cosmic spelas i gränssnittet med rätt roll, och skriptet kontrollerar slutvillkoret, räknar klick och tecken och uppskattar tiden för en människa, med samma poäng som när Cosmic utvärderades. Varje vanligt flöde har en klickbudget som mäts på samma sätt. Ett testfall eller flöde som går över budgeten eller inte når sitt mål stoppar mätningen.',
    expert: 'Systemet mäter sin egen användbarhet vid varje ändring och säger vilket testfall som inte klaras och varför, så att ingen behöver minnas att testa.',
    anmarkning: 'Processen är Vårdkällans egen: testfallen och klickbudgeten är automatiska, men användartester med personer som arbetar i vården är inte gjorda. 16 av Sussas 34 testfall kan inte genomföras än, och vad som saknas står per testfall på kravsidan under K4. Tidsklassen per testfall är Vårdkällans bedömning, eftersom Sussa aldrig lämnade ut den. Tillgängligheten prövas bara delvis (tangentbord och 360 pixlars bredd i genomgången).',
  },
  {
    id: '8.4.1.2', kategori: 'system', egna: ['K4', 'D6'], avsedd: 'delvis',
    tester: [TEST_REGISTER[0], TEST_REGISTER[5], SUS, EXPERT, ...SVARTESTER, ...KORNINGSTESTER],
    losning: 'Användarcentrerad design enligt ISO 9241-210 i fyra steg: användarna och deras uppgifter är Sussas sju användargrupper och 34 testfall, målen är klickbudgeten och Sussas slutvillkor och tidsklasser, lösningarna prövas i demon, och utvärderingen görs med samma fyra mätningar som Sussa använde: måluppfyllelse och effektivitet mäts automatiskt för varje testfall, och för riktiga testpersoner finns SUS-formuläret med Sussas formulering och en checklista för expertgranskning mot de sju dialogprinciperna i ISO 9241-110, med poängen enligt Bilaga F1:2. Svaren sparas på servern utan patientuppgifter och utan namn, bara roll, pseudonym, datum, testfall och svar, knutna till ett testtillfälle. Testledaren skapar tillfället och får en slumpad kod som visas en gång, och läsning, export och radering kräver både testledarens roll och koden. Ett tillfälle tar emot högst 200 svar, en skapare har högst 20 aktiva tillfällen, och ett tillfälle raderas efter 24 timmar utan svar eller 90 dagar efter det senaste svaret.',
    expert: 'Systemet räknar poängen för varje mätning och omvandlar dem till Sussas utvärderingspoäng, så att testledaren inte behöver kunna formlerna, och formulären sparar inga patientuppgifter.',
    anmarkning: 'SUS och expertgranskning är underlag för riktiga användartester senare: inga testpersoner har fyllt i formulären än, och ingen användbarhetsexpert har granskat systemet. Kartläggningen av användarna bygger på Sussas testfall, inte på egna intervjuer eller observationer. Skisser och prototyper i flera alternativ görs inte.',
  },
  { id: '8.4.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Användbarhet och tillgänglighet är inte byggt ännu (runda 7)." },
];
export default medR7r2(AVSNITT);
