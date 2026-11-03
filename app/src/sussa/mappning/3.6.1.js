// Sussa 3.6.1 Kommunikation och integrationer med medicinteknisk utrustning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

export default [
  { id: '3.6.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Kommunikation med medicinteknisk utrustning är inte byggd.' },
  { id: '3.6.1.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.6.1.3', kategori: 'leverantor', egna: ['D9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gränssnitt mot medicinteknisk utrustning finns inte. FHIR-API:t och dess profiler är dokumenterade i docs/fhir-validering.md.' },
  { id: '3.6.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.6.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.6.1.6', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.6.1.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Mätvärden från patientens egna mätningar tas inte emot.' },
];
