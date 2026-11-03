// Påhittade scheman, tider, bokningar, väntelista och bevakningar för tidboken (tidbok.js, Sussa 3.4.1 till 3.4.4).
// Allt är påhittat. Tiderna anges relativt till dagen då sandlådan skapas:
//   dag   dagar från i dag (arbetsdagar räknas inte, en lördag eller söndag flyttas till måndagen efter)
//   klocka svensk tid
//   min   minuter från nu, för dagens patienter, så att det alltid finns någon som väntas och någon som har kommit.

// Personal som bara finns i tidboken. HSA-id är påhittade.
export const TIDBOK_PERSONAL = [
  { id: 'lak-kard2', namn: 'Magnus Öberg', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-kard', hsa: 'SE2321000164-VKP201' },
  { id: 'ssk-kardmott', namn: 'Lina Persson', yrke: 'sjukskoterska', titel: 'Sjuksköterska (hjärtsviktssjuksköterska)', enhet: 'uso-kard-mott', hsa: 'SE2321000164-VKP202' },
];

// Ett schema per vårdgivare och mottagning. Mallen säger vilka tider som finns en vanlig dag.
const LAKARDAG = [
  ['08:00', 'nybesok'], ['09:00', 'nybesok'], ['10:00', 'aterbesok'], ['10:30', 'aterbesok'], ['11:00', 'aterbesok'],
  ['13:00', 'aterbesok'], ['13:30', 'video'], ['14:00', 'telefon'], ['14:15', 'telefon'], ['14:30', 'telefon'],
];
const SSKDAG = [
  ['08:30', 'aterbesok'], ['09:00', 'aterbesok'], ['09:30', 'aterbesok'], ['10:00', 'telefon'], ['10:15', 'telefon'],
  ['10:30', 'telefon'], ['10:45', 'telefon'], ['13:00', 'video'], ['13:30', 'video'], ['14:00', 'aterbesok'],
];
const VCDAG = [
  ['08:00', 'aterbesok'], ['08:30', 'aterbesok'], ['09:00', 'nybesok'], ['10:00', 'aterbesok'], ['13:00', 'telefon'],
  ['13:15', 'telefon'], ['13:30', 'video'], ['14:00', 'aterbesok'],
];
// veckodagar: 1 måndag till 5 fredag.
export const SCHEMAN = [
  { id: 'sch-kard-sara', enhet: 'uso-kard-mott', personal: 'lak-kard', yrkesroll: 'lakare', dagar: [1, 2, 3, 4, 5], mall: LAKARDAG },
  { id: 'sch-kard-magnus', enhet: 'uso-kard-mott', personal: 'lak-kard2', yrkesroll: 'lakare', dagar: [1, 3, 5], mall: LAKARDAG },
  { id: 'sch-kard-lina', enhet: 'uso-kard-mott', personal: 'ssk-kardmott', yrkesroll: 'sjukskoterska', dagar: [1, 2, 3, 4, 5], mall: SSKDAG },
  { id: 'sch-vc-per', enhet: 'vc-tybble', personal: 'lak-vc', yrkesroll: 'lakare', dagar: [1, 2, 4, 5], mall: VCDAG },
  { id: 'sch-vc-hanna', enhet: 'vc-tybble', personal: 'ssk-vc', yrkesroll: 'sjukskoterska', dagar: [1, 2, 3, 4, 5], mall: VCDAG },
];
// Så många dagar framåt tiderna läggs ut.
export const DAGAR_FRAMAT = 75;

// Vilka tidstyper patienten själv får boka, boka om och avboka i Min journal, per vårdenhet (demoregler).
export const EGENBOKNING = [
  { enhet: 'uso-kard', tidstyper: ['telefon', 'video'] },
  { enhet: 'vc-tybble', tidstyper: ['aterbesok', 'telefon', 'video'] },
];

// Patienternas val av kanal för kallelser. Saknas ett val väljer systemet själv (tidbok.js, kanalFor).
export const KANALVAL = [
  { patient: 'p08', kanal: 'brev' },
  { patient: 'p15', kanal: 'sms' },
];

// Dagens patienter och kommande bokningar. tid är { min } för i dag eller { dag, klocka } framåt.
export const BOKNINGAR = [
  // Dagens patienter på Kardiologiska mottagningen.
  // Barnet har kommit med sin vårdnadshavare och är incheckat. Barn betalar ingen avgift, så det registrerar systemet självt.
  { patient: 'p09', schema: 'sch-kard-sara', tidstyp: 'nybesok', tid: { min: -50 }, bokad: -14, bokadAv: 'adm-kard',
    kallelse: { dagar: -14, kanal: 'min_journal' }, paminnelse: true, incheckad: { min: -56, via: 'min_journal' } },
  { patient: 'p15', schema: 'sch-kard-lina', tidstyp: 'aterbesok', tid: { min: -25 }, bokad: -10, bokadAv: 'adm-kard',
    kallelse: { dagar: -10, kanal: 'sms' }, paminnelse: true },
  { patient: 'p08', schema: 'sch-kard-magnus', tidstyp: 'nybesok', tid: { min: 25 }, bokad: -9, bokadAv: 'adm-kard',
    kallelse: { dagar: -9, kanal: 'brev' }, paminnelse: true },
  // En telefontid som patienten själv kan boka om i Min journal.
  { patient: 'p14', schema: 'sch-kard-lina', tidstyp: 'telefon', tid: { dag: 6, klocka: '10:15' }, bokad: -1, bokadAv: 'adm-kard',
    kallelse: { dagar: -1, kanal: 'min_journal' } },
  // Hjärtskolan, en gruppträff. Kallelserna är skrivna men går ut först när vårdadministratören bekräftar att gruppen blir av.
  { patient: 'p01', schema: 'sch-kard-lina', tidstyp: 'grupp', tid: { dag: 9, klocka: '13:00' }, grupp: 'Hjärtskola', bokad: -2, bokadAv: 'adm-kard' },
  { patient: 'p04', schema: 'sch-kard-lina', tidstyp: 'grupp', tid: { dag: 9, klocka: '13:00' }, grupp: 'Hjärtskola', bokad: -2, bokadAv: 'adm-kard' },
  { patient: 'p10', schema: 'sch-kard-lina', tidstyp: 'grupp', tid: { dag: 9, klocka: '13:00' }, grupp: 'Hjärtskola', bokad: -2, bokadAv: 'adm-kard' },
  // Skyddade personuppgifter: kallelsen går bara till Min journal.
  { patient: 'p03', schema: 'sch-vc-hanna', tidstyp: 'aterbesok', tid: { dag: 8, klocka: '09:00' }, bokad: -3, bokadAv: null,
    kallelse: { dagar: -3, kanal: 'min_journal' } },
];
// Lediga tider i dag på kardiologen, utöver de bokade, så att dagens tidbok ser ut som en arbetsdag.
export const DAGENS_LEDIGA = [
  { schema: 'sch-kard-sara', tidstyp: 'aterbesok', min: 40 }, { schema: 'sch-kard-sara', tidstyp: 'telefon', min: 120 },
  { schema: 'sch-kard-lina', tidstyp: 'telefon', min: 60 }, { schema: 'sch-kard-magnus', tidstyp: 'aterbesok', min: 90 },
];
export const GRUPPER = [{ rubrik: 'Hjärtskola', schema: 'sch-kard-lina', tid: { dag: 9, klocka: '13:00' }, minuter: 120, platser: 8 }];

// Väntelistan. fran är när väntan började (dagar från i dag), mal är det datum som patienten senast ska ha fått tid.
export const VANTELISTA = [
  { patient: 'p01', enhet: 'uso-kard', tidstyp: 'aterbesok', yrkesroll: 'lakare', prioritet: 'hog', orsak: 'Återbesök efter vårdtillfället',
    onskad: 'lak-kard', fran: -3, mal: 10, skapadAv: 'lak-kard' },
  { patient: 'p04', enhet: 'uso-kard', tidstyp: 'telefon', yrkesroll: 'sjukskoterska', prioritet: 'normal', orsak: 'Telefonuppföljning efter vårdtillfället',
    onskad: 'ssk-kardmott', fran: -1, mal: 30, skapadAv: 'lak-kard' },
];

// Bevakningar som vårdadministratören har lagt upp. forfaller i dagar från i dag.
export const BEVAKNINGAR = [
  { patient: 'p10', enhet: 'uso-kard', text: 'Patienten vill bli uppringd om en tidigare tid blir ledig.', forfaller: -1, skapadAv: 'adm-kard' },
];
