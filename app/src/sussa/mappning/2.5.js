// Sussa 2.5 Öppna gränssnitt: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, F, FS, MJ } = TEST;

export default [
  {
    id: '2.5.1.1', kategori: 'system', egna: ['D9', 'M12'], avsedd: 'delvis',
    tester: [
      `${F}metadata är ett CapabilityStatement`,
      `${F}sökning ger Bundle searchset`,
      `${A}FHIR via HTTP har application/fhir+json och kräver inloggning`,
    ],
    losning: 'Öppet FHIR R4-API under /fhir med samma behörighet och loggning som gränssnittet, och ett JSON-API för gränssnittet. Koden är öppen under EUPL 1.2.',
    expert: 'Integrationsgränssnittet följer samma behörighet som användaren, så en extern tillämpning kan aldrig se mer än den inloggade har rätt till.',
    anmarkning: 'FHIR-API:t går bara att läsa. Att gränssnittet hålls aktuellt under en avtalstid är ett åtagande som inte finns.',
  },
  {
    id: '2.5.1.2', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${F}sökning ger Bundle searchset`,
      `${F}FHIR följer samma behörighet: nekad utan vårdrelation`,
      `${F}FHIR följer inre sekretess och spärr`,
      `${F}FHIR-anrop loggas`,
    ],
    losning: 'Externa tillämpningar kan läsa och söka med FHIR R4 och får samma behörighet, inre sekretess, spärr och loggning som gränssnittet.',
    expert: 'Behörigheten avgörs på servern för varje anrop, så den som bygger en extern tillämpning behöver inte själv bygga in patientdatalagens regler.',
    anmarkning: 'Bara läsning och sökning. Skrivande, prenumerationer och meddelanden mellan system saknas.',
  },
  {
    id: '2.5.1.3', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${F}Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form`,
      `${F}MedicationRequest använder ATC och har uppföljningsdatum`,
      `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`,
      `${MJ}FHIR med patientens session: egna resurser och $everything, inget annat`,
    ],
    losning: 'Patient, vårdkontakter, diagnoser, mätvärden, läkemedel, överkänslighet, remisser, anteckningar, enheter, personal och åtkomstloggen finns som FHIR R4-resurser.',
    expert: 'Samma data visas i gränssnittet och i API:t, så ingen behöver föra över uppgifter för hand till en annan tillämpning.',
    anmarkning: 'Att allt användaren kan göra i gränssnittet också går att göra via API är inte testat, och skrivande via FHIR saknas.',
  },
];
