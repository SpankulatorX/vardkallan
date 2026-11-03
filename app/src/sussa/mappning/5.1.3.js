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
      // Runda 6, r1: eGFR med LOINC och åtgärder med KVÅ.
      'Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning',
      'Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie',
      'Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet',
    ],
    losning: 'ICD-10-SE för diagnoser, ATC och NPL-id för läkemedel, NPU för labb, LOINC för vitalparametrar, skalor och eGFR, KVÅ för åtgärder och UCUM för enheter, kontrollerade mot källorna (docs/kodkontroll.md).',
    expert: 'Systemet sätter koden själv utifrån det användaren gör: en NEWS2-kontroll blir KVÅ QD008, en GCS-bedömning PA001 och en läkemedelsgenomgång XV015, och eGFR räknas ur kreatininet. Ingen behöver kunna kodverken.',
    anmarkning: 'Snomed CT och egna kodverk från verksamheten saknas. Kodverken uppdateras för hand i koden, inte med ett verktyg för förvaltning över tid.',
  },
];
