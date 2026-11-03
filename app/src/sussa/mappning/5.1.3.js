// Sussa 5.1.3 Gemensam informationsstruktur: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { F, KV, FS } = TEST;

export default [
  { id: '5.1.3.1', kategori: 'system', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Nationell informationsstruktur är inte inbyggd. Informationen följer FHIR R4 och HL7 Swedens basprofiler.' },
  { id: '5.1.3.2', kategori: 'system', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Nationellt fackspråk med Snomed CT är inte inbyggt.' },
  { id: '5.1.3.3', kategori: 'system', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '5.1.3.4', kategori: 'system', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Snomed CT saknas.' },
  {
    id: '5.1.3.5', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`,
      `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
      `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
      `${F}Condition använder ICD-10-SE`,
      `${FS}Condition och MedicationRequest har display ur kodverket`,
    ],
    losning: 'ICD-10-SE för diagnoser, ATC och NPL-id för läkemedel, NPU för labb, LOINC för vitalparametrar och UCUM för enheter, kontrollerade mot källorna.',
    expert: 'Systemet sätter koden själv utifrån det användaren väljer, så ingen behöver kunna kodverken.',
    anmarkning: 'KVÅ, Snomed CT och egna kodverk från verksamheten saknas, och eGFR saknar kod.',
  },
];
