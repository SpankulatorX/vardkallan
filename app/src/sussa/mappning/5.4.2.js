// Sussa 5.4.2 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

export default [
  { id: '5.4.2.1', kategori: 'system', egna: ['M12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Export till e-arkiv är inte byggd. FHIR-API:t lämnar ut uppgifter per patient, men inte som ett arkivpaket.' },
  { id: '5.4.2.2', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Åtkomst till mellanarkiv är inte byggd.' },
  { id: '5.4.2.3', kategori: 'system', egna: ['M12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '5.4.2.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gallring är inte byggd.' },
];
