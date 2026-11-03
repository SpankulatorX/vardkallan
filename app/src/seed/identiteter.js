// Påhittade patienter för identiteterna i Sussa 3.1.1: samordningsnummer, reservnummer, annan identitet med OID och en
// dubblett att slå samman. Samma form som seed/patienter.js, med identiteten i ett av fälten
//   pnr           personnummer ur Skatteverkets testpersonnummer
//   samnr         samordningsnummer ur Skatteverkets testsamordningsnummer
//   reservnummer  Vårdkällans påhittade reservnummer för demon (se src/identitet.js)
//   oid           { rot, nummer }: en identitet i ett påhittat id-system under demons OID-rot, med fodd och kon
// tidigare är identiteter som patienten har haft, med tider som i seeden.

export const IDENTITETSPATIENTER = [
  // 16. Annika Holmgren med personnummer, listad på Vårdcentralen Kumla. Samma person som 17.
  {
    id: 'p16', pnr: '196505092962', fornamn: 'Annika', efternamn: 'Holmgren',
    adress: 'Hagendalsvägen 7', postnr: '692 33', ort: 'Kumla', telefon: '070-174 06 31',
    kontaktperson: 'Make Göran Holmgren, 070-174 06 32', listning: { enhet: 'vc-kumla', fran: '1998-03-01' },
    vardkontakter: [
      { ref: 'vc1', enhet: 'vc-kumla', typ: 'oppenvard', start: [-420, '09:00'], slut: [-420, '09:30'], plats: 'Mottagning', orsak: 'Högt blodtryck' },
      { ref: 'vc2', enhet: 'vc-kumla', typ: 'oppenvard', start: [-90, '13:00'], slut: [-90, '13:20'], plats: 'Mottagning', orsak: 'Hjärtklappning' },
    ],
    diagnoser: [
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-kumla', vk: 'vc1', datum: -420, typ: 'huvud' },
      { kod: 'R00.2', text: 'Hjärtklappning', enhet: 'vc-kumla', vk: 'vc2', datum: -90, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc1', av: 'lak-kumla', tid: [-420, '09:25'], sokord: {
        'Kontaktorsak': 'Förhöjt blodtryck vid kontroll på apoteket.',
        'Status': 'Blodtryck 158/96 och 154/94. Hjärta och lungor utan anmärkning.',
        'Åtgärd': 'Insätter amlodipin 5 mg. Kontroll om fyra veckor.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc2', av: 'lak-kumla', tid: [-90, '13:15'], sokord: {
        'Kontaktorsak': 'Episoder med snabb oregelbunden hjärtrytm de senaste veckorna.',
        'Status': 'EKG visar sinusrytm 72. Blodtryck 132/84.',
        'Bedömning': 'Misstänkt paroxysmalt förmaksflimmer.',
        'Åtgärd': 'Långtids-EKG beställt. Söker akut vid ihållande hjärtklappning.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc2', av: 'lak-kumla', tid: [-70, '16:00'], sokord: {
        'Aktuellt': 'Svar på långtids-EKG: korta episoder av förmaksflimmer, längsta 20 minuter.',
        'Bedömning': 'Paroxysmalt förmaksflimmer. Telefonkontakt med patienten.',
        'Åtgärd': 'Remiss till kardiologen övervägs vid fler episoder.',
      } },
    ],
    matvarden: [
      ['blodtryck', 'vc-kumla', [[[-420, '09:05'], '158/96'], [[-90, '13:05'], '132/84']]],
      ['puls', 'vc-kumla', [[[-90, '13:05'], 72]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0015', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hypertoni', uppfoljning: 60, start: -420, enhet: 'vc-kumla', av: 'lak-kumla' },
    ],
  },

  // 17. Samma person som 16, registrerad på akuten med reservnummer när hon kom in utan legitimation och identiteten
  // inte gick att styrka. Namn och födelsedatum lämnades muntligt. Inlagd på avdelning 72. Systemet föreslår att
  // journalerna slås samman (samma namn, födelsedatum och kön).
  {
    id: 'p17', reservnummer: 'VK196505090023', fornamn: 'Annika', efternamn: 'Holmgren',
    adress: null, postnr: null, ort: null, telefon: null, kontaktperson: null,
    vardkontakter: [
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-1, '22:40'], slut: [0, '02:10'], plats: 'Akutrum 3', orsak: 'Hjärtklappning' },
      { ref: 'avd', enhet: 'uso-kard-72', typ: 'slutenvard', start: [0, '02:20'], plats: 'Sal 4, säng 2', orsak: 'Förmaksflimmer' },
    ],
    diagnoser: [
      { kod: 'I48.0', text: 'Paroxysmalt förmaksflimmer', enhet: 'uso-kard', vk: 'avd', datum: 0, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-1, '23:30'], sokord: {
        'Kontaktorsak': 'Hjärtklappning sedan tre timmar. Kom utan legitimation, registrerad med reservnummer.',
        'Status': 'EKG: förmaksflimmer med kammarfrekvens 138. Blodtryck 124/80.',
        'Bedömning': 'Förmaksflimmer med snabb kammarfrekvens.',
        'Åtgärd': 'Metoprolol. Läggs in på kardiologen.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'uso-kard', vk: 'avd', av: 'lak-kard', tid: [0, '02:50'], sokord: {
        'Kontaktorsak': 'Förmaksflimmer med snabb kammarfrekvens.',
        'Anamnes': 'Uppger högt blodtryck som behandlas på vårdcentralen. Minns inte namnet på medicinen.',
        'Bedömning': 'Frekvensreglering och antikoagulation enligt CHA2DS2-VASc 2.',
        'Åtgärd': 'Metoprolol och apixaban. Läkemedelslista från vårdcentralen behövs.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-kard-72', vk: 'avd', av: 'ssk-kard', tid: [0, '03:10'], sokord: {
        'Andning/cirkulation': 'Puls 112 oregelbunden. Telemetri kopplad.',
        'Psykosocialt': 'Orolig. Maken är meddelad.',
        'Planering': 'Kontrollera identiteten när legitimation finns.',
      } },
    ],
    matvarden: [
      ['puls', 'uso-akut', [[[-1, '22:45'], 138]]],
      ['blodtryck', 'uso-akut', [[[-1, '22:45'], '124/80']]],
      ['puls', 'uso-kard-72', [[[0, '03:00'], 112]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0008', dosering: '1 tablett morgon och kväll', dos: 50, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Förmaksflimmer, frekvensreglering', uppfoljning: 3, start: 0, enhet: 'uso-kard', av: 'lak-kard' },
      { lm: 'VK-NPL-0002', dosering: '1 tablett morgon och kväll', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Förmaksflimmer, strokeprofylax', uppfoljning: 30, start: 0, enhet: 'uso-kard', av: 'lak-kard' },
    ],
  },

  // 18. Säsongsarbetare med samordningsnummer, listad på Vårdcentralen Tybble. Fick först ett reservnummer på akuten,
  // innan samordningsnumret fanns. Reservnumret finns kvar som tidigare identitet.
  {
    id: 'p18', samnr: '199302862397', fornamn: 'Marek', efternamn: 'Zieliński',
    adress: 'Ekersvägen 22', postnr: '703 54', ort: 'Örebro', telefon: '070-174 06 33',
    kontaktperson: null, listning: { enhet: 'vc-tybble', fran: -300 },
    tidigare: [{ reservnummer: 'VK199302260112', fran: [-400, '15:10'], till: [-310, '10:00'], orsak: 'ersatt av samordningsnummer' }],
    vardkontakter: [
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-400, '15:00'], slut: [-400, '19:30'], plats: 'Akutrum 7', orsak: 'Andningsbesvär' },
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-60, '10:00'], slut: [-60, '10:30'], plats: 'Mottagning', orsak: 'Astma' },
    ],
    diagnoser: [
      { kod: 'J45.9', text: 'Astma, ospecificerad', enhet: 'vc-tybble', vk: 'vc1', datum: -60, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-400, '15:40'], sokord: {
        'Kontaktorsak': 'Andnöd efter arbete i växthus. Har inget svenskt personnummer eller samordningsnummer.',
        'Status': 'Pip i båda lungorna. Saturation 93 procent. PEF 280.',
        'Bedömning': 'Astmaanfall.',
        'Åtgärd': 'Salbutamol i inhalator. Förbättrad. Remiss till vårdcentral.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-60, '10:25'], sokord: {
        'Kontaktorsak': 'Uppföljning av astma.',
        'Status': 'Inga biljud. PEF 450.',
        'Bedömning': 'Astma, behandlingen fungerar.',
        'Åtgärd': 'Fortsätter med budesonid och salbutamol vid behov. Ny kontroll om ett år.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'ssk-vc', tid: [-60, '10:05'], sokord: {
        'Andning/cirkulation': 'PEF 450. Inhalationsteknik kontrollerad och bra.',
        'Planering': 'Astmaskola erbjuden.',
      } },
    ],
    matvarden: [
      ['pef', 'uso-akut', [[[-400, '15:10'], 280]]],
      ['saturation', 'uso-akut', [[[-400, '15:10'], 93]]],
      ['pef', 'vc-tybble', [[[-60, '10:05'], 450]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0039', dosering: '1 inhalation morgon och kväll', dos: 200, dosEnhet: 'mikrog', tider: ['08', '20'], typ: 'staende', orsak: 'Astma', uppfoljning: 305, start: -60, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0038', dosering: '1 till 2 doser vid andnöd', dos: 0.1, dosEnhet: 'mg', vidBehov: true, typ: 'vid_behov', orsak: 'Astma', uppfoljning: 305, start: -60, enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 19. Turist som identifieras med en utländsk identitet i ett påhittat id-system med OID. Akutbesök och återbesök på
  // ortopeden efter en knäskada.
  {
    id: 'p19', oid: { rot: '1.3.6.1.4.1.32473.1.2', nummer: 'UT-4471-0921' }, fodd: '1988-03-14', kon: 'kvinna',
    fornamn: 'Ingrid', efternamn: 'Haugen', adress: null, postnr: null, ort: null, telefon: '070-174 06 34', kontaktperson: null,
    vardkontakter: [
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-5, '14:00'], slut: [-5, '17:00'], plats: 'Akutrum 2', orsak: 'Knäskada' },
      { ref: 'ort', enhet: 'uso-ort', typ: 'oppenvard', start: [-1, '09:00'], slut: [-1, '09:30'], plats: 'Ortopedmottagningen', orsak: 'Återbesök knä' },
    ],
    diagnoser: [
      { kod: 'S83.5', text: 'Distorsion engagerande knäets (främre) (bakre) korsband', enhet: 'uso-ort', vk: 'ort', datum: -1, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-5, '15:00'], sokord: {
        'Kontaktorsak': 'Vred höger knä vid vandring. På semester i Sverige. Identifieras med sin utländska identitetshandling.',
        'Status': 'Svullet knä, positivt Lachmans test. Röntgen utan fraktur.',
        'Bedömning': 'Misstänkt främre korsbandsskada.',
        'Åtgärd': 'Ortos och kryckor. Återbesök på ortopeden.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-akut', vk: 'akut', av: 'ssk-akut', tid: [-5, '14:20'], sokord: {
        'Smärta': 'Skattar smärtan till 6 av 10.',
        'Planering': 'Kylning och högläge. Smärtlindring ordinerad.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-ort', vk: 'ort', av: 'lak-ort', tid: [-1, '09:25'], sokord: {
        'Kontaktorsak': 'Återbesök efter knäskada.',
        'Status': 'Mindre svullnad. Fortsatt instabilitet framåt.',
        'Bedömning': 'Främre korsbandsskada.',
        'Åtgärd': 'Fortsatt behandling i hemlandet. Journalkopia med.',
      } },
    ],
    matvarden: [
      ['blodtryck', 'uso-akut', [[[-5, '14:10'], '118/74']]],
      ['puls', 'uso-akut', [[[-5, '14:10'], 84]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0026', dosering: '2 tabletter vid behov, högst 4 gånger per dygn', dos: 1000, dosEnhet: 'mg', vidBehov: true, typ: 'vid_behov', orsak: 'Smärta i knät', uppfoljning: 9, start: -5, enhet: 'uso-akut', av: 'lak-akut' },
    ],
  },
];
