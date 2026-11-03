// Sussa 3.1.7 Nolltolerans för dubbeldokumentation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, M, MJ } = TEST;
const VK = 'Vårdkontakt > ';

export default [
  {
    id: '3.1.7.1', kategori: 'system', egna: ['D2', 'L7'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${MJ}FHIR för invånaren lämnar inte ut mer än Min journal`,
      `${VK}finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag`,
      `${VK}vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om`,
      `${VK}inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket`,
      `${VK}planerad kontakt på distans, och ankomsten registreras på den planerade`,
    ],
    losning: 'Varje uppgift registreras en gång och samma post används i översikten, Min journal, FHIR och överföringen till NLL. Vårdkontakten skapas när någon börjar dokumentera, ett vårdtillfälle följer med vid flytt utan att något registreras om, och orsaken från akutbesöket eller remissen följer med till inskrivningen och den nya kontakten.',
    expert: 'Systemet återanvänder det som redan finns: ordinationen skickas till NLL, kontakten skapas ur sammanhanget, akutbesökets orsak blir inskrivningens och ankomsten registreras på den planerade kontakten, så att ingenting skrivs två gånger.',
    anmarkning: 'Principen gäller de delar som är byggda. Flöden mellan vårdgivare och mot nationella tjänster finns inte, och NLL är simulerad.',
  },
];
