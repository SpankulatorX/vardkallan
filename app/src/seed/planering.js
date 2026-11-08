// Påhittade resurser, ingrepp, bokningsmallar, väntande poster, transportbehov och språkval för planeringen i tidboken
// (planering-bas.js och planering.js, runda 6, r4, Sussa 3.4.1 till 3.4.3). Allt är påhittat och märkt som demo där det
// behövs. Tiderna anges som i seed/tidbok.js: dag är dagar från i dag (en helgdag flyttas till måndagen efter), klocka
// är svensk tid.

// Resursernas kategorier. typ är lokal, utrustning eller transport. marginal är hur många minuter före och efter tiden
// som resursen behövs (en sjukresa hämtar före och kör hem efter, demoregel).
export const KATEGORIER = {
  behandlingsrum: { text: 'Behandlingsrum', typ: 'lokal', marginal: 0 },
  defibrillator: { text: 'Defibrillator', typ: 'utrustning', marginal: 0 },
  transport: { text: 'Sjukresa', typ: 'transport', marginal: 60 },
};
export const RESURSTYP = { lokal: 'Lokal', utrustning: 'Utrustning', transport: 'Transport' };

// Resurserna på Kardiologiska mottagningen. Mottagningen har två behandlingsrum men bara en defibrillator, så två
// ingrepp samtidigt går inte även om två läkare har tid. Sjukresan är simulerad.
export const RESURSER = [
  { id: 'res-kard-beh1', enhet: 'uso-kard-mott', kategori: 'behandlingsrum', namn: 'Behandlingsrum 1' },
  { id: 'res-kard-beh2', enhet: 'uso-kard-mott', kategori: 'behandlingsrum', namn: 'Behandlingsrum 2' },
  { id: 'res-kard-defib', enhet: 'uso-kard-mott', kategori: 'defibrillator', namn: 'Defibrillator, mobil' },
  { id: 'res-kard-resa', enhet: 'uso-kard-mott', kategori: 'transport', namn: 'Sjukresa (simulerad)', demo: true },
];

// Ingrepp av tidstypen ingrepp. krav är de resurser som ingreppet behöver utöver personalen. Förberedelserna är
// exempel i demon, inte någon vårdenhets rutin.
export const INGREPP = {
  elkonvertering: {
    text: 'Elkonvertering', textEn: 'Electrical cardioversion', tidstyp: 'ingrepp', yrkesroll: 'lakare', krav: ['behandlingsrum', 'defibrillator'],
    forberedelse: 'Ät och drick inget de sista sex timmarna före tiden. Ta dina vanliga läkemedel med lite vatten om inget annat har sagts. Du får inte köra bil samma dag.',
    forberedelseEn: 'Do not eat or drink for six hours before the appointment. Take your usual medicines with a little water unless you have been told otherwise. You must not drive on the same day.',
  },
};

// Bokningsmallar med tider i följd. fore är tiden före huvudbesöket, som systemet bokar samma dag med rätt mellanrum:
// den ska sluta minst minMin och högst maxMin minuter före huvudbesöket. tidstyper är huvudbesökets tidstyper.
export const MALLAR = {
  'provtagning-fore': {
    namn: 'Provtagning före läkarbesök', enhet: 'uso-kard', tidstyper: ['aterbesok', 'nybesok'],
    fore: { tidstyp: 'provtagning', yrkesroll: 'sjukskoterska', minMin: 60, maxMin: 150 },
    forklaring: 'Provtagningen bokas samma dag, så att den är klar mellan en och två och en halv timme före läkarbesöket. Då hinner svaren komma.',
  },
};

// Personal och schema för provtagningen på mottagningen. HSA-id är påhittat.
export const PROVTAGNING_PERSONAL = { id: 'ssk-kardlab', namn: 'Eva Lindgren', yrke: 'sjukskoterska', titel: 'Sjuksköterska (provtagning)', enhet: 'uso-kard-mott', hsa: 'SE2321000164-VKP203' };
const kvartar = (fran, till) => {
  const ut = [];
  for (let m = fran; m <= till; m += 15) ut.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return ut;
};
export const PROVTAGNING_SCHEMA = { id: 'sch-kard-prov', enhet: 'uso-kard-mott', personal: 'ssk-kardlab', yrkesroll: 'sjukskoterska', dagar: [1, 2, 3, 4, 5],
  klockor: [...kvartar(7 * 60 + 30, 11 * 60 + 45), ...kvartar(12 * 60 + 30, 14 * 60 + 15)] };
// Ingreppstider i läkarnas scheman, de dagar schemat gäller.
export const INGREPPSTIDER = [{ schema: 'sch-kard-sara', klocka: '15:00' }, { schema: 'sch-kard-magnus', klocka: '15:00' }];

// Resurser som är upptagna utan en bokning, till exempel service. dag och klocka som ovan.
export const RESURS_UPPTAGEN = [
  { resurs: 'res-kard-defib', dag: 3, fran: '07:00', till: '18:00', text: 'Service av defibrillatorn' },
];

// Poster på väntelistan som behöver resurser eller tider i följd. fran och mal i dagar från i dag.
export const VANTELISTA = [
  { patient: 'p14', enhet: 'uso-kard', tidstyp: 'ingrepp', yrkesroll: 'lakare', ingrepp: 'elkonvertering', prioritet: 'normal',
    orsak: 'Elkonvertering vid förmaksflimmer', fran: -6, mal: 28, skapadAv: 'lak-kard' },
  { patient: 'p01', enhet: 'uso-kard', tidstyp: 'aterbesok', yrkesroll: 'lakare', mall: 'provtagning-fore', prioritet: 'normal',
    orsak: 'Återbesök efter elkonverteringen', onskad: 'lak-kard', fran: -1, mal: 45, skapadAv: 'lak-kard' },
];

// Patienter som behöver sjukresa till fysiska besök. Sjukresan bokas av systemet och är simulerad.
export const TRANSPORTBEHOV = [
  { patient: 'p14', text: 'Behöver sjukresa hem efter ingreppet och kan inte köra bil (demo).' },
];

// Patienternas språk för kallelser. Saknas ett val skrivs kallelsen på svenska.
export const SPRAKVAL = [{ patient: 'p11', sprak: 'en' }];

// Egna bevakningar som personalen har lagt upp. ansvarig null betyder hela vårdenheten.
export const EGNA_BEVAKNINGAR = [
  { enhet: 'uso-kard', patient: null, text: 'Gå igenom väntelistan inför nästa månad.', datum: 0, ansvarig: null, skapadAv: 'adm-kard' },
  { enhet: 'uso-kard', patient: 'p01', text: 'Kontrollera att provsvaren har kommit före återbesöket.', datum: 2, ansvarig: 'lak-kard', skapadAv: 'lak-kard' },
];

// Vårdenheten som tar emot egna vårdbegäranden från Min journal (runda 6, r4, remiss-r4.js). Står här så att
// masterdatans filadapter (masterdata.js) har den med.
export const MIN_JOURNAL_ENHET = { id: 'min-journal', hsa: 'DEMO-MINJOURNAL', namn: 'Egen vårdbegäran via Min journal', kortnamn: 'Min journal', typ: 'etjanst' };
// Runda 8, r2: avsändaren av en pappersremiss från en vårdgivare utanför Vårdkällan (remiss-r8.js).
export const EXTERN_ENHET = { id: 'extern', hsa: 'DEMO-EXTERN', namn: 'Vårdgivare utanför Vårdkällan', kortnamn: 'Extern', typ: 'extern' };
