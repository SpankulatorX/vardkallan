// Vårdstrukturen i seeden utöver vårdkontakterna i patienter.js. Tider anges som där (relativt till när sandlådan skapas).
// Allt annat räknas fram av vardstruktur.js: varje slutenvårdskontakt blir ett vårdtillfälle, ett akutbesök som går
// direkt över i inskrivning knyts till den, och uppgifter som saknade vårdkontakt i källan får en.

// Sängbyten under ett pågående vårdtillfälle: patienten låg först på platsen fran och flyttades vid tid.
export const SANGBYTEN = [
  { patient: 'p01', enhet: 'uso-kard-72', fran: 'Avd 72, sal 6', tid: [-2, '16:30'] },
];

// Bekräftade hälsoärenden. kontakter anges med enhet och kontaktorsak.
export const HALSOARENDEN = [
  {
    patient: 'p11', rubrik: 'Hjärtklappning', enhet: 'vc-tybble', av: 'lak-vc', tid: [-30, '15:05'], grund: 'remiss',
    kontakter: [['vc-tybble', 'Hjärtklappning'], ['uso-kard-mott', 'Långtids-EKG']],
  },
];
