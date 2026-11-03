// Sussa 3.1.7 Nolltolerans för dubbeldokumentation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, M, MJ } = TEST;

export default [
  {
    id: '3.1.7.1', kategori: 'system', egna: ['D2', 'L7'], avsedd: 'delvis',
    tester: [
      `${M}NLL: normal överföring kvitteras`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${MJ}FHIR för invånaren lämnar inte ut mer än Min journal`,
    ],
    losning: 'Varje uppgift registreras en gång och samma post används i översikten, Min journal, FHIR och överföringen till NLL.',
    expert: 'Systemet återanvänder det som redan finns: ordinationen skickas till NLL och patienten ser samma uppgift i Min journal utan att något skrivs två gånger.',
    anmarkning: 'Principen gäller de delar som är byggda. Flöden mellan vårdgivare och mot nationella tjänster finns inte, och NLL är simulerad.',
  },
];
