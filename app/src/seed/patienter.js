// Påhittade patienter med testpersonnummer från Skatteverket (kopierade ur research/testpersonnummer.json).
// Tider anges relativt till när sandlådan skapas:
//   -3              dag (tre dagar sedan), klockan 10:00
//   [-3, '08:15']   dag och klockslag
//   { min: -40 }    minuter före nu
//   '2014-03-11'    absolut datum (migrerad historik)
// Sökord anges som objekt i den ordning de ska visas.

export const PATIENTER = [
  // 1. Kardiologi, inlagd avd 72. Förmaksflimmer och hjärtsvikt. Migrerad historik från VAS och Cosmic.
  {
    id: 'p01', pnr: '194502024732', fornamn: 'Gunnar', efternamn: 'Åkesson',
    adress: 'Ekbacksvägen 12', postnr: '702 27', ort: 'Örebro', telefon: '070-174 06 01',
    kontaktperson: 'Dotter Lena Åkesson, 070-174 06 02', listning: { enhet: 'vc-tybble', fran: '2009-02-01' },
    vardkontakter: [
      { ref: 'vas14', enhet: 'uso-med', typ: 'slutenvard', start: ['2014-03-11', '16:40'], slut: ['2014-03-18', '11:00'], plats: 'Avdelning 51', orsak: 'Nyupptäckt förmaksflimmer', kalla: 'migrerad:VAS' },
      { ref: 'cos23', enhet: 'uso-kard-mott', typ: 'oppenvard', start: ['2023-05-16', '09:30'], slut: ['2023-05-16', '10:15'], plats: 'Kardiologiska mottagningen', orsak: 'Uppföljning av förmaksflimmer', kalla: 'migrerad:Cosmic' },
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-3, '07:52'], slut: [-3, '12:10'], plats: 'Akutrum 4', orsak: 'Andfåddhet och hjärtklappning' },
      { ref: 'inl', enhet: 'uso-kard-72', typ: 'slutenvard', start: [-3, '12:15'], plats: 'Avd 72, sal 4', orsak: 'Förmaksflimmer med snabb kammarfrekvens och hjärtsvikt' },
    ],
    overkanslighet: [
      { amne: 'Penicilliner', atc: 'J01C', reaktion: 'Urtikaria och svullnad i ansiktet', allvarlighet: 'allvarlig', enhet: 'uso-med', datum: '2014-03-12', kalla: 'migrerad:VAS' },
    ],
    diagnoser: [
      { kod: 'I48.0', text: 'Paroxysmalt förmaksflimmer', enhet: 'uso-med', vk: 'vas14', datum: '2014-03-18', typ: 'huvud', kalla: 'migrerad:VAS' },
      { kod: 'I50.1', text: 'Vänsterhjärtsvikt', enhet: 'uso-kard-mott', vk: 'cos23', datum: '2023-05-16', typ: 'huvud', kalla: 'migrerad:Cosmic' },
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-tybble', datum: '2011-09-14', typ: 'bi' },
      { kod: 'I48.1', text: 'Persisterande förmaksflimmer', enhet: 'uso-kard-72', vk: 'inl', datum: -3, typ: 'huvud' },
      { kod: 'I50.1', text: 'Vänsterhjärtsvikt', enhet: 'uso-kard-72', vk: 'inl', datum: -3, typ: 'bi' },
    ],
    anteckningar: [
      { typ: 'Epikris', enhet: 'uso-med', vk: 'vas14', av: 'lak-vas', tid: ['2014-03-18', '10:30'], kalla: 'migrerad:VAS', sokord: {
        'Orsak till vård': 'Hjärtklappning sedan två dagar. EKG visade förmaksflimmer med kammarfrekvens 140.',
        'Förlopp': 'Frekvensreglerad med metoprolol. Spontan konvertering till sinusrytm dag 3. CHA2DS2-VASc 2. Warfarin insatt efter samtal med patienten. Patienten uppger att han fick utslag efter jodkontrast vid en datortomografi 2009.',
        'Läkemedelsförändringar': 'Nyinsatt Waran enligt doseringsschema och Metoprolol depot 50 mg 1x1.',
        'Uppföljning': 'INR-kontroll på vårdcentralen om en vecka. Återbesök på kardiologiska mottagningen om tre månader.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-kard-mott', vk: 'cos23', av: 'lak-cosmic', tid: ['2023-05-16', '10:10'], kalla: 'migrerad:Cosmic', sokord: {
        'Kontaktorsak': 'Uppföljning av förmaksflimmer.',
        'Anamnes': 'Tilltagande trötthet och andfåddhet vid ansträngning sedan i våras. Inga svimningar.',
        'Status': 'Oregelbunden rytm, frekvens 88. Lätta ankelödem. Blodtryck 142/86.',
        'Bedömning': 'Ekokardiografi visar nedsatt vänsterkammarfunktion, EF 40 procent. Förmaksflimmer nu persisterande. Hjärtsvikt NYHA II.',
        'Åtgärd': 'Insätter Furosemid 40 mg 1x1. Fortsatt frekvensreglering. Återbesök om sex månader.',
      } },
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-3, '08:40'], sokord: {
        'Kontaktorsak': 'Andfåddhet och hjärtklappning sedan i går kväll.',
        'Prioritet': 'Orange enligt RETTS.',
        'Anamnes': 'Känt förmaksflimmer och hjärtsvikt, behandlas med Waran. Ökad andfåddhet, sov sittande i natt. Viktuppgång 3 kg på en vecka.',
        'Status': 'Andningsfrekvens 26, saturation 91 procent på luft. Oregelbunden takykardi 128. Basala rassel bilateralt. Ankelödem.',
        'Bedömning': 'Förmaksflimmer med snabb kammarfrekvens och dekompenserad hjärtsvikt.',
        'Åtgärd': 'Furosemid 40 mg iv och syrgas 2 liter. Läggs in på kardiologen, avdelning 72.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'lak-kard', tid: [-3, '13:05'], sokord: {
        'Kontaktorsak': 'Dekompenserad hjärtsvikt vid förmaksflimmer med snabb kammarfrekvens.',
        'Anamnes': 'Se akutanteckning. Bor med hustru i villa och klarar sig själv.',
        'Status': 'Allmäntillstånd påverkat. Puls 118, oregelbunden. Blodtryck 138/88. Rassel basalt bilateralt.',
        'Bedömning': 'Behöver frekvensreglering och diures. INR 2,1, terapeutiskt.',
        'Åtgärd': 'Höjer Metoprolol depot till 100 mg. Furosemid 40 mg 1x2. Daglig vikt och vätskelista. NT-proBNP och elektrolyter i morgon.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'ssk-kard', tid: [-2, '14:20'], sokord: {
        'Andning/cirkulation': 'Andfådd vid förflyttning, bättre i vila. Saturation 94 procent med 1 liter syrgas.',
        'Elimination': 'Diures 2,1 liter senaste dygnet.',
        'Aktivitet': 'Går med stöd till toaletten.',
        'Planering': 'Daglig vikt före frukost. Fortsatt vätskelista.',
      } },
      { typ: 'Daganteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'lak-kard', tid: [-1, '10:40'], sokord: {
        'Aktuellt': 'Mindre andfådd. Vikten har gått ned 1,3 kg.',
        'Status': 'Puls 96, oregelbunden. Blodtryck 128/78. Rasslen har minskat.',
        'Bedömning': 'Förbättras. NT-proBNP 4580 ng/L.',
        'Åtgärd': 'Fortsatt behandling. Planerar elkonvertering polikliniskt efter tre veckor med terapeutiskt INR.',
      }, rattelse: { tid: [-1, '11:05'], av: 'lak-kard', orsak: 'Fel värde för NT-proBNP i första versionen.', sokord: {
        'Aktuellt': 'Mindre andfådd. Vikten har gått ned 1,3 kg.',
        'Status': 'Puls 96, oregelbunden. Blodtryck 128/78. Rasslen har minskat.',
        'Bedömning': 'Förbättras. NT-proBNP 4850 ng/L.',
        'Åtgärd': 'Fortsatt behandling. Planerar elkonvertering polikliniskt efter tre veckor med terapeutiskt INR.',
      } } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'ssk-kard', tid: [0, '07:30'], sokord: {
        'Sömn': 'Sov bättre i natt och behövde ingen extra kudde.',
        'Andning/cirkulation': 'Saturation 96 procent utan syrgas.',
        'Nutrition': 'Äter frukost själv. Vätskeintag 1,5 liter per dygn enligt ordination.',
      } },
      { typ: 'Daganteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'lak-kard', tid: [0, '09:10'], status: 'utkast', sokord: {
        'Aktuellt': 'Pigg på ronden. Vikt 81,6 kg.',
        'Bedömning': 'Fortsatt förbättring.',
      } },
    ],
    matvarden: [
      ['inr', 'uso-med', [[['2014-03-17', '07:00'], 1.8]], 'migrerad:VAS'],
      ['ntprobnp', 'uso-kard-mott', [[['2023-05-16', '08:30'], 1240]], 'migrerad:Cosmic'],
      ['puls', 'uso-akut', [[[-3, '08:10'], 128]]],
      ['blodtryck', 'uso-akut', [[[-3, '08:10'], '148/92']]],
      ['saturation', 'uso-akut', [[[-3, '08:10'], 91]]],
      ['andningsfrekvens', 'uso-akut', [[[-3, '08:10'], 26]]],
      ['inr', 'uso-akut', [[[-3, '09:00'], 2.1]]],
      ['kreatinin', 'uso-akut', [[[-3, '09:00'], 112]]],
      ['puls', 'uso-kard-72', [[[-3, '14:00'], 118], [[-2, '08:00'], 104], [[-1, '08:00'], 96], [[0, '08:00'], 84]]],
      ['blodtryck', 'uso-kard-72', [[[-2, '08:00'], '138/88'], [[-1, '08:00'], '128/78'], [[0, '08:00'], '126/76']]],
      ['saturation', 'uso-kard-72', [[[-2, '08:00'], 94], [[-1, '08:00'], 95], [[0, '08:00'], 96]]],
      ['vikt', 'uso-kard-72', [[[-3, '14:00'], 84.2], [[-2, '07:00'], 83.1], [[-1, '07:00'], 82.9], [[0, '07:00'], 81.6]]],
      ['ntprobnp', 'uso-kard-72', [[[-1, '06:30'], 4850]]],
      ['inr', 'uso-kard-72', [[[-1, '06:30'], 2.6], [[0, '06:30'], 2.4]]],
      ['kreatinin', 'uso-kard-72', [[[-1, '06:30'], 118]]],
      ['kalium', 'uso-kard-72', [[[-1, '06:30'], 3.9]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0001', dosering: 'Enligt doseringsschema, styrs av INR', typ: 'staende', orsak: 'Förmaksflimmer, strokeprofylax', uppfoljning: 4, start: '2014-03-18', enhet: 'uso-med', av: 'lak-vas', kalla: 'migrerad:VAS' },
      { lm: 'VK-NPL-0008', dosering: '1 tablett på morgonen', dos: 50, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Förmaksflimmer, frekvensreglering', uppfoljning: '2014-06-18', start: '2014-03-18', enhet: 'uso-med', av: 'lak-vas', kalla: 'migrerad:VAS',
        utsatt: { tid: [-3, '13:10'], av: 'lak-kard', orsak: 'Dosökning, ersätts av ny ordination' } },
      { lm: 'VK-NPL-0008', dosering: '2 tabletter på morgonen', dos: 100, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Förmaksflimmer, frekvensreglering', uppfoljning: 7, start: [-3, '13:12'], enhet: 'uso-kard-72', av: 'lak-kard' },
      { lm: 'VK-NPL-0010', dosering: '1 tablett på morgonen', dos: 40, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hjärtsvikt', uppfoljning: '2023-11-16', start: '2023-05-16', enhet: 'uso-kard-mott', av: 'lak-cosmic', kalla: 'migrerad:Cosmic',
        utsatt: { tid: [-3, '13:14'], av: 'lak-kard', orsak: 'Dosökning vid dekompenserad hjärtsvikt' } },
      { lm: 'VK-NPL-0010', dosering: '1 tablett morgon och 1 tablett kl 14', dos: 40, dosEnhet: 'mg', tider: ['08', '14'], typ: 'staende', orsak: 'Hjärtsvikt med vätskeretention', uppfoljning: 2, start: [-3, '13:15'], enhet: 'uso-kard-72', av: 'lak-kard' },
      { lm: 'VK-NPL-0026', dosering: '1 till 2 tabletter vid behov, högst 8 tabletter per dygn', dos: 500, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Smärta', uppfoljning: 7, start: [-3, '13:20'], enhet: 'uso-kard-72', av: 'lak-kard' },
    ],
  },

  // 2. Akuten, medvetslös vid ankomst. Ingen pågående vårdrelation med akuten: nödåtkomst.
  {
    id: 'p02', pnr: '196603193373', fornamn: 'Thomas', efternamn: 'Lindberg',
    adress: 'Storgatan 41', postnr: '692 31', ort: 'Kumla', telefon: '070-174 06 03',
    kontaktperson: 'Hustru Karin Lindberg, 070-174 06 04', listning: { enhet: 'vc-kumla', fran: '1998-06-01' },
    vardkontakter: [
      { ref: 'akut1', enhet: 'uso-akut', typ: 'akut', start: [-700, '03:05'], slut: [-700, '07:30'], plats: 'Akutrum 2', orsak: 'Medvetslös, hypoglykemi' },
      { ref: 'dm1', enhet: 'lind-med', typ: 'oppenvard', start: [-300, '09:00'], slut: [-300, '09:45'], plats: 'Diabetesmottagningen', orsak: 'Årskontroll diabetes' },
      { ref: 'dm2', enhet: 'lind-med', typ: 'oppenvard', start: [-120, '13:00'], slut: [-120, '13:30'], plats: 'Diabetesmottagningen', orsak: 'Uppföljning diabetes' },
      { ref: 'vc', enhet: 'vc-kumla', typ: 'oppenvard', start: [-45, '10:20'], slut: [-45, '10:50'], plats: 'Mottagning', orsak: 'Hälsokontroll' },
    ],
    diagnoser: [
      { kod: 'E10.0', text: 'Diabetes mellitus typ 1 - med koma', enhet: 'uso-akut', vk: 'akut1', datum: -700, typ: 'huvud' },
      { kod: 'E10.9', text: 'Diabetes mellitus typ 1 - utan komplikationer', enhet: 'lind-med', vk: 'dm1', datum: -300, typ: 'huvud' },
      { kod: 'E78.0', text: 'Isolerad hyperkolesterolemi', enhet: 'vc-kumla', vk: 'vc', datum: -45, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut1', av: 'lak-akut', tid: [-700, '03:40'], sokord: {
        'Kontaktorsak': 'Hittad medvetslös i sängen av hustrun. Ambulansen uppmätte glukos 1,4 och gav glukos iv.',
        'Status': 'Vaken och orienterad vid ankomst. Glukos 6,8.',
        'Bedömning': 'Svår hypoglykemi hos patient med diabetes typ 1.',
        'Åtgärd': 'Observeras fyra timmar. Går hem med hustrun. Kontakt med diabetesmottagningen.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'lind-med', vk: 'dm1', av: 'lak-lind', tid: [-300, '09:40'], sokord: {
        'Kontaktorsak': 'Årskontroll diabetes typ 1.',
        'Anamnes': 'Diabetes sedan 19 års ålder. Två nattliga hypoglykemier senaste halvåret, vaknade själv.',
        'Status': 'Fötter utan sår. Monofilament normalt.',
        'Bedömning': 'HbA1c 68 mmol/mol. Hypoglykemier nattetid.',
        'Åtgärd': 'Sänker Lantus från 24 till 22 enheter. Kontinuerlig glukosmätning förskrivs.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'lind-med', vk: 'dm1', av: 'ssk-lind', tid: [-300, '10:05'], sokord: {
        'Kommunikation': 'Genomgång av insulinteknik och behandling av hypoglykemi.',
        'Planering': 'Hustrun har fått information om glukagon och sensorlarm.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'lind-med', vk: 'dm2', av: 'lak-lind', tid: [-120, '13:25'], sokord: {
        'Kontaktorsak': 'Uppföljning efter dosändring.',
        'Bedömning': 'Glukoskurvan visar högre nattvärden än tidigare. HbA1c 64 mmol/mol. Inga allvarliga hypoglykemier.',
        'Åtgärd': 'Oförändrad behandling. Årskontroll om sex månader.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc', av: 'lak-kumla', tid: [-45, '10:45'], sokord: {
        'Kontaktorsak': 'Hälsokontroll och blodfetter.',
        'Bedömning': 'LDL 3,8 mmol/L trots kostomläggning.',
        'Åtgärd': 'Insätter atorvastatin 40 mg. Nya blodfetter om tre månader.',
      } },
    ],
    matvarden: [
      ['glukos', 'uso-akut', [[[-700, '03:10'], 6.8]]],
      ['hba1c', 'lind-med', [[[-300, '08:30'], 68], [[-120, '12:30'], 64]]],
      ['vikt', 'lind-med', [[[-300, '09:00'], 79.5], [[-120, '13:00'], 80.1]]],
      ['blodtryck', 'vc-kumla', [[[-45, '10:25'], '132/84']]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0022', dosering: 'Enligt kolhydraträkning, ungefär 4 till 8 enheter till måltid', dosEnhet: 'E', typ: 'staende', orsak: 'Diabetes typ 1, måltidsinsulin', uppfoljning: 60, start: '2012-01-10', enhet: 'lind-med', av: 'lak-lind' },
      { lm: 'VK-NPL-0023', dosering: '22 enheter kl 22', dos: 22, dosEnhet: 'E', tider: ['22'], typ: 'staende', orsak: 'Diabetes typ 1, basinsulin', uppfoljning: 60, start: [-300, '09:40'], enhet: 'lind-med', av: 'lak-lind' },
      { lm: 'VK-NPL-0018', dosering: '1 tablett till kvällen', dos: 40, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Hyperkolesterolemi', uppfoljning: 45, start: [-45, '10:45'], enhet: 'vc-kumla', av: 'lak-kumla' },
    ],
  },

  // 3. Skyddade personuppgifter. Besök på Vårdcentralen Tybble, nu i akutens väntrum.
  {
    id: 'p03', pnr: '198404162383', fornamn: 'Malin', efternamn: 'Engberg', skyddad: true,
    adress: null, postnr: null, ort: null, telefon: null,
    kontaktperson: null, listning: { enhet: 'vc-tybble', fran: '2019-08-01' },
    vardkontakter: [
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-20, '14:00'], slut: [-20, '14:20'], plats: 'Mottagning', orsak: 'Sveda vid miktion' },
      { ref: 'vc2', enhet: 'vc-tybble', typ: 'oppenvard', start: [-2, '09:00'], slut: [-2, '09:30'], plats: 'Mottagning', orsak: 'Hjärtklappning' },
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: { min: -40 }, plats: 'Väntrum', orsak: 'Buksmärta' },
    ],
    diagnoser: [
      { kod: 'N30.0', text: 'Akut cystit (urinvägsinfektion lokaliserad till urinblåsan)', enhet: 'vc-tybble', vk: 'vc1', datum: -20, typ: 'huvud' },
      { kod: 'R00.2', text: 'Hjärtklappning', enhet: 'vc-tybble', vk: 'vc2', datum: -2, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-20, '14:15'], sokord: {
        'Kontaktorsak': 'Sveda och täta trängningar sedan tre dagar.',
        'Status': 'Ingen feber. Ingen dunkömhet över njurlogerna. Urinsticka: nitrit positiv, leukocyter 2+.',
        'Bedömning': 'Okomplicerad cystit.',
        'Åtgärd': 'Selexid 200 mg 1x3 i tre dagar.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc2', av: 'lak-vc', tid: [-2, '09:25'], sokord: {
        'Kontaktorsak': 'Episoder av hjärtklappning sedan en månad.',
        'Anamnes': 'Kommer och går, varar några minuter. Ingen bröstsmärta eller svimning.',
        'Status': 'EKG i vila: sinusrytm 72. Hjärta och lungor utan anmärkning.',
        'Åtgärd': 'TSH och blodstatus. Remiss till kardiologen för långtids-EKG när provsvar finns.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-akut', vk: 'akut', av: 'ssk-akut', tid: { min: -30 }, sokord: {
        'Smärta': 'Buksmärta i nedre högra delen av buken sedan i morse. Skattar smärtan till 6 av 10.',
        'Andning/cirkulation': 'Puls 92, blodtryck 124/78, temp 37,8.',
        'Planering': 'Prioritet gul enligt RETTS. Väntar på läkarbedömning.',
      } },
    ],
    matvarden: [
      ['crp', 'vc-tybble', [[[-20, '14:05'], 12]]],
      ['blodtryck', 'vc-tybble', [[[-2, '09:05'], '118/72']]],
      ['puls', 'vc-tybble', [[[-2, '09:05'], 72]]],
      ['temp', 'uso-akut', [[{ min: -32 }, 37.8]]],
      ['puls', 'uso-akut', [[{ min: -32 }, 92]]],
      ['blodtryck', 'uso-akut', [[{ min: -32 }, '124/78']]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0035', dosering: '1 tablett 3 gånger dagligen i 3 dagar', dos: 200, dosEnhet: 'mg', tider: ['08', '14', '20'], typ: 'tillfallig', orsak: 'Akut cystit', uppfoljning: -14, start: -20, slut: -17, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0027', dosering: '1 tablett vid behov, högst 3 per dygn', dos: 400, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Menstruationssmärta', uppfoljning: 160, start: -200, enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 4. Spärrade uppgifter från Allmänpsykiatriska kliniken. Inlagd på kardiologen.
  {
    id: 'p04', pnr: '197701182383', fornamn: 'Elin', efternamn: 'Sandberg',
    adress: 'Rudbecksgatan 18', postnr: '703 61', ort: 'Örebro', telefon: '070-174 06 05',
    kontaktperson: 'Sambo Jonatan Rask, 070-174 06 06', sparr: [{ enhet: 'uso-psyk', datum: -365 }],
    vardkontakter: [
      { ref: 'psyk', enhet: 'uso-psyk', typ: 'oppenvard', start: [-700, '13:00'], plats: 'Psykiatrisk öppenvårdsmottagning', orsak: 'Recidiverande depression' },
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-2, '21:40'], slut: [-2, '23:30'], plats: 'Akutrum 6', orsak: 'Bröstsmärta' },
      { ref: 'inl', enhet: 'uso-kard-72', typ: 'slutenvard', start: [-2, '23:35'], plats: 'Avd 72, sal 2', orsak: 'Hjärtinfarkt utan ST-höjning' },
    ],
    diagnoser: [
      { kod: 'F33.1', text: 'Recidiverande depression, medelsvår episod', enhet: 'uso-psyk', vk: 'psyk', datum: -700, typ: 'huvud' },
      { kod: 'F41.1', text: 'Generaliserat ångestsyndrom', enhet: 'uso-psyk', vk: 'psyk', datum: -400, typ: 'bi' },
      { kod: 'I21.4', text: 'Akut subendokardiell infarkt', enhet: 'uso-kard-72', vk: 'inl', datum: -1, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-700, '13:50'], sokord: {
        'Kontaktorsak': 'Nybesök, remiss från företagshälsovården.',
        'Anamnes': 'Nedstämdhet, sömnsvårigheter och svårt att koncentrera sig sedan i höstas. Två tidigare depressiva episoder.',
        'Status': 'Sänkt grundstämning. Inga suicidtankar. MADRS 26.',
        'Bedömning': 'Recidiverande depression, medelsvår episod.',
        'Åtgärd': 'Insätter sertralin 50 mg. Återbesök om fyra veckor.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-400, '10:30'], sokord: {
        'Aktuellt': 'Stämningen bättre. Kvarstående oro och spänningar.',
        'Bedömning': 'Delvis förbättrad. Generaliserat ångestsyndrom.',
        'Åtgärd': 'Höjer sertralin till 100 mg. Kognitiv beteendeterapi hos psykolog.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'ssk-psyk', tid: [-60, '09:15'], sokord: {
        'Psykosocialt': 'Arbetar heltid sedan i våras. Sover sju timmar per natt.',
        'Planering': 'Telefonkontakt om tre månader.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-60, '10:00'], sokord: {
        'Aktuellt': 'Stabil sedan ett halvår.',
        'Bedömning': 'I remission.',
        'Åtgärd': 'Fortsatt sertralin 100 mg i minst ett år till.',
      } },
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-2, '22:05'], sokord: {
        'Kontaktorsak': 'Tryckande bröstsmärta sedan två timmar.',
        'Status': 'Blek och kallsvettig. EKG: ST-sänkning V4 till V6. Troponin T 86 ng/L.',
        'Bedömning': 'Hjärtinfarkt utan ST-höjning.',
        'Åtgärd': 'ASA och tikagrelor givet. Läggs in på kardiologen.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'lak-kard', tid: [-2, '23:50'], sokord: {
        'Kontaktorsak': 'Hjärtinfarkt utan ST-höjning.',
        'Status': 'Smärtfri efter morfin. Puls 82, blodtryck 132/80.',
        'Bedömning': 'Planeras för kranskärlsröntgen i morgon.',
        'Åtgärd': 'Dubbel trombocythämning, statin och betablockad enligt läkemedelslistan.',
      } },
      { typ: 'Daganteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'lak-kard', tid: [-1, '11:00'], sokord: {
        'Aktuellt': 'Kranskärlsröntgen: signifikant stenos i LAD, PCI med ett läkemedelsavgivande stent.',
        'Bedömning': 'Okomplicerat förlopp.',
        'Åtgärd': 'Dubbel trombocythämning i tolv månader. Hjärtrehabilitering.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-kard-72', vk: 'inl', av: 'ssk-kard', tid: [-1, '15:00'], sokord: {
        'Hud/vävnad': 'Punktionsställe höger handled utan blödning.',
        'Aktivitet': 'Mobiliserad, går själv i korridoren.',
      } },
    ],
    matvarden: [
      ['vikt', 'uso-psyk', [[[-60, '09:10'], 68.2]]],
      ['troponin', 'uso-akut', [[[-2, '21:55'], 86]]],
      ['troponin', 'uso-kard-72', [[[-1, '06:00'], 412], [[0, '06:00'], 288]]],
      ['blodtryck', 'uso-kard-72', [[[-1, '08:00'], '126/78'], [[0, '08:00'], '122/76']]],
      ['puls', 'uso-kard-72', [[[-1, '08:00'], 74], [[0, '08:00'], 68]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0041', dosering: '2 tabletter på morgonen', dos: 100, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Recidiverande depression', uppfoljning: 60, start: -400, enhet: 'uso-psyk', av: 'lak-psyk' },
      { lm: 'VK-NPL-0006', dosering: '1 tablett på morgonen', dos: 75, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Sekundärprevention efter hjärtinfarkt', uppfoljning: 30, start: [-2, '23:50'], enhet: 'uso-kard-72', av: 'lak-kard' },
      { lm: 'VK-NPL-0007', dosering: '1 tablett morgon och kväll', dos: 90, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Efter PCI, dubbel trombocythämning i tolv månader', uppfoljning: 30, start: [-2, '23:50'], slut: 363, enhet: 'uso-kard-72', av: 'lak-kard' },
      { lm: 'VK-NPL-0018', dosering: '2 tabletter till kvällen', dos: 80, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Sekundärprevention efter hjärtinfarkt', uppfoljning: 60, start: [-2, '23:50'], enhet: 'uso-kard-72', av: 'lak-kard' },
      { lm: 'VK-NPL-0008', dosering: '1 tablett på morgonen', dos: 50, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Efter hjärtinfarkt', uppfoljning: 30, start: [-1, '11:00'], enhet: 'uso-kard-72', av: 'lak-kard' },
    ],
  },

  // 5. Listad på Vårdcentralen Kumla, remitterad till kardiologen. Remissen saknar mottagningskvittens.
  {
    id: 'p05', pnr: '196503143254', fornamn: 'Lars', efternamn: 'Wennberg',
    adress: 'Hagendalsvägen 7', postnr: '692 33', ort: 'Kumla', telefon: '070-174 06 07',
    kontaktperson: null, listning: { enhet: 'vc-kumla', fran: '2001-03-01' },
    vardkontakter: [
      { ref: 'vc0', enhet: 'vc-kumla', typ: 'oppenvard', start: [-900, '08:30'], slut: [-900, '09:00'], plats: 'Mottagning', orsak: 'Förhöjt blodtryck' },
      { ref: 'vc1', enhet: 'vc-kumla', typ: 'oppenvard', start: [-21, '15:00'], slut: [-21, '15:30'], plats: 'Mottagning', orsak: 'Bröstsmärta vid ansträngning' },
      { ref: 'vc2', enhet: 'vc-kumla', typ: 'oppenvard', start: [-1, '14:30'], slut: [-1, '15:10'], plats: 'Mottagning', orsak: 'Uppföljning bröstsmärta' },
    ],
    diagnoser: [
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-kumla', vk: 'vc0', datum: -900, typ: 'huvud' },
      { kod: 'E78.0', text: 'Isolerad hyperkolesterolemi', enhet: 'vc-kumla', vk: 'vc0', datum: -900, typ: 'bi' },
      { kod: 'I20.9', text: 'Angina pectoris, ospecificerad', enhet: 'vc-kumla', vk: 'vc2', datum: -1, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc0', av: 'lak-kumla', tid: [-900, '08:55'], sokord: {
        'Kontaktorsak': 'Förhöjt blodtryck vid tre mätningar.',
        'Status': 'Blodtryck 158/96. Hjärta och lungor utan anmärkning.',
        'Åtgärd': 'Insätter amlodipin 5 mg och atorvastatin 40 mg. Kontroll om tre månader.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc1', av: 'lak-kumla', tid: [-21, '15:25'], sokord: {
        'Kontaktorsak': 'Tryck över bröstet vid promenad i uppförsbacke sedan tre veckor.',
        'Anamnes': 'Släpper efter några minuters vila. Röker inte. Pappa hjärtinfarkt vid 58 års ålder.',
        'Status': 'EKG i vila: sinusrytm, normalt. Blodtryck 136/84.',
        'Åtgärd': 'Nitroglycerinspray vid behov. Insätter Trombyl. Återbesök om tre veckor.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc2', av: 'lak-kumla', tid: [-1, '15:05'], sokord: {
        'Aktuellt': 'Besvären kvarstår, nu även vid lätt ansträngning på plan mark. Ingen vilovärk.',
        'Bedömning': 'Misstänkt kärlkramp.',
        'Åtgärd': 'Skyndsam remiss till kardiologen för arbetsprov och bedömning.',
      } },
    ],
    matvarden: [
      ['blodtryck', 'vc-kumla', [[[-900, '08:40'], '158/96'], [[-21, '15:05'], '136/84'], [[-1, '14:35'], '138/86']]],
      ['puls', 'vc-kumla', [[[-21, '15:05'], 76], [[-1, '14:35'], 72]]],
      ['vikt', 'vc-kumla', [[[-900, '08:40'], 93.0], [[-1, '14:35'], 91.2]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0015', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hypertoni', uppfoljning: 60, start: -900, enhet: 'vc-kumla', av: 'lak-kumla' },
      { lm: 'VK-NPL-0018', dosering: '1 tablett till kvällen', dos: 40, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Hyperkolesterolemi', uppfoljning: 60, start: -900, enhet: 'vc-kumla', av: 'lak-kumla' },
      { lm: 'VK-NPL-0017', dosering: '1 till 2 doser under tungan vid bröstsmärta', dosEnhet: 'dos', typ: 'vid_behov', vidBehov: true, orsak: 'Kärlkramp', uppfoljning: 30, start: -21, enhet: 'vc-kumla', av: 'lak-kumla' },
      { lm: 'VK-NPL-0006', dosering: '1 tablett på morgonen', dos: 75, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Misstänkt kärlkramp', uppfoljning: 30, start: -21, enhet: 'vc-kumla', av: 'lak-kumla' },
    ],
  },

  // 6. Diabetes typ 2 med nedsatt njurfunktion och metformin.
  {
    id: 'p06', pnr: '194601198882', fornamn: 'Birgitta', efternamn: 'Nyman',
    adress: 'Tybblegatan 9', postnr: '702 14', ort: 'Örebro', telefon: '070-174 06 08',
    kontaktperson: 'Make Rolf Nyman, 070-174 06 09', listning: { enhet: 'vc-tybble', fran: '2004-01-15' },
    vardkontakter: [
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-400, '10:00'], slut: [-400, '10:30'], plats: 'Mottagning', orsak: 'Årskontroll diabetes' },
      { ref: 'vc2', enhet: 'vc-tybble', typ: 'oppenvard', start: [-90, '13:00'], slut: [-90, '13:30'], plats: 'Mottagning', orsak: 'Försämrad njurfunktion' },
      { ref: 'vc3', enhet: 'vc-tybble', typ: 'oppenvard', start: [-7, '10:00'], slut: [-7, '10:40'], plats: 'Mottagning', orsak: 'Uppföljning njurfunktion' },
    ],
    diagnoser: [
      { kod: 'E11.9', text: 'Diabetes mellitus typ 2 - utan komplikationer', enhet: 'vc-tybble', datum: '2012-05-03', typ: 'huvud' },
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-tybble', datum: '2010-11-20', typ: 'bi' },
      { kod: 'N18.3', text: 'Kronisk njursvikt, stadium 3', enhet: 'vc-tybble', vk: 'vc2', datum: -90, typ: 'bi' },
      { kod: 'N18.4', text: 'Kronisk njursvikt, stadium 4', enhet: 'vc-tybble', vk: 'vc3', datum: -7, typ: 'bi' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-400, '10:25'], sokord: {
        'Kontaktorsak': 'Årskontroll diabetes typ 2.',
        'Bedömning': 'HbA1c 58 mmol/mol. eGFR 48. Blodtryck 138/82.',
        'Åtgärd': 'Fortsatt metformin 500 mg 1x2. Lägger till Lantus 12 enheter till kvällen.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc2', av: 'lak-vc', tid: [-90, '13:25'], sokord: {
        'Aktuellt': 'eGFR har sjunkit till 33.',
        'Bedömning': 'Kronisk njursjukdom stadium 3b vid diabetes och hypertoni.',
        'Åtgärd': 'Remiss till medicinska kliniken för njurmedicinsk bedömning.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc3', av: 'lak-vc', tid: [-7, '10:35'], sokord: {
        'Aktuellt': 'Provsvar: eGFR 27, kalium 4,8.',
        'Bedömning': 'Fortsatt sjunkande njurfunktion. Svar från medicinska kliniken har inte kommit.',
        'Åtgärd': 'Diabetesbehandlingen ses över. Kontaktar medicinska kliniken om remissen.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'vc-tybble', vk: 'vc3', av: 'ssk-vc', tid: [-7, '10:50'], sokord: {
        'Hud/vävnad': 'Fotundersökning: inga sår, nedsatt känsel i tårna bilateralt.',
        'Planering': 'Remiss till fotterapeut.',
      } },
    ],
    matvarden: [
      ['egfr', 'vc-tybble', [[[-400, '08:30'], 48], [[-200, '08:30'], 41], [[-90, '08:30'], 33], [[-7, '08:30'], 27]]],
      ['kreatinin', 'vc-tybble', [[[-400, '08:30'], 98], [[-200, '08:30'], 112], [[-90, '08:30'], 135], [[-7, '08:30'], 158]]],
      ['hba1c', 'vc-tybble', [[[-400, '08:30'], 58], [[-90, '08:30'], 61]]],
      ['kalium', 'vc-tybble', [[[-7, '08:30'], 4.8]]],
      ['blodtryck', 'vc-tybble', [[[-400, '10:05'], '138/82'], [[-90, '13:05'], '142/84'], [[-7, '10:05'], '136/80']]],
      ['vikt', 'vc-tybble', [[[-400, '10:05'], 74.8], [[-7, '10:05'], 72.1]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0020', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Diabetes typ 2', uppfoljning: 30, start: '2012-05-03', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0023', dosering: '12 enheter till kvällen', dos: 12, dosEnhet: 'E', tider: ['21'], typ: 'staende', orsak: 'Diabetes typ 2', uppfoljning: 30, start: -400, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0015', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hypertoni', uppfoljning: 60, start: '2010-11-20', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0019', dosering: '1 tablett till kvällen', dos: 20, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Hyperlipidemi vid diabetes', uppfoljning: 60, start: '2012-05-03', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0010', dosering: '1 tablett på morgonen', dos: 40, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Ödem', uppfoljning: 30, start: -200, enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 7. Ortopedi Karlskoga, höftfraktur, omvårdnadsanteckningar.
  {
    id: 'p07', pnr: '194501278883', fornamn: 'Margareta', efternamn: 'Forsberg',
    adress: 'Lindhult 3', postnr: '703 75', ort: 'Örebro', telefon: '070-174 06 10',
    kontaktperson: 'Son Peter Forsberg, 070-174 06 11', listning: { enhet: 'vc-tybble', fran: '1995-09-01' },
    vardkontakter: [
      { ref: 'vc', enhet: 'vc-tybble', typ: 'oppenvard', start: [-120, '11:00'], slut: [-120, '11:30'], plats: 'Mottagning', orsak: 'Blodtryckskontroll' },
      { ref: 'inl', enhet: 'kkoga-ort', typ: 'slutenvard', start: [-6, '18:20'], plats: 'Avdelning 8, sal 3', orsak: 'Höftfraktur vänster' },
    ],
    diagnoser: [
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-tybble', datum: '2008-04-02', typ: 'huvud' },
      { kod: 'S72.00', text: 'Kollumfraktur - sluten', enhet: 'kkoga-ort', vk: 'inl', datum: -6, typ: 'huvud' },
      { kod: 'M81.9', text: 'Osteoporos, ospecificerad', enhet: 'kkoga-ort', vk: 'inl', datum: -4, typ: 'bi' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc', av: 'lak-vc', tid: [-120, '11:25'], sokord: {
        'Kontaktorsak': 'Blodtryckskontroll.',
        'Status': 'Blodtryck 134/80. Vikt 58 kg, ned 2 kg på ett år.',
        'Bedömning': 'Välreglerad hypertoni. Bor ensam med hemtjänst en gång i veckan.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'lak-kkoga', tid: [-6, '19:00'], sokord: {
        'Kontaktorsak': 'Föll i hemmet.',
        'Status': 'Förkortat och utåtroterat vänster ben. Röntgen: dislocerad lårbenshalsfraktur.',
        'Åtgärd': 'Halvprotes planeras i morgon. Fasta från midnatt.',
      } },
      { typ: 'Daganteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'lak-kkoga', tid: [-5, '15:00'], sokord: {
        'Aktuellt': 'Opererad med halvprotes i vänster höft, okomplicerat.',
        'Åtgärd': 'Full belastning tillåten. Fragmin i fyra veckor.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'ssk-kkoga', tid: [-5, '21:00'], sokord: {
        'Smärta': 'Skattar smärtan till 5 av 10 vid rörelse och 2 i vila efter Oxikodon.',
        'Elimination': 'Urinkateter kvar, diures 1,4 liter.',
      } },
      { typ: 'Daganteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'lak-kkoga', tid: [-4, '11:00'], sokord: {
        'Bedömning': 'Lågenergifraktur, bedöms ha osteoporos.',
        'Åtgärd': 'Insätter kalcium och D-vitamin. Remiss till vårdcentralen för ställningstagande till bisfosfonat.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'ssk-kkoga', tid: [-3, '14:00'], sokord: {
        'Aktivitet': 'Gått i korridoren med rollator tillsammans med fysioterapeut.',
        'Hud/vävnad': 'Operationsförbandet torrt. Hälarna utan rodnad.',
        'Nutrition': 'Äter halva portioner. Näringsdryck två gånger per dag.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'kkoga-ort', vk: 'inl', av: 'ssk-kkoga', tid: [-1, '10:00'], sokord: {
        'Aktivitet': 'Går själv med rollator till toaletten.',
        'Planering': 'Utskrivning till korttidsboende om två dagar. Samordnad vårdplanering med kommunen är bokad.',
      } },
    ],
    matvarden: [
      ['vikt', 'vc-tybble', [[[-120, '11:05'], 58.0]]],
      ['blodtryck', 'vc-tybble', [[[-120, '11:05'], '134/80']]],
      ['hb', 'kkoga-ort', [[[-6, '18:40'], 128], [[-5, '18:00'], 104], [[-3, '07:00'], 109]]],
      ['blodtryck', 'kkoga-ort', [[[-6, '18:40'], '152/88'], [[-5, '18:00'], '118/70'], [[-3, '08:00'], '128/76']]],
      ['puls', 'kkoga-ort', [[[-6, '18:40'], 92], [[-5, '18:00'], 88], [[-3, '08:00'], 76]]],
      ['temp', 'kkoga-ort', [[[-5, '18:00'], 37.9], [[-3, '08:00'], 37.2]]],
      ['saturation', 'kkoga-ort', [[[-5, '18:00'], 94], [[-3, '08:00'], 97]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0015', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hypertoni', uppfoljning: 60, start: '2008-04-02', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0004', dosering: '1 injektion subkutant kl 18', dos: 5000, dosEnhet: 'IE', tider: ['18'], typ: 'tillfallig', orsak: 'Tromboprofylax efter höftfrakturoperation', uppfoljning: 23, start: -6, slut: 23, enhet: 'kkoga-ort', av: 'lak-kkoga' },
      { lm: 'VK-NPL-0026', dosering: '2 tabletter 4 gånger dagligen', dos: 1000, dosEnhet: 'mg', tider: ['08', '13', '18', '22'], typ: 'staende', orsak: 'Smärta efter operation', uppfoljning: 7, start: -6, enhet: 'kkoga-ort', av: 'lak-kkoga' },
      { lm: 'VK-NPL-0030', dosering: '1 kapsel vid behov, högst 4 per dygn', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Genombrottssmärta efter operation', uppfoljning: 7, start: -5, enhet: 'kkoga-ort', av: 'lak-kkoga' },
      { lm: 'VK-NPL-0048', dosering: '1 tablett morgon och kväll', tider: ['08', '20'], typ: 'staende', orsak: 'Osteoporos', uppfoljning: 60, start: -4, enhet: 'kkoga-ort', av: 'lak-kkoga' },
    ],
  },

  // 8. Infektion, pneumoni, antibiotika och CRP.
  {
    id: 'p08', pnr: '199011172476', fornamn: 'Ahmed', efternamn: 'Hassan',
    adress: 'Vivallagatan 22', postnr: '703 42', ort: 'Örebro', telefon: '070-174 06 12',
    kontaktperson: 'Bror Yusuf Hassan, 070-174 06 13',
    vardkontakter: [
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: [-5, '19:10'], slut: [-5, '23:00'], plats: 'Akutrum 3', orsak: 'Feber och hosta' },
      { ref: 'inl', enhet: 'uso-inf', typ: 'slutenvard', start: [-5, '23:10'], slut: [-1, '14:00'], plats: 'Infektionsavdelningen, sal 12', orsak: 'Pneumoni' },
    ],
    diagnoser: [
      { kod: 'J18.9', text: 'Pneumoni, ospecificerad', enhet: 'uso-akut', vk: 'akut', datum: -5, typ: 'huvud' },
      { kod: 'J13.9', text: 'Pneumoni orsakad av Streptococcus pneumoniae', enhet: 'uso-inf', vk: 'inl', datum: -1, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'akut', av: 'lak-akut', tid: [-5, '20:00'], sokord: {
        'Kontaktorsak': 'Feber och hosta med rostfärgat slem sedan fyra dagar.',
        'Status': 'Temp 39,6. Andningsfrekvens 24, saturation 92 procent. Krepitationer höger bas.',
        'Bedömning': 'CRP 245. Lungröntgen: infiltrat i höger underlob. Samhällsförvärvad pneumoni, CRB-65 0 men syrgaskrävande.',
        'Åtgärd': 'Odlingar. Läggs in på infektionskliniken.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'uso-inf', vk: 'inl', av: 'lak-inf', tid: [-5, '23:40'], sokord: {
        'Kontaktorsak': 'Samhällsförvärvad pneumoni.',
        'Anamnes': 'Tidigare frisk. Inga kända allergier.',
        'Åtgärd': 'Bensylpenicillin 3 g x 3 intravenöst. Syrgas efter saturation.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-inf', vk: 'inl', av: 'ssk-inf', tid: [-4, '14:00'], sokord: {
        'Andning/cirkulation': 'Saturation 95 procent med 2 liter syrgas. Hostar upp segt slem.',
        'Nutrition': 'Dricker bra, äter lite.',
      } },
      { typ: 'Daganteckning', enhet: 'uso-inf', vk: 'inl', av: 'lak-inf', tid: [-2, '10:00'], sokord: {
        'Aktuellt': 'Feberfri sedan i går. Pneumokockantigen i urin positivt.',
        'Bedömning': 'CRP 96 och sjunkande.',
        'Åtgärd': 'Byter till amoxicillin peroralt.',
      } },
      { typ: 'Epikris', enhet: 'uso-inf', vk: 'inl', av: 'lak-inf', tid: [-1, '13:30'], sokord: {
        'Orsak till vård': 'Pneumokockpneumoni i höger underlob.',
        'Förlopp': 'Snabb förbättring på bensylpenicillin. CRP från 245 till 41.',
        'Läkemedelsförändringar': 'Amoxicillin 750 mg 1x3 till och med dag 10.',
        'Uppföljning': 'Ny lungröntgen om sex veckor via vårdcentral.',
      } },
    ],
    matvarden: [
      ['crp', 'uso-akut', [[[-5, '19:30'], 245]]],
      ['temp', 'uso-akut', [[[-5, '19:20'], 39.6]]],
      ['saturation', 'uso-akut', [[[-5, '19:20'], 92]]],
      ['andningsfrekvens', 'uso-akut', [[[-5, '19:20'], 24]]],
      ['crp', 'uso-inf', [[[-4, '06:00'], 210], [[-3, '06:00'], 132], [[-2, '06:00'], 96], [[-1, '06:00'], 41]]],
      ['temp', 'uso-inf', [[[-4, '08:00'], 38.9], [[-3, '08:00'], 37.9], [[-2, '08:00'], 37.1], [[-1, '08:00'], 36.8]]],
      ['saturation', 'uso-inf', [[[-4, '08:00'], 95], [[-2, '08:00'], 97], [[-1, '08:00'], 98]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0032', dosering: '3 g intravenöst 3 gånger per dygn', dos: 3, dosEnhet: 'g', tider: ['06', '14', '22'], typ: 'tillfallig', orsak: 'Pneumoni', uppfoljning: -2, start: [-5, '23:40'], enhet: 'uso-inf', av: 'lak-inf',
        utsatt: { tid: [-2, '10:05'], av: 'lak-inf', orsak: 'Byte till peroral behandling' } },
      { lm: 'VK-NPL-0034', dosering: '1 tablett 3 gånger dagligen', dos: 750, dosEnhet: 'mg', tider: ['08', '14', '20'], typ: 'tillfallig', orsak: 'Pneumoni, peroral fortsättning', uppfoljning: 5, start: [-2, '10:05'], slut: 5, enhet: 'uso-inf', av: 'lak-inf' },
      { lm: 'VK-NPL-0026', dosering: '2 tabletter vid behov, högst 4 gånger per dygn', dos: 1000, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Feber och smärta', uppfoljning: 7, start: [-5, '23:40'], enhet: 'uso-inf', av: 'lak-inf' },
    ],
  },

  // 9. Barn på vårdcentralen.
  {
    id: 'p09', pnr: '201712112398', fornamn: 'Leo', efternamn: 'Bergström',
    adress: 'Lövstagatan 4', postnr: '702 13', ort: 'Örebro', telefon: '070-174 06 14',
    kontaktperson: 'Vårdnadshavare Johanna Bergström, 070-174 06 14', listning: { enhet: 'vc-tybble', fran: '2017-12-20' },
    vardkontakter: [
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-400, '10:00'], slut: [-400, '10:30'], plats: 'Mottagning', orsak: 'Pip i bröstet' },
      { ref: 'vc2', enhet: 'vc-tybble', typ: 'oppenvard', start: [-180, '15:00'], slut: [-180, '15:40'], plats: 'Astmamottagning', orsak: 'Astmakontroll' },
      { ref: 'vc3', enhet: 'vc-tybble', typ: 'oppenvard', start: [-10, '08:30'], slut: [-10, '08:50'], plats: 'Mottagning', orsak: 'Öronvärk' },
    ],
    overkanslighet: [
      { amne: 'Jordnöt', atc: null, reaktion: 'Anafylaxi med svullnad i svalget och kräkningar', allvarlighet: 'allvarlig', enhet: 'vc-tybble', datum: '2021-06-12' },
    ],
    diagnoser: [
      { kod: 'Z91.0', text: 'Allergi och annan överkänslighet som inte beror på läkemedel och biologiska substanser i den egna sjukhistorien', enhet: 'vc-tybble', datum: '2021-06-12', typ: 'bi' },
      { kod: 'J45.9', text: 'Astma, ospecificerad', enhet: 'vc-tybble', vk: 'vc1', datum: -400, typ: 'huvud' },
      { kod: 'H66.9', text: 'Mellanöreinflammation, ej specificerad som varig eller icke varig', enhet: 'vc-tybble', vk: 'vc3', datum: -10, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-400, '10:25'], sokord: {
        'Kontaktorsak': 'Pip i bröstet vid förkylningar och ansträngning sedan i vintras. Mamma med.',
        'Status': 'Opåverkad. Lätta ronki vid forcerad utandning. PEF 210 före och 250 efter Airomir.',
        'Bedömning': 'Astma.',
        'Åtgärd': 'Airomir vid behov och Pulmicort 200 mikrogram morgon och kväll. Astmasköterska om sex månader.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'vc-tybble', vk: 'vc2', av: 'ssk-vc', tid: [-180, '15:35'], sokord: {
        'Andning/cirkulation': 'Astmakontroll med mamma. ACT 22. PEF 240.',
        'Kommunikation': 'Inhalationsteknik med spacer genomgången. Har EpiPen Jr med sig i skolan.',
        'Planering': 'Fortsatt behandling. Nytt besök om ett år.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc3', av: 'lak-vc', tid: [-10, '08:45'], sokord: {
        'Kontaktorsak': 'Öronvärk höger sedan två dagar, feber 38,5.',
        'Status': 'Höger trumhinna röd och buktande. Vänster normal.',
        'Bedömning': 'Akut mediaotit hos barn över två år, opåverkad.',
        'Åtgärd': 'Avvaktar med antibiotika. Alvedon vid behov. Mamma informerad om att höra av sig vid försämring eller om besvären varar mer än tre dagar.',
      } },
    ],
    matvarden: [
      ['vikt', 'vc-tybble', [[[-400, '10:05'], 25.1], [[-180, '15:05'], 26.4], [[-10, '08:35'], 27.9]]],
      ['langd', 'vc-tybble', [[[-400, '10:05'], 124], [[-180, '15:05'], 127]]],
      ['pef', 'vc-tybble', [[[-400, '10:10'], 210], [[-180, '15:10'], 240]]],
      ['temp', 'vc-tybble', [[[-10, '08:35'], 38.5]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0038', dosering: '1 till 2 doser via spacer vid behov', dosEnhet: 'dos', typ: 'vid_behov', vidBehov: true, orsak: 'Astma, akut lindring', uppfoljning: 60, start: -400, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0039', dosering: '1 inhalation morgon och kväll', dosEnhet: 'dos', tider: ['08', '20'], typ: 'staende', orsak: 'Astma, underhållsbehandling', uppfoljning: 60, start: -400, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0040', dosering: '1 injektion i lårets utsida vid allergisk reaktion med andningsbesvär', dosEnhet: 'st', typ: 'vid_behov', vidBehov: true, orsak: 'Jordnötsallergi med risk för anafylaxi', uppfoljning: 120, start: '2021-06-15', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0026', dosering: '1 tablett vid behov, högst 4 per dygn', dos: 500, dosEnhet: 'mg', typ: 'tillfallig', vidBehov: true, orsak: 'Feber och öronvärk', uppfoljning: -3, start: -10, slut: -3, enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 10. Äldre patient som vårdats på Lindesbergs lasarett, många läkemedel och en NLL-avvikelse.
  {
    id: 'p10', pnr: '194601136098', fornamn: 'Karl-Erik', efternamn: 'Brandt',
    adress: 'Kyrkvägen 15', postnr: '702 32', ort: 'Örebro', telefon: '070-174 06 15',
    kontaktperson: 'Hustru Gun Brandt, 070-174 06 16', listning: { enhet: 'vc-tybble', fran: '1990-01-01' },
    vardkontakter: [
      { ref: 'inl', enhet: 'lind-med', typ: 'slutenvard', start: [-20, '15:30'], slut: [-12, '11:00'], plats: 'Avdelning 2', orsak: 'Hjärtsvikt och fall' },
      { ref: 'vc', enhet: 'vc-tybble', typ: 'oppenvard', start: [-1, '13:00'], slut: [-1, '14:00'], plats: 'Mottagning', orsak: 'Läkemedelsgenomgång efter utskrivning' },
    ],
    diagnoser: [
      { kod: 'E03.9', text: 'Hypotyreos, ospecificerad', enhet: 'vc-tybble', datum: '2006-03-10', typ: 'bi' },
      { kod: 'K21.9', text: 'Gastroesofageal refluxsjukdom utan esofagit', enhet: 'vc-tybble', datum: '2019-09-01', typ: 'bi' },
      { kod: 'G30.1', text: 'Alzheimers sjukdom med sen debut', enhet: 'vc-tybble', datum: -900, typ: 'huvud' },
      { kod: 'I48.2', text: 'Kroniskt förmaksflimmer', enhet: 'lind-med', vk: 'inl', datum: -12, typ: 'bi' },
      { kod: 'I50.9', text: 'Hjärtinsufficiens, ospecificerad', enhet: 'lind-med', vk: 'inl', datum: -12, typ: 'huvud' },
      { kod: 'R29.6', text: 'Fallbenägenhet, som ej klassificeras på annan plats', enhet: 'lind-med', vk: 'inl', datum: -12, typ: 'bi' },
    ],
    anteckningar: [
      { typ: 'Inskrivningsanteckning', enhet: 'lind-med', vk: 'inl', av: 'lak-lind', tid: [-20, '16:30'], sokord: {
        'Kontaktorsak': 'Föll i hemmet. Tilltagande ödem och andfåddhet senaste veckan.',
        'Status': 'Ingen fraktur. Pittingödem upp till knäna. Blodtryck 142/80 liggande, 112/68 stående.',
        'Bedömning': 'Hjärtsvikt med vätskeretention. Fall med ortostatism och sömnmedel som möjliga bidragande orsaker.',
        'Åtgärd': 'Ökar Furosemid. Insätter Spironolakton. Ortostatiska blodtryck dagligen.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'lind-med', vk: 'inl', av: 'ssk-lind', tid: [-16, '14:00'], sokord: {
        'Aktivitet': 'Fallriskbedömning: hög risk. Larmmatta vid sängen.',
        'Kommunikation': 'Minnessvikt, behöver upprepad information. Hustrun informerad.',
      } },
      { typ: 'Epikris', enhet: 'lind-med', vk: 'inl', av: 'lak-lind', tid: [-12, '10:30'], sokord: {
        'Orsak till vård': 'Hjärtsvikt och fall.',
        'Förlopp': 'Vikten ned 3,5 kg på diuretika. Ortostatismen förbättrad.',
        'Läkemedelsförändringar': 'Furosemid 40 mg 1x2. Nyinsatt Spironolakton 25 mg. Zopiklon bör ses över på grund av fallrisk.',
        'Uppföljning': 'Läkemedelsgenomgång på vårdcentralen inom två veckor. Ekokardiografi via kardiologen.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc', av: 'lak-vc', tid: [-1, '13:55'], sokord: {
        'Kontaktorsak': 'Fördjupad läkemedelsgenomgång efter utskrivning från Lindesbergs lasarett.',
        'Aktuellt': 'Tio läkemedel. Inga nya fall. Hustrun delar dosetten.',
        'Bedömning': 'Zopiklon ökar fallrisken.',
        'Åtgärd': 'Sätter ut Zopiklon. Insätter Melatonin vid insomningssvårigheter. Övriga läkemedel oförändrade.',
      } },
    ],
    matvarden: [
      ['vikt', 'lind-med', [[[-20, '17:00'], 88.4], [[-16, '07:00'], 86.0], [[-12, '07:00'], 84.9]]],
      ['blodtryck', 'lind-med', [[[-20, '16:00'], '142/80'], [[-12, '08:00'], '124/74']]],
      ['ntprobnp', 'lind-med', [[[-20, '16:30'], 3200]]],
      ['kreatinin', 'lind-med', [[[-20, '16:30'], 104], [[-12, '06:30'], 118]]],
      ['kalium', 'lind-med', [[[-12, '06:30'], 4.4]]],
      ['vikt', 'vc-tybble', [[[-1, '13:05'], 85.2]]],
      ['blodtryck', 'vc-tybble', [[[-1, '13:05'], '124/72']]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0002', dosering: '1 tablett morgon och kväll', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Förmaksflimmer, strokeprofylax', uppfoljning: 90, start: -1500, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0009', dosering: '1 tablett på morgonen', dos: 5, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Förmaksflimmer, frekvensreglering', uppfoljning: 90, start: -1500, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0010', dosering: '1 tablett morgon och kl 14', dos: 40, dosEnhet: 'mg', tider: ['08', '14'], typ: 'staende', orsak: 'Hjärtsvikt', uppfoljning: 10, start: -16, enhet: 'lind-med', av: 'lak-lind' },
      { lm: 'VK-NPL-0011', dosering: '1 tablett på morgonen', dos: 25, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hjärtsvikt', uppfoljning: 10, start: -16, enhet: 'lind-med', av: 'lak-lind' },
      { lm: 'VK-NPL-0024', dosering: '1 tablett på morgonen före frukost', dos: 100, dosEnhet: 'mikrog', tider: ['07'], typ: 'staende', orsak: 'Hypotyreos', uppfoljning: 200, start: '2006-03-10', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0019', dosering: '1 tablett till kvällen', dos: 20, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Hyperlipidemi', uppfoljning: 90, start: -2500, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0025', dosering: '1 kapsel på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Refluxsjukdom', uppfoljning: 30, start: '2019-09-01', enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0026', dosering: '2 tabletter vid behov, högst 3 gånger per dygn', dos: 1000, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Ledvärk', uppfoljning: 60, start: -300, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0046', dosering: '1 tablett till kvällen', dos: 5, dosEnhet: 'mg', tider: ['20'], typ: 'staende', orsak: 'Alzheimers sjukdom', uppfoljning: 60, start: -900, enhet: 'vc-tybble', av: 'lak-vc' },
      { lm: 'VK-NPL-0044', dosering: '1 tablett till natten vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Sömnsvårigheter', uppfoljning: -30, start: -700, enhet: 'vc-tybble', av: 'lak-vc',
        utsatt: { tid: [-1, '13:50'], av: 'lak-vc', orsak: 'Ökad fallrisk, ersätts med melatonin' } },
      { lm: 'VK-NPL-0045', dosering: '1 tablett 1 timme före sänggåendet vid behov', dos: 2, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Insomningssvårigheter', uppfoljning: 30, start: [-1, '13:52'], enhet: 'vc-tybble', av: 'lak-vc', nll: 'timeout' },
    ],
  },

  // 11. Remissvar som inte kvitterats av avsändaren.
  {
    id: 'p11', pnr: '198004262385', fornamn: 'Anna', efternamn: 'Viklund',
    adress: 'Skolgatan 31', postnr: '703 64', ort: 'Örebro', telefon: '070-174 06 17',
    kontaktperson: null, listning: { enhet: 'vc-tybble', fran: '2005-06-01' },
    vardkontakter: [
      { ref: 'vc0', enhet: 'vc-tybble', typ: 'oppenvard', start: [-300, '09:00'], slut: [-300, '09:20'], plats: 'Mottagning', orsak: 'Kontroll hypotyreos' },
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-30, '14:30'], slut: [-30, '15:00'], plats: 'Mottagning', orsak: 'Hjärtklappning' },
      { ref: 'mott1', enhet: 'uso-kard-mott', typ: 'oppenvard', start: [-12, '10:00'], slut: [-12, '10:20'], plats: 'Kardiologiska mottagningen', orsak: 'Långtids-EKG' },
    ],
    diagnoser: [
      { kod: 'E03.9', text: 'Hypotyreos, ospecificerad', enhet: 'vc-tybble', datum: '2011-02-14', typ: 'huvud' },
      { kod: 'R00.2', text: 'Hjärtklappning', enhet: 'vc-tybble', vk: 'vc1', datum: -30, typ: 'huvud' },
      { kod: 'I49.1', text: 'Prematur depolarisation av förmaket', enhet: 'uso-kard-mott', vk: 'mott1', datum: -5, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc0', av: 'lak-vc', tid: [-300, '09:15'], sokord: {
        'Kontaktorsak': 'Kontroll av hypotyreos.',
        'Bedömning': 'TSH 2,1 på Levaxin 100 mikrogram. Mår bra.',
        'Åtgärd': 'Oförändrad dos. Nytt prov om ett år.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-30, '14:55'], sokord: {
        'Kontaktorsak': 'Hjärtklappning några gånger per vecka sedan två månader.',
        'Status': 'EKG i vila: sinusrytm 78. TSH 1,8.',
        'Åtgärd': 'Remiss till kardiologen för långtids-EKG.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-kard-mott', vk: 'mott1', av: 'lak-kard', tid: [-12, '10:15'], sokord: {
        'Kontaktorsak': 'Påkoppling av långtids-EKG under 48 timmar.',
        'Åtgärd': 'Patienten för dagbok över symtom. Bedömning när registreringen är klar.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-kard-mott', av: 'lak-kard', tid: [-5, '13:40'], sokord: {
        'Bedömning': 'Långtids-EKG: sinusrytm med enstaka supraventrikulära extraslag som sammanfaller med symtomen. Ingen behandlingskrävande arytmi.',
        'Åtgärd': 'Svar skickat till remittenten. Ingen uppföljning på kardiologen.',
      } },
    ],
    matvarden: [
      ['tsh', 'vc-tybble', [[[-300, '08:30'], 2.1], [[-30, '08:30'], 1.8]]],
      ['puls', 'vc-tybble', [[[-30, '14:35'], 78]]],
      ['blodtryck', 'vc-tybble', [[[-30, '14:35'], '122/76']]],
      ['puls', 'uso-kard-mott', [[[-12, '10:05'], 74]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0024', dosering: '1 tablett på morgonen före frukost', dos: 100, dosEnhet: 'mikrog', tider: ['07'], typ: 'staende', orsak: 'Hypotyreos', uppfoljning: 120, start: '2011-02-14', enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 12. Utan vårdrelation till någon demoroll: visar nekad åtkomst.
  {
    id: 'p12', pnr: '199812212398', fornamn: 'Oskar', efternamn: 'Ekström',
    adress: 'Ånstagatan 6', postnr: '703 52', ort: 'Örebro', telefon: '070-174 06 18',
    kontaktperson: null,
    vardkontakter: [
      { ref: 'mott0', enhet: 'uso-ort', typ: 'oppenvard', start: [-60, '09:00'], slut: [-60, '09:30'], plats: 'Ortopedmottagningen', orsak: 'Knäskada' },
      { ref: 'op', enhet: 'uso-ort', typ: 'slutenvard', start: [-40, '07:00'], slut: [-39, '12:00'], plats: 'Avdelning 61', orsak: 'Korsbandsrekonstruktion' },
      { ref: 'mott1', enhet: 'uso-ort', typ: 'oppenvard', start: [-10, '14:00'], slut: [-10, '14:20'], plats: 'Ortopedmottagningen', orsak: 'Återbesök efter operation' },
    ],
    diagnoser: [
      { kod: 'S83.5', text: 'Distorsion engagerande knäets (främre) (bakre) korsband', enhet: 'uso-ort', vk: 'mott0', datum: -60, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'uso-ort', vk: 'mott0', av: 'lak-ort', tid: [-60, '09:25'], sokord: {
        'Kontaktorsak': 'Vred höger knä vid fotboll för två månader sedan.',
        'Status': 'Positivt Lachmans test. MR: total ruptur av främre korsbandet.',
        'Åtgärd': 'Planeras för rekonstruktion.',
      } },
      { typ: 'Inskrivningsanteckning', enhet: 'uso-ort', vk: 'op', av: 'lak-ort', tid: [-40, '07:30'], sokord: {
        'Kontaktorsak': 'Främre korsbandsrekonstruktion höger knä med hamstringsgraft.',
        'Anamnes': 'Frisk i övrigt. Inga läkemedel.',
      } },
      { typ: 'Epikris', enhet: 'uso-ort', vk: 'op', av: 'lak-ort', tid: [-39, '11:30'], sokord: {
        'Förlopp': 'Okomplicerad operation och postoperativt förlopp.',
        'Uppföljning': 'Rehabilitering hos fysioterapeut. Återbesök om sex veckor.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-ort', vk: 'mott1', av: 'lak-ort', tid: [-10, '14:15'], sokord: {
        'Status': 'Rörlighet 0 till 110 grader. Stabilt knä.',
        'Åtgärd': 'Fortsatt rehabilitering. Löpning tidigast om tre månader.',
      } },
    ],
    matvarden: [
      ['vikt', 'uso-ort', [[[-60, '09:05'], 78.0]]],
      ['blodtryck', 'uso-ort', [[[-40, '07:10'], '124/72']]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0027', dosering: '1 tablett 3 gånger dagligen vid behov', dos: 400, dosEnhet: 'mg', typ: 'tillfallig', vidBehov: true, orsak: 'Smärta efter operation', uppfoljning: -26, start: -40, slut: -26, enhet: 'uso-ort', av: 'lak-ort' },
      { lm: 'VK-NPL-0026', dosering: '2 tabletter vid behov, högst 4 gånger per dygn', dos: 1000, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Smärta efter operation', uppfoljning: 20, start: -40, enhet: 'uso-ort', av: 'lak-ort' },
    ],
  },

  // 13. I akutens väntrum, fotledsskada.
  {
    id: 'p13', pnr: '200104182381', fornamn: 'Emma', efternamn: 'Karlsson',
    adress: 'Kvarngatan 2', postnr: '692 30', ort: 'Kumla', telefon: '070-174 06 19',
    kontaktperson: null, listning: { enhet: 'vc-kumla', fran: '2001-05-01' },
    vardkontakter: [
      { ref: 'vc1', enhet: 'vc-kumla', typ: 'oppenvard', start: [-500, '11:00'], slut: [-500, '11:20'], plats: 'Mottagning', orsak: 'Preventivmedel' },
      { ref: 'vc2', enhet: 'vc-kumla', typ: 'oppenvard', start: [-200, '08:40'], slut: [-200, '09:00'], plats: 'Mottagning', orsak: 'Halsont' },
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: { min: -90 }, plats: 'Väntrum', orsak: 'Vriden fotled' },
    ],
    diagnoser: [
      { kod: 'Z30.4', text: 'Övervakning av förskrivna preventivläkemedel', enhet: 'vc-kumla', vk: 'vc1', datum: -500, typ: 'huvud' },
      { kod: 'J02.9', text: 'Akut faryngit, ospecificerad', enhet: 'vc-kumla', vk: 'vc2', datum: -200, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc1', av: 'lak-kumla', tid: [-500, '11:15'], sokord: {
        'Kontaktorsak': 'Önskar p-piller.',
        'Status': 'Blodtryck 112/70. Röker inte. Ingen ärftlighet för blodpropp.',
        'Åtgärd': 'Förskriver desogestrel. Uppföljning om ett år.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-kumla', vk: 'vc2', av: 'lak-kumla', tid: [-200, '08:55'], sokord: {
        'Kontaktorsak': 'Halsont sedan två dagar.',
        'Status': 'Temp 37,2. Lätt rodnad i svalget, inga beläggningar. Inga förstorade lymfkörtlar.',
        'Bedömning': 'Viral faryngit, Centor 1.',
        'Åtgärd': 'Ingen antibiotika. Egenvårdsråd.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-akut', vk: 'akut', av: 'ssk-akut', tid: { min: -80 }, sokord: {
        'Smärta': 'Vrickade vänster fotled vid löpning i morse. Skattar smärtan till 4 av 10.',
        'Hud/vävnad': 'Svullnad lateralt om fotleden. Kan belasta med smärta.',
        'Planering': 'Prioritet grön enligt RETTS. Kylning och högläge i väntrummet.',
      } },
    ],
    matvarden: [
      ['blodtryck', 'vc-kumla', [[[-500, '11:05'], '112/70']]],
      ['temp', 'vc-kumla', [[[-200, '08:45'], 37.2]]],
      ['puls', 'uso-akut', [[{ min: -82 }, 76]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0050', dosering: '1 tablett dagligen', dos: 75, dosEnhet: 'mikrog', tider: ['20'], typ: 'staende', orsak: 'Antikonception', uppfoljning: 165, start: -500, enhet: 'vc-kumla', av: 'lak-kumla' },
    ],
  },

  // 14. I akutens väntrum, njurstensanfall. Migrerad akutjournal från VAS.
  {
    id: 'p14', pnr: '197701172392', fornamn: 'Mikael', efternamn: 'Svensson',
    adress: 'Bettorpsgatan 11', postnr: '703 69', ort: 'Örebro', telefon: '070-174 06 20',
    kontaktperson: 'Fru Sofie Svensson, 070-174 06 21', listning: { enhet: 'vc-tybble', fran: '2012-08-01' },
    vardkontakter: [
      { ref: 'vas', enhet: 'uso-akut', typ: 'akut', start: ['2019-04-03', '02:10'], slut: ['2019-04-03', '06:40'], plats: 'Akutrum 5', orsak: 'Njurstensanfall', kalla: 'migrerad:VAS' },
      { ref: 'vc1', enhet: 'vc-tybble', typ: 'oppenvard', start: [-150, '08:00'], slut: [-150, '08:30'], plats: 'Mottagning', orsak: 'Högt blodtryck' },
      { ref: 'vc2', enhet: 'vc-tybble', typ: 'oppenvard', start: [-120, '08:00'], slut: [-120, '08:15'], plats: 'Sjuksköterskemottagning', orsak: 'Blodtryckskontroll' },
      { ref: 'akut', enhet: 'uso-akut', typ: 'akut', start: { min: -20 }, plats: 'Väntrum', orsak: 'Flanksmärta' },
    ],
    diagnoser: [
      { kod: 'N20.1', text: 'Uretärsten', enhet: 'uso-akut', vk: 'vas', datum: '2019-04-03', typ: 'huvud', kalla: 'migrerad:VAS' },
      { kod: 'I10.9', text: 'Essentiell hypertoni (högt blodtryck utan känd orsak)', enhet: 'vc-tybble', vk: 'vc1', datum: -150, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Akutanteckning', enhet: 'uso-akut', vk: 'vas', av: 'lak-vas', tid: ['2019-04-03', '03:00'], kalla: 'migrerad:VAS', sokord: {
        'Kontaktorsak': 'Plötslig smärta i höger flank sedan midnatt.',
        'Status': 'Dunkömhet höger njurloge. Urinsticka: blod 3+.',
        'Bedömning': 'Datortomografi visar 4 mm uretärsten höger.',
        'Åtgärd': 'Diklofenak. Går hem. Återkommer vid feber eller okontrollerad smärta.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'vc-tybble', vk: 'vc1', av: 'lak-vc', tid: [-150, '08:25'], sokord: {
        'Kontaktorsak': 'Förhöjt blodtryck vid hälsokontroll på jobbet.',
        'Status': 'Blodtryck 152/98 vid upprepade mätningar.',
        'Åtgärd': 'Insätter enalapril 10 mg. Kontroll hos sjuksköterska om fyra veckor.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'vc-tybble', vk: 'vc2', av: 'ssk-vc', tid: [-120, '08:10'], sokord: {
        'Andning/cirkulation': 'Blodtryck 136/86. Inga biverkningar av enalapril.',
        'Planering': 'Kontroll om sex månader.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-akut', vk: 'akut', av: 'ssk-akut', tid: { min: -15 }, sokord: {
        'Smärta': 'Kraftig smärta i höger flank som strålar mot ljumsken sedan en timme. Skattar smärtan till 8 av 10. Illamående.',
        'Andning/cirkulation': 'Puls 98, blodtryck 158/94.',
        'Planering': 'Prioritet orange enligt RETTS. Tidigare njursten 2019.',
      } },
    ],
    matvarden: [
      ['blodtryck', 'vc-tybble', [[[-150, '08:05'], '152/98'], [[-120, '08:05'], '136/86']]],
      ['blodtryck', 'uso-akut', [[{ min: -16 }, '158/94']]],
      ['puls', 'uso-akut', [[{ min: -16 }, 98]]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0012', dosering: '1 tablett på morgonen', dos: 10, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Hypertoni', uppfoljning: 30, start: -150, enhet: 'vc-tybble', av: 'lak-vc' },
    ],
  },

  // 15. Allmänpsykiatrisk öppenvård.
  {
    id: 'p15', pnr: '198804212390', fornamn: 'David', efternamn: 'Nordin',
    adress: 'Fabriksgatan 40', postnr: '702 23', ort: 'Örebro', telefon: '070-174 06 22',
    kontaktperson: null,
    vardkontakter: [
      { ref: 'psyk', enhet: 'uso-psyk', typ: 'oppenvard', start: [-180, '10:00'], plats: 'Psykiatrisk öppenvårdsmottagning', orsak: 'Nedstämdhet' },
    ],
    diagnoser: [
      { kod: 'F32.1', text: 'Medelsvår depressiv episod', enhet: 'uso-psyk', vk: 'psyk', datum: -180, typ: 'huvud' },
    ],
    anteckningar: [
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-180, '10:50'], sokord: {
        'Kontaktorsak': 'Nybesök. Nedstämdhet och sömnproblem sedan separation i våras.',
        'Status': 'Sänkt grundstämning, psykomotoriskt långsam. Förnekar suicidtankar. MADRS 24.',
        'Bedömning': 'Medelsvår depressiv episod.',
        'Åtgärd': 'Insätter escitalopram 10 mg. Återbesök om fyra veckor.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-120, '11:00'], sokord: {
        'Aktuellt': 'Något bättre stämning. Svårt att somna.',
        'Åtgärd': 'Lägger till melatonin vid behov.',
      } },
      { typ: 'Omvårdnadsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'ssk-psyk', tid: [-90, '09:00'], sokord: {
        'Psykosocialt': 'Har börjat arbeta halvtid. Träffar vänner igen.',
        'Planering': 'Stödsamtal varannan vecka.',
      } },
      { typ: 'Mottagningsanteckning', enhet: 'uso-psyk', vk: 'psyk', av: 'lak-psyk', tid: [-30, '13:30'], sokord: {
        'Aktuellt': 'Mår betydligt bättre. MADRS 11.',
        'Åtgärd': 'Fortsatt escitalopram i minst sex månader.',
      } },
    ],
    matvarden: [
      ['vikt', 'uso-psyk', [[[-180, '10:05'], 82.0], [[-30, '13:05'], 83.1]]],
      ['blodtryck', 'uso-psyk', [[[-180, '10:05'], '128/80']]],
    ],
    ordinationer: [
      { lm: 'VK-NPL-0042', dosering: '1 tablett på morgonen', dos: 10, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Depression', uppfoljning: 30, start: -180, enhet: 'uso-psyk', av: 'lak-psyk' },
      { lm: 'VK-NPL-0045', dosering: '1 tablett 1 timme före sänggåendet vid behov', dos: 2, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Insomningssvårigheter vid depression', uppfoljning: 30, start: -120, enhet: 'uso-psyk', av: 'lak-psyk' },
    ],
  },
];

// Remisser i varje läge av statuskedjan.
export const REMISSER = [
  // Saknar mottagningskvittens efter mer än 2 timmar: larm.
  { patient: 'p05', fran: 'vc-kumla', till: 'uso-kard', av: 'lak-kumla', prioritet: 'skyndsam', svarSenast: 14,
    fragestallning: 'Misstänkt kärlkramp. Arbetsprov och bedömning?',
    anamnes: 'Tryck över bröstet vid ansträngning sedan tre veckor, nu även på plan mark. Vilo-EKG normalt. Hypertoni och hyperkolesterolemi. Ärftlighet för hjärtinfarkt.',
    skickad: [-1, '15:40'] },
  // Nyss skickad, inget larm ännu. Skyddad patient.
  { patient: 'p03', fran: 'vc-tybble', till: 'uso-kard', av: 'lak-vc', prioritet: 'normal', svarSenast: 30,
    fragestallning: 'Hjärtklappning. Långtids-EKG?',
    anamnes: 'Episoder av hjärtklappning sedan en månad. Vilo-EKG sinusrytm. TSH normalt.',
    skickad: { min: -50 } },
  // Mottagen, väntar på bedömning (på vårdcentralen).
  { patient: 'p07', fran: 'kkoga-ort', till: 'vc-tybble', av: 'lak-kkoga', prioritet: 'normal', svarSenast: 26,
    fragestallning: 'Ställningstagande till bisfosfonat efter lågenergifraktur.',
    anamnes: 'Opererad med halvprotes för lårbenshalsfraktur. Kalcium och D-vitamin insatt.',
    skickad: [-4, '11:20'], mottagen: [-4, '13:05'], mottagenAv: 'ssk-vc' },
  // Bedömd och accepterad, svar inte förfallet.
  { patient: 'p10', fran: 'lind-med', till: 'uso-kard', av: 'lak-lind', prioritet: 'normal', svarSenast: 18,
    fragestallning: 'Ekokardiografi och bedömning av hjärtsvikt.',
    anamnes: 'Vårdad för hjärtsvikt med vätskeretention. Kroniskt förmaksflimmer på apixaban. NT-proBNP 3200.',
    skickad: [-12, '10:00'], mottagen: [-11, '08:30'], mottagenAv: 'adm-kard', bedomd: [-10, '14:00'], bedomdAv: 'lak-kard', beslut: 'accepterad' },
  // Accepterad men sista svarsdatum passerat: larm.
  { patient: 'p06', fran: 'vc-tybble', till: 'uso-med', av: 'lak-vc', prioritet: 'normal', svarSenast: -3,
    fragestallning: 'Njurmedicinsk bedömning vid sjunkande eGFR.',
    anamnes: 'Diabetes typ 2 och hypertoni. eGFR 48 för ett år sedan, nu 33. Metformin och Lantus.',
    skickad: [-90, '14:00'], mottagen: [-89, '09:10'], mottagenAv: 'lak-med', bedomd: [-85, '11:00'], bedomdAv: 'lak-med', beslut: 'accepterad' },
  // Avvisad med motivering.
  { patient: 'p06', fran: 'vc-tybble', till: 'uso-kard', av: 'lak-vc', prioritet: 'normal', svarSenast: -130,
    fragestallning: 'Blåsljud över hjärtat. Bedömning?',
    anamnes: 'Nyupptäckt systoliskt blåsljud. Inga symtom.',
    skickad: [-160, '10:00'], mottagen: [-160, '13:00'], mottagenAv: 'adm-kard', bedomd: [-158, '09:00'], bedomdAv: 'lak-kard', beslut: 'avvisad',
    motivering: 'Ekokardiografi kan beställas direkt från primärvården. Remittera igen vid patologiskt fynd.' },
  // Besvarad för 5 dagar sedan men inte kvitterad av avsändaren: larm.
  { patient: 'p11', fran: 'vc-tybble', till: 'uso-kard', av: 'lak-vc', prioritet: 'normal', svarSenast: -2,
    fragestallning: 'Hjärtklappning. Långtids-EKG?',
    anamnes: 'Hjärtklappning några gånger per vecka sedan två månader. Vilo-EKG sinusrytm. TSH 1,8 på Levaxin.',
    skickad: [-30, '15:00'], mottagen: [-29, '08:40'], mottagenAv: 'adm-kard', bedomd: [-28, '10:00'], bedomdAv: 'lak-kard', beslut: 'accepterad',
    besvarad: [-5, '14:00'], besvaradAv: 'lak-kard',
    svar: 'Långtids-EKG under 48 timmar visar sinusrytm med enstaka supraventrikulära extraslag, 212 per dygn, som sammanfaller med symtomen. Inget förmaksflimmer och ingen annan behandlingskrävande arytmi. Råd om att minska koffein. Ingen uppföljning på kardiologen.' },
  // Hela kedjan klar, migrerad från Cosmic.
  { patient: 'p01', fran: 'vc-tybble', till: 'uso-kard', av: 'lak-vc', prioritet: 'normal', svarSenast: '2023-06-30', kalla: 'migrerad:Cosmic',
    fragestallning: 'Tilltagande andfåddhet vid känt förmaksflimmer. Ekokardiografi?',
    anamnes: 'Förmaksflimmer sedan 2014 på Waran. Trötthet och andfåddhet vid ansträngning.',
    skickad: ['2023-04-20', '11:00'], mottagen: ['2023-04-20', '14:00'], mottagenAv: 'lak-cosmic', bedomd: ['2023-04-24', '09:00'], bedomdAv: 'lak-cosmic', beslut: 'accepterad',
    besvarad: ['2023-05-16', '10:30'], besvaradAv: 'lak-cosmic', svar: 'Ekokardiografi visar EF 40 procent. Furosemid insatt. Återbesök på kardiologiska mottagningen om sex månader.',
    svarKvitterat: ['2023-05-17', '08:15'], svarKvitteratAv: 'lak-vc' },
];

// Akutmottagningens väntrum.
export const VANTRUM = [
  { patient: 'p13', konummer: 'A07', ankomst: { min: -90 }, prioritet: 'gron', orsak: 'Fotledsskada' },
  { patient: 'p03', konummer: 'A09', ankomst: { min: -40 }, prioritet: 'gul', orsak: 'Buksmärta' },
  { patient: 'p14', konummer: 'A11', ankomst: { min: -20 }, prioritet: 'orange', orsak: 'Flanksmärta' },
];

// Tidigare åtkomster som redan finns i loggen när sandlådan skapas.
export const LOGG = [
  { tid: [-700, '03:12'], av: 'lak-akut', patient: 'p02', handling: 'nodatkomst', grund: 'nodatkomst', syfte: 'Medvetslös vid ankomst, behöver tidigare journal och läkemedel', resultat: 'tillaten' },
  { tid: [-3, '08:20'], av: 'lak-akut', patient: 'p01', handling: 'las_oversikt', grund: 'vardrelation', resultat: 'tillaten' },
  { tid: [-3, '13:00'], av: 'lak-kard', patient: 'p01', handling: 'las_journal', grund: 'egen_enhet', resultat: 'tillaten' },
  { tid: [-3, '13:02'], av: 'lak-kard', patient: 'p01', handling: 'andra_enheter', grund: 'aktivt_val', syfte: 'Inskrivning, läser akutmottagningens anteckning', resultat: 'tillaten' },
  { tid: [-1, '09:00'], av: 'adm-kard', patient: 'p12', handling: 'las_admin', grund: 'nekad', resultat: 'nekad' },
  { tid: [-1, '10:15'], av: 'lak-kard', patient: 'p04', handling: 'samtycke_sparr', grund: 'samtycke_sparr', syfte: 'Patienten samtycker muntligt, genomgång av läkemedel inför PCI', resultat: 'tillaten' },
];

// Avvikelser i migreringen som inte är åtgärdade.
export const MIGRERING_AVVIKELSER = [
  { patient: 'p01', datatyp: 'overkanslighet', kalla: 'migrerad:VAS',
    beskrivning: 'Överkänslighet mot jodkontrastmedel fanns bara som fritext i en VAS-epikris från 2014 och fördes inte över som strukturerad uppgift.',
    atgard: 'Ansvarig läkare kontrollerar uppgiften med patienten och registrerar den som strukturerad överkänslighet. Avvikelsen stängs när det är gjort.' },
];
