// Sussa 3.1.1 Identifikation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { F, S } = TEST;

export default [
  {
    id: '3.1.1.1', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${F}Patient har personnummer med rätt identifier-system`,
      `${S}personnummer kommer från Skatteverkets testpersonnummer`,
      `${S}kön stämmer med näst sista siffran`,
    ],
    losning: 'Svenskt personnummer är patientens identitet i hela systemet och i FHIR, med HL7 Swedens identifier-system.',
    expert: 'Systemet visar personnumret i samma form i alla vyer och i FHIR, så användaren behöver aldrig välja identitetstyp eller skrivsätt.',
    anmarkning: 'Reservnummer, samordningsnummer och OID-nummer saknas.',
  },
  { id: '3.1.1.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Sammanslagning av tidigare identiteter med senast gällande identitet är inte byggd.' },
  {
    id: '3.1.1.3', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${F}Patient har personnummer med rätt identifier-system`,
      `${S}personnummer kommer från Skatteverkets testpersonnummer`,
    ],
    losning: 'Personnummer finns och används för sökning, visning och FHIR.',
    expert: 'Sökningen hittar patienten på personnummer eller namn i samma fält, och systemet avgör självt vilket det är.',
    anmarkning: 'Reservnummer, samordningsnummer och OID-nummer saknas.',
  },
  { id: '3.1.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
];
