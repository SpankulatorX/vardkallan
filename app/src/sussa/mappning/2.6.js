// Sussa 2.6 Innovationsrum för utveckling: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.

export default [
  { id: '2.6.1.1', kategori: 'leverantor', egna: ['M11'], tester: [], avsedd: 'planerat',
    anmarkning: 'Källkoden och dokumentationen är öppna på GitHub under EUPL 1.2. Utvecklarforum, utbildning och support finns inte.' },
  {
    id: '2.6.1.2', kategori: 'system', egna: ['M11', 'M12'], avsedd: 'delvis',
    tester: [
      'SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas',
      'SMART on FHIR > standalone launch: personen väljer patienten bland sina patienter på arbetslistan',
      'SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas',
      'Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget',
    ],
    losning: 'Innovationer byggs som externa tillämpningar med etablerade standarder: SMART on FHIR (EHR launch och standalone launch med OAuth 2.0 och PKCE) och FHIR R4, i valfritt programmeringsspråk. Tillämpningen registreras med sina omfång och visas i journalen. Källkoden är öppen under EUPL 1.2, och demotillämpningen Blodtryck över tid visar hur det går till.',
    expert: 'Plattformen sköter inloggning, patientkontext, behörighet och loggning, så den som bygger en tillämpning bara behöver läsa FHIR, och tillämpningen kan aldrig se mer än användaren.',
    anmarkning: 'Utvecklarforum, support, distribution och ett gränssnitt där administratören registrerar tillämpningar finns inte. Tillämpningarna registreras i koden (smart.js).',
  },
  { id: '2.6.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller innovationer som leverantören redan har genomfört.' },
];
